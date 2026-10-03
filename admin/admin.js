/* =====================================================================
   admin.js: the admin page's logic.
   ---------------------------------------------------------------------
   Flow:
     1. GET /api/auth → are we logged in? show login or the app.
     2. Login posts password + 6-digit code; the server sets an HttpOnly
        cookie we can't even see from JS. We just reload state.
     3. Each tab loads its list from /api/admin?r=... and edits it.
   Rule of thumb in this file: anything that came from the database is
   put on the page with textContent or esc(), never raw innerHTML, so a
   weird visitor note can't inject code into YOUR logged-in page.
   ===================================================================== */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** fetch wrapper: JSON in/out, cookie included, errors become exceptions. */
async function api(path, method = "GET", body) {
  const r = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && path !== "/api/auth") { showLogin(); throw new Error("Logged out"); }
  if (!r.ok) throw new Error(j.error || `Error ${r.status}`);
  return j;
}
const say = (el, text, ok = true) => { el.className = "msg " + (ok ? "ok" : "err"); el.textContent = text; };

/* Two-click delete: first click arms the button, second within 4s deletes. */
function armDelete(btn, action) {
  btn.onclick = async () => {
    if (!btn.classList.contains("armed")) {
      btn.classList.add("armed"); btn.textContent = "Click again to delete";
      setTimeout(() => { btn.classList.remove("armed"); btn.textContent = "Delete"; }, 4000);
      return;
    }
    btn.classList.remove("armed"); btn.textContent = "Delete";
    await action();
  };
}

/* ============================== LOGIN ============================== */
function showLogin() { $("#appView").hidden = true; $("#loginView").hidden = false; $("#loginForm").password.focus(); }
function showApp() { $("#loginView").hidden = true; $("#appView").hidden = false; loadTab("projects"); refreshPending(); }

$("#loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target, msg = $("#loginMsg");
  say(msg, "Checking…");
  try {
    await api("/api/auth", "POST", { action: "login", password: f.password.value, code: f.code.value.trim() });
    f.reset(); msg.textContent = ""; showApp();
  } catch (err) { say(msg, err.message, false); f.code.value = ""; }
});

$("#logout").onclick = async () => { await api("/api/auth", "POST", { action: "logout" }).catch(() => {}); showLogin(); };

