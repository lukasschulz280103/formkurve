// Frühwarnungen aus dem Verlauf. Grundsätze aus dem Konzept „Frühwarnsystem für Formkurve“:
// Dauer statt Ausreißer, Störfaktoren aus dem Logbuch abziehen, ehrliche Wortwahl ohne Diagnose,
// und ohne genug Nächte Verlauf gar keine Warnung, die auf einer Baseline beruht.
import { isNum, median } from '../core/stats.js';
import { addDays } from '../core/time.js';
import { hasSymptom } from '../survey/catalog.js';

/** Die letzten n Tage bis einschließlich `today`, neueste zuerst. */
function lastDays(days, today, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const d = days.get(addDays(today, -i));
    if (d) out.push(d);
  }
  return out;
}

const valuesOf = (list, pick) => list.map(pick).filter(isNum);

/** Was an einer Nacht sonst schuld sein kann: Alkohol oder hartes Training am Tag davor. */
function disturbance(days, date, p) {
  const prev = days.get(addDays(date, -1));
  if (!prev) return null;
  if (prev.answers?.A3 === true) return 'Alkohol am Abend davor';
  if (isNum(prev.strain) && prev.strain >= p.hardStrain) return 'hartes Training am Tag davor';
  if (prev.excluded) return prev.excluded;
  return null;
}

/**
 * Beginnende Infektion: Ruhepuls und Atemfrequenz über, HRV unter der eigenen Baseline,
 * mindestens zwei der drei Werte, mehrere Nächte nacheinander.
 */
function infection(days, today, p) {
  const nights = [];
  for (let i = 0; i < p.nights; i++) {
    const date = addDays(today, -i);
    const d = days.get(date);
    // Ohne genug Nächte Verlauf gibt es keine Baseline und damit keine Warnung
    if (!d || (d.baselineDays || 0) < p.minBaselineDays) return null;
    const sig = [];
    if (isNum(d.z?.rhr) && d.z.rhr >= p.z) sig.push('Ruhepuls erhöht');
    if (isNum(d.z?.hrv) && d.z.hrv <= -p.z) sig.push('HRV gesenkt');
    if (isNum(d.z?.resp) && d.z.resp >= p.z) sig.push('Atemfrequenz erhöht');
    if (sig.length < 2) return null;
    nights.push({ date, sig, stoer: disturbance(days, date, p) });
  }
  const sig = [...new Set(nights.flatMap((n) => n.sig))];
  const symptom = nights.some((n) => hasSymptom(days.get(n.date)?.answers || {}));
  const stoer = nights.map((n) => n.stoer).find(Boolean) || null;
  // Mit erklärbarer Ursache bleibt es eine Beobachtung, keine Warnung
  const level = stoer && !symptom ? 'info' : 'warn';
  const text = [
    `${sig.join(', ')} – und das ${nights.length} Nächte nacheinander.`,
    symptom ? 'Dein Morgencheck meldet dazu ein Krankheitsgefühl.' : null,
    stoer ? `Das kann auch an ${stoer} liegen.` : 'So sieht es oft aus, bevor ein Infekt spürbar wird.',
  ].filter(Boolean).join(' ');
  return {
    id: 'infekt',
    level,
    title: level === 'warn' ? 'Deine Nachtwerte sehen nach beginnendem Infekt aus' : 'Nachtwerte auffällig, aber erklärbar',
    text,
    advice: level === 'warn'
      ? 'Schone dich und halte das Training locker. Bei Fieber, Atemnot oder wenn es länger als drei bis fünf Tage so bleibt, geh zum Hausarzt.'
      : 'Beobachte die nächsten Nächte. Bleibt es ohne erkennbaren Grund so, melde ich mich wieder.',
  };
}

/** Dauerhaft erhöhter Ruhepuls: hoher Wochenmedian oder ein deutlicher Anstieg über Wochen. */
function restingHeartRate(days, today, p) {
  const week = valuesOf(lastDays(days, today, 7), (d) => d.rhr);
  if (week.length >= 5) {
    const m = median(week);
    if (m > p.rhrAbs) {
      return {
        id: 'rhr',
        level: 'warn',
        title: 'Dein Ruhepuls liegt die ganze Woche hoch',
        text: `Im Mittel ${Math.round(m)} bpm in den letzten ${week.length} Nächten. Dauerhaft über ${p.rhrAbs} bpm im Ruhezustand ist auffällig.`,
        advice: 'Lass das beim Hausarzt abklären: Blutdruck, Schilddrüse und Blutbild sind die üblichen ersten Schritte.',
      };
    }
  }
  const recent = valuesOf(lastDays(days, today, 14), (d) => d.rhr);
  const base = valuesOf(lastDays(days, addDays(today, -14), 90), (d) => d.rhr);
  if (recent.length >= 10 && base.length >= 30) {
    const up = median(recent) - median(base);
    if (up >= p.rhrRise) {
      return {
        id: 'rhr',
        level: 'warn',
        title: 'Dein Ruhepuls ist über Wochen gestiegen',
        text: `Die letzten zwei Wochen liegen im Mittel ${Math.round(up)} bpm über deinen Monaten davor (${Math.round(median(recent))} statt ${Math.round(median(base))} bpm).`,
        advice: 'Wenn du keinen Grund kennst (Training, Stress, Krankheit, neues Medikament), sprich mit dem Hausarzt.',
      };
    }
  }
  return null;
}

