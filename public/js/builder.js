'use strict';
/* Block builder for custom commands and events. Mounted by server.js: rexBuilder.mount({...}) */
window.rexBuilder = (function () {
  const VARS = [
    ['{user}', 'Mention of the person who ran it / joined / left'], ['{user.name}', 'Their display name'], ['{user.username}', 'Their username'], ['{user.tag}', 'Their tag'], ['{user.id}', 'Their Discord ID'],
    ['{user_icon}', 'Their avatar (picture link)'], ['{user.created}', 'Account created date'], ['{user.joined}', 'Joined the server date'], ['{user.top_role}', 'Their highest role'], ['{user.roles}', 'How many roles they have'],
    ['{target}', 'Mention of the picked user (or the banned user)'], ['{target.name}', 'Picked user name'], ['{target.id}', 'Picked user ID'], ['{target_icon}', 'Picked user avatar'], ['{target.tag}', 'Picked user tag'],
    ['{server}', 'Server name'], ['{server.id}', 'Server ID'], ['{server.members}', 'Member count'], ['{member_number}', 'Member count with commas (1,234)'], ['{server_icon}', 'Server icon (picture link)'],
    ['{server.owner}', 'Mention of the server owner'], ['{server.boosts}', 'Boost count'], ['{server.channels}', 'Channel count'], ['{server.roles}', 'Role count'],
    ['{channel}', 'Channel mention'], ['{channel.name}', 'Channel name'], ['{channel.id}', 'Channel ID'], ['{channel.topic}', 'Channel topic'],
    ['{staff_roles}', 'Mentions of your staff roles'], ['{text}', 'Text typed into the command'],
    ['{answer.1}', 'Answer to form question 1 (up to 5)'], ['{ticket}', 'The ticket channel (ticket events)'],
    ['{setting}', 'Setting name (setting events)'], ['{old}', 'Old value (setting events)'], ['{new}', 'New value (setting events)'],
    ['{command}', 'Name of this command or event'], ['{date}', 'Today, UTC'], ['{date.iso}', 'Today as 2027-01-31'], ['{weekday}', 'Day of the week'], ['{time}', 'Now, UTC'],
    ['{timestamp}', 'Full Discord date and time'], ['{timestamp.relative}', '"5 minutes ago" style time'], ['{random}', 'Random number 1 to 100'], ['{dice}', 'Dice roll 1 to 6'], ['{coin}', 'Heads or Tails'],
    ['{var.name}', 'A variable you set with "Set a variable" or "Pick at random"'], ['{counter.name}', 'A server counter'], ['{ucount.name}', 'The person\'s own counter'],
  ];
  const TOGGLES = [['anti_ping_enabled', 'Anti-ping'], ['anti_spam', 'Anti-spam'], ['anti_link', 'Anti-link'], ['anti_swear', 'Anti-swear'], ['automod', 'AutoMod'],
    ['anti_alt', 'Anti-alt'], ['welcome_embed', 'Welcome embed'], ['leave_embed', 'Leave embed'], ['levels_enabled', 'Levels'], ['economy_enabled', 'Economy'], ['games_enabled', 'Games']];
  const COND = [['has_role', 'Person has role'], ['is_staff', 'Person is staff'], ['is_admin', 'Person is an admin'], ['channel_is', 'Used in channel'],
    ['contains', 'Text or answers contain'], ['random', 'Random chance (%)'], ['account_younger_days', 'Account younger than (days)'], ['target_is_bot', 'Picked user is a bot'], ['var_equals', 'A variable equals'], ['counter_gte', 'A counter is at least']];
  const TRIGGERS = [['member_join', 'Someone joins'], ['member_leave', 'Someone leaves'], ['member_ban', 'Someone is banned'], ['ticket_create', 'A ticket is created'],
    ['settings_change', 'A server setting changes'], ['interval', 'Every so often'], ['daily', 'Every day at a time']];
  const GROUPS = [
    ['Messages', ['message', 'embed', 'image_card', 'poll', 'dm']],
    ['Edit messages', ['edit_message', 'delete_message', 'pin', 'react', 'thread']],
    ['Memory', ['set_var', 'pick', 'counter']],
    ['Server', ['add_role', 'remove_role', 'create_role', 'create_channel', 'set_nick', 'slowmode']],
    ['Moderation', ['kick', 'ban', 'timeout']],
    ['Rex', ['send_form', 'create_ticket', 'set_toggle', 'log']],
    ['Flow', ['wait', 'branch']],
  ];
  const F = (k, t, l, extra) => Object.assign({ k, t, l }, extra || {});
  const WHO = [['user', 'The person who ran it'], ['target', 'The picked user']];
  const BLOCKS = {
    message: { i: '💬', n: 'Send message', d: 'Post a message.', f: [F('text', 'area', 'Message', { vars: 1 }), F('channel', 'channel', 'Channel (empty = reply here)'), F('name', 'label', 'Label (to edit this later)'), F('buttons', 'components', 'Buttons and menu')] },
    embed: { i: '🖼️', n: 'Send embed', d: 'A styled card.', f: [F('title', 'text', 'Title', { vars: 1 }), F('description', 'area', 'Description', { vars: 1 }), F('color', 'color', 'Colour'), F('image', 'text', 'Image link'), F('footer', 'text', 'Footer'), F('channel', 'channel', 'Channel (empty = reply here)'), F('name', 'label', 'Label (to edit this later)'), F('buttons', 'components', 'Buttons and menu')] },
    image_card: { i: '🎴', n: 'Send image card', d: 'A picture made from text and avatars.', f: [F('card', 'card', 'Card design'), F('text', 'area', 'Message above the card (optional)', { vars: 1 }), F('channel', 'channel', 'Channel (empty = reply here)'), F('name', 'label', 'Label (to edit this later)'), F('buttons', 'components', 'Buttons and menu')] },
    poll: { i: '📊', n: 'Poll', d: 'Reaction poll with 2-5 options.', f: [F('question', 'text', 'Question', { vars: 1 }), F('options', 'strlist', 'Options', { max: 5, min: 2, ph: 'Option', len: 100 }), F('channel', 'channel', 'Channel (empty = reply here)'), F('name', 'label', 'Label (to edit this later)')] },
    edit_message: { i: '✏️', n: 'Edit a message', d: 'Change a message sent earlier in this flow.', f: [F('ref', 'ref', 'Which message'), F('text', 'area', 'New text', { vars: 1 }), F('title', 'text', 'New embed title (embeds)', { vars: 1 }), F('description', 'area', 'New embed description (embeds)', { vars: 1 })] },
    delete_message: { i: '🗑️', n: 'Delete a message', d: 'Remove an earlier message, now or after a while.', f: [F('ref', 'ref', 'Which message'), F('after', 'num', 'After (seconds, 0 = now)', { min: 0, max: 60 })] },
    pin: { i: '📌', n: 'Pin a message', d: '', f: [F('ref', 'ref', 'Which message')] },
    react: { i: '😀', n: 'Add a reaction', d: '', f: [F('ref', 'ref', 'Which message'), F('emoji', 'text', 'Emoji')] },
    thread: { i: '🧵', n: 'Start a thread', d: 'On an earlier message.', f: [F('ref', 'ref', 'Which message'), F('title', 'text', 'Thread name', { vars: 1 })] },
    set_var: { i: '🧮', n: 'Set a variable', d: 'Use it later as {var.name}.', f: [F('name', 'text', 'Variable name (a-z, 0-9, _)'), F('value', 'text', 'Value', { vars: 1 })] },
    pick: { i: '🎲', n: 'Pick at random', d: 'Choose one option into {var.name}.', f: [F('name', 'text', 'Variable name'), F('options', 'strlist', 'Options', { max: 10, min: 2, ph: 'Option', len: 200 })] },
    counter: { i: '🔢', n: 'Counter', d: 'Count things. Read with {counter.name} or {ucount.name}.', f: [F('name', 'text', 'Counter name'), F('scope', 'select', 'Counts', { o: [['server', 'For the whole server'], ['user', 'For each person']] }), F('op', 'select', 'Do', { o: [['add', 'Add'], ['subtract', 'Subtract'], ['set', 'Set to'], ['reset', 'Reset to 0']] }), F('amount', 'num', 'Amount', { min: -1000000, max: 1000000 })] },
    set_nick: { i: '🪪', n: 'Change a nickname', d: 'Leave empty to clear it.', f: [F('to', 'select', 'Whose', { o: WHO }), F('nick', 'text', 'New nickname', { vars: 1 })] },
    slowmode: { i: '🐢', n: 'Set slowmode', d: '0 turns it off.', f: [F('channel', 'channel', 'Channel (empty = here)'), F('seconds', 'num', 'Seconds', { min: 0, max: 21600 })] },
    dm: { i: '✉️', n: 'Send a DM', d: 'Private message.', f: [F('text', 'area', 'Message', { vars: 1 }), F('to', 'select', 'Send to', { o: WHO })] },
    add_role: { i: '🏷️', n: 'Give a role', d: '', f: [F('role', 'role', 'Role'), F('to', 'select', 'Give it to', { o: WHO })] },
    remove_role: { i: '🧹', n: 'Remove a role', d: '', f: [F('role', 'role', 'Role'), F('to', 'select', 'Take it from', { o: WHO })] },
    create_role: { i: '🎨', n: 'Create a role', d: '', f: [F('name', 'text', 'Role name', { vars: 1 }), F('color', 'color', 'Colour')] },
    create_channel: { i: '📁', n: 'Create a channel', d: '', f: [F('name', 'text', 'Channel name', { vars: 1 }), F('kind', 'select', 'Type', { o: [['text', 'Text'], ['voice', 'Voice']] }), F('category', 'category', 'Category'), F('private', 'check', 'Only the person and staff can see it')] },
    kick: { i: '👢', n: 'Kick', d: 'Needs the "pick a user" option.', f: [F('to', 'select', 'Who', { o: [['target', 'The picked user'], ['user', 'The person who ran it']] }), F('reason', 'text', 'Reason')] },
    ban: { i: '🔨', n: 'Ban', d: 'Needs the "pick a user" option.', f: [F('to', 'select', 'Who', { o: [['target', 'The picked user'], ['user', 'The person who ran it']] }), F('reason', 'text', 'Reason')] },
    timeout: { i: '⏳', n: 'Timeout', d: 'Mute for a while.', f: [F('to', 'select', 'Who', { o: [['target', 'The picked user'], ['user', 'The person who ran it']] }), F('minutes', 'num', 'Minutes', { min: 1, max: 40320 }), F('reason', 'text', 'Reason')] },
    send_form: { i: '📝', n: 'Ask a form', d: 'Must be the first block.', f: [F('title', 'text', 'Form title'), F('questions', 'list', 'Questions (up to 5)'), F('channel', 'channel', 'Post answers in (empty = here)')] },
    create_ticket: { i: '🎫', n: 'Create a ticket', d: 'Opens a ticket for the person.', f: [F('ticket_type', 'tickettype', 'Ticket button to use')] },
    set_toggle: { i: '🎚️', n: 'Change a setting', d: 'Turn a Rex feature on or off.', f: [F('key', 'select', 'Setting', { o: TOGGLES }), F('mode', 'select', 'Do', { o: [['on', 'Turn on'], ['off', 'Turn off'], ['toggle', 'Flip it']] })] },
    wait: { i: '⌛', n: 'Wait', d: '', f: [F('seconds', 'num', 'Seconds', { min: 1, max: 20 })] },
    log: { i: '📜', n: 'Write to mod log', d: '', f: [F('text', 'area', 'Text', { vars: 1 })] },
    branch: { i: '🔀', n: 'If / else', d: 'Do different things depending on a condition.', f: [] },
  };
  const DEF = {
    message: { text: '', name: '' }, embed: { title: '', description: '', color: '', image: '', footer: '', channel: '', name: '' }, dm: { text: '', to: 'user' },
    add_role: { role: '', to: 'user' }, remove_role: { role: '', to: 'user' }, create_role: { name: '', color: '' }, create_channel: { name: '', kind: 'text', category: '', private: false },
    kick: { to: 'target', reason: '' }, ban: { to: 'target', reason: '' }, timeout: { to: 'target', minutes: 10, reason: '' }, send_form: { title: 'Form', questions: [''], channel: '' },
    create_ticket: { ticket_type: '' }, set_toggle: { key: 'anti_ping_enabled', mode: 'toggle' }, wait: { seconds: 2 }, log: { text: '' },
    branch: { if: { kind: 'is_staff', value: '' }, then: [], else: [] },
    image_card: { card: null, text: '', channel: '', name: '' }, poll: { question: '', options: ['', ''], channel: '', name: '' }, edit_message: { ref: 'last', text: '', title: '', description: '' },
    delete_message: { ref: 'last', after: 0 }, pin: { ref: 'last' }, react: { ref: 'last', emoji: '👍' }, thread: { ref: 'last', title: 'Discussion' }, set_var: { name: '', value: '' },
    pick: { name: '', options: ['', ''] }, counter: { name: '', scope: 'server', op: 'add', amount: 1 }, set_nick: { to: 'user', nick: '' }, slowmode: { channel: '', seconds: 5 },
  };
  const uid = () => Math.random().toString(36).slice(2, 10);
  const clone = (x) => JSON.parse(JSON.stringify(x));

  function mount(o) {
    const { spec, draft, set, guild, locked, errors, ticketTypes } = o;
    const isCmd = spec.kind !== 'event';
    const unlimited = o.unlimited, limit = unlimited ? 50 : 5;
    let list = clone(Array.isArray(draft[spec.key]) ? draft[spec.key] : []);
    let editing = null;      // index of the flow being edited
    const root = h('div', { class: 'bld' });
    const dis = locked ? true : null;
    const commit = () => set(spec.key, clone(list));
    const textChans = guild.channels.filter((c) => c.type === 'text' || c.type === 'announcement');
    const cats = guild.channels.filter((c) => c.type === 'category');
    const roles = guild.roles.filter((r) => !r.managed).sort((a, b) => b.position - a.position);
    const ttypes = () => (Array.isArray(draft.premium_ticket_panels) ? draft.premium_ticket_panels : []);

    function varsButton() {
      let pop = null;
      const btn = h('button', { type: 'button', class: 'bld-info', title: 'Variables you can use', 'aria-label': 'Variables', onclick: (e) => {
        e.stopPropagation();
        if (pop) { pop.remove(); pop = null; return; }
        pop = h('div', { class: 'bld-pop' }, h('b', {}, 'Variables'), h('div', { class: 'muted small' }, 'Put these in any text. Click one to copy it.'),
          h('div', { class: 'bld-vars' }, VARS.map(([v, d]) => h('button', { type: 'button', onclick: () => { try { navigator.clipboard.writeText(v); toast('Copied ' + v); } catch (er) { toast(v); } } }, h('code', {}, v), h('span', {}, d)))));
        btn.parentNode.append(pop);
        setTimeout(() => document.addEventListener('click', function f(ev) { if (pop && !pop.contains(ev.target)) { pop.remove(); pop = null; } document.removeEventListener('click', f); }), 0);
      } }, 'i');
      return h('span', { class: 'bld-infowrap' }, btn);
    }

    /* ---------------------------------------------------------- one field */
    function field(block, f, rerender) {
      const v = block[f.k];
      const set1 = (x) => { block[f.k] = x; commit(); };
      let el;
      switch (f.t) {
        case 'text': el = h('input', { type: 'text', value: v || '', maxlength: 500, disabled: dis, oninput: (e) => set1(e.target.value) }); break;
        case 'area': el = h('textarea', { rows: 3, maxlength: 2000, disabled: dis, oninput: (e) => set1(e.target.value) }, v || ''); break;
        case 'num': el = h('input', { type: 'number', min: f.min, max: f.max, value: v, disabled: dis, oninput: (e) => { const n = parseInt(e.target.value, 10); set1(isNaN(n) ? (f.min || 0) : n); } }); break;
        case 'color': { const txt = h('input', { type: 'text', value: v || '', placeholder: '#2EE6B6', maxlength: 7, disabled: dis });
          const pick = h('input', { type: 'color', value: /^#?[0-9a-f]{6}$/i.test(v || '') ? '#' + (v || '').replace('#', '') : '#2ee6b6', disabled: dis, style: 'width:46px;padding:2px;flex:none' });
          txt.addEventListener('input', () => set1(txt.value.replace('#', ''))); pick.addEventListener('input', () => { txt.value = pick.value; set1(pick.value.replace('#', '')); });
          el = h('div', { style: 'display:flex;gap:8px' }, txt, pick); break; }
        case 'check': el = h('label', { class: 'bld-check' }, h('input', { type: 'checkbox', checked: v ? true : null, disabled: dis, onchange: (e) => set1(e.target.checked) }), ' ' + f.l); return el;
        case 'select': el = h('select', { disabled: dis, onchange: (e) => { set1(e.target.value); if (f.rerender) rerender(); } }, f.o.map(([a, b]) => h('option', { value: a }, b))); el.value = v; break;
        case 'channel': el = h('select', { disabled: dis, onchange: (e) => set1(e.target.value) }, h('option', { value: '' }, 'Here'), textChans.map((c) => h('option', { value: c.id }, '#' + c.name))); el.value = v || ''; break;
        case 'category': el = h('select', { disabled: dis, onchange: (e) => set1(e.target.value) }, h('option', { value: '' }, 'No category'), cats.map((c) => h('option', { value: c.id }, c.name))); el.value = v || ''; break;
        case 'role': el = h('select', { disabled: dis, onchange: (e) => set1(e.target.value) }, h('option', { value: '' }, 'Choose a role'), roles.map((r) => h('option', { value: r.id }, r.name))); el.value = v || ''; break;
        case 'tickettype': el = h('select', { disabled: dis, onchange: (e) => set1(e.target.value) }, h('option', { value: '' }, 'Default ticket'), ttypes().filter((t) => t.action !== 'link').map((t) => h('option', { value: t.label }, t.label))); el.value = v || ''; break;
        case 'label': el = h('input', { type: 'text', value: v || '', maxlength: 20, placeholder: 'e.g. welcome', disabled: dis, oninput: (e) => { e.target.value = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''); set1(e.target.value); } }); break;
        case 'ref': { const names = []; (function walk(bs) { (bs || []).forEach((x) => { if (x.name && ['message', 'embed', 'image_card', 'poll'].includes(x.type)) names.push(x.name); if (x.type === 'branch') { walk(x.then); walk(x.else); } }); })(list[editing] ? list[editing].blocks : []);
          el = h('select', { disabled: dis, onchange: (e) => set1(e.target.value) }, h('option', { value: 'last' }, 'The last message sent'), [...new Set(names)].map((n) => h('option', { value: n }, 'Label: ' + n))); el.value = v || 'last'; break; }
        case 'strlist': {
          const box = h('div', { class: 'tt-q' });
          const paint = () => box.replaceChildren(...block[f.k].map((q, qi) => h('div', { style: 'display:flex;gap:6px' },
            h('input', { type: 'text', maxlength: f.len || 100, value: q, placeholder: (f.ph || 'Item') + ' ' + (qi + 1), disabled: dis, oninput: (e) => { block[f.k][qi] = e.target.value; commit(); } }),
            block[f.k].length > (f.min || 1) ? h('button', { type: 'button', class: 'btn ghost sm', disabled: dis, onclick: () => { block[f.k].splice(qi, 1); paint(); commit(); } }, '✕') : null)),
            block[f.k].length < (f.max || 5) ? h('button', { type: 'button', class: 'btn ghost sm', disabled: dis, onclick: () => { block[f.k].push(''); paint(); } }, '+ Add') : null);
          paint(); el = box; break; }
        case 'card': {
          const host = h('div', {});
          const open = () => { if (!window.rexCard) return host.replaceChildren(h('p', { class: 'muted' }, 'The card editor is still loading, try again in a second.')); host.replaceChildren(window.rexCard.editor(block.card, { dis, onchange: (c) => { block.card = c; commit(); } })); };
          host.append(h('button', { type: 'button', class: 'btn ghost sm', onclick: open }, block.card ? 'Edit card design' : 'Design the card')); if (block.card) open();
          el = host; break; }
        case 'components': {
          const box = h('div', { class: 'bld-comps' });
          const ACTS = [['reply', 'Reply privately'], ['dm', 'Send a DM'], ['add_role', 'Give a role'], ['remove_role', 'Remove a role'], ['toggle_role', 'Toggle a role'], ['link', 'Open a link']];
          const actVal = (o, linkOk) => {
            if (['add_role', 'remove_role', 'toggle_role'].includes(o.action)) return field(o, F('value', 'role', 'Role'), () => {});
            if (o.action === 'link') return field(o, F('value', 'text', 'Link (https://...)'), () => {});
            return field(o, F('value', 'area', 'What Rex says', { vars: 1 }), () => {});
          };
          const actSel = (o, linkOk, redo) => { const s = h('select', { disabled: dis, onchange: (e) => { o.action = e.target.value; o.value = ''; commit(); redo(); } }, ACTS.filter((a) => linkOk || a[0] !== 'link').map(([a, b]) => h('option', { value: a }, b))); s.value = o.action; return h('label', { class: 'bld-f' }, h('span', { class: 'bld-fl' }, 'When clicked'), s); };
          const paint = () => {
            const btns = block.buttons || [], sel = block.select;
            box.replaceChildren(
              ...btns.map((x, i) => h('div', { class: 'bld-comp' }, h('div', { class: 'bld-ch' }, h('b', {}, '🔘 Button ' + (i + 1)), h('span', { class: 'grow' }), h('button', { type: 'button', class: 'bld-mini bad', disabled: dis, onclick: () => { block.buttons.splice(i, 1); if (!block.buttons.length) delete block.buttons; commit(); paint(); } }, '✕')),
                field(x, F('label', 'text', 'Label'), () => {}), field(x, F('emoji', 'text', 'Emoji (optional)'), () => {}),
                field(x, F('style', 'select', 'Colour', { o: [['primary', 'Blue'], ['secondary', 'Grey'], ['success', 'Green'], ['danger', 'Red']] }), () => {}),
                actSel(x, true, paint), actVal(x))),
              (block.buttons || []).length < 5 ? h('button', { type: 'button', class: 'btn ghost sm', disabled: dis, onclick: () => { (block.buttons = block.buttons || []).push({ label: 'Click me', style: 'secondary', emoji: '', action: 'reply', value: '' }); commit(); paint(); } }, '+ Add a button') : null,
              sel ? h('div', { class: 'bld-comp' }, h('div', { class: 'bld-ch' }, h('b', {}, '📋 Select menu'), h('span', { class: 'grow' }), h('button', { type: 'button', class: 'bld-mini bad', disabled: dis, onclick: () => { delete block.select; commit(); paint(); } }, '✕')),
                field(sel, F('placeholder', 'text', 'Placeholder'), () => {}),
                ...sel.options.map((o, i) => h('div', { class: 'bld-comp inner' }, h('div', { class: 'bld-ch' }, h('b', {}, 'Option ' + (i + 1)), h('span', { class: 'grow' }), sel.options.length > 1 ? h('button', { type: 'button', class: 'bld-mini bad', disabled: dis, onclick: () => { sel.options.splice(i, 1); commit(); paint(); } }, '✕') : null),
                  field(o, F('label', 'text', 'Label'), () => {}), field(o, F('description', 'text', 'Description (optional)'), () => {}), actSel(o, false, paint), actVal(o))),
                sel.options.length < 10 ? h('button', { type: 'button', class: 'btn ghost sm', disabled: dis, onclick: () => { sel.options.push({ label: 'Option', description: '', action: 'reply', value: '' }); commit(); paint(); } }, '+ Add an option') : null)
                : h('button', { type: 'button', class: 'btn ghost sm', disabled: dis, onclick: () => { block.select = { placeholder: 'Choose one', options: [{ label: 'Option', description: '', action: 'reply', value: '' }] }; commit(); paint(); } }, '+ Add a select menu'));
          };
          paint(); el = box; break; }
        case 'list': {
          const box = h('div', { class: 'tt-q' });
          const paint = () => box.replaceChildren(...block[f.k].map((q, qi) => h('div', { style: 'display:flex;gap:6px' },
            h('input', { type: 'text', maxlength: 45, value: q, placeholder: 'Question ' + (qi + 1), disabled: dis, oninput: (e) => { block[f.k][qi] = e.target.value; commit(); } }),
            h('button', { type: 'button', class: 'btn ghost sm', disabled: dis, onclick: () => { block[f.k].splice(qi, 1); paint(); commit(); } }, '✕'))),
            block[f.k].length < 5 ? h('button', { type: 'button', class: 'btn ghost sm', disabled: dis, onclick: () => { block[f.k].push(''); paint(); } }, '+ Add a question') : null);
          paint(); el = box; break; }
        default: el = h('span', {});
      }
      return h('label', { class: 'bld-f' }, h('span', { class: 'bld-fl' }, f.l, f.vars ? varsButton() : null), el);
    }

    /* ---------------------------------------------------------- flow of blocks */
    function flow(blocks, rerender, depth) {
      const col = h('div', { class: 'bld-flow' });
      const palette = (at) => {
        const pop = h('div', { class: 'bld-pal' }, GROUPS.map(([g, types]) => h('div', {}, h('div', { class: 'bld-pg' }, g),
          h('div', { class: 'bld-pi' }, types.filter((t) => !(t === 'send_form' && (!isCmd || depth > 0 || blocks.length > 0 && at !== 0)) && !(t === 'branch' && depth >= 3)).map((t) =>
            h('button', { type: 'button', onclick: () => { blocks.splice(at, 0, Object.assign({ type: t }, clone(DEF[t]))); commit(); rerender(); } }, h('span', {}, BLOCKS[t].i), h('b', {}, BLOCKS[t].n), h('em', {}, BLOCKS[t].d)))))));
        return pop;
      };
      const adder = (at) => {
        const wrap = h('div', { class: 'bld-add' });
        wrap.append(h('button', { type: 'button', class: 'bld-plus', disabled: dis, 'aria-label': 'Add a block', onclick: (e) => {
          e.stopPropagation(); const open = wrap.querySelector('.bld-pal'); if (open) return open.remove();
          const p = palette(at); wrap.append(p);
          setTimeout(() => document.addEventListener('click', function f(ev) { if (!p.contains(ev.target)) p.remove(); document.removeEventListener('click', f); }), 0);
        } }, '+ Add block'));
        return wrap;
      };
      col.append(adder(0));
      blocks.forEach((b, i) => {
        const def = BLOCKS[b.type];
        const card = h('div', { class: 'bld-card t-' + b.type },
          h('div', { class: 'bld-ch' }, h('span', { class: 'bld-ic' }, def.i), h('b', {}, def.n),
            h('span', { class: 'grow' }),
            h('button', { type: 'button', class: 'bld-mini', disabled: dis || i === 0 ? true : null, 'aria-label': 'Move up', onclick: () => { blocks.splice(i - 1, 0, blocks.splice(i, 1)[0]); commit(); rerender(); } }, '↑'),
            h('button', { type: 'button', class: 'bld-mini', disabled: dis || i === blocks.length - 1 ? true : null, 'aria-label': 'Move down', onclick: () => { blocks.splice(i + 1, 0, blocks.splice(i, 1)[0]); commit(); rerender(); } }, '↓'),
            h('button', { type: 'button', class: 'bld-mini bad', disabled: dis, 'aria-label': 'Delete block', onclick: () => { blocks.splice(i, 1); commit(); rerender(); } }, '✕')));
        if (b.type === 'branch') {
          const c = b.if;
          const val = (() => {
            if (c.kind === 'has_role') return field(c, F('value', 'role', 'Role'), rerender);
            if (c.kind === 'channel_is') return field(c, F('value', 'channel', 'Channel'), rerender);
            if (c.kind === 'contains') return field(c, F('value', 'text', 'Word to look for'), rerender);
            if (c.kind === 'random') return field(c, F('value', 'num', 'Chance (1-99)', { min: 1, max: 99 }), rerender);
            if (c.kind === 'var_equals') return field(c, F('value', 'text', 'Check, like  mood = happy'), rerender);
            if (c.kind === 'counter_gte') return field(c, F('value', 'text', 'Check, like  points >= 10'), rerender);
            if (c.kind === 'account_younger_days') return field(c, F('value', 'num', 'Days', { min: 1, max: 3650 }), rerender);
            return null;
          })();
          card.append(h('div', { class: 'bld-cond' },
            h('label', { class: 'bld-f' }, h('span', { class: 'bld-fl' }, 'If'), (() => { const s = h('select', { disabled: dis, onchange: (e) => { c.kind = e.target.value; c.value = ''; commit(); rerender(); } }, COND.map(([a, bb]) => h('option', { value: a }, bb))); s.value = c.kind; return s; })()), val));
          card.append(h('div', { class: 'bld-split' },
            h('div', { class: 'bld-branch yes' }, h('div', { class: 'bld-bt' }, '✔ Then'), flow(b.then, rerender, depth + 1)),
            h('div', { class: 'bld-branch no' }, h('div', { class: 'bld-bt' }, '✖ Otherwise'), flow(b.else, rerender, depth + 1))));
        } else {
          card.append(h('div', { class: 'bld-body' }, def.f.map((f) => field(b, f, rerender))));
        }
        col.append(card, adder(i + 1));
      });
      return col;
    }

    /* ---------------------------------------------------------- list view */
    function listView() {
      const grid = h('div', { class: 'bld-grid' });
      list.forEach((c, i) => {
        grid.append(h('div', { class: 'bld-tile' + (c.enabled === false ? ' off' : '') },
          h('div', { class: 'bld-th' }, h('b', {}, isCmd ? '/' + c.name : c.name), h('button', { type: 'button', class: 'rocker', role: 'switch', 'aria-checked': String(c.enabled !== false), disabled: dis, 'aria-label': 'Enabled',
            onclick: (e) => { c.enabled = c.enabled === false; e.currentTarget.setAttribute('aria-checked', String(c.enabled)); e.currentTarget.closest('.bld-tile').classList.toggle('off', !c.enabled); commit(); } })),
          h('div', { class: 'muted small bld-td' }, isCmd ? c.description : (TRIGGERS.find((t) => t[0] === c.trigger) || [0, c.trigger])[1]),
          h('div', { class: 'bld-tf' }, h('span', { class: 'chip' }, (c.blocks || []).length + ' block' + ((c.blocks || []).length === 1 ? '' : 's')),
            isCmd ? h('span', { class: 'chip' }, c.visibility && c.visibility.mode === 'staff' ? 'Staff only' : c.visibility && c.visibility.mode === 'roles' ? 'Some roles' : 'Everyone') : null,
            h('span', { class: 'grow' }),
            h('button', { type: 'button', class: 'btn ghost sm', onclick: () => { editing = i; paint(); } }, locked ? 'View' : 'Edit'),
            h('button', { type: 'button', class: 'btn ghost sm', disabled: dis, 'aria-label': 'Delete', onclick: async () => { if (!(await rexDialog.confirm('Delete ' + (isCmd ? '/' + c.name : c.name) + '?', 'This removes it from your server. You can build it again later.', 'Delete', true))) return; list.splice(i, 1); commit(); paint(); } }, '🗑'))));
      });
      const full = list.length >= limit;
      grid.append(h('button', { type: 'button', class: 'bld-new', disabled: locked || full ? true : null, onclick: () => {
        list.push(isCmd ? { id: uid(), name: '', description: '', enabled: true, visibility: { mode: 'everyone', roles: [] }, options: { user: false, text: false }, ephemeral: false, blocks: [] }
          : { id: uid(), name: '', trigger: 'member_join', enabled: true, every_minutes: 60, at: '18:00', blocks: [] });
        editing = list.length - 1; commit(); paint(); } },
        h('span', { class: 'bld-nplus' }, '+'), h('b', {}, isCmd ? 'Build a new command' : 'Build a new event'), h('span', { class: 'muted small' }, full ? (unlimited ? 'You reached the maximum.' : 'Premium allows 5. Ultra or Priority removes the limit.') : 'Start with a blank canvas')));
      return h('div', {},
        h('div', { class: 'bld-top' }, h('h3', {}, isCmd ? 'Active commands' : 'Active events'), h('span', { class: 'chip' }, list.length + ' / ' + (unlimited ? '∞' : limit))), grid,
        list.length === 0 ? h('p', { class: 'muted small' }, isCmd ? 'You have no custom commands yet. Build one and it appears as a slash command in your server a few seconds after you save.' : 'No events yet. Events run by themselves when something happens in your server.') : null);
    }

    /* ---------------------------------------------------------- editor */
    function editor(c) {
      const rerender = () => paint();
      const top = h('div', { class: 'bld-etop' },
        h('button', { type: 'button', class: 'btn ghost sm', onclick: () => { editing = null; paint(); } }, '← Back'),
        h('b', {}, isCmd ? 'Command builder' : 'Event builder'), h('span', { class: 'grow' }), varsButton());
      const meta = h('div', { class: 'bld-meta' });
      if (isCmd) {
        meta.append(
          h('label', { class: 'bld-f' }, h('span', { class: 'bld-fl' }, 'Command name'), h('div', { class: 'bld-slash' }, h('span', {}, '/'),
            h('input', { type: 'text', value: c.name, maxlength: 32, placeholder: 'hello', disabled: dis, oninput: (e) => { e.target.value = e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''); c.name = e.target.value; commit(); } }))),
          h('label', { class: 'bld-f' }, h('span', { class: 'bld-fl' }, 'Description'), h('input', { type: 'text', value: c.description, maxlength: 100, placeholder: 'What this command does', disabled: dis, oninput: (e) => { c.description = e.target.value; commit(); } })),
          h('div', { class: 'bld-f' }, h('span', { class: 'bld-fl' }, 'Who can use it'),
            (() => { const s = h('select', { disabled: dis, onchange: (e) => { c.visibility.mode = e.target.value; commit(); paint(); } }, [['everyone', 'Everyone'], ['staff', 'Staff only (hidden from others)'], ['roles', 'Only certain roles']].map(([a, b]) => h('option', { value: a }, b))); s.value = c.visibility.mode; return s; })(),
            c.visibility.mode === 'roles' ? rolePick(c.visibility) : null),
          h('div', { class: 'bld-f' }, h('span', { class: 'bld-fl' }, 'Options'),
            h('label', { class: 'bld-check' }, h('input', { type: 'checkbox', checked: c.options.user ? true : null, disabled: dis, onchange: (e) => { c.options.user = e.target.checked; commit(); } }), ' Let people pick a user ({target})'),
            h('label', { class: 'bld-check' }, h('input', { type: 'checkbox', checked: c.options.text ? true : null, disabled: dis, onchange: (e) => { c.options.text = e.target.checked; commit(); } }), ' Let people type some text ({text})'),
            h('label', { class: 'bld-check' }, h('input', { type: 'checkbox', checked: c.ephemeral ? true : null, disabled: dis, onchange: (e) => { c.ephemeral = e.target.checked; commit(); } }), ' Only the person who ran it sees the reply')));
      } else {
        meta.append(
          h('label', { class: 'bld-f' }, h('span', { class: 'bld-fl' }, 'Event name'), h('input', { type: 'text', value: c.name, maxlength: 40, placeholder: 'Welcome gift', disabled: dis, oninput: (e) => { c.name = e.target.value; commit(); } })),
          h('label', { class: 'bld-f' }, h('span', { class: 'bld-fl' }, 'Runs when'), (() => { const s = h('select', { disabled: dis, onchange: (e) => { c.trigger = e.target.value; commit(); paint(); } }, TRIGGERS.map(([a, b]) => h('option', { value: a }, b))); s.value = c.trigger; return s; })()),
          c.trigger === 'interval' ? h('label', { class: 'bld-f' }, h('span', { class: 'bld-fl' }, 'Every (minutes, 5 to 1440)'), h('input', { type: 'number', min: 5, max: 1440, value: c.every_minutes, disabled: dis, oninput: (e) => { c.every_minutes = parseInt(e.target.value, 10) || 60; commit(); } })) : null,
          c.trigger === 'daily' ? h('label', { class: 'bld-f' }, h('span', { class: 'bld-fl' }, 'Time (UTC)'), h('input', { type: 'time', value: c.at || '18:00', disabled: dis, oninput: (e) => { c.at = e.target.value; commit(); } })) : null,
          h('p', { class: 'muted small' }, c.trigger === 'member_join' ? '{user} is the new member.' : c.trigger === 'member_leave' ? '{user} is the member who left.' : c.trigger === 'member_ban' ? '{target} is the banned user.' : c.trigger === 'ticket_create' ? '{user} opened {ticket}.' : c.trigger === 'settings_change' ? '{setting}, {old} and {new} describe the change, {user} made it.' : 'Messages need a channel picked in the block.'));
      }
      return h('div', {}, top, meta,
        h('div', { class: 'bld-canvas' }, h('div', { class: 'bld-node start' }, isCmd ? '▶ Someone runs /' + (c.name || 'command') : '▶ ' + (TRIGGERS.find((t) => t[0] === c.trigger) || ['', 'Event'])[1]),
          flow(c.blocks, rerender, 0), h('div', { class: 'bld-node end' }, '■ Finished')));
    }
    function rolePick(vis) {
      const chips = h('div', { class: 'chips' });
      const paintC = () => chips.replaceChildren(...vis.roles.map((id) => { const r = guild.roles.find((x) => x.id === id); return h('button', { type: 'button', class: 'chip', disabled: dis, onclick: () => { vis.roles = vis.roles.filter((x) => x !== id); commit(); paintC(); } }, r ? r.name : id, h('span', { class: 'n' }, 'x')); }));
      const sel = h('select', { disabled: dis, onchange: (e) => { if (e.target.value && !vis.roles.includes(e.target.value) && vis.roles.length < 15) { vis.roles.push(e.target.value); commit(); paintC(); } e.target.value = ''; } },
        h('option', { value: '' }, 'Add a role...'), roles.map((r) => h('option', { value: r.id }, r.name)));
      paintC(); return h('div', {}, sel, chips);
    }

    function paint() {
      root.replaceChildren(editing === null ? listView() : editor(list[editing]));
      if (errors[spec.key]) root.prepend(h('div', { class: 'err-text bld-err', role: 'alert' }, errors[spec.key]));
    }
    paint();
    return root;
  }
  return { mount };
})();
