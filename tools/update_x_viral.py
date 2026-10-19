#!/usr/bin/env python3
"""Assemble or validate data/x_viral.json. Does not call X itself (use MCP / API separately)."""
from __future__ import annotations
import argparse, json, sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "x_viral.json"
REQUIRED_POST = {"author_name", "handle", "text", "created_at", "url", "metrics"}

def validate(doc: dict) -> list[str]:
    errs = []
    if "updated_at" not in doc: errs.append("missing updated_at")
    if "posts" not in doc or not isinstance(doc["posts"], list): errs.append("posts must be a list")
    else:
        for i, p in enumerate(doc["posts"]):
            miss = REQUIRED_POST - set(p)
            if miss: errs.append(f"post[{i}] missing {miss}")
            if not (p.get("url") or "").startswith("https://x.com/"):
                errs.append(f"post[{i}] url must be https://x.com/...")
            m = p.get("metrics") or {}
            for k in ("likes", "reposts", "replies"):
                if k not in m or not isinstance(m[k], int):
                    errs.append(f"post[{i}].metrics.{k} must be int")
    return errs

def stamp(doc: dict) -> dict:
    now = datetime.now(timezone.utc)
    warsaw = now.astimezone(timezone(timedelta(hours=2)))  # CEST; adjust for CET if needed
    doc["updated_at"] = now.strftime("%Y-%m-%dT%H:%M:%SZ")
    doc["updated_at_warsaw"] = warsaw.strftime("%Y-%m-%dT%H:%M:%S+02:00")
    return doc

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--from-raw", type=Path, help="Merge a raw JSON dump with posts/topics")
    ap.add_argument("--validate-only", action="store_true")
    ap.add_argument("--stamp", action="store_true", help="Refresh updated_at timestamps")
    args = ap.parse_args()
    if args.from_raw:
        raw = json.loads(args.from_raw.read_text())
        doc = stamp(raw if "posts" in raw else {"posts": raw, "topics": [], "us_trends": [], "key_accounts": []})
        doc.setdefault("source", "manual raw import")
        doc.setdefault("note", "Static snapshot. Not financial advice.")
    else:
        if not OUT.exists():
            print("No existing", OUT, file=sys.stderr); sys.exit(1)
        doc = json.loads(OUT.read_text())
        if args.stamp: doc = stamp(doc)
    errs = validate(doc)
    if errs:
        print("INVALID:\n- " + "\n- ".join(errs), file=sys.stderr); sys.exit(2)
    if args.validate_only:
        print("OK", len(doc["posts"]), "posts"); return
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n")
    print("Wrote", OUT, "posts=", len(doc["posts"]))

if __name__ == "__main__":
    main()
