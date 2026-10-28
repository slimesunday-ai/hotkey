// AI City · HOMES pass (2026-09-28) · THE CUTAWAY RUNTIME: click (or tap) a home → its inside, dollhouse style. main.js loads this module
// on the first click or with ?home=<id>, never before (zero cost while no home has been opened).
//   homes      every lot anchor (trailer pads, houses) and every stacked unit (walk-up apartments, Gatehill penthouses) of the blocks
//              streamed in, read from api.ANCHORS; each gets a frame (centre, heading, width, depth, floor, ceiling) and its layout
//              (assign.js: by lot id and tier)
//   open(id)   the room built from its layout + the home's sim state (room.js; demo state, or the live sim under ?sim=live), the owner's
//              slots filled (fill.js), the owner asleep in bed; gpu.js CUT discards the city's roof and front wall over it; the camera
//              frames it; the overlay says whose it is. close(): Esc, ×, or a click on no home. ‹ › (or [ ]) step to the neighbours.
//   cache      the last 3 rooms stay built (hidden); older ones are freed
//   builder    (home builder v1, 2026-10-06: builder.js, loaded with the first open) the owner's home gets EDIT HOME (edit mode in this
//              cutaway); anyone else's is a read-only VISIT: stash and safes locked, trophies and wardrobe showcased, the flex readout. The
//              owner: the live sim's owner view (?sim=live&simurl=…/state?view=owner&handle=&token= → me.home), else ?owner=<lot id> (dev).
//              A home saved in the builder (saved.js, localStorage) is built from its saved layout and slot fills; else its preset.
import * as THREE from 'three';
import { CUT } from '../../gpu.js';
import { P, addressAt } from '../../plan.js';
import { layoutFor, TIER_OF } from './assign.js';
import { sdata } from '../../../../world/city.js';   // (SPREAD: the data this spread reads)

const SECN = { lock: 'lock + chain', door: 'steel door', alarm: 'alarm', dog: 'dog', safe: 'safe' };
const SCARN = { crime: 'crime scene', boarded: 'boarded up', burned: 'burned out', foreclosed: 'foreclosed', memorial: 'memorial' };
// fix round · a home's roof top over its anchor's roof line (a house's anchor carries its eave only), measured by depth hits over 44 houses
// and 54 trailers: one-storey houses (eave 3.4 m) up to +4.5 (A-frames, capes), two-storey (eave 6.2) up to +3.6, trailers up to +1.6
const RIDGE = { low: 4.6, two: 3.7, trailer: 1.7 }, HEADTILT = .7, HEADK = .84;
const KEEP = 3, ROOM = { trailer: [5, 4], apartment: [5, 4], house: [5.5, 4.5], penthouse: [6.5, 5.5] };
const smooth = t => t * t * (3 - 2 * t);

