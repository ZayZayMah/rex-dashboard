"""
Email design -> email-safe HTML. ONE renderer is used for the builder preview, test sends and real sends,
so what you preview is exactly what is sent.

A design is a free-placement canvas: every element has a box (x, y, w, h) for the desktop layout and, optionally,
its own box for the mobile layout. Email clients can't do absolute positioning, so the renderer turns the boxes into
nested tables (rows of side-by-side cells, with rectangles acting as containers for what sits on top of them).
No Worker imports here, so it can be tested on its own.
"""
import colorsys
import html
import re

MOB_W = 360
BREAKPOINT = 620
MAX_ELS = 60
TYPES = ("text", "image", "button", "rect")
FONTS = {
    "arial": ("Arial, Helvetica, sans-serif", None, "Arial"),
    "verdana": ("Verdana, Geneva, sans-serif", None, "Verdana"),
    "tahoma": ("Tahoma, Geneva, sans-serif", None, "Tahoma"),
    "trebuchet": ("'Trebuchet MS', Helvetica, sans-serif", None, "Trebuchet"),
    "georgia": ("Georgia, 'Times New Roman', serif", None, "Georgia"),
    "times": ("'Times New Roman', Times, serif", None, "Times"),
    "palatino": ("'Palatino Linotype', Palatino, 'Book Antiqua', serif", None, "Palatino"),
    "courier": ("'Courier New', Courier, monospace", None, "Courier"),
    "impact": ("Impact, Charcoal, sans-serif", None, "Impact"),
    "comic": ("'Comic Sans MS', 'Comic Sans', cursive", None, "Comic Sans"),
    "inter": ("'Inter', Arial, sans-serif", "Inter:wght@400;700;800", "Inter *"),
    "poppins": ("'Poppins', Arial, sans-serif", "Poppins:wght@400;600;700", "Poppins *"),
    "montserrat": ("'Montserrat', Arial, sans-serif", "Montserrat:wght@400;700;800", "Montserrat *"),
    "roboto": ("'Roboto', Arial, sans-serif", "Roboto:wght@400;700", "Roboto *"),
    "opensans": ("'Open Sans', Arial, sans-serif", "Open+Sans:wght@400;700", "Open Sans *"),
    "lato": ("'Lato', Arial, sans-serif", "Lato:wght@400;700;900", "Lato *"),
    "raleway": ("'Raleway', Arial, sans-serif", "Raleway:wght@400;700;800", "Raleway *"),
    "nunito": ("'Nunito', Arial, sans-serif", "Nunito:wght@400;700;800", "Nunito *"),
    "oswald": ("'Oswald', Impact, sans-serif", "Oswald:wght@400;600;700", "Oswald *"),
    "bebas": ("'Bebas Neue', Impact, sans-serif", "Bebas+Neue", "Bebas Neue *"),
    "playfair": ("'Playfair Display', Georgia, serif", "Playfair+Display:wght@400;700;800", "Playfair Display *"),
    "merriweather": ("'Merriweather', Georgia, serif", "Merriweather:wght@400;700", "Merriweather *"),
    "lora": ("'Lora', Georgia, serif", "Lora:wght@400;700", "Lora *"),
    "pacifico": ("'Pacifico', cursive", "Pacifico", "Pacifico *"),
    "dancing": ("'Dancing Script', cursive", "Dancing+Script:wght@400;700", "Dancing Script *"),
    "fredoka": ("'Fredoka', Arial, sans-serif", "Fredoka:wght@400;600;700", "Fredoka *"),
    "chakra": ("'Chakra Petch', Arial, sans-serif", "Chakra+Petch:wght@400;600;700", "Chakra Petch *"),
    "creepster": ("'Creepster', cursive", "Creepster", "Creepster *"),
    "mountains": ("'Mountains of Christmas', cursive", "Mountains+of+Christmas:wght@400;700", "Mountains of Christmas *"),
    "righteous": ("'Righteous', Arial, sans-serif", "Righteous", "Righteous *"),
    "abril": ("'Abril Fatface', Georgia, serif", "Abril+Fatface", "Abril Fatface *"),
    "caveat": ("'Caveat', cursive", "Caveat:wght@400;700", "Caveat *"),
    "jetbrains": ("'JetBrains Mono', 'Courier New', monospace", "JetBrains+Mono:wght@400;700", "JetBrains Mono *"),
}
HEX = re.compile(r"^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$")
URL = re.compile(r"^https?://[^\s<>\"']{4,480}$")
VARIABLES = ("name", "first_name", "dashboard_url", "site_url", "unsubscribe_url", "unsubscribe_link", "logo_url", "support_url", "date", "server")


