# Kyvo v7.1

Live multi-chain memecoin Pulse (Solana / BSC / Robinhood) + **smart money snapshot** + **trader leaderboard** + Viral z X.

**Not financial advice.** Public data only. No keys in the repo.

## What's real

| Feature | Status |
|--------|--------|
| Pulse / Hot / Good / Boosted / search | Live DexScreener + GeckoTerminal |
| Chain switcher | Solana · BSC · Robin · Wszystkie (`localStorage`) |
| BSC Final Stretch / Migrated | `fourmeme` / `pancakeswap` |
| Robinhood Stretch/Migrated | Hidden (no public bonding graduation dexId) |
| Smart money badges | Snapshot `data/smart_money.json` (public Solana RPC) |
| Leaderboard | Snapshot `data/leaderboard.json`: realized PnL 1d/7d/30d, win rate and trades from FIFO buy/sell matching per mint, with SOL legs priced at hourly historical SOL/USD (Binance public klines). Shows `—` when it can't be computed reliably |
| Coin chart | TradingView Lightweight Charts™ v4.2.3 (Apache-2.0, bundled in `vendor/`, attribution logo kept) fed by GeckoTerminal public OHLCV for 1m/5m/15m/1h/4h. 1s/15s/30s candles are built client-side from the pool's last 300 public trades, because GeckoTerminal's `second` OHLCV is paid-only; the UI says these candles cover only recent trades. Falls back to a DexScreener embed. Shares one GeckoTerminal rate gate with the app |
| Row times | Coin age plus "na liście od X", which tracks first-seen per tab and chain in localStorage |
| Ranking | Its own tab (center button in the bottom bar). Kolscan-style table with 1d/7d/30d toggle, opening trader profiles |
| Profil | No login. The user pastes a public Solana address (stored in localStorage only). Swaps are fetched in the browser from publicnode only, throttled and cached in localStorage. api.mainnet-beta returns 403 to browser requests that carry an Origin header, so in-browser history covers about the last 24h and grows with every refresh on the same device and run through the same FIFO engine (`profile.js`). Shows a cumulative PnL chart, Pozycje (unrealized PnL at current DexScreener price), Aktywność, and a shareable PnL card (canvas PNG / iOS share sheet) |
| Viral z X | Snapshot `data/x_viral.json` |
| Insider / fresh wallets | Still demo-labelled |

Marker: `KYVO_MVP_LIVE_v7_1` · SW: `kyvo-mvp-v7-1`

## Refresh (box / CI)

```bash
# Smart money + leaderboard (public Solana RPC, no keys)
python3 tools/build_snapshots.py            # 300 successful sigs per wallet (500 for spam-flooded wallets) or 30 days
python3 tools/build_snapshots.py --no-cache # cold rebuild
```

How it works:
- Signatures are paginated with `getSignaturesForAddress`. Transactions come from publicnode when they are under 20h old, otherwise from api.mainnet-beta, which is rate limited to about 3.6 tx/s with backoff on 429.
- Each run has a hard budget of 13 min (`--budget-min`). Parsed transactions are cached in `tools/cache/`, which is gitignored and not bundled. A cold start needs 1–3 runs to fill the cache; after that a refresh only fetches new transactions and takes about 1–3 min.
- The cache never shrinks because of an empty or failed RPC answer. The cache is saved every 60s, so an interrupted run can be resumed.

```bash

# Viral z X — see tools/update_x_viral.md (x MCP / X API, ~20–40 reads)
# Then stamp or import:
python3 tools/update_x_viral.py --stamp
# or: python3 tools/update_x_viral.py --from-raw /path/to/mcp_dump.json
```

One-liner after X dump is ready:

```bash
python3 tools/build_snapshots.py && python3 tools/update_x_viral.py --stamp
```

## Legal

Memecoins are extremely risky. Kyvo shows public market data and public wallet activity attributed from public sources (Solana Tracker titles, Alez-confirmed KOL wallets). No custody, no trading bots, no private keys.
