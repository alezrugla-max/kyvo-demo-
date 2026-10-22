/* Kyvo price chart: TradingView Lightweight Charts™ (Apache-2.0, bundled in vendor/) + GeckoTerminal public OHLCV.
   Sub-minute candles (1s/15s/30s) are built client-side from the pool's latest public trades, because
   GeckoTerminal's 'second' OHLCV is paid-only. Fallback: DexScreener embed. */
(function () {
  'use strict';
  const GT = 'https://api.geckoterminal.com/api/v2';
  const TFS = [
    { id: '1s', sec: 1, src: 'trades' },
    { id: '15s', sec: 15, src: 'trades' },
    { id: '30s', sec: 30, src: 'trades' },
    { id: '1m', sec: 60, tf: 'minute', agg: 1 },
    { id: '5m', sec: 300, tf: 'minute', agg: 5 },
    { id: '15m', sec: 900, tf: 'minute', agg: 15 },
    { id: '1h', sec: 3600, tf: 'hour', agg: 1 },
    { id: '4h', sec: 14400, tf: 'hour', agg: 4 },
  ];
  const TF_KEY = 'kyvo_chart_tf';
  const cache = new Map(); // url -> {t, data}
  let lastReq = 0;
  const MIN_GAP = 4000; // GeckoTerminal public API: stay well under ~30 req/min (shared with the app)
  let cooldownUntil = 0; // after a rate-limit / blocked response, pause all GT calls
  // v8.9: a real queue with a PRIORITY lane. v8.8 chained every GT call of the whole app (second-wave shapes, track record,
  // watchlist, tweets) on one promise, 4 s apart — opening a coin often waited 30–60 s behind them ("Ładuję wykres…" forever),
  // and one hanging request (no timeout) blocked every later chart. Chart calls now jump the queue; each call times out at 12 s.
  const queue = [];
  let pumping = false;
  const inflight = new Map(); // url -> promise (same URL requested twice = one call)
  async function pump() {
    if (pumping) return;
    pumping = true;
    try {
      while (queue.length) {
        queue.sort((a, b) => b.pri - a.pri || a.seq - b.seq);
        // v8.9: while a chart is still loading, background GT calls (images, second-wave shapes, track record) wait (≤ 20 s)
        // — GeckoTerminal's free limit is shared, and the chart is what the user is looking at
        if (!queue[0].pri && chartBusy() && Date.now() - (queue[0].since || (queue[0].since = Date.now())) < 20000) { await new Promise((r) => setTimeout(r, 400)); continue; }
        const job = queue.shift();
        if (job.alive && !job.alive()) { job.err(new Error('cancelled')); continue; } // chart already closed: skip the call
        if (job.stale && cooldownUntil > Date.now()) { job.ok(job.stale); continue; } // rate-limited: stale beats waiting
        // chart (priority) calls: 1.5 s after the previous call and at most 3 s of a rate-limit pause; background calls keep 4 s + full pause
        const wait = job.pri ? Math.max(0, lastReq + 1500 - Date.now(), Math.min(3000, cooldownUntil - Date.now()))
          : Math.max(0, lastReq + MIN_GAP - Date.now(), cooldownUntil - Date.now());
        if (wait) await new Promise((r) => setTimeout(r, wait));
        lastReq = Date.now();
        try { job.ok(await job.run()); } catch (e) { job.err(e); }
      }
    } finally { pumping = false; }
  }
  let seq = 0;
  const chartBusy = () => !!(cur && !cur.dead && !cur.data && !cur.fbAt && cur.root && cur.root.isConnected);
  function gtFetch(url, ttl, pri, alive) {
    const hit = cache.get(url);
    if (hit && Date.now() - hit.t < ttl) return Promise.resolve(hit.data);
    if (inflight.has(url) && !alive) return inflight.get(url);
    const run = async () => {
      const again = cache.get(url);
      if (again && Date.now() - again.t < ttl) return again.data; // filled while queued
      let r;
      const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const to = ctl ? setTimeout(() => ctl.abort(), 12000) : null;
      try {
        r = await fetch(url, { headers: { Accept: 'application/json' }, signal: ctl ? ctl.signal : undefined });
      } catch (e) {
        if (to) clearTimeout(to);
        if (e && e.name === 'AbortError') { if (hit) return hit.data; throw new Error('timeout'); }
        // GT answers 429 without CORS headers → surfaces as a network error
        cooldownUntil = Date.now() + 10000;
        if (hit) return hit.data;
        throw new Error('limit');
      }
      if (to) clearTimeout(to);
      if (r.status === 429) {
        cooldownUntil = Date.now() + 10000;
        if (hit) return hit.data; // stale is better than nothing
        throw new Error('limit');
      }
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const d = await r.json();
      cache.set(url, { t: Date.now(), data: d });
      return d;
    };
    const p = new Promise((ok, err) => { queue.push({ run, ok, err, pri: pri ? 1 : 0, seq: seq++, stale: hit ? hit.data : null, alive }); pump(); })
      .finally(() => { if (inflight.get(url) === p) inflight.delete(url); });
    if (!alive) inflight.set(url, p);
    return p;
  }
  const chartFetch = (url, ttl, me) => gtFetch(url, ttl, true, me ? () => !me.dead && me === cur && !me.fbAt : null);

  function fmtPrice(p) {
    if (p == null || !isFinite(p)) return '—';
    if (p <= 0) return p === 0 ? '0' : ''; // v8.1: no '-0' labels below zero (volume area under candles)
    if (p >= 1000) return p.toFixed(0);
    if (p >= 1) return p.toFixed(3);
    const z = Math.floor(-Math.log10(p));
    return p.toFixed(Math.min(14, z + 4));
  }
  function fmtTime(t, sec) {
    const d = new Date(t * 1000);
    const o = { hour: '2-digit', minute: '2-digit' };
    if (sec < 60) o.second = '2-digit';
    if (sec >= 14400) return d.toLocaleDateString((window.KyvoI18n ? window.KyvoI18n.locale() : 'pl-PL'), { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString((window.KyvoI18n ? window.KyvoI18n.locale() : 'pl-PL'), o);
    return d.toLocaleTimeString((window.KyvoI18n ? window.KyvoI18n.locale() : 'pl-PL'), o);
  }

  let cur = null; // current mounted chart
  const fbMemo = new Map(); // key -> time of the last transient fallback

  function destroy() {
    if (!cur) return;
    cur.dead = true;
    clearInterval(cur.timer);
    clearTimeout(cur.watchT);
    clearTimeout(cur.retryT);
    try { cur.chart && cur.chart.remove(); } catch (e) {}
    cur.root.remove();
    cur = null;
  }

  function mount(slot, opts) {
    if (!slot) return;
    if (cur && cur.key === opts.key) {
      // v8.9: reopening the same coin — reuse only a healthy chart; a fallback caused by a temporary problem (rate limit,
      // timeout, library not loaded yet, pool not indexed yet) is rebuilt so the real chart gets another chance
      const stale = cur.fbTransient && Date.now() - (cur.fbAt || 0) > 180000; // ≤ 3 min: keep the working DexScreener chart
      if (!stale) {
        slot.appendChild(cur.root);
        cur.opts = Object.assign(cur.opts, opts, { smBuys: opts.smBuys || [] });
        if (cur.data) applyMarkers(cur);
        if (cur.chart && Date.now() - (cur.loadedAt || 0) > 30000) load(cur, false);
        if (cur.chart) schedule(cur);
        return;
      }
    }
    destroy();
    const root = document.createElement('div');
    root.className = 'kchart';
    const saved = localStorage.getItem(TF_KEY);
    const tf = TFS.find((x) => x.id === saved) || TFS[3];
    root.innerHTML = `
      <div class="kc-tfs" role="tablist">${TFS.map((x) => `<button type="button" data-tf="${x.id}" class="${x.id === tf.id ? 'on' : ''}">${x.id}</button>`).join('')}</div>
      <div class="kc-box"><div class="kc-chart"></div><div class="kc-state"><div class="spin"></div>Ładuję wykres…</div></div>
      <div class="kc-note mut"></div>
      <div class="kc-attr mut">Wykres: <a href="https://www.tradingview.com/" target="_blank" rel="noopener">TradingView Lightweight Charts™</a> · dane: <a href="https://www.geckoterminal.com/" target="_blank" rel="noopener">GeckoTerminal</a></div>`;
    slot.appendChild(root);
    cur = { key: opts.key, opts, root, tf, pool: opts.pool || null, chart: null, data: null, timer: null, fails: 0 };
    const me = cur;
    root.querySelectorAll('[data-tf]').forEach((b) =>
      b.addEventListener('click', () => {
        const t = TFS.find((x) => x.id === b.dataset.tf);
        if (!t || me.dead) return;
        me.tf = t;
        localStorage.setItem(TF_KEY, t.id);
        root.querySelectorAll('[data-tf]').forEach((x) => x.classList.toggle('on', x === b));
        load(me, true);
        schedule(me);
      })
    );
    if (!opts.network) { fallback(me, 'GeckoTerminal nie obsługuje tej sieci', false); return; }
    if (opts.pool && /:/.test(opts.pool)) { fallback(me, '', false); return; }
    const memo = fbMemo.get(opts.key); // v8.9: this coin needed the DexScreener chart < 3 min ago -> show it at once on reopen
    if (memo && Date.now() - memo < 180000) { fallback(me, 'Wykres Kyvo był przed chwilą niedostępny', true); return; } // v8.9: four.meme curve pair ids ("0x…:4meme") are DexScreener-only
    // v8.9: never leave a blank box — no candles after 12 s (rate limit / slow pool) → DexScreener chart, Kyvo chart on reopen
    me.watchT = setTimeout(() => { if (me === cur && !me.dead && !me.data && !me.fbAt) fallback(me, 'Wykres Kyvo ładuje się zbyt długo', true); }, 12000);
    // v8.9: the chart library can be missing on a slow first visit (service worker 5-s timeout) — load it on demand
    ensureLib().then((ok) => {
      if (me.dead || me !== cur) return;
      if (!ok) { fallback(me, 'Biblioteka wykresu niedostępna', true); return; }
      build(me);
      load(me, true);
      schedule(me);
    });
  }
  let libP = null;
  function ensureLib() {
    if (window.LightweightCharts) return Promise.resolve(true);
    if (libP) return libP;
    libP = new Promise((res) => {
      let tries = 0;
      const attempt = () => {
        tries++;
        const sc = document.createElement('script');
        sc.src = 'vendor/lightweight-charts/lightweight-charts.standalone.production.js' + (tries > 1 ? '?r=' + Date.now() : '');
        sc.onload = () => res(!!window.LightweightCharts);
        sc.onerror = () => { sc.remove(); if (tries < 3) setTimeout(attempt, 1500 * tries); else { libP = null; res(false); } };
        document.head.appendChild(sc);
      };
      attempt();
    });
    return libP;
  }

  function build(me) {
    const el = me.root.querySelector('.kc-chart');
    const LC = window.LightweightCharts;
    const chart = LC.createChart(el, {
      autoSize: true,
      layout: { background: { type: 'solid', color: '#0d0d13' }, textColor: '#8b8b9a', fontSize: 11, attributionLogo: true },
      grid: { vertLines: { color: '#ffffff08' }, horzLines: { color: '#ffffff0b' } },
      rightPriceScale: { borderColor: '#ffffff14', scaleMargins: { top: 0.08, bottom: 0.26 } },
      timeScale: { borderColor: '#ffffff14', timeVisible: true, secondsVisible: false, rightOffset: 3,
        tickMarkFormatter: (t) => fmtTime(t, me.tf.sec) },
      localization: { locale: (window.KyvoI18n ? window.KyvoI18n.locale() : 'pl-PL'), priceFormatter: fmtPrice, timeFormatter: (t) => fmtTime(t, Math.min(me.tf.sec, 59)) },
      crosshair: { mode: 0 },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
    });
    me.candles = chart.addCandlestickSeries({
      upColor: '#34E07A', downColor: '#FF5468', borderVisible: false, wickUpColor: '#34E07A', wickDownColor: '#FF5468',
      priceFormat: { type: 'custom', formatter: fmtPrice, minMove: 1e-12 },
    });
    me.vol = chart.addHistogramSeries({ priceFormat: { type: 'volume' }, priceScaleId: 'vol', lastValueVisible: false, priceLineVisible: false });
    chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
    me.chart = chart;
  }

  async function resolvePool(me) {
    if (me.pool) return me.pool;
    let d;
    try { d = await chartFetch(`${GT}/networks/${me.opts.network}/tokens/${me.opts.token}/pools?page=1`, 300000, me); }
    catch (e) { if (/404/.test(String(e.message))) throw new Error('no pool'); throw e; }
    const p = d && d.data && d.data[0] && d.data[0].attributes && d.data[0].attributes.address;
    if (!p) throw new Error('no pool');
    me.pool = p;
    return p;
  }
  // v8.9: DexScreener's pair is sometimes unknown to GeckoTerminal (other DEX, or not indexed yet) -> 404 on OHLCV.
  // Then ask GeckoTerminal for the token's own top pool once before giving up on native candles.
  async function withPool(me, fn) {
    try { return await fn(await resolvePool(me)); }
    catch (e) {
      if (!/404/.test(String(e.message)) || me.poolRetried) throw e;
      me.poolRetried = true; me.pool = null;
      return fn(await resolvePool(me));
    }
  }
  async function tradeCandles(me, network, pool, token, sec) {
    const d = await chartFetch(`${GT}/networks/${network}/pools/${pool}/trades`, 12000, me);
    const rows = [];
    for (const r of (d && d.data) || []) {
      const a = r.attributes || {};
      const t = Math.floor(new Date(a.block_timestamp).getTime() / 1000);
      let px = null;
      if (a.from_token_address === token) px = parseFloat(a.price_from_in_usd);
      else if (a.to_token_address === token) px = parseFloat(a.price_to_in_usd);
      else px = parseFloat(a.kind === 'sell' ? a.price_from_in_usd : a.price_to_in_usd);
      if (!isFinite(t) || !isFinite(px) || px <= 0) continue;
      rows.push({ t, px, v: parseFloat(a.volume_in_usd) || 0 });
    }
    rows.sort((x, y) => x.t - y.t);
    const out = [];
    for (const r of rows) {
      const b = r.t - (r.t % sec);
      const last = out[out.length - 1];
      if (last && last.time === b) {
        last.high = Math.max(last.high, r.px); last.low = Math.min(last.low, r.px); last.close = r.px; last.volume += r.v;
      } else out.push({ time: b, open: last ? last.close : r.px, high: Math.max(r.px, last ? last.close : r.px), low: Math.min(r.px, last ? last.close : r.px), close: r.px, volume: r.v });
    }
    return { out, n: rows.length, span: rows.length ? rows[rows.length - 1].t - rows[0].t : 0 };
  }

  async function getCandles(me, tf) {
    const { network, token } = me.opts;
    return withPool(me, async (pool) => {
      if (tf.src === 'trades') {
        const { out, n, span } = await tradeCandles(me, network, pool, token, tf.sec);
        return { candles: out, note: `Świece ${tf.id} zbudowane z ostatnich ${n} transakcji (GeckoTerminal) — pokrywają tylko ~${span < 120 ? span + ' s' : Math.round(span / 60) + ' min'} historii.` };
      }
      const d = await chartFetch(`${GT}/networks/${network}/pools/${pool}/ohlcv/${tf.tf}?aggregate=${tf.agg}&limit=300&currency=usd&token=${encodeURIComponent(token)}`, tf.sec >= 3600 ? 120000 : 45000, me);
      const list = (d && d.data && d.data.attributes && d.data.attributes.ohlcv_list) || [];
      const candles = list
        .map((x) => ({ time: x[0], open: +x[1], high: +x[2], low: +x[3], close: +x[4], volume: +x[5] || 0 }))
        .filter((c) => isFinite(c.close) && c.close > 0)
        .sort((a, b) => a.time - b.time);
      const ded = [];
      for (const c of candles) if (!ded.length || ded[ded.length - 1].time !== c.time) ded.push(c);
      // v8.9: a brand-new pool often has no OHLCV yet for 5m+ (or at all) — build 1-min candles from its latest trades instead
      if (ded.length < 3) {
        const sec = Math.min(tf.sec, 60);
        const tr = await tradeCandles(me, network, pool, token, sec).catch(() => null);
        if (tr && tr.out.length >= 2) return { candles: tr.out, note: `Nowy coin: świece ${sec >= 60 ? '1m' : sec + 's'} z ostatnich ${tr.n} transakcji (pełne świece ${tf.id} pojawią się, gdy GeckoTerminal je zbierze).`, fromTrades: true };
      }
      return { candles: ded, note: '' };
    });
  }

  function setState(me, html) {
    const s = me.root.querySelector('.kc-state');
    if (!s) return;
    s.style.display = html ? '' : 'none';
    if (html) s.innerHTML = html;
  }

  async function load(me, showSpinner) {
    const tf = me.tf;
    if (me.dead || me.fbAt || !me.chart) return; // v8.9: already on the DexScreener / line fallback
    clearTimeout(me.retryT);
    if (showSpinner && !me.data) setState(me, '<div class="spin"></div>Ładuję wykres…');
    try {
      const { candles, note } = await getCandles(me, tf);
      if (me.dead || me !== cur || me.tf !== tf || !me.chart) return;
      if (!candles.length) {
        if (me.data && !showSpinner) return; // keep the last good candles on a refresh tick
        me.empty = (me.empty || 0) + 1;
        if (me.empty >= 2) { fallback(me, 'GeckoTerminal nie ma jeszcze świec dla tej puli', true); return; }
        setState(me, `<div>Brak danych jeszcze — coin jest bardzo nowy.</div><div class="mut">Ponawiam za chwilę…</div><button type="button" class="pill kc-ds">Wykres DexScreener</button>`);
        wireDs(me);
        me.retryT = setTimeout(() => me === cur && me.tf === tf && load(me, true), 8000);
        return;
      }
      me.fails = 0; me.empty = 0;
      me.data = candles;
      me.candles.setData(candles.map(({ time, open, high, low, close }) => ({ time, open, high, low, close })));
      me.vol.setData(candles.map((c) => ({ time: c.time, value: c.volume, color: c.close >= c.open ? '#34E07A55' : '#FF546855' })));
      me.chart.applyOptions({ timeScale: { secondsVisible: tf.sec < 60 || candles.length && candles[1] && candles[1].time - candles[0].time < 60 } });
      if (showSpinner) me.chart.timeScale().fitContent();
      applyMarkers(me);
      me.root.querySelector('.kc-note').textContent = note || `Świece ${tf.id} · ${candles.length} szt. · odświeżanie automatyczne`;
      me.root.dataset.rendered = String(candles.length);
      me.root.dataset.tf = tf.id;
      me.loadedAt = Date.now();
      fbMemo.delete(me.key);
      setState(me, '');
    } catch (e) {
      if (me.dead || me !== cur || me.tf !== tf || me.fbAt || !me.chart) return;
      me.fails++;
      const msg = String(e && e.message);
      if (me.data && !showSpinner) return; // refresh tick failed: keep showing the last candles, next tick retries
      if (/no pool|404/.test(msg)) { fallback(me, 'GeckoTerminal nie zna jeszcze tej puli', true); return; }
      if (me.fails <= 3) {
        // v8.9: exponential backoff 3 s → 6 s → 12 s (rate limit, timeout, flaky mobile network), then DexScreener
        const wait = 3000 * Math.pow(2, me.fails - 1);
        setState(me, `<div class="spin"></div>${msg === 'limit' ? 'Limit zapytań GeckoTerminal' : msg === 'timeout' ? 'Wolne połączenie' : 'Problem z danymi'} — ponawiam (${me.fails}/3)…`);
        me.retryT = setTimeout(() => me === cur && me.tf === tf && load(me, true), wait);
        return;
      }
      fallback(me, 'GeckoTerminal nie odpowiada', true);
    }
  }

  function wireDs(me) {
    const b = me.root.querySelector('.kc-ds');
    if (b) b.onclick = () => fallback(me, '');
  }

  function applyMarkers(me) {
    if (!me.candles || !me.data || !me.data.length) return;
    const sec = me.tf.sec;
    const t0 = me.data[0].time, t1 = me.data[me.data.length - 1].time + sec;
    const ms = (me.opts.smBuys || [])
      .filter((b) => b.block_time && b.block_time >= t0 && b.block_time < t1)
      .map((b) => ({ time: b.block_time - (b.block_time % sec), position: 'belowBar', color: '#22D3EE', shape: 'arrowUp', text: 'SM ' + (b.wallet_name || '') }))
      .filter((m) => me.data.some((c) => c.time === m.time))
      .sort((a, b) => a.time - b.time);
    me.candles.setMarkers(ms);
  }

  // v8.9 fallback chain: GeckoTerminal candles → DexScreener embed (15-s load watchdog) → simple line from DexScreener % changes.
  function fallback(me, why, transient) {
    clearInterval(me.timer);
    clearTimeout(me.watchT);
    clearTimeout(me.retryT);
    try { me.chart && me.chart.remove(); } catch (e) {}
    me.chart = null; me.data = null;
    me.fbTransient = !!transient; me.fbAt = Date.now();
    if (transient && me.key) fbMemo.set(me.key, me.fbAt); else if (me.key) fbMemo.delete(me.key);
    const { dsChain, pair, token } = me.opts;
    const src = `https://dexscreener.com/${encodeURIComponent(dsChain || 'solana')}/${encodeURIComponent(pair || token)}?embed=1&theme=dark&info=0&trades=0`;
    me.root.querySelector('.kc-tfs').style.display = 'none';
    const box = me.root.querySelector('.kc-box');
    box.innerHTML = `<iframe class="kc-iframe" src="${src}" title="DexScreener chart" referrerpolicy="no-referrer" allow="clipboard-write"></iframe><div class="kc-state"><div class="spin"></div>Ładuję wykres DexScreener…</div>`;
    const ifr = box.querySelector('iframe');
    let loaded = false;
    ifr.addEventListener('load', () => { loaded = true; const st = box.querySelector('.kc-state'); if (st) st.style.display = 'none'; me.root.dataset.dsLoaded = '1'; });
    me.retryT = setTimeout(() => { if (!loaded && me === cur && !me.dead) line(me, 'DexScreener nie odpowiada'); }, 15000);
    me.root.querySelector('.kc-note').innerHTML = (why ? why.replace(/[<>]/g, '') + ' — pokazuję wykres DexScreener.' : 'Wykres DexScreener.') +
      (me.opts.network ? ' <button type="button" class="pill kc-again" style="margin-left:6px">Spróbuj wykres Kyvo</button>' : '');
    const ag = me.root.querySelector('.kc-again');
    if (ag) ag.onclick = () => { const slot = me.root.parentNode, o = me.opts; fbMemo.delete(me.key); me.fbAt = 0; me.fbTransient = true; me.root.dataset.retry = '1'; if (slot) { destroy(); mount(slot, o); } };
    me.root.querySelector('.kc-attr').innerHTML = 'Wykres: <a href="https://dexscreener.com/" target="_blank" rel="noopener">DexScreener</a> (embed)';
    me.root.dataset.fallback = '1';
  }

  // last resort: 5 points (24 h, 6 h, 1 h, 5 min ago, now) rebuilt from DexScreener's price + % changes — always available
  function line(me, why) {
    const p = +me.opts.price, ch = me.opts.change || {};
    const box = me.root.querySelector('.kc-box');
    const now = Math.floor(Date.now() / 1000);
    const pts = [];
    if (isFinite(p) && p > 0) {
      for (const [k, sec] of [['h24', 86400], ['h6', 21600], ['h1', 3600], ['m5', 300]]) {
        const v = ch[k];
        if (v != null && isFinite(v) && v > -100) pts.push({ time: now - sec, value: p / (1 + v / 100) });
      }
      pts.push({ time: now, value: p });
    }
    if (pts.length < 2) {
      box.innerHTML = `<div class="kc-state"><div>Brak danych jeszcze — wykres pojawi się, gdy coin złapie pierwsze transakcje.</div><button type="button" class="pill kc-again2">Spróbuj ponownie</button></div>`;
      const b = box.querySelector('.kc-again2');
      if (b) b.onclick = () => { const slot = me.root.parentNode, o = me.opts; fbMemo.delete(me.key); if (slot) { destroy(); mount(slot, o); } };
      me.root.dataset.empty = '1';
      return;
    }
    const lo = Math.min(...pts.map((x) => x.value)), hi = Math.max(...pts.map((x) => x.value)), W = 600, H = 260;
    const X = (t) => ((t - pts[0].time) / (now - pts[0].time)) * (W - 20) + 10, Y = (v) => H - 20 - ((v - lo) / (hi - lo || 1)) * (H - 40);
    const up = pts[pts.length - 1].value >= pts[0].value;
    box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="width:100%;height:100%;display:block"><polyline fill="none" stroke="${up ? '#34E07A' : '#FF5468'}" stroke-width="2.5" points="${pts.map((x) => X(x.time).toFixed(1) + ',' + Y(x.value).toFixed(1)).join(' ')}"/>${pts.map((x) => `<circle cx="${X(x.time).toFixed(1)}" cy="${Y(x.value).toFixed(1)}" r="3.5" fill="${up ? '#34E07A' : '#FF5468'}"/>`).join('')}</svg>`;
    me.root.querySelector('.kc-note').textContent = `${why ? why + ' — ' : ''}uproszczony wykres z % zmian (24h · 6h · 1h · 5m · teraz).`;
    me.root.dataset.line = String(pts.length);
  }

  function schedule(me) {
    clearInterval(me.timer);
    const every = me.tf.src === 'trades' ? 15000 : me.tf.sec <= 300 ? 45000 : 90000;
    me.timer = setInterval(() => {
      if (me !== cur || !me.root.isConnected) return;
      if (document.hidden || !me.chart) return;
      load(me, false);
    }, every);
  }

  window.KyvoChart = { mount, destroy, TFS, current: () => cur, line: (o) => cur && line(cur, o || '') };
  window.KyvoGT = { fetch: gtFetch };
})();
