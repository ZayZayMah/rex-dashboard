'use strict';
/* Shared helpers: safe DOM builder, API client, icons, navigation, site config (theme + maintenance), toasts. */

const REX = { me: null, csrf: null, site: null, support: 'https://discord.gg/rexsupport', blocked: false };

/** Build DOM safely (text is never parsed as HTML). */
/* Make append/prepend/replaceChildren tolerant: arrays are flattened and null/false are skipped. */
(function () {
  ['append', 'prepend', 'replaceChildren'].forEach((m) => {
    const native = Element.prototype[m];
    Element.prototype[m] = function (...nodes) { return native.apply(this, nodes.flat(Infinity).filter((n) => n != null && n !== false)); };
  });
})();

function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

async function api(path, opts = {}) {
  const init = { method: opts.method || 'GET', headers: {}, credentials: 'same-origin' };
  if (opts.body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(opts.body);
  }
  if (init.method !== 'GET' && REX.csrf) init.headers['X-CSRF-Token'] = REX.csrf;
  const res = await fetch(path, init);
  let data = null;
  try { data = await res.json(); } catch (e) { /* not json */ }
  if (!res.ok) {
    const err = new Error((data && data.message) || res.statusText || 'Request failed');
    err.status = res.status; err.code = data && data.error; err.data = data;
    throw err;
  }
  return data;
}

async function loadMe() {
  try { REX.me = await api('/api/me'); REX.csrf = REX.me.csrf; } catch (e) {
    if (e.status !== 401) console.warn(e);
    REX.me = null;
  }
  return REX.me;
}

function toast(message, kind) {
  let host = document.getElementById('toasts');
  if (!host) { host = h('div', { id: 'toasts', class: 'toasts', 'aria-live': 'polite' }); document.body.append(host); }
  const t = h('div', { class: 'toast ' + (kind || ''), role: 'status' }, message);
  host.append(t);
  setTimeout(() => t.remove(), 4800);
}

function initials(name) { return (name || '?').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase(); }
function guildIcon(g, large) {
  const box = h('div', { class: 'gicon' + (large ? ' lg' : '') });
  if (g.icon_url) box.append(h('img', { src: g.icon_url, alt: '', loading: 'lazy', width: 72, height: 72 }));
  else box.append(initials(g.name));
  return box;
}
function fmtDuration(s) {
  if (s == null) return '-';
  const d = Math.floor(s / 86400), hrs = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  if (d) return d + 'd ' + hrs + 'h';
  if (hrs) return hrs + 'h ' + m + 'm';
  return Math.max(m, 0) + 'm';
}
function fmtNum(n) { return n == null ? '-' : Number(n).toLocaleString(); }
function timeAgo(ts) {
  if (!ts) return 'never';
  const s = Math.max(0, Math.floor(Date.now() / 1000 - ts));
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  return Math.floor(s / 86400) + 'd ago';
}
function fmtDate(ts) { return ts ? new Date(ts * 1000).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '-'; }

const TIER_LABEL = { free: 'Free', premium: 'Premium', priority: 'Priority', ultra: 'Ultra' };
function tierBadge(tier) { return h('span', { class: 'badge tier-' + (tier || 'free') }, TIER_LABEL[tier] || 'Free'); }

