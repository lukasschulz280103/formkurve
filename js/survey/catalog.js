// Fragenkatalog aus dem Konzept (Abschnitt 7) als Daten. Zyklus-Fragen (G6, G7) sind bewusst entfernt.
// Antworttypen: scale (Zahl), bool, single (Wert), multi (Liste), number, time ("HH:MM"), text, supplements (Liste).
//
// Priorität (prio): 'core' = Kernfrage, immer sichtbar. Eine Zahl = optionale Frage; je kleiner, desto wichtiger.
// Die Reihenfolge der optionalen Fragen folgt der erwarteten Wirkung auf HRV, Ruhepuls und Schlaf und dem Nutzen für
// eine saubere Baseline. parent = Folgefrage, erscheint direkt nach ihrer Ausgangsfrage.
// Die Kennungen (id) und Antwortwerte bleiben dauerhaft gleich, damit gespeicherte Antworten gültig bleiben.

import { supplementsOf } from './supplements.js';

const o = (v, label) => ({ v, label });
const NONE = 'keine';
const has = (arr, v) => Array.isArray(arr) && arr.includes(v);
const hasSymptom = (a) => Array.isArray(a.M10) && a.M10.some((x) => x !== NONE);

export const MODULES = {
  morning: { title: 'Morgen', slot: 'morning' },
  health: { title: 'Gesundheit', slot: 'morning' },
  evening: { title: 'Abend', slot: 'evening' },
  substances: { title: 'Alkohol & Substanzen', slot: 'evening' },
  training: { title: 'Training', slot: 'evening' },
  supplements: { title: 'Supplements', slot: 'evening' },
  sleepenv: { title: 'Schlafumgebung', slot: 'evening' },
  nutrition: { title: 'Ernährung', slot: 'evening' },
  stress: { title: 'Stress & Soziales', slot: 'evening' },
  weekly: { title: 'Wochenrückblick', slot: 'evening' },
};

/** Ob die Fragen eines Bereichs heute überhaupt infrage kommen. ctx: { answers, weekday, settings } */
export function moduleAvailable(mod, ctx) {
  const a = ctx.answers || {};
  const s = ctx.settings?.survey || {};
  if (mod === 'health') return hasSymptom(a) || (a.M9 ?? 0) >= 2;
  if (mod === 'weekly') return ctx.weekday === (s.weeklyDay ?? 0);
  return true;
}

/** Vorschlag für heute: Bereiche rücken in der Reihenfolge nach vorn (kleinere Zahl = weiter oben). */
export function moduleBoost(mod, ctx) {
  const a = ctx.answers || {};
  const s = ctx.settings?.survey || {};
  if (mod === 'sleepenv') return ctx.weekday === (s.weeklyDay ?? 0) || has(a.A12, 'reise') ? 40 : 0;
  if (mod === 'nutrition') return (s.nutritionDays || []).includes(ctx.weekday) ? 60 : 0;
  if (mod === 'stress') return (s.stressDays || []).includes(ctx.weekday) || (a.A1 ?? 0) >= 4 ? 40 : 0;
  if (mod === 'weekly') return 100;
  return 0;
}

/** Hat die Person in den letzten Tagen Supplements angegeben? Dann wird die Frage zur Kernfrage. */
const usesSupplements = (a, ctx) => Boolean(ctx?.recentSupplements?.length);

const L5 = (lo, hi) => ({ min: 1, max: 5, labels: [lo, hi] });

