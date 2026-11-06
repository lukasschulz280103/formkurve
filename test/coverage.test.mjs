import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dataReport, dataAlert, rejectText, NEED } from '../js/model/coverage.js';
import { mergeSettings } from '../js/core/config.js';
import { parseShortcutText } from '../js/import/shortcut.js';
import { normalizeValue } from '../js/data/normalize.js';
import { addDays } from '../js/core/time.js';

const TODAY = '2026-11-04';
const S = mergeSettings();
const ALL = Object.keys(NEED);

/** Index-Attrappe: `types` sind vorhandene Typen, `to` je Typ das letzte Datum. */
function index(types = ALL, to = {}) {
  const counts = {};
  const range = {};
  for (const t of types) {
    counts[t] = { Zepp: 100 };
    range[t] = ['2026-10-01', to[t] || TODAY];
  }
  return { counts, range };
}
/** Pipeline-Attrappe mit n Nächten, alle mit HRV und Puls. */
function results(baselineDays = 28, nights = 14) {
  const days = new Map();
  const dates = [];
  for (let i = nights - 1; i >= 0; i--) {
    const date = addDays(TODAY, -i);
    dates.push(date);
    days.set(date, { date, hrv: 60, rhr: 55, baselineDays });
  }
  return { dates, days };
}
const report = (extra = {}) => dataReport({ index: index(), results: results(), settings: S, today: TODAY, ...extra });
const labels = (list) => list.map((b) => b.label);

test('Datenprüfung: alles da und frisch gibt keine Meldung', () => {
  const r = report();
  assert.equal(r.level, 'ok');
  assert.deepEqual(r.blocked, []);
  assert.deepEqual(r.pending, []);
  assert.equal(dataAlert(r), null);
  assert.ok(r.rows.every((x) => x.status === 'ok'));
});

test('Datenprüfung: ohne Messwerte gar keine Karte', () => {
  const r = dataReport({ index: index([]), settings: S, today: TODAY });
  assert.equal(r.level, 'none');
  assert.equal(dataAlert(r), null);
});

test('Fehlende Schlafanalyse: Fehlerstufe und die davon abhängigen Berechnungen', () => {
  const r = report({ index: index(ALL.filter((t) => t !== 'sleep')) });
  assert.equal(r.level, 'error');
  const names = labels(r.blocked);
  assert.ok(names.includes('Schlaf-Score'));
  assert.ok(names.includes('Schlafbedarf und Schlafschuld'));
  assert.ok(names.includes('Frühwarnung „Schlaf chronisch kurz“'));
  // Recovery hängt nicht am Schlaf: HRV und Puls sind noch da
  assert.ok(!names.includes('Recovery'));
  assert.deepEqual(r.blocked.find((b) => b.id === 'sleepScore').missing, ['Schlafanalyse']);
  const a = dataAlert(r);
  assert.equal(a.level, 'error');
  assert.match(a.title, /^Ein Messwert fehlt: Schlafanalyse$/);
  assert.ok(a.blocked.includes('Schlaf-Score'));
});

test('Ohne Schlafanalyse gibt es keinen Ruhepuls aus der Nacht', () => {
  // Nur Puls: das Nachtfenster ist unbekannt, also fällt die Recovery aus
  const nurPuls = report({ index: index(['hr']) });
  const names = labels(nurPuls.blocked);
  assert.ok(names.includes('Recovery'));
  assert.ok(names.includes('Tagesform'));
  assert.ok(names.includes('Frühwarnung „Ruhepuls dauerhaft hoch“'));
  assert.ok(!names.includes('Strain und Last'), 'Strain braucht nur den Puls über den Tag');
  assert.match(nurPuls.blocked.find((b) => b.id === 'recovery').why, /Schlafanalyse/);
  // Mit Schlafanalyse trägt der Puls die Recovery, auch ohne HRV
  const mitSchlaf = report({ index: index(['hr', 'sleep']) });
  assert.ok(!labels(mitSchlaf.blocked).includes('Recovery'));
  // Apples eigener Ruhepuls reicht auch ohne Schlafanalyse
  const mitApple = report({ index: index(['hr', 'rhr']) });
  assert.ok(!labels(mitApple.blocked).includes('Recovery'));
});

