"""Generates src/helper_settings.py from tools/data/settings.json (exported from the bot's real dashboard schema).
Every setting and every page gets its own topics with several worded answers each."""
import json, os, re, collections
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
data = json.load(open(os.path.join(root, "tools", "data", "settings.json")))

TIER = {"free": "is available on **every plan**, Free included", "premium": "needs **Premium** (Ultra includes it)",
        "ultra": "needs **Ultra**", "priority": "is a **Priority** feature"}
TIER_SHORT = {"free": "Free", "premium": "Premium", "ultra": "Ultra", "priority": "Priority"}
SKIP = {"builder", "card", "tickettypes", "ticketpanels", "applyforms", "levelroles"}


def clean(t):
    return re.sub(r"\s+", " ", (t or "").strip())


def sent(t):
    t = clean(t)
    return t if not t or t[-1] in ".!?" else t + "."


def lower_first(t):
    return t[:1].lower() + t[1:] if t and not t[:2].isupper() else t


counts = collections.Counter(s["label"].lower() for sec in data for s in sec["settings"])
OUT = []


def add(title, keys, answers):
    seen, k2 = set(), []
    for k in keys:
        k = clean(k).lower()
        if k and k not in seen:
            seen.add(k)
            k2.append(k)
    OUT.append((title, k2, answers))


def set_howto(s):
    t = s["type"]
    return {"toggle": "flip the switch", "channel": "pick a channel from the list", "role": "pick a role from the list",
            "user": "paste the person's Discord user ID", "text": "type your text into the box", "url": "paste the link",
            "number": "use the number box", "select": "choose an option", "tags": "add your items and press Enter",
            "roles": "pick the roles", "channels": "pick the channels"}.get(t, "change it")


def default_phrase(s):
    d, t = s.get("default"), s["type"]
    if t == "toggle":
        return "**off**" if not d else "**on**"
    if d in (None, "") or t in ("channel", "role", "user", "roles", "channels", "tags"):
        return "**empty** (not set)"
    return f"`{str(d)[:80]}`"


