// AIM Write — write on any page. Plain ES module, no build step.
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const FONT = 'system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans Hebrew","Arial Hebrew",Arial,sans-serif';
const COLORS = ['#1a1a1a', '#1d4ed8', '#dc2626', '#15803d', '#ffffff', '#ea580c', '#7c3aed'];
const BGS = ['none', 'white', 'yellow', 'black'];
const PAD_X = 0.3, PAD_Y = 0.12, LH = 1.25, RAD = 0.18;
const MAX_CANVAS_PX = 16_000_000; // iOS canvas limit is ~16.7M px
const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const dpr = () => Math.min(window.devicePixelRatio || 1, 3);

const app = $('#app'), stage = $('#stage'), world = $('#world'), layer = $('#layer'), sharp = $('#sharp');

// ---------- small UI helpers ----------
let toastTimer;
function toast(msg, ms = 2600) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), ms);
}
function confirmBox(text, yes = 'כן', no = 'ביטול') {
  return new Promise(res => {
    const d = $('#dialog'); $('#dialogText').textContent = text;
    $('#dialogYes').textContent = yes; $('#dialogNo').textContent = no; d.hidden = false;
    const done = v => { d.hidden = true; $('#dialogYes').onclick = $('#dialogNo').onclick = null; res(v); };
    $('#dialogYes').onclick = () => done(true); $('#dialogNo').onclick = () => done(false);
  });
}
function busy(on, html = '') {
  const b = $('#busy'); b.hidden = !on; if (on) $('.busy-text', b).innerHTML = html;
}
let openSheetEl = null;
function openSheet(el) { closeSheet(); $('#scrim').hidden = false; el.hidden = false; openSheetEl = el; }
function closeSheet() { if (openSheetEl) openSheetEl.hidden = true; openSheetEl = null; $('#scrim').hidden = true; }
$('#scrim').addEventListener('click', closeSheet);
$$('[data-close]').forEach(b => b.addEventListener('click', closeSheet));

const RTL_CH = /[֐-ࣿיִ-﷿ﹰ-﻿]/;
function isRTL(s) {
  const m = (s || '').match(/[֐-ࣿיִ-﷿ﹰ-﻿]|[A-Za-zÀ-ɏͰ-ϿЀ-ӿ]/);
  return m ? RTL_CH.test(m[0]) : true;
}
const uid = () => Math.random().toString(36).slice(2, 10);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const canvasToBlob = (c, type = 'image/jpeg', q = 0.92) => new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('toBlob')), type, q));
const nextFrame = () => new Promise(r => requestAnimationFrame(() => r()));

// ---------- keep the app inside the visible area (keyboard) ----------
function syncViewport() {
  const vv = window.visualViewport;
  if (!vv) return;
  app.style.height = vv.height + 'px';
  app.style.top = vv.offsetTop + 'px';
}
if (window.visualViewport) {
  visualViewport.addEventListener('resize', syncViewport);
  visualViewport.addEventListener('scroll', syncViewport);
}
window.addEventListener('scroll', () => { if (window.scrollY) window.scrollTo(0, 0); });
syncViewport();

// ---------- storage (IndexedDB, one saved document) ----------
const idb = (() => {
  let dbp;
  const open = () => dbp || (dbp = new Promise((res, rej) => {
    const r = indexedDB.open('ktov', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  }));
  const tx = async (mode, fn) => { const db = await open(); return new Promise((res, rej) => {
    const t = db.transaction('kv', mode); const st = t.objectStore('kv'); const out = fn(st);
    t.oncomplete = () => res(out && out.result); t.onerror = () => rej(t.error);
  }); };
  return {
    get: k => tx('readonly', s => s.get(k)),
    set: (k, v) => tx('readwrite', s => s.put(v, k)),
    del: k => tx('readwrite', s => s.delete(k)),
  };
})();

// ---------- document state ----------
let D = null;           // current document
let V = { s: 1, tx: 0, ty: 0 }; // view: screen = doc * s + t
let fitS = 1;
let selected = null, editing = null;
let last = { rel: 0.02, color: COLORS[0], bold: false, bg: 'none' }; // rel = letter size as a fraction of page width
try { Object.assign(last, JSON.parse(localStorage.getItem('ktov-last') || '{}')); } catch {}
if (!(last.rel > 0.003 && last.rel < 0.3)) last.rel = 0.02;
delete last.size;
const saveLast = () => localStorage.setItem('ktov-last', JSON.stringify(last));
const items = () => D.pages[D.page].items;
const findItem = id => items().find(i => i.id === id);

// ---------- opening files ----------
const inputs = { camera: $('#inCamera'), photo: $('#inPhoto'), file: $('#inFile') };
$$('[data-pick]').forEach(b => b.addEventListener('click', () => { const i = inputs[b.dataset.pick]; i.value = ''; i.click(); }));
Object.values(inputs).forEach(i => i.addEventListener('change', () => { if (i.files[0]) openFile(i.files[0]); }));

$('#pasteBtn').addEventListener('click', async () => {
  try {
    const list = await navigator.clipboard.read();
    for (const it of list) {
      const type = it.types.find(t => t.startsWith('image/'));
      if (type) return openFile(new File([await it.getType(type)], 'pasted.png', { type }));
    }
    toast('אין תמונה בלוח');
  } catch { toast('אין גישה ללוח. נסה לבחור תמונה'); }
});
document.addEventListener('paste', e => {
  if (e.target.closest && e.target.closest('.tx')) return;
  const f = [...(e.clipboardData?.files || [])].find(f => f.type.startsWith('image/') || f.type === 'application/pdf');
  if (f) { e.preventDefault(); openFile(f); }
});
document.addEventListener('dragover', e => e.preventDefault());
document.addEventListener('drop', e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) openFile(f); });

function showScreen(name) {
  $('#home').hidden = name !== 'home';
  $('#editor').hidden = name !== 'editor';
}

async function openFile(file, saved = null) {
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');
  if (!isPdf && !(file.type || '').startsWith('image/') && file.type !== '') { toast('אפשר לפתוח תמונה או PDF'); return; }
  closeSheet();
  showScreen('editor');
  clearItemsDom(); world.innerHTML = ''; sharp.style.display = 'none';
  busy(true, 'פותח את הדף…');
  try {
    D = {
      kind: isPdf ? 'pdf' : 'image', name: (file.name || 'page').replace(/\.[^.]+$/, ''),
      blob: file, enhBlob: saved?.enhBlob || null, factor: saved?.factor || 1, enhKind: saved?.enhKind || null,
      pages: saved?.pages || [{ items: [] }], page: saved?.page || 0, w: 1, h: 1,
    };
    undoStack = []; redoStack = [];
    if (isPdf) {
      const pdfjs = await loadPdfJs();
      D.pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()),
        cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.5.438/cmaps/', cMapPacked: true,
        standardFontDataUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.5.438/standard_fonts/' }).promise;
      while (D.pages.length < D.pdf.numPages) D.pages.push({ items: [] });
      D.page = clamp(D.page, 0, D.pdf.numPages - 1);
      await showPdfPage(D.page);
    } else {
      await showImage(D.enhBlob || D.blob);
    }
    lastSnap = snapshot();
    D.ready = true; updatePager(); updateUndo(); fit(); buildItems();
    saveSoon(true);
  } catch (err) {
    console.error(err);
    busy(false); showScreen('home'); D = null;
    toast('לא הצלחתי לפתוח את הקובץ');
    return;
  }
  busy(false);
  $('#hint').hidden = false;
}

