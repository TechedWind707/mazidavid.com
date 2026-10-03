/* =====================================================================
   db.js: one shared Neon connection for every API route.
   ---------------------------------------------------------------------
   Files in api/_lib/ start with "_" so Vercel does NOT turn them into
   public endpoints. They're just helpers the real routes import.

   DATABASE_URL lives in Vercel → Project → Settings → Environment
   Variables. It is never sent to the browser.

   neon() talks to Postgres over HTTPS, which suits serverless functions:
   no connection pool to keep warm, one round-trip per query.
   Always use the tagged-template form  sql`... ${value}`  so values are
   sent as parameters, never glued into the SQL text (no SQL injection).
   ===================================================================== */
import { neon } from "@neondatabase/serverless";

let _sql = null;

export function db() {
  if (!_sql) {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
    _sql = neon(process.env.DATABASE_URL);
  }
  return _sql;
}
