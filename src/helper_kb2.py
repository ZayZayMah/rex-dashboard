"""Hand-written topics added in the Applications / bot-gate / update-log release, plus general Discord help."""
from helper_kb import E

# ------------------------------------------------------------------------------------------------ applications
E("Applications overview", "applications|application forms|how do applications work|staff applications|apply system|applications tab|what are applications|application system|member applications|apply forms|app forms|application feature|rex applications|how do i make applications|moderator application|mod applications|set up applications|create an application",
  "Open the [Dashboard](/dashboard) → **Applications**. Build a form (what people apply for, questions, limits, accept/deny messages, a role), choose **DMs** or **website**, save, then add it to a ticket panel as an **Application form** button. Finished applications appear in your Mod log channel with **Reply / Accept / Deny** buttons.",
  "Applications are reusable forms. Make one on the **Applications** page, pick where people fill it in (Rex's DMs or a web page), and attach it to any ticket panel. Staff review each one in the mod log and press Accept or Deny.",
  "The **Applications** tab replaced Staff Applications. It holds all your forms. Each has its own questions, minimum answer lengths, limits per person, cooldown, role on accept and custom accept/deny messages.")
E("Add application to ticket panel", "add application to ticket panel|apply button on ticket panel|application button|put application on panel|apply ticket|apply tickets|how do i set up apply tickets|add apply button|application form button|ticket panel application|add an application to my tickets|apply tickets setup|normal ticket panel apply",
  "1) Build the form on **Applications** and Save. 2) Go to **Tickets** (or a **More ticket panels** panel). 3) Add a button and set *What the button does* to **Application form**. 4) Pick your form. 5) Save and post the panel. Apply buttons need Premium.",
  "Forms now live on the Applications page, and any ticket panel button can use one: Tickets → add button → *Application form* → choose the form. Post the panel with `/ticket` or the Dashboard.",
  "To put an apply button on a normal panel: create the form first, then on the panel add a button, choose **Application form** and select it. People press it and Rex starts the application.")
E("Application DM or website", "dm or website application|apply in dms|apply on website|application mode|dm application|website application|where do people fill the application|application in dms|application on the website|difference dm website application|which is better dm or website",
  "Each form has a *Where do they fill it in?* option. **DMs**: Rex asks one question at a time in private messages. **Website**: people sign in with Discord and fill one page. Website forms are easier for long answers; DMs feel quicker for short ones.",
  "Pick **DMs** or **website** per form on the Applications page. DM answers are collected one by one (type `STOP` to cancel). Website answers are submitted in one go and staff get a link to read them.",
  "DM mode needs the applicant to allow DMs from the server. Website mode needs nothing but a Discord login, so it works even when DMs are closed.")
E("Application review buttons", "reply accept deny|accept application|deny application|review applications|approve application|reject application|application buttons|how do i accept an application|how to deny an application|application review|application accepted role|application accept deny buttons|reply to applicant|message applicant",
  "Each submitted application appears in your Mod log channel with **Reply**, **Accept** and **Deny**. Accept gives the form's role and DMs the applicant; Deny removes that role and DMs them; Reply sends your own message to their DMs. Only staff can press them.",
  "Use the three buttons under the application: ✅ **Accept** (adds the role, DMs them), ⛔ **Deny** (removes the role, DMs them), 💬 **Reply** (opens a box and DMs your message).",
  "Reviewing is one click: Accept or Deny sends the form's accept/deny message and updates the role. You can customise both messages on the Applications page with {user}, {server} and {role}.")
E("Application buttons missing", "no accept button|application buttons not showing|accept deny missing|cant accept application|buttons not working application|application mod log empty|where do applications go|where are applications sent|application not arriving|no application received|applications not showing up",
  "Applications are posted in your **Mod log channel** (Logs & Reports). If none is set, they aren't delivered. Set one, make sure Rex can send messages and embeds there, and try again. Accept/Deny only work for staff.",
  "Check that a Mod log channel is chosen and Rex can post there. The Reply / Accept / Deny buttons are attached to the first message of each application.")
