'use strict';
(async function () {
  const app = document.getElementById('app');
  const me = await mountNav('support');
  if (REX.blocked) return;
  const na = () => app.replaceChildren(stateScreen('Not available yet', 'This page isn\'t open to everyone yet.', h('a', { class: 'btn ghost', href: '/' }, 'Home')));
  // While in testing only owners and allowed testers can open this page (everyone else, logged in or not, just sees "not available").
  if (!me) { if (REX.site && REX.site.beta && REX.site.beta.support) return app.replaceChildren(stateScreen('Log in first', 'Support chat needs a Discord login so we know who to reply to.', h('a', { class: 'btn', href: '/auth/login' }, 'Log in with Discord'))); return na(); }
  if (!me.beta || !me.beta.support) return na();

  const md = (t) => { const f = document.createDocumentFragment(); String(t).split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/).forEach((p) => { if (/^\*\*.+\*\*$/.test(p)) f.append(h('b', {}, p.slice(2, -2))); else if (/^`.+`$/.test(p)) f.append(h('code', {}, p.slice(1, -1))); else if (/^\*[^*]+\*$/.test(p)) f.append(h('i', {}, p.slice(1, -1))); else f.append(p); }); return f; };
  const LOGO = '/img/rex-logo.png';
  const avatar = (m) => {
    if (m.f === 'u') return me.user.avatar_url ? h('img', { class: 'av', src: me.user.avatar_url, alt: '', referrerpolicy: 'no-referrer' }) : h('div', { class: 'av' }, (me.user.name || '?')[0].toUpperCase());
    if (m.f === 's') return h('div', { class: 'av staff' }, 'R');
    return h('img', { class: 'av rex', src: LOGO, alt: '' });
  };

  let types = {}, current = null, timer = null, max = 3;
  const root = h('div', { class: 'wrap sup' });
  app.replaceChildren(root);
  const pillClass = (c) => (c.status === 'closed' ? 'off' : 'on');

  async function home() {
    clearInterval(timer); current = null;
    let d;
    try { d = await api('/api/support'); } catch (e) { return root.replaceChildren(stateScreen('Could not load', e.message)); }
    types = d.types; max = d.max || 3;
    const icons = { help: '💬', bug: '🐛', premium: '💎', appeal: '🔨' };
    const full = d.convs.length >= max;
    root.replaceChildren(h('div', { class: 'page-head' }, h('h1', {}, 'Support'), h('p', { class: 'muted' }, 'Pick what you need. Rex will ask a few quick questions and answer what he can. If it needs a person, Rex opens a ticket for you.')),
      d.cooldown ? h('div', { class: 'notice' }, 'Support chat is paused for you for about ' + (d.cooldown > 5400 ? Math.ceil(d.cooldown / 3600) + ' hour(s)' : Math.ceil(d.cooldown / 60) + ' minute(s)') + '.') : null,
      full ? h('div', { class: 'notice' }, 'You have ' + max + ' chats. Close or delete one below before starting another.') : null,
      h('div', { class: 'sup-types' }, Object.entries(d.types).map(([k, name]) => h('button', { class: 'sup-type', type: 'button', disabled: !!d.cooldown || full, onclick: () => start(k) }, h('span', { class: 'ic' }, icons[k] || '💬'), h('b', {}, name)))),
      d.convs.length ? h('div', { class: 'frame' }, h('h3', {}, 'Your chats'), h('div', { class: 'sup-list' }, d.convs.map((c) => h('button', { type: 'button', class: 'sup-row', onclick: () => openConv(c.id) }, h('b', {}, d.types[c.type] || 'Help'), h('span', { class: 'pill ' + pillClass(c) }, c.label), h('small', { class: 'muted' }, timeAgo(c.updated)))))) : null);
  }
  async function start(type) { try { show(await api('/api/support/new', { method: 'POST', body: { type } })); } catch (e) { toast(e.message, 'bad'); } }
  async function openConv(id) { try { show(await api('/api/support/' + id)); } catch (e) { toast(e.message, 'bad'); } }

  function show(c) {
    current = c; clearInterval(timer);
    const log = h('div', { class: 'chat-log', 'aria-live': 'polite' });
    const input = h('textarea', { rows: 1, maxlength: 600, placeholder: 'Type a message...', 'aria-label': 'Message' });
    const send = h('button', { class: 'btn', type: 'button' }, 'Send');
    const status = h('div', { class: 'chat-status' });
    const chips = h('div', { class: 'chips' });
    const actions = h('div', { class: 'chat-actions' });
    const typing = h('div', { class: 'msg b typing', hidden: true }, h('img', { class: 'av rex', src: LOGO, alt: '' }), h('div', { class: 'bd' }, h('span', { class: 'dots' }, h('i'), h('i'), h('i'))));
    const row = (m) => {
      if (m.f === 'd') return h('div', { class: 'divider' }, h('span', {}, m.x));
      const tm = new Date(m.t * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return h('div', { class: 'msg ' + m.f }, avatar(m),
        h('div', { class: 'bd' }, h('div', { class: 'who' }, m.f === 'u' ? me.user.name : m.f === 's' ? 'Rex team' : 'Rex', h('small', {}, ' ' + tm)),
          h('div', { class: 'tx' }, md(m.x)), m.u ? h('a', { class: 'btn sm discord', href: m.u, target: '_blank', rel: 'noopener noreferrer', style: 'margin-top:8px' }, m.u.includes('/channels/') ? 'Open my ticket' : 'Join the Rex server') : null));
    };
    let shown = 0, busy = false;
    const paint = (full) => {
      const msgs = full.msgs || [];
      if (msgs.length < shown) { log.replaceChildren(); shown = 0; }
      typing.remove();
      msgs.slice(shown).forEach((m) => log.append(row(m)));
      if (msgs.length !== shown) log.scrollTop = log.scrollHeight;
      shown = msgs.length; current = full;
      const closed = full.status === 'closed', locked = full.locked;
      input.disabled = send.disabled = locked || busy;
      input.placeholder = closed ? 'This chat is closed, you can\'t send messages' : full.phase === 'opening' ? 'Rex is opening your ticket...' : locked ? 'Use the buttons above' : 'Type a message...';
      status.replaceChildren(h('span', { class: 'dot ' + (closed ? 'off' : 'on') }), full.label || (closed ? 'Closed' : 'Open'));
      chips.replaceChildren(...((!closed && full.chips) || []).map(([label, value]) => h('button', { type: 'button', class: 'chip', disabled: busy, onclick: () => submit('', value) }, label)));
      actions.replaceChildren(
        !closed ? h('button', { class: 'btn ghost sm', type: 'button', onclick: closeChat }, 'End chat') : null,
        closed ? h('button', { class: 'btn ghost sm', type: 'button', onclick: del }, 'Delete for me') : null,
        closed ? h('button', { class: 'btn ghost sm', type: 'button', onclick: home }, 'Back to chats') : null);
      if (full.phase === 'opening') schedule();
    };
    async function submit(text, choice) {
      if (busy) return;
      text = (text || '').trim(); if (!text && !choice) return;
      busy = true; send.disabled = input.disabled = true; chips.querySelectorAll('button').forEach((b) => { b.disabled = true; });
      if (!choice) input.value = '';
      // show their message at once, Rex "types" for a moment, then the reply arrives
      const label = choice ? ((current.chips.find((x) => x[1] === choice) || [])[0] || choice) : text;
      log.append(row({ f: 'u', t: Date.now() / 1000, x: label })); log.append(typing); typing.hidden = false; log.scrollTop = log.scrollHeight;
      try {
        const [full] = await Promise.all([api('/api/support/' + current.id + '/msg', { method: 'POST', body: choice ? { choice } : { text } }), new Promise((r) => setTimeout(r, 650))]);
        busy = false; shown = Math.max(0, shown); log.replaceChildren(); shown = 0; paint(full);
      } catch (e) { busy = false; toast(e.message, 'bad'); if (!choice) input.value = text; try { log.replaceChildren(); shown = 0; paint(await api('/api/support/' + current.id)); } catch (x) { /* ignore */ } }
      input.focus();
    }
    async function closeChat() { if (!(await rexDialog.confirm('End this chat?', 'You can\'t send more messages in it afterwards.', 'End chat'))) return; try { paint(await api('/api/support/' + current.id + '/close', { method: 'POST' })); } catch (e) { toast(e.message, 'bad'); } }
    async function del() { if (!(await rexDialog.confirm('Delete this chat?', 'It disappears from your list. The Rex team may still keep a copy for a while.', 'Delete', true))) return; try { await api('/api/support/' + current.id + '/delete', { method: 'POST' }); toast('Deleted', 'good'); home(); } catch (e) { toast(e.message, 'bad'); } }
    let polling = null;
    function schedule() { if (polling) return; polling = setTimeout(async () => { polling = null; if (!current) return; try { const f = await api('/api/support/' + current.id); if (f.msgs.length !== shown || f.phase !== current.phase) paint(f); else schedule(); } catch (e) { /* ignore */ } }, 2000); }
    send.onclick = () => submit(input.value);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(input.value); } });
    root.replaceChildren(h('div', { class: 'chat' }, h('div', { class: 'chat-head' }, h('button', { class: 'btn ghost sm', type: 'button', onclick: home }, '< Back'), h('img', { class: 'av rex sm', src: LOGO, alt: '' }), h('b', {}, 'Rex'), h('span', { class: 'muted small' }, types[c.type] || 'Support')), log, chips, status, h('div', { class: 'chat-in' }, input, send), actions));
    paint(c);
    timer = setInterval(async () => { if (document.hidden || !current || busy) return; try { const f = await api('/api/support/' + current.id); if (f.msgs.length !== shown || f.status !== current.status || f.label !== current.label || f.phase !== current.phase) { log.replaceChildren(); shown = 0; paint(f); } } catch (e) { /* ignore */ } }, 3000);
  }
  home();
})();
