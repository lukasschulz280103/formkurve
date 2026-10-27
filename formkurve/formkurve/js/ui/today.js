// Ansicht "Heute": Tagesform, Recovery, Schlaf, Strain, Gründe, Vitalwerte, Hinweise.
import { html } from '../vendor/preact-htm.js';
import { state, update, shiftDate, navigate, openCheck, setDemo } from './state.js';
import { Dial, Ring, StatusChip, Contributions, RangeBar, LevelChip, zoneOf, zoneClass } from './components.js';
import { Icon } from './icons.js';
import { num, hours, clock, dayLabel, dateFull, signed, ago } from './format.js';
import { addDays } from '../core/time.js';
import { summarize } from '../model/hints.js';
import { slotDone } from '../survey/engine.js';
import { WORKOUT_LABEL } from '../data/normalize.js';

export function Topbar({ title, sub, nav = false }) {
  const first = state.results.dates[0];
  return html`<header class="topbar">
    ${nav ? html`<button class="iconbtn" aria-label="Vortag" disabled=${!first || state.date <= first} onClick=${() => shiftDate(-1)}><${Icon} name="left" /></button>` : null}
    <div class="grow" style=${nav ? 'text-align:center' : ''}>
      <h1>${title}</h1>
      ${sub ? html`<div class="sub">${sub}</div>` : null}
    </div>
    ${nav ? html`<button class="iconbtn" aria-label="Folgetag" disabled=${state.date >= state.today} onClick=${() => shiftDate(1)}><${Icon} name="right" /></button>` : null}
  </header>`;
}

export function DemoBanner() {
  if (!state.demo) return null;
  return html`<div class="banner demo"><${Icon} name="info" size=${18} />
    <div class="grow"><b>Beispieldaten.</b> Alle Werte sind erfunden und zeigen, wie die App mit 90 Tagen Daten aussieht.
      ${state.preview ? null : html` <button class="linkbtn" onClick=${() => setDemo(false)}>Zu deinen Daten</button>`}</div>
  </div>`;
}

function rangeOf(base, floor, transform = (x) => x) {
  if (!base) return null;
  const s = Math.max(1.4826 * (base.mad || 0), floor);
  return [transform(base.median - s), transform(base.median + s)];
}

function Vital({ name, value, unit, digits = 0, range, z, invert = false }) {
  if (value == null) return null;
  const lo = range?.[0];
  const hi = range?.[1];
  const span = lo != null ? (hi - lo) * 1.6 : 1;
  const min = lo != null ? Math.min(lo - span, value) : 0;
  const max = hi != null ? Math.max(hi + span, value) : 1;
  let note = range ? `normal ${num(lo, digits)}–${num(hi, digits)}` : 'Baseline folgt';
  if (z != null && Math.abs(z) >= 1) note = `${(invert ? -z : z) > 0 ? 'über' : 'unter'} normal`;
  return html`<div class="vital">
    <div class="name">${name}</div>
    <div class="value">${num(value, digits)}<small>${unit}</small></div>
    <div class="range"><${RangeBar} value=${value} lo=${lo} hi=${hi} min=${min} max=${max} /><span class="note">${note}</span></div>
  </div>`;
}

function Empty() {
  return html`<section class="card empty">
    <${Icon} name="heart" size=${34} />
    <h2>Noch keine Daten</h2>
    <p class="ink2" style="max-width:34ch">Lade einmal deinen Apple-Health-Export für die Historie und richte den Kurzbefehl für den täglichen Import ein.</p>
    <div class="row wrap" style="justify-content:center">
      <button class="btn primary" onClick=${() => navigate('daten')}><${Icon} name="import" size=${18} />Daten importieren</button>
      <button class="btn" onClick=${() => setDemo(true)}>Beispieldaten ansehen</button>
    </div>
  </section>`;
}

function MorningGate() {
  return html`<section class="card stack" style="text-align:center;padding:22px 18px">
    <div class="eyebrow">Zuerst du</div>
    <h2 style="font-size:20px">Wie fühlst du dich heute Morgen?</h2>
    <p class="ink2">Beantworte den Morgencheck, bevor du die Zahlen siehst. So vergleicht die App ehrlich, ob Score und Gefühl zusammenpassen.</p>
    <button class="btn primary block" onClick=${() => openCheck('morning', state.today)}>Morgencheck starten · etwa 30 Sekunden</button>
    <button class="linkbtn" onClick=${() => update({ showScoresAnyway: true })}>Scores trotzdem zeigen</button>
  </section>`;
}

