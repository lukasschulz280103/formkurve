// Baut die Design-Variante als eine einzelne HTML-Datei mit Beispieldaten.
// Eigene Zählung: design/version.js, unabhängig von js/version.js.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const dist = join(root, 'dist');
mkdirSync(dist, { recursive: true });

const { DESIGN_VERSION, CORE_VERSION } = await import(new URL('../design/version.js', import.meta.url));

const result = await build({
  entryPoints: [join(root, 'design/js/main.js')],
  bundle: true,
  format: 'esm',
  minify: true,
  write: false,
  target: ['safari15', 'chrome100'],
  legalComments: 'none',
});
const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = readFileSync(join(root, 'design/css/health.css'), 'utf8');

const page = `<title>Formkurve Rot</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="description" content="Formkurve im Stil von Apple Health: weiße Kacheln, Rottöne, verschiebbar und editierbar. Beispieldaten.">
<style>
${css}
</style>
<div id="app"></div>
<script type="module">
${js}
</script>
`;
// Fester Name für die Veröffentlichung, damit jede neue Design-Version dieselbe Adresse
// aktualisiert; daneben eine Kopie mit Nummer zum Aufheben und Weitergeben.
for (const f of readdirSync(dist)) if (/^formkurve-design.*\.html$/.test(f)) rmSync(join(dist, f));
writeFileSync(join(dist, 'formkurve-design.html'), page);
writeFileSync(join(dist, `formkurve-design-${DESIGN_VERSION}.html`), page);
console.log(`formkurve-design.html (+ Kopie ${DESIGN_VERSION}): ${(page.length / 1024).toFixed(0)} KB · Design ${DESIGN_VERSION}, Kern ${CORE_VERSION}`);
