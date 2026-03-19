// Shared utilities for Dansk App
// Exposes: window.DanskApp

(function() {
  // Parse URL parameters
  function getParam(name) {
    var params = new URLSearchParams(window.location.search);
    return params.get(name);
  }

  // Render top nav HTML
  function renderTopNav(title, rightHtml) {
    return '<nav class="top-nav">' +
      '<a href="index.html" class="top-nav__title">' + escapeHtml(title || 'Indfødsretsprøven') + '</a>' +
      '<div class="top-nav__right">' + (rightHtml || '') + '</div>' +
      '</nav>';
  }

  // Render back button SVG
  function backArrowSvg() {
    return '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M10 12L6 8L10 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
      '</svg>';
  }

  // Render check icon SVG
  function checkSvg(size) {
    size = size || 14;
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M3 8.5L6.5 12L13 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
      '</svg>';
  }

  // Icons
  function calendarSvg() {
    return '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
      '<rect x="2" y="3" width="12" height="11" rx="1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
      '<path d="M5 1v3M11 1v3M2 7h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
      '</svg>';
  }

  function personSvg() {
    return '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
      '<circle cx="8" cy="5" r="3" stroke="currentColor" stroke-width="1.5"/>' +
      '<path d="M2 14c0-3.3 2.7-5 6-5s6 1.7 6 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
      '</svg>';
  }

  function placeSvg() {
    return '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M8 1C5.2 1 3 3.2 3 6c0 4 5 9 5 9s5-5 5-9c0-2.8-2.2-5-5-5z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
      '<circle cx="8" cy="6" r="1.5" stroke="currentColor" stroke-width="1.5"/>' +
      '</svg>';
  }

  function bookSvg() {
    return '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M2 2h5l1 1 1-1h5v11h-5l-1 1-1-1H2V2z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="M8 3v11" stroke="currentColor" stroke-width="1.5"/>' +
      '</svg>';
  }

  function closeSvg() {
    return '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
      '</svg>';
  }

  function shuffleSvg() {
    return '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M2 4h3l3 4-3 4H2M14 4h-3L8 8l3 4h3M12 2l2 2-2 2M12 10l2 2-2 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
      '</svg>';
  }

  // HTML escape
  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Shuffle array (Fisher-Yates)
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  // Get fact icon SVG
  function factIcon(type) {
    switch (type) {
      case 'date': return calendarSvg();
      case 'person': return personSvg();
      case 'place': return placeSvg();
      default: return bookSvg();
    }
  }

  // Get chapter by id
  function getChapter(chapterId) {
    if (!window.DANSK_CHAPTERS) return null;
    return window.DANSK_CHAPTERS.find(function(c) { return c.id === chapterId; }) || null;
  }

  // Get all leaf sections for a chapter (flat list)
  function getLeafSections(chapterId) {
    var ch = getChapter(chapterId);
    if (!ch) return [];
    var leaves = [];
    ch.sections.forEach(function(s) {
      if (s.subsections && s.subsections.length > 0) {
        s.subsections.forEach(function(ss) {
          leaves.push({ id: ss.id, number: ss.number, titleDa: ss.titleDa, titleEn: ss.titleEn, parentSection: s });
        });
      } else {
        leaves.push({ id: s.id, number: s.number, titleDa: s.titleDa, titleEn: s.titleEn, parentSection: null });
      }
    });
    return leaves;
  }

  // Get content object for a chapter
  function getContentObj(chapterId) {
    var num = chapterId.replace('ch', '');
    return window['DANSK_CONTENT_CH' + num] || {};
  }

  // Get quiz array for a chapter
  function getQuizArr(chapterId) {
    var num = chapterId.replace('ch', '');
    return window['DANSK_QUIZ_CH' + num] || [];
  }

  window.DanskApp = {
    getParam: getParam,
    renderTopNav: renderTopNav,
    backArrowSvg: backArrowSvg,
    checkSvg: checkSvg,
    calendarSvg: calendarSvg,
    personSvg: personSvg,
    placeSvg: placeSvg,
    bookSvg: bookSvg,
    closeSvg: closeSvg,
    shuffleSvg: shuffleSvg,
    escapeHtml: escapeHtml,
    shuffle: shuffle,
    factIcon: factIcon,
    getChapter: getChapter,
    getLeafSections: getLeafSections,
    getContentObj: getContentObj,
    getQuizArr: getQuizArr
  };
})();
