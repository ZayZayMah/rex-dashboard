'use strict';
(async function () {
  const app = document.getElementById('app');
  const me = await mountNav('profile');
  if (REX.blocked) return;
  if (!me) return app.replaceChildren(stateScreen('Log in first', 'Log in with Discord to see your Rex profile.', h('a', { class: 'btn', href: '/auth/login' }, 'Log in with Discord')));

  let data = null, fast = null, tries = 0;
  const hero = h('div', { class: 'prof-hero' });
  const body = h('div', { class: 'wrap narrow stack', style: 'padding-bottom:60px' });
  app.replaceChildren(hero, body);

  function bar(pct) { return h('div', { class: 'xpbar', role: 'progressbar', 'aria-valuenow': String(Math.round(pct)), 'aria-valuemin': '0', 'aria-valuemax': '100' }, h('i', { style: 'width:' + Math.max(2, Math.min(100, pct)) + '%' })); }

  function draw() {
    const u = data.user, p = data.profile;
    const totalXp = p ? p.servers.reduce((a, s) => a + s.xp, 0) + (p.web_xp || 0) : 0;
    const best = p && p.servers.length ? p.servers[0] : null;
    hero.replaceChildren(h('div', { class: 'wrap narrow center' },
      h('img', { class: 'prof-avatar', src: u.avatar_url, alt: '', width: 128, height: 128 }),
      h('h1', {}, u.name), h('div', { class: 'muted' }, '@' + u.username),
      h('div', { style: 'display:flex;gap:8px;justify-content:center;margin-top:10px;flex-wrap:wrap' },
        p && p.account_premium ? tierBadge('premium') : null, data.is_owner ? h('span', { class: 'badge warn' }, 'Rex owner') : null)));
    body.replaceChildren();
    if (!p) {
      body.append(h('div', { class: 'well center' }, h('span', { class: 'spin' }), h('p', { class: 'muted', style: 'margin:10px 0 0' }, !data.bot_online ? 'Rex looks offline right now. Your stats will appear as soon as it is back.' : tries > 25 ? 'Still fetching. Rex is busy, this can take a minute.' : 'Fetching your stats from Rex...')));
    } else {
      body.append(h('div', { class: 'stat-row' },
        h('div', { class: 'stat' }, h('b', {}, fmtNum(totalXp)), h('span', {}, 'Total XP')),
        h('div', { class: 'stat' }, h('b', {}, fmtNum(p.servers.length)), h('span', {}, 'Servers with Rex')),
        h('div', { class: 'stat' }, h('b', {}, best ? 'Lv ' + best.level : '-'), h('span', {}, best ? 'Best level' : 'No levels yet')),
        h('div', { class: 'stat' }, h('b', {}, fmtNum(p.web_xp || 0)), h('span', {}, 'Website XP'))));
      if (!p.servers.length) body.append(h('div', { class: 'well center' }, h('p', { class: 'muted', style: 'margin:0' }, 'Rex has no XP or coins recorded for you yet. Chat in a server with Rex to get started.')));
      else body.append(h('div', { class: 'ledger' }, p.servers.map((s) => {
        const into = s.xp % s.xp_per_level, pct = (into / s.xp_per_level) * 100;
        return h('div', { class: 'prof-srv' },
          guildIcon({ name: s.name, icon_url: s.icon ? 'https://cdn.discordapp.com/icons/' + s.id + '/' + s.icon + '.png?size=96' : null }),
          h('div', { class: 'grow' },
            h('div', { style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap' }, h('b', {}, s.name), s.tier !== 'free' ? tierBadge(s.tier) : null),
            h('div', { class: 'muted small' }, 'Level ' + s.level + '  -  ' + fmtNum(s.xp) + ' XP' + (s.rank ? '  -  Rank ' + s.rank + ' of ' + s.ranked : '')),
            bar(pct),
            s.coins != null ? h('div', { class: 'muted small' }, fmtNum(s.coins) + ' coins' + (s.games ? '  -  ' + s.games + ' games, ' + fmtNum(s.won) + ' won, ' + fmtNum(s.lost) + ' lost' : '')) : null,
            s.roblox ? h('div', { class: 'muted small' }, 'Roblox: ' + s.roblox) : null));
      })));
      if (p.account_premium) body.append(h('div', { class: 'frame' }, h('b', {}, 'Account premium is active'),
        h('div', { class: 'muted small' }, p.account_premium.expires ? 'Until ' + fmtDate(p.account_premium.expires) : 'Never expires')));
    }
    if (data.is_owner) body.append(h('div', { class: 'frame', style: 'text-align:center' },
      h('h3', {}, 'Rex owner tools'), h('p', { class: 'muted small' }, 'Codes, servers, users and website settings.'),
      me.owner_mode ? h('a', { class: 'btn', href: '/owner' }, 'Open owner mode')
        : h('button', { class: 'btn', type: 'button', onclick: async () => { try { await api('/api/owner/mode', { method: 'POST', body: { on: true } }); location.href = '/owner'; } catch (e) { toast(e.message, 'bad'); } } }, 'Enter Owner Mode')));
    body.append(h('div', { class: 'well' }, h('h3', {}, 'Your data'),
      h('p', { class: 'muted small' }, 'Rex keeps your Discord ID, name, avatar, email (if shared), the servers you can manage and your stats so the website can work. You can remove it at any time. Logging in again recreates a fresh record.'),
      h('button', { class: 'btn danger sm', type: 'button', onclick: async () => {
        if (!confirm('Delete your website data and log out? Your XP in Discord servers is not affected.')) return;
        try { await api('/api/me/delete', { method: 'POST', body: {} }); location.href = '/'; } catch (e) { toast(e.message, 'bad'); }
      } }, 'Delete my website data')));
  }

  async function load() {
    try { data = await api('/api/profile'); } catch (e) { return toast(e.message, 'bad'); }
    draw();
    if (!data.profile && !fast) fast = setInterval(async () => { tries++; await load(); }, tries > 25 ? 5000 : 1500);
    else if (data.profile && fast) { clearInterval(fast); fast = null; }
  }
  await load();
  setInterval(() => { if (!document.hidden) load(); }, 30000);
})();
