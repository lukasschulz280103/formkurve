import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isoWeek, weekStart, monthStart, periodAverages, periodSummary } from '../js/model/periods.js';
import { weekendRuns } from '../js/ui/charts.js';
import { rangeKeys } from '../js/core/time.js';

test('Kalenderwochen nach ISO 8601', () => {
  assert.deepEqual(isoWeek('2026-10-27'), { year: 2026, week: 44 });
  assert.deepEqual(isoWeek('2026-01-01'), { year: 2026, week: 1 });
  assert.deepEqual(isoWeek('2025-12-29'), { year: 2026, week: 1 }, 'Montag vor Neujahr gehört zu KW 1');
  assert.deepEqual(isoWeek('2027-01-03'), { year: 2026, week: 53 }, '2026 hat 53 Wochen');
  assert.equal(weekStart('2026-11-01'), '2026-10-26', 'Sonntag gehört zur Woche ab Montag');
  assert.equal(monthStart('2026-10-27'), '2026-10-01');
});

test('Durchschnitt je Woche und Monat, laufender Abschnitt markiert', () => {
  const dates = rangeKeys('2026-09-28', '2026-10-27');
  const days = new Map(dates.map((d, i) => [d, { form: i < 7 ? 40 : i < 14 ? 60 : 80 }]));
  days.set('2026-10-20', { form: null });
  const weeks = periodAverages(dates, days, { unit: 'week', today: '2026-10-27' });
  assert.deepEqual(weeks.map((w) => w.label), ['KW 40', 'KW 41', 'KW 42', 'KW 43', 'KW 44']);
  assert.equal(weeks[0].mean, 40);
  assert.equal(weeks[1].mean, 60);
  assert.equal(weeks[3].n, 6, 'Tag ohne Wert zählt nicht');
  assert.equal(weeks[4].partial, true);
  assert.equal(weeks[4].n, 2);
  assert.equal(weeks[0].range, '28.9.–4.10.');
  const months = periodAverages(dates, days, { unit: 'month', today: '2026-10-27' });
  assert.deepEqual(months.map((m) => m.label), ['Sep.', 'Okt.']);
  assert.equal(months[1].partial, true);
  const sum = periodSummary(weeks);
  assert.equal(sum.current.label, 'KW 44');
  assert.equal(sum.delta, 0);
  const oneDay = periodSummary(periodAverages(dates.slice(0, -1), days, { unit: 'week', today: '2026-10-26' }));
  assert.equal(oneDay.current.label, 'KW 43', 'erst ein Tag in der neuen Woche: letzte vollständige zählt');
});

test('Wochenenden als zusammenhängende Flächen', () => {
  assert.deepEqual(weekendRuns(rangeKeys('2026-10-22', '2026-11-01')), [[2, 3], [9, 10]]);
  assert.deepEqual(weekendRuns(['2026-10-25']), [[0, 0]]);
});