def _rgb(hx):
    hx = hx.lstrip("#")
    if len(hx) == 3:
        hx = "".join(c * 2 for c in hx)
    return tuple(int(hx[i:i + 2], 16) / 255 for i in (0, 2, 4))


def _hex(r, g, b):
    return "#%02x%02x%02x" % (round(r * 255), round(g * 255), round(b * 255))


def dark_bg(hx):
    """The dark-mode version of a background colour: light colours become deep ones, dark and mid colours stay."""
    if not HEX.match(hx or ""):
        return ""
    h, l, s = colorsys.rgb_to_hls(*_rgb(hx))
    if l <= 0.55:
        return hx
    return _hex(*colorsys.hls_to_rgb(h, 0.10 + (1 - l) * 0.30, s * 0.7))


def dark_text(hx):
    """The dark-mode version of a text colour: dark text becomes light, light and mid colours stay."""
    if not HEX.match(hx or ""):
        return ""
    h, l, s = colorsys.rgb_to_hls(*_rgb(hx))
    if l >= 0.5:
        return hx
    return _hex(*colorsys.hls_to_rgb(h, 0.92 - l * 0.4, s * 0.8))


def _num(v, lo, hi, default):
    try:
        n = float(v)
    except (TypeError, ValueError):
        return default
    if n != n:
        return default
    n = max(lo, min(hi, n))
    return int(n) if n == int(n) else round(n, 2)


def _col(v, default=""):
    v = str(v or "").strip()
    return v if HEX.match(v) else ("transparent" if v == "transparent" else default)


def _txt(v, n):
    return re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", str(v or ""))[:n]


def _url(v):
    v = str(v or "").strip()
    if v.startswith("{") and v.endswith("}") and v[1:-1] in VARIABLES:
        return v
    return v if URL.match(v) else ""


def _box(raw, W, default):
    raw = raw if isinstance(raw, dict) else {}
    return {"x": _num(raw.get("x"), -50, W, default["x"]), "y": _num(raw.get("y"), 0, 6000, default["y"]),
            "w": _num(raw.get("w"), 8, W, default["w"]), "h": _num(raw.get("h"), 4, 3000, default["h"])}


