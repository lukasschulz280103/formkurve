// Die Nacht im Detail: Schlafphasen als Verlauf wie in der Health-App, dazu der
// Verlauf einzelner Messwerte – wahlweise für die Nacht, die Woche, den Monat oder
// das halbe Jahr. Geöffnet über einen Tipp auf einen Wert unter „Letzte Nacht“.
import { html, useState, useEffect, useRef, useMemo } from '../vendor/preact-htm.js';
import { state } from './state.js';
import { num } from './format.js';
import { isNum, mean, median } from '../core/stats.js';
import { addDays } from '../core/time.js';
import { SLEEP } from '../data/normalize.js';

const MIN = 60000;
const clock = (ms) => new Date(ms).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
const dayShort = (k) => new Date(`${k}T12:00:00`).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
const wday = (k) => ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][new Date(`${k}T12:00:00`).getDay()];
const hhmm = (min) => `${Math.floor(min / 60)}:${String(Math.round(min % 60)).padStart(2, '0')} h`;

// Reihenfolge wie in der Health-App: Wach oben, Tief unten
export const STAGES = [
  { code: SLEEP.AWAKE, id: 'awake', label: 'Wach', color: 'var(--st-awake)' },
  { code: SLEEP.REM, id: 'rem', label: 'REM', color: 'var(--st-rem)' },
  { code: SLEEP.CORE, id: 'core', label: 'Kern', color: 'var(--st-core)' },
  { code: SLEEP.DEEP, id: 'deep', label: 'Tief', color: 'var(--st-deep)' },
];
const LANE = new Map(STAGES.map((s, i) => [s.code, i]));

export const METRICS = [
  { id: 'sleep', label: 'Schlaf', unit: '' },
  { id: 'hrv', label: 'HRV', unit: 'ms', type: 'hrv', fmt: (v) => num(v) },
  { id: 'rhr', label: 'Puls', unit: 'bpm', type: 'hr', fmt: (v) => num(v) },
  { id: 'resp', label: 'Atmung', unit: '/min', type: 'resp', fmt: (v) => num(v, 1) },
  { id: 'spo2', label: 'Sauerstoff', unit: '%', type: 'spo2', fmt: (v) => num(v, 1) },
];

const RANGES = [
  { id: 'nacht', label: 'Nacht' },
  { id: 'woche', label: 'Woche', days: 7 },
  { id: 'monat', label: 'Monat', days: 30 },
  { id: 'halb', label: '6 M', days: 182 },
];

/** Schlafabschnitte der Nacht aus den Rohdaten, zusammenhängend und ohne „Im Bett“. */
export function nightSegments(index, sleep) {
  if (!sleep) return [];
  const w = index.window('sleep', sleep.start - 30 * MIN, sleep.end + 30 * MIN);
  const segs = [];
  for (let i = 0; i < w.t.length; i++) {
    const v = w.v[i];
    if (v === SLEEP.INBED) continue;
    const t = Math.max(w.t[i], sleep.start);
    const e = Math.min(w.e?.[i] ?? w.t[i], sleep.end);
    if (e <= t) continue;
    segs.push({ t, e, v: LANE.has(v) ? v : SLEEP.CORE });
  }
  segs.sort((a, b) => a.t - b.t || a.e - b.e);
  // Überlappungen auflösen: der spätere Abschnitt gewinnt, wie in der Health-App
  const out = [];
  for (const s of segs) {
    const last = out[out.length - 1];
    if (last && s.t < last.e) {
      if (s.e <= last.e && s.v === last.v) continue;
      last.e = Math.min(last.e, s.t);
      if (last.e <= last.t) out.pop();
    }
    out.push({ ...s });
  }
  return out.filter((s) => s.e > s.t);
}

