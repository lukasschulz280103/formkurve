// Geräte-Synchronisation über Firestore, Ende-zu-Ende verschlüsselt.
//
// Jeder Eintrag (Messwert-Paket, Workout, Check-in-Tag, Logbuch-Tag, Einstellungen) wird auf dem Gerät mit dem Datenschlüssel
// des Kontos verschlüsselt und als eigenes Dokument gespeichert. Die Dokument-Kennung ist ein HMAC aus Bereich
// und Schlüssel, damit auch Datum und Messart in der Cloud nicht lesbar sind. Firestore sieht nur Bytes, die
// Geräte-Kennung und einen Zeitstempel. Den Datenschlüssel bekommt ein neues Gerät nur mit dem Wiederherstellungscode.

import { deflateSync, inflateSync } from '../vendor/fflate.js';
import { pack, unpack, encryptBytes, decryptBytes, randomBytes, randomId, deriveKek, unwrapDataKey, normalizeCode } from '../auth/crypto.js';
import { mergeBucket } from '../data/rawindex.js';
import { mergeJournal } from '../journal/journal.js';
import { QUESTION_BY_ID, MODULES } from '../survey/catalog.js';
import { createClient, encodeFields, SyncError, REAUTH_CODES } from './firebase.js';

const enc = new TextEncoder();
const dec = new TextDecoder();
const SEP = '\u0000';
const PAGE = 150;
const MAX_ITEM = 900000;
const MAX_BATCH_BYTES = 3500000;
const MAX_BATCH_WRITES = 200;
const OVERLAP_MS = 120000;

export const KV = { auth: 'sync:auth', state: 'sync:state', outbox: 'sync:outbox', idk: 'sync:idk' };

// Stand des Abgleichs. 2 (Version 0.5): Bereich „journal“. Ältere Versionen haben solche Einträge anderer
// Geräte übersprungen, deshalb holt jedes Gerät nach dem Update einmal alles neu (Zusammenführen ist verlustfrei).
export const SYNC_FORMAT = 2;
const STORES_SYNCED = ['raw', 'survey', 'workouts', 'settings', 'journal'];

const b64 = (u) => {
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
  return btoa(s);
};
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

// ---------- Verpackung eines Eintrags ----------

/** Klartext eines Eintrags: Länge + Kopf {s, k} + gepackter Wert, komprimiert. */
export function packItem(store, key, value) {
  const head = enc.encode(JSON.stringify({ s: store, k: key }));
  const body = pack(value);
  const out = new Uint8Array(4 + head.length + body.length);
  new DataView(out.buffer).setUint32(0, head.length, true);
  out.set(head, 4);
  out.set(body, 4 + head.length);
  return deflateSync(out, { level: 6 });
}

export function unpackItem(bytes) {
  const u = inflateSync(bytes);
  const n = new DataView(u.buffer, u.byteOffset, u.byteLength).getUint32(0, true);
  const { s, k } = JSON.parse(dec.decode(u.subarray(4, 4 + n)));
  return { s, k, v: unpack(u.slice(4 + n)) };
}

// ---------- Zusammenführen ----------

function slotOf(id) {
  const q = QUESTION_BY_ID[id];
  return q ? MODULES[q.mod]?.slot || 'evening' : 'evening';
}

const stable = (v) => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : 1))) : x));

/**
 * Check-in-Tag von zwei Geräten zusammenführen: Je Zeitpunkt (Morgen, Abend) gilt das zuletzt gespeicherte Gerät.
 * Antworten ohne Speicherzeit werden vereinigt.
 */
export function mergeSurvey(a, b) {
  if (!a) return b;
  if (!b) return a;
  const out = { a: {}, ts: {}, backfilled: {} };
  for (const slot of ['morning', 'evening']) {
    const ta = a.ts?.[slot] || 0;
    const tb = b.ts?.[slot] || 0;
    const win = ta >= tb ? a : b;
    const lose = win === a ? b : a;
    if (win.ts?.[slot]) out.ts[slot] = win.ts[slot];
    if (win.backfilled && slot in win.backfilled) out.backfilled[slot] = win.backfilled[slot];
    for (const [id, v] of Object.entries(win.a || {})) if (slotOf(id) === slot) out.a[id] = v;
    if (!win.ts?.[slot]) for (const [id, v] of Object.entries(lose.a || {})) if (slotOf(id) === slot && !(id in out.a)) out.a[id] = v;
  }
  return out;
}

