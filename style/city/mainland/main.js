// AI CITY · THE MAINLAND v1 (2026-09-29). The persistent place across the water: you step off SECOND CHANCE under the WELCOME TO THE
// MAINLAND arch (candidate A's arrival), walk up Harbor Rd past two built cul-de-sacs (SUNNY CT, WILLOW BEND) and out onto the growth
// frontier: laid-out streets and courts of empty plots, staked, signed and lit, waiting for owners. The page is generated from
// plots.json (layout.mjs writes it). Builds run in a worker pool (ground tiles, lots, the scene, the far tier); the frontier's repeated
// props are instanced; people are baked into one bank. City modules are imported read-only.
// URL: ?tod=night · ?view=arrive|map|sunny|willow|sunny-street|willow-street|frontier|night|island · ?cam=x,y,z&look=x,y,z&fov=n · ?shot=1
// HOUSE BUILDER v1 (2026-10-06, builder.js): click a plot for its card; its owner (dev: ?owner=<plot id>) gets BUILD (the house kit and the
// yard builder), everyone else VISIT. Each lot is its own group here so the builder can swap it; saved lots (saved.js) build from their
// custom spec; two workers stay up after the load for the builder's rebuilds. ?plot=<id> selects a plot · ?build=1 opens the builder on it.
// CHAT + PRESENCE v1 (2026-10-06, chat.js · peers.js · relay.mjs): other humans walking, their cast looks and nametags; Enter to chat, the
// line pops over your head. Run node style/city/mainland/relay.mjs (README); without it the page is solo.
import * as THREE from 'three';
import { Bank, Vol, meshed, stampA, unpackInto } from '../vox.js';
import { geoOf, bakeMesh } from '../glue.js';
import { TOD } from '../kit.js';
import { PAL, hash } from '../style.js';
import { build, pose, LOOKS, rollLook, S as CS, MATS as CMATS } from '../cast.js';
import { createSky } from '../render/sky.js';

const T0 = performance.now(), Q = new URLSearchParams(location.search), NIGHT = Q.get('tod') === 'night' || Q.get('view') === 'night', SHOT = Q.has('shot');
TOD.night = NIGHT; if (SHOT) document.body.classList.add('shot');
const { lampPost } = await import('../props.js');
const FR = await import('./frontier.js');
const PLAN = await (await fetch(new URL('./plots.json', import.meta.url))).json();
const marks = { plan: performance.now() };

// ── the worker pool: start building before anything else (the page's first view waits on it)
const NW = Math.max(2, Math.min(8, (navigator.hardwareConcurrency || 4) - 1)), jobs = [], results = new Map();
const pool = Array.from({ length: NW }, () => new Worker(new URL('./worker.js', import.meta.url), { type: 'module' }));
const ENTRY = new URL('./jobs.js', import.meta.url).href, BUNDLE = (await (await import('../pool.js')).bundleOf(ENTRY)).bundle; marks.bundle = performance.now();
let jobSeq = 0; const pending = new Map(), idle = [];
const run = (task, arg, pri = 0) => new Promise((res, rej) => { if (task === 'lot') arg = lawnJob(arg); jobs.push({ id: ++jobSeq, task, arg, pri, res, rej }); jobs.sort((a, b) => b.pri - a.pri); pump(); });
function pump() { while (idle.length && jobs.length) { const w = idle.pop(), j = jobs.shift(); pending.set(j.id, j); w.postMessage({ id: j.id, task: j.task, arg: j.arg }); } }
pool.forEach(w => { w.onmessage = e => { const d = e.data; if (d.ready) { idle.push(w); pump(); return; } const j = pending.get(d.id); pending.delete(d.id); idle.push(w); pump();
  if (d.err) { document.getElementById('err').textContent += (j ? j.task : 'init') + ': ' + d.err + '\n'; j?.rej(d.err); } else j.res(d); };
  w.onerror = e => { document.getElementById('err').textContent += 'worker: ' + (e.message || e) + '\n'; }; w.postMessage({ init: PLAN, night: NIGHT, bundle: BUNDLE, entry: ENTRY }); });

// ── MAINLAND LAWNS (lawn.js, grass.js): the two lawn maps the ground tiles paint, the lot patches stamped over them (every lot job, the
// builder's rebuilds too, paints its own lawn: run() adds spec.lawn), and how each lot is kept (its CARE, lawn.js CAREOF): the heads are
// showpieces, the rest tidy, lived-in or let go, so no two neighbours mow alike; an owner's lot is tidy
const LW = await import('./lawn.js'), LAWNT = {}, LAWNM = {};
for (const k of ['fine', 'coarse']) { const g = LW.GRIDS[k]; LAWNT[k] = new Uint8Array(g.nx * g.nz * 4); LAWNM[k] = new Uint8Array(g.nx * g.nz); }
function lawnJob(arg) { if (arg.spec.lawn) return arg; const P = PLAN.plots.find(p => p.rect.x === arg.x && p.rect.z === arg.z); if (!P) return arg;
  return { ...arg, spec: { ...arg.spec, lawn: LW.lotLawnSpec(P, !!arg.spec.custom) } }; }
let lawnTex = null;
function stampLawn(p) { if (!p) return; (marks.lawnMs ??= []).push(Math.round(p.ms)); const g = LW.GRIDS[p.g], T = LAWNT[p.g], M = LAWNM[p.g];
  for (let k = 0; k < p.nz; k++) for (let i = 0; i < p.nx; i++) { const n = k * p.nx + i; if (!p.mask[n]) continue; const w = (k + p.k0) * g.nx + i + p.i0; if (!M[w]) continue; const a = n * 4, b = w * 4; T[b] = p.tex[a]; T[b + 1] = p.tex[a + 1]; T[b + 2] = p.tex[a + 2]; T[b + 3] = p.tex[a + 3]; }
  if (lawnTex) lawnTex[p.g].needsUpdate = true; }

