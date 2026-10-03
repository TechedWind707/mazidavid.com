/* =====================================================================
   board.js — the zoomable, connected notes board (me. and /admin)
   ---------------------------------------------------------------------
   Think of it as a corkboard you can fly around:

     container (.bd)            the window you look through
       └─ world (.bd-world)     a huge sheet, moved/zoomed with ONE css
            ├─ svg (.bd-edges)  transform: translate(tx,ty) scale(s)
            └─ notes (.bd-node) absolutely positioned at their x, y

   Everything (notes AND lines) lives in "world" coordinates, so the lines
   stay attached to the notes at any zoom. Moving the view never moves
   the data: we only change tx, ty (pan) and s (zoom).

   LINES between notes are SVG curves. Each line can carry a tiny label
   written ALONG the curve (<textPath>). Notes with 3+ connections are
   "hubs": bigger, with a gold ring and thicker lines.

   MODES
   view  (me.mazidavid.com): visitors can pan, zoom, drag notes and react.
         Dragging is just for fun: nothing is saved, a reload restores
         your layout.
   edit  (/admin): dragging updates positions (you hit Save), and
         "connect" mode links two notes with a click on each.

   Usage:
     const b = MDBoard.create(el, { mode, notes, edges, reactions,
       renderBody(note) → html, onReact(id, emoji), onMove(id,x,y),
       onConnect(a,b), onSelect(id) });
     b.setData({notes, edges, reactions}); b.fit(); b.zoom(1.2);
   ===================================================================== */
