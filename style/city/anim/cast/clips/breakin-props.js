// BREAK-IN PROPS · the one voxel model of each break-in tool (MOVEMENT.md §2: one model everywhere: in the hand, dropped, the icon) and
// how the breakin clips pose them (breakin.js). No imports and no three at the top level (worker-safe, like gun-prop.js and phone-prop.js:
// the icon baker can read the cells straight into its Vx grid: `for (const c of toolCells('flashlight')) v.set(...c)`).
//
// THE FRAME of every tool (cells of GRAIN m): the origin is the GRIP POINT, where the hand's grip point (the mitten's centre, walk2.js
// rest (±0.325, 0.39, 0)) sits; +z points along the fingers (out of the front of the fist: ahead when the arm reaches forward), +y to the
// thumb side (up when the arm reaches forward), x across. This is the gun's mapping (robbery.js GUN_IN_HAND): a tool in the hand points
// where the fingers point. The toon fist is a 0.16 × 0.16 × 0.18 m mitten, about twice a real hand: it spans z −0.085 … +0.09 and x, y
// ±0.075 round the grip point. So every tool here is about twice a real one, and nothing reaches back past z −0.07 (the wrist).
//   pick        the lockpick: a yellow grip out of the front of the fist (0.05 × 0.05, to z 0.125), then a thin steel shaft (one cell) to
//               z 0.225, the hook turned up at the tip (TOOL.pick.tip). It rides the +x hand
//   wrench      the tension wrench: a yellow grip (to z 0.1), a thin steel bar to z 0.25, its tip bent down (TOOL.wrench.tip). It rides
//               the −x hand
//   flashlight  a black metal torch, the Lights Out Torch's colours (world/fresh/held.js lights_out): the body (0.05 × 0.05) through the
//               fist, a yellow band, a chrome bezel (0.10 × 0.10) and a warm lens at z 0.25 (TOOL.flashlight.lens). The BEAM leaves the
//               lens along +z (TOOL.flashlight.dir): the light is the city's effect, the clips say where it points (breakin.js beam(t))
// Grain 0.025 m (half the character's 0.05, as the gun, the phone and the work tools): the pick's shaft needs the finer step.
export const GRAIN = .025;
const G = GRAIN;
// sizes and the points the clips and the city use (metres, in the tool's frame)
export const TOOL = {
  pick: { grip: [0, 0, 0], tip: [-.0125, .0375, .2125], len: .225 },
  wrench: { grip: [0, 0, 0], tip: [-.0125, -.0375, .2375], len: .25 },
  flashlight: { grip: [0, 0, 0], lens: [0, 0, .25], dir: [0, 0, 1], len: .325, head: .1 },
};
// colours (STYLE.md §2: flat, bold, never pastel)
export const SCHEMES = {
  pick: { grip: 0xffd23a, steel: 0xd5dbe2, dark: 0x8d949e },
  wrench: { grip: 0xffd23a, steel: 0xd5dbe2, dark: 0x8d949e },
  flashlight: { body: 0x222329, band: 0xf5c518, bezel: 0x8d949e, lens: 0xfff1b0, cap: 0xd8262b },
};
export const TOOL_IDS = ['pick', 'wrench', 'flashlight'];