test('Meldung nennt den richtigen Grund: fehlt, unlesbar oder veraltet', () => {
  const fehlt = dataAlert(report({ index: index(ALL.filter((t) => t !== 'sleep')) }));
  assert.match(fehlt.title, /^Ein Messwert fehlt: Schlafanalyse$/);
  const unlesbar = dataAlert(report({ index: index(ALL.filter((t) => t !== 'sleep')), lastImport: { rejected: { sleep: { nan: 9 } } } }));
  assert.match(unlesbar.title, /^Ein Messwert ließ sich nicht lesen: Schlafanalyse$/);
  const alt = dataAlert(report({ index: index(ALL, { sleep: addDays(TODAY, -9) }) }));
  assert.match(alt.title, /^Keine neuen Werte: Schlafanalyse$/);
  // Mehrzahl-Bezeichnungen richtig beugen
  const schritte = report({ index: index(ALL.filter((t) => t !== 'steps')) });
  assert.equal(schritte.rows.find((x) => x.type === 'steps').plural, true);
});

test('Vitalwerte: einzeln ohne Folge, alle drei kosten den Vitalanteil', () => {
  // Fehlt nur die Atemfrequenz, bleibt keine Berechnung liegen: kein Alarm, nur eine Notiz
  const einer = report({ index: index(ALL.filter((t) => t !== 'resp')) });
  assert.equal(einer.level, 'info');
  assert.deepEqual(einer.rows.find((x) => x.type === 'resp').blocks, []);
  assert.equal(dataAlert(einer), null);
  assert.ok(!labels(einer.blocked).includes('Vitalanteil der Recovery'), 'SpO₂ und Temperatur tragen ihn weiter');
  const alle = report({ index: index(ALL.filter((t) => !['resp', 'spo2', 'wtemp'].includes(t))) });
  assert.ok(labels(alle.blocked).includes('Vitalanteil der Recovery'));
  assert.ok(labels(alle.blocked).includes('Frühwarnung „Blutsauerstoff niedrig“'));
  // Infektwarnung braucht zwei von drei Signalen: ohne Atemfrequenz bleiben HRV und Puls
  assert.ok(!labels(alle.blocked).includes('Frühwarnung „beginnender Infekt“'));
  const ohneHrv = report({ index: index(ALL.filter((t) => !['resp', 'hrv'].includes(t))) });
  assert.ok(labels(ohneHrv.blocked).includes('Frühwarnung „beginnender Infekt“'));
});

test('Nur eine Anzeige fehlt: Infostufe, keine Fehlermeldung auf Heute', () => {
  const r = report({ index: index(ALL.filter((t) => t !== 'energy')) });
  assert.equal(r.level, 'info');
  assert.deepEqual(labels(r.blocked), ['Aktive Energie in kcal']);
  assert.equal(dataAlert(r), null, 'Nebensachen stören nicht auf Heute');
  assert.equal(r.rows.find((x) => x.type === 'energy').status, 'none');
});

test('Veraltete Werte zählen wie fehlende', () => {
  const r = report({ index: index(ALL, { hr: addDays(TODAY, -9) }) });
  const row = r.rows.find((x) => x.type === 'hr');
  assert.equal(row.status, 'stale');
  assert.ok(labels(r.blocked).includes('Strain und Last'));
  assert.match(dataAlert(r).title, /^Keine neuen Werte: Herzfrequenz$/);
  // Zwei Tage alt ist normal, wenn noch nicht importiert wurde
  assert.equal(report({ index: index(ALL, { hr: addDays(TODAY, -2) }) }).level, 'ok');
});

test('Werte kommen an, ließen sich aber nicht lesen', () => {
  const lastImport = { rejected: { spo2: { range: 40, nan: 2 }, hr: { range: 3 } } };
  const r = report({ index: index(ALL.filter((t) => t !== 'spo2')), lastImport });
  const row = r.rows.find((x) => x.type === 'spo2');
  assert.equal(row.status, 'dropped');
  assert.equal(row.dropped, 42);
  assert.match(rejectText('spo2', row.reject), /40 außerhalb des Messbereichs \(70–100 %\), 2 ohne lesbare Zahl/);
  // Bei vorhandenen Werten ist ein Teil verworfen kein Grund zur Warnung
  const hr = r.rows.find((x) => x.type === 'hr');
  assert.equal(hr.status, 'partial');
  assert.ok(!labels(r.blocked).includes('Strain und Last'));
  assert.deepEqual(r.rejects.map((x) => x.type).sort(), ['hr', 'spo2']);
});

