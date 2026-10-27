"""
Beta features that live on top of the main worker: website support tickets (and, in email_part below, email updates).
worker.py calls features.bind(globals()) once so these functions can use its helpers without a circular import.
"""
import base64
import hashlib
import hmac
import html
import json
import re
import secrets
import time
from email.header import Header
from urllib.parse import urlencode, parse_qs, urlparse

_G = {}
_NAMES = ("HttpError", "json_response", "clean_str", "clean_int", "now", "rate_limited", "safe_equal", "http")


def bind(g):
    for n in _NAMES:
        _G[n] = g[n]


def H(name):
    return _G[name]


SUPPORT_TYPES = {"help": "General help", "bug": "Report a bug", "premium": "Premium or codes", "appeal": "Ban appeal"}
MAX_MSG = 600
MAX_MSGS = 120
SWEAR = re.compile(r"\b(fuck\w*|shit\w*|bitch\w*|cunt|asshole|dickhead|bastard|wanker|twat|nigg\w+|faggot|retard\w*|slut|whore)\b", re.I)
COOLDOWN = 600


def _idx_row(c):
    return {"id": c["id"], "uid": c["uid"], "name": c["name"], "type": c["type"], "status": c["status"], "updated": c["updated"],
            "last": (c["msgs"][-1]["x"][:80] if c["msgs"] else ""), "n": len(c["msgs"])}


async def _save(w, c):
    c["updated"] = H("now")()
    if len(c["msgs"]) > MAX_MSGS:
        c["msgs"] = c["msgs"][-MAX_MSGS:]
    await w.store.put("sup:" + c["id"], c, ttl=60 * 60 * 24 * 30)
    idx = await w.store.get("sup:idx") or []
    idx = [r for r in idx if r["id"] != c["id"]]
    idx.insert(0, _idx_row(c))
    await w.store.put("sup:idx", idx[:300])


async def _load(w, cid, uid=None, staff=False):
    if not re.match(r"^[0-9a-f]{12}$", cid or ""):
        raise H("HttpError")(404, "not_found", "Conversation not found.")
    c = await w.store.get("sup:" + cid)
    if not c or (not staff and c["uid"] != uid):
        raise H("HttpError")(404, "not_found", "Conversation not found.")
    return c


def _public(c, staff=False):
    d = {k: c.get(k) for k in ("id", "type", "status", "created", "updated", "url", "name", "uid", "strikes", "reason")}
    d["msgs"] = c["msgs"]
    return d


def _msg(frm, text):
    return {"f": frm, "t": H("now")(), "x": H("clean_str")(text, MAX_MSG)}


