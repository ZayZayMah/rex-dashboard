'use strict';
(async function () {
  mountNav('home');

  loadOptional('/img/avatar.png').then((img) => {
    if (!img) return;
    img.className = 'real';
    img.alt = 'REX';
    document.getElementById('art').append(img);
  });

  const pill = document.getElementById('pill');
  try {
    const s = await api('/api/status');
    if (s.support_url) { REX.support = s.support_url; document.getElementById('support').href = s.support_url; }
    pill.textContent = s.online ? 'Online' : 'Offline';
    pill.className = 'pill ' + (s.online ? 'ok' : 'bad');
    document.getElementById('s-guilds').textContent = fmtNum(s.guild_count);
    document.getElementById('s-users').textContent = fmtNum(s.user_count);
    document.getElementById('s-ping').textContent = s.latency_ms == null ? '—' : s.latency_ms + ' ms';
    document.getElementById('s-up').textContent = s.online ? fmtDuration(s.uptime_s) : '—';
    document.getElementById('seen').textContent = s.last_seen ? 'Last heartbeat ' + timeAgo(s.last_seen) : 'Bot has not connected to the dashboard yet';
    if (s.invite_url) document.getElementById('invite').href = s.invite_url;
  } catch (e) {
    pill.textContent = 'Unknown';
    pill.className = 'pill warn';
  }
})();
