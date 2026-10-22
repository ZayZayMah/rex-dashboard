#!/usr/bin/env python3
"""Build public/data/commands-baseline.json from the bot's main.py (static analysis only).

Usage:  python3 tools/extract_commands.py path/to/main.py [out.json]

This is only the FALLBACK catalog. Once the bot is online and the dashboard connector is
installed, the bot pushes its real live command tree and that replaces this file's data.
"""
import ast
import json
import sys
from pathlib import Path

src_path = Path(sys.argv[1])
out_path = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(__file__).resolve().parent.parent / "public/data/commands-baseline.json"
tree = ast.parse(src_path.read_text(encoding="utf-8"))

def lit(node):
    try:
        return ast.literal_eval(node)
    except Exception:
        return None

def kw(call, name):
    for k in call.keywords:
        if k.arg == name:
            return lit(k.value)
    return None

def is_attr(node, *chain):
    parts = []
    while isinstance(node, ast.Attribute):
        parts.append(node.attr)
        node = node.value
    if isinstance(node, ast.Name):
        parts.append(node.id)
    return tuple(reversed(parts)) == chain

groups = {}      # var -> {"name","description","parent"}
parent_of = {}   # var or func -> parent var
funcs = {}       # function name -> command dict
card_groups = []
PUBLIC, OWNER = set(), set()

for node in ast.walk(tree):
    if isinstance(node, ast.Assign) and isinstance(node.value, ast.Call) and is_attr(node.value.func, "app_commands", "Group"):
        if isinstance(node.targets[0], ast.Name):
            groups[node.targets[0].id] = {"name": kw(node.value, "name"), "description": kw(node.value, "description") or ""}

def type_name(ann):
    text = ast.unparse(ann) if ann is not None else "str"
    for key, label in (("User", "user"), ("Member", "user"), ("Role", "role"), ("Channel", "channel"), ("int", "integer"),
                       ("float", "number"), ("bool", "boolean"), ("Attachment", "file"), ("str", "string")):
        if key in text:
            return label
    return "string"

def describe_map(fn):
    out = {}
    for dec in fn.decorator_list:
        if isinstance(dec, ast.Call) and is_attr(dec.func, "app_commands", "describe"):
            for k in dec.keywords:
                out[k.arg] = lit(k.value) or ""
    return out

def build_params(fn):
    desc = describe_map(fn)
    args = fn.args.args[1:]
    defaults = [None] * (len(args) - len(fn.args.defaults)) + list(fn.args.defaults)
    params = []
    for arg, default in zip(args, defaults):
        required = default is None
        ann = arg.annotation
        if isinstance(ann, ast.Subscript) and ast.unparse(ann.value).endswith("Optional"):
            required = False
        params.append({"name": arg.arg.rstrip("_"), "description": desc.get(arg.arg, ""), "required": required,
                       "type": type_name(ann), "choices": [], "min": None, "max": None})
    return params

for node in ast.walk(tree):
    if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
        continue
    for dec in node.decorator_list:
        if not (isinstance(dec, ast.Call) and isinstance(dec.func, ast.Attribute) and dec.func.attr == "command"):
            continue
        name, description = kw(dec, "name") or node.name.replace("_", "-"), kw(dec, "description") or ""
        owner = dec.func.value
        parent = None
        if isinstance(owner, ast.Name) and owner.id in groups:
            parent = owner.id
        elif not (is_attr(owner, "bot", "tree") or is_attr(owner, "app_commands")):
            continue
        staff = any(isinstance(d, ast.Call) and is_attr(d.func, "app_commands", "default_permissions") for d in node.decorator_list)
        funcs[node.name] = {"leaf": name, "description": description, "params": build_params(node), "parent": parent, "staff": staff}

