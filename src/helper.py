"""
Rex's support brain. Pure Python (no Worker imports) so it can be tested alone.

Everything the helper says is decided HERE, on the server, never by the browser, so nobody can make it say or do
something by editing the page. A conversation is a small script per ticket type (onboarding questions with quick-reply
buttons), wrapped in a layer that understands small talk, yes/no in many wordings, abuse, gibberish and requests for a person.
A ticket on the Discord server is only offered after the onboarding has real answers in it, and always needs a click on
"Yes, open a ticket", so spamming letters or asking over and over can't get a person.
"""
import random
import re

from helper_data import KB

R = random.choice
INVITE = "https://discord.gg/2JSVqkVdeq"


def _n(s):
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9' ]+", " ", str(s).lower())).strip()


def _lev(a, b):
    if abs(len(a) - len(b)) > 2:
        return 3
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def _close(w, k):
    return w == k or (len(w) >= 4 and _lev(w, k) <= (2 if len(w) >= 8 else 1))


STOP = set("the a an to my i is it how do can what and of in on me you for with this that are does not im ive be was were have has had".split())

# ----------------------------------------------------------------------------------------------- understanding words
def _rx(words):
    return re.compile(r"(?:^|\b)(?:" + "|".join(words) + r")(?:\b|$)")


YES = _rx([r"y", r"ye", r"yes", r"yeah", r"yea", r"yep", r"yup", r"ya", r"yas", r"yh", r"sure", r"ok", r"okay", r"k", r"definitely", r"absolutely", r"correct", r"right", r"exactly",
           r"of course", r"please do", r"go ahead", r"do it", r"sounds good", r"that works", r"works for me", r"fine by me", r"yes please", r"yes it was", r"yes it did", r"it did",
           r"it was", r"that helped", r"it helped", r"helpful", r"very helpful", r"useful", r"it was useful", r"perfect", r"great", r"awesome", r"nice", r"solved", r"fixed", r"that fixed it",
           r"that worked", r"it worked", r"got it", r"i got it", r"understood", r"i do", r"i did", r"sure thing", r"why not", r"let's do it", r"lets do it", r"affirmative", r"please"])
NO = _rx([r"n", r"no", r"nope", r"nah", r"naw", r"nay", r"not really", r"not quite", r"not exactly", r"didn't", r"didnt", r"did not", r"doesn't", r"doesnt", r"does not", r"wasn't",
          r"wasnt", r"was not", r"it wasn't", r"it wasnt", r"no thanks", r"no thank you", r"nothing", r"never mind", r"nevermind", r"nvm", r"not helpful", r"not useful",
          r"unhelpful", r"useless", r"that didn't help", r"that didnt help", r"didn't help", r"didnt help", r"no it didn't", r"no it didnt", r"not at all", r"i don't", r"i dont",
          r"negative", r"no way"])
PARTLY = _rx([r"kind of", r"kinda", r"sort of", r"sorta", r"a little", r"a bit", r"partly", r"partially", r"somewhat", r"half", r"maybe", r"i guess", r"not sure"])
THANKS = _rx([r"thanks", r"thank you", r"thankyou", r"thx", r"ty", r"tysm", r"tyvm", r"cheers", r"much appreciated", r"appreciate it", r"appreciated", r"many thanks", r"thanks a lot", r"thank u"])
GREET = _rx([r"hi", r"hii+", r"hey+", r"hello+", r"hiya", r"howdy", r"yo", r"sup", r"wassup", r"whats up", r"what's up", r"good morning", r"good afternoon", r"good evening", r"greetings", r"hola", r"heya", r"hey there", r"hi there"])
BYE = _rx([r"bye", r"goodbye", r"cya", r"see you", r"see ya", r"later", r"gtg", r"got to go", r"gotta go", r"i have to go", r"talk later", r"good night", r"night", r"take care", r"cheerio"])
DONE = _rx([r"that's all", r"thats all", r"that is all", r"nothing else", r"i'm good", r"im good", r"all good", r"all set", r"that's it", r"thats it", r"no more questions", r"i'm done", r"im done",
            r"i am done", r"we're done", r"were done", r"no that's all", r"no thats all", r"that will be all", r"that'll be all", r"nope that's all", r"nothing more", r"i'm all set", r"im all set"])
HUMAN = _rx([r"human", r"a person", r"real person", r"real human", r"someone real", r"staff", r"a staff member", r"team member", r"the team", r"an owner", r"the owner", r"a mod", r"a moderator",
             r"an admin", r"an agent", r"support agent", r"customer service", r"representative", r"speak to", r"talk to", r"speak with", r"talk with", r"real support", r"ticket", r"escalate"])
HOW_ARE_YOU = _rx([r"how are you", r"how are u", r"how r u", r"hows it going", r"how's it going", r"how you doing", r"how do you do", r"you ok", r"you okay", r"how have you been", r"hru"])
WHO_ARE_YOU = _rx([r"who are you", r"what are you", r"are you a bot", r"are you real", r"are you human", r"are you a person", r"are you ai", r"are you an ai", r"is this a bot", r"is this a person",
                   r"who am i talking to", r"who is this", r"whats your name", r"what's your name", r"your name"])
WHAT_CAN = _rx([r"what can you do", r"what do you do", r"how can you help", r"what can u do", r"help me", r"can you help", r"i need help", r"need help", r"help", r"assist"])
REPEAT = _rx([r"what", r"huh", r"pardon", r"sorry", r"come again", r"say that again", r"repeat", r"repeat that", r"i don't understand", r"i dont understand", r"dont understand", r"don't understand",
              r"what do you mean", r"what does that mean", r"confused", r"i'm confused", r"im confused", r"unclear", r"explain", r"what\?", r"wdym"])
