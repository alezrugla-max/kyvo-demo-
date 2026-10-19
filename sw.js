/* Kyvo service worker — cache static shell only; never pin API JSON forever */
const C = 'kyvo-mvp-v5-1';
const A = [
  './', 'index.html', 'app.js', 'manifest.json',
  'kyvo_mark.svg', 'kyvo_logo.svg',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
  'data/x_viral.json'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(C).then(c => c.addAll(A)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== C).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const u = new URL(e.request.url);
  // Network-first for APIs and our own data snapshot
  const isApi = /dexscreener\.com|geckoterminal\.com/.test(u.hostname)
    || u.pathname.endsWith('x_viral.json');
  if (isApi) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
    return;
  }
  // Stale-while-revalidate for app shell
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(cached => {
      const net = fetch(e.request).then(r => {
        if (r && r.ok && u.origin === self.location.origin) {
          const cp = r.clone();
          caches.open(C).then(c => c.put(e.request, cp));
        }
        return r;
      }).catch(() => cached || caches.match('index.html'));
      return cached || net;
    })
  );
});
