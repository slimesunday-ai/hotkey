// BENCH PROPS · the one voxel model of each Gunrunner bench tool (MOVEMENT.md §2: one model everywhere: held, lying on the bench, the
// icon) and the bench's layout, which the city's set must match (bench.js poses the clips against it; bench.md says what to place).
// No imports and no three at the top level (worker-safe, like work-tools.js and gun-prop.js: the icon baker can read
// benchCells('hammer') straight into its Vx grid). The finished gun is gun-prop.js's pistol, reused as is.
//
// THE FRAME of each tool (cells of GRAIN m). The origin is the GRIP POINT: the hand's grip point (the mitten's centre, walk2.js rest
// (±0.325, 0.39, 0)) sits there, as for the gun. The toon fist is a mitten about twice a real hand, so the tools are about 1.5–2 × real.
//   hammer   +y along the handle toward the head, +z the striking face's way, x across. Handle 2 × 2 cells, y −0.125 … 0.30 (a black
//            rubber butt pokes out of the fist; the rest is painted red); the head on top of it: steel, 0.10 along the handle (y 0.20 …
//            0.30), 0.10 wide at the face, from the claw (z −0.125, split and curled back) to the bare-steel FACE (z 0.125). The face's
//            centre is HAMMER.face
//   stamp    +y up (the knob), −y the rubber face, x along the base's long side. The knob (in the fist) at the origin, a short neck out of
//            the fist's pinky end, a yellow base 0.20 × 0.075 × 0.15 m with a dark band, the red rubber under it. The face's centre is
//            STAMP.face
// Grain 0.025 m (half the character's 0.05, as the gun, the board and the work tools).
export const GRAIN = .025;
const G = GRAIN;
// the points the clips and the city use (metres, in each tool's frame)
// face: the striking face's centre; up: its outward normal
export const HAMMER = { grip: [0, 0, 0], face: [0, .25, .125], up: [0, 0, 1], len: .425 };
// face: the rubber's centre (what prints); up: its normal
export const STAMP = { grip: [0, 0, 0], face: [0, -.175, 0], up: [0, -1, 0] };
// colours (STYLE.md §2: flat, bold, never pastel)
export const SCHEMES = {
  hammer: { paint: 0xe8402a, paintD: 0xb52a1e, grip: 0x26262c, steel: 0x6b7280, steelD: 0x474c55, face: 0xe6ebf0 },
  stamp: { wood: 0xc98b4b, base: 0xffd23a, rim: 0x26262c, rubber: 0xd8322a },
};

// THE BENCH (the city's set; bench.js's clips are posed against it). Body frame of the walker standing at its spot facing the bench (+z
// ahead, y up from the ground the walker stands on, +x the side of its +x arm, the tool hand: the walker's left, as in every clip).
// Every clip in bench.js plays with the walker on this spot.
//   top      the bench top: y TOP (its upper face), from z FRONT (the front edge) to z BACK, x −HALF … HALF
//   anvil    a steel block on the bench where the hammer lands (bench_hammer): centre (x, z), top y; the sparks fly off its top
//   paper    the warrant on the bench (bench_stamp): centre (x, z), size (x, z), lying on the top; the seal lands where bench_stamp's
//            prop.seal(t) is at its slams
//   pad      the ink pad (bench_stamp): centre (x, z), top y
//   tray     the parts tray (bench_assemble): centre (x, z)
//   stand    the finished gun's stand (bench_test_gun): a block under the gun's butt, centre (x, z), top y; the clip's own prop draws the
//            gun standing in it before the pick-up and after the put-down (prop.bench)
//   lamp     the bench lamp: its foot (x, z) on the top, its shade (x, y, z) over the work; the light pool on the top at (x, z), radius r
export const BENCH = {
  TOP: .435, FRONT: .30, BACK: .82, HALF: .66,
  anvil: { x: .2, z: .67, w: .2, d: .16, top: .5 },
  paper: { x: .04, z: .45, w: .26, d: .3 },
  pad: { x: .5, z: .39, w: .12, d: .09, top: .47 },
  tray: { x: .38, z: .42, w: .16, d: .12 },
  stand: { x: .26, z: .42, w: .1, d: .14, top: .468 },
  lamp: { foot: [-.58, .76], shade: [-.42, .92, .7], pool: [-.05, .55], r: .4 },
};

