// Welche Kacheln der Nutzer gewählt hat, in welcher Reihenfolge und Größe.
// Liegt nur im Browser dieses Geräts; fällt der Speicher aus, gilt die Standardauswahl.
import { TILE } from './tiles.js';

const KEY = 'formkurve.design.favoriten.v1';

export const DEFAULT_LAYOUT = [
  { id: 'form', size: 'gross' },
  { id: 'recovery', size: 'klein' },
  { id: 'sleep', size: 'klein' },
  { id: 'hrv', size: 'klein' },
  { id: 'rhr', size: 'klein' },
  { id: 'steps', size: 'klein' },
  { id: 'strain', size: 'klein' },
];

export function loadLayout() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_LAYOUT.map((x) => ({ ...x }));
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) throw new Error('Format');
    const seen = new Set();
    const out = [];
    for (const x of list) {
      if (!x || !TILE[x.id] || seen.has(x.id)) continue;
      seen.add(x.id);
      out.push({ id: x.id, size: x.size === 'gross' ? 'gross' : 'klein' });
    }
    return out.length ? out : DEFAULT_LAYOUT.map((x) => ({ ...x }));
  } catch {
    return DEFAULT_LAYOUT.map((x) => ({ ...x }));
  }
}

export function saveLayout(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // Privates Fenster oder gesperrter Speicher: die Auswahl gilt dann nur für diesen Besuch
  }
}
