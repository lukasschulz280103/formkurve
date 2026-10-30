// Ansicht „Logbuch“: Wasser, Koffein, Glück, Sport, Arbeit und Tagebuch je Tag, dazu ein Rückblick.
import { html, useState, useEffect, useRef, useMemo } from '../vendor/preact-htm.js';
import { state, update, changeJournal, openJournal, toast, patchSettings } from './state.js';
import { DemoBanner } from './today.js';
import { ChartCard, RANGES } from './trends.js';
import { Segmented, Stepper, Switch } from './components.js';
import { TimeChart } from './charts.js';
import { Icon } from './icons.js';
import { InfoButton } from './info.js';
import { num, dayLabel, dateFull, dateLong } from './format.js';
import { addDays, rangeKeys, clockMinutesCentered, hmToMinutes, minutesToHm } from '../core/time.js';
import { hrMaxOf } from '../core/config.js';
import { median } from '../core/stats.js';
import { weekStart, isoWeek } from '../model/periods.js';
import * as J from '../journal/journal.js';

// ---------- Formatierung ----------

export const liters = (ml) => (ml == null ? '–' : ml >= 1000 ? `${num(ml / 1000, ml % 100 === 0 ? 1 : 2)} l` : `${num(ml)} ml`);
const hoursText = (h) => (h == null ? '–' : `${num(h, Number.isInteger(h) ? 0 : 1)} h`);
export const happyBand = (v) => (v == null ? '' : v <= 4 ? 'niedrig' : v <= 6 ? 'mittel' : v <= 8 ? 'hoch' : 'sehr hoch');

const RELATIVE = new Set(['Heute', 'Gestern', 'Vorgestern']);
/** „Heute · Mittwoch, 28. Oktober“ oder nur das Datum. */
const dayTitle = (date, today) => {
  const lbl = dayLabel(date, today);
  return RELATIVE.has(lbl) ? `${lbl} · ${dateFull(date)}` : dateFull(date);
};

const PROMPTS = ['Was war heute gut?', 'Was hat dich heute beschäftigt?', 'Wofür bist du heute dankbar?', 'Was nimmst du aus dem Tag mit?', 'Wie ging es dir heute, und warum?'];

function entryText(x) {
  if (x.type === 'water') return liters(x.ml);
  if (x.type === 'caffeine') return `${J.CAFFEINE_BY_ID[x.kind]?.label || 'Koffein'} · ${num(x.mg)} mg`;
  return `${J.SPORT_BY_ID[x.kind]?.label || 'Sport'} · ${num(x.min)} min${x.rpe != null ? ` · Anstrengung ${x.rpe}` : ''}`;
}

/** Tag, den das Logbuch gerade zeigt (nie in der Zukunft). */
export function journalDateNow() {
  const today = J.journalToday();
  return state.journalDate && state.journalDate < today ? state.journalDate : today;
}

const recOf = (date) => state.repo.journal.get(date) || null;
const workoutsOf = (date) => state.results.days.get(date)?.workouts || [];

/** Uhrzeit für einen neuen Eintrag: jetzt (heute) oder Mittag (nachgetragen). */
function defaultAt(date, fallback = '12:00') {
  return date === J.journalToday() ? J.atOf() : fallback;
}

// ---------- Aktionen ----------

async function addTo(date, entry, label) {
  let id = null;
  await changeJournal(date, (rec) => {
    let next = rec;
    if (entry.type === 'caffeine' && J.fieldValue(rec, 'noCaffeine')) next = J.setField(next, 'noCaffeine', null);
    const r = J.addEntry(next, entry);
    id = r.id;
    return r.rec;
  });
  toast(`${label} eingetragen`, 'ok', { label: 'Rückgängig', run: () => changeJournal(date, (rec) => J.removeEntry(rec, id)) });
  return id;
}

async function removeFrom(date, entry) {
  await changeJournal(date, (rec) => J.removeEntry(rec, entry.id));
  toast(`${entryText(entry)} gelöscht`, 'ok', { label: 'Rückgängig', run: () => changeJournal(date, (rec) => J.restoreEntry(rec, entry).rec) });
}

export async function quickWater(date, ml) {
  return addTo(date, { type: 'water', ml, at: defaultAt(date) }, liters(ml));
}

export async function quickCaffeine(date, kind) {
  const k = J.CAFFEINE_BY_ID[kind] || J.CAFFEINE_BY_ID.kaffee;
  return addTo(date, { type: 'caffeine', kind: k.id, mg: k.mg, at: defaultAt(date, '09:00') }, k.label);
}

// ---------- Bausteine ----------

/** Füllstand gegen ein Ziel oder eine Grenze; über 100 % bleibt die Leiste voll. */
export function Meter({ ratio, label, over = false }) {
  const pct = Math.max(0, Math.min(1, ratio || 0)) * 100;
  return html`<div class=${`meter${over ? ' over' : ''}`} role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow=${Math.round((ratio || 0) * 100)} aria-label=${label}>
    <i style=${`width:${pct}%`}></i>
  </div>`;
}

function CardHead({ id, icon, title, k, value, right, extra }) {
  return html`<div class="card-head j-head">
    <h2 class="row" style="gap:6px"><span class="j-icon" aria-hidden="true"><${Icon} name=${icon} size=${18} /></span><span id=${id}>${title}</span>${k ? html`<${InfoButton} k=${k} value=${value} extra=${extra || {}} label=${title} />` : null}</h2>
    ${right ? html`<span class="tiny muted" style="text-align:right">${right}</span>` : null}
  </div>`;
}

function TimeField({ value, onChange, id }) {
  return html`<input id=${id} class="field" type="time" value=${J.clockOf(value)} onChange=${(e) => {
    const at = J.atFromInput(e.currentTarget.value);
    if (at) onChange(at);
  }} />`;
}