// the cells: [x, y, z, colour, layer] (layer: 0 matte · 1 gloss · 2 metal, as the icon baker reads them); a cell (x, y, z) spans
// [x, x + 1] × G etc., so a 2-wide part at x −1..0 is centred on the axis
const MODELS = {
  hammer(K) { const out = [], add = (x, y, z, c, l = 0) => out.push([x, y, z, c, l]);
    // the handle: y −5 … 11 (−0.125 … 0.30): a black rubber butt (y −5 … −3, it pokes out of the fist), then painted red (it reads
    // against every skin and every sleeve at street distance), a darker band every few cells
    for (let y = -5; y <= 11; y++) for (const x of [-1, 0]) for (const z of [-1, 0]) add(x, y, z, y <= -3 ? K.grip : y % 4 === 0 ? K.paintD : K.paint, y <= -3 ? 1 : 0);
    // the head: steel, 4 cells along the handle (y 8 … 11: 0.20 … 0.30), 4 wide (x −2 … 1), from the claw (z −5) to the FACE (z 4: its
    // outer face at z 0.125, bare steel); the neck behind the face is 2 wide, the claw thins and splits
    for (let y = 8; y <= 11; y++) for (let z = -5; z <= 4; z++) {
      // (the eye: the handle's own cells pass through it)
      if (z >= -1 && z <= 0) continue;
      const face = z >= 3, claw = z <= -3;
      // (the claw curls up and back, thinner toward its tip)
      if (claw && (y === 8 || (z === -5 && y === 9))) continue;
      // (the neck behind the face is 2 wide; the claw splits at its tip)
      for (let x = -2; x <= 1; x++) { if (!face && (x === -2 || x === 1)) continue; if (claw && z === -5 && (x === -1 || x === 0) && y === 11) continue;
        add(x, y, z, z === 4 ? K.face : claw ? K.steelD : K.steel, 2); }
    }
    // (the wedge's cap on top of the eye)
    for (const x of [-1, 0]) for (const z of [-1, 0]) add(x, 12, z, K.steelD, 2);
    return out; },
  stamp(K) { const out = [], add = (x, y, z, c, l = 0) => out.push([x, y, z, c, l]);
    // the knob (in the fist)
    for (let y = -1; y <= 0; y++) for (const x of [-1, 0]) for (const z of [-1, 0]) add(x, y, z, K.wood);
    // the neck, out of the fist's pinky end
    for (let y = -3; y <= -2; y++) for (const x of [-1, 0]) for (const z of [-1, 0]) add(x, y, z, K.wood);
    // the base: 0.20 × 0.075 × 0.15 m (8 × 3 × 6 cells), painted yellow with a dark band round it (it reads at street distance)
    for (let y = -6; y <= -4; y++) for (let x = -4; x <= 3; x++) for (let z = -3; z <= 2; z++) add(x, y, z, y === -5 ? K.rim : K.base, 1);
    // the red rubber (what prints)
    for (let x = -4; x <= 3; x++) for (let z = -3; z <= 2; z++) add(x, -7, z, K.rubber, 0);
    return out; },
};
export const BENCH_IDS = Object.keys(MODELS);
export function benchCells(id, scheme = null) { const K = { ...SCHEMES[id], ...(scheme || {}) }; return MODELS[id](K); }

