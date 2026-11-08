import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findSessions, predict, learn, unlearn, emptyModel, suggestedDuration, sessionKey } from '../js/model/detect.js';
import { SPORT, coarseKind, isTrainingSport, sportLabel } from '../js/model/sports.js';
import { mergeSettings } from '../js/core/config.js';
import { RawIndex, groupSamples, mergeBucket } from '../js/data/rawindex.js';

const S = mergeSettings();
const P = S.model.detect;
const DAY = '2026-11-08';
const at = (h, m = 0) => new Date(`${DAY}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`).getTime();

/** Index aus einzelnen Messwerten bauen, wie nach einem Import. */
function indexOf(samples) {
  const buckets = [];
  for (const [key, list] of groupSamples(samples)) {
    const [type, date, src] = key.split('|');
    const m = mergeBucket(null, list);
    buckets.push({ type, date, src, t: m.t, e: m.e, v: m.v });
  }
  return new RawIndex(buckets);
}
/** Einen Tag mit Ruhepuls und einem Abschnitt erhöhten Pulses erzeugen. */
function tag({ from = 18, to = 19, hr = 150, ruhe = 60, stepsPerHour = 300 } = {}) {
  const s = [];
  for (let m = 0; m < 24 * 60; m += 5) {
    const t = at(0) + m * 60000;
    const h = m / 60;
    const drin = h >= from && h < to;
    s.push({ type: 'hr', t, e: t, v: drin ? hr + (m % 3) : ruhe + (m % 4), src: 'Zepp' });
  }
  for (let h = 0; h < 24; h++) {
    const t = at(h);
    s.push({ type: 'steps', t, e: t + 3600000, v: h >= from && h < to ? stepsPerHour * 20 : stepsPerHour, src: 'Zepp' });
  }
  return indexOf(s);
}

test('Erkennt einen längeren Abschnitt mit erhöhtem Puls', () => {
  const index = tag({ from: 18, to: 19.25, hr: 150 });
  const list = findSessions({ index, date: DAY, rhr: 60, hrMax: 190, p: P });
  assert.equal(list.length, 1);
  const x = list[0];
  assert.ok(x.durMin >= 70 && x.durMin <= 80, `Dauer ${x.durMin}`);
  assert.ok(x.avgHr >= 148 && x.avgHr <= 155);
  assert.equal(new Date(x.from).getHours(), 18);
  assert.ok(x.steps > 1000, `Schritte ${x.steps}`);
  assert.ok(x.spm > 10);
});

test('Kurze Ausschläge und bekannte Trainings fragt die App nicht ab', () => {
  // Fünf Minuten Treppensteigen sind kein Training
  const kurz = findSessions({ index: tag({ from: 18, to: 18.1 }), date: DAY, rhr: 60, hrMax: 190, p: P });
  assert.deepEqual(kurz, []);
  // Was schon als Training bekannt ist, taucht nicht als Frage auf
  const index = tag({ from: 18, to: 19.25 });
  const known = [{ from: at(18), to: at(19, 15) }];
  assert.deepEqual(findSessions({ index, date: DAY, rhr: 60, hrMax: 190, known, p: P }), []);
  // Ein Abschnitt im Schlaf zählt nicht
  const nachts = tag({ from: 2, to: 3.5 });
  const sleep = { onset: at(0), wake: at(7) };
  assert.deepEqual(findSessions({ index: nachts, date: DAY, rhr: 60, hrMax: 190, sleep, p: P }), []);
  // Wer einen hohen Ruhepuls hat, bekommt eine höhere Schwelle
  assert.deepEqual(findSessions({ index: tag({ from: 18, to: 19.25, hr: 100 }), date: DAY, rhr: 85, hrMax: 190, p: P }), []);
});

test('Der Schlüssel eines Abschnitts bleibt bei kleinen Verschiebungen gleich', () => {
  assert.equal(sessionKey(DAY, at(18)), sessionKey(DAY, at(18, 2)));
  assert.notEqual(sessionKey(DAY, at(18)), sessionKey(DAY, at(18, 20)));
});

test('Schätzung ohne Erfahrung trifft die typischen Muster', () => {
  const m = emptyModel();
  const top = (f) => predict(m, f)[0].id;
  assert.equal(top({ hr: 152, dur: 45, spm: 155, hour: 18 }), 'laufen');
  assert.equal(top({ hr: 118, dur: 65, spm: 18, hour: 18 }), 'kraft');
  assert.equal(top({ hr: 120, dur: 20, spm: 3, hour: 22.5 }), 'intim');
  assert.equal(top({ hr: 96, dur: 50, spm: 6, hour: 8 }), 'yoga');
  // Privates lässt sich aus den Vorschlägen heraushalten
  const ohne = predict(m, { hr: 120, dur: 20, spm: 3, hour: 22.5 }, { includePrivate: false });
  assert.ok(!ohne.some((x) => x.id === 'intim'));
});

test('Die Schätzung lernt aus eingetragenen Einheiten', () => {
  const f = { hr: 138, dur: 95, spm: 88, hour: 20 };
  let m = emptyModel();
  assert.notEqual(predict(m, f)[0].id, 'fussball', 'kalt trifft es noch nicht');
  for (let i = 0; i < 6; i++) m = learn(m, 'fussball', f);
  assert.equal(predict(m, f)[0].id, 'fussball');
  assert.equal(m.byId.fussball.n, 6);
  // Gelernte Werte wandern zum Eingetragenen hin
  assert.ok(Math.abs(m.byId.fussball.hr - 138) < 1);
  // Verlernen stellt den Ausgangszustand wieder her
  const zurueck = unlearn(m, 'fussball');
  assert.equal(predict(zurueck, f)[0].id, predict(emptyModel(), f)[0].id);
});

test('Die vorgeschlagene Dauer mischt Messung und Gewohnheit', () => {
  let m = emptyModel();
  assert.equal(suggestedDuration(m, 'kraft', 52), 52, 'ohne Erfahrung gilt die Messung');
  for (let i = 0; i < 4; i++) m = learn(m, 'kraft', { hr: 120, dur: 90, spm: 15, hour: 18 });
  const v = suggestedDuration(m, 'kraft', 52);
  assert.ok(v > 52 && v < 90, `Vorschlag ${v}`);
});

test('Sportarten bleiben mit der groben Klasse verträglich', () => {
  assert.equal(coarseKind('fussball'), 'team');
  assert.equal(coarseKind('laufen'), 'ausdauer');
  assert.equal(coarseKind('intim'), 'andere');
  // Alte Einträge mit grober Klasse funktionieren weiter
  assert.equal(coarseKind('kraft'), 'kraft');
  assert.equal(sportLabel('team'), 'Teamsport');
  assert.equal(sportLabel('padel'), 'Padel');
  // Was nicht als Training zählt, treibt kein Wochenpensum hoch
  assert.equal(isTrainingSport('intim'), false);
  assert.equal(isTrainingSport('gehen'), false);
  assert.equal(isTrainingSport('fussball'), true);
  // Jede Art hat Startwerte für die Erkennung
  for (const s of Object.values(SPORT)) {
    for (const k of ['hr', 'dur', 'spm', 'hour']) assert.ok(Number.isFinite(s[k]), `${s.id}.${k}`);
  }
});
