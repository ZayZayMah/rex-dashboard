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
import helper
from email.header import Header
from urllib.parse import urlencode, parse_qs, urlparse, quote

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
MAX_CHATS = 3            # chats per person that the owners can still see (user-deleted ones count until they auto-delete)
KEEP_DAYS = 30           # closed chats are removed after this long unless an owner keeps them
HOLD = 600               # automatic pause (seconds) when Rex flags someone, until an owner decides
SUPPORT_GUILD = "1550512979655794760"
INVITE = "https://discord.gg/2JSVqkVdeq"
DAY = 86400
WAITING = ("join", "retry")


def _sys_label(c):
    if c["status"] == "closed":
        return "Closed"
    return {"opening": "Open · Opening your ticket", "join": "Open · Waiting for you to join the server", "retry": "Open · Waiting for you",
            "human": "Open · With the Rex team", "ticket": "Open · With the Rex team"}.get(c.get("phase"), "Open · Chatting with Rex")


def _idx_row(c):
    return {"id": c["id"], "uid": c["uid"], "name": c["name"], "type": c["type"], "status": c["status"], "label": c.get("label") or _sys_label(c), "updated": c["updated"],
            "last": next((m["x"][:80] for m in reversed(c["msgs"]) if m["f"] != "d"), ""), "n": len(c["msgs"]), "flag": bool(c.get("flagged")), "keep": bool(c.get("keep")),
            "hidden": bool(c.get("hidden")), "del": _delete_at(c)}


def _delete_at(c):
    if c["status"] == "closed" and not c.get("keep") and c.get("closed_at"):
        return int(c["closed_at"] + KEEP_DAYS * DAY)
    return 0


async def _save(w, c):
    c["updated"] = H("now")()
    if len(c["msgs"]) > MAX_MSGS:
        c["msgs"] = c["msgs"][-MAX_MSGS:]
    dl = _delete_at(c)
    await w.store.put("sup:" + c["id"], c, ttl=(max(120, int(dl - H("now")())) if dl else None))
    idx = await w.store.get("sup:idx") or []
    idx = [r for r in idx if r["id"] != c["id"]]
    idx.insert(0, _idx_row(c))
    await w.store.put("sup:idx", idx[:300])


async def _load(w, cid, uid=None, staff=False):
    if not re.match(r"^[0-9a-f]{12}$", cid or ""):
        raise H("HttpError")(404, "not_found", "Conversation not found.")
    c = await w.store.get("sup:" + cid)
    if not c or (not staff and (c["uid"] != uid or c.get("hidden"))):
        raise H("HttpError")(404, "not_found", "Conversation not found.")
    if c["status"] == "closed" and _delete_at(c) and _delete_at(c) < H("now")():
        await _purge(w, c)
        raise H("HttpError")(404, "not_found", "Conversation not found.")
    return c


async def _purge(w, c):
    await w.store.delete("sup:" + c["id"])
    idx = await w.store.get("sup:idx") or []
    await w.store.put("sup:idx", [r for r in idx if r["id"] != c["id"]])


def _public(c, staff=False):
    d = {k: c.get(k) for k in ("id", "type", "status", "phase", "created", "updated", "url", "name", "uid", "avatar", "closed_at", "keep", "flagged", "reason")}
    d["label"] = c.get("label") or _sys_label(c)
    d["msgs"] = c["msgs"]
    d["chips"] = c.get("chips") or []
    d["delete_at"] = _delete_at(c)
    d["locked"] = c["status"] == "closed" or c.get("phase") in ("opening", "join", "retry")
    return d


def _msg(frm, text, url=None):
    m = {"f": frm, "t": H("now")(), "x": H("clean_str")(text, 1800 if frm in ("b", "d") else MAX_MSG)}
    if url:
        m["u"] = url
    return m


def _div(text):
    return _msg("d", text)


async def _cool(w, uid):
    cool = await w.store.get("sup:cool:" + uid)
    if cool and cool["until"] > H("now")():
        return cool
    return None


async def _set_cool(w, uid, name, seconds, reason, by="owner"):
    cools = [r for r in (await w.store.get("sup:cools") or []) if r["uid"] != uid and r["until"] > H("now")()]
    if seconds > 0:
        until = H("now")() + seconds
        await w.store.put("sup:cool:" + uid, {"until": until, "reason": reason, "by": by}, ttl=int(seconds) + 60)
        cools.insert(0, {"uid": uid, "name": name, "until": until, "reason": reason, "by": by})
    else:
        await w.store.delete("sup:cool:" + uid)
    await w.store.put("sup:cools", cools[:100])


def _close_chat(c, label, divider, reason=""):
    if c["status"] != "closed":
        c["status"] = "closed"
        c["closed_at"] = H("now")()
        c["msgs"].append(_div(divider))
    c["chips"] = []
    c["label"] = label
    if reason:
        c["reason"] = reason
    return c


async def close(w, c, by, url=None):
    if c["status"] != "closed":
        had_chan = c.get("chan") and c.get("phase") == "ticket"
        _close_chat(c, "Closed" if by != "staff" else "Closed · By the Rex team", "Chat closed" if by != "staff" else "Chat closed by the Rex team", by)
        await _save(w, c)
        if url is not None and c.get("uid"):
            await fire(w, "support_closed", c["uid"], url)
    return c


def _chip_ok(c, choice):
    return any(len(x) > 1 and x[1] == choice for x in (c.get("chips") or []))


async def _kb_extra(w):
    return (await w.store.get("support:kb") or {}).get("items") or []


async def _enqueue(w, uid, name, op, args):
    await w.enqueue("_", {"id": secrets.token_hex(6), "ts": H("now")(), "by": uid, "byname": name, "op": op, "gid": "_", "args": args})


async def _open_ticket(w, c):
    c["phase"] = "opening"
    c["chips"] = []
    c["label"] = "Open · Opening your ticket"
    c["opening_at"] = H("now")()
    await _enqueue(w, c["uid"], c["name"], "support_open", {"cid": c["id"], "uid": c["uid"], "name": c["name"], "typename": SUPPORT_TYPES[c["type"]],
                                                          "summary": (c.get("flow") or {}).get("data", {}).get("_sum", []),
                                                          "log": [{"f": m["f"], "x": m["x"][:300]} for m in c["msgs"] if m["f"] in ("u", "b")][-25:]})


def _unstick(c):
    """If the bot never answered about the ticket, let the person retry or end instead of waiting forever."""
    if c.get("phase") == "opening" and H("now")() - c.get("opening_at", 0) > 90 and c["status"] == "open":
        c["phase"] = "retry"
        c["chips"] = [["Try again", "retry"], ["End ticket here", "end"]]
        c["msgs"].append(_msg("b", "Rex is taking a while to open the ticket. You can try again, or end this chat here."))
        return True
    return False


