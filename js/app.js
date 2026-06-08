/* Holy Bible — Offline PWA
 * Vanilla JS, no dependencies. All state persisted to localStorage. */
(function () {
  "use strict";

  var APP_VERSION = "1.12.3";
  var DATA_URL = "data/web.json";

  // ----- Book metadata (Old Testament = first 39) -----
  var OT_COUNT = 39;

  // ----- Persistent state -----
  var LS = {
    pos: "bible.pos",
    settings: "bible.settings",
    bookmarks: "bible.bookmarks",
    plan: "bible.plan"
  };
  function load(key, fallback) {
    try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch (e) { return fallback; }
  }
  function save(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }

  var settings = Object.assign(
    { theme: prefersDark() ? "dark" : "light", fontScale: 1, layout: "paragraph", wpm: 400, chunk: 1, rate: 1, voiceName: null, voiceURI: null, funVoices: false },
    load(LS.settings, {})
  );
  var pos = load(LS.pos, { b: 0, c: 0 });
  var bookmarks = load(LS.bookmarks, []);

  var BIBLE = null;          // array of { name, abbrev, chapters: [ [verse,...] ] }
  var selectedVerse = null;  // {b,c,v} currently highlighted

  // ----- DOM helpers -----
  var $ = function (id) { return document.getElementById(id); };
  var els = {};
  ["btnBooks","btnRef","refText","btnSearch","btnMenu","reader","loading","chapter",
   "btnPrev","btnNext","btnPickChapter","navRef","verseActions","verseActionsRef","vaBookmarkLabel",
   "booksPanel","bookList","chapterPanel","chapterPanelTitle","chapterGrid",
   "searchPanel","searchInput","searchClear","searchMeta","searchResults","searchScope","scopeBook",
   "settingsPanel","fontMinus","fontPlus","fontVal","bookmarkList","bookmarkCount",
   "btnInstall","installHint","storageInfo","appVersion","scrim","toast",
   "btnSpeed","speedReader","speedClose","speedRef","speedWpm","speedWord","speedHint",
   "speedBar","speedPlay","speedPlayIcon","speedSlower","speedFaster","speedBack","speedFwd","speedChunkSeg",
   "speedPrevCh","speedNextCh",
   "btnListen","audioBar","audioPlay","audioPlayIcon","audioRef","audioVoice","audioSlower","audioFaster",
   "audioRate","audioVoiceBtn","audioStop","voicePanel","voiceList","voiceFilter","voiceNote",
   "btnPlan","planLaunchSub","planPanel","planPrev","planNext","planToday","planDayLabel","planDayNum",
   "planReadings","planBar","planProgressLabel","planSpeedDay","planListenDay","fabPlan","fabDot",
   "studyPanel","studyRef","studyContent","studyCredit"
  ].forEach(function (id) { els[id] = $(id); });

  function prefersDark() {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  // ======================================================================
  // Boot
  // ======================================================================
  applySettings();
  els.appVersion.textContent = APP_VERSION;

  fetch(DATA_URL)
    .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
    .then(function (data) {
      BIBLE = data;
      if (!validPos(pos)) pos = { b: 0, c: 0 };
      buildBookList();
      renderChapter(true);
      els.loading.hidden = true;
      els.chapter.hidden = false;
      reportStorage();
    })
    .catch(function (err) {
      els.loading.innerHTML =
        '<p style="color:var(--text-dim);text-align:center;max-width:300px">' +
        "Couldn't load the Bible text.<br>If this is your first visit, please connect to the internet once so it can be saved for offline use.<br><br><small>" +
        String(err) + "</small></p>";
    });

  function validPos(p) {
    return p && BIBLE[p.b] && BIBLE[p.b].chapters[p.c];
  }

  // ======================================================================
  // Rendering
  // ======================================================================
  function renderChapter(scrollTop) {
    var book = BIBLE[pos.b];
    var verses = book.chapters[pos.c];
    var ref = book.name + " " + (pos.c + 1);
    els.refText.textContent = ref;
    els.navRef.textContent = ref;
    document.title = ref + " — Holy Bible";

    var bmSet = bookmarkSetForChapter(pos.b, pos.c);

    var html = '<h1>' + esc(book.name) + '</h1>' +
               '<p class="ch-sub">Chapter ' + (pos.c + 1) + ' · ' + verses.length + ' verses</p>' +
               '<button class="ch-commentary" type="button">' +
               '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 5a2 2 0 0 1 2-2h7v16H6a2 2 0 0 0-2 2zM20 3v16a2 2 0 0 0-2 2h-5V3z"/></svg>' +
               'Commentary &amp; study</button>' +
               '<p class="verses">';
    for (var i = 0; i < verses.length; i++) {
      var vn = i + 1;
      var cls = "v" + (bmSet[vn] ? " bookmarked" : "");
      html += '<span class="' + cls + '" data-v="' + vn + '">' +
              '<span class="vn">' + vn + '</span>' + esc(verses[i]) + ' </span>';
    }
    html += '</p>';
    els.chapter.innerHTML = html;
    els.chapter.className = "chapter layout-" + settings.layout;

    els.btnPrev.disabled = (pos.b === 0 && pos.c === 0);
    els.btnNext.disabled = (pos.b === BIBLE.length - 1 && pos.c === book.chapters.length - 1);

    if (scrollTop) els.reader.scrollTop = 0;
    clearVerseSelection();
    save(LS.pos, pos);
  }

  function esc(s) {
    return s.replace(/[&<>]/g, function (c) {
      return c === "&" ? "&amp;" : c === "<" ? "&lt;" : "&gt;";
    });
  }

  // ======================================================================
  // Navigation
  // ======================================================================
  function goChapter(b, c) {
    if (typeof stopListen === "function") stopListen(); // end audio on manual nav
    pos = { b: b, c: c };
    renderChapter(true);
  }
  function nextChapter() {
    var book = BIBLE[pos.b];
    if (pos.c < book.chapters.length - 1) goChapter(pos.b, pos.c + 1);
    else if (pos.b < BIBLE.length - 1) goChapter(pos.b + 1, 0);
  }
  function prevChapter() {
    if (pos.c > 0) goChapter(pos.b, pos.c - 1);
    else if (pos.b > 0) goChapter(pos.b - 1, BIBLE[pos.b - 1].chapters.length - 1);
  }

  els.btnNext.addEventListener("click", nextChapter);
  els.btnPrev.addEventListener("click", prevChapter);

  // swipe navigation
  (function () {
    var x0 = null, y0 = null;
    els.reader.addEventListener("touchstart", function (e) {
      x0 = e.touches[0].clientX; y0 = e.touches[0].clientY;
    }, { passive: true });
    els.reader.addEventListener("touchend", function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0;
      var dy = e.changedTouches[0].clientY - y0;
      if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.6) {
        if (dx < 0) nextChapter(); else prevChapter();
      }
      x0 = y0 = null;
    }, { passive: true });
  })();

  // keyboard
  document.addEventListener("keydown", function (e) {
    if (anyPanelOpen() || e.target.tagName === "INPUT" || !els.speedReader.hidden) return;
    if (e.key === "ArrowRight") nextChapter();
    else if (e.key === "ArrowLeft") prevChapter();
  });

  // ======================================================================
  // Books panel
  // ======================================================================
  var currentTestament = "ot";
  function buildBookList() {
    renderBookList();
    var segBtns = els.booksPanel.querySelectorAll("[data-testament]");
    segBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        segBtns.forEach(function (b) { b.classList.remove("active"); });
        btn.classList.add("active");
        currentTestament = btn.getAttribute("data-testament");
        renderBookList();
      });
    });
  }
  function renderBookList() {
    var start = currentTestament === "ot" ? 0 : OT_COUNT;
    var end = currentTestament === "ot" ? OT_COUNT : BIBLE.length;
    var html = "";
    for (var i = start; i < end; i++) {
      var b = BIBLE[i];
      html += '<li data-b="' + i + '"' + (i === pos.b ? ' class="current"' : "") + '>' +
              '<span>' + esc(b.name) + '</span>' +
              '<span class="bk-ch">' + b.chapters.length + ' ch</span></li>';
    }
    els.bookList.innerHTML = html;
  }
  els.bookList.addEventListener("click", function (e) {
    var li = e.target.closest("li[data-b]");
    if (!li) return;
    var b = +li.getAttribute("data-b");
    closePanels();
    openChapterPicker(b);
  });

  // sync testament tab to current book when opening
  function openBooks() {
    currentTestament = pos.b < OT_COUNT ? "ot" : "nt";
    els.booksPanel.querySelectorAll("[data-testament]").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-testament") === currentTestament);
    });
    renderBookList();
    openPanel(els.booksPanel);
    var cur = els.bookList.querySelector("li.current");
    if (cur) cur.scrollIntoView({ block: "center" });
  }

  // ======================================================================
  // Chapter picker
  // ======================================================================
  var pickerBook = 0;
  function openChapterPicker(b) {
    pickerBook = (typeof b === "number") ? b : pos.b;
    var book = BIBLE[pickerBook];
    els.chapterPanelTitle.textContent = book.name;
    var html = "";
    for (var c = 0; c < book.chapters.length; c++) {
      var cur = (pickerBook === pos.b && c === pos.c) ? ' class="current"' : "";
      html += '<button data-c="' + c + '"' + cur + ">" + (c + 1) + "</button>";
    }
    els.chapterGrid.innerHTML = html;
    openPanel(els.chapterPanel);
  }
  els.chapterGrid.addEventListener("click", function (e) {
    var btn = e.target.closest("button[data-c]");
    if (!btn) return;
    closePanels();
    goChapter(pickerBook, +btn.getAttribute("data-c"));
  });

  els.btnBooks.addEventListener("click", openBooks);
  els.btnRef.addEventListener("click", function () { openChapterPicker(pos.b); });
  els.btnPickChapter.addEventListener("click", function () { openChapterPicker(pos.b); });

  // ======================================================================
  // Verse selection + actions
  // ======================================================================
  els.chapter.addEventListener("click", function (e) {
    if (e.target.closest(".ch-commentary")) { openStudyChapter(pos.b, pos.c); return; }
    var v = e.target.closest(".v");
    if (!v) return;
    var vn = +v.getAttribute("data-v");
    if (selectedVerse && selectedVerse.v === vn && selectedVerse.b === pos.b && selectedVerse.c === pos.c) {
      clearVerseSelection();
      return;
    }
    clearVerseSelection();
    v.classList.add("selected");
    selectedVerse = { b: pos.b, c: pos.c, v: vn };
    showVerseActions();
  });

  function clearVerseSelection() {
    var sel = els.chapter.querySelector(".v.selected");
    if (sel) sel.classList.remove("selected");
    selectedVerse = null;
    els.verseActions.hidden = true;
  }

  function verseRef(s) { return BIBLE[s.b].name + " " + (s.c + 1) + ":" + s.v; }
  function verseText(s) { return BIBLE[s.b].chapters[s.c][s.v - 1]; }

  function showVerseActions() {
    els.verseActionsRef.textContent = verseRef(selectedVerse);
    els.vaBookmarkLabel.textContent = isBookmarked(selectedVerse) ? "Remove" : "Bookmark";
    els.verseActions.hidden = false;
  }

  els.verseActions.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-act]");
    if (!btn || !selectedVerse) return;
    var act = btn.getAttribute("data-act");
    var s = selectedVerse;
    if (act === "study") { openStudy(s); }
    else if (act === "bookmark") { toggleBookmark(s); showVerseActions(); }
    else if (act === "copy") { copyText(verseRef(s) + " — " + verseText(s) + " (WEB)"); }
    else if (act === "share") { shareVerse(s); }
    else if (act === "close") { clearVerseSelection(); }
  });

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { toast("Copied"); }, function () { toast("Couldn't copy"); });
    } else {
      var ta = document.createElement("textarea");
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); toast("Copied"); } catch (e) {}
      document.body.removeChild(ta);
    }
  }
  function shareVerse(s) {
    var text = verseRef(s) + " — " + verseText(s) + " (WEB)";
    if (navigator.share) {
      navigator.share({ title: verseRef(s), text: text }).catch(function () {});
    } else {
      copyText(text);
    }
  }

  // ======================================================================
  // Bookmarks
  // ======================================================================
  function bmKey(s) { return s.b + ":" + s.c + ":" + s.v; }
  function isBookmarked(s) {
    return bookmarks.some(function (m) { return m.b === s.b && m.c === s.c && m.v === s.v; });
  }
  function toggleBookmark(s) {
    var idx = bookmarks.findIndex(function (m) { return m.b === s.b && m.c === s.c && m.v === s.v; });
    if (idx >= 0) { bookmarks.splice(idx, 1); toast("Bookmark removed"); }
    else {
      bookmarks.unshift({ b: s.b, c: s.c, v: s.v, ref: verseRef(s), text: verseText(s), ts: Date.now() });
      toast("Bookmarked");
    }
    save(LS.bookmarks, bookmarks);
    // update verse styling in place
    var node = els.chapter.querySelector('.v[data-v="' + s.v + '"]');
    if (node && s.b === pos.b && s.c === pos.c) node.classList.toggle("bookmarked", isBookmarked(s));
    renderBookmarkList();
  }
  function bookmarkSetForChapter(b, c) {
    var set = {};
    bookmarks.forEach(function (m) { if (m.b === b && m.c === c) set[m.v] = true; });
    return set;
  }
  function renderBookmarkList() {
    els.bookmarkCount.textContent = bookmarks.length ? bookmarks.length + " saved" : "";
    if (!bookmarks.length) {
      els.bookmarkList.innerHTML = '<li class="bookmark-empty">Tap a verse number while reading to bookmark it.</li>';
      return;
    }
    var html = "";
    bookmarks.forEach(function (m, i) {
      html += '<li data-i="' + i + '">' +
              '<span class="bm-ref">' + esc(m.ref) + '</span>' +
              '<span class="bm-text">' + esc(m.text) + '</span>' +
              '<span class="bm-del" data-del="' + i + '" aria-label="Delete">' +
              '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></span></li>';
    });
    els.bookmarkList.innerHTML = html;
  }
  els.bookmarkList.addEventListener("click", function (e) {
    var del = e.target.closest("[data-del]");
    if (del) {
      e.stopPropagation();
      bookmarks.splice(+del.getAttribute("data-del"), 1);
      save(LS.bookmarks, bookmarks);
      renderBookmarkList();
      if (BIBLE) renderChapter(false);
      return;
    }
    var li = e.target.closest("li[data-i]");
    if (!li) return;
    var m = bookmarks[+li.getAttribute("data-i")];
    closePanels();
    goChapter(m.b, m.c);
    setTimeout(function () { flashVerse(m.v); }, 60);
  });
  function flashVerse(vn) {
    var node = els.chapter.querySelector('.v[data-v="' + vn + '"]');
    if (!node) return;
    node.classList.add("selected");
    node.scrollIntoView({ block: "center" });
    selectedVerse = { b: pos.b, c: pos.c, v: vn };
    showVerseActions();
  }

  // ======================================================================
  // Search
  // ======================================================================
  var searchTimer = null, searchScope = "all", searchBook = 0;
  els.btnSearch.addEventListener("click", function () {
    searchBook = pos.b;
    els.scopeBook.textContent = BIBLE[pos.b].name;
    openPanel(els.searchPanel);
    setTimeout(function () { els.searchInput.focus(); }, 80);
  });
  els.searchInput.addEventListener("input", function () {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(runSearch, 180);
  });
  els.searchClear.addEventListener("click", function () {
    els.searchInput.value = ""; els.searchInput.focus(); runSearch();
  });
  els.searchScope.addEventListener("click", function (e) {
    var c = e.target.closest("[data-scope]");
    if (!c) return;
    searchScope = c.getAttribute("data-scope");
    els.searchScope.querySelectorAll("[data-scope]").forEach(function (b) {
      b.classList.toggle("active", b === c);
    });
    runSearch();
  });

  function scopeRange() {
    if (searchScope === "ot") return [0, OT_COUNT];
    if (searchScope === "nt") return [OT_COUNT, BIBLE.length];
    if (searchScope === "book") return [searchBook, searchBook + 1];
    return [0, BIBLE.length];
  }
  function scopeLabel() {
    if (searchScope === "ot") return "the Old Testament";
    if (searchScope === "nt") return "the New Testament";
    if (searchScope === "book") return BIBLE[searchBook].name;
    return "the whole Bible";
  }

  function runSearch() {
    var q = els.searchInput.value.trim();
    if (q.length < 2) {
      els.searchMeta.textContent = 'Search ' + scopeLabel() + '. Tip: multiple words match verses containing all of them; wrap in "quotes" for an exact phrase.';
      els.searchResults.innerHTML = "";
      return;
    }
    // "quoted" -> exact phrase; otherwise every word must appear (AND).
    var phrase = q.match(/^"(.+)"$/);
    var terms = phrase ? [phrase[1]] : q.split(/\s+/).filter(Boolean);
    var lowTerms = terms.map(function (t) { return t.toLowerCase(); });
    var range = scopeRange(), results = [], MAX = 300;
    for (var b = range[0]; b < range[1] && results.length < MAX; b++) {
      var chs = BIBLE[b].chapters;
      for (var c = 0; c < chs.length && results.length < MAX; c++) {
        var vs = chs[c];
        for (var v = 0; v < vs.length; v++) {
          var low = vs[v].toLowerCase();
          var hit = true;
          for (var t = 0; t < lowTerms.length; t++) { if (low.indexOf(lowTerms[t]) === -1) { hit = false; break; } }
          if (hit) {
            results.push({ b: b, c: c, v: v + 1, text: vs[v] });
            if (results.length >= MAX) break;
          }
        }
      }
    }
    els.searchMeta.textContent = results.length
      ? ((results.length >= MAX ? "Showing first " + MAX : results.length + " match" + (results.length === 1 ? "" : "es")) + " in " + scopeLabel())
      : "No matches in " + scopeLabel() + ".";
    var html = "";
    results.forEach(function (r) {
      html += '<div class="search-result" data-b="' + r.b + '" data-c="' + r.c + '" data-v="' + r.v + '">' +
              '<div class="sr-ref">' + esc(BIBLE[r.b].name + " " + (r.c + 1) + ":" + r.v) + '</div>' +
              '<div class="sr-text">' + highlightTerms(r.text, terms) + '</div></div>';
    });
    els.searchResults.innerHTML = html || '<p class="search-empty">No verses in ' + esc(scopeLabel()) + ' match that.</p>';
    els.searchResults.scrollTop = 0;
  }
  function highlightTerms(text, terms) {
    var escd = terms.map(function (t) { return t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }).filter(Boolean);
    if (!escd.length) return esc(text);
    var re = new RegExp("(" + escd.join("|") + ")", "gi");
    var out = "", last = 0, m;
    while ((m = re.exec(text))) {
      if (m.index === re.lastIndex) { re.lastIndex++; continue; }
      out += esc(text.slice(last, m.index)) + "<mark>" + esc(m[0]) + "</mark>";
      last = m.index + m[0].length;
    }
    return out + esc(text.slice(last));
  }
  els.searchResults.addEventListener("click", function (e) {
    var r = e.target.closest(".search-result");
    if (!r) return;
    closePanels();
    goChapter(+r.getAttribute("data-b"), +r.getAttribute("data-c"));
    setTimeout(function () { flashVerse(+r.getAttribute("data-v")); }, 60);
  });

  // ======================================================================
  // Settings
  // ======================================================================
  els.btnMenu.addEventListener("click", function () {
    renderBookmarkList();
    openPanel(els.settingsPanel);
  });

  // theme
  els.settingsPanel.querySelectorAll("[data-theme-set]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      settings.theme = btn.getAttribute("data-theme-set");
      applySettings(); save(LS.settings, settings);
    });
  });
  // layout
  els.settingsPanel.querySelectorAll("[data-layout]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      settings.layout = btn.getAttribute("data-layout");
      applySettings(); save(LS.settings, settings);
      if (BIBLE) renderChapter(false);
    });
  });
  // font
  els.fontMinus.addEventListener("click", function () { changeFont(-0.1); });
  els.fontPlus.addEventListener("click", function () { changeFont(0.1); });
  function changeFont(delta) {
    settings.fontScale = Math.min(1.8, Math.max(0.8, Math.round((settings.fontScale + delta) * 10) / 10));
    applySettings(); save(LS.settings, settings);
  }

  function applySettings() {
    document.documentElement.setAttribute("data-theme", settings.theme);
    document.documentElement.style.setProperty("--font-scale", settings.fontScale);
    els.fontVal.textContent = Math.round(settings.fontScale * 100) + "%";
    var tc = settings.theme === "light" ? "#4f46e5" : settings.theme === "sepia" ? "#9a6b2f" : "#4338ca";
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", tc);
    // reflect active buttons
    els.settingsPanel.querySelectorAll("[data-theme-set]").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-theme-set") === settings.theme);
    });
    els.settingsPanel.querySelectorAll("[data-layout]").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-layout") === settings.layout);
    });
  }

  function reportStorage() {
    if (navigator.storage && navigator.storage.estimate) {
      navigator.storage.estimate().then(function (e) {
        if (e.usage) {
          els.storageInfo.textContent = "Using " + (e.usage / 1048576).toFixed(1) + " MB of device storage.";
        }
      });
    }
  }

  // ======================================================================
  // Panel plumbing
  // ======================================================================
  var openPanels = [];
  function openPanel(p) {
    p.hidden = false;
    els.scrim.hidden = false;
    openPanels.push(p);
  }
  function closePanels() {
    openPanels.forEach(function (p) { p.hidden = true; });
    openPanels = [];
    els.scrim.hidden = true;
  }
  function anyPanelOpen() { return openPanels.length > 0; }

  els.scrim.addEventListener("click", closePanels);
  document.querySelectorAll("[data-close]").forEach(function (btn) {
    btn.addEventListener("click", closePanels);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { closePanels(); clearVerseSelection(); }
  });

  // ======================================================================
  // Toast
  // ======================================================================
  var toastTimer = null;
  function toast(msg) {
    els.toast.textContent = msg;
    els.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { els.toast.hidden = true; }, 1900);
  }

  // ======================================================================
  // Install (A2HS)
  // ======================================================================
  var deferredPrompt = null;
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferredPrompt = e;
    els.btnInstall.hidden = false;
    els.installHint.textContent = "Add the Bible to your home screen for one-tap offline access.";
  });
  els.btnInstall.addEventListener("click", function () {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(function (res) {
      if (res.outcome === "accepted") { els.btnInstall.hidden = true; els.installHint.textContent = "Installed. Look for the Bible icon on your home screen."; }
      deferredPrompt = null;
    });
  });
  window.addEventListener("appinstalled", function () {
    els.btnInstall.hidden = true;
    els.installHint.textContent = "Installed — enjoy reading offline.";
  });
  // iOS hint (no beforeinstallprompt support)
  if (isIOS() && !navigator.standalone) {
    els.installHint.textContent = "To install: tap the Share button, then “Add to Home Screen”.";
  }
  function isIOS() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  }

  // ======================================================================
  // Study — cross-references (Treasury of Scripture Knowledge, openbible.info)
  // and Matthew Henry's Concise Commentary. Both loaded lazily and cached.
  // ======================================================================
  var TSK_URL = "data/tsk.json", MHC_URL = "data/mhc.json", EASTON_URL = "data/easton.json", LEX_URL = "data/lexicon.json";
  var tskData = null, mhcData = null, eastonData = null, lexData = null, lexKeys = null;
  var studyVerse = null, studyTab = "xref", dictQuery = "", lexQuery = "";

  function studyLoaded() { return tskData && mhcData && eastonData && lexData; }
  function loadStudyData(cb) {
    if (studyLoaded()) { cb(); return; }
    els.studyContent.innerHTML = '<p class="study-loading">Loading study tools…</p>';
    var get = function (have, url) { return have ? Promise.resolve(have) : fetch(url).then(function (r) { return r.json(); }); };
    Promise.all([get(tskData, TSK_URL), get(mhcData, MHC_URL), get(eastonData, EASTON_URL), get(lexData, LEX_URL)])
      .then(function (res) {
        tskData = res[0]; mhcData = res[1]; eastonData = res[2]; lexData = res[3];
        lexKeys = Object.keys(lexData); cb();
      })
      .catch(function () {
        els.studyContent.innerHTML = '<p class="study-empty">Couldn’t load study data. Connect to the internet once so it can be saved for offline use.</p>';
      });
  }

  function stripTags(t) { return (t || "").replace(/<[^>]+>/g, ""); }

  // ---- Tappable scripture references --------------------------------------
  // Map of abbreviations -> book index. Includes English (for Easton) and the
  // unambiguous Portuguese/Latin forms the commentary uses; anything ambiguous
  // (e.g. "Jo", "Co") or apocryphal is deliberately left out so it stays plain
  // text rather than linking to the wrong place.
  var REF_ABBR = (function () {
    var m = {};
    function add(i, list) { list.forEach(function (a) { m[a] = i; }); }
    add(0, ["gen","ge","gn","genesis"]);            add(1, ["ex","exo","exod","exodus"]);
    add(2, ["lev","lv","leviticus"]);               add(3, ["num","nm","numbers"]);
    add(4, ["deut","dt","deuteronomy"]);            add(5, ["josh","jos","js","joshua"]);
    add(6, ["judg","jdg","jz","judges"]);           add(7, ["ruth","rt"]);
    add(8, ["1sam","1sa","1sm","1samuel"]);         add(9, ["2sam","2sa","2sm","2samuel"]);
    add(10,["1kings","1kgs","1ki","1rs"]);          add(11,["2kings","2kgs","2ki","2rs"]);
    add(12,["1chr","1ch","1cr","1chronicles"]);     add(13,["2chr","2ch","2cr","2chronicles"]);
    add(14,["ezra","ezr","ed"]);                    add(15,["neh","ne","nehemiah"]);
    add(16,["esth","est","esther"]);                add(17,["job"]);
    add(18,["ps","psa","psalm","psalms","sl"]);     add(19,["prov","prv","pv","proverbs"]);
    add(20,["eccl","eccles","ecclesiastes"]);       add(21,["song","sos","cant","ct","canticles"]);
    add(22,["isa","isaiah"]);                       add(23,["jer","jr","jeremiah"]);
    add(24,["lam","lamentations"]);                 add(25,["ezek","ezk","ez","ezekiel"]);
    add(26,["dan","dn","daniel"]);                  add(27,["hos","hosea"]);
    add(28,["joel","jl"]);                          add(29,["amos"]);
    add(30,["obad","obadiah"]);                     add(31,["jonah","jnh"]);
    add(32,["mic","mq","micah"]);                   add(33,["nah","nahum"]);
    add(34,["hab","habakkuk"]);                     add(35,["zeph","sf","zephaniah"]);
    add(36,["hag","haggai"]);                       add(37,["zech","zc","zechariah"]);
    add(38,["mal","ml","malachi"]);                 add(39,["matt","mt","matthew"]);
    add(40,["mark","mk","mc","mrk"]);               add(41,["luke","lk","lc","luk"]);
    add(42,["john","jhn","joh"]);                   add(43,["acts","at","act"]);
    add(44,["rom","rm","romans"]);                  add(45,["1cor","1co","1corinthians"]);
    add(46,["2cor","2co","2corinthians"]);          add(47,["gal","gl","galatians"]);
    add(48,["eph","ef","ephesians"]);               add(49,["phil","php","fp","philippians"]);
    add(50,["col","cl","colossians"]);              add(51,["1thess","1th","1ts"]);
    add(52,["2thess","2th","2ts"]);                 add(53,["1tim","1ti","1tm"]);
    add(54,["2tim","2ti","2tm"]);                   add(55,["titus","tit","tt"]);
    add(56,["philem","phlm","phm","philemon"]);     add(57,["heb","hb","hebrews"]);
    add(58,["jas","jam","tg","james"]);             add(59,["1pet","1pe","1pt"]);
    add(60,["2pet","2pe","2pt"]);                   add(61,["1john","1jn","1jo"]);
    add(62,["2john","2jn","2jo"]);                  add(63,["3john","3jn","3jo"]);
    add(64,["jude"]);                               add(65,["rev","rv","ap","apoc","revelation"]);
    return m;
  })();
  function refBook(s) { var k = s.toLowerCase().replace(/\./g, "").replace(/\s+/g, ""); return (k in REF_ABBR) ? REF_ABBR[k] : -1; }

  function refSpan(bi, chap, verse, label) {
    if (bi < 0 || !BIBLE[bi] || chap < 1 || chap > BIBLE[bi].chapters.length) return null;
    var v = (verse >= 1 && verse <= BIBLE[bi].chapters[chap - 1].length) ? verse : 1;
    return '<span class="ref" data-b="' + bi + '" data-c="' + (chap - 1) + '" data-v="' + v + '">' + esc(label) + '</span>';
  }

  // Linkify references in a clean reference string (Easton reflink contents),
  // carrying the last book/chapter across "; 3:22" style continuations.
  function linkRefString(content, st) {
    var parts = content.split(/([;,])/);
    return parts.map(function (p) {
      if (p === ";" || p === ",") return esc(p);
      var s = p.trim();
      if (!s) return esc(p);
      var lead = p.slice(0, p.indexOf(s)), tail = p.slice(p.indexOf(s) + s.length);
      var m, bi, c, v, label;
      if ((m = s.match(/^((?:[1-3]\s*)?[A-Za-z][A-Za-z.]*)\s+(\d+):(\d+)/))) {
        bi = refBook(m[1]); c = +m[2]; v = +m[3]; label = m[0];
      } else if ((m = s.match(/^(\d+):(\d+)/))) {
        bi = st.b; c = +m[1]; v = +m[2]; label = m[0];
      } else if ((m = s.match(/^(\d+)/)) && st.b >= 0 && st.c > 0) {
        bi = st.b; c = st.c; v = +m[1]; label = m[0];
      } else if ((m = s.match(/^((?:[1-3]\s*)?[A-Za-z][A-Za-z.]*)\s+(\d+)\b/))) {
        bi = refBook(m[1]); c = +m[2]; v = 1; label = m[0];
      } else return esc(p);
      var span = refSpan(bi, c, v, label);
      if (!span) return esc(p);
      st.b = bi; st.c = c;
      return esc(lead) + span + esc(s.slice(label.length)) + esc(tail);
    }).join("");
  }
  function linkifyEaston(text) {
    var st = { b: -1, c: 0 }, out = "", last = 0, m, re = /<reflink>([\s\S]*?)<\/reflink>/g;
    while ((m = re.exec(text))) {
      out += esc(text.slice(last, m.index)) + linkRefString(m[1], st);
      last = re.lastIndex;
    }
    return out + esc(text.slice(last));
  }

  // Linkify references inside prose (commentary): "Book c:v" (known abbrevs only)
  // and "ver. N" (relative to the passage's chapter). Unknown -> left as text.
  function linkifyProse(text, ctxB, ctxC) {
    var out = "", last = 0, m;
    var re = /\b((?:[1-3]\s*)?[A-Za-z]{2,12})\.?\s+(\d+):(\d+)|\bver(?:se)?\.?\s+(\d+)/g;
    while ((m = re.exec(text))) {
      out += esc(text.slice(last, m.index));
      var span = null;
      if (m[1] !== undefined) span = refSpan(refBook(m[1]), +m[2], +m[3], m[0]);
      else span = refSpan(ctxB, ctxC + 1, +m[4], m[0]);
      out += span || esc(m[0]);
      last = re.lastIndex;
    }
    return out + esc(text.slice(last));
  }

  function openStudy(s) {
    studyVerse = { b: s.b, c: s.c, v: s.v };
    dictQuery = ""; lexQuery = "";
    setStudyTab("xref");
    els.studyRef.textContent = verseRef(studyVerse);
    clearVerseSelection();
    openPanel(els.studyPanel);
    loadStudyData(renderStudy);
  }

  // Open the study panel for a whole chapter (no specific verse) — defaults to
  // the commentary tab. studyVerse.v = 0 signals "chapter-level".
  function openStudyChapter(b, c) {
    studyVerse = { b: b, c: c, v: 0 };
    dictQuery = ""; lexQuery = "";
    setStudyTab("comm");
    els.studyRef.textContent = BIBLE[b].name + " " + (c + 1);
    clearVerseSelection();
    openPanel(els.studyPanel);
    loadStudyData(renderStudy);
  }

  function setStudyTab(tab) {
    studyTab = tab;
    els.studyPanel.querySelectorAll("[data-studytab]").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-studytab") === tab);
    });
  }

  function renderStudy() {
    if (studyTab === "xref") renderXrefs();
    else if (studyTab === "comm") renderCommentary();
    else if (studyTab === "dict") renderDictionary();
    else if (studyTab === "lex") renderLexicon();
    else renderInterlinear();
  }

  // ---- Interlinear (KJV with Strong's, lazy-loaded — it's large) ----
  var KJV_URL = "data/kjvtagged.json", kjvTagged = null;
  function loadInterlinear(cb) {
    if (kjvTagged) { cb(); return; }
    fetch(KJV_URL).then(function (r) { return r.json(); })
      .then(function (d) { kjvTagged = d; cb(); })
      .catch(function () {
        els.studyContent.innerHTML = '<p class="study-empty">Couldn’t load the interlinear. Connect to the internet once so it can be saved for offline use.</p>';
      });
  }
  function parseInterlinear(s) {
    return s.split(" ").map(function (tok) {
      var m = tok.match(/^(.*?)((?:\[[GH]\d+\])+)$/);
      if (m && m[1]) {
        var num = m[2].match(/\[([GH]\d+)\]/)[1];
        var e = lexData && lexData[num];
        var orig = (e && e.l) ? '<span class="iw-orig"' + (num.charAt(0) === "H" ? ' dir="rtl"' : "") + ">" + esc(e.l) + "</span>" : "";
        var xlit = (e && e.x) ? '<span class="iw-x">' + esc(e.x) + "</span>" : "";
        return '<span class="iw" data-s="' + num + '"><span class="iw-en">' + esc(m[1]) + "</span>" + orig + xlit + "</span>";
      }
      return '<span class="iw-plain">' + esc(tok.replace(/\[[GH]\d+\]/g, "")) + "</span>";
    }).join("");
  }
  function renderInterlinear() {
    els.studyCredit.textContent = "KJV with Strong’s numbers (public domain)";
    if (studyVerse.v === 0) {
      els.studyContent.innerHTML = '<p class="study-empty">Tap a verse to see its Strong’s interlinear.</p>';
      return;
    }
    if (!kjvTagged) {
      els.studyContent.innerHTML = '<p class="study-loading">Loading interlinear…</p>';
      loadInterlinear(function () { if (studyTab === "intr") renderInterlinear(); });
      return;
    }
    var bk = kjvTagged[studyVerse.b];
    var verse = bk && bk[studyVerse.c] && bk[studyVerse.c][studyVerse.v - 1];
    if (!verse) { els.studyContent.innerHTML = '<p class="study-empty">No interlinear for this verse.</p>'; return; }
    els.studyContent.innerHTML =
      '<p class="dict-hint">King James Version — tap a highlighted word for its Strong’s entry.</p>' +
      '<div class="intr">' + parseInterlinear(verse) + '</div>';
  }

  function renderXrefs() {
    els.studyCredit.textContent = "Cross-references: openbible.info (CC BY)";
    if (studyVerse.v === 0) {
      els.studyContent.innerHTML = '<p class="study-empty">Tap a verse in the chapter to see its cross-references.</p>';
      return;
    }
    var key = studyVerse.b + "." + studyVerse.c + "." + studyVerse.v;
    var refs = (tskData && tskData[key]) || [];
    if (!refs.length) {
      els.studyContent.innerHTML = '<p class="study-empty">No cross-references for this verse.</p>';
      return;
    }
    var html = "";
    refs.forEach(function (t, i) {
      var bi = t[0], c0 = t[1], v1 = t[2];
      var label = BIBLE[bi].name + " " + (c0 + 1) + ":" + v1;
      if (t.length >= 5) label += "–" + (t[3] + 1) + ":" + t[4];
      var text = (BIBLE[bi].chapters[c0] && BIBLE[bi].chapters[c0][v1 - 1]) || "";
      html += '<button class="xref" data-b="' + bi + '" data-c="' + c0 + '" data-v="' + v1 + '">' +
        '<div class="xref-ref">' + esc(label) + '</div>' +
        '<div class="xref-text">' + esc(text) + '</div></button>';
    });
    els.studyContent.innerHTML = html;
  }

  function renderCommentary() {
    els.studyCredit.textContent = "Matthew Henry’s Concise Commentary (public domain)";
    var bk = mhcData && mhcData[studyVerse.b];
    var passages = bk && bk[String(studyVerse.c + 1)];
    if (!passages || !passages.length) {
      els.studyContent.innerHTML = '<p class="study-empty">No commentary for this chapter.</p>';
      return;
    }
    var html = "";
    passages.forEach(function (p) {
      var s = p[0], e = p[1], text = p[2];
      var range = (s === e) ? ("v" + s) : ("v" + s + "–" + e);
      var isCur = studyVerse.v >= s && studyVerse.v <= e;
      html += '<div class="comm-passage">' +
        '<div class="comm-range">' + BIBLE[studyVerse.b].name + " " + (studyVerse.c + 1) + ":" + (s === e ? s : s + "–" + e) +
        (isCur ? " · this verse" : "") + '</div>' +
        '<div class="comm-text' + (isCur ? " current" : "") + '">' + linkifyProse(stripTags(text), studyVerse.b, studyVerse.c) + '</div></div>';
    });
    els.studyContent.innerHTML = html;
    // scroll the passage containing the tapped verse into view
    var cur = els.studyContent.querySelector(".comm-text.current");
    if (cur) cur.scrollIntoView({ block: "start" });
  }

  // ---- Dictionary (Easton's) ----
  function eastonEntry(word) {
    var key = String(word).toLowerCase().replace(/[^a-z'’-]/g, "");
    return eastonData && eastonData[key] ? { key: key, e: eastonData[key] } : null;
  }
  function verseDictTerms() {
    if (studyVerse.v === 0) return [];
    var text = (BIBLE[studyVerse.b].chapters[studyVerse.c] || [])[studyVerse.v - 1] || "";
    var seen = {}, out = [];
    text.split(/\s+/).forEach(function (w) {
      var hit = eastonEntry(w);
      if (hit && !seen[hit.key] && hit.key.length >= 3) { seen[hit.key] = 1; out.push(hit.e); }
    });
    return out.slice(0, 10);
  }
  function searchEaston(q) {
    var n = q.toLowerCase(), pre = [], inc = [];
    var keys = Object.keys(eastonData);
    for (var i = 0; i < keys.length && pre.length + inc.length < 40; i++) {
      var k = keys[i];
      if (k.indexOf(n) === 0) pre.push(eastonData[k]);
      else if (k.indexOf(n) !== -1) inc.push(eastonData[k]);
    }
    return pre.concat(inc).slice(0, 30);
  }
  function eastonListHtml(list) {
    if (!list.length) return '<p class="study-empty">No dictionary entries found.</p>';
    return list.map(function (e) {
      return '<div class="dict-entry"><div class="dict-word">' + esc(e.w) +
        '</div><div class="dict-def">' + linkifyEaston(e.d) + '</div></div>';
    }).join("");
  }
  function updateDictResults() {
    var box = els.studyContent.querySelector("#dictResults");
    if (!box) return;
    if (dictQuery && dictQuery.length >= 2) box.innerHTML = eastonListHtml(searchEaston(dictQuery));
    else {
      var terms = verseDictTerms();
      box.innerHTML = terms.length
        ? '<p class="dict-hint">From this verse:</p>' + eastonListHtml(terms)
        : '<p class="dict-hint">Type a word to look it up.</p>';
    }
  }
  function renderDictionary() {
    els.studyCredit.textContent = "Easton’s Bible Dictionary (public domain)";
    els.studyContent.innerHTML =
      '<input id="dictSearch" class="dict-search" type="search" autocomplete="off" ' +
      'placeholder="Look up a word…" value="' + esc(dictQuery) + '"><div id="dictResults"></div>';
    updateDictResults();
  }
  // ---- Strong's lexicon ----
  function lexEntryHtml(num, e) {
    var head = '<span class="lex-num">' + esc(num) + '</span> <span class="lex-lemma">' + esc(e.l) + '</span>';
    if (e.x) head += ' <span class="lex-xlit">' + esc(e.x) + '</span>';
    if (e.p) head += ' <span class="lex-pron">/' + esc(e.p) + '/</span>';
    var body = '<div class="lex-def">' + esc(e.d) + '</div>';
    if (e.k) body += '<div class="lex-kjv"><b>KJV:</b> ' + esc(e.k) + '</div>';
    return '<div class="lex-entry"><div class="lex-head">' + head + '</div>' + body + '</div>';
  }
  function searchLexicon(q) {
    q = q.trim();
    if (!q) return "";
    var numMatch = q.match(/^([hg]?)(\d+)$/i);
    if (numMatch) {
      var keys = numMatch[1] ? [numMatch[1].toUpperCase() + numMatch[2]] : ["G" + numMatch[2], "H" + numMatch[2]];
      var out = "";
      keys.forEach(function (k) { if (lexData[k]) out += lexEntryHtml(k, lexData[k]); });
      return out || '<p class="study-empty">No entry for ' + esc(q) + '.</p>';
    }
    var n = q.toLowerCase(), pre = [], mid = [];
    for (var i = 0; i < lexKeys.length && pre.length + mid.length < 40; i++) {
      var k = lexKeys[i], e = lexData[k];
      var x = (e.x || "").toLowerCase(), l = (e.l || "").toLowerCase();
      if (x.indexOf(n) === 0 || l.indexOf(n) === 0) pre.push([k, e]);
      else if ((e.k || "").toLowerCase().indexOf(n) !== -1 || (e.d || "").toLowerCase().indexOf(n) !== -1) mid.push([k, e]);
    }
    var list = pre.concat(mid).slice(0, 30);
    if (!list.length) return '<p class="study-empty">No entries match “' + esc(q) + '”.</p>';
    return list.map(function (p) { return lexEntryHtml(p[0], p[1]); }).join("");
  }
  function updateLexResults() {
    var box = els.studyContent.querySelector("#lexResults");
    if (!box) return;
    box.innerHTML = (lexQuery && lexQuery.length >= 2)
      ? searchLexicon(lexQuery)
      : '<p class="dict-hint">Search by Strong’s number (e.g. G26, H430) or an English word (e.g. love, grace).</p>';
  }
  function renderLexicon() {
    els.studyCredit.textContent = "Strong’s Hebrew & Greek Dictionary (public domain)";
    els.studyContent.innerHTML =
      '<input id="lexSearch" class="dict-search" type="search" autocomplete="off" ' +
      'placeholder="Strong’s number or word…" value="' + esc(lexQuery) + '"><div id="lexResults"></div>';
    updateLexResults();
  }

  els.studyContent.addEventListener("input", function (e) {
    if (!e.target) return;
    if (e.target.id === "dictSearch") { dictQuery = e.target.value; updateDictResults(); }
    else if (e.target.id === "lexSearch") { lexQuery = e.target.value; updateLexResults(); }
  });

  els.studyPanel.querySelectorAll("[data-studytab]").forEach(function (b) {
    b.addEventListener("click", function () {
      setStudyTab(b.getAttribute("data-studytab"));
      if (studyLoaded()) renderStudy();
      else loadStudyData(renderStudy);
    });
  });
  els.studyContent.addEventListener("click", function (e) {
    var iw = e.target.closest(".iw");
    if (iw) {                              // interlinear word -> its Strong's entry
      lexQuery = iw.getAttribute("data-s");
      setStudyTab("lex");
      if (lexData) renderLexicon(); else loadStudyData(renderStudy);
      return;
    }
    var x = e.target.closest(".xref, .ref");
    if (!x) return;
    closePanels();
    goChapter(+x.getAttribute("data-b"), +x.getAttribute("data-c"));
    var v = +x.getAttribute("data-v");
    setTimeout(function () { flashVerse(v); }, 60);
  });

  // ======================================================================
  // M'Cheyne reading plan — read the whole Bible in a year (NT + Psalms twice)
  // ======================================================================
  // Data: data/mcheyne.json — 365 days, each { d:"MMDD", f:[reading,reading],
  // s:[reading,reading] } where a reading is { t:"Genesis 9-10", p:[[b,c],…] }.
  // Loaded lazily (and cached by the service worker, so it works offline).
  var PLAN_URL = "data/mcheyne.json";
  var PLAN = null;
  var planDayIdx = 0;
  var planDone = load(LS.plan, {}); // { "MMDD": [fam0, fam1, sec0, sec1] }
  var MONTHS = ["January","February","March","April","May","June","July",
    "August","September","October","November","December"];

  function todayKey() {
    var d = new Date();
    var mm = ("0" + (d.getMonth() + 1)).slice(-2);
    var dd = ("0" + d.getDate()).slice(-2);
    return mm + dd;
  }
  function keyToIndex(key) {
    for (var i = 0; i < PLAN.length; i++) if (PLAN[i].d === key) return i;
    if (key === "0229") return keyToIndex("0228"); // plan has no leap day
    return 0;
  }
  function planDayName(key) {
    return MONTHS[(+key.slice(0, 2)) - 1] + " " + (+key.slice(2));
  }
  function planCompleteCount() {
    var n = 0;
    for (var k in planDone) {
      var a = planDone[k];
      if (a && a[0] && a[1] && a[2] && a[3]) n++;
    }
    return n;
  }
  function todayDone() {
    var a = planDone[todayKey()] || planDone["0229"];
    return !!(a && a[0] && a[1] && a[2] && a[3]);
  }
  function refreshPlanLaunch() {
    if (els.planLaunchSub) {
      var n = planCompleteCount();
      els.planLaunchSub.textContent = n ? (n + " / 365 days complete") : "Read the Bible in a year";
    }
    updateFab();
  }
  function updateFab() {
    // Hide the floating button while audio is playing (it shares that corner).
    els.fabPlan.hidden = (typeof au !== "undefined" && au.on);
    els.fabDot.hidden = todayDone();
  }
  refreshPlanLaunch();

  function loadPlan(cb) {
    if (PLAN) { cb(); return; }
    fetch(PLAN_URL).then(function (r) { return r.json(); })
      .then(function (data) { PLAN = data; cb(); })
      .catch(function () { toast("Couldn't load the reading plan."); });
  }

  function openPlan() {
    closePanels();
    loadPlan(function () {
      planDayIdx = keyToIndex(todayKey());
      renderPlan();
      openPanel(els.planPanel);
    });
  }

  function renderPlan() {
    var day = PLAN[planDayIdx];
    var done = planDone[day.d] || [false, false, false, false];
    els.planDayLabel.textContent = planDayName(day.d);
    els.planDayNum.textContent = "Day " + (planDayIdx + 1) + " of 365";

    function group(title, readings, offset, trk) {
      var h = '<div class="plan-group"><h3>' + title + '</h3>';
      for (var i = 0; i < readings.length; i++) {
        var rd = readings[i], di = offset + i, isDone = !!done[di];
        h += '<div class="plan-row">' +
          '<button class="plan-check' + (isDone ? " done" : "") + '" data-di="' + di + '" aria-label="Mark as read">' +
          '<svg viewBox="0 0 24 24"><path d="M5 12l5 5L20 7"/></svg></button>' +
          '<button class="plan-ref' + (isDone ? " done" : "") + '" data-b="' + rd.p[0][0] + '" data-c="' + rd.p[0][1] + '">' +
          esc(rd.t) + '</button>' +
          '<button class="plan-speed" data-trk="' + trk + '" data-ri="' + i + '" aria-label="Speed read ' + esc(rd.t) + '">' +
          '<svg viewBox="0 0 24 24"><path d="M8 5l11 7-11 7z" fill="currentColor" stroke="none"/></svg></button>' +
          '<button class="plan-listen" data-trk="' + trk + '" data-ri="' + i + '" aria-label="Listen to ' + esc(rd.t) + '">' +
          '<svg viewBox="0 0 24 24"><path d="M11 5L6 9H3v6h3l5 4zM16 9a4 4 0 0 1 0 6"/></svg></button>' +
          '</div>';
      }
      return h + "</div>";
    }
    els.planReadings.innerHTML = group("Family", day.f, 0, "f") + group("Secret", day.s, 2, "s");
    updatePlanProgress();
  }

  function updatePlanProgress() {
    var n = planCompleteCount();
    els.planBar.style.width = (n / 365 * 100) + "%";
    els.planProgressLabel.textContent = n + " of 365 days complete";
    refreshPlanLaunch();
  }

  els.btnPlan.addEventListener("click", openPlan);
  els.fabPlan.addEventListener("click", openPlan);
  els.planPrev.addEventListener("click", function () { if (planDayIdx > 0) { planDayIdx--; renderPlan(); } });
  els.planNext.addEventListener("click", function () { if (planDayIdx < PLAN.length - 1) { planDayIdx++; renderPlan(); } });
  els.planToday.addEventListener("click", function () { planDayIdx = keyToIndex(todayKey()); renderPlan(); });
  function dayChapters(day) {
    var chapters = [];
    day.f.concat(day.s).forEach(function (rd) {
      rd.p.forEach(function (p) { chapters.push(p); });
    });
    return chapters;
  }
  els.planSpeedDay.addEventListener("click", function () {
    if (PLAN) speedReadChapters(dayChapters(PLAN[planDayIdx]));
  });
  els.planListenDay.addEventListener("click", function () {
    if (PLAN) listenChapters(dayChapters(PLAN[planDayIdx]));
  });
  els.planReadings.addEventListener("click", function (e) {
    var sp = e.target.closest(".plan-speed");
    if (sp) {
      var rd = PLAN[planDayIdx][sp.getAttribute("data-trk")][+sp.getAttribute("data-ri")];
      speedReadChapters(rd.p);
      return;
    }
    var ln = e.target.closest(".plan-listen");
    if (ln) {
      var rdl = PLAN[planDayIdx][ln.getAttribute("data-trk")][+ln.getAttribute("data-ri")];
      listenChapters(rdl.p);
      return;
    }
    var chk = e.target.closest(".plan-check");
    if (chk) {
      var di = +chk.getAttribute("data-di"), day = PLAN[planDayIdx];
      var arr = planDone[day.d] || [false, false, false, false];
      arr[di] = !arr[di];
      planDone[day.d] = arr;
      save(LS.plan, planDone);
      renderPlan();
      // Auto-advance to the next day once all four readings are checked.
      if (arr[di] && arr[0] && arr[1] && arr[2] && arr[3] && planDayIdx < PLAN.length - 1) {
        toast("Day complete — on to the next!");
        setTimeout(function () {
          if (planDayIdx < PLAN.length - 1) { planDayIdx++; renderPlan(); }
        }, 650);
      }
      return;
    }
    var ref = e.target.closest(".plan-ref");
    if (ref) { closePanels(); goChapter(+ref.getAttribute("data-b"), +ref.getAttribute("data-c")); }
  });

  // ======================================================================
  // Listen mode — offline text-to-speech via the Web Speech API
  // ======================================================================
  // Uses the device's built-in voices (no audio files, works offline when a
  // local voice is selected). Reads verse-by-verse in short utterances so it
  // stays reliable on mobile (avoids the long-utterance cutoff bug) and lets
  // us highlight the verse being spoken. Pause/resume is implemented as
  // cancel + restart-at-current-chunk, which behaves consistently everywhere.
  var TTS = ("speechSynthesis" in window) && ("SpeechSynthesisUtterance" in window);
  var au = {
    on: false, paused: false,
    b: 0, c: 0,
    chunks: [], ci: 0, lastV: -1,
    voices: [], voice: null,
    queue: null, qi: 0
  };

  // Pull the current voice list (sorted: English + on-device first), resolve the
  // saved voice, and refresh the picker if it's open. Voices on iOS/Android can
  // arrive late and change, so this is called on boot AND on every voiceschanged.
  // Apple's gimmick/character voices — filtered out of the picker.
  var NOVELTY_VOICES = {};
  ("albert,bad news,bahh,bells,boing,bubbles,cellos,good news,jester,organ,pipe organ," +
   "superstar,trinoids,whisper,wobble,zarvox,deranged,hysterical,zuzu,grandma,grandpa," +
   "eddy,flo,reed,rocko,sandy,shelley,wobble,junior,ralph,fred,kathy"
  ).split(",").forEach(function (n) { NOVELTY_VOICES[n] = 1; });
  function isSeriousVoice(v) {
    var base = (v.name || "").toLowerCase().split("(")[0].trim();
    return !NOVELTY_VOICES[base];
  }

  function refreshVoices() {
    var all = (speechSynthesis.getVoices() || []).slice();
    // English voices; novelty voices hidden unless the Easter egg unlocked them.
    var fun = settings.funVoices;
    var vs = all.filter(function (v) { return /^en/i.test(v.lang) && (fun || isSeriousVoice(v)); });
    if (!vs.length) vs = all.filter(function (v) { return /^en/i.test(v.lang); });
    if (!vs.length) vs = all;
    vs.sort(function (a, b) {
      if (a.localService !== b.localService) return a.localService ? -1 : 1;
      return (a.name || "").localeCompare(b.name || "");
    });
    au.voices = vs;
    au.voice = resolveVoice() || au.voice || vs[0] || null;
    updateAudioLabels();
    if (!els.voicePanel.hidden) renderVoiceList();
  }
  // Identify the saved voice by voiceURI (unique — premium/enhanced voices can
  // share a name with the default, so name alone picks the wrong one).
  function resolveVoice() {
    var vs = au.voices; if (!vs.length) return null;
    var byUri = settings.voiceURI && vs.filter(function (v) { return v.voiceURI === settings.voiceURI; })[0];
    if (byUri) return byUri;
    var byName = settings.voiceName && vs.filter(function (v) { return v.name === settings.voiceName; })[0];
    if (byName) return byName;
    var localEn = vs.filter(function (v) { return v.localService && /^en/i.test(v.lang); })[0];
    return localEn || vs.filter(function (v) { return /^en/i.test(v.lang); })[0] || vs[0];
  }

  // Build short speakable chunks (one per sentence) for a chapter, tagged with
  // the verse they belong to so we can highlight as we go.
  function buildAudioChunks(b, c) {
    var verses = BIBLE[b].chapters[c];
    var out = [];
    for (var v = 0; v < verses.length; v++) {
      // Split into sentences without regex lookbehind (older Safari safe).
      var parts = verses[v].match(/[^.!?]+[.!?]*["”’)]*\s*/g) || [verses[v]];
      for (var p = 0; p < parts.length; p++) {
        var t = parts[p].trim();
        if (t) out.push({ v: v, text: t });
      }
    }
    return out;
  }

  function audioVoiceLabel() {
    if (!au.voice) return "Device voice";
    return au.voice.name + (au.voice.localService ? " · Offline" : " · Online");
  }

  // startListen() reads the current chapter onward; startListen(null, queue)
  // reads a fixed [[b,c],…] playlist in order (used by the reading plan).
  function startListen(fromVerse, queue) {
    if (!TTS) { toast("This device has no text-to-speech voices."); return; }
    speechSynthesis.cancel();
    if (queue && queue.length) {
      au.queue = queue.slice(); au.qi = 0;
      au.b = au.queue[0][0]; au.c = au.queue[0][1];
      pos = { b: au.b, c: au.c }; renderChapter(false); // show the chapter being read
    } else {
      au.queue = null;
      au.b = pos.b; au.c = pos.c;
    }
    au.chunks = buildAudioChunks(au.b, au.c);
    au.ci = 0; au.lastV = -1;
    if (!au.queue) {
      var startV = (typeof fromVerse === "number") ? fromVerse
        : (selectedVerse && selectedVerse.b === au.b && selectedVerse.c === au.c ? selectedVerse.v - 1 : 0);
      for (var k = 0; k < au.chunks.length; k++) { if (au.chunks[k].v === startV) { au.ci = k; break; } }
    }
    au.on = true; au.paused = false;
    els.audioBar.hidden = false;
    setAudioPlayIcon(true);
    updateAudioLabels();
    updateFab();
    speakChunk();
  }
  function listenChapters(chapters) {
    if (!chapters || !chapters.length) return;
    closePanels();
    startListen(null, chapters);
  }

  function speakChunk() {
    if (!au.on || au.paused) return;
    var ch = au.chunks[au.ci];
    if (!ch) { advanceChapter(); return; }
    if (ch.v !== au.lastV) { highlightVerse(ch.v); au.lastV = ch.v; }
    els.audioRef.textContent = BIBLE[au.b].name + " " + (au.c + 1) + ":" + (ch.v + 1);
    var u = new SpeechSynthesisUtterance(ch.text);
    if (au.voice) u.voice = au.voice;
    u.rate = settings.rate;
    u.onend = function () {
      if (!au.on || au.paused) return;
      au.ci++;
      if (au.ci >= au.chunks.length) advanceChapter();
      else speakChunk();
    };
    u.onerror = function () { /* swallow interruptions from cancel() */ };
    speechSynthesis.speak(u);
  }

  function advanceChapter() {
    if (au.queue) {
      au.qi++;
      if (au.qi >= au.queue.length) { stopListen(); toast("Finished today’s reading."); return; }
      au.b = au.queue[au.qi][0]; au.c = au.queue[au.qi][1];
    } else if (au.c < BIBLE[au.b].chapters.length - 1) { au.c++; }
    else if (au.b < BIBLE.length - 1) { au.b++; au.c = 0; }
    else { stopListen(); toast("Finished the Bible."); return; }
    pos = { b: au.b, c: au.c };
    renderChapter(false);
    au.chunks = buildAudioChunks(au.b, au.c);
    au.ci = 0; au.lastV = -1;
    speakChunk();
  }

  function highlightVerse(vIdx) {
    var prev = els.chapter.querySelector(".v.speaking");
    if (prev) prev.classList.remove("speaking");
    var node = els.chapter.querySelector('.v[data-v="' + (vIdx + 1) + '"]');
    if (node) { node.classList.add("speaking"); node.scrollIntoView({ block: "center", behavior: "smooth" }); }
  }

  function setAudioPlayIcon(playing) {
    els.audioPlayIcon.setAttribute("d", playing ? "M7 5h4v14H7zM13 5h4v14h-4z" : "M8 5l11 7-11 7z");
    els.audioPlay.setAttribute("aria-label", playing ? "Pause" : "Play");
  }
  function updateAudioLabels() {
    els.audioVoice.textContent = audioVoiceLabel();
    els.audioRate.textContent = settings.rate.toFixed(1) + "×";
  }

  function pauseListen() {
    au.paused = true;
    speechSynthesis.cancel();
    setAudioPlayIcon(false);
  }
  function resumeListen() {
    if (!au.on) return;
    au.paused = false;
    setAudioPlayIcon(true);
    speakChunk();
  }
  function toggleListen() {
    if (!au.on) { startListen(); return; }
    au.paused ? resumeListen() : pauseListen();
  }
  function stopListen() {
    au.on = false; au.paused = false; au.queue = null;
    if (TTS) speechSynthesis.cancel();
    var prev = els.chapter.querySelector(".v.speaking");
    if (prev) prev.classList.remove("speaking");
    els.audioBar.hidden = true;
    updateFab();
  }
  function audioNudge(delta) {
    settings.rate = Math.min(2, Math.max(0.5, Math.round((settings.rate + delta) * 10) / 10));
    save(LS.settings, settings);
    updateAudioLabels();
    if (au.on && !au.paused) { speechSynthesis.cancel(); speakChunk(); } // apply new rate now
  }

  var voiceFilter = "";
  function renderVoiceList() {
    var q = voiceFilter.toLowerCase();
    var html = "";
    au.voices.forEach(function (v, i) {
      if (q && (v.name + " " + v.lang).toLowerCase().indexOf(q) === -1) return;
      var cur = (au.voice && v.voiceURI === au.voice.voiceURI) ? " current" : "";
      var badge = v.localService ? '<span class="badge">Offline</span>' : '<span class="badge online">Online</span>';
      html += '<li class="' + cur.trim() + '" data-vi="' + i + '"><span class="voice-row"><span class="voice-name">' +
              esc(v.name) + ' <span class="voice-lang">' + esc(v.lang) + '</span></span>' + badge + '</span></li>';
    });
    els.voiceList.innerHTML = html || '<li class="bookmark-empty">No matching voices. Clear the filter, or download more (e.g. Enhanced) in your device settings.</li>';
    if (els.voiceNote) {
      var note = au.voices.length + " English voice" + (au.voices.length === 1 ? "" : "s") + " available to this app.";
      if (isIOS()) note += " Note: iOS reserves its newest Premium and Siri voices (e.g. Zoe) for native apps — those don’t appear in web apps. “Enhanced” voices usually do.";
      els.voiceNote.textContent = note;
    }
  }
  function openVoicePanel() {
    voiceFilter = "";
    if (TTS) refreshVoices();
    if (els.voiceFilter) els.voiceFilter.value = "";
    renderVoiceList();
    openPanel(els.voicePanel);
  }
  els.voiceList.addEventListener("click", function (e) {
    var li = e.target.closest("li[data-vi]");
    if (!li) return;
    au.voice = au.voices[+li.getAttribute("data-vi")];
    settings.voiceURI = au.voice.voiceURI;
    settings.voiceName = au.voice.name;
    save(LS.settings, settings);
    updateAudioLabels();
    closePanels();
    if (au.on && !au.paused) { speechSynthesis.cancel(); speakChunk(); }
  });
  if (els.voiceFilter) {
    els.voiceFilter.addEventListener("input", function () {
      voiceFilter = els.voiceFilter.value;
      var magic = voiceFilter.toLowerCase().trim();
      // Easter egg: type "bubbles" to unlock the novelty voices; "serious" to hide.
      if (magic === "bubbles" && !settings.funVoices) {
        settings.funVoices = true; save(LS.settings, settings); refreshVoices();
        toast("🫧 Novelty voices unlocked!");
      } else if (magic === "serious" && settings.funVoices) {
        settings.funVoices = false; save(LS.settings, settings); refreshVoices();
        toast("Novelty voices hidden.");
      }
      renderVoiceList();
    });
  }

  if (TTS) {
    refreshVoices();
    speechSynthesis.addEventListener("voiceschanged", refreshVoices);
    // iOS/Android can populate the voice list a beat later — re-poll a couple of times.
    setTimeout(refreshVoices, 300);
    setTimeout(refreshVoices, 1500);
  } else {
    els.btnListen.style.display = "none";
  }

  els.btnListen.addEventListener("click", function () {
    if (!BIBLE) return;
    if (sr.playing) pause();             // don't run RSVP + audio at once
    if (au.on && au.b === pos.b && au.c === pos.c) { stopListen(); }
    else { startListen(); }
  });
  els.audioPlay.addEventListener("click", toggleListen);
  els.audioStop.addEventListener("click", stopListen);
  els.audioSlower.addEventListener("click", function () { audioNudge(-0.1); });
  els.audioFaster.addEventListener("click", function () { audioNudge(0.1); });
  els.audioVoiceBtn.addEventListener("click", openVoicePanel);
  // Keep the engine alive if the OS pauses it when backgrounded briefly.
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden && au.on && !au.paused && TTS && !speechSynthesis.speaking) speakChunk();
  });

  // ======================================================================
  // Speed reader — RSVP with ORP (Spritz-style), variable timing
  // ======================================================================
  // Why this design: single-word RSVP at a fixed focal point removes eye
  // saccades (the main speed bottleneck), and the red ORP pivot keeps the
  // recognition point anchored. To protect comprehension — RSVP's known weak
  // spot — dwell time scales with word length and pauses lengthen at commas,
  // sentence ends, and verse boundaries, and rewind lets you regress.
  var sr = {
    tokens: [],      // { text, vn, isVerseStart, isPara }
    i: 0,
    playing: false,
    timer: null,
    b: 0, c: 0,      // chapter being read
    queue: null,     // optional [[b,c],…] playlist (e.g. a plan reading)
    qi: 0
  };

  // Spritz-style Optimal Recognition Point by word length.
  function orpIndex(len) {
    if (len <= 1) return 0;
    if (len <= 5) return 1;
    if (len <= 9) return 2;
    if (len <= 13) return 3;
    return 4;
  }

  // Build the token stream for a chapter (one entry per word, verse-aware).
  function buildTokens(b, c) {
    var verses = BIBLE[b].chapters[c];
    var out = [];
    for (var v = 0; v < verses.length; v++) {
      var words = verses[v].split(/\s+/).filter(Boolean);
      for (var w = 0; w < words.length; w++) {
        out.push({ text: words[w], vn: v + 1, isVerseStart: w === 0 });
      }
    }
    return out;
  }

  // openSpeed() reads the current chapter onward; openSpeed(queue) reads a fixed
  // playlist of [b,c] chapters in order (used by the reading plan).
  function openSpeed(queue) {
    if (typeof stopListen === "function") stopListen(); // don't overlap audio + RSVP
    if (queue && queue.length) {
      sr.queue = queue.slice();
      sr.qi = 0;
      sr.b = sr.queue[0][0]; sr.c = sr.queue[0][1];
    } else {
      sr.queue = null;
      sr.b = pos.b; sr.c = pos.c;
    }
    sr.tokens = buildTokens(sr.b, sr.c);
    // Start at the selected verse if reading the current chapter (not a queue).
    sr.i = 0;
    if (!sr.queue && selectedVerse && selectedVerse.b === sr.b && selectedVerse.c === sr.c) {
      for (var k = 0; k < sr.tokens.length; k++) {
        if (sr.tokens[k].vn === selectedVerse.v && sr.tokens[k].isVerseStart) { sr.i = k; break; }
      }
    }
    els.speedHint.textContent = sr.queue
      ? "Speed-reading today's plan — tap play."
      : "Tap play to begin. Tap the word to pause.";
    syncChunkSeg();
    updateWpmLabel();
    renderToken();
    updateChapNav();
    els.speedHint.hidden = false;
    els.speedReader.hidden = false;
    setPlaying(false);
  }
  function closeSpeed() {
    pause();
    els.speedReader.hidden = true;
    // Sync the main reader to where we stopped.
    if (sr.b !== pos.b || sr.c !== pos.c) { pos = { b: sr.b, c: sr.c }; renderChapter(true); }
  }

  // Launch the speed reader over a fixed [[b,c],…] playlist (used by the plan).
  function speedReadChapters(chapters) {
    if (!chapters || !chapters.length) return;
    closePanels();
    openSpeed(chapters);
  }

  function currentRef() {
    var t = sr.tokens[Math.min(sr.i, sr.tokens.length - 1)];
    var vn = t ? t.vn : 1;
    return BIBLE[sr.b].name + " " + (sr.c + 1) + ":" + vn;
  }

  function renderToken() {
    var slice = sr.tokens.slice(sr.i, sr.i + settings.chunk);
    if (!slice.length) return;
    if (slice.length === 1) {
      // Single-word mode: ORP pivot alignment (red letter at the focal point).
      var core = slice[0].text;
      var letters = core.replace(/[^A-Za-z0-9'’]/g, "").length || core.length;
      var pivot = orpIndex(letters);
      if (pivot > core.length - 1) pivot = core.length - 1;
      if (pivot < 0) pivot = 0;
      els.speedWord.children[0].textContent = core.slice(0, pivot);
      els.speedWord.children[1].textContent = core.slice(pivot, pivot + 1);
      els.speedWord.children[2].textContent = core.slice(pivot + 1);
    } else {
      // Chunk mode: show the group centered (no single pivot).
      els.speedWord.children[0].textContent = "";
      els.speedWord.children[1].textContent = slice.map(function (t) { return t.text; }).join(" ");
      els.speedWord.children[2].textContent = "";
    }
    els.speedRef.textContent = currentRef();
    var pct = sr.tokens.length > 1 ? (sr.i / (sr.tokens.length - 1)) * 100 : 0;
    els.speedBar.style.width = pct + "%";
  }

  // Dwell time (ms) for the current frame: WPM + word length + punctuation.
  function dwell() {
    var slice = sr.tokens.slice(sr.i, sr.i + settings.chunk);
    if (!slice.length) return 60000 / settings.wpm;
    var base = (60000 / settings.wpm) * slice.length;
    var lenSum = 0;
    slice.forEach(function (t) { lenSum += t.text.length; });
    var avg = lenSum / slice.length;
    if (avg >= 7) base *= 1 + Math.min((avg - 6) * 0.04, 0.6); // longer words linger
    if (avg <= 2) base *= 0.9;
    var last = slice[slice.length - 1].text;
    if (/[,;:]$/.test(last)) base *= 1.5;          // clause pause
    if (/[.!?]["”’)]?$/.test(last)) base *= 2.2;   // sentence pause
    if (slice[0].isVerseStart && slice[0].vn !== 1) base *= 1.25; // breath each verse
    return base;
  }

  function step() {
    if (!sr.playing) return;
    renderToken();
    var wait = dwell();
    var advance = settings.chunk;
    sr.timer = setTimeout(function () {
      sr.i += advance;
      if (sr.i >= sr.tokens.length) {
        if (sr.queue) {
          // Follow the plan playlist to the next chapter, then stop at the end.
          sr.qi++;
          if (sr.qi < sr.queue.length) {
            sr.b = sr.queue[sr.qi][0]; sr.c = sr.queue[sr.qi][1];
            sr.tokens = buildTokens(sr.b, sr.c);
            sr.i = 0;
            updateChapNav();
            step();
          } else {
            sr.i = sr.tokens.length - 1;
            pause();
            els.speedHint.textContent = "End of today's reading. Well done!";
            els.speedHint.hidden = false;
          }
          return;
        }
        // No queue: auto-continue into the next chapter for a continuous read.
        if (sr.b < BIBLE.length - 1 || sr.c < BIBLE[sr.b].chapters.length - 1) {
          if (sr.c < BIBLE[sr.b].chapters.length - 1) { sr.c++; } else { sr.b++; sr.c = 0; }
          sr.tokens = buildTokens(sr.b, sr.c);
          sr.i = 0;
          updateChapNav();
          step();
        } else {
          sr.i = sr.tokens.length - 1;
          pause();
          els.speedHint.textContent = "End of the Bible. Tap play to re-read this chapter.";
          els.speedHint.hidden = false;
        }
        return;
      }
      step();
    }, wait);
  }

  function setPlaying(on) {
    sr.playing = on;
    els.speedPlayIcon.setAttribute("d", on ? "M7 5h4v14H7zM13 5h4v14h-4z" : "M8 5l11 7-11 7z");
    els.speedPlay.setAttribute("aria-label", on ? "Pause" : "Play");
    els.speedHint.hidden = on;
  }
  function play() {
    if (sr.playing) return;
    if (sr.i >= sr.tokens.length - 1) sr.i = 0;
    setPlaying(true);
    step();
  }
  function pause() {
    setPlaying(false);
    if (sr.timer) { clearTimeout(sr.timer); sr.timer = null; }
  }
  function togglePlay() { sr.playing ? pause() : play(); }

  function nudge(delta) {
    settings.wpm = Math.min(900, Math.max(150, settings.wpm + delta));
    save(LS.settings, settings);
    updateWpmLabel();
  }
  function updateWpmLabel() { els.speedWpm.textContent = settings.wpm + " wpm"; }

  function seek(delta) {
    sr.i = Math.min(sr.tokens.length - 1, Math.max(0, sr.i + delta));
    renderToken();
  }

  // Jump a whole chapter back/forward — within the plan queue if reading one,
  // otherwise through the Bible in order.
  function jumpChapter(dir) {
    var moved = false;
    if (sr.queue) {
      var nq = sr.qi + dir;
      if (nq >= 0 && nq < sr.queue.length) {
        sr.qi = nq; sr.b = sr.queue[nq][0]; sr.c = sr.queue[nq][1]; moved = true;
      }
    } else if (dir < 0) {
      if (sr.c > 0) { sr.c--; moved = true; }
      else if (sr.b > 0) { sr.b--; sr.c = BIBLE[sr.b].chapters.length - 1; moved = true; }
    } else {
      if (sr.c < BIBLE[sr.b].chapters.length - 1) { sr.c++; moved = true; }
      else if (sr.b < BIBLE.length - 1) { sr.b++; sr.c = 0; moved = true; }
    }
    if (!moved) return;
    if (sr.timer) { clearTimeout(sr.timer); sr.timer = null; }
    sr.tokens = buildTokens(sr.b, sr.c);
    sr.i = 0;
    renderToken();
    updateChapNav();
    if (sr.playing) step();
  }

  function updateChapNav() {
    var atStart, atEnd;
    if (sr.queue) {
      atStart = sr.qi <= 0;
      atEnd = sr.qi >= sr.queue.length - 1;
    } else {
      atStart = (sr.b === 0 && sr.c === 0);
      atEnd = (sr.b === BIBLE.length - 1 && sr.c === BIBLE[sr.b].chapters.length - 1);
    }
    els.speedPrevCh.disabled = atStart;
    els.speedNextCh.disabled = atEnd;
  }
  function syncChunkSeg() {
    els.speedChunkSeg.querySelectorAll("[data-chunk]").forEach(function (b) {
      b.classList.toggle("active", +b.getAttribute("data-chunk") === settings.chunk);
    });
  }

  els.btnSpeed.addEventListener("click", function () { if (BIBLE) openSpeed(); });
  els.speedClose.addEventListener("click", closeSpeed);
  els.speedPlay.addEventListener("click", togglePlay);
  els.speedWord.addEventListener("click", togglePlay);
  els.speedSlower.addEventListener("click", function () { nudge(-50); });
  els.speedFaster.addEventListener("click", function () { nudge(50); });
  els.speedBack.addEventListener("click", function () { seek(-10); });
  els.speedFwd.addEventListener("click", function () { seek(10); });
  els.speedPrevCh.addEventListener("click", function () { jumpChapter(-1); });
  els.speedNextCh.addEventListener("click", function () { jumpChapter(1); });
  els.speedChunkSeg.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-chunk]");
    if (!btn) return;
    settings.chunk = +btn.getAttribute("data-chunk");
    save(LS.settings, settings);
    syncChunkSeg();
  });
  document.addEventListener("keydown", function (e) {
    if (els.speedReader.hidden) return;
    if (e.key === " ") { e.preventDefault(); togglePlay(); }
    else if (e.key === "Escape") closeSpeed();
    else if (e.key === "ArrowUp") nudge(50);
    else if (e.key === "ArrowDown") nudge(-50);
    else if (e.key === "ArrowLeft") { if (e.shiftKey) jumpChapter(-1); else seek(-10); }
    else if (e.key === "ArrowRight") { if (e.shiftKey) jumpChapter(1); else seek(10); }
  });

  // ======================================================================
  // Service worker
  // ======================================================================
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").then(function (reg) {
        reg.addEventListener("updatefound", function () {
          var nw = reg.installing;
          nw.addEventListener("statechange", function () {
            if (nw.state === "installed" && navigator.serviceWorker.controller) {
              toast("Update available — reopen to refresh.");
            }
          });
        });
      }).catch(function () {});
    });
  }

  // Connectivity feedback
  window.addEventListener("offline", function () { toast("Offline — reading from device."); });

})();
