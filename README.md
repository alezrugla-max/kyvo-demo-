# Kyvo v5

Live Solana memecoin Pulse (Axiom-style columns) + filters + Viral z X.

## Tabs
- **Pulse** — desktop: New / Final Stretch / Migrated side-by-side; iPhone: swipeable
- **New Pairs** — newest Solana pairs, default **MC ≥ $10k**
- **Final Stretch** — `dexId=pumpfun` still on bonding curve; curve% estimated as `MC / ~$69k` (labeled estimate). Default shows ≥55%, fallback top ≥50%
- **Migrated** — `pumpswap` / `raydium` / `meteora` / `orca` (DexScreener dexId)
- **Good Coins** — stricter quality filters (liq/MC/vol/socials/buy ratio)
- **Hot / Boosted** — DexScreener profiles & boosts
- **Viral z X** — static snapshot `data/x_viral.json`

Filters per tab persist in `localStorage` (`kyvo_filters_v5`). Reset restores defaults.

Marker: `KYVO_MVP_LIVE_v5` · SW cache: `kyvo-mvp-v5`

Not financial advice. Public data only (DexScreener, GeckoTerminal new pools).
