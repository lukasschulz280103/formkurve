import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pack, unpack, EncryptedStore, newDataKey, sessionCopy, normalizeCode } from '../js/auth/crypto.js';
import * as accounts from '../js/auth/accounts.js';
import { openStore } from '../js/data/db.js';
import { Repo } from '../js/data/repo.js';
import { reference } from '../js/norms/references.js';
import { mergeSettings, ageOf, hrMaxOf, bmiOf } from '../js/core/config.js';

test('Verpacken: Messwert-Pakete und JSON bleiben verlustfrei', () => {
  const b = { type: 'hr', date: '2026-10-26', src: 'Zepp', t: Float64Array.from([1, 2, 3]), e: Float64Array.from([1, 2, 3.5]), v: Float64Array.from([55, 56.25, 57]) };
  const back = unpack(pack(b));
  assert.equal(back.src, 'Zepp');
  assert.deepEqual([...back.v], [55, 56.25, 57]);
  assert.ok(back.t instanceof Float64Array);
  const obj = { a: { M1: 4, A10: ['sauna'] }, ts: { morning: 123 } };
  assert.deepEqual(unpack(pack(obj)), obj);
});

test('Verschlüsselter Speicher: lesbar mit Schlüssel, unlesbar ohne', async () => {
  const inner = await openStore('test-enc');
  const key = await sessionCopy(await newDataKey());
  const db = new EncryptedStore(inner, key);
  await db.put('survey', '2026-10-26', { a: { M1: 5 } });
  await db.putMany('raw', [['hr|2026-10-26|Zepp', { type: 'hr', date: '2026-10-26', src: 'Zepp', t: Float64Array.of(1), e: Float64Array.of(1), v: Float64Array.of(60) }]]);
  assert.deepEqual(await db.get('survey', '2026-10-26'), { a: { M1: 5 } });
  const raw = await inner.get('survey', '2026-10-26');
  assert.ok(raw instanceof ArrayBuffer);
  assert.ok(!new TextDecoder().decode(raw).includes('M1'));
  const entries = await db.entries('raw');
  assert.equal(entries[0][1].v[0], 60);
  const other = new EncryptedStore(inner, await sessionCopy(await newDataKey()));
  await assert.rejects(other.get('survey', '2026-10-26'));
});

test('Konten: anlegen, anmelden, falsche PIN, Sperre, Wiederherstellung, PIN ändern', async () => {
  accounts._setRegistry(await openStore('test-reg'));
  const { account, key, recoveryCode } = await accounts.createAccount('Lukas', '1234');
  assert.match(recoveryCode, /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  assert.ok(key);
  await assert.rejects(accounts.createAccount('lukas', '9999'), /schon/);
  await assert.rejects(accounts.createAccount('Anna', '12'), /4 bis 8/);
  const ok = await accounts.login(account.id, '1234');
  assert.equal(ok.account.name, 'Lukas');
  for (let i = 0; i < 5; i++) await assert.rejects(accounts.login(account.id, '0000'), /PIN falsch/);
  await assert.rejects(accounts.login(account.id, '1234'), /warte/);
  const rec = await accounts.recover(account.id, recoveryCode.toLowerCase().replace(/-/g, ' '), '5678');
  assert.equal(rec.account.id, account.id);
  await accounts.login(account.id, '5678');
  await accounts.changePin(account.id, '5678', '24680');
  await accounts.login(account.id, '24680');
  const code2 = await accounts.renewRecoveryCode(account.id, '24680');
  await assert.rejects(accounts.recover(account.id, recoveryCode, '1111'), /stimmt nicht/);
  await accounts.recover(account.id, code2, '1111');
  assert.equal(normalizeCode('k7qm-2xra'), 'K7QM2XRA');
});

test('Daten bleiben je Konto getrennt verschlüsselt', async () => {
  const keyA = await sessionCopy(await newDataKey());
  const repo = await Repo.open('test-konto', { key: keyA });
  await repo.saveSurvey('2026-10-26', { a: { A1: 3 }, ts: {}, backfilled: {} });
  assert.equal(repo.survey.get('2026-10-26').a.A1, 3);
  const raw = await repo.db.inner.get('survey', '2026-10-26');
  assert.ok(raw instanceof ArrayBuffer);
});

test('Profil: Alter, Maximalpuls und BMI', () => {
  const s = mergeSettings({ profile: { birthYear: 1996, heightCm: 180, weightKg: 81 } });
  const age = ageOf(s, new Date(2026, 9, 27));
  assert.equal(age, 30);
  assert.equal(hrMaxOf(mergeSettings({ profile: { birthYear: new Date().getFullYear() - 30 } })), 187);
  assert.equal(hrMaxOf(mergeSettings()), 190);
  assert.equal(Math.round(bmiOf(s) * 10) / 10, 25);
});

test('Normalwerte: persönliche Einordnung nach Alter', () => {
  const young = reference('asleep', { value: 420, age: 30 });
  assert.match(young.personal, /7–9 Stunden/);
  const old = reference('asleep', { value: 420, age: 70 });
  assert.match(old.personal, /7–8 Stunden/);
  assert.ok(old.sources.some((s) => s.url.includes('thensf.org')));
  assert.match(reference('steps', { value: 7000, age: 65 }).personal, /6\.000–8\.000/);
  assert.match(reference('steps', { value: 7000, age: 35 }).personal, /8\.000–10\.000/);
  assert.match(reference('rhr', { value: 52 }).personal, /unter 60/);
  assert.match(reference('rhr', { value: 72 }).personal, /Normalbereich/);
  assert.match(reference('pm25', { value: 18 }).personal, /über dem WHO-Richtwert/);
  assert.match(reference('hrMax', { age: 40 }).personal, /180/);
  assert.equal(reference('form', {}).badge, 'Formkurve');
  assert.equal(reference('spo2', { value: 96 }).badge, 'offiziell');
  for (const k of ['hrv', 'rhr', 'resp', 'spo2', 'temp', 'asleep', 'efficiency', 'latency', 'wake', 'deep', 'rem', 'steps', 'activeMin', 'acwr', 'pm25', 'pollen', 'nightTemp', 'dayTemp', 'bmi', 'hrMax', 'vo2']) {
    const r = reference(k, { value: 1, age: 30, pct: 0.2 });
    assert.ok(r.sources.length > 0, `Quelle fehlt bei ${k}`);
    for (const s of r.sources) assert.match(s.url, /^https:\/\//);
  }
});
