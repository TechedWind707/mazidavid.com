import { readFileSync } from "node:fs";
import { createHmac } from "node:crypto";
const txt = readFileSync("ADMIN-SECRETS.txt", "utf8");
const get = (k) => txt.match(new RegExp(`^${k}=(.*)$`, "m"))?.[1] ?? txt.match(new RegExp(`${k}:\\s+(\\S+)`))?.[1];
const B = "http://localhost:3000", O = { Origin: B, "Content-Type": "application/json" };
const b32 = (s) => { const a = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; let bits = ""; for (const c of s) bits += a.indexOf(c).toString(2).padStart(5, "0"); const out = []; for (let i = 0; i + 8 <= bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8), 2)); return Buffer.from(out); };
const code = () => { const m = Buffer.alloc(8); m.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000))); const h = createHmac("sha1", b32(get("ADMIN_TOTP_SECRET"))).update(m).digest(); const o = h[19] & 15; return String((((h[o] & 127) << 24) | (h[o+1] << 16) | (h[o+2] << 8) | h[o+3]) % 1e6).padStart(6, "0"); };
const ok = (n, c) => console.log((c ? "PASS " : "FAIL ") + n);
let r = await fetch(B + "/api/auth", { method: "POST", headers: O, body: JSON.stringify({ action: "login", password: get("Password"), code: code() }) });
const C = { Cookie: r.headers.get("set-cookie").split(";")[0], "user-agent": "node", ...O };
const png = readFileSync("assets/favicon.svg");  // not an image type → should be rejected
r = await fetch(B + "/api/admin?r=upload", { method: "POST", headers: C, body: JSON.stringify({ data: png.toString("base64") }) }); ok("svg/other rejected (415)", r.status === 415);
const jpg = readFileSync("C:/Coding/photo-gallery/assets/thumbs/" + (await import("node:fs")).readdirSync("C:/Coding/photo-gallery/assets/thumbs")[0]);
r = await fetch(B + "/api/admin?r=upload", { method: "POST", headers: C, body: JSON.stringify({ data: jpg.toString("base64"), width: 720, height: 900 }) });
const j = await r.json(); ok("webp upload → url " + j.url, r.status === 201 && /^\/api\/media\?id=\d+&v=/.test(j.url));
r = await fetch(B + j.url); const buf = Buffer.from(await r.arrayBuffer());
ok(`media served (${r.headers.get("content-type")}, ${buf.length} bytes, same=${buf.equals(jpg)})`, r.status === 200 && buf.equals(jpg) && r.headers.get("cache-control").includes("immutable"));
r = await fetch(B + "/api/admin?r=upload", { method: "POST", headers: { ...O, "user-agent": "node" }, body: JSON.stringify({ data: jpg.toString("base64") }) }); ok("upload without login → 401", r.status === 401);
r = await fetch(B + "/api/admin?r=timeline", { headers: C }); const tl = (await r.json()).timeline[0];
r = await fetch(B + `/api/admin?r=timeline&id=${tl.id}`, { method: "PUT", headers: C, body: JSON.stringify({ ...tl, image_url: j.url }) }); 
r = await fetch(B + "/api/admin?r=timeline", { headers: C }); ok("timeline accepts uploaded url", (await r.json()).timeline[0].image_url === j.url);
r = await fetch(B + `/api/admin?r=timeline&id=${tl.id}`, { method: "PUT", headers: C, body: JSON.stringify(tl) });   // put it back
