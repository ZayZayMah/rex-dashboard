"""
Everything Rex's website helper knows. No secrets, server IDs, owner emails or passwords live here: only public facts that are
already written on the website (docs, commands page, premium page) plus plain how-to answers.

E(title, "key phrase|another phrase|...", answer_1, answer_2, ...)   -> one topic with several ways of saying the answer.
{ADD} = the add-Rex link, {SUPPORT} = the public support server invite. Both are filled in when the answer is sent.
"""
from helper_cmds import CMDS
from helper_data import KB as _OLD

KB = []


def E(title, keys, *answers, tags=()):
    KB.append({"title": title, "keys": [k.strip() for k in keys.split("|") if k.strip()], "answer": list(answers), "tags": list(tags)})


# ------------------------------------------------------------------------------------------------ getting started
E("Adding Rex", "add rex|invite rex|invite the bot|add bot to server|how to add|add rex to my server|get rex in my server|how do i add rex|add the bot|install rex|put rex in my server|link to add rex|rex invite link|where do i add rex|how can i get rex|bring rex to my server|add to discord|rex bot link|invite link",
  "[Click this link]({ADD}) and choose the server you want to add Rex to. (You need the **Manage Server** permission there.)",
  "[This link]({ADD}) will take you to a page to add Rex. Just choose the server, then come back to the [Dashboard](/dashboard) to configure me. (You need the **Manage Server** permission.)",
  "Press **Add Rex** on the [home page](/) or use [this invite link]({ADD}), pick your server and accept the permissions. You need **Manage Server** in that server.")
E("Settings", "change settings|dashboard settings|configure|setup|set up|where are settings|how do i configure rex|server settings|settings page|how to change rex settings|customise rex|customize rex|edit settings|rex settings|open the dashboard|where is the dashboard|how to use the dashboard|dashboard help|manage my server",
  "Open the [Dashboard](/dashboard), pick your server and use the side menu. Changes reach the bot within a couple of seconds. You can also use `/settings` in Discord.",
  "Everything is in the [Dashboard](/dashboard): choose your server, then pick a section on the left (Welcome, Tickets, Levels, Logs and so on). Saved changes reach Rex in a few seconds.",
  "Go to the [Dashboard](/dashboard), log in with Discord and select your server. Each page in the side menu is one feature, and `/settings` in Discord shows the basics.")
E("Not seeing my server", "server missing|dont see my server|can't see server|server not showing|not listed|my server isnt on the dashboard|server not on dashboard|where is my server|dashboard shows no servers|no servers listed|cant find my server|server not appearing|my server doesnt show up",
  "Servers only show if you have **Manage Server** there *and* Rex is inside it. [Add Rex]({ADD}) first, then refresh the [Dashboard](/dashboard). If it still isn't there, log out and back in.",
  "Two things have to be true for a server to appear: you need **Manage Server** in it, and Rex must already be in it. Add Rex with [this link]({ADD}), refresh, and if needed log out and in again.")
E("Login problems", "cant log in|cant login|login not working|login loop|login fails|sign in problem|cant sign in|discord login error|login keeps failing|stuck logging in|authorize error|login redirect|logged out again|keeps logging me out",
  "Clear this site's cookies, make sure you're using the right Discord account, and don't block third-party sign-in. Then try the [login again](/auth/login). More in [Troubleshooting](/docs/troubleshooting).",
  "Try clearing cookies for this site, using another browser or a private window, and logging in once more. Make sure you're signed in to the Discord account that has Manage Server. See [Troubleshooting](/docs/troubleshooting).")
E("Rex offline", "rex is offline|rex isnt replying|bot not responding|rex not working|bot offline|rex down|rex not online|bot is down|rex doesnt respond|rex not answering|commands not working|slash commands not showing|bot not replying|rex stopped working|application did not respond|the application did not respond",
  "Check the [Live stats](/live) page: it shows if Rex is online or in maintenance. If it says online, make sure Rex can **View Channel** and **Send Messages** in that channel, then try again in a moment.",
  "First look at [Live stats](/live) for outages. If Rex is online, check its permissions in the channel and that its role isn't below the roles it manages. If \"the application did not respond\" keeps showing, wait a minute and retry, and tell us if it continues.",
  "Open [Live stats](/live) to see if Rex is up. If it is, check Rex can see and talk in that channel (`/botperms` helps) and try the command again.")
