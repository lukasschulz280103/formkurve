// Trainings bearbeiten, ohne die Messdaten anzufassen.
//
// Gemessene Einheiten aus Apple Health, Zepp oder Strava bleiben unverändert im Rohbestand.
// Was der Nutzer daran ändert, liegt als kleine Notiz im Logbuch-Tag: ein Feld mit dem
// Namen „wk:<Quelle>|<Startzeit>“. Felder gleichen sich zwischen Geräten schon ab
// (zuletzt gespeichert gewinnt), deshalb braucht es dafür keinen neuen Speicherbereich.
//
// Eine Änderung kann enthalten:
//   sport    andere Sportart
//   t        anderer Beginn (Zeitstempel)
//   durMin   andere Dauer
//   km       Strecke von Hand
//   note     Notiz
//   place    Ort (Text)
//   photos   [{ id, w, h }] – die Bilder selbst liegen lokal im Bereich „media“
//   stress   true = kein Training, sondern Stress oder Hektik
//   deleted  true = ausblenden
//   hides    [Schlüssel] – diese Einheiten sind in dieser aufgegangen
import { setField, fieldValue, entriesOf } from './journal.js';

const isNum = (x) => typeof x === 'number' && Number.isFinite(x);

/** Stabiler Schlüssel einer gemessenen Einheit. */
export const wkKey = (w) => `${(w.src || 'eigen').trim()}|${w.t}`;
const fieldOf = (key) => `wk:${key}`;

/** Änderung zu einer Einheit, oder null. */
export function patchOf(rec, key) {
  const v = fieldValue(rec, fieldOf(key));
  return v && typeof v === 'object' ? v : null;
}

/** Alle Änderungen eines Tages. */
export function patchesOf(rec) {
  const out = {};
  for (const [name, x] of Object.entries(rec?.f || {})) {
    if (!name.startsWith('wk:')) continue;
    if (x?.v && typeof x.v === 'object') out[name.slice(3)] = x.v;
  }
  return out;
}

/** Änderung setzen; `patch` wird mit der bestehenden zusammengeführt, null löscht ein Feld. */
export function setPatch(rec, key, patch, now = Date.now()) {
  const alt = patchOf(rec, key) || {};
  const next = { ...alt, ...patch };
  for (const [k, v] of Object.entries(next)) if (v === null || v === undefined) delete next[k];
  return setField(rec, fieldOf(key), Object.keys(next).length ? next : null, now);
}

/** Änderung ganz zurücknehmen. */
export const clearPatch = (rec, key, now = Date.now()) => setField(rec, fieldOf(key), null, now);

/** Hat der Tag irgendeine Trainingsänderung? Wichtig, damit so ein Tag nicht als leer gilt. */
export const hasPatches = (rec) => Object.keys(patchesOf(rec)).length > 0;

/**
 * Gemessene Einheiten eines Tages mit den Änderungen des Nutzers verrechnet.
 * Gelöschte fallen weg, zusammengelegte verschlucken die anderen.
 */
export function applyPatches(workouts, rec) {
  const patches = patchesOf(rec);
  if (!Object.keys(patches).length) return workouts.map((w) => ({ ...w, key: wkKey(w) }));
  const versteckt = new Set();
  for (const p of Object.values(patches)) for (const k of p.hides || []) versteckt.add(k);
  const out = [];
  for (const w of workouts) {
    const key = wkKey(w);
    if (versteckt.has(key)) continue;
    const p = patches[key];
    if (p?.deleted) continue;
    if (!p) {
      out.push({ ...w, key });
      continue;
    }
    out.push({
      ...w,
      key,
      t: isNum(p.t) ? p.t : w.t,
      durMin: isNum(p.durMin) ? p.durMin : w.durMin,
      sport: p.sport || w.sport,
      kind: p.kind || w.kind,
      km: isNum(p.km) ? p.km : w.km,
      note: p.note || null,
      place: p.place || null,
      photos: p.photos || null,
      stress: p.stress === true,
      merged: (p.hides || []).length || null,
      edited: true,
    });
  }
  return out.sort((a, b) => a.t - b.t);
}

/** Eigene Einheiten aus dem Logbuch, im selben Format wie die gemessenen. */
export function ownSessions(rec, date) {
  const base = new Date(`${date}T00:00:00`).getTime();
  return entriesOf(rec, 'sport').map((e) => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(e.at || '');
    const min = m ? Number(m[1]) * 60 + Number(m[2]) : 12 * 60;
    return {
      key: `logbuch|${e.id}`,
      entryId: e.id,
      t: base + min * 60000,
      durMin: e.min,
      sport: e.sport || e.kind,
      kind: e.kind,
      km: isNum(e.km) ? e.km : null,
      note: e.note || null,
      place: e.place || null,
      photos: e.photos || null,
      rpe: e.rpe ?? null,
      stress: e.stress === true,
      eigen: true,
      src: 'Logbuch',
      date,
    };
  });
}

/**
 * Alles, was an einem Tag an Einheiten existiert: gemessene (mit Änderungen) und eigene,
 * ohne Doppelte. Eine eigene Einheit, die zeitlich zu einer gemessenen passt, fällt weg.
 */
export function sessionsOfDay(workouts, rec, date, nearMin = 45) {
  const gemessen = applyPatches(workouts || [], rec).map((w) => ({ ...w, date, src: w.src || 'Messung' }));
  const eigen = ownSessions(rec, date).filter((e) => !gemessen.some((w) => Math.abs(w.t - e.t) < nearMin * 60000));
  return [...gemessen, ...eigen].sort((a, b) => a.t - b.t);
}

/**
 * Zwei oder mehr Einheiten zu einer zusammenlegen. Die erste führt, die übrigen werden
 * versteckt; Dauer reicht vom frühesten Beginn bis zum spätesten Ende.
 */
export function mergeSessions(rec, list, extra = {}, now = Date.now()) {
  if (list.length < 2) return rec;
  const sorted = [...list].sort((a, b) => a.t - b.t);
  const first = sorted[0];
  const ende = Math.max(...sorted.map((x) => x.t + (x.durMin || 0) * 60000));
  const km = sorted.reduce((s, x) => s + (isNum(x.km) ? x.km : 0), 0);
  let out = rec;
  for (const x of sorted.slice(1)) {
    if (x.eigen) out = setPatch(out, x.key, { deleted: true }, now);
  }
  return setPatch(out, first.key, {
    durMin: Math.round((ende - first.t) / 60000),
    hides: sorted.slice(1).map((x) => x.key),
    km: km > 0 ? Math.round(km * 1000) / 1000 : null,
    ...extra,
  }, now);
}