def clean_design(raw):
    """Validate and normalise a design coming from the browser. Raises ValueError with a friendly message."""
    if not isinstance(raw, dict):
        raise ValueError("The email design is not valid.")
    W = _num(raw.get("w"), 480, 700, 600)
    out = {"v": 1, "w": W, "bg": _col(raw.get("bg"), "#eef2f9"), "page": _col(raw.get("page"), "#ffffff"), "font": raw.get("font") if raw.get("font") in FONTS else "arial",
           "color": _col(raw.get("color"), "#33415c"), "link": _col(raw.get("link"), "#2f8cff"), "outer": _num(raw.get("outer"), 0, 60, 24),
           "radius": _num(raw.get("radius"), 0, 40, 16), "pre": _txt(raw.get("pre"), 160), "mh": _num(raw.get("mh"), 200, 4000, 600), "dh": _num(raw.get("dh"), 200, 6000, 600),
           "dark": "off" if raw.get("dark") == "off" else "auto",
           "els": []}
    els = raw.get("els")
    if not isinstance(els, list):
        raise ValueError("The email has no elements.")
    if len(els) > MAX_ELS:
        raise ValueError(f"An email can have up to {MAX_ELS} elements.")
    seen = set()
    for i, e in enumerate(els):
        if not isinstance(e, dict) or e.get("t") not in TYPES:
            raise ValueError("An element has an unknown type.")
        t = e["t"]
        eid = re.sub(r"[^a-zA-Z0-9]", "", str(e.get("id") or ""))[:12] or f"e{i}"
        if eid in seen:
            eid = f"{eid}{i}"
        seen.add(eid)
        deflt = {"x": 20, "y": 20 + i * 10, "w": 200, "h": 60}
        o = {"id": eid, "t": t, "name": _txt(e.get("name"), 40), "d": _box(e.get("d"), W, deflt), "lock": bool(e.get("lock")), "hid": bool(e.get("hid"))}
        if isinstance(e.get("m"), dict):
            m = _box(e["m"], MOB_W, {"x": 0, "y": 0, "w": MOB_W, "h": o["d"]["h"]})
            m["hide"] = bool(e["m"].get("hide"))
            if e["m"].get("size") not in (None, ""):
                m["size"] = _num(e["m"].get("size"), 8, 120, 16)
            o["m"] = m
        o["dbg"] = _col(e.get("dbg"), "")
        o["dcolor"] = _col(e.get("dcolor"), "")
        o["bg"] = _col(e.get("bg"), "")
        o["radius"] = _num(e.get("radius"), 0, 300, 0)
        o["bw"] = _num(e.get("bw"), 0, 16, 0)
        o["bc"] = _col(e.get("bc"), "#000000")
        o["pad"] = _num(e.get("pad"), 0, 120, 0)
        if t in ("text", "button"):
            o.update(text=_txt(e.get("text") if t == "text" else e.get("label"), 4000), font=e.get("font") if e.get("font") in FONTS else "", size=_num(e.get("size"), 8, 120, 16),
                     bold=bool(e.get("bold")), italic=bool(e.get("italic")), underline=bool(e.get("underline")), upper=bool(e.get("upper")), color=_col(e.get("color"), ""),
                     align=e.get("align") if e.get("align") in ("left", "center", "right") else ("center" if t == "button" else "left"),
                     va=e.get("va") if e.get("va") in ("top", "middle", "bottom") else ("middle" if t == "button" else "top"), lh=_num(e.get("lh"), 0.8, 3, 1.5), ls=_num(e.get("ls"), -2, 20, 0))
            if t == "button":
                o["label"] = o.pop("text")
                o["url"] = _url(e.get("url"))
                if not o["bg"]:
                    o["bg"] = "#2f8cff"
                if not o["color"]:
                    o["color"] = "#ffffff"
                o["bold"] = bool(e.get("bold", True))
        elif t == "image":
            o.update(src=_url(e.get("src")), alt=_txt(e.get("alt"), 150), url=_url(e.get("url")), fit=e.get("fit") if e.get("fit") in ("cover", "fill", "auto") else "cover")
        elif t == "rect":
            o["img"] = _url(e.get("img"))
        o["z"] = i
        out["els"].append(o)
    return out


# ---------------------------------------------------------------- variables + tiny markup
def fill_vars(text, v):
    for k in VARIABLES:
        if "{" + k + "}" in text:
            text = text.replace("{" + k + "}", str(v.get(k, "")))
    return text


def _fill_url(u, v):
    return fill_vars(u, v) if u else ""


def _markup(text, link):
    """Escaped text with **bold**, *italic*, [label](https://...) and new lines."""
    s = html.escape(text, quote=False)
    s = re.sub(r"\[([^\]\n]{1,80})\]\((https?://[^\s)]{4,300})\)", lambda m: f'<a href="{m.group(2)}" style="color:{link};text-decoration:underline">{m.group(1)}</a>', s)
    s = re.sub(r"\*\*([^*\n]{1,300})\*\*", r"<strong>\1</strong>", s)
    s = re.sub(r"(?<![\*\w])\*([^*\n]{1,300})\*(?![\*\w])", r"<em>\1</em>", s)
    return s.replace("\r", "").replace("\n", "<br>")


def _plain(text):
    s = re.sub(r"\[([^\]\n]+)\]\((https://[^\s)]+)\)", r"\1 (\2)", text)
    return re.sub(r"\*+", "", s)


