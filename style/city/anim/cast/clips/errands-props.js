// ERRANDS PROPS · the one voxel model of each errands prop (MOVEMENT.md §2: one model everywhere: held, dropped, the icon) and the
// points the errands clips (errands.js) hold them by. The phone is phone-prop.js's (reused, not here). No imports and no three at the
// top level (worker-safe, as gun-prop.js and heist-props.js: the icon baker can read errandsCells(id) straight into its Vx grid).
//
// THE MODELS (cells of GRAIN m; each prop's own frame):
//   envelope  a fat cash envelope for a bribe, about twice a real one (as the toon fist is twice a real hand): 0.40 m long (z), 0.15 m
//             wide (y), 0.05 m thick (x); white paper, its flap's edge a grey line on one face, a wad of green bills sticking out
//             0.05 m at its +z end (the bills are what reads as money from the street). The origin is the envelope's centre. The
//             briber's fist holds its closed (−z) end (ERRANDS.envelope.gripA) and the cop's fist takes its bills end (gripB): the
//             grips are 0.26 m apart, so the paper shows between the two fists (each 0.16 m wide).
//   bundle    everything an evicted agent owns, tied up in a bedsheet: a big, soft, boxy bundle (0.60 wide, 0.50 tall, 0.58 deep), the
//             sheet a loud red-and-cream check, the corners tied in a knot on top; a white pillow wedged in the top-front, a table lamp
//             leaning out of it (the pole and a yellow shade) and a frying pan's handle sticking out of the −x side. Carried hugged at
//             the chest in both arms: the origin is the midpoint between the two hands' grip points, which sit at ±ERRANDS.bundle.grip[0]
//             on its flat sides (x across, y up, z forward: the bundle's bulk is ahead of the grips, so its back stays clear of a
//             puffer's front and its top, near the chin, under it).
// Grain 0.025 m (half the character's 0.05, as the tools, the gun and the phone).
export const GRAIN = .025;
const G = GRAIN;
// the points the clips and the city use (metres, in each prop's frame)
export const ERRANDS = {
  envelope: { gripA: [0, 0, -.13], gripB: [0, 0, .13], bills: [0, 0, .225], len: .45, w: .15, d: .05 },
  bundle: { grip: [.34, 0, 0], centre: [0, -.02, .235], r: [.3, .25, .29], knot: [0, .28, .265], lamp: [.24, .5, .465] },
};
// colours (STYLE.md §2: flat, bold, never pastel)
export const SCHEMES = {
  envelope: { paper: 0xf7f4ec, flap: 0xb9b6ad, bills: 0x34a853, billsD: 0x1e7a37 },
  bundle: { a: 0xd8322a, b: 0xf6ead2, knot: 0xb01f1a, pole: 0x6d6a66, shade: 0xffcf3a, shadeD: 0xe0a422, pillow: 0xfbfaf5, pan: 0x2b2b30 },
};
// the bundle's colourways (the city may pick one per agent; pass the key or { a: 0x…, b: 0x… }): the check's two colours
export const BUNDLE_SCHEMES = { red: {}, blue: { a: 0x2457c5, b: 0xf6ead2, knot: 0x163a8a }, green: { a: 0x2f8f4e, b: 0xf6ead2, knot: 0x1d6634 }, purple: { a: 0x7b3fc4, b: 0xf6ead2, knot: 0x55278f } };
const schemeOf = (id, s) => ({ ...SCHEMES[id], ...(typeof s === 'string' ? (id === 'bundle' ? BUNDLE_SCHEMES[s] : null) : s || {}) });

