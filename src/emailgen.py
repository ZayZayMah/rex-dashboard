"""Email generators: announcement emails (several layouts), the Follow Up template, and themed headers.

Everything here returns a normal email design (the same format the builder edits), so the owner can open the result in the
email builder and change anything. Nothing in here sends mail or touches storage.
"""
import re

W = 600
INNER = 520
MAX_BUILD_ELS = 56          # mail.MAX_ELS is 60; keep a little room for edits

HEX = re.compile(r"^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$")

# ------------------------------------------------------------------------------------------------ palettes
PALETTES = {
    "dark": {"label": "Rex dark", "bg": "#050a14", "card": "#0a1222", "head": "#12264a", "card2": "#101c34", "line": "#22407a", "title": "#ffffff", "text": "#c7d2ea",
             "muted": "#8593b3", "accent": "#2f8cff", "btn": "#2f8cff", "btnText": "#ffffff", "font": "poppins", "body": "inter", "radius": 22, "decor": [], "dark": True},
    "light": {"label": "Rex light", "bg": "#eef2f9", "card": "#ffffff", "head": "#2f8cff", "card2": "#f3f6fc", "line": "#d5deee", "title": "#ffffff", "text": "#33415c",
              "muted": "#6b7a99", "accent": "#2f8cff", "btn": "#2f8cff", "btnText": "#ffffff", "font": "poppins", "body": "arial", "radius": 16, "decor": [], "dark": False, "logoBg": "#ffffff"},
    # Matches the website's Christmas theme ("Midwinter"): evergreen night, warm gold, cream type, thin gold rules.
    "christmas": {"label": "Christmas", "bg": "#07120d", "card": "#0f2219", "head": "#132b20", "card2": "#132b20", "line": "#35604a", "title": "#f5f0e2", "text": "#bac6b8",
                  "muted": "#84978b", "accent": "#d9b45f", "btn": "#d9b45f", "btnText": "#1d1503", "font": "fraunces", "body": "figtree", "radius": 14,
                  "decor": ["✦", "❄", "✦"], "dark": True, "gold": "#e9cf8c", "logoBg": "#0a1812"},
}

VARIANTS = {
    "classic": "General look",
    "rounded": "Rounded",
    "image": "Image focused",
    "framed": "Framed (thin rules)",
    "compact": "Compact",
}
LAYOUTS = {
    "spotlight": ("Spotlight", "One big announcement with a large picture."),
    "story": ("Story", "Text first: headline, lead and long text."),
    "digest": ("Digest", "A card for each announcement, picture beside the text."),
    "grid": ("Grid", "Two columns of picture cards."),
    "alert": ("Alert", "A bold banner for important notices."),
    "list": ("Quick list", "A numbered list for many short items."),
}
ALERT_WORDS = ("maintenance", "outage", "downtime", "security", "urgent", "breach", "incident", "emergency", "important notice", "shutting down", "deprecat")


def lum(hx):
    hx = hx.lstrip("#")
    if len(hx) == 3:
        hx = "".join(c * 2 for c in hx)
    r, g, b = (int(hx[i:i + 2], 16) / 255 for i in (0, 2, 4))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def _finish_pal(out):
    out["dark"] = lum(out["card"]) < 0.4 if "dark_set" not in out else out["dark"]
    out.pop("dark_set", None)
    out["hi"] = (out["title"] if lum(out["title"]) > 0.55 else "#ffffff") if out["dark"] else "#0b1426"
    return out


def _shade(hx, amt):
    hx = hx.lstrip("#")
    if len(hx) == 3:
        hx = "".join(c * 2 for c in hx)
    c = [int(hx[i:i + 2], 16) for i in (0, 2, 4)]
    if amt < 0:   # lighten
        return "#%02x%02x%02x" % tuple(max(0, min(255, round(v + (255 - v) * -amt))) for v in c)
    return "#%02x%02x%02x" % tuple(max(0, min(255, round(v * (1 - amt)))) for v in c)


