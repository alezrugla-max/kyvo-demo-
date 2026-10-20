#!/usr/bin/env python3
"""Kyvo auto-calls -> Discord (runs in GitHub Actions, NOT on the trading VPS).

Every run (cron ~15 min): fresh Solana + BSC coins from public APIs (DexScreener + GeckoTerminal), the same
"Good Coins" filter as the app, then Kyvo Check (same scoring as the app: 100 - 25 per red flag - 9 per warning,
RugCheck for Solana, GoPlus for both). Only STRONG coins (score >= MIN_SCORE, min liquidity) are posted.

Secrets (GitHub -> Settings -> Secrets and variables -> Actions), NEVER in the repo:
  DISCORD_WEBHOOK_SOL, DISCORD_WEBHOOK_BSC   (calls)       DISCORD_WEBHOOK_NEWS  (optional, manual changelog)
Missing secret -> that channel is skipped quietly (exit 0).

State (dedupe + rate limit) lives in a small JSON file (default .kyvo_calls/posted.json) that the workflow keeps
in actions/cache — no commits, so GitHub Pages is not rebuilt every 15 minutes.

Local test (prints embeds, posts nothing):   python3 tools/discord_calls.py --dry-run
Changelog post:   python3 tools/discord_calls.py --news "Kyvo v8.2: ..."      (needs DISCORD_WEBHOOK_NEWS)
Only public data, no keys needed for reading. Not financial advice.
"""
from __future__ import annotations
import argparse, json, os, sys, time, urllib.parse, urllib.request
from pathlib import Path

APP = os.environ.get("KYVO_APP_URL", "https://alezrugla-max.github.io/kyvo-demo-/")
DS = "https://api.dexscreener.com"
GT = "https://api.geckoterminal.com/api/v2"
RC = "https://api.rugcheck.xyz/v1/tokens/"
GP = "https://api.gopluslabs.io/api/v1/"
CHAINS = {"solana": {"gt": "solana", "secret": "DISCORD_WEBHOOK_SOL", "fomo": "solana", "label": "Solana"},
          "bsc": {"gt": "bsc", "secret": "DISCORD_WEBHOOK_BSC", "fomo": "bnb", "label": "BSC"}}
# Good Coins defaults from the app (app.js DEFAULT_FILTERS.good) + stricter posting floor
GOOD = {"mcap_min": 50_000, "liq_min": 20_000, "vol_min": 25_000, "age_max_h": 720, "age_min_h": 2, "buy_ratio_min": 0.4, "socials": True}
MIN_SCORE = int(os.environ.get("KYVO_CALLS_MIN_SCORE", "75"))
MIN_LIQ_POST = float(os.environ.get("KYVO_CALLS_MIN_LIQ", "30000"))
MAX_PER_HOUR = int(os.environ.get("KYVO_CALLS_MAX_PER_HOUR", "5"))
MAX_PER_RUN = 2           # per channel, keeps the feed calm
REPOST_AFTER_H = 72       # never post the same coin twice within 3 days
UA = {"User-Agent": "kyvo-discord-calls/8.2 (+https://github.com/alezrugla-max/kyvo-demo-)", "Accept": "application/json"}
RC_PL = {
    "Top 10 holders high ownership": "Top 10 holderów ma >70% podaży", "High holder concentration": "Top 10 holderów ma >50% podaży",
    "High ownership": "Najwięksi holderzy mają >80% podaży", "Single holder ownership": "Jeden portfel ma dużą część podaży",
    "Large Amount of LP Unlocked": "LP odblokowane", "Low amount of LP Providers": "Mało dostawców płynności",
    "Low Liquidity": "Bardzo mała płynność", "Mutable metadata": "Metadane można zmienić",
    "Freeze Authority still enabled": "Freeze authority włączone", "Mint Authority still enabled": "Mint authority włączone",
    "Creator history of rugged tokens": "Twórca ma w historii rugi", "Copycat token": "Możliwa kopia innego tokena",
    "Low amount of holders": "Bardzo mało holderów", "Transfer fee": "Opłata od transferu",
}

