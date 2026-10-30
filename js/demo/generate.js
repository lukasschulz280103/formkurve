// Erzeugt realistische Beispieldaten (Messwerte, Workouts, Umfrage, Wetter) mit eingebauten
// Effekten (Alkohol, spätes Koffein, warme Nächte ...), damit Scores und Einsichten etwas zeigen.
import { MIN, HOUR, addDays, dayStart, weekday, todayKey, minutesToHm, rangeKeys } from '../core/time.js';
import { mulberry32, clamp } from '../core/stats.js';
import { SLEEP } from '../data/normalize.js';

export function generateDemo({ days = 90, endDate = todayKey(), seed = 11, nowMs = Date.now() } = {}) {
  const rnd = mulberry32(seed);
  const gauss = () => {
    let u = 0;
    let v = 0;
    while (!u) u = rnd();
    while (!v) v = rnd();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const chance = (p) => rnd() < p;
  // Eigener Zufallsstrom für Supplements, damit die übrigen Beispieldaten unverändert bleiben
  const rndSup = mulberry32(seed + 101);
  const supChance = (p) => rndSup() < p;
  const N = (m, s) => m + s * gauss();
  const at = (date, minutes) => dayStart(date) + minutes * MIN;

  const startDate = addDays(endDate, -(days - 1));
  const dates = rangeKeys(addDays(startDate, -1), endDate);
  const samples = [];
  const workouts = [];
  const survey = new Map();
  const context = new Map();
  const ZEPP = 'Zepp';
  const PHONE = 'iPhone von Lukas';
  const push = (type, t, e, v, src = ZEPP) => samples.push({ type, t, e, v, src });
  const hrMax = 187;
  const sickFrom = days >= 70 ? days - 32 : -99;
  const isSick = (i) => i >= sickFrom && i < sickFrom + 4;
  const examFrom = Math.max(5, days - 60);

  // Wetter: Spätsommer bis Herbst, mit einer Hitzewelle am Anfang
  const weather = new Map();
  let pressure = 1014;
  dates.forEach((d, i) => {
    const season = i / Math.max(1, dates.length - 1);
    const heat = i >= 3 && i <= 15;
    const tMax = heat ? N(31.5, 1.5) : N(25 - 12 * season, 2.2);
    const night = heat ? N(19.5, 1.0) : clamp(tMax - N(10, 1.5), 2, 17.5);
    pressure += N(0, 3.2) + (1014 - pressure) * 0.15;
    const doy = (Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10))) - Date.UTC(Number(d.slice(0, 4)), 0, 0)) / 86400000;
    const decl = 23.44 * Math.sin(((2 * Math.PI) / 365) * (doy - 81));
    const lat = (52.5 * Math.PI) / 180;
    const cosH = -Math.tan(lat) * Math.tan((decl * Math.PI) / 180);
    const daylightH = (2 * Math.acos(clamp(cosH, -1, 1)) * 180) / Math.PI / 15;
    weather.set(d, {
      date: d,
      tMax,
      tMin: night,
      nightTempMin: night,
      nightHumidity: clamp(N(heat ? 72 : 82, 7), 45, 99),
      pressure,
      daylightH,
      sunshineH: clamp(N(daylightH * 0.45, 2), 0, daylightH),
      pm25: clamp(N(heat ? 14 : 9, 4) + (chance(0.08) ? 12 : 0), 2, 60),
      pm10: clamp(N(16, 5), 4, 80),
      pollenMax: clamp(i < 30 ? N(28, 22) : N(6, 5), 0, 140),
    });
  });
  for (const d of dates) {
    const x = weather.get(d);
    const p = weather.get(addDays(d, -1));
    if (p) x.pressureDelta = x.pressure - p.pressure;
    context.set(d, x);
  }

  // Verhalten je Abend
  const behavior = new Map();
  dates.forEach((d, i) => {
    const wd = weekday(d);
    const weekend = wd === 5 || wd === 6;
    const sick = isSick(i);
    const exam = i >= examFrom && i < examFrom + 5;
    let drinks = 0;
    if (!sick && chance(wd === 5 ? 0.45 : wd === 6 ? 0.55 : 0.1)) drinks = weekend ? 1 + Math.floor(rnd() * 4.3) : 1 + Math.floor(rnd() * 1.6);
    const party = wd === 6 && drinks >= 3 && chance(0.6);
    const caf = clamp(Math.round(N(2.2, 0.9)), 0, 5);
    const cafLate = caf > 0 && chance(0.3);
    const cafTime = cafLate ? 14 * 60 + Math.floor(rnd() * 210) : 8 * 60 + Math.floor(rnd() * 330);
    const mealLate = chance(0.25);
    const mealTime = mealLate ? 21 * 60 + Math.floor(rnd() * 75) : 18 * 60 + 30 + Math.floor(rnd() * 135);
    const stress = sick ? 2 : exam ? clamp(Math.round(N(4.5, 0.5)), 4, 5) : clamp(Math.round(weekend ? N(1.9, 0.8) : N(3.1, 1.0)), 1, 5);
    let training = null;
    if (!sick) {
      if (wd === 1 && chance(0.9)) training = { kind: 'kraft', dur: 60, rpe: chance(0.5) ? 8 : 7 };
      else if (wd === 2 && chance(0.85)) training = { kind: 'ausdauer', dur: 45, rpe: 6 + Math.round(rnd()) };
      else if (wd === 3 && chance(0.3)) training = { kind: 'mobility', dur: 25, rpe: 3 };
      else if (wd === 4 && chance(0.88)) training = { kind: 'kraft', dur: 60, rpe: chance(0.5) ? 8 : 7 };
      else if (wd === 5 && chance(0.7)) training = { kind: 'hiit', dur: 30, rpe: 8 + Math.round(rnd()) };
      else if (wd === 6 && chance(0.6)) training = { kind: 'ausdauer', dur: 75, rpe: 6 };
      else if (wd === 6 && chance(0.3)) training = { kind: 'team', dur: 90, rpe: 7 };
    }
    if (training) training.start = weekend ? 10 * 60 + Math.floor(rnd() * 60) : chance(0.2) ? 20 * 60 + 10 : 18 * 60 + Math.floor(rnd() * 80);
    behavior.set(d, {
      i,
      wd,
      weekend,
      sick,
      exam,
      drinks,
      party,
      drinkTime: drinks ? 20 * 60 + Math.min(270, drinks * 50 + Math.floor(rnd() * 60)) : null,
      caf,
      cafLate,
      cafTime,
      mealLate,
      mealTime,
      mealSize: weekend && chance(0.4) ? 'schwer' : pick(['leicht', 'normal', 'normal', 'normal', 'schwer']),
      hydration: chance(0.2) ? 'lt15' : chance(0.75) ? '15-25' : 'gt25',
      stress,
      mental: clamp(stress + Math.round(N(0, 0.7)), 1, 5),
      screen: pick(['0', 'lt30', 'lt30', '30-60', '30-60', 'gt60']),
      daylight: weekend ? (chance(0.6) ? 'gt60' : '15-60') : pick(['lt15', 'lt15', '15-60', '15-60', '15-60', 'gt60']),
      sauna: wd === 0 && chance(0.35),
      stretch: Boolean(training) && chance(0.3),
      meditation: chance(0.15),
      training,
      // Supplements: Vitamin D, Omega-3 und Kreatin fast täglich, Magnesium an etwa jedem zweiten Abend
      supps: [supChance(0.96) && 'vitd', supChance(0.94) && 'omega3', supChance(0.95) && 'kreatin', supChance(0.5) && 'magnesium'].filter(Boolean),
    });
  });

  // Nächte (Schlaftag = Aufwachdatum) und Tagesaktivität
  const nightInfo = new Map();
  const loadOf = new Map();
  for (const d of dates.slice(1)) {
    const prevDay = addDays(d, -1);
    const b = behavior.get(prevDay);
    const i = b.i;
    const progress = i / days;
    const sick = isSick(i + 1) || b.sick;
    const ctx = context.get(prevDay);
    const warm = ctx.nightTempMin >= 18;
    const prevLoad = loadOf.get(prevDay) ?? 150;
    const drinks = Math.min(4, b.drinks);
    let dLn = -0.075 * drinks - (b.drinkTime && b.drinkTime >= 22 * 60 ? 0.03 : 0) - 0.04 * (b.stress - 3) - clamp(0.0005 * (prevLoad - 150), -0.05, 0.12);
    let dRhr = 1.5 * drinks + (b.mealLate ? 2 : 0) + (b.mealSize === 'schwer' ? 1 : 0) + clamp(0.006 * (prevLoad - 150), -1, 2.5);
    let latency = 12 + (b.cafLate ? 15 : 0) + (b.caf >= 3 ? 5 : 0) + 4 * (b.stress - 3) + (b.screen === '30-60' || b.screen === 'gt60' ? 6 : 0) + (b.daylight === 'gt60' ? -6 : b.daylight === 'lt15' ? 4 : 0) - (drinks ? 3 : 0);
    let deepDelta = (b.cafLate ? -10 : 0) + (b.sauna ? 4 : 0) + (warm ? -12 : 0);
    // Eingebauter kleiner Effekt für die Einsichten: Magnesium am Abend, etwas mehr Tiefschlaf
    if (b.supps.includes('magnesium')) deepDelta += 7;
    const remDelta = -6 * drinks;
    let effPenalty = (b.mealLate ? 0.02 : 0) + (warm ? 0.03 : 0);
    let extraWakes = (drinks >= 2 ? 1 : 0) + (warm ? 1 : 0);
    let resp = N(14.2, 0.35);
    let spo2 = 96.6;
    if (sick) {
      dRhr += 6;
      dLn -= 0.3;
      resp += 1.6;
      spo2 -= 0.7;
      latency += 5;
      extraWakes += 1;
    }
    const lnHrv = Math.log(44) + 0.12 * progress + dLn + N(0, 0.07);
    const rhr = 58 - 3 * progress + dRhr + N(0, 1.0);
    const nightWeekend = b.wd === 5 || b.wd === 6;
    const bed = at(prevDay, (nightWeekend ? 23 * 60 + 50 : 23 * 60 + 5) + (b.party ? 40 : 0) + N(0, 22));
    const lat = clamp(N(latency, 5), 3, 90) * MIN;
    const onset = bed + lat;
    const wakeDay = weekday(d);
    const alarm = wakeDay >= 1 && wakeDay <= 5;
    let wake = alarm ? at(d, 6 * 60 + 45 + N(0, 10)) : at(d, 8 * 60 + 15 + N(0, 35));
    if (!alarm && drinks >= 3) wake += 30 * MIN;
    if (wake - onset < 4.5 * HOUR) wake = onset + 4.5 * HOUR;

    // Phasen in 90-Minuten-Zyklen
    const deepFrac = [0.34, 0.24, 0.14, 0.06, 0.03, 0.02];
    const remFrac = [0.1, 0.17, 0.24, 0.29, 0.33, 0.35];
    const total = wake - onset;
    const cycles = Math.max(1, Math.round(total / (90 * MIN)));
    const cycleLen = total / cycles;
    const nomDeep = deepFrac.slice(0, cycles).reduce((s, f) => s + f, 0) * cycleLen;
    const nomRem = remFrac.slice(0, cycles).reduce((s, f) => s + f, 0) * cycleLen;
    const deepScale = clamp((nomDeep + deepDelta * MIN) / nomDeep, 0.3, 1.6);
    const remScale = clamp((nomRem + remDelta * MIN) / nomRem, 0.3, 1.6);
    const segs = [];
    let t = onset;
    for (let c = 0; c < cycles; c++) {
      const deep = cycleLen * (deepFrac[c] ?? 0.02) * deepScale;
      const rem = cycleLen * (remFrac[c] ?? 0.35) * remScale;
      const core = Math.max(5 * MIN, cycleLen - deep - rem);
      const parts = [[SLEEP.CORE, core * 0.45], [SLEEP.DEEP, deep], [SLEEP.CORE, core * 0.55], [SLEEP.REM, rem]];
      for (const [code, dur] of parts) {
        if (dur < MIN) continue;
        segs.push({ t, e: t + dur, v: code });
        t += dur;
      }
    }
    const scale = (wake - onset) / (t - onset);
    let cursor = onset;
    for (const s of segs) {
      const dur = (s.e - s.t) * scale;
      s.t = cursor;
      s.e = cursor + dur;
      cursor += dur;
    }
    const wakes = 1 + extraWakes + (chance(0.4) ? 1 : 0);
    for (let k = 0; k < wakes; k++) {
      const pos = onset + (0.15 + 0.75 * rnd()) * (wake - onset);
      const len = (3 + rnd() * 9 + effPenalty * 100) * MIN;
      const idx = segs.findIndex((s) => s.t <= pos && s.e > pos);
      if (idx < 0) continue;
      const s = segs[idx];
      const end = Math.min(s.e, pos + len);
      const before = { t: s.t, e: pos, v: s.v };
      const aw = { t: pos, e: end, v: SLEEP.AWAKE };
      const after = { t: end, e: s.e, v: s.v };
      segs.splice(idx, 1, ...[before, aw, after].filter((x) => x.e - x.t >= 30000));
    }
    if (effPenalty > 0) {
      const last = segs[segs.length - 1];
      segs.push({ t: last.e, e: last.e + effPenalty * 200 * MIN, v: SLEEP.AWAKE });
    }
    push('sleep', bed, segs[segs.length - 1].e + 3 * MIN, SLEEP.INBED);
    for (const s of segs) push('sleep', s.t, s.e, s.v);

    // Puls in der Nacht (alle 2 Minuten)
    const nightEnd = segs[segs.length - 1].e;
    for (let tt = bed; tt < nightEnd; tt += 2 * MIN) {
      const seg = segs.find((s) => s.t <= tt && s.e > tt);
      const frac = (tt - bed) / (nightEnd - bed);
      let hr = rhr + 3.5 + 3 * (1 - frac) + N(0, 1.3);
      if (seg?.v === SLEEP.DEEP) hr -= 2;
      if (seg?.v === SLEEP.REM) hr += 3;
      if (!seg || seg.v === SLEEP.AWAKE) hr += 8;
      push('hr', tt, tt, Math.round(hr));
    }
    for (const h of [0.3, 0.5, 0.7]) {
      const tt = onset + h * (wake - onset);
      push('hrv', tt, tt, Math.round(Math.exp(lnHrv + N(0, 0.08)) * 10) / 10);
    }
    for (let tt = onset + 20 * MIN; tt < wake; tt += 30 * MIN) push('spo2', tt, tt, clamp(Math.round(N(spo2, 0.8) * 10) / 10, 88, 100));
    push('resp', onset + 3 * HOUR, onset + 3 * HOUR, Math.round(resp * 10) / 10);
    nightInfo.set(d, { rhr, lnHrv, bed, onset, wake: nightEnd, latencyMin: lat / MIN, drinksBefore: b.drinks, sick, deepDelta, extraWakes });

    // Tagesaktivität am Tag d (bis zum nächsten Zubettgehen)
    const bd = behavior.get(d);
    const isToday = d === endDate;
    const dayEndMs = isToday ? Math.min(nowMs, at(d, 22 * 60)) : at(d, 22 * 60 + 45);
    const tr = bd.training;
    let trimp = 0;
    const trainStart = tr ? at(d, tr.start) : null;
    const trainEnd = tr ? trainStart + tr.dur * MIN : null;
    const zone = (hr) => {
      const f = (hr - 56) / (hrMax - 56);
      return f < 0.5 ? 0 : f < 0.6 ? 1 : f < 0.7 ? 2 : f < 0.8 ? 3 : f < 0.9 ? 4 : 5;
    };
    const walks = [at(d, 8 * 60 + 10), at(d, 17 * 60 + 30), at(d, 12 * 60 + 40)];
    for (let tt = nightEnd + 5 * MIN; tt < dayEndMs; tt += 5 * MIN) {
      if (tr && tt >= trainStart && tt < trainEnd) continue;
      const walking = walks.some((w) => tt >= w && tt < w + (bd.weekend ? 35 : 18) * MIN);
      const hr = Math.round(walking ? N(rhr + 48, 6) : N(rhr + 22, 6));
      push('hr', tt, tt, clamp(hr, 45, 200));
      trimp += zone(hr) * 5;
    }
    if (tr && trainEnd <= dayEndMs) {
      const target = { kraft: [122, 18], ausdauer: [158, 6], hiit: [150, 18], team: [152, 16], mobility: [98, 8] }[tr.kind];
      const hrs = [];
      for (let m = 0; m < tr.dur; m++) {
        let hr = N(target[0], target[1] * 0.4);
        if (tr.kind === 'hiit') hr = m % 4 < 2 ? N(177, 4) : N(142, 6);
        if (tr.kind === 'kraft') hr = m % 3 === 0 ? N(146, 6) : N(116, 8);
        if (tr.kind === 'ausdauer' && tr.dur > 60) hr = N(149, 5);
        if (tr.kind === 'team') hr = m % 6 < 2 ? N(172, 5) : N(146, 8);
        hr = Math.round(clamp(hr, 70, hrMax));
        hrs.push(hr);
        push('hr', trainStart + m * MIN, trainStart + m * MIN, hr);
        trimp += zone(hr);
      }
      const act = { kraft: 'TraditionalStrengthTraining', ausdauer: tr.dur > 60 ? 'Running' : 'Running', hiit: 'HighIntensityIntervalTraining', team: 'Soccer', mobility: 'Yoga' }[tr.kind];
      workouts.push({ t: trainStart, e: trainEnd, act, kind: tr.kind, durMin: tr.dur, avgHr: Math.round(hrs.reduce((s, x) => s + x, 0) / hrs.length), maxHr: Math.max(...hrs), kcal: Math.round(tr.dur * 8.5), src: ZEPP });
    }
    const strength = tr?.kind === 'kraft' ? tr.dur * tr.rpe * 0.4 : 0;
    loadOf.set(d, trimp + strength);

    // Schritte stündlich, zusätzlich doppelt vom iPhone (wird über die Quellenpriorität ausgeblendet)
    const stepsTotal = clamp(N(bd.weekend ? 10500 : 7800, 2200) + (tr?.kind === 'ausdauer' ? 6500 : 0) - (bd.sick ? 4000 : 0), 1200, 30000);
    const startH = 7;
    const endH = isToday ? Math.min(21, new Date(dayEndMs).getHours()) : 21;
    for (let h = startH; h < endH; h++) {
      const share = stepsTotal / (21 - startH);
      const v = Math.max(0, Math.round(N(share, share * 0.5)));
      push('steps', at(d, h * 60), at(d, h * 60 + 59), v);
      push('steps', at(d, h * 60), at(d, h * 60 + 59), Math.round(v * 0.82), PHONE);
    }
    if (weekday(d) === 0) push('vo2', at(d, 9 * 60), at(d, 9 * 60), Math.round((44 + 2 * progress + N(0, 0.4)) * 10) / 10);
  }

  // Umfrage
  const answerP = (p) => chance(p);
  dates.slice(1).forEach((d) => {
    const n = nightInfo.get(d);
    const b = behavior.get(d);
    const prevB = behavior.get(addDays(d, -1));
    const isToday = d === endDate;
    const a = {};
    const ts = {};
    const morningOk = isToday || answerP(0.93);
    if (morningOk && n) {
      const latent = (n.lnHrv - (Math.log(44) + 0.12 * (b.i / days))) / 0.1 - (n.rhr - (58 - 3 * (b.i / days))) / 2.5;
      a.M1 = clamp(Math.round(3 + 0.55 * latent + N(0, 0.6)), 1, 5);
      a.M2 = clamp(Math.round(a.M1 + N(0, 0.7)), 1, 5);
      a.M3 = prevB.training?.kind === 'kraft' ? (chance(0.6) ? 1 : 2) : prevB.training?.kind === 'hiit' ? 1 : 0;
      if (a.M3 > 0) a.M3r = [prevB.training?.kind === 'kraft' ? 'beine' : 'ganz'];
      a.M4 = clamp(Math.round(3.4 - n.extraWakes * 0.5 - (n.latencyMin > 30 ? 0.7 : 0) + N(0, 0.6)), 1, 5);
      a.M5 = n.latencyMin < 15 ? 'lt15' : n.latencyMin < 30 ? '15-30' : n.latencyMin < 60 ? '30-60' : 'gt60';
      a.M6 = clamp(n.extraWakes + (chance(0.3) ? 1 : 0), 0, 3);
      if (a.M6 > 0) a.M6r = [pick(['toilette', 'hitze', 'gedanken', 'unbekannt'])];
      a.M7 = clamp(Math.round(N(3.6, 0.7) + (a.M1 - 3) * 0.3), 1, 5);
      a.M8 = clamp(Math.round(N(3.4, 0.8) + (a.M1 - 3) * 0.4), 1, 5);
      a.M9 = n.drinksBefore >= 3 ? 1 + Math.round(rnd()) : chance(0.05) ? 1 : 0;
      a.M10 = n.sick ? ['hals', 'schnupfen'] : ['keine'];
      a.M11 = n.drinksBefore >= 2 && chance(0.4);
      const wdNow = weekday(d);
      a.M12 = wdNow >= 1 && wdNow <= 5 ? 'wecker' : 'natuerlich';
      if (a.M12 === 'wecker') a.M12s = chance(0.3) ? 1 : 0;
      if (n.sick) {
        a.G2 = 'keine';
        a.G3 = 'keine';
        a.G4 = 3;
        a.G5 = false;
      }
      ts.morning = n.wake + (10 + rnd() * 25) * MIN;
    }
    const eveningOk = !isToday && answerP(0.88);
    if (eveningOk) {
      a.A1 = b.stress;
      a.A2 = b.mental;
      a.A3 = b.drinks > 0;
      a.A4 = b.caf;
      if (b.caf > 0) a.A4t = minutesToHm(b.cafTime);
      a.A5 = minutesToHm(b.mealTime);
      a.A5s = b.mealSize;
      a.A6 = b.hydration;
      a.A7 = Boolean(b.training);
      a.A8 = b.screen;
      a.A9 = b.daylight;
      const rec = [b.sauna && 'sauna', b.stretch && 'dehnen', b.meditation && 'meditation'].filter(Boolean);
      a.A10 = rec.length ? rec : ['keine'];
      a.A11 = chance(0.92) ? 'ja' : 'nein';
      a.SUP = b.supps.length ? b.supps : ['keine'];
      const ev = [b.party && 'party', b.exam && 'pruefung'].filter(Boolean);
      a.A12 = ev.length ? ev : ['keines'];
      if (b.drinks) {
        a.X1 = b.drinks;
        a.X2 = minutesToHm(b.drinkTime);
        a.X3 = [b.drinks >= 3 ? 'bier' : pick(['bier', 'wein'])];
        a.X4 = chance(0.7);
      }
      if (b.training) {
        a.T1 = [b.training.kind];
        a.T13 = b.training.dur;
        a.T2 = b.training.rpe;
        a.T3 = pick(['normal', 'normal', 'besser', 'schlechter']);
        a.T5 = pick(['leicht', 'voll', 'leicht']);
        a.T6 = context.get(d).tMax >= 28;
        a.T7 = chance(0.8);
        a.T8 = chance(0.9) ? 'keiner' : 'leicht';
        a.T11 = chance(0.85) ? 'plan' : 'spontan';
        a.T12 = false;
      }
      const wd = b.wd;
      if (wd === 0) {
        const hot = context.get(d).nightTempMin >= 17;
        Object.assign(a, { S1: hot ? 'gt22' : '16-19', S2: 'leicht', S3: 'dunkel', S4: hot, S5: 'partner', S6: 'zuhause', S7: 'seite', S8: 'keiner', S9: ['keine'], S10: 'nein', S11: 'keine' });
        Object.assign(a, { W1a: clamp(Math.round(N(3.6, 0.7)), 1, 5), W1b: clamp(Math.round(N(3.4, 0.8)), 1, 5), W1c: clamp(Math.round(N(3.3, 0.8)), 1, 5), W1d: clamp(Math.round(N(3.7, 0.7)), 1, 5), W3: pick(['ja', 'ja', 'teils']), T9: 'normal', T10: '4-8', W5: 7.75, W6: 3 });
      }
      if (wd === 2 || wd === 5) {
        Object.assign(a, { E1: pick(['defizit', 'ausgeglichen', 'ausgeglichen', 'ueberschuss']), E2: pick(['normal', 'hoch', 'hoch']), E3: 'normal', E4: chance(0.3), E5: chance(0.2), E6: chance(0.15) ? '16' : 'kein', E7: chance(0.1) ? 'leicht' : 'keine', E9: ['kaffee'], E10: ['keine'] });
      }
      if (wd === 1 || wd === 3 || wd === 5 || b.stress >= 4) {
        Object.assign(a, {
          P1: b.stress >= 4 ? ['arbeit'] : ['keine'],
          P2: b.stress >= 4 ? (chance(0.6) ? 'etwas' : 'stark') : chance(0.2) ? 'etwas' : 'nein',
          P3: chance(0.08),
          P4: b.stress >= 4 ? 'spaet' : pick(['frueh', 'normal', 'normal']),
          P5: chance(0.4) ? [pick(['lesen', 'musik', 'spaziergang'])] : ['keine'],
          P6: b.weekend || chance(0.2),
          P7: pick(['wenig', 'normal', 'normal', 'viel']),
          P8: b.stress >= 4 && chance(0.3) ? 'etwas' : 'nein',
          P9: chance(0.4),
          P10: pick(['lt2', '2-5', '2-5', 'gt5']),
        });
        if (a.P7 !== 'wenig') a.P7q = pick(['gut', 'gut', 'neutral']);
      }
      if (b.sick) a.A12 = ['keines'];
      ts.evening = at(d, 21 * 60 + Math.floor(rnd() * 60));
    }
    if (Object.keys(a).length) survey.set(d, { a, ts, backfilled: {} });
  });

  const journal = demoJournal({ dates, behavior, nightInfo, endDate, nowMs, seed, at });
  return { samples, workouts, survey, journal, context, startDate, endDate };
}

