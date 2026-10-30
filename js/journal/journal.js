// Logbuch: was über den Tag passiert. Mengen (Wasser, Koffein, Sport) sind einzelne Einträge mit Uhrzeit,
// Tageswerte (Glück, Arbeitsstunden, Tagebuch) sind Felder.
//
// Ein Tag ist ein Datensatz { e: { id: Eintrag }, x: { id: Löschzeit }, f: { Name: { v, u } } }.
//   Eintrag: { type: 'water' | 'caffeine' | 'sport', at: 'HH:MM', u: Änderungszeit, ...Menge }
//     water: { ml }   caffeine: { kind, mg }   sport: { kind, min, rpe? }
//   Felder: happy (0–10), work (Stunden), text (Tagebuch), noCaffeine (true = heute bewusst keins)
// Zwei Geräte dürfen gleichzeitig eintragen: Einträge werden vereinigt, Gelöschtes bleibt gelöscht,
// bei Feldern gilt die zuletzt gespeicherte Angabe.
//
// Ein Logbuch-Tag beginnt um 4 Uhr: Was du nach Mitternacht einträgst, zählt noch zum Vortag
// und bekommt Uhrzeiten wie „24:30“, damit „zuletzt“ und „spät“ richtig rechnen.

import { HOUR, dateKey, hmToMinutes } from '../core/time.js';

export const DAY_START_HOUR = 4;

// Mengen nach dem Bundesinstitut für Risikobewertung (BfR), wo es einen Richtwert gibt; sonst Startwerte zum Anpassen
export const CAFFEINE_KINDS = [
  { id: 'kaffee', label: 'Kaffee', mg: 90, source: 'kaffee', note: 'Tasse, 200 ml · 90 mg laut BfR' },
  { id: 'espresso', label: 'Espresso', mg: 80, source: 'kaffee', note: '60 ml · 80 mg laut BfR' },
  { id: 'milchkaffee', label: 'Cappuccino, Latte', mg: 80, source: 'kaffee', note: 'mit einem Espresso, also etwa 80 mg' },
  { id: 'schwarztee', label: 'Schwarztee', mg: 45, source: 'tee', note: 'Tasse, 200 ml · 45 mg laut BfR' },
  { id: 'gruentee', label: 'Grüntee', mg: 30, source: 'tee', note: 'Tasse, 200 ml · 30 mg laut BfR' },
  { id: 'cola', label: 'Cola', mg: 35, source: null, note: 'Dose, 330 ml · 35 mg laut BfR' },
  { id: 'energy', label: 'Energydrink', mg: 80, source: 'energy', note: 'Dose, 250 ml · 80 mg laut BfR' },
  { id: 'preworkout', label: 'Pre-Workout', mg: 200, source: 'preworkout', note: 'Startwert 200 mg; Menge laut Etikett anpassen' },
  { id: 'andere', label: 'Anderes', mg: 50, source: null, note: 'Startwert 50 mg; Menge anpassen' },
];

export const SPORT_KINDS = [
  { id: 'kraft', label: 'Kraft', training: true },
  { id: 'ausdauer', label: 'Ausdauer', training: true },
  { id: 'hiit', label: 'HIIT', training: true },
  { id: 'team', label: 'Teamsport', training: true },
  { id: 'mobility', label: 'Mobility, Yoga', training: true },
  { id: 'gehen', label: 'Spaziergang', training: false },
  { id: 'andere', label: 'Anderes', training: true },
];

export const CAFFEINE_BY_ID = Object.fromEntries(CAFFEINE_KINDS.map((k) => [k.id, k]));
export const SPORT_BY_ID = Object.fromEntries(SPORT_KINDS.map((k) => [k.id, k]));

// Richtwerte (Quellen in norms/references.js)
export const CAFFEINE_DAY_MAX = 400; // EFSA: bis 400 mg über den Tag
export const CAFFEINE_SINGLE_MAX = 200; // EFSA: bis 200 mg auf einmal
export const WORK_DAY_MAX = 8; // ArbZG § 3: acht Stunden je Werktag