def get(url: str, timeout: int = 20):
    for i in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 429: time.sleep(3 * (i + 1)); continue
            return None
        except Exception:
            time.sleep(1.5 * (i + 1))
    return None

def fmt_usd(v) -> str:
    if v is None: return "—"
    v = float(v)
    for d, s in ((1e9, "B"), (1e6, "M"), (1e3, "K")):
        if abs(v) >= d: return f"${v / d:.2f}{s}"
    return f"${v:.0f}"

def age_label(h) -> str:
    if h is None: return "?"
    return f"{max(1, round(h * 60))} min" if h < 1 else f"{round(h)} h" if h < 48 else f"{round(h / 24)} dni"

# ---------------- candidates ----------------
def candidates(chain: str) -> list[str]:
    addrs: list[str] = []
    for path in ("/token-profiles/latest/v1", "/token-boosts/latest/v1", "/token-boosts/top/v1"):
        for t in get(DS + path) or []:
            if isinstance(t, dict) and t.get("chainId") == chain and t.get("tokenAddress"): addrs.append(t["tokenAddress"])
    net = CHAINS[chain]["gt"]
    for kind in ("trending_pools", "new_pools"):
        for page in (1, 2):
            d = get(f"{GT}/networks/{net}/{kind}?page={page}") or {}
            for p in d.get("data") or []:
                rid = (((p.get("relationships") or {}).get("base_token") or {}).get("data") or {}).get("id", "")
                if "_" in rid: addrs.append(rid.split("_", 1)[1])
            time.sleep(2.1)   # GeckoTerminal free tier ~30 req/min
    seen, out = set(), []
    for a in addrs:
        k = a.lower()
        if k not in seen: seen.add(k); out.append(a)
    return out[:150]

def pairs_for(chain: str, addrs: list[str]) -> list[dict]:
    best: dict[str, dict] = {}
    for i in range(0, len(addrs), 30):
        for p in get(f"{DS}/tokens/v1/{chain}/" + ",".join(addrs[i:i + 30])) or []:
            b = (p.get("baseToken") or {}).get("address")
            if not b or p.get("chainId") != chain: continue
            liq = (p.get("liquidity") or {}).get("usd") or 0
            if b.lower() not in best or liq > ((best[b.lower()].get("liquidity") or {}).get("usd") or 0): best[b.lower()] = p
        time.sleep(0.3)
    return list(best.values())

def to_coin(p: dict) -> dict:
    b = p.get("baseToken") or {}; info = p.get("info") or {}
    tx = ((p.get("txns") or {}).get("h1") or {})
    buys, sells = tx.get("buys") or 0, tx.get("sells") or 0
    created = p.get("pairCreatedAt")
    dex = p.get("dexId") or ""
    return {
        "chain": p.get("chainId"), "address": b.get("address"), "symbol": b.get("symbol") or "?", "name": b.get("name") or "",
        "mcap": p.get("marketCap") or p.get("fdv"), "liq": (p.get("liquidity") or {}).get("usd"), "vol24": (p.get("volume") or {}).get("h24"),
        "h1": (p.get("priceChange") or {}).get("h1"), "h24": (p.get("priceChange") or {}).get("h24"),
        "age_h": (time.time() * 1000 - created) / 3.6e6 if created else None,
        "buy_ratio": buys / (buys + sells) if buys + sells else None, "tx_h1": buys + sells,
        "socials": bool(info.get("socials") or info.get("websites")), "image": info.get("imageUrl"),
        "on_curve": dex in ("pumpfun", "fourmeme"), "dex": dex, "boost": ((p.get("boosts") or {}).get("active") or 0),
        "ds_url": p.get("url") or f"https://dexscreener.com/{p.get('chainId')}/{b.get('address')}",
    }

