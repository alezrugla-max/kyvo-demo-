/* Kyvo v8.1 — sign-in. Wallet sign-in = the user SIGNS a readable text message (never a transaction),
   verified locally (ed25519 / secp256k1 ecrecover via vendor/kyvo-crypto). Session lives only in localStorage.
   Google sign-in (Firebase Auth) is wired but off until auth-config.js has a real config + enabled:true. */
(function () {
  'use strict';
  const SKEY = 'kyvo_session_v1';
  const SEEN = 'kyvo_login_seen_v8';
  const CFG = window.KYVO_AUTH_CONFIG || { wallet: { enabled: true }, google: { enabled: false }, apple: { enabled: false } };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const short = (a) => (a ? a.slice(0, 4) + '…' + a.slice(-4) : '');
  const isMobile = () => /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const toast = (t) => setTimeout(() => (window.__kyvoToast ? window.__kyvoToast(t) : console.log(t)), 0);
  const enc = (s) => new TextEncoder().encode(s);
  const hex = (u8) => [...u8].map((b) => b.toString(16).padStart(2, '0')).join('');
  const listeners = [];

  const EMAIL_KEY = 'kyvo_email_for_signin';
  function fbConfigured() {
    const f = CFG.firebase || {};
    return !!(f.apiKey && !/PASTE_/.test(f.apiKey) && f.authDomain && !/PASTE_/.test(f.authDomain) && f.projectId && !/PASTE_/.test(f.projectId) && f.appId && !/PASTE_/.test(f.appId));
  }
  function googleReady() { return !!(CFG.google && CFG.google.enabled && fbConfigured()); }
  function emailReady() { return !!(CFG.email && CFG.email.enabled && fbConfigured()); }

  /* ---------------- session ---------------- */
  function read() {
    try { return JSON.parse(localStorage.getItem(SKEY) || 'null'); } catch (e) { return null; }
  }
  function verifySession(s) {
    if (!s || !s.method) return false;
    if (s.method === 'google' || s.method === 'email') return !!s.uid;
    const K = window.KyvoCrypto;
    if (!K || !s.message || !s.signature || !s.address) return false;
    if (s.message.indexOf(s.address) < 0) return false;
    try { return s.method === 'solana' ? K.verifySolana(s.message, s.signature, s.address) : K.verifyEvm(s.message, s.signature, s.address); } catch (e) { return false; }
  }
  let cache;
  function session() {
    if (cache !== undefined) return cache;
    const s = read();
    cache = verifySession(s) ? s : null;
    if (s && !cache) { try { localStorage.removeItem(SKEY); } catch (e) {} }
    return cache;
  }
  function save(s) {
    cache = s;
    try { s ? localStorage.setItem(SKEY, JSON.stringify(s)) : localStorage.removeItem(SKEY); } catch (e) {}
    try { localStorage.setItem(SEEN, '1'); } catch (e) {}
    listeners.forEach((f) => { try { f(s); } catch (e) {} });
  }
  async function logout() {
    const s = session();
    if (s && (s.method === 'google' || s.method === 'email') && fb.auth) { try { await fb.mod.signOut(fb.auth); } catch (e) {} }
    try { if (s && s.method === 'solana' && s.wallet === 'phantom' && window.phantom && window.phantom.solana) await window.phantom.solana.disconnect(); } catch (e) {}
    save(null);
    toast('Wylogowano');
  }
  function addToProfile(chain, address) {
    const P = window.KyvoProfile;
    if (!P || !P.own) return;
    const o = P.own();
    const want = chain === 'solana' ? ['solana'] : ['bsc', 'robinhood'];
    for (const ch of want) {
      if (o.wallets.some((w) => w.chain === ch && w.address.toLowerCase() === address.toLowerCase())) continue;
      if (o.wallets.length >= (P.MAX_WALLETS || 8)) break;
      o.wallets.push({ chain: ch, address });
    }
    P.saveOwn(o);
  }
  function buildMessage(address, chainLabel) {
    const nonce = window.KyvoCrypto ? window.KyvoCrypto.randomNonce() : String(Math.random()).slice(2);
    return [
      'Logowanie do Kyvo.',
      'To nie jest transakcja i nic nie kosztuje.',
      '',
      'Adres: ' + address,
      'Sieć: ' + chainLabel,
      'Strona: ' + location.host,
      'Nonce: ' + nonce,
      'Czas: ' + new Date().toISOString(),
    ].join('\n');
  }

  /* ---------------- wallets ---------------- */
  const appUrl = () => location.origin + location.pathname;
  function deepLink(kind) {
    const url = appUrl() + '#login';
    if (kind === 'phantom') return 'https://phantom.app/ul/browse/' + encodeURIComponent(url) + '?ref=' + encodeURIComponent(location.origin);
    if (kind === 'solflare') return 'https://solflare.com/ul/v1/browse/' + encodeURIComponent(url) + '?ref=' + encodeURIComponent(location.origin);
    if (kind === 'metamask') return 'https://metamask.app.link/dapp/' + (location.host + location.pathname);
    return url;
  }
  const INSTALL = { phantom: 'https://phantom.app/download', solflare: 'https://solflare.com/download', metamask: 'https://metamask.io/download/' };
  function solProvider(kind) {
    if (kind === 'phantom') { const p = (window.phantom && window.phantom.solana) || (window.solana && window.solana.isPhantom ? window.solana : null); return p || null; }
    if (kind === 'solflare') return window.solflare && window.solflare.isSolflare ? window.solflare : null;
    return null;
  }
  function evmProvider() {
    const e = window.ethereum;
    if (!e) return null;
    if (Array.isArray(e.providers) && e.providers.length) return e.providers.find((p) => p.isMetaMask) || e.providers[0];
    return e;
  }
  function missing(kind) {
    if (isMobile()) { location.href = deepLink(kind); return; }
    const names = { phantom: 'Phantom', solflare: 'Solflare', metamask: 'MetaMask' };
    status(`Nie widzę portfela ${names[kind]} w tej przeglądarce. <a href="${INSTALL[kind]}" target="_blank" rel="noopener noreferrer">Zainstaluj ${names[kind]} ↗</a> albo wybierz inny sposób.`, 'warn');
  }
  async function loginSolana(kind) {
    const p = solProvider(kind);
    if (!p) return missing(kind);
    status('Połącz portfel i podpisz wiadomość w aplikacji portfela…');
    const r = await p.connect();
    const pk = String((r && r.publicKey) || p.publicKey || '');
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(pk)) throw new Error('Portfel nie zwrócił adresu.');
    const msg = buildMessage(pk, 'Solana');
    if (typeof p.signMessage !== 'function') throw new Error('Ten portfel nie obsługuje podpisywania wiadomości.');
    const res = await p.signMessage(enc(msg), 'utf8');
    const sig = res && res.signature ? res.signature : res;
    const sigU8 = sig instanceof Uint8Array ? sig : Uint8Array.from(sig && sig.data ? sig.data : sig || []);
    if (!window.KyvoCrypto.verifySolana(msg, sigU8, pk)) throw new Error('Podpis się nie zgadza — spróbuj ponownie.');
    const s = { v: 1, method: 'solana', wallet: kind, chain: 'solana', address: pk, message: msg, signature: hex(sigU8), signedAt: new Date().toISOString() };
    addToProfile('solana', pk);
    save(s);
    return s;
  }
  async function loginEvm() {
    const p = evmProvider();
    if (!p) return missing('metamask');
    status('Połącz portfel i podpisz wiadomość w aplikacji portfela…');
    const accs = await p.request({ method: 'eth_requestAccounts' });
    const addr = String((accs && accs[0]) || '');
    if (!/^0x[0-9a-fA-F]{40}$/.test(addr)) throw new Error('Portfel nie zwrócił adresu.');
    const msg = buildMessage(addr, 'BSC / Robinhood Chain (EVM)');
    const sig = await p.request({ method: 'personal_sign', params: ['0x' + hex(enc(msg)), addr] });
    if (!window.KyvoCrypto.verifyEvm(msg, sig, addr)) throw new Error('Podpis się nie zgadza — spróbuj ponownie.');
    const name = p.isMetaMask ? 'metamask' : p.isRabby ? 'rabby' : p.isCoinbaseWallet ? 'coinbase' : p.isTrust ? 'trust' : 'evm';
    const s = { v: 1, method: 'evm', wallet: name, chain: 'evm', address: addr.toLowerCase(), message: msg, signature: sig, signedAt: new Date().toISOString() };
    s.message = msg; // message contains the checksum/original case; verify uses case-insensitive compare
    s.address = addr;
    addToProfile('evm', addr);
    save(s);
    return s;
  }

  /* ---------------- Google (Firebase Auth) — off until configured ---------------- */
  const fb = { auth: null, mod: null };
  async function fbInit() {
    if (fb.auth) return fb;
    const v = CFG.sdkVersion || '10.14.1';
    const base = 'https://www.gstatic.com/firebasejs/' + v + '/';
    const appMod = await import(base + 'firebase-app.js');
    const authMod = await import(base + 'firebase-auth.js');
    const app = appMod.initializeApp(CFG.firebase);
    fb.auth = authMod.getAuth(app);
    fb.mod = authMod;
    try { await authMod.setPersistence(fb.auth, authMod.browserLocalPersistence); } catch (e) {}
    return fb;
  }
  function fromUser(u, method) {
    return { v: 1, method: method || 'google', uid: u.uid, name: u.displayName || '', email: u.email || '', photo: u.photoURL || '', signedAt: new Date().toISOString() };
  }
  async function loginGoogle() {
    if (!googleReady()) { status('Logowanie przez Google będzie dostępne wkrótce.', 'warn'); return; }
    const { auth, mod } = await fbInit();
    const prov = new mod.GoogleAuthProvider();
    prov.setCustomParameters({ prompt: 'select_account' });
    const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    let r;
    if (standalone) { await mod.signInWithRedirect(auth, prov); return; }
    try { r = await mod.signInWithPopup(auth, prov); } catch (e) {
      if (/popup/.test(String(e && e.code))) { await mod.signInWithRedirect(auth, prov); return; }
      throw e;
    }
    const s = fromUser(r.user);
    save(s);
    return s;
  }
  async function googleOnLoad() {
    if (!googleReady() && !emailReady()) return;
    try {
      const { auth, mod } = await fbInit();
      if (emailReady() && mod.isSignInWithEmailLink(auth, location.href)) {
        let email = '';
        try { email = localStorage.getItem(EMAIL_KEY) || ''; } catch (e) {}
        if (!email) email = prompt(window.KyvoI18n ? window.KyvoI18n.t('Podaj e-mail, na który wysłaliśmy link logowania:') : 'Podaj e-mail, na który wysłaliśmy link logowania:') || '';
        if (email) {
          const r = await mod.signInWithEmailLink(auth, email.trim(), location.href);
          try { localStorage.removeItem(EMAIL_KEY); } catch (e) {}
          history.replaceState(null, '', location.pathname + '#profil');
          save(fromUser(r.user, 'email'));
          toast('Zalogowano e-mailem');
        }
        return;
      }
      if (googleReady()) {
        const r = await mod.getRedirectResult(auth);
        if (r && r.user) { save(fromUser(r.user)); toast('Zalogowano przez Google'); }
      }
    } catch (e) { toast('Logowanie nie powiodło się — link mógł wygasnąć. Spróbuj ponownie.'); }
  }
  /* e-mail: Firebase passwordless "email link" — we send a one-time sign-in link, the user taps it */
  async function sendEmailLink(email) {
    if (!emailReady()) { status('Logowanie e-mailem będzie dostępne wkrótce.', 'warn'); return; }
    email = String(email || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { status('Wpisz poprawny adres e-mail.', 'err'); return; }
    const { auth, mod } = await fbInit();
    await mod.sendSignInLinkToEmail(auth, email, { url: appUrl() + '#login', handleCodeInApp: true });
    try { localStorage.setItem(EMAIL_KEY, email); } catch (e) {}
    status(`Wysłaliśmy link logowania na <b>${esc(email)}</b>. Otwórz maila na tym urządzeniu i kliknij link (sprawdź też spam).`, 'ok');
  }
  async function deleteGoogleAccount() {
    const s = session();
    if (!s || (s.method !== 'google' && s.method !== 'email')) return;
    if (!confirm(window.KyvoI18n ? window.KyvoI18n.t('Usunąć konto Kyvo? Tej operacji nie da się cofnąć.') : 'Usunąć konto Kyvo? Tej operacji nie da się cofnąć.')) return;
    try { const { auth } = await fbInit(); if (auth.currentUser) await auth.currentUser.delete(); save(null); toast('Konto usunięte'); }
    catch (e) { toast('Zaloguj się ponownie i spróbuj jeszcze raz (wymóg bezpieczeństwa).'); }
  }

  /* ---------------- UI ---------------- */
  let statusEl = null;
  function status(html, kind) {
    if (!statusEl) return;
    statusEl.className = 'lgn-status' + (kind ? ' ' + kind : '');
    statusEl.innerHTML = html;
    statusEl.hidden = !html;
  }
  function errText(e) {
    const m = String((e && (e.message || e.code)) || e || '');
    if (/reject|denied|cancel|4001|user closed/i.test(m)) return 'Anulowano w portfelu. Nic się nie stało.';
    return 'Nie udało się zalogować: ' + esc(m.slice(0, 140));
  }
  function renderLogin(root, opts) {
    opts = opts || {};
    const s = session();
    const gOk = googleReady();
    const eOk = emailReady();
    root.innerHTML = `
      <div class="lgn">
        <div class="lgn-hero">
          <img src="icons/icon-192.png" width="84" height="84" alt="" class="lgn-logo">
          <h1>Zaloguj się do Kyvo</h1>
          <p>Smart money i viralowe memecoiny w jednym miejscu.</p>
          <p class="lgn-why">Logowanie zapisze Twój portfel i odblokuje Premium. Bez logowania też masz pełny dostęp.</p>
        </div>
        ${s ? `<div class="lgn-status ok">Jesteś zalogowany: <b>${esc(s.uid ? s.email || s.name : short(s.address))}</b> · <a href="#profil">Profil →</a></div>` : ''}
        <div class="lgn-sec">Portfel <span class="mut">· podpisujesz tylko wiadomość</span></div>
        <div class="lgn-btns">
          <button type="button" class="lgn-btn" data-l="phantom"><span class="lgn-ic ic-phantom">👻</span><span><b>Phantom</b><small>Solana</small></span></button>
          <button type="button" class="lgn-btn" data-l="solflare"><span class="lgn-ic ic-solflare">☀️</span><span><b>Solflare</b><small>Solana</small></span></button>
          <button type="button" class="lgn-btn" data-l="metamask"><span class="lgn-ic ic-mm">🦊</span><span><b>MetaMask / portfel EVM</b><small>BSC · Robinhood Chain</small></span></button>
        </div>
        <div class="lgn-sec">Konto</div>
        <div class="lgn-btns">
          <button type="button" class="lgn-btn ${gOk ? '' : 'off'}" data-l="google" ${gOk ? '' : 'aria-disabled="true"'}><span class="lgn-ic ic-g">G</span><span><b>Google</b><small>${gOk ? 'Zaloguj kontem Google' : 'Wkrótce'}</small></span></button>
          <button type="button" class="lgn-btn ${eOk ? '' : 'off'}" data-l="email" ${eOk ? '' : 'aria-disabled="true"'}><span class="lgn-ic ic-mail">✉️</span><span><b>E-mail</b><small>${eOk ? 'Link logowania na maila — bez hasła' : 'Wkrótce'}</small></span></button>
          <div class="lgn-mail" id="lgnMail" hidden><input type="email" id="lgnEmail" placeholder="twoj@email.com" autocomplete="email" inputmode="email"><button type="button" class="pf-btn pf-share" id="lgnSend">Wyślij link</button></div>
          <button type="button" class="lgn-btn off" disabled aria-disabled="true"><span class="lgn-ic ic-apple">🍎</span><span><b>Apple</b><small>Wkrótce</small></span></button>
        </div>
        <div class="lgn-status" id="lgnStatus" hidden></div>
        <button type="button" class="lgn-guest" id="lgnGuest">Kontynuuj bez logowania</button>
        <div class="lgn-safe">🔒 Logowanie portfelem to tylko podpis wiadomości tekstowej — <b>to nie jest transakcja i nic nie kosztuje</b>. Kyvo nigdy nie prosi o seed phrase ani klucz prywatny i nie ma dostępu do Twoich środków. Bez logowania masz pełny dostęp do aplikacji.</div>
        <div class="lgn-legal">Logując się akceptujesz <a href="#legal/regulamin">Regulamin</a> i <a href="#legal/prywatnosc">Politykę prywatności</a>.</div>
      </div>`;
    statusEl = root.querySelector('#lgnStatus');
    const done = (sess) => { if (sess) { toast('Zalogowano · ' + (sess.method === 'google' ? sess.name || 'Google' : short(sess.address))); (opts.onDone || (() => (location.hash = 'profil')))(sess); } };
    root.querySelectorAll('[data-l]').forEach((b) => (b.onclick = async () => {
      if (b.classList.contains('busy')) return;
      const k = b.dataset.l;
      b.classList.add('busy');
      try {
        if (k === 'phantom' || k === 'solflare') done(await loginSolana(k));
        else if (k === 'metamask') done(await loginEvm());
        else if (k === 'google') done(await loginGoogle());
        else if (k === 'email') {
          if (!eOk) status('Logowanie e-mailem będzie dostępne wkrótce.', 'warn');
          else { const m = root.querySelector('#lgnMail'); m.hidden = false; root.querySelector('#lgnEmail').focus(); }
        }
      } catch (e) { status(errText(e), 'err'); }
      finally { b.classList.remove('busy'); }
    }));
    const send = root.querySelector('#lgnSend');
    if (send) send.onclick = async () => { try { await sendEmailLink(root.querySelector('#lgnEmail').value); } catch (e) { status(errText(e), 'err'); } };
    root.querySelector('#lgnGuest').onclick = () => {
      try { localStorage.setItem(SEEN, '1'); } catch (e) {}
      (opts.onGuest || (() => (location.hash = 'pulse')))();
    };
  }
  /* compact bar for Profil: avatar/nick + address + Wyloguj, or "Zaloguj się" */
  function renderBar(el) {
    if (!el) return;
    const s = session();
    const P = window.KyvoProfile;
    const o = P && P.own ? P.own() : {};
    if (!s) {
      el.innerHTML = `<div class="sbar"><div class="sbar-t"><b>Tryb gościa</b><small class="mut">Pełny dostęp · logowanie opcjonalne</small></div><a class="pf-btn pf-share sbar-btn" href="#login">Zaloguj się</a></div>`;
      return;
    }
    const av = s.uid && s.photo ? `<img class="pf-av" src="${esc(s.photo)}" style="width:36px;height:36px" alt="" referrerpolicy="no-referrer">` : P && P.avatarSpec ? P.avatarSpec(o.avatar, 36, o.nick || 'K') : '';
    const who = s.uid ? o.nick || s.name || s.email : o.nick || 'Zalogowano portfelem';
    const sub = s.uid ? (s.method === 'email' ? 'E-mail · ' : 'Google · ') + esc(s.email) : (s.method === 'solana' ? 'Solana · ' : 'EVM · ') + esc(short(s.address)) + ' · podpis ✓';
    el.innerHTML = `<div class="sbar">${av}<div class="sbar-t"><b>${esc(who)}</b><small class="mut">${sub}</small></div><button type="button" class="pf-btn sbar-btn" id="sbarOut">Wyloguj</button></div>
      ${s.uid ? '<button type="button" class="lnk-del" id="sbarDel">Usuń konto Kyvo</button>' : ''}`;
    el.querySelector('#sbarOut').onclick = async () => { await logout(); renderBar(el); if (window.__kyvoRerenderProfil) window.__kyvoRerenderProfil(); };
    const del = el.querySelector('#sbarDel');
    if (del) del.onclick = async () => { await deleteGoogleAccount(); renderBar(el); };
  }
  function shouldOfferLogin() {
    try { return !session() && !localStorage.getItem(SEEN); } catch (e) { return false; }
  }

  googleOnLoad();
  window.KyvoAuth = { session, logout, renderLogin, renderBar, shouldOfferLogin, onChange: (f) => listeners.push(f), googleReady, emailReady, deepLink, buildMessage, _verify: verifySession };
})();
