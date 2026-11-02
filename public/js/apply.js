'use strict';
(async function () {
  const app = document.getElementById('app');
  const me = await mountNav('');
  if (REX.blocked) return;
  const parts = location.pathname.split('/').filter(Boolean); // apply, <gid>, <tid>  |  apply, results, <sid>
  const root = h('div', { class: 'wrap sup' });
  app.replaceChildren(root);
  if (!me) return root.replaceChildren(stateScreen('Sign in first', 'Applications need a Discord sign-in so the staff know who you are.', h('a', { class: 'btn', href: '/auth/login?next=' + encodeURIComponent(location.pathname) }, 'Log in with Discord')));

  if (parts[1] === 'results') {
    let r;
    try { r = await api('/api/apply/result/' + parts[2]); } catch (e) { return root.replaceChildren(stateScreen('Can\'t open this', e.message)); }
    document.title = 'Application - ' + r.name;
    return root.replaceChildren(
      h('div', { class: 'page-head' }, h('h1', {}, 'Application: ' + r.title), h('p', { class: 'muted' }, r.guild + ' · for ' + r.what + ' · ' + new Date(r.ts * 1000).toLocaleString())),
      h('div', { class: 'frame', style: 'display:flex;gap:12px;align-items:center;margin-bottom:14px' }, r.avatar_url ? h('img', { class: 'av', src: r.avatar_url, alt: '', referrerpolicy: 'no-referrer' }) : null, h('div', {}, h('b', {}, r.name), h('div', { class: 'muted small' }, 'Discord ID ' + r.uid))),
      ...r.rows.map((x) => h('div', { class: 'frame', style: 'margin-bottom:12px' }, h('b', {}, x.q), h('p', { style: 'white-space:pre-wrap;margin-top:8px' }, x.a || '(no answer)'))));
  }

  let f;
  try { f = await api('/api/apply/' + parts[1] + '/' + parts[2]); } catch (e) { return root.replaceChildren(stateScreen('Not available', e.message)); }
  document.title = f.title + ' - Rex';
  if (f.blocked) return root.replaceChildren(stateScreen('You can\'t apply right now', f.blocked));
  const inputs = f.questions.map((q) => {
    if (q.kind === 'long') return h('textarea', { rows: 5, maxlength: 4000, required: q.required ? true : null });
    if (q.kind === 'choice') return h('select', { required: q.required ? true : null }, h('option', { value: '' }, 'Choose one'), q.options.map((o) => h('option', { value: o }, o)));
    return h('input', { type: 'text', maxlength: 500, required: q.required ? true : null });
  });
  const btn = h('button', { class: 'btn', type: 'submit' }, 'Submit application');
  const form = h('form', { class: 'stack', novalidate: true, onsubmit: async (e) => {
    e.preventDefault();
    for (let i = 0; i < f.questions.length; i++) if (f.questions[i].required && !inputs[i].value.trim()) { toast('Please answer: ' + f.questions[i].q.slice(0, 60), 'bad'); inputs[i].focus(); return; }
    btn.disabled = true;
    try {
      await api('/api/apply/' + parts[1] + '/' + parts[2], { method: 'POST', body: { answers: inputs.map((x) => x.value) } });
      root.replaceChildren(stateScreen('Application sent', 'Thanks! The staff of ' + f.guild + ' will review it.'));
    } catch (er) { toast(er.message, 'bad'); btn.disabled = false; }
  } },
  ...f.questions.map((q, i) => h('label', { class: 'tt-f' }, h('span', {}, h('b', {}, (i + 1) + '. ' + q.q), q.required ? ' *' : h('small', { class: 'muted' }, ' (optional)')), inputs[i])), btn);
  root.replaceChildren(h('div', { class: 'page-head' }, h('h1', {}, f.title), h('p', { class: 'muted' }, 'Applying for ' + f.what + ' in ' + f.guild + ' as ' + me.user.name + '. Fields marked * are required.')), h('div', { class: 'frame' }, form));
})();