E("Permissions", "missing permissions|rex permissions|permission error|bot lacks permissions|rex cant do|rex needs permission|what permissions does rex need|bot permissions|rex role position|role hierarchy|move rex role|botperms|rex cant manage roles|rex cant ban|rex cant kick|hierarchy",
  "Rex needs View Channels, Send Messages, Embed Links, Manage Roles, Manage Channels and Moderate Members at minimum (Administrator is easiest). Its role must sit **above** any role it manages. Run `/botperms` for a quick check.",
  "Drag Rex's role higher in *Server Settings → Roles*: it can only manage roles below it. Then run `/botperms` to see what's still missing.",
  "Most \"Rex can't do that\" problems are permissions or role order. Run `/botperms`, grant the missing permission and put Rex's role above the target roles. See [Getting Started](/docs/getting-started).")
E("Custom commands", "custom commands|make my own command|command builder|build a command|create custom command|builder|events builder|custom events|my own slash command|make a command|new command|automation|blocks",
  "Custom commands and events are built from blocks (no code) in the [Dashboard](/dashboard) under **Commands** and **Events**. Premium servers get 5 of each; Priority and Ultra get unlimited.",
  "Open your server in the [Dashboard](/dashboard) and choose **Commands** (or **Events** for automations). It's a block builder for messages, embeds, roles, channels, forms and tickets. Needs Premium or above: 5 commands and 5 events on Premium, unlimited on Priority and Ultra.")
E("Levels and XP", "levels|xp|level up|level roles|level rewards|experience points|leaderboard|rank|xp not working|levels not working|no xp|voice xp|how do levels work|level system|rank card|give role at level",
  "Open **Levels & XP** in the [Dashboard](/dashboard) to turn levels on, set how much XP chatting and voice give, and add role rewards for levels. Members check progress with `/level`, and `/leaderboard` shows the top members.",
  "Levels live in the [Dashboard](/dashboard) → **Levels & XP**: switch them on, tune the XP, and pick roles to hand out at certain levels. Use `/level` and `/leaderboard` in Discord to see progress.")
E("Welcome messages", "welcome message|welcome channel|greet new members|leave message|goodbye message|welcome not working|autorole|starter role|welcome embed|welcome image|join message|set welcome",
  "Set it up in the [Dashboard](/dashboard) → **Welcome & Leave**: pick a channel, write the message (use `{user}` and `{server}`), and optionally a starter role. Embeds need Premium and a welcome image needs Ultra.",
  "Go to **Welcome & Leave** in the [Dashboard](/dashboard). Choose the channel, type your message with `{user}` / `{server}` and save. If nothing posts, check Rex can send messages in that channel.")
E("Logs", "logs|mod log|modlog|log channel|moderation log|where are logs|set log channel|no logs|logs not working|audit log|action log|reports channel|report channel",
  "Pick the channels on the [Dashboard](/dashboard) → **Logs & Reports**. Bans, kicks, timeouts, warnings, ticket events and applications are logged in your mod log channel, and `/report` submissions go to the report channel.",
  "Set a **Mod log channel** in the [Dashboard](/dashboard) under **Logs & Reports**. Rex posts moderation actions, ticket opens/closes and application results there. Make sure Rex can send messages in it.")
E("Verification", "verification|verify|verify panel|verified role|verify button|member verification|captcha|verify members|publish verify panel|verification not working",
  "Open **Verification** in the [Dashboard](/dashboard), choose the Verified role and channel, save, then press **Post the verification panel**. Rex's role must be above the Verified role.",
  "Set the Verified role on the [Dashboard](/dashboard) → **Verification**, save, then post the panel to a channel. If the button errors, move Rex's role above the Verified role.")
