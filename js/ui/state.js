// Globaler App-Zustand mit einfachem Abo-Mechanismus und allen Aktionen.
import { useState, useEffect } from '../vendor/preact-htm.js';
import { Repo, DB_DEMO } from '../data/repo.js';
import { allowMemoryFallback, StorageError } from '../data/db.js';
import { computeAll } from '../model/pipeline.js';
import { computeInsights } from '../analysis/insights.js';
import { generateDemo } from '../demo/generate.js';
import { todayKey, addDays, diffDays, dateKey } from '../core/time.js';
import { setPath } from '../core/config.js';
import { parseShortcutText } from '../import/shortcut.js';
import { importHealthFile } from '../import/healthExport.js';
import { fetchContext } from '../context/weather.js';
import { currentPosition, permissionState, distanceKm } from '../context/location.js';
import * as accounts from '../auth/accounts.js';
import { syncConfig } from '../sync/config.js';
import { SyncEngine, linkNewOnlineAccount, signInOnline, unlockWithCode, storeLink, sendPasswordReset } from '../sync/engine.js';
import { emptyDay } from '../journal/journal.js';
import { monthOf, shiftMonth } from '../model/calendar.js';
import { pendingChecks } from '../survey/engine.js';

const ROUTES = ['heute', 'logbuch', 'verlauf', 'profil'];
// Unterseiten im Reiter „Profil“
export const PROFILE_PAGES = ['einsichten', 'konto', 'daten', 'koerper', 'umwelt', 'einstellungen', 'backup', 'info'];
// Frühere Reiter (bis Version 0.5.0) und ihre neue Stelle, damit alte Links und Lesezeichen weiter passen
const LEGACY = { einsichten: ['profil', 'einsichten'], daten: ['profil', null], check: ['heute', null] };

export const state = {
  ready: false,
  auth: 'loading', // loading | out | in | demo
  account: null,
  accounts: [],
  authStep: 'welcome', // welcome | create | login | recover | online | online-code | online-pin
  authAccountId: null,
  onboarding: null, // null | code | online | location | profile
  sync: null, // { linked, state, lastSync, error, email } des angemeldeten Kontos
  online: null, // Anzeige-Infos während der Anmeldung eines neuen Geräts (ohne Geheimnisse)
  recoveryCode: null,
  repo: null,
  demo: false,
  results: { dates: [], days: new Map() },
  version: 0,
  insights: null,
  insightsVersion: -1,
  insightsBusy: false,
  insightsProgress: 0,
  route: 'heute',
  sub: null, // Unterseite im Reiter „Profil“ oder null für die Übersicht
  checkOpen: false, // Check-in als Blatt über dem aktuellen Reiter
  date: todayKey(),
  today: todayKey(),
  homeView: 'day', // „Heute“ als Tagesansicht oder Monatskalender
  calMonth: null, // angezeigter Monat im Kalender, null = Monat des gewählten Tages
  toast: null,
  busy: null,
  progress: null,
  lastImport: null,
  contextStatus: null,
  info: null,
  showScoresAnyway: false,
  checkSlot: null,
  checkDate: null,
  journalDate: null, // null = laufender Logbuch-Tag
  journalTab: 'tag', // tag | rueckblick
  journalVersion: 0,
  hostTheme: null,
  preview: false,
};

const subs = new Set();

export function update(patch = {}) {
  Object.assign(state, patch);
  for (const fn of subs) fn();
}

export function useAppState() {
  const [, force] = useState(0);
  useEffect(() => {
    const fn = () => force((x) => x + 1);
    subs.add(fn);
    return () => subs.delete(fn);
  }, []);
  return state;
}

let toastTimer = null;
/** Kurze Meldung; action = { label, run } zeigt einen Knopf (zum Beispiel „Rückgängig“). */
export function toast(text, kind = 'ok', action = null) {
  clearTimeout(toastTimer);
  update({ toast: { text, kind, action } });
  toastTimer = setTimeout(() => update({ toast: null }), action ? 5500 : 3400);
}

