'use strict';
(async function () {
  const app = document.getElementById('app');
  await mountNav('about');

  const FEATURES = [
    ['Moderation', 'Ban, kick, timeout, warn, quarantine, temporary roles, lockdowns and message cleanup, with numbered moderation cases, staff notes and a per-member history.', '/commands?cat=moderation'],
    ['Tickets & appeals', 'Ticket panels with staff roles and welcome messages, an action menu for managing the current ticket, plus ban-appeal tickets in the support server.', '/commands?cat=setup'],
    ['Levels & XP', 'Message and voice XP, animated level cards, leaderboards and level reward roles with a configurable XP multiplier.', '/commands?cat=levels'],
    ['Economy & games', 'Coins, daily rewards, rock-paper-scissors, Connect Four, Hangman, Wordle-style puzzles, Minesweeper, trivia and more.', '/commands?cat=games'],
    ['Community tools', 'Counting channel, suggestion panels, polls and votes, giveaways, member reports and staff applications.', '/commands?cat=setup'],
    ['Verification', 'Verification panel with a verified role, and Roblox account verification.', '/dashboard'],
    ['Security (Premium)', 'Anti-spam, anti-link, anti-swear, AutoMod word lists, anti-alt, anti-ping and honeypot channels.', '/premium'],
    ['Raid protection (Ultra)', 'Join-burst and new-account alerts, mention-flood and invite-link detection, optional auto-delete and timeouts, message logs and custom branding.', '/premium'],
  ];

  const hero = h('div', { class: 'page-head' }, h('div', {}, h('div', { class: 'eyebrow' }, 'About'), h('h1', {}, 'Meet REX'),
    h('p', { class: 'lead' }, 'REX is a Discord bot for communities that want moderation, support tools, levels and games in one place, with a website dashboard so you never have to memorise a settings command.')));

  const sub = h('nav', { class: 'subnav', 'aria-label': 'About sections' },
    h('a', { class: 'active', href: '/about' }, 'Overview'), h('a', { href: '#features' }, 'Features'), h('a', { href: '#start' }, 'Get started'),
    h('a', { href: '/commands' }, 'Command directory'), h('a', { href: '/premium' }, 'Premium'), h('a', { href: '#faq' }, 'FAQ'));

  const status = h('div', { class: 'statbar', id: 'about-stats' });
  const stat = (id, label) => h('div', { class: 'stat' }, h('b', { id }, '—'), h('span', {}, label));
  status.append(stat('a-guilds', 'Servers'), stat('a-users', 'Members'), stat('a-cmds', 'Commands'), stat('a-up', 'Uptime'));

  const features = h('section', { id: 'features' }, h('div', { class: 'section-title' }, h('h2', {}, 'What REX can do')),
    h('div', { class: 'grid cols-4 tiles' }, FEATURES.map(([t, d, href]) => h('a', { class: 'panel', href }, h('h3', {}, t), h('p', {}, d)))));

  const start = h('section', { id: 'start' }, h('div', { class: 'section-title' }, h('h2', {}, 'Get started in five steps')),
    h('div', { class: 'panel' }, h('ol', { class: 'steps' },
      h('li', {}, h('div', {}, h('b', {}, 'Add REX to your server'), h('p', {}, 'Use the Add REX button. You need the Manage Server permission to add a bot.'))),
      h('li', {}, h('div', {}, h('b', {}, 'Log in with Discord'), h('p', {}, 'The dashboard lists every server where you can manage the server and shows which ones REX is already in.'))),
      h('li', {}, h('div', {}, h('b', {}, 'Open Manage on your server'), h('p', {}, 'Pick channels and roles from your real server lists: welcome messages, mod log, tickets, levels and more.'))),
      h('li', {}, h('div', {}, h('b', {}, 'Save'), h('p', {}, 'Your changes wait in a queue. REX picks them up within about 15 seconds, checks them again and applies them. The page shows when they are live.'))),
      h('li', {}, h('div', {}, h('b', {}, 'Learn the commands'), h('p', {}, 'Browse the command directory for usage, options and who can run each command.'))))));

  const faqItem = (q, a) => h('div', { class: 'panel' }, h('h3', {}, q), h('p', { class: 'muted' }, a));
  const faq = h('section', { id: 'faq' }, h('div', { class: 'section-title' }, h('h2', {}, 'FAQ')),
    h('div', { class: 'grid cols-2' },
      faqItem('Why does my server say "REX not added"?', 'REX is only listed as present when the bot itself has reported the server to the dashboard. Add the bot, then wait up to a minute.'),
      faqItem('I saved but nothing changed yet', 'Saves are applied by the bot. If the bot is offline they wait in the queue (for up to 24 hours) and apply when it comes back.'),
      faqItem('Who can change settings?', 'Free settings need Manage Server. Premium security and staff-role settings need Administrator, the same rule the bot uses in Discord.'),
      faqItem('How do I get Premium, Priority or Ultra?', 'See the Premium page. Codes are redeemed in your server with /redeem.')));

  const help = h('div', { class: 'panel', style: 'margin-top:28px;display:flex;gap:16px;align-items:center;justify-content:space-between;flex-wrap:wrap' },
    h('div', {}, h('h3', { style: 'margin:0 0 4px' }, 'Need a hand?'), h('span', { class: 'muted' }, 'Our support server is the quickest way to get help or suggest a feature.')),
    h('a', { class: 'btn discord', href: REX.support, target: '_blank', rel: 'noopener noreferrer' }, 'Join support server'));

  app.replaceChildren(hero, sub, status, features, start, faq, help);

  const s = await api('/api/status').catch(() => null);
  if (s) {
    document.getElementById('a-guilds').textContent = fmtNum(s.guild_count);
    document.getElementById('a-users').textContent = fmtNum(s.user_count);
    document.getElementById('a-cmds').textContent = fmtNum(s.command_count);
    document.getElementById('a-up').textContent = s.online ? fmtDuration(s.uptime_s) : '—';
  }
})();
