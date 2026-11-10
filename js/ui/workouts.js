// Sport: erkannte Abschnitte bestätigen, Art und Zeitraum wählen, Zusammenfassung lesen.
import { html, useState, useMemo, useEffect, useRef } from '../vendor/preact-htm.js';
import { state, changeJournal, toast, saveSettings } from './state.js';
import { num, hours } from './format.js';
import { isNum } from '../core/stats.js';
import { addDays } from '../core/time.js';
import { hrMaxOf } from '../core/config.js';
import { zoneMinutes } from '../model/scores.js';
import { SPORTS, SPORT, SPORT_GROUPS, sportLabel, coarseKind } from '../model/sports.js';
import { sessionSuggestions, learn, stepsBetween } from '../model/detect.js';
import * as J from '../journal/journal.js';

const MIN = 60000;
const clock = (ms) => new Date(ms).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
const hhmm = (ms) => {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
const toMinutes = (s) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || ''));
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

/** Auswahl der Sportart, nach Gruppen sortiert. Die Vorschläge stehen oben als Knöpfe. */
export function SportPicker({ value, onChange, top = [], id = 'sport' }) {
  const privat = state.repo.settings.survey?.askPrivate !== false;
  const liste = SPORTS.filter((s) => privat || !s.private);
  return html`<div class="stack-s">
    ${top.length ? html`<div class="chips">
      ${top.map((t) => html`<button type="button" key=${t} class="chip small" aria-pressed=${value === t ? 'true' : 'false'}
        onClick=${() => onChange(t)}>${sportLabel(t)}</button>`)}
    </div>` : null}
    <label for=${id} class="small muted">Sportart</label>
    <select id=${id} class="field" value=${value} onChange=${(e) => onChange(e.currentTarget.value)}>
      ${SPORT_GROUPS.map((g) => html`<optgroup key=${g} label=${g}>
        ${liste.filter((s) => s.group === g).map((s) => html`<option key=${s.id} value=${s.id}>${s.label}</option>`)}
      </optgroup>`)}
    </select>
  </div>`;
}

/** Einen bestätigten Abschnitt ins Logbuch schreiben und die Schätzung lernen lassen. */
async function confirmSession(sess, sportId, startHHMM, minutes) {
  const s = SPORT[sportId] || SPORT.andere;
  await changeJournal(sess.date, (rec) => J.addEntry(rec, {
    type: 'sport',
    kind: coarseKind(sportId),
    sport: sportId,
    min: minutes,
    at: startHHMM,
    auto: true,
  }).rec);
  const cur = state.repo.settings.learned || {};
  const model = learn(cur.sport, sportId, { hr: sess.avgHr, dur: minutes, spm: sess.spm, hour: toMinutes(startHHMM) / 60 });
  await saveSettings({ ...state.repo.settings, learned: { ...cur, sport: model } });
  toast(`${s.label} eingetragen. Die Erkennung lernt daraus.`);
}

async function dismissSession(key) {
  const cur = state.repo.settings.learned || {};
  const list = [...(cur.notSport || []), key].slice(-200);
  await saveSettings({ ...state.repo.settings, learned: { ...cur, notSport: list } });
  toast('Gemerkt: kein Sport');
}

