// Check-in als Blatt über allen Reitern: Kernfragen zuerst, danach optionale Fragen nach Wichtigkeit; Vorbelegung und Nachtragen.
import { html, useState, useEffect, useMemo, useRef } from '../vendor/preact-htm.js';
import { state, update, saveSurvey, saveSettings, toast, navigate, openJournal, openCheck, closeCheck, takeCheckOpener, openChecks } from './state.js';
import { DemoBanner } from './today.js';
import { Segmented, Stepper } from './components.js';
import { Icon } from './icons.js';
import { dayLabel } from './format.js';
import { addDays } from '../core/time.js';
import { setPath } from '../core/config.js';
import { checkPlan, hiddenByCondition, prefillValue, isAnswered, slotDone, recordOf, DEPTH } from '../survey/engine.js';
import { QUESTIONS, MODULES, NONE } from '../survey/catalog.js';
import { SUPPLEMENT_GROUPS, STARTER, allSupplements, supplementLabel, recentSupplements, customId } from '../survey/supplements.js';
import { journalAnswers, daySummary, clockOf, SPORT_BY_ID, DAY_START_HOUR } from '../journal/journal.js';
import { liters } from './journalView.js';
import { num } from './format.js';

/** Was das Logbuch an diesem Tag schon beantwortet; diese Fragen entfallen im Abendcheck. */
function FromJournal({ date, jd, rec }) {
  const s = daySummary(rec) || {};
  const a = jd.answers;
  const rows = [];
  if (jd.covered.has('A6')) rows.push(['Getrunken', liters(s.waterMl)]);
  if (jd.covered.has('A4')) rows.push(['Koffein', a.A4 === 0 ? 'keins' : `${a.A4} ${a.A4 === 1 ? 'Getränk' : 'Getränke'} · ${num(s.caffeineMg)} mg · zuletzt ${clockOf(a.A4t)}`]);
  if (jd.covered.has('A7')) rows.push(['Training', `${(a.T1 || []).map((k) => SPORT_BY_ID[k]?.label || k).join(', ')} · ${a.T13} min${a.T2 != null ? ` · Anstrengung ${a.T2}` : ''}`]);
  if (!rows.length) return null;
  return html`<section class="card j-from" aria-labelledby="j-from-h">
    <div class="section-title"><h2 id="j-from-h">Aus dem Logbuch</h2><button type="button" class="linkbtn" style="padding:0" onClick=${() => openJournal(date)}>Ändern</button></div>
    <dl class="kv">${rows.map(([k, v]) => html`<dt>${k}</dt><dd>${v}</dd>`)}</dl>
    <p class="tiny muted">Diese Fragen entfallen heute. Es zählt, was im Logbuch steht.</p>
  </section>`;
}

/**
 * Welcher Check gerade dran ist. Nach Mitternacht (bis 4 Uhr, wie im Logbuch) gehört der Abend noch zum Vortag;
 * der Morgencheck kommt erst nach dem Aufstehen.
 */
export function currentCheck(now = new Date()) {
  const repo = state.repo;
  const h = now.getHours();
  const today = state.today;
  if (h < DAY_START_HOUR) {
    const y = addDays(today, -1);
    return { slot: 'evening', date: y, due: !slotDone(repo.survey, y, 'evening') };
  }
  if (h < repo.settings.survey.morningUntilHour && !slotDone(repo.survey, today, 'morning')) return { slot: 'morning', date: today, due: true };
  return { slot: 'evening', date: today, due: h >= 18 && !slotDone(repo.survey, today, 'evening') };
}

