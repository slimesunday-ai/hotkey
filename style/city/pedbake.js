// Pass 2 · the generic pedestrians' bodies, baked once per look in a build worker (worker-safe: the chars module CH and THREE are
// passed in, world/chars.js is used as-is). Every walker is a chars.js character (rollLook), in three tiers like the rest of the cast:
//   full  ANIMATION MERGE (2026-09-29): the lab's walk v2 body (anim/bake.js bakeSegFull): 11 rigid parts, each meshed CLOSED (pelvis,
//         chest, head · thigh, shin, foot, arm each side: simple arms, 2026-09-30), a joint slab on every child, the 0.5 mm per-link growth that
//         keeps a parent's faces outside its child's (no z-fight); every vertex tagged with its part (anim/walk2.js poses it on the GPU).
//         Built from CH.compose(look), not from the built meshes. (Before: the chars.js meshes merged, 5 limbs swung whole.)
//   mid   the same body in mid-stride resampled to one city cube (0.1), interior filled, greedy-meshed (charbake.js's rule)
//   far   three boxes (legs · torso · head) in the main colour of each band
// Output per look: typed arrays in body-local metres (feet at y = 0, facing +z), ready for BufferGeometry on the main thread.
// CAST PASS (2026-10-02): CH is the city's cast (cast.js), not world/chars.js: every look is rolled from the fresh traits slime didn't
// kill, built by the fresh construction (world/cast/chars.js) and baked by its walk's bake (anim/cast/bake.js). The full tier carries fine
// paint (FI, FT: peds.js adopts the tiles into its atlas); mid resamples CH.build(), which draws each painted face in its average colour.
import { Bank, Vol, meshVol } from './vox.js';
import { ELBOW } from './anim/cast/elbow/styles.js';   // (THE ELBOW, 2026-10-08: bodies baked for the cast's bend: band tags, the thick and held flags in a Float32 aPart)
import { bakeSegFull } from './anim/cast/bake.js';   // (cast pass: the fresh cast's bake: connected legs, fine paint (FI / FT / FA), seat fix)
const LUT = new Uint8Array(4097); for (let i = 0; i <= 4096; i++) { const c = i / 4096; LUT[i] = Math.round(255 * (c <= .0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - .055)); }
const toS = v => LUT[v <= 0 ? 0 : v >= 1 ? 4096 : (v * 4096 + .5) | 0];
const visible = o => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };

