"""Settings-schema helpers.

The schema itself lives in the BOT (bot/rex_dashboard.py -> SECTIONS) and is pushed to
the website, so adding a setting never needs a website change. This module only
validates what the browser sends, using that pushed schema.
"""
import re

SNOWFLAKE = re.compile(r"^\d{15,25}$")
CONTROL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
TIERS = ("free", "premium", "priority", "ultra")
TYPES = ("toggle", "text", "url", "number", "select", "channel", "role", "user", "tags")
TEXT_KINDS = ("text", "announcement")


def clean_str(value, limit):
    if not isinstance(value, str):
        return ""
    return CONTROL.sub("", value).strip()[:limit]


def sanitize_schema(raw):
    """Validate a schema pushed by the bot. Returns a clean dict or raises ValueError."""
    if not isinstance(raw, dict) or not isinstance(raw.get("sections"), list):
        raise ValueError("schema must contain sections")
    out = {"v": int(raw.get("v") or 0), "sections": []}
    seen = set()
    for section in raw["sections"][:30]:
        if not isinstance(section, dict):
            continue
        sec = {
            "id": clean_str(section.get("id"), 40),
            "name": clean_str(section.get("name"), 60),
            "icon": clean_str(section.get("icon"), 20),
            "description": clean_str(section.get("description"), 240),
            "tier": section.get("tier") if section.get("tier") in TIERS else "free",
            "perm": "admin" if section.get("perm") == "admin" else "manage",
            "settings": [],
        }
        for setting in (section.get("settings") or [])[:60]:
            if not isinstance(setting, dict) or setting.get("type") not in TYPES:
                continue
            key = clean_str(setting.get("key"), 80)
            if not key or key in seen:
                continue
            seen.add(key)
            spec = {
                "key": key,
                "label": clean_str(setting.get("label"), 80),
                "type": setting["type"],
                "description": clean_str(setting.get("description"), 300),
                "default": setting.get("default"),
                "tier": setting.get("tier") if setting.get("tier") in TIERS else sec["tier"],
                "perm": ("admin" if setting.get("perm") == "admin" else "manage") if setting.get("perm") else sec["perm"],
            }
            if setting.get("group"):
                spec["group"] = clean_str(setting["group"], 60)
            for flag in ("multiline", "blank_default", "blank_ok", "blank_clears"):
                if setting.get(flag):
                    spec[flag] = True
            for num in ("min", "max", "maxlen", "maxitems"):
                if isinstance(setting.get(num), int) and not isinstance(setting.get(num), bool):
                    spec[num] = setting[num]
            if isinstance(setting.get("kinds"), list):
                spec["kinds"] = [k for k in setting["kinds"] if k in ("text", "announcement", "category", "voice")]
            if setting["type"] == "select":
                options = []
                for option in (setting.get("options") or [])[:25]:
                    if isinstance(option, dict) and isinstance(option.get("value"), (str, int)) and not isinstance(option.get("value"), bool):
                        options.append({"value": option["value"], "label": clean_str(str(option.get("label", option["value"])), 60)})
                if not options:
                    continue
                spec["options"] = options
            sec["settings"].append(spec)
        if sec["id"] and sec["settings"]:
            out["sections"].append(sec)
    return out


def index_schema(schema):
    index = {}
    for section in (schema or {}).get("sections", []):
        for setting in section.get("settings", []):
            index[setting["key"]] = setting
    return index


def validate_value(spec, raw, guild):
    """Return the cleaned value, or raise ValueError(message). The bot validates again."""
    kind, label = spec["type"], spec["label"]

    if kind == "toggle":
        if not isinstance(raw, bool):
            raise ValueError(f"{label} must be on or off.")
        return raw

    if kind == "number":
        if isinstance(raw, bool) or not isinstance(raw, (int, float)) or int(raw) != raw:
            raise ValueError(f"{label} must be a whole number.")
        n = int(raw)
        low, high = spec.get("min", 0), spec.get("max", 10**9)
        if n < low or n > high:
            raise ValueError(f"{label} must be between {low} and {high}.")
        return n

    if kind == "select":
        for option in spec.get("options", []):
            if raw == option["value"] and type(raw) is type(option["value"]):
                return option["value"]
        raise ValueError(f"{label} has an invalid choice.")

    if kind in ("text", "url"):
        if not isinstance(raw, str):
            raise ValueError(f"{label} must be text.")
        text = CONTROL.sub("", raw).strip()
        limit = int(spec.get("maxlen", 200))
        if len(text) > limit:
            raise ValueError(f"{label} must be {limit} characters or fewer.")
        if not text:
            if spec.get("blank_default"):
                return spec.get("default", "")
            if spec.get("blank_ok") or spec.get("blank_clears"):
                return ""
            raise ValueError(f"{label} cannot be empty.")
        if kind == "url" and (not text.startswith(("https://", "http://")) or " " in text):
            raise ValueError(f"{label} must be a direct http(s) link.")
        return text

    if kind == "tags":
        limit_items = int(spec.get("maxitems", 50))
        if not isinstance(raw, list) or len(raw) > limit_items:
            raise ValueError(f"{label} must be a list of up to {limit_items} items.")
        out, seen = [], set()
        for item in raw:
            if not isinstance(item, str):
                raise ValueError(f"{label} must contain only text.")
            value = CONTROL.sub("", item).strip().lower()
            if not value:
                continue
            if len(value) > int(spec.get("maxlen", 100)):
                raise ValueError(f"{label}: an entry is too long.")
            if value not in seen:
                seen.add(value)
                out.append(value)
        return out

    if kind in ("channel", "role", "user"):
        if raw == "" or raw is None:
            return ""
        if not isinstance(raw, str) or not SNOWFLAKE.match(raw):
            raise ValueError(f"{label} is not a valid selection.")
        if kind == "channel":
            kinds = spec.get("kinds") or list(TEXT_KINDS)
            match = [c for c in guild.get("channels", []) if c["id"] == raw]
            if not match or match[0]["type"] not in kinds:
                raise ValueError(f"{label}: that channel was not found (or is the wrong type).")
        elif kind == "role":
            match = [r for r in guild.get("roles", []) if r["id"] == raw and not r.get("managed")]
            if not match:
                raise ValueError(f"{label}: that role was not found.")
        return raw

    raise ValueError(f"{label} has an unknown type.")


def tier_active(guild, tier):
    if tier == "free":
        return True
    return bool(((guild.get("tiers") or {}).get(tier) or {}).get("active"))
