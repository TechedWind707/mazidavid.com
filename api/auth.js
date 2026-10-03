/* =====================================================================
   /api/auth: log in, log out, "am I logged in?"
   ---------------------------------------------------------------------
   GET  /api/auth                → { admin: true|false }
   POST /api/auth  {action:"login", password, code}
   POST /api/auth  {action:"logout"}

   Defences on login, in order:
     1. Origin must be an admin origin (work.mazidavid.com)
     2. Body must be JSON
     3. Rate limits: 5 tries / 15 min per IP, 20 / hour for everyone
        (slows guessing even from many IPs)
     4. Password (scrypt, constant-time) AND 6-digit code must BOTH pass
     5. Same vague error for every failure, plus a small delay, so an
        attacker can't tell which part was wrong
   Every attempt is written to admin_audit.
   ===================================================================== */
import { send, checkOrigin, envList, jsonBody, rateLimit, ipHash, audit } from "./_lib/http.js";
import { verifyPassword, verifyTotp, makeSessionCookie, clearSessionCookie, isAdmin } from "./_lib/auth.js";

const ADMIN_ORIGINS = () => envList("ADMIN_ORIGINS", ["https://work.mazidavid.com"]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default async function handler(req, res) {
  if (req.method === "GET") return send(res, 200, { admin: isAdmin(req) });
  if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" }, { Allow: "GET, POST" });

  if (!checkOrigin(req, ADMIN_ORIGINS())) return send(res, 403, { error: "Bad origin" });
  const body = jsonBody(req, 2000);
  if (!body) return send(res, 400, { error: "Expected JSON" });

  if (body.action === "logout") {
    await audit(req, "logout");
    return send(res, 200, { ok: true }, { "Set-Cookie": clearSessionCookie() });
  }

  if (body.action !== "login") return send(res, 400, { error: "Unknown action" });

  try {
    const perIp = await rateLimit(`login:${ipHash(req)}`, 5, 15 * 60);
    const global = await rateLimit("login:all", 20, 60 * 60);
    if (!perIp || !global) {
      await audit(req, "login-rate-limited");
      return send(res, 429, { error: "Too many attempts. Try again later." });
    }

    const passOk = verifyPassword(body.password || "", process.env.ADMIN_PASSWORD_HASH || "");
    // Only check (and burn) the TOTP step if the password was right.
    const codeOk = passOk && (await verifyTotp(String(body.code || "").trim()));

    if (!passOk || !codeOk) {
      await audit(req, "login-failed", passOk ? "bad code" : "bad password");
      await sleep(400 + Math.random() * 400);
      return send(res, 401, { error: "Wrong password or code." });
    }

    await audit(req, "login-ok");
    return send(res, 200, { ok: true }, { "Set-Cookie": makeSessionCookie(req) });
  } catch (err) {
    console.error("auth error", err);
    return send(res, 500, { error: "Server error" });
  }
}
