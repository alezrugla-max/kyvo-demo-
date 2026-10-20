/* Kyvo v8.2 — in-app + system notifications while Kyvo is open (also in a background tab).
   Types: "good" = a new coin enters Good Coins with a high Kyvo Check score; "tweets" = a new important tweet with a coin in the X snapshot.
   No server: everything runs in this browser. Background push with the app CLOSED needs a server → KyvoPush hooks (disabled by config). */
(function () {
  'use strict';
  const SKEY = 'kyvo_notif_v1', GKEY = 'kyvo_seen_good_v1', TKEY = 'kyvo_seen_tw_v1';
  const DEF = { good: true, tweets: true, minScore: 75 };
  let D = null;
  const T = (x) => (window.KyvoI18n ? window.KyvoI18n.t(x) : x);
  const EN = () => !!(window.KyvoI18n && window.KyvoI18n.isEn());
  const L = (pl, en) => (EN() ? en : pl);
  const plN = (n, few, many) => { const d = n % 10, h = n % 100; return d >= 2 && d <= 4 && (h < 12 || h > 14) ? few : many; };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const load = (k, d) => { try { return Object.assign(Array.isArray(d) ? [] : {}, d, JSON.parse(localStorage.getItem(k) || 'null') || {}); } catch (e) { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  let S = load(SKEY, DEF);
  const supported = () => typeof window.Notification !== 'undefined';
  const perm = () => (supported() ? Notification.permission : 'unsupported');
  const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent);
  const standalone = () => (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;

  async function system(title, body, url, tag) {
    if (perm() !== 'granted') return false;
    const opts = { body, icon: 'icons/icon-192.png', badge: 'icons/icon-96.png', tag: tag || 'kyvo', data: { url } };
    try {
      const reg = navigator.serviceWorker && (await navigator.serviceWorker.getRegistration());
      if (reg && reg.showNotification) { await reg.showNotification(title, opts); return true; }
      new Notification(title, opts); return true; // eslint-disable-line no-new
    } catch (e) { return false; }
  }
  function send(title, body, hash, tag) {
    const url = location.href.split('#')[0] + (hash || '');
    if (D && D.toast) D.toast('🔔 ' + title + (body ? ' — ' + body : ''));
    // system notification only when the user is not looking at Kyvo (no double ping)
    if (document.hidden || !document.hasFocus()) system(title, body, url, tag);
    log.unshift({ t: Date.now(), title, body, hash });
    log.length = Math.min(log.length, 20);
    save('kyvo_notif_log_v1', log);
  }
  let log = []; try { log = JSON.parse(localStorage.getItem('kyvo_notif_log_v1') || '[]') || []; } catch (e) { log = []; }

  /* ---- 1) new coin in Good Coins with a high Kyvo Check ---- */
  let goodBusy = false;
  async function onGood(list) {
    if (!D || !S.good || goodBusy || !Array.isArray(list)) return;
    goodBusy = true;
    try {
      const st = load(GKEY, { at: 0, keys: {} });
      const now = Date.now();
      const keys = list.map((c) => D.keyOf(c));
      const fresh = now - (st.at || 0) > 30 * 60e3; // first run or long pause -> re-seed silently (no flood)
      const added = fresh ? [] : list.filter((c) => !st.keys[D.keyOf(c)]);
      for (const k of keys) st.keys[k] = st.keys[k] || now;
      for (const k of Object.keys(st.keys)) if (now - st.keys[k] > 3 * 864e5) delete st.keys[k];
      st.at = now;
      save(GKEY, st);
      const hits = [];
      for (const c of added.slice(0, 6)) {
        let sc = null;
        try { sc = window.KyvoInsights && window.KyvoInsights.fullScore ? await window.KyvoInsights.fullScore(c) : null; } catch (e) { sc = null; }
        if (sc != null && sc >= (S.minScore || 75)) hits.push({ c, sc });
      }
      if (hits.length === 1) {
        const { c, sc } = hits[0];
        send(L('Nowy coin w Good Coins', 'New coin in Good Coins'), `$${c.symbol} · Kyvo Check ${sc}/100 · MC ${D.fmtUsd(c.mcap)}`, '#coin/' + encodeURIComponent(D.keyOf(c)), 'kyvo-good-' + D.keyOf(c));
      } else if (hits.length > 1) {
        send(L(`${hits.length} ${plN(hits.length, 'nowe coiny', 'nowych coinów')} w Good Coins`, `${hits.length} new coins in Good Coins`), hits.map((h) => `$${h.c.symbol} ${h.sc}/100`).join(' · '), '#good', 'kyvo-good');
      }
    } finally { goodBusy = false; }
  }

  /* ---- 2) new important tweet with a coin in the X snapshot ---- */
  function tweetItems(doc) {
    const out = [];
    for (const t of (doc && doc.trader_tweets) || []) if ((t.coins || []).length) out.push({ id: 'tt:' + (t.id || t.url), h: t.handle, c: t.coins[0], kind: 'named', views: t.metrics && t.metrics.views });
    for (const p of (doc && doc.posts) || []) {
      const named = p.coin_match === 'named' && (p.coins || []).length;
      const spec = (p.spec_coins || []).length;
      if (named || spec) out.push({ id: 'p:' + p.url, h: p.handle, c: named ? p.coins[0] : p.spec_coins[0], kind: named ? 'named' : 'speculative', views: p.metrics && p.metrics.views });
    }
    return out;
  }
  function onViral(doc) {
    if (!doc || !doc.updated_at) return;
    const st = load(TKEY, { seeded: false, ids: {} });
    const items = tweetItems(doc);
    const added = st.seeded ? items.filter((x) => !st.ids[x.id]) : [];
    const now = Date.now();
    for (const x of items) st.ids[x.id] = st.ids[x.id] || now;
    for (const k of Object.keys(st.ids)) if (now - st.ids[k] > 14 * 864e5) delete st.ids[k];
    st.seeded = true;
    save(TKEY, st);
    if (!S.tweets || !added.length) return;
    const tag = (x) => (x.kind === 'named' ? L('podany w tweecie', 'named in tweet') : L('spekulacja', 'speculative'));
    if (added.length === 1) {
      const x = added[0];
      send(L('Nowy tweet z coinem', 'New tweet with a coin'), `@${x.h}: $${x.c.symbol} (${tag(x)})`, '#viral', 'kyvo-tw-' + x.id);
    } else {
      send(L(`${added.length} ${plN(added.length, 'nowe tweety', 'nowych tweetów')} z coinami`, `${added.length} new tweets with coins`), added.slice(0, 4).map((x) => `@${x.h} $${x.c.symbol}`).join(' · '), '#viral', 'kyvo-tw');
    }
  }

  /* ---- settings card (Więcej + Watchlista) ---- */
  function settingsHtml() {
    const p = perm();
    const P = window.KYVO_PUSH_CONFIG || {};
    return `<div class="card nset" data-nset>
      <div class="h" style="font-size:14px;margin:0 0 6px">🔔 ${L('Powiadomienia', 'Notifications')}</div>
      <label class="nrow"><input type="checkbox" data-nt="good" ${S.good ? 'checked' : ''}><span><b>${L('Nowy coin w Good Coins', 'New coin in Good Coins')}</b><small>${L('tylko z wysokim wynikiem Kyvo Check', 'only with a high Kyvo Check score')} (≥ ${esc(S.minScore || 75)}/100)</small></span></label>
      <label class="nrow"><input type="checkbox" data-nt="tweets" ${S.tweets ? 'checked' : ''}><span><b>${L('Nowy ważny tweet z coinem', 'New important tweet with a coin')}</b><small>${L('z aktualizacji Viral z X (ok. 3× dziennie)', 'from the Viral from X update (about 3× a day)')}</small></span></label>
      <div class="mut nnote">${L('Działa, gdy Kyvo jest otwarte (także w karcie w tle na komputerze): dostajesz komunikat w apce, a gdy patrzysz gdzie indziej — powiadomienie systemowe. Gdy apka jest zamknięta, nic nie przyjdzie.', 'Works while Kyvo is open (also in a background tab on a computer): you get an in-app message, and a system notification when you are looking elsewhere. When the app is closed, nothing arrives.')}</div>
      ${p === 'default' ? `<button type="button" class="pf-btn" data-nperm>${L('Włącz powiadomienia systemowe', 'Enable system notifications')}</button>` : ''}
      ${p === 'granted' ? `<div class="nok">✓ ${L('Powiadomienia systemowe włączone', 'System notifications enabled')}</div><button type="button" class="pf-btn" data-ntest>${L('Wyślij test', 'Send a test')}</button>` : ''}
      ${p === 'denied' ? `<div class="mut nnote">${L('Powiadomienia są zablokowane w ustawieniach przeglądarki — zostają komunikaty w apce.', 'Notifications are blocked in your browser settings — in-app messages still work.')}</div>` : ''}
      ${p === 'unsupported' ? `<div class="mut nnote">${isIOS() && !standalone() ? L('Na iPhonie powiadomienia działają tylko po dodaniu Kyvo do ekranu głównego (Safari → Udostępnij → „Do ekranu początkowego”, iOS 16.4+). Do tego czasu zostają komunikaty w apce.', 'On iPhone, notifications only work after adding Kyvo to the Home Screen (Safari → Share → “Add to Home Screen”, iOS 16.4+). Until then you get in-app messages.') : L('Ta przeglądarka nie obsługuje powiadomień — zostają komunikaty w apce.', 'This browser doesn\'t support notifications — in-app messages still work.')}</div>` : ''}
      <div class="mut nnote">${P.enabled ? L('Push w tle (apka zamknięta): włączony.', 'Background push (app closed): enabled.') : L('Push w tle, gdy apka jest zamknięta: wkrótce (wymaga serwera wysyłającego).', 'Background push when the app is closed: coming soon (needs a sending server).')}</div>
    </div>`;
  }
  function wireSettings(root, rerender) {
    const box = root && root.querySelector('[data-nset]');
    if (!box) return;
    box.querySelectorAll('[data-nt]').forEach((i) => (i.onchange = () => { S[i.dataset.nt] = i.checked; save(SKEY, S); if (D && D.toast) D.toast(L('Zapisano', 'Saved')); }));
    const b = box.querySelector('[data-nperm]');
    if (b) b.onclick = async () => {
      try { await Notification.requestPermission(); } catch (e) {}
      if (perm() === 'granted') window.KyvoPush && window.KyvoPush.init();
      (rerender || (() => { const n = document.createElement('div'); n.innerHTML = settingsHtml(); box.replaceWith(n.firstElementChild); wireSettings(root); }))();
    };
    const t = box.querySelector('[data-ntest]');
    if (t) t.onclick = () => system('Kyvo', L('Test powiadomienia ✓', 'Test notification ✓'), location.href.split('#')[0] + '#more', 'kyvo-test');
  }

  window.KyvoNotify = { init(deps) { D = deps; }, onGood, onViral, settingsHtml, wireSettings, settings: () => S, log: () => log, _send: send };
})();

/* ---- KyvoPush: hooks for REAL background push (app closed). Disabled unless KYVO_PUSH_CONFIG.enabled. ---- */
(function () {
  'use strict';
  let started = false;
  function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.async = true; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); }
  async function init() {
    const C = window.KYVO_PUSH_CONFIG || {};
    if (started || !C.enabled) return false;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return false; // permission is asked only on a button tap
    started = true;
    const S = (window.KyvoNotify && window.KyvoNotify.settings()) || {};
    try {
      if (C.provider === 'onesignal' && C.onesignalAppId) {
        // OneSignal Web SDK v16. sw.js must importScripts the OneSignal SW (see push_plan.md) so both share one service worker.
        window.OneSignalDeferred = window.OneSignalDeferred || [];
        await loadScript('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js');
        window.OneSignalDeferred.push(async (OneSignal) => {
          await OneSignal.init({ appId: C.onesignalAppId, serviceWorkerPath: 'sw.js', serviceWorkerParam: { scope: './' } });
          await OneSignal.User.PushSubscription.optIn();
          OneSignal.User.addTags({ good: S.good ? '1' : '0', tweets: S.tweets ? '1' : '0', lang: window.KyvoI18n ? window.KyvoI18n.lang : 'pl' });
        });
        return true;
      }
      if (C.provider === 'fcm' && C.fcm && C.fcm.vapidPublicKey) {
        // Firebase Cloud Messaging: the token must be stored server-side (e.g. Firestore "push_tokens") for the GitHub Action to send to.
        await loadScript('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
        await loadScript('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');
        const app = window.firebase.apps.length ? window.firebase.app() : window.firebase.initializeApp(C.fcm);
        const reg = await navigator.serviceWorker.ready;
        const token = await window.firebase.messaging(app).getToken({ vapidKey: C.fcm.vapidPublicKey, serviceWorkerRegistration: reg });
        window.dispatchEvent(new CustomEvent('kyvo-push-token', { detail: { provider: 'fcm', token, topics: S } }));
        return !!token;
      }
    } catch (e) { started = false; }
    return false;
  }
  window.KyvoPush = { init, enabled: () => !!(window.KYVO_PUSH_CONFIG || {}).enabled };
})();
