// Ansicht "Heute": Tagesform, Recovery, Schlaf, Strain, Gründe, Vitalwerte, Umwelt, Hinweise.
import { html, useState } from '../vendor/preact-htm.js';
import { state, update, shiftDate, navigate, openCheck, tryDemo, leaveDemo, patchSettings, saveSettings, useCurrentLocation, toast, importShortcutText, setHomeView, firstDataDay } from './state.js';
import { Dial, Ring, StatusChip, Contributions, RangeBar, Segmented, zoneOf, zoneClass } from './components.js';
import { PeriodChart } from './charts.js';
import { periodAverages, periodSummary } from '../model/periods.js';
import { InfoButton } from './info.js';
import { Icon } from './icons.js';
import { num, hours, clock, dayLabel, dateFull, signed, ago } from './format.js';
import { addDays } from '../core/time.js';
import { summarize, formGap } from '../model/hints.js';
import { cardOn, withCard } from './cards.js';
import { explainNight } from '../model/lifestyle.js';
import { DetectCard, WorkoutSheet, WorkoutsCard } from './workouts.js';
import { NightSheet } from './nightView.js';
import { sportLabel } from '../model/sports.js';
import { earlyWarnings, snoozedWarnings, snoozeWarning } from '../model/earlywarning.js';
import { dataReport, dataAlert } from '../model/coverage.js';
import { slotDone } from '../survey/engine.js';
import { WORKOUT_LABEL } from '../data/normalize.js';
import { formatPlace } from '../context/location.js';
import { JournalToday } from './journalView.js';

/** Kopfzeile; prev und next sind { label, disabled, onClick }, above steht über dem Titel. */
export function Topbar({ title, sub, above = null, prev = null, next = null }) {
  return html`<header class="topbar">
    ${prev ? html`<button class="iconbtn" aria-label=${prev.label} disabled=${prev.disabled} onClick=${prev.onClick}><${Icon} name="left" /></button>` : null}
    <div class="grow" style=${prev || next ? 'text-align:center' : ''}>
      ${above}
      <h1>${title}</h1>
      ${sub ? html`<div class="sub">${sub}</div>` : null}
    </div>
    ${next ? html`<button class="iconbtn" aria-label=${next.label} disabled=${next.disabled} onClick=${next.onClick}><${Icon} name="right" /></button>` : null}
  </header>`;
}

/** Umschalter über dem Titel: Tagesansicht oder Monatskalender. */
export function HomeSwitch() {
  const month = state.homeView === 'month';
  return html`<div class="homeswitch" role="group" aria-label="Ansicht">
    <button type="button" aria-pressed=${month ? 'false' : 'true'} onClick=${() => setHomeView('day')}><${Icon} name="sun" size=${14} />Tag</button>
    <button type="button" aria-pressed=${month ? 'true' : 'false'} onClick=${() => setHomeView('month')}><${Icon} name="calendar" size=${14} />Monat</button>
  </div>`;
}

/** Kopfzeile einer Unterseite im Reiter „Profil“ mit Zurück-Knopf. */
export function SubTopbar({ title, sub, back = 'profil', backLabel = 'Zurück zum Profil' }) {
  return html`<header class="topbar">
    <button type="button" class="iconbtn" aria-label=${backLabel} onClick=${() => navigate(back)}><${Icon} name="left" /></button>
    <div class="grow">
      <h1>${title}</h1>
      ${sub ? html`<div class="sub">${sub}</div>` : null}
    </div>
  </header>`;
}

export function DemoBanner() {
  if (!state.demo) return null;
  return html`<div class="banner demo"><${Icon} name="info" size=${18} />
    <div class="grow"><b>Beispieldaten.</b> Alle Werte sind erfunden und zeigen, wie die App mit 90 Tagen Daten aussieht.
      ${state.preview ? null : html` <button class="linkbtn" onClick=${leaveDemo}>Konto anlegen oder anmelden</button>`}</div>
  </div>`;
}

/** Täglicher Import direkt von „Heute“: Text aus dem Kurzbefehl einfügen, ohne in die Daten-Seite zu wechseln. */
function ImportHint({ lastSample, reason }) {
  const paste = async () => {
    let text;
    try {
      text = await navigator.clipboard.readText();
    } catch {
      text = null;
    }
    if (!text) {
      toast('Die Zwischenablage ließ sich nicht lesen. Füge den Text hier ein.', 'error');
      navigate('profil', 'daten');
      return;
    }
    try {
      const s = await importShortcutText(text);
      toast(s.added ? `${num(s.added)} neue Werte importiert` : 'Keine neuen Werte, alles war schon da');
    } catch (e) {
      toast(e.message, 'error');
    }
  };
  return html`<div class="banner">
    <${Icon} name="sync" size=${18} />
    <div class="grow stack-s"><span>${reason === 'again'
      ? html`<b>Die letzte Nacht fehlt noch.</b> Synchronisiere den Strap in der Zepp-App, führe den Kurzbefehl „Formkurve Sync“ noch einmal aus und füge die Daten hier ein.`
      : html`<b>${reason === 'night' ? 'Die letzte Nacht fehlt noch.' : `Letzte Messung ${ago(lastSample)}.`}</b> Führe den Kurzbefehl „Formkurve Sync“ aus und füge die Daten hier ein.`}</span>
      <div class="row wrap" style="gap:8px"><button type="button" class="btn small primary" onClick=${paste}><${Icon} name="clipboard" size=${16} />Einfügen und importieren</button>
        <button type="button" class="linkbtn" onClick=${() => navigate('profil', 'daten')}>Andere Wege</button></div>
    </div>
  </div>`;
}

function rangeOf(base, floor, transform = (x) => x) {
  if (!base) return null;
  const s = Math.max(1.4826 * (base.mad || 0), floor);
  return [transform(base.median - s), transform(base.median + s)];
}

