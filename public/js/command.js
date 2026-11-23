'use strict';
/* Old deep links (/command?c=ban) open the card pop-up on the commands page. */
(function () {
  const name = new URLSearchParams(location.search).get('c') || '';
  location.replace('/commands' + (name ? '#' + encodeURIComponent(name) : ''));
})();
