// Reiter „Profil“: Konto, Einsichten, Daten, Einstellungen und Infos. Jede Gruppe hat eine eigene Unterseite.
import { html, useEffect } from '../vendor/preact-htm.js';
import { state, navigate, runInsights, leaveDemo } from './state.js';
import { Topbar } from './today.js';
import { Icon } from './icons.js';
import { Avatar } from './auth.js';
import { Progress } from './components.js';
import { InsightsView } from './insightsView.js';
import { AccountPage, DataPage, BodyPage, EnvironmentPage, SettingsPage, BackupPage, AboutPage } from './dataView.js';
import { ago, num } from './format.js';
import { APP_VERSION } from '../version.js';
import { ageOf } from '../core/config.js';
import { formatPlace } from '../context/location.js';
import { TARGETS, formatEffect } from '../analysis/insights.js';

const PAGES = {
  einsichten: InsightsView,
  konto: AccountPage,
  daten: DataPage,
  koerper: BodyPage,
  umwelt: EnvironmentPage,
  einstellungen: SettingsPage,
  backup: BackupPage,
  info: AboutPage,
};

function Row({ icon, title, detail, page }) {
  return html`<button type="button" class="hub-row" onClick=${() => navigate('profil', page)}>
    <span class="hub-icon" aria-hidden="true"><${Icon} name=${icon} size=${19} /></span>
    <span class="hub-text"><span class="hub-title">${title}</span>${detail ? html`<span class="hub-detail">${detail}</span>` : null}</span>
    <span class="hub-chev" aria-hidden="true"><${Icon} name="right" size=${18} /></span>
  </button>`;
}

function AccountCard() {
  if (state.demo) {
    return html`<section class="card hub-account">
      <span class="hub-icon big" aria-hidden="true"><${Icon} name="user" size=${24} /></span>
      <div class="hub-text"><span class="hub-title">Beispieldaten</span><span class="hub-detail wrap">${state.preview ? 'Vorschau ohne Konto. Alle Werte sind erfunden.' : 'Du schaust dich ohne Konto um. Alle Werte sind erfunden.'}</span></div>
      ${state.preview ? null : html`<button type="button" class="btn small primary" onClick=${leaveDemo}>Konto anlegen</button>`}
    </section>`;
  }
  const a = state.account;
  const sync = state.sync;
  const status = sync?.linked
    ? sync.state === 'reauth' ? 'Online-Konto · Anmeldung nötig' : sync.state === 'error' ? 'Online-Konto · Abgleich gestört' : `Online-Konto · ${sync.lastSync ? `abgeglichen ${ago(sync.lastSync)}` : 'verbunden'}`
    : 'Konto auf diesem Gerät';
  return html`<button type="button" class="card hub-account" onClick=${() => navigate('profil', 'konto')} aria-label=${`Konto ${a?.name || ''}: ${status}`}>
    <${Avatar} a=${a} size=${48} />
    <span class="hub-text"><span class="hub-title big">${a?.name}</span><span class="hub-detail">${status}</span></span>
    <span class="hub-chev" aria-hidden="true"><${Icon} name="right" size=${18} /></span>
  </button>`;
}

function InsightsCard() {
  const ins = state.insights;
  const solid = ins ? ins.results.filter((r) => r.confidence !== 'gering') : [];
  const factors = new Set(solid.map((r) => r.factor)).size;
  const top = solid[0];
  let main;
  let detail;
  if (!ins && state.insightsBusy) {
    main = 'Analysiere deine Daten …';
    detail = html`<${Progress} ratio=${state.insightsProgress} />`;
  } else if (!ins) {
    main = 'Was deine Werte bewegt';
    detail = 'Gewohnheiten, Logbuch und Umwelt im Vergleich mit HRV, Schlaf und Glück.';
  } else if (!factors) {
    main = 'Noch keine belastbaren Zusammenhänge';
    detail = `Meist braucht es etwa 6 Wochen Daten. Bisher: ${ins.counts.nights} Nächte, ${ins.counts.evenings} Abendchecks.`;
  } else {
    main = `${factors} ${factors === 1 ? 'belastbarer Zusammenhang' : 'belastbare Zusammenhänge'}`;
    detail = top ? `Am deutlichsten: ${top.label}, ${TARGETS[top.target].label} ${formatEffect(top.target, top.diff, { short: true })}` : null;
  }
  return html`<button type="button" class="card hub-insights" onClick=${() => navigate('profil', 'einsichten')}>
    <span class="row between"><span class="eyebrow row" style="gap:6px"><${Icon} name="insights" size=${16} />Einsichten</span><span class="hub-chev" aria-hidden="true"><${Icon} name="right" size=${18} /></span></span>
    <span class="hub-big">${main}</span>
    ${detail ? html`<span class="small ink2">${detail}</span>` : null}
  </button>`;
}

function Hub() {
  const repo = state.repo;
  const s = repo.settings;
  useEffect(() => {
    // Die Analyse läuft im Hintergrund, damit die Karte gleich etwas zeigen kann
    runInsights();
  }, [state.version]);
  const p = s.profile || {};
  const age = ageOf(s);
  const body = [age != null ? `${age} Jahre` : null, p.heightCm ? `${num(p.heightCm)} cm` : null, p.weightKg ? `${num(p.weightKg, p.weightKg % 1 ? 1 : 0)} kg` : null].filter(Boolean).join(' · ');
  const last = repo.index.lastSample;
  const backup = repo.meta.lastBackup;
  return html`
    <${Topbar} title="Profil" />
    <main class="view">
      <${AccountCard} />
      <${InsightsCard} />
      <section aria-labelledby="hub-data">
        <h2 class="eyebrow hub-group" id="hub-data">Daten</h2>
        <div class="card hub-list">
          <${Row} icon="import" title="Daten importieren" page="daten" detail=${last ? `Letzte Messung ${ago(last)}` : 'Noch keine Messwerte'} />
          <${Row} icon="body" title="Körperdaten" page="koerper" detail=${body || 'Alter, Geschlecht, Größe, Gewicht'} />
          <${Row} icon="location" title="Umwelt und Standort" page="umwelt" detail=${s.context.enabled && s.context.place ? formatPlace(s.context.place) : 'Wetter, Feinstaub, Pollen'} />
          <${Row} icon="data" title="Backup und Löschen" page="backup" detail=${backup ? `Letztes Backup ${ago(backup)}` : state.sync?.linked ? 'Online-Konto hält eine Kopie' : 'Noch kein Backup'} />
        </div>
      </section>
      <section aria-labelledby="hub-app">
        <h2 class="eyebrow hub-group" id="hub-app">App</h2>
        <div class="card hub-list">
          <${Row} icon="gear" title="Einstellungen" page="einstellungen" detail="Anzeige, Check-in, Logbuch, Modell" />
          <${Row} icon="info" title="Über Formkurve" page="info" detail=${`Version ${APP_VERSION}`} />
        </div>
      </section>
    </main>`;
}

export function ProfileView() {
  const Page = PAGES[state.sub];
  return Page ? html`<${Page} />` : html`<${Hub} />`;
}
