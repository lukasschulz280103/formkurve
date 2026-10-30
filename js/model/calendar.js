// Monatsraster für den Kalender auf „Heute“ und die Farbstufen, mit denen die Tage eingefärbt werden
// (eine Farbskala wie bei bedingter Formatierung in einer Tabelle).
import { addDays, weekday, diffDays } from '../core/time.js';

const isNum = (x) => typeof x === 'number' && Number.isFinite(x);

export const MONTH_NAMES = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
/** Montag zuerst, wie im Kalenderraster. */
export const WEEKDAYS_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

/** "2026-10-28" -> "2026-10" */
export const monthOf = (key) => key.slice(0, 7);

export function monthLabel(ym) {
  return `${MONTH_NAMES[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;
}

/** Nachbarmonat: n = -1 zurück, +1 vor. */
export function shiftMonth(ym, n) {
  const m = Number(ym.slice(5, 7)) - 1 + n;
  const year = Number(ym.slice(0, 4)) + Math.floor(m / 12);
  const month = ((m % 12) + 12) % 12;
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

export function monthFirst(ym) {
  return `${ym}-01`;
}

export function monthLast(ym) {
  return addDays(monthFirst(shiftMonth(ym, 1)), -1);
}

/**
 * Raster eines Monats: immer ganze Wochen von Montag bis Sonntag, also 28 bis 42 Felder.
 * Felder vor dem Ersten und nach dem Letzten tragen outside: true.
 */
export function monthGrid(ym) {
  const first = monthFirst(ym);
  const wd = weekday(first);
  const lead = wd === 0 ? 6 : wd - 1;
  const start = addDays(first, -lead);
  const weeks = Math.ceil((lead + diffDays(first, monthLast(ym)) + 1) / 7);
  const out = [];
  for (let i = 0; i < weeks * 7; i++) {
    const date = addDays(start, i);
    out.push({ date, day: Number(date.slice(8, 10)), weekend: [0, 6].includes(weekday(date)), outside: monthOf(date) !== ym });
  }
  return out;
}

/**
 * Farbstufe 0 bis 4 für einen Wert; edges sind vier aufsteigende Grenzen.
 * Ein Wert gehört in die erste Stufe, deren Grenze er nicht erreicht; ohne Wert gibt es keine Stufe.
 */
export function levelOf(value, edges) {
  if (!isNum(value)) return null;
  let i = 0;
  while (i < edges.length && value >= edges[i]) i++;
  return i;
}

/**
 * Grenzen für Werte, bei denen hoch gut ist: die Schwellen aus den Einstellungen (rot, grün)
 * und je eine Mitte darunter und darüber, damit alle fünf Stufen vorkommen.
 */
export function scoreEdges(red, green, max = 100) {
  return [red, (red + green) / 2, green, green + (max - green) / 2];
}

/** Durchschnitt, Anzahl, höchster und niedrigster Tag eines Monats. */
export function monthStats(ym, valueOf) {
  const last = monthLast(ym);
  let sum = 0;
  let n = 0;
  let best = null;
  let worst = null;
  for (let d = monthFirst(ym); d <= last; d = addDays(d, 1)) {
    const v = valueOf(d);
    if (!isNum(v)) continue;
    sum += v;
    n++;
    if (!best || v > best.value) best = { date: d, value: v };
    if (!worst || v < worst.value) worst = { date: d, value: v };
  }
  return { mean: n ? sum / n : null, n, best, worst };
}
