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
      case 'roles': return v.map((id) => (roleById[String(id)] ? '@' + roleById[String(id)].name : 'unknown role')).join(', ').slice(0, 160);
      case 'tickettypes': return v.map((t) => t.label).join(', ');
      case 'channels': return (v || []).length + ' channel(s)';
      case 'levelroles': return (v || []).length + ' reward(s)';
      case 'card': return v && v.layers && v.layers.length ? 'Image card on' : 'Off';
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
  function rolesControl(spec, locked) {
    const chosen = () => (Array.isArray(draft[spec.key]) ? draft[spec.key] : []);
    const chips = h('div', { class: 'chips' });
    const search = h('input', { type: 'search', placeholder: 'Search roles to add', 'aria-label': 'Search roles', disabled: locked ? true : null });
    const opts = h('div', { class: 'combo-opts', style: 'max-height:200px;overflow:auto;display:none' });
    const paint = () => {
      chips.replaceChildren(...chosen().map((id) => { const r = roleById[id]; return h('button', { type: 'button', class: 'chip', title: 'Remove', disabled: locked ? true : null,
        onclick: () => { set(spec.key, chosen().filter((x) => x !== id)); paint(); drawOpts(); } },
        h('span', { class: 'dot', style: r && r.color ? 'background:#' + r.color.toString(16).padStart(6, '0') : '' }), r ? r.name : 'Unknown', h('span', { class: 'n' }, 'x')); }));
      if (!chosen().length) chips.append(h('span', { class: 'muted small' }, 'No roles chosen'));
    };
    const drawOpts = () => {
      const f = search.value.trim().toLowerCase();
      const rows = guild.roles.filter((r) => !r.managed && !chosen().includes(r.id) && (!f || r.name.toLowerCase().includes(f))).slice(0, 80);
      opts.style.display = f || document.activeElement === search ? 'block' : 'none';
      opts.replaceChildren(...rows.map((r) => h('button', { type: 'button', onclick: () => { if (chosen().length >= (spec.maxitems || 20)) return; set(spec.key, chosen().concat([r.id])); search.value = ''; paint(); drawOpts(); } },
        h('span', { class: 'dot', style: r.color ? 'background:#' + r.color.toString(16).padStart(6, '0') : '' }), r.name)));
    };
    search.addEventListener('input', drawOpts); search.addEventListener('focus', drawOpts);
    search.addEventListener('blur', () => setTimeout(() => { opts.style.display = 'none'; }, 180));
    paint();
    return h('div', { class: 'tagbox' }, chips, search, opts);
  }
  const fileToImage = (file, maxW, maxH) => new Promise((resolve, reject) => {
    if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) return reject(new Error('Choose a PNG, JPG, WebP or GIF image.'));
    const rd = new FileReader();
    rd.onerror = () => reject(new Error('Could not read that file.'));
    rd.onload = () => {
      if (file.type === 'image/gif' && file.size < 400 * 1024) return resolve(rd.result);
      const img = new Image();
      img.onerror = () => reject(new Error('That image could not be opened.'));
      img.onload = () => {
        const k = Math.min(1, maxW / img.width, maxH / img.height);
        const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        let out = c.toDataURL('image/webp', 0.9);
        if (!out.startsWith('data:image/webp')) out = c.toDataURL('image/jpeg', 0.88);
        let q = 0.8;
        while (out.length * 0.75 > 400 * 1024 && q > 0.3) { out = c.toDataURL('image/jpeg', q); q -= 0.15; }
        if (out.length * 0.75 > 400 * 1024) return reject(new Error('That image is too big even after shrinking.'));
        resolve(out);
      };
      img.src = rd.result;
    };
    rd.readAsDataURL(file);
  });
  function uploadButton(spec, el, locked) {
    const dims = /banner/.test(spec.key) ? [1100, 440] : /avatar/.test(spec.key) ? [512, 512] : [1024, 1024];
    const input = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/gif', style: 'display:none' });
    const status = h('span', { class: 'muted small' });
    const thumb = h('img', { alt: '', style: 'height:40px;max-width:80px;border-radius:8px;object-fit:cover;display:none' });
    const paintThumb = () => { const v = el.value; if (/^https?:/.test(v)) { thumb.src = v; thumb.style.display = ''; } else thumb.style.display = 'none'; };
    input.addEventListener('change', async () => {
      const f = input.files && input.files[0]; if (!f) return;
      status.textContent = 'Uploading...';
      try {
        const dataUrl = await fileToImage(f, dims[0], dims[1]);
        const r = await api('/api/upload', { method: 'POST', body: { data: dataUrl } });
        el.value = r.url; set(spec.key, r.url); paintThumb(); status.textContent = 'Uploaded. Save to apply.';
      } catch (e) { status.textContent = ''; toast(e.message, 'bad'); }
      input.value = '';
    });
    el.addEventListener('input', paintThumb); paintThumb();
    return h('div', { style: 'display:flex;gap:10px;align-items:center;margin-top:8px;flex-wrap:wrap' },
      h('button', { type: 'button', class: 'btn ghost sm', disabled: locked ? true : null, onclick: () => input.click() }, icon('plus', 14), ' Upload a file'), thumb, status, input);
  }
  function ticketTypes(spec, locked) {
    const box = h('div', { class: 'tt-list' });
    const cats = guild.channels.filter((c) => c.type === 'category');
    const roles = guild.roles.filter((r) => !r.managed).sort((a, b) => b.position - a.position);
    let rows = (Array.isArray(draft[spec.key]) ? draft[spec.key] : []).map((t) => Object.assign({ label: '', emoji: '', action: 'form', url: '', category_id: '', staff_role_id: '', welcome: '', max_open: 1, questions: [] }, t, { questions: (t.questions || []).slice(0, 5) }));
    const push = () => set(spec.key, rows.filter((r) => r.label.trim()).map((r) => ({ label: r.label.trim(), emoji: r.emoji.trim(), action: r.action, url: r.url.trim(), category_id: r.category_id || '', staff_role_id: r.staff_role_id || '', welcome: r.welcome.trim(), max_open: r.max_open || 1, questions: r.questions.map((q) => q.trim()).filter(Boolean) })));
    const dis = locked ? true : null;
    const field = (label, el) => h('label', { class: 'tt-f' }, h('span', {}, label), el);
    const sel = (opts, val, on) => { const e = h('select', { disabled: dis }, opts.map((o) => h('option', { value: o[0] }, o[1]))); e.value = String(val || ''); e.addEventListener('change', () => on(e.value)); return e; };
    const ACTIONS = [['form', 'Form, then ticket'], ['channel', 'Ticket straight away'], ['dm', 'Ticket in DMs'], ['link', 'Open a link']];
    function paint() {
      box.replaceChildren(...rows.map((r, i) => h('div', { class: 'tt' },
        h('div', { class: 'tt-top' },
          h('b', {}, 'Button ' + (i + 1)),
          h('button', { type: 'button', class: 'btn ghost sm', disabled: dis, 'aria-label': 'Remove button', onclick: () => { rows.splice(i, 1); paint(); push(); } }, icon('trash', 16))),
        h('div', { class: 'tt-grid' },
          field('Button name', h('input', { type: 'text', maxlength: 45, value: r.label, disabled: dis, placeholder: 'e.g. Report a player', oninput: (e) => { r.label = e.target.value; push(); } })),
          field('Emoji (optional)', h('input', { type: 'text', maxlength: 8, value: r.emoji, disabled: dis, placeholder: '🎫', oninput: (e) => { r.emoji = e.target.value; push(); } })),
          field('What the button does', sel(ACTIONS, r.action, (v) => { r.action = v; paint(); push(); })),
          r.action === 'link' ? field('Link', h('input', { type: 'url', maxlength: 300, value: r.url, disabled: dis, placeholder: 'https://', oninput: (e) => { r.url = e.target.value; push(); } })) : null,
          r.action !== 'link' ? field('Category for the ticket', sel([['', 'Use the default category']].concat(cats.map((c) => [c.id, c.name])), r.category_id, (v) => { r.category_id = v; push(); })) : null,
          r.action !== 'link' ? field('Staff role', sel([['', 'Use the default staff role']].concat(roles.map((x) => [x.id, x.name])), r.staff_role_id, (v) => { r.staff_role_id = v; push(); })) : null,
          r.action !== 'link' ? field('Tickets per person', sel([['1', '1'], ['2', '2'], ['3', '3'], ['5', '5']], r.max_open, (v) => { r.max_open = parseInt(v, 10); push(); })) : null),
        r.action !== 'link' ? field('Welcome message (optional, use {user} and {server})', h('textarea', { maxlength: 500, disabled: dis, rows: 2, oninput: (e) => { r.welcome = e.target.value; push(); } }, r.welcome)) : null,
        (r.action === 'form' || r.action === 'dm') ? h('div', { class: 'tt-q' }, h('span', { class: 'muted small' }, 'Questions (up to 5)'),
          ...r.questions.map((q, qi) => h('div', { style: 'display:flex;gap:6px' },
            h('input', { type: 'text', maxlength: 45, value: q, disabled: dis, placeholder: 'Question ' + (qi + 1), oninput: (e) => { r.questions[qi] = e.target.value; push(); } }),
            h('button', { type: 'button', class: 'btn ghost sm', disabled: dis, onclick: () => { r.questions.splice(qi, 1); paint(); push(); } }, icon('trash', 14)))),
          r.questions.length < 5 ? h('div', {}, h('button', { type: 'button', class: 'btn ghost sm', disabled: dis, onclick: () => { r.questions.push(''); paint(); } }, icon('plus', 14), ' Add a question')) : null) : null)),
        rows.length < (spec.maxitems || 5) ? h('div', {}, h('button', { type: 'button', class: 'btn ghost sm', disabled: dis, onclick: () => { rows.push({ label: '', emoji: '', action: 'form', url: '', category_id: '', staff_role_id: '', welcome: '', max_open: 1, questions: [''] }); paint(); } }, icon('plus', 14), ' Add a ticket button')) : null);
    }
    paint();
    return box;
  }
  function textControl(spec, locked) {
    const isColor = /embed_color$/.test(spec.key);
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
    if (spec.type === 'url' && spec.upload) return h('div', {}, el, uploadButton(spec, el, locked));
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
      case 'roles': return rolesControl(spec, locked);
      case 'card': return cardControl(spec, locked);
      case 'channels': return channelsControl(spec, locked);
      case 'levelroles': return levelRolesControl(spec, locked);
      default: return h('span', { class: 'muted' }, 'Unsupported setting');
    }
  }
  function channelsControl(spec, locked) {
    const chosen = () => (Array.isArray(draft[spec.key]) ? draft[spec.key] : []);
    const chips = h('div', { class: 'chips' });
    const pick = h('select', { disabled: locked ? true : null, onchange: (e) => { const v = e.target.value; e.target.value = ''; if (v && !chosen().includes(v) && chosen().length < (spec.maxitems || 25)) { set(spec.key, chosen().concat([v])); paint(); } } });
    const paint = () => {
      chips.replaceChildren(...chosen().map((id) => { const c = guild.channels.find((x) => x.id === id); return h('button', { type: 'button', class: 'chip', disabled: locked ? true : null, onclick: () => { set(spec.key, chosen().filter((x) => x !== id)); paint(); } }, '#' + (c ? c.name : 'unknown'), h('span', { class: 'n' }, 'x')); }));
      if (!chosen().length) chips.append(h('span', { class: 'muted small' }, 'None chosen'));
      pick.replaceChildren(h('option', { value: '' }, 'Add a channel...'), ...guild.channels.filter((c) => (c.type === 'text' || c.type === 'announcement') && !chosen().includes(c.id)).map((c) => h('option', { value: c.id }, '#' + c.name)));
    };
    paint(); return h('div', { class: 'stack' }, pick, chips);
  }
  function levelRolesControl(spec, locked) {
    const rows = () => (Array.isArray(draft[spec.key]) ? draft[spec.key] : []);
    const box = h('div', { class: 'stack' });
    const roles = guild.roles.filter((r) => !r.managed).sort((a, b) => b.position - a.position);
    const paint = () => box.replaceChildren(...rows().map((r, i) => h('div', { style: 'display:flex;gap:8px;align-items:center' },
      h('span', { class: 'muted small' }, 'Level'), h('input', { type: 'number', min: 1, max: 1000, value: r.level, style: 'width:90px', disabled: locked ? true : null, oninput: (e) => { const n = parseInt(e.target.value, 10); const next = rows().map((x) => ({ ...x })); next[i].level = isNaN(n) ? 0 : n; set(spec.key, next); } }),
      (() => { const el = h('select', { disabled: locked ? true : null, style: 'flex:1', onchange: (e) => { const next = rows().map((x) => ({ ...x })); next[i].role = e.target.value; set(spec.key, next); } }, h('option', { value: '' }, 'Choose a role'), roles.map((x) => h('option', { value: x.id }, x.name))); el.value = r.role || ''; return el; })(),
      h('button', { type: 'button', class: 'btn ghost sm', disabled: locked ? true : null, onclick: () => { set(spec.key, rows().filter((_, j) => j !== i)); paint(); } }, 'x'))),
      rows().length < (spec.maxitems || 25) ? h('button', { type: 'button', class: 'btn ghost sm', disabled: locked ? true : null, onclick: () => { const next = rows().concat([{ level: (rows().reduce((m, x) => Math.max(m, x.level || 0), 0) || 0) + 5, role: '' }]); set(spec.key, next); paint(); } }, '+ Add a reward') : null);
    paint(); return box;
  }
  function cardControl(spec, locked) {
    const host = h('div', {});
    const on = () => draft[spec.key] && draft[spec.key].layers && draft[spec.key].layers.length;
    const paint = () => {
      if (!on() && !host.dataset.open) {
        host.replaceChildren(h('button', { type: 'button', class: 'btn ghost sm', disabled: locked ? true : null, onclick: () => { host.dataset.open = '1'; paint(); } }, 'Design an image card'));
        return;
      }
      host.dataset.open = '1';
      const ed = window.rexCard.editor(JSON.parse(JSON.stringify(draft[spec.key] || {})), { dis: locked, onchange: (c) => set(spec.key, JSON.parse(JSON.stringify(c))) });
      host.replaceChildren(ed, h('button', { type: 'button', class: 'btn ghost sm', disabled: locked ? true : null, onclick: () => { set(spec.key, {}); delete host.dataset.open; paint(); } }, 'Remove the card'));
    };
    paint(); return host;
  }
  function hintFor(spec) {
    if (spec.type === 'url' || ((spec.type === 'text') && (spec.blank_clears || spec.blank_ok))) return 'Leave empty to turn this off.';
    return '';
  }
  function nameLine(spec, sectionLock) {
    return [spec.label, spec.tier !== 'free' && !sectionLock && !tierOn(spec.tier) ? tierBadge(spec.tier) : null];
  }
  function settingRow(spec, sectionLock) {
    const reason = sectionLock || lockReason(spec), locked = !!reason;
    const wide = spec.type === 'tickettypes' || spec.type === 'card' || spec.type === 'channels' || spec.type === 'levelroles' || spec.type === 'roles' || (spec.type === 'text' && spec.multiline);
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
    if (sec.settings.length === 1 && sec.settings[0].type === 'builder') {
      box.append(rexBuilder.mount({ spec: sec.settings[0], draft, set, guild, errors, locked: !!secLock || !!lockReason(sec.settings[0]), unlimited: tierOn('ultra') || tierOn('priority') }));
      return box;
    }
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
    if (!secLock && (sec.id === 'tickets' || sec.id === 'verification')) box.append(panelCard(sec.id === 'tickets' ? 'ticket' : 'verify'));
    if (!secLock && sec.id === 'protection') box.append(lockdownCard());
    return box;
  }
  function lockdownCard() {
    const why = h('input', { type: 'text', maxlength: 200, placeholder: 'Reason (optional)' }), out = h('div', { class: 'hint', role: 'status' });
    const go = async (kind) => {
      if (kind === 'lockdown' && !(await rexDialog.confirm('Lock the whole server?', 'Every text channel will stop letting @everyone talk until you lift the lockdown.', 'Lock it down', true))) return;
      out.textContent = 'Asking Rex...';
      try {
        const r = await api('/api/guilds/' + gid + '/panel', { method: 'POST', body: { kind, channel: '0', reason: why.value } });
        const res = await waitForResult(r.id);
        out.textContent = res.ok ? (res.notes && res.notes[0]) || 'Done.' : (Object.values(res.errors || {})[0] || 'Rex could not do that.');
      } catch (e) { out.textContent = e.message; }
    };
    return h('div', { class: 'group frame', style: 'margin-top:16px' }, h('h3', {}, 'Emergency lockdown'), h('p', { class: 'muted small' }, 'Stops everyone talking in every channel, and lifts it again. Needs Rex to have Manage Channels.'),
      h('div', { class: 'stack' }, why, h('div', { style: 'display:flex;gap:10px;flex-wrap:wrap' }, h('button', { type: 'button', class: 'btn danger', onclick: () => go('lockdown') }, 'Lock down'), h('button', { type: 'button', class: 'btn ghost', onclick: () => go('unlock') }, 'Lift lockdown')), out));
  }
  function panelCard(kind) {
    const label = kind === 'ticket' ? 'ticket panel' : 'verification panel';
    const chans = guild.channels.filter((c) => c.type === 'text' || c.type === 'announcement');
    const sel = h('select', {}, h('option', { value: '' }, 'Choose a channel'), chans.map((c) => h('option', { value: c.id }, '#' + c.name)));
    const out = h('div', { class: 'hint', role: 'status' });
    const btn = h('button', { type: 'button', class: 'btn', onclick: async () => {
      if (!sel.value) { out.textContent = 'Pick a channel first.'; return; }
      if (dirtyKeys().length) { out.textContent = 'Save your changes first, so the panel uses them.'; return; }
      btn.disabled = true; out.textContent = 'Asking Rex...';
      try {
        const r = await api('/api/guilds/' + gid + '/panel', { method: 'POST', body: { kind, channel: sel.value } });
        const res = await waitForResult(r.id);
        out.textContent = res.ok ? (res.notes && res.notes[0]) || 'Posted.' : (Object.values(res.errors || {})[0] || 'Rex could not post it.');
      } catch (e) { out.textContent = e.message; }
      btn.disabled = false;
    } }, 'Post the ' + label);
    return h('div', { class: 'group frame', style: 'margin-top:16px' }, h('h3', {}, 'Publish the ' + label), h('p', { class: 'muted small' }, 'Posts a fresh panel in the channel you pick, using the settings above.'), h('div', { style: 'display:flex;gap:10px;flex-wrap:wrap;align-items:center' }, sel, btn), out);
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
          if (!(await rexDialog.confirm('Delete this transcript?', 'The link will stop working.', 'Delete', true))) return;
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
            : h('button', { class: 'btn danger sm', type: 'button', onclick: async () => { if (await rexDialog.confirm('Blacklist this server?', 'Rex will leave and cannot be added back.', 'Blacklist and leave', true)) run('blacklist', { reason: reason.value }, 'Blacklisted.'); } }, 'Blacklist and leave'))),
      h('div', { class: 'well' }, h('div', { style: 'display:flex;gap:14px;align-items:center' }, hide, h('div', {}, h('b', {}, 'Hide my setting changes from the activity log'), h('div', { class: 'muted small' }, 'Applies to changes you save on this page while in owner mode.')))),
      out);
  }

  /* ---------------------------------------------------------------- shell */
  const SECTION_ICON = { wave: 'wave', scroll: 'scroll', ticket: 'ticket', star: 'star', dice: 'dice', check: 'check', shield: 'shield', badge: 'badge', chart: 'chart', bolt: 'bolt', crown: 'crown', paint: 'paint' };
  const pseudo = [{ id: 'premium', name: 'Premium', icon: 'premium' }, { id: 'transcripts', name: 'Transcripts', icon: 'scroll' }];
  const allIds = () => schema.sections.map((s) => s.id).concat(pseudo.map((p) => p.id), ownerMode ? ['owner'] : []);
  let current = (location.hash || '').slice(1);
  if (!allIds().includes(current)) current = schema.sections[0].id;

  const FOCUS = new URLSearchParams(location.search).get('focus');
  if (FOCUS) document.body.classList.add('focus-mode');
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
  function builderLauncher(sec) {
    const locked = sec.tier !== 'free' && !tierOn(sec.tier);
    return h('div', { class: 'well launch' }, h('h3', {}, sec.id === 'commands' ? 'The command builder' : 'The event builder'),
      h('p', { class: 'muted' }, 'The builder needs room, so it opens on its own page. Everything you build is saved to this server.'),
      locked ? h('p', { class: 'muted small' }, 'Needs ' + TIER_LABEL[sec.tier] + ' on this server.') : null,
      h('a', { class: 'btn', href: '/server?id=' + encodeURIComponent(gid) + '&focus=' + sec.id + '#' + sec.id }, 'Open the builder'));
  }
  const GROUPS = [
    ['Welcome & logs', ['welcome', 'logs']],
    ['Help & safety', ['tickets', 'appeals', 'modapps', 'verification', 'protection', 'ultra', 'staff']],
    ['Community', ['levels', 'community']],
    ['Build', ['commands', 'events']],
    ['Insights & plan', ['analytics', 'priority', 'branding']],
  ];
  const groupOf = (id) => { const g = GROUPS.find((x) => x[1].includes(id)); return g ? g[0] : (id === 'premium' || id === 'transcripts' || id === 'owner') ? 'Account' : 'More'; };
  const openGroups = new Set();
  function drawSide() {
    const link = (id, name, ic, extra) => h('a', { href: '#' + id, class: current === id ? 'active' : '', onclick: (e) => { e.preventDefault(); go(id); } }, icon(ic || 'star'), name, extra || null);
    const mk = (s) => link(s.id, s.name, SECTION_ICON[s.icon], s.tier !== 'free' && !tierOn(s.tier) ? h('span', { class: 'badge tier-' + s.tier + ' tag' }, TIER_LABEL[s.tier]) : null);
    const byId = Object.fromEntries(schema.sections.map((x) => [x.id, x]));
    const placed = new Set();
    const groups = GROUPS.map(([name, ids]) => ({ name, items: ids.filter((i) => byId[i]).map((i) => { placed.add(i); return mk(byId[i]); }), ids: ids.filter((i) => byId[i]) })).filter((g) => g.items.length);
    const rest = schema.sections.filter((x) => !placed.has(x.id));
    if (rest.length) groups.push({ name: 'More', items: rest.map(mk), ids: rest.map((x) => x.id) });
    const acct = [link('premium', 'Premium', 'premium'), link('transcripts', 'Transcripts', 'scroll')].concat(ownerMode ? [h('div', { class: 'gold' }, link('owner', 'Owner', 'key'))] : []);
    groups.push({ name: 'Account', items: acct, ids: ['premium', 'transcripts', 'owner'] });
    const flat = innerWidth <= 960 || document.documentElement.getAttribute('data-theme') === 'halloween';
    side.replaceChildren(...groups.map((g) => {
      const here = g.ids.includes(current);
      const d = h('details', { class: 'side-group' + (here ? ' here' : ''), open: flat || here || openGroups.has(g.name) }, h('summary', {}, g.name, h('span', { class: 'chev', 'aria-hidden': 'true' })), h('div', { class: 'side-items' }, g.items));
      d.addEventListener('toggle', () => { if (d.open) openGroups.add(g.name); else openGroups.delete(g.name); });
      return d;
    }));
  }
  function go(id) { current = id; history.replaceState(null, '', '#' + id); drawSide(); show(id); window.scrollTo(0, 0); }

  async function show(id, quiet) {
    const sec = schema.sections.find((s) => s.id === id);
    const pse = pseudo.find((p) => p.id === id);
    const name = sec ? sec.name : pse ? pse.name : 'Owner';
    const desc = sec ? sec.description : id === 'premium' ? 'See which tiers this server has and redeem a code.' : id === 'transcripts' ? 'Ticket transcripts saved as web pages.' : 'Rex owner controls for this server.';
    const frame = [...banners(),
      h('div', { class: 'sec-head' }, h('h2', {}, name), sec && sec.tier !== 'free' && !tierOn(sec.tier) ? tierBadge(sec.tier) : null),
      h('p', { class: 'sec-desc' }, desc)];
    main.replaceChildren(...frame, h('div', { id: 'sec-body' }));
    const body = document.getElementById('sec-body');
    if (sec && (id === 'commands' || id === 'events') && !FOCUS) body.append(builderLauncher(sec));
    else if (sec) body.append(settingsSection(sec));
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
        r.byid ? h('button', { class: 'btn ghost sm', type: 'button', onclick: async () => { if (await rexDialog.confirm('Undo everything from ' + (r.by || 'this person') + '?', 'Only things that have not been changed again since.', 'Undo it all', true)) undo({ user: r.byid }); } }, 'Undo everything from ' + (r.by || 'this person')) : null) : null);
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
  let flashTimer = null;
  function flashBar(text, kind, ms) {
    clearTimeout(flashTimer); savebar.dataset.state = kind; savebar.querySelector('#savecount').textContent = text; savebar.classList.add('show');
    if (ms) flashTimer = setTimeout(() => { delete savebar.dataset.state; refreshBar(); }, ms);
  }
  function refreshBar() {
    if (savebar.dataset.state) return;
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
        if (first && Object.keys(first.errors || {}).length) toast('Rex rejected part of that change. Open the activity log.', 'bad'); else { toast('Rex applied your changes.', 'good'); flashBar('Saved and applied', 'done', 2600); }
      }
      const y = window.scrollY; drawConsole(); if (had !== pending.length) { show(current, true); window.scrollTo(0, y); }
    } catch (e) { /* retry */ }
    if (!pending.length) { clearInterval(polling); polling = null; }
  }
  function startPolling() { if (!polling) polling = setInterval(poll, 1000); }
  setInterval(() => { if (!document.hidden && !polling && !consoleOpen) poll().catch(() => {}); }, 45000);

  savebar.querySelector('#discard').addEventListener('click', () => { draft = Object.assign({}, original); errors = {}; show(current, true); });
  savebar.querySelector('#save').addEventListener('click', async (ev) => {
    const btn = ev.currentTarget, changes = {};
    dirtyKeys().forEach((k) => { changes[k] = draft[k]; });
    if (!Object.keys(changes).length) return;
    btn.disabled = true; flashBar('Saving...', 'saving');
    try {
      const res = await api('/api/guilds/' + encodeURIComponent(gid) + '/settings', { method: 'PUT', body: { changes, silent: ownerMode && hideLog } });
      if (res.queued) {
        pending = pending.concat([{ id: res.id, keys: res.keys }]);
        Object.keys(changes).forEach((k) => { original[k] = changes[k]; });
        flashBar('Sent to Rex. Applying...', 'saving'); startPolling();
      }
      show(current, true); drawConsole();
    } catch (e) {
      if (e.code === 'invalid_value') {
        errors = (e.data && e.data.errors) || {};
        const firstSec = schema.sections.find((s) => s.settings.some((x) => errors[x.key]));
        if (firstSec && firstSec.id !== current) go(firstSec.id); else show(current, true);
        toast('Some values were rejected. Check the highlighted settings.', 'bad');
      } else toast(e.message, 'bad');
    } finally { btn.disabled = false; if (savebar.dataset.state === 'saving' && !pending.length) { delete savebar.dataset.state; refreshBar(); } }
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
  let wasNarrow = innerWidth <= 960; window.addEventListener('resize', () => { const n = innerWidth <= 960; if (n !== wasNarrow) { wasNarrow = n; drawSide(); } });
  window.addEventListener('hashchange', () => { const id = (location.hash || '').slice(1); if (allIds().includes(id) && id !== current) { current = id; drawSide(); show(id); } });

  const backBar = FOCUS ? h('div', { class: 'wrap focus-bar' }, h('a', { class: 'btn ghost sm', href: '/server?id=' + encodeURIComponent(gid) + '#' + FOCUS }, '< Back to ' + guild.name), h('b', {}, FOCUS === 'commands' ? 'Custom commands' : 'Events')) : null;
  app.replaceChildren(FOCUS ? h('div', { class: 'srv-spacer' }) : h('div', { class: 'srv-spacer' }), backBar, h('div', { class: 'srv-layout' }, side, main));
  document.body.append(head, savebar);
  drawHead(); drawSide(); show(current);
  if (pending.length) startPolling();
})();