export function TodayView() {
  const settings = state.repo.settings;
  const date = state.date;
  const d = state.results.days.get(date);
  const prev = state.results.days.get(addDays(date, -1));
  const isToday = date === state.today;
  const hasAny = state.results.dates.length > 0 && state.repo.buckets.size > 0;
  const lastSample = state.repo.index.lastSample;
  const now = new Date();
  const gate = isToday && settings.display.hideScoresUntilMorning && !slotDone(state.repo.survey, date, 'morning') && !state.showScoresAnyway && now.getHours() < settings.survey.morningUntilHour && d && (d.recovery != null || d.sleep);
  const showEvening = isToday && now.getHours() >= 17 && !slotDone(state.repo.survey, date, 'evening');
  const zone = zoneOf(d?.form, settings);
  const formDelta = d?.form != null && prev?.form != null ? d.form - prev.form : null;
  const rz = zoneOf(d?.recovery, settings);

  const parts = d?.recoveryParts || {};
  const contrib = [
    ['hrv', 'HRV', d?.hrv != null ? `${num(d.hrv)} ms` : ''],
    ['rhr', 'Ruhepuls', d?.rhr != null ? `${num(d.rhr)} bpm` : ''],
    ['sleep', 'Schlaf', d?.sleepScore != null ? `Score ${num(d.sleepScore)}` : ''],
    ['vital', 'Vitalwerte', ''],
    ['subj', 'Gefühl', ''],
  ].filter(([k]) => parts[k] != null).map(([k, label, detail]) => ({ label, value: parts[k], detail }));

  const strainSub = d?.strain == null ? 'keine Pulsdaten' : d.strainPartial ? `bis ${clock(lastSample)}` : d.strengthLoad > 0 ? `inkl. Kraft +${num(d.strengthLoad)}` : `Last ${num(d.load)}`;
  const sleepSub = d?.sleep ? `${hours(d.sleep.asleepMin)} geschlafen` : 'keine Schlafdaten';

  return html`
    <${Topbar} nav=${true} title=${dayLabel(date, state.today)} sub=${dateFull(date)} />
    <main class="view" id="main">
      <${DemoBanner} />
      ${!hasAny && !state.demo ? html`<${Empty} />` : null}
      ${hasAny && isToday && !state.demo && lastSample && Date.now() - lastSample > 20 * 3600000 ? html`<button class="banner" style="text-align:left;cursor:pointer" onClick=${() => navigate('daten')}>
          <${Icon} name="sync" size=${18} /><div class="grow"><b>Letzte Messung ${ago(lastSample)}.</b> Führe den Kurzbefehl „Formkurve Sync“ aus und füge die Daten hier ein.</div></button>` : null}
      ${gate ? html`<${MorningGate} />` : null}
      ${hasAny && !gate && d ? html`
        <section class="hero" aria-label="Tagesform">
          <${Dial} value=${d.form} marks=${[settings.model.recovery.red, settings.model.recovery.green]} muted=${!d.calibrated} />
          <div class="hero-meta">
            ${zone ? html`<${StatusChip} zone=${zone} text=${zone === 'high' ? 'Bereit' : zone === 'mid' ? 'Ausgewogen' : 'Erholung zuerst'} />` : html`<span class="status c-info"><${Icon} name="info" size=${15} />Keine Daten für diese Nacht</span>`}
            ${formDelta != null ? html`<span class="delta">${signed(formDelta)} zum Vortag</span>` : null}
            ${!d.calibrated && d.form != null ? html`<span class="delta">vorläufig</span>` : null}
          </div>
          ${d.form != null ? html`<p class="hero-text">${summarize(d, settings)}</p>` : html`<p class="hero-text">${isToday ? 'Für letzte Nacht liegen noch keine Messwerte vor. Importiere die Daten von heute Morgen.' : 'Für diesen Tag fehlen Messwerte.'}</p>`}
        </section>
        <section class="rings" aria-label="Tageswerte">
          <button class="ring-tile" onClick=${() => navigate('verlauf')} aria-label="Recovery im Verlauf">
            <${Ring} value=${d.recovery} color=${zoneClass(d.recovery, settings)} label="Recovery" />
            <div class="ring-label">Recovery</div>
            <div class="ring-sub">${rz ? { high: 'gut erholt', mid: 'mittel', low: 'niedrig' }[rz] : '–'}</div>
          </button>
          <button class="ring-tile" onClick=${() => navigate('verlauf')} aria-label="Schlaf im Verlauf">
            <${Ring} value=${d.sleepScore} color="c-sleep" label="Schlaf" />
            <div class="ring-label">Schlaf</div>
            <div class="ring-sub">${sleepSub}</div>
          </button>
          <button class="ring-tile" onClick=${() => navigate('verlauf')} aria-label="Strain im Verlauf">
            <${Ring} value=${d.strain} color="c-strain" label="Strain" />
            <div class="ring-label">Strain${d.strainPartial ? ' heute' : ''}</div>
            <div class="ring-sub">${strainSub}</div>
          </button>
        </section>
        ${contrib.length ? html`<section class="card">
          <div class="card-head"><h2>Was deine Recovery bewegt</h2><span class="tiny muted">Punkte</span></div>
          <${Contributions} items=${contrib} />
          <p class="tiny muted" style="margin-top:10px">Gegenüber einem Tag, an dem alles genau deinem Normalwert entspricht (Recovery 50).</p>
        </section>` : null}
        ${d.hints?.length ? html`<section class="card" aria-label="Hinweise">
          ${d.hints.map((h) => html`<div class=${`hint ${{ critical: 'c-crit', warning: 'c-warn', info: 'c-info' }[h.level]}`}>
            <${Icon} name=${h.level === 'info' ? 'info' : 'alert'} size=${20} />
            <div><b>${h.title}</b><p>${h.text}</p></div>
          </div>`)}
        </section>` : null}
        ${showEvening ? html`<section class="card row between">
          <div class="grow"><h3>Abendcheck</h3><p class="small muted">Was heute war, in etwa 45 Sekunden.</p></div>
          <button class="btn primary small" onClick=${() => openCheck('evening', state.today)}>Starten</button>
        </section>` : null}
        <section class="card">
          <div class="card-head"><h2>Letzte Nacht</h2>${d.sleep ? html`<span class="tiny muted tnum">${clock(d.sleep.onset)}–${clock(d.sleep.wake)}</span>` : null}</div>
          <div class="vitals">
            <${Vital} name="HRV" value=${d.hrv} unit="ms" range=${rangeOf(d.base?.lnHrv, 0.06, Math.exp)} z=${d.z?.hrv} />
            <${Vital} name=${`Ruhepuls${d.rhrSource === 'Apple Health' ? ' (Apple Health)' : ''}`} value=${d.rhr} unit="bpm" range=${rangeOf(d.base?.rhr, 1.5)} z=${d.z?.rhr} />
            <${Vital} name="Atemfrequenz" value=${d.resp} unit="/min" digits=${1} range=${rangeOf(d.base?.resp, 0.4)} z=${d.z?.resp} />
            <${Vital} name="Blutsauerstoff" value=${d.spo2} unit="%" digits=${1} range=${rangeOf(d.base?.spo2, 0.7)} z=${d.z?.spo2} />
            <${Vital} name="Hauttemperatur" value=${d.temp} unit="°C" digits=${1} range=${rangeOf(d.base?.temp, 0.15)} z=${d.z?.temp} />
          </div>
          ${d.hrv == null && d.rhr == null ? html`<p class="small muted">Keine Nachtwerte. Prüfe, ob Zepp HRV und Herzfrequenz an Apple Health schreibt.</p>` : null}
        </section>
        ${d.sleep ? html`<section class="card">
          <div class="card-head"><h2>Schlaf</h2><span class="tiny muted">Bedarf ${hours(d.sleepNeedH * 60)}</span></div>
          <dl class="kv">
            <dt>Geschlafen</dt><dd>${hours(d.sleep.asleepMin)}</dd>
            ${d.sleepDebtH > 0.1 ? html`<dt>Fehlt zum Bedarf</dt><dd>${hours(d.sleepDebtH * 60)}</dd>` : null}
            <dt>Effizienz</dt><dd>${num(d.sleep.efficiency * 100)} %</dd>
            ${d.sleep.hasStages ? html`<dt>Tiefschlaf</dt><dd>${hours(d.sleep.deepMin)}</dd><dt>REM</dt><dd>${hours(d.sleep.remMin)}</dd>` : null}
            ${d.sleep.latencyMin != null ? html`<dt>Eingeschlafen nach</dt><dd>${num(d.sleep.latencyMin)} min</dd>` : null}
            <dt>Aufwachphasen</dt><dd>${d.sleep.wakeEpisodes}</dd>
            ${d.sleepParts?.regularity != null ? html`<dt>Regelmäßigkeit (7 Tage)</dt><dd>${num(d.sleepParts.regularity)} / 100</dd>` : null}
          </dl>
        </section>` : null}
        <section class="card">
          <div class="card-head"><h2>Belastung</h2>${d.balance != null ? html`<span class="tiny muted">Balance ${num(d.balance)}</span>` : null}</div>
          <dl class="kv">
            ${d.load != null ? html`<dt>${d.strainPartial ? 'Last bisher (Puls)' : 'Last (Puls)'}</dt><dd>${num(d.trimp || 0)}</dd>` : null}
            ${d.strengthLoad > 0 ? html`<dt>Kraft-Zuschlag</dt><dd>+${num(d.strengthLoad)}</dd>` : null}
            ${d.acwr != null ? html`<dt>7 Tage zu 28 Tagen</dt><dd>${num(d.acwr, 2)}</dd>` : null}
            ${d.steps != null ? html`<dt>Schritte</dt><dd>${num(d.steps)}</dd>` : null}
            ${d.fitness != null ? html`<dt>Langzeit-Fitness</dt><dd>${num(d.fitness)}</dd>` : null}
          </dl>
          ${d.workouts?.length ? html`<hr class="divider" />${d.workouts.map((w) => html`<div class="row between small" style="padding:4px 0">
            <span><b>${WORKOUT_LABEL[w.kind] || 'Training'}</b> <span class="muted">${clock(w.t)} · ${num(w.durMin)} min</span></span>
            <span class="muted tnum">${w.avgHr ? `Ø ${num(w.avgHr)} bpm` : ''}</span></div>`)}` : null}
          ${d.load == null && !d.workouts?.length ? html`<p class="small muted">Keine Pulsdaten für diesen Tag.</p>` : null}
        </section>
      ` : null}
      ${hasAny && !d ? html`<section class="card"><p class="muted">Für diesen Tag gibt es keine Daten.</p></section>` : null}
    </main>`;
}