// the mesh: one quad per open cell face, the city's corner AO (as work-tools.js / gun-prop.js), vertex colours, metres in the tool's
// frame. THREE is passed in (no import here). Memoised per id.
const DIRS = [
  { n: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]] }, { n: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },
  { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] }, { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] }, { n: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]] },
];
const AOV = [.55, .72, .87, 1], GEO = new Map();
// (the hammer's head cells are 2 + 2 wide about x −1 … 0, so the model is centred on the handle's axis; the stamp's base is 6 wide about
// x −3 … 2: centred too)
export function benchGeometry(THREE, id) {
  if (GEO.has(id)) return GEO.get(id);
  const cells = benchCells(id), M = new Map(), k = (x, y, z) => `${x},${y},${z}`;
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

// THE POSE (a bench clip's prop, bench.js; the gun-prop.js contract): { p: [x, y, z], R: [9 numbers, column-major: the tool's x, y, z
// axes], show } in the walker's body frame: the tool's grip point goes to p, its axes to R's columns. show < 0.5 hides it (collapsed onto
// its grip point). benchMatrix(THREE, pose, out) → the tool's local → walker matrix: T(p) · R. The city's instance matrix = the walker's
// world matrix (ground point, yaw) × this. benchPoint(pose, q) → a point of the tool's frame (HAMMER.face …) in the body frame;
// benchDir(pose, d) a direction.
export function benchMatrix(THREE, pose, out = new THREE.Matrix4()) {
  const R = pose.R, p = pose.p;
  out.set(R[0], R[3], R[6], p[0], R[1], R[4], R[7], p[1], R[2], R[5], R[8], p[2], 0, 0, 0, 1);
  if (pose.show !== undefined && pose.show < .5) out.multiply(new THREE.Matrix4().makeScale(1e-4, 1e-4, 1e-4));
  return out;
}
export const benchDir = (pose, d) => { const R = pose.R; return [R[0] * d[0] + R[3] * d[1] + R[6] * d[2], R[1] * d[0] + R[4] * d[1] + R[7] * d[2], R[2] * d[0] + R[5] * d[1] + R[8] * d[2]]; };
export const benchPoint = (pose, q) => { const r = benchDir(pose, q); return [pose.p[0] + r[0], pose.p[1] + r[1], pose.p[2] + r[2]]; };

// ── THE LAB'S STAND-IN SET (never the city's: the city builds its own bench to BENCH): plain boxes in the walker's body frame, for the anim
// lab to draw under a bench clip's actor (the clip entry's `set`, CLIPS.md § The lab), so the hammer lands on an anvil, the stamp on the
// paper and the finished gun stands in its stand instead of in the air. [x0, y0, z0, x1, y1, z1, colour]: the top and its legs, the
// anvil, the gun's stand, the warrant, the ink pad and the parts tray. Memoised.
const SET_BOXES = (() => {
  const B = BENCH, b = [], box = (cx, cz, w, d, y0, y1, c) => b.push([cx - w / 2, y0, cz - d / 2, cx + w / 2, y1, cz + d / 2, c]);
  b.push([-B.HALF, B.TOP - .04, B.FRONT, B.HALF, B.TOP, B.BACK, 0x7a5232]);
  for (const [x, z] of [[-B.HALF + .05, B.FRONT + .05], [B.HALF - .05, B.FRONT + .05], [-B.HALF + .05, B.BACK - .05], [B.HALF - .05, B.BACK - .05]]) box(x, z, .05, .05, 0, B.TOP - .04, 0x3b2a1a);
  box(B.anvil.x, B.anvil.z, B.anvil.w, B.anvil.d, B.TOP, B.anvil.top, 0x5d636c);
  box(B.stand.x, B.stand.z, B.stand.w, B.stand.d, B.TOP, B.stand.top, 0x26262c);
  box(B.paper.x, B.paper.z, B.paper.w, B.paper.d, B.TOP, B.TOP + .003, 0xf4f1e6);
  box(B.pad.x, B.pad.z, B.pad.w, B.pad.d, B.TOP, B.pad.top, 0x2b2f6b);
  box(B.tray.x, B.tray.z, B.tray.w, B.tray.d, B.TOP, B.TOP + .03, 0x8a8f99);
  return b; })();
let SET_GEO = null;
export function benchSetGeometry(THREE) {
  if (SET_GEO) return SET_GEO;
  const P = [], N = [], C = [], I = [], col = new THREE.Color(); let v = 0;
  for (const [x0, y0, z0, x1, y1, z1, hex] of SET_BOXES) { col.setHex(hex);
    const q = (a, b, c, d, n) => { for (const p of [a, b, c, d]) { P.push(...p); N.push(...n); C.push(col.r, col.g, col.b); } I.push(v, v + 1, v + 2, v, v + 2, v + 3); v += 4; };
    q([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0]); q([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0]);
    q([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0]); q([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0]);
    q([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1]); q([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1]); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setIndex(I); g.computeBoundingSphere(); SET_GEO = g; return g;
}