async function showImage(blob) {
  const img = new Image();
  img.decoding = 'async';
  if (D.imgURL) URL.revokeObjectURL(D.imgURL);
  D.imgURL = URL.createObjectURL(blob);
  img.src = D.imgURL;
  await img.decode();
  D.w = img.naturalWidth; D.h = img.naturalHeight;
  img.style.width = D.w + 'px'; img.style.height = D.h + 'px';
  img.draggable = false;
  world.innerHTML = ''; world.appendChild(img);
  D.base = img;
}

let pdfjsP;
function loadPdfJs() {
  return pdfjsP || (pdfjsP = import('./vendor/pdf.min.mjs?v=2').then(m => {
    m.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdf.worker.min.mjs?v=2', location.href).href;
    return m;
  }));
}

async function showPdfPage(i) {
  const page = await D.pdf.getPage(i + 1);
  D.pageObj = page;
  const vp1 = page.getViewport({ scale: 1 });
  D.w = vp1.width; D.h = vp1.height;
  const rs = Math.min(3, 3000 / Math.max(D.w, D.h));
  const vp = page.getViewport({ scale: rs });
  const c = document.createElement('canvas');
  c.width = Math.round(vp.width); c.height = Math.round(vp.height);
  await page.render({ canvasContext: c.getContext('2d'), viewport: vp, canvas: c }).promise;
  c.style.width = D.w + 'px'; c.style.height = D.h + 'px';
  world.innerHTML = ''; world.appendChild(c);
  D.base = c; D.rasterScale = rs;
  sharpKey = ''; sharp.style.display = 'none';
}

// ---------- view ----------
function stageSize() { return { W: stage.clientWidth, H: stage.clientHeight }; }
function fit() {
  const { W, H } = stageSize();
  fitS = Math.max(1e-4, Math.min((W - 24) / D.w, (H - 24) / D.h));
  V.s = fitS; V.tx = (W - D.w * V.s) / 2; V.ty = (H - D.h * V.s) / 2;
  render();
}
function limits() { return { min: fitS * 0.6, max: fitS * (D.kind === 'pdf' ? 20 : 10) }; }
function zoomAt(sx, sy, ns) {
  const { min, max } = limits(); ns = clamp(ns, min, max);
  V.tx = sx - (sx - V.tx) * (ns / V.s); V.ty = sy - (sy - V.ty) * (ns / V.s); V.s = ns;
}
function clampPan() {
  const { W, H } = stageSize(); const pw = D.w * V.s, ph = D.h * V.s, m = 60;
  V.tx = pw < W ? clamp(V.tx, -pw + m, W - m) : clamp(V.tx, W - pw - W * 0.4, W * 0.4);
  V.ty = ph < H ? clamp(V.ty, -ph + m, H - m) : clamp(V.ty, H - ph - H * 0.4, H * 0.4);
}

let raf = 0;
function render() { if (!raf) raf = requestAnimationFrame(() => { raf = 0; renderNow(); }); }
function renderNow() {
  if (!D) return;
  world.style.transform = `translate(${V.tx}px,${V.ty}px) scale(${V.s})`;
  for (const it of items()) layoutItem(it);
  $('#zoomLabel').textContent = Math.round(V.s / fitS * 100) + '%';
  if (D.kind === 'pdf') {
    const key = `${V.s.toFixed(4)}|${V.tx.toFixed(1)}|${V.ty.toFixed(1)}|${D.page}|${stage.clientWidth}x${stage.clientHeight}`;
    if (key !== sharpKey) { sharp.style.display = 'none'; sharpKey = ''; scheduleSharp(key); }
  }
}

// Sharp PDF: re-render only the visible part at the exact zoom, so text stays crisp at any size.
let sharpKey = '', sharpTimer = 0, sharpTask = null;
function scheduleSharp(key) {
  clearTimeout(sharpTimer);
  sharpTimer = setTimeout(() => renderSharp(key), 160);
}
async function renderSharp(key) {
  if (!D || D.kind !== 'pdf' || !D.pageObj) return;
  const ps = V.s * dpr();
  if (ps <= D.rasterScale * 1.05) return; // base raster is already sharp enough
  const { W, H } = stageSize();
  const x0 = Math.max(0, -V.tx / V.s), y0 = Math.max(0, -V.ty / V.s);
  const x1 = Math.min(D.w, (W - V.tx) / V.s), y1 = Math.min(D.h, (H - V.ty) / V.s);
  if (x1 <= x0 || y1 <= y0) return;
  const cw = Math.ceil((x1 - x0) * ps), ch = Math.ceil((y1 - y0) * ps);
  if (cw * ch > MAX_CANVAS_PX) return;
  try { sharpTask && sharpTask.cancel(); } catch {}
  const tmp = document.createElement('canvas'); tmp.width = cw; tmp.height = ch;
  const vp = D.pageObj.getViewport({ scale: ps });
  const page = D.page;
  sharpTask = D.pageObj.render({ canvasContext: tmp.getContext('2d'), viewport: vp, canvas: tmp,
    transform: [1, 0, 0, 1, -x0 * ps, -y0 * ps] });
  try { await sharpTask.promise; } catch { return; }
  const nowKey = `${V.s.toFixed(4)}|${V.tx.toFixed(1)}|${V.ty.toFixed(1)}|${D.page}|${stage.clientWidth}x${stage.clientHeight}`;
  if (nowKey !== key || page !== D.page) return;
  sharp.width = cw; sharp.height = ch;
  sharp.getContext('2d').drawImage(tmp, 0, 0);
  Object.assign(sharp.style, { left: V.tx + x0 * V.s + 'px', top: V.ty + y0 * V.s + 'px',
    width: (x1 - x0) * V.s + 'px', height: (y1 - y0) * V.s + 'px', display: 'block' });
  sharpKey = key;
}

new ResizeObserver(() => {
  if (!D || !D.ready || $('#editor').hidden) return;
  const old = fitS;
  const { W, H } = stageSize();
  fitS = Math.max(1e-4, Math.min((W - 24) / D.w, (H - 24) / D.h));
  if (Math.abs(V.s - old) < 1e-6 && !editing) fit();
  else if (editing) ensureVisible(findItem(editing));
  render();
}).observe(stage);

