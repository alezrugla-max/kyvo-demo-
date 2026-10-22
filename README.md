# Kyvo v8.0

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

Marker: `KYVO_LIVE_v8_0` (meta `kyvo-build`, hidden `#mvpMarker`, `window.__KYVO__.MVP_MARKER`) · SW: `kyvo-v8-0`

## v8.0 — public launch

| Feature | Notes |
|--------|-------|
| Onboarding | `launch.js`: 5 swipeable cards on first launch (`kyvo_onboard_v8` in localStorage), skippable, re-open from Więcej / Jak korzystać. `?noonboard` skips it (for screenshots) |
| Jak korzystać | `#help` — FAQ for every tab, filter, "na liście od", SM badges, PnL windows/limits, login, Premium |
| Legal (PL) | `#legal/regulamin`, `#legal/prywatnosc`, `#legal/zrodla`, `#legal/ryzyko`; links in footer, Więcej, Profil |
| Login | `auth.js` + `auth-config.js`. **Wallet sign-in works now**: Phantom / Solflare (`signMessage`) and MetaMask / any EIP-1193 wallet (`personal_sign`). Only a readable text message is signed (never a transaction); signature verified client-side with `vendor/kyvo-crypto` (tweetnacl ed25519 + noble secp256k1/keccak, licenses included). Session = `kyvo_session_v1` in localStorage, re-verified on load; the address is added to Profil. No injected wallet on mobile → deep link (`phantom.app/ul/browse/…`, `solflare.com/ul/v1/browse/…`, `metamask.app.link/dapp/…`). **Google + e-mail link** (Firebase Auth, SDK loaded from gstatic only when enabled) are code-ready but OFF (`enabled:false`, placeholder config) → buttons show "Wkrótce". Apple = "Wkrótce". Guests keep full access ("Kontynuuj bez logowania") |
| Premium | `#premium`, `premium-config.js` (`enabled:false`, Stripe Payment Link placeholders, `trialDays:3`). Regular $9.99/mies., launch price $3.99/mies. ("Cena startowa dla pierwszych użytkowników", no deadline/seat count), trial requires card / Apple Pay / Google Pay (no BLIK for subscriptions). Requires login. CTA shows "Wkrótce" → Kontakt. Every Premium feature is labelled "wkrótce" — none is claimed as working |
| Kontakt | `#kontakt`, `contact-config.js` (`DISCORD_HANDLE:'TODO'` → shows "pojawi się tu wkrótce"; set the handle to show a copy button; optional invite URL) |
| Share | `<title>`, meta description, Open Graph + Twitter `summary_large_image` (`og-image.png` 1200×630), icons 16–512 + maskable, apple-touch icons, 8 iOS splash screens (`icons/splash/`), manifest shortcuts |
| Data reset | Więcej → "Wyczyść dane Kyvo" removes every `kyvo_*` localStorage key and SW caches |

### To enable later
- **Google / e-mail login**: follow `firebase_setup_pl.md` (repo root, Polish step-by-step), paste the 4 public web-config values into `auth-config.js`, set `google.enabled` / `email.enabled` to `true`.
- **Payments**: Stripe account of an adult (parent/guardian) or a company. Create two subscription Payment Links (promo $3.99, regular $9.99, 3-day trial, card required), paste them into `premium-config.js`, set `enabled:true`. Real Premium entitlement needs a backend (e.g. Firebase + Stripe webhook/extension) — not built yet. Never put a Stripe secret key (`sk_…`) in this repo.
- **Discord**: set `DISCORD_HANDLE` (and optionally `DISCORD_INVITE_URL`) in `contact-config.js`.

### ⚠️ Legal — owner to-do (not shown in the UI)
- Regulamin, Polityka prywatności, Źródła danych and Ryzyko are a **plain-language template**. Have them checked by a lawyer **before monetization** (Premium, ads, affiliate links) and before enabling Google/e-mail login.
- Polish law (UŚUDE) expects the service provider to be identifiable with contact details; currently only a Discord placeholder is shown. Add an operator name/contact (likely a parent or a company while the owner is a minor).
- **Subscription terms** in Regulamin §7c (auto-renewal, cancel anytime, trial converts to paid unless cancelled, Stripe as processor, withdrawal right) are placeholders for **lawyer review**; consumer-law info (prawo odstąpienia, digital content rules) must be finalized before payments go live.
- **GDPR**: once Firebase login is enabled, the Firebase project owner is the **data controller** for name/e-mail/avatar/uid — needs a named controller + contact in the privacy policy, a records-of-processing note, Google as processor (Firebase DPA), and working account deletion (implemented: Profil → "Usuń konto Kyvo").
- Regulamin states 18+. Decide with the lawyer.

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

