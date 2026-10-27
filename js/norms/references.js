// Richt- und Normalwerte offizieller Stellen (und, wo es keine gibt, gekennzeichnete Studien)
// für die Infopunkte im Dashboard. Stand der Prüfung: 27.10.2026.

export const SOURCES = {
  aha: { label: 'American Heart Association (Go Red for Women): Target Heart Rates Chart', url: 'https://www.goredforwomen.org/en/healthy-living/fitness/fitness-basics/target-heart-rates' },
  dak: { label: 'DAK-Gesundheit: Der Ruhepuls', url: 'https://www.dak.de/dak/gesundheit/erkrankungen/herz-kreislauf-erkrankungen/ruhepuls_81604' },
  tanaka: { label: 'Tanaka, Monahan, Seals 2001: Age-predicted maximal heart rate revisited (J Am Coll Cardiol)', url: 'https://pubmed.ncbi.nlm.nih.gov/11153730/' },
  hrv: { label: 'Shaffer & Ginsberg 2017, Frontiers in Public Health (Normwerte nach Nunan et al. 2010)', url: 'https://www.frontiersin.org/journals/public-health/articles/10.3389/fpubh.2017.00258' },
  nsfDuration: { label: 'National Sleep Foundation: Schlafdauer-Empfehlungen (2015, 2026 bestätigt)', url: 'https://www.thensf.org/sleep-duration' },
  nsfQuality: { label: 'National Sleep Foundation: Empfehlungen zur Schlafqualität (Ohayon et al., Sleep Health)', url: 'https://www.medicalnewstoday.com/releases/315438' },
  msd: { label: 'MSD Manual (Ausgabe für Fachkreise): Typisches Schlafmuster junger Erwachsener', url: 'https://merckmanuals.com/professional/multimedia/table/typical-sleep-pattern-in-young-adults' },
  nhsOxi: { label: 'NHS (COVID Oximetry @home): Patienteninformation zum Pulsoximeter', url: 'https://www.northyorkshireccg.nhs.uk/wp-content/uploads/2020/12/Annex-3-Patient-Information-V1.1-HHR.pdf' },
  news2: { label: 'Royal College of Physicians: National Early Warning Score (NEWS2)', url: 'https://www.rcp.ac.uk/resources/national-early-warning-score-news-2/' },
  nhsFever: { label: 'NHS: High temperature (fever) in adults', url: 'https://www.nhs.uk/conditions/fever-in-adults' },
  whoActivity: { label: 'WHO: Empfehlungen zu körperlicher Aktivität', url: 'https://who.int/initiatives/behealthy/physical-activity' },
  steps: { label: 'Steps for Health Collaborative, The Lancet Public Health 2022 (15 Kohorten)', url: 'https://scholars.uthscsa.edu/en/publications/daily-steps-and-all-cause-mortality-a-meta-analysis-of-15-interna/' },
  gabbett: { label: 'Gabbett 2016, British Journal of Sports Medicine (Belastungsverhältnis)', url: 'https://doi.org/10.1136/bjsports-2015-095788' },
  friend: { label: 'Kaminsky et al. 2015, Mayo Clinic Proceedings (FRIEND-Register)', url: 'https://www.cosmed.com/en/resources/science/95-cardio-pulmonary-exercise-test/929-reference-standards-for-cardiorespiratory-fitness-measured-with-cardiopulmonary-exercise-testing' },
  whoBmi: { label: 'WHO Europa: Ernährung und gesunder Lebensstil (BMI-Klassen)', url: 'https://who.int/europe/news-room/fact-sheets/item/nutrition---maintaining-a-healthy-lifestyle' },
  whoAir: { label: 'WHO Global Air Quality Guidelines 2021', url: 'https://iris.who.int/handle/10665/345334' },
  dwdPollen: { label: 'Deutscher Wetterdienst: Pollenflug-Gefahrenindex', url: 'https://opendatao.dwd.de/climate_environment/health/alerts/Beschreibung_pollen_s31fg.pdf' },
  hlnug: { label: 'HLNUG: Kenntage der Wärmebelastung (Daten: Deutscher Wetterdienst)', url: 'https://www.hlnug.de/fileadmin/dokumente/nachhaltigkeit/Klimafolgenindikatoren/2020/Waermebelastung_Kenntage.pdf' },
};

