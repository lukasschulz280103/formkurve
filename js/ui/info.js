// Infopunkte: kleiner (i)-Knopf an jedem Wert und ein Blatt mit Richtwerten, Einordnung und Quellen.
import { html, useEffect, useRef } from '../vendor/preact-htm.js';
import { state, openInfo, closeInfo, navigate } from './state.js';
import { Icon } from './icons.js';
import { reference } from '../norms/references.js';
import { ageOf, bmiOf, hrMaxOf } from '../core/config.js';

export function InfoButton({ k, value = null, extra = {}, label }) {
  return html`<button type="button" class="info-btn" aria-label=${`Info: ${label || k}`} onClick=${(e) => {
    e.stopPropagation();
    openInfo(k, value, extra);
  }}><${Icon} name="info" size=${17} /></button>`;
}

const BADGE = {
  offiziell: ['c-good', 'Richtwerte offizieller Stellen'],
  Studie: ['c-info', 'Werte aus Studien, keine amtliche Norm'],
  Fachliteratur: ['c-info', 'Werte aus medizinischer Fachliteratur'],
  Formkurve: ['c-sleep', 'Eigener Score von Formkurve'],
};

export function InfoSheet() {
  const info = state.info;
  const ref = useRef(null);
  useEffect(() => {
    if (!info) return undefined;
    ref.current?.focus();
    const onKey = (e) => e.key === 'Escape' && closeInfo();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [info?.k]);
  if (!info) return null;
  const settings = state.repo?.settings;
  const ctx = { value: info.value, age: settings ? ageOf(settings) : null, sex: settings?.profile?.sex ?? null, bmi: settings ? bmiOf(settings) : null, hrMax: settings ? hrMaxOf(settings) : null, ...info.extra };
  const r = reference(info.k, ctx);
  if (!r) return null;
  const [cls, badgeText] = BADGE[r.badge] || BADGE.Formkurve;
  const missingProfile = settings && (ctx.age == null || ctx.sex == null);
  return html`<div class="sheet-backdrop" onClick=${closeInfo}>
    <section class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title" tabindex="-1" ref=${ref} onClick=${(e) => e.stopPropagation()}>
      <div class="sheet-grip" aria-hidden="true"></div>
      <div class="row between" style="align-items:flex-start">
        <div class="grow">
          <h2 id="sheet-title">${r.title}</h2>
          <span class=${`status ${cls}`} style="margin-top:6px"><${Icon} name=${r.badge === 'offiziell' ? 'ok' : 'info'} size=${14} />${badgeText}</span>
        </div>
        <button class="iconbtn" aria-label="Schließen" onClick=${closeInfo}><${Icon} name="close" /></button>
      </div>
      <p class="ink2">${r.what}</p>
      ${r.personal ? html`<div class="sheet-personal"><b>Für dich</b><p>${r.personal}</p></div>` : null}
      ${r.official?.length ? html`<div>
        <div class="eyebrow" style="margin-bottom:6px">${r.badge === 'offiziell' ? 'Normal- und Richtwerte' : 'Vergleichswerte'}</div>
        <dl class="norms">${r.official.map((o) => html`<dt>${o.label}</dt><dd>${o.value}</dd>`)}</dl>
      </div>` : null}
      <div><div class="eyebrow" style="margin-bottom:4px">So nutzt Formkurve den Wert</div><p class="small ink2">${r.app}</p></div>
      ${r.caveat ? html`<p class="small muted">${r.caveat}</p>` : null}
      ${missingProfile && !state.demo ? html`<button class="linkbtn" style="justify-self:start" onClick=${() => {
        closeInfo();
        navigate('daten');
        setTimeout(() => document.getElementById('profil')?.scrollIntoView({ block: 'start' }), 80);
      }}>Alter und Geschlecht im Profil ergänzen</button>` : null}
      ${r.sources?.length ? html`<div><div class="eyebrow" style="margin-bottom:4px">Quellen</div>
        <ul class="sources">${r.sources.map((s) => html`<li><a href=${s.url} target="_blank" rel="noopener noreferrer">${s.label}</a></li>`)}</ul></div>` : null}
      <p class="tiny muted">Allgemeine Richtwerte, keine Diagnose. Bei Beschwerden zählt ärztlicher Rat.</p>
    </section>
  </div>`;
}
