// Datenhaltung der App: lädt alles aus IndexedDB in den Speicher und schreibt Änderungen zurück.
import { openStore, deleteStore, STORES } from './db.js';
import { RawIndex, groupSamples, mergeBucket, bucketKey } from './rawindex.js';
import { mergeSettings } from '../core/config.js';

export const DB_MAIN = 'formkurve';
export const DB_DEMO = 'formkurve-demo';

export class Repo {
  constructor(db) {
    this.db = db;
    this.buckets = new Map();
    this.workouts = [];
    this.survey = new Map();
    this.context = new Map();
    this.settings = mergeSettings();
    this.meta = {};
    this.index = new RawIndex();
  }

  static async open(name) {
    const db = await openStore(name);
    const repo = new Repo(db);
    await repo.load();
    return repo;
  }

  get persistent() {
    return this.db.persistent;
  }

  async load() {
    const [settings, meta, raw, workouts, survey, context] = await Promise.all([
      this.db.get('kv', 'settings'),
      this.db.get('kv', 'meta'),
      this.db.entries('raw'),
      this.db.entries('workouts'),
      this.db.entries('survey'),
      this.db.entries('context'),
    ]);
    this.settings = mergeSettings(settings);
    this.meta = meta || {};
    this.buckets = new Map(raw);
    this.workouts = workouts.map(([, v]) => v);
    this.survey = new Map(survey);
    this.context = new Map(context);
    this.rebuildIndex();
  }

  rebuildIndex() {
    this.index = new RawIndex([...this.buckets.values()], this.settings.import.sourcePriority);
  }

  /** Speichert neue Messwerte (dedupliziert) und Workouts. */
  async addSamples(samples, workouts = []) {
    const groups = groupSamples(samples);
    const entries = [];
    let added = 0;
    for (const [key, list] of groups) {
      const [type, date, src] = key.split('|');
      const prev = this.buckets.get(key);
      const merged = mergeBucket(prev, list);
      added += merged.added;
      const bucket = { type, date, src, t: merged.t, e: merged.e, v: merged.v };
      this.buckets.set(key, bucket);
      entries.push([key, bucket]);
    }
    if (entries.length) await this.db.putMany('raw', entries);
    if (workouts.length) {
      const wEntries = workouts.filter((w) => Number.isFinite(w.t)).map((w) => [`${w.t}|${w.src}`, w]);
      await this.db.putMany('workouts', wEntries);
      const keys = new Set(wEntries.map(([k]) => k));
      this.workouts = this.workouts.filter((w) => !keys.has(`${w.t}|${w.src}`)).concat(wEntries.map(([, w]) => w));
    }
    return added;
  }

  async finishImport(summary) {
    this.rebuildIndex();
    this.meta = { ...this.meta, lastImport: Date.now(), lastSummary: summary };
    await this.db.put('kv', 'meta', this.meta);
  }

  async saveSurvey(date, record) {
    this.survey.set(date, record);
    await this.db.put('survey', date, record);
  }

  async saveSettings(settings) {
    this.settings = mergeSettings(settings);
    await this.db.put('kv', 'settings', this.settings);
    this.rebuildIndex();
  }

  async saveContext(map) {
    const entries = [];
    for (const [d, v] of map) {
      const merged = { ...(this.context.get(d) || {}), ...Object.fromEntries(Object.entries(v).filter(([, x]) => x !== null && x !== undefined)) };
      this.context.set(d, merged);
      entries.push([d, merged]);
    }
    if (entries.length) await this.db.putMany('context', entries);
    this.meta = { ...this.meta, lastContext: Date.now() };
    await this.db.put('kv', 'meta', this.meta);
  }

  async exportBackup({ includeRaw = false } = {}) {
    const out = {
      app: 'formkurve',
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: this.settings,
      survey: [...this.survey.entries()],
      context: [...this.context.entries()],
      workouts: this.workouts,
    };
    if (includeRaw) out.raw = [...this.buckets.values()].map((b) => ({ type: b.type, date: b.date, src: b.src, t: [...b.t], e: [...b.e], v: [...b.v] }));
    return out;
  }

  async importBackup(obj) {
    if (!obj || obj.app !== 'formkurve') throw new Error('Das ist kein Formkurve-Backup.');
    if (obj.settings) await this.saveSettings(obj.settings);
    if (Array.isArray(obj.survey)) {
      for (const [d, rec] of obj.survey) this.survey.set(d, rec);
      await this.db.putMany('survey', obj.survey);
    }
    if (Array.isArray(obj.context)) await this.saveContext(new Map(obj.context));
    if (Array.isArray(obj.workouts)) await this.addSamples([], obj.workouts);
    if (Array.isArray(obj.raw)) {
      const entries = obj.raw.map((b) => {
        const bucket = { type: b.type, date: b.date, src: b.src, t: Float64Array.from(b.t), e: Float64Array.from(b.e), v: Float64Array.from(b.v) };
        const key = bucketKey(b.type, b.date, b.src);
        this.buckets.set(key, bucket);
        return [key, bucket];
      });
      await this.db.putMany('raw', entries);
    }
    this.rebuildIndex();
  }

  async clearAll() {
    for (const s of STORES) await this.db.clear(s);
    this.buckets = new Map();
    this.workouts = [];
    this.survey = new Map();
    this.context = new Map();
    this.meta = {};
    this.settings = mergeSettings();
    this.rebuildIndex();
  }

  close() {
    this.db.close();
  }
}

export { deleteStore };
