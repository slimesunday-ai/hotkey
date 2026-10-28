// CAMERA PASS · PHOTO MODE: every bit of UI hidden (body.cam-photo), the free camera with photo tuning (slow, heavy, smooth: good
// pans for clips) or the follow camera (F), depth of field (render/dof.js, a post section: B, autofocus by default), and
//   STILLS  Enter: the frame re-rendered offscreen at the chosen format — screen 1× / 2×, 4K 16:9, 9:16 reel, 4:5 feed, 1:1 — through the
//           post stack (so the look, DOF and letterbox are in it) plus the page's CSS grain, as PNG. A format of another aspect shows
//           its frame on screen (the guide) and the still is exactly that crop (camera.setViewOffset), never a squash.
//   CLIPS   R: the canvas, cropped to the format's aspect (long side ≤ photo.clipLong px), grain composited, recorded with MediaRecorder
//           (WebM VP9 → VP8 → WebM → MP4, the first this browser has; it says so when it has none) up to photo.clipMax s; R again stops.
// The photo bar (bottom) shows the format, DOF and focus, and fades after photo.barHide s without the mouse moving (H toggles it);
// while recording a small REC timer stays up. Files download as ai-city-<date>-<time>.png / .webm. Nothing here runs outside photo mode.
import * as THREE from 'three';
import { CAM, savePrefs } from './config.js';
import { DOF_LIVE } from '../render/dof.js';
import * as S from '../render/settings.js';

