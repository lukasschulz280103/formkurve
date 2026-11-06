// Prüft, welche Messwerte ankommen, welche sich nicht lesen lassen und welche Berechnungen
// deshalb nicht laufen. Grundsatz: nur sagen, was wirklich fehlt, und immer die Folge nennen.
import { isNum } from '../core/stats.js';
import { TYPES, LIMITS } from '../data/normalize.js';
import { addDays } from '../core/time.js';

// Wie nötig ein Typ ist: 'core' = ohne ihn fehlt ein ganzer Score, 'helpful' = ein Anteil fehlt,
// 'extra' = nur eine Anzeige. Danach richtet sich, ob es eine Fehler- oder eine Infomeldung wird.
export const NEED = {
  hr: 'core',
  hrv: 'core',
  sleep: 'core',
  resp: 'helpful',
  spo2: 'helpful',
  wtemp: 'helpful',
  rhr: 'extra',
  steps: 'extra',
  energy: 'extra',
  vo2: 'extra',
  mass: 'extra',
  btemp: 'extra',
};

// Woher ein Typ kommt, wenn er fehlt. Steht in der Meldung als nächster Schritt.
const SOURCE_HINT = {
  hr: 'Health-App → Profilbild → Apps → Zepp → „Herzfrequenz“ erlauben.',
  hrv: 'Health-App → Profilbild → Apps → Zepp → „Herzfrequenzvariabilität“ erlauben. Das Band muss nachts getragen werden.',
  sleep: 'Health-App → Profilbild → Apps → Zepp → „Schlaf“ erlauben.',
  resp: 'Atemfrequenz messen nur manche Amazfit-Modelle. Fehlt sie, bleibt der Rest unberührt.',
  spo2: 'In Zepp die nächtliche SpO₂-Messung einschalten und in Health für Zepp freigeben.',
  wtemp: 'Die Hauttemperatur im Schlaf liefert der Helio Strap nicht in jeder Firmware.',
  rhr: 'Optional: Formkurve rechnet den Ruhepuls sonst selbst aus dem Puls im Schlaf.',
  steps: 'Health-App → Profilbild → Apps → Zepp → „Schritte“ erlauben.',
  energy: 'Health-App → Profilbild → Apps → Zepp → „Aktive Energie“ erlauben; im Kurzbefehl den Typ ergänzen.',
  vo2: 'VO₂max schätzt Zepp nur nach Lauftrainings im Freien.',
  mass: 'Nur mit einer Waage, die an Health schreibt. Dein Gewicht kannst du auch unter Körperdaten eintragen.',
  btemp: 'Nur selbst gemessene Körpertemperatur aus einem Fieberthermometer.',
};

/**
 * Berechnungen und ihre Voraussetzungen. `test` bekommt eine Funktion, die sagt, ob ein Typ
 * brauchbare Werte liefert. `types` sind alle beteiligten Typen, damit die Meldung sagen kann,
 * welcher davon fehlt. `needsBase` = braucht zusätzlich genug Nächte Verlauf.
 */
// Der Ruhepuls kommt aus dem Puls im Schlaffenster: ohne Schlafanalyse weiß die App nicht,
// wann die Nacht war, und rechnet ihn nicht. Nur Apples eigener Ruhepuls geht auch ohne.
const nightPulse = (h) => h('rhr') || (h('hr') && h('sleep'));

