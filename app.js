/* KYVO_MVP_LIVE_v4 — live DexScreener + Viral z X snapshot. Not financial advice. */
(function () {
  'use strict';

  const DS = 'https://api.dexscreener.com';
  const GT = 'https://api.geckoterminal.com/api/v2';
  const CACHE_KEY = 'kyvo_coins_v4';
  const CACHE_MS = 60_000;
  const REFRESH_MS = 45_000;
  const FALLBACK_IMG = 'kyvo_mark.svg';
  const MVP_MARKER = 'KYVO_MVP_LIVE_v4';

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
    if (n == null || !isFinite(n)) return '—';
    const a = Math.abs(n);
    if (a >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (a >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
    if (a >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    if (a >= 1) return '$' + n.toFixed(2);
    if (a >= 0.0001) return '$' + n.toFixed(6);
    return '$' + Number(n).toPrecision(4);
  }
  function fmtPct(n) {
    if (n == null || !isFinite(n)) return '—';
    const s = (n >= 0 ? '+' : '') + Number(n).toFixed(1) + '%';
    return s;
  }
  function pctClass(n) {
    if (n == null || !isFinite(n)) return 'mut';
    return n >= 0 ? 'up' : 'dn';
  }
  function shortCa(a) {
    if (!a) return '—';
    return a.slice(0, 4) + '…' + a.slice(-4);
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
  function timeAgo(iso) {
    if (!iso) return '';
    const t = new Date(iso).getTime();
    if (!isFinite(t)) return '';
    return ageFrom(t) + ' ago';
  }
  function fmtInt(n) {
    if (n == null) return '—';
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return String(n);
  }

  /* ---- Fuzzy match (typos / similar names) ---- */
  function norm(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  }
  function levenshtein(a, b) {
    a = norm(a); b = norm(b);
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    const row = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 0; i < a.length; i++) {
      let prev = i + 1, cur;
      for (let j = 0; j < b.length; j++) {
        cur = a[i] === b[j] ? row[j] : 1 + Math.min(prev, row[j], row[j + 1]);
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
    const maxLen = Math.max(q.length, sy.length, 1);
    const best = Math.min(dSy, dN);
    if (best <= 1 && q.length >= 3) return 75;
    if (best <= 2 && q.length >= 4) return 60;
    if (best / maxLen <= 0.34) return 50;
    return 0;
  }

  /* ---- Platform deep links (public URL formats) ---- */
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

  /* ---- State ---- */
  let coins = []; // normalized coin objects
  let byAddr = {};
  let viral = null;
  let view = 'hot'; // hot | boosted | viral | more | coin | search
  let selectedAddr = null;
  let lastFetch = 0;
  let fetchErr = null;
  let sourceLabel = '';

  function saveCache() {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), coins, sourceLabel }));
    } catch (e) {}
  }
  function loadCache() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return false;
      const o = JSON.parse(raw);
      if (!o || !Array.isArray(o.coins) || !o.coins.length) return false;
      coins = o.coins;
      byAddr = Object.fromEntries(coins.map((c) => [c.address, c]));
      sourceLabel = o.sourceLabel || 'cache';
      lastFetch = o.t || 0;
      return true;
    } catch (e) {
      return false;
    }
  }

  function pairToCoin(p, meta) {
    if (!p || !p.baseToken) return null;
    const bt = p.baseToken;
    const liq = (p.liquidity && p.liquidity.usd) || 0;
    const vol = p.volume || {};
    const ch = p.priceChange || {};
    const info = p.info || {};
    const img =
      info.imageUrl ||
      (meta && meta.icon) ||
      null;
    return {
      address: bt.address,
      name: bt.name || bt.symbol || 'Unknown',
      symbol: bt.symbol || '???',
      chainId: p.chainId || 'solana',
      priceUsd: p.priceUsd != null ? Number(p.priceUsd) : null,
      mcap: p.marketCap != null ? Number(p.marketCap) : p.fdv != null ? Number(p.fdv) : null,
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
      dexId: p.dexId || '',
      url: p.url || '',
      image: img,
      socials: info.socials || (meta && meta.links) || [],
      websites: info.websites || [],
      description: (meta && meta.description) || '',
      boost: (meta && (meta.totalAmount || meta.amount)) || 0,
      pairAddress: p.pairAddress || '',
    };
  }

  async function fetchJson(url) {
    const r = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + url);
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

  async function loadLiveCoins() {
    fetchErr = null;
    try {
      const [profiles, boosts] = await Promise.all([
        fetchJson(DS + '/token-profiles/latest/v1'),
        fetchJson(DS + '/token-boosts/top/v1'),
      ]);
      const metaByAddr = {};
      const addrs = [];
      for (const x of [].concat(boosts || [], profiles || [])) {
        if (!x || x.chainId !== 'solana' || !x.tokenAddress) continue;
        const a = x.tokenAddress;
        if (!metaByAddr[a]) {
          metaByAddr[a] = x;
          addrs.push(a);
        } else {
          metaByAddr[a] = Object.assign({}, metaByAddr[a], x);
        }
      }
      const unique = addrs.slice(0, 30);
      if (!unique.length) throw new Error('No Solana tokens from DexScreener');

      const tok = await fetchJson(DS + '/latest/dex/tokens/' + unique.join(','));
      const best = pickBestPairs(tok.pairs || []);
      const list = [];
      for (const a of unique) {
        const p = best[a];
        if (!p) continue;
        const c = pairToCoin(p, metaByAddr[a]);
        if (c) list.push(c);
      }
      // Sort: boosted first by boost amount, then by 24h vol
      list.sort((a, b) => (b.boost || 0) - (a.boost || 0) || (b.volume.h24 || 0) - (a.volume.h24 || 0));
      coins = list;
      byAddr = Object.fromEntries(coins.map((c) => [c.address, c]));
      lastFetch = Date.now();
      sourceLabel = 'DexScreener';
      saveCache();
      return true;
    } catch (e1) {
      console.warn('DexScreener primary failed', e1);
      try {
        const g = await fetchJson(GT + '/networks/solana/trending_pools?page=1');
        const list = [];
        for (const row of g.data || []) {
          const atr = row.attributes || {};
          const name = (atr.name || '').split(' / ')[0] || 'Token';
          const addr =
            (row.relationships &&
              row.relationships.base_token &&
              row.relationships.base_token.data &&
              row.relationships.base_token.data.id &&
              String(row.relationships.base_token.data.id).replace(/^solana_/, '')) ||
            atr.address ||
            '';
          // Gecko pool address ≠ mint; keep pool id for display only if mint missing
          list.push({
            address: addr || atr.address || row.id,
            name,
            symbol: name.slice(0, 8).toUpperCase(),
            chainId: 'solana',
            priceUsd: atr.base_token_price_usd != null ? Number(atr.base_token_price_usd) : null,
            mcap: atr.fdv_usd != null ? Number(atr.fdv_usd) : null,
            fdv: atr.fdv_usd != null ? Number(atr.fdv_usd) : null,
            liquidity: atr.reserve_in_usd != null ? Number(atr.reserve_in_usd) : 0,
            volume: {
              m5: null,
              h1: atr.volume_usd && atr.volume_usd.h1 != null ? Number(atr.volume_usd.h1) : null,
              h6: atr.volume_usd && atr.volume_usd.h6 != null ? Number(atr.volume_usd.h6) : null,
              h24: atr.volume_usd && atr.volume_usd.h24 != null ? Number(atr.volume_usd.h24) : null,
            },
            change: {
              m5: atr.price_change_percentage && atr.price_change_percentage.m5 != null ? Number(atr.price_change_percentage.m5) : null,
              h1: atr.price_change_percentage && atr.price_change_percentage.h1 != null ? Number(atr.price_change_percentage.h1) : null,
              h6: atr.price_change_percentage && atr.price_change_percentage.h6 != null ? Number(atr.price_change_percentage.h6) : null,
              h24: atr.price_change_percentage && atr.price_change_percentage.h24 != null ? Number(atr.price_change_percentage.h24) : null,
            },
            pairCreatedAt: atr.pool_created_at ? Date.parse(atr.pool_created_at) : null,
            dexId: 'geckoterminal',
            url: atr.address ? 'https://www.geckoterminal.com/solana/pools/' + atr.address : '',
            image: atr.image_url || null,
            socials: [],
            websites: [],
            description: '',
            boost: 0,
            pairAddress: atr.address || '',
            _gecko: true,
          });
        }
        // Enrich mints via DexScreener search for top names
        coins = list.slice(0, 24);
        byAddr = Object.fromEntries(coins.map((c) => [c.address, c]));
        lastFetch = Date.now();
        sourceLabel = 'GeckoTerminal (fallback)';
        saveCache();
        return true;
      } catch (e2) {
        console.warn('Gecko fallback failed', e2);
        fetchErr = (e1 && e1.message) || 'Fetch failed';
        if (!coins.length && loadCache()) {
          fetchErr = 'Offline — showing cached data';
          return true;
        }
        return false;
      }
    }
  }

  function typoVariants(q) {
    const out = new Set();
    const s = q.trim();
    if (!s) return [];
    out.add(s);
    // drop last char (bonkk → bonk)
    if (s.length >= 4) out.add(s.slice(0, -1));
    // collapse double letters (pepee → pepe)
    out.add(s.replace(/(.)\1+/g, '$1'));
    // swap last two
    if (s.length >= 3) out.add(s.slice(0, -2) + s.slice(-1) + s.slice(-2, -1));
    // common meme tickers if close
    for (const t of ['BONK','WIF','PEPE','POPCAT','PNUT','MOODENG','TRUMP','DOGE','SPX','FARTCOIN']) {
      if (fuzzyScore(s, t, t, '') >= 60) out.add(t);
    }
    return [...out].filter(Boolean);
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
      // Fuzzy re-rank against original query
      list = list
        .map((c) => ({ c, s: Math.max(fuzzyScore(query, c.name, c.symbol, c.address), ...variants.map(v => fuzzyScore(v, c.name, c.symbol, c.address))) }))
        .filter((x) => x.s > 0 || norm(query).length >= 32)
        .sort((a, b) => b.s - a.s || (b.c.liquidity || 0) - (a.c.liquidity || 0) || (b.c.volume.h24 || 0) - (a.c.volume.h24 || 0))
        .map((x) => x.c);
      if (!list.length) {
        // local fuzzy over cached hot list
        list = coins
          .map((c) => ({ c, s: fuzzyScore(query, c.name, c.symbol, c.address) }))
          .filter((x) => x.s >= 50)
          .sort((a, b) => b.s - a.s)
          .map((x) => x.c);
      }
      return list.slice(0, 40);
    } catch (e) {
      console.warn('search failed', e);
      return coins
        .map((c) => ({ c, s: fuzzyScore(query, c.name, c.symbol, c.address) }))
        .filter((x) => x.s >= 50)
        .sort((a, b) => b.s - a.s)
        .map((x) => x.c);
    }
  }

  async function loadViral() {
    try {
      const d = await fetchJson('data/x_viral.json?v=4');
      viral = d;
      return d;
    } catch (e) {
      console.warn('viral snapshot failed', e);
      viral = { posts: [], topics: [], updated_at: null, note: 'Snapshot unavailable' };
      return viral;
    }
  }

  /* ---- Match X topic → live coins ---- */
  async function matchTopicToCoins(topic) {
    const q = topic.query || topic.label || '';
    const hints = topic.hints || [];
    let found = await searchDex(q);
    // Also try hints
    for (const h of hints.slice(0, 2)) {
      if (found.length >= 6) break;
      const more = await searchDex(h);
      const seen = new Set(found.map((c) => c.address));
      for (const c of more) if (!seen.has(c.address)) found.push(c);
    }
    // Fuzzy score against topic label+hints
    const bag = [topic.label].concat(hints).join(' ');
    return found
      .map((c) => ({
        c,
        s: Math.max(
          fuzzyScore(topic.label, c.name, c.symbol, c.address),
          ...hints.map((h) => fuzzyScore(h, c.name, c.symbol, c.address)),
          fuzzyScore(bag, c.name, c.symbol, c.address)
        ),
      }))
      .filter((x) => x.s >= 50 || found.length <= 3)
      .sort((a, b) => b.s - a.s || (b.c.liquidity || 0) - (a.c.liquidity || 0) || (b.c.volume.h24 || 0) - (a.c.volume.h24 || 0))
      .filter((x, i, arr) => (x.c.liquidity || 0) >= 1000 || i < 2 || arr.every(y => (y.c.liquidity || 0) < 1000))
      .slice(0, 5);
  }

  /* ---- Render helpers ---- */
  function imgTag(src, cls, size) {
    const s = size || 42;
    const safe = src || FALLBACK_IMG;
    return `<img class="${cls || 'tok'}" src="${esc(safe)}" width="${s}" height="${s}" alt="" loading="lazy" onerror="this.onerror=null;this.src='${FALLBACK_IMG}'">`;
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function coinRow(c) {
    const ch = c.change.h24;
    return `<div class="row" data-addr="${esc(c.address)}" role="button" tabindex="0">
      ${imgTag(c.image)}
      <div class="nm"><b>${esc(c.name)} <span class="mut" style="font-weight:600">$${esc(c.symbol)}</span></b>
        <small>MC ${fmtUsd(c.mcap)} · Liq ${fmtUsd(c.liquidity)} · ${ageFrom(c.pairCreatedAt)}</small></div>
      <div class="rt"><b class="${pctClass(ch)}">${fmtPct(ch)}</b>
        <small class="mut">Vol ${fmtUsd(c.volume.h24)}</small></div>
    </div>`;
  }

  function renderList(list, title, sub) {
    const body = $('#listBody');
    if (fetchErr && !list.length) {
      body.innerHTML = `<div class="err">${esc(fetchErr)}<div style="margin-top:8px"><button class="pill" id="retryBtn">Spróbuj ponownie</button></div></div>`;
      $('#retryBtn') && $('#retryBtn').addEventListener('click', () => refresh(true));
      return;
    }
    if (!list.length) {
      body.innerHTML = `<div class="empty">Brak coinów. ${fetchErr ? esc(fetchErr) : ''}</div>`;
      return;
    }
    body.innerHTML = `
      <div class="h">${esc(title)} <span class="badge live">LIVE</span></div>
      <div class="sub">${esc(sub || '')} · źródło: ${esc(sourceLabel || 'DexScreener')} · odświeżanie co ~45s</div>
      <div class="card" style="padding:4px 10px">${list.map(coinRow).join('')}</div>
      <div class="foot">Dane: DexScreener · ${MVP_MARKER}</div>`;
    wireRows(body);
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

  function openCoin(addr) {
    selectedAddr = addr;
    const c = byAddr[addr];
    if (c) {
      show('coin');
      renderCoin(c);
      // refresh this token in background
      enrichCoin(addr).then((nc) => {
        if (nc && selectedAddr === addr) {
          byAddr[addr] = nc;
          const i = coins.findIndex((x) => x.address === addr);
          if (i >= 0) coins[i] = nc;
          renderCoin(nc);
        }
      });
      return;
    }
    show('coin');
    $('#coinBody').innerHTML = `<div class="loading"><div class="spin"></div>Ładuję coin…</div>`;
    enrichCoin(addr).then((nc) => {
      if (!nc) {
        $('#coinBody').innerHTML = `<div class="err">Nie znaleziono coina.<div class="back" style="margin-top:12px" id="backFail">‹ Wróć</div></div>`;
        $('#backFail') && $('#backFail').addEventListener('click', () => history.back());
        return;
      }
      byAddr[addr] = nc;
      renderCoin(nc);
    });
  }

  async function enrichCoin(addr) {
    try {
      const d = await fetchJson(DS + '/latest/dex/tokens/' + encodeURIComponent(addr));
      const best = pickBestPairs(d.pairs || []);
      const p = best[addr] || (d.pairs || []).find((x) => x.chainId === 'solana');
      if (!p) return null;
      const c = pairToCoin(p, null);
      return c;
    } catch (e) {
      return byAddr[addr] || null;
    }
  }

  function renderCoin(c) {
    const urls = platformUrls(c.address, c.chainId);
    const socials = (c.socials || [])
      .map((s) => {
        const u = s.url || s;
        const t = s.type || 'link';
        if (!u) return '';
        return `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(t)}</a>`;
      })
      .filter(Boolean)
      .join('');
    const webs = (c.websites || [])
      .map((w) => {
        const u = w.url || w;
        return u ? `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(w.label || 'web')}</a>` : '';
      })
      .filter(Boolean)
      .join('');

    $('#coinBody').innerHTML = `
      <div style="display:flex;align-items:center;gap:10px">
        <span class="back" id="coinBack" role="button" tabindex="0">‹</span>
        ${imgTag(c.image, 'tok', 46)}
        <div style="min-width:0;flex:1">
          <b style="font-size:17px">${esc(c.name)}</b>
          <div class="mut" style="font-size:12px">$${esc(c.symbol)} · ${ageFrom(c.pairCreatedAt)} · ${esc(c.dexId || '')}</div>
        </div>
        <img src="kyvo_mark.svg" width="28" height="28" alt="">
      </div>
      <div style="margin-top:10px">
        <span class="ca">CA ${esc(shortCa(c.address))}
          <button class="copybtn" id="copyCa" title="Copy" type="button" aria-label="Copy contract">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ddd" stroke-width="2.4"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>
          </button>
        </span>
        <span class="badge live" style="margin-left:6px">LIVE</span>
      </div>
      <div style="margin-top:10px;font-size:12px;word-break:break-all" class="mut" id="fullCa">${esc(c.address)}</div>
      <div style="margin-top:12px">
        <b style="font-size:26px;letter-spacing:-.4px">${fmtUsd(c.mcap)}</b>
        <span class="mut"> MC</span>
        <span class="${pctClass(c.change.h24)}" style="font-weight:700;margin-left:6px">${fmtPct(c.change.h24)} 24h</span>
      </div>
      <div class="statg">
        <div class="st"><small>Price</small><b>${fmtUsd(c.priceUsd)}</b></div>
        <div class="st"><small>Liquidity</small><b>${fmtUsd(c.liquidity)}</b></div>
        <div class="st"><small>FDV</small><b>${fmtUsd(c.fdv)}</b></div>
        <div class="st"><small>Vol 5m</small><b>${fmtUsd(c.volume.m5)}</b></div>
        <div class="st"><small>Vol 1h</small><b>${fmtUsd(c.volume.h1)}</b></div>
        <div class="st"><small>Vol 24h</small><b>${fmtUsd(c.volume.h24)}</b></div>
        <div class="st"><small>Δ 5m</small><b class="${pctClass(c.change.m5)}">${fmtPct(c.change.m5)}</b></div>
        <div class="st"><small>Δ 1h</small><b class="${pctClass(c.change.h1)}">${fmtPct(c.change.h1)}</b></div>
        <div class="st"><small>Δ 6h</small><b class="${pctClass(c.change.h6)}">${fmtPct(c.change.h6)}</b></div>
      </div>
      ${c.description ? `<div class="card" style="margin-top:10px;font-size:13px;color:#ccc">${esc(c.description)}</div>` : ''}
      <div class="card" style="margin-top:10px">
        <div class="h" style="font-size:13px;margin:0 0 6px">Socials</div>
        <div class="socials">${socials || '<span class="mut">Brak</span>'} ${webs}</div>
      </div>
      <div class="plats">
        <a class="plat p0" href="${esc(urls.FOMO)}" target="_blank" rel="noopener noreferrer">FOMO</a>
        <a class="plat" href="${esc(urls.Axiom)}" target="_blank" rel="noopener noreferrer">Axiom</a>
        <a class="plat" href="${esc(urls.Photon)}" target="_blank" rel="noopener noreferrer">Photon</a>
        <a class="plat" href="${esc(urls.GMGN)}" target="_blank" rel="noopener noreferrer">GMGN</a>
      </div>
      <div style="margin-top:8px;text-align:center">
        <a href="${esc(urls.DexScreener)}" target="_blank" rel="noopener noreferrer" style="font-size:12px">Otwórz na DexScreener ↗</a>
      </div>
      <div class="foot">To nie jest porada finansowa · Dane: DexScreener · ${MVP_MARKER}</div>`;

    $('#coinBack').addEventListener('click', () => {
      if (history.length > 1) history.back();
      else setView('hot');
    });
    $('#copyCa').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(c.address);
        toast('Skopiowano CA ' + shortCa(c.address));
      } catch (e) {
        // fallback
        const ta = document.createElement('textarea');
        ta.value = c.address;
        document.body.appendChild(ta);
        ta.select();
        try {
          document.execCommand('copy');
          toast('Skopiowano CA ' + shortCa(c.address));
        } catch (e2) {
          toast('Nie udało się skopiować');
        }
        ta.remove();
      }
    });
  }

  /* ---- Viral z X ---- */
  async function renderViral() {
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
      <div class="sub">Prawdziwe posty z X (cytat + link). Tematy matchowane live do coinów przez DexScreener (fuzzy). Snapshot: ${esc(updated)} (Europe/Warsaw)</div>
      <div class="card">
        <div class="h" style="font-size:13px">Tematy → coiny</div>
        <div id="topicList"><div class="loading"><div class="spin"></div>Matchuję tematy do live coinów…</div></div>
      </div>
      <div class="h">Ważne posty</div>
      <div id="postList"></div>
      <div class="foot">Treści © ich autorzy · link do oryginału na X · odświeżenie snapshotu: tools/update_x_viral.md · ${MVP_MARKER}</div>`;

    const postList = $('#postList');
    postList.innerHTML = posts
      .map((p) => {
        const m = p.metrics || {};
        const av = p.avatar || FALLBACK_IMG;
        const hints = (p.topic_hints || []).slice(0, 4).map((h) => `<span class="chip">${esc(h)}</span>`).join('');
        return `<div class="card post">
          <div class="meta">
            ${imgTag(av, 'av', 36)}
            <div style="min-width:0;flex:1">
              <b style="font-size:13.5px">${esc(p.author_name)} <span class="mut" style="font-weight:600">@${esc(p.handle)}</span></b>
              <div class="mut" style="font-size:11px">${esc(timeAgo(p.created_at))}</div>
            </div>
            <a href="${esc(p.url)}" target="_blank" rel="noopener noreferrer" style="font-size:16px" title="Otwórz na X">𝕏</a>
          </div>
          <div class="txt">“${esc(p.text)}”</div>
          <div class="eng">♥ ${fmtInt(m.likes)} · ↻ ${fmtInt(m.reposts)} · 💬 ${fmtInt(m.replies)}${m.impressions != null ? ' · 👁 ' + fmtInt(m.impressions) : ''}</div>
          ${hints ? `<div style="margin-top:8px">${hints}</div>` : ''}
          <div style="margin-top:8px"><a href="${esc(p.url)}" target="_blank" rel="noopener noreferrer" style="font-size:12px">Zobacz oryginał na X ↗</a></div>
        </div>`;
      })
      .join('');

    // Match topics asynchronously (limit concurrency)
    const topicList = $('#topicList');
    const blocks = [];
    for (const t of topics) {
      blocks.push({ t, matches: null });
    }
    // sequential to respect DexScreener rate
    (async () => {
      const htmlParts = [];
      for (const b of blocks) {
        let matches = [];
        try {
          matches = await matchTopicToCoins(b.t);
        } catch (e) {
          matches = [];
        }
        const coinsHtml = matches.length
          ? matches
              .map(
                ({ c, s }) =>
                  `<div class="row" data-addr="${esc(c.address)}" style="padding:6px 0">
                    ${imgTag(c.image, 'tok', 28)}
                    <div class="nm"><b style="font-size:12.5px">$${esc(c.symbol)} · ${esc(c.name)}</b>
                      <small>MC ${fmtUsd(c.mcap)} · ${fmtPct(c.change.h24)}</small></div>
                    <span class="match">${Math.round(s)}%</span>
                  </div>`
              )
              .join('')
          : `<div class="mut" style="font-size:12px;padding:6px 0">Brak mocnego matcha na DexScreener dla „${esc(b.t.query || b.t.label)}”</div>`;
        htmlParts.push(`<div class="topic-block" style="margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #ffffff0a">
          <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start">
            <div>
              <b style="font-size:13.5px">${esc(b.t.label)}</b>
              <div class="mut" style="font-size:11.5px;margin-top:2px">${esc(b.t.why || '')}</div>
            </div>
            ${b.t.source_post ? `<a href="${esc(b.t.source_post)}" target="_blank" rel="noopener noreferrer" style="font-size:11px;flex:none">Źródło 𝕏</a>` : ''}
          </div>
          ${coinsHtml}
        </div>`);
        topicList.innerHTML = htmlParts.join('') || '<div class="mut">Brak tematów</div>';
        wireRows(topicList);
      }
      if (!htmlParts.length) topicList.innerHTML = '<div class="mut">Brak tematów w snapshocie</div>';
    })();
  }

  function renderMore() {
    $('#moreBody').innerHTML = `
      <div class="h">Więcej</div>
      <div class="card">
        <div class="h" style="font-size:13px">Leaderboard <span class="badge demo">Przykładowe dane</span></div>
        <div class="mut" style="font-size:13px;line-height:1.45">Ranking PnL traderów nie jest jeszcze podpięty do prawdziwego on-chain. Tu nic nie zmyślamy — sekcja pojawi się, gdy będą realne dane.</div>
      </div>
      <div class="card">
        <div class="h" style="font-size:13px">Insider / fresh wallets <span class="badge demo">Przykładowe dane</span></div>
        <div class="mut" style="font-size:13px">Wykrywanie insiderów wymaga własnego indeksu transakcji. Na razie niedostępne.</div>
      </div>
      <div class="card">
        <div class="h" style="font-size:13px">Famous wallets <span class="badge demo">Przykładowe dane</span></div>
        <div class="mut" style="font-size:13px">Śledzenie portfeli celebrytów — w planie. Viral z X już pokazuje prawdziwe posty kluczowych kont.</div>
      </div>
      <div class="card">
        <div class="h" style="font-size:13px">O Kyvo</div>
        <div style="font-size:13px;color:#ccc;line-height:1.45">
          Kyvo to curated feed memecoinów Solana na publicznych danych.
          Nie trzymamy Twoich środków. Zarobek: referral + Pro (w przyszłości).<br><br>
          <b>LIVE teraz:</b> Hot / Boosted coiny (DexScreener), search z fuzzy, szczegóły coina, przyciski FOMO/Axiom/Photon/GMGN, Viral z X (snapshot).<br>
          <b>Demo / wkrótce:</b> leaderboard PnL, insiderzy, famous wallets.
        </div>
      </div>
      <div class="foot">To nie jest porada finansowa · ${MVP_MARKER}</div>`;
  }

  /* ---- Navigation ---- */
  function show(which) {
    $$('.scr').forEach((s) => s.classList.remove('on'));
    const map = { hot: 's-list', boosted: 's-list', search: 's-list', viral: 's-viral', more: 's-more', coin: 's-coin' };
    const id = map[which] || 's-list';
    $('#' + id).classList.add('on');
    // tabs
    const tab = which === 'coin' ? view : which === 'boosted' || which === 'search' ? 'hot' : which;
    $$('.tb button').forEach((b) => b.classList.toggle('on', b.dataset.tab === (tab === 'hot' || tab === 'boosted' || tab === 'search' ? (which === 'search' ? 'search' : 'hot') : tab)));
    if (which === 'search') $$('.tb button').forEach((b) => b.classList.toggle('on', b.dataset.tab === 'search'));
    $$('#seg button').forEach((b) => b.classList.toggle('on', b.dataset.view === (which === 'search' ? 'hot' : which === 'coin' ? view : which)));
  }

  function setView(v) {
    view = v;
    if (v === 'viral') {
      show('viral');
      renderViral();
      location.hash = 'viral';
      return;
    }
    if (v === 'more') {
      show('more');
      renderMore();
      location.hash = 'more';
      return;
    }
    if (v === 'boosted') {
      show('boosted');
      const boosted = coins.filter((c) => c.boost > 0).sort((a, b) => b.boost - a.boost);
      renderList(boosted.length ? boosted : coins, 'Boosted', 'Top boosty na DexScreener (Solana)');
      location.hash = 'boosted';
      return;
    }
    // hot
    show('hot');
    const hot = coins.slice().sort((a, b) => (b.volume.h24 || 0) - (a.volume.h24 || 0));
    renderList(hot, 'Hot Solana', 'Profile + boosty, posortowane po wolumenie 24h');
    location.hash = 'hot';
  }

  async function runSearch(q) {
    view = 'search';
    show('search');
    const body = $('#listBody');
    body.innerHTML = `<div class="loading"><div class="spin"></div>Szukam „${esc(q)}”…</div>`;
    location.hash = 'search/' + encodeURIComponent(q);
    const list = await searchDex(q);
    // merge into byAddr
    for (const c of list) byAddr[c.address] = c;
    if (!list.length) {
      body.innerHTML = `<div class="empty">Nic nie znaleziono dla „${esc(q)}”. Spróbuj innej nazwy / tickera / CA.</div>`;
      return;
    }
    body.innerHTML = `
      <div class="h">Wyniki <span class="badge live">LIVE</span></div>
      <div class="sub">Fuzzy match dla „${esc(q)}” · DexScreener</div>
      <div class="card" style="padding:4px 10px">${list.map(coinRow).join('')}</div>`;
    wireRows(body);
  }

  function routeFromHash() {
    const h = (location.hash || '#hot').slice(1);
    const [a, b] = h.split('/');
    if (a === 'coin' && b) {
      openCoin(decodeURIComponent(b));
      return;
    }
    if (a === 'search' && b) {
      const q = decodeURIComponent(b);
      $('#q').value = q;
      runSearch(q);
      return;
    }
    if (a === 'viral' || a === 'more' || a === 'boosted' || a === 'hot') {
      setView(a);
      return;
    }
    setView('hot');
  }

  /* ---- Refresh / clock ---- */
  async function refresh(force) {
    $('#livePill').textContent = '…';
    const ok = await loadLiveCoins();
    $('#livePill').textContent = ok ? 'LIVE' : 'ERR';
    $('#livePill').style.background = ok ? '' : '#FF546822';
    $('#livePill').style.color = ok ? '' : '#FF5468';
    if (view === 'hot' || view === 'boosted') setView(view);
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

  /* ---- Wire UI ---- */
  $$('#seg button').forEach((b) =>
    b.addEventListener('click', () => {
      setView(b.dataset.view);
    })
  );
  $$('.tb button').forEach((b) =>
    b.addEventListener('click', () => {
      const t = b.dataset.tab;
      if (t === 'search') {
        $('#q').focus();
        return;
      }
      setView(t === 'hot' ? 'hot' : t);
    })
  );
  let searchT;
  $('#q').addEventListener('input', () => {
    clearTimeout(searchT);
    const v = $('#q').value.trim();
    if (!v) {
      setView('hot');
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

  // Navigate to coin via hash (single render path through routeFromHash)
  function goCoin(addr) {
    const h = 'coin/' + encodeURIComponent(addr);
    if (location.hash === '#' + h) openCoin(addr);
    else location.hash = h;
  };

  /* ---- Boot ---- */
  loadCache();
  Promise.all([loadViral(), refresh(true)]).then(() => {
    routeFromHash();
  });
  setInterval(() => refresh(false), REFRESH_MS);
  setInterval(updateClock, 1000);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  // Expose for QA
  window.__KYVO__ = { MVP_MARKER, platformUrls, fuzzyScore, refresh, getCoins: () => coins, getViral: () => viral };
})();
