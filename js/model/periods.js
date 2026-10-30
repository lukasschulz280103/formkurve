// Tageswerte zu Wochen (ISO, Montag bis Sonntag) und Kalendermonaten zusammenfassen.
import { addDays, weekday, diffDays } from '../core/time.js';

const isNum = (x) => typeof x === 'number' && Number.isFinite(x);
const MONTHS = ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sep.', 'Okt.', 'Nov.', 'Dez.'];

/** Montag der Woche, in der der Tag liegt. */
export function weekStart(key) {
  const wd = weekday(key);
  return addDays(key, wd === 0 ? -6 : 1 - wd);
}

/** ISO-Kalenderwoche: { year, week }. Die Woche gehört zu dem Jahr, in dem ihr Donnerstag liegt. */
export function isoWeek(key) {
  const thursday = addDays(weekStart(key), 3);
  const year = Number(thursday.slice(0, 4));
  const week = Math.floor(diffDays(`${year}-01-01`, thursday) / 7) + 1;
  return { year, week };
}

export function monthStart(key) {
  return `${key.slice(0, 7)}-01`;
}

function monthEnd(start) {
  const y = Number(start.slice(0, 4));
  const m = Number(start.slice(5, 7));
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
  return addDays(next, -1);
}

const shortDate = (key) => `${Number(key.slice(8, 10))}.${Number(key.slice(5, 7))}.`;

/**
 * Durchschnitt eines Tageswerts je Woche oder Monat.
 * Rückgabe (älteste zuerst): { key, start, end, label, range, mean, min, max, n, days, partial }
 */
export function periodAverages(dates, days, { unit = 'week', field = 'form', count = 12, today }) {
  const end = today || dates[dates.length - 1];
  if (!end) return [];
  const startOf = unit === 'month' ? monthStart : weekStart;
  const groups = new Map();
  for (const d of dates) {
    if (d > end) continue;
    const v = days.get(d)?.[field];
    const s = startOf(d);
    if (!groups.has(s)) groups.set(s, []);
    if (isNum(v)) groups.get(s).push(v);
  }
  // Abschnitte ohne einen einzigen Wert am Anfang weglassen (z. B. vor der Kalibrierung)
  let starts = [...groups.keys()].sort();
  while (starts.length && !groups.get(starts[0]).length) starts = starts.slice(1);
  starts = starts.slice(-count);
  return starts.map((start) => {
    const vals = groups.get(start);
    const last = unit === 'month' ? monthEnd(start) : addDays(start, 6);
    const n = vals.length;
    let label;
    let range;
    if (unit === 'month') {
      const m = Number(start.slice(5, 7)) - 1;
      label = MONTHS[m];
      range = `${MONTHS[m]} ${start.slice(0, 4)}`;
    } else {
      const { week } = isoWeek(start);
      label = `KW ${week}`;
      range = `${shortDate(start)}–${shortDate(last)}`;
    }
    return {
      key: start,
      start,
      end: last,
      label,
      range,
      n,
      days: Math.min(diffDays(start, last), diffDays(start, end)) + 1,
      mean: n ? vals.reduce((s, x) => s + x, 0) / n : null,
      min: n ? Math.min(...vals) : null,
      max: n ? Math.max(...vals) : null,
      partial: last > end,
    };
  });
}

/** Aktueller und vorheriger Abschnitt für die Zusammenfassung über dem Diagramm. */
export function periodSummary(periods, minDays = 2) {
  const list = periods.filter((p) => p.mean != null);
  if (!list.length) return null;
  let current = list[list.length - 1];
  let prev = list[list.length - 2] || null;
  // Läuft der aktuelle Abschnitt erst seit einem Tag, zählt der letzte vollständige
  if (current.partial && current.n < minDays && prev) {
    current = prev;
    prev = list[list.length - 3] || null;
  }
  return { current, prev, delta: prev ? current.mean - prev.mean : null };
}