for sec in data:
    S, SD, ST = sec["name"], sec["description"], sec["tier"]
    sk = [S.lower(), f"{S.lower()} page", f"{S.lower()} settings", f"{S.lower()} tab", f"{S.lower()} section", f"{S.lower()} dashboard"]
    names = ", ".join(f"**{s['label']}**" for s in sec["settings"][:8])
    # ---- page level topics
    ctx = {"S": S, "SD": lower_first(sent(SD)), "T": TIER[ST], "TS": TIER_SHORT[ST], "names": names, "n": len(sec["settings"])}
    add(f"Page: {S}", [f"what is {S}", f"what does the {S} page do", f"what is the {S} tab", f"{S} help", f"tell me about {S}", f"explain {S}", f"{S} overview"] + sk,
        [f"The **{S}** page {ctx['SD']} It has {ctx['n']} setting(s), such as {names}. Find it in the [Dashboard](/dashboard) side menu.",
         f"**{S}** in the Dashboard: {SD} Options include {names}.",
         f"Open the [Dashboard](/dashboard), choose your server, then **{S}**. {SD} You'll see {names}.",
         f"Think of **{S}** as the place where Rex {lower_first(sent(SD))} Settings here: {names}.",
         f"{S} is a Dashboard page with {ctx['n']} option(s) ({names}). {SD}"])
    add(f"Page plan: {S}", [f"does {S} need premium", f"is {S} free", f"which plan for {S}", f"{S} premium", f"{S} price", f"{S} plan", f"can free servers use {S}", f"{S} ultra", f"is {S} paid"],
        [f"The **{S}** page {TIER[ST]}. See [Premium](/premium) for the plans.",
         f"{S}: {TIER_SHORT[ST]}. Some individual options on that page can need a higher plan than the page itself; locked ones show a badge in the Dashboard.",
         f"Plan check for **{S}**: it {TIER[ST]}. Compare plans on the [Premium page](/premium).",
         f"Short answer: **{TIER_SHORT[ST]}**. Details are on [Premium](/premium).",
         f"{S} {TIER[ST]}. If something looks greyed out on that page, it needs a higher plan, and the Dashboard tells you which."])
    add(f"Page missing: {S}", [f"cant see {S}", f"{S} missing", f"where is {S}", f"{S} not showing", f"{S} page missing", f"cannot find {S}", f"{S} not in dashboard", f"where do i find {S}"],
        [f"Open the [Dashboard](/dashboard), pick your server and look for **{S}** in the side menu. If it isn't there you may lack the permission (some pages need Administrator), or it's hidden on a small screen: tap the menu button.",
         f"**{S}** lives in the left menu of the [Dashboard](/dashboard) after you choose a server. Pages marked admin-only need the Administrator permission.",
         f"Can't see **{S}**? Make sure you picked the right server, that Rex is in it, and that you have Manage Server (Administrator for admin pages). Then refresh.",
         f"Look in the Dashboard side menu for **{S}**. On a phone, tap the menu icon at the top to open it.",
         f"Log in to the [Dashboard](/dashboard), select the server, and scroll the menu to **{S}**. Still missing? Log out and in again so your permissions refresh."])
    add(f"Page not working: {S}", [f"{S} not working", f"{S} broken", f"{S} wont save", f"{S} problem", f"{S} error", f"{S} doesnt work", f"{S} isnt working", f"{S} issue", f"{S} not saving"],
        [f"If **{S}** isn't working: 1) press **Save** and wait for the green confirmation, 2) check Rex has permission in the channels involved, 3) make sure Rex's role is above any roles it must give, 4) check the plan ({TIER_SHORT[ST]} needed). Still stuck? Tell me which option and what happens.",
         f"Let's fix **{S}**. Did the Dashboard say *Saved*? Does Rex have View/Send permissions in the channel? Is its role high enough? Tell me which setting is failing and I'll narrow it down.",
         f"Most **{S}** problems are missing permissions, a role placed above Rex, or an option that needs a higher plan. Run `/botperms` and re-save the page.",
         f"For **{S}**, check the basics: saved changes, Rex online on [Live stats](/live), correct channel/role chosen, and the right plan. Which part misbehaves?",
         f"Try this for **{S}**: reload the Dashboard, re-save the page, then test again in Discord. If an error message appears, tell me what it says."])
    add(f"Page tips: {S}", [f"{S} tips", f"best {S} settings", f"how to set up {S}", f"set up {S}", f"how do i use {S}", f"{S} guide", f"{S} setup", f"recommended {S} settings", f"{S} best practices"],
        [f"Setting up **{S}**: open it in the [Dashboard](/dashboard), start with the main toggle or channel, then adjust the extras ({names}). Press **Save** and test in Discord.",
         f"Quick start for **{S}**: choose the channel/role it needs first, then the optional extras. Keep it simple, test, then fine-tune.",
         f"Good habit for **{S}**: change one thing, save, and test in your server before moving on. {SD}",
         f"To use **{S}**, go to the Dashboard → **{S}**. {SD} Start with {names.split(', ')[0]}.",
         f"Guide: 1) open **{S}**, 2) set {names.split(', ')[0]}, 3) adjust the rest, 4) save, 5) test. Ask me about any single option for details."])
    add(f"Page reset: {S}", [f"reset {S}", f"undo {S}", f"revert {S}", f"turn off {S}", f"disable {S}", f"remove {S} settings", f"clear {S}", f"undo changes {S}"],
        [f"On **{S}**, use **Discard** before saving to drop your edits. After saving, the Dashboard's activity log lets staff with access undo a change. Toggles can simply be switched off.",
         f"To switch things off on **{S}**, flip the toggles or choose *None* for channels and roles, then **Save**. You can also undo from the activity log.",
         f"Changed your mind about **{S}**? Press **Discard** if you haven't saved, otherwise open the activity log and undo the change, or set the option back by hand.",
         f"There's no single reset button for **{S}**: set each option back (toggle off, channel *None*), save, or undo it from the activity log.",
         f"To undo **{S}** edits: unsaved → **Discard**; saved → activity log → undo, or just change the setting back."])
    # ---- setting level topics
    for s in sec["settings"]:
        if s["type"] in SKIP and s["key"] not in ("application_forms",):
            pass
        L, key = s["label"], s["key"].replace("_", " ")
        ambiguous = counts[L.lower()] > 1
        base_names = [key, f"{S.lower()} {L.lower()}"] + ([] if ambiguous else [L.lower()])
        T, TS = TIER[s["tier"]], TIER_SHORT[s["tier"]]
        desc = sent(s["description"])
        how = set_howto(s)
        dflt = default_phrase(s)
        c = {"L": L, "S": S, "D": desc, "d": lower_first(desc), "T": T, "TS": TS, "how": how, "def": dflt}
        pre = lambda tpl: [tpl.format(n=n) for n in base_names]
        add(f"Setting what: {S}/{L}", sum([pre(t) for t in ("what is {n}", "what does {n} do", "{n} meaning", "explain {n}", "{n} help", "tell me about {n}", "what is the {n} setting", "{n}")], []),
            [f"**{L}** ({S}): {desc} Find it in the [Dashboard](/dashboard) → {S}.",
             f"The **{L}** setting {lower_first(desc)} It's on the **{S}** page.",
             f"{desc} That's **{L}**, under {S} in the [Dashboard](/dashboard).",
             f"In short: **{L}** {lower_first(desc)} (Plan: {TS}.)",
             f"**{L}**: {desc} To change it, {how} on the {S} page and press Save."])
        on_word = "turn on" if s["type"] == "toggle" else "set"
        add(f"Setting how: {S}/{L}", sum([pre(t) for t in ["how to {n}", "how do i set {n}", "how do i change {n}", "how to turn on {n}", "enable {n}", "set {n}", "change {n}", "edit {n}", "configure {n}", "set up {n}", "turn on {n}", "activate {n}"]], []),
            [f"Open the [Dashboard](/dashboard) → **{S}** → **{L}**, {how}, then press **Save**. {desc}",
             f"To {on_word} **{L}**: Dashboard → {S}, {how}, Save. It reaches the bot within a few seconds.",
             f"Go to **{S}** in the [Dashboard](/dashboard), find **{L}**, {how} and save. ({TS} plan.)",
             f"Steps: 1) open the Dashboard, 2) pick your server, 3) **{S}**, 4) {how} for **{L}**, 5) **Save**.",
             f"**{L}** is changed from the Dashboard: {S} page, {how}, then **Save**. {desc}"])
        off_word = "turn it off" if s["type"] == "toggle" else "clear it (choose *None* or empty the box)"
        add(f"Setting off: {S}/{L}", sum([pre(t) for t in ["how to turn off {n}", "disable {n}", "remove {n}", "clear {n}", "turn {n} off", "switch off {n}", "get rid of {n}", "unset {n}", "reset {n}"]], []),
            [f"To switch **{L}** off: Dashboard → **{S}** → {off_word}, then **Save**.",
             f"Open **{S}** in the [Dashboard](/dashboard), find **{L}** and {off_word}. Press **Save** afterwards.",
             f"You can {off_word} for **{L}** on the {S} page. Changed your mind later? Switch it back on the same way.",
             f"Disable **{L}**: {S} page → {off_word} → **Save**. The bot stops using it within seconds.",
             f"**{L}** can be turned off from the Dashboard ({S}): {off_word} and save."])
        add(f"Setting where: {S}/{L}", sum([pre(t) for t in ["where is {n}", "where do i find {n}", "where can i change {n}", "{n} location", "which page is {n} on", "{n} cant find", "{n} missing", "{n} not showing"]], []),
            [f"**{L}** is on the **{S}** page of the [Dashboard](/dashboard). Choose your server first, then {S} in the side menu.",
             f"Find it under **{S}** → **{L}** in the [Dashboard](/dashboard).",
             f"Dashboard → your server → **{S}**. **{L}** is there" + (f", in the *{s['group']}* box." if s.get("group") else "."),
             f"It's in the **{S}** section (side menu). Can't see it? It may need the {TS} plan, or you may lack permission for that page.",
             f"Look for **{L}** on **{S}**. {desc}"])
        add(f"Setting plan: {S}/{L}", sum([pre(t) for t in ("does {n} need premium", "is {n} free", "{n} premium", "which plan for {n}", "{n} ultra", "{n} price", "can free servers use {n}", "{n} locked", "why is {n} locked", "{n} greyed out")], []),
            [f"**{L}** {T}. See [Premium](/premium).",
             f"{L}: plan needed is **{TS}**. If it's greyed out your server doesn't have that plan yet.",
             f"About the plan for **{L}**: it {T}. Compare on [Premium](/premium).",
             f"**{TS}** is what **{L}** needs. Locked options show a badge in the Dashboard.",
             f"Plan check: **{L}** → {TS}. Codes and subscriptions are explained on [Premium](/premium)."])
        add(f"Setting default: {S}/{L}", sum([pre(t) for t in ("default {n}", "what is the default {n}", "{n} default", "{n} default value", "{n} by default", "is {n} on by default", "is {n} enabled by default", "{n} original value")], []),
            [f"By default **{L}** is {dflt}.",
             f"Out of the box, **{L}** is {dflt}. Change it on the {S} page.",
             f"Default for **{L}**: {dflt}.",
             f"New servers start with **{L}** set to {dflt}.",
             f"**{L}** starts as {dflt} until you change it in **{S}**."])
        add(f"Setting trouble: {S}/{L}", sum([pre(t) for t in ("{n} not working", "{n} doesnt work", "why isnt {n} working", "{n} broken", "{n} wont save", "{n} error", "{n} problem", "{n} issue", "{n} not saving", "fix {n}", "{n} stopped working", "{n} bug")], []),
            [f"If **{L}** isn't working: save the **{S}** page and wait for *Saved*, check Rex has permission where it needs to act, make sure its role is above any role involved, and confirm the plan ({TS}). {desc}",
             f"Troubleshooting **{L}**: 1) is it saved? 2) is Rex online ([Live stats](/live))? 3) permissions/role order, 4) does your plan include it ({TS})? Tell me what happens and I'll help further.",
             f"**{L}** problems are usually permissions, role order or the plan. Run `/botperms`, re-save **{S}**, then try again.",
             f"Check these for **{L}**: the value is saved, the chosen channel/role still exists, Rex can see/use it, and the {TS} plan is active.",
             f"Reload the Dashboard, re-save **{S}** and test again. If an error shows, send me its text. Your plan for **{L}** must be {TS}."])
        add(f"Setting example: {S}/{L}", sum([pre(t) for t in ("{n} example", "example of {n}", "{n} tips", "best {n}", "recommended {n}", "{n} ideas", "{n} suggestion", "how should i set {n}")], []),
            [f"Example for **{L}**: {desc} Start simple, save, test in Discord, then refine.",
             f"A good way to use **{L}**: {lower_first(desc)} Change one thing at a time and test.",
             f"Tip for **{L}** ({S}): {desc} Check the result in your server right after saving.",
             f"Not sure how to set **{L}**? {desc} The default is {dflt}, which is a safe starting point.",
             f"Idea: configure **{L}** on the {S} page, save, and try it with a test member or channel."])


