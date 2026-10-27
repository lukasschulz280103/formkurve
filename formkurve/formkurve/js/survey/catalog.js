// Fragenkatalog aus dem Konzept (Abschnitt 7) als Daten. Zyklus-Fragen (G6, G7) sind bewusst entfernt.
// Antworttypen: scale (Zahl), bool, single (Wert), multi (Liste), number, time ("HH:MM"), text.

const o = (v, label) => ({ v, label });
const NONE = 'keine';
const has = (arr, v) => Array.isArray(arr) && arr.includes(v);
const hasSymptom = (a) => Array.isArray(a.M10) && a.M10.some((x) => x !== NONE);

export const MODULES = {
  morning: { title: 'Morgencheck', slot: 'morning', core: true, hint: 'Direkt nach dem Aufwachen, bevor du die Scores siehst.' },
  health: { title: 'Gesundheit', slot: 'morning', hint: 'Erscheint bei Beschwerden oder Kopfschmerzen.' },
  evening: { title: 'Abendcheck', slot: 'evening', core: true, hint: 'Was heute war. Beeinflusst die kommende Nacht.' },
  substances: { title: 'Alkohol & Substanzen', slot: 'evening', hint: 'Erscheint, wenn du Alkohol angibst oder sich Medikamente ändern.' },
  training: { title: 'Training', slot: 'evening', hint: 'Erscheint, wenn du trainiert hast. Speist den Kraft-Zuschlag im Strain.' },
  sleepenv: { title: 'Schlafumgebung', slot: 'evening', hint: 'Wöchentlich und auf Reisen. Antworten gelten, bis du sie änderst.' },
  nutrition: { title: 'Ernährung', slot: 'evening', hint: 'Zweimal pro Woche oder wenn du heute anders gegessen hast.' },
  stress: { title: 'Stress & Soziales', slot: 'evening', hint: 'Dreimal pro Woche und an stressigen Tagen.' },
  weekly: { title: 'Wochenrückblick', slot: 'evening', hint: 'Einmal pro Woche.' },
};

/** Wann ein Modul automatisch erscheint. ctx: { answers, weekday, settings } */
export function moduleActive(mod, ctx) {
  const a = ctx.answers || {};
  const s = ctx.settings?.survey || {};
  switch (mod) {
    case 'morning':
    case 'evening':
      return true;
    case 'health':
      return hasSymptom(a) || (a.M9 ?? 0) >= 2;
    case 'substances':
      return a.A3 === true || a.A11 === 'aenderung' || s.askNicotine;
    case 'training':
      return a.A7 === true;
    case 'sleepenv':
      return ctx.weekday === (s.weeklyDay ?? 0) || has(a.A12, 'reise');
    case 'nutrition':
      return (s.nutritionDays || []).includes(ctx.weekday);
    case 'stress':
      return (s.stressDays || []).includes(ctx.weekday) || (a.A1 ?? 0) >= 4;
    case 'weekly':
      return ctx.weekday === (s.weeklyDay ?? 0);
    default:
      return false;
  }
}

const L5 = (lo, hi) => ({ min: 1, max: 5, labels: [lo, hi] });

