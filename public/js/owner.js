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

  const TABS = [['tools', 'Tools'], ['website', 'Website'], ['servers', 'Servers'], ['users', 'Users'], ['audit', 'Audit'], ['health', 'Health']];
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

  /* ---- tools */
  function toolsTab() {
    const tier = h('select', {}, ['premium', 'priority', 'ultra'].map((t) => h('option', { value: t }, TIER_LABEL[t])));
    const dur = h('select', {}, ['1 day', '7 days', '30 days', '90 days', '1 year', 'lifetime'].map((d) => h('option', { value: d }, d)));
    dur.value = '30 days';
    const lim = h('input', { type: 'number', min: 1, max: 1000, value: 1 });
    const out1 = h('div', { class: 'result-box', hidden: true });
    const action = h('input', { type: 'text', placeholder: 'status-list', maxlength: 40 }), target = h('input', { type: 'text', maxlength: 500 }), value = h('input', { type: 'text', maxlength: 500 }), reason = h('input', { type: 'text', maxlength: 500 });
    const out2 = h('div', { class: 'result-box', hidden: true });
    const quick = ['help', 'status-list', 'status-reset', 'update-clear'];
    return h('div', { class: 'stack' },
      h('div', { class: 'frame' }, h('h3', {}, 'Generate a code'), h('p', { class: 'muted small' }, 'Works the same as the premium code command. The code appears here once Rex has made it.'),
        h('div', { class: 'row-3' }, field('Tier', tier), field('Length', dur), field('Uses', lim)),
        h('div', { style: 'margin-top:14px' }, h('button', { class: 'btn', type: 'button', onclick: () => sendOp('gen_code', '', { tier: tier.value, duration: dur.value, limit: parseInt(lim.value, 10) || 1 }, out1) }, 'Generate')), out1),
      h('div', { class: 'well' }, h('h3', {}, 'Owner tools'), h('p', { class: 'muted small' }, 'The same form as the owner tools command in Discord. Type "help" as the action to see what is available (status rotation, support link, update log, rules).'),
        h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px' }, quick.map((q) => h('button', { class: 'btn ghost sm', type: 'button', onclick: () => { action.value = q; } }, q))),
        h('div', { class: 'row-2' }, field('Action', action), field('Target', target), field('Value', value), field('Reason / extra', reason)),
        h('div', { style: 'margin-top:14px' }, h('button', { class: 'btn', type: 'button', onclick: () => sendOp('owner_tool', '', { action: action.value, target: target.value, value: value.value, reason: reason.value }, out2) }, 'Run')), out2));
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
    const BETAS = [['email', 'Email updates', 'Gmail emails with tags, unsubscribe and an email builder.'], ['support', 'Website support tickets', 'Automatic help chat that can escalate to a real ticket in the support server.'], ['builder', 'Custom commands and events', 'The block builder on every server dashboard.']];
    const beta = Object.assign({ email: 'off', support: 'off', builder: 'off' }, site.beta || {});
    const testers = h('textarea', { rows: 3, placeholder: 'Discord user IDs, one per line' }); testers.value = (site.testers || []).join('\n');
    const betaBox = h('div', { class: 'beta-list' });
    const paintBeta = () => betaBox.replaceChildren(...BETAS.map(([k, name, d]) => h('div', { class: 'beta-row' },
      h('div', {}, h('b', {}, name), h('div', { class: 'muted small' }, d)),
      h('div', { class: 'seg', role: 'radiogroup', 'aria-label': name }, ['off', 'testing', 'on'].map((st) => h('button', { type: 'button', role: 'radio', 'aria-checked': String(beta[k] === st), onclick: () => { beta[k] = st; paintBeta(); } }, st[0].toUpperCase() + st.slice(1)))))));
    paintBeta();
    const save = async () => {
      status.textContent = 'Saving...';
      try {
        await api('/api/owner/site', { method: 'PUT', body: { theme, beta, testers: testers.value.split(/[\s,]+/).filter(Boolean), maint: { on: mOn.getAttribute('aria-checked') === 'true', title: mTitle.value, desc: mDesc.value }, support_url: support.value } });
        try { await fetch('/api/site', { cache: 'reload' }); } catch (e) { /* ignore */ }
        status.textContent = 'Saved. Visitors see this within about 15 seconds.';
        try { localStorage.setItem('rex-site-theme', theme); } catch (e) { /* ignore */ }
        if (window.rexApplyTheme) window.rexApplyTheme(theme);
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
    return h('div', { class: 'stack' }, h('div', { class: 'muted' }, d.users.length + ' people have logged in'), q, detail, list);
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
      else if (tab === 'audit') node = await auditTab();
      else node = await healthTab();
      pane.replaceChildren(node);
    } catch (e) { pane.replaceChildren(h('p', { class: 'muted' }, e.message)); }
  }
  drawTabs(); render();
})();
