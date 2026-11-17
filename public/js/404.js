'use strict';
(async function () {
  /* /<owner id>/owner-tools is a private door for the Rex owners. It works even when the site is in maintenance mode. */
  const gate = location.pathname.match(/^\/(\d{15,25})\/owner-tools\/?$/);
  if (gate) {
    document.title = 'Owner tools - Rex';
    const uid = gate[1];
    const app = document.getElementById('app');
    document.getElementById('nav')?.remove(); document.getElementById('footer')?.remove();
    const code = h('input', { type: 'password', autocomplete: 'current-password', placeholder: 'Owner code', 'aria-label': 'Owner code', maxlength: 200 });
    const msg = h('div', { class: 'gate-msg', role: 'alert' });
    const go = h('button', { class: 'btn lg', type: 'submit' }, 'Unlock owner tools');
    const form = h('form', { class: 'gate-card', autocomplete: 'off' },
      h('span', { class: 'mark', 'aria-hidden': 'true' }), h('h1', {}, 'Owner tools'),
      h('p', { class: 'muted' }, 'Enter the owner code you created from the bot\'s direct message.'), code, go, msg);
    form.addEventListener('submit', async (e) => {
      e.preventDefault(); if (!code.value) return;
      go.disabled = true; msg.textContent = '';
      try {
        const res = await fetch('/api/ownergate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ uid, code: code.value }) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || 'That did not work.');
        location.href = '/owner';
      } catch (err) { msg.textContent = err.message; code.value = ''; code.focus(); } finally { go.disabled = false; }
    });
    app.replaceChildren(h('div', { class: 'gate' }, form));
    code.focus();
    return;
  }
  await mountNav('');
  if (REX.blocked) return;
  document.getElementById('app').replaceChildren(stateScreen('That page does not exist', 'The link may be old or mistyped.', h('a', { class: 'btn', href: '/' }, 'Go home')));
})();
