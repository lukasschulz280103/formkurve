import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QUESTIONS, QUESTION_BY_ID, RETIRED } from '../js/survey/catalog.js';
import { checkPlan, prefillValue, effectiveAnswers, DEPTH } from '../js/survey/engine.js';
import { SUPPLEMENTS, SUPPLEMENT_GROUPS, allSupplements, supplementsOf, customId, recentSupplements } from '../js/survey/supplements.js';
import { factorsFor } from '../js/analysis/insights.js';
import { mergeSettings } from '../js/core/config.js';
import { addDays } from '../js/core/time.js';

// Alle Fragen der Version 0.2. Jede muss weiter existieren oder als abgelöst geführt sein,
// sonst würden gespeicherte Antworten nach einem Update nicht mehr ausgewertet.
const V02_IDS = 'M1 M2 M3 M3r M4 M5 M6 M6r M7 M8 M9 M10 M11 M12 M12s M13 G1 G2 G3 G4 G5 G8 G9 A1 A2 A3 A4 A4t A5 A5s A6 A7 A8 A9 A10 A11 A12 A12n X1 X2 X3 X4 X5 X6 X7 X8 T1 T13 T2 T3 T5 T6 T7 T8 T11 T12 S1 S2 S3 S4 S5 S6 S7 S8 S9 S10 S11 E1 E2 E3 E4 E5 E6 E7 E8 E9 E10 P1 P2 P3 P4 P5 P6 P7 P7q P8 P9 P10 P11 W1a W1b W1c W1d W2b W3 T9 T10 W5 W6 W4 W7'.split(' ');

const settings = mergeSettings();
const MONDAY = '2026-10-26';
const TUESDAY = '2026-10-27';
const SUNDAY = '2026-11-01';
const ids = (qs) => qs.map((q) => q.id);

test('Katalog: Kennungen eindeutig, jede Frage hat eine Priorität, alte Fragen bleiben gültig', () => {
  const seen = new Set();
  for (const q of QUESTIONS) {
    assert.ok(!seen.has(q.id), `doppelt: ${q.id}`);
    seen.add(q.id);
    assert.ok(q.prio === 'core' || Number.isFinite(q.prio), `Priorität fehlt: ${q.id}`);
    if (q.parent) assert.ok(QUESTION_BY_ID[q.parent], `Ausgangsfrage fehlt: ${q.id}`);
  }
  for (const id of V02_IDS) assert.ok(QUESTION_BY_ID[id] || RETIRED[id], `Frage aus 0.2 verschwunden: ${id}`);
  const opts = (id) => QUESTION_BY_ID[id].options.map((o) => o.v);
  assert.deepEqual(opts('A12'), ['keines', 'reise', 'party', 'streit', 'pruefung', 'impfung', 'wettkampf']);
  assert.deepEqual(opts('M10'), ['keine', 'hals', 'husten', 'schnupfen', 'fieber', 'magen', 'glieder']);
});

test('Morgen: vier Kernfragen, optionale nach Wichtigkeit, Gesundheit nur bei Beschwerden', () => {
  const plan = checkPlan('morning', {}, { date: MONDAY, settings });
  assert.deepEqual(ids(plan.core), ['M1', 'M4', 'M3', 'M10']);
  assert.deepEqual(ids(plan.optional.map((x) => x.q)).slice(0, 3), ['M2', 'M5', 'M6']);
  assert.ok(!plan.optional.some((x) => x.q.mod === 'health'));
  const sick = checkPlan('morning', { M10: ['hals'] }, { date: MONDAY, settings });
  assert.equal(sick.optional[0].q.id, 'G1');
  const ranks = plan.optional.map((x) => x.rank);
  assert.deepEqual(ranks, [...ranks].sort((a, b) => a - b));
});

test('Abend: Kernfragen mit Folgefragen direkt dahinter', () => {
  const plain = checkPlan('evening', {}, { date: MONDAY, settings });
  assert.deepEqual(ids(plain.core), ['A1', 'A3', 'A4', 'A7']);
  const full = checkPlan('evening', { A3: true, A4: 2, A7: true }, { date: MONDAY, settings });
  assert.deepEqual(ids(full.core), ['A1', 'A3', 'X1', 'A4', 'A4t', 'A7', 'T1', 'T13', 'T2']);
  assert.equal(full.optional[0].q.id, 'A12');
  assert.ok(ids(full.optional.map((x) => x.q)).includes('X2'));
  const nic = checkPlan('evening', {}, { date: MONDAY, settings: mergeSettings({ survey: { askNicotine: true } }) });
  assert.ok(ids(nic.core).includes('X5'));
});

