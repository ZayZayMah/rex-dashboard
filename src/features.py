"""REX dashboard feature schema.

This file decides which settings appear on a server's dashboard page and how
they are validated. The sections below are EXAMPLES: edit them so every `key`
matches a setting your bot really reads (see bot/rex_dashboard.py, `setting()`).

Setting types:
  toggle   True / False
  text     free text            (optional "maxlen")
  number   whole number         ("min", "max")
  select   one of "options"     [{"value": "...", "label": "..."}]
  channel  a text channel of the server ("" = none)
  role     a role of the server ("" = none)

Premium: add  "premium": True  to a single setting, or to a whole section.
The dashboard refuses to change premium settings for servers the bot has not
reported as premium, and the bot API always returns the default for them.
"""
import re

FEATURES = [
    {
        "id": "welcome",
        "name": "Welcome & Roles",
        "icon": "paw",
        "description": "Greet new members and give them a starting role.",
        "settings": [
            {"key": "welcome_enabled", "label": "Welcome messages", "type": "toggle",
             "default": False, "description": "Send a message when someone joins."},
            {"key": "welcome_channel", "label": "Welcome channel", "type": "channel",
             "default": "", "description": "Where welcome messages are posted."},
            {"key": "welcome_message", "label": "Welcome text", "type": "text",
             "default": "Welcome to {server}, {user}!", "maxlen": 500, "multiline": True,
             "description": "Use {user} and {server} as placeholders."},
            {"key": "autorole", "label": "Auto role", "type": "role",
             "default": "", "description": "Role given to every new member."},
        ],
    },
    {
        "id": "moderation",
        "name": "Moderation",
        "icon": "shield",
        "description": "Keep your server tidy and keep a record of actions.",
        "settings": [
            {"key": "mod_log_channel", "label": "Mod log channel", "type": "channel",
             "default": "", "description": "Moderation actions are logged here."},
            {"key": "anti_spam", "label": "Anti-spam", "type": "toggle",
             "default": False, "description": "Detect and remove message spam."},
            {"key": "anti_link", "label": "Block links", "type": "toggle",
             "default": False, "description": "Delete messages containing links from regular members."},
            {"key": "warn_limit", "label": "Warnings before action", "type": "number",
             "default": 3, "min": 1, "max": 10, "description": "How many warnings before REX steps in."},
        ],
    },
    {
        "id": "protection",
        "name": "Advanced Protection",
        "icon": "bolt",
        "premium": True,
        "description": "Raid defence for servers with REX Premium.",
        "settings": [
            {"key": "anti_raid", "label": "Anti-raid", "type": "toggle",
             "default": False, "description": "Detect mass joins and react automatically."},
            {"key": "anti_raid_threshold", "label": "Join threshold", "type": "number",
             "default": 10, "min": 3, "max": 50, "description": "Joins within 10 seconds that count as a raid."},
            {"key": "anti_raid_action", "label": "Raid action", "type": "select",
             "default": "alert",
             "options": [
                 {"value": "alert", "label": "Alert only"},
                 {"value": "timeout", "label": "Timeout new members"},
                 {"value": "kick", "label": "Kick new members"},
             ],
             "description": "What REX does when a raid is detected."},
        ],
    },
]

_CONTROL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


def is_premium(section, setting):
    return bool(setting.get("premium") or section.get("premium"))


def setting_index():
    """key -> (section, setting)"""
    out = {}
    for section in FEATURES:
        for setting in section["settings"]:
            out[setting["key"]] = (section, setting)
    return out


def defaults():
    return {key: s["default"] for key, (_, s) in setting_index().items()}


def public_schema():
    """Schema sent to the browser (adds the effective premium flag per setting)."""
    out = []
    for section in FEATURES:
        out.append({
            "id": section["id"],
            "name": section["name"],
            "icon": section.get("icon", "paw"),
            "description": section.get("description", ""),
            "premium": bool(section.get("premium")),
            "settings": [dict(s, premium=is_premium(section, s)) for s in section["settings"]],
        })
    return out


def validate(setting, value, guild):
    """Return the cleaned value or raise ValueError with a readable message."""
    kind = setting["type"]
    label = setting["label"]

    if kind == "toggle":
        if not isinstance(value, bool):
            raise ValueError(f"{label} must be on or off.")
        return value

    if kind == "text":
        if not isinstance(value, str):
            raise ValueError(f"{label} must be text.")
        cleaned = _CONTROL.sub("", value).strip()
        limit = int(setting.get("maxlen", 200))
        if len(cleaned) > limit:
            raise ValueError(f"{label} must be {limit} characters or fewer.")
        return cleaned

    if kind == "number":
        if isinstance(value, bool) or not isinstance(value, int):
            raise ValueError(f"{label} must be a whole number.")
        low, high = setting.get("min", 0), setting.get("max", 1_000_000)
        if value < low or value > high:
            raise ValueError(f"{label} must be between {low} and {high}.")
        return value

    if kind == "select":
        allowed = {o["value"] for o in setting["options"]}
        if value not in allowed:
            raise ValueError(f"{label} has an invalid choice.")
        return value

    if kind == "channel":
        if value == "":
            return ""
        ids = {c["id"] for c in guild.get("channels", [])}
        if not isinstance(value, str) or value not in ids:
            raise ValueError(f"{label}: that channel was not found in this server.")
        return value

    if kind == "role":
        if value == "":
            return ""
        ids = {r["id"] for r in guild.get("roles", []) if not r.get("managed")}
        if not isinstance(value, str) or value not in ids:
            raise ValueError(f"{label}: that role was not found (or cannot be assigned).")
        return value

    raise ValueError(f"{label} has an unknown type.")


def effective_settings(stored, premium, guild):
    """Stored values + defaults, with premium locks and deleted channels/roles applied."""
    channel_ids = {c["id"] for c in guild.get("channels", [])}
    role_ids = {r["id"] for r in guild.get("roles", []) if not r.get("managed")}
    out = {}
    for key, (section, setting) in setting_index().items():
        value = stored.get(key, setting["default"])
        if is_premium(section, setting) and not premium:
            value = setting["default"]
        if setting["type"] == "channel" and value not in channel_ids:
            value = ""
        if setting["type"] == "role" and value not in role_ids:
            value = ""
        out[key] = value
    return out
