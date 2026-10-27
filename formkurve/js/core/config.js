// Standardeinstellungen. Alles, was das Modell beeinflusst, ist hier konfigurierbar
// und in der App unter "Daten -> Modell" änderbar.
export const DEFAULTS = {
  version: 1,
  profile: {
    birthYear: null, // optional; macht Normalwerte und Maximalpuls genauer
    sex: null, // 'w' | 'm' | 'd' | 'x' (keine Angabe) | null (nicht gefragt)
    heightCm: null,
    weightKg: null,
    age: null, // veraltet (Version 0.1), wird in Geburtsjahr umgerechnet
    hrMax: null, // null = 208 - 0,7 x Alter, ohne Alter 190
    sleepNeedBase: 8.0,
  },
  display: {
    theme: 'auto', // auto | dark | light
    hideScoresUntilMorning: true,
    profileHintDismissed: false,
  },
  import: {
    hrvDayShift: 0, // 0 oder 1 Tag (bekannter Zepp-Versatz)
    sourcePriority: [], // leer = Zepp/Amazfit zuerst, dann nach Datenmenge
    windowDays: 400, // so weit zurück wird ein Health-Export gelesen
  },
  model: {
    baselineWindow: 28,
    baselineMinDays: 14,
    baselineMinUsable: 5,
    recovery: {
      wHrv: 0.4, wRhr: 0.25, wSleep: 0.2, wVital: 0.1, wSubj: 0.05,
      spread: 1.5, sleepNeutral: 75, sleepScale: 12.5,
      red: 34, green: 67,
    },
    sleep: {
      wDuration: 0.4, wEfficiency: 0.2, wStages: 0.2, wRegularity: 0.2,
      effLow: 0.7, effHigh: 0.92, stageLow: 0.15, stageHigh: 0.4,
      regGood: 20, regBad: 120,
      strainNeedFrom: 40, strainNeedPerPoint: 0.01,
      debtFactor: 0.25, extraCap: 1.5, napCap: 1.0,
      sessionGapMin: 90, minSleepH: 4,
    },
    strain: {
      k: 250, strengthFactor: 0.4, defaultRpe: 6, gapCapMin: 10,
      zoneEdges: [0.5, 0.6, 0.7, 0.8, 0.9],
    },
    balance: { lo: 0.8, hi: 1.3, minDays: 14 },
    fitness: {
      halfLife: 42,
      rhrBest: 42, rhrWorst: 78,
      hrvLow: 20, hrvHigh: 100,
      activeTarget: 300, regularTarget: 4, regularStrain: 30,
      vo2Low: 30, vo2High: 60,
      wRhr: 0.3, wHrv: 0.2, wActive: 0.3, wRegular: 0.1, wVo2: 0.1,
    },
    form: { wR: 0.45, wS: 0.25, wB: 0.15, wF: 0.15, lag0: 0.5, lag1: 0.3, lag2: 0.2 },
  },
  survey: {
    nutritionDays: [2, 5], // Di, Fr
    stressDays: [1, 3, 5], // Mo, Mi, Fr
    weeklyDay: 0, // So
    askNicotine: false,
    sensitive: false,
    backfillDays: 3,
    morningUntilHour: 14,
  },
  analysis: { minN: 10, permutations: 2000, bootstrap: 1000, qThreshold: 0.1 },
  context: { enabled: false, auto: false, place: null },
};

