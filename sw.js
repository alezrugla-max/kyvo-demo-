/* Kyvo service worker — cache static shell only; never pin API JSON forever */
const C = 'kyvo-v8-0';
const A = [
  './', 'index.html', 'app.js', 'chart.js', 'evm.js', 'profile.js', 'launch.js', 'auth.js', 'auth-config.js', 'premium-config.js', 'contact-config.js',
  'vendor/lightweight-charts/lightweight-charts.standalone.production.js', 'vendor/kyvo-crypto/kyvo-crypto.min.js', 'manifest.json',
  'kyvo_mark.svg', 'kyvo_logo.svg',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'icons/favicon-32.png',
  'data/x_viral.json', 'data/smart_money.json', 'data/leaderboard.json'
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
  const isApi = /dexscreener\.com|geckoterminal\.com|solana\.com|publicnode\.com|binance|blxrbdn\.com|48\.club|bnbchain\.org|blockscout\.com|robinhood\.com/.test(u.hostname)
    || /\/data\/(x_viral|smart_money|leaderboard)\.json/.test(u.pathname)
    || /(auth|premium|contact)-config\.js$/.test(u.pathname) || /gstatic\.com|googleapis\.com|firebaseapp\.com/.test(u.hostname);
  if (isApi) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
    return;
  }
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