function RpeInput({ value, onChange }) {
  const opts = [];
  for (let v = 1; v <= 10; v++) opts.push(v);
  return html`<div>
    <div class="scale n10" role="radiogroup" aria-label="Anstrengung von 1 bis 10">
      ${opts.map((v) => html`<button type="button" class="opt" role="radio" aria-checked=${value === v ? 'true' : 'false'} aria-pressed=${value === v ? 'true' : 'false'} onClick=${() => onChange(value === v ? undefined : v)}>${v}</button>`)}
    </div>
    <div class="scale-ends" style="margin-top:6px"><span>sehr leicht</span><span>maximal</span></div>
  </div>`;
}

/** Bearbeiten oder Neuanlegen eines Eintrags. entry.id fehlt bei neuen Einträgen. */
function EntryEditor({ date, entry, onClose }) {
  const [draft, setDraft] = useState(entry);
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const isNew = !entry.id;
  const save = async () => {
    const clean = { ...draft };
    delete clean.id;
    delete clean.u;
    if (isNew) await addTo(date, clean, entryText(clean));
    else await changeJournal(date, (rec) => J.updateEntry(rec, entry.id, clean));
    onClose();
  };
  const t = draft.type;
  return html`<div class="j-edit" role="group" aria-label=${isNew ? 'Neuer Eintrag' : 'Eintrag bearbeiten'}>
    ${t === 'caffeine' ? html`<div class="chips" role="group" aria-label="Getränk">
      ${J.CAFFEINE_KINDS.map((k) => html`<button type="button" class="chip small" aria-pressed=${draft.kind === k.id ? 'true' : 'false'} onClick=${() => set({ kind: k.id, mg: draft.kind === k.id ? draft.mg : k.mg })}>${k.label}</button>`)}
    </div>` : null}
    ${t === 'sport' ? html`<div class="chips" role="group" aria-label="Art">
      ${J.SPORT_KINDS.map((k) => html`<button type="button" class="chip small" aria-pressed=${draft.kind === k.id ? 'true' : 'false'} onClick=${() => set({ kind: k.id })}>${k.label}</button>`)}
    </div>` : null}
    <div class="j-edit-row">
      <label class="field-label" style="font-weight:600">Uhrzeit<${TimeField} value=${draft.at} onChange=${(at) => set({ at })} /></label>
      <div class="field-label" style="font-weight:600">${t === 'water' ? 'Menge' : t === 'caffeine' ? 'Koffein' : 'Dauer'}
        ${t === 'water' ? html`<${Stepper} value=${draft.ml} min=${50} max=${2000} step=${50} unit="ml" onChange=${(v) => set({ ml: v ?? 250 })} />` : null}
        ${t === 'caffeine' ? html`<${Stepper} value=${draft.mg} min=${5} max=${500} step=${5} unit="mg" onChange=${(v) => set({ mg: v ?? 80 })} />` : null}
        ${t === 'sport' ? html`<${Stepper} value=${draft.min} min=${5} max=${400} step=${5} unit="min" onChange=${(v) => set({ min: v ?? 30 })} />` : null}
      </div>
    </div>
    ${t === 'sport' ? html`<div class="stack-s"><div class="small" style="font-weight:600">Anstrengung (freiwillig)</div><${RpeInput} value=${draft.rpe} onChange=${(rpe) => set({ rpe })} /></div>` : null}
    ${t === 'caffeine' ? html`<p class="tiny muted">${J.CAFFEINE_BY_ID[draft.kind]?.note || ''}</p>` : null}
    <div class="row wrap">
      <button type="button" class="btn small primary" onClick=${save}>${isNew ? 'Eintragen' : 'Speichern'}</button>
      ${isNew ? null : html`<button type="button" class="btn small danger" onClick=${async () => {
        await removeFrom(date, entry);
        onClose();
      }}>Löschen</button>`}
      <button type="button" class="btn small ghost" onClick=${onClose}>Abbrechen</button>
    </div>
  </div>`;
}

/** Einträge eines Tages, aufklappbar; jeder Eintrag lässt sich bearbeiten oder löschen. */
function EntryList({ date, entries, editing, setEditing, open: openDefault = false, extra = [], noteOf = null }) {
  const [open, setOpen] = useState(openDefault);
  const count = entries.length + extra.length;
  if (!count) return null;
  const shown = open || editing;
  return html`<div class="j-list">
    <button type="button" class="j-list-toggle" aria-expanded=${shown ? 'true' : 'false'} onClick=${() => {
      setOpen(!shown);
      if (shown) setEditing(null);
    }}>
      <${Icon} name=${shown ? 'up' : 'down'} size=${16} />${count} ${count === 1 ? 'Eintrag' : 'Einträge'}
    </button>
    ${shown ? html`<ul class="j-entries">
      ${extra.map((x) => html`<li class="j-entry"><span class="t tnum">${x.time}</span><span class="grow">${x.text}</span><span class="tiny muted">${x.note}</span></li>`)}
      ${entries.map((x) => (editing === x.id
        ? html`<li class="j-entry editing"><${EntryEditor} date=${date} entry=${x} onClose=${() => setEditing(null)} /></li>`
        : html`<li class="j-entry"><span class="t tnum">${J.clockOf(x.at)}</span><span class="grow">${entryText(x)}${noteOf?.(x) ? html`<span class="tiny muted"> · ${noteOf(x)}</span>` : null}</span>
            <button type="button" class="iconbtn" aria-label=${`${entryText(x)} um ${J.clockOf(x.at)} bearbeiten`} onClick=${() => setEditing(x.id)}><${Icon} name="pen" size=${18} /></button></li>`))}
    </ul>` : null}
  </div>`;
}

// ---------- Karten ----------

