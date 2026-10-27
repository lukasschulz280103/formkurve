// Datenhaltung der App: lädt alles aus IndexedDB in den Speicher und schreibt Änderungen zurück.
import { openStore, deleteStore, STORES } from './db.js';
import { EncryptedStore } from '../auth/crypto.js';
import { RawIndex, groupSamples, mergeBucket, bucketKey } from './rawindex.js';
import { mergeSettings } from '../core/config.js';

export const DB_MAIN = 'formkurve';
export const DB_DEMO = 'formkurve-demo';

// Format der gespeicherten Daten. Jede App-Version liest alle älteren Formate;
// eine Umwandlung läuft einmal beim Öffnen und ändert nie Antworten oder Messwerte, sie ergänzt höchstens.
export const DATA_FORMAT = 2;
const MIGRATIONS = {
  // 1 -> 2 (Version 0.3): nichts umzuwandeln. Alte Antworten (zum Beispiel Supplements aus dem Ernährungsmodul)
  // bleiben unverändert gespeichert und werden beim Lesen den neuen Fragen zugeordnet.
  2: async () => {},
};

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

  /** Öffnet einen Datenspeicher; mit key werden alle Werte verschlüsselt gelesen und geschrieben. */
  static async open(name, { key = null } = {}) {
    const raw = await openStore(name);
    const db = key ? new EncryptedStore(raw, key) : raw;
    const repo = new Repo(db);
    await repo.load();
    await repo.migrate();
    return repo;
  }

  /** Bringt ältere Datenformate auf den aktuellen Stand. Daten einer neueren Version bleiben unangetastet. */
  async migrate() {
    const from = this.meta.dataFormat || 1;
    if (from > DATA_FORMAT) {
      this.newerData = true;
      return;
    }
    if (from === DATA_FORMAT) return;
    for (let v = from + 1; v <= DATA_FORMAT; v++) await MIGRATIONS[v]?.(this);
    this.meta = { ...this.meta, dataFormat: DATA_FORMAT, migratedAt: Date.now() };
    await this.db.put('kv', 'meta', this.meta);
  }

  /** Übernimmt Daten aus dem alten, unverschlüsselten Speicher der Version 0.1 und löscht ihn danach. */
  async importLegacy(name = DB_MAIN) {
    try {
      // Nur in einen dauerhaften Speicher übernehmen; sonst bliebe die alte Datenbank besser liegen.
      if (typeof indexedDB === 'undefined' || !this.persistent) return 0;
      if (indexedDB.databases) {
        const dbs = await indexedDB.databases();
        if (!dbs.some((d) => d.name === name)) return 0;
      }
      const old = await openStore(name);
      let moved = 0;
      for (const store of STORES) {
        const entries = await old.entries(store);
        if (!entries.length) continue;
        await this.db.putMany(store, entries);
        moved += entries.length;
      }
      old.close();
      if (moved) {
        await deleteStore(name);
        await this.load();
      }
      return moved;
    } catch (e) {
      console.warn('Übernahme alter Daten fehlgeschlagen', e);
      return 0;
    }
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

  async patchMeta(patch) {
    this.meta = { ...this.meta, ...patch };
    await this.db.put('kv', 'meta', this.meta);
  }

  async noteBackup() {
    await this.patchMeta({ lastBackup: Date.now(), backupSnoozeUntil: 0 });
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
      dataFormat: DATA_FORMAT,
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
    this.meta = { dataFormat: DATA_FORMAT };
    this.settings = mergeSettings();
    this.rebuildIndex();
  }

  close() {
    this.db.close();
  }
}

export { deleteStore };