## v8.12 (KYVO_LIVE_v8_12 · SW kyvo-v8-12) — 🥇 Gold
Orangie-style coin DD ("Grok bot" + "Memecoin Digester") as a new tab **🥇 Gold** (bottom bar + seg bar, `#gold`, `#gold/<chain>:<CA>`).
- **Sprawdź coin** (gold.js + gold-rules.js, in the browser): paste a CA / pump.fun / DexScreener link / `$ticker` (ticker → the pool with the most liquidity + volume, other coins with that ticker listed). Verdict 🥇 Gold / 🟡 Hazard / 🔴 Trzymaj się z daleka + DD checklist in Polish (EN via L2): avg trade size (≈$10–15 = volume bots), share of < $5 trades, MC vs liquidity, holder counter vs wallets that traded in 24 h (holder farm), top 1 / top 10, single buy that filled the pump.fun curve, bundle / insiders, mint / freeze / LP lock (RugCheck; GoPlus on BSC), borrowed celebrity name vs official (linked X handle / tweeted by that handle), copies / vamps (which one is the original), age + migration, buy/sell pressure, 5m / 1h / 6h change, links, KOL holding / tweeting (can be the narrative), news (from the Gold feed).
- **Feed Gold** (`tools/gold.py` → `data/gold.json`, every ~5 min in the kyvo-push loop, background job ≤ 230 s): ~14 hot coins (Runners, KOL coins, tweet coins, boosts, GT trending, 🔎 scanner hits) with the same verdict (shared `gold-rules.js` via node), Google News RSS headlines with the coin's name (24 h / 48 h / trend), KOL tweets, copies.
- **🔎 Auto-skaner** (`tools/gold_filters.json`, tune without code): discovery from GT trending 1 h + GT new pools + DS latest profiles / boosts (Solana + BSC), exact rule on DexScreener data, DD on every hit, card tagged "🔎 Filtr: …", hit kept 6 h. Presets: 🚀 +100 % in 1 h & MC ≥ $1M · 🎓 pump.fun graduate < 1 h, MC ≥ $75K, ≥ 60 buys/h, then real holders (≥ 150 holders, avg trade ≥ $30, top 10 ≤ 45 %) · 🌊 1 h volume ≥ 50 % MC, +20 %, MC $250K–$5M (no push). Max 5 hits/run.
- **Gold alerts** (OneSignal tag `gold`, Premium only unless `KYVO_GOLD_FREE_PUSH=1`): 📈/📉 ±15 % (±20 % under $300K MC) on Gold coins (45-min cooldown), 🧛 vamp copy > $500K MC, 📰 new article (≤ 6 h old, 1 per coin per 2 h), 🔎 filter hit with Gold/Hazard verdict (12 h cooldown per coin, ≤ 3/h). ≤ 4 Gold alerts/h overall, ≤ 2 per push run, dedupe ids, expire after 1 h; first run only seeds. In-app (app open): ±15 % and vamp alerts for ⭐ watchlist coins (Premium, notify setting 🥇 Gold).
- **Gating** (`window.KYVO_GOLD_CONFIG` in premium-config.js): free = 3 checks per Warsaw day (re-checking the same coin is free) + 1 full feed card per day (others: level + age only); Premium = unlimited, full feed, Gold push. `enabled:false` hides the tab.
- **Limits:** client-side gates (bypassable); "real holders" = RugCheck counter vs GT unique traders 24 h (no paid holder API); curve-fill only for coins < ~26 h (GT keeps 300 trades / 24 h); news = Google News RSS server-side (personal/non-commercial terms), matched by name; GeckoTerminal free limit ~30 req/min (calls spaced 2.2 s, cached); verdicts are heuristics, not advice. Big established coins (MC ≥ $50M, ≥ 30 days) get indicative flags only and max Hazard; the feed skips MC > $50M and stables.

