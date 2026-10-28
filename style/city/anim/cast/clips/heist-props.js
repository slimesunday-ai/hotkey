// HEIST PROPS · the one voxel model of each heist prop (MOVEMENT.md §2: one model everywhere: held, dropped, the icon) and how the heist
// clips pose them (heist.js). No imports and no three at the top level (worker-safe, like work-tools.js: the icon baker can read
// heistCells(id) straight into its Vx grid: `for (const c of heistCells('sack')) v.set(...c)`).
//
// THE MODELS (cells of GRAIN m; x across, y up, z forward). Each origin is the GRIP POINT of the hand that holds it (the mitten's centre,
// walk2.js rest (±0.325, 0.39, 0)), so a prop placed at a clip's hand target sits in the fist:
//   drill   a big cordless drill, about twice a real one (as the toon fist is twice a real hand): the pistol grip through the +x fist
//           (the origin), the battery under it, the motor body above it (0.2 × 0.2 × 0.4 m, teal: a yellow or orange one read as the
//           tan skin of the hands holding it; black vents), the gear housing, the chuck and a 0.25 m steel bit along +z (the tip at
//           HEIST.drill.tip, 0.65 m ahead of the grip), and a side handle sticking out to −x for the other fist (HEIST.drill.side). The
//           toon arm reaches only 0.40–0.45 m from the shoulder, so the side handle sits just 5 cm ahead of the grip: both fists then
//           fit the reach shell with the drill level at the belly
//   sack    the loot: a stuffed canvas sack, authored IN ITS CARRIED POSE (the chest's frame of loot_carry: x out to the +x side, y up,
//           z forward). The gathered neck's tip is in the +x fist (the origin, beside the head's lower corner); the neck runs straight
//           back, outside the head's back corner, to a rope tie (HEIST.sack.mouth). Under the tie the body hangs down
//           behind the +x shoulder toward HEIST.sack.axis (its bottom): pear-shaped (0.6 wide, 0.66 tall), round under a gathered top
//           and fullest low, flattened where it hangs against the back, lumpy with the loot inside. Five creases run down from the tie,
//           and the bottom is shaded. It stays clear of the head's back face (z −0.35 above y 0.95) and of a puffer's back (z −0.25),
//           and shows 0.25 m past the head's +x side from the front. A big green $ (0.25 × 0.35 m) sits on its outer side and on its
//           back. (The refine pass, 2026-10-16: it was an egg 0.68 × 0.72 × 0.56 m sticking straight back behind the head, speckled.)
// Grain 0.025 m (half the character's 0.05, as the tools, the gun and the phone): the bit, the handles and the $ need the finer step.
export const GRAIN = .025;
const G = GRAIN;
// the points the clips and the city use (metres, in each prop's frame)
export const HEIST = {
  drill: { grip: [0, 0, 0], side: [-.1875, .175, .05], tip: [0, .175, .65], axis: [0, .175, 0], dir: [0, 0, 1], len: .775 },
  // (the sack: the neck's tip in the fist, the neck's bend, the tie's centre (the mouth), the bottom of the body (axis), the body's widest
  // half-width and half-depth)
  sack: { neck: [0, 0, 0], bend: [.01, .03, -.15], mouth: [-.03, .05, -.28], axis: [-.2, -.58, -.38], r: [.3, .23] },
};
// colours (STYLE.md §2: flat, bold, never pastel)
export const SCHEMES = {
  drill: { body: 0x17b3c9, dark: 0x26262c, grip: 0x3a3e47, metal: 0x5d636c, steel: 0xd5dbe2, tip: 0xffffff },
  sack: { canvas: 0xf1e2bf, shade: 0xd8c08f, rope: 0x8a5a2b, ink: 0x1f8a3c },
};
// the sack's colourways (the city may vary them per crew; pass the key or { canvas: 0x… })
export const SACK_SCHEMES = { canvas: {}, green: { canvas: 0x3f9b4f, shade: 0x2f7a3d, ink: 0xfff3c4 }, grey: { canvas: 0xb9bcc4, shade: 0x8f939c, ink: 0x1f8a3c } };
const schemeOf = (id, s) => ({ ...SCHEMES[id], ...(typeof s === 'string' ? (id === 'sack' ? SACK_SCHEMES[s] : null) : s || {}) });

