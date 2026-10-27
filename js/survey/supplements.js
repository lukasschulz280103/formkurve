// Katalog der Nahrungsergänzungsmittel für die Abendfrage „Supplements heute“.
// Die Kennungen (id) bleiben dauerhaft gleich, damit alte Antworten gültig bleiben.

export const SUPPLEMENT_GROUPS = [
  { key: 'schlaf', label: 'Schlaf und Entspannung', targets: ['latency', 'latencySubj', 'deep', 'sleepScore', 'hrv'] },
  { key: 'training', label: 'Training und Leistung', targets: ['recovery', 'feel', 'hrv', 'rhr'] },
  { key: 'vitamine', label: 'Vitamine', targets: ['feel', 'sleepScore', 'hrv'] },
  { key: 'mineral', label: 'Mineralstoffe und Spurenelemente', targets: ['feel', 'sleepScore', 'hrv'] },
  { key: 'weitere', label: 'Weitere', targets: ['feel', 'sleepScore', 'hrv'] },
  { key: 'eigene', label: 'Eigene', targets: ['feel', 'sleepScore', 'hrv', 'recovery'] },
];

const SLEEP = ['latency', 'latencySubj', 'deep', 'sleepScore', 'hrv'];

export const SUPPLEMENTS = [
  // Schlaf und Entspannung
  { id: 'melatonin', label: 'Melatonin', group: 'schlaf' },
  { id: 'glycin', label: 'Glycin', group: 'schlaf' },
  { id: 'ltheanin', label: 'L-Theanin', group: 'schlaf' },
  { id: 'ashwagandha', label: 'Ashwagandha', group: 'schlaf' },
  { id: 'baldrian', label: 'Baldrian, Hopfen oder Passionsblume', group: 'schlaf' },
  { id: 'lavendel', label: 'Lavendelöl-Kapseln', group: 'schlaf' },
  { id: 'tryptophan', label: 'L-Tryptophan oder 5-HTP', group: 'schlaf' },
  { id: 'gaba', label: 'GABA', group: 'schlaf' },
  { id: 'cbd', label: 'CBD', group: 'schlaf' },
  { id: 'sauerkirsche', label: 'Sauerkirschsaft', group: 'schlaf' },
  { id: 'safran', label: 'Safran-Extrakt', group: 'schlaf' },
  // Training und Leistung
  { id: 'kreatin', label: 'Kreatin', group: 'training' },
  { id: 'protein', label: 'Proteinpulver', group: 'training' },
  { id: 'eaa', label: 'EAA oder BCAA', group: 'training' },
  { id: 'betaalanin', label: 'Beta-Alanin', group: 'training' },
  { id: 'citrullin', label: 'Citrullin oder Arginin', group: 'training' },
  { id: 'rotebete', label: 'Rote-Bete-Saft (Nitrat)', group: 'training' },
  { id: 'preworkout', label: 'Pre-Workout-Booster', group: 'training', targets: ['latency', 'latencySubj', 'deep', 'hrv', 'rhr'] },
  { id: 'elektrolyte', label: 'Elektrolyte', group: 'training' },
  { id: 'kohlenhydrate', label: 'Kohlenhydrat-Gels oder -Drinks', group: 'training' },
  { id: 'hmb', label: 'HMB', group: 'training' },
  { id: 'kollagen', label: 'Kollagen', group: 'training' },
  { id: 'natron', label: 'Natron (Bikarbonat)', group: 'training' },
  { id: 'carnitin', label: 'L-Carnitin', group: 'training' },
  { id: 'taurin', label: 'Taurin', group: 'training' },
  // Vitamine
  { id: 'vitd', label: 'Vitamin D (auch mit K2)', group: 'vitamine' },
  { id: 'b12', label: 'Vitamin B12', group: 'vitamine' },
  { id: 'bkomplex', label: 'Vitamin-B-Komplex', group: 'vitamine' },
  { id: 'vitc', label: 'Vitamin C', group: 'vitamine' },
  { id: 'vite', label: 'Vitamin E', group: 'vitamine' },
  { id: 'folsaeure', label: 'Folsäure', group: 'vitamine' },
  { id: 'multi', label: 'Multivitamin', group: 'vitamine' },
  // Mineralstoffe und Spurenelemente
  { id: 'magnesium', label: 'Magnesium', group: 'mineral', targets: SLEEP },
  { id: 'zink', label: 'Zink', group: 'mineral' },
  { id: 'eisen', label: 'Eisen', group: 'mineral' },
  { id: 'calcium', label: 'Calcium', group: 'mineral' },
  { id: 'kalium', label: 'Kalium', group: 'mineral' },
  { id: 'selen', label: 'Selen', group: 'mineral' },
  { id: 'jod', label: 'Jod', group: 'mineral' },
  // Weitere
  { id: 'omega3', label: 'Omega-3 (Fisch- oder Algenöl)', group: 'weitere', targets: ['hrv', 'recovery', 'feel'] },
  { id: 'probiotika', label: 'Probiotika', group: 'weitere' },
  { id: 'ballaststoffe', label: 'Ballaststoffe (Flohsamen, Inulin)', group: 'weitere' },
  { id: 'q10', label: 'Coenzym Q10', group: 'weitere' },
  { id: 'curcumin', label: 'Kurkuma oder Curcumin', group: 'weitere' },
  { id: 'ingwer', label: 'Ingwer', group: 'weitere' },
  { id: 'rhodiola', label: 'Rhodiola', group: 'weitere' },
  { id: 'ginseng', label: 'Ginseng', group: 'weitere' },
  { id: 'maca', label: 'Maca', group: 'weitere' },
  { id: 'spirulina', label: 'Spirulina oder Chlorella', group: 'weitere' },
  { id: 'nmn', label: 'NMN oder NR', group: 'weitere' },
  { id: 'quercetin', label: 'Quercetin', group: 'weitere' },
  { id: 'gruentee', label: 'Grüntee-Extrakt', group: 'weitere' },
  { id: 'knoblauch', label: 'Knoblauch-Extrakt', group: 'weitere' },
  { id: 'mariendistel', label: 'Mariendistel', group: 'weitere' },
  { id: 'gelenke', label: 'Glucosamin, Chondroitin oder MSM', group: 'weitere' },
];