E("Application min length", "minimum characters|can i require 100 characters in an application|require minimum characters|minimum length|answer must be over 100 characters|min length|application minimum|character limit application|answer too short|require longer answers|application answer length|answers must be longer",
  "On the Applications page every short/long question has **Minimum characters**. Too-short answers are rejected with a message that deletes itself after 3 seconds, in DMs and on the website.",
  "Set *Minimum characters* on a question (0 = none, up to 1000). Applicants see how many characters they need and can try again.")
E("Application errors disappear", "error message deleted|message disappears dm|dm error vanishes|why does the error delete|message deletes itself|self deleting message|error deleted after 3 seconds|bot deletes its message|temporary error message",
  "That's intentional: mistakes in DM applications (like typing the wrong number or a too-short answer) show for 3 seconds and then delete themselves so your DM stays tidy. Just answer again.",
  "Small errors during an application disappear after 3 seconds. The question stays above, so reply again with a valid answer.")
E("Application limits", "application limit|applications per person|how many applications|cooldown application|apply again|can i apply twice|reapply|application cooldown|limit applications|stop spam applications|application hours between",
  "Each form has **Applications per person** (0 = unlimited) and **Hours between applications**. People who hit a limit are told when they can apply again.",
  "On the Applications page set *Applications per person* and *Hours between applications* to stop repeat submissions.")
E("Application not forwarded message", "not forwarded to staff|your reply was not forwarded|message not forwarded|dm auto reply|rex replies to my dms|why does rex say not forwarded|your message has not been forwarded",
  "Rex no longer sends that notice. DMs are still private and only forms or tickets you submit reach staff, but Rex stays quiet during DM applications and appeals.",
  "That automatic reply was removed in the latest update, so DM applications are no longer interrupted.")
E("Application role on accept", "role on accept|give role when accepted|accepted role|application role|auto role application|add role accepted application|remove role denied application|application role not given",
  "Choose *Role given when accepted* on the form. Accept adds it, Deny removes it. If nothing happens, Rex's role must be **above** that role and Rex needs Manage Roles.",
  "Role not given? Move Rex's role above the application role and make sure the applicant is still in the server.")
E("Application questions", "application questions|add questions|multiple choice question|long answer question|required question|optional question|how many questions|question types application|up to 25 questions|short answer question",
  "Each form takes up to 25 questions: short answer, long answer or multiple choice (2-10 options). Mark each required or optional (optional ones can be skipped by typing `skip` in DMs).",
  "Build questions on the Applications page: type the question, pick the answer type, choose required/optional and optionally a minimum length.")
E("Stop DM application", "cancel application|stop application|quit application|stop applying|abort application|how do i cancel my application|cancel dm application|exit application",
  "Type `STOP` in the DM, or press **Cancel** on the first message. Nothing is sent to staff.",
  "Reply `STOP` at any time and Rex cancels the application. You can start again from the server later.")
E("Application stuck", "application stuck|rex not asking next question|application not continuing|dm application frozen|rex stopped asking questions|application dm not working|cant start application|start button not working|application no dm",
  "Make sure you allow DMs from server members, press **Start** on Rex's message, and answer in that DM. If it still stalls, type `STOP` and begin again. Old unfinished applications expire after 24 hours.",
  "Open the DM from Rex, press Start, then reply to each question. If your DMs are closed Rex tells you; enable *Direct Messages* in the server's privacy settings.")

# ------------------------------------------------------------------------------------------------ bot gate
E("Stop new bots", "stop new bots on join|stop new bots|bot gate|stop bots joining|block bots|anti bot|antibot|stop bots on join|new bot approval|approve bots|bot approval|prevent bots|restrict new bots|raid bots|malicious bots|stop random bots|bot whitelist|only allow approved bots|anti raid bots|bot join protection",
  "**Stop new bots on join** (Protection & AutoMod → *Stop new bots*, off by default): when a bot joins, Rex removes its roles and permissions and posts **Allow / Remove**. Allow gives everything back; Remove kicks it.",
  "Turn on *Stop new bots on join* in the Dashboard. New bots are stripped until a moderator, the chosen role or the chosen person presses Allow or Remove. It's part of the anti-raid system.",
  "It stops a hacked or malicious bot from using its permissions the moment it joins: Rex zeroes the bot's permissions, removes other roles, then waits for approval.")