// ---------- text items ----------
function itemEl(it) { return layer.querySelector(`[data-id="${it.id}"]`); }
function clearItemsDom() { layer.innerHTML = ''; selected = editing = null; showTextbar(false); }
function buildItems() {
  layer.innerHTML = '';
  for (const it of items()) makeItemEl(it);
  render();
}
const ICON_MOVE = '<svg viewBox="0 0 24 24"><path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/></svg>';
const ICON_SIZE = '<svg viewBox="0 0 24 24"><path d="M5 19L19 5M5 19v-6M5 19h6M19 5h-6M19 5v6"/></svg>';
const ICON_WIDTH = '<svg viewBox="0 0 24 24"><path d="M4 12h16M4 12l3-3M4 12l3 3M20 12l-3-3M20 12l-3 3"/></svg>';
// Max line width (doc units): set by the user, or up to the page edge in the writing direction.
function itemMaxW(it) {
  if (it.w) return it.w;
  const m = D.w * 0.03, room = isRTL(it.text) ? it.x - m : D.w - m - it.x;
  return Math.max(D.w * 0.2, room);
}
function makeItemEl(it) {
  const el = document.createElement('div');
  el.className = 'ti'; el.dataset.id = it.id;
  el.innerHTML = `<span class="tx" data-ph="כתוב כאן"></span><span class="h h-move">${ICON_MOVE}</span><span class="h h-size">${ICON_SIZE}</span><span class="h h-width">${ICON_WIDTH}</span>`;
  const tx = el.firstChild; tx.textContent = it.text;
  tx.addEventListener('input', () => {
    const was = el.classList.contains('rtl');
    it.text = tx.innerText.replace(/\r/g, ''); styleItem(it, el); layoutItem(it);
    // the first letter decides the writing direction: re-aim the view so the line grows on screen
    if (was !== el.classList.contains('rtl') && editing === it.id) { if (!autoView) autoView = { ...V }; animateView(focusTarget(it), 200); }
    else ensureVisible(it);
    saveSoon();
  });
  tx.addEventListener('blur', () => { if (editing === it.id) finishEdit(); });
  tx.addEventListener('paste', e => {
    e.preventDefault();
    const t = (e.clipboardData || window.clipboardData).getData('text/plain');
    document.execCommand('insertText', false, t);
  });
  tx.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); tx.blur(); } });
  layer.appendChild(el);
  styleItem(it, el); layoutItem(it, el);
  return el;
}
function styleItem(it, el = itemEl(it)) {
  if (!el) return;
  const rtl = isRTL(it.text);
  el.classList.toggle('rtl', rtl); el.classList.toggle('ltr', !rtl);
  el.style.color = it.color; el.style.fontWeight = it.bold ? '700' : '400';
  BGS.forEach(b => el.classList.toggle('bg-' + b, it.bg === b));
  el.classList.toggle('sel', selected === it.id);
}
function layoutItem(it, el = itemEl(it)) {
  if (!el) return;
  const fs = it.size * V.s;
  const rtl = el.classList.contains('rtl');
  const sx = it.x * V.s + V.tx, sy = it.y * V.s + V.ty;
  const left = rtl ? sx + PAD_X * fs : sx - PAD_X * fs;
  const top = sy - (LH / 2 + PAD_Y) * fs;
  el.style.fontSize = fs + 'px';
  const tx = el.firstChild;
  if (editing === it.id) tx.style.maxWidth = itemMaxW(it) * V.s * 1.03 + 2 + 'px'; // a little slack: small screen fonts measure wider
  else {
    // fixed line breaks (computed for the page, not per zoom) so the text never re-flows when zooming
    tx.style.maxWidth = 'none';
    const t = wrapLines(it).map(l => l.replace(/\s+$/, '')).join('\n');
    if (tx.textContent !== t) tx.textContent = t;
  }
  el.style.transform = `translate(${left}px,${top}px)` + (rtl ? ' translateX(-100%)' : '');
}
function select(id) {
  if (selected === id) return;
  selected = id;
  for (const el of layer.children) el.classList.toggle('sel', el.dataset.id === id);
  showTextbar(!!id);
}
const PT_OK = (() => { const d = document.createElement('div'); try { d.contentEditable = 'plaintext-only'; return d.contentEditable === 'plaintext-only'; } catch { return false; } })();
function startEdit(id) {
  if (editing && editing !== id) finishEdit(true);
  const it = findItem(id); if (!it) return;
  select(id); editing = id;
  const el = itemEl(it), tx = el.firstChild;
  el.classList.add('editing');
  tx.textContent = it.text; layoutItem(it, el);
  focusOn(it);
  tx.contentEditable = PT_OK ? 'plaintext-only' : 'true';
  tx.focus({ preventScroll: true });
  const r = document.createRange(); r.selectNodeContents(tx); r.collapse(false);
  const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
  setTimeout(() => { if (editing === it.id && !animId) ensureVisible(it); }, 400);
}
function finishEdit(keepView = false) {
  if (!editing) return;
  const it = findItem(editing); const id = editing; editing = null;
  const el = it && itemEl(it);
  if (el) { el.classList.remove('editing'); el.firstChild.contentEditable = 'false'; el.firstChild.blur(); }
  if (it) {
    it.text = it.text.replace(/\n+$/, '');
    if (!it.text.trim()) { removeItem(id, false); if (selected === id) select(null); }
    else { styleItem(it, el); layoutItem(it, el); }
  }
  commit();
  if (!keepView && autoView) { const v = autoView; autoView = null; animateView(v); }
}

// ---------- automatic zoom while writing ----------
// Like form-filling apps: tapping to write zooms to a comfortable size; finishing returns to the previous view.
let autoView = null, animId = 0;
const coarse = matchMedia('(pointer: coarse)').matches;
function userMovedView() { autoView = null; cancelAnimationFrame(animId); animId = 0; }
function animateView(to, ms = 280) {
  cancelAnimationFrame(animId);
  const from = { ...V }, t0 = performance.now();
  const step = now => {
    const t = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - t, 3);
    V.s = from.s + (to.s - from.s) * e; V.tx = from.tx + (to.tx - from.tx) * e; V.ty = from.ty + (to.ty - from.ty) * e;
    renderNow(); animId = t < 1 ? requestAnimationFrame(step) : 0;
  };
  animId = requestAnimationFrame(step);
}
function focusTarget(it) {
  const { W, H } = stageSize(), m = 18, { min, max } = limits();
  const size = it.size, maxW = itemMaxW(it), rtl = isRTL(it.text), pad = PAD_X * size;
  let s = V.s;
  if (size * s < 16 || size * s > 40) s = 22 / size;                    // readable letters (~22px)
  s = Math.min(s, Math.max((W - 2 * m) / (maxW + 2 * pad), 12 / size)); // the whole line fits on screen
  s = clamp(s, min, max);
  const colLeft = rtl ? it.x - maxW - pad : it.x - pad, colW = maxW + 2 * pad;
  const tx = colW * s <= W - 2 * m ? (W - colW * s) / 2 - colLeft * s
    : rtl ? W - m - (it.x + pad) * s : m - (it.x - pad) * s;
  const top = (it.y - (LH / 2 + PAD_Y) * size) * s;
  const ty = Math.min(90, H * 0.25) - top;
  return { s, tx, ty };
}
function focusOn(it) {
  const { H } = stageSize();
  const fs = it.size * V.s, topNow = (it.y - (LH / 2 + PAD_Y) * it.size) * V.s + V.ty;
  const ok = fs >= 16 && fs <= 40 && topNow >= 8 && topNow <= (coarse ? H * 0.4 : H - 60);
  if (ok) return;
  if (!autoView) autoView = { ...V };
  animateView(focusTarget(it));
}
function removeItem(id, doCommit = true) {
  const arr = items(); const i = arr.findIndex(x => x.id === id);
  if (i >= 0) arr.splice(i, 1);
  layer.querySelector(`[data-id="${id}"]`)?.remove();
  if (selected === id) select(null);
  if (editing === id) editing = null;
  if (doCommit) commit();
}
function deselect() {
  if (editing) finishEdit();
  select(null);
}
function createAt(sx, sy) {
  const x = (sx - V.tx) / V.s, y = (sy - V.ty) / V.s;
  if (x < -D.w * 0.02 || y < -D.h * 0.02 || x > D.w * 1.02 || y > D.h * 1.02) return; // off the page
  const it = { id: uid(), x, y, text: '', size: last.rel * D.w, color: last.color, bold: last.bold, bg: last.bg };
  items().push(it);
  makeItemEl(it);
  startEdit(it.id);
  $('#hint').hidden = true;
}
function ensureVisible(it) {
  if (!it) return;
  const el = itemEl(it); if (!el) return;
  const r = el.getBoundingClientRect(), s = stage.getBoundingClientRect();
  let dx = 0, dy = 0; const m = 16;
  if (r.bottom > s.bottom - m) dy = s.bottom - m - r.bottom;
  if (r.top + dy < s.top + m) dy = s.top + m - r.top;
  if (r.width < s.width - 2 * m) {
    if (r.left < s.left + m) dx = s.left + m - r.left;
    if (r.right > s.right - m) dx = s.right - m - r.right;
  }
  if (dx || dy) { V.tx += dx; V.ty += dy; renderNow(); }
}

