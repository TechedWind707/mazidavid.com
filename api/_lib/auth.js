/* =====================================================================
   auth.js: how the admin login stays locked.
   ---------------------------------------------------------------------
   There is ONE admin (you). No user table, no sign-up page. Three
   secrets live only in Vercel's environment variables:

     ADMIN_PASSWORD_HASH  scrypt hash of your password (never the password)
     ADMIN_TOTP_SECRET    base32 secret your authenticator app also holds
     SESSION_SECRET       random 64-hex key that signs the login cookie

   Logging in needs BOTH the password AND the 6-digit code from your
   phone, so a leaked password alone is useless.

   After login you get a cookie:
     __Host-md_admin = <payload>.<signature>
     - HttpOnly         JavaScript can't read it (XSS can't steal it)
     - Secure           only sent over HTTPS
     - SameSite=Strict  never sent by requests that start on other sites
     - __Host- prefix   browser refuses it unless Secure, Path=/, no Domain
                        → it only ever goes to work.mazidavid.com
     - expires after 8 hours
   The payload is signed with HMAC-SHA256; changing one character breaks
   the signature. Rotating SESSION_SECRET logs out every session at once.
   ===================================================================== */
import { createHmac, scryptSync, timingSafeEqual, randomBytes, createHash } from "node:crypto";
import { db } from "./db.js";

export const COOKIE = "__Host-md_admin";
const SESSION_HOURS = 8;

/* ---------------- password ---------------- */

/** Stored format: scrypt$N$r$p$<salt b64>$<hash b64> */
export function verifyPassword(password, stored) {
  try {
    const [algo, N, r, p, saltB64, hashB64] = String(stored).split("$");
    if (algo !== "scrypt") return false;
    const expected = Buffer.from(hashB64, "base64");
    const actual = scryptSync(String(password), Buffer.from(saltB64, "base64"), expected.length, {
      N: Number(N), r: Number(r), p: Number(p), maxmem: 256 * 1024 * 1024,
    });
    return timingSafeEqual(actual, expected);   // constant time: no timing leaks
  } catch {
    return false;
  }
}

/** Used by scripts/make-admin-secrets.mjs to create the hash. */
export function hashPassword(password) {
  const salt = randomBytes(16);
  const N = 32768, r = 8, p = 1;
  const hash = scryptSync(password, salt, 64, { N, r, p, maxmem: 256 * 1024 * 1024 });
  return `scrypt$${N}$${r}$${p}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

/* ---------------- TOTP (the 6-digit code) ----------------
   RFC 6238: code = HMAC-SHA1(secret, floor(time/30)) squeezed to 6 digits.
   We accept the previous/current/next 30s step for clock drift, and we
   remember the last step used so the same code can't be replayed.      */

function base32Decode(s) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const ch of String(s).replace(/=+$/, "").toUpperCase().replace(/\s/g, "")) {
    const v = alphabet.indexOf(ch);
    if (v < 0) throw new Error("bad base32");
    bits += v.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

function totpAt(secret, step) {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(step));
  const h = createHmac("sha1", secret).update(msg).digest();
  const o = h[h.length - 1] & 0xf;
  const n = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1_000_000).padStart(6, "0");
}

/** true if `code` is valid now and hasn't been used before. */
export async function verifyTotp(code) {
  const secretB32 = process.env.ADMIN_TOTP_SECRET;
  if (!secretB32 || !/^\d{6}$/.test(String(code))) return false;
  const secret = base32Decode(secretB32);
  const now = Math.floor(Date.now() / 30000);
  let matched = null;
  for (const step of [now - 1, now, now + 1]) {
    const a = Buffer.from(totpAt(secret, step)), b = Buffer.from(String(code));
    if (timingSafeEqual(a, b)) matched = step;
  }
  if (matched === null) return false;
  // Replay guard: store the highest step ever accepted; refuse anything <= it.
  const rows = await db()`
    insert into rate_limits (key, hits, window_start) values ('totp:last', ${matched}, now())
    on conflict (key) do update set hits = excluded.hits, window_start = now()
      where rate_limits.hits < excluded.hits
    returning hits`;
  return rows.length === 1;
}

/* ---------------- session cookie ---------------- */

const b64url = (buf) => Buffer.from(buf).toString("base64url");
const sign = (data) => createHmac("sha256", process.env.SESSION_SECRET).update(data).digest("base64url");
const uaHash = (req) => createHash("sha256").update(String(req.headers["user-agent"] || "")).digest("base64url").slice(0, 16);

export function makeSessionCookie(req) {
  const payload = b64url(JSON.stringify({
    sub: "admin",
    exp: Date.now() + SESSION_HOURS * 3600 * 1000,
    ua: uaHash(req),                 // a stolen cookie fails in a different browser
    n: randomBytes(8).toString("hex"),
  }));
  const value = `${payload}.${sign(payload)}`;
  return `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_HOURS * 3600}`;
}

export const clearSessionCookie = () => `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;

function readCookie(req, name) {
  const raw = String(req.headers.cookie || "");
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return null;
}

/** Returns true if the request carries a valid, unexpired admin cookie. */
export function isAdmin(req) {
  if (!process.env.SESSION_SECRET) return false;
  const value = readCookie(req, COOKIE);
  if (!value || !value.includes(".")) return false;
  const [payload, sig] = value.split(".");
  const good = Buffer.from(sign(payload)), given = Buffer.from(sig || "");
  if (good.length !== given.length || !timingSafeEqual(good, given)) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    return data.sub === "admin" && data.exp > Date.now() && data.ua === uaHash(req);
  } catch {
    return false;
  }
}
