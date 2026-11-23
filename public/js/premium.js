'use strict';
(async function () {
  const app = document.getElementById('app');
  const me = await mountNav('premium');
  if (REX.blocked) return;

  /* Facts come from the bot's own tier rules: Priority and Ultra both include Premium; Ultra does not include Priority. No prices are listed on purpose. */
  const TIERS = [
    { id: 'free', name: 'Free', sub: 'Everything you need to run a friendly server.', items: [
      'Welcome and leave messages, auto role', 'Mod log and member reports', 'Tickets with a panel and welcome message',
      'Levels, XP and level cards', 'Economy and games', 'Counting, suggestions, polls, giveaways', 'Verification and Roblox verification'] },
    { id: 'premium', name: 'Premium', sub: 'Style and automation for growing servers.', items: [
      'Welcome and leave embeds', 'Multiple ticket types on one panel', 'Ticket transcripts as a web link (kept 30 days)',
      'Anti-spam, anti-link and AutoMod', 'Anti-swear, anti-alt, anti-ping and honeypot', 'Custom slash commands', 'Mass timeout'] },
    { id: 'priority', name: 'Priority', sub: 'Premium, plus stricter raid handling.', inc: ['Everything in Premium'], items: [
      'Raid join threshold and new-account rules', 'Spam response mode', 'Ban-appeal instructions', 'Priority tools in Discord'] },
    { id: 'ultra', name: 'Ultra', sub: 'The full security suite and your own branding.', inc: ['Everything in Premium'], items: [
      'Welcome and leave images', 'Transcripts kept until you delete them', 'Join-burst and new-account risk alerts',
      'Mention-flood, invite and repeat detection', 'Automatic delete and timeout', 'Message edit and delete logs', 'Custom bot nickname, status and image'] },
  ];
  const surface = { free: 'well', premium: 'slab', priority: 'plate', ultra: 'frame' };
  const cards = TIERS.map((t) => h('article', { class: 'tier ' + surface[t.id] + ' t-' + t.id, id: t.id },
    h('h3', {}, t.name, ' ', t.id !== 'free' ? tierBadge(t.id) : null), h('p', { class: 'muted small', style: 'margin:0' }, t.sub),
    h('ul', {}, (t.inc || []).map((x) => h('li', { class: 'inc' }, x)), t.items.map((x) => h('li', {}, x)))));

  const yes = (v) => h('td', { class: v ? 'y' : 'n' }, v ? 'Yes' : '-');
  const MATRIX = [
    ['Welcome, tickets, levels, games', 1, 1, 1, 1], ['Welcome and leave embeds', 0, 1, 1, 1], ['Multiple ticket types', 0, 1, 1, 1], ['Ticket transcripts on the web', 0, 1, 1, 1],
    ['Welcome and leave images', 0, 0, 0, 1], ['Anti-spam, anti-link, AutoMod', 0, 1, 1, 1], ['Custom slash commands', 0, 1, 1, 1], ['Raid thresholds and spam mode', 0, 0, 1, 0],
    ['Join-burst and new-account alerts', 0, 0, 0, 1], ['Message edit/delete logs', 0, 0, 0, 1], ['Custom bot nickname and status', 0, 0, 0, 1],
  ];
  const matrix = h('div', { class: 'panel' }, h('table', { class: 'tbl' },
    h('thead', {}, h('tr', {}, h('th', {}, 'Feature'), h('th', {}, 'Free'), h('th', {}, 'Premium'), h('th', {}, 'Priority'), h('th', {}, 'Ultra'))),
    h('tbody', {}, MATRIX.map((r) => h('tr', {}, h('td', {}, r[0]), yes(r[1]), yes(r[2]), yes(r[3]), yes(r[4]))))));

  const redeem = h('section', { class: 'redeem-card frame', id: 'redeem' }, h('h2', {}, 'Redeem a code'));
  if (!me) {
    redeem.append(h('p', { class: 'muted' }, 'Log in with Discord to redeem a code for a server you manage.'), h('a', { class: 'btn', href: '/auth/login' }, 'Log in'));
  } else if (!me.guilds.some((g) => g.bot_present && (g.admin || g.owner || g.via === 'owner'))) {
    redeem.append(h('p', { class: 'muted' }, 'You need Administrator in a server that has Rex to redeem a code.'));
  } else {
    redeem.append(h('p', { class: 'muted' }, 'Codes unlock a tier for one server. You need Administrator there.'),
      redeemWidget(me.guilds, new URLSearchParams(location.search).get('server')));
  }

  app.replaceChildren(
    subnav('premium'),
    h('div', { class: 'page-head' }, h('h1', {}, 'Premium'), h('p', {}, 'Start free. Add Premium for style and automation, Priority for stricter raid rules, or Ultra for the full protection suite.')),
    h('div', { class: 'tier-row' }, cards),
    h('div', { class: 'section-title mid' }, h('h2', {}, 'Compare tiers')), matrix,
    h('div', { class: 'section-title mid' }, h('h2', {}, 'Get a tier')),
    h('div', { class: 'narrow stack' },
      h('div', { class: 'ledger' },
        h('div', {}, h('b', { style: 'min-width:150px' }, 'Get a code'), h('span', { class: 'muted' }, 'Codes come from the Rex team. Ask in the support server. Members of the official server can claim a one-time 7-day Premium trial.')),
        h('div', {}, h('b', { style: 'min-width:150px' }, 'Redeem it'), h('span', { class: 'muted' }, 'Use the form below, or run /redeem in your server. Each code upgrades one server.')),
        h('div', {}, h('b', { style: 'min-width:150px' }, 'Configure'), h('span', { class: 'muted' }, 'Locked settings in the dashboard unlock as soon as Rex reports the tier as active.'))),
      redeem));
})();
