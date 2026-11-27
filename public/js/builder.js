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
    ['{role}', 'Role involved (role events)'], ['{emoji}', 'Emoji involved (reaction events)'], ['{reviewer}', 'Staff who reviewed an application or appeal'], ['{level}', 'New level (level up)'],
    ['{prize}', 'Giveaway prize'], ['{winners}', 'Giveaway winners (mentions)'], ['{winner_count}', 'Number of winners'], ['{message_link}', 'Link to the message'], ['{reason}', 'Reason given'],
    ['{case}', 'Warning or case number'], ['{incident}', 'Raid / betrayal incident ID'], ['{until}', 'Timeout end time'], ['{invite}', 'Invite code used'], ['{name}', 'Name of the thing (channel, role, thread)'], ['{remaining}', 'Items or time remaining'],
    ['{var.name}', 'A variable you set with "Set a variable" or "Pick at random"'], ['{counter.name}', 'A server counter'], ['{ucount.name}', 'The person\'s own counter'],
  ];
  const TOGGLES = [['anti_ping_enabled', 'Anti-ping'], ['anti_spam', 'Anti-spam'], ['anti_link', 'Anti-link'], ['anti_swear', 'Anti-swear'], ['automod', 'AutoMod'],
    ['anti_alt', 'Anti-alt'], ['welcome_embed', 'Welcome embed'], ['leave_embed', 'Leave embed'], ['levels_enabled', 'Levels'], ['economy_enabled', 'Economy'], ['games_enabled', 'Games']];
  const COND = [['has_role', 'Person has role'], ['is_staff', 'Person is staff'], ['is_admin', 'Person is an admin'], ['channel_is', 'Used in channel'],
    ['contains', 'Text or answers contain'], ['random', 'Random chance (%)'], ['account_younger_days', 'Account younger than (days)'], ['target_is_bot', 'Picked user is a bot'], ['user_is_bot', 'Person is a bot'], ['weekday_is', 'Today is (weekday)'], ['member_count_gte', 'Server has at least (members)'], ['var_gte', 'A variable is at least'], ['in_voice', 'Person is in a voice channel'], ['text_empty', 'No text was typed'], ['var_equals', 'A variable equals'], ['counter_gte', 'A counter is at least']];
  const TRIGGERS = [['member_join', 'Someone joins'], ['member_leave', 'Someone leaves'], ['member_ban', 'Someone is banned'], ['ticket_create', 'A ticket is created'],
    ['settings_change', 'A server setting changes'], ['member_boost', 'Someone boosts the server'], ['voice_join', 'Someone joins a voice channel'], ['role_gained', 'Someone gets a role'], ['keyword', 'A message has a word or phrase'], ['interval', 'Every so often'], ['daily', 'Every day at a time'],
    ['message_sent', 'A message is sent'], ['message_edited', 'A message is edited'], ['message_deleted', 'A message is deleted'], ['reaction_added', 'A reaction is added'], ['reaction_removed', 'A reaction is removed'],
    ['member_unban', 'Someone is unbanned'], ['member_timeout', 'Someone is timed out'], ['role_lost', 'Someone loses a role'], ['nick_changed', 'Someone changes nickname'], ['member_unboost', 'Someone stops boosting'], ['bot_joined', 'A bot is added'],
    ['voice_leave', 'Someone leaves a voice channel'], ['voice_switch', 'Someone switches voice channel'], ['channel_created', 'A channel is created'], ['channel_deleted', 'A channel is deleted'], ['role_created', 'A role is created'], ['role_deleted', 'A role is deleted'],
    ['thread_created', 'A thread is created'], ['invite_created', 'An invite is created'], ['server_renamed', 'The server is renamed'], ['event_created', 'A server event is created'],
    ['application_submitted', 'An application is submitted'], ['application_accepted', 'An application is accepted'], ['application_denied', 'An application is denied'], ['appeal_accepted', 'A ban appeal is accepted'], ['appeal_denied', 'A ban appeal is denied'],
    ['warn_issued', 'Someone is warned'], ['level_up', 'Someone levels up'], ['ticket_closed', 'A ticket is closed'], ['giveaway_ended', 'A giveaway ends'], ['raid_detected', 'Anti Raid detects a raid'], ['betrayal_detected', 'Anti Betray detects a betrayal']];
  const TEXT_TRIGGERS = ['keyword', 'message_sent', 'message_edited', 'message_deleted'], EMOJI_TRIGGERS = ['reaction_added', 'reaction_removed'];
  const CHANNEL_TRIGGERS = ['message_sent', 'message_edited', 'message_deleted', 'reaction_added', 'reaction_removed', 'voice_join', 'voice_leave', 'voice_switch', 'keyword'], ROLE_TRIGGERS = ['role_gained', 'role_lost'];
  const HINTS = {
    member_join: '{user} is the new member.', member_leave: '{user} is the member who left.', member_ban: '{target} is the banned user.', ticket_create: '{user} opened {ticket}.', keyword: '{user} wrote the message, {text} is what they wrote.',
    role_gained: '{user} got the role {role}.', role_lost: '{user} lost the role {role}.', voice_join: '{user} joined {channel}.', voice_leave: '{user} left {channel}.', voice_switch: '{user} moved from {old} to {new} (now in {channel}).',
    member_boost: '{user} just boosted.', member_unboost: '{user} stopped boosting.', settings_change: '{setting}, {old} and {new} describe the change, {user} made it.',
    message_sent: '{user} wrote it in {channel}. {text} is the message and {message_link} jumps to it.', message_edited: '{user} edited it. {text} is the new text, {old} the old text.', message_deleted: '{user} wrote it. {text} is what it said.',
    reaction_added: '{user} reacted with {emoji} in {channel}. {message_link} jumps to the message.', reaction_removed: '{user} removed {emoji} in {channel}.',
    member_unban: '{target} was unbanned.', member_timeout: '{user} was timed out until {until}.', nick_changed: '{user} changed nickname from {old} to {new}.', bot_joined: '{user} is the bot that joined.',
    channel_created: '{channel} was created.', channel_deleted: '{name} was deleted.', role_created: '{role} was created.', role_deleted: '{role} was deleted.', thread_created: '{channel} is the new thread, {user} started it.',
    invite_created: '{user} made the invite {invite}.', server_renamed: 'The server was renamed from {old} to {new}.', event_created: '{name} is the new server event.',
    application_submitted: '{user} applied for {what}.', application_accepted: '{user} was accepted for {what} by {reviewer}.', application_denied: '{user} was denied for {what} by {reviewer}.',
    appeal_accepted: '{user} had their ban appeal accepted by {reviewer}.', appeal_denied: '{user} had their ban appeal denied by {reviewer}.', warn_issued: '{user} was warned by {target}. {reason} is why, case {case}.',
    level_up: '{user} reached level {level}.', ticket_closed: '{user} owned {ticket}, {reviewer} closed it.', giveaway_ended: '{prize} ended. {winners} won ({winner_count}).',
    raid_detected: 'Anti Raid opened incident {incident}. Great for pinging your staff.', betrayal_detected: 'Anti Betray opened incident {incident}. Great for pinging your staff.',
  };
  const GROUPS = [
    ['Messages', ['message', 'embed', 'image_card', 'poll', 'dm', 'announce_ping', 'add_reaction_to_trigger', 'reply_trigger', 'react_last', 'delete_trigger_message', 'pin_trigger_message']],
    ['Edit messages', ['edit_message', 'delete_message', 'pin', 'react', 'thread']],
    ['Memory & maths', ['set_var', 'pick', 'counter', 'math', 'random_number', 'text_tools']],
    ['Server', ['add_role', 'remove_role', 'toggle_role', 'create_role', 'create_channel', 'rename_channel', 'set_topic', 'lock_channel', 'unlock_channel', 'create_thread', 'purge', 'create_invite', 'set_nick', 'slowmode']],
    ['Voice', ['move_voice', 'disconnect_voice']],
    ['Moderation', ['kick', 'ban', 'unban', 'timeout', 'remove_timeout']],
    ['Rex', ['send_form', 'create_ticket', 'set_toggle', 'log']],
    ['Flow', ['wait', 'branch', 'stop']],
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
    stop: { i: '⛔', n: 'Stop here', d: 'Ends the flow. Nothing after this runs.', f: [] },
    toggle_role: { i: '🔁', n: 'Toggle a role', d: 'Give it if they lack it, take it if they have it.', f: [F('role', 'role', 'Role'), F('to', 'select', 'Whose', { o: WHO })] },
    remove_timeout: { i: '🔔', n: 'End a timeout', d: '', f: [F('to', 'select', 'Whose', { o: [['target', 'The picked user'], ['user', 'The person who ran it']] })] },
    lock_channel: { i: '🔒', n: 'Lock a channel', d: 'Stops everyone chatting there.', f: [F('channel', 'channel', 'Channel (empty = here)')] },
    unlock_channel: { i: '🔓', n: 'Unlock a channel', d: '', f: [F('channel', 'channel', 'Channel (empty = here)')] },
    rename_channel: { i: '🏷️', n: 'Rename a channel', d: '', f: [F('channel', 'channel', 'Channel (empty = here)'), F('name', 'text', 'New name', { vars: 1 })] },
    set_topic: { i: '📝', n: 'Set channel topic', d: '', f: [F('channel', 'channel', 'Channel (empty = here)'), F('text', 'area', 'Topic', { vars: 1 })] },
    purge: { i: '🧽', n: 'Clear messages', d: 'Deletes the latest messages (up to 100).', f: [F('channel', 'channel', 'Channel (empty = here)'), F('amount', 'num', 'How many', { min: 1, max: 100 })] },
    create_invite: { i: '🔗', n: 'Create an invite', d: 'Use it later as {var.name}.', f: [F('channel', 'channel', 'Channel (empty = here)'), F('name', 'text', 'Variable name'), F('hours', 'num', 'Lasts (hours)', { min: 1, max: 168 }), F('uses', 'num', 'Max uses (0 = any)', { min: 0, max: 100 })] },
    math: { i: '➗', n: 'Do maths', d: 'Works out a number into {var.name}.', f: [F('name', 'text', 'Variable name'), F('a', 'text', 'First number', { vars: 1 }), F('op', 'select', 'Operation', { o: [['add', 'plus'], ['subtract', 'minus'], ['multiply', 'times'], ['divide', 'divided by'], ['modulo', 'remainder of']] }), F('b', 'text', 'Second number', { vars: 1 })] },
    text_tools: { i: '🔤', n: 'Change text', d: 'Transforms text into {var.name}.', f: [F('name', 'text', 'Variable name'), F('value', 'text', 'Text', { vars: 1 }), F('op', 'select', 'Do', { o: [['upper', 'UPPERCASE'], ['lower', 'lowercase'], ['title', 'Title Case'], ['reverse', 'Reverse it'], ['length', 'Count the letters'], ['trim', 'Trim spaces']] })] },
    random_number: { i: '🎰', n: 'Random number', d: 'Into {var.name}.', f: [F('name', 'text', 'Variable name'), F('min', 'num', 'From', { min: -1000000, max: 1000000 }), F('max', 'num', 'To', { min: -1000000, max: 1000000 })] },
    move_voice: { i: '🎧', n: 'Move to voice channel', d: 'They must already be in voice.', f: [F('to', 'select', 'Who', { o: WHO }), F('channel', 'voicechan', 'Voice channel')] },
    disconnect_voice: { i: '📴', n: 'Disconnect from voice', d: '', f: [F('to', 'select', 'Who', { o: WHO })] },
    unban: { i: '🕊️', n: 'Unban', d: 'Needs a user ID.', f: [F('user_id', 'text', 'User ID', { vars: 1 }), F('reason', 'text', 'Reason')] },
    add_reaction_to_trigger: { i: '👀', n: 'React to the message', d: 'For the keyword event: reacts to the message that matched.', f: [F('emoji', 'text', 'Emoji')] },
    announce_ping: { i: '📣', n: 'Announce with a role ping', d: 'Pings one role you pick.', f: [F('channel', 'channel', 'Channel (empty = here)'), F('role', 'role', 'Role to ping'), F('text', 'area', 'Message', { vars: 1 })] },
    delete_trigger_message: { i: '🗑️', n: 'Delete the message', d: 'For the keyword event: deletes the message that matched.', f: [] },
    pin_trigger_message: { i: '📌', n: 'Pin the message', d: 'For the keyword event.', f: [] },
    reply_trigger: { i: '↩️', n: 'Reply to the message', d: 'For the keyword event: replies to the message that matched.', f: [F('text', 'area', 'Reply', { vars: 1 })] },
    create_thread: { i: '🧵', n: 'Start a thread', d: 'Its link is {var.thread}.', f: [F('channel', 'channel', 'Channel (empty = here)'), F('name', 'text', 'Thread name', { vars: 1 })] },
    react_last: { i: '😀', n: 'React to my last message', d: 'Adds a reaction to the message sent just before.', f: [F('emoji', 'text', 'Emoji')] },
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
    delete_trigger_message: {}, pin_trigger_message: {}, reply_trigger: { text: '' }, create_thread: { channel: '', name: '' }, react_last: { emoji: '👍' },
    stop: {}, toggle_role: { role: '', to: 'user' }, remove_timeout: { to: 'target' }, lock_channel: { channel: '' }, unlock_channel: { channel: '' }, rename_channel: { channel: '', name: '' }, set_topic: { channel: '', text: '' }, purge: { channel: '', amount: 10 }, create_invite: { channel: '', name: 'invite', hours: 24, uses: 1 }, math: { name: 'result', a: '', op: 'add', b: '' }, text_tools: { name: 'text', value: '', op: 'upper' }, random_number: { name: 'number', min: 1, max: 100 }, move_voice: { to: 'user', channel: '' }, disconnect_voice: { to: 'user' }, unban: { user_id: '', reason: '' }, add_reaction_to_trigger: { emoji: '👍' }, announce_ping: { channel: '', role: '', text: '' },
    pick: { name: '', options: ['', ''] }, counter: { name: '', scope: 'server', op: 'add', amount: 1 }, set_nick: { to: 'user', nick: '' }, slowmode: { channel: '', seconds: 5 },
  };
  /* ---------------------------------------------------------- 53 more blocks */
  const MINS = (l, o) => F('minutes', 'num', l || 'Minutes', Object.assign({ min: 1, max: 43200 }, o || {}));
  Object.assign(BLOCKS, {
    webhook_say: { i: '🎭', n: 'Say as someone', d: 'Posts with that person\'s name and picture.', f: [F('text', 'area', 'What they say', { vars: 1 }), F('as', 'select', 'Say it as', { o: WHO }), F('channel', 'channel', 'Channel (empty = here)')] },
    dm_embed: { i: '📨', n: 'DM an embed', d: 'A private styled card.', f: [F('title', 'text', 'Title', { vars: 1 }), F('description', 'area', 'Description', { vars: 1 }), F('color', 'color', 'Colour'), F('to', 'select', 'Send to', { o: WHO })] },
    bulk_react: { i: '🎉', n: 'Add several reactions', d: 'Up to 10 emojis on an earlier message.', f: [F('ref', 'ref', 'Which message'), F('emojis', 'text', 'Emojis (separated by spaces)')] },
    clear_reactions: { i: '🧼', n: 'Clear reactions', d: 'Removes every reaction from a message.', f: [F('ref', 'ref', 'Which message')] },
    unpin: { i: '📍', n: 'Unpin a message', d: '', f: [F('ref', 'ref', 'Which message')] },
    typing: { i: '⌨️', n: 'Show "typing…"', d: 'Rex looks like it is typing for a moment.', f: [F('seconds', 'num', 'Seconds', { min: 1, max: 10 })] },
    dm_owner: { i: '👑', n: 'DM the server owner', d: '', f: [F('text', 'area', 'Message', { vars: 1 })] },
    serverlog_post: { i: '🗂️', n: 'Write to server log', d: 'Posts in your Server log channel.', f: [F('title', 'text', 'Title', { vars: 1 }), F('text', 'area', 'Text', { vars: 1 })] },
    delete_channel: { i: '🗑️', n: 'Delete a channel', d: 'Careful: this is permanent.', f: [F('channel', 'channelreq', 'Channel')] },
    create_category: { i: '📂', n: 'Create a category', d: '', f: [F('name', 'text', 'Name', { vars: 1 }), F('private', 'check', 'Hidden from everyone except Rex')] },
    clone_channel: { i: '🧬', n: 'Duplicate a channel', d: 'Copies settings and permissions.', f: [F('channel', 'channel', 'Channel (empty = here)'), F('name', 'text', 'New name (optional)', { vars: 1 })] },
    move_channel: { i: '🚚', n: 'Move a channel', d: 'Into another category.', f: [F('channel', 'channel', 'Channel (empty = here)'), F('category', 'category', 'Move it to', { empty: 'Choose a category' })] },
    set_nsfw: { i: '🔞', n: 'Age-restrict a channel', d: '', f: [F('channel', 'channel', 'Channel (empty = here)'), F('mode', 'select', 'Do', { o: [['on', 'Turn on'], ['off', 'Turn off']] })] },
    hide_channel: { i: '🙈', n: 'Hide a channel', d: 'Hidden from @everyone.', f: [F('channel', 'channel', 'Channel (empty = here)')] },
    show_channel: { i: '👁️', n: 'Show a channel', d: 'Undo hiding for @everyone.', f: [F('channel', 'channel', 'Channel (empty = here)')] },
    close_thread: { i: '🧶', n: 'Close this thread', d: 'Only works when the flow runs inside a thread.', f: [F('lock', 'check', 'Also lock it')] },
    grant_channel_access: { i: '🔑', n: 'Give channel access', d: 'Lets one person see and write there.', f: [F('channel', 'channel', 'Channel (empty = here)'), F('to', 'select', 'Who', { o: WHO })] },
    revoke_channel_access: { i: '🚷', n: 'Remove channel access', d: 'Removes their special access.', f: [F('channel', 'channel', 'Channel (empty = here)'), F('to', 'select', 'Who', { o: WHO })] },
    lock_all_channels: { i: '🔐', n: 'Lock all channels', d: 'Lockdown: stops @everyone chatting (max 100).', f: [F('category', 'category', 'Only this category', { empty: 'Every channel' })] },
    unlock_all_channels: { i: '🔓', n: 'Unlock all channels', d: 'Ends a lockdown.', f: [F('category', 'category', 'Only this category', { empty: 'Every channel' })] },
    purge_member: { i: '🧹', n: 'Clear someone\'s messages', d: 'Deletes their latest messages in a channel.', f: [F('channel', 'channel', 'Channel (empty = here)'), F('to', 'select', 'Whose', { o: WHO }), F('amount', 'num', 'How many', { min: 1, max: 100 })] },
    delete_role: { i: '❌', n: 'Delete a role', d: '', f: [F('role', 'role', 'Role')] },
    rename_role: { i: '✏️', n: 'Rename a role', d: '', f: [F('role', 'role', 'Role'), F('name', 'text', 'New name', { vars: 1 })] },
    recolor_role: { i: '🎨', n: 'Recolour a role', d: '', f: [F('role', 'role', 'Role'), F('color', 'color', 'Colour')] },
    mass_role: { i: '👥', n: 'Give or take a role from a group', d: 'Everyone with one role (up to 200).', f: [F('from_role', 'role', 'Everyone who has'), F('mode', 'select', 'Do', { o: [['add', 'Give them'], ['remove', 'Take from them']] }), F('to_role', 'role', 'This role')] },
    temp_role: { i: '⏱️', n: 'Temporary role', d: 'Rex removes it later, even after a restart.', f: [F('role', 'role', 'Role'), F('to', 'select', 'Give it to', { o: WHO }), MINS('Keep it for (minutes)', { max: 10080 })] },
    rename_server: { i: '🏠', n: 'Rename the server', d: '', f: [F('name', 'text', 'New name', { vars: 1 })] },
    create_event: { i: '📅', n: 'Create a server event', d: 'Shows up in the Events tab.', f: [F('name', 'text', 'Event name', { vars: 1 }), F('minutes', 'num', 'Starts in (minutes)', { min: 5, max: 43200 }), F('duration', 'num', 'Lasts (minutes)', { min: 15, max: 1440 }), F('location', 'text', 'Where (text)')] },
    mute_voice: { i: '🔇', n: 'Server mute (voice)', d: 'They must be in a voice channel.', f: [F('to', 'select', 'Who', { o: WHO }), F('mode', 'select', 'Do', { o: [['on', 'Mute'], ['off', 'Unmute']] })] },
    deafen_voice: { i: '🙉', n: 'Server deafen (voice)', d: 'They must be in a voice channel.', f: [F('to', 'select', 'Who', { o: WHO }), F('mode', 'select', 'Do', { o: [['on', 'Deafen'], ['off', 'Undeafen']] })] },
    warn_member: { i: '⚠️', n: 'Warn someone', d: 'Adds a warning to their record.', f: [F('to', 'select', 'Who', { o: WHO }), F('reason', 'text', 'Reason', { vars: 1 })] },
    clear_warnings: { i: '🧾', n: 'Clear warnings', d: 'Removes all of their warnings.', f: [F('to', 'select', 'Who', { o: WHO })] },
    give_xp: { i: '⭐', n: 'Give XP', d: '', f: [F('to', 'select', 'Who', { o: WHO }), F('amount', 'num', 'Amount', { min: 1, max: 100000 })] },
    remove_xp: { i: '➖', n: 'Take XP', d: '', f: [F('to', 'select', 'Who', { o: WHO }), F('amount', 'num', 'Amount', { min: 1, max: 100000 })] },
    softban: { i: '🧨', n: 'Softban', d: 'Bans then unbans, deleting a day of their messages.', f: [F('to', 'select', 'Who', { o: WHO }), F('reason', 'text', 'Reason')] },
    temp_ban: { i: '⏳', n: 'Temporary ban', d: 'Rex unbans them later, even after a restart.', f: [F('to', 'select', 'Who', { o: WHO }), MINS('Ban for (minutes)'), F('reason', 'text', 'Reason')] },
    concat: { i: '➕', n: 'Join text', d: 'Into {var.name}.', f: [F('name', 'text', 'Variable name'), F('a', 'text', 'First text', { vars: 1 }), F('sep', 'text', 'Between them'), F('b', 'text', 'Second text', { vars: 1 })] },
    replace_text: { i: '🔁', n: 'Replace text', d: 'Into {var.name}.', f: [F('name', 'text', 'Variable name'), F('value', 'text', 'Text', { vars: 1 }), F('find', 'text', 'Find'), F('with', 'text', 'Replace with', { vars: 1 })] },
    slice_text: { i: '✂️', n: 'Take part of text', d: 'The first or last letters, into {var.name}.', f: [F('name', 'text', 'Variable name'), F('value', 'text', 'Text', { vars: 1 }), F('from', 'select', 'Take from', { o: [['start', 'The start'], ['end', 'The end']] }), F('count', 'num', 'How many letters', { min: 1, max: 500 })] },
    word_at: { i: '🔡', n: 'Pick a word', d: 'The 1st, 2nd... word, into {var.name}.', f: [F('name', 'text', 'Variable name'), F('value', 'text', 'Text', { vars: 1 }), F('n', 'num', 'Word number', { min: 1, max: 50 })] },
    math_more: { i: '🧮', n: 'More maths', d: 'Power, smallest, biggest, round and more.', f: [F('name', 'text', 'Variable name'), F('a', 'text', 'Number', { vars: 1 }), F('op', 'select', 'Do', { o: [['power', 'to the power of'], ['min', 'smaller of'], ['max', 'bigger of'], ['abs', 'absolute value'], ['round', 'round (second = decimals)'], ['floor', 'round down'], ['ceil', 'round up']] }), F('b', 'text', 'Second number', { vars: 1 })] },
    future_time: { i: '🕒', n: 'Time from now', d: 'A Discord time into {var.name}.', f: [F('name', 'text', 'Variable name'), F('minutes', 'num', 'Minutes from now', { min: 0, max: 525600 }), F('style', 'select', 'Shown as', { o: [['R', '"in 5 minutes"'], ['f', 'Date and time'], ['F', 'Long date and time'], ['t', 'Time only'], ['D', 'Date only']] })] },
    format_number: { i: '1️⃣', n: 'Format a number', d: '1234567 becomes 1,234,567.', f: [F('name', 'text', 'Variable name'), F('value', 'text', 'Number', { vars: 1 })] },
    roll_dice: { i: '🎲', n: 'Roll dice', d: 'The total into {var.name}.', f: [F('name', 'text', 'Variable name'), F('count', 'num', 'How many dice', { min: 1, max: 20 }), F('sides', 'num', 'Sides each', { min: 2, max: 1000 })] },
    random_member: { i: '🎯', n: 'Pick a random member', d: 'Their mention goes into {var.name}.', f: [F('name', 'text', 'Variable name'), F('role', 'role', 'From role', { empty: 'Everyone' }), F('bots', 'check', 'Allow bots')] },
    cooldown: { i: '🧊', n: 'Cooldown', d: 'Stops the flow if it ran too recently. Use {remaining} in the message.', f: [F('seconds', 'num', 'Wait (seconds)', { min: 1, max: 86400 }), F('scope', 'select', 'Per', { o: [['user', 'Person'], ['server', 'Whole server']] }), F('message', 'text', 'Message when too soon', { vars: 1 })] },
    gate_staff: { i: '🛡️', n: 'Only staff', d: 'Stops the flow for everyone else.', f: [F('message', 'text', 'Message for others (optional)', { vars: 1 })] },
    gate_role: { i: '🏷️', n: 'Only people with a role', d: 'Stops the flow for everyone else.', f: [F('role', 'role', 'Role'), F('message', 'text', 'Message for others (optional)', { vars: 1 })] },
    gate_channel: { i: '📍', n: 'Only in one channel', d: 'Stops the flow anywhere else.', f: [F('channel', 'channelreq', 'Channel'), F('message', 'text', 'Message elsewhere (optional)', { vars: 1 })] },
    gate_boost: { i: '💎', n: 'Only boosters', d: 'Stops the flow for non-boosters.', f: [F('message', 'text', 'Message for others (optional)', { vars: 1 })] },
    gate_account_age: { i: '📆', n: 'Only older accounts', d: 'Stops the flow for new accounts.', f: [F('days', 'num', 'Account at least (days old)', { min: 1, max: 3650 }), F('message', 'text', 'Message for new accounts (optional)', { vars: 1 })] },
    gate_chance: { i: '🎰', n: 'Random chance', d: 'Only continues some of the time.', f: [F('percent', 'num', 'Chance to continue (%)', { min: 1, max: 99 })] },
    gate_has_text: { i: '✍️', n: 'Only if text was typed', d: 'Stops the flow if no text was given.', f: [F('message', 'text', 'Message (optional)', { vars: 1 })] },
  });
  Object.assign(DEF, {
    webhook_say: { text: '', as: 'user', channel: '' }, dm_embed: { title: '', description: '', color: '', to: 'user' }, bulk_react: { ref: 'last', emojis: '👍 🎉' }, clear_reactions: { ref: 'last' }, unpin: { ref: 'last' },
    typing: { seconds: 3 }, dm_owner: { text: '' }, serverlog_post: { title: '', text: '' }, delete_channel: { channel: '' }, create_category: { name: '', private: false }, clone_channel: { channel: '', name: '' },
    move_channel: { channel: '', category: '' }, set_nsfw: { channel: '', mode: 'on' }, hide_channel: { channel: '' }, show_channel: { channel: '' }, close_thread: { lock: false },
    grant_channel_access: { channel: '', to: 'user' }, revoke_channel_access: { channel: '', to: 'user' }, lock_all_channels: { category: '' }, unlock_all_channels: { category: '' },
    purge_member: { channel: '', to: 'target', amount: 20 }, delete_role: { role: '' }, rename_role: { role: '', name: '' }, recolor_role: { role: '', color: '' },
    mass_role: { from_role: '', to_role: '', mode: 'add' }, temp_role: { role: '', to: 'user', minutes: 60 }, rename_server: { name: '' }, create_event: { name: '', minutes: 60, duration: 60, location: '' },
    mute_voice: { to: 'user', mode: 'on' }, deafen_voice: { to: 'user', mode: 'on' }, warn_member: { to: 'target', reason: '' }, clear_warnings: { to: 'target' }, give_xp: { to: 'user', amount: 100 },
    remove_xp: { to: 'user', amount: 100 }, softban: { to: 'target', reason: '' }, temp_ban: { to: 'target', minutes: 60, reason: '' }, concat: { name: 'joined', a: '', sep: ' ', b: '' },
    replace_text: { name: 'text', value: '', find: '', with: '' }, slice_text: { name: 'text', value: '', from: 'start', count: 10 }, word_at: { name: 'word', value: '', n: 1 },
    math_more: { name: 'result', a: '', op: 'power', b: '' }, future_time: { name: 'when', minutes: 60, style: 'R' }, format_number: { name: 'number', value: '' }, roll_dice: { name: 'roll', count: 1, sides: 6 },
    random_member: { name: 'winner', role: '', bots: false }, cooldown: { seconds: 30, scope: 'user', message: 'Slow down! Try again in {remaining} seconds.' }, gate_staff: { message: '' },
    gate_role: { role: '', message: '' }, gate_channel: { channel: '', message: '' }, gate_boost: { message: '' }, gate_account_age: { days: 7, message: '' }, gate_chance: { percent: 50 }, gate_has_text: { message: '' },
  });
  GROUPS.push(
    ['More messages', ['webhook_say', 'dm_embed', 'bulk_react', 'clear_reactions', 'unpin', 'typing', 'dm_owner', 'serverlog_post']],
    ['Channels', ['delete_channel', 'create_category', 'clone_channel', 'move_channel', 'set_nsfw', 'hide_channel', 'show_channel', 'close_thread', 'grant_channel_access', 'revoke_channel_access', 'lock_all_channels', 'unlock_all_channels', 'purge_member']],
    ['Roles & server', ['delete_role', 'rename_role', 'recolor_role', 'mass_role', 'temp_role', 'rename_server', 'create_event']],
    ['People', ['mute_voice', 'deafen_voice', 'warn_member', 'clear_warnings', 'give_xp', 'remove_xp', 'softban', 'temp_ban', 'random_member']],
    ['Text & numbers', ['concat', 'replace_text', 'slice_text', 'word_at', 'math_more', 'future_time', 'format_number', 'roll_dice']],
    ['Gates: stop unless…', ['cooldown', 'gate_staff', 'gate_role', 'gate_channel', 'gate_boost', 'gate_account_age', 'gate_chance', 'gate_has_text']],
  );
  const EMOJIS = ["ok", "no", "warn", "info", "shield", "shield_alert", "gem", "star", "lock", "unlock", "ticket", "crown", "hourglass", "bot", "note", "chart", "party", "tools", "trophy", "clipboard", "sparkles", "users", "user", "trash", "link", "gift", "broom", "scale", "gavel", "mail", "message", "bulb", "scroll", "heart", "coins", "scissors", "globe", "hash", "plus", "folder", "ban", "settings", "masks", "palette", "bug", "rocket", "kick", "thumbs", "megaphone", "mute", "gamepad", "tv", "boom", "help", "home", "pin", "book", "grid", "search", "pencil", "repeat", "clock", "zap", "flag", "bell", "image", "tag", "calendar", "dice", "compass", "calc", "toolbox", "dot_green", "dot_red", "dot_yellow"];
  const uid = () => Math.random().toString(36).slice(2, 10);
  const clone = (x) => JSON.parse(JSON.stringify(x));

  function emojiButton(getEl) {
    let pop = null;
    const btn = h('button', { type: 'button', class: 'bld-info bld-emo', title: 'Add a Rex emoji', 'aria-label': 'Add a Rex emoji', onclick: (e) => {
      e.stopPropagation();
      if (pop) { pop.remove(); pop = null; return; }
      pop = h('div', { class: 'bld-pop emo-pop' }, h('b', {}, 'Rex emojis'), h('div', { class: 'muted small' }, 'Tap one to put its code in the text. Rex shows the picture in Discord. If this server turned Rex emojis off, the regular emoji shows instead.'),
        h('div', { class: 'emo-grid' }, EMOJIS.map((n) => h('button', { type: 'button', title: ':rex_' + n + ':', 'aria-label': n.replace(/_/g, ' '), onclick: () => {
          const el = getEl(); if (!el) return;
          const code = ':rex_' + n + ':'; const a = el.selectionStart == null ? el.value.length : el.selectionStart, b = el.selectionEnd == null ? a : el.selectionEnd;
          el.value = el.value.slice(0, a) + code + el.value.slice(b); el.selectionStart = el.selectionEnd = a + code.length; el.dispatchEvent(new Event('input', { bubbles: true })); el.focus();
        } }, h('img', { src: '/img/emoji/rexf_' + n + '.svg', alt: '', width: 24, height: 24, draggable: 'false' })))));
      btn.parentNode.append(pop);
      setTimeout(() => document.addEventListener('click', function f(ev) { if (pop && !pop.contains(ev.target)) { pop.remove(); pop = null; } document.removeEventListener('click', f); }), 0);
    } }, '☺');
    return h('span', { class: 'bld-infowrap' }, btn);
  }

  window.RexEmojiPicker = { button: emojiButton };

  function mount(o) {
    const { spec, draft, set, guild, locked, errors, ticketTypes } = o;
    const isCmd = spec.kind !== 'event';
    const unlimited = o.unlimited, limit = unlimited ? 50 : 5;
    let list = clone(Array.isArray(draft[spec.key]) ? draft[spec.key] : []);
    let editing = null;      // index of the flow being edited
    const root = h('div', { class: 'bld' });
    const dis = locked ? true : null;
    const isOn = (c) => (c.draft_error != null ? c.want_on !== false : c.enabled !== false);
    const commit = () => {
      list.forEach((c) => { if (c.draft_error != null) { c.enabled = c.want_on !== false; delete c.draft_error; } });
      set(spec.key, clone(list));
    };
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
        case 'voicechan': el = h('select', { disabled: dis, onchange: (e) => set1(e.target.value) }, h('option', { value: '' }, 'Choose a voice channel'), guild.channels.filter((c) => c.type === 'voice' || c.type === 'stage').map((c) => h('option', { value: c.id }, c.name))); el.value = v || ''; break;
        case 'category': el = h('select', { disabled: dis, onchange: (e) => set1(e.target.value) }, h('option', { value: '' }, f.empty || 'No category'), cats.map((c) => h('option', { value: c.id }, c.name))); el.value = v || ''; break;
        case 'channelreq': el = h('select', { disabled: dis, onchange: (e) => set1(e.target.value) }, h('option', { value: '' }, 'Choose a channel'), textChans.map((c) => h('option', { value: c.id }, '#' + c.name))); el.value = v || ''; break;
        case 'role': el = h('select', { disabled: dis, onchange: (e) => set1(e.target.value) }, h('option', { value: '' }, f.empty || 'Choose a role'), roles.map((r) => h('option', { value: r.id }, r.name))); el.value = v || ''; break;
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
      return h('label', { class: 'bld-f' }, h('span', { class: 'bld-fl' }, f.l, f.vars ? varsButton() : null, f.vars && (f.t === 'text' || f.t === 'area') ? emojiButton(() => el) : null), el);
    }

    function cardFor(blocks, b, i, rerender, depth, free) {
        const def = BLOCKS[b.type];
        const card = h('div', { class: 'bld-card t-' + b.type },
          h('div', { class: 'bld-ch' }, free ? h('span', { class: 'sb-grip', 'aria-hidden': 'true', title: 'Drag to move' }, '⠿') : null, h('span', { class: 'bld-ic' }, def.i), h('b', {}, def.n),
            h('span', { class: 'grow' }),
            free ? null : h('button', { type: 'button', class: 'bld-mini', disabled: dis || i === 0 ? true : null, 'aria-label': 'Move up', onclick: () => { blocks.splice(i - 1, 0, blocks.splice(i, 1)[0]); commit(); rerender(); } }, '↑'),
            free ? null : h('button', { type: 'button', class: 'bld-mini', disabled: dis || i === blocks.length - 1 ? true : null, 'aria-label': 'Move down', onclick: () => { blocks.splice(i + 1, 0, blocks.splice(i, 1)[0]); commit(); rerender(); } }, '↓'),
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
            if (c.kind === 'weekday_is') return field(c, F('value', 'select', 'Day', { o: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((d) => [d, d[0].toUpperCase() + d.slice(1)]) }), rerender);
            if (c.kind === 'member_count_gte') return field(c, F('value', 'num', 'Members', { min: 1, max: 10000000 }), rerender);
            if (c.kind === 'var_gte') return field(c, F('value', 'text', 'Check, like  score >= 10'), rerender);
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
      return card;
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
        col.append(cardFor(blocks, b, i, rerender, depth, false), adder(i + 1));
      });
      return col;
    }


    /* ---------------------------------------------------------- Studio board: free dragging, wires, zoom */
    const view = { x: 40, y: 40, z: 1 };
    let sbTab = 'blocks';
    function board(c, rerender, metaEl) {
      const blocks = c.blocks;
      const NW = 400, GAP = 70;
      const world = h('div', { class: 'sb-world' });
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'sb-wires'); svg.setAttribute('width', '8000'); svg.setAttribute('height', '8000');
      const vp = h('div', { class: 'sb-view', tabindex: '0', 'aria-label': 'Canvas. Drag the background to move around, scroll or pinch to zoom.' }, world);
      const startEl = h('div', { class: 'bld-node start sb-fixed' }, isCmd ? '▶ Someone runs /' + (c.name || 'command') : '▶ ' + (TRIGGERS.find((t) => t[0] === c.trigger) || ['', 'Event'])[1]);
      const endEl = h('div', { class: 'bld-node end sb-fixed' }, '■ Finished');
      const els = [];
      world.append(svg, startEl, endEl);
      const apply = () => { world.style.transform = 'translate(' + view.x + 'px,' + view.y + 'px) scale(' + view.z + ')'; zoomLbl.textContent = Math.round(view.z * 100) + '%'; vp.style.backgroundSize = (28 * view.z) + 'px ' + (28 * view.z) + 'px'; vp.style.backgroundPosition = view.x + 'px ' + view.y + 'px'; };
      const zoomAt = (nz, cx, cy) => { nz = Math.max(0.25, Math.min(2, nz)); const k = nz / view.z; view.x = cx - (cx - view.x) * k; view.y = cy - (cy - view.y) * k; view.z = nz; apply(); };
      const centre = () => { const r = vp.getBoundingClientRect(); return [r.width / 2, r.height / 2]; };
      const zoomLbl = h('span', { class: 'sb-zl' }, '100%');

      /* positions: blocks without x/y are stacked under each other */
      function place() {
        let y = 100;
        blocks.forEach((b, i) => {
          const el = els[i]; if (!el) return;
          if (typeof b.x !== 'number' || typeof b.y !== 'number') { b.x = 0; b.y = y; }
          el.style.left = b.x + 'px'; el.style.top = b.y + 'px';
          y = Math.max(y, b.y + el.offsetHeight + GAP);
        });
        const bottom = blocks.reduce((m, b, i) => Math.max(m, b.y + (els[i] ? els[i].offsetHeight : 120)), 60);
        const first = blocks[0];
        startEl.style.left = (first ? first.x : 0) + 'px'; startEl.style.top = (first ? Math.min(first.y - 80, 0) : 0) + 'px';
        if (first && first.y - 80 < 0) { /* keep start above the first block */ startEl.style.top = (first.y - 80) + 'px'; }
        endEl.style.left = (blocks.length ? blocks[blocks.length - 1].x : 0) + 'px'; endEl.style.top = (bottom + GAP) + 'px';
        wires();
      }
      function wires() {
        const pts = [], boxOf = (el) => ({ x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight });
        const chain = [startEl, ...els.filter(Boolean), endEl];
        svg.replaceChildren();
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        defs.innerHTML = '<marker id="sbA" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="currentColor"/></marker>';
        svg.append(defs);
        for (let i = 0; i < chain.length - 1; i++) {
          const a = boxOf(chain[i]), b = boxOf(chain[i + 1]);
          const x1 = a.x + a.w / 2, y1 = a.y + a.h, x2 = b.x + b.w / 2, y2 = b.y;
          const dy = Math.max(40, Math.abs(y2 - y1) / 2);
          const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          path.setAttribute('d', 'M' + x1 + ',' + y1 + ' C' + x1 + ',' + (y1 + dy) + ' ' + x2 + ',' + (y2 - dy) + ' ' + x2 + ',' + (y2 - 6));
          path.setAttribute('class', 'sb-wire'); path.setAttribute('marker-end', 'url(#sbA)');
          svg.append(path);
        }
      }
      const reveal = (el) => { const r = vp.getBoundingClientRect(); view.x = r.width / 2 - (el.offsetLeft + el.offsetWidth / 2) * view.z; view.y = Math.max(20, r.height * 0.18 - el.offsetTop * view.z); apply(); };
      const fit = () => {
        const all = [startEl, ...els.filter(Boolean), endEl]; const r = vp.getBoundingClientRect();
        let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
        all.forEach((e) => { x0 = Math.min(x0, e.offsetLeft); y0 = Math.min(y0, e.offsetTop); x1 = Math.max(x1, e.offsetLeft + e.offsetWidth); y1 = Math.max(y1, e.offsetTop + e.offsetHeight); });
        const z = Math.max(0.25, Math.min(1, Math.min((r.width - 80) / (x1 - x0), (r.height - 80) / (y1 - y0))));
        view.z = z; view.x = (r.width - (x1 - x0) * z) / 2 - x0 * z; view.y = 40 - y0 * z; apply();
      };
      const tidy = () => { blocks.forEach((b) => { b.x = 0; delete b.y; }); let y = 100; blocks.forEach((b, i) => { b.y = y; y += (els[i] ? els[i].offsetHeight : 160) + GAP; }); commit(); rerender(); };

      /* block cards as nodes */
      blocks.forEach((b, i) => {
        const wide = b.type === 'branch';
        const node = h('div', { class: 'sb-node' + (wide ? ' wide' : ''), 'data-i': String(i) }, cardFor(blocks, b, i, rerender, 0, true));
        node.style.width = (wide ? 640 : NW) + 'px';
        els[i] = node; world.append(node);
        const head = node.querySelector('.bld-ch');
        head.addEventListener('pointerdown', (e) => {
          if (e.button > 0 || e.target.closest('button,input,select,textarea') || locked) return;
          e.preventDefault(); e.stopPropagation();
          head.setPointerCapture(e.pointerId);
          const sx = e.clientX, sy = e.clientY, ox = b.x, oy = b.y; let moved = false;
          node.classList.add('drag');
          const mv = (ev) => { const dx = (ev.clientX - sx) / view.z, dy = (ev.clientY - sy) / view.z; if (Math.abs(dx) + Math.abs(dy) > 2) moved = true; b.x = Math.round(ox + dx); b.y = Math.round(oy + dy); node.style.left = b.x + 'px'; node.style.top = b.y + 'px'; wires(); };
          const up = () => {
            head.removeEventListener('pointermove', mv); head.removeEventListener('pointerup', up); head.removeEventListener('pointercancel', up);
            node.classList.remove('drag');
            if (!moved) return;
            const before = blocks.map((x) => x.id).join();
            blocks.sort((p, q) => (p.y - q.y) || (p.x - q.x));
            commit();
            if (before !== blocks.map((x) => x.id).join()) rerender(); else place();
          };
          head.addEventListener('pointermove', mv); head.addEventListener('pointerup', up); head.addEventListener('pointercancel', up);
        });
      });

      /* pan + pinch */
      const ptrs = new Map(); let pan = null, pinch = null;
      vp.addEventListener('pointerdown', (e) => {
        if (e.target.closest('.sb-node') || e.target.closest('.bld-node')) return;
        vp.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, [e.clientX, e.clientY]);
        if (ptrs.size === 1) pan = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
        if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), z: view.z }; pan = null; }
        vp.classList.add('panning');
      });
      vp.addEventListener('pointermove', (e) => {
        if (!ptrs.has(e.pointerId)) return; ptrs.set(e.pointerId, [e.clientX, e.clientY]);
        if (pinch && ptrs.size >= 2) { const [a, b] = [...ptrs.values()]; const r = vp.getBoundingClientRect(); zoomAt(pinch.z * Math.hypot(a[0] - b[0], a[1] - b[1]) / pinch.d, (a[0] + b[0]) / 2 - r.left, (a[1] + b[1]) / 2 - r.top); }
        else if (pan) { view.x = pan.vx + e.clientX - pan.x; view.y = pan.vy + e.clientY - pan.y; apply(); }
      });
      const endp = (e) => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null; if (!ptrs.size) { pan = null; vp.classList.remove('panning'); } else if (ptrs.size === 1) { const [p] = [...ptrs.values()]; pan = { x: p[0], y: p[1], vx: view.x, vy: view.y }; } };
      vp.addEventListener('pointerup', endp); vp.addEventListener('pointercancel', endp);
      vp.addEventListener('wheel', (e) => { if (e.target.closest('textarea,select') && !e.ctrlKey) return; e.preventDefault(); const r = vp.getBoundingClientRect(); zoomAt(view.z * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)), e.clientX - r.left, e.clientY - r.top); }, { passive: false });
      vp.addEventListener('keydown', (e) => { if (e.target !== vp) return; const st = 60; if (e.key === 'ArrowLeft') view.x += st; else if (e.key === 'ArrowRight') view.x -= st; else if (e.key === 'ArrowUp') view.y += st; else if (e.key === 'ArrowDown') view.y -= st; else if (e.key === '+' || e.key === '=') { const [cx, cy] = centre(); return zoomAt(view.z * 1.2, cx, cy); } else if (e.key === '-') { const [cx, cy] = centre(); return zoomAt(view.z / 1.2, cx, cy); } else return; e.preventDefault(); apply(); });

      /* adding blocks */
      const addBlock = (t) => {
        if (locked) return;
        const nb = Object.assign({ type: t }, clone(DEF[t]));
        const lowest = blocks.reduce((m, b, i) => Math.max(m, b.y + (els[i] ? els[i].offsetHeight : 140)), 20);
        if (t === 'send_form') { nb.x = blocks.length ? blocks[0].x : 0; nb.y = (blocks.length ? Math.min(...blocks.map((b) => b.y)) : 100) - 220; blocks.unshift(nb); }
        else { nb.x = blocks.length ? blocks[blocks.length - 1].x : 0; nb.y = blocks.length ? lowest + GAP : 100; blocks.push(nb); }
        commit(); rerender(); setTimeout(() => { const n = world.querySelectorAll('.sb-node'); const el = [...n].find((x) => +x.dataset.i === blocks.indexOf(nb)); if (el) reveal(el); }, 30);
      };
      const side = h('aside', { class: 'sb-side' },
        h('div', { class: 'sb-tabs', role: 'tablist' }, [['blocks', 'Blocks'], ['settings', isCmd ? 'Command' : 'Event']].map(([k, l]) => h('button', { type: 'button', role: 'tab', 'aria-selected': String(sbTab === k), onclick: () => { sbTab = k; rerender(); } }, l))),
        sbTab === 'settings' ? h('div', { class: 'sb-pane' }, metaEl) : paletteEl(addBlock, blocks, c));
      const bar = h('div', { class: 'sb-bar' },
        h('button', { type: 'button', class: 'btn ghost sm', onclick: () => { editing = null; paint(); } }, '← All ' + (isCmd ? 'commands' : 'events')), h('b', { class: 'sb-title' }, isCmd ? '/' + (c.name || 'new-command') : (c.name || 'New event')),
        h('button', { type: 'button', class: 'btn ghost sm', 'aria-label': 'Zoom out', onclick: () => { const [cx, cy] = centre(); zoomAt(view.z / 1.2, cx, cy); } }, '−'), zoomLbl,
        h('button', { type: 'button', class: 'btn ghost sm', 'aria-label': 'Zoom in', onclick: () => { const [cx, cy] = centre(); zoomAt(view.z * 1.2, cx, cy); } }, '+'),
        h('button', { type: 'button', class: 'btn ghost sm', onclick: fit }, 'Fit all'), h('button', { type: 'button', class: 'btn ghost sm', onclick: () => { view.z = 1; view.x = 40; view.y = 40; apply(); } }, '100%'),
        h('button', { type: 'button', class: 'btn ghost sm', disabled: dis, onclick: tidy }, 'Tidy up'),
        h('span', { class: 'grow' }), h('span', { class: 'muted small sb-hint' }, 'Blocks run top to bottom. Drag a block by its title, drag the background to move around, scroll or pinch to zoom.'));
      const wrap = h('div', { class: 'sb' }, side, h('div', { class: 'sb-main' }, bar, vp));
      requestAnimationFrame(() => { place(); apply(); if (!board.seen) { board.seen = true; view.z = 0.85; view.x = Math.max(20, (vp.clientWidth - NW * 0.85) / 2); view.y = 30; apply(); } });
      try { const ro = new ResizeObserver(() => wires()); els.forEach((e) => e && ro.observe(e)); } catch (er) { /* older browsers: wires update on the next move */ }
      return wrap;
    }
    function paletteEl(addBlock, blocks, c) {
      const q = h('input', { type: 'search', placeholder: 'Search blocks…', 'aria-label': 'Search blocks' });
      const list = h('div', { class: 'sb-pal' });
      const paint = () => {
        const t = q.value.trim().toLowerCase();
        list.replaceChildren(...GROUPS.map(([g, types]) => {
          const ok = types.filter((k) => !(k === 'send_form' && (!isCmd || blocks.some((b) => b.type === 'send_form'))) && (!t || (BLOCKS[k].n + ' ' + BLOCKS[k].d + ' ' + g).toLowerCase().includes(t)));
          if (!ok.length) return null;
          return h('div', {}, h('div', { class: 'bld-pg' }, g), ok.map((k) => h('button', { type: 'button', class: 'sb-pi', disabled: dis, onclick: () => addBlock(k) }, h('span', {}, BLOCKS[k].i), h('b', {}, BLOCKS[k].n), h('em', {}, BLOCKS[k].d))));
        }));
        if (!list.children.length) list.append(h('p', { class: 'muted small' }, 'No block matches that.'));
      };
      q.addEventListener('input', paint); paint();
      return h('div', { class: 'sb-pane' }, q, h('p', { class: 'muted small' }, 'Tap a block to add it. Then drag it where you want.'), list);
    }

    /* ---------------------------------------------------------- list view */
    window.addEventListener('rex-sync', () => {
      try {
        const src = Array.isArray(draft[spec.key]) ? draft[spec.key] : [];
        let changed = false;
        list.forEach((c) => { const m = src.find((x) => x.id === c.id); if (m && m.draft_error != null && c.draft_error == null) { c.draft_error = m.draft_error; c.want_on = m.want_on; c.enabled = m.enabled; changed = true; } });
        if (changed && editing === null) paint();
      } catch (er) { /* ignore */ }
    });
    function listView() {
      const grid = h('div', { class: 'bld-grid' });
      list.forEach((c, i) => {
        grid.append(h('div', { class: 'bld-tile' + (!isOn(c) || c.draft_error != null ? ' off' : '') },
          h('div', { class: 'bld-th' }, h('b', {}, isCmd ? '/' + c.name : c.name), h('button', { type: 'button', class: 'rocker', role: 'switch', 'aria-checked': String(isOn(c)), disabled: dis, 'aria-label': 'Enabled',
            onclick: (e) => { const on = !isOn(c); c.enabled = on; c.want_on = on; delete c.draft_error; e.currentTarget.setAttribute('aria-checked', String(on)); const t = e.currentTarget.closest('.bld-tile'); t.classList.toggle('off', !on); const b = t.querySelector('.bld-draft'); if (b) b.remove(); commit(); } })),
          c.draft_error != null ? h('div', { class: 'bld-draft small', style: 'color:#e0a030;margin:4px 0' }, 'Saved as a draft and switched off: ' + (c.draft_error || 'unfinished block')) : null,
          h('div', { class: 'muted small bld-td' }, isCmd ? c.description : (TRIGGERS.find((t) => t[0] === c.trigger) || [0, c.trigger])[1]),
          h('div', { class: 'bld-tf' }, h('span', { class: 'chip' }, (c.blocks || []).length + ' block' + ((c.blocks || []).length === 1 ? '' : 's')),
            isCmd ? h('span', { class: 'chip' }, c.visibility && c.visibility.mode === 'staff' ? 'Staff only' : c.visibility && c.visibility.mode === 'roles' ? 'Some roles' : 'Everyone') : null,
            h('span', { class: 'grow' }),
            h('button', { type: 'button', class: 'btn ghost sm', onclick: () => { editing = i; board.seen = false; paint(); } }, locked ? 'View' : 'Edit'),
            h('button', { type: 'button', class: 'btn ghost sm', disabled: dis, 'aria-label': 'Delete', onclick: async () => { if (!(await rexDialog.confirm('Delete ' + (isCmd ? '/' + c.name : c.name) + '?', 'This removes it from your server. You can build it again later.', 'Delete', true))) return; list.splice(i, 1); commit(); paint(); } }, '🗑'))));
      });
      const full = list.length >= limit;
      grid.append(h('button', { type: 'button', class: 'bld-new', disabled: locked || full ? true : null, onclick: () => {
        list.push(isCmd ? { id: uid(), name: '', description: '', enabled: true, visibility: { mode: 'everyone', roles: [] }, options: { user: false, text: false }, ephemeral: false, blocks: [] }
          : { id: uid(), name: '', trigger: 'member_join', enabled: true, every_minutes: 60, at: '18:00', keyword: '', blocks: [] });
        editing = list.length - 1; board.seen = false; commit(); paint(); } },
        h('span', { class: 'bld-nplus' }, '+'), h('b', {}, isCmd ? 'Build a new command' : 'Build a new event'), h('span', { class: 'muted small' }, full ? (unlimited ? 'You reached the maximum.' : 'Premium allows 5. Ultra or Priority removes the limit.') : 'Start with a blank canvas')));
      return h('div', {},
        h('div', { class: 'bld-top' }, h('h3', {}, isCmd ? 'Active commands' : 'Active events'), h('span', { class: 'chip' }, list.length + ' / ' + (unlimited ? '∞' : limit))), grid,
        list.length === 0 ? h('p', { class: 'muted small' }, isCmd ? 'You have no custom commands yet. Build one and it appears as a slash command in your server a few seconds after you save.' : 'No events yet. Events run by themselves when something happens in your server.') : null);
    }

    /* ---------------------------------------------------------- editor */
    /* ------------------------------------------------------ dry run (test button) */
    const SENDERS = ['message', 'embed', 'image_card', 'poll', 'announce_ping', 'send_form'];
    const NO_CHANNEL = ['member_join', 'member_leave', 'member_ban', 'member_unban', 'member_timeout', 'nick_changed', 'role_gained', 'role_lost', 'role_created', 'role_deleted', 'server_renamed', 'event_created', 'interval', 'daily', 'level_up', 'warn_issued', 'application_submitted', 'application_accepted', 'application_denied', 'appeal_accepted', 'appeal_denied', 'giveaway_ended', 'raid_detected', 'betrayal_detected', 'invite_created', 'bot_joined', 'channel_deleted'];
    const GONE = ['member_leave', 'member_ban'];
    const HARM = ['kick', 'ban', 'timeout', 'unban', 'purge', 'delete_channel'];
    function dryRun(c) {
      const out = [];
      const add = (level, title, msg) => out.push({ level, title, msg });
      const chanById = Object.fromEntries(guild.channels.map((x) => [x.id, x]));
      const roleById = Object.fromEntries(guild.roles.map((x) => [x.id, x]));
      const known = new Set(VARS.map(([v]) => v.slice(1, -1)));
      const labels = []; const setVars = new Set(); let sentAny = false; let replies = false;
      const usedRoles = [];
      add('ok', 'Start', isCmd ? 'Someone runs /' + (c.name || '…') : 'When: ' + (TRIGGERS.find((t) => t[0] === c.trigger) || ['', c.trigger])[1]);
      if (isCmd) {
        if (!c.name) add('error', 'Command name', 'Give the command a name (for example "hello").');
        else if (list.filter((x) => x.name === c.name).length > 1) add('error', 'Command name', '/' + c.name + ' is used by another command here. Names must be different.');
        if (!c.description) add('error', 'Description', 'Discord needs a short description for every command.');
        if (c.visibility && c.visibility.mode === 'roles' && !(c.visibility.roles || []).length) add('error', 'Who can use it', 'You picked "Only certain roles" but no roles are chosen, so nobody could use it.');
      } else {
        if (!c.name) add('warn', 'Event name', 'No name set. It will still work, but a name helps you find it later.');
        if (c.trigger === 'interval' && (c.every_minutes || 60) < 15) add('warn', 'Timing', 'Runs every ' + c.every_minutes + ' minutes. Are you sure you meant that often? It can look like spam.');
        if (c.filter_channel && !chanById[c.filter_channel]) add('error', 'Channel filter', 'The channel this event is limited to was deleted.');
        if (c.filter_role && !roleById[c.filter_role]) add('error', 'Role filter', 'The role this event is limited to was deleted.');
      }
      if (!(c.blocks || []).length) { add('error', 'Blocks', 'There is nothing in this ' + (isCmd ? 'command' : 'event') + ' yet. Add a block first.'); return out; }
      const chk = (txt, title) => {
        String(txt || '').replace(/\{([a-z_][a-z0-9_.]*)\}/gi, (m, name) => {
          const n = name.toLowerCase();
          if (/^(var|counter|ucount)\./.test(n)) { if (n.startsWith('var.') && !setVars.has(n.slice(4))) add('warn', title, m + ' is used, but nothing before it sets that variable. It will be empty.'); return m; }
          if (/^answer\.[1-5]$/.test(n)) { if (!isCmd) add('warn', title, m + ' only works in commands with a form.'); return m; }
          if (!known.has(n)) { add('warn', title, m + " isn't a variable Rex knows. Did you spell it right? It will show as plain text."); return m; }
          if (!isCmd && (n === 'text')) add('warn', title, m + ' only works in commands where people type text.');
          if (isCmd && n.startsWith('target') && !(c.options && c.options.user)) add('warn', title, m + ' needs "Let people pick a user" switched on for this command.');
          return m;
        });
        if (/@(everyone|here)/.test(String(txt || ''))) add('warn', title, 'This pings @everyone / @here. Are you sure?');
      };
      const walk = (blocks, depth, gated) => {
        let stopped = false;
        (blocks || []).forEach((b, i) => {
          const spec = BLOCKS[b.type];
          const title = spec ? spec.i + ' ' + spec.n : '❓ ' + b.type;
          const startRows = out.length;
          if (stopped) { add('warn', title, 'This block is after a "Stop" block, so it will never run.'); }
          if (!spec) { add('error', title, 'Rex does not know this block. It will be skipped.'); return; }
          let bad = 0;
          const err = (m) => { bad++; add('error', title, m); };
          const wrn = (m) => add('warn', title, m);
          (spec.f || []).forEach((f) => {
            const v = b[f.k];
            const empty = v === undefined || v === null || v === '';
            if (f.t === 'channelreq' || f.t === 'voicechan') {
              if (empty) return err('Choose a ' + (f.t === 'voicechan' ? 'voice ' : '') + 'channel.');
              const ch = chanById[v];
              if (!ch) return err('That channel was deleted. Pick another.');
              if (ch.usable === false) return err('Rex can’t use #' + ch.name + '. Give Rex access to it.');
            } else if (f.t === 'channel') {
              if (!empty) { const ch = chanById[v]; if (!ch) return err('That channel was deleted. Pick another.'); if (ch.usable === false) return err('Rex can’t send in #' + ch.name + '.'); }
              else if (!isCmd && NO_CHANNEL.includes(c.trigger) && SENDERS.includes(b.type)) wrn('There is no channel to reply in for this event. Pick a channel in this block or nothing will be posted.');
            } else if (f.t === 'category') {
              if (!empty && !chanById[v]) err('That category was deleted.');
            } else if (f.t === 'role') {
              if (empty) { if (!f.empty) err('Choose a role.'); return; }
              const r = roleById[v];
              if (!r) return err('That role was deleted. Pick another.');
              if (r.usable === false) return err('Rex’s role is below @' + r.name + ', so it can’t give or take it. Move Rex’s role higher.');
              usedRoles.push({ type: b.type, id: v, to: b.to, i });
            } else if (f.t === 'ref') {
              if (empty || v === 'last') { if (!sentAny) wrn('There is no earlier message in this flow to point at.'); }
              else if (!labels.includes(v)) err('This points at the message called "' + v + '", but no message before this block has that label.');
            } else if (f.t === 'strlist') {
              const n = (Array.isArray(v) ? v : []).filter((x) => String(x || '').trim()).length;
              if (n < (f.min || 1)) err('Needs at least ' + (f.min || 1) + ' filled-in option' + ((f.min || 1) === 1 ? '' : 's') + '.');
              (Array.isArray(v) ? v : []).forEach((x) => chk(x, title));
            } else if (f.t === 'num') {
              if (typeof v === 'number' && ((f.min !== undefined && v < f.min) || (f.max !== undefined && v > f.max))) wrn(f.l + ' is ' + v + ', outside ' + f.min + ' to ' + f.max + '. Rex will adjust it.');
            } else if (f.t === 'text' || f.t === 'area') {
              if (empty && ['message', 'dm', 'log', 'announce_ping'].includes(b.type) && f.k === 'text' && !((b.buttons || []).length)) err('The message is empty.');
              if (empty && f.k === 'name' && ['set_var', 'pick', 'counter'].includes(b.type)) err('Give it a name.');
              if (!empty && f.k === 'name' && ['set_var', 'pick', 'counter'].includes(b.type) && !/^[a-z0-9_]{1,24}$/i.test(String(v))) err('Names can only use letters, numbers and _.');
              if (!empty) chk(v, title);
            } else if (f.t === 'label') {
              if (!empty) { if (labels.includes(v)) wrn('The label "' + v + '" is already used by an earlier block. Edits will hit the wrong message.'); }
            }
          });
          // specific "are you sure" checks
          if (SENDERS.includes(b.type)) { sentAny = true; replies = true; if (b.name) labels.push(b.name); }
          if (b.type === 'dm') replies = true;
          if (['set_var', 'pick'].includes(b.type) && b.name) setVars.add(String(b.name).toLowerCase());
          if (b.type === 'embed' && !b.title && !b.description) err('An embed with no title and no description is empty.');
          if (HARM.includes(b.type) && !gated && depth === 0) wrn('This ' + (spec.n || b.type).toLowerCase() + ' runs every single time. Is there a condition (If / else) that should come first?');
          if (['kick', 'ban', 'timeout'].includes(b.type)) {
            if (b.to === 'user' && isCmd) wrn('This hits the person who ran the command. Did you mean the picked user?');
            if (b.to === 'target' && isCmd && !(c.options && c.options.user)) err('It acts on the picked user, but this command does not let people pick one.');
            if (b.to === 'target' && !isCmd && !['member_ban', 'member_unban', 'warn_issued'].includes(c.trigger)) wrn('This event has no “picked user”, only the person it is about. Did you mean “the person who ran it”?');
          }
          if (GONE.includes(c.trigger) && (b.type === 'dm' || ['add_role', 'remove_role', 'toggle_role', 'timeout', 'set_nick'].includes(b.type))) wrn('The person has already left or been banned, so this can’t reach them.');
          if (b.type === 'wait' && (b.seconds || 0) > 60) wrn('Waits ' + b.seconds + ' seconds. Are you sure you meant that long?');
          if (b.type === 'stop' && i < blocks.length - 1) stopped = true;
          if (b.type === 'branch') {
            const k = b.if || {};
            if (['has_role', 'channel_is'].includes(k.kind) && !k.value) err('The condition has nothing chosen to check.');
            else if (k.kind === 'has_role' && k.value && !roleById[k.value]) err('The role in the condition was deleted.');
            else if (k.kind === 'channel_is' && k.value && !chanById[k.value]) err('The channel in the condition was deleted.');
            if (!(b.then || []).length && !(b.else || []).length) wrn('Both sides of this If / else are empty. It does nothing.');
            if (out.length === startRows) add('ok', title, 'Checks the condition, then runs the matching side.');
            walk(b.then, depth + 1, true); walk(b.else, depth + 1, true);
            return;
          }
          if (out.length === startRows) {
            let what = spec.d || '';
            const ch = b.channel && chanById[b.channel];
            if (ch) what = 'Would use #' + ch.name + '. ' + what;
            const r = b.role && roleById[b.role];
            if (r) what = 'Would use @' + r.name + '. ' + what;
            const t = String(b.text || b.title || b.description || '').trim();
            if (t) what = 'Says "' + t.slice(0, 60) + (t.length > 60 ? '…' : '') + '". ' + what;
            add('ok', title, (what || 'Looks fine.').trim());
          }
        });
      };
      walk(c.blocks, 0, false);
      // pairs that undo each other
      usedRoles.forEach((a, ia) => usedRoles.forEach((b2, ib) => {
        if (ib > ia && a.id === b2.id && a.to === b2.to && ((a.type === 'add_role' && b2.type === 'remove_role') || (a.type === 'remove_role' && b2.type === 'add_role') || (a.type === 'add_role' && b2.type === 'toggle_role') || (a.type === 'toggle_role' && b2.type === 'add_role')))
          add('warn', 'Roles', 'One block ' + a.type.replace('_', ' ') + 's @' + (roleById[a.id] || {}).name + ' and a later one undoes it. Did you mean that?');
      }));
      if (isCmd && !replies) add('warn', 'Reply', 'Nothing in this command replies to the person who ran it, so Discord may show “the application did not respond”.');
      return out;
    }
    function testFlow(c) {
      const results = dryRun(c);
      const errs = results.filter((r) => r.level === 'error').length, warns = results.filter((r) => r.level === 'warn').length;
      const still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
      const icon = { ok: '✓', warn: '!', error: '✕', run: '…' };
      const back = h('div', { class: 'dlg-back', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Test run' });
      const rows = h('div', { class: 'tst-rows', 'aria-live': 'polite' });
      const bar = h('div', { class: 'tst-bar' }, h('i', {}));
      const sum = h('div', { class: 'tst-sum' });
      const close = () => { cancelled = true; back.remove(); document.removeEventListener('keydown', onKey); };
      const onKey = (e) => { if (e.key === 'Escape') close(); };
      let cancelled = false;
      const again = h('button', { type: 'button', class: 'btn ghost sm', onclick: () => { close(); testFlow(c); } }, '↻ Run again');
      const done = h('button', { type: 'button', class: 'btn sm', onclick: close }, 'Close');
      back.append(h('div', { class: 'dlg tst' }, h('h3', {}, '🧪 Test run'), h('p', { class: 'muted small' }, 'Pretend run of “' + (isCmd ? '/' + (c.name || 'command') : (c.name || 'event')) + '”. Nothing is sent, changed or deleted.'),
        bar, rows, sum, h('div', { class: 'dlg-actions' }, again, done)));
      document.body.append(back); document.addEventListener('keydown', onKey); done.focus();
      const sleep = (ms) => new Promise((r) => setTimeout(r, still ? 0 : ms));
      (async () => {
        for (let i = 0; i < results.length; i++) {
          if (cancelled) return;
          const r = results[i];
          const row = h('div', { class: 'tst-row run' }, h('span', { class: 'tst-ic' }, icon.run), h('div', {}, h('b', {}, r.title), h('div', { class: 'small' }, r.level === 'ok' ? 'Checking…' : 'Checking…')));
          rows.append(row); row.scrollIntoView && row.scrollIntoView({ block: 'nearest' });
          await sleep(r.level === 'ok' ? 260 : 380);
          if (cancelled) return;
          row.className = 'tst-row ' + r.level; row.firstChild.textContent = icon[r.level]; row.lastChild.lastChild.textContent = r.msg;
          bar.firstChild.style.width = Math.round(((i + 1) / results.length) * 100) + '%';
          bar.className = 'tst-bar ' + (errs && results.slice(0, i + 1).some((x) => x.level === 'error') ? 'error' : results.slice(0, i + 1).some((x) => x.level === 'warn') ? 'warn' : 'ok');
          await sleep(120);
        }
        sum.className = 'tst-sum ' + (errs ? 'error' : warns ? 'warn' : 'ok');
        sum.textContent = errs ? '✕ Wouldn’t run yet: fix ' + errs + ' red problem' + (errs === 1 ? '' : 's') + (warns ? ' and check ' + warns + ' yellow note' + (warns === 1 ? '' : 's') : '') + '.'
          : warns ? '! Would run, but check ' + warns + ' yellow note' + (warns === 1 ? '' : 's') + ' first.' : '✓ Everything checks out. This would run.';
        sum.setAttribute('role', 'status');
      })();
    }
    function editor(c) {
      const rerender = () => paint();
      const top = h('div', { class: 'bld-etop' },
        h('button', { type: 'button', class: 'btn ghost sm', onclick: () => { editing = null; paint(); } }, '← Back'),
        h('b', {}, isCmd ? 'Command builder' : 'Event builder'), h('span', { class: 'grow' }), h('button', { type: 'button', class: 'btn sm', onclick: () => testFlow(c) }, '🧪 Test'), varsButton());
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
          TEXT_TRIGGERS.includes(c.trigger) ? h('label', { class: 'bld-f' }, h('span', { class: 'bld-fl' }, c.trigger === 'keyword' ? 'Word or phrase to look for' : 'Only if the message contains (optional)'), h('input', { type: 'text', maxlength: 40, value: c.keyword || '', placeholder: 'free nitro', disabled: dis, oninput: (e) => { c.keyword = e.target.value; commit(); } })) : null,
          EMOJI_TRIGGERS.includes(c.trigger) ? h('label', { class: 'bld-f' }, h('span', { class: 'bld-fl' }, 'Only this emoji (optional)'), h('input', { type: 'text', maxlength: 40, value: c.keyword || '', placeholder: '👍', disabled: dis, oninput: (e) => { c.keyword = e.target.value; commit(); } })) : null,
          CHANNEL_TRIGGERS.includes(c.trigger) ? h('label', { class: 'bld-f' }, h('span', { class: 'bld-fl' }, 'Only in this channel (optional)'), (() => { const s2 = h('select', { disabled: dis, onchange: (e) => { c.filter_channel = e.target.value; commit(); } }, h('option', { value: '' }, 'Any channel'), guild.channels.filter((x) => x.type !== 'category').map((x) => h('option', { value: x.id }, (x.type === 'voice' || x.type === 'stage' ? '🔊 ' : '#') + x.name))); s2.value = c.filter_channel || ''; return s2; })()) : null,
          ROLE_TRIGGERS.includes(c.trigger) ? h('label', { class: 'bld-f' }, h('span', { class: 'bld-fl' }, 'Only for this role (optional)'), (() => { const s2 = h('select', { disabled: dis, onchange: (e) => { c.filter_role = e.target.value; commit(); } }, h('option', { value: '' }, 'Any role'), roles.map((r) => h('option', { value: r.id }, r.name))); s2.value = c.filter_role || ''; return s2; })()) : null,
          c.trigger === 'daily' ? h('label', { class: 'bld-f' }, h('span', { class: 'bld-fl' }, 'Time (UTC)'), h('input', { type: 'time', value: c.at || '18:00', disabled: dis, oninput: (e) => { c.at = e.target.value; commit(); } })) : null,
          h('p', { class: 'muted small' }, HINTS[c.trigger] || 'Messages need a channel picked in the block.'));
      }
      if (o.studio) return h('div', { class: 'sb-editor' }, top, board(c, rerender, meta));
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
