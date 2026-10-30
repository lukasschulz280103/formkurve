// Ansicht "Einsichten": welche Gewohnheiten und Umweltfaktoren deine Werte bewegen.
import { html, useState, useEffect } from '../vendor/preact-htm.js';
import { state, runInsights, openCheck } from './state.js';
import { SubTopbar, DemoBanner } from './today.js';
import { Confidence, Progress } from './components.js';
import { Icon } from './icons.js';
import { num, ago } from './format.js';
import { TARGETS, formatEffect } from '../analysis/insights.js';

const FILTERS = [
  { key: 'all', label: 'Alle', targets: null },
  { key: 'hrv', label: 'HRV', targets: ['hrv'] },
  { key: 'rhr', label: 'Ruhepuls', targets: ['rhr'] },
  { key: 'recovery', label: 'Recovery', targets: ['recovery'] },
  { key: 'sleep', label: 'Schlaf', targets: ['sleepScore', 'deep', 'rem', 'efficiency', 'asleep', 'wake'] },
  { key: 'latency', label: 'Einschlafen', targets: ['latency', 'latencySubj'] },
  { key: 'feel', label: 'Gefühl', targets: ['feel'] },
  { key: 'happy', label: 'Glück', targets: ['happy'] },
];

function EffectBar({ r, width = 96 }) {
  const lo = r.ci[0] ?? r.diff;
  const hi = r.ci[1] ?? r.diff;
  const ext = Math.max(Math.abs(lo), Math.abs(hi), Math.abs(r.diff)) * 1.2 || 1;
  const W = width;
  const x = (v) => 6 + ((v + ext) / (2 * ext)) * (W - 12);
  const crosses = lo <= 0 && hi >= 0;
  const color = crosses ? 'var(--muted)' : r.good ? 'var(--pos)' : 'var(--neg)';
  return html`<svg viewBox=${`0 0 ${W} 24`} width=${W} height="24" aria-hidden="true" style="flex:none">
    <line class="ci-axis" x1="6" x2=${W - 6} y1="12" y2="12" stroke-width="1" />
    <line class="ci-zero" x1=${x(0)} x2=${x(0)} y1="4" y2="20" stroke-width="1.5" />
    <line class="ci-line" x1=${x(lo)} x2=${x(hi)} y1="12" y2="12" style=${`stroke:${color}`} />
    <circle class="ci-dot" cx=${x(r.diff)} cy="12" r="5" style=${`fill:${color}`} />
  </svg>`;
}

/** Wann die Wirkung gemessen wird: Nacht-Werte (Schlaf, HRV) oder Tageswerte (Glück aus dem Logbuch). */
function lagText(lag, targets = []) {
  const day = targets.filter((t) => TARGETS[t]?.day).length;
  const night = targets.length - day;
  if (day && night) return lag === 0 ? 'in derselben Nacht und am selben Tag' : 'in der Nacht und am Tag danach';
  if (day) return lag === 0 ? 'am selben Tag' : 'am Tag danach';
  return lag === 0 ? 'in derselben Nacht' : 'in der Nacht danach';
}

function groupMeans(r) {
  const t = TARGETS[r.target];
  if (r.target === 'hrv' || r.target === 'rhr') return `${t.label} gegenüber deinem Normalwert: ${formatEffect(r.target, r.meanA)} (${r.aLabel}) und ${formatEffect(r.target, r.meanB)} (${r.bLabel})`;
  const d = Math.abs(r.meanA) < 10 ? 1 : 0;
  return `${t.label}: im Schnitt ${num(r.meanA, d)} (${r.aLabel}) gegen ${num(r.meanB, d)} (${r.bLabel})${t.unit ? ` ${t.unit}` : ''}`;
}

const RANK = { hoch: 0, mittel: 1, gering: 2 };

