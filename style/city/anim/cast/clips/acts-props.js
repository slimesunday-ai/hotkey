// ACTS PROPS · the one voxel model of each prop the day's errand acts need (acts.js; the city's stage/acts.js stages them: GAME.md §41,
// "every action the agent performs ... needs to be watchable"), and the points the clips hold them by. No imports and no three at the
// top level (worker-safe, as errands-props.js: the icon baker can read actsCells(id) straight into its Vx grid). The phone is
// phone-prop.js's and the plain parcel errands-props.js's envelope in kraft paper (acts.js KRAFT: the city's hand-over parcel), reused.
// NEUTRAL BY §19 (GAME.md: details a day late): no label, no number, no print and no drug colour on any of them. The garment is plain grey; the duvet, the floor and the counter are the room's and the street's own neutrals.
//
// THE MODELS (cells of each model's grain; each prop's own frame, metres):
//   garment   a plain grey tee held up by its shoulders, open (0.46 wide, 0.50 long, its sleeves out at the top corners), 0.05 thick:
//             the origin is the middle of its shoulder line, the two fists on its shoulders at ±ACTS.garment.grip[0]; it hangs down (−y)
//             from there, its front toward +z.
//   duvet     the cover over a sleeper on its back (acts.js sleep): 1.1 wide (x), 1.15 long (z: from under the chin to past the feet),
//             a soft hump over the body (its top 0.42 m up at the chest, 0.37 over the shins), its edges draped to 0.05 off the
//             mattress, a turned-down sheet band at the chin end. In the SLEEPER's body frame (the walker's: its ground point on the
//             mattress, its feet at z ≈ 0, its head toward −z): the origin is the walker's ground point.
//   floor     the act's floorboard patch (floorboard_*): three planks, 0.15 × 0.50 each, laid along z, the middle one the loose board
//             (its own model, `board`): with it lifted, the dark gap shows (empty: the parcel in it is the clip's prop). It lies ON the
//             room's floor, 0.05 proud (a gap below the floor would be hidden by it). Its origin is the patch's centre on the floor.
//   board     the loose plank (0.15 × 0.025 × 0.50), its origin at the centre of its underside; it is prised up about its outer long
//             edge and stands on it.
//   counter   haggle_counter's stand-in counter (the lab's, and the stage's at the Heap: acts.md): a plywood top 1.2 × 0.6 on a
//             crate front, its top 0.74 m up and its near edge 0.26 m ahead of the walker's ground point (ACTS.counter).
// Grains: 0.025 (the garment, the board, the floor patch), 0.05 (the duvet, the counter).
export const GRAIN = .025;
// the points the clips and the city use (metres, in each prop's frame)
export const ACTS = {
  garment: { grip: [.19, 0, 0], w: .46, len: .5 },
  duvet: { w: 1.1, z0: -.95, z1: .2, top: .42 },
  floor: { w: .45, len: .5, top: .05 },
  board: { w: .15, len: .5, t: .025, y: .025 },
  counter: { top: .74, near: .26, far: .86, w: 1.2 },
};
// colours (STYLE.md §2: flat, bold; the neutrals here are the city's paper, wood and cloth)
export const SCHEMES = {
  garment: { cloth: 0x8e9098, clothD: 0x75777f },
  duvet: { cover: 0xd9d2c3, coverD: 0xc2baa9, sheet: 0xf7f4ec },
  floor: { wood: 0xa8743f, woodD: 0x8a5d31, gap: 0x16141a, nail: 0x3a3a40 },
  board: { wood: 0xa8743f, woodD: 0x8a5d31, nail: 0x3a3a40 },
  counter: { top: 0xc79a5b, topD: 0xa97e45, crate: 0x8a6a45, crateD: 0x6e5235 },
};
const schemeOf = (id, s) => ({ ...SCHEMES[id], ...(s && typeof s === 'object' ? s : {}) });
// a model's grain (metres a cell)
const GR = { garment: .025, board: .025, floor: .025, duvet: .05, counter: .05 };

