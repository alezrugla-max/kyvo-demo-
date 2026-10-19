# Refreshing `data/x_viral.json` (~20–40 X reads)

GitHub Pages cannot call X with a secret from the browser. Ship a **static snapshot**.

## Single scheduled procedure (~3×/day)

1. **Resolve accounts** (1 read): `x` MCP `get_users_by_usernames` for  
   `orangie,Cupseyy,blknoiz06,MustStopMurad,Pumpfun,a1lon9,solana` (+ optional KOLs).
2. **Pull posts** (~7–14 reads): `get_users_posts` per id, `max_results` 5–10, exclude retweets/replies.
3. **Search** (~2–5 reads): `search_posts_all` for `memecoin solana`, `pumpfun`, etc.
4. **Optional trends** (1 read): `get_trends_by_woeid` (`23424977`) — keep only crypto-relevant.
5. Write real fields only into JSON (never invent metrics).
6. Validate + stamp:

```bash
python3 tools/update_x_viral.py --from-raw /tmp/x_viral_raw.json
# or after manual edit:
python3 tools/update_x_viral.py --stamp
python3 tools/update_x_viral.py --validate-only
```

7. Commit + push `data/x_viral.json`.

**Budget:** Cursor X connector ~30 reads/min, ~1000/day. A full refresh fits in **~20–40 reads**.

UI shows **„zaktualizowano X min temu”** from `updated_at`.