E("AutoMod", "automod|auto moderation|anti spam|anti link|anti swear|swear filter|spam protection|link filter|anti alt|alt accounts|block links|protection|raid protection|anti raid|stop spam|bad words",
  "Spam, link, swear and alt-account protection are in the [Dashboard](/dashboard) → **Protection & AutoMod**. That needs **Premium**; see [Plans](/docs/plans). Remember Rex needs Manage Messages to remove things.",
  "AutoMod (spam, links, swearing, alt accounts) is a Premium feature: [Dashboard](/dashboard) → **Protection & AutoMod**. Check the [Premium page](/premium) for what each tier includes.")
E("Moderation commands", "moderation commands|how to ban|how to kick|how to timeout|how to warn|ban someone|kick someone|mute someone|warn someone|punish member|moderate|mod commands|moderation|ban a user|timeout a user|remove a ban|unban someone",
  "The main ones are `/ban`, `/kick`, `/timeout`, `/warn`, `/purge`, `/slowmode` and `/lock`, plus `/unban` to reverse a ban. Browse every command on the [Commands page](/commands) and read the [Moderation Guide](/docs/moderation).",
  "Use `/warn`, `/timeout`, `/kick` and `/ban` (and `/unban`). `/warns`, `/history` and `/case` show past actions. The full list with who can use each is on the [Commands page](/commands).")
E("Command permission errors", "i cant use command|you dont have permission|command says no permission|why cant i use a command|command locked|staff only command|cant run command|command not available|only staff|not allowed to use|command greyed out",
  "It can be a missing Discord permission, a staff role you haven't been given (see *Roles and Permissions*), a higher tier requirement, or Rex lacking permission in that channel. Check the [Commands page](/commands) for what each command needs.",
  "Work through it in order: your Discord permission or staff role, Rex's permissions in the channel, the server's tier, then the [Live stats](/live) page. [Commands and Settings](/docs/commands) walks through it.")
E("Premium codes", "redeem code|premium code|code not working|use a code|redeem premium|how to redeem|promo code|invalid code|code expired|code already used|gift code|activation code|where do i put my code|redeem a code|ultra code|priority code",
  "Open the [Premium page](/premium), pick your server, paste the code and press **Redeem** (or run `/redeem` in the server). Codes start with REX-PREMIUM-, REX-PRIORITY- or REX-ULTRA-. Rex tells you if one is expired, used up or deactivated.",
  "Paste it on the [Premium page](/premium) and press **Redeem**, or use `/redeem code:` inside the server you want upgraded. Codes are one use per server unless they say otherwise.")
E("What Premium gives", "what is premium|premium features|what does premium give|premium benefits|is premium worth it|what do i get with premium|tiers|premium vs ultra|what is ultra|what is priority|difference between tiers|plans|pricing|how much is premium|premium price|ultra features|priority features|free vs premium",
  "**Free** has the core features. **Premium** adds AutoMod, several ticket types, application tickets, anti-ping roles and the custom command builder (5 commands/5 events). **Priority** adds unlimited commands/events and faster support. **Ultra** adds your own bot name, picture and banner, and more. The [Premium page](/premium) always has the current list.",
  "Four tiers: Free, Premium, Priority and Ultra, each including the one before. See what each unlocks on the [Premium page](/premium) and read the details in [Plans and Billing](/docs/plans).")
E("Free trial", "free trial|trial|7 day trial|premium trial|try premium|free premium|how do i get a trial|trial activation|trial button|activate trial|where is my trial|trial not working|trial dm",
  "Joining the [Rex Support Server]({SUPPORT}) for the first time gives your account a **7 day Premium trial**. Rex DMs you a button to activate it on one server, so check your DMs (and that they're open).",
  "Join the [Support Server]({SUPPORT}) and Rex will DM you an activation button for a 7 day Premium trial. Pick the server you want it on. If no DM arrives, open your DMs from server members and ask us in the server.")
E("Paid but no Premium", "i paid but no premium|payment not working|paid but nothing|purchase not showing|didnt get premium|bought premium|premium missing|premium disappeared|premium expired|premium gone|lost premium|billing|refund|cancel premium|how do i cancel|renew premium|subscription",
  "Premium belongs to a **server**, so check you're looking at the right one on the [Premium page](/premium). For billing, renewals and refunds, the team handles it case by case: see [Plans and Billing](/docs/plans). If it still looks wrong I can open a ticket with the details.",
  "First check the server on the [Premium page](/premium) shows the right tier. Refunds and payment problems are handled by the team (see [Plans and Billing](/docs/plans)), and I can open a ticket for you if the tier is still missing.")
