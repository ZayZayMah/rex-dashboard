'use strict';
(async function () {
  const app = document.getElementById('app');
  await mountNav('commands');
  if (REX.blocked) return;
  const cat = await loadCatalog();
  const params = new URLSearchParams(location.search);
  const state = { q: params.get('q') || '', cat: params.get('cat') || 'all', access: params.get('access') || 'all', tier: params.get('tier') || 'all' };

  const counts = { all: cat.commands.length };
  CATEGORIES.forEach((c) => { counts[c.id] = cat.commands.filter((x) => x.category === c.id).length; });

  const search = h('input', { type: 'search', placeholder: 'Search commands', 'aria-label': 'Search commands', value: state.q, autocomplete: 'off' });
  const accessSel = h('select', { 'aria-label': 'Who can use it' }, h('option', { value: 'all' }, 'Anyone can use'), h('option', { value: 'everyone' }, 'Everyone'), h('option', { value: 'staff' }, 'Server staff'));
  const tierSel = h('select', { 'aria-label': 'Tier' }, h('option', { value: 'all' }, 'Any tier'), h('option', { value: 'free' }, 'No tier needed'), h('option', { value: 'premium' }, 'Premium'), h('option', { value: 'priority' }, 'Priority'), h('option', { value: 'ultra' }, 'Ultra'));
  accessSel.value = state.access; tierSel.value = state.tier;
  const chips = h('div', { class: 'cat-chips', role: 'group', 'aria-label': 'Categories' });
  const list = h('div', { id: 'list' });
  const count = h('div', { class: 'muted small center', 'aria-live': 'polite', style: 'margin-bottom:6px' });

  function sync() {
    const p = new URLSearchParams();
    if (state.q) p.set('q', state.q);
    if (state.cat !== 'all') p.set('cat', state.cat);
    if (state.access !== 'all') p.set('access', state.access);
    if (state.tier !== 'all') p.set('tier', state.tier);
    history.replaceState(null, '', location.pathname + (p.toString() ? '?' + p : ''));
  }
  function drawChips() {
    const mk = (id, name) => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(state.cat === id), onclick: () => { state.cat = id; sync(); drawChips(); draw(); } }, name, h('span', { class: 'n' }, counts[id] || 0));
    chips.replaceChildren(mk('all', 'All'), ...CATEGORIES.map((c) => mk(c.id, c.name)));
  }
  function matches(c) {
    if (state.cat !== 'all' && c.category !== state.cat) return false;
    if (state.access !== 'all' && c.access !== state.access) return false;
    if (state.tier === 'free' && (c.requires || []).length) return false;
    if (['premium', 'priority', 'ultra'].includes(state.tier) && !(c.requires || []).includes(state.tier)) return false;
    if (state.q) {
      const hay = (c.name + ' ' + c.description + ' ' + (c.params || []).map((p) => p.name + ' ' + p.description).join(' ')).toLowerCase();
      return state.q.toLowerCase().split(/\s+/).every((w) => hay.includes(w));
    }
    return true;
  }
  function open(c) {
    history.replaceState(null, '', '#' + encodeURIComponent(c.name));
    const m = openModal('/' + c.name, ...commandDetail(c, cat));
    const orig = m.close;
    m.box.querySelector('.x').addEventListener('click', () => history.replaceState(null, '', location.pathname + location.search));
  }
  function card(c) {
    return h('button', { class: 'cmd-card', type: 'button', onclick: () => open(c) },
      h('span', { class: 'nm' }, '/' + c.name),
      h('span', { class: 'ds' }, (c.guide && c.guide.summary) || c.description || 'No description yet.'),
      h('span', { class: 'tags' }, accessBadge(c.access), requiresBadges(c)));
  }
  function draw() {
    const shown = cat.commands.filter(matches);
    count.textContent = shown.length + (shown.length === 1 ? ' command' : ' commands');
    if (!shown.length) { list.replaceChildren(stateScreen('No commands match', 'Try a different search or clear the filters.')); return; }
    const nodes = [];
    CATEGORIES.forEach((c) => {
      const inCat = shown.filter((x) => x.category === c.id);
      if (!inCat.length) return;
      nodes.push(h('div', { class: 'cmd-group' }, h('h2', {}, c.name), h('p', {}, c.blurb)));
      nodes.push(h('div', { class: 'cmd-grid' }, inCat.map(card)));
    });
    list.replaceChildren(...nodes);
  }
  search.addEventListener('input', () => { state.q = search.value.trim(); sync(); draw(); });
  accessSel.addEventListener('change', () => { state.access = accessSel.value; sync(); draw(); });
  tierSel.addEventListener('change', () => { state.tier = tierSel.value; sync(); draw(); });

  const note = cat.live ? 'Live list from the bot' + (cat.ts ? ', updated ' + timeAgo(cat.ts) : '') + '.' : 'Showing the built-in list. It switches to the live list when the bot connects.';
  app.replaceChildren(
    subnav('commands'),
    h('div', { class: 'page-head' }, h('h1', {}, 'Commands'), h('p', {}, 'Pick a command to see how it works, its options and who can run it.')),
    h('div', { class: 'filters' }, search, accessSel, tierSel), chips, count, list,
    h('p', { class: 'src-note' }, note, ' Custom commands made by a server are not listed.'));
  drawChips(); draw();
  const deep = decodeURIComponent((location.hash || '').slice(1));
  if (deep) { const c = cat.commands.find((x) => x.name === deep); if (c) open(c); }
})();
