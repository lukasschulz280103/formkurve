// Startet die Design-Variante: Beispieldaten rechnen, dann die Oberfläche zeichnen.
import { html, render } from '../../js/vendor/preact-htm.js';
import { buildDemo } from './data.js';
import { App } from './app.js';

const root = document.getElementById('app');
try {
  const { days, dates, today } = buildDemo(120);
  render(html`<${App} results=${{ days, dates }} today=${today} />`, root);
} catch (e) {
  root.innerHTML = '';
  const p = document.createElement('p');
  p.className = 'leer';
  p.style.padding = '24px';
  p.textContent = `Die Beispieldaten ließen sich nicht berechnen: ${e.message}`;
  root.appendChild(p);
}
