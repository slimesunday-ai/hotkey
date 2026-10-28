// MAINLAND WALK v1 (2026-10-06) · walk the neighbourhood as yourself. WALK (the button, or W while browsing; ?walk=1 on the URL) puts you
// on the street: by your plot when the URL names one (?owner=<plot id>), else outside the ferry terminal. A feel system, kept simple:
//   - THIRD PERSON (default): the camera rides ~3.3 m up, a little behind and over your right shoulder, looking slightly down; whatever
//     stands between it and you (a house, a tree, the terminal) is dithered away in a soft cone instead of the camera fighting through.
//     V: FIRST PERSON at eye height, the body hidden, a gentle head bob (B turns it off).
//   - WASD (or the arrows) move, the mouse looks (click for pointer lock; dragging works without it), Shift runs, Space hops, Esc out.
//   - COLLISION: walkgrid.js, built once in a worker from the page's own meshes: houses, fences, hedges, trees, yard pieces, lamps, the
//     terminal, the arch and the residents stop you and you slide along them; curbs, porch steps and the pier deck are stepped up (0.32 m).
//     The shoreline and the map's edge stop you too.
//   - DOORS: at a house's front door, "E · go inside" calls the plot builder's enterHouse (the interior overlay; the owner's rules as in
//     the builder: ?owner=<plot>, everyone else read-only). Leaving puts you back on the step, facing the street.
//   - RESIDENTS: look at one (the screen centre, or the pointer when it's free) for a name card; click to keep it up. Talking comes later.
//   - TOUCH: tap the ground to walk there, drag to look.
// The character is the city's cast (anim/cast: walk2's GPU walk, gait2's cycle, the idles), one look that stays yours (?look=<handle>).
// WALK FEEL (2026-10-06): the third-person camera ORBITS from the mouse (lightly eased) and FOLLOWS you with a little lag; you turn toward
// where you're going at a capped, eased rate (a sharp turn slows you while you come round), speeds ride springs (soft starts and stops),
// the view rises onto a step before you reach it, and stride.js adds the run (its own keyed cycle) and the jump (anticipation, tuck,
// landing squash, dust). Space is buffered a moment and works just after stepping off an edge. First person is unchanged. Tunables: FEEL.
import * as THREE from 'three';
import { walkQuery } from './walkgrid.js';
import { damp, dampAngle, wrap, clamp, spring, limitRate } from '../camera/damp.js';
import { installStride, strideState, preStride, postStride, jumpStart, landed, writeStride, makeDust } from './stride.js';
import * as CH from '../cast.js';
import { bakeSegFull } from '../anim/cast/bake.js';
import { WALK2, createAnimTexture2, animUniforms2, writeGait2, installAnim2 } from '../anim/cast/walk2.js';
import { gait2State, stepGait2 } from '../anim/cast/gait2.js';
import { stepIdle, IDLE_POOL } from '../anim/cast/idle.js';
import { createFineAtlas, installFine, fineAttr } from '../anim/cast/fine.js';
import { tierize } from '../gpu.js';
import { hash } from '../style.js';

const RAD = .28, BODY = 1.45, STEP = .32, WALK_V = 1.45, RUN_V = 3.4, HOP_V = 3.3, GRAV = 14, EYE = 1.42, SENS = .0022;
const TP = { pivot: 1.2, dist: 5.4, pitch: -.36, shoulder: .45, fov: 55 }, FP = { fov: 66 };
// the feel (half-lives in s, camera/damp.js; rates in rad/s): accel/runAccel/stop/air the speed springs; turnMax/turnAcc the body's turn;
// pivot the speed kept while facing away from where you steer (a sharp turn comes round first); look the third-person orbit's easing;
// followXZ/followY/followAir the camera's lag; stepHl/stepAhead the view over steps; buffer/coyote the jump's grace; turnLean/omegaMax the
// lean into a turn and the head's lead
const FEEL = { accel: .075, runAccel: .12, stop: .065, air: .3, turnMax: 10, turnAcc: 70, pivot: .25, look: .035, followXZ: .07, followY: .12, followAir: .3,
  stepHl: .055, stepAhead: .34, buffer: .12, coyote: .1, turnLean: .035, omegaMax: 2 };
const BOUNDS = { x0: -214, z0: -334, x1: 286, z1: 34 };