/* =============================== TABS ============================== */
$$("#tabs button").forEach((b) => (b.onclick = () => loadTab(b.dataset.tab)));
function loadTab(tab) {
  $$("#tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === tab));
  $$("[data-panel]").forEach((p) => (p.hidden = p.dataset.panel !== tab));
  ({ projects: loadProjects, notes: loadNotes, visitors: loadVisitors, audit: loadAudit })[tab]();
}

/* ============================= PROJECTS ============================ */
let projects = [], editingProject = null;
const pf = $("#projectForm");

async function loadProjects() {
  projects = (await api("/api/admin?r=projects")).projects;
  $("#projectList").innerHTML = projects.map((p) => `
    <button class="item ${p.hidden ? "hidden-item" : ""} ${editingProject === p.id ? "on" : ""}" data-id="${esc(p.id)}">
      <b>${esc(p.title)}</b><span class="status st-${esc(p.status)}">${esc(p.status)}</span>
      <span class="meta">#${p.sort} · ${esc(p.kind)}${p.school ? " · school" : ""}${p.featured ? " · featured" : ""}${p.hidden ? " · hidden" : ""} · ${esc(p.year)}</span>
    </button>`).join("");
  $$("#projectList .item").forEach((b) => (b.onclick = () => openProject(projects.find((p) => p.id === b.dataset.id))));
}

function openProject(p) {
  editingProject = p ? p.id : null;
  $$("#projectList .item").forEach((b) => b.classList.toggle("on", b.dataset.id === editingProject));
  pf.hidden = false; $("#projectMsg").textContent = "";
  $("#pfTitle").textContent = p ? `Edit: ${p.title}` : "New project";
  const v = p || { id: "", title: "", kind: "web", status: "ongoing", year: String(new Date().getFullYear()), sort: projects.length, summary: "", did: [], stack: [], links: {} };
  pf.id.value = v.id; pf.id.readOnly = !!p;              // ids are permanent (they're in URLs)
  pf.title.value = v.title; pf.kind.value = v.kind; pf.status.value = v.status;
  pf.year.value = v.year; pf.sort.value = v.sort ?? 0;
  pf.featured.checked = !!v.featured; pf.school.checked = !!v.school; pf.hidden.checked = !!v.hidden;
  pf.summary.value = v.summary; pf.did.value = (v.did || []).join("\n"); pf.stack.value = (v.stack || []).join("\n");
  pf.live.value = v.links?.live || ""; pf.repo.value = v.links?.repo || ""; pf.post.value = v.links?.post || "";
  $("#deleteProject").hidden = !p;
  pf.title.focus();
}
$("#newProject").onclick = () => openProject(null);
$("[data-cancel]", pf).onclick = () => { pf.hidden = true; editingProject = null; loadProjects(); };

pf.addEventListener("submit", async (e) => {
  e.preventDefault();
  const lines = (t) => t.split("\n").map((s) => s.trim()).filter(Boolean);
  const data = {
    id: pf.id.value.trim(), title: pf.title.value, kind: pf.kind.value, status: pf.status.value,
    year: pf.year.value, sort: Number(pf.sort.value), featured: pf.featured.checked, school: pf.school.checked,
    hidden: pf.hidden.checked, summary: pf.summary.value, did: lines(pf.did.value), stack: lines(pf.stack.value),
    links: { live: pf.live.value.trim(), repo: pf.repo.value.trim(), post: pf.post.value.trim() },
  };
  try {
    if (editingProject) await api(`/api/admin?r=projects&id=${encodeURIComponent(editingProject)}`, "PUT", data);
    else { const r = await api("/api/admin?r=projects", "POST", data); editingProject = r.id; }
    say($("#projectMsg"), "Saved. The public site updates within a minute.");
    await loadProjects();
    openProject(projects.find((p) => p.id === editingProject));
    say($("#projectMsg"), "Saved. The public site updates within a minute.");
  } catch (err) { say($("#projectMsg"), err.message, false); }
});
armDelete($("#deleteProject"), async () => {
  try {
    await api(`/api/admin?r=projects&id=${encodeURIComponent(editingProject)}`, "DELETE");
    pf.hidden = true; editingProject = null; loadProjects();
  } catch (err) { say($("#projectMsg"), err.message, false); }
});

/* =============================== NOTES ============================= */
let notes = [], editingNote = null, tags = [];
const nf = $("#noteForm");

// Same markdown pipeline as the public board, so the preview is honest.
marked.setOptions({ gfm: true, breaks: true });
const md = (t) => DOMPurify.sanitize(marked.parse(String(t || "")), { FORBID_TAGS: ["style", "form", "input", "iframe"] });
nf.body_md.addEventListener("input", () => ($("#mdPreview").innerHTML = md(nf.body_md.value)));

async function loadNotes() {
  notes = (await api("/api/admin?r=notes")).notes;
  $("#noteList").innerHTML = notes.map((n) => `
    <button class="item ${n.hidden ? "hidden-item" : ""} ${editingNote === n.id ? "on" : ""}" data-id="${n.id}">
      <b>${esc(n.title || n.body_md.slice(0, 50) || "Untitled")}</b><span class="meta" style="grid-column:auto">${esc(n.kind)}</span>
      <span class="meta">${esc(n.date)}${n.pinned ? " · pinned" : ""}${n.hidden ? " · hidden" : ""}${n.tags.length ? ` · ${n.tags.length} attached` : ""}</span>
    </button>`).join("");
  $$("#noteList .item").forEach((b) => (b.onclick = () => openNote(notes.find((n) => n.id === Number(b.dataset.id)))));
}

function openNote(n) {
  editingNote = n ? n.id : null;
  $$("#noteList .item").forEach((b) => b.classList.toggle("on", Number(b.dataset.id) === editingNote));
  nf.hidden = false; $("#noteMsg").textContent = ""; $("#picker").hidden = true;
  $("#nfTitle").textContent = n ? "Edit note" : "New note";
  const v = n || { kind: "think", title: "", body_md: "", tags: [], pinned: false, hidden: false, date: new Date().toISOString().slice(0, 10) };
  nf.kind.value = v.kind; nf.title.value = v.title; nf.body_md.value = v.body_md; nf.date.value = v.date;
  nf.pinned.checked = v.pinned; nf.hidden.checked = v.hidden;
  tags = [...(v.tags || [])]; renderTags();
  $("#mdPreview").innerHTML = md(v.body_md);
  $("#deleteNote").hidden = !n;
  nf.title.focus();
}
$("#newNote").onclick = () => openNote(null);
$("[data-cancel]", nf).onclick = () => { nf.hidden = true; editingNote = null; loadNotes(); };

function renderTags() {
  const list = $("#tagList");
  list.innerHTML = tags.length ? "" : `<span class="empty">Nothing attached.</span>`;
  tags.forEach((t, i) => {
    const row = document.createElement("div");
    row.className = "tag-row";
    row.innerHTML = `${t.image ? `<img alt="">` : ""}<span><small></small></span><button type="button" title="Remove">×</button>`;
    if (t.image) $("img", row).src = t.image;
    $("small", row).textContent = t.type;
    $("span", row).append(t.title || t.url);
    $("button", row).onclick = () => { tags.splice(i, 1); renderTags(); };
    list.append(row);
  });
}

nf.addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = { kind: nf.kind.value, title: nf.title.value, body_md: nf.body_md.value, date: nf.date.value, pinned: nf.pinned.checked, hidden: nf.hidden.checked, tags };
  try {
    if (editingNote) await api(`/api/admin?r=notes&id=${editingNote}`, "PUT", data);
    else { const r = await api("/api/admin?r=notes", "POST", data); editingNote = r.id; }
    await loadNotes();
    openNote(notes.find((n) => n.id === editingNote));
    say($("#noteMsg"), "Saved. The board updates within a minute.");
  } catch (err) { say($("#noteMsg"), err.message, false); }
});
armDelete($("#deleteNote"), async () => {
  try { await api(`/api/admin?r=notes&id=${editingNote}`, "DELETE"); nf.hidden = true; editingNote = null; loadNotes(); }
  catch (err) { say($("#noteMsg"), err.message, false); }
});

