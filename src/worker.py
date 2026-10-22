"""REX Dashboard - Cloudflare Python Worker.

Serves only /api/* and /auth/* (the static site in /public is served by
Cloudflare directly). No third-party Python packages are needed.

Secrets / variables (Cloudflare -> Settings -> Variables and Secrets):
  DISCORD_CLIENT_ID      required  Discord application (OAuth2) client ID
  DISCORD_CLIENT_SECRET  required  Discord application client secret   (Secret)
  BOT_API_KEY            required  shared key the bot uses to talk to us (Secret)
  OWNER_ID               optional  your Discord user ID (unlocks /admin)
  PUBLIC_URL             optional  override the site origin used for OAuth redirects
  INVITE_PERMISSIONS     optional  permission number for the "Add REX" link
"""
import hashlib
import hmac
import json
import re
import secrets
import time
from urllib.parse import parse_qs, quote, urlencode, urlparse

from js import Object
from js import fetch as js_fetch
from pyodide.ffi import to_js
from workers import Response, WorkerEntrypoint

from features import (
    effective_settings,
    is_premium,
    public_schema,
    setting_index,
    validate,
)

DISCORD_API = "https://discord.com/api/v10"
USER_AGENT = "DiscordBot (https://github.com/ZayZayMah/rex-dashboard, 1.0)"

SESSION_COOKIE = "rex_session"
STATE_COOKIE = "rex_oauth_state"
SESSION_TTL = 7 * 24 * 3600

SNOWFLAKE = re.compile(r"^\d{15,25}$")
ASSET_HASH = re.compile(r"^[A-Za-z0-9_]{1,64}$")
ADMINISTRATOR = 0x8
MANAGE_GUILD = 0x20

# The bot sends a heartbeat every few minutes (default 5). Treat it as offline
# when nothing has been received for this long.
ONLINE_WINDOW = 12 * 60

SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Strict-Transport-Security": "max-age=31536000",
}

_RATE = {}


class HttpError(Exception):
    def __init__(self, status, code, message=""):
        super().__init__(code)
        self.status = status
        self.code = code
        self.message = message or code.replace("_", " ")


# --------------------------------------------------------------------------- helpers
def now():
    return int(time.time())


def rate_limited(key, limit, window):
    """Best-effort per-isolate limiter (protects the KV write quota)."""
    t = time.time()
    hits = [x for x in _RATE.get(key, []) if t - x < window]
    if len(hits) >= limit:
        _RATE[key] = hits
        return True
    hits.append(t)
    _RATE[key] = hits
    if len(_RATE) > 2000:
        _RATE.clear()
    return False


def json_response(data, status=200, headers=None):
    out = {"Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store"}
    out.update(SECURITY_HEADERS)
    if headers:
        out.update(headers)
    return Response(json.dumps(data, separators=(",", ":")), status=status, headers=out)


def html_response(html, status=200):
    out = {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'",
    }
    out.update(SECURITY_HEADERS)
    return Response(html, status=status, headers=out)


def redirect(location, cookie=None):
    headers = {"Location": location, "Cache-Control": "no-store"}
    headers.update(SECURITY_HEADERS)
    if cookie:
        headers["Set-Cookie"] = cookie
    return Response("", status=302, headers=headers)


def make_cookie(name, value, max_age, path="/"):
    return f"{name}={value}; Max-Age={max_age}; Path={path}; HttpOnly; Secure; SameSite=Lax"


def get_cookie(request, name):
    header = request.headers.get("Cookie") or ""
    for part in header.split(";"):
        key, _, value = part.strip().partition("=")
        if key == name:
            return value
    return None


def token_hash(token):
    return hashlib.sha256(token.encode()).hexdigest()


def safe_equal(a, b):
    return hmac.compare_digest(str(a).encode(), str(b).encode())


def avatar_url(uid, avatar_hash):
    if avatar_hash and ASSET_HASH.match(avatar_hash):
        ext = "gif" if avatar_hash.startswith("a_") else "png"
        return f"https://cdn.discordapp.com/avatars/{uid}/{avatar_hash}.{ext}?size=128"
    try:
        index = (int(uid) >> 22) % 6
    except (TypeError, ValueError):
        index = 0
    return f"https://cdn.discordapp.com/embed/avatars/{index}.png"


