'use strict';
/* Shared pieces for the email generators: the Follow Up section toggles, the announcement form and the calls that build designs.
   Used by the Inbox tab (owner.js) and the email builder (emailbuilder.js). Needs h(), api() and toast() from app.js. */
window.MailGen = (function () {
  let cache = null;
  async function meta() {
    if (!cache) cache = (await api('/api/owner/email/meta')).gen;
    return cache;
  }
  const build = (payload) => api('/api/owner/email/gen', { method: 'POST', body: payload });

  function rocker(on, onchange) {
    const b = h('button', { type: 'button', class: 'rocker', role: 'switch', 'aria-checked': String(!!on) });
    b.addEventListener('click', () => { const v = b.getAttribute('aria-checked') !== 'true'; b.setAttribute('aria-checked', String(v)); onchange(v); });
    return b;
  }

  /* Follow Up: one row per section with a switch. Switched-on sections show their text so it can be edited. */
  function followupForm(gen, onChange) {
    const state = gen.followup.map((s) => ({ key: s.key, on: s.on, text: s.text, title: s.title, label: s.label }));
    const rows = state.map((s) => {
      const ta = h('textarea', { rows: s.key === 'quote' ? 2 : 3, maxlength: 3000, value: s.text, hidden: !s.on || s.key === 'quote', oninput: (e) => { s.text = e.target.value; onChange(); } });
      ta.value = s.text;
      const note = s.key === 'quote' ? h('p', { class: 'muted small', hidden: !s.on }, 'Their latest message is quoted for you automatically.') : null;
      const sw = rocker(s.on, (v) => { s.on = v; ta.hidden = !v || s.key === 'quote'; if (note) note.hidden = !v; row.classList.toggle('on', v); onChange(); });
      const row = h('div', { class: 'fu-row' + (s.on ? ' on' : '') }, h('div', { class: 'fu-top' }, sw, h('b', {}, s.label), s.title ? h('span', { class: 'muted small' }, '“' + s.title + '”') : null), ta, note);
      return row;
    });
    return { el: h('div', { class: 'fu-list' }, rows), sections: () => state.map((s) => ({ key: s.key, on: s.on, text: s.text, title: s.title })) };
  }

  /* Announcement form: any number of announcements, none of the fields are required. */
  function announceForm(onChange) {
    const items = [];
    const box = h('div', { class: 'ann-list' });
    function add(initial) {
      const it = Object.assign({ title: '', brief: '', long: '', image: '', link: '', link_label: '' }, initial || {});
      const inp = (k, label, ph, tag, max) => {
        const el = h(tag || 'input', { type: tag ? null : 'text', maxlength: max || 200, placeholder: ph || '', rows: tag ? 3 : null, oninput: (e) => { it[k] = e.target.value; onChange(); } });
        el.value = it[k];
        return h('label', { class: 'eb-f' }, h('span', {}, label), el);
      };
      const card = h('div', { class: 'well ann-card' },
        h('div', { class: 'fu-top' }, h('b', {}, 'Announcement ' + (items.length + 1)), h('span', { class: 'grow' }),
          h('button', { type: 'button', class: 'btn ghost sm', onclick: () => { const i = items.indexOf(it); items.splice(i, 1); card.remove(); renumber(); onChange(); } }, 'Remove')),
        inp('title', 'Title', 'e.g. Applications are here', null, 90), inp('brief', 'Brief description', 'One line that sums it up', null, 260),
        inp('long', 'Long description', 'The full details (optional)', 'textarea', 1400), inp('image', 'Image link', 'https://… (optional)', null, 480),
        h('div', { class: 'row-2' }, inp('link', '“Read more” link', 'https://… (optional)', null, 480), inp('link_label', 'Link wording', 'Read more', null, 30)));
      items.push(it); box.append(card); onChange();
    }
    const renumber = () => [...box.children].forEach((c, i) => { c.querySelector('b').textContent = 'Announcement ' + (i + 1); });
    add();
    return { el: h('div', {}, box, h('button', { type: 'button', class: 'btn ghost sm', style: 'margin-top:8px', onclick: () => { if (items.length >= 12) return toast('That is the most one email can hold.', 'bad'); add(); } }, '+ Add another announcement')), items: () => items.map((x) => Object.assign({}, x)) };
  }

  return { meta, build, followupForm, announceForm, rocker };
})();