async def route(w, request, url, path, method, session):
    """Everything under /api/support. Returns a response or None."""
    err = H("HttpError")
    jr = H("json_response")
    uid = session["user"]["id"]
    parts = path.split("/")  # ['', 'api', 'support', ...]
    tail = parts[3:]
    await w.require_beta("support", session)

    if tail == [] and method == "GET":
        idx = await w.store.get("sup:u:" + uid) or []
        convs = []
        for cid in idx[:12]:
            c = await w.store.get("sup:" + cid)
            if c:
                convs.append({k: c.get(k) for k in ("id", "type", "status", "updated", "created")})
        cool = await w.store.get("sup:cool:" + uid)
        return jr({"convs": convs, "cooldown": max(0, int(cool["until"] - H("now")())) if cool else 0, "types": SUPPORT_TYPES})
    if tail == ["kb"] and method == "GET":
        return jr(await w.store.get("support:kb") or {"items": []})
    if tail == ["new"] and method == "POST":
        w.check_mutation(request, url, session)
        if H("rate_limited")("supnew:" + uid, 6, 3600):
            raise err(429, "slow_down", "That's a lot of new chats. Please wait a bit.")
        cool = await w.store.get("sup:cool:" + uid)
        if cool and cool["until"] > H("now")():
            raise err(429, "cooldown", "Support chat is paused for a few minutes. Please try again soon.", )
        body = await w.read_json(request, 512)
        typ = body.get("type") if isinstance(body, dict) and body.get("type") in SUPPORT_TYPES else "help"
        c = {"id": secrets.token_hex(6), "uid": uid, "name": session["user"]["name"], "type": typ, "status": "bot", "created": H("now")(),
             "updated": H("now")(), "msgs": [], "strikes": 0}
        c["msgs"].append(_msg("b", "Hi " + session["user"]["name"] + "! I'm Rex's helper. Tell me what's up and I'll try to sort it out, or I can bring in a real person."))
        await _save(w, c)
        ids = await w.store.get("sup:u:" + uid) or []
        await w.store.put("sup:u:" + uid, ([c["id"]] + ids)[:20])
        return jr(_public(c))
    if len(tail) >= 1 and tail[0] not in ("new", "kb"):
        c = await _load(w, tail[0], uid)
        if len(tail) == 1 and method == "GET":
            return jr(_public(c))
        if len(tail) == 2 and tail[1] == "msg" and method == "POST":
            w.check_mutation(request, url, session)
            if H("rate_limited")("supmsg:" + uid, 40, 300):
                raise err(429, "slow_down", "Slow down a little.")
            if c["status"] == "closed":
                raise err(400, "closed", "This chat is closed.")
            body = await w.read_json(request, 2048)
            text = H("clean_str")(body.get("text") if isinstance(body, dict) else "", MAX_MSG)
            reply = H("clean_str")(body.get("bot") if isinstance(body, dict) else "", MAX_MSG)
            if not text and not reply:
                raise err(400, "bad_request", "Write a message first.")
            if text:
                c["msgs"].append(_msg("u", text))
            if c["status"] == "open" and text:
                # a real person is in the conversation: relay it to the support server
                await w.enqueue("_", {"id": secrets.token_hex(6), "ts": H("now")(), "by": uid, "byname": c["name"], "op": "support_say", "gid": "_",
                                      "args": {"cid": c["id"], "chan": c.get("chan"), "who": c["name"], "text": text, "from": "user"}})
            elif c["status"] == "bot" and text and SWEAR.search(text):
                c["strikes"] = int(c.get("strikes", 0)) + 1
                if c["strikes"] >= 2:
                    c["status"] = "closed"
                    c["reason"] = "language"
                    c["msgs"].append(_msg("b", "I'm going to end this chat because of the language. You can start a new one in a few minutes."))
                    await w.store.put("sup:cool:" + uid, {"until": H("now")() + COOLDOWN}, ttl=COOLDOWN + 30)
                else:
                    c["msgs"].append(_msg("b", "Let's keep it friendly please. I'm happy to help, but I'll have to end the chat if the language continues."))
            elif c["status"] == "bot" and reply:
                c["msgs"].append(_msg("b", reply))
            await _save(w, c)
            return jr(_public(c))
        if len(tail) == 2 and tail[1] == "escalate" and method == "POST":
            w.check_mutation(request, url, session)
            if c["status"] != "bot":
                return jr(_public(c))
            if H("rate_limited")("supesc:" + uid, 3, 3600):
                raise err(429, "slow_down", "You already asked for a person recently.")
            c["status"] = "open"
            c["msgs"].append(_msg("b", "Okay, I've asked a real person to join. Keep this page open, they'll reply here."))
            await _save(w, c)
            await w.enqueue("_", {"id": secrets.token_hex(6), "ts": H("now")(), "by": uid, "byname": c["name"], "op": "support_escalate", "gid": "_",
                                  "args": {"cid": c["id"], "uid": uid, "name": c["name"], "type": c["type"], "typename": SUPPORT_TYPES[c["type"]],
                                           "log": [{"f": m["f"], "x": m["x"][:300]} for m in c["msgs"][-25:]]}})
            return jr(_public(c))
        if len(tail) == 2 and tail[1] == "close" and method == "POST":
            w.check_mutation(request, url, session)
            return jr(_public(await close(w, c, "user")))
    raise err(404, "not_found", "Not found.")


