// GRAB PROPS · the shipment crate (MOVEMENT.md §2: one model everywhere: on the dock's ground, in the hands, the icon) and how the grab
// clips pose it (grab.js). No imports and no three at the top level (worker-safe, like work-tools.js and heist-props.js: the icon baker
// can read crateCells(scheme) straight into its Vx grid: `for (const c of crateCells('cash')) v.set(...c)`).
//
// THE MODEL (cells of GRAIN m; x along the crate's length, y up, z across). The origin is the middle of its BOTTOM, so a crate standing
// on the ground at (x, z) is just T(x, ground, z) · Ry(yaw). 0.55 × 0.40 × 0.25 m: as wide as the toon's chest and a bit, about twice a
// real crate, as the toon fist is twice a real hand. The size is set by the toon arm, which reaches only 0.40–0.45 m from the shoulder:
// carried at the chest, the fists on its two ends, its back face is 0.29 m out from the chest (a puffer's front is at 0.30) and its top
// 0.15 m under the chin (clear of the head's nod when a runner stops).
//   · a frame of dark battens: the four corner posts and a rim round the top and the bottom
//   · painted planks between them, a groove every fourth row (the crate's colourway: the shipment's contents, SCHEMES)
//   · a rope handle on each end, 0.10 m below the top: a bar 0.05–0.075 m out from the end, the fist closes round it (CRATE.grip)
//   · the contents' stencil (a 5 × 7 glyph) on both long faces
// Grain 0.025 m (half the character's 0.05, as the other props).
export const GRAIN = .025;
const G = GRAIN;
// the numbers the clips and the city use (metres, the crate's frame)
//   size     [length x, height y, depth z]
//   pivot    THE POSE'S POINT: the middle of the line between the two handles. A pose's (x, y, z) is where it goes, and the crate turns
//            about it, so a pitch (about x) never moves the hands
//   grip     the two handles' grip points (the fist's centre: walk2.js's rest mitten centre is 0.075 out from the hand's inner face)
//   rest     the pivot's height when the crate stands on the ground
export const CRATE = { size: [.55, .4, .25], pivot: [0, .3, 0], grip: [[-.35, .3, 0], [.35, .3, 0]], rest: .3 };
// the colourways: the shipment's contents (GAME.md §9: cash, guns, chems, parts or doses; posted that morning). paint: the planks,
// shade: the grooves, trim: the battens, mark: the stencil, rope: the handles. Loud and dark-framed, never the tan of the hands
export const SCHEMES = {
  cash: { paint: 0x2e9e57, shade: 0x1f7a40, trim: 0x2b2420, mark: 0xfff1a8, rope: 0xd8b06a, glyph: 'cash' },
  guns: { paint: 0x66773a, shade: 0x505d2c, trim: 0x23271b, mark: 0xf3f0e0, rope: 0xd8b06a, glyph: 'guns' },
  chems: { paint: 0xf2c230, shade: 0xd09d18, trim: 0x26262c, mark: 0x17171b, rope: 0xd8b06a, glyph: 'chems' },
  parts: { paint: 0x2f6fd6, shade: 0x2456a8, trim: 0x22252e, mark: 0xfff3c4, rope: 0xd8b06a, glyph: 'parts' },
  doses: { paint: 0xff5fa8, shade: 0xd8448a, trim: 0x34202c, mark: 0xffffff, rope: 0xd8b06a, glyph: 'doses' },
};
export const SCHEME = 'cash';
// the stencils: 5 wide × 7 tall, row 0 at the top ($ · a crosshair · ! · a hex nut · a split capsule)
const GLYPHS = {
  cash: ['..#..', '.####', '#.#..', '.###.', '..#.#', '####.', '..#..'],
  guns: ['.###.', '#.#.#', '#.#.#', '#####', '#.#.#', '#.#.#', '.###.'],
  chems: ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'],
  parts: ['.###.', '#####', '##.##', '#...#', '##.##', '#####', '.###.'],
  doses: ['.###.', '#####', '#####', '.....', '#####', '#####', '.###.'],
};
const schemeOf = s => ({ ...SCHEMES[SCHEME], ...(typeof s === 'string' ? SCHEMES[s] : s || {}) });

