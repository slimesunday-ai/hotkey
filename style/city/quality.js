// Quality presets + dynamic resolution (pass 1c). ?q=low|medium|high|auto (default auto).
//   draw: draw distance (m) · near/mid: tier radii (m) · maxNear/maxMid: block budgets · char*: character tier radii and the cap on
//   full chars.js bodies · shadow: sun shadow map size · shadowEvery: re-render the (cached) shadow map every N frames while things move
//   dpr: pixel-ratio ceiling · minScale: how far dynamic resolution may drop (× dpr) · uploadVerts: GPU upload budget per frame
// Streaming pass:
//   uploadMs: main-thread ms per frame for new meshes · behind: past this distance a block out of view drops to its far tier (default
//   1.5 × near; the strong preset keeps every block at its distance tier, so turning round never waits) · ahead: prefetch looks this
//   many seconds along the camera's velocity · reads: baked records decoded at once · preload: what the load-in fetches from the bake
//   ('all': every tier of every block — the strong preset; 'mid': far + mid tiers of the whole city, full detail round the start)
//   high is the strong-machine preset (Apple M Max / Ultra, discrete GPUs): 64 blocks of full detail out to 150 m (medium: 6 to 70 m),
//   mid detail to 460 m (past the haze, so the far massing is never what a visible block shows)
export const PRESETS = {
  low: { draw: 330, near: 48, maxNear: 3, mid: 200, maxMid: 26, charNear: 24, charFull: 24, charMid: 70, charFar: 170, shadow: 1024, shadowEvery: 4, dpr: 1, minScale: .6, aa: false, uploadVerts: 250000, uploadMs: 3, fog: 1, ahead: 2, reads: 12, preload: 'mid' },
  medium: { draw: 460, near: 70, maxNear: 6, mid: 270, maxMid: 40, charNear: 34, charFull: 60, charMid: 100, charFar: 250, shadow: 2048, shadowEvery: 2, dpr: 1.5, minScale: .6, aa: true, uploadVerts: 450000, uploadMs: 4, fog: 1, ahead: 2, reads: 16, preload: 'mid' },
  high: { draw: 640, near: 150, maxNear: 64, mid: 460, maxMid: 400, behind: 1e9, charNear: 46, charFull: 120, charMid: 140, charFar: 330, shadow: 4096, shadowEvery: 1, dpr: 2, minScale: .7, aa: true, uploadVerts: 2000000, uploadMs: 6, fog: 1, ahead: 2.5, reads: 32, preload: 'all' },
};
// auto: read the GPU string where the browser exposes it, then let dynamic resolution do the rest
export function autoPreset() {
  let gpu = ''; try { const c = document.createElement('canvas'), gl = c.getContext('webgl2'), ext = gl && gl.getExtension('WEBGL_debug_renderer_info'); gpu = gl ? String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)) : ''; gl?.getExtension('WEBGL_lose_context')?.loseContext(); } catch {}
  const g = gpu.toLowerCase(); let name = 'medium';
  if (/(m\d+ (max|ultra))|rtx|radeon rx|radeon pro|arc a|geforce gtx 1[6-9]|quadro/.test(g)) name = 'high';   // (streaming pass: an M Pro laptop now takes medium: high is 5× the near detail)
  else if (/intel|uhd|iris|mali|adreno|powervr|swiftshader|llvmpipe|radeon\(tm\) graphics|vega \d graphics/.test(g)) name = 'low';
  else if (/apple m\d|apple gpu/.test(g)) name = 'medium';
  return { name, gpu };
}
export function resolvePreset(q) { if (q && PRESETS[q]) return { name: q, gpu: autoPreset().gpu, auto: false }; const a = autoPreset(); return { ...a, auto: true }; }

