/* =====================================================================
   content.js — ONE file of facts shared by mazidavid.com, work. and me.
   ---------------------------------------------------------------------
   Edit this file, run `python build.py`, redeploy. Every page reads
   window.SITE, so you never hunt through HTML to change a sentence.
   Everything here comes from your repos, READMEs, blog and old site.
   ===================================================================== */
window.SITE = {

  person: {
    name: "Mazi David",
    fullName: "David Nsofor",
    funFact: "Mazi means \"Mr.\" in my native language.",
    location: "Halifax, Nova Scotia",
    role: "IT Programming student at NSCC",
    oneLiner: "I build AI agents, browser and launcher extensions, and the small tools that make computers do the boring parts for people.",
    openTo: "Open to co-op / internship placements and freelance web work.",
    email: "davidnsofor@proton.me",
    links: {
      github:   "https://github.com/TechedWind707",
      linkedin: "https://www.linkedin.com/in/david-nsofor",
      blog:     "https://blog.mazidavid.com",
      gallery:  "https://gallery.mazidavid.com",
      x:        "https://x.com/MaziDavid_c3",
      linktree: "https://linktr.ee/mazidavid.c3"
    },
    // The resume PDF. The old /Downloads/Frontend Developer Resume.pdf link redirects here.
    resumePdf: "/assets/David-Nsofor-Resume.pdf"
  },

  /* ---------- PROJECTS (work.mazidavid.com) ----------
     This list is the FALLBACK. The live list comes from the database and is
     edited at work.mazidavid.com/admin. If the API is down, pages use this.
     featured:true -> big card. kind: ai | extension | web | mobile | school | design
     status: ongoing | shipped | ideation | halted     school:true -> coursework
     links: repo / live / post (blog write-up) */
  projects: [
    {
      id: "jamb", title: "JAMB Smart Search", featured: true, kind: "ai", status: "ongoing", year: "2026",
      summary: "A topic-filtered bank of 20,000+ Nigerian JAMB past questions. Existing tools only filter by subject and year; this one answers \"quadratic-equation questions from 2015 to 2020\".",
      did: [
        "Pipeline: fetch from the ALOC API → classify every question's topic and difficulty with an LLM → upsert into Supabase",
        "Free-first classifier (OpenRouter / Gemini Flash) with a Claude Haiku fallback, validated on samples before full runs",
        "Postgres with row-level security: public read, writes only through the service-role loader; a GitHub Actions keep-alive cron"
      ],
      stack: ["Next.js 16", "TypeScript", "Tailwind", "Supabase", "LLM classification"],
      links: {}
    },
    {
      id: "treewatch", title: "HFX TreeWatch", featured: true, kind: "ai", status: "shipped", year: "2026",
      summary: "Severity triage for Halifax Urban Forestry's 311 tree requests. Claude scores the hazard at intake from the resident's photo, description and the address's history, before a truck is sent.",
      did: [
        "Structured scoring with Claude vision + tool use: severity 1–5, a one-line reason citing evidence, and a low-confidence flag when signals conflict",
        "Citizen reporting flow and a ranked forestry queue; dispatcher overrides keep the original score and an audit trail",
        "Built in a 4.5-hour hackathon"
      ],
      stack: ["Next.js 16", "TypeScript", "Prisma", "SQLite", "Claude API"],
      links: { repo: "https://github.com/TechedWind707/hfx-treewatch" }
    },
    {
      id: "logos", title: "Logos AI", featured: true, kind: "mobile", status: "ongoing", year: "2026",
      summary: "An AI study companion that turns course material into flashcards and quizzes, with a coach you can ask why you got something wrong.",
      did: [
        "Android home-screen widget that is a real quiz surface: answer and get feedback without opening the app",
        "Keyword-match scoring that highlights the terms you missed, with zero extra AI calls",
        "Course onboarding that scopes every generated card to what you're actually studying"
      ],
      stack: ["React Native / Expo", "TypeScript", "Kotlin (widget)", "LLM APIs"],
      links: {}
    },
    {
      id: "your-customs", title: "Your Customs", featured: true, kind: "web", status: "shipped", year: "2026",
      summary: "Contra × Lovable Challenge entry: a booking flow for a custom-print shop that turns \"can I book with you?\" into \"you're booked\" with as little work from the owner as possible.",
      did: ["Customer-side availability and booking request flow", "Owner-side confirmations to cut manual back-and-forth"],
      stack: ["Lovable", "React", "TypeScript"],
      links: { live: "https://the-print-shop-app.lovable.app/" }
    },
    {
      id: "rayzam", title: "Rayzam", kind: "extension", status: "shipped", year: "2026",
      summary: "Raycast + Shazam: identify a song from Raycast, keep a local history, jump straight to Spotify, Apple Music or YouTube.",
      did: ["Mic capture through ffmpeg, ACRCloud and AudD providers (bring your own key)", "Song history with export/delete, Jest tests, 33 commits"],
      stack: ["TypeScript", "Raycast API", "ffmpeg"],
      links: { repo: "https://github.com/TechedWind707/Rayzam" }
    },
    {
      id: "spotizam", title: "Spotizam", kind: "extension", status: "shipped", year: "2026",
      summary: "The same idea inside Spotify: a Spicetify extension + optional custom app that recognises songs (or humming) and opens them in Spotify.",
      did: ["Results grouped by search batch, not a flat list", "One-line install scripts for PowerShell and Bash"],
      stack: ["JavaScript", "Spicetify"],
      links: { repo: "https://github.com/TechedWind707/spotizam" }
    },
    {
      id: "raybridge", title: "RayBridge for Windows", kind: "ai", status: "ongoing", year: "2026",
      summary: "Porting an MCP server that exposes Raycast extensions as tools for AI clients (Claude Code, Cursor) from macOS to Windows. 31 extensions / 162 tools now load on Windows.",
      did: ["Fixed extension discovery for Raycast for Windows; file-backed LocalStorage and a real clipboard shim", "Bring-your-own-token fallback for OAuth extensions; macOS-only tools documented as out of scope"],
      stack: ["TypeScript", "Bun", "MCP"],
      links: { repo: "https://github.com/TechedWind707/RayBridge-For-Windows" }
    },
    {
      id: "raycast-cook", title: "Raycast cooking extension", kind: "extension", status: "shipped", year: "2026",
      summary: "When Raycast Pro came to Windows I built a cooking extension for it, and wrote up the process.",
      did: [],
      stack: ["TypeScript", "Raycast API"],
      links: { post: "https://blog.mazidavid.com/i-built-a-cooking-extension-for-raycast" }
    },
    {
      id: "quick-pin", title: "Quick Pin", kind: "extension", status: "shipped", year: "2026",
      summary: "A fast, local-first bookmark launcher for Chromium browsers: pin pages, URLs and JavaScript snippets to a searchable popup.",
      did: ["Manifest V3, no server: all data stays on your machine"],
      stack: ["JavaScript", "Chrome MV3"],
      links: { repo: "https://github.com/TechedWind707/quick-pin-extension" }
    },
    {
      id: "bookmark-master", title: "Bookmark Master", kind: "extension", status: "shipped", year: "2026",
      summary: "Finds and removes duplicate bookmarks and empty folders, and suggests where loose bookmarks belong using AI.",
      did: ["Optional OpenAI-powered organisation with your own key"],
      stack: ["JavaScript", "Chrome MV3", "OpenAI API"],
      links: { repo: "https://github.com/TechedWind707/bookmark-master-extension" }
    },
    {
      id: "shiori", title: "Shiori Auto-Tagger", kind: "ai", status: "shipped", year: "2026",
      summary: "Logs into a self-hosted Shiori bookmark manager, finds every untagged bookmark and tags it with GPT-4o-mini.",
      did: ["Batch tagging from title + URL"],
      stack: ["Python", "OpenAI API", "Shiori"],
      links: { repo: "https://github.com/TechedWind707/shiori_autotagger" }
    },
    {
      id: "game-chat", title: "Game Chat (async TCP client)", kind: "school", school: true, status: "ongoing", year: "2026",
      summary: "Windows Forms chat for a networked game: async sockets in a separate library that raises events; the UI never freezes.",
      did: ["async/await receive loop, events + thread-safe Invoke"],
      stack: ["C#", ".NET", "WinForms", "TCP"],
      links: {}
    },
    {
      id: "booksadmin", title: "BooksAdmin / MoviesAdmin", kind: "school", school: true, status: "shipped", year: "2026",
      summary: "\"Rotten Tomatoes, but for books\" (then movies): admin CRUD dashboards on ASP.NET Core MVC with Entity Framework and SQL Server in Docker.",
      did: ["Controllers, Razor views, migrations, validation"],
      stack: ["C#", "ASP.NET Core MVC", "EF Core", "SQL Server"],
      links: { repo: "https://github.com/TechedWind707/INET-BooksAdmin-Demo" }
    },
    {
      id: "moviesadmin", title: "MoviesAdmin (Sprint 1)", kind: "school", school: true, status: "ongoing", year: "2026",
      summary: "Web Application Programming 1 sprint project: an admin dashboard for a movie catalogue, built sprint by sprint like a real team project.",
      did: ["EF Core models and migrations against SQL Server in Docker", "CRUD controllers and Razor views with server-side validation"],
      stack: ["C#", "ASP.NET Core MVC", "EF Core", "SQL Server", "Docker"],
      links: {}
    },
    {
      id: "cpp-html", title: "C++ to HTML converter", kind: "school", school: true, status: "ongoing", year: "2026",
      summary: "C++ assignment: reads a .cpp source file and writes a browser-viewable HTML copy, escaping < and > so the code shows exactly as written.",
      did: ["File streams with validation and exceptions for bad paths", "Regex-based escaping and a re-run loop that handles end-of-input cleanly"],
      stack: ["C++", "fstream", "regex"],
      links: {}
    },
    {
      id: "alltrails", title: "AllTrails Admin (demo)", kind: "school", school: true, status: "shipped", year: "2026",
      summary: "Class demo: an admin back office for a trails directory, the warm-up for the sprint projects.",
      did: [], stack: ["C#", "ASP.NET Core MVC", "EF Core"],
      links: { repo: "https://github.com/TechedWind707/all-trails-admin-demo" }
    },
    {
      id: "java-a3", title: "Java Assignment 3", kind: "school", school: true, status: "shipped", year: "2025",
      summary: "First-year Java assignment, kept public as a record of where I started.",
      did: [], stack: ["Java"],
      links: { repo: "https://github.com/TechedWind707/Java-Assignment-3" }
    },
    {
      id: "mazi-services", title: "Mazi Services", kind: "web", status: "ongoing", year: "2026",
      summary: "My small-business side: a free walkthrough of a local business's site, Google listing, payments, email and automations, then fixing what's leaking customers.",
      did: ["Interactive self-check and booking flow", "Shares the design system with the rest of mazidavid.com"],
      stack: ["HTML", "CSS", "JavaScript", "Vercel"],
      hidden: true,       // private for now: not shown, not linked
      links: {}
    },
    {
      id: "code-in-motion", title: "Code in Motion", kind: "ai", status: "ideation", year: "2026",
      summary: "A debugger you can watch: includes being fetched, loops circling, pointers walking off the end of an array. Built for students who learn by seeing.",
      did: [], stack: ["Idea"],
      links: {}
    },
    {
      id: "destino", title: "Destino Saboroso", kind: "design", status: "shipped", year: "2025",
      summary: "A responsive restaurant showcase site built on Wix.",
      did: [], stack: ["Wix", "Web design"],
      links: { live: "https://spiritfiled707.wixsite.com/destino-saboroso" }
    },
    {
      id: "hvac", title: "HVAC website (demo)", kind: "design", status: "shipped", year: "2025",
      summary: "Website design for a heat-pump installation and maintenance business.",
      did: [], stack: ["Figma"],
      links: { live: "https://www.figma.com/proto/Y6ozhfpUMCXy6JcL5GfJZf/HVAC-Website?page-id=40%3A1498&node-id=8206-58621&starting-point-node-id=8206%3A58621" }
    },
    {
      id: "down2roots", title: "Down2Roots (demo)", kind: "design", status: "shipped", year: "2025",
      summary: "Website design for a construction and landscaping business.",
      did: [], stack: ["Figma"],
      links: { live: "https://www.figma.com/proto/rkhI2CuVwiNXRLWmGIy4QK/Down2Roots?node-id=0-1" }
    }
  ],

  /* Forks where I fixed or extended someone else's project */
  contributions: [
    { name: "obsidian-book-search-plus", what: "Google Books API retry fixes and an unminified build", href: "https://github.com/TechedWind707/obsidian-book-search-plus" },
    { name: "spicetify-study-banger-app", what: "Renovating and refactoring a Spicetify study app", href: "https://github.com/TechedWind707/spicetify-study-banger-app" },
    { name: "Spictify-Lyric-Miniplayer", what: "Working on Lyrics Plus support for a picture-in-picture lyrics window", href: "https://github.com/TechedWind707/Spictify-Lyric-Miniplayer" },
    { name: "AutoMover (Obsidian)", what: "Adding folder-scoped rules to an auto-filing plugin", href: "https://github.com/TechedWind707/AutoMover" }
  ],

  skills: [
    { group: "Languages", items: ["TypeScript", "JavaScript", "Python", "C#", "C++", "Java", "Kotlin", "SQL", "HTML / CSS"] },
    { group: "Frameworks", items: ["Next.js", "React", "React Native / Expo", "ASP.NET Core MVC", "Entity Framework", "Jetpack Compose", "Tailwind", "Prisma"] },
    { group: "AI", items: ["Claude & OpenAI APIs", "Tool use / structured output", "MCP servers", "LLM classification pipelines"] },
    { group: "Platforms & tools", items: ["Git & GitHub", "Supabase", "Vercel", "Docker", "Bun", "Figma", "Raycast API", "Chrome extensions (MV3)", "Linux"] }
  ],

  /* work.mazidavid.com "Education & experience". (Named "experience" so it
     doesn't clash with the /me life-story "timeline" further down.) */
  experience: [
    { when: "Now", what: "IT Programming diploma (2nd year)", where: "Nova Scotia Community College, Halifax" },
    { when: "Now", what: "Founder, Mazi Services", where: "Finding and fixing what's broken in local businesses' online setup" },
    { when: "2026", what: "Hackathon build: HFX TreeWatch", where: "AI triage for Halifax 311 tree requests" },
    { when: "2026", what: "Contra × Lovable Challenge", where: "Your Customs booking flow" },
    { when: "2025 –", what: "Writing", where: "The Mazi David Blog on Hashnode" },
    { when: "2024", what: "Best graduating student", where: "Mena College, Lagos" }
  ],

  /* Fallback list for the hub if Hashnode can't be reached live */
  posts: [
    { title: "Raycast Pro Is on Windows — And I Built an Extension for It", url: "https://blog.mazidavid.com/i-built-a-cooking-extension-for-raycast", date: "2026-08-20" },
    { title: "$100 in Free Codex Credits for University Students in the U.S. and Canada", url: "https://blog.mazidavid.com/100-in-free-codex-credits-for-university-students-in-the-us-and-canada", date: "2026-09-25" },
    { title: "Transform your Spotify Experience with Spicetify", url: "https://blog.mazidavid.com/transform-your-spotify-experience-with-spicetify", date: "2026-05-12" },
    { title: "Running Python on Your Android Phone", url: "https://blog.mazidavid.com/running-python-on-your-android-phone", date: "2025-11-14" }
  ],

  /* ---------- /me: fallback profile + timeline (live copies are edited in /admin) ---------- */
  profile: {
    photo_url: "",
    greeting: "Hi, I'm David. aka *Mazi David*",   // *stars* = the handwritten part
    bio: "From Lagos → Dartmouth, Nova Scotia. I study IT Programming at NSCC and spend the rest of my time building agents, extensions and small tools that do the boring parts for people.",
    roles: ["AI agents", "Raycast and Chrome extensions", "tools for students", "websites for local businesses"]
  },
  timeline: [
    { when_label: "2018", title: "Common Entrance, then Mena College", body: "Wrote the Common Entrance exam to move from Grade 6 at Zikino into junior high at Mena College, Lagos." },
    { when_label: "2021", title: "Junior WAEC", body: "Grade 9 to Grade 10: wrote the Junior WAEC exams to move from junior high to senior high." },
    { when_label: "Grade 11", title: "Interswitch SPAK 5.0", body: "Represented my school in a Pan-African science and maths competition. Made it to the quarterfinals." },
    { when_label: "July 2024", title: "Graduated senior high", body: "Finished at Mena College as the best graduating student." },
    { when_label: "Sept 2024", title: "Started ADSE at Aptech", body: "Began a two-year Advanced Diploma in Software Engineering." },
    { when_label: "Feb 2025", title: "Moved to Dartmouth, Nova Scotia", body: "New country, new winters." },
    { when_label: "April 2025", title: "Left Aptech", body: "Tried to keep up with the classes online from Canada, then stepped away." },
    { when_label: "Sept 2025", title: "Started at NSCC", body: "IT Programming diploma at Nova Scotia Community College, Halifax." },
    { when_label: "Now", title: "Currently here", body: "Building, shipping, writing. Stick around to see what comes next." }
  ],
  /* ---------- /me: pinned notes (the personal, less tidy side) ----------
     kind: aim | think | build | look | who  */
  notes: [
    { kind: "aim",   title: "Sovereign agents", text: "Personal AI agents that run on hardware you own and do real work with people, not just talk back. Jarvis, but yours.", date: "2026-10-02" },
    { kind: "who",   title: "Mantra", text: "High agency. Stop delaying. Ship.", date: "2026-10-02" },
    { kind: "who",   title: "Fun fact", text: "Mazi means \"Mr.\" in my native language.", date: "2025-01-01" },
    { kind: "think", title: "Code in Motion", text: "A debugger you can watch: includes being fetched, loops circling, pointers walking off the end of an array.", date: "2026-10-03" },
    { kind: "aim",   title: "Co-op 2026", text: "Ship to users who aren't me.", date: "2026-10-01" },
    { kind: "build", title: "Now building", text: "Logos AI's quiz widget, JAMB Smart Search, and this whole mazidavid.com family of sites.", date: "2026-10-03" },
    { kind: "who",   title: "Principles", text: "Not against the environment. Not against people's conscience. Yours to run.", date: "2026-10-02" },
    { kind: "who",   title: "Into", text: "Entrepreneurship, robotics, youth empowerment, music hacks, and AI (yeah).", date: "2025-06-01" },
    { kind: "look",  title: "Photographs", text: "I take a lot of photos on most days. The eyeworthy ones live in the gallery.", date: "2026-08-30", link: "https://gallery.mazidavid.com" },
    { kind: "think", title: "Digital wellbeing", text: "I've written about breaking free from doom scrolling. Still practising.", date: "2025-08-13", link: "https://blog.mazidavid.com/breaking-free-from-doom-scrolling" }
  ]
};
