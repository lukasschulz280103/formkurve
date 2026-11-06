// Beispieldaten im Speicher: dieselben Generatoren und Formeln wie die Hauptapp,
// nur ohne Datenbank. Die Design-Variante zeigt ausschließlich erfundene Werte.
import { generateDemo } from '../../js/demo/generate.js';
import { RawIndex, groupSamples, mergeBucket } from '../../js/data/rawindex.js';
import { computeAll } from '../../js/model/pipeline.js';
import { mergeSettings } from '../../js/core/config.js';
import { todayKey } from '../../js/core/time.js';

export function buildDemo(days = 120) {
  const today = todayKey();
  const demo = generateDemo({ days, endDate: today });
  const buckets = [];
  for (const [key, list] of groupSamples(demo.samples)) {
    const [type, date, src] = key.split('|');
    const m = mergeBucket(null, list);
    buckets.push({ type, date, src, t: m.t, e: m.e, v: m.v });
  }
  const settings = mergeSettings({
    profile: { birthYear: new Date().getFullYear() - 30, sex: 'm', heightCm: 182, weightKg: 78 },
  });
  const res = computeAll({
    index: new RawIndex(buckets),
    workouts: demo.workouts,
    survey: demo.survey,
    journal: demo.journal,
    context: demo.context,
    settings,
    today,
  });
  return { ...res, settings, today };
}