function defaultSlot() {
  return state.checkSlot || currentCheck().slot;
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

function toggleIn(list, v, exclusive) {
  let next = list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
  if (exclusive) next = v === exclusive ? (next.includes(v) ? [v] : []) : next.filter((x) => x !== exclusive);
  return next.length ? next : undefined;
}

function ChoiceInput({ q, value, onChange }) {
  const multi = q.type === 'multi';
  const sel = multi ? (Array.isArray(value) ? value : []) : value;
  const toggle = (v) => (multi ? onChange(toggleIn(sel, v, q.exclusive)) : onChange(sel === v ? undefined : v));
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

/** Auswahl aus über 50 Supplements: zuletzt genutzte oben, alle nach Gruppen, Suche und eigene Einträge. */
function SupplementInput({ q, value, onChange }) {
  const settings = state.repo.settings;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [custom, setCustom] = useState('');
  const sel = Array.isArray(value) ? value : [];
  const all = allSupplements(settings);
  const recent = useMemo(() => recentSupplements(state.repo.survey, state.today, 60, addDays), [state.version]);
  const quick = [...new Set([...sel.filter((id) => id !== NONE), ...recent, ...(recent.length >= 4 ? [] : STARTER)])].slice(0, Math.max(8, sel.length));
  const toggle = (id) => onChange(toggleIn(sel, id, NONE));
  const chip = (id, label = supplementLabel(id, settings)) => {
    const on = sel.includes(id);
    return html`<button type="button" class="chip" aria-pressed=${on ? 'true' : 'false'} onClick=${() => toggle(id)}>${on ? html`<${Icon} name="ok" size=${16} />` : null}${label}</button>`;
  };
  const needle = query.trim().toLocaleLowerCase('de-DE');
  const filtered = needle ? all.filter((s) => s.label.toLocaleLowerCase('de-DE').includes(needle)) : all;
  const addCustom = async () => {
    const label = custom.trim().slice(0, 40);
    if (label.length < 2) return;
    const known = all.find((s) => s.label.toLocaleLowerCase('de-DE') === label.toLocaleLowerCase('de-DE'));
    let id = known?.id;
    if (!id) {
      const list = settings.survey.customSupplements || [];
      const hidden = list.find((c) => c.hidden && c.label.toLocaleLowerCase('de-DE') === label.toLocaleLowerCase('de-DE'));
      if (hidden) {
        id = hidden.id;
        await saveSettings(setPath(settings, 'survey.customSupplements', list.map((c) => (c.id === id ? { ...c, hidden: false } : c))));
      } else {
        const taken = allSupplements(settings, { includeHidden: true });
        id = customId(label);
        let n = 2;
        while (taken.some((s) => s.id === id)) id = `${customId(label)}-${n++}`;
        await saveSettings(setPath(settings, 'survey.customSupplements', [...list, { id, label }]));
      }
    }
    setCustom('');
    if (!sel.includes(id)) onChange(toggleIn(sel, id, NONE));
  };
  return html`<div class="stack-s">
    <div class="chips" role="group" aria-label=${q.text}>${chip(NONE, 'keine')}${quick.map((id) => chip(id))}</div>
    <button type="button" class="linkbtn" style="justify-self:start" aria-expanded=${open ? 'true' : 'false'} onClick=${() => setOpen(!open)}>${open ? 'Weniger anzeigen' : `Alle ${all.length} Mittel anzeigen`}</button>
    ${open ? html`<div class="supp-all">
      <input class="field" type="search" placeholder="Suchen, z. B. Zink" aria-label="Supplements durchsuchen" value=${query} onInput=${(e) => setQuery(e.currentTarget.value)} />
      ${SUPPLEMENT_GROUPS.map((g) => {
        const items = filtered.filter((s) => s.group === g.key);
        if (!items.length) return null;
        return html`<div class="supp-group"><div class="eyebrow">${g.label}</div><div class="chips">${items.map((s) => chip(s.id, s.label))}</div></div>`;
      })}
      ${!filtered.length ? html`<p class="small muted">Nichts gefunden. Unten kannst du es als eigenes Mittel anlegen.</p>` : null}
      <div class="row" style="gap:8px">
        <input class="field grow" type="text" maxlength="40" placeholder="Eigenes Mittel, z. B. Eisen + Vitamin C" aria-label="Eigenes Mittel" value=${custom} onInput=${(e) => setCustom(e.currentTarget.value)} onKeyDown=${(e) => e.key === 'Enter' && addCustom()} />
        <button type="button" class="btn small" disabled=${custom.trim().length < 2} onClick=${addCustom}><${Icon} name="plus" size=${16} />Hinzufügen</button>
      </div>
    </div>` : null}
  </div>`;
}

function Question({ q, value, prefilled, onChange, tag, boosted }) {
  const [open, setOpen] = useState(false);
  const id = `q-${q.id}`;
  let input;
  if (q.type === 'scale') input = html`<${ScaleInput} q=${q} value=${value} onChange=${onChange} />`;
  else if (q.type === 'supplements') input = html`<${SupplementInput} q=${q} value=${value} onChange=${onChange} />`;
  else if (q.type === 'single' || q.type === 'multi') input = html`<${ChoiceInput} q=${q} value=${value} onChange=${onChange} />`;
  else if (q.type === 'bool') input = html`<${BoolInput} q=${q} value=${value} onChange=${onChange} />`;
  else if (q.type === 'number') input = html`<div class="row"><${Stepper} id=${id} value=${value} min=${q.min} max=${q.max} step=${q.step} unit=${q.unit} prefilled=${prefilled} onChange=${onChange} /></div>`;
  else if (q.type === 'time') input = html`<input id=${id} class=${`field${prefilled ? ' prefilled-field' : ''}`} type="time" value=${value || ''} onChange=${(e) => onChange(e.currentTarget.value || undefined)} />`;
  else input = html`<input id=${id} class="field" type="text" value=${value || ''} placeholder=${q.placeholder || ''} onChange=${(e) => onChange(e.currentTarget.value.trim() || undefined)} />`;
  const area = tag && !q.text.toLocaleLowerCase('de-DE').includes(tag.toLocaleLowerCase('de-DE')) ? tag : null;
  const label = prefilled ? (q.prefill === 'workout' ? 'erkannt' : 'wie zuletzt') : boosted ? 'heute vorgeschlagen' : area;
  return html`<div class=${`q${prefilled ? ' prefilled' : ''}`}>
    <div class="q-head">
      <label class="q-title" for=${q.type === 'number' || q.type === 'time' || q.type === 'text' ? id : null}>${q.text}</label>
      <div class="row" style="gap:4px">
        ${label ? html`<span class="q-tag">${label}</span>` : null}
        ${q.hint ? html`<button type="button" class="iconbtn" style="width:28px;height:28px" aria-label="Warum diese Frage?" aria-expanded=${open ? 'true' : 'false'} onClick=${() => setOpen(!open)}><${Icon} name="info" size=${17} /></button>` : null}
      </div>
    </div>
    ${open && q.hint ? html`<p class="q-hint">${q.hint}</p>` : null}
    ${input}
  </div>`;
}

// Angefangene Antworten je Zeitpunkt und Tag: Wer das Blatt schließt oder kurz ins Logbuch springt, verliert nichts.
const drafts = new Map();

/** Check-in als Blatt über dem aktuellen Reiter (Morgen- und Abendcheck, Nachtragen der letzten Tage). */
export function CheckSheet() {
  const repo = state.repo;
  const settings = repo.settings;
  const today = state.today;
  const [slot, setSlot] = useState(defaultSlot);
  const [date, setDate] = useState(() => state.checkDate || (state.checkSlot ? today : currentCheck().date));
  const key = `${slot}|${date}`;
  const [draft, setDraftState] = useState(() => drafts.get(key) || {});
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const ref = useRef(null);

  const setDraft = (fn) => setDraftState((d) => {
    const next = typeof fn === 'function' ? fn(d) : fn;
    if (Object.keys(next).length) drafts.set(key, next);
    else drafts.delete(key);
    return next;
  });

  useEffect(() => {
    if (state.checkSlot || state.checkDate) update({ checkSlot: null, checkDate: null });
    // Seite dahinter festhalten, Fokus ins Blatt, Escape schließt
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const back = takeCheckOpener();
    const where = `${state.route}/${state.sub}`;
    ref.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape' && !state.info) closeCheck();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
      // Erst nach dem Neuzeichnen, wenn der Hintergrund wieder bedienbar ist; nicht nach einem Wechsel des Reiters
      setTimeout(() => {
        if (back?.isConnected && `${state.route}/${state.sub}` === where) back.focus?.({ preventScroll: true });
      }, 0);
    };
  }, []);

  const record = recordOf(repo.survey, date);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setDraftState(drafts.get(key) || {});
    setExpanded(false);
    ref.current?.scrollTo?.(0, 0);
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

  // Abends: Was im Logbuch steht (Wasser, Koffein, Training), fragt der Check nicht noch einmal
  const jrec = repo.journal.get(date) || null;
  const jd = slot === 'evening' ? journalAnswers(jrec, day?.workouts || []) : { answers: {}, covered: new Set() };
  const answers = { ...prefills, ...base, ...draft };
  for (const [k, v] of Object.entries(draft)) if (v === undefined) delete answers[k];
  Object.assign(answers, jd.answers);
  const plan = checkPlan(slot, answers, { date, settings, survey: repo.survey, covered: jd.covered });
  const depth = DEPTH[settings.survey.depth] ?? DEPTH.standard;
  // Schon beantwortete optionale Fragen bleiben sichtbar, auch wenn sie sonst eingeklappt wären
  const answeredOpt = plan.optional.filter((x) => isAnswered(base[x.q.id]) || x.q.id in draft);
  const firstOpt = plan.optional.filter((x, i) => i < depth || answeredOpt.includes(x));
  const shownOpt = expanded ? plan.optional : firstOpt;
  const moreCount = plan.optional.length - shownOpt.length;
  const visible = plan.core.concat(shownOpt.map((x) => x.q));
  const answeredCount = plan.core.filter((q) => isAnswered(answers[q.id])).length;
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
      // Folgefragen, deren Bedingung nicht mehr gilt (z. B. Alkohol jetzt „Nein“): alte Antwort entfernen
      for (const q of hiddenByCondition(slot, answers, { date, settings, survey: repo.survey, covered: jd.covered })) if (base[q.id] !== undefined) out[q.id] = undefined;
      const h = new Date().getHours();
      const backfilled = slot === 'morning' ? date < today : date < addDays(today, -1) || (date === addDays(today, -1) && h >= 12);
      await saveSurvey(date, slot, out, backfilled);
      drafts.delete(key);
      toast(slot === 'morning' ? 'Morgencheck gespeichert' : 'Abendcheck gespeichert');
      // Nach dem Morgencheck gleich die Scores zeigen
      if (slot === 'morning' && date === today) navigate('heute');
      else closeCheck();
    } catch (e) {
      console.error(e);
      toast('Speichern fehlgeschlagen', 'error');
      setSaving(false);
    }
  }

  const isPrefilled = (q) => !(q.id in draft) && base[q.id] === undefined && prefills[q.id] !== undefined;
  const seconds = Math.max(10, Math.round((plan.core.length * 5) / 5) * 5);
  const pending = Object.keys(draft).length;

  return html`<div class="check-sheet" role="dialog" aria-modal="true" aria-labelledby="check-title" tabindex="-1" ref=${ref}>
    <header class="sheet-head">
      <div class="grow">
        <h1 id="check-title">Check-in</h1>
        <div class="sub">${slot === 'morning' ? 'Morgencheck' : 'Abendcheck'} · ${dayLabel(date, today)}${pending ? ' · nicht gespeichert' : ''}</div>
      </div>
      <button type="button" class="iconbtn" aria-label=${pending ? 'Schließen, Eingaben bleiben bis zum Speichern erhalten' : 'Schließen'} onClick=${closeCheck}><${Icon} name="close" /></button>
    </header>
    <div class="view sheet-body">
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
      ${slot === 'evening' ? html`<${FromJournal} date=${date} jd=${jd} rec=${jrec} />` : null}
      <section class="card" aria-labelledby="m-core">
        <div class="section-title"><h2 id="m-core">Kernfragen</h2><span class="tiny muted">etwa ${seconds} Sekunden</span></div>
        <p class="small muted" style="margin-bottom:6px">${slot === 'morning' ? 'Direkt nach dem Aufwachen, bevor du die Scores siehst.' : 'Was heute war. Beeinflusst die kommende Nacht.'}</p>
        ${plan.core.map((q) => html`<${Question} key=${q.id} q=${q} value=${answers[q.id]} prefilled=${isPrefilled(q)} onChange=${(v) => setAnswer(q.id, v)} />`)}
      </section>
      ${plan.optional.length ? html`<section class="card" aria-labelledby="m-opt">
        <div class="section-title"><h2 id="m-opt">Optional</h2><span class="tiny muted">wichtigste zuerst</span></div>
        <p class="small muted" style="margin-bottom:6px">Je mehr du hier beantwortest, desto mehr Einflüsse kann die App prüfen. Überspringen ist in Ordnung.</p>
        ${shownOpt.map(({ q, boosted }) => html`<${Question} key=${q.id} q=${q} value=${answers[q.id]} prefilled=${isPrefilled(q)} tag=${q.mod === 'morning' || q.mod === 'evening' ? null : MODULES[q.mod].title} boosted=${boosted} onChange=${(v) => setAnswer(q.id, v)} />`)}
        ${moreCount > 0 ? html`<button type="button" class="btn block ghost" style="margin-top:10px" onClick=${() => setExpanded(true)}><${Icon} name="plus" size=${16} />Weitere Fragen (${moreCount})</button>`
          : expanded && plan.optional.length > firstOpt.length ? html`<button type="button" class="btn block ghost" style="margin-top:10px" onClick=${() => setExpanded(false)}>Weniger anzeigen</button>` : null}
      </section>` : null}
      ${slot === 'evening' ? html`<section class="card row between" style="gap:12px">
        <div class="grow"><h3>Tagebuch</h3><p class="small muted">Notizen zum Tag schreibst du im Logbuch. Deine Antworten hier bleiben bis zum Speichern erhalten.</p></div>
        <button type="button" class="btn small" onClick=${() => openJournal(date)}><${Icon} name="pen" size=${16} />Schreiben</button>
      </section>` : null}
      <div class="savebar">
        <div class="grow">${answeredCount} von ${plan.core.length} Kernfragen${answeredCount < plan.core.length ? ' · Leeres bleibt leer, nicht „Nein“' : ''}</div>
        <button class="btn primary" disabled=${saving} onClick=${save}>${done ? 'Aktualisieren' : 'Speichern'}</button>
      </div>
    </div>
  </div>`;
}

