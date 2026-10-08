/* =====================================================================
   eco-nav.js — the floating menu + light/dark switch for mazidavid.com
   ---------------------------------------------------------------------
   Replaces the old always-on black bar. Now it's a small round "MD"
   button in the bottom-right corner:
     - click it → a little card opens with every site + the theme switch
     - leave it alone for a few seconds → it shrinks to a tiny gold dot,
       so it never competes with the page (good for recruiters on work.)
     - move the mouse near it, scroll up, or tab to it → it grows back
     - DRAG it (mouse or finger) to any edge of the screen if it's in the
       way; it snaps to the nearest side and remembers the spot
     - it hides itself while a photo viewer (.lightbox.is-open) is open

   Usage (first thing inside <body>):
     <script src="/assets/eco-nav.js" data-current="work" data-default="light"></script>

   data-current  which link is "you are here": home|work|blog|gallery|me
   data-default  the page's own theme if the visitor never picked one
   data-extra    optional JSON list of extra links shown first, e.g.
                 '[{"label":"All photos","href":"/gallery.html"}]'

   THEME
   The visitor's choice is saved in a cookie on .mazidavid.com, so
   switching to dark on the hub also makes work., me. and gallery. dark.
   The page reads it as <html data-theme="dark|light">; all colours in
   tokens.css flip from that one attribute. Other scripts can listen:
     window.addEventListener("md-theme", e => e.detail.theme)

   services.mazidavid.com deliberately does NOT load this file, and no
   site links to it: it's kept private for now (and may move to its own
   domain).
   ===================================================================== */
