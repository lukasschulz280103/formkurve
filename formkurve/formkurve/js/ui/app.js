// Wurzelkomponente: Ansichten, Tab-Leiste, Meldungen.
import { html } from '../vendor/preact-htm.js';
import { useAppState, navigate } from './state.js';
import { Icon } from './icons.js';
import { Progress } from './components.js';
import { TodayView } from './today.js';
import { TrendsView } from './trends.js';
import { CheckView } from './checkin.js';
import { InsightsView } from './insightsView.js';
import { DataView } from './dataView.js';
import { slotDone } from '../survey/engine.js';
import { mb } from './format.js';

const TABS = [
  { route: 'heute', label: 'Heute', icon: 'sun' },
  { route: 'verlauf', label: 'Verlauf', icon: 'trends' },
  { route: 'check', label: 'Check-in', icon: 'check' },
  { route: 'einsichten', label: 'Einsichten', icon: 'insights' },
  { route: 'daten', label: 'Daten', icon: 'data' },
];

const VIEWS = { heute: TodayView, verlauf: TrendsView, check: CheckView, einsichten: InsightsView, daten: DataView };

function TabBar({ s }) {
  const h = new Date().getHours();
  const survey = s.repo?.survey;
  const due = survey && ((h < s.repo.settings.survey.morningUntilHour && !slotDone(survey, s.today, 'morning')) || (h >= 18 && !slotDone(survey, s.today, 'evening')));
  return html`<nav class="tabbar" aria-label="Hauptnavigation"><div class="tabbar-inner">
    ${TABS.map((t) => html`<button type="button" class="tab" aria-current=${s.route === t.route ? 'page' : null} onClick=${() => navigate(t.route)}>
      <${Icon} name=${t.icon} size=${24} />${t.label}
      ${t.route === 'check' && due ? html`<i class="badge" aria-label="Check offen"></i>` : null}
    </button>`)}
  </div></nav>`;
}

export function App() {
  const s = useAppState();
  if (!s.ready) return html`<div class="loading">Formkurve lädt …</div>`;
  const View = VIEWS[s.route] || TodayView;
  return html`<div class="app">
    <${View} key=${s.route} />
    <${TabBar} s=${s} />
    ${s.toast ? html`<div class=${`toast ${s.toast.kind === 'error' ? 'error' : ''}`} role="status">${s.toast.text}</div>` : null}
    ${s.busy ? html`<div class="overlay" role="alertdialog" aria-live="polite" aria-label=${s.busy}><div class="card">
      <div class="spinner"></div><p>${s.busy}</p>
      ${s.progress ? html`<${Progress} ratio=${s.progress.ratio} /><p class="small muted tnum">${mb(s.progress.ratio * s.progress.total)} von ${mb(s.progress.total)}</p>` : null}
    </div></div>` : null}
  </div>`;
}
