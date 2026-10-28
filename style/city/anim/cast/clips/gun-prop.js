// PISTOL · the one voxel model of the shooter's gun (MOVEMENT.md §2: one model everywhere) and how the aim clips pose it (robbery.js:
// aim_draw, aim_hold, aim_fire, aim_lower). No imports and no three at the top level (worker-safe, like work-tools.js: the icon baker can
// read gunCells() straight into its Vx grid: `for (const c of gunCells()) v.set(...c)`).
//
// THE MODEL (cells of GRAIN m; x across, y up, z along the barrel toward the muzzle). The origin is the GRIP POINT: the mitten's centre
// sits there (the hand's grip point, walk2.js rest (±0.325, 0.39, 0)), inside the grip. The toon fist is a 0.15 × 0.2 × 0.15 m mitten,
// about twice a real one, so the gun is sized to show around it: the slide rides ON TOP of the fist, the barrel and the trigger guard
// stick out in front of it, the grip's butt shows under it.
//   slide    11 × 2 × 2 cells: 0.275 m long (≈ 1.3 × a full-size service pistol's 0.21 m), 0.05 wide, 0.05 tall, z −0.05 … 0.225,
//            y 0.10 … 0.15 (the mitten's top face is at y 0.10); a bare-steel muzzle face (the one accent: it marks where the flash is)
//   frame    the dust cover under the slide's front half (y 0.075 … 0.10, z 0.05 … 0.20), the trigger guard and the trigger in front
//            of the fist
//   grip     2 cells wide, slanting back as it goes down, y −0.125 … 0.10: its butt shows 2.5 cm under the fist
// Grain 0.025 m (half the character's 0.05, as the board and the tools): the slide and the guard need the finer step.
export const GRAIN = .025;
const G = GRAIN;
// the points the clips and the city use (metres, in the gun's frame)
export const GUN = {
  grip: [0, 0, 0],            // where the hand's grip point (the mitten's centre) sits
  muzzle: [0, .125, .225],    // the bore's exit: the centre of the slide's front face
  dir: [0, 0, 1],             // the barrel's direction (the shot goes this way)
  len: .275, top: .15, butt: -.125,
};
export const SCHEME = { body: 0x26262c, slide: 0x3a3e47, steel: 0xd5dbe2 };   // (STYLE.md §2: flat, bold; gunmetal with one bare-steel accent)

// the cells: [x, y, z, colour, layer] (layer: 0 matte · 1 gloss · 2 metal, as the icon baker reads them); a cell (x, y, z) spans
// [x, x + 1] × G etc., so the 2-wide parts at x −1..0 are centred on the barrel's axis
export function gunCells(scheme = null) {
  const K = { ...SCHEME, ...(scheme || {}) }, out = [], add = (x, y, z, c, l = 0) => out.push([x, y, z, c, l]);
  for (const x of [-1, 0]) {
    for (let z = -2; z <= 8; z++) for (const y of [4, 5]) add(x, y, z, z === 8 ? K.steel : K.slide, z === 8 ? 2 : 1);   // the slide; its muzzle face steel
    for (let z = 2; z <= 7; z++) add(x, 3, z, K.body, 1);                                                            // the dust cover
    for (let z = 1; z <= 5; z++) add(x, 0, z, K.body, 1);                                                            // the trigger guard's bottom
    for (const y of [1, 2]) add(x, y, 5, K.body, 1);                                                                 // … and its front
    add(x, 2, 3, K.body, 1);                                                                                         // the trigger
    // the grip: slanting back a cell every three rows as it goes down
    for (let y = 3; y >= -5; y--) { const back = y >= 1 ? 0 : y >= -2 ? 1 : 2; for (let z = -2 - back; z <= 1 - back; z++) add(x, y, z, K.body, 1); }
  }
  return out;
}