// ---------- text toolbar ----------
const colorsEl = $('#tColors');
COLORS.forEach(c => {
  const b = document.createElement('button'); b.className = 'sw'; b.style.background = c; b.dataset.c = c;
  b.setAttribute('aria-label', 'צבע'); colorsEl.appendChild(b);
});
function showTextbar(on) {
  $('#textbar').hidden = !on; $('#viewbar').hidden = on;
  if (on) { $('#hint').hidden = true; syncTextbar(); }
}
const SZ_MIN = 0.006, SZ_RANGE = 20; // slider maps to 0.6%..12% of the page width
function syncTextbar() {
  const it = selected && findItem(selected); if (!it) return;
  $('#tSize').value = clamp(Math.log(it.size / D.w / SZ_MIN) / Math.log(SZ_RANGE) * 100, 0, 100);
  $$('.sw', colorsEl).forEach(b => b.classList.toggle('on', b.dataset.c === it.color));
  $('#tBold').classList.toggle('on', it.bold);
  $('.bg-ico').className = 'bg-ico ' + (it.bg === 'none' ? '' : it.bg);
}
function withSel(fn, doCommit = true) {
  const it = selected && findItem(selected); if (!it) return;
  fn(it); styleItem(it); layoutItem(it); syncTextbar();
  last = { rel: it.size / D.w, color: it.color, bold: it.bold, bg: it.bg }; saveLast();
  if (doCommit && !editing) commit();
  if (editing) itemEl(it).firstChild.focus({ preventScroll: true });
}
// keep the keyboard open while using the toolbar
$('#textbar').addEventListener('pointerdown', e => { if (e.target.closest('button')) e.preventDefault(); });
$('#tSize').addEventListener('input', e => withSel(it => { it.size = SZ_MIN * Math.pow(SZ_RANGE, e.target.value / 100) * D.w; }, false));
$('#tSize').addEventListener('change', () => { if (!editing) commit(); });
$('#tSmaller').addEventListener('click', () => withSel(it => { it.size /= 1.15; }));
$('#tBigger').addEventListener('click', () => withSel(it => { it.size *= 1.15; }));
colorsEl.addEventListener('click', e => { const b = e.target.closest('.sw'); if (b) withSel(it => { it.color = b.dataset.c; }); });
$('#tBold').addEventListener('click', () => withSel(it => { it.bold = !it.bold; }));
$('#tBg').addEventListener('click', () => withSel(it => { it.bg = BGS[(BGS.indexOf(it.bg) + 1) % BGS.length]; }));
$('#tDelete').addEventListener('click', () => { if (selected) { editing = null; removeItem(selected); } });
$('#tOk').addEventListener('click', () => deselect());

// ---------- gestures ----------
const P = new Map();
let G = null;      // current gesture
let tap = null;    // pending tap, acted on in 'click' (so the keyboard may open on iOS)
const pt = e => { const r = stage.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

stage.addEventListener('pointerdown', e => {
  if (!D || e.button > 0) return;
  const p = pt(e); P.set(e.pointerId, p);
  if (P.size === 1) {
    const ti = e.target.closest('.ti'), h = e.target.closest('.h');
    const it = ti && findItem(ti.dataset.id);
    G = { mode: 'pan-press', start: p, sv: { ...V }, t: performance.now() };
    if (h && it) {
      e.preventDefault();
      G.mode = h.classList.contains('h-move') ? 'move' : h.classList.contains('h-width') ? 'width' : 'resize';
      G.item = it; G.si = { x: it.x, y: it.y, size: it.size, wSet: it.w, w: Math.min(itemMaxW(it), ti.firstChild.getBoundingClientRect().width / V.s) };
      G.rtl = ti.classList.contains('rtl');
      const r = ti.getBoundingClientRect(), sr = stage.getBoundingClientRect();
      G.anchor = ti.classList.contains('rtl') ? { x: r.right - sr.left, y: r.top - sr.top } : { x: r.left - sr.left, y: r.top - sr.top };
    } else if (it) {
      G.item = it; G.si = { x: it.x, y: it.y, size: it.size };
      G.mode = editing === it.id ? 'edit-press' : 'item-press';
    }
  } else if (P.size === 2) {
    const [a, b] = [...P.values()];
    // two fingers always zoom the page (never the text); undo any start of a drag
    if (G && G.item && G.si) { Object.assign(G.item, { x: G.si.x, y: G.si.y, size: G.si.size }); if (G.si.wSet !== undefined) G.item.w = G.si.wSet; layoutItem(G.item); }
    G = { mode: 'pinch', d0: dist(a, b), m0: mid(a, b), sv: { ...V } };
    userMovedView();
  }
});

window.addEventListener('pointermove', e => {
  if (!P.has(e.pointerId) || !G) return;
  const p = pt(e); P.set(e.pointerId, p);
  const moved = G.start ? dist(p, G.start) : 0;
  switch (G.mode) {
    case 'pan-press': if (moved > 8) { G.mode = 'pan'; userMovedView(); } else break;
    // falls through
    case 'pan':
      V.tx = G.sv.tx + p.x - G.start.x; V.ty = G.sv.ty + p.y - G.start.y; clampPan(); render(); break;
    case 'item-press': if (moved > 8) { G.mode = 'item-drag'; if (editing) finishEdit(); select(G.item.id); } else break;
    // falls through
    case 'item-drag': case 'move':
      G.item.x = G.si.x + (p.x - G.start.x) / V.s; G.item.y = G.si.y + (p.y - G.start.y) / V.s; layoutItem(G.item); break;
    case 'edit-press': if (moved > 12) { G.mode = 'item-drag'; } break;
    case 'width': {
      const dx = (p.x - G.start.x) / V.s;
      G.item.w = clamp(G.si.w + (G.rtl ? -dx : dx), G.item.size * 1.5, D.w * 1.5);
      layoutItem(G.item); break;
    }
    case 'resize': {
      const d0 = Math.max(20, dist(G.start, G.anchor));
      G.item.size = clamp(G.si.size * dist(p, G.anchor) / d0, D.w * 0.004, D.w * 0.3);
      layoutItem(G.item); syncTextbar(); break;
    }
    case 'pinch': {
      const [a, b] = [...P.values()]; if (!b) break;
      const m = mid(a, b), { min, max } = limits();
      const ns = clamp(G.sv.s * dist(a, b) / G.d0, min, max);
      V.s = ns; V.tx = m.x - (G.m0.x - G.sv.tx) * (ns / G.sv.s); V.ty = m.y - (G.m0.y - G.sv.ty) * (ns / G.sv.s);
      clampPan(); render(); break;
    }
  }
});

function endPointer(e) {
  if (!P.has(e.pointerId)) return;
  P.delete(e.pointerId);
  if (!G) return;
  if (P.size === 1 && G.mode === 'pinch') {
    const p = [...P.values()][0]; G = { mode: 'pan', start: p, sv: { ...V } }; return;
  }
  if (P.size > 0) return;
  const m = G.mode;
  if (e.type === 'pointerup') {
    if (m === 'pan-press') queueTap({ kind: 'empty', x: G.start.x, y: G.start.y });
    else if (m === 'item-press') queueTap({ kind: 'item', id: G.item.id });
  }
  if (['item-drag', 'move', 'resize', 'width'].includes(m)) {
    if (m === 'item-drag' || m === 'move') select(G.item.id);
    commitItemChange(G.item);
  }
  G = null;
}
window.addEventListener('pointerup', endPointer);
window.addEventListener('pointercancel', endPointer);
function commitItemChange(it) {
  if (editing === it.id) return; // committed when editing ends
  last.rel = it.size / D.w; saveLast(); commit();
}

let tapTimer = 0;
function queueTap(t) {
  tap = { ...t, at: performance.now() };
  clearTimeout(tapTimer);
  tapTimer = setTimeout(runTap, 450); // fallback if no click arrives
}
stage.addEventListener('click', () => runTap());
function runTap() {
  clearTimeout(tapTimer);
  const t = tap; tap = null;
  if (!t || performance.now() - t.at > 800) return;
  if (t.kind === 'item') { startEdit(t.id); return; }
  if (editing || selected) { deselect(); return; }
  createAt(t.x, t.y);
}

stage.addEventListener('wheel', e => {
  if (!D) return; e.preventDefault(); userMovedView();
  const p = pt(e);
  if (e.ctrlKey || Math.abs(e.deltaY) > Math.abs(e.deltaX) && !e.shiftKey) zoomAt(p.x, p.y, V.s * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0022)));
  else { V.tx -= e.deltaX; V.ty -= e.deltaY; }
  clampPan(); render();
}, { passive: false });