function safe(fn, fallback = null) {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

/** Zu einem Reiter wechseln; im Reiter „Profil“ optional direkt auf eine Unterseite. Schließt ein offenes Check-in-Blatt. */
export function navigate(route, sub = null) {
  if (LEGACY[route]) {
    sub = sub ?? LEGACY[route][1];
    route = LEGACY[route][0];
  }
  if (!ROUTES.includes(route)) route = 'heute';
  if (route !== 'profil' || !PROFILE_PAGES.includes(sub)) sub = null;
  const changed = state.route !== route || state.sub !== sub;
  if (changed || state.checkOpen) update({ route, sub, checkOpen: false });
  writeHash(true);
  if (changed) window.scrollTo?.(0, 0);
}

/** Schreibt die Adresse passend zur Ansicht („#profil/konto“); alte Formen wie „#daten“ werden ersetzt. */
function writeHash(always) {
  safe(() => {
    const hash = `#${state.sub ? `${state.route}/${state.sub}` : state.route}`;
    if (location.hash !== hash && (always || location.hash)) history.replaceState(null, '', hash);
  });
}

/** Liest „#profil/konto“ und ältere Formen wie „#daten“. */
export function parseRoute(hash) {
  const [r, s] = String(hash || '').replace(/^#/, '').split('/');
  if (LEGACY[r]) return { route: LEGACY[r][0], sub: LEGACY[r][1] };
  if (!ROUTES.includes(r)) return { route: 'heute', sub: null };
  return { route: r, sub: r === 'profil' && PROFILE_PAGES.includes(s) ? s : null };
}

export function openInfo(k, value = null, extra = {}) {
  update({ info: { k, value, extra } });
}

export function closeInfo() {
  update({ info: null });
}

export function applyTheme() {
  const root = document.documentElement;
  const t = state.repo?.settings?.display?.theme || 'auto';
  if (t === 'dark' || t === 'light') root.setAttribute('data-theme', t);
  else if (state.hostTheme) root.setAttribute('data-theme', state.hostTheme);
  else root.removeAttribute('data-theme');
}

export function recompute() {
  const repo = state.repo;
  if (!repo) return;
  const today = todayKey();
  const results = computeAll({ index: repo.index, workouts: repo.workouts, survey: repo.survey, journal: repo.journal, context: repo.context, settings: repo.settings, today });
  update({ results, version: state.version + 1, today, date: state.date > today ? today : state.date });
}

async function seedDemo(repo) {
  const demo = generateDemo({ days: 90, endDate: todayKey() });
  await repo.addSamples(demo.samples, demo.workouts);
  for (const [d, rec] of demo.survey) await repo.saveSurvey(d, rec);
  for (const [d, rec] of demo.journal) await repo.saveJournal(d, rec);
  await repo.saveContext(demo.context);
  const profile = { ...repo.settings.profile, birthYear: new Date().getFullYear() - 30, sex: 'm', heightCm: 182, weightKg: 78 };
  await repo.saveSettings({ ...repo.settings, profile, context: { ...repo.settings.context, enabled: true, place: { name: 'Berlin', region: 'Beispielort', lat: 52.52, lon: 13.41 } } });
  await repo.finishImport({ kind: 'demo', parsed: demo.samples.length, added: demo.samples.length, at: Date.now(), workouts: demo.workouts.length });
}

/** Öffnet die Beispieldaten und erzeugt sie neu, wenn sie fehlen oder älter als ein Tag sind. */
async function openDemo() {
  const repo = await Repo.open(DB_DEMO);
  const last = repo.index?.lastSample || 0;
  if (!repo.buckets.size || Date.now() - last > 36 * 3600000) {
    if (repo.buckets.size) await repo.clearAll();
    await seedDemo(repo);
  }
  return repo;
}

async function requestPersistence() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist();
  } catch {
    // nicht kritisch
  }
}

function routeFromHash() {
  return parseRoute(safe(() => location.hash, ''));
}

async function enterRepo(repo, patch, key = null, { run = true } = {}) {
  stopSync();
  state.repo?.close?.();
  sessionKey = key;
  update({ repo, insights: null, insightsVersion: -1, date: todayKey(), showScoresAnyway: false, lastImport: repo.meta.lastSummary || null, ...routeFromHash(), checkOpen: false, journalDate: null, homeView: 'day', calMonth: null, sync: null, ...patch });
  writeHash(false);
  applyTheme();
  recompute();
  if (key) await startSync({ run }).catch((e) => console.warn('Sync-Start', e));
}

