// Burger menu — shared across all pages. Mirrors Figma 750:759.
//
// Five variants live in the design (all the same 260px pill shell):
//   • Logged out (default)            — stats show 0, CTA "Log ind"
//   • Logged in                       — real stats, CTA "Forsæt", Log ud link
//   • Language picker open            — DK button expands to DK/EN/FR list
//   • Log in form (auth accordion)    — email + password + submit
//   • Register form (auth accordion)  — email + password + submit
//
// The shell renders once; an internal `state` field decides which content
// region to show. Switching state re-renders only the body — the top
// MENU/DK/X bar and the three nav items are constant.
//
// Each page only needs <button class="burger-btn"> in its DOM.
// Exposes window.DanskMenu = { open, close }.

(function () {
  var NAV = [
    { href: 'landing.html',  label: 'Forside' },
    { href: 'chapters.html', label: 'Kapitler' },
    { href: 'quiz.html',     label: 'Tag testen' }
  ];

  // Module-level UI state. Reset to 'default' every open.
  var state = 'default';
  var language = 'DK';

  function currentPath() {
    var p = window.location.pathname.split('/').pop();
    return p || 'landing.html';
  }

  function formatMinutes(m) {
    if (!m) return '0';
    if (m < 60) return m + ' min';
    return Math.floor(m / 60) + ' t ' + (m % 60) + ' min';
  }

  function buildOverview() {
    var read = 0, score = 0, mins = 0;
    if (window.DanskProgress) {
      try {
        // "Afsnit læst" — live count of articles marked Læst.
        if (window.DanskProgress.getSectionsReadCount) {
          read = window.DanskProgress.getSectionsReadCount();
        }
        if (window.DanskProgress.getOverallScore) {
          score = Math.round(window.DanskProgress.getOverallScore() * 100);
        }
        // "Studeret tid" — active minutes on the platform.
        if (window.DanskProgress.getStudyMinutes) {
          mins = window.DanskProgress.getStudyMinutes();
        }
      } catch (e) { /* fall back to zeros */ }
    }
    return { read: read, score: score, mins: mins };
  }

  function isLoggedIn() {
    if (!window.firebase || !window.firebase.auth) return false;
    try { return !!window.firebase.auth().currentUser; } catch (e) { return false; }
  }

  function navHtml(here) {
    return NAV.map(function (it) {
      var active = (here === it.href);
      return '<a href="' + it.href + '"' +
             (active ? ' aria-current="page"' : '') + '>' + it.label + '</a>';
    }).join('');
  }

  function statsHtml(ov, loggedIn) {
    var afsnit  = loggedIn ? String(ov.read)        : '0';
    var score   = loggedIn ? (ov.score + '%')       : '0';
    var studied = loggedIn ? formatMinutes(ov.mins) : '0';
    return '' +
      '<div class="burger-menu__stat-row"><span>Afsnit læst</span><span>' + afsnit + '</span></div>' +
      '<div class="burger-menu__stat-row"><span>Test score</span><span>' + score + '</span></div>' +
      '<div class="burger-menu__stat-row"><span>Studeret tid</span><span>' + studied + '</span></div>';
  }

  // Default body: overview label, stats, CTA, optional log-ud link.
  function defaultBodyHtml(loggedIn) {
    var ov = buildOverview();
    var ctaLabel = loggedIn ? 'Forsæt din læsning' : 'Log ind';
    var overviewLabel = loggedIn ? 'Dit overblik' : 'Log in og følg din score';
    return '' +
      '<div class="burger-menu__overview-label">' + overviewLabel + '</div>' +
      '<div class="burger-menu__stats">' + statsHtml(ov, loggedIn) + '</div>' +
      '<button type="button" class="burger-menu__cta" data-action="' +
        (loggedIn ? 'continue' : 'show-login') + '">' + ctaLabel + '</button>' +
      (loggedIn
        ? '<button type="button" class="burger-menu__signout" data-action="signout">Log ud</button>'
        : '');
  }

  // Auth body — same shell for login + register, differing only in the
  // accordion header label, submit button label, and footer link target.
  function authBodyHtml(mode) {
    var isLogin = (mode === 'login');
    var headerLabel = isLogin ? 'Log ind'    : 'Opret konto';
    var submitLabel = isLogin ? 'Log ind'    : 'Opret konto';
    var swapLabel   = isLogin
      ? 'Har ikke en konto? <strong>Opret konto</strong>'
      : 'Har du allerede en konto? <strong>Log ind</strong>';
    var swapAction  = isLogin ? 'show-register' : 'show-login';

    return '' +
      '<div class="burger-menu__auth">' +
        '<div class="burger-menu__auth-head">' +
          '<span>' + headerLabel + '</span>' +
          '<svg width="14" height="9" viewBox="0 0 14 9" fill="none" xmlns="http://www.w3.org/2000/svg">' +
            '<path d="M1 1L7 7L13 1" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>' +
          '</svg>' +
        '</div>' +
        '<form class="burger-menu__auth-form" data-action="submit-auth" data-mode="' + mode + '" novalidate>' +
          '<input type="email"    class="burger-menu__auth-input" name="email"    placeholder="kasper@littlestudio.dk"  autocomplete="email"            required>' +
          '<input type="password" class="burger-menu__auth-input" name="password" placeholder="Indtast adgangskode*"     autocomplete="current-password" required>' +
          '<button type="submit"  class="burger-menu__auth-submit">' + submitLabel + '</button>' +
          '<button type="button"  class="burger-menu__auth-swap" data-action="' + swapAction + '">' + swapLabel + '</button>' +
        '</form>' +
      '</div>';
  }

  // The top bar holds MENU, DK button, X close. DK expands to a stack
  // when state === 'lang-picker'.
  function topBarHtml() {
    var langOpen = (state === 'lang-picker');
    var langHtml;
    if (langOpen) {
      langHtml =
        '<div class="burger-menu__lang burger-menu__lang--open" role="listbox" aria-label="Vælg sprog">' +
          '<button type="button" class="burger-menu__lang-opt" data-action="set-lang" data-lang="DK">DK</button>' +
          '<button type="button" class="burger-menu__lang-opt" data-action="set-lang" data-lang="EN">EN</button>' +
          '<button type="button" class="burger-menu__lang-opt" data-action="set-lang" data-lang="FR">FR</button>' +
        '</div>';
    } else {
      langHtml =
        '<button type="button" class="burger-menu__lang" data-action="toggle-lang" aria-label="Vælg sprog">' + language + '</button>';
    }
    return '' +
      '<div class="burger-menu__top">' +
        '<span class="burger-menu__eyebrow">MENU</span>' +
        '<div class="burger-menu__top-actions">' +
          langHtml +
          '<button type="button" class="burger-menu__close" data-action="close" aria-label="Luk menu">' +
            '<svg width="11" height="11" viewBox="0 0 11 11" fill="none" xmlns="http://www.w3.org/2000/svg">' +
              '<path d="M1 1L10 10M10 1L1 10" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>' +
            '</svg>' +
          '</button>' +
        '</div>' +
      '</div>';
  }

  function ensurePanel() {
    var existing = document.getElementById('burgerMenu');
    if (existing) return existing;

    var backdrop = document.createElement('div');
    backdrop.className = 'burger-menu-backdrop';
    backdrop.id = 'burgerMenuBackdrop';
    document.body.appendChild(backdrop);

    var panel = document.createElement('div');
    panel.className = 'burger-menu';
    panel.id = 'burgerMenu';
    panel.setAttribute('role', 'menu');
    panel.setAttribute('aria-label', 'Site menu');
    document.body.appendChild(panel);

    backdrop.addEventListener('click', closePanel);
    panel.addEventListener('click', handlePanelClick);
    panel.addEventListener('submit', handlePanelSubmit);
    return panel;
  }

  function renderPanel() {
    var panel = ensurePanel();
    var here = currentPath();
    var loggedIn = isLoggedIn();

    // Force back to a sane state if the user logs in/out while the panel
    // is open (e.g. closes form, reverts to default).
    if (loggedIn && (state === 'login' || state === 'register')) state = 'default';

    var body;
    if (state === 'login')    body = authBodyHtml('login');
    else if (state === 'register') body = authBodyHtml('register');
    else body = defaultBodyHtml(loggedIn);

    panel.dataset.state = state;
    panel.innerHTML = topBarHtml() +
      '<nav class="burger-menu__nav">' + navHtml(here) + '</nav>' +
      body;
  }

  // Single delegated click handler so re-renders don't have to re-wire.
  function handlePanelClick(e) {
    var t = e.target.closest('[data-action]');
    if (!t) return;
    var action = t.getAttribute('data-action');

    if (action === 'close') {
      closePanel();
    } else if (action === 'toggle-lang') {
      state = (state === 'lang-picker') ? 'default' : 'lang-picker';
      renderPanel();
    } else if (action === 'set-lang') {
      language = t.getAttribute('data-lang') || 'DK';
      state = 'default';
      renderPanel();
    } else if (action === 'show-login') {
      state = 'login';
      renderPanel();
      focusFirstInput();
    } else if (action === 'show-register') {
      state = 'register';
      renderPanel();
      focusFirstInput();
    } else if (action === 'signout') {
      if (window.firebase && window.firebase.auth) {
        try { window.firebase.auth().signOut(); } catch (e) {}
      }
      closePanel();
    } else if (action === 'continue') {
      closePanel();
      window.location.href = 'chapters.html';
    }
  }

  function focusFirstInput() {
    var input = document.querySelector('.burger-menu__auth-input');
    if (input) setTimeout(function () { input.focus(); }, 30);
  }

  function handlePanelSubmit(e) {
    var form = e.target.closest('form[data-action="submit-auth"]');
    if (!form) return;
    e.preventDefault();
    var mode = form.getAttribute('data-mode');
    var email = form.elements.email && form.elements.email.value;
    var pw    = form.elements.password && form.elements.password.value;
    if (!email || !pw) return;

    if (!(window.firebase && window.firebase.auth)) return;

    var auth = window.firebase.auth();
    var p = (mode === 'register')
      ? auth.createUserWithEmailAndPassword(email, pw)
      : auth.signInWithEmailAndPassword(email, pw);

    // On success the auth observer will flip state; on error, show inline.
    p.then(function () {
      state = 'default';
      renderPanel();
    }).catch(function (err) {
      var msg = form.querySelector('.burger-menu__auth-error');
      if (!msg) {
        msg = document.createElement('div');
        msg.className = 'burger-menu__auth-error';
        form.appendChild(msg);
      }
      msg.textContent = err && err.message ? err.message : 'Noget gik galt';
    });
  }

  function openPanel() {
    state = 'default';
    renderPanel();
    var panel  = document.getElementById('burgerMenu');
    var bg     = document.getElementById('burgerMenuBackdrop');
    if (!panel || !bg) return;
    panel.classList.add('burger-menu--open');
    bg.classList.add('burger-menu-backdrop--open');
    document.querySelectorAll('.burger-btn').forEach(function (b) {
      b.setAttribute('aria-expanded', 'true');
    });
  }

  function closePanel() {
    var panel = document.getElementById('burgerMenu');
    var bg    = document.getElementById('burgerMenuBackdrop');
    if (panel) panel.classList.remove('burger-menu--open');
    if (bg)    bg.classList.remove('burger-menu-backdrop--open');
    document.querySelectorAll('.burger-btn').forEach(function (b) {
      b.setAttribute('aria-expanded', 'false');
    });
  }

  function init() {
    var btns = document.querySelectorAll('.burger-btn');
    if (!btns.length) return;
    btns.forEach(function (btn) {
      btn.setAttribute('aria-haspopup', 'menu');
      btn.setAttribute('aria-expanded', 'false');
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var panel = document.getElementById('burgerMenu');
        if (panel && panel.classList.contains('burger-menu--open')) {
          closePanel();
        } else {
          openPanel();
        }
      });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closePanel();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.DanskMenu = { open: openPanel, close: closePanel };
})();
