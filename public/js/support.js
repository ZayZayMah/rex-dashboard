'use strict';
(async function () {
  const app = document.getElementById('app');
  const me = await mountNav('support');
  if (REX.blocked) return;
  if (!me) return app.replaceChildren(stateScreen('Log in first', 'Support chat needs a Discord login so we know who to reply to.', h('a', { class: 'btn', href: '/auth/login' }, 'Log in with Discord')));
  if (!me.beta || !me.beta.support) return app.replaceChildren(stateScreen('Not available yet', 'Website support chat is still being tested.', h('a', { class: 'btn ghost', href: '/' }, 'Home')));

  /* ---- the helper's brain: tiny fuzzy keyword matcher, runs in your browser */
  const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const lev = (a, b) => { if (Math.abs(a.length - b.length) > 2) return 3; const d = Array.from({ length: a.length + 1 }, (_, i) => [i]); for (let j = 1; j <= b.length; j++) d[0][j] = j; for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[a.length][b.length]; };
  const close = (w, k) => w === k || (w.length >= 4 && lev(w, k) <= (w.length >= 8 ? 2 : 1));
  const STOP = new Set(['the', 'a', 'an', 'to', 'my', 'i', 'is', 'it', 'how', 'do', 'can', 'what', 'and', 'of', 'in', 'on', 'me', 'you', 'for', 'with', 'this', 'that', 'are', 'does', 'not']);
  let KB = [];
  try { KB = (await (await fetch('/data/kb.json')).json()).items || []; } catch (e) { /* ignore */ }
  try { KB = KB.concat((await api('/api/support/kb')).items || []); } catch (e) { /* ignore */ }
  function answer(text) {
    const words = norm(text).split(' ').filter((w) => w && !STOP.has(w));
    if (!words.length) return null;
    let best = null, bestScore = 0;
    for (const it of KB) {
      let score = 0;
      for (const key of it.keys) {
        const kw = norm(key).split(' ').filter((w) => w && !STOP.has(w));
        if (!kw.length) continue;
        const hit = kw.filter((k) => words.some((w) => close(w, k))).length;
        const s = hit / kw.length * (kw.length > 1 ? 1.4 : 1) * (hit === kw.length ? 1.3 : 1);
        if (hit && s > score) score = s;
      }
      if (score > bestScore) { bestScore = score; best = it; }
    }
    return bestScore >= 0.9 ? best : null;
  }

  const md = (t) => { const f = document.createDocumentFragment(); String(t).split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/).forEach((p) => { if (/^\*\*.+\*\*$/.test(p)) f.append(h('b', {}, p.slice(2, -2))); else if (/^`.+`$/.test(p)) f.append(h('code', {}, p.slice(1, -1))); else if (/^\*[^*]+\*$/.test(p)) f.append(h('i', {}, p.slice(1, -1))); else f.append(p); }); return f; };

  let types = {}, current = null, timer = null, misses = 0;
  const root = h('div', { class: 'wrap sup' });
  app.replaceChildren(root);

  async function home() {
    clearInterval(timer); current = null;
    let d;
    try { d = await api('/api/support'); } catch (e) { return root.replaceChildren(stateScreen('Could not load', e.message)); }
    types = d.types;
    const icons = { help: '💬', bug: '🐛', premium: '💎', appeal: '🔨' };
    root.replaceChildren(h('div', { class: 'page-head' }, h('h1', {}, 'Support'), h('p', { class: 'muted' }, 'Ask our helper first. If it can\'t solve it, a real person will join this same chat.')),
      d.cooldown ? h('div', { class: 'notice' }, 'Support chat is paused for about ' + Math.ceil(d.cooldown / 60) + ' minute(s).') : null,
      h('div', { class: 'sup-types' }, Object.entries(d.types).map(([k, name]) => h('button', { class: 'sup-type', type: 'button', disabled: !!d.cooldown, onclick: () => start(k) }, h('span', { class: 'ic' }, icons[k] || '💬'), h('b', {}, name)))),
      d.convs.length ? h('div', { class: 'frame' }, h('h3', {}, 'Your chats'), h('div', { class: 'sup-list' }, d.convs.map((c) => h('button', { type: 'button', class: 'sup-row', onclick: () => openConv(c.id) }, h('b', {}, d.types[c.type] || 'Help'), h('span', { class: 'pill ' + (c.status === 'closed' ? 'off' : c.status === 'open' ? 'on' : 'mid') }, c.status === 'bot' ? 'Helper' : c.status === 'open' ? 'With the team' : 'Closed'), h('small', { class: 'muted' }, timeAgo(c.updated)))))) : null);
  }
  async function start(type) { try { const c = await api('/api/support/new', { method: 'POST', body: { type } }); misses = 0; show(c); } catch (e) { toast(e.message, 'bad'); } }
  async function openConv(id) { try { show(await api('/api/support/' + id)); } catch (e) { toast(e.message, 'bad'); } }

  function show(c) {
    current = c; clearInterval(timer);
    const log = h('div', { class: 'chat-log', 'aria-live': 'polite' });
    const input = h('textarea', { rows: 1, maxlength: 600, placeholder: 'Type a message...', 'aria-label': 'Message' });
    const send = h('button', { class: 'btn', type: 'button' }, 'Send');
    const status = h('div', { class: 'chat-status muted small' });
    const actions = h('div', { class: 'chat-actions' });
    const bubble = (m) => h('div', { class: 'msg ' + m.f }, h('div', { class: 'av' }, m.f === 'u' ? (me.user.name || '?')[0].toUpperCase() : m.f === 's' ? 'R' : '🦖'),
      h('div', { class: 'bd' }, h('div', { class: 'who' }, m.f === 'u' ? me.user.name : m.f === 's' ? 'Rex team' : 'Rex helper', h('small', {}, ' ' + new Date(m.t * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))), h('div', { class: 'tx' }, md(m.x))));
    let shown = 0;
    const paint = (full) => {
      const msgs = full.msgs || [];
      if (msgs.length < shown) { log.replaceChildren(); shown = 0; }
      msgs.slice(shown).forEach((m) => log.append(bubble(m)));
      if (msgs.length !== shown) log.scrollTop = log.scrollHeight;
      shown = msgs.length; current = full;
      const closed = full.status === 'closed', human = full.status === 'open';
      input.disabled = send.disabled = closed;
      input.placeholder = closed ? 'This chat is closed' : 'Type a message...';
      status.textContent = closed ? (full.reason === 'language' ? 'Closed because of language.' : 'Closed.') : human ? 'A team member has been asked to join. Replies show up here.' : 'You are chatting with the Rex helper.';
      actions.replaceChildren(
        full.status === 'bot' ? h('button', { class: 'btn ghost sm', type: 'button', onclick: escalate }, 'Talk to a person') : null,
        full.url && false ? null : null,
        !closed ? h('button', { class: 'btn ghost sm', type: 'button', onclick: closeChat }, 'End chat') : h('button', { class: 'btn ghost sm', type: 'button', onclick: () => start(full.type) }, 'Start a new chat'));
    };
    async function submit() {
      const text = input.value.trim(); if (!text || send.disabled) return;
      input.value = ''; send.disabled = true;
      let bot = '';
      if (current.status === 'bot') {
        const hit = answer(text);
        if (hit) { bot = hit.answer + '\n\nDid that help?'; misses = 0; }
        else { misses++; bot = misses >= 2 ? 'I\'m still not sure. Press **Talk to a person** below and someone from the team will pick this up.' : 'Hmm, I don\'t have an answer for that yet. Could you say it another way, or give me a few more details?'; }
      }
      try {
        // show your own message straight away, the helper "types" for a moment
        const full = await api('/api/support/' + current.id + '/msg', { method: 'POST', body: { text } });
        paint(full);
        if (bot && full.status === 'bot' && full.msgs[full.msgs.length - 1].f === 'u') {
          status.textContent = 'Rex helper is typing...';
          await new Promise((r) => setTimeout(r, 700 + Math.min(900, bot.length * 6)));
          paint(await api('/api/support/' + current.id + '/msg', { method: 'POST', body: { text: '', bot } }).catch(() => full));
        }
      } catch (e) { toast(e.message, 'bad'); input.value = text; }
      send.disabled = current.status === 'closed'; input.focus();
    }
    async function escalate() { try { paint(await api('/api/support/' + current.id + '/escalate', { method: 'POST' })); } catch (e) { toast(e.message, 'bad'); } }
    async function closeChat() { if (!(await rexDialog.confirm('End this chat?', 'You can start a new one any time.', 'End chat'))) return; try { paint(await api('/api/support/' + current.id + '/close', { method: 'POST' })); } catch (e) { toast(e.message, 'bad'); } }
    send.onclick = submit;
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } });
    root.replaceChildren(h('div', { class: 'chat' }, h('div', { class: 'chat-head' }, h('button', { class: 'btn ghost sm', type: 'button', onclick: home }, '< Back'), h('b', {}, types[c.type] || 'Support')), log, status, h('div', { class: 'chat-in' }, input, send), actions));
    paint(c);
    timer = setInterval(async () => { if (document.hidden || !current) return; try { const f = await api('/api/support/' + current.id); if (f.msgs.length !== shown || f.status !== current.status) paint(f); } catch (e) { /* ignore */ } }, 3000);
  }
  home();
})();
