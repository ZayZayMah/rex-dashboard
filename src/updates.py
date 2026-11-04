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
def _date_nice(date):
    try:
        return time.strftime("%d %b %Y", time.strptime(date[:10], "%Y-%m-%d"))
    except (ValueError, TypeError):
        return date


# Colours: the Rex dark look, so pages and emails match the website.
C = {"card": "#101c34", "card2": "#14264a", "hero": "#12264a", "line": "#22407a", "acc": "#2f8cff", "text": "#eaf1ff", "muted": "#93a4c8",
     "pill": "#1b3463", "deep": "#0c1630"}
ACCENTS = ["#2f8cff", "#8b6dff", "#2fd18b", "#ffb84d", "#ff6fa5"]
ACC_DARK = ["#16407f", "#3a2f7a", "#14604a", "#6b4a16", "#6b2a45"]


def _lead_emoji(items, default="✨"):
    for it in items or []:
        t = str(it).strip()
        if t and not t[0].isalnum() and t[0] not in "*`[(":
            return t[0] if ord(t[0]) < 0xFE00 else t[:2].strip()[:2]
    return default


def _month_day(date):
    try:
        t = time.strptime(date[:10], "%Y-%m-%d")
        return time.strftime("%d", t).lstrip("0") or "1", time.strftime("%b", t).upper()
    except (ValueError, TypeError):
        return "•", ""


