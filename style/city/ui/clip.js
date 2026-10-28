// HUMAN LAYER · SECTION 2b · CLIPS: cut a range of the city and save it as a webm.
//   recorder(canvas)   MediaRecorder on any canvas (WebM VP9 → VP8 → WebM → MP4, the first this browser has: camera/photo.js's order).
//                      The diary room records its own canvas with it.
//   the city clip      the city's canvas, copied after every render into a 2D canvas (≤ 1280 px on the long side) — the same move as the
//                      photo mode's clips (camera/photo.js afterRender): the copy happens in the same task as the render, so no
//                      preserveDrawingBuffer. With "burn in" on, the UI the viewer sees goes in too: the camcorder OSD (lens, the game
//                      time), and every overlay element marked [data-burn] (the trails' time tags) and the tape's thought bubbles and deal chips (2a: .tp-think, .tp-deal) drawn as
//                      boxes with their text at their place on screen.
//   in / out           with the tape player (ui/tape/state.js, 2a): I sets the in mark and O the out mark at the tape's time (shown on
//                      2a's timeline when it exposes marks), and Save cut plays the tape from in to out while recording. Without the tape:
//                      the Clip button records the next N seconds of the screen.
// Nothing runs while not recording: the render hook returns at once.
import { h, set, attr, button, toast, getRoot } from './kit.js';

export const MIMES = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4;codecs=avc1', 'video/mp4'];
export const pickMime = () => typeof MediaRecorder !== 'undefined' ? MIMES.find(m => MediaRecorder.isTypeSupported(m)) || null : null;
export const stamp = () => { const d = new Date(), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`; };
export function download(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
// a recorder on a canvas: start() → stop() resolves to { blob, mime, secs, bytes }
export function recorder(canvas, { fps = 30, bitrate = 6e6 } = {}) {
  const mime = pickMime(); if (!mime) return null;
  const stream = canvas.captureStream(fps), mr = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: bitrate }), chunks = []; let t0 = 0;
  mr.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
  return { mime, ext: mime.startsWith('video/mp4') ? 'mp4' : 'webm', get recording() { return mr.state === 'recording'; },
    start() { t0 = performance.now(); mr.start(250); },
    stop() { return new Promise(res => { if (mr.state === 'inactive') return res(null); mr.onstop = () => { stream.getTracks().forEach(t => t.stop()); const blob = new Blob(chunks, { type: mime.split(';')[0] }); res({ blob, mime, secs: +((performance.now() - t0) / 1000).toFixed(2), bytes: blob.size }); }; mr.stop(); }); } };
}
// ── burning the overlay in: boxes with text, at their place on screen, in their own colours
export function burnDom(ctx, els, k = 1) {
  for (const el of els) { const r = el.getBoundingClientRect(); if (!r.width || r.right < 0 || r.bottom < 0 || r.left > innerWidth || r.top > innerHeight) continue;
    const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) continue;
    const bg = cs.backgroundColor, bl = parseFloat(cs.borderLeftWidth) || 0, rad = Math.min(8, parseFloat(cs.borderTopLeftRadius) || 0) * k;
    ctx.save(); ctx.globalAlpha = +cs.opacity || 1;
    if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') { ctx.fillStyle = bg; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(r.left * k, r.top * k, r.width * k, r.height * k, rad) : ctx.rect(r.left * k, r.top * k, r.width * k, r.height * k); ctx.fill(); }
    if (bl) { ctx.fillStyle = cs.borderLeftColor; ctx.fillRect(r.left * k, r.top * k, bl * k, r.height * k); }
    ctx.fillStyle = cs.color; ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${parseFloat(cs.fontSize) * k}px ${cs.fontFamily}`; ctx.textBaseline = 'middle';
    const pl = (parseFloat(cs.paddingLeft) || 0) + bl, text = el.innerText.replace(/\s+/g, ' ').trim(), maxW = (r.width - pl - (parseFloat(cs.paddingRight) || 0)) * k;
    const lines = wrap(ctx, text, Math.max(20, maxW)), lh = (parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.25) * k, top = r.top * k + (r.height * k - lines.length * lh) / 2 + lh / 2;
    lines.forEach((l, i) => ctx.fillText(l, r.left * k + pl * k, top + i * lh)); ctx.restore(); }
}
export function wrap(ctx, text, w) { const out = []; let line = ''; for (const word of String(text).split(' ')) { const t = line ? line + ' ' + word : word; if (ctx.measureText(t).width > w && line) { out.push(line); line = word; } else line = t; } if (line) out.push(line); return out; }
const tok = (cs, k, d) => cs.getPropertyValue(k).trim() || d;

