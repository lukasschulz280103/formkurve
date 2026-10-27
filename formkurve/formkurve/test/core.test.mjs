import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLooseDate, addDays, dateKey, diffDays, clockMinutesCentered, rangeKeys } from '../js/core/time.js';
import { median, mad, benjaminiHochberg, permutationTest, mulberry32, ridge, weightedMean, linmap, pearson } from '../js/core/stats.js';
import { typeFromName, parseNumber, sleepCode, normalizeValue, SLEEP, workoutKind } from '../js/data/normalize.js';

test('Datumsformate aus Apple Health und Kurzbefehl', () => {
  const iso = parseLooseDate('2026-10-25T07:59:00+01:00');
  assert.equal(iso, Date.UTC(2026, 9, 25, 6, 59));
  assert.equal(parseLooseDate('2026-10-25 07:59:00 +0100'), iso);
  assert.equal(parseLooseDate('25.10.2026, 07:59'), new Date(2026, 9, 25, 7, 59).getTime());
  assert.equal(parseLooseDate('25. Okt. 2026 um 07:59'), new Date(2026, 9, 25, 7, 59).getTime());
  assert.equal(parseLooseDate('Oct 25, 2026 at 7:59 PM'), new Date(2026, 9, 25, 19, 59).getTime());
  assert.equal(parseLooseDate('1761375540'), 1761375540000);
  assert.ok(Number.isNaN(parseLooseDate('kein Datum')));
});

test('Tagesschlüssel über Zeitumstellung', () => {
  assert.equal(addDays('2026-10-24', 2), '2026-10-26');
  assert.equal(addDays('2026-03-28', 1), '2026-03-29');
  assert.equal(diffDays('2026-10-01', '2026-10-26'), 25);
  assert.equal(dateKey(new Date(2026, 9, 25, 23, 30).getTime()), '2026-10-25');
  assert.equal(rangeKeys('2026-10-24', '2026-10-26').length, 3);
  assert.equal(clockMinutesCentered(new Date(2026, 0, 1, 22, 30).getTime()), -90);
  assert.equal(clockMinutesCentered(new Date(2026, 0, 2, 1, 0).getTime()), 60);
});

test('Robuste Statistik', () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(mad([1, 2, 3, 4, 100]), 1);
  assert.equal(weightedMean([[10, 1], [null, 5], [20, 1]]), 15);
  assert.equal(linmap(78, 78, 42), 0);
  assert.equal(linmap(42, 78, 42), 100);
  assert.equal(linmap(60, 78, 42), 50);
  const r = pearson([1, 2, 3, 4], [2, 4, 6, 8]);
  assert.ok(Math.abs(r.r - 1) < 1e-9);
});

test('Benjamini-Hochberg wie im Lehrbuch', () => {
  const q = benjaminiHochberg([0.01, 0.04, 0.03, 0.005]);
  assert.deepEqual(q.map((x) => Math.round(x * 1000) / 1000), [0.02, 0.04, 0.04, 0.02]);
});

test('Permutationstest erkennt klare Unterschiede', () => {
  const rng = mulberry32(1);
  const a = Array.from({ length: 20 }, (_, i) => 10 + (i % 3));
  const b = Array.from({ length: 20 }, (_, i) => 5 + (i % 3));
  assert.ok(permutationTest(a, b, 1000, rng) < 0.01);
  const c = Array.from({ length: 20 }, (_, i) => 5 + (i % 3));
  assert.ok(permutationTest(c, b, 1000, rng) > 0.5);
});

test('Ridge findet bereinigte Effekte', () => {
  const rng = mulberry32(3);
  const X = [];
  const y = [];
  for (let i = 0; i < 300; i++) {
    const a = rng() < 0.5 ? 1 : 0;
    const b = rng() < 0.5 ? 1 : 0;
    X.push([a, b]);
    y.push(2 * a - 1 * b + (rng() - 0.5) * 0.2);
  }
  const fit = ridge(X, y, 0.01);
  assert.ok(Math.abs(fit.coef[0] - 2) < 0.05);
  assert.ok(Math.abs(fit.coef[1] + 1) < 0.05);
});

test('Typen aus deutschen und englischen Namen', () => {
  assert.equal(typeFromName('Herzfrequenz'), 'hr');
  assert.equal(typeFromName('Herzfrequenzvariabilität'), 'hrv');
  assert.equal(typeFromName('Ruheherzfrequenz'), 'rhr');
  assert.equal(typeFromName('Gehende Herzfrequenz (Durchschnitt)'), null);
  assert.equal(typeFromName('Blutsauerstoff'), 'spo2');
  assert.equal(typeFromName('Sauerstoffsättigung'), 'spo2');
  assert.equal(typeFromName('Atemfrequenz'), 'resp');
  assert.equal(typeFromName('Schritte'), 'steps');
  assert.equal(typeFromName('Schlafanalyse'), 'sleep');
  assert.equal(typeFromName('Heart Rate Variability'), 'hrv');
  assert.equal(typeFromName('HKQuantityTypeIdentifierHeartRate'), 'hr');
  assert.equal(typeFromName('Ruheenergie'), null);
});

test('Zahlen und Einheiten', () => {
  assert.equal(parseNumber('0,97'), 0.97);
  assert.equal(parseNumber('62 Schläge/Min.'), 62);
  assert.equal(parseNumber('1.234', 'steps'), 1234);
  assert.equal(parseNumber('36,5 °C'), 36.5);
  assert.equal(normalizeValue('spo2', '0,97', '%'), 97);
  assert.ok(Number.isNaN(normalizeValue('hr', '400')));
  assert.equal(sleepCode('HKCategoryValueSleepAnalysisAsleepDeep'), SLEEP.DEEP);
  assert.equal(sleepCode('Kern'), SLEEP.CORE);
  assert.equal(sleepCode('REM-Schlaf'), SLEEP.REM);
  assert.equal(sleepCode('Im Bett'), SLEEP.INBED);
  assert.equal(sleepCode('Wach'), SLEEP.AWAKE);
  assert.equal(sleepCode('Schlafend'), SLEEP.ASLEEP);
  assert.equal(workoutKind('HKWorkoutActivityTypeTraditionalStrengthTraining'), 'kraft');
  assert.equal(workoutKind('HKWorkoutActivityTypeRunning'), 'ausdauer');
});
