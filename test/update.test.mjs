import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { openStore, allowMemoryFallback, StorageError } from '../js/data/db.js';
import { Repo, DATA_FORMAT } from '../js/data/repo.js';
import { EncryptedStore, newDataKey, sessionCopy } from '../js/auth/crypto.js';
import { APP_VERSION } from '../js/version.js';

/** Speicher wie ihn Version 0.2 hinterlassen hat: verschlüsselt, ohne Formatnummer, alte Fragen. */
async function v02Store() {
  const inner = await openStore('update-test');
  const key = await sessionCopy(await newDataKey());
  const db = new EncryptedStore(inner, key);
  await db.put('kv', 'settings', { version: 1, profile: { birthYear: 1996 }, survey: { nutritionDays: [2, 5] } });
  await db.put('kv', 'meta', { lastImport: 1, lastSummary: { kind: 'export' } });
  await db.put('survey', '2026-10-20', { a: { M1: 4, A3: true, X1: 2, E8: ['magnesium'], S9: ['melatonin'] }, ts: { evening: 1 }, backfilled: {} });
  await db.put('context', '2026-10-20', { date: '2026-10-20', tMax: 14 });
  return { inner, key };
}

test('Update: Daten aus Version 0.2 bleiben vollständig und bekommen die Formatnummer', async () => {
  const { inner, key } = await v02Store();
  const repo = new Repo(new EncryptedStore(inner, key));
  await repo.load();
  await repo.migrate();
  const rec = repo.survey.get('2026-10-20');
  assert.deepEqual(rec.a, { M1: 4, A3: true, X1: 2, E8: ['magnesium'], S9: ['melatonin'] }, 'Antworten unverändert');
  assert.equal(repo.settings.profile.birthYear, 1996);
  assert.equal(repo.settings.survey.depth, 'standard', 'neue Einstellungen mit Standardwert');
  assert.deepEqual(repo.settings.survey.nutritionDays, [2, 5]);
  assert.equal(repo.context.get('2026-10-20').tMax, 14);
  assert.equal(repo.meta.dataFormat, DATA_FORMAT);
  assert.equal(repo.meta.lastImport, 1, 'bisherige Metadaten bleiben');
  // Zweites Öffnen: nichts ändert sich mehr
  const again = new Repo(new EncryptedStore(inner, key));
  await again.load();
  await again.migrate();
  assert.equal(again.meta.migratedAt, repo.meta.migratedAt);
});

test('Update: Daten einer neueren Version werden nicht angefasst', async () => {
  const inner = await openStore('newer-test');
  await inner.put('kv', 'meta', { dataFormat: DATA_FORMAT + 5, x: 1 });
  const repo = new Repo(inner);
  await repo.load();
  await repo.migrate();
  assert.equal(repo.newerData, true);
  assert.deepEqual(await inner.get('kv', 'meta'), { dataFormat: DATA_FORMAT + 5, x: 1 });
});

test('Update: kein stiller Wechsel in den Arbeitsspeicher außerhalb von Vorschau und Tests', async () => {
  allowMemoryFallback(false);
  try {
    await assert.rejects(openStore('x'), (e) => e instanceof StorageError);
  } finally {
    allowMemoryFallback(true);
  }
  const mem = await openStore('y');
  assert.equal(mem.persistent, false);
  const repo = new Repo(mem);
  assert.equal(await repo.importLegacy(), 0, 'alte Daten nie in einen flüchtigen Speicher übernehmen');
});

test('Update: Service Worker und App tragen dieselbe Version, Zwischenspeicher je Version', () => {
  const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  assert.ok(sw.includes(`const VERSION = '${APP_VERSION}'`), 'sw.js-Version passt nicht');
  assert.ok(sw.includes("k.startsWith('formkurve-')"), 'nur eigene Zwischenspeicher löschen');
  assert.ok(!/indexedDB\.(open|deleteDatabase)|caches\.delete\((?!k)/.test(sw), 'der Service Worker fasst die Daten nie an');
});
