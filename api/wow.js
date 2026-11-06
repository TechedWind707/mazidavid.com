/* =====================================================================
   /api/wow: licence check for the shared WoW Autopilot APK.
   ---------------------------------------------------------------------
   The authenticator secret lives ONLY here (Vercel env WOW_TOTP_SECRET),
   never inside the APK, so there is nothing to dig out of the app.

   POST {action:"unlock", device, email, code}
        -> checks the 6-digit Google Authenticator code. Each code works
           for ONE phone only (used codes are remembered), then that phone
           is saved as "approved" with the email it gave.
   POST {action:"check", device}
        -> the app asks this at every start (and at least every 3 days).
           Answers the phone's status: approved | blocked | needs_reauth | unknown

   To manage phones: Neon console -> table wow_devices -> change status:
     approved      keeps working
     blocked       stops at the next check
     needs_reauth  must type a fresh code (you send it again)
   ===================================================================== */
import crypto from "node:crypto";
import { db } from "./_lib/db.js";
import { send, jsonBody } from "./_lib/http.js";

// ---- TOTP: same maths as Google Authenticator (RFC 6238) ----
function base32(s) {
  const abc = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; let bits = 0, buf = 0; const out = [];
  for (const ch of s.toUpperCase().replace(/[^A-Z2-7]/g, "")) {
    buf = (buf << 5) | abc.indexOf(ch); bits += 5;
    if (bits >= 8) { out.push((buf >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}
function totp(secret, step) {
  const msg = Buffer.alloc(8); msg.writeBigUInt64BE(BigInt(step));
  const h = crypto.createHmac("sha1", base32(secret)).update(msg).digest();
  const o = h[h.length - 1] & 15;
  const n = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1000000).padStart(6, "0");
}
/** which 30-s step the typed code belongs to (now, or one either side), or null */
function matchStep(secret, code) {
  const now = Math.floor(Date.now() / 1000 / 30);
  for (const s of [now, now - 1, now + 1]) if (totp(secret, s) === code) return s;
  return null;
}

let ready = false;
async function setup(sql) {
  if (ready) return;
  await sql`CREATE TABLE IF NOT EXISTS wow_devices (
    device text PRIMARY KEY, email text NOT NULL, status text NOT NULL DEFAULT 'approved',
    note text DEFAULT '', created_at timestamptz DEFAULT now(), last_seen timestamptz DEFAULT now())`;
  await sql`CREATE TABLE IF NOT EXISTS wow_used_codes (step bigint PRIMARY KEY, device text, used_at timestamptz DEFAULT now())`;
  ready = true;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "POST only" });
  const body = jsonBody(req, 2000);
  if (!body) return send(res, 400, { error: "Expected JSON" });
  const device = String(body.device || "").slice(0, 80);
  if (!/^[A-Za-z0-9_-]{6,80}$/.test(device)) return send(res, 400, { error: "Bad device id" });
  const sql = db(); await setup(sql);

  if (body.action === "check") {
    const rows = await sql`UPDATE wow_devices SET last_seen = now() WHERE device = ${device} RETURNING status`;
    return send(res, 200, { status: rows.length ? rows[0].status : "unknown" });
  }

  if (body.action === "unlock") {
    const email = String(body.email || "").trim().toLowerCase().slice(0, 120);
    const code = String(body.code || "").trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return send(res, 400, { status: "bad_email" });
    if (!/^\d{6}$/.test(code)) return send(res, 400, { status: "bad_code" });
    const secret = process.env.WOW_TOTP_SECRET;
    if (!secret) return send(res, 500, { error: "server not set up" });
    const existing = await sql`SELECT status FROM wow_devices WHERE device = ${device}`;
    if (existing.length && existing[0].status === "blocked") return send(res, 200, { status: "blocked" });
    const step = matchStep(secret, code);
    if (step == null) return send(res, 200, { status: "bad_code" });
    // one code = one phone: a code already used by someone else is refused
    const used = await sql`INSERT INTO wow_used_codes (step, device) VALUES (${step}, ${device}) ON CONFLICT (step) DO NOTHING RETURNING step`;
    if (!used.length) return send(res, 200, { status: "code_used" });
    await sql`INSERT INTO wow_devices (device, email, status) VALUES (${device}, ${email}, 'approved')
              ON CONFLICT (device) DO UPDATE SET email = ${email}, status = 'approved', last_seen = now()`;
    return send(res, 200, { status: "approved" });
  }
  return send(res, 400, { error: "Unknown action" });
}