export function createHomes(api, { Q, NIGHT = false, SHOT = false } = {}) {
  const { scene, camera, controls, renderer, ANCHORS } = api;
  let idx = new Map(), idxN = -1, order = [], cur = null, saved = null, tween = null, raf = 0, mods = null, stP = null, placesP = null;
  const cache = new Map(), asm = new Map(), stats = { opens: 0, lastMs: 0, buildMs: 0, calls: 0 };
  // ── the homes the streamed blocks anchored: a frame per home (local x across its front, local z toward the street)
  // vol [x0, x1, y0, y1, z0, z1]: the home's real building volume in that frame (fix round: fitted, not a slab of sky over the roof) —
  // what a clicked point must fall in (a margin for eaves, porches, sills and fire escapes), and the ray's box when a depth pick fails
  function lotEntry(id, l, block) {
    const f = l.face ?? [0, 1], R = l.house; if (!R) return null; const alongX = f[1] !== 0, yaw = l.yaw || 0;
    let fw = alongX ? R[2] - R[0] : R[3] - R[1], fd = alongX ? R[3] - R[1] : R[2] - R[0], th = Math.atan2(f[0], f[1]) + yaw;
    if (yaw) { const c = Math.abs(Math.cos(yaw)), s = Math.abs(Math.sin(yaw)), k = c * c - s * s; [fw, fd] = [(fw * c - fd * s) / k, (fd * c - fw * s) / k]; }
    if (fw < 4.3 && fd > fw + 2.5) { th -= Math.PI / 2; [fw, fd] = [fd, fw]; }   // a narrow pad end-on to the street: cut its long side instead
    const tier = TIER_OF[l.tier] ?? l.tier ?? 'house', wallY = l.wall ? l.wall[1] - l.wall[4] / 2 : .2, floorY = wallY + (tier === 'trailer' ? .45 : .32), roof = l.roof ?? floorY + 3;
    const ridge = roof + (tier === 'trailer' ? RIDGE.trailer : roof - wallY < 4 ? RIDGE.low : RIDGE.two);   // (a house's anchor roof is its eave; a trailer's is its top)
    return { id, kind: 'lot', tier, block, cx: (R[0] + R[2]) / 2, cz: (R[1] + R[3]) / 2, th, fw, fd, floorY, H: Math.max(2.3, Math.min(2.8, roof - floorY - .02)), top: roof + 4, ceiling: false,
      vol: [-fw / 2 - .7, fw / 2 + .7, wallY - .4, ridge + .4, -fd / 2 - .7, fd / 2 + 1.5] };
  }
  function unitEntry(u, b, block) {
    const f = b.face ?? [0, 1], th = Math.atan2(f[0], f[1]), xa = [Math.cos(th), -Math.sin(th)], za = [Math.sin(th), Math.cos(th)], tower = b.kind === 'tower';
    const ws = (u.windows || []).filter(w => w.length < 6 || w[5] === b.rot); if (!ws.length) return null;
    let lo = 1e9, hi = -1e9, q = -1e9, yb = 1e9; for (const w of ws) { const s = w[0] * xa[0] + w[2] * xa[1]; lo = Math.min(lo, s - w[3] / 2); hi = Math.max(hi, s + w[3] / 2); q = Math.max(q, w[0] * za[0] + w[2] * za[1] - .07); yb = Math.min(yb, w[1] - w[4] / 2); }
    const tier = TIER_OF[b.tier] ?? b.tier ?? 'apartment', [rw, rd] = ROOM[tier] ?? ROOM.apartment, W = Math.max(rw + .1, tower ? rw + .1 : hi - lo + 1), D = rd + .4, s = (lo + hi) / 2, qc = q - D / 2 - .02;
    const floorY = yb - (tower ? .2 : .9), H = tower ? 2.8 : 2.72, top = tower ? (b.top ?? floorY + 10) + .5 : floorY + H;
    return { id: u.id, kind: tower ? 'tower' : 'walkup', tier, block, bld: b.id, floor: u.floor, addr: b.addr, bname: b.name, cx: xa[0] * s + za[0] * qc, cz: xa[1] * s + za[1] * qc, th, fw: W, fd: D, floorY, H,
      top, ceiling: !tower, wins: tower ? u.windows || [] : null,
      vol: tower ? null : [-W / 2 - .2, W / 2 + .2, floorY - .2, floorY + H + .3, D / 2 - 1.2, D / 2 + 1.6] };   // (a tower's: its whole top, set in index())
  }
  // a Gatehill tower is two stacked-unit anchors, its north and south penthouse (bld:<i>_<j>·N / ·S): each owns its half of the tower's
  // top — the penthouse storey and the roof over it — split across the middle, so a click on the roof opens the side it landed on
  function towerVols(list) {
    const groups = new Map(); for (const h of list) { const k = h.bld.replace(/·[^·]*$/, ''); (groups.get(k) ?? groups.set(k, []).get(k)).push(h); }
    for (const G of groups.values()) { const wins = G.flatMap(h => h.wins);
      for (const h of G) { const c = Math.cos(h.th), s = Math.sin(h.th); let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
        for (const w of wins) { const dx = w[0] - h.cx, dz = w[2] - h.cz, lx = dx * c - dz * s, lz = dx * s + dz * c; x0 = Math.min(x0, lx); x1 = Math.max(x1, lx); z0 = Math.min(z0, lz); z1 = Math.max(z1, lz); }
        if (G.length < 2) z0 = Math.min(z0, z1 - h.fd * 2); const mid = G.length < 2 ? z0 : (z0 + z1) / 2;
        h.vol = [x0 - 1, x1 + 1, h.floorY - .3, h.top + 6, mid, z1 + .8]; h.pair = G.filter(o => o !== h).map(o => o.id);
        const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2; h.gx = h.cx + c * mx + s * mz; h.gz = h.cz - s * mx + c * mz; } } }   // (the tower's middle: prev / next order)
  function index() { if (idxN === ANCHORS.size && idx.size) return idx; idx = new Map();
    for (const [k, a] of ANCHORS) { for (const [id, l] of Object.entries(a?.lots || {})) { const e = lotEntry(id, l, k); if (e) idx.set(id, e); }
      for (const b of a?.buildings || []) for (const u of b.units || []) { const e = unitEntry(u, b, k); if (e) idx.set(u.id, e); } }
    towerVols([...idx.values()].filter(h => h.kind === 'tower'));
    // prev / next: within the tier, street row by street row; a tower's two penthouses next to each other (north, then south)
    const sx = h => h.gx ?? h.cx, sz = h => h.gz ?? h.cz;
    idxN = ANCHORS.size; order = [...idx.values()].sort((p, q) => Math.round(sz(p) / 24) - Math.round(sz(q) / 24) || sx(p) - sx(q) || p.floorY - q.floorY || p.cz - q.cz); return idx; }
  // ── picking (fix round): the click resolves to what it actually hits. The scene is drawn once into a 1×1 float target — the camera's
  // view narrowed to the clicked pixel, every opaque mesh depth-tested, each fragment writing its world position — and that point opens
  // the home whose volume holds it. A home behind another house, a tree, a car or any building is never picked; a click on no home is
  // nothing. Only on a click: nothing here runs per frame. (The old ray-against-boxes pick stays as the fallback if the read fails.)
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), pcam = new THREE.PerspectiveCamera(), PX = new Float32Array(4);
  let prt = null, pmat = null;
  // (while a home is open, what gpu.js CUTOUT discards is not there to hit either: its test, on the pick's world position — keep in step)
  const PICKCUT = `
  if ( uCut[1].w > 0. ) { vec2 cd = vP.xz - uCut[0].xy; float clx = abs( cd.x * uCut[0].z - cd.y * uCut[0].w ), clz = cd.x * uCut[0].w + cd.y * uCut[0].z;
    bool wide = clx < uCut[1].x, sto = vP.y > uCut[3].x && vP.y < uCut[3].y;
    if ( clz < uCut[2].z && ( ( wide && vP.y > uCut[1].y && vP.y < uCut[1].z && clz > uCut[2].x ) || ( sto && ( ( wide && clz > uCut[2].y ) || ( clx < uCut[2].w && clz > uCut[3].z ) ) ) ) ) discard; }`;
  async function sceneHit(e) { const r = renderer.domElement.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    prt ??= new THREE.WebGLRenderTarget(1, 1, { type: THREE.FloatType, depthBuffer: true, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
    pmat ??= new THREE.ShaderMaterial({ vertexShader: `#include <common>\n#include <batching_pars_vertex>\nvarying vec3 vP;\nvoid main() {\n#include <batching_vertex>\n#include <begin_vertex>\n#include <project_vertex>\n  vP = transpose( mat3( viewMatrix ) ) * ( mvPosition.xyz - viewMatrix[ 3 ].xyz ); }`,
      fragmentShader: `uniform mat4 uCut; varying vec3 vP;\nvoid main() {${PICKCUT}\n  gl_FragColor = vec4( vP, 1. ); }`, uniforms: { uCut: CUT } });
    pcam.copy(camera); pcam.setViewOffset(r.width, r.height, x - .5, y - .5, 1, 1); pcam.updateProjectionMatrix();
    const hid = [], sm = renderer.shadowMap, keep = { au: sm.autoUpdate, nu: sm.needsUpdate, rt: renderer.getRenderTarget(), ov: scene.overrideMaterial, bg: scene.background, br: scene.onBeforeRender, cc: renderer.getClearColor(new THREE.Color()), ca: renderer.getClearAlpha(), ac: renderer.autoClear };
    scene.traverseVisible(o => { const m = Array.isArray(o.material) ? o.material[0] : o.material; if (!m) return; if (o.isPoints || o.isLine || o.isSprite || m.transparent || m.depthWrite === false || m.colorWrite === false) { o.visible = false; hid.push(o); } });
    try { sm.autoUpdate = false; sm.needsUpdate = false; scene.overrideMaterial = pmat; scene.background = null; scene.onBeforeRender = () => {}; renderer.setClearColor(0, 0); renderer.autoClear = true;
      renderer.setRenderTarget(prt); renderer.render(scene, pcam); }
    finally { for (const o of hid) o.visible = true; sm.autoUpdate = keep.au; sm.needsUpdate = keep.nu; scene.overrideMaterial = keep.ov; scene.background = keep.bg; scene.onBeforeRender = keep.br;
      renderer.setClearColor(keep.cc, keep.ca); renderer.autoClear = keep.ac; renderer.setRenderTarget(keep.rt); }
    if (renderer.readRenderTargetPixelsAsync) await renderer.readRenderTargetPixelsAsync(prt, 0, 0, 1, 1, PX); else renderer.readRenderTargetPixels(prt, 0, 0, 1, 1, PX);
    return PX[3] > .5 ? new THREE.Vector3(PX[0], PX[1], PX[2]) : null; }
  // the home whose volume holds a point (the deepest inside, where two volumes' margins meet)
  function homeAt(P) { let best = null, bs = -1;
    for (const h of index().values()) { const dx = P.x - h.cx, dz = P.z - h.cz; if (!h.vol || dx * dx + dz * dz > 1600) continue; const c = Math.cos(h.th), s = Math.sin(h.th), lx = dx * c - dz * s, lz = dx * s + dz * c, [x0, x1, y0, y1, z0, z1] = h.vol;
      const m = Math.min(lx - x0, x1 - lx, P.y - y0, y1 - P.y, lz - z0, z1 - lz); if (m >= 0 && m > bs) { bs = m; best = h; } }
    return best; }
  function rayPick(e) { const r = renderer.domElement.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera);
    const o = ray.ray.origin, d = ray.ray.direction; let best = null, bt = 1e9;
    for (const h of index().values()) { const dx = o.x - h.cx, dz = o.z - h.cz; if (!h.vol || dx * dx + dz * dz > 500 * 500) continue; const c = Math.cos(h.th), s = Math.sin(h.th);
      const lo = [dx * c - dz * s, o.y, dx * s + dz * c], ld = [d.x * c - d.z * s, d.y, d.x * s + d.z * c], [x0, x1, y0, y1, z0, z1] = h.vol, mn = [x0, y0, z0], mx = [x1, y1, z1];
      let t0 = 0, t1 = bt; for (let a = 0; a < 3 && t0 <= t1; a++) { if (Math.abs(ld[a]) < 1e-9) { if (lo[a] < mn[a] || lo[a] > mx[a]) t0 = 2e9; continue; }
        let ta = (mn[a] - lo[a]) / ld[a], tb = (mx[a] - lo[a]) / ld[a]; if (ta > tb) [ta, tb] = [tb, ta]; t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); }
      if (t0 <= t1 && t0 < bt) { bt = t0; best = h; } }
    return best; }
  const lastPick = { hit: null, id: null, ms: 0, via: null };
  async function pick(e) { const t0 = performance.now(); let P = null, h = null, via = 'depth';
    try { P = await sceneHit(e); h = P ? homeAt(P) : null; } catch (err) { console.warn('homes: depth pick failed, using the boxes', err); via = 'boxes'; h = rayPick(e); }
    Object.assign(lastPick, { hit: P ? [P.x, P.y, P.z].map(v => +v.toFixed(2)) : null, id: h?.id ?? null, ms: +(performance.now() - t0).toFixed(1), via }); return h; }
  // ── the sim state. ?sim=live: the page's own live feed (simstate/live.js) — its layer's model, and the agents of its diffs, tapped as
  // they arrive (nothing fetched here, so &simport= / &simurl= hold as the page's feed has them). Else the page's layer model when it has
  // one, the demo's owners (the demo read once, on the first open). Lot names (their street addresses) from sim2/places.json.
  const LIVE = Q.get('sim') === 'live', liveAgents = new Map(); let tapped = false, liveMe = null;
  function tapLive() { const L = api.sim; if (tapped || !L?.applyDiff) return; tapped = true; const f = L.applyDiff;
    L.applyDiff = d => { if (Array.isArray(d?.agents)) { liveAgents.clear(); for (const a of d.agents) if (a?.id) liveAgents.set(a.id, a); } if (d?.me) liveMe = d.me; return f.call(L, d); }; }
  // (home builder) whose home this is to the viewer: the live sim's owner view says (feed.js passes `me` on), else the dev toggle ?owner=<lot>
  const isOwner = (h, st) => !!h && ((liveMe && (liveMe.home === h.id || (st?.owner && st.owner === liveMe.handle))) || Q.get('owner') === h.id);
  let BM = null, BMod = null, decor = null, editor = null; const builder = () => BM ??= import('./builder.js').then(m => (BMod = m)), savedP = import('./saved.js');
  if (LIVE) tapLive();
  const places = () => placesP ??= fetch(new URL(sdata('../../../../sim2/places.json'), import.meta.url)).then(r => r.json()).then(p => ({ ...p, names: new Map((p.lots || []).map(l => [l.id, l.name])) }));
  async function state() {
    const P = await places();
    if (LIVE) { tapLive(); if (!liveAgents.size && window.__simlive?.pollNow) await Promise.race([window.__simlive.pollNow(), new Promise(r => setTimeout(r, 1500))]);   // (the first open: one poll of the page's own feed)
      const m = api.sim?.model; return { places: P, src: m ? 'live' : 'live · no state yet', model: m ?? { homes: new Map() }, agents: liveAgents }; }
    stP ??= (async () => { const AD = await import('../../simstate/adapter.js'), raw = await AD.load('demo');
      return { src: 'demo', model: AD.adapt(raw, P, { night: NIGHT }), agents: new Map((raw.agents || []).map(a => [a.handle, a])) }; })();
    const s = await stP; return { ...s, places: P, model: api.sim?.model ?? s.model }; }
  async function load() { if (mods) return mods; const [R, F, G, C] = await Promise.all([import('./room.js'), import('./fill.js'), import('../../glue.js'), import('../../cast.js')]);
    const GLOW = { value: new THREE.Color(0, 0, 0) }, glow = m => { m.onBeforeCompile = sh => { sh.uniforms.uGlow = GLOW; sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uGlow;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance += diffuseColor.rgb * uGlow;'); }; m.customProgramCacheKey = () => 'homeglow'; return m; };
    const MATS = [glow(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .78, metalness: 0 })), glow(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .22, metalness: .1 })),
      glow(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .3, metalness: .85 })), new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })];
    return mods = { R, F, G, C, MATS, GLOW }; }
  // ── building one home's inside (cached: the last KEEP stay built)
  async function build(h) {
    const [{ R, F, G, C, MATS }, S0] = await Promise.all([load(), state()]), st = S0.model.homes.get(h.id) ?? null, tier = h.tier;
    const name = layoutFor(h.id, tier), A0 = asm.get(name) ?? await fetch(new URL(`../home/assemblies/${name}.json`, import.meta.url)).then(r => r.json()); asm.set(name, A0);
    const SV = await savedP, rec = SV.load(h.id, tier), A = rec?.layout ?? A0;   // (home builder: the owner's saved layout, else the preset)
    const agent = st?.owner ? S0.agents.get(st.owner) : null, sec = st?.sec ?? new Set(), scars = [...(st?.scars ?? [])], vacant = !st || (!st.owner && !scars.length);
    const show = vacant && tier === 'penthouse', seed = (h.id.split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) & 0xffff) || 1;
    const wealth = show ? 1 : F.wealthOf(tier, agent, st), auto = st?.owner || show ? F.fillsFor(A0, { tier, wealth, sec, seed, show }) : A0.slots.map(() => null);
    const fills = rec ? A.slots.map((s, i) => s.fill !== undefined ? s.fill : auto[i] ?? null) : auto;   // (a saved slot's `fill` is the owner's pick, null = left empty)
    const asleep = !!st?.asleep, lightsOn = NIGHT && !!st?.lit, key = [h.id, name, st?.owner, agent?.look, [...sec].sort(), scars.sort(), asleep, lightsOn, NIGHT, rec?.rev ?? 0].join('|');
    const hit = cache.get(key); if (hit) { cache.delete(key); cache.set(key, hit); return hit; }
    const t0 = performance.now(), [rw, rd] = ROOM[tier] ?? ROOM.house;
    const band = h.kind === 'lot' ? .28 : 0, SW = h.fw - 2 * band, SD = h.fd - band;   // (a lot's room stands inside its walls' band)
    const S = { W: SW, D: SD, H: h.H, band: band + .02, ceiling: h.ceiling, night: NIGHT, lightsOn, sec: [...sec], scars, fills, bare: (vacant || !st?.owner) && !show, forRent: !!st?.forRent || (!st && !show), asleep, seed, tier }, res = R.buildRoom(A, S);
    const g = new THREE.Group(), xa = [Math.cos(h.th), -Math.sin(h.th)], za = [Math.sin(h.th), Math.cos(h.th)];
    const over = res.W > SW + .01 || res.D > SD + .01, zo = over ? 0 : band / 2;
    g.position.set(h.cx - xa[0] * res.W / 2 + za[0] * (zo - res.D / 2), h.floorY, h.cz - xa[1] * res.W / 2 + za[1] * (zo - res.D / 2)); g.rotation.y = h.th;
    res.bank.L.forEach((O, li) => { if (!O.v) return; const m = new THREE.Mesh(G.geoOf(O), MATS[li]); m.receiveShadow = false; m.castShadow = false; g.add(m); });
    let head = null;
    if (asleep && res.bed && st?.owner) {   // the owner asleep: on their back in bed (else along the longest seat), eyes shut, the zzz above
      const look = typeof agent?.look === 'number' ? structuredClone(C.LOOKS[agent.look % C.LOOKS.length]) : C.rollLook(seed * 7919 & 0xffffff), c = C.build(look), b = res.bed, par = new THREE.Group(), [w, d] = [b.w, b.d];
      const Tt = [[b.x, b.z], [b.x, b.z + w], [b.x + w, b.z + d], [b.x + d, b.z]][b.r & 3]; par.position.set(Tt[0], b.top + .14, Tt[1]); par.rotation.y = b.r * Math.PI / 2; par.add(c);
      c.rotation.order = 'YXZ'; if (b.kind === 'beds') { c.position.set(w / 2, 0, d - .12); c.rotation.set(-Math.PI / 2, 0, 0); } else { c.position.set(w - .1, 0, d * .5); c.rotation.set(-Math.PI / 2, Math.PI / 2, 0); }
      if (c.userData.open) { c.userData.open.visible = false; c.userData.shut.visible = true; }
      const tmp = new THREE.Group(); tmp.add(par); tmp.updateMatrixWorld(true);
      // (fix round) flat on its back the big head read as a dark box on the pillow: a little smaller, and propped up (chin down) or turned
      // on the pillow — whichever turns the shut eyes most toward the camera (the street side, from above)
      const hd = c.userData.head; if (hd) { hd.scale.setScalar(HEADK); const want = new THREE.Vector3(0, .75, .66).normalize(), f = new THREE.Vector3(); let best = ['x', HEADTILT], bd = -2;
        for (const [ax, a] of [['x', HEADTILT], ['y', HEADTILT], ['y', -HEADTILT]]) { hd.rotation.set(0, 0, 0); hd.rotation[ax] = a; tmp.updateMatrixWorld(true); const d = f.set(0, 0, 1).transformDirection(hd.matrixWorld).dot(want); if (d > bd) { bd = d; best = [ax, a]; } }
        hd.rotation.set(0, 0, 0); hd.rotation[best[0]] = best[1]; tmp.updateMatrixWorld(true); }
      const CB = new (await import('../../vox.js')).Bank(true), vis = o => { for (let p = o; p && p !== tmp; p = p.parent) if (!p.visible) return false; return true; };
      c.traverse(m => { if (m.isMesh && vis(m)) G.bakeMesh(m, CB, Math.max(0, C.MATS.indexOf(m.material))); }); c.traverse(m => m.geometry?.dispose());
      CB.L.forEach((O, li) => { if (!O.v) return; const m = new THREE.Mesh(G.geoOf(O), C.MATS[li]); m.receiveShadow = false; g.add(m); });
      const hp = hd ? hd.localToWorld(new THREE.Vector3(0, 9, 0)) : c.localToWorld(new THREE.Vector3(0, 26, 0)); head = hp; }   // (fix round: the zzz over the head — the old point, 1.55 of the character's voxel units, sat at its feet)
    const e = { key, g, res, A, A0, auto, S, rec, name, st, agent, fills, show, vacant, head, wealth, over, zo, src: S0.src, pname: S0.places?.names?.get(h.id) ?? null, ms: performance.now() - t0 };
    cache.set(key, e); while (cache.size > KEEP) { const [k0, e0] = cache.entries().next().value; if (e0 === cur?.e) break; cache.delete(k0); e0.g.removeFromParent(); e0.g.traverse(m => m.geometry?.dispose()); }
    return e; }
  // ── the cutaway: three boxes in the home's frame (gpu.js CUT) — above its ceiling (lots, penthouses), its front slab, its storey inside
  // (a lot keeps its own side and back walls: our shell stands inside their band and only its inside and front slab go — unless the room
  // had to grow past its footprint, then its whole storey)
  function setCut(h, e) { const a = CUT.value, W = e.res.W, D = e.res.D, y0 = h.floorY, y1 = h.floorY + e.res.H, lot = h.kind === 'lot', over = e.over;
    const hxW = lot ? Math.max(h.fw, W) / 2 + .9 : W / 2 + .03, z1 = lot ? h.fd / 2 + 2.2 : D / 2 + (h.kind === 'walkup' ? 1.6 : 1.5), full = !lot || over;
    a.set([h.cx, h.cz, Math.cos(h.th), Math.sin(h.th),
      hxW, h.kind === 'walkup' ? 1e9 : y1 + .005, h.kind === 'walkup' ? -1e9 : 1e5, 1,
      lot ? -Math.max(h.fd, D) / 2 - .9 : -D / 2 - .03, full ? -Math.max(h.fd, D) / 2 - .03 : h.fd / 2 - .45, z1, full ? Math.max(W, lot ? h.fw : 0) / 2 + .03 : W / 2 + .01,
      y0 + .012, y1 + (h.ceiling ? .02 : .01), e.zo - D / 2 - .01, 0]); }
  const clearCut = () => { CUT.value[7] = 0; };
  // ── camera: frame the open room from the street side, above it (a walk-up storey: from across the street, a little above the sill)
  const cam2 = new THREE.PerspectiveCamera();
  function frameOf(h, e) { const W = e.res.W, D = e.res.D, xa = new THREE.Vector3(Math.cos(h.th), 0, -Math.sin(h.th)), za = new THREE.Vector3(Math.sin(h.th), 0, Math.cos(h.th));
    const tgt = new THREE.Vector3(h.cx, h.floorY + (h.ceiling ? 1.2 : .7), h.cz).addScaledVector(za, h.ceiling ? .2 : .35);
    const dir = h.ceiling ? za.clone().multiplyScalar(.96).addScaledVector(xa, -.22).add(new THREE.Vector3(0, .2, 0)).normalize() : za.clone().multiplyScalar(.72).addScaledVector(xa, -.34).add(new THREE.Vector3(0, .95, 0)).normalize();
    cam2.copy(camera); const corners = []; for (const x of [-W / 2, W / 2]) for (const z of [-D / 2, D / 2]) for (const y of [0, h.ceiling ? e.res.H : 1.2]) corners.push(new THREE.Vector3(h.cx, h.floorY + y, h.cz).addScaledVector(xa, x).addScaledVector(za, z));
    let dist = Math.max(W, D) * 1.6; for (let it = 0; it < 30; it++) { cam2.position.copy(tgt).addScaledVector(dir, dist); cam2.lookAt(tgt); cam2.updateMatrixWorld(); cam2.updateProjectionMatrix();
      let m = 0; for (const c of corners) { const p = c.clone().project(cam2); m = Math.max(m, Math.abs(p.x) * 1.08, Math.abs(p.y) * 1.3); } dist *= Math.pow(m / .8, .7); }
    return { pos: cam2.position.clone(), tgt }; }
  function fly(to, instant) { const from = { pos: camera.position.clone(), tgt: controls.target.clone() }; if (instant || SHOT) { camera.position.copy(to.pos); controls.target.copy(to.tgt); controls.update(); api.clearFixedShadow?.(); return; }
    tween = { from, to, t0: performance.now(), dur: 650 }; loop(); }
  function loop() { cancelAnimationFrame(raf); raf = requestAnimationFrame(tick); }
  function tick() { raf = 0; let more = false;
    if (tween) { const k = Math.min(1, (performance.now() - tween.t0) / tween.dur), s = smooth(k); camera.position.lerpVectors(tween.from.pos, tween.to.pos, s); controls.target.lerpVectors(tween.from.tgt, tween.to.tgt, s); controls.update(); api.clearFixedShadow?.();
      if (k >= 1) tween = null; else more = true; }
    if (decor && !editor?.active && decor.update()) more = true;
    if (cur?.e.head && zEl && !editor?.active) { const p = cur.e.head.clone().applyMatrix4(cur.e.g.matrixWorld).project(camera), r = renderer.domElement.getBoundingClientRect(); zEl.hidden = p.z > 1; zEl.style.left = (r.left + (p.x + 1) / 2 * r.width) + 'px'; zEl.style.top = (r.top + (1 - p.y) / 2 * r.height) + 'px'; more = true; }
    if (more) raf = requestAnimationFrame(tick); }
  // ── the overlay
  let ov = null, zEl = null;
  function ui() { if (ov) return; const css = document.createElement('style');
    css.textContent = `#homeov { position: fixed; left: 14px; bottom: 14px; z-index: 6; width: min(360px, calc(100vw - 28px)); background: #17171b; color: #f7f7f2; box-shadow: 5px 5px 0 #ffc21a; font: 600 12px/1.35 "Arial Black", Impact, sans-serif; padding: 12px 14px 12px; }
#homeov[hidden] { display: none; } #homeov h3 { margin: 0 26px 4px 0; font: 800 17px/1.1 "Arial Black", Impact, sans-serif; color: #ffc21a; text-transform: uppercase; letter-spacing: .02em; }
#homeov .t { color: #9fdcff; text-transform: uppercase; font-size: 11px; letter-spacing: .04em; } #homeov .o { margin: 8px 0 6px; font-size: 14px; } #homeov .o i { font-style: normal; color: #6cff4a; } #homeov .o i.v { color: #ff4fa3; }
#homeov .row { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; } #homeov .row b { background: #f7f7f2; color: #17171b; padding: 3px 6px 2px; font: 800 10px/1.2 "Arial Black", sans-serif; text-transform: uppercase; }
#homeov .row b.s { background: #e8232a; color: #fff; } #homeov .row b span { color: #7a5a00; } #homeov .row b.n { background: #34343c; color: #9a9aa6; } #homeov .row b.g { background: #ffc21a; } #homeov .k { color: #9a9aa6; font-size: 10px; text-transform: uppercase; margin-top: 8px; }
#homeov .nav { display: flex; gap: 6px; margin-top: 10px; } #homeov button { font: 800 11px/1 "Arial Black", sans-serif; text-transform: uppercase; border: 0; background: #f7f7f2; color: #17171b; padding: 7px 9px 6px; cursor: pointer; box-shadow: 2px 2px 0 #ff4fa3; }
#homeov button:hover { background: #ffc21a; } #homeov button:focus-visible { outline: 3px solid #ff4fa3; outline-offset: 2px; } #homeov .x { position: absolute; right: 10px; top: 10px; box-shadow: none; padding: 5px 7px 4px; }
#homezzz { position: fixed; z-index: 5; pointer-events: none; transform: translate(-10%, -120%); font: 800 22px/1 "Arial Black", Impact, sans-serif; color: #fff; text-shadow: 2px 2px 0 #2f5bff; letter-spacing: .08em; animation: homez 2.4s ease-in-out infinite; }
#homezzz small { font-size: 14px; } @keyframes homez { 50% { transform: translate(-10%, -150%); opacity: .75; } } @media (prefers-reduced-motion: reduce) { #homezzz { animation: none; } }`;
    document.head.appendChild(css); ov = document.createElement('div'); ov.id = 'homeov'; if (SHOT) ov.style.cssText = 'top: 14px; bottom: auto'; ov.hidden = true; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'Home'); document.body.appendChild(ov);
    zEl = document.createElement('div'); zEl.id = 'homezzz'; zEl.hidden = true; zEl.innerHTML = '<small>z</small> z Z'; document.body.appendChild(zEl);
    ov.addEventListener('click', ev => { const b = ev.target.closest('button'); if (!b) return; ev.stopPropagation(); if (b.dataset.a === 'x') close(); else if (b.dataset.a === 'edit') edit(); else step(b.dataset.a === 'n' ? 1 : -1); }); }
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  function showOverlay(h, e) { ui(); if (Q.get('overlay') === '0') return; const st = e.st;
    const side = { N: 'north', S: 'south', E: 'east', W: 'west' }[/·([NSEW])$/.exec(h.bld ?? '')?.[1]];   // (fix round: the lot's street address in live mode too, where the feed carries no names)
    const place = h.kind === 'lot' ? (st?.name && st.name !== h.id ? st.name : e.pname ?? h.id.replace('lot:', 'Lot ')) : h.kind === 'tower' ? `${h.bname ? h.bname + ' · ' : ''}${h.addr ?? ''} · ${side && h.pair?.length ? side + ' penthouse' : 'the top floor'}` : `Apt ${h.floor} · ${addressAt(h.cx, h.cz) || 'block ' + h.block}`;
    const who = st?.owner ? `<i>@${esc(st.owner)}</i> · ${st.asleep ? 'asleep' : st.away ? 'out' : 'home'}` : e.show ? '<i class="v">vacant · FOR RENT</i> · show unit, staged' : st?.scars?.size ? '<i class="v">nobody</i>' : '<i class="v">vacant · FOR RENT</i>';
    const sec = Object.keys(SECN).map(k => `<b class="${e.st?.sec?.has(k) ? '' : 'n'}">${SECN[k]}</b>`).join(''), scars = [...(st?.scars ?? [])].map(k => `<b class="s">${SCARN[k] ?? k}</b>`).join('');
    const got = e.fills.map(f => { const o = f && mods.F.infoOf(f.id); return o ? `<b class="g" title="${esc(o.kind)}">${esc(o.name)} <span>${esc(o.rarity === '1of1' ? '1 of 1' : o.rarity)}</span></b>` : ''; }).join('');
    const own = isOwner(h, st), lived = !!st?.owner || e.show, fx = lived && BMod ? e.flex : null;   // (home builder: owner or visitor, the flex readout)
    const mine = own ? `<div class="row" style="margin-top:6px"><b class="g">your home</b>${e.rec ? '<b>edited</b>' : ''}</div>` : lived ? `<div class="row" style="margin-top:6px"><b class="n" style="background:#2f5bff;color:#fff">visiting · read-only</b>${decor?.badges ? '<b class="n">stash + safe locked</b>' : ''}</div>` : '';
    ov.innerHTML = `<button class="x" data-a="x" aria-label="Close">×</button><h3>${esc(place)}</h3><div class="t">${h.tier} · ${e.name.replace(h.tier + '-', '').replace(/-/g, ' ')}${e.src && e.src !== 'demo' ? ' · ' + esc(e.src) : ''}</div>
<div class="o">${who}</div>${mine}${fx ? `<div class="k">flex</div><div class="row">${BMod.flexHTML(fx)}</div>` : ''}<div class="k">security</div><div class="row">${sec}</div>${scars ? `<div class="k">scars</div><div class="row">${scars}</div>` : ''}${got ? `<div class="k">in the slots · ${e.fills.filter(Boolean).length} of ${e.fills.length}</div><div class="row">${got}</div>` : ''}
<div class="nav">${own ? '<button data-a="edit" style="background:#6cff4a">edit home</button>' : ''}<button data-a="p" aria-label="Previous home">‹ prev</button><button data-a="n" aria-label="Next home">next ›</button></div>`;
    ov.hidden = false; }
  // ── open / close / step
  let busy = null;
  async function open(id, { instant = false } = {}) {
    const h = typeof id === 'string' ? index().get(id) : id; if (!h) return false; const t0 = performance.now();
    if (editor?.active) editor.exit();
    busy = h.id; const [e, B] = await Promise.all([build(h), builder()]); if (busy !== h.id) return false;
    if (cur && cur.e !== e) cur.e.g.removeFromParent();
    if (!cur) saved = { pos: camera.position.clone(), tgt: controls.target.clone() };
    scene.add(e.g); e.g.visible = true; e.g.updateMatrixWorld(true); cur = { h, e }; setCut(h, e); attachDecor(B);
    const G = mods.GLOW.value; if (NIGHT) G.setRGB(...(e.st?.lit ? [.55, .42, .26] : [.035, .045, .09])); else G.setRGB(.06, .055, .05);
    fly(frameOf(h, e), instant); showOverlay(h, e); if (zEl) zEl.hidden = !e.head; camera.updateMatrixWorld(); tick(); loop();
    stats.opens++; stats.lastMs = Math.round(performance.now() - t0); stats.buildMs = Math.round(e.ms); stats.last = { id: h.id, layout: e.name, tier: h.tier, wealth: +e.wealth.toFixed(2), tris: e.res.bank.tris(), meshes: e.g.children.length };
    if (Q.has('log')) console.log(`home ${h.id}: ${e.name} · open ${stats.lastMs} ms (build ${stats.buildMs}) · ${e.g.children.length} meshes`);
    return true; }
  function close({ instant = false } = {}) { if (!cur) return; if (editor?.active) editor.exit(); decor?.dispose(); decor = null; cur.e.g.removeFromParent(); cur = null; busy = null; clearCut(); if (ov) ov.hidden = true; if (zEl) zEl.hidden = true;
    if (saved) fly(saved, instant); saved = null; }
  function step(dir) { if (!cur) return; index(); const L = order.filter(x => x.tier === cur.h.tier), k = L.findIndex(x => x.id === cur.h.id), n = L.length; if (!n) return; open(L[((k < 0 ? 0 : k + dir) % n + n) % n]); }   // (fix round: within the tier)
  addEventListener('keydown', ev => { if (!cur || editor?.active || /^(INPUT|SELECT|TEXTAREA)$/.test(ev.target?.tagName || '')) return; if (ev.key === 'Escape') close(); else if (ev.key === ']') step(1); else if (ev.key === '[') step(-1); });
  // ── home builder: the visit decor (lock badges, showcase brackets, the flex numbers) and edit mode (the owner only)
  function attachDecor(B) { decor?.dispose(); decor = null; if (!cur) return; const { h, e } = cur, own = isOwner(h, e.st), lived = !!e.st?.owner || e.show;
    e.flex = B.flexOf([...e.A.items.map(it => it.id), ...e.fills.filter(Boolean).map(f => f.id)]); if (lived) decor = B.decorate({ e, camera, renderer, visitor: !own }); }
  async function edit() { if (!cur || editor?.active || !isOwner(cur.h, cur.e.st)) return false; const B = await builder(), { h, e } = cur;
    const title = ov?.querySelector('h3')?.textContent || h.id; decor?.hide(true); if (ov) ov.hidden = true; if (zEl) zEl.hidden = true;
    editor = B.createEditor({ api, h, e, mods, title, preset: { A: e.A0, fills: e.auto }, onExit: () => { refresh().catch(err => console.warn('home builder: refresh failed', err)); } });
    editor.enter(); H.builder = editor.debug; return true; }
  // after an edit: the room rebuilt from the saved layout, the camera where it is
  async function refresh() { if (!cur) return; const { h } = cur, e = await build(h); if (!cur || cur.h.id !== h.id) return; if (e !== cur.e) { cur.e.g.removeFromParent(); scene.add(e.g); e.g.visible = true; e.g.updateMatrixWorld(true); cur = { h, e }; setCut(h, e); }
    e.g.visible = true; attachDecor(await builder()); showOverlay(h, e); if (zEl) zEl.hidden = !e.head; tick(); loop(); }
  const H = { open, close, step, index, edit, refresh, get editing() { return !!editor?.active; }, isOwner: id => { const h = index().get(id); return isOwner(h, h && cur?.h.id === id ? cur.e.st : null); }, get current() { return cur ? { id: cur.h.id, ...stats.last } : null; }, stats, cache,
    get decor() { return decor && { badges: decor.badges, show: decor.show }; },
    async click(ev) { if (editor?.active) return; const h = await pick(ev); if (h) { if (h.id !== cur?.h.id) await open(h); } else if (cur) close(); }, lastPick, hitAt: (x, y) => sceneHit({ clientX: x, clientY: y }), homeAt };
  // ── ?home=<lot id>: go there, wait for its block's anchors, open it (for links and shots)
  let ready; H.ready = new Promise(r => { ready = r; });   // (shots wait on it: main.js renders once it settles)
  const want = Q.get('home'); if (want) { const m = /^lot:(-?[\d.]+),(-?[\d.]+)/.exec(want) || null, a = /^apt:(-?\d+)_(-?\d+)/.exec(want), xz = m ? [+m[1] + 5, +m[2] + 6] : a ? [(+a[1] + .5) * P, (+a[2] + .5) * P] : null;
    if (xz && !index().has(want)) api.goTo(xz[0], xz[1]);
    const t0 = performance.now(), wait = () => { if (index().has(want)) { open(want, { instant: true }).then(ok => ready(ok), e => { console.warn(e); ready(false); }); return; }
      if (performance.now() - t0 < (SHOT ? 150000 : 45000)) setTimeout(wait, 150); else { console.warn('home not found: ' + want); ready(false); } }; wait(); } else ready(false);
  return H;
}
