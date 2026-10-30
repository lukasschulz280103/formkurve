// Lokale Konten: Name + PIN, Daten je Konto verschlüsselt auf diesem Gerät.
// Es gibt keinen Server. Jedes Gerät hat seine eigene Kontoliste.
import { openStore, deleteStore } from '../data/db.js';
import {
  PIN_ITERATIONS, CODE_ITERATIONS, randomBytes, randomId, newRecoveryCode, normalizeCode,
  deriveKek, newDataKey, wrapDataKey, unwrapDataKey, sessionCopy,
} from './crypto.js';

export const REGISTRY_DB = 'formkurve-konten';
export const accountDbName = (id) => `formkurve-u-${id}`;

const COLORS = ['#3987e5', '#d95926', '#9085e9', '#199e70', '#d55181', '#c98500'];
let registry = null;

async function reg() {
  if (!registry) registry = await openStore(REGISTRY_DB);
  return registry;
}

/** Für Tests: eigenen Speicher setzen. */
export function _setRegistry(store) {
  registry = store;
}

const nameKey = (name) => String(name || '').trim().toLocaleLowerCase('de-DE');

export function publicAccount(a) {
  return { id: a.id, name: a.name, color: a.color, createdAt: a.createdAt, lastLogin: a.lastLogin || null, cloud: a.cloud || null };
}

export async function listAccounts() {
  const db = await reg();
  const all = await db.entries('kv');
  return all
    .filter(([k]) => String(k).startsWith('acc:'))
    .map(([, v]) => v)
    .sort((a, b) => (b.lastLogin || b.createdAt) - (a.lastLogin || a.createdAt));
}

async function getAccount(id) {
  const db = await reg();
  return db.get('kv', `acc:${id}`);
}

async function putAccount(a) {
  const db = await reg();
  await db.put('kv', `acc:${a.id}`, a);
}

export function validateName(name, existing = []) {
  const n = String(name || '').trim();
  if (!n) return 'Bitte gib einen Namen ein.';
  if (n.length > 24) return 'Der Name darf höchstens 24 Zeichen haben.';
  if (existing.some((a) => nameKey(a.name) === nameKey(n))) return 'Diesen Namen gibt es auf diesem Gerät schon.';
  return null;
}

export function validatePin(pin) {
  const p = String(pin || '');
  if (!/^\d{4,8}$/.test(p)) return 'Die PIN besteht aus 4 bis 8 Ziffern.';
  return null;
}

/** Legt ein Konto an. Gibt Konto, Sitzungsschlüssel und den einmalig sichtbaren Wiederherstellungscode zurück. */
export async function createAccount(name, pin) {
  const existing = await listAccounts();
  const nameErr = validateName(name, existing);
  if (nameErr) throw new Error(nameErr);
  const pinErr = validatePin(pin);
  if (pinErr) throw new Error(pinErr);
  const dataKey = await newDataKey();
  const pinSalt = randomBytes(16);
  const pinWrap = await wrapDataKey(dataKey, await deriveKek(pin, pinSalt, PIN_ITERATIONS));
  const code = newRecoveryCode();
  const codeSalt = randomBytes(16);
  const codeWrap = await wrapDataKey(dataKey, await deriveKek(normalizeCode(code), codeSalt, CODE_ITERATIONS));
  const account = {
    id: randomId(),
    name: String(name).trim(),
    color: COLORS[existing.length % COLORS.length],
    createdAt: Date.now(),
    lastLogin: Date.now(),
    version: 1,
    pin: { salt: pinSalt, iterations: PIN_ITERATIONS, wrap: pinWrap },
    recovery: { salt: codeSalt, iterations: CODE_ITERATIONS, wrap: codeWrap },
    fails: 0,
    lockedUntil: 0,
  };
  await putAccount(account);
  return { account: publicAccount(account), key: await sessionCopy(dataKey), recoveryCode: code };
}

/**
 * Legt ein Konto mit einem vorhandenen Datenschlüssel an (zweites Gerät eines Online-Kontos).
 * dataKey muss exportierbar sein; recovery ist die mit dem Wiederherstellungscode verpackte Kopie aus der Cloud.
 */
