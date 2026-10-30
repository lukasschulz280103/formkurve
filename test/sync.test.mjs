import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeFirebase } from './fake-firebase.mjs';
import { openStore } from '../js/data/db.js';
import { Repo } from '../js/data/repo.js';
import * as accounts from '../js/auth/accounts.js';
import { SyncEngine, linkNewOnlineAccount, signInOnline, unlockWithCode, storeLink, mergeSurvey, packItem, unpackItem, KV, SYNC_FORMAT } from '../js/sync/engine.js';
import { emptyDay, addEntry, removeEntry, setField, entriesOf, daySummary } from '../js/journal/journal.js';
import { parseFirebaseConfig, configFileContent } from '../js/sync/config.js';

const EMAIL = 'lukas@example.org';
const PASSWORD = 'gutes-passwort-1';
const DAY = 86400000;
const T0 = Date.UTC(2026, 9, 1, 6, 0, 0);

function hrSamples(dayOffset, n, start = 0) {
  const out = [];
  for (let i = start; i < start + n; i++) {
    const t = T0 + dayOffset * DAY + i * 60000;
    out.push({ type: 'hr', t, e: t, v: 50 + (i % 30), src: 'Zepp' });
  }
  return out;
}

/** Ein „Gerät“: eigene Kontenliste, eigenes Konto, eigener Speicher. */
async function deviceA(fb) {
  const reg = await openStore('reg-a');
  accounts._setRegistry(reg);
  const { account, key, recoveryCode } = await accounts.createAccount('Lukas', '1234');
  const repo = await Repo.open('a', { key });
  for (let d = 0; d < 400; d++) await repo.addSamples(hrSamples(d, 3));
  await repo.saveSurvey('2026-10-20', { a: { M1: 4, M4: 3, A1: 2, A3: false }, ts: { morning: 1000, evening: 2000 }, backfilled: {} });
  await repo.saveSettings({ ...repo.settings, display: { ...repo.settings.display, theme: 'dark' } });
  const recovery = await accounts.recoveryOf(account.id);
  await linkNewOnlineAccount({ repo, key, cfg: fb.cfg, email: EMAIL, password: PASSWORD, name: 'Lukas', recovery, fetchImpl: fb.fetch });
  const engine = new SyncEngine({ repo, key, cfg: fb.cfg, fetchImpl: fb.fetch });
  await engine.load();
  await engine.markAll();
  return { account, key, recoveryCode, repo, engine, reg };
}

async function deviceB(fb, code) {
  accounts._setRegistry(await openStore('reg-b'));
  const { session, keys } = await signInOnline({ cfg: fb.cfg, email: EMAIL, password: PASSWORD, fetchImpl: fb.fetch });
  const unlocked = await unlockWithCode(keys, code);
  const { account, key } = await accounts.createAccountWithKey(unlocked.name, '5678', unlocked.dataKey, unlocked.recovery, { uid: session.uid, email: session.email });
  const repo = await Repo.open('b', { key });
  await storeLink(repo, { session, idk: unlocked.idk, epoch: unlocked.epoch });
  const engine = new SyncEngine({ repo, key, cfg: fb.cfg, fetchImpl: fb.fetch });
  await engine.load();
  return { account, key, repo, engine };
}

test('Einträge: verpacken und entpacken verlustfrei', () => {
  const bucket = { type: 'hr', date: '2026-10-20', src: 'Zepp', t: Float64Array.of(1, 2), e: Float64Array.of(1, 2), v: Float64Array.of(55, 56) };
  const back = unpackItem(packItem('raw', 'hr|2026-10-20|Zepp', bucket));
  assert.equal(back.s, 'raw');
  assert.equal(back.k, 'hr|2026-10-20|Zepp');
  assert.deepEqual([...back.v.v], [55, 56]);
  assert.deepEqual(unpackItem(packItem('survey', '2026-10-20', { a: { M1: 5 } })).v, { a: { M1: 5 } });
});

