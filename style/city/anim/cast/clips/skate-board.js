// SKATEBOARD · the one voxel model of the sim's `skateboard` item (MOVEMENT.md §2: one model everywhere — ridden, carried, parked, the
// icon) and how a skate clip poses it. No imports and no three at the top level (worker-safe: the icon baker, ui/icons/models.js, can
// read boardCells() straight into its Vx grid: `for (const c of boardCells()) v.set(...c)`).
//
// THE MODEL (cells of GRAIN m; x across, y up, z along, +z = the nose; the board's origin is its centre ON THE GROUND):
//   38 × 12 cells = 0.95 × 0.30 m (toon: the shoes are 0.45 m long and cross the deck in the ride stance, toes and heels over the rims;
//            the nose and tail show past the feet and the big head, from the street camera)
//   wheels   4 × (2 × 2 × 2) = 5 cm cubes under the deck rims, axles at z ±0.275 m (cream, gloss)
//   trucks   a hanger bar between each pair of wheels, right under the deck (grey, metal)
//   deck     the colour layer at y 2 (its underside carries the graphic: a bolt), the grip on top at y 3, inset a cell so a rim of
//            colour reads from above; the kicks step up a cell, then two, at each end; the tips are narrower (a rounded nose)
//   deck top = 0.10 m above the ground (BOARD.deck): a skate clip stands the body on it (the walker itself stays at ground level)
// Grain 0.025 m (half the character's 0.05): the thin deck, the kick and the trucks need it; a 0.05 deck would be a plank. The icon
// grid is ~12–22 voxels across; this model is 38, so the icon bake just frames it a little finer.
export const GRAIN = .025;
export const BOARD = { grain: GRAIN, len: .95, width: .3, deck: .1, axle: .275, wheel: .05 };
export const SCHEMES = {   // colour schemes (STYLE.md §2: flat, bold, never pastel). pink is the default; the sim may pick one per board
  pink: { deck: 0xff4fa3, art: 0xffe23a, grip: 0x26262c, wheel: 0xfff0d0, truck: 0xa7a9b1 },
  cobalt: { deck: 0x2f5bff, art: 0x6cff4a, grip: 0x26262c, wheel: 0xfff0d0, truck: 0xa7a9b1 },
  orange: { deck: 0xff7a1a, art: 0x17171b, grip: 0x26262c, wheel: 0xffc21a, truck: 0xa7a9b1 },
};
// the deck's profile by z cell: [lowest colour layer y, top colour layer y, x0, x1]; the grip sits on the top layer, x0 + 1 … x1 − 1, except
// on the tips. Each kick step overlaps the one before by a layer, so the deck is one piece face to face (no cells joined by an edge only).
const prof = z => { const a = z < 0 ? -z - 1 : z;   // (mirror: cells −1 / 0 are the middle pair)
  return a <= 12 ? [2, 2, -6, 5] : a === 13 ? [2, 3, -6, 5] : a === 14 ? [3, 3, -6, 5] : a === 15 ? [3, 4, -6, 5] : a === 16 ? [4, 4, -6, 5] : a === 17 ? [4, 4, -5, 4] : [4, 4, -4, 3]; };
// the graphic on the deck layer (seen underneath and on the rims): a bolt down the middle, x centre by z
const bolt = (x, z) => { if (z < -12 || z > 11) return false; const c = z < 0 ? -3 + (z + 12) * 5 / 11 : -2 + z * 5 / 11; return x >= Math.round(c) - 1 && x <= Math.round(c) + 1; };

// the cells: [x, y, z, colour, layer] (layer: 0 matte · 1 gloss · 2 metal, as the icon baker reads them)
export function boardCells(scheme = 'pink') {
  const K = typeof scheme === 'object' ? { ...SCHEMES.pink, ...scheme } : SCHEMES[scheme] || SCHEMES.pink, out = [];
  for (let z = -19; z <= 18; z++) { const [y0, y1, x0, x1] = prof(z), tip = z === -19 || z === 18;
    for (let x = x0; x <= x1; x++) { for (let y = y0; y <= y1; y++) out.push([x, y, z, bolt(x, z) ? K.art : K.deck, 0]); if (!tip && x > x0 && x < x1) out.push([x, y1 + 1, z, K.grip, 0]); } }
  for (const zc of [-12, 10]) {   // the trucks: axle centres at z ±11 cells (±0.275 m)
    for (const z of [zc, zc + 1]) { for (let x = -4; x <= 3; x++) out.push([x, 1, z, K.truck, 2]);
      for (const x of [-6, -5, 4, 5]) for (const y of [0, 1]) out.push([x, y, z, K.wheel, 1]); } }
  return out;
}