async def _flag(w, c, reason, excerpt):
    c["flagged"] = True
    label = "Closed · Being reviewed for inappropriate language" if "language" in reason else "Closed · Being reviewed"
    _close_chat(c, label, "Chat paused while the team reviews it", reason)
    await _set_cool(w, c["uid"], c["name"], HOLD, reason, "rex")
    await _enqueue(w, c["uid"], c["name"], "support_alert", {"cid": c["id"], "uid": c["uid"], "name": c["name"], "reason": reason, "excerpt": excerpt[:300]})


async def _user_chats(w, uid):
    ids = await w.store.get("sup:u:" + uid) or []
    alive, chats = [], []
    for cid in ids:
        c = await w.store.get("sup:" + cid)
        if c and not (c["status"] == "closed" and _delete_at(c) and _delete_at(c) < H("now")()):
            alive.append(cid)
            chats.append(c)
    if len(alive) != len(ids):
        await w.store.put("sup:u:" + uid, alive)
    return chats


async def route(w, request, url, path, method, session):
    """Everything under /api/support. Returns a response or None."""
    err = H("HttpError")
    jr = H("json_response")
    uid = session["user"]["id"]
    parts = path.split("/")  # ['', 'api', 'support', ...]
    tail = parts[3:]
    await w.require_beta("support", session)

    if tail == [] and method == "GET":
        convs = [{k: c.get(k) for k in ("id", "type", "status", "updated", "created")} | {"label": c.get("label") or _sys_label(c)} for c in await _user_chats(w, uid) if not c.get("hidden")]
        convs.sort(key=lambda r: -r["updated"])
        cool = await _cool(w, uid)
        return jr({"convs": convs[:MAX_CHATS], "cooldown": max(0, int(cool["until"] - H("now")())) if cool else 0, "types": SUPPORT_TYPES, "max": MAX_CHATS})
    if tail == ["new"] and method == "POST":
        w.check_mutation(request, url, session)
        if H("rate_limited")("supnew:" + uid, 6, 3600):
            raise err(429, "slow_down", "That's a lot of new chats. Please wait a bit.")
        if await _cool(w, uid):
            raise err(429, "cooldown", "Support chat is paused for you right now. Please try again later.")
        if len(await _user_chats(w, uid)) >= MAX_CHATS:
            raise err(429, "limit", "You have reached the limit of %d support chats. Delete a closed one (it can take a while to free up) or reopen an existing chat." % MAX_CHATS)
        body = await w.read_json(request, 512)
        typ = body.get("type") if isinstance(body, dict) and body.get("type") in SUPPORT_TYPES else "help"
        start = helper.begin(typ, session["user"]["name"])
        c = {"id": secrets.token_hex(6), "uid": uid, "name": session["user"]["name"], "avatar": session["user"].get("avatar_url") or "", "type": typ, "status": "open", "phase": "bot",
             "created": H("now")(), "updated": H("now")(), "msgs": [_msg("b", t) for t in start["say"]], "flow": start["flow"], "chips": [list(x) for x in start["chips"]]}
        c["label"] = ""
        await _save(w, c)
        ids = await w.store.get("sup:u:" + uid) or []
        await w.store.put("sup:u:" + uid, [c["id"]] + ids)
        return jr(_public(c))
    if len(tail) >= 1 and tail[0] not in ("new",):
        c = await _load(w, tail[0], uid)
        if len(tail) == 1 and method == "GET":
            if _unstick(c):
                await _save(w, c)
            return jr(_public(c))
        if len(tail) == 2 and tail[1] == "msg" and method == "POST":
            w.check_mutation(request, url, session)
            if H("rate_limited")("supmsg:" + uid, 40, 300):
                raise err(429, "slow_down", "Slow down a little.")
            if c["status"] == "closed":
                raise err(400, "closed", "This chat is closed.")
            if await _cool(w, uid):
                raise err(429, "cooldown", "Support chat is paused for you right now.")
            body = await w.read_json(request, 2048)
            body = body if isinstance(body, dict) else {}
            text = H("clean_str")(body.get("text"), MAX_MSG)
            choice = H("clean_str")(body.get("choice"), 40)
            phase = c.get("phase")
            if choice:
                if not _chip_ok(c, choice):
                    raise err(400, "bad_choice", "That button isn't available any more.")
                label = next(x[0] for x in c["chips"] if x[1] == choice)
                c["msgs"].append(_msg("u", label))
                text = ""
            elif text:
                c["msgs"].append(_msg("u", text))
            else:
                raise err(400, "bad_request", "Write a message first.")
            if phase == "opening":
                raise err(400, "busy", "Rex is opening your ticket. One moment.")
            if phase in WAITING:
                if choice == "end":
                    _close_chat(c, "Closed · Ended by you", "You ended the chat before a ticket was opened")
                    c["msgs"].append(_msg("b", "No problem, I haven't opened a ticket. You can start a new chat any time."))
                elif choice in ("joined", "retry"):
                    c["tries"] = c.get("tries", 0) + 1
                    await _open_ticket(w, c)
                else:
                    c["msgs"].append(_msg("b", "Please use the buttons below so I know what to do."))
                await _save(w, c)
                return jr(_public(c))
            if phase in ("ticket", "human"):
                if text and c.get("chan"):
                    await _enqueue(w, uid, c["name"], "support_say", {"cid": c["id"], "chan": c.get("chan"), "who": c["name"], "text": text, "from": "user"})
                await _save(w, c)
                return jr(_public(c))
            # Rex answers (always decided here on the server)
            turn = helper.reply(c, text, choice, await _kb_extra(w))
            for line in turn["say"]:
                c["msgs"].append(_msg("b", line))
            c["chips"] = [list(x) for x in turn["chips"]]
            if turn["step"]:
                c["flow"]["step"] = turn["step"]
            act = turn["action"]
            if act == "ticket":
                await _open_ticket(w, c)
            elif act == "timeout":
                await _flag(w, c, turn.get("reason") or "inappropriate language", text)
            elif act == "noise":
                _close_chat(c, "Closed · Messages were unclear", "Chat closed because Rex couldn't understand the messages", "noise")
            elif act == "done":
                _close_chat(c, "Closed · Resolved", "Chat closed")
            await _save(w, c)
            return jr(_public(c))
        if len(tail) == 2 and tail[1] == "close" and method == "POST":
            w.check_mutation(request, url, session)
            return jr(_public(await close(w, c, "user", url)))
        if len(tail) == 2 and tail[1] == "delete" and method == "POST":
            w.check_mutation(request, url, session)
            if c["status"] != "closed":
                raise err(400, "not_closed", "Close the chat first, then you can delete it.")
            c["hidden"] = True       # only hidden for them; the owners still see it until the 30 days are up
            await _save(w, c)
            return jr({"ok": True})
    raise err(404, "not_found", "Not found.")