/**
 * Logbuch für alle Tage, passend zum Verhalten oben: Wasser im Bereich der Abendcheck-Antwort,
 * Koffein mit derselben Anzahl und Uhrzeit, Spaziergänge, Arbeitsstunden, Glück und ein paar Tagebuchzeilen.
 * Eigener Zufallsstrom, damit alle übrigen Beispieldaten gleich bleiben.
 */
function demoJournal({ dates, behavior, nightInfo, endDate, nowMs, seed, at }) {
  const rnd = mulberry32(seed + 202);
  const chance = (p) => rnd() < p;
  const gauss = () => {
    let u = 0;
    let v = 0;
    while (!u) u = rnd();
    while (!v) v = rnd();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const N = (m, sd) => m + sd * gauss();
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const hm = (m) => minutesToHm(m);
  const out = new Map();
  let n = 0;
  const from = 1;
  const TEXT = {
    kraft: ['Krafttraining: Kniebeugen und Bankdrücken, lief gut.', 'Beine trainiert. Zäh, aber geschafft.', 'Oberkörper im Studio, neue Bestleistung beim Rudern.'],
    ausdauer: ['Abends gelaufen, ruhiges Tempo, Kopf war danach frei.', 'Lange Runde mit dem Rad, schönes Licht.'],
    hiit: ['Kurzes Intervalltraining, danach komplett platt.'],
    team: ['Fußball mit den Jungs, 2:1 gewonnen.'],
    mobility: ['Yoga am Abend, Rücken fühlt sich besser an.'],
    party: ['Geburtstag bei Freunden, viel gelacht, viel zu spät ins Bett.', 'Abends unterwegs gewesen. Morgen wird es zäh.'],
    exam: ['Prüfungsvorbereitung, fast den ganzen Tag am Schreibtisch.', 'Deadline-Stress. Wenigstens ist der Entwurf fertig.'],
    sick: ['Halsschmerzen und schlapp. Früh ins Bett.', 'Immer noch erkältet, nur Tee und Sofa.'],
    weekend: ['Ausgeschlafen und lange gefrühstückt.', 'Spaziergang am See, viel draußen gewesen.', 'Familie besucht, entspannter Tag.'],
    work: ['Ruhiger Bürotag.', 'Viel geschafft heute, guter Tag.', 'Etwas müde, aber okay.', 'Langes Meeting, danach gekocht und früh ins Bett.', 'Neues Projekt gestartet, bin gespannt.'],
  };
  for (let i = from; i < dates.length; i++) {
    const d = dates[i];
    const b = behavior.get(d);
    const night = nightInfo.get(d);
    const isToday = d === endDate;
    const nowMin = isToday ? Math.floor((nowMs - at(d, 0)) / 60000) : 26 * 60;
    const rec = { e: {}, x: {}, f: {} };
    const put = (entry, minutes) => {
      if (minutes > nowMin) return;
      rec.e[`demo${(n++).toString(36)}`] = { ...entry, at: hm(minutes), u: at(d, minutes) };
    };
    const field = (name, v, minutes) => {
      if (minutes > nowMin) return;
      rec.f[name] = { v, u: at(d, minutes) };
    };
    // Wasser: Summe im Bereich der Antwort „Getrunken“
    const target = b.hydration === 'lt15' ? 900 + Math.floor(rnd() * 11) * 50 : b.hydration === 'gt25' ? 2600 + Math.floor(rnd() * 13) * 50 : 1600 + Math.floor(rnd() * 17) * 50;
    let total = 0;
    let t = 7 * 60 + 20 + Math.floor(rnd() * 30);
    while (target - total >= 50) {
      let ml = pick([250, 250, 300, 500]);
      // Der letzte Schluck macht die Summe genau voll, damit sie im Bereich der Antwort bleibt
      if (target - total - ml < 50) ml = target - total;
      put({ type: 'water', ml }, t);
      total += ml;
      t = Math.min(22 * 60, t + 70 + Math.floor(rnd() * 90));
    }
    // Koffein: gleiche Anzahl und letzte Uhrzeit wie im Verhalten
    if (b.caf === 0) field('noCaffeine', true, 20 * 60);
    const spacing = b.caf > 1 ? Math.min(150, Math.max(25, (b.cafTime - 6 * 60 - 30) / (b.caf - 1))) : 0;
    for (let k = 0; k < b.caf; k++) {
      const minutes = Math.round(b.cafTime - spacing * (b.caf - 1 - k));
      const kind = k === 0 ? pick(['kaffee', 'kaffee', 'milchkaffee']) : pick(['kaffee', 'espresso', 'espresso', 'schwarztee', 'milchkaffee']);
      const mg = { kaffee: 90, espresso: 80, milchkaffee: 80, schwarztee: 45 }[kind];
      put({ type: 'caffeine', kind, mg }, minutes);
    }
    // Spaziergänge (kein Training)
    if (!b.sick && chance(b.weekend ? 0.6 : 0.35)) put({ type: 'sport', kind: 'gehen', min: pick([20, 30, 40, 45, 60]) }, b.weekend ? 15 * 60 + Math.floor(rnd() * 60) : 12 * 60 + 35);
    // Arbeit
    let work = 0;
    if (!b.sick) {
      if (b.wd >= 1 && b.wd <= 5) work = Math.round((b.wd === 5 ? N(6.8, 0.8) : N(8.3, 0.8)) * 2) / 2 + (b.exam ? 1.5 : 0);
      else if (b.wd === 0 && chance(0.25)) work = pick([1.5, 2, 3]);
    }
    field('work', Math.max(0, Math.min(13, work)), 19 * 60 + 30);
    // Glück: Schlaf der Nacht davor, Stress, Training, Wochenende, Alkohol am Vorabend, Krankheit
    const prev = behavior.get(addDays(d, -1));
    let happy = 6.7 - 0.45 * (b.stress - 3) + (b.training ? 0.7 : 0) + (b.weekend ? 0.5 : 0) - (night?.extraWakes || 0) * 0.35 - ((night?.latencyMin || 0) > 35 ? 0.5 : 0) - (prev?.drinks >= 3 ? 0.9 : 0) - (b.sick || night?.sick ? 2 : 0) - (b.exam ? 0.7 : 0) - (work >= 9.5 ? 0.6 : 0) + N(0, 0.9);
    field('happy', Math.max(0, Math.min(10, Math.round(happy))), 21 * 60 + 40);
    // Tagebuch an etwa jedem zweiten Tag
    if (chance(0.5)) {
      const key = b.sick ? 'sick' : b.party ? 'party' : b.exam ? 'exam' : b.training && chance(0.7) ? b.training.kind : b.weekend ? 'weekend' : 'work';
      field('text', pick(TEXT[key] || TEXT.work), 21 * 60 + 45);
    }
    if (Object.keys(rec.e).length || Object.keys(rec.f).length) out.set(d, rec);
  }
  return out;
}
