#!/usr/bin/env python3
"""Build data/smart_money.json + data/leaderboard.json from public Solana RPC.

No API keys. Uses public Solana RPC (getSignaturesForAddress + getTransaction)
and DexScreener for mint metadata/price. Honest about PnL limits.

Usage:
  python3 tools/build_snapshots.py
  python3 tools/build_snapshots.py --sigs 40 --wallets tools/wallets_public.json
"""
from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.request
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WALLETS_PATH = ROOT / "tools" / "wallets_public.json"
OUT_SM = ROOT / "data" / "smart_money.json"
OUT_LB = ROOT / "data" / "leaderboard.json"
DS = "https://api.dexscreener.com"
RPCS = [
    "https://api.mainnet-beta.solana.com",
]
WSOL = "So11111111111111111111111111111111111111112"
SKIP_MINTS = {
    WSOL,
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",  # USDC
    "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11MCCe8BenwNYB",  # USDT
    "USD1ttGY1N17NEE4qtfnyhNJiT3kZ5kq9XqZ5kq9XqZ",  # placeholder
}


def http_json(url: str, data=None, timeout=45):
    body = None if data is None else json.dumps(data).encode()
    req = urllib.request.Request(
        url,
        data=body,
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "KyvoSnapshot/7 (public research; no key)",
        },
        method="GET" if body is None else "POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.load(r)


def rpc(method, params, rpc_url=None):
    last = None
    for url in ([rpc_url] if rpc_url else RPCS):
        try:
            d = http_json(url, {"jsonrpc": "2.0", "id": 1, "method": method, "params": params})
            if "error" in d:
                last = d["error"]
                continue
            return d["result"]
        except Exception as e:
            last = e
            continue
    raise RuntimeError(f"RPC {method} failed: {last}")


def warsaw_now():
    # Europe/Warsaw: CEST UTC+2 in late Oct; use fixed offset for snapshot stamp
    now = datetime.now(timezone.utc)
    w = now.astimezone(timezone(timedelta(hours=2)))
    return now.strftime("%Y-%m-%dT%H:%M:%SZ"), w.strftime("%Y-%m-%dT%H:%M:%S+02:00")


def load_wallets(path: Path):
    data = json.loads(path.read_text())
    if isinstance(data, dict) and "wallets" in data:
        return data["wallets"]
    return data


def account_keys(tx):
    keys = []
    for x in tx["transaction"]["message"]["accountKeys"]:
        keys.append(x["pubkey"] if isinstance(x, dict) else x)
    return keys


def parse_swaps(wallet: str, sig_limit: int, sleep: float):
    """Return list of swap-like events for wallet from recent signatures."""
    events = []
    try:
        sigs = rpc("getSignaturesForAddress", [wallet, {"limit": sig_limit}]) or []
    except Exception as e:
        print(f"  warn signatures {wallet[:8]}…: {e}", file=sys.stderr)
        return events

    for s in sigs:
        if s.get("err"):
            continue
        sig = s["signature"]
        bt = s.get("blockTime")
        try:
            tx = rpc(
                "getTransaction",
                [sig, {"encoding": "jsonParsed", "maxSupportedTransactionVersion": 0}],
            )
        except Exception:
            time.sleep(sleep)
            continue
        if not tx or not tx.get("meta"):
            time.sleep(sleep)
            continue
        meta = tx["meta"]
        keys = account_keys(tx)
        if wallet not in keys:
            time.sleep(sleep)
            continue
        idx = keys.index(wallet)
        sol_delta = (meta["postBalances"][idx] - meta["preBalances"][idx]) / 1e9
        pre = {
            (b.get("owner"), b["mint"]): float(b["uiTokenAmount"].get("uiAmount") or 0)
            for b in (meta.get("preTokenBalances") or [])
        }
        post = {
            (b.get("owner"), b["mint"]): float(b["uiTokenAmount"].get("uiAmount") or 0)
            for b in (meta.get("postTokenBalances") or [])
        }
        mints = {k[1] for k in list(pre) + list(post)}
        for mint in mints:
            if mint in SKIP_MINTS:
                continue
            d = post.get((wallet, mint), 0.0) - pre.get((wallet, mint), 0.0)
            if abs(d) < 1e-12:
                continue
            side = "buy" if d > 0 else "sell"
            # Approx USD size from SOL spent/received when SOL moves opposite to token
            sol_size = abs(sol_delta) if abs(sol_delta) >= 0.001 else None
            events.append(
                {
                    "mint": mint,
                    "side": side,
                    "token_amount": d,
                    "sol_delta": sol_delta,
                    "sol_size": sol_size,
                    "signature": sig,
                    "block_time": bt,
                }
            )
        time.sleep(sleep)
    return events


