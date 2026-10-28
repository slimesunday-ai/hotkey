// C1-7 · THE SETS' EFFECTS: sparks, dust, debris and steam, ported from slime's crafter game (game/src/view/fx.js, the puff emitter in
// game/src/world/life.js), without their blood and blast parts. One InstancedMesh per kind, pooled; nothing is allocated per frame.
// PURE: the game integrated each particle frame by frame from Math.random draws. Here a particle is a closed-form function of its burst's
// age and a seeded hash (the scene's id, the burst's beat, the particle's index): its velocity, size, colour and life are hash draws, its
// place the ballistic (or drag-damped) path at that age. A scene draws its bursts from the clip's own clock (a strike at 0.6 s of
// bench_hammer is age = clip time − 0.6), so a seek, which restarts the scene and its clips, draws the same sparks again.
//   fx.sparks(seed, p, d, age, o)   a burst of glowing streaks from p along d (the drill's bit, the hammer's anvil)
//   fx.dust(seed, p, age, o)        a puff of slow, rising, spreading grit (a pick's strike, the shovel's toss, the ram's fall)
//   fx.debris(seed, p, age, o)      chunks thrown up that fall back and lie on the ground (the unearthing)
//   fx.steam(seed, p, t, o)         an emitter: puffs every `period` s, each rising and drifting downwind for its life; t = the island
//                                   clock since the scene began (game minutes × GAME_MIN s). Thin wisps off a pot, thick out of the
//                                   woods shack (cook.md "The steam")
//   fx.glow(p, size, colour, a)     one additive flare (the drill's flicker on the door)
// Each frame the scenes add what is alive now; commit() (once a frame, from stage/record.js frame()) shows exactly that.
// THE NIGHT: the sparks and the flare are unlit (toneMapped false), so they read bright at 9:05 p.m.; dust and steam are lit like
// everything else, so they sit in the street's light instead of glowing.
import * as THREE from 'three';

// (a 32-bit integer hash of integers, then one of a string: the seeds)
export const hash = (...k) => { let h = 0x811c9dc5; for (const v of k) { h ^= v | 0; h = Math.imul(h, 0x01000193); h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15; } return h >>> 0; };
export const hashOf = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; };
const rnd = (seed, i, j) => hash(seed, i, j) / 4294967296;

