/* =====================================================================
   /api/admin: everything the admin page can change.
   ---------------------------------------------------------------------
   EVERY request here must pass isAdmin() (valid signed cookie), and
   every change (POST/PUT/DELETE) must also come from an admin origin
   and carry a JSON body. Nothing in this file trusts the browser: all
   input goes through clean*() functions that whitelist fields, cap
   lengths and only allow https:// links.

   ?r=projects   GET list (incl. hidden) · POST create · PUT ?id= update · DELETE ?id=
   ?r=readme     GET ?repo=https://github.com/owner/name → first real image in that README
   ?r=notes      GET list · POST create · PUT ?id= update · DELETE ?id=
   ?r=visitors   GET ?status=pending|approved · PUT ?id= {action} · DELETE ?id=
   ?r=layout     PUT {positions:[{id,x,y}]}  where notes sit on the board
   ?r=edges      GET · POST {from_id,to_id,label} · PUT ?id= {label} · DELETE ?id=
   ?r=timeline   GET · POST · PUT ?id= · DELETE ?id=
   ?r=settings   GET · PUT {photo_url, photo_alt, greeting, bio, roles[]}
   ?r=upload     POST {data: base64, mime}  an image from your device (resized in the browser)
   ?r=audit      GET the last 60 admin events
   ===================================================================== */
import { db } from "./_lib/db.js";
import { send, checkOrigin, envList, jsonBody, audit } from "./_lib/http.js";
import { isAdmin } from "./_lib/auth.js";

const ADMIN_ORIGINS = () => envList("ADMIN_ORIGINS", ["https://work.mazidavid.com"]);

export default async function handler(req, res) {
  if (!isAdmin(req)) return send(res, 401, { error: "Not logged in" });

  const r = String(req.query.r || "");
  const id = req.query.id != null ? String(req.query.id) : null;
  let body = null;

  if (req.method !== "GET") {
    if (!checkOrigin(req, ADMIN_ORIGINS())) return send(res, 403, { error: "Bad origin" });
    if (req.method !== "DELETE") {
      body = jsonBody(req, r === "upload" ? 4_000_000 : 60000);
      if (!body) return send(res, 400, { error: "Expected JSON" });
    }
  }

  try {
    if (r === "projects") return await projects(req, res, id, body);
    if (r === "notes") return await notes(req, res, id, body);
    if (r === "visitors") return await visitors(req, res, id, body);
    if (r === "layout") return await layout(req, res, body);
    if (r === "edges") return await edgesRoute(req, res, id, body);
    if (r === "timeline") return await timeline(req, res, id, body);
    if (r === "settings") return await settings(req, res, body);
    if (r === "upload") return await upload(req, res, body);
    if (r === "readme" && req.method === "GET") return await readmeImage(req, res);
    if (r === "audit" && req.method === "GET") {
      const rows = await db()`select at, action, detail from admin_audit order by id desc limit 60`;
      return send(res, 200, { audit: rows });
    }
    return send(res, 404, { error: "Unknown resource" });
  } catch (err) {
    console.error("admin error", err);
    // Unique-violation on a duplicate project id gets a friendly message
    if (err?.code === "23505") return send(res, 409, { error: "That id is already used." });
    return send(res, 500, { error: "Server error" });
  }
}

/* ------------------------- input cleaning ------------------------- */

const str = (v, max) => String(v ?? "").trim().slice(0, max);
const httpsUrl = (v) => {
  const s = str(v, 600);
  if (!s) return "";
  if (/^\/api\/media\?id=\d+(&v=[a-f0-9]{8})?$/.test(s)) return s;   // an image uploaded through /admin
  try { const u = new URL(s); return u.protocol === "https:" ? u.toString() : ""; } catch { return ""; }
};
const strList = (v, maxItems, maxLen) =>
  (Array.isArray(v) ? v : String(v ?? "").split("\n")).map((x) => str(x, maxLen)).filter(Boolean).slice(0, maxItems);

const KINDS = ["ai", "extension", "web", "mobile", "school", "design"];
const STATUSES = ["ongoing", "shipped", "ideation", "halted"];
const NOTE_KINDS = ["aim", "think", "build", "look", "who", "question", "rant", "video", "obsession", "link"];