/** Verlauf der Schlafphasen als Spuren, wie in der Health-App eingefärbt. */
function Hypnogram({ segs, sleep }) {
  const span = sleep.end - sleep.start;
  if (!segs.length || span <= 0) return null;
  const pct = (ms) => `${((ms - sleep.start) / span) * 100}%`;
  const ticks = [];
  const first = new Date(sleep.start);
  first.setMinutes(0, 0, 0);
  for (let t = first.getTime(); t <= sleep.end; t += 3 * 3600000) {
    if (t < sleep.start) continue;
    ticks.push(t);
  }
  return html`<div class="hypno">
    ${STAGES.map((st) => html`<div class="lane" key=${st.id}>
      <span class="lane-name">${st.label}</span>
      <div class="track">
        ${ticks.map((t) => html`<i class="grid" key=${t} style=${`left:${pct(t)}`}></i>`)}
        ${segs.filter((s) => s.v === st.code).map((s) => html`<i key=${s.t} class="seg"
          style=${`left:${pct(s.t)};width:max(3px,${((s.e - s.t) / span) * 100}%);background:${st.color}`}
          title=${`${st.label} ${clock(s.t)}–${clock(s.e)}`}></i>`)}
      </div>
    </div>`)}
    <div class="lane axis">
      <span class="lane-name"></span>
      <div class="track">${ticks.map((t) => html`<span class="tick" key=${t} style=${`left:${pct(t)}`}>${clock(t)}</span>`)}</div>
    </div>
  </div>`;
}

/** Linie eines Messwerts über die Nacht, mit dem eigenen Normalbereich im Hintergrund. */
function NightCurve({ points, base, color, fmt, unit, from, to }) {
  if (points.length < 2) return html`<p class="small muted">Für diese Nacht gibt es keine einzelnen Messwerte.</p>`;
  const vals = points.map((p) => p.v);
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  if (isNum(base?.median)) {
    lo = Math.min(lo, base.median - (base.mad || 0) * 1.5);
    hi = Math.max(hi, base.median + (base.mad || 0) * 1.5);
  }
  const pad = (hi - lo) * 0.12 || 1;
  lo -= pad;
  hi += pad;
  const W = 1000;
  const H = 150;
  const x = (t) => ((t - from) / Math.max(1, to - from)) * W;
  const y = (v) => H - ((v - lo) / (hi - lo)) * H;
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)} ${y(p.v).toFixed(1)}`).join(' ');
  const bandTop = isNum(base?.median) ? y(base.median + (base.mad || 0)) : null;
  const bandBottom = isNum(base?.median) ? y(base.median - (base.mad || 0)) : null;
  return html`<div class="nightchart">
    <div class="axis-y"><span>${fmt(hi)}</span><span>${fmt(lo)}</span></div>
    <svg viewBox=${`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label=${`Verlauf von ${clock(from)} bis ${clock(to)}`}>
      ${bandTop != null ? html`<rect x="0" y=${Math.min(bandTop, bandBottom)} width=${W} height=${Math.abs(bandBottom - bandTop)} fill="var(--ink)" fill-opacity="0.07" />` : null}
      ${isNum(base?.median) ? html`<line x1="0" x2=${W} y1=${y(base.median)} y2=${y(base.median)} stroke="var(--ink-2)" stroke-dasharray="4 4" stroke-width="1" vector-effect="non-scaling-stroke" />` : null}
      <path d=${d} fill="none" stroke=${color} stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" />
    </svg>
    <div class="ticks"><span>${clock(from)}</span><span>${clock(to)}</span></div>
    ${isNum(base?.median) ? html`<p class="tiny muted">Gestrichelt: dein Schnitt der Nächte davor (${fmt(base.median)}${unit ? ` ${unit}` : ''}), grau hinterlegt dein üblicher Bereich.</p>` : null}
  </div>`;
}