// ---------- Geräte-Synchronisation ----------

let sessionKey = null; // Datenschlüssel des angemeldeten Kontos (nicht exportierbar)
let engine = null;
let syncTimer = null;
let onlinePending = null; // Zwischenstand beim Anmelden eines neuen Geräts: { session, keys, unlocked }

function syncPatch(st = {}) {
  if (!engine) return update({ sync: null });
  update({ sync: { ...(state.sync || {}), ...st, linked: engine.linked, email: engine.auth?.email || null } });
}

function onVisible() {
  if (document.visibilityState === 'visible') runSync();
}

function stopSync() {
  clearInterval(syncTimer);
  syncTimer = null;
  document.removeEventListener('visibilitychange', onVisible);
  engine?.stop();
  engine = null;
}

/** Richtet die Synchronisation für das angemeldete Konto ein (wenn eine Firebase-Konfiguration vorliegt). */
async function startSync({ run = true } = {}) {
  stopSync();
  const cfg = syncConfig();
  if (!cfg || !state.repo || state.demo || !sessionKey) return update({ sync: null });
  const e = new SyncEngine({
    repo: state.repo,
    key: sessionKey,
    cfg,
    onStatus: (st) => engine === e && syncPatch(st),
    onApplied: () => engine === e && recompute(),
  });
  engine = e;
  await e.load();
  syncPatch(e.status);
  if (!e.linked) return;
  syncTimer = setInterval(() => document.visibilityState === 'visible' && runSync(), 60000);
  document.addEventListener('visibilitychange', onVisible);
  if (run) runSync();
}

/** Gleicht jetzt ab; Fehler landen im Status, nicht als Ausnahme. */
export function runSync(opts) {
  if (!engine?.linked) return Promise.resolve(null);
  return engine.sync(opts).catch((err) => {
    console.warn('Abgleich', err);
    return null;
  });
}

const fmtCount = (n) => new Intl.NumberFormat('de-DE').format(n);

function progressText(p, what) {
  if (p.phase === 'pull') return `${what} … ${fmtCount(p.done)} Einträge geprüft`;
  return `Verschlüsselt hochladen … ${fmtCount(p.done)} von ${fmtCount(p.total)}`;
}

/** Erstes Gerät: angemeldetes Konto mit einem neuen Online-Konto verbinden und alles hochladen. */
export async function linkOnline(email, password) {
  const cfg = syncConfig();
  if (!cfg) throw new Error('Online-Konten sind auf dieser Seite noch nicht eingerichtet.');
  if (String(password).length < 8) throw new Error('Das Passwort braucht mindestens 8 Zeichen.');
  update({ busy: 'Online-Konto wird angelegt …' });
  try {
    const recovery = await accounts.recoveryOf(state.account.id);
    const res = await linkNewOnlineAccount({ repo: state.repo, key: sessionKey, cfg, email, password, name: state.account.name, recovery });
    const account = await accounts.setCloud(state.account.id, { uid: res.uid, email: res.email });
    update({ account, accounts: await accounts.listAccounts() });
    await startSync({ run: false });
    await engine.markAll();
    update({ busy: 'Verschlüsselt hochladen …' });
    await engine.sync({ progress: (p) => update({ busy: progressText(p, 'Abgleich') }) });
    toast('Online-Konto verbunden');
  } finally {
    update({ busy: null });
  }
}

/** Neues Gerät, Schritt 1: E-Mail und Passwort. */
export async function onlineSignIn(email, password) {
  const cfg = syncConfig();
  if (!cfg) throw new Error('Online-Konten sind auf dieser Seite noch nicht eingerichtet.');
  update({ busy: 'Anmelden …' });
  try {
    const { session, keys } = await signInOnline({ cfg, email, password });
    const existing = await accounts.findByCloudUid(session.uid);
    if (existing) {
      onlinePending = null;
      update({ authStep: 'login', authAccountId: existing.id, online: null });
      toast(`Dieses Online-Konto ist hier schon eingerichtet. Melde dich mit der PIN von „${existing.name}“ an.`);
      return;
    }
    onlinePending = { session, keys, unlocked: null };
    update({ authStep: 'online-code', online: { email: session.email || email.trim() } });
  } finally {
    update({ busy: null });
  }
}

