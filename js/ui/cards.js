// Welche Karten auf „Heute“ erscheinen. Ausgeblendete stehen in display.cards auf false,
// damit neue Karten künftiger Versionen von selbst sichtbar sind.
// `needs` nennt die Messwerte, ohne die eine Karte leer bliebe – daran erkennt die App,
// welche Karten sich zum Ausblenden anbieten.

export const HOME_CARDS = [
  { id: 'rings', label: 'Ringe: Recovery, Schlaf, Belastung', needs: [], hint: 'Die drei Ringe unter der Tagesform.' },
  { id: 'periods', label: 'Tagesform im Schnitt', needs: [], hint: 'Säulen je Woche oder Monat.' },
  { id: 'contrib', label: 'Was deine Recovery bewegt', needs: [], hint: 'Anteile von HRV, Puls, Schlaf und Gefühl.' },
  { id: 'hints', label: 'Hinweise des Tages', needs: [], hint: 'Kurze Beobachtungen zum Tag.' },
  { id: 'night', label: 'Letzte Nacht', needs: ['hrv', 'hr', 'rhr', 'resp', 'spo2', 'wtemp'], hint: 'HRV, Ruhepuls, Atemfrequenz, Blutsauerstoff, Hauttemperatur.' },
  { id: 'sleep', label: 'Schlaf', needs: ['sleep'], hint: 'Dauer, Effizienz, Tiefschlaf und REM.' },
  { id: 'detect', label: 'War das Sport?', needs: ['hr'], hint: 'Fragt nach, wenn der Puls lange erhöht war, ohne dass ein Training eingetragen ist.' },
  { id: 'load', label: 'Belastung', needs: ['hr', 'steps', 'energy'], hint: 'Last, Aktivminuten, Schritte, Energie, Trainings.' },
  { id: 'environment', label: 'Umwelt', needs: [], hint: 'Wetter, Luft und Pollen am Ort.' },
];

export const CARD = Object.fromEntries(HOME_CARDS.map((c) => [c.id, c]));

/** Ist die Karte eingeschaltet? Unbekannt oder nicht gesetzt heißt sichtbar. */
export function cardOn(settings, id) {
  return settings?.display?.cards?.[id] !== false;
}

/** Neue Einstellungen mit geänderter Sichtbarkeit einer Karte. */
export function withCard(settings, id, on) {
  return { ...settings, display: { ...settings.display, cards: { ...settings.display.cards, [id]: on } } };
}

/**
 * Karten, für die gar keine Messwerte ankommen. `report` ist der Bericht aus
 * model/coverage.js; ohne Bericht gibt es nichts zu empfehlen.
 */
export function emptyCards(report) {
  if (!report?.rows?.length) return [];
  const ok = new Set(report.rows.filter((r) => r.status === 'ok' || r.status === 'partial').map((r) => r.type));
  return HOME_CARDS.filter((c) => c.needs.length && !c.needs.some((t) => ok.has(t))).map((c) => c.id);
}