function cleanProject(b) {
  const links = {};
  for (const k of ["live", "repo", "post"]) { const u = httpsUrl(b.links?.[k]); if (u) links[k] = u; }
  return {
    title: str(b.title, 120),
    kind: KINDS.includes(b.kind) ? b.kind : "web",
    status: STATUSES.includes(b.status) ? b.status : "ongoing",
    school: !!b.school,
    featured: !!b.featured,
    hidden: !!b.hidden,
    year: str(b.year, 12),
    summary: str(b.summary, 800),
    did: strList(b.did, 8, 300),
    stack: strList(b.stack, 12, 40),
    links,
    image: httpsUrl(b.image),            // thumbnail: https link or an /api/media upload
    sort: Number.isFinite(+b.sort) ? Math.max(0, Math.min(9999, Math.trunc(+b.sort))) : 0,
  };
}

/** Tags attach a blog post, a photo, or any https link to a note. */
function cleanTags(v) {
  if (!Array.isArray(v)) return [];
  return v.slice(0, 6).map((t) => ({
    type: ["post", "photo", "video", "link"].includes(t?.type) ? t.type : "link",
    url: httpsUrl(t?.url),
    title: str(t?.title, 140),
    image: httpsUrl(t?.image),
  })).filter((t) => t.url);
}

function cleanNote(b) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(b.date)) ? b.date : new Date().toISOString().slice(0, 10);
  return {
    kind: NOTE_KINDS.includes(b.kind) ? b.kind : "think",
    title: str(b.title, 140),
    body_md: str(b.body_md, 8000),   // markdown is sanitised again when rendered
    tags: cleanTags(b.tags),
    pinned: !!b.pinned,
    hidden: !!b.hidden,
    date,
  };
}

/* ---------------------------- projects ---------------------------- */

async function projects(req, res, id, body) {
  const sql = db();
  if (req.method === "GET") {
    const rows = await sql`select * from projects order by sort asc, updated_at desc`;
    return send(res, 200, { projects: rows });
  }
  if (req.method === "POST") {
    const p = cleanProject(body);
    const newId = str(body.id, 60).toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    if (!newId || !p.title) return send(res, 400, { error: "id and title are required" });
    await sql`insert into projects (id, title, kind, status, school, featured, hidden, year, summary, did, stack, links, image, sort)
      values (${newId}, ${p.title}, ${p.kind}, ${p.status}, ${p.school}, ${p.featured}, ${p.hidden}, ${p.year}, ${p.summary},
              ${JSON.stringify(p.did)}::jsonb, ${JSON.stringify(p.stack)}::jsonb, ${JSON.stringify(p.links)}::jsonb, ${p.image}, ${p.sort})`;
    await audit(req, "project-create", newId);
    return send(res, 201, { ok: true, id: newId });
  }
  if (!id) return send(res, 400, { error: "id required" });
  if (req.method === "PUT") {
    const p = cleanProject(body);
    if (!p.title) return send(res, 400, { error: "title is required" });
    const rows = await sql`update projects set title=${p.title}, kind=${p.kind}, status=${p.status}, school=${p.school},
      featured=${p.featured}, hidden=${p.hidden}, year=${p.year}, summary=${p.summary},
      did=${JSON.stringify(p.did)}::jsonb, stack=${JSON.stringify(p.stack)}::jsonb, links=${JSON.stringify(p.links)}::jsonb,
      image=${p.image}, sort=${p.sort}, updated_at=now() where id=${id} returning id`;
    if (!rows.length) return send(res, 404, { error: "Not found" });
    await audit(req, "project-update", id);
    return send(res, 200, { ok: true });
  }
  if (req.method === "DELETE") {
    await sql`delete from projects where id=${id}`;
    await audit(req, "project-delete", id);
    return send(res, 200, { ok: true });
  }
  return send(res, 405, { error: "Method not allowed" });
}

/* ----------------------- README → thumbnail ----------------------- */
/* Given a GitHub repo link, read its README through GitHub's public API and
   return the first image that isn't a badge (shields.io etc). Relative paths
   like ./docs/shot.png are turned into full raw.githubusercontent.com links.
   Only github.com repos are accepted, so this can't be used to fetch
   arbitrary URLs from the server. */
