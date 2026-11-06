// Kleine Diagramme für die Kacheln. Alles SVG, ohne Bibliothek.
import { html } from '../../js/vendor/preact-htm.js';
import { isNum } from '../../js/core/stats.js';

const W = 120;
const H = 40;

function extent(values, pad = 0.12) {
  const nums = values.filter(isNum);
  if (!nums.length) return null;
  let lo = Math.min(...nums);
  let hi = Math.max(...nums);
  if (hi === lo) {
    hi += 1;
    lo -= 1;
  }
  const p = (hi - lo) * pad;
  return [lo - p, hi + p];
}

/** Linie mit weicher Fläche darunter; der letzte Wert bekommt einen Punkt. */
export function Line({ values, color = 'var(--red)', height = H }) {
  const ex = extent(values);
  if (!ex) return null;
  const [lo, hi] = ex;
  const x = (i) => (values.length === 1 ? W / 2 : (i / (values.length - 1)) * W);
  const y = (v) => H - ((v - lo) / (hi - lo)) * H;
  const pts = values.map((v, i) => (isNum(v) ? [x(i), y(v)] : null));
  const segs = [];
  let cur = [];
  for (const p of pts) {
    if (p) cur.push(p);
    else if (cur.length) {
      segs.push(cur);
      cur = [];
    }
  }
  if (cur.length) segs.push(cur);
  if (!segs.length) return null;
  const d = segs.map((s) => s.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')).join(' ');
  const last = segs[segs.length - 1];
  const area = `${last.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')} L${last[last.length - 1][0].toFixed(1)} ${H} L${last[0][0].toFixed(1)} ${H} Z`;
  const end = last[last.length - 1];
  return html`<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style=${`height:${height}px`} aria-hidden="true" focusable="false">
    <path d=${area} fill=${color} fill-opacity="0.12" stroke="none" />
    <path d=${d} fill="none" stroke=${color} stroke-width="2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
    <circle cx=${end[0].toFixed(1)} cy=${end[1].toFixed(1)} r="2.6" fill=${color} stroke="var(--card)" stroke-width="1.5" vector-effect="non-scaling-stroke" />
  </svg>`;
}

/** Säulen; der letzte Tag steht kräftiger. */
export function Bars({ values, color = 'var(--red)', height = H }) {
  const nums = values.filter(isNum);
  if (!nums.length) return null;
  const hi = Math.max(...nums) * 1.08 || 1;
  const n = values.length;
  const gap = n > 20 ? 0.6 : 2;
  const bw = Math.max(1.4, (W - gap * (n - 1)) / n);
  return html`<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style=${`height:${height}px`} aria-hidden="true" focusable="false">
    ${values.map((v, i) => {
      const h = isNum(v) ? Math.max(1.5, (v / hi) * H) : 0;
      if (!h) return null;
      return html`<rect key=${i} x=${(i * (bw + gap)).toFixed(2)} y=${(H - h).toFixed(2)} width=${bw.toFixed(2)} height=${h.toFixed(2)}
        rx=${Math.min(1.5, bw / 2).toFixed(2)} fill=${color} fill-opacity=${i === n - 1 ? 1 : 0.32} />`;
    })}
  </svg>`;
}

/** Ring wie bei den Aktivitätszielen: Wert von 0 bis 100. */
export function Ring({ value, color = 'var(--red)', size = 56, label = null }) {
  const r = 24;
  const c = 2 * Math.PI * r;
  const pct = isNum(value) ? Math.max(0, Math.min(100, value)) / 100 : 0;
  return html`<svg class="ring" viewBox="0 0 60 60" width=${size} height=${size} aria-hidden="true" focusable="false">
    <circle cx="30" cy="30" r=${r} fill="none" stroke=${color} stroke-opacity="0.16" stroke-width="7" />
    ${pct > 0 ? html`<circle cx="30" cy="30" r=${r} fill="none" stroke=${color} stroke-width="7" stroke-linecap="round"
      stroke-dasharray=${`${(c * pct).toFixed(1)} ${c.toFixed(1)}`} transform="rotate(-90 30 30)" />` : null}
    ${label ? html`<text x="30" y="30" text-anchor="middle" dominant-baseline="central" fill="var(--ink)" font-size="17" font-weight="650">${label}</text>` : null}
  </svg>`;
}

/** Größeres Diagramm im Detailblatt, mit Achsenbeschriftung. */
export function Detail({ values, labels, color, kind }) {
  const ex = extent(values, 0.08);
  const body = kind === 'bars' ? Bars({ values, color, height: 160 }) : Line({ values, color, height: 160 });
  if (!body) return html`<p class="muted small">Für diesen Zeitraum gibt es keine Werte.</p>`;
  const nums = values.filter(isNum);
  const hi = kind === 'bars' ? Math.max(...nums) : ex[1];
  const lo = kind === 'bars' ? 0 : ex[0];
  const fmt = (v) => (Math.abs(v) >= 1000 ? Math.round(v).toLocaleString('de-DE') : Math.round(v * 10) / 10);
  return html`<div class="detailchart">
    <div class="axis"><span>${fmt(hi)}</span><span>${fmt(lo)}</span></div>
    <div class="plot">${body}</div>
    <div class="ticks"><span>${labels[0]}</span><span>${labels[labels.length - 1]}</span></div>
  </div>`;
}