function Vital({ name, k, value, unit, digits = 0, range, z, onOpen = null }) {
  if (value == null) return null;
  const lo = range?.[0];
  const hi = range?.[1];
  const span = lo != null ? (hi - lo) * 1.6 : 1;
  const min = lo != null ? Math.min(lo - span, value) : 0;
  const max = hi != null ? Math.max(hi + span, value) : 1;
  let note = range ? `dein Normal ${num(lo, digits)}–${num(hi, digits)}` : 'Baseline folgt';
  if (z != null && Math.abs(z) >= 1) note = `${z > 0 ? 'über' : 'unter'} deinem Normal`;
  return html`<div class="vital">
    <div class="name row" style="gap:4px">${name}<${InfoButton} k=${k} value=${value} label=${name} /></div>
    <div class="value">${num(value, digits)}<small>${unit}</small></div>
    ${onOpen ? html`<button type="button" class="range as-link" onClick=${onOpen} aria-label=${`Verlauf von ${name} ansehen`}>
      <${RangeBar} value=${value} lo=${lo} hi=${hi} min=${min} max=${max} /><span class="note">${note} <${Icon} name="right" size=${12} /></span></button>`
      : html`<div class="range"><${RangeBar} value=${value} lo=${lo} hi=${hi} min=${min} max=${max} /><span class="note">${note}</span></div>`}
  </div>`;
}

function KV({ label, value, k, infoValue, extra }) {
  return html`<dt class="row" style="gap:4px">${label}${k ? html`<${InfoButton} k=${k} value=${infoValue} extra=${extra || {}} label=${label} />` : null}</dt><dd>${value}</dd>`;
}

function Empty() {
  return html`<section class="card empty">
    <${Icon} name="heart" size=${34} />
    <h2>Noch keine Daten</h2>
    <p class="ink2" style="max-width:34ch">Lade einmal deinen Apple-Health-Export für die Historie und richte den Kurzbefehl für den täglichen Import ein.</p>
    <div class="row wrap" style="justify-content:center">
      <button class="btn primary" onClick=${() => navigate('profil', 'daten')}><${Icon} name="import" size=${18} />Daten importieren</button>
      <button class="btn" onClick=${tryDemo}>Beispieldaten ansehen</button>
    </div>
  </section>`;
}

function MorningGate() {
  return html`<section class="card stack" style="text-align:center;padding:22px 18px">
    <div class="eyebrow">Zuerst du</div>
    <h2 style="font-size:20px">Wie fühlst du dich heute Morgen?</h2>
    <p class="ink2">Beantworte den Morgencheck, bevor du die Zahlen siehst. So vergleicht die App ehrlich, ob Score und Gefühl zusammenpassen.</p>
    <button class="btn primary block" onClick=${() => openCheck('morning', state.today)}>Morgencheck starten · etwa 20 Sekunden</button>
    <button class="linkbtn" onClick=${() => update({ showScoresAnyway: true })}>Scores trotzdem zeigen</button>
  </section>`;
}

function ProfileHint() {
  const s = state.repo.settings;
  if (state.demo || s.display.profileHintDismissed || (s.profile.birthYear && s.profile.sex) || state.results.dates.length < 3) return null;
  return html`<section class="card stack">
    <div class="row between" style="align-items:flex-start"><h3>Genauere Normalwerte</h3><${Icon} name="info" size=${18} /></div>
    <p class="small ink2">Mit Geburtsjahr und Geschlecht ordnet die App Schlafdauer, Schritte und Maximalpuls passend zu deinem Alter ein. Freiwillig.</p>
    <div class="row wrap">
      <button class="btn small primary" onClick=${() => navigate('profil', 'koerper')}>Körperdaten ergänzen</button>
      <button class="btn small ghost" onClick=${() => patchSettings('display.profileHintDismissed', true)}>Nicht jetzt</button>
    </div>
  </section>`;
}

/** Tagesform je Woche oder Monat im Durchschnitt. */
function FormPeriods({ full = false }) {
  const s = state.repo.settings;
  const unit = s.display.formPeriod === 'month' ? 'month' : 'week';
  const [table, setTable] = useState(false);
  const periods = periodAverages(state.results.dates, state.results.days, { unit, count: 12, today: state.today });
  const sum = periodSummary(periods);
  if (!sum) return null;
  const { red, green } = s.model.recovery;
  const word = unit === 'week' ? 'Woche' : 'Monat';
  const head = sum.current.partial ? `${unit === 'week' ? 'Diese Woche' : 'Dieser Monat'} (${sum.current.label})` : sum.current.label;
  return html`<${Card} id="periods" full=${full} title="Tagesform im Schnitt"
    sub=${full ? html`<button class="btn small ghost" aria-pressed=${table ? 'true' : 'false'} onClick=${() => setTable(!table)}><${Icon} name="table" size=${16} />${table ? 'Diagramm' : 'Tabelle'}</button>` : null}>
    ${full ? html`<${Segmented} label="Zusammenfassen nach" value=${unit} onChange=${(v) => patchSettings('display.formPeriod', v)} options=${[{ value: 'week', label: 'Wochen' }, { value: 'month', label: 'Monate' }]} />` : null}
    <div class="period-stat">
      <div><div class="tiny muted">${head}</div><div class="big">${num(sum.current.mean)}</div></div>
      ${sum.delta != null ? html`<span class="delta">${signed(sum.delta)} ${unit === 'week' ? 'zur Vorwoche' : 'zum Vormonat'}</span>` : null}
      <span class="tiny muted">${sum.current.n} ${sum.current.n === 1 ? 'Tag' : 'Tage'} mit Wert</span>
    </div>
    ${!full ? null : table ? html`<div class="tablewrap"><table class="data">
        <thead><tr><th>${word}</th><th>Zeitraum</th><th>Ø</th><th>Tage</th><th>Spanne</th></tr></thead>
        <tbody>${periods.slice().reverse().map((p) => html`<tr><td>${p.label}${p.partial ? ' (läuft)' : ''}</td><td>${p.range}</td><td>${p.mean == null ? '–' : num(p.mean)}</td><td>${p.n}</td><td>${p.n > 1 ? `${num(p.min)}–${num(p.max)}` : '–'}</td></tr>`)}</tbody>
      </table></div>`
      : html`<${PeriodChart} periods=${periods} yDomain=${[0, 100]} yTicks=${[0, red, green, 100]} refLines=${[]} unitWord=${word} label=${`Durchschnittliche Tagesform je ${word}`} />`}
    ${full ? html`<p class="tiny muted" style="margin-top:6px">Linien bei ${red} und ${green}: ab ${green} „Bereit“, unter ${red} „Erholung zuerst“. Die helle Säule läuft noch.</p>` : null}
  <//>`;
}