function FactorCard({ rows }) {
  const [open, setOpen] = useState(false);
  const top = rows[0];
  const best = rows.reduce((a, b) => (RANK[b.confidence] < RANK[a.confidence] ? b : a), top);
  const dose = rows.find((r) => r.dose);
  const maxDose = dose ? Math.max(...dose.dose.map((d) => Math.abs(d.mean ?? 0))) || 1 : 1;
  return html`<article class="card insight">
    <div class="insight-top">
      <div class="grow">
        <div class="eyebrow">${top.group}</div>
        <h3>${top.label}</h3>
        <div class="meta">${top.nA} Tage ${top.aLabel} · ${top.nB} Tage ${top.bLabel} · Wirkung ${lagText(top.lag, rows.map((r) => r.target))}</div>
      </div>
      <span class="row tiny muted" style="gap:6px;white-space:nowrap"><${Confidence} level=${best.confidence} />${best.confidence}</span>
    </div>
    <div class="list">
      ${rows.map((r) => html`<div class="row" style="padding:8px 0;border-top:1px solid var(--line);gap:8px">
        <span class="grow small ink2 ins-label">${TARGETS[r.target].label}</span>
        <${EffectBar} r=${r} />
        <span class="num ins-num">${formatEffect(r.target, r.diff, { short: true })}</span>
      </div>`)}
    </div>
    <button class="linkbtn" style="justify-self:start" aria-expanded=${open ? 'true' : 'false'} onClick=${() => setOpen(!open)}>${open ? 'Weniger' : 'Details'}</button>
    ${open ? html`<div class="stack small ink2">
      ${rows.map((r) => html`<div>
        <p>${groupMeans(r)}.</p>
        <p class="muted">${r.ciText ? `95-%-Bereich ${r.ciText}. ` : ''}${r.adjText ? `Bereinigt um andere Faktoren: ${r.adjText}${r.confounded ? ', also teilweise durch andere Faktoren erklärt' : ''}. ` : ''}p = ${num(r.p, 3)}, q = ${num(r.q, 3)}.</p>
      </div>`)}
      ${dose ? html`<div>
        <div class="eyebrow" style="margin-top:4px">Dosis-Wirkung · ${TARGETS[dose.target].label}</div>
        <div class="dose">${dose.dose.map((d) => html`<div class="col">
          <span class="tnum">${d.mean == null ? '–' : formatEffect(dose.target, d.mean)}</span>
          <div class="bar" style=${`height:${d.mean == null ? 2 : 6 + (Math.abs(d.mean) / maxDose) * 54}px;background:${d.mean != null && (TARGETS[dose.target].better === 'up' ? d.mean < 0 : d.mean > 0) ? 'var(--neg)' : 'var(--pos)'}`}></div>
          <span>${d.label}</span><span class="tiny">n = ${d.n}</span>
        </div>`)}</div>
        <p class="tiny muted">Abweichung vom Normalwert je Anzahl.</p>
      </div>` : null}
      <p class="tiny muted">q-Werte nach Korrektur für ${state.insights.totalTests} gleichzeitig geprüfte Zusammenhänge.</p>
    </div>` : null}
  </article>`;
}

function groupByFactor(list) {
  const map = new Map();
  for (const r of list) {
    if (!map.has(r.factor)) map.set(r.factor, []);
    map.get(r.factor).push(r);
  }
  const groups = [...map.values()];
  for (const g of groups) g.sort((a, b) => RANK[a.confidence] - RANK[b.confidence] || Math.abs(b.std) - Math.abs(a.std));
  groups.sort((a, b) => RANK[a[0].confidence] - RANK[b[0].confidence] || Math.abs(b[0].std) - Math.abs(a[0].std));
  return groups;
}

function FeelCard({ feel }) {
  const r = feel?.recovery?.r;
  if (r == null) return null;
  const level = r >= 0.5 ? 'gut' : r >= 0.3 ? 'mäßig' : 'schwach';
  return html`<section class="card stack">
    <div class="card-head" style="margin-bottom:0"><h2>Passt der Score zu deinem Gefühl?</h2></div>
    <p class="ink2">Recovery und dein Gefühl am Morgen hängen <b>${level}</b> zusammen (r = ${num(r, 2)}, ${feel.recovery.n} Tage).
      ${r < 0.3 ? ' Nach einigen Wochen lohnt es sich, die Gewichte unter Profil → Einstellungen anzupassen.' : ''}</p>
    <dl class="kv">
      ${feel.parts.hrv.r != null ? html`<dt>HRV und Gefühl</dt><dd>r = ${num(feel.parts.hrv.r, 2)}</dd>` : null}
      ${feel.parts.rhr.r != null ? html`<dt>niedriger Ruhepuls und Gefühl</dt><dd>r = ${num(feel.parts.rhr.r, 2)}</dd>` : null}
      ${feel.sleep.r != null ? html`<dt>Schlaf-Score und Schlafgefühl</dt><dd>r = ${num(feel.sleep.r, 2)}</dd>` : null}
    </dl>
  </section>`;
}

