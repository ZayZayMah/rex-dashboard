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
import asyncio
import base64
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

import features
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
RESULTS_MAX = 40                 # activity-log entries kept per server
TRANSCRIPT_TTL = 30 * 24 * 3600  # Premium / Priority transcripts; Ultra transcripts have no expiry
HOT_WINDOW = 90                  # seconds the bot polls fast after someone opens the site
XP_PER_BAT = 10
XP_DAILY_BATS = 30
THEMES = ("normal", "halloween", "christmas")
# The three Rex owners always count as owners, even if the OWNER_ID variable in Cloudflare is missing or incomplete.
DEFAULT_OWNERS = ("1500533136591949926", "1488216696215965956", "1289304415144247399")
BETA_FEATURES = ("email", "support", "builder", "pages")
BETA_KEYS = {"builder_commands": "builder", "builder_events": "builder"}
BETA_STATES = ("off", "testing", "on")
TIER_WEIGHT = {"priority": 4, "ultra": 3, "premium": 2, "free": 1}
OWNER_OPS = ("tier", "blacklist", "invite", "dm", "gen_code", "owner_tool", "register_code")
IMG_URL = re.compile(r"^https://[^\s<>\"']{4,500}$")

SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Strict-Transport-Security": "max-age=31536000",
}

_RATE = {}
_CACHE = {}
_XPDAY = {}


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
        if value and all(isinstance(x, dict) for x in value[:5]):
            out = []
            for item in value[:5]:
                out.append({"label": str(item.get("label", ""))[:45],
                            "questions": [str(q)[:45] for q in (item.get("questions") or [])[:2]]})
            return out
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
        "owner_id": raw.get("owner_id") if isinstance(raw.get("owner_id"), str) and SNOWFLAKE.match(raw.get("owner_id")) else "",
        "owner_name": clean_str(raw.get("owner_name"), 60),
        "created": clean_epoch(raw.get("created")),
        "blacklisted": bool(raw.get("blacklisted")),
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
    out["uptime_reason"] = clean_str(raw.get("uptime_reason"), 60)
    sc = raw.get("status_cfg")
    if isinstance(sc, dict):
        stat = sc.get("static") if isinstance(sc.get("static"), dict) else {}
        out["status_cfg"] = {
            "lines": [{"type": clean_str(x.get("type"), 12), "text": clean_str(x.get("text"), 128), "cat": clean_str(x.get("cat"), 12)} for x in (sc.get("lines") or [])[:60] if isinstance(x, dict)],
            "rotate": bool(sc.get("rotate", True)), "interval": clean_int(sc.get("interval")) or 60,
            "static": {"type": clean_str(stat.get("type"), 12), "text": clean_str(stat.get("text"), 128)},
            "off_cats": [clean_str(c, 12) for c in (sc.get("off_cats") or [])[:10]],
        }
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
        site = (_CACHE.get("site") or (0, {}))[1] or {}
        return site.get("support_url") or self.cfg("SUPPORT_URL", DEFAULT_SUPPORT)

    def beta_on(self, site, feature, uid=None):
        state = (site.get("beta") or {}).get(feature, "off")
        if state == "on":
            return True
        if state == "testing" and uid:
            return uid in self.owner_ids() or uid in (site.get("testers") or [])
        return False

    async def require_beta(self, feature, session):
        site = await self.get_site()
        if not self.beta_on(site, feature, session["user"]["id"]):
            raise HttpError(404, "not_available", "This feature is not available yet.")

    async def get_site(self):
        cached = _CACHE.get("site")
        if cached and time.time() - cached[0] < 20:
            return cached[1]
        site = await self.store.get("site") or {}
        maint = site.get("maint") if isinstance(site.get("maint"), dict) else {}
        clean = {
            "theme": site.get("theme") if site.get("theme") in THEMES else "normal",
            "maint": {"on": bool(maint.get("on")), "title": clean_str(maint.get("title"), 80) or "We'll be right back",
                      "desc": clean_str(maint.get("desc"), 300) or "We're currently under maintenance. Please try again later."},
            "support_url": clean_str(site.get("support_url"), 200),
            "beta": {k: (site.get("beta") or {}).get(k) if (site.get("beta") or {}).get(k) in BETA_STATES else "off" for k in BETA_FEATURES},
            "testers": [t for t in (site.get("testers") or []) if isinstance(t, str) and SNOWFLAKE.match(t)][:40],
        }
        _CACHE["site"] = (time.time(), clean)
        return clean

    def maintenance_on(self):
        return bool(((_CACHE.get("site") or (0, {}))[1] or {}).get("maint", {}).get("on"))

    def owner_ids(self):
        raw = self.cfg("OWNER_ID", "") or ""
        return {x for x in re.split(r"[\s,;]+", raw) if SNOWFLAKE.match(x)} | set(DEFAULT_OWNERS)

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
        if path.startswith("/api/"):
            await self.get_site()
        if path == "/api/site" and method == "GET":
            return await self.api_site()
        if path == "/api/live" and method == "GET":
            return await self.api_live()
        if path == "/api/transcript" and method == "GET":
            return await self.api_transcript_get(request, url)
        if path == "/api/status" and method == "GET":
            return await self.api_status()
        if path == "/api/commands" and method == "GET":
            return await self.api_commands()
        if path == "/api/schema" and method == "GET":
            return await self.api_public_schema()
        if path == "/api/ownergate" and method == "POST":
            return await self.api_ownergate(request, url)
        if path == "/api/emailprefs" and method in ("GET", "PUT"):
            return await features.emailprefs_route(self, request, url, method, await self.get_session(request))
        if method == "GET" and re.match(r"^/[^/]{3,230}/email$", path) and not path.startswith(("/api/", "/auth/")):
            return await self.serve_asset(url, "/email-prefs")
        if path == "/api/unsub" and method in ("GET", "POST"):
            return await features.unsub_route(self, request, url, method)
        if method == "GET" and re.match(r"^/pages/[a-z0-9-]{2,40}$", path):
            return await self.serve_asset(url, "/page")
        if path.startswith("/api/pages/") and method == "GET":
            return await features.pages_public(self, request, path, await self.get_session(request))
        if path.startswith("/api/img/") and method == "GET":
            return await self.api_img_get(path)
        if path.startswith("/api/bot/"):
            return await self.route_bot(request, path, method)
        if path.startswith("/api/"):
            return await self.route_user(request, url, path, method)
        raise HttpError(404, "not_found", "Not found.")

    async def serve_asset(self, url, asset_path):
        """Serve a static page under a different address (the email preferences page lives at /<id>/email)."""
        res = await self.env.ASSETS.fetch(self.public_origin(url) + asset_path)
        body = await res.text()
        out = {"Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer",
               "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: https://cdn.discordapp.com; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"}
        out.update(SECURITY_HEADERS)
        return Response(body, status=200, headers=out)

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
            "scope": "identify guilds email",
            "state": state,
            "prompt": "consent" if "consent=1" in (url.query or "") else "none",
        }
        location = "https://discord.com/oauth2/authorize?" + urlencode(params, quote_via=quote)
        return redirect(location, make_cookie(STATE_COOKIE, state, 600, path="/auth"))

    async def auth_callback(self, request, url):
        query = {k: v[0] for k, v in parse_qs(url.query).items() if v}
        if query.get("error") in ("consent_required", "interaction_required", "login_required"):
            return redirect("/auth/login?consent=1")
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
        email = clean_str(user.get("email"), 120) if user.get("verified") and uid not in self.owner_ids() else ""   # owner emails are never stored
        prev = await self.get_user(uid) or {}
        rec = dict(prev)
        rec.update({"n": session["user"]["name"], "u": session["user"]["username"], "a": session["user"]["avatar"],
                    "e": email or prev.get("e", ""), "ll": now(), "lc": int(prev.get("lc", 0)) + 1,
                    "fs": prev.get("fs") or now(), "g": [g["id"] for g in managed][:100]})
        await self.put_user(uid, rec)
        await self.touch_watch(uid, force=True)
        if not prev:
            await features.fire(self, "first_login", uid, url, rec=rec)
        return redirect("/dashboard", make_cookie(SESSION_COOKIE, token, SESSION_TTL))

    # ---- users are spread over 16 shards so logins never overwrite each other
    @staticmethod
    def user_shard(uid):
        return "users:" + hashlib.sha1(uid.encode()).hexdigest()[0]

    async def get_user(self, uid):
        rec = (await self.store.get(self.user_shard(uid)) or {}).get(uid)
        if rec is None:
            rec = (await self.store.get("users") or {}).get(uid)   # older single-key storage
        return rec

    async def put_user(self, uid, rec):
        key = self.user_shard(uid)
        shard = await self.store.get(key) or {}
        shard[uid] = rec
        await self.store.put(key, shard)

    async def del_user(self, uid):
        key = self.user_shard(uid)
        shard = await self.store.get(key) or {}
        if uid in shard:
            del shard[uid]
            await self.store.put(key, shard)
        legacy = await self.store.get("users") or {}
        if uid in legacy:
            del legacy[uid]
            await self.store.put("users", legacy)

    async def all_users(self):
        keys = ["users:" + c for c in "0123456789abcdef"]
        parts = await asyncio.gather(*[self.store.get(k) for k in keys], self.store.get("users"))
        merged = dict(parts[-1] or {})
        for part in parts[:-1]:
            merged.update(part or {})
        return merged

    async def note_user(self, session):
        """Make sure everyone who is logged in shows up in the owner users list, even if they logged in before this existed."""
        uid = session["user"]["id"]
        if uid in _CACHE.setdefault("noted", set()):
            return
        _CACHE["noted"].add(uid)
        if await self.get_user(uid) is None:
            u = session["user"]
            await self.put_user(uid, {"n": u["name"], "u": u["username"], "a": u["avatar"], "e": "", "ll": now(), "lc": 1, "fs": now(),
                                      "g": [g["id"] for g in session.get("guilds", [])][:100]})

    async def touch_watch(self, uid, force=False):
        """Remember who is around so the bot keeps their profile fresh, and polls fast while they are here."""
        watch = await self.store.get("watch") or {}
        t = now()
        if force or t - int(watch.get(uid, 0)) > 45:
            watch[uid] = t
            watch = {k: v for k, v in watch.items() if t - int(v) < WATCH_MAX_AGE}
            await self.store.put("watch", watch)

    # ---- image uploads (website -> hosted link the bot can use)
    IMG_MAX = 420 * 1024

    async def api_upload(self, request, url, session):
        self.check_mutation(request, url, session)
        uid = str(session.get("uid") or "")
        if rate_limited("up:" + uid, 30, 3600):
            raise HttpError(429, "slow_down", "Too many uploads. Try again later.")
        body = await self.read_json(request, 700 * 1024)
        raw = str((body or {}).get("data") or "") if isinstance(body, dict) else ""
        m = re.match(r"^data:(image/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$", raw)
        if not m:
            raise HttpError(400, "bad_image", "Upload a PNG, JPG, WebP or GIF image.")
        try:
            blob = base64.b64decode(m.group(2), validate=True)
        except ValueError:
            raise HttpError(400, "bad_image", "That image could not be read.")
        if len(blob) > self.IMG_MAX:
            raise HttpError(413, "too_large", "Image is too big. Keep it under 400 KB.")
        magic = {"image/png": b"\x89PNG", "image/jpeg": b"\xff\xd8\xff", "image/gif": b"GIF8", "image/webp": b"RIFF"}[m.group(1)]
        if not blob.startswith(magic):
            raise HttpError(400, "bad_image", "That file is not really that kind of image.")
        img_id = secrets.token_urlsafe(14).replace("-", "a").replace("_", "b")
        await self.store.put("img:" + img_id, {"ct": m.group(1), "b64": m.group(2), "by": uid, "at": int(time.time())})
        return json_response({"url": self.public_origin(url) + "/api/img/" + img_id})

    async def api_img_get(self, path):
        img_id = path.rsplit("/", 1)[-1]
        if not ASSET_HASH.match(img_id):
            raise HttpError(404, "not_found", "Not found.")
        rec = await self.store.get("img:" + img_id)
        if not rec:
            raise HttpError(404, "not_found", "Not found.")
        blob = base64.b64decode(rec["b64"])
        headers = {"Content-Type": rec["ct"], "Cache-Control": "public, max-age=31536000, immutable",
                   "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox",
                   "Access-Control-Allow-Origin": "*"}
        try:
            return Response(blob, status=200, headers=headers)
        except TypeError:
            return Response(to_js(blob), status=200, headers=headers)

    # ---- owner gate: /<owner id>/owner-tools asks for a personal code the bot DMed the owner about
    async def api_ownergate(self, request, url):
        origin = request.headers.get("Origin")
        if origin and origin != self.public_origin(url):
            raise HttpError(403, "bad_origin", "Cross-site request blocked.")
        body = await self.read_json(request, 1024)
        uid = str((body or {}).get("uid") or "") if isinstance(body, dict) else ""
        code = str((body or {}).get("code") or "") if isinstance(body, dict) else ""
        ip = self.client_ip(request)
        if rate_limited("og-ip:" + ip, 8, 600) or rate_limited("og-uid:" + uid, 6, 600):
            raise HttpError(429, "slow_down", "Too many attempts. Wait ten minutes.")
        bad = HttpError(403, "bad_code", "That code is not right.")
        if uid not in self.owner_ids() or not code or len(code) > 200:
            raise bad
        rec = await self.store.get("ogate:" + uid)
        if not rec:
            raise HttpError(403, "no_code", "No owner code has been created yet. The bot DMs you a button to create one when it starts.")
        if not safe_equal(hashlib.sha256((rec["salt"] + code).encode()).hexdigest(), rec["hash"]):
            raise bad
        known = await self.get_user(uid) or {}
        token = secrets.token_urlsafe(32)
        ttl = 12 * 3600
        session = {
            "user": {"id": uid, "username": known.get("u") or "owner", "name": known.get("n") or "Rex owner", "avatar": known.get("a")},
            "guilds": [], "csrf": secrets.token_urlsafe(24), "exp": now() + ttl, "om": True, "gate": True,
        }
        await self.store.put("sess:" + token_hash(token), session, ttl=ttl)
        await self.audit(session, "gate", "Owner tools unlocked with an owner code")
        return json_response({"ok": True}, headers={"Set-Cookie": make_cookie(SESSION_COOKIE, token, ttl)})

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

    async def save_session(self, request, session):
        token = get_cookie(request, SESSION_COOKIE)
        if token:
            await self.store.put("sess:" + token_hash(token), session, ttl=max(120, int(session.get("exp", now()) - now())))

    def owner_mode(self, session):
        return self.is_owner(session) and bool(session.get("om"))

    def require_owner_mode(self, session):
        if not self.is_owner(session):
            raise HttpError(403, "owner_only", "Owner only.")
        if not session.get("om"):
            raise HttpError(403, "owner_mode_off", "Enter owner mode first.")

    def client_ip(self, request):
        return request.headers.get("CF-Connecting-IP") or "?"

    def check_mutation(self, request, url, session):
        if self.maintenance_on() and not self.is_owner(session):
            raise HttpError(503, "maintenance", "The site is under maintenance. Please try again later.")
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
            for key in ("latency_ms", "uptime_s", "guild_count", "user_count", "command_count", "uptime_reason"):
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
            await self.note_user(session)
            await features.deliver_pending(self, session["user"]["id"], url)
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
        if path == "/api/xp" and method == "POST":
            return await self.api_xp(request, url, session)
        if path == "/api/result" and method == "GET":
            return await self.api_result(session, url)
        if path == "/api/me/delete" and method == "POST":
            return await self.api_delete_me(request, url, session)
        if path == "/api/upload" and method == "POST":
            return await self.api_upload(request, url, session)
        if path == "/api/transcript" and method == "DELETE":
            return await self.api_transcript_delete(request, url, session)
        if path.startswith("/api/owner/"):
            return await self.route_owner(request, url, path, method, session)
        if path == "/api/email/prefs":
            return await features.prefs_route(self, request, url, path, method, session)
        if path == "/api/support" or path.startswith("/api/support/"):
            return await features.route(self, request, url, path, method, session)

        parts = path.split("/")  # ['', 'api', 'guilds', '<id>', 'settings']
        if len(parts) in (4, 5) and parts[2] == "guilds":
            gid = parts[3]
            if len(parts) == 4 and method == "GET":
                lite = "lite=1" in (url.query or "")
                return await self.api_guild(session, gid, lite)
            if len(parts) == 5 and parts[4] == "settings" and method == "PUT":
                return await self.api_guild_save(request, url, session, gid)
            if len(parts) == 5 and parts[4] == "undo" and method == "POST":
                return await self.api_undo(request, url, session, gid)
            if len(parts) == 5 and parts[4] == "panel" and method == "POST":
                return await self.api_panel(request, url, session, gid)
            if len(parts) == 5 and parts[4] == "redeem" and method == "POST":
                return await self.api_redeem(request, url, session, gid)
            if len(parts) == 5 and parts[4] == "transcripts" and method == "GET":
                return await self.api_transcripts_list(session, gid)
        raise HttpError(404, "not_found", "Not found.")

    async def api_me(self, session):
        index = await self.store.get("bot:guilds") or {}
        owner = self.owner_mode(session)
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
            "is_owner": self.is_owner(session),
            "owner_mode": self.owner_mode(session),
            "support_url": self.support_url,
            "beta": {k: self.beta_on(await self.get_site(), k, user["id"]) for k in BETA_FEATURES},
            "guilds": guilds,
        })

    async def bot_online(self):
        stats = await self.store.get("stats:latest")
        return bool(stats) and now() - stats.get("ts", 0) < ONLINE_WINDOW

    async def api_profile(self, session):
        user = session["user"]
        profile = await self.store.get("profile:" + user["id"])
        if not profile or now() - int(profile.get("updated", 0)) > 40:
            await self.touch_watch(user["id"])
        return json_response({
            "user": {"id": user["id"], "name": user["name"], "username": user["username"],
                     "avatar_url": avatar_url(user["id"], user["avatar"])},
            "is_owner": self.is_owner(session),
            "profile": profile,
            "servers_managed": len(session["guilds"]),
            "bot_online": await self.bot_online(),
        })

    def guild_access(self, session, gid):
        """Return {'admin': bool} for this person in this server, or raise 403."""
        if not SNOWFLAKE.match(gid):
            raise HttpError(404, "not_found", "Server not found.")
        for g in session["guilds"]:
            if g["id"] == gid:
                return {"admin": bool(g.get("admin", g.get("owner")))}
        if self.owner_mode(session):
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
        if self.owner_mode(session):
            body["owner_info"] = {"owner_id": guild.get("owner_id"), "owner_name": guild.get("owner_name"),
                                  "created": guild.get("created"), "blacklisted": guild.get("blacklisted")}
        me_owner = next((g.get("owner") for g in session["guilds"] if g["id"] == gid), False)
        body["can_undo"] = bool(me_owner) or self.owner_mode(session)
        await self.touch_watch(session["user"]["id"])
        stats = await self.store.get("stats:latest")
        body.update({
            "guild": {
                "id": gid, "name": guild["name"], "icon_url": icon_url(gid, guild.get("icon")),
                "member_count": guild.get("member_count", 0), "tiers": public_tiers(guild.get("tiers") or {}),
                "channels": guild.get("channels", []), "roles": guild.get("roles", []),
            },
            "schema": await self.visible_schema(session),
            "can_admin": access["admin"],
            "owner_override": self.owner_mode(session),
            "bot_online": bool(stats) and t - stats.get("ts", 0) < ONLINE_WINDOW,
            "support_url": self.support_url,
        })
        return json_response(body)

    async def visible_schema(self, session):
        schema = await self.get_schema()
        if not schema:
            return schema
        site = await self.get_site()
        uid = session["user"]["id"]
        secs = [x for x in schema.get("sections", []) if not x.get("beta") or self.beta_on(site, x["beta"], uid)]
        return dict(schema, sections=secs)

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
        owner = self.owner_mode(session)
        errors, clean = {}, {}
        for key, raw in changes.items():
            spec = index.get(key)
            if spec is None:
                errors[str(key)[:60]] = "Unknown setting."
                continue
            if key in BETA_KEYS and not self.beta_on(await self.get_site(), BETA_KEYS[key], user["id"]):
                errors[key] = "This feature is not available yet."
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
        silent = bool(body.get("silent")) and self.owner_mode(session)
        entries.append({"id": entry_id, "ts": t, "by": user["id"], "byname": user["name"], "changes": clean, "silent": silent, "om": self.owner_mode(session)})
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


    # ---- public: site config, live stats
    async def api_site(self):
        site = await self.get_site()
        return json_response({
            "theme": site["theme"], "maintenance": site["maint"], "support_url": self.support_url,
            "beta": {k: self.beta_on(site, k) for k in BETA_FEATURES},
            "invite_url": self.invite_url(), "login_ready": not self.missing_config("DISCORD_CLIENT_ID", "DISCORD_CLIENT_SECRET"),
        }, headers={"Cache-Control": "public, max-age=15"})

    async def api_live(self):
        stats = await self.store.get("stats:latest") or {}
        index = await self.store.get("bot:guilds") or {}
        t = now()
        body = {
            "online": bool(stats) and t - stats.get("ts", 0) < ONLINE_WINDOW,
            "stats": {k: v for k, v in stats.items() if k != "hist"},
            "hist": stats.get("hist", []),
            "server_time": t,
            "tier_counts": {n: sum(1 for v in index.values() if v.get("t") == n) for n in TIER_NAMES},
            "synced_guilds": len(index),
        }
        return json_response(body, headers={"Cache-Control": "public, max-age=15"})

    # ---- bat xp (website xp)
    async def api_xp(self, request, url, session):
        self.check_mutation(request, url, session)
        user = session["user"]
        body = await self.read_json(request, 1024)
        count = clean_int(body.get("count") if isinstance(body, dict) else None, 1, 5)
        if count is None:
            raise HttpError(400, "bad_request", "count must be 1-5.")
        if rate_limited("xp:" + user["id"], 6, 60):
            raise HttpError(429, "slow_down", "Slow down.")
        day = time.strftime("%Y%m%d", time.gmtime())
        key = (user["id"], day)
        used = _XPDAY.get(key, 0)
        if used >= XP_DAILY_BATS:
            return json_response({"ok": True, "xp": 0, "capped": True})
        count = min(count, XP_DAILY_BATS - used)
        _XPDAY[key] = used + count
        if len(_XPDAY) > 3000:
            _XPDAY.clear()
        queue = await self.store.get("xpq") or {}
        queue[user["id"]] = int(queue.get(user["id"], 0)) + count * XP_PER_BAT
        await self.store.put("xpq", queue)
        return json_response({"ok": True, "xp": count * XP_PER_BAT})

    # ---- results of queued operations (redeem, owner ops)
    async def api_result(self, session, url):
        rid = (parse_qs(url.query).get("id") or [""])[0]
        if not re.match(r"^[0-9a-f]{12}$", rid):
            raise HttpError(400, "bad_request", "Bad id.")
        rec = await self.store.get("ores:" + rid)
        if not rec:
            return json_response({"done": False})
        if rec.get("by") != session["user"]["id"]:
            raise HttpError(403, "forbidden", "Not yours.")
        return json_response({"done": True, "ok": not rec.get("errors"), "errors": rec.get("errors", {}),
                              "notes": rec.get("notes", []), "out": rec.get("out", {})})

    async def enqueue(self, gid, entry):
        queue = await self.store.get("q:all") or {}
        t = now()
        for g, entries in list(queue.items()):
            queue[g] = [e for e in entries if t - e["ts"] < PENDING_MAX_AGE]
            if not queue[g]:
                del queue[g]
        entries = queue.setdefault(gid, [])
        if len(entries) >= 10:
            raise HttpError(429, "queue_full", "Several requests are already waiting for REX. Try again shortly.")
        entries.append(entry)
        await self.store.put("q:all", queue)

    async def api_panel(self, request, url, session, gid):
        self.check_mutation(request, url, session)
        user = session["user"]
        self.guild_access(session, gid)
        if rate_limited("pn:" + user["id"], 10, 300):
            raise HttpError(429, "slow_down", "Too many panels. Wait a few minutes.")
        if not await self.store.get("guild:" + gid):
            raise HttpError(404, "bot_not_in_server", "REX is not in that server yet.")
        body = await self.read_json(request, 1024)
        kind = body.get("kind") if isinstance(body, dict) else None
        channel = body.get("channel") if isinstance(body, dict) else None
        if kind in ("lockdown", "unlock"):
            channel = "0"
        if kind not in ("ticket", "verify", "lockdown", "unlock") or not isinstance(channel, str) or not (channel == "0" or SNOWFLAKE.match(channel)):
            raise HttpError(400, "bad_request", "Choose a panel and a channel.")
        rid = secrets.token_hex(6)
        await self.enqueue(gid, {"id": rid, "ts": now(), "by": user["id"], "byname": user["name"], "op": "publish_panel",
                                 "args": {"kind": kind, "channel": channel, "reason": clean_str(body.get("reason"), 200)}})
        return json_response({"queued": True, "id": rid}, status=202)

    async def api_redeem(self, request, url, session, gid):
        self.check_mutation(request, url, session)
        user = session["user"]
        access = self.guild_access(session, gid)
        if not access["admin"]:
            raise HttpError(403, "forbidden", "You need Administrator in that server to redeem a code.")
        if rate_limited("rd:" + user["id"], 6, 300):
            raise HttpError(429, "slow_down", "Too many attempts. Wait a few minutes.")
        if not await self.store.get("guild:" + gid):
            raise HttpError(404, "bot_not_in_server", "REX is not in that server yet.")
        body = await self.read_json(request, 1024)
        code = clean_str(body.get("code") if isinstance(body, dict) else "", 80).upper()
        if not re.match(r"^REX-(PREMIUM|PRIORITY|ULTRA)-[A-Z0-9-]{4,60}$", code):
            raise HttpError(400, "bad_code", "That doesn't look like a REX code.")
        rid = secrets.token_hex(6)
        await self.enqueue(gid, {"id": rid, "ts": now(), "by": user["id"], "byname": user["name"], "op": "redeem",
                                 "args": {"code": code}})
        return json_response({"queued": True, "id": rid}, status=202)

    async def api_delete_me(self, request, url, session):
        self.check_mutation(request, url, session)
        uid = session["user"]["id"]
        old_rec = await self.get_user(uid)
        await self.del_user(uid)
        if old_rec:
            await features.fire(self, "data_removed", uid, url, rec=old_rec)
        watch = await self.store.get("watch") or {}
        if uid in watch:
            del watch[uid]
            await self.store.put("watch", watch)
        await self.store.delete("profile:" + uid)
        token = get_cookie(request, SESSION_COOKIE)
        if token:
            await self.store.delete("sess:" + token_hash(token))
        return json_response({"ok": True}, headers={"Set-Cookie": make_cookie(SESSION_COOKIE, "", 0)})

    # ---- undo (server owner or bot owner)
    async def api_undo(self, request, url, session, gid):
        self.check_mutation(request, url, session)
        user = session["user"]
        me_owner = next((g.get("owner") for g in session["guilds"] if g["id"] == gid), False)
        if not me_owner and not self.owner_mode(session):
            raise HttpError(403, "forbidden", "Only the server owner can undo changes.")
        if rate_limited("undo:" + user["id"], 10, 60):
            raise HttpError(429, "slow_down", "Slow down.")
        guild = await self.store.get("guild:" + gid)
        if not guild:
            raise HttpError(404, "bot_not_in_server", "REX is not in that server yet.")
        body = await self.read_json(request, 2048)
        history = await self.store.get("res:" + gid) or []
        if isinstance(body, dict) and body.get("id"):
            targets = [e for e in history if e.get("id") == body["id"]]
        elif isinstance(body, dict) and body.get("user"):
            targets = [e for e in history if e.get("byid") == str(body["user"])]
        else:
            raise HttpError(400, "bad_request", "Say which change to undo.")
        earliest, latest, ids = {}, {}, []
        for e in reversed(targets):  # oldest first, so the earliest "before" wins
            if e.get("undone") or e.get("undo_of") or not e.get("before"):
                continue
            used = False
            for k, v in (e.get("applied") or {}).items():
                if k.startswith("_") or k not in e["before"]:
                    continue
                used = True
                earliest.setdefault(k, e["before"][k])
                latest[k] = v
            if used:
                ids.append(e["id"])
        current = guild.get("values", {})
        changes, skipped = {}, []
        for k, before in earliest.items():
            if current.get(k) == latest[k]:
                changes[k] = before
            else:
                skipped.append(k)
        if not changes:
            raise HttpError(409, "nothing_to_undo", "Nothing can be undone - those settings were changed again since.", {"skipped": skipped})
        rid = secrets.token_hex(6)
        await self.enqueue(gid, {"id": rid, "ts": now(), "by": user["id"], "byname": user["name"], "changes": changes,
                                 "undo": True, "undo_ids": ids})
        return json_response({"queued": True, "id": rid, "keys": list(changes), "skipped": skipped}, status=202)

    # ---- transcripts
    async def api_transcript_get(self, request, url):
        if rate_limited("trv:" + self.client_ip(request), 90, 60):
            raise HttpError(429, "slow_down", "Too many requests.")
        tid = (parse_qs(url.query).get("id") or [""])[0]
        if not re.match(r"^[A-Za-z0-9_-]{10,40}$", tid):
            raise HttpError(404, "not_found", "Transcript not found.")
        tr = await self.store.get("tr:" + tid)
        if not tr:
            raise HttpError(404, "not_found", "This transcript has been deleted or has expired.")
        return json_response(tr, headers={"X-Robots-Tag": "noindex, nofollow", "Cache-Control": "private, max-age=30"})

    async def api_transcripts_list(self, session, gid):
        self.guild_access(session, gid)
        items = await self.store.get("trx:" + gid) or []
        t = now()
        items = [i for i in items if not i.get("exp") or i["exp"] > t]
        return json_response({"items": items})

    async def api_transcript_delete(self, request, url, session):
        self.check_mutation(request, url, session)
        tid = (parse_qs(url.query).get("id") or [""])[0]
        if not re.match(r"^[A-Za-z0-9_-]{10,40}$", tid):
            raise HttpError(404, "not_found", "Transcript not found.")
        tr = await self.store.get("tr:" + tid)
        gid = (tr or {}).get("gid")
        if not tr or not gid:
            raise HttpError(404, "not_found", "Transcript not found.")
        access = self.guild_access(session, gid)
        if not access["admin"]:
            raise HttpError(403, "forbidden", "Only a server admin, the server owner or a REX owner can delete transcripts.")
        await self.store.delete("tr:" + tid)
        items = await self.store.get("trx:" + gid) or []
        await self.store.put("trx:" + gid, [i for i in items if i.get("id") != tid])
        return json_response({"ok": True})

    # ---- owner mode
    async def route_owner(self, request, url, path, method, session):
        if path == "/api/owner/mode" and method == "POST":
            self.check_mutation(request, url, session)
            if not self.is_owner(session):
                raise HttpError(403, "owner_only", "Owner only.")
            body = await self.read_json(request, 256)
            session["om"] = bool(isinstance(body, dict) and body.get("on"))
            await self.save_session(request, session)
            return json_response({"owner_mode": session["om"]})
        self.require_owner_mode(session)
        if path == "/api/owner/servers" and method == "GET":
            index = await self.store.get("bot:guilds") or {}
            rows = [{"id": gid, "name": v.get("n"), "icon_url": icon_url(gid, v.get("i")), "tier": v.get("t", "free"),
                     "members": v.get("m", 0), "owner": v.get("o", ""), "owner_id": v.get("oi", ""),
                     "blacklisted": bool(v.get("b"))} for gid, v in index.items()]
            rows.sort(key=lambda r: (r["name"] or "").lower())
            return json_response({"servers": rows})
        if path == "/api/owner/users" and method == "GET":
            users = await self.all_users()
            rows = [{"id": uid, "name": u.get("n"), "username": u.get("u"), "avatar_url": avatar_url(uid, u.get("a")),
                     "email": "" if uid in self.owner_ids() else u.get("e", ""), "owner": uid in self.owner_ids(),
                     "last_login": u.get("ll"), "logins": u.get("lc", 0), "first_seen": u.get("fs"),
                     "servers": len(u.get("g") or [])} for uid, u in users.items()]
            rows.sort(key=lambda r: -(r["last_login"] or 0))
            return json_response({"users": rows})
        if path == "/api/owner/user" and method == "GET":
            uid = (parse_qs(url.query).get("id") or [""])[0]
            if not SNOWFLAKE.match(uid):
                raise HttpError(400, "bad_request", "Bad user id.")
            u = await self.get_user(uid)
            if not u:
                raise HttpError(404, "not_found", "No such user.")
            index = await self.store.get("bot:guilds") or {}
            managed = [{"id": g, "name": (index.get(g) or {}).get("n", g), "icon_url": icon_url(g, (index.get(g) or {}).get("i")),
                        "bot_present": g in index} for g in (u.get("g") or [])]
            return json_response({
                "user": {"id": uid, "name": u.get("n"), "username": u.get("u"), "avatar_url": avatar_url(uid, u.get("a")),
                         "email": "" if uid in self.owner_ids() else u.get("e", ""), "owner": uid in self.owner_ids(),
                         "last_login": u.get("ll"), "logins": u.get("lc", 0), "first_seen": u.get("fs")},
                "profile": await self.store.get("profile:" + uid), "managed": managed})
        if path == "/api/owner/site" and method == "GET":
            return json_response(await self.get_site())
        if path == "/api/owner/audit" and method == "GET":
            return json_response({"items": await self.store.get("audit") or []})
        if path == "/api/owner/site" and method == "PUT":
            self.check_mutation(request, url, session)
            body = await self.read_json(request, 4096)
            if not isinstance(body, dict):
                raise HttpError(400, "bad_request", "Bad body.")
            site = await self.store.get("site") or {}
            if "theme" in body:
                if body["theme"] not in THEMES:
                    raise HttpError(400, "bad_request", "Unknown theme.")
                site["theme"] = body["theme"]
            if isinstance(body.get("maint"), dict):
                m = body["maint"]
                site["maint"] = {"on": bool(m.get("on")), "title": clean_str(m.get("title"), 80),
                                 "desc": clean_str(m.get("desc"), 300)}
            if isinstance(body.get("beta"), dict):
                cur = site.get("beta") if isinstance(site.get("beta"), dict) else {}
                for k, v in body["beta"].items():
                    if k in BETA_FEATURES and v in BETA_STATES:
                        cur[k] = v
                site["beta"] = cur
            if isinstance(body.get("testers"), list):
                site["testers"] = [str(t) for t in body["testers"] if SNOWFLAKE.match(str(t))][:40]
            if "support_url" in body:
                link = clean_str(body.get("support_url"), 200)
                if link and not link.startswith("https://"):
                    raise HttpError(400, "bad_request", "The support link must start with https://")
                site["support_url"] = link
            await self.store.put("site", site)
            _CACHE.pop("site", None)
            await self.audit(session, "site", "Website settings changed")
            return json_response(await self.get_site())
        if path == "/api/owner/email" or path.startswith("/api/owner/email/"):
            return await features.owner_email_route(self, request, url, path, method, session)
        if path == "/api/owner/pages" or path.startswith("/api/owner/pages/"):
            return await features.pages_owner_route(self, request, url, path, method, session)
        if path == "/api/owner/support" or path.startswith("/api/owner/support/"):
            return await features.owner_route(self, request, url, path, method, session)
        if path == "/api/owner/status" and method == "GET":
            stats = await self.store.get("stats:latest") or {}
            return json_response({"status": stats.get("status_cfg"), "reason": stats.get("uptime_reason", "")})
        if path == "/api/owner/tools" and method == "GET":
            return json_response(await self.store.get("ownertools") or {"categories": [], "tools": []})
        if path == "/api/owner/op" and method == "POST":
            return await self.owner_op(request, url, session)
        raise HttpError(404, "not_found", "Not found.")

    async def audit(self, session, op, summary):
        items = await self.store.get("audit") or []
        items.insert(0, {"t": now(), "by": session["user"]["name"], "byid": session["user"]["id"], "op": op,
                         "summary": clean_str(summary, 240)})
        await self.store.put("audit", items[:100])

    async def owner_op(self, request, url, session):
        self.check_mutation(request, url, session)
        user = session["user"]
        if rate_limited("oop:" + user["id"], 30, 60):
            raise HttpError(429, "slow_down", "Slow down.")
        body = await self.read_json(request, 8192)
        op = body.get("op") if isinstance(body, dict) else None
        if op not in OWNER_OPS:
            raise HttpError(400, "bad_request", "Unknown operation.")
        a = body.get("args") if isinstance(body.get("args"), dict) else {}
        gid = str(body.get("gid") or "")
        args, summary = {}, op
        if op in ("tier", "blacklist", "invite"):
            if not SNOWFLAKE.match(gid):
                raise HttpError(400, "bad_request", "Pick a server.")
        if op == "tier":
            tier = a.get("tier")
            if tier not in TIER_NAMES:
                raise HttpError(400, "bad_request", "Unknown tier.")
            days = clean_int(a.get("days"), 0, 3650) or 0
            args = {"tier": tier, "days": days, "remove": bool(a.get("remove"))}
            summary = f"{'Removed' if args['remove'] else 'Granted'} {tier} {('for ' + str(days) + ' days') if days and not args['remove'] else ''} on {gid}"
        elif op == "blacklist":
            args = {"gid": gid, "reason": clean_str(a.get("reason"), 200), "remove": bool(a.get("remove"))}
            summary = f"{'Unblacklisted' if args['remove'] else 'Blacklisted'} {gid}"
        elif op == "invite":
            summary = f"Created an invite for {gid}"
        elif op == "dm":
            uid = str(a.get("uid") or "")
            text = clean_str(a.get("text"), 1800)
            if not SNOWFLAKE.match(uid) or not text:
                raise HttpError(400, "bad_request", "Needs a user and a message.")
            args = {"uid": uid, "text": text}
            summary = f"Sent a DM to {uid}"
            gid = ""
        elif op == "gen_code":
            # instant: the website invents the code, shows it straight away, and the bot just registers it
            tier = a.get("tier")
            if tier not in TIER_NAMES:
                raise HttpError(400, "bad_request", "Unknown tier.")
            duration = clean_str(a.get("duration"), 20)
            limit = clean_int(a.get("limit"), 1, 1000) or 1
            alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
            code = "REX-" + tier.upper() + "-" + "".join(secrets.choice(alphabet) for _ in range(16))
            rid = secrets.token_hex(6)
            await self.enqueue("_", {"id": rid, "ts": now(), "by": user["id"], "byname": user["name"], "op": "register_code",
                                     "args": {"code": code, "tier": tier, "duration": duration, "limit": limit}, "gid": "_"})
            await self.audit(session, "gen_code", f"Generated a {tier} code ({duration})")
            return json_response({"queued": True, "id": rid, "code": code, "tier": tier, "duration": duration, "limit": limit}, status=202)
        elif op == "owner_tool":
            reg = await self.store.get("ownertools") or {}
            tool = clean_str(a.get("tool"), 40)
            if tool not in {t.get("id") for t in reg.get("tools", [])}:
                raise HttpError(400, "bad_request", "Unknown tool. Wait a moment for the bot to sync, then reload.")
            f = a.get("f") if isinstance(a.get("f"), dict) else {}
            args = {"tool": tool, "f": {clean_str(k, 20): clean_str(v, 500) for k, v in list(f.items())[:8]}}
            summary = f"Owner tool: {tool}"
            gid = ""
        rid = secrets.token_hex(6)
        await self.enqueue(gid or "_", {"id": rid, "ts": now(), "by": user["id"], "byname": user["name"], "op": op, "args": args,
                                        "gid": gid or "_"})
        await self.audit(session, op, summary)
        return json_response({"queued": True, "id": rid}, status=202)

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
            await features.flush_due(self, urlparse(request.url))
            stats = sanitize_stats(await self.read_json(request, 64 * 1024))
            previous = await self.store.get("stats:latest") or {}
            hist = list(previous.get("hist") or [])
            hist.append([stats["ts"], stats.get("latency_ms"), stats.get("guild_count"), stats.get("user_count"),
                         stats.get("errors_last_hour")])
            stats["hist"] = hist[-96:]
            await self.store.put("stats:latest", stats)
            return json_response({"ok": True})
        if tail[:1] == ["support"] and method == "POST":
            return await features.bot_route(self, tail[1:], method, await self.read_json(request, 64 * 1024))
        if tail == ["ownertools"] and method == "POST":
            raw = await self.read_json(request, 64 * 1024)
            tools = []
            for t in (raw.get("tools") or [])[:80]:
                fields = []
                for f in (t.get("fields") or [])[:5]:
                    fields.append({"key": clean_str(f.get("key"), 20), "label": clean_str(f.get("label"), 60), "type": clean_str(f.get("type"), 10),
                                   "placeholder": clean_str(f.get("placeholder"), 100), "required": bool(f.get("required")),
                                   "options": [clean_str(o, 30) for o in (f.get("options") or [])[:12]]})
                tools.append({"id": clean_str(t.get("id"), 40), "cat": clean_str(t.get("cat"), 20), "label": clean_str(t.get("label"), 60),
                              "desc": clean_str(t.get("desc"), 200), "danger": bool(t.get("danger")), "fields": fields})
            cats = [{k: clean_str(c.get(k), 80) for k in ("id", "icon", "label", "desc")} for c in (raw.get("categories") or [])[:12]]
            await self.store.put("ownertools", {"categories": cats, "tools": tools})
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
            return await self.bot_sync(await self.read_json(request, 2 * 1024 * 1024), urlparse(request.url))
        if tail == ["poll"] and method == "GET":
            return await self.bot_poll()
        if tail == ["ack"] and method == "POST":
            return await self.bot_ack(await self.read_json(request, 512 * 1024), urlparse(request.url))
        if tail == ["transcript"] and method == "POST":
            return await self.bot_transcript(request, await self.read_json(request, 3 * 1024 * 1024))
        if tail == ["ownercode"] and method == "POST":
            body = await self.read_json(request, 1024)
            uid = str((body or {}).get("uid") or "")
            salt, digest = str((body or {}).get("salt") or ""), str((body or {}).get("hash") or "")
            if uid not in self.owner_ids() or not re.match(r"^[0-9a-f]{16,64}$", salt) or not re.match(r"^[0-9a-f]{64}$", digest):
                raise HttpError(400, "bad_request", "Bad owner code.")
            await self.store.put("ogate:" + uid, {"salt": salt, "hash": digest, "t": now()})
            return json_response({"ok": True})
        if tail == ["ownercodes"] and method == "GET":
            have = [u for u in self.owner_ids() if await self.store.get("ogate:" + u)]
            return json_response({"have": have, "owners": sorted(self.owner_ids())})
        if tail == ["profiles"] and method == "POST":
            return await self.bot_profiles(await self.read_json(request, 1024 * 1024))
        if len(tail) == 2 and tail[0] == "guilds" and method == "DELETE":
            gid = tail[1]
            if not SNOWFLAKE.match(gid):
                raise HttpError(400, "bad_request", "Bad guild id.")
            index = await self.store.get("bot:guilds") or {}
            if gid in index:
                left = index[gid]
                del index[gid]
                await self.store.put("bot:guilds", index)
                if left.get("oi"):
                    await features.fire(self, "bot_leaves_server", str(left["oi"]), urlparse(request.url), {"server": left.get("n", "")})
            await self.store.delete("guild:" + gid)
            return json_response({"ok": True})
        if tail == ["event"] and method == "POST":
            body = await self.read_json(request, 2048)
            ev, uid = (body.get("event") if isinstance(body, dict) else ""), str((body or {}).get("uid") or "")
            if ev == "joins_support" and SNOWFLAKE.match(uid):
                await features.fire(self, "joins_support", uid, urlparse(request.url))
            return json_response({"ok": True})
        raise HttpError(404, "not_found", "Not found.")

    async def bot_sync(self, body, url=None):
        if not isinstance(body, dict) or not isinstance(body.get("guilds"), list):
            raise HttpError(400, "bad_request", "Expected {guilds: [...]}.")
        batch = [g for g in (sanitize_guild(x) for x in body["guilds"][:25]) if g]
        index = await self.store.get("bot:guilds") or {}
        had_index = len(index) > 3
        joined = []
        index_changed = False
        written = 0
        for g in batch:
            existing = await self.store.get("guild:" + g["id"])
            same = existing is not None and {k: v for k, v in existing.items() if k != "member_count"} == \
                {k: v for k, v in g.items() if k != "member_count"}
            if not same:
                await self.store.put("guild:" + g["id"], g)
                written += 1
            entry = {"n": g["name"], "i": g["icon"], "t": highest_tier(g["tiers"]), "m": g["member_count"],
                     "o": g["owner_name"], "oi": g["owner_id"], "b": g["blacklisted"], "cr": g["created"]}
            old = index.get(g["id"])
            if not old and had_index:
                joined.append((g["owner_id"], g["name"]))
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
        if joined and len(joined) <= 3 and url is not None:
            for oid, gname in joined:
                if oid:
                    await features.fire(self, "bot_joins_server", str(oid), url, {"server": gname})
        return json_response({"ok": True, "received": len(batch), "written": written, "pruned": pruned})

    async def bot_poll(self):
        queue = await self.store.get("q:all") or {}
        t = now()
        pending = []
        for gid, entries in queue.items():
            for e in entries:
                if t - e["ts"] < PENDING_MAX_AGE:
                    item = {"id": e["id"], "gid": gid, "by": e["by"]}
                    if e.get("op"):
                        item["op"], item["args"] = e["op"], e.get("args") or {}
                    else:
                        item["changes"] = e.get("changes") or {}
                        if e.get("undo"):
                            item["undo"] = True
                    pending.append(item)
        index = await self.store.get("bot:guilds") or {}
        pending.sort(key=lambda p: (-TIER_WEIGHT.get((index.get(p["gid"]) or {}).get("t", "free"), 1) if p["gid"] != "_" else -9, ))
        watch = await self.store.get("watch") or {}
        recent = [uid for uid, ts in watch.items() if t - int(ts) < WATCH_MAX_AGE][:200]
        hot = bool(pending) or any(t - int(ts) < HOT_WINDOW for ts in watch.values())
        xpq = await self.store.get("xpq") or {}
        return json_response({"pending": pending[:50], "watch": recent, "hot": hot, "xp": xpq})

    async def bot_ack(self, body, url=None):
        if not isinstance(body, dict):
            raise HttpError(400, "bad_request", "Expected an object.")
        results = body.get("results") if isinstance(body.get("results"), list) else []
        mail_events = []
        done_xp = body.get("xp_done") if isinstance(body.get("xp_done"), dict) else {}
        if done_xp:
            xpq = await self.store.get("xpq") or {}
            for uid, amount in list(done_xp.items())[:200]:
                amount = clean_int(amount, 0, 10**6) or 0
                left = int(xpq.get(str(uid), 0)) - amount
                if left > 0:
                    xpq[str(uid)] = left
                else:
                    xpq.pop(str(uid), None)
            await self.store.put("xpq", xpq)
        if not results:
            return json_response({"ok": True, "recorded": 0})
        queue = await self.store.get("q:all") or {}
        t = now()
        by_guild = {}
        for r in results[:50]:
            if not isinstance(r, dict):
                continue
            gid, rid = str(r.get("gid", "")), str(r.get("id", ""))
            if not (SNOWFLAKE.match(gid) or gid == "_"):
                continue
            entries = queue.get(gid, [])
            match = [e for e in entries if e["id"] == rid]
            queue[gid] = [e for e in entries if e["id"] != rid]
            if not queue[gid]:
                queue.pop(gid, None)
            if r.get("duplicate") or not match:
                continue
            entry = match[0]
            applied = r.get("applied") if isinstance(r.get("applied"), dict) else {}
            before = r.get("before") if isinstance(r.get("before"), dict) else {}
            errors = r.get("errors") if isinstance(r.get("errors"), dict) else {}
            notes = [clean_str(n, 240) for n in (r.get("notes") or [])[:5] if isinstance(n, str)]
            out = r.get("out") if isinstance(r.get("out"), dict) else {}
            clean_out = {clean_str(k, 40): (sanitize_value(v) if not isinstance(v, str) else clean_str(v, 1800)) for k, v in list(out.items())[:8]}
            if entry.get("op"):
                # operations: the person who asked reads the result; only redeem shows in the server's log
                await self.store.put("ores:" + rid, {"by": entry["by"], "errors": {clean_str(k, 60): clean_str(v, 240) for k, v in errors.items()},
                                                     "notes": notes, "out": clean_out}, ttl=900)
                if entry["op"] in ("redeem", "blacklist") and not errors:
                    mail_events.append((entry["op"], entry, gid))
                if entry["op"] == "redeem" and applied.get("_redeem") and SNOWFLAKE.match(gid):
                    by_guild.setdefault(gid, []).append({
                        "id": rid, "t": t, "by": entry.get("byname", ""), "byid": entry["by"],
                        "applied": {"_redeem": clean_str(str(applied.get("_redeem")), 20)}, "before": {}, "errors": {}, "notes": []})
                continue
            record = {
                "id": rid, "t": t, "by": entry.get("byname", ""), "byid": entry["by"],
                "applied": {clean_str(k, 80): sanitize_value(v) for k, v in list(applied.items())[:60]},
                "before": {clean_str(k, 80): sanitize_value(v) for k, v in list(before.items())[:60]},
                "errors": {clean_str(k, 80): clean_str(v, 240) for k, v in list(errors.items())[:60]},
                "notes": notes,
            }
            if entry.get("undo"):
                record["undo_of"] = [x for x in (entry.get("undo_ids") or []) if isinstance(x, str)][:40]
            by_guild.setdefault(gid, []).append(record)
            if entry.get("silent"):
                record["_silent"] = True
        await self.store.put("q:all", queue)
        for gid, records in by_guild.items():
            history = await self.store.get("res:" + gid) or []
            undone = {x for rec in records if rec["applied"] for x in rec.get("undo_of", [])}
            if undone:
                for h in history:
                    if h.get("id") in undone:
                        h["undone"] = True
            visible = [{k: v for k, v in rec.items() if k != "_silent"} for rec in records if not rec.get("_silent")]
            if visible or undone:
                history = (list(reversed(visible)) + history)[:RESULTS_MAX]
                await self.store.put("res:" + gid, history)
            guild = await self.store.get("guild:" + gid)
            if guild:
                for rec in records:
                    guild.setdefault("values", {}).update({k: v for k, v in rec["applied"].items() if not k.startswith("_")})
                await self.store.put("guild:" + gid, guild)
        if mail_events and url is not None:
            gindex = await self.store.get("bot:guilds") or {}
            for op, entry, gid in mail_events:
                gi = gindex.get(gid) or {}
                if op == "redeem":
                    await features.fire(self, "code_redeemed", str(entry["by"]), url, {"server": gi.get("n", "")})
                elif gi.get("oi"):
                    ev = "server_unblacklisted" if (entry.get("args") or {}).get("remove") else "server_blacklisted"
                    await features.fire(self, ev, str(gi["oi"]), url, {"server": gi.get("n", "")})
        return json_response({"ok": True, "recorded": sum(len(v) for v in by_guild.values())})

    async def bot_transcript(self, request, body):
        if not isinstance(body, dict):
            raise HttpError(400, "bad_request", "Expected an object.")
        gid = str(body.get("gid", ""))
        if not SNOWFLAKE.match(gid):
            raise HttpError(400, "bad_request", "Bad guild id.")
        tier = body.get("tier") if body.get("tier") in TIER_NAMES else "premium"

        def snow(v):
            return v if isinstance(v, str) and SNOWFLAKE.match(v) else ""

        def img(v):
            return v if isinstance(v, str) and IMG_URL.match(v) else None

        messages = []
        for m in (body.get("messages") or [])[:1000]:
            if not isinstance(m, dict):
                continue
            a = m.get("author") if isinstance(m.get("author"), dict) else {}
            embeds = []
            for e in (m.get("embeds") or [])[:5]:
                if isinstance(e, dict):
                    embeds.append({
                        "title": clean_str(e.get("title"), 256), "description": clean_str(e.get("description"), 2000),
                        "color": clean_int(e.get("color"), 0, 0xFFFFFF) or 0,
                        "fields": [{"name": clean_str(f.get("name"), 256), "value": clean_str(f.get("value"), 1024), "inline": bool(f.get("inline"))}
                                   for f in (e.get("fields") or [])[:10] if isinstance(f, dict)],
                        "image": img(e.get("image")), "thumb": img(e.get("thumb")),
                        "footer": clean_str(e.get("footer"), 200), "author": clean_str(e.get("author"), 100)})
            messages.append({
                "id": snow(m.get("id")), "ts": clean_epoch(m.get("ts")) or 0, "edited": clean_epoch(m.get("edited")),
                "author": {"id": snow(a.get("id")), "name": clean_str(a.get("name"), 80) or "Unknown", "bot": bool(a.get("bot")),
                           "avatar": img(a.get("avatar")), "color": clean_int(a.get("color"), 0, 0xFFFFFF) or 0},
                "content": (m.get("content") or "")[:2000] if isinstance(m.get("content"), str) else "",
                "users": {snow(k): clean_str(v, 80) for k, v in list((m.get("users") or {}).items())[:30] if snow(k)},
                "roles": {snow(k): {"name": clean_str((v or {}).get("name"), 80), "color": clean_int((v or {}).get("color"), 0, 0xFFFFFF) or 0}
                          for k, v in list((m.get("roles") or {}).items())[:30] if snow(k) and isinstance(v, dict)},
                "channels": {snow(k): clean_str(v, 80) for k, v in list((m.get("channels") or {}).items())[:30] if snow(k)},
                "attachments": [{"name": clean_str(x.get("name"), 100), "url": img(x.get("url")), "type": clean_str(x.get("type"), 60),
                                 "size": clean_int(x.get("size"), 0, 10**10) or 0}
                                for x in (m.get("attachments") or [])[:6] if isinstance(x, dict) and img(x.get("url"))],
                "embeds": embeds,
                "reply": {"id": snow(m["reply"].get("id"))} if isinstance(m.get("reply"), dict) and snow(m["reply"].get("id")) else None,
                "system": bool(m.get("system")),
            })
        if not messages:
            raise HttpError(400, "bad_request", "No messages.")
        g = body.get("guild") if isinstance(body.get("guild"), dict) else {}
        closed_by = body.get("closed_by") if isinstance(body.get("closed_by"), dict) else {}
        tid = secrets.token_urlsafe(12)
        t = now()
        record = {
            "v": 1, "id": tid, "gid": gid, "tier": tier,
            "guild": {"name": clean_str(g.get("name"), 100) or "Server", "icon_url": icon_url(gid, g.get("icon"))},
            "channel": clean_str(body.get("channel"), 100), "opened": clean_epoch(body.get("opened")) or t, "closed": t,
            "closed_by": {"id": snow(closed_by.get("id")), "name": clean_str(closed_by.get("name"), 80)},
            "expires": None if tier == "ultra" else t + TRANSCRIPT_TTL,
            "messages": messages,
        }
        await self.store.put("tr:" + tid, record, ttl=None if tier == "ultra" else TRANSCRIPT_TTL)
        items = await self.store.get("trx:" + gid) or []
        items = [i for i in items if not i.get("exp") or i["exp"] > t]
        items.insert(0, {"id": tid, "ch": record["channel"], "n": len(messages), "t": t, "tier": tier, "exp": record["expires"],
                         "by": record["closed_by"]["name"]})
        await self.store.put("trx:" + gid, items[:200])
        origin = self.public_origin(urlparse(request.url))
        return json_response({"ok": True, "id": tid, "url": f"{origin}/transcript?id={tid}"})

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
                       "servers": servers, "owner": bool(raw.get("owner")), "web_xp": clean_int(raw.get("web_xp")) or 0}
            existing = await self.store.get("profile:" + str(uid))
            if existing and {k: v for k, v in existing.items() if k != "updated"} == profile:
                continue
            profile["updated"] = now()
            await self.store.put("profile:" + str(uid), profile, ttl=WATCH_MAX_AGE + 86400)
            stored += 1
        return json_response({"ok": True, "stored": stored})


features.bind(globals())
