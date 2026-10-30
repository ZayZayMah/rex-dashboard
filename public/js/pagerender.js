'use strict';
/* Draws a custom page from its saved design. Used by /pages/<name> and by the page builder's Preview, so both look identical.
   Colours left empty follow the website theme (normal / Christmas / Halloween) through the theme's own CSS variables. */
(function () {
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const VARS = { '{dashboard_url}': '/dashboard', '{support_url}': '/support', '{logo_url}': '/img/rex-logo.png' };
  const safeUrl = (u) => { u = String(u || ''); if (VARS[u]) return (u === '{support_url}' && window.REX && REX.support) ? REX.support : VARS[u]; return /^https:\/\/[^\s"'<>]{3,300}$/.test(u) || /^\/[A-Za-z0-9\-_\/.?=&#%]{0,200}$/.test(u) ? u : ''; };
  function markup(text) {
    let s = esc(text || '');
    s = s.replace(/\[([^\]\n]{1,80})\]\((https:\/\/[^\s)]{4,300}|\/[A-Za-z0-9\-_\/.?=&#%]{0,200}|\{\w+\})\)/g, (m, a, u) => { const url = safeUrl(u.replace(/&amp;/g, '&')); return url ? '<a class="pg-a" href="' + esc(url) + '"' + (url[0] === '/' ? '' : ' target="_blank" rel="noopener noreferrer"') + '>' + a + '</a>' : a; });
    s = s.replace(/\*\*([^*\n]{1,300})\*\*/g, '<b>$1</b>').replace(/(^|[^*\w])\*([^*\n]{1,300})\*(?![*\w])/g, '$1<i>$2</i>');
    return s.replace(/\n/g, '<br>');
  }
  const mk = (tag, attrs, ...kids) => { const n = document.createElement(tag); Object.entries(attrs || {}).forEach(([k, v]) => { if (k === 'class') n.className = v; else if (v !== null && v !== undefined && v !== false) n.setAttribute(k, v); }); kids.forEach((c) => c && n.append(c)); return n; };

  window.rexRenderPage = function (D, o) {
    o = o || {};
    const FONT = o.fonts || {};
    const useM = !!o.mobile && D.els.length > 0 && D.els.every((e) => e.m);
    const W = useM ? 360 : (D.w || 800);
    const box = (e) => (useM ? e.m : e.d);
    const els = D.els.filter((e) => !e.hid && !(useM && e.m && e.m.hide));
    const H = Math.max(200, ...els.map((e) => box(e).y + box(e).h + 40));
    const canvas = mk('div', { class: 'pg-canvas' });
    canvas.style.cssText = 'position:relative;transform-origin:top left;width:' + W + 'px;height:' + H + 'px;';
    if (D.page) { canvas.style.background = D.page; if (D.radius) canvas.style.borderRadius = D.radius + 'px'; }
    els.forEach((e, i) => {
      const b = box(e), url = e.t === 'button' || e.t === 'image' ? safeUrl(e.url) : '';
      const n = mk(url && e.t === 'button' ? 'a' : 'div', { class: 'pg-el pg-' + e.t, href: url && e.t === 'button' ? url : null, target: url && url[0] !== '/' ? '_blank' : null, rel: url && url[0] !== '/' ? 'noopener noreferrer' : null });
      const s = n.style;
      s.position = 'absolute'; s.left = b.x + 'px'; s.top = b.y + 'px'; s.width = b.w + 'px'; s.height = b.h + 'px'; s.zIndex = String(i + 1); s.boxSizing = 'border-box';
      if (e.bg && e.bg !== 'transparent') s.background = e.bg; else if (e.t === 'button' && !e.bg) s.background = 'var(--volt)';
      if (e.radius) s.borderRadius = e.radius + 'px';
      if (e.bw) s.border = e.bw + 'px solid ' + e.bc;
      if (e.t === 'rect') { if (e.img && /^https?:\/\/[^/]+\/api\/img\//.test(e.img)) { s.backgroundImage = 'url(' + e.img + ')'; s.backgroundSize = 'cover'; s.backgroundPosition = 'center'; } canvas.append(n); return; }
      if (e.t === 'image') {
        const src = e.src === '{logo_url}' ? '/img/rex-logo.png' : (/^https?:\/\/[^/]+\/api\/img\//.test(e.src || '') || /^https:\/\//.test(e.src || '') ? e.src : '');
        if (src) { const im = mk('img', { src, alt: e.alt || '', draggable: 'false', referrerpolicy: 'no-referrer' }); im.style.cssText = 'width:100%;height:100%;display:block;border-radius:inherit;object-fit:' + (e.fit === 'auto' ? 'contain' : e.fit === 'fill' ? 'fill' : 'cover'); n.append(url ? mk('a', { href: url, target: url[0] === '/' ? null : '_blank', rel: 'noopener noreferrer', style: 'display:block;width:100%;height:100%' }, im) : im); }
        canvas.append(n); return;
      }
      const size = (useM && e.m && e.m.size) || e.size || 16, f = FONT[e.font || D.font];
      s.fontFamily = f ? f.css : 'inherit'; s.fontSize = size + 'px'; s.lineHeight = (size * (e.lh || 1.5)) + 'px';
      s.color = e.color || (e.t === 'button' ? 'var(--on-accent, #fff)' : (D.color || 'var(--ice)'));
      s.fontWeight = e.bold ? '700' : '400'; s.fontStyle = e.italic ? 'italic' : 'normal'; s.textDecoration = 'none'; s.textTransform = e.upper ? 'uppercase' : 'none';
      s.letterSpacing = (e.ls || 0) + 'px'; s.textAlign = e.align || 'left'; s.display = 'flex'; s.flexDirection = 'column';
      s.justifyContent = e.va === 'middle' ? 'center' : e.va === 'bottom' ? 'flex-end' : 'flex-start'; s.padding = (e.pad || 0) + 'px';
      const inner = mk('div', {}); inner.style.width = '100%'; inner.innerHTML = markup(e.t === 'button' ? e.label : e.text);   // everything is escaped by markup()
      inner.querySelectorAll('a.pg-a').forEach((a) => { a.style.color = D.link || 'var(--arc)'; a.style.textDecoration = 'underline'; });
      n.append(inner); canvas.append(n);
    });
    // scale the whole page down on narrow screens so the layout never breaks
    const fit = mk('div', { class: 'pg-fit' }); fit.style.cssText = 'width:100%;overflow:hidden;position:relative;';
    const holder = mk('div', {}); holder.style.cssText = 'margin:0 auto;position:relative;'; holder.append(canvas); fit.append(holder);
    const apply = () => { const avail = fit.clientWidth || W, k = Math.min(1, avail / W); canvas.style.transform = 'scale(' + k + ')'; holder.style.width = Math.round(W * k) + 'px'; holder.style.height = Math.round(H * k) + 'px'; };
    if (window.ResizeObserver) new ResizeObserver(apply).observe(fit); else window.addEventListener('resize', apply);
    setTimeout(apply, 0);
    return fit;
  };
})();