// ── the plan: plots, the built lots' specs (style, walls, glass garage, cars), world transforms
const HX = 12, LAWN = .2, WATER = -.9, rad = d => d * Math.PI / 180;
const toW = (R, lx, lz) => { const c = Math.cos(R.rot), s = Math.sin(R.rot); return [R.x + lx * c + lz * s, R.z - lx * s + lz * c]; };
const toL = (R, x, z) => { const dx = x - R.x, dz = z - R.z, c = Math.cos(R.rot), s = Math.sin(R.rot); return [dx * c - dz * s, dx * s + dz * c]; };
const built = PLAN.plots.filter(p => p.status === 'built'), open = PLAN.plots.filter(p => p.status !== 'built');
const SV = await import('./saved.js'), SAVED = new Map(SV.ids().map(id => [id, SV.load(id)]).filter(([id, r]) => r && PLAN.plots.some(p => p.id === id)));   // (house builder: owners' lots)
const SHOWCARS = [{ id: 'supercar', v: 1 }, { id: 'lowrider', v: 3 }, { id: 'livery', v: 2 }, { id: 'supercar', v: 5 }, { id: 'lowrider', v: 0 }, { id: 'supercar', v: 3 }, { id: 'livery', v: 0 }];
const DAILY = [{ id: 'sedan', v: 7 }, { id: 'pickup', v: 1 }, { id: 'sedan', v: 1 }, { id: 'beater', v: 2 }, { id: 'sedan', v: 3 }, { id: 'pickup', v: 4 }, { id: 'sedan', v: 8 }, { id: 'beater', v: 4 }];
let sc = 0, dc = 0; const springs = [];
const lotJobs = built.map((P, k) => {
  const L = P.corners.map(([x, z]) => toL(P.rect, x, z)), fr = [...L].sort((a, b) => b[1] - a[1]), F = fr.slice(0, 2).sort((a, b) => a[0] - b[0]), Bk = fr.slice(2).sort((a, b) => a[0] - b[0]);
  const glass = P.style === 'slab' || P.style === 'butterfly' || P.style === 'gambrel' || (P.style === 'springfield' && springs.push(P) % 2 === 1);
  const spec = { style: P.style, seed: 17 + k * 31, W: P.rect.w, D: P.rect.d, poly: [F[0], F[1], Bk[1], Bk[0]], wall: PLAN.walls[P.wall], glass,
    car: glass ? SHOWCARS[sc++ % SHOWCARS.length] : DAILY[dc++ % DAILY.length], car2: (P.style === 'slab' || P.style === 'butterfly') ? DAILY[dc++ % DAILY.length] : null };
  if (P.style === 'trophy') spec.car = { id: 'supercar', v: 2 };
  if (P.head && P.street === 'willow-loop') spec.statue = [-P.rect.w / 2 + 3.2, -3.6];   // (the gold statue's spot: the yard keeps clear of it)
  if (SAVED.has(P.id)) spec.custom = SAVED.get(P.id).lot;
  return { P, spec, k };
});
for (const P of open) if (SAVED.has(P.id)) { const L = P.corners.map(([x, z]) => toL(P.rect, x, z)), fr = [...L].sort((a, b) => b[1] - a[1]), F = fr.slice(0, 2).sort((a, b) => a[0] - b[0]), Bk = fr.slice(2).sort((a, b) => a[0] - b[0]);
  lotJobs.push({ P, spec: { style: SAVED.get(P.id).lot.house.style, seed: 1, W: P.rect.w, D: P.rect.d, poly: [F[0], F[1], Bk[1], Bk[0]], custom: SAVED.get(P.id).lot }, k: -1 }); }
// ground tiles: 0.1 m over the built zone, 0.2 m over the frontier (with the built zone cut out)
const FINE = [-122, -168, 126, 0], COARSE = [-212, -332, 284, 0];
const tiles = [];
for (let k = 0; k < 8; k++) { const w = (FINE[2] - FINE[0]) / 8; tiles.push({ x0: FINE[0] + k * w, z0: FINE[1], x1: FINE[0] + (k + 1) * w, z1: FINE[3], s: .1, skip: null }); }   // (lawns: 8 fine tiles, the painting runs wider)
for (let k = 0; k < 4; k++) { const w = (COARSE[2] - COARSE[0]) / 4; tiles.push({ x0: COARSE[0] + k * w, z0: COARSE[1], x1: COARSE[0] + (k + 1) * w, z1: COARSE[3], s: .2, skip: FINE }); }
const HOR = NIGHT ? PAL.nightHor : PAL.horizon;
const P_scene = run('scene', null, 9), P_far = run('far', HOR, 1);
const P_ground = tiles.map((t, k) => run('ground', t, t.s < .15 ? 8 : 7));   // (lawns: the longer jobs first, so the pool's tail is the short lot jobs)
const P_lots = lotJobs.map(j => run('lot', { spec: j.spec, x: j.P.rect.x, z: j.P.rect.z, rot: j.P.rect.rot }, 5));