export const QUESTIONS = [
  // 7.1 Morgen
  { id: 'M1', mod: 'morning', type: 'scale', ...L5('gar nicht', 'sehr'), text: 'Wie erholt fühlst du dich?', hint: 'Prüft, ob die Scores zu deinem Gefühl passen.' },
  { id: 'M2', mod: 'morning', type: 'scale', ...L5('leer', 'voll'), text: 'Energielevel jetzt' },
  { id: 'M3', mod: 'morning', type: 'single', text: 'Muskelkater oder Steifheit', options: [o(0, 'keiner'), o(1, 'leicht'), o(2, 'deutlich'), o(3, 'stark')] },
  { id: 'M3r', mod: 'morning', type: 'multi', text: 'Wo?', options: [o('beine', 'Beine'), o('oberkoerper', 'Oberkörper'), o('ruecken', 'Rücken'), o('arme', 'Arme'), o('ganz', 'Ganzkörper')], when: (a) => (a.M3 ?? 0) >= 1 },
  { id: 'M4', mod: 'morning', type: 'scale', ...L5('schlecht', 'sehr gut'), text: 'Wie gut hast du geschlafen?' },
  { id: 'M5', mod: 'morning', type: 'single', text: 'Einschlafdauer (geschätzt)', options: [o('lt15', '< 15 min'), o('15-30', '15–30'), o('30-60', '30–60'), o('gt60', '> 60')] },
  { id: 'M6', mod: 'morning', type: 'single', text: 'Nächtliches Aufwachen', options: [o(0, '0'), o(1, '1'), o(2, '2'), o(3, '3+')] },
  { id: 'M6r', mod: 'morning', type: 'multi', text: 'Grund fürs Aufwachen', options: [o('toilette', 'Toilette'), o('laerm', 'Lärm'), o('hitze', 'Hitze'), o('gedanken', 'Gedanken'), o('andere', 'Partner, Kind, Tier'), o('unbekannt', 'unbekannt')], when: (a) => (a.M6 ?? 0) >= 1 },
  { id: 'M7', mod: 'morning', type: 'scale', ...L5('mies', 'super'), text: 'Stimmung' },
  { id: 'M8', mod: 'morning', type: 'scale', ...L5('keine', 'hoch'), text: 'Motivation fürs Training' },
  { id: 'M9', mod: 'morning', type: 'single', text: 'Kopfschmerzen', options: [o(0, 'keine'), o(1, 'leicht'), o(2, 'mittel'), o(3, 'stark')] },
  { id: 'M10', mod: 'morning', type: 'multi', exclusive: NONE, text: 'Krankheitsgefühl', options: [o(NONE, 'nichts'), o('hals', 'Hals'), o('husten', 'Husten'), o('schnupfen', 'Schnupfen'), o('fieber', 'Fieber'), o('magen', 'Magen-Darm'), o('glieder', 'Gliederschmerzen')], hint: 'Infekte erhöhen Puls und Temperatur oft, bevor du es merkst. Kranke Tage zählen nicht zur Baseline.' },
  { id: 'M11', mod: 'morning', type: 'bool', text: 'Intensive Träume oder Albträume' },
  { id: 'M12', mod: 'morning', type: 'single', text: 'Wie aufgewacht?', options: [o('natuerlich', 'von selbst'), o('wecker', 'Wecker')] },
  { id: 'M12s', mod: 'morning', type: 'number', text: 'Snooze-Anzahl', min: 0, max: 10, step: 1, when: (a) => a.M12 === 'wecker' },
  { id: 'M13', mod: 'morning', type: 'number', text: 'Gewicht (optional)', min: 30, max: 250, step: 0.1, unit: 'kg', optional: true, prefill: 'last' },

  // 7.8 Gesundheit (morgens bei Beschwerden)
  { id: 'G1', mod: 'health', type: 'number', text: 'Fieber gemessen?', min: 35, max: 42, step: 0.1, unit: '°C', optional: true },
  { id: 'G2', mod: 'health', type: 'single', text: 'Allergie oder Heuschnupfen', options: [o('keine', 'keine'), o('leicht', 'leicht'), o('stark', 'stark')] },
  { id: 'G3', mod: 'health', type: 'single', text: 'Magen-Darm-Beschwerden', options: [o('keine', 'keine'), o('leicht', 'leicht'), o('stark', 'stark')] },
  { id: 'G4', mod: 'health', type: 'scale', min: 0, max: 10, labels: ['keine', 'stark'], text: 'Schmerzen allgemein' },
  { id: 'G5', mod: 'health', type: 'bool', text: 'Zahnbehandlung, Entzündung oder Wunde' },
  { id: 'G8', mod: 'health', type: 'text', text: 'Blutdruck gemessen (optional)', placeholder: 'z. B. 120/80', optional: true },
  { id: 'G9', mod: 'health', type: 'text', text: 'Diagnose oder laufende Behandlung (optional)', optional: true, prefill: 'sticky' },

  // 7.2 Abend
  { id: 'A1', mod: 'evening', type: 'scale', ...L5('entspannt', 'sehr gestresst'), text: 'Stresslevel heute' },
  { id: 'A2', mod: 'evening', type: 'scale', ...L5('gering', 'sehr hoch'), text: 'Geistige Belastung (Arbeit, Lernen)' },
  { id: 'A3', mod: 'evening', type: 'bool', text: 'Alkohol getrunken?', hint: 'Eine der stärksten Einflussgrößen auf die HRV der Nacht.' },
  { id: 'A4', mod: 'evening', type: 'number', text: 'Koffein: Anzahl Getränke', min: 0, max: 10, step: 1, prefill: 'last' },
  { id: 'A4t', mod: 'evening', type: 'time', text: 'Uhrzeit des letzten Koffeins', prefill: 'last', when: (a) => (a.A4 ?? 0) > 0, hint: 'Koffein wirkt 5 bis 6 Stunden zur Hälfte nach.' },
  { id: 'A5', mod: 'evening', type: 'time', text: 'Letzte Mahlzeit: Uhrzeit', prefill: 'last' },
  { id: 'A5s', mod: 'evening', type: 'single', text: 'Größe der letzten Mahlzeit', options: [o('leicht', 'leicht'), o('normal', 'normal'), o('schwer', 'schwer')] },
  { id: 'A6', mod: 'evening', type: 'single', text: 'Getrunken (Wasser, Tee)', options: [o('lt15', '< 1,5 l'), o('15-25', '1,5–2,5 l'), o('gt25', '> 2,5 l')], prefill: 'last' },
  { id: 'A7', mod: 'evening', type: 'bool', text: 'Training heute?', prefill: 'workout' },
  { id: 'A8', mod: 'evening', type: 'single', text: 'Bildschirm in der Stunde vor dem Schlafen', options: [o('0', 'keiner'), o('lt30', '< 30 min'), o('30-60', '30–60'), o('gt60', '> 60')] },
  { id: 'A9', mod: 'evening', type: 'single', text: 'Zeit draußen bei Tageslicht', options: [o('lt15', '< 15 min'), o('15-60', '15–60'), o('gt60', '> 60')] },
  { id: 'A10', mod: 'evening', type: 'multi', exclusive: NONE, text: 'Erholungsmaßnahmen heute', options: [o(NONE, 'keine'), o('sauna', 'Sauna'), o('kaelte', 'Kälte'), o('massage', 'Massage'), o('dehnen', 'Dehnen'), o('meditation', 'Meditation')] },
  { id: 'A11', mod: 'evening', type: 'single', text: 'Supplements und Medikamente wie gewohnt?', options: [o('ja', 'ja'), o('nein', 'vergessen'), o('aenderung', 'Änderung')], prefill: 'last' },
  { id: 'A12', mod: 'evening', type: 'multi', exclusive: 'keines', text: 'Besonderes Ereignis', options: [o('keines', 'keines'), o('reise', 'Reise'), o('party', 'Party, Feier'), o('streit', 'Streit'), o('pruefung', 'Prüfung, Deadline'), o('impfung', 'Impfung'), o('wettkampf', 'Wettkampf')], hint: 'Erklärt Ausreißer. Reise- und Impftage zählen nicht zur Baseline.' },
  { id: 'A12n', mod: 'evening', type: 'text', text: 'Notiz (optional)', optional: true },

  // 7.5 Substanzen
  { id: 'X1', mod: 'substances', type: 'number', text: 'Alkohol: Standardgetränke', unit: 'Getränke', min: 0, max: 15, step: 1, when: (a) => a.A3 === true, hint: '1 Getränk = 0,33 l Bier, 0,15 l Wein oder 4 cl Spirituose.' },
  { id: 'X2', mod: 'substances', type: 'time', text: 'Uhrzeit des letzten Getränks', when: (a) => a.A3 === true },
  { id: 'X3', mod: 'substances', type: 'multi', text: 'Getränkeart', options: [o('bier', 'Bier'), o('wein', 'Wein'), o('spirituosen', 'Spirituosen'), o('mix', 'Mix')], when: (a) => a.A3 === true },
  { id: 'X4', mod: 'substances', type: 'bool', text: 'Dazu gegessen und Wasser getrunken?', when: (a) => a.A3 === true },
  { id: 'X5', mod: 'substances', type: 'single', text: 'Nikotin', options: [o('nein', 'nein'), o('zigaretten', 'Zigaretten'), o('vape', 'Vape'), o('beutel', 'Beutel')], prefill: 'last', when: (a, ctx) => ctx?.settings?.survey?.askNicotine },
  { id: 'X6', mod: 'substances', type: 'bool', text: 'Cannabis oder andere Substanzen', when: (a, ctx) => ctx?.settings?.survey?.askNicotine },
  { id: 'X7', mod: 'substances', type: 'multi', exclusive: NONE, text: 'Medikamente heute (Kategorie)', options: [o(NONE, 'keine'), o('antihistamin', 'Antihistaminika'), o('schmerz', 'Schmerzmittel'), o('antibiotika', 'Antibiotika'), o('kortison', 'Kortison'), o('betablocker', 'Betablocker'), o('stimulanzien', 'Stimulanzien'), o('antidepressiva', 'Antidepressiva'), o('schlafmittel', 'Schlafmittel'), o('andere', 'andere')], when: (a) => a.A11 === 'aenderung' },
  { id: 'X8', mod: 'substances', type: 'bool', text: 'Neue Medikation oder Dosisänderung?', when: (a) => a.A11 === 'aenderung', hint: 'Manche Medikamente verschieben Puls und HRV. Die App markiert dann den Tag.' },

  // 7.6 Training
  { id: 'T1', mod: 'training', type: 'multi', text: 'Trainingsart', options: [o('kraft', 'Kraft'), o('ausdauer', 'Ausdauer'), o('hiit', 'HIIT'), o('team', 'Teamsport'), o('mobility', 'Mobility, Yoga'), o('andere', 'Anderes')], prefill: 'workout' },
  { id: 'T13', mod: 'training', type: 'number', text: 'Dauer', unit: 'min', min: 0, max: 400, step: 5, prefill: 'workout', hint: 'Bei Kraft: Dauer × Anstrengung ergibt den Kraft-Zuschlag im Strain.' },
  { id: 'T2', mod: 'training', type: 'scale', min: 1, max: 10, labels: ['sehr leicht', 'maximal'], text: 'Anstrengung (RPE)' },
  { id: 'T3', mod: 'training', type: 'single', text: 'Leistung heute', options: [o('schlechter', 'schlechter'), o('normal', 'normal'), o('besser', 'besser')] },
  { id: 'T5', mod: 'training', type: 'single', text: 'Vorher gegessen?', options: [o('nuechtern', 'nüchtern'), o('leicht', 'leicht'), o('voll', 'voll')] },
  { id: 'T6', mod: 'training', type: 'bool', text: 'Hitze, Kälte oder hohe Luftfeuchte?' },
  { id: 'T7', mod: 'training', type: 'bool', text: 'Aufgewärmt?' },
  { id: 'T8', mod: 'training', type: 'single', text: 'Schmerz oder Verletzung', options: [o('keiner', 'keiner'), o('leicht', 'leicht'), o('stark', 'stark')] },
  { id: 'T11', mod: 'training', type: 'single', text: 'Laut Plan?', options: [o('plan', 'nach Plan'), o('spontan', 'spontan')] },
  { id: 'T12', mod: 'training', type: 'bool', text: 'Wettkampf oder Test?' },

  // 7.3 Schlafumgebung (gilt bis zur Änderung)
  { id: 'S1', mod: 'sleepenv', type: 'single', text: 'Schlafzimmertemperatur', options: [o('lt16', '< 16 °C'), o('16-19', '16–19'), o('19-22', '19–22'), o('gt22', '> 22')], prefill: 'sticky' },
  { id: 'S2', mod: 'sleepenv', type: 'single', text: 'Lärm in der Nacht', options: [o('keiner', 'keiner'), o('leicht', 'leicht'), o('stoerend', 'störend')], prefill: 'sticky' },
  { id: 'S3', mod: 'sleepenv', type: 'single', text: 'Dunkelheit des Zimmers', options: [o('dunkel', 'dunkel'), o('rest', 'Restlicht'), o('hell', 'hell')], prefill: 'sticky' },
  { id: 'S4', mod: 'sleepenv', type: 'bool', text: 'Fenster offen oder gelüftet?', prefill: 'sticky' },
  { id: 'S5', mod: 'sleepenv', type: 'single', text: 'Im Bett mit', options: [o('allein', 'allein'), o('partner', 'Partner'), o('tier', 'Tier'), o('kind', 'Kind')], prefill: 'sticky' },
  { id: 'S6', mod: 'sleepenv', type: 'single', text: 'Schlafort', options: [o('zuhause', 'zu Hause'), o('hotel', 'Hotel'), o('unterwegs', 'unterwegs'), o('anderes', 'anderes Bett')], prefill: 'sticky' },
  { id: 'S7', mod: 'sleepenv', type: 'single', text: 'Schlafposition', options: [o('ruecken', 'Rücken'), o('seite', 'Seite'), o('bauch', 'Bauch'), o('wechselnd', 'wechselnd')], prefill: 'sticky' },
  { id: 'S8', mod: 'sleepenv', type: 'single', text: 'Mittagsschlaf heute', options: [o('keiner', 'keiner'), o('lt30', '< 30 min'), o('gt30', '> 30 min')] },
  { id: 'S9', mod: 'sleepenv', type: 'multi', exclusive: NONE, text: 'Schlafhilfen', options: [o(NONE, 'keine'), o('melatonin', 'Melatonin'), o('schlafmittel', 'Schlafmittel'), o('ohrstoepsel', 'Ohrstöpsel'), o('maske', 'Schlafmaske')], prefill: 'sticky' },
  { id: 'S10', mod: 'sleepenv', type: 'single', text: 'Schnarchen oder Atemaussetzer bekannt?', options: [o('nein', 'nein'), o('ja', 'ja'), o('unbekannt', 'unbekannt')], prefill: 'sticky', hint: 'Ein auffälliges Muster ist ein Grund für ärztlichen Rat, nicht für die App.' },
  { id: 'S11', mod: 'sleepenv', type: 'single', text: 'Zeitzone oder Jetlag', options: [o('keine', 'keine'), o('1-3', '1–3 h'), o('gt3', '> 3 h')] },

  // 7.4 Ernährung
  { id: 'E1', mod: 'nutrition', type: 'single', text: 'Kalorienbilanz (grob)', options: [o('defizit', 'Defizit'), o('ausgeglichen', 'ausgeglichen'), o('ueberschuss', 'Überschuss')] },
  { id: 'E2', mod: 'nutrition', type: 'single', text: 'Proteinmenge', options: [o('niedrig', 'niedrig'), o('normal', 'normal'), o('hoch', 'hoch')] },
  { id: 'E3', mod: 'nutrition', type: 'single', text: 'Kohlenhydrate rund ums Training', options: [o('niedrig', 'niedrig'), o('normal', 'normal'), o('hoch', 'hoch')] },
  { id: 'E4', mod: 'nutrition', type: 'bool', text: 'Zucker oder stark Verarbeitetes am Abend' },
  { id: 'E5', mod: 'nutrition', type: 'bool', text: 'Scharf, fettig oder sehr salzig gegessen' },
  { id: 'E6', mod: 'nutrition', type: 'single', text: 'Fasten', options: [o('kein', 'kein'), o('12', '12 h'), o('16', '16 h'), o('24', '24 h')] },
  { id: 'E7', mod: 'nutrition', type: 'single', text: 'Verdauungsbeschwerden', options: [o('keine', 'keine'), o('leicht', 'leicht'), o('stark', 'stark')] },
  { id: 'E8', mod: 'nutrition', type: 'multi', exclusive: NONE, text: 'Supplements (Standardliste)', options: [o(NONE, 'keine'), o('kreatin', 'Kreatin'), o('magnesium', 'Magnesium'), o('vitd', 'Vitamin D'), o('omega3', 'Omega-3'), o('eisen', 'Eisen'), o('elektrolyte', 'Elektrolyte'), o('andere', 'andere')], prefill: 'sticky' },
  { id: 'E9', mod: 'nutrition', type: 'multi', text: 'Koffein aus', options: [o('kaffee', 'Kaffee'), o('tee', 'Tee'), o('energy', 'Energy'), o('preworkout', 'Pre-Workout')], prefill: 'last' },
  { id: 'E10', mod: 'nutrition', type: 'multi', exclusive: NONE, text: 'Mögliche Unverträglichkeiten heute', options: [o(NONE, 'keine'), o('gluten', 'Gluten'), o('laktose', 'Laktose'), o('histamin', 'Histamin'), o('fodmap', 'FODMAP')] },

  // 7.7 Stress & Soziales
  { id: 'P1', mod: 'stress', type: 'multi', exclusive: NONE, text: 'Hauptstressquelle', options: [o(NONE, 'keine'), o('arbeit', 'Arbeit'), o('beziehung', 'Beziehung'), o('finanzen', 'Finanzen'), o('gesundheit', 'Gesundheit'), o('familie', 'Familie'), o('termine', 'Termine')] },
  { id: 'P2', mod: 'stress', type: 'single', text: 'Grübeln am Abend', options: [o('nein', 'nein'), o('etwas', 'etwas'), o('stark', 'stark')] },
  { id: 'P3', mod: 'stress', type: 'bool', text: 'Streit oder Konflikt' },
  { id: 'P4', mod: 'stress', type: 'single', text: 'Abschalten nach der Arbeit', options: [o('frueh', 'früh'), o('normal', 'normal'), o('spaet', 'spät'), o('nicht', 'gar nicht')] },
  { id: 'P5', mod: 'stress', type: 'multi', exclusive: NONE, text: 'Entspannung', options: [o(NONE, 'keine'), o('meditation', 'Meditation'), o('atmung', 'Atemübung'), o('lesen', 'Lesen'), o('musik', 'Musik'), o('spaziergang', 'Spaziergang')] },
  { id: 'P6', mod: 'stress', type: 'bool', text: 'Zeit in der Natur' },
  { id: 'P7', mod: 'stress', type: 'single', text: 'Soziale Zeit', options: [o('wenig', 'wenig'), o('normal', 'normal'), o('viel', 'viel')] },
  { id: 'P7q', mod: 'stress', type: 'single', text: 'Wie war sie?', options: [o('gut', 'gut'), o('neutral', 'neutral'), o('anstrengend', 'anstrengend')], when: (a) => a.P7 && a.P7 !== 'wenig' },
  { id: 'P8', mod: 'stress', type: 'single', text: 'Einsam oder überfordert', options: [o('nein', 'nein'), o('etwas', 'etwas'), o('stark', 'stark')], hint: 'Hält das länger an, sprich mit jemandem, dem du vertraust, oder hol dir Unterstützung.' },
  { id: 'P9', mod: 'stress', type: 'bool', text: 'Freude oder Erfolgserlebnis' },
  { id: 'P10', mod: 'stress', type: 'single', text: 'Bildschirmzeit gesamt', options: [o('lt2', '< 2 h'), o('2-5', '2–5 h'), o('gt5', '> 5 h')] },
  { id: 'P11', mod: 'stress', type: 'bool', text: 'Intimität', when: (a, ctx) => ctx?.settings?.survey?.sensitive, hint: 'Freiwillig. Bleibt nur auf deinem iPhone.' },

  // 7.10 Wochenrückblick
  { id: 'W1a', mod: 'weekly', type: 'scale', ...L5('schlecht', 'sehr gut'), text: 'Zufrieden mit der Woche' },
  { id: 'W1b', mod: 'weekly', type: 'scale', ...L5('schlecht', 'sehr gut'), text: 'Energie in der Woche' },
  { id: 'W1c', mod: 'weekly', type: 'scale', ...L5('schlecht', 'sehr gut'), text: 'Schlaf in der Woche' },
  { id: 'W1d', mod: 'weekly', type: 'scale', ...L5('schlecht', 'sehr gut'), text: 'Training in der Woche' },
  { id: 'W2b', mod: 'weekly', type: 'number', text: 'Taillenumfang (optional)', min: 40, max: 200, step: 0.5, unit: 'cm', optional: true, prefill: 'last' },
  { id: 'W3', mod: 'weekly', type: 'single', text: 'Trainingsziel der Woche erreicht', options: [o('ja', 'ja'), o('teils', 'teils'), o('nein', 'nein')] },
  { id: 'T9', mod: 'weekly', type: 'single', text: 'Alltagsbewegung diese Woche', options: [o('wenig', 'sehr wenig'), o('normal', 'normal'), o('viel', 'viel')], prefill: 'sticky' },
  { id: 'T10', mod: 'weekly', type: 'single', text: 'Sitzzeit am Stück (typischer Tag)', options: [o('lt4', '< 4 h'), o('4-8', '4–8 h'), o('gt8', '> 8 h')], prefill: 'sticky' },
  { id: 'W5', mod: 'weekly', type: 'number', text: 'Dein Schlafbedarf aus Erfahrung', min: 5, max: 11, step: 0.25, unit: 'h', prefill: 'last' },
  { id: 'W6', mod: 'weekly', type: 'scale', ...L5('niedrig', 'hoch'), text: 'Subjektive Fitness' },
  { id: 'W4', mod: 'weekly', type: 'text', text: 'Änderung im Leben (Umzug, Job, Prüfung …)', optional: true },
  { id: 'W7', mod: 'weekly', type: 'text', text: 'Welche Frage nervt oder ist überflüssig?', optional: true },
];

export const QUESTION_BY_ID = Object.fromEntries(QUESTIONS.map((q) => [q.id, q]));

export function optionLabel(q, v) {
  return q.options?.find((x) => x.v === v)?.label ?? String(v);
}

export { NONE, hasSymptom };