async def owner_route(w, request, url, path, method, session):
    err = H("HttpError")
    jr = H("json_response")
    tail = path.split("/")[4:]  # /api/owner/support/...
    if tail == [] and method == "GET":
        idx = await w.store.get("sup:idx") or []
        keep = [r for r in idx if not r.get("del") or r["del"] > H("now")()]
        if len(keep) != len(idx):
            await w.store.put("sup:idx", keep)
        cools = [r for r in (await w.store.get("sup:cools") or []) if r["until"] > H("now")()]
        return jr({"items": keep, "cools": cools})
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
    if tail == ["timeout"] and method == "POST":
        w.check_mutation(request, url, session)
        body = await w.read_json(request, 1024)
        tuid = H("clean_str")(body.get("uid") if isinstance(body, dict) else "", 30)
        if not re.match(r"^\d{5,25}$", tuid):
            raise err(400, "bad_request", "That doesn't look like a Discord user ID.")
        mins = max(0, min(525600, H("clean_int")(body.get("minutes"), 0)))
        await _set_cool(w, tuid, H("clean_str")(body.get("name"), 40) or tuid, mins * 60, H("clean_str")(body.get("reason"), 120) or "Set by an owner", session["user"]["name"])
        return jr({"ok": True, "minutes": mins})
    if tail:
        c = await _load(w, tail[0], staff=True)
        if len(tail) == 1 and method == "GET":
            d = _public(c, True)
            d["flow"] = {"step": (c.get("flow") or {}).get("step"), "strikes": (c.get("flow") or {}).get("strikes"), "noise": (c.get("flow") or {}).get("noise")}
            cool = await _cool(w, c["uid"])
            d["cool"] = int(cool["until"]) if cool else 0
            return jr(d)
        w.check_mutation(request, url, session)
        if tail[1:] == ["reply"] and method == "POST":
            body = await w.read_json(request, 2048)
            text = H("clean_str")(body.get("text") if isinstance(body, dict) else "", MAX_MSG)
            if not text:
                raise err(400, "bad_request", "Write a reply first.")
            if c["status"] == "closed":
                raise err(400, "closed", "Reopen the chat first.")
            c["phase"] = c.get("phase") if c.get("phase") == "ticket" else "human"
            c["chips"] = []
            c["label"] = ""
            c["msgs"].append(_msg("s", text))
            await _save(w, c)
            if c.get("chan"):
                await _enqueue(w, session["user"]["id"], session["user"]["name"], "support_say", {"cid": c["id"], "chan": c.get("chan"), "who": session["user"]["name"], "text": text, "from": "staff"})
            return jr(_public(c, True))
        if tail[1:] == ["close"] and method == "POST":
            return jr(_public(await close(w, c, "staff", url), True))
        if tail[1:] == ["reopen"] and method == "POST":
            c["status"] = "open"
            c["closed_at"] = 0
            c["reason"] = ""
            c["phase"] = "ticket" if c.get("chan") else "human"
            c["chips"] = []
            c["label"] = ""
            c["msgs"].append(_div("Chat reopened by the Rex team"))
            await _save(w, c)
            return jr(_public(c, True))
        if tail[1:] == ["status"] and method == "POST":
            body = await w.read_json(request, 1024)
            body = body if isinstance(body, dict) else {}
            label = H("clean_str")(body.get("label"), 60)
            c["label"] = label
            want = body.get("status")
            if want == "closed" and c["status"] != "closed":
                _close_chat(c, label or "Closed", "Chat closed by the Rex team")
            elif want == "open" and c["status"] == "closed":
                c["status"], c["closed_at"], c["phase"] = "open", 0, ("ticket" if c.get("chan") else "human")
                c["msgs"].append(_div("Chat reopened by the Rex team"))
            if body.get("divider"):
                c["msgs"].append(_div(H("clean_str")(body.get("divider"), 80)))
            await _save(w, c)
            return jr(_public(c, True))
        if tail[1:] == ["keep"] and method == "POST":
            body = await w.read_json(request, 256)
            c["keep"] = bool(isinstance(body, dict) and body.get("keep"))
            await _save(w, c)
            return jr(_public(c, True))
        if tail[1:] == ["delete"] and method == "POST":
            await _purge(w, c)
            ids = [x for x in (await w.store.get("sup:u:" + c["uid"]) or []) if x != c["id"]]
            await w.store.put("sup:u:" + c["uid"], ids)
            return jr({"ok": True})
    raise err(404, "not_found", "Not found.")


async def bot_route(w, tail, method, body):
    """/api/bot/support/..."""
    jr = H("json_response")
    if not isinstance(body, dict):
        raise H("HttpError")(400, "bad_request", "Expected an object.")
    if tail == ["timeout"]:
        uid = str(body.get("uid") or "")
        if not re.match(r"^\d{5,25}$", uid):
            raise H("HttpError")(400, "bad_request", "Bad user.")
        await _set_cool(w, uid, uid, max(0, min(525600, H("clean_int")(body.get("minutes"), 0))) * 60, H("clean_str")(body.get("reason"), 120) or "Set by an owner", "owner")
        return jr({"ok": True})
    cid = str(body.get("id") or "")
    c = await _load(w, cid, staff=True)
    if tail == ["msg"]:
        c["msgs"].append(_msg("s", body.get("text")))
        await _save(w, c)
    elif tail == ["link"]:
        c["chan"] = H("clean_str")(body.get("chan"), 30)
        c["url"] = H("clean_str")(body.get("url"), 200)
        await _save(w, c)
    elif tail == ["opened"]:
        if c.get("phase") != "opening":
            return jr({"ok": True})
        if body.get("ok"):
            c["chan"] = H("clean_str")(body.get("chan"), 30)
            c["url"] = H("clean_str")(body.get("url"), 200)
            c["phase"] = "ticket"
            c["msgs"].append(_msg("b", "I've opened your ticket. The Rex team will reply there:", c["url"]))
            _close_chat(c, "Closed · Ticket opened on the Rex server", "Ticket opened on the Rex Discord server, chat closed", "ticket")
        elif body.get("reason") == "not_in_server":
            c["phase"] = "join"
            first = not c.get("tries")
            c["msgs"].append(_msg("b", ("To open a ticket you need to be in the official Rex server first. Join with this link, then press **I have joined**: " + INVITE) if first
                                  else "I still couldn't see you in the server. Make sure you joined with the same Discord account, then try again. " + INVITE, INVITE))
            c["chips"] = [["End ticket here", "end"], ["I have joined", "joined"]] if first else [["Rex couldn't see you, try again", "joined"], ["End ticket here", "end"]]
            c["label"] = ""
        else:
            c["phase"] = "retry"
            c["chips"] = [["Try again", "retry"], ["End ticket here", "end"]]
            c["msgs"].append(_msg("b", "I couldn't open the ticket just now. You can try again or end the chat."))
            c["label"] = ""
        await _save(w, c)
    elif tail == ["closed"]:
        c["chan"] = None   # the channel is already gone, so don't ask the bot to close it again
        await close(w, c, "staff")
    else:
        raise H("HttpError")(404, "not_found", "Not found.")
    return jr({"ok": True})


