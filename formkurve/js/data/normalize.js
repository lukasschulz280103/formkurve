// Übersetzt Apple-Health-Typen, deutsche/englische Namen aus dem Kurzbefehl, Einheiten und
// Schlafphasen in ein einheitliches internes Format.

export const TYPES = {
  hr: { label: 'Herzfrequenz', unit: 'bpm' },
  rhr: { label: 'Ruhepuls (Apple Health)', unit: 'bpm' },
  hrv: { label: 'HRV', unit: 'ms' },
  spo2: { label: 'Blutsauerstoff', unit: '%' },
  resp: { label: 'Atemfrequenz', unit: '/min' },
  steps: { label: 'Schritte', unit: '' },
  sleep: { label: 'Schlafanalyse', unit: '' },
  wtemp: { label: 'Handgelenktemperatur', unit: '°C' },
  btemp: { label: 'Körpertemperatur', unit: '°C' },
  vo2: { label: 'VO₂max', unit: 'ml/kg/min' },
  mass: { label: 'Gewicht', unit: 'kg' },
  energy: { label: 'Aktive Energie', unit: 'kcal' },
};

const HK = {
  HKQuantityTypeIdentifierHeartRate: 'hr',
  HKQuantityTypeIdentifierRestingHeartRate: 'rhr',
  HKQuantityTypeIdentifierHeartRateVariabilitySDNN: 'hrv',
  HKQuantityTypeIdentifierOxygenSaturation: 'spo2',
  HKQuantityTypeIdentifierRespiratoryRate: 'resp',
  HKQuantityTypeIdentifierStepCount: 'steps',
  HKCategoryTypeIdentifierSleepAnalysis: 'sleep',
  HKQuantityTypeIdentifierAppleSleepingWristTemperature: 'wtemp',
  HKQuantityTypeIdentifierBodyTemperature: 'btemp',
  HKQuantityTypeIdentifierVO2Max: 'vo2',
  HKQuantityTypeIdentifierBodyMass: 'mass',
  HKQuantityTypeIdentifierActiveEnergyBurned: 'energy',
};
const HK_LOWER = Object.fromEntries(Object.entries(HK).map(([k, v]) => [k.toLowerCase(), v]));

export function typeFromHK(id) {
  return HK[id] || null;
}

