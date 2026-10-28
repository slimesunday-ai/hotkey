// CAMERA BUILD 3/4 (2026-10-05) · FLY (RESEARCH.md §4.6): a free camera with weight, on the collision world (world.js). Buildings,
// posts, PEOPLE and CARS are solid; it never passes through any of them and never slams into one. PHOTO's free camera is this
// controller with photo.* tuning, plus lens and roll. Per frame:
//   1 LOOK      raw: the mouse delta lands in the frame it arrives (fly lookSmooth 0; photo keeps its smoothing for pans). Pointer-lock
//               spikes are dropped in input.js (spikePx, lockQuietMs).
//   2 DEPEN     out of anything the camera starts the frame in (a walker walked into it, a car drove through it, a block's mesh
//               changed under it): pushed out over depenHL s, never left deeper than depenMax; deeper than deepAt: the nearest free spot.
//   3 WISH      camera-space keys × speed, speed = (speed + altGain × CLEARANCE above what is below, smoothed) × wheel × Shift boost ×
//               Alt slow. The velocity eases to the wish with half-life accelHL (held) / brakeHL (released): it glides to a stop.
//   4 GOVERNOR  one sphere sweep ahead (walls, posts, people, cars) and the floor (ground or roof + `floor`, eye level) and ceiling:
//               the closing speed toward each is capped by capCurve — constant deceleration (aMin, more above aFrom m/s) far out,
//               the linear law near it, joined at equal deceleration — applied to the TARGET velocity, so the deceleration ramps in
//               with no step (no wall slam, no jerk) and the lagged velocity stays critically damped (g ≤ k/4: it never overshoots).
//               Only the component into the surface is capped: grazing a wall the camera turns along it. A hard backstop (hardK ×
//               the deceleration) catches what the smooth law can't (an obstacle that appears late).
//   5 MOVE      in sub-steps of ≤ maxStep s with the exact exponential (30, 60 and 120 Hz trace the same path), then
//   6 SLIDE     the frame's displacement swept against everything, ≤ slideIters bumps: at contact − 2 cm the rest and the velocity
//               are clipped on the face (Quake's PM_ClipVelocity), a crease slides along n1 × n2, a third face stops.
//   keys  W S forward/back · A D strafe · E / Space up · Q / C down · arrows look · Shift boost · Alt slow · wheel speed (photo: lens)
//         photo only: Z X roll · - = lens
import * as THREE from 'three';
import { CAM } from './config.js';

const E = new THREE.Euler(0, 0, 0, 'YXZ'), FWD = new THREE.Vector3(), RIGHT = new THREE.Vector3(), V = new THREE.Vector3(), T = new THREE.Vector3(),
  D = new THREE.Vector3(), A = new THREE.Vector3(), B = new THREE.Vector3(), N = new THREE.Vector3(), N1 = new THREE.Vector3(), CR = new THREE.Vector3();
const LN2 = Math.LN2, ALL = 7, STATIC = 1;
const ease = (dt, tau) => tau <= 0 ? 1 : 1 - Math.exp(-dt / tau);
// the fastest closing speed (m/s) allowed at gap x (m): sqrt(2a·x − a·x*) far out (deceleration a), g·x within x* = a/g² (the same
// deceleration where they meet: no step in it)
export function capCurve(x, a, g) { if (!(x > 0)) return 0; const xs = a / (g * g); return x <= xs ? g * x : Math.sqrt(2 * a * x - a * xs); }
// the gap at which capCurve reaches v: how far ahead the governor must look at speed v
const capReach = (v, a, g) => { const xs = a / (g * g); return v <= g * xs ? v / g : (v * v + a * xs) / (2 * a); };