function WaterCard({ date, rec, settings }) {
  const [editing, setEditing] = useState(null);
  const [custom, setCustom] = useState(null);
  const list = J.entriesOf(rec, 'water');
  const ml = list.length ? J.sum(list, 'ml') : 0;
  const goal = settings.journal.waterGoalMl || 2000;
  const left = goal - ml;
  const { glassMl, bottleMl } = settings.journal;
  const add = async (amount) => {
    const id = await quickWater(date, amount);
    if (date !== J.journalToday()) setEditing(id);
  };
  return html`<section class="card j-card" aria-labelledby="j-water">
    <${CardHead} id="j-water" icon="drop" title="Wasser" k="water" value=${list.length ? ml : null} right=${`Ziel ${liters(goal)}`} />
    <div class="j-figure"><span class="big">${list.length ? liters(ml) : '0 l'}</span><span class="muted small">${list.length ? `${Math.round((ml / goal) * 100)} % vom Ziel` : 'noch nichts eingetragen'}</span></div>
    <${Meter} ratio=${ml / goal} label=${`${liters(ml)} von ${liters(goal)}`} />
    <p class="tiny muted">${left > 0 ? `Noch ${liters(left)} bis zum Ziel.` : 'Ziel erreicht.'} Kaffee und schwarzer Tee stehen beim Koffein.</p>
    <div class="row wrap j-actions">
      <button type="button" class="btn small" onClick=${() => add(glassMl)}><${Icon} name="plus" size=${16} />Glas ${liters(glassMl)}</button>
      <button type="button" class="btn small" onClick=${() => add(bottleMl)}><${Icon} name="plus" size=${16} />Flasche ${liters(bottleMl)}</button>
      <button type="button" class="btn small ghost" aria-expanded=${custom != null ? 'true' : 'false'} onClick=${() => setCustom(custom == null ? 330 : null)}>Andere Menge</button>
    </div>
    ${custom != null ? html`<div class="row wrap" style="gap:8px">
      <${Stepper} value=${custom} min=${50} max=${2000} step=${50} unit="ml" onChange=${(v) => setCustom(v ?? 250)} />
      <button type="button" class="btn small primary" onClick=${async () => {
        await add(custom);
        setCustom(null);
      }}>Eintragen</button>
    </div>` : null}
    <${EntryList} date=${date} entries=${list} editing=${editing} setEditing=${setEditing} />
  </section>`;
}

function useTypicalOnset() {
  return useMemo(() => {
    const out = [];
    const dates = state.results.dates;
    for (let i = dates.length - 1; i >= 0 && out.length < 14; i--) {
      const d = state.results.days.get(dates[i]);
      if (d?.sleep?.onset) out.push(clockMinutesCentered(d.sleep.onset));
    }
    return out.length >= 3 ? median(out) : null;
  }, [state.version]);
}

function favoriteKinds(date) {
  const counts = new Map();
  for (let i = 1; i <= 30; i++) {
    for (const x of J.entriesOf(recOf(addDays(date, -i)), 'caffeine')) counts.set(x.kind, (counts.get(x.kind) || 0) + 1);
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k).filter((k) => J.CAFFEINE_BY_ID[k]);
  return [...new Set([...ranked, 'kaffee', 'espresso', 'milchkaffee', 'schwarztee'])].slice(0, 4);
}

function CaffeineCard({ date, rec }) {
  const [editing, setEditing] = useState(null);
  const [more, setMore] = useState(false);
  const list = J.entriesOf(rec, 'caffeine');
  const mg = J.sum(list, 'mg');
  const none = J.fieldValue(rec, 'noCaffeine') === true && !list.length;
  const last = list.length ? list[list.length - 1].at : null;
  const onset = useTypicalOnset();
  const fav = favoriteKinds(date);
  const kinds = more ? J.CAFFEINE_KINDS.map((k) => k.id) : fav;
  let gapText = null;
  if (last && onset != null) {
    // Beide Zeiten um Mitternacht zentriert (22:50 = −70, 00:30 = 30)
    const gap = onset - (hmToMinutes(last) - 1440);
    if (gap > 0) gapText = `${num(gap / 60, 1)} h vor deiner üblichen Einschlafzeit (${minutesToHm(onset)})`;
  }
  const add = async (kind) => {
    const id = await quickCaffeine(date, kind);
    if (date !== J.journalToday()) setEditing(id);
  };
  const over = mg > J.CAFFEINE_DAY_MAX;
  return html`<section class="card j-card" aria-labelledby="j-caf">
    <${CardHead} id="j-caf" icon="cup" title="Koffein" k="caffeine" value=${list.length ? mg : none ? 0 : null} right="bis 400 mg (EFSA)" />
    <div class="j-figure">
      <span class="big">${num(mg)} mg</span>
      <span class="muted small">${list.length ? `${list.length} ${list.length === 1 ? 'Getränk' : 'Getränke'}` : none ? 'bewusst keins' : 'noch nichts eingetragen'}</span>
      ${over ? html`<span class="status c-warn"><${Icon} name="alert" size=${14} />über 400 mg</span>` : null}
    </div>
    <${Meter} ratio=${mg / J.CAFFEINE_DAY_MAX} over=${over} label=${`${num(mg)} von 400 mg`} />
    ${last ? html`<p class="tiny muted">Zuletzt ${J.clockOf(last)}${gapText ? ` · ${gapText}` : ''}.</p>` : null}
    <div class="chips j-actions" role="group" aria-label="Getränk eintragen">
      ${kinds.map((id) => html`<button type="button" class="chip" onClick=${() => add(id)}><${Icon} name="plus" size=${15} />${J.CAFFEINE_BY_ID[id].label}</button>`)}
      <button type="button" class="chip ghost" aria-expanded=${more ? 'true' : 'false'} onClick=${() => setMore(!more)}>${more ? 'Weniger' : 'Mehr'}</button>
    </div>
    ${!list.length ? html`<button type="button" class="linkbtn" style="justify-self:start" onClick=${() => changeJournal(date, (r) => J.setField(r, 'noCaffeine', none ? null : true))}>${none ? 'Doch Koffein? Markierung entfernen' : date === J.journalToday() ? 'Heute kein Koffein' : 'An diesem Tag kein Koffein'}</button>` : null}
    <${EntryList} date=${date} entries=${list} editing=${editing} setEditing=${setEditing} />
  </section>`;
}

