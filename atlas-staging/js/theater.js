/* Code Theater (PLAN 8.4): the build's real code, typed out as it streams from the cloud.
   Never fake text, only timing: `received` = everything the builder wrote so far (row atlas_build-<id>),
   `shown` = typed so far. Speed = 220 + 0.9 x backlog chars/s (cap 2400), so the screen lags at most ~3 s; once the
   builder is done the rest is typed within 4 s. Then "going live" (polls the page until its atlas-build meta matches),
   and the reveal: the site in a phone frame with Open / Share / Edit / Replay.
   window.Theater.open(id, {feed, t, onEdit, onState}) — feed(id, cb) subscribes to the row and returns an unsubscribe. */
(function () {
  const $ = (id) => document.getElementById(id);
  const root = $("theater");
  if (!root) return;
  const STEPS = ["brief", "style", "html", "motion", "check", "publish", "live"];
  const LABEL = { brief: "Brief", style: "Style", html: "HTML", motion: "Motion", check: "Check", publish: "Publish", live: "Live" };
  let S = null;   // the current show

  function reset() {
    $("thCode").replaceChildren(); $("thLog").replaceChildren(); $("thDone").hidden = true;
    $("thFrame").removeAttribute("srcdoc"); $("thLive").removeAttribute("src");
    root.classList.remove("ended", "failed");
  }
  function steps(now, doneUpTo) {
    const box = $("thSteps"); box.replaceChildren();
    const ni = STEPS.indexOf(now);
    STEPS.forEach((s, i) => {
      const el = document.createElement("span"); el.textContent = LABEL[s];
      if (s === now) el.className = s === "live" ? "done" : "now";
      else if (i < Math.max(ni, doneUpTo)) el.className = "done";
      box.append(el);
    });
  }
  function logLine(text) {
    const box = $("thLog");
    const d = document.createElement("div"); d.textContent = text;
    box.append(d);
    while (box.children.length > 3) box.firstChild.remove();
  }
  const fmt = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0"); };

  function mkLine(n, html) {
    const d = document.createElement("div"); d.className = "ln";
    const i = document.createElement("i"); i.textContent = n;
    const s = document.createElement("span"); s.innerHTML = html;
    d.append(i, s); return d;
  }

  function start(opts) {
    if (S) stop();
    reset();
    S = {
      opts, id: opts.id || "", received: "", shown: 0, lineStart: 0, lineNo: 1, hl: window.Highlight.state(),
      row: {}, ended: false, endAt: 0, follow: true, last: performance.now(), raf: 0, cur: null, preview: 0,
      logSeen: 0, rate: opts.rate || 0, startedAt: Date.now(), live: false,
    };
    $("thTitle").textContent = opts.title || "…";
    steps(opts.replay ? "html" : "brief", 0);
    root.hidden = false;
    S.cur = mkLine(1, ""); $("thCode").append(S.cur);
    S.raf = requestAnimationFrame(tick);
    S.clock = setInterval(() => {
      const st = S.row.started || S.startedAt, end = S.row.ended;
      $("thTime").textContent = fmt((end || Date.now()) - st);
    }, 250);
  }
  function stop() {
    if (!S) return;
    cancelAnimationFrame(S.raf); clearInterval(S.clock); clearInterval(S.poll);
    if (S.unsub) try { S.unsub(); } catch (e) {}
    S = null;
  }

  // ---- the typing loop
  function tick(now) {
    if (!S) return;
    const dt = Math.min(0.1, (now - S.last) / 1000); S.last = now;
    const backlog = S.received.length - S.shown;
    if (backlog > 0) {
      let rate = S.rate || Math.min(2400, 220 + 0.9 * backlog);
      if (S.ended) { const left = Math.max(0.25, 4 - (now - S.endAt) / 1000); rate = Math.max(rate, backlog / left); }
      const n = Math.max(1, Math.round(rate * dt));
      advance(Math.min(S.received.length, S.shown + n));
    } else if (S.ended && !S.live && S.received.length) {
      finishTyping();
    }
    S.raf = requestAnimationFrame(tick);
  }
  function advance(to) {
    const code = $("thCode");
    const text = S.received;
    let nl = text.indexOf("\n", S.lineStart);
    while (nl >= 0 && nl < to) {   // finished lines are coloured once and stay
      const line = text.slice(S.lineStart, nl);
      S.cur.lastChild.innerHTML = window.Highlight.line(line, S.hl, false);
      S.lineNo++; S.lineStart = nl + 1;
      S.cur = mkLine(S.lineNo, ""); code.append(S.cur);
      nl = text.indexOf("\n", S.lineStart);
    }
    S.shown = to;
    const partial = text.slice(S.lineStart, to);
    S.cur.lastChild.innerHTML = window.Highlight.line(partial, S.hl, true) + '<span class="caret"></span>';
    if (S.follow) code.scrollTop = code.scrollHeight;
    // the step the *typing* is in (the stream itself runs ahead)
    {
      const typed = text.slice(0, to);
      const st = typed.lastIndexOf("<style"), stE = typed.lastIndexOf("</style"), sc = typed.lastIndexOf("<script"), scE = typed.lastIndexOf("</script");
      const step = sc > scE ? "motion" : st > stE ? "style" : /<body/i.test(typed) ? "html" : "style";
      if (step !== S.step && (!S.ended || S.opts.replay)) { S.step = step; steps(step, 1); }
    }
    const kb = (to / 1024).toFixed(1);
    $("thStats").textContent = `${S.lineNo} lines · ${kb} KB${S.row.model ? " · " + S.row.model.replace("gemini-", "") : ""}`;
    if (Date.now() - S.preview > 1500 && (!$("thPreview").hidden || matchMedia("(min-width: 900px)").matches) && /<body/i.test(text.slice(0, to))) {
      S.preview = Date.now();
      $("thFrame").srcdoc = text.slice(0, to);
    }
  }
  function finishTyping() {
    S.live = true;
    S.cur.lastChild.innerHTML = window.Highlight.line(S.received.slice(S.lineStart), S.hl, true);
    if (S.opts.replay) { root.classList.add("ended"); steps("live", 7); reveal(S.opts.url); return; }
    if (S.row.state === "error") return;
    steps(S.row.state === "live" ? "publish" : S.row.state, 5);
    goLive();
  }

  // ---- after the commit: wait for GitHub Pages to serve this exact build, then the reveal
  function goLive() {
    const t = S.opts.t || ((k) => k);
    if (S.row.state !== "live") return;   // still checking / publishing: onRow() calls again
    logLine(t("goingLive"));
    const url = S.row.url, id = S.id, t0 = Date.now();
    let warned = false;
    const check = async () => {
      if (!S || S.id !== id) return;
      try {
        const r = await fetch(url + "?atlas=" + Date.now(), { cache: "no-store" });
        const html = r.ok ? await r.text() : "";
        if (html.includes(id)) { clearInterval(S.poll); root.classList.add("ended"); steps("live", 7); reveal(url); return; }
      } catch (e) {}
      if (!warned && Date.now() - t0 > 75000) { warned = true; logLine(t("pagesSlow")); reveal(url, true); }
      if (Date.now() - t0 > 240000) clearInterval(S.poll);
    };
    S.poll = setInterval(check, 3000); check();
  }
  function reveal(url, early) {
    const t = S.opts.t || ((k) => k);
    if (!early) { try { navigator.vibrate && navigator.vibrate([30, 40, 60]); } catch (e) {} }
    $("thLive").src = url + (early ? "" : "?v=" + Date.now());
    $("thOpen").href = url;
    $("thDone").hidden = false;
    $("thShare").onclick = async () => {
      try { if (navigator.share) await navigator.share({ title: $("thTitle").textContent, url }); else { await navigator.clipboard.writeText(url); S.opts.toast && S.opts.toast(t("copied")); } } catch (e) {}
    };
    const slug = S.row.slug || S.opts.slug, title = $("thTitle").textContent;
    $("thEdit").onclick = () => { const o = S_opts; close(); if (o.onEdit) o.onEdit({ slug, title, url }); };
    $("thReplay").onclick = () => replay({ url, title, slug, t: S_opts.t, onEdit: S_opts.onEdit, toast: S_opts.toast });
    if (S.opts.onState) S.opts.onState({ id: S.id, state: "revealed", url, title });
  }
  let S_opts = {};

  // ---- rows from the cloud
  function onRow(row) {
    if (!S || !row) return;
    const t = S.opts.t || ((k) => k);
    const prevState = S.row.state;
    S.row = row;
    if (row.title) $("thTitle").textContent = row.title;
    if (typeof row.code === "string" && row.code.length >= S.received.length - 50) S.received = row.code;
    const log = row.log || [];
    for (const l of log.slice(Math.max(S.logSeen, log.length - 3))) logLine(l.s);
    S.logSeen = log.length;
    if (row.state === "brief" || row.state === "queued") steps("brief", 0);
    if (["check", "publish", "live", "error"].includes(row.state) && !S.ended) { S.ended = true; S.endAt = performance.now(); }
    if (row.state === "error") {
      root.classList.add("failed", "ended");
      logLine(t("buildFailed") + (row.error ? ": " + row.error : ""));
      if (!S.received) S.live = true;
    }
    if (row.state === "live" && prevState !== "live" && S.live) goLive();
    if (S.opts.onState) S.opts.onState({ id: S.id, state: row.state, title: row.title, url: row.url, started: row.started });
  }

  // ---- public
  function open(id, opts) {
    S_opts = opts || {};
    start({ ...S_opts, id });
    S.unsub = S_opts.feed(id, onRow);
  }
  async function replay(site) {
    S_opts = site;
    start({ ...site, replay: true, rate: 1400, title: site.title, url: site.url });
    S.row = { started: Date.now(), model: "" };
    logLine((site.t || ((k) => k))("replaying"));
    try {
      const html = await (await fetch(site.url + "?v=" + Date.now(), { cache: "no-store" })).text();
      if (!S) return;
      S.received = html; S.ended = true; S.endAt = performance.now() + 60000;   // replay keeps its own steady pace
    } catch (e) { logLine("…"); }
  }
  function close() { stop(); root.hidden = true; reset(); }
  function minimize() { root.hidden = true; }
  function show() { if (S) root.hidden = false; }

  $("thClose").onclick = () => { const o = S_opts; close(); o.onClose && o.onClose(); };
  $("thMin").onclick = () => { minimize(); S_opts.onMinimize && S_opts.onMinimize(); };
  root.querySelectorAll(".th-tabs [data-pane]").forEach((b) => b.addEventListener("click", () => {
    root.querySelectorAll(".th-tabs [data-pane]").forEach((x) => x.classList.toggle("on", x === b));
    const prev = b.dataset.pane === "preview";
    $("thPreview").hidden = !prev; $("thCode").hidden = prev;
    if (prev && S) { S.preview = 0; $("thFrame").srcdoc = S.received.slice(0, S.shown); }
  }));
  $("thCode").addEventListener("scroll", () => {
    if (!S) return;
    const el = $("thCode");
    S.follow = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }, { passive: true });

  window.Theater = { open, replay, close, minimize, show, get id() { return S && S.id; }, get open_() { return !!S; } };
})();
