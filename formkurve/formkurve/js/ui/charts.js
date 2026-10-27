// Zeitreihen-Diagramm (Linien, Balken, Normalbereich) mit Fadenkreuz-Tooltip und Tastaturbedienung.
import { html, useRef, useState, useEffect, useLayoutEffect } from '../vendor/preact-htm.js';
import { dateShort, dateLong, num } from './format.js';

function useWidth(ref, fallback = 340) {
  const [w, setW] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => setW(Math.max(200, Math.round(el.getBoundingClientRect().width)));
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return w;
}

const isNum = (x) => typeof x === 'number' && Number.isFinite(x);

function linePath(points) {
  let d = '';
  let pen = false;
  for (const p of points) {
    if (!p) {
      pen = false;
      continue;
    }
    d += `${pen ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`;
    pen = true;
  }
  return d;
}

function bandPaths(xs, lo, hi, y) {
  const out = [];
  let seg = [];
  const flush = () => {
    if (seg.length > 1) {
      const top = seg.map((i) => `${xs[i].toFixed(1)},${y(hi[i]).toFixed(1)}`);
      const bot = seg.slice().reverse().map((i) => `${xs[i].toFixed(1)},${y(lo[i]).toFixed(1)}`);
      out.push(`M${top.join('L')}L${bot.join('L')}Z`);
    }
    seg = [];
  };
  for (let i = 0; i < xs.length; i++) {
    if (isNum(lo[i]) && isNum(hi[i])) seg.push(i);
    else flush();
  }
  flush();
  return out;
}

function barPath(x, w, y0, y1) {
  const h = y0 - y1;
  if (h <= 0.5) return '';
  const r = w >= 8 ? Math.min(4, w / 2, h) : 0;
  if (!r) return `M${x},${y0}V${y1}H${x + w}V${y0}Z`;
  return `M${x},${y0}V${y1 + r}Q${x},${y1} ${x + r},${y1}H${x + w - r}Q${x + w},${y1} ${x + w},${y1 + r}V${y0}Z`;
}

/**
 * series: [{ key, label, values, color, type: 'line'|'bar', colorFn?, strong? }]
 * band: { lo, hi, label } in y-Einheiten
 */
