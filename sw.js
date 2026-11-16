/* Carnet de sport : fonctionnement hors ligne.
   Changer VERSION à chaque mise à jour des fichiers pour forcer le rafraîchissement. */
const VERSION = 'carnet-sport-1.1.0';
const FICHIERS = ['./', 'index.html', 'style.css', 'app.js', 'catalogue.js', 'mannequin.js', 'manifest.webmanifest', 'icone-180.png', 'icone-192.png', 'icone-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FICHIERS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(n => n !== VERSION).map(n => caches.delete(n)))).then(() => self.clients.claim()));
});
// Réseau d'abord (pour recevoir les mises à jour), cache si hors ligne. Les appels à GitHub ne passent pas par ici.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then(r => {
      const copie = r.clone();
      caches.open(VERSION).then(c => c.put(e.request, copie));
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('index.html')))
  );
});
