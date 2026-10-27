'use strict';
/* Image card editor: draws a live preview on a canvas. window.rexCard.editor(card, {dis, onchange}) */
window.rexCard = (function () {
  const SIZES = [['banner', 'Banner 1000×360', 1000, 360], ['wide', 'Wide 1200×500', 1200, 500], ['square', 'Square 800×800', 800, 800], ['compact', 'Compact 700×240', 700, 240]];
  const SAMPLE = { 'user.name': 'Alex', user: 'Alex', 'user.tag': 'alex', 'user.username': 'alex', server: 'Your Server', 'server.members': '1234', member_number: '1,234', 'target.name': 'Sam', date: '1 Jan 2027', time: '12:00 UTC', 'user.top_role': 'Member', 'server.boosts': '8' };
  const sub = (t) => String(t || '').replace(/\{([a-z_.0-9]+)\}/g, (m, k) => (k in SAMPLE ? SAMPLE[k] : (k.endsWith('_icon') ? '' : k)));
  const isIcon = (s) => /^\{(user|target|server)_icon\}$/.test(s || '');
  const imgs = {};
  function load(url, redraw) {
    if (imgs[url]) return imgs[url].ok ? imgs[url].img : null;
    const img = new Image(); imgs[url] = { img, ok: false }; img.onload = () => { imgs[url].ok = true; redraw(); }; img.src = url; return null;
  }
  function clip(ctx, shape, x, y, w, h) {
    ctx.beginPath();
    if (shape === 'circle') ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    else if (shape === 'rounded') ctx.roundRect(x, y, w, h, Math.min(w, h) * 0.18); else ctx.rect(x, y, w, h);
  }
  function draw(canvas, card) {
    const ctx = canvas.getContext('2d'); canvas.width = card.w; canvas.height = card.h;
    const redraw = () => draw(canvas, card);
    const bg = card.bg;
    if (bg.type === 'gradient') { const a = (bg.angle || 0) * Math.PI / 180, cx = card.w / 2, cy = card.h / 2, r = Math.hypot(card.w, card.h) / 2;
      const g = ctx.createLinearGradient(cx - Math.cos(a) * r, cy - Math.sin(a) * r, cx + Math.cos(a) * r, cy + Math.sin(a) * r); g.addColorStop(0, bg.c1); g.addColorStop(1, bg.c2); ctx.fillStyle = g; }
    else ctx.fillStyle = bg.c1;
    ctx.fillRect(0, 0, card.w, card.h);
    if (bg.type === 'image' && bg.url) { const im = load(bg.url, redraw); if (im) { const s = Math.max(card.w / im.width, card.h / im.height); ctx.drawImage(im, (card.w - im.width * s) / 2, (card.h - im.height * s) / 2, im.width * s, im.height * s); ctx.fillStyle = 'rgba(0,0,0,' + (bg.dim / 100) + ')'; ctx.fillRect(0, 0, card.w, card.h); } }
    card.layers.forEach((l) => {
      ctx.save();
      if (l.t === 'rect') { ctx.globalAlpha = l.alpha / 100; ctx.fillStyle = l.color; ctx.beginPath(); ctx.roundRect(l.x, l.y, l.w, l.h, l.radius); ctx.fill(); }
      else if (l.t === 'image') {
        clip(ctx, l.shape, l.x, l.y, l.w, l.h); ctx.save(); ctx.clip();
        const im = isIcon(l.src) ? null : load(sub(l.src), redraw);
        if (im) ctx.drawImage(im, l.x, l.y, l.w, l.h); else { const g = ctx.createLinearGradient(l.x, l.y, l.x + l.w, l.y + l.h); g.addColorStop(0, '#5865F2'); g.addColorStop(1, '#2EE6B6'); ctx.fillStyle = g; ctx.fillRect(l.x, l.y, l.w, l.h); }
        ctx.restore();
        if (l.border && l.border.width) { clip(ctx, l.shape, l.x, l.y, l.w, l.h); ctx.lineWidth = l.border.width * 2; ctx.strokeStyle = l.border.color; ctx.save(); ctx.clip(); ctx.stroke(); ctx.restore(); }
      } else if (l.t === 'text') {
        const fam = l.font === 'serif' ? 'Georgia, serif' : l.font === 'mono' ? 'monospace' : 'system-ui, sans-serif';
        ctx.font = (l.bold ? 'bold ' : '') + l.size + 'px ' + fam; ctx.fillStyle = l.color; ctx.textBaseline = 'top';
        if (l.shadow) { ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2; }
        const t = sub(l.text); const w = ctx.measureText(t).width; ctx.textAlign = 'left';
        const box = l.w || 0; let x = l.x; if (box && l.align === 'center') x = l.x + (box - w) / 2; else if (box && l.align === 'right') x = l.x + box - w;
        ctx.fillText(t, x, l.y);
      }
      ctx.restore();
    });
  }
  const def = () => ({ w: 1000, h: 360, bg: { type: 'gradient', c1: '#1b2440', c2: '#0b1020', angle: 135, url: '', dim: 35 }, layers: [] });
  const LAYER = { text: () => ({ t: 'text', x: 280, y: 120, text: 'Welcome {user.name}!', size: 56, color: '#ffffff', align: 'left', bold: true, shadow: true, w: 0, font: 'sans' }),
    image: () => ({ t: 'image', x: 60, y: 80, w: 200, h: 200, src: '{user_icon}', shape: 'circle', border: { width: 6, color: '#ffffff' } }),
    rect: () => ({ t: 'rect', x: 0, y: 260, w: 1000, h: 100, color: '#000000', alpha: 40, radius: 0 }) };
  function normalise(card) { const d = def(); const c = (card && typeof card === 'object') ? card : {}; c.w = c.w || d.w; c.h = c.h || d.h; c.bg = Object.assign(d.bg, c.bg || {}); c.layers = Array.isArray(c.layers) ? c.layers : []; return c; }
  function editor(card, o) {
    const dis = o.dis ? true : null; const c = normalise(card);
    const canvas = h('canvas', { class: 'cardprev' }); const wrap = h('div', { class: 'cardedit' });
    const changed = () => { draw(canvas, c); o.onchange(c); };
    const num = (obj, k, min, max, label) => h('label', { class: 'bld-f sm' }, h('span', { class: 'bld-fl' }, label), h('input', { type: 'number', min, max, value: obj[k], disabled: dis, oninput: (e) => { obj[k] = Math.max(min, Math.min(max, parseInt(e.target.value, 10) || 0)); changed(); } }));
    const txt = (obj, k, label, ph) => h('label', { class: 'bld-f' }, h('span', { class: 'bld-fl' }, label), h('input', { type: 'text', value: obj[k] || '', maxlength: 220, placeholder: ph || '', disabled: dis, oninput: (e) => { obj[k] = e.target.value; changed(); } }));
    const col = (obj, k, label) => h('label', { class: 'bld-f sm' }, h('span', { class: 'bld-fl' }, label), h('input', { type: 'color', value: obj[k] || '#ffffff', disabled: dis, style: 'width:100%;height:38px;padding:2px', oninput: (e) => { obj[k] = e.target.value; changed(); } }));
    const sel = (obj, k, label, opts) => { const s = h('select', { disabled: dis, onchange: (e) => { obj[k] = e.target.value; changed(); } }, opts.map(([a, b]) => h('option', { value: a }, b))); s.value = obj[k]; return h('label', { class: 'bld-f sm' }, h('span', { class: 'bld-fl' }, label), s); };
    function paint() {
      const size = h('select', { disabled: dis, onchange: (e) => { const s = SIZES.find((x) => x[0] === e.target.value); if (s) { c.w = s[2]; c.h = s[3]; changed(); paint(); } } }, h('option', { value: '' }, 'Size: ' + c.w + '×' + c.h), SIZES.map((s) => h('option', { value: s[0] }, s[1])));
      const bgBox = h('div', { class: 'cardgrid' });
      bgBox.replaceChildren(sel(c.bg, 'type', 'Background', [['color', 'Solid colour'], ['gradient', 'Gradient'], ['image', 'Picture']]), col(c.bg, 'c1', c.bg.type === 'gradient' ? 'Colour 1' : 'Colour'),
        c.bg.type === 'gradient' ? col(c.bg, 'c2', 'Colour 2') : null, c.bg.type === 'gradient' ? num(c.bg, 'angle', 0, 360, 'Angle') : null,
        c.bg.type === 'image' ? txt(c.bg, 'url', 'Picture link (https)', 'https://...') : null, c.bg.type === 'image' ? num(c.bg, 'dim', 0, 90, 'Darken %') : null);
      bgBox.firstChild.querySelector('select').addEventListener('change', () => setTimeout(paint, 0));
      const layers = c.layers.map((l, i) => {
        const fields = [num(l, 'x', -2000, 4000, 'X'), num(l, 'y', -2000, 4000, 'Y')];
        if (l.t === 'text') fields.push(txt(l, 'text', 'Text', 'Welcome {user.name}!'), num(l, 'size', 8, 220, 'Size'), col(l, 'color', 'Colour'), sel(l, 'align', 'Align', [['left', 'Left'], ['center', 'Centre'], ['right', 'Right']]), num(l, 'w', 0, 2000, 'Box width (for align)'), sel(l, 'font', 'Font', [['sans', 'Sans'], ['serif', 'Serif'], ['mono', 'Mono']]),
          h('label', { class: 'bld-check' }, h('input', { type: 'checkbox', checked: l.bold ? true : null, disabled: dis, onchange: (e) => { l.bold = e.target.checked; changed(); } }), ' Bold'), h('label', { class: 'bld-check' }, h('input', { type: 'checkbox', checked: l.shadow ? true : null, disabled: dis, onchange: (e) => { l.shadow = e.target.checked; changed(); } }), ' Shadow'));
        if (l.t === 'image') fields.push(txt(l, 'src', 'Picture', '{user_icon}, {server_icon} or https link'), num(l, 'w', 16, 2000, 'Width'), num(l, 'h', 16, 2000, 'Height'), sel(l, 'shape', 'Shape', [['circle', 'Circle'], ['rounded', 'Rounded'], ['square', 'Square']]), num(l.border, 'width', 0, 30, 'Border'), col(l.border, 'color', 'Border colour'));
        if (l.t === 'rect') fields.push(num(l, 'w', 1, 2000, 'Width'), num(l, 'h', 1, 2000, 'Height'), col(l, 'color', 'Colour'), num(l, 'alpha', 0, 100, 'Opacity %'), num(l, 'radius', 0, 200, 'Corner radius'));
        return h('div', { class: 'cardlayer' }, h('div', { class: 'bld-ch' }, h('b', {}, { text: '🔤 Text', image: '🖼️ Picture', rect: '▭ Shape' }[l.t]), h('span', { class: 'grow' }),
          h('button', { type: 'button', class: 'bld-mini', disabled: dis || i === 0 ? true : null, onclick: () => { c.layers.splice(i - 1, 0, c.layers.splice(i, 1)[0]); changed(); paint(); } }, '↑'),
          h('button', { type: 'button', class: 'bld-mini', disabled: dis || i === c.layers.length - 1 ? true : null, onclick: () => { c.layers.splice(i + 1, 0, c.layers.splice(i, 1)[0]); changed(); paint(); } }, '↓'),
          h('button', { type: 'button', class: 'bld-mini bad', disabled: dis, onclick: () => { c.layers.splice(i, 1); changed(); paint(); } }, '✕')), h('div', { class: 'cardgrid' }, fields));
      });
      const add = (t) => h('button', { type: 'button', class: 'btn ghost sm', disabled: dis || c.layers.length >= 12 ? true : null, onclick: () => { c.layers.push(LAYER[t]()); changed(); paint(); } }, { text: '+ Text', image: '+ Picture', rect: '+ Shape' }[t]);
      wrap.replaceChildren(h('div', { class: 'cardprevwrap' }, canvas), h('div', { class: 'cardtop' }, size), bgBox, ...layers, h('div', { class: 'cardadd' }, add('text'), add('image'), add('rect')),
        h('p', { class: 'muted small' }, 'Use {user_icon}, {server_icon}, {target_icon}, {user.name}, {server}, {member_number} and other variables. Preview uses sample names.'));
      draw(canvas, c);
    }
    paint();
    if (!c.layers.length && !o.dis) { c.layers.push({ ...LAYER.image() }, { ...LAYER.text() }); o.onchange(c); paint(); }
    return wrap;
  }
  return { editor, normalise, draw };
})();