(function () {
  const EMOJI = { heart: "❤️", fire: "🔥", idea: "💡", laugh: "😂", mindblown: "🤯" };
  const W = 270, WIDE = 350;               // note widths in world units
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function create(root, opts) {
    const o = Object.assign({ mode: "view", notes: [], edges: [], reactions: {}, renderBody: (n) => esc(n.body_md) }, opts);
    root.classList.add("bd", `bd-${o.mode}`);
    root.innerHTML = `
      <div class="bd-world"><svg class="bd-edges" aria-hidden="true"></svg></div>
      <div class="bd-tools">
        <button type="button" data-z="out" aria-label="Zoom out">−</button>
        <button type="button" data-z="in" aria-label="Zoom in">+</button>
        <button type="button" data-z="fit" aria-label="Fit everything">Fit</button>
        ${o.mode === "view" ? `<button type="button" data-z="reset" aria-label="Put notes back">Reset</button>` : ""}
      </div>
      <div class="bd-hint" aria-hidden="true"></div>
      ${o.mode === "view" ? `<button type="button" class="bd-engage">Tap to explore the board</button><button type="button" class="bd-done">Done</button>` : ""}`;
    const world = root.querySelector(".bd-world");
    const svg = root.querySelector(".bd-edges");
    const hint = root.querySelector(".bd-hint");

    let notes = [], edges = [], reactions = {}, home = new Map();   // home = the saved layout
    let tx = 0, ty = 0, s = 1;
    let focusId = null, connectFrom = null, connectMode = false;

    const apply = () => { world.style.transform = `translate(${tx}px,${ty}px) scale(${s})`; root.style.setProperty("--bd-s", s); };
    const flash = (t) => { hint.textContent = t; hint.classList.add("on"); clearTimeout(flash.t); flash.t = setTimeout(() => hint.classList.remove("on"), 1400); };

    /* ------------------------------ data ------------------------------ */
    function setData(d) {
      notes = (d.notes || []).map((n) => ({ ...n }));
      edges = d.edges || [];
      reactions = d.reactions || {};
      autoPlace();
      home = new Map(notes.map((n) => [n.id, { x: n.x, y: n.y }]));
      render();
    }

    /* Notes that were never placed get a spot on a ring around the rest */
    function autoPlace() {
      const placed = notes.filter((n) => n.x != null && n.y != null);
      const loose = notes.filter((n) => n.x == null || n.y == null);
      if (!loose.length) return;
      let cx = 0, cy = 0, r = 0;
      if (placed.length) {
        cx = placed.reduce((a, n) => a + n.x, 0) / placed.length;
        cy = placed.reduce((a, n) => a + n.y, 0) / placed.length;
        r = Math.max(...placed.map((n) => Math.hypot(n.x - cx, n.y - cy))) + 380;
      } else r = loose.length > 1 ? 260 + loose.length * 40 : 0;
      loose.forEach((n, i) => {
        const a = (i / loose.length) * Math.PI * 2 - Math.PI / 2;
        n.x = Math.round(cx + Math.cos(a) * r);
        n.y = Math.round(cy + Math.sin(a) * r * 0.7);
      });
    }

    const degree = (id) => edges.filter((e) => e.from_id === id || e.to_id === id).length;

    /* ----------------------------- render ----------------------------- */
    function render() {
      world.querySelectorAll(".bd-node").forEach((el) => el.remove());
      for (const n of notes) {
        const deg = degree(n.id);
        const wide = (n.body_md || "").length > 260 || (n.tags || []).length > 1;
        const el = document.createElement("article");
        el.className = `bd-node k-${n.kind}${deg >= 3 ? " hub" : ""}${n.pinned ? " pinned" : ""}`;
        el.dataset.id = n.id;
        el.style.left = n.x + "px"; el.style.top = n.y + "px"; el.style.width = (wide ? WIDE : W) + "px";
        el.style.setProperty("--rot", (((n.id * 37) % 7) - 3) * 0.6 + "deg");   // stable little tilt per note
        el.innerHTML = `${o.renderBody(n)}${reactRow(n)}${deg ? `<span class="bd-deg" title="${deg} connections">${deg}</span>` : ""}`;
        world.appendChild(el);
      }
      drawEdges();
      applyFocus();
    }

    function reactRow(n) {
      if (o.mode !== "view" || !o.onReact) return "";
      const r = reactions[n.id] || {};
      let mine = {};
      try { mine = JSON.parse(localStorage.getItem("md_reacted") || "{}"); } catch {}
      return `<div class="bd-react">${Object.entries(EMOJI).map(([k, e]) =>
        `<button type="button" data-react="${k}" class="${mine[`${n.id}:${k}`] ? "mine" : ""}" aria-label="React ${k}">${e}${r[k] ? `<b>${r[k]}</b>` : ""}</button>`).join("")}</div>`;
    }

    function center(id) {
      const el = world.querySelector(`.bd-node[data-id="${id}"]`);
      const n = notes.find((x) => x.id === id);
      if (!el || !n) return null;
      return { x: n.x + el.offsetWidth / 2, y: n.y + el.offsetHeight / 2 };
    }

    function drawEdges() {
      let html = "";
      for (const e of edges) {
        let a = center(e.from_id), b = center(e.to_id);
        if (!a || !b) continue;
        if (a.x > b.x) [a, b] = [b, a];                       // left→right so the label is never upside down
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
        const bend = Math.min(80, len * 0.12);
        const cx = mx - (dy / len) * bend, cy = my + (dx / len) * bend;   // control point, nudged sideways
        const hub = degree(e.from_id) >= 3 || degree(e.to_id) >= 3;
        html += `<g class="bd-edge${hub ? " hub" : ""}" data-a="${e.from_id}" data-b="${e.to_id}" data-id="${e.id}">
          <path id="bd-e${e.id}-${o.mode}" d="M${a.x},${a.y} Q${cx},${cy} ${b.x},${b.y}"/>
          ${e.label ? `<text dy="-7"><textPath href="#bd-e${e.id}-${o.mode}" startOffset="50%" text-anchor="middle">${esc(e.label)}</textPath></text>` : ""}
        </g>`;
      }
      svg.innerHTML = html;
    }

    /* Clicking a note lights up it and its neighbours, dims the rest */
    function applyFocus() {
      const near = new Set();
      if (focusId != null) {
        near.add(focusId);
        edges.forEach((e) => { if (e.from_id === focusId) near.add(e.to_id); if (e.to_id === focusId) near.add(e.from_id); });
      }
      root.classList.toggle("focusing", focusId != null);
      world.querySelectorAll(".bd-node").forEach((el) => {
        const id = Number(el.dataset.id);
        el.classList.toggle("near", near.has(id));
        el.classList.toggle("sel", id === focusId || id === connectFrom);
      });
      svg.querySelectorAll(".bd-edge").forEach((g) => g.classList.toggle("near", focusId != null && (Number(g.dataset.a) === focusId || Number(g.dataset.b) === focusId)));
    }

    /* --------------------------- view controls --------------------------- */
    function fit(pad = 40) {
      if (!notes.length) return;
      const els = [...world.querySelectorAll(".bd-node")];
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      els.forEach((el) => { const n = notes.find((q) => q.id === Number(el.dataset.id)); x0 = Math.min(x0, n.x); y0 = Math.min(y0, n.y); x1 = Math.max(x1, n.x + el.offsetWidth); y1 = Math.max(y1, n.y + el.offsetHeight); });
      const cw = root.clientWidth, ch = root.clientHeight;
      s = Math.max(0.2, Math.min(1.1, Math.min((cw - pad * 2) / (x1 - x0), (ch - pad * 2) / (y1 - y0))));
      tx = (cw - (x1 - x0) * s) / 2 - x0 * s;
      ty = (ch - (y1 - y0) * s) / 2 - y0 * s;
      // Small screens: "everything" would be unreadably tiny, so start
      // zoomed in on the most connected note instead and let people explore.
      if (s < 0.5 && cw < 700 && o.mode === "view") {
        const hub = [...notes].sort((a, b) => degree(b.id) - degree(a.id))[0];
        const c = center(hub.id);
        s = 0.62; tx = cw / 2 - c.x * s; ty = ch / 2 - c.y * s;
      }
      apply();
    }
    function zoom(f, px = root.clientWidth / 2, py = root.clientHeight / 2) {
      const ns = Math.max(0.2, Math.min(2.5, s * f));
      tx = px - ((px - tx) / s) * ns; ty = py - ((py - ty) / s) * ns;   // keep the point under the cursor still
      s = ns; apply();
    }
    function resetLayout() {
      notes.forEach((n) => { const h = home.get(n.id); if (h) { n.x = h.x; n.y = h.y; } });
      render(); fit(); flash("Back to how David arranged it");
    }

    root.querySelector(".bd-tools").addEventListener("click", (e) => {
      const z = e.target.closest("button")?.dataset.z;
      if (z === "in") zoom(1.25); else if (z === "out") zoom(0.8); else if (z === "fit") fit(); else if (z === "reset") resetLayout();
    });

    /* Phones: the board only grabs touches after "Tap to explore", so it
       never traps someone who is just scrolling down the page. */
    const engageBtn = root.querySelector(".bd-engage"), doneBtn = root.querySelector(".bd-done");
    engageBtn?.addEventListener("click", () => root.classList.add("engaged"));
    doneBtn?.addEventListener("click", () => root.classList.remove("engaged"));

    root.addEventListener("wheel", (e) => {
      if (e.ctrlKey || e.metaKey || root.classList.contains("engaged")) {
        e.preventDefault();
        const r = root.getBoundingClientRect();
        zoom(Math.exp(-e.deltaY * 0.0022), e.clientX - r.left, e.clientY - r.top);
      } else flash("Hold Ctrl (or ⌘) and scroll to zoom");
    }, { passive: false });

    /* ------------------- pointer: pan, pinch, drag notes ------------------- */
    const pts = new Map();
    let drag = null;   // {type:'pan'|'node', ...}
    root.addEventListener("pointerdown", (e) => {
      if (e.target.closest(".bd-tools, .bd-engage, .bd-done, .bd-react, a, button, input, textarea")) return;
      if (e.pointerType === "touch" && o.mode === "view" && !root.classList.contains("engaged")) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      root.setPointerCapture(e.pointerId);
      const nodeEl = e.target.closest(".bd-node");
      if (pts.size === 2) { drag = { type: "pinch", d0: dist(), s0: s, tx0: tx, ty0: ty, m0: mid() }; return; }
      if (nodeEl) {
        const n = notes.find((q) => q.id === Number(nodeEl.dataset.id));
        drag = { type: "node", n, el: nodeEl, sx: e.clientX, sy: e.clientY, x0: n.x, y0: n.y, moved: false };
      } else drag = { type: "pan", sx: e.clientX, sy: e.clientY, tx0: tx, ty0: ty, moved: false };
    });
    root.addEventListener("pointermove", (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (!drag) return;
      if (drag.type === "pinch" && pts.size === 2) {
        const m = mid(), f = dist() / drag.d0, r = root.getBoundingClientRect();
        const ns = Math.max(0.2, Math.min(2.5, drag.s0 * f));
        const px = drag.m0.x - r.left, py = drag.m0.y - r.top;
        tx = px - ((px - drag.tx0) / drag.s0) * ns + (m.x - drag.m0.x);
        ty = py - ((py - drag.ty0) / drag.s0) * ns + (m.y - drag.m0.y);
        s = ns; apply(); return;
      }
      const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
      if (!drag.moved && Math.hypot(dx, dy) < 5) return;
      drag.moved = true;
      if (drag.type === "pan") { tx = drag.tx0 + dx; ty = drag.ty0 + dy; apply(); root.classList.add("panning"); }
      else if (drag.type === "node") {
        drag.n.x = Math.round(drag.x0 + dx / s); drag.n.y = Math.round(drag.y0 + dy / s);
        drag.el.style.left = drag.n.x + "px"; drag.el.style.top = drag.n.y + "px";
        drag.el.classList.add("dragging");
        drawEdges(); applyFocus();
      }
    });
    const end = (e) => {
      pts.delete(e.pointerId);
      if (!drag) return;
      if (drag.type === "node") {
        drag.el.classList.remove("dragging");
        if (drag.moved) o.onMove?.(drag.n.id, drag.n.x, drag.n.y);
        else clickNode(drag.n.id);
      } else if (drag.type === "pan" && !drag.moved) { focusId = null; applyFocus(); }
      root.classList.remove("panning");
      drag = pts.size && drag.type !== "pinch" ? drag : null;
    };
    root.addEventListener("pointerup", end);
    root.addEventListener("pointercancel", end);
    const dist = () => { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y) || 1; };
    const mid = () => { const [a, b] = [...pts.values()]; return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; };

    function clickNode(id) {
      if (connectMode) {
        if (connectFrom == null) { connectFrom = id; flash("Now click the note to connect it to"); }
        else if (connectFrom !== id) { o.onConnect?.(connectFrom, id); connectFrom = null; }
        applyFocus(); return;
      }
      focusId = focusId === id ? null : id;
      applyFocus();
      o.onSelect?.(focusId);
    }

    /* Reactions (view mode) */
    root.addEventListener("click", (e) => {
      const b = e.target.closest("[data-react]");
      if (!b) return;
      const id = Number(b.closest(".bd-node").dataset.id), k = b.dataset.react;
      o.onReact?.(id, k, b);
    });

    addEventListener("resize", () => { clearTimeout(create.rt); create.rt = setTimeout(() => fit(), 200); });

    setData(o);
    return {
      setData, fit, zoom, render,
      setReactions(r) { reactions = r; render(); },
      setConnectMode(on) { connectMode = on; connectFrom = null; root.classList.toggle("connecting", on); applyFocus(); },
      positions: () => notes.map((n) => ({ id: n.id, x: n.x, y: n.y })),
      focus(id) { focusId = id; applyFocus(); },
    };
  }

  window.MDBoard = { create, EMOJI };
})();
