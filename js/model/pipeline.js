// Berechnet aus Rohdaten, Umfrage und Einstellungen alle Tageswerte und Scores.
import { MIN, HOUR, addDays, dateKey, dayStart, rangeKeys, clockMinutesCentered } from '../core/time.js';
import { isNum, mean, median, quantile, round } from '../core/stats.js';
import { hrMaxOf } from '../core/config.js';
import { buildSessions, assignSleepDays } from './sleep.js';
import {
  zScore, baselineOf, Z_FLOOR, zoneMinutes, edwardsTrimp, strainFromLoad, strengthLoad,
  sleepNeedParts, regularityScore, sleepScore, vitalZ, sleepZ, recoveryScore, balanceScore,
  fitnessInput, ewmaAlpha, formScore,
} from './scores.js';
import { exclusionReason, subjectiveZ, trainingFromSurvey } from '../survey/engine.js';
import { daySummary, withJournal } from '../journal/journal.js';
import { buildHints } from './hints.js';

function sleepByDay(index, p) {
  const perSource = [];
  for (const src of index.sourceOrder('sleep')) {
    const segs = [];
    for (const b of index.bucketsOf('sleep', src)) for (let i = 0; i < b.t.length; i++) segs.push({ t: b.t[i], e: b.e[i], v: b.v[i] });
    perSource.push([src, assignSleepDays(buildSessions(segs, p.sessionGapMin), { minSleepH: p.minSleepH })]);
  }
  return (date) => {
    let napOnly = null;
    for (const [src, map] of perSource) {
      const entry = map.get(date);
      if (entry?.main) return { ...entry, src };
      if (entry && !napOnly) napOnly = { ...entry, src };
    }
    return napOnly;
  };
}

function nightWindow(sleep, date) {
  if (sleep?.main) return [sleep.main.start - 15 * MIN, sleep.main.end + 15 * MIN, true];
  const d0 = dayStart(date);
  return [d0 - 2 * HOUR, d0 + 9 * HOUR, false];
}

function nightly(index, date, sleep, settings) {
  const [from, to, real] = nightWindow(sleep, date);
  const out = { window: [from, to], realNight: real };
  const hr = index.window('hr', from, to).v;
  if (real && hr.length >= 10) {
    out.rhr = quantile(hr, 0.1);
    out.avgSleepHr = mean(hr);
    out.rhrSource = 'Schlaf';
  }
  const apple = index.picked('rhr', date);
  if (apple?.v?.length) {
    out.rhrApple = mean([...apple.v]);
    if (!isNum(out.rhr)) {
      out.rhr = out.rhrApple;
      out.rhrSource = 'Apple Health';
    }
  }
  const shift = (settings.import.hrvDayShift || 0) * 24 * HOUR;
  let hrv = index.window('hrv', from - shift, to - shift).v;
  out.hrvNightly = hrv.length > 0 && real;
  if (!hrv.length) {
    const d0 = dayStart(date) - shift;
    hrv = index.window('hrv', d0, d0 + 24 * HOUR).v;
  }
  if (hrv.length) {
    out.lnHrv = mean(hrv.map((x) => Math.log(x)));
    out.hrv = Math.exp(out.lnHrv);
    out.hrvN = hrv.length;
  }
  const spo2 = index.window('spo2', from, to).v;
  if (spo2.length) {
    out.spo2 = mean(spo2);
    out.spo2Min = Math.min(...spo2);
  }
  const resp = index.window('resp', from, to).v;
  if (resp.length) out.resp = mean(resp);
  const wt = index.window('wtemp', from, to).v;
  if (wt.length) out.temp = mean(wt);
  return out;
}

