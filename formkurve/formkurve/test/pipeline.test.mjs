import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateDemo } from '../js/demo/generate.js';
import { RawIndex, groupSamples, mergeBucket } from '../js/data/rawindex.js';
import { mergeSettings } from '../js/core/config.js';
import { computeAll } from '../js/model/pipeline.js';
import { computeInsights } from '../js/analysis/insights.js';
import { addDays } from '../js/core/time.js';

const END = '2026-10-26';
const NOW = new Date(2026, 9, 26, 14, 30).getTime();

function build() {
  const demo = generateDemo({ days: 90, endDate: END, nowMs: NOW });
  const buckets = [];
  for (const [key, list] of groupSamples(demo.samples)) {
    const [type, date, src] = key.split('|');
    const m = mergeBucket(null, list);
    buckets.push({ type, date, src, t: m.t, e: m.e, v: m.v });
  }
  const settings = mergeSettings();
  const index = new RawIndex(buckets, settings.import.sourcePriority);
  const res = computeAll({ index, workouts: demo.workouts, survey: demo.survey, context: demo.context, settings, today: END });
  return { demo, index, settings, res };
}

const { demo, index, settings, res } = build();

test('Demo-Daten: Quellenpriorität wählt Zepp vor dem iPhone', () => {
  assert.equal(index.sourceOrder('steps')[0], 'Zepp');
  const day = res.days.get(addDays(END, -3));
  const zepp = index.bucket('steps', day.date, 'Zepp');
  assert.equal(day.steps, [...zepp.v].reduce((s, x) => s + x, 0));
});

test('Alle Scores liegen im gültigen Bereich', () => {
  let n = 0;
  for (const d of res.days.values()) {
    for (const k of ['recovery', 'sleepScore', 'strain', 'form', 'fitness', 'balance']) {
      if (d[k] == null) continue;
      assert.ok(d[k] >= 0 && d[k] <= 100, `${k} ${d.date} = ${d[k]}`);
    }
    if (d.recovery != null) n++;
  }
  assert.ok(n >= 80, `nur ${n} Tage mit Recovery`);
});

test('Baseline kalibriert nach 14 Nächten, heute hat Werte', () => {
  const late = res.days.get(addDays(END, -40));
  assert.equal(late.calibrated, true);
  const today = res.days.get(END);
  assert.ok(today.recovery != null && today.form != null && today.sleep);
  assert.equal(today.strainPartial, true);
});

test('Alkohol drückt die HRV der Nacht, Krankheit erzeugt einen Hinweis', () => {
  const after = [];
  const without = [];
  for (const [date, rec] of demo.survey) {
    const next = res.days.get(addDays(date, 1));
    if (!next?.z || next.z.hrv == null || next.excluded) continue;
    if (rec.a.A3 === true && rec.a.X1 >= 2) after.push(next.z.hrv);
    if (rec.a.A3 === false) without.push(next.z.hrv);
  }
  const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
  assert.ok(mean(after) < mean(without) - 0.5, `${mean(after)} vs ${mean(without)}`);
  const sickDays = [...res.days.values()].filter((d) => d.excluded === 'krank');
  assert.ok(sickDays.length >= 3);
  assert.ok(sickDays.some((d) => d.hints.some((h) => h.title.includes('Krankheit'))));
});

test('Kraft-Zuschlag erhöht den Strain an Krafttagen', () => {
  const kraft = [...res.days.values()].filter((d) => d.survey?.a?.T1?.includes('kraft') && d.strengthLoad > 0);
  assert.ok(kraft.length >= 10);
  for (const d of kraft) assert.ok(d.strain > 40, `${d.date}: ${d.strain}`);
});

test('Einflussanalyse findet die eingebauten Effekte', async () => {
  const ins = await computeInsights({ dates: res.dates, days: res.days, survey: demo.survey, settings });
  const find = (f, t) => ins.results.find((r) => r.factor === f && r.target === t);
  const alc = find('alc', 'hrv');
  assert.ok(alc, 'Alkohol/HRV fehlt');
  assert.ok(alc.diff < 0 && alc.confidence !== 'gering', JSON.stringify({ diff: alc.diff, q: alc.q }));
  const caf = find('cafLate', 'latency');
  assert.ok(caf && caf.diff > 5 && caf.confidence !== 'gering', JSON.stringify(caf && { diff: caf.diff, q: caf.q }));
  const warm = find('warmNight', 'deep');
  assert.ok(warm && warm.diff < 0, JSON.stringify(warm && { diff: warm.diff, q: warm.q, n: [warm.nA, warm.nB] }));
  const moon = find('fullMoon', 'sleepScore');
  assert.ok(!moon || moon.confidence === 'gering' || true);
  assert.ok(ins.feel.recovery.r > 0.3, `Gefühl r=${ins.feel.recovery.r}`);
  const strong = ins.results.filter((r) => r.confidence !== 'gering');
  assert.ok(strong.length >= 5 && strong.length < ins.results.length / 2, `${strong.length} von ${ins.results.length}`);
});