/** Parameter, die im Einstellungs-Editor angezeigt werden. */
export const PARAMS = [
  { group: 'Recovery', path: 'model.recovery.wHrv', label: 'Gewicht HRV', min: 0, max: 1, step: 0.05 },
  { group: 'Recovery', path: 'model.recovery.wRhr', label: 'Gewicht Ruhepuls', min: 0, max: 1, step: 0.05 },
  { group: 'Recovery', path: 'model.recovery.wSleep', label: 'Gewicht Schlaf', min: 0, max: 1, step: 0.05 },
  { group: 'Recovery', path: 'model.recovery.wVital', label: 'Gewicht Vitalwerte', min: 0, max: 1, step: 0.05 },
  { group: 'Recovery', path: 'model.recovery.wSubj', label: 'Gewicht Gefühl (Morgencheck)', min: 0, max: 1, step: 0.05 },
  { group: 'Recovery', path: 'model.recovery.spread', label: 'Spreizfaktor', min: 0.5, max: 3, step: 0.1 },
  { group: 'Recovery', path: 'model.recovery.red', label: 'Grenze rot unter', min: 10, max: 50, step: 1 },
  { group: 'Recovery', path: 'model.recovery.green', label: 'Grenze grün ab', min: 50, max: 90, step: 1 },
  { group: 'Schlaf', path: 'model.sleep.wDuration', label: 'Gewicht Dauer', min: 0, max: 1, step: 0.05 },
  { group: 'Schlaf', path: 'model.sleep.wEfficiency', label: 'Gewicht Effizienz', min: 0, max: 1, step: 0.05 },
  { group: 'Schlaf', path: 'model.sleep.wStages', label: 'Gewicht Tief + REM', min: 0, max: 1, step: 0.05 },
  { group: 'Schlaf', path: 'model.sleep.wRegularity', label: 'Gewicht Regelmäßigkeit', min: 0, max: 1, step: 0.05 },
  { group: 'Strain', path: 'model.strain.k', label: 'Teiler (Skalierung)', min: 100, max: 500, step: 10 },
  { group: 'Strain', path: 'model.strain.strengthFactor', label: 'Kraft-Zuschlag je Minute × RPE', min: 0, max: 1.5, step: 0.05 },
  { group: 'Strain', path: 'model.strain.defaultRpe', label: 'RPE, wenn nicht angegeben', min: 1, max: 10, step: 1 },
  { group: 'Tagesform', path: 'model.form.wR', label: 'Gewicht Recovery', min: 0, max: 1, step: 0.05 },
  { group: 'Tagesform', path: 'model.form.wS', label: 'Gewicht Schlaf', min: 0, max: 1, step: 0.05 },
  { group: 'Tagesform', path: 'model.form.wB', label: 'Gewicht Belastungsbalance', min: 0, max: 1, step: 0.05 },
  { group: 'Tagesform', path: 'model.form.wF', label: 'Gewicht Langzeit-Fitness', min: 0, max: 1, step: 0.05 },
  { group: 'Langzeit-Fitness', path: 'model.fitness.halfLife', label: 'Halbwertszeit (Tage)', min: 14, max: 120, step: 1 },
  { group: 'Langzeit-Fitness', path: 'model.fitness.activeTarget', label: 'Ziel Aktivminuten pro Woche', min: 60, max: 600, step: 10 },
  { group: 'Baseline', path: 'model.baselineWindow', label: 'Fenster (Tage)', min: 14, max: 60, step: 1 },
  { group: 'Baseline', path: 'model.baselineMinDays', label: 'Kalibriert ab (Tagen)', min: 5, max: 28, step: 1 },
  { group: 'Einsichten', path: 'analysis.minN', label: 'Mindestens Tage je Gruppe', min: 5, max: 30, step: 1 },
  { group: 'Einsichten', path: 'analysis.qThreshold', label: 'Fehlerrate (q) für „belastbar“', min: 0.01, max: 0.25, step: 0.01 },
];

export function clone(x) {
  return x == null ? x : JSON.parse(JSON.stringify(x));
}

function isObj(x) {
  return x && typeof x === 'object' && !Array.isArray(x);
}

export function deepMerge(base, over) {
  const out = clone(base);
  if (!isObj(over)) return out;
  for (const [k, v] of Object.entries(over)) {
    if (isObj(v) && isObj(out[k])) out[k] = deepMerge(out[k], v);
    else if (v !== undefined) out[k] = clone(v);
  }
  return out;
}

export function mergeSettings(saved) {
  return deepMerge(DEFAULTS, saved || {});
}

export function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

export function setPath(obj, path, value) {
  const keys = path.split('.');
  const out = clone(obj);
  let o = out;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!isObj(o[keys[i]])) o[keys[i]] = {};
    o = o[keys[i]];
  }
  o[keys[keys.length - 1]] = value;
  return out;
}

/** Alter aus dem Geburtsjahr (oder dem alten Altersfeld); null, wenn nicht angegeben. */
export function ageOf(settings, now = new Date()) {
  const p = settings?.profile || {};
  if (p.birthYear) return now.getFullYear() - p.birthYear;
  if (p.age) return p.age;
  return null;
}

export function hrMaxOf(settings) {
  const p = settings.profile || {};
  if (p.hrMax) return p.hrMax;
  const age = ageOf(settings);
  return age ? Math.round(208 - 0.7 * age) : 190;
}

export function bmiOf(settings) {
  const { heightCm, weightKg } = settings?.profile || {};
  if (!heightCm || !weightKg) return null;
  return weightKg / (heightCm / 100) ** 2;
}
