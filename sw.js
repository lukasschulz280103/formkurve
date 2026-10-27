// Service Worker: zuerst Netz (immer aktuelle Dateien), bei fehlendem Netz der Zwischenspeicher.
// Die Daten (IndexedDB) fasst der Service Worker nie an; ein Update ersetzt nur die App-Dateien.
const VERSION = '0.3.0';
const CACHE = `formkurve-${VERSION}`;
const CORE = ['./', './index.html', './manifest.webmanifest', './css/app.css', './js/main.js', './icons/icon-180.png', './icons/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  // Nur alte Zwischenspeicher der App-Dateien löschen
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('formkurve-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  // no-cache: beim Server nachfragen, ob sich die Datei geändert hat. So passen nach einem Update alle Dateien zusammen.
  event.respondWith(
    fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' })
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match('./index.html'))),
  );
});