// world: camera/world.js (a caller without one — an old probe adapter — gets the page rig's)
export function createFly(world, { photo = false } = {}) {
  const pose = { p: new THREE.Vector3(), q: new THREE.Quaternion(), fov: CAM.fly.fov }, focus = new THREE.Vector3();
  const vel = new THREE.Vector3(), wish = new THREE.Vector3(), p = pose.p;
  let yaw = 0, pitch = 0, roll = 0, yawT = 0, pitchT = 0, rollT = 0, fovT = CAM.fly.fov, speedMul = 1, speedNow = 0, clear = null;
  const CV = new THREE.Vector3();   // (the governor's cut, smoothed: a vector along the surfaces' normals)
  const C = () => photo ? { ...CAM.fly, ...CAM.photo } : CAM.fly;
  const W = () => world?.sweep && world.overlap ? world : globalThis.__city?.cam?.world || null;
  const dbg = { gov: null, floor: 0, clear: 0, depth: 0, bumps: 0, sub: 1, capped: 0, depMove: 0, D: 0, slideOff: 0 };

  // ── 2. depenetration at the start of the frame
  function depen(Wd, c, dt) { dbg.depth = 0;
    for (let k = 0; k < 2; k++) { const o = Wd.overlap(p, c.radius, p.y - c.radius > c.dynTop ? STATIC : ALL); if (!o || o.depth <= 1e-4) return; if (!k) dbg.depth = o.depth;
      if (o.depth > c.deepAt) { const f = Wd.nearestFree(p, c.radius, ALL, 6); if (f) { p.set(f.x, f.y, f.z); vel.set(0, 0, 0); } return; }
      const push = Math.max((o.depth + .02) * (1 - Math.pow(2, -dt / c.depenHL)), o.depth - c.depenMax);
      p.x += o.n[0] * push; p.y += o.n[1] * push; p.z += o.n[2] * push;
      const vn = vel.x * o.n[0] + vel.y * o.n[1] + vel.z * o.n[2]; if (vn < 0) { vel.x -= o.n[0] * vn; vel.y -= o.n[1] * vn; vel.z -= o.n[2] * vn; } } }
  // ── 6. collide and slide the frame's displacement D (Quake III PM_SlideMove: ≤ slideIters bumps, a crease of two faces, stop on a third)
  const clip = (v, n) => { const d = v.dot(n); if (d < 0) v.addScaledVector(n, -d * 1.001); };
  function slide(Wd, c) { let planes = 0; dbg.bumps = 0;
    for (let it = 0; it < c.slideIters; it++) { const L = D.length(); if (L < 1e-7) return;
      B.copy(p).add(D); const h = Wd.sweep(p, B, c.radius, Math.min(p.y, B.y) - c.radius > c.dynTop ? STATIC : ALL); if (!h) { p.copy(B); return; }
      dbg.bumps++; const t = Math.max(0, h.t * L - .02) / L; p.addScaledVector(D, t); D.multiplyScalar(1 - t); N.fromArray(h.n);
      if (planes === 0) { N1.copy(N); clip(D, N); clip(vel, N); }
      else if (planes === 1 && N.dot(N1) < .999) { CR.crossVectors(N1, N); if (CR.lengthSq() < 1e-8) { clip(D, N); clip(vel, N); } else { CR.normalize(); const dd = D.dot(CR), vd = vel.dot(CR); D.copy(CR).multiplyScalar(dd); vel.copy(CR).multiplyScalar(vd); } }
      else if (planes >= 2) { D.set(0, 0, 0); vel.set(0, 0, 0); return; }
      else { clip(D, N); clip(vel, N); }
      planes++; } }
  // the clearance above what is below: the highest top under the camera over a 3 × 3 sample, ±clearR m
  function clearance(Wd, c, ox = 0, oz = 0, oy = 0) { let top = 0; const s = c.clearR, x = p.x + ox, y = p.y + oy, z = p.z + oz; for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) top = Math.max(top, Wd.floorAt(x + i * s, z + j * s, y)); return Math.max(0, y - top); }

  return {
    name: photo ? 'photo' : 'fly', pose, focus, dbg,
    get speed() { return speedNow; }, get speedMul() { return speedMul; }, get fov() { return pose.fov; }, get roll() { return roll; },
    // from: the pose the camera is leaving (p, q, fov) and, when it was moving, its velocity v (the hand-off glides on instead of stopping)
    enter(from) { p.copy(from.p); E.setFromQuaternion(from.q, 'YXZ'); yaw = yawT = E.y; pitch = pitchT = Math.max(-1.53, Math.min(1.53, E.x)); roll = rollT = photo ? E.z : 0;
      pose.fov = from.fov; fovT = photo ? from.fov : CAM.fly.fov; vel.set(0, 0, 0); if (from.v && Number.isFinite(from.v.x)) vel.copy(from.v); wish.set(0, 0, 0); clear = null; CV.set(0, 0, 0); this.update(0, null); },
    update(dt, I) {
      const c = C(), Wd = W();
      // ── 1. look
      if (I) {
        const s = CAM.look.base * CAM.look.sens, inv = CAM.look.invertY ? -1 : 1;
        yawT -= I.look.x * s; pitchT -= I.look.y * s * inv;
        const ar = (I.key('ArrowRight') ? 1 : 0) - (I.key('ArrowLeft') ? 1 : 0), au = (I.key('ArrowUp') ? 1 : 0) - (I.key('ArrowDown') ? 1 : 0);
        yawT -= (ar + I.rate.x * CAM.gamepad.look / c.keyLook) * c.keyLook * dt; pitchT += (au - I.rate.y * inv * CAM.gamepad.look / c.keyLook) * c.keyLook * dt;
        pitchT = Math.max(-1.53, Math.min(1.53, pitchT));
        if (photo) { rollT += ((I.key('KeyX') ? 1 : 0) - (I.key('KeyZ') ? 1 : 0)) * c.rollStep * dt;
          if (I.wheel) fovT *= Math.exp(I.wheel * .0012); if (I.key('Minus')) fovT *= Math.exp(dt * .9); if (I.key('Equal')) fovT *= Math.exp(-dt * .9);
          fovT = Math.max(c.fovRange[0], Math.min(c.fovRange[1], fovT)); }
        else if (I.wheel) speedMul = Math.max(c.speedMul[0], Math.min(c.speedMul[1], speedMul * Math.pow(c.wheelStep, -I.wheel / 100)));
      }
      const kl = ease(dt, c.lookSmooth); yaw += (yawT - yaw) * kl; pitch += (pitchT - pitch) * kl; roll += (rollT - roll) * ease(dt, .12); pose.fov += (fovT - pose.fov) * ease(dt, .12);
      E.set(pitch, yaw, roll, 'YXZ'); pose.q.setFromEuler(E);
      if (!dt) { this.aim(); return pose; }
      // ── 3. the wish in camera space (forward along the view, strafe level, up / down along world y)
      FWD.set(0, 0, -1).applyQuaternion(pose.q); RIGHT.set(Math.cos(yaw), 0, -Math.sin(yaw));
      let mx = 0, my = 0, mz = 0, boost = false, slow = false;
      if (I) { mx = I.move.x; mz = I.move.z; my = I.move.y + (I.any('KeyE', 'Space') ? 1 : 0) - (I.any('KeyQ', 'KeyC') ? 1 : 0); boost = I.boost; slow = I.slow; }
      V.copy(FWD).multiplyScalar(mz).addScaledVector(RIGHT, mx); V.y += my; if (V.lengthSq() > 1) V.normalize();
      const held = V.lengthSq() > 1e-4, hl = held ? c.accelHL : c.brakeHL, k = LN2 / hl, g = k / 4 * c.govG;
      if (!Wd) { const e = Math.pow(2, -dt / hl); wish.lerp(V, ease(dt, c.inputSmooth)); T.copy(wish).multiplyScalar(c.speed * speedMul * (boost ? c.boost : 1)); p.addScaledVector(T, dt).addScaledVector(vel.sub(T), (1 - e) / k); vel.multiplyScalar(e).add(T); speedNow = vel.length(); this.aim(); return pose; }   // (no collision world: free flight)
      A.copy(p); depen(Wd, c, dt); dbg.depMove = A.distanceTo(p);
      const mul = speedMul * (boost ? c.boost : 1) * (slow ? c.slow : 1), baseOf = cl => Math.min(c.maxSpeed, c.speed + cl * c.altGain) * mul;
      if (clear === null) clear = clearance(Wd, c, 0, 0);
      let base = baseOf(clear);
      // ── 4. the governor: one sweep along where the camera is going (its velocity and its target together)
      A.copy(wish).lerp(V, ease(dt, c.inputSmooth)).multiplyScalar(base); const vt = A.length(), vv = vel.length(), vmax = Math.max(vt, vv);
      const acc = c.aMin + c.aPerV * Math.max(0, vmax - c.aFrom), stand = c.stopGap + Math.min(c.standMax, c.standPerV * vv);
      let gov = null, gx0 = 0;
      A.add(vel); if (vmax > .05 && A.lengthSq() > 1e-6) { A.normalize(); const L = Math.min(c.govMax, capReach(vmax, acc, g) + stand + 2);
        B.copy(p).addScaledVector(A, L); const hit = Wd.sweep(p, B, c.radius, Math.min(p.y, B.y) - c.radius > c.dynTop ? STATIC : ALL);
        if (hit) { N.fromArray(hit.n); const cos = -A.dot(N); if (cos > 1e-3) { gov = hit; gx0 = hit.t * L * Math.max(cos, .05); } } }
      dbg.gov = gov && { d: +gx0.toFixed(3), kind: gov.kind, n: gov.n }; const floorY = Wd.floorAt(p.x, p.z, p.y + .05) + c.floor, ceil = c.ceiling; dbg.floor = floorY;
      // ── 5. sub-steps: the input ramp, the governed target, the exact exponential approach; D = the frame's displacement
      const n = Math.max(1, Math.ceil(dt / c.maxStep - 1e-9)), h = dt / n, e = Math.pow(2, -h / hl), ki = (1 - e) / k, ri = ease(h, c.inputSmooth), hard = c.hardK * acc; D.set(0, 0, 0); dbg.sub = n; dbg.capped = 0;
      for (let s = 0; s < n; s++) {
        const cl = clearance(Wd, c, D.x, D.z, D.y); clear = cl + (clear - cl) * Math.pow(2, -h / c.clearHL); base = baseOf(clear);   // (per sub-step: the same path at any frame rate)
        wish.lerp(V, ri); T.copy(wish).multiplyScalar(base);
        // the governor's cut in the closing speed, smoothed (up corrUp s, down corrDown s): a surface the sweep meets one frame and
        // misses the next (a ledge the camera's top just grazes) can't make the velocity chatter; never pushes away from the surface
        let rc = 0; if (gov) { const x = gx0 + D.dot(N) - stand, cap = capCurve(x, acc, g); rc = Math.max(0, -T.dot(N) - cap); }
        CR.copy(N).multiplyScalar(gov ? rc : 0); const cl0 = CV.length(); CV.sub(CR).multiplyScalar(Math.pow(2, -h / (rc > cl0 ? c.corrUp : c.corrDown))).add(CR);
        const cvl = CV.length(); if (cvl > 1e-6) { CR.copy(CV).divideScalar(cvl); const cut = Math.min(cvl, Math.max(0, -T.dot(CR))); if (cut > 0) { T.addScaledVector(CR, cut); dbg.capped |= 1; } }
        const y = p.y + D.y, xf = y - floorY, xc = ceil - y;
        if (xf >= 0) { const cap = capCurve(xf, acc, g); if (-T.y > cap) { T.y = -cap; dbg.capped |= 2; } } else T.y = Math.max(T.y, Math.min(c.riseMax, -xf * g));   // (under the floor — a step up, a roof edge: rise to it, eased)
        if (xc >= 0) { const cap = capCurve(xc, acc, g); if (T.y > cap) T.y = cap; } else T.y = Math.min(T.y, xc * g);
        D.addScaledVector(T, h).addScaledVector(vel.sub(T), ki); vel.multiplyScalar(e).add(T);
        // the backstop: never close faster than hard deceleration can still stop before contact (the floor: before the eye-level line)
        if (gov) { const xg = gx0 + D.dot(N) - .02, u = -vel.dot(N), cap = Math.sqrt(2 * hard * Math.max(0, xg)); if (u > cap) { vel.addScaledVector(N, u - cap); dbg.capped |= 4; } }
        const xf2 = p.y + D.y - floorY + .3; if (xf2 >= 0 && -vel.y > Math.sqrt(2 * hard * xf2)) { vel.y = -Math.sqrt(2 * hard * xf2); dbg.capped |= 8; }
      }
      dbg.clear = clear;
      // ── 6. collide and slide
      A.copy(p).add(D); dbg.D = D.length(); slide(Wd, c); dbg.slideOff = A.distanceTo(p);
      if (p.y > c.ceiling + 1) p.y = c.ceiling + 1;
      speedNow = vel.length(); this.aim(); return pose;
    },
    // what the camera looks at, for the stream's walkers, shadows and haze (controls.target): where the view meets the ground, ≤ 300 m
    aim() { FWD.set(0, 0, -1).applyQuaternion(pose.q); const h = Math.max(.5, p.y);
      const t = FWD.y < -.05 ? Math.min(300, h / -FWD.y) : Math.min(300, Math.max(25, h * 1.2)); focus.copy(p).addScaledVector(FWD, t); if (focus.y > 0 && FWD.y >= -.05) focus.y = 0; if (focus.y < 0) focus.y = 0; },
    setVelocity(v) { vel.copy(v); }, get velocity() { return vel; }, get wish() { return wish; },
    look(y, pt) { yaw = yawT = y; pitch = pitchT = pt; },
    nudgeSpeed(f) { const c = C(); speedMul = Math.max(c.speedMul[0], Math.min(c.speedMul[1], speedMul * f)); },
    resetRoll() { rollT = 0; },
  };
}
