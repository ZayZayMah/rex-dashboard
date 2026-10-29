'use strict';
/* Full-page email builder: free placement on a canvas, desktop + phone layouts, real-render preview. */
(async function () {
  const app = document.getElementById('app');
  const me = await loadMe();
  if (!me || !me.is_owner || !me.owner_mode) { location.replace('/owner#email'); return; }
  const qs = new URLSearchParams(location.search);
  let tplId = qs.get('id') || '';
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

  const base = () => ({ v: 1, w: 600, bg: '#eef2f9', page: '#ffffff', font: 'arial', color: '#33415c', link: '#2f8cff', outer: 24, radius: 16, pre: '', footer: { text: "You're getting this email from Rex.", color: '#6b7a99', size: 12, align: 'center' }, els: [] });
  const T = (x, y, w, h2, text, o) => Object.assign({ id: uid(), t: 'text', name: 'Text', d: { x, y, w, h: h2 }, text, size: 16, color: '', align: 'left', va: 'top', lh: 1.5, ls: 0 }, o || {});
  const BTN = (x, y, w, label, url, o) => Object.assign({ id: uid(), t: 'button', name: 'Button', d: { x, y, w, h: 48 }, label, url: url || '{dashboard_url}', bg: '#2f8cff', color: '#ffffff', radius: 12, size: 16, bold: true, align: 'center', va: 'middle', lh: 1.5, ls: 0 }, o || {});
  const RECT = (x, y, w, h2, bg, o) => Object.assign({ id: uid(), t: 'rect', name: 'Box', d: { x, y, w, h: h2 }, bg, radius: 0, lh: 1.5 }, o || {});
  const PRESETS = {
    blank: { label: 'Blank', desc: 'Start from nothing.', make: () => { const d = base(); d.els = [T(40, 40, 520, 120, 'Hi {first_name},\n\nWrite your message here.')]; return { d, subject: '' }; } },
    welcome: { label: 'Welcome', desc: 'A friendly hello with a button.', make: () => { const d = base(); d.els = [
      RECT(0, 0, 600, 190, '#0b1426', { name: 'Header' }), T(40, 56, 520, 48, 'Welcome to Rex', { size: 34, bold: true, color: '#ffffff', name: 'Title', font: 'poppins' }),
      T(40, 112, 520, 40, 'Smart. Helpful. Always here.', { size: 16, color: '#8fb8ff', name: 'Tagline' }),
      T(40, 220, 520, 130, 'Hi {first_name},\n\nThanks for logging in. Add Rex to a server, open the dashboard and make it yours: commands, welcome cards, moderation and more.'),
      BTN(40, 370, 220, 'Open my dashboard'), T(40, 450, 520, 50, 'Need a hand? Just reply to this email or open the Support page.', { size: 13, color: '#6b7a99', name: 'Small print' })]; return { d, subject: 'Welcome to Rex, {first_name}!' }; } },
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
  const nameIn = h('input', { class: 'eb-name', type: 'text', maxlength: 60, placeholder: 'Name this email (e.g. Welcome)', 'aria-label': 'Email name', oninput: (e) => { M.name = e.target.value; dirty = true; syncBar(); } });
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
    status, bAuto, h('button', { type: 'button', class: 'eb-ghost', onclick: testSend }, 'Send test'), bSave);
  app.replaceChildren(h('div', { class: 'eb' }, bar, h('div', { class: 'eb-body' }, left, h('main', { class: 'eb-main' }, canvasWrap, previewBox), right)));

  function syncBar() { bAuto.classList.toggle('on', !!M.enabled && M.send_when !== 'manual'); bAuto.textContent = '⚡ Automation' + (M.enabled && M.send_when !== 'manual' ? ': on' : ''); bUndo.disabled = !undo.length; bRedo.disabled = !redo.length; bSave.textContent = dirty ? 'Save' : 'Saved'; bSave.classList.toggle('clean', !dirty); zLabel.textContent = Math.round(zoom * 100) + '%'; }
  function setZoom(z) { zoom = Math.max(0.4, Math.min(1.6, Math.round(z * 10) / 10)); paintCanvas(); syncBar(); }
  function setDev(d) { dev = d; bDesk.classList.toggle('on', d === 'd'); bMob.classList.toggle('on', d === 'm'); if (mode === 'preview') showPreview(); paintAll(); }
  function setMode(m) { mode = m; bEdit.classList.toggle('on', m === 'edit'); bPrev.classList.toggle('on', m === 'preview'); canvasWrap.hidden = m === 'preview'; previewBox.hidden = m !== 'preview'; left.classList.toggle('dim', m === 'preview'); if (m === 'preview') showPreview(); }
  async function goBack() { if (dirty && !(await rexDialog.confirm('Leave without saving?', 'Your changes to this email will be lost.', 'Leave', true))) return; dirty = false; location.href = '/owner#email'; }
  window.addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

  /* ---------- canvas */
  const nodes = {};
  function paintCanvas() {
    stage.replaceChildren(); Object.keys(nodes).forEach((k) => delete nodes[k]);
    const w = W(), hgt = canvasH(), auto = dev === 'm' && !hasMob() ? autoMobile() : null;
    stage.style.width = w + 'px'; stage.style.height = hgt + 'px'; stage.style.transform = 'scale(' + zoom + ')';
    canvasWrap.style.setProperty('--sw', Math.round(w * zoom) + 'px'); canvasWrap.style.setProperty('--sh', Math.round(hgt * zoom) + 'px');
    stage.style.background = D.page; stage.style.borderRadius = D.radius + 'px';
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
    if (e.bg && e.bg !== 'transparent') s.background = e.bg;
    if (e.radius) s.borderRadius = e.radius + 'px';
    if (e.bw) s.border = e.bw + 'px solid ' + e.bc;
    if (e.t === 'rect') { if (e.img && e.img.startsWith(location.origin + '/api/img/')) { s.backgroundImage = 'url(' + e.img + ')'; s.backgroundSize = 'cover'; s.backgroundPosition = 'center'; } return; }
    if (e.t === 'image') {
      if (e.src && e.src.startsWith(location.origin + '/api/img/')) { const im = h('img', { src: e.src, alt: '', draggable: 'false' }); im.style.objectFit = e.fit === 'auto' ? 'contain' : e.fit === 'fill' ? 'fill' : 'cover'; n.append(im); }
      else n.append(h('div', { class: 'eb-ph' }, e.src ? 'Picture from the web (see Preview)' : 'Double-click to add a picture'));
      return;
    }
    const size = (dev === 'm' && e.m && e.m.size) || e.size;
    s.fontFamily = (FONT[e.font || D.font] || FONT.arial).css; s.fontSize = size + 'px'; s.lineHeight = (size * e.lh) + 'px'; s.color = e.color || D.color;
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
    const tabs = h('div', { class: 'eb-tabs' }, [['add', 'Add'], ['layers', 'Layers'], ['email', 'Email']].map(([k, n]) => h('button', { type: 'button', class: tab === k ? 'on' : '', onclick: () => { tab = k; layers(); } }, n)));
    let body;
    if (tab === 'add') {
      const tile = (ic, name, fn) => h('button', { type: 'button', class: 'eb-tile', onclick: fn }, h('span', {}, ic), name);
      body = h('div', { class: 'eb-pad' }, h('div', { class: 'eb-grid' },
        tile('T', 'Text', () => add(T(40, 40, 320, 80, 'Type your text here', { name: 'Text' }))),
        tile('H', 'Heading', () => add(T(40, 40, 520, 50, 'A big headline', { name: 'Heading', size: 30, bold: true, color: '#0b1426', font: 'poppins' }))),
        tile('🖼', 'Picture', () => add({ id: uid(), t: 'image', name: 'Picture', d: { x: 40, y: 40, w: 300, h: 180 }, src: '', alt: '', fit: 'cover' })),
        tile('▭', 'Button', () => add(BTN(40, 40, 200, 'Click me', '{dashboard_url}'))),
        tile('◼', 'Box', () => add(RECT(0, 40, 600, 160, '#f3f6fc', { name: 'Box' }))),
        tile('—', 'Divider', () => add(RECT(40, 40, 520, 2, '#dfe6f3', { name: 'Divider' })))),
        h('p', { class: 'eb-help' }, 'Drag things anywhere on the page. A Box can sit behind other things to make a coloured banner. Variables like {first_name} fill in per person.'));
    } else if (tab === 'layers') {
      body = h('div', { class: 'eb-pad' }, D.els.length ? [...D.els].reverse().map((e) => h('div', { class: 'eb-layer' + (e.id === sel ? ' on' : ''), onclick: () => select(e.id) },
        h('span', { class: 'ic' }, { text: 'T', image: '🖼', button: '▭', rect: '◼' }[e.t]), h('span', { class: 'nm' }, e.name || e.t),
        h('button', { type: 'button', class: 'eb-mini', title: 'Hide', 'aria-label': 'Hide', onclick: (ev) => { ev.stopPropagation(); edit(() => { if (dev === 'm') { materialise(); e.m.hide = !e.m.hide; } else e.hid = !e.hid; }); } }, ((dev === 'm' && e.m ? e.m.hide : e.hid) ? '◌' : '●')),
        h('button', { type: 'button', class: 'eb-mini', title: 'Lock', 'aria-label': 'Lock', onclick: (ev) => { ev.stopPropagation(); edit(() => { e.lock = !e.lock; }); } }, e.lock ? '🔒' : '🔓'))) : h('p', { class: 'eb-help' }, 'Nothing here yet. Use Add.'));
    } else {
      body = emailPanel();
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
      h('h4', {}, 'Footer'), F('Footer text', h('input', { type: 'text', maxlength: 240, value: D.footer.text, oninput: (e) => { D.footer.text = e.target.value; dirty = true; syncBar(); } })),
      h('p', { class: 'eb-help' }, 'An Unsubscribe link is always added after the footer text.'));
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
      dev === 'm' ? h('div', { class: 'eb-f' }, h('span', {}, 'Hide on phones'), h('button', { type: 'button', class: 'rocker', role: 'switch', 'aria-checked': String(!!(e.m && e.m.hide)), onclick: () => edit(() => { materialise(); e.m.hide = !e.m.hide; }) })) : null);
    right.replaceChildren(wr);
  }

  /* ---------- preview, save, test */
  async function showPreview() {
    previewBox.replaceChildren(h('p', { class: 'eb-help' }, 'Building the real email…'));
    try {
      const r = await api('/api/owner/email/render', { method: 'POST', body: { design: D, subject: M.subject } });
      const fr = h('iframe', { class: 'eb-frame', title: 'Email preview', src: r.url }); fr.style.width = (dev === 'd' ? D.w + 40 : MOB + 24) + 'px';
      fr.style.maxWidth = '100%';
      previewBox.replaceChildren(h('p', { class: 'eb-help' }, 'This is the exact email that gets sent, drawn by the same code. Switch Desktop / Phone to see both.'),
        r.checks.length ? h('ul', { class: 'eb-checks' }, r.checks.map((c) => h('li', {}, c))) : null, h('div', { class: 'eb-frame-wrap' }, fr));
    } catch (e) { previewBox.replaceChildren(h('p', { class: 'eb-help bad' }, e.message)); }
  }
  async function save() {
    if (!M.name.trim()) { toast('Give the email a name first.', 'bad'); nameIn.focus(); return; }
    bSave.disabled = true; status.textContent = 'Saving…';
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
  const sendToLabel = (v) => v === 'everyone' ? 'everyone who has not unsubscribed' : v === 'essential' ? 'essential (even if they turned a tag off)' : 'people with the tag “' + tagName(v.slice(4)) + '”';
  function automation() {
    const c = Object.assign({}, M);
    const sum = h('p', { class: 'eb-help eb-sum' });
    const en = h('button', { type: 'button', class: 'rocker', role: 'switch', onclick: () => { c.enabled = !c.enabled; draw(); } });
    const when = sel2(Object.entries(meta.events), () => c.send_when, (v) => { c.send_when = v; if (v === 'manual') c.enabled = false; draw(); });
    const to = sel2([...meta.tags.map((t) => ['tag:' + t.id, 'People with tag: ' + t.name]), ['everyone', 'Everyone (unless unsubscribed)'], ['essential', 'Essential notice (ignores tags)']], () => c.send_to, (v) => { c.send_to = v; draw(); });
    const at = sel2(Object.entries(meta.send_at), () => c.when_at, (v) => { c.when_at = v; draw(); });
    const tm = h('input', { type: 'time', value: c.at_time, onchange: (e) => { c.at_time = e.target.value || '09:00'; draw(); } });
    const note = h('p', { class: 'eb-help' });
    function draw() {
      const auto = c.send_when !== 'manual', now = c.send_when === 'data_removed' || c.send_when === 'bot_leaves_server';
      en.setAttribute('aria-checked', String(!!c.enabled)); en.disabled = !auto; at.disabled = !auto || now; tm.hidden = c.when_at !== 'time' || !auto || now;
      note.textContent = now ? 'This one is always sent immediately, because the person will not be around later.' : (c.when_at === 'online' && auto ? 'It waits until they next open the website while logged in.' : (c.when_at === 'time' && auto ? 'Sent shortly after that time (UTC) once the event has happened.' : ''));
      sum.textContent = auto ? (c.enabled ? 'On: ' : 'Off (paused): ') + meta.events[c.send_when] + ', send to ' + sendToLabel(c.send_to) + ', ' + (now ? 'immediately' : c.when_at === 'time' ? 'at ' + c.at_time + ' UTC' : (meta.send_at[c.when_at] || '').toLowerCase()) + '.'
        : 'This email only goes out when you press Send on the Email tab in Owner mode. Pick an event above to make it automatic.';
    }
    draw();
    modal('Automation', h('div', { class: 'eb-pad' }, F('When', when), F('Send to', to), F('At', at), tm, note, h('div', { class: 'eb-f' }, h('span', {}, 'Send automatically'), en), sum,
      h('p', { class: 'eb-help' }, 'Needs Gmail connected. People with no email on file are skipped, and nobody gets more than the daily limit.')), (close) => [
      h('button', { type: 'button', class: 'eb-ghost', onclick: close }, 'Cancel'),
      h('button', { type: 'button', class: 'eb-save', onclick: () => { Object.assign(M, c); dirty = true; syncBar(); close(); toast('Automation updated. Remember to Save.', 'good'); } }, 'Done')]);
  }

  /* ---------- generate a ready-to-edit email for a tag (e.g. bug fixes) */
  function generate(tagId, notes) {
    const tag = meta.tags.find((t) => t.id === tagId) || { id: tagId, name: tagId };
    const look = { bug_fixes: ['Bug fixes in Rex', '#16a34a', 'We squashed some bugs. Here is what is fixed:'], new_features: ['New in Rex', '#2f8cff', 'Rex just got better. Here is what is new:'], announcements: ['News from Rex', '#7c3aed', 'We have some news to share:'] }[tagId] || [tag.name + ' from Rex', '#2f8cff', 'Here is the latest:'];
    const items = notes.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 12), d = base();
    const list = items.length ? items.map((x) => '• ' + x).join('\n') : '• First thing\n• Second thing';
    const lh = Math.max(60, items.length * 30 + 16);
    d.els = [RECT(0, 0, 600, 150, '#0b1426', { name: 'Header' }), RECT(40, 52, 6, 46, look[1], { name: 'Accent', radius: 3 }), T(60, 52, 500, 46, look[0], { size: 30, bold: true, color: '#ffffff', font: 'poppins', name: 'Title', va: 'middle' }),
      T(40, 180, 520, 70, 'Hi {first_name},\n\n' + look[2], { name: 'Intro' }), T(40, 270, 520, lh, list, { name: 'List', size: 16, lh: 1.8, bg: '#f3f6fc', pad: 16, radius: 12 }),
      BTN(40, 270 + lh + 30, 220, 'Open my dashboard'), T(40, 270 + lh + 100, 520, 60, 'Don\'t want these? [Change which emails you get]({unsubscribe_link}).', { size: 13, color: '#6b7a99', name: 'Small print' })];
    return { d, subject: look[0], name: tag.name + ' – ' + new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short' }), send_to: 'tag:' + tag.id };
  }
  function askNotes(tagId) {
    return new Promise((resolve) => {
      const ta = h('textarea', { rows: 6, placeholder: 'One item per line, e.g.\nFixed the welcome card not showing\nFixed ticket buttons on mobile', maxlength: 1500 });
      modal('Generate a “' + tagName(tagId) + '” email', h('div', { class: 'eb-pad' }, h('p', { class: 'eb-help' }, 'What changed? You can leave this empty and write it in the builder. It is sent to people who kept the “' + tagName(tagId) + '” tag on.'), ta),
        (close) => [h('button', { type: 'button', class: 'eb-ghost', onclick: () => { close(); resolve(null); } }, 'Cancel'), h('button', { type: 'button', class: 'eb-save', onclick: () => { close(); resolve(ta.value); } }, 'Generate')]);
    });
  }

  function paintAll() { paintCanvas(); layers(); props(); syncBar(); }

  /* ---------- load */
  async function pickStart() {
    return new Promise((resolve) => {
      const m = h('div', { class: 'eb-modal' }, h('div', { class: 'eb-card' }, h('h2', {}, 'Start a new email'), h('p', { class: 'eb-help' }, 'Pick a starting point. You can change everything afterwards.'),
        h('div', { class: 'eb-starts' }, Object.entries(PRESETS).map(([k, p]) => h('button', { type: 'button', class: 'eb-start', onclick: () => { m.remove(); resolve(k); } }, h('b', {}, p.label), h('span', {}, p.desc)))),
        h('h4', { class: 'eb-h4' }, 'Or generate one for a tag'), h('div', { class: 'eb-starts' }, meta.tags.map((t) => h('button', { type: 'button', class: 'eb-start', onclick: () => { m.remove(); resolve('gen:' + t.id); } }, h('b', {}, 'Generate: ' + t.name), h('span', {}, 'A ready-to-edit email for people with this tag.')))),
        h('button', { type: 'button', class: 'eb-ghost', onclick: () => { location.href = '/owner#email'; } }, '← Back')));
      document.body.append(m);
    });
  }
  if (tplId) {
    try { const t = await api('/api/owner/email/templates/' + tplId); D = t.design; M = { name: t.name, subject: t.subject, send_to: t.send_to, send_when: t.send_when, when_at: t.when_at || 'now', at_time: t.at_time || '09:00', enabled: !!t.enabled }; if (!/^(everyone|essential|tag:.+)$/.test(M.send_to)) M.send_to = 'everyone'; }
    catch (e) { app.replaceChildren(stateScreen('Email not found', e.message, h('a', { class: 'btn', href: '/owner#email' }, 'Back'))); return; }
  } else {
    let k = qs.get('gen') ? 'gen:' + qs.get('gen') : await pickStart();
    if (k.startsWith('gen:')) {
      const notes = await askNotes(k.slice(4));
      if (notes === null) { location.href = '/owner#email'; return; }
      const g = generate(k.slice(4), notes); D = g.d; M.subject = g.subject; M.name = g.name; M.send_to = g.send_to; dirty = true;
    } else {
      const p = PRESETS[k].make(); D = p.d; M.subject = p.subject; M.name = k === 'blank' ? '' : PRESETS[k].label; dirty = true;
      if (k === 'welcome') { M.send_when = 'first_login'; M.send_to = 'everyone'; }
      if (k === 'notice') { M.send_when = 'server_blacklisted'; M.send_to = 'essential'; }
    }
  }
  nameIn.value = M.name; tab = 'add'; paintAll();
  new ResizeObserver(() => { if (!canvasWrap.clientWidth) return; const c = canvasWrap.clientWidth - 48, need = (dev === 'd' ? D.w : MOB); if (c < need * zoom && zoom === 1) setZoom(Math.max(0.4, Math.floor(c / need * 10) / 10)); }).observe(canvasWrap);
})();
