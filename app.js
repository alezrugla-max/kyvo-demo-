/* KYVO_LIVE_v8_1 — multi-chain Pulse + smart money + leaderboard + Viral z X + onboarding/legal/login. Not financial advice. */
(function () {
  'use strict';

  const DS = 'https://api.dexscreener.com';
  const GT = 'https://api.geckoterminal.com/api/v2';
  const CACHE_KEY = 'kyvo_coins_v7';
  const FILT_KEY = 'kyvo_filters_v7';
  const CHAIN_KEY = 'kyvo_chain_v7';
  const REFRESH_MS = 45_000;
  const FALLBACK_IMG = 'kyvo_mark.svg';
  const MVP_MARKER = 'KYVO_LIVE_v8_1';
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
      smartMoney = await fetchJson('data/smart_money.json?v=8.1');
      consCache = null;
    } catch (e) {
      smartMoney = { by_mint: {}, activity: [], updated_at: null };
    }
  }
  async function loadLeaderboard() {
    try {
      leaderboard = await fetchJson('data/leaderboard.json?v=8.1');
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
      out.FOMO = `https://fomo.family/coins/solana/${a}`;
      out.Axiom = `https://axiom.trade/t/${a}?chain=sol`;
      out.Photon = `https://photon-sol.tinyastro.io/en/lp/${a}`;
      out.GMGN = `https://gmgn.ai/sol/token/${a}`;
      out.Explorer = `https://solscan.io/token/${a}`;
    } else if (c === 'bsc') {
      out.FOMO = `https://fomo.family/coins/bsc/${a}`;
      out.GMGN = `https://gmgn.ai/bsc/token/${a}`;
      out.PancakeSwap = `https://pancakeswap.finance/swap?outputCurrency=${a}&chain=bsc`;
      out.Explorer = `https://bscscan.com/token/${a}`;
      // Axiom / Photon: Solana-only terminals — omitted
    } else if (c === 'robinhood') {
      out.FOMO = `https://fomo.family/coins/robinhood/${a}`;
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
    if (['pulse', 'hot', 'good', 'new', 'stretch', 'migrated', 'boosted'].includes(view)) setView(view);
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
    good: { mcapMin: '50000', mcapMax: '', liqMin: '20000', volMin: '25000', ageMaxH: '720', ageMinH: '2', chg5mMin: '', chg1hMin: '', buyRatioMin: '0.4', hasSocials: true, chain: 'solana' },
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
    const f = filters[tab] || {};
    const bits = [CHAIN_LABEL[activeChain] || activeChain];
    if (f.mcapMin) bits.push('MC≥' + fmtUsd(Number(f.mcapMin)));
    if (f.mcapMax) bits.push('MC≤' + fmtUsd(Number(f.mcapMax)));
    if (f.liqMin) bits.push('Liq≥' + fmtUsd(Number(f.liqMin)));
    if (f.volMin) bits.push('Vol≥' + fmtUsd(Number(f.volMin)));
    if (f.ageMaxH) bits.push('<' + f.ageMaxH + 'h');
    if (f.ageMinH) bits.push('>' + f.ageMinH + 'h');
    if (f.hasSocials) bits.push('socials');
    if (f.buyRatioMin) bits.push('buy≥' + Math.round(Number(f.buyRatioMin) * 100) + '%');
    return bits.join(' · ');
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
      image: info.imageUrl || (meta && meta.icon) || null,
      socials,
      websites,
      description: (meta && meta.description) || '',
      boost: (meta && (meta.totalAmount || meta.amount)) || 0,
      pairAddress: p.pairAddress || '',
      buysH1: buys,
      sellsH1: sells,
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
        const g = await fetchJson(GT + '/networks/' + net + '/new_pools?page=' + page);
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
      viral = await fetchJson('data/x_viral.json?v=8.1');
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
  function listNew(baseFiltTab) {
    const tab = baseFiltTab || 'new';
    let list = applyFilters(allUniverse().slice(), tab);
    list.sort((a, b) => (b.pairCreatedAt || 0) - (a.pairCreatedAt || 0));
    return list;
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
    return tight;
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
    return list;
  }
  function listGood() {
    let list = applyFilters(allUniverse(), 'good');
    if (goodSortSmart) {
      list.sort((a, b) => {
        const ca = consensusOf(a), cb = consensusOf(b);
        const sa = ca.buyers.length * 2 - ca.sellers.length;
        const sb = cb.buyers.length * 2 - cb.sellers.length;
        return sb - sa || (b.liquidity || 0) - (a.liquidity || 0);
      });
    } else {
      list.sort((a, b) => (b.liquidity || 0) - (a.liquidity || 0) || (b.volume.h24 || 0) - (a.volume.h24 || 0));
    }
    return list;
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
    return `<img class="${cls || 'tok'}" src="${esc(src || FALLBACK_IMG)}" width="${s}" height="${s}" alt="" loading="lazy" onerror="this.onerror=null;this.src='${FALLBACK_IMG}'">`;
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
      ${imgTag(c.image)}
      <div class="nm"><b>${star}${badge} ${esc(c.name)} <span class="mut" style="font-weight:600">$${esc(c.symbol)}</span></b>
        <small>MC ${fmtUsd(c.mcap)} · ${fmtLiq(c) === 'krzywa' ? 'Liq: krzywa' : 'Liq ' + fmtLiq(c)}${extra ? ' · ' + extra : ''}</small>
        ${rowTimeHtml(c, opts.listId)}</div>
      <div class="rt"><b class="${pctClass(ch)}">${fmtPct(ch)}</b>
        <small class="mut">Vol ${fmtUsd(c.volume.h24)}</small></div>
    </div>`;
  }

  function wireRows(root) {
    $$('[data-key]', root).forEach((el) => {
      const go = () => goCoin(el.getAttribute('data-key'));
      el.addEventListener('click', go);
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          go();
        }
      });
    });
  }

  function renderFilterPanel(tab) {
    const f = filters[tab] || DEFAULT_FILTERS.hot;
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
        <div class="ffield"><label>MC min ($)</label><input data-k="mcapMin" type="number" inputmode="decimal" value="${esc(f.mcapMin)}" placeholder="np. 10000"></div>
        <div class="ffield"><label>MC max ($)</label><input data-k="mcapMax" type="number" inputmode="decimal" value="${esc(f.mcapMax)}" placeholder="—"></div>
        <div class="ffield"><label>Liq min ($)</label><input data-k="liqMin" type="number" inputmode="decimal" value="${esc(f.liqMin)}" placeholder="—"></div>
        <div class="ffield"><label>Vol 24h min ($)</label><input data-k="volMin" type="number" inputmode="decimal" value="${esc(f.volMin)}" placeholder="—"></div>
        <div class="ffield"><label>Wiek max (h)</label><input data-k="ageMaxH" type="number" inputmode="decimal" value="${esc(f.ageMaxH)}" placeholder="—"></div>
        <div class="ffield"><label>Wiek min (h)</label><input data-k="ageMinH" type="number" inputmode="decimal" value="${esc(f.ageMinH)}" placeholder="—"></div>
        <div class="ffield"><label>Δ 5m min (%)</label><input data-k="chg5mMin" type="number" inputmode="decimal" value="${esc(f.chg5mMin)}" placeholder="—"></div>
        <div class="ffield"><label>Δ 1h min (%)</label><input data-k="chg1hMin" type="number" inputmode="decimal" value="${esc(f.chg1hMin)}" placeholder="—"></div>
        <div class="ffield"><label>Buy ratio 1h min (0–1)</label><input data-k="buyRatioMin" type="number" step="0.05" min="0" max="1" value="${esc(f.buyRatioMin)}" placeholder="np. 0.4"></div>
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
        else next[k] = el.value;
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
          ? `<div class="card" style="padding:4px 10px">${list.map((c) => coinRow(c, Object.assign({ listId: (opts.filtTab || view) + ':' + activeChain }, opts.rowOpts))).join('')}</div>`
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
    if (activeChain === 'bsc') return 'four.meme na krzywej · ≥55% krzywej (estymacja)*';
    if (activeChain === 'all') return 'pump.fun + four.meme · ≥55% krzywej (estymacja)*';
    return 'pump.fun na krzywej · ≥55% krzywej (estymacja)*';
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
        ${
          list.length
            ? list.map((c) => coinRow(c, Object.assign({ listId: listKey + ':' + activeChain }, rowOpts))).join('')
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
        footnote: '<div class="mut" style="font-size:11px;margin:6px 2px">* Krzywa ≈ MC / ~$69k (estymacja)</div>',
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
      });
    } else {
      renderList(listNew('new'), 'New Pairs', newTip(), {
        filtTab: 'new',
        swipeTabs: true,
        rowOpts: { showDex: true },
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
        ${imgTag(c.image, 'tok', 46)}
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
      ${window.KyvoInsights ? window.KyvoInsights.whyHtml(c) : ''}
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
  function snapCoinKey(c) { return coinKey(c.chain, c.address); }
  function vCoinHtml(c, opts) {
    opts = opts || {};
    const k = snapCoinKey(c);
    const L = liveCoin[k] || {};
    const mc = L.mcap != null ? L.mcap : c.mcap;
    const ch = L.change24 != null ? L.change24 : c.change_h24;
    const img = L.image || c.image;
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
  async function renderViral() {
    document.body.classList.remove('pulse-on');
    const body = $('#viralBody');
    if (!viral) {
      body.innerHTML = `<div class="loading"><div class="spin"></div>Ładuję Viral z X…</div>`;
      await loadViral();
    }
    const posts = (viral.posts || []).slice().sort((a, b) => (b.metrics?.likes || 0) - (a.metrics?.likes || 0));
    const topics = viral.topics || [];
    const tweets = (viral.trader_tweets || []).slice().sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    const topicById = Object.fromEntries(topics.map((t) => [t.id, t]));
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
      if (viralTab === 'topics') {
        pane.innerHTML = topics.length ? topics.map((t) => {
          const coins = t.coins || [];
          return `<div class="card vtopic" data-topic="${esc(t.id)}">
            <div class="vtopic-h"><b>${esc(vl(t, 'label'))}</b>${t.source_post ? `<a href="${esc(t.source_post)}" target="_blank" rel="noopener noreferrer" class="vx">𝕏 źródło ↗</a>` : ''}</div>
            <div class="mut vwhy">${esc(vl(t, 'why') || '')}</div>
            <div class="vcoins">${coins.length ? coins.map((c) => vCoinHtml(c)).join('') : '<div class="mut vlive" style="font-size:12px;padding:6px 0">Szukam coinów na żywo…</div>'}</div>
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
              <div class="mut" style="font-size:11px">${esc(timeAgo(t.created_at))}${t.is_reply ? ' · odpowiedź' : ''} · ♥ ${fmtInt(m.likes)} · ↻ ${fmtInt(m.reposts)}</div></div>
              <a href="${esc(t.url)}" target="_blank" rel="noopener noreferrer" class="vx" aria-label="Otwórz na X">𝕏</a></div>
            <div class="txt vq${String(t.text || '').length > 190 ? ' long' : ''}">${tweetText(t.text)}</div>
            <div class="vcoins vcoins-t">${(t.coins || []).map((c, ci) => vCoinHtml(c) + `<div class="vsince" data-since="${ti}:${ci}"><span class="mut">Od tweeta: liczę…</span></div>`).join('')}</div>
            <div class="vfoot"><a href="${esc(t.url)}" target="_blank" rel="noopener noreferrer">Tweet na X ↗</a>${prof}</div>
          </div>`;
        }).join('') : '<div class="empty">W tym snapshocie nikt ze śledzonych traderów nie wspomniał coina, który da się jednoznacznie znaleźć.</div>';
        pane.insertAdjacentHTML('afterbegin', `<div class="mut" style="font-size:11.5px;margin:0 2px 8px">Śledzimy ${esc(String((viral.tracked_accounts || []).length || 17))} publicznych kont (traderzy z Rankingu + znani KOL-e). Z tweeta wyciągamy adres kontraktu albo $ticker i od razu pokazujemy coin.</div>`);
      } else {
        pane.innerHTML = posts.map((p) => {
          const m = p.metrics || {};
          const t = p.topic_id && topicById[p.topic_id];
          const coins = (t && t.coins) || [];
          return `<div class="card post">
            <div class="meta">${imgTag(p.avatar, 'av', 36)}
              <div style="flex:1;min-width:0"><b style="font-size:13.5px">${esc(p.author_name)} <span class="mut">@${esc(p.handle)}</span></b>
              <div class="mut" style="font-size:11px">${esc(timeAgo(p.created_at))}</div></div>
              <a href="${esc(p.url)}" target="_blank" rel="noopener noreferrer" class="vx">𝕏</a></div>
            <div class="txt">${tweetText(p.text)}</div>
            <div class="eng">♥ ${fmtInt(m.likes)} · ↻ ${fmtInt(m.reposts)} · 💬 ${fmtInt(m.replies)}</div>
            ${coins.length ? `<div class="vsub">Coiny do tematu „${esc(vl(t, 'label'))}”</div><div class="vcoins">${coins.slice(0, 2).map((c) => vCoinHtml(c, { size: 28 })).join('')}</div>` : ''}
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
    const sinceFill = () => { if (viralTab === 'traders' && window.KyvoInsights) window.KyvoInsights.fillTweetSince(pane, tweets, liveCoin); };
    draw();
    refreshViralCoins(pane).then(sinceFill);
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
  function renderRank() {
    document.body.classList.remove('pulse-on');
    const body = $('#rankBody');
    if (!leaderboard || !(leaderboard.leaders || []).length) {
      body.innerHTML = `<div class="h">Ranking</div><div class="empty">Ranking jest chwilowo niedostępny — spróbuj za kilka minut.</div>`;
      return;
    }
    const per = rankPeriod;
    const L = sortedLeaders(per);
    const withPnl = L.filter((x) => pnlOf(x, per) != null).length;
    const rows = L.map((x, i) => {
      const st = (x.stats && x.stats[per]) || {};
      const wr = st.win_rate == null ? '—' : Math.round(st.win_rate * 100) + '%';
      const wl = st.trades ? `<span class="up">${st.wins}</span>/<span class="dn">${st.trades - st.wins}</span>` : '<span class="mut">—</span>';
      return `<div class="rk-row" data-trader="${esc(x.id)}" role="button" tabindex="0">
        <div class="rk-n ${i < 3 && pnlOf(x, per) != null ? 'top' + (i + 1) : ''}">${i + 1}</div>
        ${avatarHtml(x, 34)}
        <div class="rk-nm"><b>${esc(x.name)}</b>${x.handle ? `<small>@${esc(x.handle)}</small>` : `<small class="mut">${esc(shortCa(x.address))}</small>`}</div>
        <div class="rk-c rk-wl" title="Wygrane / przegrane (zamknięte pozycje)">${wl}</div>
        <div class="rk-c rk-wr" title="Win rate">${wr}</div>
        <div class="rk-c rk-tr" title="Zamknięte trade'y">${st.trades || 0}</div>
        <div class="rk-c rk-pnl">${pnlHtml(pnlOf(x, per), st.note)}</div>
        ${x.handle ? `<a class="rk-x" href="${esc(x.x_url || 'https://x.com/' + x.handle)}" target="_blank" rel="noopener" title="Obserwuj na X" data-noop="1">𝕏</a>` : '<span class="rk-x off"></span>'}
      </div>`;
    }).join('');
    body.innerHTML = `
      <div class="h">Ranking traderów <span class="badge live">on-chain</span></div>
      <div class="sub">Zrealizowany PnL z publicznych transakcji Solany · aktualizacja: ${esc(stampLabel(leaderboard.updated_at))} · PnL dla ${withPnl}/${L.length} portfeli w tym okresie</div>
      ${staleHtml(leaderboard.updated_at, 36, 'dane rankingu')}
      <div class="rk-per" id="rankPer">${['1d', '7d', '30d'].map((p) => `<button type="button" data-per="${p}" class="${p === per ? 'on' : ''}">${p === '1d' ? 'Dzień' : p === '7d' ? 'Tydzień' : 'Miesiąc'}</button>`).join('')}</div>
      <div class="card rk">
        <div class="rk-row rk-head"><div class="rk-n">#</div><div style="width:34px"></div><div class="rk-nm">Trader</div><div class="rk-c rk-wl">W/L</div><div class="rk-c rk-wr">Win</div><div class="rk-c rk-tr">Trade'y</div><div class="rk-c rk-pnl">PnL</div><span class="rk-x off"></span></div>
        ${rows}
      </div>
      <div class="mut" style="font-size:11px;margin:6px 2px;line-height:1.45">„—” = brak sprzedaży z dopasowanym zakupem w tym okresie (np. kupił wcześniej niż obejmuje nasze okno). Kwoty w SOL przeliczane po historycznym kursie SOL/USD. Wyniki przybliżone · to nie jest porada finansowa.</div>`;
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
      migrated: 's-list', boosted: 's-list', search: 's-list', viral: 's-viral', more: 's-more', coin: 's-coin',
      rank: 's-rank', trader: 's-trader', profil: 's-profil', watch: 's-watch',
      help: 's-help', legal: 's-legal', login: 's-login', premium: 's-premium', kontakt: 's-kontakt',
    };
    if (which !== 'login') document.body.classList.remove('chrome-off');
    $('#' + (map[which] || 's-list')).classList.add('on');
    $$('#seg button').forEach((b) => b.classList.toggle('on', b.dataset.view === (which === 'coin' ? view : which === 'trader' ? 'rank' : which === 'search' ? 'hot' : which)));
    const tabMap = { pulse: 'hot', hot: 'hot', good: 'hot', new: 'hot', stretch: 'hot', migrated: 'hot', boosted: 'hot', search: 'search', viral: 'viral', watch: 'hot', more: 'profil', rank: 'rank', trader: 'rank', profil: 'profil', help: 'profil', legal: 'profil', login: 'profil', premium: 'profil', kontakt: 'profil' };
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
    if (v === 'good') {
      const smNote = goodSortSmart ? 'sortowanie: konsensus smart money' : 'sortowanie: płynność / wolumen';
      renderList(listGood(), 'Good Coins', 'Wyselekcjonowane coiny · ' + smNote, {
        filtTab: 'good',
        footnote: `<div class="filtbar" style="margin:8px 0"><button type="button" class="fbtn ${goodSortSmart ? 'on' : ''}" id="goodSmartSort">🧠 Konsensus SM</button>
          <span class="mut" style="font-size:11px">Ile publicznie znanych portfeli kupiło w 72h (i ilu już sprzedało) · odświeżane kilka razy dziennie</span></div>`,
      });
      const btn = $('#goodSmartSort');
      if (btn) btn.onclick = () => { goodSortSmart = !goodSortSmart; setView('good'); };
      location.hash = 'good';
      return;
    }
    if (v === 'new') {
      renderList(listNew('new'), 'New Pairs', newTip(), { filtTab: 'new', rowOpts: { showDex: true } });
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
          footnote: '<div class="mut" style="font-size:11px;margin:6px 2px">* Procent krzywej to estymacja: MC / ~$69k</div>',
        });
      }
      location.hash = 'stretch';
      return;
    }
    if (v === 'migrated') {
      if (!chainSupportsMigrated(activeChain)) {
        renderList([], 'Migrated', 'Niedostępne', { filtTab: 'migrated', hideNote: chainNote(activeChain) });
      } else {
        renderList(listMigrated('migrated'), 'Migrated', migrTip(), { filtTab: 'migrated', rowOpts: { showDex: true } });
      }
      location.hash = 'migrated';
      return;
    }
    if (v === 'boosted') {
      renderList(listBoosted(), 'Boosted', 'Płatne boosty na DexScreener (reklama, nie sygnał jakości)', { filtTab: 'boosted' });
      location.hash = 'boosted';
      return;
    }
    renderList(listHot(), 'Hot · ' + (CHAIN_LABEL[activeChain] || ''), 'Nowe profile i boosty DexScreener · sortowanie po wolumenie 24h', { filtTab: 'hot' });
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
    if (['pulse', 'hot', 'good', 'new', 'stretch', 'migrated', 'boosted', 'viral', 'more', 'rank', 'profil', 'watch'].includes(a)) {
      setView(a);
      return;
    }
    setView('pulse');
  }

  async function refresh() {
    $('#livePill').textContent = '…';
    const ok = await loadLiveCoins();
    $('#livePill').textContent = ok ? 'LIVE' : 'ERR';
    if (['pulse', 'hot', 'good', 'new', 'stretch', 'migrated', 'boosted'].includes(view)) setView(view);
    else if (view === 'coin' && selectedKey && byKey[selectedKey]) renderCoin(byKey[selectedKey]);
    updateClock();
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
  if (window.KyvoInsights) window.KyvoInsights.init({ vl, esc, fmtUsd, fmtPct, pctClass, toast, keyOf, getUniverse: allUniverse, consensus: consensusOf, tabsFor, tweetsFor, topicFor });
  if (window.KyvoProfile) window.KyvoProfile.init({ esc, fmtUsd, agoLabel, shortCa, toast });
  loadCache();
  // Ranking / trader / profil don't need live coins — route them as soon as the snapshot is in
  let earlyRouted = null;
  const pLb = loadLeaderboard().then(() => {
    const h = (location.hash || '').slice(1).split('/')[0];
    if (['rank', 'trader', 'profil', 'leaderboard'].includes(h)) { earlyRouted = location.hash; routeFromHash(); }
  });
  Promise.all([loadViral(), loadSmartMoney(), pLb, refresh()]).then(() => { if (location.hash !== earlyRouted) routeFromHash(); });
  setInterval(() => refresh(), REFRESH_MS);
  setInterval(updateClock, 1000);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
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
