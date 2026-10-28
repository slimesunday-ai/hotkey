// Render pipeline pass · THE POST STACK. createPost(renderer, scene, camera, { night, blur, aa }) registers the tone-mapping section, one
// section per effect (fx.js) and the stack order, and returns render(t, dyn), which main.js's frame calls in place of renderer.render.
//   · NOTHING ON = TODAY: while no post section is live, render() is exactly `dyn.begin(); renderer.render(scene, camera); dyn.end()`
//     — no composer, no targets, no extra module loaded. Tone mapping and exposure are material-level (renderer.toneMapping), so they
//     cost nothing either; only a live effect brings the composer in (three's EffectComposer, loaded on first use).
//   · THE SAME PICTURE UNDER THE EFFECTS: the scene renders into an MSAA half-float target flagged isXRRenderTarget with an sRGB
//     texture. That flag is how three decides tone mapping, the output colour space and the fog/unlit uniform colour space for a
//     target (WebGLPrograms, getUnlitUniformColorSpace; r185 uses it nowhere else for a target), so the materials tone-map, encode
//     and fog exactly as they do on the canvas: switching an effect on at zero changes nothing else (the sky stays un-tone-mapped,
//     the fog mixes in display space). Every pass then works in display values; the last one draws to the canvas.
//   · The first live pass reads the scene target directly (ctx.take), the depth texture stays valid for every pass of the frame
//     (distance blur, the bloom's sky mask), and the order is a settings value ('stack'), so presets carry it.
//   · Cost: with the panel open, per-pass GPU ms from EXT_disjoint_timer_query_webgl2 (the frame's own dyn timer pauses meanwhile;
//     queries can't nest). Without the extension the panel shows the frame-time change when a section is toggled.
//   · V2 / V5 (render review 2026-10-09) · THE PLUMBING. The plumbing cost more than the effects: the default look rendered into a 4×
//     MSAA half-float target with a depth texture resolved every frame, then ran grade, bloom, sharpen, chroma, lens and grain as a
//     full-screen pass each, ping-ponging half-float targets (+3.8 ms of GPU at the overview, +4.9 in the street). Now:
//       – the scene target is RGBA8 (UnsignedByteType; the GL format pinned to RGBA8, so the materials' own sRGB encode is stored as
//         it is and read back as display values, as from the half-float target);
//       – it has a depth texture only while a live pass reads the depth (distance blur, depth of field, the emissive-only bloom's sky
//         mask: an effect's `depth`); otherwise its depth is never resolved;
//       – every run of foldable sections that sits together in the stack is ONE pass (fx.js fold: lens and chroma as offsets of one
//         fetch, sharpen after them, grade, the glow, vignette, grain); bloom keeps its own glow chain. The panel's cost for a fold
//         shows on its first section.
//     ?fold=0 (or post.setFold(false)) is the old plumbing exactly: half-float target with depth, a pass per section.
import * as THREE from 'three';
import * as S from './settings.js';
import { EFFECTS, fold as foldPass, foldUniforms } from './fx.js';
import { applyLook, DEFAULT_LOOK } from './looks.js';
import { registerFilm } from './film.js';
import { setLitMask } from '../gpu.js';   // (lighting pass: the emissive mask in the scene target's alpha, for the bloom)

const TONE = { neutral: THREE.NeutralToneMapping, aces: THREE.ACESFilmicToneMapping, agx: THREE.AgXToneMapping, cineon: THREE.CineonToneMapping, reinhard: THREE.ReinhardToneMapping, none: THREE.NoToneMapping };
export const DEFAULT_ORDER = [...EFFECTS].sort((a, b) => a.order - b.order).map(e => e.name);