export function init(ML) {
  const { scene, camera, renderer, ctl, PLAN, Q, NIGHT, LAWN, FRAME, FOLK, mlb } = ML, canvas = renderer.domElement;
  const S = { on: false, inside: false, fp: false, bob: true, locked: false, drag: null, p: new THREE.Vector3(), vy: 0, ground: true, vel: new THREE.Vector2(), yaw: Math.PI, body: Math.PI,
    camYaw: Math.PI, camPitch: TP.pitch, vYaw: Math.PI, vPitch: TP.pitch, sv: [{ x: 0, v: 0 }, { x: 0, v: 0 }], vs: { x: 0, v: 0 }, turn: { w: 0 }, omega: 0, wishYaw: null,
    jumpAt: null, jumping: false, airT: 0, leftGround: -1, vis: new THREE.Vector3(), piv: new THREE.Vector3(), keys: new Set(), door: null, target: null, lastFit: new THREE.Vector3(1e9, 0, 0), t: 0, fov0: camera.fov, grid: null, Wq: null, building: null, sig: '' };

  // ── UI: the WALK button (with the page's links), the HUD, the door prompt, the name card
  const css = document.createElement('style'); css.textContent = `
  #wk-btn { background: #ffc21a !important; color: #17171b; cursor: pointer; }
  #wk-btn:hover { background: #fff !important; }
  #wk-hud, #wk-door, #wk-card, #wk-load { position: fixed; font: 800 12px/1.25 "Arial Black", Impact, sans-serif; color: #17171b; pointer-events: none; z-index: 30; }
  #wk-hud { left: 14px; bottom: 14px; background: rgba(255,255,255,.9); padding: 8px 10px; box-shadow: 3px 3px 0 #17171b; text-transform: uppercase; letter-spacing: .02em; }
  #wk-hud b { background: #17171b; color: #ffc21a; padding: 1px 5px; margin-right: 3px; }
  #wk-hud .wk-x { pointer-events: auto; cursor: pointer; margin-left: 8px; background: #ffc21a; padding: 1px 6px; }
  #wk-door { left: 50%; top: 62%; transform: translateX(-50%); background: #17171b; color: #fff; padding: 9px 14px; text-transform: uppercase; box-shadow: 3px 3px 0 #ffc21a; text-align: center; }
  #wk-door b { color: #ffc21a; } #wk-door small { display: block; font: 700 10px/1.4 Arial, sans-serif; color: #cfcfd6; text-transform: none; margin-top: 2px; }
  #wk-card { background: #fff; padding: 8px 11px 7px; box-shadow: 3px 3px 0 #17171b; transform: translate(-50%, -100%); white-space: nowrap; }
  #wk-card .nm { font-size: 13px; } #wk-card .sb { font: 700 10px/1.4 Arial, sans-serif; color: #55555e; }
  #wk-load { left: 50%; top: 45%; transform: translate(-50%, -50%); background: #17171b; color: #ffc21a; padding: 10px 14px; text-transform: uppercase; }
  #wk-dot { position: fixed; left: 50%; top: 50%; width: 4px; height: 4px; margin: -2px 0 0 -2px; background: #fff; border-radius: 50%; box-shadow: 0 0 0 1px rgba(0,0,0,.45); pointer-events: none; z-index: 30; }
  body.walking .ui a:not(#wk-btn) { display: none; }
  body.walking #stage canvas { cursor: crosshair; }`;
  document.head.appendChild(css);
  const el = (id, html = '') => { const d = document.createElement('div'); d.id = id; d.innerHTML = html; d.hidden = true; document.body.appendChild(d); return d; };
  const hud = el('wk-hud'), doorEl = el('wk-door'), card = el('wk-card'), load = el('wk-load', 'stepping onto the street…'), dot = el('wk-dot');
  const setHud = () => { hud.innerHTML = `<b>WASD</b>move <b>mouse</b>look <b>shift</b>run <b>space</b>hop <b>V</b>${S.fp ? 'third' : 'first'} person${S.fp ? ` <b>B</b>bob ${S.bob ? 'on' : 'off'}` : ''} <b>esc</b>out<span class="wk-x" data-x="1">✕ exit</span>`; };
  hud.addEventListener('click', ev => { if (ev.target.dataset.x) stop(); });
  const btn = document.createElement('a'); btn.id = 'wk-btn'; btn.href = '?walk=1'; btn.textContent = 'Walk'; btn.title = 'Walk the neighbourhood (W)';
  btn.addEventListener('click', ev => { ev.preventDefault(); S.on ? stop() : start(); });
  document.querySelector('.ui')?.appendChild(btn);

  // ── the walk grid: gathered from the scene's own meshes (the page's materials only), built in a worker, rebuilt when a lot changes
  const OWN = new Set([...ML.MAT, ...(ML.FARMAT || []), ...(ML.CMATS || []), ML.GOLDM, ML.PANE, ML.GMAT].filter(Boolean));   // (GMAT: the lawn-mapped ground)
  const lotSig = () => [...ML.lotGroups.values()].map(g => g.uuid).join(',');
  function gather() { const parts = [], m4 = new THREE.Matrix4(), v = new THREE.Vector3(); scene.updateMatrixWorld();
    scene.traverse(m => { if (!m.isMesh || m === you || !OWN.has(Array.isArray(m.material) ? m.material[0] : m.material)) return;
      for (let p = m; p; p = p.parent) if (!p.visible) return;
      const g = m.geometry, pa = g.attributes.position, na = g.attributes.normal; if (!pa || !na || pa.count < 4 || pa.count % 4) return;
      if (!g.boundingBox) g.computeBoundingBox(); const bb = g.boundingBox;
      const ground = !m.isInstancedMesh && bb.max.y <= .25 && bb.max.x - bb.min.x > 40;
      const N = na.array.constructor === Float32Array ? na.array : Float32Array.from(na.array);
      const xf = (mw) => { const P = new Float32Array(pa.count * 3); for (let k = 0; k < pa.count; k++) { v.fromBufferAttribute(pa, k).applyMatrix4(mw); P[k * 3] = v.x; P[k * 3 + 1] = v.y; P[k * 3 + 2] = v.z; } return P; };
      if (m.isInstancedMesh) { for (let k = 0; k < m.count; k++) { m.getMatrixAt(k, m4); m4.premultiply(m.matrixWorld); if (Math.abs(m4.determinant()) < 1e-9) continue; parts.push({ P: xf(m4), N, ground: false }); } return; }
      const id = m.matrixWorld.equals(new THREE.Matrix4()); parts.push({ P: id ? pa.array : xf(m.matrixWorld), N, ground }); });
    return parts; }
  function buildGrid() { if (S.building) return S.building; const sig = lotSig(), t0 = performance.now(), parts = gather(), t1 = performance.now();
    S.building = new Promise((res, rej) => { const w = new Worker(new URL('./walkgrid.js', import.meta.url), { type: 'module' });
      w.onmessage = e => { w.terminate(); S.building = null; if (e.data.error) { rej(e.data.error); return; } S.grid = e.data; S.Wq = walkQuery(e.data); S.sig = sig;
        S.stats = { gatherMs: Math.round(t1 - t0), workerMs: Math.round(e.data.ms), totalMs: Math.round(performance.now() - t0), quads: e.data.quads, spans: e.data.spans, parts: parts.length }; res(S.Wq); };
      w.onerror = e => { w.terminate(); S.building = null; rej(e.message || e); };
      const soft = []; for (const g of ML.lotGroups.values()) if (g.visible !== false) soft.push(...(g.userData.soft || []));   // (the lots' walk-through decor: beds, the hose, sprinkler heads)
      w.postMessage({ ...BOUNDS, parts, soft }); });
    return S.building; }

  // ── you: one cast look on walk2's GPU walk (a one-slot BatchedMesh, the same path as the city's walkers), a soft blob for a shadow
  let seed = ML.seed ?? 0x00c0ffee; for (let k = 0; k < 64 && (CH.rollLook(seed).hair?.id ?? 'none') === 'none'; k++) seed++;   // (yours: the first roll with hair from your player id's seed, chat.js; else a fixed one)
  const look = (Q.get('look') && CH.LOOKS.find(l => l.handle === Q.get('look'))) || CH.rollLook(seed);
  const full = bakeSegFull(THREE, CH, look), atlas = createFineAtlas(THREE); atlas.adopt(full);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(full.P, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(full.N, 3, true));
  geo.setAttribute('color', new THREE.BufferAttribute(full.C, 4, true)); geo.setAttribute('aPart', new THREE.BufferAttribute(new Float32Array(full.K), 1)); geo.setAttribute('aFine', fineAttr(THREE, full)); geo.setIndex(new THREE.BufferAttribute(full.I, 1));
  geo.computeBoundingBox(); const TALL = geo.boundingBox.max.y;
  const youMat = tierize(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .62, metalness: 0 }), { vmat: true }); youMat.customProgramCacheKey = () => 'ml-you'; installFine(youMat, atlas);
  const animTex = createAnimTexture2(1), [uni, GAIT] = animUniforms2(animTex, WALK2, { turnLean: FEEL.turnLean }); installAnim2(youMat, uni); const RK = installStride(youMat, uni);
  const you = new THREE.BatchedMesh(1, geo.attributes.position.count, geo.index.count, youMat); you.addInstance(you.addGeometry(geo)); you.frustumCulled = false; you.perObjectFrustumCulled = false; you.castShadow = false; you.receiveShadow = true; you.visible = false; you.name = 'walk:you';
  const blob = new THREE.Mesh(new THREE.CircleGeometry(.36, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .26, depthWrite: false })); blob.renderOrder = 1; blob.visible = false;
  scene.add(you, blob);
  const dust = makeDust(scene), ST = strideState(), SCL = new THREE.Vector3();
  const gait = gait2State({ idle: 0 }), M4 = new THREE.Matrix4(), QY = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0), ONE = new THREE.Vector3(1, 1, 1);

  // ── the see-through: every page material discards, in a 4×4 dither, what lies in the cone between the camera and you (above the curb,
  // so the ground stays), and what is within a metre or so of the camera (third person only)
  const U = { uWalkOn: { value: 0 }, uWalkA: { value: new THREE.Vector3() }, uWalkB: { value: new THREE.Vector3() }, uWalkFeet: { value: 0 }, uWalkNear: { value: 1 }, uWalkVI: { value: new THREE.Matrix4() } };
  let fadeOn = false;
  function installFade() { if (fadeOn) return; fadeOn = true;
    for (const mat of OWN) { const prev = mat.onBeforeCompile, key = mat.customProgramCacheKey?.bind(mat);
      mat.onBeforeCompile = (sh, r) => { prev?.call(mat, sh, r); Object.assign(sh.uniforms, U);
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform mat4 uWalkVI; varying vec3 vWalkW;').replace('#include <project_vertex>', '#include <project_vertex>\n  vWalkW = ( uWalkVI * mvPosition ).xyz;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
uniform float uWalkOn, uWalkFeet, uWalkNear; uniform vec3 uWalkA, uWalkB; varying vec3 vWalkW;
float walkBayer( vec2 p ) { ivec2 q = ivec2( mod( p, 4. ) ); int i = q.x + q.y * 4; int b[16] = int[16]( 0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5 ); return ( float( b[i] ) + .5 ) / 16.; }`)
          .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
  if ( uWalkOn > .5 ) { float th = walkBayer( gl_FragCoord.xy ); vec3 ab = uWalkB - uWalkA; float t = clamp( dot( vWalkW - uWalkA, ab ) / max( dot( ab, ab ), 1e-4 ), 0., 1. );
    float r = mix( .55, 1.2, t ), d = length( vWalkW - ( uWalkA + ab * t ) );
    if ( t < .97 && vWalkW.y > uWalkFeet + .32 && 1. - smoothstep( r * .6, r, d ) > th ) discard;
    float n = length( vWalkW - uWalkA ); if ( uWalkNear > .5 && 1. - smoothstep( .5, 1.3, n ) > th ) discard; }`); };
      mat.customProgramCacheKey = () => (key ? key() : '') + '|walkfade'; mat.needsUpdate = true; } }

  // ── input: captured at the window while walking, so the plot builder and the orbit controls never see it
  const MOVE = { KeyW: [0, 1], ArrowUp: [0, 1], KeyS: [0, -1], ArrowDown: [0, -1], KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0] };
  addEventListener('keydown', ev => {
    if (!S.on) { if (ev.code === 'KeyW' && !ev.metaKey && !ev.ctrlKey && !ev.altKey && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '') && (!mlb || mlb.mode !== 'build')) { ev.preventDefault(); ev.stopImmediatePropagation(); start(); } return; }
    if (S.inside) return; ev.stopImmediatePropagation();
    if (ev.metaKey || ev.ctrlKey) return;
    if (MOVE[ev.code] || ev.code === 'Space') ev.preventDefault();
    S.keys.add(ev.code); S.target = null;
    if (ev.repeat) return;
    if (ev.code === 'Escape') { if (S.locked) document.exitPointerLock?.(); else stop(); }
    else if (ev.code === 'KeyV') { S.fp = !S.fp; if (!S.fp) S.camPitch = Math.min(S.camPitch, TP.pitch * .5); setHud(); }
    else if (ev.code === 'KeyB') { S.bob = !S.bob; setHud(); }
    else if (ev.code === 'KeyE' && S.door) goIn(S.door);
    else if (ev.code === 'Space') S.jumpAt = S.t;   // (buffered: physics takes it on the ground, or just after an edge)
  }, true);
  addEventListener('keyup', ev => { S.keys.delete(ev.code); if (S.on && !S.inside) ev.stopImmediatePropagation(); }, true);
  addEventListener('blur', () => S.keys.clear());
  const onCanvas = ev => ev.target === canvas;
  const look_ = (dx, dy) => { S.camYaw = wrap(S.camYaw - dx * SENS); S.camPitch = clamp(S.camPitch - dy * SENS, S.fp ? -1.35 : -1.15, S.fp ? 1.25 : .3); };
  const aim = { x: 0, y: 0, free: false };
  for (const type of ['pointerdown', 'pointermove', 'pointerup', 'wheel', 'click', 'dblclick', 'contextmenu']) addEventListener(type, ev => {
    if (!S.on || S.inside || !onCanvas(ev)) return; ev.stopImmediatePropagation(); if (type === 'contextmenu' || type === 'wheel') ev.preventDefault();
    if (type === 'pointerdown') { S.drag = { x: ev.clientX, y: ev.clientY, id: ev.pointerId, moved: 0, touch: ev.pointerType === 'touch' }; try { canvas.setPointerCapture(ev.pointerId); } catch {}
      if (!S.locked && ev.pointerType === 'mouse' && ev.button === 0 && !Q.has('nolock')) { try { const r = canvas.requestPointerLock?.(); r?.catch?.(() => {}); } catch {} } }
    else if (type === 'pointermove') { aim.x = ev.clientX; aim.y = ev.clientY; aim.free = !S.locked;
      if (S.locked) look_(ev.movementX || 0, ev.movementY || 0);
      else if (S.drag && S.drag.id === ev.pointerId) { const dx = ev.clientX - S.drag.x, dy = ev.clientY - S.drag.y; S.drag.x = ev.clientX; S.drag.y = ev.clientY; S.drag.moved += Math.abs(dx) + Math.abs(dy); look_(dx * (S.drag.touch ? 1.6 : 1), dy * (S.drag.touch ? 1.6 : 1)); } }
    else if (type === 'pointerup') { const d = S.drag; S.drag = null; if (!d) return;
      if (d.moved < 6) { if (hov) { pin = { f: hov, until: S.t + 4 }; } else if (d.touch) tapTo(ev.clientX, ev.clientY); } }
    else if (type === 'wheel' && !S.fp) TP.dist = clamp(TP.dist + Math.sign(ev.deltaY) * .4, 3.2, 8);
  }, true);
  document.addEventListener('pointerlockchange', () => { S.locked = document.pointerLockElement === canvas; aim.free = !S.locked; });
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), gplane = new THREE.Plane(UP, 0), hit = new THREE.Vector3();
  function tapTo(cx, cy) { const r = canvas.getBoundingClientRect(); ndc.set((cx - r.left) / r.width * 2 - 1, -(cy - r.top) / r.height * 2 + 1); ray.setFromCamera(ndc, camera); gplane.constant = -(S.p.y);
    if (ray.ray.intersectPlane(gplane, hit) && hit.distanceTo(S.p) < 60) S.target = hit.clone(); }

  // ── doors: from the plot builder (the house as it stands, its door's patch), refreshed each time you start walking
  let DOORS = [];
  const refreshDoors = () => { DOORS = mlb?.doorOf ? PLAN.plots.map(P => mlb.doorOf(P.id)).filter(Boolean) : []; };
  function goIn(d) { S.back = d; S.keys.clear(); doorEl.hidden = true; if (S.locked) document.exitPointerLock?.(); S.inside = true; S.entered = false; mlb.enter(d.id); setTimeout(() => { if (S.inside && !S.entered) { S.inside = false; S.last = performance.now(); } }, 4000); }   // (an interior that never opened gives the street back)
  addEventListener('ml:inside', () => { if (S.on) { S.inside = S.entered = true; hud.hidden = dot.hidden = card.hidden = doorEl.hidden = true; } });
  addEventListener('ml:outside', () => { if (!S.on) return; S.inside = false; hud.hidden = false; dot.hidden = !S.locked;
    const d = S.back; if (d) { const l = Math.hypot(d.out[0], d.out[1]) || 1, ox = d.out[0] / l, oz = d.out[1] / l; placeAt(d.x + ox * 1.1, d.z + oz * 1.1, Math.atan2(ox, oz)); } S.last = performance.now(); });

  // ── residents: FOLK (main.js person(): every baked resident's look and spot), a card for the one you look at
  let hov = null, pin = null; const V3 = new THREE.Vector3();
  const folkName = f => { const h = f.handle || ''; if (!/^roll_/.test(h)) return '@' + h; const L = CH.LOOKS; return '@' + (L[(hash(parseInt(h.slice(5), 16) || 7, 91) * L.length) | 0]?.handle ?? 'neighbour'); };
  const folkWhere = f => { if (f.sc > 2) return 'the trophy on the lawn · gold'; const d = f.lot && DOORS.find(o => o.id === f.lot); return d ? `lives at ${d.addr}` : 'out and about on the Mainland'; };
  function pickFolk() { const r = canvas.getBoundingClientRect(), ax = aim.free ? aim.x : r.left + r.width / 2, ay = aim.free ? aim.y : r.top + r.height / 2; let best = null, bd = 1e9;
    for (const f of FOLK) { const dx = f.x - S.p.x, dz = f.z - S.p.z, dd = dx * dx + dz * dz; if (dd > 14 * 14) continue; V3.set(f.x, f.y + .7 * (f.sc || 1), f.z).project(camera); if (V3.z > 1 || V3.z < -1) continue;
      const sx = r.left + (V3.x + 1) / 2 * r.width, sy = r.top + (1 - V3.y) / 2 * r.height, px = Math.hypot(sx - ax, sy - ay), lim = clamp(260 / Math.sqrt(dd + .01), 26, 120) * (f.sc || 1);
      if (px < lim && px < bd) { bd = px; best = { f, sx, sy }; } }
    return best; }

  // ── start / stop
  function placeAt(x, z, yaw) { const Wq = S.Wq; let y = Wq ? Wq.floorAt(x, z, 3) : LAWN; if (!isFinite(y)) y = LAWN;
    S.p.set(x, y, z); S.vis.copy(S.p); S.vy = 0; S.ground = true; S.vel.set(0, 0); S.body = S.yaw = yaw; S.camYaw = S.vYaw = yaw; S.camPitch = S.vPitch = S.fp ? 0 : TP.pitch; S.piv.set(x, y + TP.pivot, z);
    for (const c of S.sv) c.x = c.v = 0; S.vs.x = y; S.vs.v = 0; S.turn.w = S.omega = 0; S.wishYaw = S.jumpAt = null; S.jumping = false; Object.assign(ST, strideState());
    if (Wq && blockedAt(x, z, y)) { const f = freeNear(x, z, y); if (f) S.p.set(f[0], Wq.floorAt(f[0], f[1], y + STEP), f[1]), S.vis.copy(S.p), S.piv.set(S.p.x, S.p.y + TP.pivot, S.p.z), S.vs.x = S.p.y; } }
  function spawn() { const own = (Q.get('owner') || '').split(',')[0], P = PLAN.plots.find(p => p.id === own);
    if (P) { const [x, z] = ML.toW(P.rect, 0, 2.2), [ix, iz] = ML.toW(P.rect, 0, 1.2); return placeAt(x, z, Math.atan2(ix - x, iz - z)); }
    placeAt(5.2, -13.5, Math.PI - .25); }   // outside the ferry terminal, Harbor Rd ahead
  async function start() { if (S.on) return; if (mlb && mlb.mode === 'build') mlb.done?.(); S.on = true; document.body.classList.add('walking'); btn.textContent = 'Exit walk';
    UIH(false); mlb?.select?.(null); refreshDoors();
    if (!S.Wq || S.sig !== lotSig()) { load.hidden = false; try { await buildGrid(); } catch (e) { console.warn('walk grid failed', e); load.textContent = 'could not build the street'; S.on = false; return; } load.hidden = true; }
    if (!S.on) return;
    installFade(); spawn(); S.fov0 = camera.fov; camera.fov = S.fp ? FP.fov : TP.fov; camera.updateProjectionMatrix(); if (ctl) ctl.enabled = false;
    you.visible = !S.fp; blob.visible = true; hud.hidden = false; setHud(); S.last = performance.now(); S.lastFit.set(1e9, 0, 0); U.uWalkOn.value = 1; frame(0, true); }
  function stop() { if (!S.on) return; S.on = false; if (S.locked) document.exitPointerLock?.(); document.body.classList.remove('walking'); btn.textContent = 'Walk';
    you.visible = blob.visible = false; dust.hide(); hud.hidden = doorEl.hidden = card.hidden = dot.hidden = true; load.hidden = true; U.uWalkOn.value = 0; S.keys.clear();
    camera.fov = S.fov0; camera.updateProjectionMatrix(); if (ctl) { ctl.enabled = true; ctl.target.copy(S.p).setY(S.p.y + 1); ctl.update(); } UIH(true); ML.fit(); }
  const HID = ['mb-card', 'mb-hint', 'mb-tip'], hidden = new Map();
  function UIH(on) { for (const id of HID) { const e = document.getElementById(id); if (!e) continue; if (!on) { hidden.set(id, e.style.visibility); e.style.visibility = 'hidden'; } else if (hidden.has(id)) { e.style.visibility = hidden.get(id); hidden.delete(id); } } }

  // ── the physics: a 0.28 m circle against the grid's wall columns (deepest first, so it slides), stepped ≤ 6 cm at a time
  const step_ = () => S.ground ? STEP : .06;
  function blockedAt(x, z, y) { const W_ = S.Wq, cs = W_.cs, i0 = Math.floor((x - RAD - W_.x0) / cs), i1 = Math.floor((x + RAD - W_.x0) / cs), j0 = Math.floor((z - RAD - W_.z0) / cs), j1 = Math.floor((z + RAD - W_.z0) / cs);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const cx0 = W_.x0 + i * cs, cz0 = W_.z0 + j * cs, qx = clamp(x, cx0, cx0 + cs), qz = clamp(z, cz0, cz0 + cs);
      if ((x - qx) ** 2 + (z - qz) ** 2 < RAD * RAD - 1e-6 && W_.wallC(i < 0 || j < 0 || i >= W_.NX || j >= W_.NZ ? -1 : j * W_.NX + i, y, step_(), BODY)) return true; } return false; }
  function resolve(x, z, y) { const W_ = S.Wq, cs = W_.cs;
    for (let it = 0; it < 6; it++) { let best = 0, nx = 0, nz = 0; const i0 = Math.floor((x - RAD - W_.x0) / cs), i1 = Math.floor((x + RAD - W_.x0) / cs), j0 = Math.floor((z - RAD - W_.z0) / cs), j1 = Math.floor((z + RAD - W_.z0) / cs);
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const cx0 = W_.x0 + i * cs, cz0 = W_.z0 + j * cs, cx1 = cx0 + cs, cz1 = cz0 + cs, qx = clamp(x, cx0, cx1), qz = clamp(z, cz0, cz1), dx = x - qx, dz = z - qz, d2 = dx * dx + dz * dz;
        if (d2 >= RAD * RAD) continue; if (!W_.wallC(i < 0 || j < 0 || i >= W_.NX || j >= W_.NZ ? -1 : j * W_.NX + i, y, step_(), BODY)) continue;
        let pen, ux, uz; if (d2 > 1e-10) { const d = Math.sqrt(d2); pen = RAD - d; ux = dx / d; uz = dz / d; }
        else { const l = x - cx0, rr = cx1 - x, b = z - cz0, t = cz1 - z, m = Math.min(l, rr, b, t); pen = RAD + m; ux = m === l ? -1 : m === rr ? 1 : 0; uz = m === b ? -1 : m === t ? 1 : 0; if (ux && uz) uz = 0; }
        if (pen > best) { best = pen; nx = ux; nz = uz; } }
      if (best <= 0) return [x, z]; x += nx * (best + 1e-4); z += nz * (best + 1e-4); }
    return blockedAt(x, z, y) ? null : [x, z]; }
  function freeNear(x, z, y) { for (let r = .2; r < 4; r += .2) for (let a = 0; a < 16; a++) { const px = x + Math.sin(a / 16 * 6.283) * r, pz = z + Math.cos(a / 16 * 6.283) * r, fy = S.Wq.floorAt(px, pz, y + STEP);
    if (isFinite(fy) && !blockedAt(px, pz, fy)) return [px, pz]; } return null; }
  function physics(dt) { const Wq = S.Wq;
    // the wish: WASD in the view's frame (or the tap target). Its speed rides a spring (a soft start, a soft stop); in third person a wish
    // that points away from where you face is slowed until you come round (a sharp turn is a pivot, not a skid)
    let ix = 0, iz = 0; for (const k of S.keys) { const m = MOVE[k]; if (m) { ix += m[0]; iz += m[1]; } }
    if (S.target) { if (Math.hypot(S.target.x - S.p.x, S.target.z - S.p.z) < .3) S.target = null; else { ix = 0; iz = 1; } }
    const il = Math.hypot(ix, iz), run = S.keys.has('ShiftLeft') || S.keys.has('ShiftRight');
    let wx = 0, wz = 0; S.wishYaw = null;
    if (il > 0) { const fx = Math.sin(S.vYaw), fz = Math.cos(S.vYaw), rx = -fz, rz = fx; let dx = (fx * iz + rx * ix) / il, dz = (fz * iz + rz * ix) / il, sp = run ? RUN_V : WALK_V;
      if (S.target) { const tx = S.target.x - S.p.x, tz = S.target.z - S.p.z, l = Math.hypot(tx, tz); dx = tx / l; dz = tz / l; sp = WALK_V * 1.3; }
      S.wishYaw = Math.atan2(dx, dz); if (!S.fp && S.ground) { const al = Math.max(0, Math.cos(wrap(S.wishYaw - S.body))); sp *= FEEL.pivot + (1 - FEEL.pivot) * al * al; }
      wx = dx * sp; wz = dz * sp; }
    const hl = !S.ground ? FEEL.air : il > 0 ? (run ? FEEL.runAccel : FEEL.accel) : FEEL.stop;
    S.sv[0].x = S.vel.x; S.sv[1].x = S.vel.y; spring(S.sv[0], wx, hl, dt); spring(S.sv[1], wz, hl, dt); S.vel.set(S.sv[0].x, S.sv[1].x);
    // the jump: a buffered press, taken on the ground (or just after walking off an edge): the crouch first (stride.js), then the hop
    if (S.jumpAt !== null && S.t - S.jumpAt > FEEL.buffer) S.jumpAt = null;
    if (S.jumpAt !== null && !S.jumping && !(ST.antic > 0) && (S.ground || S.t - S.leftGround < FEEL.coyote)) { S.jumpAt = null; S.jumping = true; S.airT = 0; jumpStart(ST, gait);
      if (!S.ground) { ST.antic = 0; S.vy = HOP_V; } }   // (off an edge: no crouch, straight up)
    if (S.jumping && S.ground && !(ST.antic > 0)) { S.vy = HOP_V; S.ground = false; S.airT = 0; }
    // move in small steps, sliding; the floor under you each step (up a step at once, the view eases it; down with gravity)
    const x0 = S.p.x, z0 = S.p.z, dist = Math.hypot(S.vel.x, S.vel.y) * dt, n = Math.max(1, Math.ceil(dist / .06));
    for (let k = 0; k < n; k++) { const r = resolve(S.p.x + S.vel.x * dt / n, S.p.z + S.vel.y * dt / n, S.p.y); if (!r) break;
      const fy = Wq.floorAt(r[0], r[1], S.p.y + step_()); if (!isFinite(fy)) break;
      if (S.ground && fy > S.p.y) { if (blockedAt(r[0], r[1], fy)) break; S.p.y = fy; } S.p.x = r[0]; S.p.z = r[1]; }
    const moved = Math.hypot(S.p.x - x0, S.p.z - z0); if (S.target && moved < .2 * dist) S.target = null;   // (a tap target that walks into a wall gives up)
    if (dist > 1e-6 && dt > 0 && moved < dist * .999) { S.vel.set((S.p.x - x0) / dt, (S.p.z - z0) / dt); S.sv[0].v = S.sv[1].v = 0; }   // (blocked: the velocity is what the slide left)
    // vertical: down a step stays on the ground (the view eases it), further is a fall; gravity, landing, a ceiling for the hop
    const fy = Wq.floorAt(S.p.x, S.p.z, S.p.y + (S.ground ? STEP : .06));
    if (S.ground && fy < S.p.y - .02) { if (fy >= S.p.y - STEP && !S.jumping) S.p.y = fy; else { S.ground = false; S.leftGround = S.t; } }
    if (!S.ground) { S.airT += dt; S.vy -= GRAV * dt; let ny = S.p.y + S.vy * dt; if (S.vy > 0) { const c = Wq.ceilC(Wq.col(S.p.x, S.p.z), S.p.y + BODY - .01); if (ny + BODY > c) { ny = c - BODY; S.vy = 0; } }
      const f2 = Wq.floorAt(S.p.x, S.p.z, Math.max(S.p.y, ny) + .02);
      if (ny <= f2) { const hit = -S.vy; ny = f2; S.vy = 0; S.ground = true; landed(ST, hit); if (S.jumping || hit > 3) dust.puff(S.p.x, f2, S.p.z, clamp(hit / HOP_V, .5, 1.3)); S.jumping = false; }
      S.p.y = ny; }
    return moved; }

  // ── one frame: physics (sub-stepped at ≤ 1/120 s), the body, the gait, the camera, the see-through, the door, the cards
  const fwd = new THREE.Vector3(), tmp = new THREE.Vector3();
  function frame(_, force = false) {
    if (!S.on || S.inside || !S.Wq) return;
    const now = performance.now(); try { frame_(now, force); } finally { S.cpu = (S.cpu ?? 0) * .9 + (performance.now() - now) * .1; } }
  function frame_(now, force) {
    const dt = force ? 0 : Math.min(.1, Math.max(0, (now - S.last) / 1000)); S.last = now; S.t += dt;
    // the view: third person eases its orbit toward the mouse's (bursty input reads as a glide, not a stutter); first person stays raw
    if (S.fp || force) { S.vYaw = S.camYaw; S.vPitch = S.camPitch; } else { S.vYaw = dampAngle(S.vYaw, S.camYaw, FEEL.look, dt); S.vPitch = damp(S.vPitch, S.camPitch, FEEL.look, dt); }
    let moved = 0; const nsub = Math.max(1, Math.ceil(dt * 120)); for (let k = 0; k < nsub && dt > 0; k++) moved += physics(dt / nsub);
    const sp = dt > 0 ? moved / dt : 0;
    // the body turns toward where you steer at a capped, eased rate (camera/damp.js limitRate); the lean and the head's lead take that
    // rate, smoothed and capped (never the raw per-frame swing)
    if (S.fp) { S.body = S.camYaw; S.turn.w = 0; }
    else if (S.wishYaw !== null) S.body = limitRate(S.body, S.wishYaw, FEEL.turnMax, FEEL.turnAcc, dt, S.turn);   // (no wish: you keep facing; a slide's leftover never spins you)
    else S.turn.w = damp(S.turn.w, 0, .05, dt);
    S.omega = damp(S.omega, S.turn.w, .08, dt); gait.omega = clamp(S.omega, -FEEL.omegaMax, FEEL.omegaMax);
    // the visible you: over a step the body rises a stride early (the floor just ahead), on a spring; in the air it's the physics
    let ty = S.p.y; const vl = Math.hypot(S.vel.x, S.vel.y);
    if (S.ground && vl > .3) for (let d = .06; d <= FEEL.stepAhead + 1e-6; d += .04) { const ax = S.p.x + S.vel.x / vl * d, az = S.p.z + S.vel.y / vl * d, fa = S.Wq.floorAt(ax, az, S.p.y + STEP);
      if (isFinite(fa) && fa > S.p.y + .03) { if (!blockedAt(ax, az, fa)) ty = S.p.y + (fa - S.p.y) * clamp(1.15 - d / FEEL.stepAhead, 0, 1); break; } }
    if (S.ground && !force) { spring(S.vs, ty, FEEL.stepHl, dt); if (Math.abs(S.vs.x - S.p.y) > .6) { S.vs.x = S.p.y; S.vs.v = 0; } } else { S.vs.x = S.p.y; S.vs.v = 0; }   // (the landing's give is the crouch's, stride.js)
    S.vis.x = S.p.x; S.vis.z = S.p.z; S.vis.y = S.vs.x;
    // the gait on the distance actually covered; the run blends in by speed, the jump's crouch / tuck / squash (stride.js)
    preStride(ST, gait, GAIT, RK, S.ground ? sp : Math.hypot(S.vel.x, S.vel.y), WALK_V, RUN_V, dt);
    stepGait2(gait, moved, dt, WALK2, GAIT, 0); gait.hp = clamp(gait.hp, -.12, .12); gait.hr = clamp(gait.hr, -.1, .1); stepIdle(gait, sp < .05 && S.ground && !S.jumping, dt, () => IDLE_POOL[(Math.random() * IDLE_POOL.length) | 0]);
    const fy = S.Wq.floorAt(S.p.x, S.p.z, S.p.y + .05);
    const sq = postStride(ST, gait, RK, dt, S.ground ? null : { jump: S.jumping, vy: S.vy, h: S.p.y - fy, t: S.airT });
    ML.onGait?.(gait, dt, S);   // (chat.js: your emote's pose)
    writeGait2(animTex.image.data, 1, 0, gait); animTex.needsUpdate = true; writeStride(uni, ST); dust.update(dt);
    QY.setFromAxisAngle(UP, S.body); M4.compose(S.vis, QY, SCL.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq))); you.setMatrixAt(0, M4); you.visible = !S.fp;
    blob.position.set(S.p.x, (isFinite(fy) ? fy : S.p.y) + .012, S.p.z); blob.scale.setScalar(clamp(1 - (S.p.y - fy) * .6, .4, 1));
    // the camera: the pivot follows with a little lag (slower up and down, slower still in the air: a hop doesn't bounce the view)
    if (force) S.piv.set(S.vis.x, S.vis.y + TP.pivot, S.vis.z);
    else { S.piv.x = damp(S.piv.x, S.vis.x, FEEL.followXZ, dt); S.piv.z = damp(S.piv.z, S.vis.z, FEEL.followXZ, dt); S.piv.y = damp(S.piv.y, S.vis.y + TP.pivot, S.ground ? FEEL.followY : FEEL.followAir, dt); }
    if (S.fp) { const bob = S.bob ? Math.sin(gait.u * Math.PI * 4) * .028 * gait.w * clamp(sp / 1.5, 0, 1.4) : 0;
      camera.position.set(S.vis.x, S.vis.y + EYE + bob, S.vis.z); fwd.set(Math.sin(S.camYaw) * Math.cos(S.camPitch), Math.sin(S.camPitch), Math.cos(S.camYaw) * Math.cos(S.camPitch)); camera.lookAt(tmp.copy(camera.position).add(fwd)); }
    else { const cp = Math.cos(S.vPitch), sx = Math.sin(S.vYaw), cz = Math.cos(S.vYaw), rx = -cz, rz = sx;
      fwd.set(sx * cp, Math.sin(S.vPitch), cz * cp);
      camera.position.set(S.piv.x - fwd.x * TP.dist + rx * TP.shoulder, Math.max(S.piv.y - fwd.y * TP.dist, S.vis.y + .5), S.piv.z - fwd.z * TP.dist + rz * TP.shoulder);
      camera.lookAt(tmp.set(S.piv.x + rx * TP.shoulder + fwd.x * 4, S.piv.y + fwd.y * 4, S.piv.z + rz * TP.shoulder + fwd.z * 4)); }
    const fov = S.fp ? FP.fov : TP.fov; if (Math.abs(camera.fov - fov) > .01) { camera.fov = damp(camera.fov, fov, .08, dt); camera.updateProjectionMatrix(); }
    camera.updateMatrixWorld(); if (ctl) ctl.target.copy(S.piv);
    U.uWalkVI.value.copy(camera.matrixWorld); U.uWalkA.value.copy(camera.position); U.uWalkB.value.set(S.vis.x, S.vis.y + TALL * .55, S.vis.z); U.uWalkFeet.value = S.vis.y; U.uWalkOn.value = S.fp ? 0 : 1; U.uWalkNear.value = S.fp ? 0 : 1;
    // the sun's shadow box and the night's lamps follow you (every 10 m: the page's fit(), with a tighter box)
    if (S.lastFit.distanceToSquared(S.p) > 100) { S.lastFit.copy(S.p); ML.fit(); const sh = ML.sun?.shadow?.camera; if (sh) { Object.assign(sh, { left: -45, right: 45, top: 45, bottom: -45 }); sh.updateProjectionMatrix(); renderer.shadowMap.needsUpdate = true; } }
    // the door ahead
    let door = null, dd = 2.1 * 2.1; for (const d of DOORS) { const dx = d.x - S.p.x, dz = d.z - S.p.z, q = dx * dx + dz * dz; if (q < dd) { dd = q; door = d; } }
    if (door !== S.door) { S.door = door; if (door) doorEl.innerHTML = `<b>E</b> · go inside<small>${door.addr}${door.owner ? ' · ' + door.owner : ''}${door.mine ? '' : ' · visiting, read-only'}</small>`; doorEl.hidden = !door; }
    // the resident you look at
    if (!pin || S.t > pin.until) pin = null; const h = pickFolk(); hov = h?.f ?? null; const show = pin ? { f: pin.f, ...(screenOf(pin.f) || {}) } : h;
    if (show && show.sx !== undefined) { card.hidden = false; card.style.left = show.sx + 'px'; card.style.top = (show.sy - 14) + 'px'; if (card.dataset.k !== String(FOLK.indexOf(show.f))) { card.dataset.k = FOLK.indexOf(show.f); card.innerHTML = `<div class="nm">${folkName(show.f)}</div><div class="sb">${folkWhere(show.f)}</div>`; } } else card.hidden = true;
    dot.hidden = !S.locked;
  }
  function screenOf(f) { const r = canvas.getBoundingClientRect(); V3.set(f.x, f.y + .7 * (f.sc || 1), f.z).project(camera); if (V3.z > 1) return null; return { sx: r.left + (V3.x + 1) / 2 * r.width, sy: r.top + (1 - V3.y) / 2 * r.height }; }
  FRAME.push(frame);

  // the URL: ?walk=1 starts on the street; tools drive it through window.__walk
  const api = { start, stop, get on() { return S.on; }, get S() { return S; }, stats: () => S.stats, doors: () => DOORS, frame: dt => { S.last = performance.now() - dt * 1000; frame(); },
    key: (code, down) => { if (down) S.keys.add(code); else S.keys.delete(code); }, press: code => { if (code === 'Space') S.jumpAt = S.t; }, look: (yaw, pitch) => { if (yaw !== undefined) S.camYaw = yaw; if (pitch !== undefined) S.camPitch = pitch; }, place: placeAt, grid: () => S.Wq };
  window.__walk = api;
  if (Q.has('walk')) start();
  return api;
}
