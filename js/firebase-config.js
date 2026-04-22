// Firebase initialization
// Exposes: window.DanskFirebase
// IMPORTANT: Replace the config below with your Firebase project's config
// Get it from: Firebase Console → Project Settings → Your Apps → Web App

(function() {
  var firebaseConfig = {
    apiKey: "AIzaSyC0HOnySIeRpQAhWCy7CIT8VHdqnjmHBLU",
    authDomain: "danish-citizenship-test.firebaseapp.com",
    projectId: "danish-citizenship-test",
    storageBucket: "danish-citizenship-test.firebasestorage.app",
    messagingSenderId: "270493644003",
    appId: "1:270493644003:web:cc89a2c17198b94142c1d6",
    measurementId: "G-TS39B76JE4"
  };

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
      db: firebase.firestore()
    };
  } catch (e) {
    console.warn('Firebase init failed:', e);
    window.DanskFirebase = null;
  }
})();
