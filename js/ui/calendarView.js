// Monatskalender auf „Heute“: jeder Tag bekommt eine Farbe nach dem gewählten Wert,
// so wie eine Farbskala bei bedingter Formatierung. Ein Tippen öffnet den Tag.
import { html } from '../vendor/preact-htm.js';
import { state, openDay, patchSettings, firstDataDay, openChecks, shiftCalMonth } from './state.js';
import { Topbar, DemoBanner, HomeSwitch } from './today.js';
import { num, signed, dateFull, dateNumeric } from './format.js';
import { monthGrid, monthStats, monthLabel, monthOf, monthFirst, shiftMonth, levelOf, scoreEdges, WEEKDAYS_SHORT, MONTH_NAMES } from '../model/calendar.js';
import { daySummary } from '../journal/journal.js';

/**
 * Werte, nach denen der Kalender einfärben kann. „score“ geht von rot nach grün (hoch ist gut),
 * „load“ von hell nach kräftig (weder gut noch schlecht). Ohne eigene Grenzen gelten die Schwellen
 * aus den Einstellungen.
 */
const METRICS = [
  { key: 'form', label: 'Tagesform', scale: 'score', value: (d) => state.results.days.get(d)?.form ?? null },
  { key: 'recovery', label: 'Recovery', scale: 'score', value: (d) => state.results.days.get(d)?.recovery ?? null },
  { key: 'sleepScore', label: 'Schlaf', scale: 'score', value: (d) => state.results.days.get(d)?.sleepScore ?? null },
  { key: 'strain', label: 'Strain', scale: 'load', edges: [20, 40, 55, 70], value: (d) => state.results.days.get(d)?.strain ?? null },
  { key: 'happy', label: 'Glück', scale: 'score', edges: [4, 6, 8, 9], digits: 0, value: (d) => daySummary(state.repo.journal.get(d))?.happy ?? null },
];

function metricOf(settings) {
  return METRICS.find((m) => m.key === settings.display.calendarMetric) || METRICS[0];
}

function edgesOf(metric, settings) {
  return metric.edges || scoreEdges(settings.model.recovery.red, settings.model.recovery.green);
}

function Day({ cell, metric, edges, open, first }) {
  if (cell.outside) return html`<span class="cal-day outside" aria-hidden="true"></span>`;
  const off = cell.date > state.today || (first && cell.date < first);
  const v = off ? null : metric.value(cell.date);
  const lv = levelOf(v, edges);
  const cls = ['cal-day'];
  if (lv != null) cls.push(`lv${lv}`);
  if (off) cls.push('off');
  if (cell.weekend) cls.push('we');
  if (cell.date === state.today) cls.push('today');
  if (cell.date === state.date) cls.push('sel');
  const miss = open.has(cell.date);
  return html`<button type="button" class=${cls.join(' ')} disabled=${off}
    aria-current=${cell.date === state.date ? 'date' : null}
    aria-label=${`${dateFull(cell.date)}${v == null ? ', kein Wert' : `, ${metric.label} ${num(v, metric.digits)}`}${miss ? ', Check-in offen' : ''}`}
    onClick=${() => openDay(cell.date)}>
    <span class="d">${cell.day}</span>
    ${v == null ? null : html`<span class="v">${num(v, metric.digits)}</span>`}
    ${miss ? html`<i class="cal-open" aria-hidden="true"></i>` : null}
  </button>`;
}

function Calendar({ ym }) {
  const repo = state.repo;
  const s = repo.settings;
  const metric = metricOf(s);
  const edges = edgesOf(metric, s);
  const cells = monthGrid(ym);
  const first = firstDataDay();
  const open = new Set(openChecks().map((p) => p.date));
  const stats = monthStats(ym, metric.value);
  const prev = monthStats(shiftMonth(ym, -1), metric.value);
  const delta = stats.mean != null && prev.mean != null ? stats.mean - prev.mean : null;
  const prevName = MONTH_NAMES[Number(shiftMonth(ym, -1).slice(5, 7)) - 1];
  return html`<section class="card" aria-labelledby="h-cal">
    <div class="card-head"><h2 id="h-cal">${metric.label}</h2>
      <span class="tiny muted">${stats.n ? `${stats.n} ${stats.n === 1 ? 'Tag' : 'Tage'}` : 'keine Werte'}</span></div>
    <div class="chips" role="group" aria-label="Wert für die Farben">
      ${METRICS.map((m) => html`<button type="button" class="chip" aria-pressed=${m.key === metric.key ? 'true' : 'false'}
        onClick=${() => patchSettings('display.calendarMetric', m.key)}>${m.label}</button>`)}
    </div>
    <div class="cal-head" aria-hidden="true">${WEEKDAYS_SHORT.map((w) => html`<span>${w}</span>`)}</div>
    <div class=${`cal-grid scale-${metric.scale}`}>
      ${cells.map((c) => html`<${Day} key=${c.date} cell=${c} metric=${metric} edges=${edges} open=${open} first=${first} />`)}
    </div>
    <div class="cal-legend">
      <span class="tiny muted">niedrig</span>
      <span class=${`cal-scale scale-${metric.scale}`} aria-hidden="true">${[0, 1, 2, 3, 4].map((i) => html`<i class=${`lv${i}`}></i>`)}</span>
      <span class="tiny muted">hoch</span>
    </div>
    ${stats.mean != null ? html`<dl class="kv" style="margin-top:4px">
      <dt>Durchschnitt</dt><dd>${num(stats.mean, metric.digits ?? 1)}${delta != null && Math.abs(delta) >= 0.05 ? html` <span class="tiny muted">(${signed(delta, 1)} zum ${prevName})</span>` : null}</dd>
      <dt>Höchster</dt><dd>${num(stats.best.value, metric.digits)} am ${dateNumeric(stats.best.date)}</dd>
      <dt>Niedrigster</dt><dd>${num(stats.worst.value, metric.digits)} am ${dateNumeric(stats.worst.date)}</dd>
    </dl>` : html`<p class="small muted">Für diesen Monat gibt es noch keine Werte.</p>`}
    <p class="tiny muted">Die Farbe wechselt bei ${edges.map((e) => num(e, Number.isInteger(e) ? 0 : 1)).join(' · ')}. Ein Tippen öffnet den Tag${open.size ? '; ein Punkt heißt, dass dort noch ein Check offen ist' : ''}.</p>
  </section>`;
}

/** „Heute“ als Monatskalender: oben der Monat zum Blättern, darunter das Raster. */
export function MonthView() {
  const ym = state.calMonth || monthOf(state.date);
  const first = firstDataDay();
  const metric = metricOf(state.repo.settings);
  const stats = monthStats(ym, metric.value);
  return html`
    <${Topbar} above=${html`<${HomeSwitch} />`} title=${monthLabel(ym)}
      sub=${stats.mean != null ? `Ø ${metric.label} ${num(stats.mean, metric.digits ?? 1)}` : 'noch keine Werte'}
      prev=${{ label: 'Vormonat', disabled: Boolean(first) && shiftMonth(ym, -1) < monthOf(first), onClick: () => shiftCalMonth(-1) }}
      next=${{ label: 'Folgemonat', disabled: monthFirst(ym) > state.today || ym >= monthOf(state.today), onClick: () => shiftCalMonth(1) }} />
    <main class="view" id="main">
      <${DemoBanner} />
      <${Calendar} ym=${ym} />
    </main>`;
}
