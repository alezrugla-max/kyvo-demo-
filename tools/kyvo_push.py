#!/usr/bin/env python3
"""Kyvo v8.6 — server-side phone push via OneSignal (works while the app is CLOSED). Runs in GitHub Actions only.

Sends one push per genuinely NEW item:
  * 🐦 New Tweet: a tracked account tweeted about a coin (data/x_live.json, built by tools/x_live.py), tweet ≤ 2 h old
  * 🏃 Runner: a coin that passed the app's runnerRule this run (flags JSON written by tools/discord_calls.py --flags-out)
  * v8.8 👑 KOL coin / 🚀 Moon run: Runner overrides (tools/kol_coins.py), same "runner" tag + same free-user daily cap
  * v8.9 🐦 Tweet runner: coin from a fresh New Tweet item that clearly runs after the tweet (dedupe id twr:<coin>)
  * v8.9 📈 Big runner: established $1M–$100M coin running now (bigRunnerRule + tools/kol_coins.big_check)
Dedupe: sent ids live in the state file (restored/saved with actions/cache). First run only seeds (no blast of old items).
Audience (tags set by the app in notify.js): premium=1 -> every alert; everyone else -> at most FREE_CAP alerts per
Europe/Warsaw day (one global counter = same broadcasts for all free users); v8.11: of those, at most FREE_RUNNERS (1)
Runner push per day — the day's first Runner; every other Runner goes to premium=1 only. Users who switched a type off (tag tweets=0 /
runner=0) are excluded. Quiet hours: none for now.
Secret: ONESIGNAL_REST_API_KEY (GitHub -> Settings -> Secrets -> Actions). Missing -> safe no-op. The key is never printed.
"""
from __future__ import annotations
import argparse, json, os, sys, time, urllib.request, urllib.error
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

APP_ID = "a5a8f0d3-4c22-4d5b-8ace-5e94dc22ef5f"   # public OneSignal App ID (same as push-config.js)
APP_URL = "https://alezrugla-max.github.io/kyvo-demo-/"
API = "https://api.onesignal.com/notifications?c=push"
FREE_CAP = 2
FREE_RUNNERS = 1      # v8.11: free users get a push for ONE Runner per Warsaw day (the first one sent); Premium gets all
MAX_TWEET_AGE_S = 2 * 3600
MAX_PER_RUN = 6
WARSAW = ZoneInfo("Europe/Warsaw")

def fmt_usd(v) -> str:
    if v is None: return "?"
    v = float(v)
    return f"${v/1e9:.2f}B" if v >= 1e9 else f"${v/1e6:.2f}M" if v >= 1e6 else f"${v/1e3:.1f}K" if v >= 1e3 else f"${v:.0f}"

def load(p: Path, default):
    try: return json.loads(p.read_text())
    except Exception: return default

