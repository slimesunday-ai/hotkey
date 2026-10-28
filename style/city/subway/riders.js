// MOVEMENT · THE CARRIAGE'S RIDERS ON THE WALKER BODY (2026-10-08). The carriage's people (subway/carriage.js) are drawn exactly as the
// city's near walkers are (peds.js's near tier): each look baked once (anim/cast/bake.js bakeSegFull, its fine paint into one atlas),
// one BatchedMesh posed in the vertex shader (anim/cast/walk2.js), so they play the SAME authored clips as the city — sit_ride on the
// benches, stand_rail at a pole, wait_stop on the platform — each started at its own random clock (out of phase), and walk on and off
// with the city's walk (gait2.js, driven by the distance actually moved). One draw call for everyone, plus its shadow.
//   const crowd = createCrowd({ scene, cap })
//   crowd.add(look) → a rider body { k, ... } (the bake: ~5–20 ms, so the carriage adds a few a frame) · null when full
//   crowd.frame(list, dt)   every frame, after the carriage moved its people. Each entry: { body, parent (Object3D: the car or the
//                           platform), x, z, yaw (its parent's frame, metres / rad), clip (a clip name or null: the walk and the idles),
//                           snap (start the clip at full weight: placed, not arriving), lean (rad: a tilt along the car), show }
//   crowd.world(body, y, out) → that body's point at height y in the world (the agent's tag) · crowd.dispose()
// The colours are the bake's sRGB bytes, decoded in the vertex shader like gpu.js tierize's DECODE, but without tierize: its city-wide
// uniforms (the homes' cutaway, the waterline, the window tints) would reach into this scene's own coordinates.
import * as THREE from 'three';
import * as C from '../cast.js';
import { bakeSegFull } from '../anim/cast/bake.js';
import { WALK2, createAnimTexture2, animUniforms2, writeGait2, installAnim2 } from '../anim/cast/walk2.js';
import { gait2State, stepGait2 } from '../anim/cast/gait2.js';
import { stepIdle, IDLE_POOL } from '../anim/cast/idle.js';
import { CLIP, playClip, stopClip, stepClip } from '../anim/cast/clips/index.js';
import { createFineAtlas, installFine, fineAttr } from '../anim/cast/fine.js';

const DECODE = `
#if defined( USE_COLOR_ALPHA )
  vColor = vec4( mix( color.rgb / 12.92, pow( ( color.rgb + .055 ) / 1.055, vec3( 2.4 ) ), step( .04045, color.rgb ) ), 1. );
#elif defined( USE_COLOR )
  vColor = mix( color / 12.92, pow( ( color + .055 ) / 1.055, vec3( 2.4 ) ), step( .04045, color ) );
#endif`;
const TURN_LEAN = .09;   // (peds.js: the walk's lean into a turn)