/** Neues Gerät, Schritt 2: Wiederherstellungscode öffnet den Datenschlüssel. */
export async function onlineUnlock(code) {
  if (!onlinePending) throw new Error('Bitte zuerst mit E-Mail und Passwort anmelden.');
  update({ busy: 'Code wird geprüft …' });
  try {
    onlinePending.unlocked = await unlockWithCode(onlinePending.keys, code);
    update({ authStep: 'online-pin', online: { ...state.online, name: onlinePending.unlocked.name } });
  } finally {
    update({ busy: null });
  }
}

/** Neues Gerät, Schritt 3: PIN für dieses Gerät, dann alle Daten laden. */
export async function onlineFinish(pin, remember) {
  if (!onlinePending?.unlocked) throw new Error('Bitte zuerst den Wiederherstellungscode eingeben.');
  const { session, unlocked } = onlinePending;
  update({ busy: 'Konto wird eingerichtet …' });
  try {
    const { account, key } = await accounts.createAccountWithKey(unlocked.name, pin, unlocked.dataKey, unlocked.recovery, { uid: session.uid, email: session.email });
    if (remember) await accounts.saveSession(account.id, key);
    const repo = await Repo.open(accounts.accountDbName(account.id), { key });
    await storeLink(repo, { session, idk: unlocked.idk, epoch: unlocked.epoch });
    onlinePending = null;
    await enterRepo(repo, { auth: 'in', account, demo: false, accounts: await accounts.listAccounts(), onboarding: null, online: null }, key, { run: false });
    requestPersistence();
    update({ busy: 'Deine Daten werden geladen …' });
    await engine.sync({ progress: (p) => update({ busy: progressText(p, 'Deine Daten werden geladen') }) });
    recompute();
    // Standort gilt je Gerät; das Profil kommt schon aus der Cloud
    update({ onboarding: 'location' });
    toast('Alles da. Dieses Gerät gleicht ab jetzt automatisch ab.');
  } finally {
    update({ busy: null });
  }
}

export function onlineCancel() {
  onlinePending = null;
  update({ authStep: 'welcome', online: null });
}

/** Passwort vergessen: Firebase schickt eine E-Mail mit einem Link zum Zurücksetzen. */
export async function onlineResetPassword(email) {
  const cfg = syncConfig();
  if (!cfg) throw new Error('Online-Konten sind auf dieser Seite noch nicht eingerichtet.');
  try {
    await sendPasswordReset({ cfg, email });
  } catch (e) {
    // Ob es die Adresse gibt, verrät die Antwort bewusst nicht
    if (e.code !== 'EMAIL_NOT_FOUND') throw e;
  }
}

/** Nach Passwortwechsel oder abgelaufener Anmeldung auf diesem Gerät neu anmelden. */
export async function onlineReauth(password) {
  if (!engine) throw new Error('Kein Online-Konto verbunden.');
  await engine.reauth(password);
  await runSync();
}

/** Verbindung auf diesem Gerät lösen; Daten bleiben hier und in der Cloud. */
export async function onlineUnlink() {
  if (!engine) return;
  await engine.forget();
  const account = await accounts.setCloud(state.account.id, null);
  update({ account, accounts: await accounts.listAccounts() });
  await startSync();
  toast('Verbindung gelöst. Die Daten bleiben auf diesem Gerät.');
}

/** Online-Konto samt Cloud-Daten löschen (alle Geräte); dieses Gerät behält seine Daten. */
export async function onlineDelete(password) {
  if (!engine) return;
  update({ busy: 'Online-Konto wird gelöscht …' });
  try {
    await engine.deleteOnlineAccount(password);
    const account = await accounts.setCloud(state.account.id, null);
    update({ account, accounts: await accounts.listAccounts() });
    await startSync();
    toast('Online-Konto gelöscht. Die Daten auf diesem Gerät bleiben.');
  } finally {
    update({ busy: null });
  }
}