# ---------------------------------------------------------------- layout
def auto_mobile(els):
    """Stack elements for phones when the designer hasn't laid the mobile version out by hand.
    Things sitting inside a Box keep their place inside it (so a banner with a title on top stays a banner)."""
    els = [e for e in els if not e.get("hid")]
    kids = {e["id"]: [] for e in els}
    top = []
    for e in els:
        best = None
        for r in els:
            if r is e or r["t"] != "rect" or not _inside(e["d"], r["d"]):
                continue
            ar, ae = r["d"]["w"] * r["d"]["h"], e["d"]["w"] * e["d"]["h"]
            if ar < ae or (ar == ae and els.index(r) > els.index(e)):
                continue
            if best is None or ar < best["d"]["w"] * best["d"]["h"]:
                best = r
        (kids[best["id"]] if best else top).append(e)
    out = {}

    def place(e, x, y, w, h):
        out[e["id"]] = {"x": round(x), "y": round(y), "w": round(w), "h": round(h)}
        if kids.get(e["id"]):
            s = w / e["d"]["w"]
            for k in kids[e["id"]]:
                place(k, (k["d"]["x"] - e["d"]["x"]) * s, y + (k["d"]["y"] - e["d"]["y"]), k["d"]["w"] * s, k["d"]["h"])
            # children are positioned relative to the box: convert to canvas coordinates
            for k in kids[e["id"]]:
                out[k["id"]]["x"] += round(x)

    cursor, prev_bottom = 0, None
    for e in sorted(top, key=lambda e: (e["d"]["y"], e["d"]["x"])):
        d = e["d"]
        wide = d["w"] >= 0.7 * 600
        mar = 24 if (wide and d["x"] >= 16 and e["t"] != "rect") else 0
        w = MOB_W - 2 * mar if wide else min(d["w"], MOB_W)
        h = d["h"] if kids.get(e["id"]) else (round(d["h"] * (w / d["w"])) if e["t"] in ("image", "rect") else d["h"])
        gap = 0 if prev_bottom is None else min(max(0, d["y"] - prev_bottom), 24)
        place(e, mar if wide else round((MOB_W - w) / 2), cursor + gap, w, h)
        cursor += gap + h
        prev_bottom = d["y"] + d["h"]
    return out


def _inside(a, b):
    return a["x"] >= b["x"] - 0.5 and a["y"] >= b["y"] - 0.5 and a["x"] + a["w"] <= b["x"] + b["w"] + 0.5 and a["y"] + a["h"] <= b["y"] + b["h"] + 0.5


def _hit(a, b):
    return a["x"] < b["x"] + b["w"] and b["x"] < a["x"] + a["w"] and a["y"] < b["y"] + b["h"] and b["y"] < a["y"] + a["h"]


def _tree(items):
    """items: [(el, box)]. Returns top-level nodes; rectangles that fully contain other things become containers."""
    n = len(items)
    parent = [None] * n
    area = [b["w"] * b["h"] for _, b in items]
    for j, (ej, bj) in enumerate(items):
        best = None
        for i, (ei, bi) in enumerate(items):
            if i == j or ei["t"] != "rect" or not _inside(bj, bi):
                continue
            if area[i] < area[j] or (area[i] == area[j] and i > j):
                continue
            if best is None or area[i] < area[best]:
                best = i
        if best is not None:
            zi, zj = items[best][0].get("z", best), ej.get("z", j)
            for k, (ek, bk) in enumerate(items):
                if k in (best, j) or ek["t"] == "rect" and _inside(bk, items[best][1]) and False:
                    continue
                if _hit(bk, items[best][1]) and not _inside(bk, items[best][1]) and zi < ek.get("z", k) < zj:
                    best = None   # something sits between the box and this item in the stack, so keep the order by stacking them
                    break
        parent[j] = best
    nodes = [{"e": e, "b": dict(b), "kids": []} for e, b in items]
    top = []
    for j, node in enumerate(nodes):
        if parent[j] is None:
            top.append(node)
        else:
            nodes[parent[j]]["kids"].append(node)
    return top


def _bbox(group):
    x0 = min(n["b"]["x"] for n in group); y0 = min(n["b"]["y"] for n in group)
    x1 = max(n["b"]["x"] + n["b"]["w"] for n in group); y1 = max(n["b"]["y"] + n["b"]["h"] for n in group)
    return {"x": x0, "y": y0, "w": x1 - x0, "h": y1 - y0}


def _merge_overlaps(nodes):
    """Things that overlap are kept together as one 'stack' that is drawn with absolute positioning (top-most last)."""
    groups = [[n] for n in nodes]
    changed = True
    while changed:
        changed = False
        for i in range(len(groups)):
            for j in range(i + 1, len(groups)):
                if _hit(_bbox(groups[i]), _bbox(groups[j])):
                    groups[i] += groups.pop(j)
                    changed = True
                    break
            if changed:
                break
    out = []
    for g in groups:
        if len(g) == 1:
            out.append(g[0])
        else:
            g.sort(key=lambda n: n["e"].get("z", 0))
            out.append({"stack": g, "b": _bbox(g), "kids": [], "e": {"t": "stack", "z": min(n["e"].get("z", 0) for n in g)}})
    out.sort(key=lambda nd: (nd["b"]["y"], nd["b"]["x"]))
    return out


