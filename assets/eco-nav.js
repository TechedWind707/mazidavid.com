/* =====================================================================
   eco-nav.js — the ONE menu bar shared by every mazidavid.com site
   ---------------------------------------------------------------------
   Drop this on any page and it injects a slim black bar at the very top
   with links to every corner of the ecosystem:

     Home · Work · Blog · Gallery · Me · Services

   Usage (one line, anywhere in <body>, ideally right after it opens):
     <script src="assets/eco-nav.js" data-current="work" defer></script>

   data-current = which link to highlight:
     home | work | blog | gallery | me | services

   It is self-contained (brings its own CSS), so it works on the hub,
   the portfolio, the personal site, the photo gallery and Mazi Services
   without touching their stylesheets. To add a new site later, add one
   line to LINKS below and copy this file to every site (build.py does
   it for the mazidavid sites; the gallery and services repos keep their
   own copy).
   ===================================================================== */
(function () {
  // The script tag that loaded us (so we can read data-current)
  const me = document.currentScript || document.querySelector('script[src*="eco-nav"]');
  const current = (me && me.dataset.current) || "";

  // Every place in the ecosystem. Order = order in the bar.
  const LINKS = [
    { id: "home",     label: "Home",     href: "https://mazidavid.com" },
    { id: "work",     label: "Work",     href: "https://work.mazidavid.com" },
    { id: "blog",     label: "Blog",     href: "https://blog.mazidavid.com" },
    { id: "gallery",  label: "Gallery",  href: "https://gallery.mazidavid.com" },
    { id: "me",       label: "Me",       href: "https://me.mazidavid.com" },
    { id: "services", label: "Services", href: "https://services.mazidavid.com" }
  ];

  // Palette (kept in sync with shared/tokens.css by hand: it's 4 values)
  const BLACK = "#0D0D0B", GOLD = "#D1A90A", WHITE = "#FFFFFF";

  const css = `
  .eco-bar{position:relative;z-index:9999;background:${BLACK};color:${WHITE};
    font:500 13px/1 "Instrument Sans",system-ui,-apple-system,"Segoe UI",sans-serif;
    border-bottom:1px solid rgba(209,169,10,.35)}
  .eco-bar *{box-sizing:border-box}
  .eco-in{max-width:1180px;margin:0 auto;padding:0 16px;height:40px;display:flex;align-items:center;gap:14px}
  .eco-mark{display:flex;align-items:center;gap:8px;text-decoration:none;color:${WHITE};font-weight:700;letter-spacing:.02em;flex:none}
  .eco-mark i{width:18px;height:18px;border-radius:6px;background:${GOLD};display:grid;place-items:center;
    font:800 10px/1 system-ui;color:${BLACK};font-style:normal}
  .eco-links{display:flex;gap:2px;margin-left:auto;overflow-x:auto;scrollbar-width:none}
  .eco-links::-webkit-scrollbar{display:none}
  .eco-links a{color:rgba(255,255,255,.72);text-decoration:none;padding:7px 11px;border-radius:999px;white-space:nowrap;transition:color .15s,background .15s}
  .eco-links a:hover{color:${WHITE};background:rgba(255,255,255,.08)}
  .eco-links a.on{background:${GOLD};color:${BLACK};font-weight:600}
  .eco-links a:focus-visible{outline:2px solid ${GOLD};outline-offset:2px}
  @media (max-width:560px){ .eco-mark span{display:none} .eco-in{gap:8px;padding:0 10px} }`;

  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  const bar = document.createElement("nav");
  bar.className = "eco-bar";
  bar.setAttribute("aria-label", "Mazi David sites");
  bar.innerHTML = `
    <div class="eco-in">
      <a class="eco-mark" href="https://mazidavid.com"><i>MD</i><span>Mazi David</span></a>
      <div class="eco-links">
        ${LINKS.map(l => `<a href="${l.href}" class="${l.id === current ? "on" : ""}" ${l.id === current ? 'aria-current="page"' : ""}>${l.label}</a>`).join("")}
      </div>
    </div>`;

  // Insert as the very first thing in <body> (works whether we run early or deferred)
  const place = () => document.body.insertBefore(bar, document.body.firstChild);
  document.body ? place() : document.addEventListener("DOMContentLoaded", place);

  // Keep the active pill visible on small screens
  // (scroll only the link strip, never the page)
  requestAnimationFrame(() => {
    const strip = bar.querySelector(".eco-links"), on = bar.querySelector("a.on");
    if (strip && on) strip.scrollLeft = on.offsetLeft - strip.clientWidth / 2 + on.clientWidth / 2;
  });
})();