// dynamic resolution: GPU time from EXT_disjoint_timer_query_webgl2 when available (exact), else the frame interval (catches overload
// only, since rAF is vsync-locked). Drops the pixel ratio in steps when frames run long, climbs back when there is headroom.
// V3 (render review 2026-10-09) · it dropped on short spikes and climbed back only where full resolution was cheap. Now:
//   drop    on a TRIMMED mean of the last 30 GPU samples (the middle 20) over the budget: up to 5 spikes in it count for nothing (it
//           was the mean of 20, where one spike from a load or a tier swap could tip it)
//   climb   when the next step is predicted to fit: mean of 60 × ((s + .05) / s)² < 0.8 × budget. A step adds ~10 % of the pixels; it
//           used to need the current step under 0.55 × budget (8.5 ms), so views costing 11–15 ms at full resolution stayed below 1.
//   clean   a frame that uploaded over 1 MB or linked a shader program is not a sample (the GL upload and link calls are counted);
//           after 30 of them in a row they count again, so a steady load can't starve the controller
//   no timer  (Safari, Firefox; a timer that stopped answering) the frame interval drops on its median and can climb now: after 2 s at
//           the display's rate a step up is a probe, undone if frames then run long, and each failed probe doubles the wait (3 → 60 s).
//           It used to never climb: one drop lasted the visit.
//   restore()  re-gets the extension and drops the lost context's queries (main.js calls it on webglcontextrestored: they never
//           resolved, `pend` grew a query a frame and the scale froze)
export function createDynRes(renderer, preset, o = {}) {
  const gl = renderer.getContext(), base = Math.min(preset.dpr, o.dpr ?? devicePixelRatio), TQ = 'EXT_disjoint_timer_query_webgl2';
  let ext = gl.getExtension(TQ), scale = 1, q = null, pend = [], gpuMs = [], frameMs = [], last = performance.now(), cool = 0, enabled = o.enabled !== false;
  let bytes = 0, links = 0, lastDirty = false, dirtyRun = 0, sinceGpu = 0, probe = null, wait = 3000, probeAt = 0;
  const budget = o.budget ?? 15.5, DIRTY = 1 << 20, apply = () => renderer.setPixelRatio(Math.max(.5, base * scale));
  const avg = a => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length), qtl = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };
  const trim = a => avg(a.slice().sort((x, y) => x - y).slice(5, -5));   // (the mean of the middle 20 of 30: blind to 5 spikes, steadier than a median)
  const step = (d, c) => { scale = Math.min(1, Math.max(preset.minScale, +(scale + d).toFixed(2))); apply(); cool = c; gpuMs.length = 0; frameMs.length = 0; };
  // what a frame uploaded and linked: GL's upload calls and linkProgram, counted (begin() resets the counts; end() judges the frame)
  const bytesOf = (n, a) => { if (n === 'bufferData' && typeof a[1] === 'number') return a[1];
    if (n === 'bufferSubData') { const s = a[2], e = s?.BYTES_PER_ELEMENT || 1; return a.length >= 5 ? a[4] * e : a.length === 4 ? (s.length - a[3]) * e : s?.byteLength || 0; }
    for (const x of a) if (x && typeof x === 'object') return x.byteLength ?? (x.width || 0) * (x.height || 0) * 4;
    return 0; };
  for (const n of ['bufferData', 'bufferSubData', 'texImage2D', 'texSubImage2D', 'texImage3D', 'texSubImage3D', 'compressedTexImage2D', 'compressedTexSubImage2D']) {
    const f = gl[n]; if (typeof f === 'function') gl[n] = function (...a) { bytes += bytesOf(n, a); return f.apply(this, a); }; }
  { const f = gl.linkProgram; if (typeof f === 'function') gl.linkProgram = function (...a) { links++; return f.apply(this, a); }; }
  apply();
  return {
    get scale() { return scale; }, get ratio() { return Math.max(.5, base * scale); }, get gpu() { return gpuMs.length ? gpuMs[gpuMs.length - 1] : null; },
    get timer() { return !!ext; }, get pending() { return pend.length; }, get mode() { return ext && sinceGpu < 120 ? 'gpu' : 'frame'; },
    begin() { bytes = 0; links = 0; if (!ext || q) return; q = gl.createQuery(); if (q) gl.beginQuery(ext.TIME_ELAPSED_EXT, q); },
    end() { const dirty = bytes > DIRTY || links > 0; lastDirty = dirty; if (!ext || !q) return; gl.endQuery(ext.TIME_ELAPSED_EXT); pend.push([q, dirty]); q = null;
      while (pend.length && gl.getQueryParameter(pend[0][0], gl.QUERY_RESULT_AVAILABLE)) { const [qq, d] = pend.shift();
        if (!gl.getParameter(ext.GPU_DISJOINT_EXT)) { sinceGpu = 0; dirtyRun = d ? dirtyRun + 1 : 0; if (!d || dirtyRun > 30) gpuMs.push(gl.getQueryParameter(qq, gl.QUERY_RESULT) / 1e6); }
        gl.deleteQuery(qq); }
      if (pend.length > 30) for (const [qq] of pend.splice(0, pend.length - 30)) gl.deleteQuery(qq);
      if (gpuMs.length > 120) gpuMs.splice(0, gpuMs.length - 120); },
    frame(now, busy = false) { const dt = now - last, dirty = lastDirty; last = now; lastDirty = false; sinceGpu++;
      if (busy) { cool = Math.max(cool, 30); gpuMs.length = 0; frameMs.length = 0; return; }   // (streaming: the samples after it start fresh)
      if (dt < 200 && !dirty) frameMs.push(dt); if (frameMs.length > 120) frameMs.shift(); if (!enabled || --cool > 0) return;
      const s = scale;
      if (ext && sinceGpu < 120) {   // the GPU timer: trust it (long CPU frames aren't fixed by resolution)
        const n = gpuMs.length, long = n >= 30 && trim(gpuMs.slice(-30)) > budget, room = n >= 60 && avg(gpuMs.slice(-60)) * ((s + .05) / s) ** 2 < budget * .8;
        if (long && s > preset.minScale) step(-.1, 40); else if (room && s < 1) step(.05, 90);
        return; }
      // the frame interval: drops on its median; a climb is a probe (vsync hides headroom), undone if frames run long after it
      const m = frameMs.length; if (m < 30) return;
      const long = qtl(frameMs.slice(-30), .5) > budget * 1.25;
      if (probe) { if (long) { step(probe.from - s, 40); wait = Math.min(60000, wait * 2); probeAt = now + wait; probe = null; return; }
        if (now - probe.t > 1500) { probe = null; wait = 3000; } }
      if (long && s > preset.minScale) { step(-.1, 40); probeAt = Math.max(probeAt, now + wait); return; }
      if (s < 1 && !probe && now >= probeAt && m >= 120) { const vs = qtl(frameMs, .2), miss = frameMs.filter(x => x > vs * 1.5).length / m;
        if (miss < .05) { probe = { t: now, from: s }; step(.05, 30); } } },
    restore() { ext = gl.getExtension(TQ); pend = []; q = null; gpuMs.length = 0; frameMs.length = 0; sinceGpu = 0; probe = null; cool = Math.max(cool, 60); },
    samples: () => ({ gpu: gpuMs.slice(), frame: frameMs.slice() }), setEnabled(v) { enabled = v; }, resetBase(p) { preset = p; apply(); },
  };
}
