# ESV proxy (Cloudflare Worker)

The ESV API can't be called directly from a browser (no CORS) and its token must
stay secret. This tiny Cloudflare Worker fixes both: it holds the token as a
**secret** and adds CORS so the Bible PWA can fetch ESV passages.

**The token is never stored in this repo** — only as a Worker secret you set in
the Cloudflare dashboard.

## Deploy (free, ~3 minutes, no credit card)

1. **dash.cloudflare.com → Workers & Pages → Create → Create Worker.**
2. Replace the default code with [`esv-worker.js`](./esv-worker.js) and **Deploy**.
3. Worker → **Settings → Variables and Secrets**:
   - Add a **Secret** named `ESV_TOKEN` = your token from <https://api.esv.org/account/>.
     *(Rotate the token first if you shared it anywhere.)*
   - *(Optional, recommended)* add a plain variable `ALLOWED_ORIGINS` =
     `https://timncox.github.io` to lock the proxy to your app.
4. Copy the Worker URL (e.g. `https://esv-proxy.you.workers.dev`).
5. In the Bible app: **Settings → Translation → ESV → paste the proxy URL.**

The app then requests `<proxy>?q=John%203` and renders the returned ESV text.

> ESV text © Crossway. Used via the ESV API under its terms (online only;
> attribution shown in‑app). The bundled WEB translation remains the offline default.
