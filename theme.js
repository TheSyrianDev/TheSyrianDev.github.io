/* Theme: two states — light and dark only. No system auto; the user chooses.
   Preference is saved to localStorage under "theme" and reapplied before first
   paint so the page never flashes the wrong theme.
   Default is light. Dark appears only when the user picks it. */
(function () {
  var root = document.documentElement;
  var button = document.getElementById('theme-toggle');
  if (!button) return;

  function current() {
    return root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  function paint() {
    var t = current();
    button.setAttribute('aria-label', 'Theme: ' + t + ' (click for the other one)');
    button.setAttribute('title', 'Theme: ' + t);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    meta.setAttribute('content', t === 'light' ? '#f7f3e8' : '#0a0a09');
  }

  button.addEventListener('click', function () {
    var next = current() === 'light' ? 'dark' : 'light';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch (e) {}
    paint();
  });

  // Apply saved choice before first paint. Default is light; stay light
  // unless the user has explicitly chosen dark.
  var saved = localStorage.getItem('theme');
  if (saved === 'dark') {
    root.setAttribute('data-theme', 'dark');
  } else {
    root.setAttribute('data-theme', 'light');
  }
  paint();
})();