/**
 * Frühwarnungen: dauerhafte Abweichungen von den eigenen Werten, nie einzelne Ausreißer.
 * „Verstanden“ pausiert denselben Hinweis für ein paar Tage.
 */
function EarlyWarnings() {
  const repo = state.repo;
  const s = repo.settings;
  if (!s.display.warnings) return null;
  const list = earlyWarnings({ days: state.results.days, today: state.today, settings: s, snoozed: snoozedWarnings(repo.meta, state.today) });
  if (!list.length) return null;
  const ack = async (w) => {
    await repo.patchMeta({ warnSnooze: snoozeWarning(repo.meta, w.id, state.today, s.model.warn.snoozeDays) });
    update({ version: state.version + 1 });
    toast(`Hinweis pausiert für ${s.model.warn.snoozeDays} Tage`);
  };
  return html`<section class="card warncard" aria-labelledby="h-warn">
    <div class="card-head"><h2 id="h-warn">${list.length > 1 ? 'Frühwarnungen' : 'Frühwarnung'}</h2><span class="tiny muted">aus deinem Verlauf</span></div>
    ${list.map((w) => html`<div class=${`hint ${w.level === 'warn' ? 'c-warn' : 'c-info'}`} key=${w.id}>
      <${Icon} name=${w.level === 'warn' ? 'alert' : 'info'} size=${20} />
      <div class="grow stack-s">
        <div><b>${w.title}</b><p>${w.text}</p></div>
        <p class="small adv"><b>${w.level === 'warn' ? 'Empfehlung:' : 'Vorschlag:'}</b> ${w.advice}</p>
        <button type="button" class="btn small ghost" style="justify-self:start" onClick=${() => ack(w)}>Verstanden</button>
      </div>
    </div>`)}
    <hr class="divider" />
    <p class="tiny muted">Formkurve stellt keine Diagnose. Sie vergleicht nur deine Werte mit deinen eigenen Nächten davor. Bei Brustschmerz, Atemnot oder Ohnmacht gilt immer der Notruf 112.</p>
  </section>`;
}

/**
 * Meldung, wenn Messwerte nicht ankommen oder sich nicht lesen ließen, mit den Berechnungen,
 * die deshalb ausfallen. „Nicht mehr zeigen“ merkt sich den Zustand, bis er sich ändert.
 */
function DataAlert() {
  const repo = state.repo;
  const s = repo.settings;
  if (!s.display.dataCheck) return null;
  const rep = dataReport({ index: repo.index, results: state.results, settings: s, lastImport: state.lastImport, today: state.today });
  const a = dataAlert(rep, repo.meta.dataAck);
  if (!a) return null;
  const ack = async () => {
    await repo.patchMeta({ dataAck: a.ack });
    update({ version: state.version + 1 });
    toast('Hinweis ausgeblendet. Wieder einschaltbar unter Profil → Einstellungen.');
  };
  return html`<div class=${`banner data ${a.level}`} role="status">
    <${Icon} name=${a.level === 'error' ? 'alert' : 'info'} size=${18} />
    <div class="grow stack-s">
      <div><b>${a.title}.</b>${a.blocked.length
        ? ` Dadurch nicht möglich: ${a.blocked.slice(0, 3).join(', ')}${a.blocked.length > 3 ? ` und ${a.blocked.length - 3} weitere` : ''}.`
        : ' Die Berechnungen laufen weiter.'}</div>
      <div class="row" style="gap:8px;flex-wrap:wrap">
        <button type="button" class="btn small" onClick=${() => navigate('profil', 'daten')}>Prüfung öffnen</button>
        <button type="button" class="btn small ghost" onClick=${ack}>Ausblenden</button>
      </div>
    </div>
  </div>`;
}

/** Warum ein Nachtwert heute aus dem Rahmen fällt – mit der bekannten Ursache, wenn es eine gibt. */
function NightReason({ d, prev, full = false }) {
  const { odd, causes } = explainNight(d, prev, state.repo.settings);
  if (!odd.length) return null;
  const werte = odd.map((o) => `${o.label} ${o.dir} deinem Schnitt`).join(', ');
  if (!causes.length) {
    return html`<p class="small ink2" style="margin-top:8px">${werte.charAt(0).toUpperCase() + werte.slice(1)}. Im Logbuch steht nichts, was das erklärt.</p>`;
  }
  // Kompakt reicht der Grund in einem Satz; die Einzelheiten stehen auf der Seite
  const text = full ? causes.map((c) => c.text).join(' ') : causes.map((c) => c.label).join(' und ');
  return html`<div class="hint c-info" style="margin-top:8px">
    <${Icon} name="info" size=${18} />
    <div><b>${werte.charAt(0).toUpperCase() + werte.slice(1)}.</b> ${full ? text : `Möglicher Grund: ${text.toLowerCase()}.`}
      ${full ? html`<span class="tiny muted"> Die Frühwarnung rechnet das mit ein.</span>` : null}</div>
  </div>`;
}

/** Woraus sich der Schlafbedarf dieser Nacht zusammensetzt. */
function NeedParts({ d }) {
  const p = d.sleepNeedParts;
  if (!p) return null;
  const teile = [
    p.debt > 0.05 ? `${num(p.debt, 1)} h Schlafschuld der Vornächte` : null,
    p.strain > 0.05 ? `${num(p.strain, 1)} h für die Belastung davor` : null,
    p.recovery > 0.05 ? `${num(p.recovery, 1)} h für die schwache Erholung` : null,
    p.nap < -0.05 ? `${num(-p.nap, 1)} h weniger wegen des Mittagsschlafs` : null,
  ].filter(Boolean);
  if (!teile.length) return null;
  return html`<p class="tiny muted" style="margin-top:8px">Bedarf ${hours(d.sleepNeedH * 60)} = ${hours(p.base * 60)} Grundbedarf + ${teile.join(' + ')}.</p>`;
}

/**
 * Hülle jeder Karte auf „Heute“: Titel, Zusatz rechts und oben in der Ecke ein Knopf,
 * der denselben Inhalt als ganze Seite öffnet. Auf der Seite fehlt der Knopf.
 */
