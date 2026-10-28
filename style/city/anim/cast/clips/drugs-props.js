// DOSE PACKET · the one voxel model of a dose (MOVEMENT.md §2: one model everywhere) and how dose_take poses it (drugs.js). No imports
// and no three at the top level (worker-safe, like phone-prop.js: the icon baker can read packetCells() straight into its Vx grid).
//
// ONE LOOK FOR EVERY DRUG (slime: a drug's name never shows live). TEMP, TRUTH, HALLU, FIREWALL, CLEAR and SUDO all come in this one
// packet: one colour scheme (SCHEME, no colourways), no label, no per-drug shape or size. Nothing here takes a drug, and the city must
// not pass one, tint it, or swap the model by drug.
//
// THE MODEL (cells of GRAIN m; the packet's own frame): a small zip baggie with a few white pills in the bottom. x across it, y up its
// length (from its bottom edge to the zip), z through it. The origin is its BOTTOM EDGE's centre, mid-thickness. The toon fist is about
// twice a real hand, so the packet is about twice a real one: 0.10 × 0.125 × 0.025 m.
//   bag     4 × 5 × 1 cells: x −0.05 … +0.05, y 0 … 0.125, z −0.0125 … +0.0125 (the mesh is shifted half a cell in z)
//   pills   the two middle cells of the bottom row: white
//   zip     the top row: a red strip
// Grain 0.025 m (half the character's 0.05, as the phone, the gun and the tools).
export const GRAIN = .025;
const G = GRAIN;
// the packet's numbers (metres, its own frame)
export const PACKET = { origin: [0, 0, 0], top: [0, .125, 0], w: .1, len: .125, d: .025 };
// one scheme only (see above): clear plastic read as a pale blue-white, white pills, a red zip (the same red on every dose)
export const SCHEME = { bag: 0xdde7ee, pill: 0xffffff, zip: 0xd8343a };

// the cells: [x, y, z, colour, layer] (layer: 0 matte · 1 gloss · 2 metal, as the icon baker reads them); a cell (x, y, z) spans
// [x, x + 1] × G etc. (the mesh shifts z by half a cell so the packet is centred on its own plane)
export function packetCells() {
  const K = SCHEME, out = [];
  for (let x = -2; x <= 1; x++) for (let y = 0; y <= 4; y++) out.push([x, y, 0, y === 4 ? K.zip : y === 0 && (x === -1 || x === 0) ? K.pill : K.bag, y === 4 ? 0 : 1]);
  return out;
}

// the mesh: one quad per open cell face, the city's corner AO (as phone-prop.js), vertex colours, metres in the packet's frame. THREE
// is passed in (no import here). Memoised.
const DIRS = [
  { n: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]] }, { n: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },
  { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] }, { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] }, { n: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]] },
];
const AOV = [.55, .72, .87, 1];
let GEO = null;
export function packetGeometry(THREE) {
  if (GEO) return GEO;
  const cells = packetCells(), M = new Map(), k = (x, y, z) => `${x},${y},${z}`;
  for (const c of cells) M.set(k(c[0], c[1], c[2]), c[3]);
  const has = (x, y, z) => M.has(k(x, y, z)) ? 1 : 0, P = [], N = [], C = [], I = [], col = new THREE.Color(); let v = 0;
  for (const [x, y, z, hex] of cells) for (const d of DIRS) { const [nx, ny, nz] = d.n; if (has(x + nx, y + ny, z + nz)) continue;
    const a4 = d.c.map(c => { const t = [nx ? 0 : (c[0] ? 1 : -1), ny ? 0 : (c[1] ? 1 : -1), nz ? 0 : (c[2] ? 1 : -1)], e = [];
      if (t[0]) e.push([t[0], 0, 0]); if (t[1]) e.push([0, t[1], 0]); if (t[2]) e.push([0, 0, t[2]]);
      const ax = x + nx, ay = y + ny, az = z + nz, s1 = has(ax + e[0][0], ay + e[0][1], az + e[0][2]), s2 = has(ax + e[1][0], ay + e[1][1], az + e[1][2]), cr = has(ax + t[0], ay + t[1], az + t[2]);
      return s1 && s2 ? 0 : 3 - (s1 + s2 + cr); });
    col.setHex(hex);
    d.c.forEach((c, q) => { P.push((x + c[0]) * G, (y + c[1]) * G, (z + c[2] - .5) * G); N.push(nx, ny, nz); const a = AOV[a4[q]]; C.push(col.r * a, col.g * a, col.b * a); });
    if (a4[0] + a4[2] < a4[1] + a4[3]) I.push(v + 1, v + 2, v + 3, v + 1, v + 3, v); else I.push(v, v + 1, v + 2, v, v + 2, v + 3); v += 4; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setIndex(I); g.computeBoundingSphere(); GEO = g; return g;
}

// THE POSE (dose_take's, drugs.js): { p: [x, y, z], R: [9 numbers, column-major: the packet's x, y, z axes], show } in the walker's body
// frame: the packet's origin goes to p, its axes to R's columns. show < 0.5 hides it (collapsed onto its origin, as phone-prop.js).
// packetMatrix(THREE, pose, out) → the packet's local → walker matrix: T(p) · R. The city's instance matrix = the walker's world matrix
// (ground point, yaw) × this. packetPoint(pose, q) → a point of the packet's frame (PACKET.top …) in the body frame.
export function packetMatrix(THREE, pose, out = new THREE.Matrix4()) {
  const R = pose.R, p = pose.p;
  out.set(R[0], R[3], R[6], p[0], R[1], R[4], R[7], p[1], R[2], R[5], R[8], p[2], 0, 0, 0, 1);
  if (pose.show !== undefined && pose.show < .5) out.multiply(new THREE.Matrix4().makeScale(1e-4, 1e-4, 1e-4));
  return out;
}
export const packetPoint = (pose, q = PACKET.top) => { const R = pose.R; return [pose.p[0] + R[0] * q[0] + R[3] * q[1] + R[6] * q[2], pose.p[1] + R[1] * q[0] + R[4] * q[1] + R[7] * q[2], pose.p[2] + R[2] * q[0] + R[5] * q[1] + R[8] * q[2]]; };