// the cells: [x, y, z, colour, layer] (layer: 0 matte · 1 gloss · 2 metal, as the icon baker reads them); a cell (x, y, z) spans
// [x, x + 1] × G etc., so a 2-wide part at x −1..0 is centred on the axis
const MODELS = {
  envelope(K) { const out = [], add = (x, y, z, c, l = 0) => out.push([x, y, z, c, l]);
    // the paper: x −1..0 (0.05 thick), y −3..2 (0.15 wide), z −8..7 (0.40 long); the flap's edge on both faces, a V from the −z corners
    // to the middle (painted: the faces' cells along the V are the flap colour)
    for (let x = -1; x <= 0; x++) for (let y = -3; y <= 2; y++) for (let z = -8; z <= 7; z++) {
      const v = (Math.abs((y + .5) - (-2.5 + (z + 8) * .4)) < .6 || Math.abs((y + .5) - (2.5 - (z + 8) * .4)) < .6) && z <= -2;
      add(x, y, z, v ? K.flap : K.paper, 0); }
    // the bills: a wad sticking out of the +z end (z 8..9), inset a cell from each side
    for (let x = -1; x <= 0; x++) for (let y = -2; y <= 1; y++) for (let z = 8; z <= 9; z++) add(x, y, z, (y + z) % 2 ? K.bills : K.billsD, 0);
    return out; },
  bundle(K) { const out = [], seen = new Set(), add = (x, y, z, c, l = 0) => { const k = `${x},${y},${z}`; if (seen.has(k)) return; seen.add(k); out.push([x, y, z, c, l]); };
    const B = ERRANDS.bundle, C = B.centre.map(v => v / G), R = B.r.map(v => v / G);
    // the check: 3-cell squares of the two colours
    const chk = (x, y, z) => { const a = Math.floor((x + 300) / 3) % 2, b = Math.floor((y + 300) / 3) % 2, c = Math.floor((z + 300) / 3) % 2; return (a + b + c) % 2 ? K.a : K.b; };
    // the bulk: a soft, boxy pillow of a bundle (a superellipsoid, exponent 4: flat sides for the hands, rounded corners), lumpy (the
    // things inside), sagging at the bottom; its sides at the grips are where the mittens' inner faces are
    const lump = (x, y, z) => 1 + .07 * Math.sin(x * .55 + 1.3) * Math.sin(z * .5 + .4) + .05 * Math.sin(y * .7 + x * .3) + .04 * Math.sin(z * .9 - y * .4);
    for (let x = -14; x <= 13; x++) for (let y = -12; y <= 12; y++) for (let z = -5; z <= 22; z++) {
      const dx = Math.abs((x + .5 - C[0]) / R[0]), dy = (y + .5 - C[1]) / R[1], dz = Math.abs((z + .5 - C[2]) / R[2]), sag = dy < 0 ? 1 + .08 * -dy : 1;
      if ((dx / sag) ** 4 + Math.abs(dy) ** 4 + (dz / sag) ** 4 <= lump(x, y, z)) add(x, y, z, chk(x, y, z), 0); }
    // the knot: the sheet's corners gathered up on the top and tied, two ears flopping out
    const K0 = B.knot.map(v => v / G);
    for (let x = -4; x <= 3; x++) for (let y = 4; y <= 14; y++) for (let z = 4; z <= 14; z++) {
      const r = Math.hypot(x + .5 - K0[0], z + .5 - K0[2]), top = y + .5 - (K0[1] - 3);
      if (top < 0 || top > 4) continue; if (r <= 2.6 - .25 * top) add(x, y, z, top > 2.5 ? K.knot : chk(x, y, z), 0); }
    for (const s of [-1, 1]) for (let x = -7; x <= 6; x++) for (let y = 6; y <= 16; y++) for (let z = 4; z <= 14; z++) {
      const ex = (x + .5 - (K0[0] + s * 3.2)) / 2.6, ey = (y + .5 - (K0[1] + 1.4)) / 1.5, ez = (z + .5 - K0[2]) / 1.7, tilt = ey - .35 * s * ex;
      if (ex * ex + tilt * tilt + ez * ez <= 1) add(x, y, z, chk(x, y, z), 0); }
    // a pillow wedged in the top-front, a corner up (white, a soft slab)
    for (let x = -10; x <= -1; x++) for (let y = 5; y <= 13; y++) for (let z = 13; z <= 16; z++) {
      const u = x + 5.5, v = y - 9 - .45 * (x + 5.5); if (Math.abs(u) > 4.8 || Math.abs(v) > 3.6) continue; if (Math.abs(u) > 3.9 && Math.abs(v) > 2.7) continue;
      add(x, y, z, K.pillow, 0); }
    // the lamp: a pole leaning out of the top-front, a yellow shade (a truncated cone) on it
    const L = B.lamp.map(v => v / G), L0 = [4, 6, 13];
    for (let k = 0; k <= 12; k++) { const q = L0.map((v, i) => Math.round(v + (L[i] - v) * k / 12)); add(q[0], q[1] - 3, q[2], K.pole, 2); }
    for (let y = Math.round(L[1]) - 3; y <= Math.round(L[1]) + 1; y++) { const r = 3.6 - .5 * (y - (Math.round(L[1]) - 3));
      for (let x = -4; x <= 14; x++) for (let z = 6; z <= 24; z++) { const d = Math.hypot(x + .5 - L[0], z + .5 - L[2]); if (d <= r) add(x, y, z, d > r - 1 ? K.shadeD : K.shade, 0); } }
    // a frying pan's handle sticking out of the −x side
    for (let k = 0; k <= 8; k++) add(-11 - k, 3 + Math.round(k * .3), 12 + Math.round(k * .25), K.pan, 2);
    return out; },
};
export const ERRANDS_IDS = Object.keys(MODELS);
export function errandsCells(id, scheme = null) { return MODELS[id](schemeOf(id, scheme)); }

