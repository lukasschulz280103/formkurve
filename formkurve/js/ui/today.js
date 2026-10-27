// Ansicht "Heute": Tagesform, Recovery, Schlaf, Strain, Gründe, Vitalwerte, Umwelt, Hinweise.
import { html } from '../vendor/preact-htm.js';
import { state, update, shiftDate, navigate, openCheck, tryDemo, leaveDemo, patchSettings, useCurrentLocation, toast } from './state.js';
import { Dial, Ring, StatusChip, Contributions, RangeBar, zoneOf, zoneClass } from './components.js';
import { InfoButton } from './info.js';
import { Icon } from './icons.js';
import { num, hours, clock, dayLabel, dateFull, signed, ago } from './format.js';
import { addDays } from '../core/time.js';
import { summarize } from '../model/hints.js';
import { slotDone } from '../survey/engine.js';
import { WORKOUT_LABEL } from '../data/normalize.js';
import { formatPlace } from '../context/location.js';

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
      ${state.preview ? null : html` <button class="linkbtn" onClick=${leaveDemo}>Konto anlegen oder anmelden</button>`}</div>
  </div>`;
}

function rangeOf(base, floor, transform = (x) => x) {
  if (!base) return null;
  const s = Math.max(1.4826 * (base.mad || 0), floor);
  return [transform(base.median - s), transform(base.median + s)];
}

function Vital({ name, k, value, unit, digits = 0, range, z }) {
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
    <div class="range"><${RangeBar} value=${value} lo=${lo} hi=${hi} min=${min} max=${max} /><span class="note">${note}</span></div>
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
      <button class="btn primary" onClick=${() => navigate('daten')}><${Icon} name="import" size=${18} />Daten importieren</button>
      <button class="btn" onClick=${tryDemo}>Beispieldaten ansehen</button>
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

function ProfileHint() {
  const s = state.repo.settings;
  if (state.demo || s.display.profileHintDismissed || (s.profile.birthYear && s.profile.sex) || state.results.dates.length < 3) return null;
  return html`<section class="card stack">
    <div class="row between" style="align-items:flex-start"><h3>Genauere Normalwerte</h3><${Icon} name="info" size=${18} /></div>
    <p class="small ink2">Mit Geburtsjahr und Geschlecht ordnet die App Schlafdauer, Schritte und Maximalpuls passend zu deinem Alter ein. Freiwillig.</p>
    <div class="row wrap">
      <button class="btn small primary" onClick=${() => {
        navigate('daten');
        setTimeout(() => document.getElementById('profil')?.scrollIntoView({ block: 'start' }), 80);
      }}>Profil ergänzen</button>
      <button class="btn small ghost" onClick=${() => patchSettings('display.profileHintDismissed', true)}>Nicht jetzt</button>
    </div>
  </section>`;
}

function Environment({ date }) {
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
  return html`<section class="card">
    <div class="card-head"><h2>Umwelt</h2><span class="tiny muted" style="text-align:right">${formatPlace(s.context.place)}</span></div>
    <dl class="kv">
      ${night?.nightTempMin != null ? html`<${KV} label="Nacht, Tiefstwert" value=${`${num(night.nightTempMin, 1)} °C`} k="nightTemp" infoValue=${night.nightTempMin} />` : null}
      ${night?.nightHumidity != null ? html`<${KV} label="Luftfeuchte nachts" value=${`${num(night.nightHumidity)} %`} k="humidity" infoValue=${night.nightHumidity} />` : null}
      ${today?.tMax != null ? html`<${KV} label="Höchstwert heute" value=${`${num(today.tMax, 1)} °C`} k="dayTemp" infoValue=${today.tMax} />` : null}
      ${pm != null ? html`<${KV} label="Feinstaub PM2,5" value=${html`${num(pm, 1)} µg/m³ <span class=${`status ${pm > 15 ? 'c-warn' : 'c-good'}`} style="padding:1px 8px;font-size:11px;margin-left:4px">${pm > 15 ? 'über WHO' : 'unter WHO'}</span>`} k="pm25" infoValue=${pm} />` : null}
      ${today?.pollenMax != null ? html`<${KV} label="Pollen (Spitze)" value=${`${num(today.pollenMax)} /m³`} k="pollen" infoValue=${today.pollenMax} />` : null}
      ${today?.daylightH != null ? html`<${KV} label="Tageslänge" value=${`${num(today.daylightH, 1)} h`} k="daylight" infoValue=${today.daylightH} />` : null}
    </dl>
    ${state.demo ? html`<p class="tiny muted" style="margin-top:10px">Erfundene Beispielwerte</p>` : state.repo.meta.lastContext ? html`<p class="tiny muted" style="margin-top:10px">Stand ${ago(state.repo.meta.lastContext)} · Open-Meteo, CAMS</p>` : null}
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
            <${InfoButton} k="form" value=${d.form} label="Tagesform" />
          </div>
          ${d.form != null ? html`<p class="hero-text">${summarize(d, settings)}</p>` : html`<p class="hero-text">${isToday ? 'Für letzte Nacht liegen noch keine Messwerte vor. Importiere die Daten von heute Morgen.' : 'Für diesen Tag fehlen Messwerte.'}</p>`}
        </section>
        <section class="rings" aria-label="Tageswerte">
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
        </section>
        <${ProfileHint} />
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
            <${Vital} name="HRV" k="hrv" value=${d.hrv} unit="ms" range=${rangeOf(d.base?.lnHrv, 0.06, Math.exp)} z=${d.z?.hrv} />
            <${Vital} name=${`Ruhepuls${d.rhrSource === 'Apple Health' ? ' (Apple Health)' : ''}`} k="rhr" value=${d.rhr} unit="bpm" range=${rangeOf(d.base?.rhr, 1.5)} z=${d.z?.rhr} />
            <${Vital} name="Atemfrequenz" k="resp" value=${d.resp} unit="/min" digits=${1} range=${rangeOf(d.base?.resp, 0.4)} z=${d.z?.resp} />
            <${Vital} name="Blutsauerstoff" k="spo2" value=${d.spo2} unit="%" digits=${1} range=${rangeOf(d.base?.spo2, 0.7)} z=${d.z?.spo2} />
            <${Vital} name="Hauttemperatur" k="temp" value=${d.temp} unit="°C" digits=${1} range=${rangeOf(d.base?.temp, 0.15)} z=${d.z?.temp} />
          </div>
          ${d.hrv == null && d.rhr == null ? html`<p class="small muted">Keine Nachtwerte. Prüfe, ob Zepp HRV und Herzfrequenz an Apple Health schreibt.</p>` : null}
          <p class="tiny muted" style="margin-top:8px">Der graue Balken ist dein persönlicher Normalbereich. Das (i) zeigt die allgemeinen Richtwerte.</p>
        </section>
        ${d.sleep ? html`<section class="card">
          <div class="card-head"><h2>Schlaf</h2><span class="tiny muted row" style="gap:2px">Bedarf ${hours(d.sleepNeedH * 60)}<${InfoButton} k="sleepNeed" value=${d.sleepNeedH} label="Schlafbedarf" /></span></div>
          <dl class="kv">
            <${KV} label="Geschlafen" value=${hours(d.sleep.asleepMin)} k="asleep" infoValue=${d.sleep.asleepMin} />
            ${d.sleepDebtH > 0.1 ? html`<${KV} label="Fehlt zum Bedarf" value=${hours(d.sleepDebtH * 60)} />` : null}
            <${KV} label="Effizienz" value=${`${num(d.sleep.efficiency * 100)} %`} k="efficiency" infoValue=${d.sleep.efficiency} />
            ${d.sleep.hasStages ? html`<${KV} label="Tiefschlaf" value=${`${hours(d.sleep.deepMin)} · ${num(d.sleep.deepPct * 100)} %`} k="deep" infoValue=${d.sleep.deepMin} extra=${{ pct: d.sleep.deepPct }} />
              <${KV} label="REM" value=${`${hours(d.sleep.remMin)} · ${num(d.sleep.remPct * 100)} %`} k="rem" infoValue=${d.sleep.remMin} extra=${{ pct: d.sleep.remPct }} />` : null}
            ${d.sleep.latencyMin != null ? html`<${KV} label="Eingeschlafen nach" value=${`${num(d.sleep.latencyMin)} min`} k="latency" infoValue=${d.sleep.latencyMin} />` : null}
            <${KV} label="Aufwachphasen" value=${d.sleep.wakeEpisodes} k="wake" infoValue=${d.sleep.wakeEpisodes} />
            ${d.sleepParts?.regularity != null ? html`<${KV} label="Regelmäßigkeit (7 Tage)" value=${`${num(d.sleepParts.regularity)} / 100`} k="regularity" infoValue=${d.sleepParts.regularity} />` : null}
          </dl>
        </section>` : null}
        <section class="card">
          <div class="card-head"><h2>Belastung</h2></div>
          <dl class="kv">
            ${d.load != null ? html`<${KV} label=${d.strainPartial ? 'Last bisher' : 'Last'} value=${num(d.load)} k="load" infoValue=${d.load} />` : null}
            ${d.strengthLoad > 0 ? html`<${KV} label="davon Kraft-Zuschlag" value=${`+${num(d.strengthLoad)}`} />` : null}
            ${active7 != null ? html`<${KV} label="Aktivminuten (7 Tage)" value=${num(active7)} k="activeMin" infoValue=${active7} />` : null}
            ${d.acwr != null ? html`<${KV} label="7 zu 28 Tage" value=${num(d.acwr, 2)} k="acwr" infoValue=${d.acwr} />` : null}
            ${d.steps != null ? html`<${KV} label="Schritte" value=${num(d.steps)} k="steps" infoValue=${d.steps} />` : null}
            ${vo2 != null ? html`<${KV} label="VO₂max (Schätzung)" value=${html`${num(vo2, 1)}${vo2Date !== date ? html` <span class="tiny muted">· ${dayLabel(vo2Date, state.today)}</span>` : null}`} k="vo2" infoValue=${vo2} />` : null}
            ${d.fitness != null ? html`<${KV} label="Langzeit-Fitness" value=${num(d.fitness)} k="fitness" infoValue=${d.fitness} />` : null}
          </dl>
          ${d.workouts?.length ? html`<hr class="divider" />${d.workouts.map((w) => html`<div class="row between small" style="padding:4px 0">
            <span><b>${WORKOUT_LABEL[w.kind] || 'Training'}</b> <span class="muted">${clock(w.t)} · ${num(w.durMin)} min</span></span>
            <span class="muted tnum">${w.avgHr ? `Ø ${num(w.avgHr)} bpm` : ''}</span></div>`)}` : null}
          ${d.load == null && !d.workouts?.length ? html`<p class="small muted">Keine Pulsdaten für diesen Tag.</p>` : null}
        </section>
        <${Environment} date=${date} />
      ` : null}
      ${hasAny && !d ? html`<section class="card"><p class="muted">Für diesen Tag gibt es keine Daten.</p></section>` : null}
    </main>`;
}
