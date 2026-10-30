// Wurzelkomponente: Ansichten, Tab-Leiste, schwebender Check-in, Meldungen.
import { html } from '../vendor/preact-htm.js';
import { state, useAppState, navigate, update } from './state.js';
import { Icon } from './icons.js';
import { Progress } from './components.js';
import { TodayView } from './today.js';
import { MonthView } from './calendarView.js';
import { TrendsView } from './trends.js';
import { CheckSheet, CheckFab } from './checkin.js';
import { ProfileView } from './profileView.js';
import { JournalView } from './journalView.js';
import { mb } from './format.js';
import { AuthView, OnboardingView } from './auth.js';
import { InfoSheet } from './info.js';

const TABS = [
  { route: 'heute', label: 'Heute', icon: 'sun' },
  { route: 'logbuch', label: 'Logbuch', icon: 'book' },
  { route: 'verlauf', label: 'Verlauf', icon: 'trends' },
  { route: 'profil', label: 'Profil', icon: 'user' },
];

/** „Heute“ zeigt entweder den Tag oder den Monatskalender. */
function HomeView() {
  return state.homeView === 'month' ? html`<${MonthView} />` : html`<${TodayView} />`;
}

const VIEWS = { heute: HomeView, logbuch: JournalView, verlauf: TrendsView, profil: ProfileView };

function TabBar({ s }) {
  return html`<nav class="tabbar" aria-label="Hauptnavigation"><div class="tabbar-inner">
    ${TABS.map((t) => html`<button type="button" class="tab" aria-current=${s.route === t.route ? 'page' : null} onClick=${() => navigate(t.route)}>
      <${Icon} name=${t.icon} size=${24} />${t.label}
    </button>`)}
  </div></nav>`;
}

function Overlays({ s }) {
  return html`
    ${s.toast ? html`<div class=${`toast ${s.toast.kind === 'error' ? 'error' : ''}${s.toast.action ? ' with-action' : ''}`} role="status">
      <span>${s.toast.text}</span>
      ${s.toast.action ? html`<button type="button" class="toast-btn" onClick=${() => {
        const { run } = s.toast.action;
        update({ toast: null });
        run();
      }}>${s.toast.action.label}</button>` : null}
    </div>` : null}
    ${s.busy ? html`<div class="overlay" role="alertdialog" aria-live="polite" aria-label=${s.busy}><div class="card">
      <div class="spinner"></div><p>${s.busy}</p>
      ${s.progress ? html`<${Progress} ratio=${s.progress.ratio} /><p class="small muted tnum">${mb(s.progress.ratio * s.progress.total)} von ${mb(s.progress.total)}</p>` : null}
    </div></div>` : null}`;
}

export function App() {
  const s = useAppState();
  if (!s.ready) return html`<div class="loading">Formkurve lädt …</div>`;
  if (s.auth === 'out') return html`<div class="app"><${AuthView} /><${Overlays} s=${s} /></div>`;
  if (s.onboarding) return html`<div class="app"><${OnboardingView} /><${Overlays} s=${s} /></div>`;
  const View = VIEWS[s.route] || TodayView;
  return html`<div class="app">
    <div inert=${s.checkOpen} aria-hidden=${s.checkOpen ? 'true' : null}>
      <${View} key=${`${s.route}/${s.sub || ''}`} />
      <${TabBar} s=${s} />
      <${CheckFab} />
    </div>
    ${s.checkOpen ? html`<${CheckSheet} />` : null}
    <${InfoSheet} />
    <${Overlays} s=${s} />
  </div>`;
}
