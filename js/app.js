/* Holy Bible — Offline PWA
 * Vanilla JS, no dependencies. All state persisted to localStorage. */
(function () {
  "use strict";

  var APP_VERSION = "1.0.0";
  var DATA_URL = "data/web.json";

  // ----- Book metadata (Old Testament = first 39) -----
  var OT_COUNT = 39;

  // ----- Persistent state -----
  var LS = {
    pos: "bible.pos",
    settings: "bible.settings",
    bookmarks: "bible.bookmarks"
  };
  function load(key, fallback) {
    try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch (e) { return fallback; }
  }
  function save(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }

  var settings = Object.assign(
    { theme: prefersDark() ? "dark" : "light", fontScale: 1, layout: "paragraph" },
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
   "searchPanel","searchInput","searchClear","searchMeta","searchResults",
   "settingsPanel","fontMinus","fontPlus","fontVal","bookmarkList","bookmarkCount",
   "btnInstall","installHint","storageInfo","appVersion","scrim","toast"
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
    if (anyPanelOpen() || e.target.tagName === "INPUT") return;
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
    if (act === "bookmark") { toggleBookmark(s); showVerseActions(); }
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
  var searchTimer = null;
  els.btnSearch.addEventListener("click", function () {
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

  function runSearch() {
    var q = els.searchInput.value.trim();
    if (q.length < 2) {
      els.searchMeta.textContent = "Type at least 2 letters to search all 31,000+ verses.";
      els.searchResults.innerHTML = "";
      return;
    }
    var needle = q.toLowerCase();
    var results = [];
    var MAX = 300;
    for (var b = 0; b < BIBLE.length && results.length < MAX; b++) {
      var chs = BIBLE[b].chapters;
      for (var c = 0; c < chs.length && results.length < MAX; c++) {
        var vs = chs[c];
        for (var v = 0; v < vs.length; v++) {
          if (vs[v].toLowerCase().indexOf(needle) !== -1) {
            results.push({ b: b, c: c, v: v + 1, text: vs[v] });
            if (results.length >= MAX) break;
          }
        }
      }
    }
    els.searchMeta.textContent = results.length
      ? (results.length >= MAX ? "Showing first " + MAX + " matches" : results.length + " match" + (results.length === 1 ? "" : "es"))
      : "No matches found.";
    var html = "";
    results.forEach(function (r) {
      html += '<div class="search-result" data-b="' + r.b + '" data-c="' + r.c + '" data-v="' + r.v + '">' +
              '<div class="sr-ref">' + esc(BIBLE[r.b].name + " " + (r.c + 1) + ":" + r.v) + '</div>' +
              '<div class="sr-text">' + highlight(r.text, q) + '</div></div>';
    });
    els.searchResults.innerHTML = html || '<p class="search-empty">No verses contain &ldquo;' + esc(q) + '&rdquo;.</p>';
    els.searchResults.scrollTop = 0;
  }
  function highlight(text, q) {
    var lower = text.toLowerCase(), nl = q.toLowerCase(), out = "", from = 0, idx;
    while ((idx = lower.indexOf(nl, from)) !== -1) {
      out += esc(text.slice(from, idx)) + "<mark>" + esc(text.slice(idx, idx + q.length)) + "</mark>";
      from = idx + q.length;
    }
    return out + esc(text.slice(from));
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
