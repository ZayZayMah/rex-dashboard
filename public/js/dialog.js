'use strict';
/* In-site replacements for the browser's confirm()/alert() pop-ups ("rex.example is asking...") */
window.rexDialog = (function () {
  let host;
  function mount() { if (!host) { host = document.createElement('div'); host.className = 'dlg-host'; document.body.append(host); } return host; }
  function open({ title, body, ok = 'OK', cancel = 'Cancel', danger = false, input = null }) {
    return new Promise((resolve) => {
      const prev = document.activeElement;
      const field = input ? h('input', { type: 'text', class: 'dlg-in', placeholder: input.placeholder || '', value: input.value || '', maxlength: input.maxlength || 200 }) : null;
      const done = (v) => { back.remove(); document.removeEventListener('keydown', key, true); try { prev && prev.focus(); } catch (e) { /* ignore */ } resolve(v); };
      const okBtn = h('button', { type: 'button', class: 'btn' + (danger ? ' danger' : ''), onclick: () => done(input ? field.value : true) }, ok);
      const back = h('div', { class: 'dlg-back', onclick: (e) => { if (e.target === back) done(input ? null : false); } },
        h('div', { class: 'dlg', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
          h('h3', {}, title), body ? (typeof body === 'string' ? h('p', { class: 'muted' }, body) : body) : null, field,
          h('div', { class: 'dlg-actions' }, cancel ? h('button', { type: 'button', class: 'btn ghost', onclick: () => done(input ? null : false) }, cancel) : null, okBtn)));
      const key = (e) => { if (e.key === 'Escape') { e.stopPropagation(); done(input ? null : false); } else if (e.key === 'Enter' && !(e.target && e.target.tagName === 'BUTTON')) { e.preventDefault(); okBtn.click(); } };
      document.addEventListener('keydown', key, true);
      mount().append(back);
      (field || okBtn).focus();
    });
  }
  return {
    confirm: (title, body, ok, danger) => open({ title, body, ok: ok || 'Confirm', danger: !!danger }),
    alert: (title, body) => open({ title, body, ok: 'Got it', cancel: null }),
    prompt: (title, body, opts) => open(Object.assign({ title, body, ok: 'Save', input: {} }, opts || {})),
  };
}());

/* ---- site-styled drop-downs: every plain <select> gets a themed menu instead of the browser's own list */
(function () {
  let openMenu = null;
  const closeAll = () => { if (openMenu) { openMenu.remove(); openMenu = null; } };
  document.addEventListener('mousedown', (e) => { if (openMenu && !openMenu.contains(e.target) && !(e.target.closest && e.target.closest('.sel-btn'))) closeAll(); });
  window.addEventListener('scroll', closeAll, true); window.addEventListener('resize', closeAll);
  function enhance(sel) {
    if (sel.dataset.enhanced || sel.hasAttribute('data-native') || sel.multiple || sel.size > 1) return;
    sel.dataset.enhanced = '1';
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'sel-btn'; btn.setAttribute('aria-haspopup', 'listbox');
    const label = () => { const o = sel.options[sel.selectedIndex]; btn.textContent = o ? o.textContent : ''; btn.disabled = sel.disabled; };
    label();
    sel.style.display = 'none';
    sel.after(btn);
    sel.addEventListener('change', label);
    new MutationObserver(label).observe(sel, { childList: true, subtree: true, attributes: true });
    // programmatic value changes don't fire 'change', so re-read when the button is shown/used
    btn.addEventListener('focus', label);
    function open() {
      closeAll(); label();
      const r = btn.getBoundingClientRect();
      const list = document.createElement('div'); list.className = 'sel-list'; list.setAttribute('role', 'listbox');
      [...sel.options].forEach((o, i) => {
        const it = document.createElement('button'); it.type = 'button'; it.className = 'sel-item' + (i === sel.selectedIndex ? ' on' : ''); it.textContent = o.textContent; it.disabled = o.disabled;
        it.setAttribute('role', 'option');
        it.addEventListener('click', () => { sel.selectedIndex = i; sel.dispatchEvent(new Event('input', { bubbles: true })); sel.dispatchEvent(new Event('change', { bubbles: true })); closeAll(); btn.focus(); });
        list.append(it);
      });
      list.style.minWidth = r.width + 'px'; list.style.left = Math.min(r.left, innerWidth - 8 - Math.max(r.width, 200)) + 'px';
      document.body.append(list); openMenu = list;
      const below = innerHeight - r.bottom, h = Math.min(list.scrollHeight, 280);
      list.style.maxHeight = '280px';
      list.style.top = (below > h + 12 ? r.bottom + 6 : Math.max(8, r.top - h - 6)) + 'px';
      const on = list.querySelector('.on'); if (on) on.scrollIntoView({ block: 'nearest' });
    }
    btn.addEventListener('click', () => (openMenu ? closeAll() : open()));
    btn.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAll(); else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const n = Math.max(0, Math.min(sel.options.length - 1, sel.selectedIndex + (e.key === 'ArrowDown' ? 1 : -1))); sel.selectedIndex = n; sel.dispatchEvent(new Event('change', { bubbles: true })); label(); } });
  }
  const scan = (root) => (root.querySelectorAll ? root : document).querySelectorAll('select').forEach(enhance);
  new MutationObserver((muts) => { muts.forEach((m) => m.addedNodes.forEach((n) => { if (n.nodeType === 1) { if (n.tagName === 'SELECT') enhance(n); else scan(n); } })); }).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', () => scan(document));
  scan(document);
}());
