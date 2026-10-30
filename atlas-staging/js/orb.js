/* The orb (PLAN 9.3): three layered aurora gradients on a canvas, 60 fps, a few ms a frame.
   idle = slow breathing, listening = follows the mic level, thinking = faster spin + shimmer ring,
   speaking = pulses with Atlas's voice. Reduced motion = a static glow. */
(function () {
  const canvas = document.getElementById("orb");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let w = 0, h = 0, dpr = 1, raf = 0, t0 = performance.now();
  const S = { state: "idle", mic: 0, out: 0, lvl: 0, spin: 0, think: 0 };
  const COLORS = [[124, 92, 255], [46, 197, 255], [61, 255, 181]];

  function size() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const r = canvas.getBoundingClientRect();
    w = Math.max(1, Math.round(r.width * dpr)); h = Math.max(1, Math.round(r.height * dpr));
    canvas.width = w; canvas.height = h;
  }
  function blob(cx, cy, r, c, a) {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${a})`);
    g.addColorStop(0.55, `rgba(${c[0]},${c[1]},${c[2]},${a * 0.35})`);
    g.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  }
  function frame(now) {
    const t = (now - t0) / 1000;
    const target = S.state === "listening" ? Math.min(1, S.mic * 6) : S.state === "speaking" ? Math.min(1, S.out * 5) : 0;
    S.lvl += (target - S.lvl) * 0.25;
    S.think += ((S.state === "thinking" ? 1 : 0) - S.think) * 0.06;
    S.spin += (0.25 + S.think * 1.6 + S.lvl * 0.8) / 60;
    const cx = w / 2, cy = h / 2, base = Math.min(w, h) * 0.30;
    const breathe = S.state === "idle" ? Math.sin(t * 1.4) * 0.03 : 0;
    const R = base * (1 + breathe + S.lvl * 0.22);
    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 3; i++) {
      const a = S.spin + i * 2.094;
      const off = R * (0.22 + 0.1 * Math.sin(t * 0.7 + i));
      blob(cx + Math.cos(a) * off, cy + Math.sin(a) * off, R * (1.05 + 0.08 * Math.sin(t + i * 1.7)), COLORS[i], 0.62);
    }
    blob(cx, cy, R * 0.7, [255, 255, 255], 0.10 + S.lvl * 0.18);
    ctx.globalCompositeOperation = "source-over";
    if (S.think > 0.02) {   // the thinking shimmer ring
      ctx.save();
      ctx.translate(cx, cy); ctx.rotate(S.spin * 2.2);
      const g = ctx.createConicGradient ? ctx.createConicGradient(0, 0, 0) : null;
      if (g) { g.addColorStop(0, "rgba(61,255,181,0)"); g.addColorStop(0.7, "rgba(46,197,255,.0)"); g.addColorStop(0.95, `rgba(61,255,181,${0.9 * S.think})`); g.addColorStop(1, "rgba(61,255,181,0)"); ctx.strokeStyle = g; }
      else ctx.strokeStyle = `rgba(61,255,181,${0.5 * S.think})`;
      ctx.lineWidth = 3 * dpr; ctx.beginPath(); ctx.arc(0, 0, R * 1.32, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    raf = requestAnimationFrame(frame);
  }
  function start() { cancelAnimationFrame(raf); if (reduce) { S.lvl = 0; frame(performance.now()); cancelAnimationFrame(raf); } else raf = requestAnimationFrame(frame); }
  size(); start();
  new ResizeObserver(() => { size(); if (reduce) start(); }).observe(canvas);
  document.addEventListener("visibilitychange", () => { if (document.hidden) cancelAnimationFrame(raf); else start(); });
  window.Orb = {
    set(state) { S.state = state; },
    mic(v) { S.mic = v; },
    out(v) { S.out = v; },
  };
})();
