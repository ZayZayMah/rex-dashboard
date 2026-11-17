'use strict';
/* Email preferences: /<discord id>/email or /<email>/email, opened from the link in a Rex email (the link carries a private token). */
(async function () {
  const app = document.getElementById('app');
  await mountNav('emailprefs');
  if (REX.blocked) return;
  const seg = location.pathname.split('/').filter(Boolean);
  const key = decodeURIComponent(seg[0] || '');
  const tok = new URLSearchParams(location.search).get('t') || '';
  const url = '/api/emailprefs?k=' + encodeURIComponent(key) + (tok ? '&t=' + encodeURIComponent(tok) : '');
  let data;
  try { data = await api(url); } catch (e) {
    return app.replaceChildren(stateScreen('This link did not work', e.message, h('a', { class: 'btn', href: '/' }, 'Go to Rex')));
  }
  const status = h('div', { class: 'hint', role: 'status' });
  const list = h('div', { class: 'stack' });
  async function save(body) {
    try { data = await api(url, { method: 'PUT', body }); status.textContent = 'Saved.'; paint(); } catch (e) { status.textContent = e.message; toast(e.message, 'bad'); }
  }
  const row = (name, desc, on, set) => {
    const sw = h('button', { type: 'button', class: 'rocker', role: 'switch', 'aria-checked': String(!!on), 'aria-label': name });
    sw.addEventListener('click', () => set(sw.getAttribute('aria-checked') !== 'true'));
    return h('div', { class: 'well pref-row' }, h('div', {}, h('b', {}, name), h('div', { class: 'muted small' }, desc)), sw);
  };
  function paint() {
    list.replaceChildren(
      data.all ? null : h('div', { class: 'well' }, h('b', {}, 'You are unsubscribed from Rex emails.'), h('div', { class: 'muted small' }, 'Turn any kind on below to start getting those again.')),
      ...data.tags.map((t) => row(t.name, t.desc || '', data.all && t.on, (on) => save({ tags: { [t.id]: on } }))),
      row('Important notices', 'Account and security messages, like a server being banned. Recommended.', data.push && data.all, (on) => save({ push: on, all: on ? true : data.all })),
      data.all ? h('button', { class: 'btn ghost', type: 'button', onclick: () => save({ all: false }) }, 'Unsubscribe from everything') : null);
  }
  paint();
  app.replaceChildren(h('div', { class: 'wrap narrow' }, h('div', { class: 'page-head' }, h('h1', {}, 'Email preferences'),
    h('p', { class: 'muted' }, (data.name ? 'Hi ' + data.name + '. ' : '') + 'Pick the kinds of email you want from Rex. Sent to ' + (data.email || 'your address') + '.')), list, status));
})();