// the cells: [x, y, z, colour, layer] (layer: 0 matte · 1 gloss · 2 metal, as the icon baker reads them); a cell (x, y, z) spans
// [x, x + 1] × G etc. The crate is solid (no faces inside it); x −11 … 10, y 0 … 15, z −5 … 4
export function crateCells(scheme = null) {
  const K = schemeOf(scheme), out = [], at = new Map(), X0 = -11, X1 = 10, Y1 = 15, Z0 = -5, Z1 = 4;
  const add = (x, y, z, c, l = 0) => { const k = `${x},${y},${z}`; if (at.has(k)) { out[at.get(k)][3] = c; return; } at.set(k, out.length); out.push([x, y, z, c, l]); };
  for (let x = X0; x <= X1; x++) for (let y = 0; y <= Y1; y++) for (let z = Z0; z <= Z1; z++) {
    const ex = x <= X0 + 1 || x >= X1 - 1, ez = z <= Z0 + 1 || z >= Z1 - 1, ey = y <= 1 || y >= Y1 - 1;
    // the battens: the corner posts (an x edge and a z edge), the rims (top and bottom rows on any face's border); the planks between,
    // a groove between the planks on the sides (rows 5 and 10) and across the lid (z −1)
    const post = ex && ez, rim = ey && (ex || ez), lid = y === Y1 && !ex && !ez;
    const groove = !ey && (y === 5 || y === 10), lidGroove = lid && z === -1;
    add(x, y, z, post || rim || y === 0 ? K.trim : groove || lidGroove ? K.shade : K.paint, 0); }
  // the rope handles: two legs out of the end face (z −3 and 2) and the bar between them 2 cells out (rows 11 and 12: the grip at y 0.30)
  for (const s of [-1, 1]) { const leg = s > 0 ? X1 + 1 : X0 - 1, bar = s > 0 ? X1 + 2 : X0 - 2;
    for (const y of [11, 12]) { for (const z of [-3, 2]) add(leg, y, z, K.rope, 0); for (let z = -3; z <= 2; z++) add(bar, y, z, K.rope, 0); } }
  // the stencil on both long faces, centred (x −3 … 1, rows 4 … 10), read the right way round from outside
  const glyph = GLYPHS[K.glyph] || GLYPHS.cash;
  // (the front, +z, is read from +z: its left is −x; the back, −z, is read from −z: its left is +x)
  for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) { if (glyph[r][c] !== '#') continue; const y = 10 - r;
    add(-3 + c, y, Z1, K.mark, 0); add(1 - c, y, Z0, K.mark, 0); }
  return out;
}

// the mesh: one quad per open cell face, the city's corner AO (as work-tools.js toolGeometry), vertex colours, metres in the crate's
// frame. THREE is passed in (no import here). Memoised per colourway.
const DIRS = [
  { n: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]] }, { n: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },
  { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] }, { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] }, { n: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]] },
];
const AOV = [.55, .72, .87, 1], GEO = new Map();
export function crateGeometry(THREE, scheme = null) {
  const key = JSON.stringify(schemeOf(scheme)); if (GEO.has(key)) return GEO.get(key);
  const cells = crateCells(scheme), M = new Map(), k = (x, y, z) => `${x},${y},${z}`;
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

// THE POSE (a grab clip's crate track, grab.js): { x, y, z, yaw, pitch, roll, show } — the crate's PIVOT (CRATE.pivot: between the two
// handles) goes to (x, y, z) (the walker's body frame, or the chest's rest frame for crate_run), turned by roll (about z; + tips its +y
// toward −x), then pitch (about x; + tips its +z down), then yaw (about y; + turns its +z toward +x): R = Ry(yaw) · Rx(pitch) · Rz(roll),
// the GLSL aRY · aRX · aRZ (walk2.js). show < 0.5 hides it (collapsed onto its pivot).
// crateMatrix(THREE, pose, out) → the crate's local → (walker or chest) matrix: T(x, y, z) · Ry(yaw) · Rx(pitch) · Rz(roll) · T(−pivot).
// cratePoint(pose, q) → a point of the crate's frame (CRATE.grip[1] …) where the pose puts it; crateDir(pose, d) a direction.
// groundPose(x, z, yaw) → the pose of a crate standing on the ground with its middle at (x, z), its length turned by yaw from +x.
const rot = (p, v) => { const cy = Math.cos(p.yaw || 0), sy = Math.sin(p.yaw || 0), cx = Math.cos(p.pitch || 0), sx = Math.sin(p.pitch || 0), cz = Math.cos(p.roll || 0), sz = Math.sin(p.roll || 0);
  let [x, y, z] = v; [x, y] = [cz * x - sz * y, sz * x + cz * y]; [y, z] = [cx * y - sx * z, sx * y + cx * z]; [x, z] = [cy * x + sy * z, -sy * x + cy * z]; return [x, y, z]; };
export const crateDir = (pose, d) => rot(pose, d);
export const cratePoint = (pose, q) => { const r = rot(pose, q.map((v, i) => v - CRATE.pivot[i])); return [pose.x + r[0], pose.y + r[1], pose.z + r[2]]; };
export const groundPose = (x = 0, z = 0, yaw = 0) => ({ x, y: CRATE.rest, z, yaw, pitch: 0, roll: 0, show: 1 });
export function crateMatrix(THREE, p, out = new THREE.Matrix4()) {
  const A = new THREE.Matrix4(), [px, py, pz] = CRATE.pivot;
  out.makeTranslation(p.x, p.y, p.z).multiply(A.makeRotationY(p.yaw || 0)).multiply(A.makeRotationX(p.pitch || 0)).multiply(A.makeRotationZ(p.roll || 0));
  // (hidden: collapsed onto its pivot)
  if (p.show !== undefined && p.show < .5) out.multiply(A.makeScale(1e-4, 1e-4, 1e-4));
  return out.multiply(A.makeTranslation(-px, -py, -pz));
}
