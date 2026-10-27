// Reine Rechenfunktionen der Scores (Abschnitte 3 bis 5 des Konzepts). Keine Seiteneffekte.
import { isNum, clamp, sigmoid, weightedMean, linmap, median, mad, sd } from '../core/stats.js';

/** Robuster z-Wert gegen eine Baseline {median, mad}. floor verhindert Division durch ~0. */
export function zScore(x, base, floor) {
  if (!isNum(x) || !base || !isNum(base.median)) return null;
  const scale = Math.max(1.4826 * (base.mad || 0), floor);
  return clamp((x - base.median) / scale, -3, 3);
}

/** Baseline aus den Werten der vorangehenden Tage (ohne den Tag selbst). */
export function baselineOf(values, minUsable = 5) {
  const v = values.filter(isNum);
  if (v.length < minUsable) return null;
  return { median: median(v), mad: mad(v), n: v.length };
}

export const Z_FLOOR = { lnHrv: 0.06, rhr: 1.5, resp: 0.4, spo2: 0.7, temp: 0.15 };

/** HFR-Zone (0 bis 5) einer Herzfrequenz nach Karvonen. */
export function hrZone(hr, rhr, hrMax, edges = [0.5, 0.6, 0.7, 0.8, 0.9]) {
  const f = (hr - rhr) / Math.max(1, hrMax - rhr);
  let z = 0;
  for (let i = 0; i < edges.length; i++) if (f >= edges[i]) z = i + 1;
  return z;
}

/**
 * Minuten je Zone aus Pulsmesswerten. Ein Messwert gilt bis zum nächsten,
 * höchstens gapCapMin Minuten (Lücken zählen nicht als Belastung).
 */
export function zoneMinutes(t, e, v, { rhr, hrMax, gapCapMin = 10, edges } = {}) {
  const zones = [0, 0, 0, 0, 0, 0];
  let covered = 0;
  const cap = gapCapMin * 60000;
  for (let i = 0; i < t.length; i++) {
    let dur;
    if (e[i] - t[i] >= 30000) dur = Math.min(e[i] - t[i], cap);
    else if (i + 1 < t.length) dur = Math.min(Math.max(0, t[i + 1] - t[i]), cap);
    else dur = Math.min(60000, cap);
    const min = dur / 60000;
    zones[hrZone(v[i], rhr, hrMax, edges)] += min;
    covered += min;
  }
  return { zones, covered };
}

/** Edwards-TRIMP: Minuten in Zone 1 bis 5 mal Faktor 1 bis 5. */
export function edwardsTrimp(zones) {
  return zones[1] * 1 + zones[2] * 2 + zones[3] * 3 + zones[4] * 4 + zones[5] * 5;
}

export function strainFromLoad(load, k = 250) {
  if (!isNum(load)) return null;
  return 100 * (1 - Math.exp(-Math.max(0, load) / k));
}

/** Kraft-Zuschlag: Dauer x RPE x Faktor x Kraftanteil. */
export function strengthLoad(durMin, rpe, factor = 0.4, share = 1) {
  if (!isNum(durMin) || durMin <= 0 || !share) return 0;
  return durMin * (isNum(rpe) ? rpe : 6) * factor * share;
}

/**
 * Schlafbedarf in Stunden für eine Nacht. debtsH sind die Fehlbeträge der letzten drei Nächte
 * gegenüber dem Grundbedarf (Basis + Strain-Zuschlag), damit sich die Schuld nicht selbst aufschaukelt.
 * Liefert { need, core } mit core = Grundbedarf ohne Schuld und Nickerchen.
 */
export function sleepNeedParts({ base = 8, strainPrev = null, debtsH = [], napMinPrev = 0 }, p) {
  const strainAdj = isNum(strainPrev) ? Math.max(0, strainPrev - p.strainNeedFrom) * p.strainNeedPerPoint : 0;
  const debtAdj = p.debtFactor * debtsH.filter(isNum).reduce((s, x) => s + Math.max(0, x), 0);
  const extra = Math.min(p.extraCap, strainAdj + debtAdj);
  const nap = Math.min(p.napCap, Math.max(0, napMinPrev || 0) / 60);
  return { need: Math.max(4, base + extra - nap), core: base + Math.min(p.extraCap, strainAdj) };
}

export function sleepNeed(args, p) {
  return sleepNeedParts(args, p).need;
}

/** Regelmäßigkeit 0 bis 100 aus Einschlaf- und Aufwachzeiten (Minuten, um Mitternacht zentriert). */
export function regularityScore(onsets, wakes, p) {
  if (onsets.length < 4 || wakes.length < 4) return null;
  const avg = (sd(onsets) + sd(wakes)) / 2;
  return linmap(avg, p.regBad, p.regGood);
}