function Card({ id, title, sub, full, children, label = null }) {
  return html`<section class="card" aria-label=${label || title}>
    <div class="card-head">
      <h2>${title}</h2>
      <div class="row" style="gap:8px;align-items:center">
        ${sub || null}
        ${full ? null : html`<button type="button" class="zoom" onClick=${() => navigate('heute', id)} aria-label=${`${title} als ganze Seite öffnen`}>
          <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" /></svg>
        </button>`}
      </div>
    </div>
    ${children}
  </section>`;
}

/** Letzte Nacht. Kurz: die zwei Werte, die die Recovery tragen, plus Auffälligkeiten. */
function NightCard({ d, prev, onNight, full = false }) {
  const leer = d.hrv == null && d.rhr == null;
  const vitals = [
    ['HRV', 'hrv', d.hrv, 'ms', 0, rangeOf(d.base?.lnHrv, 0.06, Math.exp), d.z?.hrv, 'hrv'],
    [`Ruhepuls${d.rhrSource === 'Apple Health' ? ' (Apple Health)' : ''}`, 'rhr', d.rhr, 'bpm', 0, rangeOf(d.base?.rhr, 1.5), d.z?.rhr, 'rhr'],
    ['Atemfrequenz', 'resp', d.resp, '/min', 1, rangeOf(d.base?.resp, 0.4), d.z?.resp, 'resp'],
    ['Blutsauerstoff', 'spo2', d.spo2, '%', 1, rangeOf(d.base?.spo2, 0.7), d.z?.spo2, 'spo2'],
    ['Hauttemperatur', 'temp', d.temp, '°C', 1, rangeOf(d.base?.temp, 0.15), d.z?.temp, null],
  ];
  const zeigen = full ? vitals : vitals.slice(0, 2);
  return html`<${Card} id="night" full=${full} title="Letzte Nacht"
    sub=${d.sleep ? html`<span class="tiny muted tnum">${clock(d.sleep.onset)}–${clock(d.sleep.wake)}</span>` : null}>
    <div class="vitals">
      ${zeigen.map(([name, k, value, unit, digits, range, z, metric]) => html`<${Vital} key=${k} name=${name} k=${k} value=${value}
        unit=${unit} digits=${digits} range=${range} z=${z} onOpen=${metric ? () => onNight(metric) : null} />`)}
    </div>
    ${leer ? html`<p class="small muted">Keine Nachtwerte. Prüfe, ob Zepp HRV und Herzfrequenz an Apple Health schreibt. <${HideCard} id="night" /></p>` : null}
    <${NightReason} d=${d} prev=${prev} full=${full} />
    ${full ? html`<p class="tiny muted" style="margin-top:8px">Tippe auf einen Balken für den Verlauf der Nacht. Der graue Balken ist dein persönlicher Normalbereich, das (i) zeigt die allgemeinen Richtwerte.</p>` : null}
  <//>`;
}

/** Schlaf. Kurz: Dauer und was zum Bedarf fehlt. */
function SleepCard({ d, onNight, full = false }) {
  const s = d.sleep;
  const fehlt = d.sleepDebtH > 0.1;
  return html`<${Card} id="sleep" full=${full} title="Schlaf"
    sub=${html`<span class="tiny muted row" style="gap:2px">Bedarf ${hours(d.sleepNeedH * 60)}<${InfoButton} k="sleepNeed" value=${d.sleepNeedH} label="Schlafbedarf" /></span>`}>
    <dl class="kv">
      <${KV} label="Geschlafen" value=${hours(s.asleepMin)} k="asleep" infoValue=${s.asleepMin} />
      ${fehlt ? html`<${KV} label="Fehlt zum Bedarf" value=${hours(d.sleepDebtH * 60)} />` : null}
      ${full ? html`
        <${KV} label="Effizienz" value=${`${num(s.efficiency * 100)} %`} k="efficiency" infoValue=${s.efficiency} />
        ${s.hasStages ? html`<${KV} label="Tiefschlaf" value=${`${hours(s.deepMin)} · ${num(s.deepPct * 100)} %`} k="deep" infoValue=${s.deepMin} extra=${{ pct: s.deepPct }} />
          <${KV} label="REM" value=${`${hours(s.remMin)} · ${num(s.remPct * 100)} %`} k="rem" infoValue=${s.remMin} extra=${{ pct: s.remPct }} />` : null}
        ${s.latencyMin != null ? html`<${KV} label="Eingeschlafen nach" value=${`${num(s.latencyMin)} min`} k="latency" infoValue=${s.latencyMin} />` : null}
        <${KV} label="Aufwachphasen" value=${s.wakeEpisodes} k="wake" infoValue=${s.wakeEpisodes} />
        ${d.sleepParts?.regularity != null ? html`<${KV} label="Regelmäßigkeit (7 Tage)" value=${`${num(d.sleepParts.regularity)} / 100`} k="regularity" infoValue=${d.sleepParts.regularity} />` : null}
        ${d.sleepParts?.calm != null ? html`<${KV} label="Nächtliche Ruhe" value=${`${num(d.sleepParts.calm)} / 100`} />` : null}` : null}
    </dl>
    ${full ? html`<${NeedParts} d=${d} />` : null}
    ${d.sleepParts?.calm != null && d.sleepScore >= 70 && d.sleepParts.calm <= 45 ? html`<p class="small ink2" style="margin-top:8px">
      Lang und durchgehend geschlafen, aber unruhig: Puls und HRV lagen schlechter als sonst.${full ? ' Deshalb kann der Schlaf-Score hoch und die Recovery trotzdem niedrig sein.' : ''}</p>` : null}
    <div class="row" style="margin-top:8px"><button type="button" class="linkbtn" onClick=${() => onNight('sleep')}>Phasen ansehen</button></div>
  <//>`;
}

