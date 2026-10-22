'use strict';
(async function () {
  mountNav('home');

  loadOptional('/img/avatar.png').then((img) => {
    if (!img) return;
    img.className = 'real';
    img.alt = 'REX';
    document.getElementById('art').append(img);
  });

  try {
    const s = await api('/api/status');
    const pill = document.getElementById('pill');
    pill.textContent = s.online ? 'Online' : 'Offline';
    pill.className = 'pill ' + (s.online ? 'ok' : 'bad');
    document.getElementById('s-guilds').textContent = fmtNum(s.guild_count);
    document.getElementById('s-users').textContent = fmtNum(s.user_count);
    document.getElementById('s-ping').textContent = s.latency_ms == null ? '—' : s.latency_ms + ' ms';
    document.getElementById('s-up').textContent = s.online ? fmtDuration(s.uptime_s) : '—';
    if (s.invite_url) {
      const a = document.getElementById('invite');
      a.href = s.invite_url;
      a.hidden = false;
    }
  } catch (e) {
    const pill = document.getElementById('pill');
    pill.textContent = 'Unknown';
    pill.className = 'pill warn';
  }
})();