export function InsightsView() {
  const [filter, setFilter] = useState('all');
  const [showAll, setShowAll] = useState(false);
  const ins = state.insights;
  useEffect(() => {
    runInsights();
  }, [state.version]);

  const f = FILTERS.find((x) => x.key === filter);
  const match = (r) => !f.targets || f.targets.includes(r.target);
  const solid = ins ? ins.results.filter((r) => r.confidence !== 'gering' && match(r)) : [];
  const groups = groupByFactor(solid);
  const shown = showAll ? groups : groups.slice(0, 8);
  const weak = ins ? ins.results.filter((r) => r.confidence === 'gering' && match(r)).sort((a, b) => a.q - b.q).slice(0, 12) : [];
  const stale = state.insightsVersion !== state.version;

  return html`
    <${SubTopbar} title="Einsichten" sub=${ins ? `Stand ${ago(ins.computedAt)}` : 'Analyse'} />
    <main class="view">
      <${DemoBanner} />
      ${state.insightsBusy && !ins ? html`<section class="card stack"><p>Analysiere deine Daten …</p><${Progress} ratio=${state.insightsProgress} /></section>` : null}
      ${ins ? html`
        <section class="card stack">
          <p class="ink2"><b class="num" style="color:var(--ink)">${groupByFactor(ins.results.filter((r) => r.confidence !== 'gering')).length}</b> Faktoren mit belastbarem Zusammenhang (${ins.results.filter((r) => r.confidence !== 'gering').length} von ${ins.totalTests} geprüften Paaren). Grundlage: ${ins.counts.nights} Nächte, ${ins.counts.evenings} Abend- und ${ins.counts.mornings} Morgenchecks${ins.counts.journal ? `, ${ins.counts.journal} Logbuch-Tage` : ''}.</p>
          ${state.insightsBusy ? html`<${Progress} ratio=${state.insightsProgress} />` : stale ? html`<button class="btn small" onClick=${() => runInsights(true)}><${Icon} name="sync" size=${16} />Neu berechnen</button>` : null}
        </section>
        <div class="filterrow" role="group" aria-label="Zielwert">
          ${FILTERS.map((x) => html`<button type="button" class="chip" aria-pressed=${x.key === filter ? 'true' : 'false'} onClick=${() => setFilter(x.key)}>${x.label}</button>`)}
        </div>
        ${filter === 'all' || filter === 'feel' || filter === 'recovery' ? html`<${FeelCard} feel=${ins.feel} />` : null}
        ${groups.length ? shown.map((g) => html`<${FactorCard} key=${g[0].factor} rows=${g} />`) : html`<section class="card"><p class="muted">Für diesen Bereich gibt es noch keine belastbaren Zusammenhänge. Meist braucht es 6 Wochen Daten und je Faktor mindestens ${state.repo.settings.analysis.minN} Tage mit und ohne.</p></section>`}
        ${groups.length > shown.length ? html`<button class="btn" onClick=${() => setShowAll(true)}>Alle ${groups.length} Faktoren anzeigen</button>` : null}
        ${weak.length ? html`<details class="card more">
          <summary>Noch unsicher (${weak.length}) <${Icon} name="down" size=${18} /></summary>
          <p class="small muted" style="margin:8px 0">Diese Unterschiede können Zufall sein. Sie werden mit mehr Daten klarer oder verschwinden.</p>
          <div class="list">${weak.map((r) => html`<div class="list-row"><span class="t">${r.label}</span><span class="num">${r.effectText}</span><span class="d">${TARGETS[r.target].label} ${lagText(r.lag, [r.target])} · ${r.nA} zu ${r.nB} Tage</span></div>`)}</div>
        </details>` : null}
        ${ins.insufficient.length ? html`<details class="card more">
          <summary>Zu wenig Daten (${ins.insufficient.length}) <${Icon} name="down" size=${18} /></summary>
          <p class="small muted" style="margin:8px 0">Je Faktor braucht es mindestens ${state.repo.settings.analysis.minN} Tage mit und ${state.repo.settings.analysis.minN} ohne.</p>
          <div class="list">${ins.insufficient.slice(0, 40).map((x) => html`<div class="list-row"><span class="t">${x.label}</span><span class="small muted tnum">${x.nA} / ${x.nB}</span></div>`)}</div>
        </details>` : null}
        <details class="card more">
          <summary>So wird gerechnet <${Icon} name="down" size=${18} /></summary>
          <div class="stack small ink2" style="margin-top:8px">
            <p>Für jeden Faktor vergleicht die App Tage mit und ohne ihn, und zwar mit der Nacht danach (Abendfragen) oder derselben Nacht (Gesundheit). HRV und Ruhepuls zählen als Abweichung von deinem Normalwert.</p>
            <p>Das Glück aus dem Logbuch vergleicht sie mit demselben Tag (zum Beispiel Schlaf der Nacht davor, Sport, Arbeitsstunden) oder mit dem Tag danach (Alkohol). Was im Logbuch steht, ersetzt die groben Antworten des Abendchecks zu Wasser, Koffein und Training.</p>
            <p>Ein Permutationstest prüft, wie leicht der Unterschied durch Zufall entstehen kann; die Benjamini-Hochberg-Korrektur berücksichtigt, dass viele Faktoren gleichzeitig geprüft werden. Der bereinigte Wert kommt aus einer Ridge-Regression über alle Faktoren.</p>
            <p>Ein Zusammenhang ist noch keine Ursache, und nichts davon ersetzt ärztlichen Rat.</p>
          </div>
        </details>
      ` : null}
      ${!ins && !state.insightsBusy ? html`<section class="card stack"><p class="muted">Noch keine Analyse.</p><button class="btn" onClick=${() => openCheck()}>Check-in öffnen</button></section>` : null}
    </main>`;
}
