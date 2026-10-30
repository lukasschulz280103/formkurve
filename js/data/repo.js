// Datenhaltung der App: lädt alles aus IndexedDB in den Speicher und schreibt Änderungen zurück.
import { openStore, deleteStore, STORES } from './db.js';
import { EncryptedStore } from '../auth/crypto.js';
import { RawIndex, groupSamples, mergeBucket, bucketKey } from './rawindex.js';
import { mergeSettings } from '../core/config.js';
import { mergeJournal } from '../journal/journal.js';

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
    this.journal = new Map();
    this.context = new Map();
    this.settings = mergeSettings();
    this.meta = {};
    this.index = new RawIndex();
    // Wird von der Geräte-Synchronisation gesetzt: (store, keys) => void
    this.onChange = null;
    // Logbuch-Schreibvorgänge strikt nacheinander: Mehrere schnelle Einträge (zweimal „+ Glas“) dürfen sich beim
    // Verschlüsseln nicht überholen, sonst landete ein älterer Stand zuletzt in der Datenbank.
    this.journalQueue = Promise.resolve();
  }

  /** Schreibt den aktuellen Stand der genannten Logbuch-Tage, in der Reihenfolge der Aufrufe. */
  writeJournal(keys) {
    const run = this.journalQueue.then(() => {
      const entries = keys.map((k) => [k, this.journal.get(k)]).filter(([, v]) => v !== undefined);
      return entries.length ? this.db.putMany('journal', entries) : undefined;
    });
    this.journalQueue = run.catch(() => {});
    return run;
  }

  notify(store, keys) {
    if (this.onChange && keys.length) this.onChange(store, keys);
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
    const [settings, meta, raw, workouts, survey, context, journal] = await Promise.all([
      this.db.get('kv', 'settings'),
      this.db.get('kv', 'meta'),
      this.db.entries('raw'),
      this.db.entries('workouts'),
      this.db.entries('survey'),
      this.db.entries('context'),
      this.db.entries('journal'),
    ]);
    this.settings = mergeSettings(settings);
    this.meta = meta || {};
    this.buckets = new Map(raw);
    this.workouts = workouts.map(([, v]) => v);
    this.survey = new Map(survey);
    this.journal = new Map(journal);
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
      // Nur geänderte Pakete schreiben; ein erneuter Import desselben Exports ändert nichts
      if (prev && merged.added === 0) continue;
      const bucket = { type, date, src, t: merged.t, e: merged.e, v: merged.v };
      this.buckets.set(key, bucket);
      entries.push([key, bucket]);
    }
    if (entries.length) await this.db.putMany('raw', entries);
    this.notify('raw', entries.map(([k]) => k));
    if (workouts.length) {
      const wEntries = workouts.filter((w) => Number.isFinite(w.t)).map((w) => [`${w.t}|${w.src}`, w]);
      await this.db.putMany('workouts', wEntries);
      const keys = new Set(wEntries.map(([k]) => k));
      this.workouts = this.workouts.filter((w) => !keys.has(`${w.t}|${w.src}`)).concat(wEntries.map(([, w]) => w));
      this.notify('workouts', [...keys]);
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
    this.notify('survey', [date]);
  }

  /** Logbuch-Tag speichern (ganzer Datensatz, siehe journal/journal.js). */
  async saveJournal(date, rec) {
    this.journal.set(date, rec);
    await this.writeJournal([date]);
    this.notify('journal', [date]);
  }

  async saveSettings(settings) {
    this.settings = mergeSettings(settings);
    await this.db.put('kv', 'settings', this.settings);
    this.rebuildIndex();
    this.notify('settings', ['settings']);
  }

  // ---------- Geräte-Synchronisation ----------

  getKv(key) {
    return this.db.get('kv', key);
  }

  putKv(key, value) {
    return this.db.put('kv', key, value);
  }

  delKv(key) {
    return this.db.del('kv', key);
  }

  /** Alle Einträge, die zwischen Geräten abgeglichen werden: [store, key]. */
  syncKeys() {
    const out = [];
    for (const k of this.buckets.keys()) out.push(['raw', k]);
    for (const w of this.workouts) out.push(['workouts', `${w.t}|${w.src}`]);
    for (const k of this.survey.keys()) out.push(['survey', k]);
    for (const k of this.journal.keys()) out.push(['journal', k]);
    out.push(['settings', 'settings']);
    return out;
  }

  readSyncItem(store, key) {
    if (store === 'raw') return this.buckets.get(key);
    if (store === 'survey') return this.survey.get(key);
    if (store === 'journal') return this.journal.get(key);
    if (store === 'workouts') return this.workouts.find((w) => `${w.t}|${w.src}` === key);
    if (store === 'settings') return this.settings;
    return undefined;
  }

  /** Übernimmt Einträge von einem anderen Gerät, ohne sie erneut als Änderung zu melden. */
  async applyRemote(store, entries) {
    if (!entries.length) return;
    if (store === 'raw') {
      for (const [k, v] of entries) this.buckets.set(k, v);
      await this.db.putMany('raw', entries);
    } else if (store === 'survey') {
      for (const [k, v] of entries) this.survey.set(k, v);
      await this.db.putMany('survey', entries);
    } else if (store === 'journal') {
      for (const [k, v] of entries) this.journal.set(k, v);
      await this.writeJournal(entries.map(([k]) => k));
    } else if (store === 'workouts') {
      const keys = new Set(entries.map(([k]) => k));
      this.workouts = this.workouts.filter((w) => !keys.has(`${w.t}|${w.src}`)).concat(entries.map(([, w]) => w));
      await this.db.putMany('workouts', entries);
    } else if (store === 'settings') {
      this.settings = mergeSettings(entries[entries.length - 1][1]);
      await this.db.put('kv', 'settings', this.settings);
    }
  }

  /** Löscht die abgeglichenen Daten dieses Geräts (Einstellungen und Sync-Zugang bleiben). */
  async clearSynced() {
    this.journal = new Map();
    await this.journalQueue;
    for (const s of ['raw', 'workouts', 'survey', 'journal']) await this.db.clear(s);
    this.buckets = new Map();
    this.workouts = [];
    this.survey = new Map();
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
      journal: [...this.journal.entries()],
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
      this.notify('survey', obj.survey.map(([d]) => d));
    }
    if (Array.isArray(obj.journal)) {
      // Mit dem vorhandenen Logbuch vereinigen, damit nichts Neueres überschrieben wird
      const entries = obj.journal.map(([d, rec]) => [d, mergeJournal(this.journal.get(d), rec)]);
      for (const [d, rec] of entries) this.journal.set(d, rec);
      await this.writeJournal(entries.map(([d]) => d));
      this.notify('journal', entries.map(([d]) => d));
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
      this.notify('raw', entries.map(([k]) => k));
    }
    this.rebuildIndex();
  }

  async clearAll() {
    this.journal = new Map();
    await this.journalQueue;
    for (const s of STORES) await this.db.clear(s);
    this.buckets = new Map();
    this.workouts = [];
    this.survey = new Map();
    this.journal = new Map();
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