/** Schwebender Knopf in allen Reitern; zeigt, wenn ein Check fällig ist. Beim Herunterscrollen schrumpft er auf das Symbol. */
export function CheckFab() {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      if (Math.abs(y - last) < 12) return;
      setCompact(y > last && y > 120);
      last = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  // Bleibt unter dem offenen Blatt bestehen, damit der Fokus beim Schließen hierher zurückfindet
  if (!state.repo) return null;
  const cur = currentCheck();
  const open = openChecks();
  const label = cur.due ? (cur.slot === 'morning' ? 'Morgencheck' : 'Abendcheck') : null;
  // Was jetzt dran ist; sonst der neueste offene Check, zum Beispiel der Morgencheck am Nachmittag
  const target = cur.due ? cur : open[0] || cur;
  const n = open.length;
  return html`<button type="button" class=${`fab${label ? ' due' : ''}${compact ? ' compact' : ''}`}
    aria-label=${`${label ? `${label} öffnen, fällig` : 'Check-in öffnen'}${n ? `, ${n} ${n === 1 ? 'Check offen' : 'Checks offen'}` : ''}`}
    onClick=${() => openCheck(target.slot, target.date)}>
    <${Icon} name="check" size=${22} />${label ? html`<span>${label}</span>` : null}
    ${n ? html`<span class="fab-badge" aria-hidden="true">${n > 9 ? '9+' : n}</span>` : null}
  </button>`;
}
