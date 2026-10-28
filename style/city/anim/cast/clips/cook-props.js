// COOK PROPS · the one voxel model of each cooking prop (MOVEMENT.md §2: one model everywhere: on the bench, in the hand, the icon)
// and how a cook clip poses them (cook.js). No imports and no three at the top level (worker-safe, like work-tools.js): the icon baker
// can read cookCells(id) straight into its Vx grid, `for (const c of cookCells('pot')) v.set(...c)`.
//
// ONE LOOK FOR EVERY DRUG (slime: a drug's name never shows live). Every pot, batch, bottle, vial and stream below is the same whatever
// the Chemist cooks: one colour scheme (SCHEME), no labels, no per-drug shape or size. Nothing here takes a drug, and nothing in the
// city should pass one.
//
// THE SET is the cook's bench in the walker's BODY FRAME: the walker stands on the bench's cook spot facing it, +z ahead, y up from its
// ground point, +x the side of the clips' +x arm. The bench and the burner are the CITY's (a set at home and in the woods shack; cook.md
// says what to place). This file sizes them (BENCH, BURNER) and draws a plain stand-in only in the anim lab's preview (&cookset=1).
// The props on it (PART_IDS) are this file's:
//   pot     a red enamel saucepan on the burner, 0.30 m across and 0.15 m tall, the batch inside; a long iron handle out to −x
//   rod     a wooden stirring paddle, 0.425 m, its blade at its foot: it leans in the pot when no hand holds it
//   bottle  a reagent bottle of the chem, amber glass, 0.40 m: the second chem a cook pours in
//   vial    a capped test tube of the batch, 0.30 m: what a cook holds up to the light; it stands in the rack
//   rack    the vial's wooden stand
//   stream  the pour: a column of the chem from the bottle's mouth down to the batch (shown only while pouring)
// Grain 0.025 m (half the character's 0.05, as the tools and the phone): each prop is about twice a real one, as the fist is twice a
// real hand.
export const GRAIN = .025;
const G = GRAIN;

// THE SET's numbers (metres, body frame). The city places its bench so that its top is BENCH.top above the walker's ground and its
// front edge BENCH.front ahead of it, and the burner's top centred at (BURNER.x, BURNER.top, BURNER.z). The toon arm reaches only
// 0.40–0.45 m from the shoulder, and the head (x ±0.5, y 0.9–1.7, its front face at z 0.45) owns everything above y 0.9: the bench is
// low and close, and the hands work in front of the chest, under the chin.
export const BENCH = { top: .38, front: .22, back: .82, x0: -.75, x1: .75 };
export const BURNER = { x: 0, z: .4, top: .42, w: .34, d: .34 };
// the props' own sizes and the points the clips use (metres, in each prop's own frame, y up when it stands):
//   pot     origin at its bottom centre; the batch's surface 0.10 up; the handle's grip (the −x hand's)
//   rod     origin at the blade's foot, +y up the handle; the +x hand's grip
//   bottle  origin at its bottom centre; the −x hand's grip on its body; its mouth
//   vial    origin at its bottom centre; the +x hand's grip
//   stream  origin at its top (the bottle's mouth); it hangs 1 m down, scaled to the pour (the pose's len)
export const PROP = {
  pot: { r: .15, h: .15, batch: .1, handle: [-.29, .125, 0] },
  rod: { len: .425, grip: .35, blade: .1 },
  bottle: { h: .4, grip: .2, mouth: .4, r: .0875 },
  vial: { h: .3, grip: .14 },
  rack: { h: .05 },
  stream: { len: 1 },
};
// the city's steam and lab light (cook.md): where the steam leaves the pot (its batch surface, body frame), and where a lamp over the
// bench lights the vial the cook holds up
export const STEAM = { at: [BURNER.x, BURNER.top + .1, BURNER.z], r: .12 };
export const LAMP = { at: [.3, 1.95, .55] };
// colours (STYLE.md: flat, bold), one scheme for every drug:
//   the pot's enamel and rim, its iron handle · the batch (milky) · the wood of the paddle and the rack · the glass of the vial and the
//   bottle's lip · the chem (amber) · the vial's cap
export const SCHEME = {
  enamel: 0xd8322a, enamelD: 0xa8221c, rim: 0xf3e6bf, iron: 0x26262c,
  batch: 0xece6d2, batchD: 0xcfc6ac,
  wood: 0xc98b4b, woodD: 0x9c6532,
  glass: 0xbfe6f0, glassD: 0x8fc4d2, lip: 0xf4f4f8,
  chem: 0xe8901f, chemD: 0xb5650c, chemL: 0xffc566,
  cap: 0xe8402a,
};