(function () {
  const me = document.currentScript || document.querySelector('script[src*="eco-nav"]');
  const current = (me && me.dataset.current) || "";
  const pageDefault = (me && me.dataset.default) || "dark";
  let extra = [];
  try { extra = JSON.parse((me && me.dataset.extra) || "[]"); } catch { /* ignore bad JSON */ }

  /* ---------------- theme: read, apply, save ---------------- */
  const COOKIE = "md_theme";
  const onMazi = /(^|\.)mazidavid\.com$/.test(location.hostname);
  function readTheme() {
    const m = document.cookie.match(/(?:^|;\s*)md_theme=(light|dark)/);
    if (m) return m[1];
    try { const v = localStorage.getItem(COOKIE); if (v === "light" || v === "dark") return v; } catch {}
    return pageDefault;
  }
  function saveTheme(t) {
    // Cookie on the parent domain = one setting for every *.mazidavid.com site
    document.cookie = `${COOKIE}=${t}; path=/; max-age=31536000; SameSite=Lax${onMazi ? "; domain=.mazidavid.com; Secure" : ""}`;
    try { localStorage.setItem(COOKIE, t); } catch {}
  }
  function applyTheme(t) {
    document.documentElement.dataset.theme = t;
    // "only light" = phones that force dark (Brave night mode, Chrome auto-dark)
    // must leave light mode alone; without it they repaint the page darker.
    document.documentElement.style.colorScheme = t === "dark" ? "dark" : "only light";
    window.dispatchEvent(new CustomEvent("md-theme", { detail: { theme: t } }));
  }
  applyTheme(readTheme());          // runs before the page paints its content
  window.mdTheme = {
    get: () => document.documentElement.dataset.theme,
    set: (t) => { saveTheme(t); applyTheme(t); paintToggle(); },
    toggle: () => window.mdTheme.set(window.mdTheme.get() === "dark" ? "light" : "dark"),
  };

  /* ---------------- links ---------------- */
  const LINKS = [
    { id: "home", label: "Home", href: "https://mazidavid.com" },
    { id: "work", label: "Work", href: "https://work.mazidavid.com" },
    { id: "blog", label: "Blog", href: "https://blog.mazidavid.com" },
    { id: "gallery", label: "Gallery", href: "https://gallery.mazidavid.com" },
    { id: "me", label: "Me", href: "https://me.mazidavid.com" },
  ];

  /* ---------------- styles (self-contained; works on any site) ---------------- */
  const css = `
  .mdnav{position:fixed; right:18px; bottom:18px; z-index:9999; font:500 14px/1.2 "Instrument Sans",system-ui,sans-serif}
  .mdnav *{box-sizing:border-box}
  .mdnav-btn{width:48px; height:48px; border-radius:50%; border:0; cursor:pointer; display:grid; place-items:center;
    background:#0D0D0B; color:#D1A90A; font:700 15px "Fraunces",Georgia,serif; letter-spacing:-.02em;
    box-shadow:0 0 0 2px #D1A90A, 0 12px 30px -10px rgba(0,0,0,.6);
    transition:transform .35s cubic-bezier(.2,.8,.2,1), opacity .35s, width .35s, height .35s, box-shadow .35s}
  html[data-theme="dark"] .mdnav-btn{background:#D1A90A; color:#0D0D0B; box-shadow:0 0 0 2px #0D0D0B, 0 12px 30px -10px rgba(0,0,0,.8)}
  .mdnav-btn:hover{transform:scale(1.06)}
  .mdnav-btn:focus-visible{outline:3px solid #D1A90A; outline-offset:3px}
  /* asleep: a small gold dot with a bigger invisible hit area */
  .mdnav.asleep .mdnav-btn{width:14px; height:14px; font-size:0; opacity:.75; background:#D1A90A; box-shadow:0 0 0 3px rgba(209,169,10,.25)}
  .mdnav.asleep::after{content:""; position:absolute; right:-14px; bottom:-14px; width:60px; height:60px}
  .mdnav-panel{position:absolute; right:0; bottom:62px; min-width:210px; padding:8px; border-radius:20px;
    background:#0D0D0B; color:#F3F1EA; border:1px solid #2A2A26; box-shadow:0 24px 50px -18px rgba(0,0,0,.7);
    opacity:0; transform:translateY(8px) scale(.97); transform-origin:bottom right; pointer-events:none; transition:opacity .2s, transform .2s}
  .mdnav.open .mdnav-panel{opacity:1; transform:none; pointer-events:auto}
  .mdnav-panel a{display:flex; align-items:center; justify-content:space-between; gap:12px; padding:10px 12px; border-radius:12px; color:inherit; text-decoration:none}
  .mdnav-panel a:hover,.mdnav-panel a:focus-visible{background:#1E1E1A; outline:none}
  .mdnav-panel a[aria-current="page"]{background:#D1A90A; color:#0D0D0B}
  .mdnav-panel a small{font:500 11px "IBM Plex Mono",monospace; opacity:.6}
  .mdnav-sep{height:1px; background:#2A2A26; margin:6px 4px}
  .mdnav-theme{display:flex; width:100%; align-items:center; justify-content:space-between; gap:10px; padding:10px 12px; border:0; border-radius:12px; background:transparent; color:inherit; font:inherit; cursor:pointer}
  .mdnav-theme:hover,.mdnav-theme:focus-visible{background:#1E1E1A; outline:none}
  .mdnav-switch{position:relative; width:44px; height:24px; border-radius:999px; background:#2A2A26; flex:none}
  .mdnav-switch i{position:absolute; top:3px; left:3px; width:18px; height:18px; border-radius:50%; background:#F3F1EA; transition:transform .25s; display:grid; place-items:center; font-style:normal; font-size:11px}
  html[data-theme="dark"] .mdnav-switch{background:#D1A90A}
  html[data-theme="dark"] .mdnav-switch i{transform:translateX(20px); background:#0D0D0B; color:#D1A90A}
  .mdnav.dragging .mdnav-btn{transform:scale(1.12); cursor:grabbing; transition:none}
  .mdnav.left .mdnav-panel{right:auto; left:0; transform-origin:bottom left}
  .mdnav.top .mdnav-panel{bottom:auto; top:62px}
  .mdnav.left.asleep::after{right:auto; left:-14px}
  body:has(.lightbox.is-open) .mdnav{display:none}
  @media (prefers-reduced-motion:reduce){.mdnav *{transition:none !important}}
  @media print{.mdnav{display:none}}`;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  /* ---------------- markup ---------------- */
  const nav = document.createElement("nav");
  nav.className = "mdnav";
  nav.setAttribute("aria-label", "Mazi David sites");
  const items = [
    ...extra.map((l) => `<a href="${l.href}">${l.label}</a>`),
    ...(extra.length ? ['<div class="mdnav-sep"></div>'] : []),
    ...LINKS.map((l) => `<a href="${l.href}"${l.id === current ? ' aria-current="page"' : ""}>${l.label}${l.id === current ? "<small>here</small>" : ""}</a>`),
  ].join("");
  nav.innerHTML = `
    <div class="mdnav-panel" id="mdnav-panel">${items}
      <div class="mdnav-sep"></div>
      <button class="mdnav-theme" type="button" aria-label="Switch light or dark mode"><span class="mdnav-label"></span><span class="mdnav-switch"><i></i></span></button>
    </div>
    <button class="mdnav-btn" type="button" aria-expanded="false" aria-controls="mdnav-panel" aria-label="Open site menu">MD</button>`;
  const mount = () => document.body.appendChild(nav);
  document.body ? mount() : document.addEventListener("DOMContentLoaded", mount);

  const btn = nav.querySelector(".mdnav-btn");
  const themeBtn = nav.querySelector(".mdnav-theme");
  function paintToggle() {
    const dark = document.documentElement.dataset.theme === "dark";
    nav.querySelector(".mdnav-label").textContent = dark ? "Dark mode" : "Light mode";
    nav.querySelector(".mdnav-switch i").textContent = dark ? "☾" : "☀";
  }
  paintToggle();
  themeBtn.addEventListener("click", () => window.mdTheme.toggle());

  /* ---------------- open / close ---------------- */
  const setOpen = (o) => { nav.classList.toggle("open", o); btn.setAttribute("aria-expanded", String(o)); if (o) wake(); };
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (justDragged) { justDragged = false; return; }   // the end of a drag is not a click
    setOpen(!nav.classList.contains("open"));
  });
  document.addEventListener("click", (e) => { if (!nav.contains(e.target)) setOpen(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") setOpen(false); });

  /* ---------------- drag to move ----------------
     Press and move more than 6px = a drag. On release it snaps to the
     nearest side (left/right) at that height, and the spot is saved per
     device in localStorage ("md_nav_pos": side + height as a fraction). */
  const POS_KEY = "md_nav_pos";
  let justDragged = false, drag = null;
  function place(side, frac) {
    frac = Math.min(Math.max(frac, 0), 1);
    const h = innerHeight - 66;                        // keep the button fully on screen
    nav.style.top = `${Math.round(12 + frac * (h - 12))}px`;
    nav.style.bottom = "auto";
    nav.style.left = side === "left" ? "18px" : "auto";
    nav.style.right = side === "left" ? "auto" : "18px";
    nav.classList.toggle("left", side === "left");
    nav.classList.toggle("top", frac < 0.5);           // near the top → menu opens downwards
  }
  try { const p = JSON.parse(localStorage.getItem(POS_KEY) || "null"); if (p && p.side) place(p.side, p.frac); } catch {}
  btn.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    drag = { x: e.clientX, y: e.clientY, moved: false };
    btn.setPointerCapture(e.pointerId);
  });
  btn.addEventListener("pointermove", (e) => {
    if (!drag) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 6) return;
    drag.moved = true;
    nav.classList.add("dragging"); nav.classList.remove("asleep"); setOpen(false);
    nav.style.left = `${e.clientX - 24}px`; nav.style.top = `${e.clientY - 24}px`;
    nav.style.right = nav.style.bottom = "auto";
  });
  const endDrag = (e) => {
    if (!drag) return;
    if (drag.moved) {
      const side = e.clientX < innerWidth / 2 ? "left" : "right";
      const frac = (e.clientY - 36) / Math.max(1, innerHeight - 78);
      place(side, frac);
      try { localStorage.setItem(POS_KEY, JSON.stringify({ side, frac: Math.min(Math.max(frac, 0), 1) })); } catch {}
      justDragged = true; setTimeout(() => (justDragged = false), 400);
      wake();
    }
    nav.classList.remove("dragging");
    drag = null;
  };
  btn.addEventListener("pointerup", endDrag);
  btn.addEventListener("pointercancel", endDrag);
  btn.style.touchAction = "none";                      // lets a finger drag it instead of scrolling the page
  addEventListener("resize", () => {
    try { const p = JSON.parse(localStorage.getItem(POS_KEY) || "null"); if (p && p.side) place(p.side, p.frac); } catch {}
  });

  /* ---------------- sleep / wake ----------------
     Shrinks to a dot after 2.5s idle. Wakes when the mouse comes within
     160px of the button (wherever it is), on focus, or when the visitor
     scrolls back up.  */
  let timer;
  function sleep() { if (!nav.classList.contains("open") && !nav.contains(document.activeElement)) nav.classList.add("asleep"); }
  function wake() { nav.classList.remove("asleep"); clearTimeout(timer); timer = setTimeout(sleep, 2500); }
  wake();
  addEventListener("pointermove", (e) => {
    const r = btn.getBoundingClientRect();
    if (Math.abs(e.clientX - (r.left + r.width / 2)) < 160 && Math.abs(e.clientY - (r.top + r.height / 2)) < 160) wake();
  }, { passive: true });
  let lastY = scrollY;
  addEventListener("scroll", () => { if (scrollY < lastY - 40) wake(); lastY = scrollY; }, { passive: true });
  nav.addEventListener("focusin", wake);
  nav.addEventListener("pointerenter", wake);
})();