export function TimeChart({ dates, series, band = null, yDomain, yTicks, height = 168, fmt = (v) => num(v), tickFmt = null, refLines = [], label = 'Diagramm', endLabel = true }) {
  const ref = useRef(null);
  const width = useWidth(ref);
  const [hover, setHover] = useState(null);
  const n = dates.length;
  const m = { l: 34, r: endLabel ? 36 : 10, t: 10, b: 24 };
  const pw = Math.max(10, width - m.l - m.r);
  const ph = height - m.t - m.b;
  const step = pw / Math.max(1, n);
  const xs = dates.map((_, i) => m.l + (i + 0.5) * step);

  let [y0, y1] = yDomain || [0, 1];
  if (!yDomain) {
    const vals = series.flatMap((s) => s.values).concat(band ? band.lo.concat(band.hi) : []).filter(isNum);
    const lo = vals.length ? Math.min(...vals) : 0;
    const hi = vals.length ? Math.max(...vals) : 1;
    const pad = (hi - lo) * 0.12 || 1;
    y0 = Math.floor(lo - pad);
    y1 = Math.ceil(hi + pad);
  }
  const y = (v) => m.t + ph - ((v - y0) / (y1 - y0 || 1)) * ph;
  const ticks = yTicks || niceTicks(y0, y1);

  const labelIdx = xLabelIndices(n, pw);

  useEffect(() => setHover(null), [n]);

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * width;
    const i = Math.floor((x - m.l) / step);
    if (i >= 0 && i < n) setHover(i);
  };
  const onKey = (e) => {
    if (e.key === 'ArrowLeft') setHover((h) => Math.max(0, (h ?? n) - 1));
    else if (e.key === 'ArrowRight') setHover((h) => Math.min(n - 1, (h ?? -1) + 1));
    else if (e.key === 'Escape') setHover(null);
    else return;
    e.preventDefault();
  };

  const bars = series.filter((s) => s.type === 'bar');
  const lines = series.filter((s) => s.type !== 'bar');
  const bw = bars.length ? Math.max(1, Math.min(24, step >= 6 ? step * 0.66 : step - 1)) : 0;
  const zeroY = y(Math.max(y0, 0));

  let lastIdx = -1;
  if (lines[0]) for (let i = n - 1; i >= 0; i--) if (isNum(lines[0].values[i])) { lastIdx = i; break; }
  if (lastIdx < 0 && bars[0]) for (let i = n - 1; i >= 0; i--) if (isNum(bars[0].values[i])) { lastIdx = i; break; }
  const endSeries = lines[0] || bars[0];

  const tipLeft = hover == null ? 0 : Math.min(Math.max(xs[hover] - 70, 0), width - 150);

  return html`<div class="chart" ref=${ref} tabindex="0" role="img" aria-label=${label}
      onPointerMove=${onMove} onPointerDown=${onMove} onPointerLeave=${() => setHover(null)} onKeyDown=${onKey} onBlur=${() => setHover(null)}>
    <svg viewBox=${`0 0 ${width} ${height}`} height=${height} preserveAspectRatio="none">
      ${ticks.map((t) => html`<line class=${t === y0 ? 'base' : 'grid'} x1=${m.l} x2=${m.l + pw} y1=${y(t)} y2=${y(t)} />
        <text class="tick-label" x=${m.l - 6} y=${y(t)} dy="0.32em" text-anchor="end">${(tickFmt || fmt)(t)}</text>`)}
      ${band && bandPaths(xs, band.lo, band.hi, y).map((d) => html`<path class="band" d=${d} />`)}
      ${refLines.map((r) => html`<line class="ref" x1=${m.l} x2=${m.l + pw} y1=${y(r.y)} y2=${y(r.y)} />`)}
      ${bars.map((s, k) => s.values.map((v, i) => {
        if (!isNum(v)) return null;
        const bx = xs[i] - bw / 2 + (bars.length > 1 ? (k - (bars.length - 1) / 2) * bw : 0);
        return html`<path d=${barPath(bx, bw, zeroY, y(Math.max(v, y0)))} style=${`fill:${s.colorFn ? s.colorFn(v, i) : s.color};opacity:${hover == null || hover === i ? 1 : 0.55}`} />`;
      }))}
      ${lines.map((s) => html`<path d=${linePath(s.values.map((v, i) => (isNum(v) ? [xs[i], y(v)] : null)))} fill="none" style=${`stroke:${s.color}`} stroke-width=${s.strong === false ? 1.5 : 2} stroke-linejoin="round" stroke-linecap="round" />`)}
      ${lines.map((s) => s.values.map((v, i) => (isNum(v) && (n <= 1 || (!isNum(s.values[i - 1]) && !isNum(s.values[i + 1]))) ? html`<circle cx=${xs[i]} cy=${y(v)} r="2.5" style=${`fill:${s.color}`} />` : null)))}
      ${labelIdx.map((i) => html`<text class="tick-label" x=${xs[i]} y=${height - 6} text-anchor="middle">${dateShort(dates[i])}</text>`)}
      ${endLabel && lastIdx >= 0 && hover == null && endSeries && html`
        ${lines[0] && html`<circle cx=${xs[lastIdx]} cy=${y(endSeries.values[lastIdx])} r="4" style=${`fill:${endSeries.color};stroke:var(--surface);stroke-width:2`} />`}
        <text class="end-label" x=${m.l + pw + 6} y=${Math.min(m.t + ph, Math.max(m.t + 6, y(endSeries.values[lastIdx])))} dy="0.32em">${fmt(endSeries.values[lastIdx])}</text>`}
      ${hover != null && html`<line class="hair" x1=${xs[hover]} x2=${xs[hover]} y1=${m.t} y2=${m.t + ph} />
        ${lines.map((s) => (isNum(s.values[hover]) ? html`<circle cx=${xs[hover]} cy=${y(s.values[hover])} r="4.5" style=${`fill:${s.color};stroke:var(--surface);stroke-width:2`} />` : null))}`}
    </svg>
    ${hover != null && html`<div class="tooltip" style=${`left:${tipLeft}px`}>
      <div class="tt-date">${dateLong(dates[hover])}</div>
      ${series.map((s) => html`<div class="tt-row" style=${`--c:${s.colorFn && isNum(s.values[hover]) ? s.colorFn(s.values[hover], hover) : s.color}`}>
        <i class="key"></i><b>${isNum(s.values[hover]) ? fmt(s.values[hover]) : '–'}</b><span>${s.label}</span>
      </div>`)}
      ${band && isNum(band.lo[hover]) && html`<div class="tt-row"><i></i><span class="muted">${band.label || 'Normal'}: ${fmt(band.lo[hover])}–${fmt(band.hi[hover])}</span><span></span></div>`}
    </div>`}
  </div>`;
}

export function Legend({ items }) {
  return html`<div class="legend">${items.map((it) => html`<span style=${`--c:${it.color}`}><i class=${`key${it.box ? ' box' : ''}`}></i>${it.label}</span>`)}</div>`;
}

export function niceTicks(lo, hi, count = 4) {
  const span = hi - lo || 1;
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const stepN = [1, 2, 2.5, 5, 10].map((f) => f * mag).find((s) => span / s <= count + 0.5) || mag * 10;
  const out = [];
  for (let t = Math.ceil(lo / stepN) * stepN; t <= hi + 1e-9; t += stepN) out.push(Math.round(t * 1e6) / 1e6);
  return out;
}

function xLabelIndices(n, pw) {
  if (n <= 1) return n ? [0] : [];
  const maxLabels = Math.max(2, Math.floor(pw / 64));
  const every = Math.ceil(n / maxLabels);
  const out = [];
  for (let i = n - 1; i >= 0; i -= every) out.push(i);
  return out.reverse();
}

/** Tabellenansicht als Alternative zu jedem Diagramm. */
export function DataTable({ dates, columns }) {
  const rows = dates.map((d, i) => [d, i]).reverse();
  return html`<div class="tablewrap"><table class="data">
    <thead><tr><th>Datum</th>${columns.map((c) => html`<th>${c.label}</th>`)}</tr></thead>
    <tbody>${rows.map(([d, i]) => html`<tr><td>${dateLong(d)}</td>${columns.map((c) => html`<td>${isNum(c.values[i]) ? c.fmt(c.values[i]) : '–'}</td>`)}</tr>`)}</tbody>
  </table></div>`;
}
