"""REX Dashboard - Cloudflare Python Worker.

Serves only /api/* and /auth/* (the static website in /public is served directly by Cloudflare).
No third-party Python packages are needed.

Variables / secrets (Cloudflare -> Workers & Pages -> rex -> Settings -> Variables and Secrets):
  DISCORD_CLIENT_ID      required  Discord application client ID
  DISCORD_CLIENT_SECRET  required  Discord application client secret            (Secret)
  BOT_API_KEY            required  shared key the bot uses to talk to us          (Secret)
  OWNER_ID               optional  your Discord user ID(s), comma separated. Unlocks /admin and
                                   lets you open every server REX is in.
  SUPPORT_URL            optional  defaults to https://discord.gg/rexsupport
  PUBLIC_URL             optional  override the site origin used for OAuth redirects
  INVITE_PERMISSIONS     optional  permission number for the "Add REX" link (default 8)

The BOT is the source of truth for settings. Website saves go into a queue; the bot picks them
up, re-checks them (who you are in Discord, your permissions, the server's tier) and applies them.
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

from schema import (
    SNOWFLAKE,
    clean_str,
    index_schema,
    sanitize_schema,
    tier_active,
    validate_value,
)

DISCORD_API = "https://discord.com/api/v10"
USER_AGENT = "DiscordBot (https://github.com/ZayZayMah/rex-dashboard, 2.0)"
DEFAULT_SUPPORT = "https://discord.gg/rexsupport"

SESSION_COOKIE = "rex_session"
STATE_COOKIE = "rex_oauth_state"
SESSION_TTL = 7 * 24 * 3600
ASSET_HASH = re.compile(r"^[A-Za-z0-9_]{1,64}$")
ADMINISTRATOR = 0x8
MANAGE_GUILD = 0x20

ONLINE_WINDOW = 12 * 60          # bot counts as offline after this many seconds without a heartbeat
PENDING_MAX_AGE = 24 * 3600      # queued website changes older than this are dropped
WATCH_MAX_AGE = 14 * 24 * 3600   # profiles are kept fresh for people who logged in within this window
TIER_NAMES = ("premium", "priority", "ultra")

SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Strict-Transport-Security": "max-age=31536000",
}

_RATE = {}
_CACHE = {}


class HttpError(Exception):
    def __init__(self, status, code, message="", extra=None):
        super().__init__(code)
        self.status = status
        self.code = code
        self.message = message or code.replace("_", " ")
        self.extra = extra or {}


# --------------------------------------------------------------------------- helpers
def now():
    return int(time.time())


def rate_limited(key, limit, window):
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


def clean_int(value, low=0, high=10**12):
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    value = int(value)
    return value if low <= value <= high else None


def clean_epoch(value):
    return clean_int(value, 0, 4102444800)


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


def highest_tier(tiers):
    best = "free"
    for name in TIER_NAMES:
        if (tiers.get(name) or {}).get("active"):
            best = name
    return best


# --------------------------------------------------------------------------- sanitizers (bot -> website)
def sanitize_tiers(raw):
    out = {}
    raw = raw if isinstance(raw, dict) else {}
    for name in TIER_NAMES:
        entry = raw.get(name) if isinstance(raw.get(name), dict) else {}
        out[name] = {
            "active": bool(entry.get("active")),
            "expires": clean_epoch(entry.get("expires")),
            "inherited": bool(entry.get("inherited")),
        }
    return out


def sanitize_value(value):
    if isinstance(value, bool) or value is None:
        return value
    if isinstance(value, (int, float)):
        return int(value) if float(value) == int(value) else value
    if isinstance(value, str):
        return value[:2000]
    if isinstance(value, list):
        return [str(x)[:100] for x in value[:100]]
    return None


def sanitize_guild(raw):
    if not isinstance(raw, dict):
        return None
    gid = raw.get("id")
    if not isinstance(gid, str) or not SNOWFLAKE.match(gid):
        return None
    icon = raw.get("icon")
    channels, roles = [], []
    for c in (raw.get("channels") or [])[:400]:
        if isinstance(c, dict) and isinstance(c.get("id"), str) and SNOWFLAKE.match(c["id"]) \
                and c.get("type") in ("text", "announcement", "category", "voice"):
            channels.append({"id": c["id"], "name": clean_str(c.get("name"), 100), "type": c["type"],
                             "parent": clean_str(c.get("parent"), 100)})
    for r in (raw.get("roles") or [])[:250]:
        if isinstance(r, dict) and isinstance(r.get("id"), str) and SNOWFLAKE.match(r["id"]):
            roles.append({"id": r["id"], "name": clean_str(r.get("name"), 100),
                          "color": clean_int(r.get("color"), 0, 0xFFFFFF) or 0,
                          "managed": bool(r.get("managed")), "position": clean_int(r.get("position"), 0, 10000) or 0})
    values = {}
    if isinstance(raw.get("values"), dict):
        for key, value in list(raw["values"].items())[:200]:
            if isinstance(key, str) and len(key) <= 80:
                values[key] = sanitize_value(value)
    return {
        "id": gid,
        "name": clean_str(raw.get("name"), 100) or "Unknown server",
        "icon": icon if isinstance(icon, str) and ASSET_HASH.match(icon) else None,
        "member_count": clean_int(raw.get("member_count")) or 0,
        "tiers": sanitize_tiers(raw.get("tiers")),
        "channels": channels,
        "roles": roles,
        "values": values,
    }


def sanitize_stats(raw):
    if not isinstance(raw, dict):
        raise HttpError(400, "bad_request", "Expected a JSON object.")
    out = {"ts": now()}
    status = raw.get("status")
    out["status"] = status if status in ("online", "degraded", "starting") else "online"
    for key in ("latency_ms", "uptime_s", "guild_count", "user_count", "command_count", "shard_count",
                "errors_last_hour", "last_health_check", "next_health_check"):
        value = clean_int(raw.get(key))
        if value is not None:
            out[key] = value
    out["version"] = clean_str(raw.get("version"), 60)
    features = {}
    if isinstance(raw.get("features"), dict):
        for name, info in list(raw["features"].items())[:40]:
            if isinstance(info, dict):
                state = info.get("state")
                features[clean_str(name, 40)] = {
                    "state": state if state in ("ok", "degraded", "down", "unknown") else "unknown",
                    "detail": clean_str(info.get("detail"), 240),
                }
    out["features"] = features
    return out


def sanitize_catalog(raw):
    if not isinstance(raw, dict) or not isinstance(raw.get("commands"), list):
        raise HttpError(400, "bad_request", "Expected {commands: [...]}.")
    commands = []
    for c in raw["commands"][:700]:
        if not isinstance(c, dict):
            continue
        name = clean_str(c.get("name"), 100)
        if not name:
            continue
        params = []
        for p in (c.get("params") or [])[:25]:
            if not isinstance(p, dict):
                continue
            choices = []
            for ch in (p.get("choices") or [])[:25]:
                if isinstance(ch, dict):
                    v = ch.get("value")
                    choices.append({"name": clean_str(ch.get("name"), 100),
                                    "value": v if isinstance(v, (int, float)) and not isinstance(v, bool) else clean_str(str(v), 100)})
            params.append({
                "name": clean_str(p.get("name"), 40),
                "description": clean_str(p.get("description"), 200),
                "required": bool(p.get("required")),
                "type": clean_str(p.get("type"), 20),
                "choices": choices,
                "min": p.get("min") if isinstance(p.get("min"), (int, float)) and not isinstance(p.get("min"), bool) else None,
                "max": p.get("max") if isinstance(p.get("max"), (int, float)) and not isinstance(p.get("max"), bool) else None,
            })
        commands.append({
            "name": name,
            "description": clean_str(c.get("description"), 200),
            "params": params,
            "access": c.get("access") if c.get("access") in ("everyone", "staff", "owner") else "staff",
            "requires": [clean_str(x, 40) for x in (c.get("requires") or [])[:10] if isinstance(x, str)],
            "scope": "server" if c.get("scope") == "server" else "global",
        })
    groups = {}
    if isinstance(raw.get("groups"), dict):
        for k, v in list(raw["groups"].items())[:200]:
            groups[clean_str(k, 100)] = clean_str(v, 200)
    return {"ts": now(), "commands": commands, "groups": groups}


def public_tiers(tiers):
    return {n: {"active": bool((tiers.get(n) or {}).get("active")),
                "expires": (tiers.get(n) or {}).get("expires"),
                "inherited": bool((tiers.get(n) or {}).get("inherited"))} for n in TIER_NAMES}


# --------------------------------------------------------------------------- worker
class Default(WorkerEntrypoint):
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

    @property
    def support_url(self):
        return self.cfg("SUPPORT_URL", DEFAULT_SUPPORT)

    def owner_ids(self):
        raw = self.cfg("OWNER_ID", "") or ""
        return {x for x in re.split(r"[\s,;]+", raw) if SNOWFLAKE.match(x)}

    def is_owner(self, session):
        return session["user"]["id"] in self.owner_ids()

    def invite_url(self, guild_id=None):
        client_id = self.cfg("DISCORD_CLIENT_ID")
        if not client_id:
            return None
        params = {"client_id": client_id, "permissions": self.cfg("INVITE_PERMISSIONS", "8"),
                  "scope": "bot applications.commands"}
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

    async def get_schema(self):
        cached = _CACHE.get("schema")
        if cached and time.time() - cached[0] < 60:
            return cached[1]
        schema = await self.store.get("schema")
        _CACHE["schema"] = (time.time(), schema)
        return schema

    # ---- entry point
    async def fetch(self, request):
        try:
            return await self.route(request)
        except HttpError as err:
            body = {"error": err.code, "message": err.message}
            body.update(err.extra)
            return json_response(body, err.status)
        except Exception as err:
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
        if path == "/api/commands" and method == "GET":
            return await self.api_commands()
        if path == "/api/schema" and method == "GET":
            return await self.api_public_schema()
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
                "Variables and Secrets</b>, then reload:</p>" f"<ul>{items}</ul></body>", status=503)
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
            "POST", DISCORD_API + "/oauth2/token",
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
            is_admin = bool(g.get("owner")) or bool(perms & ADMINISTRATOR)
            if is_admin or perms & MANAGE_GUILD:
                managed.append({
                    "id": str(g["id"]),
                    "name": clean_str(g.get("name"), 100),
                    "icon": g.get("icon") if isinstance(g.get("icon"), str) and ASSET_HASH.match(g["icon"]) else None,
                    "owner": bool(g.get("owner")),
                    "admin": is_admin,
                })

        uid = str(user["id"])
        token = secrets.token_urlsafe(32)
        session = {
            "user": {
                "id": uid,
                "username": clean_str(user.get("username"), 64),
                "name": clean_str(user.get("global_name") or user.get("username"), 64),
                "avatar": user.get("avatar") if isinstance(user.get("avatar"), str) and ASSET_HASH.match(user["avatar"]) else None,
            },
            "guilds": managed,
            "csrf": secrets.token_urlsafe(24),
            "exp": now() + SESSION_TTL,
        }
        await self.store.put("sess:" + token_hash(token), session, ttl=SESSION_TTL)
        await self.touch_watch(uid)
        return redirect("/dashboard", make_cookie(SESSION_COOKIE, token, SESSION_TTL))

    async def touch_watch(self, uid):
        """Remember who logged in recently so the bot keeps their profile data fresh."""
        watch = await self.store.get("watch") or {}
        t = now()
        if t - int(watch.get(uid, 0)) > 12 * 3600:
            watch[uid] = t
            watch = {k: v for k, v in watch.items() if t - int(v) < WATCH_MAX_AGE}
            await self.store.put("watch", watch)

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

    # ---- public
    async def api_status(self):
        stats = await self.store.get("stats:latest")
        online = bool(stats) and now() - stats.get("ts", 0) < ONLINE_WINDOW
        body = {
            "online": online,
            "login_ready": not self.missing_config("DISCORD_CLIENT_ID", "DISCORD_CLIENT_SECRET"),
            "invite_url": self.invite_url(),
            "support_url": self.support_url,
            "last_seen": stats.get("ts") if stats else None,
        }
        if stats:
            for key in ("latency_ms", "uptime_s", "guild_count", "user_count", "command_count"):
                body[key] = stats.get(key)
        return json_response(body, headers={"Cache-Control": "public, max-age=30"})

    async def api_commands(self):
        catalog = await self.store.get("commands")
        if not catalog:
            catalog = {"ts": None, "commands": [], "groups": {}}
        return json_response(catalog, headers={"Cache-Control": "public, max-age=120"})

    async def api_public_schema(self):
        """Feature list by tier for the public Premium page (no server data)."""
        schema = await self.get_schema()
        sections = []
        for sec in (schema or {}).get("sections", []):
            sections.append({
                "id": sec["id"], "name": sec["name"], "description": sec["description"], "tier": sec["tier"],
                "settings": [{"label": s["label"], "tier": s["tier"], "description": s["description"]} for s in sec["settings"]],
            })
        return json_response({"sections": sections}, headers={"Cache-Control": "public, max-age=300"})

    # ---- logged-in API
    async def route_user(self, request, url, path, method):
        session = await self.require_session(request)

        if path == "/api/me" and method == "GET":
            return await self.api_me(session)
        if path == "/api/profile" and method == "GET":
            return await self.api_profile(session)
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
                lite = "lite=1" in (url.query or "")
                return await self.api_guild(session, gid, lite)
            if len(parts) == 5 and parts[4] == "settings" and method == "PUT":
                return await self.api_guild_save(request, url, session, gid)
        raise HttpError(404, "not_found", "Not found.")

    async def api_me(self, session):
        index = await self.store.get("bot:guilds") or {}
        owner = self.is_owner(session)
        listed = set()
        guilds = []
        for g in session["guilds"]:
            known = index.get(g["id"])
            listed.add(g["id"])
            guilds.append({
                "id": g["id"], "name": g["name"], "icon_url": icon_url(g["id"], g["icon"]),
                "owner": g["owner"], "admin": g.get("admin", g["owner"]),
                "bot_present": known is not None, "tier": (known or {}).get("t", "free"),
                "invite_url": None if known is not None else self.invite_url(g["id"]),
                "via": "discord",
            })
        if owner:
            for gid, known in index.items():
                if gid not in listed:
                    guilds.append({
                        "id": gid, "name": known.get("n", gid), "icon_url": icon_url(gid, known.get("i")),
                        "owner": False, "admin": True, "bot_present": True, "tier": known.get("t", "free"),
                        "invite_url": None, "via": "owner",
                    })
        guilds.sort(key=lambda x: (not x["bot_present"], x["via"] == "owner", x["name"].lower()))
        user = session["user"]
        return json_response({
            "user": {"id": user["id"], "name": user["name"], "username": user["username"],
                     "avatar_url": avatar_url(user["id"], user["avatar"])},
            "csrf": session["csrf"],
            "is_owner": owner,
            "support_url": self.support_url,
            "guilds": guilds,
        })

    async def api_profile(self, session):
        user = session["user"]
        profile = await self.store.get("profile:" + user["id"])
        return json_response({
            "user": {"id": user["id"], "name": user["name"], "username": user["username"],
                     "avatar_url": avatar_url(user["id"], user["avatar"])},
            "is_owner": self.is_owner(session),
            "profile": profile,
            "servers_managed": len(session["guilds"]),
        })

    def guild_access(self, session, gid):
        """Return {'admin': bool} for this person in this server, or raise 403."""
        if not SNOWFLAKE.match(gid):
            raise HttpError(404, "not_found", "Server not found.")
        for g in session["guilds"]:
            if g["id"] == gid:
                return {"admin": bool(g.get("admin", g.get("owner")))}
        if self.is_owner(session):
            return {"admin": True}
        raise HttpError(403, "forbidden", "You need Manage Server permission in that server.")

    async def api_guild(self, session, gid, lite=False):
        access = self.guild_access(session, gid)
        guild = await self.store.get("guild:" + gid)
        if not guild:
            raise HttpError(404, "bot_not_in_server", "REX is not in that server yet.")
        queue = await self.store.get("q:all") or {}
        results = await self.store.get("res:" + gid) or []
        t = now()
        pending = [{"id": e["id"], "ts": e["ts"], "by": e.get("byname", ""), "keys": list(e["changes"].keys())}
                   for e in queue.get(gid, []) if t - e["ts"] < PENDING_MAX_AGE]
        body = {"values": guild.get("values", {}), "pending": pending, "results": results}
        if lite:
            return json_response(body)
        stats = await self.store.get("stats:latest")
        body.update({
            "guild": {
                "id": gid, "name": guild["name"], "icon_url": icon_url(gid, guild.get("icon")),
                "member_count": guild.get("member_count", 0), "tiers": public_tiers(guild.get("tiers") or {}),
                "channels": guild.get("channels", []), "roles": guild.get("roles", []),
            },
            "schema": await self.get_schema(),
            "can_admin": access["admin"],
            "owner_override": self.is_owner(session),
            "bot_online": bool(stats) and t - stats.get("ts", 0) < ONLINE_WINDOW,
            "support_url": self.support_url,
        })
        return json_response(body)

    async def api_guild_save(self, request, url, session, gid):
        self.check_mutation(request, url, session)
        user = session["user"]
        if rate_limited("w:" + user["id"], 20, 60):
            raise HttpError(429, "slow_down", "Too many changes. Wait a moment and try again.")
        access = self.guild_access(session, gid)
        guild = await self.store.get("guild:" + gid)
        if not guild:
            raise HttpError(404, "bot_not_in_server", "REX is not in that server yet.")
        schema = await self.get_schema()
        if not schema:
            raise HttpError(503, "bot_not_synced", "REX has not sent its settings list yet. Is the bot online?")
        body = await self.read_json(request, 64 * 1024)
        changes = body.get("changes") if isinstance(body, dict) else None
        if not isinstance(changes, dict) or not changes or len(changes) > 60:
            raise HttpError(400, "bad_request", "Send a non-empty 'changes' object.")

        index = index_schema(schema)
        owner = self.is_owner(session)
        errors, clean = {}, {}
        for key, raw in changes.items():
            spec = index.get(key)
            if spec is None:
                errors[str(key)[:60]] = "Unknown setting."
                continue
            if not owner and not tier_active(guild, spec["tier"]):
                errors[key] = f"{spec['label']} needs REX {spec['tier'].title()} on this server."
                continue
            if spec["perm"] == "admin" and not access["admin"]:
                errors[key] = f"{spec['label']} needs the Administrator permission."
                continue
            try:
                value = validate_value(spec, raw, guild)
            except ValueError as err:
                errors[key] = str(err)
                continue
            if guild.get("values", {}).get(key) != value:
                clean[key] = value
        if errors:
            raise HttpError(400, "invalid_value", "Some settings were rejected.", {"errors": errors})
        if not clean:
            return json_response({"queued": False, "unchanged": True})

        queue = await self.store.get("q:all") or {}
        t = now()
        for g, entries in list(queue.items()):
            queue[g] = [e for e in entries if t - e["ts"] < PENDING_MAX_AGE]
            if not queue[g]:
                del queue[g]
        entries = queue.setdefault(gid, [])
        if len(entries) >= 10:
            raise HttpError(429, "queue_full", "Several changes are already waiting for REX. Try again shortly.")
        entry_id = secrets.token_hex(6)
        entries.append({"id": entry_id, "ts": t, "by": user["id"], "byname": user["name"], "changes": clean})
        await self.store.put("q:all", queue)
        return json_response({"queued": True, "id": entry_id, "keys": list(clean.keys())}, status=202)

    async def api_admin_health(self, session):
        if not self.is_owner(session):
            raise HttpError(403, "owner_only", "Only the bot owner can view this.")
        stats = await self.store.get("stats:latest")
        index = await self.store.get("bot:guilds") or {}
        queue = await self.store.get("q:all") or {}
        online = bool(stats) and now() - stats.get("ts", 0) < ONLINE_WINDOW
        return json_response({
            "online": online,
            "server_time": now(),
            "stats": stats,
            "synced_guilds": len(index),
            "tier_counts": {n: sum(1 for v in index.values() if v.get("t") == n) for n in TIER_NAMES},
            "pending_changes": sum(len(v) for v in queue.values()),
            "schema_synced": bool(await self.get_schema()),
            "config": {
                "discord_login": not self.missing_config("DISCORD_CLIENT_ID", "DISCORD_CLIENT_SECRET"),
                "bot_api_key": bool(self.cfg("BOT_API_KEY")),
                "owner_id": bool(self.owner_ids()),
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
        tail = parts[3:]

        if tail == ["heartbeat"] and method == "POST":
            stats = sanitize_stats(await self.read_json(request, 64 * 1024))
            await self.store.put("stats:latest", stats)
            return json_response({"ok": True})
        if tail == ["schema"] and method == "POST":
            try:
                schema = sanitize_schema(await self.read_json(request, 256 * 1024))
            except ValueError as err:
                raise HttpError(400, "bad_schema", str(err))
            if await self.store.get("schema") != schema:
                await self.store.put("schema", schema)
            _CACHE.pop("schema", None)
            return json_response({"ok": True, "settings": sum(len(s["settings"]) for s in schema["sections"])})
        if tail == ["commands"] and method == "POST":
            catalog = sanitize_catalog(await self.read_json(request, 2 * 1024 * 1024))
            existing = await self.store.get("commands") or {}
            if existing.get("commands") != catalog["commands"] or existing.get("groups") != catalog["groups"]:
                await self.store.put("commands", catalog)
            return json_response({"ok": True, "commands": len(catalog["commands"])})
        if tail == ["sync"] and method == "POST":
            return await self.bot_sync(await self.read_json(request, 2 * 1024 * 1024))
        if tail == ["poll"] and method == "GET":
            return await self.bot_poll()
        if tail == ["ack"] and method == "POST":
            return await self.bot_ack(await self.read_json(request, 512 * 1024))
        if tail == ["profiles"] and method == "POST":
            return await self.bot_profiles(await self.read_json(request, 1024 * 1024))
        if len(tail) == 2 and tail[0] == "guilds" and method == "DELETE":
            gid = tail[1]
            if not SNOWFLAKE.match(gid):
                raise HttpError(400, "bad_request", "Bad guild id.")
            index = await self.store.get("bot:guilds") or {}
            if gid in index:
                del index[gid]
                await self.store.put("bot:guilds", index)
            await self.store.delete("guild:" + gid)
            return json_response({"ok": True})
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
            same = existing is not None and {k: v for k, v in existing.items() if k != "member_count"} == \
                {k: v for k, v in g.items() if k != "member_count"}
            if not same:
                await self.store.put("guild:" + g["id"], g)
                written += 1
            entry = {"n": g["name"], "i": g["icon"], "t": highest_tier(g["tiers"]), "m": g["member_count"]}
            old = index.get(g["id"])
            if not old or {k: v for k, v in old.items() if k != "m"} != {k: v for k, v in entry.items() if k != "m"}:
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

    async def bot_poll(self):
        queue = await self.store.get("q:all") or {}
        t = now()
        pending = []
        for gid, entries in queue.items():
            for e in entries:
                if t - e["ts"] < PENDING_MAX_AGE:
                    pending.append({"id": e["id"], "gid": gid, "by": e["by"], "changes": e["changes"]})
        watch = await self.store.get("watch") or {}
        recent = [uid for uid, ts in watch.items() if t - int(ts) < WATCH_MAX_AGE][:200]
        return json_response({"pending": pending[:50], "watch": recent})

    async def bot_ack(self, body):
        if not isinstance(body, dict) or not isinstance(body.get("results"), list):
            raise HttpError(400, "bad_request", "Expected {results: [...]}.")
        queue = await self.store.get("q:all") or {}
        t = now()
        by_guild = {}
        for r in body["results"][:50]:
            if not isinstance(r, dict):
                continue
            gid, rid = str(r.get("gid", "")), str(r.get("id", ""))
            if not SNOWFLAKE.match(gid):
                continue
            entries = queue.get(gid, [])
            match = [e for e in entries if e["id"] == rid]
            queue[gid] = [e for e in entries if e["id"] != rid]
            if not queue[gid]:
                queue.pop(gid, None)
            if r.get("duplicate") or not match:
                continue
            applied = r.get("applied") if isinstance(r.get("applied"), dict) else {}
            errors = r.get("errors") if isinstance(r.get("errors"), dict) else {}
            by_guild.setdefault(gid, []).append({
                "id": rid, "t": t, "by": match[0].get("byname", ""),
                "applied": {clean_str(k, 80): sanitize_value(v) for k, v in list(applied.items())[:60]},
                "errors": {clean_str(k, 80): clean_str(v, 240) for k, v in list(errors.items())[:60]},
                "notes": [clean_str(n, 240) for n in (r.get("notes") or [])[:5] if isinstance(n, str)],
            })
        await self.store.put("q:all", queue)
        for gid, records in by_guild.items():
            history = await self.store.get("res:" + gid) or []
            history = (list(reversed(records)) + history)[:15]
            await self.store.put("res:" + gid, history)
            guild = await self.store.get("guild:" + gid)
            if guild:
                for rec in records:
                    guild.setdefault("values", {}).update(rec["applied"])
                await self.store.put("guild:" + gid, guild)
        return json_response({"ok": True, "recorded": sum(len(v) for v in by_guild.values())})

    async def bot_profiles(self, body):
        if not isinstance(body, dict) or not isinstance(body.get("profiles"), dict):
            raise HttpError(400, "bad_request", "Expected {profiles: {...}}.")
        stored = 0
        for uid, raw in list(body["profiles"].items())[:25]:
            if not SNOWFLAKE.match(str(uid)) or not isinstance(raw, dict):
                continue
            servers = []
            for s in (raw.get("servers") or [])[:40]:
                if not isinstance(s, dict) or not SNOWFLAKE.match(str(s.get("id", ""))):
                    continue
                servers.append({
                    "id": s["id"], "name": clean_str(s.get("name"), 100),
                    "icon_url": icon_url(s["id"], s.get("icon")),
                    "level": clean_int(s.get("level")) or 0, "xp": clean_int(s.get("xp")) or 0,
                    "xp_per_level": clean_int(s.get("xp_per_level")) or 350,
                    "rank": clean_int(s.get("rank")), "ranked": clean_int(s.get("ranked")) or 0,
                    "coins": clean_int(s.get("coins")), "won": clean_int(s.get("won")),
                    "lost": clean_int(s.get("lost")), "games": clean_int(s.get("games")),
                    "roblox": clean_str(s.get("roblox"), 40) or None,
                    "tier": s.get("tier") if s.get("tier") in ("free",) + TIER_NAMES else "free",
                })
            account = raw.get("account_premium")
            if isinstance(account, dict):
                account = {"active": bool(account.get("active")), "expires": clean_epoch(account.get("expires")),
                           "source": clean_str(account.get("source"), 40)}
            else:
                account = None
            profile = {"account_premium": account, "free_trial_claimed": bool(raw.get("free_trial_claimed")),
                       "servers": servers, "owner": bool(raw.get("owner"))}
            existing = await self.store.get("profile:" + str(uid))
            if existing and {k: v for k, v in existing.items() if k != "updated"} == profile:
                continue
            profile["updated"] = now()
            await self.store.put("profile:" + str(uid), profile, ttl=WATCH_MAX_AGE + 86400)
            stored += 1
        return json_response({"ok": True, "stored": stored})
