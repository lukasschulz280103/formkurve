// Einflussanalyse (Konzept Abschnitt 8): Gruppenvergleich je Faktor und Zielwert mit
// Permutationstest, Bootstrap-Intervall, Benjamini-Hochberg-Korrektur und bereinigtem Effekt (Ridge).
import { addDays, weekday, hmToMinutes } from '../core/time.js';
import { isNum, mean, sd, permutationTest, bootstrapDiffCI, benjaminiHochberg, mulberry32, hashString, ridge, pearson } from '../core/stats.js';
import { effectiveAnswers } from '../survey/engine.js';
import { SUPPLEMENTS, allSupplements, supplementTargets, supplementsOf } from '../survey/supplements.js';
import { isHoliday, moonAge } from '../context/calendar.js';
import { journalAnswers, sportSessions, isEmptyDay } from '../journal/journal.js';

const LAT_SUBJ = { lt15: 10, '15-30': 22, '30-60': 45, gt60: 75 };

export const TARGETS = {
  hrv: { label: 'HRV', unit: '%', better: 'up', get: (d) => (isNum(d.lnHrv) && d.base?.lnHrv ? d.lnHrv - d.base.lnHrv.median : null), log: true },
  rhr: { label: 'Ruhepuls', unit: 'bpm', better: 'down', get: (d) => (isNum(d.rhr) && d.base?.rhr ? d.rhr - d.base.rhr.median : null) },
  recovery: { label: 'Recovery', unit: 'Punkte', short: 'Pkt.', better: 'up', get: (d) => d.recovery },
  sleepScore: { label: 'Schlaf-Score', unit: 'Punkte', short: 'Pkt.', better: 'up', get: (d) => d.sleepScore },
  deep: { label: 'Tiefschlaf', unit: 'min', better: 'up', get: (d) => d.sleep?.deepMin ?? null },
  rem: { label: 'REM-Schlaf', unit: 'min', better: 'up', get: (d) => d.sleep?.remMin ?? null },
  latency: { label: 'Einschlafdauer (gemessen)', unit: 'min', better: 'down', get: (d) => d.sleep?.latencyMin ?? null },
  latencySubj: { label: 'Einschlafdauer (gefühlt)', unit: 'min', better: 'down', get: (d) => LAT_SUBJ[d.survey?.a?.M5] ?? null },
  efficiency: { label: 'Schlafeffizienz', unit: '%-Punkte', short: '%-Pkt.', better: 'up', get: (d) => (isNum(d.sleep?.efficiency) ? d.sleep.efficiency * 100 : null) },
  asleep: { label: 'Schlafdauer', unit: 'min', better: 'up', get: (d) => d.sleep?.asleepMin ?? null },
  wake: { label: 'Aufwachphasen', unit: '', better: 'down', get: (d) => d.sleep?.wakeEpisodes ?? null },
  feel: { label: 'Gefühl am Morgen (1–5)', unit: 'Punkte (1–5)', short: 'Pkt.', better: 'up', get: (d) => (typeof d.survey?.a?.M1 === 'number' ? d.survey.a.M1 : null) },
  // Tageswert aus dem Logbuch: gilt für den Tag, nicht für eine Nacht
  happy: { label: 'Glück (0–10)', unit: 'Punkte (0–10)', short: 'Pkt.', better: 'up', day: true, get: (d) => (isNum(d.journal?.happy) ? d.journal.happy : null) },
};

const SLEEPT = ['sleepScore', 'deep', 'latency', 'latencySubj'];
const PHYS = ['hrv', 'rhr', 'recovery'];

const inc = (arr, v) => Array.isArray(arr) && arr.includes(v);
const answered = (arr) => Array.isArray(arr) && arr.length > 0;
const time = (hm) => hmToMinutes(hm);

function F(id, group, label, get, a, b, targets, extra = {}) {
  return { id, group, label, get, a, b, targets, lag: 1, aLabel: 'ja', bLabel: 'nein', ...extra };
}

function multiOpt(qid, opt, group, label, targets, extra) {
  return F(`${qid}_${opt}`, group, label, (c) => (answered(c.a[qid]) ? inc(c.a[qid], opt) : undefined), (v) => v === true, (v) => v === false, targets, extra);
}

