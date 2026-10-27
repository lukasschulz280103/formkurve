// Steuerung der Umfrage: sichtbare Fragen, Vorbelegung, fortgeschriebene Antworten.
import { addDays, weekday, diffDays } from '../core/time.js';
import { QUESTIONS, MODULES, moduleActive, NONE, hasSymptom } from './catalog.js';

const STICKY_DAYS = 60;
const LAST_DAYS = 14;

export function recordOf(survey, date) {
  return survey.get(date) || { a: {}, ts: {}, backfilled: {} };
}

export function slotDone(survey, date, slot) {
  return Boolean(survey.get(date)?.ts?.[slot]);
}

function lookBack(survey, date, id, maxDays) {
  for (let i = 1; i <= maxDays; i++) {
    const d = addDays(date, -i);
    const v = survey.get(d)?.a?.[id];
    if (v !== undefined && v !== null && v !== '') return { value: v, date: d };
  }
  return null;
}

/** Vorbelegung für eine Frage (nur Anzeige, gilt erst nach dem Speichern als Antwort). */
export function prefillValue(q, date, survey, day) {
  if (q.prefill === 'sticky') return lookBack(survey, date, q.id, STICKY_DAYS)?.value;
  if (q.prefill === 'last') return lookBack(survey, date, q.id, LAST_DAYS)?.value;
  if (q.prefill === 'workout') {
    const w = day?.workouts || [];
    if (!w.length) return undefined;
    if (q.id === 'A7') return true;
    if (q.id === 'T13') return Math.round(w.reduce((s, x) => s + (x.durMin || 0), 0) / 5) * 5;
    if (q.id === 'T1') {
      const kinds = [...new Set(w.map((x) => (x.kind === 'andere' ? 'andere' : x.kind)))];
      return kinds.length ? kinds : undefined;
    }
  }
  return undefined;
}

/** Antworten eines Tages inkl. fortgeschriebener "gilt bis zur Änderung"-Antworten. */
export function effectiveAnswers(survey, date) {
  const own = survey.get(date)?.a || {};
  const out = { ...own };
  for (const q of QUESTIONS) {
    if (q.prefill !== 'sticky' || out[q.id] !== undefined) continue;
    const prev = lookBack(survey, date, q.id, STICKY_DAYS);
    if (prev) out[q.id] = prev.value;
  }
  return out;
}

/** Fragen, die im Check sichtbar sind, gruppiert nach Modul. extraModules = manuell geöffnet. */
export function visibleSections(slot, answers, { date, settings, extraModules = [] }) {
  const ctx = { answers, weekday: weekday(date), settings };
  const sections = [];
  for (const [key, mod] of Object.entries(MODULES)) {
    if (mod.slot !== slot) continue;
    const active = moduleActive(key, ctx) || extraModules.includes(key);
    if (!active) continue;
    const qs = QUESTIONS.filter((q) => q.mod === key && (!q.when || q.when(answers, ctx)));
    if (qs.length) sections.push({ key, title: mod.title, hint: mod.hint, core: Boolean(mod.core), questions: qs });
  }
  return sections;
}

/** Module, die man in diesem Slot zusätzlich öffnen kann. */
export function optionalModules(slot, answers, { date, settings }) {
  const ctx = { answers, weekday: weekday(date), settings };
  return Object.entries(MODULES)
    .filter(([key, mod]) => mod.slot === slot && !mod.core && !moduleActive(key, ctx))
    .map(([key, mod]) => ({ key, title: mod.title }));
}

export function isAnswered(v) {
  if (v === undefined || v === null || v === '') return false;
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

/** Krank oder Ausnahmetag: zählt nicht zur Baseline. */
export function exclusionReason(survey, date) {
  const today = survey.get(date)?.a || {};
  const prev = survey.get(addDays(date, -1))?.a || {};
  if (hasSymptom(today)) return 'krank';
  if (Array.isArray(prev.A12) && prev.A12.includes('reise')) return 'Reise';
  if (Array.isArray(prev.A12) && prev.A12.includes('impfung')) return 'Impfung';
  const prev2 = survey.get(addDays(date, -2))?.a || {};
  if (Array.isArray(prev2.A12) && prev2.A12.includes('impfung')) return 'Impfung';
  return null;
}

export function backfillAllowed(date, today, settings) {
  const d = diffDays(date, today);
  return d >= 0 && d <= (settings?.survey?.backfillDays ?? 3);
}

/** Subjektiver Wert für die Recovery aus dem Morgencheck (-3 bis +3) oder null. */
export function subjectiveZ(answers) {
  if (!answers) return null;
  if (hasSymptom(answers)) return -3;
  const parts = [];
  if (typeof answers.M1 === 'number') parts.push(answers.M1 - 3);
  if (typeof answers.M2 === 'number') parts.push(answers.M2 - 3);
  if (typeof answers.M3 === 'number') parts.push((-answers.M3 * 2) / 3);
  if (!parts.length) return null;
  const m = parts.reduce((s, x) => s + x, 0) / parts.length;
  return Math.max(-3, Math.min(3, m));
}

/** Kraft-Anteil und Trainingsangaben aus dem Abendcheck. */
export function trainingFromSurvey(answers) {
  if (!answers || answers.A7 !== true) return null;
  const kinds = Array.isArray(answers.T1) ? answers.T1.filter((k) => k !== NONE) : [];
  const relevant = kinds.filter((k) => k !== 'mobility');
  const strengthShare = kinds.includes('kraft') ? 1 / Math.max(1, relevant.length) : 0;
  return {
    kinds,
    durMin: typeof answers.T13 === 'number' ? answers.T13 : null,
    rpe: typeof answers.T2 === 'number' ? answers.T2 : null,
    strengthShare,
  };
}

export function countAnswered(record) {
  return Object.values(record?.a || {}).filter(isAnswered).length;
}
