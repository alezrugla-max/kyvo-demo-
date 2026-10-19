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
  let gate = Promise.resolve();
  let lastReq = 0;
  const MIN_GAP = 4000; // GeckoTerminal public API: stay well under ~30 req/min (shared with the app)
  let cooldownUntil = 0; // after a rate-limit / blocked response, pause all GT calls

  function gtFetch(url, ttl) {
    const hit = cache.get(url);
    if (hit && Date.now() - hit.t < ttl) return Promise.resolve(hit.data);
    const run = async () => {
      const again = cache.get(url);
      if (again && Date.now() - again.t < ttl) return again.data; // filled while queued
      const wait = Math.max(0, lastReq + MIN_GAP - Date.now(), cooldownUntil - Date.now());
      if (wait) await new Promise((r) => setTimeout(r, wait));
      lastReq = Date.now();
      let r;
      try {
        r = await fetch(url, { headers: { Accept: 'application/json' } });
      } catch (e) {
        // GT answers 429 without CORS headers → surfaces as a network error
        cooldownUntil = Date.now() + 25000;
        if (hit) return hit.data;
        throw new Error('limit');
      }
      if (r.status === 429) {
        cooldownUntil = Date.now() + 25000;
        if (hit) return hit.data; // stale is better than nothing
        throw new Error('limit');
      }
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const d = await r.json();
      cache.set(url, { t: Date.now(), data: d });
      return d;
    };
    const p = gate.then(run, run);
    gate = p.catch(() => {});
    return p;
  }

  function fmtPrice(p) {
    if (p == null || !isFinite(p)) return '—';
    if (p === 0) return '0';
    if (p >= 1000) return p.toFixed(0);
    if (p >= 1) return p.toFixed(3);
    const z = Math.floor(-Math.log10(p));
    return p.toFixed(Math.min(14, z + 4));
  }
  function fmtTime(t, sec) {
    const d = new Date(t * 1000);
    const o = { hour: '2-digit', minute: '2-digit' };
    if (sec < 60) o.second = '2-digit';
    if (sec >= 14400) return d.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('pl-PL', o);
    return d.toLocaleTimeString('pl-PL', o);
  }

  let cur = null; // current mounted chart

  function destroy() {
    if (!cur) return;
    clearInterval(cur.timer);
    try { cur.chart && cur.chart.remove(); } catch (e) {}
    cur.root.remove();
    cur = null;
  }

  function mount(slot, opts) {
    if (!slot) return;
    if (cur && cur.key === opts.key) {
      slot.appendChild(cur.root);
      cur.opts.smBuys = opts.smBuys || [];
      if (cur.data) applyMarkers(cur);
      return;
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
    if (!window.LightweightCharts || !opts.network) {
      fallback(me, !opts.network ? 'GeckoTerminal nie obsługuje tej sieci' : 'Biblioteka wykresu niedostępna');
      return;
    }
    build(me);
    load(me, true);
    schedule(me);
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
      localization: { locale: 'pl-PL', priceFormatter: fmtPrice, timeFormatter: (t) => fmtTime(t, Math.min(me.tf.sec, 59)) },
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
    const d = await gtFetch(`${GT}/networks/${me.opts.network}/tokens/${me.opts.token}/pools?page=1`, 300000);
    const p = d && d.data && d.data[0] && d.data[0].attributes && d.data[0].attributes.address;
    if (!p) throw new Error('no pool');
    me.pool = p;
    return p;
  }

  async function getCandles(me, tf) {
    const { network, token } = me.opts;
    const pool = await resolvePool(me);
    if (tf.src === 'trades') {
      const d = await gtFetch(`${GT}/networks/${network}/pools/${pool}/trades`, 12000);
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
        const b = r.t - (r.t % tf.sec);
        const last = out[out.length - 1];
        if (last && last.time === b) {
          last.high = Math.max(last.high, r.px);
          last.low = Math.min(last.low, r.px);
          last.close = r.px;
          last.volume += r.v;
        } else out.push({ time: b, open: last ? last.close : r.px, high: Math.max(r.px, last ? last.close : r.px), low: Math.min(r.px, last ? last.close : r.px), close: r.px, volume: r.v });
      }
      const span = rows.length ? rows[rows.length - 1].t - rows[0].t : 0;
      return { candles: out, note: `Świece ${tf.id} zbudowane z ostatnich ${rows.length} transakcji (GeckoTerminal) — pokrywają tylko ~${span < 120 ? span + ' s' : Math.round(span / 60) + ' min'} historii.` };
    }
    const d = await gtFetch(`${GT}/networks/${network}/pools/${pool}/ohlcv/${tf.tf}?aggregate=${tf.agg}&limit=300&currency=usd&token=${encodeURIComponent(token)}`, tf.sec >= 3600 ? 120000 : 45000);
    const list = (d && d.data && d.data.attributes && d.data.attributes.ohlcv_list) || [];
    const candles = list
      .map((x) => ({ time: x[0], open: +x[1], high: +x[2], low: +x[3], close: +x[4], volume: +x[5] || 0 }))
      .filter((c) => isFinite(c.close) && c.close > 0)
      .sort((a, b) => a.time - b.time);
    const ded = [];
    for (const c of candles) if (!ded.length || ded[ded.length - 1].time !== c.time) ded.push(c);
    return { candles: ded, note: '' };
  }

  function setState(me, html) {
    const s = me.root.querySelector('.kc-state');
    if (!s) return;
    s.style.display = html ? '' : 'none';
    if (html) s.innerHTML = html;
  }

  async function load(me, showSpinner) {
    const tf = me.tf;
    if (showSpinner) setState(me, '<div class="spin"></div>Ładuję wykres…');
    try {
      const { candles, note } = await getCandles(me, tf);
      if (me.dead || me !== cur || me.tf !== tf) return;
      if (!candles.length) {
        setState(me, `<div>Brak świec ${tf.id} dla tej puli.</div><button type="button" class="pill kc-ds">Wykres DexScreener</button>`);
        wireDs(me);
        return;
      }
      me.fails = 0;
      me.data = candles;
      me.candles.setData(candles.map(({ time, open, high, low, close }) => ({ time, open, high, low, close })));
      me.vol.setData(candles.map((c) => ({ time: c.time, value: c.volume, color: c.close >= c.open ? '#34E07A55' : '#FF546855' })));
      me.chart.applyOptions({ timeScale: { secondsVisible: tf.sec < 60 } });
      if (showSpinner) me.chart.timeScale().fitContent();
      applyMarkers(me);
      me.root.querySelector('.kc-note').textContent = note || `Świece ${tf.id} · ${candles.length} szt. · odświeżanie automatyczne`;
      me.root.dataset.rendered = String(candles.length);
      me.root.dataset.tf = tf.id;
      setState(me, '');
    } catch (e) {
      if (me.dead || me !== cur) return;
      me.fails++;
      const msg = String(e.message);
      if (me.data && msg === 'limit') {
        if (showSpinner) setTimeout(() => me === cur && me.tf === tf && load(me, true), 6000);
        if (!showSpinner) return;
        setState(me, '<div class="spin"></div>Limit zapytań GeckoTerminal — ponawiam za chwilę…');
        return;
      }
      if (msg === 'limit' && me.fails < 4) {
        setState(me, '<div class="spin"></div>Limit zapytań GeckoTerminal — ponawiam za chwilę…');
        setTimeout(() => me === cur && me.tf === tf && load(me, true), 6000 * me.fails);
        return;
      }
      if (me.fails >= 4 || /404|no pool/.test(msg)) {
        fallback(me, 'GeckoTerminal nie zwrócił danych');
      } else {
        setState(me, `<div>Nie udało się pobrać świec (${String(e.message).replace(/[<>]/g, '')}).</div><button type="button" class="pill kc-retry">Spróbuj ponownie</button> <button type="button" class="pill kc-ds">Wykres DexScreener</button>`);
        const r = me.root.querySelector('.kc-retry');
        if (r) r.onclick = () => load(me, true);
        wireDs(me);
      }
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

  function fallback(me, why) {
    clearInterval(me.timer);
    try { me.chart && me.chart.remove(); } catch (e) {}
    me.chart = null;
    const { dsChain, pair, token } = me.opts;
    const src = `https://dexscreener.com/${encodeURIComponent(dsChain || 'solana')}/${encodeURIComponent(pair || token)}?embed=1&theme=dark&info=0&trades=0`;
    me.root.querySelector('.kc-tfs').style.display = 'none';
    me.root.querySelector('.kc-box').innerHTML = `<iframe class="kc-iframe" src="${src}" title="DexScreener chart" loading="lazy" referrerpolicy="no-referrer"></iframe>`;
    me.root.querySelector('.kc-note').textContent = why ? why + ' — pokazuję wykres DexScreener.' : 'Wykres DexScreener.';
    me.root.querySelector('.kc-attr').innerHTML = 'Wykres: <a href="https://dexscreener.com/" target="_blank" rel="noopener">DexScreener</a> (embed)';
    me.root.dataset.fallback = '1';
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

  window.KyvoChart = { mount, destroy, TFS, current: () => cur };
  window.KyvoGT = { fetch: gtFetch };
})();