UNSURE = _rx([r"idk", r"i don't know", r"i dont know", r"dunno", r"no idea", r"not sure", r"unsure", r"i'm not sure", r"im not sure", r"don't know", r"dont know", r"i have no idea"])
COMPLIMENT = _rx([r"you're great", r"youre great", r"you are great", r"good bot", r"good job", r"nice one", r"well done", r"you're awesome", r"youre awesome", r"love you", r"you rock", r"cool bot", r"smart bot", r"amazing", r"you're helpful", r"youre helpful"])
JOKE = _rx([r"tell me a joke", r"joke", r"say something funny", r"make me laugh", r"funny"])
CANCEL = _rx([r"cancel", r"stop", r"never mind", r"nevermind", r"forget it", r"forget about it", r"i changed my mind", r"changed my mind", r"leave it", r"don't bother", r"dont bother", r"skip", r"abort", r"quit", r"exit", r"end chat", r"close chat", r"close this", r"end this"])
WAIT = _rx([r"wait", r"hold on", r"one sec", r"one second", r"give me a sec", r"just a moment", r"brb", r"hang on", r"hold up", r"one moment"])

SEVERE = re.compile(r"(kill (yourself|urself)|kys\b|i('| wi)ll (kill|hurt|find|dox|ddos|hack|swat)|\bdox+(ed|ing)?\b|\bddos\b|\bswat(ting)?\b|\bn[i1]gg|\bf[a4]gg?[o0]t|\bretard|\bwhore|\bcunt|\brape\b|\bbomb threat|\bhope you die|\bgo die)", re.I)
MILD = re.compile(r"\b(fuck\w*|f+u+c+k+|shit\w*|bullshit|bitch\w*|asshole|dickhead|bastard|wanker|twat|slut|piss off|stfu|screw you|you suck|piece of crap|crap bot|stupid bot|dumb bot|idiot|moron|useless bot|trash bot|garbage bot|shut up|shut the fuck|damn it|dumbass|jackass|prick|wtf)\b", re.I)

# ----------------------------------------------------------------------------------------------- gibberish
COMMON = set("""the be to of and a in that have i it for not on with he as you do at this but his by from they we say her she or an will my one all would there their what so up out if about who get which go me when make can like time no just him know take people into year your good some could them see other than then now look only come its over think also back after use two how our work first well way even new want because any these give day most us is are was were been has had did does am im ive dont doesnt cant wont didnt isnt arent wasnt hello hi hey help please thanks thank yes no ok okay yeah nope sure bot rex discord server servers premium code codes ticket tickets ban banned blacklist blacklisted appeal command commands dashboard website site page level levels xp role roles channel channels message messages welcome leave logs mod moderation automod settings setup add invite link error bug issue problem broken working work works worked fix fixed need needs trying tried try cannot cant see open opened close closed delete deleted account email email login log sign signed change changed update updated feature features support team staff owner admin member members user users bought paid payment charged refund tier tier priority ultra free trial redeem redeemed expire expired
 when where why how which while should must might much many more less very really too still again always never sometimes once only twice every each both either neither""".split())
KEYROWS = ("qwertyuiop", "asdfghjkl", "zxcvbnm", "1234567890")
VOW = set("aeiou")


def _word_gib(w):
    w = re.sub(r"[^a-z]", "", w.lower())
    if len(w) < 4 or w in COMMON:
        return False
    if any(w in row or w[::-1] in row for row in KEYROWS) or any(w[i:i + 4] in row for row in KEYROWS for i in range(len(w) - 3)):
        return True
    v = sum(1 for ch in w if ch in VOW)
    if v == 0 and len(w) >= 4:
        return True
    if len(w) >= 5 and v / len(w) < 0.2:
        return True
    if re.search(r"[^aeiou]{5,}", w):
        return True
    if re.search(r"(.)\1{3,}", w):
        return True
    return False