const fmt = (x, d = 0) => (x == null || !Number.isFinite(x) ? '–' : x.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d }));

function inRange(v, lo, hi) {
  if (v == null) return null;
  if (v < lo) return 'below';
  if (v > hi) return 'above';
  return 'in';
}

function sleepDurationRange(age) {
  if (age == null) return null;
  if (age >= 65) return [7, 8, '65 Jahre und älter'];
  if (age >= 18) return [7, 9, age <= 25 ? '18 bis 25 Jahre' : '26 bis 64 Jahre'];
  return null;
}

/**
 * Liefert den Inhalt eines Infopunkts.
 * ctx = { value, age, sex, bmi, hrMax, settings }
 * Rückgabe: { title, badge, what, official: [{label, value, src}], personal, app, caveat, sources }
 */
export function reference(key, ctx = {}) {
  const v = ctx.value;
  const age = ctx.age ?? null;
  const R = REFS[key];
  if (!R) return null;
  const out = R(v, age, ctx);
  const srcKeys = [...new Set((out.official || []).map((o) => o.src).filter(Boolean).concat(out.extraSources || []))];
  return { ...out, sources: srcKeys.map((k) => SOURCES[k]).filter(Boolean) };
}

const REFS = {
  form: (v) => ({
    title: 'Tagesform',
    badge: 'Formkurve',
    what: 'Deine Bereitschaft für heute: Recovery und Schlaf der letzten drei Tage, dazu Belastungsbalance und Langzeit-Fitness.',
    official: [],
    personal: v == null ? null : v >= 67 ? 'Grün: gute Voraussetzungen für hartes Training.' : v >= 34 ? 'Gelb: moderates Training passt.' : 'Rot: Erholung hat heute Vorrang.',
    app: 'Gewichte: Recovery 45 %, Schlaf 25 %, Belastungsbalance 15 %, Langzeit-Fitness 15 %. Grenzen: unter 34 rot, ab 67 grün (änderbar unter Daten → Modell).',
    caveat: 'Für Gesamtscores wie diesen gibt es keine offiziellen Normwerte. Er vergleicht dich mit dir selbst.',
  }),
  recovery: (v) => ({
    title: 'Recovery',
    badge: 'Formkurve',
    what: 'Wie gut sich dein Körper über Nacht erholt hat, gemessen an deinem eigenen Normalbereich der letzten 28 Tage.',
    official: [],
    personal: v == null ? null : `${fmt(v)} von 100. Ein Tag genau auf deinem Normalwert ergibt etwa 50.`,
    app: 'HRV 40 %, Ruhepuls 25 %, Schlaf-Score 20 %, Vitalwerte 10 %, Gefühl aus dem Morgencheck 5 %.',
    caveat: 'Keine offizielle Norm. Die Bestandteile (Ruhepuls, Schlaf, Atemfrequenz, Sauerstoff) haben eigene Infopunkte mit Richtwerten.',
  }),
  sleepScore: (v) => ({
    title: 'Schlaf-Score',
    badge: 'Formkurve',
    what: 'Bewertet Dauer, Effizienz, Tief- und REM-Anteil sowie die Regelmäßigkeit deiner Schlafzeiten.',
    official: [
      { label: 'Schlafdauer Erwachsene', value: '7–9 h (ab 65: 7–8 h)', src: 'nsfDuration' },
      { label: 'Schlafeffizienz', value: 'mindestens 85 %', src: 'nsfQuality' },
      { label: 'Einschlafen', value: 'in 30 Minuten oder weniger', src: 'nsfQuality' },
    ],
    personal: v == null ? null : `${fmt(v)} von 100.`,
    app: 'Dauer gegenüber deinem Schlafbedarf 40 %, Effizienz 20 %, Tief- plus REM-Anteil 20 %, Regelmäßigkeit 20 %.',
  }),
  strain: (v) => ({
    title: 'Strain',
    badge: 'Formkurve',
    what: 'Wie stark dein Körper heute belastet war: Zeit in Pulszonen, dazu ein Zuschlag für Krafttraining.',
    official: [
      { label: 'Bewegung pro Woche', value: '150–300 min moderat oder 75–150 min intensiv', src: 'whoActivity' },
      { label: 'Muskelkräftigung', value: 'an 2 oder mehr Tagen pro Woche', src: 'whoActivity' },
      { label: 'Moderat / intensiv', value: '50–70 % / 70–85 % des Maximalpulses', src: 'aha' },
    ],
    personal: v == null ? null : `${fmt(v)} von 100.`,
    app: 'Puls-Last nach Edwards (Minuten in Zone 1 bis 5 mal 1 bis 5) plus Kraft-Zuschlag (Dauer × RPE × 0,4), logarithmisch auf 0 bis 100.',
    caveat: 'Für einen Tagesscore gibt es keine offizielle Norm; die WHO-Werte sind Wochenziele.',
  }),
  hrv: (v) => {
    const pos = inRange(v, 32, 93);
    return {
      title: 'Herzfrequenzvariabilität (HRV)',
      badge: 'Studie',
      what: 'Schwankung der Abstände zwischen Herzschlägen. Höhere Werte gegenüber deinem Normalwert deuten meist auf gute Erholung hin.',
      official: [
        { label: 'SDNN, Kurzzeitmessung', value: '50 ms im Mittel (Spanne 32–93 ms)', src: 'hrv' },
        { label: 'RMSSD, Kurzzeitmessung', value: '42 ms im Mittel (Spanne 19–75 ms)', src: 'hrv' },
        { label: 'Alter', value: 'HRV sinkt mit zunehmendem Alter', src: 'hrv' },
      ],
      personal: v == null ? null : `Dein Nachtwert: ${fmt(v)} ms${pos === 'in' ? ', innerhalb der Spanne gesunder Erwachsener.' : pos === 'below' ? ', unter der Spanne. Für einzelne Nächte ist das häufig; aussagekräftig ist der Vergleich mit dir selbst.' : ', über der Spanne, wie es bei Trainierten vorkommt.'}`,
      app: 'Formkurve vergleicht die HRV nur mit deinem eigenen Normalbereich (Median der letzten 28 Tage).',
      caveat: 'Es gibt keine amtlichen Normwerte. Apple Health speichert HRV als SDNN; je nach Gerät und Messdauer sind Werte nicht direkt mit Studien vergleichbar.',
    };
  },
  rhr: (v) => ({
    title: 'Ruhepuls',
    badge: 'offiziell',
    what: 'Herzschläge pro Minute in Ruhe. Formkurve nutzt den niedrigen Bereich deines Pulses im Schlaf.',
    official: [
      { label: 'Erwachsene', value: '60–100 Schläge pro Minute', src: 'aha' },
      { label: 'Sportler, sehr aktive Menschen', value: 'bis hinunter auf 40', src: 'aha' },
      { label: 'Durchschnitt gesunder Erwachsener', value: '60–80', src: 'dak' },
      { label: 'Ausdauersportler', value: 'teils 40–50', src: 'dak' },
    ],
    personal: v == null ? null : v < 60 ? `Dein Wert ${fmt(v)} liegt unter 60. Im Schlaf und bei Trainierten ist das typisch.` : v <= 100 ? `Dein Wert ${fmt(v)} liegt im Normalbereich für Erwachsene.` : `Dein Wert ${fmt(v)} liegt über 100. Bleibt der Ruhepuls dauerhaft so hoch, ärztlich abklären lassen.`,
    app: 'Steigt der Ruhepuls über deinen Normalbereich, sinkt die Recovery.',
    caveat: 'Die Richtwerte gelten für den Ruhepuls im Wachzustand; im Schlaf liegt er meist niedriger.',
  }),
  resp: (v) => ({
    title: 'Atemfrequenz',
    badge: 'offiziell',
    what: 'Atemzüge pro Minute, hier im Schlaf gemessen.',
    official: [{ label: 'Unauffällig in Ruhe (NEWS2, 0 Punkte)', value: '12–20 pro Minute', src: 'news2' }],
    personal: v == null ? null : inRange(v, 12, 20) === 'in' ? `Dein Wert ${fmt(v, 1)} liegt im unauffälligen Bereich.` : `Dein Wert ${fmt(v, 1)} liegt außerhalb von 12–20. Im Schlaf sind leicht niedrigere Werte üblich; ein deutlicher Anstieg gegenüber deinem Normalwert kann auf einen Infekt hindeuten.`,
    app: 'Liegt die Atemfrequenz über deinem Normalbereich, zieht das bei den Vitalwerten Punkte ab.',
  }),
  spo2: (v) => ({
    title: 'Blutsauerstoff (SpO₂)',
    badge: 'offiziell',
    what: 'Anteil des mit Sauerstoff beladenen Hämoglobins, mit Licht am Handgelenk geschätzt.',
    official: [
      { label: 'Ideal in Ruhe', value: '95–99 %', src: 'nhsOxi' },
      { label: 'Hausarzt kontaktieren', value: '93–94 % bei wiederholter Messung', src: 'nhsOxi' },
      { label: 'Sofort Hilfe holen', value: '92 % oder weniger', src: 'nhsOxi' },
      { label: 'Unauffällig (NEWS2, 0 Punkte)', value: '96 % oder mehr', src: 'news2' },
    ],
    personal: v == null ? null : v >= 95 ? `Dein Nachtmittel ${fmt(v, 1)} % liegt im idealen Bereich.` : `Dein Nachtmittel ${fmt(v, 1)} % liegt unter 95 %. Wearables messen nachts oft ungenau; wiederholen sich niedrige Werte, ärztlich abklären lassen.`,
    app: 'Fällt SpO₂ deutlich unter deinen Normalwert, ziehen die Vitalwerte Punkte ab.',
    caveat: 'Die NHS-Werte beziehen sich auf Fingerclip-Messungen in Ruhe, nicht auf Messungen am Handgelenk im Schlaf.',
  }),
  temp: (v) => ({
    title: 'Hauttemperatur',
    badge: 'offiziell',
    what: 'Temperatur an der Haut im Schlaf. Entscheidend ist die Abweichung von deinem Normalwert, nicht der absolute Wert.',
    official: [
      { label: 'Erhöhte Temperatur (Fieber)', value: 'meist ab 38 °C Körpertemperatur', src: 'nhsFever' },
      { label: 'Unauffällig (NEWS2, 0 Punkte)', value: '36,1–38,0 °C', src: 'news2' },
    ],
    personal: v == null ? null : `Gemessen: ${fmt(v, 1)} °C an der Haut.`,
    app: 'Weicht die Temperatur mehr als eine übliche Schwankung von deinem Normalwert ab, ziehen die Vitalwerte Punkte ab.',
    caveat: 'Für Hauttemperatur gibt es keine Normwerte; die Grenzen gelten für die Körperkerntemperatur.',
  }),
  asleep: (v, age) => {
    const r = sleepDurationRange(age);
    const h = v != null ? v / 60 : null;
    return {
      title: 'Schlafdauer',
      badge: 'offiziell',
      what: 'Tatsächlich geschlafene Zeit, ohne Wachphasen im Bett.',
      official: [
        { label: '18 bis 64 Jahre', value: '7–9 Stunden', src: 'nsfDuration' },
        { label: '65 Jahre und älter', value: '7–8 Stunden', src: 'nsfDuration' },
      ],
      personal: h == null ? null : r ? `Für dein Alter (${r[2]}): ${r[0]}–${r[1]} Stunden. Letzte Nacht: ${fmt(h, 1)} Stunden.` : `Letzte Nacht: ${fmt(h, 1)} Stunden. Mit deinem Alter im Profil zeigt die App den passenden Bereich.`,
      app: 'Formkurve vergleicht mit deinem persönlichen Schlafbedarf (Basis 8 h, plus Zuschlag nach harten Tagen und Schlafschuld).',
    };
  },
  sleepNeed: (v, age) => {
    const r = sleepDurationRange(age);
    return {
      title: 'Schlafbedarf',
      badge: 'Formkurve',
      what: 'Wie viel Schlaf du heute Nacht brauchst, berechnet aus deiner Basis, der Belastung des Vortags und der Schlafschuld.',
      official: [{ label: 'Empfehlung Erwachsene', value: '7–9 h (ab 65: 7–8 h)', src: 'nsfDuration' }],
      personal: r ? `Für dein Alter empfiehlt die NSF ${r[0]}–${r[1]} Stunden.` : null,
      app: 'Basis (Daten → Profil), plus 0,01 h je Strain-Punkt über 40 am Vortag, plus ein Viertel der Schlafschuld der letzten drei Nächte (höchstens 1,5 h), minus Nickerchen.',
    };
  },
  efficiency: (v) => ({
    title: 'Schlafeffizienz',
    badge: 'offiziell',
    what: 'Anteil der Zeit im Bett, in der du geschlafen hast.',
    official: [{ label: 'Gute Schlafqualität', value: 'mindestens 85 %', src: 'nsfQuality' }],
    personal: v == null ? null : `Letzte Nacht: ${fmt(v * 100)} %${v >= 0.85 ? ', im guten Bereich.' : ', unter 85 %.'}`,
    app: 'Fließt mit 20 % in den Schlaf-Score; 92 % und mehr zählen voll.',
  }),
  latency: (v) => ({
    title: 'Einschlafdauer',
    badge: 'offiziell',
    what: 'Zeit vom Zubettgehen bis zum Einschlafen.',
    official: [{ label: 'Gute Schlafqualität', value: '30 Minuten oder weniger', src: 'nsfQuality' }],
    personal: v == null ? null : `Letzte Nacht: ${fmt(v)} Minuten${v <= 30 ? ', im guten Bereich.' : ', länger als 30 Minuten.'}`,
    app: 'Wird in den Einsichten genutzt, etwa um den Effekt von spätem Koffein oder Bildschirmzeit zu prüfen.',
  }),
  wake: (v) => ({
    title: 'Aufwachphasen',
    badge: 'offiziell',
    what: 'Wie oft du nach dem Einschlafen für mindestens 3 Minuten wach warst.',
    official: [
      { label: 'Gute Schlafqualität', value: 'höchstens einmal pro Nacht aufwachen', src: 'nsfQuality' },
      { label: 'Wachzeit nach dem Einschlafen', value: '20 Minuten oder weniger', src: 'nsfQuality' },
    ],
    personal: v == null ? null : `Letzte Nacht: ${v} Aufwachphase${v === 1 ? '' : 'n'}.`,
    app: 'Fließt über die Effizienz in den Schlaf-Score.',
  }),
  deep: (v, age, ctx) => ({
    title: 'Tiefschlaf',
    badge: 'Fachliteratur',
    what: 'Die erholsamste Schlafphase (N3), vor allem in der ersten Nachthälfte.',
    official: [{ label: 'Anteil am Schlaf, junge Erwachsene', value: '13–23 %', src: 'msd' }],
    personal: ctx.pct == null ? null : `Letzte Nacht: ${fmt(ctx.pct * 100)} % deines Schlafs.${age != null && age >= 40 ? ' Mit dem Alter nimmt der Tiefschlafanteil ab.' : ''}`,
    app: 'Tief- plus REM-Anteil zählen mit 20 % zum Schlaf-Score.',
    caveat: 'Wearables schätzen Schlafphasen aus Puls und Bewegung; die Genauigkeit liegt unter einer Messung im Schlaflabor.',
  }),
  rem: (v, age, ctx) => ({
    title: 'REM-Schlaf',
    badge: 'Fachliteratur',
    what: 'Traumschlaf, vor allem in der zweiten Nachthälfte; wichtig für Gedächtnis und Erholung.',
    official: [{ label: 'Anteil am Schlaf, junge Erwachsene', value: '20–25 %', src: 'msd' }],
    personal: ctx.pct == null ? null : `Letzte Nacht: ${fmt(ctx.pct * 100)} % deines Schlafs.`,
    app: 'Tief- plus REM-Anteil zählen mit 20 % zum Schlaf-Score. Alkohol senkt den REM-Anteil oft messbar.',
    caveat: 'Wearables schätzen Schlafphasen; einzelne Nächte schwanken stark.',
  }),
  regularity: (v) => ({
    title: 'Regelmäßigkeit',
    badge: 'Formkurve',
    what: 'Wie stark deine Einschlaf- und Aufwachzeiten in den letzten 7 Nächten schwanken.',
    official: [],
    personal: v == null ? null : `${fmt(v)} von 100.`,
    app: 'Schwankung bis 20 Minuten = 100, ab 120 Minuten = 0. Fließt mit 20 % in den Schlaf-Score.',
    caveat: 'Für die Regelmäßigkeit gibt es keine offiziellen Grenzwerte.',
  }),
  load: (v) => ({
    title: 'Trainingslast',
    badge: 'Formkurve',
    what: 'Summe der Minuten in den Pulszonen, gewichtet mit 1 bis 5 (Edwards), plus Kraft-Zuschlag.',
    official: [
      { label: 'Bewegung pro Woche', value: '150–300 min moderat oder 75–150 min intensiv', src: 'whoActivity' },
      { label: 'Moderat / intensiv', value: '50–70 % / 70–85 % des Maximalpulses', src: 'aha' },
    ],
    personal: v == null ? null : `Heute: ${fmt(v)}.`,
    app: 'Die Last vor der Umrechnung in den Strain-Score; Grundlage für die Belastungsbalance.',
  }),
  acwr: (v) => ({
    title: 'Belastungsbalance (7 zu 28 Tage)',
    badge: 'Studie',
    what: 'Verhältnis deiner Belastung der letzten 7 Tage zum Durchschnitt der letzten 28 Tage.',
    official: [{ label: 'Bereich mit dem geringsten Verletzungsrisiko', value: '0,8–1,3', src: 'gabbett' }],
    personal: v == null ? null : v > 1.5 ? `Aktuell ${fmt(v, 2)}: deutlich mehr als gewohnt.` : v < 0.8 ? `Aktuell ${fmt(v, 2)}: weniger als gewohnt.` : `Aktuell ${fmt(v, 2)}: im ausgewogenen Bereich.`,
    app: 'Ergibt 15 % der Tagesform. Die Methode ist im Sport verbreitet, fachlich aber umstritten.',
    caveat: 'Keine offizielle Norm, sondern eine Heuristik aus der Sportwissenschaft.',
  }),
  steps: (v, age) => ({
    title: 'Schritte',
    badge: 'Studie',
    what: 'Schritte am Tag, je Tag aus der bevorzugten Quelle (Zepp vor iPhone).',
    official: [
      { label: 'Unter 60 Jahren', value: 'Nutzen steigt bis etwa 8.000–10.000', src: 'steps' },
      { label: 'Ab 60 Jahren', value: 'Nutzen steigt bis etwa 6.000–8.000', src: 'steps' },
      { label: 'Offizielle Empfehlung', value: '150–300 min moderate Bewegung pro Woche', src: 'whoActivity' },
    ],
    personal: v == null ? null : age == null ? `Heute: ${fmt(v)} Schritte.` : `Heute: ${fmt(v)} Schritte; für dein Alter flacht der Nutzen ab etwa ${age >= 60 ? '6.000–8.000' : '8.000–10.000'} ab.`,
    app: 'Fließt in die Einsichten ein (zum Beispiel wenig Schritte und Schlaf).',
    caveat: 'Für Schritte gibt es keine WHO-Zielzahl; die Werte stammen aus einer großen Auswertung zur Sterblichkeit.',
  }),
  activeMin: (v) => ({
    title: 'Aktivminuten',
    badge: 'offiziell',
    what: 'Minuten pro Woche mit erhöhtem Puls.',
    official: [
      { label: 'Erwachsene pro Woche', value: '150–300 min moderat oder 75–150 min intensiv', src: 'whoActivity' },
      { label: 'Zusätzlich', value: 'Muskelkräftigung an 2 oder mehr Tagen', src: 'whoActivity' },
    ],
    personal: v == null ? null : `Letzte 7 Tage: etwa ${fmt(v)} Minuten.`,
    app: 'Formkurve zählt Minuten ab Pulszone 2; Zone 4 und 5 doppelt, Krafttraining mit halber Dauer.',
  }),
  fitness: (v) => ({
    title: 'Langzeit-Fitness',
    badge: 'Formkurve',
    what: 'Ein langsamer Trend aus Ruhepuls, HRV, Aktivität, Regelmäßigkeit und VO₂max. Ein einzelner Tag bewegt ihn kaum.',
    official: [
      { label: 'Bewegung pro Woche', value: '150–300 min moderat oder 75–150 min intensiv', src: 'whoActivity' },
      { label: 'Ruhepuls Erwachsene', value: '60–100, Sportler bis 40', src: 'aha' },
    ],
    personal: v == null ? null : `${fmt(v)} von 100.`,
    app: 'Gleitender Mittelwert mit 42 Tagen Halbwertszeit. Anker: Ruhepuls 42 bpm = 100 und 78 bpm = 0; 300 Aktivminuten pro Woche = 100.',
    caveat: 'Keine offizielle Norm; die Anker sind Startwerte und unter Daten → Modell änderbar.',
  }),
  vo2: (v) => ({
    title: 'VO₂max',
    badge: 'Studie',
    what: 'Maximale Sauerstoffaufnahme, ein Maß für Ausdauer. Das Band schätzt sie aus Puls und Bewegung.',
    official: [{ label: 'Vergleichswerte', value: 'nach Alter und Geschlecht aus Laborbelastungstests', src: 'friend' }],
    personal: v == null ? null : `Schätzung: ${fmt(v, 1)} ml/kg/min.`,
    app: 'Fließt mit 10 % in die Langzeit-Fitness (30 = 0, 60 = 100).',
    caveat: 'Schätzungen von Wearables können deutlich vom Labortest abweichen. Nutze den Verlauf, nicht den Einzelwert.',
  }),
  hrMax: (v, age) => ({
    title: 'Maximalpuls',
    badge: 'Studie',
    what: 'Grundlage der Pulszonen und damit des Strain.',
    official: [
      { label: 'Faustformel', value: '220 − Alter', src: 'aha' },
      { label: 'Genauere Schätzung', value: '208 − 0,7 × Alter', src: 'tanaka' },
    ],
    personal: age == null ? 'Ohne Alter rechnet die App mit 190. Trage dein Geburtsjahr im Profil ein.' : `Für dein Alter (${age}): etwa ${Math.round(208 - 0.7 * age)} (Tanaka) bzw. ${220 - age} (Faustformel).`,
    app: 'Formkurve nutzt 208 − 0,7 × Alter, außer du trägst einen gemessenen Wert ein.',
  }),
  bmi: (v) => ({
    title: 'Body-Mass-Index',
    badge: 'offiziell',
    what: 'Gewicht geteilt durch Größe zum Quadrat.',
    official: [
      { label: 'Normalgewicht', value: '18,5–24,9', src: 'whoBmi' },
      { label: 'Präadipositas', value: '25,0–29,9', src: 'whoBmi' },
      { label: 'Adipositas', value: 'ab 30', src: 'whoBmi' },
    ],
    personal: v == null ? 'Trage Größe und Gewicht im Profil ein, dann berechnet die App den BMI.' : `Dein BMI: ${fmt(v, 1)}.`,
    app: 'Nur zur Einordnung; der BMI fließt in keinen Score ein. Bei viel Muskelmasse ist er wenig aussagekräftig.',
  }),
  pm25: (v) => ({
    title: 'Feinstaub (PM2,5)',
    badge: 'offiziell',
    what: 'Sehr feine Partikel in der Außenluft an deinem Ort (Modelldaten des Copernicus-Dienstes über Open-Meteo).',
    official: [
      { label: 'Tagesmittel', value: 'höchstens 15 µg/m³', src: 'whoAir' },
      { label: 'Jahresmittel', value: 'höchstens 5 µg/m³', src: 'whoAir' },
    ],
    personal: v == null ? null : `Heute: ${fmt(v, 1)} µg/m³${v > 15 ? ', über dem WHO-Richtwert für das Tagesmittel.' : ', unter dem WHO-Richtwert für das Tagesmittel.'}`,
    app: 'In den Einsichten prüft die App, ob Tage über 15 µg/m³ deine HRV oder deinen Schlaf verändern.',
  }),
  pollen: (v) => ({
    title: 'Pollen',
    badge: 'offiziell',
    what: 'Höchste Pollenkonzentration des Tages (Erle, Birke, Gräser, Beifuß, Ambrosia), Modelldaten für Europa.',
    official: [{ label: 'Deutscher Wetterdienst', value: 'Belastungsindex von 0 (keine) bis 3 (hoch)', src: 'dwdPollen' }],
    personal: v == null ? null : `Heute: bis zu ${fmt(v)} Pollen pro m³.`,
    app: 'Formkurve zählt ab 50 Pollen pro m³ als hohe Belastung (eigene Schwelle).',
    caveat: 'Der DWD veröffentlicht keine festen Grenzwerte in Pollen pro m³; wie stark du reagierst, ist individuell.',
  }),
  nightTemp: (v) => ({
    title: 'Nachttemperatur',
    badge: 'offiziell',
    what: 'Tiefste Außentemperatur zwischen 22 und 7 Uhr an deinem Ort.',
    official: [
      { label: 'Tropennacht', value: 'Tiefstwert nicht unter 20 °C', src: 'hlnug' },
      { label: 'Heißer Tag', value: 'mindestens 30 °C', src: 'hlnug' },
    ],
    personal: v == null ? null : `Letzte Nacht: ${fmt(v, 1)} °C${v >= 20 ? ', eine Tropennacht.' : '.'}`,
    app: 'In den Einsichten prüft die App, ob Nächte ab 18 °C deinen Tiefschlaf oder deine Effizienz verändern.',
  }),
  dayTemp: (v) => ({
    title: 'Tageshöchsttemperatur',
    badge: 'offiziell',
    what: 'Höchste Außentemperatur des Tages an deinem Ort.',
    official: [
      { label: 'Heißer Tag', value: 'mindestens 30 °C', src: 'hlnug' },
      { label: 'Tropennacht', value: 'Tiefstwert nicht unter 20 °C', src: 'hlnug' },
    ],
    personal: v == null ? null : `Heute: bis ${fmt(v, 1)} °C${v >= 30 ? ', ein heißer Tag.' : '.'}`,
    app: 'In den Einsichten prüft die App, ob heiße Tage (ab 28 °C) Schlaf, HRV oder Ruhepuls verändern.',
  }),
  humidity: (v) => ({
    title: 'Luftfeuchte nachts',
    badge: 'Formkurve',
    what: 'Mittlere relative Luftfeuchte der Außenluft in der Nacht.',
    official: [],
    personal: v == null ? null : `Letzte Nacht: ${fmt(v)} %.`,
    app: 'In den Einsichten prüft die App schwüle Nächte (ab 85 %).',
    caveat: 'Für Außenluftfeuchte gibt es keine Gesundheits-Richtwerte.',
  }),
  daylight: (v) => ({
    title: 'Tageslänge',
    badge: 'Formkurve',
    what: 'Zeit zwischen Sonnenaufgang und Sonnenuntergang an deinem Ort.',
    official: [],
    personal: v == null ? null : `Heute: ${fmt(v, 1)} Stunden.`,
    app: 'Kurze Tage verschieben bei vielen den Schlaf; die Einsichten prüfen das gegen deine Daten.',
    caveat: 'Für die Tageslänge gibt es keine Richtwerte. Wichtiger ist, wie viel Tageslicht du selbst abbekommst (Frage im Abendcheck).',
  }),
};

export const REFERENCE_KEYS = Object.keys(REFS);
export { sleepDurationRange };
