/* Kyvo v8.1 insights: Kyvo Check (safety score), "Dlaczego tu?", watchlista + lokalne alerty, cena od tweeta.
   Public data only (DexScreener, GeckoTerminal, RugCheck, GoPlus). No keys, no tracking, everything stays in this browser.
   Not financial advice. */
(function () {
  'use strict';
  let D = null; // deps injected by app.js
  const RC = 'https://api.rugcheck.xyz/v1/tokens/';
  const GP = 'https://api.gopluslabs.io/api/v1/';
  const memo = {}; // key -> {t, data}

  /* ---------------- helpers ---------------- */
  async function getJson(url, ttl) {
    const m = memo[url];
    if (m && Date.now() - m.t < (ttl || 300000)) return m.data;
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const to = ctl ? setTimeout(() => ctl.abort(), 12000) : null;
    try {
      const r = await fetch(url, { headers: { Accept: 'application/json' }, signal: ctl ? ctl.signal : undefined });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const data = await r.json();
      memo[url] = { t: Date.now(), data };
      return data;
    } finally { if (to) clearTimeout(to); }
  }
  const E = (s) => D.esc(s);

  /* ---------------- Kyvo Check ---------------- */
  const RC_PL = {
    'Top 10 holders high ownership': 'Top 10 holderów ma ponad 70% podaży',
    'High holder concentration': 'Top 10 holderów ma ponad 50% podaży',
    'High ownership': 'Najwięksi holderzy mają ponad 80% podaży',
    'Single holder ownership': 'Jeden portfel ma dużą część podaży',
    'Large Amount of LP Unlocked': 'Płynność (LP) jest odblokowana: twórca może ją wyciągnąć',
    'Low amount of LP Providers': 'Płynność dostarcza tylko kilka portfeli',
    'Low Liquidity': 'Bardzo mała płynność',
    'Mutable metadata': 'Twórca może zmienić nazwę/obrazek (metadane)',
    'Freeze Authority still enabled': 'Twórca może zamrozić Twoje tokeny (freeze authority)',
    'Mint Authority still enabled': 'Twórca może dodrukować tokeny (mint authority)',
    'High market cap per holder': 'Bardzo wysoki MC w stosunku do liczby holderów',
    'Creator history of rugged tokens': 'Twórca ma w historii rugi',
    'Copycat token': 'Możliwa kopia innego tokena',
    'Low amount of holders': 'Bardzo mało holderów',
    'Transfer fee': 'Opłata od transferu (podatek)',
  };
  function universe() { return (D.getUniverse && D.getUniverse()) || []; }

  function cloneCheck(c) {
    const sym = String(c.symbol || '').toLowerCase();
    const nm = String(c.name || '').toLowerCase();
    if (!sym) return null;
    const same = universe().filter((x) => x && x.address !== c.address && (String(x.symbol || '').toLowerCase() === sym || (nm.length > 3 && String(x.name || '').toLowerCase() === nm)));
    if (!same.length) return null;
    const bigger = same.filter((x) => (x.liquidity || 0) > (c.liquidity || 0) * 3 && (x.mcap || 0) > (c.mcap || 0) * 3).sort((a, b) => (b.mcap || 0) - (a.mcap || 0))[0];
    return { count: same.length, bigger };
  }

  function localChecks(c) {
    const out = [];
    const add = (lvl, txt, src) => out.push({ lvl, txt, src: src || 'DexScreener' });
    const ageH = c.pairCreatedAt ? (Date.now() - c.pairCreatedAt) / 3600000 : null;
    if (c.onCurve && !c.migrated) add('info', `Coin jest jeszcze na krzywej ${c.dexId === 'fourmeme' ? 'four.meme' : 'pump.fun'} — płynność jest w krzywej, a nie w zwykłej puli.`);
    else if (c.liquidity == null || c.liquidity < 5000) add('bad', `Bardzo mała płynność (${D.fmtUsd(c.liquidity)}) — łatwo o duży poślizg albo brak kupca przy sprzedaży.`);
    else if (c.liquidity < 20000) add('warn', `Mała płynność (${D.fmtUsd(c.liquidity)}).`);
    else add('ok', `Płynność ${D.fmtUsd(c.liquidity)}.`);
    if (!c.onCurve && c.liquidity && c.mcap && c.mcap > 0) {
      const r = c.liquidity / c.mcap;
      if (r < 0.03) add('warn', `Płynność to tylko ${r < 0.001 ? '<0.1' : (r * 100).toFixed(1)}% MC — cena łatwo spada przy większej sprzedaży.`);
    }
    if (ageH == null) add('warn', 'Nieznany wiek pary.');
    else if (ageH < 1) add('warn', `Bardzo nowy coin (${Math.max(1, Math.round(ageH * 60))} min) — większość takich coinów szybko traci wartość.`);
    else if (ageH < 24) add('info', `Coin ma ${Math.round(ageH)} h.`);
    else add('ok', `Coin istnieje od ${ageH < 48 ? Math.round(ageH) + ' h' : Math.round(ageH / 24) + ' dni'}.`);
    if (!c.hasSocials) add('warn', 'Brak socials i strony (X, Telegram, WWW).');
    else add('ok', 'Ma socials albo stronę (sprawdź, czy prawdziwe).');
    if (c.buyRatioH1 != null && (c.buysH1 || 0) + (c.sellsH1 || 0) >= 20) {
      if (c.buyRatioH1 < 0.35) add('warn', `Przewaga sprzedaży w ostatniej godzinie (kupna ${Math.round(c.buyRatioH1 * 100)}%).`);
    }
    if (c.change && c.change.h1 != null && c.change.h1 <= -40) add('bad', `Spadek ${D.fmtPct(c.change.h1)} w 1h — możliwy dump albo rug.`);
    const cl = cloneCheck(c);
    if (cl && cl.bigger) add('bad', `Możliwa podróbka: jest większy coin $${E(cl.bigger.symbol)} (MC ${D.fmtUsd(cl.bigger.mcap)}). Zawsze porównaj adres (CA).`, 'Kyvo');
    else if (cl) add('warn', `Ten sam ticker ma jeszcze ${cl.count} inn${cl.count === 1 ? 'y coin' : 'e coiny'} w Kyvo — sprawdzaj adres (CA).`, 'Kyvo');
    if (c.boost > 0) add('info', 'Ma płatny boost na DexScreener — to reklama, nie dowód jakości.');
    return out;
  }

  async function remoteChecks(c) {
    const out = [];
    const add = (lvl, txt, src) => out.push({ lvl, txt, src });
    const srcs = [];
    if ((c.chainId || 'solana') === 'solana') {
      const [rc, gp] = await Promise.allSettled([
        getJson(RC + encodeURIComponent(c.address) + '/report/summary', 600000),
        getJson(GP + 'solana/token_security?contract_addresses=' + encodeURIComponent(c.address), 600000),
      ]);
      if (rc.status === 'fulfilled' && rc.value && Array.isArray(rc.value.risks)) {
        srcs.push('RugCheck');
        for (const r of rc.value.risks.slice(0, 8)) {
          const name = String(r.name || '');
          let lvl = r.level === 'danger' ? 'bad' : r.level === 'warn' ? 'warn' : 'info';
          let txt = RC_PL[name] || E(name);
          if (r.value) txt += ` (${E(String(r.value).slice(0, 16))})`;
          if (c.onCurve && !c.migrated && /holder|ownership/i.test(name)) {
            lvl = 'info';
            txt += ' — na krzywej dużą część tokenów trzyma sama krzywa, więc to częściowo normalne.';
          }
          add(lvl, txt, 'RugCheck');
        }
        if (!rc.value.risks.length) add('ok', 'RugCheck nie znalazł ryzyk.', 'RugCheck');
        if (!c.onCurve && typeof rc.value.lpLockedPct === 'number' && rc.value.lpLockedPct >= 90) add('ok', `Płynność zablokowana/spalona w ${Math.round(rc.value.lpLockedPct)}%.`, 'RugCheck');
      }
      const g = gp.status === 'fulfilled' && gp.value && gp.value.result && gp.value.result[c.address];
      if (g) {
        srcs.push('GoPlus');
        const st = (o) => o && String(o.status) === '1';
        if (st(g.mintable)) add('bad', 'Twórca nadal może dodrukować tokeny (mint authority).', 'GoPlus');
        else add('ok', 'Nie da się dodrukować tokenów (mint wyłączony).', 'GoPlus');
        if (st(g.freezable)) add('bad', 'Twórca może zamrozić tokeny w Twoim portfelu (freeze).', 'GoPlus');
        else add('ok', 'Brak możliwości zamrożenia (freeze wyłączony).', 'GoPlus');
        if (st(g.balance_mutable_authority)) add('bad', 'Ktoś może zmieniać salda portfeli.', 'GoPlus');
        if (g.transfer_fee && Object.keys(g.transfer_fee).length) add('warn', 'Token ma opłatę od transferu.', 'GoPlus');
        if (Array.isArray(g.transfer_hook) && g.transfer_hook.length) add('warn', 'Token ma transfer hook (dodatkowy kod przy każdym transferze).', 'GoPlus');
      }
    } else if (c.chainId === 'bsc') {
      const res = await getJson(GP + 'token_security/56?contract_addresses=' + encodeURIComponent(c.address), 600000).catch(() => null);
      const g = res && res.result && (res.result[String(c.address).toLowerCase()] || res.result[c.address]);
      if (g) {
        srcs.push('GoPlus');
        const one = (v) => String(v) === '1';
        if (one(g.is_honeypot)) add('bad', 'HONEYPOT: najpewniej nie da się sprzedać.', 'GoPlus');
        else if (g.is_honeypot === '0') add('ok', 'Nie wykryto honeypota (da się sprzedać).', 'GoPlus');
        if (one(g.cannot_sell_all)) add('bad', 'Nie da się sprzedać całości.', 'GoPlus');
        const bt = parseFloat(g.buy_tax), stx = parseFloat(g.sell_tax);
        if (isFinite(stx) && stx > 0.1) add('bad', `Wysoki podatek od sprzedaży: ${(stx * 100).toFixed(0)}%.`, 'GoPlus');
        else if ((isFinite(bt) && bt > 0) || (isFinite(stx) && stx > 0)) add('warn', `Podatek: kupno ${isFinite(bt) ? (bt * 100).toFixed(1) : '?'}%, sprzedaż ${isFinite(stx) ? (stx * 100).toFixed(1) : '?'}%.`, 'GoPlus');
        else if (g.buy_tax != null) add('ok', 'Brak podatku od kupna/sprzedaży.', 'GoPlus');
        if (one(g.is_mintable)) add('warn', 'Kontrakt pozwala dodrukować tokeny.', 'GoPlus');
        if (one(g.owner_change_balance)) add('bad', 'Właściciel może zmieniać salda.', 'GoPlus');
        if (one(g.hidden_owner) || one(g.can_take_back_ownership)) add('bad', 'Ukryty właściciel / można odzyskać własność kontraktu.', 'GoPlus');
        if (g.is_open_source === '0') add('warn', 'Kod kontraktu nie jest zweryfikowany (closed source).', 'GoPlus');
        if (Array.isArray(g.holders) && g.holders.length) {
          const top = g.holders.filter((h) => !one(h.is_locked) && !one(h.is_contract)).slice(0, 10).reduce((s, h) => s + (parseFloat(h.percent) || 0), 0);
          if (top > 0.5) add('warn', `Top 10 holderów (bez kontraktów) ma ${(top * 100).toFixed(0)}% podaży.`, 'GoPlus');
          else if (top > 0) add('ok', `Top 10 holderów ma ${(top * 100).toFixed(0)}% podaży.`, 'GoPlus');
        }
        if (Array.isArray(g.lp_holders) && g.lp_holders.length) {
          const locked = g.lp_holders.filter((h) => one(h.is_locked) || /^0x0{30,}|dead$/i.test(h.address || '')).reduce((s, h) => s + (parseFloat(h.percent) || 0), 0);
          if (locked >= 0.9) add('ok', `Płynność zablokowana/spalona w ${(locked * 100).toFixed(0)}%.`, 'GoPlus');
          else if (!c.onCurve) add('warn', `Tylko ${(locked * 100).toFixed(0)}% płynności zablokowane — twórca może ją wyciągnąć.`, 'GoPlus');
        }
      }
    }
    return { checks: out, srcs };
  }

  function scoreOf(checks) {
    let s = 100;
    for (const k of checks) s -= k.lvl === 'bad' ? 25 : k.lvl === 'warn' ? 9 : 0;
    return Math.max(0, Math.min(100, Math.round(s)));
  }
  function grade(s) {
    if (s >= 75) return { cls: 'kc-g', t: 'Niskie ryzyko*' };
    if (s >= 50) return { cls: 'kc-y', t: 'Uważaj' };
    return { cls: 'kc-r', t: 'Wysokie ryzyko' };
  }
  const ICON = { ok: '✅', warn: '⚠️', bad: '⛔', info: 'ℹ️' };
  function checkHtml(c, checks, srcs, loading) {
    const s = scoreOf(checks);
    const g = grade(s);
    const ord = { bad: 0, warn: 1, info: 2, ok: 3 };
    const list = checks.slice().sort((a, b) => ord[a.lvl] - ord[b.lvl]);
    const nBad = checks.filter((k) => k.lvl === 'bad').length, nWarn = checks.filter((k) => k.lvl === 'warn').length;
    return `<div class="kcheck" data-score="${s}">
      <div class="kc-top">
        <div class="kc-ring ${g.cls}" style="--p:${s}"><b>${s}</b><small>/100</small></div>
        <div style="flex:1;min-width:0"><div class="h" style="font-size:14px;margin:0">Kyvo Check <span class="badge live">beta</span></div>
          <div class="kc-grade ${g.cls}">${g.t}</div>
          <div class="mut" style="font-size:11.5px">${nBad} ${plPl(nBad, 'czerwona flaga', 'czerwone flagi', 'czerwonych flag')} · ${nWarn} ${plPl(nWarn, 'ostrzeżenie', 'ostrzeżenia', 'ostrzeżeń')}${loading ? ' · <span class="kc-load">sprawdzam kontrakt…</span>' : ''}</div></div>
      </div>
      <ul class="kc-list">${list.map((k) => `<li class="kc-${k.lvl}"><span>${ICON[k.lvl]}</span><span>${k.txt}<small class="mut"> · ${E(k.src)}</small></span></li>`).join('')}</ul>
      <div class="mut kc-foot">Źródła: DexScreener${srcs.length ? ', ' + srcs.map(E).join(', ') : ''}${(c.chainId === 'robinhood') ? ' · dla Robinhood Chain nie ma jeszcze darmowego skanera kontraktów, więc wynik jest tylko z danych rynku' : ''}. *Wynik to automatyczny filtr, nie gwarancja — rug może się zdarzyć przy każdym wyniku. To nie jest porada finansowa.</div>
    </div>`;
  }
  const remCache = {};
  async function mountCheck(slot, c) {
    if (!slot) return;
    const local = localChecks(c);
    slot.innerHTML = checkHtml(c, local, [], c.chainId === 'solana' || c.chainId === 'bsc' || !c.chainId);
    let rem = { checks: [], srcs: [] };
    const ck = (c.chainId || 'solana') + ':' + c.address, hit = remCache[ck];
    if (hit && Date.now() - hit.t < 5 * 60e3) rem = hit.v;
    else { try { rem = await remoteChecks(c); if (rem.srcs.length) remCache[ck] = { t: Date.now(), v: rem }; } catch (e) {} }
    if (!slot.isConnected) return;
    // de-duplicate: remote holder/LP checks beat local ones
    slot.innerHTML = checkHtml(c, local.concat(rem.checks), rem.srcs, false);
  }

  /* ---------------- Dlaczego ten coin jest tu? ---------------- */
  const TAB_PL = { good: 'Good Coins', new: 'New Pairs', stretch: 'Final Stretch', migrated: 'Migrated', hot: 'Hot', boosted: 'Boosted' };
  function whyHtml(c, ctx) {
    ctx = ctx || {};
    const r = [];
    const tabs = (D.tabsFor ? D.tabsFor(c) : []).filter((t) => TAB_PL[t]);
    if (tabs.length) r.push(`Spełnia filtry zakładek: <b>${tabs.map((t) => TAB_PL[t]).join(', ')}</b> (Twoje ustawienia filtrów).`);
    const cons = D.consensus ? D.consensus(c) : null;
    if (cons && cons.buyers.length) r.push(`<b>${cons.buyers.length}</b> portfel${cons.buyers.length === 1 ? '' : 'e'} smart money kupił${cons.buyers.length === 1 ? '' : 'y'} w ostatnich 72h (${cons.buyers.slice(0, 4).map(E).join(', ')})${cons.sellers.length ? `, a ${cons.sellers.length} już sprzedał${cons.sellers.length === 1 ? '' : 'o'} (${cons.sellers.slice(0, 3).map(E).join(', ')})` : ''}.`);
    const tw = D.tweetsFor ? D.tweetsFor(c) : [];
    if (tw.length) r.push(`Wspomniany na X: ${tw.slice(0, 3).map((t) => `<a href="${E(t.url)}" target="_blank" rel="noopener noreferrer">@${E(t.handle)}</a>`).join(', ')} — zobacz zakładkę Viral.`);
    const topic = D.topicFor ? D.topicFor(c) : null;
    if (topic) r.push(`Pasuje do viralowego tematu „<b>${E(D.vl ? D.vl(topic, 'label') : topic.label)}</b>”.`);
    if (c.change && c.change.h1 != null && Math.abs(c.change.h1) >= 20) r.push(`Mocny ruch ceny: <b>${D.fmtPct(c.change.h1)}</b> w ostatniej godzinie.`);
    if (c.volume && c.volume.h1 && c.liquidity && c.volume.h1 > c.liquidity) r.push(`Wolumen z 1h (${D.fmtUsd(c.volume.h1)}) jest większy niż płynność — dużo się dzieje.`);
    if (c.curveEst != null && !c.migrated) r.push(`Jest na krzywej, ok. <b>${c.curveEst.toFixed(0)}%</b> do migracji (estymacja MC / ~$69k).`);
    if (c.migrated && c.pairCreatedAt && Date.now() - c.pairCreatedAt < 6 * 3600000) r.push(`Niedawno zmigrował na ${E(c.dexId)}.`);
    if (c.boost > 0) r.push('Ma płatny boost na DexScreener (reklama, nie dowód jakości).');
    if (!r.length) r.push('Trafił tu z wyszukiwarki albo linku — nie spełnia żadnego z naszych kryteriów list.');
    return `<div class="card why"><div class="h" style="font-size:13px;margin:0 0 6px">Dlaczego ten coin jest tu?</div>
      <ul class="why-l">${r.map((x) => `<li>${x}</li>`).join('')}</ul>
      <details class="gloss"><summary>📖 Słowniczek dla początkujących</summary>
        <dl>
          <dt>MC (market cap)</dt><dd>Cena × liczba tokenów. Ile „wart” jest coin. Mały MC = duże ryzyko i duża zmienność.</dd>
          <dt>Płynność (Liq)</dt><dd>Pieniądze w puli, z której kupujesz i sprzedajesz. Mała płynność = trudno sprzedać bez dużej straty.</dd>
          <dt>Vol (wolumen)</dt><dd>Za ile kupiono i sprzedano w danym czasie.</dd>
          <dt>Buy 1h</dt><dd>Jaki procent transakcji z ostatniej godziny to kupna.</dd>
          <dt>Krzywa / migracja</dt><dd>Na pump.fun / four.meme coin startuje na „krzywej”. Gdy ją zapełni (ok. $69k MC), przechodzi na zwykłą giełdę DEX — to migracja.</dd>
          <dt>CA</dt><dd>Adres kontraktu — jedyny pewny identyfikator coina. Ticker może mieć kopie.</dd>
          <dt>Smart money</dt><dd>Publicznie znane portfele traderów z historią. Ich zakup to informacja, nie sygnał kupna — często są wcześniej i sprzedają szybciej niż Ty.</dd>
          <dt>Rug</dt><dd>Twórca wyciąga płynność albo sprzedaje wszystko i cena spada prawie do zera.</dd>
        </dl></details>
    </div>`;
  }

  /* ---------------- Watchlista + lokalne alerty ---------------- */
  const WKEY = 'kyvo_watch_v1';
  let watch = {};
  try { watch = JSON.parse(localStorage.getItem(WKEY) || '{}') || {}; } catch (e) { watch = {}; }
  const live = {}; // key -> coin-ish {priceUsd, mcap, change, liquidity, image}
  function saveWatch() { try { localStorage.setItem(WKEY, JSON.stringify(watch)); } catch (e) {} updateBadge(); }
  function isWatched(key) { return !!watch[key]; }
  function toggleWatch(c) {
    const k = D.keyOf(c);
    if (watch[k]) { delete watch[k]; saveWatch(); D.toast('Usunięto z watchlisty'); return false; }
    if (Object.keys(watch).length >= 60) { D.toast('Watchlista: max 60 coinów'); return false; }
    watch[k] = { chain: c.chainId || 'solana', address: c.address, symbol: c.symbol, name: c.name, image: c.image || null,
      addedAt: Date.now(), addedPrice: c.priceUsd || null, addedMcap: c.mcap || null, alerts: [] };
    saveWatch();
    D.toast('⭐ Dodano do watchlisty');
    ensurePoll();
    return true;
  }
  function updateBadge() {
    const n = Object.keys(watch).length;
    document.querySelectorAll('[data-watch-count]').forEach((el) => { el.textContent = n ? String(n) : ''; el.style.display = n ? '' : 'none'; });
  }
  function notifSupported() { return typeof window.Notification !== 'undefined'; }
  async function notify(title, body, key) {
    D.toast('🔔 ' + title);
    try {
      if (!notifSupported() || Notification.permission !== 'granted') return;
      const opts = { body, icon: 'icons/icon-192.png', badge: 'icons/icon-96.png', tag: 'kyvo-' + key, data: { url: location.href.split('#')[0] + '#coin/' + encodeURIComponent(key) } };
      const reg = navigator.serviceWorker && (await navigator.serviceWorker.getRegistration());
      if (reg && reg.showNotification) await reg.showNotification(title, opts);
      else new Notification(title, opts);
    } catch (e) { /* toast already shown */ }
  }
  async function pollLive() {
    const keys = Object.keys(watch);
    if (!keys.length) return;
    const addrs = [...new Set(keys.map((k) => watch[k].address))];
    for (let i = 0; i < addrs.length; i += 30) {
      try {
        const d = await getJson('https://api.dexscreener.com/latest/dex/tokens/' + addrs.slice(i, i + 30).join(','), 20000);
        const best = {};
        for (const p of (d && d.pairs) || []) {
          if (!p || !p.baseToken) continue;
          const k = (p.chainId || 'solana') + ':' + p.baseToken.address;
          const liq = (p.liquidity && p.liquidity.usd) || 0;
          if (!best[k] || liq > best[k].liquidity) best[k] = { priceUsd: p.priceUsd != null ? +p.priceUsd : null, mcap: p.marketCap || p.fdv || null, liquidity: liq, change: p.priceChange || {}, image: p.info && p.info.imageUrl };
        }
        Object.assign(live, best);
      } catch (e) { /* keep last */ }
    }
    checkAlerts();
    if (document.querySelector('#watchBody') && document.querySelector('#s-watch.on')) renderWatch(document.querySelector('#watchBody'));
  }
  function checkAlerts() {
    let dirty = false;
    for (const [k, w] of Object.entries(watch)) {
      const L = live[k];
      if (!L) continue;
      for (const a of w.alerts || []) {
        if (a.fired) continue;
        let hit = false, msg = '';
        if (a.type === 'mcAbove' && L.mcap != null && L.mcap >= a.value) { hit = true; msg = `MC ${D.fmtUsd(L.mcap)} ≥ ${D.fmtUsd(a.value)}`; }
        if (a.type === 'mcBelow' && L.mcap != null && L.mcap <= a.value) { hit = true; msg = `MC ${D.fmtUsd(L.mcap)} ≤ ${D.fmtUsd(a.value)}`; }
        if (a.type === 'pct' && w.addedPrice && L.priceUsd) {
          const ch = (L.priceUsd / w.addedPrice - 1) * 100;
          if (Math.abs(ch) >= a.value) { hit = true; msg = `${D.fmtPct(ch)} od dodania`; }
        }
        if (hit) { a.fired = Date.now(); dirty = true; notify(`$${w.symbol}: ${msg}`, 'Kyvo · alert z watchlisty (to nie porada finansowa)', k); }
      }
    }
    if (dirty) saveWatch();
  }
  let pollT = null;
  function ensurePoll() {
    if (pollT || !Object.keys(watch).length) return;
    pollLive();
    pollT = setInterval(() => { if (!document.hidden) pollLive(); }, 30000);
  }
  function watchButtonHtml(c) {
    const on = isWatched(D.keyOf(c));
    return `<button type="button" class="wbtn${on ? ' on' : ''}" id="watchBtn" aria-pressed="${on}">${on ? '★ Obserwujesz' : '☆ Obserwuj'}</button>`;
  }
  function plPl(n, one, few, many) {
    const d = n % 10, h = n % 100;
    return n === 1 ? one : d >= 2 && d <= 4 && (h < 12 || h > 14) ? few : many;
  }
  function wireWatchButton(c) {
    const b = document.getElementById('watchBtn');
    if (!b) return;
    b.onclick = () => { const on = toggleWatch(c); b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); b.textContent = on ? '★ Obserwujesz' : '☆ Obserwuj'; };
  }
  function alertLabel(a) {
    return a.type === 'mcAbove' ? `MC ≥ ${D.fmtUsd(a.value)}` : a.type === 'mcBelow' ? `MC ≤ ${D.fmtUsd(a.value)}` : `ruch ±${a.value}% od dodania`;
  }
  function renderWatch(root) {
    if (!root) return;
    const keys = Object.keys(watch).sort((a, b) => (watch[b].addedAt || 0) - (watch[a].addedAt || 0));
    const perm = notifSupported() ? Notification.permission : 'unsupported';
    const isStandalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone;
    const notifCard = `<div class="card" style="font-size:12.5px;line-height:1.5">
      <b>🔔 Jak działają alerty</b><br>
      Alerty sprawdzamy co 30 s, <b>tylko gdy Kyvo jest otwarte</b> (także w tle na komputerze). Dostaniesz komunikat w apce${perm === 'granted' ? ' i powiadomienie systemowe' : ''}. Gdy apka jest zamknięta, alerty nie działają — powiadomienia push przy zamkniętej apce wymagają serwera i dojdą później.
      ${perm === 'default' ? `<div style="margin-top:8px"><button type="button" class="pf-btn" id="notifBtn">Włącz powiadomienia systemowe</button></div>` : ''}
      ${perm === 'denied' ? '<div class="mut" style="margin-top:6px">Powiadomienia są zablokowane w ustawieniach przeglądarki — zostają komunikaty w apce.</div>' : ''}
      ${perm === 'unsupported' ? `<div class="mut" style="margin-top:6px">Ta przeglądarka nie obsługuje powiadomień${/iPhone|iPad/.test(navigator.userAgent) && !isStandalone ? ' (na iPhonie działają tylko po dodaniu Kyvo do ekranu głównego, iOS 16.4+)' : ''} — zostają komunikaty w apce.</div>` : ''}
    </div>`;
    if (!keys.length) {
      root.innerHTML = `<div class="h">⭐ Watchlista</div><div class="sub">Twoje obserwowane coiny i alerty — zapisane tylko w tej przeglądarce</div>
        <div class="empty">Pusto. Otwórz dowolny coin i kliknij <b>☆ Obserwuj</b>.</div>${notifCard}`;
      wireNotif(root);
      return;
    }
    root.innerHTML = `<div class="h">⭐ Watchlista <span class="badge live">${keys.length}</span></div>
      <div class="sub">Ceny na żywo z DexScreener · zmiana liczona od momentu dodania · zapisane tylko w tej przeglądarce</div>
      <div class="card" style="padding:4px 10px">${keys.map((k) => {
        const w = watch[k], L = live[k] || {};
        const since = w.addedPrice && L.priceUsd ? (L.priceUsd / w.addedPrice - 1) * 100 : null;
        const al = (w.alerts || []);
        return `<div class="wrow" data-wk="${E(k)}">
          <a class="wmain" href="#coin/${encodeURIComponent(k)}">
            <img class="tok" src="${E(L.image || w.image || 'kyvo_mark.svg')}" width="38" height="38" alt="" loading="lazy" onerror="this.onerror=null;this.src='kyvo_mark.svg'">
            <span class="nm"><b><span class="cbadge c-${E(w.chain)}">${E(w.chain === 'solana' ? 'SOL' : w.chain === 'bsc' ? 'BSC' : 'RH')}</span> $${E(w.symbol)}</b>
              <small>MC ${D.fmtUsd(L.mcap != null ? L.mcap : w.addedMcap)} · od dodania <b class="${D.pctClass(since)}">${D.fmtPct(since)}</b></small></span>
            <span class="rt"><b class="${D.pctClass(L.change && L.change.h1)}">${D.fmtPct(L.change && L.change.h1 != null ? +L.change.h1 : null)}</b><small class="mut">1h</small></span>
          </a>
          <div class="walerts">${al.map((a, i) => `<span class="achip${a.fired ? ' fired' : ''}">${a.fired ? '🔔 ' : ''}${E(alertLabel(a))}${a.fired ? ' · zadziałał' : ''} <button type="button" data-adel="${i}" aria-label="Usuń alert">×</button></span>`).join('')}
            <button type="button" class="achip add" data-aadd>+ alert</button>
            <button type="button" class="achip rm" data-wrm>Usuń</button></div>
          <div class="aform" hidden>
            <select data-atype><option value="mcAbove">MC powyżej ($)</option><option value="mcBelow">MC poniżej ($)</option><option value="pct">Ruch ±% od dodania</option></select>
            <input data-aval type="number" inputmode="decimal" placeholder="np. 100000" min="0">
            <button type="button" class="pf-btn" data-asave>Zapisz</button>
          </div>
        </div>`;
      }).join('')}</div>${notifCard}
      <div class="foot">Alerty działają lokalnie, gdy Kyvo jest otwarte · to nie jest porada finansowa</div>`;
    root.querySelectorAll('.wrow').forEach((row) => {
      const k = row.dataset.wk, w = watch[k];
      row.querySelector('[data-wrm]').onclick = () => { delete watch[k]; saveWatch(); renderWatch(root); };
      row.querySelector('[data-aadd]').onclick = () => { const f = row.querySelector('.aform'); f.hidden = !f.hidden; };
      row.querySelectorAll('[data-adel]').forEach((b) => (b.onclick = () => { w.alerts.splice(+b.dataset.adel, 1); saveWatch(); renderWatch(root); }));
      row.querySelector('[data-asave]').onclick = () => {
        const type = row.querySelector('[data-atype]').value;
        const value = parseFloat(row.querySelector('[data-aval]').value);
        if (!isFinite(value) || value <= 0) { D.toast('Podaj liczbę większą od 0'); return; }
        if ((w.alerts || []).length >= 5) { D.toast('Max 5 alertów na coin'); return; }
        (w.alerts = w.alerts || []).push({ type, value, fired: null, createdAt: Date.now() });
        saveWatch(); ensurePoll(); D.toast('Alert zapisany'); renderWatch(root); checkAlerts();
      };
    });
    wireNotif(root);
  }
  function wireNotif(root) {
    const b = root.querySelector('#notifBtn');
    if (b) b.onclick = async () => { try { await Notification.requestPermission(); } catch (e) {} renderWatch(root); };
  }

  /* ---------------- Cena od tweeta ---------------- */
  const TKEY = 'kyvo_tweetpx_v1';
  let tpx = {};
  try { tpx = JSON.parse(localStorage.getItem(TKEY) || '{}') || {}; } catch (e) { tpx = {}; }
  const GTN = { solana: 'solana', bsc: 'bsc', robinhood: 'robinhood' };
  async function priceAtTweet(coin, iso) {
    const id = coin.chain + ':' + coin.address + '@' + iso;
    if (tpx[id] !== undefined) return tpx[id];
    const ts = Math.floor(new Date(iso).getTime() / 1000);
    const net = GTN[coin.chain];
    if (!net || !coin.pair || !isFinite(ts)) return null;
    const ageDays = (Date.now() / 1000 - ts) / 86400;
    const [tf, agg, step] = ageDays < 5 ? ['minute', 5, 300] : ['hour', 1, 3600];
    const url = `https://api.geckoterminal.com/api/v2/networks/${net}/pools/${encodeURIComponent(coin.pair)}/ohlcv/${tf}?aggregate=${agg}&before_timestamp=${ts + step}&limit=3&currency=usd&token=${encodeURIComponent(coin.address)}`;
    const d = window.KyvoGT ? await window.KyvoGT.fetch(url, 86400000) : await getJson(url, 86400000);
    const list = (d && d.data && d.data.attributes && d.data.attributes.ohlcv_list) || [];
    const cand = list.filter((x) => x[0] <= ts).sort((a, b) => b[0] - a[0])[0];
    let px = cand ? +cand[1] : null; // open of the candle containing the tweet
    if (!(px > 0)) px = null;
    const nearCreation = coin.pair_created_at && coin.pair_created_at / 1000 > ts;
    const v = { px, preLaunch: !!nearCreation };
    tpx[id] = v;
    try { const ks = Object.keys(tpx); if (ks.length > 300) delete tpx[ks[0]]; localStorage.setItem(TKEY, JSON.stringify(tpx)); } catch (e) {}
    return v;
  }
  async function fillTweetSince(root, tweets, liveMap) {
    if (!root) return;
    const els = [...root.querySelectorAll('[data-since]')];
    for (const el of els) {
      if (!el.isConnected) return;
      const [ti, ci] = el.dataset.since.split(':').map(Number);
      const t = tweets[ti], c = t && t.coins && t.coins[ci];
      if (!c) continue;
      let v = null;
      try { v = await priceAtTweet(c, t.created_at); } catch (e) { v = null; }
      const L = liveMap[c.chain + ':' + c.address] || {};
      const now = L.price != null ? L.price : c.price_usd;
      if (!el.isConnected) return;
      if (v && v.preLaunch) { el.innerHTML = '<span class="mut">Tweet był przed startem tej puli</span>'; continue; }
      if (!v || !v.px || !now) { el.innerHTML = '<span class="mut">Cena od tweeta: brak danych</span>'; continue; }
      const ch = (now / v.px - 1) * 100;
      el.innerHTML = `Od tweeta: <b class="${D.pctClass(ch)}">${D.fmtPct(ch)}</b> <span class="mut">(${fmtPx(v.px)} → ${fmtPx(now)})</span>`;
      el.title = 'Cena z 5-min/1h świecy GeckoTerminal z momentu tweeta vs cena teraz. Nie uwzględnia opłat i poślizgu.';
    }
  }
  function fmtPx(p) {
    if (!(p > 0)) return '—';
    if (p >= 1) return '$' + p.toFixed(3);
    const z = Math.floor(-Math.log10(p));
    return '$' + p.toFixed(Math.min(12, z + 3));
  }

  window.KyvoInsights = {
    init(deps) { D = deps; updateBadge(); ensurePoll(); },
    mountCheck, localChecks, scoreOf, cloneCheck, whyHtml,
    watchButtonHtml, wireWatchButton, renderWatch, isWatched, toggleWatch, getWatch: () => watch, checkAlerts, _live: live,
    fillTweetSince, priceAtTweet,
  };
})();