export const FACTORS = [
  // Gewohnheiten (Abendcheck)
  F('alc', 'Gewohnheiten', 'Alkohol getrunken', (c) => c.a.A3, (v) => v === true, (v) => v === false, ['hrv', 'rhr', 'recovery', 'rem', 'deep', 'sleepScore', 'feel', 'happy'], { aLabel: 'mit Alkohol', bLabel: 'ohne' }),
  F('alc2', 'Gewohnheiten', '2 oder mehr alkoholische Getränke', (c) => (c.a.A3 === false ? 0 : c.a.A3 === true ? c.a.X1 : undefined), (v) => isNum(v) && v >= 2, (v) => v === 0, ['hrv', 'rhr', 'recovery', 'rem'], { aLabel: '2+ Getränke', bLabel: 'keine', dose: [[0, '0'], [1, '1'], [2, '2'], [3, '3+']] }),
  F('alcLate', 'Gewohnheiten', 'Letztes Getränk nach 22 Uhr', (c) => (c.a.A3 === true ? time(c.a.X2) : undefined), (v) => isNum(v) && v >= 22 * 60, (v) => isNum(v) && v < 22 * 60, ['hrv', 'rhr', 'rem'], { aLabel: 'nach 22 Uhr', bLabel: 'früher' }),
  F('cafLate', 'Gewohnheiten', 'Koffein nach 14 Uhr', (c) => (c.a.A4 === 0 ? -1 : (c.a.A4 ?? 0) > 0 ? time(c.a.A4t) : undefined), (v) => isNum(v) && v >= 14 * 60, (v) => v === -1 || (isNum(v) && v < 14 * 60), ['latency', 'latencySubj', 'deep', 'sleepScore', 'efficiency'], { aLabel: 'nach 14 Uhr', bLabel: 'früher oder keins' }),
  F('cafMuch', 'Gewohnheiten', '3 oder mehr koffeinhaltige Getränke', (c) => c.a.A4, (v) => isNum(v) && v >= 3, (v) => isNum(v) && v <= 1, ['latency', 'latencySubj', 'deep', 'hrv'], { aLabel: '3+', bLabel: '0–1', dose: [[0, '0'], [1, '1'], [2, '2'], [3, '3+']] }),
  F('mealLate', 'Gewohnheiten', 'Letzte Mahlzeit nach 21 Uhr', (c) => time(c.a.A5), (v) => isNum(v) && v >= 21 * 60, (v) => isNum(v) && v < 21 * 60 && v > 4 * 60, ['rhr', 'hrv', 'efficiency', 'sleepScore'], { aLabel: 'nach 21 Uhr', bLabel: 'früher' }),
  F('mealHeavy', 'Gewohnheiten', 'Schwere letzte Mahlzeit', (c) => c.a.A5s, (v) => v === 'schwer', (v) => v === 'leicht' || v === 'normal', ['rhr', 'hrv', 'deep', 'efficiency'], { aLabel: 'schwer', bLabel: 'leicht oder normal' }),
  F('hydrLow', 'Gewohnheiten', 'Wenig getrunken (< 1,5 l)', (c) => c.a.A6, (v) => v === 'lt15', (v) => v === '15-25' || v === 'gt25', ['rhr', 'hrv', 'feel']),
  F('stress', 'Gewohnheiten', 'Hoher Stress (4–5)', (c) => c.a.A1, (v) => v >= 4, (v) => v <= 2, ['hrv', 'rhr', 'latency', 'latencySubj', 'deep', 'recovery'], { aLabel: 'Stress 4–5', bLabel: 'Stress 1–2' }),
  F('mental', 'Gewohnheiten', 'Hohe geistige Belastung', (c) => c.a.A2, (v) => v >= 4, (v) => v <= 2, ['latency', 'latencySubj', 'hrv'], { aLabel: '4–5', bLabel: '1–2' }),
  F('screen', 'Gewohnheiten', 'Bildschirm 30+ Minuten vor dem Schlafen', (c) => c.a.A8, (v) => v === '30-60' || v === 'gt60', (v) => v === '0' || v === 'lt30', ['latency', 'latencySubj', 'sleepScore']),
  F('daylight', 'Gewohnheiten', 'Über 1 Stunde Tageslicht', (c) => c.a.A9, (v) => v === 'gt60', (v) => v === 'lt15', ['latency', 'latencySubj', 'sleepScore', 'deep'], { aLabel: '> 60 min', bLabel: '< 15 min' }),
  multiOpt('A10', 'sauna', 'Gewohnheiten', 'Sauna', ['hrv', 'deep', 'recovery', 'feel']),
  multiOpt('A10', 'kaelte', 'Gewohnheiten', 'Kälteanwendung', ['hrv', 'deep', 'recovery', 'feel']),
  multiOpt('A10', 'massage', 'Gewohnheiten', 'Massage', ['hrv', 'recovery', 'feel']),
  multiOpt('A10', 'dehnen', 'Gewohnheiten', 'Dehnen', ['recovery', 'feel', 'deep']),
  multiOpt('A10', 'meditation', 'Gewohnheiten', 'Meditation', ['hrv', 'latency', 'latencySubj']),
  F('medsForgot', 'Gewohnheiten', 'Medikamente vergessen', (c) => c.a.A11, (v) => v === 'nein', (v) => v === 'ja', ['hrv', 'rhr', 'sleepScore']),
  multiOpt('A12', 'party', 'Ereignisse', 'Party oder Feier', ['hrv', 'rhr', 'recovery', 'sleepScore']),
  multiOpt('A12', 'streit', 'Ereignisse', 'Streit', ['hrv', 'rhr', 'latencySubj', 'sleepScore']),
  multiOpt('A12', 'pruefung', 'Ereignisse', 'Prüfung oder Deadline', ['hrv', 'rhr', 'latencySubj', 'sleepScore']),
  multiOpt('A12', 'wettkampf', 'Ereignisse', 'Wettkampf', ['hrv', 'rhr', 'recovery']),
  F('nicotine', 'Gewohnheiten', 'Nikotin', (c) => c.a.X5, (v) => v && v !== 'nein', (v) => v === 'nein', ['rhr', 'hrv', 'latency']),
  F('cannabis', 'Gewohnheiten', 'Cannabis oder andere Substanzen', (c) => c.a.X6, (v) => v === true, (v) => v === false, ['rem', 'deep', 'hrv']),

  // Training
  F('trained', 'Training', 'Training am Tag', (c) => c.a.A7, (v) => v === true, (v) => v === false, ['recovery', 'hrv', 'rhr', 'deep', 'sleepScore'], { aLabel: 'Trainingstag', bLabel: 'Ruhetag' }),
  F('kraft', 'Training', 'Krafttraining', (c) => (c.a.A7 === false ? 'rest' : inc(c.a.T1, 'kraft') ? 'kraft' : undefined), (v) => v === 'kraft', (v) => v === 'rest', ['recovery', 'rhr', 'hrv', 'feel'], { aLabel: 'Kraft', bLabel: 'Ruhetag' }),
  F('ausdauer', 'Training', 'Ausdauertraining', (c) => (c.a.A7 === false ? 'rest' : inc(c.a.T1, 'ausdauer') ? 'ausdauer' : undefined), (v) => v === 'ausdauer', (v) => v === 'rest', ['recovery', 'rhr', 'hrv', 'deep'], { aLabel: 'Ausdauer', bLabel: 'Ruhetag' }),
  F('hiit', 'Training', 'HIIT', (c) => (c.a.A7 === false ? 'rest' : inc(c.a.T1, 'hiit') ? 'hiit' : undefined), (v) => v === 'hiit', (v) => v === 'rest', ['recovery', 'rhr', 'hrv'], { aLabel: 'HIIT', bLabel: 'Ruhetag' }),
  F('hard', 'Training', 'Harte Einheit (RPE 8–10)', (c) => (c.a.A7 === true ? c.a.T2 : undefined), (v) => isNum(v) && v >= 8, (v) => isNum(v) && v <= 5, ['recovery', 'hrv', 'rhr'], { aLabel: 'RPE 8–10', bLabel: 'RPE 1–5' }),
  F('lateWorkout', 'Training', 'Training endet nach 20 Uhr', (c) => {
    const w = c.day?.workouts || [];
    if (!w.length) return undefined;
    const end = Math.max(...w.map((x) => x.e));
    const dt = new Date(end);
    return dt.getHours() * 60 + dt.getMinutes();
  }, (v) => v >= 20 * 60, (v) => v < 20 * 60, ['latency', 'latencySubj', 'deep', 'rhr'], { aLabel: 'nach 20 Uhr', bLabel: 'früher' }),

  // Gemessen
  F('highStrain', 'Messung', 'Hoher Strain (ab 70)', (c) => c.day?.strain, (v) => isNum(v) && v >= 70, (v) => isNum(v) && v < 40, ['recovery', 'hrv', 'rhr', 'deep'], { aLabel: 'Strain ≥ 70', bLabel: 'Strain < 40' }),
  F('lowSteps', 'Messung', 'Wenig Schritte (< 5.000)', (c) => c.day?.steps, (v) => isNum(v) && v < 5000, (v) => isNum(v) && v >= 10000, ['sleepScore', 'latency', 'latencySubj', 'deep'], { aLabel: '< 5.000', bLabel: '≥ 10.000' }),
  F('napMeasured', 'Messung', 'Nickerchen über 30 Minuten', (c) => c.day?.napMin, (v) => isNum(v) && v >= 30, (v) => v === 0, ['latency', 'latencySubj', 'deep', 'sleepScore']),

  // Schlafumgebung (Antworten gelten fort)
  F('roomWarm', 'Schlafumgebung', 'Schlafzimmer über 19 °C', (c) => c.a.S1, (v) => v === '19-22' || v === 'gt22', (v) => v === 'lt16' || v === '16-19', ['deep', 'efficiency', 'wake', 'sleepScore'], { aLabel: '> 19 °C', bLabel: '≤ 19 °C' }),
  F('noise', 'Schlafumgebung', 'Störender Lärm', (c) => c.a.S2, (v) => v === 'stoerend', (v) => v === 'keiner', ['wake', 'deep', 'sleepScore']),
  F('light', 'Schlafumgebung', 'Zimmer nicht ganz dunkel', (c) => c.a.S3, (v) => v === 'rest' || v === 'hell', (v) => v === 'dunkel', ['latency', 'latencySubj', 'rem', 'sleepScore']),
  F('window', 'Schlafumgebung', 'Fenster offen oder gelüftet', (c) => c.a.S4, (v) => v === true, (v) => v === false, ['sleepScore', 'deep', 'efficiency']),
  F('partner', 'Schlafumgebung', 'Mit Partner im Bett', (c) => c.a.S5, (v) => v === 'partner', (v) => v === 'allein', ['wake', 'efficiency', 'sleepScore']),
  F('away', 'Schlafumgebung', 'Nicht zu Hause geschlafen', (c) => c.a.S6, (v) => v && v !== 'zuhause', (v) => v === 'zuhause', ['latency', 'latencySubj', 'deep', 'sleepScore']),
  F('napSurvey', 'Schlafumgebung', 'Mittagsschlaf über 30 Minuten', (c) => c.a.S8, (v) => v === 'gt30', (v) => v === 'keiner', ['latency', 'latencySubj', 'deep']),
  multiOpt('S9', 'schlafmittel', 'Schlafumgebung', 'Schlafmittel', ['latency', 'latencySubj', 'sleepScore', 'deep']),
  multiOpt('S9', 'ohrstoepsel', 'Schlafumgebung', 'Ohrstöpsel', ['wake', 'sleepScore', 'deep']),
  multiOpt('S9', 'maske', 'Schlafumgebung', 'Schlafmaske', ['latency', 'latencySubj', 'sleepScore']),
  F('jetlag', 'Schlafumgebung', 'Jetlag oder Zeitzonenwechsel', (c) => c.a.S11, (v) => v && v !== 'keine', (v) => v === 'keine', ['sleepScore', 'hrv']),

  // Ernährung
  F('deficit', 'Ernährung', 'Kaloriendefizit', (c) => c.a.E1, (v) => v === 'defizit', (v) => v === 'ausgeglichen', ['hrv', 'rhr', 'sleepScore', 'feel']),
  F('proteinHigh', 'Ernährung', 'Viel Protein', (c) => c.a.E2, (v) => v === 'hoch', (v) => v === 'niedrig', ['feel', 'recovery']),
  F('carbsLow', 'Ernährung', 'Wenig Kohlenhydrate ums Training', (c) => c.a.E3, (v) => v === 'niedrig', (v) => v === 'hoch', ['recovery', 'feel']),
  F('sugarEve', 'Ernährung', 'Zucker oder Verarbeitetes am Abend', (c) => c.a.E4, (v) => v === true, (v) => v === false, ['rhr', 'deep', 'sleepScore']),
  F('spicy', 'Ernährung', 'Scharf, fettig oder salzig', (c) => c.a.E5, (v) => v === true, (v) => v === false, ['rhr', 'deep', 'efficiency']),
  F('fasting', 'Ernährung', 'Fasten 16 h oder länger', (c) => c.a.E6, (v) => v === '16' || v === '24', (v) => v === 'kein', ['hrv', 'rhr', 'feel']),
  F('digest', 'Ernährung', 'Verdauungsbeschwerden', (c) => c.a.E7, (v) => v === 'leicht' || v === 'stark', (v) => v === 'keine', ['sleepScore', 'hrv']),
  F('intolerance', 'Ernährung', 'Mögliche Unverträglichkeit gegessen', (c) => c.a.E10, (v) => answered(v) && !v.includes('keine'), (v) => answered(v) && v.includes('keine'), ['sleepScore', 'hrv']),

  // Stress & Soziales
  F('rumination', 'Stress & Soziales', 'Grübeln am Abend', (c) => c.a.P2, (v) => v === 'etwas' || v === 'stark', (v) => v === 'nein', ['latency', 'latencySubj', 'deep', 'hrv']),
  F('conflict', 'Stress & Soziales', 'Streit oder Konflikt', (c) => c.a.P3, (v) => v === true, (v) => v === false, ['hrv', 'rhr', 'latencySubj']),
  F('noSwitchOff', 'Stress & Soziales', 'Spät oder nicht abgeschaltet', (c) => c.a.P4, (v) => v === 'spaet' || v === 'nicht', (v) => v === 'frueh' || v === 'normal', ['latency', 'latencySubj', 'hrv']),
  multiOpt('P5', 'meditation', 'Stress & Soziales', 'Meditation (Stressmodul)', ['hrv', 'latency', 'latencySubj']),
  multiOpt('P5', 'atmung', 'Stress & Soziales', 'Atemübung', ['hrv', 'latency', 'latencySubj']),
  multiOpt('P5', 'lesen', 'Stress & Soziales', 'Lesen', ['latency', 'latencySubj', 'sleepScore']),
  multiOpt('P5', 'musik', 'Stress & Soziales', 'Musik', ['latency', 'latencySubj', 'hrv']),
  multiOpt('P5', 'spaziergang', 'Stress & Soziales', 'Spaziergang', ['hrv', 'sleepScore', 'latencySubj']),
  F('nature', 'Stress & Soziales', 'Zeit in der Natur', (c) => c.a.P6, (v) => v === true, (v) => v === false, ['hrv', 'sleepScore', 'feel']),
  F('social', 'Stress & Soziales', 'Viel soziale Zeit', (c) => c.a.P7, (v) => v === 'viel', (v) => v === 'wenig', ['feel', 'hrv']),
  F('overwhelmed', 'Stress & Soziales', 'Einsam oder überfordert', (c) => c.a.P8, (v) => v === 'etwas' || v === 'stark', (v) => v === 'nein', ['hrv', 'sleepScore', 'feel']),
  F('joy', 'Stress & Soziales', 'Freude oder Erfolgserlebnis', (c) => c.a.P9, (v) => v === true, (v) => v === false, ['feel', 'hrv']),
  F('screenTotal', 'Stress & Soziales', 'Über 5 h Bildschirmzeit', (c) => c.a.P10, (v) => v === 'gt5', (v) => v === 'lt2', ['sleepScore', 'latencySubj']),
  F('intimacy', 'Stress & Soziales', 'Intimität', (c) => c.a.P11, (v) => v === true, (v) => v === false, ['latencySubj', 'rhr', 'sleepScore']),

  // Gesundheit (Morgencheck, betrifft dieselbe Nacht)
  F('allergy', 'Gesundheit', 'Allergiebeschwerden', (c) => c.a.G2, (v) => v === 'leicht' || v === 'stark', (v) => v === 'keine', ['sleepScore', 'hrv', 'rhr'], { lag: 0, allowExcluded: true }),
  F('pain', 'Gesundheit', 'Schmerzen (4 von 10 oder mehr)', (c) => c.a.G4, (v) => isNum(v) && v >= 4, (v) => isNum(v) && v <= 1, ['sleepScore', 'wake'], { lag: 0, allowExcluded: true }),

  // Logbuch: Mengen und Tageswerte, Wirkung in der Nacht danach
  F('workLong', 'Logbuch', 'Langer Arbeitstag (ab 9 h)', (c) => c.j?.work, (v) => isNum(v) && v >= 9, (v) => isNum(v) && v <= 8, ['hrv', 'rhr', 'recovery', 'sleepScore', 'latency', 'latencySubj'], { aLabel: 'ab 9 h', bLabel: 'bis 8 h' }),
  F('cafMg', 'Logbuch', 'Mehr als 300 mg Koffein', (c) => c.j?.caffeineMg, (v) => isNum(v) && v > 300, (v) => isNum(v) && v <= 100, ['latency', 'latencySubj', 'deep', 'sleepScore', 'hrv'], { aLabel: 'über 300 mg', bLabel: 'bis 100 mg', dose: [[0, '≤ 100'], [101, '≤ 200'], [201, '≤ 300'], [301, '> 300']] }),
  F('happyDay', 'Logbuch', 'Glücklicher Tag (8 bis 10)', (c) => c.j?.happy, (v) => isNum(v) && v >= 8, (v) => isNum(v) && v <= 5, ['hrv', 'rhr', 'sleepScore', 'latencySubj'], { aLabel: 'Glück 8–10', bLabel: 'Glück 0–5' }),

  // Glück am selben Tag (Logbuch): Schlaf der Nacht davor, Bewegung, Arbeit, Alltag
  F('sleepGoodH', 'Glück', 'Gut geschlafen (Schlaf-Score ab 70)', (c) => c.day?.sleepScore, (v) => isNum(v) && v >= 70, (v) => isNum(v) && v < 55, ['happy'], { lag: 0, aLabel: 'Score ab 70', bLabel: 'unter 55' }),
  F('sleepShortH', 'Glück', 'Unter 6 Stunden geschlafen', (c) => c.day?.sleep?.asleepMin, (v) => isNum(v) && v < 360, (v) => isNum(v) && v >= 420, ['happy'], { lag: 0, aLabel: 'unter 6 h', bLabel: 'ab 7 h' }),
  F('sportH', 'Glück', 'Sport am Tag (ab 30 Minuten)', (c) => sportMinutes(c), (v) => isNum(v) && v >= 30, (v) => v === 0, ['happy'], { lag: 0, aLabel: 'ab 30 min', bLabel: 'kein Sport' }),
  F('workLongH', 'Glück', 'Langer Arbeitstag (ab 9 h)', (c) => c.j?.work, (v) => isNum(v) && v >= 9, (v) => isNum(v) && v > 0 && v <= 8, ['happy'], { lag: 0, aLabel: 'ab 9 h', bLabel: '1–8 h' }),
  F('dayOffH', 'Glück', 'Arbeitsfreier Tag', (c) => c.j?.work, (v) => v === 0, (v) => isNum(v) && v > 0, ['happy'], { lag: 0, aLabel: 'frei', bLabel: 'Arbeitstag' }),
  F('waterLowH', 'Glück', 'Wenig getrunken (unter 1,5 l)', (c) => c.j?.waterMl, (v) => isNum(v) && v < 1500, (v) => isNum(v) && v >= 1500, ['happy'], { lag: 0, aLabel: 'unter 1,5 l', bLabel: 'ab 1,5 l' }),
  F('stressH', 'Glück', 'Hoher Stress (4–5)', (c) => c.a.A1, (v) => v >= 4, (v) => v <= 2, ['happy'], { lag: 0, aLabel: 'Stress 4–5', bLabel: 'Stress 1–2' }),
  F('daylightH', 'Glück', 'Über 1 Stunde Tageslicht', (c) => c.a.A9, (v) => v === 'gt60', (v) => v === 'lt15', ['happy'], { lag: 0, aLabel: '> 60 min', bLabel: '< 15 min' }),
  F('natureH', 'Glück', 'Zeit in der Natur', (c) => c.a.P6, (v) => v === true, (v) => v === false, ['happy'], { lag: 0 }),
  F('socialH', 'Glück', 'Viel soziale Zeit', (c) => c.a.P7, (v) => v === 'viel', (v) => v === 'wenig', ['happy'], { lag: 0, aLabel: 'viel', bLabel: 'wenig' }),
  F('screenH', 'Glück', 'Über 5 h Bildschirmzeit', (c) => c.a.P10, (v) => v === 'gt5', (v) => v === 'lt2', ['happy'], { lag: 0, aLabel: '> 5 h', bLabel: '< 2 h' }),
  F('weekendH', 'Glück', 'Wochenende (Sa, So)', (c) => weekday(c.date), (v) => v === 0 || v === 6, (v) => v >= 1 && v <= 5, ['happy'], { lag: 0, aLabel: 'Sa/So', bLabel: 'Mo–Fr' }),
  F('shortDayH', 'Glück', 'Kurze Tage (unter 9 h Tageslicht)', (c) => c.ctx?.daylightH, (v) => isNum(v) && v < 9, (v) => isNum(v) && v >= 12, ['happy'], { lag: 0, aLabel: 'unter 9 h', bLabel: 'ab 12 h' }),

  // Umwelt und Kalender (automatisch)
  F('warmNight', 'Umwelt', 'Warme Nacht (ab 18 °C)', (c) => c.ctx?.nightTempMin, (v) => isNum(v) && v >= 18, (v) => isNum(v) && v < 15, ['deep', 'efficiency', 'wake', 'sleepScore', 'hrv'], { aLabel: '≥ 18 °C', bLabel: '< 15 °C' }),
  F('hotDay', 'Umwelt', 'Heißer Tag (ab 28 °C)', (c) => c.ctx?.tMax, (v) => isNum(v) && v >= 28, (v) => isNum(v) && v < 22, ['sleepScore', 'hrv', 'rhr'], { aLabel: '≥ 28 °C', bLabel: '< 22 °C' }),
  F('humid', 'Umwelt', 'Schwüle Nacht (Luftfeuchte ab 85 %)', (c) => c.ctx?.nightHumidity, (v) => isNum(v) && v >= 85, (v) => isNum(v) && v < 70, ['sleepScore', 'efficiency']),
  F('pm25', 'Umwelt', 'Feinstaub erhöht (PM2,5 über 15 µg/m³)', (c) => c.ctx?.pm25, (v) => isNum(v) && v > 15, (v) => isNum(v) && v <= 8, ['hrv', 'rhr', 'sleepScore']),
  F('pollen', 'Umwelt', 'Hohe Pollenbelastung', (c) => c.ctx?.pollenMax, (v) => isNum(v) && v >= 50, (v) => isNum(v) && v < 10, ['sleepScore', 'hrv']),
  F('pressureDrop', 'Umwelt', 'Luftdruck fällt (6 hPa oder mehr)', (c) => c.ctx?.pressureDelta, (v) => isNum(v) && v <= -6, (v) => isNum(v) && Math.abs(v) < 2, ['sleepScore', 'feel', 'hrv']),
  F('shortDay', 'Umwelt', 'Kurze Tage (unter 9 h Tageslicht)', (c) => c.ctx?.daylightH, (v) => isNum(v) && v < 9, (v) => isNum(v) && v >= 12, ['sleepScore', 'feel', 'asleep']),
  F('fullMoon', 'Umwelt', 'Vollmond (Gegenprobe)', (c) => moonAge(c.date), (v) => Math.abs(v - 14.77) < 1.5, (v) => Math.abs(v - 14.77) >= 4, ['sleepScore', 'deep', 'latencySubj'], { aLabel: 'Vollmond', bLabel: 'sonst' }),
  F('weekendNight', 'Umwelt', 'Wochenend-Nacht (Fr, Sa)', (c) => weekday(c.date), (v) => v === 5 || v === 6, (v) => v >= 0 && v <= 4, ['hrv', 'rhr', 'sleepScore', 'asleep'], { aLabel: 'Fr/Sa', bLabel: 'So–Do' }),
  F('holidayEve', 'Umwelt', 'Vorabend eines Feiertags', (c) => isHoliday(addDays(c.date, 1)), (v) => v === true, (v) => v === false, ['hrv', 'sleepScore']),
];

