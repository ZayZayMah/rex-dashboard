'use strict';
(async function () {
  const app = document.getElementById('app');
  await mountNav('about');
  if (REX.blocked) return;
  const inviteUrl = (REX.site && REX.site.invite_url) || '/dashboard';
  const go = (href, title, text, cls) => h('a', { class: cls, href, style: 'display:block;color:inherit' }, h('h3', {}, title), h('p', { class: 'muted', style: 'margin:0' }, text));

  app.replaceChildren(
    subnav('about'),
    h('div', { class: 'page-head' }, h('h1', {}, 'About Rex'),
      h('p', {}, 'Rex is a Discord bot that handles moderation, support tickets, levels, games and security, and comes with a website where you manage everything.')),
    h('div', { class: 'narrow stack' },
      h('section', { class: 'slab' },
        h('h2', {}, 'Get started in three steps'),
        h('ol', { class: 'steps' },
          h('li', {}, h('div', {}, h('b', {}, 'Add Rex'), h('p', { class: 'muted', style: 'margin:0' }, 'Use the invite link and choose the server. You need Manage Server there.'))),
          h('li', {}, h('div', {}, h('b', {}, 'Log in with Discord'), h('p', { class: 'muted', style: 'margin:0' }, 'The dashboard lists the servers you can manage and checks your permissions on every change.'))),
          h('li', {}, h('div', {}, h('b', {}, 'Set it up'), h('p', { class: 'muted', style: 'margin:0' }, 'Pick a section, change what you need and save. Rex applies it within seconds.'))))),
      h('div', { class: 'cta', style: 'justify-content:center' },
        h('a', { class: 'btn lg', href: inviteUrl, target: inviteUrl.startsWith('http') ? '_blank' : null, rel: 'noopener noreferrer' }, 'Add Rex'),
        h('a', { class: 'btn ghost lg', href: '/dashboard' }, 'Open the dashboard')),
      h('section', { class: 'frame' },
        h('h2', {}, 'You stay in control'),
        h('p', { class: 'muted' }, 'Every change is checked by the bot itself. The activity log shows what changed, who changed it and what it was before, and the server owner can undo a single change or everything one person changed.')),
      h('h2', { class: 'center', style: 'margin-top:36px' }, 'Keep exploring'),
      h('div', { class: 'about-grid', style: 'grid-template-columns:repeat(3,1fr)' },
        go('/commands', 'Commands', 'Every command with usage and options.', 'plate'),
        go('/premium', 'Premium', 'Free, Premium, Priority and Ultra compared.', 'slab'),
        go('/live', 'Live stats', 'Status, latency and growth, live.', 'frame'))));
})();