// ── renderer, sky, fog, light (STYLE §3–4; the fade is THREE.Fog in exactly the horizon colour)
const W = innerWidth, H = innerHeight, renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(SHOT ? 1 : Math.min(2, devicePixelRatio)); renderer.setSize(W, H); renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = NIGHT ? 1.25 : 1;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap; renderer.shadowMap.autoUpdate = false; document.getElementById('stage').appendChild(renderer.domElement);
const scene = new THREE.Scene(), sky = createSky({ scene }), TOP = NIGHT ? PAL.nightTop : PAL.sky;
sky.U.top.value.setHex(TOP); sky.U.hor.value.setHex(HOR); sky.U.gnd.value.setHex(HOR);
if (NIGHT) { sky.U.cityP.value.set(.55, 70, 0, 1); sky.U.glowC.value.setHex(0xff8a3d); }
scene.fog = new THREE.Fog(HOR, 110, 560);
{ const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(sky.envScene, .02).texture; scene.environmentIntensity = NIGHT ? .2 : .55; }
const sun = new THREE.DirectionalLight(NIGHT ? 0x8fa4ff : 0xfff2dc, NIGHT ? .35 : 3.0); sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096); sun.shadow.bias = -.0004; sun.shadow.normalBias = .04;
scene.add(sun, sun.target); scene.add(new THREE.HemisphereLight(NIGHT ? 0x4050a0 : 0xd6ecff, NIGHT ? 0x201830 : 0xe0cfb0, NIGHT ? .5 : 1.05));
const MAT = [new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .78, metalness: 0 }), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .22, metalness: .1 }),
  new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .3, metalness: .85 }), new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })];
const FARMAT = MAT.map((m, li) => { const k = m.clone(); if (li === 0) k.roughness = 1; return k; });
const addBank = (b, o = {}) => b.L.forEach((O, li) => { if (!O.v) return; const m = new THREE.Mesh(geoOf(O), (o.mats || MAT)[li]); m.castShadow = (o.cast ?? true) && li !== 3; m.receiveShadow = true; (o.to ?? scene).add(m); });
// the water and the land past the rasters (flat lawn into the haze)
{ const m = new THREE.Mesh(new THREE.PlaneGeometry(5000, 2500), new THREE.MeshStandardMaterial({ color: NIGHT ? 0x1b3f8a : 0x2f86d8, roughness: .55, metalness: 0 })); m.rotation.x = -Math.PI / 2; m.position.set(0, WATER, 1250); m.receiveShadow = true; scene.add(m);
  const land = new THREE.MeshStandardMaterial({ color: 0x57ae45, roughness: 1 }), [a, b, c, d] = COARSE;
  for (const [x0, z0, x1, z1] of [[-2500, -2500, a, 0], [c, -2500, 2500, 0], [a, -2500, c, b]]) { const g = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), land); g.rotation.x = -Math.PI / 2; g.position.set((x0 + x1) / 2, .19, (z0 + z1) / 2); g.receiveShadow = true; scene.add(g); }
  const hr = new THREE.Mesh(new THREE.PlaneGeometry(8, 2200), new THREE.MeshStandardMaterial({ color: 0x505160, roughness: .9 })); hr.rotation.x = -Math.PI / 2; hr.position.set(HX, .235, b - 1100); scene.add(hr); }
if (!NIGHT) { const cm = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }), g = new THREE.BoxGeometry(1, 1, 1);
  for (let c = 0; c < 16; c++) { const a = hash(c, 61) * Math.PI * 2, r = 380 + hash(c, 62) * 500, cx = Math.sin(a) * r, cz = Math.cos(a) * r - 150, cy = 110 + hash(c, 63) * 90;
    for (let k = 0; k < 5; k++) { const m = new THREE.Mesh(g, cm); m.scale.set(30 + hash(c, k) * 40, 10 + hash(c, k + 9) * 10, 20 + hash(c, k + 5) * 20); m.position.set(cx + (k - 2) * 18, cy + (k & 1) * 6, cz + hash(c, k + 3) * 16); scene.add(m); } } }

// ── THE FRONTIER, INSTANCED: lamps on every street, survey stakes, strings, signs (no two alike in view), the prime pennants
const LIGHTS = [];   // night point-light candidates [x, y, z, colour, intensity, range]
// (house builder) each open plot's stakes, strings, sign and pennant instances, so a plot that gets built can put its survey kit away
const FRONT = new Map(), own = (arr, id, xf) => { arr.push(xf); (arr.own ??= []).push(id); };
function hideFrontier(id, hide = true) { const Z = new THREE.Matrix4().makeScale(0, 0, 0); for (const [im, k] of FRONT.get(id) ?? []) { im.userData.keep ??= new Map();
  if (hide) { if (!im.userData.keep.has(k)) { const m = new THREE.Matrix4(); im.getMatrixAt(k, m); im.userData.keep.set(k, m); } im.setMatrixAt(k, Z); } else if (im.userData.keep.has(k)) im.setMatrixAt(k, im.userData.keep.get(k));
  im.instanceMatrix.needsUpdate = true; } }
function instanced(bank, xf, o = {}) { if (!xf.length) return; const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1);
  bank.L.forEach((O, li) => { if (!O.v) return; const im = new THREE.InstancedMesh(geoOf(O), MAT[li], xf.length);
    xf.forEach(([x, y, z, ry, sx = 1, sy = 1, sz = 1], k) => { e.set(0, ry, 0); q.setFromEuler(e); p.set(x, y, z); s.set(sx, sy, sz); im.setMatrixAt(k, m4.compose(p, q, s)); const id = xf.own?.[k]; if (id) (FRONT.get(id) ?? FRONT.set(id, []).get(id)).push([im, k]); });
    im.castShadow = li !== 3 && o.cast !== false; im.receiveShadow = true; im.computeBoundingSphere(); scene.add(im); }); }
