// Kleine Hülle um IndexedDB mit Ersatzspeicher im Arbeitsspeicher, falls IndexedDB fehlt.
export const STORES = ['raw', 'workouts', 'survey', 'context', 'kv'];

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
  }

  tx(store, mode = 'readonly') {
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

export async function openStore(name) {
  try {
    if (typeof indexedDB === 'undefined') throw new Error('kein IndexedDB');
    const req = indexedDB.open(name, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const s of STORES) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s);
    };
    const db = await Promise.race([
      req2p(req),
      new Promise((_, rej) => setTimeout(() => rej(new Error('IndexedDB antwortet nicht')), 4000)),
    ]);
    return new IdbStore(db, name);
  } catch (e) {
    console.warn('Speicher nicht verfügbar, nutze Arbeitsspeicher:', e);
    return new MemStore(name);
  }
}

export async function deleteStore(name) {
  try {
    await req2p(indexedDB.deleteDatabase(name));
  } catch {
    // ignorieren
  }
}