test('Werte da, Verlauf noch zu kurz: wartet, statt zu fehlen', () => {
  const r = report({ results: results(3) });
  assert.deepEqual(r.blocked, []);
  const names = labels(r.pending);
  assert.ok(names.includes('Recovery'));
  assert.ok(names.includes('Tagesform'));
  assert.match(r.pending[0].why, /3 von 5 Vergleichsnächten/);
  assert.equal(r.level, 'ok', 'fehlender Verlauf ist kein Datenproblem');
});

test('Nächte ohne HRV und Puls werden gezählt', () => {
  const res = results();
  for (const k of [TODAY, addDays(TODAY, -1)]) Object.assign(res.days.get(k), { hrv: null, rhr: null });
  const r = report({ results: res });
  assert.deepEqual(r.nights, { total: 14, missing: 2, dates: [addDays(TODAY, -1), TODAY] });
});

test('Quittierte Meldung bleibt still, bis sich der Zustand ändert', () => {
  const r = report({ index: index(ALL.filter((t) => t !== 'spo2')) });
  const a = dataAlert(r);
  assert.match(a.title, /Blutsauerstoff/);
  assert.deepEqual(a.ack, { spo2: 'none' });
  assert.equal(dataAlert(r, a.ack), null);
  // Fällt ein zweiter Wert aus, meldet sich die App wieder – nur mit dem neuen
  const r2 = report({ index: index(ALL.filter((t) => !['spo2', 'sleep'].includes(t))) });
  const a2 = dataAlert(r2, a.ack);
  assert.match(a2.title, /^Ein Messwert fehlt: Schlafanalyse$/);
  assert.ok(a2.blocked.includes('Schlaf-Score'));
  assert.ok(!a2.blocked.includes('Frühwarnung „Blutsauerstoff niedrig“'), 'Quittiertes bleibt weg');
  assert.deepEqual(a2.ack, { spo2: 'none', sleep: 'none' });
  // Ein Wert, der später veraltet, ist ein neuer Zustand
  const r3 = report({ index: index(ALL, { spo2: addDays(TODAY, -9) }) });
  assert.match(dataAlert(r3, a.ack).title, /^Keine neuen Werte: Blutsauerstoff$/);
});

test('Ein Wert ohne Folge löst keine Meldung aus, steht aber in der Liste', () => {
  const r = report({ index: index(ALL.filter((t) => t !== 'wtemp')) });
  assert.equal(dataAlert(r), null);
  assert.equal(r.rows.find((x) => x.type === 'wtemp').status, 'none');
  assert.deepEqual(r.matters, []);
});

test('Import merkt sich, warum ein Wert nicht lesbar war', () => {
  const text = [
    'Blutsauerstoff;2026-11-04T03:00:00+01:00;2026-11-04T03:00:00+01:00;42;%;Zepp',
    'Herzfrequenz;2026-11-04T03:00:00+01:00;2026-11-04T03:00:00+01:00;keine;count/min;Zepp',
    'HRV;kaputtes Datum;;47;ms;Zepp',
    'Herzfrequenz;2026-11-04T03:01:00+01:00;2026-11-04T03:01:00+01:00;54;count/min;Zepp',
  ].join('\n');
  const { samples, stats } = parseShortcutText(text);
  assert.equal(samples.length, 1);
  assert.deepEqual(stats.rejected.spo2, { nan: 0, range: 1, date: 0 });
  assert.deepEqual(stats.rejected.hr, { nan: 1, range: 0, date: 0 });
  assert.deepEqual(stats.rejected.hrv, { nan: 0, range: 0, date: 1 });
  // Grund auch direkt an der Prüfung ablesbar
  const info = {};
  assert.ok(Number.isNaN(normalizeValue('hrv', '900', 'ms', info)));
  assert.equal(info.reason, 'range');
  const info2 = {};
  assert.ok(Number.isNaN(normalizeValue('hrv', 'abc', 'ms', info2)));
  assert.equal(info2.reason, 'nan');
});
