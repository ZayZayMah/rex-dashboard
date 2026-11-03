"""
Website applications ("Apply via website" ticket buttons).
  GET  /api/apply/<gid>/<tid>        the form (sign-in required)
  POST /api/apply/<gid>/<tid>        submit it; Rex posts a link to the answers in the server's mod log
  GET  /api/apply/result/<sid>       the answers (server staff and Rex owners only)
"""
import json
import re
import secrets
import time

import features

H = features.H
KEEP = 90 * 86400
SNOW = re.compile(r"^\d{15,25}$")


def _find(guild, tid):
    """Returns a normalised form {label, mode, apply:{...}} for a website application, or None."""
    vals = (guild or {}).get("values") or {}
    for f in vals.get("application_forms") or []:
        if isinstance(f, dict) and f.get("id") == tid and f.get("mode") == "web":
            return {"id": tid, "label": f.get("name") or f.get("what"), "apply": f}
    pools = [vals.get("premium_ticket_panels") or []]
    for p in vals.get("ticket_panels") or []:
        if isinstance(p, dict):
            pools.append(p.get("types") or [])
    for pool in pools:
        for t in pool:
            if isinstance(t, dict) and t.get("id") == tid and t.get("action") == "apply_web" and isinstance(t.get("apply"), dict):
                return t
    return None


async def _record(w, gid, tid, uid):
    return await w.store.get(f"apply:n:{gid}:{tid}:{uid}") or {"n": 0, "last": 0}


def _limit(t, rec):
    a = t["apply"]
    mx = int(a.get("max_per_person", 1) or 0)
    if mx and rec["n"] >= mx:
        return f"You have already sent {rec['n']} application(s) for this. The limit here is {mx}."
    wait = float(a.get("cooldown_hours", 24) or 0) * 3600
    if wait and rec["n"] and time.time() - rec["last"] < wait:
        left = int((wait - (time.time() - rec["last"])) // 60) + 1
        return f"You can apply again in about {left // 60}h {left % 60}m."
    return ""


async def route(w, request, url, path, method, session):
    err, jr = H("HttpError"), H("json_response")
    parts = path.split("/")  # ['', 'api', 'apply', ...]
    tail = parts[3:]
    uid = session["user"]["id"]

    if len(tail) == 2 and tail[0] == "result" and method == "GET":
        sid = tail[1]
        if not re.match(r"^[a-f0-9]{8,32}$", sid):
            raise err(404, "not_found", "Application not found.")
        rec = await w.store.get("apply:r:" + sid)
        if not rec:
            raise err(404, "not_found", "That application was not found (they are kept for 90 days).")
        if not w.owner_mode(session):
            w.guild_access(session, rec["gid"])
        return jr(rec)

    if len(tail) == 2 and SNOW.match(tail[0]) and re.match(r"^[a-z0-9]{4,12}$", tail[1]):
        gid, tid = tail
        guild = await w.store.get("guild:" + gid)
        t = _find(guild, tid)
        if not t:
            raise err(404, "not_found", "This application form doesn't exist (or isn't open).")
        a = t["apply"]
        rec = await _record(w, gid, tid, uid)
        if method == "GET":
            return jr({"guild": guild["name"], "title": t.get("label"), "what": a.get("what") or t.get("label"),
                       "questions": [{"q": q["q"], "kind": q.get("kind", "short"), "required": bool(q.get("required", True)), "options": q.get("options") or [], "min_len": int(q.get("min_len") or 0)} for q in a.get("questions", [])],
                       "blocked": _limit(t, rec)})
        if method == "POST":
            w.check_mutation(request, url, session)
            if H("rate_limited")("apply:" + uid, 6, 3600):
                raise err(429, "slow_down", "Too many attempts. Please wait a while.")
            bad = _limit(t, rec)
            if bad:
                raise err(429, "limit", bad)
            body = await w.read_json(request, 64 * 1024)
            given = body.get("answers") if isinstance(body, dict) else None
            qs = a.get("questions", [])
            if not isinstance(given, list) or len(given) != len(qs):
                raise err(400, "bad_request", "Please answer the questions on the page.")
            answers = []
            for q, v in zip(qs, given):
                v = v if isinstance(v, str) else ""
                v = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", v).strip()
                if q.get("kind") == "choice":
                    if v and v not in (q.get("options") or []):
                        raise err(400, "bad_request", f"Pick one of the options for: {q['q'][:60]}")
                if not v and q.get("required", True):
                    raise err(400, "bad_request", f"Please answer: {q['q'][:80]}")
                lo = int(q.get("min_len") or 0)
                if v and lo and len(v) < lo and q.get("kind") != "choice":
                    raise err(400, "bad_request", f"Your answer must be at least {lo} characters (yours is {len(v)}): {q['q'][:60]}")
                if len(v) > (4000 if q.get("kind") == "long" else 500):
                    raise err(400, "bad_request", f"Your answer is too long: {q['q'][:60]}")
                answers.append(v)
            sid = secrets.token_hex(8)
            user = session["user"]
            await w.store.put("apply:r:" + sid, {"sid": sid, "gid": gid, "tid": tid, "guild": guild["name"], "title": t.get("label"), "what": a.get("what") or t.get("label"),
                                                  "uid": uid, "name": user.get("name", ""), "avatar_url": user.get("avatar_url", ""), "ts": int(time.time()),
                                                  "rows": [{"q": q["q"], "kind": q.get("kind", "short"), "a": ans} for q, ans in zip(qs, answers)]}, ttl=KEEP)
            await w.store.put(f"apply:n:{gid}:{tid}:{uid}", {"n": rec["n"] + 1, "last": time.time()}, ttl=KEEP * 4)
            try:
                await w.enqueue(gid, {"id": secrets.token_hex(6), "ts": H("now")(), "by": uid, "byname": user.get("name", ""), "op": "apply_submit", "gid": gid,
                                      "args": {"sid": sid, "uid": uid, "tid": tid}})
            except Exception:
                pass  # the answers are saved; staff can still open the link from the owner tools
            return jr({"ok": True, "sid": sid})
    return None
