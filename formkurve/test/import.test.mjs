import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zipSync, strToU8 } from 'fflate';
import { parseShortcutText } from '../js/import/shortcut.js';
import { createXmlScanner, importHealthFile } from '../js/import/healthExport.js';
import { SLEEP } from '../js/data/normalize.js';

test('Kurzbefehl-Zeilen mit deutschen Namen und Formaten', () => {
  const text = [
    '# Formkurve Sync',
    'Herzfrequenz;2026-10-25T03:00:00+01:00;2026-10-25T03:00:00+01:00;54;count/min;Zepp',
    'Herzfrequenzvariabilität;25.10.2026, 03:10;25.10.2026, 03:10;47,5;ms;Zepp',
    'Schlafanalyse;2026-10-25T00:10:00+01:00;2026-10-25T01:40:00+01:00;Tief;;Zepp',
    'Blutsauerstoff;2026-10-25T02:00:00+01:00;2026-10-25T02:00:00+01:00;0,97;%;Zepp',
    'Schritte;2026-10-25T10:00:00+01:00;2026-10-25T10:59:00+01:00;1.234;Schritte;iPhone; von Lukas',
    'Gehende Herzfrequenz (Durchschnitt);2026-10-25T10:00:00+01:00;2026-10-25T10:00:00+01:00;98;;Zepp',
    'kaputt',
  ].join('\n');
  const { samples, stats } = parseShortcutText(text);
  assert.equal(samples.length, 5);
  assert.equal(stats.skipped, 2);
  const sleep = samples.find((s) => s.type === 'sleep');
  assert.equal(sleep.v, SLEEP.DEEP);
  assert.equal(samples.find((s) => s.type === 'spo2').v, 97);
  assert.equal(samples.find((s) => s.type === 'hrv').v, 47.5);
  const steps = samples.find((s) => s.type === 'steps');
  assert.equal(steps.v, 1234);
  assert.equal(steps.src, 'iPhone; von Lukas');
});

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE HealthData [
<!ELEMENT HealthData (ExportDate,Me,(Record|Correlation|Workout|ActivitySummary|ClinicalRecord)*)>
<!ATTLIST Record type CDATA #REQUIRED>
]>
<HealthData locale="de_DE">
 <ExportDate value="2026-10-26 08:00:00 +0100"/>
 <Record type="HKQuantityTypeIdentifierHeartRate" sourceName="Zepp" sourceVersion="9.1" unit="count/min" creationDate="2026-10-25 03:01:00 +0100" startDate="2026-10-25 03:00:00 +0100" endDate="2026-10-25 03:00:00 +0100" value="54"/>
 <Record type="HKQuantityTypeIdentifierHeartRateVariabilitySDNN" sourceName="Zepp" unit="ms" startDate="2026-10-25 03:05:00 +0100" endDate="2026-10-25 03:06:00 +0100" value="48.2">
  <HeartRateVariabilityMetadataList>
   <InstantaneousBeatsPerMinute bpm="55" time="3:05:01,12 AM"/>
  </HeartRateVariabilityMetadataList>
 </Record>
 <Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="Zepp" startDate="2026-10-25 00:10:00 +0100" endDate="2026-10-25 01:40:00 +0100" value="HKCategoryValueSleepAnalysisAsleepDeep"/>
 <Record type="HKQuantityTypeIdentifierStepCount" sourceName="Lukas&#8217;s iPhone" device="&lt;&lt;HKDevice: 0x1&gt;, name:iPhone&gt;" unit="count" startDate="2026-10-25 10:00:00 +0100" endDate="2026-10-25 10:10:00 +0100" value="812"/>
 <Record type="HKQuantityTypeIdentifierBodyFatPercentage" sourceName="Waage" unit="%" startDate="2026-10-25 07:00:00 +0100" endDate="2026-10-25 07:00:00 +0100" value="0.18"/>
 <Record type="HKQuantityTypeIdentifierHeartRate" sourceName="Zepp" unit="count/min" startDate="2024-01-01 03:00:00 +0100" endDate="2024-01-01 03:00:00 +0100" value="60"/>
 <Workout workoutActivityType="HKWorkoutActivityTypeTraditionalStrengthTraining" duration="45.5" durationUnit="min" sourceName="Zepp" startDate="2026-10-25 18:00:00 +0100" endDate="2026-10-25 18:45:30 +0100">
  <MetadataEntry key="HKIndoorWorkout" value="1"/>
  <WorkoutStatistics type="HKQuantityTypeIdentifierHeartRate" startDate="2026-10-25 18:00:00 +0100" endDate="2026-10-25 18:45:30 +0100" average="121.5" minimum="80" maximum="151" unit="count/min"/>
 </Workout>
</HealthData>
`;

test('Health-Export: XML-Scanner auch über Blockgrenzen', () => {
  const samples = [];
  const workouts = [];
  const scanner = createXmlScanner({ sinceMs: Date.UTC(2025, 0, 1), onSample: (s) => samples.push(s), onWorkout: (w) => workouts.push(w) });
  for (let i = 0; i < XML.length; i += 37) scanner.push(XML.slice(i, i + 37));
  assert.equal(samples.length, 4);
  assert.equal(scanner.stats.old, 1);
  assert.equal(samples.find((s) => s.type === 'hrv').v, 48.2);
  assert.equal(samples.find((s) => s.type === 'steps').src, 'Lukas’s iPhone');
  assert.equal(samples.find((s) => s.type === 'sleep').v, SLEEP.DEEP);
  assert.equal(workouts.length, 1);
  assert.equal(workouts[0].kind, 'kraft');
  assert.equal(workouts[0].avgHr, 121.5);
  assert.equal(workouts[0].durMin, 45.5);
});

test('Health-Export: ZIP wird gestreamt entpackt', async () => {
  const zipped = zipSync({ 'apple_health_export/export_cda.xml': strToU8('<cda/>'.repeat(1000)), 'apple_health_export/export.xml': strToU8(XML) });
  const file = new File([zipped], 'export.zip', { type: 'application/zip' });
  const got = [];
  const stats = await importHealthFile(file, { sinceMs: Date.UTC(2025, 0, 1), onBatch: (s, w) => got.push(...s, ...w) });
  assert.equal(stats.used, 4);
  assert.equal(stats.workouts, 1);
  assert.equal(got.length, 5);
});
