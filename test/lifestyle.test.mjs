import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sleepNeedParts, calmScore, sleepScore } from '../js/model/scores.js';
import { lifestyleAdjust, nightDisturbances, explainNight } from '../js/model/lifestyle.js';
import { mergeSettings } from '../js/core/config.js';

const S = mergeSettings();
const M = S.model;
const near = (a, b, t = 1e-9) => assert.ok(Math.abs(a - b) < t, `${a} != ${b}`);

test('Schlafbedarf steigt nach zwei kurzen Nächten mit Party', () => {
  const ruhig = sleepNeedParts({ base: 8, strainPrev: 20, strainPrev2: 20, recoveries: [70, 72], debtsH: [0, 0, 0] }, M.sleep);
  near(ruhig.need, 8);
  // Zwei Nächte mit je 2 h Fehlbetrag, harter Vortag, schwache Erholung
  const party = sleepNeedParts({ base: 8, strainPrev: 75, strainPrev2: 70, recoveries: [32, 38], debtsH: [2, 2, 0] }, M.sleep);
  assert.ok(party.need > ruhig.need + 1.3, `Bedarf nur ${party.need}`);
  assert.ok(party.parts.debt > 0.9 && party.parts.strain > 0.3 && party.parts.recovery > 0.1);
  // Jeder Anteil einzeln nachvollziehbar und zusammen so groß wie der Mehrbedarf
  near(party.parts.base + party.parts.debt + party.parts.strain + party.parts.recovery + party.parts.nap, party.need, 1e-9);
});

test('Schlafbedarf: jeder Teil wirkt für sich', () => {
  const basis = { base: 8, strainPrev: null, strainPrev2: null, recoveries: [], debtsH: [] };
  near(sleepNeedParts(basis, M.sleep).need, 8);
  // Nur schwache Erholung: 55 − 30 Punkte × 0,012 h
  near(sleepNeedParts({ ...basis, recoveries: [30, 30] }, M.sleep).need, 8 + 25 * 0.012);
  // Der vorletzte Tag zählt zur Hälfte
  near(sleepNeedParts({ ...basis, strainPrev2: 80 }, M.sleep).need, 8 + 0.5 * 40 * 0.01);
  // Nur die ersten beiden Nächte zählen für die Erholung
  near(sleepNeedParts({ ...basis, recoveries: [55, 55, 10] }, M.sleep).need, 8);
  // Mittagsschlaf senkt den Bedarf, die Deckelung bleibt
  const viel = sleepNeedParts({ base: 8, strainPrev: 100, strainPrev2: 100, recoveries: [0, 0], debtsH: [9, 9, 9], napMinPrev: 60 }, M.sleep);
  near(viel.need, 8 + M.sleep.extraCap - 1);
});

test('Nächtliche Ruhe senkt den Schlaf-Score einer unruhigen Nacht', () => {
  // HRV weit unter, Puls weit über der Baseline
  near(calmScore({ hrv: -1.5, rhr: 1.5 }, M.sleep), 0);
  near(calmScore({ hrv: 1.0, rhr: -1.0 }, M.sleep), 100);
  assert.equal(calmScore({}, M.sleep), null, 'ohne Baseline kein Anteil');
  const gleich = { asleepMin: 480, needH: 8, efficiency: 0.95, restorativePct: 0.45, regularity: 100 };
  const ruhig = sleepScore({ ...gleich, calm: 100 }, M.sleep).score;
  const unruhig = sleepScore({ ...gleich, calm: 0 }, M.sleep).score;
  assert.ok(ruhig - unruhig > 10, `Unterschied nur ${ruhig - unruhig}`);
  // Ohne Baseline bleibt der Score wie früher: die anderen Anteile werden neu gewichtet
  near(sleepScore(gleich, M.sleep).score, ruhig);
});

