/* Kyvo v8.6 — tiny polyfills for older desktop/mobile browsers + forced update check (version.json, no-store). */
(function () {
  if (!Object.fromEntries) Object.fromEntries = function (it) { var o = {}; Array.from(it).forEach(function (p) { o[p[0]] = p[1]; }); return o; };
  if (!Array.prototype.flat) Object.defineProperty(Array.prototype, 'flat', { configurable: true, writable: true, value: function (d) { d = d === undefined ? 1 : d; return this.reduce(function (a, x) { return a.concat(Array.isArray(x) && d > 0 ? x.flat(d - 1) : x); }, []); } });
  if (!Array.prototype.flatMap) Object.defineProperty(Array.prototype, 'flatMap', { configurable: true, writable: true, value: function (f, t) { return this.map(f, t).flat(); } });
  if (typeof globalThis === 'undefined') window.globalThis = window;
  if (window.Promise && !Promise.allSettled) Promise.allSettled = function (ps) { return Promise.all(Array.from(ps).map(function (p) { return Promise.resolve(p).then(function (v) { return { status: 'fulfilled', value: v }; }, function (r) { return { status: 'rejected', reason: r }; }); })); };

  var APP_VERSION = '8.6';
  window.KYVO_VERSION = APP_VERSION;
  // drop logo caches written by older versions (could hold the Kyvo mascot or pump.fun placeholder URLs)
  try { ['kyvo_img_v1'].forEach(function (k) { localStorage.removeItem(k); }); } catch (e) {}
  function check() {
    if (!window.fetch) return;
    fetch('version.json?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (v) {
      if (!v || !v.version || v.version === APP_VERSION) return;
      var key = 'kyvo_upd_' + v.version;
      try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, '1'); } catch (e) {}
      // newer release online than the code running here → clear SW caches and reload once
      var jobs = [];
      if (window.caches && caches.keys) jobs.push(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return /^kyvo-/.test(k); }).map(function (k) { return caches.delete(k); })); }));
      if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) jobs.push(navigator.serviceWorker.getRegistrations().then(function (rs) { return Promise.all(rs.map(function (r) { return r.update().catch(function () {}); })); }));
      Promise.all(jobs).catch(function () {}).then(function () { location.reload(); });
    }).catch(function () {});
  }
  check();
  setInterval(check, 15 * 60e3);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) check(); });
})();
