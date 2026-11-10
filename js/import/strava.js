// Strava-Export einlesen. Strava hat keine Schnittstelle, die eine Seite ohne eigenen
// Server nutzen könnte – wohl aber einen Datenexport: „Einstellungen → Mein Konto →
// Eine Kopie deiner Daten herunterladen“ liefert ein ZIP mit activities.csv.
// Daraus werden Trainings mit Art, Dauer, Puls, Energie und Strecke.
import { distanceKm, workoutKind } from '../data/normalize.js';

/** Zerlegt eine CSV-Zeile mit Anführungszeichen und Kommas im Text. */
export function csvRow(line) {
  const out = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') {
      out.push(cur);
      cur = '';
    } else cur += c;
  }
  out.push(cur);
  return out;
}

// Strava gibt die Kopfzeile je nach Sprache anders aus
const COLS = {
  date: ['activity date', 'datum der aktivität', 'aktivitätsdatum'],
  name: ['activity name', 'name der aktivität'],
  type: ['activity type', 'art der aktivität', 'aktivitätstyp'],
  elapsed: ['elapsed time', 'verstrichene zeit'],
  moving: ['moving time', 'bewegungszeit'],
  distance: ['distance', 'strecke', 'distanz'],
  kcal: ['calories', 'kalorien'],
  avgHr: ['average heart rate', 'durchschnittliche herzfrequenz'],
  maxHr: ['max heart rate', 'maximale herzfrequenz'],
};

const ART = {
  run: 'laufen', trailrun: 'laufen', virtualrun: 'laufen', walk: 'gehen', hike: 'wandern',
  ride: 'radfahren', virtualride: 'radfahren', ebikeride: 'radfahren', gravelride: 'radfahren', mountainbikeride: 'radfahren',
  swim: 'schwimmen', rowing: 'rudern', workout: 'kraft', weighttraining: 'kraft', crossfit: 'hiit',
  yoga: 'yoga', pilates: 'pilates', soccer: 'fussball', football: 'fussball', basketball: 'basketball',
  tennis: 'tennis', badminton: 'badminton', squash: 'squash', golf: 'golf', climbing: 'klettern',
  rockclimbing: 'klettern', alpineski: 'ski', snowboard: 'ski', elliptical: 'crosstrainer', velomobile: 'radfahren',
};
const fold = (s) => String(s || '').trim().toLowerCase().replace(/[\s_-]/g, '');

/** Strava-Art auf eine Formkurve-Sportart abbilden. */
export function stravaSport(type) {
  const key = fold(type);
  if (ART[key]) return ART[key];
  for (const [k, v] of Object.entries(ART)) if (key.includes(k)) return v;
  return 'andere';
}

/** „1:23:45“, „83:45“ oder Sekunden als Zahl → Minuten. */
function toMinutes(v) {
  const s = String(v || '').trim();
  if (!s) return null;
  if (/^\d+(\.\d+)?$/.test(s)) return Number(s) / 60; // Strava schreibt Sekunden
  const p = s.split(':').map(Number);
  if (p.some((x) => !Number.isFinite(x))) return null;
  if (p.length === 3) return p[0] * 60 + p[1] + p[2] / 60;
  if (p.length === 2) return p[0] + p[1] / 60;
  return null;
}

/** Strava schreibt das Datum lokal, etwa „Nov 8, 2026, 6:12:03 PM“ oder ISO. */
function parseDate(s) {
  const t = Date.parse(String(s || '').replace(/,\s*(\d{4})/, ' $1'));
  if (Number.isFinite(t)) return t;
  const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})[,\s]+(\d{1,2}):(\d{2})/.exec(String(s || ''));
  if (m) return new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5]).getTime();
  return NaN;
}

/** Erkennt eine Strava-Datei an ihrer Kopfzeile. */
export function looksLikeStrava(text) {
  const first = String(text || '').split(/\r?\n/, 1)[0];
  const cells = csvRow(first).map(fold);
  const hat = (k) => COLS[k].some((n) => cells.includes(fold(n)));
  return hat('date') && hat('type');
}

/**
 * Liest activities.csv aus dem Strava-Export. Gibt Trainings im Format der App zurück,
 * dazu eine Zusammenfassung für die Anzeige.
 */
export function parseStravaCsv(text) {
  const lines = String(text || '').split(/\r?\n/).filter((x) => x.trim());
  if (!lines.length) return { workouts: [], stats: { rows: 0, used: 0, skipped: 0, types: {} } };
  const head = csvRow(lines[0]).map(fold);
  const col = {};
  for (const [key, names] of Object.entries(COLS)) {
    col[key] = head.findIndex((h) => names.some((n) => h === fold(n) || h.startsWith(fold(n))));
  }
  const stats = { rows: lines.length - 1, used: 0, skipped: 0, types: {}, minT: null, maxT: null };
  const workouts = [];
  for (let i = 1; i < lines.length; i++) {
    const c = csvRow(lines[i]);
    const t = parseDate(c[col.date]);
    const durMin = toMinutes(c[col.moving] >= 0 ? c[col.moving] : null) ?? toMinutes(c[col.elapsed]);
    if (!Number.isFinite(t) || !Number.isFinite(durMin) || durMin <= 0) {
      stats.skipped++;
      continue;
    }
    const sport = stravaSport(c[col.type]);
    const num = (i2) => {
      const v = Number(String(c[i2] ?? '').replace(',', '.'));
      return Number.isFinite(v) && v > 0 ? v : null;
    };
    // Strava exportiert die Strecke in Metern (Spalte „Distance“ ohne Einheit)
    const roh = num(col.distance);
    const km = roh == null ? null : distanceKm(roh > 300 ? roh : roh * 1000, 'm');
    workouts.push({
      t,
      e: t + durMin * 60000,
      act: String(c[col.type] || 'Strava').trim(),
      kind: workoutKind(sport),
      sport,
      durMin,
      avgHr: num(col.avgHr),
      maxHr: num(col.maxHr),
      kcal: num(col.kcal),
      km,
      src: 'Strava',
    });
    stats.used++;
    stats.types[sport] = (stats.types[sport] || 0) + 1;
    stats.minT = stats.minT == null ? t : Math.min(stats.minT, t);
    stats.maxT = stats.maxT == null ? t : Math.max(stats.maxT, t);
  }
  return { workouts, stats };
}
