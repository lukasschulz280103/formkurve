import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monthGrid, monthStats, monthLabel, monthLast, monthOf, shiftMonth, levelOf, scoreEdges } from '../js/model/calendar.js';
import { pendingChecks } from '../js/survey/engine.js';
import { DEFAULTS } from '../js/core/config.js';

test('Kalender: Raster beginnt montags und deckt den ganzen Monat ab', () => {
  const g = monthGrid('2026-10');
  // Ganze Wochen, der 1. Oktober 2026 ist ein Donnerstag
  assert.equal(g.length % 7, 0);
  assert.equal(g[0].date, '2026-09-28');
  assert.equal(g[g.length - 1].date, '2026-11-01');
  const inside = g.filter((c) => !c.outside);
  assert.equal(inside.length, 31);
  assert.equal(inside[0].date, '2026-10-01');
  assert.equal(inside[30].date, '2026-10-31');
  assert.deepEqual(g.slice(0, 3).map((c) => c.outside), [true, true, true]);
  // Samstag und Sonntag stehen an sechster und siebter Stelle jeder Woche
  assert.deepEqual([g[5].weekend, g[6].weekend, g[0].weekend], [true, true, false]);
  assert.equal(g[3].day, 1);
});

test('Kalender: Schaltjahr und Monate mit sechs Wochen', () => {
  assert.equal(monthLast('2024-02'), '2024-02-29');
  assert.equal(monthLast('2026-02'), '2026-02-28');
  // März 2026 beginnt an einem Sonntag und braucht sechs Zeilen
  const g = monthGrid('2026-03');
  assert.equal(g.length, 42);
  assert.equal(g.filter((c) => !c.outside).length, 31);
  assert.equal(monthGrid('2026-02').filter((c) => !c.outside).length, 28);
});

test('Kalender: Monatswechsel über Jahresgrenzen', () => {
  assert.equal(shiftMonth('2026-01', -1), '2025-12');
  assert.equal(shiftMonth('2026-12', 1), '2027-01');
  assert.equal(shiftMonth('2026-05', -17), '2024-12');
  assert.equal(shiftMonth('2026-10', 0), '2026-10');
  assert.equal(monthOf('2026-10-28'), '2026-10');
  assert.equal(monthLabel('2026-10'), 'Oktober 2026');
});

test('Kalender: Farbstufen liegen an den Schwellen der Einstellungen', () => {
  const edges = scoreEdges(34, 67);
  assert.deepEqual(edges, [34, 50.5, 67, 83.5]);
  assert.equal(levelOf(0, edges), 0);
  assert.equal(levelOf(33.9, edges), 0);
  assert.equal(levelOf(34, edges), 1, 'genau auf der Schwelle zählt zur höheren Stufe');
  assert.equal(levelOf(60, edges), 2);
  assert.equal(levelOf(67, edges), 3);
  assert.equal(levelOf(100, edges), 4);
  assert.equal(levelOf(null, edges), null);
  assert.equal(levelOf(undefined, edges), null);
  // Eigene Grenzen, etwa für Glück von 0 bis 10
  assert.equal(levelOf(3, [4, 6, 8, 9]), 0);
  assert.equal(levelOf(10, [4, 6, 8, 9]), 4);
});

test('Kalender: Monatskennzahlen zählen nur Tage mit Wert', () => {
  const vals = { '2026-10-02': 40, '2026-10-05': 80, '2026-10-09': 60, '2026-09-30': 10, '2026-11-01': 99 };
  const st = monthStats('2026-10', (d) => vals[d] ?? null);
  assert.equal(st.n, 3);
  assert.equal(st.mean, 60);
  assert.deepEqual(st.best, { date: '2026-10-05', value: 80 });
  assert.deepEqual(st.worst, { date: '2026-10-02', value: 40 });
  const leer = monthStats('2026-01', () => null);
  assert.deepEqual(leer, { mean: null, n: 0, best: null, worst: null });
});

function survey(done = {}) {
  const m = new Map();
  for (const [date, slots] of Object.entries(done)) m.set(date, { a: {}, ts: Object.fromEntries(slots.map((s) => [s, 1])), backfilled: {} });
  return m;
}
const at = (h) => new Date(2026, 9, 28, h, 0, 0);
const opts = (extra) => ({ settings: DEFAULTS, today: '2026-10-28', since: '2026-10-01', ...extra });

test('Offene Checks: heute zählt nur, was schon dran war', () => {
  // 10 Uhr: der Morgencheck ist offen, der Abend noch nicht
  const vorher = survey({ '2026-10-27': ['morning', 'evening'], '2026-10-26': ['morning', 'evening'], '2026-10-25': ['morning', 'evening'] });
  assert.deepEqual(pendingChecks(vorher, opts({ now: at(10) })), [{ date: '2026-10-28', slot: 'morning' }]);
  // 20 Uhr: beide offen, der neueste zuerst
  assert.deepEqual(pendingChecks(vorher, opts({ now: at(20) })), [
    { date: '2026-10-28', slot: 'morning' },
    { date: '2026-10-28', slot: 'evening' },
  ]);
  // 2 Uhr nachts gehört noch zum Vortag: der Morgencheck von heute zählt nicht
  const nachts = survey({ '2026-10-27': ['morning'], '2026-10-26': ['morning', 'evening'], '2026-10-25': ['morning', 'evening'] });
  assert.deepEqual(pendingChecks(nachts, opts({ now: at(2) })), [{ date: '2026-10-27', slot: 'evening' }]);
});

test('Offene Checks: Nachtragefenster und Beginn des Kontos', () => {
  const leer = survey();
  // Standard sind drei Nachtragetage: 3 volle Tage plus der Morgen von heute
  assert.equal(pendingChecks(leer, opts({ now: at(10) })).length, 7);
  assert.equal(pendingChecks(leer, opts({ now: at(20) })).length, 8);
  // Wer erst heute angefangen hat, sieht nichts von vorher
  assert.deepEqual(pendingChecks(leer, opts({ now: at(20), since: '2026-10-28' })), [
    { date: '2026-10-28', slot: 'morning' },
    { date: '2026-10-28', slot: 'evening' },
  ]);
  // Erledigtes zählt nicht mehr
  const halb = survey({ '2026-10-28': ['morning'], '2026-10-27': ['evening'] });
  assert.deepEqual(pendingChecks(halb, opts({ now: at(20), since: '2026-10-27' })).map((p) => `${p.date} ${p.slot}`), [
    '2026-10-28 evening',
    '2026-10-27 morning',
  ]);
  // Ein größeres Fenster liefert mehr Tage
  const weit = { ...DEFAULTS, survey: { ...DEFAULTS.survey, backfillDays: 5 } };
  assert.equal(pendingChecks(leer, opts({ now: at(20), settings: weit })).length, 12);
});
