// Pocket Jarvis's ears and voice in the browser (no computer needed):
//   Wake  — "Hey Jarvis" while the app is open: the same openWakeWord models the PC uses (wake/*.onnx), ported from
//           openwakeword/utils.py: 80 ms chunks of 16 kHz int16 -> melspectrogram (x/10 + 2) -> 76-frame windows ->
//           96-d embeddings -> the last 16 -> hey_jarvis_v0.1. Checked against the Python scores (tests: ?wake-test).
//   Alan  — Jarvis's voice when the computer can't send it: Piper en_GB-alan-medium, the very model the PC speaks with
//           when ElevenLabs/Microsoft are out (downloaded once, ~63 MB, kept by the browser).
const ORT_URL = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.27.0/wasm/+esm";
const ORT_WASM = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.27.0/dist/";
const PIPER_URL = "https://cdn.jsdelivr.net/npm/@mintplex-labs/piper-tts-web@1.0.5/+esm";

let ortP = null;
function ort() {
  if (!ortP) ortP = import(ORT_URL).then((m) => {
    const o = m.default || m;
    o.env.wasm.wasmPaths = ORT_WASM;
    o.env.wasm.numThreads = 1;   // no cross-origin isolation on GitHub Pages: one thread
    return o;
  });
  return ortP;
}

// ---------------------------------------------------------------- the wake word
export class Wake {
  constructor({ base = "wake/", threshold = 0.5, onWake = () => {}, onLevel = null } = {}) {
    Object.assign(this, { base, threshold, onWake, onLevel });
    this.running = false; this.paused = false; this.ready = null;
  }

  load() {
    if (!this.ready) this.ready = (async () => {
      const o = await ort();
      const opt = { executionProviders: ["wasm"] };
      const [mel, emb, ww] = await Promise.all(["melspectrogram.onnx", "embedding_model.onnx", "hey_jarvis_v0.1.onnx"]
        .map((f) => o.InferenceSession.create(this.base + f, opt)));
      Object.assign(this, { o, mel, emb, ww });
      this.reset();
    })();
    return this.ready;
  }

  reset() {
    this.raw = new Float32Array(0);          // the last few chunks of int16 samples (as floats, unscaled, like Python)
    this.melBuf = [];                          // rows of 32
    for (let i = 0; i < 76; i++) this.melBuf.push(new Float32Array(32).fill(1));
    this.feats = [];                           // 96-d embeddings
    this.pending = new Float32Array(0);
    this.n = 0;
  }

  async _run(sess, data, dims) {
    const t = new this.o.Tensor("float32", data, dims);
    const out = await sess.run({ [sess.inputNames[0]]: t });
    return out[sess.outputNames[0]].data;
  }

  /** One 1280-sample chunk (int16 values as numbers) -> the wake score (0..1). */
  async chunk(c) {
    const keep = 1280 + 480;
    const raw = new Float32Array(Math.min(this.raw.length + c.length, 16000));
    raw.set(this.raw.subarray(Math.max(0, this.raw.length + c.length - raw.length)));
    raw.set(c, raw.length - c.length);
    this.raw = raw;
    if (raw.length < keep) return 0;
    const x = raw.subarray(raw.length - keep);
    const spec = await this._run(this.mel, Float32Array.from(x), [1, keep]);
    for (let i = 0; i + 32 <= spec.length; i += 32) {
      const row = new Float32Array(32);
      for (let j = 0; j < 32; j++) row[j] = spec[i + j] / 10 + 2;
      this.melBuf.push(row);
    }
    if (this.melBuf.length > 970) this.melBuf.splice(0, this.melBuf.length - 970);
    const win = new Float32Array(76 * 32);
    const start = this.melBuf.length - 76;
    for (let i = 0; i < 76; i++) win.set(this.melBuf[start + i], i * 32);
    const e = await this._run(this.emb, win, [1, 76, 32, 1]);
    this.feats.push(Float32Array.from(e.subarray(0, 96)));
    if (this.feats.length > 120) this.feats.shift();
    this.n++;
    if (this.feats.length < 16) return 0;
    const f = new Float32Array(16 * 96);
    for (let i = 0; i < 16; i++) f.set(this.feats[this.feats.length - 16 + i], i * 96);
    const s = (await this._run(this.ww, f, [1, 16, 96]))[0];
    return this.n < 5 ? 0 : s;   // openWakeWord ignores its first five predictions
  }

