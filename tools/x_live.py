#!/usr/bin/env python3
"""Kyvo v8.6 — "New Tweet" feed: fresh tweets from tracked accounts that name a coin -> data/x_live.json.

Source: the public FxTwitter API (api.fxtwitter.com/2/profile/<handle>/statuses, no key, ~20 newest posts per account).
It is an unofficial third-party mirror of X: free, but it can rate-limit, lag or stop working at any time; when it fails
the previous data/x_live.json is kept (nothing is invented). Coins are resolved only from a contract address in the
tweet or an unambiguous $TICKER on DexScreener (same strict rules as tools/update_x_viral.py).
For each coin: MC / price now, price at tweet time + volume before / after the tweet (GeckoTerminal 5-min candles),
and pumping=True when price or volume clearly jumped after the tweet. Only public data. Not financial advice.
"""
from __future__ import annotations
import argparse, json, sys, time, urllib.request
from datetime import datetime, timezone
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from update_x_viral import ROOT, ACCOUNTS, KYVO_CHAINS, extract_mentions, resolve_address, resolve_ticker  # noqa: E402

OUT = ROOT / "data" / "x_live.json"
FX = "https://api.fxtwitter.com/2/profile/{}/statuses"
GT = "https://api.geckoterminal.com/api/v2"
GT_NET = {"solana": "solana", "bsc": "bsc", "robinhood": "robinhood"}
KEEP_H = 24          # tweets older than this are dropped from the file (the app shows <2 h as "fresh", the rest with real age)
MAX_ITEMS = 60
UA = {"User-Agent": "Mozilla/5.0 (kyvo-live/8.6; +https://alezrugla-max.github.io/kyvo-demo-/)", "Accept": "application/json"}

def get(url: str, timeout: int = 20):
    for i in range(2):
        try:
            return json.load(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout))
        except Exception as e:  # noqa: BLE001
            err = e; time.sleep(2 * (i + 1))
    print(f"  ! {url.split('?')[0][:90]}: {type(err).__name__}")
    return None

def accounts() -> list[dict]:
    d = json.loads(ACCOUNTS.read_text())
    out, seen = [], set()
    for a in d.get("accounts", []) + d.get("live_extra", []):
        h = a["handle"]
        if h.lower() in seen: continue
        seen.add(h.lower()); out.append(a)
    return out

def tweet_text(t: dict) -> str:
    """text + expanded links (a CA often sits only inside a dexscreener / pump.fun / gmgn link)."""
    s = t.get("text") or ""
    raw = t.get("raw_text") or {}
    for f in raw.get("facets") or []:
        for k in ("replacement", "original", "display"):
            if isinstance(f.get(k), str): s += " " + f[k]
    q = t.get("quote") or {}
    if q.get("text"): s += " " + q["text"]
    return s

def candles_after(c: dict, ts: int) -> dict | None:
    """price at tweet + volume 1 h before vs after the tweet, from GeckoTerminal 5-min candles of the top pool."""
    net = GT_NET.get(c.get("chain")); pool = c.get("pair")
    if not net or not pool: return None
    d = get(f"{GT}/networks/{net}/pools/{pool}/ohlcv/minute?aggregate=5&limit=300&currency=usd&token={c.get('address')}")
    rows = (((d or {}).get("data") or {}).get("attributes") or {}).get("ohlcv_list") or []
    time.sleep(2.1)  # GeckoTerminal public limit ~30 req/min
    if not rows: return None
    rows.sort(key=lambda r: r[0])
    before = [r for r in rows if r[0] < ts]
    after = [r for r in rows if r[0] >= ts - 300]
    if not after: return None
    px0 = before[-1][4] if before else after[0][1]
    if not before and rows[0][0] > ts: return {"pre_launch": True}
    vb = sum(r[5] for r in before if r[0] >= ts - 3600)
    va = sum(r[5] for r in after)
    hrs = max(5 / 60, (time.time() - ts) / 3600)
    return {"px_at_tweet": px0, "vol_1h_before": round(vb), "vol_after": round(va), "hours_after": round(hrs, 2)}

def _ts(iso) -> float:
    try: return datetime.fromisoformat(str(iso).replace('Z', '+00:00')).timestamp()
    except Exception: return 0.0

