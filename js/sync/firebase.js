// Schlanker Zugang zu Firebase über die REST-Schnittstellen, ohne SDK:
// Anmeldung (Identity Toolkit, Secure Token) und Firestore (Dokumente lesen, schreiben, abfragen).
// Firestore sieht nur verschlüsselte Bytes; den Zugriff je Nutzer regeln die Sicherheitsregeln.

const AUTH = 'https://identitytoolkit.googleapis.com/v1';
const TOKEN = 'https://securetoken.googleapis.com/v1/token';
const FIRESTORE = 'https://firestore.googleapis.com/v1';

export class SyncError extends Error {
  constructor(code, message, status = 0) {
    super(message);
    this.name = 'SyncError';
    this.code = code;
    this.status = status;
  }
}

const MESSAGES = {
  EMAIL_EXISTS: 'Für diese E-Mail gibt es schon ein Online-Konto. Melde dich damit an.',
  EMAIL_NOT_FOUND: 'E-Mail oder Passwort stimmt nicht.',
  INVALID_PASSWORD: 'E-Mail oder Passwort stimmt nicht.',
  INVALID_LOGIN_CREDENTIALS: 'E-Mail oder Passwort stimmt nicht.',
  INVALID_EMAIL: 'Die E-Mail-Adresse ist ungültig.',
  MISSING_PASSWORD: 'Bitte ein Passwort eingeben.',
  WEAK_PASSWORD: 'Das Passwort ist zu kurz.',
  TOO_MANY_ATTEMPTS_TRY_LATER: 'Zu viele Versuche. Bitte in ein paar Minuten noch einmal.',
  USER_DISABLED: 'Dieses Online-Konto ist gesperrt.',
  USER_NOT_FOUND: 'Das Online-Konto gibt es nicht mehr.',
  TOKEN_EXPIRED: 'Bitte mit E-Mail und Passwort neu anmelden.',
  INVALID_REFRESH_TOKEN: 'Bitte mit E-Mail und Passwort neu anmelden.',
  INVALID_ID_TOKEN: 'Bitte mit E-Mail und Passwort neu anmelden.',
  CREDENTIAL_TOO_OLD_LOGIN_AGAIN: 'Bitte zur Bestätigung noch einmal mit dem Passwort anmelden.',
  OPERATION_NOT_ALLOWED: 'In Firebase ist die Anmeldung mit E-Mail und Passwort noch nicht eingeschaltet (Authentication → Anmeldemethode).',
  CONFIGURATION_NOT_FOUND: 'Firebase Authentication ist noch nicht eingerichtet (Authentication → Jetzt starten).',
  API_KEY_INVALID: 'Der apiKey in der Sync-Einstellung stimmt nicht.',
  PERMISSION_DENIED: 'Firestore lehnt den Zugriff ab. Prüfe die Regeln (Firestore Database → Regeln).',
  DATABASE_MISSING: 'Die Firestore-Datenbank fehlt (Firestore Database → Datenbank erstellen).',
  NETWORK: 'Keine Verbindung zum Sync-Dienst.',
  UNAUTHENTICATED: 'Die Anmeldung ist abgelaufen.',
};

/** Fehler, nach denen eine neue Anmeldung mit Passwort nötig ist. */
export const REAUTH_CODES = new Set(['TOKEN_EXPIRED', 'INVALID_REFRESH_TOKEN', 'INVALID_ID_TOKEN', 'USER_NOT_FOUND', 'USER_DISABLED', 'CREDENTIAL_TOO_OLD_LOGIN_AGAIN']);

function toError(json, status) {
  const raw = String(json?.error?.message || json?.error?.status || json?.error || `HTTP ${status}`);
  let code = raw.split(/[ :]/)[0];
  if (/API key not valid|API_KEY_INVALID/i.test(raw)) code = 'API_KEY_INVALID';
  if (status === 401 || json?.error?.status === 'UNAUTHENTICATED') code = 'UNAUTHENTICATED';
  if (json?.error?.status === 'PERMISSION_DENIED' || status === 403) code = code in MESSAGES ? code : 'PERMISSION_DENIED';
  if (/database .*does not exist|NOT_FOUND.*database/i.test(raw)) code = 'DATABASE_MISSING';
  return new SyncError(code, MESSAGES[code] || `Sync-Fehler: ${raw}`, status);
}