E("Tickets", "tickets|ticket system|set up tickets|ticket panel|ticket buttons|ticket not working|create ticket|open ticket|ticket category|ticket staff role|support tickets|ticket setup|how do tickets work|make a ticket panel|ticket command|ticket button doesnt work|ticket welcome message",
  "Set tickets up in the [Dashboard](/dashboard) → **Tickets**: choose a category and staff role, then post the panel to a channel (or run `/ticket` → Quick Setup). If the button fails, check Rex has Manage Channels and the category is valid.",
  "Go to **Tickets** in the [Dashboard](/dashboard), pick the category and your staff role, then use **Post the ticket panel**. Members press the button to get a private channel. Rex needs Manage Channels.")
E("Ticket panels", "second ticket panel|make a second panel|new ticket panel|make another panel|multiple ticket panels|more ticket panels|two panels|second panel|extra panel|how many ticket panels|panel limit|different panels|ticket panel limit|several panels|panels per server|add another panel",
  "Free servers can have **2** ticket panels (one button each), Premium **5** with several buttons per panel, and Ultra unlimited. Add them in the [Dashboard](/dashboard) → **Tickets** → *More ticket panels*, then post each one from the *Post a panel* box.",
  "You can run more than one panel: 2 on Free (single button), 5 on Premium (multiple ticket options), unlimited on Ultra. Build them under **Tickets** in the [Dashboard](/dashboard) and post the one you want to any channel.")
E("Ticket closing", "close ticket|delete ticket|ticket transcript|transcript|reopen ticket|dm on close|ticket closed dm|ticket must be closed|cant delete ticket|how to delete a ticket|ticket logs|transcripts|save ticket chat|ticket history",
  "A ticket has to be **closed** before it can be deleted, and the transcript is saved when it closes (view them in the [Dashboard](/dashboard) → Transcripts; kept 30 days, or until deleted on Ultra). Turn on *DM the ticket owner when it closes* in **Tickets** if you want them told.",
  "Press **Close** in the ticket, then **Delete** once it's closed. Closing saves the transcript and logs it in your mod log. There's also a setting to DM the person when their ticket closes.")
E("Apply tickets", "apply ticket|job application|apply via dm|apply on website|recruitment|staff apps|form builder|application results",
  "Applications now have their own page: [Dashboard](/dashboard) → **Applications**. Build a form (questions, minimum lengths, limits, accept/deny messages, a role), choose DMs or website, then add it to any ticket panel with the **Application form** button (Premium). Results go to your mod log with Reply / Accept / Deny buttons.",
  "Build forms on the **Applications** page, then attach one to a ticket panel (Tickets → button → *Application form*). In DMs Rex asks the questions one by one (`STOP` cancels); on the website people sign in and fill one page, and staff get a link in the mod log.")
E("Ban appeals", "ban appeal|appeal ban|how to appeal|appeal button|i was banned|banned from server|unban me|appeal a ban|appeals|appeal not working|appeal limit|ban appeal dm|appeal ticket|appeal blacklist|i got banned",
  "When Rex bans someone it DMs them an **Appeal Ban** button. The appeal opens in the server that banned them and the staff there answer it: replies are passed back to the DM. Each server sets the appeal limit and cooldown in the [Dashboard](/dashboard) → **Ban Appeals**. The Rex team can't lift a ban in a server it doesn't run.",
  "If you were banned from a server by Rex, press **Appeal Ban** in the DM it sent. Your messages go to that server's staff, and theirs come back to you. Only that server's staff can lift it. Rex blacklist appeals are different: I can open a ticket for those.")
E("Blacklist", "blacklist|blacklisted|my server is blacklisted|blocked from rex|rex blocked me|globally banned|cant use rex|rex blocked|server blacklisted|account blacklisted|how to appeal blacklist",
  "A blacklist is set by the Rex team for rule or safety reasons. I can open a ticket so they review it: tell me which server or account and why you think it should be lifted. Check the [Rules](/docs/rules) first.",
  "Only the Rex team can lift a blacklist. Use the **Ban appeal** chat on the [Support page](/support) and I'll collect the details for them. The [Rules and Guidelines](/docs/rules) explain what can lead to one.")
