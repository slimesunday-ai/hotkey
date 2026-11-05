// AI City · HOME LIFE (2026-10-06) · "wouldn't it be nice to see your agent walking around the house, kinda sims like". The house's agent
// lives in it: one resident per home in a stable cast look (cast.js rollLook, seeded by the plot; later the owner's minted character),
// going about a day between ACTIVITY SPOTS read off the layout's own furniture. Main thread (three + DOM); one character, cheap.
//   SPOTS      spotsOf(A, fills, room) reads every placed piece (and every filled slot, and the garage's car) by its catalogue category,
//              id and tags (home/index.js), so any layout works, the presets and a layout the owner edited alike:
//                bed → sleep · stove / cook rig / hot plate → cook · fridge → a snack · a table with seats → eat · toilet → the toilet,
//                then the sink → wash · a seat facing a TV → TV (and game, if the house has a console), any other seat → chill ·
//                arcade cab → arcade · music → nod along · trophies → admire them · collectibles, collectible art, the family photos,
//                plinths, the fish tank → admire · stash spots and safes → check the stash · dresser, wardrobe, mirror, rack → get
//                dressed · bookshelf → read · floor plants · the car in the garage → admire it · tags 'weights' / 'gym' → lift (none in
//                the catalogue yet) · and wander (the phone in the hall) when nothing else calls
//              A spot is where the walker stands (a free cell in front of the piece, facing it) and, for a seat or a bed, where it sits or
//              lies (the piece's own seat height; the dining set's four chairs; a long sofa's two places).
//   MOVING     A* on the room's 0.25 m floor grid with a 2 × 2-cell walker (the homes check's own: home/rules.js geometry, so partition
//              walls, the car bay and floor slots are solid and the open front is the hall), dearer next to anything solid, string-pulled
//              and walked on rounded corners (anim/turn.js) in the cast's walk (anim/cast/walk2.js, gait2.js: the city's walker, one
//              BatchedMesh, one animation texel row) with its idles (anim/cast/idle.js: arms behind the back at the trophies, a look
//              round at the stash, a nod to the music, the phone in the hall). Sitting, lying and working (cooking, washing, the arcade)
//              swap to the same look built as a chars.js rig (cast.js build: the city's sitters and sleepers), posed on the CPU.
//   THE DAY    Sims-style needs (hunger, bladder, fun, hygiene, pride, money) run down; each spot's activity advertises what it gives and
//              the resident does what it needs most (with a little chance, nothing twice in a row, nearer is better). Cooking leads to
//              eating, the toilet to the sink. At night it sleeps, eyes shut, z Z over the pillow, and now and then gets up for a snack
//              or the toilet and goes back to bed. A little bubble now and then, never text: PIXEL ICONS from the city (bubbles.js),
//              by the activity and the piece (counting the banded cash at the stash, a pot on the boil, a slice, the TV's flicker, a
//              pad, a boombox, a hi-top at the sneaker wall, keys spinning by the whip, a bulb and the heist map at night), now and
//              then a two-icon thought (cash › sneaker: saving up for a pair); asleep, pixel z's and now and then a dream (the whip).
//   EDITING    the resident is not in the homes check, so it never blocks placement (and the builder's picking only sees its own views).
//              setLayout() re-plans: a moved piece it was using or heading for → a pixel "?" and it goes to the new place; a stored
//              piece → something else; a piece put down on top of it → it hops aside. held(id): the builder has lifted a piece it is
//              sitting on → it stands up (a pixel "!") and waits.
//   createLife({ parent, origin, A, fills, room, seed, look, night, dom, camera, renderer }) → Promise<life>
//     parent    the scene (or any group): the resident's group goes in it at `origin`, the room's back-left floor corner
//     A, fills  the layout (assembly format, FORMAT.md) and each slot's piece (or null) · room: { W, D, H, ox } (room.js buildRoom's)
//     seed      the home's seed (the look and the day's dice) · look: a cast look to use instead (the owner's character)
//     dom       an element over the canvas for the bubbles (position: relative or fixed) · camera, renderer: for placing them
//   life: { group, update(dt), setLayout(A, fills, room?, origin?), setNight(on), held(id | null), go(act), say(icon | [a, b]), state(), dispose() }
//   Reusable as is in the city's home cutaways (index.js): its walker material skips gpu.js's CUT (it stands inside the cut).
import * as THREE from 'three';
import * as HO from '../home/index.js';
import { makeRules, rectOf, C4 } from '../home/rules.js';
import * as C from '../../cast.js';
import { tierize } from '../../gpu.js';
import { bakeSegFull } from '../../anim/cast/bake.js';
import { WALK2, createAnimTexture2, animUniforms2, writeGait2, installAnim2 } from '../../anim/cast/walk2.js';
import { gait2State, stepGait2 } from '../../anim/cast/gait2.js';
import { IDLE, stepIdle } from '../../anim/cast/idle.js';
import { createFineAtlas, installFine, fineAttr } from '../../anim/cast/fine.js';
import { turnToward, wrapPi, roundedPath } from '../../anim/turn.js';
import { createBubbles } from './bubbles.js';