def gibberish(text):
    t = str(text or "")
    if re.search(r"https?://|\d{6,}", t):
        return False
    words = re.findall(r"[A-Za-z']+", t)
    if not words:
        return len(t.strip()) >= 4 and not re.search(r"\w", t)   # only symbols/emoji spam
    bad = sum(1 for w in words if _word_gib(w))
    real = sum(1 for w in words if w.lower().strip("'") in COMMON or w.lower().strip("'") in KB_WORDS)
    if bad and bad >= max(1, round(len(words) * 0.5)) and real < max(1, len(words) // 2):
        return True
    if len(words) == 1 and len(words[0]) >= 6 and words[0].lower() not in COMMON and words[0].lower() not in KB_WORDS:
        w = words[0].lower()
        v = sum(1 for ch in w if ch in VOW)
        if v / len(w) < 0.3 or len(set(w)) / len(w) < 0.45:
            return True
    return False


KB_WORDS = set()
for _it in KB:
    for _k in _it["keys"] + [_it["title"]]:
        KB_WORDS.update(_n(_k).split())


def meaningful(text):
    t = str(text or "").strip()
    if len(t) < 6 or gibberish(t):
        return False
    words = [w for w in re.findall(r"[A-Za-z0-9']+", t)]
    return len(words) >= 2 or len(t) >= 12


# ----------------------------------------------------------------------------------------------- knowledge lookup
def find_answer(text, extra=None):
    words = [w for w in _n(text).split() if w and w not in STOP]
    if not words:
        return None
    best, score = None, 0
    for it in list(KB) + list(extra or []):
        for key in it.get("keys", []):
            kw = [w for w in _n(key).split() if w and w not in STOP]
            if not kw:
                continue
            hit = sum(1 for k in kw if any(_close(w, k) for w in words))
            s = hit / len(kw) * (1.4 if len(kw) > 1 else 1) * (1.3 if hit == len(kw) else 1)
            if hit and s > score:
                score, best = s, it
    return best if score >= 0.9 else None


def kb_by_title(title):
    for it in KB:
        if it["title"] == title:
            return it
    return None


# ----------------------------------------------------------------------------------------------- small phrases
def ack():
    return R(["Got it.", "Thanks.", "Okay.", "Alright.", "Understood.", "Thanks for that.", "Makes sense.", "Okay, noted.", "Right.", "Good to know."])


SMALL = {
    "greet": ["Hey! 👋", "Hi there!", "Hello! Nice to see you.", "Hey, good to hear from you.", "Hi! I'm here."],
    "how": ["Doing great, thanks for asking! Let's get you sorted.", "All good on my side. How about you? Let's get this solved.", "Running smoothly, thank you! Now, about your question…", "I'm well! Ready to help whenever you are."],
    "who": ["I'm Rex, the automated helper for the Rex bot. I can answer a lot of questions myself, and if I can't, I'll open a ticket so a real person from the team can help.",
            "I'm Rex, a bot (not a person). I ask a few questions first so the team has everything they need if a human has to step in.",
            "Rex here! I'm an automated assistant. A real team member joins through a ticket on our Discord when it's needed."],
    "what": ["I can answer questions about adding and setting up Rex, commands, Premium, tickets and more. If it needs a person, I'll open a ticket for you.",
             "Mostly: quick answers, troubleshooting steps, and passing the right details to the team when something needs a human."],
    "thanks": ["You're welcome! 💙", "Happy to help!", "Anytime!", "No problem at all.", "Glad I could help!", "My pleasure."],
    "compliment": ["That's kind of you, thank you! 💙", "Aw, thanks! I do my best.", "Thank you, that made my day (as far as bots have days)."],
    "joke": ["Why did the bot go to therapy? Too many unresolved dependencies. 😄", "I'd tell you a UDP joke, but you might not get it.", "There are 10 kinds of people: those who understand binary and those who don't."],
    "wait": ["Take your time, I'm not going anywhere.", "No rush. I'll be here.", "Sure, whenever you're ready."],
    "unsure": ["That's okay! Pick whichever is closest and we'll narrow it down.", "No worries, let's figure it out together.", "Totally fine. Choose the nearest one below and I'll adjust."],
    "repeat": ["Sure, let me say that differently.", "Of course, here it is again.", "Sorry, that wasn't clear. Let me try again."],
}


def say(kind):
    return R(SMALL[kind])


# ----------------------------------------------------------------------------------------------- scripts
YN = [("Yes", "yes"), ("No", "no")]
OPEN_T = ("Yes, open a ticket", "ticket")
NO_T = ("No thanks", "noticket")
ENDC = ("That's all, thanks", "done")
TOPICS = [("Setting up Rex", "setup"), ("A command isn't working", "commands"), ("Premium & codes", "premium"), ("Moderation", "moderation"), ("Tickets", "tickets"), ("Something else", "other")]
LEAFS = {
    "setup": [("Add Rex to my server", "Adding Rex"), ("I can't see my server", "Not seeing my server"), ("Change settings", "Settings"), ("Welcome messages", "Welcome messages"), ("Something else", "?")],
    "commands": [("Rex isn't replying", "Rex offline"), ("Missing permissions", "Permissions"), ("Custom commands", "Custom commands"), ("Levels / XP", "Levels and XP"), ("Something else", "?")],
    "premium": [("Redeem a code", "Premium codes"), ("What does Premium give?", "What Premium gives"), ("Free trial", "Free trial"), ("Something else", "?")],
    "moderation": [("AutoMod", "AutoMod"), ("Logs", "Logs"), ("Moderation commands", "Moderation commands"), ("Verification", "Verification"), ("Something else", "?")],
    "tickets": [("Set up tickets", "Tickets"), ("Ticket buttons don't work", "Tickets"), ("Something else", "?")],
}

ASK = {
    "topic": ["What do you need help with?", "Happy to help! What's this about?", "Let's get started. What's it about?", "What can I help you with today?"],
    "leaf": ["Got it. What are you trying to do?", "Okay. Which of these is closest?", "Thanks. What exactly is happening?"],
    "describe": ["Could you tell me a bit more? A sentence or two is perfect.", "Describe it in your own words and I'll see what I can find.", "Tell me a little more about what's going on."],
    "helpful": ["Was this information useful?", "Did that help?", "Does that answer your question?", "Did that solve it?"],
    "more": ["Is there anything else I can help with?", "Anything else on your mind?", "Want help with anything else?"],
    "offer": ["I can pass all of this to the Rex team in a ticket on our Discord server. Want me to open one?", "This sounds like one for the team. Should I open a ticket for you?",
              "I'll need a person for this one. Shall I open a ticket on our Discord with everything you've told me?"],
}


def _turn(say_list, chips=None, step=None, data=None, action=None, **kw):
    t = {"say": [s for s in say_list if s], "chips": chips or [], "step": step, "data": data or {}, "action": action}
    t.update(kw)
    return t


def new_flow(typ):
    return {"step": "start", "data": {}, "noise": 0, "strikes": 0, "good": 0, "last": "", "dupe": 0, "typ": typ}


def begin(typ, name):
    first = name.split(" ")[0] if name else "there"
    hello = {"help": f"Hi {first}! I'm **Rex**. I'll ask a couple of quick questions so I can help properly.",
             "bug": f"Hi {first}! I'm **Rex**. Sorry something's broken, let's get it written up so it can be fixed.",
             "premium": f"Hi {first}! I'm **Rex**. Let's sort out your Premium question.",
             "appeal": f"Hi {first}, I'm **Rex**. I'll take a few details about your appeal first so the team can review it properly."}[typ]
    f = new_flow(typ)
    t = _first(typ)
    f["step"] = t["step"]
    return {"say": [hello] + t["say"], "chips": t["chips"], "flow": f}


def _first(typ):
    if typ == "help":
        return _turn([R(ASK["topic"])], TOPICS, "topic")
    if typ == "bug":
        return _turn(["What kind of problem is it?"], [("A command", "command"), ("The website / dashboard", "website"), ("Rex is offline", "offline"), ("Something else", "other")], "b_kind")
    if typ == "premium":
        return _turn(["What's going on with Premium?"], [("Redeem a code", "redeem"), ("My code isn't working", "badcode"), ("I paid but no Premium", "paid"), ("What does it include?", "info"), ("Something else", "other")], "p_issue")
    return _turn(["What would you like to appeal?"], [("Blacklist", "blacklist"), ("Server ban", "serverban"), ("A warning or mute", "warn"), ("Something else", "other")], "a_what")


# ----------------------------------------------------------------------------------------------- the conversation engine
def _chip_match(text, chips):
    low = _n(text)
    best, bs = None, 0
    for label, val in chips:
        lw = [w for w in _n(label).split() if w not in STOP]
        tw = [w for w in low.split() if w not in STOP]
        if not lw or not tw:
            continue
        hit = sum(1 for k in lw if any(_close(w, k) for w in tw))
        s = hit / len(lw)
        if hit and s > bs:
            best, bs = val, s
    return best if bs >= 0.6 else None


def _kind(low):
    """Small-talk / intent label for short messages."""
    if not low:
        return None
    words = low.split()
    short = len(words) <= 7
    if DONE.search(low) and short:
        return "done"
    if CANCEL.search(low) and short:
        return "cancel"
    if THANKS.search(low) and short and not YES.search(low.replace("thanks", "")) and not NO.search(low):
        return "thanks"
    if short and NO.search(low) and not re.search(r"\b(yes|yeah|yep)\b", low):
        return "no"
    if short and PARTLY.search(low):
        return "partly"
    if short and YES.search(low):
        return "yes"
    if HOW_ARE_YOU.search(low) and short:
        return "how"
    if WHO_ARE_YOU.search(low) and short:
        return "who"
    if JOKE.search(low) and short:
        return "joke"
    if COMPLIMENT.search(low) and short:
        return "compliment"
    if WAIT.search(low) and short:
        return "wait"
    if UNSURE.search(low) and short:
        return "unsure"
    if REPEAT.search(low) and len(words) <= 5:
        return "repeat"
    if HUMAN.search(low) and re.search(r"\b(human|person|staff|team|owner|mod|moderator|admin|agent|someone|representative|support|ticket|escalate)\b", low):
        return "human"
    if BYE.search(low) and short:
        return "bye"
    if GREET.search(low) and len(words) <= 4:
        return "greet"
    if WHAT_CAN.search(low) and len(words) <= 6:
        return "what"
    return None


def _again(f, extra_prefix=None):
    """Re-ask the current step."""
    t = _step_prompt(f)
    pre = [extra_prefix] if extra_prefix else []
    return _turn(pre + t["say"], t["chips"], f["step"])


def _summary(f):
    d = f["data"]
    lines = [f"• **{k}:** {v}" for k, v in d.get("_sum", [])]
    return "\n".join(lines)


def _step_prompt(f):
    """What to say (and which buttons) for the step we're on."""
    s, d, typ = f["step"], f["data"], f["typ"]
    if s in ("start", "topic"):
        return _turn([R(ASK["topic"])], TOPICS)
    if s == "leaf":
        return _turn([R(ASK["leaf"])], [(l, v) for l, v in LEAFS.get(d.get("topic"), LEAFS["setup"])])
    if s in ("describe", "describe2"):
        return _turn([R(ASK["describe"])])
    if s == "helpful":
        return _turn([R(ASK["helpful"])], [("Yes", "yes"), ("Not really", "no"), ("Partly", "partly")])
    if s == "more":
        return _turn([R(ASK["more"])], [("Yes, something else", "more"), ENDC])
    if s == "offer":
        return _turn([R(ASK["offer"])], [OPEN_T, NO_T])
    if s == "confirm":
        return _turn(["Here's what I'll send to the team:\n\n" + _summary(f) + "\n\nShall I open the ticket?"], [OPEN_T, NO_T])
    if s == "end":
        return _turn(["If you need anything else, you can start a new chat any time."], [])
    if typ == "bug":
        return {"b_kind": _turn(["What kind of problem is it?"], [("A command", "command"), ("The website / dashboard", "website"), ("Rex is offline", "offline"), ("Something else", "other")]),
                "b_where": _turn(["Which command or page was it? (for example `/ban` or the Levels page)"]),
                "b_what": _turn(["What did you do, what happened, and what did you expect instead?"]),
                "b_freq": _turn(["Does it happen every time?"], [("Every time", "always"), ("Sometimes", "sometimes"), ("Only once", "once")])}.get(s, _first(typ))
    if typ == "premium":
        return {"p_issue": _first("premium"),
                "p_server": _turn(["Which server is this for? The name or ID is fine."]),
                "p_what": _turn(["What happened? For example the message you saw, or roughly when you paid."])}.get(s, _first(typ))
    if typ == "appeal":
        return {"a_what": _first("appeal"),
                "a_scope": _turn(["Is it a **server** that's blacklisted, or your own **account**?"], [("My server", "server"), ("My account", "account")]),
                "a_where": _turn(["Which server is this about? The name or ID is fine."]),
                "a_when": _turn(["When did it happen, and what reason were you given (if any)?"]),
                "a_why": _turn(["Why do you think it should be lifted? Be as clear as you can, the team reads this."]),
                "a_extra": _turn(["Is there anything else the team should know?"], [("No, that's everything", "no"), ("Yes", "yes")]),
                "a_extra_text": _turn(["Go ahead, add anything else here."])}.get(s, _first(typ))
    return _first(typ)


def reply(c, text, choice, extra_kb=None):
    """c: the chat. Returns a turn dict: say (list of strings), chips, step, data (merged), action (None|ticket|timeout|close_noise), flow bookkeeping applied by caller."""
    f = c["flow"]
    text = str(text or "").strip()
    typ = f["typ"]
    d = f["data"]

    # ---- buttons: trust only the value (the caller verified it was one of our buttons)
    if choice:
        return _on_input(f, typ, d, choice, True, choice, extra_kb)

    # ---- abuse
    if SEVERE.search(text):
        f["strikes"] += 3
        return _turn(["I can't continue this conversation with that kind of language. I'm pausing this chat while the team takes a look."], step="end", action="timeout", reason="severe language")
    if MILD.search(text):
        f["strikes"] += 1
        if f["strikes"] >= 3:
            return _turn(["That's the third time, so I'm ending this chat. The team will review it before you can start another."], step="end", action="timeout", reason="repeated inappropriate language")
        if f["strikes"] == 2:
            return _again(f, R(["I'll ask you once more to keep it respectful. If it continues I'll have to end the chat.", "Please keep it friendly. I'm trying to help, and I'll end this chat if the language continues."]))
        return _again(f, R(["Let's keep it friendly please. I'm happy to help!", "I get that it's frustrating, but let's keep it respectful so I can help.", "No need for that, let's get this sorted together."]))

    # ---- repeated identical messages and keyboard mashing
    low = _n(text)
    if low and low == f.get("last"):
        f["dupe"] = f.get("dupe", 0) + 1
    else:
        f["dupe"] = 0
    f["last"] = low
    if gibberish(text) or f["dupe"] >= 2:
        f["noise"] += 1
        if f["noise"] >= 5:
            return _turn(["I'm not able to understand these messages, so I'll close this chat for now. You can start a new one whenever you're ready."], step="end", action="noise")
        if f["noise"] >= 3:
            return _again(f, "I still can't read that. I can only continue if I understand you, so please pick one of the buttons or write a short sentence.")
        return _again(f, R(["Sorry, I couldn't make sense of that. Could you try again, or use one of the buttons?", "Hmm, that didn't come through clearly. Could you rephrase?", "I didn't catch that. Try a short sentence or tap a button."]))

    # ---- understanding what they meant
    return _on_input(f, typ, d, text, False, None, extra_kb)


def _on_input(f, typ, d, text, is_choice, choice, extra_kb):
    step = f["step"]
    low = _n(text) if not is_choice else ""
    kind = None if is_choice else _kind(low)

    # buttons shared by several steps
    if is_choice and choice in ("done",):
        f["good"] += 0
        return _turn([R(["Glad I could help! Take care. 💙", "You're welcome, have a great day!", "Anytime! Come back if you need anything."])], step="end", action="done")
    if is_choice and choice == "more":
        f["step"] = "topic" if typ == "help" else f["step"]
        d.clear()
        t = _first(typ)
        return _turn(["Sure!"] + t["say"], t["chips"], t["step"])
    if is_choice and choice == "noticket":
        return _turn([R(["No problem, I won't open one. If you change your mind, just start a new chat.", "Okay, no ticket. Anything else I can do?"])], [("Yes, something else", "more"), ENDC], "more")
    if is_choice and choice == "ticket":
        return _ticket_gate(f, d)

    # small talk (in the middle of anything) never advances the script
    if kind in ("greet", "how", "who", "what", "thanks", "compliment", "joke", "wait", "repeat", "unsure", "bye") and step not in ("helpful", "more", "offer", "confirm"):
        first = say(kind if kind != "bye" else "thanks") if kind not in ("repeat",) else say("repeat")
        if kind == "bye":
            return _turn([R(["Bye for now! You can come back any time.", "See you! Take care. 💙"])], step=step)
        return _again(f, first if kind != "repeat" else first)
    if kind == "cancel":
        return _turn([R(["No problem, I've stopped here. You can start a new chat any time.", "Okay, cancelled. Nothing was sent to anyone."])], [("Start over", "more"), ENDC], "more")
    if kind == "human" and step not in ("offer", "confirm"):
        return _human_request(f, typ, d)

    # ---- per step logic
    return _STEPS.get(step, _s_default)(f, typ, d, text, is_choice, choice, kind, extra_kb)


def _human_request(f, typ, d):
    if f["noise"] >= 3 or f["good"] < 1:
        return _again(f, R(["I'd be happy to get a person involved. I just need a few details first so they can help quickly.", "A team member can step in, but first I need a couple of answers from you so nobody has to ask them again.",
                            "Sure! Let's finish these questions first, then I'll offer to open a ticket for you."]))
    f["step"] = "confirm" if d.get("_sum") else "offer"
    return _turn([R(["Okay, I'll get the team involved.", "Sure, a person can take it from here.", "Understood, let's get you to the team."])] + _step_prompt(f)["say"], _step_prompt(f)["chips"], f["step"])


def _ticket_gate(f, d):
    if f["noise"] >= 3 or f["good"] < 1:
        return _again(f, "I can only open a ticket once I know what's going on. Please answer the question first.")
    if f["step"] not in ("offer", "confirm"):
        return _again(f, "Let's finish the questions first, then I'll offer to open a ticket.")
    return _turn([R(["Okay, I'm opening a ticket on our Discord server now. One moment…", "On it. Opening your ticket now…", "Alright, creating your ticket now…"])], step="end", action="ticket")


def _add_sum(d, label, value):
    d.setdefault("_sum", []).append([label, str(value)[:300]])


def _s_default(f, typ, d, text, is_choice, choice, kind, extra_kb):
    return _again(f)


def _yesno(kind, text, is_choice, choice):
    if is_choice:
        return choice if choice in ("yes", "no", "partly") else None
    return kind if kind in ("yes", "no", "partly") else None


def _s_topic(f, typ, d, text, is_choice, choice, kind, extra_kb):
    if is_choice and choice in dict((v, l) for l, v in TOPICS):
        d["topic"] = choice
        if choice == "other":
            f["step"] = "describe"
            return _turn([R(["Sure. " + R(ASK["describe"]), R(ASK["describe"])])], step="describe")
        f["step"] = "leaf"
        return _turn([R(ASK["leaf"])], LEAFS[choice], "leaf")
    # free text: try the knowledge base straight away
    return _s_describe(f, typ, d, text, False, None, kind, extra_kb)


def _answer_turn(f, d, item):
    f["good"] += 1
    f["step"] = "helpful"
    d["answered"] = item["title"]
    return _turn([R(["Here's what I found:", "This should help:", "Good question. Here you go:", "I think this is what you need:"]), item["answer"], R(ASK["helpful"])],
                 [("Yes", "yes"), ("Not really", "no"), ("Partly", "partly")], "helpful")


def _s_leaf(f, typ, d, text, is_choice, choice, kind, extra_kb):
    chips = LEAFS.get(d.get("topic"), [])
    if not is_choice:
        m = _chip_match(text, chips)
        if m:
            choice, is_choice = m, True
        else:
            return _s_describe(f, typ, d, text, False, None, kind, extra_kb)
    if choice == "?":
        f["step"] = "describe"
        return _turn([R(ASK["describe"])], step="describe")
    item = kb_by_title(choice)
    if item:
        d["leaf"] = choice
        _add_sum(d, "Topic", choice)
        return _answer_turn(f, d, item)
    return _again(f)


def _s_describe(f, typ, d, text, is_choice, choice, kind, extra_kb):
    if is_choice:
        return _again(f)
    if kind in ("yes", "no"):
        return _again(f, "I need a few words from you here, not just yes or no.")
    item = find_answer(text, extra_kb)
    if item and item["title"] != d.get("answered"):
        f["good"] += 1 if meaningful(text) else 0
        _add_sum(d, "You said", text)
        return _answer_turn(f, d, item)
    if not meaningful(text):
        return _again(f, R(["Could you give me a little more detail? A full sentence helps me a lot.", "I need a bit more to go on. What exactly is happening?"]))
    f["good"] += 1
    _add_sum(d, "Problem", text)
    f["step"] = "offer"
    return _turn([R(["Thanks for explaining. I don't have a ready answer for that one.", "Thanks, that helps. I don't have an answer for that in my notes.", "Got it. That's one I can't solve on my own."]), R(ASK["offer"])], [OPEN_T, NO_T], "offer")


def _s_helpful(f, typ, d, text, is_choice, choice, kind, extra_kb):
    yn = _yesno(kind, text, is_choice, choice)
    if yn is None:
        # a new question instead of an answer
        if not is_choice and meaningful(text) and kind is None:
            item = find_answer(text, extra_kb)
            if item and item["title"] != d.get("answered"):
                return _answer_turn(f, d, item)
        if kind in ("thanks", "done", "bye"):
            yn = "yes"
        elif kind in ("greet", "how", "who", "what", "compliment", "joke", "wait", "repeat", "unsure"):
            return _again(f, say(kind))
        else:
            return _again(f, R(["Sorry, I wasn't sure what you meant. Did that answer help?", "Just checking: was that useful?", "Quick check: did that solve it?"]))
    if yn == "yes":
        f["step"] = "more"
        return _turn([R(["Great, I'm glad that helped! 🎉", "Awesome, happy that worked!", "Perfect, glad we got that sorted.", "Nice! Glad I could help."]), R(ASK["more"])], [("Yes, something else", "more"), ENDC], "more")
    f["step"] = "describe2"
    return _turn([R(["Sorry about that. Let me try again.", "Thanks for telling me. Let's dig a little deeper.", "No worries, let's look closer."]), R(["What's still not working? Tell me what you tried and what you see.", "Can you tell me what exactly is going wrong now?"])], step="describe2")


def _s_describe2(f, typ, d, text, is_choice, choice, kind, extra_kb):
    if is_choice or kind in ("yes", "no"):
        return _again(f)
    if not meaningful(text):
        return _again(f, "I need a bit more detail than that. What are you seeing, and what did you try?")
    item = find_answer(text, extra_kb)
    f["good"] += 1
    _add_sum(d, "Still not working", text)
    if item and item["title"] not in (d.get("answered"), d.get("tried2")):
        d["tried2"] = item["title"]
        return _answer_turn(f, d, item)
    f["step"] = "confirm"
    return _turn([R(["Thanks. I think the team should look at this.", "Okay, I can't solve this one myself. Let's get the team on it."]), "Here's what I'll send:\n\n" + _summary(f) + "\n\nShall I open a ticket?"], [OPEN_T, NO_T], "confirm")


def _s_more(f, typ, d, text, is_choice, choice, kind, extra_kb):
    if choice == "more":
        return _turn(["Sure!"] + _first(typ)["say"], _first(typ)["chips"], _first(typ)["step"])
    if kind in ("no", "done", "bye", "thanks", "cancel"):
        f["step"] = "end"
        return _turn([R(["Alright! Glad I could help. 💙", "Okay, take care! You can start a new chat any time.", "Great. Have a good one!"])], step="end", action="done")
    if kind == "yes":
        d.clear()
        return _turn(["Sure, go ahead!"] + _first(typ)["say"], _first(typ)["chips"], _first(typ)["step"])
    if not is_choice and meaningful(text):
        item = find_answer(text, extra_kb)
        if item:
            return _answer_turn(f, d, item)
        return _s_describe(f, typ, d, text, False, None, kind, extra_kb)
    return _again(f)


def _s_offer(f, typ, d, text, is_choice, choice, kind, extra_kb):
    yn = _yesno(kind, text, is_choice, choice)
    if yn == "yes" or choice == "ticket":
        return _ticket_gate(f, d)
    if yn == "no" or choice == "noticket":
        return _turn([R(["No problem, I won't open one.", "Okay, no ticket."]), R(ASK["more"])], [("Yes, something else", "more"), ENDC], "more")
    if kind in ("greet", "how", "who", "what", "thanks", "compliment", "joke", "wait", "repeat", "unsure"):
        return _again(f, say(kind))
    return _again(f, "Just so I'm sure: should I open a ticket for you? You can tap a button.")


def _s_confirm(f, typ, d, text, is_choice, choice, kind, extra_kb):
    return _s_offer(f, typ, d, text, is_choice, choice, kind, extra_kb)


# ---- bug report
def _s_b_kind(f, typ, d, text, is_choice, choice, kind, extra_kb):
    chips = [("A command", "command"), ("The website / dashboard", "website"), ("Rex is offline", "offline"), ("Something else", "other")]
    if not is_choice:
        choice = _chip_match(text, chips) or ("offline" if re.search(r"offline|down|not (responding|replying|working)", text, re.I) else "other")
    d["kind"] = choice
    _add_sum(d, "Type", dict((v, l) for l, v in chips).get(choice, choice))
    if choice == "offline":
        f["step"] = "b_what"
        return _turn(["Please check the **Live stats** page first, it shows if Rex is online right now.", "If it says online but Rex still isn't responding, tell me what you tried and what you saw."], step="b_what")
    f["step"] = "b_where"
    return _turn([R(["Thanks for reporting it.", "Thanks, bugs are a big help."]), "Which command or page was it? (for example `/ban` or the Levels page)"], step="b_where")


def _text_step(nxt, label, minwords=2):
    def fn(f, typ, d, text, is_choice, choice, kind, extra_kb):
        if is_choice:
            return _again(f)
        if kind in ("unsure",) and nxt:
            text, kind = "Not sure", None
            _add_sum(d, label, text)
            f["step"] = nxt
            return _turn([ack()] + _step_prompt(f)["say"], _step_prompt(f)["chips"], nxt)
        nw = len(re.findall(r"\w+", text))
        if (kind in ("yes", "no") and nw <= 2) or (not meaningful(text) and nw < minwords):
            return _again(f, R(["I need a few more words than that please.", "Could you add a bit more detail? It helps the team a lot.", "A short sentence is perfect, I just need a little more."]))
        f["good"] += 1
        _add_sum(d, label, text)
        f["step"] = nxt
        t = _step_prompt(f)
        return _turn([ack()] + t["say"], t["chips"], nxt)
    return fn


def _s_b_freq(f, typ, d, text, is_choice, choice, kind, extra_kb):
    chips = [("Every time", "always"), ("Sometimes", "sometimes"), ("Only once", "once")]
    if not is_choice:
        choice = _chip_match(text, chips) or ("always" if re.search(r"always|every|each", text, re.I) else "once" if re.search(r"once|one time|first time", text, re.I) else "sometimes" if re.search(r"some|random|occasion", text, re.I) else None)
    if not choice:
        return _again(f, "Sorry, which one is closest?")
    _add_sum(d, "How often", dict((v, l) for l, v in chips)[choice])
    f["step"] = "confirm"
    return _turn([R(["Thanks, that's everything I need.", "Perfect, that's enough detail."]), "Here's what I'll send to the team:\n\n" + _summary(f) + "\n\nShall I open a ticket?"], [OPEN_T, NO_T], "confirm")


def _s_b_what(f, typ, d, text, is_choice, choice, kind, extra_kb):
    if d.get("kind") == "offline":
        r = _text_step("confirm", "What happened")(f, typ, d, text, is_choice, choice, kind, extra_kb)
        if f["step"] == "confirm":
            return _turn([ack(), "Here's what I'll send to the team:\n\n" + _summary(f) + "\n\nShall I open a ticket?"], [OPEN_T, NO_T], "confirm")
        return r
    return _text_step("b_freq", "What happened")(f, typ, d, text, is_choice, choice, kind, extra_kb)


# ---- premium
def _s_p_issue(f, typ, d, text, is_choice, choice, kind, extra_kb):
    chips = _first("premium")["chips"]
    if not is_choice:
        choice = _chip_match(text, chips)
        if not choice:
            item = find_answer(text, extra_kb)
            if item and meaningful(text):
                return _answer_turn(f, d, item)
            choice = "other"
    labels = dict((v, l) for l, v in chips)
    d["issue"] = choice
    _add_sum(d, "Issue", labels.get(choice, choice))
    if choice == "redeem":
        return _answer_turn(f, d, kb_by_title("Premium codes"))
    if choice == "info":
        return _answer_turn(f, d, kb_by_title("What Premium gives"))
    f["step"] = "p_server"
    return _turn([R(["Sorry to hear that, let's fix it.", "Okay, I'll get the details together."]), "Which server is this for? The name or ID is fine."], step="p_server")


# ---- appeal
def _s_a_what(f, typ, d, text, is_choice, choice, kind, extra_kb):
    chips = _first("appeal")["chips"]
    if not is_choice:
        choice = _chip_match(text, chips) or ("blacklist" if re.search(r"black ?list", text, re.I) else "serverban" if re.search(r"\bban", text, re.I) else "warn" if re.search(r"warn|mute|timeout", text, re.I) else "other")
    d["what"] = choice
    _add_sum(d, "Appealing", dict((v, l) for l, v in chips).get(choice, choice))
    if choice == "blacklist":
        f["step"] = "a_scope"
        return _turn([R(["Okay, a blacklist appeal.", "Thanks, I'll note that it's a blacklist."]), "Is it a **server** that's blacklisted, or your own **account**?"], [("My server", "server"), ("My account", "account")], "a_scope")
    f["step"] = "a_where"
    return _turn([R(["Understood.", "Okay, thanks."]), "Which server is this about? The name or ID is fine."], step="a_where")


def _s_a_scope(f, typ, d, text, is_choice, choice, kind, extra_kb):
    if not is_choice:
        choice = "server" if re.search(r"server|guild", text, re.I) else "account" if re.search(r"account|me\b|myself|personal|user", text, re.I) else None
    if choice not in ("server", "account"):
        return _again(f, "Is it your server or your account?")
    _add_sum(d, "Blacklisted", "A server" if choice == "server" else "An account")
    f["step"] = "a_where"
    return _turn([ack(), "Which server is this about? The name or ID is fine." if choice == "server" else "Which server were you using Rex in when it happened? The name or ID is fine."], step="a_where")


def _s_a_extra(f, typ, d, text, is_choice, choice, kind, extra_kb):
    yn = _yesno(kind, text, is_choice, choice) or ("no" if kind in ("done",) else None)
    if yn == "yes":
        f["step"] = "a_extra_text"
        return _turn(["Go ahead, add anything else here."], step="a_extra_text")
    if yn == "no":
        f["step"] = "confirm"
        return _turn(["Thanks, that's all I need.", "Here's your appeal as I'll send it:\n\n" + _summary(f) + "\n\nShall I open a ticket for the team to review it?"], [OPEN_T, NO_T], "confirm")
    if meaningful(text):
        _add_sum(d, "Extra", text)
        f["step"] = "confirm"
        return _turn(["Thanks, added.", "Here's your appeal as I'll send it:\n\n" + _summary(f) + "\n\nShall I open a ticket for the team to review it?"], [OPEN_T, NO_T], "confirm")
    return _again(f)


def _s_a_extra_text(f, typ, d, text, is_choice, choice, kind, extra_kb):
    if kind in ("no", "done") or not text:
        f["step"] = "confirm"
        return _turn(["Okay."] + ["Here's your appeal as I'll send it:\n\n" + _summary(f) + "\n\nShall I open a ticket for the team to review it?"], [OPEN_T, NO_T], "confirm")
    r = _text_step("confirm", "Extra")(f, typ, d, text, is_choice, choice, kind, extra_kb)
    if f["step"] == "confirm":
        return _turn(["Thanks, added.", "Here's your appeal as I'll send it:\n\n" + _summary(f) + "\n\nShall I open a ticket for the team to review it?"], [OPEN_T, NO_T], "confirm")
    return r


def _p_what_done(f, typ, d, text, is_choice, choice, kind, extra_kb):
    r = _text_step("confirm", "What happened")(f, typ, d, text, is_choice, choice, kind, extra_kb)
    if f["step"] == "confirm":
        return _turn([ack(), "Here's what I'll send to the team:\n\n" + _summary(f) + "\n\nShall I open a ticket?"], [OPEN_T, NO_T], "confirm")
    return r


_STEPS = {
    "topic": _s_topic, "start": _s_topic, "leaf": _s_leaf, "describe": _s_describe, "describe2": _s_describe2, "helpful": _s_helpful, "more": _s_more, "offer": _s_offer, "confirm": _s_confirm,
    "b_kind": _s_b_kind, "b_where": _text_step("b_what", "Where"), "b_what": _s_b_what, "b_freq": _s_b_freq,
    "p_issue": _s_p_issue, "p_server": _text_step("p_what", "Server", 1), "p_what": _p_what_done,
    "a_what": _s_a_what, "a_scope": _s_a_scope, "a_where": _text_step("a_when", "Server", 1), "a_when": _text_step("a_why", "When / reason"), "a_why": _text_step("a_extra", "Why it should be lifted", 4),
    "a_extra": _s_a_extra, "a_extra_text": _s_a_extra_text,
    "end": lambda f, typ, d, text, is_choice, choice, kind, extra_kb: _turn([R(["This chat has wrapped up. You can start a new one any time.", "We're all done here. Start a new chat if you need anything else."])], step="end"),
}


def chip_values(chips):
    return {v for _, v in chips}


def ticket_summary(c):
    """Lines for the ticket channel: onboarding answers, then the recent conversation."""
    d = (c.get("flow") or {}).get("data") or {}
    return [(k, v) for k, v in d.get("_sum", [])]