export function sleepScore({ asleepMin, needH, efficiency, restorativePct, regularity }, p) {
  if (!isNum(asleepMin) || asleepMin <= 0) return { score: null, parts: {} };
  const ratio = asleepMin / 60 / needH;
  const parts = {
    duration: 100 * clamp(ratio, 0, 1) ** 1.5,
    efficiency: linmap(efficiency, p.effLow, p.effHigh),
    stages: isNum(restorativePct) ? linmap(restorativePct, p.stageLow, p.stageHigh) : null,
    regularity: isNum(regularity) ? regularity : null,
  };
  const score = weightedMean([
    [parts.duration, p.wDuration],
    [parts.efficiency, p.wEfficiency],
    [parts.stages, p.wStages],
    [parts.regularity, p.wRegularity],
  ]);
  return { score, parts };
}

/** Vitalwerte können nur abziehen: 0 bis -3. */
export function vitalZ({ temp = null, resp = null, spo2 = null }) {
  if (!isNum(temp) && !isNum(resp) && !isNum(spo2)) return null;
  const pT = isNum(temp) ? Math.max(0, Math.abs(temp) - 1) : 0;
  const pR = isNum(resp) ? Math.max(0, resp - 1) : 0;
  const pS = isNum(spo2) ? Math.max(0, -spo2 - 1) : 0;
  return -Math.min(3, pT + pR + pS);
}

export function sleepZ(score, p) {
  if (!isNum(score)) return null;
  return clamp((score - p.sleepNeutral) / p.sleepScale, -3, 3);
}

/**
 * Recovery 0 bis 100. z = {hrv, rhr, sleep, vital, subj}. Fehlende Teile werden herausgerechnet.
 * Liefert zusätzlich, wie viele Punkte jede Komponente gegenüber "neutral" ausmacht.
 */
export function recoveryScore(z, p) {
  if (!isNum(z.hrv) && !isNum(z.rhr)) return { score: null, raw: null, parts: {} };
  const items = [
    ['hrv', z.hrv, p.wHrv],
    ['rhr', isNum(z.rhr) ? -z.rhr : null, p.wRhr],
    ['sleep', z.sleep, p.wSleep],
    ['vital', z.vital, p.wVital],
    ['subj', z.subj, p.wSubj],
  ];
  const raw = weightedMean(items.map(([, v, w]) => [v, w]));
  const score = 100 * sigmoid(p.spread * raw);
  const parts = {};
  for (const [key, v] of items) {
    if (!isNum(v)) continue;
    const without = weightedMean(items.map(([k, vv, w]) => [k === key ? 0 : vv, w]));
    parts[key] = score - 100 * sigmoid(p.spread * without);
  }
  return { score, raw, parts };
}

export function recoveryZone(score, p) {
  if (!isNum(score)) return null;
  if (score < p.red) return 'low';
  if (score >= p.green) return 'high';
  return 'mid';
}

/** Belastungsbalance 0 bis 100 aus akuter (7 Tage) und chronischer (28 Tage) Last. */
export function balanceScore(ratio, p) {
  if (!isNum(ratio)) return null;
  if (ratio >= p.lo && ratio <= p.hi) return 100;
  if (ratio < p.lo) return Math.max(20, 100 - (p.lo - ratio) * 150);
  return clamp(100 - (ratio - p.hi) * 140, 0, 100);
}

/** Tageswert für die Langzeit-Fitness (0 bis 100) aus absoluten Ankern. */
export function fitnessInput({ rhr, hrv, activeMin7, regularDays, vo2 }, p) {
  const parts = {
    rhr: isNum(rhr) ? linmap(rhr, p.rhrWorst, p.rhrBest) : null,
    hrv: isNum(hrv) && hrv > 0 ? linmap(Math.log(hrv), Math.log(p.hrvLow), Math.log(p.hrvHigh)) : null,
    active: isNum(activeMin7) ? linmap(activeMin7, 0, p.activeTarget) : null,
    regular: isNum(regularDays) ? linmap(regularDays, 0, p.regularTarget) : null,
    vo2: isNum(vo2) ? linmap(vo2, p.vo2Low, p.vo2High) : null,
  };
  const value = weightedMean([
    [parts.rhr, p.wRhr],
    [parts.hrv, p.wHrv],
    [parts.active, p.wActive],
    [parts.regular, p.wRegular],
    [parts.vo2, p.wVo2],
  ]);
  return { value, parts };
}

export const ewmaAlpha = (halfLife) => 1 - 2 ** (-1 / halfLife);

/** Tagesform aus den letzten drei Tagen Recovery und Schlaf plus Balance und Fitness. */
export function formScore({ r = [], s = [], balance = null, fitness = null }, p) {
  const lag = [p.lag0, p.lag1, p.lag2];
  const rEff = weightedMean(r.map((v, i) => [v, lag[i]]));
  const sEff = weightedMean(s.map((v, i) => [v, lag[i]]));
  // Ohne Recovery für den Tag (z. B. in den ersten Nächten ohne Baseline) gibt es keine Tagesform.
  if (!isNum(r[0])) return { score: null, rEff, sEff };
  const score = weightedMean([
    [rEff, p.wR],
    [sEff, p.wS],
    [balance, p.wB],
    [fitness, p.wF],
  ]);
  return { score, rEff, sEff };
}
