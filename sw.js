/* Kyvo service worker — cache static shell only; never pin API JSON forever */
/* v8.2 background push (DISABLED until push_plan.md is done). For OneSignal, uncomment the next line so OneSignal shares this SW:
importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');
*/
const C = 'kyvo-v8-3';
const A = [
  './', 'index.html', 'i18n.js', 'app.js', 'insights.js', 'chart.js', 'evm.js', 'profile.js', 'launch.js', 'auth.js', 'auth-config.js', 'premium-config.js', 'contact-config.js', 'push-config.js', 'notify.js',
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
  const isApi = /dexscreener\.com|geckoterminal\.com|solana\.com|publicnode\.com|binance|blxrbdn\.com|48\.club|bnbchain\.org|blockscout\.com|robinhood\.com|rugcheck\.xyz|gopluslabs\.io/.test(u.hostname)
    || /\/data\/(x_viral|smart_money|leaderboard|track_record)\.json/.test(u.pathname)
    || /(auth|premium|contact|push)-config\.js$/.test(u.pathname) || /gstatic\.com|googleapis\.com|firebaseapp\.com/.test(u.hostname);
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
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
    for (const c of cs) { if ('focus' in c) { c.navigate && c.navigate(url).catch(() => {}); return c.focus(); } }
    return self.clients.openWindow ? self.clients.openWindow(url) : null;
  }));
});

/* v8.2: generic Web Push (FCM / VAPID) — only fires if a push subscription exists (none until KYVO_PUSH_CONFIG.enabled). */
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data ? e.data.text() : '' }; }
  const n = d.notification || d;
  e.waitUntil(self.registration.showNotification(n.title || 'Kyvo', {
    body: n.body || '', icon: 'icons/icon-192.png', badge: 'icons/icon-96.png', tag: n.tag || 'kyvo-push',
    data: { url: n.url || (d.data && d.data.url) || './' },
  }));
});
