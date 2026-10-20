# Kyvo v7.2

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
| Profil (v7.2, many wallets) | Up to 8 public addresses on Solana, BSC and Robinhood Chain (base58 for SOL, one 0x address can be added on both EVM chains). Per-wallet and combined PnL / positions / activity in the same layout. Seed-phrase / private-key paste is detected and refused. Sources, all keyless and verified to work from a browser (CORS): **Solana** publicnode RPC (~24h, grows per device). **BSC** ERC-20 `Transfer` logs via topic-filtered `eth_getLogs` on `bsc.rpc.blxrbdn.com` (fallback `rpc-bsc.48.club`; 5000-block chunks, last ~24h, "Starsze BSC (+24h)" up to 7 days) plus tx/receipt/blocks from `bsc-dataseed.bnbchain.org`; BNB leg from `tx.value`, WBNB unwrap or four.meme `TokenSale` events; holdings = BNB + tokens seen in the window (`balanceOf`). **Robinhood Chain** public Blockscout (`robinhoodchain.blockscout.com`, Etherscan-style `tokentx/txlist/txlistinternal`, last ~150 transfers; full token holdings from `/api/v2/addresses/{a}/tokens`), ETH leg from internal txs or a recent-block balance delta on `rpc.mainnet.chain.robinhood.com`. Native USD = Binance hourly klines; token prices = DexScreener. BscScan/Etherscan v2 free tier does not cover BSC, so there is no full keyless BSC history. New EVM chains: add an entry to `CHAINS` in `evm.js` |
| Viral z X | Snapshot `data/x_viral.json`: topics with pre-resolved coins (`topics[].coins`, Kyvo chains only, real volume), **Tweety traderów** (`trader_tweets`: posts from `tools/x_accounts.json` that mention a contract address or an unambiguous `$TICKER`, resolved on DexScreener; unresolved/ambiguous are dropped), and key posts. Live MC/24h refreshed from DexScreener in the browser |
| Insider / fresh wallets | Still demo-labelled |

Marker: `KYVO_MVP_LIVE_v7_2` · SW: `kyvo-mvp-v7-2`

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

# Viral z X — see tools/update_x_viral.md (x MCP, ~12–25 reads)
python3 tools/update_x_viral.py --from-raw raw_doc.json --trader-raw /tmp/x_raw/*.txt --resolve-topics
# or just refresh timestamps / coin matches:
python3 tools/update_x_viral.py --resolve-topics --stamp
```

One-liner after X dump is ready:

```bash
python3 tools/build_snapshots.py && python3 tools/update_x_viral.py --stamp
```

## Legal

Memecoins are extremely risky. Kyvo shows public market data and public wallet activity attributed from public sources (Solana Tracker titles, Alez-confirmed KOL wallets). No custody, no trading bots, no private keys.