export const sameValue = (a, b) => stable(a) === stable(b);

const toList = (bucket) => {
  const out = new Array(bucket.t.length);
  for (let i = 0; i < bucket.t.length; i++) out[i] = { t: bucket.t[i], e: bucket.e[i], v: bucket.v[i] };
  return out;
};

// ---------- Engine ----------

export class SyncEngine {
  /**
   * repo: Repo des angemeldeten Kontos, key: Datenschlüssel (CryptoKey), cfg: Firebase-Konfiguration.
   * Vor start() die gespeicherten Zugangsdaten mit load() lesen.
   */
  constructor({ repo, key, cfg, fetchImpl, onStatus = () => {}, onApplied = () => {} }) {
    this.repo = repo;
    this.key = key;
    this.client = createClient(cfg, fetchImpl ? { fetchImpl } : {});
    this.onStatus = onStatus;
    this.onApplied = onApplied;
    this.auth = null;
    this.state = null;
    this.outbox = {};
    this.idKey = null;
    this.idToken = null;
    this.expiresAt = 0;
    this.running = null;
    this.again = false;
    this.status = { state: 'idle', lastSync: 0, error: null };
    this.tooBig = 0;
    this.pushTimer = null;
    repo.onChange = (store, keys) => this.touch(store, keys);
  }

  // ----- gespeicherter Zustand -----

  async load() {
    this.auth = (await this.repo.getKv(KV.auth)) || null;
    this.state = (await this.repo.getKv(KV.state)) || null;
    this.outbox = (await this.repo.getKv(KV.outbox)) || {};
    const idk = await this.repo.getKv(KV.idk);
    if (idk) this.idKey = await importIdKey(unb64(idk));
    if (this.state && (this.state.format || 1) < SYNC_FORMAT) {
      this.state = { ...this.state, cursor: null, format: SYNC_FORMAT };
      await this.saveState();
    }
    if (this.state) this.status.lastSync = this.state.lastSync || 0;
    return this.linked;
  }

  get linked() {
    return Boolean(this.auth?.uid && this.state && this.idKey);
  }

  saveState() {
    return this.repo.putKv(KV.state, this.state);
  }

  saveOutbox() {
    return this.repo.putKv(KV.outbox, this.outbox);
  }

  setStatus(patch) {
    this.status = { ...this.status, ...patch };
    this.onStatus(this.status);
  }

  /** Lokale Änderung vormerken und bald hochladen. */
  touch(store, keys) {
    if (!this.linked) return;
    const now = Date.now();
    for (const k of keys) this.outbox[`${store}${SEP}${k}`] = now;
    this.saveOutbox().catch(() => {});
    clearTimeout(this.pushTimer);
    this.pushTimer = setTimeout(() => this.sync().catch(() => {}), 3000);
  }

  markAll() {
    const now = Date.now();
    for (const [s, k] of this.repo.syncKeys()) this.outbox[`${s}${SEP}${k}`] = now;
    return this.saveOutbox();
  }

  stop() {
    clearTimeout(this.pushTimer);
    if (this.repo.onChange) this.repo.onChange = null;
  }

  // ----- Anmeldung -----

  async token() {
    if (this.idToken && Date.now() < this.expiresAt - 60000) return this.idToken;
    try {
      const s = await this.client.refresh(this.auth.refreshToken);
      this.idToken = s.idToken;
      this.expiresAt = s.expiresAt;
      if (s.refreshToken && s.refreshToken !== this.auth.refreshToken) {
        this.auth = { ...this.auth, refreshToken: s.refreshToken };
        await this.repo.putKv(KV.auth, this.auth);
      }
      return this.idToken;
    } catch (e) {
      if (REAUTH_CODES.has(e.code)) this.setStatus({ state: 'reauth', error: e.message });
      throw e;
    }
  }