/** Belastung. Kurz: Last und Schritte. */
function LoadCard({ d, date, onOpen, full = false }) {
  const wkKcal = (d.workouts || []).reduce((s, w) => s + (w.kcal > 0 ? w.kcal : 0), 0);
  let active7 = null;
  let sum = 0;
  let n = 0;
  for (let i = 0; i < 7; i++) {
    const x = state.results.days.get(addDays(date, -i));
    if (x?.activeMin != null) {
      sum += x.activeMin;
      n++;
    }
  }
  if (n >= 4) active7 = (sum * 7) / n;
  const leer = d.load == null && !d.workouts?.length;
  return html`<${Card} id="load" full=${full} title="Belastung">
    <dl class="kv">
      ${d.load != null ? html`<${KV} label=${d.strainPartial ? 'Last bisher' : 'Last'} value=${num(d.load)} k="load" infoValue=${d.load} />` : null}
      ${d.steps != null ? html`<${KV} label="Schritte" value=${num(d.steps)} k="steps" infoValue=${d.steps} />` : null}
      ${full ? html`
        ${d.strengthLoad > 0 ? html`<${KV} label="davon Kraft-Zuschlag" value=${`+${num(d.strengthLoad)}`} />` : null}
        ${active7 != null ? html`<${KV} label="Aktivminuten (7 Tage)" value=${num(active7)} k="activeMin" infoValue=${active7} />` : null}
        ${d.acwr != null ? html`<${KV} label="7 zu 28 Tage" value=${num(d.acwr, 2)} k="acwr" infoValue=${d.acwr} />` : null}
        ${d.energy != null ? html`<${KV} label=${d.strainPartial ? 'Aktive Energie bisher' : 'Aktive Energie'} value=${`${num(d.energy)} kcal`} />` : null}
        ${wkKcal > 0 ? html`<${KV} label="davon im Training" value=${`${num(wkKcal)} kcal`} />` : null}
        ${d.fitness != null ? html`<${KV} label="Langzeit-Fitness" value=${num(d.fitness)} k="fitness" infoValue=${d.fitness} />` : null}` : null}
    </dl>
    ${full && d.workouts?.length ? html`<hr class="divider" />${d.workouts.map((w, i) => html`<button type="button" class="wk-row small" key=${i} onClick=${() => onOpen(w)}>
      <span><b>${sportLabel(w.sport || w.kind) || WORKOUT_LABEL[w.kind] || 'Training'}</b> <span class="muted">${clock(w.t)} · ${num(w.durMin)} min</span></span>
      <span class="muted tnum row" style="gap:6px">${[w.kcal > 0 ? `${num(w.kcal)} kcal` : '', w.avgHr ? `Ø ${num(w.avgHr)} bpm` : ''].filter(Boolean).join(' · ')}
        <${Icon} name="right" size=${15} /></span></button>`)}` : null}
    ${full && d.energy != null ? html`<p class="tiny muted" style="margin-top:8px">Aktive Energie ohne Grundumsatz, so wie Apple Health sie zählt.</p>` : null}
    ${leer ? html`<p class="small muted">Keine Pulsdaten für diesen Tag. <${HideCard} id="load" /></p>` : null}
  <//>`;
}

/** Was die Werte bewegt. Kurz: die drei stärksten Anteile und die Summe aus dem Logbuch. */
function ContribCard({ d, contrib, full = false }) {
  const lf = d.lifestyle;
  if (!contrib.length && !lf?.reasons?.length) return null;
  const items = full ? contrib : contrib.slice(0, 3);
  return html`<${Card} id="contrib" full=${full} title="Was deine Werte bewegt" sub=${html`<span class="tiny muted">Punkte</span>`}>
    ${items.length ? html`<${Contributions} items=${items} />` : null}
    ${full && contrib.length ? html`<p class="tiny muted" style="margin-top:10px">Recovery gegenüber einem Tag, an dem alles genau deinem Normalwert entspricht (Recovery 50).</p>` : null}
    ${full && d.formParts?.length ? html`<hr class="divider" />
      <div class="card-head" style="margin-bottom:6px"><h3 style="font-size:15px;margin:0">Woraus die Tagesform entsteht</h3><span class="tnum small muted">${num(d.formRaw)}</span></div>
      <dl class="kv">
        ${d.formParts.filter((x) => x.value != null).map((x) => html`<dt key=${`t${x.id}`}>${x.label} <span class="muted">${num(x.weight * 100)} %</span></dt><dd key=${`v${x.id}`}>${num(x.value)}</dd>`)}
      </dl>` : null}
    ${d.formCap != null ? html`<p class="small warn-ink" style="margin-top:6px">Gedeckelt auf ${num(d.formCap)}: Bei einer Recovery von ${num(d.recovery)} sollen Fitness und Belastungsbalance den Tag nicht hochziehen.</p>` : null}
    ${lf?.reasons?.length ? html`${full ? html`<hr class="divider" />` : null}
      <div class="card-head" style="margin:6px 0"><h3 style="font-size:15px;margin:0">Dazu aus dem Logbuch</h3>
        <span class="tnum small" style=${`color:var(--${lf.delta < 0 ? 'crit' : 'good'})`}>${lf.delta > 0 ? '+' : lf.delta < 0 ? '−' : ''}${num(Math.abs(lf.delta))} auf die Tagesform</span></div>
      <ul class="bullets small">${(full ? lf.reasons : lf.reasons.slice(0, 2)).map((r) => html`<li key=${r.id}>${r.text} <span class="muted tnum">(${r.points > 0 ? '+' : '−'}${num(Math.abs(r.points))})</span></li>`)}</ul>
      ${full ? html`<p class="tiny muted" style="margin-top:6px">Alkohol, Koffein und Wasser stecken zum Teil schon in HRV, Puls und Schlaf. Deshalb zählt das Logbuch nur mit wenigen Punkten dazu, höchstens ${num(state.repo.settings.model.form.lifestyle.cap)} nach unten.</p>` : null}` : null}
  <//>`;
}

/** Hinweise. Kurz: nur Warnungen, höchstens zwei. */
function HintsCard({ d, full = false }) {
  const alle = d.hints || [];
  if (!alle.length) return null;
  const wichtig = alle.filter((h) => h.level !== 'info');
  const zeigen = full ? alle : (wichtig.length ? wichtig : alle).slice(0, 2);
  const rest = alle.length - zeigen.length;
  return html`<${Card} id="hints" full=${full} title="Hinweise des Tages" label="Hinweise">
    ${zeigen.map((h) => html`<div key=${h.title} class=${`hint ${{ critical: 'c-crit', warning: 'c-warn', info: 'c-info' }[h.level]}`}>
      <${Icon} name=${h.level === 'info' ? 'info' : 'alert'} size=${20} />
      <div><b>${h.title}</b>${full ? html`<p>${h.text}</p>` : null}</div>
    </div>`)}
    ${rest > 0 ? html`<p class="tiny muted" style="margin-top:6px">${rest} weitere${rest === 1 ? 'r Hinweis' : ' Hinweise'} in der Seitenansicht.</p>` : null}
  <//>`;
}

