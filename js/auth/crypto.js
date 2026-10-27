// Verschlüsselung mit WebCrypto: Die PIN schützt einen zufälligen Datenschlüssel (AES-GCM 256),
// der alle Einträge eines Kontos verschlüsselt. So lässt sich die PIN ändern, ohne alles neu zu verschlüsseln.
const enc = new TextEncoder();
const dec = new TextDecoder();
const subtle = () => globalThis.crypto.subtle;

export const PIN_ITERATIONS = 310000;
export const CODE_ITERATIONS = 120000;

export function randomBytes(n) {
  return globalThis.crypto.getRandomValues(new Uint8Array(n));
}

export function randomId(prefix = 'u_') {
  return prefix + [...randomBytes(8)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** Wiederherstellungscode wie "K7QM-2XRA-9PDF-HT4W" (etwa 80 Bit). */
export function newRecoveryCode() {
  const bytes = randomBytes(16);
  const chars = [...bytes].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
  return chars.match(/.{4}/g).join('-');
}

export function normalizeCode(code) {
  return String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Schlüssel aus PIN oder Code ableiten (PBKDF2-SHA256). */
export async function deriveKek(secret, salt, iterations) {
  const base = await subtle().importKey('raw', enc.encode(secret), 'PBKDF2', false, ['deriveKey']);
  return subtle().deriveKey({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['wrapKey', 'unwrapKey']);
}

export async function newDataKey() {
  return subtle().generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}

export async function wrapDataKey(dataKey, kek) {
  const iv = randomBytes(12);
  const wrapped = await subtle().wrapKey('raw', dataKey, kek, { name: 'AES-GCM', iv });
  return { iv, data: new Uint8Array(wrapped) };
}

/** Entpackt den Datenschlüssel. Falsche PIN = Fehler (die Prüfsumme von AES-GCM schlägt fehl). */
export async function unwrapDataKey(wrapped, kek, extractable = false) {
  return subtle().unwrapKey('raw', wrapped.data, kek, { name: 'AES-GCM', iv: wrapped.iv }, { name: 'AES-GCM', length: 256 }, extractable, ['encrypt', 'decrypt']);
}

/** Erzeugt aus einem exportierbaren Schlüssel eine nicht exportierbare Kopie für die Sitzung. */
export async function sessionCopy(extractableKey) {
  const raw = new Uint8Array(await subtle().exportKey('raw', extractableKey));
  const key = await subtle().importKey('raw', raw, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  raw.fill(0);
  return key;
}

export async function encryptBytes(key, bytes) {
  const iv = randomBytes(12);
  const ct = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv }, key, bytes));
  const out = new Uint8Array(12 + ct.length);
  out.set(iv, 0);
  out.set(ct, 12);
  return out.buffer;
}

export async function decryptBytes(key, buffer) {
  const u = new Uint8Array(buffer);
  return new Uint8Array(await subtle().decrypt({ name: 'AES-GCM', iv: u.subarray(0, 12) }, key, u.subarray(12)));
}

// Serialisierung: 1 = JSON, 2 = Messwert-Paket mit drei Float64-Reihen (schnell und kompakt)
const isBucket = (v) => v && v.t instanceof Float64Array && v.e instanceof Float64Array && v.v instanceof Float64Array;

export function pack(value) {
  if (isBucket(value)) {
    const meta = enc.encode(JSON.stringify({ type: value.type, date: value.date, src: value.src }));
    const n = value.t.length;
    let head = 1 + 4 + meta.length;
    head += (8 - (head % 8)) % 8;
    const out = new Uint8Array(head + n * 24);
    out[0] = 2;
    new DataView(out.buffer).setUint32(1, meta.length, true);
    out.set(meta, 5);
    out.set(new Uint8Array(value.t.buffer, value.t.byteOffset, n * 8), head);
    out.set(new Uint8Array(value.e.buffer, value.e.byteOffset, n * 8), head + n * 8);
    out.set(new Uint8Array(value.v.buffer, value.v.byteOffset, n * 8), head + n * 16);
    return out;
  }
  const json = enc.encode(JSON.stringify(value === undefined ? null : value));
  const out = new Uint8Array(json.length + 1);
  out[0] = 1;
  out.set(json, 1);
  return out;
}

export function unpack(bytes) {
  const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (u[0] === 2) {
    const metaLen = new DataView(u.buffer, u.byteOffset, u.byteLength).getUint32(1, true);
    const meta = JSON.parse(dec.decode(u.subarray(5, 5 + metaLen)));
    let head = 1 + 4 + metaLen;
    head += (8 - (head % 8)) % 8;
    const n = (u.length - head) / 24;
    const copy = (off) => new Float64Array(u.slice(head + off, head + off + n * 8).buffer);
    return { ...meta, t: copy(0), e: copy(n * 8), v: copy(n * 16) };
  }
  if (u[0] === 1) return JSON.parse(dec.decode(u.subarray(1)));
  throw new Error('Unbekanntes Datenformat');
}

/** Speicher-Hülle: verschlüsselt jeden Wert, Schlüssel (Datum, Typ) bleiben lesbar. */
export class EncryptedStore {
  constructor(inner, key) {
    this.inner = inner;
    this.key = key;
    this.persistent = inner.persistent;
    this.name = inner.name;
  }

  async seal(v) {
    return encryptBytes(this.key, pack(v));
  }

  async open(v) {
    if (v == null) return v;
    if (!(v instanceof ArrayBuffer)) return v;
    return unpack(await decryptBytes(this.key, v));
  }

  async get(store, key) {
    return this.open(await this.inner.get(store, key));
  }

  async getMany(store, keys) {
    const vals = await this.inner.getMany(store, keys);
    return Promise.all(vals.map((v) => this.open(v)));
  }

  async put(store, key, value) {
    return this.inner.put(store, key, await this.seal(value));
  }

  async putMany(store, entries) {
    const sealed = await Promise.all(entries.map(async ([k, v]) => [k, await this.seal(v)]));
    return this.inner.putMany(store, sealed);
  }

  async entries(store) {
    const list = await this.inner.entries(store);
    return Promise.all(list.map(async ([k, v]) => [k, await this.open(v)]));
  }

  del(store, key) {
    return this.inner.del(store, key);
  }

  clear(store) {
    return this.inner.clear(store);
  }

  close() {
    this.inner.close();
  }
}