export const CALCS = [
  { id: 'recovery', label: 'Recovery', why: 'HRV, oder Puls samt Schlafanalyse für das Nachtfenster', types: ['hrv', 'hr', 'rhr', 'sleep'], needsBase: true, test: (h) => h('hrv') || nightPulse(h) },
  { id: 'form', label: 'Tagesform', why: 'Recovery, also HRV oder Puls in der Nacht', types: ['hrv', 'hr', 'rhr', 'sleep'], needsBase: true, test: (h) => h('hrv') || nightPulse(h) },
  { id: 'sleepScore', label: 'Schlaf-Score', why: 'die Schlafanalyse', types: ['sleep'], test: (h) => h('sleep') },
  { id: 'sleepDebt', label: 'Schlafbedarf und Schlafschuld', why: 'die Schlafanalyse', types: ['sleep'], test: (h) => h('sleep') },
  { id: 'stages', label: 'Tiefschlaf, REM und Regelmäßigkeit', why: 'die Schlafanalyse', types: ['sleep'], test: (h) => h('sleep') },
  { id: 'strain', label: 'Strain und Last', why: 'Puls über den Tag', types: ['hr'], test: (h) => h('hr') },
  { id: 'activeMin', label: 'Aktivminuten', why: 'Puls über den Tag', types: ['hr'], test: (h) => h('hr') },
  { id: 'balance', label: 'Belastungsbalance (7 zu 28 Tage)', why: 'Puls über den Tag, über vier Wochen', types: ['hr'], test: (h) => h('hr') },
  { id: 'hrvPart', label: 'HRV-Anteil der Recovery', why: 'HRV in der Nacht', types: ['hrv'], test: (h) => h('hrv') },
  { id: 'fitness', label: 'Langzeit-Fitness', why: 'Ruhepuls, HRV oder Aktivminuten', types: ['hrv', 'hr', 'rhr'], test: (h) => h('hrv') || h('hr') || h('rhr') },
  { id: 'vital', label: 'Vitalanteil der Recovery', why: 'Atemfrequenz, Blutsauerstoff oder Hauttemperatur', types: ['resp', 'spo2', 'wtemp'], test: (h) => h('resp') || h('spo2') || h('wtemp') },
  { id: 'warnInfekt', label: 'Frühwarnung „beginnender Infekt“', why: 'zwei der drei Werte HRV, Ruhepuls, Atemfrequenz', types: ['hrv', 'hr', 'rhr', 'resp', 'sleep'], needsBase: true, test: (h) => [h('hrv'), nightPulse(h), h('resp')].filter(Boolean).length >= 2 },
  { id: 'warnRhr', label: 'Frühwarnung „Ruhepuls dauerhaft hoch“', why: 'Puls in der Nacht', types: ['hr', 'rhr', 'sleep'], test: nightPulse },
  { id: 'warnSpo2', label: 'Frühwarnung „Blutsauerstoff niedrig“', why: 'nächtliche SpO₂-Messung', types: ['spo2'], test: (h) => h('spo2') },
  { id: 'warnSleep', label: 'Frühwarnung „Schlaf chronisch kurz“', why: 'die Schlafanalyse', types: ['sleep'], test: (h) => h('sleep') },
  { id: 'steps', label: 'Schritte', why: 'den Schrittzähler', types: ['steps'], test: (h) => h('steps') },
  { id: 'energy', label: 'Aktive Energie in kcal', why: 'die aktive Energie aus Health', types: ['energy'], test: (h) => h('energy') },
  { id: 'vo2', label: 'VO₂max', why: 'die VO₂max-Schätzung der Uhr', types: ['vo2'], test: (h) => h('vo2') },
  { id: 'massTrend', label: 'Gewichtsverlauf', why: 'Gewichtsmessungen aus Health', types: ['mass'], test: (h) => h('mass') },
];

// Typen mit Mehrzahl-Bezeichnung: „Schritte fehlen“ statt „Schritte fehlt“
const PLURAL = new Set(['steps']);
const STALE_DAYS = 3;
const LEVEL_RANK = { ok: 0, info: 1, warn: 2, error: 3 };

const sumCounts = (c) => (c ? Object.values(c).reduce((s, x) => s + x, 0) : 0);
const rejTotal = (r) => (r ? (r.nan || 0) + (r.range || 0) + (r.date || 0) : 0);