/** Ein erkannter Abschnitt mit Vorschlag, Art und Zeitraum zum Ändern. */
function Candidate({ sess }) {
  const [sport, setSport] = useState(sess.guess);
  const [von, setVon] = useState(hhmm(sess.from));
  const [bis, setBis] = useState(hhmm(sess.to));
  const [busy, setBusy] = useState(false);
  const a = toMinutes(von);
  const b = toMinutes(bis);
  const dauer = isNum(a) && isNum(b) ? (b > a ? b - a : b + 1440 - a) : sess.durMin;
  const ok = async () => {
    if (!isNum(a) || dauer < 1 || dauer > 600) {
      toast('Bitte Uhrzeiten prüfen', 'error');
      return;
    }
    setBusy(true);
    try {
      await confirmSession(sess, sport, von, dauer);
    } finally {
      setBusy(false);
    }
  };
  return html`<div class="cand">
    <div class="row between">
      <b>${clock(sess.from)}–${clock(sess.to)}</b>
      <span class="muted small tnum">${num(sess.durMin)} min · Ø ${num(sess.avgHr)} bpm · max ${num(sess.maxHr)}</span>
    </div>
    <p class="small ink2" style="margin:2px 0 8px">
      ${isNum(sess.steps) ? `${num(sess.steps)} Schritte (${num(sess.spm, 0)} je Minute)` : 'Keine Schritte gezählt'}${sess.energy ? ` · ${num(sess.energy)} kcal` : ''}.
      Puls lag über ${num(sess.floor)} bpm.
    </p>
    <${SportPicker} id=${`cand-${sess.key}`} value=${sport} onChange=${setSport} top=${sess.ranked.map((r) => r.id)} />
    <div class="row" style="gap:8px;margin-top:8px;flex-wrap:wrap;align-items:flex-end">
      <label>Von <input class="field" type="time" value=${von} onInput=${(e) => setVon(e.currentTarget.value)} /></label>
      <label>Bis <input class="field" type="time" value=${bis} onInput=${(e) => setBis(e.currentTarget.value)} /></label>
      <span class="muted small tnum">${num(dauer)} min</span>
    </div>
    <div class="row" style="gap:8px;margin-top:10px;flex-wrap:wrap">
      <button type="button" class="btn primary" disabled=${busy} onClick=${ok}>Eintragen</button>
      <button type="button" class="btn ghost" disabled=${busy} onClick=${() => dismissSession(sess.key)}>Kein Sport</button>
    </div>
  </div>`;
}

/** Karte auf „Heute“: Abschnitte mit längerer Belastung, die noch niemand eingetragen hat. */
export function DetectCard({ date }) {
  const repo = state.repo;
  const s = repo.settings;
  const res = state.results;
  const d = res?.days?.get(date);
  const liste = useMemo(() => {
    if (!d || s.model.detect?.on === false) return [];
    const rhr = d.base?.rhr?.median ?? d.rhr;
    if (!isNum(rhr)) return [];
    const known = [
      ...(d.workouts || []).map((w) => ({ from: w.t, to: w.t + (w.durMin || 0) * MIN })),
      ...J.entriesOf(repo.journal?.get(date), 'sport').map((e) => {
        const m = toMinutes(e.at);
        if (!isNum(m)) return null;
        const base = new Date(`${date}T00:00:00`).getTime();
        return { from: base + m * MIN, to: base + (m + (e.min || 0)) * MIN };
      }).filter(Boolean),
    ];
    try {
      return sessionSuggestions({
        index: repo.index,
        date,
        rhr,
        hrMax: hrMaxOf(s),
        known,
        sleep: d.sleep,
        model: s.learned?.sport,
        settings: s,
        skip: s.learned?.notSport || [],
      });
    } catch {
      return [];
    }
  }, [date, state.version, d?.workouts?.length]);
  if (!liste.length) return null;
  return html`<section class="card" aria-labelledby="h-detect">
    <div class="card-head"><h2 id="h-detect">War das Sport?</h2><span class="tiny muted">${liste.length} erkannt</span></div>
    <p class="small ink2" style="margin-bottom:10px">Dein Puls lag über längere Zeit erhöht, ohne dass ein Training eingetragen ist. Sag, was es war – die Erkennung wird davon besser.</p>
    <div class="stack">${liste.map((x) => html`<${Candidate} key=${x.key} sess=${x} />`)}</div>
  </section>`;
}

