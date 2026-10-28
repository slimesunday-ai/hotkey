// ANIM LAB · overlap checker for walk v2 (2026-09-29). Counts the glitch pixels where two rigid parts meet, frame by frame.
//   node style/city/anim/overlap-check.mjs [--quick] [--json out.json] ['&<lab params>'] · --gate '&dbg=back' (the see-through gate)
//   · --shots dir --shot scene:look:v:cam:t0:n[:dt[:mark]] … (frames for GIFs)
// Headless Chrome opens the lab (…/anim/?scene=treadmill&ab=v2&shot=1), steps the walk at 1/120 s (the gait's own sub-step) and,
// for every frame and camera, draws three kinds of debug pass of the walkers only (400 × 500 px, no MSAA):
//   zf    Z-FIGHTING: the lit frame drawn twice with every depth tie between two parts reversed (each part nudged 0.04 mm × its
//         rank along the view ray, then the ranks reversed; shading, shadows and screen position untouched). A pixel whose colour
//         changes (> 6/255) sits on two coplanar faces of different parts: in motion it flickers.   zfAny: the same test on flat
//         part colours (every coplanar overlap, visible or not).
//   poke  POKE-THROUGH: each part's nearest front face and farthest back face along every pixel's ray (float MAX blending; joint
//         slabs left out: they are meant to sit inside their parent). Two
//         parts that aren't joined (the left and right legs; an arm and the hips, thighs or chest; the head and an arm; a thigh and
//         a long top) overlapping by > 1.5 mm, on a pixel where one of them is the visible surface.
//   slab  SLAB SHOW: a joint slab visible more than 1 mm in front of its own parent's surface, changing the colour there by
//         > 12/255 against the same frame drawn without slabs (at rest a slab hides inside its parent; in a bend it fills the wedge).
// The treadmill runs one full cycle (0.95 s) per look × speed; the corner loop (turns), the kerb (stops, starts, the idles on the
// kerb, the turn round) and the idle line-up follow one walker with a close camera; only that walker is drawn. Needs the lab server on :5320.
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const argv = process.argv.slice(2), has = k => argv.includes(k), arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const QUICK = has('--quick'), BASE = arg('--url', 'http://127.0.0.1:5320/style/city/anim/'), sleep = ms => new Promise(r => setTimeout(r, ms));
const EXTRA = argv.filter(a => a.startsWith('&')).join('');   // extra lab params, e.g. &noslab or &v2.arm=.5
const SHOTS = []; for (let i = 0; i < argv.length; i++) if (argv[i] === '--shot') SHOTS.push(argv[i + 1]);

// cameras, in the walker's own frame (it faces +z; its left, L, is −x): [position, target, fov]
const CAMS = {
  side: [[-4.3, 1.0, 0], [0, .95, 0], 30], tq: [[-2.9, 1.6, 3.0], [0, .85, 0], 30], back: [[-2.9, 1.4, -3.0], [0, .85, 0], 30], front: [[0, .8, 3.2], [0, .62, 0], 30],
  feet: [[-1.5, .4, .9], [0, .18, .05], 30], knee: [[-1.5, .55, .6], [0, .38, 0], 30], kneeB: [[-1.2, .6, -1.2], [0, .4, 0], 30],
  hips: [[-1.3, .78, -1.0], [0, .56, 0], 30], shoulder: [[-1.4, 1.05, .9], [0, .8, 0], 30], elbow: [[1.6, .75, .6], [0, .6, 0], 30],
  corner: [[9.8, 2.8, -9.2], [3.6, .7, -3.4], 38, 'world'],   // (shots only: the lab's own corner camera, fixed in the world)
};
const TREAD = QUICK ? { looks: [0, 3], v: [.6, 1.2, 1.8], cams: ['side', 'knee', 'hips', 'feet', 'front', 'elbow'] }
  : { looks: [0, 1, 2, 3, 4], v: [.6, 1.2, 1.8], cams: Object.keys(CAMS).filter(c => CAMS[c][3] !== 'world') };