# a sixth wording for every setting-level topic
SIXTH = {
    "what": "Quick summary of **{L}**: {D} It sits on the **{S}** page.",
    "how": "Need to change **{L}**? Dashboard → {S} → {L} → Save. {D}",
    "off": "Want **{L}** gone? Dashboard → {S}, switch it off or clear it, then Save.",
    "where": "You'll find **{L}** by opening the Dashboard, choosing your server and clicking **{S}**.",
    "plan": "For **{L}** you need the **{TS}** plan; check [Premium](/premium) if it's locked.",
    "default": "Unless you change it, **{L}** stays {def}.",
    "trouble": "Still no luck with **{L}**? Re-save **{S}**, check Rex's permissions and role order, and confirm the {TS} plan. Tell me exactly what you see.",
    "example": "Try **{L}** with a small test first: save it on **{S}**, then watch it work in your server. {D}",
}
_meta = {}
for sec in data:
    for st in sec["settings"]:
        _meta[f"{sec['name']}/{st['label']}"] = {"L": st["label"], "S": sec["name"], "D": sent(st["description"]), "TS": TIER_SHORT[st["tier"]], "def": default_phrase(st)}
for title, keys, answers in OUT:
    if title.startswith("Setting "):
        kind, rest = title[8:].split(": ", 1)
        if kind in SIXTH:
            answers.append(SIXTH[kind].format(**_meta[rest]))

# ---------- cross-cutting "which page has X" topics
for sec in data:
    for s in sec["settings"]:
        pass

with open(os.path.join(root, "src", "helper_settings.py"), "w") as f:
    f.write('"""Generated by tools/build_helper_settings.py. Do not edit by hand."""\nTOPICS = ')
    f.write(json.dumps([{"title": t, "keys": k, "answer": a, "tags": ["setting"]} for t, k, a in OUT], ensure_ascii=False, indent=0))
    f.write("\n")
print(len(OUT), "topics", sum(len(a) for _, _, a in OUT), "answers", sum(len(k) for _, k, _ in OUT), "phrasings")
