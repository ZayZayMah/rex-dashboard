'use strict';
(async function () {
  const me = await mountNav('dashboard');
  const content = document.getElementById('content');
  const notice = document.getElementById('notice');

  const login = new URLSearchParams(location.search).get('login');
  if (login === 'failed' || login === 'denied') {
    notice.append(h('div', { class: 'alert', role: 'alert' }, login === 'denied' ? 'Login was cancelled.' : 'Discord login failed. Please try again.'));
  }

  if (!me) {
    content.className = '';
    content.replaceChildren(h('div', { class: 'panel empty' }, h('span', { class: 'mark', 'aria-hidden': 'true' }), h('h2', {}, 'Sign in to manage REX'),
      h('p', { class: 'muted' }, 'Log in with Discord to see the servers you can manage.'), h('a', { class: 'btn', href: '/auth/login' }, 'Login with Discord')));
    return;
  }
  if (!me.guilds.length) {
    content.className = '';
    content.replaceChildren(h('div', { class: 'panel empty' }, h('span', { class: 'mark', 'aria-hidden': 'true' }), h('h2', {}, 'No servers found'),
      h('p', { class: 'muted' }, 'You need the Manage Server permission (or to own the server) for it to show up here.'), h('a', { class: 'btn ghost', href: '/auth/login' }, 'Refresh from Discord')));
    return;
  }

  content.replaceChildren(...me.guilds.map((g) => {
    const badges = h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap' });
    if (g.bot_present) badges.append(tierBadge(g.tier));
    if (g.owner) badges.append(h('span', { class: 'badge' }, 'Owner'));
    if (g.via === 'owner') badges.append(h('span', { class: 'badge bad' }, 'Bot owner access'));
    const action = g.bot_present
      ? h('a', { class: 'btn sm', href: '/server?id=' + encodeURIComponent(g.id) }, 'Manage')
      : (g.invite_url ? h('a', { class: 'btn ghost sm', href: g.invite_url }, 'Add REX') : h('span', { class: 'muted small' }, 'REX not added'));
    return h('article', { class: 'panel server' + (g.bot_present ? '' : ' dim') },
      h('div', { class: 'server-head' }, guildIcon(g), h('div', {}, h('h3', {}, g.name), h('span', { class: 'muted small' }, g.bot_present ? 'REX is here' : 'REX not in this server'))),
      h('div', { class: 'row' }, badges, action));
  }));
})();
