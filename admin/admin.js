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
  ({ projects: loadProjects, notes: loadNotes, layout: loadLayout, timeline: loadTimeline, profile: loadProfile, visitors: loadVisitors, audit: loadAudit })[tab]();
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

/* Shared gallery picker: fills `box` with thumbnails, calls pick({url,title}) */
async function galleryPicker(box, pick) {
  box.hidden = false; box.textContent = "Loading photos…";
  try {
    if (!photoCache) photoCache = (await (await fetch("https://gallery.mazidavid.com/assets/gallery-data.json")).json()).photos;
    box.innerHTML = `<div class="photos"></div>`;
    [...photoCache].sort((a, b) => (b.date || "").localeCompare(a.date || "")).forEach((p) => {
      const url = `https://gallery.mazidavid.com/${p.image}`;
      const b = document.createElement("button"); b.type = "button"; b.title = p.displayName || p.date;
      const img = document.createElement("img"); img.loading = "lazy"; img.src = url; img.alt = "";
      b.append(img);
      b.onclick = () => { pick({ url, title: p.caption || p.displayName || `Photo, ${p.date}` }); box.hidden = true; };
      $(".photos", box).append(b);
    });
  } catch { box.textContent = "Couldn't load the gallery index."; }
}
$("#addPhoto").onclick = () => galleryPicker(picker, ({ url, title }) => { tags.push({ type: "photo", url, title, image: url }); renderTags(); });

