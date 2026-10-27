// Datums- und Zeitfunktionen. Ein Tag wird als lokaler Schlüssel "YYYY-MM-DD" geführt.
export const MIN = 60000;
export const HOUR = 3600000;
export const DAY = 86400000;

const pad = (n) => String(n).padStart(2, '0');

export function dateKey(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayKey(now = Date.now()) {
  return dateKey(now);
}

export function keyToLocalDate(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Lokale Mitternacht des Tages in ms. */
export function dayStart(key) {
  return keyToLocalDate(key).getTime();
}

export function addDays(key, n) {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export function dayEnd(key) {
  return dayStart(addDays(key, 1));
}

/** Anzahl Tage von a nach b (b - a). */
export function diffDays(a, b) {
  const [y1, m1, d1] = a.split('-').map(Number);
  const [y2, m2, d2] = b.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / DAY);
}

export function rangeKeys(from, to) {
  const out = [];
  if (!from || !to || from > to) return out;
  for (let k = from; k <= to; k = addDays(k, 1)) out.push(k);
  return out;
}

/** 0 = Sonntag ... 6 = Samstag */
export function weekday(key) {
  return keyToLocalDate(key).getDay();
}

/** Uhrzeit als Minuten, um Mitternacht zentriert (22:30 -> -90, 01:00 -> 60). */
export function clockMinutesCentered(ms) {
  const d = new Date(ms);
  let t = d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
  if (t >= 12 * 60) t -= 24 * 60;
  return t;
}

/** "HH:MM" -> Minuten seit Mitternacht */
export function hmToMinutes(hm) {
  if (typeof hm !== 'string') return null;
  const m = hm.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function minutesToHm(min) {
  if (min == null || !Number.isFinite(min)) return '';
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

const MONTHS = {
  jan: 1, januar: 1, january: 1, feb: 2, februar: 2, february: 2, mär: 3, märz: 3, mrz: 3, maerz: 3, mar: 3, march: 3,
  apr: 4, april: 4, mai: 5, may: 5, jun: 6, juni: 6, june: 6, jul: 7, juli: 7, july: 7, aug: 8, august: 8,
  sep: 9, sept: 9, september: 9, okt: 10, oct: 10, oktober: 10, october: 10, nov: 11, november: 11,
  dez: 12, dec: 12, dezember: 12, december: 12,
};

/**
 * Liest Zeitangaben in den Formaten, die Apple Health, der Kurzbefehl (ISO 8601 oder
 * deutsches/englisches Standardformat) und Unix-Zeitstempel liefern. Gibt ms oder NaN zurück.
 */
export function parseLooseDate(input) {
  if (input == null) return NaN;
  if (typeof input === 'number') return input < 1e11 ? input * 1000 : input;
  const s = String(input).trim();
  if (!s) return NaN;
  if (/^\d{9,13}(\.\d+)?$/.test(s)) {
    const n = Number(s);
    return n < 1e11 ? n * 1000 : n;
  }
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2})(?:[.,](\d+))?)?)?\s*(Z|[+-]\d{2}:?\d{2})?$/);
  if (m) {
    const [, y, mo, d, h = '0', mi = '0', se = '0', frac = '0', tz] = m;
    const ms = Math.round(Number('0.' + frac) * 1000);
    if (tz) {
      let off = 0;
      if (tz !== 'Z') {
        const sign = tz[0] === '-' ? -1 : 1;
        const t = tz.slice(1).replace(':', '');
        off = sign * (Number(t.slice(0, 2)) * 60 + Number(t.slice(2, 4)));
      }
      return Date.UTC(+y, +mo - 1, +d, +h, +mi, +se, ms) - off * MIN;
    }
    return new Date(+y, +mo - 1, +d, +h, +mi, +se, ms).getTime();
  }
  m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4}),?\s*(?:um\s*)?(\d{1,2}):(\d{2})(?::(\d{2}))?/i);
  if (m) {
    let y = +m[3];
    if (y < 100) y += 2000;
    return new Date(y, +m[2] - 1, +m[1], +m[4], +m[5], +(m[6] || 0)).getTime();
  }
  m = s.match(/^(\d{1,2})\.?\s*([A-Za-zÄäÖöÜü]+)\.?\s*(\d{4}),?\s*(?:um|at)?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?/i);
  if (m) {
    const mo = MONTHS[m[2].toLowerCase()];
    if (mo) return new Date(+m[3], mo - 1, +m[1], +m[4], +m[5], +(m[6] || 0)).getTime();
  }
  m = s.match(/^([A-Za-z]+)\.?\s+(\d{1,2}),?\s+(\d{4}),?\s*(?:at)?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i);
  if (m) {
    const mo = MONTHS[m[1].toLowerCase()];
    if (mo) {
      let h = +m[4];
      const ap = (m[7] || '').toUpperCase();
      if (ap === 'PM' && h < 12) h += 12;
      if (ap === 'AM' && h === 12) h = 0;
      return new Date(+m[3], mo - 1, +m[2], h, +m[5], +(m[6] || 0)).getTime();
    }
  }
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : NaN;
}