/** Niedriger Sauerstoff im Schlaf, nur bei Wiederholung: Handgelenk-Sensoren messen ungenau. */
function oxygen(days, today, p) {
  const nights = lastDays(days, today, 7).filter((d) => isNum(d.spo2Med));
  if (nights.length < 5) return null;
  const low = nights.filter((d) => d.spo2Med < p.spo2Min);
  if (low.length < p.spo2Nights) return null;
  return {
    id: 'spo2',
    level: 'warn',
    title: 'Dein Blutsauerstoff war mehrfach nachts niedrig',
    text: `In ${low.length} von ${nights.length} Nächten lag der Median unter ${p.spo2Min} %, zuletzt ${Math.round(low[0].spo2Med)} %. Einzelne Ausreißer sind meist Messfehler, mehrere Nächte sind es seltener.`,
    advice: 'Lass das beim Hausarzt oder in der Schlafmedizin abklären, auch mit Blick auf eine Schlafapnoe.',
  };
}

/** Chronisch kurzer Schlaf: mehrere Wochen hintereinander zu wenig. */
function shortSleep(days, today, p) {
  const weeks = [];
  for (let w = 0; w < p.sleepWeeks; w++) {
    const nights = lastDays(days, addDays(today, -7 * w), 7).filter((d) => d.sleep);
    if (nights.length < 5) return null;
    const short = nights.filter((d) => d.sleep.asleepMin < p.sleepH * 60).length;
    if (short < p.sleepNights) return null;
    weeks.push(short);
  }
  return {
    id: 'schlaf',
    level: 'warn',
    title: `Du schläfst seit ${p.sleepWeeks} Wochen zu kurz`,
    text: `In jeder der letzten ${p.sleepWeeks} Wochen lagen mindestens ${p.sleepNights} Nächte unter ${p.sleepH} Stunden (zuletzt ${weeks[0]} von 7). Dauerhafter Schlafmangel wirkt auf Herz, Stoffwechsel und Stimmung.`,
    advice: 'Feste Zeiten, dunkles kühles Zimmer, kein Koffein ab dem Nachmittag. Ändert das nichts, sprich mit dem Hausarzt: Ein- und Durchschlafstörungen gelten ab drei Nächten pro Woche über drei Monate als behandlungswürdig.',
  };
}

/** Anhaltend gedrückte Stimmung aus dem Logbuch. Bewusst zurückhaltend formuliert. */
function mood(days, today, p) {
  const list = lastDays(days, today, 14).filter((d) => isNum(d.journal?.happy));
  if (list.length < p.moodDays) return null;
  const low = list.filter((d) => d.journal.happy <= p.moodMax);
  if (low.length < p.moodDays) return null;
  return {
    id: 'stimmung',
    level: 'info',
    title: 'Deine Stimmung liegt seit zwei Wochen niedrig',
    text: `An ${low.length} von ${list.length} Tagen hast du ${p.moodMax} oder weniger eingetragen. Das ist kein Befund, aber es hält länger an, als es sich gut anfühlt.`,
    advice: 'Wenn das so bleibt, ist ein Gespräch beim Hausarzt oder in einer psychotherapeutischen Sprechstunde ein guter nächster Schritt. Wenn du jemanden zum Reden brauchst: Telefonseelsorge 0800 111 0 111 oder 0800 111 0 222, rund um die Uhr und kostenlos.',
  };
}

const DETECTORS = [infection, restingHeartRate, oxygen, shortSleep, mood];

/**
 * Alle aktuell zutreffenden Warnungen, wichtigste zuerst.
 * `snoozed` sind Kennungen, die der Nutzer quittiert hat und die gerade pausieren.
 */
export function earlyWarnings({ days, today, settings, snoozed = [] }) {
  const p = settings.model.warn;
  if (!p) return [];
  const out = [];
  for (const fn of DETECTORS) {
    const w = fn(days, today, p);
    if (w && !snoozed.includes(w.id)) out.push(w);
  }
  return out.sort((a, b) => (a.level === b.level ? 0 : a.level === 'warn' ? -1 : 1));
}

/** Kennungen, deren Pause noch läuft. */
export function snoozedWarnings(meta, today) {
  const until = meta?.warnSnooze || {};
  return Object.keys(until).filter((id) => until[id] > today);
}

/** Neue Pausenliste, nachdem eine Warnung quittiert wurde. */
export function snoozeWarning(meta, id, today, days) {
  return { ...(meta?.warnSnooze || {}), [id]: addDays(today, days) };
}