E("Support server", "support server|discord server|join support|where can i get help|contact support|contact staff|talk to staff|rex discord|rex community|help server|official server|join the server|how do i contact you|who do i talk to|real person|speak to a human|contact the team|get in touch",
  "Join the [Rex Support Server]({SUPPORT}) for help, bug reports and announcements, or keep chatting here and I'll open a ticket with the team if I can't solve it. More in [Troubleshooting and Support](/docs/troubleshooting).",
  "You can reach the team in the [Support Server]({SUPPORT}), or via the [Support page](/support): I ask a few questions first and open a ticket if a person is needed.")
E("Report a bug", "report a bug|found a bug|bug report|bug|something is broken|glitch|rex has a bug|error message|broken feature|rex error|crash|it crashed",
  "Use the **Report a bug** chat on the [Support page](/support). Tell me what you did, what happened and what you expected, with any error text, and I'll pass it to the team. Clear steps get fixed faster.",
  "Thanks for reporting! Start a **Report a bug** chat on the [Support page](/support) with the command or page, the exact steps and any error message.")
E("Suggestions", "suggestion|suggest a feature|feature request|i have an idea|can you add|please add|add feature|request a feature|new feature idea|feedback|idea for rex|wish list|you should add|improve rex",
  "Love it! Open the **Feedback** chat on the [Support page](/support) and press *New suggestion*. I'll check whether Rex already does it, and if not it goes to the team's feedback list.",
  "Ideas are welcome: use the permanent **Feedback** chat on the [Support page](/support) and send a new suggestion. If Rex already has it I'll show you how, otherwise the team sees it.")
E("Security", "is rex safe|is rex secure|is rex legit|will rex steal|bot token|share token|staff ask password|scam|someone asked for my token|phishing|fake rex|is this a scam|safe to give admin|data safety|report vulnerability|vulnerability|exploit|hack",
  "Rex staff will **never** ask for your password, authentication codes or bot token, so never share them with anyone. Only use official Rex links. Report vulnerabilities privately as described in the [Security Policy](/docs/security).",
  "Stay safe: nobody from Rex will ask for your password, codes or token. If someone does, it's a scam. See the [Security Policy](/docs/security) and [Privacy Policy](/docs/privacy).")
E("Delete my data", "delete my data|delete account|remove my data|gdpr|data deletion|privacy|sell my data|do you sell data|share my data|do you collect data|what do you collect|cookies|tracking|what data does rex store|personal data|erase my account|data request|delete my info|opt out|data policy",
  "Open your **Profile** in the [Dashboard](/dashboard) and use the delete option, or contact us as described in the [Privacy Policy](/docs/privacy), which also lists exactly what is stored and why.",
  "You can delete your data from your **Profile** page. Details of what we keep are in the [Privacy Policy](/docs/privacy).")
E("What is Rex", "what is rex|what does rex do|about rex|what can rex do|rex features|is rex free|is rex official|who made rex|rex bot info|why use rex|what is this bot|rex overview|all in one bot|bot features|features list",
  "Rex is an all-in-one Discord bot with moderation, tickets, levels, verification, games, custom commands and a web [Dashboard](/dashboard). It's independent (not an official Discord product). See the [Commands page](/commands) and [Plans](/premium).",
  "Rex is a multi-purpose Discord bot: moderation and AutoMod, tickets and applications, levels, welcome messages, games, economy and custom commands, all manageable from the [Dashboard](/dashboard). The core is free.")
E("Commands list", "list of commands|all commands|command list|what commands are there|commands page|see commands|every command|show commands|help command|how do i see commands|what commands does rex have|commands",
  "The complete, current list with usage and who can run each command is on the [Commands page](/commands). Type `/` in a channel Rex can see to browse them in Discord.",
  "Open the [Commands page](/commands) for every command, its options and requirements. In Discord just type `/` and pick a Rex command.")