export async function createAccountWithKey(name, pin, dataKey, recovery, cloud = null) {
  const existing = await listAccounts();
  let finalName = String(name || 'Konto').trim().slice(0, 24) || 'Konto';
  for (let n = 2; validateName(finalName, existing); n++) finalName = `${String(name).trim().slice(0, 20)} ${n}`;
  const pinErr = validatePin(pin);
  if (pinErr) throw new Error(pinErr);
  const pinSalt = randomBytes(16);
  const account = {
    id: randomId(),
    name: finalName,
    color: COLORS[existing.length % COLORS.length],
    createdAt: Date.now(),
    lastLogin: Date.now(),
    version: 1,
    pin: { salt: pinSalt, iterations: PIN_ITERATIONS, wrap: await wrapDataKey(dataKey, await deriveKek(pin, pinSalt, PIN_ITERATIONS)) },
    recovery: { salt: recovery.salt, iterations: recovery.iterations, wrap: recovery.wrap },
    fails: 0,
    lockedUntil: 0,
    cloud,
  };
  await putAccount(account);
  return { account: publicAccount(account), key: await sessionCopy(dataKey) };
}

/** Verbindung zu einem Online-Konto merken oder lösen (cloud = null). */
export async function setCloud(id, cloud) {
  const a = await getAccount(id);
  if (!a) throw new Error('Konto nicht gefunden.');
  if (cloud) a.cloud = { uid: cloud.uid, email: cloud.email };
  else delete a.cloud;
  await putAccount(a);
  return publicAccount(a);
}

/** Die mit dem Wiederherstellungscode verpackte Kopie des Datenschlüssels (für die Cloud). */
export async function recoveryOf(id) {
  const a = await getAccount(id);
  return a ? a.recovery : null;
}

export async function findByCloudUid(uid) {
  return (await listAccounts()).find((a) => a.cloud?.uid === uid) || null;
}

export function lockRemaining(a, now = Date.now()) {
  return Math.max(0, (a?.lockedUntil || 0) - now);
}

async function registerFail(a) {
  a.fails = (a.fails || 0) + 1;
  if (a.fails >= 5) a.lockedUntil = Date.now() + Math.min(15 * 60000, 30000 * 2 ** (a.fails - 5));
  await putAccount(a);
}

/** Anmelden mit PIN. Falsche PIN wirft einen Fehler; nach 5 Fehlversuchen wächst eine Wartezeit. */
export async function login(id, pin) {
  const a = await getAccount(id);
  if (!a) throw new Error('Konto nicht gefunden.');
  const wait = lockRemaining(a);
  if (wait) throw new Error(`Zu viele Versuche. Bitte warte ${Math.ceil(wait / 1000)} Sekunden.`);
  let key;
  try {
    key = await unwrapDataKey(a.pin.wrap, await deriveKek(String(pin), a.pin.salt, a.pin.iterations), false);
  } catch {
    await registerFail(a);
    throw new Error(a.fails >= 5 ? 'PIN falsch. Kurze Pause, dann noch einmal.' : 'PIN falsch.');
  }
  a.fails = 0;
  a.lockedUntil = 0;
  a.lastLogin = Date.now();
  await putAccount(a);
  return { account: publicAccount(a), key };
}

/** Mit Wiederherstellungscode eine neue PIN setzen. */
export async function recover(id, code, newPin) {
  const pinErr = validatePin(newPin);
  if (pinErr) throw new Error(pinErr);
  const a = await getAccount(id);
  if (!a) throw new Error('Konto nicht gefunden.');
  // Der Code hat etwa 80 Bit Zufall; die PIN-Sperre gilt hier bewusst nicht.
  let dataKey;
  try {
    dataKey = await unwrapDataKey(a.recovery.wrap, await deriveKek(normalizeCode(code), a.recovery.salt, a.recovery.iterations), true);
  } catch {
    throw new Error('Der Wiederherstellungscode stimmt nicht.');
  }
  const salt = randomBytes(16);
  a.pin = { salt, iterations: PIN_ITERATIONS, wrap: await wrapDataKey(dataKey, await deriveKek(newPin, salt, PIN_ITERATIONS)) };
  a.fails = 0;
  a.lockedUntil = 0;
  a.lastLogin = Date.now();
  await putAccount(a);
  return { account: publicAccount(a), key: await sessionCopy(dataKey) };
}