const segD = (px, pz, [ax, az], [bx, bz]) => { const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz))); return Math.hypot(px - ax - t * dx, pz - az - t * dz); };
const streetE = (x, z, S) => S.bulb ? Math.hypot(x - S.bulb[0], z - S.bulb[1]) - S.r : S.pts.reduce((d, p, k) => k ? Math.min(d, segD(x, z, S.pts[k - 1], p) - S.hw) : d, 1e9);
const clearE = (x, z) => Math.min(...PLAN.streets.map(S => streetE(x, z, S)));
const inPlot = (x, z) => PLAN.plots.some(P => { const [lx, lz] = toL(P.rect, x, z); return lx > -P.rect.w / 2 && lx < P.rect.w / 2 && lz < 0 && lz > -P.rect.d; });
{ const lamps = [];
  for (const S of PLAN.streets) {
    if (S.bulb) { for (let k = 0; k < 3; k++) { const a = rad(k * 120 + (S.id === 'sunny-bulb' ? 60 : 15)), x = S.bulb[0] + Math.sin(a) * (S.r + .9), z = S.bulb[1] + Math.cos(a) * (S.r + .9); if (clearE(x, z) > .5) lamps.push([x, z, Math.atan2(-Math.sin(a), -Math.cos(a))]); } continue; }
    let acc = 0, side = 1, next = S.id === 'harbor' ? 14 : 10; const step = S.id === 'harbor' ? 30 : 32;
    for (let k = 1; k < S.pts.length; k++) { const [ax, az] = S.pts[k - 1], [bx, bz] = S.pts[k], L = Math.hypot(bx - ax, bz - az), tx = (bx - ax) / L, tz = (bz - az) / L;
      while (next <= acc + L) { const t = (next - acc) / L, px = ax + (bx - ax) * t, pz = az + (bz - az) * t, nx = -tz * side, nz = tx * side, x = px + nx * (S.hw + .8), z = pz + nz * (S.hw + .8);
        if (clearE(x, z) > .5 && !(S.loop && side < 0)) lamps.push([x, z, Math.atan2(-nx, -nz)]); if (!S.loop) side = -side; next += step; }
      acc += L; } }
  instanced(lampPost(), lamps.map(([x, z, r]) => [x, LAWN, z, r]));
  for (const [x, z, r] of lamps) LIGHTS.push([x + Math.sin(r) * 1.7, 5.4, z + Math.cos(r) * 1.7, 0xffd9a0, 70, 24]);
  marks.lamps = lamps.length; }
{ const pink = [], gold = [], strings = [], pens = [], signs = Array.from({ length: FR.SIGN_N }, () => []), primes = {};
  const placed = [];   // [x, z, variant]
  open.forEach((P, k) => { const R = P.rect, h = n => hash(k * 7 + 3, n), C = P.corners, cx = P.center[0], cz = P.center[1];
    for (const [x, z] of C) { const dx = cx - x, dz = cz - z, l = Math.hypot(dx, dz); own(P.prime ? gold : pink, P.id, [x + dx / l * .45, LAWN, z + dz / l * .45, h(1) * 6]); }
    const sd = h(2) > .5 ? 1 : -1, sw = Math.min(R.w / 2 - 2.4, 5), [sx, sz] = toW(R, sd * sw, -1.9);
    if (P.prime) { const why = FR.PRIME[P.primeWhy] || 'PRIME'; own(primes[why] ??= [], P.id, [sx, LAWN, sz, R.rot]); const [px, pz] = toW(R, -sd * (R.w / 2 - 1.3), -1.4); own(pens, P.id, [px, LAWN, pz, R.rot + Math.PI / 2]); }
    else { let best = 0, bd = -1; for (let v = 0; v < FR.SIGN_N; v++) { let d = 1e9; for (const [x, z, u] of placed) if (u === v) d = Math.min(d, Math.hypot(x - sx, z - sz)); d += hash(k, v) * 4; if (d > bd) { bd = d; best = v; } }
      placed.push([sx, sz, best]); own(signs[best], P.id, [sx, LAWN, sz, R.rot + (h(3) - .5) * .25]); }
    if (h(4) > .35 && R.d > 16) { const fz0 = -6.5, fz1 = -Math.min(17, R.d - 3), fw = Math.min(6, R.w / 2 - 2), pts = [[-fw, fz0], [fw, fz0], [fw, fz1], [-fw, fz1]].map(([a, b]) => toW(R, a, b));   // the footprint, staked and strung
      for (const [x, z] of pts) own(pink, P.id, [x, LAWN, z, h(5) * 6]);
      for (let e = 0; e < 4; e++) { const [ax, az] = pts[e], [bx, bz] = pts[(e + 1) % 4], L = Math.hypot(bx - ax, bz - az); own(strings, P.id, [(ax + bx) / 2, LAWN + .42, (az + bz) / 2, Math.atan2(bx - ax, bz - az), .04, .04, L]); } } });
  instanced(FR.stake(), pink); instanced(FR.stake(0xe7bd4a), gold); instanced(FR.pennant(), pens);
  const sb = new Bank(true); { const V = new Vol(1, 1, 1, { s: 1, org: [-.5, -.5, -.5] }); V.set(0, 0, 0, 0xff4fa3); stampA(meshed(V), sb, 0, 0, 0, 0); } instanced(sb, strings, { cast: false });
  signs.forEach((xf, v) => instanced(FR.sign(v), xf)); for (const [why, xf] of Object.entries(primes)) instanced(FR.sign(0, why), xf);
  marks.signs = open.length; for (const id of SAVED.keys()) hideFrontier(id); }

