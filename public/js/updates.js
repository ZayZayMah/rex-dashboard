'use strict';
(async function () {
  const app = document.getElementById('app');
  await mountNav('updates');
  if (REX.blocked) return;
  let d;
  try { d = await api('/api/updates'); } catch (e) { return app.replaceChildren(subnav('updates'), stateScreen('Updates are not available', e.message)); }
  const nice = (s) => { const t = new Date(s + 'T00:00:00Z'); return isNaN(t) ? s : t.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }); };
  const md = (text) => {                      // **bold**, *italic*, `code`, [label](/path) only
    const out = [];
    const re = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\((?:\/|https:\/\/)[^)\s]*\))/g;
    let last = 0, m;
    while ((m = re.exec(text))) {
      if (m.index > last) out.push(text.slice(last, m.index));
      const t = m[0];
      if (t.startsWith('**')) out.push(h('b', {}, t.slice(2, -2)));
      else if (t.startsWith('`')) out.push(h('code', {}, t.slice(1, -1)));
      else { const mm = /\[([^\]]+)\]\(([^)]+)\)/.exec(t); out.push(h('a', { href: mm[2] }, mm[1])); }
      last = m.index + t.length;
    }
    if (last < text.length) out.push(text.slice(last));
    return out;
  };
  const card = (f) => h('article', { class: 'upd-card' + (f.big ? ' big' : '') },
    h('div', { class: 'upd-meta' }, h('span', { class: 'upd-badge' }, f.big ? 'Big update' : 'New'), h('time', { datetime: f.date }, nice(f.date))),
    h('h3', {}, f.title),
    f.summary ? h('p', { class: 'upd-sum' }, md(f.summary)) : null,
    (f.items || []).length > 1 ? h('ul', { class: 'upd-list' }, f.items.slice(0, 8).map((i) => h('li', {}, md(i)))) : null,
    f.topic ? h('a', { class: 'btn ghost sm', href: '/pages/' + f.topic }, 'Read more') : null);

  const byDate = {};
  d.fixes.forEach((x) => { (byDate[x.date] = byDate[x.date] || []).push(x.text); });
  app.replaceChildren(
    subnav('updates'),
    h('div', { class: 'page-head' }, h('h1', {}, "What's new in Rex"),
      h('p', {}, d.intro || 'The newest features first. Entries stay here for ' + d.keep_days + ' days, and small fixes are listed at the bottom.')),
    h('div', { class: 'narrow stack upd' },
      d.features.length ? d.features.map(card) : [h('p', { class: 'muted center' }, 'Nothing new yet. Check back soon.')],
      h('section', { class: 'frame', id: 'fixes' },
        h('h2', {}, 'Minor updates and bug fixes'),
        Object.keys(byDate).length ? Object.keys(byDate).sort().reverse().map((date) => h('div', { class: 'upd-fixday' },
          h('h4', {}, nice(date)), h('ul', { class: 'upd-list' }, byDate[date].map((t) => h('li', {}, md(t)))))) : h('p', { class: 'muted' }, 'No fixes listed yet.'),
        h('a', { class: 'btn ghost sm', href: '/pages/bug-fixes' }, 'Open the bug fixes page'))));
})();