async function readmeImage(req, res) {
  const m = String(req.query.repo || "").match(/^https:\/\/github\.com\/([\w.-]{1,100})\/([\w.-]{1,100}?)(?:\.git)?\/?$/);
  if (!m) return send(res, 400, { error: "Give the repo link, like https://github.com/you/project" });
  const [, owner, repo] = m;
  const r = await fetch(`https://api.github.com/repos/${owner}/${repo}/readme`, {
    headers: { Accept: "application/vnd.github.raw+json", "User-Agent": "mazidavid-admin" },
  });
  if (!r.ok) return send(res, 404, { error: r.status === 404 ? "No README found in that repo." : "GitHub didn't answer, try again." });
  const text = (await r.text()).slice(0, 400_000);
  const found = [...text.matchAll(/!\[[^\]]*\]\(\s*<?([^)\s>]+)>?[^)]*\)|<img[^>]+src=["']([^"']+)["']/gi)].map((x) => x[1] || x[2]);
  const isBadge = (u) => /shields\.io|badge|badgen|travis-ci|circleci|codecov|\/actions\/workflows\/|img\.icons8|\.svg(\?|$)/i.test(u);
  const pick = found.find((u) => !isBadge(u));
  if (!pick) return send(res, 404, { error: "That README has no picture (badges skipped)." });
  let url;
  try { url = new URL(pick, `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/`); } catch { url = null; }
  // github.com/.../blob/... image links → their raw version
  if (url && url.hostname === "github.com" && url.pathname.includes("/blob/")) url = new URL(`https://raw.githubusercontent.com${url.pathname.replace("/blob/", "/")}`);
  if (!url || url.protocol !== "https:") return send(res, 404, { error: "Found an image but its link isn't https." });
  return send(res, 200, { image: url.toString() });
}

/* ------------------------------ notes ----------------------------- */

async function notes(req, res, id, body) {
  const sql = db();
  if (req.method === "GET") {
    const rows = await sql`select id::int as id, kind, title, body_md, tags, pinned, hidden, x, y, to_char(note_date,'YYYY-MM-DD') as date
      from board_notes order by pinned desc, note_date desc, id desc`;
    return send(res, 200, { notes: rows });
  }
  if (req.method === "POST") {
    const n = cleanNote(body);
    if (!n.title && !n.body_md) return send(res, 400, { error: "Write something first" });
    const rows = await sql`insert into board_notes (kind, title, body_md, tags, pinned, hidden, note_date)
      values (${n.kind}, ${n.title}, ${n.body_md}, ${JSON.stringify(n.tags)}::jsonb, ${n.pinned}, ${n.hidden}, ${n.date})
      returning id::int as id`;
    await audit(req, "note-create", rows[0].id);
    return send(res, 201, { ok: true, id: rows[0].id });
  }
  const nid = Number(id);
  if (!Number.isInteger(nid)) return send(res, 400, { error: "id required" });
  if (req.method === "PUT") {
    const n = cleanNote(body);
    const rows = await sql`update board_notes set kind=${n.kind}, title=${n.title}, body_md=${n.body_md},
      tags=${JSON.stringify(n.tags)}::jsonb, pinned=${n.pinned}, hidden=${n.hidden}, note_date=${n.date}, updated_at=now()
      where id=${nid} returning id`;
    if (!rows.length) return send(res, 404, { error: "Not found" });
    await audit(req, "note-update", nid);
    return send(res, 200, { ok: true });
  }
  if (req.method === "DELETE") {
    await sql`delete from board_notes where id=${nid}`;
    await audit(req, "note-delete", nid);
    return send(res, 200, { ok: true });
  }
  return send(res, 405, { error: "Method not allowed" });
}

/* ---------------------------- visitors ---------------------------- */