/* ------------------------------------------------------------------ icons (line icons, no emoji) */
const ICONS = {
  wave: 'M3 12c2.5-4 4.5-4 7 0s4.5 4 7 0 3-3 4-2',
  scroll: 'M6 4h11a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4zm0 0a2 2 0 0 0-2 2v1h2M10 9h6M10 13h6',
  ticket: 'M3 8a2 2 0 0 0 0 4v0a2 2 0 0 1 0 4h0v2h18v-2h0a2 2 0 0 1 0-4v0a2 2 0 0 0 0-4V6H3v2zM13 6v12',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3z',
  dice: 'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM8.5 8.5h.01M15.5 8.5h.01M12 12h.01M8.5 15.5h.01M15.5 15.5h.01',
  check: 'M12 3l7 3v5c0 5-3 8.5-7 10-4-1.5-7-5-7-10V6l7-3zm-3 9l2 2 4-4',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9.5C7.5 20 4 17 4 12V6l8-3z',
  badge: 'M12 3l2.4 2 3.1-.3.9 3 2.6 1.8-1 3 1 3-2.6 1.8-.9 3-3.1-.3L12 21l-2.4-2-3.1.3-.9-3L3 14.5l1-3-1-3L5.6 6.7l.9-3 3.1.3L12 3z',
  chart: 'M4 20V10m6 10V4m6 16v-7m4 7H3',
  bolt: 'M13 2L4 14h7l-1 8 9-12h-7l1-8z',
  crown: 'M3 18h18l-1.5-9-4.5 4-3-7-3 7-4.5-4L3 18zm0 2h18',
  paint: 'M12 3a9 9 0 1 0 0 18c1.6 0 2-1 1.6-2-.5-1.3.2-2.5 1.6-2.5H17a4 4 0 0 0 4-4C21 7 17 3 12 3zM7.5 11h.01M10 7.5h.01M14.5 7.5h.01',
  scripts: 'M8 7l-5 5 5 5m8-10l5 5-5 5M14 4l-4 16',
  logs: 'M4 5h16M4 10h10M4 15h16M4 20h10',
  premium: 'M6 3h12l3 6-9 12L3 9l3-6zm-3 6h18M9 3l3 18M15 3l-3 18',
  lock: 'M6 11V8a6 6 0 0 1 12 0v3m-13 0h14v10H5V11z',
  undo: 'M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
  server: 'M4 5h16v6H4zM4 13h16v6H4zM8 8h.01M8 16h.01',
  users: 'M16 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM21 20v-2a4 4 0 0 0-3-3.9M16 4.1a3.5 3.5 0 0 1 0 6.8',
  key: 'M14 10a4 4 0 1 1 3 3.9L9 22H5v-4l2-2v-2h2l1.5-1.5',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  trash: 'M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  plus: 'M12 5v14M5 12h14',
  chev: 'M9 6l6 6-6 6',
  close: 'M6 6l12 12M18 6L6 18',
  home: 'M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9z',
  mail: 'M3 6h18v12H3zM3 7l9 7 9-7',
};
function icon(name, size) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.8'); svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  if (size) { svg.setAttribute('width', size); svg.setAttribute('height', size); }
  const p = document.createElementNS(ns, 'path');
  p.setAttribute('d', ICONS[name] || ICONS.star);
  svg.append(p);
  return svg;
}

/* ------------------------------------------------------------------ modal */
function openModal(title, ...content) {
  const back = h('div', { class: 'modal-back', onclick: (e) => { if (e.target === back) close(); } });
  const box = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' },
    h('button', { class: 'btn ghost sm x', type: 'button', onclick: () => close(), 'aria-label': 'Close' }, icon('close', 16)),
    title ? h('h2', {}, title) : null, ...content);
  back.append(box);
  document.body.append(back);
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  function close() { document.removeEventListener('keydown', onKey); back.remove(); }
  return { close, box };
}

/* ------------------------------------------------------------------ footer + nav */
function mountFooter() {
  let host = document.getElementById('footer');
  if (!host) { host = h('footer', { id: 'footer' }); document.body.append(host); }
  host.replaceChildren(h('div', { class: 'wrap foot' },
    h('div', { class: 'foot-brand' }, h('span', { class: 'mark', 'aria-hidden': 'true' }), h('div', {}, h('b', {}, 'Rex'), h('div', { class: 'small' }, 'Smart. Helpful. Always here.'))),
    h('div', { class: 'foot-links' },
      h('a', { href: '/about' }, 'About'), h('a', { href: '/commands' }, 'Commands'), h('a', { href: '/premium' }, 'Premium'),
      h('a', { href: '/live' }, 'Live stats'), h('a', { href: '/dashboard' }, 'Dashboard')),
    h('span', { class: 'small' }, 'Not affiliated with Discord Inc.')));
}

const ABOUT_KEYS = ['about', 'commands', 'premium', 'live'];

