/* KYVO_MVP_LIVE_v5 — live DexScreener + Pulse columns + filters + Viral z X. Not financial advice. */
(function () {
  'use strict';

  const DS = 'https://api.dexscreener.com';
  const GT = 'https://api.geckoterminal.com/api/v2';
  const CACHE_KEY = 'kyvo_coins_v5';
  const FILT_KEY = 'kyvo_filters_v5';
  const REFRESH_MS = 45_000;
  const FALLBACK_IMG = 'kyvo_mark.svg';
  const MVP_MARKER = 'KYVO_MVP_LIVE_v5';
  const MVP_MARKER_PATCH = 'KYVO_MVP_LIVE_v5_1';
  /** Pump.fun graduation is commonly ~$69k MC on the bonding curve. Used only as an estimate. */
  const PUMP_GRAD_MCAP = 69000;
  const MIG_DEX = new Set(['pumpswap', 'raydium', 'meteora', 'orca', 'moonshot', 'fluxbeam']);

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
    const a = Math.abs(n);
    if (a >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (a >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
    if (a >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    if (a >= 1) return '$' + n.toFixed(2);
    if (a >= 0.0001) return '$' + n.toFixed(6);
    // avoid "$0.000" / ugly precision for dust
    if (a < 1e-10) return '—';
    const s = '$' + Number(n).toExponential(2);
    return s;
  }
  function fmtLiq(c) {
    const liq = c && c.liquidity;
    if (c && c.onCurve && (liq == null || !isFinite(liq) || liq <= 0)) return 'krzywa';
    if (liq == null || !isFinite(liq) || liq <= 0) return '—';
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
    return isFinite(t) ? ageFrom(t) + ' ago' : '';
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

  function platformUrls(addr, chain) {
    const a = encodeURIComponent(addr);
    const c = (chain || 'solana').toLowerCase();
    return {
      Axiom: `https://axiom.trade/t/${a}?chain=sol`,
      FOMO: `https://fomo.family/coins/${c}/${a}`,
      Photon: `https://photon-sol.tinyastro.io/en/lp/${a}`,
      GMGN: `https://gmgn.ai/sol/token/${a}`,
      DexScreener: `https://dexscreener.com/${c}/${a}`,
    };
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
      const raw = localStorage.getItem(FILT_KEY);
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
    const chain = (f.chain || 'solana').toLowerCase();

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
    const bits = [];
    if (f.mcapMin) bits.push('MC≥' + fmtUsd(Number(f.mcapMin)));
    if (f.mcapMax) bits.push('MC≤' + fmtUsd(Number(f.mcapMax)));
    if (f.liqMin) bits.push('Liq≥' + fmtUsd(Number(f.liqMin)));
    if (f.volMin) bits.push('Vol≥' + fmtUsd(Number(f.volMin)));
    if (f.ageMaxH) bits.push('<' + f.ageMaxH + 'h');
    if (f.ageMinH) bits.push('>' + f.ageMinH + 'h');
    if (f.hasSocials) bits.push('socials');
    if (f.buyRatioMin) bits.push('buy≥' + Math.round(Number(f.buyRatioMin) * 100) + '%');
    return bits.length ? bits.join(' · ') : 'bez dodatkowych filtrów';
  }

  /* ---- State ---- */
  let coins = [];
  let newPoolCoins = [];
  let byAddr = {};
  let viral = null;
  let view = 'pulse';
  let mobilePulseTab = 'new'; // new | stretch | migrated on iPhone
  let selectedAddr = null;
  let lastFetch = 0;
  let fetchErr = null;
  let sourceLabel = '';
  let filtOpen = false;

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
      sourceLabel = o.sourceLabel || 'cache';
      lastFetch = o.t || 0;
      return true;
    } catch (e) {
      return false;
    }
  }
  function indexAll() {
    byAddr = {};
    for (const c of coins.concat(newPoolCoins)) byAddr[c.address] = c;
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
    let curveEst = null;
    if (dexId === 'pumpfun' && mcap != null) {
      curveEst = Math.min(99.9, Math.max(0, (mcap / PUMP_GRAD_MCAP) * 100));
    }
    return {
      address: bt.address,
      name: bt.name || bt.symbol || 'Unknown',
      symbol: bt.symbol || '???',
      chainId: p.chainId || 'solana',
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
      onCurve: dexId === 'pumpfun',
      migrated: MIG_DEX.has(dexId),
    };
  }

  async function fetchJson(url) {
    const r = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }

  function pickBestPairs(pairs) {
    const best = {};
    for (const p of pairs || []) {
      if (!p || p.chainId !== 'solana' || !p.baseToken) continue;
      const a = p.baseToken.address;
      const liq = (p.liquidity && p.liquidity.usd) || 0;
      if (!best[a] || liq > ((best[a].liquidity && best[a].liquidity.usd) || 0)) best[a] = p;
    }
    return best;
  }

  /** Prefer keeping pumpfun pair when present (for Final Stretch), else highest liq. */
  function ingestPairs(pairs, metaByAddr, intoMap) {
    for (const p of pairs || []) {
      if (!p || p.chainId !== 'solana' || !p.baseToken) continue;
      const c = pairToCoin(p, metaByAddr && metaByAddr[p.baseToken.address]);
      if (!c) continue;
      const prev = intoMap[c.address];
      if (!prev) {
        intoMap[c.address] = c;
        continue;
      }
      // Prefer pumpfun for curve tracking; else higher liquidity
      if (c.onCurve && !prev.onCurve) intoMap[c.address] = c;
      else if (c.onCurve === prev.onCurve && (c.liquidity || 0) > (prev.liquidity || 0)) intoMap[c.address] = c;
      else if (!c.onCurve && !prev.onCurve && (c.liquidity || 0) > (prev.liquidity || 0)) intoMap[c.address] = c;
      // merge boost/meta
      if ((c.boost || 0) > (prev.boost || 0)) intoMap[c.address].boost = c.boost;
      if (!intoMap[c.address].image && c.image) intoMap[c.address].image = c.image;
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

  async function loadNewPoolsInto(intoMap) {
    const addrs = [];
    for (const page of [1, 2]) {
      try {
        const g = await fetchJson(GT + '/networks/solana/new_pools?page=' + page);
        for (const row of g.data || []) {
          const id =
            row.relationships &&
            row.relationships.base_token &&
            row.relationships.base_token.data &&
            row.relationships.base_token.data.id;
          if (id) addrs.push(String(id).replace(/^solana_/, ''));
        }
      } catch (e) {
        console.warn('new_pools page', page, e);
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
        if (!x || x.chainId !== 'solana' || !x.tokenAddress) continue;
        const a = x.tokenAddress;
        if (!metaByAddr[a]) {
          metaByAddr[a] = x;
          addrs.push(a);
        } else metaByAddr[a] = Object.assign({}, metaByAddr[a], x);
      }

      const into = {};
      await fetchTokenBatch(addrs.slice(0, 45), metaByAddr, into);

      // Search for pump.fun bonding-curve coins (Final Stretch)
      for (const q of ['pumpfun', 'pump', 'bonk', 'trump', 'pepe', 'ai agent', 'solana meme']) {
        try {
          const d = await fetchJson(DS + '/latest/dex/search?q=' + encodeURIComponent(q));
          ingestPairs((d.pairs || []).filter((p) => p.dexId === 'pumpfun' || MIG_DEX.has(p.dexId)), metaByAddr, into);
        } catch (e) {}
      }

      const newMap = {};
      await loadNewPoolsInto(newMap);
      // also merge new into main universe
      for (const [a, c] of Object.entries(newMap)) {
        if (!into[a]) into[a] = c;
      }

      coins = Object.values(into);
      coins.sort((a, b) => (b.volume.h24 || 0) - (a.volume.h24 || 0));
      newPoolCoins = Object.values(newMap);
      newPoolCoins.sort((a, b) => (b.pairCreatedAt || 0) - (a.pairCreatedAt || 0));
      indexAll();
      lastFetch = Date.now();
      sourceLabel = 'DexScreener + GeckoTerminal new';
      saveCache();
      return true;
    } catch (e1) {
      console.warn('primary load failed', e1);
      fetchErr = e1.message || 'Fetch failed';
      if (!coins.length && loadCache()) {
        fetchErr = 'Offline — cached data';
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
    for (const t of ['BONK', 'WIF', 'PEPE', 'POPCAT', 'PNUT', 'MOODENG', 'TRUMP', 'DOGE', 'SPX', 'FARTCOIN']) {
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
          if (!c || seen.has(c.address)) continue;
          seen.add(c.address);
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
          .map((c) => ({ c, s: fuzzyScore(query, c.name, c.symbol, c.address) }))
          .filter((x) => x.s >= 50)
          .sort((a, b) => b.s - a.s)
          .map((x) => x.c);
      }
      return list.slice(0, 40);
    } catch (e) {
      return allUniverse()
        .map((c) => ({ c, s: fuzzyScore(query, c.name, c.symbol, c.address) }))
        .filter((x) => x.s >= 50)
        .sort((a, b) => b.s - a.s)
        .map((x) => x.c);
    }
  }

  function allUniverse() {
    const m = {};
    for (const c of coins.concat(newPoolCoins)) m[c.address] = c;
    return Object.values(m);
  }

  async function loadViral() {
    try {
      viral = await fetchJson('data/x_viral.json?v=5');
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
      const seen = new Set(found.map((c) => c.address));
      for (const c of more) if (!seen.has(c.address)) found.push(c);
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
    let list = allUniverse().slice();
    // Prefer newest first among those passing filters
    list = applyFilters(list, tab);
    list.sort((a, b) => (b.pairCreatedAt || 0) - (a.pairCreatedAt || 0));
    return list;
  }
  function listStretch(baseFiltTab) {
    const tab = baseFiltTab || 'stretch';
    let list = allUniverse().filter((c) => c.onCurve && c.mcap != null);
    list = applyFilters(list, tab);
    // Final stretch: est. curve >= ~55% (labeled estimate; ~70% when market has them)
    let tight = list.filter((c) => c.curveEst != null && c.curveEst >= 55);
    if (tight.length < 3) {
      // Fallback: highest curve% pump.fun still on-curve (so column is never empty when data exists)
      tight = list.slice().sort((a, b) => (b.curveEst || 0) - (a.curveEst || 0)).filter((c) => (c.curveEst || 0) >= 50);
    }
    tight.sort((a, b) => (b.curveEst || 0) - (a.curveEst || 0) || (b.mcap || 0) - (a.mcap || 0));
    return tight;
  }
  function listMigrated(baseFiltTab) {
    const tab = baseFiltTab || 'migrated';
    let list = allUniverse().filter((c) => c.migrated);
    list = applyFilters(list, tab);
    list.sort((a, b) => (b.pairCreatedAt || 0) - (a.pairCreatedAt || 0));
    return list;
  }
  function listGood() {
    let list = applyFilters(allUniverse(), 'good');
    list.sort((a, b) => (b.liquidity || 0) - (a.liquidity || 0) || (b.volume.h24 || 0) - (a.volume.h24 || 0));
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

  function coinRow(c, opts) {
    opts = opts || {};
    const ch = c.change.h1 != null ? c.change.h1 : c.change.h24;
    let extra = '';
    if (opts.showCurve && c.curveEst != null) {
      extra = `<span class="est">~${c.curveEst.toFixed(0)}% curve*</span>`;
    }
    if (opts.showDex) {
      extra += (extra ? ' · ' : '') + `<span class="mut">${esc(c.dexId)}</span>`;
    }
    return `<div class="row" data-addr="${esc(c.address)}" role="button" tabindex="0">
      ${imgTag(c.image)}
      <div class="nm"><b>${esc(c.name)} <span class="mut" style="font-weight:600">$${esc(c.symbol)}</span></b>
        <small>MC ${fmtUsd(c.mcap)} · ${fmtLiq(c) === 'krzywa' ? 'Liq: krzywa' : 'Liq ' + fmtLiq(c)} · ${ageFrom(c.pairCreatedAt)}${extra ? ' · ' + extra : ''}</small></div>
      <div class="rt"><b class="${pctClass(ch)}">${fmtPct(ch)}</b>
        <small class="mut">Vol ${fmtUsd(c.volume.h24)}</small></div>
    </div>`;
  }

  function wireRows(root) {
    $$('[data-addr]', root).forEach((el) => {
      const go = () => goCoin(el.getAttribute('data-addr'));
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
        <div class="ffield"><label>Chain</label>
          <select data-k="chain">
            <option value="solana" ${f.chain === 'solana' ? 'selected' : ''}>solana</option>
            <option value="all" ${f.chain === 'all' ? 'selected' : ''}>all</option>
          </select>
        </div>
        <div class="ffield full"><label class="fcheck"><input data-k="hasSocials" type="checkbox" ${f.hasSocials ? 'checked' : ''}> Wymagaj socials / website</label></div>
      </div>
      <div class="factions">
        <button type="button" class="reset" id="filtReset">Reset</button>
        <button type="button" class="apply" id="filtApply">Zastosuj</button>
      </div>
      <div class="mut" style="font-size:11px;margin-top:8px">Filtry zapisują się lokalnie (localStorage). New Pairs domyślnie MC≥$10k. Final Stretch: pump.fun + est. krzywej ≥55%+ (MC / ~$69k).</div>`;
    $('#filtApply').onclick = () => {
      const next = Object.assign({}, filters[tab]);
      panel.querySelectorAll('[data-k]').forEach((el) => {
        const k = el.getAttribute('data-k');
        if (el.type === 'checkbox') next[k] = el.checked;
        else next[k] = el.value;
      });
      filters[tab] = next;
      saveFilters();
      filtOpen = false;
      setView(view);
    };
    $('#filtReset').onclick = () => {
      filters[tab] = Object.assign({}, DEFAULT_FILTERS[tab]);
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
            <button type="button" data-ptab="stretch" class="${mobilePulseTab === 'stretch' ? 'on' : ''}">Final Stretch</button>
            <button type="button" data-ptab="migrated" class="${mobilePulseTab === 'migrated' ? 'on' : ''}">Migrated</button>
          </div>`
        : '';
    body.innerHTML = `
      ${swipe}
      <div class="h">${esc(title)} <span class="badge live">LIVE</span> <span class="mut" style="font-weight:600;font-size:12px">${list.length}</span></div>
      <div class="sub">${esc(sub || '')} · ${esc(filtSummary(opts.filtTab || view))} · ${esc(sourceLabel || 'DexScreener')}</div>
      ${
        list.length
          ? `<div class="card" style="padding:4px 10px">${list.map((c) => coinRow(c, opts.rowOpts)).join('')}</div>`
          : `<div class="empty">Brak coinów dla tych filtrów.</div>`
      }
      ${opts.footnote || ''}
      <div class="foot">Dane: DexScreener · ${MVP_MARKER} · ${MVP_MARKER_PATCH}</div>`;
    wireRows(body);
    if (opts.swipeTabs) {
      $$('#pulseSwipe [data-ptab]').forEach((b) =>
        b.addEventListener('click', () => {
          mobilePulseTab = b.getAttribute('data-ptab');
          setView('pulse');
        })
      );
    }
  }

  function renderPulseDesktop() {
    const news = listNew('new').slice(0, 40);
    const stretch = listStretch('stretch').slice(0, 40);
    const migr = listMigrated('migrated').slice(0, 40);
    document.body.classList.add('pulse-on');
    $('#listBody').innerHTML = '';
    const desk = $('#pulseDesk');
    const col = (title, list, tip, rowOpts) => `
      <div class="pcol">
        <h3>${esc(title)} <span class="badge live">${list.length}</span></h3>
        <div class="mut" style="font-size:11px;margin-bottom:8px">${esc(tip)}</div>
        ${
          list.length
            ? list.map((c) => coinRow(c, rowOpts)).join('')
            : '<div class="empty" style="padding:16px 4px">Brak — zmień filtry lub poczekaj na refresh</div>'
        }
      </div>`;
    desk.innerHTML =
      col('New Pairs', news, 'Najnowsze Solana, filtr MC≥$10k (domyślnie)', { showDex: true }) +
      col('Final Stretch', stretch, 'pump.fun on-curve · est. ≥55% (MC/~$69k), inaczej top ≥50%*', { showCurve: true }) +
      col('Migrated', migr, 'Niedawno na PumpSwap / Raydium / Meteora…', { showDex: true }) +
      `<div class="foot" style="grid-column:1/-1">* Estymacja krzywej z MC vs ~$69k graduation — nie oficjalny bonding %. Dane publiczne DexScreener/Gecko. · ${MVP_MARKER} · ${MVP_MARKER_PATCH}</div>`;
    wireRows(desk);
  }

  function renderPulseMobile() {
    document.body.classList.remove('pulse-on');
    $('#pulseDesk').innerHTML = '';
    if (mobilePulseTab === 'stretch') {
      renderList(listStretch('stretch'), 'Final Stretch', 'pump.fun blisko graduation · est. krzywej ≥55%+', {
        filtTab: 'stretch',
        swipeTabs: true,
        rowOpts: { showCurve: true },
        footnote: '<div class="mut" style="font-size:11px;margin:6px 2px">* Krzywa ≈ MC / ~$69k (estymacja, nie oficjalne API pump.fun)</div>',
      });
    } else if (mobilePulseTab === 'migrated') {
      renderList(listMigrated('migrated'), 'Migrated', 'Niedawno z graduated DEX (PumpSwap/Raydium/Meteora…)', {
        filtTab: 'migrated',
        swipeTabs: true,
        rowOpts: { showDex: true },
      });
    } else {
      renderList(listNew('new'), 'New Pairs', 'Najnowsze pary Solana · domyślnie MC≥$10k', {
        filtTab: 'new',
        swipeTabs: true,
        rowOpts: { showDex: true },
      });
    }
  }

  function isDesktopPulse() {
    return window.matchMedia('(min-width:900px)').matches;
  }

  function openCoin(addr) {
    selectedAddr = addr;
    const c = byAddr[addr];
    const paint = (coin) => {
      show('coin');
      renderCoin(coin);
    };
    if (c) {
      paint(c);
      enrichCoin(addr).then((nc) => {
        if (nc && selectedAddr === addr) {
          byAddr[addr] = nc;
          paint(nc);
        }
      });
      return;
    }
    show('coin');
    $('#coinBody').innerHTML = `<div class="loading"><div class="spin"></div>Ładuję coin…</div>`;
    enrichCoin(addr).then((nc) => {
      if (!nc) {
        $('#coinBody').innerHTML = `<div class="err">Nie znaleziono.<div class="back" id="backFail">‹ Wróć</div></div>`;
        $('#backFail') && $('#backFail').addEventListener('click', () => history.back());
        return;
      }
      byAddr[addr] = nc;
      paint(nc);
    });
  }

  async function enrichCoin(addr) {
    try {
      const d = await fetchJson(DS + '/latest/dex/tokens/' + encodeURIComponent(addr));
      const map = {};
      ingestPairs(d.pairs || [], null, map);
      return map[addr] || null;
    } catch (e) {
      return byAddr[addr] || null;
    }
  }

  function renderCoin(c) {
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
    const curveLine =
      c.curveEst != null
        ? `<div class="card" style="margin-top:10px;font-size:13px">Est. bonding curve: <b>~${c.curveEst.toFixed(1)}%</b> <span class="est">(MC ${fmtUsd(c.mcap)} / ~$69k)*</span></div>`
        : '';

    $('#coinBody').innerHTML = `
      <div style="display:flex;align-items:center;gap:10px">
        <span class="back" id="coinBack">‹</span>
        ${imgTag(c.image, 'tok', 46)}
        <div style="min-width:0;flex:1">
          <b style="font-size:17px">${esc(c.name)}</b>
          <div class="mut" style="font-size:12px">$${esc(c.symbol)} · ${ageFrom(c.pairCreatedAt)} · ${esc(c.dexId)}</div>
        </div>
        <img src="kyvo_mark.svg" width="28" height="28" alt="">
      </div>
      <div style="margin-top:10px">
        <span class="ca">CA ${esc(shortCa(c.address))}
          <button class="copybtn" id="copyCa" type="button" aria-label="Copy">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ddd" stroke-width="2.4"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>
          </button>
        </span>
        <span class="badge live" style="margin-left:6px">LIVE</span>
        ${c.onCurve ? '<span class="badge demo" style="margin-left:4px">pump.fun</span>' : ''}
        ${c.migrated ? '<span class="badge live" style="margin-left:4px">migrated</span>' : ''}
      </div>
      <div style="margin-top:10px;font-size:12px;word-break:break-all" class="mut" id="fullCa">${esc(c.address)}</div>
      <div style="margin-top:12px">
        <b style="font-size:26px">${fmtUsd(c.mcap)}</b> <span class="mut">MC</span>
        <span class="${pctClass(c.change.h24)}" style="font-weight:700;margin-left:6px">${fmtPct(c.change.h24)} 24h</span>
      </div>
      ${curveLine}
      <div class="statg">
        <div class="st"><small>Price</small><b>${fmtUsd(c.priceUsd)}</b></div>
        <div class="st"><small>Liquidity</small><b>${fmtLiq(c)}</b></div>
        <div class="st"><small>FDV</small><b>${fmtUsd(c.fdv)}</b></div>
        <div class="st"><small>Vol 5m</small><b>${fmtUsd(c.volume.m5)}</b></div>
        <div class="st"><small>Vol 1h</small><b>${fmtUsd(c.volume.h1)}</b></div>
        <div class="st"><small>Vol 24h</small><b>${fmtUsd(c.volume.h24)}</b></div>
        <div class="st"><small>Δ 5m</small><b class="${pctClass(c.change.m5)}">${fmtPct(c.change.m5)}</b></div>
        <div class="st"><small>Δ 1h</small><b class="${pctClass(c.change.h1)}">${fmtPct(c.change.h1)}</b></div>
        <div class="st"><small>Buy 1h</small><b>${c.buyRatioH1 != null ? Math.round(c.buyRatioH1 * 100) + '%' : '—'}</b></div>
      </div>
      <div class="card" style="margin-top:10px"><div class="h" style="font-size:13px;margin:0 0 6px">Socials</div><div class="socials">${socials || '<span class="mut">Brak</span>'} ${webs}</div></div>
      <div class="plats">
        <a class="plat p0" href="${esc(urls.FOMO)}" target="_blank" rel="noopener noreferrer">FOMO</a>
        <a class="plat" href="${esc(urls.Axiom)}" target="_blank" rel="noopener noreferrer">Axiom</a>
        <a class="plat" href="${esc(urls.Photon)}" target="_blank" rel="noopener noreferrer">Photon</a>
        <a class="plat" href="${esc(urls.GMGN)}" target="_blank" rel="noopener noreferrer">GMGN</a>
      </div>
      <div style="margin-top:8px;text-align:center"><a href="${esc(urls.DexScreener)}" target="_blank" rel="noopener noreferrer" style="font-size:12px">DexScreener ↗</a></div>
      <div class="foot">To nie jest porada finansowa · ${MVP_MARKER} · ${MVP_MARKER_PATCH}</div>`;
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

  async function renderViral() {
    document.body.classList.remove('pulse-on');
    const body = $('#viralBody');
    if (!viral) {
      body.innerHTML = `<div class="loading"><div class="spin"></div>Ładuję Viral z X…</div>`;
      await loadViral();
    }
    const posts = (viral.posts || []).slice().sort((a, b) => (b.metrics?.likes || 0) - (a.metrics?.likes || 0));
    const topics = viral.topics || [];
    const updated = viral.updated_at_warsaw || viral.updated_at || '—';
    body.innerHTML = `
      <div class="h">Viral z X <span class="badge live">snapshot</span></div>
      <div class="sub">Prawdziwe posty · snapshot ${esc(updated)} (Europe/Warsaw)</div>
      <div class="card"><div class="h" style="font-size:13px">Tematy → coiny</div><div id="topicList"><div class="loading"><div class="spin"></div>Matchuję…</div></div></div>
      <div class="h">Ważne posty</div><div id="postList"></div>
      <div class="foot">${MVP_MARKER} · ${MVP_MARKER_PATCH}</div>`;
    $('#postList').innerHTML = posts
      .map((p) => {
        const m = p.metrics || {};
        return `<div class="card post">
          <div class="meta">${imgTag(p.avatar, 'av', 36)}
            <div style="flex:1;min-width:0"><b style="font-size:13.5px">${esc(p.author_name)} <span class="mut">@${esc(p.handle)}</span></b>
            <div class="mut" style="font-size:11px">${esc(timeAgo(p.created_at))}</div></div>
            <a href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">𝕏</a></div>
          <div class="txt">“${esc(p.text)}”</div>
          <div class="eng">♥ ${fmtInt(m.likes)} · ↻ ${fmtInt(m.reposts)} · 💬 ${fmtInt(m.replies)}</div>
          <div style="margin-top:8px"><a href="${esc(p.url)}" target="_blank" rel="noopener noreferrer" style="font-size:12px">Oryginał na X ↗</a></div>
        </div>`;
      })
      .join('');
    const topicList = $('#topicList');
    (async () => {
      const parts = [];
      for (const t of topics) {
        let matches = [];
        try {
          matches = await matchTopicToCoins(t);
        } catch (e) {}
        const coinsHtml = matches.length
          ? matches
              .map(
                ({ c, s }) =>
                  `<div class="row" data-addr="${esc(c.address)}" style="padding:6px 0">${imgTag(c.image, 'tok', 28)}
                  <div class="nm"><b style="font-size:12.5px">$${esc(c.symbol)} · ${esc(c.name)}</b><small>MC ${fmtUsd(c.mcap)}</small></div>
                  <span class="match">${Math.round(s)}%</span></div>`
              )
              .join('')
          : `<div class="mut" style="font-size:12px;padding:6px 0">Brak matcha</div>`;
        parts.push(`<div class="topic-block" style="margin-bottom:12px;border-bottom:1px solid #ffffff0a;padding-bottom:8px">
          <b style="font-size:13.5px">${esc(t.label)}</b>
          <div class="mut" style="font-size:11.5px">${esc(t.why || '')}</div>${coinsHtml}</div>`);
        topicList.innerHTML = parts.join('');
        wireRows(topicList);
      }
    })();
  }

  function renderMore() {
    document.body.classList.remove('pulse-on');
    $('#moreBody').innerHTML = `
      <div class="h">Więcej</div>
      <div class="card"><div class="h" style="font-size:13px">Leaderboard <span class="badge demo">Przykładowe dane</span></div>
        <div class="mut" style="font-size:13px">PnL traderów — jeszcze nie podpięte do real on-chain.</div></div>
      <div class="card"><div class="h" style="font-size:13px">Insider / fresh wallets <span class="badge demo">Przykładowe dane</span></div>
        <div class="mut" style="font-size:13px">Wymaga własnego indeksu — niedostępne.</div></div>
      <div class="card"><div class="h" style="font-size:13px">O Kyvo v5</div>
        <div style="font-size:13px;color:#ccc;line-height:1.45">
          <b>LIVE:</b> Pulse (New / Final Stretch / Migrated), Hot, Good, Boosted, filtry, Viral z X.<br>
          Final Stretch = dexId pumpfun + est. krzywej z MC/~$69k ≥55%+.<br>
          Migrated = pumpswap / raydium / meteora / orca (publiczne dexId z DexScreener).
        </div></div>
      <div class="foot">${MVP_MARKER} · ${MVP_MARKER_PATCH}</div>`;
  }

  function show(which) {
    $$('.scr').forEach((s) => s.classList.remove('on'));
    const map = {
      pulse: 's-list', hot: 's-list', good: 's-list', new: 's-list', stretch: 's-list',
      migrated: 's-list', boosted: 's-list', search: 's-list', viral: 's-viral', more: 's-more', coin: 's-coin',
    };
    $('#' + (map[which] || 's-list')).classList.add('on');
    $$('#seg button').forEach((b) => b.classList.toggle('on', b.dataset.view === (which === 'coin' ? view : which === 'search' ? 'hot' : which)));
    const tabMap = { pulse: 'hot', hot: 'hot', good: 'hot', new: 'hot', stretch: 'hot', migrated: 'hot', boosted: 'hot', search: 'search', viral: 'viral', more: 'more' };
    $$('.tb button').forEach((b) => b.classList.toggle('on', b.dataset.tab === (tabMap[which] || 'hot')));
  }

  function setView(v) {
    view = v;
    if (v === 'viral') {
      show('viral');
      renderFilterPanel('viral');
      renderViral();
      location.hash = 'viral';
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
      renderList(listGood(), 'Good Coins', 'Curated quality — liq/MC/vol/socials/buy ratio', { filtTab: 'good' });
      location.hash = 'good';
      return;
    }
    if (v === 'new') {
      renderList(listNew('new'), 'New Pairs', 'Najnowsze · domyślnie MC≥$10k', { filtTab: 'new', rowOpts: { showDex: true } });
      location.hash = 'new';
      return;
    }
    if (v === 'stretch') {
      renderList(listStretch('stretch'), 'Final Stretch', 'pump.fun on-curve · est. ≥55% (fallback top ≥50%)*', {
        filtTab: 'stretch',
        rowOpts: { showCurve: true },
        footnote: '<div class="mut" style="font-size:11px;margin:6px 2px">* Estymacja: MC / ~$69k graduation (nie oficjalny bonding %)</div>',
      });
      location.hash = 'stretch';
      return;
    }
    if (v === 'migrated') {
      renderList(listMigrated('migrated'), 'Migrated', 'PumpSwap / Raydium / Meteora…', { filtTab: 'migrated', rowOpts: { showDex: true } });
      location.hash = 'migrated';
      return;
    }
    if (v === 'boosted') {
      renderList(listBoosted(), 'Boosted', 'Top boosty DexScreener', { filtTab: 'boosted' });
      location.hash = 'boosted';
      return;
    }
    // hot
    renderList(listHot(), 'Hot Solana', 'Profile + boosty · vol 24h', { filtTab: 'hot' });
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
    for (const c of list) byAddr[c.address] = c;
    body.innerHTML = list.length
      ? `<div class="h">Wyniki <span class="badge live">LIVE</span></div>
         <div class="sub">Fuzzy „${esc(q)}”</div>
         <div class="card" style="padding:4px 10px">${list.map((c) => coinRow(c)).join('')}</div>`
      : `<div class="empty">Nic nie znaleziono dla „${esc(q)}”</div>`;
    wireRows(body);
  }

  function routeFromHash() {
    const h = (location.hash || '#pulse').slice(1);
    const [a, b] = h.split('/');
    if (a === 'coin' && b) {
      openCoin(decodeURIComponent(b));
      return;
    }
    if (a === 'search' && b) {
      $('#q').value = decodeURIComponent(b);
      runSearch(decodeURIComponent(b));
      return;
    }
    if (['pulse', 'hot', 'good', 'new', 'stretch', 'migrated', 'boosted', 'viral', 'more'].includes(a)) {
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
    else if (view === 'coin' && selectedAddr && byAddr[selectedAddr]) renderCoin(byAddr[selectedAddr]);
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

  function goCoin(addr) {
    const h = 'coin/' + encodeURIComponent(addr);
    if (location.hash === '#' + h) openCoin(addr);
    else location.hash = h;
  }

  /* ---- Wire ---- */
  loadFilters();
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

  loadCache();
  Promise.all([loadViral(), refresh()]).then(() => routeFromHash());
  setInterval(() => refresh(), REFRESH_MS);
  setInterval(updateClock, 1000);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

  window.__KYVO__ = {
    MVP_MARKER,
    MVP_MARKER_PATCH,
    fmtUsd,
    fmtLiq,
    platformUrls,
    fuzzyScore,
    refresh,
    getCoins: () => coins,
    getNew: () => newPoolCoins,
    listNew,
    listStretch,
    listMigrated,
    listGood,
    applyFilters,
    filters,
    DEFAULT_FILTERS,
  };
})();
