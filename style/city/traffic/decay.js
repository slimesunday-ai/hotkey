// C2-GAPS (2026-11-05) · DECAY OVER TIME: a body the van can't reach rots where it lies (slime, 11-05: "...and  then that last 1/3rd is
// decay over time. both leave stains"). traffic/accident.js owns the body and decides who takes it; this file runs one clock per body and
// drives its remains (stage/remains.js) and the flies. The stain is accident.js's (it spreads with stain()).
//   THE STAGES (fractions of DECAY.secs, the ONE length setting; overlapping, as rot does):
//     bloat      0 … .28    the torso swells first (the remains' shell grows over it from the middle, pallid, and swells)
//     discolour  .18 … .52  the rot spreads over the whole body (cover → whole: the walker under it is hidden), green → purple marbling
//     flies      .28 … .97  a swarm over it, thickening, then thinning as it goes
//     collapse   .55 … .95  it sinks and flattens into the ground, black, the flesh shrinking away into the stain; the bones stay
//                            (stage/remains.js REMAINS.bones)
//     the stain  .5 … 1     spreads under it and stays
//   A SEEK is a cut: finish() takes it to its end at once.
import * as THREE from 'three';

export const DECAY = {
  secs: 90,                               // THE LENGTH: s from the take to the stain (slime's to change)
  bloat: [0, .28], discolour: [.18, .52], flies: [.28, .97], collapse: [.55, .95], stain: [.5, 1],
  fly: { n: 70, r: .9, h: [.15, 1.1], size: .05, color: 0x15140f },   // the flies: at most · m round the body · m up · m each
};
const ramp = (t, [a, b]) => Math.max(0, Math.min(1, (t - a) / (b - a)));
const ease = x => x * x * (3 - 2 * x);

export function createDecay({ scene, remains }) {
  const S = { bodies: 0, live: 0 }, live = new Set();
  // the flies: one Points cloud for every body (4 at once at most)
  const NF = DECAY.fly.n * 4, pos = new Float32Array(NF * 3), geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setDrawRange(0, 0);
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: DECAY.fly.color, size: DECAY.fly.size, sizeAttenuation: true })); pts.frustumCulled = false; scene.add(pts);
  function start(K, R) { const D = { K, R, t: 0, k: 0, done: false, seed: Math.random() * 100, flies: [] };
    for (let n = 0; n < DECAY.fly.n; n++) D.flies.push({ a: Math.random() * 6.283, r: .2 + Math.random() * DECAY.fly.r, h: DECAY.fly.h[0] + Math.random() * (DECAY.fly.h[1] - DECAY.fly.h[0]), w: (Math.random() < .5 ? -1 : 1) * (2 + Math.random() * 5), ph: Math.random() * 6.283, on: Math.random() });
    live.add(D); S.bodies++; return D; }
  // the controls at a fraction k of the clock
  function at(D, k) { const bl = ease(ramp(k, DECAY.bloat)), dc = ease(ramp(k, DECAY.discolour)), co = ease(ramp(k, DECAY.collapse));
    return { cover: Math.min(1, bl * .42 + dc * .58 + (dc >= 1 ? 1 : 0)), swell: bl * (1 - co * .6), rot: Math.min(1, bl * .18 + dc * .47 + co * .35), sink: co, eat: 0 }; }
  function update(dt) { let nf = 0;
    for (const D of live) { D.t += dt; D.k = Math.min(1, D.t / DECAY.secs); D.R.set(at(D, D.k)); if (D.k >= 1) D.done = true;
      // the flies: how many are about now (thick in the middle of the rot, thin at its ends), each circling and dipping round the body
      // (round the body's middle as it lies: lie_still's, 0.15 m along it and 0.4 m to its forward side of the rest point)
      const f = ramp(D.k, DECAY.flies), dens = Math.sin(Math.min(1, f) * Math.PI) ** .7, r0 = D.K.rest, sink = D.R.P.sink, cx = r0.x + Math.cos(r0.yaw) * .15 + Math.sin(r0.yaw) * .4, cz = r0.z - Math.sin(r0.yaw) * .15 + Math.cos(r0.yaw) * .4;
      for (const q of D.flies) { if (q.on > dens || nf >= NF) continue; const a = q.a + D.t * q.w / (q.r + .3), y = r0.gy + q.h * (1 - sink * .7) + Math.sin(D.t * 9 + q.ph) * .08;
        pos[nf * 3] = cx + Math.cos(a) * q.r + Math.sin(D.t * 13 + q.ph) * .05; pos[nf * 3 + 1] = y; pos[nf * 3 + 2] = cz + Math.sin(a) * q.r * .7; nf++; } }
    for (const D of [...live]) if (D.done) live.delete(D);
    geo.setDrawRange(0, nf); geo.attributes.position.needsUpdate = true; S.live = live.size; S.flies = nf; }
  function finish(D) { D.t = DECAY.secs; D.k = 1; D.R.set(at(D, 1)); D.done = true; live.delete(D); }
  return { start, update, finish, DECAY, stats: () => ({ ...S }), get live() { return [...live]; }, points: pts };
}
