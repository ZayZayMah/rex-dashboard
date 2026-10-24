'use strict';
/* Decorative layer. Each theme is its own set of elements, not a re-colour:
     normal     drifting spark (click for XP)
     halloween  cobwebs, hanging spiders, moon, mist, graveyard footer, flying bats (click for XP)
     christmas  snowfall, light garland, snow drift, shooting stars (click for XP)
   Clicking a flyer is worth 10 XP (batched, capped per day, saved to your Rex profile when logged in). */
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const host = () => document.getElementById('fx');
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const timers = [];
  let cleanup = [];
  let pending = 0, flushTimer = null, toldLogin = false;

  function parse(svg) {
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
    return document.importNode(doc.documentElement, true);
  }
  const rnd = (a, b) => a + Math.random() * (b - a);

  /* ---------------------------------------------------------------- xp */
  async function flush() {
    flushTimer = null;
    const count = Math.min(pending, 5);
    pending -= count;
    if (!count) return;
    try { await api('/api/xp', { method: 'POST', body: { count } }); } catch (e) { /* capped or offline: fine */ }
    if (pending > 0) flushTimer = setTimeout(flush, 4000);
  }
  function collect(x, y) {
    const pop = h('div', { class: 'xp-pop', style: 'left:' + (x - 24) + 'px;top:' + (y - 20) + 'px' }, '+10 XP');
    host().append(pop);
    setTimeout(() => pop.remove(), 1200);
    if (!window.REX || !REX.me) {
      if (!toldLogin) { toldLogin = true; toast('Log in with Discord to keep the XP you catch.'); }
      return;
    }
    pending += 1;
    if (!flushTimer) flushTimer = setTimeout(flush, 3000);
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden && pending) { clearTimeout(flushTimer); flush(); } });

  /* ---------------------------------------------------------------- flyer engine */
  function fly(svgText, w, h2, opts) {
    if (reduce || document.hidden) return;
    const el = parse(svgText);
    el.setAttribute('width', w); el.setAttribute('height', h2);
    el.classList.add('flyer');
    const vw = window.innerWidth, vh = window.innerHeight;
    const fromLeft = Math.random() < 0.5;
    const y0 = rnd(90, vh * 0.7), y1 = rnd(90, vh * 0.7);
    const x0 = fromLeft ? -w - 20 : vw + 20, x1 = fromLeft ? vw + 20 : -w - 20;
    const dur = rnd(opts.min, opts.max);
    const steps = 9, frames = [];
    const amp = opts.wobble || 40;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t + Math.sin(t * Math.PI * rnd(2, 4)) * amp;
      frames.push({ transform: `translate(${x}px, ${y}px) scaleX(${fromLeft ? 1 : -1})` });
    }
    el.style.left = '0'; el.style.top = '0';
    host().append(el);
    const anim = el.animate(frames, { duration: dur, easing: 'linear' });
    anim.onfinish = () => el.remove();
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const r = el.getBoundingClientRect();
      collect(r.left + r.width / 2, r.top + r.height / 2);
      anim.pause();
      el.animate([{ transform: getComputedStyle(el).transform + ' scale(1)', opacity: 1 }, { transform: getComputedStyle(el).transform + ' scale(1.8)', opacity: 0 }], { duration: 260, fill: 'forwards' })
        .onfinish = () => el.remove();
    });
    return el;
  }
  function every(fn, min, max, first) {
    let stopped = false;
    const loop = () => { if (stopped) return; fn(); timers.push(setTimeout(loop, rnd(min, max))); };
    timers.push(setTimeout(loop, first == null ? rnd(min * 0.3, min) : first));
    cleanup.push(() => { stopped = true; });
  }

  /* ---------------------------------------------------------------- normal: spark */
  const SPARK = `<svg xmlns="${NS}" viewBox="0 0 40 40"><defs><radialGradient id="sg1"><stop offset="0" stop-color="#fff"/><stop offset=".35" stop-color="#8fdcff"/><stop offset="1" stop-color="#2f8cff" stop-opacity="0"/></radialGradient></defs>
    <circle cx="20" cy="20" r="19" fill="url(#sg1)"/><path d="M20 4l3 13 13 3-13 3-3 13-3-13-13-3 13-3z" fill="#fff"/></svg>`;
  function normalFx() {
    every(() => { const f = fly(SPARK, 34, 34, { min: 14000, max: 22000, wobble: 60 }); if (f) f.style.opacity = '.9'; }, 40000, 90000, 18000);
  }

  /* ---------------------------------------------------------------- halloween */
  const BAT = `<svg xmlns="${NS}" viewBox="0 0 64 32"><defs><linearGradient id="bg1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a1d5c"/><stop offset="1" stop-color="#120820"/></linearGradient></defs>
    <g class="wing"><path d="M32 16C26 8 14 6 2 12c4 2 6 5 6 8 4-3 7-2 9 2 3-4 8-3 11 2l4-4z" fill="url(#bg1)"/></g>
    <g class="wing r"><path d="M32 16c6-8 18-10 30-4-4 2-6 5-6 8-4-3-7-2-9 2-3-4-8-3-11 2l-4-4z" fill="url(#bg1)"/></g>
    <path d="M29 13l1-6 2 4 2-4 1 6z" fill="#1a0b2c"/><ellipse cx="32" cy="18" rx="3.6" ry="6.5" fill="#1a0b2c"/>
    <circle cx="30.6" cy="15.5" r=".9" fill="#ffb347"/><circle cx="33.4" cy="15.5" r=".9" fill="#ffb347"/></svg>`;

  function web(corner) {
    // radial threads + sagging rings, drawn from the top corner
    const R = 190, spokes = 7, rings = 6;
    const pts = (k, r) => { const a = (k / (spokes - 1)) * (Math.PI / 2); return [Math.cos(a) * r, Math.sin(a) * r]; };
    let d = '';
    for (let k = 0; k < spokes; k++) { const [x, y] = pts(k, R); d += `M0 0L${x.toFixed(1)} ${y.toFixed(1)}`; }
    for (let r = 1; r <= rings; r++) {
      const rad = (r / rings) * R * (0.4 + 0.6 * (r / rings));
      for (let k = 0; k < spokes - 1; k++) {
        const [x1, y1] = pts(k, rad), [x2, y2] = pts(k + 1, rad), [cx, cy] = pts(k + 0.5, rad * 0.8);
        d += `M${x1.toFixed(1)} ${y1.toFixed(1)}Q${cx.toFixed(1)} ${cy.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
      }
    }
    const el = parse(`<svg xmlns="${NS}" viewBox="0 0 ${R} ${R}" width="${R}" height="${R}"><path d="${d}" fill="none" stroke="rgba(235,225,255,.42)" stroke-width="1"/></svg>`);
    el.style.cssText = 'position:fixed;top:var(--nav-h);' + (corner === 'l' ? 'left:0;' : 'right:0;transform:scaleX(-1);') + 'opacity:.8;';
    return el;
  }
  function spider() {
    const len = rnd(120, 260), x = rnd(8, 92);
    const el = parse(`<svg xmlns="${NS}" viewBox="0 0 40 ${len + 40}" width="40" height="${len + 40}"><line x1="20" y1="0" x2="20" y2="${len}" stroke="rgba(235,225,255,.5)" stroke-width="1"/>
      <g transform="translate(20 ${len + 14})" stroke="#0b0614" stroke-width="1.6" fill="none" stroke-linecap="round">
      <path d="M-5 -2L-14 -9L-18 0M-5 0L-16 2L-17 10M-5 2L-13 10L-11 17M-4 4L-8 14L-6 20"/><path d="M5 -2L14 -9L18 0M5 0L16 2L17 10M5 2L13 10L11 17M4 4L8 14L6 20"/></g>
      <ellipse cx="20" cy="${len + 16}" rx="7" ry="9" fill="#150a24"/><circle cx="20" cy="${len + 6}" r="4.5" fill="#150a24"/><circle cx="18.5" cy="${len + 5}" r="1" fill="#ff8a3d"/><circle cx="21.5" cy="${len + 5}" r="1" fill="#ff8a3d"/></svg>`);
    el.style.cssText = `position:fixed;top:calc(var(--nav-h) - 4px);left:${x}vw;transform-origin:50% 0;`;
    if (!reduce) el.animate([{ transform: 'rotate(-3deg)' }, { transform: 'rotate(3deg)' }], { duration: rnd(2800, 4200), direction: 'alternate', iterations: Infinity, easing: 'ease-in-out' });
    return el;
  }
  function moon() {
    return parse(`<svg xmlns="${NS}" viewBox="0 0 200 200" width="200" height="200" class="hw-moon"><defs><radialGradient id="mg" cx=".4" cy=".35"><stop offset="0" stop-color="#fff6dc"/><stop offset=".7" stop-color="#ffd58a"/><stop offset="1" stop-color="#e8a24a"/></radialGradient>
      <radialGradient id="mh"><stop offset=".55" stop-color="#ffb347" stop-opacity=".35"/><stop offset="1" stop-color="#ffb347" stop-opacity="0"/></radialGradient></defs>
      <circle cx="100" cy="100" r="98" fill="url(#mh)"/><circle cx="100" cy="100" r="62" fill="url(#mg)"/>
      <circle cx="82" cy="86" r="11" fill="#e8b765" opacity=".55"/><circle cx="118" cy="112" r="14" fill="#e8b765" opacity=".45"/><circle cx="104" cy="74" r="6" fill="#e8b765" opacity=".5"/><circle cx="88" cy="124" r="7" fill="#e8b765" opacity=".4"/></svg>`);
  }
  function graveyard() {
    return parse(`<svg xmlns="${NS}" viewBox="0 0 1200 160" preserveAspectRatio="none" class="hw-yard"><path fill="#0a0512" d="M0 160V118h40v-14l8-8 8 8v14h46v-30c0-12 18-12 18 0v30h60V96h6v-10h-8v-6h8v-8h6v8h8v6h-8v10h6v22h60v-26c0-14 20-14 20 0v26h90V92l14-18 14 18v26h70v-20h8l6-10 6 10h8v20h96v-34c0-14 22-14 22 0v34h70V84h8V70h4v14h8v34h120v-28c0-14 22-14 22 0v28h84v-16h6v-12h-6v-6h6v-8h6v8h6v6h-6v12h6v16h92v-24c0-16 22-16 22 0v24h70V100l10-14 10 14v18h60V90c0-14 20-14 20 0v28h80v-14h8l6-8 6 8h8v14h40v42z"/>
      <path fill="#12091f" d="M120 160l-6-40c-4-26-30-34-30-62 0-10 8-18 18-18 4 0 8 2 8 2s-4-8 0-14c5-8 16-4 14 6-2 6 4 10 8 10 8 0 12 8 8 16-4 6-12 8-14 16-2 10 8 14 8 22l6 62z" opacity=".95"/></svg>`);
  }
  let hwFooter = null;
  function halloweenFx() {
    const fxh = host();
    const mist = h('div', { class: 'hw-mist' });
    fxh.append(mist, web('l'), web('r'));
    for (let i = 0; i < 2; i++) fxh.append(spider());
    cleanup.push(() => { document.querySelectorAll('.hw-moon-wrap, .hw-yard').forEach((n) => n.remove()); });
    const art = document.getElementById('art');
    if (art) { const wrap = h('div', { class: 'hw-moon-wrap' }, moon()); art.replaceChildren(wrap); }
    const foot = document.getElementById('footer');
    if (foot && !foot.querySelector('.hw-yard')) { foot.prepend(graveyard()); hwFooter = foot; }
    every(() => { const f = fly(BAT, rnd(46, 70), 30, { min: 9000, max: 16000, wobble: 70 }); if (f) f.classList.add('bat'); }, 5000, 11000, 1500);
  }

  /* ---------------------------------------------------------------- christmas */
  const STAR = `<svg xmlns="${NS}" viewBox="0 0 80 24"><defs><linearGradient id="st" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff"/></linearGradient></defs>
    <rect x="0" y="10" width="62" height="4" rx="2" fill="url(#st)"/><path d="M68 2l3 7 8 1-6 5 2 8-7-4-7 4 2-8-6-5 8-1z" fill="#ffe28a"/></svg>`;
  function garland() {
    const w = Math.max(window.innerWidth, 900), n = Math.round(w / 90);
    const colors = ['#ff4d5e', '#ffd25c', '#47d68a', '#5fb4ff'];
    let bulbs = '', path = `M0 6`;
    const seg = w / n;
    for (let i = 0; i < n; i++) path += ` Q${(i + 0.5) * seg} 34 ${(i + 1) * seg} 6`;
    for (let i = 0; i < n; i++) {
      const cx = (i + 0.5) * seg, cy = 22;
      bulbs += `<g class="bulb b${i % 4}"><line x1="${cx}" y1="${cy - 4}" x2="${cx}" y2="${cy}" stroke="#2c4a3a" stroke-width="2"/><ellipse cx="${cx}" cy="${cy + 7}" rx="5" ry="7" fill="${colors[i % 4]}"/></g>`;
    }
    const el = parse(`<svg xmlns="${NS}" viewBox="0 0 ${w} 40" width="100%" height="40" preserveAspectRatio="none"><path d="${path}" fill="none" stroke="#2c6b4a" stroke-width="3"/>${bulbs}</svg>`);
    el.classList.add('xm-garland');
    return el;
  }
  function snow() {
    if (reduce) return;
    const cv = h('canvas', { class: 'xm-snow' });
    host().append(cv);
    const ctx = cv.getContext('2d');
    let w = 0, hh = 0;
    const resize = () => { w = cv.width = window.innerWidth; hh = cv.height = window.innerHeight; };
    resize(); window.addEventListener('resize', resize);
    const flakes = Array.from({ length: 90 }, () => ({ x: Math.random() * w, y: Math.random() * hh, r: rnd(1, 3.2), v: rnd(.4, 1.4), s: rnd(0, 6) }));
    let raf = 0, on = true;
    (function tick() {
      if (!on) return;
      ctx.clearRect(0, 0, w, hh);
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      for (const f of flakes) {
        f.y += f.v; f.s += .012; f.x += Math.sin(f.s) * .5;
        if (f.y > hh + 4) { f.y = -4; f.x = Math.random() * w; }
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 6.283); ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    })();
    cleanup.push(() => { on = false; cancelAnimationFrame(raf); window.removeEventListener('resize', resize); });
  }
  function christmasFx() {
    snow();
    const g = garland();
    g.style.cssText = 'position:fixed;left:0;right:0;top:calc(var(--nav-h) - 2px);';
    host().append(g);
    const foot = document.getElementById('footer');
    if (foot && !foot.querySelector('.xm-drift')) foot.prepend(parse(`<svg xmlns="${NS}" viewBox="0 0 1200 60" preserveAspectRatio="none" class="xm-drift"><path fill="#eaf4ff" d="M0 60V30c60-24 120 10 200-6s140-12 220 4 150 20 230 0 140-22 220-4 140 14 220-2 110-10 110-10v48z"/></svg>`));
    every(() => { const f = fly(STAR, 80, 24, { min: 3500, max: 5500, wobble: 8 }); if (f) f.classList.add('shoot'); }, 22000, 50000, 9000);
  }

  /* ---------------------------------------------------------------- lifecycle */
  function reset() {
    timers.splice(0).forEach(clearTimeout);
    cleanup.splice(0).forEach((fn) => fn());
    const fxh = host();
    if (fxh) fxh.replaceChildren();
    document.querySelectorAll('.xm-drift').forEach((n) => n.remove());
  }
  function start() {
    if (!host()) return;
    reset();
    const t = document.documentElement.getAttribute('data-theme');
    if (t === 'halloween') halloweenFx();
    else if (t === 'christmas') christmasFx();
    else normalFx();
  }
  window.rexFx = { start, reset };
  document.addEventListener('rex:ready', start);
  new MutationObserver(start).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  if (document.readyState !== 'loading') setTimeout(() => { if (!window.__rexFxStarted) { window.__rexFxStarted = true; start(); } }, 800);
})();
