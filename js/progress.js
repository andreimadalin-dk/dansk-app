// Progress tracking with localStorage + Firestore cloud sync + SM-2 spaced repetition
// Exposes: window.DanskProgress
//
// Storage policy (v2): Progress is ONLY persisted while the user is logged in.
//   • Logged-out writes are no-ops — progress vanishes on reload.
//   • On login, localStorage is populated from Firestore.
//   • On logout, localStorage is wiped (clearLocal) so stats reset.
// This makes the account the single source of truth; browsing without an
// account is effectively read-only / ephemeral.

(function() {
  var KEY = 'dansk-app-progress';
  var saveTimer = null;

  function isLoggedIn() {
    return !!(window.DanskAuth && DanskAuth.isLoggedIn());
  }

  function getStore() {
    // Without a login, nothing is persisted — always return a fresh default.
    // (getStore() is called on every read; mutations to the returned object
    // only stick if save() actually writes, which it won't when logged out.)
    if (!isLoggedIn()) return defaultStore();

    try {
      var raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : defaultStore();
    } catch (e) {
      return defaultStore();
    }
  }

  function save(store) {
    // Guard: only persist progress for authenticated users. Logged-out
    // users see ephemeral state that resets on reload.
    if (!isLoggedIn()) return;

    try {
      localStorage.setItem(KEY, JSON.stringify(store));
    } catch (e) { /* storage full or unavailable */ }

    debouncedFirestoreSave(store);
  }

  function debouncedFirestoreSave(store) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function() {
      var user = window.DanskAuth ? DanskAuth.getUser() : null;
      if (!user || !window.DanskFirebase) return;

      var docRef = DanskFirebase.db.collection('users').doc(user.uid)
                     .collection('progress').doc('data');
      var data = JSON.parse(JSON.stringify(store)); // deep clone
      data.updatedAt = firebase.firestore.FieldValue.serverTimestamp();

      docRef.set(data, { merge: true }).catch(function(err) {
        console.warn('Firestore save failed:', err);
      });
    }, 1500);
  }

  function defaultStore() {
    return {
      version: 1,
      study: {},
      quiz: {},
      flashcards: {},
      streaks: { lastStudyDate: null, currentStreak: 0 }
    };
  }

  // === Merge Strategy ===

  function mergeStores(local, cloud) {
    var merged = defaultStore();

    // Study: union of all read sections
    var allStudyKeys = uniqueKeys(local.study, cloud.study);
    allStudyKeys.forEach(function(key) {
      var l = local.study[key];
      var c = cloud.study[key];
      if (l && c) {
        merged.study[key] = (l.readAt && c.readAt && l.readAt <= c.readAt) ? l : c;
      } else {
        merged.study[key] = l || c;
      }
    });

    // Quiz: keep record with more attempts
    var allQuizKeys = uniqueKeys(local.quiz, cloud.quiz);
    allQuizKeys.forEach(function(key) {
      var l = local.quiz[key];
      var c = cloud.quiz[key];
      if (l && c) {
        merged.quiz[key] = (l.attempts >= c.attempts) ? l : c;
      } else {
        merged.quiz[key] = l || c;
      }
    });

    // Flashcards: keep state with more repetitions
    var allFcKeys = uniqueKeys(local.flashcards, cloud.flashcards);
    allFcKeys.forEach(function(key) {
      var l = local.flashcards[key];
      var c = cloud.flashcards[key];
      if (l && c) {
        merged.flashcards[key] = (l.repetitions >= c.repetitions) ? l : c;
      } else {
        merged.flashcards[key] = l || c;
      }
    });

    // Streaks: keep longer streak + most recent date
    var ls = local.streaks || {};
    var cs = cloud.streaks || {};
    merged.streaks.currentStreak = Math.max(ls.currentStreak || 0, cs.currentStreak || 0);
    merged.streaks.lastStudyDate = (ls.lastStudyDate && cs.lastStudyDate)
      ? (ls.lastStudyDate >= cs.lastStudyDate ? ls.lastStudyDate : cs.lastStudyDate)
      : (ls.lastStudyDate || cs.lastStudyDate);

    return merged;
  }

  function uniqueKeys(objA, objB) {
    var keys = {};
    Object.keys(objA || {}).forEach(function(k) { keys[k] = true; });
    Object.keys(objB || {}).forEach(function(k) { keys[k] = true; });
    return Object.keys(keys);
  }

  function hasData(store) {
    return Object.keys(store.study).length > 0 ||
           Object.keys(store.quiz).length > 0 ||
           Object.keys(store.flashcards).length > 0;
  }

  // Count total sections/subsections for a chapter
  function countSections(chapterId) {
    if (!window.DANSK_CHAPTERS) return 0;
    var ch = window.DANSK_CHAPTERS.find(function(c) { return c.id === chapterId; });
    if (!ch) return 0;
    var count = 0;
    ch.sections.forEach(function(s) {
      if (s.subsections && s.subsections.length > 0) {
        count += s.subsections.length;
      } else {
        count += 1;
      }
    });
    return count;
  }

  // Get all leaf section IDs for a chapter
  function getLeafIds(chapterId) {
    if (!window.DANSK_CHAPTERS) return [];
    var ch = window.DANSK_CHAPTERS.find(function(c) { return c.id === chapterId; });
    if (!ch) return [];
    var ids = [];
    ch.sections.forEach(function(s) {
      if (s.subsections && s.subsections.length > 0) {
        s.subsections.forEach(function(ss) { ids.push(ss.id); });
      } else {
        ids.push(s.id);
      }
    });
    return ids;
  }

  window.DanskProgress = {
    // === Cloud Sync ===
    syncOnLogin: function(uid) {
      if (!window.DanskFirebase) return;

      var localStore = getStore();
      var docRef = DanskFirebase.db.collection('users').doc(uid)
                     .collection('progress').doc('data');

      docRef.get().then(function(doc) {
        if (doc.exists) {
          var cloudStore = doc.data();
          // Remove Firestore metadata fields before merging
          delete cloudStore.updatedAt;
          var merged = mergeStores(localStore, cloudStore);
          save(merged);
        } else {
          // First login — push local data to cloud
          if (hasData(localStore)) {
            save(localStore);
          }
        }
      }).catch(function(err) {
        console.warn('Firestore sync failed:', err);
        // Continue with localStorage only
      });
    },

    // === Study ===
    markSectionRead: function(sectionId) {
      var store = getStore();
      store.study[sectionId] = { read: true, readAt: new Date().toISOString() };
      save(store);
      this.recordStudySession();
    },

    isSectionRead: function(sectionId) {
      var store = getStore();
      return !!(store.study[sectionId] && store.study[sectionId].read);
    },

    getChapterProgress: function(chapterId) {
      var store = getStore();
      var ids = getLeafIds(chapterId);
      var read = 0;
      ids.forEach(function(id) {
        if (store.study[id] && store.study[id].read) read++;
      });
      return { read: read, total: ids.length };
    },

    // === Quiz ===
    recordQuizAnswer: function(questionId, isCorrect) {
      var store = getStore();
      var prev = store.quiz[questionId] || { attempts: 0, lastCorrect: false, lastAt: null };
      prev.attempts++;
      prev.lastCorrect = isCorrect;
      prev.lastAt = new Date().toISOString();
      store.quiz[questionId] = prev;
      save(store);
    },

    getQuizStats: function(questionIds) {
      var store = getStore();
      var attempted = 0;
      var correct = 0;
      questionIds.forEach(function(qid) {
        if (store.quiz[qid]) {
          attempted++;
          if (store.quiz[qid].lastCorrect) correct++;
        }
      });
      return { attempted: attempted, correct: correct, total: questionIds.length };
    },

    getWrongQuestionIds: function(questionIds) {
      var store = getStore();
      return questionIds.filter(function(qid) {
        return store.quiz[qid] && !store.quiz[qid].lastCorrect;
      });
    },

    // === Flashcards (SM-2) ===
    getFlashcardState: function(cardId) {
      var store = getStore();
      return store.flashcards[cardId] || {
        interval: 1,
        easeFactor: 2.5,
        nextReview: new Date().toISOString(),
        repetitions: 0
      };
    },

    updateFlashcardState: function(cardId, quality) {
      // quality: 0=hard, 1=good, 2=easy
      var store = getStore();
      var state = store.flashcards[cardId] || {
        interval: 1, easeFactor: 2.5, nextReview: new Date().toISOString(), repetitions: 0
      };

      if (quality === 0) {
        state.repetitions = 0;
        state.interval = 1;
        state.easeFactor = Math.max(1.3, state.easeFactor - 0.2);
      } else {
        state.repetitions++;
        if (state.repetitions === 1) {
          state.interval = 1;
        } else if (state.repetitions === 2) {
          state.interval = 3;
        } else {
          state.interval = Math.round(state.interval * state.easeFactor);
        }
        if (quality === 2) {
          state.interval = Math.round(state.interval * 1.3);
          state.easeFactor = Math.min(3.0, state.easeFactor + 0.15);
        }
      }

      var next = new Date();
      next.setDate(next.getDate() + state.interval);
      state.nextReview = next.toISOString();

      store.flashcards[cardId] = state;
      save(store);
    },

    getDueFlashcards: function(cards) {
      var store = getStore();
      var now = new Date().toISOString();
      return cards.filter(function(card) {
        var state = store.flashcards[card.id];
        if (!state) return true; // new card
        return state.nextReview <= now;
      });
    },

    getMasteredCount: function(cardIds) {
      var store = getStore();
      var count = 0;
      cardIds.forEach(function(id) {
        var state = store.flashcards[id];
        if (state && state.interval > 21) count++;
      });
      return count;
    },

    // === Streaks ===
    recordStudySession: function() {
      var store = getStore();
      var today = new Date().toISOString().slice(0, 10);
      if (store.streaks.lastStudyDate === today) { save(store); return; }

      var yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      var yStr = yesterday.toISOString().slice(0, 10);

      if (store.streaks.lastStudyDate === yStr) {
        store.streaks.currentStreak++;
      } else {
        store.streaks.currentStreak = 1;
      }
      store.streaks.lastStudyDate = today;
      save(store);
    },

    getStreak: function() {
      var store = getStore();
      var today = new Date().toISOString().slice(0, 10);
      var yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      var yStr = yesterday.toISOString().slice(0, 10);

      if (store.streaks.lastStudyDate === today || store.streaks.lastStudyDate === yStr) {
        return store.streaks.currentStreak;
      }
      return 0;
    },

    // === Aggregate ===
    getOverallStats: function() {
      var store = getStore();
      var sectionsRead = Object.keys(store.study).filter(function(k) {
        return store.study[k].read;
      }).length;

      var totalSections = 0;
      if (window.DANSK_CHAPTERS) {
        window.DANSK_CHAPTERS.forEach(function(ch) {
          totalSections += countSections(ch.id);
        });
      }

      var quizIds = Object.keys(store.quiz);
      var quizCorrect = quizIds.filter(function(k) { return store.quiz[k].lastCorrect; }).length;

      var fcIds = Object.keys(store.flashcards);
      var mastered = 0;
      fcIds.forEach(function(id) {
        if (store.flashcards[id].interval > 21) mastered++;
      });

      return {
        sectionsRead: sectionsRead,
        sectionsTotal: totalSections,
        quizAttempted: quizIds.length,
        quizCorrect: quizCorrect,
        flashcardsMastered: mastered,
        streak: this.getStreak()
      };
    },

    // === Local cache ===
    // Called by auth.js on sign-out to wipe the cached progress blob so
    // any stats rendered from it (streaks, progress bars, etc.) reset.
    // Cloud data is preserved — a later sign-in restores it via syncOnLogin.
    clearLocal: function() {
      localStorage.removeItem(KEY);
    },

    // === Reset ===
    reset: function() {
      localStorage.removeItem(KEY);
      // Also clear cloud data if logged in
      if (window.DanskAuth && DanskAuth.isLoggedIn()) {
        var user = DanskAuth.getUser();
        if (user && window.DanskFirebase) {
          DanskFirebase.db.collection('users').doc(user.uid)
            .collection('progress').doc('data').delete()
            .catch(function(err) { console.warn('Cloud reset failed:', err); });
        }
      }
    }
  };
})();
