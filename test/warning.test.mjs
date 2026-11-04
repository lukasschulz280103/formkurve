import { test } from 'node:test';
import assert from 'node:assert/strict';
import { earlyWarnings, snoozedWarnings, snoozeWarning } from '../js/model/earlywarning.js';
import { mergeSettings } from '../js/core/config.js';
import { addDays } from '../js/core/time.js';

const TODAY = '2026-11-02';
const S = mergeSettings();

/** Tage mit Standardwerten bauen; `patch` überschreibt einzelne Tage. */
function build(n, base = {}, patch = {}) {
  const days = new Map();
  for (let i = 0; i < n; i++) {
    const date = addDays(TODAY, -i);
    days.set(date, {
      date,
      baselineDays: 28,
      z: { rhr: 0, hrv: 0, resp: 0 },
      rhr: 58,
      sleep: { asleepMin: 450 },
      answers: {},
      journal: null,
      ...base,
      ...(patch[date] || {}),
    });
  }
  return days;
}
const find = (days, extra = {}) => earlyWarnings({ days, today: TODAY, settings: S, ...extra });
const ids = (days, extra) => find(days, extra).map((w) => w.id);

test('Infektwarnung: zwei auffällige Nächte nacheinander, mindestens zwei Werte', () => {
  const krank = { z: { rhr: 2.0, hrv: -1.8, resp: 0.2 } };
  const days = build(40, {}, { [TODAY]: krank, [addDays(TODAY, -1)]: krank });
  const w = find(days).find((x) => x.id === 'infekt');
  assert.ok(w, 'warnt nach zwei Nächten');
  assert.equal(w.level, 'warn');
  assert.match(w.text, /Ruhepuls erhöht/);
  assert.match(w.text, /HRV gesenkt/);
  assert.match(w.advice, /Hausarzt/);
  // Eine einzelne Nacht reicht nicht
  assert.deepEqual(ids(build(40, {}, { [TODAY]: krank })), []);
  // Ein einzelner auffälliger Wert reicht nicht
  const nurPuls = { z: { rhr: 2.0, hrv: 0, resp: 0 } };
  assert.deepEqual(ids(build(40, {}, { [TODAY]: nurPuls, [addDays(TODAY, -1)]: nurPuls })), []);
});

test('Infektwarnung: ohne Verlauf keine Warnung, mit Krankheitsgefühl deutlicher', () => {
  const krank = { z: { rhr: 2.0, hrv: -1.8, resp: 0.2 } };
  // Weniger als 14 Vergleichsnächte: die Baseline trägt noch nicht
  const jung = build(40, { baselineDays: 9 }, { [TODAY]: { ...krank, baselineDays: 9 }, [addDays(TODAY, -1)]: { ...krank, baselineDays: 9 } });
  assert.deepEqual(ids(jung), []);
  // Krankheitsgefühl aus dem Morgencheck wird genannt
  const mitSymptom = build(40, {}, {
    [TODAY]: { ...krank, answers: { M10: ['hals'] } },
    [addDays(TODAY, -1)]: krank,
  });
  assert.match(find(mitSymptom)[0].text, /Krankheitsgefühl/);
});

test('Infektwarnung: Alkohol oder hartes Training machen daraus eine Beobachtung', () => {
  const krank = { z: { rhr: 2.0, hrv: -1.8, resp: 0.2 } };
  const mitAlkohol = build(40, {}, {
    [TODAY]: krank,
    [addDays(TODAY, -1)]: krank,
    [addDays(TODAY, -2)]: { answers: { A3: true } },
  });
  const w = find(mitAlkohol)[0];
  assert.equal(w.level, 'info');
  assert.match(w.text, /Alkohol/);
  assert.match(w.title, /erklärbar/);
  // Harter Trainingstag wirkt genauso
  const mitTraining = build(40, {}, {
    [TODAY]: krank,
    [addDays(TODAY, -1)]: krank,
    [addDays(TODAY, -2)]: { strain: 85 },
  });
  assert.match(find(mitTraining)[0].text, /hartes Training/);
  // Mit Krankheitsgefühl bleibt es trotz Alkohol eine Warnung
  const trotzdem = build(40, {}, {
    [TODAY]: { ...krank, answers: { M10: ['fieber'] } },
    [addDays(TODAY, -1)]: krank,
    [addDays(TODAY, -2)]: { answers: { A3: true } },
  });
  assert.equal(find(trotzdem)[0].level, 'warn');
});

