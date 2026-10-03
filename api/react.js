/* =====================================================================
   /api/react: a visitor taps an emoji under a board note.
   ---------------------------------------------------------------------
   POST {note_id, emoji}   emoji ∈ heart | fire | idea | laugh | mindblown
   No accounts, so abuse limits are by (hashed) IP:
     - the same person can add each emoji to each note once a day
     - at most 60 reactions an hour per person, 600 an hour overall
   Only visible notes can be reacted to. Counts only ever go up by one.
   ===================================================================== */
import { db } from "./_lib/db.js";
import { send, checkOrigin, envList, jsonBody, rateLimit, ipHash } from "./_lib/http.js";

const EMOJI = ["heart", "fire", "idea", "laugh", "mindblown"];
const PUBLIC_ORIGINS = () => envList("PUBLIC_ORIGINS", ["https://me.mazidavid.com", "https://mazidavid.com", "https://work.mazidavid.com"]);

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" }, { Allow: "POST" });
  if (!checkOrigin(req, PUBLIC_ORIGINS())) return send(res, 403, { error: "Bad origin" });
  const b = jsonBody(req, 200);
  const id = Number(b?.note_id);
  if (!b || !Number.isInteger(id) || !EMOJI.includes(b.emoji)) return send(res, 400, { error: "Bad reaction" });
  try {
    const ip = ipHash(req);
    const once = await rateLimit(`react:${ip}:${id}:${b.emoji}`, 1, 86400);
    const hour = await rateLimit(`react:${ip}`, 60, 3600);
    const all = await rateLimit("react:all", 600, 3600);
    if (!once) return send(res, 200, { ok: true, counted: false });    // already reacted: quietly ignore
    if (!hour || !all) return send(res, 429, { error: "Slow down a little" });
    const rows = await db()`
      insert into note_reactions (note_id, emoji, count)
      select id, ${b.emoji}, 1 from board_notes where id = ${id} and hidden = false
      on conflict (note_id, emoji) do update set count = note_reactions.count + 1
      returning count`;
    if (!rows.length) return send(res, 404, { error: "No such note" });
    return send(res, 200, { ok: true, counted: true, count: rows[0].count });
  } catch (err) {
    console.error("react error", err);
    return send(res, 500, { error: "Server error" });
  }
}