function HappyCard({ date, rec }) {
  const v = J.fieldValue(rec, 'happy');
  const opts = [];
  for (let i = 0; i <= 10; i++) opts.push(i);
  const week = [];
  for (let i = 0; i < 7; i++) {
    const h = J.fieldValue(recOf(addDays(date, -i)), 'happy');
    if (typeof h === 'number') week.push(h);
  }
  const avg = week.length >= 3 ? week.reduce((s, x) => s + x, 0) / week.length : null;
  return html`<section class="card j-card" aria-labelledby="j-happy">
    <${CardHead} id="j-happy" icon="smile" title="Glück" k="happy" value=${v} />
    <p class="q-title" id="j-happy-q">Wie glücklich hast du dich ${date === J.journalToday() ? 'heute' : 'an diesem Tag'} insgesamt gefühlt?</p>
    <div class="scale n11" role="radiogroup" aria-labelledby="j-happy-q">
      ${opts.map((i) => html`<button type="button" class="opt" role="radio" aria-checked=${v === i ? 'true' : 'false'} aria-pressed=${v === i ? 'true' : 'false'} onClick=${() => changeJournal(date, (r) => J.setField(r, 'happy', v === i ? null : i))}>${i}</button>`)}
    </div>
    <div class="scale-ends"><span>gar nicht</span><span>völlig</span></div>
    ${v != null || avg != null ? html`<p class="tiny muted">${v != null ? `${v} von 10: ${happyBand(v)}` : ''}${v != null && avg != null ? ' · ' : ''}${avg != null ? `Schnitt der letzten 7 Tage ${num(avg, 1)}` : ''}</p>` : null}
  </section>`;
}

function SportCard({ date, rec, settings }) {
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);
  const today = J.journalToday();
  const ws = weekStart(date);
  const week = rangeKeys(ws, addDays(ws, 6)).filter((d) => d <= today).map((d) => ({ rec: recOf(d), workouts: workoutsOf(d) }));
  const act = J.weekActivity(week, hrMaxOf(settings));
  const sessions = J.sportSessions(rec, workoutsOf(date));
  const manual = J.entriesOf(rec, 'sport');
  // Gemessene Einheiten (aus Apple Health), daneben die Logbuch-Einträge; passende Paare zeigt die Liste einmal
  const measured = sessions.filter((s) => s.src === 'health');
  const health = (state.results.days.get(date)?.workouts || []).map((w, i) => {
    const s = measured[i];
    return { time: new Date(w.t).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }), text: `${J.SPORT_BY_ID[w.kind]?.label || 'Training'} · ${num(w.durMin)} min${s?.rpe != null ? ` · Anstrengung ${s.rpe}` : ''}`, note: 'gemessen' };
  });
  const dayMin = J.sum(sessions, 'min');
  const blank = { type: 'sport', kind: 'kraft', min: 45, at: defaultAt(date, '18:00') };
  return html`<section class="card j-card" aria-labelledby="j-sport">
    <${CardHead} id="j-sport" icon="dumbbell" title="Sport" k="sportWeek" value=${act.equivalent} />
    <div class="j-figure"><span class="big">${num(dayMin)} min</span><span class="muted small">${sessions.length ? `${sessions.length} ${sessions.length === 1 ? 'Einheit' : 'Einheiten'} an diesem Tag` : 'noch keine Einheit an diesem Tag'}</span></div>
    <div class="j-week">
      <div class="row between tiny"><span class="ink2">${ws === weekStart(today) ? 'Diese Woche' : `KW ${isoWeek(ws).week}`} (WHO)</span><span class="ink2 tnum">${num(act.equivalent)} / 150 min</span></div>
      <${Meter} ratio=${act.equivalent / 150} label=${`${num(act.equivalent)} von 150 Minuten in der Woche`} />
      <p class="tiny muted">Mo–So ${num(act.total)} min, davon ${num(act.vigorous)} intensiv (zählen doppelt) · Krafttage ${act.strengthDays} von 2</p>
    </div>
    <${EntryList} date=${date} entries=${manual} extra=${health} open=${true} editing=${editing} setEditing=${setEditing}
      noteOf=${(m) => (sessions.some((s) => s.src === 'health' && s.id === m.id) ? 'gleiche Einheit wie gemessen, zählt einmal' : null)} />
    ${adding ? html`<${EntryEditor} date=${date} entry=${blank} onClose=${() => setAdding(false)} />`
      : html`<button type="button" class="btn small" style="justify-self:start" onClick=${() => setAdding(true)}><${Icon} name="plus" size=${16} />Einheit eintragen</button>`}
  </section>`;
}