test('Ruhepuls: hoher Wochenmedian und langsamer Anstieg', () => {
  const hoch = build(40, { rhr: 104 });
  const w = find(hoch).find((x) => x.id === 'rhr');
  assert.match(w.title, /die ganze Woche hoch/);
  assert.match(w.text, /104 bpm/);
  // Anstieg um 8 bpm gegenüber den Monaten davor
  const steigt = build(110, { rhr: 55 });
  for (let i = 0; i < 14; i++) steigt.get(addDays(TODAY, -i)).rhr = 64;
  const w2 = find(steigt).find((x) => x.id === 'rhr');
  assert.match(w2.title, /über Wochen gestiegen/);
  assert.match(w2.text, /9 bpm/);
  // Ein kurzer Ausschlag von drei Tagen löst nichts aus
  const kurz = build(110, { rhr: 55 });
  for (let i = 0; i < 3; i++) kurz.get(addDays(TODAY, -i)).rhr = 70;
  assert.ok(!ids(kurz).includes('rhr'));
});

test('Blutsauerstoff: erst bei mehreren Nächten', () => {
  const tief = build(20, { spo2Med: 94 });
  for (let i = 0; i < 3; i++) tief.get(addDays(TODAY, -i)).spo2Med = 88;
  const w = find(tief).find((x) => x.id === 'spo2');
  assert.match(w.text, /3 von 7/);
  assert.match(w.advice, /Schlafapnoe/);
  // Zwei Nächte reichen nicht
  const zwei = build(20, { spo2Med: 94 });
  for (let i = 0; i < 2; i++) zwei.get(addDays(TODAY, -i)).spo2Med = 88;
  assert.ok(!ids(zwei).includes('spo2'));
});

test('Schlaf: drei Wochen zu kurz, nicht eine', () => {
  const kurz = build(40, { sleep: { asleepMin: 330 } });
  const w = find(kurz).find((x) => x.id === 'schlaf');
  assert.match(w.title, /seit 3 Wochen zu kurz/);
  // Nur die letzte Woche kurz: noch keine Warnung
  const eine = build(40, { sleep: { asleepMin: 450 } });
  for (let i = 0; i < 7; i++) eine.get(addDays(TODAY, -i)).sleep = { asleepMin: 330 };
  assert.ok(!ids(eine).includes('schlaf'));
});

test('Stimmung: zurückhaltend und mit Anlaufstellen', () => {
  const trueb = build(20, { journal: { happy: 3 } });
  const w = find(trueb).find((x) => x.id === 'stimmung');
  assert.equal(w.level, 'info');
  assert.match(w.advice, /Telefonseelsorge/);
  assert.match(w.text, /kein Befund/);
  // Gute Tage dazwischen: unter 10 von 14 bleibt es still
  const gemischt = build(20, { journal: { happy: 3 } });
  for (let i = 0; i < 6; i++) gemischt.get(addDays(TODAY, -i)).journal = { happy: 8 };
  assert.ok(!ids(gemischt).includes('stimmung'));
});

test('Ruhige Daten lösen gar nichts aus', () => {
  assert.deepEqual(ids(build(120, { spo2Med: 97, journal: { happy: 7 } })), []);
});

test('Pause: quittierte Warnungen bleiben einige Tage weg', () => {
  const meta = { warnSnooze: snoozeWarning({}, 'rhr', TODAY, 7) };
  assert.deepEqual(meta.warnSnooze, { rhr: '2026-11-09' });
  assert.deepEqual(snoozedWarnings(meta, TODAY), ['rhr']);
  // Am Tag des Ablaufs ist sie wieder da
  assert.deepEqual(snoozedWarnings(meta, '2026-11-09'), []);
  const hoch = build(40, { rhr: 104 });
  assert.ok(!ids(hoch, { snoozed: ['rhr'] }).includes('rhr'));
  assert.ok(ids(hoch).includes('rhr'));
});

test('Warnungen stehen vor Beobachtungen', () => {
  const krank = { z: { rhr: 2.0, hrv: -1.8, resp: 0.2 } };
  const beides = build(40, { journal: { happy: 2 } }, {
    [TODAY]: krank,
    [addDays(TODAY, -1)]: krank,
  });
  const list = find(beides);
  assert.deepEqual(list.map((w) => w.level), ['warn', 'info']);
  assert.equal(list[0].id, 'infekt');
});
