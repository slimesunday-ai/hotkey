// CLEANERS PROPS · the one voxel model of each Cleaners prop (MOVEMENT.md §2: one model everywhere), for cleaners.js. No imports and
// no three at the top level (worker-safe, like work-tools.js: the icon baker can read cleanersCells(id) straight into its Vx grid).
//
//   body_bag   a black body bag (cells of 0.05 m: the character's grain), the shape of a body lying on its back: the head end a big
//              lump (the toon's head), the shoulders, the hips, the legs, the feet. A grey zip runs along the near (−z) top edge from
//              the feet to the head, near the top (a J-zip, what the zipping hand follows). Four webbing loops, two at each end, are the handles the
//              carriers hold (BAG.handles). EMPTY is the same model flattened to BAG.flat of its height by the clip's matrix (cleaners.js):
//              one model, two states, so the outline never changes between them
//   mop        a mop (cells of 0.025 m) on the broom's frame (work-tools.js broom: a 0.55 m handle, the head to 0.825 m, the string
//              ends at the tip), so work.js sweep's own track carries it: the handle aluminium with a dark grip at the butt, a grey
//              socket, a head of grey-white strings, their ends darker (wet)
// THE FRAMES (metres):
//   body_bag   origin at the bag's bottom centre; +x along the bag toward the HEAD end, +y up, +z across. Length 1.8 m (x −0.9 … 0.9);
//              the handles' grip points (where the mitten's centre goes) in BAG.handles
//   mop        the handle's butt on its axis, +y up the handle toward the head (work-tools.js's frame for every long tool)
export const GRAIN = { body_bag: .05, mop: .025 };
export const SCHEMES = {
  body_bag: { bag: 0x1c1d21, bagD: 0x141518, zip: 0x55585f, strap: 0x34363c },
  mop: { pole: 0x9aa0a6, grip: 0x3b4a5c, socket: 0x4a4d55, mop: 0xd6d0bf, mopD: 0xb9b29f, wet: 0x8d8676 },
};
// the bag's sections along x (cells of 0.05: x index i covers [i, i + 1] × 0.05): [from, to, half-width (cells), height (cells)]
const SECTIONS = [[-18, -14, 4, 6], [-14, -5, 4.5, 5], [-5, 6, 6, 7], [6, 8, 5, 6], [8, 18, 7, 12]];
export const BAG = {
  len: 1.8, width: .7, height: .6,
  // the handles' grip points (bag frame): two webbing loops at each end, at x ±0.45 across (the loops' outer bars, on a strap across the end: wide, so the carriers' fists stay clear of
  // their own legs: the hand gate). The FEET end's are 0.125 m past
  // the bag's end, the HEAD end's 0.225 m (a longer loop: the head lump is the front carrier's, and the loop keeps it off the backs of their legs)
  handles: { feet: [[-1.025, .225, -.45], [-1.025, .225, .45]], head: [[1.125, .225, -.45], [1.125, .225, .45]] },
  // the J-zip: along the near (−z) top edge, its line at x from −0.85 to 0.85 (y, z as a function of x: zipAt(x))
  flat: .08,
};
const secOf = i => SECTIONS.find(s => i >= s[0] && i < s[1]);
// the zip's line on the near side (bag frame): the cell row at ~70 % of the section's height, its outer face
export const zipAt = x => { const s = secOf(Math.max(-18, Math.min(17, Math.floor(x / .05)))); const h = s[3] * .05, hw = s[2] * .05; return [x, h * .88, -hw * Math.sqrt(1 - .88 * .88)]; };
const MODELS = {
  body_bag(K) { const out = [], add = (x, y, z, c, l = 0) => out.push([x, y, z, c, l]);
    for (let i = -18; i < 18; i++) { const [, , hw, h] = secOf(i);
      for (let y = 0; y < h; y++) for (let z = -Math.ceil(hw); z < Math.ceil(hw); z++) { const zc = z + .5, yc = y + .5;
        if ((zc / hw) ** 2 + (yc / h) ** 2 > 1) continue;   // a half-ellipse cross-section on a flat bottom: a loaf
        // the J-zip on the near side: the outermost cell of the row at ~88 % of the height (near the top), z < 0
        const zipRow = y === Math.round(h * .88 - .5) && z < 0 && !(((zc - 1) / hw) ** 2 + (yc / h) ** 2 <= 1) && i >= -17 && i <= 16;
        add(i, y, z, zipRow ? K.zip : y === 0 ? K.bagD : K.bag, zipRow ? 2 : 1); } }
    // the handles: webbing loops off each end (2 cells wide in z, a loop of cells round the grip point)
    // a loop: two bars from the bag's end out to column xo (y0 and y0 + 2), the outer column joining them (what the fist holds)
    const loop = (xa, xo, y0, z0) => { const d = Math.sign(xo - xa); for (let x = xa; x !== xo + d; x += d) for (let z = z0; z <= z0 + 1; z++) { add(x, y0, z, K.strap); add(x, y0 + 2, z, K.strap); if (x === xo) add(x, y0 + 1, z, K.strap); } };
    for (const z0 of [-10, 8]) { loop(-19, -21, 3, z0); loop(18, 22, 3, z0); }
    // the spreader: a strap across each end at the loops' rows, from loop to loop (the loops sit out wide of the narrow feet end)
    for (const x of [-19, 18]) for (let z = -10; z <= 9; z++) for (const y of [3, 5]) add(x, y, z, K.strap);
    return out; },
  mop(K) { const out = [], add = (x, y, z, c, l = 0) => out.push([x, y, z, c, l]), H = 22;   // the handle to y H (0.55 m), the head 11 cells
    for (let y = 0; y < H; y++) for (const x of [-1, 0]) for (const z of [-1, 0]) add(x, y, z, y < 4 ? K.grip : K.pole, y < 4 ? 0 : 2);
    for (let y = H; y < H + 2; y++) for (let x = -2; x < 2; x++) for (let z = -2; z < 2; z++) add(x, y, z, K.socket, 2);   // the socket
    for (let y = H + 2; y < H + 11; y++) { const f = (y - H - 2) / 8, n = Math.round(2 + 3 * f);
      for (let x = -n; x < n; x++) for (let z = -2; z < 2; z++) { if (y >= H + 7 && (x + z + y) % 4 === 0) continue;   // loose strings
        add(x, y, z, y >= H + 9 ? K.wet : (x + y) % 3 === 0 ? K.mopD : K.mop, 0); } }
    return out; },
};
export const PROP_IDS = Object.keys(MODELS);
export function cleanersCells(id, scheme = null) { const m = MODELS[id]; if (!m) throw new Error('cleaners-props: no model ' + id); return m({ ...SCHEMES[id], ...(scheme || {}) }); }

// the mesh: one quad per open cell face, the city's corner AO (work-tools.js toolGeometry), vertex colours, metres in the prop's frame.
// THREE is passed in. Memoised per id.
const DIRS = [
  { n: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]] }, { n: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },
  { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] }, { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] }, { n: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]] },
];
const AOV = [.55, .72, .87, 1], GEO = new Map();
export function cleanersGeometry(THREE, id) {
  if (GEO.has(id)) return GEO.get(id);
  const G = GRAIN[id], cells = cleanersCells(id), M = new Map(), k = (x, y, z) => `${x},${y},${z}`;
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
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setIndex(I); g.computeBoundingSphere(); GEO.set(id, g); return g;
}
