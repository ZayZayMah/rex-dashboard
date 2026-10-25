'use strict';
/* Theme layouts. Halloween and Christmas are not recolours: they rebuild the navigation and the home page with
   different structure, and the stylesheets re-arrange the dashboard and server pages. Normal has no entry here. */
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = (s) => new DOMParser().parseFromString(s, 'image/svg+xml').documentElement;
  const NAV_ITEMS = [['/about', 'About', 'about'], ['/commands', 'Commands', 'commands'], ['/premium', 'Premium', 'premium'], ['/live', 'Live stats', 'live'], ['/dashboard', 'Dashboard', 'dashboard']];
  const link = (it, active) => h('a', { href: it[0], class: active === it[2] || (active === 'home' && false) ? 'active' : '' }, it[1]);

  const nav = {
    /* Haunted manor: a centred masthead. Crest in the middle, links split either side, account tucked in a thin top strip. */
    halloween(host, ctx) {
      host.replaceChildren(
        h('div', { class: 'hw-strip' }, h('div', { class: 'wrap' }, h('span', { class: 'hw-motto' }, 'Est. in the dark'), ctx.end)),
        h('div', { class: 'wrap hw-mast' },
          h('div', { class: 'hw-flank l' }, NAV_ITEMS.slice(0, 2).map((i) => link(i, ctx.active))),
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

  /* A procedurally drawn wreath: three overlapping rings of leaves, berries and a satin bow around the Rex mark. */
  function wreath() {
    let seed = 7;
    const rnd = () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const C = 220, parts = [];
    const ring = (r, n, len, wid, hue) => {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * 360 + rnd() * 6, rr = r + (rnd() - .5) * 12, l = len * (0.85 + rnd() * .3);
        const L = 36 + rnd() * 16, sat = 42 + rnd() * 18, col = `hsl(${hue + rnd() * 14},${sat}%,${L}%)`, vein = `hsl(${hue + 6},${sat}%,${L + 16}%)`;
        parts.push(`<g transform="translate(${C} ${C}) rotate(${a.toFixed(1)}) translate(${rr.toFixed(1)} 0) rotate(${(70 + rnd() * 40).toFixed(0)})"><path d="M0 0C${l * .2} ${-wid} ${l * .7} ${-wid * .9} ${l} 0C${l * .7} ${wid * .9} ${l * .2} ${wid} 0 0Z" fill="${col}"/><path d="M2 0L${l * .9} 0" stroke="${vein}" stroke-width="1.2" opacity=".7"/></g>`);
      }
    };
    ring(150, 34, 70, 13, 140); ring(134, 30, 64, 12, 150); ring(142, 28, 58, 11, 135);
    // berries
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * 6.283 + rnd() * .3, r = 138 + (rnd() - .5) * 16, x = C + Math.cos(a) * r, y = C + Math.sin(a) * r;
      for (let b = 0; b < 3; b++) { const bx = x + (rnd() - .5) * 18, by = y + (rnd() - .5) * 18; parts.push(`<circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="${(5 + rnd() * 2).toFixed(1)}" fill="url(#xb)"/><circle cx="${(bx - 1.8).toFixed(1)}" cy="${(by - 2).toFixed(1)}" r="1.6" fill="#fff" opacity=".7"/>`); }
    }
    // satin bow bottom-right
    const bow = `<g transform="translate(${C + 108} ${C + 118}) rotate(-28)"><path d="M0 0C-34 -34 -74 -26 -70 2C-66 26 -30 20 0 0Z" fill="url(#xr)"/><path d="M0 0C34 -34 74 -26 70 2C66 26 30 20 0 0Z" fill="url(#xr)"/>
      <path d="M-2 4C-18 30 -34 52 -52 74L-30 70L-22 88C-8 62 0 36 4 8Z" fill="url(#xr2)"/><path d="M2 4C18 30 34 52 52 74L30 70L22 88C8 62 0 36 -4 8Z" fill="url(#xr2)"/>
      <path d="M-60 -2C-48 -10 -30 -8 -12 0M60 -2C48 -10 30 -8 12 0" stroke="#7a0d1d" stroke-width="1.4" fill="none" opacity=".5"/><rect x="-11" y="-11" width="22" height="22" rx="7" fill="#b81f2f"/><rect x="-11" y="-11" width="22" height="9" rx="5" fill="#ff7a8a" opacity=".45"/></g>`;
    return svg(`<svg xmlns="${NS}" viewBox="0 0 440 440" class="xm-wreath-svg" role="img" aria-label="Christmas wreath"><defs>
      <radialGradient id="xb" cx=".35" cy=".3"><stop offset="0" stop-color="#ff8a96"/><stop offset=".6" stop-color="#d12a3e"/><stop offset="1" stop-color="#7f1020"/></radialGradient>
      <linearGradient id="xr" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#ef4b5e"/><stop offset="1" stop-color="#a3182a"/></linearGradient>
      <linearGradient id="xr2" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#c8263b"/><stop offset="1" stop-color="#8e1325"/></linearGradient>
      <filter id="xs" x="-10%" y="-10%" width="120%" height="125%"><feDropShadow dx="0" dy="10" stdDeviation="9" flood-color="#14573b" flood-opacity=".35"/></filter></defs>
      <g filter="url(#xs)">${parts.join('')}${bow}</g></svg>`);
  }

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
          h('div', { class: 'xm-copy' }, h('span', { class: 'xm-ribbon' }, 'Season of giving'), h('h1', {}, 'REX'),
            h('p', { class: 'xm-tag' }, 'Smart. Helpful. Always here.'),
            h('p', { class: 'xm-lead' }, 'Moderation, tickets, levels, games and security in one Discord bot. Sign in, choose your server and change what you need.'),
            cta(ctx, 'xm-cta'), ctx.pill),
          h('div', { class: 'xm-scene' }, h('div', { class: 'xm-wreath' }, wreath(), h('span', { class: 'mark', 'aria-hidden': 'true' })))),
        h('section', { class: 'xm-baubles', 'aria-label': 'Live status' },
          stat('s-guilds', 'Servers', 'bauble b1'), stat('s-users', 'Members', 'bauble b2'), stat('s-ping', 'Latency', 'bauble b3'), stat('s-up', 'Uptime', 'bauble b4')),
        h('section', { class: 'xm-gifts' }, h('h2', {}, 'Wrapped up and ready'),
          h('div', { class: 'xm-grid' }, FEATURES.map(([n, t], i) => h('div', { class: 'gift g' + i }, h('h3', {}, n), h('p', {}, t))))),
        h('section', { class: 'xm-cabin' }, h('div', {}, h('h2', {}, 'Change anything from your browser'),
          h('p', {}, 'You only see servers you can manage. The bot checks every change, the activity log shows what changed, and the server owner can undo it.')),
          h('div', { class: 'xm-cta' }, h('a', { class: 'btn', href: ctx.inviteUrl, target: ctx.inviteUrl.startsWith('http') ? '_blank' : null, rel: 'noopener noreferrer' }, 'Add Rex'), h('a', { class: 'btn ghost', href: '/commands' }, 'Browse commands'))),
      ];
    },
  };
  window.rexLayout = { nav, home, items: NAV_ITEMS };
})();