function dailyActivity(index, workoutsByDay, date, rhrRef, hrMax, p) {
  const out = {};
  const hr = index.picked('hr', date);
  if (hr?.t?.length) {
    const { zones, covered } = zoneMinutes(hr.t, hr.e, hr.v, { rhr: rhrRef, hrMax, gapCapMin: p.gapCapMin, edges: p.zoneEdges });
    out.zones = zones;
    out.hrCoverageMin = covered;
    out.trimp = edwardsTrimp(zones);
  }
  const steps = index.picked('steps', date);
  if (steps?.v?.length) out.steps = steps.v.reduce((s, x) => s + x, 0);
  const energy = index.picked('energy', date);
  if (energy?.v?.length) out.energy = energy.v.reduce((s, x) => s + x, 0);
  const vo2 = index.picked('vo2', date);
  if (vo2?.v?.length) out.vo2 = vo2.v[vo2.v.length - 1];
  const mass = index.picked('mass', date);
  if (mass?.v?.length) out.mass = mass.v[mass.v.length - 1];
  const bt = index.picked('btemp', date);
  if (bt?.v?.length) out.btemp = Math.max(...bt.v);
  out.workouts = (workoutsByDay.get(date) || []).map((w) => {
    const win = index.window('hr', w.t, w.e);
    const zm = win.t.length ? zoneMinutes(win.t, win.e, win.v, { rhr: rhrRef, hrMax, gapCapMin: p.gapCapMin, edges: p.zoneEdges }) : null;
    return { ...w, trimp: zm ? edwardsTrimp(zm.zones) : null, avgHr: w.avgHr ?? (win.v.length ? mean(win.v) : null) };
  });
  return out;
}

function dedupeWorkouts(workouts, sourceOrder) {
  const rank = (s) => {
    const i = sourceOrder.indexOf(s);
    return i < 0 ? 999 : i;
  };
  const sorted = [...workouts].sort((a, b) => a.t - b.t || rank(a.src) - rank(b.src));
  const out = [];
  for (const w of sorted) {
    const dup = out.find((x) => Math.abs(x.t - w.t) < 5 * MIN);
    if (dup) {
      if (rank(w.src) < rank(dup.src)) out[out.indexOf(dup)] = w;
      continue;
    }
    out.push(w);
  }
  return out;
}

/**
 * Hauptfunktion. Liefert { dates, days: Map(date -> Tageswerte) }.
 * today = lokaler Datumsschlüssel von heute.
 */
