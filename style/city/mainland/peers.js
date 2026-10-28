// MAINLAND PRESENCE · THE OTHER HUMANS (2026-10-06): everyone else walking the Mainland, as their own cast look (stable per player id),
// on the same walk as yours: walk2's GPU walk and gait2's cycle, the idles, stride.js's run blend and jump, each body its own one-slot
// BatchedMesh with its own material (the run weight and crouch are per-material uniforms) sharing one shader program and one fine atlas.
//   SNAPSHOT INTERPOLATION: the relay batches ~10 Hz presence; each snapshot carries the sender's clock, mapped to ours by a per-peer offset
//   (the fastest arrival seen, drifting up slowly). We draw each peer a little in the past (110 ms + the lateness we've seen from them,
//   120–400 ms) between the two snapshots around that moment (Catmull-Rom when there's one either side, so the path has no corners),
//   extrapolate at most 150 ms past the newest, and ease out what's left of any correction (a 30 ms half-life; a jump over 4 m snaps).
//   The gait runs on the distance actually drawn, so feet never skate. Nobody is solid: peers are not in the walk grid (their material
//   isn't the page's), and they never walk through the world because each moves with its own player's collision.
//   JOIN / LEAVE: a dithered fade in and out (gpu.js tierize uFade) · AWAY: half faded · INSIDE: no body; chat.js shows the tag at the door.
// createPeers({ scene, renderer, LAWN }) → { add(info), remove(sid), state(sid, st), emote(sid, e), update(dt, now), get(sid), all() }
import * as THREE from 'three';
import * as CH from '../cast.js';
import { bakeSegFull } from '../anim/cast/bake.js';
import { WALK2, createAnimTexture2, animUniforms2, writeGait2, installAnim2 } from '../anim/cast/walk2.js';
import { gait2State, stepGait2 } from '../anim/cast/gait2.js';
import { stepIdle, IDLE_POOL, IDLE } from '../anim/cast/idle.js';
import { createFineAtlas, installFine, fineAttr } from '../anim/cast/fine.js';
import { tierize } from '../gpu.js';
import { damp, dampAngle, wrap, clamp } from '../camera/damp.js';
import { installStride, strideState, preStride, postStride, jumpStart, landed, writeStride } from './stride.js';

const WALK_V = 1.45, RUN_V = 3.4, TURN_LEAN = .035, OMEGA_MAX = 2;   // (walk.js: the same walk as yours)
const EXTRA = 150, SNAP = 4, FADE = .35;
// the look a player's id gives (the sender rolls the first look with hair from its seed, as walk.js does; it sends that seed)
export const lookOf = l => (l && l.handle && CH.LOOKS.find(x => x.handle === l.handle)) || CH.rollLook(l && Number.isInteger(l.seed) ? l.seed : 7);
export function hairSeed(seed) { seed >>>= 0; for (let k = 0; k < 64 && (CH.rollLook(seed).hair?.id ?? 'none') === 'none'; k++) seed = (seed + 1) >>> 0; return seed; }