  /** Nach Passwort-Änderung oder abgelaufener Anmeldung: neu anmelden, Daten bleiben. */
  async reauth(password) {
    const s = await this.client.signIn(this.auth.email, password);
    if (s.uid !== this.auth.uid) throw new SyncError('UID', 'Diese E-Mail gehört zu einem anderen Online-Konto.');
    this.useSession(s);
    await this.repo.putKv(KV.auth, this.auth);
    this.setStatus({ state: 'idle', error: null });
  }

  useSession(s) {
    this.idToken = s.idToken;
    this.expiresAt = s.expiresAt;
    this.auth = { uid: s.uid, email: s.email || this.auth?.email, refreshToken: s.refreshToken };
  }

  // ----- Verschlüsselung und Kennungen -----

  async seal(store, key, value) {
    return new Uint8Array(await encryptBytes(this.key, packItem(store, key, value)));
  }

  async open(bytes) {
    return unpackItem(await decryptBytes(this.key, bytes));
  }

  async docId(store, key) {
    const mac = new Uint8Array(await crypto.subtle.sign('HMAC', this.idKey, enc.encode(`${store}${SEP}${key}`)));
    return b64(mac.subarray(0, 20)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  itemPath(docId) {
    return `users/${this.auth.uid}/items/${docId}`;
  }

  // ----- Abgleich -----

  /** Holt Neues aus der Cloud und lädt eigene Änderungen hoch. Läuft nie doppelt. */
  async sync({ progress } = {}) {
    if (!this.linked || this.status.state === 'reauth') return { pulled: 0, pushed: 0 };
    if (this.running) {
      this.again = true;
      return this.running;
    }
    this.running = (async () => {
      this.setStatus({ state: 'syncing' });
      try {
        let pulled;
        let pushed;
        try {
          pulled = await this.pull(progress);
          pushed = await this.push(progress);
        } catch (e) {
          // Abgelaufenes oder widerrufenes Zugangs-Token: einmal neu holen und wiederholen
          if (e.code !== 'UNAUTHENTICATED') throw e;
          this.idToken = null;
          pulled = await this.pull(progress);
          pushed = await this.push(progress);
        }
        this.state.lastSync = Date.now();
        await this.saveState();
        this.setStatus({ state: 'idle', lastSync: this.state.lastSync, error: null });
        return { pulled, pushed };
      } catch (e) {
        const offline = e.code === 'NETWORK';
        if (this.status.state !== 'reauth') this.setStatus({ state: offline ? 'offline' : 'error', error: e.message });
        throw e;
      } finally {
        this.running = null;
        if (this.again) {
          this.again = false;
          setTimeout(() => this.sync().catch(() => {}), 50);
        }
      }
    })();
    return this.running;
  }

  /** Schlüssel-Dokument prüfen: Wurde auf einem anderen Gerät alles gelöscht, hier ebenfalls leeren. */
  async checkKeys(token) {
    const doc = await this.client.getDoc(`users/${this.auth.uid}`, token);
    if (!doc) throw new SyncError('NO_KEYS', 'Das Online-Konto hat keine Daten mehr. Verbinde dieses Gerät neu.');
    const epoch = doc.fields.epoch || 1;
    if (epoch > (this.state.epoch || 1)) {
      await this.repo.clearSynced();
      this.outbox = Object.fromEntries(Object.entries(this.outbox).filter(([id]) => id.startsWith(`settings${SEP}`)));
      await this.saveOutbox();
      this.state = { ...this.state, epoch, cursor: null };
      await this.saveState();
      this.onApplied();
    }
    return doc;
  }

  async pull(progress) {
    const token = await this.token();
    await this.checkKeys(token);
    const since = this.state.cursor ? new Date(Date.parse(this.state.cursor) - OVERLAP_MS).toISOString() : null;
    let maxU = this.state.cursor ? Date.parse(this.state.cursor) : 0;
    let startAfter = null;
    let applied = 0;
    let seen = 0;
    for (;;) {
      const q = {
        from: [{ collectionId: 'items' }],
        orderBy: [{ field: { fieldPath: 'u' }, direction: 'ASCENDING' }, { field: { fieldPath: '__name__' }, direction: 'ASCENDING' }],
        limit: PAGE,
      };
      if (since) q.where = { fieldFilter: { field: { fieldPath: 'u' }, op: 'GREATER_THAN', value: { timestampValue: since } } };
      if (startAfter) q.startAt = { values: [{ timestampValue: startAfter.u }, { referenceValue: startAfter.name }], before: false };
      const docs = await this.client.runQuery(`users/${this.auth.uid}`, q, token);
      const batches = Object.fromEntries(STORES_SYNCED.map((s) => [s, []]));
      for (const doc of docs) {
        seen++;
        const f = doc.fields;
        const u = Date.parse(f.u || 0) || 0;
        if (u > maxU) maxU = u;
        if (f.dev === this.state.deviceId) continue;
        if ((f.e || 1) !== (this.state.epoch || 1) || f.d || !f.c) continue;
        let item;
        try {
          item = await this.open(f.c);
        } catch {
          continue; // nicht lesbar (anderer Schlüssel): überspringen
        }
        if (batches[item.s]) batches[item.s].push(item);
      }
      applied += await this.applyBatch(batches);
      progress?.({ phase: 'pull', done: seen });
      if (docs.length < PAGE) break;
      const last = docs[docs.length - 1];
      startAfter = { u: last.fields.u, name: last.name };
    }
    if (maxU) this.state.cursor = new Date(maxU).toISOString();
    if (applied) {
      this.repo.rebuildIndex();
      this.onApplied();
    }
    return applied;
  }

  /** Übernimmt eine Seite empfangener Einträge; meldet zurück, wie viele lokal etwas geändert haben. */
  async applyBatch(batches) {
    let applied = 0;
    const repo = this.repo;
    const dirty = [];
    const pending = (s, k) => `${s}${SEP}${k}` in this.outbox;

    const raw = [];
    for (const { k, v } of batches.raw) {
      const local = repo.buckets.get(k);
      if (!local) {
        raw.push([k, v]);
        continue;
      }
      const merged = mergeBucket(local, toList(v));
      if (merged.added > 0) raw.push([k, { type: local.type, date: local.date, src: local.src, t: merged.t, e: merged.e, v: merged.v }]);
      if (merged.t.length > v.t.length) dirty.push(['raw', k]);
    }
    await repo.applyRemote('raw', raw);
    applied += raw.length;

    const survey = [];
    for (const { k, v } of batches.survey) {
      const local = repo.survey.get(k);
      const merged = mergeSurvey(local, v);
      if (!local || !sameValue(merged, local)) survey.push([k, merged]);
      if (local && !sameValue(merged, v)) dirty.push(['survey', k]);
    }
    await repo.applyRemote('survey', survey);
    applied += survey.length;

    const journal = [];
    for (const { k, v } of batches.journal) {
      const local = repo.journal.get(k);
      const merged = mergeJournal(local, v);
      if (!local || !sameValue(merged, local)) journal.push([k, merged]);
      if (local && !sameValue(merged, v)) dirty.push(['journal', k]);
    }
    await repo.applyRemote('journal', journal);
    applied += journal.length;

    const workouts = batches.workouts.filter(({ k }) => !pending('workouts', k)).map(({ k, v }) => [k, v]);
    await repo.applyRemote('workouts', workouts);
    applied += workouts.length;

    const settings = batches.settings.filter(({ k }) => !pending('settings', k)).map(({ k, v }) => [k, v]);
    if (settings.length && !sameValue(settings[settings.length - 1][1], repo.settings)) {
      await repo.applyRemote('settings', settings);
      applied += 1;
    }

    if (dirty.length) {
      const now = Date.now();
      for (const [s, k] of dirty) this.outbox[`${s}${SEP}${k}`] = now;
      await this.saveOutbox();
    }
    return applied;
  }

  async push(progress) {
    const entries = Object.entries(this.outbox);
    if (!entries.length) return 0;
    const token = await this.token();
    let batch = [];
    let bytes = 0;
    let done = 0;
    const flush = async () => {
      if (!batch.length) return;
      await this.client.commit(batch.map((b) => b.write), token);
      for (const b of batch) if (this.outbox[b.id] === b.ts) delete this.outbox[b.id];
      await this.saveOutbox();
      done += batch.length;
      progress?.({ phase: 'push', done, total: entries.length });
      batch = [];
      bytes = 0;
    };
    for (const [id, ts] of entries) {
      const [store, key] = id.split(SEP);
      const value = this.repo.readSyncItem(store, key);
      const name = this.client.docName(this.itemPath(await this.docId(store, key)));
      const meta = { e: this.state.epoch || 1, dev: this.state.deviceId };
      let write;
      let size = 200;
      if (value === undefined) {
        write = { update: { name, fields: encodeFields({ ...meta, d: true }) }, updateTransforms: [{ fieldPath: 'u', setToServerValue: 'REQUEST_TIME' }] };
      } else {
        const c = await this.seal(store, key, value);
        if (c.length > MAX_ITEM) {
          // Zu groß für ein Dokument (sehr viele Messwerte an einem Tag): bleibt nur auf diesem Gerät
          this.tooBig++;
          delete this.outbox[id];
          continue;
        }
        size = c.length;
        write = { update: { name, fields: encodeFields({ ...meta, c }) }, updateTransforms: [{ fieldPath: 'u', setToServerValue: 'REQUEST_TIME' }] };
      }
      if (batch.length && (batch.length >= MAX_BATCH_WRITES || bytes + size > MAX_BATCH_BYTES)) await flush();
      batch.push({ id, ts, write });
      bytes += size;
    }
    await flush();
    return done;
  }

  // ----- Verwaltung -----

  /** Neuen Wiederherstellungscode in der Cloud hinterlegen (der alte gilt dann nirgends mehr). */
  async updateRecovery(recovery) {
    const token = await this.token();
    await this.client.commit([{
      update: { name: this.client.docName(`users/${this.auth.uid}`), fields: encodeFields({ wrap: wrapFields(recovery) }) },
      updateMask: { fieldPaths: ['wrap'] },
      currentDocument: { exists: true },
    }], token);
  }

  /** Löscht alle abgeglichenen Daten auf allen Geräten: neue Epoche, Cloud-Einträge entfernen, lokal leeren. */
  async wipeEverywhere() {
    const token = await this.token();
    const keys = await this.checkKeys(token);
    const epoch = (keys.fields.epoch || 1) + 1;
    await this.client.commit([{
      update: { name: this.client.docName(`users/${this.auth.uid}`), fields: encodeFields({ epoch }) },
      updateMask: { fieldPaths: ['epoch'] },
      currentDocument: { exists: true },
    }], token);
    await this.deleteAllItems(token);
    await this.repo.clearSynced();
    this.outbox = {};
    await this.saveOutbox();
    this.state = { ...this.state, epoch, cursor: null };
    await this.saveState();
    this.onApplied();
  }

  async deleteAllItems(token) {
    for (;;) {
      const docs = await this.client.runQuery(`users/${this.auth.uid}`, { from: [{ collectionId: 'items' }], select: { fields: [{ fieldPath: 'e' }] }, limit: 300 }, token);
      if (!docs.length) break;
      await this.client.commit(docs.map((d) => ({ delete: d.name })), token);
      if (docs.length < 300) break;
    }
  }

  /** Online-Konto samt Cloud-Daten löschen (Passwort zur Bestätigung). Lokale Daten bleiben. */
  async deleteOnlineAccount(password) {
    const s = await this.client.signIn(this.auth.email, password);
    if (s.uid !== this.auth.uid) throw new SyncError('UID', 'Diese E-Mail gehört zu einem anderen Online-Konto.');
    await this.deleteAllItems(s.idToken);
    await this.client.commit([{ delete: this.client.docName(`users/${s.uid}`) }], s.idToken);
    await this.client.deleteUser(s.idToken);
    await this.forget();
  }

  /** Verbindung auf diesem Gerät lösen; Daten bleiben lokal. */
  async forget() {
    this.stop();
    for (const k of Object.values(KV)) await this.repo.delKv(k).catch(() => {});
    this.auth = null;
    this.state = null;
    this.idKey = null;
    this.outbox = {};
  }
}

// ---------- Hilfen für Firestore-Felder ----------

function wrapFields(recovery) {
  return { salt: recovery.salt, it: recovery.iterations, iv: recovery.wrap.iv, data: recovery.wrap.data };
}

async function importIdKey(raw) {
  return crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}

// ---------- Verbinden und Anmelden ----------

/**
 * Erstes Gerät: legt das Online-Konto an, hinterlegt den verpackten Datenschlüssel und lädt alles hoch.
 * recovery: { salt, iterations, wrap: { iv, data } } aus dem lokalen Konto.
 */
export async function linkNewOnlineAccount({ repo, key, cfg, email, password, name, recovery, fetchImpl }) {
  const client = createClient(cfg, fetchImpl ? { fetchImpl } : {});
  const s = await client.signUp(email.trim(), password);
  const idk = randomBytes(32);
  try {
    await client.commit([{
      update: {
        name: client.docName(`users/${s.uid}`),
        fields: encodeFields({
          v: 1,
          wrap: wrapFields(recovery),
          idk: new Uint8Array(await encryptBytes(key, idk)),
          name: new Uint8Array(await encryptBytes(key, enc.encode(name))),
          epoch: 1,
        }),
      },
      updateTransforms: [{ fieldPath: 'created', setToServerValue: 'REQUEST_TIME' }],
      currentDocument: { exists: false },
    }], s.idToken);
  } catch (e) {
    // Anmeldung ohne Schlüssel-Dokument nicht stehen lassen
    await client.deleteUser(s.idToken).catch(() => {});
    throw e;
  }
  await repo.putKv(KV.auth, { uid: s.uid, email: s.email || email.trim(), refreshToken: s.refreshToken });
  await repo.putKv(KV.idk, b64(idk));
  await repo.putKv(KV.state, { cursor: null, epoch: 1, deviceId: randomId('d_'), lastSync: 0, format: SYNC_FORMAT });
  await repo.putKv(KV.outbox, {});
  return { uid: s.uid, email: s.email || email.trim(), session: s };
}

/** Neues Gerät, Schritt 1: anmelden und das Schlüssel-Dokument holen. */
export async function signInOnline({ cfg, email, password, fetchImpl }) {
  const client = createClient(cfg, fetchImpl ? { fetchImpl } : {});
  const s = await client.signIn(email.trim(), password);
  const doc = await client.getDoc(`users/${s.uid}`, s.idToken);
  if (!doc) throw new SyncError('NO_KEYS', 'Zu diesem Online-Konto gibt es noch keine Daten. Verbinde es zuerst auf dem Gerät, auf dem du Formkurve schon nutzt (Profil → Konto).');
  return { session: s, keys: doc.fields };
}

/** Neues Gerät, Schritt 2: mit dem Wiederherstellungscode den Datenschlüssel und den Namen entschlüsseln. */
export async function unlockWithCode(keys, code) {
  const w = keys.wrap;
  let dataKey;
  try {
    const kek = await deriveKek(normalizeCode(code), w.salt, w.it);
    dataKey = await unwrapDataKey({ iv: w.iv, data: w.data }, kek, true);
  } catch {
    throw new SyncError('CODE', 'Der Wiederherstellungscode stimmt nicht.');
  }
  const name = dec.decode(await decryptBytes(dataKey, keys.name));
  const idk = await decryptBytes(dataKey, keys.idk);
  return { dataKey, name, idk, recovery: { salt: w.salt, iterations: w.it, wrap: { iv: w.iv, data: w.data } }, epoch: keys.epoch || 1 };
}

/** Neues Gerät, Schritt 3: Zugang im neuen lokalen Konto speichern. */
export async function storeLink(repo, { session, idk, epoch }) {
  await repo.putKv(KV.auth, { uid: session.uid, email: session.email, refreshToken: session.refreshToken });
  await repo.putKv(KV.idk, b64(idk));
  await repo.putKv(KV.state, { cursor: null, epoch, deviceId: randomId('d_'), lastSync: 0, format: SYNC_FORMAT });
  await repo.putKv(KV.outbox, {});
}

export function sendPasswordReset({ cfg, email, fetchImpl }) {
  return createClient(cfg, fetchImpl ? { fetchImpl } : {}).sendPasswordReset(email.trim());
}

export { SyncError };