/** Mehrere Nächte: Schlaf als gestapelte Phasen, Messwerte als Punkte je Nacht. */
function RangeChart({ dates, metric, results, onPick }) {
  const H = 150;
  if (metric.id === 'sleep') {
    const rows = dates.map((k) => ({ k, s: results.days.get(k)?.sleep || null }));
    const maxH = Math.max(6, ...rows.map((r) => (r.s ? r.s.inBedMin / 60 : 0)));
    return html`<div class="rangechart">
      <div class="axis-y"><span>${num(maxH, 1)} h</span><span>0</span></div>
      <div class="bars" style=${`height:${H}px`}>
        ${rows.map(({ k, s }) => html`<button type="button" class="bar" key=${k} title=${k} onClick=${() => onPick(k)}>
          ${s ? STAGES.slice().reverse().map((st) => {
            const m = st.id === 'deep' ? s.deepMin : st.id === 'rem' ? s.remMin : st.id === 'core' ? s.coreMin : s.awakeMin;
            return isNum(m) && m > 0 ? html`<i key=${st.id} style=${`height:${(m / 60 / maxH) * 100}%;background:${st.color}`}></i>` : null;
          }) : null}
        </button>`)}
      </div>
      <div class="ticks"><span>${dayShort(dates[0])}</span><span>${dayShort(dates[dates.length - 1])}</span></div>
    </div>`;
  }
  const vals = dates.map((k) => results.days.get(k)?.[metric.id]);
  const nums = vals.filter(isNum);
  if (!nums.length) return html`<p class="small muted">Für diesen Zeitraum gibt es keine Werte.</p>`;
  const lo = Math.min(...nums) * 0.97;
  const hi = Math.max(...nums) * 1.03;
  const mid = median(nums);
  return html`<div class="rangechart">
    <div class="axis-y"><span>${metric.fmt(hi)}</span><span>${metric.fmt(lo)}</span></div>
    <div class="bars dots" style=${`height:${H}px`}>
      ${dates.map((k, i) => html`<button type="button" class="bar" key=${k} title=${`${dayShort(k)}: ${isNum(vals[i]) ? metric.fmt(vals[i]) : 'kein Wert'}`} onClick=${() => onPick(k)}>
        ${isNum(vals[i]) ? html`<i class="dot" style=${`bottom:${((vals[i] - lo) / (hi - lo)) * 100}%`}></i>` : null}
      </button>`)}
      <i class="median" style=${`bottom:${((mid - lo) / (hi - lo)) * 100}%`}></i>
    </div>
    <div class="ticks"><span>${dayShort(dates[0])}</span><span>Mittel ${metric.fmt(mid)}</span><span>${dayShort(dates[dates.length - 1])}</span></div>
  </div>`;
}

