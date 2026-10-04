/* =====================================================================
   /api/projects: the public project list for work.mazidavid.com
   ---------------------------------------------------------------------
   Read-only. Hidden projects are filtered out here, in the database
   query, so they never reach the browser at all.
   Cached at Vercel's edge for 60s, so a burst of visitors costs one
   query. After you edit in /admin, changes show within about a minute.
   ===================================================================== */
import { db } from "./_lib/db.js";
import { send } from "./_lib/http.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return send(res, 405, { error: "Method not allowed" }, { Allow: "GET" });
  try {
    const rows = await db()`
      select id, title, kind, status, school, featured, year, summary, did, stack, links, image
      from projects where hidden = false
      order by sort asc, updated_at desc`;
    return send(res, 200, { projects: rows }, {
      "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
    });
  } catch (err) {
    console.error("projects error", err);
    return send(res, 500, { error: "Server error" });   // the page falls back to content.js
  }
}