import { RULES, FR, yawOf, toRoom, dirRoom, lerp, ACTS, COLLECT_ART, actsOf, isTV, seatsOf, frameOf, frontOf, spotsOf, gridOf, gridCells, nodeXZ, snap, sight, clear, astar } from './spots.js';
export { ACTS, spotsOf, gridCells, nodeXZ, snap, sight, clear, astar };
const ease = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
const HEADK = .84, SIT_DROP = .47, WALK_V = 1.1;   // the sleeper's head (index.js) · seat top → the rig's root · indoor walking speed (m/s)
// the piece itself says what it is: a hi-top at the sneaker wall, a graded card, a vinyl toy, the fish (by catalogue id; first match)
const PIECE_ICONS = [[/sneaker|grails/, ['sneaker', 'glint'], [['cash', 'sneaker']]], [/cap-wall|streetwear/, ['cap', 'sneaker']], [/chain|watch|grill/, ['chain', 'glint']],
  [/card/, ['card', 'glint']], [/vinyl|toy|blindbox/, ['toy', 'glint']], [/duffel/, ['duffel', 'cash']], [/cash|money|counterfeit/, ['cash', 'glint']],
  [/^(art|frame|photos|poster|jersey)/, ['frame', 'glint']], [/fish/, ['fish']], [/crown|kingpin/, ['crown', 'trophy']], [/turntable/, ['record', 'notes']],
  [/boombox/, ['boombox', 'notes']], [/speaker/, ['notes', 'boombox']]];
const DREAMS = ['cash', 'whip', 'crown', 'chain', 'sneaker', 'duffel', 'map'];
const NEEDS = { hunger: .011, bladder: .007, fun: .016, hygiene: .005, pride: .009, money: .004 };   // run down per second (by day)