$("#addVideo").onclick = () => {
  picker.hidden = false;
  picker.innerHTML = `<div class="linkform"><input placeholder="YouTube (or any video) link: https://…" id="vdUrl" type="url"><input placeholder="Title (optional)" id="vdTitle"><button class="btn sm" type="button" id="vdAdd">Attach video</button></div>`;
  $("#vdAdd").onclick = () => {
    const url = $("#vdUrl").value.trim();
    if (!/^https:\/\//.test(url)) { $("#vdUrl").focus(); return; }
    tags.push({ type: "video", url, title: $("#vdTitle").value.trim(), image: "" }); renderTags(); picker.hidden = true;
  };
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

/* =========================== BOARD LAYOUT ========================== */
/* The same board engine visitors see (assets/board.js) in "edit" mode.
   Moving a note just marks the layout dirty; Save sends every position. */
let layoutBoard = null, layoutNotes = [], layoutEdges = [], layoutDirty = false, pendingPair = null;
const noteName = (id) => { const n = layoutNotes.find((x) => x.id === id); return n ? (n.title || n.body_md.slice(0, 30) || `#${id}`) : `#${id}`; };

async function loadLayout() {
  const [n, e] = await Promise.all([api("/api/admin?r=notes"), api("/api/admin?r=edges")]);
  layoutNotes = n.notes.filter((x) => !x.hidden).map((x) => ({ ...x, x: x.x == null ? null : Number(x.x), y: x.y == null ? null : Number(x.y) }));
  layoutEdges = e.edges;
  const data = { notes: layoutNotes, edges: layoutEdges };
  if (!layoutBoard) {
    layoutBoard = MDBoard.create($("#layoutBoard"), {
      mode: "edit", ...data,
      renderBody: (x) => `<div class="k">${esc(x.kind)}</div><h3>${esc(x.title || "Untitled")}</h3><div class="md">${md(x.body_md).slice(0, 400)}</div>`,
      onMove: () => { layoutDirty = true; say($("#layoutMsg"), "Unsaved changes: press Save layout.", false); },
      onConnect: (a, b) => {
        pendingPair = [a, b];
        $("#pendingEdge").hidden = false;
        $("#pendingNames").textContent = `${noteName(a)}  ↔  ${noteName(b)}`;
        $("#pendingLabel").value = ""; $("#pendingLabel").focus();
      },
    });
  } else layoutBoard.setData(data);
  requestAnimationFrame(() => layoutBoard.fit());
  renderEdgeList();
}

$("#connectBtn").onclick = () => {
  const on = !$("#connectBtn").classList.contains("on");
  $("#connectBtn").classList.toggle("on", on);
  $("#connectBtn").textContent = on ? "Connecting… (click 2 notes)" : "Connect two notes";
  layoutBoard?.setConnectMode(on);
};
$("#saveLayout").onclick = async () => {
  try {
    await api("/api/admin?r=layout", "PUT", { positions: layoutBoard.positions().filter((p) => Number.isFinite(p.x)) });
    layoutDirty = false; say($("#layoutMsg"), "Layout saved. Visitors will see this arrangement.");
  } catch (err) { say($("#layoutMsg"), err.message, false); }
};
$("#pendingCancel").onclick = () => { pendingPair = null; $("#pendingEdge").hidden = true; };
$("#pendingAdd").onclick = async () => {
  if (!pendingPair) return;
  try {
    // Save positions first so the new line is drawn where you see it
    if (layoutDirty) await api("/api/admin?r=layout", "PUT", { positions: layoutBoard.positions() });
    await api("/api/admin?r=edges", "POST", { from_id: pendingPair[0], to_id: pendingPair[1], label: $("#pendingLabel").value });
    pendingPair = null; $("#pendingEdge").hidden = true; layoutDirty = false;
    say($("#layoutMsg"), "Line added.");
    await loadLayout();
  } catch (err) { say($("#layoutMsg"), err.message, false); }
};
window.addEventListener("beforeunload", (e) => { if (layoutDirty) e.preventDefault(); });

function renderEdgeList() {
  $("#edgeCount").textContent = `(${layoutEdges.length})`;
  const box = $("#edgeList"); box.innerHTML = layoutEdges.length ? "" : `<p class="empty">No lines yet.</p>`;
  layoutEdges.forEach((e) => {
    const row = document.createElement("div"); row.className = "edge-row";
    row.innerHTML = `<div class="names"><span></span><button type="button" title="Delete line">×</button></div><input maxlength="60" placeholder="tiny note on the line">`;
    $("span", row).textContent = `${noteName(e.from_id)} ↔ ${noteName(e.to_id)}`;
    const input = $("input", row); input.value = e.label || "";
    input.onchange = async () => { await api(`/api/admin?r=edges&id=${e.id}`, "PUT", { label: input.value }); e.label = input.value; layoutBoard.setData({ notes: layoutBoard.positions().map((p) => ({ ...layoutNotes.find((n) => n.id === p.id), ...p })), edges: layoutEdges }); };
    $("button", row).onclick = async () => { await api(`/api/admin?r=edges&id=${e.id}`, "DELETE"); await loadLayout(); };
    row.onmouseenter = () => layoutBoard.focus(e.from_id);
    row.onmouseleave = () => layoutBoard.focus(null);
    box.append(row);
  });
}

/* ============================== TIMELINE =========================== */
let tlItems = [], editingTl = null;
const tf = $("#tlForm");
async function loadTimeline() {
  tlItems = (await api("/api/admin?r=timeline")).timeline;
  $("#tlList").innerHTML = tlItems.map((t) => `
    <button class="item ${t.hidden ? "hidden-item" : ""} ${editingTl === t.id ? "on" : ""}" data-id="${t.id}">
      <b>${esc(t.title)}</b><span class="meta" style="grid-column:auto">${esc(t.when_label)}</span>
      <span class="meta">sort ${esc(t.sort_key)}${t.image_url ? " · has picture" : ""}${t.hidden ? " · hidden" : ""}</span>
    </button>`).join("");
  $$("#tlList .item").forEach((b) => (b.onclick = () => openTl(tlItems.find((t) => t.id === Number(b.dataset.id)))));
}
function showTlPreview() { const u = tf.image_url.value.trim(); $("#tlPreview").hidden = !u; if (u) $("#tlPreview").src = u; }
function openTl(t) {
  editingTl = t ? t.id : null;
  $$("#tlList .item").forEach((b) => b.classList.toggle("on", Number(b.dataset.id) === editingTl));
  tf.hidden = false; $("#tlMsg").textContent = ""; $("#tlPicker").hidden = true;
  $("#tlTitle").textContent = t ? "Edit point" : "New point";
  const v = t || { when_label: "", sort_key: new Date().toISOString().slice(0, 7), title: "", body: "", image_url: "", image_alt: "", hidden: false };
  for (const k of ["when_label", "sort_key", "title", "body", "image_url", "image_alt"]) tf[k].value = v[k] || "";
  tf.hidden.checked = !!v.hidden;
  $("#deleteTl").hidden = !t; showTlPreview(); tf.title.focus();
}
$("#newTl").onclick = () => openTl(null);
$("[data-cancel]", tf).onclick = () => { tf.hidden = true; editingTl = null; loadTimeline(); };
tf.image_url.addEventListener("input", showTlPreview);
$("#tlPickPhoto").onclick = () => galleryPicker($("#tlPicker"), ({ url, title }) => { tf.image_url.value = url; if (!tf.image_alt.value) tf.image_alt.value = title; showTlPreview(); });
$("#tlClearPhoto").onclick = () => { tf.image_url.value = ""; showTlPreview(); };
tf.addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = { when_label: tf.when_label.value, sort_key: tf.sort_key.value.trim(), title: tf.title.value, body: tf.body.value, image_url: tf.image_url.value.trim(), image_alt: tf.image_alt.value, hidden: tf.hidden.checked };
  try {
    if (editingTl) await api(`/api/admin?r=timeline&id=${editingTl}`, "PUT", data);
    else { const r = await api("/api/admin?r=timeline", "POST", data); editingTl = r.id; }
    await loadTimeline(); openTl(tlItems.find((t) => t.id === editingTl));
    say($("#tlMsg"), "Saved.");
  } catch (err) { say($("#tlMsg"), err.message, false); }
});
armDelete($("#deleteTl"), async () => { await api(`/api/admin?r=timeline&id=${editingTl}`, "DELETE"); tf.hidden = true; editingTl = null; loadTimeline(); });

/* ============================== PROFILE ============================ */
const pf2 = $("#profileForm");
function showPfPreview() { const u = pf2.photo_url.value.trim(); $("#pfPreview").hidden = !u; if (u) $("#pfPreview").src = u; }
async function loadProfile() {
  const p = (await api("/api/admin?r=settings")).profile || {};
  pf2.photo_url.value = p.photo_url || ""; pf2.photo_alt.value = p.photo_alt || "";
  pf2.greeting.value = p.greeting || ""; pf2.bio.value = p.bio || ""; pf2.roles.value = (p.roles || []).join("\n");
  showPfPreview();
}
pf2.photo_url.addEventListener("input", showPfPreview);
$("#pfPick").onclick = () => galleryPicker($("#pfPicker"), ({ url }) => { pf2.photo_url.value = url; showPfPreview(); });
$("#pfClear").onclick = () => { pf2.photo_url.value = ""; showPfPreview(); };
pf2.addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await api("/api/admin?r=settings", "PUT", { photo_url: pf2.photo_url.value.trim(), photo_alt: pf2.photo_alt.value, greeting: pf2.greeting.value, bio: pf2.bio.value, roles: pf2.roles.value.split("\n").map((x) => x.trim()).filter(Boolean) });
    say($("#pfMsg"), "Saved. me.mazidavid.com updates within a minute.");
  } catch (err) { say($("#pfMsg"), err.message, false); }
});

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
