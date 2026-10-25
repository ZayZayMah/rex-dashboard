'use strict';
(async function () {
  const app = document.getElementById('app');
  await mountNav('home');
  if (REX.blocked) return;
  const inviteUrl = (REX.site && REX.site.invite_url) || '/dashboard';

  const pill = h('span', { class: 'pill' }, 'Checking');
  const stat = (id, label) => h('div', { class: 'stat' }, h('b', { id }, '-'), h('span', {}, label));
  const feature = (name, text) => h('div', {}, h('b', {}, name), h('span', {}, text));

  const themedHome = window.rexLayout && window.rexLayout.home[document.documentElement.getAttribute('data-theme')];
  if (themedHome) app.replaceChildren(...themedHome({ inviteUrl, pill }));
  else app.replaceChildren(
    h('section', { class: 'hero' },
      h('div', {},
        h('h1', {}, 'REX'),
        h('div', { class: 'tagline' }, h('span', {}, 'Smart'), h('i', {}, '/'), h('span', {}, 'Helpful'), h('i', {}, '/'), h('span', {}, 'Always here')),
        h('p', { class: 'lead' }, 'Moderation, tickets, levels, games and security in one Discord bot, with a website where you set it all up. Log in, pick your server, change what you need.'),
        h('div', { class: 'cta' },
          h('a', { class: 'btn lg', href: inviteUrl, target: inviteUrl.startsWith('http') ? '_blank' : null, rel: 'noopener noreferrer' }, 'Add Rex to your server'),
          h('a', { class: 'btn ghost lg', href: '/dashboard' }, 'Open the dashboard'),
          h('a', { class: 'btn ghost lg', href: '/about' }, 'Learn more'))),
      h('div', { class: 'hero-art' }, h('div', { class: 'orbit', id: 'art' }, h('span', { class: 'mark xl', 'aria-hidden': 'true' }), pill))),
    h('div', { class: 'stat-strip', 'aria-label': 'Live status' }, stat('s-guilds', 'Servers'), stat('s-users', 'Members'), stat('s-ping', 'Latency'), stat('s-up', 'Uptime')),
    h('div', { class: 'centered-sections' },
      h('section', {},
        h('h2', {}, 'Everything a server needs, kept simple'),
        h('p', { class: 'lead' }, 'Rex handles the daily work of running a community so your staff can focus on people.'),
        h('div', { class: 'pillars' },
          feature('Moderation', 'Bans, timeouts, warnings and cases with a full history, plus lockdowns and clean-up tools.'),
          feature('Tickets', 'Private support channels, multiple ticket types on one panel, and transcripts you can share as a link.'),
          feature('Levels', 'XP for chatting and talking in voice, level cards, leaderboards and a small economy with games.'),
          feature('Security', 'Raid alerts, spam and link control, verification and join checks that run on their own.'))),
      h('section', {},
        h('h2', {}, 'Change anything from your browser'),
        h('p', { class: 'lead' }, 'Sign in with Discord and you only see servers you can manage. The bot checks your permissions on every change, shows exactly what changed in the activity log, and lets the server owner undo it.')),
      h('section', { class: 'frame closing' },
        h('h2', {}, 'Ready when you are'),
        h('p', { class: 'muted' }, 'Add Rex, then open the dashboard to set up welcome messages, tickets and protection.'),
        h('div', { class: 'cta', style: 'justify-content:center' },
          h('a', { class: 'btn', href: inviteUrl, target: inviteUrl.startsWith('http') ? '_blank' : null, rel: 'noopener noreferrer' }, 'Add Rex'),
          h('a', { class: 'btn ghost', href: '/commands' }, 'Browse commands')))));

  if (window.rexFx) rexFx.start();

  async function status() {
    try {
      const s = await api('/api/status');
      pill.className = 'pill ' + (s.online ? 'on' : 'off');
      pill.textContent = s.online ? 'Online' : 'Offline';
      const set = (id, v) => { document.getElementById(id).textContent = v; };
      set('s-guilds', s.online ? fmtNum(s.guild_count) : '-');
      set('s-users', s.online ? fmtNum(s.user_count) : '-');
      set('s-ping', s.online && s.latency_ms != null ? s.latency_ms + ' ms' : '-');
      set('s-up', s.online ? fmtDuration(s.uptime_s) : '-');
    } catch (e) { pill.textContent = 'Unknown'; }
  }
  status();
  setInterval(status, 30000);
})();