E("Docs", "documentation|docs|guide|guides|terms of service|privacy policy|rules|guidelines|policy|terms|tos|legal|rex docs|read the docs|manual|tutorial|getting started",
  "All the guides and policies are in the [Docs](/docs): [Getting Started](/docs/getting-started), [Commands and Settings](/docs/commands), [Plans and Billing](/docs/plans), [Moderation Guide](/docs/moderation), [Troubleshooting](/docs/troubleshooting), [FAQ](/docs/faq) and the legal pages ([Terms](/docs/terms), [Privacy](/docs/privacy), [Rules](/docs/rules), [Security](/docs/security)).",
  "Start with the [Docs](/docs). Popular pages: [Getting Started](/docs/getting-started), [FAQ](/docs/faq) and [Troubleshooting](/docs/troubleshooting).")
E("Status and live stats", "status|live stats|uptime|latency|ping|is rex online|maintenance|outage|bot status|rex status|down for maintenance|server count|how many servers|bot stats|statistics",
  "The [Live stats](/live) page shows whether Rex is online, its latency, growth and any maintenance notice.",
  "Check [Live stats](/live) for current status, latency and maintenance notices.")
E("Themes", "theme|dark mode|halloween|christmas|change theme|website theme|seasonal theme|spooky|snow|theme switcher|light mode|appearance|colors of website",
  "The site has Normal, Halloween and Christmas looks. Use the theme option in the site menu to switch; it only changes how things look.",
  "You can switch between Normal, Halloween and Christmas themes from the site menu. It's cosmetic only.")
E("Economy and games", "economy|coins|balance|daily|daily reward|games|arcade|trivia|wordle|hangman|minesweeper|tictactoe|connect4|giveaway|polls|counting|fun commands|virtual currency|currency",
  "Economy, games and the counting channel are under **Community & Games** in the [Dashboard](/dashboard). Try `/daily`, `/balance`, `/giveaway`, `/polls` and the `/fun arcade` games. Currency is virtual and has no real-world value.",
  "Fun stuff: `/daily` and `/balance` for the economy, `/giveaway` and `/polls` for the community, and `/fun arcade` games such as wordle, hangman and trivia. Settings are in **Community & Games** on the [Dashboard](/dashboard).")
E("Bot branding", "bot name|change bot name|bot avatar|bot picture|bot banner|custom bot|rename rex|white label|branding|embed colour|embed color|own bot picture|custom bot name",
  "On **Ultra**, **Bot Branding** in the [Dashboard](/dashboard) lets you change Rex's name, picture, banner, bio and embed colour in your server only.",
  "Rename and re-skin Rex per server with **Bot Branding** (Ultra) in the [Dashboard](/dashboard).")
E("Staff roles", "staff roles|set staff role|who is staff|moderator role|admin role|roles and permissions|staff permissions|trial staff|ticket staff role|add staff|staff members",
  "Choose which roles Rex treats as staff in the [Dashboard](/dashboard) under **Roles and Permissions** (Staff Roles). Staff roles control who can run moderation commands and answer tickets.",
  "Staff roles are set in the [Dashboard](/dashboard). Pick your Admin, Moderator and Ticket staff roles there so Rex knows who to trust.")
E("Analytics", "analytics|server analytics|growth stats|activity stats|member growth|retention|server statistics|channel stats|message stats|reports",
  "Advanced analytics (growth, activity, channels, retention and more) are a Premium feature: see **Analytics** in the [Dashboard](/dashboard) and the `suggest analytics` commands on the [Commands page](/commands).",
  "Premium servers get Analytics in the [Dashboard](/dashboard) with growth, activity and retention reports.")
E("Security tools", "anti nuke|antinuke|anti raid|raid alert|join gate|anti bot|trusted users|webhook protection|security dashboard|lockdown|emergency lockdown|quarantine|server security|raid|nuke|mass ban|protect my server",
  "Ultra adds Security (raid alerts, deep logging and optional automatic enforcement) in the [Dashboard](/dashboard). In an emergency use `/lockdown` and `/unlockdown`. Protection options such as anti-bot, join gate and anti-nuke are listed on the [Commands page](/commands).",
  "For raids, use the Dashboard's **Protection & AutoMod** and (Ultra) **Security** pages, and `/lockdown` to stop everyone talking until you lift it.")