async def close(w, c, by):
    if c["status"] != "closed":
        was_open = c["status"] == "open"
        c["status"] = "closed"
        c["reason"] = by
        c["msgs"].append(_msg("b", "This chat was closed. Start a new one any time." if by != "staff" else "A team member closed this chat. Start a new one any time."))
        await _save(w, c)
        if was_open and c.get("chan"):
            await w.enqueue("_", {"id": secrets.token_hex(6), "ts": H("now")(), "by": c["uid"], "byname": c["name"], "op": "support_close", "gid": "_",
                                  "args": {"cid": c["id"], "chan": c["chan"], "by": by}})
    return c


async def owner_route(w, request, url, path, method, session):
    err = H("HttpError")
    jr = H("json_response")
    tail = path.split("/")[4:]  # /api/owner/support/...
    if tail == [] and method == "GET":
        return jr({"items": await w.store.get("sup:idx") or []})
    if tail == ["kb"] and method == "GET":
        return jr(await w.store.get("support:kb") or {"items": []})
    if tail == ["kb"] and method == "PUT":
        w.check_mutation(request, url, session)
        body = await w.read_json(request, 64 * 1024)
        items = []
        for it in (body.get("items") if isinstance(body, dict) else []) or []:
            q = [H("clean_str")(k, 60) for k in (it.get("keys") or [])[:12]]
            a = H("clean_str")(it.get("answer"), 800)
            if q and a:
                items.append({"title": H("clean_str")(it.get("title"), 80), "keys": [k for k in q if k], "answer": a})
        await w.store.put("support:kb", {"items": items[:80]})
        return jr({"ok": True, "n": len(items)})
    if tail:
        c = await _load(w, tail[0], staff=True)
        if len(tail) == 1 and method == "GET":
            return jr(_public(c, True))
        w.check_mutation(request, url, session)
        if tail[1:] == ["reply"] and method == "POST":
            body = await w.read_json(request, 2048)
            text = H("clean_str")(body.get("text") if isinstance(body, dict) else "", MAX_MSG)
            if not text:
                raise err(400, "bad_request", "Write a reply first.")
            if c["status"] == "closed":
                raise err(400, "closed", "Reopen the chat first.")
            c["status"] = "open"
            c["msgs"].append(_msg("s", text))
            await _save(w, c)
            await w.enqueue("_", {"id": secrets.token_hex(6), "ts": H("now")(), "by": session["user"]["id"], "byname": session["user"]["name"], "op": "support_say",
                                  "gid": "_", "args": {"cid": c["id"], "chan": c.get("chan"), "who": session["user"]["name"], "text": text, "from": "staff"}})
            return jr(_public(c, True))
        if tail[1:] == ["close"] and method == "POST":
            return jr(_public(await close(w, c, "staff"), True))
        if tail[1:] == ["reopen"] and method == "POST":
            c["status"] = "open"
            c["reason"] = ""
            c["msgs"].append(_msg("b", "A team member reopened this chat."))
            await _save(w, c)
            return jr(_public(c, True))
    raise err(404, "not_found", "Not found.")


async def bot_route(w, tail, method, body):
    """/api/bot/support/..."""
    jr = H("json_response")
    if not isinstance(body, dict):
        raise H("HttpError")(400, "bad_request", "Expected an object.")
    cid = str(body.get("id") or "")
    c = await _load(w, cid, staff=True)
    if tail == ["msg"]:
        c["msgs"].append(_msg("s", body.get("text")))
        await _save(w, c)
    elif tail == ["link"]:
        c["chan"] = H("clean_str")(body.get("chan"), 30)
        c["url"] = H("clean_str")(body.get("url"), 200)
        await _save(w, c)
    elif tail == ["closed"]:
        c["chan"] = None   # the channel is already gone, so don't ask the bot to close it again
        await close(w, c, "staff")
    else:
        raise H("HttpError")(404, "not_found", "Not found.")
    return jr({"ok": True})