// THE CELLS: [x, y, z, colour, layer] (layer 0 matte · 1 gloss · 2 metal, as the icon baker reads them); a cell (x, y, z) spans
// [x, x + 1] × G etc. OFFSET (cells) shifts a model onto its origin: an odd width is centred by half a cell.
const disc = (x, z, r) => (x + .5) ** 2 + (z + .5) ** 2 <= r * r;
const MODELS = {
  pot(K) {
    const out = [], add = (x, y, z, c, l = 1) => out.push([x, y, z, c, l]);
    for (let y = 0; y < 6; y++) for (let x = -6; x < 6; x++) for (let z = -6; z < 6; z++) {
      if (!disc(x, z, 6.2)) continue;
      const wall = !disc(x, z, 5.1);
      // the floor; the wall (a pale rim, a dark band under it); the batch inside, its surface 4 cells up
      if (y === 0) add(x, y, z, K.enamelD);
      else if (wall) add(x, y, z, y === 5 ? K.rim : y === 4 ? K.enamelD : K.enamel);
      else if (y <= 3) add(x, y, z, y === 3 && (x + z) % 3 === 0 ? K.batchD : K.batch, 0);
    }
    // the long handle (iron) out to −x at the rim, toward the cook's −x hand: 7 cells (0.175 m) from the wall
    for (let x = -13; x < -6; x++) for (const z of [-1, 0]) for (let y = 4; y < 6; y++) add(x, y, z, K.iron, 2);
    return out;
  },
  rod(K) {
    const out = [], add = (x, y, z, c, l = 0) => out.push([x, y, z, c, l]);
    // the blade: 0.10 × 0.10, one cell thick, a thicker top row
    for (let y = 0; y < 4; y++) for (let x = -2; x < 2; x++) add(x, y, -1, y === 0 ? K.woodD : K.wood);
    for (let x = -2; x < 2; x++) add(x, 3, 0, K.wood);
    // the handle: 2 × 2 cells, 13 long
    for (let y = 4; y < 17; y++) for (const x of [-1, 0]) for (const z of [-1, 0]) add(x, y, z, (x + y + z) % 5 === 0 ? K.woodD : K.wood);
    return out;
  },
  bottle(K) {
    // a round body 7 cells across and 10 tall, a shoulder, a neck, a pale lip; amber glass with a lighter streak up one side
    const out = [], R = [3.3, 3.3, 3.3, 3.3, 3.3, 3.3, 3.3, 3.3, 3.3, 3.3, 2.3, 1.6, 1.5, 1.5, 1.5, 2.1];
    for (let y = 0; y < 16; y++) for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) {
      if (x * x + z * z > R[y] * R[y]) continue;
      const lit = x === -2 && z === 1 && y >= 1 && y <= 9;
      out.push([x, y, z, y === 15 ? K.lip : y === 0 || y >= 10 ? K.chemD : lit ? K.chemL : K.chem, 1]);
    }
    return out;
  },
  vial(K) {
    // 3 × 3 cells × 12: the batch to row 8, glass above it, a red cap; a rounded foot
    const out = [];
    for (let y = 0; y < 12; y++) for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) {
      if (y === 0 && x !== 0 && z !== 0) continue;
      out.push([x, y, z, y >= 11 ? K.cap : y === 8 ? K.glassD : y > 8 ? K.glass : K.batch, y >= 11 ? 0 : 1]);
    }
    return out;
  },
  rack(K) {
    // 5 × 2 × 5 cells, a 3 × 3 hole through the top row
    const out = [];
    for (let y = 0; y < 2; y++) for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) {
      if (y === 1 && Math.abs(x) <= 1 && Math.abs(z) <= 1) continue;
      out.push([x, y, z, (x + z) % 2 === 0 ? K.woodD : K.wood, 0]);
    }
    return out;
  },
  stream(K) {
    // a cross of 5 cells, 40 long (1 m), hanging down from its origin
    const out = [];
    for (let y = -40; y < 0; y++) for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) {
      if (x && z) continue;
      out.push([x, y, z, y % 3 === 0 ? K.chem : K.chemL, 1]);
    }
    return out;
  },
};
// odd widths are centred on the prop's axis by half a cell
const OFFSET = { vial: [-.5, 0, -.5], rack: [-.5, 0, -.5], bottle: [-.5, 0, -.5], stream: [-.5, 0, -.5] };
export const PART_IDS = ['pot', 'rod', 'bottle', 'vial', 'rack', 'stream'];
export function cookCells(id, scheme = null) { const K = { ...SCHEME, ...(scheme || {}) }; return MODELS[id](K); }