/** Trainingsminuten eines Tages (Apple Health und Logbuch); 0 nur, wenn der Tag erfasst ist. */
function sportMinutes(c) {
  const sessions = sportSessions(c.jr, c.day?.workouts || []);
  if (sessions.length) return sessions.reduce((s, x) => s + (x.min || 0), 0);
  const worn = isNum(c.day?.hrCoverageMin) && c.day.hrCoverageMin >= 600;
  return worn || (c.jr && !isEmptyDay(c.jr)) ? 0 : undefined;
}

/** Ein Faktor je Supplement: Tage mit dem Mittel gegen Tage, an denen Supplements angegeben, dieses aber nicht genommen wurde. */
function supplementFactor(sup) {
  return F(
    `sup_${sup.id}`,
    'Supplements',
    sup.label,
    (c) => {
      const list = supplementsOf(c.a);
      return list && list.length ? list.includes(sup.id) : undefined;
    },
    (v) => v === true,
    (v) => v === false,
    supplementTargets(sup),
    { aLabel: 'genommen', bLabel: 'nicht genommen' },
  );
}

export const SUPPLEMENT_FACTORS = SUPPLEMENTS.map(supplementFactor);

/** Alle Faktoren inklusive der eigenen Supplements aus den Einstellungen. */
export function factorsFor(settings) {
  const custom = allSupplements(settings, { includeHidden: true }).filter((s) => s.group === 'eigene').map(supplementFactor);
  const { red = 34, green = 67 } = settings?.model?.recovery || {};
  const recovery = F('recoveryH', 'Glück', `Recovery grün (ab ${green})`, (c) => c.day?.recovery, (v) => isNum(v) && v >= green, (v) => isNum(v) && v < red, ['happy'], { lag: 0, aLabel: 'grün', bLabel: `unter ${red}` });
  return FACTORS.concat([recovery], SUPPLEMENT_FACTORS, custom);
}

