import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyDay, addEntry, updateEntry, removeEntry, setField, entriesOf, daySummary, mergeJournal, journalAnswers,
  withJournal, sportSessions, weekActivity, journalToday, atOf, clockOf, atFromInput, isEmptyDay, waterBucket,
} from '../js/journal/journal.js';
import { openStore } from '../js/data/db.js';
import { Repo } from '../js/data/repo.js';
import { checkPlan, hiddenByCondition } from '../js/survey/engine.js';
import { QUESTION_BY_ID, RETIRED } from '../js/survey/catalog.js';
import { mergeSettings } from '../js/core/config.js';

const T = Date.UTC(2026, 9, 28, 9, 0, 0);

function day(...steps) {
  let rec = emptyDay();
  let t = T;
  for (const s of steps) {
    t += 1000;
    rec = s(rec, t);
  }
  return rec;
}
const water = (ml, at) => (rec, t) => addEntry(rec, { type: 'water', ml, at }, t).rec;
const caf = (kind, mg, at) => (rec, t) => addEntry(rec, { type: 'caffeine', kind, mg, at }, t).rec;
const sport = (kind, min, at, rpe) => (rec, t) => addEntry(rec, { type: 'sport', kind, min, at, rpe }, t).rec;
const field = (name, v) => (rec, t) => setField(rec, name, v, t);

test('Logbuch: Einträge, Felder und Tageswerte', () => {
  const rec = day(water(250, '08:10'), water(500, '12:30'), caf('kaffee', 90, '07:45'), caf('espresso', 80, '15:20'), field('happy', 7), field('work', 8.5), field('text', '  Guter Tag. '));
  const s = daySummary(rec);
  assert.equal(s.waterMl, 750);
  assert.equal(s.waterN, 2);
  assert.equal(s.caffeineN, 2);
  assert.equal(s.caffeineMg, 170);
  assert.equal(s.caffeineLast, '15:20');
  assert.equal(s.happy, 7);
  assert.equal(s.work, 8.5);
  assert.equal(s.text, '  Guter Tag. ');
  assert.equal(isEmptyDay(rec), false);
  assert.equal(isEmptyDay(emptyDay()), true);
  assert.equal(daySummary(emptyDay()).waterMl, null, 'nicht eingetragen ist nicht null Liter');
  // Bearbeiten und Löschen
  const id = entriesOf(rec, 'water')[0].id;
  const edited = updateEntry(rec, id, { ml: 330, at: '09:00' }, T + 9000);
  assert.equal(daySummary(edited).waterMl, 830);
  const removed = removeEntry(edited, id, T + 10000);
  assert.equal(daySummary(removed).waterMl, 500);
  assert.ok(removed.x[id], 'Löschmarke bleibt');
  assert.equal(entriesOf(rec, 'water').length, 2, 'Original unverändert');
});

test('Logbuch: Tag beginnt um 4 Uhr, Uhrzeiten nach Mitternacht zählen als 24:xx', () => {
  const late = new Date(2026, 9, 29, 0, 40).getTime();
  assert.equal(journalToday(late), '2026-10-28');
  assert.equal(atOf(late), '24:40');
  assert.equal(clockOf('24:40'), '00:40');
  assert.equal(atFromInput('01:15'), '25:15');
  assert.equal(atFromInput('13:05'), '13:05');
  assert.equal(journalToday(new Date(2026, 9, 29, 5, 0).getTime()), '2026-10-29');
  const rec = day(caf('kaffee', 90, '21:00'), caf('cola', 35, '24:30'));
  assert.equal(daySummary(rec).caffeineLast, '24:30', 'nach Mitternacht ist später als 21 Uhr');
});

test('Zwei Geräte: Einträge werden vereinigt, Gelöschtes bleibt gelöscht, letzter Feldwert gilt', () => {
  const base = day(water(250, '08:00'), field('happy', 5));
  const id = entriesOf(base, 'water')[0].id;
  // Telefon: Glas dazu und Glück 7; Laptop: Kaffee, erstes Glas gelöscht, Glück 6 (früher)
  let phone = addEntry(base, { type: 'water', ml: 500, at: '10:00' }, T + 20000).rec;
  phone = setField(phone, 'happy', 7, T + 30000);
  let laptop = addEntry(base, { type: 'caffeine', kind: 'kaffee', mg: 90, at: '09:00' }, T + 21000).rec;
  laptop = removeEntry(laptop, id, T + 22000);
  laptop = setField(laptop, 'happy', 6, T + 25000);
  const m1 = mergeJournal(phone, laptop);
  const m2 = mergeJournal(laptop, phone);
  assert.deepEqual(m1, m2, 'Reihenfolge egal');
  assert.deepEqual(mergeJournal(m1, m1), m1, 'mehrfach zusammenführen ändert nichts');
  assert.deepEqual(mergeJournal(m1, phone), m1);
  const s = daySummary(m1);
  assert.equal(s.waterMl, 500, 'gelöschtes Glas bleibt weg, neues Glas bleibt');
  assert.equal(s.caffeineN, 1);
  assert.equal(s.happy, 7, 'späterer Wert gewinnt');
  // Gleichzeitige Änderung desselben Eintrags: die spätere gewinnt
  const e1 = updateEntry(base, id, { ml: 300 }, T + 40000);
  const e2 = updateEntry(base, id, { ml: 400 }, T + 41000);
  assert.equal(daySummary(mergeJournal(e1, e2)).waterMl, 400);
  assert.deepEqual(mergeJournal(undefined, base), base);
  assert.deepEqual(mergeJournal(base, undefined), mergeJournal(base, base));
});