/** Lesbarer Grund, warum Werte eines Typs verworfen wurden. */
export function rejectText(type, r) {
  const lim = LIMITS[type];
  const unit = TYPES[type]?.unit ? ` ${TYPES[type].unit}` : '';
  const parts = [];
  if (r.range) parts.push(`${r.range} außerhalb des Messbereichs${lim ? ` (${lim[0]}–${lim[1]}${unit})` : ''}`);
  if (r.nan) parts.push(`${r.nan} ohne lesbare Zahl`);
  if (r.date) parts.push(`${r.date} ohne lesbares Datum`);
  return parts.join(', ');
}

/**
 * Vollständiger Bericht zur Datenlage.
 * `lastImport` ist die Zusammenfassung des letzten Imports (für verworfene Werte),
 * `results` das Ergebnis der Pipeline (für Nächte und Verlauf).
 */
export function dataReport({ index, results = null, settings, lastImport = null, today }) {
  const counts = index?.counts || {};
  const range = index?.range || {};
  const rejected = lastImport?.rejected || {};
  const newest = Object.values(range).reduce((a, r) => (a == null || r[1] > a ? r[1] : a), null);
  const staleBefore = addDays(newest && newest < today ? newest : today, -STALE_DAYS);

  const rows = [];
  for (const type of Object.keys(NEED)) {
    const total = sumCounts(counts[type]);
    const r = range[type] || null;
    const rej = rejected[type] || null;
    const dropped = rejTotal(rej);
    let status = 'ok';
    if (!total) status = dropped ? 'dropped' : 'none';
    else if (r[1] < staleBefore) status = 'stale';
    else if (dropped) status = 'partial';
    rows.push({
      type,
      label: TYPES[type]?.label || type,
      plural: PLURAL.has(type),
      need: NEED[type],
      status,
      total,
      from: r?.[0] || null,
      to: r?.[1] || null,
      sources: Object.keys(counts[type] || {}),
      dropped,
      reject: rej,
      hint: SOURCE_HINT[type] || null,
    });
  }
  const byType = Object.fromEntries(rows.map((x) => [x.type, x]));
  // Nur frische, lesbare Werte tragen eine Berechnung
  const has = (t) => byType[t]?.status === 'ok' || byType[t]?.status === 'partial';

  // Verlauf: Recovery und die Baseline-Warnungen brauchen genug Vergleichsnächte
  const minUsable = settings?.model?.baselineMinUsable ?? 5;
  const lastDay = results?.days?.get(today) || (results?.dates?.length ? results.days.get(results.dates[results.dates.length - 1]) : null);
  const baseDays = lastDay?.baselineDays ?? 0;
  const baseReady = baseDays >= minUsable;

  const blocked = [];
  const pending = [];
  for (const c of CALCS) {
    if (!c.test(has)) {
      const missingTypes = c.types.filter((t) => !has(t));
      blocked.push({ id: c.id, label: c.label, why: c.why, missingTypes, missing: missingTypes.map((t) => byType[t].label) });
    } else if (c.needsBase && !baseReady) {
      pending.push({ id: c.id, label: c.label, why: `${baseDays} von ${minUsable} Vergleichsnächten` });
    }
  }

  // Nächte ohne jeden Wert für die Recovery. Nur bis zum neuesten Messwert, damit nicht
  // ein alter Import als Lücke erscheint – dafür gibt es den Hinweis zum Importieren.
  let nights = null;
  if (results?.dates?.length) {
    const inRange = newest ? results.dates.filter((k) => k <= newest) : results.dates;
    const last = inRange.slice(-14);
    const ohne = last.filter((k) => {
      const d = results.days.get(k);
      return d && !isNum(d.hrv) && !isNum(d.rhr);
    });
    nights = { total: last.length, missing: ohne.length, dates: ohne };
  }

  // Reihenfolge: zuerst was einen Score kostet, dann Anteile, dann reine Anzeigen
  const rank = { core: 0, helpful: 1, extra: 2 };
  rows.sort((a, b) => rank[a.need] - rank[b.need]);
  for (const x of rows) {
    const mine = blocked.filter((b) => b.missingTypes.includes(x.type));
    // Nur dieser Wert fehlt für die Berechnung – oder er ist eine von mehreren Möglichkeiten,
    // dann steht die Berechnung erst in der Gesamtliste, nicht als Vorwurf an diesen Wert.
    x.blocks = mine.filter((b) => b.missingTypes.length === 1).map((b) => b.label);
    x.shared = mine.filter((b) => b.missingTypes.length > 1).map((b) => b.label);
  }

  const unknown = Object.entries(lastImport?.unknownTypes || {}).sort((a, b) => b[1] - a[1]);
  const rejects = rows.filter((x) => x.dropped).map((x) => ({ ...x, text: rejectText(x.type, x.reject) }));

  // Gesamtstufe: ein fehlender Kernwert ist ein Fehler, ein fehlender Anteil eine Warnung
  let level = 'ok';
  const raise = (l) => {
    if (LEVEL_RANK[l] > LEVEL_RANK[level]) level = l;
  };
  for (const x of rows) {
    if (x.status === 'ok' || x.status === 'partial') continue;
    // fehlt, kostet aber keine Berechnung, oder betrifft nur eine Anzeige
    if ((!x.blocks.length && !x.shared.length) || x.need === 'extra') raise('info');
    else if (x.need === 'core') raise(x.status === 'stale' ? 'warn' : 'error');
    else raise(x.status === 'stale' ? 'info' : 'warn');
  }
  if (rejects.length) raise('info');
  if (!index || !Object.keys(counts).length) level = 'none';

  // Werte, deren Fehlen wirklich etwas kostet – danach richtet sich die Kopfzeile und die Meldung
  const matters = rows.filter((x) => x.status !== 'ok' && x.status !== 'partial'
    && (x.need === 'core' || x.blocks.length || (x.need === 'helpful' && x.shared.length)));
  const outdated = newest && newest < addDays(today, -STALE_DAYS) ? newest : null;
  return { level, rows, blocked, pending, rejects, unknown, nights, matters, outdated, baseDays, minUsable, baseReady };
}