// scene sweeps: [scene, actor index, t0, seconds, step, cams]
const SWEEPS = QUICK ? [['square', 0, 0, 3, 1 / 60, ['tq', 'hips']], ['kerb', 0, 0, 6, 1 / 60, ['tq', 'feet']]]
  : [['square', 0, 0, 6, 1 / 120, ['tq', 'hips', 'feet']], ['kerb', 0, 0, 44, 1 / 30, ['tq', 'feet', 'hips']], ...[0, 1, 2, 3, 4, 5, 6, 7, 8].map(k => ['idles', k, 0, 4, 1 / 30, ['tq', 'shoulder']])];

// ── the page side (serialised and evaluated in the lab)
async function inPage(cmd) {
  const A = window.__anim, THREE = await import('three'), { installAnim2 } = await import('./walk2.js'), { tierize } = await import('../gpu.js');
  const { renderer, scene, camera, S, BATCH } = A, B = BATCH.v2, gl = renderer.getContext(), W = 400, H = 500;
  let P = window.__wp;
  if (!P) {
    const fb = !!gl.getExtension('EXT_float_blend'); gl.getExtension('EXT_color_buffer_float');
    const U = { uWpBias: { value: 0 }, uWpMode: { value: 0 }, uWpPair: { value: 0 }, uWpPush: { value: 0 } };
    const hook = (m, frag) => { const prev = m.onBeforeCompile, key = m.customProgramCacheKey?.bind(m);
      m.onBeforeCompile = (sh, r) => { prev?.call(m, sh, r); Object.assign(sh.uniforms, U);
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aSlab; varying float vWpPart, vWpSlab, vWpD; uniform float uWpBias, uWpPush;')
          .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vWpPart = aPart; vWpSlab = aSlab;')
          .replace('#include <project_vertex>', `#include <project_vertex>
  vWpD = -mvPosition.z;
  { float r = uWpBias > 0. ? aPart + 1. : 13. - aPart, zv = mvPosition.z + abs(uWpBias) * r - uWpPush * aSlab;   // a tie-break nudge along the view ray only
    if (uWpBias != 0. || uWpPush != 0.) gl_Position.z = (projectionMatrix[2][2] * zv + projectionMatrix[3][2]) / (-zv) * gl_Position.w; }`);
        if (frag) sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vWpPart, vWpSlab, vWpD; uniform float uWpMode, uWpPair;')
          .replace(/}\s*$/, frag + '\n}'); };
      m.customProgramCacheKey = () => (key ? key() : '') + '|wp' + (frag ? frag.length : 0); return installAnim2(m, B.uni); };
    const lit = hook(tierize(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .62, metalness: 0 }), { vmat: true }), `  if (uWpMode > 2.5 && vWpSlab > .5) discard;`);
    const part = hook(new THREE.MeshBasicMaterial(), `  if (uWpMode > 2.5 && vWpSlab > .5) discard; gl_FragColor = vec4((vWpPart + 1.) / 255., vWpSlab, 0., 1.);`);
    const partB = hook(new THREE.MeshBasicMaterial({ side: THREE.BackSide }), `  gl_FragColor = vec4((vWpPart + 1.) / 255., vWpSlab, 0., 1.);`);
    const iv = hook(new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, depthTest: false, depthWrite: false, blending: THREE.CustomBlending, blendEquation: THREE.MaxEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor }),
      `  float p = floor(vWpPart + .5), k = p - 2. * uWpPair; if (k < -.5 || k > 1.5 || vWpSlab > .5) discard;
  vec2 v = gl_FrontFacing ? vec2(1. / vWpD, 0.) : vec2(0., vWpD); gl_FragColor = k < .5 ? vec4(v, 0., 0.) : vec4(0., 0., v);`);
    const rtP = new THREE.WebGLRenderTarget(W, H, { type: THREE.UnsignedByteType }), rtF = new THREE.WebGLRenderTarget(W, H, { type: fb ? THREE.FloatType : THREE.HalfFloatType, depthBuffer: false });
    const dsc = new THREE.Scene();
    P = window.__wp = { fb, U, lit, part, partB, iv, rtP, rtF, dsc, orig: B.b.material, la: new Uint8Array(W * H * 4), lb: new Uint8Array(W * H * 4), ln: new Uint8Array(W * H * 4), pa: new Uint8Array(W * H * 4), pb: new Uint8Array(W * H * 4), ps: new Uint8Array(W * H * 4), pn: new Uint8Array(W * H * 4),
      fl: Array.from({ length: 7 }, () => new Float32Array(W * H * 4)) };
    renderer.setPixelRatio(1); renderer.setSize(W, H); camera.aspect = W / H; camera.updateProjectionMatrix();
    if (!fb) console.warn('no EXT_float_blend: poke depths in half floats');
  }
  // non-adjacent pairs (poke) and each child's parents (slab)
  const LEG = [[1, 6, 8], [2, 7, 9]], PAIRS = [];
  for (const a of LEG[0]) for (const b of LEG[1]) PAIRS.push([a, b, 'legs']);
  for (const arm of [3, 4]) { for (const h of [12, 1, 2]) PAIRS.push([arm, h, 'arm-hip']); PAIRS.push([arm, 5, 'head-arm']); }   // (simple arms: one piece, shoulder to hand)
  PAIRS.push([1, 0, 'thigh-top'], [2, 0, 'thigh-top']);
  const PARENT = { 1: [0, 12], 2: [0, 12], 6: [1], 7: [2], 8: [6], 9: [7], 5: [0] };
  const rot = (yaw, v) => [v[0] * Math.cos(yaw) + v[2] * Math.sin(yaw), v[1], -v[0] * Math.sin(yaw) + v[2] * Math.cos(yaw)];
  function aim(a, c) { const [p, t, fov, world] = c, o = world ? [0, 0, 0] : [a.x, a.y, a.z], pp = world ? p : rot(a.yaw, p), tt = world ? t : rot(a.yaw, t);
    camera.position.set(o[0] + pp[0], o[1] + pp[1], o[2] + pp[2]); camera.fov = fov; camera.aspect = W / H; camera.updateProjectionMatrix(); camera.lookAt(o[0] + tt[0], o[1] + tt[1], o[2] + tt[2]); camera.updateMatrixWorld(); }
  const readCanvas = out => gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, out);
  const onlyWalkers = (fn) => { const par = B.b.parent; P.dsc.add(B.b); const cc = renderer.getClearColor(new THREE.Color()), ca = renderer.getClearAlpha(), sm = renderer.shadowMap.enabled; renderer.shadowMap.enabled = false; renderer.setClearColor(0, 0);
    try { fn(); } finally { par.add(B.b); renderer.setClearColor(cc, ca); renderer.shadowMap.enabled = sm; renderer.setRenderTarget(null); } };
  const partPass = (out, bias, mode, push = 0) => { P.U.uWpBias.value = bias; P.U.uWpMode.value = mode; P.U.uWpPush.value = push; B.b.material = P.part; renderer.setRenderTarget(P.rtP); renderer.clear(); renderer.render(P.dsc, camera); renderer.readRenderTargetPixels(P.rtP, 0, 0, W, H, out); };
  function measure(img, only) {
    if (only >= 0) for (let k = 0; k < B.shown; k++) B.b.setVisibleAt(k, k === only);   // the followed walker alone (the next tick's draw shows the rest again)
    const U = P.U, D = 4e-5;   // 0.04 mm a rank
    B.b.material = P.lit; U.uWpMode.value = 0; U.uWpPush.value = 0;
    U.uWpBias.value = D; renderer.setRenderTarget(null); renderer.render(scene, camera); readCanvas(P.la);
    U.uWpBias.value = -D; renderer.render(scene, camera); readCanvas(P.lb);
    U.uWpBias.value = 0; U.uWpMode.value = 3; renderer.render(scene, camera); readCanvas(P.ln); U.uWpMode.value = 0;
    onlyWalkers(() => {
      partPass(P.pa, D, 1); partPass(P.pb, -D, 1); partPass(P.ps, 0, 1, .001); partPass(P.pn, 0, 3);
      B.b.material = P.iv; U.uWpBias.value = 0; U.uWpPush.value = 0; renderer.setRenderTarget(P.rtF);
      for (let k = 0; k < 7; k++) { U.uWpPair.value = k; renderer.clear(); renderer.render(P.dsc, camera); renderer.readRenderTargetPixels(P.rtF, 0, 0, W, H, P.fl[k]); }
    });
    B.b.material = P.orig; U.uWpBias.value = 0;
    const r = { zf: 0, zfAny: 0, poke: 0, slab: 0, px: 0, why: {} }, mark = img ? new Uint8Array(W * H) : null;
    const fr = (p, i) => { const v = P.fl[p >> 1][i * 4 + (p & 1) * 2]; return v > 0 ? 1 / v : Infinity; }, bk = (p, i) => P.fl[p >> 1][i * 4 + (p & 1) * 2 + 1];
    for (let i = 0; i < W * H; i++) { const o = i * 4, vp = P.pa[o] - 1; if (vp < 0) continue; r.px++;
      if (Math.max(Math.abs(P.la[o] - P.lb[o]), Math.abs(P.la[o + 1] - P.lb[o + 1]), Math.abs(P.la[o + 2] - P.lb[o + 2])) > 6) { r.zf++; if (mark) mark[i] = 1; }
      if (P.pa[o] !== P.pb[o] || P.pa[o + 1] !== P.pb[o + 1]) r.zfAny++;
      const sp = P.ps[o] - 1; if (P.ps[o + 1] > 127 && PARENT[sp] && PARENT[sp].includes(P.pn[o] - 1) && Math.max(Math.abs(P.la[o] - P.ln[o]), Math.abs(P.la[o + 1] - P.ln[o + 1]), Math.abs(P.la[o + 2] - P.ln[o + 2])) > 12) { r.slab++; r.why['slab ' + sp] = (r.why['slab ' + sp] || 0) + 1; if (mark && !mark[i]) mark[i] = 3; }
      for (const [a, b, lab] of PAIRS) { if (vp !== a && vp !== b) continue; const ov = Math.min(bk(a, i), bk(b, i)) - Math.max(fr(a, i), fr(b, i)); if (ov > .0015) { r.poke++; r.why[lab] = (r.why[lab] || 0) + 1; if (mark && !mark[i]) mark[i] = 2; break; } } }
    if (img) {   // the lit frame (bias A), with the flagged pixels: magenta z-fight, cyan poke-through, yellow slab show
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d'), id = g.createImageData(W, H);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const s = ((H - 1 - y) * W + x), d = (y * W + x) * 4, m = img === 'mark' ? mark[s] : 0;
        const c = m === 1 ? [255, 0, 255] : m === 2 ? [0, 255, 255] : m === 3 ? [255, 230, 0] : [P.la[s * 4], P.la[s * 4 + 1], P.la[s * 4 + 2]]; id.data.set([...c, 255], d); }
      g.putImageData(id, 0, 0); r.png = cv.toDataURL('image/png'); }
    return r;
  }
  if (cmd.op === 'info') return { fb: P.fb, looks: A.LK2.length, tris: A.triAvg2 };
  if (cmd.op === 'gate') {   // the see-through gate on the lab's own material (&dbg=back draws inside faces magenta): magenta pixels per frame
    S.scene = cmd.scene; S.v = cmd.v ?? 1.2; A.simulateTo(cmd.t0 ?? 0); const act = A.actors[cmd.actor ?? 0]; if (cmd.look >= 0) for (const a of A.actors) a.look = cmd.look;
    const px = new Uint8Array(W * H * 4), out = [];
    for (let f = 0; f < cmd.n; f++) { A.tick(cmd.dt, 1); for (const c of cmd.cams) { aim(act, cmd.camDefs[c]); B.b.material = P.orig; renderer.setRenderTarget(null); renderer.render(scene, camera); readCanvas(px);
      let m = 0; for (let i = 0; i < W * H * 4; i += 4) if (px[i] > 200 && px[i + 1] < 60 && px[i + 2] > 200) m++; out.push(m);
      if (cmd.who && m) { onlyWalkers(() => { partPass(P.pa, 0, 1); B.b.material = P.partB; renderer.setRenderTarget(P.rtP); renderer.clear(); renderer.render(P.dsc, camera); renderer.readRenderTargetPixels(P.rtP, 0, 0, W, H, P.pb); }); B.b.material = P.orig; for (let i = 0; i < W * H * 4; i += 4) if (px[i] > 200 && px[i + 1] < 60 && px[i + 2] > 200) { const kk = (P.pa[i] - 1) + (P.pa[i + 1] > 127 ? 's' : '') + '/back ' + (P.pb[i] - 1) + (P.pb[i + 1] > 127 ? 's' : ''); (window.__wpWho ||= {})[kk] = (window.__wpWho[kk] || 0) + 1; } }
      if (cmd.img && m > (window.__wpMax || 0)) { window.__wpMax = m; window.__wpWorst = { m, t: S.t, cam: c, look: cmd.look, png: renderer.domElement.toDataURL('image/png') }; } } }
    return cmd.who ? window.__wpWho : cmd.img ? window.__wpWorst : out; }
  // run: a scene from t0, frames every dt, n frames; for each frame, each camera; one actor followed
  S.scene = cmd.scene; S.v = cmd.v ?? 1.2; A.simulateTo(cmd.t0 ?? 0); const act = A.actors[cmd.actor ?? 0]; if (cmd.look >= 0) for (const a of A.actors) a.look = cmd.look;
  const frames = [];
  for (let f = 0; f < cmd.n; f++) { if (f || !cmd.t0) A.tick(cmd.dt, 1); else A.draw();
    const row = { t: +S.t.toFixed(4) }; for (const c of cmd.cams) { aim(act, cmd.camDefs[c]); row[c] = measure(cmd.img, cmd.camDefs[c][3] === 'world' ? -1 : A.actors.indexOf(act)); } frames.push(row); }
  return frames;
}

