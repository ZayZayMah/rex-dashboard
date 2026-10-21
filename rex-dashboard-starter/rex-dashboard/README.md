# REX Dashboard

Flask starter for the REX Discord bot: branded public page, Discord OAuth2, profile, manageable-server list, and an allow-listed server settings API.

## Run

Python 3.11+ is recommended.

```bash
python -m venv .venv
# Windows: .venv\\Scripts\\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
```

Copy `.env.example` values into your hosting environment. Flask does not automatically load `.env` in this starter. Set `FLASK_SECRET_KEY`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, and `DISCORD_REDIRECT_URI`, then run `python app.py` or `gunicorn app:app`.

## Discord OAuth2

Add the exact production callback `https://YOUR_DOMAIN/auth/callback` under Discord Developer Portal → OAuth2 Redirects. The app requests `identify` and `guilds` only. Never expose the bot token or client secret in browser code.

## Current settings

The allow-list currently includes welcome enabled/channel/message, moderation log enabled/channel, tickets enabled, and levels enabled. Add other settings only after matching them to the actual bot implementation.

The bot can read saved configuration from `GET /internal/guild-settings/<guild_id>` with `X-REX-API-Key: <REX_BOT_API_SECRET>`. Configure the same secret on both sides and use HTTPS. This endpoint does not by itself make settings live: the Ryft bot must be updated to poll it or use a shared database. JSON storage needs a persistent disk; ephemeral deployments should use a database.

## Deploy checklist

1. Deploy to a Python web host with persistent storage.
2. Set all environment secrets in the host dashboard.
3. Add the production callback to Discord OAuth2 settings.
4. Point the intended Cloudflare DNS record to the web host and configure HTTPS/SSL. Don't overwrite unrelated DNS records.
5. Configure secure session cookies, rate limits, logging, backups, and token refresh/revocation before public launch.
6. Integrate the bot with the settings endpoint/shared database and test permission checks in a private server.

## Routes

`/`, `/login`, `/auth/callback`, `/dashboard`, `/servers/<guild_id>`, `/profile`, `/docs`, `/health`, `/api/servers/<guild_id>/settings`, `/internal/guild-settings/<guild_id>`.

This starter has not been deployed or connected to the live bot, GitHub, Cloudflare, or Ryft. Production OAuth and live bot sync require configuration and testing.