function WorkCard({ date, rec }) {
  const v = J.fieldValue(rec, 'work');
  const ws = weekStart(date);
  let weekSum = 0;
  let weekDays = 0;
  for (const d of rangeKeys(ws, addDays(ws, 6))) {
    const h = J.fieldValue(recOf(d), 'work');
    if (typeof h === 'number') {
      weekSum += h;
      weekDays++;
    }
  }
  const set = (h) => changeJournal(date, (r) => J.setField(r, 'work', h));
  return html`<section class="card j-card" aria-labelledby="j-work">
    <${CardHead} id="j-work" icon="briefcase" title="Arbeit" k="work" value=${v} right=${weekDays ? `Woche ${hoursText(weekSum)}` : null} />
    <div class="row wrap" style="gap:12px">
      <${Stepper} id="j-work-h" value=${v} min=${0} max=${16} step=${0.5} unit="Stunden" onChange=${(x) => set(x ?? null)} />
      ${v != null && v > 10 ? html`<span class="status c-warn"><${Icon} name="alert" size=${14} />über 10 h</span>` : null}
    </div>
    <div class="chips" role="group" aria-label="Schnellauswahl Stunden">
      ${[0, 4, 6, 8, 9, 10].map((h) => html`<button type="button" class="chip small" aria-pressed=${v === h ? 'true' : 'false'} onClick=${() => set(v === h ? null : h)}>${h === 0 ? 'frei' : `${h} h`}</button>`)}
    </div>
    <p class="tiny muted">Reine Arbeitszeit ohne Pausen; Lernen zählt mit, wenn du magst.</p>
  </section>`;
}

function DiaryCard({ date, rec }) {
  const saved = J.fieldValue(rec, 'text') || '';
  const [text, setText] = useState(saved);
  const [status, setStatus] = useState('');
  const timer = useRef(null);
  const dirty = useRef(false);
  const focused = useRef(false);
  const textRef = useRef(saved);
  const dateRef = useRef(date);

  const flush = () => {
    clearTimeout(timer.current);
    if (!dirty.current) return;
    dirty.current = false;
    const d = dateRef.current;
    const v = textRef.current;
    setStatus('Speichert …');
    changeJournal(d, (r) => J.setField(r, 'text', v.trim() ? v : null))
      .then(() => setStatus('Gespeichert'))
      .catch(() => setStatus('Nicht gespeichert'));
  };

  useEffect(() => {
    if (dateRef.current !== date) {
      flush();
      dateRef.current = date;
      textRef.current = saved;
      setText(saved);
      setStatus('');
      return;
    }
    // Von einem anderen Gerät geändert: übernehmen, solange hier niemand schreibt
    if (!dirty.current && !focused.current && saved !== textRef.current) {
      textRef.current = saved;
      setText(saved);
    }
  }, [date, saved]);
  useEffect(() => () => flush(), []);

  const note = state.repo.survey.get(date)?.a?.A12n;
  const prompt = PROMPTS[Number(date.slice(8, 10)) % PROMPTS.length];
  return html`<section class="card j-card" aria-labelledby="j-diary">
    <${CardHead} id="j-diary" icon="pen" title="Tagebuch" right=${status} />
    <label class="sr" for="j-text">Tagebuch für ${dateFull(date)}</label>
    <textarea id="j-text" class="field j-text" rows="6" maxlength="20000" placeholder=${prompt} value=${text}
      onFocus=${() => (focused.current = true)}
      onBlur=${() => {
        focused.current = false;
        flush();
      }}
      onInput=${(e) => {
        const v = e.currentTarget.value;
        textRef.current = v;
        setText(v);
        dirty.current = true;
        setStatus('');
        clearTimeout(timer.current);
        timer.current = setTimeout(flush, 900);
      }}></textarea>
    ${note ? html`<div class="j-note"><div class="eyebrow">Notiz aus dem Abendcheck</div><p class="small ink2">${note}</p></div>` : null}
    <p class="tiny muted"><${Icon} name="lock" size=${13} /> Verschlüsselt auf deinem Gerät gespeichert${state.sync?.linked ? ', im Online-Konto Ende-zu-Ende verschlüsselt' : ''}.</p>
  </section>`;
}

export function JournalSettings({ settings }) {
  const j = settings.journal;
  return html`<details class="card more">
    <summary>Logbuch-Einstellungen <${Icon} name="down" size=${18} /></summary>
    <div class="j-settings">
      <div class="j-setting"><label for="j-goal">Trinkziel am Tag</label><${Stepper} id="j-goal" value=${j.waterGoalMl} min=${500} max=${6000} step=${100} unit="ml" onChange=${(v) => patchSettings('journal.waterGoalMl', v ?? 2000)} /></div>
      <p class="tiny muted">Startwert 2 l. Die DGE nennt rund 1,5 l aus Getränken, die EFSA 2,0 l (Frauen) und 2,5 l (Männer) Wasser insgesamt, also mit dem Wasser aus dem Essen. Bei Hitze und Sport mehr.</p>
      <div class="j-setting"><label for="j-glass">Glas</label><${Stepper} id="j-glass" value=${j.glassMl} min=${100} max=${600} step=${50} unit="ml" onChange=${(v) => patchSettings('journal.glassMl', v ?? 250)} /></div>
      <div class="j-setting"><label for="j-bottle">Flasche</label><${Stepper} id="j-bottle" value=${j.bottleMl} min=${250} max=${1500} step=${50} unit="ml" onChange=${(v) => patchSettings('journal.bottleMl', v ?? 500)} /></div>
      <div class="j-setting"><label for="j-today">Logbuch auf „Heute“ zeigen</label><${Switch} id="j-today" checked=${j.showOnToday} label="Logbuch auf Heute zeigen" onChange=${(on) => patchSettings('journal.showOnToday', on)} /></div>
    </div>
  </details>`;
}

// ---------- Rückblick ----------

function daySeries(dates, settings) {
  const hrMax = hrMaxOf(settings);
  return dates.map((d) => {
    const rec = recOf(d);
    const s = J.daySummary(rec);
    const day = state.results.days.get(d);
    const sessions = J.sportSessions(rec, day?.workouts || []);
    const worn = (day?.hrCoverageMin ?? 0) >= 600;
    const sport = sessions.length ? J.sum(sessions, 'min') : worn || (rec && !J.isEmptyDay(rec)) ? 0 : null;
    return { date: d, rec, s, sport, hrMax };
  });
}

