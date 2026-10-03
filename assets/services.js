/* =====================================================================
   Mazi Services — page behaviour
   1. SYSTEMS: the five things we check (one list feeds two sections)
   2. selfCheck(): the tap-to-cycle checklist in the hero
   3. Booking form -> opens an email (mailto) with the details filled in
   ===================================================================== */

// TODO(David): the inbox walkthrough requests should go to
const BOOKING_EMAIL = "davidnsofor@proton.me";

/* ---------- 1. The five systems ----------
   Same order as the logo's five nodes. Edit wording here only. */
const SYSTEMS = [
  { name: "Website", checks: ["Loads fast on a phone", "Contact form actually arrives", "Hours, prices and phone are current"] },
  { name: "Google & socials", checks: ["Google Business hours and photos", "Reviews answered", "Links in bios work"] },
  { name: "Card payments & Shopify", checks: ["Checkout without an account", "Tap-to-pay and receipts", "Fees you didn't know about"] },
  { name: "Email & enquiries", checks: ["Every address has an owner", "Replies don't land in spam", "Enquiries reach your phone"] },
  { name: "Automations & chat", checks: ["After-hours auto-reply", "Booking link everywhere", "Follow-ups that send themselves"] }
];

document.getElementById("systems").innerHTML = SYSTEMS.map((s, i) => `
  <article class="sys">
    <span class="n">0${i + 1}</span>
    <h3>${s.name}</h3>
    <ul>${s.checks.map(c => `<li>${c}</li>`).join("")}</ul>
  </article>`).join("");

/* ---------- 2. Self-check ----------
   Each row cycles: Not sure -> Fine -> Losing me work -> Broken -> Not sure
   The starting states mirror the mockup, so the card looks "alive"
   before anyone touches it. */
const STATES = [
  { key: "unknown", label: "Not sure",        cls: "b-unknown" },
  { key: "fine",    label: "Fine",            cls: "b-fixed"   },
  { key: "weak",    label: "Losing me work",  cls: "b-weak"    },
  { key: "broken",  label: "Broken",          cls: "b-broken"  }
];
const start = [3, 2, 1, 3, 0];                 // index into STATES for each system
const state = SYSTEMS.map((_, i) => start[i]);

function selfCheck() {
  const rows = document.querySelector("#selfcheck .rows");
  rows.innerHTML = SYSTEMS.map((s, i) => {
    const st = STATES[state[i]];
    return `<button class="ci" data-i="${i}" aria-label="${s.name}: ${st.label}. Tap to change.">
              <span>${s.name}</span>
              <span class="st"><span class="badge ${st.cls}"><i></i>${st.label}</span></span>
            </button>`;
  }).join("");
  rows.querySelectorAll(".ci").forEach(b => b.onclick = () => {
    const i = +b.dataset.i;
    state[i] = (state[i] + 1) % STATES.length;   // next state, wrap around
    selfCheck();
    rows.querySelector(`[data-i="${i}"]`).focus(); // keep keyboard focus in place
  });

  // Summary: count anything that isn't "fine"
  const problems = state.filter(s => STATES[s].key === "weak" || STATES[s].key === "broken").length;
  const unsure = state.filter(s => STATES[s].key === "unknown").length;
  let msg;
  if (problems === 0 && unsure === 0) msg = "Looks healthy. A walkthrough would confirm it in 40 minutes.";
  else if (problems === 0) msg = `${unsure} you're not sure about. That's exactly what the walkthrough is for.`;
  else msg = `${problems} leak${problems > 1 ? "s" : ""}${unsure ? ` and ${unsure} unknown` : ""}. Let's find out what they're costing you.`;
  document.querySelector("#selfcheck .summary").innerHTML = `<span>${msg}</span><a href="#book">Book free &rarr;</a>`;
}
selfCheck();

/* ---------- 3. Booking form ----------
   Validates the three required fields, then opens the visitor's email
   app with a pre-written message. Includes their self-check answers so
   you walk into the call already knowing their worries. */
const form = document.getElementById("bookForm");
const msg = form.querySelector(".formmsg");
form.addEventListener("submit", e => {
  e.preventDefault();
  let ok = true;
  form.querySelectorAll("[required]").forEach(f => {
    const bad = !f.value.trim();
    f.classList.toggle("bad", bad);
    if (bad) ok = false;
  });
  if (!ok) { msg.textContent = "Please fill in the highlighted fields."; return; }

  const d = Object.fromEntries(new FormData(form));
  const checks = SYSTEMS.map((s, i) => `- ${s.name}: ${STATES[state[i]].label}`).join("\n");
  const body =
`Hi Mazi Services,

I'd like a free digital walkthrough.

Name: ${d.name}
Business: ${d.business}
Reach me at: ${d.contact}

What's bugging me: ${d.note || "(not sure yet)"}

My quick self-check:
${checks}
`;
  location.href = `mailto:${BOOKING_EMAIL}?subject=${encodeURIComponent("Walkthrough request: " + d.business)}&body=${encodeURIComponent(body)}`;
  msg.textContent = "Opening your email app. If nothing happens, email " + BOOKING_EMAIL;
});

document.getElementById("yr").textContent = new Date().getFullYear();
