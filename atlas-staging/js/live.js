/* Live voice with Gemini Live (PLAN 7): the cloud mints a one-use token with the persona, memory and tools locked in;
   the app talks to Google over a WebSocket: mic 16 kHz PCM up, Atlas's 24 kHz voice down, captions both ways,
   barge-in (the server says "interrupted" -> the player is flushed), tool calls answered within 8 s,
   a fresh token + reconnect on goAway, the next model on a quota close, and camera frames in Vision mode.
   new Live({api, lang, voice, model, recent, onState, onCaption, onTool, onLevel, onError}) */
(function () {
  function b64(buf) {
    const b = new Uint8Array(buf); let s = "";
    for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function pcmToFloat(b64s, inRate, outRate) {
    const bin = atob(b64s), n16 = bin.length >> 1, pcm = new Int16Array(n16);
    for (let i = 0; i < n16; i++) { const lo = bin.charCodeAt(2 * i), hi = bin.charCodeAt(2 * i + 1); pcm[i] = (hi << 8) | lo; }
    const ratio = inRate / outRate, n = Math.floor(n16 / ratio), out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const p = i * ratio, j = Math.floor(p), f = p - j;
      const a = pcm[j] / 32768, b = (j + 1 < n16 ? pcm[j + 1] : pcm[j]) / 32768;
      out[i] = a + (b - a) * f;
    }
    return out;
  }
  const MODELS = ["gemini-3.8-live", "gemini-3.1-flash-live-preview", "gemini-2.5-flash-native-audio-latest"];
  const BASE = (document.currentScript && document.currentScript.src || location.href).replace(/js\/live\.js.*$/, "");

  class Live {
    constructor(o) {
      this.o = o; this.state = "idle"; this.ws = null; this.ready = false; this.stopped = false;
      this.modelIdx = Math.max(0, MODELS.indexOf(o.model || "")); this.retries = 0;
      this.userCap = ""; this.botCap = ""; this.lastIn = 0; this.playing = false; this.vision = null;
    }
    set(st) { if (this.state !== st) { this.state = st; this.o.onState && this.o.onState(st); } }

    async start() {
      this.stopped = false;
      this.set("connecting");
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC({ latencyHint: "interactive" });
      try { if (navigator.audioSession && this.o.audioSession !== "default") navigator.audioSession.type = "play-and-record"; } catch (e) {}
      await this.ctx.resume();
      this.mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
      await this.ctx.audioWorklet.addModule(BASE + "worklets/mic.js");
      await this.ctx.audioWorklet.addModule(BASE + "worklets/player.js");
      this.src = this.ctx.createMediaStreamSource(this.mic);
      this.micNode = new AudioWorkletNode(this.ctx, "mic-pcm16");
      const mute = this.ctx.createGain(); mute.gain.value = 0;
      this.src.connect(this.micNode); this.micNode.connect(mute); mute.connect(this.ctx.destination);
      this.player = new AudioWorkletNode(this.ctx, "player-pcm", { outputChannelCount: [2] });
      this.player.connect(this.ctx.destination);
      this.micNode.port.onmessage = (e) => {
        if (e.data && e.data.rms != null) { this.o.onLevel && this.o.onLevel(e.data.rms, null); return; }
        if (this.ready && this.ws && this.ws.readyState === 1 && !this.muted) {
          this.ws.send(JSON.stringify({ realtimeInput: { audio: { data: b64(e.data), mimeType: "audio/pcm;rate=16000" } } }));
        }
      };
      this.player.port.onmessage = (e) => {
        const d = e.data || {};
        this.o.onLevel && this.o.onLevel(null, d.rms || 0);
        const was = this.playing; this.playing = !!d.playing;
        if (was && !this.playing && this.state === "speaking") this.set("listening");
      };
      await this.connect();
    }

    async connect() {
      const model = MODELS[this.modelIdx] || MODELS[0];
      const tok = await this.o.api({ op: "live-token", mode: this.o.mode || "talk", lang: this.o.lang, voice: this.o.voice, model, tz: Intl.DateTimeFormat().resolvedOptions().timeZone, recent: this.o.recent ? this.o.recent() : [], city: this.o.city || "" });
      if (!tok || !tok.ws) throw new Error((tok && (tok.error || tok.say)) || "no token");
      if (this.stopped) return;
      this.model = tok.model;
      const ws = new WebSocket(tok.ws);
      ws.binaryType = "arraybuffer";
      this.ws = ws; this.ready = false;
      ws.onopen = () => ws.send(JSON.stringify({ setup: { model: "models/" + tok.model } }));
      ws.onmessage = (e) => {
        let m;
        try { m = JSON.parse(typeof e.data === "string" ? e.data : new TextDecoder().decode(e.data)); } catch (err) { return; }
        this.onMsg(m);
      };
      ws.onclose = (e) => this.onClose(ws, e);
      ws.onerror = () => {};
    }

    onMsg(m) {
      if (m.setupComplete) { this.ready = true; this.retries = 0; this.set("listening"); if (this.o.onReady) this.o.onReady(this.model); return; }
      const sc = m.serverContent;
      if (sc) {
        if (sc.interrupted) { this.player.port.postMessage("flush"); this.playing = false; this.closeBot(); this.set("listening"); }
        if (sc.inputTranscription && sc.inputTranscription.text) {
          if (this.botCap) this.closeBot();
          this.userCap += sc.inputTranscription.text; this.lastIn = Date.now();
          this.o.onCaption && this.o.onCaption("u", this.userCap, false);
          clearTimeout(this.thinkT);
          this.thinkT = setTimeout(() => { if (this.state === "listening" && !this.playing) this.set("thinking"); }, 700);
        }
        const parts = (sc.modelTurn && sc.modelTurn.parts) || [];
        for (const p of parts) {
          if (p.inlineData && /audio/.test(p.inlineData.mimeType || "audio")) {
            const rate = +((p.inlineData.mimeType || "").match(/rate=(\d+)/) || [0, 24000])[1];
            this.player.port.postMessage(pcmToFloat(p.inlineData.data, rate, this.ctx.sampleRate));
            this.playing = true;
            if (this.state !== "speaking") { this.closeUser(); this.set("speaking"); }
          }
        }
        if (sc.outputTranscription && sc.outputTranscription.text) {
          this.closeUser();
          this.botCap += sc.outputTranscription.text;
          this.o.onCaption && this.o.onCaption("a", this.botCap, false);
        }
        if (sc.turnComplete) { this.closeUser(); this.closeBot(); if (!this.playing) this.set("listening"); }
      }
      if (m.toolCall && m.toolCall.functionCalls) this.tools(m.toolCall.functionCalls);
      if (m.goAway) this.reconnect();
    }
    closeUser() { if (this.userCap) { this.o.onCaption && this.o.onCaption("u", this.userCap, true); this.userCap = ""; } }
    closeBot() { if (this.botCap) { this.o.onCaption && this.o.onCaption("a", this.botCap, true); this.botCap = ""; } }

    async tools(calls) {
      this.set("thinking");
      const responses = await Promise.all(calls.map(async (c) => {
        let result;
        try {
          result = await Promise.race([
            Promise.resolve(this.o.onTool(c.name, c.args || {})),
            new Promise((res) => setTimeout(() => res({ error: "timeout" }), 8000)),
          ]);
        } catch (e) { result = { error: String(e && e.message || e).slice(0, 120) }; }
        if (result && result.end) setTimeout(() => this.stop(), 1800);
        return { id: c.id, name: c.name, response: typeof result === "object" ? result : { result: String(result) } };
      }));
      if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify({ toolResponse: { functionResponses: responses } }));
    }

    sendText(text) {
      if (!this.ready || !this.ws || this.ws.readyState !== 1) return false;
      this.ws.send(JSON.stringify({ realtimeInput: { text } }));
      this.o.onCaption && this.o.onCaption("u", text, true);
      return true;
    }

    setVision(video) {
      clearInterval(this.visT); this.vision = video;
      if (!video) return;
      const cv = document.createElement("canvas"), g = cv.getContext("2d");
      this.visT = setInterval(() => {
        if (!this.ready || !this.ws || this.ws.readyState !== 1 || !video.videoWidth) return;
        const k = Math.min(1, 768 / Math.max(video.videoWidth, video.videoHeight));
        cv.width = Math.round(video.videoWidth * k); cv.height = Math.round(video.videoHeight * k);
        g.drawImage(video, 0, 0, cv.width, cv.height);
        const data = cv.toDataURL("image/jpeg", 0.6).split(",")[1];
        this.ws.send(JSON.stringify({ realtimeInput: { video: { data, mimeType: "image/jpeg" } } }));
      }, 1000);
    }

    async reconnect() {
      if (this.stopped) return;
      const old = this.ws; this.ws = null; this.ready = false;
      try { old && old.close(1000); } catch (e) {}
      try { await this.connect(); } catch (e) { this.fail(e); }
    }
    onClose(ws, e) {
      if (ws !== this.ws || this.stopped) return;
      this.ready = false;
      const why = String(e.reason || "");
      if (/quota|exhaust|limit|unavailable|overload/i.test(why) && this.modelIdx < MODELS.length - 1) { this.modelIdx++; this.reconnect(); return; }
      if (this.retries++ < 2) { setTimeout(() => this.reconnect(), 600); return; }
      this.fail(new Error(why || "closed " + e.code));
    }
    fail(err) {
      if (this.stopped) return;
      this.o.onError && this.o.onError(err);
      this.stop();
    }
    stop() {
      this.stopped = true; this.ready = false;
      clearInterval(this.visT); clearTimeout(this.thinkT);
      try { this.ws && this.ws.close(1000); } catch (e) {}
      this.ws = null;
      try { this.mic && this.mic.getTracks().forEach((t) => t.stop()); } catch (e) {}
      try { this.ctx && this.ctx.close(); } catch (e) {}
      this.closeUser(); this.closeBot();
      this.set("idle");
    }
  }
  window.Live = Live;
})();