export function createPeers({ scene, LAWN = .2 }) {
  const atlas = createFineAtlas(THREE), bodies = new Map(), peers = new Map(), UP = new THREE.Vector3(0, 1, 0);
  const blobGeo = new THREE.CircleGeometry(.36, 20).rotateX(-Math.PI / 2), blobMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .22, depthWrite: false });
  const M4 = new THREE.Matrix4(), QY = new THREE.Quaternion(), SCL = new THREE.Vector3(), POS = new THREE.Vector3();
  // a look's geometry, baked once per look (two peers in the same look share it)
  function geoOf(look) { const key = JSON.stringify(look); if (bodies.has(key)) return bodies.get(key);
    const full = bakeSegFull(THREE, CH, look); atlas.adopt(full); const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(full.P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(full.N, 3, true));
    g.setAttribute('color', new THREE.BufferAttribute(full.C, 4, true)); g.setAttribute('aPart', new THREE.BufferAttribute(new Float32Array(full.K), 1)); g.setAttribute('aFine', fineAttr(THREE, full)); g.setIndex(new THREE.BufferAttribute(full.I, 1));
    g.computeBoundingBox(); const b = { g, tall: g.boundingBox.max.y }; bodies.set(key, b); return b; }
  // a body: walk.js's chain (tierize → fine → walk2 → stride), its own material and one-texel anim texture
  function body(look) { const { g, tall } = geoOf(look);
    const mat = tierize(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .62, metalness: 0 }), { vmat: true }); mat.customProgramCacheKey = () => 'ml-peer'; installFine(mat, atlas);
    const tex = createAnimTexture2(1), [uni, GAIT] = animUniforms2(tex, WALK2, { turnLean: TURN_LEAN }); installAnim2(mat, uni); const RK = installStride(mat, uni);
    const mesh = new THREE.BatchedMesh(1, g.attributes.position.count, g.index.count, mat); mesh.addInstance(mesh.addGeometry(g)); mesh.frustumCulled = mesh.perObjectFrustumCulled = false;
    mesh.castShadow = false; mesh.receiveShadow = true; mesh.name = 'peer'; mat._uFade.value = 0;
    const blob = new THREE.Mesh(blobGeo, blobMat); blob.renderOrder = 1; scene.add(mesh, blob);
    return { mesh, blob, mat, tex, uni, GAIT, RK, tall, gait: gait2State({ idle: 0 }), st: strideState() }; }
  function drop(p) { if (!p.b) return; scene.remove(p.b.mesh, p.b.blob); p.b.mesh.dispose(); p.b.mat.dispose(); p.b.tex.dispose(); p.b = null; }

  // the floor for a peer whose relay sends no height (the dev bots): the walk grid when it's built, else the lawn
  const floorAt = (x, z, y) => { const Wq = window.__walk?.grid?.(); if (!Wq) return LAWN; const f = Wq.floorAt(x, z, y ?? 1.5); return isFinite(f) ? f : LAWN; };

  function add(info) { const old = peers.get(info.i); if (old) { old.leaving = 0; return old; }
    const p = { sid: info.i, pid: info.pid, name: info.n, bot: !!info.bot, l: info.l, look: lookOf(info.l), b: null, snaps: [], off: undefined, late: 40, mode: 0, away: false, door: null, addr: '',
      vis: new THREE.Vector3(), yaw: 0, prev: new THREE.Vector3(), have: false, fade: 0, leaving: -1, sp: 0, omega: 0, airT: 0, wasAir: false, wasJump: false, vy: 0, emote: null, hidden: false, head: new THREE.Vector3(), shown: false, fy: null };
    peers.set(p.sid, p); if (info.s) state(p.sid, info.s); return p; }
  function remove(sid) { const p = peers.get(sid); if (p) p.leaving = 0; }   // (faded out, then dropped: update)

  // a snapshot: sender clock → ours, kept in order; a gap (they stood still and sent nothing, or the tab slept) gets a held copy first
  function state(sid, s) { const p = peers.get(sid); if (!p) return; const now = performance.now();
    p.mode = s.m | 0; p.away = !!s.a; p.door = s.d || null; p.addr = s.h || '';
    if (p.mode !== 1) { p.snaps.length = 0; p.have = false; return; }
    const o = now - (s.k || now); if (p.off === undefined || o < p.off) p.off = o; else p.off += (o - p.off) * .01;
    const t = (s.k || now) + p.off; p.late = Math.max(p.late * .97, now - t);
    const S = p.snaps; if (S.length && t <= S[S.length - 1].t) return;
    const grounded = s.y === null || s.y === undefined, y = grounded ? floorAt(s.x, s.z) : s.y;   // (no height sent: on the floor there)
    if (S.length && t - S[S.length - 1].t > 400) S.push({ ...S[S.length - 1], t: t - 100 });
    S.push({ t, x: s.x, y, z: s.z, r: s.r, g: s.g !== 0, j: !!s.j, fy: grounded });
    while (S.length > 4 && S[1].t < now - 3000) S.shift(); }

  // EMOTES (/wave, /dap, /dance): an idle-style pose for a few seconds (walk2's idles: the stretch's raised arm for the wave, the
  // fist-to-face for the dap, the nod to music for the dance), dropped the moment they move
  const EMOTE = { wave: { idle: IDLE.stretch, dur: 3.2 }, dap: { idle: IDLE.face, dur: 2.4 }, dance: { idle: IDLE.music, dur: 6 } };
  function emote(sid, e) { const p = peers.get(sid); if (p && EMOTE[e]) p.emote = { ...EMOTE[e], t: 0, e }; }

  const cr = (a, b, c, d, f) => { const f2 = f * f, f3 = f2 * f; return .5 * ((2 * b) + (-a + c) * f + (2 * a - 5 * b + 4 * c - d) * f2 + (-a + 3 * b - 3 * c + d) * f3); };
  // where a peer is at render time rt: { x, y, z, r, g, j } (null: no snapshot yet)
  const T = { x: 0, y: 0, z: 0, r: 0, g: true, j: false };
  function sample(p, rt) { const S = p.snaps, n = S.length; if (!n) return null;
    if (rt <= S[0].t || n === 1) return Object.assign(T, S[0]);
    let i = n - 2; while (i > 0 && S[i].t > rt) i--;
    const a = S[i], b = S[i + 1];
    if (rt >= b.t) { const e = Math.min(EXTRA, rt - b.t) / Math.max(1, b.t - a.t);   // past the newest: a short extrapolation on the last motion, then hold
      return Object.assign(T, { x: b.x + (b.x - a.x) * e, y: b.y, z: b.z + (b.z - a.z) * e, r: b.r, g: b.g, j: b.j }); }
    const f = (rt - a.t) / (b.t - a.t), A = S[i - 1] || a, D = S[i + 2] || b, smooth = S[i - 1] && S[i + 2] && b.t - a.t < 300;
    T.x = smooth ? cr(A.x, a.x, b.x, D.x, f) : a.x + (b.x - a.x) * f; T.z = smooth ? cr(A.z, a.z, b.z, D.z, f) : a.z + (b.z - a.z) * f;
    T.y = a.y + (b.y - a.y) * f; T.r = a.r + wrap(b.r - a.r) * f; T.g = f < .5 ? a.g : b.g; T.j = a.j || b.j; return T; }

  function update(dt, now) {
    for (const p of peers.values()) {
      // fades: in on join, out on leave (then gone), half when away; hidden (muted by the viewer) is gone at once
      const want = p.leaving >= 0 ? 0 : p.away ? .45 : 1;
      p.fade = want > p.fade ? Math.min(want, p.fade + dt / FADE) : Math.max(want, p.fade - dt / FADE);
      if (p.leaving >= 0 && p.fade <= 0) { drop(p); peers.delete(p.sid); continue; }
      const on = p.mode === 1 && p.snaps.length > 0 && !p.hidden;
      if (!on) { if (p.b) p.b.mesh.visible = p.b.blob.visible = false; p.shown = false; p.have = false; continue; }
      if (!p.b) p.b = body(p.look);
      const B = p.b, rt = now - clamp(110 + p.late, 120, 400), s = sample(p, rt);
      // the drawn position: the sample, the leftover of a correction eased out (a long jump snaps)
      if (!p.have || Math.hypot(s.x - p.vis.x, s.z - p.vis.z) > SNAP) { p.vis.set(s.x, s.y, s.z); p.yaw = s.r; p.prev.copy(p.vis); p.have = true; }
      else { p.vis.x = damp(p.vis.x, s.x, .03, dt); p.vis.z = damp(p.vis.z, s.z, .03, dt); p.vis.y = damp(p.vis.y, s.y, s.g ? .04 : .02, dt); }
      const yaw0 = p.yaw; p.yaw = dampAngle(p.yaw, s.r, .06, dt);
      const moved = Math.hypot(p.vis.x - p.prev.x, p.vis.z - p.prev.z), vy = dt > 0 ? (p.vis.y - p.prev.y) / dt : 0; p.prev.copy(p.vis);
      p.sp = damp(p.sp, dt > 0 ? moved / dt : 0, .08, dt); p.vy = damp(p.vy, vy, .03, dt);
      p.omega = damp(p.omega, dt > 0 ? wrap(p.yaw - yaw0) / dt : 0, .08, dt);
      // the jump: the crouch when their jump starts, the landing's squash when they touch down (stride.js, as yours)
      const air = !s.g; if (s.j && !p.wasJump) jumpStart(B.st, B.gait); p.wasJump = s.j;
      if (air) p.airT += dt; else { if (p.wasAir) landed(B.st, Math.max(0, -p.vy)); p.airT = 0; } p.wasAir = air;
      // the emote: an idle pose while they stand still
      const g = B.gait; if (p.emote) { p.emote.t += dt; if (p.emote.t > p.emote.dur || p.sp > .3) p.emote = null; }
      preStride(B.st, g, B.GAIT, B.RK, p.sp, WALK_V, RUN_V, dt); g.omega = clamp(p.omega, -OMEGA_MAX, OMEGA_MAX);
      stepGait2(g, moved, dt, WALK2, B.GAIT, 0); g.hp = clamp(g.hp, -.12, .12); g.hr = clamp(g.hr, -.1, .1);
      if (p.emote) { g.idle = p.emote.idle; g.wasStill = true; g.still = Math.max(g.still, .4); }
      stepIdle(g, p.sp < .05 && !air, dt, () => IDLE_POOL[(Math.random() * IDLE_POOL.length) | 0]);
      if (p.emote && p.emote.e === 'dance') { g.py += Math.abs(Math.sin(p.emote.t * Math.PI * 2.2)) * .035; }
      const fy = p.snaps.length && p.snaps[p.snaps.length - 1].fy ? p.vis.y : floorAt(p.vis.x, p.vis.z, p.vis.y + .3);
      const sq = postStride(B.st, g, B.RK, dt, air ? { jump: s.j, vy: p.vy, h: p.vis.y - fy, t: p.airT } : null);
      writeGait2(B.tex.image.data, 1, 0, g); B.tex.needsUpdate = true; writeStride(B.uni, B.st);
      const sw = p.emote && p.emote.e === 'dance' ? Math.sin(p.emote.t * Math.PI * 1.1) * .5 : 0;   // (the dance sways side to side)
      QY.setFromAxisAngle(UP, p.yaw + sw); M4.compose(POS.copy(p.vis), QY, SCL.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq))); B.mesh.setMatrixAt(0, M4);
      B.mesh.visible = p.fade > .01; B.mat._uFade.value = p.fade >= .999 ? 1 : p.fade;
      B.blob.visible = B.mesh.visible; B.blob.position.set(p.vis.x, (isFinite(fy) ? fy : p.vis.y) + .012, p.vis.z); B.blob.scale.setScalar(clamp(1 - (p.vis.y - fy) * .6, .4, 1));
      p.head.set(p.vis.x, p.vis.y + B.tall * sq + .08, p.vis.z); p.shown = true;
    }
  }
  return { add, remove, state, emote, update, get: sid => peers.get(sid), all: () => [...peers.values()], stats: () => ({ peers: peers.size, looks: bodies.size, atlas: atlas.stats() }) };
}