/** Blendet eine Karte aus, die für diesen Tag nichts zu zeigen hat. */
function HideCard({ id }) {
  const hide = async () => {
    await saveSettings(withCard(state.repo.settings, id, false));
    toast('Karte ausgeblendet. Wieder einschalten unter Profil \u2192 Einstellungen \u2192 Karten auf \u201eHeute\u201c.');
  };
  return html`<button type="button" class="linkbtn" onClick=${hide}>Karte ausblenden</button>`;
}

function SyncBanner() {
  const st = state.sync;
  if (!st?.linked || (st.state !== 'reauth' && st.state !== 'error')) return null;
  return html`<button class="banner sync" style="text-align:left;cursor:pointer" onClick=${() => navigate('profil', 'konto')}>
    <${Icon} name="cloud" size=${18} /><div class="grow"><b>${st.state === 'reauth' ? 'Abgleich pausiert.' : 'Abgleich gestört.'}</b> ${st.state === 'reauth' ? 'Bitte unter Profil → Konto neu anmelden; deine Eingaben bleiben auf diesem Gerät gespeichert.' : st.error || 'Details unter Profil → Konto.'}</div></button>`;
}

function BackupHint() {
  const repo = state.repo;
  if (state.demo || state.preview || Math.max(repo.survey.size, repo.journal.size) < 7) return null;
  // Mit Online-Konto liegt eine verschlüsselte Kopie in der Cloud
  if (state.sync?.linked && state.sync.lastSync && Date.now() - state.sync.lastSync < 7 * 86400000) return null;
  const now = Date.now();
  const meta = repo.meta;
  if ((meta.backupSnoozeUntil || 0) > now) return null;
  const firstAnswer = [...repo.survey.keys(), ...repo.journal.keys()].sort()[0];
  const daysSinceFirst = firstAnswer ? Math.round((now - new Date(`${firstAnswer}T12:00:00`).getTime()) / 86400000) : 0;
  const daysSinceBackup = meta.lastBackup ? Math.floor((now - meta.lastBackup) / 86400000) : null;
  const due = daysSinceBackup == null ? daysSinceFirst >= 14 : daysSinceBackup >= 30;
  if (!due) return null;
  return html`<section class="card stack">
    <div class="row between" style="align-items:flex-start"><h3>${daysSinceBackup == null ? 'Noch kein Backup' : `Letztes Backup vor ${daysSinceBackup} Tagen`}</h3><${Icon} name="import" size=${18} /></div>
    <p class="small ink2">Deine Check-in-Antworten und dein Logbuch liegen nur auf diesem Gerät. Messwerte kommen jederzeit wieder aus Apple Health, Antworten und Logbuch nur aus einem Backup.</p>
    <div class="row wrap">
      <button class="btn small primary" onClick=${() => navigate('profil', 'backup')}>Backup sichern</button>
      <button class="btn small ghost" onClick=${async () => {
        await repo.patchMeta({ backupSnoozeUntil: now + 7 * 86400000 });
        update({ version: state.version + 1 });
      }}>In 7 Tagen erinnern</button>
    </div>
  </section>`;
}

function Environment({ date, full = false }) {
  const s = state.repo.settings;
  const today = state.repo.context.get(date) || null;
  const night = state.repo.context.get(addDays(date, -1)) || null;
  if (!s.context.enabled || !s.context.place) {
    if (state.demo) return null;
    return html`<section class="card stack">
      <h2>Umwelt</h2>
      <p class="small ink2">Erlaube den Standort, dann lädt die App Temperatur, Feinstaub und Pollen für deinen Ort automatisch.</p>
      <button class="btn small" onClick=${async () => {
        try {
          await useCurrentLocation({ prompt: true });
          toast('Standort gespeichert');
        } catch (e) {
          toast(e.message, 'error');
        }
      }}><${Icon} name="location" size=${16} />Standort erlauben</button>
    </section>`;
  }
  if (!today && !night) {
    return html`<section class="card stack"><h2>Umwelt</h2><p class="small muted">${state.contextStatus || 'Noch keine Umweltdaten für diesen Tag.'}</p></section>`;
  }
  const pm = today?.pm25;
  // Kompakt nur, was die Nacht betrifft, und Werte, die auffallen
  const warm = night?.nightTempMin != null && night.nightTempMin >= 20;
  const dreck = pm != null && pm > 15;
  const pollen = today?.pollenMax != null && today.pollenMax >= 50;
  return html`<${Card} id="environment" full=${full} title="Umwelt"
    sub=${html`<span class="tiny muted" style="text-align:right">${formatPlace(s.context.place)}</span>`}>
    <dl class="kv">
      ${night?.nightTempMin != null ? html`<${KV} label=${warm ? 'Nacht, Tiefstwert (Tropennacht)' : 'Nacht, Tiefstwert'} value=${`${num(night.nightTempMin, 1)} °C`} k="nightTemp" infoValue=${night.nightTempMin} />` : null}
      ${full || dreck ? (pm != null ? html`<${KV} label="Feinstaub PM2,5" value=${html`${num(pm, 1)} µg/m³ <span class=${`status ${dreck ? 'c-warn' : 'c-good'}`} style="padding:1px 8px;font-size:11px;margin-left:4px">${dreck ? 'über WHO' : 'unter WHO'}</span>`} k="pm25" infoValue=${pm} />` : null) : null}
      ${full || pollen ? (today?.pollenMax != null ? html`<${KV} label="Pollen (Spitze)" value=${`${num(today.pollenMax)} /m³`} k="pollen" infoValue=${today.pollenMax} />` : null) : null}
      ${full ? html`
        ${night?.nightHumidity != null ? html`<${KV} label="Luftfeuchte nachts" value=${`${num(night.nightHumidity)} %`} k="humidity" infoValue=${night.nightHumidity} />` : null}
        ${today?.tMax != null ? html`<${KV} label="Höchstwert heute" value=${`${num(today.tMax, 1)} °C`} k="dayTemp" infoValue=${today.tMax} />` : null}
        ${today?.daylightH != null ? html`<${KV} label="Tageslänge" value=${`${num(today.daylightH, 1)} h`} k="daylight" infoValue=${today.daylightH} />` : null}` : null}
    </dl>
    ${full ? (state.demo ? html`<p class="tiny muted" style="margin-top:10px">Erfundene Beispielwerte</p>` : state.repo.meta.lastContext ? html`<p class="tiny muted" style="margin-top:10px">Stand ${ago(state.repo.meta.lastContext)} · Open-Meteo, CAMS</p>` : null) : null}
  <//>`;
}