/** Häufig genutzt: Startauswahl, solange noch nichts angegeben wurde. */
export const STARTER = ['magnesium', 'vitd', 'omega3', 'kreatin', 'zink', 'protein', 'melatonin', 'elektrolyte'];

const BY_ID = new Map(SUPPLEMENTS.map((s) => [s.id, s]));

/** Alle Mittel inklusive der eigenen Einträge aus den Einstellungen. */
export function allSupplements(settings, { includeHidden = false } = {}) {
  const custom = (settings?.survey?.customSupplements || [])
    .filter((c) => c && c.id && c.label && (includeHidden || !c.hidden))
    .map((c) => ({ id: c.id, label: c.label, group: 'eigene' }));
  return SUPPLEMENTS.concat(custom);
}

export function supplementLabel(id, settings) {
  if (BY_ID.has(id)) return BY_ID.get(id).label;
  const c = (settings?.survey?.customSupplements || []).find((x) => x.id === id);
  return c?.label || id;
}

export function supplementTargets(s) {
  if (s.targets) return s.targets;
  return SUPPLEMENT_GROUPS.find((g) => g.key === s.group)?.targets || ['feel', 'sleepScore', 'hrv'];
}

/** Kennung für einen eigenen Eintrag. */
export function customId(label) {
  const slug = String(label)
    .toLocaleLowerCase('de-DE')
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return `c_${slug || 'eigenes'}`;
}

/**
 * Supplements eines Tages. Neue Antworten stehen in SUP; ältere Versionen fragten sie im Ernährungsmodul (E8)
 * und Melatonin bei den Schlafhilfen (S9) ab. Diese alten Antworten werden hier zugeordnet, nie umgeschrieben.
 */
export function supplementsOf(a) {
  if (!a) return undefined;
  if (Array.isArray(a.SUP)) return a.SUP;
  if (a.__noLegacySup) return undefined;
  const out = [];
  let answered = false;
  if (Array.isArray(a.E8) && a.E8.length) {
    answered = true;
    out.push(...a.E8.filter((v) => v !== 'keine' && v !== 'andere'));
  }
  if (Array.isArray(a.S9) && a.S9.includes('melatonin')) {
    answered = true;
    out.push('melatonin');
  }
  if (!answered) return undefined;
  return out.length ? [...new Set(out)] : ['keine'];
}

/** Zuletzt genutzte Mittel (häufigste zuerst) aus den Antworten der letzten Tage. */
export function recentSupplements(survey, date, days = 60, addDaysFn) {
  const count = new Map();
  for (let i = 0; i <= days; i++) {
    const d = addDaysFn(date, -i);
    const list = supplementsOf(survey.get(d)?.a);
    if (!list) continue;
    for (const id of list) if (id !== 'keine') count.set(id, (count.get(id) || 0) + 1);
  }
  return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
}
