// Liest den Apple-Health-Gesamtexport (export.zip oder export.xml) gestreamt ein,
// ohne die ganze Datei in den Speicher zu laden.
import { Unzip, UnzipInflate } from '../vendor/fflate.js';
import { parseLooseDate } from '../core/time.js';
import { typeFromHK, normalizeValue, decodeEntities, workoutKind } from '../data/normalize.js';

/** Scanner für den XML-Text: erkennt <Record>, <Workout> und <WorkoutStatistics>. */
export function createXmlScanner({ sinceMs = 0, onSample, onWorkout }) {
  let buf = '';
  let workout = null;
  const stats = { records: 0, used: 0, old: 0, implausible: 0, workouts: 0, byType: {}, sources: {}, minT: null, maxT: null };

  function attr(b, lt, gt, name) {
    const key = ' ' + name + '="';
    const p = b.indexOf(key, lt);
    if (p < 0 || p > gt) return null;
    const s = p + key.length;
    const e = b.indexOf('"', s);
    if (e < 0 || e > gt) return null;
    return b.slice(s, e);
  }

  function handleRecord(b, lt, gt) {
    stats.records++;
    const type = typeFromHK(attr(b, lt, gt, 'type'));
    if (!type) return;
    const t = parseLooseDate(attr(b, lt, gt, 'startDate'));
    if (!(t >= sinceMs)) {
      stats.old++;
      return;
    }
    let e = parseLooseDate(attr(b, lt, gt, 'endDate'));
    if (!(e >= t)) e = t;
    const v = normalizeValue(type, attr(b, lt, gt, 'value'), attr(b, lt, gt, 'unit'));
    if (!Number.isFinite(v)) {
      stats.implausible++;
      return;
    }
    const src = decodeEntities(attr(b, lt, gt, 'sourceName') || 'Unbekannt');
    stats.used++;
    stats.byType[type] = (stats.byType[type] || 0) + 1;
    stats.sources[src] = (stats.sources[src] || 0) + 1;
    if (stats.minT == null || t < stats.minT) stats.minT = t;
    if (stats.maxT == null || e > stats.maxT) stats.maxT = e;
    onSample({ type, t, e, v, src });
  }

  function startWorkout(b, lt, gt) {
    const t = parseLooseDate(attr(b, lt, gt, 'startDate'));
    const e = parseLooseDate(attr(b, lt, gt, 'endDate'));
    const act = attr(b, lt, gt, 'workoutActivityType') || '';
    const dur = Number(attr(b, lt, gt, 'duration'));
    const du = (attr(b, lt, gt, 'durationUnit') || 'min').toLowerCase();
    let durMin = (e - t) / 60000;
    if (Number.isFinite(dur)) durMin = du === 's' || du.startsWith('sec') ? dur / 60 : du.startsWith('h') ? dur * 60 : dur;
    return {
      t,
      e: Number.isFinite(e) ? e : t + durMin * 60000,
      act: act.replace(/^HKWorkoutActivityType/, ''),
      kind: workoutKind(act),
      durMin,
      avgHr: null,
      maxHr: null,
      kcal: Number(attr(b, lt, gt, 'totalEnergyBurned')) || null,
      src: decodeEntities(attr(b, lt, gt, 'sourceName') || 'Unbekannt'),
    };
  }

  function handleStat(b, lt, gt) {
    const ty = attr(b, lt, gt, 'type');
    if (ty === 'HKQuantityTypeIdentifierHeartRate') {
      workout.avgHr = Number(attr(b, lt, gt, 'average')) || null;
      workout.maxHr = Number(attr(b, lt, gt, 'maximum')) || null;
    } else if (ty === 'HKQuantityTypeIdentifierActiveEnergyBurned') {
      const s = Number(attr(b, lt, gt, 'sum'));
      if (s) workout.kcal = s;
    }
  }

  function finishWorkout() {
    if (workout && Number.isFinite(workout.t) && workout.t >= sinceMs) {
      stats.workouts++;
      onWorkout(workout);
    }
    workout = null;
  }

  function push(text) {
    buf += text;
    const b = buf;
    let i = 0;
    for (;;) {
      const lt = b.indexOf('<', i);
      if (lt < 0) {
        i = b.length;
        break;
      }
      const gt = b.indexOf('>', lt);
      if (gt < 0) {
        i = lt;
        break;
      }
      i = gt + 1;
      const c = b.charCodeAt(lt + 1);
      if (c === 82 && b.startsWith('<Record ', lt)) handleRecord(b, lt, gt);
      else if (c === 87) {
        if (b.startsWith('<Workout ', lt)) {
          workout = startWorkout(b, lt, gt);
          if (b.charCodeAt(gt - 1) === 47) finishWorkout();
        } else if (workout && b.startsWith('<WorkoutStatistics ', lt)) handleStat(b, lt, gt);
      } else if (c === 47 && workout && b.startsWith('</Workout>', lt)) finishWorkout();
    }
    buf = i >= b.length ? '' : b.slice(i);
  }

  return { push, stats };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

/**
 * Importiert eine export.zip oder export.xml.
 * onBatch(samples, workouts) wird portionsweise aufgerufen (zum Speichern).
 */
export async function importHealthFile(file, { sinceMs = 0, onBatch, onProgress, batchSize = 40000 } = {}) {
  const isZip = /\.zip$/i.test(file.name || '') || /zip/.test(file.type || '');
  const samples = [];
  const workouts = [];
  const scanner = createXmlScanner({ sinceMs, onSample: (s) => samples.push(s), onWorkout: (w) => workouts.push(w) });
  const decoder = new TextDecoder('utf-8');
  let found = !isZip;
  let xmlDone = false;
  let unzipErr = null;

  const feed = (u8, final) => {
    scanner.push(decoder.decode(u8, { stream: !final }));
    if (final) xmlDone = true;
  };

  let unzip = null;
  if (isZip) {
    unzip = new Unzip((f) => {
      const wanted = /(^|\/)export\.xml$/i.test(f.name);
      if (wanted) found = true;
      f.ondata = (err, dat, final) => {
        if (err) {
          unzipErr = err;
          return;
        }
        if (wanted) feed(dat, final);
      };
      f.start();
    });
    unzip.register(UnzipInflate);
  }

  const flush = async (force) => {
    if (samples.length >= batchSize || (force && (samples.length || workouts.length))) {
      const s = samples.splice(0);
      const w = workouts.splice(0);
      await onBatch?.(s, w);
    }
  };

  const reader = file.stream().getReader();
  const total = file.size || 1;
  let read = 0;
  let lastYield = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    read += value.length;
    if (isZip) unzip.push(value, false);
    else feed(value, false);
    if (unzipErr) throw new Error('ZIP konnte nicht entpackt werden. Entpacke die Datei in der Dateien-App und wähle export.xml.');
    if (read - lastYield > 4e6) {
      lastYield = read;
      onProgress?.(read / total, scanner.stats);
      await flush(false);
      await tick();
    }
    if (xmlDone) {
      try {
        await reader.cancel();
      } catch {
        // egal
      }
      break;
    }
  }
  if (!xmlDone) {
    try {
      if (isZip) unzip.push(new Uint8Array(0), true);
      else feed(new Uint8Array(0), true);
    } catch {
      // unvollständiges Archivende: bereits gelesene Daten bleiben gültig
    }
  }
  onProgress?.(1, scanner.stats);
  await flush(true);
  if (!found) throw new Error('In der ZIP-Datei wurde keine export.xml gefunden.');
  return scanner.stats;
}
