'use strict';
(async function () {
  const app = document.getElementById('app');
  await mountNav('');
  if (REX.blocked) return;
  const id = new URLSearchParams(location.search).get('id') || '';
  let rec;
  try { rec = await api('/api/incident?id=' + encodeURIComponent(id)); } catch (e) {
    const msg = /401|log/i.test(e.message || '') ? 'Log in with Discord as a server admin to read this report.' : (e.message || 'This incident report has expired or does not exist.');
    return app.replaceChildren(stateScreen('Incident report unavailable', msg, h('a', { class: 'btn lg', href: '/auth/login' }, 'Log in with Discord')));
  }
  const r = rec.report || {};
  document.title = (r.title || 'Incident') + ' - Rex';
  const time = (ts) => ts ? new Date(ts * 1000).toLocaleString([], { dateStyle: 'medium', timeStyle: 'medium' }) : '-';
  const pill = (t, c) => h('span', { class: 'inc-pill ' + (c || '') }, t);
  const card = (title, big, sub) => h('div', { class: 'inc-card' }, h('h3', {}, title), h('div', { class: 'big' }, String(big)), sub ? h('div', { class: 'muted small' }, sub) : null);
  const kv = (rows) => h('dl', { class: 'inc-kv' }, rows.filter((x) => x && x[1] !== undefined && x[1] !== null && x[1] !== '').flatMap(([k, v]) => [h('dt', {}, k), h('dd', {}, v)]));
  const perms = (list, cls) => (list || []).map((p) => h('span', { class: 'inc-perm ' + cls }, p));
  const statusClass = r.status === 'recovered' ? 'ok' : r.status === 'ignored' ? 'mute' : '';

  const head = h('div', { class: 'inc-head' }, h('h1', {}, r.title || 'Incident report'), pill((r.status || 'open').toUpperCase(), statusClass), r.kind ? pill(r.kind === 'raid' ? 'ANTI RAID' : 'ANTI BETRAY', 'mute') : null);
  const sum = h('div', { class: 'inc-grid' },
    card('Server', (r.guild && r.guild.name) || 'Server', 'Started ' + time(r.started)),
    card('Changes', (r.events || []).length, 'Last update ' + time(r.updated)),
    card(r.kind === 'raid' ? 'People involved' : 'People responsible', (r.actors || r.raiders || []).length, (r.actors || []).map((a) => a.name + ' (' + a.count + ')').join(', ')));

  const nodes = [head, sum];

  if ((r.actions || []).length) {
    nodes.push(h('h2', { class: 'inc-sec' }, 'What Rex did'));
    r.actions.forEach((a) => nodes.push(h('div', { class: 'inc-line' }, h('time', {}, time(a.t)), h('span', {}, a.text))));
  }

  if ((r.events || []).length) {
    nodes.push(h('h2', { class: 'inc-sec' }, 'Timeline'));
    r.events.forEach((e) => nodes.push(h('div', { class: 'inc-line' }, h('time', {}, time(e.t)), h('span', {}, h('b', {}, e.label || e.kind), ' ', e.target || '', e.who ? ' by ' + e.who.name + ' (' + e.who.id + ')' : ' by unknown'), e.sig ? h('span', { class: 'muted small' }, e.sig) : null)));
  }

  if ((r.raiders || []).length) {
    nodes.push(h('h2', { class: 'inc-sec' }, 'Everyone involved (' + r.raiders.length + ')'));
    const rows = r.raiders.map((u) => h('tr', {}, h('td', {}, u.name), h('td', {}, u.id), h('td', {}, time(u.created)), h('td', {}, time(u.joined)), h('td', {}, u.why || ''), h('td', {}, u.action || '')));
    nodes.push(h('div', { class: 'inc-card', style: 'overflow:auto' }, h('table', { class: 'table', style: 'width:100%;font-size:.88rem' }, h('thead', {}, h('tr', {}, ['Name', 'ID', 'Account created', 'Joined', 'Why flagged', 'Rex did'].map((x) => h('th', { style: 'text-align:left' }, x)))), h('tbody', {}, rows))));
  }

  function msgNode(m) {
    return h('div', { class: 'inc-m' }, h('img', { class: 'av', src: m.avatar || '/img/favicon.svg', alt: '', loading: 'lazy' }),
      h('div', {}, h('div', {}, h('span', { class: 'n' }, m.name || 'Unknown'), m.bot ? h('span', { class: 'inc-perm' }, 'BOT') : null, h('span', { class: 't' }, time(m.ts))),
        m.content ? h('div', { class: 'c' }, m.content) : null,
        (m.embeds || []).map((e) => h('div', { class: 'inc-embed', style: 'border-left-color:#' + ((e.color || 0x5865f2).toString(16).padStart(6, '0')) }, e.title ? h('b', {}, e.title) : null, e.description ? h('div', { class: 'c' }, e.description) : null, (e.fields || []).map((f) => h('div', {}, h('b', {}, f.name), h('div', { class: 'c' }, f.value))))),
        (m.attachments || []).map((a) => h('div', { class: 'inc-lost' }, '📎 ' + a.name + (a.voice ? ' (voice message, ' + a.voice + 's)' : ''))),
        (m.buttons || []).length ? h('div', { class: 'inc-lost' }, 'Buttons: ' + m.buttons.join(' | ') + ' - those are not recovered') : null));
  }

  if ((r.channels || []).length) {
    nodes.push(h('h2', { class: 'inc-sec' }, 'Channels affected'));
    r.channels.forEach((c) => {
      const body = h('div', { class: 'body' },
        kv([['Type', c.type], ['Category', c.category], ['Topic', c.topic], ['Slowmode', c.slowmode ? c.slowmode + 's' : ''], ['NSFW', c.nsfw ? 'yes' : ''], ['Voice limit', c.user_limit || ''], ['Messages backed up', c.message_count], ['Members who could see it', c.members]]),
        (c.changes || []).length ? h('div', { class: 'inc-diff' }, h('b', {}, 'What changed'), (c.changes || []).map((d) => h('div', {}, d.field + ': ', h('span', { class: 'old' }, String(d.before)), ' → ', h('span', { class: 'new' }, String(d.after))))) : null,
        (c.overwrites || []).length ? h('div', {}, h('b', {}, 'Permissions'), c.overwrites.map((o) => h('div', { style: 'margin:6px 0' }, h('span', {}, o.name + ' (' + o.type + ') '), perms(o.allow, 'allow'), perms(o.deny, 'deny')))) : null,
        (c.messages || []).length ? h('div', { class: 'inc-msgs' }, c.messages.map(msgNode)) : null);
      nodes.push(h('details', { class: 'inc-item' }, h('summary', {}, (c.deleted ? '🗑️ ' : '✏️ ') + (c.type === 'voice' ? '🔊 ' : '#') + c.name, pill(c.deleted ? 'DELETED' : 'CHANGED', c.deleted ? '' : 'mute')), body));
    });
  }

  if ((r.roles || []).length) {
    nodes.push(h('h2', { class: 'inc-sec' }, 'Roles affected'));
    r.roles.forEach((x) => nodes.push(h('details', { class: 'inc-item' },
      h('summary', {}, h('span', { style: x.color ? 'color:#' + x.color.toString(16).padStart(6, '0') : '' }, '@' + x.name), pill(x.deleted ? 'DELETED' : 'CHANGED', x.deleted ? '' : 'mute')),
      h('div', { class: 'body' }, kv([['Members', x.members], ['Hoisted', x.hoist ? 'yes' : ''], ['Mentionable', x.mentionable ? 'yes' : '']]),
        (x.changes || []).length ? h('div', { class: 'inc-diff' }, h('b', {}, 'What changed'), x.changes.map((d) => h('div', {}, d.field + ': ', h('span', { class: 'old' }, String(d.before)), ' → ', h('span', { class: 'new' }, String(d.after))))) : null,
        h('div', {}, h('b', {}, 'Permissions'), h('div', {}, perms(x.permissions, 'allow')))))));
  }

  nodes.push(h('p', { class: 'muted small', style: 'margin-top:28px' }, 'This report is only visible to admins of this server and is kept for 30 days. Press Recover in the DM from Rex to restore everything shown here.'));
  app.replaceChildren(...nodes);
})();
