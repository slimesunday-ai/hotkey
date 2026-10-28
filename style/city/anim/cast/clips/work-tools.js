// WORK TOOLS · the one voxel model of each work prop (MOVEMENT.md §2: one model everywhere: held, dropped, the icon) and how a work
// clip poses it (work.js). No imports and no three at the top level (worker-safe, like skate-board.js: the icon baker can read
// toolCells(id) straight into its Vx grid: `for (const c of toolCells('pickaxe')) v.set(...c)`).
//
// THE FRAME of every tool (cells of GRAIN m; x across, y along, z out; a long tool's origin is its HANDLE'S BUTT END on the handle's
// axis, +y up the handle toward the working end; the box and the item have theirs at the bottom centre / the centre):
//   pickaxe   handle 0.70 m (2 × 2 cells, the grip taped black, no end cap: the lower hand holds the very end, so the handle ends
//             inside the fist), the head on top, painted red with bare steel ends: the pick point to +z (0.30 m, curving down), a
//             flat adze to −z; tip at TOOL.pickaxe.tip
//   shovel    a black T-grip at the butt (no wider than the fist), a short shaft (0.45 m: the toon arm reaches 0.40–0.45 m from the
//             shoulder, so a long shaft puts the grip in the chest), a steel socket, the spade blade 0.25 × 0.25 m in the x–y plane,
//             painted orange with a bare edge (its dished face to +z); 0.75 m in all; the point at TOOL.shovel.tip, the blade's top
//             edge (the step a foot pushes) at TOOL.shovel.step
//   broom     a red-tipped handle 0.55 m, a straw fan 0.30 m long widening to 0.30 m (the bristles in line with the handle, a red
//             binding), 0.825 m in all (the toon arms: a full broom's top end would be in the chin), the bristle ends at TOOL.broom.tip
//   box       a cardboard box 0.40 × 0.30 × 0.25 m (kraft, dark edges, a pale tape band over the top and down the front and back, a red
//             label on each side: the edges and the labels keep it apart from a skin of the same brown)
//   item      a product box 0.15 × 0.20 × 0.10 m (cobalt, a white label band): what stock_shelf puts on the shelf
// Grain 0.025 m (half the character's 0.05, as the skateboard): a 0.05 handle reads as a tool at street distance, and the head and
// the blade need the finer step.
export const GRAIN = .025;
const G = GRAIN;
// sizes and the points the clips use (metres, in the tool's frame)
export const TOOL = {
  pickaxe: { len: .70, tip: [0, .625, .32], eye: [0, .66, 0] },
  shovel: { len: .75, tip: [0, .75, .0125], step: [0, .51, .03], grip: [0, .0125, 0] },
  broom: { len: .825, tip: [0, .825, 0] },
  box: { w: .40, h: .30, d: .25 },
  item: { w: .15, h: .20, d: .10 },
};
export const SCHEMES = {   // colours (STYLE.md §2: flat, bold, never pastel)
  pickaxe: { wood: 0xc98b4b, woodD: 0x9c6532, tape: 0x26262c, head: 0xd8322a, edge: 0xd5dbe2, dark: 0x5d636c },
  shovel: { wood: 0xc98b4b, grip: 0x26262c, blade: 0xff7a1a, edge: 0xd5dbe2, dark: 0x5d636c },
  broom: { wood: 0xc98b4b, paint: 0xe8402a, straw: 0xf2c14e, strawD: 0xd29a2a, band: 0xe8402a },
  box: { kraft: 0xd7a865, kraftD: 0x7a4e24, tape: 0xf3e6bf, label: 0xe8402a, label2: 0xfff7e6 },
  item: { body: 0x2f5bff, label: 0xfff7e6, ink: 0x17171b },
};