def clean_pal(raw, base="dark"):
    """Sanitise a palette sent by the builder (colours, radius, fonts, decorations)."""
    out = dict(PALETTES.get(base) or PALETTES["dark"])
    if not isinstance(raw, dict):
        return _finish_pal(out)
    for k in ("bg", "card", "head", "card2", "line", "title", "text", "muted", "accent", "btn", "btnText", "logoBg", "gold"):
        v = raw.get(k)
        if isinstance(v, str) and HEX.match(v):
            out[k] = v
    for k in ("font", "body"):
        v = raw.get(k)
        if isinstance(v, str) and re.match(r"^[a-z0-9]{2,20}$", v):
            out[k] = v
    try:
        out["radius"] = max(0, min(40, int(raw.get("radius", out["radius"]))))
    except (TypeError, ValueError):
        pass
    if isinstance(raw.get("decor"), list):
        out["decor"] = [str(x)[:4] for x in raw["decor"][:4]]
    if "card2" not in raw:
        dark = lum(out["card"]) < 0.4
        out["card2"] = out["head"] if dark and lum(out["head"]) < 0.3 else (_shade(out["card"], -0.09) if dark else _shade(out["card"], 0.045))
    if "line" not in raw:
        out["line"] = out["muted"]
    out.pop("dark", None)
    return _finish_pal(out)


