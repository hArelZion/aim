/* Plays Atlas's voice: a queue of Float32 chunks (already at the context rate). "flush" empties it (barge-in).
   Reports the output level and whether anything is still playing. */
class PlayerPcm extends AudioWorkletProcessor {
  constructor() {
    super();
    this.q = [];
    this.cur = null;
    this.ci = 0;
    this.acc = 0;
    this.cnt = 0;
    this.port.onmessage = (e) => {
      if (e.data === "flush") { this.q = []; this.cur = null; }
      else if (e.data instanceof Float32Array) this.q.push(e.data);
    };
  }
  process(_inputs, outputs) {
    const ch = outputs[0];
    const out = ch[0];
    let i = 0;
    while (i < out.length) {
      if (!this.cur) { this.cur = this.q.shift() || null; this.ci = 0; if (!this.cur) break; }
      const n = Math.min(out.length - i, this.cur.length - this.ci);
      out.set(this.cur.subarray(this.ci, this.ci + n), i);
      i += n; this.ci += n;
      if (this.ci >= this.cur.length) this.cur = null;
    }
    for (let k = 0; k < i; k++) this.acc += out[k] * out[k];
    out.fill(0, i);
    for (let c = 1; c < ch.length; c++) ch[c].set(out);
    this.cnt += out.length;
    if (this.cnt >= 2048) {
      this.port.postMessage({ rms: Math.sqrt(this.acc / this.cnt), playing: i > 0 || this.q.length > 0 || !!this.cur });
      this.acc = 0; this.cnt = 0;
    }
    return true;
  }
}
registerProcessor("player-pcm", PlayerPcm);
