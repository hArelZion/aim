/* Microphone -> 16 kHz PCM16 frames of 40 ms for Gemini Live, plus the input level for the orb. */
class MicPcm16 extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ratio = sampleRate / 16000;
    this.t = 0;
    this.prev = 0;
    this.out = new Int16Array(640);
    this.n = 0;
    this.acc = 0;
    this.cnt = 0;
  }
  process(inputs) {
    const x = inputs[0] && inputs[0][0];
    if (!x || !x.length) return true;
    for (let i = 0; i < x.length; i++) this.acc += x[i] * x[i];
    this.cnt += x.length;
    if (this.cnt >= 2048) { this.port.postMessage({ rms: Math.sqrt(this.acc / this.cnt) }); this.acc = 0; this.cnt = 0; }
    while (this.t < x.length) {
      const i = Math.floor(this.t);
      const xm = i > 0 ? x[i - 1] : this.prev, x0 = x[i], x1 = i + 1 < x.length ? x[i + 1] : x[i];
      const s = (xm + 2 * x0 + x1) / 4;   // a light low-pass before dropping to 16 kHz
      this.out[this.n++] = Math.max(-1, Math.min(1, s)) * 0x7fff;
      if (this.n === this.out.length) {
        const buf = this.out.buffer.slice(0);
        this.port.postMessage(buf, [buf]);
        this.n = 0;
      }
      this.t += this.ratio;
    }
    this.t -= x.length;
    this.prev = x[x.length - 1];
    return true;
  }
}
registerProcessor("mic-pcm16", MicPcm16);