function subnav(active) {
  const item = (href, label, key) => h('a', { href, class: active === key ? 'active' : '' }, label);
  return h('nav', { class: 'subnav', 'aria-label': 'About sections' },
    item('/about', 'Overview', 'about'), item('/commands', 'Commands', 'commands'), item('/premium', 'Premium', 'premium'), item('/live', 'Live stats', 'live'));
}

function renderMaintenance(m, isOwnerPage) {
  const wall = h('div', { class: 'maint', id: 'maint-wall' },
    h('div', {}, h('span', { class: 'mark', 'aria-hidden': 'true' }), h('h1', {}, m.title), h('p', {}, m.desc)),
    h('a', { class: 'quiet', href: '/auth/login' }, 'Staff login'));
  document.body.append(wall);
}

async function loadSite() {
  try {
    REX.site = await api('/api/site');
    if (REX.site.support_url) REX.support = REX.site.support_url;
    if (window.rexApplyTheme) window.rexApplyTheme(REX.site.theme);
  } catch (e) { REX.site = null; }
  return REX.site;
}

async function mountNav(active) {
  const host = document.getElementById('nav');
  if (!host) return null;
  mountFooter();
  const [site, me] = await Promise.all([loadSite(), loadMe()]);

  if (site && site.maintenance && site.maintenance.on && !(me && me.is_owner)) {
    REX.blocked = true;
    host.remove();
    const app = document.getElementById('app'); if (app) app.remove();
    const foot = document.getElementById('footer'); if (foot) foot.remove();
    renderMaintenance(site.maintenance);
    return null;
  }

  const support = h('a', { class: 'btn sm discord support-btn', href: REX.support, target: '_blank', rel: 'noopener noreferrer' }, 'Join support server');
  const end = h('div', { class: 'nav-end' }, support);
  const aboutActive = ABOUT_KEYS.includes(active);
  const links = h('nav', { class: 'nav-links', 'aria-label': 'Main' },
    h('div', { class: 'dd' + (aboutActive ? ' active' : '') },
      h('button', { type: 'button', 'aria-haspopup': 'true' }, 'About'),
      h('div', { class: 'dd-menu' },
        h('a', { href: '/about' }, 'Overview', h('small', {}, 'What Rex does')),
        h('a', { href: '/commands' }, 'Commands', h('small', {}, 'Every command, explained')),
        h('a', { href: '/premium' }, 'Premium', h('small', {}, 'Tiers and codes')),
        h('a', { href: '/live' }, 'Live stats', h('small', {}, 'Status and growth')))),
    h('a', { href: '/dashboard', class: active === 'dashboard' ? 'active' : '' }, 'Dashboard'));

  host.replaceChildren(h('div', { class: 'wrap nav-in' },
    h('a', { href: '/', class: 'brand', 'aria-label': 'Rex home' }, h('span', { class: 'mark', 'aria-hidden': 'true' }), h('span', { class: 'w' }, 'REX')),
    links, end));

  if (me) {
    const wrap = h('div', { class: 'me-wrap' });
    const btn = h('button', { class: 'avatar-btn', type: 'button', 'aria-haspopup': 'true', 'aria-expanded': 'false', 'aria-label': 'Account menu', title: me.user.name },
      h('img', { src: me.user.avatar_url, alt: '' }));
    let menu = null;
    const closeMenu = () => { if (menu) { menu.remove(); menu = null; btn.setAttribute('aria-expanded', 'false'); } };
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (menu) return closeMenu();
      btn.setAttribute('aria-expanded', 'true');
      menu = h('div', { class: 'menu', role: 'menu' },
        h('div', { class: 'who' }, h('b', {}, me.user.name), h('span', { class: 'small muted' }, '@' + me.user.username)),
        h('a', { href: '/profile' }, 'Profile'),
        h('a', { href: '/premium#redeem' }, 'Redeem a code'),
        me.is_owner ? h('a', { href: '/owner', class: 'owner-link' }, me.owner_mode ? 'Owner mode' : 'Enter owner mode') : null,
        h('button', { type: 'button', onclick: async () => { try { await api('/api/logout', { method: 'POST' }); } catch (x) { /* ignore */ } location.href = '/'; } }, 'Log out'));
      wrap.append(menu);
    });
    document.addEventListener('click', (e) => { if (menu && !wrap.contains(e.target)) closeMenu(); });
    wrap.append(btn);
    end.append(wrap);
    if (me.owner_mode) {
      const strip = h('div', { class: 'owner-strip' }, h('div', { class: 'wrap' },
        h('span', {}, 'Owner mode is on'), h('a', { href: '/owner' }, 'Open owner tools'),
        h('button', { type: 'button', onclick: async () => { await api('/api/owner/mode', { method: 'POST', body: { on: false } }); location.href = '/profile'; } }, 'Exit')));
      host.after(strip);
    }
  } else {
    end.append(h('a', { class: 'btn sm', href: '/auth/login' }, 'Log in'));
  }
  if (site && site.maintenance && site.maintenance.on && me && me.is_owner) {
    host.after(h('div', { class: 'owner-strip' }, h('div', { class: 'wrap' }, h('span', {}, 'Maintenance mode is ON - visitors see the maintenance page.'), h('a', { href: '/owner#website' }, 'Change'))));
  }
  document.dispatchEvent(new CustomEvent('rex:ready', { detail: { me, site } }));
  return me;
}