export function formatEffect(target, diff, { short = false } = {}) {
  if (!isNum(diff)) return '–';
  const t = TARGETS[target];
  if (t.log) {
    const pct = (Math.exp(diff) - 1) * 100;
    return `${pct > 0 ? '+' : '−'}${Math.abs(pct).toFixed(0)} %`;
  }
  const digits = Math.abs(diff) < 10 && t.unit !== 'min' ? 1 : 0;
  const s = Math.abs(diff).toFixed(digits).replace('.', ',');
  const unit = short ? t.short ?? t.unit : t.unit;
  return `${diff > 0 ? '+' : diff < 0 ? '−' : '±'}${s}${unit ? ' ' + unit : ''}`;
}

function confidence(q, n, qThreshold) {
  if (q < Math.min(0.05, qThreshold) && n >= 15) return 'hoch';
  if (q < qThreshold) return 'mittel';
  return 'gering';
}

const tick = () => new Promise((r) => setTimeout(r, 0));

/** Führt die Analyse aus. Gibt Ergebnisse, zu dünne Faktoren, Modell-Gefühl-Abgleich und Dosiskurven zurück. */
export async function computeInsights({ dates, days, survey, journal = new Map(), settings, onProgress }) {
  const { minN, permutations, bootstrap, qThreshold } = settings.analysis;
  const ctxCache = new Map();
  const ctxOf = (date) => {
    if (!ctxCache.has(date)) {
      const day = days.get(date);
      const jr = journal.get(date) || null;
      // Was im Logbuch steht (Wasser, Koffein, Training), ersetzt die grobe Antwort aus dem Abendcheck
      const a = { ...effectiveAnswers(survey, date), ...journalAnswers(jr, day?.workouts).answers };
      ctxCache.set(date, { date, a, day, ctx: day?.context || null, j: day?.journal || null, jr });
    }
    return ctxCache.get(date);
  };

  const tests = [];
  const insufficient = [];
  let done = 0;
  const factors = factorsFor(settings);
  const totalWork = factors.reduce((s, f) => s + f.targets.length, 0);

  for (const f of factors) {
    // Faktorwerte einmal je Tag bestimmen
    const values = [];
    for (const date of dates) {
      let v;
      try {
        v = f.get(ctxOf(date));
      } catch {
        v = undefined;
      }
      if (v === undefined || v === null) continue;
      const grp = f.a(v) ? 'A' : f.b(v) ? 'B' : null;
      if (grp) values.push([date, grp, v]);
    }
    let bestInsufficient = null;
    for (const target of f.targets) {
      done++;
      const A = [];
      const B = [];
      const lvl = [];
      for (const [date, grp, v] of values) {
        const td = days.get(addDays(date, f.lag));
        if (!td || (td.excluded && !f.allowExcluded)) continue;
        const y = TARGETS[target].get(td);
        if (!isNum(y)) continue;
        (grp === 'A' ? A : B).push(y);
        if (f.dose) lvl.push([v, y]);
      }
      if (A.length < minN || B.length < minN) {
        if (!bestInsufficient || Math.min(A.length, B.length) > Math.min(bestInsufficient.nA, bestInsufficient.nB)) bestInsufficient = { factor: f.id, label: f.label, group: f.group, nA: A.length, nB: B.length, need: minN };
        continue;
      }
      const rng = mulberry32(hashString(`${f.id}|${target}`));
      let p = permutationTest(A, B, 200, rng);
      if (p < 0.2) p = permutationTest(A, B, permutations, rng);
      const diff = mean(A) - mean(B);
      const ci = p < 0.25 ? bootstrapDiffCI(A, B, bootstrap, rng) : [null, null];
      const pooled = sd(A.concat(B)) || 1;
      let dose = null;
      if (f.dose && target === f.targets[0]) {
        dose = f.dose.map(([level, label], i) => {
          const next = f.dose[i + 1]?.[0];
          const ys = lvl.filter(([v]) => isNum(v) && v >= level && (next === undefined || v < next)).map(([, y]) => y);
          return { label, n: ys.length, mean: ys.length ? mean(ys) : null };
        });
      }
      tests.push({ id: `${f.id}|${target}`, factor: f.id, label: f.label, group: f.group, target, lag: f.lag, aLabel: f.aLabel, bLabel: f.bLabel, nA: A.length, nB: B.length, meanA: mean(A), meanB: mean(B), diff, ci, p, std: diff / pooled, dose });
      if (done % 15 === 0) {
        onProgress?.(done / totalWork);
        await tick();
      }
    }
    // Nie genommene Supplements gehören nicht in die Liste „Zu wenig Daten“
    const neverTaken = f.group === 'Supplements' && bestInsufficient?.nA === 0;
    if (bestInsufficient && !neverTaken && !tests.some((t) => t.factor === f.id)) insufficient.push(bestInsufficient);
  }

  const q = benjaminiHochberg(tests.map((t) => t.p));
  tests.forEach((t, i) => {
    t.q = q[i];
    t.confidence = confidence(t.q, Math.min(t.nA, t.nB), qThreshold);
    const better = TARGETS[t.target].better;
    t.good = better === 'up' ? t.diff > 0 : t.diff < 0;
    t.effectText = formatEffect(t.target, t.diff);
    t.ciText = t.ci[0] == null ? null : `${formatEffect(t.target, t.ci[0])} bis ${formatEffect(t.target, t.ci[1])}`;
  });

  adjustEffects(tests, dates, days, ctxOf, factors);

  const rank = { hoch: 0, mittel: 1, gering: 2 };
  tests.sort((a, b) => rank[a.confidence] - rank[b.confidence] || Math.abs(b.std) - Math.abs(a.std));

  onProgress?.(1);
  return {
    computedAt: Date.now(),
    counts: countData(dates, days),
    results: tests,
    insufficient: insufficient.sort((a, b) => Math.min(b.nA, b.nB) - Math.min(a.nA, a.nB)),
    feel: feelingMatch(dates, days),
    totalTests: tests.length,
  };
}