export async function changePin(id, oldPin, newPin) {
  const pinErr = validatePin(newPin);
  if (pinErr) throw new Error(pinErr);
  const a = await getAccount(id);
  let dataKey;
  try {
    dataKey = await unwrapDataKey(a.pin.wrap, await deriveKek(String(oldPin), a.pin.salt, a.pin.iterations), true);
  } catch {
    throw new Error('Die bisherige PIN stimmt nicht.');
  }
  const salt = randomBytes(16);
  a.pin = { salt, iterations: PIN_ITERATIONS, wrap: await wrapDataKey(dataKey, await deriveKek(newPin, salt, PIN_ITERATIONS)) };
  await putAccount(a);
}

/** Neuen Wiederherstellungscode erzeugen (der alte wird ungültig). Braucht die PIN. */
export async function renewRecoveryCode(id, pin) {
  const a = await getAccount(id);
  let dataKey;
  try {
    dataKey = await unwrapDataKey(a.pin.wrap, await deriveKek(String(pin), a.pin.salt, a.pin.iterations), true);
  } catch {
    throw new Error('PIN falsch.');
  }
  const code = newRecoveryCode();
  const salt = randomBytes(16);
  a.recovery = { salt, iterations: CODE_ITERATIONS, wrap: await wrapDataKey(dataKey, await deriveKek(normalizeCode(code), salt, CODE_ITERATIONS)) };
  await putAccount(a);
  return code;
}

/**
 * Neuen Wiederherstellungscode vorbereiten, ohne ihn schon zu speichern. So kann ein verbundenes Konto den Code
 * zuerst in der Cloud hinterlegen; erst wenn das klappt, gilt er mit setRecovery() auch auf diesem Gerät.
 */
export async function prepareRecoveryCode(id, pin) {
  const a = await getAccount(id);
  let dataKey;
  try {
    dataKey = await unwrapDataKey(a.pin.wrap, await deriveKek(String(pin), a.pin.salt, a.pin.iterations), true);
  } catch {
    throw new Error('PIN falsch.');
  }
  const code = newRecoveryCode();
  const salt = randomBytes(16);
  const recovery = { salt, iterations: CODE_ITERATIONS, wrap: await wrapDataKey(dataKey, await deriveKek(normalizeCode(code), salt, CODE_ITERATIONS)) };
  return { code, recovery };
}

export async function setRecovery(id, recovery) {
  const a = await getAccount(id);
  if (!a) throw new Error('Konto nicht gefunden.');
  a.recovery = recovery;
  await putAccount(a);
}

export async function renameAccount(id, name) {
  const all = await listAccounts();
  const err = validateName(name, all.filter((a) => a.id !== id));
  if (err) throw new Error(err);
  const a = await getAccount(id);
  a.name = String(name).trim();
  await putAccount(a);
  return publicAccount(a);
}

export async function deleteAccount(id) {
  const db = await reg();
  await db.del('kv', `acc:${id}`);
  const s = await db.get('kv', 'session');
  if (s?.id === id) await db.del('kv', 'session');
  await deleteStore(accountDbName(id));
}

/** Angemeldet bleiben: nicht exportierbarer Schlüssel im Gerätespeicher. */
export async function saveSession(id, key) {
  const db = await reg();
  try {
    await db.put('kv', 'session', { id, key, at: Date.now() });
  } catch {
    // CryptoKey nicht speicherbar: dann nur für diese Sitzung angemeldet
  }
}

export async function loadSession() {
  const db = await reg();
  const s = await db.get('kv', 'session');
  if (!s?.id || !s.key) return null;
  const a = await getAccount(s.id);
  if (!a) return null;
  a.lastLogin = Date.now();
  await putAccount(a);
  return { account: publicAccount(a), key: s.key };
}

export async function clearSession() {
  const db = await reg();
  await db.del('kv', 'session');
}
