// C2-GORE (2026-10-30, slime: "gore is in 100%", GAME.md §41) · THE ACCIDENTS' EFFECTS: blood, skid marks, hazard lamps. Ported from slime's
// crafter game (game/src/view/fx.js: BLOOD — drops, mist, splats, pools), the part stage/setfx.js left out. One InstancedMesh (or a
// small sprite pool) per kind, pooled as rings: the oldest goes first; nothing is allocated per frame. traffic/accident.js drives it.
// NOT PURE, on purpose: setfx.js draws a scene's sparks as a closed form of its clip clock so a seek repeats them; an accident is a
// crowd walker's and an ambient car's (slime: "it can vary"), so these integrate frame by frame from Math.random draws, as the game's do.
//   fx.spray(x, y, z, dx, dy, dz, k)   a hit: dark drops thrown along (dx, dy, dz) (most with the blow, a few back, a few dripping) and a
//                                      mist that blooms and fades; each drop leaves a splat where it lands — on the road, or on the car
//                                      that hit them (fx.target(car)) when it lands on its roof or bonnet
//   fx.splat(x, y, z, nx, ny, nz, s)   a splat on a surface · fx.pool(x, z, s, delay) a pool that spreads under a body
//   fx.carSplat(car, lx, ly, lz, nx, ny, nz, s)   a splat on a car, in its own frame (x right, y up, z nose): it moves with the car
//   fx.skid(car, on)                    while on, the car's rear wheels lay rubber (one mark per wheel, stretched as it slides)
//   fx.hazard(car)                      this frame: the car's four corner lamps blink amber (and glow at night)
//   fx.update(dt, camera)               once a frame: integrate, age, fade, draw
// Splats and pools dry away at the end of their life (shrink over their last BLOOD.dry s); skid marks fade the same way.
import * as THREE from 'three';
import { kerbOut } from '../plan.js';
import { SIDE } from '../style.js';

export const BLOOD = { colors: [0x7a0f0b, 0x640b08, 0x8e140c, 0x520805], pool: 0x4a0705, life: 80, poolLife: 95, dry: 6, skidLife: 70 };
// the ground under a point: the sidewalk's top off the road, the road's on it
export const groundY = (x, z) => kerbOut(x, z) > 0 ? SIDE : 0;