_Z = "font-size:0;line-height:0;mso-line-height-rule:exactly"


def _gap_row(h, cols=1):
    h = max(0, round(h))
    return f'<tr><td height="{h}" colspan="{cols}" style="height:{h}px;{_Z}">&nbsp;</td></tr>' if h else ""


def _spacer_cell(w):
    w = max(0, round(w))
    return f'<td width="{w}" style="width:{w}px;min-width:{w}px;{_Z}">&nbsp;</td>' if w else ""


class _Ctx:
    def __init__(self, design, mode, v):
        self.d, self.mode, self.v = design, mode, v
        self.W = design["w"] if mode == "d" else MOB_W
        self.fonts = set()
        self.dark = {}

    def dkcls(self, e, bg, color):
        """Class that carries this element's dark-mode colours (applied only inside the dark media query)."""
        if self.d.get("dark") == "off":
            return ""
        dbg = e.get("dbg") or (dark_bg(bg) if bg else "")
        dcol = e.get("dcolor") or (dark_text(color) if color else "")
        css = (f"background-color:{dbg}!important;" if dbg and dbg != bg else "") + (f"color:{dcol}!important;" if dcol and dcol != color else "")
        if not css:
            return ""
        self.dark[e["id"]] = f".dk-{e['id']}{{{css}}}" + (f".dk-{e['id']} a{{color:{dcol}!important}}" if dcol and dcol != color else "")
        return f' class="dk-{e["id"]}"'

    def font(self, key):
        key = key or self.d["font"]
        if FONTS[key][1]:
            self.fonts.add(FONTS[key][1])
        return FONTS[key][0]


def _merge_x(band):
    """Inside one row, things that share horizontal space can't sit side by side: stack them (absolute) as one cell."""
    groups = [[n] for n in band]
    changed = True
    while changed:
        changed = False
        for i in range(len(groups)):
            for j in range(i + 1, len(groups)):
                a, b = _bbox(groups[i]), _bbox(groups[j])
                if a["x"] < b["x"] + b["w"] - 0.5 and b["x"] < a["x"] + a["w"] - 0.5:
                    groups[i] += groups.pop(j)
                    changed = True
                    break
            if changed:
                break
    out = []
    for g in groups:
        if len(g) == 1:
            out.append(g[0])
        else:
            g.sort(key=lambda n: n["e"].get("z", 0))
            out.append({"stack": g, "b": _bbox(g), "kids": [], "e": {"t": "stack", "z": 0}})
    return out


def _rows(nodes, W, cx):
    """Bands of side-by-side elements stacked top to bottom. Returns table HTML of width W."""
    nodes = _merge_overlaps(nodes)
    out, y, i = [], 0, 0
    while i < len(nodes):
        band = [nodes[i]]
        end = nodes[i]["b"]["y"] + nodes[i]["b"]["h"]
        j = i + 1
        while j < len(nodes) and nodes[j]["b"]["y"] < end:
            band.append(nodes[j])
            end = max(end, nodes[j]["b"]["y"] + nodes[j]["b"]["h"])
            j += 1
        start = nodes[i]["b"]["y"]
        out.append(_gap_row(start - y))
        band = _merge_x(band)
        band.sort(key=lambda nd: nd["b"]["x"])
        cells, x = [], 0
        for nd in band:
            b = nd["b"]
            bx = max(b["x"], x)
            cells.append(_spacer_cell(bx - x))
            dy = round(b["y"] - start)
            inner = _element(nd, cx)
            if dy > 0:
                inner = f'<table role="presentation" width="{round(b["w"])}" cellpadding="0" cellspacing="0" border="0"><tr><td height="{dy}" style="height:{dy}px;{_Z}">&nbsp;</td></tr><tr><td valign="top">{inner}</td></tr></table>'
            cells.append(f'<td valign="top" width="{round(b["w"])}" style="width:{round(b["w"])}px">{inner}</td>')
            x = bx + b["w"]
        cells.append(_spacer_cell(W - x))
        out.append(f'<tr><td><table role="presentation" width="{round(W)}" cellpadding="0" cellspacing="0" border="0" style="width:{round(W)}px"><tr>{"".join(cells)}</tr></table></td></tr>')
        y = end
        i = j
    return f'<table role="presentation" width="{round(W)}" cellpadding="0" cellspacing="0" border="0" style="width:{round(W)}px;border-collapse:collapse">{"".join(out)}</table>'