export function computeAll({ index, workouts = [], survey = new Map(), journal = new Map(), context = new Map(), settings, today }) {
  const m = settings.model;
  const [minD, maxD] = index.dates();
  const surveyDates = [...survey.keys()].sort();
  const journalDates = [...journal.keys()].sort();
  const first = [minD, surveyDates[0], journalDates[0]].filter(Boolean).sort()[0];
  if (!first) return { dates: [], days: new Map() };
  const last = [maxD, today].filter(Boolean).sort().pop();
  const dates = rangeKeys(first, last > today ? today : last);
  const hrMax = hrMaxOf(settings);

  const sleepOf = sleepByDay(index, m.sleep);
  const workoutsByDay = new Map();
  for (const w of dedupeWorkouts(workouts, index.sourceOrder('hr'))) {
    const d = dateKey(w.t);
    if (!workoutsByDay.has(d)) workoutsByDay.set(d, []);
    workoutsByDay.get(d).push(w);
  }

  // 1) Nächte und Ausschlüsse
  const days = new Map();
  for (const date of dates) {
    const sl = sleepOf(date);
    const night = nightly(index, date, sl, settings);
    const rec = survey.get(date);
    days.set(date, {
      date,
      sleep: sl?.main || null,
      napMin: sl?.napMin || 0,
      sleepSource: sl?.src || null,
      ...night,
      excluded: exclusionReason(survey, date),
      survey: rec || null,
      journal: daySummary(journal.get(date)),
      context: context.get(date) || null,
    });
  }

  // 2) Baselines (je Tag aus den 28 Tagen davor) und z-Werte
  const W = m.baselineWindow;
  const series = { lnHrv: [], rhr: [], resp: [], spo2: [], temp: [] };
  for (let i = 0; i < dates.length; i++) {
    const d = days.get(dates[i]);
    const usable = !d.excluded && !(d.sleep && d.sleep.incomplete);
    for (const k of Object.keys(series)) series[k].push(usable ? d[k] : null);
  }
  for (let i = 0; i < dates.length; i++) {
    const d = days.get(dates[i]);
    const lo = Math.max(0, i - W);
    d.base = {};
    d.z = {};
    for (const k of Object.keys(series)) {
      const b = baselineOf(series[k].slice(lo, i), m.baselineMinUsable);
      d.base[k] = b;
      d.z[k === 'lnHrv' ? 'hrv' : k] = zScore(d[k], b, Z_FLOOR[k]);
    }
    const nBase = Math.max(d.base.lnHrv?.n || 0, d.base.rhr?.n || 0);
    d.baselineDays = nBase;
    d.calibrated = nBase >= m.baselineMinDays;
  }

  // 3) Aktivität, Strain und Kraft-Zuschlag
  const allRhr = dates.map((k) => days.get(k).rhr).filter(isNum);
  const globalRhr = allRhr.length ? median(allRhr) : 60;
  for (const date of dates) {
    const d = days.get(date);
    const rhrRef = d.base.rhr?.median ?? globalRhr;
    Object.assign(d, dailyActivity(index, workoutsByDay, date, rhrRef, hrMax, m.strain));
    // Abendcheck plus Logbuch: was im Logbuch steht, gilt (Training, Koffein, Wasser)
    d.answers = withJournal(d.survey?.a, journal.get(date), d.workouts);
    const tr = trainingFromSurvey(d.answers);
    let strength = 0;
    let strengthMin = 0;
    const strengthWorkouts = d.workouts.filter((w) => w.kind === 'kraft');
    if (tr && tr.strengthShare > 0) {
      const dur = tr.durMin ?? (strengthWorkouts.length ? strengthWorkouts.reduce((s, w) => s + w.durMin, 0) : d.workouts.reduce((s, w) => s + w.durMin, 0)) ?? 0;
      strengthMin = dur * tr.strengthShare;
      strength = strengthLoad(dur, tr.rpe ?? m.strain.defaultRpe, m.strain.strengthFactor, tr.strengthShare);
    } else if (!tr && strengthWorkouts.length) {
      strengthMin = strengthWorkouts.reduce((s, w) => s + w.durMin, 0);
      strength = strengthLoad(strengthMin, m.strain.defaultRpe, m.strain.strengthFactor, 1);
    }
    d.strengthLoad = strength;
    d.strengthMin = strengthMin;
    const hasLoadData = isNum(d.trimp) || strength > 0;
    d.load = hasLoadData ? (d.trimp || 0) + strength : null;
    d.strain = strainFromLoad(d.load, m.strain.k);
    d.strainPartial = date === today;
    d.activeMin = d.zones ? d.zones[2] + d.zones[3] + 2 * (d.zones[4] + d.zones[5]) + 0.5 * strengthMin : strengthMin ? 0.5 * strengthMin : null;
  }

  // 4) Scores der Reihe nach
  const alpha = ewmaAlpha(m.fitness.halfLife);
  let fitness = null;
  const fitBuffer = [];
  for (let i = 0; i < dates.length; i++) {
    const date = dates[i];
    const d = days.get(date);
    const prev = (n) => days.get(addDays(date, -n));

    // Schlafbedarf und Schlaf-Score
    const p1 = prev(1);
    const debts = [1, 2, 3].map((n) => {
      const x = prev(n);
      return x?.sleep && isNum(x.sleepNeedCoreH) ? x.sleepNeedCoreH - x.sleep.asleepMin / 60 : null;
    });
    const need = sleepNeedParts({ base: settings.profile.sleepNeedBase, strainPrev: p1?.strain ?? null, debtsH: debts, napMinPrev: p1?.napMin || 0 }, m.sleep);
    d.sleepNeedH = need.need;
    d.sleepNeedCoreH = need.core;
    if (d.sleep) {
      const onsets = [];
      const wakes = [];
      for (let n = 0; n < 7; n++) {
        const x = n === 0 ? d : prev(n);
        if (x?.sleep) {
          onsets.push(clockMinutesCentered(x.sleep.onset));
          wakes.push(clockMinutesCentered(x.sleep.wake));
        }
      }
      const reg = regularityScore(onsets, wakes, m.sleep);
      const ss = sleepScore({ asleepMin: d.sleep.asleepMin, needH: d.sleepNeedH, efficiency: d.sleep.efficiency, restorativePct: d.sleep.restorativePct, regularity: reg }, m.sleep);
      d.sleepScore = ss.score;
      d.sleepParts = ss.parts;
      d.sleepDebtH = Math.max(0, d.sleepNeedH - d.sleep.asleepMin / 60);
    } else {
      d.sleepScore = null;
      d.sleepParts = {};
    }

    // Recovery
    d.z.sleep = sleepZ(d.sleepScore, m.recovery);
    d.z.vital = vitalZ({ temp: d.z.temp, resp: d.z.resp, spo2: d.z.spo2 });
    d.z.subj = subjectiveZ(d.survey?.a);
    const rec = recoveryScore(d.z, m.recovery);
    d.recovery = rec.score;
    d.recoveryRaw = rec.raw;
    d.recoveryParts = rec.parts;

    // Belastungsbalance (Last vor Log-Skalierung)
    const loads7 = [];
    const loads28 = [];
    for (let n = 0; n < 28; n++) {
      const x = n === 0 ? d : prev(n);
      const l = x?.load;
      if (n < 7) loads7.push(l);
      loads28.push(l);
    }
    const n7 = loads7.filter(isNum).length;
    const n28 = loads28.filter(isNum).length;
    if (n7 >= 5 && n28 >= m.balance.minDays) {
      const chronic = mean(loads28);
      d.acwr = chronic > 0 ? mean(loads7) / chronic : null;
      d.balance = balanceScore(d.acwr, m.balance);
    } else {
      d.acwr = null;
      d.balance = null;
    }

    // Langzeit-Fitness
    let active7 = 0;
    let activeDays = 0;
    let regular = 0;
    for (let n = 0; n < 7; n++) {
      const x = n === 0 ? d : prev(n);
      if (isNum(x?.activeMin)) {
        active7 += x.activeMin;
        activeDays++;
      }
      if (isNum(x?.strain) && x.strain >= m.fitness.regularStrain) regular++;
    }
    let vo2 = null;
    for (let n = 0; n < 30 && vo2 == null; n++) {
      const x = n === 0 ? d : prev(n);
      if (isNum(x?.vo2)) vo2 = x.vo2;
    }
    const fi = fitnessInput({ rhr: d.rhr, hrv: d.hrv, activeMin7: activeDays >= 4 ? (active7 * 7) / activeDays : null, regularDays: activeDays >= 4 ? regular : null, vo2 }, m.fitness);
    d.fitnessInput = fi.value;
    d.fitnessParts = fi.parts;
    if (isNum(fi.value)) {
      if (fitness == null) {
        fitBuffer.push(fi.value);
        if (fitBuffer.length >= 7) fitness = mean(fitBuffer);
      } else fitness = fitness + alpha * (fi.value - fitness);
    }
    d.fitness = fitness;

    // Tagesform
    const fs = formScore({ r: [d.recovery, prev(1)?.recovery, prev(2)?.recovery], s: [d.sleepScore, prev(1)?.sleepScore, prev(2)?.sleepScore], balance: d.balance, fitness: d.fitness }, m.form);
    d.form = fs.score;
    d.rEff = fs.rEff;
    d.sEff = fs.sEff;
  }

  for (const date of dates) {
    const d = days.get(date);
    d.hints = buildHints(d, days.get(addDays(date, -1)), settings);
  }
  return { dates, days, computedAt: Date.now() };
}

/** Kompakte Zahlen für Tabellen und Tests. */
export function snapshot(d) {
  return {
    date: d.date,
    recovery: round(d.recovery, 1),
    sleepScore: round(d.sleepScore, 1),
    strain: round(d.strain, 1),
    form: round(d.form, 1),
    fitness: round(d.fitness, 1),
    hrv: round(d.hrv, 1),
    rhr: round(d.rhr, 1),
  };
}
