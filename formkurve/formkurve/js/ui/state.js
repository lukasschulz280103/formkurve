// Globaler App-Zustand mit einfachem Abo-Mechanismus und allen Aktionen.
import { useState, useEffect } from '../vendor/preact-htm.js';
import { Repo, DB_MAIN, DB_DEMO } from '../data/repo.js';
import { computeAll } from '../model/pipeline.js';
import { computeInsights } from '../analysis/insights.js';
import { generateDemo } from '../demo/generate.js';
import { todayKey, addDays } from '../core/time.js';
import { parseShortcutText } from '../import/shortcut.js';
import { importHealthFile } from '../import/healthExport.js';
import { fetchContext } from '../context/weather.js';

const DEMO_KEY = 'formkurve.demo';
const ROUTES = ['heute', 'verlauf', 'check', 'einsichten', 'daten'];

export const state = {
  ready: false,
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
  error: null,
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
  toastTimer = setTimeout(() => update({ toast: null }), 3200);
}

function safeLocal(fn, fallback = null) {
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
    safeLocal(() => {
      if (location.hash !== `#${route}`) history.replaceState(null, '', `#${route}`);
    });
    window.scrollTo?.(0, 0);
  }
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
  const today = todayKey();
  const results = computeAll({ index: repo.index, workouts: repo.workouts, survey: repo.survey, context: repo.context, settings: repo.settings, today });
  update({ results, version: state.version + 1, today, date: state.date > today ? today : state.date });
}

async function seedDemo(repo) {
  const demo = generateDemo({ days: 90, endDate: todayKey() });
  await repo.addSamples(demo.samples, demo.workouts);
  for (const [d, rec] of demo.survey) await repo.saveSurvey(d, rec);
  await repo.saveContext(demo.context);
  await repo.saveSettings({ ...repo.settings, profile: { ...repo.settings.profile, age: 30 } });
  await repo.finishImport({ kind: 'demo', parsed: demo.samples.length, added: demo.samples.length, at: Date.now(), workouts: demo.workouts.length });
}

export async function boot({ preview = false } = {}) {
  state.hostTheme = document.documentElement.getAttribute('data-theme');
  const wantDemo = preview || safeLocal(() => localStorage.getItem(DEMO_KEY) === '1', false);
  const repo = await Repo.open(wantDemo ? DB_DEMO : DB_MAIN);
  if (wantDemo && !repo.buckets.size) await seedDemo(repo);
  const hash = safeLocal(() => location.hash.replace('#', ''), '');
  update({ repo, demo: wantDemo, preview, route: ROUTES.includes(hash) ? hash : 'heute', lastImport: repo.meta.lastSummary || null });
  applyTheme();
  recompute();
  update({ ready: true });
  if (!preview) requestPersistence();
}

async function requestPersistence() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist();
  } catch {
    // nicht kritisch
  }
}

export async function setDemo(on) {
  update({ busy: on ? 'Beispieldaten werden erzeugt …' : 'Wechsle zu deinen Daten …' });
  state.repo?.close();
  safeLocal(() => localStorage.setItem(DEMO_KEY, on ? '1' : '0'));
  const repo = await Repo.open(on ? DB_DEMO : DB_MAIN);
  if (on && !repo.buckets.size) await seedDemo(repo);
  update({ repo, demo: on, insights: null, insightsVersion: -1, date: todayKey(), busy: null, lastImport: repo.meta.lastSummary || null });
  applyTheme();
  recompute();
  toast(on ? 'Beispieldaten aktiv' : 'Deine Daten aktiv');
}

export async function resetDemo() {
  update({ busy: 'Beispieldaten werden neu erzeugt …' });
  await state.repo.clearAll();
  await seedDemo(state.repo);
  update({ busy: null, insights: null, insightsVersion: -1 });
  recompute();
}

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

export async function refreshContext() {
  const place = state.repo.settings.context.place;
  if (!place) throw new Error('Kein Ort gewählt.');
  update({ busy: 'Lade Wetter und Luftqualität …' });
  try {
    const map = await fetchContext(place);
    await state.repo.saveContext(map);
    recompute();
    return map.size;
  } finally {
    update({ busy: null });
  }
}

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

export function dayData(date) {
  return state.results.days.get(date) || null;
}

export function latestDataDate() {
  const { dates, days } = state.results;
  for (let i = dates.length - 1; i >= 0; i--) {
    const d = days.get(dates[i]);
    if (d && (d.recovery != null || d.sleep)) return dates[i];
  }
  return null;
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