# =====================================================================================================================
# Email updates (beta "email"): opt-in preferences, Gmail sending driven by the owner page, one-click unsubscribe
# =====================================================================================================================
GMAIL_REDIRECT = "http://localhost"
GMAIL_SCOPES = "openid email https://www.googleapis.com/auth/gmail.send"
DAILY_CAP = 450
BATCH = 8
PREF_KEYS = ("update", "push")


def _secret(w):
    return (w.cfg("BOT_API_KEY") or "rex") + "|email"


def _unsub_token(w, uid):
    return hmac.new(_secret(w).encode(), ("unsub:" + uid).encode(), hashlib.sha256).hexdigest()[:24]


def _unsub_url(w, origin, uid):
    return f"{origin}/api/unsub?u={uid}&t={_unsub_token(w, uid)}"


def _mask(addr):
    if not addr or "@" not in addr:
        return ""
    name, dom = addr.split("@", 1)
    return (name[:2] + "***" if len(name) > 2 else name[:1] + "*") + "@" + dom


async def prefs_route(w, request, url, path, method, session):
    jr = H("json_response")
    uid = session["user"]["id"]
    await w.require_beta("email", session)
    rec = await w.get_user(uid) or {}
    owner = uid in w.owner_ids()
    if method == "GET":
        return jr({"email": "" if owner else _mask(rec.get("e", "")), "has_email": bool(rec.get("e")) and not owner, "owner": owner,
                   "can": bool(rec.get("g")), "update": bool((rec.get("ep") or {}).get("update")), "push": bool((rec.get("ep") or {}).get("push"))})
    if method == "PUT":
        w.check_mutation(request, url, session)
        body = await w.read_json(request, 512)
        ep = dict(rec.get("ep") or {})
        for k in PREF_KEYS:
            if isinstance(body, dict) and k in body:
                ep[k] = bool(body[k])
        rec["ep"] = ep
        await w.put_user(uid, rec)
        return jr({"ok": True, "update": bool(ep.get("update")), "push": bool(ep.get("push"))})
    raise H("HttpError")(405, "bad_method", "Not allowed.")


async def unsub_route(w, request, url, method):
    q = parse_qs(url.query or "")
    uid = (q.get("u") or [""])[0]
    tok = (q.get("t") or [""])[0]
    if not re.match(r"^\d{15,25}$", uid) or not H("safe_equal")(tok, _unsub_token(w, uid)):
        msg = "That unsubscribe link isn't valid."
    else:
        rec = await w.get_user(uid)
        if rec is not None:
            rec["ep"] = {"update": False, "push": False}
            await w.put_user(uid, rec)
        msg = "You're unsubscribed. You won't get any more emails from Rex."
    from workers import Response
    body = ("<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'><title>Unsubscribe</title>"
            "<body style='font-family:system-ui;background:#050a14;color:#e8f1ff;display:grid;place-items:center;min-height:100vh;margin:0'>"
            "<div style='max-width:420px;padding:28px;text-align:center'><h2>Rex</h2><p>" + html.escape(msg) + "</p></div></body>")
    return Response(body, status=200, headers={"Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store"})


# ---- building the email
def _safe_url(u):
    u = H("clean_str")(u, 500)
    return u if re.match(r"^https://[^\s<>\"']{4,480}$", u) else ""