/** Neuer Wiederherstellungscode; bei verbundenem Konto zuerst in der Cloud, damit beide gleich bleiben. */
export async function renewRecovery(pin) {
  const id = state.account.id;
  const { code, recovery } = await accounts.prepareRecoveryCode(id, pin);
  if (engine?.linked) await engine.updateRecovery(recovery);
  await accounts.setRecovery(id, recovery);
  return code;
}

/** Alle Daten löschen: bei verbundenem Konto auf allen Geräten (Einstellungen bleiben), sonst nur hier. */
export async function wipeAllData() {
  if (engine?.linked) {
    update({ busy: 'Daten werden auf allen Geräten gelöscht …' });
    try {
      await engine.wipeEverywhere();
      for (const store of ['context']) await state.repo.db.clear(store);
      state.repo.context = new Map();
    } finally {
      update({ busy: null });
    }
  } else {
    await state.repo.clearAll();
  }
  recompute();
}

export async function boot({ preview = false } = {}) {
  state.hostTheme = document.documentElement.getAttribute('data-theme');
  update({ preview });
  if (preview) {
    allowMemoryFallback(true);
    const repo = await openDemo();
    await enterRepo(repo, { auth: 'demo', demo: true });
    update({ ready: true });
    return;
  }
  const list = await accounts.listAccounts();
  let session = null;
  try {
    session = await accounts.loadSession();
  } catch {
    session = null;
  }
  if (session) {
    try {
      const repo = await Repo.open(accounts.accountDbName(session.account.id), { key: session.key });
      await enterRepo(repo, { auth: 'in', account: session.account, accounts: list, demo: false }, session.key);
      update({ ready: true });
      requestPersistence();
      autoContext();
      return;
    } catch (e) {
      // Speicher nicht erreichbar: nicht abmelden, sondern den Fehler zeigen (die Daten sind noch da)
      if (e instanceof StorageError) throw e;
      console.warn('Sitzung ungültig', e);
      await accounts.clearSession();
    }
  }
  update({ auth: 'out', accounts: list, authStep: list.length ? 'welcome' : 'welcome', ready: true });
}

// ---------- Konten ----------

export function authGo(step, accountId = state.authAccountId) {
  update({ authStep: step, authAccountId: accountId });
}

export async function createAccount(name, pin, remember) {
  update({ busy: 'Konto wird angelegt …' });
  try {
    const { account, key, recoveryCode } = await accounts.createAccount(name, pin);
    if (remember) await accounts.saveSession(account.id, key);
    const repo = await Repo.open(accounts.accountDbName(account.id), { key });
    const moved = await repo.importLegacy();
    await enterRepo(repo, { auth: 'in', account, demo: false, accounts: await accounts.listAccounts(), onboarding: 'code', recoveryCode }, key);
    requestPersistence();
    if (moved) toast('Deine bisherigen Daten sind jetzt in diesem Konto.');
  } finally {
    update({ busy: null });
  }
}

export async function signIn(id, pin, remember) {
  update({ busy: 'Anmelden …' });
  try {
    const { account, key } = await accounts.login(id, pin);
    if (remember) await accounts.saveSession(account.id, key);
    const repo = await Repo.open(accounts.accountDbName(account.id), { key });
    await enterRepo(repo, { auth: 'in', account, demo: false, accounts: await accounts.listAccounts(), onboarding: null }, key);
    requestPersistence();
    autoContext();
  } finally {
    update({ busy: null });
  }
}

export async function recoverAccount(id, code, pin, remember) {
  update({ busy: 'PIN wird zurückgesetzt …' });
  try {
    const { account, key } = await accounts.recover(id, code, pin);
    if (remember) await accounts.saveSession(account.id, key);
    const repo = await Repo.open(accounts.accountDbName(account.id), { key });
    await enterRepo(repo, { auth: 'in', account, demo: false, accounts: await accounts.listAccounts(), onboarding: null }, key);
    toast('Neue PIN gespeichert');
    autoContext();
  } finally {
    update({ busy: null });
  }
}

