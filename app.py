import json, os, secrets
from pathlib import Path
from urllib.parse import urlencode
import requests
from flask import Flask, abort, jsonify, redirect, render_template, request, session, url_for

app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "")
if not app.secret_key:
    raise RuntimeError("Set FLASK_SECRET_KEY before starting.")
ROOT = Path(__file__).resolve().parent
DATA = Path(os.getenv("REX_DATA_DIR", ROOT / "data"))
DATA.mkdir(parents=True, exist_ok=True)
STORE = DATA / "guild_settings.json"
CLIENT_ID = os.getenv("DISCORD_CLIENT_ID", "")
CLIENT_SECRET = os.getenv("DISCORD_CLIENT_SECRET", "")
REDIRECT_URI = os.getenv("DISCORD_REDIRECT_URI", "http://127.0.0.1:5000/auth/callback")
BOT_TOKEN = os.getenv("DISCORD_BOT_TOKEN", "")
BOT_API_SECRET = os.getenv("REX_BOT_API_SECRET", "")
API = "https://discord.com/api/v10"
MANAGE_GUILD = 1 << 5

def read_store():
    try: return json.loads(STORE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError): return {}

def save_store(data):
    tmp = STORE.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, indent=2), encoding="utf-8")
    tmp.replace(STORE)

def discord(path, token=None, bot=False):
    value = BOT_TOKEN if bot else (token or session.get("access_token"))
    if not value: raise RuntimeError("Discord token is not configured")
    kind = "Bot " if bot else "Bearer "
    r = requests.get(API + path, headers={"Authorization": kind + value}, timeout=12)
    r.raise_for_status()
    return r.json()

def require_user():
    if not session.get("user") or not session.get("access_token"):
        return redirect(url_for("login", next=request.path))
    return None

def may_manage(g):
    return g.get("owner") is True or (int(g.get("permissions", "0")) & MANAGE_GUILD) == MANAGE_GUILD

def get_guilds():
    return discord("/users/@me/guilds")

@app.after_request
def headers(response):
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response

@app.get("/")
def home(): return render_template("home.html", user=session.get("user"))

@app.get("/login")
def login():
    if not CLIENT_ID or not CLIENT_SECRET:
        return render_template("error.html", title="Discord login not configured", message="Set DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET and DISCORD_REDIRECT_URI in your hosting environment."), 503
    state = secrets.token_urlsafe(24)
    session["oauth_state"] = state
    q = urlencode({"client_id": CLIENT_ID, "redirect_uri": REDIRECT_URI, "response_type": "code", "scope": "identify guilds", "state": state})
    return redirect("https://discord.com/oauth2/authorize?" + q)

@app.get("/auth/callback")
def callback():
    if request.args.get("error"): return redirect(url_for("home"))
    expected = session.pop("oauth_state", None)
    state = request.args.get("state", "")
    if not expected or not secrets.compare_digest(expected, state): abort(400, "OAuth state mismatch.")
    code = request.args.get("code")
    if not code: abort(400, "Missing OAuth code.")
    r = requests.post(API + "/oauth2/token", data={"client_id": CLIENT_ID, "client_secret": CLIENT_SECRET, "grant_type": "authorization_code", "code": code, "redirect_uri": REDIRECT_URI}, headers={"Content-Type": "application/x-www-form-urlencoded"}, timeout=12)
    r.raise_for_status()
    token = r.json()["access_token"]
    user = discord("/users/@me", token=token)
    session.clear()
    session["user"], session["access_token"] = user, token
    session["csrf_token"] = secrets.token_urlsafe(24)
    return redirect(url_for("dashboard"))

@app.post("/logout")
def logout():
    session.clear()
    return redirect(url_for("home"))

@app.get("/dashboard")
def dashboard():
    if not session.get("user"): return redirect(url_for("login"))
    try: guilds = get_guilds()
    except requests.RequestException:
        return render_template("error.html", title="Couldn't load servers", message="Please sign in again and retry."), 502
    visible = []
    for g in guilds:
        if may_manage(g):
            present = False
            if BOT_TOKEN:
                try: discord("/guilds/" + g["id"], bot=True); present = True
                except requests.RequestException: pass
            visible.append({"id": g["id"], "name": g["name"], "icon": g.get("icon"), "bot_present": present})
    return render_template("dashboard.html", user=session["user"], guilds=visible, client_id=CLIENT_ID)

def authorized_guild(guild_id):
    if not session.get("user"): abort(401)
    for g in get_guilds():
        if g["id"] == guild_id and may_manage(g): return g
    abort(403, "You need Manage Server or server ownership.")

@app.get("/servers/<guild_id>")
def server(guild_id):
    if not session.get("user"): return redirect(url_for("login"))
    g = authorized_guild(guild_id)
    settings = read_store().get(guild_id, {})
    return render_template("server.html", user=session["user"], guild=g, settings=settings, csrf=session.get("csrf_token", ""))

@app.get("/api/servers/<guild_id>/settings")
def get_settings(guild_id):
    authorized_guild(guild_id)
    return jsonify(read_store().get(guild_id, {}))

@app.put("/api/servers/<guild_id>/settings")
def put_settings(guild_id):
    authorized_guild(guild_id)
    if request.headers.get("X-CSRF-Token") != session.get("csrf_token"): abort(403, "CSRF check failed.")
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict): abort(400, "Expected JSON object.")
    allowed = {"welcome_enabled": bool, "welcome_channel_id": str, "welcome_message": str, "mod_log_enabled": bool, "mod_log_channel_id": str, "tickets_enabled": bool, "levels_enabled": bool}
    clean = {}
    for key, kind in allowed.items():
        if key not in payload: continue
        value = payload[key]
        if kind is bool and isinstance(value, bool): clean[key] = value
        elif kind is str and isinstance(value, str) and len(value) <= 2000: clean[key] = value.strip()
        else: abort(400, "Invalid value for " + key)
    all_data = read_store()
    all_data[guild_id] = {**all_data.get(guild_id, {}), **clean}
    save_store(all_data)
    return jsonify({"ok": True, "settings": all_data[guild_id]})

@app.get("/profile")
def profile():
    if not session.get("user"): return redirect(url_for("login"))
    return render_template("profile.html", user=session["user"])

@app.get("/docs")
def docs(): return render_template("docs.html", user=session.get("user"))

@app.get("/health")
def health(): return jsonify({"ok": True, "service": "rex-dashboard"})

@app.get("/internal/guild-settings/<guild_id>")
def internal_settings(guild_id):
    if not BOT_API_SECRET: abort(503)
    supplied = request.headers.get("X-REX-API-Key", "")
    if not secrets.compare_digest(supplied, BOT_API_SECRET): abort(403)
    return jsonify(read_store().get(guild_id, {}))

@app.errorhandler(403)
def forbidden(e): return render_template("error.html", title="Access denied", message=getattr(e, "description", "You don't have access.")), 403
@app.errorhandler(404)
def missing(e): return render_template("error.html", title="Page not found", message="That REX page doesn't exist."), 404

if __name__ == "__main__": app.run(host="0.0.0.0", port=int(os.getenv("PORT", "5000")), debug=False)
