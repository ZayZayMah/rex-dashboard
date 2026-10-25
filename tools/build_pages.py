"""Regenerates the small HTML shells in /public. Run:  python3 tools/build_pages.py [https://your-site-origin]
Every page shares the same head; the page itself is drawn by /public/js/<page>.js."""
import os
import sys

ORIGIN = (sys.argv[1] if len(sys.argv) > 1 else os.environ.get("SITE_ORIGIN", "https://rex.g7m4fcmnz9.workers.dev")).rstrip("/")
OUT = os.path.join(os.path.dirname(__file__), "..", "public")

DESC = "Rex is a Discord bot for moderation, tickets, levels and security, with a full web dashboard for every server you manage."

PAGES = [
    # file, title, description, script, active-nav, robots
    ("index.html", "Rex - Smart. Helpful. Always here.", DESC, "home", True, ""),
    ("about.html", "About Rex", "What Rex does, how to add it, and where to find commands, premium tiers and live stats.", "about", False, ""),
    ("commands.html", "Commands - Rex", "Every Rex slash command with usage, options and who can run it.", "commands", False, ""),
    ("command.html", "Command - Rex", "How to use a Rex command.", "command", False, ""),
    ("premium.html", "Premium - Rex", "Free, Premium, Priority and Ultra compared. Redeem a code for your server.", "premium", False, ""),
    ("live.html", "Live stats - Rex", "Live status, latency and growth for the Rex bot.", "live", False, ""),
    ("dashboard.html", "Dashboard - Rex", "Pick a server and manage Rex there.", "dashboard", False, "noindex"),
    ("server.html", "Server - Rex", "Manage Rex in your server.", "server", False, "noindex"),
    ("profile.html", "Profile - Rex", "Your Rex profile, levels and XP.", "profile", False, "noindex"),
    ("owner.html", "Owner mode - Rex", "Rex owner tools.", "owner", False, "noindex"),
    ("transcript.html", "Ticket transcript - Rex", "A saved Rex ticket transcript.", "transcript", False, "noindex,nofollow"),
    ("404.html", "Not found - Rex", "That page does not exist.", "404", False, "noindex"),
]

HEAD = """<!doctype html>
<html lang="en" data-theme="normal">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>{title}</title>
<meta name="description" content="{desc}">
<meta name="theme-color" content="#2f8cff">
{robots}<meta property="og:type" content="website">
<meta property="og:site_name" content="Rex">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="{origin}{path}">
<meta property="og:image" content="{origin}/img/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{title}">
<meta name="twitter:description" content="{desc}">
<meta name="twitter:image" content="{origin}/img/og.png">
<link rel="icon" href="/img/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@500;600;700&family=Fraunces:wght@600;700&family=Figtree:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap">
<link rel="stylesheet" href="/css/style.css">
<script src="/js/theme.js"></script>
</head>
"""

BODY = """<body class="page-{script}">
<div id="fx" aria-hidden="true"></div>
<header id="nav" class="nav"></header>
<main id="app" class="wrap"><div class="skel"></div></main>
<footer id="footer"></footer>
<div id="toasts" class="toasts" aria-live="polite"></div>
<script src="/js/app.js"></script>
<script src="/js/layouts.js"></script>
<script src="/js/fx.js"></script>
{extra}<script src="/js/{script}.js"></script>
</body>
</html>
"""

for file, title, desc, script, _home, robots in PAGES:
    path = "/" if file == "index.html" else "/" + file[:-5]
    extra = ""
    if script in ("commands", "command", "about", "premium", "live"):
        extra = '<script src="/js/catalog.js"></script>\n' if script in ("commands", "command") else ""
    if script == "server":
        extra = '<script src="/js/builder.js"></script>\n'
    html = HEAD.format(title=title, desc=desc, origin=ORIGIN, path=path,
                       robots=f'<meta name="robots" content="{robots}">\n' if robots else "")
    if script == "transcript":
        html = html.replace('<script src="/js/theme.js">', '<link rel="stylesheet" href="/css/transcript.css">\n<script src="/js/theme.js">')
    html += BODY.format(script=script, extra=extra)
    with open(os.path.join(OUT, file), "w", encoding="utf-8") as fh:
        fh.write(html)

# old health page now lives inside owner mode
with open(os.path.join(OUT, "admin.html"), "w", encoding="utf-8") as fh:
    fh.write('<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=/owner#health"><title>Redirecting</title><a href="/owner#health">Continue</a>')

print("pages written for", ORIGIN)
