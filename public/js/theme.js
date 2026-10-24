/* Runs before first paint. The site theme (normal / halloween / christmas) is chosen by the Rex owners in
   owner mode and is the same for everyone. The last known value is cached so the page never flashes. */
(function () {
  var theme = 'normal';
  try { theme = localStorage.getItem('rex-site-theme') || 'normal'; } catch (e) {}
  if (theme !== 'halloween' && theme !== 'christmas') theme = 'normal';
  var root = document.documentElement;
  root.setAttribute('data-theme', theme);
  window.rexApplyTheme = function (next) {
    if (next !== 'halloween' && next !== 'christmas') next = 'normal';
    try { localStorage.setItem('rex-site-theme', next); } catch (e) {}
    if (root.getAttribute('data-theme') === next && document.getElementById('theme-css-' + next)) return false;
    root.setAttribute('data-theme', next);
    window.rexLoadThemeCss(next);
    return true;
  };
  window.rexLoadThemeCss = function (t) {
    ['halloween', 'christmas'].forEach(function (name) {
      var el = document.getElementById('theme-css-' + name);
      if (name !== t && el) el.remove();
    });
    if ((t === 'halloween' || t === 'christmas') && !document.getElementById('theme-css-' + t)) {
      var link = document.createElement('link');
      link.rel = 'stylesheet'; link.id = 'theme-css-' + t; link.href = '/css/' + t + '.css';
      document.head.appendChild(link);
    }
  };
  window.rexLoadThemeCss(theme);
})();