def icon_url(gid, icon_hash):
    if icon_hash and ASSET_HASH.match(icon_hash):
        ext = "gif" if icon_hash.startswith("a_") else "png"
        return f"https://cdn.discordapp.com/icons/{gid}/{icon_hash}.{ext}?size=128"
    return None


def clean_str(value, limit):
    if not isinstance(value, str):
        return ""
    return re.sub(r"[\x00-\x1f\x7f]", "", value).strip()[:limit]


def clean_int(value, low=0, high=10**12):
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    value = int(value)
    return value if low <= value <= high else None


async def http(method, url, headers=None, body=None):
    init = {"method": method, "headers": headers or {}}
    if body is not None:
        init["body"] = body
    resp = await js_fetch(url, to_js(init, dict_converter=Object.fromEntries))
    return int(resp.status), await resp.text()


class Store:
    """Tiny JSON wrapper around the REX_KV namespace."""

    def __init__(self, kv):
        self.kv = kv

    async def get(self, key):
        raw = await self.kv.get(key)
        if raw is None:
            return None
        try:
            return json.loads(raw)
        except ValueError:
            return None

    async def put(self, key, value, ttl=None):
        payload = json.dumps(value, separators=(",", ":"))
        if ttl:
            options = to_js({"expirationTtl": max(60, int(ttl))}, dict_converter=Object.fromEntries)
            await self.kv.put(key, payload, options)
        else:
            await self.kv.put(key, payload)

    async def delete(self, key):
        await self.kv.delete(key)


def sanitize_guild(raw):
    """Validate one guild object pushed by the bot. Returns a clean dict or None."""
    if not isinstance(raw, dict):
        return None
    gid = raw.get("id")
    if not isinstance(gid, str) or not SNOWFLAKE.match(gid):
        return None
    icon = raw.get("icon")
    channels, roles = [], []
    for c in (raw.get("channels") or [])[:500]:
        if isinstance(c, dict) and isinstance(c.get("id"), str) and SNOWFLAKE.match(c["id"]):
            kind = "announcement" if c.get("type") == "announcement" else "text"
            channels.append({"id": c["id"], "name": clean_str(c.get("name"), 100), "type": kind})
    for r in (raw.get("roles") or [])[:250]:
        if isinstance(r, dict) and isinstance(r.get("id"), str) and SNOWFLAKE.match(r["id"]):
            roles.append({
                "id": r["id"],
                "name": clean_str(r.get("name"), 100),
                "color": clean_int(r.get("color"), 0, 0xFFFFFF) or 0,
                "managed": bool(r.get("managed")),
                "position": clean_int(r.get("position"), 0, 10000) or 0,
            })
    return {
        "id": gid,
        "name": clean_str(raw.get("name"), 100) or "Unknown server",
        "icon": icon if isinstance(icon, str) and ASSET_HASH.match(icon) else None,
        "member_count": clean_int(raw.get("member_count")) or 0,
        "premium": bool(raw.get("premium")),
        "channels": channels,
        "roles": roles,
    }


def sanitize_stats(raw):
    if not isinstance(raw, dict):
        raise HttpError(400, "bad_request", "Expected a JSON object.")
    out = {"ts": now()}
    status = raw.get("status")
    out["status"] = status if status in ("online", "degraded", "starting") else "online"
    for key in ("latency_ms", "uptime_s", "guild_count", "user_count", "command_count",
                "shard_count", "errors_last_hour", "last_health_check", "next_health_check"):
        value = clean_int(raw.get(key))
        if value is not None:
            out[key] = value
    out["version"] = clean_str(raw.get("version"), 32)
    features = {}
    raw_features = raw.get("features")
    if isinstance(raw_features, dict):
        for name, info in list(raw_features.items())[:40]:
            if not isinstance(info, dict):
                continue
            state = info.get("state")
            features[clean_str(name, 40)] = {
                "state": state if state in ("ok", "degraded", "down", "unknown") else "unknown",
                "detail": clean_str(info.get("detail"), 200),
            }
    out["features"] = features
    return out


