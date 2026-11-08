// Erkennt aus dem Puls, wann über längere Zeit Belastung war, und schätzt, was es war.
// Die Schätzung lernt mit: jeder bestätigte Eintrag verschiebt die Mittelwerte der Art,
// jedes „Kein Sport“ merkt sich die App, damit sie denselben Zeitraum nicht wieder fragt.
import { isNum, mean, median } from '../core/stats.js';
import { SPORTS, SPORT } from './sports.js';

const MIN = 60000;

/** Schlüssel eines Zeitraums, grob auf 5 Minuten gerundet – überlebt kleine Änderungen. */
export const sessionKey = (date, from) => `${date}T${Math.round(from / (5 * MIN))}`;

/**
 * Zusammenhängende Abschnitte mit erhöhtem Puls an einem Tag.
 * `known` sind bereits bekannte Trainings (gemessen oder eingetragen), die nicht noch
 * einmal gefragt werden. Schlafzeiten bleiben außen vor.
 */
export function findSessions({ index, date, rhr, hrMax, known = [], sleep = null, p }) {
  const hr = index.picked('hr', date);
  if (!hr || !hr.t?.length) return [];
  const floor = Math.max(rhr + p.overRhr, hrMax * p.ofMax);
  const n = hr.t.length;
  const runs = [];
  let cur = null;
  for (let i = 0; i < n; i++) {
    const t = hr.t[i];
    const e = Math.max(hr.e?.[i] ?? t, t);
    const v = hr.v[i];
    if (!isNum(v)) continue;
    if (v >= floor) {
      if (cur && t - cur.to <= p.gapMin * MIN) {
        cur.to = Math.max(cur.to, e);
        cur.vals.push(v);
        cur.ts.push(t);
      } else {
        if (cur) runs.push(cur);
        cur = { from: t, to: e, vals: [v], ts: [t] };
      }
    }
  }
  if (cur) runs.push(cur);

  const roh = [];
  for (const r of runs) {
    const durMin = (r.to - r.from) / MIN;
    if (durMin < p.minMin || r.vals.length < 3) continue;
    const avg = mean(r.vals);
    if (avg < floor) continue;
    // Schlaf und bereits bekannte Trainings überspringen
    if (sleep && r.from < sleep.wake && r.to > sleep.onset) continue;
    if (known.some((w) => r.from < w.to + p.nearMin * MIN && r.to > w.from - p.nearMin * MIN)) continue;
    const steps = stepsBetween(index, r.from, r.to);
    roh.push({
      key: sessionKey(date, r.from),
      date,
      from: r.from,
      to: r.to,
      durMin: Math.round(durMin),
      avgHr: Math.round(avg),
      maxHr: Math.round(Math.max(...r.vals)),
      floor: Math.round(floor),
      steps,
      spm: isNum(steps) ? steps / Math.max(1, durMin) : null,
      energy: sumBetween(index, 'energy', r.from, r.to),
      hour: new Date(r.from).getHours() + new Date(r.from).getMinutes() / 60,
      vals: r.vals,
    });
  }
  return mergeNear(roh, p);
}

/**
 * Abschnitte mit kurzer Pause dazwischen gehören meist zusammen: die Hantelbank,
 * dann zehn Minuten reden, dann weiter. Besser einmal fragen als zweimal.
 */
function mergeNear(list, p) {
  const out = [];
  for (const x of list) {
    const last = out[out.length - 1];
    if (last && x.from - last.to <= (p.mergeMin ?? 15) * MIN) {
      const vals = last.vals.concat(x.vals);
      last.pause = Math.round((last.pause || 0) + (x.from - last.to) / MIN);
      last.to = x.to;
      last.vals = vals;
      last.durMin = Math.round((last.to - last.from) / MIN);
      last.avgHr = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
      last.maxHr = Math.round(Math.max(...vals));
      last.steps = isNum(last.steps) && isNum(x.steps) ? last.steps + x.steps : last.steps ?? x.steps;
      last.energy = isNum(last.energy) && isNum(x.energy) ? last.energy + x.energy : last.energy ?? x.energy;
      last.spm = isNum(last.steps) ? last.steps / Math.max(1, last.durMin) : null;
      continue;
    }
    out.push({ ...x });
  }
  return out.map(({ vals, ...rest }) => rest);
}

/** Schritte im Zeitfenster. Stundenpakete werden anteilig gerechnet. */
export function stepsBetween(index, from, to) {
  const w = index.window('steps', from, to);
  if (!w.t.length) return null;
  let sum = 0;
  for (let i = 0; i < w.t.length; i++) {
    const a = w.t[i];
    const b = Math.max(w.e?.[i] ?? a, a + MIN);
    const overlap = Math.max(0, Math.min(b, to) - Math.max(a, from));
    const span = Math.max(MIN, b - a);
    sum += (w.v[i] || 0) * (overlap / span);
  }
  return Math.round(sum);
}

