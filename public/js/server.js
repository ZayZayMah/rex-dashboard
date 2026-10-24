'use strict';
(async function () {
  const app = document.getElementById('app');
  const me = await mountNav('dashboard');
  if (REX.blocked) return;
  const gid = new URLSearchParams(location.search).get('id');

  const fail = (title, text, withLogin) => app.replaceChildren(stateScreen(title, text,
    withLogin ? h('a', { class: 'btn', href: '/auth/login' }, 'Log in with Discord') : h('a', { class: 'btn ghost', href: '/dashboard' }, 'Back to servers')));
  if (!me) return fail('Log in first', 'Log in with Discord to manage this server.', true);
  if (!gid) return fail('No server selected', 'Pick a server from your list.');

  let data;
  try { data = await api('/api/guilds/' + encodeURIComponent(gid)); } catch (e) {
    if (e.status === 404) return fail('Rex is not in this server', 'Add Rex to the server and give it a minute to report in, then come back.');
    if (e.status === 403) return fail('No access', 'You need the Manage Server permission in that server.');
    return fail('Could not load this server', e.message);
  }
  const guild = data.guild, schema = data.schema;
  if (!schema || !schema.sections || !schema.sections.length) return fail('Settings are not available yet', 'Rex has not sent its settings list to the website. Make sure the bot is online and the dashboard connector is installed.');
  document.title = guild.name + ' - Rex';

  let original = Object.assign({}, data.values), draft = Object.assign({}, data.values);
  let pending = data.pending || [], results = data.results || [], errors = {};
  let botOnline = data.bot_online, ownerInfo = data.owner_info || null;
  const canAdmin = data.can_admin, ownerOverride = data.owner_override, canUndo = !!data.can_undo;
  const ownerMode = !!me.owner_mode;
  const labelOf = {}, specOf = {};
  schema.sections.forEach((s) => s.settings.forEach((x) => { labelOf[x.key] = x.label; specOf[x.key] = x; }));
  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const dirtyKeys = () => Object.keys(draft).filter((k) => !eq(draft[k], original[k]));
  const tierOn = (t) => t === 'free' || ownerOverride || (guild.tiers[t] && guild.tiers[t].active);
  const lockReason = (spec) => (!tierOn(spec.tier) ? 'tier' : (spec.perm === 'admin' && !canAdmin ? 'perm' : null));
  const chanById = Object.fromEntries(guild.channels.map((c) => [c.id, c]));
  const roleById = Object.fromEntries(guild.roles.map((r) => [r.id, r]));
  let hideLog = ownerMode && sessionStorage.getItem('rex-hide-log') !== '0';

  /* ---------------------------------------------------------------- value display (used by the activity log) */
  function fmtVal(key, v) {
    const spec = specOf[key];
    if (v === undefined) return '(not set)';
    if (v === null || v === '' || (Array.isArray(v) && !v.length)) return '(empty)';
    if (!spec) return String(v).slice(0, 120);
    switch (spec.type) {
      case 'toggle': return v ? 'On' : 'Off';
      case 'channel': return chanById[String(v)] ? '#' + chanById[String(v)].name : 'unknown channel';
      case 'role': return roleById[String(v)] ? '@' + roleById[String(v)].name : 'unknown role';
      case 'select': { const o = (spec.options || []).find((x) => String(x.value) === String(v)); return o ? o.label : String(v); }
      case 'tags': return v.join(', ').slice(0, 160);
      case 'tickettypes': return v.map((t) => t.label).join(', ');
      case 'text': case 'url': { const s = String(v); return '"' + (s.length > 120 ? s.slice(0, 117) + '...' : s) + '"'; }
      default: return String(v);
    }
  }

  /* ---------------------------------------------------------------- controls */
  const set = (key, value) => { draft[key] = value; delete errors[key]; refreshBar(); const e = document.getElementById('err-' + CSS.escape(key)); if (e) e.textContent = ''; };

  function rocker(key, locked) {
    const b = h('button', { type: 'button', class: 'rocker', role: 'switch', 'aria-checked': String(!!draft[key]), disabled: locked ? true : null });
    b.addEventListener('click', () => { const on = b.getAttribute('aria-checked') !== 'true'; b.setAttribute('aria-checked', String(on)); set(key, on); const card = b.closest('.switch-card'); if (card) card.classList.toggle('on', on); });
    return b;
  }
  function segmented(spec, locked) {
    const wrap = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': spec.label });
    const paint = () => wrap.querySelectorAll('button').forEach((b, i) => b.setAttribute('aria-checked', String(String(spec.options[i].value) === String(draft[spec.key]))));
    spec.options.forEach((o) => wrap.append(h('button', { type: 'button', role: 'radio', disabled: locked ? true : null, onclick: () => { set(spec.key, o.value); paint(); } }, o.label)));
    paint();
    return wrap;
  }
  function stepper(spec, locked) {
    const input = h('input', { type: 'number', inputmode: 'numeric', min: spec.min, max: spec.max, step: 1, id: 'f-' + spec.key, disabled: locked ? true : null });
    input.value = draft[spec.key] == null ? '' : draft[spec.key];
    const clamp = (n) => Math.max(spec.min != null ? spec.min : -1e9, Math.min(spec.max != null ? spec.max : 1e9, n));
    const bump = (d) => { const n = clamp((parseInt(input.value, 10) || 0) + d); input.value = n; set(spec.key, n); };
    input.addEventListener('input', () => { const n = parseInt(input.value, 10); set(spec.key, Number.isNaN(n) ? original[spec.key] : n); });
    return h('div', { class: 'stepper' }, h('button', { type: 'button', 'aria-label': 'Decrease', disabled: locked ? true : null, onclick: () => bump(-1) }, '-'), input,
      h('button', { type: 'button', 'aria-label': 'Increase', disabled: locked ? true : null, onclick: () => bump(1) }, '+'));
  }
  function combo(spec, items, locked, noneLabel) {
    const wrap = h('div', { class: 'combo' });
    const btn = h('button', { type: 'button', class: 'combo-btn', id: 'f-' + spec.key, disabled: locked ? true : null, 'aria-haspopup': 'listbox' });
    let list = null;
    const cur = () => items.find((i) => i.id === String(draft[spec.key] || ''));
    function paintBtn() {
      const c = cur(), v = String(draft[spec.key] || '');
      btn.replaceChildren(
        c ? [c.dot !== undefined ? h('span', { class: 'dot', style: c.dot ? 'background:#' + c.dot : '' }) : h('span', { class: 'glyph' }, c.glyph || '#'), h('span', {}, c.label)]
          : v ? h('span', { class: 'muted' }, 'Unknown (' + v + ')') : h('span', { class: 'ph' }, noneLabel),
        h('span', { class: 'caret' }, 'v'));
    }
    function close() { if (list) { list.remove(); list = null; document.removeEventListener('mousedown', outside); } }
    function outside(e) { if (list && !wrap.contains(e.target)) close(); }
    function pick(id) { set(spec.key, id); paintBtn(); close(); }
    btn.addEventListener('click', () => {
      if (list) return close();
      const q = h('input', { type: 'search', placeholder: 'Search', 'aria-label': 'Search' });
      const opts = h('div', { class: 'combo-opts', role: 'listbox' });
      const draw = () => {
        const f = q.value.trim().toLowerCase();
        const rows = [h('button', { type: 'button', onclick: () => pick('') }, h('span', { class: 'muted' }, noneLabel))];
        items.filter((i) => !f || i.label.toLowerCase().includes(f)).slice(0, 120).forEach((i) => rows.push(h('button', { type: 'button', class: String(draft[spec.key]) === i.id ? 'sel' : '', onclick: () => pick(i.id) },
          i.dot !== undefined ? h('span', { class: 'dot', style: i.dot ? 'background:#' + i.dot : '' }) : h('span', { class: 'glyph' }, i.glyph || '#'), i.label, i.parent ? h('span', { class: 'par' }, i.parent) : null)));
        opts.replaceChildren(...rows);
      };
      q.addEventListener('input', draw); draw();
      list = h('div', { class: 'combo-list' }, q, opts);
      wrap.append(list); q.focus();
      setTimeout(() => document.addEventListener('mousedown', outside), 0);
    });
    paintBtn();
    wrap.append(btn);
    return wrap;
  }
  function tagControl(spec, locked) {
    const list = Array.isArray(draft[spec.key]) ? draft[spec.key].slice() : [];
    const input = h('input', { type: 'text', id: 'f-' + spec.key, placeholder: 'Type and press Enter', disabled: locked ? true : null, maxlength: spec.maxlen || 100 });
    const chipsEl = h('div', { class: 'chips' });
    const paint = () => chipsEl.replaceChildren(...list.map((t, i) => h('button', { type: 'button', class: 'chip', title: 'Remove', disabled: locked ? true : null, onclick: () => { list.splice(i, 1); set(spec.key, list.slice()); paint(); } }, t, h('span', { class: 'n' }, 'x'))));
    const add = () => { const v = input.value.trim().toLowerCase(); if (v && !list.includes(v) && list.length < (spec.maxitems || 50)) { list.push(v); set(spec.key, list.slice()); paint(); } input.value = ''; };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); } });
    input.addEventListener('blur', add);
    paint();
    return h('div', { class: 'tagbox' }, input, chipsEl);
  }
  function ticketTypes(spec, locked) {
    const box = h('div', { class: 'tt-list' });
    let rows = (Array.isArray(draft[spec.key]) ? draft[spec.key] : []).map((t) => ({ label: t.label || '', questions: (t.questions || []).slice(0, 2) }));
    const push = () => set(spec.key, rows.filter((r) => r.label.trim()).map((r) => ({ label: r.label.trim(), questions: r.questions.map((q) => q.trim()).filter(Boolean) })));
    function paint() {
      box.replaceChildren(...rows.map((r, i) => h('div', { class: 'tt' },
        h('input', { type: 'text', placeholder: 'Button name', maxlength: 45, value: r.label, disabled: locked ? true : null, 'aria-label': 'Button name', oninput: (e) => { r.label = e.target.value; push(); } }),
        h('input', { type: 'text', placeholder: 'First question', maxlength: 45, value: r.questions[0] || '', disabled: locked ? true : null, 'aria-label': 'First question', oninput: (e) => { r.questions[0] = e.target.value; push(); } }),
        h('input', { type: 'text', placeholder: 'Second question (optional)', maxlength: 45, value: r.questions[1] || '', disabled: locked ? true : null, 'aria-label': 'Second question', oninput: (e) => { r.questions[1] = e.target.value; push(); } }),
        h('button', { type: 'button', class: 'btn ghost sm', disabled: locked ? true : null, 'aria-label': 'Remove', onclick: () => { rows.splice(i, 1); paint(); push(); } }, icon('trash', 16)))),
        rows.length < (spec.maxitems || 5) ? h('div', {}, h('button', { type: 'button', class: 'btn ghost sm', disabled: locked ? true : null, onclick: () => { rows.push({ label: '', questions: [''] }); paint(); } }, icon('plus', 14), ' Add a ticket type')) : null);
    }
    paint();
    return box;
  }
  function textControl(spec, locked) {
    const isColor = /_embed_color$/.test(spec.key);
    const el = spec.multiline
      ? h('textarea', { id: 'f-' + spec.key, maxlength: spec.maxlen || 200, disabled: locked ? true : null })
      : h('input', { id: 'f-' + spec.key, type: spec.type === 'url' ? 'url' : 'text', maxlength: spec.maxlen || 200, disabled: locked ? true : null, placeholder: spec.blank_clears || spec.blank_ok ? 'Off' : '' });
    el.value = draft[spec.key] == null ? '' : draft[spec.key];
    el.addEventListener('input', () => { set(spec.key, el.value); if (sw) sw.value = /^#[0-9a-f]{6}$/i.test(el.value) ? el.value : '#2ee6b6'; });
    let sw = null;
    if (isColor) {
      sw = h('input', { type: 'color', 'aria-label': 'Pick a colour', disabled: locked ? true : null, style: 'width:46px;padding:2px;flex:none' });
      sw.value = /^#[0-9a-f]{6}$/i.test(el.value) ? el.value : '#2ee6b6';
      sw.addEventListener('input', () => { el.value = sw.value; set(spec.key, sw.value); });
      return h('div', { style: 'display:flex;gap:8px' }, el, sw);
    }
    return el;
  }
  function control(spec, locked) {
    switch (spec.type) {
      case 'toggle': return rocker(spec.key, locked);
      case 'text': case 'url': return textControl(spec, locked);
      case 'number': return stepper(spec, locked);
      case 'select': return (spec.options || []).length <= 4 ? segmented(spec, locked)
        : (() => { const el = h('select', { id: 'f-' + spec.key, disabled: locked ? true : null, onchange: (e) => { const o = spec.options.find((x) => String(x.value) === e.target.value); set(spec.key, o ? o.value : e.target.value); } }, spec.options.map((o) => h('option', { value: o.value }, o.label))); el.value = String(draft[spec.key]); return el; })();
      case 'channel': {
        const kinds = spec.kinds && spec.kinds.length ? spec.kinds : ['text', 'announcement'];
        const glyph = { text: '#', announcement: '!', voice: '~', category: '>' };
        return combo(spec, guild.channels.filter((c) => kinds.includes(c.type)).map((c) => ({ id: c.id, label: c.name, glyph: glyph[c.type], parent: c.parent })), locked, 'None (off)');
      }
      case 'role': return combo(spec, guild.roles.filter((r) => !r.managed).sort((a, b) => b.position - a.position).map((r) => ({ id: r.id, label: r.name, dot: r.color ? r.color.toString(16).padStart(6, '0') : '' })), locked, 'None');
      case 'user': { const el = h('input', { id: 'f-' + spec.key, type: 'text', inputmode: 'numeric', placeholder: 'Discord user ID', maxlength: 25, disabled: locked ? true : null, oninput: (e) => set(spec.key, e.target.value.trim()) }); el.value = draft[spec.key] ? String(draft[spec.key]) : ''; return el; }
      case 'tags': return tagControl(spec, locked);
      case 'tickettypes': return ticketTypes(spec, locked);
      default: return h('span', { class: 'muted' }, 'Unsupported setting');
    }
  }
  function hintFor(spec) {
    if (spec.type === 'url' || ((spec.type === 'text') && (spec.blank_clears || spec.blank_ok))) return 'Leave empty to turn this off.';
    return '';
  }
  function nameLine(spec, sectionLock) {
    return [spec.label, spec.tier !== 'free' && !sectionLock ? tierBadge(spec.tier) : null];
  }
  function settingRow(spec, sectionLock) {
    const reason = sectionLock || lockReason(spec), locked = !!reason;
    const wide = spec.type === 'tickettypes' || (spec.type === 'text' && spec.multiline);
    return h('div', { class: 'set-row' + (locked ? ' locked' : '') + (wide ? ' wide' : '') },
      h('div', {}, h('label', { class: 'name', for: 'f-' + spec.key }, nameLine(spec, sectionLock)), h('div', { class: 'desc' }, spec.description),
        hintFor(spec) ? h('div', { class: 'hint' }, hintFor(spec)) : null,
        locked && reason === 'tier' && !sectionLock ? h('div', { class: 'hint' }, 'Needs ' + TIER_LABEL[spec.tier] + ' on this server.') : null,
        h('div', { class: 'err-text', id: 'err-' + spec.key, role: 'alert' }, errors[spec.key] || '')),
      h('div', { class: 'ctl' }, control(spec, locked)));
  }
  function switchCard(spec, sectionLock) {
    const locked = !!(sectionLock || lockReason(spec));
    return h('div', { class: 'switch-card' + (draft[spec.key] ? ' on' : '') + (locked ? ' locked' : '') },
      h('div', {}, h('div', { class: 'name' }, nameLine(spec, sectionLock)), h('div', { class: 'desc' }, spec.description), h('div', { class: 'err-text', id: 'err-' + spec.key, role: 'alert' }, errors[spec.key] || '')),
      rocker(spec.key, locked));
  }

  /* ---------------------------------------------------------------- sections */
  const SURF = ['well', 'frame', 'slab'];
  function settingsSection(sec) {
    const secLock = !tierOn(sec.tier) ? 'tier' : (sec.perm === 'admin' && !canAdmin ? 'perm' : null);
    const box = h('div', {});
    if (secLock === 'tier') box.append(h('div', { class: 'tier-lock' }, h('span', {}, 'This section needs ' + TIER_LABEL[sec.tier] + ' on this server.'),
      h('a', { href: '#premium' }, 'Redeem a code'), h('a', { href: '/premium#' + sec.tier }, 'See what is included')));
    else if (secLock === 'perm') box.append(h('div', { class: 'tier-lock' }, 'Changing these settings needs the Administrator permission in Discord.'));
    const groups = [];
    sec.settings.forEach((s) => {
      const name = s.group || '';
      let g = groups.find((x) => x.name === name);
      if (!g) { g = { name, items: [] }; groups.push(g); }
      g.items.push(s);
    });
    groups.forEach((g, gi) => {
      const toggles = g.items.filter((s) => s.type === 'toggle'), rest = g.items.filter((s) => s.type !== 'toggle');
      const surface = g.name ? SURF[gi % SURF.length] : '';
      const node = h('div', { class: 'group ' + surface }, g.name ? h('h3', {}, g.name) : null);
      if (toggles.length) node.append(h('div', { class: 'switch-grid' }, toggles.map((s) => switchCard(s, secLock))));
      if (rest.length) node.append(h('div', { style: toggles.length ? 'margin-top:12px' : '' }, rest.map((s) => settingRow(s, secLock))));
      box.append(node);
    });
    return box;
  }
  function tierStatus() {
    return h('div', { class: 'tier-status' }, ['premium', 'priority', 'ultra'].map((t) => {
      const st = guild.tiers[t] || {};
      return h('div', { class: st.active ? 'on' : '' }, h('div', {}, tierBadge(t)), h('b', { style: 'display:block;margin-top:8px' }, st.active ? 'Active' : 'Not active'),
        h('span', { class: 'muted small' }, st.active ? (st.inherited ? 'Included with a higher tier' : st.expires ? 'Until ' + fmtDate(st.expires) : 'Never expires') : 'Redeem a code to unlock'));
    }));
  }
  function premiumSection() {
    const box = h('div', {}, tierStatus());
    if (canAdmin) box.append(h('div', { class: 'frame', style: 'max-width:560px' }, h('h3', {}, 'Redeem a code'),
      redeemWidget(me.guilds, gid, () => { setTimeout(refresh, 800); })));
    else box.append(h('p', { class: 'muted' }, 'Redeeming a code needs Administrator in this server.'));
    return box;
  }
  async function transcriptsSection() {
    const box = h('div', {}, h('div', { class: 'skel', style: 'height:120px' }));
    if (!tierOn('premium')) {
      box.replaceChildren(h('div', { class: 'tier-lock' }, h('span', {}, 'Ticket transcripts as a web link need Premium or higher.'), h('a', { href: '#premium' }, 'Redeem a code')),
        h('p', { class: 'muted' }, 'When someone closes a ticket, Rex saves it as a page that looks like Discord. Premium and Priority keep it for 30 days, Ultra keeps it until you delete it.'));
      return box;
    }
    let items = [];
    try { items = (await api('/api/guilds/' + encodeURIComponent(gid) + '/transcripts')).items || []; } catch (e) { box.replaceChildren(h('p', { class: 'muted' }, e.message)); return box; }
    if (!items.length) { box.replaceChildren(h('div', { class: 'well center' }, h('p', { class: 'muted', style: 'margin:0' }, 'No transcripts yet. They appear here when a ticket is closed.'))); return box; }
    const origin = location.origin;
    box.replaceChildren(h('p', { class: 'muted' }, guild.tiers.ultra && guild.tiers.ultra.active ? 'Ultra keeps transcripts until you delete them.' : 'Transcripts are kept for 30 days. Ultra keeps them until deleted.'),
      h('div', { class: 'ledger' }, items.map((it) => h('div', { class: 'tr-item' },
        h('div', { class: 'grow' }, h('b', {}, '#' + it.ch), h('div', { class: 'muted small' }, it.n + ' messages, closed ' + timeAgo(it.t) + ' by ' + (it.by || 'someone') + (it.exp ? ', expires ' + fmtDate(it.exp) : ', kept until deleted'))),
        h('a', { class: 'btn ghost sm', href: '/transcript?id=' + encodeURIComponent(it.id), target: '_blank', rel: 'noopener' }, 'Open'),
        h('button', { class: 'btn ghost sm', type: 'button', onclick: async () => { try { await navigator.clipboard.writeText(origin + '/transcript?id=' + it.id); toast('Link copied.', 'good'); } catch (e) { toast(origin + '/transcript?id=' + it.id); } } }, icon('link', 15), ' Copy link'),
        canAdmin ? h('button', { class: 'btn danger sm', type: 'button', onclick: async () => {
          if (!confirm('Delete this transcript? The link will stop working.')) return;
          try { await api('/api/transcript?id=' + encodeURIComponent(it.id), { method: 'DELETE' }); toast('Transcript deleted.', 'good'); show(current, true); } catch (e) { toast(e.message, 'bad'); }
        } }, icon('trash', 15)) : null))));
    return box;
  }
  function ownerSection() {
    const info = ownerInfo || {};
    const out = h('div', { class: 'result-box', hidden: true });
    async function run(op, args, okText) {
      out.hidden = false; out.textContent = 'Sending to Rex...';
      try {
        const res = await api('/api/owner/op', { method: 'POST', body: { op, gid, args } });
        const r = await waitForResult(res.id);
        if (r.ok && r.done) {
          out.textContent = (r.out && r.out.url) ? 'Invite: ' + r.out.url : (r.notes && r.notes.join(', ')) || okText || 'Done.';
          if (r.out && r.out.url) { try { await navigator.clipboard.writeText(r.out.url); out.textContent += '  (copied)'; } catch (e) { /* ignore */ } }
          setTimeout(refresh, 800);
        } else out.textContent = Object.values(r.errors || {})[0] || 'That did not work.';
      } catch (e) { out.textContent = e.message; }
    }
    const days = h('select', { 'aria-label': 'Length' }, [['7', '7 days'], ['30', '30 days'], ['90', '90 days'], ['365', '1 year'], ['0', 'Lifetime']].map(([v, l]) => h('option', { value: v }, l)));
    days.value = '30';
    const reason = h('input', { type: 'text', placeholder: 'Reason (shown to the server)', maxlength: 200 });
    const hide = h('button', { type: 'button', class: 'rocker', role: 'switch', 'aria-checked': String(hideLog) });
    hide.addEventListener('click', () => { hideLog = !hideLog; hide.setAttribute('aria-checked', String(hideLog)); sessionStorage.setItem('rex-hide-log', hideLog ? '1' : '0'); });
    return h('div', { class: 'stack' },
      h('div', { class: 'well' }, h('h3', {}, 'Server info'), h('table', { class: 'tbl' }, h('tbody', {},
        h('tr', {}, h('td', {}, 'Server owner'), h('td', {}, (info.owner_name || 'Unknown') + (info.owner_id ? '  (' + info.owner_id + ')' : ''))),
        h('tr', {}, h('td', {}, 'Server ID'), h('td', {}, h('code', {}, gid))),
        h('tr', {}, h('td', {}, 'Members'), h('td', {}, fmtNum(guild.member_count))),
        h('tr', {}, h('td', {}, 'Created'), h('td', {}, fmtDate(info.created))),
        h('tr', {}, h('td', {}, 'Blacklisted'), h('td', {}, info.blacklisted ? h('span', { class: 'badge bad' }, 'Yes') : 'No')))),
        h('div', { style: 'margin-top:12px' }, h('button', { class: 'btn ghost sm', type: 'button', onclick: () => run('invite', {}, 'Invite created.') }, icon('link', 15), ' Create a one-use invite'))),
      h('div', { class: 'frame' }, h('h3', {}, 'Give or remove a tier'), h('p', { class: 'muted small' }, 'No code needed and nothing is written to the server activity log. This is recorded in the owner audit log.'),
        h('div', { class: 'row-2' }, h('div', {}, h('label', { class: 'lbl' }, 'Length'), days)),
        h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;margin-top:14px' },
          ['premium', 'priority', 'ultra'].map((t) => h('button', { class: 'btn sm', type: 'button', onclick: () => run('tier', { tier: t, days: parseInt(days.value, 10) }, TIER_LABEL[t] + ' granted.') }, 'Give ' + TIER_LABEL[t])),
          ['premium', 'priority', 'ultra'].map((t) => h('button', { class: 'btn ghost sm', type: 'button', onclick: () => run('tier', { tier: t, remove: true }, TIER_LABEL[t] + ' removed.') }, 'Remove ' + TIER_LABEL[t])))),
      h('div', { class: 'slab', style: 'border-left-color:var(--bad)' }, h('h3', {}, 'Blacklist'), h('p', { class: 'muted small' }, 'Rex leaves the server and leaves again if it is re-added.'),
        reason, h('div', { style: 'display:flex;gap:8px;margin-top:10px' },
          info.blacklisted ? h('button', { class: 'btn ghost sm', type: 'button', onclick: () => run('blacklist', { remove: true }, 'Removed from the blacklist.') }, 'Remove from blacklist')
            : h('button', { class: 'btn danger sm', type: 'button', onclick: () => { if (confirm('Blacklist this server and make Rex leave?')) run('blacklist', { reason: reason.value }, 'Blacklisted.'); } }, 'Blacklist and leave'))),
      h('div', { class: 'well' }, h('div', { style: 'display:flex;gap:14px;align-items:center' }, hide, h('div', {}, h('b', {}, 'Hide my setting changes from the activity log'), h('div', { class: 'muted small' }, 'Applies to changes you save on this page while in owner mode.')))),
      out);
  }

  /* ---------------------------------------------------------------- shell */
  const SECTION_ICON = { wave: 'wave', scroll: 'scroll', ticket: 'ticket', star: 'star', dice: 'dice', check: 'check', shield: 'shield', badge: 'badge', chart: 'chart', bolt: 'bolt', crown: 'crown', paint: 'paint' };
  const pseudo = [{ id: 'premium', name: 'Premium', icon: 'premium' }, { id: 'transcripts', name: 'Transcripts', icon: 'scroll' }];
  const allIds = () => schema.sections.map((s) => s.id).concat(pseudo.map((p) => p.id), ownerMode ? ['owner'] : []);
  let current = (location.hash || '').slice(1);
  if (!allIds().includes(current)) current = schema.sections[0].id;

  const head = h('div', { class: 'srv-head' });
  const side = h('nav', { class: 'srv-side', 'aria-label': 'Sections' });
  const main = h('div', { class: 'srv-main' });
  const consoleHost = h('div', { class: 'console' });
  let consoleOpen = false;

  function drawHead() {
    const tiers = ['premium', 'priority', 'ultra'].filter((t) => guild.tiers[t] && guild.tiers[t].active);
    head.replaceChildren(h('div', { class: 'wrap in' },
      guildIcon(guild, true),
      h('div', { style: 'min-width:0' }, h('h1', {}, guild.name), h('div', { class: 'meta' }, tiers.length ? tiers.map(tierBadge) : tierBadge('free'), h('span', { class: 'muted small' }, fmtNum(guild.member_count) + ' members'),
        ownerOverride ? h('span', { class: 'badge warn' }, 'Owner access') : null)),
      consoleHost));
    drawConsole();
  }
  function drawSide() {
    const link = (id, name, ic, extra) => h('a', { href: '#' + id, class: current === id ? 'active' : '', onclick: (e) => { e.preventDefault(); go(id); } }, icon(ic || 'star'), name, extra || null);
    const items = schema.sections.map((s) => link(s.id, s.name, SECTION_ICON[s.icon], s.tier !== 'free' ? h('span', { class: 'badge tier-' + s.tier + ' tag' }, TIER_LABEL[s.tier]) : null));
    side.replaceChildren(...items, h('hr'), ...pseudo.map((p) => link(p.id, p.name, p.icon)),
      ...(ownerMode ? [h('hr'), h('div', { class: 'gold' }, link('owner', 'Owner', 'key'))] : []));
  }
  function go(id) { current = id; history.replaceState(null, '', '#' + id); drawSide(); show(id); window.scrollTo(0, 0); }

  async function show(id, quiet) {
    const sec = schema.sections.find((s) => s.id === id);
    const pse = pseudo.find((p) => p.id === id);
    const name = sec ? sec.name : pse ? pse.name : 'Owner';
    const desc = sec ? sec.description : id === 'premium' ? 'See which tiers this server has and redeem a code.' : id === 'transcripts' ? 'Ticket transcripts saved as web pages.' : 'Rex owner controls for this server.';
    const frame = [...banners(),
      h('div', { class: 'sec-head' }, h('h2', {}, name), sec && sec.tier !== 'free' ? tierBadge(sec.tier) : null),
      h('p', { class: 'sec-desc' }, desc)];
    main.replaceChildren(...frame, h('div', { id: 'sec-body' }));
    const body = document.getElementById('sec-body');
    if (sec) body.append(settingsSection(sec));
    else if (id === 'premium') body.append(premiumSection());
    else if (id === 'transcripts') body.append(await transcriptsSection());
    else if (id === 'owner' && ownerMode) body.append(ownerSection());
    refreshBar();
  }
  function banners() {
    const out = [];
    if (!botOnline) out.push(h('div', { class: 'banner warn' }, h('b', {}, 'Rex looks offline.'), h('span', { class: 'muted' }, 'You can still save. Changes wait and apply when the bot is back.')));
    if (pending.length) out.push(h('div', { class: 'banner', role: 'status' }, h('span', { class: 'spin' }), h('span', {}, 'Waiting for Rex to apply: ' + [...new Set(pending.flatMap((p) => p.keys || []))].map((k) => labelOf[k] || k).slice(0, 6).join(', '))));
    return out;
  }

  /* ---------------------------------------------------------------- activity console */
  function entryNode(r) {
    const redeemed = r.applied && r.applied._redeem;
    const keys = Object.keys(r.applied || {}).filter((k) => !k.startsWith('_'));
    const errs = Object.entries(r.errors || {});
    const isUndo = !!(r.undo_of && r.undo_of.length);
    const canUndoEntry = canUndo && !r.undone && !isUndo && keys.length && r.before && keys.some((k) => k in r.before);
    return h('div', { class: 'entry' + (r.undone ? ' undone' : '') },
      h('div', { class: 'top' }, h('b', {}, r.by || 'Someone'),
        h('span', {}, redeemed ? 'redeemed a ' + TIER_LABEL[redeemed] + ' code' : isUndo ? 'undid earlier changes' : keys.length ? 'changed ' + keys.length + (keys.length === 1 ? ' setting' : ' settings') : errs.length ? 'tried to change settings' : 'made a change'),
        r.undone ? h('span', { class: 'badge' }, 'Undone') : null, h('span', { class: 'when' }, timeAgo(r.t))),
      keys.length ? h('div', { class: 'chg' }, keys.map((k) => h('div', {}, h('span', { class: 'k' }, (labelOf[k] || k) + ': '),
        r.before && k in r.before ? [h('span', { class: 'from' }, fmtVal(k, r.before[k])), h('span', { class: 'arrow' }, '->')] : null,
        h('span', { class: 'to' }, fmtVal(k, r.applied[k]))))) : null,
      errs.map(([k, m]) => h('div', { class: 'err' }, (labelOf[k] || k) + ': ' + m)),
      (r.notes || []).map((n) => h('div', { class: 'muted small' }, n)),
      canUndoEntry || (canUndo && r.byid && !r.undone && !isUndo && keys.length) ? h('div', { class: 'acts' },
        canUndoEntry ? h('button', { class: 'btn ghost sm', type: 'button', onclick: () => undo({ id: r.id }) }, icon('undo', 14), ' Undo this') : null,
        r.byid ? h('button', { class: 'btn ghost sm', type: 'button', onclick: () => { if (confirm('Undo everything ' + (r.by || 'this person') + ' changed that has not been changed again?')) undo({ user: r.byid }); } }, 'Undo everything from ' + (r.by || 'this person')) : null) : null);
  }
  function drawConsole() {
    const last = results[0];
    const lastText = pending.length ? 'Applying ' + pending.length + ' change' + (pending.length === 1 ? '' : 's') + '...'
      : last ? (last.by || 'Someone') + ' ' + (last.applied && last.applied._redeem ? 'redeemed a code' : 'changed ' + (Object.keys(last.applied || {}).filter((k) => !k.startsWith('_')).map((k) => labelOf[k] || k)[0] || 'settings')) + ' - ' + timeAgo(last.t) : 'No changes yet';
    const bar = h('button', { class: 'console-bar', type: 'button', 'aria-expanded': String(consoleOpen), onclick: () => { consoleOpen = !consoleOpen; drawConsole(); } },
      h('span', { class: 'led ' + (pending.length ? 'wait' : botOnline ? 'live' : '') }), h('span', { class: 'lbl' }, 'Activity'), h('span', { class: 'last' }, lastText));
    consoleHost.replaceChildren(bar);
    if (consoleOpen) {
      const log = h('div', { class: 'console-log' }, results.length ? results.map(entryNode) : h('p', { class: 'muted center', style: 'padding:30px' }, 'Nothing has been changed from the website yet.'));
      consoleHost.append(h('div', { class: 'console-body', role: 'region', 'aria-label': 'Activity log' },
        h('div', { class: 'console-top' }, icon('logs', 16), 'Activity log', h('span', { class: 'grow' }), h('span', { class: 'muted small' }, canUndo ? 'You can undo changes' : 'Only the server owner can undo'),
          h('button', { class: 'btn ghost sm', type: 'button', onclick: () => { consoleOpen = false; drawConsole(); } }, icon('close', 14))), log));
    }
  }
  async function undo(body) {
    try {
      await api('/api/guilds/' + encodeURIComponent(gid) + '/undo', { method: 'POST', body });
      toast('Undo sent to Rex.', 'good');
      pending = pending.concat([{ id: 'undo', keys: [] }]);
      drawConsole(); startPolling();
    } catch (e) { toast(e.code === 'nothing_to_undo' ? 'Nothing to undo. Those settings were changed again since.' : e.message, 'bad'); }
  }
  document.addEventListener('mousedown', (e) => { if (consoleOpen && !consoleHost.contains(e.target)) { consoleOpen = false; drawConsole(); } });

  /* ---------------------------------------------------------------- save bar + sync */
  const savebar = h('div', { class: 'savebar', role: 'region', 'aria-label': 'Unsaved changes' },
    h('span', { id: 'savecount' }, ''),
    h('button', { class: 'btn ghost sm', type: 'button', id: 'discard' }, 'Discard'), h('button', { class: 'btn sm', type: 'button', id: 'save' }, 'Save changes'));
  function refreshBar() {
    const n = dirtyKeys().length;
    savebar.querySelector('#savecount').textContent = n + (n === 1 ? ' unsaved change' : ' unsaved changes');
    savebar.classList.toggle('show', n > 0);
  }
  let polling = null;
  async function refresh() {
    try {
      const d = await api('/api/guilds/' + encodeURIComponent(gid));
      Object.assign(guild, d.guild); ownerInfo = d.owner_info || ownerInfo; botOnline = d.bot_online;
      pending = d.pending || []; results = d.results || results;
      const server = d.values || {};
      const inFlight = new Set(pending.flatMap((p) => p.keys || []));
      Object.keys(server).forEach((k) => { if (inFlight.has(k)) return; if (eq(draft[k], original[k])) draft[k] = server[k]; original[k] = server[k]; });
      drawHead(); show(current, true);
    } catch (e) { /* next tick */ }
  }
  async function poll() {
    try {
      const d = await api('/api/guilds/' + encodeURIComponent(gid) + '?lite=1');
      const had = pending.length;
      pending = d.pending || []; results = d.results || results;
      const server = d.values || {};
      const inFlight = new Set(pending.flatMap((p) => p.keys || []));
      Object.keys(server).forEach((k) => { if (inFlight.has(k)) return; if (eq(draft[k], original[k])) draft[k] = server[k]; original[k] = server[k]; });
      if (had && !pending.length) {
        const first = results[0];
        if (first && Object.keys(first.errors || {}).length) toast('Rex rejected part of that change. Open the activity log.', 'bad'); else toast('Rex applied your changes.', 'good');
      }
      const y = window.scrollY; drawConsole(); if (had !== pending.length) { show(current, true); window.scrollTo(0, y); }
    } catch (e) { /* retry */ }
    if (!pending.length) { clearInterval(polling); polling = null; }
  }
  function startPolling() { if (!polling) polling = setInterval(poll, 3000); }
  setInterval(() => { if (!document.hidden && !polling && !consoleOpen) poll().catch(() => {}); }, 45000);

  savebar.querySelector('#discard').addEventListener('click', () => { draft = Object.assign({}, original); errors = {}; show(current, true); });
  savebar.querySelector('#save').addEventListener('click', async (ev) => {
    const btn = ev.currentTarget, changes = {};
    dirtyKeys().forEach((k) => { changes[k] = draft[k]; });
    if (!Object.keys(changes).length) return;
    btn.disabled = true;
    try {
      const res = await api('/api/guilds/' + encodeURIComponent(gid) + '/settings', { method: 'PUT', body: { changes, silent: ownerMode && hideLog } });
      if (res.queued) {
        pending = pending.concat([{ id: res.id, keys: res.keys }]);
        Object.keys(changes).forEach((k) => { original[k] = changes[k]; });
        toast('Sent to Rex. It applies within seconds.', 'good'); startPolling();
      }
      show(current, true); drawConsole();
    } catch (e) {
      if (e.code === 'invalid_value') {
        errors = (e.data && e.data.errors) || {};
        const firstSec = schema.sections.find((s) => s.settings.some((x) => errors[x.key]));
        if (firstSec && firstSec.id !== current) go(firstSec.id); else show(current, true);
        toast('Some values were rejected. Check the highlighted settings.', 'bad');
      } else toast(e.message, 'bad');
    } finally { btn.disabled = false; }
  });
  window.addEventListener('beforeunload', (e) => { if (dirtyKeys().length) { e.preventDefault(); e.returnValue = ''; } });

  /* ---------------------------------------------------------------- condensing header */
  let cond = false;
  const onScroll = () => {
    const y = window.scrollY;
    if (!cond && y > 48) cond = true; else if (cond && y < 10) cond = false; else return;
    head.classList.toggle('condensed', cond); document.body.classList.toggle('cond', cond);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('hashchange', () => { const id = (location.hash || '').slice(1); if (allIds().includes(id) && id !== current) { current = id; drawSide(); show(id); } });

  app.replaceChildren(h('div', { class: 'srv-spacer' }), h('div', { class: 'srv-layout' }, side, main));
  document.body.append(head, savebar);
  drawHead(); drawSide(); show(current);
  if (pending.length) startPolling();
})();