/** Bereinigter Effekt: Ridge-Regression je Zielwert über alle Faktoren mit genug Daten. */
function adjustEffects(tests, dates, days, ctxOf, factors) {
  const byTarget = new Map();
  for (const t of tests) {
    if (!byTarget.has(t.target)) byTarget.set(t.target, []);
    byTarget.get(t.target).push(t);
  }
  const factorById = Object.fromEntries(factors.map((f) => [f.id, f]));
  for (const [target, list] of byTarget) {
    if (list.length < 2) continue;
    const fs = list.map((t) => factorById[t.factor]);
    const X = [];
    const y = [];
    for (const date of dates) {
      const td = days.get(date);
      if (!td || td.excluded) continue;
      const yy = TARGETS[target].get(td);
      if (!isNum(yy)) continue;
      const row = fs.map((f) => {
        const src = addDays(date, -f.lag);
        let v;
        try {
          v = f.get(ctxOf(src));
        } catch {
          v = undefined;
        }
        if (v === undefined || v === null) return NaN;
        return f.a(v) ? 1 : f.b(v) ? 0 : NaN;
      });
      if (row.every((x) => Number.isNaN(x))) continue;
      X.push(row);
      y.push(yy);
    }
    if (X.length < 20) continue;
    for (let j = 0; j < fs.length; j++) {
      const col = X.map((r) => r[j]).filter((v) => !Number.isNaN(v));
      const m = col.length ? col.reduce((s, v) => s + v, 0) / col.length : 0;
      for (const r of X) if (Number.isNaN(r[j])) r[j] = m;
    }
    const fit = ridge(X, y, 3);
    if (!fit) continue;
    list.forEach((t, j) => {
      t.adj = fit.coef[j];
      t.adjText = formatEffect(target, t.adj);
      t.confounded = isNum(t.adj) && Math.abs(t.diff) > 0 && (Math.sign(t.adj) !== Math.sign(t.diff) || Math.abs(t.adj) < Math.abs(t.diff) * 0.5);
    });
  }
}