document.addEventListener('keydown', e => {
  if ($('#editor').hidden || editing) return;
  if ((e.key === 'Delete' || e.key === 'Backspace') && selected) { e.preventDefault(); removeItem(selected); }
  else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
  else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
});

$('#btnFit').addEventListener('click', () => { userMovedView(); fit(); });

// ---------- undo / redo ----------
let undoStack = [], redoStack = [], lastSnap = '';
const snapshot = () => JSON.stringify(D.pages);
function commit() {
  if (!D) return;
  const s = snapshot();
  if (s !== lastSnap) { undoStack.push(lastSnap); if (undoStack.length > 100) undoStack.shift(); redoStack = []; lastSnap = s; }
  updateUndo(); saveSoon();
}
function restore(s) {
  D.pages = JSON.parse(s); lastSnap = s;
  selected = editing = null; showTextbar(false); buildItems(); updateUndo(); saveSoon();
}
function undo() { if (editing) finishEdit(); if (undoStack.length) { redoStack.push(lastSnap); restore(undoStack.pop()); } }
function redo() { if (editing) finishEdit(); if (redoStack.length) { undoStack.push(lastSnap); restore(redoStack.pop()); } }
function updateUndo() { $('#btnUndo').disabled = !undoStack.length; $('#btnRedo').disabled = !redoStack.length; }
$('#btnUndo').addEventListener('pointerdown', e => e.preventDefault());
$('#btnUndo').addEventListener('click', undo);
$('#btnRedo').addEventListener('click', redo);

// ---------- pages ----------
function updatePager() {
  const n = D.kind === 'pdf' ? D.pdf.numPages : 1;
  $('#pager').hidden = n < 2;
  $('#pgLabel').textContent = `⁦${D.page + 1} / ${n}⁩`;
  $('#pgPrev').disabled = D.page <= 0; $('#pgNext').disabled = D.page >= n - 1;
}
async function goPage(i) {
  if (!D || D.kind !== 'pdf' || i < 0 || i >= D.pdf.numPages || i === D.page) return;
  deselect(); D.page = i; busy(true, 'טוען עמוד…');
  try { await showPdfPage(i); } finally { busy(false); }
  updatePager(); fit(); buildItems(); saveSoon();
}
$('#pgPrev').addEventListener('click', () => goPage(D.page - 1));
$('#pgNext').addEventListener('click', () => goPage(D.page + 1));

// ---------- save / resume ----------
let saveTimer = 0;
function saveSoon(withThumb = false) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    if (!D) return;
    const rec = { blob: D.blob, enhBlob: D.enhBlob, factor: D.factor, enhKind: D.enhKind, kind: D.kind,
      name: D.name, type: D.blob.type, pages: D.pages, page: D.page, savedAt: Date.now() };
    if (withThumb || !D.thumb) D.thumb = makeThumb();
    rec.thumb = D.thumb;
    try { await idb.set('last', rec); } catch (e) { console.warn('save failed', e); }
  }, withThumb ? 50 : 500);
}
function makeThumb() {
  try {
    const c = document.createElement('canvas'), k = 120 / Math.max(D.w, D.h);
    c.width = Math.max(1, Math.round(D.w * k)); c.height = Math.max(1, Math.round(D.h * k));
    c.getContext('2d').drawImage(D.base, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.7);
  } catch { return ''; }
}
async function refreshResume() {
  let rec = null; try { rec = await idb.get('last'); } catch {}
  const b = $('#resume');
  if (!rec || !rec.blob) { b.hidden = true; return; }
  b.hidden = false;
  $('.resume-thumb', b).style.backgroundImage = rec.thumb ? `url("${rec.thumb}")` : '';
  const n = rec.pages.reduce((a, p) => a + p.items.length, 0);
  $('.resume-text small', b).textContent = `${rec.name} · ${n ? n + ' כיתובים' : 'בלי כיתוב עדיין'}`;
  b.onclick = () => {
    const f = new File([rec.blob], rec.name + (rec.kind === 'pdf' ? '.pdf' : ''), { type: rec.type || (rec.kind === 'pdf' ? 'application/pdf' : 'image/jpeg') });
    openFile(f, rec);
  };
}
$('#btnClose').addEventListener('click', async () => {
  deselect(); clearTimeout(saveTimer);
  if (D) { const keep = D; D = null; saveTimerFlush(keep); }
  showScreen('home'); closeSheet(); setTimeout(refreshResume, 120);
});
async function saveTimerFlush(doc) {
  const rec = { blob: doc.blob, enhBlob: doc.enhBlob, factor: doc.factor, enhKind: doc.enhKind, kind: doc.kind, name: doc.name,
    type: doc.blob.type, pages: doc.pages, page: doc.page, savedAt: Date.now(), thumb: doc.thumb || '' };
  try { await idb.set('last', rec); } catch {}
}

document.addEventListener('visibilitychange', () => { if (document.hidden && D) saveTimerFlush(D); });

// ---------- quality ----------
const AI_LIMIT = { 2: 4_100_000, 4: 1_020_000 }; // output must stay under the ~16.7M px canvas limit
$('#btnEnhance').addEventListener('click', () => {
  if (!D) return; deselect();
  if (D.kind === 'pdf') { toast('קובץ PDF נשאר חד בכל הגדלה – אין צורך בשיפור ✨', 3200); return; }
  const px = D.w * D.h;
  $('#enhInfo').textContent = `גודל עכשיו: ⁦${D.w}×${D.h}⁩` + (D.enhKind ? ` · כבר שופר (${D.enhKind})` : '');
  for (const f of [2, 4]) {
    const b = $('#enhAI' + f), ok = px <= AI_LIMIT[f];
    b.disabled = !ok;
    $('small', b).textContent = ok
      ? (f === 2 ? 'מכפיל את הרזולוציה ומחדד קווים וטקסט. רץ בטלפון עצמו.' : 'פי 4 – לתמונות קטנות או מטושטשות במיוחד.') +
        (px * f * f > 4_000_000 ? ' בתמונה בגודל הזה זה יכול לקחת דקה-שתיים – אפשר לבטל בכל רגע.' : '')
      : 'התמונה כבר ברזולוציה גבוהה מדי לזה. מצב סריקה יעזור יותר.';
  }
  $('#enhUndo').hidden = !D.enhBlob;
  openSheet($('#sheetEnhance'));
});
$('#enhAI2').addEventListener('click', () => runAI(2));
$('#enhAI4').addEventListener('click', () => runAI(4));
$('#enhScan').addEventListener('click', runScan);
$('#enhUndo').addEventListener('click', async () => {
  closeSheet(); busy(true, 'מחזיר למקור…');
  const f = D.factor; D.enhBlob = null; D.factor = 1; D.enhKind = null;
  await showImage(D.blob); rescaleItems(1 / f); busy(false); toast('חזרנו לתמונה המקורית');
});

