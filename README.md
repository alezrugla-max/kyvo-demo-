# Kyvo v7

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
| Leaderboard | Snapshot `data/leaderboard.json` (approx FIFO PnL; `—` when unreliable) |
| Viral z X | Snapshot `data/x_viral.json` |
| Insider / fresh wallets | Still demo-labelled |

Marker: `KYVO_MVP_LIVE_v7` · SW: `kyvo-mvp-v7`

## Refresh (box / CI)

```bash
# Smart money + leaderboard (~3–6 min, public RPC, no keys)
python3 tools/build_snapshots.py

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
