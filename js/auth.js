// Simple email + password authentication.
// Exposes: window.DanskAuth
// Depends on: DanskFirebase (firebase-config.js), DanskProgress (progress.js)

(function() {
  // Guard: if Firebase not configured, expose a stub so the sign-in button
  // still renders but calls become no-ops with a clear error.
  if (!window.DanskFirebase) {
    window.DanskAuth = {
      signUp:        function() { return Promise.reject(new Error('Firebase not configured')); },
      signIn:        function() { return Promise.reject(new Error('Firebase not configured')); },
      signOut:       function() { return Promise.resolve(); },
      getUser:       function() { return null; },
      isLoggedIn:    function() { return false; },
      onReady:       function(cb) { cb(null); },
      showAuthModal: function() {},
      renderAuthUI:  function() {}
    };
    return;
  }

  var auth = DanskFirebase.auth;
  var currentUser = null;
  var authReady = false;
  var readyCallbacks = [];

  // === Core auth ===
  function signUp(email, password) {
    return auth.createUserWithEmailAndPassword(email, password);
  }
  function signIn(email, password) {
    return auth.signInWithEmailAndPassword(email, password);
  }
  function signOut() {
    return auth.signOut();
  }
  function getUser()    { return currentUser; }
  function isLoggedIn() { return currentUser !== null; }
  function onReady(cb)  { authReady ? cb(currentUser) : readyCallbacks.push(cb); }

  // === Auth state ===
  auth.onAuthStateChanged(function(user) {
    var justLoggedIn = !currentUser && !!user;
    currentUser = user;

    if (justLoggedIn && window.DanskProgress && DanskProgress.syncOnLogin) {
      DanskProgress.syncOnLogin(user.uid);
    }

    renderAuthUI();
    if (user) hideAuthModal();

    if (!authReady) {
      authReady = true;
      readyCallbacks.forEach(function(cb) { cb(user); });
      readyCallbacks = [];
    }
  });

  // === Widget (top-right avatar / sign-in button) ===
  function renderAuthUI() {
    var container = document.getElementById('authWidget');
    if (!container) return;

    if (currentUser) {
      container.innerHTML =
        '<div class="auth-widget">' +
          '<button class="auth-widget__avatar" id="authAvatarBtn" aria-label="Konto">' +
            '<span class="auth-widget__initials">' + escHtml(initial(currentUser)) + '</span>' +
          '</button>' +
          '<div class="auth-widget__dropdown hidden" id="authDropdown">' +
            '<div class="auth-widget__user-info">' +
              '<div class="auth-widget__email">' + escHtml(currentUser.email || '') + '</div>' +
            '</div>' +
            '<div class="auth-widget__divider"></div>' +
            '<button class="auth-widget__menu-btn" id="authLogoutBtn">Log ud</button>' +
          '</div>' +
        '</div>';

      document.getElementById('authAvatarBtn').addEventListener('click', function(e) {
        e.stopPropagation();
        document.getElementById('authDropdown').classList.toggle('hidden');
      });
      document.addEventListener('click', function() {
        var dd = document.getElementById('authDropdown');
        if (dd) dd.classList.add('hidden');
      });
      document.getElementById('authLogoutBtn').addEventListener('click', signOut);
    } else {
      container.innerHTML =
        '<button class="btn btn--outlined btn--sm" id="authSignInBtn">Log ind</button>';
      document.getElementById('authSignInBtn').addEventListener('click', showAuthModal);
    }
  }

  function initial(user) {
    return (user.email || '?')[0].toUpperCase();
  }

  function escHtml(str) {
    if (!str) return '';
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  // === Modal (email + password only) ===
  function showAuthModal() {
    var existing = document.getElementById('authModal');
    if (existing) { existing.classList.remove('hidden'); return; }

    var overlay = document.createElement('div');
    overlay.id = 'authModal';
    overlay.className = 'modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.innerHTML =
      '<div class="modal" style="width:380px;">' +
        '<div class="modal__header">' +
          '<h2 class="modal__title" id="authModalTitle">Log ind</h2>' +
          '<button class="icon-btn" id="authModalClose" aria-label="Luk">' +
            '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>' +
          '</button>' +
        '</div>' +
        '<div class="modal__body">' +
          '<div class="form-group">' +
            '<label class="form-label" for="authEmail">E-mail</label>' +
            '<input type="email" id="authEmail" class="form-input" placeholder="dig@eksempel.dk" autocomplete="email">' +
          '</div>' +
          '<div class="form-group">' +
            '<label class="form-label" for="authPassword">Adgangskode</label>' +
            '<input type="password" id="authPassword" class="form-input" placeholder="Mindst 6 tegn" autocomplete="current-password">' +
          '</div>' +
          '<div id="authError" class="auth-error"></div>' +
        '</div>' +
        '<div class="modal__footer" style="flex-direction:column; gap:8px;">' +
          '<button class="btn btn--primary" id="authSubmitBtn" style="width:100%;">Log ind</button>' +
          '<button class="btn btn--ghost" id="authToggleBtn" style="font-size:12px;">Har du ikke en konto? Opret en</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);
    wireModal();
  }

  function wireModal() {
    var isSignUp = false;

    document.getElementById('authModalClose').addEventListener('click', hideAuthModal);
    document.getElementById('authModal').addEventListener('click', function(e) {
      if (e.target === this) hideAuthModal();
    });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        var m = document.getElementById('authModal');
        if (m && !m.classList.contains('hidden')) hideAuthModal();
      }
    });

    document.getElementById('authToggleBtn').addEventListener('click', function() {
      isSignUp = !isSignUp;
      document.getElementById('authModalTitle').textContent = isSignUp ? 'Opret konto' : 'Log ind';
      document.getElementById('authSubmitBtn').textContent  = isSignUp ? 'Opret konto' : 'Log ind';
      this.textContent = isSignUp
        ? 'Har du allerede en konto? Log ind'
        : 'Har du ikke en konto? Opret en';
      clearError();
    });

    document.getElementById('authSubmitBtn').addEventListener('click', function() { submit(isSignUp); });
    document.getElementById('authPassword').addEventListener('keydown', function(e) {
      if (e.key === 'Enter') submit(isSignUp);
    });
  }

  function submit(isSignUp) {
    var email    = document.getElementById('authEmail').value.trim();
    var password = document.getElementById('authPassword').value;

    if (!email || !password) {
      return showError({ message: 'Udfyld venligst begge felter.' });
    }
    if (password.length < 6) {
      return showError({ message: 'Adgangskoden skal være mindst 6 tegn.' });
    }

    var btn = document.getElementById('authSubmitBtn');
    btn.disabled = true;

    var op = isSignUp ? signUp(email, password) : signIn(email, password);
    op.catch(function(err) {
      showError(err);
      btn.disabled = false;
    });
  }

  function hideAuthModal() {
    var m = document.getElementById('authModal');
    if (m) m.classList.add('hidden');
  }

  function showError(err) {
    var el = document.getElementById('authError');
    if (!el) return;
    el.style.display = 'block';
    el.textContent = friendlyError(err.code || err.message || 'Ukendt fejl');
  }
  function clearError() {
    var el = document.getElementById('authError');
    if (el) el.style.display = 'none';
  }
  function friendlyError(code) {
    var map = {
      'auth/email-already-in-use':   'Der findes allerede en konto med denne e-mail.',
      'auth/invalid-email':          'Indtast en gyldig e-mailadresse.',
      'auth/wrong-password':         'Forkert adgangskode.',
      'auth/user-not-found':         'Ingen konto fundet med denne e-mail.',
      'auth/weak-password':          'Adgangskoden skal være mindst 6 tegn.',
      'auth/network-request-failed': 'Netværksfejl. Tjek din forbindelse.',
      'auth/too-many-requests':      'For mange forsøg. Prøv igen om lidt.',
      'auth/invalid-credential':     'Ugyldig e-mail eller adgangskode.'
    };
    return map[code] || code;
  }

  // === Public API ===
  window.DanskAuth = {
    signUp:        signUp,
    signIn:        signIn,
    signOut:       signOut,
    getUser:       getUser,
    isLoggedIn:    isLoggedIn,
    onReady:       onReady,
    showAuthModal: showAuthModal,
    renderAuthUI:  renderAuthUI
  };
})();
