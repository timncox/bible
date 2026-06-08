/* Service worker — precaches the app shell + full Bible text for offline use. */
var CACHE = "bible-offline-v1.21.0";

// NB: do NOT precache "index.html". On Vercel, cleanUrls 308-redirects
// /index.html -> /, so caching it stores a *redirected* response, and Safari
// refuses to serve a redirected response for a navigation ("Response served by
// service worker has redirections"). We cache "./" (a clean 200) instead.
var PRECACHE = [
  "./",
  "css/styles.css",
  "js/app.js",
  "manifest.webmanifest",
  "data/web.json",
  "data/mcheyne.json",
  "data/tsk.json",
  "data/mhc.json",
  "data/easton.json",
  "data/lexicon.json",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "icons/apple-touch-icon.png",
  "icons/favicon-32.png"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(PRECACHE);
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (event) {
  var req = event.request;
  if (req.method !== "GET") return;

  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // API calls (e.g. the ESV proxy /api/esv) go straight to network — never
  // served from the offline app-shell cache.
  if (url.pathname.indexOf("/api/") === 0) return;

  // Navigation requests -> serve cached app shell (offline-first SPA).
  // Never return a *redirected* response here — Safari rejects it for
  // navigations ("Response served by service worker has redirections").
  if (req.mode === "navigate") {
    event.respondWith(
      caches.match("./").then(function (cached) {
        if (cached && !cached.redirected) return cached;
        return fetch(req).catch(function () { return cached; });
      })
    );
    return;
  }

  // Everything else: cache-first, fall back to network and cache it.
  event.respondWith(
    caches.match(req).then(function (cached) {
      if (cached) return cached;
      return fetch(req).then(function (res) {
        if (res && res.status === 200 && res.type === "basic" && !res.redirected) {
          var copy = res.clone();
          caches.open(CACHE).then(function (cache) { cache.put(req, copy); });
        }
        return res;
      }).catch(function () { return cached; });
    })
  );
});
