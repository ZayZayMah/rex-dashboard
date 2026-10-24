'use strict';
(async function () {
  const app = document.getElementById('app');
  await mountNav('live');
  if (REX.blocked) return;

  const mk = (cls, ...kids) => h('div', { class: cls }, ...kids);
  const num = (id) => h('div', { class: 'big-num', id }, '-');
  const grid = h('div', { class: 'live-grid' },
    mk('c3 plate', h('div', { class: 'muted small' }, 'Status'), h('div', { id: 'l-status' }, h('span', { class: 'pill' }, 'Checking')), h('div', { class: 'muted small', id: 'l-seen', style: 'margin-top:10px' })),
    mk('c3 slab', h('div', { class: 'muted small' }, 'Servers'), num('l-guilds')),
    mk('c3 slab', h('div', { class: 'muted small' }, 'Members'), num('l-users')),
    mk('c3 slab', h('div', { class: 'muted small' }, 'Commands'), num('l-cmds')),
    mk('c6 panel', h('div', { class: 'muted small' }, 'Latency'), num('l-ping'), h('div', { id: 'sp-ping' })),
    mk('c6 panel', h('div', { class: 'muted small' }, 'Servers over time'), h('div', { class: 'big-num', id: 'l-guilds2' }, '-'), h('div', { id: 'sp-guilds' })),
    mk('c4 frame', h('h3', {}, 'Uptime'), num('l-up'), h('p', { class: 'muted small', style: 'margin-top:8px' }, 'Since the bot last started.'), h('div', { class: 'muted small', id: 'l-errs' })),
    mk('c4 well', h('h3', {}, 'Servers by tier'), h('div', { class: 'bars', id: 'l-tiers' })),
    mk('c4 panel', h('h3', {}, 'Members over time'), h('div', { id: 'sp-users' })),
    mk('c12 panel', h('h3', {}, 'Feature health'), h('div', { class: 'feature-list', id: 'l-features' }, h('span', { class: 'muted' }, 'Waiting for the bot.'))));
  app.replaceChildren(subnav('live'), h('div', { class: 'page-head' }, h('h1', {}, 'Live stats'), h('p', {}, 'Straight from the running bot. This page refreshes on its own.')), grid);
  grid.querySelectorAll('.c12').forEach((n) => { n.style.gridColumn = 'span 12'; });

  const $ = (id) => document.getElementById(id);
  function spark(el, pts, color) {
    const vals = pts.filter((v) => v != null);
    if (vals.length < 2) { el.replaceChildren(h('p', { class: 'muted small' }, 'Collecting data. A point is added every few minutes.')); return; }
    const w = 300, hh = 80, min = Math.min(...vals), max = Math.max(...vals), span = max - min || 1;
    const xy = pts.map((v, i) => [(i / (pts.length - 1)) * w, hh - 6 - ((v == null ? min : v) - min) / span * (hh - 14)]);
    const d = xy.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('');
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + w + ' ' + hh); svg.setAttribute('class', 'spark'); svg.setAttribute('preserveAspectRatio', 'none');
    const gid = 'g' + Math.random().toString(36).slice(2, 7);
    svg.innerHTML = '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + color + '" stop-opacity=".45"/><stop offset="1" stop-color="' + color + '" stop-opacity="0"/></linearGradient></defs>'
      + '<path d="' + d + 'L' + w + ' ' + hh + 'L0 ' + hh + 'Z" fill="url(#' + gid + ')"/><path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="2" stroke-linejoin="round"/>';
    el.replaceChildren(svg);
  }

  async function load() {
    let d;
    try { d = await api('/api/live'); } catch (e) { return; }
    const s = d.stats || {};
    $('l-status').replaceChildren(h('span', { class: 'pill ' + (d.online ? (s.status === 'degraded' ? 'mid' : 'on') : 'off') }, d.online ? (s.status === 'degraded' ? 'Degraded' : 'Online') : 'Offline'));
    $('l-seen').textContent = s.ts ? 'Last report ' + timeAgo(s.ts) : 'No report yet';
    $('l-guilds').textContent = d.online ? fmtNum(s.guild_count) : '-';
    $('l-guilds2').textContent = d.online ? fmtNum(s.guild_count) : '-';
    $('l-users').textContent = d.online ? fmtNum(s.user_count) : '-';
    $('l-cmds').textContent = fmtNum(s.command_count);
    $('l-ping').textContent = d.online && s.latency_ms != null ? s.latency_ms + ' ms' : '-';
    $('l-up').textContent = d.online ? fmtDuration(s.uptime_s) : '-';
    $('l-errs').textContent = s.errors_last_hour != null ? s.errors_last_hour + ' command errors in the last hour' : '';
    const hist = d.hist || [];
    spark($('sp-ping'), hist.map((p) => p[1]), '#62cbff');
    spark($('sp-guilds'), hist.map((p) => p[2]), '#38d79b');
    spark($('sp-users'), hist.map((p) => p[3]), '#b47cff');
    const tc = d.tier_counts || {}, total = Math.max(1, d.synced_guilds || 0);
    const col = { premium: '#f4c04e', priority: '#5da4ff', ultra: '#b47cff' };
    $('l-tiers').replaceChildren(...['premium', 'priority', 'ultra'].map((t) => h('div', { class: 'bar' }, h('span', {}, TIER_LABEL[t]),
      h('div', { class: 'track' }, h('i', { style: 'width:' + Math.round((tc[t] || 0) / total * 100) + '%;background:' + col[t] })), h('b', {}, tc[t] || 0))),
      h('div', { class: 'muted small' }, (total - (tc.premium || 0) - (tc.priority || 0) - (tc.ultra || 0)) + ' on the free tier'));
    const f = Object.entries(s.features || {});
    if (f.length) $('l-features').replaceChildren(...f.map(([name, info]) => h('div', {}, h('span', { class: 'st ' + info.state }), h('b', {}, name), h('small', {}, info.detail || info.state))));
  }
  await load();
  setInterval(load, 30000);
})();