function createTimer(gl) {
  let ext = gl.getExtension('EXT_disjoint_timer_query_webgl2'), pend = [], q = null; const ms = {};
  return { get ok() { return !!ext; }, ms,
    begin(name) { if (!ext || q) return; q = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, q); pend.push([name, q]); },
    end() { if (!q) return; gl.endQuery(ext.TIME_ELAPSED_EXT); q = null; },
    poll() { if (!ext) return; const dis = gl.getParameter(ext.GPU_DISJOINT_EXT);
      while (pend.length && gl.getQueryParameter(pend[0][1], gl.QUERY_RESULT_AVAILABLE)) { const [n, qq] = pend.shift();
        if (!dis) { const v = gl.getQueryParameter(qq, gl.QUERY_RESULT) / 1e6; ms[n] = ms[n] == null ? v : ms[n] * .9 + v * .1; } gl.deleteQuery(qq); }
      if (pend.length > 256) for (const [, qq] of pend.splice(0, pend.length - 256)) gl.deleteQuery(qq); },
    reset() { for (const k in ms) delete ms[k]; },
    restore() { ext = gl.getExtension('EXT_disjoint_timer_query_webgl2'); pend = []; q = null; } };   // (V7: after a context restore the old queries never resolve and the extension must be got again)
}

export function createPost(renderer, scene, camera, o = {}) {
  const size = new THREE.Vector2(), timer = createTimer(renderer.getContext()), samples = o.aa ? Math.min(4, renderer.capabilities.maxSamples || 4) : 0;
  let lookName = 'current', sceneRT = null, sceneKey = '', composer = null, EC = null, loading = null, first = false, dirty = true, active = false, prof = false, profiling = false, order = DEFAULT_ORDER.slice();
  let folding = o.fold !== false, needDepth = false; const folds = new Map();   // (V2: fold passes by their run, kept while the stack changes)
  const ctx = { renderer, camera, night: !!o.night, size, time: 0, get depth() { return sceneRT ? sceneRT.depthTexture : null; }, get scene() { return sceneRT ? sceneRT.texture : null; },   // (lighting pass: scene: its alpha is gpu.js's emissive mask, 1 − lit)
    take(rb) { if (first) { first = false; return sceneRT.texture; } return rb.texture; }, FU: foldUniforms() };
  const FX = new Map();

  // ── tone mapping + exposure: material level (no pass). Untouched until changed, so the renderer keeps main.js's own setting.
  const base = { mode: renderer.toneMapping, exposure: renderer.toneMappingExposure }; let touched = false, xScale = 1;   // (xScale: TAPE's time-of-day grade, render/grade.js — a factor on top, never a section value)
  S.register('tonemap', { mode: { v: 'neutral', options: Object.keys(TONE), label: 'tone mapping' }, exposure: { v: 0, min: -2, max: 2, step: .05, label: 'exposure (EV)', hint: 'stops over the time of day’s own exposure' } },
    v => { if (!touched && v.mode === 'neutral' && v.exposure === 0) return; touched = true; renderer.toneMapping = TONE[v.mode] ?? base.mode; renderer.toneMappingExposure = base.exposure * 2 ** v.exposure * xScale; },
    { title: 'Tone mapping', group: 'post', order: 0, fixed: true, hint: 'in the materials, no extra pass (Neutral is today’s); the sky is never tone-mapped' });

  // ── the static CSS grain (index.html) is the grain section's `static` type
  const grainEl = typeof document !== 'undefined' ? document.querySelector('.grain') : null, GD = EFFECTS.find(e => e.name === 'grain').fields; let mono = null, colour = null;
  function grainCSS(v) {
    if (!grainEl) return; mono ??= grainEl.style.backgroundImage;
    grainEl.style.display = v.on && v.type === 'static' ? '' : 'none';
    grainEl.style.opacity = v.amount === GD.amount.v ? '' : String(v.amount);
    grainEl.style.backgroundSize = v.size === GD.size.v ? '' : `${Math.round(160 * v.size)}px`;
    if (v.color === 'colour') { colour ??= colourTile(); grainEl.style.backgroundImage = colour; } else if (mono) grainEl.style.backgroundImage = mono;
  }

  // ── one section per effect, then the order
  for (const def of EFFECTS) {
    const rec = { def, values: null, pass: null }; FX.set(def.name, rec);
    S.register(def.name, def.fields, v => { rec.values = v; rec.pass?.update(v); def.fold?.set(ctx.FU, v); if (def.name === 'grain') grainCSS(v); dirty = true; }, { title: def.title, group: 'post', order: def.order, hint: def.hint });
  }
  const parse = str => { const out = []; for (const n of String(str).split(',')) if (FX.has(n) && !out.includes(n)) out.push(n);
    for (const n of DEFAULT_ORDER) if (!out.includes(n)) out.splice(Math.min(DEFAULT_ORDER.indexOf(n), out.length), 0, n); return out; };
  S.register('stack', { order: { v: DEFAULT_ORDER.join(','), hidden: true, label: 'order' } }, v => { order = parse(v.order); dirty = true; }, { title: 'Stack order', group: 'post', hidden: true });
  registerFilm(() => { dirty = true; });   // (film emulation pass: the film group's sections — stock, weave, flicker, dust, scratches, leaks, gate — feed the `film` pass)
  if (o.blur) S.set('blur', 'on', true);

  const live = r => r.values.on && (!r.def.live || r.def.live(r.values, ctx));
  function loadModules() {
    loading ??= import('three/addons/postprocessing/EffectComposer.js').then(m => { EC = m.EffectComposer; dirty = true; }).catch(e => console.warn('post: EffectComposer failed to load', e));
    return loading;
  }
  function targets() {
    renderer.getDrawingBufferSize(size);
    const depth = needDepth || !folding, key = (folding ? 'u8' : 'hf') + (depth ? '+depth' : '');   // (V2: RGBA8, depth only when read; ?fold=0: as before)
    if (sceneRT && sceneKey !== key) { sceneRT.depthTexture?.dispose(); sceneRT.dispose(); sceneRT = null; }
    if (!sceneRT) { sceneKey = key;
      sceneRT = new THREE.WebGLRenderTarget(size.x, size.y, { type: folding ? THREE.UnsignedByteType : THREE.HalfFloatType, samples, depthTexture: depth ? new THREE.DepthTexture(size.x, size.y) : null });
      if (folding) sceneRT.texture.internalFormat = 'RGBA8';   // (not SRGB8_ALPHA8, which three picks for an sRGB byte texture: the encode is the materials', below)
      sceneRT.resolveDepthBuffer = depth;   // (no depth reader: the MSAA depth is never copied out, only discarded)
      sceneRT.isXRRenderTarget = true; sceneRT.texture.colorSpace = THREE.SRGBColorSpace;   // see the header: the materials render as they do on the canvas
    }
    if (!composer) { composer = new EC(renderer, new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, depthBuffer: false })); composer.renderToScreen = true; }   // (its two targets are only drawn into, and so allocated, between passes)
    if (sceneRT.width !== size.x || sceneRT.height !== size.y) sceneRT.setSize(size.x, size.y);
    if (composer.renderTarget1.width !== size.x || composer.renderTarget1.height !== size.y) { composer.renderTarget1.setSize(size.x, size.y); composer.renderTarget2.setSize(size.x, size.y); }
  }
  const timed = (p, name) => { const f = p.render.bind(p); p.render = (...a) => { if (prof) timer.begin(name); f(...a); if (prof) timer.end(); }; return p; };
  const ensure = r => { if (!r.pass) { const p = r.pass = timed(r.def.make(ctx), r.def.name); p.update(r.values); if (r.def.frame) p.frame = c => r.def.frame(p, c); } return r.pass; };
  const foldable = r => folding && !!r.def.fold && (!r.def.fold.ok || r.def.fold.ok(r.values));
  function foldOf(run) { const k = run.map(r => r.def.name).join('+'); let p = folds.get(k);
    if (!p) { p = timed(foldPass(ctx, run), run[0].def.name); folds.set(k, p); }
    for (const r of run) if (r.def.name === 'bloom') ensure(r);   // (the fold runs bloom's own glow chain)
    return p; }
  function rebuild() {
    dirty = false; const want = order.map(n => FX.get(n)).filter(live); active = want.length > 0;
    if (!active) return;
    if (!EC) { active = false; loadModules(); return; }   // (the module is on its way: today's render meanwhile)
    needDepth = want.some(r => r.def.depth?.(r.values, ctx)); targets();
    const passes = []; let run = null;
    for (const r of want) { if (foldable(r)) { (run ??= []).push(r); continue; } if (run) { passes.push(foldOf(run)); run = null; } passes.push(ensure(r)); }
    if (run) passes.push(foldOf(run));
    composer.passes = passes;
  }
  function render(t, dyn) {
    if (dirty) rebuild();
    if (!active) { dyn?.begin(); renderer.render(scene, camera); dyn?.end(); return; }
    targets(); ctx.time = t ?? performance.now() / 1000; ctx.frame = (ctx.frame | 0) + 1; for (const p of composer.passes) p.frame?.(ctx);
    prof = profiling && timer.ok;
    if (prof) timer.begin('scene'); else dyn?.begin();
    const bl = S.get('bloom'), mask = !!(bl && bl.on && bl.emissive && bl.strength > 0 && ctx.night);   // (lighting pass: only while the emissive-only bloom is live)
    renderer.setRenderTarget(sceneRT); setLitMask(mask); renderer.render(scene, camera); setLitMask(false); if (prof) timer.end();
    renderer.setRenderTarget(null); first = true; composer.render(0); first = false; renderer.setRenderTarget(null);
    if (prof) timer.poll(); else dyn?.end();
  }
  async function ready() { if (dirty) rebuild(); if (loading) { await loading; rebuild(); } }
  return {
    render, ready,
    async look(name) { const v = await applyLook(name); if (v) lookName = name || 'current'; if (o.blur) S.set('blur', 'on', true); await ready(); return v; },
    defaultLook: DEFAULT_LOOK, get lookName() { return lookName; },
    get active() { return active; }, get order() { return order.slice(); }, get passes() { return composer ? composer.passes.length : 0; },
    get fold() { return folding; }, setFold(on) { folding = !!on; dirty = true; }, get target() { return sceneKey; },   // (V2: the old plumbing back, for A/B: ?fold=0)
    live: name => { const r = FX.get(name); return !!r && live(r); },
    move(name, dir) { const i = order.indexOf(name), j = i + dir; if (i < 0 || j < 0 || j >= order.length) return; const next = order.slice(); [next[i], next[j]] = [next[j], next[i]]; S.set('stack', 'order', next.join(',')); },
    // TAPE's time-of-day grade (render/grade.js): the exposure × m over the tone section's own (a uniform: nothing recompiles)
    setExposureScale(m) { m = +m || 1; if (m === xScale) return; xScale = m; renderer.toneMappingExposure = base.exposure * 2 ** (S.get('tonemap')?.exposure || 0) * m; }, get exposureScale() { return xScale; },
    profile(on) { profiling = !!on; if (!on) timer.reset(); }, costs: () => timer.ms, get timer() { return timer.ok; }, restore: () => timer.restore(),
    // (film emulation pass) the GPU cost of each live pass at the current size: rendered n× from the last frame's buffer to the canvas,
    // synced by a 1-pixel read; ms per pass, the scene render not included. A measuring tool (tools/filmshots.mjs --bench), not per frame.
    bench(n = 120) { if (dirty) rebuild(); if (!active || !composer) return null; const gl = renderer.getContext(), px = new Uint8Array(4), out = { w: size.x, h: size.y, ms: {} };
      const sync = () => { renderer.setRenderTarget(null); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); };
      for (const p of composer.passes) { const name = p.foldName || order.find(k => FX.get(k)?.pass === p), rts = p.renderToScreen; p.renderToScreen = true; first = false;
        p.render(renderer, composer.writeBuffer, composer.readBuffer); sync(); const t0 = performance.now();
        for (let k = 0; k < n; k++) p.render(renderer, composer.writeBuffer, composer.readBuffer); sync(); out.ms[name] = +((performance.now() - t0) / n).toFixed(3); p.renderToScreen = rts; }
      { sync(); const t0 = performance.now(); for (let k = 0; k < 8; k++) sync(); out.syncMs = +((performance.now() - t0) / 8).toFixed(3); }
      return out; },
  };
}

function colourTile() {   // the static grain in colour: the same 160 px tile, one random value per channel (seeded, like index.html's)
  const c = document.createElement('canvas'); c.width = c.height = 160; const g = c.getContext('2d'), d = g.createImageData(160, 160);
  let a = 20260929; const rnd = () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  for (let i = 0; i < d.data.length; i += 4) { d.data[i] = rnd() * 255; d.data[i + 1] = rnd() * 255; d.data[i + 2] = rnd() * 255; d.data[i + 3] = 255; }
  g.putImageData(d, 0, 0); return `url(${c.toDataURL()})`;
}