test('Abendcheck: was im Logbuch steht, wird nicht mehr gefragt und ersetzt die Antwort', () => {
  assert.equal(waterBucket(1499), 'lt15');
  assert.equal(waterBucket(1500), '15-25');
  assert.equal(waterBucket(2501), 'gt25');
  const rec = day(water(500, '08:00'), water(500, '11:00'), water(750, '15:00'), caf('kaffee', 90, '07:30'), caf('schwarztee', 45, '16:10'), caf('cola', 35, '13:00'));
  const { answers, covered } = journalAnswers(rec, []);
  assert.equal(answers.A6, '15-25');
  assert.equal(answers.A4, 3);
  assert.equal(answers.A4t, '16:10');
  assert.deepEqual(answers.E9.sort(), ['kaffee', 'tee']);
  assert.ok(['A6', 'A4', 'A4t', 'E9'].every((id) => covered.has(id)));
  assert.ok(!covered.has('A7'), 'Training nur, wenn eingetragen');
  // Bewusst kein Koffein
  const none = journalAnswers(day(field('noCaffeine', true)), []);
  assert.equal(none.answers.A4, 0);
  assert.ok(none.covered.has('A4t'));
  // Abendcheck ohne die abgedeckten Fragen; Folgefrage zur Trainingsanstrengung bleibt, wenn sie fehlt
  const settings = mergeSettings();
  const trainingRec = day(sport('kraft', 60, '18:00'));
  const t = journalAnswers(trainingRec, []);
  assert.equal(t.answers.A7, true);
  assert.deepEqual(t.answers.T1, ['kraft']);
  assert.equal(t.answers.T13, 60);
  assert.equal(t.answers.T2, undefined);
  const plan = checkPlan('evening', { ...t.answers }, { date: '2026-10-28', settings, covered: t.covered });
  const ids = plan.core.map((q) => q.id);
  assert.ok(!ids.includes('A7') && !ids.includes('T1') && !ids.includes('T13'), ids.join(','));
  assert.ok(ids.includes('T2'), 'Anstrengung wird noch gefragt');
  assert.ok(ids.includes('A4') && ids.includes('A1'));
  const hidden = hiddenByCondition('evening', { A7: true, A4: 0 }, { date: '2026-10-28', settings, covered: new Set(['A4', 'A4t']) }).map((q) => q.id);
  assert.ok(!hidden.includes('A4t'), 'abgedeckte Fragen werden nicht gelöscht');
  // Logbuch schlägt die grobe Antwort
  const merged = withJournal({ A6: 'gt25', A1: 2 }, rec, []);
  assert.equal(merged.A6, '15-25');
  assert.equal(merged.A1, 2);
  assert.ok(!QUESTION_BY_ID.A12n && RETIRED.A12n, 'Notiz wandert ins Tagebuch');
});

test('Sport: Logbuch-Eintrag zum gemessenen Workout zählt nicht doppelt, WHO-Woche', () => {
  const t0 = new Date(2026, 9, 28, 18, 5).getTime();
  const workouts = [{ t: t0, e: t0 + 50 * 60000, kind: 'kraft', durMin: 50, avgHr: 118 }];
  const rec = day(sport('kraft', 60, '18:00', 8), sport('gehen', 40, '12:15'));
  const sessions = sportSessions(rec, workouts);
  assert.equal(sessions.length, 2, 'Kraft gemessen + Spaziergang');
  const k = sessions.find((s) => s.kind === 'kraft');
  assert.equal(k.min, 50, 'Dauer aus der Messung');
  assert.equal(k.rpe, 8, 'Anstrengung aus dem Logbuch');
  const { answers } = journalAnswers(rec, workouts);
  assert.equal(answers.T13, 50, 'Spaziergang ist kein Training');
  assert.equal(answers.T2, 8);
  const w = weekActivity([{ rec, workouts }, { rec: day(sport('hiit', 20, '07:00', 9)), workouts: [] }], 190);
  assert.equal(w.total, 110);
  assert.equal(w.vigorous, 70, 'RPE 8 und HIIT zählen als intensiv');
  assert.equal(w.equivalent, 40 + 2 * 70);
  assert.equal(w.strengthDays, 1);
});

test('Speicher: Logbuch wird gespeichert, gesichert und zurückgelesen; schnelle Einträge gehen nicht verloren', async () => {
  const store = await openStore('journal-repo');
  const repo = new Repo(store);
  await repo.load();
  let rec = repo.journal.get('2026-10-28') || emptyDay();
  // Zehn schnelle Einträge ohne Warten
  const saves = [];
  for (let i = 0; i < 10; i++) {
    rec = addEntry(rec, { type: 'water', ml: 100, at: '10:00' }, T + i).rec;
    saves.push(repo.saveJournal('2026-10-28', rec));
  }
  await Promise.all(saves);
  const again = new Repo(store);
  await again.load();
  assert.equal(daySummary(again.journal.get('2026-10-28')).waterMl, 1000);
  assert.ok(again.syncKeys().some(([s, k]) => s === 'journal' && k === '2026-10-28'));
  const backup = await again.exportBackup();
  assert.equal(backup.journal.length, 1);
  // Import vereinigt mit Neuerem auf dem Gerät
  const other = new Repo(await openStore('journal-repo-2'));
  await other.load();
  await other.saveJournal('2026-10-28', setField(emptyDay(), 'happy', 9, T + 99999));
  await other.importBackup(backup);
  const s = daySummary(other.journal.get('2026-10-28'));
  assert.equal(s.waterMl, 1000);
  assert.equal(s.happy, 9);
  await other.clearSynced();
  assert.equal(other.journal.size, 0);
});
