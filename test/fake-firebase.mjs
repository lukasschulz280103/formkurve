// Nachbau der benutzten Firebase-REST-Endpunkte für Tests ohne Netz:
// Identity Toolkit (signUp, signInWithPassword, sendOobCode, delete), Secure Token (refresh)
// und Firestore (get, commit mit REQUEST_TIME und Vorbedingung, runQuery mit Filter, Sortierung, Cursor, Limit).
// Prüft wie die echten Sicherheitsregeln, dass jede Person nur unter users/{eigene uid} liest und schreibt.

export function createFakeFirebase({ projectId = 'demo-formkurve', apiKey = 'AIzaFakeKeyForTests_1234567890abcdef' } = {}) {
  const users = new Map(); // email -> { uid, password }
  const tokens = new Map(); // idToken -> uid
  const refresh = new Map(); // refreshToken -> uid
  const docs = new Map(); // full name -> { fields, updateTime }
  const root = `projects/${projectId}/databases/(default)/documents`;
  let clock = Date.UTC(2026, 9, 27, 12, 0, 0);
  let counter = 0;
  const log = [];
  const rand = () => Math.random().toString(36).slice(2) + (++counter).toString(36);
  const now = () => {
    clock += 7;
    return new Date(clock).toISOString();
  };

  const json = (status, body) => ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
    json: async () => body,
  });
  const err = (status, message, st = 'INVALID_ARGUMENT') => json(status, { error: { code: status, message, status: st } });

  function session(uid, email) {
    const idToken = `id_${rand()}`;
    const refreshToken = `rt_${rand()}`;
    tokens.set(idToken, uid);
    refresh.set(refreshToken, uid);
    return { idToken, refreshToken, uid, email };
  }

  function authUid(init) {
    const h = init?.headers?.authorization || init?.headers?.Authorization || '';
    return tokens.get(h.replace(/^Bearer /, '')) || null;
  }

  const ownerOf = (name) => {
    const m = name.match(/\/documents\/users\/([^/]+)/);
    return m ? m[1] : null;
  };

  function cmp(a, b) {
    if ('timestampValue' in a) return Date.parse(a.timestampValue) - Date.parse(b.timestampValue);
    if ('referenceValue' in a) return a.referenceValue < b.referenceValue ? -1 : a.referenceValue > b.referenceValue ? 1 : 0;
    return 0;
  }

  function valueAt(name, doc, path) {
    if (path === '__name__') return { referenceValue: name };
    return doc.fields[path];
  }

  async function handle(url, init = {}) {
    const u = new URL(url);
    const body = init.body ? (typeof init.body === 'string' && init.body.startsWith('{') ? JSON.parse(init.body) : Object.fromEntries(new URLSearchParams(init.body))) : null;
    log.push(`${init.method || 'GET'} ${u.hostname}${u.pathname}`);
    if (u.hostname === 'identitytoolkit.googleapis.com') {
      if (u.searchParams.get('key') !== apiKey) return err(400, 'API key not valid. Please pass a valid API key.');
      const method = u.pathname.split(':')[1];
      if (method === 'signUp') {
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.email || '')) return err(400, 'INVALID_EMAIL');
        if (users.has(body.email)) return err(400, 'EMAIL_EXISTS');
        if ((body.password || '').length < 6) return err(400, 'WEAK_PASSWORD : Password should be at least 6 characters');
        const uid = `uid${rand()}`;
        users.set(body.email, { uid, password: body.password });
        const s = session(uid, body.email);
        return json(200, { idToken: s.idToken, refreshToken: s.refreshToken, localId: uid, email: body.email, expiresIn: '3600' });
      }
      if (method === 'signInWithPassword') {
        const user = users.get(body.email);
        if (!user || user.password !== body.password) return err(400, 'INVALID_LOGIN_CREDENTIALS');
        const s = session(user.uid, body.email);
        return json(200, { idToken: s.idToken, refreshToken: s.refreshToken, localId: user.uid, email: body.email, expiresIn: '3600', registered: true });
      }
      if (method === 'sendOobCode') return users.has(body.email) ? json(200, { email: body.email }) : err(400, 'EMAIL_NOT_FOUND');
      if (method === 'delete') {
        const uid = tokens.get(body.idToken);
        if (!uid) return err(400, 'INVALID_ID_TOKEN');
        for (const [e, x] of users) if (x.uid === uid) users.delete(e);
        return json(200, {});
      }
      return err(404, 'NOT_FOUND');
    }
    if (u.hostname === 'securetoken.googleapis.com') {
      const uid = refresh.get(body.refresh_token);
      if (!uid || ![...users.values()].some((x) => x.uid === uid)) return err(400, 'INVALID_REFRESH_TOKEN');
      const idToken = `id_${rand()}`;
      tokens.set(idToken, uid);
      return json(200, { id_token: idToken, refresh_token: body.refresh_token, expires_in: '3600', token_type: 'Bearer', user_id: uid, project_id: projectId });
    }
    if (u.hostname === 'firestore.googleapis.com') {
      const uid = authUid(init);
      const h = init?.headers?.authorization || init?.headers?.Authorization || '';
      // Wie Firestore: ungültiges oder abgelaufenes Token = 401, fehlende Rechte = 403
      if (h && !uid) return err(401, 'Request had invalid authentication credentials. Expected OAuth 2 access token, login cookie or other valid authentication credential.', 'UNAUTHENTICATED');
      const path = decodeURIComponent(u.pathname).replace(/^\/v1\//, '');
      if (path.endsWith(':commit')) {
        const writes = body.writes || [];
        for (const w of writes) {
          const name = w.update?.name || w.delete;
          if (!uid || ownerOf(name) !== uid) return err(403, 'Missing or insufficient permissions.', 'PERMISSION_DENIED');
          if (w.currentDocument && 'exists' in w.currentDocument && docs.has(name) !== w.currentDocument.exists) {
            return err(w.currentDocument.exists ? 404 : 409, w.currentDocument.exists ? 'NOT_FOUND: no entity to update' : 'ALREADY_EXISTS: Document already exists', w.currentDocument.exists ? 'NOT_FOUND' : 'ALREADY_EXISTS');
          }
        }
        const t = now();
        for (const w of writes) {
          if (w.delete) {
            docs.delete(w.delete);
            continue;
          }
          const prev = docs.get(w.update.name);
          let fields = w.updateMask ? { ...(prev?.fields || {}) } : {};
          if (w.updateMask) for (const p of w.updateMask.fieldPaths) fields[p] = w.update.fields[p];
          else fields = { ...w.update.fields };
          for (const tr of w.updateTransforms || []) if (tr.setToServerValue === 'REQUEST_TIME') fields[tr.fieldPath] = { timestampValue: t };
          docs.set(w.update.name, { fields, updateTime: t });
        }
        return json(200, { commitTime: t, writeResults: writes.map(() => ({ updateTime: t })) });
      }
      if (path.endsWith(':runQuery')) {
        const parent = path.slice(0, -':runQuery'.length);
        if (!uid || ownerOf(parent) !== uid) return err(403, 'Missing or insufficient permissions.', 'PERMISSION_DENIED');
        const q = body.structuredQuery;
        const coll = q.from[0].collectionId;
        let rows = [...docs.entries()].filter(([name]) => name.startsWith(`${parent}/${coll}/`) && !name.slice(parent.length + coll.length + 2).includes('/'));
        if (q.where?.fieldFilter) {
          const { field, op, value } = q.where.fieldFilter;
          rows = rows.filter(([name, d]) => {
            const v = valueAt(name, d, field.fieldPath);
            if (!v) return false;
            const c = cmp(v, value);
            return op === 'GREATER_THAN' ? c > 0 : op === 'GREATER_THAN_OR_EQUAL' ? c >= 0 : op === 'LESS_THAN' ? c < 0 : c === 0;
          });
        }
        const order = q.orderBy || [{ field: { fieldPath: '__name__' } }];
        rows = rows.filter(([name, d]) => order.every((o) => valueAt(name, d, o.field.fieldPath)));
        const key = (name, d) => order.map((o) => valueAt(name, d, o.field.fieldPath));
        rows.sort((a, b) => {
          const ka = key(...a);
          const kb = key(...b);
          for (let i = 0; i < ka.length; i++) {
            const c = cmp(ka[i], kb[i]);
            if (c) return c;
          }
          return 0;
        });
        if (q.startAt) {
          rows = rows.filter(([name, d]) => {
            const k = key(name, d);
            for (let i = 0; i < q.startAt.values.length; i++) {
              const c = cmp(k[i], q.startAt.values[i]);
              if (c) return c > 0;
            }
            return q.startAt.before !== false;
          });
        }
        if (q.limit) rows = rows.slice(0, q.limit);
        const readTime = now();
        if (!rows.length) return json(200, [{ readTime }]);
        return json(200, rows.map(([name, d]) => ({ document: { name, fields: d.fields, updateTime: d.updateTime }, readTime })));
      }
      // Einzelnes Dokument lesen
      if ((init.method || 'GET') === 'GET') {
        if (!uid || ownerOf(path) !== uid) return err(403, 'Missing or insufficient permissions.', 'PERMISSION_DENIED');
        const d = docs.get(path);
        if (!d) return err(404, `Document "${path}" not found.`, 'NOT_FOUND');
        return json(200, { name: path, fields: d.fields, updateTime: d.updateTime });
      }
    }
    return err(404, 'Unbekannter Endpunkt', 'NOT_FOUND');
  }

  return {
    cfg: { apiKey, projectId },
    fetch: (url, init) => handle(url, init),
    handle,
    docs,
    users,
    log,
    root,
    /**
     * Alles, was die Cloud speichert, als Text; Byte-Felder dekodiert (latin1), damit ein Klartext-Test nicht
     * zufällig im Base64-Text eines Chiffrats anschlägt.
     */
    dump: () => {
      const plain = (v) => {
        if (Array.isArray(v)) return v.map(plain);
        if (v && typeof v === 'object') {
          if ('bytesValue' in v) return Buffer.from(v.bytesValue, 'base64').toString('latin1');
          return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, plain(x)]));
        }
        return v;
      };
      return [...docs.entries()].map(([name, d]) => `${name} ${JSON.stringify(plain(d.fields))}`).join('\n');
    },
    expireTokens: () => tokens.clear(),
    revokeRefresh: () => refresh.clear(),
  };
}