/** Anteile der Recovery für die Karte „Was deine Werte bewegt“. */
function contribList(d) {
  const parts = d?.recoveryParts || {};
  return [
    ['hrv', 'HRV', d?.hrv != null ? `${num(d.hrv)} ms` : ''],
    ['rhr', 'Ruhepuls', d?.rhr != null ? `${num(d.rhr)} bpm` : ''],
    ['sleep', 'Schlaf', d?.sleepScore != null ? `Score ${num(d.sleepScore)}` : ''],
    ['vital', 'Vitalwerte', ''],
    ['subj', 'Gefühl', ''],
  ].filter(([k]) => parts[k] != null).map(([k, label, detail]) => ({ label, value: parts[k], detail }));
}

const PAGE_TITEL = {
  night: 'Letzte Nacht', sleep: 'Schlaf', load: 'Belastung', environment: 'Umwelt',
  workouts: 'Letzte Trainings', contrib: 'Was deine Werte bewegt', hints: 'Hinweise des Tages',
  periods: 'Tagesform im Schnitt',
};

/** Eine Karte als ganze Seite, erreichbar über den Knopf in der Ecke und über „#heute/schlaf“. */
export function HomeCardPage({ id }) {
  const [openWk, setOpenWk] = useState(null);
  const [openNight, setOpenNight] = useState(null);
  const date = state.date;
  const d = state.results.days.get(date);
  const prev = state.results.days.get(addDays(date, -1));
  const contrib = contribList(d);
  const leer = html`<section class="card"><p class="muted">Für diesen Tag gibt es dazu nichts.</p></section>`;
  const inhalt = !d ? leer
    : id === 'night' ? html`<${NightCard} d=${d} prev=${prev} onNight=${setOpenNight} full=${true} />`
    : id === 'sleep' ? (d.sleep ? html`<${SleepCard} d=${d} onNight=${setOpenNight} full=${true} />` : leer)
    : id === 'load' ? html`<${LoadCard} d=${d} date=${date} onOpen=${setOpenWk} full=${true} />`
    : id === 'workouts' ? html`<${WorkoutsCard} onOpen=${setOpenWk} full=${true} Card=${Card} />`
    : id === 'contrib' ? (html`<${ContribCard} d=${d} contrib=${contrib} full=${true} />` || leer)
    : id === 'hints' ? (html`<${HintsCard} d=${d} full=${true} />` || leer)
    : id === 'environment' ? html`<${Environment} date=${date} full=${true} />`
    : id === 'periods' ? html`<${FormPeriods} full=${true} />`
    : leer;
  return html`
    <${SubTopbar} title=${PAGE_TITEL[id] || 'Karte'} sub=${dayLabel(date, state.today)} back="heute" backLabel="Zurück zu Heute" />
    <main class="view">
      <${DemoBanner} />
      ${inhalt}
      ${openWk ? html`<${WorkoutSheet} item=${openWk} date=${openWk.date || date} onClose=${() => setOpenWk(null)} />` : null}
      ${openNight ? html`<${NightSheet} date=${date} metric=${openNight} onClose=${() => setOpenNight(null)} />` : null}
    </main>`;
}

