// Wiederverwendbare Bausteine: Tagesform-Skala, Ringe, Status, Beitragsbalken, Schalter, Stepper.
import { html } from '../vendor/preact-htm.js';
import { Icon } from './icons.js';
import { num } from './format.js';

const polar = (cx, cy, r, deg) => {
  const a = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
};

function arcPath(cx, cy, r, from, to) {
  const [x1, y1] = polar(cx, cy, r, from);
  const [x2, y2] = polar(cx, cy, r, to);
  const large = to - from > 180 ? 1 : 0;
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

/** Die große Tagesform-Skala: 270-Grad-Bogen mit Teilstrichen wie eine Uhrenlünette. */
export function Dial({ value, label = 'TAGESFORM', marks = [34, 67], muted = false }) {
  const cx = 130;
  const cy = 126;
  const r = 100;
  const start = 135;
  const sweep = 270;
  const v = value == null ? null : Math.max(0, Math.min(100, value));
  const end = v == null ? start : start + (sweep * v) / 100;
  const ticks = [];
  for (let k = 0; k <= 100; k += 5) {
    const deg = start + (sweep * k) / 100;
    const major = k === 0 || k === 100 || marks.includes(k) || k === 50;
    const [x1, y1] = polar(cx, cy, r + (major ? 9 : 11), deg);
    const [x2, y2] = polar(cx, cy, r + (major ? 19 : 16), deg);
    ticks.push(html`<line class=${major ? 'tick major' : 'tick'} x1=${x1} y1=${y1} x2=${x2} y2=${y2} stroke-width=${major ? 2 : 1} stroke-linecap="round" />`);
  }
  for (const mk of marks) {
    if (mk % 5 === 0) continue;
    const deg = start + (sweep * mk) / 100;
    const [x1, y1] = polar(cx, cy, r + 9, deg);
    const [x2, y2] = polar(cx, cy, r + 19, deg);
    ticks.push(html`<line class="tick major" x1=${x1} y1=${y1} x2=${x2} y2=${y2} stroke-width="2" stroke-linecap="round" />`);
  }
  const [dx, dy] = polar(cx, cy, r, end);
  const [l0x, l0y] = polar(cx, cy, r + 2, start);
  const [l1x, l1y] = polar(cx, cy, r + 2, start + sweep);
  return html`<svg class="dial" viewBox="0 0 260 236" role="img" aria-label=${v == null ? `${label}: keine Daten` : `${label}: ${Math.round(v)} von 100`}>
    ${ticks}
    <path class="track" d=${arcPath(cx, cy, r, start, start + sweep)} fill="none" stroke-width="12" stroke-linecap="round" />
    ${v != null && v > 0.5 && html`<path class="value" d=${arcPath(cx, cy, r, start, end)} fill="none" stroke-width="12" stroke-linecap="round" style=${muted ? 'opacity:.35' : ''} />`}
    ${v != null && html`<circle class="dot" cx=${dx} cy=${dy} r="8" style=${muted ? 'opacity:.35' : ''} />`}
    <text class="dial-label" x=${cx} y=${cy - 40} text-anchor="middle">${label}</text>
    <text class="dial-num" x=${cx} y=${cy + 20} text-anchor="middle">${v == null ? '–' : Math.round(v)}</text>
    <text class="dial-scale" x=${l0x - 2} y=${l0y + 22} text-anchor="middle">0</text>
    <text class="dial-scale" x=${l1x + 2} y=${l1y + 22} text-anchor="middle">100</text>
  </svg>`;
}

/** Kleiner Ring für Recovery, Schlaf und Strain. */
export function Ring({ value, color = 'c-ink', label }) {
  const r = 31;
  const c = 2 * Math.PI * r;
  const v = value == null ? 0 : Math.max(0, Math.min(100, value));
  return html`<svg class=${`ring ${color}`} viewBox="0 0 76 76" role="img" aria-label=${`${label}: ${value == null ? 'keine Daten' : Math.round(value)}`}>
    <circle class="track" cx="38" cy="38" r=${r} fill="none" stroke-width="7" />
    ${value != null && v > 0.3 && html`<circle class="value" cx="38" cy="38" r=${r} fill="none" stroke-width="7" stroke-linecap="round" stroke-dasharray=${`${(c * v) / 100} ${c}`} transform="rotate(-90 38 38)" />`}
    <text class="ring-num" x="38" y="38" text-anchor="middle" dominant-baseline="central">${value == null ? '–' : Math.round(value)}</text>
  </svg>`;
}

const ZONE = {
  high: { cls: 'c-good', icon: 'ok', text: 'Gut erholt' },
  mid: { cls: 'c-warn', icon: 'minus', text: 'Mittel' },
  low: { cls: 'c-crit', icon: 'alert', text: 'Schonen' },
};

export function zoneOf(value, settings) {
  if (value == null) return null;
  const { red, green } = settings.model.recovery;
  return value < red ? 'low' : value >= green ? 'high' : 'mid';
}

export function zoneClass(value, settings) {
  const z = zoneOf(value, settings);
  return z ? ZONE[z].cls : 'c-info';
}

export function StatusChip({ zone, text }) {
  if (!zone) return null;
  const z = ZONE[zone];
  return html`<span class=${`status ${z.cls}`}><${Icon} name=${z.icon} size=${15} />${text || z.text}</span>`;
}

export function LevelChip({ level, text }) {
  const map = { critical: ['c-crit', 'alert'], warning: ['c-warn', 'alert'], info: ['c-info', 'info'], good: ['c-good', 'ok'] };
  const [cls, icon] = map[level] || map.info;
  return html`<span class=${`status ${cls}`}><${Icon} name=${icon} size=${15} />${text}</span>`;
}

/** Divergierende Balken: was die Recovery hebt oder drückt (in Punkten). */
export function Contributions({ items, max = 25 }) {
  return html`<div class="contrib">
    ${items.map(({ label, value, detail }) => {
      const v = Math.max(-max, Math.min(max, value));
      const w = (Math.abs(v) / max) * 50;
      const style = v >= 0 ? `left:50%;width:${w}%;border-radius:0 4px 4px 0` : `right:50%;width:${w}%;border-radius:4px 0 0 4px`;
      return html`
        <div class="lbl" title=${detail || ''}>${label}</div>
        <div style="position:relative;height:18px" aria-hidden="true">
          <div style="position:absolute;left:50%;top:0;bottom:0;width:1px;background:var(--axis)"></div>
          <div style=${`position:absolute;top:4px;height:10px;${style};background:${v >= 0 ? 'var(--pos)' : 'var(--neg)'}`}></div>
        </div>
        <div class="val">${value > 0.5 ? '+' : value < -0.5 ? '−' : '±'}${num(Math.abs(value))}</div>`;
    })}
  </div>`;
}

/** Wert gegen den persönlichen Normalbereich (Baseline). */
export function RangeBar({ value, lo, hi, min, max }) {
  if (value == null || lo == null || hi == null) return html`<div></div>`;
  const span = max - min || 1;
  const pct = (x) => Math.max(0, Math.min(100, ((x - min) / span) * 100));
  return html`<div style="position:relative;height:14px" aria-hidden="true">
    <div style="position:absolute;inset:5px 0;border-radius:2px;background:var(--surface-3)"></div>
    <div style=${`position:absolute;top:3px;height:8px;left:${pct(lo)}%;width:${Math.max(1, pct(hi) - pct(lo))}%;border-radius:3px;background:color-mix(in srgb, var(--ink) 22%, var(--surface-3))`}></div>
    <div style=${`position:absolute;top:1px;left:calc(${pct(value)}% - 6px);width:12px;height:12px;border-radius:50%;background:var(--ink);box-shadow:0 0 0 2px var(--surface)`}></div>
  </div>`;
}

export function Segmented({ options, value, onChange, label }) {
  return html`<div class="seg" role="group" aria-label=${label}>
    ${options.map((o) => html`<button type="button" aria-pressed=${o.value === value ? 'true' : 'false'} onClick=${() => onChange(o.value)}>${o.label}</button>`)}
  </div>`;
}

export function Switch({ id, checked, onChange, label }) {
  return html`<label class="switch">
    <input id=${id} type="checkbox" checked=${checked} onChange=${(e) => onChange(e.currentTarget.checked)} aria-label=${label} />
    <span></span>
  </label>`;
}

export function Stepper({ id, value, min = 0, max = 100, step = 1, unit, onChange, prefilled }) {
  const dec = String(step).includes('.') ? String(step).split('.')[1].length : 0;
  const clampV = (x) => Math.min(max, Math.max(min, Math.round(x / step) * step));
  const cur = value ?? null;
  const base = cur ?? min;
  return html`<span class="row" style="gap:8px;flex-wrap:nowrap"><div class=${`stepper${prefilled ? ' prefilled' : ''}`}>
    <button type="button" aria-label="weniger" onClick=${() => onChange(Number(clampV(base - step).toFixed(dec)))}><${Icon} name="minus" size=${20} /></button>
    <input id=${id} type="number" inputmode="decimal" step=${step} min=${min} max=${max} value=${cur ?? ''} placeholder="–"
      aria-label=${unit ? `Wert in ${unit}` : 'Wert'}
      onChange=${(e) => {
        const raw = e.currentTarget.value.replace(',', '.');
        if (raw === '') return onChange(undefined);
        const n = Number(raw);
        if (Number.isFinite(n)) onChange(Number(clampV(n).toFixed(dec)));
      }} />
    <button type="button" aria-label="mehr" onClick=${() => onChange(Number(clampV(cur == null ? min + (min === 0 ? step : 0) : base + step).toFixed(dec)))}><${Icon} name="plus" size=${20} /></button>
  </div>${unit ? html`<span class="muted small">${unit}</span>` : null}</span>`;
}

export function Confidence({ level }) {
  const n = level === 'hoch' ? 3 : level === 'mittel' ? 2 : 1;
  return html`<span class="conf" aria-label=${`Sicherheit ${level}`}><i class=${n >= 1 ? 'on' : ''}></i><i class=${n >= 2 ? 'on' : ''}></i><i class=${n >= 3 ? 'on' : ''}></i></span>`;
}

export function Progress({ ratio }) {
  return html`<div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow=${Math.round((ratio || 0) * 100)}><i style=${`width:${Math.round((ratio || 0) * 100)}%`}></i></div>`;
}
