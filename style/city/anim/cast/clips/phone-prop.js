// PHONE · the one voxel model of a bystander's phone (MOVEMENT.md §2: one model everywhere) and how film_phone poses it (react.js). No
// imports and no three at the top level (worker-safe, like gun-prop.js: the icon baker can read phoneCells() straight into its Vx grid).
//
// THE MODEL (cells of GRAIN m; the phone's own frame): x along its LONG side (it is held in landscape, filming), y up its short side, z
// out of its back (the camera side; the screen is the −z face, toward the holder). The origin is the GRIP POINT: the hand's grip point
// (the mitten's centre, walk2.js rest (±0.325, 0.39, 0)) sits there. The toon fist is a 0.16 × 0.16 × 0.25 m mitten, about twice a
// real hand, so the phone is about twice a real one too: 0.30 × 0.15 × 0.025 m. The fist holds its +x end (x −0.05 … +0.025 is inside
// the fist) and the rest reaches in front of the chest toward the midline.
//   body     12 × 6 × 1 cells: x −0.275 … +0.025, y −0.05 … +0.10, z −0.025 … 0
//   screen   the −z face's cells inside a one-cell bezel: a light, cool blue (it reads as lit at street distance)
//   camera   a dark bump on the back (+z) at the far end (x −0.25 … −0.20, y 0.075 … 0.10): where it films from
// Grain 0.025 m (half the character's 0.05, as the gun, the board and the tools).
export const GRAIN = .025;
const G = GRAIN;
// the points the clips and the city use (metres, in the phone's frame)
export const PHONE = {
  grip: [0, 0, 0],                // where the hand's grip point (the mitten's centre) sits
  lens: [-.225, .0875, .0125],    // the camera bump's centre (the back, +z): what it films from
  screen: [-.125, .025, -.025],   // the screen's centre (the −z face)
  dir: [0, 0, 1],                 // where the camera looks (out of the back)
  len: .3, h: .15, d: .025,
};
export const SCHEME = { body: 0xff4f9a, bezel: 0x1c1c22, screen: 0x8fd8ff, lens: 0x18181c };   // (STYLE.md §2: flat, bold; a loud case: it is what the street sees)
// the case's colourways (the city picks one per walker; pass the key or { body: 0x… }): a white case lit flat read as the grey of a hoodie
export const SCHEMES = { pink: { body: 0xff4f9a }, cyan: { body: 0x2fd3ff }, yellow: { body: 0xffd23a }, lime: { body: 0x8ee63a }, white: { body: 0xf4f4f8 }, black: { body: 0x2a2a30 } };
const schemeOf = s => ({ ...SCHEME, ...(typeof s === 'string' ? SCHEMES[s] : s || {}) });

// the cells: [x, y, z, colour, layer] (layer: 0 matte · 1 gloss · 2 metal, as the icon baker reads them); a cell (x, y, z) spans
// [x, x + 1] × G etc.
export function phoneCells(scheme = null) {
  const K = schemeOf(scheme), out = [], add = (x, y, z, c, l = 0) => out.push([x, y, z, c, l]);
  for (let x = -11; x <= 0; x++) for (let y = -2; y <= 3; y++) add(x, y, -1, K.body, 1);   // the slab (one cell thick)
  add(-10, 3, 0, K.lens, 2); add(-9, 3, 0, K.lens, 2);   // the camera bump, on the back at the far end
  return out;
}
// the screen is the slab's −z face inside a one-cell bezel: a face colour, not a cell (phoneGeometry paints it)
const onScreen = (x, y) => x >= -10 && x <= -1 && y >= -1 && y <= 2;