/** Alle Einheiten der letzten Tage, gemessen wie eingetragen, neueste zuerst. */
export function recentWorkouts(results, repo, today, n = 12) {
  const out = [];
  for (let i = 0; i < 90 && out.length < n * 3; i++) {
    const date = addDays(today, -i);
    const d = results?.days?.get(date);
    if (!d) continue;
    for (const w of d.workouts || []) out.push({ ...w, date, quelle: w.src || 'Messung' });
    for (const e of J.entriesOf(repo.journal?.get(date), 'sport')) {
      const m = toMinutes(e.at);
      const base = new Date(`${date}T00:00:00`).getTime();
      // Eingetragene Einheiten, die zu einer gemessenen passen, stehen nicht doppelt
      const t = base + (isNum(m) ? m : 12 * 60) * MIN;
      if (out.some((w) => w.date === date && Math.abs(w.t - t) < 45 * MIN)) continue;
      out.push({ t, durMin: e.min, kind: e.kind, sport: e.sport, km: e.km ?? null, rpe: e.rpe ?? null, date, quelle: 'Logbuch', eigen: true });
    }
  }
  return out.sort((a, b) => b.t - a.t).slice(0, n);
}

const tempo = (w) => {
  if (!isNum(w.km) || w.km <= 0 || !isNum(w.durMin)) return null;
  const sport = w.sport || w.kind;
  if (['radfahren', 'ski', 'rudern'].includes(sport)) return `${num(w.km / (w.durMin / 60), 1)} km/h`;
  const sec = (w.durMin * 60) / w.km;
  return `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')} min/km`;
};

