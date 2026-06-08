---
status: active
last_touched: 2026-06-08
---

# Holy Bible — Offline PWA

A fast, installable Progressive Web App that puts the complete Bible on your phone
and works 100% offline once loaded. No accounts, no tracking, no backend.

## Stack
- **Vanilla JS / HTML / CSS** — no build step, no `package.json`. Edit files in
  `js/`, `css/`, `index.html` and reload.
- **PWA** — service worker (`sw.js`) caches all 66 books / 31,103 verses for
  offline use; `manifest.webmanifest` for install.
- **Hosting** — Vercel (`vercel.json`).
- **ESV proxy** — optional Cloudflare Worker in `proxy/` (`wrangler.toml`) that
  proxies the ESV API; user supplies their own token as a Worker secret.

## Layout
- `data/` — bundled World English Bible (WEB, public domain) verse data
- `js/` — app logic (reader, RSVP speed reader, offline TTS, highlights/notes)
- `css/`, `icons/`, `index.html`, `manifest.webmanifest`, `sw.js` — PWA shell
- `proxy/` — Cloudflare Worker for the online ESV translation

## Notes
- **Bump the service worker cache version in `sw.js` when shipping** or clients
  serve stale assets.
- Default translation is WEB (offline). ESV is online-only via the proxy.
- Repo: https://github.com/timncox/bible
