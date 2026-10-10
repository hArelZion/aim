/* Skins and reactors, shared by the HUD, the build bay and the skins page (/static/reactors.js).

   Skin.apply(skin)            sets the skin's CSS tokens on <html>, loads its fonts, returns its palette
   Skin.palette(skin)          {c, a, c2, core, ink, bg, g, light, mono} (colours as "r,g,b")
   makeReactor(kind)           -> {draw(g, R, T, L, P, k), ring}: one instance per canvas (it keeps its own state)
                               g: 2D context with the origin at the centre · R: radius · T: animation time
                               L: voice level 0..1.2 · P: palette · k: {state, building, now, dt, src}

   Cheap by rule (the PC runs near 90%): no shadowBlur, no filters, shapes batched into a few paths per frame.
*/
const TAU = Math.PI * 2;
const col = (rgb, a) => "rgba(" + rgb + "," + Math.max(0, Math.min(1, a)).toFixed(3) + ")";
const hexRgb = h => { h = (h || "#ffffff").trim().replace("#", ""); if (h.length === 3) h = h.replace(/./g, "$&$&");
  const v = parseInt(h, 16); return (v >> 16) + "," + ((v >> 8) & 255) + "," + (v & 255); };
const noise = (i, t) => (Math.sin(i * 1.7 + t * 9.1) + Math.sin(i * .63 + t * 13.7) * .6 + Math.sin(i * 3.1 + t * 5.3) * .4) / 2;

const Skin = {
  fontsLoaded: new Set(),
  loadFonts(skin) {
    const q = skin.fonts_css;
    if (!q || this.fontsLoaded.has(q)) return;
    this.fontsLoaded.add(q);
    const l = document.createElement("link");
    l.rel = "stylesheet"; l.href = "https://fonts.googleapis.com/css2?" + q + "&display=swap";
    document.head.appendChild(l);
  },
  palette(skin) {
    const t = skin.tokens || {};
    const mono = ((t["--mono"] || "monospace").split(",")[0] || "monospace").replace(/["']/g, "").trim();
    return { c: t["--c"] || "63,208,255", a: t["--a"] || "255,181,71", g: t["--g"] || "62,240,168",
      c2: t["--c2"] || hexRgb(t["--c-hi"]), core: skin.core || "255,255,255", ink: t["--ink"] || "255,255,255",
      bg: t["--bg"] || "#01050d", light: !!skin.light, mono: '"' + mono + '"' };
  },
  apply(skin, opts) {
    opts = opts || {};
    const root = (opts.root || document.documentElement).style;
    const tokens = Object.assign({}, skin.tokens, opts.overrides || {});
    for (const [k, v] of Object.entries(tokens)) root.setProperty(k, v);
    this.loadFonts(skin);
    document.body && document.body.classList.toggle("light", !!skin.light && !opts.accentsOnly);
    return this.palette(Object.assign({}, skin, { tokens }));
  },
};

function arc(g, r, a0, a1, w, color, halo) {
  g.beginPath(); g.arc(0, 0, r, a0, a1);
  if (halo) { g.lineWidth = w * 3.2; g.strokeStyle = color.replace(/[\d.]+\)$/, ".13)"); g.stroke(); }   // a cheap halo
  g.lineWidth = w; g.strokeStyle = color; g.stroke();
}
function glow(g, r, stops) {   // a radial light: stops = [[offset, "r,g,b", alpha], ...]
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, r);
  for (const [o, c, a] of stops) gr.addColorStop(o, col(c, a));
  g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fillStyle = gr; g.fill();
}
function rrect(g, a, r0, len, hw) {   // a rotated bar from radius r0 outwards, added to the current path
  const c = Math.cos(a), s = Math.sin(a), P = (d, w) => [d * c - w * s, d * s + w * c];
  g.moveTo(...P(r0, -hw)); g.lineTo(...P(r0 + len, -hw)); g.lineTo(...P(r0 + len, hw)); g.lineTo(...P(r0, hw)); g.closePath();
}

