# Holy Bible — Offline PWA 📖

A fast, installable **Progressive Web App** that puts the complete Bible on your
phone and works **100% offline** once loaded. No accounts, no tracking, no
network required after the first visit.

> **Translation:** [World English Bible (WEB)](https://worldenglish.bible/) — a
> modern‑English, **public‑domain** translation. See [Why not the NIV?](#why-not-the-niv) below.

## Features

- **Fully offline** — all 66 books / 31,103 verses are cached on your device by a
  service worker. Read on a plane, in a tunnel, anywhere.
- **Installable** — "Add to Home Screen" on iOS/Android for an app‑like, full‑screen experience.
- **Speed reader** — hit play and read by **RSVP** (one word at a time at a fixed
  focal point) with a **Spritz‑style ORP** pivot letter, the most effective
  speed‑reading technique. Adjustable WPM, 1–3 word chunks, and rewind; dwell time
  scales with word length and pauses at commas/sentences/verses to protect
  comprehension (RSVP's known weak spot).
- **Listen (offline audio)** — hit the headphones icon and the chapter is read
  aloud using your **device's built‑in text‑to‑speech voices**, highlighting the
  current verse and auto‑advancing across chapters. No audio files, no network:
  it works offline whenever an on‑device voice is selected. The voice picker
  flags which voices are **Offline** vs **Online**, with adjustable speed, a
  **sleep timer**, and **lock‑screen / headphone controls** (where the platform
  supports it).
- **Read** in a clean, distraction‑free view with paragraph or verse‑by‑verse layout.
- **Navigate** by book → chapter, with prev/next buttons, swipe gestures, and arrow keys.
- **Search** the entire Bible instantly, with highlighted matches. Filter by
  scope (Old Testament / New Testament / current book), match **all words** in any
  order, or wrap a query in `"quotes"` for an exact phrase.
- **M'Cheyne reading plan** — the classic Robert Murray M'Cheyne one‑year plan
  (the whole Bible once, the New Testament & Psalms twice). Opens to today's
  reading, shows the 2 "Family" + 2 "Secret" passages, tap a passage to jump
  there, check off readings, and track your yearly progress. You can also
  **speed‑read** a single reading or the whole day's readings (the RSVP reader
  plays through each passage's chapters in order). Works offline and your
  progress is saved on‑device.
- **Study tools** — tap any verse and choose **Study**, or use the **Commentary &
  study** button at the top of any chapter. Four tabs: **cross‑references**
  (Treasury of Scripture Knowledge), **Matthew Henry's Concise Commentary**,
  **Easton's Bible Dictionary** (auto‑suggests terms from the verse, plus full
  search), and **Strong's** Hebrew & Greek lexicon (search by number or word).
  Scripture references inside the commentary and dictionary are **tappable** to
  jump straight to the cited verse. A fifth **Interlinear** tab shows the KJV verse
  with **Strong's numbers** and the original **Greek/Hebrew** beneath each word —
  tap any word to open its Hebrew/Greek lexicon entry, then **"find every verse
  that uses it"** for a full Strong's concordance.
  All bundled for offline use (the interlinear data downloads on first use).
- **Bookmarks** — tap any verse to bookmark, copy, or share it. Saved on‑device.
- **Themes** — light, sepia, and dark, plus adjustable text size.
- All preferences, bookmarks, and your last reading position are stored locally
  (`localStorage`) and persist between sessions.

## Run it locally

It's a static site — any web server works. A service worker requires `http://`
(or `https://`), not `file://`:

```bash
# from the project root
python3 -m http.server 8000
# then open http://localhost:8000
```

To test installation/offline behaviour, use the browser DevTools → Application
tab (Manifest / Service Workers), or simply load the page once, then go offline.

## Deploy (GitHub Pages)

This repo is ready to publish as‑is:

1. Push to GitHub.
2. **Settings → Pages → Build and deployment → Source: Deploy from a branch.**
3. Pick this branch and the `/ (root)` folder, then save.
4. Visit `https://<user>.github.io/<repo>/`.

All paths are **relative**, so it works correctly from a sub‑path like
`/bible/`. A `.nojekyll` file is included so GitHub Pages serves every file
untouched. Any static host (Netlify, Vercel, Cloudflare Pages, S3) works too.

## Project structure

```
index.html              App shell / markup
manifest.webmanifest    PWA manifest (name, icons, theme, standalone display)
sw.js                   Service worker — precaches the shell + Bible text
css/styles.css          Theming and layout
js/app.js               All app logic (no dependencies, no build step)
data/web.json           The Bible text: [{ name, abbrev, chapters:[[verse,…]] }]
icons/                  App icons (incl. maskable) + favicons
```

The data layer is deliberately simple. `data/web.json` is an array of 66 book
objects; each has a `name`, an `abbrev`, and a `chapters` array of chapters,
where each chapter is an array of verse strings. To use a different translation,
replace this file with one of the same shape and bump the cache version in
`sw.js`.

## Why not the NIV?

The NIV is **copyrighted** by Biblica and is **not** licensed for redistribution
or offline storage. Bundling its full text into an installable app (which ships
the whole Bible to the device) would violate its license, and no free/open Bible
API serves the NIV either. This app therefore uses the **World English Bible**, a
modern‑English public‑domain translation, so it can be legally stored and read
fully offline. The data layer (see above) makes it straightforward to swap in a
properly licensed translation if you obtain one.

> Note: the WEB renders the divine name as **“Yahweh”** in the Old Testament
> where many translations (incl. the NIV) use **“the LORD.”**

## License & attribution

- App code: MIT.
- Scripture text: World English Bible — public domain.
- Matthew Henry's Concise Commentary — public domain.
- Easton's Bible Dictionary — public domain.
- Strong's Hebrew & Greek Dictionary — public domain.
- Cross-references: Treasury of Scripture Knowledge via
  [openbible.info](https://www.openbible.info/labs/cross-references/), licensed
  **CC BY** (attribution required).
