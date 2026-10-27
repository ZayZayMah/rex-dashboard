'use strict';
/* Theme layouts. Halloween and Christmas are not recolours: they rebuild the navigation and the home page with
   different structure, and the stylesheets re-arrange the dashboard and server pages. Normal has no entry here. */
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = (s) => new DOMParser().parseFromString(s, 'image/svg+xml').documentElement;
  const NAV_ITEMS = [['/about', 'About', 'about'], ['/commands', 'Commands', 'commands'], ['/premium', 'Premium', 'premium'], ['/live', 'Live stats', 'live'], ['/dashboard', 'Dashboard', 'dashboard']];
  const link = (it, active) => h('a', { href: it[0], class: active === it[2] ? 'active' : '' }, it[1]);

  const nav = {
    /* Haunted manor: a centred masthead. Crest in the middle, links split either side, account tucked in a thin top strip. */
    halloween(host, ctx) {
      host.replaceChildren(
        h('div', { class: 'hw-strip' }, h('div', { class: 'wrap' }, h('span', { class: 'hw-motto' }, 'Est. in the dark'), ctx.end)),
        h('div', { class: 'wrap hw-mast' },
          h('div', { class: 'hw-flank l' }, [['/', 'Home', 'home'], ...NAV_ITEMS.slice(0, 2)].map((i) => link(i, ctx.active))),
          h('a', { href: '/', class: 'hw-crest', 'aria-label': 'Rex home' }, h('span', { class: 'mark', 'aria-hidden': 'true' }), h('span', { class: 'w' }, 'REX')),
          h('div', { class: 'hw-flank r' }, NAV_ITEMS.slice(2).map((i) => link(i, ctx.active)))));
    },
    /* Winter lodge: a floating glass dock with the brand, a pill of links and the account on one rounded bar. */
    christmas(host, ctx) {
      host.replaceChildren(h('div', { class: 'wrap' }, h('div', { class: 'xm-dock' },
        h('a', { href: '/', class: 'brand', 'aria-label': 'Rex home' }, h('span', { class: 'mark', 'aria-hidden': 'true' }), h('span', { class: 'w' }, 'REX')),
        h('nav', { class: 'xm-pills', 'aria-label': 'Main' }, NAV_ITEMS.map((i) => link(i, ctx.active))),
        ctx.end)));
    },
  };

  const ROMAN = ['I', 'II', 'III', 'IV'];
  const FEATURES = [
    ['Moderation', 'Bans, timeouts, warnings and cases with a full history, plus lockdowns and clean-up tools.'],
    ['Tickets', 'Private support channels, several ticket types on one panel, and transcripts you can share as a link.'],
    ['Levels', 'XP for chatting and talking in voice, level cards, leaderboards and a small economy with games.'],
    ['Security', 'Raid alerts, spam and link control, verification and join checks that run on their own.'],
  ];
  const stat = (id, label, cls) => h('div', { class: cls }, h('b', { id }, '-'), h('span', {}, label));
  const cta = (ctx, cls) => h('div', { class: cls },
    h('a', { class: 'btn lg', href: ctx.inviteUrl, target: ctx.inviteUrl.startsWith('http') ? '_blank' : null, rel: 'noopener noreferrer' }, 'Add Rex to your server'),
    h('a', { class: 'btn ghost lg', href: '/dashboard' }, 'Open the dashboard'),
    h('a', { class: 'btn ghost lg', href: '/about' }, 'Learn more'));

  const home = {
    halloween(ctx) {
      return [
        h('section', { class: 'hw-hero' },
          h('div', { id: 'art', class: 'hw-moonbed' }),
          h('div', { class: 'hw-title' }, h('span', { class: 'hw-rule' }), h('h1', {}, 'REX'), h('span', { class: 'hw-rule' })),
          h('p', { class: 'hw-tag' }, 'Smart, helpful, always here'),
          h('p', { class: 'hw-lead' }, 'Moderation, tickets, levels, games and security in one Discord bot. Sign in, choose your server and change what you need.'),
          cta(ctx, 'hw-cta'), ctx.pill),
        h('section', { class: 'hw-stones', 'aria-label': 'Live status' },
          stat('s-guilds', 'Servers', 'stone s1'), stat('s-users', 'Members', 'stone s2'), stat('s-ping', 'Latency', 'stone s3'), stat('s-up', 'Uptime', 'stone s4')),
        h('section', { class: 'hw-ledger' }, h('h2', {}, 'The ledger of duties'),
          h('ol', {}, FEATURES.map(([n, t], i) => h('li', { class: i % 2 ? 'r' : 'l' }, h('span', { class: 'num' }, ROMAN[i]), h('div', {}, h('h3', {}, n), h('p', {}, t)))))),
        h('section', { class: 'hw-seance' }, h('h2', {}, 'Change anything from your browser'),
          h('p', {}, 'You only see servers you can manage. Every change is checked by the bot, written to the activity log, and the server owner can undo it.'),
          h('div', { class: 'hw-cta' }, h('a', { class: 'btn', href: ctx.inviteUrl, target: ctx.inviteUrl.startsWith('http') ? '_blank' : null, rel: 'noopener noreferrer' }, 'Add Rex'), h('a', { class: 'btn ghost', href: '/commands' }, 'Browse commands'))),
      ];
    },
    christmas(ctx) {
      return [
        h('section', { class: 'xm-hero' },
          h('div', { class: 'xm-copy' }, h('span', { class: 'xm-eyebrow' }, 'Season\'s greetings'), h('h1', {}, 'REX'),
            h('p', { class: 'xm-tag' }, 'Smart. Helpful. Always here.'),
            h('p', { class: 'xm-lead' }, 'Moderation, tickets, levels, games and security in one Discord bot. Sign in, choose your server and change what you need.'),
            cta(ctx, 'xm-cta'), ctx.pill),
          h('div', { class: 'xm-scene' }, h('div', { class: 'xm-emblem' }, h('span', { class: 'mark', 'aria-hidden': 'true' })))),
        h('section', { class: 'xm-stats', 'aria-label': 'Live status' },
          stat('s-guilds', 'Servers', 'xm-stat'), stat('s-users', 'Members', 'xm-stat'), stat('s-ping', 'Latency', 'xm-stat'), stat('s-up', 'Uptime', 'xm-stat')),
        h('section', { class: 'xm-gifts' }, h('h2', {}, 'Everything your server needs'),
          h('div', { class: 'xm-grid' }, FEATURES.map(([n, t]) => h('div', { class: 'gift' }, h('h3', {}, n), h('p', {}, t))))),
        h('section', { class: 'xm-cabin' }, h('div', {}, h('h2', {}, 'Change anything from your browser'),
          h('p', {}, 'You only see servers you can manage. The bot checks every change, the activity log shows what changed, and the server owner can undo it.')),
          h('div', { class: 'xm-cta' }, h('a', { class: 'btn', href: ctx.inviteUrl, target: ctx.inviteUrl.startsWith('http') ? '_blank' : null, rel: 'noopener noreferrer' }, 'Add Rex'), h('a', { class: 'btn ghost', href: '/commands' }, 'Browse commands'))),
      ];
    },
  };
  window.rexLayout = { nav, home, items: NAV_ITEMS };
})();
