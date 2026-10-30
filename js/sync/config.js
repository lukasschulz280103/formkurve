// Wo die Firebase-Zugangsdaten herkommen: zuerst eine auf diesem Gerät eingefügte Konfiguration,
// sonst die Datei sync-config.js im Repository (gilt für alle Geräte und Freunde).
// apiKey und projectId sind nicht geheim; den Zugriff regeln die Firestore-Regeln und die Anmeldung.

const LS_KEY = 'formkurve.sync-config';

function valid(c) {
  if (!c || typeof c.apiKey !== 'string' || typeof c.projectId !== 'string') return null;
  const apiKey = c.apiKey.trim();
  const projectId = c.projectId.trim();
  if (!/^[A-Za-z0-9_-]{20,60}$/.test(apiKey) || !/^[a-z0-9-]{4,40}$/.test(projectId)) return null;
  return { apiKey, projectId };
}

function readLocal() {
  try {
    return valid(JSON.parse(globalThis.localStorage?.getItem(LS_KEY) || 'null'));
  } catch {
    return null;
  }
}

/** Aktive Konfiguration oder null (dann gibt es nur Konten auf diesem Gerät). */
export function syncConfig() {
  if (globalThis.FORMKURVE_PREVIEW) return null;
  return readLocal() || valid(globalThis.FORMKURVE_SYNC);
}

export function configSource() {
  if (readLocal()) return 'device';
  if (valid(globalThis.FORMKURVE_SYNC)) return 'site';
  return null;
}

/** Liest apiKey und projectId aus dem Schnipsel, den Firebase beim Registrieren der Web-App zeigt. */
export function parseFirebaseConfig(text) {
  const t = String(text || '');
  const grab = (name) => t.match(new RegExp(`["']?${name}["']?\\s*:\\s*["']([^"']+)["']`))?.[1];
  return valid({ apiKey: grab('apiKey') || '', projectId: grab('projectId') || '' });
}

export function saveDeviceConfig(cfg) {
  const c = valid(cfg);
  if (!c) throw new Error('apiKey oder projectId fehlt oder sieht falsch aus.');
  try {
    globalThis.localStorage.setItem(LS_KEY, JSON.stringify(c));
  } catch {
    throw new Error('Dieser Browser erlaubt keinen lokalen Speicher für die Einstellung.');
  }
  return c;
}

export function clearDeviceConfig() {
  try {
    globalThis.localStorage.removeItem(LS_KEY);
  } catch {
    // nichts zu tun
  }
}

/** Inhalt für die Datei sync-config.js im Repository. */
export function configFileContent(cfg) {
  const c = valid(cfg);
  return `// Formkurve: Zugang zum eigenen Firebase-Projekt für die Geräte-Synchronisation.
// Diese Werte sind nicht geheim. Die Daten verschlüsselt die App, bevor sie das Gerät verlassen.
window.FORMKURVE_SYNC = {
  apiKey: '${c.apiKey}',
  projectId: '${c.projectId}',
};
`;
}

export const FIRESTORE_RULES = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Jede Person sieht nur ihren eigenen Bereich; alles darin ist auf dem Gerät verschlüsselt.
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
`;