# add_command links and the card-group registrations
for node in ast.walk(tree):
    if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute):
        if node.func.attr == "add_command" and isinstance(node.func.value, ast.Name) and node.args:
            arg = node.args[0]
            if isinstance(arg, ast.Name) and node.func.value.id in groups:
                if arg.id in groups:
                    groups[arg.id]["parent"] = node.func.value.id
                elif arg.id in funcs and not funcs[arg.id]["parent"]:
                    funcs[arg.id]["parent"] = node.func.value.id
            elif isinstance(arg, ast.Call) and is_attr(arg.func, "app_commands", "Command") and node.func.value.id in groups:
                nm, ds = kw(arg, "name"), kw(arg, "description")
                if nm:
                    funcs["__inline_" + node.func.value.id + nm] = {"leaf": nm, "description": ds or "", "params": [], "parent": node.func.value.id, "staff": False}
        if node.func.attr in ("update", "add") and isinstance(node.func.value, ast.Name) and node.func.value.id in ("PUBLIC_COMMANDS", "OWNER_ONLY_COMMANDS"):
            target = PUBLIC if node.func.value.id == "PUBLIC_COMMANDS" else OWNER
            for a in node.args:
                v = lit(a)
                if isinstance(v, str):
                    target.add(v)
                elif isinstance(v, (set, list, tuple)):
                    target.update(x for x in v if isinstance(x, str))
        if isinstance(node.func, ast.Name) and node.func.id == "_register_card_group" and len(node.args) >= 3:
            gname, gdesc, entries = lit(node.args[0]), lit(node.args[1]), lit(node.args[2])
            owner_only = any(k.arg == "owner_only" and lit(k.value) for k in node.keywords)
            if gname and isinstance(entries, dict):
                card_groups.append((gname, gdesc or "", entries, owner_only))

for node in tree.body:
    if isinstance(node, ast.Assign) and isinstance(node.targets[0], ast.Name) and node.targets[0].id in ("PUBLIC_COMMANDS", "OWNER_ONLY_COMMANDS"):
        v = lit(node.value)
        if isinstance(v, set):
            (PUBLIC if node.targets[0].id == "PUBLIC_COMMANDS" else OWNER).update(v)

def group_path(var):
    parts = []
    while var and var in groups:
        parts.append(groups[var]["name"])
        var = groups[var].get("parent")
    return list(reversed(parts))

# parent mapping used by _register_card_group in the bot
CARD_PARENT = {"mod-tools": "global_group", "security": "un_group", "ticket-tools": "un_group", "analytics": "suggest_group",
               "community": "suggest_group", "games-plus": "fun_group", "economy-plus": "custom_command_group",
               "staff-tools": "un_group", "setup-tools": "apply_setup_group"}

commands, group_desc = {}, {}
for var, g in groups.items():
    path = group_path(var)
    if path and all(path):
        group_desc[" ".join(path)] = g["description"]

def access_for(qn, staff, owner_group):
    if qn in OWNER or owner_group:
        return "owner"
    if qn in PUBLIC:
        return "everyone"
    return "staff" if staff else "staff"

for fn in funcs.values():
    path = group_path(fn["parent"]) if fn["parent"] else []
    if fn["parent"] and not all(path):
        continue
    qn = " ".join(path + [fn["leaf"]])
    owner_group = bool(path) and path[0] in ("global", "rex-tools", "ultra-owner")
    commands[qn] = {"name": qn, "description": fn["description"], "params": fn["params"],
                    "access": access_for(qn, fn["staff"], owner_group), "requires": [], "scope": "global"}

for gname, gdesc, entries, owner_only in card_groups:
    parent_var = CARD_PARENT.get(gname, "fun_group")
    base = group_path(parent_var) + [gname]
    group_desc[" ".join(base)] = gdesc
    for leaf, info in entries.items():
        qn = " ".join(base + [leaf])
        summary = info[1] if isinstance(info, (tuple, list)) and len(info) > 1 else ""
        commands.setdefault(qn, {"name": qn, "description": summary[:200], "params": [], "access": "owner" if owner_only else "staff",
                                 "requires": [], "scope": "global"})

out = {"generated_from": "static analysis of main.py", "commands": sorted(commands.values(), key=lambda c: c["name"]), "groups": group_desc}
out_path.parent.mkdir(parents=True, exist_ok=True)
out_path.write_text(json.dumps(out, indent=1, ensure_ascii=False), encoding="utf-8")
print(f"wrote {len(out['commands'])} commands, {len(group_desc)} groups -> {out_path}")