/** Das Blatt selbst. `metric` legt fest, womit es öffnet. */
export function NightSheet({ date, metric = 'sleep', onClose }) {
  const [sel, setSel] = useState(metric);
  const [range, setRange] = useState('nacht');
  const [day, setDay] = useState(date);
  const ref = useRef(null);
  const repo = state.repo;
  const res = state.results;
  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    ref.current?.focus();
    return () => window.removeEventListener('keydown', esc);
  }, []);
  const d = res?.days?.get(day);
  const m = METRICS.find((x) => x.id === sel) || METRICS[0];
  const sleep = d?.sleep || null;
  const segs = useMemo(() => (sleep ? nightSegments(repo.index, sleep) : []), [day, sleep?.start]);
  const points = useMemo(() => {
    if (range !== 'nacht' || !sleep || !m.type) return [];
    const w = repo.index.window(m.type, sleep.start, sleep.end);
    const out = [];
    for (let i = 0; i < w.t.length; i++) if (isNum(w.v[i])) out.push({ t: w.t[i], v: w.v[i] });
    return out.sort((a, b) => a.t - b.t);
  }, [day, sel, range, sleep?.start]);
  const r = RANGES.find((x) => x.id === range);
  const dates = useMemo(() => {
    if (!r?.days || !res) return [];
    const out = [];
    for (let i = r.days - 1; i >= 0; i--) {
      const k = addDays(day, -i);
      if (res.days.has(k)) out.push(k);
    }
    return out;
  }, [day, range]);

  const stageRows = sleep && sleep.hasStages ? [
    ['Tief', sleep.deepMin, 'var(--st-deep)'],
    ['REM', sleep.remMin, 'var(--st-rem)'],
    ['Kern', sleep.coreMin, 'var(--st-core)'],
    ['Wach', sleep.awakeMin, 'var(--st-awake)'],
  ] : [];

  return html`<div class="scrim" onClick=${(e) => e.target === e.currentTarget && onClose()}>
    <div class="sheet night" role="dialog" aria-modal="true" aria-labelledby="n-title" tabIndex="-1" ref=${ref}>
      <div class="sheet-head">
        <div>
          <span class="tiny muted">${wday(day)}, ${dayShort(day)}${sleep ? ` · ${clock(sleep.start)}–${clock(sleep.end)}` : ''}</span>
          <h2 id="n-title">${m.id === 'sleep' ? 'Schlaf' : m.label}</h2>
        </div>
        <button type="button" class="round" onClick=${onClose} aria-label="Schließen">
          <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" /></svg>
        </button>
      </div>
      <div class="seg" role="group" aria-label="Zeitraum">
        ${RANGES.map((x) => html`<button type="button" key=${x.id} aria-pressed=${range === x.id ? 'true' : 'false'} onClick=${() => setRange(x.id)}>${x.label}</button>`)}
      </div>
      <div class="chips" role="group" aria-label="Wert">
        ${METRICS.map((x) => html`<button type="button" class="chip small" key=${x.id} aria-pressed=${sel === x.id ? 'true' : 'false'} onClick=${() => setSel(x.id)}>${x.label}</button>`)}
      </div>

      ${range === 'nacht' ? (m.id === 'sleep'
        ? (sleep ? html`<div class="stack-s">
            <div class="row between"><b>${hhmm(sleep.asleepMin)} geschlafen</b><span class="muted small">${hhmm(sleep.inBedMin)} im Bett</span></div>
            <${Hypnogram} segs=${segs} sleep=${sleep} />
            ${stageRows.length ? html`<dl class="stagelist">
              ${stageRows.map(([label, min, color]) => html`<div key=${label}><dt><i style=${`background:${color}`}></i>${label}</dt>
                <dd>${hhmm(min || 0)}<span class="muted"> · ${num(((min || 0) / sleep.inBedMin) * 100)} %</span></dd></div>`)}
            </dl>` : html`<p class="small muted">Dein Band hat für diese Nacht keine Phasen geliefert, nur Schlaf und Wachzeit.</p>`}
          </div>` : html`<p class="small muted">Für diese Nacht gibt es keine Schlafanalyse.</p>`)
        : (sleep ? html`<${NightCurve} points=${points} base=${d?.base?.[sel === 'rhr' ? 'rhr' : sel]} color=${sel === 'rhr' ? 'var(--crit)' : 'var(--accent)'}
            fmt=${m.fmt} unit=${m.unit} from=${sleep.start} to=${sleep.end} />`
          : html`<p class="small muted">Für diese Nacht gibt es keine Schlafzeiten, also auch keinen Verlauf.</p>`))
        : html`<${RangeChart} dates=${dates} metric=${m} results=${res} onPick=${(k) => { setDay(k); setRange('nacht'); }} />`}

      ${range !== 'nacht' && dates.length ? html`<p class="tiny muted">Tippe auf eine Nacht, um sie einzeln zu sehen. ${dates.length} von ${r.days} Tagen haben Daten.</p>` : null}
      ${range === 'nacht' && m.id !== 'sleep' && points.length ? html`<p class="tiny muted">${points.length} Messwerte zwischen ${clock(sleep.start)} und ${clock(sleep.end)}.</p>` : null}
    </div>
  </div>`;
}