test('Abend: Supplements werden Kernfrage, sobald sie genutzt werden; Vorschlagstage rücken Bereiche nach vorn', () => {
  const survey = new Map([[addDays(TUESDAY, -2), { a: { SUP: ['magnesium'] }, ts: {}, backfilled: {} }]]);
  const withSup = checkPlan('evening', {}, { date: TUESDAY, settings, survey });
  assert.ok(ids(withSup.core).includes('SUP'));
  const without = checkPlan('evening', {}, { date: TUESDAY, settings, survey: new Map() });
  assert.ok(!ids(without.core).includes('SUP'));
  const rankOf = (plan, id) => plan.optional.find((x) => x.q.id === id).rank;
  const tue = checkPlan('evening', {}, { date: TUESDAY, settings });
  const mon = checkPlan('evening', {}, { date: MONDAY, settings });
  assert.ok(rankOf(tue, 'E1') < rankOf(mon, 'E1'), 'Dienstag ist Ernährungstag');
  assert.ok(!mon.optional.some((x) => x.q.mod === 'weekly'));
  assert.ok(checkPlan('evening', {}, { date: SUNDAY, settings }).optional.some((x) => x.q.mod === 'weekly'));
  assert.equal(DEPTH.standard, 3);
});

test('Vorbelegung: entfernte Antwortmöglichkeiten werden nicht übernommen', () => {
  const s9 = QUESTION_BY_ID.S9;
  const survey = new Map([[addDays(MONDAY, -1), { a: { S9: ['melatonin', 'maske'] }, ts: {}, backfilled: {} }]]);
  assert.deepEqual(prefillValue(s9, MONDAY, survey, null), ['maske']);
  const only = new Map([[addDays(MONDAY, -1), { a: { S9: ['melatonin'] }, ts: {}, backfilled: {} }]]);
  assert.equal(prefillValue(s9, MONDAY, only, null), undefined);
});

test('Supplements: großer Katalog, eigene Mittel, alte Antworten werden zugeordnet', () => {
  assert.ok(SUPPLEMENTS.length >= 50, `nur ${SUPPLEMENTS.length}`);
  assert.equal(new Set(SUPPLEMENTS.map((s) => s.id)).size, SUPPLEMENTS.length);
  for (const s of SUPPLEMENTS) assert.ok(SUPPLEMENT_GROUPS.some((g) => g.key === s.group), s.id);
  for (const old of ['kreatin', 'magnesium', 'vitd', 'omega3', 'eisen', 'elektrolyte', 'melatonin']) assert.ok(SUPPLEMENTS.some((s) => s.id === old), old);
  assert.equal(customId('Eisen + Vitamin C'), 'c_eisen-vitamin-c');
  assert.equal(customId('Grüner Tee'), 'c_gruener-tee');
  const s = mergeSettings({ survey: { customSupplements: [{ id: 'c_x', label: 'X-Pulver' }, { id: 'c_y', label: 'Alt', hidden: true }] } });
  assert.ok(allSupplements(s).some((x) => x.id === 'c_x'));
  assert.ok(!allSupplements(s).some((x) => x.id === 'c_y'));
  assert.ok(allSupplements(s, { includeHidden: true }).some((x) => x.id === 'c_y'));
  const factors = factorsFor(s).map((f) => f.id);
  assert.ok(factors.includes('sup_magnesium') && factors.includes('sup_c_x') && factors.includes('sup_c_y'));

  assert.deepEqual(supplementsOf({ E8: ['magnesium', 'andere'] }), ['magnesium']);
  assert.deepEqual(supplementsOf({ E8: ['keine'] }), ['keine']);
  assert.deepEqual(supplementsOf({ S9: ['melatonin', 'maske'] }), ['melatonin']);
  assert.deepEqual(supplementsOf({ SUP: ['zink'], E8: ['magnesium'] }), ['zink']);
  assert.equal(supplementsOf({ S9: ['maske'] }), undefined);
  assert.equal(supplementsOf({ __noLegacySup: true, E8: ['magnesium'] }), undefined);
});

test('Supplements: alte Angaben gelten fort, bis es eine neue Antwort gibt', () => {
  const old = new Map([[addDays(MONDAY, -10), { a: { E8: ['magnesium'] }, ts: {}, backfilled: {} }]]);
  assert.deepEqual(supplementsOf(effectiveAnswers(old, MONDAY)), ['magnesium']);
  const mixed = new Map(old);
  mixed.set(addDays(MONDAY, -3), { a: { SUP: ['zink'] }, ts: {}, backfilled: {} });
  assert.equal(supplementsOf(effectiveAnswers(mixed, MONDAY)), undefined);
  assert.deepEqual(recentSupplements(mixed, MONDAY, 14, addDays), ['zink', 'magnesium']);
});