export function createCrowd({ scene, cap = 40 }) {
  const atlas = createFineAtlas(THREE), tex = createAnimTexture2(cap), [uni, G] = animUniforms2(tex, WALK2, { turnLean: TURN_LEAN });
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .62, metalness: 0 });
  mat.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace('#include <color_vertex>', DECODE); }; mat.customProgramCacheKey = () => 'sbw-rider';
  installFine(mat, atlas); installAnim2(mat, uni);
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }); depth.customProgramCacheKey = () => 'sbw-rider-depth'; installAnim2(depth, uni);
  let mesh = null, used = 0; const room = { v: 0, i: 0, vc: 0, ic: 0 }, bodies = [];
  const geoOf = full => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(full.P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(full.N, 3, true));
    g.setAttribute('color', new THREE.BufferAttribute(full.C, 4, true)); g.setAttribute('aPart', new THREE.BufferAttribute(new Float32Array(full.K), 1)); g.setAttribute('aFine', fineAttr(THREE, full));
    g.setIndex(new THREE.BufferAttribute(full.I, 1)); return g; };
  function add(look) {
    if (used >= cap) return null; const full = bakeSegFull(THREE, C, look); atlas.adopt(full); const g = geoOf(full), nv = g.attributes.position.count, ni = g.index.count;
    if (!mesh) { room.vc = Math.ceil(nv * cap * 1.3); room.ic = Math.ceil(ni * cap * 1.3); mesh = new THREE.BatchedMesh(cap, room.vc, room.ic, mat);
      mesh.customDepthMaterial = depth; mesh.castShadow = true; mesh.receiveShadow = true; mesh.sortObjects = false; mesh.perObjectFrustumCulled = false; mesh.frustumCulled = false; mesh.name = 'subway:riders'; scene.add(mesh); }
    else if (room.v + nv > room.vc || room.i + ni > room.ic) { room.vc = Math.max(room.v + nv, Math.ceil(room.vc * 1.4)); room.ic = Math.max(room.i + ni, Math.ceil(room.ic * 1.4)); mesh.setGeometrySize(room.vc, room.ic); }
    const gid = mesh.addGeometry(g); g.dispose(); room.v += nv; room.i += ni;
    const k = mesh.addInstance(gid); mesh.setVisibleAt(k, false); used++;
    const b = { k, g: gait2State({ it: Math.random() * 40 }), gx: null, gz: null, gyaw: null, playing: null };
    bodies.push(b); return b; }
  const M = new THREE.Matrix4(), L = new THREE.Matrix4(), Ry = new THREE.Matrix4(), Rz = new THREE.Matrix4(), V = new THREE.Vector3();
  const pick = () => IDLE_POOL[(Math.random() * IDLE_POOL.length) | 0];
  function frame(list, dt) {
    if (!mesh) return; const data = tex.image.data, shown = new Set();
    for (const e of list) { const b = e.body; if (!b || !e.show || !e.parent) continue; shown.add(b); const g = b.g;
      // the gait: the distance moved in its parent's frame this frame (a hop between the car and the platform frames is not a step)
      let d = b.gx === null ? 0 : Math.hypot(e.x - b.gx, e.z - b.gz), turn = b.gyaw === null ? 0 : Math.atan2(Math.sin(e.yaw - b.gyaw), Math.cos(e.yaw - b.gyaw)); if (d > 1.5) d = 0;
      b.gx = e.x; b.gz = e.z; b.gyaw = e.yaw;
      stepGait2(g, d, dt, WALK2, G, turn); g.omega = dt > 0 ? Math.max(-3, Math.min(3, turn / dt)) : 0;
      stepIdle(g, !e.clip && d < 1e-4, dt, pick);
      // the clip: started at a random clock of its loop (everyone out of phase), blended in (or snapped: placed already seated); none → out
      if (e.clip !== b.playing) { if (e.clip && CLIP[e.clip]) playClip(g, e.clip, { t: Math.random() * CLIP[e.clip].dur, snap: !!e.snap }); else if (g.clip) stopClip(g); b.playing = e.clip && CLIP[e.clip] ? e.clip : null; }
      if (g.clip) { if (!g.clip.c.moving && !g.clip.out) g.w = 0; stepClip(g, dt); }
      writeGait2(data, cap, b.k, g);
      e.parent.updateWorldMatrix(true, false); L.makeTranslation(e.x, 0, e.z); if (e.lean) L.multiply(Rz.makeRotationZ(e.lean)); L.multiply(Ry.makeRotationY(e.yaw));
      M.multiplyMatrices(e.parent.matrixWorld, L); mesh.setMatrixAt(b.k, M); mesh.setVisibleAt(b.k, true); }
    for (const b of bodies) if (!shown.has(b)) { mesh.setVisibleAt(b.k, false); b.gx = b.gz = b.gyaw = null; }
    tex.needsUpdate = true; }
  function world(e, y, out) { if (!e?.parent) return null; e.parent.updateWorldMatrix(true, false); return out.set(e.x, y, e.z).applyMatrix4(e.parent.matrixWorld); }
  function dispose() { if (mesh) { mesh.removeFromParent(); mesh.dispose(); } mat.dispose(); depth.dispose(); tex.dispose(); atlas.tex.dispose(); }
  return { add, frame, world, dispose, get count() { return used; }, stats: () => ({ bodies: used, verts: room.v, cap: room.vc, tiles: atlas.stats().tiles }) };
}