// the mesh: one quad per open cell face, the city's corner AO (chars.js voxGeo: 0.55 / 0.72 / 0.87 / 1), vertex colours, metres, the
// origin on the ground under the deck's centre. THREE is passed in (no import here). Memoised per scheme.
const DIRS = [
  { n: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]] }, { n: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },
  { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] }, { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] }, { n: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]] },
];
const AOV = [.55, .72, .87, 1], GEO = new Map();
export function boardGeometry(THREE, scheme = 'pink') {
  const key = typeof scheme === 'object' ? JSON.stringify(scheme) : scheme; if (GEO.has(key)) return GEO.get(key);
  const cells = boardCells(scheme), M = new Map(), k = (x, y, z) => `${x},${y},${z}`;
  for (const c of cells) M.set(k(c[0], c[1], c[2]), c[3]);
  const has = (x, y, z) => M.has(k(x, y, z)) ? 1 : 0, P = [], N = [], C = [], I = [], col = new THREE.Color(); let v = 0;
  for (const [x, y, z, hex] of cells) for (const d of DIRS) { const [nx, ny, nz] = d.n; if (has(x + nx, y + ny, z + nz)) continue;
    const a4 = d.c.map(c => { const t = [nx ? 0 : (c[0] ? 1 : -1), ny ? 0 : (c[1] ? 1 : -1), nz ? 0 : (c[2] ? 1 : -1)], e = [];   // (the AO of each corner)
      if (t[0]) e.push([t[0], 0, 0]); if (t[1]) e.push([0, t[1], 0]); if (t[2]) e.push([0, 0, t[2]]);
      const ax = x + nx, ay = y + ny, az = z + nz, s1 = has(ax + e[0][0], ay + e[0][1], az + e[0][2]), s2 = has(ax + e[1][0], ay + e[1][1], az + e[1][2]), cr = has(ax + t[0], ay + t[1], az + t[2]);
      return s1 && s2 ? 0 : 3 - (s1 + s2 + cr); });
    col.setHex(hex);
    d.c.forEach((c, q) => { P.push((x + c[0]) * GRAIN, (y + c[1]) * GRAIN, (z + c[2]) * GRAIN); N.push(nx, ny, nz); const a = AOV[a4[q]]; C.push(col.r * a, col.g * a, col.b * a); });
    if (a4[0] + a4[2] < a4[1] + a4[3]) I.push(v + 1, v + 2, v + 3, v + 1, v + 3, v); else I.push(v, v + 1, v + 2, v, v + 2, v + 3); v += 4; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setIndex(I); g.computeBoundingSphere(); GEO.set(key, g); return g;
}

// THE POSE (body frame of the walker: +z ahead, the walker's origin on the ground): { x, y, z, yaw, pitch, pz, roll }
//   the board's centre moves to (x, y, z) and turns by yaw (+: the nose turns to +x, as the walker's own yaw);
//   pitch (rad, + = NOSE UP) turns it about the line across the board through (z = pz, y = 0) in its own frame (a wheel's ground
//   contact: −BOARD.axle is the back wheels, a kickturn's or an ollie's pop); roll (rad, + = the +x rim up) about its long axis at deck height.
// boardMatrix(THREE, pose, out) → the board's local → walker matrix:  T(x, y, z) · Ry(yaw) · [T(0, 0, pz) · Rx(−pitch) · T(0, 0, −pz)] ·
// [T(0, H, 0) · Rz(roll) · T(0, −H, 0)]. The city's instance matrix = the walker's world matrix (ground point, yaw) × this.
export const REST = Object.freeze({ x: 0, y: 0, z: 0, yaw: 0, pitch: 0, pz: 0, roll: 0 });
export function boardMatrix(THREE, p, out = new THREE.Matrix4()) {
  const H = BOARD.deck, A = new THREE.Matrix4(), B = new THREE.Matrix4();
  out.makeTranslation(p.x, p.y, p.z).multiply(A.makeRotationY(p.yaw));
  out.multiply(A.makeTranslation(0, 0, p.pz)).multiply(B.makeRotationX(-p.pitch)).multiply(A.makeTranslation(0, 0, -p.pz));
  out.multiply(A.makeTranslation(0, H, 0)).multiply(B.makeRotationZ(p.roll)).multiply(A.makeTranslation(0, -H, 0));
  return out;
}
