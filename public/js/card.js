'use strict';
/* Image card editor (v2): drag, resize, rotate, crop, zoom, undo, layers. window.rexCard.editor(card, {dis, onchange}) */
window.rexCard = (function () {
  const SIZES = [['banner', 'Banner 1000×360', 1000, 360], ['wide', 'Wide 1200×500', 1200, 500], ['square', 'Square 800×800', 800, 800], ['compact', 'Compact 700×240', 700, 240], ['tall', 'Tall 600×900', 600, 900]];
  const SAMPLE = { 'user.name': 'Alex', user: 'Alex', 'user.tag': 'alex', 'user.username': 'alex', server: 'Your Server', 'server.members': '1234', member_number: '1,234', 'target.name': 'Sam', date: '1 Jan 2027', time: '12:00 UTC', 'user.top_role': 'Member', 'user.roles': '3', 'server.boosts': '14', 'server.channels': '42', 'server.roles': '18' };
  const sub = (t) => String(t || '').replace(/\{([a-z_.0-9]+)\}/g, (m, k) => (k in SAMPLE ? SAMPLE[k] : (k.endsWith('_icon') ? '' : k)));
  const isIcon = (s) => /^\{(user|target|server)_icon\}$/.test(s || '');
  const imgs = {};
  let sampleAvatar = null;
  function avatar() {
    if (sampleAvatar) return sampleAvatar;
    const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 256, 256); g.addColorStop(0, '#5865F2'); g.addColorStop(1, '#2EE6B6'); x.fillStyle = g; x.fillRect(0, 0, 256, 256);
    x.fillStyle = 'rgba(255,255,255,.9)'; x.beginPath(); x.arc(128, 100, 46, 0, 7); x.fill(); x.beginPath(); x.ellipse(128, 238, 84, 70, 0, 0, 7); x.fill();
    return (sampleAvatar = c);
  }
  function load(url, redraw) {
    if (!url) return null;
    if (imgs[url]) return imgs[url].ok ? imgs[url].img : null;
    const img = new Image(); imgs[url] = { img, ok: false }; img.onload = () => { imgs[url].ok = true; redraw(); }; img.onerror = () => { imgs[url].bad = true; }; img.src = url; return null;
  }
  const srcOf = (l, redraw) => (isIcon(l.src) ? avatar() : load(sub(l.src), redraw));
  const natural = (im) => (im ? [im.naturalWidth || im.width, im.naturalHeight || im.height] : [1, 1]);

  function pathFor(ctx, shape, x, y, w, h, radius) {
    ctx.beginPath();
    if (shape === 'circle' || shape === 'ellipse') ctx.ellipse(x + w / 2, y + h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2);
    else if (shape === 'rounded') ctx.roundRect(x, y, w, h, Math.min(w, h) * 0.18);
    else if (radius) ctx.roundRect(x, y, w, h, Math.min(radius, w / 2, h / 2)); else ctx.rect(x, y, w, h);
  }
  function fontOf(l) { const fam = l.font === 'serif' ? 'Georgia, serif' : l.font === 'mono' ? 'monospace' : 'system-ui, sans-serif'; return (l.bold ? 'bold ' : '') + l.size + 'px ' + fam; }
  const mctx = document.createElement('canvas').getContext('2d');
  function textLayout(l) {
    mctx.font = fontOf(l); let t = sub(l.text); if (l.upper) t = t.toUpperCase();
    const box = l.w || 0, lines = [];
    t.split('\n').forEach((para) => { let cur = ''; para.split(' ').forEach((w) => { const test = (cur + ' ' + w).trim(); if (box && mctx.measureText(test).width > box && cur) { lines.push(cur); cur = w; } else cur = test; }); lines.push(cur); });
    const ls = lines.slice(0, 12), lh = l.size * (l.lh || 120) / 100;
    const width = box || Math.max(1, ...ls.map((s) => mctx.measureText(s).width));
    return { lines: ls, lh, width, height: lh * ls.length };
  }
  function bounds(l) { if (l.t === 'text') { const m = textLayout(l); return { x: l.x, y: l.y, w: m.width, h: m.height }; } return { x: l.x, y: l.y, w: l.w, h: l.h }; }

  function drawLayer(ctx, l, redraw) {
    const b = bounds(l); ctx.save();
    ctx.globalAlpha = (l.op == null ? 100 : l.op) / 100;
    if (l.rot) { ctx.translate(b.x + b.w / 2, b.y + b.h / 2); ctx.rotate(l.rot * Math.PI / 180); ctx.translate(-(b.x + b.w / 2), -(b.y + b.h / 2)); }
    if (l.t === 'rect') {
      ctx.globalAlpha *= (l.alpha == null ? 100 : l.alpha) / 100;
      if (l.c2) { const a = (l.angle || 90) * Math.PI / 180, cx = l.x + l.w / 2, cy = l.y + l.h / 2, r = Math.hypot(l.w, l.h) / 2; const g = ctx.createLinearGradient(cx - Math.cos(a) * r, cy - Math.sin(a) * r, cx + Math.cos(a) * r, cy + Math.sin(a) * r); g.addColorStop(0, l.color); g.addColorStop(1, l.c2); ctx.fillStyle = g; } else ctx.fillStyle = l.color;
      pathFor(ctx, l.shape || 'rect', l.x, l.y, l.w, l.h, l.radius); ctx.fill();
      if (l.border && l.border.width) { ctx.globalAlpha = (l.op == null ? 100 : l.op) / 100; ctx.lineWidth = l.border.width * 2; ctx.strokeStyle = l.border.color; ctx.save(); ctx.clip(); ctx.stroke(); ctx.restore(); }
    } else if (l.t === 'image') {
      const bw = (l.border && l.border.width) || 0;
      if (bw) { pathFor(ctx, l.shape, l.x - bw, l.y - bw, l.w + bw * 2, l.h + bw * 2); ctx.fillStyle = l.border.color; ctx.fill(); }
      pathFor(ctx, l.shape, l.x, l.y, l.w, l.h); ctx.save(); ctx.clip();
      const im = srcOf(l, redraw);
      if (im) {
        const [iw, ih] = natural(im), c = l.crop || { x: 0, y: 0, w: 1, h: 1 };
        const sx = c.x * iw, sy = c.y * ih, sw = c.w * iw, sh = c.h * ih;
        if (l.flip) { ctx.translate(l.x + l.w / 2, 0); ctx.scale(-1, 1); ctx.translate(-(l.x + l.w / 2), 0); }
        if (l.fit === 'contain') { const s = Math.min(l.w / sw, l.h / sh), dw = sw * s, dh = sh * s; ctx.drawImage(im, sx, sy, sw, sh, l.x + (l.w - dw) / 2, l.y + (l.h - dh) / 2, dw, dh); }
        else { const s = Math.max(l.w / sw, l.h / sh), dw = l.w / s, dh = l.h / s; ctx.drawImage(im, sx + (sw - dw) / 2, sy + (sh - dh) / 2, dw, dh, l.x, l.y, l.w, l.h); }
      } else { const g = ctx.createLinearGradient(l.x, l.y, l.x + l.w, l.y + l.h); g.addColorStop(0, '#5865F2'); g.addColorStop(1, '#2EE6B6'); ctx.fillStyle = g; ctx.fillRect(l.x, l.y, l.w, l.h); }
      ctx.restore();
    } else if (l.t === 'text') {
      const m = textLayout(l), pl = l.plate && l.plate.on ? l.plate : null;
      if (pl) { ctx.save(); ctx.globalAlpha *= (pl.alpha == null ? 55 : pl.alpha) / 100; ctx.fillStyle = pl.color || '#000'; ctx.beginPath(); ctx.roundRect(l.x - pl.pad, l.y - pl.pad, m.width + pl.pad * 2, m.height + pl.pad * 2, pl.radius || 0); ctx.fill(); ctx.restore(); }
      ctx.font = fontOf(l); ctx.textBaseline = 'top'; ctx.textAlign = 'left';
      m.lines.forEach((line, i) => {
        const w = ctx.measureText(line).width; let x = l.x; if (l.w && l.align === 'center') x = l.x + (l.w - w) / 2; else if (l.w && l.align === 'right') x = l.x + l.w - w;
        const y = l.y + i * m.lh + (m.lh - l.size) / 2 - l.size * 0.08;
        if (l.shadow) { ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillText(line, x + 2, y + 2); }
        if (l.stroke && l.stroke.width) { ctx.lineWidth = l.stroke.width * 2; ctx.strokeStyle = l.stroke.color; ctx.lineJoin = 'round'; ctx.strokeText(line, x, y); }
        ctx.fillStyle = l.color; ctx.fillText(line, x, y);
      });
    }
    ctx.restore();
  }
  function draw(canvas, card) {
    const ctx = canvas.getContext('2d'); canvas.width = card.w; canvas.height = card.h;
    const redraw = () => draw(canvas, card), bg = card.bg;
    if (bg.type === 'gradient') { const a = (bg.angle || 0) * Math.PI / 180, cx = card.w / 2, cy = card.h / 2, r = Math.hypot(card.w, card.h) / 2;
      const g = ctx.createLinearGradient(cx - Math.cos(a) * r, cy - Math.sin(a) * r, cx + Math.cos(a) * r, cy + Math.sin(a) * r); g.addColorStop(0, bg.c1); g.addColorStop(1, bg.c2); ctx.fillStyle = g; }
    else ctx.fillStyle = bg.c1;
    ctx.fillRect(0, 0, card.w, card.h);
    if (bg.type === 'image' && bg.url) { const im = load(sub(bg.url), redraw); if (im) { const [iw, ih] = natural(im), s = Math.max(card.w / iw, card.h / ih); ctx.drawImage(im, (card.w - iw * s) / 2, (card.h - ih * s) / 2, iw * s, ih * s); ctx.fillStyle = 'rgba(0,0,0,' + ((bg.dim || 0) / 100) + ')'; ctx.fillRect(0, 0, card.w, card.h); } }
    card.layers.forEach((l) => { if (!l.hide) drawLayer(ctx, l, redraw); });
  }

  const def = () => ({ w: 1000, h: 360, bg: { type: 'gradient', c1: '#1b2440', c2: '#0b1020', angle: 135, url: '', dim: 35 }, layers: [] });
  const LAYER = {
    text: () => ({ t: 'text', x: 300, y: 120, text: 'Welcome {user.name}!', size: 56, color: '#ffffff', align: 'left', bold: true, shadow: true, w: 0, font: 'sans', rot: 0, op: 100, lh: 120, plate: { on: false, color: '#000000', alpha: 55, pad: 14, radius: 12 }, stroke: { width: 0, color: '#000000' } }),
    image: () => ({ t: 'image', x: 60, y: 80, w: 200, h: 200, src: '{user_icon}', shape: 'circle', border: { width: 6, color: '#ffffff' }, rot: 0, op: 100, fit: 'cover', crop: null, flip: false }),
    rect: () => ({ t: 'rect', x: 0, y: 260, w: 1000, h: 100, color: '#000000', alpha: 40, radius: 0, shape: 'rect', rot: 0, op: 100, c2: '', angle: 90, border: { width: 0, color: '#ffffff' } }),
    ellipse: () => ({ t: 'rect', x: 400, y: 100, w: 160, h: 160, color: '#5865F2', alpha: 90, radius: 0, shape: 'ellipse', rot: 0, op: 100, c2: '#2EE6B6', angle: 45, border: { width: 0, color: '#ffffff' } }),
  };
  function normalise(card) { const d = def(); const c = (card && typeof card === 'object') ? card : {}; c.w = c.w || d.w; c.h = c.h || d.h; c.bg = Object.assign(d.bg, c.bg || {}); c.layers = Array.isArray(c.layers) ? c.layers : []; return c; }
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const NAME = { text: 'Text', image: 'Picture', rect: 'Shape' };
  const ICON = { text: '🔤', image: '🖼️', rect: '▭' };

  function editor(card, o) {
    const dis = !!o.dis, c = normalise(card);
    let sel = -1, zoom = 0, fit = true; const hist = [clone(c)]; let hi = 0;
    const canvas = h('canvas', { class: 'cc-canvas' });
    const over = h('div', { class: 'cc-over', tabindex: '0', 'aria-label': 'Card canvas. Drag things to move them, arrow keys nudge.' });
    const stage = h('div', { class: 'cc-stage' }, h('div', { class: 'cc-sheet' }, canvas, over));
    const side = h('div', { class: 'cc-side' }), bar = h('div', { class: 'cc-bar' });
    const wrap = h('div', { class: 'cc cardedit' }, bar, h('div', { class: 'cc-main' }, stage, side));
    const guides = [];

    const redraw = () => draw(canvas, c);
    const emit = () => { redraw(); o.onchange(c); };
    function snap(push) { if (push) { hist.length = hi + 1; hist.push(clone(c)); if (hist.length > 80) hist.shift(); hi = hist.length - 1; } }
    function restore(i) { const s = hist[i]; c.w = s.w; c.h = s.h; c.bg = clone(s.bg); c.layers = clone(s.layers); hi = i; if (sel >= c.layers.length) sel = -1; emit(); paintAll(); }
    const commit = () => { snap(true); emit(); };

    /* ---------- sizing / zoom */
    function applyZoom() {
      const avail = Math.max(240, stage.clientWidth - 24 || 600);
      const z = fit ? Math.min(1, avail / c.w) : zoom; zoom = z;
      canvas.style.width = c.w * z + 'px'; canvas.style.height = c.h * z + 'px'; over.style.width = c.w * z + 'px'; over.style.height = c.h * z + 'px';
      const zl = bar.querySelector('.cc-zl'); if (zl) zl.textContent = Math.round(z * 100) + '%';
      paintHandles();
    }
    const setZoom = (z) => { fit = false; zoom = Math.max(0.15, Math.min(3, z)); applyZoom(); };

    /* ---------- hit testing & handles */
    const center = (l) => { const b = bounds(l); return [b.x + b.w / 2, b.y + b.h / 2]; };
    const rotPt = (px, py, cx, cy, deg) => { const a = deg * Math.PI / 180, dx = px - cx, dy = py - cy; return [cx + dx * Math.cos(a) - dy * Math.sin(a), cy + dx * Math.sin(a) + dy * Math.cos(a)]; };
    function hit(px, py) {
      for (let i = c.layers.length - 1; i >= 0; i--) {
        const l = c.layers[i]; if (l.hide || l.lock) continue; const b = bounds(l), [cx, cy] = center(l), [rx, ry] = rotPt(px, py, cx, cy, -(l.rot || 0));
        const pad = l.t === 'text' && l.plate && l.plate.on ? l.plate.pad : 4;
        if (rx >= b.x - pad && rx <= b.x + b.w + pad && ry >= b.y - pad && ry <= b.y + b.h + pad) return i;
      }
      return -1;
    }
    function canvasPt(ev) { const r = canvas.getBoundingClientRect(); return [(ev.clientX - r.left) / zoom, (ev.clientY - r.top) / zoom]; }
    const HANDLES = [['nw', -1, -1], ['n', 0, -1], ['ne', 1, -1], ['e', 1, 0], ['se', 1, 1], ['s', 0, 1], ['sw', -1, 1], ['w', -1, 0]];
    function paintHandles() {
      over.replaceChildren(); guides.length = 0;
      const l = c.layers[sel]; if (!l || dis) return;
      const b = bounds(l), z = zoom;
      const box = h('div', { class: 'cc-box', style: `left:${b.x * z}px;top:${b.y * z}px;width:${b.w * z}px;height:${b.h * z}px;transform:rotate(${l.rot || 0}deg)` });
      const hs = l.t === 'text' ? HANDLES.filter((x) => x[0] === 'e' || x[0] === 'w' || x[0] === 'se' || x[0] === 'sw' || x[0] === 'ne' || x[0] === 'nw') : HANDLES;
      if (!l.lock) {
        hs.forEach(([k, dx, dy]) => box.append(h('i', { class: 'cc-h cc-' + k, 'data-h': k, style: `left:${(dx + 1) * 50}%;top:${(dy + 1) * 50}%` })));
        box.append(h('i', { class: 'cc-h cc-rot', 'data-h': 'rot' }));
      }
      over.append(box);
    }

    /* ---------- pointer interaction */
    let drag = null;
    function guideLines(g) { over.querySelectorAll('.cc-guide').forEach((n) => n.remove()); g.forEach(([a, v]) => over.append(h('div', { class: 'cc-guide ' + a, style: a === 'v' ? `left:${v * zoom}px` : `top:${v * zoom}px` }))); }
    function snapMove(l, nx, ny) {
      const b = bounds(l), w = b.w, hh = b.h, T = 7 / zoom, xs = [0, c.w / 2, c.w], ys = [0, c.h / 2, c.h], g = [];
      c.layers.forEach((m, i) => { if (m !== l && !m.hide) { const q = bounds(m); xs.push(q.x, q.x + q.w / 2, q.x + q.w); ys.push(q.y, q.y + q.h / 2, q.y + q.h); } });
      let bx = null, by = null;
      [[nx, 0], [nx + w / 2, w / 2], [nx + w, w]].forEach(([v, off]) => xs.forEach((t) => { if (Math.abs(v - t) < T && (bx === null || Math.abs(v - t) < Math.abs(bx.d))) bx = { d: t - v, t }; }));
      [[ny, 0], [ny + hh / 2, hh / 2], [ny + hh, hh]].forEach(([v]) => ys.forEach((t) => { if (Math.abs(v - t) < T && (by === null || Math.abs(v - t) < Math.abs(by.d))) by = { d: t - v, t }; }));
      if (bx) { nx += bx.d; g.push(['v', bx.t]); } if (by) { ny += by.d; g.push(['h', by.t]); }
      return [nx, ny, g];
    }
    over.addEventListener('pointerdown', (ev) => {
      if (dis) return; over.focus({ preventScroll: true });
      const hk = ev.target.dataset && ev.target.dataset.h, l = c.layers[sel], [px, py] = canvasPt(ev);
      if (hk && l) {
        const b = bounds(l); drag = { kind: hk, l, px, py, b: { ...b }, s: { x: l.x, y: l.y, w: l.w, h: l.h, size: l.size, rot: l.rot || 0 }, moved: false };
      } else {
        const i = hit(px, py);
        if (i !== sel) { sel = i; paintAll(); }
        if (i >= 0) { const m = c.layers[i]; drag = { kind: 'move', l: m, px, py, s: { x: m.x, y: m.y }, moved: false }; } else drag = null;
      }
      if (drag) { over.setPointerCapture(ev.pointerId); ev.preventDefault(); }
    });
    over.addEventListener('pointermove', (ev) => {
      if (!drag) return; const [px, py] = canvasPt(ev), l = drag.l; drag.moved = true;
      if (drag.kind === 'move') {
        let nx = drag.s.x + (px - drag.px), ny = drag.s.y + (py - drag.py), g = [];
        if (!ev.altKey) [nx, ny, g] = snapMove(l, nx, ny); l.x = Math.round(nx); l.y = Math.round(ny); guideLines(g);
      } else if (drag.kind === 'rot') {
        const [cx, cy] = [drag.b.x + drag.b.w / 2, drag.b.y + drag.b.h / 2]; let a = Math.atan2(py - cy, px - cx) * 180 / Math.PI + 90; if (a > 180) a -= 360; if (ev.shiftKey || Math.abs(a % 45) < 4) a = Math.round(a / 15) * 15; l.rot = Math.round(a);
      } else {
        const hd = HANDLES.find((x) => x[0] === drag.kind), dx = hd[1], dy = hd[2], rot = drag.s.rot;
        const [ldx, ldy] = rotPt(px - drag.px, py - drag.py, 0, 0, -rot), b0 = drag.b, [cx0, cy0] = [b0.x + b0.w / 2, b0.y + b0.h / 2];
        if (l.t === 'text') {
          if (dy === 0) { const nw = Math.max(40, Math.round(b0.w + dx * ldx)); l.w = nw; const sh = rotPt(dx * (nw - b0.w) / 2, 0, 0, 0, rot); const ncx = cx0 + sh[0], ncy = cy0 + sh[1]; l.x = Math.round(ncx - nw / 2); l.y = Math.round(ncy - bounds(l).h / 2); }
          else { const k = Math.max(0.2, 1 + (dx * ldx + dy * ldy) / Math.max(40, b0.w)); l.size = Math.max(8, Math.min(220, Math.round(drag.s.size * k))); if (l.w) l.w = Math.round(drag.b.w * k); const nb = bounds(l); l.x = Math.round(dx < 0 ? b0.x + b0.w - nb.w : b0.x); l.y = Math.round(dy < 0 ? b0.y + b0.h - nb.h : b0.y); }
        } else {
          let dw = dx * ldx, dh = dy * ldy; const keep = l.t === 'image' ? !ev.altKey : ev.shiftKey;
          if (keep && dx && dy) { const r = b0.w / b0.h, d = Math.abs(dw) > Math.abs(dh * r) ? dw : dh * r; dw = d; dh = d / r; }
          else if (keep && dx && !dy) dh = 0;
          let nw = Math.max(8, Math.round(b0.w + dx * dw * (dx ? 1 : 0))), nh = Math.max(8, Math.round(b0.h + dy * dh * (dy ? 1 : 0)));
          if (!dx) nw = b0.w; if (!dy) nh = b0.h;
          const sh = rotPt(dx * (nw - b0.w) / 2, dy * (nh - b0.h) / 2, 0, 0, rot);
          l.w = nw; l.h = nh; l.x = Math.round(cx0 + sh[0] - nw / 2); l.y = Math.round(cy0 + sh[1] - nh / 2);
        }
      }
      redraw(); paintHandles(); syncFields();
    });
    const end = () => { if (drag && drag.moved) commit(); drag = null; over.querySelectorAll('.cc-guide').forEach((n) => n.remove()); };
    over.addEventListener('pointerup', end); over.addEventListener('pointercancel', end);
    over.addEventListener('dblclick', (ev) => { const i = hit(...canvasPt(ev)); if (i >= 0 && c.layers[i].t === 'text') { const t = prompt('Text', c.layers[i].text); if (t != null) { c.layers[i].text = t.slice(0, 220); commit(); paintAll(); } } else if (i >= 0 && c.layers[i].t === 'image') cropMode(c.layers[i]); });
    over.addEventListener('keydown', (ev) => {
      if (dis) return; const l = c.layers[sel], k = ev.key;
      if ((ev.ctrlKey || ev.metaKey) && k.toLowerCase() === 'z') { ev.preventDefault(); if (ev.shiftKey) { if (hi < hist.length - 1) restore(hi + 1); } else if (hi > 0) restore(hi - 1); return; }
      if ((ev.ctrlKey || ev.metaKey) && k.toLowerCase() === 'y') { ev.preventDefault(); if (hi < hist.length - 1) restore(hi + 1); return; }
      if (!l) return;
      if ((ev.ctrlKey || ev.metaKey) && k.toLowerCase() === 'd') { ev.preventDefault(); dupe(); return; }
      if (k === 'Delete' || k === 'Backspace') { ev.preventDefault(); del(); return; }
      if (k === 'Escape') { sel = -1; paintAll(); return; }
      const step = ev.shiftKey ? 10 : 1, mv = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[k];
      if (mv && !l.lock) { ev.preventDefault(); l.x += mv[0]; l.y += mv[1]; commit(); paintHandles(); syncFields(); }
    });
    stage.addEventListener('wheel', (ev) => { if (ev.ctrlKey || ev.metaKey) { ev.preventDefault(); setZoom(zoom * (ev.deltaY < 0 ? 1.1 : 0.9)); } }, { passive: false });

    /* ---------- actions */
    function add(t) { if (c.layers.length >= 40) return; const l = LAYER[t](); l.x = Math.round((c.w - (l.w || 300)) / 2); l.y = Math.round((c.h - (l.h || 60)) / 2); if (t === 'rect') { l.w = Math.round(c.w * 0.6); l.h = Math.round(c.h * 0.25); l.x = Math.round((c.w - l.w) / 2); l.y = Math.round(c.h * 0.65); } c.layers.push(l); sel = c.layers.length - 1; commit(); paintAll(); }
    function dupe() { const l = c.layers[sel]; if (!l || c.layers.length >= 40) return; const n = clone(l); n.x += 24; n.y += 24; c.layers.splice(sel + 1, 0, n); sel++; commit(); paintAll(); }
    function del() { if (sel < 0) return; c.layers.splice(sel, 1); sel = Math.min(sel, c.layers.length - 1); commit(); paintAll(); }
    function order(d) { const i = sel, j = i + d; if (i < 0 || j < 0 || j >= c.layers.length) return; c.layers.splice(j, 0, c.layers.splice(i, 1)[0]); sel = j; commit(); paintAll(); }
    function alignTo(how) { const l = c.layers[sel]; if (!l) return; const b = bounds(l), dx = b.x - l.x, dy = b.y - l.y;
      if (how === 'l') l.x = 0 - dx; if (how === 'c') l.x = Math.round((c.w - b.w) / 2) - dx; if (how === 'r') l.x = c.w - b.w - dx;
      if (how === 't') l.y = 0 - dy; if (how === 'm') l.y = Math.round((c.h - b.h) / 2) - dy; if (how === 'b') l.y = c.h - b.h - dy; commit(); paintHandles(); syncFields(); }

    /* ---------- crop */
    function cropMode(l) {
      if (l.t !== 'image') return; const im = srcOf(l, () => cropMode(l)); if (!im) { alert('The picture is still loading, or it is not a valid link. Try again in a moment.'); return; }
      const [iw, ih] = natural(im), maxw = Math.min(560, stage.clientWidth - 40), sc = Math.min(maxw / iw, 380 / ih), W = Math.round(iw * sc), H = Math.round(ih * sc);
      const cr = Object.assign({ x: 0, y: 0, w: 1, h: 1 }, l.crop || {}), cv = h('canvas', { width: W, height: H, style: `width:${W}px;height:${H}px` }); cv.getContext('2d').drawImage(im, 0, 0, W, H);
      const rect = h('div', { class: 'cc-crop' }), shade = h('div', { class: 'cc-shade' }, cv, rect); const box = h('div', { class: 'cc-cropbox', style: `width:${W}px;height:${H}px` }, shade);
      const place = () => { rect.style.cssText = `left:${cr.x * W}px;top:${cr.y * H}px;width:${cr.w * W}px;height:${cr.h * H}px`; };
      ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].forEach((k) => { const hd = HANDLES.find((x) => x[0] === k); rect.append(h('i', { class: 'cc-h', 'data-h': k, style: `left:${(hd[1] + 1) * 50}%;top:${(hd[2] + 1) * 50}%` })); });
      let d = null;
      box.addEventListener('pointerdown', (ev) => { const r = box.getBoundingClientRect(), x = (ev.clientX - r.left) / W, y = (ev.clientY - r.top) / H, k = ev.target.dataset && ev.target.dataset.h; d = { k: k || (x > cr.x && x < cr.x + cr.w && y > cr.y && y < cr.y + cr.h ? 'move' : null), x, y, s: { ...cr } }; if (d.k) { box.setPointerCapture(ev.pointerId); ev.preventDefault(); } });
      box.addEventListener('pointermove', (ev) => { if (!d || !d.k) return; const r = box.getBoundingClientRect(), x = (ev.clientX - r.left) / W, y = (ev.clientY - r.top) / H, dx = x - d.x, dy = y - d.y, s = d.s;
        if (d.k === 'move') { cr.x = Math.max(0, Math.min(1 - s.w, s.x + dx)); cr.y = Math.max(0, Math.min(1 - s.h, s.y + dy)); }
        else { let x0 = s.x, y0 = s.y, x1 = s.x + s.w, y1 = s.y + s.h; if (d.k.includes('w')) x0 = Math.max(0, Math.min(x1 - 0.03, s.x + dx)); if (d.k.includes('e')) x1 = Math.min(1, Math.max(x0 + 0.03, x1 + dx)); if (d.k.includes('n')) y0 = Math.max(0, Math.min(y1 - 0.03, s.y + dy)); if (d.k.includes('s')) y1 = Math.min(1, Math.max(y0 + 0.03, y1 + dy)); cr.x = x0; cr.y = y0; cr.w = x1 - x0; cr.h = y1 - y0; }
        place(); });
      box.addEventListener('pointerup', () => { d = null; });
      const close = () => back.remove();
      const apply = () => { const full = cr.w > 0.99 && cr.h > 0.99; l.crop = full ? null : { x: +cr.x.toFixed(4), y: +cr.y.toFixed(4), w: +cr.w.toFixed(4), h: +cr.h.toFixed(4) }; if (!full) { const ratio = (cr.w * iw) / (cr.h * ih); l.h = Math.max(16, Math.round(l.w / ratio)); } commit(); paintAll(); close(); };
      const back = h('div', { class: 'modal-back cc-cropback' }, h('div', { class: 'modal', role: 'dialog', 'aria-label': 'Crop picture' }, h('h2', {}, 'Crop picture'), h('p', { class: 'muted small' }, 'Drag the box or its handles to choose the part you want to keep.'), box,
        h('div', { class: 'cc-row' }, h('button', { type: 'button', class: 'btn', onclick: apply }, 'Use this crop'), h('button', { type: 'button', class: 'btn ghost', onclick: () => { Object.assign(cr, { x: 0, y: 0, w: 1, h: 1 }); place(); } }, 'Reset'), h('button', { type: 'button', class: 'btn ghost', onclick: close }, 'Cancel'))));
      document.body.append(back); place();
    }

    /* ---------- side panel */
    const fieldRefs = [];
    function syncFields() { fieldRefs.forEach((f) => f()); }
    const row = (...k) => h('div', { class: 'cc-fields' }, ...k);
    function num(obj, k, label, min, max, step) { const inp = h('input', { type: 'number', min, max, step: step || 1, disabled: dis ? true : null, oninput: (e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) { obj[k] = Math.max(min, Math.min(max, v)); redraw(); paintHandles(); } }, onchange: commit }); inp.value = obj[k] == null ? '' : Math.round(obj[k] * 100) / 100; fieldRefs.push(() => { if (document.activeElement !== inp) inp.value = obj[k] == null ? '' : Math.round(obj[k] * 100) / 100; }); return h('label', { class: 'cc-f' }, h('span', {}, label), inp); }
    function txt(obj, k, label, ph, area) { const inp = h(area ? 'textarea' : 'input', Object.assign({ maxlength: 220, placeholder: ph || '', disabled: dis ? true : null, oninput: (e) => { obj[k] = e.target.value; redraw(); paintHandles(); }, onchange: commit }, area ? { rows: 2 } : { type: 'text' })); inp.value = obj[k] || ''; return h('label', { class: 'cc-f wide' }, h('span', {}, label), inp); }
    function colr(obj, k, label) { const inp = h('input', { type: 'color', disabled: dis ? true : null, oninput: (e) => { obj[k] = e.target.value; redraw(); }, onchange: commit }); inp.value = /^#[0-9a-f]{6}$/i.test(obj[k] || '') ? obj[k] : '#ffffff'; return h('label', { class: 'cc-f' }, h('span', {}, label), inp); }
    function selc(obj, k, label, opts, after) { const s = h('select', { disabled: dis ? true : null, onchange: (e) => { obj[k] = e.target.value; commit(); if (after) paintAll(); else paintHandles(); } }, opts.map(([a, b]) => h('option', { value: a }, b))); s.value = obj[k] == null ? opts[0][0] : obj[k]; return h('label', { class: 'cc-f' }, h('span', {}, label), s); }
    function chk(obj, k, label, after) { return h('label', { class: 'cc-chk' }, h('input', { type: 'checkbox', checked: obj[k] ? true : null, disabled: dis ? true : null, onchange: (e) => { obj[k] = e.target.checked; commit(); if (after) paintAll(); } }), ' ' + label); }
    const btn = (label, fn, cls, title) => h('button', { type: 'button', class: 'btn ghost sm ' + (cls || ''), title: title || label, disabled: dis ? true : null, onclick: fn }, label);

    function propsFor(l) {
      const f = [];
      if (l.t === 'text') {
        l.plate = l.plate || { on: false, color: '#000000', alpha: 55, pad: 14, radius: 12 }; l.stroke = l.stroke || { width: 0, color: '#000000' };
        f.push(txt(l, 'text', 'Text', 'Welcome {user.name}!', true), row(num(l, 'size', 'Size', 8, 220), colr(l, 'color', 'Colour'), selc(l, 'font', 'Font', [['sans', 'Clean'], ['serif', 'Serif'], ['mono', 'Mono']]), selc(l, 'align', 'Align (needs a width)', [['left', 'Left'], ['center', 'Centre'], ['right', 'Right']])),
          row(num(l, 'w', 'Width (0 = auto)', 0, 1400), num(l, 'lh', 'Line height %', 80, 250)), row(chk(l, 'bold', 'Bold'), chk(l, 'shadow', 'Shadow'), chk(l, 'upper', 'CAPITALS')),
          h('div', { class: 'cc-sub' }, h('b', {}, 'Outline'), row(num(l.stroke, 'width', 'Thickness', 0, 20), colr(l.stroke, 'color', 'Colour'))),
          h('div', { class: 'cc-sub' }, chk(l.plate, 'on', 'Background behind the text (keeps it readable)', true), l.plate.on ? row(colr(l.plate, 'color', 'Colour'), num(l.plate, 'alpha', 'Opacity %', 0, 100), num(l.plate, 'pad', 'Padding', 0, 80), num(l.plate, 'radius', 'Corners', 0, 80)) : null));
      } else if (l.t === 'image') {
        l.border = l.border || { width: 0, color: '#ffffff' };
        f.push(txt(l, 'src', 'Picture', '{user_icon}, {server_icon} or https link'), row(btn('✂️ Crop…', () => cropMode(l)), btn('Clear crop', () => { l.crop = null; commit(); paintAll(); }), btn('↔ Flip', () => { l.flip = !l.flip; commit(); paintAll(); })),
          row(selc(l, 'shape', 'Shape', [['circle', 'Circle'], ['rounded', 'Rounded'], ['square', 'Square']]), selc(l, 'fit', 'Fit', [['cover', 'Fill (crops edges)'], ['contain', 'Show whole picture']])),
          h('div', { class: 'cc-sub' }, h('b', {}, 'Border'), row(num(l.border, 'width', 'Thickness', 0, 30), colr(l.border, 'color', 'Colour'))));
      } else {
        l.border = l.border || { width: 0, color: '#ffffff' };
        f.push(row(colr(l, 'color', 'Colour'), l.c2 ? colr(l, 'c2', 'Colour 2') : null, l.c2 ? num(l, 'angle', 'Angle', 0, 360) : null, num(l, 'alpha', 'Opacity %', 0, 100)), row(selc(l, 'shape', 'Shape', [['rect', 'Rectangle'], ['ellipse', 'Circle / oval']], true), num(l, 'radius', 'Corner radius', 0, 400)),
          l.c2 ? btn('Remove gradient', () => { l.c2 = ''; commit(); paintAll(); }) : btn('Add a second colour (gradient)', () => { l.c2 = '#2EE6B6'; commit(); paintAll(); }), h('div', { class: 'cc-sub' }, h('b', {}, 'Outline'), row(num(l.border, 'width', 'Thickness', 0, 40), colr(l.border, 'color', 'Colour'))));
      }
      return f;
    }
    function layerList() {
      const list = h('div', { class: 'cc-layers', role: 'list' });
      for (let i = c.layers.length - 1; i >= 0; i--) {
        const l = c.layers[i], label = l.name || (l.t === 'text' ? (l.text || 'Text').slice(0, 22) : l.t === 'image' ? 'Picture ' + (isIcon(l.src) ? '(avatar)' : '') : (l.shape === 'ellipse' ? 'Circle' : 'Box'));
        list.append(h('div', { class: 'cc-lr' + (i === sel ? ' on' : '') + (l.hide ? ' off' : ''), role: 'listitem', draggable: dis ? null : 'true',
          onclick: () => { sel = i; paintAll(); },
          ondragstart: (e) => { e.dataTransfer.setData('text/plain', String(i)); }, ondragover: (e) => e.preventDefault(),
          ondrop: (e) => { e.preventDefault(); const from = parseInt(e.dataTransfer.getData('text/plain'), 10); if (!isNaN(from) && from !== i) { c.layers.splice(i, 0, c.layers.splice(from, 1)[0]); sel = i; commit(); paintAll(); } } },
          h('span', { class: 'cc-li' }, ICON[l.t]), h('span', { class: 'cc-ln' }, label),
          h('button', { type: 'button', class: 'cc-mini', title: l.hide ? 'Show' : 'Hide', disabled: dis ? true : null, onclick: (e) => { e.stopPropagation(); l.hide = !l.hide; commit(); paintAll(); } }, l.hide ? '🙈' : '👁'),
          h('button', { type: 'button', class: 'cc-mini', title: l.lock ? 'Unlock' : 'Lock in place', disabled: dis ? true : null, onclick: (e) => { e.stopPropagation(); l.lock = !l.lock; commit(); paintAll(); } }, l.lock ? '🔒' : '🔓')));
      }
      if (!c.layers.length) list.append(h('p', { class: 'muted small' }, 'Nothing here yet. Add some text, a picture or a shape.'));
      return list;
    }
    function bgPanel() {
      const b = c.bg;
      return h('details', { class: 'cc-bg' }, h('summary', {}, 'Background and size'),
        h('div', { class: 'cc-fields' }, h('label', { class: 'cc-f wide' }, h('span', {}, 'Size'), h('select', { disabled: dis ? true : null, onchange: (e) => { const s = SIZES.find((x) => x[0] === e.target.value); if (s) { c.w = s[2]; c.h = s[3]; commit(); applyZoom(); paintAll(); } } }, h('option', { value: '' }, c.w + '×' + c.h + ' (change)'), SIZES.map((s) => h('option', { value: s[0] }, s[1])))),
          selc(b, 'type', 'Background', [['color', 'Solid colour'], ['gradient', 'Gradient'], ['image', 'Picture']], true), colr(b, 'c1', b.type === 'gradient' ? 'Colour 1' : 'Colour'), b.type === 'gradient' ? colr(b, 'c2', 'Colour 2') : null, b.type === 'gradient' ? num(b, 'angle', 'Angle', 0, 360) : null,
          b.type === 'image' ? txt(b, 'url', 'Picture link (https)', 'https://...') : null, b.type === 'image' ? num(b, 'dim', 'Darken %', 0, 90) : null));
    }
    function paintSide() {
      fieldRefs.length = 0; const l = c.layers[sel];
      side.replaceChildren(h('div', { class: 'cc-hd' }, 'Layers', h('span', { class: 'muted small' }, ' (top first, drag to reorder)')), layerList(),
        l ? h('div', { class: 'cc-props' }, h('div', { class: 'cc-hd' }, ICON[l.t] + ' ' + NAME[l.t] + ' settings'),
          h('div', { class: 'cc-fields' }, txtName(l)), row(num(l, 'x', 'X', -2000, 4000), num(l, 'y', 'Y', -2000, 4000), l.t === 'text' ? null : num(l, 'w', 'Width', 1, 2000), l.t === 'text' ? null : num(l, 'h', 'Height', 1, 2000), num(l, 'rot', 'Turn °', -180, 180), num(l, 'op', 'Fade %', 0, 100)),
          ...propsFor(l), h('div', { class: 'cc-row' }, btn('Copy', dupe, '', 'Duplicate (Ctrl+D)'), btn('Delete', del, 'bad', 'Delete (Del)'), btn('▲ Forward', () => order(1)), btn('▼ Back', () => order(-1)))) : h('p', { class: 'muted small cc-hint' }, 'Click something on the card to edit it. Drag to move, use the dots to resize, the top dot to turn it. Double-click a picture to crop it.'),
        bgPanel());
    }
    const txtName = (l) => h('label', { class: 'cc-f wide' }, h('span', {}, 'Layer name (optional)'), h('input', { type: 'text', maxlength: 30, value: l.name || '', disabled: dis ? true : null, oninput: (e) => { l.name = e.target.value; }, onchange: () => { commit(); paintSide(); } }));
    function paintBar() {
      const zl = h('span', { class: 'cc-zl' }, '100%');
      bar.replaceChildren(btn('+ Text', () => add('text')), btn('+ Picture', () => add('image')), btn('+ Box', () => add('rect')), btn('+ Circle', () => add('ellipse')), h('span', { class: 'cc-sp' }),
        btn('↶', () => { if (hi > 0) restore(hi - 1); }, '', 'Undo (Ctrl+Z)'), btn('↷', () => { if (hi < hist.length - 1) restore(hi + 1); }, '', 'Redo (Ctrl+Y)'), h('span', { class: 'cc-sp' }),
        h('span', { class: 'cc-al' }, btn('⇤', () => alignTo('l'), '', 'Align left'), btn('↔', () => alignTo('c'), '', 'Centre across'), btn('⇥', () => alignTo('r'), '', 'Align right'), btn('⤒', () => alignTo('t'), '', 'Align top'), btn('↕', () => alignTo('m'), '', 'Centre down'), btn('⤓', () => alignTo('b'), '', 'Align bottom')),
        h('span', { class: 'cc-sp' }), h('button', { type: 'button', class: 'btn ghost sm', onclick: () => setZoom(zoom / 1.2), title: 'Zoom out' }, '−'), zl, h('button', { type: 'button', class: 'btn ghost sm', onclick: () => setZoom(zoom * 1.2), title: 'Zoom in' }, '+'), h('button', { type: 'button', class: 'btn ghost sm', onclick: () => { fit = true; applyZoom(); } }, 'Fit'));
      if (dis) bar.querySelectorAll('button').forEach((b) => { if (!b.textContent.match(/[−+]|Fit/)) b.disabled = true; });
    }
    function paintAll() { paintSide(); redraw(); applyZoom(); }

    paintBar(); paintAll();
    if (!c.layers.length && !dis) { const a = LAYER.image(), t = LAYER.text(); c.layers.push(a, t); hist[0] = clone(c); o.onchange(c); paintAll(); }
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => { if (fit && wrap.isConnected) applyZoom(); }) : null; if (ro) ro.observe(stage);
    setTimeout(applyZoom, 0);
    return wrap;
  }
  return { editor, normalise, draw };
})();
