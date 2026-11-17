'use strict';
(async function () {
  const app = document.getElementById('app');
  await mountNav('docs');
  if (REX.blocked) return;
  const slug = (location.pathname.replace(/^\/docs\/?/, '').replace(/\/$/, '')) || 'home';
  let index = [];
  try { index = await (await fetch('/data/docs/index.json')).json(); } catch (e) { /* handled below */ }
  const entry = index.find((x) => x.slug === slug);
  if (!entry) return app.replaceChildren(stateScreen('Page not found', 'That documentation page doesn\'t exist.', h('a', { class: 'btn', href: '/docs' }, 'Docs home')));
  let raw = '';
  try { raw = await (await fetch('/data/docs/' + slug + '.md')).text(); } catch (e) { return app.replaceChildren(stateScreen('Could not load', 'Please try again.')); }
  const [head, ...rest] = raw.split('\n---\n');
  const meta = {}; head.split('\n').forEach((l) => { const i = l.indexOf(':'); if (i > 0) meta[l.slice(0, i).trim()] = l.slice(i + 1).trim(); });
  const body = rest.join('\n---\n');
  document.title = meta.title + ' - Rex Docs';

  /* ---- tiny markdown renderer (no raw HTML is ever inserted) */
  const href = (u) => (u === 'support:' ? REX.support : u);
  function inline(text, into) {
    const re = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\)|\*[^*\s][^*]*\*)/g; let last = 0, m;
    while ((m = re.exec(text))) {
      if (m.index > last) into.append(text.slice(last, m.index));
      const t = m[0];
      if (t.startsWith('**')) { const b = h('b'); inline(t.slice(2, -2), b); into.append(b); }
      else if (t[0] === '`') into.append(h('code', {}, t.slice(1, -1)));
      else if (t[0] === '[') { const mm = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(t), u = href(mm[2]), ext = /^https?:/.test(u); const a = h('a', { href: u }); if (ext) { a.target = '_blank'; a.rel = 'noopener noreferrer'; } inline(mm[1], a); into.append(a); }
      else { const i = h('i'); inline(t.slice(1, -1), i); into.append(i); }
      last = m.index + t.length;
    }
    if (last < text.length) into.append(text.slice(last));
    return into;
  }
  const idOf = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const toc = [];
  function render(md) {
    const out = document.createDocumentFragment(); const lines = md.split('\n'); let i = 0;
    while (i < lines.length) {
      const l = lines[i];
      if (!l.trim()) { i++; continue; }
      let m;
      if ((m = /^(#{2,3}) (.+)$/.exec(l))) { const lvl = m[1].length, id = idOf(m[2]); const hd = h('h' + lvl, { id }); inline(m[2], hd); out.append(hd); if (lvl === 2) toc.push([id, m[2].replace(/[*`]/g, '')]); i++; continue; }
      if (l.startsWith('> ')) { const q = []; while (i < lines.length && lines[i].startsWith('> ')) q.push(lines[i++].slice(2)); out.append(inline(q.join(' '), h('div', { class: 'doc-note' }))); continue; }
      if (l.startsWith('|')) { const rows = []; while (i < lines.length && lines[i].startsWith('|')) rows.push(lines[i++]); const cells = (r) => r.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
        const hd = cells(rows[0]), tb = rows.slice(2).map(cells);
        out.append(h('div', { class: 'doc-table' }, h('table', {}, h('thead', {}, h('tr', {}, hd.map((c) => inline(c, h('th'))))), h('tbody', {}, tb.map((r) => h('tr', {}, r.map((c) => inline(c, h('td'))))))))); continue; }
      if (/^- /.test(l)) { const ul = h('ul'); while (i < lines.length && /^- /.test(lines[i])) ul.append(inline(lines[i++].slice(2), h('li'))); out.append(ul); continue; }
      if (/^\d+\. /.test(l)) { const ol = h('ol'); while (i < lines.length && /^\d+\. /.test(lines[i])) ol.append(inline(lines[i++].replace(/^\d+\. /, ''), h('li'))); out.append(ol); continue; }
      const p = []; while (i < lines.length && lines[i].trim() && !/^(#{2,3} |> |\||- |\d+\. )/.test(lines[i])) p.push(lines[i++]);
      out.append(inline(p.join(' '), h('p')));
    }
    return out;
  }
  const content = render(body);

  /* ---- layout: sidebar, article, on-this-page */
  const groups = []; index.forEach((x) => { const g = x.group || ''; let grp = groups.find((y) => y.name === g); if (!grp) groups.push(grp = { name: g, items: [] }); grp.items.push(x); });
  const side = h('nav', { class: 'doc-side', 'aria-label': 'Documentation' }, groups.map((g) => h('div', { class: 'doc-group' }, g.name ? h('h4', {}, g.name) : null,
    g.items.map((x) => h('a', { href: x.slug === 'home' ? '/docs' : '/docs/' + x.slug, class: x.slug === slug ? 'on' : '' }, x.title)))));
  const toggle = h('button', { type: 'button', class: 'btn ghost sm doc-toggle', 'aria-expanded': 'false', onclick: () => { const o = side.classList.toggle('open'); toggle.setAttribute('aria-expanded', String(o)); } }, 'Menu: ' + entry.title);
  const i = index.indexOf(entry), prev = index[i - 1], next = index[i + 1];
  const pn = (x, lbl) => x ? h('a', { class: 'doc-pn', href: x.slug === 'home' ? '/docs' : '/docs/' + x.slug }, h('small', {}, lbl), h('b', {}, x.title)) : h('span');
  const onThis = toc.length > 2 ? h('aside', { class: 'doc-toc', 'aria-label': 'On this page' }, h('h4', {}, 'On this page'), toc.map(([id, t]) => h('a', { href: '#' + id }, t))) : h('aside', { class: 'doc-toc' });
  const legal = (entry.group === 'Legal');
  app.replaceChildren(h('div', { class: 'wrap doc' }, toggle, side,
    h('article', { class: 'doc-main' },
      h('div', { class: 'doc-crumb' }, h('a', { href: '/docs' }, 'Docs'), entry.group ? ' / ' + entry.group : '', slug === 'home' ? '' : ' / ' + entry.title),
      h('h1', {}, meta.title),
      h('div', { class: 'doc-meta' }, h('span', { class: 'doc-date' }, 'Last updated: ' + meta.updated), legal ? h('span', { class: 'doc-date' }, 'Effective from: ' + meta.updated) : null),
      meta.summary ? h('p', { class: 'doc-sum' }, meta.summary) : null,
      content,
      h('div', { class: 'doc-nav' }, pn(prev, 'Previous'), pn(next, 'Next')),
      h('p', { class: 'doc-foot muted small' }, 'Need help? ', h('a', { href: REX.support, target: '_blank', rel: 'noopener noreferrer' }, 'Join the Rex Support Server'), '.')),
    onThis));
  if (location.hash) { const t = document.getElementById(decodeURIComponent(location.hash.slice(1))); if (t) t.scrollIntoView(); }
})();