def render_email(blocks, name, unsub, brand="Rex"):
    """Returns (html, text). Blocks: heading, text, button, image, divider, list."""
    def fill(t):
        return html.escape(str(t or "")).replace("{name}", html.escape(name or "there")).replace("{brand}", brand)
    parts_h, parts_t = [], []
    for b in (blocks or [])[:40]:
        t = b.get("t")
        x = H("clean_str")(b.get("x"), 2000)
        if t == "heading" and x:
            parts_h.append(f'<h2 style="margin:22px 0 8px;font:700 22px/1.25 Arial,sans-serif;color:#0b1426">{fill(x)}</h2>')
            parts_t.append(x.replace("{name}", name or "there").upper())
        elif t == "text" and x:
            parts_h.append('<p style="margin:0 0 14px;font:400 15px/1.6 Arial,sans-serif;color:#33415c">' + fill(x).replace("\n", "<br>") + "</p>")
            parts_t.append(x.replace("{name}", name or "there"))
        elif t == "list" and x:
            items = [i.strip() for i in x.split("\n") if i.strip()][:12]
            parts_h.append('<ul style="margin:0 0 14px;padding-left:20px;font:400 15px/1.6 Arial,sans-serif;color:#33415c">' + "".join(f"<li>{fill(i)}</li>" for i in items) + "</ul>")
            parts_t.append("\n".join("- " + i for i in items))
        elif t == "button" and _safe_url(b.get("url")) and x:
            u = html.escape(_safe_url(b.get("url")))
            parts_h.append(f'<p style="margin:18px 0"><a href="{u}" style="background:#2f8cff;color:#fff;text-decoration:none;font:700 15px Arial,sans-serif;padding:12px 22px;border-radius:10px;display:inline-block">{fill(x)}</a></p>')
            parts_t.append(f"{x}: {_safe_url(b.get('url'))}")
        elif t == "image" and _safe_url(b.get("url")):
            u = html.escape(_safe_url(b.get("url")))
            parts_h.append(f'<p style="margin:14px 0"><img src="{u}" alt="{fill(x)}" style="max-width:100%;border-radius:12px"></p>')
        elif t == "divider":
            parts_h.append('<hr style="border:0;border-top:1px solid #dfe6f3;margin:20px 0">')
            parts_t.append("-----")
    foot = ("You're getting this because you chose to hear from Rex. "
            f'<a href="{html.escape(unsub)}" style="color:#6b7a99">Unsubscribe</a> any time, or change what you get in your Rex profile.')
    doc = ('<!doctype html><html><body style="margin:0;background:#eef2f9"><div style="max-width:600px;margin:0 auto;padding:24px 16px">'
           '<div style="background:#ffffff;border-radius:16px;padding:28px">'
           '<div style="font:800 20px Arial,sans-serif;color:#2f8cff;letter-spacing:.06em">REX</div>' + "".join(parts_h) + "</div>"
           f'<p style="font:12px/1.5 Arial,sans-serif;color:#6b7a99;text-align:center;margin:16px 0">{foot}</p></div></body></html>')
    text = "\n\n".join(parts_t) + "\n\n--\nUnsubscribe: " + unsub
    return doc, text


def _b64(data):
    return base64.urlsafe_b64encode(data).decode().rstrip("=")


def build_mime(sender, to, subject, html_body, text_body, unsub):
    bound = "rex" + secrets.token_hex(8)
    subj = Header(subject, "utf-8").encode()
    def b64lines(s):
        raw = base64.b64encode(s.encode()).decode()
        return "\r\n".join(raw[i:i + 76] for i in range(0, len(raw), 76))
    msg = (f"From: Rex <{sender}>\r\nTo: {to}\r\nSubject: {subj}\r\nMIME-Version: 1.0\r\n"
           f"List-Unsubscribe: <{unsub}>\r\nList-Unsubscribe-Post: List-Unsubscribe=One-Click\r\n"
           f"Content-Type: multipart/alternative; boundary=\"{bound}\"\r\n\r\n"
           f"--{bound}\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\n{b64lines(text_body)}\r\n"
           f"--{bound}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\n{b64lines(html_body)}\r\n--{bound}--")
    return _b64(msg.encode())