# =====================================================================================================================
# Email: tags (kinds of email people can pick), preferences page, Gmail sending, saved emails, automatic sending
# =====================================================================================================================
GMAIL_REDIRECT = "http://localhost"
GMAIL_SCOPES = "openid email https://www.googleapis.com/auth/gmail.send"
DAILY_CAP = 450
BATCH = 8
PREF_KEYS = ("update", "push")
DEFAULT_TAGS = [{"id": "announcements", "name": "Announcements", "desc": "Big news about Rex."},
                {"id": "new_features", "name": "New features", "desc": "When Rex gets something new."},
                {"id": "bug_fixes", "name": "Bug fixes", "desc": "Problems we found and fixed."}]
MAX_TAGS = 12
EMAIL_RE = re.compile(r"^[^@\s]{1,64}@[^@\s]{1,200}\.[^@\s]{2,24}$")


def _secret(w):
    return (w.cfg("BOT_API_KEY") or "rex") + "|email"


def _unsub_token(w, key):
    return hmac.new(_secret(w).encode(), ("unsub:" + key).encode(), hashlib.sha256).hexdigest()[:24]


def _unsub_url(w, origin, key):
    """One-click unsubscribe. key is a Discord id, or an email address for people without a Discord account."""
    p = "u=" + key if re.match(r"^\d{15,25}$", key) else "e=" + quote(key, safe="")
    return f"{origin}/api/unsub?{p}&t={_unsub_token(w, key)}"


def _prefs_url(w, origin, key):
    """The email preferences page: /<discord id>/email, or /<email>/email when there is no Discord account."""
    return f"{origin}/{quote(key, safe='')}/email?t={_unsub_token(w, key)}"


def _mask(addr):
    if not addr or "@" not in addr:
        return ""
    name, dom = addr.split("@", 1)
    return (name[:2] + "***" if len(name) > 2 else name[:1] + "*") + "@" + dom


def _ext_key(email):
    return "email:ext:" + hashlib.sha1(email.lower().encode()).hexdigest()[:20]


async def get_tags(w):
    t = await w.store.get("email:tags")
    return t if isinstance(t, list) and t else [dict(x) for x in DEFAULT_TAGS]


def _slug(name):
    return re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")[:24]


def _pref_view(ep, tags):
    ep = ep or {}
    return {"all": ep.get("update") is not False, "push": ep.get("push") is not False,
            "tags": [{"id": t["id"], "name": t["name"], "desc": t.get("desc", ""), "on": (ep.get("tags") or {}).get(t["id"]) is not False} for t in tags]}


def _pref_apply(ep, body, tags):
    ep = dict(ep or {})
    known = {t["id"] for t in tags}
    tg = {k: v for k, v in (ep.get("tags") or {}).items() if k in known}
    if isinstance(body.get("tags"), dict):
        for k, v in body["tags"].items():
            if k in known:
                tg[k] = bool(v)
                if v:
                    ep["update"] = True
    ep["tags"] = tg
    if "push" in body:
        ep["push"] = bool(body["push"])
    if "all" in body:
        ep["update"] = bool(body["all"])
        if not body["all"]:
            ep["push"] = False
    return ep


async def prefs_route(w, request, url, path, method, session):
    """Logged-in users: the profile box."""
    jr = H("json_response")
    uid = session["user"]["id"]
    await w.require_beta("email", session)
    rec = await w.get_user(uid) or {}
    owner = uid in w.owner_ids()
    tags = await get_tags(w)
    if method == "GET":
        return jr(dict(_pref_view(rec.get("ep"), tags), email="" if owner else _mask(rec.get("e", "")), has_email=bool(rec.get("e")) and not owner, owner=owner, uid=uid,
                       update=_pref_view(rec.get("ep"), tags)["all"]))
    if method == "PUT":
        w.check_mutation(request, url, session)
        body = await w.read_json(request, 1024)
        rec["ep"] = _pref_apply(rec.get("ep"), body if isinstance(body, dict) else {}, tags)
        await w.put_user(uid, rec)
        return jr(dict(_pref_view(rec["ep"], tags), ok=True))
    raise H("HttpError")(405, "bad_method", "Not allowed.")


async def emailprefs_route(w, request, url, method, session):
    """The public preferences page API. Allowed with the link's token, or when you are logged in as that person."""
    err, jr = H("HttpError"), H("json_response")
    q = parse_qs(url.query or "")
    key = H("clean_str")((q.get("k") or [""])[0], 220)
    tok = (q.get("t") or [""])[0]
    is_uid = bool(re.match(r"^\d{15,25}$", key))
    if not is_uid and not EMAIL_RE.match(key):
        raise err(404, "not_found", "That email preferences link isn't valid.")
    if H("rate_limited")("epref:" + key, 60, 600):
        raise err(429, "slow_down", "Too many tries. Please wait a few minutes.")
    by_token = bool(tok) and H("safe_equal")(tok, _unsub_token(w, key))
    by_session = bool(session) and is_uid and session["user"]["id"] == key
    if not (by_token or by_session):
        raise err(403, "bad_link", "That link has expired or isn't valid. Use the link from your latest Rex email, or log in.")
    tags = await get_tags(w)
    if is_uid:
        rec = await w.get_user(key)
        if rec is None:
            raise err(404, "not_found", "We don't have an account for that link.")
        who, addr = rec.get("n", ""), rec.get("e", "")
    else:
        rec = await w.store.get(_ext_key(key)) or {"e": key}
        who, addr = "", key
    if method == "GET":
        return jr(dict(_pref_view(rec.get("ep"), tags), kind="discord" if is_uid else "email", name=who, email=_mask(addr)))
    if method == "PUT":
        if not by_token:
            w.check_mutation(request, url, session)
        body = await w.read_json(request, 1024)
        rec["ep"] = _pref_apply(rec.get("ep"), body if isinstance(body, dict) else {}, tags)
        if is_uid:
            await w.put_user(key, rec)
        else:
            rec["e"] = key
            await w.store.put(_ext_key(key), rec)
        return jr(dict(_pref_view(rec["ep"], tags), ok=True))
    raise err(405, "bad_method", "Not allowed.")


