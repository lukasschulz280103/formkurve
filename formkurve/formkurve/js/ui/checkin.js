// Ansicht "Check-in": Morgen- und Abendcheck mit Modulen, Vorbelegung und Nachtragen.
import { html, useState, useEffect, useMemo } from '../vendor/preact-htm.js';
import { state, update, saveSurvey, toast, navigate } from './state.js';
import { Topbar, DemoBanner } from './today.js';
import { Segmented, Stepper } from './components.js';
import { Icon } from './icons.js';
import { dayLabel } from './format.js';
import { addDays } from '../core/time.js';
import { visibleSections, optionalModules, prefillValue, isAnswered, slotDone, recordOf } from '../survey/engine.js';
import { QUESTIONS, MODULES } from '../survey/catalog.js';

function defaultSlot() {
  if (state.checkSlot) return state.checkSlot;
  const h = new Date().getHours();
  const morningDone = slotDone(state.repo.survey, state.today, 'morning');
  return h < state.repo.settings.survey.morningUntilHour && !morningDone ? 'morning' : 'evening';
}

function ScaleInput({ q, value, onChange }) {
  const opts = [];
  for (let v = q.min; v <= q.max; v++) opts.push(v);
  const cls = opts.length === 11 ? 'scale n6' : 'scale';
  return html`<div>
    <div class=${cls} role="radiogroup" aria-label=${q.text}>
      ${opts.map((v) => html`<button type="button" class="opt" role="radio" aria-checked=${value === v ? 'true' : 'false'} aria-pressed=${value === v ? 'true' : 'false'} onClick=${() => onChange(value === v ? undefined : v)}>${v}</button>`)}
    </div>
    ${q.labels ? html`<div class="scale-ends" style="margin-top:6px"><span>${q.labels[0]}</span><span>${q.labels[1]}</span></div>` : null}
  </div>`;
}

function ChoiceInput({ q, value, onChange }) {
  const multi = q.type === 'multi';
  const sel = multi ? (Array.isArray(value) ? value : []) : value;
  const toggle = (v) => {
    if (!multi) return onChange(sel === v ? undefined : v);
    let next = sel.includes(v) ? sel.filter((x) => x !== v) : [...sel, v];
    if (q.exclusive) next = v === q.exclusive ? (next.includes(v) ? [v] : []) : next.filter((x) => x !== q.exclusive);
    onChange(next.length ? next : undefined);
  };
  return html`<div class="chips" role=${multi ? 'group' : 'radiogroup'} aria-label=${q.text}>
    ${q.options.map((o) => {
      const on = multi ? sel.includes(o.v) : sel === o.v;
      return html`<button type="button" class="chip" aria-pressed=${on ? 'true' : 'false'} onClick=${() => toggle(o.v)}>${multi && on ? html`<${Icon} name="ok" size=${16} />` : null}${o.label}</button>`;
    })}
  </div>`;
}

function BoolInput({ q, value, onChange }) {
  return html`<div class="yn" role="radiogroup" aria-label=${q.text}>
    <button type="button" class="opt" aria-pressed=${value === true ? 'true' : 'false'} onClick=${() => onChange(value === true ? undefined : true)}>Ja</button>
    <button type="button" class="opt" aria-pressed=${value === false ? 'true' : 'false'} onClick=${() => onChange(value === false ? undefined : false)}>Nein</button>
  </div>`;
}

function Question({ q, value, prefilled, onChange }) {
  const [open, setOpen] = useState(false);
  const id = `q-${q.id}`;
  let input;
  if (q.type === 'scale') input = html`<${ScaleInput} q=${q} value=${value} onChange=${onChange} />`;
  else if (q.type === 'single' || q.type === 'multi') input = html`<${ChoiceInput} q=${q} value=${value} onChange=${onChange} />`;
  else if (q.type === 'bool') input = html`<${BoolInput} q=${q} value=${value} onChange=${onChange} />`;
  else if (q.type === 'number') input = html`<div class="row"><${Stepper} id=${id} value=${value} min=${q.min} max=${q.max} step=${q.step} unit=${q.unit} prefilled=${prefilled} onChange=${onChange} /></div>`;
  else if (q.type === 'time') input = html`<input id=${id} class=${`field${prefilled ? ' prefilled-field' : ''}`} type="time" value=${value || ''} onChange=${(e) => onChange(e.currentTarget.value || undefined)} />`;
  else input = html`<input id=${id} class="field" type="text" value=${value || ''} placeholder=${q.placeholder || ''} onChange=${(e) => onChange(e.currentTarget.value.trim() || undefined)} />`;
  return html`<div class=${`q${prefilled ? ' prefilled' : ''}`}>
    <div class="q-head">
      <label class="q-title" for=${q.type === 'number' || q.type === 'time' || q.type === 'text' ? id : null}>${q.text}</label>
      <div class="row" style="gap:4px">
        ${prefilled ? html`<span class="q-tag">${q.prefill === 'workout' ? 'erkannt' : 'wie zuletzt'}</span>` : q.optional ? html`<span class="q-tag">optional</span>` : null}
        ${q.hint ? html`<button type="button" class="iconbtn" style="width:28px;height:28px" aria-label="Warum diese Frage?" aria-expanded=${open ? 'true' : 'false'} onClick=${() => setOpen(!open)}><${Icon} name="info" size=${17} /></button>` : null}
      </div>
    </div>
    ${open && q.hint ? html`<p class="q-hint">${q.hint}</p>` : null}
    ${input}
  </div>`;
}