test('Logbuch verschiebt die Tagesform, immer mit Begründung', () => {
  const leer = lifestyleAdjust({ day: {}, prev: {}, settings: S });
  assert.deepEqual(leer, { delta: 0, reasons: [] });
  // Alkohol zählt für die Nacht danach: der Abendcheck von gestern, nicht der von heute
  const alk = lifestyleAdjust({ day: {}, prev: { answers: { A3: true, X1: 4 } }, settings: S });
  assert.equal(alk.delta, -S.model.form.lifestyle.alcoholCap, 'je Getränk mehr, aber gedeckelt');
  assert.equal(lifestyleAdjust({ day: {}, prev: { answers: { A3: true, X1: 1 } }, settings: S }).delta, -S.model.form.lifestyle.alcohol);
  // Was heute Abend getrunken wird, kostet erst morgen etwas
  assert.deepEqual(lifestyleAdjust({ day: { answers: { A3: true, X1: 7 } }, prev: {}, settings: S }).reasons, []);
  // Ein „nein“ von heute darf das „ja“ von gestern nicht verdecken
  const gestern = lifestyleAdjust({ day: { answers: { A3: false } }, prev: { answers: { A3: true, X1: 7 } }, settings: S });
  assert.equal(gestern.reasons[0]?.id, 'alkohol');
  assert.match(alk.reasons[0].text, /4 Getränke/);
  // Wenig getrunken und spätes Koffein am Vortag
  const prev = { journal: { waterMl: 900, caffeineMg: 450, caffeineLast: new Date('2026-11-05T21:30:00').getTime() } };
  const mix = lifestyleAdjust({ day: {}, prev, settings: S });
  assert.deepEqual(mix.reasons.map((r) => r.id).sort(), ['koffein', 'koffein-spaet', 'wasser']);
  assert.equal(mix.delta, -5);
  // Deckelung greift
  const viel = lifestyleAdjust({ day: {}, prev: { ...prev, answers: { A3: true, X1: 10 } }, settings: S });
  assert.equal(viel.delta, -S.model.form.lifestyle.cap);
  // Trinkziel erreicht gibt einen kleinen Bonus
  const gut = lifestyleAdjust({ day: {}, prev: { answers: { A3: false }, journal: { waterMl: 2000 } }, settings: S });
  assert.equal(gut.delta, S.model.form.lifestyle.bonus);
  // Abschaltbar
  const aus = mergeSettings({ model: { form: { lifestyle: { on: false } } } });
  assert.equal(lifestyleAdjust({ day: {}, prev: { ...prev, answers: { A3: true } }, settings: aus }).delta, 0);
});

test('Störfaktoren erklären auffällige Nachtwerte', () => {
  const nacht = { z: { rhr: 2.1, hrv: -1.8 } };
  const e = explainNight(nacht, { strain: 30, answers: { A3: true } }, S);
  assert.deepEqual(e.odd.map((o) => o.label), ['Ruhepuls', 'HRV']);
  assert.equal(e.causes.length, 1);
  assert.match(e.causes[0].text, /5 bis 10 bpm/);
  assert.equal(e.strong, true);
  // Ohne Auffälligkeit keine Erklärung, auch wenn Alkohol im Spiel war
  assert.deepEqual(explainNight({ z: { rhr: 0.2, hrv: 0.1 } }, { answers: { A3: true } }, S).causes, []);
  // Hartes Training und spätes Koffein werden erkannt
  const d2 = nightDisturbances({ z: {} }, { strain: 85, journal: { caffeineLast: new Date('2026-11-05T22:00:00').getTime() } }, S);
  assert.deepEqual(d2.map((x) => x.id), ['training', 'koffein']);
  assert.match(d2[0].text, /Strain 85/);
  // Eine sehr kurze Nacht erklärt sich selbst
  assert.ok(nightDisturbances({ sleep: { asleepMin: 250 } }, {}, S).some((x) => x.id === 'kurz'));
});

test('Die Pipeline rechnet Logbuch und Erholung mit', async () => {
  const { computeAll } = await import('../js/model/pipeline.js');
  const { RawIndex, groupSamples, mergeBucket } = await import('../js/data/rawindex.js');
  const { addDays } = await import('../js/core/time.js');
  const today = '2026-11-06';
  const samples = [];
  for (let i = 40; i >= 0; i--) {
    const d = addDays(today, -i);
    const wake = new Date(`${d}T07:00:00`).getTime();
    const onset = wake - 8 * 3600000;
    samples.push({ type: 'sleep', t: onset, e: wake, v: 1, src: 'Zepp' });
    samples.push({ type: 'hrv', t: onset + 2 * 3600000, e: onset + 2 * 3600000, v: 70, src: 'Zepp' });
    for (let k = 0; k < 48; k++) {
      const t = onset + k * 600000;
      samples.push({ type: 'hr', t, e: t, v: 50 + (k % 4), src: 'Zepp' });
    }
  }
  const buckets = [];
  for (const [key, list] of groupSamples(samples)) {
    const [type, date, src] = key.split('|');
    const m = mergeBucket(null, list);
    buckets.push({ type, date, src, t: m.t, e: m.e, v: m.v });
  }
  const index = new RawIndex(buckets);
  const run = (survey) => computeAll({ index, workouts: [], survey, journal: new Map(), context: new Map(), settings: S, today });
  const ohne = run(new Map());
  const mit = run(new Map([[addDays(today, -1), { a: { A3: true, X1: 3 }, ts: {}, backfilled: {} }]]));
  const a = ohne.days.get(today);
  const b = mit.days.get(today);
  assert.ok(a.form > 0, 'Tagesform vorhanden');
  assert.ok(b.form < a.form, `mit Alkohol ${b.form} statt ${a.form}`);
  assert.deepEqual(b.lifestyle.reasons.map((r) => r.id), ['alkohol']);
  assert.ok(isFinite(a.sleepNeedParts.base));
  assert.ok(a.sleepParts.calm != null, 'nächtliche Ruhe wird berechnet');
});