// the mesh: one quad per open cell face, the city's corner AO (as work-tools.js / skate-board.js), vertex colours, metres in the gun's
// frame. THREE is passed in (no import here). Memoised.
const DIRS = [
  { n: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]] }, { n: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },
  { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] }, { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] }, { n: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]] },
];
const AOV = [.55, .72, .87, 1]; let GEO = null;
export function gunGeometry(THREE) {
  if (GEO) return GEO;
  const cells = gunCells(), M = new Map(), k = (x, y, z) => `${x},${y},${z}`;
  for (const c of cells) M.set(k(c[0], c[1], c[2]), c[3]);
  const has = (x, y, z) => M.has(k(x, y, z)) ? 1 : 0, P = [], N = [], C = [], I = [], col = new THREE.Color(); let v = 0;
  for (const [x, y, z, hex] of cells) for (const d of DIRS) { const [nx, ny, nz] = d.n; if (has(x + nx, y + ny, z + nz)) continue;
    const a4 = d.c.map(c => { const t = [nx ? 0 : (c[0] ? 1 : -1), ny ? 0 : (c[1] ? 1 : -1), nz ? 0 : (c[2] ? 1 : -1)], e = [];
      if (t[0]) e.push([t[0], 0, 0]); if (t[1]) e.push([0, t[1], 0]); if (t[2]) e.push([0, 0, t[2]]);
      const ax = x + nx, ay = y + ny, az = z + nz, s1 = has(ax + e[0][0], ay + e[0][1], az + e[0][2]), s2 = has(ax + e[1][0], ay + e[1][1], az + e[1][2]), cr = has(ax + t[0], ay + t[1], az + t[2]);
      return s1 && s2 ? 0 : 3 - (s1 + s2 + cr); });
    col.setHex(hex);
    d.c.forEach((c, q) => { P.push((x + c[0]) * G, (y + c[1]) * G, (z + c[2]) * G); N.push(nx, ny, nz); const a = AOV[a4[q]]; C.push(col.r * a, col.g * a, col.b * a); });
    if (a4[0] + a4[2] < a4[1] + a4[3]) I.push(v + 1, v + 2, v + 3, v + 1, v + 3, v); else I.push(v, v + 1, v + 2, v, v + 2, v + 3); v += 4; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setIndex(I); g.computeBoundingSphere(); GEO = g; return g;
}

// THE POSE (an aim clip's, robbery.js): { p: [x, y, z], R: [9 numbers, column-major: the gun's x, y, z axes], show } in the walker's body
// frame: the gun's grip point goes to p, its axes to R's columns. show < 0.5 hides it (collapsed onto its grip point, as work-tools.js).
// gunMatrix(THREE, pose, out) → the gun's local → walker matrix: T(p) · R · T(−GUN.grip). The city's instance matrix = the walker's world
// matrix (ground point, yaw) × this. gunPoint(pose, q) → a point of the gun's frame (GUN.muzzle …) in the body frame; gunDir(pose, d) a
// direction.
export function gunMatrix(THREE, pose, out = new THREE.Matrix4()) {
  const R = pose.R, p = pose.p, g = GUN.grip;
  out.set(R[0], R[3], R[6], p[0] - (R[0] * g[0] + R[3] * g[1] + R[6] * g[2]),
    R[1], R[4], R[7], p[1] - (R[1] * g[0] + R[4] * g[1] + R[7] * g[2]),
    R[2], R[5], R[8], p[2] - (R[2] * g[0] + R[5] * g[1] + R[8] * g[2]),
    0, 0, 0, 1);
  if (pose.show !== undefined && pose.show < .5) { const A = new THREE.Matrix4().makeTranslation(g[0], g[1], g[2]).multiply(new THREE.Matrix4().makeScale(1e-4, 1e-4, 1e-4)).multiply(new THREE.Matrix4().makeTranslation(-g[0], -g[1], -g[2])); out.multiply(A); }
  return out;
}
export const gunDir = (pose, d = GUN.dir) => { const R = pose.R; return [R[0] * d[0] + R[3] * d[1] + R[6] * d[2], R[1] * d[0] + R[4] * d[1] + R[7] * d[2], R[2] * d[0] + R[5] * d[1] + R[8] * d[2]]; };
export const gunPoint = (pose, q = GUN.muzzle) => { const r = gunDir(pose, [q[0] - GUN.grip[0], q[1] - GUN.grip[1], q[2] - GUN.grip[2]]); return [pose.p[0] + r[0], pose.p[1] + r[1], pose.p[2] + r[2]]; };