def send(key: str, payload: dict) -> bool:
    auth = ("Key " if key.startswith("os_v2") else "Basic ") + key
    req = urllib.request.Request(API, data=json.dumps(payload).encode(), method="POST",
                                 headers={"Authorization": auth, "Content-Type": "application/json; charset=utf-8", "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            body = json.load(r)
        if body.get("errors"): print("  OneSignal:", str(body.get("errors"))[:200])
        print(f"  sent id={body.get('id')}")
        return bool(body.get("id"))
    except urllib.error.HTTPError as e:
        print(f"  OneSignal HTTP {e.code}: {e.read()[:200].decode('utf-8', 'replace')}")   # response never echoes the key
    except Exception as e:  # noqa: BLE001
        print(f"  OneSignal error: {type(e).__name__}")
    return False

def audience(kind_tag: str, premium: bool) -> list[dict]:
    f = [{"field": "tag", "key": kind_tag, "relation": "!=", "value": "0"}]
    f.append({"operator": "AND"})
    f.append({"field": "tag", "key": "premium", "relation": "=" if premium else "!=", "value": "1"})
    return f

def payload(item: dict, filters: list[dict]) -> dict:
    return {"app_id": APP_ID, "target_channel": "push", "filters": filters,
            "headings": {"en": item["title_en"], "pl": item["title_pl"]}, "contents": {"en": item["body_en"], "pl": item["body_pl"]},
            "url": APP_URL + item["hash"], "web_push_topic": item["topic"][:60], "chrome_web_icon": APP_URL + "icons/icon-192.png",
            "ttl": 3 * 3600}

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--live", type=Path, default=Path("data/x_live.json"))
    ap.add_argument("--flags", type=Path, default=Path(".kyvo_push/flags.json"))
    ap.add_argument("--state", type=Path, default=Path(".kyvo_push/sent.json"))
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    key = os.environ.get("ONESIGNAL_REST_API_KEY", "").strip()
    if not key and not a.dry_run:
        print("ONESIGNAL_REST_API_KEY not set -> nothing sent (safe no-op).")
    now = time.time(); day = datetime.now(WARSAW).strftime("%Y-%m-%d")
    st = load(a.state, {})
    seeding = not st.get("seeded")
    sent: dict = {k: t for k, t in st.get("sent", {}).items() if now - t < 3 * 86400}
    if st.get("free_day") != day: st["free_day"], st["free_n"], st["free_runner_n"] = day, 0, 0

    items = []
    for t in load(a.live, {}).get("tweets", []):
        kid = "tw:" + str(t.get("id"))
        age = now - (t.get("ts") or 0)
        named = [c for c in t.get("coins") or [] if c.get("rel", "named") == "named"]   # v8.10: a 'powiązany coin' (key-word match) never pushes on its own
        if kid in sent or age > MAX_TWEET_AGE_S or not named: continue
        if seeding and age > 20 * 60: sent[kid] = now; continue
        c = named[0]; mins = max(1, round(age / 60))
        fol = t.get("author_followers")
        items.append({"id": kid, "kind": "tweets", "topic": kid, "hash": "#tweets",
                      "title_pl": f"🐦 @{t['handle']} o ${c['symbol']}", "title_en": f"🐦 @{t['handle']} on ${c['symbol']}",
                      "body_pl": f"{mins} min temu · {c['chain']} · MC {fmt_usd(c.get('mcap'))}" + (f" · {fmt_usd(fol).lstrip('$')} obserwujących" if fol else "") + (" · 🚀 pompuje po tweecie" if c.get("pumping") else ""),
                      "body_en": f"{mins} min ago · {c['chain']} · MC {fmt_usd(c.get('mcap'))}" + (f" · {fmt_usd(fol).lstrip('$')} followers" if fol else "") + (" · 🚀 pumping after the tweet" if c.get("pumping") else "")})
    for f in load(a.flags, []):
        if f.get("kind") != "runner": continue
        kid = "run:" + f["k"].lower()
        if kid in sent and not f.get("tweet"): continue
        if seeding:
            sent[kid] = now
            if f.get("tweet"): sent["twr:" + f["k"].lower()] = now
            continue
        b = f.get("badge")
        if b == "kol":      # v8.8 👑 KOL coin (official coin of a known KOL) — high risk: supply sits in the KOL's wallet
            conc_pl = f" · ⚠️ {round(f['top_pct'])}% podaży u KOL-a, wysokie ryzyko" if f.get("concentrated") and f.get("top_pct") else " · ⚠️ wysokie ryzyko"
            conc_en = f" · ⚠️ {round(f['top_pct'])}% of supply with the KOL, high risk" if f.get("concentrated") and f.get("top_pct") else " · ⚠️ high risk"
            who = f"@{f['kol']} · " if f.get("kol") else ""
            items.append({"id": kid, "kind": "runner", "topic": kid, "hash": "#runner",
                          "title_pl": f"👑 KOL coin: ${f['sym']}", "title_en": f"👑 KOL coin: ${f['sym']}",
                          "body_pl": f"{who}{f['chain']} · MC {fmt_usd(f.get('mc0'))}{conc_pl}. To nie porada finansowa.",
                          "body_en": f"{who}{f['chain']} · MC {fmt_usd(f.get('mc0'))}{conc_en}. Not financial advice."})
            continue
        if b == "moon":     # v8.8 🚀 Moon run — extreme real momentum, safety score failed
            items.append({"id": kid, "kind": "runner", "topic": kid, "hash": "#runner",
                          "title_pl": f"🚀 Moon run: ${f['sym']} · wysokie ryzyko", "title_en": f"🚀 Moon run: ${f['sym']} · high risk",
                          "body_pl": f"{f['chain']} · MC {fmt_usd(f.get('mc0'))} · ogromny wolumen i tysiące kupujących, ale nie przeszedł testów bezpieczeństwa. To nie porada finansowa.",
                          "body_en": f"{f['chain']} · MC {fmt_usd(f.get('mc0'))} · huge volume and thousands of buyers, but it failed the safety checks. Not financial advice."})
            continue
        if f.get("tweet"):  # v8.9 🐦 Tweet runner (own dedupe id: a coin can be a Runner AND later run after a tweet)
            tw = f["tweet"]; tkid = "twr:" + f["k"].lower()
            if tkid not in sent:
                if seeding: sent[tkid] = now
                else:
                    items.append({"id": tkid, "kind": "runner", "topic": tkid, "hash": "#runner",
                                  "title_pl": f"🐦 Tweet runner: ${f['sym']} +{round(tw.get('chg') or 0)}% po tweecie @{tw.get('handle')}",
                                  "title_en": f"🐦 Tweet runner: ${f['sym']} +{round(tw.get('chg') or 0)}% after @{tw.get('handle')}'s tweet",
                                  "body_pl": f"{f['chain']} · MC {fmt_usd(f.get('mc0'))} · wolumen i kupujący rosną od tweeta. Ruchy po tweecie często szybko się kończą. To nie porada finansowa.",
                                  "body_en": f"{f['chain']} · MC {fmt_usd(f.get('mc0'))} · volume and buyers rising since the tweet. Post-tweet moves often fade fast. Not financial advice."})
            if b == "tweet": continue
        if b == "big":      # v8.9 📈 Big runner — established $1M–$100M coin running now (passed the safety floor)
            bg = f.get("big") or {}
            mv = (f"+{round(bg['h1'])}% 1h · " if bg.get("h1") is not None and bg["h1"] >= 0 else "")
            items.append({"id": kid, "kind": "runner", "topic": kid, "hash": "#runner",
                          "title_pl": f"📈 Duży runner: ${f['sym']} · MC {fmt_usd(f.get('mc0'))}", "title_en": f"📈 Big runner: ${f['sym']} · MC {fmt_usd(f.get('mc0'))}",
                          "body_pl": f"{f['chain']} · {mv}wolumen dużo powyżej średniej, coraz więcej kupujących. To nie porada finansowa.",
                          "body_en": f"{f['chain']} · {mv}volume far above its average, buyers rising. Not financial advice."})
            continue
        items.append({"id": kid, "kind": "runner", "topic": kid, "hash": "#coin/" + f["k"],
                      "title_pl": f"🏃 Runner: ${f['sym']}", "title_en": f"🏃 Runner: ${f['sym']}",
                      "body_pl": f"{f['chain']} · MC {fmt_usd(f.get('mc0'))} · mocny wolumen i dużo transakcji. To nie porada finansowa.",
                      "body_en": f"{f['chain']} · MC {fmt_usd(f.get('mc0'))} · strong volume and lots of trades. Not financial advice."})
    if seeding: print(f"first run: seeded {len(sent)} existing items, nothing sent")
    items.sort(key=lambda it: 0 if it["title_en"].startswith(("👑", "🚀", "🐦")) else 1)
    for it in items[:MAX_PER_RUN]:
        print(f"- {it['id']}: {it['title_en']}")
        targets = [audience(it["kind"], True)]
        free_ok = st.get("free_n", 0) < FREE_CAP
        if it["kind"] == "runner" and st.get("free_runner_n", 0) >= FREE_RUNNERS: free_ok = False   # v8.11: Runners are Premium — free users get only the day's first Runner
        if free_ok: targets.append(audience(it["kind"], False))
        if a.dry_run:
            for tg in targets: print(json.dumps(payload(it, tg), ensure_ascii=False)[:600])
            print(f"  audience: premium=1{' + free' if free_ok else ' only'}")
            if free_ok:   # dry run: count in memory (state is not written) so the free caps can be checked
                st["free_n"] = st.get("free_n", 0) + 1
                if it["kind"] == "runner": st["free_runner_n"] = st.get("free_runner_n", 0) + 1
            continue
        if not key: continue
        ok = all([send(key, payload(it, tg)) for tg in targets])
        if ok:
            sent[it["id"]] = now
            if free_ok:
                st["free_n"] = st.get("free_n", 0) + 1
                if it["kind"] == "runner": st["free_runner_n"] = st.get("free_runner_n", 0) + 1; st["free_runner_id"] = it["id"]
        time.sleep(1)
    st["sent"] = sent; st["seeded"] = True
    if not a.dry_run and (key or seeding):
        a.state.parent.mkdir(parents=True, exist_ok=True); a.state.write_text(json.dumps(st))
    return 0

if __name__ == "__main__":
    sys.exit(main())