// THE MESH: one quad per open cell face, the city's corner AO (as work-tools.js toolGeometry), vertex colours, metres in the prop's own
// frame. THREE is passed in (no import here). Memoised per id.
const DIRS = [
  { n: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]] }, { n: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },
  { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] }, { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] }, { n: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]] },
];
const AOV = [.55, .72, .87, 1], GEO = new Map();
function mesh(THREE, cells, off = [0, 0, 0]) {
  const M = new Map(), k = (x, y, z) => `${x},${y},${z}`;
  for (const c of cells) M.set(k(c[0], c[1], c[2]), c[3]);
  const has = (x, y, z) => M.has(k(x, y, z)) ? 1 : 0, P = [], N = [], C = [], I = [], col = new THREE.Color();
  let v = 0;
  for (const [x, y, z, hex] of cells) for (const d of DIRS) {
    const [nx, ny, nz] = d.n;
    if (has(x + nx, y + ny, z + nz)) continue;
    const a4 = d.c.map(c => {
      const t = [nx ? 0 : (c[0] ? 1 : -1), ny ? 0 : (c[1] ? 1 : -1), nz ? 0 : (c[2] ? 1 : -1)], e = [];
      if (t[0]) e.push([t[0], 0, 0]);
      if (t[1]) e.push([0, t[1], 0]);
      if (t[2]) e.push([0, 0, t[2]]);
      const ax = x + nx, ay = y + ny, az = z + nz, s1 = has(ax + e[0][0], ay + e[0][1], az + e[0][2]), s2 = has(ax + e[1][0], ay + e[1][1], az + e[1][2]), cr = has(ax + t[0], ay + t[1], az + t[2]);
      return s1 && s2 ? 0 : 3 - (s1 + s2 + cr);
    });
    col.setHex(hex);
    d.c.forEach((c, q) => { P.push((x + c[0] + off[0]) * G, (y + c[1] + off[1]) * G, (z + c[2] + off[2]) * G); N.push(nx, ny, nz); const a = AOV[a4[q]]; C.push(col.r * a, col.g * a, col.b * a); });
    if (a4[0] + a4[2] < a4[1] + a4[3]) I.push(v + 1, v + 2, v + 3, v + 1, v + 3, v); else I.push(v, v + 1, v + 2, v, v + 2, v + 3);
    v += 4;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); geo.setIndex(I); geo.computeBoundingSphere();
  return geo;
}
// one prop's mesh in its own frame (partMatrix places it)
export function partGeometry(THREE, id) { if (!GEO.has(id)) GEO.set(id, mesh(THREE, cookCells(id), OFFSET[id])); return GEO.get(id); }

