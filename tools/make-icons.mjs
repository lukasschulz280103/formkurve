// Rendert die App-Icons aus icons/icon.svg (braucht Playwright, nur zum Bauen).
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { readFileSync } from 'node:fs';
const svg = readFileSync(new URL('../icons/icon.svg', import.meta.url), 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage();
async function shot(size, file, pad = 0, rounded = true) {
  const inner = rounded ? svg : svg.replace('rx="112"', 'rx="0"');
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:#0c0f14"><div style="width:${size}px;height:${size}px;display:grid;place-items:center">${inner.replace('<svg ', `<svg width="${size - 2 * pad}" height="${size - 2 * pad}" `)}</div></body></html>`);
  await page.screenshot({ path: new URL(`../icons/${file}`, import.meta.url).pathname, omitBackground: false });
}
await shot(180, 'icon-180.png', 0, false);
await shot(192, 'icon-192.png', 0, false);
await shot(512, 'icon-512.png', 0, false);
await shot(512, 'icon-maskable-512.png', 56, false);
await browser.close();
console.log('Icons erstellt');
