'use strict';
/* Command catalog: live list from the bot (/api/commands), falling back to the bundled baseline,
   merged with hand-written guides (/data/guides.json). Owner-only commands are never listed. */

const CATEGORIES = [
  { id: 'moderation', name: 'Moderation', blurb: 'Bans, timeouts, warnings, cases, lockdowns and clean-up.' },
  { id: 'security', name: 'Security', blurb: 'Anti-raid, anti-nuke, join gates and verification.' },
  { id: 'tickets', name: 'Tickets & appeals', blurb: 'Support tickets, categories, forms and ban appeals.' },
  { id: 'staff', name: 'Staff tools', blurb: 'Shifts, tasks, applications and staff management.' },
  { id: 'community', name: 'Community', blurb: 'Events, birthdays, starboard, polls, giveaways and analytics.' },
  { id: 'levels', name: 'Levels & economy', blurb: 'XP, level cards, leaderboards, coins and daily rewards.' },
  { id: 'games', name: 'Games & fun', blurb: 'Mini-games and light-hearted commands.' },
  { id: 'setup', name: 'Setup & messages', blurb: 'Settings, announcements and ready-made server messages.' },
  { id: 'utility', name: 'Utility', blurb: 'Info commands, reminders, premium and handy tools.' },
];

const MOD = new Set(['ban', 'unban', 'kick', 'timeout', 'un timeout', 'masstimeout', 'warn', 'warns', 'clearwarns', 'case', 'history', 'notes', 'staffnote', 'purge', 'clear', 'slowmode', 'lock', 'unlock', 'lockdown', 'unlockdown', 'quarantine', 'role', 'temprole', 'report', 'dm']);
const SETUP = new Set(['settings', 'announce', 'announcement', 'say', 'rulesmsg', 'supportmsg', 'boostmsg', 'channels', 'permissions', 'roles', 'counting']);
const LEVELS = new Set(['level', 'levels', 'xp', 'leaderboard', 'balance', 'daily', 'profile']);
const GAMES = new Set(['games', 'rps', 'choose']);
const COMMUNITY = new Set(['giveaway', 'polls', 'vote', 'question']);
const UTIL = new Set(['ping', 'info', 'serverinfo', 'userinfo', 'afk', 'reminder', 'timezone', 'redeem', 'premium', 'avatar', 'membercount']);

function categoryOf(cmd) {
  const n = cmd.name;
  if (n.startsWith('un security')) return 'security';
  if (n.startsWith('un tickets') || n === 'ticket' || n === 'ticket-action' || n === 'appeals' || n === 'appeal-action') return 'tickets';
  if (n.startsWith('un staff') || n === 'stafflist') return 'staff';
  if (n.startsWith('suggest') || COMMUNITY.has(n)) return 'community';
  if (n.startsWith('custom-command')) return 'utility';
  if (n.startsWith('fun utility')) return 'utility';
  if (n.startsWith('fun')) return 'games';
  if (MOD.has(n)) return 'moderation';
  if (SETUP.has(n)) return 'setup';
  if (LEVELS.has(n)) return 'levels';
  if (GAMES.has(n)) return 'games';
  if (UTIL.has(n)) return 'utility';
  return 'utility';
}

function slug(name) { return name.replace(/\s+/g, ' ').trim(); }

async function getJSON(url) {
  try {
    const res = await fetch(url, { credentials: 'same-origin' });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) { return null; }
}

async function loadCatalog() {
  const [live, base, guides] = await Promise.all([getJSON('/api/commands'), getJSON('/data/commands-baseline.json'), getJSON('/data/guides.json')]);
  const useLive = live && live.commands && live.commands.length;
  const src = useLive ? live : (base || { commands: [], groups: {} });
  const g = guides || {};
  const list = src.commands.filter((c) => c.scope !== 'server' && c.access !== 'owner' && !c.name.startsWith('global '));
  list.forEach((c) => { c.category = categoryOf(c); c.guide = g[c.name] || null; });
  list.sort((a, b) => a.name.localeCompare(b.name));
  return { commands: list, groups: src.groups || {}, live: !!useLive, ts: useLive ? live.ts : null, guides: g };
}

function usageNode(cmd) {
  const box = h('div', { class: 'usage', role: 'group', 'aria-label': 'Usage' }, h('span', { class: 'req' }, '/' + cmd.name));
  (cmd.params || []).forEach((p) => box.append(' ', h('span', { class: p.required ? 'req' : 'opt' }, p.required ? p.name + ':' : '[' + p.name + ':]')));
  return box;
}

const ACCESS_LABEL = { everyone: 'Everyone', staff: 'Server staff' };
function accessBadge(a) { return h('span', { class: 'badge ' + (a === 'everyone' ? 'ok' : 'warn') }, ACCESS_LABEL[a] || 'Server staff'); }
function requiresBadges(cmd) { return (cmd.requires || []).map((r) => tierBadge(r)); }

/** Everything about one command, used by the pop-up and the standalone page. */
function commandDetail(cmd, cat) {
  const g = cmd.guide || {};
  const category = CATEGORIES.find((c) => c.id === cmd.category);
  const paramRows = (cmd.params || []).length
    ? h('table', { class: 'tbl' }, h('thead', {}, h('tr', {}, h('th', {}, 'Option'), h('th', {}, 'Needed'), h('th', {}, 'What it does'))),
      h('tbody', {}, cmd.params.map((p) => h('tr', {},
        h('td', {}, h('code', {}, p.name)),
        h('td', {}, p.required ? h('span', { class: 'badge warn' }, 'Required') : h('span', { class: 'muted' }, 'Optional')),
        h('td', {}, p.description || '-',
          p.choices && p.choices.length ? h('div', { class: 'muted small' }, 'Choices: ' + p.choices.map((c) => c.name).join(', ')) : null,
          p.min != null || p.max != null ? h('div', { class: 'muted small' }, 'Range: ' + (p.min != null ? p.min : '...') + ' to ' + (p.max != null ? p.max : '...')) : null)))))
    : h('p', { class: 'muted' }, 'No options. Just run it.');
  const who = { everyone: 'Any member can run this command.', staff: 'Server staff and the server owner can run this. Rex counts Manage Server, Administrator, Manage Messages, Moderate Members and your configured staff roles.' }[cmd.access] || '';
  return [
    h('div', { class: 'muted small', style: 'margin-bottom:12px' }, category ? category.name : 'Command'),
    h('p', {}, g.summary || cmd.description || 'No description yet.'),
    g.details ? h('p', { class: 'muted' }, g.details) : null,
    h('h3', { style: 'margin-top:18px' }, 'Usage'), usageNode(cmd),
    g.example ? [h('h3', { style: 'margin-top:18px' }, 'Example'), h('div', { class: 'usage' }, g.example)] : null,
    h('h3', { style: 'margin-top:18px' }, 'Options'), paramRows,
    h('h3', { style: 'margin-top:18px' }, 'Who can use it'), h('p', {}, who, ' ', requiresBadges(cmd), (cmd.requires || []).length ? h('a', { href: '/premium' }, ' See tiers') : null),
    g.tips && g.tips.length ? [h('h3', { style: 'margin-top:18px' }, 'Good to know'), h('ul', { class: 'muted' }, g.tips.map((t) => h('li', {}, t)))] : null,
  ];
}