def main() -> int:
    ap = argparse.ArgumentParser(); ap.add_argument("--out", type=Path, default=OUT); ap.add_argument("--max-accounts", type=int, default=40)
    a = ap.parse_args()
    old = {}
    try: old = json.loads(a.out.read_text())
    except Exception: pass
    prev = {t["id"]: t for t in old.get("tweets", [])}
    now = time.time(); items: dict[str, dict] = {}
    ok_reads = 0
    for acc in accounts()[: a.max_accounts]:
        d = get(FX.format(acc["handle"]))
        time.sleep(1.0)
        if not d or d.get("code") != 200: continue
        ok_reads += 1
        for t in d.get("results") or []:
            if t.get("reposted_by") or t.get("type") != "status": continue          # skip retweets
            au = t.get("author") or {}
            if (au.get("screen_name") or "").lower() != acc["handle"].lower(): continue
            ts = int(t.get("created_timestamp") or 0)
            if not ts or now - ts > KEEP_H * 3600: continue
            tid = str(t["id"])
            if tid in prev and prev[tid].get("coins"):
                p = prev[tid]; p["metrics"] = {"likes": t.get("likes"), "reposts": t.get("reposts"), "replies": t.get("replies"), "quotes": t.get("quotes"), "bookmarks": t.get("bookmarks"), "views": t.get("views")}
                p["metrics_at"] = datetime.now(timezone.utc).isoformat(timespec="seconds"); items[tid] = p; continue
            coins = []
            for kind, val in extract_mentions(tweet_text(t))[:4]:
                c = resolve_address(val) if kind == "addr" else resolve_ticker(val)
                if c and c.get("chain") in KYVO_CHAINS and not any(x["address"] == c["address"] for x in coins): coins.append(c)
            if not coins: continue
            items[tid] = {
                "id": tid, "url": t.get("url") or f"https://x.com/{acc['handle']}/status/{tid}", "handle": au.get("screen_name"), "author_name": au.get("name"),
                "avatar": au.get("avatar_url"), "author_followers": au.get("followers"), "verified": bool((au.get("verification") or {}).get("verified")),
                "role": acc.get("role", "kol"), "wallet_id": acc.get("wallet_id"), "text": t.get("text") or "", "is_reply": bool(t.get("replying_to")),
                "created_at": datetime.fromtimestamp(ts, timezone.utc).isoformat().replace("+00:00", "Z"), "ts": ts,
                "metrics": {"likes": t.get("likes"), "reposts": t.get("reposts"), "replies": t.get("replies"), "quotes": t.get("quotes"), "bookmarks": t.get("bookmarks"), "views": t.get("views")},
                "metrics_at": datetime.now(timezone.utc).isoformat(timespec="seconds"), "coin_match": "named", "coins": coins[:3], "first_seen": int(now),
            }
    # keep still-fresh items from the last file when a read failed this run (no data loss on a rate limit)
    for tid, p in prev.items():
        if tid not in items and now - (p.get("ts") or 0) <= KEEP_H * 3600: items[tid] = p
    tweets = sorted(items.values(), key=lambda x: -x["ts"])[:MAX_ITEMS]
    # after-tweet market facts (only for tweets < 12 h, refreshed every run, ≤ 12 GeckoTerminal calls)
    budget = int(__import__('os').environ.get('KYVO_LIVE_GT_BUDGET', '12'))  # v8.9: the loop uses 5 (runs next to the Runner scan; GT ~30 req/min)
    for t in tweets:
        if now - t["ts"] > 12 * 3600 or budget <= 0: continue
        for c in t["coins"][:1]:
            budget -= 1
            f = candles_after(c, t["ts"])
            if not f: continue
            c.update(f)
            if f.get("px_at_tweet") and c.get("price_usd"):
                c["chg_since_tweet"] = round((c["price_usd"] / f["px_at_tweet"] - 1) * 100, 1)
            per_h = f.get("vol_after", 0) / max(f.get("hours_after", 1), 1 / 12)
            c["pumping"] = bool((c.get("chg_since_tweet") or 0) >= 30 or (f.get("vol_after", 0) >= 20_000 and per_h >= 3 * max(f.get("vol_1h_before", 0), 1)))
            c["measured_at"] = int(now)
    if ok_reads == 0 and prev:
        print("source unavailable this run -> keeping previous file"); return 0
    doc = {"source": "FxTwitter public API (api.fxtwitter.com) — unofficial X mirror, no key; coins via DexScreener, candles via GeckoTerminal",
           "updated_at": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"), "accounts_read": ok_reads,
           "accounts": [x["handle"] for x in accounts()], "keep_hours": KEEP_H, "tweets": tweets}
    a.out.parent.mkdir(parents=True, exist_ok=True)
    # commit only when the set of tweets changed or the last commit is ≥ 30 min old (keeps Pages rebuilds sane)
    changed = {t["id"] for t in tweets} != set(prev) or now - _ts(old.get("updated_at")) >= 1800
    a.out.write_text(json.dumps(doc, ensure_ascii=False, indent=1))
    gh = __import__("os").environ.get("GITHUB_OUTPUT")
    if gh:
        with open(gh, "a") as f: f.write(f"commit={'true' if changed else 'false'}\n")
    print(f"x_live: {ok_reads} accounts read, {len(tweets)} tweets with coins (≤{KEEP_H} h) -> {a.out}")
    return 0

if __name__ == "__main__":
    sys.exit(main())