// the mesh: one quad per open cell face, the city's corner AO (as heist-props.js heistGeometry), vertex colours, metres in the prop's
// frame. THREE is passed in (no import here). Memoised per id and colourway.
const DIRS = [
  { n: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]] }, { n: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },
  { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] }, { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] }, { n: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]] },
];
const AOV = [.55, .72, .87, 1], GEO = new Map();
export function errandsGeometry(THREE, id, scheme = null) {
  const key = id + JSON.stringify(schemeOf(id, scheme)); if (GEO.has(key)) return GEO.get(key);
  const cells = errandsCells(id, scheme), M = new Map(), k = (x, y, z) => `${x},${y},${z}`;
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

// THE POSE (an errands clip's prop, errands.js; the gun's and the phone's contract): { p: [x, y, z], R: [9 numbers, column-major: the
// prop's x, y, z axes], show } in the walker's body frame: the prop's origin goes to p, its axes to R's columns. show < 0.5 hides it
// (collapsed onto its origin, as gun-prop.js).
// errandsMatrix(THREE, pose, out) → the prop's local → walker matrix: T(p) · R. The city's instance matrix = the walker's world matrix
// (ground point, yaw) × this. errandsPoint(pose, q) → a point of the prop's frame (ERRANDS.envelope.gripB …) in the body frame;
// errandsDir(pose, d) a direction.
export function errandsMatrix(THREE, pose, out = new THREE.Matrix4()) {
  const R = pose.R, p = pose.p;
  out.set(R[0], R[3], R[6], p[0], R[1], R[4], R[7], p[1], R[2], R[5], R[8], p[2], 0, 0, 0, 1);
  if (pose.show !== undefined && pose.show < .5) out.multiply(new THREE.Matrix4().makeScale(1e-4, 1e-4, 1e-4));
  return out;
}
export const errandsDir = (pose, d) => { const R = pose.R; return [R[0] * d[0] + R[3] * d[1] + R[6] * d[2], R[1] * d[0] + R[4] * d[1] + R[7] * d[2], R[2] * d[0] + R[5] * d[1] + R[8] * d[2]]; };
export const errandsPoint = (pose, q) => { const r = errandsDir(pose, q); return [pose.p[0] + r[0], pose.p[1] + r[1], pose.p[2] + r[2]]; };