// ── THE PEOPLE (chars.js), posed where someone would stand, baked into one bank drawn with chars.js's own materials
const PB = new Bank(true), MB = new Bank(true), GOLDB = new Bank(true), PB0 = PB; PB.people = true;
const L_ = h => structuredClone(LOOKS.find(l => l.handle === h)) || rollLook(h.length * 977);
const CUR = { pb: PB, lot: null }, FOLK = [];   // (the bank people bake into: the page's, or a lot's own) · (walk mode: every resident's look and spot, walk.js)
function person(look, x, z, ry, fn, y = LAWN, sc = 1, dst = CUR.pb) { FOLK.push({ handle: look.handle, x, y, z, sc, lot: CUR.lot }); const o = build(look); o.rotation.order = 'YXZ'; o.position.set(x, y, z); o.rotation.y = ry; if (sc !== 1) o.scale.setScalar(CS * sc); pose(o, 0, 0);
  if (o.userData.open) o.userData.open.visible = true; fn?.(o.userData.rig, o); o.updateMatrixWorld(true);
  const vis = m => { for (let p = m; p; p = p.parent) if (!p.visible) return false; return true; };
  o.traverse(m => { if (m.isMesh && vis(m)) bakeMesh(m, dst, dst.people ? Math.max(0, CMATS.indexOf(m.material)) : 2); }); o.traverse(m => m.geometry?.dispose()); }
const arms = (a, b) => rg => { rg.armL.rotation.x = a; rg.armR.rotation.x = b; };
const held = (seed, id) => Object.assign(rollLook(seed), { held: { id } });
const sit = rg => { rg.legL.rotation.x = rg.legR.rotation.x = -1.3; rg.armL.rotation.x = rg.armR.rotation.x = -.4; };
person(held(0x5a11, 'duffel'), -5.6, 9.0, .5, arms(0, -.2)); person(held(0x5a12, 'flip'), -4.4, 7.8, -2.3, arms(0, -2.2)); person(L_('www.girl'), -7.5, 3.4, .35, arms(-.3, 0));
person(rollLook(0x5a13), -.6, -8.2, Math.PI, arms(-.9, 0)); person(rollLook(0x5a14), HX - 5.4, -17.8, Math.PI / 2, arms(-1.1, 0)); person(held(0x5a15, 'can'), HX - 6.2, -20.6, Math.PI / 2 - .6, arms(-.6, 0));
person(rollLook(0x5a16), HX + 5.7, -30.2, -Math.PI / 2, null); person(rollLook(0x7b01), 15.4, -1.1, -.25, arms(-.3, -1.4));
{ const { DECK } = await import('./ferry.js'); DECK.forEach(([x, y, z, r], k) => person(k === 1 ? held(0x5b01, 'camera') : rollLook(0x5b10 + k), -x + 1.8, z < -9 ? -z + 15.5 : -z + 15.5, r + Math.PI, k === 2 ? arms(-2.6, -2.4) : k === 0 ? sit : arms(-.4, 0), y + WATER - .8)); }
// Willow Bend: two in the gazebo, one at the mailbox kiosk, a gardener in the community plots
{ const Lp = PLAN.courts.willow.loop, [gx, gz] = Lp.c; person(rollLook(0x6c01), gx + 3.9, gz + .9, Math.PI / 2 + .4, arms(-.6, 0), LAWN + .4); person(held(0x6c02, 'can'), gx + 5.3, gz - .6, -Math.PI / 2 - .5, arms(0, -.8), LAWN + .4);
  person(held(0x6c03, 'cash'), -2.4, -83.6, Math.PI, arms(-1.0, -.2)); person(rollLook(0x6c04), -1.2, -97.5, .4, rg => { rg.armL.rotation.x = -1.1; rg.armR.rotation.x = -.9; }, LAWN); }
// the frontier: a couple reading a FOR SALE board, a surveyor, a dog walker, a kid on the new sidewalk
{ const pick = (st, n) => open.filter(p => p.street === st)[n];
  const a = pick('bayview', 3); if (a) { const R = a.rect, [x, z] = toW(R, 0, 1.2); person(rollLook(0x7c01), x - .5, z, R.rot + Math.PI - .3, arms(0, -.4)); person(held(0x7c02, 'flip'), x + .6, z + .2, R.rot + Math.PI + .3, arms(0, -2.2)); }
  const b = pick('juniper', 6); if (b) { const R = b.rect, [x, z] = toW(R, 2, -9); person(held(0x7c03, 'camera'), x, z, R.rot + 1.2, arms(-1.2, -1.2)); }
  const c = pick('harbor', 2); if (c) { const R = c.rect, [x, z] = toW(R, -3, 2.2); person(rollLook(0x7c04), x, z, R.rot + Math.PI / 2, arms(-.5, 0)); const { dog } = await import('../props.js'); stampA(dog(2, 1, 'walk', 0), MB, R.rot + Math.PI / 2, x + Math.sin(R.rot + Math.PI / 2) * 1.2, LAWN, z + Math.cos(R.rot + Math.PI / 2) * 1.2); } }