function rescaleItems(k) {
  if (k !== 1) for (const p of D.pages) for (const it of p.items) { it.x *= k; it.y *= k; it.size *= k; }
  V.s /= k; fitS /= k;
  const { W, H } = stageSize(); fitS = Math.max(1e-4, Math.min((W - 24) / D.w, (H - 24) / D.h));
  undoStack = []; redoStack = []; lastSnap = snapshot(); updateUndo();
  buildItems(); render(); saveSoon(true);
}
function baseToCanvas() {
  const c = document.createElement('canvas'); c.width = D.w; c.height = D.h;
  c.getContext('2d').drawImage(D.base, 0, 0); return c;
}
let aiCancel = null;
async function runAI(factor) {
  closeSheet();
  const ctl = { cancelled: false }; aiCancel = ctl;
  busy(true, `<div>מכין את מנוע ה־AI…</div><div class="progress"><i></i></div><button class="sheet-cancel" id="aiStop">ביטול</button>`);
  $('#aiStop').onclick = () => { ctl.cancelled = true; };
  const bar = () => $('#busy .progress i'), label = () => $('#busy .busy-text div');
  try {
    try { ctl.lock = await navigator.wakeLock?.request('screen'); } catch {}
    const ai = await import('./ai.js?v=2');
    const src = baseToCanvas();
    const t0 = performance.now();
    const out = await ai.upscale(src, factor, {
      onStatus: s => { const l = label(); if (l) l.textContent = s; },
      onProgress: (f) => {
        const b = bar(); if (b) b.style.width = Math.round(f * 100) + '%';
        const el = performance.now() - t0, left = f > 0.03 ? (el / f - el) / 1000 : 0;
        const l = label(); if (l) l.textContent = `משפר איכות… ${Math.round(f * 100)}%` + (left > 3 ? ` · עוד כ־${Math.ceil(left)} שניות` : '');
      },
      cancelled: () => ctl.cancelled,
    });
    if (!out) { busy(false); toast('בוטל'); return; }
    const l = label(); if (l) l.textContent = 'שומר…';
    const blob = await canvasToBlob(out, 'image/jpeg', 0.95);
    D.enhBlob = blob; D.factor *= factor; D.enhKind = `AI ×${factor}`;
    await showImage(blob); rescaleItems(factor);
    busy(false); toast(`האיכות שופרה ✨ ⁦${D.w}×${D.h}⁩`, 3200);
  } catch (err) {
    console.error(err); busy(false);
    toast('שיפור ה־AI לא הצליח במכשיר הזה. נסה את מצב סריקה', 3800);
  } finally { aiCancel = null; try { ctl.lock?.release(); } catch {} }
}

async function runScan() {
  closeSheet(); busy(true, 'מנקה את הדף…'); await nextFrame(); await nextFrame();
  try {
    let src = baseToCanvas();
    const out = scanFilter(src);
    const blob = await canvasToBlob(out, 'image/jpeg', 0.93);
    D.enhBlob = blob; D.enhKind = D.enhKind ? D.enhKind + ' + סריקה' : 'סריקה';
    await showImage(blob); rescaleItems(1);
    toast('הדף נוקה – רקע לבן וטקסט חד 📄');
  } catch (e) { console.error(e); toast('לא הצלחתי לעבד את התמונה'); }
  busy(false);
}

// Flatten the paper to white (divide by an estimate of the background), then stretch contrast and sharpen.
function scanFilter(src) {
  const w = src.width, h = src.height;
  const ctx = src.getContext('2d', { willReadFrequently: true });
  const img = ctx.getImageData(0, 0, w, h), d = img.data;
  // background estimate on a small grid: max filter (removes ink) + blur
  const bw = clamp(Math.round(w / 20), 16, 200), bh = Math.max(8, Math.round(bw * h / w));
  const sc = document.createElement('canvas'); sc.width = bw; sc.height = bh;
  const sctx = sc.getContext('2d', { willReadFrequently: true });
  sctx.imageSmoothingQuality = 'high'; sctx.drawImage(src, 0, 0, bw, bh);
  let s = sctx.getImageData(0, 0, bw, bh);
  const pass = (fn, r) => {
    const a = s.data, o = new Uint8ClampedArray(a.length);
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) for (let c = 0; c < 3; c++) {
      let acc = fn === 'max' ? 0 : 0, n = 0;
      for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
        const xx = clamp(x + i, 0, bw - 1), yy = clamp(y + j, 0, bh - 1), v = a[(yy * bw + xx) * 4 + c];
        if (fn === 'max') { if (v > acc) acc = v; } else { acc += v; n++; }
      }
      o[(y * bw + x) * 4 + c] = fn === 'max' ? acc : acc / n;
    }
    for (let i = 3; i < o.length; i += 4) o[i] = 255;
    s = new ImageData(o, bw, bh);
  };
  pass('max', 2); pass('avg', 2); pass('avg', 1);
  sctx.putImageData(s, 0, 0);
  const bgc = document.createElement('canvas'); bgc.width = w; bgc.height = h;
  const bgx = bgc.getContext('2d', { willReadFrequently: true });
  bgx.imageSmoothingQuality = 'high'; bgx.drawImage(sc, 0, 0, w, h);
  const bg = bgx.getImageData(0, 0, w, h).data;
  // normalise + levels
  const LO = 0.30, HI = 0.90;
  const lut = new Uint8ClampedArray(1024);
  for (let i = 0; i < 1024; i++) { const v = i / 1023; const t = clamp((v - LO) / (HI - LO), 0, 1); lut[i] = Math.round(255 * Math.pow(t, 1.15)); }
  for (let i = 0; i < d.length; i += 4) {
    for (let c = 0; c < 3; c++) { const r = d[i + c] / Math.max(24, bg[i + c]); d[i + c] = lut[Math.min(1023, Math.round(r * 1023))]; }
  }
  // gentle unsharp on luminance (3x3)
  const out = new Uint8ClampedArray(d), k = 0.6;
  for (let y = 1; y < h - 1; y++) {
    const row = y * w;
    for (let x = 1; x < w - 1; x++) {
      const i = (row + x) * 4;
      for (let c = 0; c < 3; c++) {
        const v = d[i + c], avg = (d[i - 4 + c] + d[i + 4 + c] + d[i - w * 4 + c] + d[i + w * 4 + c]) / 4;
        out[i + c] = v + k * (v - avg);
      }
    }
  }
  img.data.set(out);
  const oc = document.createElement('canvas'); oc.width = w; oc.height = h;
  oc.getContext('2d').putImageData(img, 0, 0);
  return oc;
}