# ------------------------------------------------------------------------------------------------ small helpers
def th(text, size, width, lh=1.5):
    """Height of some text. Slightly generous so nothing is cut off."""
    cpl = max(6, int(width / (size * 0.54)))
    lines = 0
    for ln in str(text or "").replace("**", "").split("\n"):
        lines += max(1, -(-len(ln) // cpl))
    return int(lines * size * lh) + 6


def _s(v, n):
    return re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", str(v or "")).strip()[:n]


def _url(v):
    v = str(v or "").strip()
    if re.match(r"^https?://[^\s<>\"']{4,480}$", v) or re.match(r"^\{[a-z_]+\}$", v):
        return v
    return ""


class Gen:
    def __init__(self, pal, variant):
        self.p, self.var, self.els, self.n = pal, variant if variant in VARIANTS else "classic", [], 0

    def add(self, t, name, x, y, w, h, **kw):
        self.n += 1
        e = {"id": "g%d" % self.n, "t": t, "name": name, "d": {"x": int(x), "y": int(y), "w": int(w), "h": int(h)}}
        e.update(kw)
        self.els.append(e)
        return e

    def rect(self, name, x, y, w, h, bg, **kw):
        return self.add("rect", name, x, y, w, h, bg=bg, lh=1.5, **kw)

    def text(self, name, x, y, w, text, size=16, h=None, **kw):
        kw.setdefault("color", self.p["text"])
        kw.setdefault("lh", 1.5)
        e = {"size": size, "align": "left", "va": "top", "ls": 0}
        e.update(kw)
        lh = e["lh"]
        return self.add("text", name, x, y, w, h or th(text, size, w - 2 * kw.get("pad", 0), lh) + 2 * kw.get("pad", 0), text=text, **e)

    def image(self, name, x, y, w, h, src, alt="", radius=0):
        return self.add("image", name, x, y, w, h, src=src, alt=alt, fit="cover", radius=radius)

    def button(self, x, y, w, label, url, **kw):
        p = self.p
        e = {"bg": p["btn"], "color": p["btnText"], "radius": min(p["radius"], 14) if self.var != "rounded" else 999, "size": 16, "bold": True, "align": "center", "va": "middle", "lh": 1.5, "ls": 0,
             "font": p["font"] if p["font"] not in ("creepster",) else p["body"]}
        e.update(kw)
        return self.add("button", "Button", x, y, w, 48, label=label, url=url or "{dashboard_url}", **e)

    # shared look of boxes
    def box(self):
        p, v = self.p, self.var
        r = {"classic": min(p["radius"], 16), "rounded": 26, "image": 14, "framed": 3, "compact": 10}[v]
        b = {"bg": p["card2"], "radius": r}
        if v == "framed":
            b.update(bw=1, bc=p.get("gold") or p["accent"])
        elif p["dark"]:
            b.update(bw=1, bc=p["line"])
        return b

    def design(self, pre="", dark=None):
        p = self.p
        page = p["bg"] if self.var == "rounded" else p["card"]
        return {"v": 1, "w": W, "bg": p["bg"], "page": page, "font": p["body"], "color": p["text"], "link": p.get("gold") or p["accent"],
                "outer": 28 if self.var == "rounded" else 22, "radius": {"classic": p["radius"], "rounded": 34, "image": 14, "framed": 4, "compact": 12}[self.var], "pre": _s(pre, 120),
                "dark": "off" if p["dark"] else "auto", "els": self.els}


# ------------------------------------------------------------------------------------------------ header and footer
def header(g, title, sub="", hero=""):
    """Draws the top of the email in the chosen variant and returns the y where content starts."""
    p, v = g.p, g.var
    gold = p.get("gold") or p["accent"]
    logo_bg = p.get("logoBg")
    xmas = p["decor"][:1] == ["✦"]
    if v == "rounded":
        g.rect("Header", 20, 20, 560, 196, p["head"], radius=34)
        g.rect("Logo circle", 44, 44, 84, 84, logo_bg or p["card"], radius=42)
        g.image("Logo", 54, 54, 64, 64, "{logo_url}", "Rex")
        g.text("Title", 148, 48, 404, title, 30, h=th(title, 30, 404, 1.15), color=p["title"], bold=True, font=p["font"], lh=1.15, va="middle")
        if sub:
            pw = min(404, len(sub) * 9 + 36)
            g.rect("Subtitle pill", 148, 138, pw, 32, p["accent"], radius=999)
            g.text("Subtitle", 148, 138, pw, sub, 14, h=32, color=p["btnText"], align="center", va="middle", bold=True)
        return 240
    if v == "image":
        if hero:
            g.image("Hero picture", 0, 0, W, 250, hero, "Hero picture")
            y = 250
        else:
            g.rect("Hero block", 0, 0, W, 150, p["head"])
            g.image("Logo", 256, 32, 88, 88, "{logo_url}", "Rex")
            y = 150
        g.rect("Title band", 0, y, W, 112, p["head"])
        g.text("Title", 40, y + 14, 520, title, 30, h=th(title, 30, 520, 1.15), color=p["title"], bold=True, font=p["font"], align="center", lh=1.15, va="middle")
        if sub:
            g.text("Subtitle", 60, y + 70, 480, sub, 15, h=28, color=gold if xmas else p["title"], align="center", va="middle")
        return y + 112
    if v == "framed":
        g.rect("Header", 0, 0, W, 214, p["head"])
        g.rect("Rule top", 40, 22, 520, 1, gold)
        g.image("Logo", 270, 38, 60, 60, "{logo_url}", "Rex")
        g.text("Title", 40, 104, 520, title, 30, h=th(title, 30, 520, 1.15), color=p["title"], bold=True, font=p["font"], align="center", lh=1.15, va="middle")
        if sub:
            g.text("Subtitle", 60, 150, 480, sub, 15, h=26, color=gold, align="center", va="middle", upper=True, ls=2)
        g.rect("Rule bottom", 40, 190, 520, 1, gold)
        g.text("Ornament", 270, 196, 60, "✦" if xmas else "◆", 14, h=16, color=gold, align="center")
        return 214
    if v == "compact":
        g.rect("Header", 0, 0, W, 120, p["head"])
        g.image("Logo", 36, 28, 64, 64, "{logo_url}", "Rex")
        g.text("Title", 120, 24, 444, title, 26, h=44, color=p["title"], bold=True, font=p["font"], lh=1.15, va="middle")
        if sub:
            g.text("Subtitle", 120, 70, 444, sub, 14, h=26, color=gold if xmas else p["title"], va="middle")
        return 120
    # classic
    hh = 232
    g.rect("Header", 0, 0, W, hh, p["head"])
    if logo_bg:
        g.rect("Logo circle", 252, 28, 96, 96, logo_bg, radius=48)
        g.image("Logo", 264, 40, 72, 72, "{logo_url}", "Rex")
    else:
        g.image("Logo", 256, 30, 88, 88, "{logo_url}", "Rex")
    g.text("Title", 40, 136, 520, title, 32, h=48, color=p["title"], bold=True, font=p["font"], align="center", va="middle", lh=1.15)
    if sub:
        g.text("Subtitle", 60, 188, 480, sub, 16, h=28, color=gold if xmas else p["title"], align="center", va="middle")
    for i, e in enumerate(p["decor"][:4]):
        g.text("Decoration %d" % (i + 1), [22, 534, 66, 490][i], 14 if xmas else 12, 44, e, 26, h=36, align="center", color=gold if xmas else p["text"], lh=1.2)
    if xmas:
        g.rect("Gold line", 0, hh, W, 2, gold)
    return hh


def footer(g, y, small, signature=True):
    p = g.p
    gold = p.get("gold") or p["accent"]
    g.rect("Divider", 40, y, 520, 1, p["line"])
    y += 18
    if signature:
        g.text("Signature", 40, y, 520, "♥ by Rex Team", 14, h=22, color=gold if p["decor"][:1] == ["✦"] else p["muted"], align="center", bold=True)
        y += 28
    if not small:
        return y + 20
    g.text("Small print", 40, y, 520, small, 12, h=th(small, 12, 520, 1.6), color=p["muted"], align="center", lh=1.6)
    return y + th(small, 12, 520, 1.6) + 24


SMALL_ANN = "Don't want these? [Change which emails you get]({unsubscribe_link}) · [Unsubscribe]({unsubscribe_url})"
SMALL_REPLY = "You're getting this because you wrote to Rex. Just reply to this email to keep talking with us."


# ------------------------------------------------------------------------------------------------ announcements
def _clean_items(raw):
    out = []
    for it in (raw if isinstance(raw, list) else [])[:12]:
        if not isinstance(it, dict):
            continue
        d = {"title": _s(it.get("title"), 90), "brief": _s(it.get("brief"), 260), "long": _s(it.get("long"), 1400), "image": _url(it.get("image")),
             "link": _url(it.get("link")), "link_label": _s(it.get("link_label"), 30) or "Read more"}
        if any(d[k] for k in ("title", "brief", "long", "image")):
            out.append(d)
    return out


def pick_layout(items):
    """Chooses a layout from what was filled in. Returns (layout, why)."""
    n = len(items)
    blob = " ".join((i["title"] + " " + i["brief"] + " " + i["long"]).lower() for i in items)
    if any(w in blob for w in ALERT_WORDS) and n <= 2:
        return "alert", "it mentions maintenance, security or another important notice"
    if n == 0:
        return "spotlight", "nothing was filled in yet"
    if n == 1:
        it = items[0]
        if it["image"]:
            return "spotlight", "one announcement with a picture"
        if len(it["long"]) > 300:
            return "story", "one announcement with a long description"
        return "story", "one announcement without a picture"
    if n <= 4:
        if all(i["image"] for i in items) and not any(len(i["long"]) > 200 for i in items):
            return "grid", "%d announcements that all have pictures" % n
        return "digest", "%d announcements" % n
    return "list", "%d announcements, so a short list reads best" % n


def pick_variant(items, layout):
    """Chooses the look (layout style) from how much was filled in."""
    n = len(items)
    has_img = any(i["image"] for i in items)
    longest = max([len(i["long"]) for i in items] or [0])
    if layout == "alert":
        return "classic"
    if layout == "list" or n >= 5:
        return "compact"
    if layout == "spotlight":
        return "image" if has_img else ("classic" if longest > 200 else "framed")
    if layout == "story":
        return "framed" if not has_img else "classic"
    if layout in ("digest", "grid"):
        return "rounded" if n <= 3 else "classic"
    return "classic"


def _more(it):
    return (" [%s →](%s)" % (it["link_label"], it["link"])) if it["link"] else ""


def _item_text(it):
    body = it["long"] or it["brief"]
    return body + _more(it) if body else _more(it).strip()


def _eyebrow(g, y, label):
    g.text("Label", 40, y, 520, label, 12, h=18, color=g.p.get("gold") or g.p["accent"], bold=True, upper=True, ls=2)
    return y + 26


def _layout_spotlight(g, it, y):
    p = g.p
    if it["image"] and g.var != "image":
        g.image("Picture", 40, y, INNER, 260, it["image"], it["title"] or "Picture", radius=g.box()["radius"])
        y += 280
    y = _eyebrow(g, y, "New from Rex")
    if it["title"]:
        h = th(it["title"], 28, INNER, 1.2)
        g.text("Headline", 40, y, INNER, it["title"], 28, h=h, color=_head_color(p), bold=True, font=p["font"], lh=1.2)
        y += h + 10
    if it["brief"]:
        h = th(it["brief"], 18, INNER, 1.5)
        g.text("Brief", 40, y, INNER, it["brief"], 18, h=h, color=p.get("gold") or p["accent"], bold=True)
        y += h + 10
    if it["long"]:
        h = th(it["long"] + _more(it), 16, INNER, 1.6)
        g.text("Details", 40, y, INNER, it["long"] + _more(it), 16, h=h, lh=1.6)
        y += h + 16
    elif it["link"]:
        g.text("Link", 40, y, INNER, _more(it).strip(), 16, h=26)
        y += 36
    return y


def _head_color(p):
    return p["hi"]


def _layout_story(g, items, y):
    p = g.p
    it = items[0] if items else {"title": "", "brief": "", "long": "", "link": "", "link_label": "Read more", "image": ""}
    y = _eyebrow(g, y, "Announcement")
    if it["title"]:
        h = th(it["title"], 32, INNER, 1.15)
        g.text("Headline", 40, y, INNER, it["title"], 32, h=h, color=_head_color(p), bold=True, font=p["font"], lh=1.15)
        y += h + 14
    if it["brief"]:
        h = th(it["brief"], 19, INNER - 22, 1.5)
        g.rect("Lead bar", 40, y, 4, h, p.get("gold") or p["accent"], radius=2)
        g.text("Lead", 58, y, INNER - 18, it["brief"], 19, h=h, color=_head_color(p))
        y += h + 16
    if it["image"]:
        g.image("Picture", 40, y, INNER, 220, it["image"], it["title"] or "Picture", radius=g.box()["radius"])
        y += 240
    body = it["long"] + _more(it)
    if body.strip():
        h = th(body, 16, INNER, 1.7)
        g.text("Details", 40, y, INNER, body, 16, h=h, lh=1.7)
        y += h + 16
    return y


def _layout_digest(g, items, y):
    p, box = g.p, g.box()
    for i, it in enumerate(items):
        has_img = bool(it["image"])
        tx = 40 + (176 if has_img else 0) + 18
        tw = 560 - tx - 18
        parts = []
        if it["title"]:
            parts.append(("Title", it["title"], 20, True, 1.2))
        if it["brief"]:
            parts.append(("Brief", it["brief"], 15, False, 1.5))
        body = it["long"] + _more(it) if it["long"] else _more(it).strip()
        if body:
            parts.append(("Details", body, 14, False, 1.55))
        hs = [th(t, s, tw, lh) for (_, t, s, _, lh) in parts]
        ch = max(sum(hs) + 8 * max(0, len(hs) - 1) + 36, 150 if has_img else 0)
        g.rect("Card %d" % (i + 1), 40, y, INNER, ch, box["bg"], radius=box["radius"], **({"bw": box["bw"], "bc": box["bc"]} if "bw" in box else {}))
        if has_img:
            g.image("Picture %d" % (i + 1), 58, y + 18, 158, ch - 36, it["image"], it["title"] or "Picture", radius=max(4, box["radius"] - 6))
        yy = y + 18
        for (name, t, s, b, lh), hh in zip(parts, hs):
            col = _head_color(p) if name == "Title" else (p.get("gold") or p["accent"]) if name == "Brief" else p["text"]
            kw = {"bold": True} if name in ("Title", "Brief") else {}
            if name == "Title":
                kw["font"] = p["font"]
            g.text("%s %d" % (name, i + 1), tx, yy, tw, t, s, h=hh, color=col, lh=lh, **kw)
            yy += hh + 8
        y += ch + 16
    return y


def _layout_grid(g, items, y):
    p, box = g.p, g.box()
    for r in range(0, len(items), 2):
        row = items[r:r + 2]
        cw = INNER if len(row) == 1 else 250
        hs = []
        for it in row:
            txt = it["brief"] + _more(it)
            hs.append((th(it["title"], 17, cw - 32, 1.2) + 6 if it["title"] else 0) + (th(txt, 14, cw - 32, 1.5) if txt.strip() else 0))
        ch = 150 + max(hs) + 34 if all(i["image"] for i in row) else max(hs) + 44
        for c, it in enumerate(row):
            x = 40 + c * (cw + 20)
            idx = r + c + 1
            g.rect("Card %d" % idx, x, y, cw, ch, box["bg"], radius=box["radius"], **({"bw": box["bw"], "bc": box["bc"]} if "bw" in box else {}))
            yy = y + 16
            if it["image"]:
                g.image("Picture %d" % idx, x + 16, yy, cw - 32, 134 if cw < INNER else 200, it["image"], it["title"] or "Picture", radius=max(4, box["radius"] - 6))
                yy += (146 if cw < INNER else 212)
            if it["title"]:
                h = th(it["title"], 17, cw - 32, 1.2)
                g.text("Title %d" % idx, x + 16, yy, cw - 32, it["title"], 17, h=h, color=_head_color(p), bold=True, font=p["font"], lh=1.2)
                yy += h + 6
            if it["brief"]:
                g.text("Brief %d" % idx, x + 16, yy, cw - 32, it["brief"] + _more(it), 14, h=th(it["brief"] + _more(it), 14, cw - 32, 1.5))
        y += ch + 16
    return y


def _layout_alert(g, items, y):
    p = g.p
    it = items[0] if items else {"title": "Important notice", "brief": "", "long": "", "link": "", "link_label": "Read more", "image": ""}
    warn = "#e5484d" if not p["dark"] else "#f0a35e"
    g.rect("Alert bar", 40, y, INNER, 74, warn, radius=g.box()["radius"])
    g.text("Alert title", 60, y, INNER - 40, "⚠️  " + (it["title"] or "Important notice"), 22, h=74, color="#1a0d00" if p["dark"] else "#ffffff", bold=True, font=p["font"], va="middle", lh=1.2)
    y += 94
    if it["brief"]:
        h = th(it["brief"], 18, INNER, 1.5)
        g.text("Brief", 40, y, INNER, it["brief"], 18, h=h, color=_head_color(p), bold=True)
        y += h + 12
    body = it["long"] + _more(it)
    if body.strip():
        box = g.box()
        h = th(body, 15, INNER - 36, 1.6) + 36
        g.text("Details", 40, y, INNER, body, 15, h=h, bg=box["bg"], pad=18, radius=box["radius"], lh=1.6, **({"bw": box["bw"], "bc": box["bc"]} if "bw" in box else {}))
        y += h + 16
    for extra in items[1:2]:
        y = _layout_digest(g, [extra], y)
    return y


def _layout_list(g, items, y):
    p = g.p
    for i, it in enumerate(items):
        g.rect("Number %d" % (i + 1), 40, y + 2, 34, 34, p.get("gold") or p["accent"], radius=17)
        g.text("Number text %d" % (i + 1), 40, y + 2, 34, str(i + 1), 15, h=34, color=p["btnText"], bold=True, align="center", va="middle")
        t = (it["title"] or "") + ("\n" if it["title"] and (it["brief"] or it["long"]) else "")
        body = it["brief"] or it["long"][:160]
        txt = ("**%s**" % it["title"] if it["title"] else "") + ("\n" if it["title"] and body else "") + body + _more(it)
        h = max(36, th(txt, 15, 450, 1.45))
        g.text("Item %d" % (i + 1), 90, y, 470, txt, 15, h=h, lh=1.45)
        y += h + 14
    return y


def announcement(raw_items, layout="auto", variant="classic", palette=None, base="dark", button_label="", button_url="", subject="", sub="News from Rex", page=False):
    items = _clean_items(raw_items)
    pal = clean_pal(palette, base)
    why = ""
    if layout not in LAYOUTS:
        layout, why = pick_layout(items)
    if variant not in VARIANTS:
        variant = pick_variant(items, layout)
    trimmed = 0
    while True:
        g = Gen(pal, variant)
        hero = items[0]["image"] if (items and g.var == "image") else ""
        title = "What's new in Rex" if layout != "alert" else "Important notice"
        sub_line = sub
        y = header(g, title, sub_line, hero) + 32
        shown = items[:len(items) - trimmed] if trimmed else items
        if layout == "spotlight":
            y = _layout_spotlight(g, shown[0] if shown else {"title": "", "brief": "", "long": "", "image": "", "link": "", "link_label": "Read more"}, y)
            for extra in shown[1:3]:
                y = _layout_digest(g, [extra], y)
        elif layout == "story":
            y = _layout_story(g, shown, y)
            if len(shown) > 1:
                y = _layout_digest(g, shown[1:], y)
        elif layout == "digest":
            y = _layout_digest(g, shown or [{"title": "Headline", "brief": "A short description.", "long": "", "image": "", "link": "", "link_label": "Read more"}], y)
        elif layout == "grid":
            y = _layout_grid(g, shown, y)
        elif layout == "alert":
            y = _layout_alert(g, shown, y)
        else:
            y = _layout_list(g, shown, y)
        if button_label:
            y += 4
            g.button(40, y, 240, button_label, _url(button_url) or "{dashboard_url}")
            y += 80
        y = footer(g, y, "" if page else SMALL_ANN)
        if len(g.els) <= MAX_BUILD_ELS or not shown:
            break
        trimmed += 1
    d = g.design(pre=(items[0]["brief"] or items[0]["title"]) if items else "")
    subj = _s(subject, 150) or (items[0]["title"] if len(items) == 1 and items[0]["title"] else ("What's new in Rex" if items else "News from Rex"))
    if page:
        d = to_page(d, pal)
    return {"design": d, "subject": subj, "layout": layout, "why": why, "trimmed": trimmed, "variant": g.var}


# ------------------------------------------------------------------------------------------------ Follow Up
FOLLOWUP_SECTIONS = [
    # key, label, default heading (empty = no heading), default text, on by default
    ("greeting", "Greeting", "", "Hi {first_name},", True),
    ("thanks", "Thanks / acknowledgement", "", "Thanks for getting in touch and for your patience. We've looked into what you sent us.", True),
    ("issue", "Issue addressing", "What we found", "Here is what was going on, in plain words.", True),
    ("steps", "What we did", "What we did", "- First thing we changed\n- Second thing we changed", False),
    ("next", "Next steps", "What happens next", "Nothing else is needed from you right now. If it happens again, reply to this email with what you were doing.", False),
    ("help", "Helpful links", "Helpful links", "[Open your dashboard]({dashboard_url}) · [Contact support]({support_url})", False),
    ("quote", "Quote their message", "You wrote", "", False),
    ("conclusion", "Conclusion", "", "We hope that sorts it out. Thanks again for helping us make Rex better.", True),
    ("signoff", "Sign-off", "", "Warm regards,\nThe Rex Team ♥", True),
]


def followup_defaults():
    return [{"key": k, "label": lab, "title": ttl, "text": txt, "on": on} for (k, lab, ttl, txt, on) in FOLLOWUP_SECTIONS]


def followup(sections, variant="classic", palette=None, base="dark", subject="", who="", quote=""):
    pal = clean_pal(palette, base)
    by = {s["key"]: s for s in followup_defaults()}
    for raw in (sections if isinstance(sections, list) else []):
        if isinstance(raw, dict) and raw.get("key") in by:
            s = by[raw["key"]]
            s["on"] = bool(raw.get("on"))
            if "text" in raw:
                s["text"] = _s(raw.get("text"), 3000)
            if "title" in raw:
                s["title"] = _s(raw.get("title"), 60)
    if quote:
        by["quote"]["text"] = _s(quote, 700)
    g = Gen(pal, variant)
    gold = pal.get("gold") or pal["accent"]
    subj = _s(subject, 150) or "Following up"
    if g.var == "classic":
        g.var = "compact"   # a shorter header suits a reply
    y = header(g, "Following up", "Re: " + subj[:60], "") + 30
    box = g.box()
    for s in followup_defaults():
        s = by[s["key"]]
        if not s["on"] or not s["text"].strip():
            continue
        k, text = s["key"], s["text"]
        if k in ("greeting", "signoff", "thanks", "conclusion"):
            h = th(text, 16, INNER, 1.65)
            g.text(s["label"], 40, y, INNER, text, 16, h=h, lh=1.65, color=_head_color(pal) if k in ("greeting", "signoff") and not pal["dark"] else pal["text"], **({"bold": True} if k == "signoff" else {}))
            y += h + 14
            continue
        if s["title"]:
            g.text(s["label"] + " heading", 40, y, INNER, s["title"], 12, h=18, color=gold, bold=True, upper=True, ls=2)
            y += 26
        if k == "quote":
            h = th(text, 14, INNER - 24, 1.55)
            g.rect("Quote bar", 40, y, 3, h, pal["line"], radius=2)
            g.text("Quoted message", 56, y, INNER - 16, text, 14, h=h, color=pal["muted"], italic=True, lh=1.55)
            y += h + 18
            continue
        h = th(text, 15, INNER - 36, 1.6) + 36
        if k in ("issue", "steps"):
            g.text(s["label"], 40, y, INNER, text, 15, h=h, bg=box["bg"], pad=18, radius=box["radius"], lh=1.6, color=pal["text"], **({"bw": box["bw"], "bc": box["bc"]} if "bw" in box else {}))
            y += h + 18
        else:
            h = th(text, 15, INNER, 1.6)
            g.text(s["label"], 40, y, INNER, text, 15, h=h, lh=1.6)
            y += h + 16
    y = footer(g, y + 4, SMALL_REPLY)
    return {"design": g.design(pre="Following up on your message"), "subject": ("Re: " + subj) if subj and not subj.lower().startswith("re:") else subj}


# ------------------------------------------------------------------------------------------------ pages
PAGE_W = 860
_PAGE_VARS = {"{dashboard_url}": "/dashboard", "{site_url}": "/", "{support_url}": "/support", "{docs_url}": "/docs"}


def to_page(design, pal):
    """Scales an email design up to the 860 wide page canvas, so pages and emails share the same templates."""
    k = PAGE_W / W
    out = []
    for e in design["els"]:
        e = dict(e)
        d = e["d"]
        e["d"] = {"x": round(d["x"] * k), "y": round(d["y"] * k), "w": round(d["w"] * k), "h": round(d["h"] * k)}
        if "size" in e:
            e["size"] = min(120, round(e["size"] * 1.12))
        for f in ("radius", "pad"):
            if isinstance(e.get(f), (int, float)):
                e[f] = min(300, round(e[f] * k)) if f == "radius" and e[f] < 100 else e[f]
        for f in ("url", "text", "label", "src"):
            if isinstance(e.get(f), str):
                v = e[f]
                for a, b in _PAGE_VARS.items():
                    v = v.replace(a, b)
                e[f] = v
        out.append(e)
    return {"v": 1, "w": PAGE_W, "bg": pal["bg"], "page": pal["card"], "color": pal["text"], "link": pal.get("gold") or pal["accent"], "font": pal["body"], "fill": False, "els": out}