def good(c: dict) -> bool:
    if (c["mcap"] or 0) < GOOD["mcap_min"] or (c["liq"] or 0) < GOOD["liq_min"] or (c["vol24"] or 0) < GOOD["vol_min"]: return False
    if c["age_h"] is None or c["age_h"] > GOOD["age_max_h"] or c["age_h"] < GOOD["age_min_h"]: return False
    if GOOD["socials"] and not c["socials"]: return False
    if c["buy_ratio"] is not None and c["tx_h1"] >= 10 and c["buy_ratio"] < GOOD["buy_ratio_min"]: return False
    return True

# ---------------- Kyvo Check (same rules/score as insights.js) ----------------
def kyvo_check(c: dict, universe: list[dict]) -> tuple[int, list[tuple[str, str]]]:
    out: list[tuple[str, str]] = []
    add = lambda lvl, t: out.append((lvl, t))
    liq, mc = c["liq"], c["mcap"]
    if c["on_curve"]: add("info", "Na krzywej bonding curve")
    elif liq is None or liq < 5000: add("bad", f"Bardzo mała płynność ({fmt_usd(liq)})")
    elif liq < 20000: add("warn", f"Mała płynność ({fmt_usd(liq)})")
    else: add("ok", f"Płynność {fmt_usd(liq)}")
    if not c["on_curve"] and liq and mc and liq / mc < 0.03: add("warn", "Płynność <3% MC")
    a = c["age_h"]
    if a is None: add("warn", "Nieznany wiek pary")
    elif a < 1: add("warn", "Bardzo nowy coin")
    elif a >= 24: add("ok", f"Istnieje od {age_label(a)}")
    add("ok", "Ma socials/stronę") if c["socials"] else add("warn", "Brak socials")
    if c["buy_ratio"] is not None and c["tx_h1"] >= 20 and c["buy_ratio"] < 0.35: add("warn", f"Przewaga sprzedaży 1h ({round(c['buy_ratio'] * 100)}% kupna)")
    if c["h1"] is not None and c["h1"] <= -40: add("bad", f"Spadek {c['h1']:.0f}% w 1h")
    same = [x for x in universe if x["address"] != c["address"] and x["symbol"].lower() == c["symbol"].lower()]
    if any((x["liq"] or 0) > (liq or 0) * 3 and (x["mcap"] or 0) > (mc or 0) * 3 for x in same): add("bad", "Możliwa podróbka (większy coin z tym tickerem)")
    elif same: add("warn", "Ten sam ticker ma inne coiny")
    if c["chain"] == "solana":
        rc = get(RC + urllib.parse.quote(c["address"]) + "/report/summary")
        if rc and isinstance(rc.get("risks"), list):
            for r in rc["risks"][:8]:
                lvl = "bad" if r.get("level") == "danger" else "warn" if r.get("level") == "warn" else "info"
                if c["on_curve"] and "holder" in str(r.get("name", "")).lower(): lvl = "info"
                add(lvl, RC_PL.get(r.get("name", ""), str(r.get("name", ""))[:60]))
            if not rc["risks"]: add("ok", "RugCheck: brak ryzyk")
            if not c["on_curve"] and isinstance(rc.get("lpLockedPct"), (int, float)) and rc["lpLockedPct"] >= 90: add("ok", f"LP zablokowane {round(rc['lpLockedPct'])}%")
        g = ((get(GP + "solana/token_security?contract_addresses=" + c["address"]) or {}).get("result") or {}).get(c["address"])
        if g:
            st = lambda o: isinstance(o, dict) and str(o.get("status")) == "1"
            add("bad", "Mint authority włączone") if st(g.get("mintable")) else add("ok", "Mint wyłączony")
            add("bad", "Freeze włączone") if st(g.get("freezable")) else add("ok", "Freeze wyłączony")
            if st(g.get("balance_mutable_authority")): add("bad", "Salda można zmieniać")
    elif c["chain"] == "bsc":
        res = (get(GP + "token_security/56?contract_addresses=" + c["address"]) or {}).get("result") or {}
        g = res.get(c["address"].lower()) or res.get(c["address"])
        if g:
            one = lambda v: str(v) == "1"
            if one(g.get("is_honeypot")): add("bad", "HONEYPOT")
            elif g.get("is_honeypot") == "0": add("ok", "Nie honeypot")
            if one(g.get("cannot_sell_all")): add("bad", "Nie da się sprzedać całości")
            try: bt, stx = float(g.get("buy_tax") or 0), float(g.get("sell_tax") or 0)
            except ValueError: bt = stx = 0.0
            if stx > 0.1: add("bad", f"Podatek sprzedaży {stx * 100:.0f}%")
            elif bt > 0 or stx > 0: add("warn", f"Podatek {bt * 100:.1f}% / {stx * 100:.1f}%")
            else: add("ok", "Bez podatku")
            if one(g.get("is_mintable")): add("warn", "Można dodrukować")
            if one(g.get("owner_change_balance")): add("bad", "Właściciel zmienia salda")
            if one(g.get("hidden_owner")) or one(g.get("can_take_back_ownership")): add("bad", "Ukryty właściciel")
            if g.get("is_open_source") == "0": add("warn", "Kod niezweryfikowany")
    score = max(0, min(100, 100 - 25 * sum(l == "bad" for l, _ in out) - 9 * sum(l == "warn" for l, _ in out)))
    return score, out