export const QUESTIONS = [
  // 7.1 Morgen
  { id: 'M1', mod: 'morning', prio: 'core', type: 'scale', ...L5('gar nicht', 'sehr'), text: 'Wie erholt fühlst du dich?', hint: 'Prüft, ob die Scores zu deinem Gefühl passen.' },
  { id: 'M4', mod: 'morning', prio: 'core', type: 'scale', ...L5('schlecht', 'sehr gut'), text: 'Wie gut hast du geschlafen?' },
  { id: 'M3', mod: 'morning', prio: 'core', type: 'single', text: 'Muskelkater oder Steifheit', options: [o(0, 'keiner'), o(1, 'leicht'), o(2, 'deutlich'), o(3, 'stark')] },
  { id: 'M10', mod: 'morning', prio: 'core', type: 'multi', exclusive: NONE, text: 'Krankheitsgefühl', options: [o(NONE, 'nichts'), o('hals', 'Hals'), o('husten', 'Husten'), o('schnupfen', 'Schnupfen'), o('fieber', 'Fieber'), o('magen', 'Magen-Darm'), o('glieder', 'Gliederschmerzen')], hint: 'Infekte erhöhen Puls und Temperatur oft, bevor du es merkst. Kranke Tage zählen nicht zur Baseline.' },
  { id: 'M2', mod: 'morning', prio: 10, type: 'scale', ...L5('leer', 'voll'), text: 'Energielevel jetzt' },
  { id: 'M5', mod: 'morning', prio: 12, type: 'single', text: 'Einschlafdauer (geschätzt)', options: [o('lt15', '< 15 min'), o('15-30', '15–30'), o('30-60', '30–60'), o('gt60', '> 60')] },
  { id: 'M6', mod: 'morning', prio: 14, type: 'single', text: 'Nächtliches Aufwachen', options: [o(0, '0'), o(1, '1'), o(2, '2'), o(3, '3+')] },
  { id: 'M6r', mod: 'morning', prio: 15, parent: 'M6', type: 'multi', text: 'Grund fürs nächtliche Aufwachen', options: [o('toilette', 'Toilette'), o('laerm', 'Lärm'), o('hitze', 'Hitze'), o('gedanken', 'Gedanken'), o('andere', 'Partner, Kind, Tier'), o('unbekannt', 'unbekannt')], when: (a) => (a.M6 ?? 0) >= 1 },
  { id: 'M9', mod: 'morning', prio: 16, type: 'single', text: 'Kopfschmerzen', options: [o(0, 'keine'), o(1, 'leicht'), o(2, 'mittel'), o(3, 'stark')] },
  { id: 'M7', mod: 'morning', prio: 20, type: 'scale', ...L5('mies', 'super'), text: 'Stimmung' },
  { id: 'M8', mod: 'morning', prio: 22, type: 'scale', ...L5('keine', 'hoch'), text: 'Motivation fürs Training' },
  { id: 'M3r', mod: 'morning', prio: 24, parent: 'M3', type: 'multi', text: 'Wo hast du Muskelkater?', options: [o('beine', 'Beine'), o('oberkoerper', 'Oberkörper'), o('ruecken', 'Rücken'), o('arme', 'Arme'), o('ganz', 'Ganzkörper')], when: (a) => (a.M3 ?? 0) >= 1 },
  { id: 'M12', mod: 'morning', prio: 30, type: 'single', text: 'Wie aufgewacht?', options: [o('natuerlich', 'von selbst'), o('wecker', 'Wecker')] },
  { id: 'M12s', mod: 'morning', prio: 31, parent: 'M12', type: 'number', text: 'Snooze-Anzahl', min: 0, max: 10, step: 1, when: (a) => a.M12 === 'wecker' },
  { id: 'M11', mod: 'morning', prio: 34, type: 'bool', text: 'Intensive Träume oder Albträume' },
  { id: 'M13', mod: 'morning', prio: 40, type: 'number', text: 'Gewicht', min: 30, max: 250, step: 0.1, unit: 'kg', prefill: 'last' },

  // 7.8 Gesundheit (morgens, nur bei Beschwerden)
  { id: 'G1', mod: 'health', prio: 2, type: 'number', text: 'Fieber gemessen?', min: 35, max: 42, step: 0.1, unit: '°C' },
  { id: 'G4', mod: 'health', prio: 4, type: 'scale', min: 0, max: 10, labels: ['keine', 'stark'], text: 'Schmerzen allgemein' },
  { id: 'G3', mod: 'health', prio: 6, type: 'single', text: 'Magen-Darm-Beschwerden', options: [o('keine', 'keine'), o('leicht', 'leicht'), o('stark', 'stark')] },
  { id: 'G2', mod: 'health', prio: 8, type: 'single', text: 'Allergie oder Heuschnupfen', options: [o('keine', 'keine'), o('leicht', 'leicht'), o('stark', 'stark')] },
  { id: 'G5', mod: 'health', prio: 18, type: 'bool', text: 'Zahnbehandlung, Entzündung oder Wunde' },
  { id: 'G9', mod: 'health', prio: 26, type: 'text', text: 'Diagnose oder laufende Behandlung', prefill: 'sticky' },
  { id: 'G8', mod: 'health', prio: 42, type: 'text', text: 'Blutdruck gemessen', placeholder: 'z. B. 120/80' },

  // 7.2 Abend
  { id: 'A1', mod: 'evening', prio: 'core', type: 'scale', ...L5('entspannt', 'sehr gestresst'), text: 'Stresslevel heute' },
  { id: 'A3', mod: 'evening', prio: 'core', type: 'bool', text: 'Alkohol getrunken?', hint: 'Eine der stärksten Einflussgrößen auf die HRV der Nacht.' },
  { id: 'X1', mod: 'substances', prio: 'core', parent: 'A3', type: 'number', text: 'Alkohol: Standardgetränke', unit: 'Getränke', min: 0, max: 15, step: 1, when: (a) => a.A3 === true, hint: '1 Getränk = 0,33 l Bier, 0,15 l Wein oder 4 cl Spirituose.' },
  { id: 'A4', mod: 'evening', prio: 'core', type: 'number', text: 'Koffein: Anzahl Getränke', min: 0, max: 10, step: 1, prefill: 'last' },
  { id: 'A4t', mod: 'evening', prio: 'core', parent: 'A4', type: 'time', text: 'Uhrzeit des letzten Koffeins', prefill: 'last', when: (a) => (a.A4 ?? 0) > 0, hint: 'Koffein wirkt 5 bis 6 Stunden zur Hälfte nach.' },
  { id: 'A7', mod: 'evening', prio: 'core', type: 'bool', text: 'Training heute?', prefill: 'workout' },
  { id: 'T1', mod: 'training', prio: 'core', parent: 'A7', type: 'multi', text: 'Trainingsart', options: [o('kraft', 'Kraft'), o('ausdauer', 'Ausdauer'), o('hiit', 'HIIT'), o('team', 'Teamsport'), o('mobility', 'Mobility, Yoga'), o('andere', 'Anderes')], prefill: 'workout', when: (a) => a.A7 === true },
  { id: 'T13', mod: 'training', prio: 'core', parent: 'A7', type: 'number', text: 'Trainingsdauer', unit: 'min', min: 0, max: 400, step: 5, prefill: 'workout', when: (a) => a.A7 === true, hint: 'Bei Kraft: Dauer × Anstrengung ergibt den Kraft-Zuschlag im Strain.' },
  { id: 'T2', mod: 'training', prio: 'core', parent: 'A7', type: 'scale', min: 1, max: 10, labels: ['sehr leicht', 'maximal'], text: 'Anstrengung (RPE)', when: (a) => a.A7 === true },
  { id: 'X5', mod: 'substances', prio: 'core', type: 'single', text: 'Nikotin', options: [o('nein', 'nein'), o('zigaretten', 'Zigaretten'), o('vape', 'Vape'), o('beutel', 'Beutel')], prefill: 'last', when: (a, ctx) => ctx?.settings?.survey?.askNicotine },
  { id: 'X6', mod: 'substances', prio: 'core', type: 'bool', text: 'Cannabis oder andere Substanzen', when: (a, ctx) => ctx?.settings?.survey?.askNicotine },

  { id: 'A12', mod: 'evening', prio: 10, type: 'multi', exclusive: 'keines', text: 'Besonderes Ereignis', options: [o('keines', 'keines'), o('reise', 'Reise'), o('party', 'Party, Feier'), o('streit', 'Streit'), o('pruefung', 'Prüfung, Deadline'), o('impfung', 'Impfung'), o('wettkampf', 'Wettkampf')], hint: 'Erklärt Ausreißer. Reise- und Impftage zählen nicht zur Baseline.' },
  { id: 'SUP', mod: 'supplements', prio: 12, coreWhen: usesSupplements, type: 'supplements', exclusive: NONE, text: 'Supplements heute', prefill: 'last', hint: 'Mehr als 50 Mittel zur Auswahl, dazu eigene. Wer etwas regelmäßig nimmt, sieht die Frage oben bei den Kernfragen.' },
  { id: 'X2', mod: 'substances', prio: 14, parent: 'A3', type: 'time', text: 'Uhrzeit des letzten alkoholischen Getränks', when: (a) => a.A3 === true },
  { id: 'A5', mod: 'evening', prio: 16, type: 'time', text: 'Letzte Mahlzeit: Uhrzeit', prefill: 'last' },
  { id: 'A5s', mod: 'evening', prio: 17, type: 'single', text: 'Größe der letzten Mahlzeit', options: [o('leicht', 'leicht'), o('normal', 'normal'), o('schwer', 'schwer')] },
  { id: 'A10', mod: 'evening', prio: 20, type: 'multi', exclusive: NONE, text: 'Erholungsmaßnahmen heute', options: [o(NONE, 'keine'), o('sauna', 'Sauna'), o('kaelte', 'Kälte'), o('massage', 'Massage'), o('dehnen', 'Dehnen'), o('meditation', 'Meditation')] },
  { id: 'A8', mod: 'evening', prio: 22, type: 'single', text: 'Bildschirm in der Stunde vor dem Schlafen', options: [o('0', 'keiner'), o('lt30', '< 30 min'), o('30-60', '30–60'), o('gt60', '> 60')] },
  { id: 'A2', mod: 'evening', prio: 24, type: 'scale', ...L5('gering', 'sehr hoch'), text: 'Geistige Belastung (Arbeit, Lernen)' },
  { id: 'A11', mod: 'evening', prio: 26, type: 'single', text: 'Medikamente wie gewohnt?', options: [o('ja', 'ja'), o('nein', 'vergessen'), o('aenderung', 'Änderung')], prefill: 'last' },
  { id: 'X7', mod: 'substances', prio: 27, parent: 'A11', type: 'multi', exclusive: NONE, text: 'Medikamente heute (Kategorie)', options: [o(NONE, 'keine'), o('antihistamin', 'Antihistaminika'), o('schmerz', 'Schmerzmittel'), o('antibiotika', 'Antibiotika'), o('kortison', 'Kortison'), o('betablocker', 'Betablocker'), o('stimulanzien', 'Stimulanzien'), o('antidepressiva', 'Antidepressiva'), o('schlafmittel', 'Schlafmittel'), o('andere', 'andere')], when: (a) => a.A11 === 'aenderung' },
  { id: 'X8', mod: 'substances', prio: 28, parent: 'A11', type: 'bool', text: 'Neue Medikation oder Dosisänderung?', when: (a) => a.A11 === 'aenderung', hint: 'Manche Medikamente verschieben Puls und HRV. Die App markiert dann den Tag.' },
  { id: 'S8', mod: 'sleepenv', prio: 30, type: 'single', text: 'Mittagsschlaf heute', options: [o('keiner', 'keiner'), o('lt30', '< 30 min'), o('gt30', '> 30 min')] },
  { id: 'A9', mod: 'evening', prio: 32, type: 'single', text: 'Zeit draußen bei Tageslicht', options: [o('lt15', '< 15 min'), o('15-60', '15–60'), o('gt60', '> 60')] },
  { id: 'A6', mod: 'evening', prio: 34, type: 'single', text: 'Getrunken (Wasser, Tee)', options: [o('lt15', '< 1,5 l'), o('15-25', '1,5–2,5 l'), o('gt25', '> 2,5 l')], prefill: 'last' },
  { id: 'T3', mod: 'training', prio: 36, parent: 'A7', type: 'single', text: 'Trainingsleistung heute', options: [o('schlechter', 'schlechter'), o('normal', 'normal'), o('besser', 'besser')], when: (a) => a.A7 === true },
  { id: 'T8', mod: 'training', prio: 37, parent: 'A7', type: 'single', text: 'Schmerz oder Verletzung beim Training', options: [o('keiner', 'keiner'), o('leicht', 'leicht'), o('stark', 'stark')], when: (a) => a.A7 === true },
  { id: 'X3', mod: 'substances', prio: 38, parent: 'A3', type: 'multi', text: 'Alkohol: Getränkeart', options: [o('bier', 'Bier'), o('wein', 'Wein'), o('spirituosen', 'Spirituosen'), o('mix', 'Mix')], when: (a) => a.A3 === true },
  { id: 'X4', mod: 'substances', prio: 39, parent: 'A3', type: 'bool', text: 'Zum Alkohol gegessen und Wasser getrunken?', when: (a) => a.A3 === true },
  { id: 'S11', mod: 'sleepenv', prio: 40, type: 'single', text: 'Zeitzone oder Jetlag', options: [o('keine', 'keine'), o('1-3', '1–3 h'), o('gt3', '> 3 h')] },

  // 7.3 Schlafumgebung (gilt bis zur Änderung)
  { id: 'S1', mod: 'sleepenv', prio: 50, type: 'single', text: 'Schlafzimmertemperatur', options: [o('lt16', '< 16 °C'), o('16-19', '16–19'), o('19-22', '19–22'), o('gt22', '> 22')], prefill: 'sticky' },
  { id: 'S2', mod: 'sleepenv', prio: 52, type: 'single', text: 'Lärm in der Nacht', options: [o('keiner', 'keiner'), o('leicht', 'leicht'), o('stoerend', 'störend')], prefill: 'sticky' },
  { id: 'S3', mod: 'sleepenv', prio: 54, type: 'single', text: 'Dunkelheit des Zimmers', options: [o('dunkel', 'dunkel'), o('rest', 'Restlicht'), o('hell', 'hell')], prefill: 'sticky' },
  { id: 'S4', mod: 'sleepenv', prio: 56, type: 'bool', text: 'Fenster offen oder gelüftet?', prefill: 'sticky' },
  { id: 'S9', mod: 'sleepenv', prio: 58, type: 'multi', exclusive: NONE, text: 'Schlafhilfen', options: [o(NONE, 'keine'), o('schlafmittel', 'Schlafmittel'), o('ohrstoepsel', 'Ohrstöpsel'), o('maske', 'Schlafmaske')], prefill: 'sticky', hint: 'Melatonin steht jetzt bei den Supplements.' },
  { id: 'S5', mod: 'sleepenv', prio: 60, type: 'single', text: 'Im Bett mit', options: [o('allein', 'allein'), o('partner', 'Partner'), o('tier', 'Tier'), o('kind', 'Kind')], prefill: 'sticky' },
  { id: 'S6', mod: 'sleepenv', prio: 62, type: 'single', text: 'Schlafort', options: [o('zuhause', 'zu Hause'), o('hotel', 'Hotel'), o('unterwegs', 'unterwegs'), o('anderes', 'anderes Bett')], prefill: 'sticky' },
  { id: 'S10', mod: 'sleepenv', prio: 66, type: 'single', text: 'Schnarchen oder Atemaussetzer bekannt?', options: [o('nein', 'nein'), o('ja', 'ja'), o('unbekannt', 'unbekannt')], prefill: 'sticky', hint: 'Ein auffälliges Muster ist ein Grund für ärztlichen Rat, nicht für die App.' },
  { id: 'S7', mod: 'sleepenv', prio: 68, type: 'single', text: 'Schlafposition', options: [o('ruecken', 'Rücken'), o('seite', 'Seite'), o('bauch', 'Bauch'), o('wechselnd', 'wechselnd')], prefill: 'sticky' },

  // 7.7 Stress & Soziales
  { id: 'P2', mod: 'stress', prio: 70, type: 'single', text: 'Grübeln am Abend', options: [o('nein', 'nein'), o('etwas', 'etwas'), o('stark', 'stark')] },
  { id: 'P4', mod: 'stress', prio: 72, type: 'single', text: 'Abschalten nach der Arbeit', options: [o('frueh', 'früh'), o('normal', 'normal'), o('spaet', 'spät'), o('nicht', 'gar nicht')] },
  { id: 'P8', mod: 'stress', prio: 74, type: 'single', text: 'Einsam oder überfordert', options: [o('nein', 'nein'), o('etwas', 'etwas'), o('stark', 'stark')], hint: 'Hält das länger an, sprich mit jemandem, dem du vertraust, oder hol dir Unterstützung.' },
  { id: 'P1', mod: 'stress', prio: 76, type: 'multi', exclusive: NONE, text: 'Hauptstressquelle', options: [o(NONE, 'keine'), o('arbeit', 'Arbeit'), o('beziehung', 'Beziehung'), o('finanzen', 'Finanzen'), o('gesundheit', 'Gesundheit'), o('familie', 'Familie'), o('termine', 'Termine')] },
  { id: 'P5', mod: 'stress', prio: 78, type: 'multi', exclusive: NONE, text: 'Entspannung', options: [o(NONE, 'keine'), o('meditation', 'Meditation'), o('atmung', 'Atemübung'), o('lesen', 'Lesen'), o('musik', 'Musik'), o('spaziergang', 'Spaziergang')] },
  { id: 'P6', mod: 'stress', prio: 80, type: 'bool', text: 'Zeit in der Natur' },
  { id: 'P9', mod: 'stress', prio: 82, type: 'bool', text: 'Freude oder Erfolgserlebnis' },
  { id: 'P3', mod: 'stress', prio: 84, type: 'bool', text: 'Streit oder Konflikt' },
  { id: 'P7', mod: 'stress', prio: 86, type: 'single', text: 'Soziale Zeit', options: [o('wenig', 'wenig'), o('normal', 'normal'), o('viel', 'viel')] },
  { id: 'P7q', mod: 'stress', prio: 87, parent: 'P7', type: 'single', text: 'Wie war die soziale Zeit?', options: [o('gut', 'gut'), o('neutral', 'neutral'), o('anstrengend', 'anstrengend')], when: (a) => a.P7 && a.P7 !== 'wenig' },
  { id: 'P10', mod: 'stress', prio: 88, type: 'single', text: 'Bildschirmzeit gesamt', options: [o('lt2', '< 2 h'), o('2-5', '2–5 h'), o('gt5', '> 5 h')] },
  { id: 'P11', mod: 'stress', prio: 90, type: 'bool', text: 'Intimität', when: (a, ctx) => ctx?.settings?.survey?.sensitive, hint: 'Freiwillig. Bleibt nur auf deinem Gerät.' },

  // 7.4 Ernährung
  { id: 'E1', mod: 'nutrition', prio: 100, type: 'single', text: 'Kalorienbilanz (grob)', options: [o('defizit', 'Defizit'), o('ausgeglichen', 'ausgeglichen'), o('ueberschuss', 'Überschuss')] },
  { id: 'E4', mod: 'nutrition', prio: 102, type: 'bool', text: 'Zucker oder stark Verarbeitetes am Abend' },
  { id: 'E7', mod: 'nutrition', prio: 104, type: 'single', text: 'Verdauungsbeschwerden', options: [o('keine', 'keine'), o('leicht', 'leicht'), o('stark', 'stark')] },
  { id: 'E2', mod: 'nutrition', prio: 106, type: 'single', text: 'Proteinmenge', options: [o('niedrig', 'niedrig'), o('normal', 'normal'), o('hoch', 'hoch')] },
  { id: 'E5', mod: 'nutrition', prio: 108, type: 'bool', text: 'Scharf, fettig oder sehr salzig gegessen' },
  { id: 'E6', mod: 'nutrition', prio: 110, type: 'single', text: 'Fasten', options: [o('kein', 'kein'), o('12', '12 h'), o('16', '16 h'), o('24', '24 h')] },
  { id: 'E3', mod: 'nutrition', prio: 112, type: 'single', text: 'Kohlenhydrate rund ums Training', options: [o('niedrig', 'niedrig'), o('normal', 'normal'), o('hoch', 'hoch')] },
  { id: 'E10', mod: 'nutrition', prio: 114, type: 'multi', exclusive: NONE, text: 'Mögliche Unverträglichkeiten heute', options: [o(NONE, 'keine'), o('gluten', 'Gluten'), o('laktose', 'Laktose'), o('histamin', 'Histamin'), o('fodmap', 'FODMAP')] },
  { id: 'E9', mod: 'nutrition', prio: 116, type: 'multi', text: 'Koffein aus', options: [o('kaffee', 'Kaffee'), o('tee', 'Tee'), o('energy', 'Energy'), o('preworkout', 'Pre-Workout')], prefill: 'last' },

  // 7.6 Training, seltener gebraucht
  { id: 'T5', mod: 'training', prio: 120, parent: 'A7', type: 'single', text: 'Vor dem Training gegessen?', options: [o('nuechtern', 'nüchtern'), o('leicht', 'leicht'), o('voll', 'voll')], when: (a) => a.A7 === true },
  { id: 'T6', mod: 'training', prio: 122, parent: 'A7', type: 'bool', text: 'Training bei Hitze, Kälte oder hoher Luftfeuchte?', when: (a) => a.A7 === true },
  { id: 'T7', mod: 'training', prio: 124, parent: 'A7', type: 'bool', text: 'Vor dem Training aufgewärmt?', when: (a) => a.A7 === true },
  { id: 'T11', mod: 'training', prio: 126, parent: 'A7', type: 'single', text: 'Training laut Plan?', options: [o('plan', 'nach Plan'), o('spontan', 'spontan')], when: (a) => a.A7 === true },
  { id: 'T12', mod: 'training', prio: 128, parent: 'A7', type: 'bool', text: 'Wettkampf oder Test?', when: (a) => a.A7 === true },

  // 7.10 Wochenrückblick (nur am gewählten Tag)
  { id: 'W1a', mod: 'weekly', prio: 130, type: 'scale', ...L5('schlecht', 'sehr gut'), text: 'Zufrieden mit der Woche' },
  { id: 'W1b', mod: 'weekly', prio: 131, type: 'scale', ...L5('schlecht', 'sehr gut'), text: 'Energie in der Woche' },
  { id: 'W1c', mod: 'weekly', prio: 132, type: 'scale', ...L5('schlecht', 'sehr gut'), text: 'Schlaf in der Woche' },
  { id: 'W1d', mod: 'weekly', prio: 133, type: 'scale', ...L5('schlecht', 'sehr gut'), text: 'Training in der Woche' },
  { id: 'W3', mod: 'weekly', prio: 134, type: 'single', text: 'Trainingsziel der Woche erreicht', options: [o('ja', 'ja'), o('teils', 'teils'), o('nein', 'nein')] },
  { id: 'W6', mod: 'weekly', prio: 135, type: 'scale', ...L5('niedrig', 'hoch'), text: 'Subjektive Fitness' },
  { id: 'W5', mod: 'weekly', prio: 136, type: 'number', text: 'Dein Schlafbedarf aus Erfahrung', min: 5, max: 11, step: 0.25, unit: 'h', prefill: 'last' },
  { id: 'T9', mod: 'weekly', prio: 137, type: 'single', text: 'Alltagsbewegung diese Woche', options: [o('wenig', 'sehr wenig'), o('normal', 'normal'), o('viel', 'viel')], prefill: 'sticky' },
  { id: 'T10', mod: 'weekly', prio: 138, type: 'single', text: 'Sitzzeit am Stück (typischer Tag)', options: [o('lt4', '< 4 h'), o('4-8', '4–8 h'), o('gt8', '> 8 h')], prefill: 'sticky' },
  { id: 'W2b', mod: 'weekly', prio: 139, type: 'number', text: 'Taillenumfang', min: 40, max: 200, step: 0.5, unit: 'cm', prefill: 'last' },
  { id: 'W4', mod: 'weekly', prio: 140, type: 'text', text: 'Änderung im Leben (Umzug, Job, Prüfung …)' },
  { id: 'W7', mod: 'weekly', prio: 141, type: 'text', text: 'Welche Frage nervt oder ist überflüssig?' },
];

/**
 * Nicht mehr gestellte Fragen früherer Versionen. Ihre Antworten bleiben gespeichert und werden weiter ausgewertet.
 * E8 (Supplements im Ernährungsmodul) ist in SUP aufgegangen, die Notiz A12n im Tagebuch des Logbuchs
 * (alte Notizen zeigt das Logbuch beim jeweiligen Tag).
 */
export const RETIRED = {
  E8: { replacedBy: 'SUP', text: 'Supplements (Standardliste, bis Version 0.2)' },
  A12n: { replacedBy: 'journal', text: 'Notiz im Abendcheck (bis Version 0.4)' },
};

export const QUESTION_BY_ID = Object.fromEntries(QUESTIONS.map((q) => [q.id, q]));

export function optionLabel(q, v) {
  return q.options?.find((x) => x.v === v)?.label ?? String(v);
}

export { NONE, hasSymptom, supplementsOf };