async def unsub_route(w, request, url, method):
    q = parse_qs(url.query or "")
    uid = (q.get("u") or [""])[0]
    email = (q.get("e") or [""])[0].strip()
    key = uid or email
    tok = (q.get("t") or [""])[0]
    valid = bool(key) and (re.match(r"^\d{15,25}$", key) or EMAIL_RE.match(key)) and H("safe_equal")(tok, _unsub_token(w, key))
    if not valid:
        msg = "That unsubscribe link isn't valid."
    else:
        if uid:
            rec = await w.get_user(uid)
            if rec is not None:
                rec["ep"] = dict(rec.get("ep") or {}, update=False, push=False)
                await w.put_user(uid, rec)
        else:
            rec = await w.store.get(_ext_key(email)) or {"e": email}
            rec["ep"] = dict(rec.get("ep") or {}, update=False, push=False)
            await w.store.put(_ext_key(email), rec)
        msg = "You're unsubscribed. You won't get any more emails from Rex."
    from workers import Response
    body = ("<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'><title>Unsubscribe</title>"
            "<body style='font-family:system-ui;background:#050a14;color:#e8f1ff;display:grid;place-items:center;min-height:100vh;margin:0'>"
            "<div style='max-width:420px;padding:28px;text-align:center'><h2>Rex</h2><p>" + html.escape(msg) + "</p></div></body>")
    return Response(body, status=200, headers={"Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store"})


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



# ---- saved emails (templates), audiences and automatic sending
import mail as _mail   # noqa: E402

EVENTS = {
    "manual": "Only when I send it",
    "first_login": "When someone logs in for the first time",
    "data_removed": "When someone removes all their data",
    "bot_joins_server": "When Rex is added to a server they own",
    "bot_leaves_server": "When Rex is removed from a server they own",
    "joins_support": "When someone joins the Rex support server",
    "code_redeemed": "When someone redeems a premium code",
    "support_closed": "When a support chat is closed",
    "server_blacklisted": "When a server they own is blacklisted",
    "server_unblacklisted": "When a server they own is unblacklisted",
}
SEND_AT = {"now": "Immediately", "time": "At a set time of day (UTC)", "online": "When they are next on the dashboard"}
MAX_TPLS = 30
MAX_LATER = 500


def wants(u, cat="update"):
    """People get emails unless they explicitly turned that kind off."""
    return (u.get("ep") or {}).get(cat) is not False


def eligible(u, send_to):
    """send_to: tag:<id> (people who kept that kind on), everyone (anyone who hasn't unsubscribed), essential (account notices)."""
    if not u or not u.get("e"):
        return False
    ep = u.get("ep") or {}
    if send_to == "essential":
        return True
    if send_to == "target":   # automatic emails: just the person the event is about (still respects a full unsubscribe)
        return ep.get("update") is not False
    if send_to == "opted_in":
        return ep.get("update") is True
    if send_to == "everyone":
        return ep.get("update") is not False
    if isinstance(send_to, str) and send_to.startswith("tag:"):
        return ep.get("update") is not False and (ep.get("tags") or {}).get(send_to[4:]) is not False
    return False


def _vars(w, origin, key, name, extra=None):
    v = {"name": name or "there", "dashboard_url": origin + "/dashboard", "site_url": origin, "unsubscribe_url": _unsub_url(w, origin, key) if key else "#",
         "unsubscribe_link": _prefs_url(w, origin, key) if key else origin + "/", "logo_url": origin + "/img/rex-logo.png", "support_url": origin + "/support",
         "date": time.strftime("%B %d, %Y", time.gmtime()), "server": ""}
    v.update(extra or {})
    return v


def _tpl_row(t):
    return {k: t.get(k) for k in ("id", "name", "subject", "send_to", "send_when", "when_at", "at_time", "enabled", "updated", "sent")}


def _clean_tpl(body, prev, tag_ids):
    name = H("clean_str")(body.get("name"), 60)
    subject = H("clean_str")(body.get("subject"), 150)
    if not name:
        raise H("HttpError")(400, "bad_request", "Give the email a name.")
    try:
        design = _mail.clean_design(body.get("design"))
    except ValueError as ex:
        raise H("HttpError")(400, "bad_design", str(ex))
    st = body.get("send_to")
    send_to = st if st in ("everyone", "essential", "target") or (isinstance(st, str) and st.startswith("tag:") and st[4:] in tag_ids) else "everyone"
    send_when = body.get("send_when") if body.get("send_when") in EVENTS else "manual"
    when_at = body.get("when_at") if body.get("when_at") in SEND_AT else "now"
    at_time = H("clean_str")(body.get("at_time"), 5)
    if not re.match(r"^([01]\d|2[0-3]):[0-5]\d$", at_time or ""):
        at_time = "09:00"
    if send_when in ("data_removed", "bot_leaves_server"):
        when_at = "now"   # they won't be around later
    if send_when != "manual" and send_to == "everyone":
        send_to = "target"   # an event only ever involves one person, so "everyone" means "the person it happens to"
    if send_when == "manual" and send_to == "target":
        send_to = "everyone"
    enabled = bool(body.get("enabled")) and send_when != "manual"
    return {"id": prev.get("id"), "name": name, "subject": subject or name, "design": design, "send_to": send_to, "send_when": send_when, "when_at": when_at, "at_time": at_time,
            "enabled": enabled, "updated": H("now")(), "sent": int(prev.get("sent", 0))}


async def _gmail(w):
    g = await w.store.get("email:gmail") or {}
    return g if g.get("refresh") else None


async def _send_one(w, g, tpl, key, to, name, origin, extra=None):
    v = _vars(w, origin, key, name, extra)
    doc, text = _mail.render(tpl["design"], v, tpl["subject"])
    subject = _mail.fill_vars(tpl["subject"], v)
    st, _ = await _gmail_send(w, g, build_mime(g["addr"], to, subject, doc, text, v["unsubscribe_url"]))
    return st == 200


def _next_due(at_time):
    hh, mm = int(at_time[:2]), int(at_time[3:])
    t = H("now")()
    day = t - (t % 86400)
    due = day + hh * 3600 + mm * 60
    return due if due > t + 30 else due + 86400