// the cells: [x, y, z, colour, layer] (layer: 0 matte · 1 gloss · 2 metal); a cell (x, y, z) spans [x, x + 1] × grain etc.
const MODELS = {
  // the tee: its shoulder line at y 0 (cells y −1), the body x −9..8 (0.45) down to y −20 (0.50), sleeves x ±(9..12) y −1..−6, a neck
  // scoop at the top middle; z −1..0 (0.05)
  garment(K) { const out = [];
    for (let y = -20; y <= -1; y++) for (let x = -12; x <= 11; x++) {
      const body = x >= -9 && x <= 8, sleeve = !body && y >= -7 && y <= -1 && (x >= -12 && x <= 11) && !(y < -4 && (x === -12 || x === 11));
      if (!body && !sleeve) continue; if (y === -1 && x >= -3 && x <= 2) continue; if (y === -2 && x >= -2 && x <= 1) continue;
      for (let z = -1; z <= 0; z++) out.push([x, y, z, (y === -20 || (y < -6 && (x === -9 || x === 8))) ? K.clothD : K.cloth, 0]); }
    return out; },
  // the duvet (grain 0.05): x −11..10 (1.1), z −19..3 (from −0.95 to +0.2), its top's height h(x, z) a hump over the body (0.42 at the
  // chest, 0.38 at the hips, 0.37 over the shins and the upturned feet), falling off to the sides; solid down to y 1 (0.05): its sides
  // hang there; a quilting line every 0.25 along it; the sheet band z −19..−17 at the chin end
  duvet(K) { const out = [], H = (x, z) => { const ax = Math.abs(x + .5) / 11, zz = (z + .5) * .05; const body = zz < -.55 ? .42 : zz < -.25 ? .38 : .37;
      return Math.max(2, Math.round((body * (1 - ax * ax * ax * .8) + .02) / .05)); };
    for (let x = -11; x <= 10; x++) for (let z = -19; z <= 3; z++) { const h = H(x, z), sheet = z <= -17;
      for (let y = 1; y < h; y++) out.push([x, y, z, sheet ? K.sheet : (z % 5 === 0 || x === -11 || x === 10 || z === 3) ? K.coverD : K.cover, 0]); }
    return out; },
  // the floor patch (grain 0.025, laid ON the room's floor: the gap can't go below it): side planks x −9..−4 and 3..8 (0.15 each), two
  // cells thick (0.05 proud of the floor), z −10..9 (0.50); between them the gap under the loose board (x −3..2, its own model): a dark
  // bottom one cell up, so it reads as a hole 0.025 deep from above
  floor(K) { const out = [];
    for (let z = -10; z <= 9; z++) { for (let x = -9; x <= 8; x++) { if (x >= -3 && x <= 2) { out.push([x, 0, z, K.gap, 0]); continue; }
        for (let y = 0; y <= 1; y++) out.push([x, y, z, (x === -4 || x === 3 || x === -9 || x === 8) ? K.woodD : ((z & 3) ? K.wood : K.woodD), 0]); } }
    for (const [x, z] of [[-7, -9], [-7, 8], [6, -9], [6, 8]]) out.push([x, 2, z, K.nail, 2]);
    return out; },
  // the loose plank (grain 0.025): x −3..2 (0.15), y 0 (0.025), z −10..9 (0.50: the patch's length), its origin the centre of its
  // underside; a nail gone, one left at its far end
  board(K) { const out = [];
    for (let x = -3; x <= 2; x++) for (let z = -10; z <= 9; z++) out.push([x, 0, z, (x === -3 || x === 2) ? K.woodD : ((z & 3) ? K.wood : K.woodD), 0]);
    out.push([0, 1, 7, K.nail, 2]); return out; },
  // the counter (grain 0.05): the top x −12..11 (1.2), y 14 (0.70–0.75), z 5..16 (0.26–0.86 from the walker's ground point: the origin);
  // a crate front under it at z 6..7, y 0..13
  counter(K) { const out = [];
    for (let x = -12; x <= 11; x++) for (let z = 5; z <= 16; z++) out.push([x, 14, z, z === 5 ? K.topD : K.top, 0]);
    for (let x = -11; x <= 10; x++) for (let y = 0; y <= 13; y++) for (let z = 6; z <= 15; z += 9) out.push([x, y, z, (y % 5 === 4 || x % 6 === 0) ? K.crateD : K.crate, 0]);
    for (const x of [-11, 10]) for (let y = 0; y <= 13; y++) for (let z = 7; z <= 14; z++) out.push([x, y, z, K.crateD, 0]);
    return out; },
};
export function actsCells(id, scheme = null) { const m = MODELS[id]; if (!m) throw new Error('acts-props: no model ' + id); return m(schemeOf(id, scheme)); }
export const grainOf = id => GR[id];

// the mesh: one quad per open cell face, the city's corner AO (as errands-props.js), vertex colours, metres in the prop's frame. THREE is
// passed in (no import here). Memoised per model and colourway.
const DIRS = [
  { n: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]] }, { n: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },
  { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] }, { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] }, { n: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]] },
];
const AOV = [.55, .72, .87, 1], GEO = new Map();
export function actsGeometry(THREE, id, scheme = null) {
  const K = schemeOf(id, scheme), key = id + JSON.stringify(K); if (GEO.has(key)) return GEO.get(key);
  const G = GR[id], cells = actsCells(id, K), M = new Map(), k = (x, y, z) => `${x},${y},${z}`;
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
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setIndex(I); g.computeBoundingSphere(); GEO.set(key, g); return g;
}

// THE POSE (the gun's contract): { p: [x, y, z], R: [9 numbers, column-major: the prop's x, y, z axes], show } in the walker's body frame:
// the prop's origin goes to p, its axes to R's columns. show < 0.5 hides it (collapsed onto its origin). actsMatrix(THREE, pose, out) →
// the prop's local → walker matrix; the city's instance matrix = the walker's world matrix (ground point, yaw) × this.
export function actsMatrix(THREE, pose, out = new THREE.Matrix4()) {
  const R = pose.R, p = pose.p;
  out.set(R[0], R[3], R[6], p[0], R[1], R[4], R[7], p[1], R[2], R[5], R[8], p[2], 0, 0, 0, 1);
  if (pose.show !== undefined && pose.show < .5) out.multiply(new THREE.Matrix4().makeScale(1e-4, 1e-4, 1e-4));
  return out;
}
export const actsDir = (pose, d) => { const R = pose.R; return [R[0] * d[0] + R[3] * d[1] + R[6] * d[2], R[1] * d[0] + R[4] * d[1] + R[7] * d[2], R[2] * d[0] + R[5] * d[1] + R[8] * d[2]]; };
export const actsPoint = (pose, q) => { const r = actsDir(pose, q); return [pose.p[0] + r[0], pose.p[1] + r[1], pose.p[2] + r[2]]; };
