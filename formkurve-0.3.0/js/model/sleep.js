// Schlaf: Segmente zu Sitzungen zusammenfassen, Kennzahlen je Nacht, Zuordnung zum Schlaftag.
import { MIN, dateKey } from '../core/time.js';
import { SLEEP } from '../data/normalize.js';

const isAsleep = (c) => c === SLEEP.ASLEEP || c === SLEEP.CORE || c === SLEEP.DEEP || c === SLEEP.REM;

export function unionIntervals(list) {
  const iv = list.filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
  const out = [];
  for (const [a, b] of iv) {
    const last = out[out.length - 1];
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out;
}

const totalLength = (iv) => iv.reduce((s, [a, b]) => s + (b - a), 0);

/** segs: [{t, e, v}] (v = Schlafphase). Lücken bis gapMin werden zu einer Sitzung verbunden. */
export function buildSessions(segs, gapMin = 90) {
  const sorted = segs.filter((s) => s.e > s.t).sort((a, b) => a.t - b.t);
  const sessions = [];
  let cur = null;
  for (const s of sorted) {
    if (cur && s.t - cur.end <= gapMin * MIN) {
      cur.segs.push(s);
      if (s.e > cur.end) cur.end = s.e;
    } else {
      cur = { start: s.t, end: s.e, segs: [s] };
      sessions.push(cur);
    }
  }
  return sessions;
}

export function sessionMetrics(session) {
  const segs = session.segs;
  const asleep = unionIntervals(segs.filter((s) => isAsleep(s.v)).map((s) => [s.t, s.e]));
  if (!asleep.length) return null;
  const asleepMs = totalLength(asleep);
  const stage = (code) => totalLength(unionIntervals(segs.filter((s) => s.v === code).map((s) => [s.t, s.e])));
  const deep = stage(SLEEP.DEEP);
  const rem = stage(SLEEP.REM);
  const core = stage(SLEEP.CORE);
  const hasStages = deep + rem + core > 0;
  const inBed = segs.filter((s) => s.v === SLEEP.INBED);
  const start = Math.min(session.start, asleep[0][0]);
  const end = Math.max(session.end, asleep[asleep.length - 1][1]);
  const onset = asleep[0][0];
  const wake = asleep[asleep.length - 1][1];
  const span = end - start;
  let wakeEpisodes = 0;
  for (let i = 1; i < asleep.length; i++) if (asleep[i][0] - asleep[i - 1][1] >= 3 * MIN) wakeEpisodes++;
  const latencyMin = inBed.length ? Math.max(0, (onset - Math.min(...inBed.map((s) => s.t))) / MIN) : null;
  return {
    start,
    end,
    onset,
    wake,
    asleepMin: asleepMs / MIN,
    inBedMin: span / MIN,
    awakeMin: Math.max(0, span - asleepMs) / MIN,
    efficiency: span > 0 ? asleepMs / span : null,
    deepMin: hasStages ? deep / MIN : null,
    remMin: hasStages ? rem / MIN : null,
    coreMin: hasStages ? core / MIN : null,
    hasStages,
    deepPct: hasStages ? deep / asleepMs : null,
    remPct: hasStages ? rem / asleepMs : null,
    restorativePct: hasStages ? (deep + rem) / asleepMs : null,
    latencyMin,
    hasInBed: inBed.length > 0,
    wakeEpisodes,
  };
}

/**
 * Ordnet Sitzungen dem Schlaftag (Datum des Aufwachens) zu.
 * Liefert Map(date -> { main, napMin }) ; kurze Schläfe am Tag zählen als Nickerchen.
 */
export function assignSleepDays(sessions, { minSleepH = 4 } = {}) {
  const byDay = new Map();
  for (const s of sessions) {
    const m = sessionMetrics(s);
    if (!m) continue;
    const day = dateKey(m.wake);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(m);
  }
  const result = new Map();
  for (const [day, list] of byDay) {
    list.sort((a, b) => b.asleepMin - a.asleepMin);
    const isDaytime = (m) => {
      const h = new Date(m.start).getHours();
      return h >= 9 && h < 19;
    };
    const mains = list.filter((m) => !(m.asleepMin < 180 && isDaytime(m)));
    const main = mains[0] || null;
    const napMin = list.filter((m) => m !== main).reduce((s, m) => s + m.asleepMin, 0);
    if (main) main.incomplete = main.asleepMin < minSleepH * 60;
    result.set(day, { main, napMin });
  }
  return result;
}