function Tile({ label, value, sub }) {
  return html`<div class="j-tile-stat"><div class="tiny muted">${label}</div><div class="v">${value}</div>${sub ? html`<div class="tiny muted">${sub}</div>` : null}</div>`;
}

const meanOf = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);

function DiaryList({ today }) {
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(15);
  const repo = state.repo;
  const items = useMemo(() => {
    const out = [];
    const keys = new Set([...repo.journal.keys()]);
    for (const [d, rec] of repo.survey) if (rec?.a?.A12n) keys.add(d);
    for (const d of keys) {
      if (d > today) continue;
      const text = J.fieldValue(repo.journal.get(d), 'text');
      const note = repo.survey.get(d)?.a?.A12n || null;
      if (!(typeof text === 'string' && text.trim()) && !note) continue;
      out.push({ date: d, text: typeof text === 'string' ? text.trim() : '', note, happy: J.fieldValue(repo.journal.get(d), 'happy') });
    }
    return out.sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [state.journalVersion, state.version]);
  const q = query.trim().toLocaleLowerCase('de-DE');
  const filtered = q ? items.filter((x) => `${x.text} ${x.note || ''} ${dateFull(x.date)}`.toLocaleLowerCase('de-DE').includes(q)) : items;
  return html`<section class="card" aria-labelledby="j-diary-list">
    <div class="card-head"><h2 id="j-diary-list">Tagebuch</h2><span class="tiny muted">${items.length} ${items.length === 1 ? 'Eintrag' : 'Einträge'}</span></div>
    ${items.length ? html`<div class="j-search"><${Icon} name="search" size=${17} /><input class="field" type="search" placeholder="Im Tagebuch suchen" aria-label="Im Tagebuch suchen" value=${query} onInput=${(e) => setQuery(e.currentTarget.value)} /></div>` : html`<p class="small muted">Noch keine Einträge. Schreib unter „Tag“, was dir wichtig war.</p>`}
    <div class="j-diary-items">
      ${filtered.slice(0, limit).map((x) => html`<button type="button" class="j-diary-item" onClick=${() => openJournal(x.date)}>
        <div class="row between"><b>${RELATIVE.has(dayLabel(x.date, today)) ? html`${dayLabel(x.date, today)} <span class="muted" style="font-weight:500">${dateLong(x.date)}</span>` : dateLong(x.date)}</b>${x.happy != null ? html`<span class="tiny muted nowrap">Glück ${x.happy}</span>` : null}</div>
        <p class="small ink2 j-clamp">${x.text || x.note}</p>
      </button>`)}
    </div>
    ${q && !filtered.length ? html`<p class="small muted">Nichts gefunden.</p>` : null}
    ${filtered.length > limit ? html`<button type="button" class="btn small ghost" onClick=${() => setLimit(limit + 30)}>Ältere anzeigen</button>` : null}
  </section>`;
}

function Review({ settings }) {
  const [range, setRange] = useState(30);
  const today = J.journalToday();
  const n = range || 90;
  const dates = rangeKeys(addDays(today, -(n - 1)), today);
  const rows = daySeries(dates, settings);
  const water = rows.map((r) => (r.s?.waterMl != null ? r.s.waterMl / 1000 : null));
  const caffeine = rows.map((r) => r.s?.caffeineMg ?? null);
  const happy = rows.map((r) => r.s?.happy ?? null);
  const sport = rows.map((r) => r.sport);
  const work = rows.map((r) => r.s?.work ?? null);
  const vals = (arr) => arr.filter((x) => x != null);
  const has = (arr) => arr.some((x) => x != null);
  const goalL = (settings.journal.waterGoalMl || 2000) / 1000;
  // Wochen ab dem ersten Tag mit Wert, damit ein neues Logbuch nicht künstlich niedrig wirkt
  const weeksOf = (arr) => {
    const first = arr.findIndex((x) => x != null);
    return first < 0 ? 1 : Math.max(1, (n - first) / 7);
  };
  const f1 = (v) => num(v, 1);
  const f0 = (v) => num(v);
  const workDays = vals(work).filter((h) => h > 0);
  const anything = [water, caffeine, happy, work].some(has) || rows.some((r) => r.s?.sportN);

  // Wochen im Überblick (neueste zuerst)
  const weekRows = [];
  for (let i = 0; i < 8; i++) {
    const start = addDays(weekStart(today), -7 * i);
    const days = daySeries(rangeKeys(start, addDays(start, 6)).filter((d) => d <= today), settings);
    const w = days.map((r) => r.s?.waterMl).filter((x) => x != null);
    const c = days.map((r) => r.s?.caffeineMg).filter((x) => x != null);
    const h = days.map((r) => r.s?.happy).filter((x) => x != null);
    const sp = days.map((r) => r.sport).filter((x) => x != null);
    const wk = days.map((r) => r.s?.work).filter((x) => x != null);
    if (!w.length && !c.length && !h.length && !wk.length && !days.some((r) => r.s?.sportN)) continue;
    weekRows.push({ label: `KW ${isoWeek(start).week}${addDays(start, 6) > today ? '*' : ''}`, partial: addDays(start, 6) > today, water: meanOf(w), caffeine: meanOf(c), happy: meanOf(h), sport: sp.length ? sp.reduce((s, x) => s + x, 0) : null, work: wk.length ? wk.reduce((s, x) => s + x, 0) : null });
  }

  return html`
    <${Segmented} label="Zeitraum" options=${RANGES.filter((r) => r.value !== 0)} value=${range} onChange=${setRange} />
    ${!anything ? html`<section class="card"><p class="muted">In diesem Zeitraum steht noch nichts im Logbuch.</p></section>` : html`
      <section class="card" aria-label="Durchschnitt im Zeitraum">
        <div class="j-tiles-stat">
          <${Tile} label="Wasser je Tag" value=${vals(water).length ? `${num(meanOf(vals(water)), 1)} l` : '–'} sub=${`an ${vals(water).length} Tagen`} />
          <${Tile} label="Koffein je Tag" value=${vals(caffeine).length ? `${num(meanOf(vals(caffeine)))} mg` : '–'} sub=${`an ${vals(caffeine).length} Tagen`} />
          <${Tile} label="Glück" value=${vals(happy).length ? num(meanOf(vals(happy)), 1) : '–'} sub=${vals(happy).length ? `${happyBand(Math.round(meanOf(vals(happy))))} · ${vals(happy).length} Tage` : 'noch nicht bewertet'} />
          <${Tile} label="Sport je Woche" value=${vals(sport).length ? `${num(vals(sport).reduce((s, x) => s + x, 0) / weeksOf(sport))} min` : '–'} sub="mit Apple Health" />
          <${Tile} label="Arbeit je Woche" value=${workDays.length ? hoursText(Math.round((vals(work).reduce((s, x) => s + x, 0) / weeksOf(work)) * 2) / 2) : '–'} sub=${workDays.length ? `Ø ${num(meanOf(workDays), 1)} h an ${workDays.length} Arbeitstagen` : 'nichts eingetragen'} />
        </div>
      </section>
      <p class="tiny muted" style="margin:-4px 2px 0"><i class="weekend-key" aria-hidden="true"></i>Hinterlegt: Wochenende (Sa, So).</p>
      ${has(water) ? html`<${ChartCard} id="j-water-chart" title="Wasser" sub=${`Liter je Tag; Linie = dein Ziel (${num(goalL, 1)} l)`} info=${{ k: 'water', value: null }}
        table=${{ dates, columns: [{ label: 'Wasser l', values: water, fmt: (v) => num(v, 2) }] }}>
        <${TimeChart} label="Wasser je Tag" dates=${dates} refLines=${[{ y: goalL }]} yDomain=${[0, Math.max(goalL * 1.25, ...vals(water)) ]}
          series=${[{ key: 'w', label: 'Wasser', values: water, type: 'bar', color: 'var(--ink-2)' }]} fmt=${(v) => `${num(v, 1)} l`} tickFmt=${f1} />
      <//>` : null}
      ${has(caffeine) ? html`<${ChartCard} id="j-caf-chart" title="Koffein" sub="Milligramm je Tag; Linie = 400 mg, Tageswert laut EFSA" info=${{ k: 'caffeine', value: null }}
        table=${{ dates, columns: [{ label: 'Koffein mg', values: caffeine, fmt: f0 }, { label: 'Getränke', values: rows.map((r) => r.s?.caffeineN ?? null), fmt: f0 }, { label: 'zuletzt', values: rows.map((r) => (r.s?.caffeineLast ? hmToMinutes(r.s.caffeineLast) : null)), fmt: minutesToHm }] }}>
        <${TimeChart} label="Koffein je Tag" dates=${dates} refLines=${[{ y: 400 }]} yDomain=${[0, Math.max(450, ...vals(caffeine)) * 1.05]}
          series=${[{ key: 'c', label: 'Koffein', values: caffeine, type: 'bar', color: 'var(--ink-2)' }]} fmt=${(v) => `${num(v)} mg`} tickFmt=${f0} />
      <//>` : null}
      ${has(happy) ? html`<${ChartCard} id="j-happy-chart" title="Glück" sub="0 = gar nicht, 10 = völlig; ab 7 zählt als hoch (ONS)" info=${{ k: 'happy', value: null }}
        table=${{ dates, columns: [{ label: 'Glück', values: happy, fmt: f0 }] }}>
        <${TimeChart} label="Glück je Tag" dates=${dates} yDomain=${[0, 10]} yTicks=${[0, 4, 7, 10]}
          series=${[{ key: 'h', label: 'Glück', values: happy, color: 'var(--ink)' }]} fmt=${f0} />
      <//>` : null}
      ${has(sport) && vals(sport).some((x) => x > 0) ? html`<${ChartCard} id="j-sport-chart" title="Sport" sub="Minuten je Tag aus Apple Health und Logbuch" info=${{ k: 'sportWeek', value: null }}
        table=${{ dates, columns: [{ label: 'Sport min', values: sport, fmt: f0 }] }}>
        <${TimeChart} label="Sport je Tag" dates=${dates} yDomain=${[0, Math.max(60, ...vals(sport)) * 1.1]}
          series=${[{ key: 's', label: 'Sport', values: sport, type: 'bar', color: 'var(--ink-2)' }]} fmt=${(v) => `${num(v)} min`} tickFmt=${f0} />
      <//>` : null}
      ${has(work) ? html`<${ChartCard} id="j-work-chart" title="Arbeit" sub="Stunden je Tag; Linie = 8 h je Werktag (Arbeitszeitgesetz)" info=${{ k: 'work', value: null }}
        table=${{ dates, columns: [{ label: 'Arbeit h', values: work, fmt: f1 }] }}>
        <${TimeChart} label="Arbeitsstunden je Tag" dates=${dates} refLines=${[{ y: 8 }]} yDomain=${[0, Math.max(10, ...vals(work)) * 1.05]}
          series=${[{ key: 'a', label: 'Arbeit', values: work, type: 'bar', color: 'var(--ink-2)' }]} fmt=${(v) => `${num(v, 1)} h`} tickFmt=${f0} />
      <//>` : null}
      ${weekRows.length ? html`<section class="card" aria-labelledby="j-weeks">
        <div class="card-head"><h2 id="j-weeks">Wochen im Überblick</h2><span class="tiny muted">Ø je Tag, Summen je Woche</span></div>
        <div class="tablewrap"><table class="data compact">
          <thead><tr><th>Woche</th><th>Wasser</th><th>Koffein</th><th>Glück</th><th>Sport</th><th>Arbeit</th></tr></thead>
          <tbody>${weekRows.map((w) => html`<tr><td>${w.label}</td><td>${w.water == null ? '–' : `${num(w.water / 1000, 1)} l`}</td><td>${w.caffeine == null ? '–' : `${num(w.caffeine)} mg`}</td><td>${w.happy == null ? '–' : num(w.happy, 1)}</td><td>${w.sport == null ? '–' : `${num(w.sport)} min`}</td><td>${w.work == null ? '–' : hoursText(w.work)}</td></tr>`)}</tbody>
        </table></div>
        ${weekRows.some((w) => w.partial) ? html`<p class="tiny muted" style="margin-top:6px">* Woche läuft noch.</p>` : null}
      </section>` : null}
    `}
    <${DiaryList} today=${today} />`;
}

// ---------- Ansicht ----------

export function JournalView() {
  const settings = state.repo.settings;
  const today = J.journalToday();
  const date = journalDateNow();
  const rec = recOf(date);
  const tab = state.journalTab === 'rueckblick' ? 'rueckblick' : 'tag';
  const go = (n) => {
    const next = addDays(date, n);
    update({ journalDate: next >= today ? null : next });
  };
  useEffect(() => {
    window.scrollTo?.(0, 0);
  }, [tab]);
  return html`
    <header class="topbar">
      ${tab === 'tag' ? html`<button class="iconbtn" aria-label="Vortag" onClick=${() => go(-1)}><${Icon} name="left" /></button>` : null}
      <div class="grow" style=${tab === 'tag' ? 'text-align:center' : ''}>
        <h1>Logbuch</h1>
        <div class="sub">${tab === 'tag' ? dayTitle(date, today) : 'Rückblick'}</div>
      </div>
      ${tab === 'tag' ? html`<button class="iconbtn" aria-label="Folgetag" disabled=${date >= today} onClick=${() => go(1)}><${Icon} name="right" /></button>` : null}
    </header>
    <main class="view">
      <${DemoBanner} />
      <${Segmented} label="Ansicht" value=${tab} onChange=${(v) => update({ journalTab: v })} options=${[{ value: 'tag', label: 'Tag' }, { value: 'rueckblick', label: 'Rückblick' }]} />
      ${tab === 'tag' ? html`
        ${date !== today ? html`<div class="banner"><${Icon} name="info" size=${18} /><div class="grow">Du trägst für <b>${dateFull(date)}</b> nach. Neue Einträge bekommen eine Uhrzeit, die du anpassen kannst. <button class="linkbtn" onClick=${() => update({ journalDate: null })}>Zu heute</button></div></div>` : null}
        <${WaterCard} date=${date} rec=${rec} settings=${settings} />
        <${CaffeineCard} date=${date} rec=${rec} />
        <${HappyCard} date=${date} rec=${rec} />
        <${SportCard} date=${date} rec=${rec} settings=${settings} />
        <${WorkCard} date=${date} rec=${rec} />
        <${DiaryCard} key=${date} date=${date} rec=${rec} />
        <${JournalSettings} settings=${settings} />
        <p class="tiny muted" style="margin:0 2px">Ein Logbuch-Tag geht bis 4 Uhr früh. Was du nach Mitternacht einträgst, zählt noch zum Vortag.</p>
      ` : html`<${Review} settings=${settings} />`}
    </main>`;
}

// ---------- Karte auf „Heute“ ----------

export function JournalToday() {
  const settings = state.repo.settings;
  if (!settings.journal.showOnToday) return null;
  const date = J.journalToday();
  const s = J.daySummary(recOf(date)) || {};
  const sessions = J.sportSessions(recOf(date), workoutsOf(date));
  const sportMin = sessions.length ? J.sum(sessions, 'min') : null;
  const fav = favoriteKinds(date)[0];
  const tiles = [
    { icon: 'drop', label: 'Wasser', value: s.waterMl != null ? liters(s.waterMl) : '–' },
    { icon: 'cup', label: 'Koffein', value: s.caffeineMg != null ? `${num(s.caffeineMg)} mg` : '–' },
    { icon: 'smile', label: 'Glück', value: s.happy != null ? `${s.happy}` : '–' },
    { icon: 'dumbbell', label: 'Sport', value: sportMin != null ? `${num(sportMin)} min` : '–' },
    { icon: 'briefcase', label: 'Arbeit', value: s.work != null ? hoursText(s.work) : '–' },
  ];
  return html`<section class="card j-today" aria-labelledby="j-today-h">
    <div class="card-head" style="margin-bottom:10px"><h2 id="j-today-h">Logbuch</h2><button type="button" class="linkbtn" style="padding:0" onClick=${() => openJournal()}>Öffnen</button></div>
    <div class="j-mini">
      ${tiles.map((t) => html`<button type="button" class="j-mini-tile" aria-label=${`${t.label}: ${t.value}. Logbuch öffnen`} onClick=${() => openJournal()}>
        <${Icon} name=${t.icon} size=${17} /><b>${t.value}</b><span>${t.label}</span>
      </button>`)}
    </div>
    <div class="row wrap" style="gap:8px;margin-top:10px">
      <button type="button" class="btn small" onClick=${() => quickWater(date, settings.journal.glassMl)}><${Icon} name="plus" size=${16} />Glas Wasser</button>
      <button type="button" class="btn small" onClick=${() => quickCaffeine(date, fav)}><${Icon} name="plus" size=${16} />${J.CAFFEINE_BY_ID[fav].label}</button>
    </div>
  </section>`;
}
