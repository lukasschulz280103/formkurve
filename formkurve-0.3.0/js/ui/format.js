// Deutsche Formatierung für Zahlen, Daten und Dauern.
import { keyToLocalDate, todayKey, addDays } from '../core/time.js';

const nf = (d) => new Intl.NumberFormat('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });
const NF = [nf(0), nf(1), nf(2)];

export function num(x, d = 0) {
  if (x == null || !Number.isFinite(x)) return '–';
  return NF[d].format(x);
}

export function signed(x, d = 0) {
  if (x == null || !Number.isFinite(x)) return '–';
  const s = NF[d].format(Math.abs(x));
  if (Math.abs(x) < 0.5 * 10 ** -d) return `±${NF[d].format(0)}`;
  return `${x > 0 ? '+' : '−'}${s}`;
}

export function hours(min) {
  if (min == null || !Number.isFinite(min)) return '–';
  const h = Math.floor(min / 60);
  const m = Math.round(min - h * 60);
  return m === 60 ? `${h + 1}:00 h` : `${h}:${String(m).padStart(2, '0')} h`;
}

export function clock(ms) {
  if (!ms) return '–';
  return new Date(ms).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

const fmtLong = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });
const fmtShort = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short' });
const fmtFull = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtDay = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'numeric' });

export function dayLabel(key, today = todayKey()) {
  if (key === today) return 'Heute';
  if (key === addDays(today, -1)) return 'Gestern';
  if (key === addDays(today, -2)) return 'Vorgestern';
  return fmtLong.format(keyToLocalDate(key));
}

export const dateShort = (key) => fmtShort.format(keyToLocalDate(key)).replace('.', '');
export const dateLong = (key) => fmtLong.format(keyToLocalDate(key));
export const dateFull = (key) => fmtFull.format(keyToLocalDate(key));
export const dateNumeric = (key) => fmtDay.format(keyToLocalDate(key));

export function ago(ms, now = Date.now()) {
  if (!ms) return 'nie';
  const min = Math.round((now - ms) / 60000);
  if (min < 2) return 'gerade eben';
  if (min < 60) return `vor ${min} min`;
  const h = Math.round(min / 60);
  if (h < 36) return `vor ${h} h`;
  return `vor ${Math.round(h / 24)} Tagen`;
}

export function mb(bytes) {
  return `${num(bytes / 1e6, bytes < 1e7 ? 1 : 0)} MB`;
}
