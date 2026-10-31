/* Kyvo v8.25: the app moved to https://kyvo-app.github.io/ . This replaces the old service worker on
   alezrugla-max.github.io/kyvo-demo-/ : it deletes the old caches, unregisters itself and reloads open
   Kyvo tabs so they land on the redirect page. It handles no fetch and no push. */
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) {
  e.waitUntil((async function () {
    try { var ks = await caches.keys(); await Promise.all(ks.map(function (k) { return caches.delete(k); })); } catch (x) {}
    try { await self.registration.unregister(); } catch (x) {}
    try { var cs = await self.clients.matchAll({ type: 'window' }); cs.forEach(function (c) { try { c.navigate(c.url); } catch (x) {} }); } catch (x) {}
  })());
});
