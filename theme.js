/* Three-state theme: auto (follow the system), light, dark.
   The stored choice is applied in <head> before first paint; this file only
   cycles it and keeps the browser chrome colour in step. */
(function () {
  var root = document.documentElement;
  var button = document.getElementById('theme-toggle');
  var meta = document.querySelector('meta[name="theme-color"]');
  if (!button) return;

  var order = ['auto', 'light', 'dark'];
  var chrome = { auto: ['#0a0a09', '#f7f3e8'], light: '#f7f3e8', dark: '#0a0a09' };
  var media = window.matchMedia('(prefers-color-scheme: light)');

  function current() {
    var t = root.getAttribute('data-theme');
    return t === 'light' || t === 'dark' ? t : 'auto';
  }

  function paint() {
    var t = current();
    var label = 'Theme: ' + t + ' (click for ' +
      order[(order.indexOf(t) + 1) % order.length] + ')';
    button.setAttribute('aria-label', label);
    button.setAttribute('title', 'Theme: ' + t);
    if (!meta) return;
    if (t === 'auto') {
      meta.setAttribute('content', chrome.auto[media.matches ? 1 : 0]);
    } else {
      meta.setAttribute('content', chrome[t]);
    }
  }

  button.addEventListener('click', function () {
    var next = order[(order.indexOf(current()) + 1) % order.length];
    root.setAttribute('data-theme', next);
    try {
      if (next === 'auto') localStorage.removeItem('theme');
      else localStorage.setItem('theme', next);
    } catch (e) {}
    paint();
  });

  media.addEventListener('change', paint);
  paint();
})();
