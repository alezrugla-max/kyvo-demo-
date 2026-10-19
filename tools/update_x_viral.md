# Refreshing `data/x_viral.json`

GitHub Pages cannot call the X API with a secret from the browser.
Kyvo ships a **static snapshot** of posts/topics under `data/x_viral.json`.
The live app then matches those topics to Solana coins via DexScreener (no key).

## How to refresh (manual, ~15–40 X API reads)

1. Use the Cursor `x` MCP tools (or X API v2 with your own bearer token):
   - `get_users_by_usernames` → resolve ids for: elonmusk, blknoiz06, MustStopMurad, orangie, solana, Pumpfun, …
   - `get_users_posts` for each id (`max_results` 5–10, exclude retweets/replies)
   - `search_posts_all` for meme/coin queries (e.g. `memecoin solana`, `from:elonmusk (doge OR mars OR roadster)`)
   - optional: `get_trends_by_woeid` (US=`23424977`) — often sports-heavy; keep only crypto-relevant
2. Write only **real** fields into `data/x_viral.json` (see schema below). Never invent likes/text.
3. Commit + push to `main` of `alezrugla-max/kyvo-demo-`. Pages updates in ~1–2 minutes.
4. Optional helper: `python3 tools/update_x_viral.py --from-raw /path/to/raw.json` if you save MCP dumps first.

Limits (Cursor X connector, as of Oct 2026): **30 reads/min**, **1000/day**.
Paid X API for auto-refresh is typically **Basic ~$100–200/mo** or **Pro ~$5k/mo** (verify current pricing on developer.x.com — **unverified here**).
Auto-refresh would need a tiny backend (or GitHub Action with a secret) that writes this JSON on a schedule.

## Schema

```json
{
  "updated_at": "ISO-8601 Z",
  "updated_at_warsaw": "ISO-8601 +02:00",
  "source": "string",
  "note": "string",
  "key_accounts": [{"handle":"", "name":"", "id":""}],
  "topics": [{"id":"", "label":"", "query":"", "hints":[], "source_post":null, "why":""}],
  "us_trends": [{"name":"", "url":""}],
  "posts": [{
    "author_name":"", "handle":"", "avatar":null, "text":"", "created_at":"",
    "url":"", "metrics":{"likes":0,"reposts":0,"replies":0}, "tags":[], "topic_hints":[]
  }]
}
```
