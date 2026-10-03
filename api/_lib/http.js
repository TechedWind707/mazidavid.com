/* =====================================================================
   http.js: small helpers every route uses.
   ---------------------------------------------------------------------
   - send()          JSON response + safe default headers
   - clientIp()      the visitor's IP (Vercel puts it in x-forwarded-for)
   - ipHash()        we never STORE raw IPs, only a keyed hash of them
   - rateLimit()     "N requests per window" counter kept in Postgres
   - checkOrigin()   blocks requests sent from other websites (CSRF)
   - jsonBody()      insists on application/json + size limit
   ===================================================================== */
import { createHmac } from "node:crypto";
import { db } from "./db.js";

/** Send JSON. no-store by default so nothing private gets cached. */
export function send(res, status, data, extraHeaders = {}) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "no-store");
  for (const [k, v] of Object.entries(extraHeaders)) res.setHeader(k, v);
  res.end(JSON.stringify(data));
}

/** First address in x-forwarded-for is the real client on Vercel. */
export function clientIp(req) {
  const fwd = String(req.headers["x-forwarded-for"] || "");
  return (fwd.split(",")[0] || req.headers["x-real-ip"] || req.socket?.remoteAddress || "unknown").trim();
}

/** Keyed hash: lets us rate-limit and spot abuse without keeping IPs. */
export function ipHash(req) {
  const key = process.env.SESSION_SECRET || "dev-only";
  return createHmac("sha256", key).update("ip:" + clientIp(req)).digest("hex").slice(0, 32);
}

/**
 * rateLimit("login:<iphash>", 5, 900)  → true if this call is allowed.
 * One atomic upsert: if the window expired, reset to 1, else add 1.
 */
export async function rateLimit(key, max, windowSeconds) {
  const sql = db();
  const rows = await sql`
    insert into rate_limits (key, hits, window_start) values (${key}, 1, now())
    on conflict (key) do update set
      hits = case when rate_limits.window_start < now() - make_interval(secs => ${windowSeconds})
                  then 1 else rate_limits.hits + 1 end,
      window_start = case when rate_limits.window_start < now() - make_interval(secs => ${windowSeconds})
                  then now() else rate_limits.window_start end
    returning hits`;
  return rows[0].hits <= max;
}

/**
 * Only accept state-changing requests that come from our own pages.
 * Browsers always send Origin on POST/PUT/DELETE, and a page on
 * evil.com can't fake it. Combined with SameSite=Strict cookies this
 * shuts the door on cross-site request forgery.
 */
export function checkOrigin(req, allowed) {
  const origin = req.headers.origin;
  return typeof origin === "string" && allowed.includes(origin);
}

/** Comma list from an env var, with a default. */
export function envList(name, fallback) {
  const raw = process.env[name];
  return (raw ? raw.split(",") : fallback).map((s) => s.trim()).filter(Boolean);
}

/**
 * Parsed JSON body or null. Rejecting non-JSON content types also blocks
 * plain HTML <form> posts from other sites (they can't send JSON).
 */
export function jsonBody(req, maxBytes = 20000) {
  const type = String(req.headers["content-type"] || "");
  if (!type.startsWith("application/json")) return null;
  const body = req.body;
  if (!body || typeof body !== "object") return null;
  if (JSON.stringify(body).length > maxBytes) return null;
  return body;
}

/** Write a line to the admin audit log (never throws). */
export async function audit(req, action, detail = "") {
  try {
    await db()`insert into admin_audit (action, detail, ip_hash) values (${action}, ${String(detail).slice(0, 300)}, ${ipHash(req)})`;
  } catch { /* logging must never break the request */ }
}