// mid: the posed voxels → cells of 2 × 2 × 2 chars voxels (one 0.1 city cube), filled, meshed; same arrays (limb tag 0)
function bakeMid(THREE, CH, o) {
  const inv = new THREE.Matrix4().copy(o.matrixWorld).invert(), tm = new THREE.Matrix4(), cells = new Map();
  o.traverse(m => { if (!m.isMesh || !visible(m)) return; const li = Math.max(0, CH.MATS.indexOf(m.material)); tm.multiplyMatrices(inv, m.matrixWorld); const e = tm.elements, g = m.geometry, pos = g.attributes.position.array, nor = g.attributes.normal.array, col = g.attributes.color.array;
    for (let q = 0; q < pos.length / 12; q++) { const b = q * 12; let cx = 0, cy = 0, cz = 0; for (let t = 0; t < 4; t++) { cx += pos[b + t * 3]; cy += pos[b + t * 3 + 1]; cz += pos[b + t * 3 + 2]; }
      cx = cx / 4 - nor[b] * .5; cy = cy / 4 - nor[b + 1] * .5; cz = cz / 4 - nor[b + 2] * .5; const X = e[0] * cx + e[4] * cy + e[8] * cz + e[12], Y = e[1] * cx + e[5] * cy + e[9] * cz + e[13], Z = e[2] * cx + e[6] * cy + e[10] * cz + e[14];
      const k = Math.floor(X / 2) + ',' + Math.floor(Y / 2) + ',' + Math.floor(Z / 2), h = (toS(col[b]) << 16) | (toS(col[b + 1]) << 8) | toS(col[b + 2]); let c = cells.get(k); if (!c) cells.set(k, c = new Map()); const key = h * 4 + li; c.set(key, (c.get(key) || 0) + (li === 3 ? 3 : 1)); } });
  let x0 = 1e9, y0 = 1e9, z0 = 1e9, x1 = -1e9, y1 = -1e9, z1 = -1e9; for (const k of cells.keys()) { const [x, y, z] = k.split(',').map(Number); x0 = Math.min(x0, x); y0 = Math.min(y0, y); z0 = Math.min(z0, z); x1 = Math.max(x1, x); y1 = Math.max(y1, y); z1 = Math.max(z1, z); }
  const V = new Vol(x1 - x0 + 3, y1 - y0 + 3, z1 - z0 + 3, { s: 2, org: [(x0 - 1) * 2, (y0 - 1) * 2, (z0 - 1) * 2], ground: false });   // chars-voxel units; × S below
  for (const [k, c] of cells) { const [x, y, z] = k.split(',').map(Number); let best = 0, bc = -1; for (const [h, n] of c) if (n > bc) { bc = n; best = h; } V.set(x - x0 + 1, y - y0 + 1, z - z0 + 1, best >> 2, best & 3); }
  // fill the inside (nothing the flood from outside reaches) so the greedy mesher never draws a hidden face
  const nx = V.nx, ny = V.ny, nz = V.nz, seen = new Uint8Array(nx * ny * nz), st = [0]; seen[0] = 1; const id = (x, y, z) => x + nx * (z + nz * y);
  while (st.length) { const i = st.pop(), x = i % nx, z = ((i / nx) | 0) % nz, y = (i / (nx * nz)) | 0; for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) { const X = x + dx, Y = y + dy, Z = z + dz; if (X < 0 || Y < 0 || Z < 0 || X >= nx || Y >= ny || Z >= nz) continue; const j = id(X, Y, Z); if (seen[j] || V.has(X, Y, Z)) continue; seen[j] = 1; st.push(j); } }
  const fill = V.pal[1] ?? 0x777777; for (let y = 0; y < ny; y++) for (let z = 0; z < nz; z++) for (let x = 0; x < nx; x++) if (!seen[id(x, y, z)] && !V.has(x, y, z)) V.set(x, y, z, fill);
  const bank = meshVol(V, new Bank(true)), P = [], N = [], C = [], I = []; let v = 0, sc = CH.S;   // (cells are in chars voxels; × S → metres)
  bank.L.forEach((O, li) => { if (!O.v) return; for (let k = 0; k < O.v; k++) { P.push(O.P.a[k * 3] * sc, O.P.a[k * 3 + 1] * sc, O.P.a[k * 3 + 2] * sc); N.push(O.N.a[k * 3], O.N.a[k * 3 + 1], O.N.a[k * 3 + 2]); C.push(toS(O.C.a[k * 3]), toS(O.C.a[k * 3 + 1]), toS(O.C.a[k * 3 + 2]), li * 85); }
    for (let k = 0; k < O.I.n; k++) I.push(O.I.a[k] + v); v += O.v; });
  return { P: new Float32Array(P), N: new Int8Array(N), C: new Uint8Array(C), K: new Uint8Array(v), I: new Uint32Array(I) };
}
// NPC integration (2026-10-07): the random street walkers are background civilians, dressed from the NPC pool (cast.js TWO POOLS);
// pool: 'agent' bakes agent-dressed walkers instead (nothing in the city asks for that today).
export function bakePeds({ n = 24, seed = 0x5eed, pool = 'npc' }, CH, THREE) {
  const looks = [];
  for (let k = 0; k < n; k++) { const look = CH.rollLook((seed + k * 7919) & 0xffffff, { pool });
    const full = bakeSegFull(THREE, CH, look, { elbow: ELBOW }), o = CH.build(look); o.userData.open.visible = true; o.userData.shut.visible = false;
    CH.pose(o, Math.PI / 2, .8); o.updateMatrixWorld(true); const mid = bakeMid(THREE, CH, o); o.traverse(m => m.geometry?.dispose());
    looks.push({ full, mid, main: full.main }); }
  return { looks };
}
