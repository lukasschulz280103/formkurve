// Katalog der Kacheln. Jede Kachel weiß, woher ihr Wert kommt, wie er aussieht
// und welche Reihe sie im Detail zeigt. Vier Gruppen, alle im Rotkreis der App.
import { isNum, mean } from '../../js/core/stats.js';
import { addDays } from '../../js/core/time.js';

export const GROUPS = {
  herz: { label: 'Herz', color: 'var(--c-herz)' },
  schlaf: { label: 'Schlaf', color: 'var(--c-schlaf)' },
  aktiv: { label: 'Aktivität', color: 'var(--c-aktiv)' },
  tag: { label: 'Tagebuch', color: 'var(--c-tag)' },
};

const n0 = (v) => Math.round(v).toLocaleString('de-DE');
const n1 = (v) => v.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const hhmm = (min) => `${Math.floor(min / 60)}:${String(Math.round(min % 60)).padStart(2, '0')}`;

/** Alle Kacheln. `v` liest einen Tag, `fmt` macht daraus den Text im Großformat. */
export const TILES = [
  {
    id: 'form', group: 'herz', label: 'Tagesform', unit: '/ 100', chart: 'ring', big: true,
    v: (d) => d?.form, fmt: n0,
    about: 'Recovery, Schlaf, Belastungsbalance und Langzeit-Fitness in einer Zahl. Sie sagt, wie viel der Tag verträgt.',
  },
  {
    id: 'recovery', group: 'herz', label: 'Recovery', unit: '/ 100', chart: 'ring',
    v: (d) => d?.recovery, fmt: n0,
    about: 'Abstand von HRV, Ruhepuls, Schlaf und deinem Gefühl zu deinen eigenen Nächten davor.',
  },
  {
    id: 'sleep', group: 'schlaf', label: 'Schlaf', unit: 'h', chart: 'bars',
    v: (d) => (d?.sleep ? d.sleep.asleepMin / 60 : null), fmt: (v) => hhmm(v * 60),
    sub: (d) => (d?.sleepScore != null ? `Score ${n0(d.sleepScore)}` : null),
    about: 'Reine Schlafzeit der letzten Nacht. Der Score wiegt Dauer, Effizienz, Tiefschlaf, REM und Regelmäßigkeit.',
  },
  {
    id: 'strain', group: 'aktiv', label: 'Belastung', unit: '/ 100', chart: 'bars',
    v: (d) => d?.strain, fmt: n0,
    sub: (d) => (d?.load != null ? `Last ${n0(d.load)}` : null),
    about: 'Aus den Pulszonen des Tages, Krafttraining kommt als Zuschlag dazu.',
  },
  {
    id: 'hrv', group: 'herz', label: 'HRV', unit: 'ms', chart: 'line',
    v: (d) => d?.hrv, fmt: n0,
    about: 'Herzfrequenzvariabilität im Schlaf, gemittelt im Logarithmus. Höher heißt meist besser erholt.',
  },
  {
    id: 'rhr', group: 'herz', label: 'Ruhepuls', unit: 'bpm', chart: 'line',
    v: (d) => d?.rhr, fmt: n0,
    about: 'Niedrigster ruhiger Puls der Nacht (10. Perzentil im Schlaffenster).',
  },
  {
    id: 'resp', group: 'herz', label: 'Atemfrequenz', unit: '/min', chart: 'line',
    v: (d) => d?.resp, fmt: n1,
    about: 'Atemzüge pro Minute im Schlaf. Steigt oft, bevor ein Infekt spürbar wird.',
  },
  {
    id: 'spo2', group: 'herz', label: 'Blutsauerstoff', unit: '%', chart: 'line',
    v: (d) => d?.spo2, fmt: n1,
    about: 'Sauerstoffsättigung im Schlaf, gemittelt über alle Messungen der Nacht.',
  },
  {
    id: 'steps', group: 'aktiv', label: 'Schritte', unit: '', chart: 'bars',
    v: (d) => d?.steps, fmt: n0,
    about: 'Alle Schritte des Tages aus der bevorzugten Quelle.',
  },
  {
    id: 'energy', group: 'aktiv', label: 'Aktive Energie', unit: 'kcal', chart: 'bars',
    v: (d) => d?.energy, fmt: n0,
    about: 'Verbrauch über dem Grundumsatz, so wie Apple Health ihn zählt.',
  },
  {
    id: 'training', group: 'aktiv', label: 'Training', unit: 'min', chart: 'bars',
    v: (d) => (d?.workouts?.length ? d.workouts.reduce((s, w) => s + w.durMin, 0) : null), fmt: n0,
    sub: (d) => (d?.workouts?.length ? `${d.workouts.length} ${d.workouts.length === 1 ? 'Einheit' : 'Einheiten'}` : null),
    about: 'Dauer aller gemessenen Einheiten des Tages.',
  },
  {
    id: 'happy', group: 'tag', label: 'Glück', unit: '/ 10', chart: 'bars',
    v: (d) => d?.journal?.happy, fmt: n0,
    about: 'Deine eigene Antwort am Abend: Wie glücklich hast du dich heute insgesamt gefühlt?',
  },
  {
    id: 'water', group: 'tag', label: 'Wasser', unit: 'l', chart: 'bars',
    v: (d) => (isNum(d?.journal?.waterMl) ? d.journal.waterMl / 1000 : null), fmt: n1,
    about: 'Getrunkene Menge aus dem Logbuch.',
  },
  {
    id: 'mass', group: 'tag', label: 'Gewicht', unit: 'kg', chart: 'line',
    v: (d) => d?.mass, fmt: n1, carry: 14,
    about: 'Letzte Messung von der Waage; ältere Werte gelten bis zur nächsten Messung.',
  },
];

export const TILE = Object.fromEntries(TILES.map((t) => [t.id, t]));

/** Werte einer Kachel über die letzten `n` Tage, älteste zuerst. */
export function seriesOf(tile, results, endDate, n) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const date = addDays(endDate, -i);
    let v = tile.v(results.days.get(date));
    // Werte, die nur ab und zu gemessen werden, bis zur nächsten Messung weiterführen
    if (!isNum(v) && tile.carry) {
      for (let k = 1; k <= tile.carry && !isNum(v); k++) v = tile.v(results.days.get(addDays(date, -k)));
    }
    out.push(isNum(v) ? v : null);
  }
  return out;
}

/** Letzter vorhandener Wert und sein Tag, höchstens `back` Tage zurück. */
export function latest(tile, results, endDate, back = 3) {
  for (let i = 0; i <= (tile.carry || back); i++) {
    const date = addDays(endDate, -i);
    const v = tile.v(results.days.get(date));
    if (isNum(v)) return { value: v, date, age: i };
  }
  return { value: null, date: null, age: null };
}

/** Vergleich der letzten 7 Tage mit den 7 davor – Grundlage der Höhepunkte. */
export function weekDelta(tile, results, endDate) {
  const s = seriesOf(tile, results, endDate, 14).filter(isNum);
  const all = seriesOf(tile, results, endDate, 14);
  const now = all.slice(7).filter(isNum);
  const before = all.slice(0, 7).filter(isNum);
  if (s.length < 8 || now.length < 3 || before.length < 3) return null;
  return { now: mean(now), before: mean(before), diff: mean(now) - mean(before) };
}
