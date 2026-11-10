// Trainings bearbeiten: Änderungen liegen im Logbuch, die Messdaten bleiben unberührt.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyDay, addEntry, isEmptyDay } from '../js/journal/journal.js';
import {
  wkKey, patchOf, patchesOf, setPatch, clearPatch, hasPatches,
  applyPatches, ownSessions, sessionsOfDay, mergeSessions,
} from '../js/journal/sessions.js';

const DATE = '2026-11-05';
const at = (hh, mm = 0) => new Date(`${DATE}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`).getTime();
const mess = (hh, mm, durMin, extra = {}) => ({ t: at(hh, mm), durMin, kind: 'kraft', src: 'Zepp', ...extra });

test('Der Schlüssel einer Einheit hängt an Quelle und Startzeit', () => {
  assert.equal(wkKey({ src: 'Zepp', t: 1000 }), 'Zepp|1000');
  assert.equal(wkKey({ t: 1000 }), 'eigen|1000');
});

test('Ohne Änderung kommen die Messwerte unverändert zurück', () => {
  const rec = emptyDay();
  const out = applyPatches([mess(18, 0, 60)], rec);
  assert.equal(out.length, 1);
  assert.equal(out[0].durMin, 60);
  assert.ok(!out[0].edited);
  assert.equal(hasPatches(rec), false);
});

test('Sportart und Dauer lassen sich ändern, ohne die Messung anzufassen', () => {
  const w = mess(18, 0, 60);
  const rec = setPatch(emptyDay(), wkKey(w), { sport: 'fussball', kind: 'ausdauer', durMin: 90, place: 'Sportplatz' });
  const out = applyPatches([w], rec);
  assert.equal(out[0].sport, 'fussball');
  assert.equal(out[0].durMin, 90);
  assert.equal(out[0].place, 'Sportplatz');
  assert.equal(out[0].edited, true);
  // die Messung selbst steht weiter unverändert da
  assert.equal(w.durMin, 60);
  assert.equal(patchOf(rec, wkKey(w)).sport, 'fussball');
  assert.equal(Object.keys(patchesOf(rec)).length, 1);
});

test('Zurücknehmen stellt die Messung wieder her', () => {
  const w = mess(18, 0, 60);
  let rec = setPatch(emptyDay(), wkKey(w), { sport: 'fussball' });
  rec = clearPatch(rec, wkKey(w));
  assert.equal(patchOf(rec, wkKey(w)), null);
  assert.equal(applyPatches([w], rec)[0].sport, undefined);
});

test('Ausgeblendete Einheiten fallen weg', () => {
  const w = mess(18, 0, 60);
  const rec = setPatch(emptyDay(), wkKey(w), { deleted: true });
  assert.equal(applyPatches([w], rec).length, 0);
});

test('Zwei Einheiten zusammenlegen: eine Spanne, Strecken addiert', () => {
  const a = mess(18, 0, 40, { km: 4 });
  const b = mess(19, 0, 20, { km: 2 });
  const list = [a, b].map((w) => ({ ...w, key: wkKey(w) }));
  const rec = mergeSessions(emptyDay(), list);
  const out = applyPatches([a, b], rec);
  assert.equal(out.length, 1, 'die zweite geht in der ersten auf');
  assert.equal(out[0].durMin, 80, 'von 18:00 bis 19:20');
  assert.equal(out[0].km, 6);
  assert.equal(out[0].merged, 1);
});

test('Als Stress markiert bleibt die Einheit sichtbar, aber gekennzeichnet', () => {
  const w = mess(14, 0, 25);
  const rec = setPatch(emptyDay(), wkKey(w), { stress: true });
  const out = applyPatches([w], rec);
  assert.equal(out.length, 1);
  assert.equal(out[0].stress, true);
});

test('Ein Tag mit Trainingsänderung gilt nicht als leer', () => {
  const rec = setPatch(emptyDay(), 'Zepp|123', { stress: true });
  assert.equal(isEmptyDay(rec), false);
  assert.equal(isEmptyDay(emptyDay()), true);
});

test('Eigene Logbuch-Einträge erscheinen im selben Format', () => {
  const { rec } = addEntry(emptyDay(), { type: 'sport', kind: 'kraft', sport: 'kraft', min: 45, at: '07:30', place: 'Studio' });
  const eigen = ownSessions(rec, DATE);
  assert.equal(eigen.length, 1);
  assert.equal(eigen[0].durMin, 45);
  assert.equal(eigen[0].eigen, true);
  assert.equal(eigen[0].t, at(7, 30));
  assert.equal(eigen[0].place, 'Studio');
});

test('Ein eigener Eintrag zur gleichen Zeit doppelt die Messung nicht', () => {
  const w = mess(18, 0, 60);
  const { rec } = addEntry(emptyDay(), { type: 'sport', kind: 'kraft', min: 60, at: '18:10' });
  const alle = sessionsOfDay([w], rec, DATE);
  assert.equal(alle.length, 1, 'die Messung gewinnt');
  assert.equal(alle[0].src, 'Zepp');
});

test('Ein eigener Eintrag zu anderer Zeit kommt dazu', () => {
  const w = mess(18, 0, 60);
  const { rec } = addEntry(emptyDay(), { type: 'sport', kind: 'kraft', min: 30, at: '07:00' });
  const alle = sessionsOfDay([w], rec, DATE);
  assert.equal(alle.length, 2);
  assert.equal(alle[0].t, at(7, 0), 'nach Zeit sortiert');
});

test('Als Stress markiert zählt die Einheit nicht in die Last', async () => {
  const { generateDemo } = await import('../js/demo/generate.js');
  const { RawIndex, groupSamples, mergeBucket } = await import('../js/data/rawindex.js');
  const { mergeSettings } = await import('../js/core/config.js');
  const { computeAll } = await import('../js/model/pipeline.js');
  const END = '2026-10-26';
  const demo = generateDemo({ days: 60, endDate: END, nowMs: new Date(2026, 9, 26, 14, 30).getTime() });
  const buckets = [];
  for (const [key, list] of groupSamples(demo.samples)) {
    const [type, date, src] = key.split('|');
    const m = mergeBucket(null, list);
    buckets.push({ type, date, src, t: m.t, e: m.e, v: m.v });
  }
  const settings = mergeSettings();
  const index = new RawIndex(buckets, settings.import.sourcePriority);
  const base = { index, workouts: demo.workouts, survey: demo.survey, context: demo.context, settings, today: END };
  const ohne = computeAll({ ...base, journal: new Map() });
  // einen Tag mit Training suchen
  let tag = null;
  for (const d of ohne.days.values()) {
    const w = (d.workouts || []).find((x) => x.trimp > 0);
    if (w) {
      tag = { date: d.date, key: w.key };
      break;
    }
  }
  assert.ok(tag, 'Demo hat ein Training mit Last');
  const rec = setPatch(emptyDay(), tag.key, { stress: true });
  const mit = computeAll({ ...base, journal: new Map([[tag.date, rec]]) });
  assert.ok(mit.days.get(tag.date).load < ohne.days.get(tag.date).load, 'die Last sinkt');
});
