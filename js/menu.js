// Top-right hamburger menu — shared across landing.html, chapters.html,
// and any other page that includes this script.
//
// Behaviour:
//   • A page only needs <button class="menu-btn"> in its DOM. This
//     script attaches the click handler, builds the dropdown panel
//     once on first open, and inserts it into <body>.
//   • The panel is positioned just below the menu button using
//     position: fixed, so it works regardless of page layout.
//   • Closes on outside click, Escape, or clicking a link.
//   • Highlights the link for the current page so the user can see
//     where they are.
//
// Exposes: window.DanskMenu (currently no public methods, but the
// global confirms the script is wired up if other code needs it).

(function () {
  var ITEMS = [
    { href: 'landing.html',  label: 'Forside' },
    { href: 'chapters.html', label: 'Vælg kapitel' },
    { href: 'index.html',    label: 'Min fremgang' }
  ];

  function currentPath() {
    var p = window.location.pathname.split('/').pop();
    return p || 'landing.html';
  }

  function ensurePanel() {
    var existing = document.getElementById('navMenu');
    if (existing) return existing;

    var panel = document.createElement('nav');
    panel.id = 'navMenu';
    panel.className = 'nav-menu hidden';
    panel.setAttribute('role', 'menu');
    panel.setAttribute('aria-label', 'Site navigation');

    var here = currentPath();
    var html = '';
    for (var i = 0; i < ITEMS.length; i++) {
      var it = ITEMS[i];
      var active = (here === it.href) ? ' nav-menu__item--active' : '';
      html +=
        '<a class="nav-menu__item' + active + '" href="' + it.href + '" role="menuitem"' +
        (active ? ' aria-current="page"' : '') + '>' +
          it.label +
        '</a>';
    }
    panel.innerHTML = html;
    document.body.appendChild(panel);
    return panel;
  }

  function positionPanel(panel, btn) {
    var rect = btn.getBoundingClientRect();
    panel.style.top   = (rect.bottom + 8) + 'px';
    panel.style.right = (window.innerWidth - rect.right) + 'px';
  }

  function openPanel(btn) {
    var panel = ensurePanel();
    positionPanel(panel, btn);
    panel.classList.remove('hidden');
    btn.setAttribute('aria-expanded', 'true');
  }

  function closePanel() {
    var panel = document.getElementById('navMenu');
    if (!panel || panel.classList.contains('hidden')) return;
    panel.classList.add('hidden');
    var btns = document.querySelectorAll('.menu-btn');
    for (var i = 0; i < btns.length; i++) {
      btns[i].setAttribute('aria-expanded', 'false');
    }
  }

  function init() {
    var btns = document.querySelectorAll('.menu-btn');
    if (!btns.length) return;

    btns.forEach(function (btn) {
      btn.setAttribute('aria-haspopup', 'menu');
      btn.setAttribute('aria-expanded', 'false');
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var panel = document.getElementById('navMenu');
        if (panel && !panel.classList.contains('hidden')) {
          closePanel();
        } else {
          openPanel(btn);
        }
      });
    });

    // Click outside closes
    document.addEventListener('click', function (e) {
      var panel = document.getElementById('navMenu');
      if (!panel || panel.classList.contains('hidden')) return;
      if (panel.contains(e.target)) return;            // click inside panel — let link work
      closePanel();
    });

    // Escape closes
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closePanel();
    });

    // Reposition on resize / scroll
    window.addEventListener('resize', function () {
      var panel = document.getElementById('navMenu');
      if (!panel || panel.classList.contains('hidden')) return;
      var btn = document.querySelector('.menu-btn');
      if (btn) positionPanel(panel, btn);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.DanskMenu = { open: openPanel, close: closePanel };
})();
