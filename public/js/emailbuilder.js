'use strict';
/* Full-page email builder: free placement on a canvas, desktop + phone layouts, real-render preview. */
(async function () {
  const app = document.getElementById('app');
  const me = await loadMe();
  if (!me || !me.is_owner || !me.owner_mode) { location.replace(window.EB_MODE === 'page' ? '/owner#pages' : '/owner#email'); return; }
  const PAGE = window.EB_MODE === 'page';   // the same builder also makes website pages
  const qs = new URLSearchParams(location.search);
  let tplId = qs.get('id') || '', pageName = (qs.get('name') || '').toLowerCase(), pageHideNav = false, PT = 'normal';
  const BACK = PAGE ? '/owner#pages' : '/owner#email';
  if (PAGE && !me.beta) { /* owners can always edit pages */ }
  const MOB = 360;
  const meta = await api('/api/owner/email/meta');
  const FONT = Object.fromEntries(meta.fonts.map((f) => [f.id, f]));
  const gf = meta.fonts.filter((f) => f.gf).map((f) => 'family=' + f.gf).join('&');
  if (gf) document.head.append(h('link', { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?' + gf + '&display=swap' }));

  /* ---------- state */
  let D = null, M = { name: '', subject: '', send_to: 'everyone', send_when: 'manual', when_at: 'now', at_time: '09:00', enabled: false };
  let dev = 'd', sel = null, zoom = 1, mode = 'edit', dirty = false, tab = 'layers';
  const undo = [], redo = [];
  const uid = () => Math.random().toString(36).slice(2, 10);
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const el$ = (id) => D.els.find((e) => e.id === id);
  const SAMPLE = { name: 'Alex Rivera', first_name: 'Alex', server: 'My Server', date: new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) };

  const base = () => PAGE ? ({ v: 1, w: 860, bg: '', page: '', font: 'inter', color: '', link: '', outer: 0, radius: 0, pre: '', dark: 'off', els: [] }) : ({ v: 1, w: 600, bg: '#eef2f9', page: '#ffffff', font: 'arial', color: '#33415c', link: '#2f8cff', outer: 24, radius: 16, pre: '', dark: 'auto', els: [] });
  const T = (x, y, w, h2, text, o) => Object.assign({ id: uid(), t: 'text', name: 'Text', d: { x, y, w, h: h2 }, text, size: 16, color: '', align: 'left', va: 'top', lh: 1.5, ls: 0 }, o || {});
  const BTN = (x, y, w, label, url, o) => Object.assign({ id: uid(), t: 'button', name: 'Button', d: { x, y, w, h: 48 }, label, url: url || '{dashboard_url}', bg: '#2f8cff', color: '#ffffff', radius: 12, size: 16, bold: true, align: 'center', va: 'middle', lh: 1.5, ls: 0 }, o || {});
  const RECT = (x, y, w, h2, bg, o) => Object.assign({ id: uid(), t: 'rect', name: 'Box', d: { x, y, w, h: h2 }, bg, radius: 0, lh: 1.5 }, o || {});
  const PRESETS = {
    blank: { label: 'Blank', desc: 'Start from nothing.', make: () => { const d = base(); d.els = [T(40, 40, 520, 120, 'Hi {first_name},\n\nWrite your message here.\n\n[Unsubscribe]({unsubscribe_url})')]; return { d, subject: '' }; } },
    welcome: { label: 'Welcome', desc: 'A friendly hello with a button.', make: () => { const d = base(); d.els = [
      RECT(0, 0, 600, 190, '#0b1426', { name: 'Header' }), T(40, 56, 520, 48, 'Welcome to Rex', { size: 34, bold: true, color: '#ffffff', name: 'Title', font: 'poppins' }),
      T(40, 112, 520, 40, 'Smart. Helpful. Always here.', { size: 16, color: '#8fb8ff', name: 'Tagline' }),
      T(40, 220, 520, 130, 'Hi {first_name},\n\nThanks for logging in. Add Rex to a server, open the dashboard and make it yours: commands, welcome cards, moderation and more.'),
      BTN(40, 370, 220, 'Open my dashboard'), T(40, 450, 520, 50, SMALL, { size: 12, color: '#6b7a99', name: 'Small print' })]; return { d, subject: 'Welcome to Rex, {first_name}!' }; } },
    news: { label: 'Announcement', desc: 'Big picture, headline, two columns.', make: () => { const d = base(); d.els = [
      { id: uid(), t: 'image', name: 'Hero picture', d: { x: 0, y: 0, w: 600, h: 220 }, src: '', alt: 'Hero picture', fit: 'cover' },
      T(40, 250, 520, 44, "What's new in Rex", { size: 30, bold: true, color: '#0b1426', font: 'poppins', name: 'Headline' }),
      T(40, 306, 250, 150, '**Faster dashboard**\nEverything loads quicker and works better on phones.', { name: 'Column 1', bg: '#f3f6fc', pad: 16, radius: 12 }),
      T(310, 306, 250, 150, '**New builder**\nMake your own commands and events with blocks.', { name: 'Column 2', bg: '#f3f6fc', pad: 16, radius: 12 }),
      BTN(40, 490, 220, 'See everything new', '{site_url}')]; return { d, subject: "What's new in Rex" }; } },
    notice: { label: 'Account notice', desc: 'Short, serious message (ban, warning).', make: () => { const d = base(); d.els = [
      RECT(0, 0, 600, 8, '#e5484d', { name: 'Accent bar' }), T(40, 40, 520, 44, 'An update about {server}', { size: 26, bold: true, color: '#0b1426', name: 'Headline' }),
      T(40, 100, 520, 150, 'Hi {first_name},\n\nWe wanted to let you know about a change to your server. Write the details here.'),
      BTN(40, 270, 220, 'Contact support', '{support_url}', { bg: '#0b1426' })]; return { d, subject: 'An update about your server' }; } },
  };


  /* ---------- themes: a full starting layout (colours, fonts, logo, decorations) */
  const SMALL = "Don't want these? [Change which emails you get]({unsubscribe_link}) · [Unsubscribe]({unsubscribe_url})";
  const THEMES = [
    { id: 'dark', label: 'Dark rounded', desc: 'Deep navy, soft corners, logo up top.', bg: '#070b14', card: '#101827', head: '#16233d', title: '#ffffff', text: '#c7d2ea', muted: '#7f8db0', accent: '#2f8cff', btn: '#2f8cff', btnText: '#ffffff', font: 'poppins', body: 'inter', radius: 28, layout: 'center', decor: [] },
    { id: 'light', label: 'Clean light', desc: 'Bright and friendly with the logo.', bg: '#eef2f9', card: '#ffffff', head: '#2f8cff', title: '#ffffff', text: '#33415c', muted: '#6b7a99', accent: '#2f8cff', btn: '#2f8cff', btnText: '#ffffff', font: 'poppins', body: 'arial', radius: 16, layout: 'center', logoBg: '#ffffff', decor: [] },
    { id: 'halloween', label: 'Halloween', desc: 'Spooky purple and pumpkin orange.', bg: '#120a1a', card: '#1c1126', head: '#2a1238', title: '#ff8a1f', text: '#e8d9f5', muted: '#9a85ad', accent: '#ff7a00', btn: '#ff7a00', btnText: '#1c1126', font: 'creepster', body: 'nunito', radius: 20, layout: 'center', decor: ['🎃', '🦇', '👻', '🕸️'] },
    { id: 'christmas', label: 'Christmas', desc: 'Red and green with snow and presents.', bg: '#0f3b2a', card: '#fffaf0', head: '#b3122f', title: '#ffffff', text: '#2b3a33', muted: '#6c7a72', accent: '#1f8a4c', btn: '#1f8a4c', btnText: '#ffffff', font: 'mountains', body: 'georgia', radius: 18, layout: 'center', logoBg: '#ffffff', decor: ['🎄', '❄️', '🎁', '⛄'] },
    { id: 'newyear', label: 'New Year', desc: 'Midnight blue and gold fireworks.', bg: '#05070f', card: '#0b1020', head: '#0f1730', title: '#f5c542', text: '#d5dbea', muted: '#7e89a8', accent: '#f5c542', btn: '#f5c542', btnText: '#0b1020', font: 'abril', body: 'lato', radius: 14, layout: 'center', decor: ['🎆', '🥂', '✨', '🎉'] },
    { id: 'valentine', label: "Valentine's", desc: 'Soft pinks and hearts.', bg: '#fdeef3', card: '#ffffff', head: '#e0457b', title: '#ffffff', text: '#5b2a3c', muted: '#a06a7d', accent: '#e0457b', btn: '#e0457b', btnText: '#ffffff', font: 'playfair', body: 'lora', radius: 24, layout: 'center', logoBg: '#ffffff', decor: ['💖', '💌', '🌹', '💘'] },
    { id: 'spring', label: 'Spring / Easter', desc: 'Pastel green, tulips and eggs.', bg: '#eaf7ee', card: '#ffffff', head: '#8fd3a8', title: '#1f5136', text: '#36513f', muted: '#6f8f7a', accent: '#3fae6b', btn: '#3fae6b', btnText: '#ffffff', font: 'fredoka', body: 'nunito', radius: 26, layout: 'center', logoBg: '#ffffff', decor: ['🌷', '🐣', '🌼', '🥚'] },
    { id: 'summer', label: 'Summer', desc: 'Sunshine yellow, palms and watermelon.', bg: '#fff6df', card: '#ffffff', head: '#ffb703', title: '#3b2a00', text: '#5a4a1f', muted: '#92803f', accent: '#fb8500', btn: '#fb8500', btnText: '#ffffff', font: 'righteous', body: 'nunito', radius: 22, layout: 'center', logoBg: '#ffffff', decor: ['☀️', '🌴', '🍉', '🏖️'] },
    { id: 'autumn', label: 'Autumn', desc: 'Warm oranges, leaves and a harvest feel.', bg: '#fbefe0', card: '#ffffff', head: '#c2571a', title: '#ffffff', text: '#4a3321', muted: '#8b6c52', accent: '#c2571a', btn: '#c2571a', btnText: '#ffffff', font: 'merriweather', body: 'georgia', radius: 12, layout: 'center', logoBg: '#ffffff', decor: ['🍂', '🍁', '🦃', '🎃'] },
    { id: 'neon', label: 'Neon', desc: 'Black with cyan and magenta glow.', bg: '#05020a', card: '#0b0614', head: '#0b0614', title: '#19f7ff', text: '#e9e5ff', muted: '#8a7fb8', accent: '#ff2bd6', btn: '#ff2bd6', btnText: '#ffffff', font: 'chakra', body: 'chakra', radius: 6, layout: 'left', border: '#ff2bd6', decor: ['⚡'] },
    { id: 'ocean', label: 'Ocean', desc: 'Teal blues and waves.', bg: '#e6f6fb', card: '#ffffff', head: '#0b6e99', title: '#ffffff', text: '#24506a', muted: '#6a8fa3', accent: '#0fa3b1', btn: '#0fa3b1', btnText: '#ffffff', font: 'nunito', body: 'nunito', radius: 20, layout: 'center', logoBg: '#ffffff', decor: ['🌊', '🐚', '🐬'] },
    { id: 'sunset', label: 'Sunset', desc: 'Plum night with a coral glow.', bg: '#2b1030', card: '#3a1840', head: '#ff6b4a', title: '#ffffff', text: '#ffe2d6', muted: '#c79ab0', accent: '#ffb36b', btn: '#ffb36b', btnText: '#3a1840', font: 'poppins', body: 'poppins', radius: 24, layout: 'center', logoBg: '#ffffff', decor: ['🌅'] },
    { id: 'forest', label: 'Forest', desc: 'Deep green with leaves.', bg: '#0e1a12', card: '#14261a', head: '#1f4d2e', title: '#e9f7d6', text: '#cfe3c4', muted: '#84a283', accent: '#7ed957', btn: '#7ed957', btnText: '#0e1a12', font: 'lora', body: 'lora', radius: 18, layout: 'center', decor: ['🌲', '🍃', '🦌'] },
    { id: 'royal', label: 'Royal gold', desc: 'Dark violet with gold lettering.', bg: '#0d0b14', card: '#17131f', head: '#2a2036', title: '#e7c26a', text: '#ddd5ea', muted: '#8e84a3', accent: '#e7c26a', btn: '#e7c26a', btnText: '#17131f', font: 'playfair', body: 'lora', radius: 10, layout: 'center', decor: ['👑', '✨'] },
    { id: 'blackfriday', label: 'Sale / Black Friday', desc: 'Black and yellow, loud and clear.', bg: '#000000', card: '#111111', head: '#ffd400', title: '#000000', text: '#eeeeee', muted: '#999999', accent: '#ffd400', btn: '#ffd400', btnText: '#000000', font: 'bebas', body: 'oswald', radius: 4, layout: 'left', logoBg: '#ffffff', decor: ['🏷️', '💥'] },
    { id: 'party', label: 'Celebration', desc: 'Purple and pink, confetti vibes.', bg: '#f3e8ff', card: '#ffffff', head: '#7c3aed', title: '#ffffff', text: '#3b2a5e', muted: '#7d6aa3', accent: '#ec4899', btn: '#ec4899', btnText: '#ffffff', font: 'fredoka', body: 'nunito', radius: 28, layout: 'center', logoBg: '#ffffff', decor: ['🎉', '🎂', '🎈', '✨'] },
    { id: 'retro', label: 'Retro paper', desc: 'Cream paper and a serif headline.', bg: '#efe3c8', card: '#fbf4e2', head: '#8b2e1f', title: '#fbf4e2', text: '#3b2f22', muted: '#8a7a62', accent: '#8b2e1f', btn: '#8b2e1f', btnText: '#fbf4e2', font: 'abril', body: 'georgia', radius: 2, layout: 'left', logoBg: '#fbf4e2', decor: [] },
    { id: 'mono', label: 'Minimal mono', desc: 'Black on white, no fuss.', bg: '#f5f5f5', card: '#ffffff', head: '#111111', title: '#ffffff', text: '#222222', muted: '#777777', accent: '#111111', btn: '#111111', btnText: '#ffffff', font: 'inter', body: 'inter', radius: 4, layout: 'left', logoBg: '#ffffff', decor: [] },
  ];
  const textH = (txt, size, width, lh) => Math.max(1, txt.split('\n').reduce((n, ln) => n + Math.max(1, Math.ceil(ln.length * size * 0.52 / width)), 0)) * Math.round(size * (lh || 1.5));
  /** Builds a whole email layout from a theme and some content. */
  function themed(th, c) {
    c = Object.assign({ title: 'Your headline here', sub: 'A short line under it', body: 'Hi {first_name},\n\nWrite your message here. Keep it short and friendly.', box: '**A highlight**\nSomething worth knowing goes here.', btn: 'Open my dashboard', url: '{dashboard_url}', small: SMALL }, c || {});
    const d = base(); d.bg = th.bg; d.page = th.card; d.color = th.text; d.link = th.accent; d.font = th.body; d.radius = th.radius; d.outer = th.radius > 15 ? 28 : 20;
    const els = [], mid = 300;
    let y;
    if (th.layout === 'center') {
      const hh = 232; els.push(RECT(0, 0, 600, hh, th.head, { name: 'Header' }));
      if (th.logoBg) els.push(RECT(mid - 48, 28, 96, 96, th.logoBg, { name: 'Logo circle', radius: 48, dbg: th.logoBg }));
      els.push({ id: uid(), t: 'image', name: 'Logo', d: { x: th.logoBg ? mid - 36 : mid - 44, y: th.logoBg ? 40 : 30, w: th.logoBg ? 72 : 88, h: th.logoBg ? 72 : 88 }, src: '{logo_url}', alt: 'Rex', fit: 'fill' });
      els.push(T(40, 138, 520, 46, c.title, { size: 34, bold: true, color: th.title, font: th.font, align: 'center', va: 'middle', name: 'Title' }));
      els.push(T(60, 188, 480, 28, c.sub, { size: 16, color: th.title, align: 'center', name: 'Subtitle', va: 'middle' }));
      y = hh;
    } else {
      const hh = 150; els.push(RECT(0, 0, 600, hh, th.head, { name: 'Header' }));
      if (th.logoBg) els.push(RECT(40, 39, 72, 72, th.logoBg, { name: 'Logo circle', radius: 36, dbg: th.logoBg }));
      els.push({ id: uid(), t: 'image', name: 'Logo', d: { x: th.logoBg ? 48 : 40, y: th.logoBg ? 47 : 39, w: th.logoBg ? 56 : 72, h: th.logoBg ? 56 : 72 }, src: '{logo_url}', alt: 'Rex', fit: 'fill' });
      els.push(T(128, 44, 432, 44, c.title, { size: 32, bold: true, color: th.title, font: th.font, va: 'middle', name: 'Title' }));
      els.push(T(128, 92, 432, 26, c.sub, { size: 15, color: th.title, name: 'Subtitle', va: 'middle' }));
      y = hh;
    }
    th.decor.slice(0, 4).forEach((e, i) => { const xs = th.layout === 'center' ? [18, 538, 62, 494] : [538, 494, 450, 406]; els.push(T(xs[i], th.layout === 'center' ? 12 : 8, 44, 40, e, { size: 28, align: 'center', name: 'Decoration ' + (i + 1), lh: 1.2 })); });
    if (th.border) els.push(RECT(0, y, 600, 3, th.accent, { name: 'Accent line' }));
    y += 32;
    const bh = textH(c.body, 16, 520); els.push(T(40, y, 520, bh, c.body, { name: 'Message' })); y += bh + 20;
    if (c.box) { const xh = textH(c.box, 16, 488, 1.6) + 32; els.push(T(40, y, 520, xh, c.box, { name: 'Highlight box', bg: th.head, color: th.title, pad: 16, radius: Math.min(th.radius, 16), lh: 1.6 })); y += xh + 24; }
    if (c.btn) { els.push(BTN(40, y, 240, c.btn, c.url, { bg: th.btn, color: th.btnText, radius: Math.min(th.radius, 14), font: th.font === 'creepster' ? 'nunito' : th.font })); y += 48 + 32; }
    els.push(RECT(40, y, 520, 1, th.muted, { name: 'Divider' })); y += 16;
    els.push(T(40, y, 520, 40, c.small, { size: 12, color: th.muted, name: 'Small print', align: 'center', lh: 1.6 })); y += 56;
    d.els = els; return d;
  }

  /* ---------- layout helpers */
  function autoMobile() {
    const els = D.els.filter((e) => !e.hid), kids = {}, top = [], out = {};
    const inside = (a, r) => a.x >= r.x - 0.5 && a.y >= r.y - 0.5 && a.x + a.w <= r.x + r.w + 0.5 && a.y + a.h <= r.y + r.h + 0.5;
    els.forEach((e) => kids[e.id] = []);
    els.forEach((e) => {
      let best = null;
      els.forEach((r) => { if (r === e || r.t !== 'rect' || !inside(e.d, r.d)) return; const ar = r.d.w * r.d.h, ae = e.d.w * e.d.h; if (ar < ae || (ar === ae && els.indexOf(r) > els.indexOf(e))) return; if (!best || ar < best.d.w * best.d.h) best = r; });
      (best ? kids[best.id] : top).push(e);
    });
    const place = (e, x, y, w, hh) => {
      out[e.id] = { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(hh) };
      if (kids[e.id].length) { const s = w / e.d.w; kids[e.id].forEach((k) => place(k, (k.d.x - e.d.x) * s, y + (k.d.y - e.d.y), k.d.w * s, k.d.h)); kids[e.id].forEach((k) => { out[k.id].x += Math.round(x); }); }
    };
    let cursor = 0, prev = null;
    top.sort((a, b) => a.d.y - b.d.y || a.d.x - b.d.x).forEach((e) => {
      const d = e.d, wide = d.w >= 0.7 * 600, mar = wide && d.x >= 16 && e.t !== 'rect' ? 24 : 0;
      const w = wide ? MOB - 2 * mar : Math.min(d.w, MOB);
      const hh = kids[e.id].length ? d.h : (e.t === 'image' || e.t === 'rect') ? Math.round(d.h * (w / d.w)) : d.h;
      const gap = prev === null ? 0 : Math.min(Math.max(0, d.y - prev), 24);
      place(e, wide ? mar : Math.round((MOB - w) / 2), cursor + gap, w, hh);
      cursor += gap + hh; prev = d.y + d.h;
    });
    return out;
  }
  const hasMob = () => D.els.every((e) => e.m);
  function materialise() { if (hasMob()) return; const a = autoMobile(); D.els.forEach((e) => { if (!e.m) e.m = Object.assign({ hide: !!e.hid }, a[e.id] || { x: 0, y: 0, w: MOB, h: e.d.h }); }); }
  function boxOf(e, auto) { if (dev === 'd') return e.d; if (e.m) return e.m; return (auto || autoMobile())[e.id] || { x: 0, y: 0, w: MOB, h: e.d.h }; }
  const W = () => (dev === 'd' ? D.w : MOB);
  const canvasH = () => { const a = dev === 'm' && !hasMob() ? autoMobile() : null; return Math.max(dev === 'd' ? 520 : 640, ...D.els.map((e) => { const b = boxOf(e, a); return b.y + b.h + 60; })); };

  /* ---------- history */
  function commit(label) { undo.push(JSON.stringify(D)); if (undo.length > 80) undo.shift(); redo.length = 0; dirty = true; syncBar(); }
  function doUndo() { if (!undo.length) return; redo.push(JSON.stringify(D)); D = JSON.parse(undo.pop()); dirty = true; if (sel && !el$(sel)) sel = null; paintAll(); }
  function doRedo() { if (!redo.length) return; undo.push(JSON.stringify(D)); D = JSON.parse(redo.pop()); dirty = true; if (sel && !el$(sel)) sel = null; paintAll(); }

  /* ---------- preview markup for the canvas (same rules as the server) */
  function markup(text) {
    const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    let s = esc(fillVars(text || ''));
    s = s.replace(/\[([^\]\n]{1,80})\]\((https:\/\/[^\s)]{4,300}|\{\w+\})\)/g, (m, a) => '<u class="lnk">' + a + '</u>');
    s = s.replace(/\*\*([^*\n]{1,300})\*\*/g, '<b>$1</b>').replace(/(^|[^*\w])\*([^*\n]{1,300})\*(?![*\w])/g, '$1<i>$2</i>');
    return s.replace(/\n/g, '<br>');
  }
  const fillVars = (t) => t.replace(/\{(\w+)\}/g, (m, k) => (SAMPLE[k] !== undefined ? SAMPLE[k] : m));

  /* ---------- DOM skeleton */
  const stage = h('div', { class: 'eb-stage' }), canvasWrap = h('div', { class: 'eb-canvas-wrap' }, stage);
  const left = h('aside', { class: 'eb-left' }), right = h('aside', { class: 'eb-right' });
  const previewBox = h('div', { class: 'eb-preview', hidden: true });
  const nameIn = h('input', { class: 'eb-name', type: 'text', maxlength: 60, placeholder: PAGE ? 'Page title (shown in the browser tab)' : 'Name this email (e.g. Welcome)', 'aria-label': PAGE ? 'Page title' : 'Email name', oninput: (e) => { M.name = e.target.value; dirty = true; syncBar(); } });
  const bDesk = h('button', { type: 'button', class: 'eb-seg on', onclick: () => setDev('d') }, 'Desktop'), bMob = h('button', { type: 'button', class: 'eb-seg', onclick: () => setDev('m') }, 'Phone');
  const bEdit = h('button', { type: 'button', class: 'eb-seg on', onclick: () => setMode('edit') }, 'Edit'), bPrev = h('button', { type: 'button', class: 'eb-seg', onclick: () => setMode('preview') }, 'Preview');
  const bUndo = h('button', { type: 'button', class: 'eb-ic', title: 'Undo (Ctrl+Z)', 'aria-label': 'Undo', onclick: doUndo }, '↶'), bRedo = h('button', { type: 'button', class: 'eb-ic', title: 'Redo (Ctrl+Y)', 'aria-label': 'Redo', onclick: doRedo }, '↷');
  const zLabel = h('span', { class: 'eb-z' }, '100%');
  const bSave = h('button', { type: 'button', class: 'eb-save', onclick: save }, 'Save');
  const status = h('span', { class: 'eb-status' });
  const bAuto = h('button', { type: 'button', class: 'eb-ghost eb-auto-btn', title: 'Choose when and to whom this email is sent automatically', onclick: () => automation() }, '⚡ Automation');
  const bar = h('header', { class: 'eb-bar' },
    h('button', { type: 'button', class: 'eb-back', title: 'Back', 'aria-label': 'Back', onclick: goBack }, '←'),
    nameIn, h('div', { class: 'eb-segs' }, bDesk, bMob), h('div', { class: 'eb-segs' }, bEdit, bPrev),
    h('div', { class: 'eb-tools' }, bUndo, bRedo,
      h('button', { type: 'button', class: 'eb-ic', 'aria-label': 'Zoom out', onclick: () => setZoom(zoom - 0.1) }, '−'), zLabel, h('button', { type: 'button', class: 'eb-ic', 'aria-label': 'Zoom in', onclick: () => setZoom(zoom + 0.1) }, '+')),
    status, ...(PAGE ? [pageTheme(), h('button', { type: 'button', class: 'eb-ghost', onclick: copyLink }, 'Copy link')] : [bAuto, h('button', { type: 'button', class: 'eb-ghost', onclick: testSend }, 'Send test')]), bSave);
  app.replaceChildren(h('div', { class: 'eb' }, bar, h('div', { class: 'eb-body' }, left, h('main', { class: 'eb-main' }, canvasWrap, previewBox), right)));

  function syncBar() { if (!PAGE) bAuto.classList.toggle('on', !!M.enabled && M.send_when !== 'manual'); if (!PAGE) bAuto.textContent = '⚡ Automation' + (M.enabled && M.send_when !== 'manual' ? ': on' : ''); bUndo.disabled = !undo.length; bRedo.disabled = !redo.length; bSave.textContent = dirty ? 'Save' : 'Saved'; bSave.classList.toggle('clean', !dirty); zLabel.textContent = Math.round(zoom * 100) + '%'; }
  function setZoom(z) { zoom = Math.max(0.4, Math.min(1.6, Math.round(z * 10) / 10)); paintCanvas(); syncBar(); }
  function setDev(d) { dev = d; bDesk.classList.toggle('on', d === 'd'); bMob.classList.toggle('on', d === 'm'); if (mode === 'preview') showPreview(); paintAll(); }
  function setMode(m) { mode = m; bEdit.classList.toggle('on', m === 'edit'); bPrev.classList.toggle('on', m === 'preview'); canvasWrap.hidden = m === 'preview'; previewBox.hidden = m !== 'preview'; left.classList.toggle('dim', m === 'preview'); if (m === 'preview') showPreview(); }
  async function goBack() { if (dirty && !(await rexDialog.confirm('Leave without saving?', 'Your changes will be lost.', 'Leave', true))) return; dirty = false; location.href = BACK; }
  window.addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

  /* ---------- canvas */
  const nodes = {};
  function paintCanvas() {
    stage.replaceChildren(); Object.keys(nodes).forEach((k) => delete nodes[k]);
    const w = W(), hgt = canvasH(), auto = dev === 'm' && !hasMob() ? autoMobile() : null;
    stage.style.width = w + 'px'; stage.style.height = hgt + 'px'; stage.style.transform = 'scale(' + zoom + ')';
    canvasWrap.style.setProperty('--sw', Math.round(w * zoom) + 'px'); canvasWrap.style.setProperty('--sh', Math.round(hgt * zoom) + 'px');
    stage.style.background = PAGE ? (D.page || 'transparent') : D.page; stage.style.borderRadius = D.radius + 'px';
    if (PAGE) canvasWrap.className = 'eb-canvas-wrap pt-' + PT;
    if (dev === 'm' && auto) stage.append(h('div', { class: 'eb-auto' }, 'Automatic phone layout. Move anything to customise it.'));
    D.els.forEach((e, i) => {
      if (e.hid) return;
      const b = boxOf(e, auto); if (dev === 'm' && e.m && e.m.hide) return;
      const n = h('div', { class: 'eb-el t-' + e.t + (e.id === sel ? ' sel' : '') + (e.lock ? ' lock' : ''), 'data-id': e.id });
      n.style.left = b.x + 'px'; n.style.top = b.y + 'px'; n.style.width = b.w + 'px'; n.style.height = b.h + 'px'; n.style.zIndex = String(i + 1);
      fillNode(n, e, b);
      n.addEventListener('pointerdown', (ev) => startDrag(ev, e, 'move'));
      stage.append(n); nodes[e.id] = n;
      if (e.id === sel && !e.lock) ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].forEach((hd) => { const hn = h('i', { class: 'eb-h h-' + hd }); hn.addEventListener('pointerdown', (ev) => startDrag(ev, e, hd)); n.append(hn); });
    });
  }
  function fillNode(n, e, b) {
    const s = n.style;
    if (e.bg && e.bg !== 'transparent') s.background = e.bg; else if (PAGE && e.t === 'button' && !e.bg) s.background = 'var(--volt)';
    if (e.radius) s.borderRadius = e.radius + 'px';
    if (e.bw) s.border = e.bw + 'px solid ' + e.bc;
    if (e.t === 'rect') { if (e.img && e.img.startsWith(location.origin + '/api/img/')) { s.backgroundImage = 'url(' + e.img + ')'; s.backgroundSize = 'cover'; s.backgroundPosition = 'center'; } return; }
    if (e.t === 'image') {
      if (e.src && (e.src.startsWith(location.origin + '/api/img/') || e.src === '{logo_url}')) { const im = h('img', { src: e.src === '{logo_url}' ? '/img/rex-logo.png' : e.src, alt: '', draggable: 'false' }); im.style.objectFit = e.fit === 'auto' ? 'contain' : e.fit === 'fill' ? 'fill' : 'cover'; n.append(im); }
      else n.append(h('div', { class: 'eb-ph' }, e.src ? 'Picture from the web (see Preview)' : 'Double-click to add a picture'));
      return;
    }
    const size = (dev === 'm' && e.m && e.m.size) || e.size;
    s.fontFamily = (FONT[e.font || D.font] || FONT.arial).css; s.fontSize = size + 'px'; s.lineHeight = (size * e.lh) + 'px'; s.color = e.color || (PAGE ? (e.t === 'button' ? 'var(--on-accent, #fff)' : (D.color || 'var(--ice)')) : D.color);
    s.fontWeight = e.bold ? '700' : '400'; s.fontStyle = e.italic ? 'italic' : 'normal'; s.textDecoration = e.underline ? 'underline' : 'none'; s.textTransform = e.upper ? 'uppercase' : 'none';
    s.letterSpacing = (e.ls || 0) + 'px'; s.textAlign = e.align; s.display = 'flex'; s.flexDirection = 'column'; s.justifyContent = e.va === 'middle' ? 'center' : e.va === 'bottom' ? 'flex-end' : 'flex-start';
    s.padding = (e.pad || 0) + 'px'; s.boxSizing = 'border-box';
    const inner = h('div', { class: 'eb-tx' }); inner.innerHTML = markup(e.t === 'button' ? e.label : e.text); inner.style.width = '100%';   // text is escaped by markup()
    n.append(inner);
  }

  const GUIDE = 5;
  function startDrag(ev, e, handle) {
    if (mode !== 'edit' || ev.button > 0) return;
    ev.stopPropagation(); ev.preventDefault();
    select(e.id, true);
    if (e.lock) return;
    if (dev === 'm') materialise();
    const b = boxOf(e), start = { x: ev.clientX, y: ev.clientY, box: Object.assign({}, b) }, others = D.els.filter((o) => o.id !== e.id && !o.hid).map((o) => boxOf(o));
    const w = W(); let moved = false, snapshot = JSON.stringify(D);
    const guides = h('div', { class: 'eb-guides' }); stage.append(guides);
    const move = (m) => {
      const dx = (m.clientX - start.x) / zoom, dy = (m.clientY - start.y) / zoom;
      if (!moved && Math.abs(dx) + Math.abs(dy) < 3) return; moved = true;
      let { x, y, w: bw, h: bh } = start.box;
      const gx = [0, w / 2, w], gy = [];
      others.forEach((o) => { gx.push(o.x, o.x + o.w / 2, o.x + o.w); gy.push(o.y, o.y + o.h / 2, o.y + o.h); });
      const snap = (v, list, size, edges) => { let best = null; list.forEach((g) => edges.forEach((off) => { const d2 = g - (v + off * size); if (Math.abs(d2) <= GUIDE && (best === null || Math.abs(d2) < Math.abs(best.d))) best = { d: d2, g }; })); return best; };
      const lines = [];
      if (handle === 'move') {
        x += dx; y += dy;
        const sx = snap(x, gx, bw, [0, 0.5, 1]); if (sx) { x += sx.d; lines.push(['v', sx.g]); }
        const sy = snap(y, gy, bh, [0, 0.5, 1]); if (sy) { y += sy.d; lines.push(['h', sy.g]); }
      } else {
        const mnw = 12;
        if (handle.includes('e')) { bw = Math.max(mnw, bw + dx); const s2 = snap(x + bw, gx, 0, [0]); if (s2) { bw += s2.d; lines.push(['v', s2.g]); } }
        if (handle.includes('s')) { bh = Math.max(mnw, bh + dy); const s2 = snap(y + bh, gy, 0, [0]); if (s2) { bh += s2.d; lines.push(['h', s2.g]); } }
        if (handle.includes('w')) { const nx = Math.min(x + bw - mnw, x + dx); const s2 = snap(nx, gx, 0, [0]); const fx = nx + (s2 ? s2.d : 0); bw = bw + (x - fx); x = fx; if (s2) lines.push(['v', s2.g]); }
        if (handle.includes('n')) { const ny = Math.min(y + bh - mnw, y + dy); const s2 = snap(ny, gy, 0, [0]); const fy = ny + (s2 ? s2.d : 0); bh = bh + (y - fy); y = fy; if (s2) lines.push(['h', s2.g]); }
      }
      x = Math.max(0, Math.min(x, w - 12)); y = Math.max(0, y); bw = Math.min(bw, w - x);
      Object.assign(b, { x: Math.round(x), y: Math.round(y), w: Math.round(bw), h: Math.round(bh) });
      const n = nodes[e.id]; n.style.left = b.x + 'px'; n.style.top = b.y + 'px'; n.style.width = b.w + 'px'; n.style.height = b.h + 'px';
      guides.replaceChildren(...lines.map(([k, g]) => { const l = h('i', { class: 'eb-g ' + k }); if (k === 'v') l.style.left = g + 'px'; else l.style.top = g + 'px'; return l; }));
      props();
    };
    const up = () => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); guides.remove();
      if (moved) { undo.push(snapshot); if (undo.length > 80) undo.shift(); redo.length = 0; dirty = true; syncBar(); paintCanvas(); props(); }
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  }
  stage.addEventListener('pointerdown', (ev) => { if (ev.target === stage || ev.target.classList.contains('eb-auto')) select(null); });
  stage.addEventListener('dblclick', (ev) => { const n = ev.target.closest('.eb-el'); if (!n) return; const e = el$(n.dataset.id); if (e && e.t === 'image') pickImage((url) => { edit(() => { e.src = url; }); }); else if (e && (e.t === 'text' || e.t === 'button')) { const f = right.querySelector('textarea, input[data-main]'); if (f) f.focus(); } });
  document.addEventListener('keydown', (ev) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((ev.target || {}).tagName || '') || (ev.target && ev.target.isContentEditable);
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z') { ev.preventDefault(); ev.shiftKey ? doRedo() : doUndo(); return; }
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'y') { ev.preventDefault(); doRedo(); return; }
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 's') { ev.preventDefault(); save(); return; }
    if (typing || !sel || mode !== 'edit') return;
    const e = el$(sel); if (!e) return;
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'd') { ev.preventDefault(); duplicate(e); return; }
    if (ev.key === 'Delete' || ev.key === 'Backspace') { ev.preventDefault(); remove(e); return; }
    const step = ev.shiftKey ? 10 : 1, k = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[ev.key];
    if (k && !e.lock) { ev.preventDefault(); edit(() => { if (dev === 'm') materialise(); const b = boxOf(e); b.x = Math.max(0, b.x + k[0]); b.y = Math.max(0, b.y + k[1]); }); }
  });

  /* ---------- edits */
  function edit(fn, keepFocus) { commit(); fn(); if (keepFocus) { paintCanvas(); layers(); } else paintAll(); }
  function select(id, soft) { sel = id; paintCanvas(); layers(); if (!soft || true) props(); if (id && tab !== 'layers' && tab !== 'add') tab = 'layers'; }
  function remove(e) { edit(() => { D.els = D.els.filter((x) => x.id !== e.id); sel = null; }); }
  function duplicate(e) { edit(() => { const c = clone(e); c.id = uid(); c.name = (e.name || e.t) + ' copy'; c.d.x += 16; c.d.y += 16; if (c.m) { c.m.x += 16; c.m.y += 16; } D.els.push(c); sel = c.id; }); }
  function add(e) { if (D.els.length >= 60) { toast('An email can have up to 60 elements.', 'bad'); return; } edit(() => { if (dev === 'm') { materialise(); } const top = Math.max(0, ...D.els.map((x) => (boxOf(x).y + boxOf(x).h))) + 20; if (dev === 'd') e.d.y = Math.max(e.d.y, top > 520 ? top : e.d.y); else { e.m = { x: Math.round((MOB - Math.min(e.d.w, MOB - 40)) / 2), y: top, w: Math.min(e.d.w, MOB - 40), h: e.d.h, hide: false }; } D.els.push(e); sel = e.id; }); }
  function order(e, dir) { const i = D.els.indexOf(e), j = Math.max(0, Math.min(D.els.length - 1, i + dir)); if (i === j) return; edit(() => { D.els.splice(i, 1); D.els.splice(j, 0, e); }); }

  /* ---------- image upload (resized in the browser so it fits the 400 KB limit) */
  function pickImage(cb) {
    const inp = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/gif', hidden: true });
    inp.onchange = async () => {
      const f = inp.files[0]; if (!f) return; status.textContent = 'Uploading picture…';
      try {
        let data = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
        if (f.size > 380 * 1024 || f.type === 'image/webp') {
          const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = data; });
          const sc = Math.min(1, 1400 / img.width), cv = document.createElement('canvas'); cv.width = Math.round(img.width * sc); cv.height = Math.round(img.height * sc);
          const cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height); cx.drawImage(img, 0, 0, cv.width, cv.height);
          for (let q = 0.9; q >= 0.4; q -= 0.1) { data = cv.toDataURL('image/jpeg', q); if (data.length * 0.75 < 390 * 1024) break; }
        }
        const r = await api('/api/upload', { method: 'POST', body: { data } }); status.textContent = ''; cb(r.url);
      } catch (e) { status.textContent = ''; toast(e.message || 'That picture could not be uploaded.', 'bad'); }
    };
    document.body.append(inp); inp.click(); setTimeout(() => inp.remove(), 60000);
  }

  /* ---------- left panel: add + layers + email settings */
  function layers() {
    const tabs = h('div', { class: 'eb-tabs' }, [['add', 'Add'], ['layers', 'Layers'], ['email', PAGE ? 'Page' : 'Email']].map(([k, n]) => h('button', { type: 'button', class: tab === k ? 'on' : '', onclick: () => { tab = k; layers(); } }, n)));
    let body;
    if (tab === 'add') {
      const tile = (ic, name, fn) => h('button', { type: 'button', class: 'eb-tile', onclick: fn }, h('span', {}, ic), name);
      body = h('div', { class: 'eb-pad' }, h('div', { class: 'eb-grid' },
        tile('T', 'Text', () => add(T(40, 40, 320, 80, 'Type your text here', { name: 'Text' }))),
        tile('H', 'Heading', () => add(T(40, 40, 520, 50, 'A big headline', { name: 'Heading', size: 30, bold: true, color: PAGE ? '' : '#0b1426', font: 'poppins' }))),
        tile('🖼', 'Picture', () => add({ id: uid(), t: 'image', name: 'Picture', d: { x: 40, y: 40, w: 300, h: 180 }, src: '', alt: '', fit: 'cover' })),
        tile('▭', 'Button', () => add(PAGE ? BTN(40, 40, 200, 'Click me', '/premium', { bg: '', color: '' }) : BTN(40, 40, 200, 'Click me', '{dashboard_url}'))),
        tile('◼', 'Box', () => add(RECT(0, 40, PAGE ? D.w : 600, 160, PAGE ? '#122240' : '#f3f6fc', { name: 'Box' }))),
        tile('—', 'Divider', () => add(RECT(40, 40, PAGE ? D.w - 80 : 520, 2, PAGE ? '#2d5190' : '#dfe6f3', { name: 'Divider' })))),
        h('p', { class: 'eb-help' }, 'Drag things anywhere on the page. A Box can sit behind other things to make a coloured banner. Variables like {first_name} fill in per person.'));
    } else if (tab === 'layers') {
      body = h('div', { class: 'eb-pad' }, D.els.length ? [...D.els].reverse().map((e) => h('div', { class: 'eb-layer' + (e.id === sel ? ' on' : ''), onclick: () => select(e.id) },
        h('span', { class: 'ic' }, { text: 'T', image: '🖼', button: '▭', rect: '◼' }[e.t]), h('span', { class: 'nm' }, e.name || e.t),
        h('button', { type: 'button', class: 'eb-mini', title: 'Hide', 'aria-label': 'Hide', onclick: (ev) => { ev.stopPropagation(); edit(() => { if (dev === 'm') { materialise(); e.m.hide = !e.m.hide; } else e.hid = !e.hid; }); } }, ((dev === 'm' && e.m ? e.m.hide : e.hid) ? '◌' : '●')),
        h('button', { type: 'button', class: 'eb-mini', title: 'Lock', 'aria-label': 'Lock', onclick: (ev) => { ev.stopPropagation(); edit(() => { e.lock = !e.lock; }); } }, e.lock ? '🔒' : '🔓'))) : h('p', { class: 'eb-help' }, 'Nothing here yet. Use Add.'));
    } else {
      body = PAGE ? pagePanel() : emailPanel();
    }
    left.replaceChildren(tabs, body);
  }
  const F = (label, el) => h('label', { class: 'eb-f' }, h('span', {}, label), el);
  function colorIn(get, set, opts) {
    const o = opts || {}; const v = get();
    const c = h('input', { type: 'color', value: /^#[0-9a-f]{6}$/i.test(v) ? v : (o.fallback || '#ffffff') });
    const t = h('input', { type: 'text', class: 'hex', value: v || '', maxlength: 9, placeholder: o.none || 'none' });
    c.oninput = () => { t.value = c.value; set(c.value, true); }; c.onchange = () => set(c.value);
    t.onchange = () => { const x = t.value.trim(); if (!x || /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(x) || x === 'transparent') { set(x); if (/^#[0-9a-f]{6}$/i.test(x)) c.value = x; } else toast('Use a colour like #2f8cff', 'bad'); };
    return h('div', { class: 'eb-col' }, c, t);
  }
  const numIn = (get, set, min, max, step) => { const i = h('input', { type: 'number', value: get(), min, max, step: step || 1 }); i.onchange = () => { const n = Math.max(min, Math.min(max, Number(i.value))); if (!Number.isNaN(n)) set(n); }; return i; };
  const sel2 = (opts, get, set) => { const s = h('select', {}, opts.map(([v, n]) => h('option', { value: v }, n))); s.value = get(); s.onchange = () => set(s.value); return s; };
  const tog = (label, get, set) => h('button', { type: 'button', class: 'eb-tg' + (get() ? ' on' : ''), 'aria-pressed': String(!!get()), title: label, onclick: () => set(!get()) }, label);

  function emailPanel() {
    const wr = h('div', { class: 'eb-pad' });
    const subj = h('input', { type: 'text', maxlength: 150, value: M.subject, placeholder: 'Subject line, e.g. Welcome to Rex, {first_name}!', oninput: (e) => { M.subject = e.target.value; dirty = true; syncBar(); } });
    const pre = h('input', { type: 'text', maxlength: 160, value: D.pre, placeholder: 'Short text shown next to the subject', oninput: (e) => { D.pre = e.target.value; dirty = true; syncBar(); } });
    wr.append(h('h4', {}, 'Message'), F('Subject', subj), F('Preview text', pre),
      h('p', { class: 'eb-help' }, 'Who gets this and when it is sent is set with the Automation button at the top.'),
      h('h4', {}, 'Look'),
      F('Page background', colorIn(() => D.bg, (v, live) => { D.bg = v; live ? 0 : (dirty = true); }, { fallback: '#eef2f9' })), F('Email background', colorIn(() => D.page, (v) => edit(() => { D.page = v; }, true), { fallback: '#ffffff' })),
      F('Default font', sel2(meta.fonts.map((f) => [f.id, f.label]), () => D.font, (v) => edit(() => { D.font = v; }))), F('Default text colour', colorIn(() => D.color, (v) => edit(() => { D.color = v; }, true))),
      F('Link colour', colorIn(() => D.link, (v) => edit(() => { D.link = v; }, true))), F('Width (px)', numIn(() => D.w, (v) => edit(() => { D.w = v; }), 480, 700, 10)),
      F('Corner roundness', numIn(() => D.radius, (v) => edit(() => { D.radius = v; }, true), 0, 40)), F('Space around', numIn(() => D.outer, (v) => edit(() => { D.outer = v; }), 0, 60)),
      F('Dark mode', sel2([['auto', 'Automatic (recommended)'], ['off', 'Keep my colours as they are']], () => D.dark || 'auto', (v) => edit(() => { D.dark = v; }))),
      h('p', { class: 'eb-help' }, 'Phones and apps in dark mode change an email\'s colours. Automatic gives Apple Mail and similar apps a good dark version. Use the Light/Dark switch in Preview to see it. Gmail does its own conversion, which no email can fully control.'),
      h('p', { class: 'eb-help' }, 'To add an unsubscribe link, type [Unsubscribe]({unsubscribe_url}) or [Email preferences]({unsubscribe_link}) in any text, or point a button at them.'));
    return wr;
  }

  /* ---------- right panel: properties of the selected element */
  function props() {
    const e = sel ? el$(sel) : null;
    if (!e) { right.replaceChildren(h('div', { class: 'eb-pad' }, h('h4', {}, 'Nothing selected'), h('p', { class: 'eb-help' }, 'Click anything on the page to change it. Drag to move, pull the dots to resize, arrow keys to nudge (Shift for bigger steps).'),
      dev === 'm' ? h('button', { type: 'button', class: 'eb-ghost', onclick: () => edit(() => { D.els.forEach((x) => { delete x.m; }); }) }, 'Reset phone layout to automatic') : null)); return; }
    const b = boxOf(e), live = (fn) => (v) => { commit(); fn(v); paintCanvas(); layers(); };
    const wr = h('div', { class: 'eb-pad' });
    const name = h('input', { type: 'text', value: e.name || '', maxlength: 40, onchange: (ev) => edit(() => { e.name = ev.target.value; }, true) });
    wr.append(h('div', { class: 'eb-ph-row' }, h('h4', {}, { text: 'Text', image: 'Picture', button: 'Button', rect: 'Box' }[e.t]),
      h('span', { class: 'eb-acts' }, h('button', { type: 'button', class: 'eb-mini', title: 'Duplicate', onclick: () => duplicate(e) }, '⧉'), h('button', { type: 'button', class: 'eb-mini', title: 'Bring forward', onclick: () => order(e, 1) }, '▲'),
        h('button', { type: 'button', class: 'eb-mini', title: 'Send back', onclick: () => order(e, -1) }, '▼'), h('button', { type: 'button', class: 'eb-mini bad', title: 'Delete', onclick: () => remove(e) }, '🗑'))), F('Name', name));
    const setBox = (k) => (v) => edit(() => { if (dev === 'm') materialise(); boxOf(e)[k] = v; }, true);
    wr.append(h('div', { class: 'eb-4' }, F('X', numIn(() => Math.round(b.x), setBox('x'), -50, 700)), F('Y', numIn(() => Math.round(b.y), setBox('y'), 0, 6000)), F('Width', numIn(() => Math.round(b.w), setBox('w'), 8, 700)), F('Height', numIn(() => Math.round(b.h), setBox('h'), 4, 3000))));
    if (e.t === 'text' || e.t === 'button') {
      const key = e.t === 'text' ? 'text' : 'label';
      const ta = h('textarea', { rows: e.t === 'text' ? 5 : 2, maxlength: 4000, 'data-main': '1', oninput: (ev) => { e[key] = ev.target.value; dirty = true; syncBar(); if (nodes[e.id]) { nodes[e.id].replaceChildren(); fillNode(nodes[e.id], e, b); if (e.id === sel && !e.lock) paintCanvas(); } }, onchange: () => { commit(); } }, e[key]);
      const wrapSel = (a, z) => () => { const s = ta.selectionStart, t = ta.selectionEnd, v = ta.value; ta.value = v.slice(0, s) + a + v.slice(s, t) + z + v.slice(t); ta.dispatchEvent(new Event('input')); ta.focus(); };
      wr.append(F(e.t === 'text' ? 'Text' : 'Label', ta), e.t === 'text' ? h('div', { class: 'eb-tgs' }, h('button', { type: 'button', class: 'eb-tg', onclick: wrapSel('**', '**') }, 'B'), h('button', { type: 'button', class: 'eb-tg', onclick: wrapSel('*', '*') }, 'I'),
        h('button', { type: 'button', class: 'eb-tg', onclick: wrapSel('[', '](https://)') }, 'Link'), sel2([['', 'Insert variable…'], ...meta.variables.filter((v) => v !== 'unsubscribe_url').map((v) => ['{' + v + '}', '{' + v + '}'])], () => '', (v) => { if (v) wrapSel(v, '')(); })) : null);
      if (e.t === 'button') wr.append(F('Link (https://…)', h('input', { type: 'text', value: e.url || '', maxlength: 480, placeholder: 'https://… or {dashboard_url}', onchange: (ev) => edit(() => { e.url = ev.target.value.trim(); }, true) })));
      wr.append(h('h4', {}, 'Text style'), F('Font', sel2([['', 'Email default'], ...meta.fonts.map((f) => [f.id, f.label])], () => e.font || '', (v) => edit(() => { e.font = v; }, true))),
        h('div', { class: 'eb-4' }, F(dev === 'm' ? 'Size (phone)' : 'Size', numIn(() => (dev === 'm' && e.m && e.m.size) || e.size, (v) => edit(() => { if (dev === 'm') { materialise(); e.m.size = v; } else e.size = v; }, true), 8, 120)),
          F('Line height', numIn(() => e.lh || 1.5, (v) => edit(() => { e.lh = v; }, true), 0.8, 3, 0.1)), F('Letter gap', numIn(() => e.ls || 0, (v) => edit(() => { e.ls = v; }, true), -2, 20, 0.5)), F('Padding', numIn(() => e.pad || 0, (v) => edit(() => { e.pad = v; }, true), 0, 120))),
        F('Colour', colorIn(() => e.color || '', (v) => edit(() => { e.color = v; }, true), { fallback: D.color, none: 'default' })),
        h('div', { class: 'eb-tgs' }, tog('B', () => e.bold, (v) => edit(() => { e.bold = v; }, true) || props()), tog('I', () => e.italic, (v) => edit(() => { e.italic = v; }, true) || props()), tog('U', () => e.underline, (v) => edit(() => { e.underline = v; }, true) || props()), tog('AA', () => e.upper, (v) => edit(() => { e.upper = v; }, true) || props())),
        h('div', { class: 'eb-tgs' }, ['left', 'center', 'right'].map((a) => tog({ left: '⇤', center: '↔', right: '⇥' }[a], () => e.align === a, () => { edit(() => { e.align = a; }, true); props(); })), ['top', 'middle', 'bottom'].map((a) => tog({ top: '⤒', middle: '⇕', bottom: '⤓' }[a], () => e.va === a, () => { edit(() => { e.va = a; }, true); props(); }))));
    }
    if (e.t === 'image') {
      wr.append(h('button', { type: 'button', class: 'eb-primary', onclick: () => pickImage((url) => edit(() => { e.src = url; })) }, e.src ? 'Replace picture' : 'Upload a picture'),
        F('…or a web address', h('input', { type: 'text', value: e.src && !e.src.startsWith(location.origin) ? e.src : '', placeholder: 'https://…', onchange: (ev) => edit(() => { e.src = ev.target.value.trim(); }) })),
        F('Alt text (for blocked images)', h('input', { type: 'text', value: e.alt || '', maxlength: 150, onchange: (ev) => edit(() => { e.alt = ev.target.value; }, true) })),
        F('Opens when clicked', h('input', { type: 'text', value: e.url || '', placeholder: 'https://…', onchange: (ev) => edit(() => { e.url = ev.target.value.trim(); }, true) })),
        F('Fit', sel2([['cover', 'Fill (crop)'], ['fill', 'Stretch'], ['auto', 'Keep proportions']], () => e.fit, (v) => edit(() => { e.fit = v; }))));
    }
    if (e.t === 'rect') wr.append(h('button', { type: 'button', class: 'eb-ghost', onclick: () => pickImage((url) => edit(() => { e.img = url; })) }, e.img ? 'Replace background picture' : 'Add a background picture'), e.img ? h('button', { type: 'button', class: 'eb-ghost', onclick: () => edit(() => { e.img = ''; }) }, 'Remove background picture') : null);
    wr.append(h('h4', {}, 'Box'),
      F('Background', colorIn(() => e.bg || '', (v) => edit(() => { e.bg = v; }, true), { fallback: '#ffffff' })),
      h('div', { class: 'eb-4' }, F('Corners', numIn(() => e.radius || 0, (v) => edit(() => { e.radius = v; }, true), 0, 300)), F('Border', numIn(() => e.bw || 0, (v) => edit(() => { e.bw = v; }, true), 0, 16)), F('Border colour', colorIn(() => e.bc || '#000000', (v) => edit(() => { e.bc = v; }, true), { fallback: '#000000' }))),
      D.dark === 'off' ? null : h('h4', {}, 'Dark mode colours (optional)'),
      D.dark === 'off' ? null : F('Background in dark mode', colorIn(() => e.dbg || '', (v) => edit(() => { e.dbg = v; }, true), { fallback: '#111111', none: 'automatic' })),
      D.dark === 'off' || e.t === 'rect' || e.t === 'image' ? null : F('Text in dark mode', colorIn(() => e.dcolor || '', (v) => edit(() => { e.dcolor = v; }, true), { fallback: '#ffffff', none: 'automatic' })),
      dev === 'm' ? h('div', { class: 'eb-f' }, h('span', {}, 'Hide on phones'), h('button', { type: 'button', class: 'rocker', role: 'switch', 'aria-checked': String(!!(e.m && e.m.hide)), onclick: () => edit(() => { materialise(); e.m.hide = !e.m.hide; }) })) : null);
    right.replaceChildren(wr);
  }

  /* ---------- pages: theme preview, link, side panel */
  const pageUrl = () => location.origin + '/pages/' + pageName;
  function pageTheme() {
    const wrap = h('div', { class: 'eb-segs', title: 'Preview this page in each website theme' });
    [['normal', 'Normal'], ['christmas', 'Christmas'], ['halloween', 'Halloween']].forEach(([k, n]) => wrap.append(h('button', { type: 'button', class: 'eb-seg' + (PT === k ? ' on' : ''), onclick: () => { PT = k; [...wrap.children].forEach((b, i) => b.classList.toggle('on', ['normal', 'christmas', 'halloween'][i] === k)); paintCanvas(); if (mode === 'preview') showPreview(); } }, n)));
    return wrap;
  }
  async function copyLink() { try { await navigator.clipboard.writeText(pageUrl()); toast('Link copied', 'good'); } catch (e) { rexDialog.alert('Page link', pageUrl()); } }
  function pagePanel() {
    const wr = h('div', { class: 'eb-pad' });
    wr.append(h('h4', {}, 'Page'), h('p', { class: 'eb-help' }, 'Link: ' + pageUrl().replace(location.origin, '') + (dirty && !tplId ? ' (saved on first save)' : '')),
      h('button', { type: 'button', class: 'eb-ghost', onclick: copyLink }, 'Copy link'),
      F('Navigation bar', sel2([['show', 'Show the top bar'], ['hide', 'Hide it (clean page)']], () => (pageHideNav ? 'hide' : 'show'), (v) => { pageHideNav = v === 'hide'; dirty = true; syncBar(); paintCanvas(); })),
      h('h4', {}, 'Look'),
      h('p', { class: 'eb-help' }, 'Leave colours empty to follow the website theme. Use the Normal / Christmas / Halloween switch at the top to see each one.'),
      F('Page colour (optional panel behind everything)', colorIn(() => D.page, (v) => edit(() => { D.page = v; }, true), { fallback: '#0c1729', none: 'theme' })),
      F('Default text colour', colorIn(() => D.color, (v) => edit(() => { D.color = v; }, true), { none: 'theme' })), F('Link colour', colorIn(() => D.link, (v) => edit(() => { D.link = v; }, true), { none: 'theme' })),
      F('Default font', sel2(meta.fonts.map((f) => [f.id, f.label]), () => D.font, (v) => edit(() => { D.font = v; }))),
      F('Width (px)', numIn(() => D.w, (v) => edit(() => { D.w = v; }), 320, 1100, 10)), F('Corner roundness (page panel)', numIn(() => D.radius, (v) => edit(() => { D.radius = v; }, true), 0, 40)),
      h('p', { class: 'eb-help' }, 'Links: use https://… or a page on this site like /premium. Pages open from their link only, so nothing on the site points to them.'));
    return wr;
  }

  /* ---------- preview, save, test */
  let pdark = false;
  async function showPreview() {
    if (PAGE) {
      const fonts = Object.fromEntries(meta.fonts.map((f) => [f.id, f]));
      const bar = pageHideNav ? h('p', { class: 'eb-help' }, 'The navigation bar is hidden on this page.') : h('div', { class: 'pv-nav' }, 'Rex   Home · Commands · Premium · Live · Support   (the real navigation bar shows here)');
      previewBox.replaceChildren(h('div', { class: 'pt-' + PT + ' pv-site' }, bar, h('div', { class: 'pv-body' }, window.rexRenderPage(D, { fonts, mobile: dev === 'm' }))));
      return;
    }
    previewBox.replaceChildren(h('p', { class: 'eb-help' }, 'Building the real email…'));
    try {
      const r = await api('/api/owner/email/render', { method: 'POST', body: { design: D, subject: M.subject, dark: pdark } });
      const fr = h('iframe', { class: 'eb-frame', title: 'Email preview', src: r.url }); fr.style.width = (dev === 'd' ? D.w + 40 : MOB + 24) + 'px';
      fr.style.maxWidth = '100%';
      const lt = h('button', { type: 'button', class: 'eb-seg' + (pdark ? '' : ' on'), onclick: () => { pdark = false; showPreview(); } }, '☀ Light'), dk = h('button', { type: 'button', class: 'eb-seg' + (pdark ? ' on' : ''), onclick: () => { pdark = true; showPreview(); } }, '☾ Dark');
      previewBox.replaceChildren(h('div', { class: 'eb-prevbar' }, h('div', { class: 'eb-segs' }, lt, dk), h('span', { class: 'eb-help' }, 'The exact email that gets sent. Desktop / Phone switch is at the top. Dark shows how it looks in dark mode (' + (D.dark === 'off' ? 'your colours are kept as they are' : 'automatic colours') + ').')),
        r.checks.length ? h('ul', { class: 'eb-checks' }, r.checks.map((c) => h('li', {}, c))) : null, h('div', { class: 'eb-frame-wrap' }, fr));
    } catch (e) { previewBox.replaceChildren(h('p', { class: 'eb-help bad' }, e.message)); }
  }
  async function save() {
    if (!M.name.trim()) { toast(PAGE ? 'Give the page a title first.' : 'Give the email a name first.', 'bad'); nameIn.focus(); return; }
    bSave.disabled = true; status.textContent = 'Saving…';
    if (PAGE) {
      try { await api('/api/owner/pages/' + pageName, { method: 'PUT', body: { title: M.name, hide_nav: pageHideNav, design: D } }); tplId = pageName; dirty = false; status.textContent = ''; toast('Saved', 'good'); } catch (e) { status.textContent = ''; toast(e.message, 'bad'); }
      bSave.disabled = false; syncBar(); return;
    }
    try {
      const r = await api('/api/owner/email/templates/' + (tplId || 'new'), { method: 'PUT', body: Object.assign({}, M, { design: D }) });
      tplId = r.id; history.replaceState(null, '', '/email-builder?id=' + tplId); dirty = false; status.textContent = ''; toast('Saved', 'good');
    } catch (e) { status.textContent = ''; toast(e.message, 'bad'); }
    bSave.disabled = false; syncBar();
  }
  async function testSend() {
    const to = await rexDialog.prompt('Send a test', 'Where should the test go? It shows sample values for the name and links.', { ok: 'Send test', input: { placeholder: 'you@example.com', maxlength: 120 } });
    if (!to) return;
    status.textContent = 'Sending test…';
    try { await api('/api/owner/email/test', { method: 'POST', body: { to, design: D, subject: M.subject } }); toast('Test sent to ' + to, 'good'); } catch (e) { toast(e.message, 'bad'); }
    status.textContent = '';
  }

  /* ---------- automation: when it sends, to whom, and at what time */
  function modal(title, body, actions) {
    const m = h('div', { class: 'eb-modal' }, h('div', { class: 'eb-card' }, h('h2', {}, title), body, h('div', { class: 'eb-row' }, actions(() => m.remove()))));
    m.addEventListener('pointerdown', (e) => { if (e.target === m) m.remove(); });
    document.body.append(m); return m;
  }
  const tagName = (id) => ((meta.tags.find((t) => t.id === id) || {}).name) || id;
  const sendToLabel = (v) => v === 'target' ? 'only the person it happens to' : v === 'everyone' ? 'everyone who has not unsubscribed' : v === 'essential' ? 'essential (even if they turned a tag off)' : 'people with the tag “' + tagName(v.slice(4)) + '”';
  function automation() {
    const c = Object.assign({}, M);
    const sum = h('p', { class: 'eb-help eb-sum' });
    const en = h('button', { type: 'button', class: 'rocker', role: 'switch', onclick: () => { c.enabled = !c.enabled; draw(); } });
    const when = sel2(Object.entries(meta.events), () => c.send_when, (v) => { c.send_when = v; if (v === 'manual') c.enabled = false; draw(); });
    const toBox = h('div', {});
    const drawTo = () => { const auto = c.send_when !== 'manual'; if (auto && c.send_to === 'everyone') c.send_to = 'target'; if (!auto && c.send_to === 'target') c.send_to = 'everyone';
      toBox.replaceChildren(sel2([...(auto ? [['target', 'Only the person it happens to']] : [['everyone', 'Everyone (unless unsubscribed)']]), ...meta.tags.map((t) => ['tag:' + t.id, (auto ? 'The person, only if they kept tag: ' : 'People with tag: ') + t.name]), ['essential', auto ? 'The person, even if they turned tags off (essential)' : 'Essential: everyone (ignores tags)']], () => c.send_to, (v) => { c.send_to = v; draw(); })); };
    const at = sel2(Object.entries(meta.send_at), () => c.when_at, (v) => { c.when_at = v; draw(); });
    const tm = h('input', { type: 'time', value: c.at_time, onchange: (e) => { c.at_time = e.target.value || '09:00'; draw(); } });
    const note = h('p', { class: 'eb-help' });
    function draw() {
      drawTo();
      const auto = c.send_when !== 'manual', now = c.send_when === 'data_removed' || c.send_when === 'bot_leaves_server';
      en.setAttribute('aria-checked', String(!!c.enabled)); en.disabled = !auto; at.disabled = !auto || now; tm.hidden = c.when_at !== 'time' || !auto || now;
      note.textContent = now ? 'This one is always sent immediately, because the person will not be around later.' : (c.when_at === 'online' && auto ? 'It waits until they next open the website while logged in.' : (c.when_at === 'time' && auto ? 'Sent shortly after that time (UTC) once the event has happened.' : ''));
      sum.textContent = auto ? (c.enabled ? 'On: ' : 'Off (paused): ') + meta.events[c.send_when] + ', send to ' + sendToLabel(c.send_to) + ', ' + (now ? 'immediately' : c.when_at === 'time' ? 'at ' + c.at_time + ' UTC' : (meta.send_at[c.when_at] || '').toLowerCase()) + '.'
        : 'This email only goes out when you press Send on the Email tab in Owner mode. Pick an event above to make it automatic.';
    }
    draw();
    modal('Automation', h('div', { class: 'eb-pad' }, F('When', when), F('Send to', toBox), F('At', at), tm, note, h('div', { class: 'eb-f' }, h('span', {}, 'Send automatically'), en), sum,
      h('p', { class: 'eb-help' }, 'Needs Gmail connected. People with no email on file are skipped, and nobody gets more than the daily limit.')), (close) => [
      h('button', { type: 'button', class: 'eb-ghost', onclick: close }, 'Cancel'),
      h('button', { type: 'button', class: 'eb-save', onclick: () => { Object.assign(M, c); dirty = true; syncBar(); close(); toast('Automation updated. Remember to Save.', 'good'); } }, 'Done')]);
  }

  /* ---------- generate a ready-to-edit email for a tag (e.g. bug fixes) */
  function generate(tagId, notes, themeId) {
    const tag = meta.tags.find((t) => t.id === tagId) || { id: tagId, name: tagId };
    const th = THEMES.find((x) => x.id === themeId) || THEMES[0];
    const look = { bug_fixes: ['Bug fixes in Rex', 'We squashed some bugs. Here is what is fixed:'], new_features: ['New in Rex', 'Rex just got better. Here is what is new:'], announcements: ['News from Rex', 'We have some news to share:'] }[tagId] || [tag.name + ' from Rex', 'Here is the latest:'];
    const items = notes.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 12);
    const list = items.length ? items.map((x) => '• ' + x).join('\n') : '• First thing\n• Second thing';
    const d = themed(th, { title: look[0], sub: tag.name, body: 'Hi {first_name},\n\n' + look[1], box: list });
    return { d, subject: look[0], name: tag.name + ' – ' + new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short' }), send_to: 'tag:' + tag.id };
  }
  function askNotes(tagId) {
    return new Promise((resolve) => {
      const ta = h('textarea', { rows: 6, placeholder: 'One item per line, e.g.\nFixed the welcome card not showing\nFixed ticket buttons on mobile', maxlength: 1500 });
      const th = sel2(THEMES.map((x) => [x.id, x.label]), () => 'dark', () => {}); th.value = 'dark';
      modal('Generate a “' + tagName(tagId) + '” email', h('div', { class: 'eb-pad' }, h('p', { class: 'eb-help' }, 'What changed? You can leave this empty and write it in the builder. It is sent to people who kept the “' + tagName(tagId) + '” tag on.'), ta, F('Theme', th)),
        (close) => [h('button', { type: 'button', class: 'eb-ghost', onclick: () => { close(); resolve(null); } }, 'Cancel'), h('button', { type: 'button', class: 'eb-save', onclick: () => { const v = th.value; close(); resolve({ notes: ta.value, theme: v }); } }, 'Generate')]);
    });
  }

  function paintAll() { paintCanvas(); layers(); props(); syncBar(); }

  /* ---------- load */
  const PAGE_PRESETS = {
    blank: { label: 'Blank page', desc: 'Start from nothing.', make: () => { const d = base(); d.els = [T(60, 60, 740, 70, 'Page title', { name: 'Heading', size: 40, bold: true, font: 'poppins' }), T(60, 150, 740, 120, 'Write your text here.', { size: 18 })]; return d; } },
    learn: { label: 'Learn more', desc: 'Headline, intro, three info boxes and a button.', make: () => { const d = base(); const card = (x, t, tx) => [RECT(x, 300, 240, 190, '#0c1729', { name: 'Card', radius: 14, bw: 1, bc: '#2d5190' }), T(x + 20, 320, 200, 36, t, { name: 'Card title', size: 20, bold: true, font: 'poppins' }), T(x + 20, 366, 200, 110, tx, { name: 'Card text', size: 15 })];
      d.els = [T(60, 60, 740, 60, 'Learn more about Rex', { name: 'Heading', size: 42, bold: true, font: 'poppins' }), T(60, 140, 740, 120, 'A short introduction goes here. Say what this is and who it is for, in a sentence or two.', { size: 19, lh: 1.6 }),
        ...card(60, 'First point', 'Explain the first thing here.'), ...card(310, 'Second point', 'Explain the second thing here.'), ...card(560, 'Third point', 'Explain the third thing here.'),
        BTN(60, 530, 240, 'Add Rex to your server', '/dashboard', { bg: '', color: '' })]; return d; } },
    notice: { label: 'Announcement', desc: 'A big banner and a short message.', make: () => { const d = base(); d.els = [RECT(0, 0, 860, 220, '#0c1729', { name: 'Banner' }), T(60, 70, 740, 70, 'Big news', { name: 'Heading', size: 46, bold: true, font: 'poppins' }), T(60, 250, 740, 160, 'Tell people what changed, when it happens and what they need to do.', { size: 19, lh: 1.6 })]; return d; } },
  };
  async function pickStartPage() {
    return new Promise((resolve) => {
      const nameBox = h('input', { type: 'text', maxlength: 40, placeholder: 'page-name (letters, numbers, dashes)', value: pageName }), err = h('p', { class: 'eb-help bad' });
      const pick = (k) => () => { const n = nameBox.value.trim().toLowerCase(); if (!/^[a-z0-9][a-z0-9-]{1,39}$/.test(n)) { err.textContent = 'Use 2 to 40 letters, numbers or dashes, e.g. learn-more.'; nameBox.focus(); return; } pageName = n; m.remove(); resolve(k); };
      const m = h('div', { class: 'eb-modal' }, h('div', { class: 'eb-card eb-wide' }, h('h2', {}, 'New page'), h('p', { class: 'eb-help' }, 'The page will live at ' + location.origin + '/pages/…'),
        h('label', { class: 'eb-f' }, h('span', {}, 'Page name (the end of the link)'), nameBox), err,
        h('h4', { class: 'eb-h4' }, 'Start from'), h('div', { class: 'eb-starts' }, Object.entries(PAGE_PRESETS).map(([k, p]) => h('button', { type: 'button', class: 'eb-start', onclick: pick(k) }, h('b', {}, p.label), h('span', {}, p.desc)))),
        h('button', { type: 'button', class: 'eb-ghost', onclick: () => { location.href = BACK; } }, '← Back')));
      document.body.append(m); nameBox.focus();
    });
  }
  async function pickStart() {
    return new Promise((resolve) => {
      const pick = (k) => () => { m.remove(); resolve(k); };
      const sw = (th) => { const a = h('div', { class: 'eb-sw' }), b = h('div', { class: 'eb-sw-h' }, h('span', { class: 'eb-sw-t' }, 'Aa'), th.decor[0] ? h('span', {}, th.decor[0]) : null), c = h('div', { class: 'eb-sw-b' }), bt = h('i', { class: 'eb-sw-btn' });
        a.style.background = th.bg; a.style.borderRadius = Math.min(th.radius, 18) + 'px'; b.style.background = th.head; b.style.color = th.title; b.querySelector('.eb-sw-t').style.fontFamily = (FONT[th.font] || FONT.arial).css; c.style.background = th.card; bt.style.background = th.btn; c.append(bt); a.append(b, c); return a; };
      const m = h('div', { class: 'eb-modal' }, h('div', { class: 'eb-card eb-wide' }, h('h2', {}, 'Start a new email'), h('p', { class: 'eb-help' }, 'Pick a theme. Everything in it (layout, colours, fonts, logo) can be changed afterwards.'),
        h('div', { class: 'eb-themes' }, THEMES.map((th) => h('button', { type: 'button', class: 'eb-theme', onclick: pick('theme:' + th.id) }, sw(th), h('b', {}, th.label), h('span', {}, th.desc)))),
        h('h4', { class: 'eb-h4' }, 'Ready-made emails'), h('div', { class: 'eb-starts' }, Object.entries(PRESETS).map(([k, p]) => h('button', { type: 'button', class: 'eb-start', onclick: pick(k) }, h('b', {}, p.label), h('span', {}, p.desc)))),
        h('h4', { class: 'eb-h4' }, 'Or generate one for a tag'), h('div', { class: 'eb-starts' }, meta.tags.map((t) => h('button', { type: 'button', class: 'eb-start', onclick: pick('gen:' + t.id) }, h('b', {}, 'Generate: ' + t.name), h('span', {}, 'A ready-to-edit email for people with this tag.')))),
        h('button', { type: 'button', class: 'eb-ghost', onclick: () => { location.href = '/owner#email'; } }, '← Back')));
      document.body.append(m);
    });
  }
  if (PAGE) {
    if (pageName) {
      try { const p = await api('/api/owner/pages/' + pageName); D = p.design; M.name = p.title; pageHideNav = !!p.hide_nav; tplId = pageName; }
      catch (e) { app.replaceChildren(stateScreen('Page not found', e.message, h('a', { class: 'btn', href: BACK }, 'Back'))); return; }
    } else {
      const k = await pickStartPage(); D = PAGE_PRESETS[k].make(); M.name = k === 'blank' ? pageName : PAGE_PRESETS[k].label; dirty = true; history.replaceState(null, '', '/page-builder?name=' + pageName);
    }
  } else if (tplId) {
    try { const t = await api('/api/owner/email/templates/' + tplId); D = t.design; M = { name: t.name, subject: t.subject, send_to: t.send_to, send_when: t.send_when, when_at: t.when_at || 'now', at_time: t.at_time || '09:00', enabled: !!t.enabled }; if (!/^(everyone|essential|target|tag:.+)$/.test(M.send_to)) M.send_to = 'everyone'; if (M.send_when !== 'manual' && M.send_to === 'everyone') M.send_to = 'target'; }
    catch (e) { app.replaceChildren(stateScreen('Email not found', e.message, h('a', { class: 'btn', href: '/owner#email' }, 'Back'))); return; }
  } else {
    let k = qs.get('gen') ? 'gen:' + qs.get('gen') : await pickStart();
    if (k.startsWith('gen:')) {
      const ans = await askNotes(k.slice(4));
      if (ans === null) { location.href = '/owner#email'; return; }
      const g = generate(k.slice(4), ans.notes, ans.theme); D = g.d; M.subject = g.subject; M.name = g.name; M.send_to = g.send_to; dirty = true;
    } else if (k.startsWith('theme:')) {
      const th = THEMES.find((x) => x.id === k.slice(6)); D = themed(th); M.name = th.label; M.subject = ''; dirty = true;
    } else {
      const p = PRESETS[k].make(); D = p.d; M.subject = p.subject; M.name = k === 'blank' ? '' : PRESETS[k].label; dirty = true;
      if (k === 'welcome') { M.send_when = 'first_login'; M.send_to = 'target'; }
      if (k === 'notice') { M.send_when = 'server_blacklisted'; M.send_to = 'essential'; }
    }
  }
  nameIn.value = M.name; tab = 'add'; paintAll();
  new ResizeObserver(() => { if (!canvasWrap.clientWidth) return; const c = canvasWrap.clientWidth - 48, need = (dev === 'd' ? D.w : MOB); if (c < need * zoom && zoom === 1) setZoom(Math.max(0.4, Math.floor(c / need * 10) / 10)); }).observe(canvasWrap);
})();