  /** Feed any number of int16-valued samples; calls onWake once per detection (1.5 s refractory). */
  async feed(samples) {
    let p = new Float32Array(this.pending.length + samples.length);
    p.set(this.pending); p.set(samples, this.pending.length);
    const scores = [];
    while (p.length >= 1280) {
      const s = await this.chunk(p.subarray(0, 1280));
      scores.push(s);
      p = p.subarray(1280);
      if (!this.paused && s >= this.threshold && performance.now() - (this.last || 0) > 1500) {
        this.last = performance.now();
        this.onWake(s);
      }
    }
    this.pending = Float32Array.from(p);
    return scores;
  }

  /** Listen through the microphone (the app must be on screen; iOS shows the orange dot). */
  async start() {
    if (this.running) return;
    if (this.starting) return this.starting;   // two taps at once must not open two microphones
    this.starting = this._start().finally(() => { this.starting = null; });
    return this.starting;
  }

  async _start() {
    await this.load();
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    const ac = this.ac = new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === "suspended") await ac.resume().catch(() => {});
    const worklet = `class D extends AudioWorkletProcessor{constructor(){super();this.r=sampleRate/16000;this.p=0;this.a=0;this.n=0;this.b=[];}
      process(i){const x=i[0]&&i[0][0];if(!x)return true;for(let k=0;k<x.length;k++){let w=1;
      while(this.p+w>=this.r){const f=this.r-this.p;this.a+=x[k]*f;this.n+=f;this.b.push(Math.max(-32768,Math.min(32767,this.a/this.n*32767)));
      w-=f;this.p=0;this.a=0;this.n=0;if(w<=1e-9)break;this.a+=x[k]*w;this.n+=w;this.p=w;w=0;}
      if(w>0){this.a+=x[k]*w;this.n+=w;this.p+=w;}}
      if(this.b.length>=1280){this.port.postMessage(Float32Array.from(this.b));this.b=[];}return true;}}
      registerProcessor("d16k",D);`;
    await ac.audioWorklet.addModule(URL.createObjectURL(new Blob([worklet], { type: "application/javascript" })));
    const src = ac.createMediaStreamSource(this.stream);
    const node = this.node = new AudioWorkletNode(ac, "d16k");
    let busy = false, queue = [];
    node.port.onmessage = async (ev) => {
      if (this.onLevel) { let m = 0; for (const v of ev.data) m = Math.max(m, Math.abs(v)); this.onLevel(m / 32768); }
      queue.push(ev.data);
      if (busy) return;
      busy = true;
      while (queue.length) { const d = queue.shift(); if (!this.paused) await this.feed(d); }
      busy = false;
    };
    src.connect(node);
    this.running = true;
  }

  stop() {
    this.running = false;
    try { this.node && this.node.disconnect(); } catch (_) {}
    try { this.stream && this.stream.getTracks().forEach((t) => t.stop()); } catch (_) {}
    try { this.ac && this.ac.close(); } catch (_) {}
    this.node = this.stream = this.ac = null;
    if (this.ready) this.reset();
  }
}

// ---------------------------------------------------------------- Alan, Jarvis's voice on the phone
let alanP = null;
export function alanReady() { return !!alanP && alanP.done; }
export function alan(progress) {
  if (!alanP) {
    alanP = (async () => {
      await ort();   // the same runtime build piper-tts-web loads (onnxruntime-web 1.27)
      const tts = await import(PIPER_URL);
      const s = await tts.TtsSession.create({ voiceId: "en_GB-alan-medium", progress,
        wasmPaths: { onnxWasm: ORT_WASM, piperData: tts.WASM_BASE + ".data", piperWasm: tts.WASM_BASE + ".wasm" } });
      alanP.done = true;
      return s;
    })();
    alanP.catch(() => { alanP = null; });
  }
  return alanP;
}

/** Text -> a list of WAV blobs, one per sentence, produced one after another (so speaking can start early). */
export async function* alanSpeak(text) {
  const s = await alan();
  const parts = (text.match(/[^.!?]+[.!?]+["')]?\s*|[^.!?]+$/g) || [text]).map((x) => x.trim()).filter(Boolean);
  for (const p of parts) yield await s.predict(p);
}
