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

const ROUTES = ['heute', 'verlauf', 'check', 'einsichten', 'daten'];

export const state = {
  ready: false,
  auth: 'loading', // loading | out | in | demo
  account: null,
  accounts: [],
  authStep: 'welcome', // welcome | create | login | recover
  authAccountId: null,
  onboarding: null, // null | code | location | profile
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
  date: todayKey(),
  today: todayKey(),
  toast: null,
  busy: null,
  progress: null,
  lastImport: null,
  contextStatus: null,
  info: null,
  showScoresAnyway: false,
  checkSlot: null,
  checkDate: null,
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
export function toast(text, kind = 'ok') {
  clearTimeout(toastTimer);
  update({ toast: { text, kind } });
  toastTimer = setTimeout(() => update({ toast: null }), 3400);
}

function safe(fn, fallback = null) {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

export function navigate(route) {
  if (!ROUTES.includes(route)) route = 'heute';
  if (state.route !== route) {
    update({ route });
    safe(() => {
      if (location.hash !== `#${route}`) history.replaceState(null, '', `#${route}`);
    });
    window.scrollTo?.(0, 0);
  }
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
  const results = computeAll({ index: repo.index, workouts: repo.workouts, survey: repo.survey, context: repo.context, settings: repo.settings, today });
  update({ results, version: state.version + 1, today, date: state.date > today ? today : state.date });
}

async function seedDemo(repo) {
  const demo = generateDemo({ days: 90, endDate: todayKey() });
  await repo.addSamples(demo.samples, demo.workouts);
  for (const [d, rec] of demo.survey) await repo.saveSurvey(d, rec);
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
  const hash = safe(() => location.hash.replace('#', ''), '');
  return ROUTES.includes(hash) ? hash : 'heute';
}

async function enterRepo(repo, patch) {
  state.repo?.close?.();
  update({ repo, insights: null, insightsVersion: -1, date: todayKey(), showScoresAnyway: false, lastImport: repo.meta.lastSummary || null, route: routeFromHash(), ...patch });
  applyTheme();
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
      await enterRepo(repo, { auth: 'in', account: session.account, accounts: list, demo: false });
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
    await enterRepo(repo, { auth: 'in', account, demo: false, accounts: await accounts.listAccounts(), onboarding: 'code', recoveryCode });
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
    await enterRepo(repo, { auth: 'in', account, demo: false, accounts: await accounts.listAccounts(), onboarding: null });
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
    await enterRepo(repo, { auth: 'in', account, demo: false, accounts: await accounts.listAccounts(), onboarding: null });
    toast('Neue PIN gespeichert');
    autoContext();
  } finally {
    update({ busy: null });
  }
}

export async function signOut() {
  await accounts.clearSession();
  state.repo?.close?.();
  update({ auth: 'out', account: null, repo: null, demo: false, results: { dates: [], days: new Map() }, insights: null, accounts: await accounts.listAccounts(), authStep: 'welcome', onboarding: null, route: 'heute' });
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
  update({ auth: 'out', repo: null, demo: false, results: { dates: [], days: new Map() }, accounts: await accounts.listAccounts(), authStep: 'welcome' });
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
  state.repo?.close?.();
  await accounts.deleteAccount(id);
  update({ auth: 'out', account: null, repo: null, results: { dates: [], days: new Map() }, accounts: await accounts.listAccounts(), authStep: 'welcome' });
  toast('Konto gelöscht');
}

export function finishOnboarding(step) {
  const order = ['code', 'location', 'profile'];
  const next = order[order.indexOf(step) + 1] || null;
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
  const first = state.results.dates[0];
  if (next > state.today || (first && next < first)) return;
  update({ date: next });
}

export function openCheck(slot, date = state.today) {
  update({ checkSlot: slot, checkDate: date });
  navigate('check');
}

export { accounts };
