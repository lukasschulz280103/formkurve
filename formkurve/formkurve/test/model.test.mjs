import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS } from '../js/core/config.js';
import {
  zScore, hrZone, zoneMinutes, edwardsTrimp, strainFromLoad, strengthLoad, sleepNeed, sleepScore,
  vitalZ, recoveryScore, balanceScore, formScore, fitnessInput, regularityScore,
} from '../js/model/scores.js';
import { buildSessions, assignSleepDays, sessionMetrics } from '../js/model/sleep.js';
import { SLEEP } from '../js/data/normalize.js';

const M = DEFAULTS.model;
const near = (a, b, tol = 0.6) => assert.ok(Math.abs(a - b) <= tol, `${a} != ${b}`);

test('Rechenbeispiel aus dem Konzept: Tagesform 75 -> 58', () => {
  const good = formScore({ r: [75, 75, 75], s: [80, 80, 80], balance: 80, fitness: 60 }, M.form);
  near(good.score, 75);
  const bad = formScore({ r: [20, 70, 75], s: [50, 80, 80], balance: 80, fitness: 60 }, M.form);
  near(bad.rEff, 46, 0.01);
  near(bad.sEff, 65, 0.01);
  near(bad.score, 58);
});

test('Strain mit Kraft-Zuschlag: 68 statt 30', () => {
  const extra = strengthLoad(60, 8, M.strain.strengthFactor);
  assert.equal(extra, 192);
  near(strainFromLoad(90 + extra, M.strain.k), 68);
  near(strainFromLoad(90, M.strain.k), 30);
  assert.equal(strengthLoad(60, 8, 0.4, 0.5), 96);
});

test('Recovery: neutral = 50, Komponenten addieren sich plausibel', () => {
  const r0 = recoveryScore({ hrv: 0, rhr: 0, sleep: 0, vital: 0, subj: 0 }, M.recovery);
  near(r0.score, 50, 0.01);
  const good = recoveryScore({ hrv: 1, rhr: -1, sleep: 0.5, vital: 0, subj: null }, M.recovery);
  assert.ok(good.score > 67, `gut: ${good.score}`);
  const bad = recoveryScore({ hrv: -2, rhr: 1.5, sleep: -1, vital: -1, subj: -1 }, M.recovery);
  assert.ok(bad.score < 20, `schlecht: ${bad.score}`);
  assert.ok(bad.parts.hrv < 0 && bad.parts.rhr < 0);
  assert.equal(recoveryScore({ hrv: null, rhr: null, sleep: 1 }, M.recovery).score, null);
});

test('z-Werte mit Untergrenze und Kappung', () => {
  assert.equal(zScore(60, { median: 55, mad: 0 }, 1.5), 3);
  near(zScore(57, { median: 55, mad: 2 }, 1.5), 2 / (1.4826 * 2), 1e-9);
  assert.equal(zScore(null, { median: 55, mad: 2 }, 1.5), null);
});

test('Herzfrequenzzonen und TRIMP', () => {
  assert.equal(hrZone(100, 60, 190), 0);
  assert.equal(hrZone(125, 60, 190), 1);
  assert.equal(hrZone(180, 60, 190), 5);
  const t = [0, 60000, 120000, 180000];
  const { zones, covered } = zoneMinutes(t, t, [155, 155, 155, 155], { rhr: 60, hrMax: 190 });
  assert.equal(covered, 4);
  assert.equal(zones[3], 4);
  assert.equal(edwardsTrimp(zones), 12);
});

test('Schlafbedarf und Schlaf-Score', () => {
  const need = sleepNeed({ base: 8, strainPrev: 80, debtsH: [1, 0, 2], napMinPrev: 30 }, M.sleep);
  near(need, 8 + 0.4 + 0.75 - 0.5, 1e-9);
  const capped = sleepNeed({ base: 8, strainPrev: 100, debtsH: [4, 4, 4], napMinPrev: 0 }, M.sleep);
  near(capped, 9.5, 1e-9);
  const s = sleepScore({ asleepMin: 480, needH: 8, efficiency: 0.95, restorativePct: 0.45, regularity: 100 }, M.sleep);
  near(s.score, 100, 1e-9);
  const short = sleepScore({ asleepMin: 360, needH: 8, efficiency: 0.85, restorativePct: 0.3, regularity: null }, M.sleep);
  assert.ok(short.score > 50 && short.score < 75, `kurz: ${short.score}`);
  assert.equal(regularityScore([0, 0, 0], [0, 0, 0], M.sleep), null);
  near(regularityScore([0, 0, 0, 0], [400, 400, 400, 400], M.sleep), 100, 1e-9);
});

test('Vitalwerte ziehen nur ab', () => {
  assert.equal(vitalZ({}), null);
  assert.equal(vitalZ({ temp: 0.5, resp: 0.5, spo2: 0.5 }), -0);
  near(vitalZ({ temp: -2, resp: 2, spo2: -1.5 }), -2.5, 1e-9);
});

test('Belastungsbalance', () => {
  assert.equal(balanceScore(1.0, M.balance), 100);
  near(balanceScore(0.5, M.balance), 55, 1e-9);
  near(balanceScore(1.5, M.balance), 72, 1e-9);
  assert.equal(balanceScore(null, M.balance), null);
});

test('Langzeit-Fitness: absolute Anker', () => {
  const f = fitnessInput({ rhr: 60, hrv: Math.sqrt(2000), activeMin7: 150, regularDays: 2, vo2: 45 }, M.fitness);
  near(f.parts.rhr, 50, 1e-9);
  near(f.parts.hrv, 50, 1e-9);
  near(f.parts.active, 50, 1e-9);
  near(f.value, 50, 1e-9);
});

test('Schlafsitzungen, Phasen und Nickerchen', () => {
  const H = 3600000;
  const base = new Date(2026, 9, 24, 23, 0).getTime();
  const segs = [
    { t: base, e: base + 0.25 * H, v: SLEEP.INBED },
    { t: base + 0.25 * H, e: base + 2 * H, v: SLEEP.CORE },
    { t: base + 2 * H, e: base + 3 * H, v: SLEEP.DEEP },
    { t: base + 3 * H, e: base + 3.2 * H, v: SLEEP.AWAKE },
    { t: base + 3.2 * H, e: base + 6 * H, v: SLEEP.CORE },
    { t: base + 6 * H, e: base + 7.5 * H, v: SLEEP.REM },
  ];
  const napStart = new Date(2026, 9, 25, 14, 0).getTime();
  segs.push({ t: napStart, e: napStart + 0.4 * H, v: SLEEP.ASLEEP });
  const sessions = buildSessions(segs, 90);
  assert.equal(sessions.length, 2);
  const m = sessionMetrics(sessions[0]);
  near(m.asleepMin, (7.5 - 0.25 - 0.2) * 60, 1e-6);
  near(m.latencyMin, 15, 1e-6);
  assert.equal(m.wakeEpisodes, 1);
  near(m.deepMin, 60, 1e-6);
  const days = assignSleepDays(sessions);
  const d = days.get('2026-10-25');
  assert.ok(d.main);
  near(d.napMin, 24, 1e-6);
});