async def _access_token(w, g):
    cid, sec = w.cfg("GMAIL_CLIENT_ID"), w.cfg("GMAIL_CLIENT_SECRET")
    cached = g.get("at")
    if cached and cached.get("exp", 0) > H("now")() + 60:
        return cached["t"]
    st, txt = await H("http")("POST", "https://oauth2.googleapis.com/token", {"Content-Type": "application/x-www-form-urlencoded"},
                              urlencode({"client_id": cid, "client_secret": sec, "refresh_token": g["refresh"], "grant_type": "refresh_token"}))
    if st != 200:
        raise H("HttpError")(502, "gmail_auth", "Gmail refused the saved login. Connect Gmail again.")
    d = json.loads(txt)
    g["at"] = {"t": d["access_token"], "exp": H("now")() + int(d.get("expires_in", 3000))}
    return g["at"]["t"]


async def _gmail_send(w, g, raw):
    tok = await _access_token(w, g)
    st, txt = await H("http")("POST", "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
                              {"Authorization": "Bearer " + tok, "Content-Type": "application/json"}, json.dumps({"raw": raw}))
    return st, txt


async def owner_email_route(w, request, url, path, method, session):
    err = H("HttpError")
    jr = H("json_response")
    tail = path.split("/")[4:]  # /api/owner/email/...
    g = await w.store.get("email:gmail") or {}
    configured = bool(w.cfg("GMAIL_CLIENT_ID") and w.cfg("GMAIL_CLIENT_SECRET"))
    if tail == [] and method == "GET":
        users = await w.all_users()
        aud = {"update": 0, "push": 0, "total": len(users)}
        for uid, u in users.items():
            if u.get("e") and u.get("g") and uid not in w.owner_ids():
                for k in PREF_KEYS:
                    if (u.get("ep") or {}).get(k):
                        aud[k] += 1
        day = await w.store.get("email:day:" + time.strftime("%Y-%m-%d", time.gmtime())) or {"n": 0}
        auth = ""
        if configured:
            auth = "https://accounts.google.com/o/oauth2/v2/auth?" + urlencode({"client_id": w.cfg("GMAIL_CLIENT_ID"), "redirect_uri": GMAIL_REDIRECT, "response_type": "code",
                                                                                 "scope": GMAIL_SCOPES, "access_type": "offline", "prompt": "consent"})
        return jr({"configured": configured, "connected": g.get("addr", ""), "auth_url": auth, "audience": aud, "sent_today": day["n"], "cap": DAILY_CAP,
                   "campaigns": (await w.store.get("email:camps") or [])[:15]})
    w.check_mutation(request, url, session)
    if tail == ["connect"] and method == "POST":
        if not configured:
            raise err(400, "not_configured", "Add GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET in Cloudflare first.")
        body = await w.read_json(request, 2048)
        raw = H("clean_str")(body.get("url") if isinstance(body, dict) else "", 1500)
        code = (parse_qs(urlparse(raw).query).get("code") or [""])[0] if "?" in raw else raw.strip()
        if not code:
            raise err(400, "bad_request", "Paste the whole address from the page that failed to load (it contains code=...).")
        st, txt = await H("http")("POST", "https://oauth2.googleapis.com/token", {"Content-Type": "application/x-www-form-urlencoded"},
                                  urlencode({"code": code, "client_id": w.cfg("GMAIL_CLIENT_ID"), "client_secret": w.cfg("GMAIL_CLIENT_SECRET"), "redirect_uri": GMAIL_REDIRECT,
                                             "grant_type": "authorization_code"}))
        if st != 200:
            raise err(400, "gmail_code", "Google did not accept that code. Codes expire fast, so start again from the button.")
        d = json.loads(txt)
        if not d.get("refresh_token"):
            raise err(400, "no_refresh", "Google didn't give a long-lived login. Remove Rex from your Google account's third-party access and try again.")
        st2, txt2 = await H("http")("GET", "https://openidconnect.googleapis.com/v1/userinfo", {"Authorization": "Bearer " + d["access_token"]})
        addr = (json.loads(txt2).get("email") if st2 == 200 else "") or ""
        await w.store.put("email:gmail", {"refresh": d["refresh_token"], "addr": addr})
        return jr({"ok": True, "connected": addr})
    if tail == ["disconnect"] and method == "POST":
        await w.store.delete("email:gmail")
        return jr({"ok": True})
    if tail == ["send"] and method == "POST":
        if not g.get("refresh"):
            raise err(400, "not_connected", "Connect Gmail first.")
        body = await w.read_json(request, 64 * 1024)
        origin = w.public_origin(url)
        day_key = "email:day:" + time.strftime("%Y-%m-%d", time.gmtime())
        day = await w.store.get(day_key) or {"n": 0}
        cid = body.get("cid")
        if not cid:   # start a campaign
            subject = H("clean_str")(body.get("subject"), 150)
            blocks = body.get("blocks") if isinstance(body.get("blocks"), list) else []
            if not subject or not blocks:
                raise err(400, "bad_request", "Add a subject and at least one block.")
            aud = body.get("audience")
            recips = []
            if aud == "test":
                to = H("clean_str")(body.get("test_to"), 120)
                if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", to):
                    raise err(400, "bad_request", "Type a valid test address.")
                recips = [{"uid": session["user"]["id"], "e": to, "n": session["user"]["name"]}]
            else:
                users = await w.all_users()
                want = set(str(x) for x in (body.get("users") or [])[:500])
                for uid, u in users.items():
                    if uid in w.owner_ids() or not u.get("e") or not u.get("g"):
                        continue
                    if aud in PREF_KEYS and (u.get("ep") or {}).get(aud):
                        recips.append({"uid": uid, "e": u["e"], "n": u.get("n", "")})
                    elif aud == "users" and uid in want and any((u.get("ep") or {}).get(k) for k in PREF_KEYS):
                        recips.append({"uid": uid, "e": u["e"], "n": u.get("n", "")})
            if not recips:
                raise err(400, "no_audience", "Nobody matches that audience. People only get emails after they opt in on their profile.")
            cid = secrets.token_hex(6)
            camp = {"id": cid, "subject": subject, "blocks": blocks[:40], "aud": aud, "total": len(recips), "pos": 0, "sent": 0, "failed": 0, "started": H("now")(), "done": False}
            await w.store.put("email:c:" + cid, dict(camp, recips=recips), ttl=60 * 60 * 24 * 14)
        c = await w.store.get("email:c:" + cid)
        if not c:
            raise err(404, "not_found", "Campaign not found.")
        left = DAILY_CAP - day["n"]
        sent_now = 0
        for r in c["recips"][c["pos"]:c["pos"] + BATCH]:
            if left <= 0:
                break
            unsub = _unsub_url(w, origin, r["uid"])
            doc, text = render_email(c["blocks"], r["n"], unsub)
            st, txt = await _gmail_send(w, g, build_mime(g["addr"], r["e"], c["subject"], doc, text, unsub))
            c["pos"] += 1
            left -= 1
            sent_now += 1
            if st == 200:
                c["sent"] += 1
            else:
                c["failed"] += 1
        day["n"] += sent_now
        await w.store.put(day_key, day, ttl=60 * 60 * 36)
        c["done"] = c["pos"] >= c["total"]
        paused = left <= 0 and not c["done"]
        await w.store.put("email:c:" + cid, c, ttl=60 * 60 * 24 * 14)
        row = {k: c[k] for k in ("id", "subject", "aud", "total", "sent", "failed", "started", "done")}
        camps = [x for x in (await w.store.get("email:camps") or []) if x["id"] != cid]
        camps.insert(0, row)
        await w.store.put("email:camps", camps[:30])
        if g.get("at"):
            await w.store.put("email:gmail", g)
        return jr({"cid": cid, "pos": c["pos"], "total": c["total"], "sent": c["sent"], "failed": c["failed"], "done": c["done"], "paused": paused})
    if tail == ["preview"] and method == "POST":
        body = await w.read_json(request, 64 * 1024)
        doc, _ = render_email(body.get("blocks") or [], session["user"]["name"], "#")
        return jr({"html": doc})
    raise err(404, "not_found", "Not found.")