async def _send_tpl(w, g, tpl_id, rec, key, origin, extra):
    """Sends one saved email to one person, if they are still eligible. Returns True if it was sent."""
    tpl = await w.store.get("email:tpl:" + tpl_id)
    if not tpl or not tpl.get("enabled") or not eligible(rec, tpl.get("send_to")):
        return False
    day_key = "email:day:" + time.strftime("%Y-%m-%d", time.gmtime())
    day = await w.store.get(day_key) or {"n": 0}
    if day["n"] >= DAILY_CAP:
        return False
    ok = await _send_one(w, g, tpl, key, rec["e"], rec.get("n", ""), origin, extra)
    day["n"] += 1
    await w.store.put(day_key, day, ttl=60 * 60 * 36)
    if ok:
        tpl["sent"] = int(tpl.get("sent", 0)) + 1
        await w.store.put("email:tpl:" + tpl_id, tpl)
    return ok


async def fire(w, event, uid, url, extra=None, rec=None):
    """Automatic sends. Never raises: a mail problem must not break logging in or closing a chat."""
    try:
        if uid in w.owner_ids():
            return
        idx = [t for t in (await w.store.get("email:tpls") or []) if t.get("enabled") and t.get("send_when") == event]
        if not idx:
            return
        g = await _gmail(w)
        if not g:
            return
        u = rec if rec is not None else await w.get_user(uid)
        if not u:
            return
        origin = w.public_origin(url)
        for row in idx:
            when = row.get("when_at") or "now"
            if when == "now":
                await _send_tpl(w, g, row["id"], u, uid, origin, extra)
            elif when == "time":
                later = await w.store.get("email:later") or []
                if len(later) < MAX_LATER:
                    later.append({"tpl": row["id"], "uid": uid, "due": _next_due(row.get("at_time") or "09:00"), "extra": extra or {}})
                    await w.store.put("email:later", later)
            elif when == "online":
                pend = await w.store.get("email:pend:" + uid) or []
                if len(pend) < 10 and not any(p["tpl"] == row["id"] for p in pend):
                    pend.append({"tpl": row["id"], "extra": extra or {}, "ts": H("now")()})
                    await w.store.put("email:pend:" + uid, pend, ttl=60 * 60 * 24 * 60)
        if g.get("at"):
            await w.store.put("email:gmail", g)
    except Exception:
        return


async def flush_due(w, url):
    """Called whenever the bot checks in: sends anything scheduled for a time of day that has now passed."""
    try:
        later = await w.store.get("email:later")
        if not later:
            return
        t = H("now")()
        due = [x for x in later if x["due"] <= t][:BATCH]
        if not due:
            return
        g = await _gmail(w)
        keep = [x for x in later if x not in due]
        await w.store.put("email:later", keep)
        if not g:
            return
        origin = w.public_origin(url)
        for x in due:
            u = await w.get_user(x["uid"])
            if u:
                await _send_tpl(w, g, x["tpl"], u, x["uid"], origin, x.get("extra"))
        if g.get("at"):
            await w.store.put("email:gmail", g)
    except Exception:
        return


async def deliver_pending(w, uid, url):
    """Called when someone is on the website: sends the emails that were waiting for them to be online."""
    try:
        pend = await w.store.get("email:pend:" + uid)
        if not pend:
            return
        await w.store.delete("email:pend:" + uid)
        g = await _gmail(w)
        u = await w.get_user(uid)
        if not g or not u:
            return
        origin = w.public_origin(url)
        for p in pend[:5]:
            await _send_tpl(w, g, p["tpl"], u, uid, origin, p.get("extra"))
        if g.get("at"):
            await w.store.put("email:gmail", g)
    except Exception:
        return


async def _index_put(w, tpl):
    idx = [t for t in (await w.store.get("email:tpls") or []) if t["id"] != tpl["id"]]
    idx.insert(0, _tpl_row(tpl))
    await w.store.put("email:tpls", idx[:MAX_TPLS])


def _fonts():
    return [{"id": k, "label": v[2].replace(" *", ""), "css": v[0], "gf": v[1] or "", "web": bool(v[1])} for k, v in _mail.FONTS.items()]


