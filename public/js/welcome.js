'use strict';
/* The /welcome guide. One file holds the default text, the renderer (also used for the owner preview) and the page itself.
   Owners can replace the text in Owner tools > Welcome guide; the saved version is served from /api/welcome. */
window.Welcome = (function () {
  const IMG = '/img/welcome/';
  const DEFAULT = {
    team: {
      title: 'Welcome to Rex 👋',
      text: "Hi, and thank you for giving Rex a try. We're a small team and we built this guide so you never have to guess.\n\nIt starts at the very beginning (adding Rex to your server) and goes all the way to the details: the dashboard, tickets, premium codes, email settings and how our support works. Use the **Jump to** list to go straight to the part you need, or read it top to bottom once and you'll know everything.\n\nIf something is unclear, tell us in the support server. It helps us make this better for the next person.\n\n— The Rex team"
    },
    sections: [
      { id: 'what-is-rex', group: 'Getting started', title: 'What Rex is', body: "Rex is a Discord bot for running a community. It handles the daily work (welcoming people, tickets, moderation, levels and logs) and has a website, the **dashboard**, where you set everything up without typing commands.\n\nTwo things to know before anything else:\n\n- **The bot** lives inside your Discord server. It does the work.\n- **The website** is where you change how the bot behaves. Changes reach the bot within a few seconds.\n\n> You do not need to be technical. If you can click buttons and fill in boxes, you can set up Rex." },
      { id: 'before-you-start', group: 'Getting started', title: 'Before you start', body: "You only need three things:\n\n1. A Discord account that you are logged in to.\n2. A server where you have the **Manage Server** permission (if you created the server, you have it).\n3. A couple of minutes.\n\n> If you are not sure you have the permission, open your server in Discord, right-click the server name, choose **Server Settings**, then **Roles**. Your role needs **Manage Server** (or **Administrator**) switched on." },
      { id: 'add-rex', group: 'Getting started', title: 'Add Rex to your server', body: "1. Open the [Rex home page](/) and press **Add Rex to your server**.\n2. Discord asks which server to add Rex to. Choose yours.\n3. Read the permissions and press **Authorise**. Rex needs them to do things like manage roles and timeout people. You can change them later in Discord.\n4. Finish the little \"I am human\" check if Discord shows one.\n\n![Illustration: the Add to server screen. 1 pick your server, 2 the permissions Rex asks for, 3 press Authorise.](" + IMG + "ill-add-bot.png)\n\n![The Rex home page. 1 Add Rex to your server, 2 Join support server, 3 Open the dashboard.](" + IMG + "home.png)\n\nWhen it works, Rex appears in your member list and says hello in your server.\n\n### If the server isn't in the list\n\n- You are not logged in to the right Discord account. Switch account in the top-left of the Discord page.\n- You do not have **Manage Server** there.\n- You are on mobile in an in-app browser. Open the link in your normal browser instead." },
      { id: 'log-in', group: 'Getting started', title: 'Log in to the dashboard', body: "1. Press **Dashboard** in the top bar (or **Open the dashboard** on the home page).\n2. Press **Log in with Discord** and allow it. Rex only asks to know who you are and which servers you are in.\n3. You land on **Your servers**.\n\n> Only servers where you have **Manage Server** or **Administrator** are listed. If yours is missing, see [Add Rex](#add-rex) above.\n\nYou can log out any time from your profile picture at the top right." },
      { id: 'dashboard-tour', group: 'Using the dashboard', title: 'A tour of the dashboard', body: "Pick a server and you get its own settings page.\n\n![Your servers. 1 click your server. 2 your profile menu.](" + IMG + "servers.png)\n\nOn the left is the menu, grouped so it stays short:\n\n![The server page. 1 Welcome & logs group, 2 Welcome channel setting, 3 message box.](" + IMG + "server-welcome.png)\n\n- **Welcome & logs**: greeting people and keeping a record of what happens.\n- **Help & safety**: tickets, appeals, applications, verification and protection.\n- **Community**: levels and fun.\n- **Build**: your own commands and events (needs Premium).\n- **Insights & plan**: stats and your plan.\n- **Account**: Premium and transcripts.\n\n![The groups open and close. 1 Help & safety, 2 Community, 3 Build.](" + IMG + "server-groups.png)\n\n> A small badge like **Premium** or **Ultra** next to a section means it needs that plan on your server. You can still look at it.\n\nEvery change you make is saved and shown in the **Activity** box at the top, so you can always see what changed." },
      { id: 'welcome-leave', group: 'Using the dashboard', title: 'Welcome and leave messages', body: "Greet new members and say goodbye.\n\n1. Open **Welcome & logs > Welcome & Leave**.\n2. Choose a **Welcome channel**. Pick a channel from the list. \"None (off)\" means no messages.\n3. Write the **Welcome message**. Type `{user}` where the member's name goes and `{server}` for the server name, for example: `Welcome {user} to {server}!`\n4. Do the same for the **Leave channel** and **Leave message** if you want goodbyes.\n5. Optionally pick an **Auto role** that every new member gets.\n\n> Styled embeds for the welcome message are a Premium option.\n\nChanges save by themselves and reach Rex in a few seconds." },
      { id: 'tickets', group: 'Using the dashboard', title: 'Tickets for your members', body: "Tickets give each person a private channel with your staff.\n\n![The Tickets settings. 1 the section, 2 the category and panel options.](" + IMG + "server-tickets.png)\n\n1. Open **Help & safety > Tickets**.\n2. Choose the **Ticket category**. New private ticket channels are created inside it.\n3. Set the **Panel title** and **Panel description**: this is the text people see above the button.\n4. Post the panel in the channel you want (the page has a button for this).\n\nThen members press the button in Discord:\n\n![Illustration: the ticket panel. 1 members press Open a ticket.](" + IMG + "ill-ticket.png)\n\n![Illustration: a ticket channel. 1 Rex's greeting, 2 the Close ticket button.](" + IMG + "ill-ticket-chan.png)\n\nWhen a ticket is closed, Rex keeps a **transcript** you can open later from **Account > Transcripts** and share as a link." },
      { id: 'logs-and-safety', group: 'Using the dashboard', title: 'Logs, appeals and protection', body: "- **Logs & Reports** keeps a record of what happens in your server in a channel you pick.\n- **Ban appeals** and **Applications** let members apply through Rex instead of messaging staff.\n- **Verification** adds a check when someone joins.\n- **Protection & AutoMod** (Premium) and **Security** (Ultra) catch spam, raids and risky links.\n- **Staff roles** (Premium) lets you decide who counts as staff for Rex.\n\n> Start small. Switch on logs first, then one safety feature at a time, so you can see what each one does." },
      { id: 'levels-community', group: 'Using the dashboard', title: 'Levels and community', body: "Members earn XP for chatting and talking in voice, climb a leaderboard and get level cards. Open **Community > Levels** to see the options for your server and switch it on.\n\n> People can also earn bonus XP by redeeming XP codes with `/redeem`." },
      { id: 'builders', group: 'Using the dashboard', title: 'Your own commands and events', body: "In **Build** you can make your own slash commands and automatic events with a visual builder. It opens on its own page because it needs room, and everything you build is saved to your server.\n\n> The builders need a Premium plan on the server." },
      { id: 'premium', group: 'Using the dashboard', title: 'Premium, Priority and Ultra codes', body: "The [Premium page](/premium) shows what each plan adds.\n\nIf someone gave you a code (or you won one), redeem it **inside the server you want to upgrade**:\n\n1. In that server's Discord, type `/redeem`.\n2. Paste the code, for example `REX-PREMIUM-XXXXXXXXXXXXXXXX`.\n3. Send it. Rex confirms the plan and for how long.\n\n![The Premium page.](" + IMG + "premium.png)\n\n### If a code doesn't work\n\n- It can be **expired** (some have a deadline), **used up** (a code has a limited number of uses) or already redeemed. Rex tells you which one.\n- Codes only work for the server where you redeem them.\n- Check you copied all of it, with no spaces." },
      { id: 'profile-email', group: 'Your account', title: 'Your profile and email preferences', body: "Open your profile from the picture at the top right. Under **Email preferences** you choose which emails Rex may send you. We only send to the email on your Discord account.\n\n![Email preferences on your profile. 1 the box, 2 a switch for one kind of email.](" + IMG + "profile.png)\n\n1. Open your profile.\n2. Find **Email preferences**.\n3. Switch each kind on or off, for example **Announcements** or **New features**.\n4. **Important notices** are account and security messages (like a server being banned). We recommend keeping them on.\n\nEvery email also has an **Unsubscribe** link and a **Change which emails you get** link at the bottom. You never have to log in to use them.\n\n> If your Discord account has no verified email, there is nothing to send to and this box says so." },
      { id: 'support-helper', group: 'Getting help', title: 'Using the support helper', body: "Open [Support](/support) and pick what you need. Rex asks a few quick questions and answers what he can straight away, with links to the exact page or setting.\n\n![The support page.](" + IMG + "support.png)\n\nIf Rex can't solve it, he says so and gets a person. You never have to repeat yourself: the whole chat goes along." },
      { id: 'ticket-forwarding', group: 'Getting help', title: 'How support tickets reach our server', body: "When the helper needs a human, it **forwards your chat to the staff in the Rex support server**. A team member then answers you in the same chat on the website.\n\n1. You chat on the [Support page](/support).\n2. If it needs a person, Rex opens a ticket for you and tells you.\n3. Staff see it in their ticket channel in the support server and claim it.\n\n![Illustration: staff view in the support server. 1 the new chat, 2 the Claim button.](" + IMG + "ill-forward.png)\n\n4. Their replies show up in your chat. You can keep using the site; you'll see the answer when you come back.\n\n> Chats are removed automatically 30 days after they close unless staff keep one for a reason." },
      { id: 'support-server', group: 'Getting help', title: 'Join the support server', body: "Press **Join support server** at the top of any page. Discord shows the invite:\n\n![Illustration: the invite. 1 press Accept Invite.](" + IMG + "ill-invite.png)\n\nIn there you can ask questions, suggest features and hear about updates first." },
      { id: 'troubleshooting', group: 'Getting help', title: 'Quick fixes', body: "- **I can't see my server in the dashboard.** You need **Manage Server** there, and Rex must be added first.\n- **A change didn't happen.** Wait a few seconds, then check the **Activity** box. Make sure Rex's role is above the roles it needs to manage.\n- **I can't log in.** Try again in a normal browser window, and allow cookies.\n- **A code failed.** See [Premium codes](#premium).\n- **Still stuck.** Open [Support](/support) and the helper will point you in the right direction, or get a person." }
    ]
  };

  const SAFE = (u) => /^(https:\/\/|\/|#)/.test(u) ? u : '#';
  function inline(text) {
    const out = [], re = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g; let last = 0, m;
    while ((m = re.exec(text))) {
      if (m.index > last) out.push(text.slice(last, m.index));
      const t = m[0];
      if (t.startsWith('**')) out.push(h('b', {}, t.slice(2, -2)));
      else if (t.startsWith('`')) out.push(h('code', {}, t.slice(1, -1)));
      else { const mm = /\[([^\]]+)\]\(([^)]+)\)/.exec(t); out.push(h('a', { href: SAFE(mm[2]) }, mm[1])); }
      last = m.index + t.length;
    }
    if (last < text.length) out.push(text.slice(last));
    return out;
  }
  const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  function body(src, sid) {
    const nodes = [];
    String(src || '').split(/\n\s*\n/).forEach((blk) => {
      const lines = blk.split('\n').map((l) => l.trimEnd()).filter((l) => l.trim());
      if (!lines.length) return;
      const l0 = lines[0];
      if (/^###\s/.test(l0)) { const t = l0.replace(/^###\s+/, ''); nodes.push(h('h3', { id: sid + '-' + slug(t), class: 'wl-h3' }, t)); lines.shift(); if (!lines.length) return; }
      const first = lines[0];
      const im = /^!\[([^\]]*)\]\(([^)\s]+)\)$/.exec(first);
      if (im && lines.length === 1) {
        const ill = /^Illustration:/i.test(im[1]);
        const cap = im[1].replace(/^Illustration:\s*/i, '');
        nodes.push(h('figure', { class: 'wl-fig' }, h('img', { src: SAFE(im[2]), alt: cap, loading: 'lazy', onclick: (e) => e.currentTarget.classList.toggle('zoom') }), h('figcaption', {}, ill ? h('span', { class: 'wl-ill' }, 'Illustration') : null, caption(cap))));
      } else if (/^\d+\.\s/.test(first)) nodes.push(h('ol', { class: 'wl-steps' }, lines.map((l) => h('li', {}, inline(l.replace(/^\d+\.\s+/, ''))))));
      else if (/^-\s/.test(first)) nodes.push(h('ul', { class: 'wl-list' }, lines.map((l) => h('li', {}, inline(l.replace(/^-\s+/, ''))))));
      else if (/^>\s?/.test(first)) nodes.push(h('div', { class: 'wl-tip' }, h('span', { 'aria-hidden': 'true' }, '💡'), h('div', {}, inline(lines.map((l) => l.replace(/^>\s?/, '')).join(' ')))));
      else nodes.push(h('p', {}, inline(lines.join(' '))));
    });
    return nodes;
  }
  // "1 pick your server, 2 the permissions" -> numbered key under the picture
  function caption(text) {
    const parts = text.split(/(?<=[.,])\s+(?=\d\s)/).map((x) => x.trim()).filter(Boolean);
    const head = []; const keys = [];
    parts.forEach((p) => { const m = /^(\d)\s+(.*?)[,.]?$/.exec(p); if (m) keys.push(h('span', { class: 'wl-key' }, h('i', {}, m[1]), m[2])); else head.push(p); });
    return h('span', {}, head.join(' ').replace(/[.]\s*$/, '') + (keys.length && head.length ? '.' : ''), ' ', keys);
  }

  function render(content) {
    const c = content && content.sections && content.sections.length ? content : DEFAULT;
    const team = c.team && (c.team.title || c.team.text) ? c.team : DEFAULT.team;
    const groups = []; c.sections.forEach((s) => { let g = groups.find((x) => x.name === (s.group || 'Guide')); if (!g) groups.push(g = { name: s.group || 'Guide', items: [] }); g.items.push(s); });
    const toc = h('nav', { class: 'wl-toc', 'aria-label': 'Jump to' }, h('div', { class: 'wl-toc-t' }, 'Jump to'), groups.map((g) => h('div', { class: 'wl-toc-g' }, h('div', { class: 'wl-toc-gn' }, g.name), g.items.map((s) => h('a', { href: '#' + s.id, 'data-for': s.id }, s.title)))));
    const hero = h('section', { class: 'wl-hero' }, h('img', { src: '/img/rex-logo.png', alt: '', width: 64, height: 64 }), h('div', {}, h('h1', {}, team.title || 'Welcome'), ...String(team.text || '').split(/\n\s*\n/).map((p) => h('p', {}, inline(p.replace(/\n/g, ' '))))));
    const quick = h('div', { class: 'wl-quick' }, ['add-rex', 'welcome-leave', 'tickets', 'premium', 'profile-email', 'ticket-forwarding'].map((id) => c.sections.find((s) => s.id === id)).filter(Boolean).map((s) => h('a', { href: '#' + s.id, class: 'wl-q' }, h('b', {}, s.title), h('span', { class: 'muted small' }, 'Go →'))));
    const secs = c.sections.map((s, i) => h('section', { class: 'wl-sec', id: s.id }, h('div', { class: 'wl-num' }, String(i + 1)), h('h2', {}, s.title), ...body(s.body, s.id)));
    const top = h('a', { href: '#', class: 'wl-top', 'aria-label': 'Back to top', onclick: (e) => { e.preventDefault(); scrollTo({ top: 0, behavior: 'smooth' }); } }, '↑');
    const mobile = h('details', { class: 'wl-mob' }, h('summary', {}, 'Jump to a section'), toc.cloneNode(true));
    const root = h('div', { class: 'wl' }, h('div', { class: 'wl-side' }, toc), h('div', { class: 'wl-main' }, hero, mobile, h('h2', { class: 'wl-qt' }, 'Most people want one of these'), quick, secs, top));
    const links = [...root.querySelectorAll('.wl-toc a')];
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((es) => es.forEach((en) => { if (en.isIntersecting) links.forEach((a) => a.classList.toggle('on', a.dataset.for === en.target.id)); }), { rootMargin: '-20% 0px -70% 0px' });
      root.querySelectorAll('.wl-sec').forEach((s) => io.observe(s));
    }
    return root;
  }
  return { DEFAULT, render };
})();

(async function () {
  const app = document.getElementById('app');
  if (!app || !document.body.classList.contains('page-welcome')) return;
  await mountNav('welcome');
  if (REX.blocked) return;
  let content = null;
  try { content = (await api('/api/welcome')).content; } catch (e) { /* the built-in guide is used */ }
  app.replaceChildren(Welcome.render(content));
  if (location.hash) { const el = document.getElementById(decodeURIComponent(location.hash.slice(1))); if (el) setTimeout(() => el.scrollIntoView(), 60); }
})();