export async function createLife({ parent, origin = [0, 0, 0], A, fills, room, seed = 1, look, night = false, dom = null, camera = null, renderer = null } = {}) {
  const rnd = C.mulberry32((seed * 2654435761) >>> 0 ^ 0x51f1);
  const L = look ? structuredClone(look) : C.rollLook((seed * 7919) & 0xffffff);
  const group = new THREE.Group(); group.name = 'home-life'; group.position.set(...(origin.isVector3 ? origin.toArray() : origin)); parent.add(group);
  // ── the walker: the city's near walker for ONE look (peds.js: tierize → walk v2 → fine paint), with gpu.js's cut skipped
  const t0 = performance.now(), full = bakeSegFull(THREE, C, structuredClone(L)), bakeMs = performance.now() - t0;
  const tex = createAnimTexture2(1), [uni, GAIT] = animUniforms2(tex, WALK2, { turnLean: .09 }), atlas = createFineAtlas(THREE);
  const mat = tierize(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .62, metalness: 0 }), { vmat: true });
  mat.customProgramCacheKey = () => 'home-life'; installAnim2(mat, uni); installFine(mat, atlas);
  { const prev = mat.onBeforeCompile, key = mat.customProgramCacheKey.bind(mat); mat.onBeforeCompile = (sh, r) => { prev.call(mat, sh, r); sh.fragmentShader = sh.fragmentShader.replace('if ( uCut[1].w > 0. )', 'if ( false )'); }; mat.customProgramCacheKey = () => key() + '|nocut'; }
  atlas.adopt(full);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(full.P, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(full.N, 3, true));
  geo.setAttribute('color', new THREE.BufferAttribute(full.C, 4, true)); geo.setAttribute('aPart', new THREE.BufferAttribute(new Float32Array(full.K), 1)); geo.setAttribute('aFine', fineAttr(THREE, full)); geo.setIndex(new THREE.BufferAttribute(full.I, 1));
  const batch = new THREE.BatchedMesh(1, geo.attributes.position.count, geo.index.count, mat); batch.addInstance(batch.addGeometry(geo)); batch.frustumCulled = false; batch.perObjectFrustumCulled = false; batch.sortObjects = false; group.add(batch);
  const M4 = new THREE.Matrix4(), QN = new THREE.Quaternion(), V3 = new THREE.Vector3(), ONE = new THREE.Vector3(1, 1, 1), YA = new THREE.Vector3(0, 1, 0);
  // ── the rig: the same look as a chars.js body (cast.js build), for sitting, lying and busy hands
  const body = C.build(L, { fine: 'tex' }), hold = new THREE.Group(); hold.rotation.order = 'YXZ'; hold.add(body); hold.visible = false; group.add(hold);
  const rig = body.userData.rig, head = body.userData.head, eyes = body.userData;
  // the duvet over the sleeper (the Sims' blanket: lying in the open the big shoes stood up and hid the body from the street side)
  const duvet = new THREE.Group(), dm = new THREE.MeshStandardMaterial({ color: 0xf1e7d2, roughness: .92 }), fm = new THREE.MeshStandardMaterial({ color: 0xfffaf0, roughness: .9 }), BX = new THREE.BoxGeometry(1, 1, 1);
  const dFoot = new THREE.Mesh(BX, dm), dBody = new THREE.Mesh(BX, dm), dFold = new THREE.Mesh(BX, fm); duvet.add(dFoot, dBody, dFold); duvet.visible = false; group.add(duvet);
  const neutral = () => { for (const n of ['legL', 'legR', 'armL', 'armR']) rig[n].rotation.set(0, 0, 0); head.rotation.set(0, 0, 0); head.scale.setScalar(1); body.scale.setScalar(C.S); if (eyes.open) { eyes.open.visible = true; eyes.shut.visible = false; } };
  neutral();

  // ── state
  const S = { x: 0, z: 0, yaw: 0, mode: 'think', act: null, spot: null, path: null, s: 0, v: 0, timer: 0, clock: 0, k: 0, from: null, next: null, recent: [], bub: 6 + rnd() * 4, dream: 4, wait: 0, force: null, heldId: null, night: !!night, out: null, midnight: 0 };
  const st = { yaw: 0, omega: 0 }, g = gait2State({ it: rnd() * 10 }); g.idle = IDLE.shift;
  const need = Object.fromEntries(Object.keys(NEEDS).map(k => [k, .35 + rnd() * .6]));
  let G = null, spots = [], byAct = new Map(), room0 = room;
  function plan(A1, fills1) {
    G = gridOf(A1, fills1); spots = [];
    for (const sp of spotsOf(A1, fills1, room0)) { const to = sp.seat ? [sp.seat.x, sp.seat.z] : sp.bed ? sp.face : sp.face, see = { to, own: sp.own, any: !!(sp.seat || sp.bed) };
      let k = snap(G, sp.at[0], sp.at[1], sp.pose === 'lie' ? .45 : .7, G.main, see);
      for (const a of sp.alt ?? []) { if (k >= 0) break; k = snap(G, a[0], a[1], .45, G.main, see); }
      if (k < 0) continue; const [x, z] = nodeXZ(k, G.RW), f = sp.seat ? [x + Math.sin(sp.seat.yaw), z + Math.cos(sp.seat.yaw)] : sp.face;
      spots.push({ ...sp, node: k, p: [x, z], yaw: sp.seat ? sp.seat.yaw : yawOf(f[0] - x, f[1] - z) }); }
    byAct = new Map(); for (const sp of spots) (byAct.get(sp.act) ?? byAct.set(sp.act, []).get(sp.act)).push(sp); }
  plan(A, fills);

  // ── bubbles (bubbles.js: pixel icons on a canvas over the scene, placed at the head's top each frame)
  const B = dom ? createBubbles(dom) : null, pieceOf = sp => sp?.key ? sp.key.replace(/^slot\d+:/, '').split(/[#/]/)[0] : '';
  function bubble(ids) { if (!B) return; if (Array.isArray(ids)) B.think(ids, 2.9, ids.length > 1 ? 'L' : 'R'); else B.say(ids); }
  function chatter() {   // what it says now: the piece's own icons (or the activity's, or the night's), now and then a two-icon thought
    const def = ACTS[S.act] ?? ACTS.wander, pc = pieceOf(S.spot), P = ['admire', 'trophy', 'music', 'dress'].includes(S.act) ? PIECE_ICONS.find(q => q[0].test(pc)) : null;
    const gl = (S.night && def.nglyph) || P?.[1] || def.glyph, th = S.night ? null : P?.[2] ?? def.think;
    if (th?.length && rnd() < .24) return bubble(th[(rnd() * th.length) | 0]);
    if (gl.length) bubble(gl[(rnd() * gl.length) | 0]); }
  const headAt = new THREE.Vector3();
  function placeBubbles(dt) {
    if (!B || !camera || !renderer) return;
    const asleep = S.act === 'sleep' && (S.mode === 'hold') && S.k > .9; B.sleep(asleep);
    if (asleep) { S.dream -= dt; if (S.dream <= 0) { S.dream = 9 + rnd() * 7; bubble(rnd() < .2 ? ['map', 'cash'] : [DREAMS[(rnd() * DREAMS.length) | 0]]); } } else S.dream = 3 + rnd() * 3;
    if (!B.busy && !asleep) { B.update(dt, 0, 0); return; }
    if (hold.visible) { hold.updateMatrixWorld(true); head.localToWorld(headAt.set(0, asleep ? 6 : 21, 0)); if (asleep) headAt.y += .25; } else group.localToWorld(headAt.set(S.x, 2.2, S.z));
    headAt.y += .12;   // (a hand over the hair: the tail never touches the head)
    const r = renderer.domElement.getBoundingClientRect(), d = dom.getBoundingClientRect(), p = headAt.project(camera), on = p.z < 1;
    B.update(dt, r.left - d.left + (p.x + 1) / 2 * r.width + 6, r.top - d.top + (1 - p.y) / 2 * r.height, on); }

  // ── choosing what to do next
  const avail = a => (byAct.get(a) ?? []).length > 0;
  function pickSpot(a) { const L0 = byAct.get(a) ?? []; if (!L0.length) return null; let best = null, bs = -1;
    for (const sp of L0) { const d = Math.hypot(sp.p[0] - S.x, sp.p[1] - S.z), s = (.4 + rnd()) / (1 + d * .12); if (s > bs) { bs = s; best = sp; } } return best; }
  function choose() {
    if (S.force && (avail(S.force) || S.force === 'wander')) { const a = S.force; S.force = null; return a; }   // (go(): a debug nudge, or the seat that moved)
    if (S.next && avail(S.next)) { const a = S.next; S.next = null; return a; } S.next = null;
    if (S.night) { if (S.midnight > 0) { S.midnight = 0; const m = ['fridge', 'toilet'].filter(avail); if (m.length && rnd() < .85) return m[(rnd() * m.length) | 0]; } return avail('sleep') ? 'sleep' : 'wander'; }
    let best = 'wander', bs = -1;
    for (const [a, def] of Object.entries(ACTS)) { if (a === 'sleep' || def.when === 'night' || !(avail(a) || a === 'wander')) continue; if (a === 'eat' && avail('cook')) continue;   // (eating follows cooking)
      let s = .03; for (const [n, v] of Object.entries(def.adv ?? def.give)) s += v * (.06 + 2 * (1 - need[n]) ** 2); s *= .7 + .6 * rnd();
      const i = S.recent.indexOf(a); if (i >= 0) s *= i === 0 ? .05 : .3;
      const sp = a === 'wander' ? null : pickSpot(a); if (sp) s /= 1 + Math.hypot(sp.p[0] - S.x, sp.p[1] - S.z) * .04;
      if (s > bs) { bs = s; best = a; } }
    return best; }
  function wanderSpot() {   // a free spot in the house, toward the open front, facing the street
    const cand = []; for (let k = 0; k < G.free.length; k++) if (G.free[k] && G.comp[k] === G.main && !G.near[k]) { const [x, z] = nodeXZ(k, G.RW); if (z > G.RD * C4 * .5) cand.push(k); }
    if (!cand.length) for (let k = 0; k < G.free.length; k++) if (G.free[k] && G.comp[k] === G.main) cand.push(k);
    if (!cand.length) return null; const k = cand[(rnd() * cand.length) | 0], [x, z] = nodeXZ(k, G.RW);
    return { act: 'wander', key: 'wander', pose: 'stand', node: k, p: [x, z], yaw: (rnd() - .5) * 1.2, idle: rnd() < .5 ? IDLE.phone : IDLE.stretch }; }
  function startAct(a) {
    const sp = a === 'wander' ? wanderSpot() : pickSpot(a); if (!sp) { S.mode = 'think'; S.wait = 1; return false; }
    S.act = a; S.spot = sp; S.mode = 'walk'; route(); return true; }
  function route() {   // a path from where it stands to its spot
    const sp = S.spot; let s0 = snap(G, S.x, S.z, .5, -1); if (s0 >= 0 && G.comp[s0] !== G.main) s0 = snap(G, S.x, S.z, 1.5);
    if (s0 < 0) s0 = snap(G, S.x, S.z, 3);
    const pts = s0 >= 0 ? astar(G, s0, sp.node) : null;
    if (!pts) { S.path = null; S.mode = 'turn'; S.x = sp.p[0]; S.z = sp.p[1]; return; }   // (nowhere to walk from: be there)
    if (Math.hypot(pts[0][0] - S.x, pts[0][1] - S.z) > .02) pts.unshift([S.x, S.z]);
    const P = pts.filter((p, i) => i === 0 || Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) > .01);
    if (P.length < 2) { S.path = null; S.mode = 'turn'; return; }
    // rounded corners where they stay clear of everything (an arc cuts the inside of its corner), else tighter, else nearly sharp
    const ok = R => { for (let s = .3; s < R.len; s += .08) { const p = R.at(s); if (!clear(G, p, p)) return false; } return true; };
    let R = null; for (const r of [.35, .18, .02]) { R = roundedPath(P, r); if (ok(R)) break; }
    S.path = R; S.pts = P; S.s = 0; S.mode = 'walk'; S.start = true; }
  function finish() { const def = ACTS[S.act]; if (def) for (const [n, v] of Object.entries(def.give)) need[n] = Math.min(1, need[n] + v);
    S.recent.unshift(S.act); S.recent.length = Math.min(S.recent.length, 3); if (def?.next) S.next = def.next; S.act = null; S.spot = null; S.mode = 'think'; S.wait = .3 + rnd() * .8; }

  // ── the rig's poses (k: 0 → 1 how far into it; t: the activity's clock)
  function poseRig(sp, k, t) {
    neutral(); const e = ease(k), act = sp?.act, pose = sp?.pose;
    if (pose === 'sit') { rig.legL.rotation.x = rig.legR.rotation.x = -1.25 * e; rig.armL.rotation.x = rig.armR.rotation.x = -.45 * e;
      const s = sp.seat, [ax, az] = S.from ?? sp.p; hold.position.set(lerp(ax, s.x, e), lerp(0, s.y - SIT_DROP, e) + Math.sin(Math.PI * k) * .05, lerp(az, s.z, e)); hold.rotation.set(0, s.yaw, 0);
      if (act === 'tv') { const laugh = Math.max(0, Math.sin(t * 1.3) - .93) * 14; head.rotation.x = (-.1 - .15 * laugh) * e; hold.position.y += .02 * laugh * Math.abs(Math.sin(t * 22)) * e; }
      else if (act === 'chill' || act === 'toilet') { rig.armR.rotation.x = -1.5 * e; rig.armR.rotation.y = .25 * e; head.rotation.x = .32 * e; rig.armR.rotation.z = .03 * Math.sin(t * 9) * e; }
      else if (act === 'eat') { const bite = Math.max(0, Math.sin(t * 2.4)) ** 3; rig.armL.rotation.x = -.95 * e; rig.armR.rotation.x = (-.95 - .6 * bite) * e; head.rotation.x = (.18 - .12 * bite) * e; }
      else if (act === 'game') { const j = Math.sin(t * 17) * .05 + Math.sin(t * 5.3) * .04; rig.armL.rotation.x = (-1.05 + j) * e; rig.armR.rotation.x = (-1.05 - j) * e; head.rotation.x = .05 * e; hold.position.y += Math.max(0, Math.sin(t * .9) - .9) * .3 * e; }
      return; }
    if (pose === 'lie') { const b = sp.bed, [ax, az] = S.from ?? sp.p, yaw0 = S.fromYaw ?? b.yaw, dy = wrapPi(b.yaw - yaw0);
      hold.position.set(lerp(ax, b.x, e), lerp(0, b.y, e) + Math.sin(Math.PI * Math.min(1, k * 1.15)) * .22, lerp(az, b.z, e)); hold.rotation.set(-Math.PI / 2 * ease(Math.min(1, k * 1.25 - .1)), yaw0 + dy * e, 0);
      rig.armL.rotation.x = rig.armR.rotation.x = .05 * e; rig.armL.rotation.z = -.12 * e; rig.armR.rotation.z = .12 * e;
      if (k > .55 && eyes.open) { eyes.open.visible = false; eyes.shut.visible = true; head.scale.setScalar(lerp(1, HEADK, e)); head.rotation.y = .5 * e; }
      body.scale.z = C.S * (1 + .03 * Math.sin(t * 1.4) * e);
      const dk = Math.max(0, (k - .7) / .3); duvet.visible = dk > 0; if (dk > 0) { const w = Math.max(.6, (b.w ?? 1.5) - .14), top = b.y - .12, br = 1 + .012 * Math.sin(t * 1.4);   // (feet at the root: the duvet runs from there toward the pillow)
        duvet.position.set(b.x, top, b.z); duvet.rotation.y = b.yaw; duvet.scale.set(1, ease(dk), 1);
        dFoot.scale.set(w, .44, .42); dFoot.position.set(0, .22, -.14); dBody.scale.set(w, .3 * br, .42); dBody.position.set(0, .15 * br, -.55); dFold.scale.set(w + .01, .31 * br, .1); dFold.position.set(0, .155 * br, -.79); }
      return; }
    duvet.visible = false;
    // work: standing at a counter, the arcade, the sink
    hold.position.set(S.x, 0, S.z); hold.rotation.set(0, S.yaw, 0);
    if (act === 'cook') { rig.armL.rotation.x = -.85 * e; rig.armR.rotation.x = (-1.05 + .14 * Math.sin(t * 6)) * e; rig.armR.rotation.z = .1 * Math.cos(t * 6) * e; head.rotation.x = .3 * e; head.rotation.y = .2 * Math.sin(t * .7) * e; }
    else if (act === 'wash') { const w = Math.sin(t * 10) * .1; rig.armL.rotation.x = (-1.05 + w) * e; rig.armR.rotation.x = (-1.05 - w) * e; head.rotation.x = .35 * e; }
    else if (act === 'arcade') { const j = Math.sin(t * 19) * .06; rig.armL.rotation.x = (-1.15 + j) * e; rig.armR.rotation.x = (-1.15 + Math.sin(t * 13) * .08) * e; head.rotation.x = -.05 * e; body.position.y = Math.max(0, Math.sin(t * 1.1) - .92) * .5 * e; }
    else if (act === 'lift') { const u = (Math.sin(t * 2.2) + 1) / 2; rig.armL.rotation.z = -(.2 + 2.5 * u) * e; rig.armR.rotation.z = (.2 + 2.5 * u) * e; }
    else { rig.armL.rotation.x = rig.armR.rotation.x = -.9 * e; } }
  const toRig = () => { if (hold.visible) return; batch.visible = false; hold.visible = true; body.position.set(0, 0, 0); hold.position.set(S.x, 0, S.z); hold.rotation.set(0, S.yaw, 0); };
  const toWalker = () => { if (!hold.visible) return; hold.visible = false; batch.visible = true; neutral(); body.position.set(0, 0, 0); g.w = 0; g.iw = 0; g.still = 0; g.wasStill = false; st.yaw = S.yaw; st.omega = 0; };

  // ── interruptions (an edit, a lifted piece)
  function standUp(why) { S.out = why; S.mode = 'exit'; if (why !== 'night' && S.spot?.pose === 'sit') S.from = [hold.position.x, hold.position.z]; }   // (the seat went: up where it sits)
  function interrupt(why) {
    if (S.mode === 'enter' || S.mode === 'hold') { standUp(why); return; }
    if (why === 'lifted') { S.mode = 'wait'; S.path = null; return; }
    if (S.act && S.act !== 'wander') { const again = (byAct.get(S.act) ?? []).find(q => q.key === S.spot?.key) ?? null; if (again) { S.spot = again; route(); return; } }
    S.act = null; S.spot = null; S.path = null; S.mode = 'think'; S.wait = .4; }
  function setLayout(A1, fills1, room1, origin1) {
    if (room1) room0 = room1; if (origin1) group.position.set(...(origin1.isVector3 ? origin1.toArray() : origin1));
    const old = S.spot; plan(A1, fills1);
    // standing where a piece was just put down: hop aside
    if (!hold.visible) { const at = snap(G, S.x, S.z, .14, -1); if (at < 0) { const k = snap(G, S.x, S.z, 3); if (k >= 0) { bubble('alert'); S.hop = nodeXZ(k, G.RW); } } }
    if (!old || old.act === 'wander') { if (old?.act === 'wander' && !G.free[old.node]) interrupt('gone'); return; }
    const now = spots.find(q => q.key === old.key && q.act === old.act);
    if (now && Math.hypot(now.p[0] - old.p[0], now.p[1] - old.p[1]) < .01 && (!old.seat || Math.hypot(now.seat.x - old.seat.x, now.seat.z - old.seat.z) < .01) && (!old.bed || Math.hypot(now.bed.x - old.bed.x, now.bed.z - old.bed.z) < .01)) { S.spot = now; if (S.mode === 'wait' || S.mode === 'walk') { S.mode = 'walk'; route(); } return; }
    bubble('huh'); if (S.mode === 'enter' || S.mode === 'hold' || S.mode === 'exit') { if (S.mode !== 'exit' || !S.out) standUp('moved'); S.out = 'moved'; S.again = now ? old.act : null; return; }
    if (now) { S.spot = now; route(); } else { S.act = null; S.spot = null; S.path = null; S.mode = 'think'; S.wait = .6; } }

  // ── a start that already reads as a life: in bed at night; by day somewhere mid-activity
  function begin() {
    const a = S.night ? (avail('sleep') ? 'sleep' : 'wander') : (['tv', 'cook', 'trophy', 'chill', 'music', 'eat', 'game', 'admire'].filter(avail)[(rnd() * 3) | 0] ?? choose());
    const sp = a === 'wander' ? wanderSpot() : pickSpot(a); if (!sp) { const w = wanderSpot(); if (w) { S.x = w.p[0]; S.z = w.p[1]; } return; }
    S.act = a; S.spot = sp; S.x = sp.p[0]; S.z = sp.p[1]; S.yaw = st.yaw = sp.yaw;
    const def = ACTS[a]; S.timer = lerp(def.dur[0], def.dur[1], rnd()) * (a === 'sleep' ? 1 : .6); S.clock = rnd() * 5;
    if (sp.pose === 'stand') { S.mode = 'stand'; g.idle = sp.idle ?? def.idle ?? IDLE.shift; g.iw = 1; g.still = 1; g.wasStill = true; }
    else { S.from = sp.p; S.fromYaw = sp.yaw; toRig(); S.mode = 'hold'; S.k = 1; if (a === 'sleep') S.midnight = 0; } }
  begin();

  // ── the frame
  function update(dt) {
    dt = Math.min(.1, Math.max(0, dt)); if (!dt) return; for (const n of Object.keys(NEEDS)) need[n] = Math.max(0, need[n] - NEEDS[n] * dt * (S.night ? .2 : 1));
    S.clock += dt; let dist = 0, turn = 0, standing = false;
    if (S.hop && !hold.visible) {   // a piece landed on it: straight out to the nearest free spot
      const dx = S.hop[0] - S.x, dz = S.hop[1] - S.z, L = Math.hypot(dx, dz); if (L < .02) { S.hop = null; if (S.mode === 'walk' && S.spot) route(); } else { const v = Math.min(L, 1.3 * dt); S.x += dx / L * v; S.z += dz / L * v; dist = v; turn = turnToward(st, yawOf(dx, dz), dt, 6); S.yaw = st.yaw; } }
    else switch (S.mode) {
      case 'think': S.wait -= dt * (S.force ? 3 : 1); standing = true; if (S.wait <= 0) { const a = choose(); startAct(a); } break;
      case 'wait': standing = true; g.idle = IDLE.look; if (!S.heldId) { S.mode = 'think'; S.wait = .2; } break;
      case 'walk': { if (!S.path) { S.mode = 'turn'; break; } const P = S.path, rem = P.len - S.s, w0 = P.at(S.s + Math.min(.15, rem * .5))[2], arr = S.spot && rem < .7 ? ease(1 - rem / .7) * .85 : 0, want = w0 + wrapPi((S.spot?.yaw ?? w0) - w0) * arr, err = Math.abs(wrapPi(w0 - st.yaw));   // (the last steps already turn toward the spot)
        if (S.start && err > 1.1) { turn = turnToward(st, want, dt, 4); S.yaw = st.yaw; break; } S.start = false;
        const vt = Math.min(WALK_V, Math.sqrt(2 * 1.3 * Math.max(0, rem)) + .05) * (err > .9 ? .45 : 1); S.v += Math.max(-3 * dt, Math.min(1.6 * dt, vt - S.v));
        const ds = Math.min(rem, Math.max(0, S.v) * dt), p = P.at(S.s + ds); dist = Math.hypot(p[0] - S.x, p[1] - S.z); S.s += ds; S.x = p[0]; S.z = p[1];
        turn = turnToward(st, want, dt, 3.6); S.yaw = st.yaw;
        if (rem - ds <= .005) { S.mode = 'turn'; S.v = 0; S.x = S.spot.p[0]; S.z = S.spot.p[1]; } break; }
      case 'turn': { const want = S.spot?.yaw ?? S.yaw; turn = turnToward(st, want, dt, 3.4); S.yaw = st.yaw;
        if (Math.abs(wrapPi(want - st.yaw)) < .06 && (S.spot.pose === 'stand' || g.w < .22)) { const def = ACTS[S.act] ?? ACTS.wander; S.timer = lerp(def.dur[0], def.dur[1], rnd()); S.clock = 0; S.bub = .4 + rnd() * .6;   // (the first bubble soon after it gets there)
          if (S.spot.pose === 'stand') { S.mode = 'stand'; g.idle = S.spot.idle ?? def.idle ?? IDLE.shift; }
          else { S.from = [S.x, S.z]; S.fromYaw = S.yaw; toRig(); S.mode = 'enter'; S.k = 0; } } break; }
      case 'stand': standing = true; S.timer -= dt; if (S.timer <= 0) finish(); break;
      case 'enter': S.k = Math.min(1, S.k + dt / (S.spot.pose === 'lie' ? 1.1 : S.spot.pose === 'sit' ? .55 : .3)); poseRig(S.spot, S.k, S.clock); if (S.k >= 1) S.mode = 'hold'; break;
      case 'hold': S.timer -= dt; poseRig(S.spot, 1, S.clock);
        if (S.act === 'sleep') { if (!S.night) { S.timer = 0; } else { S.midnight += dt; if (S.midnight > 40 && rnd() < dt * .03) { S.timer = 0; S.midnight = 1; } else S.timer = 1; } }
        if (S.timer <= 0) { S.mode = 'exit'; S.out = null; } break;
      case 'exit': { const sp = S.spot; S.k = Math.max(0, S.k - dt / (sp?.pose === 'lie' ? .9 : sp?.pose === 'sit' ? .45 : .25));
        poseRig(sp, S.k, S.clock); if (S.k <= 0) { const [x, z] = S.from ?? [S.x, S.z]; S.x = x; S.z = z; S.yaw = hold.rotation.y; toWalker();
          const out = S.out, again = S.again; S.out = null; S.again = null;
          if (out === 'lifted') { S.mode = 'wait'; break; }
          if (out === 'moved' || out === 'gone') { S.act = null; S.spot = null; S.mode = 'think'; S.wait = .5; if (again) S.force = again; if (snap(G, S.x, S.z, .14, -1) < 0) { const k = snap(G, S.x, S.z, 3); if (k >= 0) S.hop = nodeXZ(k, G.RW); } break; }
          if (S.act === 'sleep') { g.idle = IDLE.stretch; }   // (up: a stretch first)
          finish(); if (S.recent[0] === 'sleep' || S.recent[0] === 'fridge' && S.night) S.wait = 1.6; } break; }
    }
    // bubbles now and then while busy
    if ((S.mode === 'stand' || S.mode === 'hold') && S.act && S.act !== 'sleep') { S.bub -= dt; if (S.bub <= 0) { chatter(); S.bub = 4.5 + rnd() * 4; } }
    // the walker: gait + idle → its texel row; the instance matrix
    if (!hold.visible) { stepGait2(g, dist, dt, WALK2, GAIT, turn); stepIdle(g, standing && !S.hop, dt); writeGait2(tex.image.data, 1, 0, g); tex.needsUpdate = true;
      QN.setFromAxisAngle(YA, S.yaw); V3.set(S.x, 0, S.z); M4.compose(V3, QN, ONE); batch.setMatrixAt(0, M4); }
    placeBubbles(dt);
  }
  function setNight(on) { on = !!on; if (on === S.night) return; S.night = on; if (on) { if (S.act !== 'sleep') interrupt('night'); } else if (S.act === 'sleep' && S.mode === 'hold') S.timer = 0; }
  function held(id) { if (id === S.heldId) return; S.heldId = id ?? null; if (!id || !S.spot) return; const mine = S.spot.key.replace(/^slot\d+:/, '').split(/[#/]/)[0] === id;
    if (mine) { bubble('alert'); interrupt('lifted'); } }
  function dispose() { group.removeFromParent(); geo.dispose(); BX.dispose(); dm.dispose(); fm.dispose(); batch.dispose(); mat.dispose(); tex.dispose(); atlas.tex?.dispose?.(); body.traverse(m => m.geometry?.dispose()); B?.dispose(); }
  return { group, update, setLayout, setNight, held, dispose, bakeMs, say: ids => { S.bub = Math.max(S.bub, 4); bubble(ids); }, bubble: () => B?.shown() ?? null,
    go: a => { S.force = a; if (S.mode === 'hold' || S.mode === 'enter') { S.mode = 'exit'; S.out = null; S.again = null; } else if (S.mode !== 'exit') { S.act = null; S.spot = null; S.path = null; S.mode = 'think'; S.wait = 0; } },
    state: () => ({ act: S.act, mode: S.mode, x: +S.x.toFixed(2), z: +S.z.toFixed(2), yaw: +S.yaw.toFixed(2), night: S.night, clip: !hold.visible && !S.hop && !clear(G, [S.x, S.z], [S.x, S.z]), pts: S.mode === 'walk' ? S.pts?.map(p => p.map(v => +v.toFixed(2))) : null, spot: S.spot && { key: S.spot.key, p: S.spot.p }, needs: Object.fromEntries(Object.entries(need).map(([k, v]) => [k, +v.toFixed(2)])),
      spots: spots.map(q => ({ act: q.act, key: q.key, p: q.p.map(v => +v.toFixed(2)) })), look: L.handle }) };
}
