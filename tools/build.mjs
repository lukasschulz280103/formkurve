// Baut zwei Dinge (die App selbst braucht keinen Build-Schritt):
// 1) dist/formkurve-vorschau.html: eine einzelne Datei mit Beispieldaten (z. B. als Vorschau-Seite)
// 2) dist/formkurve-<version>.zip: alle Dateien zum Hochladen auf GitHub Pages
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, rmSync } from 'node:fs';
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

// Die Dateien liegen direkt in der obersten Ebene des ZIP, ohne zusätzlichen Ordner.
// GitHub Pages braucht index.html ganz oben im Repository, sonst kommt „404 File not found“.
const { APP_VERSION } = await import(new URL('../js/version.js', import.meta.url));
const include = ['index.html', 'manifest.webmanifest', 'sw.js', '.nojekyll', 'README.md', 'KURZBEFEHL.md', 'package.json', 'css', 'js', 'icons', 'test', 'tools'];
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
    files[relative(root, abs)] = [readFileSync(abs), { level: 9 }];
  }
}
for (const p of include) add(p);
// Die eigene Firebase-Datei gehört nie ins Update-ZIP, sonst würde ein Update sie überschreiben
for (const f of Object.keys(files)) if (/^sync-config\.js$/.test(f)) delete files[f];
for (const must of ['index.html', 'sw.js', 'manifest.webmanifest', 'js/main.js', 'css/app.css']) {
  if (!files[must]) throw new Error(`${must} fehlt in der obersten Ebene des ZIP`);
}
const swText = readFileSync(join(root, 'sw.js'), 'utf8');
if (!swText.includes(`'${APP_VERSION}'`)) throw new Error('sw.js trägt nicht dieselbe Version wie js/version.js');
for (const f of readdirSync(dist)) if (/^formkurve.*\.zip$/.test(f)) rmSync(join(dist, f));
const zipName = `formkurve-${APP_VERSION}.zip`;
writeFileSync(join(dist, zipName), zipSync(files));

console.log(`Vorschau: ${(preview.length / 1024).toFixed(0)} KB, ${zipName}: ${Object.keys(files).length} Dateien`);