async def owner_email_route(w, request, url, path, method, session):
    err = H("HttpError")
    jr = H("json_response")
    tail = path.split("/")[4:]  # /api/owner/email/...
    g = await w.store.get("email:gmail") or {}
    configured = bool(w.cfg("GMAIL_CLIENT_ID") and w.cfg("GMAIL_CLIENT_SECRET"))
    origin = w.public_origin(url)
    if tail == [] and method == "GET":
        users = await w.all_users()
        tags = await get_tags(w)
        aud = {"everyone": 0, "off": 0, "no_email": 0, "total": len(users), "tags": {t["id"]: 0 for t in tags}}
        for uid, u in users.items():
            if uid in w.owner_ids():
                continue
            if not u.get("e"):
                aud["no_email"] += 1
            elif wants(u):
                aud["everyone"] += 1
                for t in tags:
                    if eligible(u, "tag:" + t["id"]):
                        aud["tags"][t["id"]] += 1
            else:
                aud["off"] += 1
        day = await w.store.get("email:day:" + time.strftime("%Y-%m-%d", time.gmtime())) or {"n": 0}
        auth = ""
        if configured:
            auth = "https://accounts.google.com/o/oauth2/v2/auth?" + urlencode({"client_id": w.cfg("GMAIL_CLIENT_ID"), "redirect_uri": GMAIL_REDIRECT, "response_type": "code",
                                                                                 "scope": GMAIL_SCOPES, "access_type": "offline", "prompt": "consent"})
        return jr({"configured": configured, "connected": g.get("addr", ""), "auth_url": auth, "audience": aud, "sent_today": day["n"], "cap": DAILY_CAP,
                   "campaigns": (await w.store.get("email:camps") or [])[:15], "templates": await w.store.get("email:tpls") or [],
                   "events": EVENTS, "tags": tags, "send_at": SEND_AT})
    if tail == ["meta"] and method == "GET":
        return jr({"fonts": _fonts(), "variables": list(_mail.VARIABLES), "events": EVENTS, "send_at": SEND_AT, "tags": await get_tags(w), "mob_w": _mail.MOB_W})
    if len(tail) == 2 and tail[0] == "templates" and method == "GET":
        t = await w.store.get("email:tpl:" + tail[1]) if re.match(r"^[a-f0-9]{12}$", tail[1]) else None
        if not t:
            raise err(404, "not_found", "That email doesn't exist.")
        return jr(t)
    if len(tail) == 2 and tail[0] == "view" and method == "GET":
        pv = await w.store.get("email:pv:" + tail[1]) if re.match(r"^[A-Za-z0-9_-]{16,40}$", tail[1]) else None
        if not pv:
            raise err(404, "not_found", "That preview expired. Press Preview again.")
        from workers import Response
        return Response(pv["html"], status=200, headers={
            "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Frame-Options": "SAMEORIGIN", "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src https: data:; frame-ancestors 'self'"})
    w.check_mutation(request, url, session)
    if tail == ["tags"] and method == "PUT":
        body = await w.read_json(request, 8 * 1024)
        old = {t["id"]: t for t in await get_tags(w)}
        out, seen = [], set()
        for it in (body.get("tags") if isinstance(body, dict) else None) or []:
            name = H("clean_str")(it.get("name") if isinstance(it, dict) else "", 30)
            if not name:
                continue
            tid = it.get("id") if it.get("id") in old else _slug(name)
            if not tid or tid in seen:
                continue
            seen.add(tid)
            out.append({"id": tid, "name": name, "desc": H("clean_str")(it.get("desc"), 120)})
        if not out:
            raise err(400, "bad_request", "Keep at least one tag.")
        if len(out) > MAX_TAGS:
            raise err(400, "too_many", f"Up to {MAX_TAGS} tags.")
        await w.store.put("email:tags", out)
        gone = set(old) - seen
        if gone:   # emails aimed at a removed tag stop sending automatically
            idx = await w.store.get("email:tpls") or []
            for row in idx:
                if row.get("send_to") in {"tag:" + g2 for g2 in gone}:
                    t = await w.store.get("email:tpl:" + row["id"])
                    if t:
                        t["send_to"], t["enabled"] = "everyone", False
                        await w.store.put("email:tpl:" + row["id"], t)
                        row["send_to"], row["enabled"] = "everyone", False
            await w.store.put("email:tpls", idx)
        return jr({"ok": True, "tags": out})
    if len(tail) == 2 and tail[0] == "templates" and method == "PUT":
        body = await w.read_json(request, 120 * 1024)
        if not isinstance(body, dict):
            raise err(400, "bad_request", "Bad request.")
        prev = {}
        tid = tail[1]
        if tid == "new":
            if len(await w.store.get("email:tpls") or []) >= MAX_TPLS:
                raise err(400, "too_many", f"You can save up to {MAX_TPLS} emails. Delete one first.")
            tid = secrets.token_hex(6)
            prev = {"id": tid}
        elif re.match(r"^[a-f0-9]{12}$", tid):
            prev = await w.store.get("email:tpl:" + tid)
            if not prev:
                raise err(404, "not_found", "That email doesn't exist.")
        else:
            raise err(404, "not_found", "That email doesn't exist.")
        tpl = _clean_tpl(body, prev, {t["id"] for t in await get_tags(w)})
        tpl["id"] = tid
        await w.store.put("email:tpl:" + tid, tpl)
        await _index_put(w, tpl)
        return jr({"ok": True, "id": tid, "template": _tpl_row(tpl)})
    if len(tail) == 2 and tail[0] == "templates" and method == "DELETE":
        if re.match(r"^[a-f0-9]{12}$", tail[1]):
            await w.store.delete("email:tpl:" + tail[1])
            await w.store.put("email:tpls", [t for t in (await w.store.get("email:tpls") or []) if t["id"] != tail[1]])
        return jr({"ok": True})
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
    if tail == ["render"] and method == "POST":
        body = await w.read_json(request, 120 * 1024)
        try:
            design = _mail.clean_design(body.get("design") if isinstance(body, dict) else None)
        except ValueError as ex:
            raise err(400, "bad_design", str(ex))
        who = session["user"]["name"]
        v = _vars(w, origin, session["user"]["id"], who)
        doc, text = _mail.render(design, v, H("clean_str")(body.get("subject"), 150), force_dark=bool(body.get("dark")))
        tok = secrets.token_urlsafe(18)
        await w.store.put("email:pv:" + tok, {"html": doc}, ttl=600)
        return jr({"url": "/api/owner/email/view/" + tok, "text": text, "checks": _mail.checks(design)})
    if tail == ["test"] and method == "POST":
        if not g.get("refresh"):
            raise err(400, "not_connected", "Connect Gmail first.")
        body = await w.read_json(request, 120 * 1024)
        to = H("clean_str")(body.get("to"), 120)
        if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", to):
            raise err(400, "bad_request", "Type a valid test address.")
        try:
            design = _mail.clean_design(body.get("design"))
        except ValueError as ex:
            raise err(400, "bad_design", str(ex))
        tpl = {"design": design, "subject": "[Test] " + (H("clean_str")(body.get("subject"), 140) or "Rex email")}
        ok = await _send_one(w, g, tpl, session["user"]["id"], to, session["user"]["name"], origin)
        if g.get("at"):
            await w.store.put("email:gmail", g)
        if not ok:
            raise err(502, "gmail_failed", "Gmail didn't accept the test. Try connecting Gmail again.")
        return jr({"ok": True})
    if tail == ["send"] and method == "POST":
        if not g.get("refresh"):
            raise err(400, "not_connected", "Connect Gmail first.")
        body = await w.read_json(request, 64 * 1024)
        day_key = "email:day:" + time.strftime("%Y-%m-%d", time.gmtime())
        day = await w.store.get(day_key) or {"n": 0}
        cid = body.get("cid")
        if not cid:   # start a campaign from a saved email
            tid = str(body.get("tpl") or "")
            tpl = await w.store.get("email:tpl:" + tid) if re.match(r"^[a-f0-9]{12}$", tid) else None
            if not tpl:
                raise err(404, "not_found", "Save the email first, then send it.")
            aud = body.get("audience")
            recips = []
            if aud == "test":
                to = H("clean_str")(body.get("test_to"), 120)
                if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", to):
                    raise err(400, "bad_request", "Type a valid test address.")
                recips = [{"key": session["user"]["id"], "e": to, "n": session["user"]["name"]}]
            elif aud in ("everyone", "essential", "people") or (isinstance(aud, str) and aud.startswith("tag:")):
                users = await w.all_users()
                if aud == "people":
                    want = [H("clean_str")(x, 220) for x in (body.get("users") or [])[:500]]
                    ids = {x for x in want if re.match(r"^\d{15,25}$", x)}
                    for uid in ids:
                        u = users.get(uid)
                        if u and u.get("e") and uid not in w.owner_ids():
                            recips.append({"key": uid, "e": u["e"], "n": u.get("n", "")})
                    for x in want:
                        if EMAIL_RE.match(x):
                            ext = await w.store.get(_ext_key(x)) or {}
                            if (ext.get("ep") or {}).get("update") is not False:
                                recips.append({"key": x, "e": x, "n": ""})
                else:
                    for uid, u in users.items():
                        if uid not in w.owner_ids() and eligible(u, aud):
                            recips.append({"key": uid, "e": u["e"], "n": u.get("n", "")})
            else:
                raise err(400, "bad_request", "Pick who to send it to.")
            if not recips:
                raise err(400, "no_audience", "Nobody matches that audience (people need an email on file and must not have turned that kind of email off).")
            cid = secrets.token_hex(6)
            camp = {"id": cid, "tpl": tid, "name": tpl["name"], "subject": tpl["subject"], "design": tpl["design"], "aud": aud, "total": len(recips), "pos": 0, "sent": 0,
                    "failed": 0, "started": H("now")(), "done": False}
            await w.store.put("email:c:" + cid, dict(camp, recips=recips), ttl=60 * 60 * 24 * 14)
        c = await w.store.get("email:c:" + cid) if re.match(r"^[a-f0-9]{12}$", str(cid)) else None
        if not c:
            raise err(404, "not_found", "Campaign not found.")
        left = DAILY_CAP - day["n"]
        sent_now = 0
        for r in c["recips"][c["pos"]:c["pos"] + BATCH]:
            if left <= 0:
                break
            ok = await _send_one(w, g, c, r.get("key") or r.get("uid"), r["e"], r["n"], origin)
            c["pos"] += 1
            left -= 1
            sent_now += 1
            c["sent" if ok else "failed"] += 1
        day["n"] += sent_now
        await w.store.put(day_key, day, ttl=60 * 60 * 36)
        c["done"] = c["pos"] >= c["total"]
        paused = left <= 0 and not c["done"]
        await w.store.put("email:c:" + cid, c, ttl=60 * 60 * 24 * 14)
        row = {k: c.get(k) for k in ("id", "name", "subject", "aud", "total", "sent", "failed", "started", "done")}
        camps = [x for x in (await w.store.get("email:camps") or []) if x["id"] != cid]
        camps.insert(0, row)
        await w.store.put("email:camps", camps[:30])
        if c["done"] and c.get("tpl"):
            t = await w.store.get("email:tpl:" + c["tpl"])
            if t:
                t["sent"] = int(t.get("sent", 0)) + c["sent"]
                await w.store.put("email:tpl:" + t["id"], t)
        if g.get("at"):
            await w.store.put("email:gmail", g)
        return jr({"cid": cid, "pos": c["pos"], "total": c["total"], "sent": c["sent"], "failed": c["failed"], "done": c["done"], "paused": paused})
    raise err(404, "not_found", "Not found.")


