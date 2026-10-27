// Rohdaten im Speicher: Tagespakete je Typ, Tag und Quelle mit sortierten Zeitreihen.
import { dateKey, rangeKeys } from '../core/time.js';
import { defaultSourceOrder } from './normalize.js';

export function bucketKey(type, date, src) {
  return `${type}|${date}|${src}`;
}

/** Fasst neue Messwerte mit einem vorhandenen Paket zusammen, sortiert und entfernt Duplikate. */
export function mergeBucket(prev, adds) {
  const n0 = prev ? prev.t.length : 0;
  const rows = new Array(n0 + adds.length);
  for (let i = 0; i < n0; i++) rows[i] = [prev.t[i], prev.e[i], prev.v[i]];
  for (let i = 0; i < adds.length; i++) rows[n0 + i] = [adds[i].t, adds[i].e, adds[i].v];
  rows.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
  const t = [];
  const e = [];
  const v = [];
  let last = null;
  for (const r of rows) {
    if (last && r[0] === last[0] && r[1] === last[1] && Math.abs(r[2] - last[2]) < 1e-9) continue;
    t.push(r[0]);
    e.push(r[1]);
    v.push(r[2]);
    last = r;
  }
  return { t: Float64Array.from(t), e: Float64Array.from(e), v: Float64Array.from(v), added: t.length - n0 };
}

/** Gruppiert Messwerte nach Paketschlüssel. */
export function groupSamples(samples) {
  const groups = new Map();
  for (const s of samples) {
    const src = s.src || 'Unbekannt';
    const k = bucketKey(s.type, dateKey(s.t), src);
    let g = groups.get(k);
    if (!g) groups.set(k, (g = []));
    g.push(s);
  }
  return groups;
}

export class RawIndex {
  constructor(buckets = [], priority = []) {
    // type -> date -> src -> bucket
    this.map = new Map();
    this.priority = priority;
    this.counts = {}; // type -> src -> n
    this.range = {}; // type -> [minDate, maxDate]
    this.lastSample = 0;
    for (const b of buckets) this.add(b);
  }

  add(b) {
    let byDate = this.map.get(b.type);
    if (!byDate) this.map.set(b.type, (byDate = new Map()));
    let bySrc = byDate.get(b.date);
    if (!bySrc) byDate.set(b.date, (bySrc = new Map()));
    bySrc.set(b.src, b);
    const c = (this.counts[b.type] ||= {});
    c[b.src] = (c[b.src] || 0) + b.t.length;
    const r = this.range[b.type];
    if (!r) this.range[b.type] = [b.date, b.date];
    else {
      if (b.date < r[0]) r[0] = b.date;
      if (b.date > r[1]) r[1] = b.date;
    }
    if (b.t.length && b.e[b.e.length - 1] > this.lastSample) this.lastSample = Math.max(b.e[b.e.length - 1], b.t[b.t.length - 1]);
  }

  types() {
    return [...this.map.keys()];
  }

  dates() {
    let min = null;
    let max = null;
    for (const r of Object.values(this.range)) {
      if (!min || r[0] < min) min = r[0];
      if (!max || r[1] > max) max = r[1];
    }
    return [min, max];
  }

  /** Quellen eines Typs in Prioritätsreihenfolge. */
  sourceOrder(type) {
    const counts = this.counts[type] || {};
    const def = defaultSourceOrder(counts);
    if (!this.priority?.length) return def;
    const known = this.priority.filter((s) => s in counts);
    return [...known, ...def.filter((s) => !known.includes(s))];
  }

  sourcesOn(type, date) {
    const bySrc = this.map.get(type)?.get(date);
    return bySrc ? [...bySrc.keys()] : [];
  }

  /** Paket der bevorzugten Quelle für Typ und Tag. */
  picked(type, date) {
    const bySrc = this.map.get(type)?.get(date);
    if (!bySrc || !bySrc.size) return null;
    if (bySrc.size === 1) return bySrc.values().next().value;
    for (const s of this.sourceOrder(type)) if (bySrc.has(s)) return bySrc.get(s);
    return bySrc.values().next().value;
  }

  bucket(type, date, src) {
    return this.map.get(type)?.get(date)?.get(src) || null;
  }

  /** Alle Pakete eines Typs und einer Quelle, nach Datum sortiert. */
  bucketsOf(type, src) {
    const byDate = this.map.get(type);
    if (!byDate) return [];
    const out = [];
    for (const [d, bySrc] of byDate) if (bySrc.has(src)) out.push(bySrc.get(src));
    return out.sort((a, b) => (a.date < b.date ? -1 : 1));
  }

  /** Messwerte im Zeitfenster [from, to) aus den bevorzugten Quellen der berührten Tage. */
  window(type, from, to) {
    const out = { t: [], e: [], v: [] };
    const byDate = this.map.get(type);
    if (!byDate || !(to > from)) return out;
    for (const date of rangeKeys(dateKey(from), dateKey(to - 1))) {
      if (!byDate.has(date)) continue;
      const b = this.picked(type, date);
      if (!b) continue;
      for (let i = 0; i < b.t.length; i++) {
        if (b.t[i] >= from && b.t[i] < to) {
          out.t.push(b.t[i]);
          out.e.push(b.e[i]);
          out.v.push(b.v[i]);
        }
      }
    }
    return out;
  }
}