export function CheckView() {
  const repo = state.repo;
  const settings = repo.settings;
  const today = state.today;
  const [slot, setSlot] = useState(defaultSlot);
  const [date, setDate] = useState(state.checkDate || today);
  const [draft, setDraft] = useState({});
  const [extra, setExtra] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (state.checkSlot || state.checkDate) update({ checkSlot: null, checkDate: null });
  }, []);

  const record = recordOf(repo.survey, date);
  useEffect(() => {
    setDraft({});
    setExtra([]);
  }, [slot, date]);

  const day = state.results.days.get(date);
  const base = record.a || {};
  const prefills = useMemo(() => {
    const out = {};
    for (const q of QUESTIONS) {
      if (MODULES[q.mod].slot !== slot || base[q.id] !== undefined) continue;
      const v = prefillValue(q, date, repo.survey, day);
      if (v !== undefined) out[q.id] = v;
    }
    return out;
  }, [slot, date, state.version]);

  const answers = { ...prefills, ...base, ...draft };
  for (const [k, v] of Object.entries(draft)) if (v === undefined) delete answers[k];
  const sections = visibleSections(slot, answers, { date, settings, extraModules: extra });
  const optional = optionalModules(slot, answers, { date, settings }).filter((m) => !extra.includes(m.key));
  const visible = sections.flatMap((s) => s.questions);
  const required = visible.filter((q) => !q.optional);
  const answeredCount = required.filter((q) => isAnswered(answers[q.id])).length;
  const done = Boolean(record.ts?.[slot]);

  const setAnswer = (id, v) => setDraft((d) => ({ ...d, [id]: v }));

  const dates = [];
  for (let i = 0; i <= settings.survey.backfillDays; i++) dates.push(addDays(today, -i));

  async function save() {
    setSaving(true);
    try {
      const out = {};
      for (const q of visible) {
        const v = q.id in draft ? draft[q.id] : base[q.id] !== undefined ? base[q.id] : prefills[q.id];
        out[q.id] = isAnswered(v) ? v : undefined;
      }
      const h = new Date().getHours();
      const backfilled = slot === 'morning' ? date < today : date < addDays(today, -1) || (date === addDays(today, -1) && h >= 12);
      await saveSurvey(date, slot, out, backfilled);
      setDraft({});
      toast(slot === 'morning' ? 'Morgencheck gespeichert' : 'Abendcheck gespeichert');
      if (slot === 'morning' && date === today) navigate('heute');
    } catch (e) {
      console.error(e);
      toast('Speichern fehlgeschlagen', 'error');
    } finally {
      setSaving(false);
    }
  }

  const isPrefilled = (q) => !(q.id in draft) && base[q.id] === undefined && prefills[q.id] !== undefined;

  return html`
    <${Topbar} title="Check-in" sub=${`${slot === 'morning' ? 'Morgencheck' : 'Abendcheck'} · ${dayLabel(date, today)}`} />
    <main class="view">
      <${DemoBanner} />
      <div class="check-head">
        <${Segmented} label="Zeitpunkt" value=${slot} onChange=${setSlot} options=${[{ value: 'morning', label: 'Morgen' }, { value: 'evening', label: 'Abend' }]} />
        <div class="datechips" role="group" aria-label="Tag">
          ${dates.map((d) => html`<button type="button" class="datechip" aria-pressed=${d === date ? 'true' : 'false'} onClick=${() => setDate(d)}>
            ${slotDone(repo.survey, d, slot) ? html`<i class="done" aria-label="erledigt"></i>` : null}${dayLabel(d, today)}</button>`)}
        </div>
        ${done ? html`<p class="small muted">Bereits gespeichert. Änderungen überschreiben die Antworten dieses Tages.</p>` : null}
        ${date !== today ? html`<p class="small muted">Nachgetragene Antworten werden markiert, weil die Erinnerung mit der Zeit ungenauer wird.</p>` : null}
      </div>
      ${sections.map((s) => html`<section class="card" aria-labelledby=${`m-${s.key}`}>
        <div class="section-title"><h2 id=${`m-${s.key}`}>${s.title}</h2></div>
        ${s.hint ? html`<p class="small muted" style="margin-bottom:6px">${s.hint}</p>` : null}
        ${s.questions.map((q) => html`<${Question} key=${q.id} q=${q} value=${answers[q.id]} prefilled=${isPrefilled(q)} onChange=${(v) => setAnswer(q.id, v)} />`)}
      </section>`)}
      ${optional.length ? html`<section class="stack">
        <div class="eyebrow">Weitere Module</div>
        <div class="addmods">${optional.map((m) => html`<button type="button" class="chip" onClick=${() => setExtra([...extra, m.key])}><${Icon} name="plus" size=${16} />${m.title}</button>`)}</div>
      </section>` : null}
      <div class="savebar">
        <div class="grow">${answeredCount} von ${required.length} beantwortet${answeredCount < required.length ? ' · Leeres bleibt leer, nicht „Nein“' : ''}</div>
        <button class="btn primary" disabled=${saving} onClick=${save}>${done ? 'Aktualisieren' : 'Speichern'}</button>
      </div>
    </main>`;
}