// the cells: [x, y, z, colour, layer] (layer: 0 matte · 1 gloss · 2 metal · 3 lit, chars.js's materials); a cell (x, y, z) spans
// [x, x + 1] × G etc., so a 2-wide part at x −1..0 is centred on the axis
const MODELS = {
  pick(K) { const out = [], add = (x, y, z, c, l = 0) => out.push([x, y, z, c, l]);
    // the grip, out of the fist's front (z 0.09); the shaft, one cell; the hook, turned up at the tip
    for (let z = 1; z <= 4; z++) for (const x of [-1, 0]) for (const y of [-1, 0]) add(x, y, z, K.grip, 1);
    for (let z = 5; z <= 8; z++) add(-1, 0, z, K.steel, 2);
    add(-1, 1, 8, K.steel, 2);
    return out; },
  wrench(K) { const out = [], add = (x, y, z, c, l = 0) => out.push([x, y, z, c, l]);
    // the grip; the bar; the tip, bent down
    for (let z = 1; z <= 3; z++) for (const x of [-1, 0]) for (const y of [-1, 0]) add(x, y, z, K.grip, 1);
    for (let z = 4; z <= 9; z++) add(-1, -1, z, K.steel, 2);
    add(-1, -2, 9, K.steel, 2);
    return out; },
  flashlight(K) { const out = [], add = (x, y, z, c, l = 0) => out.push([x, y, z, c, l]);
    // the body (its red cap inside the fist, a yellow band out front)
    for (let z = -3; z <= 6; z++) for (const x of [-1, 0]) for (const y of [-1, 0]) add(x, y, z, z === -3 ? K.cap : z === 5 ? K.band : K.body, 1);
    // the head: a chrome bezel, the lens (lit) on its face
    for (let z = 7; z <= 9; z++) for (let x = -2; x <= 1; x++) for (let y = -2; y <= 1; y++) {
      const lens = z === 9 && x >= -1 && x <= 0 && y >= -1 && y <= 0; add(x, y, z, lens ? K.lens : K.bezel, lens ? 3 : 2); }
    return out; },
};
const schemeOf = (id, s) => ({ ...SCHEMES[id], ...(s || {}) });
export function toolCells(id, scheme = null) { return MODELS[id](schemeOf(id, scheme)); }
// the lockpick set as ONE model (the item's icon, a dropped set): the pick and the wrench side by side, flat
export function lockpickSetCells(scheme = null) {
  const out = [];
  for (const c of toolCells('pick', scheme)) out.push([c[0] + 2, c[1], c[2] - 1, c[3], c[4]]);
  for (const c of toolCells('wrench', scheme)) out.push([c[0] - 2, c[1], c[2], c[3], c[4]]);
  return out;
}

