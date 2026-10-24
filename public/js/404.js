'use strict';
(async function () {
  await mountNav('');
  if (REX.blocked) return;
  document.getElementById('app').replaceChildren(stateScreen('That page does not exist', 'The link may be old or mistyped.', h('a', { class: 'btn', href: '/' }, 'Go home')));
})();
