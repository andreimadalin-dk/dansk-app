// Firebase initialization
// Exposes: window.DanskFirebase
// IMPORTANT: Replace the config below with your Firebase project's config
// Get it from: Firebase Console → Project Settings → Your Apps → Web App

(function() {
  var firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
  };

  // Guard: if placeholder config, skip Firebase init entirely
  if (firebaseConfig.apiKey === "YOUR_API_KEY") {
    console.info('Firebase: Using placeholder config — auth disabled. Replace config in js/firebase-config.js to enable.');
    window.DanskFirebase = null;
    return;
  }

  try {
    firebase.initializeApp(firebaseConfig);

    // Enable Firestore offline persistence
    firebase.firestore().enablePersistence({ synchronizeTabs: true }).catch(function(err) {
      if (err.code === 'failed-precondition') {
        console.warn('Firestore persistence: Multiple tabs open, persistence enabled in first tab only.');
      } else if (err.code === 'unimplemented') {
        console.warn('Firestore persistence: Browser does not support offline persistence.');
      }
    });

    window.DanskFirebase = {
      auth: firebase.auth(),
      db: firebase.firestore(),
      googleProvider: new firebase.auth.GoogleAuthProvider()
    };
  } catch (e) {
    console.warn('Firebase init failed:', e);
    window.DanskFirebase = null;
  }
})();
