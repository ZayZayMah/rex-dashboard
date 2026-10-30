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


## Phase 3 notes
- New Worker file `src/features.py` (support chat + Gmail email). Deploy as usual (`wrangler deploy`).
- Gmail email needs two new secrets: `GMAIL_CLIENT_ID` and `GMAIL_CLIENT_SECRET` (Google Cloud > OAuth client, type Desktop or Web with redirect `http://localhost`). In Owner mode > Email, press Connect, approve, and paste the `http://localhost/?code=...` address you land on. Emails go to everyone with an email on file unless they turned emails off on their profile (or used the unsubscribe link). Daily cap 450. New: `src/mail.py` (one renderer for preview, tests and real sends) and a full-page builder at `/email-builder` (free placement, pictures, fonts, desktop + phone layouts). Saved emails keep their own send-to / send-when rules (manual, first login, code redeemed, support chat closed, server banned/unbanned). `public/_headers` now allows inline styles (`style-src 'unsafe-inline'`), which fixes inline styling being blocked in production.
- New static files: `public/js/card.js` (image card designer), `public/js/dialog.js`, `public/js/support.js`. After editing anything in `tools/` run `cd tools && python3 build_pages.py`.
- The builder lives on its own page; the status editor is at the top of Owner mode > Tools.

## Email tags, preferences page and automation
- Tags (Announcements, New features, Bug fixes by default) are managed in Owner mode > Email > Email tags. People choose their tags on their profile or at `/<discord id>/email` (or `/<email>/email` for an address with no Discord account). The link in an email carries a private `?t=` token so nobody can change someone else's choices; logged-in users don't need it.
- In the builder, `{unsubscribe_link}` is that page (use `[Change your emails]({unsubscribe_link})` to mask it). The footer always has Email preferences + Unsubscribe.
- The **Automation** button in the builder sets WHEN (first login, data removed, bot added/removed, joined support server, code redeemed, chat closed, server banned/unbanned), SEND TO (people with a tag / everyone / essential) and AT (immediately / a time of day UTC / when they are next on the dashboard). Time-of-day sends go out on the next bot check-in after that time.
- **Generate: <tag>** makes a ready-to-edit email for a tag. Things in the builder can now overlap freely.
- `wrangler.jsonc` gains `"/*/email"` in `run_worker_first` (redeploy so the preferences page address works).

## Support overhaul + Pages (phase 5)
- **Support (beta)**: while the beta is on Testing, only owners and testers can open `/support` (everyone else just sees "Not available yet"). The helper is now **Rex** (logo avatar, your avatar on your messages). Each ticket type starts with onboarding questions and quick-reply buttons; every answer is decided on the server (`src/helper.py`, answers in `src/helper_data.py`), so the page can't be tricked into saying things or opening tickets. Keyboard mashing, repeated messages and swearing are filtered; a person is only offered after real answers, and always needs a click on "Yes, open a ticket".
- When Rex opens a ticket it appears as `ticket-<userid>` in the official server's ticket category (bot: `rex_dashboard.py`). If the person isn't in the server yet they get **End ticket here / I have joined** (and **Rex couldn't see you, try again**). After the ticket exists the chat closes and links to it; messages in the Discord ticket are copied back to the closed chat (read only).
- Closed chats can't be typed in; users can only **Delete for me**. Owners still see them and they auto-delete 30 days after closing unless you press **Keep**. Each person can have 3 chats (user-deleted ones count until they are removed).
- Rex pauses someone for 10 minutes when it flags them and DMs the owners buttons (1 hour / 1 day / 7 days / 30 days / Dismiss). Owners can also time out anyone from Owner > Support > Timeouts, and set any status text on a chat ("Open · Waiting on your reply").
- **Pages (beta)**: Owner > Website > Beta > Custom pages. Owner > Pages lists, adds, removes and copies links. `/pages/<name>` is built in `/page-builder` (same editor as emails), follows the site theme (preview Normal / Christmas / Halloween in the editor), and can hide the navigation bar. New file `public/js/pagerender.js`; `wrangler.jsonc` now sends `/pages/*` through the Worker. After editing `tools/` run `cd tools && python3 build_pages.py`.
