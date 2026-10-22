'use strict';
(async function () {
  const app = document.getElementById('app');
  const me = await mountNav('premium');

  /* Facts here come from the bot's own tier rules: Priority and Ultra both include Premium; Ultra does not include Priority. No prices are listed on purpose. */
  const TIERS = [
    { id: 'free', name: 'Free', sub: 'Everything you need to run a friendly server.', items: [
      'Welcome and leave messages, auto role', 'Mod log and member reports', 'Tickets with panels and welcome message',
      'Levels, XP and level cards', 'Economy and games', 'Counting channel, suggestions, polls, giveaways', 'Verification and Roblox verification'] },
    { id: 'premium', name: 'Premium', sub: 'Security and automation for growing servers.', items: [
      'Anti-spam and anti-link controls', 'AutoMod with your own blocked words', 'Anti-swear, anti-alt, anti-ping and honeypot channel',
      'Counting protection', 'Custom slash commands and Premium tools', 'Staff role mapping and analytics channel', 'Mass timeout'] },
    { id: 'priority', name: 'Priority', sub: 'Premium, plus priority handling.', inc: ['Everything in Premium'], items: [
      'Raid join threshold and new-account age rules', 'Spam response mode', 'Ban-appeal instructions', 'Priority tools in Discord'] },
    { id: 'ultra', name: 'Ultra', sub: 'The full security suite and your own branding.', inc: ['Everything in Premium'], items: [
      'Join-burst (raid) alerts with tunable thresholds', 'New-account risk alerts', 'Mention-flood, invite-link and repeated-message detection',
      'Optional auto-delete and auto-timeout', 'Channel and role deletion alerts', 'Message edit and delete logs', 'Custom Rex nickname, status and image'] },
  ];

  const cards = TIERS.map((t) => h('article', { class: 'panel tier-card t-' + t.id, id: t.id },
    h('h3', {}, t.name, t.id !== 'free' ? tierBadge(t.id) : null), h('p', { class: 'sub' }, t.sub),
    h('ul', {}, (t.inc || []).map((x) => h('li', { class: 'inc' }, x)), t.items.map((x) => h('li', {}, x)))));

  const yes = (v) => h('td', { class: v ? 'y' : 'n' }, v ? '✓' : '—');
  const MATRIX = [
    ['Welcome, tickets, levels, games', 1, 1, 1, 1], ['Anti-spam, anti-link, AutoMod', 0, 1, 1, 1], ['Anti-alt, honeypot, anti-ping', 0, 1, 1, 1],
    ['Custom slash commands', 0, 1, 1, 1], ['Raid thresholds and spam mode', 0, 0, 1, 0], ['Join-burst and new-account alerts', 0, 0, 0, 1],
    ['Auto-delete / timeout on floods', 0, 0, 0, 1], ['Message edit/delete logs', 0, 0, 0, 1], ['Custom bot nickname & status', 0, 0, 0, 1],
  ];
  const matrix = h('div', { class: 'panel matrix' }, h('table', { class: 'tbl' },
    h('thead', {}, h('tr', {}, h('th', {}, 'Feature'), h('th', {}, 'Free'), h('th', {}, 'Premium'), h('th', {}, 'Priority'), h('th', {}, 'Ultra'))),
    h('tbody', {}, MATRIX.map((r) => h('tr', {}, h('td', {}, r[0]), yes(r[1]), yes(r[2]), yes(r[3]), yes(r[4]))))));

  const mine = h('div', { id: 'mine' });
  if (me) {
    const bot = me.guilds.filter((g) => g.bot_present);
    if (bot.length) mine.append(h('div', { class: 'section-title' }, h('h2', {}, 'Your servers')),
      h('div', { class: 'panel' }, bot.map((g) => h('div', { class: 'srv-row' }, guildIcon(g),
        h('div', {}, h('h3', {}, g.name, tierBadge(g.tier)), h('a', { class: 'small', href: '/server?id=' + encodeURIComponent(g.id) }, 'Open settings'))))));
  }

  app.replaceChildren(
    h('div', { class: 'page-head' }, h('div', {}, h('div', { class: 'eyebrow' }, 'Tiers'), h('h1', {}, 'Free, Premium, Priority & Ultra'),
      h('p', { class: 'lead' }, 'Start free. Add Premium for security, Priority for stricter raid rules, or Ultra for the complete protection suite.'))),
    h('div', { class: 'tier-grid' }, cards),
    h('div', { class: 'section-title' }, h('h2', {}, 'Compare')), matrix,
    h('div', { class: 'section-title' }, h('h2', {}, 'How to get a tier')),
    h('div', { class: 'panel' }, h('ol', { class: 'steps' },
      h('li', {}, h('div', {}, h('b', {}, 'Get a code'), h('p', {}, 'Codes are issued by the REX team. Ask in the support server. Members of the official server can also claim a one-time 7-day Premium trial with /free-premium.'))),
      h('li', {}, h('div', {}, h('b', {}, 'Redeem it in your server'), h('p', {}, 'Run '), h('code', {}, '/redeem'), h('p', {}, ' inside the server you want to upgrade and paste the code. Codes are per server, and each has its own length and use limit.'))),
      h('li', {}, h('div', {}, h('b', {}, 'Configure it'), h('p', {}, 'Locked settings in the dashboard unlock once REX reports the tier as active. Premium security settings need the Administrator permission.'))))),
    h('p', { class: 'src-note' }, 'REX staff can also receive Account Premium, which applies across servers they manage. Pricing is not listed here; ask in the support server.'),
    mine,
    h('div', { class: 'panel', style: 'margin-top:28px;display:flex;gap:16px;align-items:center;justify-content:space-between;flex-wrap:wrap' },
      h('div', {}, h('h3', { style: 'margin:0 0 4px' }, 'Questions about a tier?'), h('span', { class: 'muted' }, 'Join the support server and ask the team.')),
      h('a', { class: 'btn discord', href: REX.support, target: '_blank', rel: 'noopener noreferrer' }, 'Join support server')));
})();
