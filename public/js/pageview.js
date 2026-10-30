'use strict';
(async function () {
  const app = document.getElementById('app'), nav = document.getElementById('nav');
  const name = location.pathname.replace(/^\/pages\//, '').replace(/\/$/, '');
  let page;
  try { page = await api('/api/pages/' + encodeURIComponent(name)); } catch (e) { page = null; }
  if (!page) { await mountNav(''); return app.replaceChildren(stateScreen('Page not found', 'This page doesn\'t exist or isn\'t open yet.', h('a', { class: 'btn ghost', href: '/' }, 'Home'))); }
  if (page.hide_nav) { if (nav) nav.remove(); document.body.classList.add('pg-nonav'); await loadMe().catch(() => null); } else await mountNav('');
  document.title = page.title + ' - Rex';
  const fonts = Object.fromEntries((page.fonts || []).map((f) => [f.id, f]));
  const gf = (page.fonts || []).filter((f) => f.gf).map((f) => 'family=' + f.gf).join('&');
  if (gf) document.head.append(h('link', { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?' + gf + '&display=swap' }));
  const mobile = window.matchMedia('(max-width: 700px)').matches;
  app.replaceChildren(h('div', { class: 'pg-wrap' }, window.rexRenderPage(page.design, { fonts, mobile })));
})();