E("Bot gate who approves", "who can approve bots|approve role|bot approver|choose who approves bots|bot approval role|allow bot role|who decides bots|moderator approve bot|chosen person approve bot",
  "Set **Role that can approve bots** and/or **Person who can approve bots** under *Stop new bots*. Moderators, admins and the server owner can always decide.",
  "Pick an approver role or a single user ID on the Protection & AutoMod page. Everyone else sees an error when pressing the buttons.")
E("Bot gate not working", "bot gate not working|bot not stripped|bot kept permissions|new bot still has permissions|bot gate no message|no approval message|couldnt remove bot permissions|bot gate error|bot still admin",
  "Check: the setting is **on** and saved; an approval channel or Mod log channel is set; Rex has **Manage Roles** and **Kick Members**; and Rex's role is **above** the new bot's role (managed bot roles can't be edited from below).",
  "If a bot keeps its powers, move Rex's role higher in Server Settings → Roles. Rex can't change a role that sits above its own.")
E("Bot gate allow remove", "allow bot|remove bot|kick bot gate|restore bot permissions|bot allowed|bot removed|what does allow do|what does remove do|allow remove bot buttons",
  "**Allow** restores the bot's permissions and roles. **Remove (kick)** kicks it from the server. The message then shows who decided.",
  "Pressing Allow returns everything exactly as it was; Remove kicks the bot. Both are logged.")

# ------------------------------------------------------------------------------------------------ mod log
E("Public mod log warning", "mod log public|everyone can see mod log|are you sure mod log|mod log visible to everyone|modlog warning|public channel warning|mod log channel public|why does it ask are you sure|mod log privacy|hide mod log|private mod log",
  "If the channel you pick for the Mod log can be seen by @everyone, Rex asks **Are you sure?** first, on the website and in Discord, because the log holds moderation, ticket and application details. Use a staff-only channel for safety.",
  "Make the channel private (deny **View Channel** for @everyone, allow staff) and choose it again. Rex only asks when everyone could read it.",
  "That prompt protects you from leaking warnings, bans and applications. You can still confirm and use a public channel on purpose.")
E("Mod log setup", "set mod log|mod log channel|moderation log|set up mod log|where do logs go|mod logs|log channel|change mod log|logging channel|where are bans logged|where are warnings logged",
  "Dashboard → **Logs & Reports** → **Mod log channel**. Bans, kicks, timeouts, warnings, ticket logs and applications go there. Pick a staff-only channel.",
  "Choose the channel on the Logs & Reports page and save. You can also use the setup menus in Discord.")

# ------------------------------------------------------------------------------------------------ update log
E("Update log", "update log|updates|changelog|change log|what changed|latest update|new features|release notes|patch notes|whats new|what's new|recent changes|update log not updating|update log empty|update log outdated",
  "The update log now fills itself from every bot and website release, even small ones, and shows them newest first. An owner can post it in a channel with `/ownertools` and it keeps editing itself every minute.",
  "Check the update log channel in the support server, or the [About](/about) page. Minor fixes appear as *Minor bot update* / *Minor website update*.",
  "Not updating? The post edits itself each minute once the bot has the latest files; restart the bot after updating it.")

# ------------------------------------------------------------------------------------------------ tickets & appeals (extra)
E("Extra ticket panels", "more ticket panels|extra ticket panel|second ticket panel|multiple ticket panels|how many ticket panels|ticket panel limit|another ticket panel|different panels|panel per channel",
  "Free: 1 extra panel with a single button. Premium: 4 extra (5 total) with up to 5 buttons each. Ultra: unlimited. Build them on the Tickets page and post from the Dashboard or `/ticket`.",
  "Add panels under *More ticket panels*. Each panel can have its own title, colour, description and buttons.")
E("Ticket DM on close", "dm on close|ticket closed dm|notify ticket owner|ticket close dm|tell user ticket closed|dm when ticket closes",
  "Turn on *DM the ticket owner when it closes* on the Tickets page. Rex then messages them when staff close their ticket or appeal.",
  "Enable it in Tickets → When a ticket closes. It works for tickets and ban appeals.")