def _border(e):
    return f"border:{e['bw']}px solid {e['bc']};" if e.get("bw") else ""


def _element(node, cx):
    e, b = node["e"], node["b"]
    w, h = round(b["w"]), round(b["h"])
    if node.get("stack"):
        parts = []
        for k in node["stack"]:
            kb = k["b"]
            rel = {"x": kb["x"] - b["x"], "y": kb["y"] - b["y"], "w": kb["w"], "h": kb["h"]}
            if k["kids"]:
                pass
            k2 = dict(k, b=rel)
            parts.append(f'<div style="position:absolute;left:{round(rel["x"])}px;top:{round(rel["y"])}px;width:{round(rel["w"])}px;height:{round(rel["h"])}px">{_element(k2, cx)}</div>')
        return (f'<table role="presentation" width="{w}" cellpadding="0" cellspacing="0" border="0" style="width:{w}px"><tr><td valign="top" height="{h}" style="height:{h}px">'
                f'<div style="position:relative;width:{w}px;height:{h}px">{"".join(parts)}</div></td></tr></table>')
    t = e["t"]
    rad = f"border-radius:{e['radius']}px;" if e.get("radius") else ""
    bg = e.get("bg") if e.get("bg") and e["bg"] != "transparent" else ""
    eff_color = (e.get("color") or cx.d["color"]) if t in ("text", "button") else ""
    bgattr = (f' bgcolor="{bg}"' if bg else "") + cx.dkcls(e, bg, eff_color)
    bgcss = f"background-color:{bg};" if bg else ""
    bw = e.get("bw") or 0
    if t == "rect":
        kids = ""
        if node["kids"]:
            for k in node["kids"]:
                k["b"]["x"] -= b["x"] + bw
                k["b"]["y"] -= b["y"] + bw
            kids = _rows(node["kids"], w - 2 * bw, cx)
        img = _fill_url(e.get("img"), cx.v)
        imgcss = f"background-image:url('{html.escape(img)}');background-size:cover;background-position:center;" if img and URL.match(img) else ""
        imgattr = f' background="{html.escape(img)}"' if imgcss else ""
        return (f'<table role="presentation" width="{w}" cellpadding="0" cellspacing="0" border="0" style="width:{w}px;{rad}{_border(e)}border-collapse:separate;overflow:hidden">'
                f'<tr><td valign="top" height="{h - 2 * bw}" width="{w - 2 * bw}"{bgattr}{imgattr} style="height:{h - 2 * bw}px;{bgcss}{imgcss}{_Z if not kids else ""}">{kids or "&nbsp;"}</td></tr></table>')
    if t == "image":
        src = _fill_url(e.get("src"), cx.v)
        if not URL.match(src or ""):
            return (f'<table role="presentation" width="{w}" cellpadding="0" cellspacing="0" border="0" style="width:{w}px"><tr><td height="{h}" align="center" valign="middle" '
                    f'style="height:{h}px;background:#e6ebf5;color:#8a97b3;font:12px Arial,sans-serif;border-radius:{e["radius"]}px">Add a picture</td></tr></table>')
        size = f"width:{w}px;height:{h}px;object-fit:{e['fit']};" if e["fit"] != "auto" else f"width:{w}px;height:auto;"
        tag = (f'<img src="{html.escape(src)}" width="{w}" {"" if e["fit"] == "auto" else f"height={chr(34)}{h}{chr(34)} "}alt="{html.escape(fill_vars(e.get("alt", ""), cx.v))}" '
               f'style="display:block;border:0;outline:none;text-decoration:none;{size}{rad}">')
        link = _fill_url(e.get("url"), cx.v)
        if URL.match(link or ""):
            tag = f'<a href="{html.escape(link)}" style="text-decoration:none">{tag}</a>'
        return f'<table role="presentation" width="{w}" cellpadding="0" cellspacing="0" border="0" style="width:{w}px;{_border(e)}"><tr><td style="font-size:0;line-height:0">{tag}</td></tr></table>'
    # text + button
    size = e["size"]
    if cx.mode == "m" and isinstance(e.get("m"), dict) and e["m"].get("size"):
        size = e["m"]["size"]
    fam = cx.font(e.get("font"))
    color = e.get("color") or cx.d["color"]
    style = (f"font-family:{fam};font-size:{size}px;line-height:{round(size * e['lh'])}px;color:{color};font-weight:{'700' if e.get('bold') else '400'};"
             f"font-style:{'italic' if e.get('italic') else 'normal'};text-decoration:{'underline' if e.get('underline') else 'none'};"
             f"text-transform:{'uppercase' if e.get('upper') else 'none'};letter-spacing:{e['ls']}px;text-align:{e['align']};margin:0;")
    if t == "button":
        label = _markup(fill_vars(e.get("label", ""), cx.v), color)
        label = re.sub(r"<a [^>]*>(.*?)</a>", r"\1", label)
        url = _fill_url(e.get("url"), cx.v)
        a_open, a_close = (f'<a href="{html.escape(url)}" style="display:block;color:{color};text-decoration:{"underline" if e.get("underline") else "none"};line-height:{max(h - 2 * bw, 8)}px;">', "</a>") if URL.match(url or "") else ("", "")
        return (f'<table role="presentation" width="{w}" cellpadding="0" cellspacing="0" border="0" style="width:{w}px;{rad}{_border(e)}border-collapse:separate;overflow:hidden"><tr>'
                f'<td width="{w - 2 * bw}" height="{h - 2 * bw}" align="{e["align"]}" valign="middle"{bgattr} style="height:{h - 2 * bw}px;{bgcss}{style}">{a_open}{label}{a_close}</td></tr></table>')
    pad = e.get("pad") or 0
    body = _markup(fill_vars(e.get("text", ""), cx.v), cx.d["link"])
    return (f'<table role="presentation" width="{w}" cellpadding="0" cellspacing="0" border="0" style="width:{w}px;{rad}{_border(e)}border-collapse:separate"><tr>'
            f'<td width="{w - 2 * pad - 2 * bw}" height="{max(h - 2 * pad - 2 * bw, 1)}" valign="{e["va"]}"{bgattr} style="height:{max(h - 2 * pad - 2 * bw, 1)}px;{bgcss}{style}padding:{pad}px;{rad}">{body}</td></tr></table>')