// ── assemble: wait for the pool, merge the built banks, place the lots' people, panes and statue
const WB = new Bank(true), GB = new Bank(true), FB = new Bank(true), stats = { ms: {} };
const take = (r, dst, k) => { unpackInto(r.P, dst); stats.ms[k] = Math.round(r.ms); };
const [rScene, rFar, rGround, rLots] = await Promise.all([P_scene, P_far, Promise.all(P_ground), Promise.all(P_lots)]);
marks.built = performance.now();
take(rScene, WB, 'scene'); take(rFar, FB, 'far'); rGround.forEach((r, k) => take(r, GB, 'ground' + k)); rLots.forEach((r, k) => { stats.ms['lot' + k] = Math.round(r.ms); });
rGround.forEach((r, k) => { const t = tiles[k], g = LW.GRIDS[t.s < .15 ? 'fine' : 'coarse'], L = r.extra, T = LAWNT[t.s < .15 ? 'fine' : 'coarse'], M = LAWNM[t.s < .15 ? 'fine' : 'coarse'];
  const i0 = Math.round((t.x0 - g.x0) / g.s), k0 = Math.round((t.z0 - g.z0) / g.s);
  for (let k = 0; k < L.nz; k++) { const w = (k + k0) * g.nx + i0; T.set(L.tex.subarray(k * L.nx * 4, (k + 1) * L.nx * 4), w * 4); M.set(L.mask.subarray(k * L.nx, (k + 1) * L.nx), w); } });
marks.blit = performance.now();
const GR = await import('./grass.js'), LTX = GR.lawnTextures(THREE, renderer, LAWNT), { mat: GMAT } = GR.lawnMaterial(THREE, MAT[0], LTX);
addBank(GB, { cast: false, mats: [GMAT, MAT[1], MAT[2], MAT[3]] }); addBank(WB); addBank(FB, { mats: FARMAT, cast: false });
// ── THE LOTS, one group each (house builder: a lot its owner rebuilds is swapped whole): the lot's bank, its people, its glass panes
// (one instanced mesh per lot) and, on Willow Bend's head lot, the statue. A custom lot (the owner's) gets its porch sitter, the roof
// guy and the hoop player; the generated lots' scripted extras (the lemonade customers, the statue) stay with the generated look.
// MAINLAND FIXES (2026-10-06): every lot's sprinklers in one instanced, shader-animated mesh (sprinklers.js; walk-through, they run by day)
const SPRK = (await import('./sprinklers.js')).createSprinklers({ night: NIGHT }); scene.add(SPRK.mesh);
const lotGroups = new Map(), lotA = new Map(), GOLDM = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: .55, roughness: .32 });
const PANE = new THREE.MeshStandardMaterial({ color: 0xbfe6ff, transparent: true, opacity: NIGHT ? .08 : .22, roughness: .05, metalness: .1, depthWrite: false });
function paneMesh(list) { const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), PANE, Math.max(1, list.length)), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  list.forEach(([x, y, z, r, sx, sy, sz], k) => { e.set(0, r, 0); q.setFromEuler(e); im.setMatrixAt(k, m4.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sx, sy, sz))); });
  im.count = list.length; im.renderOrder = 2; im.computeBoundingSphere(); return im; }