// THE POSE of a part (a cook clip's track, cook.js): { x, y, z, az, el, sp, px, py, pz, len?, show }. The part's point (px, py, pz) of its
// own frame goes to (x, y, z) in the walker's body frame; its +y axis points along azimuth az (0 = +z, + toward +x) at elevation el
// (rad above the horizontal: π/2 = upright), and it spins sp about that axis (work-tools.js toolMatrix's convention); len scales the
// stream's length; show < 0.5 hides it (collapsed onto its point). partMatrix(THREE, pose, out) gives its local → walker matrix,
// T(x, y, z) · Ry(az) · Rx(π/2 − el) · Ry(sp) · S(1, len, 1) · T(−p). The city's instance matrix = the walker's world matrix × this.
export function partMatrix(THREE, p, out = new THREE.Matrix4()) {
  const A = new THREE.Matrix4();
  out.makeTranslation(p.x, p.y, p.z).multiply(A.makeRotationY(p.az || 0)).multiply(A.makeRotationX(Math.PI / 2 - (p.el ?? Math.PI / 2))).multiply(A.makeRotationY(p.sp || 0));
  if (p.len !== undefined) out.multiply(A.makeScale(1, p.len, 1));
  out.multiply(A.makeTranslation(-(p.px || 0), -(p.py || 0), -(p.pz || 0)));
  // hidden: collapsed onto its point
  if (p.show !== undefined && p.show < .5) out.multiply(A.makeScale(1e-4, 1e-4, 1e-4));
  return out;
}
// Ry(az) · Rx(π/2 − el) · Ry(sp), column-major 3 × 3: the same matrix the shader builds, aRY(az) * aRX(π/2 − el) * aRY(sp)
export function rotOf(p) {
  const ry = a => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, -s, 0, 1, 0, s, 0, c]; }, rx = a => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, s, 0, -s, c]; };
  const mul = (A, B) => { const o = new Array(9); for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) o[c * 3 + r] = A[r] * B[c * 3] + A[3 + r] * B[c * 3 + 1] + A[6 + r] * B[c * 3 + 2]; return o; };
  return mul(mul(ry(p.az || 0), rx(Math.PI / 2 - (p.el ?? Math.PI / 2))), ry(p.sp || 0));
}
// a point q of a part's own frame → the body frame (no three needed: cook.js's hand targets and the city's effects use it)
export function partPoint(p, q) {
  const R = rotOf(p), s = p.len ?? 1, v = [q[0] - (p.px || 0), (q[1] - (p.py || 0)) * s, q[2] - (p.pz || 0)];
  return [p.x + R[0] * v[0] + R[3] * v[1] + R[6] * v[2], p.y + R[1] * v[0] + R[4] * v[1] + R[7] * v[2], p.z + R[2] * v[0] + R[5] * v[1] + R[8] * v[2]];
}

// THE SET AT REST: where every part sits when no hand moves it (draw the set at these whenever no cook clip plays). Body frame. The
// paddle leans in the pot toward the +x hand (its blade's foot on the pot's floor, ROD_HOME); the bottle stands at the bench's −x end
// and the vial in its rack at the +x end, each where its hand reaches it; the stream is hidden.
const up = Math.PI / 2;
export const ROD_HOME = { foot: [BURNER.x + .055, BURNER.top + .025, BURNER.z], top: [.33, .65, .452] };
const rd = ROD_HOME.top.map((v, i) => v - ROD_HOME.foot[i]);
export const SET = {
  pot: { x: BURNER.x, y: BURNER.top, z: BURNER.z, az: 0, el: up, sp: 0, px: 0, py: 0, pz: 0, show: 1 },
  rod: { x: ROD_HOME.foot[0], y: ROD_HOME.foot[1], z: ROD_HOME.foot[2], az: Math.atan2(rd[0], rd[2]), el: Math.atan2(rd[1], Math.hypot(rd[0], rd[2])), sp: .3, px: 0, py: 0, pz: 0, show: 1 },
  bottle: { x: -.54, y: BENCH.top + PROP.bottle.grip, z: .29, az: 1.85, el: up, sp: .3 - 1.85, px: 0, py: PROP.bottle.grip, pz: 0, show: 1 },
  rack: { x: .53, y: BENCH.top, z: .28, az: 0, el: up, sp: 0, px: 0, py: 0, pz: 0, show: 1 },
  vial: { x: .53, y: BENCH.top + .025 + PROP.vial.grip, z: .28, az: 0, el: up, sp: 0, px: 0, py: PROP.vial.grip, pz: 0, show: 1 },
  stream: { x: 0, y: .7, z: .4, az: 0, el: up, sp: 0, px: 0, py: 0, pz: 0, len: .1, show: 0 },
};

