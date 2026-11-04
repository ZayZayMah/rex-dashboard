'use strict';
(async function () {
  const app = document.getElementById('app');
  await mountNav('updates');
  if (REX.blocked) return;
  let d;
  try { d = await api('/api/updates'); } catch (e) { return app.replaceChildren(stateScreen('Updates are not available', e.message)); }
  const nice = (s) => { const t = new Date(s + 'T00:00:00Z'); return isNaN(t) ? s : t.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }); };
  const lead = (items) => { for (const i of items || []) { const m = /^\s*(\p{Extended_Pictographic}\uFE0F?)/u.exec(i); if (m) return m[1]; } return '✨'; };
  const md = (text) => {                      // **bold**, `code`, [label](/path or https://…) only
    const out = [], re = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\((?:\/|https:\/\/)[^)\s]*\))/g;
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
  const more = (f) => (f.topic ? [' ', h('a', { class: 'upd-more', href: '/pages/' + f.topic }, 'Read more →')] : []);
  const feats = d.features.slice(), first = feats.shift();
  const topics = [...new Set(d.features.map((f) => f.topic).filter(Boolean))];

  const card = (f, i) => h('article', { class: 'upd-card' + (f.big ? ' big' : (i % 7 === 3 ? ' wide' : '')), 'data-topic': f.topic || '' },
    h('div', { class: 'upd-top' }, h('span', { class: 'upd-ico' }, lead(f.items)), h('time', { class: 'upd-date', datetime: f.date }, nice(f.date)), f.topic ? h('span', { class: 'upd-tag' }, '#' + f.topic) : null),
    f.big ? h('span', { class: 'upd-badge' }, 'Big update') : null,
    h('h3', {}, f.title),
    f.summary ? h('p', { class: 'upd-sum' }, md(f.summary), more(f)) : null,
    (f.items || []).length > 1 ? h('ul', { class: 'upd-list' }, f.items.slice(0, f.big || i % 7 === 3 ? 5 : 3).map((x) => h('li', {}, md(x)))) : null);

  const grid = h('div', { class: 'upd-grid' }, feats.map(card));
  const chips = h('div', { class: 'upd-chips' });
  let on = '';
  const paintChips = () => chips.replaceChildren(...[['', 'All']].concat(topics.map((t) => [t, '#' + t])).map(([v, l]) => h('button', { type: 'button', class: 'upd-chip' + (on === v ? ' on' : ''), onclick: () => {
    on = v; paintChips(); grid.querySelectorAll('.upd-card').forEach((c) => { c.hidden = !!on && c.dataset.topic !== on; });
  } }, l)));
  paintChips();

  const byDate = {};
  d.fixes.forEach((x) => { (byDate[x.date] = byDate[x.date] || []).push(x.text); });
  const sum = (f) => ({ day: new Date(f.date + 'T00:00:00Z').getUTCDate(), mon: new Date(f.date + 'T00:00:00Z').toLocaleDateString(undefined, { month: 'short', year: 'numeric', timeZone: 'UTC' }).toUpperCase() });

  app.replaceChildren(h('div', { class: 'upd-page' },
    h('section', { class: 'upd-hero' },
      h('div', { class: 'upd-brand' }, h('img', { src: '/img/rex-logo.png', alt: 'Rex' }), h('div', {}, h('div', { class: 'upd-eyebrow' }, 'Rex · Update log'), h('h1', {}, "What's new in Rex"),
        h('p', {}, d.intro || 'The newest features first. Entries stay for ' + d.keep_days + ' days and small fixes are listed at the bottom.'))),
      h('div', { class: 'upd-stats' }, h('span', { class: 'upd-pill' }, '✨ ' + d.features.length + ' new'), h('span', { class: 'upd-pill' }, '🛠 ' + d.fixes.length + ' fixes'))),
    topics.length > 1 ? chips : null,
    first ? h('section', { class: 'upd-feature' },
      h('div', {}, h('span', { class: 'upd-badge' }, first.big ? 'Big update' : 'Newest'), h('h2', {}, first.title),
        first.summary ? h('p', { class: 'upd-sum' }, md(first.summary), more(first)) : null,
        (first.items || []).length ? h('ul', { class: 'upd-list' }, first.items.slice(0, 5).map((x) => h('li', {}, md(x)))) : null),
      h('div', { class: 'upd-dateorb' }, h('div', {}, h('b', {}, sum(first).day), h('span', {}, sum(first).mon)))) : h('p', { class: 'muted center' }, 'Nothing new yet. Check back soon.'),
    feats.length ? grid : null,
    h('section', { class: 'upd-fixes', id: 'fixes' }, h('h2', {}, '🛠 Minor updates and bug fixes'),
      Object.keys(byDate).length ? h('div', { class: 'upd-fixcols' }, Object.keys(byDate).sort().reverse().map((date) => h('div', { class: 'upd-fixday' },
        h('span', { class: 'upd-pill' }, nice(date)), h('ul', {}, byDate[date].map((t) => h('li', {}, md(t))))))) : h('p', { class: 'muted' }, 'No fixes listed yet.'),
      h('p', {}, h('a', { class: 'upd-more', href: '/pages/bug-fixes' }, 'Open the bug fixes page →'))),
    h('p', { class: 'upd-foot' }, '♥ by Rex Team')));
})();