// the mesh: one quad per open cell face, the city's corner AO (as gun-prop.js), vertex colours, metres in the tool's frame. THREE is
// passed in (no import here). Memoised per tool and colourway. A lit cell (layer 3: the lens) takes no AO.
const DIRS = [
  { n: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]] }, { n: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },
  { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] }, { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] }, { n: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]] },
];
const AOV = [.55, .72, .87, 1], GEO = new Map();
function cellsMesh(THREE, cells) {
  const M = new Map(), k = (x, y, z) => `${x},${y},${z}`; for (const c of cells) M.set(k(c[0], c[1], c[2]), c);
  const has = (x, y, z) => M.has(k(x, y, z)) ? 1 : 0, P = [], N = [], C = [], I = [], col = new THREE.Color(); let v = 0;
  for (const [x, y, z, hex, layer] of cells) for (const d of DIRS) { const [nx, ny, nz] = d.n; if (has(x + nx, y + ny, z + nz)) continue;
    const a4 = d.c.map(c => { const t = [nx ? 0 : (c[0] ? 1 : -1), ny ? 0 : (c[1] ? 1 : -1), nz ? 0 : (c[2] ? 1 : -1)], e = [];
      if (t[0]) e.push([t[0], 0, 0]); if (t[1]) e.push([0, t[1], 0]); if (t[2]) e.push([0, 0, t[2]]);
      const ax = x + nx, ay = y + ny, az = z + nz, s1 = has(ax + e[0][0], ay + e[0][1], az + e[0][2]), s2 = has(ax + e[1][0], ay + e[1][1], az + e[1][2]), cr = has(ax + t[0], ay + t[1], az + t[2]);
      return s1 && s2 ? 0 : 3 - (s1 + s2 + cr); });
    col.setHex(hex); const lit = layer === 3;
    d.c.forEach((c, q) => { P.push((x + c[0]) * G, (y + c[1]) * G, (z + c[2]) * G); N.push(nx, ny, nz); const a = lit ? 1 : AOV[a4[q]]; C.push(col.r * a, col.g * a, col.b * a); });
    if (a4[0] + a4[2] < a4[1] + a4[3]) I.push(v + 1, v + 2, v + 3, v + 1, v + 3, v); else I.push(v, v + 1, v + 2, v, v + 2, v + 3); v += 4; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setIndex(I); g.computeBoundingSphere(); return g;
}
export function toolGeometry(THREE, id, scheme = null) { const key = id + JSON.stringify(scheme || {}); if (!GEO.has(key)) GEO.set(key, cellsMesh(THREE, toolCells(id, scheme))); return GEO.get(key); }
export function lockpickSetGeometry(THREE, scheme = null) { const key = 'set' + JSON.stringify(scheme || {}); if (!GEO.has(key)) GEO.set(key, cellsMesh(THREE, lockpickSetCells(scheme))); return GEO.get(key); }

// THE POSE (a breakin clip's, breakin.js): { p: [x, y, z], R: [9 numbers, column-major: the tool's x, y, z axes], show } in the walker's
// body frame: the tool's grip point goes to p, its axes to R's columns. show < 0.5 hides it (collapsed onto its grip point, as gun-prop.js).
// toolMatrix(THREE, pose, out) → the tool's local → walker matrix: T(p) · R. The city's instance matrix = the walker's world matrix
// (ground point, yaw) × this. toolPoint(pose, q) → a point of the tool's frame (TOOL.flashlight.lens …) in the body frame; toolDir(pose, d)
// a direction.
export function toolMatrix(THREE, pose, out = new THREE.Matrix4()) {
  const R = pose.R, p = pose.p;
  out.set(R[0], R[3], R[6], p[0], R[1], R[4], R[7], p[1], R[2], R[5], R[8], p[2], 0, 0, 0, 1);
  if (pose.show !== undefined && pose.show < .5) out.multiply(new THREE.Matrix4().makeScale(1e-4, 1e-4, 1e-4));
  return out;
}
export const toolDir = (pose, d) => { const R = pose.R; return [R[0] * d[0] + R[3] * d[1] + R[6] * d[2], R[1] * d[0] + R[4] * d[1] + R[7] * d[2], R[2] * d[0] + R[5] * d[1] + R[8] * d[2]]; };
export const toolPoint = (pose, q) => { const r = toolDir(pose, q); return [pose.p[0] + r[0], pose.p[1] + r[1], pose.p[2] + r[2]]; };

// ── ONE LIVE MESH for the lockpick pair (the anim lab's prop slot draws one geometry with one matrix: lab.js drawProps): the pick and the
// wrench merged into one geometry whose vertices are re-posed on the CPU by pose(poses) (a few hundred vertices). For a single preview (the
// lab, a sheet); the city draws the two tools as their own meshes (toolGeometry + toolMatrix per hand), never this.
export function lockpickLive(THREE, scheme = null) {
  const src = ['wrench', 'pick'].map(id => toolGeometry(THREE, id, scheme));
  const n = src.reduce((s, g) => s + g.attributes.position.count, 0), P = new Float32Array(n * 3), N = new Float32Array(n * 3), C = new Float32Array(n * 3), I = [];
  let o = 0; src.forEach(g => { C.set(g.attributes.color.array, o * 3); for (const i of g.index.array) I.push(i + o); o += g.attributes.position.count; });
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(P, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(N, 3)); geo.setAttribute('color', new THREE.BufferAttribute(C, 3)); geo.setIndex(I);
  const V = new THREE.Vector3(), NM = new THREE.Matrix3(), M = new THREE.Matrix4();
  // poses: [the wrench's pose (the −x hand), the pick's pose (the +x hand)], each { p, R, show }
  geo.userData.pose = (poses) => { let q = 0;
    src.forEach((g, n) => { toolMatrix(THREE, poses[n], M); NM.getNormalMatrix(M); const sp = g.attributes.position.array, sn = g.attributes.normal.array;
      for (let i = 0; i < sp.length; i += 3, q += 3) { V.set(sp[i], sp[i + 1], sp[i + 2]).applyMatrix4(M); P[q] = V.x; P[q + 1] = V.y; P[q + 2] = V.z; V.set(sn[i], sn[i + 1], sn[i + 2]).applyMatrix3(NM).normalize(); N[q] = V.x; N[q + 1] = V.y; N[q + 2] = V.z; } });
    geo.attributes.position.needsUpdate = geo.attributes.normal.needsUpdate = true; geo.computeBoundingSphere(); };
  const I3 = [1, 0, 0, 0, 1, 0, 0, 0, 1]; geo.userData.pose([{ p: [0, 0, 0], R: I3 }, { p: [0, 0, 0], R: I3 }]); return geo;
}