// the cells: [x, y, z, colour, layer] (layer: 0 matte · 1 gloss · 2 metal, as the icon baker reads them); a cell (x, y, z) spans
// [x, x + 1] × G etc., so a 2-wide handle at x −1..0 is centred on the axis
const MODELS = {
  pickaxe(K) { const out = [], add = (x, y, z, c, l = 0) => out.push([x, y, z, c, l]);
    for (let y = 0; y < 28; y++) for (const x of [-1, 0]) for (const z of [-1, 0]) add(x, y, z, y < 7 ? K.tape : (x + z + y) % 7 === 0 ? K.woodD : K.wood);   // handle 0.70 m, taped grip
    for (let y = 24; y < 29; y++) for (let x = -2; x <= 1; x++) for (let z = -2; z <= 1; z++) if (Math.abs(x + .5) > 1 || Math.abs(z + .5) > 1 || y >= 28) add(x, y, z, K.head, 2);   // the eye's collar
    // the pick (to +z): 11 cells, tapering from 3 × 3 to a point, its centre line curving down toward the tip
    for (let z = 2; z <= 12; z++) { const f = (z - 2) / 10, yc = Math.round(26.5 - 2.6 * f * f), h = f < .55 ? 1 : 0, w = f < .7 ? 1 : 0;
      for (let y = yc - h; y <= yc + 1; y++) for (let x = -1 - w; x <= w; x++) add(x, y, z, z >= 11 ? K.edge : K.head, 2); }
    // the adze (to −z): a flat blade, 7 cells, widening in x and thinning in y, its edge turned down
    for (let z = -3; z >= -9; z--) { const f = (-3 - z) / 6, yc = Math.round(26.5 - 1.6 * f * f), w = 1 + Math.round(f * 1.4);
      for (let y = yc; y <= yc + (f < .5 ? 1 : 0); y++) for (let x = -1 - w; x <= w; x++) add(x, y, z, z <= -9 ? K.edge : K.head, 2); }
    return out; },
  shovel(K) { const out = [], add = (x, y, z, c, l = 0) => out.push([x, y, z, c, l]), S = 18, B = 20;   // the shaft to y S, the blade from y B
    for (let x = -3; x <= 2; x++) for (const z of [-1, 0]) add(x, 0, z, K.grip, 1);                                  // the T-grip (no wider than the fist)
    for (let y = 1; y < S; y++) for (const x of [-1, 0]) for (const z of [-1, 0]) add(x, y, z, y < 3 ? K.grip : K.wood, y < 3 ? 1 : 0);   // the shaft
    for (let y = S - 1; y < B; y++) for (let x = -2; x <= 1; x++) for (const z of [-1, 0]) add(x, y, z, K.dark, 2);  // the socket
    // the blade: 10 wide (0.25 m), 0.25 m long, one cell thick at z 0 with the side rims turned up to z 1 (the dish), a pointed end
    for (let y = B; y < B + 10; y++) { const n = y < B + 6 ? 5 : 5 - (y - B - 5) * 1.2;
      for (let x = Math.round(-n); x < Math.round(n); x++) { add(x, y, 0, y >= B + 8 ? K.edge : K.blade, 2);
        if (y < B + 7 && (x === Math.round(-n) || x === Math.round(n) - 1)) add(x, y, 1, K.blade, 2); } }
    for (let x = -5; x < 5; x++) add(x, B, 1, K.edge, 2);                                                              // the step: the blade's top edge, rolled
    return out; },
  broom(K) { const out = [], add = (x, y, z, c, l = 0) => out.push([x, y, z, c, l]), H = 22;   // the handle to y H (0.55 m), the head 12 cells
    for (let y = 0; y < H; y++) for (const x of [-1, 0]) for (const z of [-1, 0]) add(x, y, z, y < 3 ? K.paint : K.wood, y < 3 ? 1 : 0);   // handle, a red end
    // the head: the binding (red bands), then the straw fan, widening from 6 to 12 cells, 3 then 2 cells thick
    for (let y = H - 1; y < H + 12; y++) { const f = (y - H + 1) / 12, n = Math.round(3 + 3 * f), z0 = y < H + 5 ? -2 : -1, z1 = 1;
      for (let x = -n; x < n; x++) for (let z = z0; z <= z1; z++) { if (y >= H + 9 && z === z0) continue;
        const band = y === H || y === H + 2, c = band ? K.band : (x + y) % 3 === 0 ? K.strawD : K.straw; add(x, y, z, c, band ? 1 : 0); } }
    return out; },
  box(K) { const out = [], W = 8, H = 12, D = 5;   // half-width 8 (0.40 m), height 12 (0.30 m), half-depth 5 (0.25 m)
    for (let x = -W; x < W; x++) for (let y = 0; y < H; y++) for (let z = -D; z < D; z++) { const ex = x === -W || x === W - 1, ey = y === 0 || y === H - 1, ez = z === -D || z === D - 1;
      if (!ex && !ey && !ez) continue;   // a shell
      const edge = (ex ? 1 : 0) + (ey ? 1 : 0) + (ez ? 1 : 0) >= 2, tape = (x === -1 || x === 0) && (y === H - 1 || ez) && !(ex),
        label = (ex || z === D - 1) && y >= 7 && y <= 10 && (ex ? z >= -2 && z <= 1 : x >= -5 && x <= -2), stripe = label && y === 8;   // a red label on each side, above the hands, and on the front
      out.push([x, y, z, edge ? K.kraftD : tape ? K.tape : stripe ? K.label2 : label ? K.label : K.kraft, 0]); }
    return out; },
  item(K) { const out = [];   // 6 × 8 × 4 cells (0.15 × 0.20 × 0.10 m), centred on its origin
    for (let x = -3; x < 3; x++) for (let y = -4; y < 4; y++) for (let z = -2; z < 2; z++) { const lab = y >= -2 && y <= 0, ink = y === -1 && (x === -2 || x === 0 || x === 1) && (z === 1 || z === -2);
      out.push([x, y, z, ink ? K.ink : lab ? K.label : K.body, 1]); }
    return out; },
};
const OFFSET = {};   // (cells to shift a model by so it sits on its origin)
export const TOOL_IDS = Object.keys(MODELS);
export function toolCells(id, scheme = null) { const K = { ...SCHEMES[id], ...(scheme || {}) }; return MODELS[id](K); }