// ── the Chrome side (after tools/probe.mjs)
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', prof = await fs.mkdtemp(path.join(os.tmpdir(), 'wpol-chk-'));
const ch = spawn(CHROME, ['--headless=new', `--user-data-dir=${prof}`, '--no-first-run', '--use-angle=metal', '--ignore-gpu-blocklist', '--remote-debugging-port=0', '--window-size=400,588', 'about:blank'], { stdio: 'ignore' });
const cleanup = async () => { try { ch.kill('SIGKILL'); } catch {} await sleep(200); await fs.rm(prof, { recursive: true, force: true }).catch(() => {}); };
process.on('SIGINT', async () => { await cleanup(); process.exit(130); }); process.on('SIGTERM', async () => { await cleanup(); process.exit(143); });
try {
  let port = null; for (let t = 0; t < 100 && !port; t++) { await sleep(100); try { port = (await fs.readFile(path.join(prof, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; } catch {} }
  const page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page'), ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => { ws.onopen = r; }); let id = 0; const wait = new Map();
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && wait.has(m.id)) { wait.get(m.id)(m); wait.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') console.error('EXCEPTION', (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).slice(0, 600));
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type !== 'log') console.error('console:', m.params.args.map(a => a.value ?? a.description).join(' ').slice(0, 300)); };
  const send = (method, params = {}) => new Promise(r => { const k = ++id; wait.set(k, r); ws.send(JSON.stringify({ id: k, method, params })); });
  const call = async cmd => { const r = await send('Runtime.evaluate', { expression: `(${inPage.toString()})(${JSON.stringify(cmd)})`, returnByValue: true, awaitPromise: true });
    if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || JSON.stringify(r.result.exceptionDetails)); return r.result.result.value; };
  await send('Runtime.enable'); await send('Page.enable'); await send('Page.navigate', { url: `${BASE}?scene=treadmill&ab=v2&shot=1${EXTRA}` });
  const t0 = Date.now(); let title = ''; while (Date.now() - t0 < 90000) { await sleep(500); title = (await send('Runtime.evaluate', { expression: 'document.title', returnByValue: true })).result?.result?.value || ''; if (title === 'ready') break; }
  if (title !== 'ready') throw new Error('lab never got ready: ' + title);
  const info = await call({ op: 'info' }); console.error(`lab ready · float blend ${info.fb} · ${info.looks} looks · ~${Math.round(info.tris)} tris a body${EXTRA ? ' · ' + EXTRA : ''}`);

  if (has('--gate')) {   // needs &dbg=back: node anim/overlap-check.mjs --gate '&dbg=back'
    if (has('--who')) { let w; for (const look of [0, 1, 2, 3, 4]) for (const v of [.6, 1.2, 1.8]) w = await call({ op: 'gate', who: 1, scene: 'treadmill', look, v, t0: 2, n: 114, dt: 1 / 120, cams: ['feet', 'knee', 'kneeB', 'tq', 'back', 'hips', 'elbow'], camDefs: CAMS });
      for (let k = 0; k < 9; k++) { const r = await call({ op: 'gate', who: 1, scene: 'idles', actor: k, look: -1, t0: 0, n: 40, dt: 1 / 10, cams: ['tq', 'shoulder'], camDefs: CAMS }); if (r) console.log('idle', k, JSON.stringify(r)); } console.log('inside faces by visible part (s = slab):', JSON.stringify(w)); }
    if (arg('--worst')) { let w = null; for (const look of [0, 1, 2, 3, 4]) for (const v of [.6, 1.2, 1.8]) w = await call({ op: 'gate', img: 1, scene: 'treadmill', look, v, t0: 2, n: 114, dt: 1 / 120, cams: ['feet', 'knee', 'kneeB', 'tq', 'back', 'hips', 'elbow'], camDefs: CAMS });
      if (w) { await fs.writeFile(arg('--worst'), Buffer.from(w.png.split(',')[1], 'base64')); console.log('worst', JSON.stringify({ ...w, png: undefined })); } }
    let frames = 0, bad = 0, px = 0; const t1 = Date.now();
    for (const look of [0, 1, 2, 3, 4]) for (const v of [.6, 1.2, 1.8]) { const r = await call({ op: 'gate', scene: 'treadmill', look, v, t0: 2, n: 114, dt: 1 / 120, cams: ['feet', 'knee', 'kneeB', 'tq', 'back', 'hips', 'elbow'], camDefs: CAMS });
      frames += r.length; bad += r.filter(m => m > 0).length; px += r.reduce((a, b) => a + b, 0); }
    for (let k = 0; k < 9; k++) { const r = await call({ op: 'gate', scene: 'idles', actor: k, look: -1, t0: 0, n: 40, dt: 1 / 10, cams: ['tq', 'shoulder'], camDefs: CAMS }); frames += r.length; bad += r.filter(m => m > 0).length; px += r.reduce((a, b) => a + b, 0); }
    console.log(`see-through gate${EXTRA}: ${bad} of ${frames} frames show inside faces (${px} magenta px) · ${((Date.now() - t1) / 1000).toFixed(0)} s`);
  } else if (SHOTS.length) {   // frames for GIFs: scene:look:v:cam:t0:n[:dt[:mark]] → <dir>/<i>-<cam>-<k>.png
    const dir = arg('--shots', '.'); await fs.mkdir(dir, { recursive: true });
    for (const [si, s] of SHOTS.entries()) { const [scene, look, v, cam, t0s, n, dt = 1 / 120, mk] = s.split(':'), cams = cam.split(',');
      const fr = []; for (let k = 0; k < +n; k += 6) fr.push(...await call({ op: 'run', scene, look: +look, v: +v, t0: +t0s + k * +dt, n: Math.min(6, +n - k), dt: +dt, actor: 0, cams, camDefs: CAMS, img: mk ? 'mark' : 'lit' }));   // (small replies: a big one stalls CDP)
      for (const [k, row] of fr.entries()) for (const c of cams) await fs.writeFile(path.join(dir, `${si}-${c}-${String(k).padStart(4, '0')}.png`), Buffer.from(row[c].png.split(',')[1], 'base64'));
      console.error(`shot ${s}: ${fr.length} frames; zf ${fr.reduce((a, r) => a + cams.reduce((b, c) => b + r[c].zf, 0), 0)} poke ${fr.reduce((a, r) => a + cams.reduce((b, c) => b + r[c].poke, 0), 0)} slab ${fr.reduce((a, r) => a + cams.reduce((b, c) => b + r[c].slab, 0), 0)}`); }
  } else {
    const tally = {}, worst = [], add = (key, r, meta) => { const T = tally[key] ||= { frames: 0, px: 0, zf: 0, zfAny: 0, poke: 0, slab: 0, bad: 0, why: {} };
      T.frames++; T.px += r.px; T.zf += r.zf; T.zfAny += r.zfAny; T.poke += r.poke; T.slab += r.slab; if (r.zf + r.poke + r.slab > 0) T.bad++;
      for (const [k, v] of Object.entries(r.why)) T.why[k] = (T.why[k] || 0) + v; worst.push({ n: r.zf + r.poke + r.slab, zf: r.zf, poke: r.poke, slab: r.slab, ...meta }); };
    const tStart = Date.now();
    for (const look of TREAD.looks) for (const v of TREAD.v) {
      const fr = await call({ op: 'run', scene: 'treadmill', look, v, t0: 2, n: 114, dt: 1 / 120, actor: 0, cams: TREAD.cams, camDefs: CAMS });
      for (const row of fr) for (const c of TREAD.cams) { add('treadmill ' + c, row[c], { scene: 'treadmill', look, v, cam: c, t: row.t }); add('ALL', row[c], {}); }
      console.error(`treadmill look ${look} v ${v}: ${((Date.now() - tStart) / 1000).toFixed(0)} s`); }
    for (const [scene, actor, t0s, secs, dt, cams] of SWEEPS) {
      const n = Math.round(secs / dt), fr = []; for (let k = 0; k < n; k += 200) fr.push(...await call({ op: 'run', scene, actor, t0: t0s + k * dt, n: Math.min(200, n - k), dt, cams, camDefs: CAMS, v: 1.2 }));
      for (const row of fr) for (const c of cams) { add(scene + ' ' + c, row[c], { scene, actor, cam: c, t: row.t }); add('ALL', row[c], {}); }
      console.error(`${scene} #${actor}: ${fr.length} frames, ${((Date.now() - tStart) / 1000).toFixed(0)} s`); }
    const rows = Object.entries(tally).sort((a, b) => a[0] === 'ALL' ? 1 : b[0] === 'ALL' ? -1 : a[0] < b[0] ? -1 : 1);
    console.log('where                 frames   bad    zf px   zfAny px   poke px   slab px   (per 1k body px: zf / poke / slab)');
    for (const [k, T] of rows) console.log(`${k.padEnd(20)} ${String(T.frames).padStart(6)} ${String(T.bad).padStart(6)} ${String(T.zf).padStart(8)} ${String(T.zfAny).padStart(10)} ${String(T.poke).padStart(9)} ${String(T.slab).padStart(9)}   ${(1000 * T.zf / T.px).toFixed(3)} / ${(1000 * T.poke / T.px).toFixed(3)} / ${(1000 * T.slab / T.px).toFixed(3)}`);
    const all = tally.ALL; console.log('\nwhy (px):', JSON.stringify(Object.fromEntries(Object.entries(all.why).sort((a, b) => b[1] - a[1]))));
    worst.sort((a, b) => b.n - a.n); console.log('worst frames:'); for (const w of worst.filter(w => w.cam).slice(0, 8)) console.log('  ' + JSON.stringify(w));
    if (arg('--json')) await fs.writeFile(arg('--json'), JSON.stringify({ extra: EXTRA, quick: QUICK, tally, worst: worst.filter(w => w.cam).slice(0, 50) }, null, 1));
  }
  ws.close();
} finally { await cleanup(); }
