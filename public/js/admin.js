'use strict';
(async function () {
  const app = document.getElementById('app');
  const me = await mountNav('admin');

  function fail(title, text) {
    app.replaceChildren(h('div', { class: 'panel empty' }, h('span', { class: 'mark', 'aria-hidden': 'true' }),
      h('h2', {}, title), h('p', { class: 'muted' }, text),
      me ? h('a', { class: 'btn ghost', href: '/dashboard' }, 'Back') : h('a', { class: 'btn', href: '/auth/login' }, 'Login with Discord')));
  }
  if (!me) return fail('Sign in first', 'This page is for the bot owner.');
  if (!me.is_owner) return fail('Owner only', 'Set OWNER_ID in Cloudflare to your Discord user ID to unlock this page.');

  const stat = (label, value) => h('div', { class: 'stat' }, h('b', {}, value), h('span', {}, label));
  const pillFor = (state) => {
    const cls = { ok: 'ok', degraded: 'warn', down: 'bad' }[state] || '';
    const text = { ok: 'Working', degraded: 'Degraded', down: 'Down' }[state] || 'Unknown';
    return h('span', { class: 'pill ' + cls }, text);
  };

  async function draw() {
    let d;
    try { d = await api('/api/admin/health'); } catch (e) { return fail('Could not load', e.message); }
    const s = d.stats || {};
    const features = Object.entries(s.features || {});

    const online = h('span', { class: 'pill ' + (d.online ? 'ok' : 'bad') }, d.online ? 'Bot online' : 'Bot offline');
    const rows = features.length
      ? h('table', { class: 'tbl' }, h('thead', {}, h('tr', {}, h('th', {}, 'Feature'), h('th', {}, 'State'), h('th', {}, 'Detail'))),
        h('tbody', {}, features.map(([name, f]) => h('tr', {}, h('td', {}, name), h('td', {}, pillFor(f.state)), h('td', { class: 'muted' }, f.detail || '—')))))
      : h('p', { class: 'muted' }, 'The bot has not reported any feature checks yet. See bot/rex_dashboard.py (rex_health).');

    const cfg = d.config;
    const cfgRow = (label, ok) => h('tr', {}, h('td', {}, label), h('td', {}, h('span', { class: 'pill ' + (ok ? 'ok' : 'bad') }, ok ? 'Set' : 'Missing')));

    app.replaceChildren(
      h('div', { class: 'page-head' }, h('div', {}, h('div', { class: 'eyebrow' }, 'Owner'), h('h1', {}, 'Bot health'),
        h('div', { class: 'meta' }, online, h('span', { class: 'muted small' }, 'Last heartbeat ' + timeAgo(s.ts))))),
      h('div', { class: 'statbar' },
        stat('Servers', fmtNum(s.guild_count)), stat('Members', fmtNum(s.user_count)),
        stat('Latency', s.latency_ms == null ? '—' : s.latency_ms + ' ms'), stat('Uptime', fmtDuration(s.uptime_s)),
        stat('Commands', fmtNum(s.command_count)), stat('Errors (1h)', fmtNum(s.errors_last_hour)),
        stat('Synced servers', fmtNum(d.synced_guilds)), stat('Premium+ servers', fmtNum((d.tier_counts.premium||0)+(d.tier_counts.priority||0)+(d.tier_counts.ultra||0)))),
      h('div', { class: 'section-title' }, h('h2', {}, 'Feature checks')),
      h('div', { class: 'panel' }, rows,
        h('p', { class: 'muted small' }, 'Last check: ' + (s.last_health_check ? timeAgo(s.last_health_check) : 'not reported') +
          ' · Next: ' + (s.next_health_check ? new Date(s.next_health_check * 1000).toLocaleTimeString() : 'not reported'))),
      h('div', { class: 'section-title' }, h('h2', {}, 'Dashboard configuration')),
      h('div', { class: 'panel' }, h('table', { class: 'tbl' }, h('tbody', {},
        cfgRow('Discord login (client ID + secret)', cfg.discord_login), cfgRow('Bot API key', cfg.bot_api_key), cfgRow('Owner ID', cfg.owner_id)))));
  }

  await draw();
  setInterval(draw, 30000);
})();