/* ---- pickers: blog posts (Hashnode), photos (gallery), any link ---- */
const picker = $("#picker");
let postCache = null, photoCache = null;

$("#addPost").onclick = async () => {
  picker.hidden = false; picker.textContent = "Loading posts…";
  try {
    if (!postCache) {
      const r = await fetch("https://gql.hashnode.com", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: `{ publication(host:"blog.mazidavid.com"){ posts(first:30){ edges{ node{ title url publishedAt coverImage{ url } } } } } }` }),
      });
      postCache = (await r.json()).data.publication.posts.edges.map((e) => e.node);
    }
    picker.innerHTML = `<div class="posts"></div>`;
    postCache.forEach((p) => {
      const b = document.createElement("button"); b.type = "button";
      b.textContent = `${p.publishedAt.slice(0, 10)} · ${p.title}`;
      b.onclick = () => { tags.push({ type: "post", url: p.url, title: p.title, image: p.coverImage?.url || "" }); renderTags(); picker.hidden = true; };
      $(".posts", picker).append(b);
    });
  } catch { picker.textContent = "Couldn't reach Hashnode. Use + Link instead."; }
};

$("#addPhoto").onclick = async () => {
  picker.hidden = false; picker.textContent = "Loading photos…";
  try {
    if (!photoCache) photoCache = (await (await fetch("https://gallery.mazidavid.com/assets/gallery-data.json")).json()).photos;
    picker.innerHTML = `<div class="photos"></div>`;
    [...photoCache].sort((a, b) => (b.date || "").localeCompare(a.date || "")).forEach((p) => {
      const url = `https://gallery.mazidavid.com/${p.image}`;
      const b = document.createElement("button"); b.type = "button"; b.title = p.displayName || p.date;
      const img = document.createElement("img"); img.loading = "lazy"; img.src = url; img.alt = "";
      b.append(img);
      b.onclick = () => { tags.push({ type: "photo", url, title: p.caption || p.displayName || `Photo, ${p.date}`, image: url }); renderTags(); picker.hidden = true; };
      $(".photos", picker).append(b);
    });
  } catch { picker.textContent = "Couldn't load the gallery index."; }
};