export async function signOut() {
  stopSync();
  sessionKey = null;
  await accounts.clearSession();
  state.repo?.close?.();
  update({ auth: 'out', account: null, repo: null, demo: false, results: { dates: [], days: new Map() }, insights: null, accounts: await accounts.listAccounts(), authStep: 'welcome', onboarding: null, route: 'heute', sub: null, checkOpen: false, homeView: 'day', sync: null });
}

export async function tryDemo() {
  update({ busy: 'Beispieldaten werden erzeugt …' });
  try {
    const repo = await openDemo();
    await enterRepo(repo, { auth: 'demo', demo: true, account: null });
  } finally {
    update({ busy: null });
  }
}

export async function leaveDemo() {
  state.repo?.close?.();
  update({ auth: 'out', repo: null, demo: false, results: { dates: [], days: new Map() }, accounts: await accounts.listAccounts(), authStep: 'welcome', route: 'heute', sub: null, checkOpen: false, homeView: 'day' });
}

export async function resetDemo() {
  update({ busy: 'Beispieldaten werden neu erzeugt …' });
  await state.repo.clearAll();
  await seedDemo(state.repo);
  update({ busy: null, insights: null, insightsVersion: -1 });
  recompute();
}

export async function deleteCurrentAccount() {
  const id = state.account?.id;
  if (!id) return;
  stopSync();
  sessionKey = null;
  state.repo?.close?.();
  await accounts.deleteAccount(id);
  update({ auth: 'out', account: null, repo: null, results: { dates: [], days: new Map() }, accounts: await accounts.listAccounts(), authStep: 'welcome', route: 'heute', sub: null, checkOpen: false, homeView: 'day', sync: null });
  toast('Konto auf diesem Gerät gelöscht');
}

export function finishOnboarding(step) {
  const order = ['code', 'online', 'location', 'profile'];
  const p = state.repo?.settings?.profile || {};
  const skip = {
    // Online-Konto nur anbieten, wenn eingerichtet und noch nicht verbunden
    online: !syncConfig() || Boolean(state.sync?.linked),
    // Profil schon vorhanden (zum Beispiel von einem anderen Gerät übernommen)
    profile: Boolean(p.birthYear && p.sex),
  };
  let i = order.indexOf(step) + 1;
  while (i < order.length && skip[order[i]]) i++;
  const next = order[i] || null;
  update({ onboarding: next, recoveryCode: step === 'code' ? null : state.recoveryCode });
  if (!next) navigate('heute');
}

// ---------- Daten ----------

/** Import aus Kurzbefehl-Text (Zwischenablage oder Datei). */
export async function importShortcutText(text) {
  const { samples, stats } = parseShortcutText(text);
  if (!samples.length) {
    update({ lastImport: { kind: 'shortcut', ...stats, at: Date.now(), added: 0 } });
    throw new Error(stats.lines ? 'Keine verwertbaren Zeilen gefunden. Prüfe das Format in der Anleitung.' : 'Der Text ist leer.');
  }
  update({ busy: 'Importiere …' });
  try {
    const added = await state.repo.addSamples(samples);
    const summary = { kind: 'shortcut', ...stats, added, at: Date.now() };
    await state.repo.finishImport(summary);
    update({ lastImport: summary });
    recompute();
    return summary;
  } finally {
    update({ busy: null });
  }
}

/** Import des Apple-Health-Gesamtexports. */
export async function importHealthExport(file) {
  const settings = state.repo.settings;
  const sinceMs = Date.now() - settings.import.windowDays * 86400000;
  let added = 0;
  update({ busy: 'Lese Apple-Health-Export …', progress: { ratio: 0, records: 0, total: file.size } });
  try {
    const stats = await importHealthFile(file, {
      sinceMs,
      onProgress: (ratio, s) => update({ progress: { ratio, records: s.records, used: s.used, total: file.size } }),
      onBatch: async (samples, workouts) => {
        added += await state.repo.addSamples(samples, workouts);
      },
    });
    const summary = { kind: 'export', ...stats, parsed: stats.used, added, at: Date.now(), file: file.name };
    await state.repo.finishImport(summary);
    update({ lastImport: summary });
    recompute();
    return summary;
  } finally {
    update({ busy: null, progress: null });
  }
}

