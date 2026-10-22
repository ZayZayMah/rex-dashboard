'use strict';
(async function () {
  const app = document.getElementById('app');
  await mountNav('commands');
  const cat = await loadCatalog();
  const params = new URLSearchParams(location.search);
  const state = { q: params.get('q') || '', cat: params.get('cat') || 'all', access: params.get('access') || 'all', tier: params.get('tier') || 'all' };

  const counts = { all: cat.commands.length };
  CATEGORIES.forEach((c) => { counts[c.id] = cat.commands.filter((x) => x.category === c.id).length; });

  const search = h('input', { type: 'search', id: 'q', placeholder: 'Search commands…', 'aria-label': 'Search commands', value: state.q, autocomplete: 'off' });
  const accessSel = h('select', { 'aria-label': 'Who can use it' },
    h('option', { value: 'all' }, 'Anyone'), h('option', { value: 'everyone' }, 'Everyone'), h('option', { value: 'staff' }, 'Server staff'), h('option', { value: 'owner' }, 'Bot owner'));
  const tierSel = h('select', { 'aria-label': 'Tier' },
    h('option', { value: 'all' }, 'Any tier'), h('option', { value: 'free' }, 'No tier needed'), h('option', { value: 'premium' }, 'Premium'), h('option', { value: 'priority' }, 'Priority'), h('option', { value: 'ultra' }, 'Ultra'));
  accessSel.value = state.access; tierSel.value = state.tier;
  const chips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Categories' });
  const list = h('div', { id: 'list' });
  const count = h('span', { class: 'muted small', 'aria-live': 'polite' });

  function sync() {
    const p = new URLSearchParams();
    if (state.q) p.set('q', state.q);
    if (state.cat !== 'all') p.set('cat', state.cat);
    if (state.access !== 'all') p.set('access', state.access);
    if (state.tier !== 'all') p.set('tier', state.tier);
    history.replaceState(null, '', location.pathname + (p.toString() ? '?' + p : ''));
  }

  function drawChips() {
    const mk = (id, name) => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(state.cat === id), onclick: () => { state.cat = id; sync(); drawChips(); draw(); } },
      name, h('span', { class: 'n' }, counts[id] || 0));
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

  function row(c) {
    return h('a', { class: 'cmd', href: '/command?c=' + encodeURIComponent(c.name) },
      h('span', { class: 'nm' }, '/' + c.name),
      h('span', { class: 'ds' }, (c.guide && c.guide.summary) || c.description || 'No description yet.'),
      h('span', { class: 'tags' }, accessBadge(c.access), requiresBadges(c)));
  }

  function draw() {
    const shown = cat.commands.filter(matches);
    count.textContent = shown.length + (shown.length === 1 ? ' command' : ' commands');
    if (!shown.length) {
      list.replaceChildren(h('div', { class: 'panel empty' }, h('h2', {}, 'No commands match'), h('p', { class: 'muted' }, 'Try a different search or clear the filters.')));
      return;
    }
    const nodes = [];
    CATEGORIES.forEach((c) => {
      const inCat = shown.filter((x) => x.category === c.id);
      if (!inCat.length) return;
      nodes.push(h('div', { class: 'cmd-group' }, h('h2', {}, c.name), h('p', {}, c.blurb)));
      nodes.push(h('div', { class: 'cmd-list' }, inCat.map(row)));
    });
    list.replaceChildren(...nodes);
  }

  search.addEventListener('input', () => { state.q = search.value.trim(); sync(); draw(); });
  accessSel.addEventListener('change', () => { state.access = accessSel.value; sync(); draw(); });
  tierSel.addEventListener('change', () => { state.tier = tierSel.value; sync(); draw(); });

  const note = cat.live
    ? 'Live list from the bot' + (cat.ts ? ' · updated ' + timeAgo(cat.ts) : '') + '.'
    : 'Showing the built-in list. It switches to the live list as soon as the bot connects to the dashboard.';

  app.replaceChildren(
    h('div', { class: 'page-head' }, h('div', {}, h('div', { class: 'eyebrow' }, 'Command directory'), h('h1', {}, 'Every REX command'),
      h('p', { class: 'lead' }, 'Open a command to see how to use it, its options and who is allowed to run it.'))),
    h('nav', { class: 'subnav', 'aria-label': 'About sections' }, h('a', { href: '/about' }, 'Overview'), h('a', { class: 'active', href: '/commands' }, 'Command directory'), h('a', { href: '/premium' }, 'Premium')),
    h('div', { class: 'filters' }, search, accessSel, tierSel), chips, h('div', { style: 'margin-bottom:10px' }, count), list,
    h('p', { class: 'src-note' }, note, ' Commands specific to one server (custom commands) are not listed.'));
  drawChips(); draw();
})();