/**
 * Kurzfassung für die Meldung auf „Heute“: nur was wirklich klemmt, in einem Satz.
 * `acked` ist { Typ: Zustand } aus den Kontodaten; quittierte Werte bleiben still,
 * bis sich ihr Zustand ändert. `ack` im Ergebnis ist die neue Liste zum Quittieren.
 */
export function dataAlert(report, acked = null) {
  if (!report || report.level === 'none' || report.level === 'ok') return null;
  const seen = acked || {};
  // Nur melden, was eine Berechnung kostet: ein Wert, den das Band nie geliefert hat und
  // der nichts blockiert, ist keine Meldung wert.
  const broken = report.matters.filter((x) => x.need !== 'extra');
  const fresh = broken.filter((x) => seen[x.type] !== x.status);
  if (!fresh.length) return null;
  const names = fresh.map((x) => x.label);
  const blocked = report.blocked.filter((b) => b.missingTypes.some((t) => fresh.some((x) => x.type === t)));
  const one = names.length === 1;
  const all = (s) => fresh.every((x) => x.status === s);
  const lead = all('stale')
    ? 'Keine neuen Werte'
    : all('dropped')
      ? (one ? 'Ein Messwert ließ sich nicht lesen' : `${names.length} Messwerte ließen sich nicht lesen`)
      : one
        ? `${fresh[0].plural ? 'Messwerte fehlen' : 'Ein Messwert fehlt'}`
        : `${names.length} Messwerte fehlen${fresh.some((x) => x.status === 'dropped') ? ' oder sind unlesbar' : ''}`;
  return {
    level: fresh.some((x) => x.need === 'core') ? 'error' : 'warn',
    title: `${lead}: ${names.join(', ')}`,
    blocked: blocked.map((b) => b.label),
    ack: { ...seen, ...Object.fromEntries(broken.map((x) => [x.type, x.status])) },
  };
}
