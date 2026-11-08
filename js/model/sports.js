// Sportarten, die sich eintragen lassen. `kind` ist die grobe Klasse, mit der Strain und
// Logbuch seit jeher rechnen – neue Arten kommen dazu, ohne alte Einträge zu verändern.
// `hr`, `dur`, `spm` (Schritte je Minute) und `hour` sind Startwerte für die Erkennung,
// bevor eigene Einträge vorliegen. Sie werden durch gelernte Werte ersetzt.

export const SPORTS = [
  // Ausdauer
  { id: 'laufen', label: 'Laufen', kind: 'ausdauer', group: 'Ausdauer', hr: 152, dur: 45, spm: 155, hour: 18 },
  { id: 'radfahren', label: 'Radfahren', kind: 'ausdauer', group: 'Ausdauer', hr: 135, dur: 60, spm: 8, hour: 17 },
  { id: 'schwimmen', label: 'Schwimmen', kind: 'ausdauer', group: 'Ausdauer', hr: 135, dur: 45, spm: 5, hour: 18 },
  { id: 'rudern', label: 'Rudern', kind: 'ausdauer', group: 'Ausdauer', hr: 145, dur: 40, spm: 4, hour: 18 },
  { id: 'wandern', label: 'Wandern', kind: 'ausdauer', group: 'Ausdauer', hr: 112, dur: 120, spm: 105, hour: 11 },
  { id: 'gehen', label: 'Spaziergang', kind: 'gehen', group: 'Ausdauer', hr: 100, dur: 35, spm: 100, hour: 15, training: false },
  // Kraft und Studio
  { id: 'kraft', label: 'Kraft', kind: 'kraft', group: 'Kraft und Studio', hr: 118, dur: 65, spm: 18, hour: 18 },
  { id: 'hiit', label: 'HIIT', kind: 'hiit', group: 'Kraft und Studio', hr: 155, dur: 30, spm: 55, hour: 18 },
  { id: 'crossfit', label: 'Crossfit, Zirkel', kind: 'hiit', group: 'Kraft und Studio', hr: 148, dur: 50, spm: 45, hour: 18 },
  { id: 'crosstrainer', label: 'Crosstrainer', kind: 'ausdauer', group: 'Kraft und Studio', hr: 132, dur: 35, spm: 60, hour: 18 },
  // Ballsport
  { id: 'fussball', label: 'Fußball', kind: 'team', group: 'Ballsport', hr: 148, dur: 90, spm: 110, hour: 19 },
  { id: 'basketball', label: 'Basketball', kind: 'team', group: 'Ballsport', hr: 145, dur: 75, spm: 95, hour: 19 },
  { id: 'volleyball', label: 'Volleyball', kind: 'team', group: 'Ballsport', hr: 128, dur: 90, spm: 55, hour: 19 },
  { id: 'handball', label: 'Handball', kind: 'team', group: 'Ballsport', hr: 150, dur: 75, spm: 100, hour: 19 },
  { id: 'tennis', label: 'Tennis', kind: 'team', group: 'Ballsport', hr: 138, dur: 75, spm: 70, hour: 17 },
  { id: 'tischtennis', label: 'Tischtennis', kind: 'team', group: 'Ballsport', hr: 118, dur: 60, spm: 45, hour: 19 },
  { id: 'badminton', label: 'Badminton', kind: 'team', group: 'Ballsport', hr: 140, dur: 60, spm: 75, hour: 19 },
  { id: 'squash', label: 'Squash', kind: 'team', group: 'Ballsport', hr: 155, dur: 45, spm: 85, hour: 18 },
  { id: 'padel', label: 'Padel', kind: 'team', group: 'Ballsport', hr: 135, dur: 75, spm: 70, hour: 18 },
  { id: 'hockey', label: 'Hockey', kind: 'team', group: 'Ballsport', hr: 148, dur: 80, spm: 95, hour: 18 },
  { id: 'golf', label: 'Golf', kind: 'gehen', group: 'Ballsport', hr: 100, dur: 180, spm: 70, hour: 11, training: false },
  // Beweglichkeit und Kampfsport
  { id: 'yoga', label: 'Yoga', kind: 'mobility', group: 'Beweglichkeit', hr: 95, dur: 50, spm: 6, hour: 8 },
  { id: 'pilates', label: 'Pilates', kind: 'mobility', group: 'Beweglichkeit', hr: 105, dur: 50, spm: 8, hour: 9 },
  { id: 'dehnen', label: 'Dehnen, Mobility', kind: 'mobility', group: 'Beweglichkeit', hr: 90, dur: 20, spm: 5, hour: 20 },
  { id: 'tanzen', label: 'Tanzen', kind: 'ausdauer', group: 'Beweglichkeit', hr: 128, dur: 60, spm: 85, hour: 20 },
  { id: 'kampfsport', label: 'Kampfsport', kind: 'hiit', group: 'Beweglichkeit', hr: 150, dur: 75, spm: 60, hour: 19 },
  { id: 'klettern', label: 'Klettern', kind: 'kraft', group: 'Beweglichkeit', hr: 125, dur: 90, spm: 15, hour: 18 },
  { id: 'reiten', label: 'Reiten', kind: 'andere', group: 'Beweglichkeit', hr: 118, dur: 60, spm: 20, hour: 15 },
  { id: 'ski', label: 'Ski, Snowboard', kind: 'ausdauer', group: 'Beweglichkeit', hr: 125, dur: 180, spm: 30, hour: 12 },
  // Alltag und Privates
  { id: 'hausarbeit', label: 'Hausarbeit, Garten', kind: 'andere', group: 'Alltag', hr: 105, dur: 45, spm: 55, hour: 14, training: false },
  { id: 'intim', label: 'Intimität', kind: 'andere', group: 'Alltag', hr: 120, dur: 20, spm: 4, hour: 22, training: false, private: true },
  { id: 'stress', label: 'Stress, Aufregung', kind: null, group: 'Alltag', hr: 105, dur: 25, spm: 10, hour: 14, training: false, noLoad: true },
  { id: 'andere', label: 'Anderes', kind: 'andere', group: 'Alltag', hr: 125, dur: 45, spm: 40, hour: 17 },
];

export const SPORT = Object.fromEntries(SPORTS.map((s) => [s.id, s]));
export const SPORT_GROUPS = [...new Set(SPORTS.map((s) => s.group))];

/** Zählt die Art als Training für Last und Wochenpensum? */
export const isTrainingSport = (id) => SPORT[id]?.training !== false && !SPORT[id]?.noLoad;

/** Sichtbarer Name, auch für alte Einträge mit grober Klasse. */
export function sportLabel(id) {
  if (SPORT[id]) return SPORT[id].label;
  return { kraft: 'Kraft', ausdauer: 'Ausdauer', hiit: 'HIIT', team: 'Teamsport', mobility: 'Mobility, Yoga', gehen: 'Spaziergang', andere: 'Training' }[id] || 'Training';
}

/** Grobe Klasse für Strain und Auswertung. Unbekanntes bleibt, wie es war. */
export function coarseKind(id) {
  if (SPORT[id]) return SPORT[id].kind ?? 'andere';
  return id || 'andere';
}