export async function saveSurvey(date, slot, answers, backfilled) {
  const repo = state.repo;
  const prev = repo.survey.get(date) || { a: {}, ts: {}, backfilled: {} };
  const rec = { a: { ...prev.a, ...answers }, ts: { ...prev.ts, [slot]: Date.now() }, backfilled: { ...prev.backfilled, [slot]: Boolean(backfilled) } };
  for (const [k, v] of Object.entries(rec.a)) if (v === undefined) delete rec.a[k];
  await repo.saveSurvey(date, rec);
  recompute();
}

// ---------- Logbuch ----------

let recomputeTimer = null;
/** Neu rechnen, sobald eine Folge schneller Eingaben vorbei ist (die Logbuch-Ansicht liest direkt aus dem Speicher). */
function recomputeSoon() {
  clearTimeout(recomputeTimer);
  recomputeTimer = setTimeout(() => {
    if (state.repo) recompute();
  }, 700);
}

/** Ändert einen Logbuch-Tag: fn bekommt den bisherigen Stand und gibt den neuen zurück. */
export async function changeJournal(date, fn) {
  const repo = state.repo;
  const next = fn(repo.journal.get(date) || emptyDay());
  const saving = repo.saveJournal(date, next);
  update({ journalVersion: state.journalVersion + 1 });
  await saving;
  recomputeSoon();
  return next;
}

export function openJournal(date = null, tab = 'tag') {
  update({ journalDate: date, journalTab: tab });
  navigate('logbuch');
}

export async function saveSettings(settings) {
  await state.repo.saveSettings(settings);
  applyTheme();
  recompute();
}

export async function patchSettings(path, value) {
  await saveSettings(setPath(state.repo.settings, path, value));
}

// ---------- Umwelt ----------

/** Lädt Wetter, Luft und Pollen für den gespeicherten Ort. */
export async function refreshContext({ quiet = false, pastDays = null } = {}) {
  const settings = state.repo.settings;
  const place = settings.context.place;
  if (!place) throw new Error('Kein Ort gewählt.');
  const last = state.repo.meta.lastContext;
  const days = pastDays ?? (last ? Math.min(92, Math.max(2, diffDays(dateKey(last), todayKey()) + 2)) : 92);
  if (!quiet) update({ busy: 'Lade Wetter und Luftqualität …' });
  update({ contextStatus: 'lädt' });
  try {
    const map = await fetchContext(place, days);
    await state.repo.saveContext(map);
    recompute();
    update({ contextStatus: null });
    return map.size;
  } catch (e) {
    update({ contextStatus: state.preview ? 'In der Vorschau sind externe Abfragen gesperrt.' : 'Wetterdaten gerade nicht erreichbar.' });
    throw e;
  } finally {
    if (!quiet) update({ busy: null });
  }
}

/** Standort holen (fragt beim ersten Mal nach Erlaubnis) und Umweltdaten laden. */
export async function useCurrentLocation({ prompt = true, refresh = true } = {}) {
  const settings = state.repo.settings;
  const perm = await permissionState();
  if (!prompt && perm !== 'granted') return false;
  const pos = await currentPosition();
  const prev = settings.context.place;
  const moved = !prev || prev.source !== 'gps' || distanceKm(prev, pos) > 25;
  const place = moved ? { ...pos, source: 'gps', since: todayKey() } : { ...prev, ...pos };
  await saveSettings(setPath(setPath(setPath(settings, 'context.place', place), 'context.enabled', true), 'context.auto', true));
  if (!refresh) return true;
  const firstTime = !state.repo.meta.lastContext;
  await refreshContext({ quiet: true, pastDays: firstTime ? 92 : moved ? 2 : null }).catch(() => {});
  return true;
}

/** Beim Start: Standort im Hintergrund prüfen und Umweltdaten aktualisieren. */
export async function autoContext() {
  try {
    const s = state.repo?.settings;
    if (!s?.context?.enabled) return;
    const last = state.repo.meta.lastContext || 0;
    if (s.context.auto) await useCurrentLocation({ prompt: false }).catch(() => {});
    if (Date.now() - (state.repo.meta.lastContext || last) > 3 * 3600000 && s.context.place) await refreshContext({ quiet: true }).catch(() => {});
  } catch {
    // still bleiben: Umweltdaten sind ein Zusatz
  }
}

