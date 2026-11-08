// Regression auf echten Nächten. Die Daten stammen aus einem Backup von Lukas,
// anonymisiert: Datum um 364 Tage zurück (Wochentage bleiben), kein Tagebuchtext,
// Puls auf 10-Minuten-Raster ausgedünnt. Zehn Nächte mit dem Helio Strap.
//
// Der letzte Tag ist der Fall, der die Version 0.10 ausgelöst hat: 7 Getränke am
// Abend davor, um 5:27 ins Bett, 6 h Schlaf, Ruhepuls 3 Standardabweichungen über
// dem eigenen Schnitt – und trotzdem eine ordentliche Tagesform.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RawIndex } from '../js/data/rawindex.js';
import { computeAll } from '../js/model/pipeline.js';
import { mergeSettings } from '../js/core/config.js';
import { dataReport } from '../js/model/coverage.js';
import { earlyWarnings } from '../js/model/earlywarning.js';
import { sessionSuggestions } from '../js/model/detect.js';
import { hrMaxOf } from '../js/core/config.js';

const fix = JSON.parse(readFileSync(new URL('./fixtures/echte-naechte.json', import.meta.url), 'utf8'));
const TODAY = '2025-11-09';
const VORTAG = '2025-11-08';
const settings = mergeSettings(fix.settings);
const index = new RawIndex(fix.raw);
const run = (s = settings) => computeAll({
  index,
  workouts: fix.workouts,
  survey: new Map(fix.survey),
  journal: new Map(fix.journal),
  context: new Map(),
  settings: s,
  today: TODAY,
});
const res = run();
const tag = (k) => res.days.get(k);

test('Echte Daten: die Nacht nach sieben Getränken schlägt durch', () => {
  const d = tag(TODAY);
  assert.ok(Math.abs(d.sleep.asleepMin / 60 - 6) < 0.3, `Schlaf ${d.sleep.asleepMin / 60} h`);
  assert.ok(d.z.rhr >= 2.5, `Ruhepuls-z ${d.z.rhr}`);
  assert.ok(d.z.hrv <= -1, `HRV-z ${d.z.hrv}`);
  assert.ok(d.recovery < 15, `Recovery ${d.recovery}`);
  assert.ok(d.form <= 25, `Tagesform ${d.form}`);
  // Der Deckel greift und steht als Grund bereit
  assert.ok(d.formCap != null && d.formCap < d.formRaw, `Deckel ${d.formCap} von ${d.formRaw}`);
  assert.ok(d.formRaw - d.form >= 20, 'ohne Deckel und Logbuch läge die Tagesform deutlich höher');
});

test('Echte Daten: der Alkohol landet auf der richtigen Nacht', () => {
  const heute = tag(TODAY).lifestyle.reasons.map((r) => r.id);
  const gestern = tag(VORTAG).lifestyle.reasons.map((r) => r.id);
  // Am Abend des Vortags wurden 7 Getränke eingetragen – sie kosten die Nacht danach
  assert.ok(heute.includes('alkohol'), `heute ${heute}`);
  assert.match(tag(TODAY).lifestyle.reasons.find((r) => r.id === 'alkohol').text, /7 Getränke/);
  assert.ok(!gestern.includes('alkohol'), `der Vortag selbst darf nichts abbekommen: ${gestern}`);
  // Der verschobene Rhythmus wird eigens genannt
  assert.ok(heute.includes('rhythmus'));
  assert.ok(tag(TODAY).sleepShiftH > 4, `Versatz ${tag(TODAY).sleepShiftH}`);
});

test('Echte Daten: mit den alten Gewichten sah der Tag zu gut aus', () => {
  const alt = mergeSettings(fix.settings);
  Object.assign(alt.model.form, { wR: 0.45, wS: 0.25, wB: 0.15, wF: 0.15, lag0: 0.5, lag1: 0.3, lag2: 0.2, capFrom: 0, capAdd: 999 });
  Object.assign(alt.model.form.lifestyle, { shiftSmallPts: 0, shiftBigPts: 0 });
  const frueherAlle = run(alt);
  const frueher = frueherAlle.days.get(TODAY).form;
  assert.ok(frueher > 38, `alte Rechnung ${frueher}`);
  assert.ok(frueher - tag(TODAY).form > 20, 'der Unterschied ist der Kern von Version 0.10');
  // Genau die Beschwerde: die Katernacht lag auf dem Niveau eines anderen schwachen Tages,
  // obwohl Recovery 7 gegen 20 stand. Heute trennen die beiden über 10 Punkte.
  const anderer = frueherAlle.days.get('2025-11-07').form;
  assert.ok(Math.abs(frueher - anderer) < 5, `alt: ${frueher} gegen ${anderer}`);
  assert.ok(tag('2025-11-07').form - tag(TODAY).form > 10, 'jetzt liegen sie auseinander');
});

test('Echte Daten: Schlaf-Score und Recovery dürfen auseinanderlaufen', () => {
  const d = tag(TODAY);
  // Kurz, spät und unruhig: die nächtliche Ruhe ist am Boden, die Dauer mittelmäßig
  assert.equal(Math.round(d.sleepParts.calm), 0);
  assert.ok(d.sleepParts.regularity < 40, `Regelmäßigkeit ${d.sleepParts.regularity}`);
  assert.ok(d.sleepScore > d.recovery + 30, 'der Schlaf-Score bleibt trotzdem höher als die Recovery');
});

test('Echte Daten: Erkennung findet die eine offene Einheit', () => {
  const d = tag(TODAY);
  const known = (d.workouts || []).map((w) => ({ from: w.t, to: w.t + (w.durMin || 0) * 60000 }));
  const list = sessionSuggestions({
    index, date: TODAY, rhr: d.base?.rhr?.median ?? d.rhr, hrMax: hrMaxOf(settings),
    known, sleep: d.sleep, model: null, settings,
  });
  assert.equal(list.length, 1, `gefunden: ${list.map((x) => x.durMin + ' min').join(', ')}`);
  const x = list[0];
  assert.ok(x.durMin >= 60 && x.durMin <= 100, `Dauer ${x.durMin}`);
  assert.ok(x.pause > 0, 'die Pause mittendrin wurde überbrückt');
  assert.ok(x.avgHr > 110 && x.avgHr < 145);
  assert.ok(x.steps > 500);
  // An den Tagen davor deckt der Import alles ab, da fragt die App nichts
  for (const k of ['2025-11-06', '2025-11-07', '2025-11-08']) {
    const y = tag(k);
    const kn = (y.workouts || []).map((w) => ({ from: w.t, to: w.t + (w.durMin || 0) * 60000 }));
    const l = sessionSuggestions({ index, date: k, rhr: y.base?.rhr?.median ?? y.rhr, hrMax: hrMaxOf(settings), known: kn, sleep: y.sleep, model: null, settings });
    assert.equal(l.length, 0, `${k}: ${l.length} unnötige Nachfragen`);
  }
});

test('Echte Daten: keine Fehlalarme bei zehn Nächten Verlauf', () => {
  // Der Ruhepuls liegt 3 Standardabweichungen daneben, aber die Baseline ist zu jung
  assert.deepEqual(earlyWarnings({ days: res.days, today: TODAY, settings }), []);
  const rep = dataReport({ index, results: res, settings, today: TODAY });
  // Alles Wichtige kommt an; nur VO₂max fehlt, weil keine Laufeinheit im Freien dabei war
  assert.deepEqual(rep.matters.map((x) => x.type), ['vo2']);
  assert.deepEqual(rep.blocked.map((b) => b.id), ['vo2']);
});