export function createSetFx(scene) {
  const box = new THREE.BoxGeometry(1, 1, 1);
  const make = (mat, n) => { const m = new THREE.InstancedMesh(box, mat, n); m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.count = 0; m.frustumCulled = false; m.castShadow = false;
    m.setColorAt(0, new THREE.Color()); scene.add(m); return { m, n: 0, max: n }; };
  const glow = make(new THREE.MeshBasicMaterial({ toneMapped: false }), 600);
  const grit = make(new THREE.MeshStandardMaterial({ roughness: .9, metalness: 0 }), 500);
  const puff = make(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: .55, depthWrite: false }), 260); puff.m.renderOrder = 3;
  const flares = []; for (let k = 0; k < 6; k++) { const s = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: flareTexture(), transparent: true, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }));
    s.visible = false; s.frustumCulled = false; scene.add(s); flares.push(s); }
  let nFlare = 0;
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3(), D = new THREE.Vector3(), Z = new THREE.Vector3(0, 0, 1), E = new THREE.Euler(), C = new THREE.Color();
  const put = (L, x, y, z, sx, sy, sz, q, hex) => { if (L.n >= L.max) return; M.compose(P.set(x, y, z), q, S.set(sx, sy, sz)); L.m.setMatrixAt(L.n, M); L.m.setColorAt(L.n, C.setHex(hex)); L.n++; };
  const pick = (list, r) => Array.isArray(list) ? list[Math.min(list.length - 1, (r * list.length) | 0)] : list;
  // the game's draw of a particle's start: speed along the normal, a cone round it (fx.js spawn), every Math.random a hash draw
  function start(seed, k, o) {
    const sp = o.speed, cone = o.cone, [nx, ny, nz] = o.n, r = j => rnd(seed, k, j);
    return { vx: nx * sp * (.4 + r(1) * .8) + (r(2) - .5) * sp * cone, vy: ny * sp * (.4 + r(3) * .8) + (r(4) - .3) * sp * cone, vz: nz * sp * (.4 + r(5) * .8) + (r(6) - .5) * sp * cone,
      size: o.size * (.6 + r(7) * .8), life: o.life * (.6 + r(8) * .7), color: pick(o.color, r(9)), rx: r(10) * 6, ry: r(11) * 6, wx: (r(12) - .5) * 20, wy: (r(13) - .5) * 20 };
  }
  const fx = {
    sparks(seed, p, d, age, o = {}) {
      o = { n: 8, size: .03, life: .28, speed: 6, grav: 6, cone: .8, color: [0xffffff, 0xfff4c2, 0xffe08a, 0xffb347, 0xff8a2a], ...o }; const dl = Math.hypot(...d) || 1;
      const opt = { ...o, n: [d[0] / dl, d[1] / dl, d[2] / dl] };
      for (let k = 0; k < o.n; k++) { const s = start(seed, k, opt); if (age < 0 || age >= s.life) continue;
        const x = p[0] + s.vx * age, y = p[1] + s.vy * age - .5 * o.grav * age * age, z = p[2] + s.vz * age, vy = s.vy - o.grav * age, f = 1 - age / s.life, sz = s.size * f;
        Q.setFromUnitVectors(Z, D.set(s.vx, vy, s.vz).normalize()); put(glow, x, y, z, sz, sz, sz * 3.5, Q, s.color); }
    },
    dust(seed, p, age, o = {}) {
      o = { n: 6, size: .12, life: .7, speed: .8, grav: -.4, drag: 2.5, cone: 1.5, color: [0xcdbb9a, 0xb8a684, 0xd8ccb2], ...o };
      const opt = { ...o, n: o.dir ?? [0, 1, 0] };
      for (let k = 0; k < o.n; k++) { const s = start(seed, k, opt); if (age < 0 || age >= s.life) continue;
        // (drag on all three, gravity negative: it rises and slows; the closed form of the game's per-frame steps)
        const e = Math.exp(-o.drag * age), q = (1 - e) / o.drag, g = o.grav / o.drag, x = p[0] + s.vx * q, z = p[2] + s.vz * q, y = Math.max(p[1], p[1] + (s.vy + g) * q - g * age);
        const f = Math.min(1, (s.life - age) / (s.life * .35)), sz = s.size * Math.max(.05, f);
        Q.setFromEuler(E.set(s.rx + s.wx * q, s.ry + s.wy * q, 0)); put(grit, x, y, z, sz, sz, sz, Q, s.color); }
    },
    debris(seed, p, age, o = {}) {
      o = { n: 14, size: .07, life: 2.2, speed: 3, grav: 14, cone: 1.2, ground: p[1], color: [0x6b5a44, 0x7d6a4f, 0x4a3f31, 0x9c8a6a], ...o };
      const opt = { ...o, n: [0, 1, 0] };
      for (let k = 0; k < o.n; k++) { const s = start(seed, k, opt); if (age < 0 || age >= s.life) continue;
        // (up and back down; on the ground it lies where it lands, as the game's settle a bounce or two later)
        const tl = (s.vy + Math.sqrt(s.vy * s.vy + 2 * o.grav * Math.max(0, p[1] - o.ground))) / o.grav, a = Math.min(age, Math.max(0, tl));
        const x = p[0] + s.vx * a * .8, z = p[2] + s.vz * a * .8, y = Math.max(o.ground + s.size / 2, p[1] + s.vy * a - .5 * o.grav * a * a);
        const f = Math.min(1, (s.life - age) / (s.life * .35)), sz = s.size * Math.max(.05, f), spin = Math.min(age, tl);
        Q.setFromEuler(E.set(s.rx + s.wx * spin, s.ry + s.wy * spin, 0)); put(grit, x, y, z, sz, sz, sz, Q, s.color); }
    },
    // life.js's puff, as a function of t: puff k leaves at k·period (+ a hash's jitter), rises 0.9 m/s easing to 0.5, drifts with the
    // wind faster as it ages, grows by 1.6 × its gain and shrinks away over its last fifth
    steam(seed, p, t, o = {}) {
      const { period = .35, life = 5, k = 1, wind = [.45, .2], rise = .9, spread = .3, grey = [.78, .9] } = o;
      const L = life * 1.5, k0 = Math.max(0, Math.floor((t - L) / period)), k1 = Math.floor(t / period);
      for (let j = k0; j <= k1; j++) { const r = i => rnd(seed, j, i), age = t - (j * period + r(1) * period * .7), lf = life * (.67 + r(2) * .33); if (age < 0 || age >= lf) continue;
        const u = age / lf, y = p[1] + rise * age - (rise * .45) * age * age / lf, w = .4 * age + .5 * age * age / lf;
        const x = p[0] + (r(3) - .5) * spread + wind[0] * w, z = p[2] + (r(4) - .5) * spread + wind[1] * w;
        const s = (.3 * k + u * 1.6 * k * (.9 + r(5) * .2)) * (u > .8 ? (1 - u) / .2 : 1) * .5, c = grey[0] + r(6) * (grey[1] - grey[0]), rr = r(7) * 6;
        Q.setFromEuler(E.set(rr, rr * .7 + u, 0)); C.setRGB(c, c, c * .98); if (puff.n < puff.max) { M.compose(P.set(x, y, z), Q, S.setScalar(Math.max(.01, s))); puff.m.setMatrixAt(puff.n, M); puff.m.setColorAt(puff.n, C); puff.n++; } }
    },
    glow(p, size, hex, a = 1, cam = null) {
      const s = flares[nFlare]; if (!s) return; nFlare++; s.position.set(p[0], p[1], p[2]); s.scale.setScalar(size); s.material.color.setHex(hex); s.material.opacity = a;
      if (cam) s.quaternion.copy(cam.quaternion); s.visible = true;
    },
    // once a frame: show what the scenes added since the last commit, and start the next frame empty
    commit() {
      for (const L of [glow, grit, puff]) { L.m.count = L.n; L.m.instanceMatrix.needsUpdate = true; if (L.m.instanceColor) L.m.instanceColor.needsUpdate = true; L.n = 0; }
      for (let k = nFlare; k < flares.length; k++) flares[k].visible = false; nFlare = 0;
    },
    clear() { for (const L of [glow, grit, puff]) { L.n = 0; L.m.count = 0; } for (const s of flares) s.visible = false; nFlare = 0; },
    stats: () => ({ glow: glow.m.count, grit: grit.m.count, puff: puff.m.count }),
  };
  return fx;
}
function flareTexture() {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,240,1)'); g.addColorStop(.3, 'rgba(255,200,110,.85)'); g.addColorStop(1, 'rgba(255,110,20,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