// ---------- export ----------
// Lay out one text item in output pixels (k = output px per doc unit). Mirrors the CSS: pre-wrap, overflow-wrap:anywhere,
// inline-block shrink-to-fit up to the item's max width, unicode-bidi:plaintext per paragraph.
function textLayout(ctx, it, k) {
  const fs = it.size * k, padX = PAD_X * fs, padY = PAD_Y * fs, lh = LH * fs;
  ctx.font = `${it.bold ? 700 : 400} ${fs}px ${FONT}`;
  const lines = wrapLines(it).map(t => ({ t: t.replace(/\s+$/, ''), rtl: lineRTL(t) }));
  const contentW = Math.max(fs * 0.1, ...lines.map(l => ctx.measureText(l.t).width));
  const rtl = isRTL(it.text);
  const boxW = contentW + 2 * padX, boxH = lines.length * lh + 2 * padY;
  const x = it.x * k, y = it.y * k;
  return { fs, padX, padY, lh, lines, contentW, boxW, boxH, left: rtl ? x + padX - boxW : x - padX, top: y - lh / 2 - padY };
}
function drawItem(ctx, it, k, ox = 0, oy = 0) {
  const L = textLayout(ctx, it, k);
  const left = L.left - ox, top = L.top - oy;
  if (it.bg !== 'none') {
    ctx.fillStyle = it.bg === 'white' ? '#ffffff' : it.bg === 'yellow' ? 'rgba(255,226,64,.72)' : '#111111';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(left, top, L.boxW, L.boxH, RAD * L.fs); else ctx.rect(left, top, L.boxW, L.boxH);
    ctx.fill();
  }
  ctx.fillStyle = it.color; ctx.textBaseline = 'middle';
  L.lines.forEach((l, i) => {
    const cy = top + L.padY + L.lh * (i + 0.5);
    ctx.direction = l.rtl ? 'rtl' : 'ltr'; ctx.textAlign = l.rtl ? 'right' : 'left';
    ctx.fillText(l.t, l.rtl ? left + L.padX + L.contentW : left + L.padX, cy);
  });
  return L;
}
const probe = document.createElement('canvas').getContext('2d');
const lineRTL = l => /[^\s\d\p{P}\p{S}]/u.test(l) ? isRTL(l) : true;
const wrapCache = new Map();
// Line breaks at a fixed reference size: identical on screen at every zoom and in the exported file.
function wrapLines(it) {
  const maxW = itemMaxW(it);
  const key = `${it.text}\u0001${it.size.toFixed(4)}\u0001${it.bold}\u0001${maxW.toFixed(3)}`;
  const c = wrapCache.get(it.id); if (c && c.key === key) return c.lines;
  const k = 100 / it.size, mw = maxW * k;
  probe.font = `${it.bold ? 700 : 400} 100px ${FONT}`;
  const W = t => probe.measureText(t.replace(/\s+$/, '')).width;
  const lines = [];
  for (const para of it.text.split('\n')) {
    let line = '';
    for (const tok of (para.match(/\S+\s*|\s+/g) || [''])) {
      if (W(line + tok) <= mw) { line += tok; continue; }
      if (line.trim()) { lines.push(line); line = ''; }
      if (W(tok) <= mw) { line = tok; continue; }
      for (const ch of tok) { if (line && W(line + ch) > mw) { lines.push(line); line = ''; } line += ch; }
    }
    lines.push(line);
  }
  wrapCache.set(it.id, { key, lines });
  return lines;
}
const textItems = i => D.pages[i].items.filter(it => it.text.trim());
// A text item as its own sharp PNG (for PDF overlays): ~96px letters whatever the page resolution.
async function itemPng(it) {
  let kk = Math.max(96 / it.size, 1);
  let L = textLayout(probe, it, kk);
  const big = Math.max(L.boxW, L.boxH);
  if (big > 4000) { kk *= 4000 / big; L = textLayout(probe, it, kk); }
  const c = document.createElement('canvas');
  c.width = Math.ceil(L.boxW) + 2; c.height = Math.ceil(L.boxH) + 2;
  drawItem(c.getContext('2d'), it, kk, L.left - 1, L.top - 1);
  const png = new Uint8Array(await (await canvasToBlob(c, 'image/png')).arrayBuffer());
  return { png, rect: { x: (L.left - 1) / kk, y: (L.top - 1) / kk, w: c.width / kk, h: c.height / kk } };
}

// Render a page (with text) at k output px per doc unit.
async function renderPageCanvas(i, k, withText = true) {
  const c = document.createElement('canvas');
  if (D.kind === 'image') {
    c.width = Math.round(D.w * k); c.height = Math.round(D.h * k);
    const ctx = c.getContext('2d'); ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(D.base, 0, 0, c.width, c.height);
  } else {
    const page = await D.pdf.getPage(i + 1);
    const vp = page.getViewport({ scale: k });
    c.width = Math.round(vp.width); c.height = Math.round(vp.height);
    const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    await page.render({ canvasContext: ctx, viewport: vp, canvas: c }).promise;
  }
  if (withText) { const ctx = c.getContext('2d'); for (const it of textItems(i)) drawItem(ctx, it, k); }
  return c;
}
async function pageSize(i) {
  if (D.kind === 'image') return { w: D.w, h: D.h };
  const vp = (await D.pdf.getPage(i + 1)).getViewport({ scale: 1 }); return { w: vp.width, h: vp.height };
}
// Scale for an image export: as sharp as the device allows, big enough that the smallest text is readable.
async function imageScale(i) {
  const { w, h } = await pageSize(i);
  const cap = Math.sqrt(MAX_CANVAS_PX / (w * h)) * 0.98;
  const minFs = Math.min(...textItems(i).map(it => it.size), Infinity);
  let k = D.kind === 'image' ? 1 : 3000 / Math.max(w, h);
  if (minFs < Infinity) k = Math.max(k, 40 / minFs);
  return Math.min(k, cap);
}

function loadScript(src) {
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
}
async function pdfLib() { if (!window.PDFLib) await loadScript('vendor/pdf-lib.min.js?v=1'); return window.PDFLib; }

function jpegOrientation(buf) {
  const v = new DataView(buf);
  if (v.byteLength < 4 || v.getUint16(0) !== 0xFFD8) return 0;
  let o = 2;
  while (o + 4 < v.byteLength) {
    const m = v.getUint16(o), len = v.getUint16(o + 2);
    if (m === 0xFFE1 && v.getUint32(o + 4) === 0x45786966) {
      const t = o + 10, le = v.getUint16(t) === 0x4949;
      const ifd = t + v.getUint32(t + 4, le), n = v.getUint16(ifd, le);
      for (let i = 0; i < n; i++) { const e = ifd + 2 + i * 12; if (v.getUint16(e, le) === 0x0112) return v.getUint16(e + 8, le); }
      return 1;
    }
    if ((m & 0xFF00) !== 0xFF00) break;
    o += 2 + len;
  }
  return 1;
}

