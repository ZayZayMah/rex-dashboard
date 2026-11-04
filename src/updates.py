"""
Updates: the public /updates page, plus premade (editable) pages and emails that follow the same data.

Where entries come from (merged by id, so nothing is ever started from scratch):
  * public/data/changelog.json - shipped with every website deploy
  * the bot - POST /api/bot/updates with its own changelog
  * owners - edited by hand in Owner > Updates
New features are kept for 30 days (at most 24; pinned ones stay), bug fixes for 30 days (at most 60).

Premade pages  (/pages/updates, /pages/bug-fixes, /pages/<topic>) and premade emails ("What's new", "Bug fixes") are
regenerated from the data on every change, until an owner edits one by hand. A hand-edited one is "detached": it stops
changing by itself until the owner presses "Follow updates again".
"""
import hashlib
import json
import re
import time

import features
import mail as _mail

H = features.H
DAY = 86400
KEEP_DAYS = 30
MAX_FEATURES = 24
MAX_FIXES = 60
CHECK_EVERY = 45
TOPIC = re.compile(r"^[a-z0-9][a-z0-9-]{1,39}$")
PAGE_FEATURES, PAGE_FIXES = "updates", "bug-fixes"
EMAIL_IDS = {"features": "feed00feed01", "fixes": "feed00feed02"}
EMAIL_TAG = {"features": "new_features", "fixes": "bug_fixes"}
KEY = "updates:data"


def _s(v, n):
    return re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", str(v or "")).strip()[:n]


def _today():
    return time.strftime("%Y-%m-%d", time.gmtime())


def _plain(t):
    t = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", str(t))
    return re.sub(r"[*`_]", "", t).strip()


def _brief(items, n=170):
    for it in items or []:
        t = _plain(it)
        if t:
            return t if len(t) <= n else t[: n - 1].rstrip() + "…"
    return ""


def _age_days(date):
    try:
        t = time.mktime(time.strptime(date[:10], "%Y-%m-%d"))
    except (ValueError, TypeError):
        return 0
    return max(0, (time.time() - t) / DAY)


# --------------------------------------------------------------------------------------------- data
def _blank():
    return {"features": [], "fixes": [], "seen": [], "intro": "", "site_build": "", "bot_build": "", "detached": {}, "hashes": {}, "origin": "", "synced": 0, "log": []}


async def load(w):
    d = await w.store.get(KEY)
    if not isinstance(d, dict):
        d = _blank()
    for k, v in _blank().items():
        d.setdefault(k, v)
    return d


def _clean_feature(e, source="site"):
    items = [_s(x, 300) for x in (e.get("items") or []) if _s(x, 300)][:12]
    topic = _s(e.get("topic"), 40).lower()
    out = {"id": _s(e.get("id"), 60), "date": _s(e.get("date"), 10) or _today(), "title": _s(e.get("title"), 90),
           "summary": _s(e.get("summary"), 220) or _brief(items), "topic": topic if TOPIC.match(topic) else "",
           "items": items, "source": _s(e.get("source"), 10) or source, "pinned": bool(e.get("pinned")), "big": bool(e.get("big"))}
    return out if out["id"] and out["title"] else None


def _merge(d, entries, source):
    """Add entries we haven't seen. Returns how many were added."""
    added = 0
    seen = set(d["seen"])
    for e in entries or []:
        if not isinstance(e, dict):
            continue
        eid = _s(e.get("id"), 60)
        if not eid or eid in seen:
            continue
        seen.add(eid)
        d["seen"].append(eid)
        kind = e.get("kind")
        fixes = [_s(x, 240) for x in (e.get("fixes") or []) if _s(x, 240)]
        if kind in ("minor", "fix"):
            fixes += [_plain(x)[:240] for x in (e.get("items") or []) if _plain(x)]
            e = dict(e, items=[])
        f = _clean_feature(dict(e, id=eid), source)
        if f and f["items"]:
            d["features"].append(f)
            added += 1
        for i, t in enumerate(fixes[:20]):
            d["fixes"].append({"id": f"{eid}:{i}", "date": _s(e.get("date"), 10) or _today(), "text": _plain(t), "source": source})
            added += 1
    d["seen"] = d["seen"][-600:]
    return added


def _prune(d):
    keep = []
    for f in sorted(d["features"], key=lambda x: (x["date"], x["id"]), reverse=True):
        if f.get("pinned") or _age_days(f["date"]) <= KEEP_DAYS:
            keep.append(f)
    free = [f for f in keep if not f.get("pinned")]
    pinned = [f for f in keep if f.get("pinned")]
    d["features"] = pinned + free[: max(0, MAX_FEATURES - len(pinned))]
    d["features"].sort(key=lambda x: (x["date"], x["id"]), reverse=True)
    d["fixes"] = sorted([x for x in d["fixes"] if _age_days(x["date"]) <= KEEP_DAYS], key=lambda x: (x["date"], x["id"]), reverse=True)[:MAX_FIXES]