$("#addLink").onclick = () => {
  picker.hidden = false;
  picker.innerHTML = `<div class="linkform"><input placeholder="https://…" id="lkUrl" type="url"><input placeholder="Title (optional)" id="lkTitle"><button class="btn sm" type="button" id="lkAdd">Attach</button></div>`;
  $("#lkAdd").onclick = () => {
    const url = $("#lkUrl").value.trim();
    if (!/^https:\/\//.test(url)) { $("#lkUrl").focus(); return; }
    tags.push({ type: "link", url, title: $("#lkTitle").value.trim(), image: "" }); renderTags(); picker.hidden = true;
  };
};

/* ============================= VISITORS ============================ */
let vStatus = "pending";
$$("#vfilter button").forEach((b) => (b.onclick = () => { vStatus = b.dataset.s; $$("#vfilter button").forEach((x) => x.classList.toggle("on", x === b)); loadVisitors(); }));

async function loadVisitors() {
  const list = (await api(`/api/admin?r=visitors&status=${vStatus}`)).visitors;
  const box = $("#visitorList"); box.innerHTML = "";
  if (!list.length) { box.innerHTML = `<p class="empty">${vStatus === "pending" ? "Nothing waiting." : "Nothing on the wall yet."}</p>`; }
  list.forEach((v) => {
    const card = document.createElement("div"); card.className = "vcard";
    card.innerHTML = `<p></p><span class="by"></span><div class="actions"><button class="btn solid" data-a="${vStatus === "pending" ? "approve" : "unapprove"}">${vStatus === "pending" ? "Approve" : "Take down"}</button><button class="btn danger">Delete</button></div>`;
    $("p", card).textContent = v.body;                                     // textContent: never HTML
    $(".by", card).textContent = `— ${v.name || "Anonymous"} · ${new Date(v.created_at).toLocaleString()}`;
    $("[data-a]", card).onclick = async (e) => { await api(`/api/admin?r=visitors&id=${v.id}`, "PUT", { action: e.target.dataset.a }); loadVisitors(); refreshPending(); };
    armDelete($(".danger", card), async () => { await api(`/api/admin?r=visitors&id=${v.id}`, "DELETE"); loadVisitors(); refreshPending(); });
    box.append(card);
  });
}
async function refreshPending() {
  try { const n = (await api("/api/admin?r=visitors&status=pending")).visitors.length; $("#pendingCount").textContent = n || ""; } catch {}
}

/* =============================== AUDIT ============================= */
async function loadAudit() {
  const rows = (await api("/api/admin?r=audit")).audit;
  const tb = $("#auditBody"); tb.innerHTML = "";
  rows.forEach((r) => {
    const tr = document.createElement("tr");
    [new Date(r.at).toLocaleString(), r.action, r.detail].forEach((t) => { const td = document.createElement("td"); td.textContent = t; tr.append(td); });
    tb.append(tr);
  });
}

/* =============================== START ============================= */
api("/api/auth").then((j) => (j.admin ? showApp() : showLogin())).catch(showLogin);