// Best-quality PDF: the original page untouched (vector PDF / original photo bytes) + each text as a sharp overlay.
async function buildPdf(progress) {
  const { PDFDocument, degrees } = await pdfLib();
  if (D.kind === 'pdf') {
    let doc = null;
    try { doc = await PDFDocument.load(await D.blob.arrayBuffer(), { ignoreEncryption: true }); } catch (e) { console.warn(e); }
    if (doc && doc.getPageCount() === D.pdf.numPages) {
      try {
        for (let i = 0; i < D.pdf.numPages; i++) {
          const list = textItems(i); if (!list.length) continue;
          progress(i);
          const vp = (await D.pdf.getPage(i + 1)).getViewport({ scale: 1 });
          const pg = doc.getPage(i);
          const rot = ((pg.getRotation().angle % 360) + 360) % 360;
          for (const it of list) {
            const { png, rect } = await itemPng(it);
            const img = await doc.embedPng(png);
            const [ax, ay] = vp.convertToPdfPoint(rect.x, rect.y + rect.h); // image's bottom-left as seen on screen
            pg.drawImage(img, { x: ax, y: ay, width: rect.w, height: rect.h, rotate: degrees(rot) });
          }
        }
        return new Blob([await doc.save()], { type: 'application/pdf' });
      } catch (e) { console.warn('overlay failed, using raster', e); }
    }
    // fallback (encrypted / odd PDFs): sharp raster pages + sharp text overlays
    const out = await PDFDocument.create();
    for (let i = 0; i < D.pdf.numPages; i++) {
      progress(i);
      const { w, h } = await pageSize(i);
      const k = Math.min(4.2, Math.sqrt(MAX_CANVAS_PX / (w * h)) * 0.9);
      const c = await renderPageCanvas(i, k, false);
      const img = await out.embedJpg(new Uint8Array(await (await canvasToBlob(c, 'image/jpeg', 0.95)).arrayBuffer()));
      const pg = out.addPage([w, h]); pg.drawImage(img, { x: 0, y: 0, width: w, height: h });
      for (const it of textItems(i)) {
        const { png, rect } = await itemPng(it); const ti = await out.embedPng(png);
        pg.drawImage(ti, { x: rect.x, y: h - rect.y - rect.h, width: rect.w, height: rect.h });
      }
    }
    return new Blob([await out.save()], { type: 'application/pdf' });
  }
  // photo → PDF: embed the photo's original bytes (no recompression) when possible
  progress(0);
  const out = await PDFDocument.create();
  const src = D.enhBlob || D.blob, buf = await src.arrayBuffer();
  let img;
  if (src.type === 'image/png') img = await out.embedPng(buf);
  else if ((src.type === 'image/jpeg' || src.type === 'image/jpg') && jpegOrientation(buf) <= 1) img = await out.embedJpg(buf);
  else {
    const c = document.createElement('canvas'); c.width = D.w; c.height = D.h; c.getContext('2d').drawImage(D.base, 0, 0);
    img = await out.embedJpg(new Uint8Array(await (await canvasToBlob(c, 'image/jpeg', 0.95)).arrayBuffer()));
  }
  const f = 595 / D.w, pw = 595, ph = D.h * f;
  const pg = out.addPage([pw, ph]); pg.drawImage(img, { x: 0, y: 0, width: pw, height: ph });
  for (const it of textItems(0)) {
    const { png, rect } = await itemPng(it); const ti = await out.embedPng(png);
    pg.drawImage(ti, { x: rect.x * f, y: ph - (rect.y + rect.h) * f, width: rect.w * f, height: rect.h * f });
  }
  return new Blob([await out.save()], { type: 'application/pdf' });
}

let EX = null; // { blob, name, type, url }
let exportFmt = localStorage.getItem('ktov-fmt') || 'pdf';
const fileBase = () => (D.name.replace(/[\\/:*?"<>|]+/g, '_') || 'page') + '-AIM';
async function buildExport() {
  busy(true, 'מכין את הדף באיכות מלאה…'); await nextFrame();
  try {
    if (EX?.url) URL.revokeObjectURL(EX.url);
    const { w, h } = await pageSize(D.page);
    const preview = await renderPageCanvas(D.page, 1400 / Math.max(w, h));
    const previewUrl = URL.createObjectURL(await canvasToBlob(preview, 'image/jpeg', 0.85));
    let blob, name, type, info = '';
    if (exportFmt === 'pdf') {
      const n = D.kind === 'pdf' ? D.pdf.numPages : 1;
      blob = await buildPdf(i => { $('#busy .busy-text').textContent = n > 1 ? `מכין PDF… עמוד ${i + 1} מתוך ${n}` : 'מכין PDF…'; });
      type = 'application/pdf'; name = fileBase() + '.pdf';
      info = 'הדף המקורי נשמר בדיוק כמו שהוא, והכיתוב חד בכל הגדלה';
    } else {
      const k = await imageScale(D.page);
      const c = await renderPageCanvas(D.page, k);
      blob = await canvasToBlob(c, 'image/jpeg', 0.95); type = 'image/jpeg';
      name = fileBase() + (D.kind === 'pdf' && D.pdf.numPages > 1 ? `-p${D.page + 1}` : '') + '.jpg';
      info = `⁦${c.width}×${c.height}⁩ · בוואטסאפ תמונות נדחסות – לאיכות מלאה שלח PDF`;
    }
    EX = { blob, name, type, url: previewUrl };
    $('#donePreview').src = previewUrl;
    const mb = blob.size / 1048576;
    $('#doneNote').textContent = `${type === 'application/pdf' ? 'PDF' : 'תמונה'} · ${mb < 1 ? Math.round(blob.size / 1024) + ' KB' : mb.toFixed(1) + ' MB'} · ${info}`;
  } finally { busy(false); }
}
$('#btnDone').addEventListener('click', async () => {
  if (!D) return; deselect();
  const multi = D.kind === 'pdf' && D.pdf.numPages > 1;
  $('#fmtSeg [data-fmt=pdf]').textContent = multi ? 'PDF · כל העמודים · איכות מלאה' : 'PDF · איכות מלאה';
  $('#fmtSeg [data-fmt=page]').textContent = multi ? 'תמונה · העמוד הזה' : 'תמונה';
  $$('#fmtSeg .seg-btn').forEach(b => b.classList.toggle('on', b.dataset.fmt === exportFmt));
  try { await buildExport(); openSheet($('#sheetDone')); } catch (e) { console.error(e); toast('משהו השתבש בהכנת הקובץ'); }
});
$('#fmtSeg').addEventListener('click', async e => {
  const b = e.target.closest('[data-fmt]'); if (!b || b.dataset.fmt === exportFmt) return;
  exportFmt = b.dataset.fmt; localStorage.setItem('ktov-fmt', exportFmt);
  $$('#fmtSeg .seg-btn').forEach(x => x.classList.toggle('on', x === b));
  try { await buildExport(); } catch (err) { console.error(err); toast('משהו השתבש בהכנת הקובץ'); }
});
$('#dShare').addEventListener('click', async () => {
  if (!EX) return;
  const file = new File([EX.blob], EX.name, { type: EX.type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file] }); } catch (e) { if (e.name !== 'AbortError') toast('השיתוף לא הצליח – נסה "שמור בטלפון"'); }
  } else { download(); toast('המכשיר הזה לא תומך בשיתוף ישיר – הקובץ נשמר'); }
});
function download() {
  const a = document.createElement('a'); a.href = URL.createObjectURL(EX.blob); a.download = EX.name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}
$('#dSave').addEventListener('click', () => { if (EX) { download(); toast('נשמר ✔'); } });
$('#dCopy').addEventListener('click', async () => {
  if (!EX) return;
  try {
    if (!window.ClipboardItem || !navigator.clipboard?.write) throw new Error('no clipboard');
    const png = (async () => canvasToBlob(await renderPageCanvas(D.page, await imageScale(D.page)), 'image/png'))();
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
    toast(D.kind === 'pdf' && D.pdf.numPages > 1 ? 'העמוד הנוכחי הועתק כתמונה ✔' : 'הועתק ✔ אפשר להדביק בכל מקום');
  } catch (e) { console.warn(e); toast('ההעתקה לא נתמכת כאן – השתמש בשליחה או בשמירה'); }
});

// ---------- startup ----------
async function boot() {
  const tip = $('#homeTip');
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (!standalone) tip.textContent = isIOS ? 'טיפ: בספארי לחץ על כפתור השיתוף ← "הוסף למסך הבית" כדי שזה יהיה אפליקציה.'
    : 'טיפ: בתפריט הדפדפן בחר "הוסף למסך הבית" / "התקן אפליקציה".';
  else if (!isIOS) tip.textContent = 'אפשר גם לשתף תמונה או PDF מכל אפליקציה ישר ל-AIM Write.';
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  // Android share target: the service worker stores the shared file and reloads with ?shared=1
  if (new URLSearchParams(location.search).has('shared')) {
    history.replaceState(null, '', location.pathname);
    try {
      const cache = await caches.open('ktov-share'); const r = await cache.match('shared-file');
      if (r) { const blob = await r.blob(); const name = decodeURIComponent(r.headers.get('x-name') || 'shared');
        await cache.delete('shared-file'); return openFile(new File([blob], name, { type: blob.type })); }
    } catch (e) { console.warn(e); }
  }
  refreshResume();
}
boot();