def _layout(design, mode, v):
    cx = _Ctx(design, mode, v)
    els = [e for e in design["els"] if not e.get("hid")]
    if mode == "d":
        items = [(e, dict(e["d"])) for e in els]
    else:
        auto = auto_mobile(els)
        items = []
        for e in els:
            m = e.get("m")
            if isinstance(m, dict):
                if m.get("hide"):
                    continue
                items.append((e, {k: m[k] for k in ("x", "y", "w", "h")}))
            elif e["id"] in auto:
                items.append((e, auto[e["id"]]))
    # keep every box on the canvas
    for _, b in items:
        b["x"] = max(0, min(b["x"], cx.W - 8))
        b["w"] = max(8, min(b["w"], cx.W - b["x"]))
    top = _tree(items)
    return _rows(top, cx.W, cx), cx


def render(design, v, subject="", force_dark=False):
    """Returns (html, text). `design` must already be cleaned. v: name, first_name, unsubscribe_url, dashboard_url, ..."""
    v = dict(v)
    v.setdefault("first_name", (v.get("name") or "there").split(" ")[0])
    v["name"] = v.get("name") or "there"
    d_html, dcx = _layout(design, "d", v)
    m_html, mcx = _layout(design, "m", v)
    fonts = sorted(dcx.fonts | mcx.fonts | ({FONTS[design["font"]][1]} if FONTS[design["font"]][1] else set()))
    link = "".join(f'<link href="https://fonts.googleapis.com/css2?family={f}&display=swap" rel="stylesheet">' for f in fonts)
    W, outer = design["w"], design["outer"]
    pre = html.escape(fill_vars(design.get("pre", ""), v))
    page_bg = design["page"]
    rad = design["radius"]

    def card(inner, width, maxw):
        return (f'<table role="presentation" class="dk-card" width="{width}" cellpadding="0" cellspacing="0" border="0" align="center" bgcolor="{page_bg}" '
                f'style="width:{width}px;max-width:{maxw};background:{page_bg};border-radius:{rad}px;border-collapse:separate;overflow:hidden"><tr><td>{inner}</td></tr></table>')
    dark_on = design.get("dark") != "off"
    dark_css = ""
    if dark_on:
        rules = [f"body,.dk-bg{{background-color:{dark_bg(design['bg']) or design['bg']}!important}}", f".dk-card{{background-color:{dark_bg(page_bg) or page_bg}!important}}"] + list(dcx.dark.values()) + [r for k, r in mcx.dark.items() if k not in dcx.dark]
        body_rules = "".join(rules)
        dark_css = body_rules if force_dark else f"@media (prefers-color-scheme:dark){{{body_rules}}}"
    scheme = "light dark" if dark_on else "light"
    doc = (f'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
           f'<meta name="color-scheme" content="{scheme}"><meta name="supported-color-schemes" content="{scheme}"><title>{html.escape(subject or "Rex")}</title>{link}'
           f'<style>:root{{color-scheme:{scheme}}}body{{margin:0;padding:0;-webkit-text-size-adjust:100%}}table{{border-collapse:collapse}}img{{-ms-interpolation-mode:bicubic}}'
           f'.rx-m{{display:none;max-height:0;overflow:hidden;mso-hide:all}}'
           f'@media only screen and (max-width:{BREAKPOINT}px){{.rx-d{{display:none!important;max-height:0!important;overflow:hidden!important}}.rx-m{{display:block!important;max-height:none!important;overflow:visible!important}}.rx-o{{padding:0!important}}}}'
           f'{dark_css}</style></head><body class="dk-bg" style="margin:0;padding:0;background:{design["bg"]}">'
           f'<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">{pre}{"&nbsp;&zwnj;" * 40 if pre else ""}</div>'
           f'<table role="presentation" class="dk-bg" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="{design["bg"]}" style="background:{design["bg"]}"><tr><td align="center" class="rx-o" style="padding:{outer}px 0">'
           f'<div class="rx-d">{card(d_html, W, "100%")}</div>'
           f'<div class="rx-m">{card(m_html, MOB_W, "100%")}</div>'
           f'</td></tr></table></body></html>')
    lines = []
    for e in sorted(design["els"], key=lambda e: (e["d"]["y"], e["d"]["x"])):
        if e.get("hid"):
            continue
        if e["t"] == "text" and e.get("text"):
            lines.append(_plain(fill_vars(e["text"], v)))
        elif e["t"] == "button" and e.get("label"):
            lines.append(f"{fill_vars(e['label'], v)}: {_fill_url(e.get('url'), v)}" if e.get("url") else fill_vars(e["label"], v))
        elif e["t"] == "image" and e.get("alt"):
            lines.append(f"[{fill_vars(e['alt'], v)}]")
    text = "\n\n".join(x for x in lines if x.strip())
    return doc, text