function stateScreen(title, text, actions) {
  return h('div', { class: 'panel empty narrow' }, h('span', { class: 'mark', 'aria-hidden': 'true' }), h('h2', {}, title), h('p', { class: 'muted' }, text), actions || null);
}

/* ------------------------------------------------------------------ polling a queued operation (redeem, owner ops) */
async function waitForResult(id, onTick) {
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, i < 3 ? 1200 : 2000));
    try {
      const r = await api('/api/result?id=' + encodeURIComponent(id));
      if (r.done) return r;
    } catch (e) { /* keep waiting */ }
    if (onTick) onTick(i);
  }
  return { done: false, ok: false, errors: { _: 'Rex did not answer in time. If the bot is offline, try again once it is back.' } };
}

/** Redeem a Premium / Priority / Ultra code for a server. */
function redeemWidget(guilds, fixedGid, onDone) {
  const eligible = guilds.filter((g) => g.bot_present && (g.admin || g.owner || g.via === 'owner'));
  const code = h('input', { type: 'text', placeholder: 'REX-PREMIUM-XXXX-XXXX', autocomplete: 'off', spellcheck: 'false', maxlength: 80, 'aria-label': 'Code' });
  const sel = h('select', { 'aria-label': 'Server' }, eligible.map((g) => h('option', { value: g.id }, g.name)));
  if (fixedGid) sel.value = fixedGid;
  const out = h('div', { class: 'hint', role: 'status' });
  const btn = h('button', { class: 'btn', type: 'button' }, 'Redeem code');
  btn.addEventListener('click', async () => {
    const gid = fixedGid || sel.value;
    if (!gid) { out.textContent = 'Pick a server first.'; return; }
    if (!code.value.trim()) { out.textContent = 'Paste your code first.'; return; }
    btn.disabled = true; out.className = 'hint'; out.replaceChildren(h('span', { class: 'spin' }), ' Asking Rex...');
    try {
      const res = await api('/api/guilds/' + encodeURIComponent(gid) + '/redeem', { method: 'POST', body: { code: code.value.trim() } });
      const r = await waitForResult(res.id);
      if (r.ok && r.done) {
        const o = r.out || {};
        out.className = 'hint'; out.style.color = 'var(--ok)';
        out.textContent = (TIER_LABEL[o.tier] || 'Premium') + ' is now active on this server' + (o.duration ? ' (' + o.duration + ')' : '') + '.';
        code.value = '';
        if (onDone) onDone(r);
      } else {
        out.style.color = 'var(--bad)';
        out.textContent = Object.values(r.errors || {})[0] || 'That did not work.';
      }
    } catch (e) { out.style.color = 'var(--bad)'; out.textContent = e.message; }
    btn.disabled = false;
  });
  return h('div', { class: 'row' },
    fixedGid ? null : h('div', {}, h('label', { class: 'lbl' }, 'Server'), sel),
    h('div', {}, h('label', { class: 'lbl' }, 'Code'), code), h('div', {}, btn), out);
}