const isNum = (x) => typeof x === 'number' && Number.isFinite(x);
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const pad = (n) => String(n).padStart(2, '0');

const stable = (v) => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : 1))) : x));

// ---------- Tag und Uhrzeit ----------

/** Datumsschlüssel des laufenden Logbuch-Tags (bis 4 Uhr früh noch der Vortag). */
export function journalToday(now = Date.now()) {
  return dateKey(now - DAY_START_HOUR * HOUR);
}

/** Uhrzeit eines Zeitpunkts im Logbuch-Tag; nach Mitternacht als 24:xx bis 27:59. */
export function atOf(now = Date.now()) {
  const d = new Date(now);
  let m = d.getHours() * 60 + d.getMinutes();
  if (d.getHours() < DAY_START_HOUR) m += 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

/** Uhrzeit fürs Anzeigen: 24:30 wird wieder 00:30. */
export function clockOf(at) {
  const m = hmToMinutes(at);
  if (m == null) return '–';
  const n = m % 1440;
  return `${pad(Math.floor(n / 60))}:${pad(n % 60)}`;
}

/** Aus einer Eingabe im Zeitfeld (00:00–23:59) die Logbuch-Uhrzeit machen (00:00–03:59 zählen als 24:00–27:59). */
export function atFromInput(hm) {
  const m = hmToMinutes(hm);
  if (m == null) return null;
  const v = m < DAY_START_HOUR * 60 ? m + 1440 : m;
  return `${pad(Math.floor(v / 60))}:${pad(v % 60)}`;
}

// ---------- Datensatz bearbeiten (immer als neue Kopie) ----------

export function emptyDay() {
  return { e: {}, x: {}, f: {} };
}

function copy(rec) {
  return { e: { ...(rec?.e || {}) }, x: { ...(rec?.x || {}) }, f: { ...(rec?.f || {}) } };
}

export function newId() {
  const b = new Uint8Array(8);
  globalThis.crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

/** Neuer Eintrag; gibt { rec, id } zurück. */
export function addEntry(rec, entry, now = Date.now()) {
  const out = copy(rec);
  const id = newId();
  const { id: _ignore, ...rest } = entry;
  out.e[id] = { ...rest, u: now };
  return { rec: out, id };
}

export function updateEntry(rec, id, patch, now = Date.now()) {
  const out = copy(rec);
  if (!out.e[id]) return out;
  const next = { ...out.e[id], ...patch, u: now };
  for (const [k, v] of Object.entries(next)) if (v === undefined) delete next[k];
  out.e[id] = next;
  return out;
}

export function removeEntry(rec, id, now = Date.now()) {
  const out = copy(rec);
  delete out.e[id];
  out.x[id] = now;
  return out;
}

/** Holt einen gelöschten Eintrag zurück (Rückgängig direkt nach dem Löschen): als neuer Eintrag. */
export function restoreEntry(rec, entry, now = Date.now()) {
  const { id: _old, u: _u, ...rest } = entry;
  return addEntry(rec, rest, now);
}

export function setField(rec, name, value, now = Date.now()) {
  const out = copy(rec);
  out.f[name] = { v: value === undefined ? null : value, u: now };
  return out;
}

export function fieldValue(rec, name) {
  const v = rec?.f?.[name]?.v;
  return v === undefined ? null : v;
}

/** Einträge einer Art, nach Uhrzeit sortiert. */
export function entriesOf(rec, type) {
  if (!rec?.e) return [];
  const gone = rec.x || {};
  return Object.entries(rec.e)
    .filter(([id, x]) => x && x.type === type && !has(gone, id))
    .map(([id, x]) => ({ ...x, id }))
    .sort((a, b) => (hmToMinutes(a.at) ?? 0) - (hmToMinutes(b.at) ?? 0) || (a.u || 0) - (b.u || 0));
}

export function isEmptyDay(rec) {
  if (!rec) return true;
  if (['water', 'caffeine', 'sport'].some((t) => entriesOf(rec, t).length)) return false;
  return !['happy', 'work', 'text', 'noCaffeine'].some((k) => {
    const v = fieldValue(rec, k);
    return v !== null && v !== '' && v !== false;
  });
}

// ---------- Zusammenführen zweier Geräte ----------

function newer(x, cur) {
  if (!cur) return true;
  const a = x?.u || 0;
  const b = cur?.u || 0;
  if (a !== b) return a > b;
  return stable(x) > stable(cur); // gleiche Zeit: feste Reihenfolge, damit beide Geräte dasselbe Ergebnis haben
}

/** Vereinigt zwei Stände desselben Tages. Kommutativ und idempotent. */
export function mergeJournal(a, b) {
  if (!a && !b) return a ?? b;
  const out = emptyDay();
  for (const src of [a?.x || {}, b?.x || {}]) for (const [id, t] of Object.entries(src)) out.x[id] = Math.max(out.x[id] || 0, t || 0);
  for (const src of [a?.e || {}, b?.e || {}]) {
    for (const [id, x] of Object.entries(src)) {
      if (has(out.x, id)) continue;
      if (newer(x, out.e[id])) out.e[id] = x;
    }
  }
  for (const src of [a?.f || {}, b?.f || {}]) for (const [k, x] of Object.entries(src)) if (newer(x, out.f[k])) out.f[k] = x;
  return out;
}

// ---------- Auswertung eines Tages ----------

export function sum(list, key) {
  return list.reduce((s, x) => s + (isNum(x[key]) ? x[key] : 0), 0);
}

/** Tageswerte fürs Modell und die Anzeige; null-Felder bedeuten „nicht eingetragen“. */
export function daySummary(rec) {
  if (!rec) return null;
  const water = entriesOf(rec, 'water');
  const caf = entriesOf(rec, 'caffeine');
  const sport = entriesOf(rec, 'sport');
  const happy = fieldValue(rec, 'happy');
  const work = fieldValue(rec, 'work');
  const text = fieldValue(rec, 'text');
  const noCaf = fieldValue(rec, 'noCaffeine') === true;
  return {
    waterMl: water.length ? sum(water, 'ml') : null,
    waterN: water.length,
    caffeineN: caf.length ? caf.length : noCaf ? 0 : null,
    caffeineMg: caf.length ? sum(caf, 'mg') : noCaf ? 0 : null,
    caffeineLast: caf.length ? caf[caf.length - 1].at : null,
    sportMin: sport.length ? sum(sport, 'min') : null,
    sportN: sport.length,
    happy: isNum(happy) ? happy : null,
    work: isNum(work) ? work : null,
    text: typeof text === 'string' && text.trim() ? text : null,
  };
}

export function waterBucket(ml) {
  return ml < 1500 ? 'lt15' : ml <= 2500 ? '15-25' : 'gt25';
}

const localMinutes = (ms) => {
  const d = new Date(ms);
  return d.getHours() * 60 + d.getMinutes();
};

function sameKind(a, b) {
  if (a === b || a === 'andere' || b === 'andere') return true;
  const walkish = new Set(['gehen', 'ausdauer']);
  return walkish.has(a) && walkish.has(b);
}

/**
 * Trainingseinheiten eines Tages aus Apple Health und dem Logbuch. Ein Logbuch-Eintrag, der zeitlich zu einem
 * gemessenen Workout derselben Art passt (bis 30 Minuten daneben), gilt als dieselbe Einheit: Dauer aus der
 * Messung, Anstrengung aus dem Logbuch.
 */
export function sportSessions(rec, workouts = []) {
  const sessions = (workouts || []).map((w) => {
    const start = localMinutes(w.t);
    return { kind: w.kind || 'andere', min: w.durMin || 0, start, end: start + (w.durMin || 0), rpe: null, avgHr: w.avgHr ?? null, src: 'health' };
  });
  for (const m of entriesOf(rec, 'sport')) {
    const start = hmToMinutes(m.at);
    const local = start == null ? null : start % 1440;
    const match = sessions.find((s) => s.src === 'health' && !s.matched && sameKind(s.kind, m.kind) && local != null && local >= s.start - 30 && local <= s.end + 30);
    if (match) {
      match.matched = true;
      match.id = m.id;
      if (isNum(m.rpe)) match.rpe = m.rpe;
      continue;
    }
    sessions.push({ kind: m.kind || 'andere', min: m.min || 0, rpe: isNum(m.rpe) ? m.rpe : null, src: 'journal', id: m.id, at: m.at });
  }
  return sessions;
}

const isTraining = (kind) => SPORT_BY_ID[kind]?.training !== false;

/**
 * Antworten des Abendchecks, die das Logbuch schon beantwortet. Es gilt: Sobald etwas im Logbuch steht,
 * zählt der Logbuch-Wert (genauer als die grobe Frage). answers: abgeleitete Antworten, covered: Fragen,
 * die der Abendcheck an diesem Tag nicht mehr stellt.
 */
export function journalAnswers(rec, workouts = []) {
  const answers = {};
  const covered = new Set();
  if (!rec) return { answers, covered };
  const water = entriesOf(rec, 'water');
  if (water.length) {
    answers.A6 = waterBucket(sum(water, 'ml'));
    covered.add('A6');
  }
  const caf = entriesOf(rec, 'caffeine');
  if (caf.length) {
    answers.A4 = caf.length;
    answers.A4t = caf[caf.length - 1].at;
    const src = [...new Set(caf.map((x) => CAFFEINE_BY_ID[x.kind]?.source).filter(Boolean))];
    if (src.length) answers.E9 = src;
  } else if (fieldValue(rec, 'noCaffeine') === true) {
    answers.A4 = 0;
  }
  if (answers.A4 !== undefined) for (const id of ['A4', 'A4t', 'E9']) covered.add(id);

  const manual = entriesOf(rec, 'sport').filter((x) => isTraining(x.kind));
  if (manual.length) {
    const sessions = sportSessions(rec, workouts).filter((s) => isTraining(s.kind));
    answers.A7 = true;
    answers.T1 = [...new Set(sessions.map((s) => (s.kind === 'gehen' ? 'ausdauer' : s.kind)))];
    answers.T13 = Math.max(5, Math.round(sum(sessions, 'min') / 5) * 5);
    const rated = sessions.filter((s) => isNum(s.rpe));
    const w = sum(rated, 'min');
    if (rated.length) answers.T2 = Math.round(w > 0 ? rated.reduce((s, x) => s + x.rpe * x.min, 0) / w : rated.reduce((s, x) => s + x.rpe, 0) / rated.length);
    for (const id of ['A7', 'T1', 'T13']) covered.add(id);
    if (answers.T2 !== undefined) covered.add('T2');
  }
  return { answers, covered };
}

/** Survey-Antworten eines Tages, ergänzt und überschrieben durch das Logbuch. */
export function withJournal(answers, rec, workouts) {
  const { answers: j } = journalAnswers(rec, workouts);
  return Object.keys(j).length ? { ...(answers || {}), ...j } : answers || {};
}

/**
 * Bewegung einer Woche nach WHO: Minuten moderat plus doppelt gezählte intensive Minuten, dazu Krafttage.
 * days: [{ rec, workouts }] je Tag der Woche; hrMax für die Einordnung gemessener Einheiten.
 */
export function weekActivity(days, hrMax = 190) {
  let moderate = 0;
  let vigorous = 0;
  let total = 0;
  let strengthDays = 0;
  for (const { rec, workouts } of days) {
    let strength = false;
    for (const s of sportSessions(rec, workouts)) {
      const min = s.min || 0;
      total += min;
      const hard = (isNum(s.rpe) && s.rpe >= 7) || s.kind === 'hiit' || (isNum(s.avgHr) && s.avgHr >= 0.7 * hrMax);
      if (hard) vigorous += min;
      else moderate += min;
      if (s.kind === 'kraft') strength = true;
    }
    if (strength) strengthDays++;
  }
  return { total, moderate, vigorous, equivalent: moderate + 2 * vigorous, strengthDays };
}
