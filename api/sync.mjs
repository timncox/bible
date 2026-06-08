/**
 * Passphrase sync store — Vercel serverless function (ESM, uses @vercel/blob).
 *
 * Zero-knowledge: the client derives a docId = hash(passphrase) and encrypts its
 * notes/highlights/bookmarks with a key also derived from the passphrase. This
 * function only ever sees the docId and the opaque ciphertext — it can't read
 * the data or recover the passphrase.
 *
 *   GET  /api/sync?doc=<docId>           -> { blob: <ciphertext|null>, updatedAt }
 *   PUT  /api/sync?doc=<docId>  body {blob} -> { ok: true }
 */
import { put, list } from "@vercel/blob";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, PUT, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();

  const doc = (req.query && req.query.doc) || new URL(req.url, "http://x").searchParams.get("doc");
  if (!doc || !/^[a-f0-9]{16,128}$/.test(doc)) return res.status(400).json({ error: "bad doc" });
  const path = "sync/" + doc;

  try {
    if (req.method === "GET") {
      const { blobs } = await list({ prefix: path, limit: 1 });
      const hit = blobs.find((b) => b.pathname === path);
      if (!hit) return res.status(200).json({ blob: null });
      const r = await fetch(hit.url, { cache: "no-store" });
      const text = await r.text();
      return res.status(200).json({ blob: text, updatedAt: hit.uploadedAt });
    }

    if (req.method === "PUT" || req.method === "POST") {
      const body = await readJson(req);
      const blob = body && body.blob;
      if (typeof blob !== "string" || !blob) return res.status(400).json({ error: "missing blob" });
      if (blob.length > 4_000_000) return res.status(413).json({ error: "too large" });
      await put(path, blob, { access: "public", addRandomSuffix: false, allowOverwrite: true, contentType: "text/plain" });
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: "method" });
  } catch (e) {
    return res.status(502).json({ error: "store", detail: String(e) });
  }
}

async function readJson(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") { try { return JSON.parse(req.body); } catch { return null; } }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { return null; }
}
