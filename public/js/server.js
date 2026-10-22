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
  try { data = await api('/api/guilds/' + encodeURIComponent(gid)); } catch (e) {
    if (e.status === 404) return fail('REX is not in this server', 'Add REX to the server and give it a minute to report in, then come back.');
    if (e.status === 403) return fail('No access', 'You need the Manage Server permission in that server.');
    return fail('Could not load', e.message);
  }
  const { guild } = data;
  const schema = data.schema;
  if (!schema || !schema.sections || !schema.sections.length) {
    return fail('Settings are not available yet', 'REX has not sent its settings list to the website. Make sure the bot is online and the dashboard connector is installed.');
  }
  document.title = 'REX · ' + guild.name;

  let original = Object.assign({}, data.values);
  let draft = Object.assign({}, data.values);
  let pending = data.pending || [];
  let results = data.results || [];
  let errors = {};
  let botOnline = data.bot_online;
  const canAdmin = data.can_admin;
  const owner = data.owner_override;
  const TIER_RANK = { free: 0, premium: 1, priority: 1, ultra: 1 };

  const labelOf = {};
  schema.sections.forEach((s) => s.settings.forEach((x) => { labelOf[x.key] = x.label; }));
  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const dirtyKeys = () => Object.keys(draft).filter((k) => !eq(draft[k], original[k]));
  const tierOn = (t) => t === 'free' || owner || (guild.tiers[t] && guild.tiers[t].active);
  const lockReason = (spec) => {
    if (!tierOn(spec.tier)) return 'tier';
    if (spec.perm === 'admin' && !canAdmin) return 'perm';
    return null;
  };

  function refreshBar() {
    const n = dirtyKeys().length;
    document.getElementById('savecount').textContent = n + (n === 1 ? ' unsaved change' : ' unsaved changes');
    savebar.classList.toggle('show', n > 0);
  }
  function set(key, value) { draft[key] = value; delete errors[key]; refreshBar(); const e = document.getElementById('err-' + CSS.escape(key)); if (e) e.textContent = ''; }

  /* ---- controls */
  function tagControl(spec, locked) {
    const list = Array.isArray(draft[spec.key]) ? draft[spec.key].slice() : [];
    const box = h('div', { class: 'tagbox' });
    const input = h('input', { type: 'text', id: 'f-' + spec.key, placeholder: 'Type and press Enter', disabled: locked ? true : null, maxlength: spec.maxlen || 100 });
    const chipsEl = h('div', { class: 'chips', style: 'margin:8px 0 0' });
    function paint() {
      chipsEl.replaceChildren(...list.map((t, i) => h('button', { type: 'button', class: 'chip', title: 'Remove', disabled: locked ? true : null,
        onclick: () => { list.splice(i, 1); set(spec.key, list.slice()); paint(); } }, t, h('span', { class: 'n' }, '×'))));
    }
    function add() {
      const v = input.value.trim().toLowerCase();
      if (v && !list.includes(v) && list.length < (spec.maxitems || 50)) { list.push(v); set(spec.key, list.slice()); paint(); }
      input.value = '';
    }
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); } });
    input.addEventListener('blur', add);
    paint();
    box.append(input, chipsEl);
    return box;
  }

  function control(spec, locked) {
    const id = 'f-' + spec.key;
    const value = draft[spec.key];
    const dis = locked ? true : null;
    let el;
    switch (spec.type) {
      case 'toggle':
        el = h('span', { class: 'switch' }, h('input', { type: 'checkbox', id, disabled: dis, onchange: (e) => set(spec.key, e.target.checked) }), h('span', { class: 'track', 'aria-hidden': 'true' }));
        el.querySelector('input').checked = !!value;
        return el;
      case 'text': case 'url':
        el = spec.multiline
          ? h('textarea', { id, maxlength: spec.maxlen || 200, disabled: dis, oninput: (e) => set(spec.key, e.target.value) })
          : h('input', { id, type: spec.type === 'url' ? 'url' : 'text', maxlength: spec.maxlen || 200, disabled: dis, oninput: (e) => set(spec.key, e.target.value) });
        el.value = value == null ? '' : value;
        return el;
      case 'number':
        el = h('input', { id, type: 'number', inputmode: 'numeric', min: spec.min, max: spec.max, step: 1, disabled: dis,
          oninput: (e) => { const n = parseInt(e.target.value, 10); set(spec.key, Number.isNaN(n) ? original[spec.key] : n); } });
        el.value = value == null ? '' : value;
        return el;
      case 'select':
        el = h('select', { id, disabled: dis, onchange: (e) => {
          const opt = spec.options.find((o) => String(o.value) === e.target.value);
          set(spec.key, opt ? opt.value : e.target.value);
        } }, spec.options.map((o) => h('option', { value: o.value }, o.label)));
        el.value = String(value);
        return el;
      case 'channel': {
        const kinds = spec.kinds && spec.kinds.length ? spec.kinds : ['text', 'announcement'];
        const chans = guild.channels.filter((c) => kinds.includes(c.type));
        const prefix = { text: '# ', announcement: '📢 ', voice: '🔊 ', category: '▸ ' };
        el = h('select', { id, disabled: dis, onchange: (e) => set(spec.key, e.target.value) }, h('option', { value: '' }, '— None —'),
          chans.map((c) => h('option', { value: c.id }, (prefix[c.type] || '# ') + c.name + (c.parent ? '  (' + c.parent + ')' : ''))));
        if (value && !chans.some((c) => c.id === String(value))) el.append(h('option', { value: String(value) }, 'Unknown channel (' + value + ')'));
        el.value = value ? String(value) : '';
        return el;
      }
      case 'role': {
        el = h('select', { id, disabled: dis, onchange: (e) => set(spec.key, e.target.value) }, h('option', { value: '' }, '— None —'),
          guild.roles.filter((r) => !r.managed).sort((a, b) => b.position - a.position).map((r) => h('option', { value: r.id }, '@ ' + r.name)));
        if (value && !guild.roles.some((r) => r.id === String(value))) el.append(h('option', { value: String(value) }, 'Unknown role (' + value + ')'));
        el.value = value ? String(value) : '';
        return el;
      }
      case 'user':
        el = h('input', { id, type: 'text', inputmode: 'numeric', placeholder: 'Discord user ID', maxlength: 25, disabled: dis, oninput: (e) => set(spec.key, e.target.value.trim()) });
        el.value = value ? String(value) : '';
        return el;
      case 'tags': return tagControl(spec, locked);
      default: return h('span', { class: 'muted' }, 'Unsupported');
    }
  }

  /* ---- render */
  function settingRow(spec, sectionLock) {
    const reason = sectionLock || lockReason(spec);
    const locked = !!reason;
    return h('div', { class: 'setting' + (locked ? ' is-locked' : '') },
      h('div', {}, h('label', { class: 'name', for: 'f-' + spec.key }, spec.label,
        spec.tier !== 'free' && !sectionLock ? [' ', tierBadge(spec.tier)] : null), h('div', { class: 'desc' }, spec.description),
        h('div', { class: 'desc', style: 'color:var(--bad)', id: 'err-' + spec.key, role: 'alert' }, errors[spec.key] || '')),
      h('div', { class: 'ctl' }, control(spec, locked)));
  }

  function sectionPanel(sec) {
    const secLock = !tierOn(sec.tier) ? 'tier' : (sec.perm === 'admin' && !canAdmin ? 'perm' : null);
    const panel = h('section', { class: 'panel' + (secLock ? ' locked' : ''), id: 'sec-' + sec.id },
      h('div', { class: 'section-head' }, h('h2', {}, sec.name), sec.tier !== 'free' ? tierBadge(sec.tier) : null),
      h('p', { class: 'muted' }, sec.description));
    if (secLock === 'tier') {
      panel.append(h('div', { class: 'tier-lock' }, h('span', {}, 'Needs REX ' + sec.tier[0].toUpperCase() + sec.tier.slice(1) + ' on this server.'),
        h('span', { class: 'muted' }, 'Activate with '), h('code', {}, '/redeem'), h('a', { href: '/premium#' + sec.tier }, 'See what is included')));
    } else if (secLock === 'perm') {
      panel.append(h('div', { class: 'tier-lock' }, 'Changing these settings needs the Administrator permission in Discord.'));
    }
    let lastGroup = null;
    sec.settings.forEach((s) => {
      if (s.group && s.group !== lastGroup) panel.append(h('div', { class: 'group-title' }, s.group));
      lastGroup = s.group || lastGroup;
      panel.append(settingRow(s, secLock));
    });
    return panel;
  }

  function banners() {
    const out = [];
    if (!botOnline) out.push(h('div', { class: 'banner warn' }, h('b', {}, 'REX looks offline.'), h('span', { class: 'muted' }, 'You can still save. Changes wait and apply as soon as the bot is back.')));
    if (owner) out.push(h('div', { class: 'banner' }, h('span', { class: 'badge bad' }, 'Bot owner access'), h('span', { class: 'muted' }, 'You are editing this server as a REX owner.')));
    if (pending.length) {
      const keys = pending.flatMap((p) => p.keys).map((k) => labelOf[k] || k);
      out.push(h('div', { class: 'banner', role: 'status' }, h('span', { class: 'spin', 'aria-hidden': 'true' }),
        h('span', {}, 'Waiting for REX to apply: ' + [...new Set(keys)].slice(0, 6).join(', ') + (keys.length > 6 ? '…' : ''))));
    }
    return out;
  }

  function recentPanel() {
    const panel = h('section', { class: 'panel', id: 'sec-activity' }, h('h2', {}, 'Recent changes'));
    if (!results.length) { panel.append(h('p', { class: 'muted' }, 'No website changes yet.')); return panel; }
    results.forEach((r) => {
      const applied = Object.keys(r.applied || {});
      const errs = Object.entries(r.errors || {});
      panel.append(h('div', { class: 'result' },
        h('div', {}, h('strong', {}, r.by || 'Someone'), ' ', h('span', { class: 'muted' }, timeAgo(r.t))),
        applied.length ? h('div', { class: 'okline' }, 'Applied: ' + applied.map((k) => labelOf[k] || k).join(', ')) : null,
        errs.map(([k, m]) => h('div', { class: 'err' }, (labelOf[k] || k) + ': ' + m)),
        (r.notes || []).map((n) => h('div', { class: 'muted small' }, n))));
    });
    return panel;
  }

  function render() {
    const side = h('nav', { class: 'side', 'aria-label': 'Sections' },
      schema.sections.map((s) => h('a', { href: '#sec-' + s.id }, s.name, s.tier !== 'free' ? h('span', { class: 'badge sidebadge tier-' + s.tier }, s.tier) : null)),
      h('a', { href: '#sec-activity' }, 'Activity'));
    const tiers = ['premium', 'priority', 'ultra'].filter((t) => guild.tiers[t] && guild.tiers[t].active);
    const meta = h('div', { class: 'meta' }, tiers.length ? tiers.map((t) => tierBadge(t)) : tierBadge('free'),
      h('span', { class: 'muted small' }, fmtNum(guild.member_count) + ' members'));
    app.replaceChildren(
      h('div', { class: 'page-head' }, guildIcon(guild, true), h('div', {}, h('div', { class: 'eyebrow' }, 'Server settings'), h('h1', {}, guild.name), meta),
        h('a', { class: 'btn ghost sm', href: '/dashboard' }, '← Servers')),
      ...banners(),
      h('div', { class: 'layout' }, side, h('div', { class: 'sections' }, schema.sections.map(sectionPanel), recentPanel())));
    refreshBar();
  }

  /* ---- save + status polling */
  let polling = null;
  async function poll() {
    try {
      const d = await api('/api/guilds/' + encodeURIComponent(gid) + '?lite=1');
      const had = pending.length;
      pending = d.pending || [];
      results = d.results || results;
      const server = d.values || {};
      // Take the bot's values for everything the user is not currently editing.
      const inFlight = new Set(pending.flatMap((p) => p.keys));
      Object.keys(server).forEach((k) => { if (inFlight.has(k)) return; if (eq(draft[k], original[k])) draft[k] = server[k]; original[k] = server[k]; });
      if (had && !pending.length) {
        const last = results[0];
        if (last && Object.keys(last.errors || {}).length) toast('REX rejected part of that change. See Recent changes.', 'bad');
        else toast('REX applied your changes.', 'good');
      }
      const keepScroll = window.scrollY;
      render();
      window.scrollTo(0, keepScroll);
    } catch (e) { /* try again next tick */ }
    if (!pending.length) { clearInterval(polling); polling = null; }
  }
  function startPolling() { if (!polling) polling = setInterval(poll, 4000); }
  if (pending.length) startPolling();

  document.getElementById('discard').addEventListener('click', () => { draft = Object.assign({}, original); errors = {}; render(); });
  document.getElementById('save').addEventListener('click', async (ev) => {
    const btn = ev.currentTarget;
    const changes = {};
    dirtyKeys().forEach((k) => { changes[k] = draft[k]; });
    if (!Object.keys(changes).length) return;
    btn.disabled = true;
    try {
      const res = await api('/api/guilds/' + encodeURIComponent(gid) + '/settings', { method: 'PUT', body: { changes } });
      if (res.queued) {
        pending = pending.concat([{ id: res.id, keys: res.keys }]);
        Object.keys(changes).forEach((k) => { original[k] = changes[k]; });
        toast('Sent to REX. It will apply within about 15 seconds.', 'good');
        startPolling();
      }
      render();
    } catch (e) {
      if (e.code === 'invalid_value') {
        const body = e.data || {};
        errors = body.errors || {};
        render();
        const first = Object.keys(errors)[0];
        if (first) { const el = document.getElementById('f-' + first); if (el) el.scrollIntoView({ block: 'center' }); }
        toast('Some values were rejected. Check the highlighted settings.', 'bad');
      } else toast(e.message, 'bad');
    } finally { btn.disabled = false; }
  });
  window.addEventListener('beforeunload', (e) => { if (dirtyKeys().length) { e.preventDefault(); e.returnValue = ''; } });

  render();
})();