def dex_info(mints):
    """Map mint -> {symbol, name, priceUsd, mcap} via DexScreener batches."""
    out = {}
    uniq = [m for m in dict.fromkeys(mints) if m]
    for i in range(0, len(uniq), 30):
        chunk = uniq[i : i + 30]
        try:
            d = http_json(DS + "/latest/dex/tokens/" + ",".join(chunk))
        except Exception as e:
            print("  warn dexscreener", e, file=sys.stderr)
            continue
        for p in d.get("pairs") or []:
            if p.get("chainId") != "solana":
                continue
            bt = (p.get("baseToken") or {})
            mint = bt.get("address")
            if not mint or mint in out:
                continue
            # prefer highest liq later — first write then upgrade
            liq = ((p.get("liquidity") or {}).get("usd")) or 0
            cur = out.get(mint)
            if cur and cur.get("_liq", 0) >= liq:
                continue
            out[mint] = {
                "symbol": bt.get("symbol") or "???",
                "name": bt.get("name") or bt.get("symbol") or "Unknown",
                "priceUsd": float(p["priceUsd"]) if p.get("priceUsd") is not None else None,
                "mcap": p.get("marketCap") if p.get("marketCap") is not None else p.get("fdv"),
                "dexId": p.get("dexId"),
                "_liq": liq,
            }
        time.sleep(0.2)
    for v in out.values():
        v.pop("_liq", None)
    return out


def approx_usd(ev, price_sol=None, token_price=None):
    """Best-effort USD notional. Prefer SOL size * SOL price; else token*price."""
    if ev.get("sol_size") and price_sol:
        return abs(ev["sol_size"]) * price_sol
    if token_price is not None and ev.get("token_amount") is not None:
        return abs(ev["token_amount"]) * token_price
    return None