E("Roblox", "roblox|roblox verify|link roblox|roblox verification|roblox account|rover",
  "Roblox verification is available through the security tools: see `/un security roblox` and `/un security verify` on the [Commands page](/commands).",
  "Rex can link Roblox accounts through its verification tools (`/un security roblox`). Check the [Commands page](/commands) for how it works.")
E("Giveaways", "giveaway|start a giveaway|end giveaway|reroll|giveaway not working|how to host giveaway|prize|giveaways",
  "Run `/giveaway` in the channel where you want it. Rex needs Send Messages and Add Reactions there. See [the command](/command?c=giveaway) for the options.",
  "Use `/giveaway` to start one; you pick the prize, duration and winners. Details on the [command page](/command?c=giveaway).")
E("Reminders and AFK", "reminder|remind me|set a reminder|afk|go afk|timezone|set timezone|my timezone",
  "`/reminder` sets a reminder, `/afk` marks you away, and `/timezone` stores your timezone. All are on the [Commands page](/commands).",
  "Try `/reminder`, `/afk` and `/timezone`. Full options are on the [Commands page](/commands).")
E("Purge and slowmode", "purge|clear messages|delete messages|bulk delete|slowmode|slow mode|lock channel|unlock channel|clear chat|lock a channel",
  "`/purge` (or `/clear`) removes messages in bulk, `/slowmode` limits how often people can post, and `/lock` and `/unlock` control a channel. Rex needs Manage Messages / Manage Channels.",
  "Use `/purge` to delete lots of messages, `/slowmode` to slow a channel and `/lock` or `/unlock` to freeze or open it. Rex needs the matching permission.")
E("Warnings and cases", "warnings|warn history|clear warnings|case number|view cases|infractions|punishment history|member history|notes on a member|staff notes|warns",
  "`/warn` adds a warning, `/warns` lists them, `/clearwarns` clears them, and `/case`, `/history` and `/notes` show a member's record.",
  "Check a member's record with `/history`, `/warns`, `/case` and `/notes`; add a warning with `/warn` and clear with `/clearwarns`.")
E("Announcements and say", "announcement|announce|say command|send a message as rex|embed message|rules message|support message|boost message|post an announcement|server announcement",
  "`/announce` and `/announcement` post announcements, `/say` makes Rex send a message, and `/rulesmsg`, `/supportmsg` and `/boostmsg` post ready-made panels. Staff only.",
  "Staff can use `/announce` (or `/announcement` to pick a channel) and `/say`. See the [Commands page](/commands) for the panel commands.")
E("Rex lag", "rex is slow|rex lag|slow response|takes long|bot slow|delay|laggy|timeout|interaction failed|this interaction failed|unknown interaction|command takes forever|slow commands|keeps timing out|timing out|times out|keeps failing|commands fail",
  "If commands are slow or show \"The application did not respond\", check [Live stats](/live) for a busy period, retry in a minute and make sure Rex has the permissions it needs in that channel. If it keeps happening, report it from the [Support page](/support) with the command name and time.",
  "Slowness is usually a temporary busy period. Look at [Live stats](/live), try again shortly and, if it continues, send us the command and time through the [Support page](/support).")
E("Website help", "website not loading|dashboard wont load|site broken|page not loading|white screen|blank page|website error|site down|cant open dashboard|dashboard is blank|page wont load|error on website|404",
  "Refresh, try another browser or a private window and clear this site's cookies. If it's still broken, check [Live stats](/live) and tell us the page and any error text via the [Support page](/support).",
  "Try a hard refresh, another browser, and clearing cookies for the site. See [Troubleshooting](/docs/troubleshooting) for the full checklist.")
E("Email", "email|emails|unsubscribe|stop emails|email preferences|newsletter|why did i get an email|email updates|mailing list|too many emails",
  "You choose which Rex emails you get. Every email has an unsubscribe link, and you can change your choices in your email preferences. See the [Privacy Policy](/docs/privacy) for how emails are used.",
  "Use the unsubscribe link at the bottom of any Rex email, or change email preferences from your profile. Details in the [Privacy Policy](/docs/privacy).")
