/**
 * ESV API proxy — Cloudflare Worker.
 *
 * Why: the ESV API (api.esv.org) doesn't send CORS headers, so a browser/PWA
 * can't call it directly, and the API token must NOT be exposed in client code.
 * This Worker keeps the token as a secret and adds CORS, so the Bible PWA can
 * fetch ESV passages safely.
 *
 * Deploy (free, no credit card):
 *  1. Go to dash.cloudflare.com → Workers & Pages → Create → Create Worker.
 *  2. Replace the default code with this file's contents and Deploy.
 *  3. Open the Worker → Settings → Variables and Secrets → add a SECRET named
 *     ESV_TOKEN with your token from https://api.esv.org/account/  (rotate the
 *     one you shared in chat first).
 *  4. (Optional, recommended) add a plain variable ALLOWED_ORIGINS, e.g.
 *     "https://timncox.github.io" (comma-separated) to lock it to your app.
 *  5. Copy the Worker URL (e.g. https://esv-proxy.<you>.workers.dev) and paste
 *     it into the Bible app: Settings → Translation → ESV proxy URL.
 */
export default {
  async fetch(request, env) {
    const reqOrigin = request.headers.get("Origin") || "";
    const allow = (env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
    const originOk = !allow.length || allow.includes(reqOrigin);
    const cors = {
      "Access-Control-Allow-Origin": originOk ? (reqOrigin || "*") : "null",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Vary": "Origin",
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (request.method !== "GET") return json({ error: "method" }, 405, cors);
    if (!originOk) return json({ error: "origin not allowed" }, 403, cors);
    if (!env.ESV_TOKEN) return json({ error: "ESV_TOKEN secret not set" }, 500, cors);

    const q = new URL(request.url).searchParams.get("q");
    if (!q) return json({ error: "missing q" }, 400, cors);

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
      const r = await fetch(esv, { headers: { Authorization: "Token " + env.ESV_TOKEN } });
      const body = await r.text();
      return new Response(body, {
        status: r.status,
        headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "public, max-age=86400" },
      });
    } catch (e) {
      return json({ error: "upstream", detail: String(e) }, 502, cors);
    }
  },
};

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