// the cells: [x, y, z, colour, layer] (layer: 0 matte · 1 gloss · 2 metal, as the icon baker reads them); a cell (x, y, z) spans
// [x, x + 1] × G etc., so a 2-wide part at x −1..0 is centred on the axis
const MODELS = {
  drill(K) { const out = [], seen = new Set(), add = (x, y, z, c, l = 0) => { const k = `${x},${y},${z}`; if (seen.has(k)) return; seen.add(k); out.push([x, y, z, c, l]); };
    // the trigger, in front of the grip's top
    for (let x = -1; x <= 0; x++) for (let y = 1; y <= 2; y++) add(x, y, 1, K.dark, 1);
    // the pistol grip (through the fist)
    for (let y = -4; y <= 2; y++) for (let x = -1; x <= 0; x++) for (let z = -2; z <= 0; z++) add(x, y, z, K.grip, 1);
    // the battery
    for (let y = -8; y <= -5; y++) for (let x = -4; x <= 3; x++) for (let z = -5; z <= 2; z++) add(x, y, z, y === -5 ? K.body : K.dark, 1);
    // the motor body: the body colour, a black rear cap, black vents along the sides at the back
    for (let y = 3; y <= 10; y++) for (let x = -4; x <= 3; x++) for (let z = -5; z <= 10; z++) { const side = x === -4 || x === 3, vent = side && z >= -4 && z <= -1 && (y === 5 || y === 7 || y === 9);
      add(x, y, z, z === -5 || vent ? K.dark : K.body, 1); }
    // the gear housing
    for (let y = 4; y <= 9; y++) for (let x = -3; x <= 2; x++) for (let z = 11; z <= 12; z++) add(x, y, z, K.metal, 2);
    // the chuck
    for (let y = 5; y <= 8; y++) for (let x = -2; x <= 1; x++) for (let z = 13; z <= 15; z++) add(x, y, z, K.dark, 2);
    // the bit (tip at z 0.65)
    for (let y = 6; y <= 7; y++) for (let x = -1; x <= 0; x++) for (let z = 16; z <= 25; z++) add(x, y, z, z === 25 ? K.tip : K.steel, 2);
    // the side handle (to −x) and its knob
    for (let x = -11; x <= -5; x++) for (let y = 6; y <= 7; y++) for (let z = 1; z <= 2; z++) add(x, y, z, K.dark, 1);
    for (let y = 5; y <= 8; y++) for (let z = 0; z <= 3; z++) add(-12, y, z, K.dark, 1);
    return out; },
  sack(K) { const out = [], seen = new Set(), add = (x, y, z, c, l = 0) => { const k = `${x},${y},${z}`; if (seen.has(k)) return; seen.add(k); out.push([x, y, z, c, l]); };
    const S = HEIST.sack, M = S.mouth, A = S.axis.map((v, i) => v - M[i]), L2 = A.reduce((a, v) => a + v * v, 0), L = Math.sqrt(L2), a = A.map(v => v / L);
    // the cross-section's axes: e1 the bag's width (the body's +x, square to the axis), e2 = a × e1 (its depth, front to back)
    const dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2], e1 = (() => { const d = dot([1, 0, 0], a), v = [1 - d * a[0], -d * a[1], -d * a[2]], n = Math.hypot(...v); return v.map(c => c / n); })();
    const e2 = [a[1] * e1[2] - a[2] * e1[1], a[2] * e1[0] - a[0] * e1[2], a[0] * e1[1] - a[1] * e1[0]];
    // THE BODY: round under a gathered top, fullest low (s 0 the tie … 1 the bottom), flattened front to back where it hangs against the
    // back, and lumpy: the loot inside presses out in a few places (bumps: [direction in (e1, e2, a), size])
    const prof = s => s < 0 ? 0 : s < .12 ? .2 + 2.6 * s * (1 - 2.2 * s) : s < .55 ? .45 + .55 * Math.sin(Math.PI / 2 * (s - .12) / .43) : Math.sqrt(Math.max(0, 1 - ((s - .55) / .45) ** 2));
    const BUMPS = [[[.8, -.5, .3], .1], [[-.3, -.9, .55], .08], [[.9, .3, -.3], .07], [[-.85, .2, .5], .06]].map(([d, k]) => { const n = Math.hypot(...d); return [d.map(c => c / n), k]; });
    const inBody = p => { const q = p.map((v, i) => v - M[i]), s = dot(q, a) / L; if (s < 0 || s > 1) return null;
      const u = dot(q, e1), w = dot(q, e2), r0 = prof(s); if (r0 <= 0) return null;
      const n = Math.hypot(u, w, (s - .5) * L) || 1, dir = [u / n, w / n, (s - .5) * L / n];
      let lump = 0; for (const [d, k] of BUMPS) lump += k * Math.exp(-((dir[0] - d[0]) ** 2 + (dir[1] - d[1]) ** 2 + (dir[2] - d[2]) ** 2) / .35);
      // (the side that hangs against the walker's back, +e2, is flatter)
      const rx = S.r[0] * r0 * (1 + lump), rz = S.r[1] * r0 * (1 + lump) * (w > 0 ? .78 : 1);
      return (u / rx) ** 2 + (w / rz) ** 2 <= 1 ? { s, ang: Math.atan2(w, u), u, w } : null; };
    // THE NECK: the gathered canvas from the tie up to the fist (the origin), a tube along a curve that runs straight back first (clear
    // of the head's back corner) and then in to the tie; a rope tie round it just above the mouth
    const N0 = [0, 0, 0], N1 = S.bend, N2 = M, curve = t => [0, 1, 2].map(i => (1 - t) ** 2 * N0[i] + 2 * (1 - t) * t * N1[i] + t * t * N2[i]);
    const NP = Array.from({ length: 41 }, (_, k) => [k / 40, curve(k / 40)]);
    const onNeck = p => { let best = null; for (const [t, c] of NP) { const d = Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]); if (!best || d < best.d) best = { d, t }; }
      // (thin and twisted out of the fist, bunched just above the tie, the tie a fat rope band, the mouth spreading under it)
      const r = .036 + .02 * best.t + (best.t > .5 && best.t < .68 ? .012 * Math.sin(Math.PI * (best.t - .5) / .18) : 0) + .03 * Math.max(0, best.t - .84) / .16;
      const tie = best.t > .68 && best.t < .84; return best.d <= r + (tie ? .016 : 0) ? { t: best.t, tie } : null; };
    for (let x = -26; x <= 6; x++) for (let y = -30; y <= 6; y++) for (let z = -32; z <= 4; z++) {
      const p = [(x + .5) * G, (y + .5) * G, (z + .5) * G], b = inBody(p), nk = b ? null : onNeck(p); if (!b && !nk) continue;
      let c = K.canvas;
      // the neck: the rope tie, and its folds twisting along it (a helix of shade, not a speckle)
      if (nk) c = nk.tie ? K.rope : ((Math.atan2(p[1], p[0]) * 3 / Math.PI + nk.t * 6) % 2 + 2) % 2 < .7 ? K.shade : K.canvas;
      // the body: creases running down from the gathered top (five, gone by a quarter of the way down), and the shaded, sagging bottom
      else { const fold = Math.abs(((b.ang / (2 * Math.PI) * 5) % 1 + 1) % 1 - .5) > .42 && b.s < .24 + .08 * Math.sin(b.ang * 3);
        if (b.s > .84 || fold) c = K.shade; }
      add(x, y, z, c, 0); }
    // the $: on the outer side (the body's +x face, read from outside: its left toward +z) and on its back (the −z face, read from
    // behind: its left toward +x), each glyph pixel 2 × 2 cells (0.25 × 0.35 m); painted onto the outermost cell of each row
    const glyph = ['..#..', '.####', '#.#..', '.###.', '..#.#', '####.', '..#..'];
    const byKey = new Map(out.map((c, i) => [`${c[0]},${c[1]},${c[2]}`, i]));
    // u: the cell across the face (z for the +x face, x for the back), y: the row
    const paint = (u, y, face) => {
      const cells = out.filter(c => c[1] === y && (face === 'x' ? c[2] === u : c[0] === u)); if (!cells.length) return;
      const best = face === 'x' ? cells.reduce((a, c) => c[0] > a[0] ? c : a) : cells.reduce((a, c) => c[2] < a[2] ? c : a);
      out[byKey.get(`${best[0]},${best[1]},${best[2]}`)][3] = K.ink; };
    // (centred on the body's fullest ring)
    const F = M.map((v, i) => (v + .62 * A[i]) / G), cy = Math.round(F[1]) + 7, cu = { x: Math.round(F[2]) + 5, z: Math.round(F[0]) - 5 };
    for (const face of ['x', 'z']) for (let r = 0; r < glyph.length; r++) for (let c = 0; c < 5; c++) { if (glyph[r][c] !== '#') continue;
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) paint(face === 'x' ? cu.x - 2 * c - i : cu.z + 2 * c + i, cy - 2 * r - j, face); }
    return out; },
};
export const HEIST_IDS = Object.keys(MODELS);
export function heistCells(id, scheme = null) { return MODELS[id](schemeOf(id, scheme)); }