function countData(dates, days) {
  let mornings = 0;
  let evenings = 0;
  let nights = 0;
  let journal = 0;
  for (const d of dates) {
    const x = days.get(d);
    if (x?.survey?.ts?.morning) mornings++;
    if (x?.survey?.ts?.evening) evenings++;
    if (x?.sleep) nights++;
    const j = x?.journal;
    if (j && (j.waterMl != null || j.caffeineN != null || j.happy != null || j.work != null || j.sportN || j.text)) journal++;
  }
  return { days: dates.length, mornings, evenings, nights, journal };
}

/** Wie gut passen Recovery und Schlaf-Score zum Gefühl am Morgen? */
function feelingMatch(dates, days) {
  const rec = [];
  const sleep = [];
  const feel = [];
  const feelSleep = [];
  const zh = [];
  const zr = [];
  for (const d of dates) {
    const x = days.get(d);
    const m1 = x?.survey?.a?.M1;
    const m4 = x?.survey?.a?.M4;
    rec.push(x?.recovery ?? null);
    feel.push(typeof m1 === 'number' ? m1 : null);
    sleep.push(x?.sleepScore ?? null);
    feelSleep.push(typeof m4 === 'number' ? m4 : null);
    zh.push(x?.z?.hrv ?? null);
    zr.push(isNum(x?.z?.rhr) ? -x.z.rhr : null);
  }
  return {
    recovery: pearson(rec, feel),
    sleep: pearson(sleep, feelSleep),
    parts: { hrv: pearson(zh, feel), rhr: pearson(zr, feel) },
  };
}
