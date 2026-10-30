/* Atlas app — main: sign-in, the cloud API, live data (control rows over Realtime), Talk, Builds, Memory, Settings.
   One account (the AIM owner), so Safari shares AIM's session; the home-screen app signs in once. */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const APP_VERSION = "20261030.1700";
  const SUPABASE_URL = "https://lumnwuxxcaksybrrksng.supabase.co";
  const SUPABASE_KEY = "sb_publishable_hoH-oI3ZtaFdfSCVvNyNqA_bPHmIj42";   // public by design; data is locked to one account
  const FN = /atlas-staging/.test(location.pathname) || /localhost|127\.0\.0\.1/.test(location.hostname) ? "atlas-staging" : "atlas";
  const API = SUPABASE_URL + "/functions/v1/" + FN;
  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  const store = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };

  // ------------------------------------------------------------------ words
  const T = {
    he: {
      signinLead: "העוזר האישי שלך. מתחברים פעם אחת עם חשבון AIM.", email: "אימייל", password: "סיסמה", signIn: "התחברות", signinBad: "האימייל או הסיסמה לא נכונים.",
      pcOnline: "המחשב מחובר", offline: "אין רשת", tTalk: "דיבור", tBuilds: "בניות", tMemory: "זיכרון", tSettings: "הגדרות",
      talk: "דברו עם Atlas", keyboard: "מקלדת", vision: "מצלמה", send: "שליחה", flip: "החלפת מצלמה", typePh: "כתבו ל-Atlas…",
      sIdle: "הקישו על המיקרופון כדי לדבר", sConnecting: "מתחבר…", sListening: "מקשיב…", sThinking: "חושב…", sSpeaking: "מדבר…", sError: "החיבור נפל. נסו שוב.",
      q1: "תבנה לי אתר", q2: "מה מזג האוויר?", q3: "מה אתה יודע עליי?", q4: "מה קורה במחשב?", q5: "תספר לי משהו מעניין",
      buildQ: "מה לבנות?", buildPh: "למשל: אתר למסעדת סושי בתל אביב, עם תפריט אומקסה והזמנת מקום", build: "בנה", gallery: "הגלריה", sites: "אתרים",
      idea1: "דף נחיתה לבית קפה", idea2: "פורטפוליו לצלמת", idea3: "משחק זיכרון צבעוני", idea4: "אתר חתונה",
      aboutYou: "עליך", places: "מקומות", recent: "השיחה האחרונה", add: "הוספה", clear: "ניקוי", noFacts: "Atlas עוד לא יודע עליך כלום. אמרו לו \"תזכור ש…\".",
      noPlaces: "אין מקומות שמורים. אמרו ל-Siri: \"Atlas, תשמור את המקום הזה בתור חניה\".", noHist: "אין שיחה מהעשרים דקות האחרונות.", addFactQ: "מה Atlas צריך לזכור?",
      voice: "קול", language: "שפת דיבור", address: "פנייה בעברית", liveModel: "מודל קולי", appearance: "מראה", theme: "ערכת צבעים", uiLang: "שפת הממשק",
      auto: "אוטומטי", male: "זכר", female: "נקבה", plural: "רבים", dark: "כהה", light: "בהיר", fast: "מהיר",
      siriTitle: "Siri", siriHow: "\"Hey Siri, Atlas\" מפעיל את Atlas מכל מקום, גם מהמסך הנעול. אותו זיכרון, אותם אתרים.",
      siriLast: "שימוש אחרון דרך Siri: ", siriNever: "עוד לא היה שימוש דרך Siri בגרסה החדשה.",
      computer: "המחשב", pcOn: "המחשב מחובר. Claude ", pcIdle: "פנוי לעבודה.", pcWork: "עובד: ", pcOff: "הקו למחשב כבוי כרגע. בניות בענן עובדות גם בלעדיו.",
      about: "אודות", install: "התקנת האפליקציה", signOut: "התנתקות",
      preview: "תצוגה", open: "פתיחה", share: "שיתוף", editVoice: "עריכה", replay: "הצגה חוזרת", apply: "שנה", editPh: "מה לשנות? למשל: כותרת כהה יותר",
      minimize: "מזעור", close: "סגירה", goingLive: "עולה לאוויר… (GitHub Pages)", pagesSlow: "GitHub Pages עדיין מפרסם. אפשר כבר לפתוח.", buildFailed: "הבנייה נכשלה",
      replaying: "הצגה חוזרת של הקוד האמיתי", copied: "הקישור הועתק", building: "בונה", built: "מוכן: ", tapWatch: "הקישו לצפייה", needSignin: "צריך להתחבר",
      micDenied: "אין גישה למיקרופון. אפשרו אותה בהגדרות הדפדפן.", camDenied: "אין גישה למצלמה.", timerDone: "הטיימר הסתיים", newBadge: "חדש", jarvis: "Jarvis",
      daysAgo: "לפני %d ימים", hoursAgo: "לפני %d שעות", minAgo: "לפני %d דקות", justNow: "עכשיו", yesterday: "אתמול", noSites: "עוד אין אתרים. בקשו מ-Atlas לבנות משהו.",
      liveFail: "הקול החי לא זמין כרגע. אפשר לכתוב, או לנסות שוב בעוד רגע.", tapToOpen: "פתיחה: ", call: "התקשרות ל", wa: "וואטסאפ", nav: "ניווט", music: "מוזיקה",
      deleteFact: "מחיקה", version: "גרסה ", health: "המוח בענן: ", healthy: "תקין", down: "לא עונה",
    },
    en: {
      signinLead: "Your personal assistant. Sign in once with your AIM account.", email: "Email", password: "Password", signIn: "Sign in", signinBad: "Wrong email or password.",
      pcOnline: "PC online", offline: "Offline", tTalk: "Talk", tBuilds: "Builds", tMemory: "Memory", tSettings: "Settings",
      talk: "Talk to Atlas", keyboard: "Keyboard", vision: "Camera", send: "Send", flip: "Flip camera", typePh: "Message Atlas…",
      sIdle: "Tap the mic to talk", sConnecting: "Connecting…", sListening: "Listening…", sThinking: "Thinking…", sSpeaking: "Speaking…", sError: "Connection lost. Try again.",
      q1: "Build me a website", q2: "What's the weather?", q3: "What do you know about me?", q4: "What's my computer doing?", q5: "Tell me something interesting",
      buildQ: "What should I build?", buildPh: "e.g. a site for a sushi bar in Tel Aviv with an omakase menu and reservations", build: "Build", gallery: "Gallery", sites: "sites",
      idea1: "Coffee shop landing page", idea2: "Photographer portfolio", idea3: "Colorful memory game", idea4: "Wedding website",
      aboutYou: "About you", places: "Places", recent: "Recent conversation", add: "Add", clear: "Clear", noFacts: "Atlas doesn't know anything about you yet. Say \"remember that…\".",
      noPlaces: "No saved places. Tell Siri: \"Atlas, save this spot as parking\".", noHist: "No conversation in the last 20 minutes.", addFactQ: "What should Atlas remember?",
      voice: "Voice", language: "Speaking language", address: "Hebrew address form", liveModel: "Voice model", appearance: "Appearance", theme: "Theme", uiLang: "App language",
      auto: "Auto", male: "Male", female: "Female", plural: "Plural", dark: "Dark", light: "Light", fast: "Fast",
      siriTitle: "Siri", siriHow: "\"Hey Siri, Atlas\" starts Atlas from anywhere, even the lock screen. Same memory, same sites.",
      siriLast: "Last used through Siri: ", siriNever: "No Siri use of the new version yet.",
      computer: "Computer", pcOn: "The computer is on. Claude is ", pcIdle: "free for a job.", pcWork: "working: ", pcOff: "The computer line is off right now. Cloud builds work without it.",
      about: "About", install: "Install the app", signOut: "Sign out",
      preview: "Preview", open: "Open", share: "Share", editVoice: "Edit", replay: "Replay", apply: "Change", editPh: "What should change? e.g. a darker header",
      minimize: "Minimize", close: "Close", goingLive: "Going live… (GitHub Pages)", pagesSlow: "GitHub Pages is still publishing. You can open it already.", buildFailed: "The build failed",
      replaying: "Replaying the real code", copied: "Link copied", building: "Building", built: "Ready: ", tapWatch: "tap to watch", needSignin: "Please sign in",
      micDenied: "No microphone access. Allow it in the browser settings.", camDenied: "No camera access.", timerDone: "Timer done", newBadge: "new", jarvis: "Jarvis",
      daysAgo: "%d days ago", hoursAgo: "%d hours ago", minAgo: "%d min ago", justNow: "just now", yesterday: "yesterday", noSites: "No sites yet. Ask Atlas to build something.",
      liveFail: "Live voice isn't available right now. You can type, or try again in a moment.", tapToOpen: "Open: ", call: "Call ", wa: "WhatsApp", nav: "Directions", music: "Music",
      deleteFact: "Delete", version: "Version ", health: "Cloud brain: ", healthy: "healthy", down: "not answering",
    },
  };
  let ui = store.get("atlas-ui", (navigator.language || "he").toLowerCase().startsWith("he") ? "he" : "en");
  const t = (k) => (T[ui] && T[ui][k]) || T.en[k] || k;
  function applyLang() {
    document.documentElement.lang = ui; document.documentElement.dir = ui === "he" ? "rtl" : "ltr";
    document.querySelectorAll("[data-t]").forEach((n) => { n.textContent = t(n.dataset.t); });
    document.querySelectorAll("[data-ph]").forEach((n) => { n.placeholder = t(n.dataset.ph); });
    document.querySelectorAll("[data-t-aria]").forEach((n) => n.setAttribute("aria-label", t(n.dataset.tAria)));
    renderQuick(); renderIdeas(); paintState(); renderSettings(); renderMemory(); renderGallery(); renderPc();
  }
  function applyTheme() { document.documentElement.dataset.theme = store.get("atlas-theme", "auto"); }
  applyTheme();

  // ------------------------------------------------------------------ toast
  let toastT = 0;
  function toast(msg, ms = 2600) { const n = $("toast"); n.textContent = msg; n.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { n.hidden = true; }, ms); }

  // ------------------------------------------------------------------ auth + API
  let session = null;
  async function token() {
    const { data } = await sb.auth.getSession();
    session = data.session;
    return session && session.access_token;
  }
  async function api(body) {
    const tok = await token();
    if (!tok) throw new Error(t("needSignin"));
    const r = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + tok }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (d.status && d.status >= 400) throw new Error(d.error || d.say || "error " + d.status);
    return d;
  }
  $("signinForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    $("signinMsg").textContent = "…";
    const { error } = await sb.auth.signInWithPassword({ email: $("email").value.trim(), password: $("password").value });
    $("signinMsg").textContent = error ? t("signinBad") : "";
  });
  sb.auth.onAuthStateChange((_ev, s) => show(!!s));
  let started = false;
  function show(on) {
    $("signin").hidden = on; $("app").hidden = !on;
    if (on && !started) { started = true; boot(); }
  }

  // ------------------------------------------------------------------ live data: control rows
  const rows = {};
  const listeners = new Map();   // row id -> Set(cb)
  const ROW_IDS = ["atlas_settings", "atlas_mem", "atlas_hist", "atlas_sites", "jarvis_projects", "atlas_active", "atlas_debug", "status", "watcher", "settings", "pc"];
  async function loadRows() {
    const { data } = await sb.from("control").select("id,data").in("id", ROW_IDS);
    (data || []).forEach((r) => { rows[r.id] = r.data || {}; });
    renderAll();
  }
  function onRow(r) {
    if (!r || !r.id) return;
    rows[r.id] = r.data || {};
    (listeners.get(r.id) || []).forEach((cb) => { try { cb(rows[r.id]); } catch (e) {} });
    if (r.id === "atlas_sites" || r.id === "jarvis_projects") renderGallery();
    if (r.id === "atlas_mem" || r.id === "atlas_hist") renderMemory();
    if (r.id === "atlas_active") paintPill();
    if (["status", "watcher", "settings", "pc"].includes(r.id)) renderPc();
    if (r.id === "atlas_settings") renderSettings();
    if (r.id === "atlas_debug") renderSiri();
  }
  let lastEvent = 0;
  function subscribe() {
    sb.channel("atlas-app").on("postgres_changes", { event: "*", schema: "public", table: "control" }, (p) => {
      lastEvent = Date.now();
      if (p.new && (ROW_IDS.includes(p.new.id) || listeners.has(p.new.id))) onRow(p.new);
    }).subscribe((st) => { if (st === "SUBSCRIBED") loadRows(); });
  }
  function listen(id, cb) {
    if (!listeners.has(id)) listeners.set(id, new Set());
    listeners.get(id).add(cb);
    return () => { const s = listeners.get(id); if (s) { s.delete(cb); if (!s.size) listeners.delete(id); } };
  }
  /** Theater feed: realtime events, plus a quiet poll whenever they pause (network switches, sleeping sockets). */
  function feed(id, cb) {
    const key = "atlas_build-" + id;
    let lastAt = 0;
    const got = (d) => { lastAt = Date.now(); cb(d); };
    const off = listen(key, got);
    const pull = async () => {
      const { data } = await sb.from("control").select("data").eq("id", key).maybeSingle();
      if (data && data.data) { rows[key] = data.data; got(data.data); }
    };
    pull();
    const iv = setInterval(() => { if (Date.now() - lastAt > 2500) pull(); }, 1500);
    return () => { off(); clearInterval(iv); };
  }

  // ------------------------------------------------------------------ tabs
  let tab = "talk";
  function go(name) {
    tab = name;
    document.querySelectorAll(".view").forEach((v) => { v.hidden = v.dataset.view !== name; });
    document.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === name));
    if (name === "builds") renderGallery();
  }
  $("tabs").addEventListener("click", (e) => { const b = e.target.closest("button[data-tab]"); if (b) go(b.dataset.tab); });

  // ------------------------------------------------------------------ Talk
  let live = null, state = "idle", caps = [];
  function paintState() {
    const map = { idle: "sIdle", connecting: "sConnecting", listening: "sListening", thinking: "sThinking", speaking: "sSpeaking", error: "sError" };
    $("stateLabel").textContent = t(map[state] || "sIdle");
    $("stateLabel").classList.toggle("live", state !== "idle" && state !== "error");
    $("micBtn").classList.toggle("live", !!live);
    window.Orb && window.Orb.set(state === "connecting" ? "thinking" : state === "error" ? "idle" : state);
  }
  function setState(s) { state = s; paintState(); }
  function caption(who, text, final) {
    const last = caps[caps.length - 1];
    if (last && last.who === who && !last.final) { last.text = text; last.final = final; }
    else caps.push({ who, text, final });
    caps = caps.slice(-6);
    const box = $("captions"); box.replaceChildren();
    caps.forEach((c) => { const d = el("div", "cap " + c.who, c.text); d.dir = "auto"; box.append(d); });
    box.scrollTop = box.scrollHeight;
  }
  const recent = () => caps.filter((c) => c.final).slice(-8).map((c) => (c.who === "u" ? "User: " : "Atlas: ") + c.text);
  function renderQuick() {
    const box = $("quick"); if (!box) return; box.replaceChildren();
    ["q1", "q2", "q3", "q4", "q5"].forEach((k) => {
      const b = el("button", "chip", t(k)); b.type = "button";
      b.onclick = () => (k === "q1" ? (go("builds"), $("buildInput").focus()) : ask(t(k)));
      box.append(b);
    });
  }
  const settingsRow = () => rows.atlas_settings || {};
  function voiceLang() { const l = settingsRow().lang || "auto"; return l === "auto" ? ui : l; }
  $("micBtn").addEventListener("click", async () => {
    if (live) { live.stop(); live = null; setState("idle"); return; }
    live = new window.Live({
      api, lang: voiceLang(), voice: settingsRow().voice || "Charon", model: settingsRow().live_model || "", recent,
      audioSession: store.get("atlas-audiosession", "auto"),
      onState: (s) => { if (live || s === "idle") setState(s); },
      onCaption: caption,
      onLevel: (mic, out) => { if (mic != null) { window.Orb && window.Orb.mic(mic); $("micBtn").querySelector(".mic-ring").style.transform = `scale(${1 + Math.min(0.35, mic * 4)})`; } if (out != null) window.Orb && window.Orb.out(out); },
      onTool: runTool,
      onError: (e) => { console.warn("live", e); toast(t("liveFail"), 4000); live = null; setState("error"); setTimeout(() => state === "error" && setState("idle"), 3000); },
    });
    try {
      await live.start();
      if (camStream && live) live.setVision($("camVideo"));
    } catch (e) {
      console.warn(e);
      toast(/Permission|NotAllowed|denied/i.test(String(e && (e.name + e.message))) ? t("micDenied") : t("liveFail"), 4000);
      try { live && live.stop(); } catch (er) {}
      live = null; setState("idle");
    }
  });
  $("kbBtn").addEventListener("click", () => { $("typebar").hidden = !$("typebar").hidden; $("kbBtn").classList.toggle("on", !$("typebar").hidden); if (!$("typebar").hidden) $("typeInput").focus(); });
  $("typebar").addEventListener("submit", (e) => { e.preventDefault(); const v = $("typeInput").value.trim(); if (!v) return; $("typeInput").value = ""; ask(v); });

  /** A typed question: into the live session when one is open, else one cloud turn spoken by the browser voice. */
  async function ask(text) {
    if (live && live.sendText(text)) return;
    caption("u", text, true);
    setState("thinking");
    try {
      const r = await api({ op: "turn", text, mode: "app", tz: Intl.DateTimeFormat().resolvedOptions().timeZone, lang: voiceLang() });
      caption("a", r.say || "…", true);
      (r.do || []).forEach(doAct);
      if (r.build && r.build !== "none") watchBuild(r.build);
      speak(r.say, r.lang);
    } catch (e) { caption("a", String(e.message || e), true); setState("idle"); }
  }
  function speak(text, lang) {
    if (!text || !window.speechSynthesis) { setState("idle"); return; }
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text); u.lang = lang === "he" || /[֐-׿]/.test(text) ? "he-IL" : "en-GB"; u.rate = 1.05;
      u.onstart = () => setState("speaking"); u.onend = u.onerror = () => { if (!live) setState("idle"); };
      speechSynthesis.speak(u);
    } catch (e) { setState("idle"); }
  }

  // ---- tools a live session calls (the phone-side ones show a button: iOS only opens apps from a tap)
  function chip(label, href, cls) {
    const a = el(href ? "a" : "button", "chip " + (cls || ""), label);
    if (href) { a.href = href; if (/^https?:/.test(href)) { a.target = "_blank"; a.rel = "noopener"; } } else a.type = "button";
    const box = $("toolChips"); box.prepend(a);
    while (box.children.length > 4) box.lastChild.remove();
    return a;
  }
  const APPS = { whatsapp: "whatsapp://", spotify: "spotify://", youtube: "youtube://", waze: "waze://", instagram: "instagram://", maps: "maps://", telegram: "tg://", settings: "app-prefs:", camera: "camera://", netflix: "nflx://", wolt: "wolt://", gmail: "googlegmail://", chatgpt: "chatgpt://", aim: "https://harelzion.github.io/aim/", "וואטסאפ": "whatsapp://", "ספוטיפיי": "spotify://", "יוטיוב": "youtube://", "וייז": "waze://", "אינסטגרם": "instagram://" };
  async function runTool(name, args) {
    const cloud = { web_search: 1, weather: 1, news: 1, remember: 1, forget: 1, list_sites: 1, pc_status: 1, ask_claude: 1, open_site: 1, build_site: 1, edit_site: 1 };
    if (cloud[name]) {
      const busy = name === "web_search" || name === "build_site" ? chip((name === "web_search" ? "🔎 " : "✨ ") + (args.query || args.request || "").slice(0, 40)) : null;
      if (busy) busy.prepend(el("i", "spinner"));
      try {
        const r = await api({ op: "tool", name, args, lang: voiceLang(), lat: geo.lat, lon: geo.lon });
        if (busy) busy.remove();
        if (r.build) { watchBuild(r.build, true); }
        if (r.open) chip(t("tapToOpen") + (args.name || ""), r.open, "go");
        if (name === "remember" || name === "forget") loadRows();
        return { result: r.result || "done" };
      } catch (e) { if (busy) busy.remove(); return { error: String(e.message || e).slice(0, 120) }; }
    }
    switch (name) {
      case "open_app": {
        const k = String(args.name || "").toLowerCase().replace(/^the\s+|\s+app$/g, "");
        if (!APPS[k]) return { result: "That app is not on the list." };
        chip(t("tapToOpen") + args.name, APPS[k], "go");
        return { result: "A button to open it is on the screen; the user taps it." };
      }
      case "play_music":
        chip("🎵 " + args.query, "spotify:search:" + encodeURIComponent(args.query || ""), "go");
        return { result: "A Spotify button is on the screen." };
      case "navigate":
        chip("🧭 " + args.destination, "maps://?daddr=" + encodeURIComponent(args.destination || ""), "go");
        return { result: "A directions button is on the screen." };
      case "call":
        chip("📞 " + t("call") + args.who, "shortcuts://run-shortcut?name=" + encodeURIComponent("Atlas Do") + "&input=text&text=" + encodeURIComponent(JSON.stringify([{ a: "call", who: String(args.who || "") }])), "go");
        return { result: "A call button is on the screen; the user taps it to call." };
      case "whatsapp":
        chip("💬 " + t("wa") + (args.who ? " · " + args.who : ""), "whatsapp://send?text=" + encodeURIComponent(args.text || ""), "go");
        return { result: "The WhatsApp draft is one tap away on the screen." };
      case "set_timer":
        startTimer(Number(args.seconds) || 60, args.label || "");
        return { result: "The timer is running on screen." };
      case "end_conversation":
        return { result: "Goodbye.", end: true };
    }
    return { error: "unknown tool" };
  }
  function doAct(a) {
    if (!a) return;
    if (a.a === "open" && a.url) chip(t("tapToOpen") + (a.url.split(/[/:?]/)[0] || ""), a.url, "go");
    else if (a.a === "timer") startTimer(+a.s || 60, a.label && a.label !== "none" ? a.label : "");
    else if (["alarm", "reminder", "event", "note", "torch", "dnd", "volume", "brightness", "media", "call", "sms"].includes(a.a)) {
      chip("⚡ " + a.a, "shortcuts://run-shortcut?name=" + encodeURIComponent("Atlas Do") + "&input=text&text=" + encodeURIComponent(JSON.stringify([a])), "go");
    }
  }
  // ---- an on-screen timer (the cloud also hands timers to Siri; here the app keeps time itself)
  function startTimer(secs, label) {
    const end = Date.now() + secs * 1000;
    const c = chip("", null, "timer");
    const paint = () => {
      const left = Math.max(0, Math.round((end - Date.now()) / 1000));
      c.textContent = `⏱ ${label ? label + " · " : ""}`;
      const b = el("b", null, `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`); c.append(b);
      if (left <= 0) {
        clearInterval(iv); c.classList.add("go"); c.textContent = "⏰ " + t("timerDone");
        beep(); try { navigator.vibrate && navigator.vibrate([300, 150, 300, 150, 300]); } catch (e) {}
        try { if (Notification.permission === "granted") navigator.serviceWorker.ready.then((r) => r.showNotification("Atlas", { body: t("timerDone"), tag: "atlas-timer" })); } catch (e) {}
      }
    };
    const iv = setInterval(paint, 500); paint();
    c.onclick = () => { clearInterval(iv); c.remove(); };
  }
  function beep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.35, 0.7].forEach((d) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = 880; g.gain.setValueAtTime(0.0001, ctx.currentTime + d); g.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + d + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + d + 0.25); o.connect(g); g.connect(ctx.destination); o.start(ctx.currentTime + d); o.stop(ctx.currentTime + d + 0.3); });
      setTimeout(() => ctx.close(), 1500);
    } catch (e) {}
  }
  // ---- location for the weather (asked once, only when the user allows it)
  const geo = {};
  function askGeo() { try { navigator.geolocation.getCurrentPosition((p) => { geo.lat = p.coords.latitude; geo.lon = p.coords.longitude; }, () => {}, { maximumAge: 600000, timeout: 8000 }); } catch (e) {} }

  // ---- Vision: the camera feeds the live session one frame a second
  let camStream = null, facing = "environment";
  async function camOn() {
    try {
      camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1280 } }, audio: false });
      const v = $("camVideo"); v.srcObject = camStream; await v.play().catch(() => {});
      $("camCard").hidden = false; $("camBtn").classList.add("on");
      if (live) live.setVision(v);
    } catch (e) { toast(t("camDenied")); camOff(); }
  }
  function camOff() {
    try { camStream && camStream.getTracks().forEach((x) => x.stop()); } catch (e) {}
    camStream = null; $("camCard").hidden = true; $("camBtn").classList.remove("on");
    if (live) live.setVision(null);
  }
  $("camBtn").addEventListener("click", () => (camStream ? camOff() : camOn()));
  $("camFlip").addEventListener("click", () => { facing = facing === "environment" ? "user" : "environment"; camOff(); camOn(); });
  setInterval(() => { const v = $("camVideo"); if (camStream && v.paused) v.play().catch(() => {}); }, 1000);   // iOS pauses video when the mic starts

  // ------------------------------------------------------------------ builds
  function renderIdeas() {
    const box = $("ideas"); if (!box) return; box.replaceChildren();
    ["idea1", "idea2", "idea3", "idea4"].forEach((k) => { const b = el("button", "chip", t(k)); b.type = "button"; b.onclick = () => { $("buildInput").value = t(k); $("buildInput").focus(); }; box.append(b); });
  }
  $("buildForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const prompt = $("buildInput").value.trim();
    if (!prompt) { $("buildInput").focus(); return; }
    $("buildGo").disabled = true;
    try {
      const r = await api({ op: "build", prompt });
      $("buildInput").value = "";
      watchBuild(r.id, true);
    } catch (err) { toast(String(err.message || err)); }
    $("buildGo").disabled = false;
  });
  function watchBuild(id, openNow) {
    rows.atlas_active = { id, state: "queued", started: Date.now() };
    paintPill();
    if (openNow || !live) openTheater(id);
  }
  function openTheater(id) {
    window.Theater.open(id, {
      feed, t, toast,
      onState: (s) => { if (s.state === "revealed" || s.state === "live") loadRows(); paintPill(); },
      onEdit: (site) => openSheet(site, true),
      onMinimize: paintPill, onClose: paintPill,
    });
  }
  function paintPill() {
    const a = rows.atlas_active || {}, pill = $("buildPill");
    const fresh = a.started && Date.now() - a.started < 10 * 60000;
    const running = fresh && !["live", "error"].includes(a.state);
    const justDone = a.state === "live" && a.started && Date.now() - a.started < 5 * 60000;
    const theaterUp = !$("theater").hidden;
    pill.hidden = theaterUp || !(running || justDone);
    pill.classList.toggle("done", !running);
    $("buildPillText").textContent = running ? `${t("building")} ${a.title || "…"} · ${t("tapWatch")}` : `${t("built")}${a.title || ""}`;
    pill.onclick = () => {
      if (window.Theater.id === a.id) window.Theater.show(); else if (running) openTheater(a.id); else if (a.url) openSheet({ slug: a.slug, title: a.title, url: a.url });
      pill.hidden = true;
    };
  }
  setInterval(paintPill, 15000);

  function ago(ms) {
    const m = Math.round(ms / 60000), h = Math.round(ms / 3600000), d = Math.round(ms / 86400000);
    return m < 2 ? t("justNow") : m < 60 ? t("minAgo").replace("%d", m) : h < 24 ? t("hoursAgo").replace("%d", h) : d === 1 ? t("yesterday") : t("daysAgo").replace("%d", d);
  }
  function allSites() {
    const own = (rows.atlas_sites && rows.atlas_sites.list) || [];
    const jv = ((rows.jarvis_projects && rows.jarvis_projects.sites) || []).filter((j) => !own.some((s) => s.slug === j.slug))
      .map((j) => ({ slug: j.slug, title: j.title || j.slug, url: j.url || `https://harelzion.github.io/aim/sites/${j.slug}/`, updated: (j.when || 0) * 1000, builder: "jarvis" }));
    return [...own, ...jv];
  }
  let thumbIO = null;
  function renderGallery() {
    const box = $("gallery"); if (!box || tab !== "builds" && box.childElementCount) return;
    const list = allSites();
    $("siteCount").textContent = list.length ? `${list.length} ${t("sites")}` : "";
    box.replaceChildren();
    if (!list.length) { box.append(el("div", "empty", t("noSites"))); return; }
    if (thumbIO) thumbIO.disconnect();
    thumbIO = new IntersectionObserver((ents) => ents.forEach((en) => {
      if (!en.isIntersecting) return;
      const th = en.target; thumbIO.unobserve(th);
      const f = document.createElement("iframe"); f.tabIndex = -1; f.setAttribute("aria-hidden", "true"); f.setAttribute("scrolling", "no"); f.src = th.dataset.src;
      f.onload = () => { setTimeout(() => { f.classList.add("ready"); const g = th.querySelector(".glyph"); if (g) g.remove(); }, 400); };
      th.prepend(f);
    }), { rootMargin: "200px" });
    list.forEach((s, i) => {
      const card = el("button", "site"); card.type = "button";
      const th = el("div", "thumb"); th.dataset.src = s.url;
      const p = s.palette || [];
      if (p.length >= 4) th.style.setProperty("--g", `linear-gradient(140deg, ${p[0]}, ${p[3]} 70%, ${p[4] || p[1]})`);
      th.append(el("div", "glyph", (s.title || "?").trim().slice(0, 1).toUpperCase()));
      const badges = el("div", "badges");
      if (Date.now() - (s.updated || 0) < 86400000) badges.append(el("span", "badge new", t("newBadge")));
      if (s.version > 1) badges.append(el("span", "badge", "v" + s.version));
      if (s.builder === "jarvis") badges.append(el("span", "badge", t("jarvis")));
      const meta = el("div", "meta"); const b = el("b", null, s.title); b.dir = "auto"; meta.append(b, el("small", null, ago(Date.now() - (s.updated || s.created || 0))));
      card.append(badges, th, meta);
      card.onclick = () => openSheet(s);
      box.append(card);
      if (i < 24) thumbIO.observe(th);
    });
    scaleThumbs();
  }
  function scaleThumbs() { const c = document.querySelector(".site .thumb"); if (c) $("gallery").style.setProperty("--s", (c.clientWidth / 390).toFixed(3)); }
  new ResizeObserver(scaleThumbs).observe($("gallery"));

  // ---- the site sheet
  let sheetSite = null;
  function openSheet(s, focusEdit) {
    sheetSite = s;
    $("shTitle").textContent = s.title; $("shTitle").dir = "auto";
    $("shMeta").textContent = [s.version > 1 ? "v" + s.version : "", s.updated ? ago(Date.now() - s.updated) : "", s.prompt || ""].filter(Boolean).join(" · ");
    $("shFrame").src = s.url; $("shOpen").href = s.url;
    $("sheet").hidden = false;
    if (focusEdit) setTimeout(() => $("shEdit").focus(), 300);
  }
  function closeSheet() { $("sheet").hidden = true; $("shFrame").removeAttribute("src"); }
  $("shClose").onclick = closeSheet;
  $("sheet").addEventListener("click", (e) => { if (e.target === $("sheet")) closeSheet(); });
  $("shShare").onclick = async () => { const s = sheetSite; try { if (navigator.share) await navigator.share({ title: s.title, url: s.url }); else { await navigator.clipboard.writeText(s.url); toast(t("copied")); } } catch (e) {} };
  $("shReplay").onclick = () => { const s = sheetSite; closeSheet(); window.Theater.replay({ ...s, t, toast, onEdit: (x) => openSheet(x, true) }); };
  $("shEditForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const instruction = $("shEdit").value.trim(); if (!instruction || !sheetSite) return;
    try {
      const r = await api({ op: "build", base: sheetSite.slug, instruction, prompt: instruction });
      $("shEdit").value = ""; closeSheet(); watchBuild(r.id, true);
    } catch (err) { toast(String(err.message || err)); }
  });

  // ------------------------------------------------------------------ memory
  async function saveRow(id, data) {
    rows[id] = data;
    const { error } = await sb.from("control").upsert({ id, data, updated_at: new Date().toISOString() });
    if (error) toast(error.message);
  }
  function memRow() { const m = rows.atlas_mem || {}; return { facts: (m.facts || []).map((f) => (typeof f === "string" ? f : f.t)).filter(Boolean), places: m.places || {}, prefs: m.prefs || {} }; }
  function renderMemory() {
    const facts = $("facts"); if (!facts) return;
    const m = memRow();
    facts.replaceChildren();
    if (!m.facts.length) facts.append(el("li", "muted", t("noFacts")));
    m.facts.slice().reverse().forEach((f) => {
      const li = el("li"); const s = el("span", null, f); s.dir = "auto";
      const x = el("button", "icon-btn small"); x.type = "button"; x.setAttribute("aria-label", t("deleteFact"));
      x.innerHTML = '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
      x.onclick = () => { const mm = memRow(); mm.facts = mm.facts.filter((y) => y !== f); saveRow("atlas_mem", mm).then(renderMemory); };
      li.append(s, x); facts.append(li);
    });
    const pl = $("places"); pl.replaceChildren();
    const keys = Object.keys(m.places);
    if (!keys.length) pl.append(el("li", "muted", t("noPlaces")));
    keys.forEach((k) => { const p = m.places[k]; const li = el("li"); const a = el("a", null, k + (p.street ? " · " + p.street : "")); a.href = `https://maps.apple.com/?ll=${p.lat},${p.lon}&q=${encodeURIComponent(k)}`; a.target = "_blank"; a.style.color = "inherit"; li.append(a); pl.append(li); });
    const h = rows.atlas_hist || {}, hl = $("hist"); hl.replaceChildren();
    const msgs = Date.now() - (h.at || 0) < 20 * 60000 ? h.msgs || [] : [];
    if (!msgs.length) hl.append(el("li", "muted", t("noHist")));
    msgs.forEach((x) => { const li = el("li", x.r === "u" ? "u" : "a", x.t); li.dir = "auto"; hl.append(li); });
  }
  $("addFact").onclick = () => { const v = (window.prompt(t("addFactQ")) || "").trim(); if (!v) return; const m = memRow(); m.facts = [...m.facts.filter((f) => f.toLowerCase() !== v.toLowerCase()), v].slice(-60); saveRow("atlas_mem", m).then(renderMemory); };
  $("clearHist").onclick = () => saveRow("atlas_hist", { at: 0, msgs: [] }).then(renderMemory);

  // ------------------------------------------------------------------ settings
  const VOICES = [["Charon", "deep", "עמוק"], ["Puck", "bright", "שמח"], ["Kore", "firm", "יציב"], ["Fenrir", "warm", "חם"], ["Aoede", "breezy", "קליל"], ["Orus", "calm", "רגוע"], ["Leda", "youthful", "צעיר"], ["Zephyr", "light", "אוורירי"]];
  function seg(box, options, value, onPick) {
    box.replaceChildren();
    options.forEach(([v, label]) => { const b = el("button", null, label); b.type = "button"; b.setAttribute("aria-pressed", String(v === value)); b.onclick = () => onPick(v); box.append(b); });
  }
  function setCloud(patch) { saveRow("atlas_settings", { ...settingsRow(), ...patch }).then(renderSettings); }
  let sampleCtx = null;
  async function playSample(voice) {
    try {
      const text = voiceLang() === "he" ? "היי, אני Atlas. מה נבנה היום?" : "Hi, I'm Atlas. What shall we build today?";
      const r = await api({ op: "tts", text, voice });
      if (!r.audio) return;
      sampleCtx = sampleCtx || new (window.AudioContext || window.webkitAudioContext)();
      const bin = atob(r.audio), n = bin.length >> 1, buf = sampleCtx.createBuffer(1, n, +((r.mime || "").match(/rate=(\d+)/) || [0, 24000])[1]);
      const ch = buf.getChannelData(0);
      for (let i = 0; i < n; i++) { let v = (bin.charCodeAt(2 * i + 1) << 8) | bin.charCodeAt(2 * i); if (v >= 32768) v -= 65536; ch[i] = v / 32768; }
      const src = sampleCtx.createBufferSource(); src.buffer = buf; src.connect(sampleCtx.destination); src.start();
    } catch (e) { toast(String(e.message || e)); }
  }
  function renderSettings() {
    const vbox = $("voices"); if (!vbox) return;
    const s = settingsRow();
    vbox.replaceChildren();
    VOICES.forEach(([v, d, dh]) => {
      const b = el("button"); b.type = "button"; b.setAttribute("aria-pressed", String((s.voice || "Charon") === v));
      b.append(el("span", null, v), el("small", null, ui === "he" ? dh : d));
      b.onclick = () => { if (sampleCtx) sampleCtx.resume(); setCloud({ voice: v }); playSample(v); };
      vbox.append(b);
    });
    seg($("segLang"), [["auto", t("auto")], ["he", "עברית"], ["en", "English"]], s.lang || "auto", (v) => setCloud({ lang: v }));
    seg($("segAddr"), [["m", t("male")], ["f", t("female")], ["plural", t("plural")]], s.address || "plural", (v) => setCloud({ address: v }));
    seg($("segModel"), [["", t("auto")], ["gemini-3.8-live", "3.8"], ["gemini-3.1-flash-live-preview", t("fast")]], s.live_model || "", (v) => setCloud({ live_model: v }));
    seg($("segTheme"), [["auto", t("auto")], ["dark", t("dark")], ["light", t("light")]], store.get("atlas-theme", "auto"), (v) => { store.set("atlas-theme", v); applyTheme(); renderSettings(); });
    seg($("segUi"), [["he", "עברית"], ["en", "English"]], ui, (v) => { ui = v; store.set("atlas-ui", v); applyLang(); });
    renderSiri(); renderAbout();
  }
  function renderSiri() {
    const log = ((rows.atlas_debug || {}).log || []).filter((x) => x.via === "device");
    const last = log[log.length - 1];
    if ($("siriInfo")) $("siriInfo").textContent = last ? t("siriLast") + ago(Date.now() - Date.parse(last.at)) + (last.text ? ` — "${last.text}"` : "") : t("siriNever");
  }
  function renderPc() {
    const st = rows.status || {}, w = rows.watcher || {}, s = rows.settings || {};
    const fresh = (iso, ms) => iso && Date.now() - Date.parse(iso) < ms;
    const on = s.mode !== "off" && (fresh(w.at, 90000) || fresh(st.updatedAt, 120000));
    if ($("pcPill")) $("pcPill").hidden = !on;
    if ($("pcInfo")) $("pcInfo").textContent = on ? t("pcOn") + (st.state === "working" ? t("pcWork") + (st.activity || "") : t("pcIdle")) : t("pcOff");
  }
  let health = null;
  async function renderAbout() {
    if (!$("aboutInfo")) return;
    $("aboutInfo").textContent = t("version") + APP_VERSION + " · " + FN + (health ? " · " + t("health") + (health.ok ? t("healthy") + " (" + health.version + ")" : t("down")) : "");
  }
  async function checkHealth() { try { health = await (await fetch(API + "?health=1")).json(); } catch (e) { health = { ok: false }; } renderAbout(); }
  $("signOut").onclick = async () => { await sb.auth.signOut(); location.reload(); };
  let installEvt = null;
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installEvt = e; $("installBtn").hidden = false; });
  $("installBtn").onclick = async () => { if (!installEvt) return; installEvt.prompt(); installEvt = null; $("installBtn").hidden = true; };

  // ------------------------------------------------------------------ boot
  function renderAll() { renderGallery(); renderMemory(); renderSettings(); renderPc(); paintPill(); }
  function net() { $("netPill").hidden = navigator.onLine; }
  window.addEventListener("online", () => { net(); loadRows(); }); window.addEventListener("offline", net);
  document.addEventListener("visibilitychange", () => { if (!document.hidden && started) loadRows(); });
  async function boot() {
    applyLang();
    await loadRows();
    subscribe();
    checkHealth(); net(); askGeo();
    const q = new URLSearchParams(location.search), h = new URLSearchParams(location.hash.slice(1));
    const bid = q.get("build") || h.get("build");
    if (bid) openTheater(bid);
    const shared = [q.get("title"), q.get("text"), q.get("url")].filter(Boolean).join(" ");
    if (shared) { go("builds"); $("buildInput").value = shared; }
    if (q.get("tab")) go(q.get("tab"));
    if (q.get("src") || shared || bid) history.replaceState(null, "", location.pathname);
  }
  applyLang();
  sb.auth.getSession().then(({ data }) => show(!!(data && data.session)));
  if ("serviceWorker" in navigator && !/localhost|127\.0\.0\.1/.test(location.hostname)) navigator.serviceWorker.register("sw.js").catch(() => {});
  window.AtlasApp = { api, rows, go, openTheater };
})();
