# Built-in answers Rex can give. Owners can add more in Owner mode > Support.
KB = [
 {
  "title": "Adding Rex",
  "keys": [
   "add rex",
   "invite rex",
   "invite the bot",
   "add bot to server",
   "how to add"
  ],
  "answer": "Press **Add Rex** on the home page (or in the Dashboard), pick your server and accept. You need the *Manage Server* permission there."
 },
 {
  "title": "Settings",
  "keys": [
   "change settings",
   "dashboard settings",
   "configure",
   "setup",
   "set up",
   "where are settings"
  ],
  "answer": "Open the **Dashboard**, pick your server and use the side menu. Changes reach the bot within a couple of seconds. You can also use `/settings` in Discord."
 },
 {
  "title": "Not seeing my server",
  "keys": [
   "server missing",
   "dont see my server",
   "can't see server",
   "server not showing",
   "not listed"
  ],
  "answer": "Servers only show if you have *Manage Server* there and Rex is inside it. Add Rex first, then press refresh on the Dashboard. If it still isn't there, log out and back in."
 },
 {
  "title": "Premium codes",
  "keys": [
   "redeem code",
   "premium code",
   "code not working",
   "use a code",
   "activate premium"
  ],
  "answer": "Open **Premium** on the website or your server's Premium page, paste the code and press Redeem. Codes are one use per server unless it says otherwise. If it says invalid, check for typos and that it hasn't expired."
 },
 {
  "title": "What Premium gives",
  "keys": [
   "what is premium",
   "premium features",
   "what does premium do",
   "premium benefits",
   "priority ultra difference"
  ],
  "answer": "**Premium** adds AutoMod, multiple ticket types, anti-ping roles and the command builder. **Priority** adds faster support and priority features. **Ultra** adds your own bot name, picture and banner. See the **Premium** page for the full list."
 },
 {
  "title": "Free trial",
  "keys": [
   "free trial",
   "7 day trial",
   "trial premium",
   "free premium"
  ],
  "answer": "Joining our support server for the first time gives your account a **7 day Premium trial**. Check your DMs for the button to activate it on a server."
 },
 {
  "title": "Tickets",
  "keys": [
   "ticket",
   "tickets not working",
   "ticket panel",
   "open a ticket",
   "ticket button"
  ],
  "answer": "Set tickets up under **Tickets** on your server dashboard: pick a channel, add ticket types and press save. The panel in Discord updates by itself. If a button does nothing, make sure Rex can see and send in that channel."
 },
 {
  "title": "Ban appeals",
  "keys": [
   "appeal",
   "ban appeal",
   "got banned",
   "unban"
  ],
  "answer": "If Rex DM'd you after a ban, press **Appeal Ban** in that message. Each server decides how many appeals you can send. If you didn't get a DM, contact that server's staff directly, we can't unban for other servers."
 },
 {
  "title": "Rex offline",
  "keys": [
   "bot offline",
   "rex offline",
   "bot not responding",
   "commands not working",
   "not replying",
   "bot down"
  ],
  "answer": "Check the **Live stats** page. If Rex shows online but a command fails, make sure it has permission to see and send in that channel. Maintenance is shown on the Live stats page too."
 },
 {
  "title": "Permissions",
  "keys": [
   "permissions",
   "missing permissions",
   "cant send",
   "bot permissions",
   "role order"
  ],
  "answer": "Rex needs *View Channel* and *Send Messages* where it works, and its role must sit **above** the roles it manages. Run `/botperms` for a check."
 },
 {
  "title": "AutoMod",
  "keys": [
   "automod",
   "spam filter",
   "block words",
   "anti spam",
   "anti link"
  ],
  "answer": "AutoMod lives under **Protection & AutoMod** (Premium). It uses Discord's own AutoMod, so it keeps working even if Rex restarts."
 },
 {
  "title": "Custom commands",
  "keys": [
   "custom command",
   "builder",
   "make my own command",
   "events builder"
  ],
  "answer": "Open your server, then **Commands** in the side menu. Build commands and events from blocks, no code needed. Premium gets 5 commands and 5 events, Priority and Ultra get unlimited."
 },
 {
  "title": "Levels and XP",
  "keys": [
   "levels",
   "xp",
   "rank",
   "leveling",
   "level up"
  ],
  "answer": "Levels are under **Levels & XP**. Turn them on, pick a channel for level-up messages and (optionally) role rewards."
 },
 {
  "title": "Welcome messages",
  "keys": [
   "welcome message",
   "welcome channel",
   "greet",
   "leave message"
  ],
  "answer": "Go to **Welcome & Leave** on your server dashboard. Use `{user}` for the member and `{server}` for the server name."
 },
 {
  "title": "Delete my data",
  "keys": [
   "delete my data",
   "remove my account",
   "privacy",
   "data"
  ],
  "answer": "Open your **Profile** and use the delete option. That removes what the website stores about you."
 },
 {
  "title": "Bug report",
  "keys": [
   "bug",
   "something is broken",
   "error",
   "glitch",
   "not working"
  ],
  "answer": "Thanks for telling us! Could you describe what you pressed and what happened? If you'd like, I can bring in a real person to take a look."
 },
 {
  "title": "Thanks",
  "keys": [
   "thank you",
   "thanks",
   "thx",
   "cheers"
  ],
  "answer": "You're welcome! Anything else I can help with? 💙"
 },
 {
  "title": "Support server",
  "keys": [
   "support server",
   "join support",
   "discord server",
   "official server",
   "invite link"
  ],
  "answer": "The official Rex support server is where the team and community hang out: https://discord.gg/2JSVqkVdeq. Joining it for the first time also gives your account a **7 day Premium trial**."
 },
 {
  "title": "Dashboard login",
  "keys": [
   "cant log in",
   "login not working",
   "log in problem",
   "discord login",
   "sign in"
  ],
  "answer": "Press **Log in** on the website and approve with Discord. If it loops, clear the site's cookies for this page and try again, and make sure you aren't blocking third party sign-ins. Logging in again always creates a fresh session."
 },
 {
  "title": "Logs",
  "keys": [
   "logs",
   "log channel",
   "mod logs",
   "audit log",
   "message logs"
  ],
  "answer": "Logging lives under **Logs** on your server dashboard. Pick a channel for each kind of log (moderation, messages, members) and switch on the ones you want."
 },
 {
  "title": "Moderation commands",
  "keys": [
   "ban",
   "kick",
   "mute",
   "timeout",
   "warn",
   "moderation commands"
  ],
  "answer": "Moderation commands are on the **Commands** page of the website, with who can run each one. You can also set staff roles under **Roles & Permissions** on your server dashboard."
 },
 {
  "title": "Verification",
  "keys": [
   "verification",
   "verify panel",
   "verify button",
   "captcha",
   "anti raid"
  ],
  "answer": "Set up verification under **Verification** on your server dashboard: pick a channel, a role to give, and publish the panel. Rex posts the panel and handles the button for you."
 },
 {
  "title": "Invite and permissions",
  "keys": [
   "invite permissions",
   "bot missing perms",
   "admin permission",
   "what permissions does rex need"
  ],
  "answer": "Rex works best with *Administrator*, but at minimum it needs View Channels, Send Messages, Embed Links, Manage Roles, Manage Channels and Moderate Members. Make sure Rex's role sits **above** the roles it manages."
 },
 {
  "title": "Uptime",
  "keys": [
   "is rex down",
   "uptime",
   "status page",
   "outage",
   "maintenance"
  ],
  "answer": "Check the **Live stats** page for Rex's current status, latency and uptime. If it shows online and something still fails, tell me which command and what happened."
 }
]