const CSS = `
#cambar { position: fixed; left: 50%; bottom: 14px; transform: translateX(-50%); z-index: 8; display: flex; gap: 6px; align-items: center; flex-wrap: wrap; justify-content: center; max-width: calc(100vw - 28px);
  font: 800 11px/1 "Arial Black", Impact, sans-serif; letter-spacing: .03em; text-transform: uppercase; transition: opacity .35s; }
#cambar.hide { opacity: 0; pointer-events: none; }
#cambar button, #cambar select { font: inherit; text-transform: uppercase; border: 0; background: #f7f7f2; color: #17171b; padding: 7px 9px 6px; cursor: pointer; box-shadow: 2px 2px 0 #17171b; }
#cambar select { background: #6cff4a; } #cambar button:hover { background: #ffc21a; } #cambar button.on { background: #17171b; color: #ffc21a; box-shadow: 2px 2px 0 #ffc21a; }
#cambar button.rec { background: #e8232a; color: #fff; } #cambar button:focus-visible, #cambar select:focus-visible { outline: 3px solid #ff4fa3; outline-offset: 2px; }
#cambar .info { background: #17171b; color: #9fdcff; padding: 7px 9px 6px; font: 600 11px/1 ui-monospace, Menlo, monospace; text-transform: none; }
#camrec { position: fixed; right: 14px; top: 14px; z-index: 8; background: #17171b; color: #fff; padding: 7px 10px 6px; font: 800 12px/1 "Arial Black", Impact, sans-serif; box-shadow: 3px 3px 0 #e8232a; }
#camrec::before { content: ""; display: inline-block; width: 9px; height: 9px; border-radius: 50%; background: #e8232a; margin-right: 7px; animation: camrec 1s steps(2) infinite; }
@keyframes camrec { 50% { opacity: 0; } } @media (prefers-reduced-motion: reduce) { #camrec::before { animation: none; } }
#camrec[hidden], #cambar[hidden], #camguide[hidden] { display: none; }
#camguide { position: fixed; z-index: 4; pointer-events: none; box-shadow: 0 0 0 200vmax rgba(12, 12, 16, .5); outline: 1px solid rgba(255, 255, 255, .55); }
#camflash { position: fixed; inset: 0; z-index: 7; background: #fff; opacity: 0; pointer-events: none; transition: opacity .45s; }
#camflash.on { opacity: .55; transition: none; }
`;
const MIMES = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4;codecs=avc1', 'video/mp4'];
const stamp = () => { const d = new Date(), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`; };

export function createPhoto(api, rig, hud) {
  const { camera, renderer } = api; let on = false, built = false, bar, recEl, guide, flash, fmtSel, dofBtn, info, recBtn, barT = 0, barOn = true, rec = null, grain = null;
  const V2 = new THREE.Vector2(); const fmts = () => Object.keys(CAM.photo.formats);
  if (!fmts().includes(CAM.photo.format)) CAM.photo.format = 'screen 2×';
  function build() { if (built) return; built = true; const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
    bar = h('div'); bar.id = 'cambar'; bar.setAttribute('role', 'toolbar'); bar.setAttribute('aria-label', 'Photo');
    fmtSel = h('select'); fmtSel.setAttribute('aria-label', 'Format'); for (const f of fmts()) { const o = h('option', null, f); o.value = f; fmtSel.append(o); } fmtSel.value = CAM.photo.format;
    fmtSel.onchange = () => { setFormat(fmtSel.value); fmtSel.blur(); };
    const b = (label, fn, title) => { const e = h('button', null, label); e.type = 'button'; e.title = title; e.onclick = () => { fn(); e.blur(); }; bar.append(e); return e; };
    bar.append(fmtSel); dofBtn = b('DOF', () => toggleDof(), 'depth of field (B)'); info = h('span', 'info', ''); bar.append(info);
    b('Still ⏎', () => still(), 'save a still at the format (Enter)'); recBtn = b('● Rec', () => toggleRec(), 'record a clip (R)'); b('Exit', () => rig.setMode('photo'), 'leave photo mode (Esc)');
    recEl = h('div'); recEl.id = 'camrec'; recEl.hidden = true; guide = h('div'); guide.id = 'camguide'; guide.hidden = true; flash = h('div'); flash.id = 'camflash';
    document.body.append(guide, bar, recEl, flash);
    addEventListener('mousemove', () => { if (on) showBar(); }); addEventListener('resize', () => on && layout());
  }
  const showBar = () => { barT = CAM.photo.barHide; if (barOn) bar.classList.remove('hide'); };
  function setFormat(f) { CAM.photo.format = f; if (fmtSel) fmtSel.value = f; savePrefs(); layout(); hud.toast(f + (CAM.photo.formats[f] ? ' · ' + CAM.photo.formats[f].join('×') : ''), 1.2); }
  // the crop of the screen (CSS px) a format frames: the largest rect of its aspect, centred
  function crop(f = CAM.photo.format) { renderer.getSize(V2); const W = V2.x, H = V2.y, d = CAM.photo.formats[f]; if (!d) return { x: 0, y: 0, w: W, h: H, W, H, full: true };
    const a = d[0] / d[1]; let w = W, h = W / a; if (h > H) { h = H; w = H * a; } return { x: (W - w) / 2, y: (H - h) / 2, w, h, W, H, full: false }; }
  function layout() { if (!guide) return; const c = crop(), r = renderer.domElement.getBoundingClientRect(); guide.hidden = !on || c.full;
    Object.assign(guide.style, { left: r.left + c.x + 'px', top: r.top + c.y + 'px', width: c.w + 'px', height: c.h + 'px' }); }
  function outSize(f = CAM.photo.format) { const d = CAM.photo.formats[f]; if (d) return d.slice(); renderer.getSize(V2); const k = f.includes('2×') ? 2 : 1, dpr = Math.min(devicePixelRatio || 1, 2); return [Math.round(V2.x * k * dpr), Math.round(V2.y * k * dpr)]; }
  function toggleDof(v) { const s = S.get('dof'); if (!s) { hud.toast('depth of field unavailable'); return; } const want = v ?? !s.on; S.set('dof', 'on', want); api.post.ready?.(); hud.toast('depth of field ' + (want ? 'on · autofocus ' + (s.auto ? 'on' : 'off') : 'off'), 1.4); }
  function focusStep(f) { const s = S.get('dof'); if (!s) return; const cur = DOF_LIVE.focus ?? s.focus; if (s.auto) S.set('dof', 'auto', false); if (!s.on) S.set('dof', 'on', true);
    S.set('dof', 'focus', Math.max(.5, Math.min(800, +(cur * f).toFixed(2)))); }
  async function grainImg() { if (grain !== null) return grain; grain = false; const g = document.querySelector('.grain'); if (!g) return grain; const m = /url\("?(.*?)"?\)/.exec(getComputedStyle(g).backgroundImage); if (!m) return grain;
    const img = new Image(); img.src = m[1]; try { await img.decode(); grain = img; } catch { grain = false; } return grain; }
  function addGrain(ctx, w, h, perCss) { const g = document.querySelector('.grain'); if (!g || !grain) return; const cs = getComputedStyle(g); if (cs.display === 'none' || !(+cs.opacity > 0)) return;
    const tile = parseFloat(cs.backgroundSize) || 160, pat = ctx.createPattern(grain, 'repeat'), s = perCss * tile / grain.width; pat.setTransform(new DOMMatrix().scale(s, s));
    ctx.save(); ctx.globalAlpha = +cs.opacity; ctx.globalCompositeOperation = 'overlay'; ctx.fillStyle = pat; ctx.fillRect(0, 0, w, h); ctx.restore(); }
  // ── a still: re-render the frame at the format's size through the post stack, read it back in the same task, restore
  async function capture(f = CAM.photo.format) {
    await grainImg(); let [w, h] = outSize(f); const gl = renderer.getContext(), max = Math.min(renderer.capabilities.maxTextureSize, gl.getParameter(gl.MAX_RENDERBUFFER_SIZE), ...gl.getParameter(gl.MAX_VIEWPORT_DIMS));
    let note = ''; if (w > max || h > max) { const k = max / Math.max(w, h); w = Math.floor(w * k); h = Math.floor(h * k); note = ` (capped at ${max} px by this GPU)`; }
    const c = crop(f), k = w / c.w, pr = renderer.getPixelRatio(); renderer.getSize(V2); const sw = V2.x, sh = V2.y, t0 = performance.now();
    const out = document.createElement('canvas'); out.width = w; out.height = h; const ctx = out.getContext('2d');
    try { renderer.setPixelRatio(1); renderer.setSize(w, h, false); camera.setViewOffset(c.W * k, c.H * k, c.x * k, c.y * k, w, h); camera.updateProjectionMatrix();
      renderer.info.reset(); api.post.render(performance.now() / 1000, null); ctx.drawImage(renderer.domElement, 0, 0, w, h); }
    finally { camera.clearViewOffset(); camera.updateProjectionMatrix(); renderer.setSize(sw, sh, false); renderer.setPixelRatio(pr); }
    addGrain(ctx, w, h, k); return { canvas: out, w, h, ms: Math.round(performance.now() - t0), note };
  }
  async function still() {
    try { const r = await capture(); flash.classList.add('on'); requestAnimationFrame(() => flash.classList.remove('on'));
      const blob = await new Promise(res => r.canvas.toBlob(res, 'image/png')), name = `ai-city-${stamp()}.png`; download(blob, name);
      api.cam.lastStill = { name, w: r.w, h: r.h, bytes: blob.size, ms: r.ms, format: CAM.photo.format }; hud.toast(`saved ${name} · ${r.w}×${r.h}${r.note}`, 2.6); return api.cam.lastStill; }
    catch (e) { console.warn('photo: still failed', e); hud.toast('still failed: ' + (e.message || e)); return null; }
  }
  const download = (blob, name) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); };
  // ── clips
  async function toggleRec() {
    if (rec) { rec.mr.state !== 'inactive' && rec.mr.stop(); return; }
    const mime = typeof MediaRecorder !== 'undefined' ? MIMES.find(m => MediaRecorder.isTypeSupported(m)) : null;
    if (!mime) { hud.toast('clip recording isn’t supported in this browser (no MediaRecorder WebM or MP4)', 3.5); return; }
    await grainImg(); const c = crop(); renderer.getDrawingBufferSize(V2); const s = V2.x / c.W; let w = c.w * s, h = c.h * s; const L = CAM.photo.clipLong, k = Math.min(1, L / Math.max(w, h));
    w = Math.round(w * k / 2) * 2; h = Math.round(h * k / 2) * 2;
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const ctx = cv.getContext('2d', { alpha: false }), stream = cv.captureStream(CAM.photo.clipFps);
    const mr = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: CAM.photo.clipBitrate }), chunks = [];
    mr.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    mr.onstop = () => { const r = rec; rec = null; recEl.hidden = true; recBtn.classList.remove('rec'); recBtn.textContent = '● Rec'; stream.getTracks().forEach(t => t.stop());
      const ext = mime.startsWith('video/mp4') ? 'mp4' : 'webm', blob = new Blob(chunks, { type: mime.split(';')[0] }), name = `ai-city-${stamp()}.${ext}`; download(blob, name);
      api.cam.lastClip = { name, w, h, bytes: blob.size, secs: +r.t.toFixed(2), frames: r.frames, mime }; hud.toast(`saved ${name} · ${w}×${h} · ${r.t.toFixed(1)} s`, 3); };
    rec = { mr, cv, ctx, t: 0, frames: 0, w, h, mime }; mr.start(250); recEl.hidden = false; recBtn.classList.add('rec'); recBtn.textContent = '■ Stop'; hud.toast(`recording ${w}×${h} · ${mime.split(';')[0]} · R stops`, 1.8);
  }
  function afterRender() { if (!rec) return; const c = crop(); renderer.getDrawingBufferSize(V2); const s = V2.x / c.W;
    rec.ctx.drawImage(renderer.domElement, c.x * s, c.y * s, c.w * s, c.h * s, 0, 0, rec.w, rec.h); addGrain(rec.ctx, rec.w, rec.h, rec.w / c.w); rec.frames++; }
  return {
    enter() { build(); on = true; document.body.classList.add('cam-photo'); bar.hidden = false; barOn = true; showBar(); layout();
      const rb = document.querySelector('[data-render].on'); if (rb) rb.click();   // (the render panel closes; \ opens it again on top)
      hud.toast('photo · Enter still · R clip · B depth of field · V format · H bar · Esc back', 2.6); },
    exit() { if (!on) return; on = false; if (rec && rec.mr.state !== 'inactive') rec.mr.stop(); document.body.classList.remove('cam-photo'); if (bar) bar.hidden = true; if (guide) guide.hidden = true; },
    onKey(e) { const k = e.code;
      if (k === 'Enter' || k === 'NumpadEnter') { e.preventDefault(); still(); return true; }
      if (k === 'KeyR') { toggleRec(); return true; } if (k === 'KeyB') { toggleDof(); return true; }
      if (k === 'KeyV') { const F = fmts(); setFormat(F[(F.indexOf(CAM.photo.format) + (e.shiftKey ? F.length - 1 : 1)) % F.length]); return true; }
      if (k === 'KeyH') { barOn = !barOn; bar.classList.toggle('hide', !barOn); return true; }
      if (k === 'BracketLeft' || k === 'BracketRight') { focusStep(k === 'BracketLeft' ? .85 : 1.18); return true; }
      return false; },
    tick(dt) { if (!on) return; if (barT > 0 && (barT -= dt) <= 0 && !rec) bar.classList.add('hide');
      if (rec) { rec.t += dt; recEl.textContent = `REC ${Math.floor(rec.t / 60)}:${String(Math.floor(rec.t % 60)).padStart(2, '0')}`; if (rec.t >= CAM.photo.clipMax && rec.mr.state === 'recording') rec.mr.stop(); }
      if ((rig.frameNo = (rig.frameNo || 0) + 1) % 10) return; const s = S.get('dof'); dofBtn.classList.toggle('on', !!s?.on);
      const f = DOF_LIVE.focus ?? s?.focus; info.textContent = `${Math.round(camera.fov)}° · ${s?.on ? `focus ${f >= 10 ? Math.round(f) : f.toFixed(1)} m${s.auto ? ' auto' : ''}` : 'dof off'}${rig.photoSub === 'follow' ? ' · following' : ''}`; },
    afterRender, still, capture, toggleRec, setFormat, crop, get on() { return on; }, get recording() { return !!rec; },
  };
}
