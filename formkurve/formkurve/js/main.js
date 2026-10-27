// Einstieg der Web-App.
import { html, render } from './vendor/preact-htm.js';
import { App } from './ui/app.js';
import { boot, state, recompute, navigate, toast } from './ui/state.js';
import { todayKey } from './core/time.js';

const preview = Boolean(globalThis.FORMKURVE_PREVIEW);
const root = document.getElementById('app');
render(html`<${App} />`, root);

boot({ preview }).catch((e) => {
  console.error(e);
  root.innerHTML = `<div class="loading"><p>Start fehlgeschlagen: ${String(e?.message || e).replace(/[<>&]/g, '')}</p></div>`;
});

// Neuer Tag oder Rückkehr in die App: Werte neu berechnen.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && state.ready && state.today !== todayKey()) {
    state.date = todayKey();
    recompute();
  }
});

window.addEventListener('hashchange', () => {
  const r = location.hash.replace('#', '');
  if (r) navigate(r);
});

if (!preview && 'serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then((reg) => {
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        w?.addEventListener('statechange', () => {
          if (w.state === 'installed' && navigator.serviceWorker.controller) toast('Neue Version geladen. Beim nächsten Öffnen aktiv.');
        });
      });
    }).catch(() => {});
  });
}
