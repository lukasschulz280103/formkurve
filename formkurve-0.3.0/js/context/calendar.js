// Kalenderkontext ohne Netz: bundesweite Feiertage in Deutschland und Mondalter.
import { addDays, keyToLocalDate } from '../core/time.js';

function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

const cache = new Map();

export function holidays(year) {
  if (cache.has(year)) return cache.get(year);
  const e = easterSunday(year);
  const set = new Set([
    `${year}-01-01`,
    addDays(e, -2),
    addDays(e, 1),
    `${year}-05-01`,
    addDays(e, 39),
    addDays(e, 50),
    `${year}-10-03`,
    `${year}-12-25`,
    `${year}-12-26`,
  ]);
  cache.set(year, set);
  return set;
}

export function isHoliday(key) {
  return holidays(Number(key.slice(0, 4))).has(key);
}

const SYNODIC = 29.530588853;
const NEW_MOON_REF = Date.UTC(2000, 0, 6, 18, 14);

/** Mondalter in Tagen (0 = Neumond, etwa 14,8 = Vollmond) für die Nacht nach dem Tag. */
export function moonAge(key) {
  const t = keyToLocalDate(key).getTime() + 23 * 3600000;
  const days = (t - NEW_MOON_REF) / 86400000;
  return ((days % SYNODIC) + SYNODIC) % SYNODIC;
}