// ---------- Analyse und Navigation ----------

export async function runInsights(force = false) {
  if (state.insightsBusy) return;
  if (!force && state.insights && state.insightsVersion === state.version) return;
  const version = state.version;
  update({ insightsBusy: true, insightsProgress: 0 });
  try {
    const res = state.results;
    const insights = await computeInsights({
      dates: res.dates,
      days: res.days,
      survey: state.repo.survey,
      journal: state.repo.journal,
      settings: state.repo.settings,
      onProgress: (p) => update({ insightsProgress: p }),
    });
    update({ insights, insightsVersion: version });
  } catch (e) {
    console.error(e);
    toast('Analyse fehlgeschlagen', 'error');
  } finally {
    update({ insightsBusy: false });
  }
}

export function shiftDate(n) {
  const next = addDays(state.date, n);
  const first = firstDataDay();
  if (next > state.today || (first && next < first)) return;
  update({ date: next });
}

let entryDay = { repo: null, n: -1, day: null };

function minKey(keys) {
  let min = null;
  for (const k of keys) if (min === null || k < min) min = k;
  return min;
}

/** Erster Tag mit eigenen Eingaben (Check-in oder Logbuch); davor gab es das Konto noch nicht. */
export function firstEntryDay() {
  const repo = state.repo;
  if (!repo) return null;
  // Der früheste Tag ändert sich nur, wenn ein Tag dazukommt oder wegfällt
  const n = repo.survey.size + repo.journal.size;
  if (entryDay.repo === repo && entryDay.n === n) return entryDay.day;
  const a = minKey(repo.survey.keys());
  const b = minKey(repo.journal.keys());
  const day = !a || (b && b < a) ? b || a : a;
  entryDay = { repo, n, day };
  return day;
}

/** Noch offene Checks im Nachtragefenster, der neueste zuerst. */
export function openChecks() {
  const repo = state.repo;
  if (!repo) return [];
  // Ohne jede Eingabe fängt das Konto heute an; sonst gäbe es sofort Nachträge aus der Zeit davor
  return pendingChecks(repo.survey, { settings: repo.settings, today: state.today, since: firstEntryDay() || state.today });
}

/** Frühester Tag, den die App zeigen kann: Messwerte oder eigene Eingaben. */
export function firstDataDay() {
  const d = state.results.dates[0] || null;
  const e = firstEntryDay();
  return !d || (e && e < d) ? e || d : d;
}

/** Zwischen Tagesansicht und Monatskalender auf „Heute“ umschalten. */
export function setHomeView(view) {
  const month = view === 'month';
  update({ homeView: month ? 'month' : 'day', calMonth: month ? monthOf(state.date) : state.calMonth });
}

/** Im Kalender einen Monat vor oder zurück. */
export function shiftCalMonth(n) {
  update({ calMonth: shiftMonth(state.calMonth || monthOf(state.date), n) });
}

/** Einen Tag aus dem Kalender öffnen. */
export function openDay(date) {
  update({ date, homeView: 'day', calMonth: monthOf(date) });
  window.scrollTo?.(0, 0);
}

// Wohin der Fokus nach dem Schließen des Check-in-Blatts zurückkehrt (der Knopf, der es geöffnet hat)
let checkOpener = null;

/** Öffnet den Check-in als Blatt über dem aktuellen Reiter; ohne Angaben den Check, der gerade dran ist. */
export function openCheck(slot = null, date = null) {
  checkOpener = safe(() => document.activeElement);
  update({ checkSlot: slot, checkDate: date, checkOpen: true, info: null });
}

/** Der Knopf, der das Blatt geöffnet hat; nur einmal abrufbar. */
export function takeCheckOpener() {
  const el = checkOpener;
  checkOpener = null;
  return el;
}

export function closeCheck() {
  update({ checkOpen: false, checkSlot: null, checkDate: null });
}

export { accounts };
