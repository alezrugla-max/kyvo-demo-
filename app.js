/* KYVO_LIVE_v8_4 — multi-chain Pulse + smart money + leaderboard + Viral z X + onboarding/legal/login. Not financial advice. */
(function () {
  'use strict';

  const DS = 'https://api.dexscreener.com';
  const GT = 'https://api.geckoterminal.com/api/v2';
  const CACHE_KEY = 'kyvo_coins_v7';
  const FILT_KEY = 'kyvo_filters_v7';
  const CHAIN_KEY = 'kyvo_chain_v7';
  const REFRESH_MS = 45_000;
  const FALLBACK_IMG = 'kyvo_mark.svg';
  const MVP_MARKER = 'KYVO_LIVE_v8_3';
  /** Pump.fun / four.meme graduation commonly cited ~$69k MC on bonding curve — estimate only. */
  const PUMP_GRAD_MCAP = 69000;
  const FOUR_GRAD_MCAP = 69000;

  const CHAINS = ['solana', 'bsc', 'robinhood', 'all'];
  const CHAIN_LABEL = { solana: 'Solana', bsc: 'BSC', robinhood: 'Robin', all: 'Wszystkie' };
  const CHAIN_BADGE = { solana: 'SOL', bsc: 'BSC', robinhood: 'RH' };
  const GECKO_NET = { solana: 'solana', bsc: 'bsc', robinhood: 'robinhood' };

  const CURVE_DEX = { pumpfun: PUMP_GRAD_MCAP, fourmeme: FOUR_GRAD_MCAP };
  const MIG_DEX_BY_CHAIN = {
    solana: new Set(['pumpswap', 'raydium', 'meteora', 'orca', 'moonshot', 'fluxbeam']),
    bsc: new Set(['pancakeswap']),
    robinhood: new Set(), // no public bonding→DEX graduation flow identified
  };
  const ALL_MIG = new Set([].concat(...Object.values(MIG_DEX_BY_CHAIN).map((s) => [...s])));

  const $ = (q, r = document) => r.querySelector(q);
  const $$ = (q, r = document) => [...r.querySelectorAll(q)];
  const toastEl = $('#toast');
  let toastT;
  function toast(t) {
    toastEl.textContent = t;
    toastEl.classList.add('on');
    clearTimeout(toastT);
    toastT = setTimeout(() => toastEl.classList.remove('on'), 1800);
  }

  function fmtUsd(n) {
    if (n == null || !isFinite(n) || Number(n) === 0) return '—';
    if (n < 0) { const r = fmtUsd(-n); return r === '—' ? r : '-' + r; }
    const a = Math.abs(n);
    if (a >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (a >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
    if (a >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    if (a >= 1) return '$' + n.toFixed(2);
    if (a >= 0.0001) return '$' + n.toFixed(6);
    if (a < 1e-10) return '—';
    return '$' + Number(n).toExponential(2);
  }
  function fmtLiq(c) {
    const liq = c && c.liquidity;
    if (c && c.onCurve && (liq == null || !isFinite(liq) || liq <= 0)) return 'krzywa';
    if (liq == null || !isFinite(liq) || liq <= 0) return '—';
    if (liq < 1) return '<$1';
    return fmtUsd(liq);
  }
  function fmtPct(n) {
    if (n == null || !isFinite(n)) return '—';
    return (n >= 0 ? '+' : '') + Number(n).toFixed(1) + '%';
  }
  function pctClass(n) {
    if (n == null || !isFinite(n)) return 'mut';
    return n >= 0 ? 'up' : 'dn';
  }
  function shortCa(a) {
    return a ? a.slice(0, 4) + '…' + a.slice(-4) : '—';
  }
  function ageFrom(ms) {
    if (!ms) return '—';
    const s = Math.max(0, (Date.now() - ms) / 1000);
    if (s < 60) return Math.floor(s) + 's';
    if (s < 3600) return Math.floor(s / 60) + 'm';
    if (s < 86400) return Math.floor(s / 3600) + 'h';
    if (s < 86400 * 30) return Math.floor(s / 86400) + 'd';
    return Math.floor(s / (86400 * 30)) + 'mo';
  }
  function ageHours(ms) {
    if (!ms) return null;
    return (Date.now() - ms) / 3600000;
  }
  function timeAgo(iso) {
    if (!iso) return '';
    const t = new Date(iso).getTime();
    return isFinite(t) ? agoLabel(iso) : '';
  }
  function fmtInt(n) {
    if (n == null) return '—';
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return String(n);
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function parseNum(v) {
    if (v === '' || v == null) return null;
    const n = Number(v);
    return isFinite(n) ? n : null;
  }
  function coinKey(chain, addr) {
    return String(chain || 'solana') + ':' + String(addr || '');
  }
  function keyOf(c) {
    return coinKey(c.chainId, c.address);
  }
  function chainBadge(c) {
    const id = c.chainId || 'solana';
    return CHAIN_BADGE[id] || id.slice(0, 3).toUpperCase();
  }

  function agoLabel(isoOrSec) {
    let t;
    if (typeof isoOrSec === 'number') t = isoOrSec * 1000;
    else t = new Date(isoOrSec).getTime();
    if (!isFinite(t)) return '—';
    const sec = Math.max(0, Math.round((Date.now() - t) / 1000));
    if (sec < 60) return sec + 's temu';
    if (sec < 3600) return Math.floor(sec / 60) + ' min temu';
    if (sec < 86400) return Math.floor(sec / 3600) + 'h temu';
    return Math.floor(sec / 86400) + 'd temu';
  }
  /* honest timestamp: "20.10, 08:43 (3h temu)" in the user's local time */
  function stampLabel(iso) {
    const t = iso ? new Date(iso).getTime() : NaN;
    if (!isFinite(t)) return 'brak danych';
    const d = new Date(t);
    const hm = d.toLocaleTimeString((window.KyvoI18n ? window.KyvoI18n.locale() : 'pl-PL'), { hour: '2-digit', minute: '2-digit' });
    const day = d.toLocaleDateString((window.KyvoI18n ? window.KyvoI18n.locale() : 'pl-PL'), { day: '2-digit', month: '2-digit' });
    const today = new Date().toDateString() === d.toDateString();
    return (today ? 'dziś ' : day + ', ') + hm + ' (' + agoLabel(iso) + ')';
  }
  function staleHtml(iso, hours, what) {
    const t = iso ? new Date(iso).getTime() : NaN;
    if (!isFinite(t)) return `<div class="card" style="font-size:12.5px;color:var(--warn)">Brak informacji o aktualizacji ${esc(what)}.</div>`;
    const h = (Date.now() - t) / 3600000;
    return h > hours ? `<div class="card" style="font-size:12.5px;color:var(--warn)">Uwaga: ${esc(what)} mają już ${Math.floor(h)} h — mogą być nieaktualne.</div>` : '';
  }
  function smartBuysForMint(mint) {
    if (!smartMoney || !smartMoney.by_mint) return [];
    return smartMoney.by_mint[mint] || [];
  }
  /* smart-money consensus: unique buyers (72h) and who of them already sold */
  let consCache = null;
  function smConsensus(mint) {
    if (!smartMoney) return { buyers: [], sellers: [] };
    if (!consCache) {
      consCache = {};
      const sells = {};
      for (const a of smartMoney.activity || []) if (a.side === 'sell') (sells[a.mint] = sells[a.mint] || new Set()).add(a.wallet_name || a.wallet_id);
      for (const [m, arr] of Object.entries(smartMoney.by_mint || {})) {
        const b = [...new Set(arr.map((x) => x.wallet_name || x.wallet_id))];
        const sl = sells[m] ? [...sells[m]].filter((n) => b.includes(n)) : [];
        consCache[m] = { buyers: b, sellers: sl };
      }
    }
    return consCache[mint] || { buyers: [], sellers: [] };
  }
  function consensusOf(c) {
    return (c.chainId === 'solana' || !c.chainId) ? smConsensus(c.address) : { buyers: [], sellers: [] };
  }
  function fmtSize(b) {
    if (b && b.usd_size != null && isFinite(b.usd_size) && b.usd_size > 0) return b.usd_size < 1 ? '<$1' : '~' + fmtUsd(b.usd_size);
    if (b && b.sol_size != null && isFinite(b.sol_size) && b.sol_size > 0) return '~' + Number(b.sol_size).toFixed(2) + ' SOL';
    return '—';
  }
  async function loadSmartMoney() {
    try {
      smartMoney = await fetchJson('data/smart_money.json?v=8.2');
      consCache = null;
    } catch (e) {
      smartMoney = { by_mint: {}, activity: [], updated_at: null };
    }
  }
  async function loadLeaderboard() {
    try {
      leaderboard = await fetchJson('data/leaderboard.json?d=' + Math.floor(Date.now() / 3600000));
    } catch (e) {
      leaderboard = { leaders: [], updated_at: null };
    }
  }



  /* ---- Fuzzy ---- */
  function norm(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  }
  function levenshtein(a, b) {
    a = norm(a); b = norm(b);
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    const row = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 0; i < a.length; i++) {
      let prev = i + 1;
      for (let j = 0; j < b.length; j++) {
        const cur = a[i] === b[j] ? row[j] : 1 + Math.min(prev, row[j], row[j + 1]);
        row[j] = prev;
        prev = cur;
      }
      row[b.length] = prev;
    }
    return row[b.length];
  }
  function fuzzyScore(query, name, symbol, address) {
    const q = norm(query);
    if (!q) return 0;
    const n = norm(name), sy = norm(symbol), ad = String(address || '').toLowerCase();
    if (ad && ad === query.trim().toLowerCase()) return 100;
    if (ad && query.length >= 6 && ad.includes(query.trim().toLowerCase())) return 95;
    if (sy === q || n === q) return 100;
    if (sy.startsWith(q) || n.startsWith(q)) return 90;
    if (sy.includes(q) || n.includes(q)) return 80;
    const dSy = levenshtein(q, sy);
    const dN = levenshtein(q, n.slice(0, Math.max(q.length + 2, sy.length)));
    const best = Math.min(dSy, dN);
    const maxLen = Math.max(q.length, sy.length, 1);
    if (best <= 1 && q.length >= 3) return 75;
    if (best <= 2 && q.length >= 4) return 60;
    if (best / maxLen <= 0.34) return 50;
    return 0;
  }

  /** Only platforms with verified URL formats for that chain. */
  function platformUrls(addr, chain) {
    const a = encodeURIComponent(addr);
    const c = (chain || 'solana').toLowerCase();
    const out = {
      DexScreener: `https://dexscreener.com/${c}/${a}`,
    };
    if (c === 'solana') {
      out.FOMO = `https://fomo.family/tokens/solana/${a}`; // FOMO route tokens/:chain/:address (universal link → opens the FOMO app on iPhone)
      out.Axiom = `https://axiom.trade/t/${a}?chain=sol`;
      out.Photon = `https://photon-sol.tinyastro.io/en/lp/${a}`;
      out.GMGN = `https://gmgn.ai/sol/token/${a}`;
      out.Explorer = `https://solscan.io/token/${a}`;
    } else if (c === 'bsc') {
      out.FOMO = `https://fomo.family/tokens/bnb/${a}`; // FOMO chain slug for BSC is "bnb"
      out.GMGN = `https://gmgn.ai/bsc/token/${a}`;
      out.PancakeSwap = `https://pancakeswap.finance/swap?outputCurrency=${a}&chain=bsc`;
      out.Explorer = `https://bscscan.com/token/${a}`;
      // Axiom / Photon: Solana-only terminals — omitted
    } else if (c === 'robinhood') {
      out.FOMO = `https://fomo.family/tokens/robinhood/${a}`;
      out.Explorer = `https://hoodexplorer.io/token/${a}`;
      // No verified GMGN / Axiom / Photon URLs for Robinhood Chain
    }
    return out;
  }

  function platButtonsHtml(urls) {
    const order = ['FOMO', 'Axiom', 'Photon', 'GMGN', 'PancakeSwap'];
    const keys = order.filter((k) => urls[k]);
    if (!keys.length) return '';
    const cols = Math.min(4, keys.length);
    return `<div class="plats" style="grid-template-columns:repeat(${cols},1fr)">${keys
      .map((k, i) => `<a class="plat${i === 0 ? ' p0' : ''}" href="${esc(urls[k])}" target="_blank" rel="noopener noreferrer">${esc(k)}</a>`)
      .join('')}</div>`;
  }

  /* ---- Chain switcher ---- */
  let activeChain = 'solana';
  function loadChain() {
    try {
      const v = localStorage.getItem(CHAIN_KEY);
      if (v && CHAINS.includes(v)) activeChain = v;
    } catch (e) {}
  }
  function saveChain() {
    try {
      localStorage.setItem(CHAIN_KEY, activeChain);
    } catch (e) {}
  }
  function setActiveChain(ch) {
    if (!CHAINS.includes(ch)) return;
    activeChain = ch;
    saveChain();
    // sync filter chain fields
    for (const k of FILTER_TABS) {
      if (filters[k]) filters[k].chain = ch;
    }
    saveFilters();
    renderChainSwitcher();
    try { updateRunnerBadge(); } catch (e) {} // Runner tab/badge follow the active chain (notifications cover all chains)
    if (['pulse', 'hot', 'good', 'new', 'stretch', 'migrated', 'boosted', 'runner', 'track'].includes(view)) setView(view);
    else if (view === 'search') {
      const q = ($('#q') && $('#q').value.trim()) || '';
      if (q) runSearch(q);
    }
  }
  function renderChainSwitcher() {
    const el = $('#chainSwitch');
    if (!el) return;
    el.innerHTML = CHAINS.map(
      (c) =>
        `<button type="button" data-chain="${c}" class="${activeChain === c ? 'on' : ''}">${esc(CHAIN_LABEL[c])}</button>`
    ).join('');
    $$('#chainSwitch [data-chain]').forEach((b) =>
      b.addEventListener('click', () => setActiveChain(b.getAttribute('data-chain')))
    );
  }
  function chainSupportsStretch(ch) {
    return ch === 'solana' || ch === 'bsc' || ch === 'all';
  }
  function chainSupportsMigrated(ch) {
    return ch === 'solana' || ch === 'bsc' || ch === 'all';
  }
  function chainNote(ch) {
    if (ch === 'robinhood') {
      return 'Robinhood Chain nie ma publicznej bonding curve jak pump.fun czy four.meme, więc Final Stretch i Migrated są tu niedostępne. New Pairs, Good i Hot działają.';
    }
    if (ch === 'bsc') {
      return 'BSC: Final Stretch = four.meme · Migrated = PancakeSwap.';
    }
    if (ch === 'all') {
      return 'Wszystkie sieci: Solana + BSC + Robinhood Chain.';
    }
    return 'Solana: Final Stretch = pump.fun · Migrated = PumpSwap / Raydium / Meteora.';
  }

  /* ---- Filters ---- */
  const FILTER_TABS = ['pulse', 'hot', 'good', 'new', 'stretch', 'migrated', 'boosted'];
  const DEFAULT_FILTERS = {
    hot: { mcapMin: '', mcapMax: '', liqMin: '', volMin: '', ageMaxH: '', ageMinH: '', chg5mMin: '', chg1hMin: '', buyRatioMin: '', hasSocials: false, chain: 'solana' },
    good: { mcapMin: '', mcapMax: '', liqMin: '25000', volMin: '', ageMaxH: '', ageMinH: '0.25', chg5mMin: '', chg1hMin: '0', buyRatioMin: '0.55', hasSocials: false, chain: 'solana', v: 84 }, // v8.3 = 3-gate defaults
    new: { mcapMin: '10000', mcapMax: '', liqMin: '', volMin: '', ageMaxH: '48', ageMinH: '', chg5mMin: '', chg1hMin: '', buyRatioMin: '', hasSocials: false, chain: 'solana' },
    stretch: { mcapMin: '25000', mcapMax: '', liqMin: '', volMin: '', ageMaxH: '168', ageMinH: '', chg5mMin: '', chg1hMin: '', buyRatioMin: '', hasSocials: false, chain: 'solana' },
    migrated: { mcapMin: '10000', mcapMax: '', liqMin: '5000', volMin: '', ageMaxH: '168', ageMinH: '', chg5mMin: '', chg1hMin: '', buyRatioMin: '', hasSocials: false, chain: 'solana' },
    boosted: { mcapMin: '', mcapMax: '', liqMin: '', volMin: '', ageMaxH: '', ageMinH: '', chg5mMin: '', chg1hMin: '', buyRatioMin: '', hasSocials: false, chain: 'solana' },
    pulse: { mcapMin: '10000', mcapMax: '', liqMin: '', volMin: '', ageMaxH: '48', ageMinH: '', chg5mMin: '', chg1hMin: '', buyRatioMin: '', hasSocials: false, chain: 'solana' },
  };

  let filters = JSON.parse(JSON.stringify(DEFAULT_FILTERS));
  function loadFilters() {
    try {
      const raw = localStorage.getItem(FILT_KEY) || localStorage.getItem('kyvo_filters_v5');
      if (!raw) return;
      const o = JSON.parse(raw);
      for (const k of FILTER_TABS) {
        if (o[k]) filters[k] = Object.assign({}, DEFAULT_FILTERS[k], o[k]);
        if (k === 'good' && (!o.good || o.good.v !== 84)) filters.good = Object.assign({}, DEFAULT_FILTERS.good); // v8.3: reset old Good Coins defaults once
      }
    } catch (e) {}
  }
  function saveFilters() {
    try {
      localStorage.setItem(FILT_KEY, JSON.stringify(filters));
    } catch (e) {}
  }

  function applyFilters(list, tab) {
    const f = filters[tab] || DEFAULT_FILTERS.hot;
    const mcapMin = parseNum(f.mcapMin);
    const mcapMax = parseNum(f.mcapMax);
    const liqMin = parseNum(f.liqMin);
    const volMin = parseNum(f.volMin);
    const ageMaxH = parseNum(f.ageMaxH);
    const ageMinH = parseNum(f.ageMinH);
    const chg5mMin = parseNum(f.chg5mMin);
    const chg1hMin = parseNum(f.chg1hMin);
    const buyRatioMin = parseNum(f.buyRatioMin);
    const chain = activeChain;

    return list.filter((c) => {
      if (chain && chain !== 'all' && (c.chainId || 'solana') !== chain) return false;
      const mc = c.mcap;
      if (mcapMin != null && (mc == null || mc < mcapMin)) return false;
      if (mcapMax != null && (mc == null || mc > mcapMax)) return false;
      if (liqMin != null && (c.liquidity || 0) < liqMin) return false;
      if (volMin != null && (c.volume.h24 || 0) < volMin) return false;
      const ah = ageHours(c.pairCreatedAt);
      if (ageMaxH != null && (ah == null || ah > ageMaxH)) return false;
      if (ageMinH != null && (ah == null || ah < ageMinH)) return false;
      if (chg5mMin != null && (c.change.m5 == null || c.change.m5 < chg5mMin)) return false;
      if (chg1hMin != null && (c.change.h1 == null || c.change.h1 < chg1hMin)) return false;
      if (buyRatioMin != null && (c.buyRatioH1 == null || c.buyRatioH1 < buyRatioMin)) return false;
      if (f.hasSocials && !c.hasSocials) return false;
      return true;
    });
  }

  function filtSummary(tab) {
    // v8.4: never print Kyvo's filter thresholds; only say whether the user's own filters are on
    const f = filters[tab] || {}, d = (DEFAULT_FILTERS && DEFAULT_FILTERS[tab]) || {};
    const keys = ['mcapMin', 'mcapMax', 'liqMin', 'volMin', 'ageMaxH', 'ageMinH', 'hasSocials', 'buyRatioMin'];
    const custom = keys.some((k) => String(f[k] == null ? '' : f[k]) !== String(d[k] == null ? '' : d[k]));
    return (CHAIN_LABEL[activeChain] || activeChain) + ' · ' + (custom ? 'Twoje filtry' : 'filtry Kyvo');
  }

  /* ---- State ---- */
  let coins = [];
  let newPoolCoins = [];
  let byKey = {};
  let viral = null;
  let view = 'pulse';
  let mobilePulseTab = 'new';
  let selectedKey = null;
  let lastFetch = 0;
  let fetchErr = null;
  let sourceLabel = '';
  let filtOpen = false;
  let smartMoney = null; // data/smart_money.json
  let leaderboard = null; // data/leaderboard.json
  let goodSortSmart = false;


  function saveCache() {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), coins, newPoolCoins, sourceLabel }));
    } catch (e) {}
  }
  function loadCache() {
    try {
      const o = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (!o || !Array.isArray(o.coins) || !o.coins.length) return false;
      coins = o.coins;
      newPoolCoins = o.newPoolCoins || [];
      indexAll();
      sourceLabel = 'z pamięci, odświeżam…';
      lastFetch = o.t || 0;
      return true;
    } catch (e) {
      return false;
    }
  }
  function indexAll() {
    byKey = {};
    for (const c of coins.concat(newPoolCoins)) byKey[keyOf(c)] = c;
  }

  /* ---- v8.3 real token logos ----
     Order: 1) DexScreener info.imageUrl (pairs/tokens API) or token-profile icon
            2) GeckoTerminal token image_url (new_pools?include=base_token, then tokens/multi batch for the rest)
            3) Pump.fun image CDN (Solana mints from pump.fun, tried in <img> onerror chain)
            4) monogram placeholder (symbol initials, colour from address) — never a fake logo.
     Resolved URLs are cached in memory + localStorage (kyvo_img_v1, max 1500, 3 days). */
  const IMG_KEY = 'kyvo_img_v2'; // v8.4: v1 could hold pump.fun placeholder (Pepe) URLs → dropped
  try { localStorage.removeItem('kyvo_img_v1'); } catch (e) {}
  let imgCache = {};
  try { imgCache = JSON.parse(localStorage.getItem(IMG_KEY) || '{}') || {}; } catch (e) { imgCache = {}; }
  let imgDirty = false;
  const imgMiss = {}; // key -> ts of a GT lookup that returned no image (retry after 30 min)
  function goodImg(u) { return typeof u === 'string' && /^https:\/\//.test(u) && !/missing(_|\.)|placeholder/i.test(u) ? u : null; }
  function rememberImg(chain, addr, url) {
    const u = goodImg(url);
    if (!u || !addr) return;
    const k = coinKey(chain || 'solana', addr);
    if (imgCache[k] && imgCache[k].u === u) return;
    imgCache[k] = { u, t: Date.now() };
    imgDirty = true;
  }
  function flushImg() {
    if (!imgDirty) return;
    imgDirty = false;
    const cut = Date.now() - 3 * 86400000;
    const ent = Object.entries(imgCache).filter(([, v]) => v && v.t > cut).sort((a, b) => b[1].t - a[1].t).slice(0, 1500);
    imgCache = Object.fromEntries(ent);
    try { localStorage.setItem(IMG_KEY, JSON.stringify(imgCache)); } catch (e) {}
  }
  setInterval(flushImg, 4000);
  function cachedImg(chain, addr) { const v = imgCache[coinKey(chain || 'solana', addr)]; return v ? v.u : null; }
  function pumpImg(chain, addr, dexId) {
    if ((chain || 'solana') !== 'solana' || !addr) return null;
    if (!/pump$/i.test(addr) && dexId !== 'pumpfun' && dexId !== 'pumpswap') return null;
    return 'https://images.pump.fun/coin-image/' + encodeURIComponent(addr) + '?variant=86x86';
  }
  const MONO_COL = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#ef4444', '#84cc16', '#6366f1', '#f97316'];
  function monogram(sym, addr) {
    const t = String(sym || '?').replace(/[^\p{L}\p{N}]/gu, '').slice(0, 2).toUpperCase() || '?';
    let h = 0; for (const ch of String(addr || sym || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const col = MONO_COL[h % MONO_COL.length];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="32" fill="${col}"/><text x="32" y="41" font-family="Arial,Helvetica,sans-serif" font-size="${t.length > 1 ? 24 : 30}" font-weight="700" text-anchor="middle" fill="#fff">${t.replace(/[<&>"]/g, '')}</text></svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }
  /** Ordered candidate list for a coin-ish object ({chainId|chain, address, image, symbol, dexId}). */
  function imgCandidates(c) {
    const chain = c.chainId || c.chain || 'solana';
    const out = [];
    const push = (u) => { u = goodImg(u); if (u && !out.includes(u)) out.push(u); };
    push(c.image);
    push(cachedImg(chain, c.address));
    push(pumpImg(chain, c.address, c.dexId || c.dex));
    return { list: out, mono: monogram(c.symbol, c.address) };
  }
  window.__kyvoImgErr = function (el) {
    const fb = (el.getAttribute('data-fb') || '').split('|').filter(Boolean);
    const next = fb.shift();
    el.setAttribute('data-fb', fb.join('|'));
    if (next) { el.src = next; return; }
    el.onerror = null;
    el.src = el.getAttribute('data-mono') || FALLBACK_IMG;
    el.classList.add('mono');
  };
  /* v8.4: images.pump.fun answers unknown mints with a 302 to a generic placeholder (Pepe) — that is NOT the coin's
     logo. Verify once per URL with a no-redirect HEAD (CDN sends CORS *); a redirect = placeholder → next candidate. */
  const pumpOk = {}; // url -> true | false | Promise
  function checkPump(u) {
    if (pumpOk[u] !== undefined) return Promise.resolve(pumpOk[u]);
    return (pumpOk[u] = fetch(u, { method: 'HEAD', redirect: 'manual', mode: 'cors', cache: 'force-cache' })
      .then((r) => r.type !== 'opaqueredirect' && r.status === 200).catch(() => null)
      .then((v) => { if (v === null) { delete pumpOk[u]; return true; } pumpOk[u] = v; return v; }));
  }
  window.__kyvoImgOk = function (el) {
    const k = el.getAttribute('data-ik');
    const src = el.currentSrc || el.src;
    if (/images\.pump\.fun\/coin-image\//.test(src) && pumpOk[src] !== true) {
      checkPump(src).then((ok) => {
        if (!ok) { if ((el.currentSrc || el.src) === src) window.__kyvoImgErr(el); return; }
        if (k) { const [ch, ...rest] = k.split(':'); rememberImg(ch, rest.join(':'), src); }
      });
      return;
    }
    if (k && !/^data:/.test(src) && !el.classList.contains('mono')) {
      const [ch, ...rest] = k.split(':');
      rememberImg(ch, rest.join(':'), el.currentSrc || el.src);
    }
  };
  /* GeckoTerminal tokens/multi batch for coins still without a logo (one call per network, ≤30 addresses) */
  let imgFillBusy = false;
  async function fillMissingImages(list) {
    if (imgFillBusy) return;
    imgFillBusy = true;
    try {
      const byNet = {};
      for (const c of list) {
        if (!c || !c.address) continue;
        const ch = c.chainId || 'solana', k = coinKey(ch, c.address);
        if (goodImg(c.image) || cachedImg(ch, c.address) || (imgMiss[k] && Date.now() - imgMiss[k] < 30 * 60e3)) continue;
        // v8.4: pump CDN is only a last resort (placeholder for unknown mints) → still ask GeckoTerminal
        (byNet[ch] = byNet[ch] || []).push(c.address);
      }
      let changed = false;
      for (const [net, addrs] of Object.entries(byNet)) {
        const chunk = [...new Set(addrs)].slice(0, 30);
        if (!GECKO_NET[net] || !chunk.length) continue;
        try {
          const g = await fetchJson(GT + '/networks/' + GECKO_NET[net] + '/tokens/multi/' + chunk.join(','));
          const got = {};
          for (const t of (g && g.data) || []) {
            const a = t.attributes || {};
            if (a.address && goodImg(a.image_url)) got[String(a.address).toLowerCase()] = a.image_url;
          }
          for (const addr of chunk) {
            const u = got[String(addr).toLowerCase()];
            if (u) { rememberImg(net, addr, u); changed = true; } else imgMiss[coinKey(net, addr)] = Date.now();
          }
        } catch (e) { for (const addr of chunk) imgMiss[coinKey(net, addr)] = Date.now(); }
      }
      if (changed) {
        for (const c of allUniverse()) if (!goodImg(c.image)) { const u = cachedImg(c.chainId, c.address); if (u) c.image = u; }
        document.querySelectorAll('img[data-ik].mono, img[data-ik][data-noimg]').forEach((el) => {
          const [ch, ...rest] = el.getAttribute('data-ik').split(':');
          const u = cachedImg(ch, rest.join(':'));
          if (u) { el.classList.remove('mono'); el.removeAttribute('data-noimg'); el.onerror = () => window.__kyvoImgErr(el); el.src = u; }
        });
      }
    } finally { imgFillBusy = false; }
  }

  function pairToCoin(p, meta) {
    if (!p || !p.baseToken) return null;
    const bt = p.baseToken;
    const liq = (p.liquidity && p.liquidity.usd) || 0;
    const vol = p.volume || {};
    const ch = p.priceChange || {};
    const info = p.info || {};
    const tx = p.txns || {};
    const h1 = tx.h1 || {};
    const buys = h1.buys != null ? Number(h1.buys) : null;
    const sells = h1.sells != null ? Number(h1.sells) : null;
    let buyRatioH1 = null;
    if (buys != null && sells != null && buys + sells > 0) buyRatioH1 = buys / (buys + sells);
    const socials = info.socials || (meta && meta.links) || [];
    const websites = info.websites || [];
    const mcap = p.marketCap != null ? Number(p.marketCap) : p.fdv != null ? Number(p.fdv) : null;
    const dexId = p.dexId || '';
    const chainId = p.chainId || 'solana';
    let curveEst = null;
    const grad = CURVE_DEX[dexId];
    if (grad && mcap != null) {
      curveEst = Math.min(99.9, Math.max(0, (mcap / grad) * 100));
    }
    const migSet = MIG_DEX_BY_CHAIN[chainId] || ALL_MIG;
    return {
      address: bt.address,
      name: bt.name || bt.symbol || 'Unknown',
      symbol: bt.symbol || '???',
      chainId,
      priceUsd: p.priceUsd != null ? Number(p.priceUsd) : null,
      mcap,
      fdv: p.fdv != null ? Number(p.fdv) : null,
      liquidity: liq,
      volume: {
        m5: vol.m5 != null ? Number(vol.m5) : null,
        h1: vol.h1 != null ? Number(vol.h1) : null,
        h6: vol.h6 != null ? Number(vol.h6) : null,
        h24: vol.h24 != null ? Number(vol.h24) : null,
      },
      change: {
        m5: ch.m5 != null ? Number(ch.m5) : null,
        h1: ch.h1 != null ? Number(ch.h1) : null,
        h6: ch.h6 != null ? Number(ch.h6) : null,
        h24: ch.h24 != null ? Number(ch.h24) : null,
      },
      pairCreatedAt: p.pairCreatedAt || null,
      dexId,
      url: p.url || '',
      image: goodImg(info.imageUrl) || goodImg(meta && meta.icon) || cachedImg(chainId, bt.address) || null,
      socials,
      websites,
      description: (meta && meta.description) || '',
      boost: (meta && (meta.totalAmount || meta.amount)) || 0,
      pairAddress: p.pairAddress || '',
      buysH1: buys,
      sellsH1: sells,
      buysM5: tx.m5 && tx.m5.buys != null ? Number(tx.m5.buys) : null,
      sellsM5: tx.m5 && tx.m5.sells != null ? Number(tx.m5.sells) : null,
      buyRatioH1,
      hasSocials: !!(socials && socials.length) || !!(websites && websites.length),
      curveEst,
      onCurve: !!CURVE_DEX[dexId],
      migrated: migSet.has(dexId),
      gradMcap: grad || null,
    };
  }

  async function fetchJson(url) {
    if (window.KyvoGT && url.indexOf(GT) === 0) return window.KyvoGT.fetch(url, 120000); // shared GT rate gate (2 min cache)
    const r = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }

  function allowedChain(cid) {
    return cid === 'solana' || cid === 'bsc' || cid === 'robinhood';
  }

  function pickBestPairs(pairs) {
    const best = {};
    for (const p of pairs || []) {
      if (!p || !allowedChain(p.chainId) || !p.baseToken) continue;
      if (activeChain !== 'all' && p.chainId !== activeChain) continue;
      const k = coinKey(p.chainId, p.baseToken.address);
      const liq = (p.liquidity && p.liquidity.usd) || 0;
      if (!best[k] || liq > ((best[k].liquidity && best[k].liquidity.usd) || 0)) best[k] = p;
    }
    return best;
  }

  function ingestPairs(pairs, metaByAddr, intoMap) {
    for (const p of pairs || []) {
      if (!p || !allowedChain(p.chainId) || !p.baseToken) continue;
      const meta = metaByAddr && (metaByAddr[p.baseToken.address] || metaByAddr[coinKey(p.chainId, p.baseToken.address)]);
      const c = pairToCoin(p, meta);
      if (!c) continue;
      if (p.info && p.info.imageUrl) rememberImg(c.chainId, c.address, p.info.imageUrl);
      const k = keyOf(c);
      const prev = intoMap[k];
      if (!prev) {
        intoMap[k] = c;
        continue;
      }
      if (c.onCurve && !prev.onCurve) intoMap[k] = c;
      else if (c.onCurve === prev.onCurve && (c.liquidity || 0) > (prev.liquidity || 0)) intoMap[k] = c;
      else if (!c.onCurve && !prev.onCurve && (c.liquidity || 0) > (prev.liquidity || 0)) intoMap[k] = c;
      if ((c.boost || 0) > (prev.boost || 0)) intoMap[k].boost = c.boost;
      if (!intoMap[k].image && c.image) intoMap[k].image = c.image;
    }
  }

  async function fetchTokenBatch(addrs, metaByAddr, intoMap) {
    const unique = [...new Set(addrs.filter(Boolean))];
    for (let i = 0; i < unique.length; i += 30) {
      const chunk = unique.slice(i, i + 30);
      try {
        const tok = await fetchJson(DS + '/latest/dex/tokens/' + chunk.join(','));
        ingestPairs(tok.pairs || [], metaByAddr, intoMap);
      } catch (e) {
        console.warn('token batch failed', e);
      }
    }
  }

  async function loadNewPoolsNetwork(net, intoMap) {
    const addrs = [];
    // page=1 only: some Gecko networks (e.g. robinhood) 400/fail on page>1 and spam console
    const pages = [1]; // one page per network keeps GeckoTerminal calls well under the public limit (chart shares it)
    for (const page of pages) {
      try {
        const g = await fetchJson(GT + '/networks/' + net + '/new_pools?page=' + page + '&include=base_token');
        for (const inc of g.included || []) {
          const a = inc && inc.attributes;
          if (a && a.address && a.image_url) rememberImg(net, a.address, a.image_url);
        }
        for (const row of g.data || []) {
          const id =
            row.relationships &&
            row.relationships.base_token &&
            row.relationships.base_token.data &&
            row.relationships.base_token.data.id;
          if (id) addrs.push(String(id).replace(new RegExp('^' + net + '_'), ''));
        }
      } catch (e) {
        /* network may not support pagination — skip quietly */
      }
    }
    await fetchTokenBatch(addrs, null, intoMap);
  }

  async function loadLiveCoins() {
    fetchErr = null;
    try {
      const [profiles, boosts, boostsLatest] = await Promise.all([
        fetchJson(DS + '/token-profiles/latest/v1'),
        fetchJson(DS + '/token-boosts/top/v1'),
        fetchJson(DS + '/token-boosts/latest/v1').catch(() => []),
      ]);
      const metaByAddr = {};
      const addrs = [];
      for (const x of [].concat(boosts || [], boostsLatest || [], profiles || [])) {
        if (!x || !allowedChain(x.chainId) || !x.tokenAddress) continue;
        const a = x.tokenAddress;
        if (!metaByAddr[a]) {
          metaByAddr[a] = x;
          addrs.push(a);
        } else metaByAddr[a] = Object.assign({}, metaByAddr[a], x);
      }

      const into = {};
      await fetchTokenBatch(addrs.slice(0, 90), metaByAddr, into);

      // Bonding / migrated searches per chain
      const searches = [
        'pumpfun', 'pump', 'bonk', 'trump', 'pepe', 'solana meme',
        'fourmeme', 'four.meme', 'bsc meme', 'pancakeswap',
        'robinhood', 'flap',
      ];
      for (const q of searches) {
        try {
          const d = await fetchJson(DS + '/latest/dex/search?q=' + encodeURIComponent(q));
          const wanted = (d.pairs || []).filter(
            (p) =>
              allowedChain(p.chainId) &&
              (CURVE_DEX[p.dexId] || ALL_MIG.has(p.dexId) || p.chainId === 'robinhood')
          );
          ingestPairs(wanted, metaByAddr, into);
        } catch (e) {}
      }

      const newMap = {};
      await Promise.all([
        loadNewPoolsNetwork('solana', newMap),
        loadNewPoolsNetwork('bsc', newMap),
        loadNewPoolsNetwork('robinhood', newMap),
      ]);
      for (const [k, c] of Object.entries(newMap)) {
        if (!into[k]) into[k] = c;
      }

      for (const c of Object.values(into)) if (!c.image) c.image = cachedImg(c.chainId, c.address);
      coins = Object.values(into);
      coins.sort((a, b) => (b.volume.h24 || 0) - (a.volume.h24 || 0));
      newPoolCoins = Object.values(newMap);
      newPoolCoins.sort((a, b) => (b.pairCreatedAt || 0) - (a.pairCreatedAt || 0));
      indexAll();
      lastFetch = Date.now();
      sourceLabel = 'na żywo';
      saveCache();
      return true;
    } catch (e1) {
      console.warn('primary load failed', e1);
      fetchErr = 'Nie udało się pobrać danych na żywo (sprawdź internet albo spróbuj za chwilę).';
      if (!coins.length && loadCache()) {
        fetchErr = 'Brak połączenia — pokazuję ostatnie zapisane dane.';
        return true;
      }
      return false;
    }
  }

  function typoVariants(q) {
    const out = new Set();
    const s = q.trim();
    if (!s) return [];
    out.add(s);
    if (s.length >= 4) out.add(s.slice(0, -1));
    out.add(s.replace(/(.)\1+/g, '$1'));
    if (s.length >= 3) out.add(s.slice(0, -2) + s.slice(-1) + s.slice(-2, -1));
    for (const t of ['BONK', 'WIF', 'PEPE', 'POPCAT', 'PNUT', 'MOODENG', 'TRUMP', 'DOGE', 'SPX', 'FARTCOIN', 'FLOKI', 'CAKE']) {
      if (fuzzyScore(s, t, t, '') >= 60) out.add(t);
    }
    return [...out];
  }

  async function searchDex(q) {
    const query = q.trim();
    if (!query) return [];
    const variants = typoVariants(query);
    try {
      const seen = new Set();
      let list = [];
      for (const v of variants.slice(0, 4)) {
        const d = await fetchJson(DS + '/latest/dex/search?q=' + encodeURIComponent(v));
        const best = pickBestPairs(d.pairs || []);
        for (const p of Object.values(best)) {
          const c = pairToCoin(p, null);
          if (!c || seen.has(keyOf(c))) continue;
          seen.add(keyOf(c));
          list.push(c);
        }
        if (list.length >= 12) break;
      }
      list = list
        .map((c) => ({
          c,
          s: Math.max(fuzzyScore(query, c.name, c.symbol, c.address), ...variants.map((v) => fuzzyScore(v, c.name, c.symbol, c.address))),
        }))
        .filter((x) => x.s > 0 || norm(query).length >= 32)
        .sort((a, b) => b.s - a.s || (b.c.liquidity || 0) - (a.c.liquidity || 0))
        .map((x) => x.c);
      if (!list.length) {
        list = allUniverse()
          .filter((c) => activeChain === 'all' || c.chainId === activeChain)
          .map((c) => ({ c, s: fuzzyScore(query, c.name, c.symbol, c.address) }))
          .filter((x) => x.s >= 50)
          .sort((a, b) => b.s - a.s)
          .map((x) => x.c);
      }
      return list.slice(0, 40);
    } catch (e) {
      return allUniverse()
        .filter((c) => activeChain === 'all' || c.chainId === activeChain)
        .map((c) => ({ c, s: fuzzyScore(query, c.name, c.symbol, c.address) }))
        .filter((x) => x.s >= 50)
        .sort((a, b) => b.s - a.s)
        .map((x) => x.c);
    }
  }

  function allUniverse() {
    const m = {};
    for (const c of coins.concat(newPoolCoins)) m[keyOf(c)] = c;
    return Object.values(m);
  }

  async function loadViral() {
    try {
      viral = await fetchJson('data/x_viral.json?v=8.3');
      if (window.KyvoNotify) window.KyvoNotify.onViral(viral);
      return viral;
    } catch (e) {
      viral = { posts: [], topics: [], updated_at: null };
      return viral;
    }
  }

  async function matchTopicToCoins(topic) {
    const hints = topic.hints || [];
    let found = await searchDex(topic.query || topic.label || '');
    for (const h of hints.slice(0, 2)) {
      if (found.length >= 6) break;
      const more = await searchDex(h);
      const seen = new Set(found.map((c) => keyOf(c)));
      for (const c of more) if (!seen.has(keyOf(c))) found.push(c);
    }
    return found
      .map((c) => ({
        c,
        s: Math.max(
          fuzzyScore(topic.label, c.name, c.symbol, c.address),
          ...hints.map((h) => fuzzyScore(h, c.name, c.symbol, c.address))
        ),
      }))
      .filter((x) => x.s >= 50 || found.length <= 3)
      .sort((a, b) => b.s - a.s || (b.c.liquidity || 0) - (a.c.liquidity || 0))
      .slice(0, 5);
  }

  /* ---- Column builders ---- */
  /* v8.3 quality pass: Pulse lists hide ⛔ high-risk (Kyvo Check < 50 / red flags / liq < $5k) and dead pairs
     (> 30 min old, < $500 vol 1h and < 10 txns). Toggle "Pokaż wszystkie" (localStorage kyvo_quality). */
  let qualityOnly = localStorage.getItem('kyvo_quality') !== '0';
  const qHidden = {};
  function qualityFilter(list, tab) {
    if (!qualityOnly || !window.KyvoInsights) { qHidden[tab] = 0; return list; }
    const out = []; let h = 0;
    for (const c of list) {
      let bad = false;
      try { bad = !!window.KyvoInsights.analyze(c).gated; } catch (e) {}
      const ah = ageHours(c.pairCreatedAt), tx = (c.buysH1 || 0) + (c.sellsH1 || 0);
      if (!bad && ah != null && ah > 0.5 && ((c.volume && c.volume.h1) || 0) < 500 && tx < 10) bad = true;
      if (bad) h++; else out.push(c);
    }
    qHidden[tab] = h;
    return out;
  }
  function qualityNote(tab) {
    const en = window.KyvoI18n && window.KyvoI18n.isEn();
    if (!qualityOnly) return `<div class="qhide mut" translate="no">${en ? 'Showing all coins, including ⛔ high-risk and dead pairs.' : 'Pokazuję wszystkie coiny, także ⛔ ryzykowne i martwe.'} <button type="button" class="fbtn" data-qtoggle>${en ? 'Quality only' : 'Tylko jakościowe'}</button></div>`;
    if (!qHidden[tab]) return '';
    return `<div class="qhide mut" translate="no">✨ ${en ? `Hidden ${qHidden[tab]} risky/dead coins (⛔ Kyvo Check, red flags or no trading).` : `Ukryto ${qHidden[tab]} ryzykownych/martwych coinów (⛔ Kyvo Check, czerwone flagi albo brak handlu).`} <button type="button" class="fbtn" data-qtoggle>${en ? 'Show all' : 'Pokaż wszystkie'}</button></div>`;
  }
  document.addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('[data-qtoggle]'); if (!b) return; qualityOnly = !qualityOnly; localStorage.setItem('kyvo_quality', qualityOnly ? '1' : '0'); setView(view); });
  function listNew(baseFiltTab) {
    const tab = baseFiltTab || 'new';
    let list = applyFilters(allUniverse().slice(), tab);
    list.sort((a, b) => (b.pairCreatedAt || 0) - (a.pairCreatedAt || 0));
    return qualityFilter(list, 'new');
  }
  function listStretch(baseFiltTab) {
    if (!chainSupportsStretch(activeChain)) return [];
    const tab = baseFiltTab || 'stretch';
    let list = allUniverse().filter((c) => {
      if (!c.onCurve || c.mcap == null) return false;
      if (activeChain === 'solana') return c.dexId === 'pumpfun';
      if (activeChain === 'bsc') return c.dexId === 'fourmeme';
      return c.onCurve; // all
    });
    list = applyFilters(list, tab);
    let tight = list.filter((c) => c.curveEst != null && c.curveEst >= 55);
    if (tight.length < 3) {
      tight = list.slice().sort((a, b) => (b.curveEst || 0) - (a.curveEst || 0)).filter((c) => (c.curveEst || 0) >= 50);
    }
    tight.sort((a, b) => (b.curveEst || 0) - (a.curveEst || 0) || (b.mcap || 0) - (a.mcap || 0));
    return qualityFilter(tight, 'stretch');
  }
  function listMigrated(baseFiltTab) {
    if (!chainSupportsMigrated(activeChain)) return [];
    const tab = baseFiltTab || 'migrated';
    let list = allUniverse().filter((c) => {
      if (!c.migrated) return false;
      if (activeChain === 'solana') return (MIG_DEX_BY_CHAIN.solana || ALL_MIG).has(c.dexId);
      if (activeChain === 'bsc') return c.dexId === 'pancakeswap';
      return c.migrated;
    });
    list = applyFilters(list, tab);
    list.sort((a, b) => (b.pairCreatedAt || 0) - (a.pairCreatedAt || 0));
    return qualityFilter(list, 'migrated');
  }
  let goodPending = 0;
  function goodContractsDone() { if ((view === 'good' || view === 'runner') && !document.hidden) keepUi(() => setView(view)); }
  function listGood() {
    // v8.3: safety filters (DEFAULT_FILTERS.good) + positive outlook (KyvoInsights.goodOutlook): Kyvo Check ≥ 75, no ⛔,
    // popular right now (P ≥ 0.30) + base estimate > 0 for 1h/3h/8h, buys > sells (1h), healthy volume, not "po ruchu"/fading,
    // Δ1h > −15%. Sorted by rank = popularity P × upside signal G (goodCoinRule in insights.js).
    let list = applyFilters(allUniverse(), 'good');
    if (window.KyvoInsights && window.KyvoInsights.goodOutlook) {
      const all = list.map((c) => ({ c, o: window.KyvoInsights.goodOutlook(c, goodContractsDone) }));
      goodPending = all.filter((x) => x.o.pending).length;
      list = all.filter((x) => x.o.ok);
      if (goodSortSmart) {
        list.sort((x, y) => {
          const ca = consensusOf(x.c), cb = consensusOf(y.c);
          return (cb.buyers.length * 2 - cb.sellers.length) - (ca.buyers.length * 2 - ca.sellers.length) || y.o.a.G - x.o.a.G;
        });
      } else list.sort((x, y) => y.o.rank - x.o.rank);
      return list.map((x) => x.c);
    }
    list.sort((a, b) => (b.liquidity || 0) - (a.liquidity || 0));
    return list;
  }
  let boostRankMap = null, boostRankAt = 0;
  function boostRank(c) {
    if (!boostRankMap || Date.now() - boostRankAt > 20000) {
      boostRankMap = {};
      coins.filter((x) => x.boost > 0).sort((a, b) => b.boost - a.boost).forEach((x, i) => { boostRankMap[keyOf(x)] = i + 1; });
      boostRankAt = Date.now();
    }
    return boostRankMap[keyOf(c)] || null;
  }
  /* ---- v8.3 Runner stages by market cap (bounds from tools/runner_research.py: the 5x+ share falls with MC at the
     first-hour mark: <$60k 75% · $60–150k 45% · $150–500k 14% · $500k–1M 7% · $1M+ 29% (n=88, survivorship-biased)) ---- */
  const STAGES = [
    { n: 1, max: 60e3, pl: 'bardzo wcześnie', en: 'very early', range: '~$30–60k' },
    { n: 2, max: 150e3, pl: 'wcześnie', en: 'early', range: '$60–150k' },
    { n: 3, max: 500e3, pl: 'rozpędza się', en: 'building', range: '$150–500k' },
    { n: 4, max: 1e6, pl: 'dojrzały ruch', en: 'mature move', range: '$500k–1M' },
    { n: 5, max: Infinity, pl: 'duży, późniejszy', en: 'large, later', range: '$1M+' },
  ];
  function stageOf(mc) { if (mc == null || !isFinite(mc)) return null; return STAGES.find((s) => mc < s.max) || STAGES[4]; }
  function stageBarHtml(st) {
    if (!st) return '';
    return `<span class="stbar" aria-label="Etap ${st.n}/5">${STAGES.map((s) => `<i class="${s.n <= st.n ? 'on' : ''}"></i>`).join('')}</span>`;
  }
  window.__kyvoStageOf = stageOf;

  /* ---- v8.3 Wyniki / Track record: every coin Kyvo flags (Good Coin or Runner) is logged at the FIRST flag with time,
     price and MC; performance since flag = now %, max %, 1 h %, 8 h %. Local log (localStorage kyvo_track_v1, max 300,
     sampled on every refresh; exact 1 h / 8 h / max back-filled from GeckoTerminal 15-min candles when Wyniki opens) +
     the server log data/track_record.json written by the GitHub Action (tools/track_record.py). ---- */
  const TR_KEY = 'kyvo_track_v1';
  let track = (() => { try { const o = JSON.parse(localStorage.getItem(TR_KEY) || 'null'); return o && o.items ? o : { items: {} }; } catch (e) { return { items: {} }; } })();
  let trackDirty = false, trackDsAt = 0, trackServer = null, trackServerAt = 0;
  function saveTrack() {
    if (!trackDirty) return;
    const it = track.items, ks = Object.keys(it);
    if (ks.length > 300) ks.sort((a, b) => it[a].at - it[b].at).slice(0, ks.length - 300).forEach((k) => delete it[k]);
    try { localStorage.setItem(TR_KEY, JSON.stringify(track)); trackDirty = false; } catch (e) {}
  }
  function trackFlag(c, kind) {
    if (!c || !c.priceUsd || !c.mcap) return;
    const k = keyOf(c), now = Date.now();
    let e = track.items[k];
    if (!e) {
      e = track.items[k] = { k, sym: c.symbol, name: c.name, chain: c.chainId || 'solana', addr: c.address, pair: c.pairAddress || '', img: c.image || null,
        kinds: {}, at: now, px0: c.priceUsd, mc0: c.mcap, max: c.priceUsd, maxAt: now, last: c.priceUsd, mcNow: c.mcap, lastAt: now };
      const st = stageOf(c.mcap); if (kind === 'runner' && st) e.stage0 = st.n;
    }
    if (!e.kinds[kind]) { e.kinds[kind] = now; trackDirty = true; }
  }
  function trackSample(e, px, mc) {
    if (!e || !px || !isFinite(px)) return;
    const now = Date.now();
    e.last = px; e.lastAt = now; if (mc) e.mcNow = mc;
    if (px > e.max) { e.max = px; e.maxAt = now; }
    for (const [h, f] of [[1, 'p1'], [8, 'p8']]) {
      const t = e.at + h * 3.6e6;
      // live sample counts for the 1 h / 8 h mark only if taken within 15 / 60 min after it; otherwise candles fill it
      if (e[f] == null && now >= t && now - t <= (h === 1 ? 15 : 60) * 60e3) e[f] = px;
    }
    trackDirty = true;
  }
  async function trackUpdate() {
    try {
      for (const c of listGood()) trackFlag(c, 'good');
      if (window.KyvoInsights) for (const x of window.KyvoInsights.runnerList().coins) trackFlag(x.c, x.leg2 ? 'leg2' : 'runner');
      const stale = [];
      for (const e of Object.values(track.items)) {
        if (Date.now() - e.at > 7 * 864e5) continue;
        const c = byKey[e.k];
        if (c && c.priceUsd) trackSample(e, c.priceUsd, c.mcap); else if (Date.now() - e.at < 72 * 3.6e6) stale.push(e);
      }
      // coins that left the lists: DexScreener tokens batch, at most every 5 min
      if (stale.length && Date.now() - trackDsAt > 300000) {
        trackDsAt = Date.now();
        for (const ch of [...new Set(stale.map((e) => e.chain))]) {
          const grp = stale.filter((e) => e.chain === ch).slice(0, 30);
          try {
            const d = await fetchJson(DS + '/tokens/v1/' + ch + '/' + grp.map((e) => e.addr).join(','));
            const pairs = Array.isArray(d) ? d : (d && d.pairs) || [];
            for (const e of grp) {
              const ps = pairs.filter((p) => p.baseToken && p.baseToken.address && p.baseToken.address.toLowerCase() === e.addr.toLowerCase());
              const p = ps.find((q) => q.pairAddress === e.pair) || ps.sort((a, b) => ((b.liquidity && b.liquidity.usd) || 0) - ((a.liquidity && a.liquidity.usd) || 0))[0];
              if (p && p.priceUsd) trackSample(e, +p.priceUsd, p.marketCap || p.fdv);
            }
          } catch (err) {}
        }
      }
      saveTrack();
    } catch (e) {}
  }
  // exact max / 1 h / 8 h from GeckoTerminal 15-min candles (only when Wyniki is open; shared GT rate gate)
  async function trackBackfill(list, onDone) {
    if (!window.KyvoGT) return;
    const need = list.filter((e) => e.pair && e.src !== 'server' && (!e.ohAt || Date.now() - e.ohAt > 15 * 60e3) && Date.now() - e.at > 20 * 60e3 && Date.now() - e.at < 48 * 3.6e6 && !(e.p8 != null && e.ohFinal)).slice(0, 8);
    for (const e of need) {
      try {
        const net = GECKO_NET[e.chain] || e.chain;
        const d = await window.KyvoGT.fetch(`https://api.geckoterminal.com/api/v2/networks/${net}/pools/${encodeURIComponent(e.pair)}/ohlcv/minute?aggregate=15&limit=200&currency=usd&token=${encodeURIComponent(e.addr)}`, 600000);
        const ol = ((d && d.data && d.data.attributes && d.data.attributes.ohlcv_list) || []).map((r) => r.map(Number)).sort((a, b) => a[0] - b[0]);
        const after = ol.filter((r) => r[0] * 1000 >= e.at - 15 * 60e3 + 1);
        if (!after.length) continue;
        const live = track.items[e.k] || e;
        const mx = Math.max(...after.map((r) => r[2]));
        if (mx > (live.max || 0)) { live.max = mx; live.maxAt = after.find((r) => r[2] === mx)[0] * 1000; }
        for (const [h, f] of [[1, 'p1'], [8, 'p8']]) {
          const t = (e.at + h * 3.6e6) / 1000;
          const cnd = ol.find((r) => r[0] <= t && t < r[0] + 900);
          if (cnd && Date.now() / 1000 > t) live[f] = cnd[4];
        }
        live.ohAt = Date.now(); if (live.p8 != null) live.ohFinal = 1; trackDirty = true;
      } catch (err) {}
    }
    saveTrack();
    if (need.length && onDone) onDone();
  }
  async function loadTrackServer() {
    if (trackServer && Date.now() - trackServerAt < 10 * 60e3) return trackServer;
    try { const r = await fetch('data/track_record.json?t=' + Math.floor(Date.now() / 600000), { cache: 'no-store' }); if (r.ok) { trackServer = await r.json(); trackServerAt = Date.now(); } } catch (e) {}
    return trackServer;
  }
  const pctOf = (a, b) => (a && b ? (a / b - 1) * 100 : null);
  let trackKind = localStorage.getItem('kyvo_track_kind') || 'all';
  async function renderTrack() {
    document.body.classList.remove('pulse-on');
    $('#pulseDesk').innerHTML = '';
    const en = window.KyvoI18n && window.KyvoI18n.isEn();
    const L2 = (pl, e) => (en ? e : pl);
    const srv = await loadTrackServer();
    if (view !== 'track') return;
    const merged = {};
    for (const e of (srv && srv.items) || []) merged[e.k] = Object.assign({ src: 'server' }, e);
    for (const e of Object.values(track.items)) { const s = merged[e.k]; merged[e.k] = s && s.at <= e.at ? Object.assign({}, e, s, { kinds: Object.assign({}, e.kinds, s.kinds), src: 'server' }) : Object.assign({ src: 'local' }, e); }
    let all = Object.values(merged).filter((e) => Date.now() - e.at < 7 * 864e5).sort((a, b) => b.at - a.at);
    const list = trackKind === 'all' ? all : all.filter((e) => e.kinds && e.kinds[trackKind]);
    const nowP = (e) => pctOf(e.last, e.px0), maxP = (e) => pctOf(e.max, e.px0);
    const med = (a) => { a = a.filter((v) => v != null && isFinite(v)).sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : null; };
    const done1 = list.filter((e) => Date.now() - e.at > 3.6e6);
    const hit50 = done1.filter((e) => (maxP(e) || 0) >= 50).length, hit100 = done1.filter((e) => (maxP(e) || 0) >= 100).length;
    const pc = (v) => (v == null || !isFinite(v) ? '<span class="mut">—</span>' : `<b class="${pctClass(v)}">${fmtPct(v)}</b>`);
    const tm = (ms) => new Date(ms).toLocaleString(window.KyvoI18n ? window.KyvoI18n.locale() : 'pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    const row = (e) => {
      const st = stageOf(e.mc0);
      const kinds = Object.keys(e.kinds || {}).map((k) => (k === 'runner' ? '🏃 Runner' : k === 'leg2' ? '🔁 ' + L2('Kolejna fala', 'Second leg') : '✅ Good')).join(' · ');
      const p1 = e.p1 != null ? pctOf(e.p1, e.px0) : null, p8 = e.p8 != null ? pctOf(e.p8, e.px0) : null;
      const pend = (h) => (Date.now() - e.at < h * 3.6e6 ? `<span class="mut">${L2('za', 'in')} ${ageLabelH(h - (Date.now() - e.at) / 3.6e6)}</span>` : '<span class="mut">—</span>');
      return `<div class="row trk" data-key="${esc(e.k)}" role="button" tabindex="0">${imgTag({ image: e.img, chainId: e.chain, address: e.addr, symbol: e.sym, dexId: '' })}
        <div class="nm"><b><span class="cbadge c-${esc(e.chain)}">${esc(CHAIN_BADGE[e.chain] || e.chain)}</span> $${esc(e.sym)} <span class="mut" style="font-weight:600;font-size:11px">${kinds}${e.kinds && (e.kinds.runner || e.kinds.leg2) && st ? ' · ' + L2('etap', 'stage') + ' ' + st.n : ''}</span></b>
          <small>${L2('Oznaczony', 'Flagged')} ${esc(tm(e.at))} · MC ${fmtUsd(e.mc0)} → ${fmtUsd(e.mcNow || (e.mc0 * (e.last || e.px0) / e.px0))}${e.src === 'server' ? ' · <span class="mut">Kyvo</span>' : ''}</small>
          <div class="trk-g" translate="no"><span>${L2('Teraz', 'Now')} ${pc(nowP(e))}</span><span>Max ${pc(maxP(e))}</span><span>1h ${p1 != null ? pc(p1) : pend(1)}</span><span>8h ${p8 != null ? pc(p8) : pend(8)}</span></div></div></div>`;
    };
    $('#listBody').innerHTML = `<div class="h">📊 ${L2('Wyniki', 'Track record')}</div>
      <div class="sub" translate="no">${L2('Każdy coin, który Kyvo oznaczyło (Good Coin lub Runner), zapisany w chwili PIERWSZEGO oznaczenia — z ceną i MC. Pokazujemy wszystkie, także te, które spadły.', 'Every coin Kyvo flagged (Good Coin or Runner), logged at the FIRST flag with price and MC. We show all of them, including the ones that fell.')}</div>
      <div class="filtbar" style="margin:8px 0" id="trkKinds">${[['all', L2('Wszystkie', 'All')], ['good', '✅ Good'], ['runner', '🏃 Runner'], ['leg2', '🔁 ' + L2('Kolejna fala', 'Second leg')]].map(([k, t]) => `<button type="button" class="fbtn ${trackKind === k ? 'on' : ''}" data-tk="${k}">${t}</button>`).join('')}</div>
      <div class="card trk-sum" translate="no">
        <div><b>${list.length}</b><small>${L2('oznaczeń (7 dni)', 'flags (7 days)')}</small></div>
        <div><b>${done1.length ? Math.round(hit50 / done1.length * 100) + '%' : '—'}</b><small>${L2('doszło do +50% (max)', 'reached +50% (max)')}</small></div>
        <div><b>${done1.length ? Math.round(hit100 / done1.length * 100) + '%' : '—'}</b><small>${L2('doszło do 2x (max)', 'reached 2x (max)')}</small></div>
        <div><b class="${pctClass(med(list.map(nowP)))}">${med(list.map(nowP)) != null ? fmtPct(med(list.map(nowP))) : '—'}</b><small>${L2('mediana teraz', 'median now')}</small></div>
        <div><b class="${pctClass(med(list.map((e) => (e.p8 != null ? pctOf(e.p8, e.px0) : null))))}">${med(list.map((e) => (e.p8 != null ? pctOf(e.p8, e.px0) : null))) != null ? fmtPct(med(list.map((e) => (e.p8 != null ? pctOf(e.p8, e.px0) : null)))) : '—'}</b><small>${L2('mediana po 8h', 'median at 8h')}</small></div>
      </div>
      ${list.length ? `<div class="card" style="padding:4px 10px">${list.slice(0, 120).map(row).join('')}</div>` : `<div class="empty" translate="no">${L2('Jeszcze nic nie zapisano. Wyniki zbierają się, gdy Kyvo oznacza coiny (Good Coins / Runner) — na tym urządzeniu oraz w logu serwera.', 'Nothing logged yet. Results build up as Kyvo flags coins (Good Coins / Runner) — on this device and in the server log.')}</div>`}
      <div class="foot" translate="no">${L2('„Max” = najwyższa cena po oznaczeniu (świece 15-min GeckoTerminal lub próbki z apki). Wejście po cenie z chwili oznaczenia, bez poślizgu i opłat. „Kyvo” = log serwera (GitHub Action co ~15 min), reszta = log z tego urządzenia, gdy apka była otwarta. Przeszłe wyniki nie gwarantują przyszłych — to nie porada finansowa, memecoiny mogą spaść do zera.', '“Max” = highest price after the flag (GeckoTerminal 15-min candles or app samples). Entry at the price at flag time, no slippage or fees. “Kyvo” = server log (GitHub Action every ~15 min), the rest = this device’s log while the app was open. Past results don’t guarantee future ones — not financial advice, memecoins can go to zero.')}</div>`;
    $$('#trkKinds [data-tk]').forEach((b) => (b.onclick = () => { trackKind = b.dataset.tk; localStorage.setItem('kyvo_track_kind', trackKind); renderTrack(); }));
    wireRows($('#listBody'));
    trackBackfill(list, () => { if (view === 'track') renderTrack(); });
  }

  /* ---- 🏃 Runner tab ---- */
  const RSEEN = 'kyvo_runner_viewed_v1';
  let runnerStage = +(localStorage.getItem('kyvo_runner_stage') || 0) || 0;
  let shapeT = 0;
  function runnerItems() { return window.KyvoInsights ? window.KyvoInsights.runnerList(activeChain) : { coins: [], tweets: [] }; }
  function updateRunnerBadge(items) {
    items = items || runnerItems();
    let seenK = {}; try { seenK = JSON.parse(localStorage.getItem(RSEEN) || '{}') || {}; } catch (e) {}
    const n = items.coins.concat(items.tweets).filter((x) => !seenK[x.key]).length;
    $$('[data-runner-count]').forEach((el) => { el.textContent = n ? String(n) : ''; el.style.display = n ? '' : 'none'; });
  }
  function renderRunner() {
    document.body.classList.remove('pulse-on');
    $('#pulseDesk').innerHTML = '';
    const en = window.KyvoI18n && window.KyvoI18n.isEn();
    const L2 = (pl, e) => (en ? e : pl);
    const items = runnerItems();
    const seenK = {}; for (const x of items.coins.concat(items.tweets)) seenK[x.key] = Date.now();
    try { localStorage.setItem(RSEEN, JSON.stringify(seenK)); } catch (e) {}
    updateRunnerBadge(items);
    // v8.3: stages by MC, smallest first (how early each runner is); MC at first flag from the track-record log
    for (const x of items.coins) trackFlag(x.c, x.leg2 ? 'leg2' : 'runner');
    items.coins.sort((a, b) => (a.c.mcap || 0) - (b.c.mcap || 0));
    const stCount = {}; for (const x of items.coins) { const st = stageOf(x.c.mcap); if (st) stCount[st.n] = (stCount[st.n] || 0) + 1; }
    if (runnerStage && !stCount[runnerStage]) runnerStage = 0;
    const shown = runnerStage ? items.coins.filter((x) => (stageOf(x.c.mcap) || {}).n === runnerStage) : items.coins;
    const flagAgo = (ms) => { const m = Math.max(1, Math.round((Date.now() - ms) / 60e3)); return m < 60 ? L2(m + ' min temu', m + ' min ago') : L2(Math.round(m / 60) + ' h temu', Math.round(m / 60) + ' h ago'); };
    const coinCard = (x) => {
      const c = x.c;
      const st = stageOf(c.mcap), tr = track.items[keyOf(c)];
      const climb = tr && tr.mc0 ? (c.mcap / tr.mc0 - 1) * 100 : null;
      return `<div class="row runner${x.leg2 ? ' leg2' : ''}" data-key="${esc(keyOf(c))}" role="button" tabindex="0">${imgTag(c)}
        <div class="nm"><b><span class="cbadge c-${esc(c.chainId || 'solana')}">${esc(chainBadge(c))}</span> ${esc(c.name)} <span class="mut" style="font-weight:600">$${esc(c.symbol)}</span>${x.leg2 ? ` <span class="leg2b" translate="no">🔁 ${L2('Kolejna fala', 'Second leg')}</span>` : x.early ? ` <span class="leg2b early" translate="no">⚡ ${L2('Zaczyna pompować', 'Starting to pump')}</span>` : ''}</b>
          ${st ? `<div class="rstage st${st.n}" translate="no"><b>${L2('Etap', 'Stage')} ${st.n}</b> ${stageBarHtml(st)} <span class="mut">${esc(st.range)} · ${esc(L2(st.pl, st.en))}</span></div>` : ''}
          <div class="rmc" translate="no">${tr && tr.mc0 ? `${L2('MC przy oznaczeniu', 'MC at flag')} <b>${fmtUsd(tr.mc0)}</b> → ${L2('teraz', 'now')} <b>${fmtUsd(c.mcap)}</b> <span class="${pctClass(climb)}">${climb >= 0.5 ? '↑' : climb <= -0.5 ? '↓' : '→'} ${fmtPct(climb)}</span> <span class="mut">· ${esc(flagAgo(tr.kinds.runner || tr.kinds.leg2 || tr.at))}</span>` : `MC <b>${fmtUsd(c.mcap)}</b>`}</div>
          <small>Liq ${fmtLiq(c)} · ⏱ ${esc(ageFrom(c.pairCreatedAt))}</small>
          <div class="rwhy" translate="no">${x.leg2 ? '🔁 ' + L2('Dlaczego kolejna fala', 'Why second leg') : '🏃 ' + L2('Dlaczego runner', 'Why runner')}: ${x.why.join(' · ')}</div>
          ${window.KyvoInsights.upsideRowHtml(c)}</div>
        <div class="rt"><b class="${pctClass(c.change.h1)}">${fmtPct(c.change.h1)}</b><small class="mut">1h</small></div></div>`;
    };
    const twCard = (x) => {
      const k = coinKey(x.coin.chain, x.coin.address);
      return `<div class="card runner-tw" translate="no">
        <div class="rtw-h">${imgTag(x.t.avatar, 'av', 32)} <b>@${esc(x.t.handle)}</b> <span class="mut">${esc(agoLabel(x.at))} · ${x.views ? fmtInt(x.views) + ' views' : fmtInt(x.likes) + ' ♥'}${x.vel ? ' · ' + fmtInt(Math.round(x.vel)) + ' views/h' : ''}</span></div>
        <div class="rtw-t">${esc(String(x.t.text || '').slice(0, 220))}</div>
        <div class="rwhy">🏃 ${L2('Dlaczego runner', 'Why runner')}: ${x.why.join(' · ')}</div>
        ${vCoinHtml(Object.assign({}, x.coin, { kyvo: true }))}
        <div class="vsince mut" data-rsince="${esc(k)}" data-at="${esc(x.at)}">${L2('Ruch od tweeta: liczę…', 'Move since tweet: computing…')}</div>
        <a href="${esc(x.t.url)}" target="_blank" rel="noopener noreferrer" style="font-size:12px">${L2('Otwórz tweet', 'Open tweet')} ↗</a>
      </div>`;
    };
    $('#listBody').innerHTML = `<div class="h">🏃 Runner <span class="badge live">LIVE</span></div>
      <div class="sub" translate="no">${L2('Tylko najmocniejsze sygnały: ogromny i rosnący wolumen, bardzo dużo transakcji, szybki ruch po filtrach bezpieczeństwa — oraz super-ważne tweety z coinem.', 'Only the strongest signals: huge and accelerating volume, very many txns, a fast move after safety filters — plus super-important tweets with a coin.')}</div>
      <div class="h" style="font-size:14px;margin-top:10px">${L2('Coiny — od najmniejszego MC (najwcześniej)', 'Coins — smallest MC first (earliest)')} <span class="mut" style="font-size:12px">${items.coins.length}</span></div>
      ${items.coins.length ? `<div class="filtbar rstages" style="margin:6px 0" translate="no"><button type="button" class="fbtn ${!runnerStage ? 'on' : ''}" data-rst="0">${L2('Wszystkie', 'All')}</button>${STAGES.map((s2) => `<button type="button" class="fbtn ${runnerStage === s2.n ? 'on' : ''}" data-rst="${s2.n}" ${stCount[s2.n] ? '' : 'disabled'}>${L2('Etap', 'Stage')} ${s2.n} <span class="mut">${esc(s2.range)}</span> ${stCount[s2.n] || 0}</button>`).join('')}</div>` : ''}
      ${items.coins.length ? `<div class="card" style="padding:4px 10px">${shown.map(coinCard).join('')}</div>` : `<div class="empty" translate="no">${L2('Teraz brak runnerów — próg jest celowo wysoki (kilka–kilkanaście dziennie).', 'No runners right now — the bar is deliberately high (a handful to ~20 a day).')}</div>`}
      <div class="h" style="font-size:14px;margin-top:12px">${L2('Super-ważne tweety', 'Super-important tweets')} <span class="mut" style="font-size:12px">${items.tweets.length}</span></div>
      ${items.tweets.length ? items.tweets.map(twCard).join('') : `<div class="empty" translate="no">${L2('Brak super-ważnych tweetów z ostatnich 24 h w migawce X.', 'No super-important tweets from the last 24 h in the X snapshot.')}</div>`}
      <div class="foot" translate="no">${L2('Runner to spekulacja, nie prognoza ani porada finansowa — memecoiny mogą spaść do zera. Migawka X odświeżana ok. 3× dziennie; powiadomienia działają przy otwartej apce (push w tle po włączeniu OneSignal).', 'Runner is speculation, not a forecast or financial advice — memecoins can go to zero. X snapshot refreshes about 3× a day; notifications work while the app is open (background push once OneSignal is enabled).')}</div>`;
    wireRows($('#listBody'));
    $$('#listBody [data-rst]').forEach((b) => (b.onclick = () => { runnerStage = +b.dataset.rst || 0; localStorage.setItem('kyvo_runner_stage', String(runnerStage)); renderRunner(); }));
    saveTrack();
    // move since tweet (GeckoTerminal candle, cached)
    if (window.KyvoInsights) {
      $$('[data-rsince]').forEach(async (el) => {
        const k = el.dataset.rsince, at = el.dataset.at;
        const x = items.tweets.find((t) => coinKey(t.coin.chain, t.coin.address) === k);
        if (!x) return;
        try {
          const v = await window.KyvoInsights.priceAtTweet({ chain: x.coin.chain, address: x.coin.address, pair: x.coin.pair, pair_created_at: x.coin.pair_created_at }, at);
          const L0 = liveCoinOf(k);
          const now = L0 && L0.price != null ? L0.price : x.coin.price_usd;
          if (!el.isConnected) return;
          if (v && v.preLaunch) el.textContent = L2('Coin powstał po tweecie', 'Coin launched after the tweet');
          else if (v && v.px && now) { const ch = (now / v.px - 1) * 100; el.innerHTML = `${L2('Od tweeta', 'Since tweet')}: <b class="${pctClass(ch)}">${fmtPct(ch)}</b>`; }
          else el.textContent = L2('Ruch od tweeta: brak danych', 'Move since tweet: no data');
        } catch (e) { if (el.isConnected) el.textContent = L2('Ruch od tweeta: brak danych', 'Move since tweet: no data'); }
      });
    }
  }
  function listHot() {
    let list = applyFilters(coins.slice(), 'hot');
    list.sort((a, b) => (b.volume.h24 || 0) - (a.volume.h24 || 0));
    return list;
  }
  function listBoosted() {
    let list = applyFilters(coins.filter((c) => c.boost > 0), 'boosted');
    if (!list.length) list = applyFilters(coins.slice(), 'boosted');
    list.sort((a, b) => (b.boost || 0) - (a.boost || 0));
    return list;
  }

  /* ---- Render ---- */
  function imgTag(src, cls, size) {
    const s = size || 42;
    if (src && typeof src === 'object') {
      // coin-ish object → real logo with fallback chain (DexScreener → GeckoTerminal → pump.fun → monogram)
      const { list, mono } = imgCandidates(src);
      const ik = coinKey(src.chainId || src.chain || 'solana', src.address || '');
      const first = list[0] || mono;
      return `<img class="${cls || 'tok'}${list.length ? '' : ' mono'}" src="${esc(first)}" width="${s}" height="${s}" alt="" loading="lazy" decoding="async" data-ik="${esc(ik)}"${list.length ? '' : ' data-noimg="1"'} data-fb="${esc(list.slice(1).join('|'))}" data-mono="${esc(mono)}" onload="__kyvoImgOk(this)" onerror="__kyvoImgErr(this)">`;
    }
    const mono = monogram('?', String(src || ''));
    return `<img class="${cls || 'tok'}" src="${esc(src || mono)}" width="${s}" height="${s}" alt="" loading="lazy" decoding="async" onerror="this.onerror=null;this.src=this.getAttribute('data-mono')" data-mono="${esc(mono)}">`;
  }

  /* first-seen per list (localStorage) → "na liście od X" */
  const SEEN_KEY = 'kyvo_seen_v1';
  let seen = {};
  try { seen = JSON.parse(localStorage.getItem(SEEN_KEY) || '{}') || {}; } catch (e) { seen = {}; }
  let seenDirty = false;
  function seenSince(listId, key) {
    if (!listId) return null;
    const m = seen[listId] || (seen[listId] = {});
    if (!m[key]) { m[key] = Date.now(); seenDirty = true; }
    return m[key];
  }
  function flushSeen() {
    if (!seenDirty) return;
    seenDirty = false;
    const cut = Date.now() - 3 * 86400000;
    for (const l of Object.keys(seen)) {
      const ent = Object.entries(seen[l]).filter(([, t]) => t > cut).sort((a, b) => b[1] - a[1]).slice(0, 400);
      seen[l] = Object.fromEntries(ent);
    }
    try { localStorage.setItem(SEEN_KEY, JSON.stringify(seen)); } catch (e) {}
  }
  setInterval(flushSeen, 5000);
  function onListLabel(ms) {
    const m = Math.floor((Date.now() - ms) / 60000);
    if (m < 1) return 'na liście od <1 min';
    if (m < 60) return 'na liście od ' + m + ' min';
    if (m < 1440) return 'na liście od ' + Math.floor(m / 60) + ' h';
    return 'na liście od ' + Math.floor(m / 1440) + ' d';
  }
  function rowTimeHtml(c, listId) {
    const age = ageFrom(c.pairCreatedAt);
    const fs = seenSince(listId, keyOf(c));
    return `<span class="tm"><span class="agepill" title="Wiek pary (od utworzenia)">⏱ ${esc(age)}</span>${fs ? `<span class="onlist" title="Od kiedy coin jest w tej zakładce (zapamiętane w tej przeglądarce)">${onListLabel(fs)}</span>` : ''}</span>`;
  }

  function coinRow(c, opts) {
    opts = opts || {};
    const ch = c.change.h1 != null ? c.change.h1 : c.change.h24;
    let extra = '';
    if (opts.showCurve && c.curveEst != null) {
      extra = `<span class="est">~${c.curveEst.toFixed(0)}% krzywej*</span>`;
    }
    if (opts.showDex) {
      extra += (extra ? ' · ' : '') + `<span class="mut">${esc(c.dexId)}</span>`;
    }
    const cons = consensusOf(c);
    if (cons.buyers.length) {
      const names = cons.buyers.slice(0, 2).join(', ');
      extra += (extra ? ' · ' : '') + `<span class="smbadge" title="Konsensus smart money (72h): ${cons.buyers.length} kupiło${cons.sellers.length ? ', ' + cons.sellers.length + ' już sprzedało' : ''}">🧠 ${cons.buyers.length} SM${cons.sellers.length ? ' · ' + cons.sellers.length + ' sprz.' : ''} · ${esc(names)}</span>`;
    }
    const cl = window.KyvoInsights ? window.KyvoInsights.cloneCheck(c) : null;
    if (cl && cl.bigger) extra += (extra ? ' · ' : '') + `<span class="clonebadge" title="Jest większy coin o tym samym tickerze — sprawdź adres (CA)">⚠ możliwa kopia</span>`;
    const star = window.KyvoInsights && window.KyvoInsights.isWatched(keyOf(c)) ? '<span class="wstar" title="Na Twojej watchliście">★</span> ' : '';
    const badge = `<span class="cbadge c-${esc(c.chainId || 'solana')}">${esc(chainBadge(c))}</span>`;
    return `<div class="row" data-key="${esc(keyOf(c))}" role="button" tabindex="0">
      ${imgTag(c)}
      <div class="nm"><b>${star}${badge} ${esc(c.name)} <span class="mut" style="font-weight:600">$${esc(c.symbol)}</span></b>
        <small>MC ${fmtUsd(c.mcap)} · ${fmtLiq(c) === 'krzywa' ? 'Liq: krzywa' : 'Liq ' + fmtLiq(c)}${extra ? ' · ' + extra : ''}</small>
        ${rowTimeHtml(c, opts.listId)}${opts.upside && window.KyvoInsights ? (opts.good ? window.KyvoInsights.goodRowHtml(c) : window.KyvoInsights.upsideRowHtml(c)) : ''}</div>
      <div class="rt"><b class="${pctClass(ch)}">${fmtPct(ch)}</b>
        <small class="mut">Vol ${fmtUsd(c.volume.h24)}</small></div>
    </div>`;
  }

  function wireRows(root) {
    $$('[data-key]', root).forEach((el) => {
      const go = (e) => { if (e && e.target && e.target.closest && e.target.closest('.upl,.upx')) return; goCoin(el.getAttribute('data-key')); };
      el.addEventListener('click', go);
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          if (e.target !== el) return;
          e.preventDefault();
          go();
        }
      });
    });
  }

  function renderFilterPanel(tab) {
    const f = filters[tab] || DEFAULT_FILTERS.hot;
    // v8.4: Kyvo's default thresholds are not shown — an empty field = "auto (Kyvo)"
    const dflt = DEFAULT_FILTERS[tab] || {};
    const fv = (k) => (f[k] != null && String(f[k]) !== '' && String(f[k]) === String(dflt[k] == null ? '' : dflt[k]) ? '' : f[k]);
    const fph = (k, ph) => (dflt[k] != null && String(dflt[k]) !== '' ? 'auto (Kyvo)' : ph.replace(/^np\. [0-9.]+$/, '—'));
    const panel = $('#filtPanel');
    const bar = $('#filtBar');
    const show = FILTER_TABS.includes(tab) && tab !== 'viral' && tab !== 'more' && tab !== 'coin' && tab !== 'search';
    if (bar) bar.style.display = show ? '' : 'none';
    if (!show) {
      panel.classList.remove('open');
      return;
    }
    $('#filtSummary').textContent = filtSummary(tab);
    $('#filtToggle').classList.toggle('on', filtOpen);
    panel.classList.toggle('open', filtOpen);
    if (!filtOpen) {
      panel.innerHTML = '';
      return;
    }
    panel.innerHTML = `
      <div class="fgrid">
        <div class="ffield"><label>MC min ($)</label><input data-k="mcapMin" type="number" inputmode="decimal" value="${esc(fv('mcapMin'))}" placeholder="${esc(fph('mcapMin', 'np. 10000'))}"></div>
        <div class="ffield"><label>MC max ($)</label><input data-k="mcapMax" type="number" inputmode="decimal" value="${esc(fv('mcapMax'))}" placeholder="${esc(fph('mcapMax', '—'))}"></div>
        <div class="ffield"><label>Liq min ($)</label><input data-k="liqMin" type="number" inputmode="decimal" value="${esc(fv('liqMin'))}" placeholder="${esc(fph('liqMin', '—'))}"></div>
        <div class="ffield"><label>Vol 24h min ($)</label><input data-k="volMin" type="number" inputmode="decimal" value="${esc(fv('volMin'))}" placeholder="${esc(fph('volMin', '—'))}"></div>
        <div class="ffield"><label>Wiek max (h)</label><input data-k="ageMaxH" type="number" inputmode="decimal" value="${esc(fv('ageMaxH'))}" placeholder="${esc(fph('ageMaxH', '—'))}"></div>
        <div class="ffield"><label>Wiek min (h)</label><input data-k="ageMinH" type="number" inputmode="decimal" value="${esc(fv('ageMinH'))}" placeholder="${esc(fph('ageMinH', '—'))}"></div>
        <div class="ffield"><label>Δ 5m min (%)</label><input data-k="chg5mMin" type="number" inputmode="decimal" value="${esc(fv('chg5mMin'))}" placeholder="${esc(fph('chg5mMin', '—'))}"></div>
        <div class="ffield"><label>Δ 1h min (%)</label><input data-k="chg1hMin" type="number" inputmode="decimal" value="${esc(fv('chg1hMin'))}" placeholder="${esc(fph('chg1hMin', '—'))}"></div>
        <div class="ffield"><label>Buy ratio 1h min (0–1)</label><input data-k="buyRatioMin" type="number" step="0.05" min="0" max="1" value="${esc(fv('buyRatioMin'))}" placeholder="${esc(fph('buyRatioMin', 'np. 0.4'))}"></div>
        <div class="ffield full"><label class="fcheck"><input data-k="hasSocials" type="checkbox" ${f.hasSocials ? 'checked' : ''}> Wymagaj socials / strony WWW</label></div>
      </div>
      <div class="factions">
        <button type="button" class="reset" id="filtReset">Reset</button>
        <button type="button" class="apply" id="filtApply">Zastosuj</button>
      </div>
      <div class="mut" style="font-size:11px;margin-top:8px">Sieć wybierasz przełącznikiem u góry. Filtry zapisują się w tej przeglądarce. Buy ratio = udział transakcji kupna w ostatniej godzinie.</div>`;
    $('#filtApply').onclick = () => {
      const next = Object.assign({}, filters[tab]);
      panel.querySelectorAll('[data-k]').forEach((el) => {
        const k = el.getAttribute('data-k');
        if (el.type === 'checkbox') next[k] = el.checked;
        else next[k] = el.value === '' && DEFAULT_FILTERS[tab] && DEFAULT_FILTERS[tab][k] != null ? DEFAULT_FILTERS[tab][k] : el.value;
      });
      next.chain = activeChain;
      filters[tab] = next;
      saveFilters();
      filtOpen = false;
      setView(view);
    };
    $('#filtReset').onclick = () => {
      filters[tab] = Object.assign({}, DEFAULT_FILTERS[tab], { chain: activeChain });
      saveFilters();
      renderFilterPanel(tab);
      setView(view);
    };
  }

  function renderList(list, title, sub, opts) {
    opts = opts || {};
    const body = $('#listBody');
    document.body.classList.remove('pulse-on');
    $('#pulseDesk').innerHTML = '';
    if (fetchErr && !list.length) {
      body.innerHTML = `<div class="err">${esc(fetchErr)}<div style="margin-top:8px"><button class="pill" id="retryBtn">Spróbuj ponownie</button></div></div>`;
      $('#retryBtn') && $('#retryBtn').addEventListener('click', () => refresh(true));
      return;
    }
    const swipe =
      opts.swipeTabs
        ? `<div class="swipe" id="pulseSwipe">
            <button type="button" data-ptab="new" class="${mobilePulseTab === 'new' ? 'on' : ''}">New</button>
            <button type="button" data-ptab="stretch" class="${mobilePulseTab === 'stretch' ? 'on' : ''}" ${!chainSupportsStretch(activeChain) ? 'disabled style="opacity:.4"' : ''}>Final Stretch</button>
            <button type="button" data-ptab="migrated" class="${mobilePulseTab === 'migrated' ? 'on' : ''}" ${!chainSupportsMigrated(activeChain) ? 'disabled style="opacity:.4"' : ''}>Migrated</button>
          </div>`
        : '';
    body.innerHTML = `
      ${swipe}
      <div class="h">${esc(title)} <span class="badge live">LIVE</span> <span class="mut" style="font-weight:600;font-size:12px">${list.length}</span></div>
      <div class="sub">${esc(sub || '')} · ${esc(filtSummary(opts.filtTab || view))} · ${esc(sourceLabel || 'DexScreener')}</div>
      ${opts.hideNote ? `<div class="card" style="font-size:12.5px;color:var(--warn)">${esc(opts.hideNote)}</div>` : ''}
      ${
        list.length
          ? `<div class="card" style="padding:4px 10px">${list.map((c, i) => coinRow(c, Object.assign({ listId: (opts.filtTab || view) + ':' + activeChain, good: (opts.filtTab || view) === 'good', upside: (opts.filtTab || view) === 'good' ? i < 60 : (opts.filtTab || view) === 'new' ? i < 40 : i < 5 }, opts.rowOpts))).join('')}</div>`
          : opts.hideNote
            ? ''
            : `<div class="empty">Brak coinów dla tych filtrów.</div>`
      }
      ${opts.footnote || ''}
      <div class="foot">Dane: DexScreener / GeckoTerminal · to nie jest porada finansowa</div>`;
    wireRows(body);
    if (opts.swipeTabs) {
      $$('#pulseSwipe [data-ptab]').forEach((b) =>
        b.addEventListener('click', () => {
          if (b.disabled) return;
          mobilePulseTab = b.getAttribute('data-ptab');
          setView('pulse');
        })
      );
    }
  }

  function stretchTip() {
    if (activeChain === 'bsc') return 'four.meme · blisko ukończenia krzywej';
    if (activeChain === 'all') return 'pump.fun + four.meme · blisko ukończenia krzywej';
    return 'pump.fun · blisko ukończenia krzywej';
  }
  function migrTip() {
    if (activeChain === 'bsc') return 'Niedawno przeszły na PancakeSwap';
    if (activeChain === 'all') return 'Niedawno przeszły na DEX (PumpSwap, Raydium, PancakeSwap…)';
    return 'Niedawno na PumpSwap / Raydium / Meteora…';
  }
  function newTip() {
    const ch = CHAIN_LABEL[activeChain] || activeChain;
    return 'Najnowsze pary';
  }

  function renderPulseDesktop() {
    const news = listNew('new').slice(0, 40);
    const stretchOk = chainSupportsStretch(activeChain);
    const migrOk = chainSupportsMigrated(activeChain);
    const stretch = stretchOk ? listStretch('stretch').slice(0, 40) : [];
    const migr = migrOk ? listMigrated('migrated').slice(0, 40) : [];
    document.body.classList.add('pulse-on');
    $('#listBody').innerHTML = '';
    const desk = $('#pulseDesk');
    const col = (title, list, tip, rowOpts, emptyNote, listKey = title === 'New Pairs' ? 'new' : title === 'Final Stretch' ? 'stretch' : 'migrated') => `
      <div class="pcol">
        <h3>${esc(title)} <span class="badge live">${list.length}</span></h3>
        <div class="mut" style="font-size:11px;margin-bottom:8px">${esc(tip)}</div>
        ${qualityNote(listKey)}
        ${
          list.length
            ? list.map((c, i) => coinRow(c, Object.assign({ listId: listKey + ':' + activeChain, upside: listKey === 'new' ? i < 40 : i < 5 }, rowOpts))).join('')
            : `<div class="empty" style="padding:16px 4px">${esc(emptyNote || 'Brak coinów — zmień filtry albo poczekaj chwilę na odświeżenie')}</div>`
        }
      </div>`;
    let html = col('New Pairs', news, newTip(), { showDex: true });
    if (stretchOk) {
      html += col('Final Stretch', stretch, stretchTip(), { showCurve: true });
    } else {
      html += col('Final Stretch', [], 'Niedostępne', {}, chainNote(activeChain));
    }
    if (migrOk) {
      html += col('Migrated', migr, migrTip(), { showDex: true });
    } else {
      html += col('Migrated', [], 'Niedostępne', {}, chainNote(activeChain));
    }
    html += `<div class="foot" style="grid-column:1/-1">* Procent krzywej to estymacja (MC / ~$69k), nie oficjalna wartość. · ${chainNote(activeChain)}</div>`;
    desk.innerHTML = html;
    wireRows(desk);
  }

  function renderPulseMobile() {
    document.body.classList.remove('pulse-on');
    $('#pulseDesk').innerHTML = '';
    if (mobilePulseTab === 'stretch') {
      if (!chainSupportsStretch(activeChain)) {
        renderList([], 'Final Stretch', 'Niedostępne na tym chainie', {
          filtTab: 'stretch',
          swipeTabs: true,
          hideNote: chainNote(activeChain),
        });
        return;
      }
      renderList(listStretch('stretch'), 'Final Stretch', stretchTip(), {
        filtTab: 'stretch',
        swipeTabs: true,
        rowOpts: { showCurve: true },
        footnote: qualityNote('stretch') + '<div class="mut" style="font-size:11px;margin:6px 2px">* Krzywa ≈ MC / ~$69k (estymacja)</div>',
      });
    } else if (mobilePulseTab === 'migrated') {
      if (!chainSupportsMigrated(activeChain)) {
        renderList([], 'Migrated', 'Niedostępne na tym chainie', {
          filtTab: 'migrated',
          swipeTabs: true,
          hideNote: chainNote(activeChain),
        });
        return;
      }
      renderList(listMigrated('migrated'), 'Migrated', migrTip(), {
        filtTab: 'migrated',
        swipeTabs: true,
        rowOpts: { showDex: true },
        footnote: qualityNote('migrated'),
      });
    } else {
      renderList(listNew('new'), 'New Pairs', newTip(), {
        filtTab: 'new',
        swipeTabs: true,
        rowOpts: { showDex: true },
        footnote: qualityNote('new'),
      });
    }
  }

  function isDesktopPulse() {
    return window.matchMedia('(min-width:900px)').matches;
  }

  function openCoin(key) {
    selectedKey = key;
    view = 'coin';
    let c = byKey[key];
    // legacy: bare address
    if (!c && key && key.indexOf(':') < 0) {
      c = Object.values(byKey).find((x) => x.address === key);
      if (c) key = keyOf(c);
    }
    const paint = (coin) => {
      show('coin');
      renderCoin(coin);
    };
    if (c) {
      paint(c);
      enrichCoin(c).then((nc) => {
        if (nc && selectedKey === keyOf(nc)) {
          byKey[keyOf(nc)] = nc;
          paint(nc);
        }
      });
      return;
    }
    show('coin');
    $('#coinBody').innerHTML = `<div class="loading"><div class="spin"></div>Ładuję coin…</div>`;
    const addr = key.includes(':') ? key.split(':').slice(1).join(':') : key;
    enrichCoin({ address: addr, chainId: key.includes(':') ? key.split(':')[0] : 'solana' }).then((nc) => {
      if (!nc) {
        $('#coinBody').innerHTML = `<div class="err">Nie znaleziono.<div class="back" id="backFail">‹ Wróć</div></div>`;
        $('#backFail') && $('#backFail').addEventListener('click', () => history.back());
        return;
      }
      byKey[keyOf(nc)] = nc;
      selectedKey = keyOf(nc);
      paint(nc);
    });
  }

  async function enrichCoin(cOrAddr) {
    const addr = typeof cOrAddr === 'string' ? cOrAddr : cOrAddr.address;
    try {
      const d = await fetchJson(DS + '/latest/dex/tokens/' + encodeURIComponent(addr));
      const map = {};
      ingestPairs(d.pairs || [], null, map);
      if (typeof cOrAddr === 'object' && cOrAddr.chainId) {
        const k = coinKey(cOrAddr.chainId, addr);
        if (map[k]) return map[k];
      }
      const vals = Object.values(map);
      if (activeChain !== 'all') {
        const hit = vals.find((x) => x.chainId === activeChain);
        if (hit) return hit;
      }
      return vals[0] || byKey[coinKey((cOrAddr && cOrAddr.chainId) || 'solana', addr)] || null;
    } catch (e) {
      return typeof cOrAddr === 'object' ? byKey[keyOf(cOrAddr)] || null : null;
    }
  }

  function renderCoin(c) {

    const smBuys = (c.chainId === 'solana' || !c.chainId) ? smartBuysForMint(c.address) : [];
    const smHtml = smBuys.length
      ? `<div class="card" style="margin-top:10px"><div class="h" style="font-size:13px;margin:0 0 6px">Smart money <span class="badge live">on-chain</span> <span class="smbadge">🧠 ${consensusOf(c).buyers.length} kupiło${consensusOf(c).sellers.length ? ' · ' + consensusOf(c).sellers.length + ' już sprzedało' : ''}</span></div>
          <div class="mut" style="font-size:11px;margin-bottom:6px">Publiczne portfele KOL / traderów · dane z ${esc(stampLabel(smartMoney && smartMoney.updated_at))} · to nie porada finansowa</div>
          ${smBuys.slice(0, 8).map((b) =>
            `<div style="display:flex;justify-content:space-between;gap:8px;padding:5px 0;border-bottom:1px solid #ffffff08;font-size:12.5px">
              <span><b>${esc(b.wallet_name)}</b> ${b.handle ? `<a href="https://x.com/${esc(b.handle)}" target="_blank" rel="noopener">@${esc(b.handle)}</a>` : ''}
              <span class="mut">${b.block_time ? agoLabel(b.block_time) : '—'}</span></span>
              <span>${esc(fmtSize(b))} <a href="${esc(b.tx_url)}" target="_blank" rel="noopener" style="font-size:11px">tx</a></span>
            </div>`
          ).join('')}
        </div>`
      : (c.chainId === 'solana' || !c.chainId
          ? `<div class="card mut" style="margin-top:10px;font-size:12.5px"><span class="mut">Żaden ze śledzonych portfeli smart money nie kupował ostatnio tego coina.</span></div>`
          : '');

    const urls = platformUrls(c.address, c.chainId);
    const socials = (c.socials || [])
      .map((s) => {
        const u = s.url || s;
        return u ? `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(s.type || 'link')}</a>` : '';
      })
      .filter(Boolean)
      .join(' ');
    const webs = (c.websites || [])
      .map((w) => (w.url ? `<a href="${esc(w.url)}" target="_blank" rel="noopener noreferrer">${esc(w.label || 'web')}</a>` : ''))
      .filter(Boolean)
      .join(' ');
    const gradLabel = c.gradMcap ? '~$' + Math.round(c.gradMcap / 1000) + 'k' : '~$69k';
    const curveLine =
      c.curveEst != null
        ? `<div class="card" style="margin-top:10px;font-size:13px">Krzywa (estymacja): <b>~${c.curveEst.toFixed(1)}%</b> <span class="est">(MC ${fmtUsd(c.mcap)} / ${gradLabel})*</span></div>`
        : '';
    const curveBadge =
      c.dexId === 'pumpfun'
        ? '<span class="badge demo" style="margin-left:4px">pump.fun</span>'
        : c.dexId === 'fourmeme'
          ? '<span class="badge demo" style="margin-left:4px">four.meme</span>'
          : '';

    $('#coinBody').innerHTML = `
      <div style="display:flex;align-items:center;gap:10px">
        <span class="back" id="coinBack">‹</span>
        ${imgTag(c, 'tok', 46)}
        <div style="min-width:0;flex:1">
          <b style="font-size:17px">${esc(c.name)}</b>
          <div class="mut" style="font-size:12px">$${esc(c.symbol)} · ${ageFrom(c.pairCreatedAt)} · ${esc(c.dexId)}</div>
        </div>
        ${window.KyvoInsights ? window.KyvoInsights.watchButtonHtml(c) : '<img src="kyvo_mark.svg" width="28" height="28" alt="">'}
      </div>
      <div style="margin-top:10px">
        <span class="ca">CA ${esc(shortCa(c.address))}
          <button class="copybtn" id="copyCa" type="button" aria-label="Kopiuj adres">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ddd" stroke-width="2.4"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>
          </button>
        </span>
        <span class="cbadge c-${esc(c.chainId)}" style="margin-left:6px">${esc(chainBadge(c))}</span>
        <span class="badge live" style="margin-left:6px">LIVE</span>
        ${curveBadge}
        ${c.migrated ? '<span class="badge live" style="margin-left:4px">migrated</span>' : ''}
      </div>
      <div style="margin-top:10px;font-size:12px;word-break:break-all" class="mut" id="fullCa">${esc(c.address)}</div>
      <div style="margin-top:12px">
        <b style="font-size:26px">${fmtUsd(c.mcap)}</b> <span class="mut">MC</span>
        <span class="${pctClass(c.change.h24)}" style="font-weight:700;margin-left:6px">${fmtPct(c.change.h24)} 24h</span>
      </div>
      <div id="chartSlot" class="chartslot"></div>
      <div id="kcheckSlot" class="card" style="margin-top:10px"></div>
      <div id="upsideSlot" style="margin-top:10px"></div>
      ${curveLine}
      <div class="statg">
        <div class="st"><small>Cena</small><b>${fmtUsd(c.priceUsd)}</b></div>
        <div class="st"><small>Płynność</small><b>${fmtLiq(c)}</b></div>
        <div class="st"><small>FDV</small><b>${fmtUsd(c.fdv)}</b></div>
        <div class="st"><small>Vol 5m</small><b>${fmtUsd(c.volume.m5)}</b></div>
        <div class="st"><small>Vol 1h</small><b>${fmtUsd(c.volume.h1)}</b></div>
        <div class="st"><small>Vol 24h</small><b>${fmtUsd(c.volume.h24)}</b></div>
        <div class="st"><small>Δ 5m</small><b class="${pctClass(c.change.m5)}">${fmtPct(c.change.m5)}</b></div>
        <div class="st"><small>Δ 1h</small><b class="${pctClass(c.change.h1)}">${fmtPct(c.change.h1)}</b></div>
        <div class="st"><small>Buy 1h</small><b>${c.buyRatioH1 != null ? Math.round(c.buyRatioH1 * 100) + '%' : '—'}</b></div>
      </div>
      ${smHtml}
      <div class="card" style="margin-top:10px"><div class="h" style="font-size:13px;margin:0 0 6px">Socials</div><div class="socials">${socials || '<span class="mut">Brak</span>'} ${webs}</div></div>
      ${platButtonsHtml(urls)}
      <div style="margin-top:8px;text-align:center;display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
        <a href="${esc(urls.DexScreener)}" target="_blank" rel="noopener noreferrer" style="font-size:12px">DexScreener ↗</a>
        ${urls.Explorer ? `<a href="${esc(urls.Explorer)}" target="_blank" rel="noopener noreferrer" style="font-size:12px">Explorer ↗</a>` : ''}
      </div>
      <div class="foot">To nie jest porada finansowa · DYOR · zawsze sprawdzaj adres (CA)</div>`;
    if (window.KyvoChart) {
      window.KyvoChart.mount($('#chartSlot'), {
        key: keyOf(c), network: GECKO_NET[c.chainId || 'solana'], pool: c.pairAddress || null, token: c.address,
        dsChain: c.chainId || 'solana', pair: c.pairAddress || '', smBuys,
      });
    }
    if (window.KyvoInsights) {
      window.KyvoInsights.wireWatchButton(c);
      window.KyvoInsights.mountCheck($('#kcheckSlot'), c);
      window.KyvoInsights.mountUpside($('#upsideSlot'), c);
    }
    $('#coinBack').onclick = () => (history.length > 1 ? history.back() : setView('pulse'));
    $('#copyCa').onclick = async () => {
      try {
        await navigator.clipboard.writeText(c.address);
        toast('Skopiowano CA ' + shortCa(c.address));
      } catch (e) {
        toast('Nie udało się skopiować');
      }
    };
  }

  /* ---------------- Viral z X: tematy → coiny, tweety traderów, ważne posty ---------------- */
  let viralTab = localStorage.getItem('kyvo_viral_tab') || 'topics';
  const liveCoin = {}; // chain:addr -> {mcap, change24, image}
  function liveCoinOf(k) { return liveCoin[k] || null; }
  function snapCoinKey(c) { return coinKey(c.chain, c.address); }
  function vCoinHtml(c, opts) {
    opts = opts || {};
    const k = snapCoinKey(c);
    const L = liveCoin[k] || {};
    const mc = L.mcap != null ? L.mcap : c.mcap;
    const ch = L.change24 != null ? L.change24 : c.change_h24;
    const img = Object.assign({}, c, { image: L.image || c.image });
    const href = c.kyvo !== false ? '#coin/' + encodeURIComponent(k) : null;
    const ds = c.dexscreener || `https://dexscreener.com/${c.chain}/${c.address}`;
    return `<div class="vcoin" data-vk="${esc(k)}">
      ${href ? `<a class="vcoin-main" href="${esc(href)}">` : '<span class="vcoin-main">'}
        ${imgTag(img, 'tok', opts.size || 34)}
        <span class="nm"><b><span class="cbadge c-${esc(c.chain)}">${esc(CHAIN_BADGE[c.chain] || String(c.chain || '').toUpperCase())}</span> $${esc(c.symbol)} <span class="mut" style="font-weight:600">· ${esc(c.name || '')}</span></b>
        <small><span data-mc>MC ${fmtUsd(mc)}</span> · <span data-ch class="${pctClass(ch)}">${fmtPct(ch)} 24h</span>${c.mention ? ` · <span class="mut">z tweeta: ${esc(c.mention.length > 16 ? shortCa(c.mention) : c.mention)}</span>` : ''}</small></span>
      ${href ? '</a>' : '</span>'}
      <span class="vcoin-act">${href ? `<a class="vbtn vbtn-pri" href="${esc(href)}">Otwórz</a>` : ''}<a class="vbtn" href="${esc(ds)}" target="_blank" rel="noopener noreferrer">DEX ↗</a></span>
    </div>`;
  }
  async function refreshViralCoins(root) {
    const all = [];
    for (const t of viral.topics || []) for (const c of t.coins || []) all.push(c);
    for (const t of viral.trader_tweets || []) for (const c of t.coins || []) all.push(c);
    for (const p of viral.posts || []) for (const c of (p.coins || []).concat(p.spec_coins || [])) all.push(c);
    const addrs = [...new Set(all.map((c) => c.address))];
    for (let i = 0; i < addrs.length; i += 30) {
      try {
        const d = await fetchJson(DS + '/latest/dex/tokens/' + addrs.slice(i, i + 30).join(','));
        const best = {};
        for (const p of d.pairs || []) {
          const k = coinKey(p.chainId, p.baseToken && p.baseToken.address);
          const liq = (p.liquidity && p.liquidity.usd) || 0;
          if (!best[k] || liq > best[k].liq) best[k] = { liq, price: p.priceUsd != null ? +p.priceUsd : null, mcap: p.marketCap || p.fdv, change24: p.priceChange && p.priceChange.h24, image: p.info && p.info.imageUrl };
        }
        Object.assign(liveCoin, best);
      } catch (e) { /* snapshot values stay */ }
    }
    if (!root || !root.isConnected) return;
    root.querySelectorAll('.vcoin[data-vk]').forEach((el) => {
      const L = liveCoin[el.dataset.vk];
      if (!L) return;
      const mc = el.querySelector('[data-mc]'); if (mc && L.mcap != null) mc.textContent = 'MC ' + fmtUsd(L.mcap);
      const ch = el.querySelector('[data-ch]'); if (ch && L.change24 != null) { ch.textContent = fmtPct(L.change24) + ' 24h'; ch.className = pctClass(L.change24); }
    });
  }
  const vl = (t, f) => (window.KyvoI18n && window.KyvoI18n.isEn() && t && t[f + '_en'] ? t[f + '_en'] : t ? t[f] : '');
  function tweetText(t) {
    // strip trailing t.co links; highlight cashtags / addresses that resolved
    let s = esc(String(t || '').replace(/&amp;/g, '&').replace(/\s*https:\/\/t\.co\/\w+/g, '').trim());
    s = s.replace(/(\$[A-Za-z][A-Za-z0-9]{0,14})\b/g, '<b class="vtag">$1</b>');
    return s;
  }
  function roleBadge(r) {
    return r === 'trader' ? '<span class="badge live" title="Portfel publicznie przypisany — jest w Rankingu">trader</span>' : '<span class="badge demo">KOL</span>';
  }
  /* v8.2: tweet facts (exact time, views, followers) + momentum + named-vs-speculative coin */
  const LOC = () => (window.KyvoI18n ? window.KyvoI18n.locale() : 'pl-PL');
  function exactTime(iso) {
    const d = new Date(iso);
    if (!isFinite(d.getTime())) return '';
    return d.toLocaleString(LOC(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
  function ageLabelH(h) { return h < 1 ? Math.max(1, Math.round(h * 60)) + ' min' : h < 48 ? Math.round(h) + ' h' : Math.round(h / 24) + ' d'; }
  function momentumOf(p) {
    const t0 = new Date(p.posted_at || p.created_at).getTime();
    if (!isFinite(t0)) return null;
    const ageH = (Date.now() - t0) / 3.6e6;
    const m = p.metrics || {};
    const tm = new Date(p.metrics_at || '').getTime();
    const hAtSnap = isFinite(tm) ? Math.max(0.25, (tm - t0) / 3.6e6) : null;
    const vph = m.views != null && hAtSnap ? m.views / hAtSnap : null;
    const stage = ageH < 2 ? 'early' : ageH < 12 ? 'mid' : ageH < 48 ? 'late' : 'old';
    const label = { early: '🟢 Wcześnie', mid: '🟡 W trakcie', late: '🟠 Późno', old: '🔴 Bardzo późno' }[stage];
    return { stage, label, ageH, vph };
  }
  function tweetMetaHtml(p) {
    const m = p.metrics || {};
    const mo = momentumOf(p);
    const at = p.posted_at || p.created_at;
    return `<div class="tmeta">
      <div class="tm-row">🕒 <b>${esc(exactTime(at))}</b> · ${esc(timeAgo(at))}${p.author_followers != null ? ` · 👥 <b>${fmtInt(p.author_followers)}</b> <span class="mut">obserwujących</span>` : ''}</div>
      <div class="tm-row tm-eng">${m.views != null ? `<span title="Wyświetlenia">👁 ${fmtInt(m.views)}</span>` : ''}<span title="Polubienia">♥ ${fmtInt(m.likes)}</span><span title="Reposty">↻ ${fmtInt(m.reposts)}</span><span title="Odpowiedzi">💬 ${fmtInt(m.replies)}</span>${m.quotes != null ? `<span title="Cytaty">❝ ${fmtInt(m.quotes)}</span>` : ''}</div>
      ${mo ? `<div class="tm-mom mom-${mo.stage}"><b>Momentum:</b> ${esc(mo.label)} · tweet ma ${esc(ageLabelH(mo.ageH))}${mo.vph != null ? ` · ~${fmtInt(Math.round(mo.vph))} wyśw./h <span class="mut">(średnio do pomiaru)</span>` : ''}</div>` : ''}
    </div>`;
  }
  function matchChipHtml(kind) {
    if (kind === 'named') return '<div class="mchip named">✅ Coin podany w tweecie</div>';
    if (kind === 'speculative') return '<div class="mchip spec">🔮 Spekulacja — dopasowanie po słowach kluczowych</div><div class="mut mdisc">Tweet nie podaje coina. To kandydaci znalezieni po nazwie/tickerze (nowsze i z większą płynnością wyżej). Mogą nie mieć nic wspólnego z tweetem i często są kopiami. Nie porada finansowa.</div>';
    return '';
  }
  let sinceReg = [];
  function sinceSlot(c, at, spec) {
    sinceReg.push({ c, at, spec: !!spec });
    return `<div class="vsince" data-since="${sinceReg.length - 1}"><span class="mut">Od tweeta: liczę…</span></div>`;
  }
  const sinceResolve = (el) => sinceReg[+el.dataset.since] || null;
  const MOM_HELP = '<details class="gloss momhelp"><summary>⚡ Jak czytać momentum?</summary><div>„Wcześnie” = tweet ma mniej niż 2 h, „W trakcie” = 2–12 h, „Późno” = 12–48 h, „Bardzo późno” = ponad 2 dni. Wyświetlenia na godzinę liczymy z danych z chwili pobrania (snapshot X ok. 3× dziennie), więc to średnia, nie tempo na żywo. Jeśli coin już mocno urósł od tweeta, większa część ruchu mogła już być. To tylko podpowiedź, nie sygnał kupna.</div></details>';

  async function renderViral() {
    document.body.classList.remove('pulse-on');
    const body = $('#viralBody');
    if (!viral) {
      body.innerHTML = `<div class="loading"><div class="spin"></div>Ładuję Viral z X…</div>`;
      await loadViral();
    }
    const topics = viral.topics || [];
    const topicById = Object.fromEntries(topics.map((t) => [t.id, t]));
    // v8.3 quality pass: drop no-coin posts with low reach, very old items, and items whose coins already dumped
    const ageHof = (at) => (Date.now() - new Date(at).getTime()) / 3.6e6;
    const dumped = (coins, at) => {
      if (!coins.length || !(ageHof(at) >= 12)) return false;
      return coins.every((c) => { const L0 = liveCoin[snapCoinKey(c)]; return L0 && ((L0.change24 != null && L0.change24 <= -50) || (L0.liq != null && L0.liq < 3000)); });
    };
    const postCoins = (p) => { const t = p.topic_id && topicById[p.topic_id]; const kind = p.coin_match || ((t && (t.coins || []).length) ? 'speculative' : 'none'); return { kind, coins: kind === 'named' ? p.coins || [] : kind === 'speculative' ? (p.spec_coins && p.spec_coins.length ? p.spec_coins : (t && t.coins) || []).slice(0, 3) : [] }; };
    const qDrop = { posts: 0, traders: 0 };
    const posts = (viral.posts || []).filter((p) => {
      const at = p.posted_at || p.created_at, views = (p.metrics && p.metrics.views) || 0, { kind, coins } = postCoins(p);
      const ok = ageHof(at) <= 72 && (kind === 'named' ? !dumped(coins, at) : kind === 'speculative' ? views >= 300000 && !dumped(coins, at) : views >= 1000000);
      if (!ok) qDrop.posts++;
      return ok;
    }).sort((a, b) => (postCoins(b).kind === 'named') - (postCoins(a).kind === 'named') || (b.metrics?.views || b.metrics?.likes || 0) - (a.metrics?.views || a.metrics?.likes || 0));
    const tweets = (viral.trader_tweets || []).filter((t) => { const at = t.posted_at || t.created_at; const ok = ageHof(at) <= 7 * 24 && !dumped(t.coins || [], at); if (!ok) qDrop.traders++; return ok; })
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    const qNote = (n) => (n ? `<div class="qhide mut" translate="no">✨ ${window.KyvoI18n && window.KyvoI18n.isEn() ? `Hidden ${n} low-signal items (no coin and low reach, too old, or the coin already dumped).` : `Ukryto ${n} słabych pozycji (bez coina i mały zasięg, za stare albo coin już spadł).`}</div>` : '');
    const tabs = [['topics', 'Tematy → coiny', topics.length], ['traders', 'Tweety traderów', tweets.length], ['posts', 'Ważne posty', posts.length]];
    if (!tabs.some((t) => t[0] === viralTab)) viralTab = 'topics';
    body.innerHTML = `
      <div class="h">Viral z X <span class="badge live" id="viralStamp">aktualizacja: ${esc(stampLabel(viral.updated_at))}</span></div>
      <div class="sub">Prawdziwe posty z X, odświeżane kilka razy dziennie (nie na żywo) · ceny coinów na żywo z DexScreener</div>
      ${staleHtml(viral.updated_at, 12, 'dane z X')}
      <div class="vtabs" role="tablist">${tabs.map(([id, lb, n]) => `<button type="button" role="tab" data-vt="${id}" class="${id === viralTab ? 'on' : ''}">${lb} <span class="vcount">${n}</span></button>`).join('')}</div>
      <div id="vPane"></div>
      <div class="mut" style="font-size:11px;margin-top:10px;line-height:1.45">Pokazujemy tylko coiny, które naprawdę istnieją na DexScreener (adres z tweeta albo jednoznaczny $ticker z płynnością i wolumenem). Ten sam ticker może mieć kopie — zawsze sprawdź adres. To nie jest porada finansowa.</div>`;
    const pane = $('#vPane');
    const draw = () => {
      sinceReg = [];
      if (viralTab === 'topics') {
        const postByUrl = Object.fromEntries(posts.map((p) => [p.url, p]));
        pane.innerHTML = topics.length ? MOM_HELP + topics.map((t) => {
          const src = t.source_post && postByUrl[t.source_post];
          const named = src && src.coin_match === 'named';
          const coins = named ? src.coins || [] : (t.coins || []).slice(0, 3);
          const at = (src && (src.posted_at || src.created_at)) || t.source_posted_at;
          return `<div class="card vtopic" data-topic="${esc(t.id)}">
            <div class="vtopic-h"><b>${esc(vl(t, 'label'))}</b>${t.source_post ? `<a href="${esc(t.source_post)}" target="_blank" rel="noopener noreferrer" class="vx">𝕏 źródło ↗</a>` : ''}</div>
            <div class="mut vwhy">${esc(vl(t, 'why') || '')}</div>
            ${src ? `<div class="tm-src">${esc(src.author_name)} <span class="mut">@${esc(src.handle)}</span></div>${tweetMetaHtml(src)}` : at ? tweetMetaHtml({ created_at: at }) : ''}
            ${coins.length ? matchChipHtml(named ? 'named' : 'speculative') : ''}
            <div class="vcoins">${coins.length ? coins.map((c) => vCoinHtml(c) + (at ? sinceSlot(c, at, !named) : '')).join('') : '<div class="mut vlive" style="font-size:12px;padding:6px 0">Szukam coinów na żywo…</div>'}</div>
          </div>`;
        }).join('') : '<div class="empty">Brak tematów w ostatniej aktualizacji.</div>';
        // topics without snapshot coins: live fuzzy match (existing engine)
        topics.filter((t) => !(t.coins || []).length).forEach(async (t) => {
          let m = [];
          try { m = await matchTopicToCoins(t); } catch (e) {}
          const box = pane.querySelector(`.vtopic[data-topic="${CSS.escape(t.id)}"] .vcoins`);
          if (!box) return;
          box.innerHTML = m.length
            ? m.slice(0, 4).map(({ c }) => vCoinHtml({ chain: c.chainId, address: c.address, symbol: c.symbol, name: c.name, image: c.image, mcap: c.mcap, change_h24: c.change && c.change.h24, kyvo: true })).join('')
            : '<div class="mut" style="font-size:12px;padding:6px 0">Brak pasującego coina z płynnością</div>';
        });
      } else if (viralTab === 'traders') {
        pane.innerHTML = tweets.length ? tweets.map((t, ti) => {
          const m = t.metrics || {};
          const prof = t.wallet_id ? `<a class="vbtn" href="#trader/${encodeURIComponent(t.wallet_id)}">Profil w Rankingu</a>` : '';
          return `<div class="card post vtweet">
            <div class="meta">${imgTag(t.avatar, 'av', 36)}
              <div style="flex:1;min-width:0"><b style="font-size:13.5px">${esc(t.author_name)} <span class="mut">@${esc(t.handle)}</span> ${roleBadge(t.role)}</b>
              ${t.is_reply ? '<div class="mut" style="font-size:11px">odpowiedź</div>' : ''}</div>
              <a href="${esc(t.url)}" target="_blank" rel="noopener noreferrer" class="vx" aria-label="Otwórz na X">𝕏</a></div>
            ${tweetMetaHtml(t)}
            <div class="txt vq${String(t.text || '').length > 190 ? ' long' : ''}">${tweetText(t.text)}</div>
            ${(t.coins || []).length ? matchChipHtml('named') : ''}
            <div class="vcoins vcoins-t">${(t.coins || []).map((c) => vCoinHtml(c) + sinceSlot(c, t.posted_at || t.created_at, false)).join('')}</div>
            <div class="vfoot"><a href="${esc(t.url)}" target="_blank" rel="noopener noreferrer">Tweet na X ↗</a>${prof}</div>
          </div>`;
        }).join('') : '<div class="empty">W tym snapshocie nikt ze śledzonych traderów nie wspomniał coina, który da się jednoznacznie znaleźć.</div>';
        pane.insertAdjacentHTML('afterbegin', MOM_HELP + qNote(qDrop.traders) + `<div class="mut" style="font-size:11.5px;margin:0 2px 8px">Śledzimy ${esc(String((viral.tracked_accounts || []).length || 17))} publicznych kont (traderzy z Rankingu + znani KOL-e). Z tweeta wyciągamy adres kontraktu albo $ticker i od razu pokazujemy coin.</div>`);
      } else {
        pane.innerHTML = MOM_HELP + qNote(qDrop.posts) + (posts.length ? '' : `<div class="empty">${window.KyvoI18n && window.KyvoI18n.isEn() ? 'No high-signal posts right now.' : 'Teraz brak mocnych postów.'}</div>`) + posts.map((p) => {
          const t = p.topic_id && topicById[p.topic_id];
          const kind = p.coin_match || ((t && (t.coins || []).length) ? 'speculative' : 'none');
          const coins = kind === 'named' ? p.coins || [] : kind === 'speculative' ? (p.spec_coins && p.spec_coins.length ? p.spec_coins : (t && t.coins) || []).slice(0, 3) : [];
          const at = p.posted_at || p.created_at;
          return `<div class="card post">
            <div class="meta">${imgTag(p.avatar, 'av', 36)}
              <div style="flex:1;min-width:0"><b style="font-size:13.5px">${esc(p.author_name)} <span class="mut">@${esc(p.handle)}</span></b></div>
              <a href="${esc(p.url)}" target="_blank" rel="noopener noreferrer" class="vx">𝕏</a></div>
            ${tweetMetaHtml(p)}
            <div class="txt">${tweetText(p.text)}</div>
            ${coins.length ? `${matchChipHtml(kind)}${t && kind === 'speculative' ? `<div class="vsub">Coiny do tematu „${esc(vl(t, 'label'))}”</div>` : ''}<div class="vcoins">${coins.map((c) => vCoinHtml(c, { size: 28 }) + sinceSlot(c, at, kind !== 'named')).join('')}</div>` : '<div class="mut" style="font-size:12px;margin-top:6px">Tweet nie podaje coina i nie znaleźliśmy pasującego coina z płynnością.</div>'}
            <div style="margin-top:8px"><a href="${esc(p.url)}" target="_blank" rel="noopener noreferrer" style="font-size:12px">Oryginał na X ↗</a></div>
          </div>`;
        }).join('');
      }
    };
    body.querySelectorAll('.vtabs [data-vt]').forEach((b) => (b.onclick = () => {
      viralTab = b.dataset.vt; localStorage.setItem('kyvo_viral_tab', viralTab);
      body.querySelectorAll('.vtabs [data-vt]').forEach((x) => x.classList.toggle('on', x === b));
      draw(); refreshViralCoins(pane).then(sinceFill);
    }));
    const sinceFill = () => { if (window.KyvoInsights) window.KyvoInsights.fillTweetSince(pane, sinceResolve, liveCoin); };
    draw();
    refreshViralCoins(pane).then(() => {
      if (!pane.isConnected) return;
      if (!renderViral.liveDone) { renderViral.liveDone = true; renderViral(); return; } // re-filter with live prices (dumped coins)
      sinceFill();
    });
  }

  /* ---------------- Ranking (Kolscan-style) + trader profile ---------------- */
  let rankPeriod = localStorage.getItem('kyvo_rank_period') || '7d';
  function pnlOf(L, per) {
    const v = L && L.stats && L.stats[per] && L.stats[per].realized_pnl_usd;
    return v == null || !isFinite(v) ? null : v;
  }
  function pnlHtml(v, tip) {
    if (v == null) return `<span class="mut" title="${esc(tip || 'Brak sprzedaży z dopasowanym kosztem zakupu w tym okresie')}">—</span>`;
    return `<b class="${v >= 0 ? 'up' : 'dn'}">${v >= 0 ? '+' : ''}${fmtUsd(v)}</b>`;
  }
  function avatarHtml(L, size) {
    size = size || 34;
    return L.avatar
      ? `<img class="av" src="${esc(L.avatar)}" width="${size}" height="${size}" style="width:${size}px;height:${size}px" alt="" loading="lazy" onerror="this.style.display='none'">`
      : `<div class="av avl" style="width:${size}px;height:${size}px">${esc((L.name || '?')[0].toUpperCase())}</div>`;
  }
  function sortedLeaders(per) {
    const leaders = ((leaderboard && leaderboard.leaders) || []).slice();
    leaders.sort((a, b) => {
      const pa = pnlOf(a, per), pb = pnlOf(b, per);
      if (pa == null && pb == null) return (pnlOf(b, '30d') ?? -1e18) - (pnlOf(a, '30d') ?? -1e18);
      if (pa == null) return 1;
      if (pb == null) return -1;
      return pb - pa;
    });
    return leaders;
  }
  function mvHtml(x, per) {
    // v8.4: rank change vs the previous daily refresh (▲ up / ▼ down / NEW)
    const r = x.rank && x.rank[per], p = x.rank_prev && x.rank_prev[per];
    if (!r || !leaderboard.prev_at) return '';
    if (!p) return '<span class="rk-mv new" title="Nowy w top 50">NEW</span>';
    if (p === r) return '';
    return p > r ? `<span class="rk-mv up" title="Awans">▲${p - r}</span>` : `<span class="rk-mv dn" title="Spadek">▼${r - p}</span>`;
  }
  function renderRank() {
    document.body.classList.remove('pulse-on');
    const body = $('#rankBody');
    if (!leaderboard || !(leaderboard.leaders || []).length) {
      body.innerHTML = `<div class="h">Ranking</div><div class="empty">Ranking jest chwilowo niedostępny — spróbuj za kilka minut.</div>`;
      return;
    }
    const per = rankPeriod;
    // v8.3 quality pass: traders without a trade in the last 7 days go to a collapsed "inactive" section
    const lastT = (x) => Math.max(0, ...((x.recent_trades || []).map((t) => +t.t || 0)));
    const isActive = (x) => x.active === true || (x.active !== false && Date.now() / 1000 - lastT(x) < 7 * 86400);
    const ALL = sortedLeaders(per);
    const L = ALL.filter(isActive), INACT = ALL.filter((x) => !isActive(x));
    const withPnl = L.filter((x) => pnlOf(x, per) != null).length;
    const rowOf = (x, i) => {
      const st = (x.stats && x.stats[per]) || {};
      const wr = st.win_rate == null ? '—' : Math.round(st.win_rate * 100) + '%';
      const wl = st.trades ? `<span class="up">${st.wins}</span>/<span class="dn">${st.trades - st.wins}</span>` : '<span class="mut">—</span>';
      return `<div class="rk-row" data-trader="${esc(x.id)}" role="button" tabindex="0">
        <div class="rk-n ${i < 3 && pnlOf(x, per) != null ? 'top' + (i + 1) : ''}">${i + 1}</div>${mvHtml(x, per)}
        ${avatarHtml(x, 34)}
        <div class="rk-nm"><b>${esc(x.name)}</b>${x.handle ? `<small>@${esc(x.handle)}</small>` : `<small class="mut">${esc(shortCa(x.address))}</small>`}</div>
        <div class="rk-c rk-wl" title="Wygrane / przegrane (zamknięte pozycje)">${wl}</div>
        <div class="rk-c rk-wr" title="Win rate">${wr}</div>
        <div class="rk-c rk-tr" title="Zamknięte trade'y">${st.trades || 0}</div>
        <div class="rk-c rk-pnl">${pnlHtml(pnlOf(x, per), st.note)}</div>
        ${x.handle ? `<a class="rk-x" href="${esc(x.x_url || 'https://x.com/' + x.handle)}" target="_blank" rel="noopener" title="Obserwuj na X" data-noop="1">𝕏</a>` : '<span class="rk-x off"></span>'}
      </div>`;
    };
    const rows = L.map(rowOf).join('');
    const inactHtml = INACT.length ? `<details class="card rk" style="margin-top:8px"><summary class="mut" style="font-size:12px;padding:6px 4px;cursor:pointer">Nieaktywni (brak transakcji od 7 dni): ${INACT.length}</summary>${INACT.map((x, i) => rowOf(x, L.length + i)).join('')}</details>` : '';
    body.innerHTML = `
      <div class="h">Ranking traderów <span class="badge live">on-chain</span></div>
      ${leaderboard.version >= 2
        ? `<div class="sub"><span>Zaktualizowano:</span> <b>${esc(new Date(leaderboard.updated_at).toLocaleString(document.documentElement.lang === 'en' ? 'en-GB' : 'pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }))}</b> · <span>Odświeżane automatycznie co 6 godzin</span> · <span>Solana, źródło:</span> <a href="${esc(leaderboard.source_url || 'https://kolscan.io/leaderboard')}" target="_blank" rel="noopener">kolscan.io</a></div>`
        : `<div class="sub">Zrealizowany PnL z publicznych transakcji Solany · aktualizacja: ${esc(stampLabel(leaderboard.updated_at))} · PnL dla ${withPnl}/${L.length} aktywnych portfeli w tym okresie</div>`}
      ${staleHtml(leaderboard.updated_at, 36, 'dane rankingu')}
      <div class="rk-per" id="rankPer">${['1d', '7d', '30d'].map((p) => `<button type="button" data-per="${p}" class="${p === per ? 'on' : ''}">${p === '1d' ? 'Dzień' : p === '7d' ? 'Tydzień' : 'Miesiąc'}</button>`).join('')}</div>
      <div class="card rk">
        <div class="rk-row rk-head"><div class="rk-n">#</div><div style="width:34px"></div><div class="rk-nm">Trader</div><div class="rk-c rk-wl">W/L</div><div class="rk-c rk-wr">Win</div><div class="rk-c rk-tr">Trade'y</div><div class="rk-c rk-pnl">PnL</div><span class="rk-x off"></span></div>
        ${rows}
      </div>
      ${inactHtml}
      ${leaderboard.version >= 2
        ? `<div class="mut" style="font-size:11px;margin:6px 2px;line-height:1.45">Top 50 traderów Solany w każdym okresie (Dzień / Tydzień / Miesiąc) z publicznego rankingu. „—” = poza top 50 w tym okresie. Zysk w SOL przeliczony na $ po bieżącym kursie. BSC i Robinhood Chain: brak darmowego publicznego rankingu, dodamy gdy będzie źródło. Wyniki przybliżone · to nie jest porada finansowa.</div>`
        : '<div class="mut" style="font-size:11px;margin:6px 2px;line-height:1.45">„—” = brak sprzedaży z dopasowanym zakupem w tym okresie (np. kupił wcześniej niż obejmuje nasze okno). Kwoty w SOL przeliczane po historycznym kursie SOL/USD. Wyniki przybliżone · to nie jest porada finansowa.</div>'}`;
    $$('#rankPer [data-per]').forEach((b) => b.addEventListener('click', () => {
      rankPeriod = b.dataset.per;
      localStorage.setItem('kyvo_rank_period', rankPeriod);
      renderRank();
    }));
    $$('[data-trader]', body).forEach((el) => {
      const go = (e) => {
        if (e.target.closest('[data-noop]')) return;
        location.hash = 'trader/' + encodeURIComponent(el.dataset.trader);
      };
      el.addEventListener('click', go);
      el.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(e); });
    });
  }

  function renderTrader(id) {
    document.body.classList.remove('pulse-on');
    const body = $('#traderBody');
    const L = ((leaderboard && leaderboard.leaders) || []).find((x) => x.id === id || x.address === id);
    if (!L) {
      body.innerHTML = `<div class="err">Nie znaleziono tradera.<div class="back" id="trBackF">‹ Ranking</div></div>`;
      $('#trBackF').onclick = () => setView('rank');
      return;
    }
    window.KyvoProfile.renderTrader(body, L, leaderboard);
  }

  function renderProfil() {
    document.body.classList.remove('pulse-on');
    if (window.KyvoAuth) window.KyvoAuth.renderBar($('#profilTop'));
    window.KyvoProfile.renderOwn($('#profilBody'));
    $('#profilLinks').innerHTML = `<div class="more-grid" style="margin-top:6px">
        <a class="more-tile hl" href="#premium"><b>✦ Kyvo Premium</b><small>Cena startowa · wkrótce</small></a>
        <a class="more-tile" href="#help"><b>❓ Jak korzystać</b><small>FAQ i wprowadzenie</small></a>
        <a class="more-tile" href="#more"><b>⋯ Więcej</b><small>Ustawienia, regulamin, prywatność</small></a>
        <a class="more-tile" href="#kontakt"><b>💬 Kontakt</b><small>Discord</small></a>
      </div>
      <div class="card" style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:10px"><b style="font-size:13px">Język / Language</b>${window.KyvoI18n ? window.KyvoI18n.toggleHtml() : ''}</div>`;
  }
  window.__kyvoRerenderProfil = () => { if (view === 'profil') renderProfil(); };
  window.__kyvoToast = toast;

  function renderMore() {
    document.body.classList.remove('pulse-on');
    const S = window.KyvoAuth && window.KyvoAuth.session();
    const tile = (href, t, d, hl) => `<a class="more-tile${hl ? ' hl' : ''}" href="${href}"><b>${t}</b><small>${d}</small></a>`;
    $('#moreBody').innerHTML = `
      <div class="h">Więcej</div>
      <div class="more-grid">
        ${tile('#premium', '✦ Kyvo Premium', 'Cena startowa · zobacz, co planujemy', true)}
        ${tile('#login', S ? '👤 Konto' : '🔑 Zaloguj się', S ? 'Jesteś zalogowany' : 'Portfel, Google, e-mail — albo bez logowania')}
        ${tile('#help', '❓ Jak korzystać', 'Zakładki, filtry, PnL, FAQ')}
        ${tile('#watch', '⭐ Watchlista i alerty', 'Obserwowane coiny, alerty MC i % (gdy Kyvo jest otwarte)')}
        ${tile('#rank', '🏆 Ranking traderów', 'PnL i win rate publicznych portfeli')}
        ${tile('#kontakt', '💬 Kontakt', 'Discord — pogadaj, pomóż, współpracuj')}
        ${tile('#legal/ryzyko', '⚠️ Ryzyko', 'Przeczytaj, zanim cokolwiek kupisz')}
      </div>
      <div class="card" style="padding:4px 12px">
        <div class="lg-links" style="margin:10px 0">
          <a href="#legal/regulamin">Regulamin</a><a href="#legal/prywatnosc">Polityka prywatności</a><a href="#legal/zrodla">Źródła danych i licencje</a>
        </div>
      </div>
      <div class="card">
        <div class="h" style="font-size:13px;margin:0 0 6px">Język / Language</div>
        ${window.KyvoI18n ? window.KyvoI18n.toggleHtml('lang-big') : ''}
      </div>
      ${window.KyvoNotify ? window.KyvoNotify.settingsHtml() : ''}
      <div class="card">
        <div class="h" style="font-size:13px;margin:0 0 6px">Ustawienia</div>
        <div class="pf-actions" style="margin-top:0">
          <button type="button" class="pf-btn" id="moreTour">▶ Pokaż wprowadzenie</button>
          <button type="button" class="pf-btn" id="moreClear">🗑 Wyczyść dane Kyvo</button>
        </div>
        <div class="mut" style="font-size:11.5px;margin-top:8px;line-height:1.45">Wszystkie Twoje dane (portfele, nick, filtry, sesja) są tylko w tej przeglądarce. „Wyczyść dane Kyvo” usuwa je całkowicie.</div>
      </div>
      <div class="card"><div class="h" style="font-size:13px;margin:0 0 4px">O Kyvo</div>
        <div style="font-size:13px;color:#ccc;line-height:1.5">Kyvo — smart money i viralowe memecoiny w jednym miejscu. Live Pulse dla Solany, BSC i Robinhood Chain, wykresy od 1s, ranking traderów on-chain, Viral z X i Twój Profil z PnL. Ranking i smart money odświeżamy kilka razy dziennie z publicznych danych blockchain, Viral z X — kilka razy dziennie.</div></div>`;
    if (window.KyvoNotify) window.KyvoNotify.wireSettings($('#moreBody'), () => renderMore());
    $('#moreTour').onclick = () => window.KyvoLaunch && window.KyvoLaunch.openOnboard();
    $('#moreClear').onclick = async () => { if (window.KyvoLaunch && (await window.KyvoLaunch.clearData())) { toast('Dane Kyvo usunięte'); setTimeout(() => location.reload(), 600); } };
  }

  function renderPage(kind, arg) {
    document.body.classList.remove('pulse-on');
    const L = window.KyvoLaunch, A = window.KyvoAuth;
    const ctx = { home: () => setView('pulse') };
    document.body.classList.toggle('chrome-off', kind === 'login');
    if (kind === 'help') L.renderHelp($('#helpBody'), ctx);
    else if (kind === 'legal') L.renderLegal($('#legalBody'), arg, ctx);
    else if (kind === 'premium') L.renderPremium($('#premiumBody'), ctx);
    else if (kind === 'kontakt') L.renderContact($('#kontaktBody'), ctx);
    else if (kind === 'login') A.renderLogin($('#loginBody'), {
      onDone: () => setView('profil'),
      onGuest: () => { document.body.classList.remove('chrome-off'); setView('pulse'); },
    });
    window.scrollTo(0, 0);
  }

  function show(which) {
    $$('.scr').forEach((s) => s.classList.remove('on'));
    const map = {
      pulse: 's-list', hot: 's-list', good: 's-list', new: 's-list', stretch: 's-list',
      migrated: 's-list', boosted: 's-list', search: 's-list', runner: 's-list', track: 's-list', viral: 's-viral', more: 's-more', coin: 's-coin',
      rank: 's-rank', trader: 's-trader', profil: 's-profil', watch: 's-watch',
      help: 's-help', legal: 's-legal', login: 's-login', premium: 's-premium', kontakt: 's-kontakt',
    };
    if (which !== 'login') document.body.classList.remove('chrome-off');
    $('#' + (map[which] || 's-list')).classList.add('on');
    $$('#seg button').forEach((b) => b.classList.toggle('on', b.dataset.view === (which === 'coin' ? view : which === 'trader' ? 'rank' : which === 'search' ? 'hot' : which)));
    const tabMap = { runner: 'hot', track: 'hot', pulse: 'hot', hot: 'hot', good: 'hot', new: 'hot', stretch: 'hot', migrated: 'hot', boosted: 'hot', search: 'search', viral: 'viral', watch: 'hot', more: 'profil', rank: 'rank', trader: 'rank', profil: 'profil', help: 'profil', legal: 'profil', login: 'profil', premium: 'profil', kontakt: 'profil' };
    $$('.tb button').forEach((b) => b.classList.toggle('on', b.dataset.tab === (tabMap[which] || 'hot')));
  }

  function setView(v, arg) {
    if (['help', 'legal', 'login', 'premium', 'kontakt'].includes(v)) {
      view = v;
      show(v);
      renderFilterPanel('more');
      renderPage(v, arg);
      const h = v === 'legal' ? 'legal/' + (arg || 'regulamin') : v;
      if (location.hash !== '#' + h) history.replaceState(null, '', '#' + h);
      return;
    }
    view = v;
    if (v === 'viral') {
      show('viral');
      renderFilterPanel('viral');
      renderViral();
      location.hash = 'viral';
      return;
    }
    if (v === 'profil') {
      show('profil');
      renderFilterPanel('more');
      renderProfil();
      location.hash = 'profil';
      return;
    }
    if (v === 'rank') {
      show('rank');
      renderFilterPanel('more');
      renderRank();
      location.hash = 'rank';
      return;
    }
    if (v === 'watch') {
      show('watch');
      renderFilterPanel('more');
      if (window.KyvoInsights) window.KyvoInsights.renderWatch($('#watchBody'));
      location.hash = 'watch';
      return;
    }
    if (v === 'more') {
      show('more');
      renderFilterPanel('more');
      renderMore();
      location.hash = 'more';
      return;
    }
    show(v);
    renderFilterPanel(v === 'search' ? 'hot' : v);

    if (v === 'pulse') {
      location.hash = 'pulse';
      if (isDesktopPulse()) renderPulseDesktop();
      else renderPulseMobile();
      return;
    }
    if (v === 'runner') {
      renderRunner();
      location.hash = 'runner';
      return;
    }
    if (v === 'track') {
      renderTrack();
      location.hash = 'track';
      return;
    }
    if (v === 'good') {
      const smNote = goodSortSmart ? 'sortowanie: konsensus smart money' : 'sortowanie: popularność × potencjał';
      const gl = listGood();
      const en = window.KyvoI18n && window.KyvoI18n.isEn();
      const fewNote = gl.length < 3 ? `<div class="card" style="font-size:12.5px;color:var(--warn)" translate="no">${en ? 'Few good setups right now' : 'Teraz mało dobrych setupów'} — ${en ? 'only coins that are popular right now, with a safe Kyvo Check, more buyers than sellers, healthy volume and a positive base estimate for 1h, 3h and 8h are shown. We don\u2019t fill the list with falling coins.' : 'pokazujemy tylko coiny popularne teraz, z bezpiecznym Kyvo Check, przewagą kupujących, zdrowym wolumenem i dodatnim szacunkiem bazowym na 1h, 3h i 8h. Nie dopychamy listy spadającymi coinami.'}</div>` : '';
      const pendNote = goodPending ? `<div class="mut" style="font-size:11.5px;margin:6px 2px" translate="no">⏳ ${en ? 'Checking contracts of ' + goodPending + ' more coins (RugCheck / GoPlus)…' : 'Sprawdzam kontrakty jeszcze ' + goodPending + ' coinów (RugCheck / GoPlus)…'}</div>` : '';
      renderList(gl, 'Good Coins', 'Popularne teraz + szansa na wzrost w 8h · ' + smNote, {
        filtTab: 'good',
        footnote: pendNote + (goodPending && gl.length < 3 ? '' : fewNote) + `<div class="mut" style="font-size:11px;margin:6px 2px" translate="no">${en ? 'Good Coins = popular right now × chance to rise in 8h, after safety filters. This is not a forecast or financial advice — memecoins can go to zero.' : 'Good Coins = popularne teraz × szansa na wzrost w 8h, po filtrach bezpieczeństwa. To nie prognoza ani porada finansowa — memecoiny mogą spaść do zera.'}</div>` + `<div class="filtbar" style="margin:8px 0"><button type="button" class="fbtn ${goodSortSmart ? 'on' : ''}" id="goodSmartSort">🧠 Konsensus SM</button>
          <span class="mut" style="font-size:11px">Ile publicznie znanych portfeli kupiło w 72h (i ilu już sprzedało) · odświeżane kilka razy dziennie</span></div>`,
      });
      const btn = $('#goodSmartSort');
      if (btn) btn.onclick = () => { goodSortSmart = !goodSortSmart; setView('good'); };
      location.hash = 'good';
      return;
    }
    if (v === 'new') {
      renderList(listNew('new'), 'New Pairs', newTip(), { filtTab: 'new', rowOpts: { showDex: true }, footnote: qualityNote('new') });
      location.hash = 'new';
      return;
    }
    if (v === 'stretch') {
      if (!chainSupportsStretch(activeChain)) {
        renderList([], 'Final Stretch', 'Niedostępne', { filtTab: 'stretch', hideNote: chainNote(activeChain) });
      } else {
        renderList(listStretch('stretch'), 'Final Stretch', stretchTip(), {
          filtTab: 'stretch',
          rowOpts: { showCurve: true },
          footnote: qualityNote('stretch') + '<div class="mut" style="font-size:11px;margin:6px 2px">* Procent krzywej to estymacja Kyvo</div>',
        });
      }
      location.hash = 'stretch';
      return;
    }
    if (v === 'migrated') {
      if (!chainSupportsMigrated(activeChain)) {
        renderList([], 'Migrated', 'Niedostępne', { filtTab: 'migrated', hideNote: chainNote(activeChain) });
      } else {
        renderList(listMigrated('migrated'), 'Migrated', migrTip(), { filtTab: 'migrated', rowOpts: { showDex: true }, footnote: qualityNote('migrated') });
      }
      location.hash = 'migrated';
      return;
    }
    if (v === 'boosted') {
      renderList(qualityFilter(listBoosted(), 'boosted'), 'Boosted', 'Płatne boosty na DexScreener (reklama, nie sygnał jakości)', { filtTab: 'boosted', footnote: qualityNote('boosted') });
      location.hash = 'boosted';
      return;
    }
    renderList(qualityFilter(listHot(), 'hot'), 'Hot · ' + (CHAIN_LABEL[activeChain] || ''), 'Nowe profile i boosty DexScreener · sortowanie po wolumenie 24h', { filtTab: 'hot', footnote: qualityNote('hot') });
    location.hash = 'hot';
  }

  async function runSearch(q) {
    view = 'search';
    show('search');
    renderFilterPanel('search');
    document.body.classList.remove('pulse-on');
    $('#pulseDesk').innerHTML = '';
    const body = $('#listBody');
    body.innerHTML = `<div class="loading"><div class="spin"></div>Szukam „${esc(q)}”…</div>`;
    location.hash = 'search/' + encodeURIComponent(q);
    const list = await searchDex(q);
    for (const c of list) byKey[keyOf(c)] = c;
    body.innerHTML = list.length
      ? `<div class="h">Wyniki <span class="badge live">LIVE</span> · ${esc(CHAIN_LABEL[activeChain])}</div>
         <div class="sub">Wyniki dla „${esc(q)}” (także literówki)</div>
         <div class="card" style="padding:4px 10px">${list.map((c) => coinRow(c)).join('')}</div>`
      : `<div class="empty">Nic nie znaleziono dla „${esc(q)}” (${esc(CHAIN_LABEL[activeChain])})</div>`;
    wireRows(body);
  }

  function routeFromHash() {
    const h = (location.hash || '#pulse').slice(1);
    let [a, b] = h.split('/');
    if (a === 'leaderboard') a = 'rank';
    if (a === 'coin' && b) {
      openCoin(decodeURIComponent(b));
      return;
    }
    if (a === 'trader' && b) {
      view = 'rank';
      show('trader');
      renderFilterPanel('more');
      renderTrader(decodeURIComponent(b));
      window.scrollTo(0, 0);
      return;
    }
    if (['help', 'legal', 'login', 'premium', 'kontakt'].includes(a)) {
      setView(a, b ? decodeURIComponent(b) : undefined);
      return;
    }
    if (a === 'search' && b) {
      $('#q').value = decodeURIComponent(b);
      runSearch(decodeURIComponent(b));
      return;
    }
    if (['pulse', 'hot', 'good', 'new', 'stretch', 'migrated', 'boosted', 'viral', 'more', 'rank', 'profil', 'watch', 'runner', 'track'].includes(a)) {
      setView(a);
      return;
    }
    setView('pulse');
  }

  let lastImgFill = 0;
  /* v8.4 anti-glitch: one refresh at a time; a failed refresh keeps the last good data (no error box / ERR flash
     when coins are already on screen); auto re-render keeps scroll position and opened ▾ panels. */
  let refreshBusy = false, refreshFails = 0;
  function keepUi(fn) {
    const y = window.scrollY;
    const open = new Set();
    document.querySelectorAll('#listBody details[open], #pulseDesk details[open]').forEach((d) => {
      const row = d.closest('[data-key]'); open.add((row ? row.getAttribute('data-key') : '') + '|' + (d.className || ''));
    });
    fn();
    if (open.size) document.querySelectorAll('#listBody details, #pulseDesk details').forEach((d) => {
      const row = d.closest('[data-key]'); if (open.has((row ? row.getAttribute('data-key') : '') + '|' + (d.className || ''))) d.open = true;
    });
    if (Math.abs(window.scrollY - y) > 2) window.scrollTo(0, y);
  }
  async function refresh(manual) {
    if (refreshBusy) return;
    refreshBusy = true;
    try { await refreshInner(manual); } catch (e) { console.warn('refresh', e); } finally { refreshBusy = false; }
  }
  async function refreshInner(manual) {
    const hadData = coins.length > 0;
    if (!hadData || manual) $('#livePill').textContent = '…';
    let ok = await loadLiveCoins();
    if (!ok && hadData) { refreshFails++; fetchErr = null; $('#livePill').textContent = refreshFails >= 3 ? 'ERR' : 'LIVE'; return; }
    if (ok) refreshFails = 0;
    $('#livePill').textContent = ok ? 'LIVE' : 'ERR';
    if (ok && window.KyvoNotify) { try { window.KyvoNotify.onGood(listGood()); } catch (e) {} }
    // v8.3: Runner notifications (all chains) + tab badge + track-record log
    if (ok && window.KyvoNotify && window.KyvoInsights) { try { window.KyvoNotify.onRunner(window.KyvoInsights.runnerList()); } catch (e) {} }
    if (ok) { try { updateRunnerBadge(); } catch (e) {} trackUpdate(); }
    if (['pulse', 'hot', 'good', 'new', 'stretch', 'migrated', 'boosted', 'runner'].includes(view)) {
      if (!document.hidden) keepUi(() => setView(view));
    } else if (view === 'coin' && selectedKey && byKey[selectedKey] && !document.hidden) keepUi(() => renderCoin(byKey[selectedKey]));
    updateClock();
    // v8.3: GeckoTerminal logo lookup for coins still without an image — at most every 2 min (shared GT rate limit)
    if (ok && Date.now() - lastImgFill > 120000) {
      lastImgFill = Date.now();
      try {
        const vc = [];
        if (viral) for (const grp of [viral.topics, viral.trader_tweets, viral.posts]) for (const t of grp || []) for (const x of (t.coins || []).concat(t.spec_coins || [])) vc.push({ chainId: x.chain, address: x.address, image: x.image, dexId: x.dex });
        fillMissingImages(listNew('new').slice(0, 40).concat(listGood().slice(0, 30), listMigrated('migrated').slice(0, 20), vc));
      } catch (e) {}
    }
  }
  function updateClock() {
    const el = $('#clock');
    if (!lastFetch) {
      el.textContent = '—';
      return;
    }
    const sec = Math.round((Date.now() - lastFetch) / 1000);
    el.textContent = sec < 5 ? 'teraz' : sec + 's temu';
  }

  function goCoin(key) {
    const h = 'coin/' + encodeURIComponent(key);
    if (location.hash === '#' + h) openCoin(key);
    else location.hash = h;
  }

  /* ---- Wire ---- */
  loadChain();
  loadFilters();
  for (const k of FILTER_TABS) {
    if (filters[k]) filters[k].chain = activeChain;
  }
  renderChainSwitcher();
  $$('#seg button').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
  $$('.tb button').forEach((b) =>
    b.addEventListener('click', () => {
      const t = b.dataset.tab;
      if (t === 'search') {
        $('#q').focus();
        return;
      }
      if (t === 'hot') setView('pulse');
      else setView(t);
    })
  );
  $('#filtToggle').addEventListener('click', () => {
    filtOpen = !filtOpen;
    renderFilterPanel(view === 'search' ? 'hot' : view === 'pulse' ? (isDesktopPulse() ? 'pulse' : mobilePulseTab === 'stretch' ? 'stretch' : mobilePulseTab === 'migrated' ? 'migrated' : 'new') : view);
  });
  let searchT;
  $('#q').addEventListener('input', () => {
    clearTimeout(searchT);
    const v = $('#q').value.trim();
    if (!v) {
      setView('pulse');
      return;
    }
    searchT = setTimeout(() => runSearch(v), 380);
  });
  $('#q').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      clearTimeout(searchT);
      const v = $('#q').value.trim();
      if (v) runSearch(v);
    }
  });
  window.addEventListener('hashchange', routeFromHash);
  window.addEventListener('resize', () => {
    if (view === 'pulse') setView('pulse');
  });

  function tabsFor(c) {
    const k = keyOf(c), out = [];
    const has = (l) => l.some((x) => keyOf(x) === k);
    try {
      if (has(listGood())) out.push('good');
      if (has(listNew('new'))) out.push('new');
      if (has(listStretch('stretch'))) out.push('stretch');
      if (has(listMigrated('migrated'))) out.push('migrated');
      if (has(listHot())) out.push('hot');
    } catch (e) {}
    return out;
  }
  function tweetsFor(c) {
    if (!viral) return [];
    return (viral.trader_tweets || []).filter((t) => (t.coins || []).some((x) => x.address === c.address));
  }
  function topicFor(c) {
    if (!viral) return null;
    return (viral.topics || []).find((t) => (t.coins || []).some((x) => x.address === c.address)) || null;
  }
  if (window.KyvoInsights) window.KyvoInsights.init({ vl, esc, fmtUsd, fmtPct, pctClass, toast, keyOf, getUniverse: allUniverse, consensus: consensusOf, tabsFor, tweetsFor, topicFor, imgTag, getViral: () => viral, boostRank, onShape: () => { clearTimeout(shapeT); shapeT = setTimeout(() => { if (view === 'runner') renderRunner(); }, 1500); } });
  if (window.KyvoProfile) window.KyvoProfile.init({ esc, fmtUsd, agoLabel, shortCa, toast });
  loadCache();
  // Ranking / trader / profil don't need live coins — route them as soon as the snapshot is in
  let earlyRouted = null;
  const pLb = loadLeaderboard().then(() => {
    const h = (location.hash || '').slice(1).split('/')[0];
    if (['rank', 'trader', 'profil', 'leaderboard'].includes(h)) { earlyRouted = location.hash; routeFromHash(); }
  });
  Promise.all([loadViral(), loadSmartMoney(), pLb, refresh()]).then(() => { if (location.hash !== earlyRouted) routeFromHash(); try { updateRunnerBadge(); } catch (e) {} });
  setInterval(() => refresh(), REFRESH_MS);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && lastFetch && ['pulse', 'hot', 'good', 'new', 'stretch', 'migrated', 'boosted', 'runner'].includes(view)) keepUi(() => setView(view)); });
  // v8.2: re-check the X snapshot every 10 min while Kyvo is open -> "new important tweet" notification
  setInterval(async () => {
    try {
      const d = await fetchJson('data/x_viral.json?t=' + Math.floor(Date.now() / 600000));
      if (d && d.updated_at && (!viral || d.updated_at !== viral.updated_at)) {
        viral = d;
        if (window.KyvoNotify) window.KyvoNotify.onViral(d);
        if (view === 'viral') renderViral();
      }
    } catch (e) {}
  }, 10 * 60e3);
  if (window.KyvoNotify) window.KyvoNotify.init({ toast, keyOf, fmtUsd });
  if (window.KyvoPush) window.KyvoPush.init();
  setInterval(updateClock, 1000);
  if ('serviceWorker' in navigator) {
    // v8.4: when push is enabled, keep OneSignal's registration (sw.js?push=1) instead of swapping back to plain sw.js
    const pushOn = !!(window.KYVO_PUSH_CONFIG && window.KYVO_PUSH_CONFIG.enabled);
    navigator.serviceWorker.getRegistration().then((r) => {
      const cur = r && (r.active || r.waiting || r.installing);
      if (pushOn && cur && /OneSignalSDK(Updater)?Worker\.js/.test(cur.scriptURL)) return; // OneSignal's registration (may carry ?appId=…)
      if (!pushOn && cur && /OneSignalSDK/.test(cur.scriptURL)) { r.unregister().then(() => navigator.serviceWorker.register('sw.js')); return; }
      return navigator.serviceWorker.register(pushOn ? 'OneSignalSDKWorker.js' : 'sw.js');
    }).catch(() => {});
  }
  if (window.KyvoAuth) window.KyvoAuth.onChange(() => { if (view === 'profil') renderProfil(); else if (view === 'more') renderMore(); });
  // first launch: onboarding cards → login screen (skippable: "Kontynuuj bez logowania")
  if (window.KyvoLaunch) {
    const offerLogin = () => { if (window.KyvoAuth && window.KyvoAuth.shouldOfferLogin()) setView('login'); };
    window.KyvoLaunch.maybeOnboard(offerLogin);
  }

  window.__KYVO__ = {
    MVP_MARKER,
    fmtUsd,
    fmtLiq,
    platformUrls,
    fuzzyScore,
    refresh,
    getCoins: () => coins,
    getNew: () => newPoolCoins,
    getChain: () => activeChain,
    setChain: setActiveChain,
    listNew,
    listStretch,
    listMigrated,
    listGood,
    smartBuysForMint,
    smConsensus,
    tabsFor,
    getSmartMoney: () => smartMoney,
    getLeaderboard: () => leaderboard,
    applyFilters,
    filters,
    DEFAULT_FILTERS,
  };
})();
