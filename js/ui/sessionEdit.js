// Ein Training bearbeiten: Sportart, Zeit, Dauer, Strecke, Notiz, Ort, Bilder.
// Gemessene Einheiten bleiben unangetastet – gespeichert wird nur, was der Nutzer ändert.
import { html, useState, useEffect, useRef } from '../vendor/preact-htm.js';
import { state, changeJournal, toast } from './state.js';
import { num } from './format.js';
import { Icon } from './icons.js';
import { isNum } from '../core/stats.js';
import { SPORT, coarseKind, sportLabel } from '../model/sports.js';
import { SportPicker } from './workouts.js';
import { setPatch, clearPatch } from '../journal/sessions.js';
import * as J from '../journal/journal.js';

const MIN = 60000;
const hhmm = (ms) => {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
const toMin = (s) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || ''));
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
const MAX_PHOTOS = 4;

/** Bild verkleinern, damit der Gerätespeicher nicht vollläuft. */
async function shrink(file, max = 1280, quality = 0.72) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality));
  return { blob, w, h };
}

/** Vorschaubild aus dem Gerätespeicher. */
export function Photo({ id, alt = '', onRemove = null }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let tot = null;
    state.repo.getPhoto(id).then((blob) => {
      if (!blob) return;
      tot = URL.createObjectURL(blob);
      setUrl(tot);
    }).catch(() => {});
    return () => tot && URL.revokeObjectURL(tot);
  }, [id]);
  if (!url) return html`<span class="photo leer" aria-hidden="true"></span>`;
  return html`<span class="photo"><img src=${url} alt=${alt} loading="lazy" />
    ${onRemove ? html`<button type="button" class="photo-x" onClick=${onRemove} aria-label="Bild entfernen">
      <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" /></svg></button>` : null}
  </span>`;
}

/** Blatt zum Bearbeiten einer Einheit. */
export function SessionEdit({ item, onClose }) {
  const ref = useRef(null);
  const fileRef = useRef(null);
  const [sport, setSport] = useState(item.sport || item.kind || 'andere');
  const [von, setVon] = useState(hhmm(item.t));
  const [dauer, setDauer] = useState(String(Math.round(item.durMin || 0)));
  const [km, setKm] = useState(isNum(item.km) ? String(item.km).replace('.', ',') : '');
  const [note, setNote] = useState(item.note || '');
  const [place, setPlace] = useState(item.place || '');
  const [stress, setStress] = useState(item.stress === true);
  const [photos, setPhotos] = useState(item.photos || []);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    ref.current?.focus();
    return () => window.removeEventListener('keydown', esc);
  }, []);

  const addPhotos = async (files) => {
    const frei = MAX_PHOTOS - photos.length;
    if (frei <= 0) {
      toast(`Höchstens ${MAX_PHOTOS} Bilder je Training`, 'error');
      return;
    }
    setBusy(true);
    try {
      const neu = [];
      for (const f of [...files].slice(0, frei)) {
        if (!f.type.startsWith('image/')) continue;
        const { blob, w, h } = await shrink(f);
        const id = `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
        await state.repo.putPhoto(id, blob);
        neu.push({ id, w, h });
      }
      setPhotos([...photos, ...neu]);
    } catch {
      toast('Das Bild ließ sich nicht lesen', 'error');
    } finally {
      setBusy(false);
    }
  };

  const speichern = async () => {
    const m = toMin(von);
    const dur = Number(String(dauer).replace(',', '.'));
    if (!isNum(m) || !Number.isFinite(dur) || dur <= 0 || dur > 600) {
      toast('Bitte Beginn und Dauer prüfen', 'error');
      return;
    }
    const kmNum = km.trim() ? Number(km.replace(',', '.')) : null;
    if (km.trim() && (!Number.isFinite(kmNum) || kmNum <= 0 || kmNum > 500)) {
      toast('Strecke bitte in Kilometern angeben', 'error');
      return;
    }
    const base = new Date(`${item.date}T00:00:00`).getTime();
    const t = base + m * MIN;
    setBusy(true);
    try {
      await changeJournal(item.date, (rec) => {
        if (item.eigen) {
          return J.updateEntry(rec, item.entryId, {
            kind: coarseKind(sport), sport, min: Math.round(dur), at: von,
            km: kmNum, note: note.trim() || undefined, place: place.trim() || undefined,
            photos: photos.length ? photos : undefined, stress: stress || undefined,
          });
        }
        return setPatch(rec, item.key, {
          sport, kind: coarseKind(sport), t, durMin: Math.round(dur), km: kmNum,
          note: note.trim() || null, place: place.trim() || null,
          photos: photos.length ? photos : null, stress: stress || null,
        });
      });
      toast('Gespeichert');
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const loeschen = async () => {
    setBusy(true);
    try {
      await changeJournal(item.date, (rec) => (item.eigen
        ? J.removeEntry(rec, item.entryId)
        : setPatch(rec, item.key, { deleted: true })));
      toast(item.eigen ? 'Eintrag gelöscht' : 'Training ausgeblendet');
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const zuruecksetzen = async () => {
    setBusy(true);
    try {
      await changeJournal(item.date, (rec) => clearPatch(rec, item.key));
      toast('Änderungen zurückgenommen');
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return html`<div class="sheet-backdrop" onClick=${onClose}>
    <section class="sheet" role="dialog" aria-modal="true" aria-labelledby="se-title" tabIndex="-1" ref=${ref} onClick=${(e) => e.stopPropagation()}>
      <div class="sheet-grip" aria-hidden="true"></div>
      <div class="row between" style="align-items:flex-start">
        <div class="grow">
          <h2 id="se-title">Training bearbeiten</h2>
          <span class="tiny muted">${item.eigen ? 'Eigener Eintrag' : `Gemessen · ${item.src}`}${item.merged ? ` · ${item.merged} zusammengelegt` : ''}</span>
        </div>
        <button class="iconbtn" aria-label="Schließen" onClick=${onClose}><${Icon} name="close" /></button>
      </div>

      <${SportPicker} id="se-sport" value=${sport} onChange=${setSport} top=${[item.sport || item.kind, 'kraft', 'laufen'].filter((x, i, a) => x && a.indexOf(x) === i)} />

      <div class="row" style="gap:8px;flex-wrap:wrap;align-items:flex-end">
        <label>Beginn <input class="field" type="time" value=${von} onInput=${(e) => setVon(e.currentTarget.value)} /></label>
        <label>Dauer (min) <input class="field" type="text" inputmode="numeric" value=${dauer} onInput=${(e) => setDauer(e.currentTarget.value)} style="width:5em" /></label>
        <label>Strecke (km) <input class="field" type="text" inputmode="decimal" placeholder="–" value=${km} onInput=${(e) => setKm(e.currentTarget.value)} style="width:6em" /></label>
      </div>

      <label>Ort <input class="field" type="text" placeholder="z. B. Volkspark, Fitnessstudio" value=${place} onInput=${(e) => setPlace(e.currentTarget.value)} /></label>
      <label>Notiz <textarea class="field" rows="2" placeholder="Wie lief es?" value=${note} onInput=${(e) => setNote(e.currentTarget.value)}></textarea></label>

      <div class="stack-s">
        <span class="small muted">Bilder (${photos.length} von ${MAX_PHOTOS}) – bleiben auf diesem Gerät</span>
        <div class="photos">
          ${photos.map((p) => html`<${Photo} key=${p.id} id=${p.id} alt="Bild zum Training"
            onRemove=${() => { state.repo.delPhoto(p.id).catch(() => {}); setPhotos(photos.filter((x) => x.id !== p.id)); }} />`)}
          ${photos.length < MAX_PHOTOS ? html`<button type="button" class="photo add" onClick=${() => fileRef.current?.click()} aria-label="Bild hinzufügen">
            <${Icon} name="plus" size=${20} /></button>` : null}
        </div>
        <input ref=${fileRef} type="file" accept="image/*" multiple hidden onChange=${(e) => { addPhotos(e.currentTarget.files); e.currentTarget.value = ''; }} />
      </div>

      <div class="list">
        <div class="list-row"><span class="t">Kein Training, sondern Stress</span>
          <input id="se-stress" type="checkbox" class="switch" checked=${stress} onChange=${(e) => setStress(e.currentTarget.checked)} aria-label="Als Stress einsortieren" />
          <span class="d">Zählt dann nicht in Last und Wochenpensum, bleibt aber mit Puls und Dauer sichtbar.</span></div>
      </div>

      <div class="row" style="gap:8px;flex-wrap:wrap">
        <button type="button" class="btn primary" disabled=${busy} onClick=${speichern}>Speichern</button>
        <button type="button" class="btn ghost" disabled=${busy} onClick=${loeschen}>${item.eigen ? 'Löschen' : 'Ausblenden'}</button>
        ${item.edited && !item.eigen ? html`<button type="button" class="btn ghost" disabled=${busy} onClick=${zuruecksetzen}>Auf Messung zurücksetzen</button>` : null}
      </div>
      ${item.eigen ? null : html`<p class="tiny muted">Die Messwerte bleiben unverändert. Gespeichert wird nur, was du hier änderst – das lässt sich jederzeit zurücknehmen.</p>`}
    </section>
  </div>`;
}

/** Eine neue Einheit von Hand anlegen. */
export async function addOwnSession(date, { sport, at, min, km = null, note = '', place = '' }) {
  await changeJournal(date, (rec) => J.addEntry(rec, {
    type: 'sport', kind: coarseKind(sport), sport, min, at,
    km: km || undefined, note: note.trim() || undefined, place: place.trim() || undefined,
  }).rec);
  toast(`${SPORT[sport]?.label || sportLabel(sport)} eingetragen`);
}
