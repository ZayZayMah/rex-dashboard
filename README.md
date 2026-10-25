# Rex Dashboard (v3)

Website + API for the Rex Discord bot on Cloudflare Workers: static site in `public/`, Python Worker in `src/`. No third-party Python packages. The bot is the source of truth; website edits go through a queue the bot re-validates.

## Pages
Home (live status) / About (with sub pages Commands, Premium, Live stats) / Dashboard / Server settings (one section at a time, activity console with undo, redeem codes, transcripts) / Profile (auto-refreshing stats, Enter Owner Mode for owners) / Owner mode (tools + code generator, website theme + maintenance mode, all servers, all users + DM, audit, health) / Transcript viewer (`/transcript?id=...`).

## Update steps
1. Replace the repo contents with this folder (keep hidden files) and commit. Cloudflare redeploys.
2. Cloudflare -> Settings -> Variables and Secrets: `OWNER_ID` is optional now (the 3 owners are built in). Keep `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `BOT_API_KEY`.
3. Upload the bot files (see the bot zip) and restart the bot.
4. Log out and back in once so Discord asks for the `email` permission (Users tab in owner mode shows emails).
5. Profile -> Enter Owner Mode.

Link previews: the site address is written into the page tags (`og:` tags). If it ever changes run `python3 tools/build_pages.py https://your-address` and commit. Discord link previews cannot contain buttons; use `/messages` for a message with link buttons.

## Themes
Owner mode -> Website. Normal, Halloween (own layout, `css/halloween.css`), Christmas (`css/christmas.css`). The old ember recolour is still in `css/style.css` as `data-theme="ember"`.

## Free plan limits
Cloudflare KV allows about 1,000 writes a day. The site batches writes (bat XP, heartbeats, profiles); if you grow a lot, upgrade the Workers plan.

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
| `OWNER_ID` | optional now: the 3 Rex owner IDs are built in; extra IDs may be added comma separated |
| `SUPPORT_URL` | optional, defaults to `https://discord.gg/rexsupport` |

4. Install the bot link on Ryft: see `INSTALL.md` in the bot-update download.

## Notes
- Cloudflare free KV: 1,000 writes/day. Heartbeat (5 min) ≈ 288/day; everything else only writes when something changed.
- Queued website changes expire after 24 h. The bot polls every 15 s.
- Adding a setting: add one `S(...)` line to `SECTIONS` in the bot's `rex_dashboard.py`; the website picks it up automatically.
- Optional artwork: `public/img/avatar.png` appears in the home hero.
- Never commit secrets. This repo contains none.


## Owner gate and beta features
- `/<owner id>/owner-tools` asks for the owner code you set via the bot DM, then opens Owner mode (12h session).
- Owner mode > Website > Beta: Gmail email builder, support tickets and the command/event builder each have Off / Testing / On. Testing shows the feature only to owners and the testers list.
- Owner emails are never stored or shown, not even to other owners.

## Phase 2
- Image uploads: `/api/upload` stores images in KV (max 400 KB, resized in the browser) and serves them from `/api/img/<id>`.
- New settings types `roles` and `builder`; sections can be hidden behind a beta flag (`beta: "builder"`).
- `public/js/builder.js` is the block builder for custom commands and events.