function fold(s) {
  return String(s)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

const RULES = [
  [/variabil|hrv/, 'hrv'],
  [/ruheherz|ruhepuls|restingheart|restinghr/, 'rhr'],
  [/gehen|walking|benachrichtig|notification|ereignis|event|erholung|recovery|vorhofflimmern|afib|ekg|ecg|hoch|niedrig|unregel/, null],
  [/herzfrequenz|heartrate|^puls$|^hr$/, 'hr'],
  [/sauerstoff|oxygen|spo2/, 'spo2'],
  [/atemfrequenz|respiratory|atemzug/, 'resp'],
  [/schritt|stepcount|^steps?$/, 'steps'],
  [/handgelenk|wrist/, 'wtemp'],
  [/korpertemp|bodytemp|basaltemp/, 'btemp'],
  [/vo2|cardiofit/, 'vo2'],
  [/korpergewicht|gewicht|bodymass|^weight$/, 'mass'],
  [/aktiveenergie|aktivenergie|activeenergy/, 'energy'],
  [/schlaf|sleep/, 'sleep'],
];

/** Typ aus einem Namen (Kurzbefehl, deutsch/englisch) oder HK-Bezeichner. null = ignorieren. */
export function typeFromName(name) {
  if (name == null) return null;
  const raw = String(name).trim();
  if (HK[raw]) return HK[raw];
  const f = fold(raw);
  if (!f) return null;
  if (HK_LOWER[f]) return HK_LOWER[f];
  for (const [re, t] of RULES) if (re.test(f)) return t;
  return null;
}

/** Zahl aus Text mit deutschem oder englischem Dezimaltrennzeichen. */
export function parseNumber(v, type) {
  if (typeof v === 'number') return v;
  if (v == null) return NaN;
  let s = String(v).trim().replace(/\s/g, '').replace(/[^0-9,.\-]/g, '');
  s = s.replace(/[.,]+$/, '');
  if (!s || s === '-') return NaN;
  const hasC = s.includes(',');
  const hasD = s.includes('.');
  const integerType = type === 'steps' || type === 'energy';
  if (hasC && hasD) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (hasC) {
    s = integerType && /^-?\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.');
  } else if (hasD && integerType && /^-?\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, '');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

export const SLEEP = { INBED: 0, ASLEEP: 1, AWAKE: 2, CORE: 3, DEEP: 4, REM: 5 };
export const SLEEP_LABEL = ['Im Bett', 'Schlaf', 'Wach', 'Kern', 'Tief', 'REM'];

/** Schlafphase aus HK-Wert, deutschem/englischem Text oder Zahl. */
export function sleepCode(value) {
  if (value == null) return SLEEP.ASLEEP;
  if (typeof value === 'number') return value >= 0 && value <= 5 ? value : SLEEP.ASLEEP;
  let s = fold(String(value).replace(/^HKCategoryValueSleepAnalysis/i, ''));
  if (/^\d$/.test(s)) return Math.min(5, Number(s));
  if (/rem/.test(s)) return SLEEP.REM;
  if (/deep|tief/.test(s)) return SLEEP.DEEP;
  if (/core|kern|light|leicht/.test(s)) return SLEEP.CORE;
  if (/awake|wach/.test(s)) return SLEEP.AWAKE;
  if (/inbed|bett/.test(s)) return SLEEP.INBED;
  return SLEEP.ASLEEP;
}

const LIMITS = {
  hr: [30, 230],
  rhr: [30, 150],
  hrv: [5, 300],
  spo2: [70, 100],
  resp: [4, 40],
  steps: [0, 100000],
  wtemp: [25, 45],
  btemp: [34, 43],
  vo2: [10, 90],
  mass: [30, 300],
  energy: [0, 10000],
};

/** Normalisiert Einheiten und prüft Plausibilität. Gibt NaN für unbrauchbare Werte zurück. */
export function normalizeValue(type, value, unit = '') {
  if (type === 'sleep') return sleepCode(value);
  let v = parseNumber(value, type);
  if (!Number.isFinite(v)) return NaN;
  const u = String(unit || '').toLowerCase();
  if (type === 'spo2' && v <= 1.0001) v *= 100;
  if ((type === 'wtemp' || type === 'btemp') && /f/.test(u) && !/c/.test(u)) v = ((v - 32) * 5) / 9;
  if (type === 'mass' && /lb/.test(u)) v *= 0.45359237;
  if (type === 'energy' && /kj/.test(u)) v /= 4.184;
  if (type === 'hrv' && /^s$|sec/.test(u) && v < 2) v *= 1000;
  const lim = LIMITS[type];
  if (lim && (v < lim[0] || v > lim[1])) return NaN;
  return v;
}

const WORKOUT_KIND = [
  [/strength|kraft|functional|core|crosstraining/i, 'kraft'],
  [/highintensity|hiit|intervall/i, 'hiit'],
  [/run|lauf|cycl|rad|bike|swim|schwimm|row|ruder|elliptical|hik|wander|walk|geh|stair|ski|skating/i, 'ausdauer'],
  [/yoga|pilates|flexib|mind|stretch|dehn|mobility|cooldown/i, 'mobility'],
  [/soccer|fuss|basket|hand|volley|tennis|badminton|squash|hockey|rugby|football|team/i, 'team'],
];

export function workoutKind(name) {
  const s = String(name || '').replace(/^HKWorkoutActivityType/, '');
  for (const [re, k] of WORKOUT_KIND) if (re.test(s)) return k;
  return 'andere';
}

export const WORKOUT_LABEL = { kraft: 'Kraft', hiit: 'HIIT', ausdauer: 'Ausdauer', mobility: 'Mobility', team: 'Teamsport', andere: 'Training' };

/** Standardreihenfolge der Quellen: Zepp/Amazfit zuerst, dann nach Datenmenge. */
export function defaultSourceOrder(counts) {
  return Object.keys(counts).sort((a, b) => {
    const za = /zepp|amazfit|helio/i.test(a) ? 0 : 1;
    const zb = /zepp|amazfit|helio/i.test(b) ? 0 : 1;
    if (za !== zb) return za - zb;
    return (counts[b] || 0) - (counts[a] || 0);
  });
}

export function decodeEntities(s) {
  if (!s || s.indexOf('&') < 0) return s;
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}
