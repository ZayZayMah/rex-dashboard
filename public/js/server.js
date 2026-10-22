'use strict';
(async function () {
  const app = document.getElementById('app');
  const savebar = document.getElementById('savebar');
  const me = await mountNav('dashboard');
  const gid = new URLSearchParams(location.search).get('id');

  function fail(title, text, withLogin) {
    app.replaceChildren(h('div', { class: 'panel empty' }, h('span', { class: 'mark', 'aria-hidden': 'true' }),
      h('h2', {}, title), h('p', { class: 'muted' }, text),
      withLogin ? h('a', { class: 'btn', href: '/auth/login' }, 'Login with Discord') : h('a', { class: 'btn ghost', href: '/dashboard' }, 'Back to servers')));
  }

  if (!me) return fail('Sign in first', 'Log in with Discord to manage this server.', true);
  if (!gid) return fail('No server selected', 'Pick a server from your list.');

  let data;
  try { data = await api('/api/guilds/' + encodeURIComponent(gid)); }
  catch (e) {
    if (e.status === 404) return fail('REX is not in this server', 'Add REX to the server first, then come back.');
    if (e.status === 403) return fail('No access', 'You need the Manage Server permission in that server.');
    return fail('Could not load', e.message);
  }

  const { guild, schema } = data;
  document.title = 'REX · ' + guild.name;
  let original = Object.assign({}, data.settings);
  let draft = Object.assign({}, data.settings);
  let history = data.history || [];

  const labels = {};
  schema.forEach((sec) => sec.settings.forEach((s) => { labels[s.key] = s.label; }));

  const dirtyKeys = () => Object.keys(draft).filter((k) => JSON.stringify(draft[k]) !== JSON.stringify(original[k]));
  function refreshBar() {
    const n = dirtyKeys().length;
    document.getElementById('savecount').textContent = n + (n === 1 ? ' unsaved change' : ' unsaved changes');
    savebar.classList.toggle('show', n > 0);
  }
  function set(key, value) { draft[key] = value; refreshBar(); }

  function control(setting, locked) {
    const id = 'f-' + setting.key;
    const value = draft[setting.key];
    let el;
    switch (setting.type) {
      case 'toggle':
        el = h('span', { class: 'switch' },
          h('input', { type: 'checkbox', id, checked: value ? true : null, disabled: locked ? true : null,
            onchange: (e) => set(setting.key, e.target.checked) }),
          h('span', { class: 'track', 'aria-hidden': 'true' }));
        el.querySelector('input').checked = !!value;
        return el;
      case 'text':
        el = setting.multiline
          ? h('textarea', { id, maxlength: setting.maxlen || 200, disabled: locked ? true : null, oninput: (e) => set(setting.key, e.target.value) })
          : h('input', { id, type: 'text', maxlength: setting.maxlen || 200, disabled: locked ? true : null, oninput: (e) => set(setting.key, e.target.value) });
        el.value = value;
        return el;
      case 'number':
        el = h('input', { id, type: 'number', inputmode: 'numeric', min: setting.min, max: setting.max, step: 1, disabled: locked ? true : null,
          oninput: (e) => { const n = parseInt(e.target.value, 10); set(setting.key, Number.isNaN(n) ? original[setting.key] : n); } });
        el.value = value;
        return el;
      case 'select':
        el = h('select', { id, disabled: locked ? true : null, onchange: (e) => set(setting.key, e.target.value) },
          setting.options.map((o) => h('option', { value: o.value }, o.label)));
        el.value = value;
        return el;
      case 'channel':
        el = h('select', { id, disabled: locked ? true : null, onchange: (e) => set(setting.key, e.target.value) },
          h('option', { value: '' }, '— None —'),
          guild.channels.map((c) => h('option', { value: c.id }, '# ' + c.name)));
        el.value = value;
        return el;
      case 'role':
        el = h('select', { id, disabled: locked ? true : null, onchange: (e) => set(setting.key, e.target.value) },
          h('option', { value: '' }, '— None —'),
          guild.roles.filter((r) => !r.managed).sort((a, b) => b.position - a.position).map((r) => h('option', { value: r.id }, '@ ' + r.name)));
        el.value = value;
        return el;
      default:
        return h('span', { class: 'muted' }, 'Unsupported');
    }
  }

  function render() {
    const side = h('nav', { class: 'side', 'aria-label': 'Sections' },
      schema.map((sec) => h('a', { href: '#sec-' + sec.id }, sec.name, sec.premium ? ' ★' : '')),
      h('a', { href: '#sec-activity' }, 'Activity'));

    const sections = schema.map((sec) => {
      const locked = sec.premium && !guild.premium;
      const head = h('div', { class: 'section-head' }, h('h2', {}, sec.name),
        sec.premium ? h('span', { class: 'badge premium' }, 'Premium') : null);
      const panel = h('section', { class: 'panel' + (locked ? ' locked' : ''), id: 'sec-' + sec.id }, head,
        h('p', { class: 'muted', style: null }, sec.description));
      if (locked) {
        panel.append(h('div', { class: 'lock-note' }, h('span', {}, 'This section needs REX Premium on this server.'),
          h('span', { class: 'muted' }, 'Run '), h('code', {}, '/redeem'), h('span', { class: 'muted' }, ' in Discord to activate it.')));
      }
      sec.settings.forEach((s) => {
        const lockedHere = s.premium && !guild.premium;
        panel.append(h('div', { class: 'setting' },
          h('div', {}, h('label', { class: 'name', for: 'f-' + s.key }, s.label), h('div', { class: 'desc' }, s.description)),
          h('div', { class: 'ctl' }, control(s, lockedHere))));
      });
      return panel;
    });

    const activity = h('section', { class: 'panel', id: 'sec-activity' }, h('h2', {}, 'Recent changes'));
    if (!history.length) activity.append(h('p', { class: 'muted' }, 'No changes yet.'));
    else activity.append(h('ul', { class: 'history' }, history.map((e) =>
      h('li', {}, h('strong', {}, e.n || 'Someone'), h('span', { class: 'muted' }, 'changed ' + e.k.map((k) => labels[k] || k).join(', ')),
        h('time', {}, timeAgo(e.t))))));

    const badges = h('div', { class: 'meta' },
      guild.premium ? h('span', { class: 'badge premium' }, 'Premium') : h('span', { class: 'badge' }, 'Free'),
      h('span', { class: 'muted small' }, (guild.member_count || 0).toLocaleString() + ' members'));

    app.replaceChildren(
      h('div', { class: 'page-head' }, guildIcon(guild, true), h('div', {}, h('div', { class: 'eyebrow' }, 'Server settings'), h('h1', {}, guild.name), badges),
        h('a', { class: 'btn ghost sm', href: '/dashboard', style: null }, '← Servers')),
      h('div', { class: 'layout' }, side, h('div', { class: 'sections' }, sections, activity)));
    refreshBar();
  }

  document.getElementById('discard').addEventListener('click', () => { draft = Object.assign({}, original); render(); });
  document.getElementById('save').addEventListener('click', async (ev) => {
    const btn = ev.currentTarget;
    const changes = {};
    dirtyKeys().forEach((k) => { changes[k] = draft[k]; });
    if (!Object.keys(changes).length) return;
    btn.disabled = true;
    try {
      const res = await api('/api/guilds/' + encodeURIComponent(gid) + '/settings', { method: 'PUT', body: { changes } });
      original = Object.assign({}, res.settings);
      draft = Object.assign({}, res.settings);
      history = res.history || history;
      render();
      toast('Saved. REX will pick this up within a minute.', 'good');
    } catch (e) {
      toast(e.message, 'bad');
    } finally {
      btn.disabled = false;
    }
  });
  window.addEventListener('beforeunload', (e) => { if (dirtyKeys().length) { e.preventDefault(); e.returnValue = ''; } });

  render();
})();