// ── the city clip
export function createClips({ api, sim, tape = null }) {
  const { renderer } = api, root = getRoot();
  let rec = null, cv = null, ctx = null, burn = true, secs = 10, marks = { in: null, out: null }, hooked = false;
  // the render hook (once): after the post stack renders, copy the frame while it is still in the drawing buffer
  function hook() { if (hooked || !api.post?.render) return; hooked = true; const r0 = api.post.render; api.post.render = function (...a) { const out = r0.apply(this, a); if (rec) try { frame(); } catch (e) { console.warn('[clip]', e); } return out; }; }
  function frame() {
    const s = cv.width / innerWidth; ctx.drawImage(renderer.domElement, 0, 0, cv.width, cv.height);
    if (!burn) return; burnDom(ctx, root.querySelectorAll('[data-burn], .tp-think, .tp-deal'), s); osd(ctx, cv.width, cv.height); rec.frames++;
  }
  function osd(g, W, H) {
    const cs = getComputedStyle(root), L = sim.lens === 'archive' ? 'archive' : tape?.active ? 'tape' : 'live', c = sim.clock(), t = L === 'tape' && tape?.time ? tape.time() : c?.t;
    const col = L === 'live' ? tok(cs, '--k-live', '#52ff86') : L === 'tape' ? tok(cs, '--k-tape', '#ffb62e') : tok(cs, '--k-archive', '#a4b6cc'), u = Math.max(1, H / 540);
    const disp = tok(cs, '--k-font-display', 'monospace'), mono = tok(cs, '--k-font-mono', 'monospace');
    g.save(); g.textBaseline = 'top'; g.shadowColor = 'rgba(0,0,0,.85)'; g.shadowOffsetY = 2 * u; g.shadowBlur = 0;
    g.font = `400 ${26 * u}px ${disp}`; g.fillStyle = col; const tag = L === 'tape' ? '▶ TAPE' : L === 'live' ? '● LIVE' : '▶ ARCHIVE'; g.fillText(tag, 22 * u, 18 * u);
    if (t != null) { const d = Math.floor(t / 1440) + 1, m = Math.floor(t % 1440), ss = Math.floor((t % 1) * 60), p = n => String(n).padStart(2, '0'); g.font = `400 ${28 * u}px ${mono}`; g.fillStyle = '#fff'; g.textAlign = 'right';
      g.fillText(`DAY ${d}  ${p(Math.floor(m / 60))}:${p(m % 60)}:${p(ss)}`, W - 22 * u, H - 44 * u); }
    g.restore();
  }
  async function start({ seconds = secs, burnIn = burn } = {}) {
    if (rec) return null; hook(); burn = burnIn;
    const ds = new api.THREE.Vector2(); renderer.getDrawingBufferSize(ds); const k = Math.min(1, 1280 / Math.max(ds.x, ds.y)); cv = document.createElement('canvas'); cv.width = Math.round(ds.x * k / 2) * 2; cv.height = Math.round(ds.y * k / 2) * 2;
    ctx = cv.getContext('2d', { alpha: false }); const R = recorder(cv, { fps: 30, bitrate: 4e6 }); if (!R) { toast('Clips need MediaRecorder (WebM or MP4): this browser has neither'); return null; }
    rec = { R, frames: 0, t0: performance.now(), seconds }; R.start(); sync();
    return new Promise(res => { rec.done = res; rec.timer = setTimeout(() => stop(), seconds * 1000); });
  }
  async function stop({ save = true } = {}) {
    if (!rec) return null; const r = rec; clearTimeout(r.timer); const out = await r.R.stop(); rec = null; sync(); if (!out) { r.done?.(null); return null; }
    const name = `ai-city-clip-${stamp()}.${r.R.ext}`; const res = { ...out, name, w: cv.width, h: cv.height, frames: r.frames }; last = res;
    if (save) download(out.blob, name); toast(`Saved ${name} · ${out.secs.toFixed(1)} s`); r.done?.(res); return res;
  }
  // in / out on the tape: record from in to out while the tape plays it (2a's tape: seek, play, time)
  async function cut() {
    if (!tape?.active || marks.in == null || marks.out == null || marks.out <= marks.in) { toast('Set an in mark (I) and an out mark (O) on the tape first'); return null; }
    tape.seek?.(marks.in); await new Promise(r => setTimeout(r, 400)); tape.play?.();
    const rate = (typeof tape.rate === 'function' ? tape.rate() : tape.rate) || sim.clock()?.speed || 1.6, seconds = Math.min(60, Math.max(1, (marks.out - marks.in) / rate));
    const p = start({ seconds }); const res = await p; tape.pause?.(); return res;
  }
  function mark(which) { if (!tape?.active) { toast('In and out marks are for the tape'); return; } const t = tape.time(); marks[which] = t; tape.mark?.(which, t); sync(); toast(`${which === 'in' ? 'In' : 'Out'} at Day ${Math.floor(t / 1440) + 1} ${String(Math.floor(t % 1440 / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`); }
  let last = null;
  // ── the button group (in the toys bar)
  const recBtn = button('Clip', { tip: `Record the next ${secs} s of the screen (K)`, cls: 'cl-rec', onclick: () => rec ? stop() : start() });
  const lenSel = h('select', { class: 'cl-len', 'aria-label': 'Clip length', onchange: e => { secs = +e.target.value; attr(recBtn, 'data-tip', `Record the next ${secs} s of the screen (K)`); e.target.blur(); } }, ...[5, 10, 20, 30].map(n => h('option', { value: n, selected: n === secs ? '' : null }, n + ' s')));
  const burnBtn = h('button', { type: 'button', class: 'k-btn cl-burn', 'aria-pressed': 'true', 'data-tip': 'Burn the overlay into the clip (OSD, tags, bubbles)', onclick: () => { burn = !burn; sync(); } }, 'OSD');
  const cutBtn = button('Save cut', { tip: 'Record the tape from the in mark to the out mark', cls: 'cl-cut', onclick: () => cut() }); cutBtn.hidden = true;
  const el = h('div', { class: 'cl-bar', role: 'toolbar', 'aria-label': 'Clip' }, recBtn, lenSel, burnBtn, cutBtn);
  function sync() { recBtn.classList.toggle('is-rec', !!rec); set(recBtn.querySelector('.k-btn-label'), rec ? 'Stop' : 'Clip'); attr(burnBtn, 'aria-pressed', String(burn)); cutBtn.hidden = !(tape?.active && marks.in != null && marks.out != null); }
  if (tape?.on) tape.on('mode', () => sync());
  return { el, start, stop, cut, mark, get recording() { return !!rec; }, get last() { return last; }, get marks() { return { ...marks }; }, setBurn(b) { burn = !!b; sync(); }, sync };
}