export function TodayView() {
  const settings = state.repo.settings;
  const vis = (id) => cardOn(settings, id);
  const [openWk, setOpenWk] = useState(null);
  const [openNight, setOpenNight] = useState(null);
  const date = state.date;
  const d = state.results.days.get(date);
  const prev = state.results.days.get(addDays(date, -1));
  const isToday = date === state.today;
  const hasAny = state.results.dates.length > 0 && state.repo.buckets.size > 0;
  const lastSample = state.repo.index.lastSample;
  const firstDay = firstDataDay();
  // Fehlt die Tagesform, sagt die App warum: fehlende Nachtwerte oder noch zu wenig Vergleich
  const gap = d && d.form == null ? formGap(d, settings) : null;
  const now = new Date();
  const gate = isToday && settings.display.hideScoresUntilMorning && !slotDone(state.repo.survey, date, 'morning') && !state.showScoresAnyway && now.getHours() < settings.survey.morningUntilHour && d && (d.recovery != null || d.sleep);
  const showEvening = isToday && now.getHours() >= 17 && !slotDone(state.repo.survey, date, 'evening');
  // Einfügen direkt hier, damit der tägliche Import ein Tipp bleibt: wenn die Daten alt sind oder die Nacht noch fehlt.
  // Kam die Nacht auch mit dem Import des Morgens nicht, bleibt der Hinweis bis 14 Uhr (vielleicht hatte Zepp noch nicht synchronisiert).
  const li = state.lastImport;
  const importedToday = Boolean(li?.parsed) && (li.at || 0) >= new Date(now).setHours(5, 0, 0, 0);
  const nightMissing = isToday && now.getHours() >= 5 && !d?.sleep && d?.hrv == null && (!importedToday || now.getHours() < 14);
  const importReason = !hasAny || !isToday || state.demo || !lastSample ? null
    : nightMissing ? (importedToday ? 'again' : 'night')
    : Date.now() - lastSample > 20 * 3600000 ? 'stale' : null;
  const zone = zoneOf(d?.form, settings);
  const formDelta = d?.form != null && prev?.form != null ? d.form - prev.form : null;
  const rz = zoneOf(d?.recovery, settings);

  const contrib = contribList(d);

  const strainSub = d?.strain == null ? 'keine Pulsdaten' : d.strainPartial ? `bis ${clock(lastSample)}` : d.strengthLoad > 0 ? `inkl. Kraft +${num(d.strengthLoad)}` : `Last ${num(d.load)}`;
  const sleepSub = d?.sleep ? `${hours(d.sleep.asleepMin)} geschlafen` : 'keine Schlafdaten';
  const wkKcal = (d?.workouts || []).reduce((s, w) => s + (w.kcal > 0 ? w.kcal : 0), 0);
  let active7 = null;
  if (d) {
    let sum = 0;
    let n = 0;
    for (let i = 0; i < 7; i++) {
      const x = state.results.days.get(addDays(date, -i));
      if (x?.activeMin != null) {
        sum += x.activeMin;
        n++;
      }
    }
    if (n >= 4) active7 = (sum * 7) / n;
  }
  // VO₂max misst die Uhr nur ab und zu: letzten Wert der vergangenen 30 Tage zeigen
  let vo2 = null;
  let vo2Date = null;
  for (let i = 0; i < 30 && d; i++) {
    const x = state.results.days.get(addDays(date, -i));
    if (x?.vo2 != null) {
      vo2 = x.vo2;
      vo2Date = addDays(date, -i);
      break;
    }
  }

  return html`
    <${Topbar} above=${html`<${HomeSwitch} />`} title=${dayLabel(date, state.today)} sub=${dateFull(date)}
      prev=${{ label: 'Vortag', disabled: !firstDay || date <= firstDay, onClick: () => shiftDate(-1) }}
      next=${{ label: 'Folgetag', disabled: date >= state.today, onClick: () => shiftDate(1) }} />
    <main class="view" id="main">
      <${DemoBanner} />
      <${SyncBanner} />
      ${!hasAny && !state.demo ? html`<${Empty} />` : null}
      ${importReason ? html`<${ImportHint} lastSample=${lastSample} reason=${importReason} />` : null}
      ${isToday && !state.demo ? html`<${EarlyWarnings} /><${DataAlert} />` : null}
      ${gate ? html`<${MorningGate} />` : null}
      ${(gate || !hasAny) && isToday ? html`<${JournalToday} />` : null}
      ${hasAny && !gate && d ? html`
        <section class="hero" aria-label="Tagesform">
          <${Dial} value=${d.form} marks=${[settings.model.recovery.red, settings.model.recovery.green]} muted=${!d.calibrated} />
          <div class="hero-meta">
            ${zone ? html`<${StatusChip} zone=${zone} text=${zone === 'high' ? 'Bereit' : zone === 'mid' ? 'Ausgewogen' : 'Erholung zuerst'} />` : html`<span class="status c-info"><${Icon} name="info" size=${15} />${gap?.short || 'Keine Tagesform'}</span>`}
            ${formDelta != null ? html`<span class="delta">${signed(formDelta)} zum Vortag</span>` : null}
            ${!d.calibrated && d.form != null ? html`<span class="delta">vorläufig</span>` : null}
            <${InfoButton} k="form" value=${d.form} label="Tagesform" />
          </div>
          ${d.form != null ? html`<p class="hero-text">${summarize(d, settings)}</p>`
            : html`<p class="hero-text"><b>${gap.title}.</b> ${gap.text}${gap.short === 'Nachtwerte fehlen' || gap.short === 'Vergleichswerte fehlen' ? html` <button type="button" class="linkbtn" onClick=${() => navigate('profil', 'daten')}>Die letzten Nächte prüfen</button>` : null}</p>`}
        </section>
        ${vis('rings') ? html`<section class="rings" aria-label="Tageswerte">
          <div class="ring-tile">
            <span class="tile-info"><${InfoButton} k="recovery" value=${d.recovery} label="Recovery" /></span>
            <${Ring} value=${d.recovery} color=${zoneClass(d.recovery, settings)} label="Recovery" />
            <div class="ring-label">Recovery</div>
            <div class="ring-sub">${rz ? { high: 'gut erholt', mid: 'mittel', low: 'niedrig' }[rz] : '–'}</div>
          </div>
          <div class="ring-tile">
            <span class="tile-info"><${InfoButton} k="sleepScore" value=${d.sleepScore} label="Schlaf-Score" /></span>
            <${Ring} value=${d.sleepScore} color="c-sleep" label="Schlaf" />
            <div class="ring-label">Schlaf</div>
            <div class="ring-sub">${sleepSub}</div>
          </div>
          <div class="ring-tile">
            <span class="tile-info"><${InfoButton} k="strain" value=${d.strain} label="Strain" /></span>
            <${Ring} value=${d.strain} color="c-strain" label="Strain" />
            <div class="ring-label">Strain${d.strainPartial ? ' heute' : ''}</div>
            <div class="ring-sub">${strainSub}</div>
          </div>
        </section>` : null}
        ${isToday ? html`<${JournalToday} />` : null}
        ${vis('periods') ? html`<${FormPeriods} />` : null}
        <${ProfileHint} />
        <${BackupHint} />
        ${vis('contrib') ? html`<${ContribCard} d=${d} contrib=${contrib} />` : null}
        ${vis('hints') ? html`<${HintsCard} d=${d} />` : null}
        ${showEvening ? html`<section class="card row between">
          <div class="grow"><h3>Abendcheck</h3><p class="small muted">Was heute war, in etwa 30 Sekunden.</p></div>
          <button class="btn primary small" onClick=${() => openCheck('evening', state.today)}>Starten</button>
        </section>` : null}
        ${vis('night') ? html`<${NightCard} d=${d} prev=${prev} onNight=${setOpenNight} />` : null}
        ${vis('sleep') && d.sleep ? html`<${SleepCard} d=${d} onNight=${setOpenNight} />` : null}
        ${vis('detect') ? html`<${DetectCard} date=${date} />` : null}
        ${vis('workouts') ? html`<${WorkoutsCard} onOpen=${setOpenWk} Card=${Card} />` : null}
        ${vis('load') ? html`<${LoadCard} d=${d} date=${date} onOpen=${setOpenWk} />` : null}
        ${vis('environment') ? html`<${Environment} date=${date} />` : null}
      ` : null}
      ${hasAny && !d ? html`<section class="card"><p class="muted">Für diesen Tag gibt es keine Daten.</p></section>` : null}
      ${openWk ? html`<${WorkoutSheet} item=${openWk} date=${openWk.date || date} onClose=${() => setOpenWk(null)} />` : null}
      ${openNight ? html`<${NightSheet} date=${date} metric=${openNight} onClose=${() => setOpenNight(null)} />` : null}
    </main>`;
}