def compute_wallet_stats(events, sol_price, info_by_mint, now_ts):
    """Rough realized PnL from matched buy/sell legs on same mint (FIFO).

    Limitations (shown as — in UI when null):
    - Only looks at recent N signatures (not full history)
    - Ignores transfers / multi-hop complexity
    - USD uses SOL delta when available else token*current price (biased)
    """
    windows = {
        "1d": now_ts - 86400,
        "7d": now_ts - 7 * 86400,
        "30d": now_ts - 30 * 86400,
    }
    # group by mint chronological
    by_mint = defaultdict(list)
    for e in events:
        if e.get("block_time"):
            by_mint[e["mint"]].append(e)
    for mint in by_mint:
        by_mint[mint].sort(key=lambda x: x["block_time"] or 0)

    closed = []  # {pnl_usd, time, win}
    buys_open = defaultdict(list)  # mint -> [{sol_cost, tok, t}]

    for mint, evs in by_mint.items():
        meta = info_by_mint.get(mint) or {}
        px = meta.get("priceUsd")
        for e in evs:
            usd = approx_usd(e, sol_price, px)
            if e["side"] == "buy":
                buys_open[mint].append(
                    {"tok": abs(e["token_amount"]), "usd": usd, "t": e["block_time"]}
                )
            else:
                sell_tok = abs(e["token_amount"])
                sell_usd = usd
                while sell_tok > 1e-12 and buys_open[mint]:
                    b = buys_open[mint][0]
                    take = min(sell_tok, b["tok"])
                    frac = take / b["tok"] if b["tok"] else 0
                    cost = (b["usd"] * frac) if b["usd"] is not None else None
                    proceeds = (sell_usd * (take / abs(e["token_amount"]))) if sell_usd is not None else None
                    pnl = (proceeds - cost) if (proceeds is not None and cost is not None) else None
                    closed.append({"pnl_usd": pnl, "t": e["block_time"], "mint": mint})
                    b["tok"] -= take
                    if b["usd"] is not None:
                        b["usd"] *= (1 - frac)
                    sell_tok -= take
                    if b["tok"] <= 1e-12:
                        buys_open[mint].pop(0)

    def window_stats(since):
        rows = [c for c in closed if c["t"] and c["t"] >= since]
        pnls = [c["pnl_usd"] for c in rows if c["pnl_usd"] is not None]
        trades = len(rows)
        if not pnls:
            return {
                "realized_pnl_usd": None,
                "trades": trades,
                "wins": None,
                "win_rate": None,
                "note": "Za mało zamkniętych legów z wiarygodnym USD w oknie (tylko ostatnie sygnatury RPC).",
            }
        wins = sum(1 for p in pnls if p > 0)
        return {
            "realized_pnl_usd": round(sum(pnls), 2),
            "trades": trades,
            "wins": wins,
            "win_rate": round(wins / len(pnls), 3) if pnls else None,
            "note": "Przybliżone FIFO z ostatnich sygnatur publicznych RPC — nie pełna historia.",
        }

    return {k: window_stats(v) for k, v in windows.items()}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--wallets", type=Path, default=WALLETS_PATH)
    ap.add_argument("--sigs", type=int, default=35, help="signatures per wallet")
    ap.add_argument("--sleep", type=float, default=0.12)
    args = ap.parse_args()

    wallets = load_wallets(args.wallets)
    print(f"Wallets: {len(wallets)} from {args.wallets}")
    updated_at, updated_warsaw = warsaw_now()
    now_ts = int(time.time())

    # SOL price
    sol_price = None
    try:
        d = http_json(DS + "/latest/dex/tokens/" + WSOL)
        for p in d.get("pairs") or []:
            if p.get("chainId") == "solana" and p.get("priceUsd"):
                sol_price = float(p["priceUsd"])
                break
    except Exception as e:
        print("warn SOL price", e, file=sys.stderr)
    print(f"SOL price ≈ {sol_price}")

    all_events = []  # enriched
    per_wallet_events = {}

    for w in wallets:
        addr = w["address"]
        print(f"Scanning {w.get('name')} {addr[:8]}…")
        evs = parse_swaps(addr, args.sigs, args.sleep)
        per_wallet_events[addr] = evs
        print(f"  events={len(evs)}")

    mints = [e["mint"] for evs in per_wallet_events.values() for e in evs]
    info = dex_info(mints)
    print(f"DexScreener mints resolved: {len(info)}")

    # Build smart_money activity feed (recent buys preferred)
    activity = []
    for w in wallets:
        addr = w["address"]
        for e in per_wallet_events.get(addr, []):
            meta = info.get(e["mint"]) or {}
            usd = approx_usd(e, sol_price, meta.get("priceUsd"))
            activity.append(
                {
                    "wallet_id": w["id"],
                    "wallet_name": w["name"],
                    "handle": w.get("handle"),
                    "wallet": addr,
                    "mint": e["mint"],
                    "symbol": meta.get("symbol"),
                    "name": meta.get("name"),
                    "side": e["side"],
                    "sol_size": e.get("sol_size"),
                    "usd_size": round(usd, 2) if usd is not None else None,
                    "usd_size_note": (
                        "≈ |ΔSOL|×SOL price"
                        if e.get("sol_size")
                        else ("≈ |Δtoken|×current price (rough)" if usd is not None else "size unknown")
                    ),
                    "block_time": e.get("block_time"),
                    "signature": e["signature"],
                    "tx_url": f"https://solscan.io/tx/{e['signature']}",
                }
            )

    activity.sort(key=lambda x: x.get("block_time") or 0, reverse=True)

    # by_mint index for app join
    by_mint = defaultdict(list)
    for a in activity:
        if a["side"] != "buy":
            continue
        by_mint[a["mint"]].append(
            {
                "wallet_id": a["wallet_id"],
                "wallet_name": a["wallet_name"],
                "handle": a["handle"],
                "wallet": a["wallet"],
                "side": a["side"],
                "usd_size": a["usd_size"],
                "sol_size": a["sol_size"],
                "block_time": a["block_time"],
                "signature": a["signature"],
                "tx_url": a["tx_url"],
            }
        )
    # keep latest few per mint
    by_mint_out = {m: v[:8] for m, v in by_mint.items()}

    sm = {
        "updated_at": updated_at,
        "updated_at_warsaw": updated_warsaw,
        "source": "Public Solana RPC (getSignaturesForAddress/getTransaction) + DexScreener token metadata. No private keys.",
        "note": "Not financial advice. Sizes/PnL are approximate from recent signatures only.",
        "sol_price_usd": sol_price,
        "wallets": wallets,
        "activity": activity[:500],
        "by_mint": by_mint_out,
        "limits": {
            "sigs_per_wallet": args.sigs,
            "pnl": "FIFO on observed buy/sell legs in the signature window only; many real trades are missed or mis-sized.",
        },
    }
    OUT_SM.parent.mkdir(parents=True, exist_ok=True)
    OUT_SM.write_text(json.dumps(sm, ensure_ascii=False, separators=(",", ":")) + "\n")
    print("Wrote", OUT_SM)

    # Leaderboard
    leaders = []
    for w in wallets:
        addr = w["address"]
        stats = compute_wallet_stats(per_wallet_events.get(addr, []), sol_price, info, now_ts)
        recent_buys = sum(
            1
            for e in per_wallet_events.get(addr, [])
            if e["side"] == "buy" and e.get("block_time") and e["block_time"] >= now_ts - 86400
        )
        leaders.append(
            {
                "id": w["id"],
                "name": w["name"],
                "handle": w.get("handle"),
                "address": addr,
                "source": w.get("source"),
                "source_note": w.get("source_note"),
                "avatar": f"data/avatars/{w['id']}.jpg" if w.get("handle") else None,
                "x_url": f"https://x.com/{w['handle']}" if w.get("handle") else None,
                "stats": stats,
                "recent_buys_1d": recent_buys,
                "events_scanned": len(per_wallet_events.get(addr, [])),
            }
        )

    # Sort by 7d realized when present, else events
    def sort_key(row):
        p = (row.get("stats") or {}).get("7d", {}).get("realized_pnl_usd")
        return (p is not None, p if p is not None else -1e99, row.get("events_scanned") or 0)

    leaders.sort(key=sort_key, reverse=True)

    lb = {
        "updated_at": updated_at,
        "updated_at_warsaw": updated_warsaw,
        "source": sm["source"],
        "note": "Realized PnL is approximate FIFO over recent public RPC signatures only. Missing values shown as —.",
        "wallets_count": len(wallets),
        "leaders": leaders,
    }
    OUT_LB.write_text(json.dumps(lb, ensure_ascii=False, indent=2) + "\n")
    print("Wrote", OUT_LB)
    print("Done.")


if __name__ == "__main__":
    main()
