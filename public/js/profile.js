'use strict';
(async function () {
  const app = document.getElementById('app');
  const me = await mountNav('profile');
  if (!me) {
    app.replaceChildren(h('div', { class: 'panel empty' }, h('span', { class: 'mark', 'aria-hidden': 'true' }), h('h2', {}, 'Sign in to see your profile'),
      h('p', { class: 'muted' }, 'Log in with Discord to see your REX levels, economy and servers.'), h('a', { class: 'btn', href: '/auth/login' }, 'Login with Discord')));
    return;
  }
  let data;
  try { data = await api('/api/profile'); } catch (e) {
    app.replaceChildren(h('div', { class: 'panel empty' }, h('h2', {}, 'Could not load'), h('p', { class: 'muted' }, e.message))); return;
  }
  const u = data.user, p = data.profile;
  const fmtDate = (ts) => (ts ? new Date(ts * 1000).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'never');

  const head = h('div', { class: 'panel profile-head' },
    h('img', { class: 'avatar-lg', src: u.avatar_url, alt: '', width: 96, height: 96 }),
    h('div', {}, h('div', { class: 'eyebrow' }, 'Profile'), h('h1', { style: 'margin:4px 0' }, u.name), h('div', { class: 'muted' }, '@' + u.username),
      h('div', { class: 'meta', style: 'margin-top:8px;display:flex;gap:8px;flex-wrap:wrap' },
        data.is_owner ? h('span', { class: 'badge bad' }, 'Bot owner') : null,
        p && p.account_premium && p.account_premium.active ? h('span', { class: 'badge tier-premium' }, 'Account Premium') : null,
        h('span', { class: 'badge' }, data.servers_managed + ' servers managed'))));

  if (!p) {
    app.replaceChildren(head, h('div', { class: 'panel', style: 'margin-top:18px' }, h('h2', {}, 'Your REX stats are on their way'),
      h('p', { class: 'muted' }, 'REX sends your levels and economy to the website shortly after you log in (usually under two minutes). Refresh this page in a moment.'),
      h('button', { class: 'btn ghost sm', type: 'button', onclick: () => location.reload() }, 'Refresh')));
    return;
  }

  const acct = p.account_premium;
  const premiumPanel = h('section', { class: 'panel' }, h('h2', {}, 'Account Premium'),
    acct && acct.active
      ? [h('p', {}, 'Active. It applies to every server you manage.'), h('p', { class: 'muted' }, 'Expires ' + fmtDate(acct.expires)), h('p', { class: 'muted small' }, 'Source: ' + (acct.source || 'unknown').replace(/_/g, ' '))]
      : [h('p', { class: 'muted' }, 'You do not have Account Premium.'), h('a', { class: 'btn ghost sm', href: '/premium' }, 'See tiers')],
    h('p', { class: 'muted small' }, p.free_trial_claimed ? 'You have already used the one-time free Premium trial.' : 'The one-time 7-day trial is available with /free-premium in the official server.'));

  const totalCoins = p.servers.reduce((n, s) => n + (s.coins || 0), 0);
  const best = p.servers.reduce((b, s) => (s.level > (b ? b.level : -1) ? s : b), null);
  const summary = h('section', { class: 'panel' }, h('h2', {}, 'At a glance'),
    h('div', { class: 'chipline' }, h('span', {}, 'Servers with stats ', h('b', {}, fmtNum(p.servers.length))), h('span', {}, 'Coins ', h('b', {}, fmtNum(totalCoins))),
      best ? h('span', {}, 'Highest level ', h('b', {}, best.level + ' in ' + best.name)) : null),
    h('p', { class: 'muted small' }, 'Updated ' + timeAgo(p.updated)));

  const rows = p.servers.length
    ? p.servers.map((s) => {
      const into = s.xp_per_level ? Math.min(100, Math.round(((s.xp % s.xp_per_level) / s.xp_per_level) * 100)) : 0;
      return h('div', { class: 'srv-row' }, guildIcon({ name: s.name, icon_url: s.icon_url }),
        h('div', {}, h('h3', {}, s.name, tierBadge(s.tier), s.roblox ? h('span', { class: 'badge' }, 'Roblox: ' + s.roblox) : null),
          h('div', { class: 'bar', role: 'progressbar', 'aria-valuenow': into, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-label': 'Progress to next level' }, h('i', { style: 'width:' + into + '%' })),
          h('div', { class: 'chipline' }, h('span', {}, 'Level ', h('b', {}, s.level)), h('span', {}, 'XP ', h('b', {}, fmtNum(s.xp))),
            s.rank ? h('span', {}, 'Rank ', h('b', {}, '#' + s.rank + (s.ranked ? ' of ' + s.ranked : ''))) : null,
            s.coins != null ? h('span', {}, 'Coins ', h('b', {}, fmtNum(s.coins))) : null,
            s.games ? h('span', {}, 'Games ', h('b', {}, s.games), ' (', s.won || 0, 'W / ', s.lost || 0, 'L)') : null)));
    })
    : [h('p', { class: 'muted' }, 'No level or economy activity recorded yet. Chat in a server with REX to start earning XP.')];

  const managed = h('section', { class: 'panel' }, h('h2', {}, 'Servers you manage'),
    me.guilds.length ? me.guilds.map((g) => h('div', { class: 'srv-row' }, guildIcon(g),
      h('div', {}, h('h3', {}, g.name, g.bot_present ? tierBadge(g.tier) : null),
        g.bot_present ? h('a', { class: 'small', href: '/server?id=' + encodeURIComponent(g.id) }, 'Open settings')
          : (g.invite_url ? h('a', { class: 'small', href: g.invite_url }, 'Add REX') : h('span', { class: 'muted small' }, 'REX not added')))))
      : h('p', { class: 'muted' }, 'You do not manage any servers yet.'));

  app.replaceChildren(head,
    h('div', { class: 'profile-grid' }, summary, premiumPanel),
    h('div', { class: 'section-title' }, h('h2', {}, 'Levels & economy')), h('div', { class: 'panel' }, rows),
    h('div', { class: 'section-title' }, h('h2', {}, 'Your servers')), managed);
})();
