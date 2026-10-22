# REX Dashboard (v2)

Website + API for the REX Discord bot on Cloudflare Workers: static site in `public/`, Python Worker in `src/`. No third-party Python packages.

**The bot is the source of truth.** It pushes its server list, settings schema, command list, stats and profile data to this site; website edits go into a queue that the bot re-validates and applies. The bot side lives in the separate *bot-update* download (`rex_dashboard.py`).

## Pages
Home (live status, support button) · About · Command directory (`/commands`, search + filters) · Command detail (`/command?c=ban`) · Premium tiers · Dashboard (your servers) · Server settings (68 settings in 12 sections, tier/permission aware, shows "waiting → applied") · Profile (levels, coins, account premium) · Health (owner only).

## Files
| Path | Purpose |
|---|---|
| `src/worker.py` | Discord login, sessions, settings queue, bot API |
| `src/schema.py` | Validates the schema the bot pushes and values the browser sends |
| `public/data/commands-baseline.json` | Built-in command list shown until the bot sends the live one (`tools/extract_commands.py` regenerates it from `main.py`) |
| `public/data/guides.json` | Hand-written descriptions/examples/categories for commands. Add entries freely. |
| `wrangler.jsonc` | Cloudflare config (KV binding `REX_KV` is created automatically) |

## Setup
1. Replace the repo contents with this folder (include hidden files such as `.gitignore`). Commit; Cloudflare redeploys.
2. Discord Developer Portal -> OAuth2 -> Redirects: `https://rex.g7m4fcmnz9.workers.dev/auth/callback` (Save Changes).
3. Cloudflare -> Settings -> Variables and Secrets:

| Name | Value |
|---|---|
| `DISCORD_CLIENT_ID` | application client ID |
| `DISCORD_CLIENT_SECRET` | client secret (Secret) |
| `BOT_API_KEY` | long random string (Secret) — same value goes in Ryft as `REX_BOT_API_KEY` |
| `OWNER_ID` | your Discord ID(s), comma separated — unlocks `/admin`, lets you open every server |
| `SUPPORT_URL` | optional, defaults to `https://discord.gg/rexsupport` |

4. Install the bot link on Ryft: see `INSTALL.md` in the bot-update download.

## Notes
- Cloudflare free KV: 1,000 writes/day. Heartbeat (5 min) ≈ 288/day; everything else only writes when something changed.
- Queued website changes expire after 24 h. The bot polls every 15 s.
- Adding a setting: add one `S(...)` line to `SECTIONS` in the bot's `rex_dashboard.py`; the website picks it up automatically.
- Optional artwork: `public/img/avatar.png` appears in the home hero.
- Never commit secrets. This repo contains none.