// the mesh: one quad per open cell face, the city's corner AO (as gun-prop.js), vertex colours, metres in the phone's frame. THREE is
// passed in (no import here). Memoised per colourway (phoneGeometry(THREE) is the default, pink).
const DIRS = [
  { n: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]] }, { n: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },
  { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] }, { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] }, { n: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]] },
];
const AOV = [.55, .72, .87, 1], GEO = new Map();
export function phoneGeometry(THREE, scheme = null) {
  const K = schemeOf(scheme), key = JSON.stringify(K); if (GEO.has(key)) return GEO.get(key);
  const cells = phoneCells(K), M = new Map(), k = (x, y, z) => `${x},${y},${z}`;
  for (const c of cells) M.set(k(c[0], c[1], c[2]), c[3]);
  const has = (x, y, z) => M.has(k(x, y, z)) ? 1 : 0, P = [], N = [], C = [], I = [], col = new THREE.Color(); let v = 0;
  for (const [x, y, z, hex] of cells) for (const d of DIRS) { const [nx, ny, nz] = d.n; if (has(x + nx, y + ny, z + nz)) continue;
    const a4 = d.c.map(c => { const t = [nx ? 0 : (c[0] ? 1 : -1), ny ? 0 : (c[1] ? 1 : -1), nz ? 0 : (c[2] ? 1 : -1)], e = [];
      if (t[0]) e.push([t[0], 0, 0]); if (t[1]) e.push([0, t[1], 0]); if (t[2]) e.push([0, 0, t[2]]);
      const ax = x + nx, ay = y + ny, az = z + nz, s1 = has(ax + e[0][0], ay + e[0][1], az + e[0][2]), s2 = has(ax + e[1][0], ay + e[1][1], az + e[1][2]), cr = has(ax + t[0], ay + t[1], az + t[2]);
      return s1 && s2 ? 0 : 3 - (s1 + s2 + cr); });
    const lit = nz === -1 && onScreen(x, y);   // (the screen: no AO, it is lit)
    col.setHex(lit ? K.screen : nz === -1 ? K.bezel : hex);
    d.c.forEach((c, q) => { P.push((x + c[0]) * G, (y + c[1]) * G, (z + c[2]) * G); N.push(nx, ny, nz); const a = lit ? 1 : AOV[a4[q]]; C.push(col.r * a, col.g * a, col.b * a); });
    if (a4[0] + a4[2] < a4[1] + a4[3]) I.push(v + 1, v + 2, v + 3, v + 1, v + 3, v); else I.push(v, v + 1, v + 2, v, v + 2, v + 3); v += 4; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setIndex(I); g.computeBoundingSphere(); GEO.set(key, g); return g;
}

// THE POSE (film_phone's, react.js): { p: [x, y, z], R: [9 numbers, column-major: the phone's x, y, z axes], show } in the walker's body
// frame: the phone's grip point goes to p, its axes to R's columns. show < 0.5 hides it (collapsed onto its grip point, as gun-prop.js).
// phoneMatrix(THREE, pose, out) → the phone's local → walker matrix: T(p) · R · T(−PHONE.grip). The city's instance matrix = the walker's
// world matrix (ground point, yaw) × this. phonePoint(pose, q) → a point of the phone's frame (PHONE.lens …) in the body frame;
// phoneDir(pose, d) a direction.
export function phoneMatrix(THREE, pose, out = new THREE.Matrix4()) {
  const R = pose.R, p = pose.p, g = PHONE.grip;
  out.set(R[0], R[3], R[6], p[0] - (R[0] * g[0] + R[3] * g[1] + R[6] * g[2]),
    R[1], R[4], R[7], p[1] - (R[1] * g[0] + R[4] * g[1] + R[7] * g[2]),
    R[2], R[5], R[8], p[2] - (R[2] * g[0] + R[5] * g[1] + R[8] * g[2]),
    0, 0, 0, 1);
  if (pose.show !== undefined && pose.show < .5) { const A = new THREE.Matrix4().makeTranslation(g[0], g[1], g[2]).multiply(new THREE.Matrix4().makeScale(1e-4, 1e-4, 1e-4)).multiply(new THREE.Matrix4().makeTranslation(-g[0], -g[1], -g[2])); out.multiply(A); }
  return out;
}
export const phoneDir = (pose, d = PHONE.dir) => { const R = pose.R; return [R[0] * d[0] + R[3] * d[1] + R[6] * d[2], R[1] * d[0] + R[4] * d[1] + R[7] * d[2], R[2] * d[0] + R[5] * d[1] + R[8] * d[2]]; };
export const phonePoint = (pose, q = PHONE.lens) => { const r = phoneDir(pose, [q[0] - PHONE.grip[0], q[1] - PHONE.grip[1], q[2] - PHONE.grip[2]]); return [pose.p[0] + r[0], pose.p[1] + r[1], pose.p[2] + r[2]]; };
