// Kleine Hülle um IndexedDB. Ersatzspeicher im Arbeitsspeicher gibt es nur für Tests und die Vorschau:
// In der echten App wäre ein stiller Wechsel gefährlich, weil neue Eingaben dann beim Schließen verloren gingen.
export const STORES = ['raw', 'workouts', 'survey', 'context', 'kv'];
// Version des Datenbank-Aufbaus. Neue Speicherbereiche werden beim Erhöhen nur ergänzt, nie gelöscht.
export const DB_VERSION = 1;

let memoryFallback = typeof indexedDB === 'undefined';

/** Erlaubt den Ersatzspeicher im Arbeitsspeicher (Vorschau, Tests). */
export function allowMemoryFallback(on = true) {
  memoryFallback = on;
}

export class StorageError extends Error {
  constructor(message) {
    super(message);
    this.name = 'StorageError';
  }
}

function req2p(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

class IdbStore {
  constructor(db, name) {
    this.db = db;
    this.name = name;
    this.persistent = true;
    this.closed = false;
    // Öffnet eine neuere App-Version die Datenbank mit höherer Version, gibt diese Verbindung sie frei.
    db.onversionchange = () => {
      this.closed = true;
      db.close();
      globalThis.dispatchEvent?.(new Event('formkurve:reload-needed'));
    };
  }

  tx(store, mode = 'readonly') {
    if (this.closed) throw new StorageError('Formkurve wurde in einem anderen Fenster aktualisiert. Bitte neu laden.');
    return this.db.transaction(store, mode).objectStore(store);
  }

  get(store, key) {
    return req2p(this.tx(store).get(key));
  }

  async getMany(store, keys) {
    const os = this.tx(store);
    return Promise.all(keys.map((k) => req2p(os.get(k))));
  }

  put(store, key, value) {
    return req2p(this.tx(store, 'readwrite').put(value, key));
  }

  putMany(store, entries) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(store, 'readwrite');
      const os = tx.objectStore(store);
      for (const [k, v] of entries) os.put(v, k);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  del(store, key) {
    return req2p(this.tx(store, 'readwrite').delete(key));
  }

  async entries(store) {
    const os = this.tx(store);
    const [keys, values] = await Promise.all([req2p(os.getAllKeys()), req2p(os.getAll())]);
    return keys.map((k, i) => [k, values[i]]);
  }

  clear(store) {
    return req2p(this.tx(store, 'readwrite').clear());
  }

  close() {
    this.closed = true;
    this.db.close();
  }
}

class MemStore {
  constructor(name) {
    this.name = name;
    this.persistent = false;
    this.data = Object.fromEntries(STORES.map((s) => [s, new Map()]));
  }

  async get(store, key) {
    return this.data[store].get(key);
  }

  async getMany(store, keys) {
    return keys.map((k) => this.data[store].get(k));
  }

  async put(store, key, value) {
    this.data[store].set(key, value);
  }

  async putMany(store, entries) {
    for (const [k, v] of entries) this.data[store].set(k, v);
  }

  async del(store, key) {
    this.data[store].delete(key);
  }

  async entries(store) {
    return [...this.data[store].entries()];
  }

  async clear(store) {
    this.data[store].clear();
  }

  close() {}
}

function openOnce(name, timeoutMs) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const req = indexedDB.open(name, DB_VERSION);
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error('IndexedDB antwortet nicht'));
    }, timeoutMs);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const s of STORES) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s);
    };
    req.onsuccess = () => {
      if (settled) {
        req.result.close();
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolve(req.result);
    };
    req.onerror = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(req.error || new Error('IndexedDB-Fehler'));
    };
  });
}

/** Öffnet einen Speicher. Zwei Versuche, weil iOS IndexedDB nach einem Update manchmal erst beim zweiten Mal öffnet. */
export async function openStore(name) {
  if (typeof indexedDB === 'undefined') {
    if (memoryFallback) return new MemStore(name);
    throw new StorageError('Dieser Browser bietet keinen dauerhaften Speicher.');
  }
  let last = null;
  for (const timeout of [6000, 12000]) {
    try {
      return new IdbStore(await openOnce(name, timeout), name);
    } catch (e) {
      last = e;
    }
  }
  if (memoryFallback) {
    console.warn('Speicher nicht verfügbar, nutze Arbeitsspeicher:', last);
    return new MemStore(name);
  }
  throw new StorageError('Der Gerätespeicher antwortet gerade nicht. Schließe Formkurve ganz und öffne die App neu. Deine Daten bleiben erhalten.');
}

export async function deleteStore(name) {
  try {
    await req2p(indexedDB.deleteDatabase(name));
  } catch {
    // ignorieren
  }
}