E("Transfer premium", "transfer premium|move premium|change server premium|premium to another server|switch server|move my tier|transfer tier|tier transfer|move ultra|move subscription",
  "Where the system allows it, a tier can be moved between eligible servers or accounts. The rules are in [Plans and Billing](/docs/plans). Ask in a support ticket and I'll pass your request on.",
  "Transfers depend on the code or plan. See [Plans and Billing](/docs/plans) and I can open a ticket so the team handles the move.")
E("Greeting topics", "what can i ask|what should i ask|what do you know|what topics|what can you help with|menu|topics|options|ideas",
  "Ask me about adding Rex, setting up the Dashboard, any command, Premium and codes, tickets and applications, appeals, moderation, levels, permissions, status problems and more. I can also open a ticket with the team.",
  "I know Rex's commands, Dashboard pages, plans, tickets, appeals and troubleshooting. Just ask in your own words.")
E("Rules", "rules|server rules of rex|what is allowed|what can get me blacklisted|acceptable use|abuse|misuse|rex rules|guidelines|code of conduct",
  "The [Rules and Guidelines](/docs/rules) explain acceptable use and what can lead to restrictions; the [Terms of Service](/docs/terms) cover the rest.",
  "Read the [Rules and Guidelines](/docs/rules) and [Terms of Service](/docs/terms) for what's allowed.")


# ------------------------------------------------------------------------------------------------ one topic per command
def _cmd_entries():
    q = ("{n}|/{n}|{n} command|use {n}|how to use {n}|how do i use {n}|how does {n} work|what does {n} do|what is {n}|{n} not working|{n} doesnt work|{n} error|{n} permissions|{n} help|who can use {n}|"
         "can i use {n}|{n} missing|{n} command missing|{n} command not showing|{n} options|{n} usage|{n} example|run {n}|{n} slash command|explain {n}|{n} tutorial|how to {n}|where is {n}")
    for name, desc, access, requires, params, summary, details, example, tips in CMDS:
        shown = "/" + name
        short = name.split(" ")[-1]
        keys = [k.format(n=name) for k in q.split("|")]
        if short != name:
            keys += [f"{short} command", f"how to use {short}", f"what does {short} do", f"{short} not working", f"/{short}", f"use {short}"]
        d = (summary or desc).rstrip(".")
        for t in re.split(r"[;,.]", desc.lower())[:1]:
            if len(t.split()) >= 2:
                keys.append(t.strip())
        who = {"staff": "It's a **staff** command, so you need the right Discord permission or a staff role set in the Dashboard.", "everyone": "Anyone can use it."}.get(access, "")
        if requires:
            who += " It also needs the **" + ", ".join(r.replace("_", " ") for r in requires) + "** permission."
        opts = ""
        if params:
            opts = " Options: " + ", ".join(f"`{p[0]}`" + ("" if p[2] else " (optional)") for p in params[:8]) + "."
        link = f" Full details: [/{name.split(' ')[0]}](/command?c={name.split(' ')[0]})."
        base = f"`{shown}`: {d}."
        if details:
            base += " " + details
        a1 = f"{base} {who}{opts}{link}"
        a2 = f"Here's how it works: `{shown}` {desc[0].lower() + desc[1:] if desc else ''}. {who}{opts}"
        if example:
            a2 += f" Example: `{example}`."
        a2 += link
        if tips:
            a2 += " Tip: " + tips[0]
        KB.append({"title": "Command " + name, "keys": keys, "answer": [a1, a2], "tags": ["command"]})


import re  # noqa: E402  (used by _cmd_entries)
_cmd_entries()

# older owner-edited style entries keep working
for it in _OLD:
    if not any(k["title"] == it["title"] for k in KB):
        KB.append({"title": it["title"], "keys": list(it["keys"]), "answer": [it["answer"]] if isinstance(it["answer"], str) else list(it["answer"]), "tags": []})


# generated per-setting / per-page topics + the newer hand-written ones
import json as _json  # noqa: E402
import helper_kb2  # noqa: E402,F401  (hand-written first so they win ties)
from helper_settings import TOPICS as _GEN_TOPICS  # noqa: E402
for _t in _GEN_TOPICS:
    KB.append({"title": _t["title"], "keys": list(_t["keys"]), "answer": list(_t["answer"]), "tags": list(_t.get("tags", []))})
