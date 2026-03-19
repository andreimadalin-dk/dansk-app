// Authentication wrapper
// Exposes: window.DanskAuth
// Depends on: DanskFirebase (firebase-config.js), DanskProgress (progress.js)

(function() {
  // Guard: if Firebase not configured, expose a stub API and bail
  if (!window.DanskFirebase) {
    window.DanskAuth = {
      signUpWithEmail: function() { return Promise.reject(new Error('Firebase not configured')); },
      signInWithEmail: function() { return Promise.reject(new Error('Firebase not configured')); },
      signInWithGoogle: function() { return Promise.reject(new Error('Firebase not configured')); },
      signOut: function() { return Promise.resolve(); },
      getUser: function() { return null; },
      isLoggedIn: function() { return false; },
      onReady: function(cb) { cb(null); },
      showAuthModal: function() {},
      renderAuthUI: function() {}
    };
    return;
  }

  var auth = DanskFirebase.auth;
  var googleProvider = DanskFirebase.googleProvider;
  var currentUser = null;
  var authReadyCallbacks = [];
  var authReady = false;

  // === Core Auth Methods ===

  function signUpWithEmail(email, password) {
    return auth.createUserWithEmailAndPassword(email, password);
  }

  function signInWithEmail(email, password) {
    return auth.signInWithEmailAndPassword(email, password);
  }

  function signInWithGoogle() {
    return auth.signInWithPopup(googleProvider).catch(function(err) {
      if (err.code === 'auth/popup-blocked' || err.code === 'auth/popup-closed-by-user') {
        return auth.signInWithRedirect(googleProvider);
      }
      throw err;
    });
  }

  function signOut() {
    return auth.signOut();
  }

  function getUser() {
    return currentUser;
  }

  function isLoggedIn() {
    return currentUser !== null;
  }

  function onReady(callback) {
    if (authReady) {
      callback(currentUser);
    } else {
      authReadyCallbacks.push(callback);
    }
  }

  // === Auth State Listener ===

  auth.onAuthStateChanged(function(user) {
    var wasLoggedOut = !currentUser;
    currentUser = user;

    if (user && wasLoggedOut) {
      // User just logged in — sync progress
      if (window.DanskProgress && DanskProgress.syncOnLogin) {
        DanskProgress.syncOnLogin(user.uid);
      }
    }

    // Update nav UI
    renderAuthUI();

    // Dismiss auth modal if open and user logged in
    if (user) {
      hideAuthModal();
    }

    // Fire ready callbacks on first auth state determination
    if (!authReady) {
      authReady = true;
      authReadyCallbacks.forEach(function(cb) { cb(user); });
      authReadyCallbacks = [];
    }
  });

  // Handle redirect result (for mobile Google sign-in fallback)
  auth.getRedirectResult().catch(function(err) {
    if (err.code && err.code !== 'auth/popup-closed-by-user') {
      console.warn('Redirect auth error:', err);
    }
  });

  // === UI Rendering ===

  function renderAuthUI() {
    var container = document.getElementById('authWidget');
    if (!container) return;

    if (currentUser) {
      var initials = getInitials(currentUser);
      var photoUrl = currentUser.photoURL;

      container.innerHTML =
        '<div class="auth-widget">' +
          '<button class="auth-widget__avatar" id="authAvatarBtn" aria-label="Account menu">' +
            (photoUrl
              ? '<img src="' + escHtml(photoUrl) + '" alt="" class="auth-widget__photo">'
              : '<span class="auth-widget__initials">' + escHtml(initials) + '</span>') +
          '</button>' +
          '<div class="auth-widget__dropdown hidden" id="authDropdown">' +
            '<div class="auth-widget__user-info">' +
              (currentUser.displayName
                ? '<div class="auth-widget__name">' + escHtml(currentUser.displayName) + '</div>'
                : '') +
              '<div class="auth-widget__email">' + escHtml(currentUser.email || 'Google user') + '</div>' +
            '</div>' +
            '<div class="auth-widget__divider"></div>' +
            '<button class="auth-widget__logout-btn" id="authLogoutBtn">' +
              '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M6 14H3.333A1.333 1.333 0 0 1 2 12.667V3.333A1.333 1.333 0 0 1 3.333 2H6M10.667 11.333L14 8l-3.333-3.333M14 8H6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
              ' Log ud' +
            '</button>' +
          '</div>' +
        '</div>';

      // Toggle dropdown
      document.getElementById('authAvatarBtn').addEventListener('click', function(e) {
        e.stopPropagation();
        document.getElementById('authDropdown').classList.toggle('hidden');
      });

      // Close dropdown on outside click
      document.addEventListener('click', function() {
        var dd = document.getElementById('authDropdown');
        if (dd) dd.classList.add('hidden');
      });

      // Logout
      document.getElementById('authLogoutBtn').addEventListener('click', function() {
        signOut();
      });
    } else {
      container.innerHTML =
        '<button class="btn btn--outlined btn--sm" id="authSignInBtn">Log ind</button>';

      document.getElementById('authSignInBtn').addEventListener('click', function() {
        showAuthModal();
      });
    }
  }

  function getInitials(user) {
    if (user.displayName) {
      var parts = user.displayName.trim().split(' ');
      return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
    }
    if (user.email) {
      return user.email[0].toUpperCase();
    }
    return '?';
  }

  function escHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // === Auth Modal ===

  function showAuthModal() {
    var existing = document.getElementById('authModal');
    if (existing) {
      existing.classList.remove('hidden');
      return;
    }

    var overlay = document.createElement('div');
    overlay.id = 'authModal';
    overlay.className = 'modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'authModalTitle');

    overlay.innerHTML =
      '<div class="modal" style="width:420px;">' +
        '<div class="modal__header">' +
          '<h2 class="modal__title" id="authModalTitle">Log ind</h2>' +
          '<button class="icon-btn" id="authModalClose" aria-label="Close">' +
            '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>' +
          '</button>' +
        '</div>' +
        '<div class="modal__body">' +
          '<button class="btn btn--google" id="authGoogleBtn">' +
            '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">' +
              '<path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>' +
              '<path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>' +
              '<path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>' +
              '<path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>' +
            '</svg>' +
            ' Fortsæt med Google' +
          '</button>' +
          '<div class="auth-divider">' +
            '<div class="auth-divider__line"></div>' +
            '<span class="auth-divider__text">eller</span>' +
            '<div class="auth-divider__line"></div>' +
          '</div>' +
          '<div class="form-group">' +
            '<label class="form-label" for="authEmail">E-mail</label>' +
            '<input type="email" id="authEmail" class="form-input" placeholder="you@example.com">' +
          '</div>' +
          '<div class="form-group">' +
            '<label class="form-label" for="authPassword">Adgangskode</label>' +
            '<input type="password" id="authPassword" class="form-input" placeholder="Adgangskode (mindst 6 tegn)">' +
          '</div>' +
          '<div id="authError" class="auth-error"></div>' +
        '</div>' +
        '<div class="modal__footer" style="flex-direction:column; gap:8px;">' +
          '<button class="btn btn--primary" id="authSubmitBtn" style="width:100%;">Log ind</button>' +
          '<button class="btn btn--ghost" id="authToggleBtn" style="font-size:12px;">Har du ikke en konto? Opret en</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);
    wireAuthModal();
  }

  function wireAuthModal() {
    var isSignUp = false;

    // Close handlers
    document.getElementById('authModalClose').addEventListener('click', hideAuthModal);
    document.getElementById('authModal').addEventListener('click', function(e) {
      if (e.target === this) hideAuthModal();
    });

    var escHandler = function(e) {
      if (e.key === 'Escape') {
        var modal = document.getElementById('authModal');
        if (modal && !modal.classList.contains('hidden')) {
          hideAuthModal();
        }
      }
    };
    document.addEventListener('keydown', escHandler);

    // Toggle sign-in / sign-up
    document.getElementById('authToggleBtn').addEventListener('click', function() {
      isSignUp = !isSignUp;
      document.getElementById('authModalTitle').textContent = isSignUp ? 'Opret konto' : 'Log ind';
      document.getElementById('authSubmitBtn').textContent = isSignUp ? 'Opret konto' : 'Log ind';
      this.textContent = isSignUp
        ? 'Har du allerede en konto? Log ind'
        : 'Har du ikke en konto? Opret en';
      clearError();
    });

    // Google sign-in
    document.getElementById('authGoogleBtn').addEventListener('click', function() {
      this.disabled = true;
      signInWithGoogle().catch(function(err) {
        showError(err);
        var btn = document.getElementById('authGoogleBtn');
        if (btn) btn.disabled = false;
      });
    });

    // Email submit
    document.getElementById('authSubmitBtn').addEventListener('click', function() {
      handleEmailSubmit(isSignUp);
    });

    // Enter key on password field
    document.getElementById('authPassword').addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        handleEmailSubmit(isSignUp);
      }
    });
  }

  function handleEmailSubmit(isSignUp) {
    var email = document.getElementById('authEmail').value.trim();
    var password = document.getElementById('authPassword').value;

    if (!email || !password) {
      showError({ message: 'Udfyld venligst alle felter.' });
      return;
    }
    if (password.length < 6) {
      showError({ message: 'Adgangskoden skal være mindst 6 tegn.' });
      return;
    }

    var submitBtn = document.getElementById('authSubmitBtn');
    if (submitBtn) submitBtn.disabled = true;

    var promise = isSignUp ? signUpWithEmail(email, password) : signInWithEmail(email, password);
    promise.catch(function(err) {
      showError(err);
      if (submitBtn) submitBtn.disabled = false;
    });
  }

  function hideAuthModal() {
    var modal = document.getElementById('authModal');
    if (modal) modal.classList.add('hidden');
  }

  function showError(err) {
    var el = document.getElementById('authError');
    if (!el) return;
    el.style.display = 'block';
    el.textContent = friendlyError(err.code || err.message || 'Unknown error');
  }

  function clearError() {
    var el = document.getElementById('authError');
    if (el) el.style.display = 'none';
  }

  function friendlyError(code) {
    var map = {
      'auth/email-already-in-use': 'Der findes allerede en konto med denne e-mail.',
      'auth/invalid-email': 'Indtast venligst en gyldig e-mailadresse.',
      'auth/wrong-password': 'Forkert adgangskode. Prøv igen.',
      'auth/user-not-found': 'Ingen konto fundet med denne e-mail.',
      'auth/weak-password': 'Adgangskoden skal være mindst 6 tegn.',
      'auth/popup-closed-by-user': 'Login-vinduet blev lukket.',
      'auth/network-request-failed': 'Netværksfejl. Tjek din forbindelse.',
      'auth/too-many-requests': 'For mange forsøg. Vent venligst et øjeblik.',
      'auth/invalid-credential': 'Ugyldig e-mail eller adgangskode.'
    };
    return map[code] || code;
  }

  // === Expose Public API ===

  window.DanskAuth = {
    signUpWithEmail: signUpWithEmail,
    signInWithEmail: signInWithEmail,
    signInWithGoogle: signInWithGoogle,
    signOut: signOut,
    getUser: getUser,
    isLoggedIn: isLoggedIn,
    onReady: onReady,
    showAuthModal: showAuthModal,
    renderAuthUI: renderAuthUI
  };
})();