// the mesh: one quad per open cell face, the city's corner AO (as work-tools.js toolGeometry), vertex colours, metres in the prop's
// frame. THREE is passed in (no import here). Memoised per id and colourway.
const DIRS = [
  { n: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]] }, { n: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },
  { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] }, { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] }, { n: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]] },
];
const AOV = [.55, .72, .87, 1], GEO = new Map();
export function heistGeometry(THREE, id, scheme = null) {
  const key = id + JSON.stringify(schemeOf(id, scheme)); if (GEO.has(key)) return GEO.get(key);
  const cells = heistCells(id, scheme), M = new Map(), k = (x, y, z) => `${x},${y},${z}`;
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

// THE POSE (a heist clip's prop track, heist.js): { x, y, z, yaw, pitch, roll, show } — the prop's grip point goes to (x, y, z) (the
// walker's body frame, or the chest's rest frame for a chest-frame prop), turned by roll (about z; + tips its +y toward −x), then pitch
// (about x; + tips its +z down), then yaw (about y; + turns its +z toward +x): R = Ry(yaw) · Rx(pitch) · Rz(roll), the GLSL aRY · aRX ·
// aRZ (walk2.js). show < 0.5 hides it (collapsed onto its grip point, as work-tools.js).
// heistMatrix(THREE, pose, out) → the prop's local → (walker or chest) matrix: T(x, y, z) · Ry(yaw) · Rx(pitch) · Rz(roll).
// heistPoint(pose, q) → a point of the prop's frame (HEIST.drill.tip …) where the pose puts it; heistDir(pose, d) a direction.
const rot = (p, v) => { const cy = Math.cos(p.yaw || 0), sy = Math.sin(p.yaw || 0), cx = Math.cos(p.pitch || 0), sx = Math.sin(p.pitch || 0), cz = Math.cos(p.roll || 0), sz = Math.sin(p.roll || 0);
  let [x, y, z] = v; [x, y] = [cz * x - sz * y, sz * x + cz * y]; [y, z] = [cx * y - sx * z, sx * y + cx * z]; [x, z] = [cy * x + sy * z, -sy * x + cy * z]; return [x, y, z]; };
export const heistDir = (pose, d) => rot(pose, d);
export const heistPoint = (pose, q) => { const r = rot(pose, q); return [pose.x + r[0], pose.y + r[1], pose.z + r[2]]; };
export function heistMatrix(THREE, p, out = new THREE.Matrix4()) {
  const A = new THREE.Matrix4();
  out.makeTranslation(p.x, p.y, p.z).multiply(A.makeRotationY(p.yaw || 0)).multiply(A.makeRotationX(p.pitch || 0)).multiply(A.makeRotationZ(p.roll || 0));
  // (hidden: collapsed onto its grip point)
  if (p.show !== undefined && p.show < .5) out.multiply(A.makeScale(1e-4, 1e-4, 1e-4));
  return out;
}
