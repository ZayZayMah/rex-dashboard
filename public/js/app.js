'use strict';
/* Shared helpers: safe DOM builder, API client, nav, toasts, formatting. */

const REX = { me: null, csrf: null };

/** Build DOM safely (text is never parsed as HTML). */
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) {
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
    err.status = res.status;
    err.code = data && data.error;
    throw err;
  }
  return data;
}

async function loadMe() {
  try {
    REX.me = await api('/api/me');
    REX.csrf = REX.me.csrf;
  } catch (e) {
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
  setTimeout(() => t.remove(), 4500);
}

function initials(name) {
  return (name || '?').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

function guildIcon(g, large) {
  const box = h('div', { class: 'gicon' + (large ? ' lg' : '') });
  if (g.icon_url) box.append(h('img', { src: g.icon_url, alt: '', loading: 'lazy', width: 72, height: 72 }));
  else box.append(initials(g.name));
  return box;
}

function fmtDuration(s) {
  if (s == null) return '—';
  const d = Math.floor(s / 86400), hrs = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  if (d) return d + 'd ' + hrs + 'h';
  if (hrs) return hrs + 'h ' + m + 'm';
  return Math.max(m, 0) + 'm';
}
function fmtNum(n) { return n == null ? '—' : Number(n).toLocaleString(); }
function timeAgo(ts) {
  if (!ts) return 'never';
  const s = Math.max(0, Math.floor(Date.now() / 1000 - ts));
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  return Math.floor(s / 86400) + 'd ago';
}

/** Optional real artwork: drop avatar.png / banner.png into /public/img to use them. */
function loadOptional(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function mountNav(active) {
  const host = document.getElementById('nav');
  if (!host) return;
  const themeBtn = h('button', {
    class: 'btn ghost sm icon', type: 'button', 'aria-label': 'Switch theme', title: 'Switch theme',
    onclick: () => {
      const next = window.rexToggleTheme();
      themeBtn.textContent = next === 'halloween' ? '🎃' : '⚡';
    },
  }, document.documentElement.getAttribute('data-theme') === 'halloween' ? '🎃' : '⚡');

  const end = h('div', { class: 'nav-end' }, themeBtn);
  const link = (href, label, key) => h('a', { href, class: active === key ? 'active' : '' }, label);
  const links = h('nav', { class: 'nav-links', 'aria-label': 'Main' },
    link('/', 'Home', 'home'), link('/dashboard', 'Dashboard', 'dashboard'));
  host.replaceChildren(h('div', { class: 'wrap nav-in' },
    h('a', { href: '/', class: 'brand' }, h('span', { class: 'mark', 'aria-hidden': 'true' }), 'REX'),
    links, end));

  const me = await loadMe();
  if (me) {
    if (me.is_owner) links.append(link('/admin', 'Health', 'admin'));
    end.prepend(
      h('div', { class: 'user-chip' }, h('img', { src: me.user.avatar_url, alt: '', width: 28, height: 28 }), h('span', {}, me.user.name)),
      h('button', {
        class: 'btn ghost sm', type: 'button',
        onclick: async () => { try { await api('/api/logout', { method: 'POST' }); } catch (e) { /* ignore */ } location.href = '/'; },
      }, 'Log out'));
  } else {
    end.prepend(h('a', { class: 'btn sm', href: '/auth/login' }, 'Login with Discord'));
  }
  return me;
}