function sumBetween(index, type, from, to) {
  const w = index.window(type, from, to);
  if (!w.t.length) return null;
  let sum = 0;
  for (let i = 0; i < w.t.length; i++) {
    const a = w.t[i];
    const b = Math.max(w.e?.[i] ?? a, a + MIN);
    const overlap = Math.max(0, Math.min(b, to) - Math.max(a, from));
    sum += (w.v[i] || 0) * (overlap / Math.max(MIN, b - a));
  }
  return Math.round(sum);
}

// ---------------------------------------------------------------------------
// Das lernende Modell

/** Leeres Modell. `byId` sammelt je Sportart Mittelwerte aus den eigenen Einträgen. */
export const emptyModel = () => ({ v: 1, byId: {}, n: 0 });

const FIELDS = ['hr', 'dur', 'spm', 'hour'];

/**
 * Einen bestätigten Eintrag lernen. Die Mittelwerte wandern gleitend mit, damit sich
 * Gewohnheiten ändern dürfen; die Zahl der Einträge bestimmt, wie stark sie zählen.
 */
export function learn(model, id, f) {
  const m = { ...emptyModel(), ...model, byId: { ...(model?.byId || {}) } };
  const old = m.byId[id] || { n: 0 };
  const next = { n: old.n + 1 };
  const w = 1 / Math.min(old.n + 1, 10); // die letzten zehn Einträge prägen am stärksten
  for (const k of FIELDS) {
    if (!isNum(f[k])) {
      next[k] = old[k];
      continue;
    }
    next[k] = isNum(old[k]) ? old[k] + w * (f[k] - old[k]) : f[k];
  }
  m.byId[id] = next;
  m.n = (m.n || 0) + 1;
  return m;
}

/** Vergisst, was zu einer Art gelernt wurde. */
export function unlearn(model, id) {
  const byId = { ...(model?.byId || {}) };
  delete byId[id];
  return { ...emptyModel(), ...model, byId };
}

// Streuung je Merkmal: wie weit ein Wert danebenliegen darf, bevor er nicht mehr passt
const SPREAD = { hr: 18, dur: 35, spm: 45, hour: 4 };

/**
 * Schätzt, welche Sportart zu einem erkannten Abschnitt passt, von sicher nach unsicher.
 * Gelernte Werte verdrängen die Startwerte Schritt für Schritt: Nach zehn Einträgen
 * zählt nur noch, was der Nutzer selbst eingetragen hat.
 */
export function predict(model, f, opts = {}) {
  const byId = model?.byId || {};
  const scored = SPORTS.filter((s) => opts.includePrivate !== false || !s.private).map((s) => {
    const learned = byId[s.id];
    const trust = learned ? Math.min(1, learned.n / 10) : 0;
    let dist = 0;
    let used = 0;
    for (const k of FIELDS) {
      if (!isNum(f[k])) continue;
      const base = s[k];
      const ref = isNum(learned?.[k]) ? base + trust * (learned[k] - base) : base;
      if (!isNum(ref)) continue;
      let diff = Math.abs(f[k] - ref);
      if (k === 'hour') diff = Math.min(diff, 24 - diff);
      dist += (diff / SPREAD[k]) ** 2;
      used++;
    }
    if (!used) return { id: s.id, score: 0 };
    // Je näher an den typischen Werten, desto höher; eigene Einträge bekommen Rückenwind
    const score = Math.exp(-dist / used) * (1 + 0.35 * trust) * (1 + Math.min(0.3, (learned?.n || 0) * 0.03));
    return { id: s.id, score };
  });
  const sum = scored.reduce((a, x) => a + x.score, 0) || 1;
  return scored
    .map((x) => ({ ...x, p: x.score / sum }))
    .sort((a, b) => b.score - a.score);
}

/** Dauer, die der Nutzer für diese Art üblicherweise einträgt – sonst die erkannte. */
export function suggestedDuration(model, id, detectedMin) {
  const learned = model?.byId?.[id];
  if (!isNum(learned?.dur) || learned.n < 2) return detectedMin;
  // Zwischen Messung und Gewohnheit mitteln, die Messung zählt mehr
  return Math.round(0.65 * detectedMin + 0.35 * learned.dur);
}

/** Alles zusammen: erkennen, schätzen, Vorschlag bauen. */
export function sessionSuggestions({ index, date, rhr, hrMax, known, sleep, model, settings, skip = [] }) {
  const p = settings.model.detect;
  if (!p || p.on === false) return [];
  const found = findSessions({ index, date, rhr, hrMax, known, sleep, p });
  return found
    .filter((s) => !skip.includes(s.key))
    .map((s) => {
      const ranked = predict(model, s, { includePrivate: settings.survey?.askPrivate !== false });
      return { ...s, guess: ranked[0]?.id || 'andere', ranked: ranked.slice(0, 4), suggestMin: suggestedDuration(model, ranked[0]?.id, s.durMin) };
    });
}
