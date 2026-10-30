// Steuerung der Umfrage: Kern- und optionale Fragen, Vorbelegung, fortgeschriebene Antworten.
import { addDays, weekday, diffDays } from '../core/time.js';
import { QUESTIONS, MODULES, moduleAvailable, moduleBoost, NONE, hasSymptom } from './catalog.js';
import { recentSupplements } from './supplements.js';

const STICKY_DAYS = 60;
const LAST_DAYS = 14;

/** Wie viele optionale Fragen direkt sichtbar sind, je nach Einstellung „Umfang“. */
export const DEPTH = { kurz: 0, standard: 3, ausfuehrlich: Infinity };

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

/** Entfernt Werte, die es als Antwortmöglichkeit nicht mehr gibt (Katalog hat sich geändert). */
function keepValid(q, v) {
  if (v === undefined || !q.options) return v;
  const ok = new Set(q.options.map((x) => x.v));
  if (Array.isArray(v)) {
    const kept = v.filter((x) => ok.has(x));
    return kept.length ? kept : undefined;
  }
  return ok.has(v) ? v : undefined;
}

/** Vorbelegung für eine Frage (nur Anzeige, gilt erst nach dem Speichern als Antwort). */
export function prefillValue(q, date, survey, day) {
  if (q.prefill === 'sticky') return keepValid(q, lookBack(survey, date, q.id, STICKY_DAYS)?.value);
  if (q.prefill === 'last') return keepValid(q, lookBack(survey, date, q.id, LAST_DAYS)?.value);
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
  // Alte Supplement-Antworten (Ernährungsmodul bis Version 0.2) galten fort, solange es keine neue Antwort gibt
  if (out.SUP === undefined) {
    if (lookBack(survey, date, 'SUP', STICKY_DAYS)) out.__noLegacySup = true;
    else if (out.E8 === undefined) {
      const prev = lookBack(survey, date, 'E8', STICKY_DAYS);
      if (prev) out.E8 = prev.value;
    }
  }
  return out;
}

function contextFor(answers, { date, settings, survey }) {
  return {
    answers,
    weekday: weekday(date),
    settings,
    recentSupplements: survey ? recentSupplements(survey, date, 14, addDays) : [],
  };
}

/**
 * Plan für einen Check: Kernfragen (immer sichtbar, Folgefragen direkt nach ihrer Ausgangsfrage) und
 * optionale Fragen nach Wichtigkeit sortiert. Bereiche, die heute vorgeschlagen sind, rücken nach vorn.
 * covered: Fragen, die das Logbuch an diesem Tag schon beantwortet; sie fallen weg.
 */
export function checkPlan(slot, answers, { date, settings, survey = null, covered = null }) {
  const ctx = contextFor(answers, { date, settings, survey });
  const shown = (q) => MODULES[q.mod]?.slot === slot && !covered?.has(q.id) && moduleAvailable(q.mod, ctx) && (!q.when || q.when(answers, ctx));
  const isCore = (q) => q.prio === 'core' || Boolean(q.coreWhen?.(answers, ctx));
  const visible = QUESTIONS.filter(shown);
  const coreQs = visible.filter(isCore);
  const coreIds = new Set(coreQs.map((q) => q.id));
  const core = [];
  for (const q of coreQs) {
    if (q.parent && coreIds.has(q.parent)) continue;
    core.push(q);
    for (const c of coreQs) if (c.parent === q.id) core.push(c);
  }
  const optional = visible
    .filter((q) => !isCore(q))
    .map((q) => {
      const boost = moduleBoost(q.mod, ctx);
      return { q, rank: (typeof q.prio === 'number' ? q.prio : 500) - boost, boosted: boost > 0 };
    })
    .sort((a, b) => a.rank - b.rank);
  return { core, optional };
}

/** Fragen dieses Zeitpunkts, die wegen ihrer Bedingung gerade nicht gelten (deren alte Antworten verfallen). */
export function hiddenByCondition(slot, answers, { date, settings, survey = null, covered = null }) {
  const ctx = contextFor(answers, { date, settings, survey });
  return QUESTIONS.filter((q) => MODULES[q.mod]?.slot === slot && !covered?.has(q.id) && q.when && !q.when(answers, ctx));
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

/** Ab dieser Stunde gilt der Morgencheck als offen (davor läuft noch die Nacht davor, wie im Logbuch). */
export const MORNING_FROM_HOUR = 4;
/** Ab dieser Stunde gilt der Abendcheck als offen. */
export const EVENING_FROM_HOUR = 18;

/**
 * Noch offene Checks im Nachtragefenster, der neueste zuerst: je Tag Morgen und Abend,
 * sobald der Zeitpunkt vorbei ist. `since` lässt Tage weg, an denen es das Konto noch nicht gab.
 */
export function pendingChecks(survey, { settings, today, now = new Date(), since = null } = {}) {
  const out = [];
  const back = settings?.survey?.backfillDays ?? 3;
  const h = now.getHours();
  for (let i = 0; i <= back; i++) {
    const date = addDays(today, -i);
    if (since && date < since) break;
    for (const slot of ['morning', 'evening']) {
      if (slotDone(survey, date, slot)) continue;
      // Heute zählt nur, was schon dran war
      if (date === today && h < (slot === 'morning' ? MORNING_FROM_HOUR : EVENING_FROM_HOUR)) continue;
      out.push({ date, slot });
    }
  }
  return out;
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