const REACTORS = {
  /* Mark VII: the arc-reactor rings */
  rings() {
    const parts = Array.from({ length: 70 }, () => ({ a: Math.random() * TAU, r: .35 + Math.random() * .65,
      s: (Math.random() * .5 + .2) * (Math.random() < .5 ? -1 : 1), z: Math.random() }));
    const vs = new Float32Array(120);
    return { ring: .80, draw(g, R, T, L, P, k) {
      const C = P.c, idle = k.state === "idle" && !k.building;
      for (const long of [false, true]) {   // degree ring
        g.beginPath();
        for (let i = long ? 0 : 1; i < 120; i += long ? 10 : 1) {
          if (!long && i % 10 === 0) continue;
          const a = i / 120 * TAU + T * .02, r0 = R * (long ? .94 : .965);
          g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); g.lineTo(Math.cos(a) * R, Math.sin(a) * R);
        }
        g.strokeStyle = col(C, long ? .75 : .3); g.lineWidth = long ? 1.6 : 1; g.stroke();
      }
      arc(g, R * .915, 0, TAU, 1, col(C, .25));
      g.save(); g.rotate(T * .18); g.setLineDash([R * .06, R * .025]); arc(g, R * .86, 0, TAU, 2.2, col(C, .55), 1); g.setLineDash([]); g.restore();
      g.save(); g.rotate(-T * .45);
      for (let j = 0; j < 3; j++) arc(g, R * .74, j * 2.094, j * 2.094 + 1.15, 5, col(k.building && j === 0 ? P.a : C, .85), 1);
      g.restore();
      g.save(); g.rotate(T * .3); for (let j = 0; j < 6; j++) arc(g, R * .69, j * 1.047, j * 1.047 + .32, 1.6, col(C, .6), 1); g.restore();
      const n = 30, chase = (T * (k.state === "think" ? 9 : 3)) % n, dim = idle ? .7 : 1;
      const lit = i => { const d = Math.min(Math.abs(i - chase), n - Math.abs(i - chase)); return Math.max(.18, 1 - d / 5); };
      for (let b = 0; b < 5; b++) {   // coil segments with a chasing light
        g.beginPath(); let any = false;
        for (let i = 0; i < n; i++) if (Math.min(4, Math.floor(lit(i) * 5)) === b) { rrect(g, i / n * TAU - Math.PI / 2, R * .56, R * .08, R * .022); any = true; }
        if (any) { g.fillStyle = col(C, (b + .5) / 5 * dim); g.fill(); }
      }
      const base = R * .47, tint = k.src === "mic" ? P.ink : C;   // waveform ring
      for (let i = 0; i < 120; i++) vs[i] = Math.abs(noise(i, T)) * L;
      g.lineWidth = 1.6;
      for (let b = 0; b < 6; b++) {
        g.beginPath(); let any = false;
        for (let i = 0; i < 120; i++) {
          if (Math.min(5, Math.floor(vs[i] * 6)) !== b) continue;
          const a = i / 120 * TAU, len = R * (.012 + vs[i] * .16);
          g.moveTo(Math.cos(a) * base, Math.sin(a) * base); g.lineTo(Math.cos(a) * (base - len), Math.sin(a) * (base - len)); any = true;
        }
        if (any) { g.strokeStyle = col(tint, .35 + (b + .5) / 6); g.stroke(); }
      }
      arc(g, R * .385, 0, TAU, 1.2, col(C, .55), 1);
      g.save(); g.rotate(T * .8); for (let j = 0; j < 3; j++) arc(g, R * .33, j * 2.094, j * 2.094 + .7, 2.4, col(C, .9), 1); g.restore();
      for (const p of parts) p.a += p.s * k.dt * (.4 + L);
      for (let b = 0; b < 4; b++) {   // particles, four depth layers
        g.beginPath();
        for (const p of parts) {
          if (Math.min(3, Math.floor(p.z * 4)) !== b) continue;
          const r = R * (.2 + p.r * .78), x = Math.cos(p.a) * r, y = Math.sin(p.a) * r, rad = .8 + p.z * 1.3;
          g.moveTo(x + rad, y); g.arc(x, y, rad, 0, TAU);
        }
        g.fillStyle = col(C, .15 + (b + .5) / 8); g.fill();
      }
      const cr = R * (.2 + .07 * L + (k.state === "listen" ? .015 * Math.sin(k.now / 180) : 0));
      g.globalAlpha = 1;
      glow(g, cr * 1.9, [[0, P.core, 1], [.18, P.c2, .95], [.42, C, .55], [1, C, 0]]);
      g.beginPath(); g.arc(0, 0, cr * .55, 0, TAU); g.fillStyle = col(P.core, .9); g.fill();
    } };
  },

  /* Vision: petals that bloom with the voice around an amber stone */
  bloom() {
    return { ring: .97, draw(g, R, T, L, P, k) {
      arc(g, R * .93, 0, TAU, 1, col(P.c, .22));
      g.beginPath();   // a slow ring of 48 beads
      for (let i = 0; i < 48; i++) { const a = i / 48 * TAU - T * .12, x = Math.cos(a) * R * .86, y = Math.sin(a) * R * .86; g.moveTo(x + 1.6, y); g.arc(x, y, 1.6, 0, TAU); }
      g.fillStyle = col(P.c, .55); g.fill();
      for (let p = 0; p < 3; p++) {
        g.beginPath();
        for (let i = 0; i <= 96; i++) {
          const a = i / 96 * TAU, rr = R * (.38 + p * .15) + Math.sin(a * (5 + p) + T * (1.1 + p * .35)) * R * .055 * (1 + L * 2.2);
          i ? g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        g.closePath();
        if (p === 0) { g.fillStyle = col(P.c, .08 + L * .1); g.fill(); }
        g.strokeStyle = col(p === 0 ? P.a : P.c, .85 - p * .2); g.lineWidth = 2.4 - p * .5; g.stroke();
      }
      const cr = R * (.15 + L * .05);
      glow(g, cr * 2.2, [[0, P.core, 1], [.3, P.a, .8], [.65, P.a, .18], [1, P.a, 0]]);
      g.beginPath();   // the stone: a cut diamond
      for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + Math.PI / 4 + T * .1; i ? g.lineTo(Math.cos(a) * cr * .55, Math.sin(a) * cr * .55) : g.moveTo(Math.cos(a) * cr * .55, Math.sin(a) * cr * .55); }
      g.closePath(); g.fillStyle = col(P.core, .9); g.fill();
    } };
  },

  /* Blueprint: a drafted dial with an oscilloscope trace */
  scope() {
    return { ring: .97, draw(g, R, T, L, P, k) {
      arc(g, R * .92, 0, TAU, 1.5, col(P.c, .85));
      g.setLineDash([6, 6]); arc(g, R * .62, 0, TAU, 1, col(P.c, .5)); g.setLineDash([]);
      g.beginPath();   // crosshair and the 10-degree ticks
      g.moveTo(-R, 0); g.lineTo(R, 0); g.moveTo(0, -R); g.lineTo(0, R);
      for (let i = 0; i < 36; i++) { const a = i / 36 * TAU, l = i % 3 === 0 ? .86 : .89; g.moveTo(Math.cos(a) * R * l, Math.sin(a) * R * l); g.lineTo(Math.cos(a) * R * .92, Math.sin(a) * R * .92); }
      g.strokeStyle = col(P.c, .45); g.lineWidth = 1; g.stroke();
      const sw = T * .5;   // the sweep and its fading trail
      for (let j = 0; j < 4; j++) { g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(sw - j * .06) * R * .92, Math.sin(sw - j * .06) * R * .92); g.strokeStyle = col(P.c, .7 - j * .17); g.lineWidth = 1.5; g.stroke(); }
      g.beginPath();   // the trace: flat at rest, alive with the voice
      for (let x = -R * .8; x <= R * .8; x += 4) {
        const env = Math.cos(x / (R * .8) * Math.PI / 2), y = Math.sin(x / 16 + T * 6) * R * (.03 + .25 * L) * env + Math.sin(x / 7 - T * 9) * R * .04 * L * env;
        x === -R * .8 ? g.moveTo(x, y) : g.lineTo(x, y);
      }
      g.strokeStyle = col(P.a, .95); g.lineWidth = 2.2; g.stroke();
      g.font = Math.round(R * .055) + "px " + P.mono; g.fillStyle = col(P.c, .85);
      g.fillText("Ø " + (240 + Math.round(L * 40)) + " mm", R * .42, -R * .74);
      g.fillText("REV. 2 · " + (k.state || "idle").toUpperCase(), -R * 1.0, R * .86);
      g.fillText("f " + (50 + L * 20).toFixed(1) + " Hz", -R * 1.0, -R * .74);
      arc(g, R * (.07 + L * .03), 0, TAU, 2, col(P.c, .95));
    } };
  },

  /* Obsidian: one white light, nothing else (the lightest) */
  orb() {
    return { ring: .9, draw(g, R, T, L, P, k) {
      const r = R * (.15 + L * .07 + .008 * Math.sin(k.now / 900));
      glow(g, r * 4.2, [[0, P.core, 1], [.16, P.core, .55], [.45, P.c, .1], [1, P.c, 0]]);
      arc(g, R * .9, 0, TAU, 1, col(P.c2, .16));
      arc(g, R * .9, T * .2, T * .2 + .5, 1.6, col(P.core, .5));
    } };
  },

  /* Phosphor: an ASCII core on a CRT */
  ascii() {
    const chars = " .:-=+*#%@", cols = 23, rows = 15;
    const cells = []; for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) cells.push([x - (cols - 1) / 2, y - (rows - 1) / 2]);
    const v = new Float32Array(cells.length);
    return { ring: .98, draw(g, R, T, L, P, k) {
      const cw = R * 2.1 / cols, ch = R * 1.9 / rows;
      g.font = Math.round(ch * 1.15) + "px " + P.mono; g.textAlign = "center"; g.textBaseline = "middle";
      for (let i = 0; i < cells.length; i++) {
        const [x, y] = cells[i], d = Math.hypot(x / (cols / 2), y / (rows / 2));
        v[i] = d > 1 ? 0 : Math.max(0, (Math.cos(d * 7 - T * 3) * .5 + .5) * (1 - d * d) * .75 + (L * .7 + .2) * (1 - d * d));
      }
      for (let b = 1; b < 5; b++) {
        g.fillStyle = col(P.c, .25 + b * .18);
        for (let i = 0; i < cells.length; i++) {
          const ci = Math.min(chars.length - 1, Math.floor(v[i] * chars.length));
          if (ci === 0 || Math.min(4, 1 + Math.floor(v[i] * 4)) !== b) continue;
          g.fillText(chars[ci], cells[i][0] * cw, cells[i][1] * ch);
        }
      }
      g.textAlign = "start"; g.textBaseline = "alphabetic";
    } };
  },

  /* Aurora: a sphere of light points */
  sphere() {
    const N = 220, pts = Array.from({ length: N }, (_, i) => [Math.acos(1 - 2 * (i + .5) / N), Math.PI * (1 + Math.sqrt(5)) * i]);
    const xy = new Float32Array(N * 3);
    return { ring: .95, draw(g, R, T, L, P, k) {
      glow(g, R * .7, [[0, P.core, .22], [1, P.core, 0]]);
      const sc = R * .72 * (1 + L * .12);
      for (let i = 0; i < N; i++) {
        const [phi, th0] = pts[i], th = th0 + T * .35;
        xy[i * 3] = Math.cos(th) * Math.sin(phi) * sc; xy[i * 3 + 1] = Math.cos(phi) * sc; xy[i * 3 + 2] = Math.sin(th) * Math.sin(phi);
      }
      for (let b = 0; b < 6; b++) {   // back / front x three depths
        g.beginPath(); let any = false;
        for (let i = 0; i < N; i++) {
          const z = xy[i * 3 + 2], front = z > 0, depth = Math.min(2, Math.floor((z + 1) / 2 * 3));
          if ((front ? 3 : 0) + depth !== b) continue;
          const r = 1.2 + (z + 1) * 1.5; g.moveTo(xy[i * 3] + r, xy[i * 3 + 1]); g.arc(xy[i * 3], xy[i * 3 + 1], r, 0, TAU); any = true;
        }
        if (any) { g.fillStyle = col(b >= 3 ? P.c : P.a, .3 + (b % 3) * .25); g.fill(); }
      }
    } };
  },

  /* Nebula: a two-armed galaxy turning slowly */
  galaxy() {
    const stars = Array.from({ length: 240 }, (_, i) => ({ arm: i % 2, r: Math.pow(Math.random(), .7), off: (Math.random() - .5) * .7,
      s: .7 + Math.random() * 1.5, hue: Math.random() < .55 ? 0 : 1, tw: Math.random() * TAU }));
    return { ring: .97, draw(g, R, T, L, P, k) {
      glow(g, R * .95, [[0, P.c, .16], [.5, P.a, .06], [1, P.a, 0]]);
      for (let b = 0; b < 4; b++) {
        g.beginPath(); let any = false;
        for (const s of stars) {
          const bright = (Math.sin(s.tw + T * 2) + 1) / 2 > .5 ? 1 : 0;
          if (s.hue * 2 + bright !== b) continue;
          const a = s.arm * Math.PI + s.r * 4.3 + s.off - T * .22 * (1.2 - s.r * .6), rr = s.r * R * (.92 + L * .08);
          const x = Math.cos(a) * rr, y = Math.sin(a) * rr * .62, rad = s.s * (1 + L * .4);
          g.moveTo(x + rad, y); g.arc(x, y, rad, 0, TAU); any = true;
        }
        if (any) { g.fillStyle = col(b < 2 ? P.c : P.a, b % 2 ? .95 : .45); g.fill(); }
      }
      const cr = R * (.12 + L * .05);
      glow(g, cr * 2.6, [[0, P.core, 1], [.25, P.c, .7], [1, P.c, 0]]);
    } };
  },

  /* Solar: a sun and its corona */
  corona() {
    return { ring: .97, draw(g, R, T, L, P, k) {
      const r0 = R * .34;
      for (let b = 0; b < 3; b++) {   // flares in three brightnesses
        g.beginPath();
        for (let i = 0; i < 90; i++) {
          const n1 = Math.abs(noise(i * .7, T * .35)), len = R * (.06 + .14 * n1 + L * .3 * Math.abs(noise(i * 1.3, T * 1.2)));
          if (Math.min(2, Math.floor(len / (R * .14))) !== b) continue;
          const a = i / 90 * TAU + T * .03;
          g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); g.lineTo(Math.cos(a) * (r0 + len), Math.sin(a) * (r0 + len));
        }
        g.strokeStyle = col(b ? P.a : P.c, .35 + b * .25); g.lineWidth = 2; g.stroke();
      }
      glow(g, r0 * 1.9, [[0, P.core, 1], [.4, P.a, .95], [.55, P.c, .7], [.75, P.c, .15], [1, P.c, 0]]);
      arc(g, R * .88, 0, TAU, 1, col(P.c, .3));
      g.save(); g.rotate(T * .25); for (let j = 0; j < 3; j++) arc(g, R * .88, j * 2.094, j * 2.094 + .5, 2.5, col(P.a, .7)); g.restore();
      const pa = T * .4;   // an orbiting planet
      g.beginPath(); g.arc(Math.cos(pa) * R * .88, Math.sin(pa) * R * .88, R * .025, 0, TAU); g.fillStyle = col(P.core, .95); g.fill();
    } };
  },

  /* Neon '84: a synthwave sun over a running grid */
  grid() {
    return { ring: 1.0, draw(g, R, T, L, P, k) {
      const h0 = R * .18, sunR = R * (.52 + L * .05);
      g.save();
      g.beginPath(); g.rect(-R * 2, -R * 2, R * 4, R * 2 + h0); g.clip();   // the sun sets behind the horizon
      const sg = g.createLinearGradient(0, -R * .1 - sunR, 0, -R * .1 + sunR);
      sg.addColorStop(0, col(P.core, 1)); sg.addColorStop(.55, col(P.c, 1)); sg.addColorStop(1, col(P.c, .9));
      g.beginPath(); g.arc(0, -R * .1, sunR, 0, TAU); g.fillStyle = sg; g.fill();
      g.globalCompositeOperation = "destination-out";   // the bands cut through the sun
      for (let i = 0; i < 7; i++) { const y = -R * .1 + sunR * (.05 + i * .14), th = 2 + i * 1.6; g.fillRect(-sunR, y + ((T * 8) % (sunR * .14)), sunR * 2, th); }
      g.globalCompositeOperation = "source-over";
      g.restore(); g.save();
      g.beginPath();   // the floor: lines rushing towards you
      const depth = R * .85, phase = (T * .5) % 1;
      for (let i = 0; i < 9; i++) { const z = (i + phase) / 9, y = h0 + depth * Math.pow(z, 2.1); g.moveTo(-R * 1.2, y); g.lineTo(R * 1.2, y); }
      for (let j = -9; j <= 9; j++) { g.moveTo(j * R * .05, h0); g.lineTo(j * R * .38, h0 + depth); }
      g.strokeStyle = col(P.a, .55 + L * .4); g.lineWidth = 1.4; g.stroke();
      g.beginPath(); g.moveTo(-R * 1.2, h0); g.lineTo(R * 1.2, h0); g.strokeStyle = col(P.a, 1); g.lineWidth = 2; g.stroke();
      g.restore();
    } };
  },

  /* Zen: an ink ensō that breathes, and a vermilion seal */
  enso() {
    const rough = Array.from({ length: 140 }, () => Math.random());
    return { ring: .97, draw(g, R, T, L, P, k) {
      const a0 = -Math.PI / 2 + Math.sin(T * .08) * .4, span = TAU * (.86 + .03 * Math.sin(T * .3)), n = 140, rc = R * .68;
      const out = [], inn = [];
      for (let i = 0; i <= n; i++) {
        const t = i / n, a = a0 + span * t, taper = Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.15)), .55);
        const w = R * (.012 + .07 * taper) * (1 + L * .5) * (.85 + rough[i % 140] * .3);
        out.push([Math.cos(a) * (rc + w / 2), Math.sin(a) * (rc + w / 2)]); inn.push([Math.cos(a) * (rc - w / 2), Math.sin(a) * (rc - w / 2)]);
      }
      g.beginPath(); g.moveTo(...out[0]); for (const p of out) g.lineTo(...p); for (let i = inn.length - 1; i >= 0; i--) g.lineTo(...inn[i]); g.closePath();
      g.fillStyle = col(P.c, .9); g.fill();
      g.beginPath();   // dry-brush hairs
      for (const off of [-.03, .035]) { g.moveTo(Math.cos(a0 + .3) * rc * (1 + off), Math.sin(a0 + .3) * rc * (1 + off)); g.arc(0, 0, rc * (1 + off), a0 + .3, a0 + span * .7); }
      g.strokeStyle = col(P.c, .22); g.lineWidth = 1; g.stroke();
      if (L > .02) glow(g, R * .5, [[0, P.a, L * .25], [1, P.a, 0]]);
      const s = R * (.13 + L * .015), x = R * .8, y = R * .74;   // the seal, below and right of the circle
      g.beginPath(); g.rect(x - s / 2, y - s / 2, s, s); g.fillStyle = col(P.a, .92); g.fill();
      g.beginPath(); g.rect(x - s * .28, y - s * .28, s * .56, s * .56); g.strokeStyle = col(P.core === P.a ? "255,248,240" : P.core, .9); g.lineWidth = Math.max(1, s * .08); g.stroke();
    } };
  },
};

function makeReactor(kind) { return (REACTORS[kind] || REACTORS.rings)(); }

function progressRing(g, R, ring, progress, building, P) {   // the build's progress, drawn over any reactor
  arc(g, R * ring, 0, TAU, 1, col(P.c, .12));
  arc(g, R * ring, -Math.PI / 2, -Math.PI / 2 + TAU * progress, 3, building ? col(P.a, .9) : col(P.g, .85), 1);
}