function setLot(P, r, k, custom, first = false) {
  const old = lotGroups.get(P.id); if (old) { old.removeFromParent(); old.traverse(m => { if (m.isMesh) m.geometry.dispose(); }); }
  const g = new THREE.Group(); g.name = 'lot:' + P.id; const R = P.rect, A = r.extra || {}, w = (p, dy = 0) => toW(R, p[0], p[1] + dy); lotA.set(P.id, A);
  g.userData.soft = (A.soft || []).map(([x0, z0, x1, z1, h]) => ({ q: [toW(R, x0, z0), toW(R, x1, z0), toW(R, x1, z1), toW(R, x0, z1)].flat(), h: LAWN + h }));   // (walk-through decor: walk.js)
  SPRK.set(P.id, (A.sprinklers || []).map(([x, z, reach]) => { const [sx, sz] = toW(R, x, z); return [sx, LAWN + .3, sz, reach, hash(Math.round(sx * 10), Math.round(sz * 10))]; }));
  const lb = new Bank(true); unpackInto(r.P, lb); addBank(lb, { to: g }); stampLawn(A.lawn); A.lawn = null;
  const panes = []; for (const p of A.panes || []) { const [x0, y0, z0, x1, y1, z1] = p, [cx, cz] = toW(R, (x0 + x1) / 2, (z0 + z1) / 2); panes.push([cx, LAWN + (y0 + y1) / 2, cz, R.rot, x1 - x0, y1 - y0, Math.max(.04, z1 - z0)]); }
  if (panes.length) g.add(paneMesh(panes));
  if (first) for (const l of A.lights || []) { const [x, z] = toW(R, l[0], l[2]); LIGHTS.push([x, LAWN + l[1], z, 0xffe2b0, 22, 9]); }
  const PB = new Bank(true), MB = new Bank(true), GOLDB = new Bank(true); PB.people = true; k = Math.max(0, k); CUR.pb = PB; CUR.lot = P.id; for (let f = FOLK.length; f--;) if (FOLK[f].lot === P.id) FOLK.splice(f, 1); const style = custom ? custom.house.style : P.style;
  { const P_ = custom ? { ...P, style: 'custom', head: false } : P;   // (a custom lot: only the hoop, the porch and the roof)
    ((P) => {
  if (A.hoop) { const [x, z] = w(A.hoop); person(rollLook(style.length * 331 + k), x, z, R.rot + Math.PI, arms(-2.9, -2.7), LAWN + .1); }
  if (A.stand && P.style === 'ranch') { const [x, z] = w(A.stand, -.9), [bx, bz] = w(A.stand, 1.6); person(rollLook(0x6a01 + k), x, z, R.rot, arms(-.7, -.7), LAWN, .82); person(held(0x6a02 + k, 'cash'), bx, bz, R.rot + Math.PI, arms(-.8, 0), LAWN, .95); }
  if (A.porch) { const [x, z] = w(A.porch); person(rollLook(0x6a03 + k), x, z, R.rot, sit, LAWN + .62); }
  if (A.roof) { const [x, z] = toW(R, A.roof[0], A.roof[2]); person(L_('xXbadvibesXx'), x, z, R.rot + .4, arms(-2.6, 0), LAWN + A.roof[1]); }
  if (A.lawn && P.style === 'cape') { const [x, z] = w(A.lawn); person(rollLook(0x6a05 + k), x, z, R.rot + 1.2, arms(-.8, 0)); }
  if (A.stand && (P.style === 'slab' || P.style === 'butterfly')) { const [x, z] = toW(R, A.stand[0][0], A.stand[0][1]); person(rollLook(0x6a07 + k), x, z, R.rot + (A.stand[0][2] || 0), arms(-1.3, -.35)); }
  // the trophy on one lawn: the owner's agent, 3× and gold, on a granite plinth (candidate B's statue, brought to Willow Bend's head lot)
  if (P.head && P.street === 'willow-loop') { const [x, z] = toW(R, -R.w / 2 + 3.2, -3.6), Pl = new Vol(28, 7, 28, { s: .1, org: [-1.4, 0, -1.4] }); Pl.box(0, 0, 0, 28, 6, 28, 0x26262e, 1); Pl.box(2, 6, 2, 26, 7, 26, 0x3a3a44, 1);
    stampA(meshed(Pl), MB, R.rot, x, LAWN, z); person(L_('56kballer'), x, z, R.rot, arms(-2.7, -2.5), LAWN + .7, 3, GOLDB); marks.statue = [x, z]; }
    })(P_); }
  CUR.pb = PB0; CUR.lot = null;
  { const O = GOLDB.L[2]; for (let k = 0; k < O.C.n; k += 3) { const l = .45 + .55 * Math.min(1, (.3 * O.C.a[k] + .59 * O.C.a[k + 1] + .11 * O.C.a[k + 2]) * 1.6); O.C.a[k] = l; O.C.a[k + 1] = .74 * l; O.C.a[k + 2] = .16 * l; } }
  addBank(GOLDB, { mats: [MAT[0], MAT[1], GOLDM, MAT[3]], to: g }); addBank(PB, { mats: CMATS, to: g }); addBank(MB, { to: g });
  scene.add(g); lotGroups.set(P.id, g); renderer.shadowMap.needsUpdate = true; return g;
}
rLots.forEach((r, k) => { const J = lotJobs[k]; setLot(J.P, r, J.k, J.spec.custom, true); });
marks.lots = performance.now();
for (const k of ['fine', 'coarse']) LW.treeShade(LAWNT[k], LW.GRIDS[k], rScene.extra?.trees ?? []);
marks.shade = performance.now(); lawnTex = LTX; LTX.fine.needsUpdate = LTX.coarse.needsUpdate = true;
const TUFTS = GR.createTufts(THREE, { tex: LTX, night: NIGHT }); scene.add(TUFTS.mesh); marks.lawn = performance.now();
addBank(PB, { mats: CMATS }); addBank(MB);

// ── cameras (STYLE §5: street eye 2.6–3.6 fov 50–58 · close-ups 1.3–1.6 · overview ~55° down, fov 42–44). fog: [near, far] per view
const VIEWS = {
  arrive: { cam: [-6.9, 3.7, 27.5], look: [1.5, 2.2, -30], fov: 54, r: 70 },
  map: { cam: [36, 330, 150], look: [36, 0, -150], fov: 44, r: 290, fog: [420, 900] },
  sunny: { cam: [30, 78, -52], look: [66, 0, -112], fov: 43, r: 80 },
  willow: { cam: [-10, 78, -52], look: [-46, 0, -104], fov: 43, r: 80 },
  'sunny-street': { cam: [53.5, 2.9, -101.4], look: [82, 3.4, -121], fov: 54, r: 60 },
  'willow-street': { cam: [-30, 2.9, -106.5], look: [-70, 3.4, -96], fov: 54, r: 60 },
  frontier: { cam: [20, 3.3, -150], look: [12, 2.0, -230], fov: 52, r: 80 },
  night: { cam: [71, 3.1, -110.5], look: [24, 3.4, -97], fov: 54, r: 60 },
  island: { cam: [19.5, 3.0, -14], look: [-40, 6, 300], fov: 36, r: 40 },
};
const v = VIEWS[Q.get('view')] || VIEWS.arrive, V3 = s => s.split(',').map(Number);
const cam = Q.get('cam') ? V3(Q.get('cam')) : v.cam, look = Q.get('look') ? V3(Q.get('look')) : v.look;
const camera = new THREE.PerspectiveCamera(+(Q.get('fov') || v.fov), W / H, .1, 3000); camera.position.set(...cam); camera.lookAt(...look);
function fit() {   // the fade by eye height (street 110 → 560 for the open water, tightening overhead) and the sun's shadow box round the view
  const c = camera.position, t = Math.min(1, Math.max(0, (c.y - 6) / 144)); scene.fog.near = 110 + t * 40; scene.fog.far = 560 - t * 120; if (v.fog && !Q.get('cam')) [scene.fog.near, scene.fog.far] = v.fog;
  const tg = ctl ? ctl.target : new THREE.Vector3(...look), r = +(Q.get('r') || v.r), tx = (c.x + tg.x) / 2, tz = (c.z + tg.z) / 2;
  sun.target.position.set(tx, 0, tz); sun.position.set(tx - 60, 90, tz + 75); sun.target.updateMatrixWorld();
  Object.assign(sun.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: 1, far: 500 }); sun.shadow.camera.updateProjectionMatrix(); renderer.shadowMap.needsUpdate = true;
  if (NIGHT) { for (const l of scene.userData.pl || []) scene.remove(l);   // the lights nearest the camera (a budget of 16)
    scene.userData.pl = LIGHTS.map(l => [l, Math.hypot(l[0] - c.x, l[2] - c.z)]).sort((a, b) => a[1] - b[1]).slice(0, 16).map(([[x, y, z, col, i, d]]) => { const p = new THREE.PointLight(col, i, d, 1.5); p.position.set(x, y, z); scene.add(p); return p; }); } }
