// On-device AI upscaling (ESRGAN "medium", RDN architecture) with TensorFlow.js, tile by tile.
// Models: @upscalerjs/esrgan-medium 1.0.0 (MIT), input/output range 0..255.
let tfP = null;
const models = {};

function loadTf() {
  return tfP || (tfP = new Promise((res, rej) => {
    if (window.tf) return res(window.tf);
    const s = document.createElement('script');
    s.src = new URL('./vendor/tf.min.js', import.meta.url).href;
    s.onload = () => res(window.tf); s.onerror = () => rej(new Error('tf load failed'));
    document.head.appendChild(s);
  }).then(async tf => {
    try { await tf.setBackend('webgl'); } catch { await tf.setBackend('cpu'); }
    await tf.ready();
    return tf;
  }));
}

async function loadModel(tf, f) {
  if (!models[f]) models[f] = tf.loadLayersModel(new URL(`./models/x${f}/model.json`, import.meta.url).href);
  return models[f];
}

const tick = () => new Promise(r => setTimeout(r, 0));

/**
 * @param {HTMLCanvasElement} src
 * @param {2|4} f
 * @returns {Promise<HTMLCanvasElement|null>} null when cancelled
 */
export async function upscale(src, f, { onStatus = () => {}, onProgress = () => {}, cancelled = () => false } = {}) {
  onStatus('טוען את מנוע ה־AI…');
  const tf = await loadTf();
  onStatus('טוען את המודל…');
  const model = await loadModel(tf, f);
  const w = src.width, h = src.height;
  const sd = src.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
  const out = document.createElement('canvas'); out.width = w * f; out.height = h * f;
  const octx = out.getContext('2d');
  const T = tf.getBackend() === 'webgl' ? 128 : 64, P = 6;
  const tiles = [];
  for (let y = 0; y < h; y += T) for (let x = 0; x < w; x += T) tiles.push([x, y]);
  onProgress(0);
  let n = 0;
  for (const [x, y] of tiles) {
    if (cancelled()) return null;
    const tw = Math.min(T, w - x), th = Math.min(T, h - y);
    const rx0 = Math.max(0, x - P), ry0 = Math.max(0, y - P);
    const rx1 = Math.min(w, x + tw + P), ry1 = Math.min(h, y + th + P);
    const rw = rx1 - rx0, rh = ry1 - ry0;
    const buf = new Float32Array(rw * rh * 3);
    for (let j = 0; j < rh; j++) {
      let si = ((ry0 + j) * w + rx0) * 4, di = j * rw * 3;
      for (let i = 0; i < rw; i++, si += 4, di += 3) { buf[di] = sd[si]; buf[di + 1] = sd[si + 1]; buf[di + 2] = sd[si + 2]; }
    }
    const t = tf.tidy(() => model.predict(tf.tensor4d(buf, [1, rh, rw, 3])).clipByValue(0, 255));
    const o = await t.data(); t.dispose();
    const ow = rw * f;
    const ox = (x - rx0) * f, oy = (y - ry0) * f, cw = tw * f, ch = th * f;
    const id = new ImageData(cw, ch); const dd = id.data;
    for (let j = 0; j < ch; j++) {
      let si = ((oy + j) * ow + ox) * 3, di = j * cw * 4;
      for (let i = 0; i < cw; i++, si += 3, di += 4) { dd[di] = o[si]; dd[di + 1] = o[si + 1]; dd[di + 2] = o[si + 2]; dd[di + 3] = 255; }
    }
    octx.putImageData(id, x * f, y * f);
    n++; onProgress(n / tiles.length);
    await tick();
  }
  return out;
}
