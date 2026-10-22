# REX Dashboard

Website + API for the REX Discord bot. Runs on Cloudflare Workers (static site in `public/`, Python Worker in `src/`). No third-party Python packages.

## What's in here
| Path | What it is |
|---|---|
| `public/` | The website (home, server list, server settings, owner health page). Dark steel + electric blue, with an automatic Halloween theme (Oct 15 - Nov 2, or use the button in the nav). |
| `src/worker.py` | Discord login, sessions, settings API, bot API. |
| `src/features.py` | **The list of settings shown on the dashboard.** Edit this to match your bot. |
| `bot/rex_dashboard.py` | discord.py extension that connects your bot to the dashboard. Goes on Ryft, not Cloudflare. |
| `wrangler.jsonc`, `pyproject.toml` | Cloudflare config. Deploy command stays `uv run pywrangler deploy`. |

## 1. Replace the old repo contents
In `ZayZayMah/rex-dashboard`: delete `app.py`, `templates/`, `static/`, `Procfile`, `.env.example`, `requirements.txt` (if present), then upload everything from this folder. `FLASK_SECRET_KEY` is no longer needed.

## 2. Discord Developer Portal
1. Your application -> OAuth2 -> **Redirects** -> add `https://rex.g7m4fcmnz9.workers.dev/auth/callback` and save.
2. Copy the **Client ID** and **Client Secret** (reset the secret if it was ever shared).

## 3. Cloudflare: Workers & Pages -> rex -> Settings -> Variables and Secrets
Add these (type **Secret** for the secrets):
| Name | Value |
|---|---|
| `DISCORD_CLIENT_ID` | from step 2 |
| `DISCORD_CLIENT_SECRET` | from step 2 (Secret) |
| `BOT_API_KEY` | a long random string you generate, e.g. `python -c "import secrets; print(secrets.token_hex(32))"` (Secret) |
| `OWNER_ID` | your Discord user ID (unlocks the **Health** page) |

Then redeploy (push to GitHub). If the deploy complains about the KV namespace, create one under Storage & Databases -> KV and put its id in `wrangler.jsonc` as `{"binding": "REX_KV", "id": "..."}`.

## 4. The bot (Ryft)
1. Copy `bot/rex_dashboard.py` next to `main.py`.
2. Ryft environment: `REX_DASHBOARD_URL=https://rex.g7m4fcmnz9.workers.dev` and `REX_BOT_API_KEY=` (same value as `BOT_API_KEY`).
3. In `main.py`: `await bot.load_extension("rex_dashboard")`.
4. **Premium:** set `bot.is_guild_premium = your_async_function` (takes a guild, returns bool) using your existing premium storage. Until then every server counts as free. Call `bot.get_cog("DashboardLink").mark_dirty()` after a successful `/redeem`.
5. Use dashboard values in your commands/events: `await bot.get_cog("DashboardLink").setting(guild.id, "anti_spam", False)`.

The bot only *reads* settings; keep your own owner/premium checks in the bot.

## 5. Make the settings match your bot
`src/features.py` ships with example settings (welcome, moderation, anti-raid). Rename/add/remove entries so each `key` is something your bot actually reads.

## Notes
- Settings take up to ~1 minute to reach the bot (cache) and KV is eventually consistent across regions.
- Free-plan KV allows 1,000 writes/day. The bot heartbeat defaults to every 5 minutes (~288/day). On a paid plan you can set `REX_HEARTBEAT_SECONDS=60`.
- Optional artwork: add your own `public/img/avatar.png` and it appears in the home page hero.
- If the deploy says `No module named features`, paste the contents of `src/features.py` at the top of `src/worker.py` and delete the `from features import ...` lines.
