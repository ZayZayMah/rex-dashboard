'use strict';
(async function () {
  const app = document.getElementById('app');
  await mountNav('commands');
  const name = slug(new URLSearchParams(location.search).get('c') || '');
  const cat = await loadCatalog();
  const cmd = cat.commands.find((c) => c.name === name);

  if (!cmd) {
    app.replaceChildren(h('div', { class: 'panel empty' }, h('span', { class: 'mark', 'aria-hidden': 'true' }), h('h2', {}, 'Command not found'),
      h('p', { class: 'muted' }, name ? 'There is no command called /' + name + '.' : 'No command selected.'), h('a', { class: 'btn', href: '/commands' }, 'Browse commands')));
    return;
  }
  document.title = 'REX · /' + cmd.name;
  const g = cmd.guide || {};
  const category = CATEGORIES.find((c) => c.id === cmd.category);

  const paramRows = (cmd.params || []).length
    ? h('table', { class: 'tbl' }, h('thead', {}, h('tr', {}, h('th', {}, 'Option'), h('th', {}, 'Required'), h('th', {}, 'What it does'))),
      h('tbody', {}, cmd.params.map((p) => h('tr', {},
        h('td', {}, h('code', {}, p.name)),
        h('td', {}, p.required ? h('span', { class: 'badge warn' }, 'Required') : h('span', { class: 'muted' }, 'Optional')),
        h('td', {}, (p.description || '—'),
          p.choices && p.choices.length ? h('div', { class: 'muted small' }, 'Choices: ' + p.choices.map((c) => c.name).join(', ')) : null,
          p.min != null || p.max != null ? h('div', { class: 'muted small' }, 'Range: ' + (p.min != null ? p.min : '…') + ' to ' + (p.max != null ? p.max : '…')) : null)))))
    : h('p', { class: 'muted' }, 'This command has no options. Just run it.');

  const who = { everyone: 'Any member can run this command.', staff: 'Server staff and the server owner can run this. REX counts Manage Server, Administrator, Manage Messages, Moderate Members and your configured staff roles.', owner: 'Only the REX bot owners can run this command.' }[cmd.access];

  const siblings = cat.commands.filter((c) => c.category === cmd.category && c.name !== cmd.name).slice(0, 8);
  const top = cmd.name.split(' ')[0];

  app.replaceChildren(...[
    h('div', { class: 'crumbs' }, h('a', { href: '/commands' }, 'Commands'), h('span', {}, '/'), category ? h('a', { href: '/commands?cat=' + category.id }, category.name) : null, h('span', {}, '/'), '/' + cmd.name),
    h('div', { class: 'page-head' }, h('div', {}, h('div', { class: 'eyebrow' }, category ? category.name : 'Command'), h('h1', { style: 'font-family:var(--mono)' }, '/' + cmd.name),
      h('div', { class: 'meta' }, accessBadge(cmd.access), requiresBadges(cmd)))),
    h('div', { class: 'grid cols-2' },
      h('section', { class: 'panel' }, h('h2', {}, 'What it does'), h('p', {}, g.summary || cmd.description || 'No description yet.'),
        g.details ? h('p', { class: 'muted' }, g.details) : null,
        h('h3', { style: 'margin-top:18px' }, 'Usage'), usageNode(cmd),
        g.example ? [h('h3', { style: 'margin-top:18px' }, 'Example'), h('div', { class: 'usage' }, g.example)] : null,
        g.tips && g.tips.length ? [h('h3', { style: 'margin-top:18px' }, 'Good to know'), h('ul', { class: 'muted' }, g.tips.map((t) => h('li', {}, t)))] : null),
      h('section', { class: 'panel' }, h('h2', {}, 'Who can use it'), h('p', {}, who),
        (cmd.requires || []).length ? h('p', {}, 'Needs an active ', (cmd.requires || []).map((r) => tierBadge(r)), ' on the server. ', h('a', { href: '/premium' }, 'See tiers')) : null,
        h('h3', { style: 'margin-top:18px' }, 'Options'), paramRows)),
    siblings.length ? h('section', {}, h('div', { class: 'section-title' }, h('h2', {}, 'Related commands')),
      h('div', { class: 'cmd-list' }, siblings.map((c) => h('a', { class: 'cmd', href: '/command?c=' + encodeURIComponent(c.name) },
        h('span', { class: 'nm' }, '/' + c.name), h('span', { class: 'ds' }, c.description), h('span', { class: 'tags' }, accessBadge(c.access)))))) : null,
    h('p', { class: 'src-note' }, 'Need help with ', '/' + top, '? ', h('a', { href: REX.support, target: '_blank', rel: 'noopener noreferrer' }, 'Ask in the support server'), '.')].filter(Boolean));
})();
