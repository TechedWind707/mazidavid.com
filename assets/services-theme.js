/* services-theme.js — light/dark switch for Mazi Services only.
   Kept separate from mazidavid.com's eco-nav on purpose: this site may
   move to its own domain, so it remembers the choice in its own storage
   and falls back to the visitor's system setting. */
(function () {
  const KEY = "ms_theme";
  let t = null;
  try { t = localStorage.getItem(KEY); } catch {}
  if (t !== "light" && t !== "dark") t = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  document.documentElement.dataset.theme = t;
  addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("themeBtn");
    if (!btn) return;
    const paint = () => { const d = document.documentElement.dataset.theme === "dark"; btn.textContent = d ? "☀" : "☾"; btn.setAttribute("aria-label", d ? "Switch to light mode" : "Switch to dark mode"); };
    paint();
    btn.addEventListener("click", () => {
      const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem(KEY, next); } catch {}
      paint();
    });
  });
})();
