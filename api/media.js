/* =====================================================================
   /api/media?id=12&v=ab12cd34: serves an image you uploaded in /admin
   ---------------------------------------------------------------------
   Uploaded pictures (your About-me photo, timeline pictures) live in the
   Neon database, not in the git repo. This route streams them back.
   - Only images we stored ourselves (webp/jpeg/png, checked at upload)
   - Cached for a year: an image never changes once uploaded (a new upload
     gets a new id), so browsers and Vercel's CDN keep it.
   - Locked-down headers so a file can never run as a page or script.
   ===================================================================== */
import { db } from "./_lib/db.js";

export default async function handler(req, res) {
  const id = Number(req.query.id);
  if (req.method !== "GET" || !Number.isInteger(id) || id < 1) { res.statusCode = 404; return res.end("Not found"); }
  try {
    const rows = await db()`select mime, bytes from media where id = ${id}`;
    if (!rows.length) { res.statusCode = 404; return res.end("Not found"); }
    const { mime, bytes } = rows[0];
    // Neon returns bytea as "\\x<hex>"; turn it back into raw bytes
    const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(String(bytes).replace(/^\\x/, ""), "hex");
    res.statusCode = 200;
    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Length", buf.length);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox");
    res.end(buf);
  } catch (err) {
    console.error("media error", err);
    res.statusCode = 500; res.end("Server error");
  }
}
