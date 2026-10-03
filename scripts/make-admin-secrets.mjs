/* =====================================================================
   make-admin-secrets.mjs: create (or change) your admin login.
   ---------------------------------------------------------------------
   Usage:
     npm run secrets                      → new random password + new 2FA secret
     npm run secrets -- "my new password" → use your own password (min 14 chars)
     npm run secrets -- "pw" --keep-totp  → change only the password

   It prints the three Vercel environment variables to paste into
   Vercel → Project → Settings → Environment Variables:
     ADMIN_PASSWORD_HASH, ADMIN_TOTP_SECRET, SESSION_SECRET
   and writes ADMIN-SECRETS.txt (gitignored) with your password and the
   otpauth:// link for your authenticator app. Put the password in a
   password manager, add the code to your authenticator, then DELETE the file.
   Changing SESSION_SECRET logs out every existing session.
   ===================================================================== */
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import { hashPassword } from "../api/_lib/auth.js";

const args = process.argv.slice(2);
const keepTotp = args.includes("--keep-totp");
let password = args.find((a) => !a.startsWith("--"));
if (password && password.length < 14) { console.error("Use at least 14 characters."); process.exit(1); }

// Random password: 4 groups of 5 from an unambiguous alphabet (~100 bits)
if (!password) {
  const abc = "abcdefghjkmnpqrstuvwxyzACDEFGHJKMNPQRSTUVWXYZ23456789";
  const pick = () => Array.from(randomBytes(5), (b) => abc[b % abc.length]).join("");
  password = [pick(), pick(), pick(), pick()].join("-");
}

const b32 = (buf) => {
  const a = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; let bits = "", out = "";
  for (const b of buf) bits += b.toString(2).padStart(8, "0");
  for (let i = 0; i + 5 <= bits.length; i += 5) out += a[parseInt(bits.slice(i, i + 5), 2)];
  return out;
};
const totp = b32(randomBytes(20));
const session = randomBytes(32).toString("hex");
const otpauth = `otpauth://totp/mazidavid.com:admin?secret=${totp}&issuer=mazidavid.com&algorithm=SHA1&digits=6&period=30`;

const env = [
  `ADMIN_PASSWORD_HASH=${hashPassword(password)}`,
  keepTotp ? "# ADMIN_TOTP_SECRET unchanged" : `ADMIN_TOTP_SECRET=${totp}`,
  `SESSION_SECRET=${session}`,
].join("\n");

writeFileSync("ADMIN-SECRETS.txt", [
  "mazidavid.com admin login. DELETE THIS FILE after saving these somewhere safe.",
  "",
  `Login page: https://work.mazidavid.com/admin`,
  `Password:   ${password}`,
  keepTotp ? "" : `2FA setup key (type into Google Authenticator / 1Password / Aegis): ${totp}`,
  keepTotp ? "" : `2FA link: ${otpauth}`,
  "",
  "Vercel environment variables:",
  env,
  "",
].join("\n"));
console.log(env);
console.log("\nWrote ADMIN-SECRETS.txt (gitignored).");
