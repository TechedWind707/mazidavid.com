/* services-chat.js — the Chatbase chat bubble on Mazi Services.
   ---------------------------------------------------------------------
   HOW TO TURN IT ON
   1. chatbase.co → your bot → Deploy → Chat widget → Embed.
   2. In the code it shows you, find  script.id = "xxxxxxxxxxxx"
   3. Paste that ID between the quotes below, commit, push.
   Empty ID = no bubble, nothing loads.
   Also in Chatbase: Settings → Security → only allow the domain
   services.mazidavid.com, so nobody can run your bot from their site.
   ===================================================================== */
const CHATBASE_BOT_ID = "";

(function () {
  if (!CHATBASE_BOT_ID) return;
  // Chatbase's own loader: queue any calls made before the script arrives
  if (!window.chatbase || window.chatbase("getState") !== "initialized") {
    window.chatbase = (...args) => { (window.chatbase.q = window.chatbase.q || []).push(args); };
    window.chatbase = new Proxy(window.chatbase, {
      get(target, prop) { return prop === "q" ? target.q : (...args) => target(prop, ...args); },
    });
  }
  const load = () => {
    const s = document.createElement("script");
    s.src = "https://www.chatbase.co/embed.min.js";
    s.id = CHATBASE_BOT_ID;
    s.domain = "www.chatbase.co";
    document.body.appendChild(s);
  };
  // load after the page so the chat never slows down the first paint
  if (document.readyState === "complete") load(); else addEventListener("load", load);
})();