test('Check-in-Tag: je Zeitpunkt gilt das zuletzt gespeicherte Gerät', () => {
  const phone = { a: { M1: 4, M4: 3, A1: 2 }, ts: { morning: 100, evening: 300 }, backfilled: {} };
  const tablet = { a: { M1: 2, A1: 5, A3: true }, ts: { morning: 200 }, backfilled: {} };
  const m = mergeSurvey(phone, tablet);
  assert.equal(m.a.M1, 2, 'Morgen: Tablet später');
  assert.equal(m.a.M4, undefined, 'Antwort, die das spätere Gerät nicht hatte, entfällt');
  assert.equal(m.a.A1, 2, 'Abend: nur das Telefon hat gespeichert');
  assert.equal(m.a.A3, undefined);
  assert.deepEqual(m.ts, { morning: 200, evening: 300 });
});

test('Konfiguration aus dem Firebase-Schnipsel lesen', () => {
  const snippet = `const firebaseConfig = {\n  apiKey: "AIzaSyD-abcdefghijklmnopqrstuvwxyz12345",\n  authDomain: "formkurve-1a2b3.firebaseapp.com",\n  projectId: "formkurve-1a2b3",\n};`;
  const cfg = parseFirebaseConfig(snippet);
  assert.deepEqual(cfg, { apiKey: 'AIzaSyD-abcdefghijklmnopqrstuvwxyz12345', projectId: 'formkurve-1a2b3' });
  assert.match(configFileContent(cfg), /window\.FORMKURVE_SYNC = \{\n  apiKey: 'AIzaSyD-/);
  assert.equal(parseFirebaseConfig('Hallo'), null);
});

test('Zwei Geräte: verbinden, mit Code öffnen, alles Ende-zu-Ende verschlüsselt', async () => {
  const fb = createFakeFirebase();
  const a = await deviceA(fb);
  const first = await a.engine.sync();
  assert.ok(first.pushed >= 402, `hochgeladen: ${first.pushed}`);
  const dump = fb.dump();
  // Längere Marken, damit kein Zufallstreffer in den verschlüsselten Bytes entsteht
  for (const plain of ['Lukas', '"M1":4', '2026-10-20', 'Zepp', 'hr|2026', '"theme":"dark"']) assert.ok(!dump.includes(plain), `Klartext in der Cloud: ${plain}`);
  assert.ok(dump.includes('users/'), 'Dump enthält die Dokumente');
  await assert.rejects(signInOnline({ cfg: fb.cfg, email: EMAIL, password: 'falsch', fetchImpl: fb.fetch }), /stimmt nicht/);
  const { keys } = await signInOnline({ cfg: fb.cfg, email: EMAIL, password: PASSWORD, fetchImpl: fb.fetch });
  await assert.rejects(unlockWithCode(keys, 'AAAA-BBBB-CCCC-DDDD'), /Wiederherstellungscode/);

  const b = await deviceB(fb, a.recoveryCode.toLowerCase());
  const got = await b.engine.sync();
  assert.ok(got.pulled >= 402, `geladen: ${got.pulled}`);
  assert.equal(b.repo.buckets.size, a.repo.buckets.size, 'alle 400 Tage trotz gleicher Zeitstempel je Paket');
  assert.deepEqual(b.repo.survey.get('2026-10-20'), a.repo.survey.get('2026-10-20'));
  assert.equal(b.repo.settings.display.theme, 'dark');
  assert.equal(b.account.name, 'Lukas');
  assert.equal(b.account.cloud.email, EMAIL);
});

test('Zwei Geräte gleichzeitig: Antworten und Messwerte werden zusammengeführt', async () => {
  const fb = createFakeFirebase();
  const a = await deviceA(fb);
  await a.engine.sync();
  const b = await deviceB(fb, a.recoveryCode);
  await b.engine.sync();

  // Telefon: Morgencheck und neue Pulswerte; Tablet: Abendcheck und andere Pulswerte desselben Tages
  await a.repo.saveSurvey('2026-10-21', { a: { M1: 5, M4: 4 }, ts: { morning: 5000 }, backfilled: {} });
  await a.repo.addSamples(hrSamples(450, 5, 0));
  await b.repo.saveSurvey('2026-10-21', { a: { A1: 3, A3: true, X1: 2 }, ts: { evening: 9000 }, backfilled: {} });
  await b.repo.addSamples(hrSamples(450, 5, 100));
  await b.repo.saveSettings({ ...b.repo.settings, survey: { ...b.repo.settings.survey, depth: 'kurz' } });

  await a.engine.sync();
  await b.engine.sync();
  await a.engine.sync();

  const want = { M1: 5, M4: 4, A1: 3, A3: true, X1: 2 };
  assert.deepEqual(a.repo.survey.get('2026-10-21').a, want);
  assert.deepEqual(b.repo.survey.get('2026-10-21').a, want);
  const key = [...a.repo.buckets.keys()].find((k) => a.repo.buckets.get(k).t.length === 10);
  assert.ok(key, 'Tag mit Werten von beiden Geräten');
  assert.equal(b.repo.buckets.get(key).t.length, 10);
  assert.equal(a.repo.settings.survey.depth, 'kurz');
});

test('Anmeldung läuft ab: neu anmelden; neuer Code gilt auch für neue Geräte', async () => {
  const fb = createFakeFirebase();
  const a = await deviceA(fb);
  await a.engine.sync();
  fb.expireTokens();
  a.engine.idToken = null;
  await a.repo.saveSurvey('2026-10-22', { a: { A1: 1 }, ts: { evening: 1 }, backfilled: {} });
  await a.engine.sync();
  fb.revokeRefresh();
  a.engine.idToken = null;
  await a.repo.saveSurvey('2026-10-23', { a: { A1: 2 }, ts: { evening: 1 }, backfilled: {} });
  await assert.rejects(a.engine.sync());
  assert.equal(a.engine.status.state, 'reauth');
  await a.engine.reauth(PASSWORD);
  await a.engine.sync();
  assert.equal(a.engine.status.state, 'idle');

  accounts._setRegistry(await openStore('reg-a2'));
  const fresh = await accounts.createAccount('Neu', '1111');
  const code = await accounts.renewRecoveryCode(fresh.account.id, '1111');
  assert.ok(code);
  // Neuen Code des verbundenen Kontos hinterlegen (hier: Code des Kontos A erneuern)
  accounts._setRegistry(a.reg);
  const newCode = await accounts.renewRecoveryCode(a.account.id, '1234');
  await a.engine.updateRecovery(await accounts.recoveryOf(a.account.id));
  const { keys } = await signInOnline({ cfg: fb.cfg, email: EMAIL, password: PASSWORD, fetchImpl: fb.fetch });
  await assert.rejects(unlockWithCode(keys, a.recoveryCode), /Wiederherstellungscode/);
  const ok = await unlockWithCode(keys, newCode);
  assert.equal(ok.name, 'Lukas');
});

test('Alles löschen auf einem Gerät leert auch das andere', async () => {
  const fb = createFakeFirebase();
  const a = await deviceA(fb);
  await a.engine.sync();
  const b = await deviceB(fb, a.recoveryCode);
  await b.engine.sync();
  assert.ok(b.repo.survey.size > 0);
  await a.engine.wipeEverywhere();
  assert.equal(a.repo.survey.size, 0);
  const left = [...fb.docs.keys()].filter((n) => n.includes('/items/'));
  assert.equal(left.length, 0, 'Cloud-Einträge gelöscht');
  await b.engine.sync();
  assert.equal(b.repo.survey.size, 0);
  assert.equal(b.repo.buckets.size, 0);
  // Danach geht es normal weiter
  await b.repo.saveSurvey('2026-10-24', { a: { A1: 4 }, ts: { evening: 1 }, backfilled: {} });
  await b.engine.sync();
  await a.engine.sync();
  assert.equal(a.repo.survey.get('2026-10-24').a.A1, 4);
});

test('Online-Konto löschen: Cloud leer, lokale Daten bleiben', async () => {
  const fb = createFakeFirebase();
  const a = await deviceA(fb);
  await a.engine.sync();
  await assert.rejects(a.engine.deleteOnlineAccount('falsch'), /stimmt nicht/);
  await a.engine.deleteOnlineAccount(PASSWORD);
  assert.equal(fb.docs.size, 0);
  assert.equal(fb.users.size, 0);
  assert.equal(a.engine.linked, false);
  assert.ok(a.repo.survey.size > 0);
});

test('Logbuch auf zwei Geräten: gleichzeitige Einträge bleiben erhalten, Löschen gilt überall, nichts im Klartext', async () => {
  const fb = createFakeFirebase();
  const a = await deviceA(fb);
  await a.repo.saveJournal('2026-10-25', setField(addEntry(emptyDay(), { type: 'water', ml: 250, at: '08:00' }, 1000).rec, 'text', 'Geheimes Tagebuch', 1001));
  await a.engine.sync();
  const b = await deviceB(fb, a.recoveryCode);
  await b.engine.sync();
  assert.equal(daySummary(b.repo.journal.get('2026-10-25')).text, 'Geheimes Tagebuch');
  assert.ok(!fb.dump().includes('Geheimes Tagebuch'), 'Tagebuch nur verschlüsselt in der Cloud');

  // Beide tragen gleichzeitig ein; B löscht außerdem das erste Glas
  const firstId = entriesOf(b.repo.journal.get('2026-10-25'), 'water')[0].id;
  await a.repo.saveJournal('2026-10-25', addEntry(a.repo.journal.get('2026-10-25'), { type: 'water', ml: 500, at: '10:00' }, 5000).rec);
  let rb = addEntry(b.repo.journal.get('2026-10-25'), { type: 'caffeine', kind: 'kaffee', mg: 90, at: '09:00' }, 5100).rec;
  rb = removeEntry(rb, firstId, 5200);
  rb = setField(rb, 'happy', 8, 5300);
  await b.repo.saveJournal('2026-10-25', rb);
  await a.engine.sync();
  await b.engine.sync();
  await a.engine.sync();
  for (const dev of [a, b]) {
    const s = daySummary(dev.repo.journal.get('2026-10-25'));
    assert.equal(s.waterMl, 500, 'neues Glas da, gelöschtes weg');
    assert.equal(s.caffeineN, 1);
    assert.equal(s.happy, 8);
  }
});

test('Update auf 0.5: der Abgleich holt einmal alles neu, damit übersprungene Logbuch-Einträge ankommen', async () => {
  const fb = createFakeFirebase();
  const a = await deviceA(fb);
  await a.engine.sync();
  await a.engine.sync();
  const st = await a.repo.getKv(KV.state);
  assert.equal(st.format, SYNC_FORMAT);
  assert.ok(st.cursor, 'nach dem Abgleich gibt es eine Leseposition');
  // Stand wie in Version 0.4: ohne Formatnummer
  await a.repo.putKv(KV.state, { ...st, format: undefined });
  const again = new SyncEngine({ repo: a.repo, key: a.key, cfg: fb.cfg, fetchImpl: fb.fetch });
  await again.load();
  const after = await a.repo.getKv(KV.state);
  assert.equal(after.cursor, null);
  assert.equal(after.format, SYNC_FORMAT);
  const res = await again.sync();
  assert.ok(res.pulled >= 0);
  const again2 = new SyncEngine({ repo: a.repo, key: a.key, cfg: fb.cfg, fetchImpl: fb.fetch });
  await again2.load();
  assert.ok((await a.repo.getKv(KV.state)).cursor, 'nur einmal');
});