## v8.11 (KYVO_LIVE_v8_11 · SW kyvo-v8-11)
- 🏃 **Runners are Premium.** Free plan: 1 Runner per Europe/Warsaw day — the first Runner flagged that day (earliest flag time, remembered per device for the day). Every other Runner (👑 KOL coin, 🚀 Moon run, 📈 Big runner, 🐦 Tweet runner, 🔁 second leg, super-important tweets) shows as a locked card: kind + flag time only, no name / ticker / CA / logo / chart / links; "✦ Odblokuj Premium" opens the existing Premium pop-up.
- No leaks via the Runner badge (best effort): New Tweet tab shows the 🐦 Tweet runner highlight only when unlocked (no 🔒 badge either), 📊 Wyniki masks Runner rows from the last 24 h, in-app Runner alerts fire only for the free Runner. Coin detail / search / watchlist never showed a Runner badge.
- Push (tools/kyvo_push.py): premium=1 gets every Runner; premium≠1 gets at most 1 Runner push per Warsaw day (the first one sent), still inside the 2/day free cap.
- Owner unlock: `?owner=<token>` → SHA-256 checked against the hash in premium-config.js (token never in the repo), stored on the device (`kyvo_owner_tok`, survives reloads / SW updates / "clear data"), URL param stripped, toast "Premium aktywne (właściciel)", OneSignal tag premium=1 re-synced.
- **Limit:** static PWA + public data/*.json → the gate is client-side and bypassable by a technical user. Real enforcement needs login + entitlement (Supabase/Firebase + Stripe webhook) and a server-filtered Runner feed (Edge Function returning full Runner data only to Premium tokens; the public JSON would carry only locked stubs), plus per-user push targeting (OneSignal external_id) instead of client-set tags.

## v8.10 (KYVO_LIVE_v8_10 · SW kyvo-v8-10)
- 🐦 **New Tweet = a moving feed**: every own tweet (no retweets; replies only when they name a coin) from ~43 tracked accounts in the last 12 h, newest first, sections "<2 h" / "Wcześniej". Previously tweets without a resolvable coin were dropped, so the tab showed ~2 tweets.
- Tracked list expanded (`tools/x_accounts.json` → `live_more`: WhiteHouse, saylor, justinsuntron, brian_armstrong, VitalikButerin, MrBeast, Cobratate, cb_doge, DogeDesigner, KookCapitalLLC, ZssBecker, theunipcs, rajgokal, ShockedJS, WatcherGuru, binance, BNBCHAIN, solana). These feed New Tweet only, not 👑 KOL coin.
- Coin per tweet: **✅ Wspomniany coin** ($ticker / CA in the tweet) → else **🔗 Powiązany coin**: the highest-volume fresh Solana/BSC coin (DexScreener search, free) whose name/ticker matches the tweet's key word and that launched −2…+60 min after the tweet (min MC $15k, vol24 $10k, real 1 h activity; obvious rugs dropped) → else **⏳ Brak coina jeszcze** (a coin can attach on later runs, for tweets ≤ 90 min).
- Price since tweet (or since launch for related coins) refreshed every run; 🚀 "Pompuje" = ≥ +30 %, or ≥ +8 % on a 3× volume spike. Filter chips: Wszystkie / Z coinem / Pompuje.
- Push / 🐦 Tweet runner / KOL coin: unchanged rules, **only mentioned coins** (related coins never push).
- Loop: tweet read every ~150 s (was 240), FxTwitter 3 tries, background job limit 230 s.

## v8.9 (KYVO_LIVE_v8_9 · SW kyvo-v8-9)
- ⏱ **Continuous feeds** (`tools/kyvo_loop.py`, `.github/workflows/kyvo-push.yml`): one run loops ~51 min in 3 chunks
  (state saved to actions/cache after each chunk): Runner scan every ~90 s, New Tweet read every ~4 min (in parallel, GT budget 5),
  OneSignal push right after each step (same sent-ids dedupe + free 2/day cap). Feed commits only on new items
  (or a 30-min heartbeat), ≤ 1 per 3 min and ≤ 7 per hour (GitHub Pages branch build: soft limit 10 builds/h, shared).
  The run requeues itself (`gh workflow run`, only after success); cron */15 is a backstop; `concurrency: kyvo-push` = 1 running + 1 queued.
  Kill switch: repo variable `KYVO_LOOP_CHAIN=0`. RugCheck/GoPlus answers cached 10 min (`.kyvo_push/facts`).
- App polls `data/x_live.json` and `data/kol_live.json` every 60 s while open (1-min `?t=` cache-bust) and re-renders only on change.
- 📈 **Duży runner / Big runner** (`bigRunnerRule` in insights.js = tools/upside_estimate.js `--big`): established $1M–$100M coins
  (≥ 6 h old) running now — strong 1 h (or 6 h) move, last-hour volume far above its 24 h average, trades above the 6 h pace,
  buyers dominate, healthy liquidity, Kyvo Check floor, not parabolic / not dumping. Server adds GT 1 h trending + top-volume pools,
  hard-rug + copycat guard + unique buyers (≥ threshold, rising vs 6 h, no wash trading) → `badge: "big"` in `data/kol_live.json` + push.
  Second wave (🔁) MC cap 30M → 100M. Runner cards show MC on the right. Research: `tools/big_runner_research.py`.
