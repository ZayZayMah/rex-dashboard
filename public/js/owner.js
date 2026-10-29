'use strict';
(async function () {
  const app = document.getElementById('app');
  const me = await mountNav('owner');
  if (REX.blocked) return;
  if (!me) return app.replaceChildren(stateScreen('Log in first', 'Owner mode needs a Discord login.', h('a', { class: 'btn', href: '/auth/login' }, 'Log in with Discord')));
  if (!me.is_owner) return app.replaceChildren(stateScreen('Owners only', 'This area is only for Rex owners.', h('a', { class: 'btn ghost', href: '/' }, 'Home')));
  if (!me.owner_mode) {
    return app.replaceChildren(stateScreen('Owner mode is off', 'Turn it on to use the owner tools. It switches off when you log out.',
      h('button', { class: 'btn', type: 'button', onclick: async () => { try { await api('/api/owner/mode', { method: 'POST', body: { on: true } }); location.reload(); } catch (e) { toast(e.message, 'bad'); } } }, 'Enter Owner Mode')));
  }

  const B = (me.beta || {});
  const TABS = [['tools', 'Tools'], ['website', 'Website'], ['servers', 'Servers'], ['users', 'Users']];
  if (B.support && B.support !== 'off') TABS.push(['support', 'Support']);
  if (B.email && B.email !== 'off') TABS.push(['email', 'Email']);
  TABS.push(['audit', 'Audit'], ['health', 'Health']);
  let tab = (location.hash || '#tools').slice(1);
  if (!TABS.some((t) => t[0] === tab)) tab = 'tools';
  const nav = h('div', { class: 'tabs', role: 'tablist' });
  const pane = h('div', { class: 'owner-pane' });
  app.replaceChildren(h('div', { class: 'wrap' }, h('div', { class: 'page-head' }, h('h1', {}, 'Owner mode'), h('p', { class: 'muted' }, 'Everything here is only visible to Rex owners.')), nav, pane));

  function drawTabs() {
    nav.replaceChildren(...TABS.map(([id, name]) => h('button', { type: 'button', role: 'tab', 'aria-selected': String(tab === id), class: tab === id ? 'active' : '', onclick: () => { tab = id; history.replaceState(null, '', '#' + id); drawTabs(); render(); } }, name)));
  }
  const result = (box, r) => {
    box.hidden = false;
    if (r.ok) box.textContent = (r.out && r.out.code) ? 'Code: ' + r.out.code + '  (' + r.out.tier + ', ' + r.out.duration + ', ' + r.out.limit + ' use' + (r.out.limit === 1 ? '' : 's') + ')' : (r.out && r.out.text) || (r.notes || []).join(', ') || 'Done.';
    else box.textContent = Object.values(r.errors || {})[0] || 'That did not work.';
  };
  async function sendOp(op, gid, args, box) {
    box.hidden = false; box.textContent = 'Sending to Rex...';
    try {
      const res = await api('/api/owner/op', { method: 'POST', body: { op, gid, args } });
      result(box, await waitForResult(res.id));
    } catch (e) { box.textContent = e.message; }
  }
  const field = (label, el) => h('div', {}, h('label', { class: 'lbl' }, label), el);

  /* ---- status editor (lines, rotation, static status, speed) */
  function statusCard() {
    const box = h('div', { class: 'well stack' }), out = h('div', { class: 'result-box', hidden: true });
    const KINDS = ['playing', 'watching', 'listening', 'competing'], CATS = ['fun', 'stats', 'website', 'random', 'owner'];
    const sel = (opts, v) => { const e = h('select', {}, opts.map((o) => h('option', { value: o }, o))); if (v) e.value = v; return e; };
    async function run(tool, f, wait) {
      out.hidden = false; out.textContent = 'Saving...';
      try { const r = await api('/api/owner/op', { method: 'POST', body: { op: 'owner_tool', gid: '', args: { tool, f } } }); const res = await waitForResult(r.id); out.textContent = res.ok ? 'Done.' : (Object.values(res.errors || {})[0] || 'Rex could not do that.'); setTimeout(load, 1500); } catch (e) { out.textContent = e.message; }
    }
    async function load() {
      let d; try { d = await api('/api/owner/status'); } catch (e) { box.replaceChildren(h('p', { class: 'muted' }, e.message)); return; }
      const c = d.status;
      if (!c) { box.replaceChildren(h('h3', {}, 'Status'), h('p', { class: 'muted' }, 'Rex has not sent its status yet. Try again in a moment.')); return; }
      const nk = sel(KINDS), nt = h('input', { type: 'text', maxlength: 128, placeholder: 'Watching {servers} servers' }), nc = sel(CATS);
      const sk = sel(KINDS, c.static.type), st = h('input', { type: 'text', maxlength: 128, value: c.static.text || '' });
      const iv = h('input', { type: 'number', min: 15, max: 86400, value: c.interval });
      const rot = h('button', { type: 'button', class: 'btn' + (c.rotate ? '' : ' ghost'), onclick: () => run('status-rotate', { on: c.rotate ? 'off' : 'on' }) }, c.rotate ? 'Rotation is ON (tap to turn off)' : 'Rotation is OFF (tap to turn on)');
      box.replaceChildren(h('h3', {}, 'Status'), h('p', { class: 'muted small' }, 'Placeholders: {servers} {users} {commands} {uptime} {website} {ping}'), rot,
        h('div', { class: 'status-lines' }, c.lines.length ? c.lines.map((l, i) => h('div', { class: 'status-line' }, h('span', { class: 'pill' + (c.off_cats.includes(l.cat) ? ' off' : ' on') }, l.cat), h('span', { class: 'ell', style: 'flex:1;min-width:0' }, l.type + ' ' + l.text),
          h('button', { type: 'button', class: 'btn ghost sm', onclick: () => run('status-remove', { n: String(i + 1) }) }, 'Remove'))) : [h('p', { class: 'muted' }, 'No lines.')]),
        h('div', { class: 'row-3' }, field('Type', nk), field('Text', nt), field('Category', nc)),
        h('div', {}, h('button', { type: 'button', class: 'btn', onclick: () => nt.value.trim() && run('status-add', { kind: nk.value, text: nt.value, cat: nc.value }) }, 'Add line')),
        h('h4', {}, 'Static status'), h('div', { class: 'row-3' }, field('Type', sk), field('Text', st), h('div', {}, h('label', { class: 'lbl' }, ' '), h('button', { type: 'button', class: 'btn', onclick: () => st.value.trim() && run('status-static', { kind: sk.value, text: st.value }) }, 'Use this only'))),
        h('h4', {}, 'Rotation speed (seconds, 15 or more)'), h('div', { style: 'display:flex;gap:8px' }, iv, h('button', { type: 'button', class: 'btn', onclick: () => run('status-interval', { secs: iv.value }) }, 'Save speed')),
        h('h4', {}, 'Categories'), h('div', { class: 'chips' }, CATS.map((k) => h('button', { type: 'button', class: 'chip' + (c.off_cats.includes(k) ? '' : ' on'), onclick: () => run('status-cat', { cat: k, on: c.off_cats.includes(k) ? 'on' : 'off' }) }, k))),
        out);
    }
    load(); return box;
  }

  /* ---- tools (the same list the /ownertools command shows) */
  function toolsTab() {
    const tier = h('select', {}, ['premium', 'priority', 'ultra'].map((t) => h('option', { value: t }, TIER_LABEL[t])));
    const dur = h('select', {}, ['1 day', '7 days', '30 days', '90 days', '1 year', 'lifetime'].map((d) => h('option', { value: d }, d)));
    dur.value = '30 days';
    const lim = h('input', { type: 'number', min: 1, max: 1000, value: 1 });
    const out1 = h('div', { class: 'result-box', hidden: true });
    async function makeCode() {
      out1.hidden = false; out1.textContent = 'Making your code...';
      try {
        const r = await api('/api/owner/op', { method: 'POST', body: { op: 'gen_code', gid: '', args: { tier: tier.value, duration: dur.value, limit: parseInt(lim.value, 10) || 1 } } });
        const code = r.code;
        out1.replaceChildren(h('code', { class: 'bigcode' }, code), ' ', h('button', { class: 'btn ghost sm', type: 'button', onclick: () => { try { navigator.clipboard.writeText(code); toast('Copied', 'ok'); } catch (e) {} } }, 'Copy'),
          h('div', { class: 'muted small' }, TIER_LABEL[r.tier] + ', ' + r.duration + ', ' + r.limit + ' use' + (r.limit === 1 ? '' : 's') + '. It is ready to use in a few seconds, once Rex has registered it.'));
        waitForResult(r.id).then((res) => { if (!res.ok) out1.append(h('div', { class: 'hint bad' }, Object.values(res.errors || {})[0] || 'Rex could not register it.')); }).catch(() => {});
      } catch (e) { out1.textContent = e.message; }
    }
    const holder = h('div', { class: 'stack' }, h('p', { class: 'muted' }, 'Loading tools...'));
    (async () => {
      let reg;
      try { reg = await api('/api/owner/tools'); } catch (e) { reg = null; }
      if (!reg || !reg.tools || !reg.tools.length) { holder.replaceChildren(h('div', { class: 'well' }, h('p', { class: 'muted' }, 'Rex has not sent its tool list yet. It does this a few seconds after it starts. Reload this page in a moment.'))); return; }
      let cat = (reg.categories[0] || {}).id;
      const chips = h('div', { class: 'chips' }), list = h('div', { class: 'tool-grid' });
      const drawChips = () => chips.replaceChildren(...reg.categories.map((c) => h('button', { type: 'button', class: 'chip' + (cat === c.id ? ' on' : ''), onclick: () => { cat = c.id; drawChips(); drawList(); } }, c.icon + ' ' + c.label)));
      const toolCard = (t) => {
        const inputs = {}, out = h('div', { class: 'result-box', hidden: true });
        const fields = t.fields.map((f) => {
          const el = f.type === 'select' ? h('select', {}, (f.options || []).map((o) => h('option', { value: o }, o))) : h('input', { type: f.type === 'number' ? 'number' : 'text', placeholder: f.placeholder || '', maxlength: 500 });
          inputs[f.key] = el; return field(f.label + (f.required ? '' : ' (optional)'), el);
        });
        let armed = false;
        const btn = h('button', { class: 'btn' + (t.danger ? ' danger' : ''), type: 'button' }, t.danger ? 'Run...' : 'Run');
        btn.onclick = () => {
          if (t.danger && !armed) { armed = true; btn.textContent = 'Tap again to confirm'; setTimeout(() => { armed = false; btn.textContent = 'Run...'; }, 4000); return; }
          armed = false; btn.textContent = t.danger ? 'Run...' : 'Run';
          const f = {}; Object.keys(inputs).forEach((k) => { f[k] = inputs[k].value; });
          sendOp('owner_tool', '', { tool: t.id, f }, out);
        };
        return h('div', { class: 'well tool' }, h('h4', {}, t.label), t.desc ? h('p', { class: 'muted small' }, t.desc) : null, fields.length ? h('div', { class: 'stack' }, fields) : null, h('div', { style: 'margin-top:12px' }, btn), out);
      };
      const drawList = () => list.replaceChildren(...reg.tools.filter((t) => t.cat === cat && !/^status-(list|add|remove|rotate|static|interval|cat)$/.test(t.id)).map(toolCard));
      drawChips(); drawList();
      holder.replaceChildren(chips, list);
    })();
    return h('div', { class: 'stack' },
      h('div', { class: 'frame' }, h('h3', {}, 'Generate a code'), h('p', { class: 'muted small' }, 'The code appears instantly. Rex registers it in the background.'),
        h('div', { class: 'row-3' }, field('Tier', tier), field('Length', dur), field('Uses', lim)),
        h('div', { style: 'margin-top:14px' }, h('button', { class: 'btn', type: 'button', onclick: makeCode }, 'Generate')), out1),
      statusCard(),
      h('div', { class: 'well' }, h('h3', {}, 'Bot tools'), h('p', { class: 'muted small' }, 'Exactly the same tools as /ownertools in Discord.'), holder));
  }

  /* ---- support (beta) */
  async function supportTab() {
    const wrap = h('div', { class: 'stack' }), listBox = h('div', { class: 'sup-list' }), view = h('div', { class: 'well' }, h('p', { class: 'muted' }, 'Pick a chat on the left.'));
    let sel = null, items = [], timer = null, shown = 0;
    const label = { bot: 'Helper', open: 'Needs you', closed: 'Closed' };
    const paintList = () => listBox.replaceChildren(...(items.length ? items.map((c) => h('button', { type: 'button', class: 'sup-row' + (sel === c.id ? ' sel' : ''), onclick: () => pick(c.id) },
      h('div', { style: 'min-width:0;text-align:left' }, h('b', {}, c.name), h('div', { class: 'muted small ell' }, c.last || '')), h('span', { class: 'pill ' + (c.status === 'open' ? 'mid' : c.status === 'closed' ? 'off' : 'on') }, label[c.status]))) : [h('p', { class: 'muted' }, 'No chats yet.')]));
    async function refresh() { try { items = (await api('/api/owner/support')).items; paintList(); } catch (e) { /* ignore */ } }
    async function pick(id) {
      sel = id; shown = 0; paintList();
      const log = h('div', { class: 'chat-log' }), input = h('textarea', { rows: 2, maxlength: 600, placeholder: 'Reply as the Rex team...' }), head = h('div', { class: 'chat-head' }), acts = h('div', { class: 'chat-actions' });
      const paint = (c) => {
        if (c.msgs.length < shown) { log.replaceChildren(); shown = 0; }
        c.msgs.slice(shown).forEach((m) => log.append(h('div', { class: 'msg ' + (m.f === 's' ? 'u' : m.f) }, h('div', { class: 'av' }, m.f === 'u' ? '🧑' : m.f === 's' ? 'R' : '🦖'),
          h('div', { class: 'bd' }, h('div', { class: 'who' }, m.f === 'u' ? c.name : m.f === 's' ? 'Team' : 'Helper', h('small', {}, ' ' + new Date(m.t * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))), h('div', { class: 'tx' }, m.x)))));
        if (c.msgs.length !== shown) log.scrollTop = log.scrollHeight;
        shown = c.msgs.length;
        head.replaceChildren(h('b', {}, c.name), h('span', { class: 'muted small' }, 'ID ' + c.uid + ' - ' + c.type), c.url ? h('a', { class: 'btn ghost sm', href: c.url, target: '_blank', rel: 'noopener' }, 'Discord channel') : null);
        acts.replaceChildren(c.status === 'closed' ? h('button', { class: 'btn ghost sm', type: 'button', onclick: () => act('reopen') }, 'Reopen') : h('button', { class: 'btn ghost sm', type: 'button', onclick: () => act('close') }, 'Close chat'));
      };
      async function act(a) { try { paint(await api('/api/owner/support/' + id + '/' + a, { method: 'POST', body: {} })); refresh(); } catch (e) { toast(e.message, 'bad'); } }
      async function reply() { const t = input.value.trim(); if (!t) return; input.value = ''; try { paint(await api('/api/owner/support/' + id + '/reply', { method: 'POST', body: { text: t } })); refresh(); } catch (e) { toast(e.message, 'bad'); input.value = t; } }
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); reply(); } });
      view.replaceChildren(head, log, h('div', { class: 'chat-in' }, input, h('button', { class: 'btn', type: 'button', onclick: reply }, 'Send')), acts);
      paint(await api('/api/owner/support/' + id));
      clearInterval(timer);
      timer = setInterval(async () => { if (tab !== 'support') return clearInterval(timer); try { const c = await api('/api/owner/support/' + id); if (c.msgs.length !== shown) paint(c); refresh(); } catch (e) { /* ignore */ } }, 3500);
    }
    // answers the helper knows (added on top of the built-in ones)
    const kb = await api('/api/owner/support/kb'); const kbBox = h('div', { class: 'stack' }), kbItems = kb.items || [];
    const paintKb = () => kbBox.replaceChildren(...kbItems.map((it, i) => h('div', { class: 'well' },
      h('div', { class: 'row-2' }, field('Title', h('input', { type: 'text', value: it.title, maxlength: 80, oninput: (e) => { it.title = e.target.value; } })), field('Words that trigger it (comma separated)', h('input', { type: 'text', value: it.keys.join(', '), oninput: (e) => { it.keys = e.target.value.split(',').map((x) => x.trim()).filter(Boolean); } }))),
      field('Answer', h('textarea', { rows: 3, maxlength: 800, oninput: (e) => { it.answer = e.target.value; } }, it.answer)),
      h('button', { class: 'btn ghost sm', type: 'button', onclick: () => { kbItems.splice(i, 1); paintKb(); } }, 'Remove'))));
    paintKb();
    const kbStatus = h('span', { class: 'muted small' });
    wrap.append(h('div', { class: 'sup-split' }, h('div', { class: 'frame' }, h('h3', {}, 'Chats'), listBox), view),
      h('div', { class: 'frame' }, h('h3', {}, 'What the helper can answer'), h('p', { class: 'muted small' }, 'Rex already knows the basics. Add your own answers here and they take effect straight away.'), kbBox,
        h('div', { style: 'display:flex;gap:10px;align-items:center;margin-top:12px' }, h('button', { class: 'btn ghost', type: 'button', onclick: () => { kbItems.push({ title: '', keys: [], answer: '' }); paintKb(); } }, 'Add an answer'),
          h('button', { class: 'btn', type: 'button', onclick: async () => { try { const r = await api('/api/owner/support/kb', { method: 'PUT', body: { items: kbItems } }); kbStatus.textContent = 'Saved ' + r.n + ' answers.'; toast('Saved', 'good'); } catch (e) { kbStatus.textContent = e.message; } } }, 'Save answers'), kbStatus)));
    await refresh();
    return wrap;
  }

  /* ---- email (beta) */
  async function emailTab() {
    const st = await api('/api/owner/email');
    const wrap = h('div', { class: 'stack' });
    const status = h('div', { class: 'hint', role: 'status' });
    // 1. Gmail connection
    const conn = h('div', { class: 'frame' }, h('h3', {}, 'Gmail'));
    if (!st.configured) {
      conn.append(h('p', { class: 'muted small' }, 'Gmail is not set up yet. In Google Cloud, create an OAuth client (type "Desktop app" or "Web application", redirect http://localhost), turn on the Gmail API, then add GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET as secrets on the Cloudflare worker. Reload this page afterwards.'));
    } else if (st.connected) {
      conn.append(h('p', {}, 'Sending from ', h('b', {}, st.connected)), h('button', { class: 'btn ghost sm', type: 'button', onclick: async () => { if (await rexDialog.confirm('Disconnect Gmail?', 'You can connect it again any time.', 'Disconnect', true)) { await api('/api/owner/email/disconnect', { method: 'POST', body: {} }); location.reload(); } } }, 'Disconnect'));
    } else {
      const paste = h('input', { type: 'text', placeholder: 'http://localhost/?code=4/0A...', maxlength: 1500 });
      conn.append(h('ol', { class: 'howto' }, h('li', {}, 'Press "Open Google" and allow Rex to send email from your account.'), h('li', {}, 'Google then sends you to a page that will not load (http://localhost). That is expected.'), h('li', {}, 'Copy the whole address from the browser bar and paste it below.')),
        h('a', { class: 'btn', href: st.auth_url, target: '_blank', rel: 'noopener' }, 'Open Google'), h('div', { style: 'margin-top:12px' }, field('Pasted address', paste)),
        h('button', { class: 'btn', style: 'margin-top:12px', type: 'button', onclick: async () => { try { await api('/api/owner/email/connect', { method: 'POST', body: { url: paste.value } }); location.reload(); } catch (e) { toast(e.message, 'bad'); } } }, 'Connect'));
    }
    wrap.append(conn);
    function tagsCard() {
      const list = h('div', { class: 'stack' }), msg = h('span', { class: 'muted small' }); let tg = st.tags.map((x) => Object.assign({}, x));
      const paint = () => list.replaceChildren(...tg.map((x, i) => h('div', { class: 'well' }, h('div', { class: 'row-2' }, field('Tag name', h('input', { type: 'text', maxlength: 30, value: x.name, oninput: (e) => { x.name = e.target.value; } })), field('What it is (people see this)', h('input', { type: 'text', maxlength: 120, value: x.desc || '', oninput: (e) => { x.desc = e.target.value; } }))),
        h('button', { class: 'btn ghost sm', type: 'button', disabled: tg.length < 2, onclick: () => { tg.splice(i, 1); paint(); } }, 'Remove'))));
      paint();
      return h('div', { class: 'frame' }, h('h3', {}, 'Email tags'), h('p', { class: 'muted small' }, 'Tags are the kinds of email people can choose on their preferences page. Send an email to a tag and only people who kept it on get it. Removing a tag pauses any automatic email that was using it.'), list,
        h('div', { style: 'display:flex;gap:10px;align-items:center;margin-top:12px;flex-wrap:wrap' }, h('button', { class: 'btn ghost', type: 'button', onclick: () => { if (tg.length < 12) { tg.push({ name: '', desc: '' }); paint(); } } }, 'Add a tag'),
          h('button', { class: 'btn', type: 'button', onclick: async () => { try { const r = await api('/api/owner/email/tags', { method: 'PUT', body: { tags: tg } }); tg = r.tags; st.tags = r.tags; msg.textContent = 'Saved.'; toast('Tags saved', 'good'); paint(); } catch (e) { msg.textContent = e.message; toast(e.message, 'bad'); } } }, 'Save tags'), msg));
    }

    // 2. saved emails
    const A = st.audience, tagName = (id) => ((st.tags.find((t) => t.id === id) || {}).name) || id, label = (v) => v === 'target' ? 'Only the person it happens to' : v === 'everyone' ? 'Everyone' : v === 'essential' ? 'Essential' : (v || '').startsWith('tag:') ? 'Tag: ' + tagName(v.slice(4)) : v;
    const rule = (t) => t.send_when === 'manual' ? 'Sent by you, by hand' : (st.events[t.send_when] || t.send_when) + ' → ' + label(t.send_to) + ' → ' + (st.send_at[t.when_at || 'now'] || '').toLowerCase() + (t.when_at === 'time' ? ' ' + t.at_time + ' UTC' : '') + (t.enabled ? '' : ' (paused)');
    const statusLine = h('div', { class: 'hint', role: 'status' });
    const rows = h('div', { class: 'stack' });
    const paintRows = () => rows.replaceChildren(...(st.templates.length ? st.templates.map((t) => h('div', { class: 'well mail-row' },
      h('div', {}, h('b', {}, t.name), h('div', { class: 'muted small' }, t.subject), h('div', { class: 'small' }, rule(t)), h('div', { class: 'muted small' }, 'Sent ' + (t.sent || 0) + ' time' + (t.sent === 1 ? '' : 's') + ' · edited ' + timeAgo(t.updated))),
      h('div', { class: 'mail-acts' }, h('a', { class: 'btn sm', href: '/email-builder?id=' + t.id }, 'Edit'), h('button', { class: 'btn ghost sm', type: 'button', onclick: () => sendDialog(t) }, 'Send…'),
        h('button', { class: 'btn ghost sm', type: 'button', onclick: async () => { if (await rexDialog.confirm('Delete "' + t.name + '"?', 'This cannot be undone. Automatic sending of it stops.', 'Delete', true)) { await api('/api/owner/email/templates/' + t.id, { method: 'DELETE', body: {} }); st.templates = st.templates.filter((x) => x.id !== t.id); paintRows(); } } }, 'Delete')))) : [h('p', { class: 'muted' }, 'No saved emails yet. Press "New email" to design one.')]));
    async function sendDialog(t) {
      const aud = h('select', {}, [...st.tags.map((x) => ['tag:' + x.id, 'People with tag: ' + x.name + ' (' + (A.tags[x.id] || 0) + ')']), ['everyone', 'Everyone except people who unsubscribed (' + A.everyone + ')'], ['essential', 'Essential: everyone, even if they unsubscribed (' + (A.everyone + A.off) + ')'], ['people', 'Specific people (Discord IDs or email addresses)'], ['test', 'A test to one address']].map(([v, n]) => h('option', { value: v }, n)));
      if (t.send_to && [...aud.options].some((op) => op.value === t.send_to)) aud.value = t.send_to;
      const ids = h('textarea', { rows: 3, placeholder: 'Discord IDs or email addresses, one per line', hidden: true }), to = h('input', { type: 'email', placeholder: 'you@example.com', hidden: true });
      aud.addEventListener('change', () => { ids.hidden = aud.value !== 'people'; to.hidden = aud.value !== 'test'; });
      const bar = h('div', { class: 'track', hidden: true }, h('i', { style: 'width:0%' })), msg = h('div', { class: 'hint', role: 'status' });
      const go = h('button', { class: 'btn', type: 'button' }, 'Send now'), close = h('button', { class: 'btn ghost', type: 'button' }, 'Close');
      const box = h('div', { class: 'mail-modal' }, h('div', { class: 'frame' }, h('h3', {}, 'Send "' + t.name + '"'), h('p', { class: 'muted small' }, 'People with no email on file are skipped. Today: ' + st.sent_today + ' of ' + st.cap + ' sends used. Keep this page open while it sends.'), h('div', { class: 'stack' }, field('Who gets it', aud), ids, to), h('div', { style: 'display:flex;gap:10px;margin-top:12px' }, go, close), bar, msg));
      close.onclick = () => box.remove();
      go.onclick = async () => {
        go.disabled = true; bar.hidden = false; let cid = null, last = null;
        try {
          for (let i = 0; i < 500; i++) {
            last = await api('/api/owner/email/send', { method: 'POST', body: { cid, tpl: t.id, audience: aud.value, users: ids.value.split(/[\s,]+/).filter(Boolean), test_to: to.value } });
            cid = last.cid; bar.firstChild.style.width = Math.round(last.pos / last.total * 100) + '%';
            msg.textContent = 'Sent ' + last.sent + ' of ' + last.total + (last.failed ? ' (' + last.failed + ' failed)' : '') + '...';
            if (last.done || last.paused) break;
          }
          msg.textContent = last.done ? 'Done. Sent ' + last.sent + ', failed ' + last.failed + '.' : 'Stopped at the daily limit after ' + last.sent + ' emails. Send the rest tomorrow.';
        } catch (e) { msg.textContent = e.message; }
        go.disabled = false;
      };
      document.body.append(box);
    }
    paintRows();
    const gen = h('div', { class: 'chips' }, st.tags.map((x) => h('a', { class: 'chip', href: '/email-builder?gen=' + x.id }, 'Generate: ' + x.name)));
    wrap.append(h('div', { class: 'frame' }, h('div', { style: 'display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap' }, h('h3', { style: 'margin:0' }, 'Saved emails'), h('a', { class: 'btn', href: '/email-builder' }, 'New email')),
      h('p', { class: 'muted small' }, 'Each email remembers who gets it and when it goes out. Emails go to everyone with an email on file, unless they turned emails off. ' + A.everyone + ' can get emails now, ' + A.off + ' turned them off, ' + A.no_email + ' have no email on file.'), h('div', { class: 'muted small' }, 'Make a ready-to-edit email for a tag:'), gen, rows, statusLine));
    wrap.append(tagsCard());

    // 3. history
    if (st.campaigns.length) wrap.append(h('div', { class: 'frame' }, h('h3', {}, 'Recent sends'), h('table', { class: 'tbl' }, h('tbody', {}, st.campaigns.map((c) => h('tr', {}, h('td', {}, c.name || c.subject), h('td', {}, c.sent + '/' + c.total + (c.failed ? ' (' + c.failed + ' failed)' : '')), h('td', { class: 'muted' }, timeAgo(c.started))))))));
    return wrap;
  }

  /* ---- website */
  function websiteTab(site) {
    const maint = site.maint || site.maintenance || {}, status = h('div', { class: 'hint', role: 'status' });
    const themes = [['normal', 'Normal', 'The standard Rex look.'], ['halloween', 'Halloween', 'A completely separate spooky layout.'], ['christmas', 'Christmas', 'Snow, lights and a winter layout.']];
    let theme = site.theme || 'normal';
    const cards = h('div', { class: 'theme-grid' });
    const paintThemes = () => cards.replaceChildren(...themes.map(([id, name, d]) => h('button', { type: 'button', class: 'theme-card t-' + id + (theme === id ? ' on' : ''), 'aria-pressed': String(theme === id), onclick: () => { theme = id; paintThemes(); } }, h('b', {}, name), h('span', {}, d))));
    paintThemes();
    const mOn = h('button', { type: 'button', class: 'rocker', role: 'switch', 'aria-checked': String(!!maint.on) });
    mOn.addEventListener('click', () => mOn.setAttribute('aria-checked', String(mOn.getAttribute('aria-checked') !== 'true')));
    const mTitle = h('input', { type: 'text', maxlength: 80, placeholder: "We'll be right back" }), mDesc = h('textarea', { maxlength: 300, placeholder: "We're currently under maintenance. Please try again later." });
    mTitle.value = maint.title || ''; mDesc.value = maint.desc || '';
    const support = h('input', { type: 'url', maxlength: 200, placeholder: 'https://discord.gg/...' });
    support.value = site.support_url || '';
    const BETAS = [['email', 'Email updates', 'Gmail emails with a full drag-and-drop email builder, saved emails and automatic sending.'], ['support', 'Website support tickets', 'Automatic help chat that can escalate to a real ticket in the support server.'], ['builder', 'Custom commands and events', 'The block builder on every server dashboard.']];
    const beta = Object.assign({ email: 'off', support: 'off', builder: 'off' }, site.beta || {});
    const testers = h('textarea', { rows: 3, placeholder: 'Discord user IDs, one per line' }); testers.value = (site.testers || []).join('\n');
    const HOWTO = {
      builder: ['Off: nobody sees it.', 'Testing: only the user IDs in the box below see Custom commands and Events.', 'On: every server with Premium or higher sees it.', 'Where: open a server, then Commands (or Events) in the side menu.'],
      support: ['Off: the Support page does not exist.', 'Testing: only the testers see Support in the menu and on their profile.', 'On: everybody can open /support, chat with the helper and escalate to a real ticket.', 'You: this page gets a Support tab with every conversation, where you can read, reply, close and reopen.'],
      email: ['Off: nothing is shown.', 'Testing: only testers see the Email options on their profile.', 'On: everybody gets your emails unless they turn them off on their profile.', 'You: this page gets an Email tab to connect Gmail, design emails, send them or set them to go out automatically. Owners and people with no email on file are skipped.'],
    };
    const open = {};
    const betaBox = h('div', { class: 'beta-list' });
    const paintBeta = () => betaBox.replaceChildren(...BETAS.map(([k, name, d]) => h('div', { class: 'beta-row' },
      h('div', {}, h('b', {}, name, ' ', h('button', { type: 'button', class: 'info-btn', 'aria-label': 'How to use ' + name, 'aria-expanded': String(!!open[k]), onclick: () => { open[k] = !open[k]; paintBeta(); } }, 'i')), h('div', { class: 'muted small' }, d),
        open[k] ? h('ul', { class: 'howto' }, HOWTO[k].map((x) => h('li', {}, x))) : null),
      h('div', { class: 'seg', role: 'radiogroup', 'aria-label': name }, ['off', 'testing', 'on'].map((st) => h('button', { type: 'button', role: 'radio', 'aria-checked': String(beta[k] === st), onclick: () => { beta[k] = st; paintBeta(); } }, st[0].toUpperCase() + st.slice(1)))))));
    paintBeta();
    const save = async () => {
      status.textContent = 'Saving...';
      try {
        await api('/api/owner/site', { method: 'PUT', body: { theme, beta, testers: testers.value.split(/[\s,]+/).filter(Boolean), maint: { on: mOn.getAttribute('aria-checked') === 'true', title: mTitle.value, desc: mDesc.value }, support_url: support.value } });
        try { await fetch('/api/site', { cache: 'reload' }); } catch (e) { /* ignore */ }
        status.textContent = 'Saved. Visitors see this within about 15 seconds.';
        try { localStorage.setItem('rex-site-theme', theme); } catch (e) { /* ignore */ }
        status.textContent = 'Saved. Reloading...';
        setTimeout(() => location.reload(), 500);
      } catch (e) { status.textContent = e.message; }
    };
    return h('div', { class: 'stack' },
      h('div', { class: 'frame' }, h('h3', {}, 'Website theme'), h('p', { class: 'muted small' }, 'Changes the look for everyone, with no code change.'), cards),
      h('div', { class: 'slab' }, h('div', { style: 'display:flex;gap:14px;align-items:center' }, mOn, h('div', {}, h('b', {}, 'Maintenance mode'), h('div', { class: 'muted small' }, 'Covers the whole site with the logo, a title and a message. Owners can still log in at /owner.'))),
        h('div', { class: 'row-1', style: 'margin-top:14px' }, field('Title', mTitle), field('Message', mDesc))),
      h('div', { class: 'frame' }, h('h3', {}, 'Beta features'), h('p', { class: 'muted small' }, 'Off hides a feature. Testing shows it only to owners and the testers below. On shows it to everyone.'), betaBox,
        h('label', { class: 'lbl', style: 'margin-top:14px' }, 'Testers'), testers),
      h('div', { class: 'well' }, h('h3', {}, 'Support server link'), h('p', { class: 'muted small' }, 'Where every "Join our support server" button goes on the website. Leave empty for the default. To change the link in the bot, use the owner tools tab.'), support),
      h('div', {}, h('button', { class: 'btn', type: 'button', onclick: save }, 'Save website settings'), status));
  }

  /* ---- servers */
  async function serversTab() {
    const d = await api('/api/owner/servers');
    const q = h('input', { type: 'search', placeholder: 'Search servers', 'aria-label': 'Search servers' });
    const list = h('div', { class: 'ledger' });
    const draw = () => {
      const f = q.value.trim().toLowerCase();
      const rows = d.servers.filter((s) => !f || (s.name || '').toLowerCase().includes(f) || s.id.includes(f) || (s.owner || '').toLowerCase().includes(f));
      list.replaceChildren(...rows.map((s) => h('a', { class: 'tr-item', href: '/server?id=' + s.id },
        guildIcon({ name: s.name || '?', icon_url: s.icon_url }), h('div', { class: 'grow' }, h('b', {}, s.name || s.id), h('div', { class: 'muted small' }, fmtNum(s.members) + ' members  -  owner ' + (s.owner || 'unknown'))),
        s.blacklisted ? h('span', { class: 'badge bad' }, 'Blacklisted') : null, s.tier !== 'free' ? tierBadge(s.tier) : null)), rows.length ? null : h('p', { class: 'muted center' }, 'No servers match.'));
    };
    q.addEventListener('input', draw); draw();
    return h('div', { class: 'stack' }, h('div', { class: 'muted' }, d.servers.length + ' servers'), q, list);
  }

  /* ---- users */
  async function usersTab() {
    const d = await api('/api/owner/users');
    const q = h('input', { type: 'search', placeholder: 'Search by name, ID or email', 'aria-label': 'Search users' });
    const list = h('div', { class: 'ledger' }), detail = h('div', {});
    const draw = () => {
      const f = q.value.trim().toLowerCase();
      const rows = d.users.filter((u) => !f || (u.name || '').toLowerCase().includes(f) || (u.username || '').toLowerCase().includes(f) || u.id.includes(f) || (u.email || '').toLowerCase().includes(f)).slice(0, 100);
      list.replaceChildren(...rows.map((u) => h('button', { type: 'button', class: 'tr-item', onclick: () => open(u.id) },
        h('img', { class: 'av', src: u.avatar_url, alt: '', width: 36, height: 36 }), h('div', { class: 'grow' }, h('b', {}, u.name), h('div', { class: 'muted small' }, '@' + u.username + '  -  last login ' + timeAgo(u.last_login))), h('span', { class: 'muted small' }, u.servers + ' servers'))));
    };
    async function open(id) {
      detail.replaceChildren(h('div', { class: 'skel', style: 'height:140px' }));
      detail.scrollIntoView({ behavior: 'smooth', block: 'start' });
      try {
        const r = await api('/api/owner/user?id=' + encodeURIComponent(id));
        const u = r.user, p = r.profile;
        const msg = h('textarea', { maxlength: 1800, placeholder: 'Message to send as a DM from Rex' }), out = h('div', { class: 'result-box', hidden: true });
        detail.replaceChildren(h('div', { class: 'frame stack' },
          h('div', { style: 'display:flex;gap:14px;align-items:center' }, h('img', { class: 'av', src: u.avatar_url, alt: '', width: 56, height: 56 }), h('div', {}, h('h3', { style: 'margin:0' }, u.name), h('div', { class: 'muted small' }, '@' + u.username + '  -  ' + u.id))),
          h('table', { class: 'tbl' }, h('tbody', {},
            h('tr', {}, h('td', {}, 'Email'), h('td', {}, u.owner ? 'Hidden (Rex owner)' : u.email || 'Not shared')), h('tr', {}, h('td', {}, 'First seen'), h('td', {}, fmtDate(u.first_seen))),
            h('tr', {}, h('td', {}, 'Last login'), h('td', {}, timeAgo(u.last_login) + ' (' + u.logins + ' logins)')),
            h('tr', {}, h('td', {}, 'Website XP'), h('td', {}, p ? fmtNum(p.web_xp || 0) : 'Not loaded yet')),
            h('tr', {}, h('td', {}, 'Total XP'), h('td', {}, p ? fmtNum(p.servers.reduce((a, s) => a + s.xp, 0)) : 'Not loaded yet')))),
          h('div', {}, h('b', {}, 'Servers they can manage (' + r.managed.length + ')'), h('div', { class: 'chips', style: 'margin-top:8px' }, r.managed.map((g) => h('a', { class: 'chip', href: g.bot_present ? '/server?id=' + g.id : null, title: g.bot_present ? 'Open' : 'Rex is not in this server' }, g.name)))),
          h('div', {}, h('label', { class: 'lbl' }, 'Send a DM through Rex'), msg, h('div', { style: 'margin-top:10px' }, h('button', { class: 'btn', type: 'button', onclick: () => { if (msg.value.trim()) sendOp('dm', '', { uid: u.id, text: msg.value }, out); } }, 'Send DM')), out)));
      } catch (e) { detail.replaceChildren(h('p', { class: 'muted' }, e.message)); }
    }
    q.addEventListener('input', draw); draw();
    return h('div', { class: 'stack' }, h('div', { class: 'muted' }, (d.users.length === 1 ? '1 person has' : d.users.length + ' people have') + ' logged in'), q, detail, list);
  }

  /* ---- audit */
  async function auditTab() {
    const d = await api('/api/owner/audit');
    if (!d.items.length) return h('div', { class: 'well center' }, h('p', { class: 'muted', style: 'margin:0' }, 'Nothing has been recorded yet.'));
    return h('div', { class: 'ledger' }, d.items.map((a) => h('div', { class: 'tr-item' }, h('div', { class: 'grow' }, h('b', {}, a.summary), h('div', { class: 'muted small' }, a.by + '  -  ' + timeAgo(a.t))), h('span', { class: 'badge' }, a.op))));
  }

  /* ---- health */
  async function healthTab() {
    const d = await api('/api/admin/health'), s = d.stats || {};
    const ok = (v) => h('span', { class: 'badge ' + (v ? 'good' : 'bad') }, v ? 'OK' : 'Missing');
    return h('div', { class: 'stack' },
      h('div', { class: 'stat-row' },
        h('div', { class: 'stat' }, h('b', {}, d.online ? 'Online' : 'Offline'), h('span', {}, 'Bot')),
        h('div', { class: 'stat' }, h('b', {}, fmtNum(d.synced_guilds)), h('span', {}, 'Servers synced')),
        h('div', { class: 'stat' }, h('b', {}, fmtNum(d.pending_changes)), h('span', {}, 'Queued changes')),
        h('div', { class: 'stat' }, h('b', {}, s.latency_ms != null ? Math.round(s.latency_ms) + ' ms' : '-'), h('span', {}, 'Latency'))),
      h('div', { class: 'well' }, h('table', { class: 'tbl' }, h('tbody', {},
        h('tr', {}, h('td', {}, 'Discord login'), h('td', {}, ok(d.config.discord_login))), h('tr', {}, h('td', {}, 'Bot API key'), h('td', {}, ok(d.config.bot_api_key))),
        h('tr', {}, h('td', {}, 'Owner IDs'), h('td', {}, ok(d.config.owner_id))), h('tr', {}, h('td', {}, 'Settings schema synced'), h('td', {}, ok(d.schema_synced))),
        h('tr', {}, h('td', {}, 'Last heartbeat'), h('td', {}, s.ts ? timeAgo(s.ts) : 'Never')),
        h('tr', {}, h('td', {}, 'Tiers'), h('td', {}, Object.entries(d.tier_counts).map(([k, v]) => k + ': ' + v).join('   ')))))));
  }

  async function render() {
    pane.replaceChildren(h('div', { class: 'skel', style: 'height:160px' }));
    try {
      let node;
      if (tab === 'tools') node = toolsTab();
      else if (tab === 'website') node = websiteTab(await api('/api/owner/site'));
      else if (tab === 'servers') node = await serversTab();
      else if (tab === 'users') node = await usersTab();
      else if (tab === 'support') node = await supportTab();
      else if (tab === 'email') node = await emailTab();
      else if (tab === 'audit') node = await auditTab();
      else node = await healthTab();
      pane.replaceChildren(node);
    } catch (e) { pane.replaceChildren(h('p', { class: 'muted' }, e.message)); }
  }
  drawTabs(); render();
})();