# --------------------------------------------------------------------------- worker
class Default(WorkerEntrypoint):
    # ---- plumbing
    def cfg(self, name, default=None):
        value = getattr(self.env, name, None)
        if value is None or value == "":
            return default
        return str(value)

    @property
    def store(self):
        kv = getattr(self.env, "REX_KV", None)
        if kv is None:
            raise HttpError(503, "storage_missing", "The REX_KV storage binding is missing.")
        return Store(kv)

    def public_origin(self, url):
        configured = self.cfg("PUBLIC_URL")
        if configured:
            return configured.rstrip("/")
        return f"{url.scheme}://{url.netloc}"

    def missing_config(self, *names):
        return [n for n in names if not self.cfg(n)]

    def invite_url(self, guild_id=None):
        client_id = self.cfg("DISCORD_CLIENT_ID")
        if not client_id:
            return None
        params = {
            "client_id": client_id,
            "permissions": self.cfg("INVITE_PERMISSIONS", "8"),
            "scope": "bot applications.commands",
        }
        if guild_id:
            params["guild_id"] = guild_id
            params["disable_guild_select"] = "true"
        return "https://discord.com/oauth2/authorize?" + urlencode(params, quote_via=quote)

    async def read_json(self, request, limit):
        raw = await request.text()
        if len(raw) > limit:
            raise HttpError(413, "too_large", "Request body is too large.")
        try:
            return json.loads(raw)
        except ValueError:
            raise HttpError(400, "bad_json", "Body must be valid JSON.")

    # ---- entry point
    async def fetch(self, request):
        try:
            return await self.route(request)
        except HttpError as err:
            return json_response({"error": err.code, "message": err.message}, err.status)
        except Exception as err:  # never leak internals to the browser
            print("unhandled error:", type(err).__name__, str(err)[:300])
            return json_response({"error": "internal_error", "message": "Something went wrong."}, 500)

    async def route(self, request):
        url = urlparse(request.url)
        path = url.path.rstrip("/") or "/"
        method = request.method.upper()

        if path == "/auth/login" and method == "GET":
            return await self.auth_login(url)
        if path == "/auth/callback" and method == "GET":
            return await self.auth_callback(request, url)
        if path == "/api/status" and method == "GET":
            return await self.api_status()
        if path.startswith("/api/bot/"):
            return await self.route_bot(request, path, method)
        if path.startswith("/api/"):
            return await self.route_user(request, url, path, method)
        raise HttpError(404, "not_found", "Not found.")

    # ---- Discord login
    async def auth_login(self, url):
        missing = self.missing_config("DISCORD_CLIENT_ID", "DISCORD_CLIENT_SECRET")
        if missing:
            items = "".join(f"<li><code>{name}</code></li>" for name in missing)
            return html_response(
                "<body style='font:16px system-ui;background:#04070f;color:#e8f7ff;padding:40px;max-width:640px;margin:auto'>"
                "<h1>REX dashboard setup</h1><p>Discord login is not configured yet. "
                "Add these in Cloudflare under <b>Workers &amp; Pages &rarr; rex &rarr; Settings &rarr; "
                "Variables and Secrets</b>, then reload:</p>"
                f"<ul>{items}</ul></body>",
                status=503,
            )
        state = secrets.token_urlsafe(24)
        params = {
            "client_id": self.cfg("DISCORD_CLIENT_ID"),
            "response_type": "code",
            "redirect_uri": self.public_origin(url) + "/auth/callback",
            "scope": "identify guilds",
            "state": state,
            "prompt": "none",
        }
        location = "https://discord.com/oauth2/authorize?" + urlencode(params, quote_via=quote)
        return redirect(location, make_cookie(STATE_COOKIE, state, 600, path="/auth"))

    async def auth_callback(self, request, url):
        query = {k: v[0] for k, v in parse_qs(url.query).items() if v}
        if query.get("error"):
            return redirect("/dashboard?login=denied")
        code, state = query.get("code"), query.get("state")
        cookie_state = get_cookie(request, STATE_COOKIE)
        if not code or not state or not cookie_state or not safe_equal(state, cookie_state):
            return redirect("/dashboard?login=failed")
        if self.missing_config("DISCORD_CLIENT_ID", "DISCORD_CLIENT_SECRET"):
            return redirect("/dashboard?login=failed")

        status, text = await http(
            "POST",
            DISCORD_API + "/oauth2/token",
            {"Content-Type": "application/x-www-form-urlencoded", "User-Agent": USER_AGENT},
            urlencode({
                "client_id": self.cfg("DISCORD_CLIENT_ID"),
                "client_secret": self.cfg("DISCORD_CLIENT_SECRET"),
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": self.public_origin(url) + "/auth/callback",
            }),
        )
        if status != 200:
            return redirect("/dashboard?login=failed")
        try:
            access = json.loads(text)["access_token"]
        except (ValueError, KeyError, TypeError):
            return redirect("/dashboard?login=failed")

        auth = {"Authorization": "Bearer " + access, "User-Agent": USER_AGENT}
        s1, t1 = await http("GET", DISCORD_API + "/users/@me", auth)
        s2, t2 = await http("GET", DISCORD_API + "/users/@me/guilds", auth)
        if s1 != 200 or s2 != 200:
            return redirect("/dashboard?login=failed")
        try:
            user, guilds = json.loads(t1), json.loads(t2)
        except ValueError:
            return redirect("/dashboard?login=failed")

        managed = []
        for g in guilds[:200]:
            try:
                perms = int(g.get("permissions") or 0)
            except (TypeError, ValueError):
                perms = 0
            if g.get("owner") or perms & ADMINISTRATOR or perms & MANAGE_GUILD:
                managed.append({
                    "id": str(g["id"]),
                    "name": clean_str(g.get("name"), 100),
                    "icon": g.get("icon") if isinstance(g.get("icon"), str) and ASSET_HASH.match(g["icon"]) else None,
                    "owner": bool(g.get("owner")),
                })

        token = secrets.token_urlsafe(32)
        session = {
            "user": {
                "id": str(user["id"]),
                "username": clean_str(user.get("username"), 64),
                "name": clean_str(user.get("global_name") or user.get("username"), 64),
                "avatar": user.get("avatar") if isinstance(user.get("avatar"), str) and ASSET_HASH.match(user["avatar"]) else None,
            },
            "guilds": managed,
            "csrf": secrets.token_urlsafe(24),
            "exp": now() + SESSION_TTL,
        }
        await self.store.put("sess:" + token_hash(token), session, ttl=SESSION_TTL)
        return redirect("/dashboard", make_cookie(SESSION_COOKIE, token, SESSION_TTL))

    # ---- sessions
    async def get_session(self, request):
        token = get_cookie(request, SESSION_COOKIE)
        if not token or len(token) > 100:
            return None
        session = await self.store.get("sess:" + token_hash(token))
        if not session or session.get("exp", 0) < now():
            return None
        return session

    async def require_session(self, request):
        session = await self.get_session(request)
        if not session:
            raise HttpError(401, "not_logged_in", "Please log in with Discord.")
        return session

    def check_mutation(self, request, url, session):
        origin = request.headers.get("Origin")
        if origin and origin != self.public_origin(url):
            raise HttpError(403, "bad_origin", "Cross-site request blocked.")
        sent = request.headers.get("X-CSRF-Token") or ""
        if not safe_equal(sent, session["csrf"]):
            raise HttpError(403, "bad_csrf", "Session check failed. Reload the page.")

    def is_owner(self, session):
        owner = self.cfg("OWNER_ID")
        return bool(owner) and safe_equal(session["user"]["id"], owner)

    # ---- public status
    async def api_status(self):
        stats = await self.store.get("stats:latest")
        online = bool(stats) and now() - stats.get("ts", 0) < ONLINE_WINDOW
        body = {
            "online": online,
            "login_ready": not self.missing_config("DISCORD_CLIENT_ID", "DISCORD_CLIENT_SECRET"),
            "invite_url": self.invite_url(),
            "last_seen": stats.get("ts") if stats else None,
        }
        if stats:
            for key in ("latency_ms", "uptime_s", "guild_count", "user_count", "command_count"):
                body[key] = stats.get(key)
        return json_response(body, headers={"Cache-Control": "public, max-age=30"})

    # ---- logged-in API
    async def route_user(self, request, url, path, method):
        session = await self.require_session(request)

        if path == "/api/me" and method == "GET":
            return await self.api_me(session)
        if path == "/api/logout" and method == "POST":
            self.check_mutation(request, url, session)
            token = get_cookie(request, SESSION_COOKIE)
            await self.store.delete("sess:" + token_hash(token))
            return json_response({"ok": True}, headers={"Set-Cookie": make_cookie(SESSION_COOKIE, "", 0)})
        if path == "/api/admin/health" and method == "GET":
            return await self.api_admin_health(session)

        parts = path.split("/")  # ['', 'api', 'guilds', '<id>', 'settings']
        if len(parts) in (4, 5) and parts[2] == "guilds":
            gid = parts[3]
            if len(parts) == 4 and method == "GET":
                return await self.api_guild(session, gid)
            if len(parts) == 5 and parts[4] == "settings" and method == "PUT":
                return await self.api_guild_save(request, url, session, gid)
        raise HttpError(404, "not_found", "Not found.")

    async def api_me(self, session):
        index = await self.store.get("bot:guilds") or {}
        guilds = []
        for g in session["guilds"]:
            known = index.get(g["id"])
            guilds.append({
                "id": g["id"],
                "name": g["name"],
                "icon_url": icon_url(g["id"], g["icon"]),
                "owner": g["owner"],
                "bot_present": known is not None,
                "premium": bool(known and known.get("p")),
                "invite_url": None if known is not None else self.invite_url(g["id"]),
            })
        guilds.sort(key=lambda x: (not x["bot_present"], x["name"].lower()))
        user = session["user"]
        return json_response({
            "user": {
                "id": user["id"],
                "name": user["name"],
                "username": user["username"],
                "avatar_url": avatar_url(user["id"], user["avatar"]),
            },
            "csrf": session["csrf"],
            "is_owner": self.is_owner(session),
            "guilds": guilds,
        })

    async def require_guild(self, session, gid):
        if not SNOWFLAKE.match(gid):
            raise HttpError(404, "not_found", "Server not found.")
        if gid not in {g["id"] for g in session["guilds"]}:
            raise HttpError(403, "forbidden", "You need Manage Server permission in that server.")
        guild = await self.store.get("guild:" + gid)
        if not guild:
            raise HttpError(404, "bot_not_in_server", "REX is not in that server yet.")
        return guild

    async def api_guild(self, session, gid):
        guild = await self.require_guild(session, gid)
        stored = await self.store.get("settings:" + gid) or {}
        premium = bool(guild.get("premium"))
        return json_response({
            "guild": {
                "id": gid,
                "name": guild["name"],
                "icon_url": icon_url(gid, guild.get("icon")),
                "member_count": guild.get("member_count", 0),
                "premium": premium,
                "channels": guild.get("channels", []),
                "roles": guild.get("roles", []),
            },
            "schema": public_schema(),
            "settings": effective_settings(stored.get("values", {}), premium, guild),
            "history": stored.get("history", []),
            "updated": stored.get("updated"),
        })

    async def api_guild_save(self, request, url, session, gid):
        self.check_mutation(request, url, session)
        user = session["user"]
        if rate_limited("w:" + user["id"], 20, 60):
            raise HttpError(429, "slow_down", "Too many changes. Wait a moment and try again.")
        guild = await self.require_guild(session, gid)
        body = await self.read_json(request, 64 * 1024)
        changes = body.get("changes") if isinstance(body, dict) else None
        if not isinstance(changes, dict) or not changes or len(changes) > 50:
            raise HttpError(400, "bad_request", "Send a non-empty 'changes' object.")

        index = setting_index()
        premium = bool(guild.get("premium"))
        stored = await self.store.get("settings:" + gid) or {}
        values = dict(stored.get("values", {}))
        changed = []
        for key, raw in changes.items():
            if key not in index:
                raise HttpError(400, "unknown_setting", f"Unknown setting: {clean_str(str(key), 40)}")
            section, setting = index[key]
            try:
                cleaned = validate(setting, raw, guild)
            except ValueError as err:
                raise HttpError(400, "invalid_value", str(err))
            if is_premium(section, setting) and not premium and cleaned != setting["default"]:
                raise HttpError(403, "premium_required", f"{setting['label']} needs REX Premium on this server.")
            if values.get(key, setting["default"]) != cleaned:
                values[key] = cleaned
                changed.append(key)

        history = stored.get("history", [])
        updated = stored.get("updated")
        if changed:
            history = ([{"t": now(), "u": user["id"], "n": user["name"], "k": changed[:20]}] + history)[:15]
            updated = now()
            await self.store.put("settings:" + gid, {"values": values, "history": history, "updated": updated})
        return json_response({
            "settings": effective_settings(values, premium, guild),
            "changed": changed,
            "history": history,
            "updated": updated,
        })

    async def api_admin_health(self, session):
        if not self.is_owner(session):
            raise HttpError(403, "owner_only", "Only the bot owner can view this.")
        stats = await self.store.get("stats:latest")
        index = await self.store.get("bot:guilds") or {}
        online = bool(stats) and now() - stats.get("ts", 0) < ONLINE_WINDOW
        return json_response({
            "online": online,
            "server_time": now(),
            "stats": stats,
            "synced_guilds": len(index),
            "premium_guilds": sum(1 for v in index.values() if v.get("p")),
            "config": {
                "discord_login": not self.missing_config("DISCORD_CLIENT_ID", "DISCORD_CLIENT_SECRET"),
                "bot_api_key": bool(self.cfg("BOT_API_KEY")),
                "owner_id": bool(self.cfg("OWNER_ID")),
            },
        })

    # ---- bot API (used by bot/rex_dashboard.py)
    def require_bot(self, request):
        key = self.cfg("BOT_API_KEY")
        if not key:
            raise HttpError(503, "bot_api_not_configured", "BOT_API_KEY is not set on the dashboard.")
        header = request.headers.get("Authorization") or ""
        supplied = header[7:] if header.startswith("Bearer ") else ""
        if not safe_equal(supplied, key):
            raise HttpError(401, "unauthorized", "Bad bot key.")

    async def route_bot(self, request, path, method):
        self.require_bot(request)
        parts = path.split("/")  # ['', 'api', 'bot', ...]

        if parts[3:] == ["heartbeat"] and method == "POST":
            stats = sanitize_stats(await self.read_json(request, 64 * 1024))
            await self.store.put("stats:latest", stats)
            return json_response({"ok": True})

        if parts[3:] == ["sync"] and method == "POST":
            return await self.bot_sync(await self.read_json(request, 1024 * 1024))

        if len(parts) == 5 and parts[3] == "guilds" and method == "DELETE":
            gid = parts[4]
            if not SNOWFLAKE.match(gid):
                raise HttpError(400, "bad_request", "Bad guild id.")
            index = await self.store.get("bot:guilds") or {}
            if gid in index:
                del index[gid]
                await self.store.put("bot:guilds", index)
            await self.store.delete("guild:" + gid)
            return json_response({"ok": True})

        if len(parts) == 6 and parts[3] == "guilds" and parts[5] == "settings" and method == "GET":
            gid = parts[4]
            if not SNOWFLAKE.match(gid):
                raise HttpError(400, "bad_request", "Bad guild id.")
            guild = await self.store.get("guild:" + gid)
            if not guild:
                raise HttpError(404, "unknown_guild", "That server has not been synced yet.")
            stored = await self.store.get("settings:" + gid) or {}
            premium = bool(guild.get("premium"))
            return json_response({
                "guild_id": gid,
                "premium": premium,
                "settings": effective_settings(stored.get("values", {}), premium, guild),
                "updated": stored.get("updated"),
            })

        raise HttpError(404, "not_found", "Not found.")

    async def bot_sync(self, body):
        if not isinstance(body, dict) or not isinstance(body.get("guilds"), list):
            raise HttpError(400, "bad_request", "Expected {guilds: [...]}.")
        batch = [g for g in (sanitize_guild(x) for x in body["guilds"][:25]) if g]
        index = await self.store.get("bot:guilds") or {}
        index_changed = False
        written = 0
        for g in batch:
            existing = await self.store.get("guild:" + g["id"])
            if existing != g:
                await self.store.put("guild:" + g["id"], g)
                written += 1
            entry = {"n": g["name"], "i": g["icon"], "p": g["premium"]}
            if index.get(g["id"]) != entry:
                index[g["id"]] = entry
                index_changed = True

        pruned = 0
        keep = body.get("prune_to")
        if isinstance(keep, list):
            keep_ids = {k for k in keep if isinstance(k, str)}
            for gid in [k for k in index if k not in keep_ids]:
                del index[gid]
                await self.store.delete("guild:" + gid)
                pruned += 1
                index_changed = True
        if index_changed:
            await self.store.put("bot:guilds", index)
        return json_response({"ok": True, "received": len(batch), "written": written, "pruned": pruned})