/** Karte „Letzte Trainings“: alles auf einen Blick, Tippen öffnet die Zusammenfassung. */
export function WorkoutsCard({ onOpen, full = false, Card }) {
  const repo = state.repo;
  const alle = useMemo(() => recentWorkouts(state.results, repo, state.today, full ? 40 : 12), [state.version, state.journalVersion, full]);
  const list = full ? alle : alle.slice(0, 4);
  if (!list.length) return null;
  const woche = alle.filter((w) => w.date > addDays(state.today, -7));
  const kmWoche = woche.reduce((s, w) => s + (isNum(w.km) ? w.km : 0), 0);
  const minWoche = woche.reduce((s, w) => s + (w.durMin || 0), 0);
  const kopf = html`<span class="tiny muted tnum">7 Tage: ${num(Math.round(minWoche))} min${kmWoche > 0 ? ` · ${num(kmWoche, 1)} km` : ''}</span>`;
  return html`<${Card} id="workouts" full=${full} title="Letzte Trainings" sub=${kopf}>
    <div class="wk-list">
      ${list.map((w) => html`<button type="button" class="wk-item" key=${`${w.t}-${w.quelle}`} onClick=${() => onOpen(w)}>
        <span class="wk-when"><b>${sportLabel(w.sport || w.kind)}</b>
          <span class="muted">${new Date(w.date + 'T12:00:00').toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' })} · ${clock(w.t)}</span></span>
        <span class="wk-num tnum">
          <b>${hours(w.durMin)}</b>
          <span class="muted">${[isNum(w.km) && w.km > 0 ? `${num(w.km, 2)} km` : null, tempo(w), isNum(w.avgHr) ? `Ø ${num(w.avgHr)}` : null, isNum(w.kcal) && w.kcal > 0 ? `${num(w.kcal)} kcal` : null].filter(Boolean).join(' · ') || w.quelle}</span>
        </span>
      </button>`)}
    </div>
    ${full ? html`<p class="tiny muted" style="margin-top:8px">Gemessenes und selbst Eingetragenes zusammen. Kilometer kommen aus Apple Health oder Strava; wo das Band keine Strecke liefert, bleibt die Spalte leer.</p>` : null}
    ${!full && alle.length > list.length ? html`<p class="tiny muted" style="margin-top:6px">${alle.length - list.length} weitere in der Seitenansicht.</p>` : null}
  <//>`;
}

const ZONE_LABEL = ['Erholung', 'Grundlage', 'Fettstoffwechsel', 'Tempo', 'Schwelle', 'Maximal'];

/** Zusammenfassung eines Trainings: Zeiten, Puls, Zonen, Schritte, Energie. */
export function WorkoutSheet({ item, date, onClose }) {
  const ref = useRef(null);
  const repo = state.repo;
  const d = state.results.days.get(date);
  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    ref.current?.focus();
    return () => window.removeEventListener('keydown', esc);
  }, []);
  const from = item.t;
  const to = item.t + (item.durMin || 0) * MIN;
  const detail = useMemo(() => {
    const win = repo.index.window('hr', from, to);
    const rhr = d?.base?.rhr?.median ?? d?.rhr ?? 60;
    const zm = win.t.length ? zoneMinutes(win.t, win.e, win.v, { rhr, hrMax: hrMaxOf(repo.settings), gapCapMin: repo.settings.model.strain.gapCapMin, edges: repo.settings.model.strain.zoneEdges }) : null;
    return { zones: zm?.zones || null, steps: stepsBetween(repo.index, from, to), n: win.t.length };
  }, [from, to]);
  const zonen = detail.zones;
  const gesamt = zonen ? zonen.reduce((a, b) => a + b, 0) : 0;
  return html`<div class="scrim" onClick=${(e) => e.target === e.currentTarget && onClose()}>
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="wk-title" tabIndex="-1" ref=${ref}>
      <div class="sheet-head">
        <div>
          <span class="tiny muted">${clock(from)}–${clock(to)}${item.src ? ` · ${item.src}` : ''}</span>
          <h2 id="wk-title">${sportLabel(item.sport || item.kind)}</h2>
        </div>
        <button type="button" class="round" onClick=${onClose} aria-label="Schließen">
          <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" /></svg>
        </button>
      </div>
      <dl class="kv">
        <dt>Dauer</dt><dd>${hours(item.durMin)}</dd>
        ${isNum(item.avgHr) ? html`<dt>Ø Puls</dt><dd>${num(item.avgHr)} bpm</dd>` : null}
        ${isNum(item.maxHr) ? html`<dt>Höchster Puls</dt><dd>${num(item.maxHr)} bpm</dd>` : null}
        ${isNum(detail.steps) ? html`<dt>Schritte</dt><dd>${num(detail.steps)}</dd>` : null}
        ${isNum(item.kcal) && item.kcal > 0 ? html`<dt>Energie</dt><dd>${num(item.kcal)} kcal</dd>` : null}
        ${isNum(item.km) && item.km > 0 ? html`<dt>Strecke</dt><dd>${num(item.km, 2)} km</dd>` : null}
        ${tempo(item) ? html`<dt>Tempo</dt><dd>${tempo(item)}</dd>` : null}
        ${isNum(item.trimp) ? html`<dt>Last dieser Einheit</dt><dd>${num(item.trimp)}</dd>` : null}
      </dl>
      ${gesamt > 0 ? html`<div>
        <b class="small">Zeit in den Pulszonen</b>
        <div class="zonebar" role="img" aria-label=${zonen.map((v, i) => `${ZONE_LABEL[i]} ${Math.round(v)} Minuten`).join(', ')}>
          ${zonen.map((v, i) => (v > 0 ? html`<span key=${i} class=${`z${i}`} style=${`flex:${v}`}></span>` : null))}
        </div>
        <ul class="bullets small" style="margin-top:6px">
          ${zonen.map((v, i) => (v >= 0.5 ? html`<li key=${i}>${ZONE_LABEL[i]}: ${num(v)} min</li>` : null))}
        </ul>
      </div>` : html`<p class="small muted">Für dieses Training liegen keine einzelnen Pulswerte vor.</p>`}
      <p class="tiny muted">Die Zonen rechnen mit deinem Ruhepuls und dem geschätzten Maximalpuls aus den Körperdaten.</p>
    </div>
  </div>`;
}
