#!/usr/bin/env python3
"""Kyvo v8.3 "Wyniki / Track record" — server log of every coin Kyvo flags (Good Coin or 🏃 Runner).

Runs in the GitHub Action right after tools/discord_calls.py --flags-out (same rules as the app):
  1. merge new flags into data/track_record.json — only the FIRST flag of a coin is kept (time, price, MC), later flags
     only add the kind (good / runner);
  2. update performance for coins flagged in the last 7 days: exact max / 1 h / 8 h from GeckoTerminal 15-min candles
     (≤ 50 h after the flag, at most 25 pools per run), current price from DexScreener;
  3. print commit=true to $GITHUB_OUTPUT only if there is a new flag or the last committed update is ≥ 60 min old,
     so GitHub Pages is rebuilt at most ~hourly.
Public data only, no keys. Not financial advice.
Usage: python3 tools/track_record.py --flags .kyvo_calls/flags.json --out data/track_record.json
"""
from __future__ import annotations
import argparse, json, os, time, urllib.request
from pathlib import Path

UA = {"User-Agent": "kyvo-track-record/8.3 (+https://github.com/alezrugla-max/kyvo-demo-)", "Accept": "application/json"}
DS = "https://api.dexscreener.com"
GT = "https://api.geckoterminal.com/api/v2"
GT_NET = {"solana": "solana", "bsc": "bsc", "robinhood": "robinhood"}
KEEP_DAYS = 14

def get(url: str):
    for i in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=20) as r: return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 429: time.sleep(6 * (i + 1)); continue
            return None
        except Exception: time.sleep(2)
    return None

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--flags", type=Path, default=Path(".kyvo_calls/flags.json"))
    ap.add_argument("--out", type=Path, default=Path("data/track_record.json"))
    ap.add_argument("--max-ohlcv", type=int, default=25)
    a = ap.parse_args()
    now_ms = int(time.time() * 1000)
    try: doc = json.loads(a.out.read_text())
    except Exception: doc = {"items": []}
    items = {e["k"]: e for e in doc.get("items", [])}
    new = 0
    try: flags = json.loads(a.flags.read_text())
    except Exception: flags = []
    for f in flags:
        e = items.get(f["k"])
        if not e:
            items[f["k"]] = e = {x: f.get(x) for x in ("k", "sym", "name", "chain", "addr", "pair", "img", "at", "px0", "mc0")}
            e.update({"kinds": {}, "max": f["px0"], "maxAt": f["at"], "last": f["px0"], "mcNow": f["mc0"], "lastAt": f["at"]}); new += 1
        e.setdefault("kinds", {}).setdefault(f["kind"], f["at"])
    items = {k: e for k, e in items.items() if now_ms - e["at"] < KEEP_DAYS * 864e5}
    live = [e for e in items.values() if now_ms - e["at"] < 7 * 864e5]
    # current price: DexScreener tokens batch per chain (≤ 30 addresses / call)
    for ch in {e["chain"] for e in live}:
        grp = [e for e in live if e["chain"] == ch]
        for i in range(0, len(grp), 30):
            d = get(f"{DS}/tokens/v1/{ch}/" + ",".join(e["addr"] for e in grp[i:i + 30]))
            for e in grp[i:i + 30]:
                ps = [p for p in (d or []) if ((p.get("baseToken") or {}).get("address") or "").lower() == e["addr"].lower()]
                p = next((q for q in ps if q.get("pairAddress") == e.get("pair")), None) or (max(ps, key=lambda q: (q.get("liquidity") or {}).get("usd") or 0) if ps else None)
                if p and p.get("priceUsd"):
                    px = float(p["priceUsd"]); e["last"] = px; e["lastAt"] = now_ms; e["mcNow"] = p.get("marketCap") or p.get("fdv") or e.get("mcNow")
                    if px > (e.get("max") or 0): e["max"], e["maxAt"] = px, now_ms
            time.sleep(1)
    # exact max / 1 h / 8 h from 15-min candles while the flag is ≤ 50 h old
    todo = sorted([e for e in live if e.get("pair") and now_ms - e["at"] < 50 * 3.6e6 and not e.get("ohFinal")], key=lambda e: e.get("ohAt", 0))[: a.max_ohlcv]
    for e in todo:
        d = get(f"{GT}/networks/{GT_NET.get(e['chain'], e['chain'])}/pools/{e['pair']}/ohlcv/minute?aggregate=15&limit=200&currency=usd&token={e['addr']}")
        time.sleep(2.1)
        ol = sorted(((d or {}).get("data") or {}).get("attributes", {}).get("ohlcv_list") or [])
        after = [r for r in ol if r[0] * 1000 >= e["at"] - 15 * 60e3 + 1]
        if not after: continue
        mx = max(r[2] for r in after)
        if mx > (e.get("max") or 0): e["max"], e["maxAt"] = mx, int(next(r for r in after if r[2] == mx)[0] * 1000)
        for h, f in ((1, "p1"), (8, "p8")):
            t = (e["at"] + h * 3.6e6) / 1000
            c = next((r for r in ol if r[0] <= t < r[0] + 900), None)
            if c and time.time() > t: e[f] = c[4]
        e["ohAt"] = now_ms
        if e.get("p8") is not None and now_ms - e["at"] > 9 * 3.6e6: e["ohFinal"] = 1
    last_commit = doc.get("committed_at") or 0
    commit = bool(new) or now_ms - last_commit >= 60 * 60e3
    out = {"updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "committed_at": now_ms if commit else last_commit,
           "note": "Every coin flagged by Kyvo (Good Coins / Runner rule), first flag only. Entry = price at flag, no fees/slippage. Not financial advice.",
           "items": sorted(items.values(), key=lambda e: -e["at"])}
    a.out.parent.mkdir(parents=True, exist_ok=True)
    a.out.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
    print(f"track record: {len(items)} coins ({new} new flags), ohlcv {len(todo)}, commit={str(commit).lower()}")
    gh = os.environ.get("GITHUB_OUTPUT")
    if gh:
        with open(gh, "a") as fh: fh.write(f"commit={'true' if commit else 'false'}\n")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