class _Canvas:
    def __init__(self, W, kind, mobile):
        self.W, self.kind, self.mobile, self.els = W, kind, mobile, []

    def th(self, text, size, width, lh=1.5):
        cpl = max(6, int(width / (size * 0.56)))
        lines = sum(max(1, -(-len(p) // cpl)) for p in str(text).split("\n"))
        return int(lines * size * lh + 4)

    def _add(self, e):
        e["id"] = f"e{len(self.els)}"
        self.els.append(e)
        return e

    def rect(self, x, y, w, h, bg, radius=0, bc="", bw=0, name="Box", decor=False):
        if decor and self.kind == "email":
            return None            # decoration only exists on pages (emails stay lean)
        e = self._add({"t": "rect", "name": name, "d": {"x": round(x), "y": round(y), "w": round(w), "h": round(h)}, "bg": bg, "radius": radius, "bw": bw, "bc": bc or "#000000"})
        e["_decor"] = decor
        return e

    def text(self, x, y, w, text, size=16, bold=False, color="", align="left", upper=False, ls=0, h=None, va="top", lh=1.5, name="Text"):
        h = h if h is not None else self.th(text, size, w, lh)
        self._add({"t": "text", "name": name, "d": {"x": round(x), "y": round(y), "w": round(w), "h": round(h)}, "text": text, "size": size, "bold": bold,
                   "color": color or C["text"], "align": align, "upper": upper, "ls": ls, "va": va, "lh": lh, "_decor": False})
        return h

    def image(self, x, y, w, h, src, alt="", radius=0):
        self._add({"t": "image", "name": "Logo", "d": {"x": round(x), "y": round(y), "w": round(w), "h": round(h)}, "src": src, "alt": alt, "fit": "auto", "radius": radius, "_decor": False})

    def pill(self, x, y, w, label, bg=None, color=None, size=13, h=30, bold=True):
        self.rect(x, y, w, h, bg or C["pill"], 99, name="Pill")
        self.text(x, y, w, label, size, bold, color or C["text"], "center", h=h, va="middle", lh=1.2, name="Pill text")

    def lk(self, origin, path):
        """Pages link inside the site; emails need the full address."""
        return path if self.kind == "page" else origin + path

    def result(self, extra=None):
        H = max((e["d"]["y"] + e["d"]["h"]) for e in self.els) + (24 if self.mobile else 40)
        d = {"v": 1, "w": self.W, "els": self.els, "dh": min(6000, H), "mh": min(4000, H), "font": "inter" if self.kind == "page" else "arial"}
        d.update(extra or {})
        return d


def _hero(cv, d, which, origin, y, pad, inner, stack, counts):
    """The big banner: logo, title, pills and a couple of decorative circles."""
    mob = cv.mobile
    pad_in = 20 if stack else 32
    title = {"features": "What's new in Rex", "fixes": "Bug fixes and small improvements"}[which]
    sub = d.get("intro") or ("The newest features, newest first. Small fixes are at the bottom." if which == "features" else "Everything we fixed recently, newest first.")
    eyebrow = "REX · UPDATE LOG" if which == "features" else "REX · FIXES"
    logo = 56 if stack else 84
    tsize = 26 if mob else (30 if stack else 46)
    tw = inner - 2 * pad_in - (0 if stack else 430)
    h_title = cv.th(title, tsize, tw, 1.15)
    h_sub = cv.th(sub, 15 if stack else 17, tw)
    pills = [f"✨ {counts[0]} new", f"🛠 {counts[1]} fixes", "Updated " + _date_nice(_today())[:6]] if which == "features" else [f"🛠 {counts[1]} fixes", "Updated " + _date_nice(_today())[:6]]
    top = y + pad_in
    head_h = logo + 16 + 18 + h_title + 8 + h_sub
    hh = pad_in * 2 + head_h + (50 if stack else 56)
    hh = max(hh, 250 if not stack else 0)
    cv.rect(pad, y, inner, hh, C["hero"], 28 if not stack else 20, "#2f8cff", 2, "Banner")
    if not stack:        # decorative circles on the right
        cv.rect(pad + inner - 330, y - 0 + 18, 250, 250 if hh >= 270 else hh - 36, "#16407f", 999, name="Circle", decor=True)
        cv.rect(pad + inner - 170, y + hh - 150, 120, 120, "#3a2f7a", 999, name="Circle", decor=True)
        cv.rect(pad + inner - 400, y + 34, 38, 38, "#2fd18b", 999, name="Dot", decor=True)
    else:
        for nm in ("Circle", "Circle", "Dot"):
            cv.rect(pad + inner - 30, y + hh - 30, 8, 8, C["hero"], 0, name=nm, decor=True)
    cv.image(pad + pad_in, top, logo, logo, "{logo_url}", "Rex", 18)
    ey_x = pad + pad_in + logo + 14
    cv.text(ey_x, top + (logo - 18) // 2, inner - 2 * pad_in - logo - 14, eyebrow, 13, True, "#5aa9ff", upper=True, ls=3, h=18)
    cy = top + logo + 16
    cv.text(pad + pad_in, cy, tw, title, tsize, True, h=h_title, lh=1.15)
    cy += h_title + 8
    cv.text(pad + pad_in, cy, tw, sub, 15 if stack else 17, False, C["muted"], h=h_sub)
    # pills
    if stack:
        px, py = pad + pad_in, cy + h_sub + 14
        for p in pills:
            w = 14 + len(p) * 8
            cv.pill(px, py, w, p, size=12, h=26)
            px += w + 8
    else:
        px = pad + inner - 330 + 0
        py = y + hh - 62
        px = pad + pad_in
        py = y + hh - pad_in - 30
        for p in pills:
            w = 20 + len(p) * 9
            cv.pill(px, py, w, p)
            px += w + 10
    return y + hh


def _feature_card(cv, f, i, x, y, w, origin, span_h=None, big=False):
    """One feature card. Returns its height."""
    acc, accd = ACCENTS[i % 5], ACC_DARK[i % 5]
    pad = 22
    tw = w - 2 * pad
    link = f" [Read more →]({cv.lk(origin, '/pages/' + f['topic'])})" if f.get("topic") else ""
    summary = (f.get("summary") or "") + link
    items = [("• " + _plain(it)) for it in (f.get("items") or [])[:2]]
    bullets = "\n".join(items)
    size_t = 24 if big else 20
    h = 6 + 18 + 44 + 10 + cv.th(f["title"], size_t, tw, 1.2) + 6 + cv.th(summary, 15, tw) + (8 + cv.th(bullets, 14, tw) if bullets else 0) + 20
    if span_h:
        h = max(h, span_h)
    cv.rect(x, y, w, h, C["card"], 20, C["line"], 1, "Card")
    cv.rect(x + 14, y + 12, w - 28, 6, acc, 3, name="Colour bar")
    cy = y + 30
    cv.rect(x + pad, cy, 44, 44, accd, 999, name="Icon circle")
    cv.text(x + pad, cy, 44, _lead_emoji(f.get("items")), 22, False, align="center", h=44, va="middle", lh=1.0, name="Icon")
    cv.text(x + pad + 56, cy + 2, tw - 56 - (110 if f.get("topic") else 0), _date_nice(f["date"]) + (" · BIG" if f.get("big") else ""), 12, True, acc, upper=True, ls=1, h=18, name="Date")
    if f.get("topic"):
        label = "#" + f["topic"][:14]
        cv.pill(x + w - pad - 104, cy, 104, label, bg=C["pill"], color=C["muted"], size=11, h=24, bold=False)
    cy += 44 + 10
    ht = cv.th(f["title"], size_t, tw, 1.2)
    cv.text(x + pad, cy, tw, f["title"], size_t, True, h=ht, lh=1.2)
    cy += ht + 6
    hs = cv.th(summary, 15, tw)
    cv.text(x + pad, cy, tw, summary, 15, False, "#c8d6f5", h=hs)
    cy += hs + 8
    if bullets:
        cv.text(x + pad, cy, tw, bullets, 14, False, C["muted"], h=cv.th(bullets, 14, tw))
    return h


def _featured(cv, f, x, y, w, stack, origin):
    """The newest feature: a large card with a date circle on the right (or below on narrow layouts)."""
    pad = 28 if not stack else 20
    panel = 0 if stack else 320
    lw = w - panel
    tw = lw - 2 * pad
    link = f" [Read more →]({cv.lk(origin, '/pages/' + f['topic'])})" if f.get("topic") else ""
    summary = (f.get("summary") or "") + link
    bullets = "\n".join("• " + _plain(it) for it in (f.get("items") or [])[:5])
    tsize = 34 if not stack else 24
    ht, hs, hb = cv.th(f["title"], tsize, tw, 1.15), cv.th(summary, 17 if not stack else 15, tw), cv.th(bullets, 15, tw)
    h = pad + 30 + 14 + ht + 10 + hs + (12 + hb if bullets else 0) + pad + (0 if not stack else 110)
    h = max(h, 300 if not stack else 0)
    cv.rect(x, y, w, h, C["card2"], 28 if not stack else 20, "#2f8cff", 2, "Featured card")
    cy = y + pad
    cv.pill(x + pad, cy, 170 if f.get("big") else 90, "🚀 BIG UPDATE" if f.get("big") else "✨ NEW", bg="#2f8cff", color="#ffffff", size=12, h=28)
    cy += 28 + 16
    cv.text(x + pad, cy, tw, f["title"], tsize, True, h=ht, lh=1.15)
    cy += ht + 10
    cv.text(x + pad, cy, tw, summary, 17 if not stack else 15, False, "#d5e1fb", h=hs)
    cy += hs + 12
    if bullets:
        cv.text(x + pad, cy, tw, bullets, 15, False, C["muted"], h=hb)
    day, mon = _month_day(f["date"])
    if stack:
        by = y + h - 100
        cv.rect(x + w - 30, y + h - 30, 8, 8, C["card2"], 0, name="Ring", decor=True)
        cv.rect(x + pad, by, 80, 80, "#2f8cff", 999, name="Date circle")
        cv.text(x + pad, by + 8, 80, day, 32, True, "#ffffff", "center", h=40, lh=1.0, name="Day")
        cv.text(x + pad, by + 46, 80, mon, 13, True, "#dbe9ff", "center", h=18, ls=2, name="Month")
    else:
        cx = x + lw + (panel - 230) // 2
        cy2 = y + (h - 230) // 2
        cv.rect(cx - 14, cy2 - 14, 258, 258, "#1b3d7a", 999, name="Ring")
        cv.rect(cx, cy2, 230, 230, "#2f8cff", 999, name="Date circle")
        cv.text(cx, cy2 + 50, 230, day, 84, True, "#ffffff", "center", h=96, lh=1.0, name="Day")
        cv.text(cx, cy2 + 150, 230, mon + " " + f["date"][:4], 18, True, "#dbe9ff", "center", h=24, ls=3, name="Month")
    return h


def _fixes_block(cv, d, x, y, w, cols, limit, origin, heading="🛠 Minor updates and bug fixes"):
    pad = 26 if cols > 1 else 18
    gap = 24
    cw = (w - 2 * pad - gap * (cols - 1)) // cols
    groups = {}
    for fx in d["fixes"][:limit]:
        groups.setdefault(fx["date"], []).append(fx["text"])
    cy0 = y + pad
    hh = cv.th(heading, 24 if cols > 1 else 20, w - 2 * pad, 1.2)
    colh = [0] * cols
    place = []
    for date, lines in groups.items():
        txt = "\n".join("• " + t for t in lines)
        gh = 30 + 8 + cv.th(txt, 14, cw)
        c = colh.index(min(colh))
        place.append((c, colh[c], date, txt, gh))
        colh[c] += gh + 18
    if not groups:
        txt = "No fixes listed yet."
        place.append((0, 0, "", txt, cv.th(txt, 14, cw)))
        colh[0] = place[0][4]
    total = pad + hh + 16 + max(colh) + pad
    cv.rect(x, y, w, total, C["deep"], 24, C["line"], 1, "Fixes box")
    cv.text(x + pad, cy0, w - 2 * pad, heading, 24 if cols > 1 else 20, True, h=hh, lh=1.2)
    for c, off, date, txt, gh in place:
        gx = x + pad + c * (cw + gap)
        gy = cy0 + hh + 16 + off
        if date:
            cv.pill(gx, gy, 118, _date_nice(date), bg=C["pill"], color="#8ec1ff", size=12, h=28)
        cv.text(gx, gy + 36, cw, txt, 14, False, "#c8d6f5", h=cv.th(txt, 14, cw))
    return y + total


def compose(d, which, kind, W, stack, mobile, origin, cap=None):
    """Lay out the whole thing. The same call with a phone width gives the mobile version (same elements, different boxes)."""
    cv = _Canvas(W, kind, mobile)
    pad = 16 if mobile else (24 if stack else 40)
    inner = W - 2 * pad
    feats = d["features"]
    fixes_n = len(d["fixes"])
    y = _hero(cv, d, which, origin, pad, pad, inner, stack, (len(feats), fixes_n))
    y += 20
    gap = 18
    if which == "features":
        lim_f = (cap or {}).get("features", 9)
        shown = feats[:lim_f]
        if not shown:
            cv.text(pad, y, inner, "Nothing new yet. Check back soon.", 18, False, C["muted"])
            y += 40
        else:
            y += _featured(cv, shown[0], pad, y, inner, stack, origin) + gap
            rest = shown[1:]
            i = 0
            cols = 1 if stack else 3
            spans = [1, 1, 1, 2, 1, 1, 2] if cols == 3 else [1]
            si = 0
            while i < len(rest):
                row, used = [], 0
                while i < len(rest) and used < cols:
                    sp = min(spans[si % len(spans)], cols - used)
                    if used + sp > cols:
                        break
                    row.append((rest[i], sp, i))
                    used += sp
                    i += 1
                    si += 1
                cw = (inner - gap * (cols - 1)) / cols
                if used < cols and row and i >= len(rest):      # last row: stretch the final card so there is no hole
                    f_, sp_, k_ = row[-1]
                    row[-1] = (f_, sp_ + cols - used, k_)
                # measure first, so every card in the row is as tall as the tallest
                dry = _Canvas(W, kind, mobile)
                hmax = max(_feature_card(dry, f, k, 0, 0, cw * sp + gap * (sp - 1), origin) for f, sp, k in row)
                x = pad
                for f, sp, k in row:
                    w = cw * sp + gap * (sp - 1)
                    _feature_card(cv, f, k, x, y, w, origin, span_h=hmax)
                    x += w + gap
                y += hmax + gap
        y = _fixes_block(cv, d, pad, y, inner, 1 if stack else 2, (cap or {}).get("fixes", 12), origin) + gap
    else:
        y = _fixes_block(cv, d, pad, y, inner, 1 if stack else 3, (cap or {}).get("fixes", 60), origin, "🛠 Everything we fixed") + gap
    foot = f"♥ by Rex Team   ·   [All updates]({cv.lk(origin, '/updates')})"
    cv.text(pad, y + 4, inner, foot, 14, False, C["muted"], "center", h=24)
    return cv


def _finish(desktop, mobile_cv, extra):
    d = desktop.result(extra)
    if mobile_cv is not None:
        for e, m in zip(d["els"], mobile_cv.els):
            e["m"] = dict(m["d"], hide=bool(m.get("_decor")))
            if m["t"] == "text" and m["size"] != e["size"]:
                e["m"]["size"] = m["size"]
    for e in d["els"]:
        e.pop("_decor", None)
    return d


def build_page(d, which, origin):
    cap = {"features": 7, "fixes": 10 if which == "features" else 40}
    desk = compose(d, which, "page", 1280, False, False, origin, cap)
    mob = compose(d, which, "page", 360, True, True, origin, cap)
    return _finish(desk, mob, {"fill": True})


def build_email(d, which, origin):
    cv = compose(d, which, "email", 640, True, False, origin, {"features": 3, "fixes": 4})
    out = _finish(cv, None, {"bg": "#050a14", "page": "#0a1222", "color": "#eaf1ff", "link": "#5aa9ff", "radius": 22, "outer": 20,
                             "pre": "The newest features in Rex" if which == "features" else "Recent fixes in Rex", "dark": "off"})
    return out


def build_topic(d, topic, origin):
    feats = [f for f in d["features"] if f.get("topic") == topic]
    sub = dict(d, features=feats, intro=f"Latest changes to {topic.replace('-', ' ')}", fixes=[])

    def one(W, stack, mobile):
        cv = _Canvas(W, "page", mobile)
        pad = 16 if mobile else (24 if stack else 40)
        inner = W - 2 * pad
        title = feats[0]["title"] if len(feats) == 1 else topic.replace("-", " ").title()
        hero_d = dict(sub, intro=sub["intro"])
        saved = {"features": "x"}
        y = _hero_topic(cv, title, sub["intro"], origin, pad, inner, stack)
        y += 20
        for i, f in enumerate(feats[:6]):
            y += _featured(cv, f, pad, y, inner, stack, origin) + 18 if i == 0 else _feature_card(cv, f, i, pad, y, inner, origin) + 18
        cv.text(pad, y + 4, inner, f"[Open the Dashboard →]({cv.lk(origin, '/dashboard')})   ·   [All updates]({cv.lk(origin, '/updates')})   ·   ♥ by Rex Team", 15, False, C["muted"], "center", h=24)
        return cv
    return _finish(one(1280, False, False), one(360, True, True), {"fill": True})


def _hero_topic(cv, title, sub, origin, pad, inner, stack):
    d = {"intro": sub, "features": [], "fixes": []}
    # reuse the banner with a custom title
    saved = {"features": title}
    class _D(dict):
        pass
    mob = cv.mobile
    tmp_which = "features"
    # temporarily inline the banner so the title can differ
    pad_in = 20 if stack else 32
    logo = 56 if stack else 84
    tsize = 26 if mob else (30 if stack else 46)
    tw = inner - 2 * pad_in - (0 if stack else 430)
    ht, hs = cv.th(title, tsize, tw, 1.15), cv.th(sub, 15 if stack else 17, tw)
    hh = max(pad_in * 2 + logo + 16 + ht + 8 + hs, 230 if not stack else 0)
    y = pad
    cv.rect(pad, y, inner, hh, C["hero"], 28 if not stack else 20, "#2f8cff", 2, "Banner")
    if not stack:
        cv.rect(pad + inner - 330, y + 18, 250, 250 if hh >= 270 else hh - 36, "#16407f", 999, name="Circle", decor=True)
        cv.rect(pad + inner - 170, y + hh - 150, 120, 120, "#3a2f7a", 999, name="Circle", decor=True)
        cv.rect(pad + inner - 400, y + 34, 38, 38, "#2fd18b", 999, name="Dot", decor=True)
    else:
        for nm in ("Circle", "Circle", "Dot"):
            cv.rect(pad + inner - 30, y + hh - 30, 8, 8, C["hero"], 0, name=nm, decor=True)
    cv.image(pad + pad_in, y + pad_in, logo, logo, "{logo_url}", "Rex", 18)
    cv.text(pad + pad_in + logo + 14, y + pad_in + (logo - 18) // 2, inner - 2 * pad_in - logo - 14, "REX · DETAILS", 13, True, "#5aa9ff", upper=True, ls=3, h=18)
    cy = y + pad_in + logo + 16
    cv.text(pad + pad_in, cy, tw, title, tsize, True, h=ht, lh=1.15)
    cv.text(pad + pad_in, cy + ht + 8, tw, sub, 15 if stack else 17, False, C["muted"], h=hs)
    return y + hh


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
    jobs = [("page_features", "page", lambda: build_page(d, "features", origin)),
            ("page_fixes", "page", lambda: build_page(d, "fixes", origin)),
            ("email_features", "email", lambda: build_email(d, "features", origin)),
            ("email_fixes", "email", lambda: build_email(d, "fixes", origin))]
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
        design = build_topic(d, topic, origin)
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
