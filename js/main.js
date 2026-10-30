// Einstieg der Web-App.
import { html, render } from './vendor/preact-htm.js';
import { App } from './ui/app.js';
import { boot, state, recompute, navigate, parseRoute, toast } from './ui/state.js';
import { todayKey } from './core/time.js';

const preview = Boolean(globalThis.FORMKURVE_PREVIEW);
const root = document.getElementById('app');
render(html`<${App} />`, root);

function showFatal(message) {
  const safe = String(message || 'Unbekannter Fehler').replace(/[<>&]/g, '');
  root.innerHTML = `<div class="loading"><div class="card stack" style="max-width:340px;text-align:left">
    <b>Formkurve konnte nicht starten</b><p class="small">${safe}</p>
    <button class="btn primary block" type="button" onclick="location.reload()">Neu laden</button></div></div>`;
}

boot({ preview }).catch((e) => {
  console.error(e);
  showFatal(e?.message || e);
});

// Eine neuere App-Version hat die Datenbank übernommen: diese Seite neu laden lassen
window.addEventListener('formkurve:reload-needed', () => toast('Formkurve wurde aktualisiert. Bitte die App neu laden.', 'error'));

// Neuer Tag oder Rückkehr in die App: Werte neu berechnen.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && state.ready && state.today !== todayKey()) {
    state.date = todayKey();
    recompute();
  }
});

window.addEventListener('hashchange', () => {
  if (!location.hash) return;
  const { route, sub } = parseRoute(location.hash);
  navigate(route, sub);
});

if (!preview && 'serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then((reg) => {
      // Beim Zurückkehren in die App nach einer neuen Version fragen
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => {});
      });
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        w?.addEventListener('statechange', () => {
          if (w.state === 'installed' && navigator.serviceWorker.controller) toast('Neue Version geladen. Beim nächsten Öffnen aktiv.');
        });
      });
    }).catch(() => {});
  });
}