def checks(design):
    """Friendly warnings shown in the builder."""
    out = []
    els = [e for e in design["els"] if not e.get("hid")]
    items = [(e, dict(e["d"])) for e in els]
    for i, (a, ba) in enumerate(items):
        name = a.get("name") or a["t"]
        if a["t"] == "image" and not a.get("src"):
            out.append(f"“{name}” has no picture yet.")
        if a["t"] == "image" and not a.get("alt"):
            out.append(f"“{name}” has no alt text (shown when images are blocked).")
        if a["t"] == "button" and not a.get("url"):
            out.append(f"Button “{name}” has no link.")
        if ba["x"] + ba["w"] > design["w"] + 1:
            out.append(f"“{name}” goes past the right edge.")
    ov = any(_hit(items[i][1], items[j][1]) and not (items[i][0]["t"] == "rect" and _inside(items[j][1], items[i][1])) and not (items[j][0]["t"] == "rect" and _inside(items[i][1], items[j][1]))
             for i in range(len(items)) for j in range(i + 1, len(items)))
    if ov:
        out.append("Some things overlap. That works in Gmail, Apple Mail and most apps, but Outlook.com and Yahoo may show overlapping items one under the other.")
    blob = " ".join(str(e.get(k) or "") for e in els for k in ("text", "label", "url"))
    if els and "{unsubscribe_url}" not in blob and "{unsubscribe_link}" not in blob:
        out.append("There is no unsubscribe or preferences link in this email. Add [Unsubscribe]({unsubscribe_url}) or [Email preferences]({unsubscribe_link}) somewhere. (Gmail still shows its own Unsubscribe button.)")
    if not els:
        out.append("The email is empty.")
    return out[:12]