# ---------------- Discord ----------------
def embed(c: dict, score: int, checks: list[tuple[str, str]]) -> dict:
    ch = CHAINS[c["chain"]]
    key = urllib.parse.quote(f"{c['chain']}:{c['address']}", safe="")
    kyvo = f"{APP}#coin/{key}"
    fomo = f"https://fomo.family/tokens/{ch['fomo']}/{c['address']}"
    oks = [t for l, t in checks if l == "ok"][:3]
    risks = [("⚠️ " if l == "warn" else "⛔ ") + t for l, t in checks if l in ("warn", "bad")][:2]
    e = {
        "title": f"${c['symbol']} · {c['name']}"[:250],
        "url": kyvo,
        "color": 0x22C55E if score >= 85 else 0x84CC16,
        "description": f"`{c['address']}`",
        "fields": [
            {"name": "Sieć", "value": ch["label"], "inline": True},
            {"name": "MC", "value": fmt_usd(c["mcap"]), "inline": True},
            {"name": "Płynność", "value": fmt_usd(c["liq"]), "inline": True},
            {"name": "Wiek", "value": age_label(c["age_h"]), "inline": True},
            {"name": "Vol 24h", "value": fmt_usd(c["vol24"]), "inline": True},
            {"name": "Kyvo Check", "value": f"**{score}/100**", "inline": True},
            {"name": "Dlaczego", "value": ("\n".join("✅ " + t for t in oks) + ("\n" + "\n".join(risks) if risks else ""))[:1000] or "—", "inline": False},
            {"name": "Linki", "value": f"[Kyvo]({kyvo}) · [DexScreener]({c['ds_url']}) · [FOMO]({fomo})", "inline": False},
        ],
        "footer": {"text": "Auto scan by Kyvo – NFA, DYOR · zawsze sprawdź adres (CA)"},
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    if c.get("image"): e["thumbnail"] = {"url": c["image"]}
    return e

def post(webhook: str, payload: dict) -> bool:
    data = json.dumps(payload).encode()
    for _ in range(3):
        try:
            req = urllib.request.Request(webhook, data=data, headers={**UA, "Content-Type": "application/json"}, method="POST")
            urllib.request.urlopen(req, timeout=20).read(); return True
        except urllib.error.HTTPError as e:
            if e.code == 429:
                try: wait = float(json.loads(e.read() or b"{}").get("retry_after", 2))
                except Exception: wait = 2
                time.sleep(min(wait, 30)); continue
            print(f"webhook error HTTP {e.code}", file=sys.stderr); return False   # never print the webhook URL
        except Exception as e:
            print("webhook error", type(e).__name__, file=sys.stderr); return False
    return False

def load_state(p: Path) -> dict:
    try: return json.loads(p.read_text())
    except Exception: return {"posted": {}, "hist": {}}

def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--dry-run", action="store_true", help="print embeds, post nothing")
    ap.add_argument("--state", type=Path, default=Path(os.environ.get("KYVO_CALLS_STATE", ".kyvo_calls/posted.json")))
    ap.add_argument("--chains", default="solana,bsc")
    ap.add_argument("--news", help="post this changelog text to DISCORD_WEBHOOK_NEWS and exit")
    a = ap.parse_args()

    if a.news is not None:
        hook = os.environ.get("DISCORD_WEBHOOK_NEWS", "").strip()
        payload = {"username": "Kyvo", "allowed_mentions": {"parse": []}, "embeds": [{"title": "👻 Kyvo — co nowego", "description": a.news[:3900], "url": APP, "color": 0xA78BFA, "footer": {"text": "Kyvo · NFA, DYOR"}}]}
        if a.dry_run or not hook:
            print(("DRY RUN" if a.dry_run else "DISCORD_WEBHOOK_NEWS not set -> skipped"), json.dumps(payload, ensure_ascii=False, indent=1)); return 0
        return 0 if post(hook, payload) else 1

    hooks = {ch: os.environ.get(CHAINS[ch]["secret"], "").strip() for ch in CHAINS}
    chains = [c for c in a.chains.split(",") if c in CHAINS and (a.dry_run or hooks[c])]
    if not chains:
        print("No DISCORD_WEBHOOK_SOL / DISCORD_WEBHOOK_BSC secret set -> nothing to do."); return 0
    st = load_state(a.state); now = time.time()
    st["posted"] = {k: t for k, t in st.get("posted", {}).items() if now - t < REPOST_AFTER_H * 3600}
    for chain in chains:
        hist = [t for t in st.get("hist", {}).get(chain, []) if now - t < 3600]
        room = min(MAX_PER_RUN, MAX_PER_HOUR - len(hist))
        coins = [to_coin(p) for p in pairs_for(chain, candidates(chain))]
        good_coins = [c for c in coins if good(c) and (c["liq"] or 0) >= MIN_LIQ_POST and f"{chain}:{c['address'].lower()}" not in st["posted"]]
        good_coins.sort(key=lambda c: -(c["vol24"] or 0))
        print(f"[{chain}] candidates={len(coins)} good&new={len(good_coins)} room={room}")
        sent = 0
        for c in good_coins[:12]:
            if sent >= max(0, room) and not a.dry_run: break
            score, checks = kyvo_check(c, coins)
            if score < MIN_SCORE:
                print(f"  skip ${c['symbol']} score {score}"); continue
            payload = {"username": "Kyvo Calls", "allowed_mentions": {"parse": []}, "embeds": [embed(c, score, checks)]}
            if a.dry_run:
                print(json.dumps(payload, ensure_ascii=False, indent=1)); sent += 1
                if sent >= MAX_PER_RUN: break
                continue
            if post(hooks[chain], payload):
                st["posted"][f"{chain}:{c['address'].lower()}"] = now; hist.append(now); sent += 1
                print(f"  posted ${c['symbol']} score {score}"); time.sleep(1.2)
        st.setdefault("hist", {})[chain] = hist
    if not a.dry_run:
        a.state.parent.mkdir(parents=True, exist_ok=True); a.state.write_text(json.dumps(st))
    return 0

if __name__ == "__main__":
    sys.exit(main())
