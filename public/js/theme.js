/* Applies the saved theme before first paint. Halloween auto-enables Oct 15 - Nov 2. */
(function () {
  var KEY = 'rex-theme';
  var saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) {}
  var d = new Date();
  var season = (d.getMonth() === 9 && d.getDate() >= 15) || (d.getMonth() === 10 && d.getDate() <= 2);
  var theme = saved === 'default' || saved === 'halloween' ? saved : (season ? 'halloween' : 'default');
  document.documentElement.setAttribute('data-theme', theme);
  window.rexToggleTheme = function () {
    var next = document.documentElement.getAttribute('data-theme') === 'halloween' ? 'default' : 'halloween';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem(KEY, next); } catch (e) {}
    return next;
  };
})();
