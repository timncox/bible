/**
 * ESV API proxy — Vercel serverless function (same-origin alternative to the
 * Cloudflare Worker in proxy/).
 *
 * Why: the ESV API (api.esv.org) doesn't send CORS headers, so a browser/PWA
 * can't call it directly, and the token must NOT be exposed in client code.
 * When the app is served from Vercel this function lives at /api/esv on the
 * SAME origin as the app, so no CORS is needed and the client can use it with
 * zero configuration. The ESV token is a Vercel env var (ESV_TOKEN), never in
 * the repo.
 *
 * Setup: add ESV_TOKEN in the Vercel project (Settings → Environment Variables,
 * or `vercel env add ESV_TOKEN`). Token from https://api.esv.org/account/.
 */
module.exports = async (req, res) => {
  // Same-origin in production, but allow CORS so a Pages/other host can point here too.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Vary", "Origin");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "method" });
  if (!process.env.ESV_TOKEN) return res.status(500).json({ error: "ESV_TOKEN env var not set" });

  const q = (req.query && req.query.q) || new URL(req.url, "http://x").searchParams.get("q");
  if (!q) return res.status(400).json({ error: "missing q" });

  const esv = "https://api.esv.org/v3/passage/text/?" + new URLSearchParams({
    q,
    "include-passage-references": "false",
    "include-verse-numbers": "true",
    "include-first-verse-numbers": "true",
    "include-footnotes": "false",
    "include-headings": "false",
    "include-short-copyright": "false",
    "include-passage-horizontal-lines": "false",
    "include-heading-horizontal-lines": "false",
    "include-selahs": "false",
    "indent-paragraphs": "0",
  });

  try {
    const r = await fetch(esv, { headers: { Authorization: "Token " + process.env.ESV_TOKEN } });
    const body = await r.text();
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=86400");
    return res.status(r.status).send(body);
  } catch (e) {
    return res.status(502).json({ error: "upstream", detail: String(e) });
  }
};
