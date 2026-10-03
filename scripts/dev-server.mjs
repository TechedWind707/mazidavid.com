/* =====================================================================
   dev-server.mjs: run the whole site + API locally, no Vercel CLI needed.
   ---------------------------------------------------------------------
   PowerShell:
     $env:DATABASE_URL="postgresql://..."          # from Neon
     $env:ADMIN_ORIGINS="http://localhost:3000"
     $env:PUBLIC_ORIGINS="http://localhost:3000"
     $env:SESSION_SECRET="any-long-random-string"
     $env:ADMIN_PASSWORD_HASH="scrypt$..." ; $env:ADMIN_TOTP_SECRET="..."
     node scripts/dev-server.mjs
   Then open:
     http://localhost:3000/         hub
     http://localhost:3000/work/    work      http://localhost:3000/me/    me
     http://localhost:3000/admin/   admin (cookies work on localhost in Chrome/Edge)
   It mimics Vercel just enough: static files, /api/<name> → api/<name>.js
   with req.query and a parsed JSON req.body.
   ===================================================================== */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname, normalize } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const PORT = Number(process.env.PORT || 3000);
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".json": "application/json", ".pdf": "application/pdf", ".png": "image/png" };

createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname.startsWith("/api/")) {
      const name = url.pathname.slice(5).replace(/[^a-z0-9-]/gi, "");
      const mod = await import(pathToFileURL(join(ROOT, "api", `${name}.js`)).href + `?t=${Date.now()}`);
      req.query = Object.fromEntries(url.searchParams);
      let raw = ""; for await (const c of req) raw += c;
      try { req.body = raw ? JSON.parse(raw) : undefined; } catch { req.body = undefined; }
      return await mod.default(req, res);
    }
    let path = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, "");
    if (path === "" ) path = "hub/index.html";
    let file = join(ROOT, path);
    if ((await stat(file).catch(() => null))?.isDirectory()) file = join(file, "index.html");
    const data = await readFile(file);
    res.writeHead(200, { "Content-Type": TYPES[extname(file)] || "application/octet-stream" });
    res.end(data);
  } catch (err) {
    res.writeHead(err.code === "ENOENT" ? 404 : 500, { "Content-Type": "text/plain" });
    res.end(err.code === "ENOENT" ? "Not found" : String(err.stack || err));
  }
}).listen(PORT, () => console.log(`dev server on http://localhost:${PORT}`));
