/* =====================================================================
   /api/board: the /me board (your notes + visitors' notes)
   ---------------------------------------------------------------------
   GET  /api/board   → { notes:[...], visitors:[...] }
        notes     = your notes (markdown + tags), hidden ones excluded
        visitors  = ONLY approved visitor notes (pending ones stay private)

   POST /api/board  {name, body, website}
        A visitor leaves a note. It is saved as "pending" and does not
        appear until you approve it in /admin.
        Spam defences:
          - "website" is a honeypot: a hidden field humans never fill,
            bots usually do. If it's filled we pretend success and drop it.
          - Origin must be one of our sites
          - Length limits (name 40, note 500), no links allowed
          - 3 notes per hour per IP, 30 per hour for everyone
          - Plain text only: rendered with textContent, never as HTML
   ===================================================================== */
import { db } from "./_lib/db.js";
import { send, checkOrigin, envList, jsonBody, rateLimit, ipHash } from "./_lib/http.js";

const PUBLIC_ORIGINS = () => envList("PUBLIC_ORIGINS", [
  "https://me.mazidavid.com", "https://mazidavid.com", "https://work.mazidavid.com",
]);

export default async function handler(req, res) {
  if (req.method === "GET") return list(res);
  if (req.method === "POST") return submit(req, res);
  return send(res, 405, { error: "Method not allowed" }, { Allow: "GET, POST" });
}

async function list(res) {
  try {
    const sql = db();
    const [notes, visitors] = await Promise.all([
      sql`select id, kind, title, body_md, tags, pinned, to_char(note_date, 'YYYY-MM-DD') as date
          from board_notes where hidden = false
          order by pinned desc, note_date desc, id desc`,
      sql`select id, name, body, to_char(approved_at, 'YYYY-MM-DD') as date
          from visitor_notes where status = 'approved'
          order by approved_at desc limit 60`,
    ]);
    return send(res, 200, { notes, visitors }, {
      "Cache-Control": "public, max-age=0, s-maxage=30, stale-while-revalidate=300",
    });
  } catch (err) {
    console.error("board list error", err);
    return send(res, 500, { error: "Server error" });
  }
}

async function submit(req, res) {
  if (!checkOrigin(req, PUBLIC_ORIGINS())) return send(res, 403, { error: "Bad origin" });
  const b = jsonBody(req, 3000);
  if (!b) return send(res, 400, { error: "Expected JSON" });

  // Honeypot filled → bot. Say "thanks" so it doesn't retry, store nothing.
  if (b.website) return send(res, 200, { ok: true });

  const name = String(b.name || "").replace(/\s+/g, " ").trim().slice(0, 40);
  const body = String(b.body || "").replace(/\r\n/g, "\n").trim();
  if (body.length < 2 || body.length > 500) return send(res, 400, { error: "Notes are 2 to 500 characters." });
  if (/https?:\/\/|www\./i.test(body + " " + name)) return send(res, 400, { error: "Links aren't allowed in notes." });

  try {
    const okIp = await rateLimit(`note:${ipHash(req)}`, 3, 3600);
    const okAll = await rateLimit("note:all", 30, 3600);
    if (!okIp || !okAll) return send(res, 429, { error: "Lots of notes right now. Try again in a bit." });

    await db()`insert into visitor_notes (name, body, ip_hash) values (${name || "Anonymous"}, ${body}, ${ipHash(req)})`;
    return send(res, 201, { ok: true, pending: true });
  } catch (err) {
    console.error("board submit error", err);
    return send(res, 500, { error: "Server error" });
  }
}
