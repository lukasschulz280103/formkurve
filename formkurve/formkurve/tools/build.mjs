// Baut zwei Dinge (die App selbst braucht keinen Build-Schritt):
// 1) dist/formkurve-vorschau.html: eine einzelne Datei mit Beispieldaten (z. B. als Vorschau-Seite)
// 2) dist/formkurve.zip: alle Dateien zum Hochladen auf GitHub Pages
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { zipSync } from 'fflate';

const root = new URL('..', import.meta.url).pathname;
const dist = join(root, 'dist');
mkdirSync(dist, { recursive: true });

const result = await build({
  entryPoints: [join(root, 'js/main.js')],
  bundle: true,
  format: 'esm',
  minify: true,
  write: false,
  target: ['safari15', 'chrome100'],
  legalComments: 'none',
});
const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = readFileSync(join(root, 'css/app.css'), 'utf8');

const preview = `<title>Formkurve</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="description" content="Persönliche Tagesform, Recovery und Einflussanalyse aus Apple-Health-Daten. Vorschau mit Beispieldaten.">
<style>
${css}
</style>
<div id="app"><div class="loading">Formkurve lädt …</div></div>
<script>window.FORMKURVE_PREVIEW = true;</script>
<script type="module">
${js}
</script>
`;
writeFileSync(join(dist, 'formkurve-vorschau.html'), preview);

const include = ['index.html', 'manifest.webmanifest', 'sw.js', 'README.md', 'KURZBEFEHL.md', 'package.json', 'css', 'js', 'icons', 'test', 'tools', '.nojekyll'];
const files = {};
function add(p) {
  const abs = join(root, p);
  let st;
  try {
    st = statSync(abs);
  } catch {
    return;
  }
  if (st.isDirectory()) {
    for (const f of readdirSync(abs)) add(join(p, f));
  } else {
    files[`formkurve/${relative(root, abs)}`] = [readFileSync(abs), { level: 9 }];
  }
}
for (const p of include) add(p);
writeFileSync(join(dist, 'formkurve.zip'), zipSync(files));

console.log(`Vorschau: ${(preview.length / 1024).toFixed(0)} KB, ZIP: ${Object.keys(files).length} Dateien`);