E("Appeals reply relay", "appeal reply|appeal messages|appeal relay|reply to appeal|appeal chat|talk to appellant|ban appeal dm|appeal in server|appeal thread",
  "Appeals open in the server you were banned from. Messages typed by either side are relayed as `**name: message**` so staff and the person can talk through Rex.",
  "Staff talk in the appeal channel; Rex passes it on to the person's DMs and back.")

# ------------------------------------------------------------------------------------------------ general Rex
E("Premium vs Ultra", "premium vs ultra|difference between premium and ultra|ultra or premium|which plan|compare plans|plans|what plans are there|what do i get with ultra|what do i get with premium|is ultra worth it|upgrade plan",
  "Free covers the essentials. **Premium** adds advanced tickets, the builder, protection tools and more panels. **Ultra** adds security monitoring, branding and unlimited panels. See [Premium](/premium).",
  "Compare on the [Premium page](/premium): Premium unlocks power features, Ultra adds the security suite and customisation.")
E("Contact staff", "contact staff|talk to a human|speak to staff|open a ticket|need human help|human support|real person|support team|contact the team|talk to support|help from staff|i need staff",
  "I can open a ticket with the team: say *talk to staff* and describe the problem, or join the support server and use Contact Staff.",
  "If I can't solve it, tell me and I'll gather the details and send them to the team.")
E("Feedback", "feedback|suggestion|suggest a feature|feature request|report a bug|bug report|give feedback|i have an idea|improve rex|idea for rex|complaint",
  "Tell me your feedback right here. I'll keep the chat open as long as you want to add more, and pass it to the team.",
  "Suggestions and bug reports are welcome. Type them here and say *done* when finished.")
E("Backup restore", "backup|restore settings|export settings|import settings|save my config|copy settings to another server|clone settings|migrate settings|settings backup",
  "Use the Dashboard's activity log to undo changes. Owners can export/import config with the owner tools, and many pages let you copy values by hand to a second server.",
  "There's no one-click clone yet; settings are per server. The activity log lets you roll back recent changes.")
E("Data privacy", "privacy|what data does rex store|data stored|delete my data|gdpr|do you store messages|privacy policy|personal data|data deletion|remove my data",
  "See the [Privacy Policy](/docs/privacy). Rex stores settings and the minimum it needs to work. Ask staff through a ticket to delete your data.",
  "Details are in the [Privacy Policy](/docs/privacy); for deletion requests, ask me to open a ticket.")
E("Rex slow", "rex is slow|lag|delay|late reply|slow response|bot lagging|takes long|laggy|rex slow to respond|commands slow",
  "Check [Live stats](/live) for latency. Short delays happen during restarts or busy periods; if it lasts, tell me which command is slow.",
  "Occasional slowness is usually Discord or a restart. Re-run the command after a moment.")
E("Rex joined with admin", "why does rex need administrator|admin permission rex|is administrator safe|rex needs admin|can i remove admin from rex|least permissions|minimum permissions rex",
  "Administrator is the easiest, but Rex works with specific permissions: View Channels, Send Messages, Embed Links, Manage Roles, Manage Channels, Kick/Ban Members and Moderate Members. Keep its role above the roles it manages.",
  "You can give Rex only what you need; `/botperms` tells you what's missing for each feature.")