async function visitors(req, res, id, body) {
  const sql = db();
  if (req.method === "GET") {
    const status = req.query.status === "approved" ? "approved" : "pending";
    const rows = await sql`select id::int as id, name, body, status, created_at, approved_at from visitor_notes
      where status=${status} order by created_at desc limit 200`;
    return send(res, 200, { visitors: rows });
  }
  const vid = Number(id);
  if (!Number.isInteger(vid)) return send(res, 400, { error: "id required" });
  if (req.method === "PUT") {
    if (body.action === "approve") await sql`update visitor_notes set status='approved', approved_at=now() where id=${vid}`;
    else if (body.action === "unapprove") await sql`update visitor_notes set status='pending', approved_at=null where id=${vid}`;
    else return send(res, 400, { error: "Unknown action" });
    await audit(req, `visitor-${body.action}`, vid);
    return send(res, 200, { ok: true });
  }
  if (req.method === "DELETE") {
    await sql`delete from visitor_notes where id=${vid}`;
    await audit(req, "visitor-delete", vid);
    return send(res, 200, { ok: true });
  }
  return send(res, 405, { error: "Method not allowed" });
}

/* ----------------------------- layout ----------------------------- */
/* Saves where every note sits on the board (one query for all of them). */
async function layout(req, res, body) {
  if (req.method !== "PUT") return send(res, 405, { error: "Method not allowed" });
  const list = Array.isArray(body.positions) ? body.positions.slice(0, 500) : [];
  const ok = list.filter((p) => Number.isInteger(p.id) && Number.isFinite(p.x) && Number.isFinite(p.y));
  if (!ok.length) return send(res, 400, { error: "No positions" });
  const clamp = (v) => Math.max(-20000, Math.min(20000, Math.round(v)));
  await db()`update board_notes b set x = v.x, y = v.y
    from unnest(${ok.map((p) => p.id)}::bigint[], ${ok.map((p) => clamp(p.x))}::real[], ${ok.map((p) => clamp(p.y))}::real[]) as v(id, x, y)
    where b.id = v.id`;
  await audit(req, "layout-save", `${ok.length} notes`);
  return send(res, 200, { ok: true });
}

/* ------------------------------ edges ------------------------------ */
async function edgesRoute(req, res, id, body) {
  const sql = db();
  if (req.method === "GET") {
    const rows = await sql`select id::int as id, from_id::int as from_id, to_id::int as to_id, label from board_edges order by id`;
    return send(res, 200, { edges: rows });
  }
  if (req.method === "POST") {
    const a = Number(body.from_id), b = Number(body.to_id);
    if (!Number.isInteger(a) || !Number.isInteger(b) || a === b) return send(res, 400, { error: "Pick two different notes" });
    const rows = await sql`insert into board_edges (from_id, to_id, label) values (${a}, ${b}, ${str(body.label, 60)})
      on conflict do nothing returning id::int as id`;
    if (!rows.length) return send(res, 409, { error: "Those two are already connected" });
    await audit(req, "edge-create", `${a}-${b}`);
    return send(res, 201, { ok: true, id: rows[0].id });
  }
  const eid = Number(id);
  if (!Number.isInteger(eid)) return send(res, 400, { error: "id required" });
  if (req.method === "PUT") {
    await sql`update board_edges set label = ${str(body.label, 60)} where id = ${eid}`;
    await audit(req, "edge-update", eid);
    return send(res, 200, { ok: true });
  }
  if (req.method === "DELETE") {
    await sql`delete from board_edges where id = ${eid}`;
    await audit(req, "edge-delete", eid);
    return send(res, 200, { ok: true });
  }
  return send(res, 405, { error: "Method not allowed" });
}

