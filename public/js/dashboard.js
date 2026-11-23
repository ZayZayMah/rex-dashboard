'use strict';
(async function () {
  const app = document.getElementById('app');
  const me = await mountNav('dashboard');
  if (REX.blocked) return;
  const login = new URLSearchParams(location.search).get('login');

  if (!me) {
    const msg = login === 'denied' ? 'Discord login was cancelled.' : login === 'failed' ? 'Discord login did not complete. Please try again.' : 'Log in with Discord to see the servers you manage.';
    app.replaceChildren(stateScreen('Log in to continue', msg, h('a', { class: 'btn lg', href: '/auth/login' }, 'Log in with Discord')));
    return;
  }

  const withBot = me.guilds.filter((g) => g.bot_present);
  const without = me.guilds.filter((g) => !g.bot_present);
  const card = (g) => h('a', { class: 'srv-card ' + (g.tier === 'ultra' ? 'frame' : g.tier === 'free' ? 'slab' : 'plate'), href: '/server?id=' + encodeURIComponent(g.id) },
    guildIcon(g), h('div', {}, h('h3', {}, g.name), h('div', {}, tierBadge(g.tier), g.via === 'owner' ? h('span', { class: 'badge warn', style: 'margin-left:6px' }, 'Owner access') : null)));
  const addCard = (g) => h('div', { class: 'srv-card off' }, guildIcon(g), h('div', {}, h('h3', {}, g.name),
    h('a', { class: 'btn sm ghost', href: g.invite_url || '#', target: '_blank', rel: 'noopener noreferrer' }, 'Add Rex')));

  app.replaceChildren(
    h('div', { class: 'page-head' }, h('h1', {}, 'Your servers'), h('p', {}, 'Pick a server to change how Rex works there.')),
    withBot.length ? h('div', { class: 'srv-grid' }, withBot.map(card)) : h('div', { class: 'narrow' }, stateScreen('Rex is not in any of your servers yet', 'Add Rex to a server you manage, wait a moment, then come back.')),
    ...(without.length ? [h('div', { class: 'section-title mid' }, h('h2', {}, 'Add Rex to more servers')), h('div', { class: 'srv-grid' }, without.map(addCard))] : []),
    h('p', { class: 'src-note' }, 'Only servers where you have Manage Server or Administrator are listed.'));
})();