# =====================================================================================================================
# Pages (beta): owner-made custom pages at /pages/<name>, edited in the same builder as emails
# =====================================================================================================================
PAGE_NAME = re.compile(r"^[a-z0-9][a-z0-9-]{1,39}$")
MAX_PAGES = 60
_SITE = "https://site.invalid"


def _page_design(raw):
    """Same rules as an email design, plus: empty colours mean 'follow the website theme', and links may point to pages on this site (/premium)."""
    if not isinstance(raw, dict):
        raise ValueError("The page design is not valid.")
    raw = json.loads(json.dumps(raw))
    for e in raw.get("els") or []:
        if isinstance(e, dict):
            for k in ("url", "src", "img"):
                v = str(e.get(k) or "")
                if k == "url" and v.startswith("/") and not v.startswith("//") and len(v) < 200 and " " not in v:
                    e[k] = _SITE + v
    keep = {k: str(raw.get(k) or "") for k in ("bg", "page", "color", "link")}
    d = _mail.clean_design(raw)
    for k, v in keep.items():
        d[k] = v if re.match(r"^#[0-9a-fA-F]{6}$", v) else ""
    for e in d["els"]:
        if e.get("url", "").startswith(_SITE):
            e["url"] = e["url"][len(_SITE):]
    src = {str(e.get("id")): e for e in raw.get("els") or [] if isinstance(e, dict)}
    for e in d["els"]:
        if e["t"] == "button":
            r = src.get(e["id"], {})
            if not str(r.get("bg") or "").strip():
                e["bg"] = ""
            if not str(r.get("color") or "").strip():
                e["color"] = ""
    d["w"] = max(320, min(1100, H("clean_int")(raw.get("w"), 800)))
    return d


async def _page_beta(w, session):
    site = await w.get_site()
    uid = session["user"]["id"] if session else None
    if not w.beta_on(site, "pages", uid):
        raise H("HttpError")(404, "not_found", "This page doesn't exist.")


async def pages_public(w, request, path, session):
    """GET /api/pages/<name>"""
    name = path[len("/api/pages/"):]
    if not PAGE_NAME.match(name):
        raise H("HttpError")(404, "not_found", "This page doesn't exist.")
    await _page_beta(w, session)
    p = await w.store.get("page:" + name)
    if not p:
        raise H("HttpError")(404, "not_found", "This page doesn't exist.")
    return H("json_response")({"name": p["name"], "title": p["title"], "hide_nav": bool(p.get("hide_nav")), "design": p["design"], "fonts": _fonts()})


async def pages_owner_route(w, request, url, path, method, session):
    err, jr = H("HttpError"), H("json_response")
    tail = path.split("/")[4:]  # /api/owner/pages/...
    if tail == [] and method == "GET":
        return jr({"items": await w.store.get("pages:idx") or [], "max": MAX_PAGES})
    if len(tail) == 1 and PAGE_NAME.match(tail[0]):
        name = tail[0]
        if method == "GET":
            p = await w.store.get("page:" + name)
            if not p:
                raise err(404, "not_found", "That page doesn't exist.")
            return jr(p)
        w.check_mutation(request, url, session)
        idx = await w.store.get("pages:idx") or []
        if method == "PUT":
            body = await w.read_json(request, 600 * 1024)
            if not isinstance(body, dict):
                raise err(400, "bad_request", "Expected an object.")
            existing = await w.store.get("page:" + name)
            if not existing and len(idx) >= MAX_PAGES:
                raise err(400, "limit", "You can have up to %d pages." % MAX_PAGES)
            try:
                design = _page_design(body.get("design"))
            except ValueError as e:
                raise err(400, "bad_design", str(e))
            p = {"name": name, "title": H("clean_str")(body.get("title"), 80) or name, "hide_nav": bool(body.get("hide_nav")), "design": design, "updated": H("now")(),
                 "created": (existing or {}).get("created") or H("now")()}
            await w.store.put("page:" + name, p)
            idx = [r for r in idx if r["name"] != name]
            idx.insert(0, {"name": name, "title": p["title"], "hide_nav": p["hide_nav"], "updated": p["updated"]})
            await w.store.put("pages:idx", idx)
            return jr({"ok": True, "name": name})
        if method == "DELETE" or (method == "POST" and False):
            await w.store.delete("page:" + name)
            await w.store.put("pages:idx", [r for r in idx if r["name"] != name])
            return jr({"ok": True})
    raise err(404, "not_found", "Not found.")