// the mesh: one quad per open cell face, the city's corner AO (as skate-board.js boardGeometry), vertex colours, metres in the tool's
// frame. THREE is passed in (no import here). Memoised per id.
const DIRS = [
  { n: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]] }, { n: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },
  { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] }, { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] }, { n: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]] },
];
const AOV = [.55, .72, .87, 1], GEO = new Map();
export function toolGeometry(THREE, id) {
  if (GEO.has(id)) return GEO.get(id);
  const cells = toolCells(id), M = new Map(), k = (x, y, z) => `${x},${y},${z}`, [ox, oy, oz] = OFFSET[id] || [0, 0, 0];
  for (const c of cells) M.set(k(c[0], c[1], c[2]), c[3]);
  const has = (x, y, z) => M.has(k(x, y, z)) ? 1 : 0, P = [], N = [], C = [], I = [], col = new THREE.Color(); let v = 0;
  for (const [x, y, z, hex] of cells) for (const d of DIRS) { const [nx, ny, nz] = d.n; if (has(x + nx, y + ny, z + nz)) continue;
    const a4 = d.c.map(c => { const t = [nx ? 0 : (c[0] ? 1 : -1), ny ? 0 : (c[1] ? 1 : -1), nz ? 0 : (c[2] ? 1 : -1)], e = [];
      if (t[0]) e.push([t[0], 0, 0]); if (t[1]) e.push([0, t[1], 0]); if (t[2]) e.push([0, 0, t[2]]);
      const ax = x + nx, ay = y + ny, az = z + nz, s1 = has(ax + e[0][0], ay + e[0][1], az + e[0][2]), s2 = has(ax + e[1][0], ay + e[1][1], az + e[1][2]), cr = has(ax + t[0], ay + t[1], az + t[2]);
      return s1 && s2 ? 0 : 3 - (s1 + s2 + cr); });
    col.setHex(hex);
    d.c.forEach((c, q) => { P.push((x + c[0] + ox) * G, (y + c[1] + oy) * G, (z + c[2] + oz) * G); N.push(nx, ny, nz); const a = AOV[a4[q]]; C.push(col.r * a, col.g * a, col.b * a); });
    if (a4[0] + a4[2] < a4[1] + a4[3]) I.push(v + 1, v + 2, v + 3, v + 1, v + 3, v); else I.push(v, v + 1, v + 2, v, v + 2, v + 3); v += 4; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setIndex(I); g.computeBoundingSphere(); GEO.set(id, g); return g;
}

// THE POSE (a work clip's tool track, work.js): { x, y, z, az, el, sp, piv: [x, y, z], show } — the tool's point `piv` (its own frame)
// goes to (x, y, z), its handle (+y) points along azimuth az (0 = +z, + toward +x) at elevation el (rad above the horizontal), and it
// spins sp about the handle (0: its +z points "down" off the handle, toward the ground for a level handle). show < 0.5 hides it.
// toolMatrix(THREE, pose, out) → the tool's local → (walker or chest) matrix: T(x, y, z) · Ry(az) · Rx(π/2 − el) · Ry(sp) · T(−piv).
export const REST = Object.freeze({ x: 0, y: 0, z: 0, az: 0, el: Math.PI / 2, sp: 0, piv: [0, 0, 0], show: 1 });
export function toolMatrix(THREE, p, out = new THREE.Matrix4()) {
  const A = new THREE.Matrix4(), pv = p.piv || [0, 0, 0];
  out.makeTranslation(p.x, p.y, p.z).multiply(A.makeRotationY(p.az)).multiply(A.makeRotationX(Math.PI / 2 - p.el)).multiply(A.makeRotationY(p.sp))
    .multiply(A.makeTranslation(-pv[0], -pv[1], -pv[2]));
  if (p.show !== undefined && p.show < .5) out.multiply(A.makeScale(1e-4, 1e-4, 1e-4));   // (hidden: collapsed onto its pivot)
  return out;
}