async def _site_changelog(w, origin):
    try:
        res = await w.env.ASSETS.fetch(origin + "/data/changelog.json")
        return json.loads(await res.text())
    except Exception:
        return None


# --------------------------------------------------------------------------------------------- design builders
class _Stack:
    """Builds a free-placement design by stacking blocks top to bottom."""

    def __init__(self, width, pad, kind):
        self.W, self.pad, self.kind, self.y, self.els = width, pad, kind, pad, []

    def _h(self, text, size, width, lh=1.45):
        cpl = max(8, int(width / (size * 0.53)))
        lines = sum(max(1, -(-len(l) // cpl)) for l in str(text).split("\n"))
        return int(lines * size * lh + 6)

    def gap(self, n):
        self.y += n

    def text(self, text, size=16, bold=False, color="", gap=8, align="left", upper=False):
        w = self.W - 2 * self.pad
        h = self._h(text, size, w)
        self.els.append({"id": f"t{len(self.els)}", "t": "text", "name": "Text", "d": {"x": self.pad, "y": self.y, "w": w, "h": h}, "text": text, "size": size, "bold": bold,
                         "color": color, "align": align, "upper": upper, "lh": 1.45})
        self.y += h + gap

    def button(self, label, url, gap=14, bg="#2f8cff", w=200):
        self.els.append({"id": f"b{len(self.els)}", "t": "button", "name": "Button", "d": {"x": self.pad, "y": self.y, "w": w, "h": 40}, "label": label, "url": url, "bg": bg,
                         "color": "#ffffff", "radius": 10, "size": 15})
        self.y += 40 + gap

    def rule(self, gap=14):
        self.els.append({"id": f"r{len(self.els)}", "t": "rect", "name": "Divider", "d": {"x": self.pad, "y": self.y, "w": self.W - 2 * self.pad, "h": 2}, "bg": "#8a94a8" if self.kind == "page" else "#d9dfec"})
        self.y += 2 + gap

    def design(self, extra=None):
        h = self.y + self.pad
        d = {"v": 1, "w": self.W, "els": self.els, "dh": min(6000, h), "mh": min(4000, h + 200)}
        d.update(extra or {})
        return d


def _date_nice(date):
    try:
        return time.strftime("%d %b %Y", time.strptime(date[:10], "%Y-%m-%d"))
    except (ValueError, TypeError):
        return date


def _link(origin, kind, path):
    return (origin + path) if kind == "email" else path


def build_features(d, kind, origin, limit):
    st = _Stack(800 if kind == "page" else 600, 28 if kind == "page" else 24, kind)
    st.text("What's new in Rex", 30, True, gap=6)
    st.text(d.get("intro") or "The newest features, newest first. Each one links to a page with the details. Small fixes are listed at the bottom of the updates page.", 15, color="#6b7690", gap=14)
    st.rule()
    feats = d["features"][:limit]
    if not feats:
        st.text("Nothing new yet. Check back soon.", 16)
    for f in feats:
        st.text(f"{_date_nice(f['date'])} · {'Big update' if f.get('big') else 'New'}", 12, True, "#2f8cff", gap=2, upper=True)
        st.text(f["title"], 20, True, gap=4)
        if f.get("summary"):
            st.text(f["summary"], 15, gap=8)
        if f.get("topic"):
            st.button("Read more", _link(origin, kind, "/pages/" + f["topic"]), gap=10, w=140)
        st.rule(10)
    if len(d["features"]) > len(feats):
        st.text(f"{len(d['features']) - len(feats)} more update(s) are on the updates page.", 14, color="#6b7690")
    st.button("See all updates", _link(origin, kind, "/updates"), gap=6, w=180)
    return st.design({"pre": "The newest features in Rex"} if kind == "email" else {})


def build_fixes(d, kind, origin, limit):
    st = _Stack(800 if kind == "page" else 600, 28 if kind == "page" else 24, kind)
    st.text("Bug fixes and small improvements", 28, True, gap=6)
    st.text("Everything we fixed recently, newest first.", 15, color="#6b7690", gap=14)
    st.rule()
    fixes = d["fixes"][:limit]
    if not fixes:
        st.text("No fixes listed yet.", 16)
    by = {}
    for x in fixes:
        by.setdefault(x["date"], []).append(x["text"])
    for date, lines in by.items():
        st.text(_date_nice(date), 13, True, "#2f8cff", gap=4, upper=True)
        st.text("\n".join("• " + t for t in lines), 15, gap=14)
    st.button("All updates", _link(origin, kind, "/updates"), gap=6, w=160)
    return st.design({"pre": "Recent fixes in Rex"} if kind == "email" else {})


def build_topic(d, topic, kind, origin):
    feats = [f for f in d["features"] if f.get("topic") == topic]
    st = _Stack(800, 28, kind)
    title = feats[0]["title"] if len(feats) == 1 else topic.replace("-", " ").title()
    st.text(title, 30, True, gap=6)
    st.text(f"Latest changes to {topic.replace('-', ' ')}", 14, color="#6b7690", gap=14)
    st.rule()
    for f in feats:
        st.text(_date_nice(f["date"]), 12, True, "#2f8cff", gap=2, upper=True)
        if len(feats) > 1:
            st.text(f["title"], 20, True, gap=4)
        st.text("\n".join("• " + _plain(i) for i in f["items"]) or f["summary"], 15, gap=14)
    st.button("Open the Dashboard", "/dashboard", gap=8, w=200)
    st.button("All updates", "/updates", gap=6, w=160, bg="#4b5878")
    return st.design()


# --------------------------------------------------------------------------------------------- premade pages / emails
def _hash(obj):
    return hashlib.sha1(json.dumps(obj, sort_keys=True).encode()).hexdigest()[:12]


async def _write_page(w, name, title, design, premade_kind, d):
    now = H("now")()
    existing = await w.store.get("page:" + name)
    if existing and not existing.get("premade"):
        return False          # a page someone made themselves: never touch it
    design = features._page_design(design)
    p = {"name": name, "title": title, "hide_nav": False, "design": design, "updated": now, "created": (existing or {}).get("created") or now,
         "premade": premade_kind, "detached": False}
    await w.store.put("page:" + name, p)
    idx = [r for r in (await w.store.get("pages:idx") or []) if r["name"] != name]
    idx.insert(0, {"name": name, "title": title, "hide_nav": False, "updated": now, "premade": premade_kind, "detached": False})
    await w.store.put("pages:idx", idx)
    return True


async def _write_email(w, kind, name, subject, design, d):
    tid = EMAIL_IDS[kind]
    now = H("now")()
    prev = await w.store.get("email:tpl:" + tid) or {}
    tags = {t["id"] for t in await features.get_tags(w)}
    tag = EMAIL_TAG[kind]
    tpl = {"id": tid, "name": name, "subject": subject, "design": _mail.clean_design(design), "send_to": ("tag:" + tag) if tag in tags else "everyone",
           "send_when": "manual", "when_at": "now", "at_time": "09:00", "enabled": False, "updated": now, "sent": int(prev.get("sent", 0)), "premade": kind, "detached": False}
    if prev:
        for k in ("send_to", "send_when", "when_at", "at_time", "enabled"):
            tpl[k] = prev.get(k, tpl[k])      # keep the owner's sending choices
    await w.store.put("email:tpl:" + tid, tpl)
    idx = [t for t in (await w.store.get("email:tpls") or []) if t["id"] != tid]
    idx.insert(0, features._tpl_row(tpl))
    await w.store.put("email:tpls", idx)


async def regen(w, d, force=False):
    """Rebuild every premade page/email that still follows the updates (not hand-edited ones)."""
    origin = d.get("origin") or ""
    det, hashes = d["detached"], d["hashes"]
    jobs = [("page_features", "page", lambda: build_features(d, "page", origin, 16)),
            ("page_fixes", "page", lambda: build_fixes(d, "page", origin, 50)),
            ("email_features", "email", lambda: build_features(d, "email", origin, 12)),
            ("email_fixes", "email", lambda: build_fixes(d, "email", origin, 40))]
    for key, kind, fn in jobs:
        if det.get(key):
            continue
        design = fn()
        h = _hash(design)
        if hashes.get(key) == h and not force:
            continue
        if key == "page_features":
            await _write_page(w, PAGE_FEATURES, "Updates", design, "features", d)
        elif key == "page_fixes":
            await _write_page(w, PAGE_FIXES, "Bug fixes", design, "fixes", d)
        elif key == "email_features":
            await _write_email(w, "features", "Premade · What's new", "What's new in Rex", design, d)
        else:
            await _write_email(w, "fixes", "Premade · Bug fixes", "Recent fixes in Rex", design, d)
        hashes[key] = h
    for topic in sorted({f["topic"] for f in d["features"] if f.get("topic")}):
        key = "topic:" + topic
        if det.get(key) or topic in (PAGE_FEATURES, PAGE_FIXES):
            continue
        design = build_topic(d, topic, "page", origin)
        h = _hash(design)
        if hashes.get(key) == h and not force:
            continue
        existing = await w.store.get("page:" + topic)
        if existing and not existing.get("premade"):
            hashes[key] = h
            continue
        idx = await w.store.get("pages:idx") or []
        if not existing and len(idx) >= features.MAX_PAGES:
            continue
        feats = [f for f in d["features"] if f.get("topic") == topic]
        title = feats[0]["title"] if len(feats) == 1 else topic.replace("-", " ").title()
        await _write_page(w, topic, title, design, "topic", d)
        hashes[key] = h


async def sync(w, url, force=False, bot_entries=None):
    """Pull in new entries and refresh premade pages/emails. Cheap when nothing changed."""
    d = await load(w)
    now = time.time()
    if not force and bot_entries is None and now - d.get("synced", 0) < CHECK_EVERY:
        return d
    origin = w.public_origin(url)
    d["origin"] = origin
    changed = False
    if bot_entries:
        changed |= bool(_merge(d, bot_entries, "bot"))
    site = await _site_changelog(w, origin)
    if isinstance(site, dict):
        added = _merge(d, site.get("entries"), "site")
        changed |= bool(added)
        b = _s(site.get("build"), 20)
        if b and d["site_build"] != b:
            if d["site_build"] and not added:
                added = _merge(d, [{"id": "auto-site-" + b, "date": _today(), "kind": "minor", "items": ["Small fixes and improvements to the Rex website."]}], "site")
            d["site_build"] = b
            changed = True
    before = _hash([d["features"], d["fixes"]])
    _prune(d)
    changed |= before != _hash([d["features"], d["fixes"]])
    d["synced"] = now
    if changed or force:
        await regen(w, d, force)
    await w.store.put(KEY, d)
    return d


def public_view(d):
    return {"features": d["features"], "fixes": d["fixes"], "intro": d.get("intro", ""), "keep_days": KEEP_DAYS, "synced": int(d.get("synced", 0))}


# --------------------------------------------------------------------------------------------- routes
async def public_route(w, request, url, path, method):
    if path == "/api/updates" and method == "GET":
        d = await sync(w, url)
        return H("json_response")(public_view(d))
    raise H("HttpError")(404, "not_found", "Not found.")


async def bot_route(w, url, body):
    entries = body.get("entries") if isinstance(body, dict) else None
    if not isinstance(entries, list):
        raise H("HttpError")(400, "bad_request", "Expected entries.")
    d = await sync(w, url, force=True, bot_entries=entries[:60])
    return H("json_response")({"ok": True, "features": len(d["features"]), "fixes": len(d["fixes"])})


def _premade_state(d):
    det = d["detached"]
    return {"page_features": bool(det.get("page_features")), "page_fixes": bool(det.get("page_fixes")),
            "email_features": bool(det.get("email_features")), "email_fixes": bool(det.get("email_fixes"))}


async def owner_route(w, request, url, path, method, session):
    err, jr = H("HttpError"), H("json_response")
    tail = path.split("/")[4:]  # /api/owner/updates/...
    if tail == [] and method == "GET":
        d = await sync(w, url, force=True)
        return jr(dict(public_view(d), detached=_premade_state(d), pages=[PAGE_FEATURES, PAGE_FIXES], emails=EMAIL_IDS))
    w.check_mutation(request, url, session)
    if tail == [] and method == "PUT":
        body = await w.read_json(request, 200 * 1024)
        if not isinstance(body, dict):
            raise err(400, "bad_request", "Expected an object.")
        d = await load(w)
        feats = []
        for e in (body.get("features") or [])[:60]:
            if isinstance(e, dict):
                f = _clean_feature(e)
                if f:
                    feats.append(f)
        fixes = []
        for x in (body.get("fixes") or [])[:200]:
            if isinstance(x, dict) and _s(x.get("text"), 240):
                fixes.append({"id": _s(x.get("id"), 60) or "m" + _hash(x), "date": _s(x.get("date"), 10) or _today(), "text": _s(x.get("text"), 240), "source": "owner"})
        d["features"], d["fixes"] = feats, fixes
        d["intro"] = _s(body.get("intro"), 300)
        d["origin"] = w.public_origin(url)
        _prune(d)
        await regen(w, d)
        await w.store.put(KEY, d)
        return jr(dict(public_view(d), detached=_premade_state(d)))
    if tail == ["follow"] and method == "POST":
        body = await w.read_json(request, 2048)
        key = _s(body.get("item") if isinstance(body, dict) else "", 30)
        d = await load(w)
        if key not in _premade_state(d) and not key.startswith("topic:"):
            raise err(400, "bad_request", "Unknown item.")
        d["detached"].pop(key, None)
        d["origin"] = w.public_origin(url)
        d["hashes"].pop(key, None)
        await regen(w, d, force=True)
        await w.store.put(KEY, d)
        return jr({"ok": True, "detached": _premade_state(d)})
    raise err(404, "not_found", "Not found.")


async def mark_detached(w, kind, key):
    """Called when an owner saves a premade page/email by hand."""
    d = await load(w)
    d["detached"][key] = True
    await w.store.put(KEY, d)
