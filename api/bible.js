/**
 * API.Bible proxy — Vercel serverless function.
 *
 * Provides extra translations (KJV, NIV, CSB, ASV, MSG, …) from
 * api.scripture.api.bible, which needs an api-key header and doesn't send CORS.
 * Same origin as the app, so the client uses it with zero config. The key is a
 * Vercel env var (API_BIBLE_TOKEN), never in the repo.
 *
 * Two modes:
 *   /api/bible?bibleId=<id>&chapter=JHN.3   → chapter text (verse-numbered)
 *   /api/bible?bibleId=<id>&search=<query>  → search results across that bible
 *
 * Chapter responses are normalized to { passages: ["[1] … [2] …"] } so the
 * client can reuse the same [n]-marker parser it uses for the ESV.
 */
const API = "https://api.scripture.api.bible/v1";

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Vary", "Origin");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "method" });
  if (!process.env.API_BIBLE_TOKEN) return res.status(500).json({ error: "API_BIBLE_TOKEN env var not set" });

  const qp = req.query || Object.fromEntries(new URL(req.url, "http://x").searchParams);
  const bibleId = qp.bibleId;
  if (!bibleId) return res.status(400).json({ error: "missing bibleId" });

  const headers = { "api-key": process.env.API_BIBLE_TOKEN };

  try {
    if (qp.search) {
      const u = `${API}/bibles/${encodeURIComponent(bibleId)}/search?` + new URLSearchParams({
        query: qp.search, limit: qp.limit || "200", sort: "relevance",
      });
      const r = await fetch(u, { headers });
      const body = await r.text();
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=3600");
      return res.status(r.status).send(body);
    }

    const chapter = qp.chapter;
    if (!chapter) return res.status(400).json({ error: "missing chapter or search" });
    const u = `${API}/bibles/${encodeURIComponent(bibleId)}/chapters/${encodeURIComponent(chapter)}?` + new URLSearchParams({
      "content-type": "text",
      "include-verse-numbers": "true",
      "include-notes": "false",
      "include-titles": "false",
      "include-chapter-numbers": "false",
      "include-verse-spans": "false",
    });
    const r = await fetch(u, { headers });
    if (!r.ok) {
      const body = await r.text();
      return res.status(r.status).send(body);
    }
    const data = await r.json();
    const content = data && data.data && data.data.content || "";
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=86400");
    return res.status(200).json({ passages: [content], copyright: data.data && data.data.copyright });
  } catch (e) {
    return res.status(502).json({ error: "upstream", detail: String(e) });
  }
};
