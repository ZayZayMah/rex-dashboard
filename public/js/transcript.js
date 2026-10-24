'use strict';
(async function () {
  const app = document.getElementById('app');
  await mountNav('');
  if (REX.blocked) return;
  const id = new URLSearchParams(location.search).get('id') || '';
  let tr;
  try { tr = await api('/api/transcript?id=' + encodeURIComponent(id)); } catch (e) {
    return app.replaceChildren(stateScreen('Transcript not found', e.message || 'This transcript was deleted or has expired.', h('a', { class: 'btn ghost', href: '/' }, 'Home')));
  }
  document.title = '#' + tr.channel + ' transcript - Rex';
  const hex = (n) => '#' + (n || 0).toString(16).padStart(6, '0');
  const time = (ts) => new Date(ts * 1000).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  const byId = Object.fromEntries(tr.messages.map((m) => [m.id, m]));
  const profile = (a) => 'https://discordapp.com/users/' + a.id;

  // Turn Discord markup into safe DOM nodes (no innerHTML anywhere).
  function inline(text, m) {
    const out = [];
    const re = /(`[^`\n]+`)|(\*\*[^*]+\*\*)|(__[^_]+__)|(\*[^*\n]+\*)|(<@!?(\d+)>)|(<@&(\d+)>)|(<#(\d+)>)|(https?:\/\/[^\s<]+)/g;
    let last = 0, x;
    while ((x = re.exec(text))) {
      if (x.index > last) out.push(text.slice(last, x.index));
      if (x[1]) out.push(h('code', { class: 'tx-code' }, x[1].slice(1, -1)));
      else if (x[2]) out.push(h('b', {}, x[2].slice(2, -2)));
      else if (x[3]) out.push(h('u', {}, x[3].slice(2, -2)));
      else if (x[4]) out.push(h('i', {}, x[4].slice(1, -1)));
      else if (x[5]) out.push(h('a', { class: 'tx-mention', href: 'https://discordapp.com/users/' + x[6], target: '_blank', rel: 'noopener noreferrer' }, '@' + ((m.users || {})[x[6]] || 'user')));
      else if (x[7]) { const r = (m.roles || {})[x[8]]; out.push(h('span', { class: 'tx-mention', style: r && r.color ? 'color:' + hex(r.color) : '' }, '@' + (r ? r.name : 'role'))); }
      else if (x[9]) out.push(h('span', { class: 'tx-mention' }, '#' + ((m.channels || {})[x[10]] || 'channel')));
      else if (x[11]) out.push(h('a', { href: x[11], target: '_blank', rel: 'noopener noreferrer nofollow' }, x[11]));
      last = x.index + x[0].length;
    }
    if (last < text.length) out.push(text.slice(last));
    return out;
  }
  function content(text, m) {
    if (!text) return null;
    const parts = text.split(/```/);
    return h('div', { class: 'tx-text' }, parts.map((p, i) => i % 2 ? h('pre', { class: 'tx-pre' }, p.replace(/^\w*\n/, '')) : h('span', {}, inline(p, m))));
  }
  const safeImg = (u) => (/^https:\/\/(cdn\.discordapp\.com|media\.discordapp\.net|images-ext-\d\.discordapp\.net)\//.test(u || '') ? u : null);
  function embed(e, m) {
    return h('div', { class: 'tx-embed', style: 'border-left-color:' + (e.color ? hex(e.color) : '#4f545c') },
      e.author ? h('div', { class: 'tx-eauth' }, e.author) : null, e.title ? h('div', { class: 'tx-etitle' }, e.title) : null,
      e.description ? content(e.description, m) : null,
      e.fields && e.fields.length ? h('div', { class: 'tx-fields' }, e.fields.map((f) => h('div', { class: f.inline ? 'in' : '' }, h('b', {}, f.name), h('div', {}, inline(f.value, m))))) : null,
      safeImg(e.image) ? h('img', { class: 'tx-eimg', src: safeImg(e.image), alt: '', loading: 'lazy' }) : null,
      e.footer ? h('div', { class: 'tx-efoot' }, e.footer) : null);
  }
  function attach(a) {
    const u = safeImg(a.url);
    if (u && /^image\//.test(a.type)) return h('a', { href: u, target: '_blank', rel: 'noopener noreferrer' }, h('img', { class: 'tx-img', src: u, alt: a.name, loading: 'lazy' }));
    return h('a', { class: 'tx-file', href: u || '#', target: '_blank', rel: 'noopener noreferrer' }, icon('link', 16), a.name, h('span', { class: 'muted small' }, ' ' + Math.max(1, Math.round((a.size || 0) / 1024)) + ' KB'));
  }

  const list = h('div', { class: 'tx-list' });
  let prev = null, lastDay = '';
  tr.messages.forEach((m) => {
    const day = new Date(m.ts * 1000).toDateString();
    if (day !== lastDay) { list.append(h('div', { class: 'tx-day' }, h('span', {}, new Date(m.ts * 1000).toLocaleDateString([], { dateStyle: 'long' })))); lastDay = day; prev = null; }
    if (m.system) { list.append(h('div', { class: 'tx-sys' }, m.author.name + ' - system message')); prev = null; return; }
    const cont = prev && prev.author.id === m.author.id && m.ts - prev.ts < 420 && !m.reply;
    const ref = m.reply && byId[m.reply.id];
    const row = h('div', { class: 'tx-msg' + (cont ? ' cont' : '') },
      cont ? h('span', { class: 'tx-hover' }, new Date(m.ts * 1000).toLocaleTimeString([], { timeStyle: 'short' }))
        : h('a', { class: 'tx-av', href: profile(m.author), target: '_blank', rel: 'noopener noreferrer', 'aria-label': m.author.name }, h('img', { src: safeImg(m.author.avatar) || '', alt: '', width: 40, height: 40, loading: 'lazy' })),
      h('div', { class: 'tx-body' },
        m.reply ? h('div', { class: 'tx-reply' }, ref ? ['Replying to ', h('b', {}, ref.author.name), ' ', (ref.content || 'attachment').slice(0, 80)] : 'Replying to an earlier message') : null,
        cont ? null : h('div', { class: 'tx-head' }, h('a', { class: 'tx-name', href: profile(m.author), target: '_blank', rel: 'noopener noreferrer', style: m.author.color ? 'color:' + hex(m.author.color) : '' }, m.author.name),
          m.author.bot ? h('span', { class: 'tx-bot' }, 'APP') : null, h('span', { class: 'tx-time' }, time(m.ts))),
        content(m.content, m), m.edited ? h('span', { class: 'tx-edited' }, '(edited)') : null,
        (m.attachments || []).map(attach), (m.embeds || []).map((e) => embed(e, m))));
    list.append(row); prev = m;
  });

  const canDelete = REX.me && (REX.me.guilds || []).some((g) => g.id === tr.gid && (g.admin || g.owner)) || (REX.me && REX.me.is_owner);
  const iconUrl = tr.guild.icon ? 'https://cdn.discordapp.com/icons/' + tr.gid + '/' + tr.guild.icon + '.png?size=96' : null;
  app.replaceChildren(h('div', { class: 'tx-wrap' },
    h('div', { class: 'tx-top' }, guildIcon({ name: tr.guild.name, icon_url: iconUrl }),
      h('div', { class: 'grow' }, h('h1', {}, '#' + tr.channel), h('div', { class: 'muted small' }, tr.guild.name + '  -  ' + tr.messages.length + ' messages  -  opened ' + time(tr.opened) + '  -  closed by ' + tr.closed_by.name)),
      tr.tier === 'ultra' ? tierBadge('ultra') : tierBadge(tr.tier),
      canDelete ? h('button', { class: 'btn danger sm', type: 'button', onclick: async () => {
        if (!confirm('Delete this transcript? The link will stop working.')) return;
        try { await api('/api/transcript?id=' + encodeURIComponent(id), { method: 'DELETE' }); location.href = '/'; } catch (e) { toast(e.message, 'bad'); }
      } }, icon('trash', 15), ' Delete') : null),
    h('div', { class: 'tx-chat' }, list),
    h('p', { class: 'muted small center' }, 'Saved by Rex. Click a name to open their Discord profile.' + (tr.exp ? ' This copy is kept until ' + fmtDate(tr.exp) + '.' : ''))));
})();