let ctl = null; if (!SHOT) { const { OrbitControls } = await import('three/addons/controls/OrbitControls.js'); ctl = new OrbitControls(camera, renderer.domElement); ctl.target.set(...look); ctl.update(); ctl.addEventListener('end', fit); }
fit();
TUFTS.update(camera, 0); renderer.render(scene, camera); marks.first = performance.now();
const info = { calls: renderer.info.render.calls, tris: renderer.info.render.triangles };
const FRAME = [t => TUFTS.update(camera, t), t => { const wk = window.__walk; SPRK.update(t / 1000, wk?.on ? wk.S.p : null); }];   // (the house builder's per-frame work: its camera moves, the held piece, the lit spots; the tufts follow the camera)
renderer.setAnimationLoop(t => { ctl?.update(); for (const f of FRAME) f(t); renderer.render(scene, camera); });
{ const keep = new Set(pool.slice(0, 2)); for (const w of pool) if (!keep.has(w)) w.terminate(); idle.splice(0, idle.length, ...idle.filter(w => keep.has(w))); }   // two stay up for the builder's rebuilds
if (!SHOT || Q.has('builder')) { const B = await import('./builder.js');
  const MLB = B.init({ scene, camera, renderer, ctl, PLAN, Q, NIGHT, MAT, CMATS, LAWN, FRAME, run, toW, toL, fit, setLot, lotGroups, lotA, lotJobs, hideFrontier, SAVED });
  // CHAT + PRESENCE (chat.js, peers.js; the relay is relay.mjs): your look (stable per player id) and the chat keys go in before walk.js's
  const CHAT = await import('./chat.js'), SOC = CHAT.early({ Q });
  // WALK MODE (walk.js): you on the street, third or first person; doors call the builder's Go inside below
  (await import('./walk.js')).init({ scene, camera, renderer, ctl, PLAN, Q, NIGHT, LAWN, FRAME, toW, fit, sun, lotGroups, FOLK, mlb: MLB, MAT, FARMAT, CMATS, GOLDM, PANE, GMAT, seed: SOC.seed, onGait: CHAT.onGait });
  CHAT.init({ scene, camera, renderer, Q, FRAME, LAWN, mlb: MLB });
  // GO INSIDE: the plot builder's hook opens the house's interior (interiors/city/mainland.js, an overlay with its own scene); the
  // Mainland pauses while inside. Owner as in the builder (dev: ?owner=<plot id>), else a read-only visit.
  const loop = t => { ctl?.update(); for (const f of FRAME) f(t); renderer.render(scene, camera); };
  // (the plot builder keeps its car as [id, variant]; the interior takes { id, v })
  const carOf = c => Array.isArray(c) ? (c[0] ? { id: c[0], v: c[1] | 0 } : null) : c?.id ? c : null;
  // (and its wall as a sherbet name, 'sky'; the interior takes a colour number: a name read as a number painted the walls black)
  const { SHERBET } = await import('./houses.js'), wallOf = w => typeof w === 'number' ? w : SHERBET[w] ?? null;
  B.INTERIOR.open = (plotId, spec) => { import('../interiors/city/mainland.js').then(({ openMainlandInterior }) => openMainlandInterior({
    plotId, houseSpec: { ...spec, car: carOf(spec.car), wall: wallOf(spec.wall) }, owner: Q.get('owner') === plotId, night: NIGHT, title: typeof spec.address === 'string' ? spec.address : undefined,
    onOpen: () => { renderer.setAnimationLoop(null); ui(false); dispatchEvent(new Event('ml:inside')); }, onClose: () => { ui(true); renderer.setAnimationLoop(loop); dispatchEvent(new Event('ml:outside')); } })).catch(e => { ui(true); console.warn('go inside failed', e); }); return true; };
  // the plot builder's card, bar, tray and hints step aside while inside (the interior has its own), and come back on leaving
  const UI_IDS = ['mb-card', 'mb-hint', 'mb-bar', 'mb-tray', 'mb-tip'], hid = new Map();
  function ui(on) { for (const id of UI_IDS) { const el = document.getElementById(id); if (!el) continue;
    if (!on) { hid.set(id, el.style.visibility); el.style.visibility = 'hidden'; } else if (hid.has(id)) { el.style.visibility = hid.get(id); hid.delete(id); } } } }
window.__ml = { scene, camera, renderer, PLAN, marks, sprk: SPRK, lawn: { T: LAWNT, M: LAWNM, tex: LTX, tufts: TUFTS }, stats: () => ({ first: +(marks.first / 1000).toFixed(2), built: +(marks.built / 1000).toFixed(2), plan: +(marks.plan / 1000).toFixed(2), calls: info.calls, tris: +(info.tris / 1e6).toFixed(2), callsNow: renderer.info.render.calls, workers: NW, lamps: marks.lamps, plots: PLAN.plots.length, ms: stats.ms }) };
window.__ready = true;