export function createGoreFx(scene, { night = false } = {}) {
  const col = new THREE.Color(), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s3 = new THREE.Vector3(), p3 = new THREE.Vector3(), zA = new THREE.Vector3(0, 0, 1), nA = new THREE.Vector3(), qS = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0);
  const pick = list => list[(Math.random() * list.length) | 0];
  // ── drops: little cubes with a velocity, gravity, a life (the game's particles, blood only)
  const N = 700, geo = new THREE.BoxGeometry(1, 1, 1), im = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: .45, metalness: .05 }), N);
  im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.count = 0; im.frustumCulled = false; im.castShadow = false; im.setColorAt(0, col); scene.add(im);
  const D = []; for (let k = 0; k < N; k++) D.push({ on: false }); let dHead = 0;
  function spawn(n, x, y, z, o) { for (let k = 0; k < n; k++) { const p = D[dHead]; dHead = (dHead + 1) % N; const sp = o.speed, cone = o.cone;
    Object.assign(p, { on: true, x, y, z, vx: o.nx * sp * (.4 + Math.random() * .8) + (Math.random() - .5) * sp * cone, vy: o.ny * sp * (.4 + Math.random() * .8) + (Math.random() - .3) * sp * cone, vz: o.nz * sp * (.4 + Math.random() * .8) + (Math.random() - .5) * sp * cone,
      rx: Math.random() * 6, ry: Math.random() * 6, wx: (Math.random() - .5) * 20, wy: (Math.random() - .5) * 20, size: o.size * (.6 + Math.random() * .8), life: o.life * (.6 + Math.random() * .7), age: 0,
      grav: o.grav ?? 13, drag: o.drag ?? .5, color: pick(BLOOD.colors) }); } }
  // ── splats: flat pixel splats (one texture, turned and stretched) on one InstancedMesh; a ring
  const sc = document.createElement('canvas'); sc.width = sc.height = 32;
  { const x = sc.getContext('2d'), cell = (i, j) => x.fillRect(i * 2, j * 2, 2, 2); x.fillStyle = '#fff';
    for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) { const a = Math.atan2(j - 7.5, i - 7.5); if (Math.hypot(i - 7.5, j - 7.5) < 4.3 + Math.sin(a * 3 + 1) + Math.random() * 1.1) cell(i, j); }
    for (let k = 0; k < 8; k++) { const a = Math.random() * 6.283, d = 5.6 + Math.random() * 2, i = Math.round(7.5 + Math.cos(a) * d), j = Math.round(7.5 + Math.sin(a) * d); cell(i, j); if (Math.random() < .4) cell(i + 1, j); } }
  const sT = new THREE.CanvasTexture(sc); sT.magFilter = sT.minFilter = THREE.NearestFilter; sT.generateMipmaps = false; sT.colorSpace = THREE.SRGBColorSpace;
  const splatMat = new THREE.MeshStandardMaterial({ map: sT, alphaTest: .5, roughness: .35, metalness: 0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
  const SPL = 520, sim = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), splatMat, SPL);
  sim.instanceMatrix.setUsage(THREE.DynamicDrawUsage); sim.count = 0; sim.frustumCulled = false; sim.receiveShadow = true; sim.setColorAt(0, col); sim.renderOrder = 1; scene.add(sim);
  const SR = []; for (let k = 0; k < SPL; k++) SR.push({ on: false, k, q: new THREE.Quaternion(), car: null, lx: 0, ly: 0, lz: 0, lq: new THREE.Quaternion() }); let sHead = 0, sLift = 0, sDirty = false;
  const place = (s, f) => { if (s.car) { const c = s.car; q.setFromAxisAngle(Y, c.h + (c.yawOff || 0)); p3.set(s.lx, s.ly, s.lz).applyQuaternion(q); p3.x += c.x; p3.z += c.z; m4.compose(p3, q.multiply(s.lq), s3.set(s.w * f, s.h * f, 1)); }
    else m4.compose(p3.set(s.x, s.y, s.z), s.q, s3.set(s.w * f, s.h * f, 1)); sim.setMatrixAt(s.k, m4); sDirty = true; };
  function stamp(x, y, z, nx, ny, nz, w, h, spin, o = {}) { const s = SR[sHead]; sHead = (sHead + 1) % SPL; sLift = (sLift + 1) % 40; const lift = .008 + sLift * .0004;
    Object.assign(s, { on: true, car: null, x: x + nx * lift, y: y + ny * lift, z: z + nz * lift, w, h, age: -(o.delay ?? 0), life: o.life ?? BLOOD.life, grow: o.grow ?? 0 });
    s.q.setFromUnitVectors(zA, nA.set(nx, ny, nz).normalize()).multiply(qS.setFromAxisAngle(zA, spin));
    sim.setColorAt(s.k, col.setHex(o.color ?? pick(BLOOD.colors))); sim.instanceColor.needsUpdate = true; place(s, s.age < 0 ? 0 : s.grow ? .15 : 1); sim.count = Math.max(sim.count, s.k + 1); return s; }
  // a drop landing: a splat stretched along the way it was flying; on the target car's roof or bonnet it sticks to the car
  let target = null; const TL = new THREE.Vector3();
  function land(p) { const hs = Math.hypot(p.vx, p.vz), w = p.size * 3.4, spin = Math.atan2(-p.vz, p.vx);
    if (target && !target.gone) { const c = target; q.setFromAxisAngle(Y, -(c.h + (c.yawOff || 0))); TL.set(p.x - c.x, 0, p.z - c.z).applyQuaternion(q); const top = c.hgt || 1.4;
      if (Math.abs(TL.x) < c.wid / 2 - .05 && Math.abs(TL.z) < c.len / 2 - .1) { const ly = TL.z > c.len * .18 ? top * .66 : top; fx.carSplat(c, TL.x, ly, TL.z, 0, 1, 0, w * (1 + Math.min(1.4, hs * .25)) * .8, spin - (c.h + (c.yawOff || 0))); return; } }
    stamp(p.x, groundY(p.x, p.z), p.z, 0, 1, 0, w * (1 + Math.min(1.6, hs * .3)), w, spin, { life: BLOOD.life * (.7 + Math.random() * .5), color: p.color }); }
  // ── mist: a few sprites that bloom and fade
  const mc = document.createElement('canvas'); mc.width = mc.height = 64; { const x = mc.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(.5, 'rgba(255,255,255,.45)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); }
  const mT = new THREE.CanvasTexture(mc); mT.colorSpace = THREE.SRGBColorSpace; const mists = []; let mHead = 0;
  for (let k = 0; k < 10; k++) { const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: mT, color: night ? 0x9a1410 : 0x86100c, transparent: true, depthWrite: false })); m.visible = false; scene.add(m); mists.push({ m, t: 0, life: .4, s: 1, vx: 0, vz: 0 }); }
  // (drawn unseen for the first frames, so its shader compiles at boot, not at the first hit)
  mists[0].m.visible = true; mists[0].m.material.opacity = 0; let warm = 2;
  // ── skid marks: dark streaks on the road, one per rear wheel, stretched from where the slide began to where the wheel is now
  const SK = 64, skMat = new THREE.MeshStandardMaterial({ color: 0x050506, roughness: .95, metalness: 0, transparent: true, opacity: .9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  const skm = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), skMat, SK); skm.instanceMatrix.setUsage(THREE.DynamicDrawUsage); skm.count = 0; skm.frustumCulled = false; skm.receiveShadow = true; skm.renderOrder = 1; scene.add(skm);
  const SKR = []; for (let k = 0; k < SK; k++) SKR.push({ on: false, k, ax: 0, az: 0, bx: 0, bz: 0, age: 0, live: false }); let skHead = 0; const skidOf = new Map();
  const wheelAt = (c, side, out) => { const h = c.h + (c.yawOff || 0), r = c.len * .36, w = c.wid * .42; out[0] = c.x - Math.sin(h) * r + Math.cos(h) * w * side; out[1] = c.z - Math.cos(h) * r - Math.sin(h) * w * side; return out; };
  const W2 = [0, 0];
  // ── hazard lamps: four amber boxes at the corners of a car (unlit, bright), a glow round each at night
  const HZ = 48, hzm = new THREE.InstancedMesh(new THREE.BoxGeometry(.22, .12, .06), new THREE.MeshBasicMaterial({ color: 0xffa21a, toneMapped: false }), HZ);
  hzm.instanceMatrix.setUsage(THREE.DynamicDrawUsage); hzm.count = 0; hzm.frustumCulled = false; scene.add(hzm);
  const gc = document.createElement('canvas'); gc.width = gc.height = 64; { const x = gc.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,200,120,1)'); g.addColorStop(.25, 'rgba(255,150,40,.7)'); g.addColorStop(1, 'rgba(255,120,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); }
  const glowT = new THREE.CanvasTexture(gc); glowT.colorSpace = THREE.SRGBColorSpace;
  const hzg = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: glowT, transparent: true, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }), HZ);
  hzg.instanceMatrix.setUsage(THREE.DynamicDrawUsage); hzg.count = 0; hzg.frustumCulled = false; hzg.renderOrder = 4; scene.add(hzg);
  const hazCars = []; let blinkT = 0;

  const fx = {
    target(c) { target = c; },
    spray(x, y, z, dx, dy, dz, k = 1) { const l = Math.hypot(dx, dy, dz) || 1; dx /= l; dy /= l; dz /= l;
      // (with the blow)
      spawn(Math.round(26 * k), x, y, z, { nx: dx, ny: dy * .5 + .3, nz: dz, speed: 5.5, cone: .55, size: .07, life: 2.2, drag: .35 });
      // (a few back, at the car)
      spawn(Math.round(10 * k), x, y, z, { nx: -dx, ny: .45, nz: -dz, speed: 2.4, cone: .9, size: .055, life: 1.6 });
      // (up and round)
      spawn(Math.round(8 * k), x, y + .2, z, { nx: 0, ny: 1, nz: 0, speed: 2.6, cone: 1.4, size: .05, life: 2 });
      for (let j = 0; j < 2; j++) { const f = mists[mHead]; mHead = (mHead + 1) % mists.length; f.m.position.set(x + dx * .25 * j, y + .1 * j, z + dz * .25 * j);
        f.s = (1.3 + .5 * j) * Math.min(1.5, .7 + k * .4); f.life = f.t = .45 + .2 * j; f.vx = dx * (1.2 + j); f.vz = dz * (1.2 + j); f.m.material.rotation = Math.random() * 6; f.m.visible = true; } },
    // a trail of drops from a moving body (the one thrown: drops shed as it tumbles)
    shed(x, y, z, vx, vy, vz, n = 2) { const sp = Math.hypot(vx, vy, vz) || 1; spawn(n, x, y, z, { nx: vx / sp, ny: vy / sp, nz: vz / sp, speed: sp * .6, cone: .8, size: .05, life: 1.6 }); },
    splat: (x, y, z, nx, ny, nz, size = .5, o = {}) => stamp(x, y, z, nx, ny, nz, size * (.85 + Math.random() * .4), size * (.85 + Math.random() * .4), Math.random() * 6.283, { life: BLOOD.life, ...o }),
    pool: (x, z, size = 1.4, delay = 0) => stamp(x, groundY(x, z), z, 0, 1, 0, size, size * (.75 + Math.random() * .3), Math.random() * 6.283, { life: BLOOD.poolLife, grow: 4.5, delay, color: BLOOD.pool }),
    carSplat(c, lx, ly, lz, nx, ny, nz, size = .4, spin = Math.random() * 6.283) { const s = stamp(0, 0, 0, nx, ny, nz, size * (.85 + Math.random() * .4), size * (.85 + Math.random() * .4), spin, { life: BLOOD.life });
      s.car = c; s.lx = lx + nx * .012; s.ly = ly + ny * .012; s.lz = lz + nz * .012; s.lq.copy(s.q); place(s, 1); return s; },
    skid(c, on) { let m = skidOf.get(c); if (!on) { if (m) { for (const r of m) r.live = false; skidOf.delete(c); } return; }
      if (!m) { m = [-1, 1].map(side => { const r = SKR[skHead]; skHead = (skHead + 1) % SK; wheelAt(c, side, W2); Object.assign(r, { on: true, live: true, ax: W2[0], az: W2[1], bx: W2[0], bz: W2[1], age: 0, side }); return r; }); skidOf.set(c, m); }
      for (const r of m) { if (r.live) { wheelAt(c, r.side, W2); r.bx = W2[0]; r.bz = W2[1]; } } },
    hazard(c) { if (hazCars.length < HZ / 4) hazCars.push(c); },
    update(dt, camera) {
      // drops
      let n = 0; for (const p of D) { if (!p.on) continue; p.age += dt; if (p.age >= p.life) { p.on = false; continue; }
        p.vy -= p.grav * dt; const dr = Math.exp(-p.drag * dt); p.vx *= dr; p.vz *= dr; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        if (p.vy < 0 && target && !target.gone && p.y < (target.hgt || 1.4) + .05 && p.y > (target.hgt || 1.4) * .5) { const c = target; q.setFromAxisAngle(Y, -(c.h + (c.yawOff || 0))); TL.set(p.x - c.x, 0, p.z - c.z).applyQuaternion(q);
          if (Math.abs(TL.x) < c.wid / 2 - .05 && Math.abs(TL.z) < c.len / 2 - .1 && p.y < (TL.z > c.len * .18 ? (c.hgt || 1.4) * .66 : c.hgt || 1.4)) { p.on = false; land(p); continue; } }
        if (p.y < groundY(p.x, p.z) + p.size / 2) { p.on = false; land(p); continue; }
        p.rx += p.wx * dt; p.ry += p.wy * dt; m4.compose(p3.set(p.x, p.y, p.z), q.setFromEuler(e.set(p.rx, p.ry, 0)), s3.setScalar(p.size)); im.setMatrixAt(n, m4); im.setColorAt(n, col.setHex(p.color)); n++; }
      im.count = n; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
      // mist
      if (warm && --warm === 0 && mists[0].t <= 0) mists[0].m.visible = false;
      for (const f of mists) { if (f.t <= 0) continue; f.t -= dt; if (f.t <= 0) { f.m.visible = false; continue; } const k = 1 - f.t / f.life; f.m.position.x += f.vx * dt * (1 - k); f.m.position.z += f.vz * dt * (1 - k); f.m.position.y += .3 * dt;
        f.m.scale.setScalar(f.s * (.35 + .65 * Math.sqrt(k))); f.m.material.opacity = .85 * (1 - k * k); }
      // splats and pools: grow, ride their car, dry away
      for (const s of SR) { if (!s.on) continue; s.age += dt; if (s.age < 0) continue; if (s.car?.gone) { s.on = false; place(s, 0); continue; }
        if (s.grow) { const k = Math.min(1, s.age / s.grow); place(s, .15 + .85 * (1 - (1 - k) * (1 - k))); if (k >= 1) s.grow = 0; }
        else if (s.age > s.life) { s.on = false; place(s, 0); } else if (s.age > s.life - BLOOD.dry) place(s, (s.life - s.age) / BLOOD.dry); else if (s.car) place(s, 1); }
      if (sDirty) { sim.instanceMatrix.needsUpdate = true; sDirty = false; }
      // skid marks
      let ns = 0; for (const r of SKR) { if (!r.on) continue; r.age += dt; if (r.age > BLOOD.skidLife) { r.on = false; continue; } const L = Math.hypot(r.bx - r.ax, r.bz - r.az); if (L < .05) continue;
        const f = r.age > BLOOD.skidLife - BLOOD.dry ? (BLOOD.skidLife - r.age) / BLOOD.dry : 1; q.setFromAxisAngle(Y, Math.atan2(r.bx - r.ax, r.bz - r.az));
        m4.compose(p3.set((r.ax + r.bx) / 2, .012, (r.az + r.bz) / 2), q, s3.set(.24 * f, 1, L + .1)); skm.setMatrixAt(ns++, m4); }
      skm.count = ns; skm.instanceMatrix.needsUpdate = true;
      // hazard lamps: on 0.38 s, off 0.32
      blinkT += dt; const lit = (blinkT % .7) < .38; let nh = 0, ng = 0;
      if (lit) for (const c of hazCars) { if (c.gone) continue; const h = c.h + (c.yawOff || 0), y = Math.min(.95, (c.hgt || 1.4) * .55); q.setFromAxisAngle(Y, h);
        for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) { if (nh >= HZ) break; p3.set(sx * (c.wid / 2 - .12), y, sz * (c.len / 2 + .01)).applyQuaternion(q); p3.x += c.x; p3.z += c.z; m4.compose(p3, q, s3.set(1, 1, 1)); hzm.setMatrixAt(nh++, m4);
          m4.compose(p3, camera.quaternion, s3.setScalar(night ? 1.05 : .6)); hzg.setMatrixAt(ng++, m4); } }
      hzm.count = nh; hzm.instanceMatrix.needsUpdate = true; hzg.count = ng; hzg.instanceMatrix.needsUpdate = true; hazCars.length = 0;
    },
    clear() { for (const p of D) p.on = false; for (const s of SR) { if (s.on) { s.on = false; place(s, 0); } } for (const r of SKR) r.on = false; skidOf.clear(); im.count = 0; skm.count = 0; hzm.count = 0; hzg.count = 0; },
    stats: () => ({ drops: im.count, splats: SR.reduce((n, s) => n + (s.on ? 1 : 0), 0), skids: skm.count, lamps: hzm.count }),
  };
  return fx;
}