// ── THE LAB'S PREVIEW (never the city's): one live mesh of every part a clip poses, re-posed on the CPU each frame (ride-props.js
// liveMesh: the anim lab's prop slot draws one geometry with one matrix). With &cookset=1 in the lab's URL it also draws a plain
// stand-in for the city's bench and burner (BENCH, BURNER), so the sheets show the set; the gates never pass it and see only the props.
// The stand-in's boxes: [x0, y0, z0, x1, y1, z1, colour]: the top (a steel-grey slab), its front apron, four legs, the burner, its hot
// plate and its knobs.
const SETBOX = (() => {
  const b = [], top = BENCH.top, legs = [[BENCH.x0 + .03, BENCH.front + .03], [BENCH.x1 - .08, BENCH.front + .03], [BENCH.x0 + .03, BENCH.back - .08], [BENCH.x1 - .08, BENCH.back - .08]];
  b.push([BENCH.x0, top - .05, BENCH.front, BENCH.x1, top, BENCH.back, 0xb9c2c9]);
  b.push([BENCH.x0, top - .1, BENCH.front + .02, BENCH.x1, top - .05, BENCH.front + .05, 0x6b737c]);
  for (const [x, z] of legs) b.push([x, 0, z, x + .05, top - .05, z + .05, 0x5d636c]);
  const { x, z, top: bt, w, d } = BURNER;
  b.push([x - w / 2, top, z - d / 2, x + w / 2, bt - .01, z + d / 2, 0x26262c], [x - w / 2 + .03, bt - .01, z - d / 2 + .03, x + w / 2 - .03, bt, z + d / 2 - .03, 0xff7a1a]);
  b.push([x - .05, top + .005, z - d / 2 - .012, x - .02, top + .03, z - d / 2, 0xd5dbe2], [x + .02, top + .005, z - d / 2 - .012, x + .05, top + .03, z - d / 2, 0xd5dbe2]);
  return b;
})();
function boxesGeometry(THREE, boxes) {
  const P = [], N = [], C = [], I = [], col = new THREE.Color();
  let v = 0;
  for (const [x0, y0, z0, x1, y1, z1, hex] of boxes) {
    col.setHex(hex);
    const q = (a, b, c, d, n) => { for (const p of [a, b, c, d]) { P.push(...p); N.push(...n); C.push(col.r, col.g, col.b); } I.push(v, v + 1, v + 2, v, v + 2, v + 3); v += 4; };
    q([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0]); q([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0]);
    q([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0]); q([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0]);
    q([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1]); q([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setIndex(I);
  return g;
}
const showSet = () => { try { return new URLSearchParams(globalThis.location?.search || '').get('cookset') === '1'; } catch { return false; } };
// liveMesh(THREE, list): list = [[partId, n], …] (n instances of each, in partMatrices order); geo.userData.pose(mats) re-poses it
// from [[partId, Matrix4], …]
export function liveMesh(THREE, list, set = showSet()) {
  const src = list.flatMap(([id, n]) => Array.from({ length: n }, () => partGeometry(THREE, id))), setG = set ? boxesGeometry(THREE, SETBOX) : null;
  const all = setG ? [...src, setG] : src, n = all.reduce((s, g) => s + g.attributes.position.count, 0), P = new Float32Array(n * 3), N = new Float32Array(n * 3), C = new Float32Array(n * 3), I = [];
  let o = 0;
  all.forEach(g => { C.set(g.attributes.color.array, o * 3); for (const i of g.index.array) I.push(i + o); o += g.attributes.position.count; });
  if (setG) { P.set(setG.attributes.position.array, (n - setG.attributes.position.count) * 3); N.set(setG.attributes.normal.array, (n - setG.attributes.position.count) * 3); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(P, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(N, 3)); geo.setAttribute('color', new THREE.BufferAttribute(C, 3)); geo.setIndex(I);
  const V = new THREE.Vector3(), NM = new THREE.Matrix3();
  geo.userData.pose = mats => {
    let q = 0;
    mats.forEach(([, m], k) => {
      const g = src[k], sp = g.attributes.position.array, sn = g.attributes.normal.array;
      NM.getNormalMatrix(m);
      for (let i = 0; i < sp.length; i += 3, q += 3) { V.set(sp[i], sp[i + 1], sp[i + 2]).applyMatrix4(m); P[q] = V.x; P[q + 1] = V.y; P[q + 2] = V.z; V.set(sn[i], sn[i + 1], sn[i + 2]).applyMatrix3(NM).normalize(); N[q] = V.x; N[q + 1] = V.y; N[q + 2] = V.z; }
    });
    geo.attributes.position.needsUpdate = geo.attributes.normal.needsUpdate = true; geo.computeBoundingSphere();
  };
  return geo;
}
