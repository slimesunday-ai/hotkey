// LIGHTING PASS (2026-09-28) · CONTACT SHADOWS: soft blob shadows that seat things on the ground (the sun's shadow map is too coarse to
// ground a walker's feet or a car's tyres). One instanced soft-disc decal (a canvas radial gradient) per kind, off by default:
//   walkers  every walker drawn near or mid (peds.js tiers 1–2), read from peds.sim.walkers (positions only, nothing written)
//   cars     every car within range, an ellipse under its body, read from traffic.sim.cars and traffic.MODELS (L × W)
//   props    the corner lamps and signal poles of every block (ground.js cornerPosts), a static batch
// Moving batches: frustumCulled = false (three r185 never refreshes a batch's bounding sphere as instances move).
import * as THREE from 'three';
import { paintedTexture } from '../canvastex.js';   // (black-ground fix: repainted after a GPU-process reset)

export const CONTACT_FIELDS = {
  on: { v: false, label: 'contact shadows' },
  strength: { v: .42, min: 0, max: 1, step: .01, label: 'strength' },
  size: { v: 1, min: .5, max: 2, step: .01, label: 'size' },
  color: { v: '#1d1838', color: true, label: 'colour', hint: 'a cool dark, not black: the shadow keeps the toon colour' },
  walkers: { v: true, label: 'under walkers' },
  cars: { v: true, label: 'under cars' },
  props: { v: true, label: 'under lamps and signal poles' },
  range: { v: 140, min: 30, max: 300, step: 1, label: 'range (m)' },
};

function blobTexture() {
  const t = paintedTexture(64, 64, g => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.45, 'rgba(255,255,255,.75)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
  t.colorSpace = THREE.NoColorSpace; return t; }

export function createContacts({ scene, posts }) {
  let mat = null, moving = null, still = null, v = null; const CAP = 1600, M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  function init() { const g = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    mat = new THREE.MeshBasicMaterial({ alphaMap: blobTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4, fog: true });
    moving = new THREE.InstancedMesh(g, mat, CAP); moving.frustumCulled = false; moving.count = 0; moving.instanceMatrix.setUsage(THREE.DynamicDrawUsage); moving.renderOrder = 1;
    const list = posts(); still = new THREE.InstancedMesh(g, mat, Math.max(1, list.length)); list.forEach(([x, z, r], k) => { const s = Math.max(.7, r * 3.2); still.setMatrixAt(k, M.makeScale(s, 1, s).setPosition(x, .215, z)); });
    still.count = list.length; still.computeBoundingSphere(); still.renderOrder = 1;
    for (const m of [moving, still]) { m.castShadow = m.receiveShadow = false; scene.add(m); } }
  // V10 (render review 2026-10-09) · only the slots that changed go up (traffic/lamps.js does the same): a blob's matrix is compared with
  // what its slot holds, and update() flags that range alone. It used to re-send all CAP slots every frame (100 KB), moving or not.
  const F16 = new Float32Array(16); let lo = Infinity, hi = -1;
  const put = (k, m) => { const a = moving.instanceMatrix.array, o = k * 16; F16.set(m.elements);
    for (let i = 0; i < 16; i++) if (a[o + i] !== F16[i]) { a.set(F16, o); lo = Math.min(lo, o); hi = Math.max(hi, o + 16); return; } };
  return {
    apply(val) { v = val; if (!val.on) { if (moving) moving.visible = still.visible = false; return; } if (!mat) init();
      mat.color.set(val.color); mat.opacity = val.strength; moving.visible = true; still.visible = !!val.props; },
    get count() { return moving ? moving.count : 0; },
    update(cam, peds, traffic) { if (!v?.on || !moving) return; let n = 0; const r2 = v.range * v.range, sz = v.size;
      if (v.walkers && peds?.sim) for (const w of peds.sim.walkers) { if (n >= CAP) break; if (w.tier !== 1 && w.tier !== 2) continue; const p = w.p, dx = p[0] - cam.x, dz = p[2] - cam.z; if (dx * dx + dz * dz > r2) continue;
        put(n++, M.makeScale(.95 * sz, 1, .95 * sz).setPosition(p[0], p[1] + .018, p[2])); }
      if (v.cars && traffic?.sim) { const MO = traffic.MODELS; for (const c of traffic.sim.cars) { if (n >= CAP) break; if (c.kind === 'patrol') continue; const dx = c.x - cam.x, dz = c.z - cam.z; if (dx * dx + dz * dz > r2) continue;
        const m = MO[c.model] || MO[0]; Q.setFromAxisAngle(Y, c.h); P.set(c.x, .018, c.z); S.set((m.W || 1.8) * 1.25 * sz, 1, (m.L || 4.4) * 1.12 * sz); put(n++, M.compose(P, Q, S)); } }
      moving.count = n;
      if (hi > lo) { moving.instanceMatrix.addUpdateRange(lo, hi - lo); moving.instanceMatrix.needsUpdate = true; }
      lo = Infinity; hi = -1; },
  };
}