// ---------- Firestore-Werte ----------

function b64(bytes) {
  const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
  return btoa(s);
}

function unb64(s) {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function encodeValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (v instanceof Uint8Array || v instanceof ArrayBuffer) return { bytesValue: b64(v) };
  if (typeof v === 'object') return { mapValue: { fields: encodeFields(v) } };
  throw new Error('Wert nicht speicherbar');
}

export function encodeFields(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[k] = encodeValue(v);
  return out;
}

export function decodeValue(v) {
  if (!v || 'nullValue' in v) return null;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('stringValue' in v) return v.stringValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('bytesValue' in v) return unb64(v.bytesValue);
  if ('mapValue' in v) return decodeFields(v.mapValue.fields || {});
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(decodeValue);
  return null;
}

export function decodeFields(fields) {
  const out = {};
  for (const [k, v] of Object.entries(fields || {})) out[k] = decodeValue(v);
  return out;
}

// ---------- Client ----------

export function createClient(cfg, { fetchImpl = (...a) => globalThis.fetch(...a) } = {}) {
  const docRoot = `projects/${cfg.projectId}/databases/(default)/documents`;

  async function call(url, init) {
    let res;
    try {
      res = await fetchImpl(url, init);
    } catch {
      throw new SyncError('NETWORK', MESSAGES.NETWORK);
    }
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    if (!res.ok) throw toError(json, res.status);
    return json;
  }

  const authCall = (method, body) =>
    call(`${AUTH}/accounts:${method}?key=${encodeURIComponent(cfg.apiKey)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

  const session = (j) => ({
    uid: j.localId || j.user_id,
    email: j.email || null,
    idToken: j.idToken || j.id_token,
    refreshToken: j.refreshToken || j.refresh_token,
    expiresAt: Date.now() + Number(j.expiresIn || j.expires_in || 3600) * 1000,
  });

  const fsHeaders = (token) => ({ 'content-type': 'application/json', authorization: `Bearer ${token}` });

  return {
    docRoot,
    docName: (path) => `${docRoot}/${path}`,
    signUp: async (email, password) => session(await authCall('signUp', { email, password, returnSecureToken: true })),
    signIn: async (email, password) => session(await authCall('signInWithPassword', { email, password, returnSecureToken: true })),
    sendPasswordReset: (email) => authCall('sendOobCode', { requestType: 'PASSWORD_RESET', email }),
    deleteUser: (idToken) => authCall('delete', { idToken }),
    async refresh(refreshToken) {
      const body = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }).toString();
      return session(await call(`${TOKEN}?key=${encodeURIComponent(cfg.apiKey)}`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body }));
    },
    /** Ein Dokument lesen; null, wenn es fehlt. */
    async getDoc(path, token) {
      try {
        const doc = await call(`${FIRESTORE}/${docRoot}/${path}`, { headers: fsHeaders(token) });
        return { name: doc.name, fields: decodeFields(doc.fields), updateTime: doc.updateTime };
      } catch (e) {
        if (e.status === 404 && e.code !== 'DATABASE_MISSING') return null;
        throw e;
      }
    },
    /** Mehrere Schreibvorgänge in einem Rutsch (alle oder keiner). */
    commit: (writes, token) => call(`${FIRESTORE}/${docRoot}:commit`, { method: 'POST', headers: fsHeaders(token), body: JSON.stringify({ writes }) }),
    /** Abfrage in einer Untersammlung von parentPath. */
    async runQuery(parentPath, structuredQuery, token) {
      const out = await call(`${FIRESTORE}/${docRoot}/${parentPath}:runQuery`, { method: 'POST', headers: fsHeaders(token), body: JSON.stringify({ structuredQuery }) });
      return (Array.isArray(out) ? out : [out]).filter((r) => r && r.document).map((r) => ({ name: r.document.name, fields: decodeFields(r.document.fields), updateTime: r.document.updateTime }));
    },
  };
}