- 📊 **Charts** (`chart.js`): GT queue with a priority lane for the open chart (background GT calls pause while it loads), 12-s
  timeout per call, backoff 3/6/12 s, OHLCV 404 → token's own GT pool, empty OHLCV on new pools → 1-min candles from trades,
  12-s watchdog → DexScreener embed (15-s load watchdog) → simple line from DexScreener % changes; four.meme curve pairs go
  straight to DexScreener; chart library loaded on demand if missing; reopen reuses a healthy chart / remembers a fallback for 3 min.
  SW: `vendor/` cache-first.

## v8.8 (KYVO_LIVE_v8_8 · SW kyvo-v8-8)
- 👑 **KOL coin** (Runner override, `tools/kol_coins.py`, called from `tools/discord_calls.py` in kyvo-push / kyvo-calls):
  a fresh coin whose on-chain metadata / DexScreener socials link EXACTLY a curated KOL X handle (`tools/x_accounts.json`
  accounts + live_extra + kol_extra + every kolscan leaderboard handle) AND one more proof (biggest holder = known KOL wallet,
  or = the wallet of the coin's linked pump.fun profile, or a tracked account tweeted this CA in `data/x_live.json`), plus
  momentum (volume, trades, unique buyers from GeckoTerminal). Flagged as Runner + push even if the Kyvo Check / holder
  concentration fails; the 30M MC cap is lifted for KOL coins in their first hours.
- 🚀 **Moon run · wysokie ryzyko**: no KOL proof, but extreme real momentum in the first hours (MC into the millions very fast,
  huge volume, thousands of trades and unique buyers, low trades-per-wallet = no wash trading).
- Hard-rug protections stay for both: mint/freeze authority, rugged, mutable balances, transfer fee, unlocked AMM LP, bundled
  launch (RugCheck insider network), dev-held supply, same-ticker/same-name copycat (older or ≥3× bigger original),
  impersonation (linked X is a post by another account, mixed links, or not the real big account); BSC honeypot/sell tax.
- App: Runner tab shows them first with the badge and a clear ⚠️ high-risk line (e.g. "~75% podaży leży w portfelu KOL-a");
  feed `data/kol_live.json` (committed by kyvo-push only when it changes). No thresholds in the UI. Free users: same 2 push/day cap.
- New Tweet: + @kimchi1x. Backfill + notes: `kyvo_v8_8_notes.md` (box only).

## v8.7 (KYVO_LIVE_v8_7 · SW kyvo-v8-7)
- ⭐ **Watchlist "od dodania"**: adding a coin stores the entry point (time, price USD, MC) in `kyvo_watch_v1`.
  Each row shows % since added (green/red), MC entry → now, "dodano 2 godziny temu", $100 → $X and the peak % since added
  (taken from the 30 s DexScreener refreshes while Kyvo is open). Summary card: "$100 in each" total, best and worst coin.
- Migration: watchlist entries saved before v8.7 without an entry price take the first live price after the update and are
  marked "📍 liczone od teraz" / "od startu". Coins added without a price wait for the first live price (≤ 30 s).

## v8.6 (KYVO_LIVE_v8_6 · SW kyvo-v8-6)
- 🐦 **New Tweet** tab (`#tweets`): fresh tweets (≤2 h on top, ≤24 h below with real age) from tracked accounts that name a coin
  (contract address or unambiguous $ticker on DexScreener) — coin logo, chain, MC, price since tweet, volume after vs 1 h before,
  🚀 "Pompuje po tweecie". Data: `data/x_live.json`, built by `tools/x_live.py` (public FxTwitter API, no X key).
- **Phone push (app closed)**: `.github/workflows/kyvo-push.yml` (cron */5, real cadence ~5–15 min) → `tools/x_live.py` +
  runner scan (`tools/discord_calls.py --flags-out`, no Discord posts) → `tools/kyvo_push.py` → OneSignal REST.
  Secret `ONESIGNAL_REST_API_KEY` only in GitHub Secrets; missing = no-op. Premium (tag premium=1) gets all; free max 2/day.
- Static privacy page `privacy.html` (PL + EN) for App Store Connect / Play Console "Privacy policy URL".

### v8.9 — 🐦 Tweet runner
A coin named in a tracked account's tweet (New Tweet feed: x_live / KOL) that clearly runs **after** the tweet, within the first few hours, gets:
a push (`🐦 Tweet runner: $X +NN% po tweecie @handle`, same OneSignal path, dedupe `twr:<coin>`, free cap 2/day, Premium unlimited),
a 🐦 badge plus a tweet link in Runner, and a highlighted card in New Tweet. The rule needs a strong price rise since the tweet, rising volume and buyers, and no dump in progress.
Only hard rugs and copycats are blocked, the same as v8.8. It is checked in every loop scan (about 90 s). Thresholds live only in `tools/kol_coins.py` (TW_T) and are not shown in the app.
