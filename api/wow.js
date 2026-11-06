/* =====================================================================
   /api/wow: licence check for the shared WoW Autopilot APK.
   ---------------------------------------------------------------------
   The authenticator secret lives ONLY here (Vercel env WOW_TOTP_SECRET),
   never inside the APK, so there is nothing to dig out of the app.

   Steps for a new phone:
   1. POST {action:"unlock", device, email, code}
        6-digit Google Authenticator code from David (each code works for ONE
        phone only). Server emails a second 6-digit code to that email.
        -> status "email_pending"
   2. POST {action:"verify_email", device, email_code}
        proves the person can read that inbox -> status "pending",
        and David gets an email: "new phone waiting".
   3. David opens Neon -> table wow_devices -> sets status to "approved".
   Every start: POST {action:"check", device} -> the phone's status.

   Statuses: email_pending | pending | approved | blocked | needs_reauth
     blocked       stops at its next check
     needs_reauth  must do the whole code + email dance again
   Env: WOW_TOTP_SECRET, RESEND_API_KEY, optional WOW_MAIL_FROM, WOW_OWNER_EMAIL
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
function matchStep(secret, code) {
  const now = Math.floor(Date.now() / 1000 / 30);
  for (const s of [now, now - 1, now + 1]) if (totp(secret, s) === code) return s;
  return null;
}
const hash = (s) => crypto.createHash("sha256").update(String(s)).digest("hex");

// ---- email through Resend (own domain first, Resend's test sender as fallback) ----
async function mail(to, subject, text) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  for (const from of [process.env.WOW_MAIL_FROM || "WoW Autopilot <wow@mazidavid.com>", "WoW Autopilot <onboarding@resend.dev>"]) {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, text }),
    });
    if (r.ok) return true;
    console.error("resend", from, r.status, (await r.text()).slice(0, 200));
  }
  return false;
}

export default async function handler(req, res) {
  try { return await run(req, res); }
  catch (e) { console.error("wow api", e); return send(res, 500, { error: "server error", detail: String(e && e.message || e).slice(0, 160) }); }
}

async function run(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "POST only" });
  const body = jsonBody(req, 2000);
  if (!body) return send(res, 400, { error: "Expected JSON" });
  const device = String(body.device || "").slice(0, 80);
  if (!/^[A-Za-z0-9_-]{6,80}$/.test(device)) return send(res, 400, { error: "Bad device id" });
  const sql = db();

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
    const used = await sql`INSERT INTO wow_used_codes (step, device) VALUES (${step}, ${device}) ON CONFLICT (step) DO NOTHING RETURNING step`;
    if (!used.length) return send(res, 200, { status: "code_used" });
    const ecode = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
    await sql`INSERT INTO wow_devices (device, email, status, email_code_hash, email_code_exp, email_tries)
              VALUES (${device}, ${email}, 'email_pending', ${hash(ecode)}, now() + interval '15 minutes', 0)
              ON CONFLICT (device) DO UPDATE SET email = ${email}, status = 'email_pending',
                email_code_hash = ${hash(ecode)}, email_code_exp = now() + interval '15 minutes', email_tries = 0, last_seen = now()`;
    const ok = await mail(email, "Your WoW Autopilot email code",
      `Your code is ${ecode}\n\nType it in WoW Autopilot to confirm this email. It works for 15 minutes.\nIf you didn't ask for this, ignore this email.`);
    return send(res, 200, { status: ok ? "email_sent" : "email_failed" });
  }

  if (body.action === "verify_email") {
    const ecode = String(body.email_code || "").trim();
    const rows = await sql`SELECT email, status, email_code_hash, email_code_exp, email_tries FROM wow_devices WHERE device = ${device}`;
    if (!rows.length || rows[0].status !== "email_pending") return send(res, 200, { status: rows.length ? rows[0].status : "unknown" });
    const r = rows[0];
    if (r.email_tries >= 5 || new Date(r.email_code_exp) < new Date()) return send(res, 200, { status: "email_expired" });
    if (hash(ecode) !== r.email_code_hash) {
      await sql`UPDATE wow_devices SET email_tries = email_tries + 1 WHERE device = ${device}`;
      return send(res, 200, { status: "bad_email_code" });
    }
    await sql`UPDATE wow_devices SET status = 'pending', email_code_hash = NULL, last_seen = now() WHERE device = ${device}`;
    await mail(process.env.WOW_OWNER_EMAIL || "davidnsofor@proton.me", `WoW Autopilot: new phone waiting (${r.email})`,
      `${r.email} confirmed their email and is waiting for approval.\n\nNeon -> table wow_devices -> set status to 'approved' (or 'blocked').\nDevice: ${device}`);
    return send(res, 200, { status: "pending" });
  }
  return send(res, 400, { error: "Unknown action" });
}
