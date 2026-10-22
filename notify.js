/* Kyvo v8.3 (v8.2 + 🏃 Runner type) — in-app + system notifications while Kyvo is open (also in a background tab).
   Types: "good" = a new coin enters Good Coins with a high Kyvo Check score; "tweets" = a new important tweet with a coin in the X snapshot.
   No server: everything runs in this browser. Background push with the app CLOSED needs a server → KyvoPush hooks (disabled by config). */
(function () {
  'use strict';
  const SKEY = 'kyvo_notif_v1', GKEY = 'kyvo_seen_good_v1', TKEY = 'kyvo_seen_tw_v1';
  const DEF = { good: true, tweets: true, runner: true, minScore: 75 };
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
    const opts = { body, icon: 'icons/icon-192.png', badge: 'icons/icon-96.png', tag: tag || 'kyvo', data: { url, kyvo: true } };
    try {
      const reg = navigator.serviceWorker && (await navigator.serviceWorker.getRegistration());
      if (reg && reg.showNotification) { await reg.showNotification(title, opts); return true; }
      new Notification(title, opts); return true; // eslint-disable-line no-new
    } catch (e) { return false; }
  }
  /* v8.4: free plan = max FREE_CAP notifications per local day (in-app + system); Premium = all.
     Premium flag: KyvoPremium.isActive() (entitlement backend later). Client-side only — background push
     caps are enforced by the sender (see push-config.js). */
  const FREE_CAP = 2, CAPKEY = 'kyvo_notif_cap_v1';
  const today = () => { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
  function isPremium() { try { return !!(window.KyvoPremium && window.KyvoPremium.isActive()); } catch (e) { return false; } }
  function capState() { const c = load(CAPKEY, { day: '', n: 0, hinted: false }); if (c.day !== today()) { c.day = today(); c.n = 0; c.hinted = false; } return c; }
  function usedToday() { return capState().n; }
  function send(title, body, hash, tag) {
    if (!isPremium()) {
      const c = capState();
      if (c.n >= FREE_CAP) {
        if (!c.hinted && D && D.toast) D.toast('🔒 ' + L(`Limit ${FREE_CAP} powiadomień na dziś. Premium dostaje wszystkie alerty.`, `Daily limit of ${FREE_CAP} notifications reached. Premium gets all alerts.`));
        c.hinted = true; save(CAPKEY, c);
        return false;
      }
      c.n++; save(CAPKEY, c);
    }
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

  /* ---- 3) 🏃 Runner (v8.3): new coin runner or super-important tweet — deduped, max 3 per refresh ---- */
  const RKEY = 'kyvo_seen_runner_v1';
  function onRunner(items) {
    if (!D || !items) return;
    const st = load(RKEY, { at: 0, keys: {} });
    const now = Date.now();
    const all = (items.coins || []).concat(items.tweets || []);
    const fresh = now - (st.at || 0) > 30 * 60e3; // first run / long pause: seed silently, no flood
    const added = fresh ? [] : all.filter((x) => !st.keys[x.key]);
    for (const x of all) st.keys[x.key] = st.keys[x.key] || now;
    for (const k of Object.keys(st.keys)) if (now - st.keys[k] > 7 * 864e5) delete st.keys[k]; // per coin: max 1 first-pump alert (key chain:addr) + max 1 second-leg alert (key leg2:chain:addr) per 7 days
    st.at = now;
    save(RKEY, st);
    if (S.runner === false || !added.length) return;
    for (const x of added.slice(0, 3)) {
      if (x.kind === 'coin' && x.leg2) {
        const c = x.c;
        send(`🔁 ${L('Kolejna fala', 'Second leg')}: $${c.symbol}${c.mcap ? ' @ ' + D.fmtUsd(c.mcap) + ' MC' : ''}`, x.why.slice(0, 3).join(', ').replace(/<[^>]+>/g, '') + '…', '#coin/' + encodeURIComponent(x.key.replace(/^leg2:/, '')), 'kyvo-leg2-' + x.key);
      } else if (x.kind === 'coin') {
        const c = x.c;
        const ch = c.change && c.change.h1 != null ? (c.change.h1 >= 0 ? '+' : '') + Math.round(c.change.h1) + '%' : '';
        const reason = x.why.slice(1, 3).join(', ');
        const st = window.__kyvoStageOf ? window.__kyvoStageOf(c.mcap) : null;
        if (x.early) {
          send(`🏃 Runner${st ? ' ' + L('etap', 'stage') + ' ' + st.n : ''}: $${c.symbol} ${L('zaczyna pompować', 'starting to pump')}${c.mcap ? ' @ ' + D.fmtUsd(c.mcap) + ' MC' : ''}`, `vol 5m ↑, ${L('kupujący', 'buyers')} ↑ — ${x.why.slice(0, 3).join(', ').replace(/<[^>]+>/g, '')}`, '#coin/' + encodeURIComponent(x.key), 'kyvo-runner-' + x.key);
          continue;
        }
        send(`🏃 Runner${st ? ' ' + L('etap', 'stage') + ' ' + st.n : ''}: $${c.symbol}${c.mcap ? ' @ ' + D.fmtUsd(c.mcap) + ' MC' : ''}`, `vol 1h ${D.fmtUsd(c.volume && c.volume.h1)}, ${ch}${reason ? ', ' + reason.replace(/<[^>]+>/g, '') : ''}`, '#coin/' + encodeURIComponent(x.key), 'kyvo-runner-' + x.key);
      } else {
        const sym = x.coin && x.coin.symbol ? '$' + x.coin.symbol : '';
        send(`🏃 Runner: ${sym} — @${x.t.handle}`, `${x.views ? Math.round(x.views / 1000) + 'k views' : ''}${x.named ? '' : ', ' + L('spekulacja', 'speculative')}`, '#coin/' + encodeURIComponent((x.coin.chain || 'solana') + ':' + x.coin.address), 'kyvo-runner-' + x.key);
      }
    }
  }

  /* ---- 2) new important tweet with a coin in the X snapshot ---- */
  function tweetItems(doc) {
    const out = [];
    // v8.6: only genuinely NEW tweets (≤ 2 h old) — old snapshot tweets never trigger a "new tweet" alert
    const fresh = (x) => Date.now() - new Date(x.posted_at || x.created_at).getTime() <= 2 * 3.6e6;
    for (const t of (doc && doc.trader_tweets) || []) if ((t.coins || []).length && fresh(t)) out.push({ id: 'tt:' + (t.id || t.url), h: t.handle, c: t.coins[0], kind: 'named', views: t.metrics && t.metrics.views });
    for (const p of (doc && doc.posts) || []) {
      if (!fresh(p)) continue;
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
      send(L('Nowy tweet z coinem', 'New tweet with a coin'), `@${x.h}: $${x.c.symbol} (${tag(x)})`, '#tweets', 'kyvo-tw-' + x.id);
    } else {
      send(L(`${added.length} ${plN(added.length, 'nowe tweety', 'nowych tweetów')} z coinami`, `${added.length} new tweets with coins`), added.slice(0, 4).map((x) => `@${x.h} $${x.c.symbol}`).join(' · '), '#tweets', 'kyvo-tw');
    }
  }

  function pushOff() { try { return localStorage.getItem('kyvo_push_off') === '1'; } catch (e) { return false; } }
  /* ---- settings card (Więcej + Watchlista) ---- */
  function settingsHtml() {
    const p = perm();
    const P = window.KYVO_PUSH_CONFIG || {};
    return `<div class="card nset" data-nset>
      <div class="h" style="font-size:14px;margin:0 0 6px">🔔 ${L('Powiadomienia', 'Notifications')}</div>
      <label class="nrow"><input type="checkbox" data-nt="runner" ${S.runner !== false ? 'checked' : ''}><span><b>🏃 Runner</b><small>${L('najmocniejsze sygnały: ogromny rosnący wolumen, tysiące transakcji, super-ważne tweety (kilka–kilkanaście dziennie)', 'strongest signals: huge rising volume, thousands of txns, super-important tweets (a handful to ~20 a day)')}</small></span></label>
      <label class="nrow"><input type="checkbox" data-nt="good" ${S.good ? 'checked' : ''}><span><b>${L('Nowy coin w Good Coins', 'New coin in Good Coins')}</b><small>${L('tylko z wysokim wynikiem Kyvo Check', 'only with a high Kyvo Check score')}</small></span></label>
      <label class="nrow"><input type="checkbox" data-nt="tweets" ${S.tweets ? 'checked' : ''}><span><b>${L('Nowy ważny tweet z coinem', 'New important tweet with a coin')}</b><small>${L('znany trader, KOL lub celebryta tweetuje o coinie (New Tweet, sprawdzane co ~5–15 min)', 'a well-known trader, KOL or celebrity tweets about a coin (New Tweet, checked every ~5–15 min)')}</small></span></label>
      <div class="mut nnote ncap">${isPremium() ? '✦ ' + L('Premium: wszystkie powiadomienia bez limitu.', 'Premium: all notifications, no limit.') : `${L('Darmowo: maks.', 'Free: max')} ${FREE_CAP} ${L('powiadomienia dziennie', 'notifications a day')} (${L('dziś', 'today')}: ${Math.min(usedToday(), FREE_CAP)}/${FREE_CAP}). <a href="#premium">${L('Premium dostaje wszystkie alerty', 'Premium gets all alerts')}</a>.`}</div>
      <div class="mut nnote">${P.enabled ? L('Gdy Kyvo jest otwarte, dostajesz komunikat w apce. Po włączeniu powiadomień systemowych alerty przychodzą też, gdy apka jest zamknięta.', 'While Kyvo is open you get an in-app message. After you enable system notifications, alerts also arrive when the app is closed.') : L('Działa, gdy Kyvo jest otwarte (także w karcie w tle na komputerze): dostajesz komunikat w apce, a gdy patrzysz gdzie indziej — powiadomienie systemowe. Gdy apka jest zamknięta, nic nie przyjdzie.', 'Works while Kyvo is open (also in a background tab on a computer): you get an in-app message, and a system notification when you are looking elsewhere. When the app is closed, nothing arrives.')}</div>
      ${p === 'default' ? `<button type="button" class="pf-btn" data-nperm>${L('Włącz powiadomienia systemowe', 'Enable system notifications')}</button>` : ''}
      ${p === 'granted' ? `<div class="nok">✓ ${L('Powiadomienia systemowe włączone', 'System notifications enabled')}</div><button type="button" class="pf-btn" data-ntest>${L('Wyślij test', 'Send a test')}</button>` : ''}
      ${p === 'denied' ? `<div class="mut nnote">${L('Powiadomienia są zablokowane w ustawieniach przeglądarki — zostają komunikaty w apce.', 'Notifications are blocked in your browser settings — in-app messages still work.')}</div>` : ''}
      ${p === 'unsupported' ? `<div class="mut nnote">${isIOS() && !standalone() ? L('Na iPhonie powiadomienia działają tylko po dodaniu Kyvo do ekranu głównego (Safari → Udostępnij → „Do ekranu początkowego”, iOS 16.4+). Do tego czasu zostają komunikaty w apce.', 'On iPhone, notifications only work after adding Kyvo to the Home Screen (Safari → Share → “Add to Home Screen”, iOS 16.4+). Until then you get in-app messages.') : L('Ta przeglądarka nie obsługuje powiadomień — zostają komunikaty w apce.', 'This browser doesn\'t support notifications — in-app messages still work.')}</div>` : ''}
      ${P.enabled && p === 'granted' ? `<div class="mut nnote">${pushOff() ? L('Powiadomienia w tle (apka zamknięta): wyłączone.', 'Background notifications (app closed): off.') : L('Powiadomienia w tle (apka zamknięta): włączone.', 'Background notifications (app closed): on.')}</div><button type="button" class="pf-btn" data-npush>${pushOff() ? L('Włącz powiadomienia w tle', 'Turn on background notifications') : L('Wyłącz powiadomienia w tle', 'Turn off background notifications')}</button>` : ''}
      ${!P.enabled ? `<div class="mut nnote">${L('Push w tle, gdy apka jest zamknięta: wkrótce.', 'Background push when the app is closed: coming soon.')}</div>` : ''}
    </div>`;
  }
  function wireSettings(root, rerender) {
    const box = root && root.querySelector('[data-nset]');
    if (!box) return;
    box.querySelectorAll('[data-nt]').forEach((i) => (i.onchange = () => { S[i.dataset.nt] = i.checked; save(SKEY, S); if (window.KyvoPush && window.KyvoPush.syncTags) window.KyvoPush.syncTags(); if (D && D.toast) D.toast(L('Zapisano', 'Saved')); }));
    const np = box.querySelector('[data-npush]');
    if (np) np.onclick = async () => {
      const off = !pushOff();
      try { localStorage.setItem('kyvo_push_off', off ? '1' : '0'); } catch (e) {}
      if (window.KyvoPush) { if (off) await window.KyvoPush.optOut(); else await window.KyvoPush.init(true); }
      if (D && D.toast) D.toast(off ? L('Powiadomienia w tle wyłączone', 'Background notifications off') : L('Powiadomienia w tle włączone', 'Background notifications on'));
      const n = document.createElement('div'); n.innerHTML = settingsHtml(); box.replaceWith(n.firstElementChild); wireSettings(root, rerender);
    };
    const b = box.querySelector('[data-nperm]');
    if (b) b.onclick = async () => {
      try { await Notification.requestPermission(); } catch (e) {}
      if (perm() === 'granted') window.KyvoPush && window.KyvoPush.init();
      (rerender || (() => { const n = document.createElement('div'); n.innerHTML = settingsHtml(); box.replaceWith(n.firstElementChild); wireSettings(root); }))();
    };
    const t = box.querySelector('[data-ntest]');
    if (t) t.onclick = () => system('Kyvo', L('Test powiadomienia ✓', 'Test notification ✓'), location.href.split('#')[0] + '#more', 'kyvo-test');
  }

  window.KyvoNotify = { init(deps) { D = deps; }, isPremium, usedToday, FREE_CAP, onGood, onViral, onRunner, settingsHtml, wireSettings, settings: () => S, log: () => log, _send: send };
})();

/* ---- KyvoPush: hooks for REAL background push (app closed). Disabled unless KYVO_PUSH_CONFIG.enabled. ---- */
(function () {
  'use strict';
  let started = false;
  function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.async = true; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); }
  function tags() {
    const S = (window.KyvoNotify && window.KyvoNotify.settings()) || {};
    return { good: S.good ? '1' : '0', tweets: S.tweets ? '1' : '0', runner: S.runner !== false ? '1' : '0', premium: window.KyvoNotify && window.KyvoNotify.isPremium() ? '1' : '0', lang: window.KyvoI18n ? window.KyvoI18n.lang : 'pl' };
  }
  function withOS(fn) { if (!started || !window.OneSignalDeferred) return Promise.resolve(false); return new Promise((res) => window.OneSignalDeferred.push(async (OneSignal) => { try { await fn(OneSignal); res(true); } catch (e) { res(false); } })); }
  function syncTags() { return withOS((OneSignal) => OneSignal.User.addTags(tags())); }
  function optOut() { return withOS((OneSignal) => OneSignal.User.PushSubscription.optOut()); }
  async function init(force) {
    const C = window.KYVO_PUSH_CONFIG || {};
    if (!C.enabled) return false;
    let off = false; try { off = localStorage.getItem('kyvo_push_off') === '1'; } catch (e) {}
    if (off && !force) return false;
    if (started) return force ? withOS(async (OneSignal) => { await OneSignal.User.PushSubscription.optIn(); await OneSignal.User.addTags(tags()); }) : false;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return false; // permission is asked only on a button tap
    started = true;
    const S = (window.KyvoNotify && window.KyvoNotify.settings()) || {};
    try {
      if (C.provider === 'onesignal' && C.onesignalAppId) {
        // OneSignal Web SDK v16. sw.js must importScripts the OneSignal SW (see push_plan.md) so both share one service worker.
        window.OneSignalDeferred = window.OneSignalDeferred || [];
        await loadScript('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js');
        window.OneSignalDeferred.push(async (OneSignal) => {
          const base = location.pathname.replace(/[^/]*$/, ''); // '/kyvo-demo-/' on GitHub Pages
          await OneSignal.init({ appId: C.onesignalAppId, serviceWorkerPath: C.swPath || base.replace(/^\//, '') + 'OneSignalSDKWorker.js', serviceWorkerParam: { scope: C.swScope || base }, autoResubscribe: true, notifyButton: { enable: false }, promptOptions: { autoPrompt: false } });
          await OneSignal.User.PushSubscription.optIn();
          OneSignal.User.addTags(tags());
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
  window.KyvoPush = { init, syncTags, optOut, enabled: () => !!(window.KYVO_PUSH_CONFIG || {}).enabled };
})();
