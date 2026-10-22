'use strict';
/* Command catalog: live list from the bot (/api/commands), falling back to the bundled baseline,
   merged with hand-written guides (/data/guides.json). */

const CATEGORIES = [
  { id: 'moderation', name: 'Moderation', blurb: 'Bans, timeouts, warnings, cases, lockdowns and message cleanup.' },
  { id: 'setup', name: 'Server setup', blurb: 'Panels, announcements, counting, tickets, appeals and checks.' },
  { id: 'levels', name: 'Levels & economy', blurb: 'XP, level cards, leaderboards, coins and daily rewards.' },
  { id: 'games', name: 'Games & fun', blurb: 'Mini-games, polls, giveaways and light-hearted commands.' },
  { id: 'utility', name: 'Utility', blurb: 'Handy tools, reminders, info commands and support links.' },
  { id: 'premium', name: 'Premium tools', blurb: 'Custom commands and the Premium control tools.' },
  { id: 'owner', name: 'Bot owner', blurb: 'Private tools for the people who run REX.' },
];

const MOD = new Set(['ban', 'unban', 'kick', 'timeout', 'un timeout', 'mass-timeout', 'warn', 'warns', 'clearwarns', 'case', 'history', 'notes', 'staffnote', 'purge', 'clear', 'slowmode', 'lock', 'unlock', 'lockdown', 'unlockdown', 'quarantine', 'temprole', 'role', 'roles', 'permissions', 'channels', 'report']);
const SETUP = new Set(['rex-setup', 'ticket', 'ticket-action', 'appeal-action', 'setup-appeal', 'counting', 'announce', 'announcement', 'say', 'dm', 'server-rules-message', 'support-center-message', 'boosting-benefits-message', 'stafflist', 'suggest panel', 'apply-setup', 'settings']);
const LEVELS = new Set(['level', 'levels', 'xp', 'leaderboard', 'balance', 'daily', 'profile']);
const GAMES = new Set(['games', 'rps', 'choose', 'polls', 'vote', 'giveaway', 'question']);
const UTIL = new Set(['ping', 'info', 'serverinfo', 'userinfo', 'afk', 'reminder', 'timezone', 'redeem', 'premium', 'avatar']);

function categoryOf(cmd, guides) {
  const g = guides && (guides[cmd.name] || guides[cmd.name.split(' ')[0]]);
  if (g && g.category) return g.category;
  const n = cmd.name;
  if (cmd.access === 'owner' || n.startsWith('global ') || n === 'owner-tools') return 'owner';
  if (n.startsWith('custom-command')) return 'premium';
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
  const list = src.commands.filter((c) => c.scope !== 'server');
  const g = guides || {};
  list.forEach((c) => { c.category = categoryOf(c, g); c.guide = g[c.name] || null; });
  list.sort((a, b) => a.name.localeCompare(b.name));
  return { commands: list, groups: src.groups || {}, live: !!useLive, ts: useLive ? live.ts : null, guides: g };
}

/** "/ban user:<member> [reason:<text>]" built from parameters. */
function usageString(cmd) {
  const parts = ['/' + cmd.name];
  (cmd.params || []).forEach((p) => parts.push(p.required ? p.name + ':<' + p.name + '>' : '[' + p.name + ':<' + p.name + '>]'));
  return parts.join(' ');
}

function usageNode(cmd) {
  const box = h('div', { class: 'usage', role: 'group', 'aria-label': 'Usage' }, h('span', { class: 'req' }, '/' + cmd.name));
  (cmd.params || []).forEach((p) => box.append(' ', h('span', { class: p.required ? 'req' : 'opt' }, p.required ? p.name + ':' : '[' + p.name + ':]')));
  return box;
}

const ACCESS_LABEL = { everyone: 'Everyone', staff: 'Server staff', owner: 'Bot owner' };
function accessBadge(a) {
  return h('span', { class: 'badge ' + (a === 'everyone' ? 'ok' : a === 'owner' ? 'bad' : 'warn') }, ACCESS_LABEL[a] || a);
}
function requiresBadges(cmd) {
  return (cmd.requires || []).map((r) => tierBadge(r));
}