/* ----------------------------- timeline ----------------------------- */
function cleanTimeline(b) {
  return {
    when_label: str(b.when_label, 40),
    sort_key: /^\d{4}(-\d{2})?(-\d{2})?$/.test(String(b.sort_key)) ? String(b.sort_key) : "9999",
    title: str(b.title, 140),
    body: str(b.body, 1200),
    image_url: httpsUrl(b.image_url),
    image_alt: str(b.image_alt, 200),
    hidden: !!b.hidden,
  };
}
async function timeline(req, res, id, body) {
  const sql = db();
  if (req.method === "GET") {
    const rows = await sql`select id::int as id, when_label, sort_key, title, body, image_url, image_alt, hidden from timeline_items order by sort_key, id`;
    return send(res, 200, { timeline: rows });
  }
  if (req.method === "POST") {
    const t = cleanTimeline(body);
    if (!t.title) return send(res, 400, { error: "Title is required" });
    const rows = await sql`insert into timeline_items (when_label, sort_key, title, body, image_url, image_alt, hidden)
      values (${t.when_label}, ${t.sort_key}, ${t.title}, ${t.body}, ${t.image_url}, ${t.image_alt}, ${t.hidden}) returning id::int as id`;
    await audit(req, "timeline-create", rows[0].id);
    return send(res, 201, { ok: true, id: rows[0].id });
  }
  const tid = Number(id);
  if (!Number.isInteger(tid)) return send(res, 400, { error: "id required" });
  if (req.method === "PUT") {
    const t = cleanTimeline(body);
    if (!t.title) return send(res, 400, { error: "Title is required" });
    await sql`update timeline_items set when_label=${t.when_label}, sort_key=${t.sort_key}, title=${t.title}, body=${t.body},
      image_url=${t.image_url}, image_alt=${t.image_alt}, hidden=${t.hidden}, updated_at=now() where id=${tid}`;
    await audit(req, "timeline-update", tid);
    return send(res, 200, { ok: true });
  }
  if (req.method === "DELETE") {
    await sql`delete from timeline_items where id=${tid}`;
    await audit(req, "timeline-delete", tid);
    return send(res, 200, { ok: true });
  }
  return send(res, 405, { error: "Method not allowed" });
}

/* ----------------------------- settings ----------------------------- */
/* The block at the top of me.mazidavid.com: photo, greeting, bio, the typed roles */
async function settings(req, res, body) {
  const sql = db();
  if (req.method === "GET") {
    const rows = await sql`select value from site_settings where key='profile'`;
    return send(res, 200, { profile: rows[0]?.value || {} });
  }
  if (req.method !== "PUT") return send(res, 405, { error: "Method not allowed" });
  const v = {
    photo_url: httpsUrl(body.photo_url),
    photo_alt: str(body.photo_alt, 200),
    greeting: str(body.greeting, 140),
    bio: str(body.bio, 1200),
    roles: strList(body.roles, 10, 60),
  };
  await sql`insert into site_settings (key, value) values ('profile', ${JSON.stringify(v)}::jsonb)
    on conflict (key) do update set value = excluded.value, updated_at = now()`;
  await audit(req, "profile-update");
  return send(res, 200, { ok: true });
}

/* ------------------------------ upload ------------------------------ */
/* The browser already shrank the picture (max 1800px, webp). Here we only
   trust what we can verify: size limit, and the real file signature
   ("magic bytes"), not the name or the mime the browser claims.        */
const SIGNATURES = [
  { mime: "image/jpeg", ok: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: "image/png", ok: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mime: "image/webp", ok: (b) => b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP" },
];
async function upload(req, res, body) {
  if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
  let buf;
  try { buf = Buffer.from(String(body.data || ""), "base64"); } catch { buf = Buffer.alloc(0); }
  if (buf.length < 100) return send(res, 400, { error: "No image received" });
  if (buf.length > 2_500_000) return send(res, 413, { error: "Image is too big (max 2.5 MB after resizing)" });
  const kind = SIGNATURES.find((s) => s.ok(buf));
  if (!kind) return send(res, 415, { error: "Only JPEG, PNG or WebP images" });
  const { createHash } = await import("node:crypto");
  const sha = createHash("sha256").update(buf).digest("hex");
  const w = Math.max(0, Math.min(20000, Math.trunc(+body.width || 0))), h = Math.max(0, Math.min(20000, Math.trunc(+body.height || 0)));
  const sql = db();
  // Same picture uploaded twice → reuse the first copy
  let rows = await sql`select id::int as id from media where sha256 = ${sha}`;
  if (!rows.length) {
    rows = await sql`insert into media (mime, bytes, width, height, sha256, size)
      values (${kind.mime}, ${"\\x" + buf.toString("hex")}::bytea, ${w}, ${h}, ${sha}, ${buf.length}) returning id::int as id`;
  }
  await audit(req, "upload", `media ${rows[0].id} (${Math.round(buf.length / 1024)} KB)`);
  return send(res, 201, { ok: true, url: `/api/media?id=${rows[0].id}&v=${sha.slice(0, 8)}` });
}