# ------------------------------------------------------------------------------------------------ general Discord help
_GEN = [
 ("Create a role", "how to make a role|create role|new role|add a role discord|make a role", "Server Settings → **Roles** → **Create Role**. Name it, pick a colour and permissions, then assign it from a member's profile or Rex's autorole.", "In Discord: Server Settings → Roles → Create Role. Drag it to the right position in the list."),
 ("Create a channel", "how to make a channel|create channel|new channel|add a channel|make a text channel", "Right-click your server's category (or use the + next to a category) → **Create Channel**. Choose text or voice and set permissions.", "Press + beside a category, name the channel and choose whether it's private."),
 ("Private channel", "make a private channel|private channel|staff only channel|hide a channel|channel only staff can see|restrict channel", "Edit the channel → Permissions. Turn on *Private Channel* or deny **View Channel** for @everyone and allow it for your staff role.", "Deny View Channel for @everyone, then add your staff role with View Channel allowed."),
 ("Permissions basics", "discord permissions|channel permissions|role permissions explained|permission overwrite|how do permissions work", "Role permissions apply server-wide; channel permissions override them for that channel. Deny beats allow at the same level; more specific overrides win.", "Think: server role → category → channel. The closest setting to the channel wins unless a deny applies."),
 ("Role order", "role order|role hierarchy discord|move role up|why cant bot give role|roles ordering|role position", "A bot or member can only manage roles **below** their highest role. Drag Rex's role above the ones it gives.", "Server Settings → Roles: drag Rex's role higher than any role it must add or remove."),
 ("Ban a member", "how to ban|ban someone|ban a user|ban command|ban member", "Use `/ban user reason` (needs Ban Members), or right-click the member → Ban. Rex logs it in your Mod log.", "Run `/ban`, choose the user and a reason. Appeals can be enabled on the Ban Appeals page."),
 ("Kick a member", "how to kick|kick someone|kick command|kick member", "Use `/kick user reason`. Rex needs Kick Members and a role above the member's.", "Run `/kick`, pick the member and give a reason; it's logged for staff."),
 ("Timeout a member", "timeout|mute someone|how to mute|time out a user|timeout command", "Use `/timeout` with a duration and reason. Rex needs Moderate Members.", "Run `/timeout user duration reason`. The member can't chat until it ends."),
 ("Warn a member", "warn someone|warning system|how to warn|warn command|warnings", "Use `/warn user reason`. Rex records it; `/warns user` lists them.", "Warn with `/warn`; staff can see history with `/warns`."),
 ("Purge messages", "delete messages|purge|clear chat|bulk delete|clean channel|delete many messages", "Use `/purge` (needs Manage Messages). Discord can't bulk-delete messages older than 14 days.", "Run `/purge` and say how many messages to remove."),
 ("Slowmode", "slowmode|slow mode|rate limit chat|set slowmode", "Use `/slowmode seconds`, or Channel Settings → Slowmode.", "Run `/slowmode 10` for a 10 second delay; `0` turns it off."),
 ("Lock a channel", "lock channel|lockdown|lock the chat|stop people talking|lock a channel", "Use `/lock` (and `/unlock`). For the whole server use `/lockdown` and `/unlockdown`.", "Run `/lock` in the channel; it denies Send Messages for @everyone until you unlock it."),
 ("Find IDs", "how to get user id|get channel id|copy id|find role id|developer mode|discord id|how do i find an id", "Enable **Developer Mode** (User Settings → Advanced), then right-click a user, channel or role → **Copy ID**.", "Developer Mode → right-click → Copy ID. Rex's pickers usually let you choose from a list instead."),
 ("Invite links", "create invite|make invite link|server invite|invite tracking|permanent invite|invite expiry|discord invite", "Right-click a channel → **Invite People**, then set expiry/uses. Rex's invite tools can track them too.", "Create a link from a channel's invite button; set it to never expire for a permanent one."),
 ("Slash commands not showing", "slash commands missing|commands not appearing|/ commands not showing|cant see rex commands|slash command not found|commands dont show up", "Make sure Rex was added with the *applications.commands* scope ([re-add it]({ADD})), type `/` and wait, and check Server Settings → Integrations → Rex for command permissions.", "Reinvite Rex using the link on the home page, restart Discord, and check Integrations → Rex."),
 ("Nickname", "change nickname|set nickname|nickname|rename member|change someone's name", "Right-click the member → Change Nickname. Rex's nickname tools need a role above theirs.", "Use Discord's right-click profile menu."),
 ("Voice channel", "voice channel|vc|move member voice|voice mute|voice permissions|deafen", "Rex can move, mute and deafen with its voice tools (needs Move/Mute/Deafen Members). Check the channel's permissions too.", "Use the voice moderation commands from the commands page; they need the matching permission."),
 ("Emoji and stickers", "add emoji|custom emoji|upload emoji|emojis not working|stickers|emoji limit", "Server Settings → Emoji → Upload. Slots depend on your boost level.", "Upload under Server Settings → Emoji; boost the server for more slots."),
 ("Server boost", "boost server|nitro boost|what do boosts do|boost perks|boost level", "Boosting unlocks emoji slots, upload size, banner and better audio. Rex can show boost info with `/serverinfo`.", "Boost from the server menu; levels 1-3 unlock perks."),
 ("Community server", "enable community|community server|community features|rules channel|updates channel|community setup", "Server Settings → **Enable Community** and follow the steps (verification, explicit content filter, rules and updates channels).", "Turning on Community unlocks Discovery, announcement channels and onboarding."),
 ("Onboarding", "onboarding|welcome screen|server guide|new member questions|discord onboarding", "Server Settings → Onboarding lets you add questions that give roles. Rex's Welcome page adds messages, roles and DMs on top.", "Use Discord Onboarding for choices and Rex's welcome tools for greetings."),
 ("Reaction roles", "reaction roles|self roles|role menu|roles by reaction|button roles|dropdown roles|let members pick roles", "Create a menu with Rex's role tools or the Builder (Premium), then members press buttons or pick from a dropdown.", "Set up role pickers from the Dashboard or with the role-menu commands."),
 ("Welcome message", "welcome message|greet new members|welcome channel|join message|welcome embed|welcome image", "Dashboard → **Welcome & Leave**: pick the channel, write the message ({user}, {server}), and optionally an embed or image card.", "Choose a welcome channel, type the message, save. Use `/welcometest` to preview."),
 ("Leveling", "levels|xp|leaderboard|rank|level up|level roles|leveling system|how do levels work", "Dashboard → **Levels & XP**: turn it on, set XP rate and level-up messages, and give roles at levels. Members check `/level` or `/xp`, and `/leaderboard` shows the top members.", "Enable levels, choose rewards and a level-up channel, then chat to earn XP."),
 ("Auto role", "auto role|autorole|give role on join|default role|role for new members|assign role automatically", "Dashboard → **Welcome & Leave** → **Auto role**. Rex's role must be above it.", "Pick the role in *Auto role* and save; every new member receives it."),
 ("Verification", "verification|verify members|captcha|verify button|member verification|join gate|verification role", "Dashboard → **Verification**: choose the role and method. Unverified members only see the verify channel.", "Set it up on the Verification page, then post the verify message."),
 ("Anti spam", "anti spam|spam protection|stop spam|automod spam|too many messages|flood|anti flood|spam filter", "Dashboard → **Protection & AutoMod**: turn on anti-spam and set the limits. Premium unlocks the full tools.", "Enable Anti-spam on Protection & AutoMod; choose what happens to spammers."),
 ("Anti link", "anti link|block links|stop links|link filter|no invites|delete invite links|link protection", "Turn on *Anti-link* on Protection & AutoMod and pick allowed channels/roles.", "Anti-link deletes links (and invites) from people who aren't allowed to post them."),
 ("Anti raid", "anti raid|raid protection|raid mode|stop raids|server being raided|mass join|join spam|lockdown server|raid alert", "Ultra's Security page has join-burst alerts, and moderators can use raid mode to lock the server. Turn on **Stop new bots on join** to block hostile bots too.", "During a raid: enable raid mode, raise verification, and review recent joins."),
 ("Anti nuke", "anti nuke|nuke protection|stop mass delete|mass ban protection|channel delete protection|server nuked|protect from nuking", "Security (Ultra) alerts on mass deletions and risky role/channel changes. Keep admin roles to trusted people only.", "Limit who has Administrator, enable the security alerts, and keep Rex's role high."),
 ("Giveaways", "giveaway|start a giveaway|giveaways|raffle|contest|giveaway command", "Use the giveaway commands listed on the [commands page](/commands) to start, end and reroll giveaways.", "Run the giveaway command with a prize, duration and winners."),
 ("Polls", "poll|create a poll|vote command|make a poll|polls|survey", "Use `/polls` to create a quick vote.", "Run `/polls`, or use Discord's built-in poll."),
 ("Reminders", "remind me|reminder|set a reminder|reminders|reminder command|timer", "Use `/reminder` to set a reminder; Rex pings you when it's due.", "Run `/reminder` and give it a time and a message."),
 ("AFK", "afk|set afk|away from keyboard|afk status", "Use `/afk reason`. Rex tells people you're away and clears it when you talk again.", "Run `/afk` and chat later to come back automatically."),
 ("Custom commands", "custom commands|make my own command|builder|command builder|custom command premium|create a command|own commands", "Premium: the **Builder** lets you make commands and events from blocks. Open it from the Dashboard → Custom Commands.", "Use the Builder to design replies and actions without code."),
 ("Embeds", "embed|send embed|embed builder|make an embed|custom embed|rich embed", "Use the embed tools or the Builder to send styled messages with a title, colour, fields and image.", "Create an embed in the Dashboard builders or with Rex's embed command."),
 ("Email builder", "email builder|send emails|email campaign|newsletter|mail|email templates|emails", "The [Email builder](/email-builder) lets you design and send emails to your own audience.", "Open the Email builder from the site menu to build and test an email."),
 ("Pages builder", "pages|page builder|make a website page|server page|public page|landing page", "The [Page builder](/page-builder) creates a public page for your server (beta).", "Design a page there, then share its link."),
 ("Transcripts", "ticket transcript|transcript|save ticket chat|ticket log|view transcript|ticket history", "Closed tickets save a transcript you can open from the Dashboard's Tickets activity. Use the link Rex posts in your log.", "Transcripts are linked in your mod log when a ticket closes."),
 ("Announcements", "announcement|announce|publish|crosspost|announcement channel|post update", "Use announcement channels and Rex's publisher tools to post and crosspost updates.", "Post in an announcement channel and press Publish, or let Rex auto-publish."),
 ("Starboard", "starboard|star messages|best messages|highlight messages|star reaction", "Enable the starboard from the Community page: members react with a star to feature a message.", "Pick a starboard channel and a star count threshold."),
 ("Birthdays", "birthdays|birthday message|set birthday|birthday role|happy birthday", "Members use the birthday command; Rex greets them in your birthday channel.", "Enable birthdays, choose a channel, and members set their date."),
 ("Suggestions", "suggestion channel|suggest command|server suggestions|vote on suggestions|suggestions system", "Use the suggestions commands/settings to let members propose ideas that others vote on.", "Set a suggestions channel and use the suggest command."),
 ("Music", "music|play music|music bot|play songs|youtube music|spotify|dj", "I don't know of music playback in Rex's command list, so a dedicated music bot is the safer choice.", "Rex's command list has no music commands."),
 ("Economy", "economy|coins|currency|balance|daily reward|shop|gambling", "Rex has `/balance` and `/daily`; check the [commands page](/commands) for what's available.", "See the commands page for current economy and game commands."),
 ("Bot offline status", "rex offline status|bot invisible|why is rex grey|rex shows offline|rex appears offline", "Rex may be restarting. Look at [Live stats](/live) for its real status.", "Check Live stats; if it says online, refresh Discord."),
 ("Language", "language|translate|other languages|speak spanish|english only|rex language", "Rex's commands and this helper are in English. I can still try to understand simple messages in other languages.", "The Dashboard is English only for now."),
 ("Mobile", "mobile|phone|ipad|use dashboard on phone|app|dashboard on mobile|iphone", "The Dashboard works on phones. Tap the menu button for pages, and use landscape for the bigger editors.", "Open the site in your phone browser; everything is responsive."),
 ("Dark mode", "dark mode|theme|light mode|change theme|colors|appearance", "Pick a theme from the palette icon in the site menu.", "Themes are in the top menu; your choice is remembered on this device."),
 ("Owner", "who owns rex|who made rex|developer|creator|who is the owner|rex team|who runs rex", "Rex is built and run by the Rex development team. For anything account-related, ask me to open a ticket.", "The Rex development team maintains the bot and website."),
]
for t, k, *a in _GEN:
    E(t, k, *a)
