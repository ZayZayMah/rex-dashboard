'use strict';
(async function () {
  const app = document.getElementById('app');
  await mountNav('about');
  if (REX.blocked) return;
  const log = h('div', { class: 'ai-log', role: 'log', 'aria-live': 'polite' });
  const input = h('textarea', { class: 'ai-in', rows: 2, maxlength: 1500, placeholder: 'Ask anything. Paste a link and I will read it. Ask for "the latest ..." and I will search.' });
  const send = h('button', { type: 'button', class: 'btn' }, 'Send');
  const meter = h('div', { class: 'ai-meter muted small' }, 'Checking how much free AI is left today…');
  const history = [];
  let busy = false;

  const bubble = (who, text, cls) => { const b = h('div', { class: 'ai-msg ' + who + (cls ? ' ' + cls : '') }, h('b', {}, who === 'me' ? 'You' : 'Rex'), h('div', { class: 'ai-t' }, text)); log.append(b); log.scrollTop = log.scrollHeight; return b; };
  async function refreshMeter() {
    try {
      const u = await api('/api/ai/usage');
      if (!u.ready) { meter.textContent = 'The AI is not switched on yet. The site owner needs to enable Workers AI.'; return; }
      const left = Math.max(0, Math.round((1 - u.used / 0.97) * 100));
      meter.textContent = 'Free AI left today for everyone: about ' + left + '%. Resets in ' + Math.floor(u.resets_in / 3600) + 'h ' + Math.floor(u.resets_in % 3600 / 60) + 'm.';
    } catch (e) { meter.textContent = ''; }
  }
  async function ask() {
    const q = input.value.trim();
    if (!q || busy) return;
    busy = true; send.disabled = true; input.value = '';
    bubble('me', q);
    const wait = bubble('rex', 'Thinking…', 'wait');
    try {
      const r = await api('/api/ai/chat', { method: 'POST', body: { question: q, history: history.slice(-6) } });
      wait.remove();
      if (r.ok) {
        const b = bubble('rex', r.text);
        if (r.searched || (r.sources && r.sources.length)) b.append(h('div', { class: 'small muted' }, 'Sources: ' + (r.sources || []).join(' · ')));
        (r.notes || []).forEach((n) => b.append(h('div', { class: 'small muted' }, n)));
        history.push({ role: 'user', text: q }, { role: 'assistant', text: r.text });
      } else bubble('rex', r.message || 'Something went wrong.', 'err');
    } catch (e) { wait.remove(); bubble('rex', e.message, 'err'); }
    busy = false; send.disabled = false; input.focus(); refreshMeter();
  }
  send.addEventListener('click', ask);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(); } });

  const body = REX.me && REX.me.user
    ? h('div', { class: 'ai-box' }, log, h('div', { class: 'ai-row' }, input, send), meter)
    : h('div', { class: 'slab center' }, h('p', {}, 'Log in with Discord to chat with Rex.'), h('a', { class: 'btn lg', href: '/auth/login' }, 'Log in'));
  app.replaceChildren(subnav('ai'),
    h('div', { class: 'page-head' }, h('h1', {}, 'Ask Rex'), h('p', {}, 'A real AI that runs free on Cloudflare. It can read links, search the web and answer questions. In Discord, mention @Rex or use /ask to also send pictures and voice messages.')),
    h('div', { class: 'narrow stack' }, body,
      h('p', { class: 'muted small' }, 'Rex AI is a small free model, so it can be wrong. Do not paste passwords or private information. Chats here are not saved.')));
  if (REX.me && REX.me.user) { bubble('rex', 'Hi! What do you want to know?'); refreshMeter(); input.focus(); }
})();
