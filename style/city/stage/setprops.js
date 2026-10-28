// C1-7 · THE SETS' PROPS, the city's own (the clip notes' "What the city must stage"; anim/cast/clips/*-props.js hold the numbers and
// the clips' own held props, and are synced from ai-city-fresh, so nothing here edits them). Every geometry is built once and shared.
//   viseGeometry     the Gunrunner's bench vise: viseCells() copied from slime's crafter game (game/src/gunbench.js, the cast-iron
//                    bench vise), scaled 0.65 onto the bench's VISE numbers (game-port-props.js): the jaws centred on (−0.07, 0.55), the
//                    swivel base sunk into the top so the jaws stand to 0.60 and the blank to 0.64; with the moving jaw, the screw and
//                    its T-bar at VISE.hub and the parts mat (the lab's stand-in boxes, which it replaces in the city)
//   lampGeometry     the bench's lamp (bench.md: the foot at (−0.58, 0.76), the shade at (−0.42, 0.92, 0.70)); its bulb is unlit
//   vaultGeometry    Precinct 9's vault door set (heist.md): the wall with its round opening, the dark inside, and the door (radius
//                    0.78, 0.25 thick, the wheel a 0.2 m ring) as its own mesh, hinged on its −x edge
//   containerGeometry  a 20 ft shipping container, its doors open, boxes stacked inside (the docks' run)
//   moundGeometry / packageGeometry  the woods' dug earth and the buried package (a taped tarp bundle)
//   pileGeometry     a heap to search: scrap at the junkyard, bags and boxes behind the Mall
//   boothGeometry    a diner booth: two padded benches with backs facing over a table (the day's sit-down)
//   carGeometry      a parked sedan, its driver's door swung open (the day's sit-down in a car: one sat in the doorway, one at the door)
import { BENCH as BB } from '../anim/cast/clips/bench-props.js';
import { VISE } from '../anim/cast/clips/game-port-props.js';

// ── cells (the crafter's builder): set(x, y, z, colour) and box(x0, y0, z0, x1, y1, z1, colour | (x, y, z) => colour), integer cells
function cells() {
  const C = new Map(), key = (x, y, z) => `${x},${y},${z}`;
  const f = { set(x, y, z, c) { C.set(key(x, y, z), [x, y, z, c]); return f; },
    box(x0, y0, z0, x1, y1, z1, c) { for (let x = x0; x < x1; x++) for (let y = y0; y < y1; y++) for (let z = z0; z < z1; z++) f.set(x, y, z, typeof c === 'function' ? c(x, y, z) : c); return f; },
    get out() { return C; } };
  return f;
}
// a cell map as one geometry: each cell (x, y, z) spans [x, x + 1] · grain, only its faces that no neighbour covers; then T(cell) → body
function cellGeometry(THREE, C, grain, T) {
  const P = [], N = [], K = [], I = [], col = new THREE.Color(); let v = 0;
  const F = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  for (const [x, y, z, hex] of C.values()) { col.setHex(hex);
    for (const n of F) { if (C.has(`${x + n[0]},${y + n[1]},${z + n[2]}`)) continue;
      const a = n[0] ? 0 : 1, b = n[2] ? 1 : 2, i = n.findIndex(q => q), s = n[i] > 0 ? 1 : 0, c = [];
      for (const [u, w] of [[0, 0], [1, 0], [1, 1], [0, 1]]) { const q = [x, y, z]; q[i] += s; const ax = [0, 1, 2].filter(k => k !== i); q[ax[0]] += u; q[ax[1]] += w; c.push(T(q[0] * grain, q[1] * grain, q[2] * grain)); }
      const nn = T(n[0], n[1], n[2], true);
      // (wind each quad outward)
      const e1 = [c[1][0] - c[0][0], c[1][1] - c[0][1], c[1][2] - c[0][2]], e2 = [c[2][0] - c[0][0], c[2][1] - c[0][1], c[2][2] - c[0][2]], cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      const flip = cr[0] * nn[0] + cr[1] * nn[1] + cr[2] * nn[2] < 0;
      for (const p of c) { P.push(...p); N.push(...nn); K.push(col.r, col.g, col.b); }
      if (flip) I.push(v, v + 2, v + 1, v, v + 3, v + 2); else I.push(v, v + 1, v + 2, v, v + 2, v + 3); v += 4; void a; void b; } }
  return finish(THREE, P, N, K, I);
}
// boxes [x0, y0, z0, x1, y1, z1, colour] (m) as one geometry
export function boxesGeometry(THREE, boxes) {
  const P = [], N = [], K = [], I = [], col = new THREE.Color(); let v = 0;
  for (const [x0, y0, z0, x1, y1, z1, hex] of boxes) { col.setHex(hex);
    const q = (a, b, c, d, n) => { for (const p of [a, b, c, d]) { P.push(...p); N.push(...n); K.push(col.r, col.g, col.b); } I.push(v, v + 1, v + 2, v, v + 2, v + 3); v += 4; };
    q([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0]); q([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0]);
    q([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0]); q([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0]);
    q([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1]); q([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1]); }
  return finish(THREE, P, N, K, I);
}
function finish(THREE, P, N, K, I) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(K, 3)); g.setIndex(I); g.computeBoundingSphere(); return g; }
const once = new Map(), memo = (k, f) => once.get(k) ?? once.set(k, f()).get(k);

// ── the vise. viseCells() is the crafter's (gunbench.js J6b), as written there; its frame: the fixed jaw's face at z 0, the body back
// to z −12, the steel plate it is bolted to at y 0, cells of 0.025 m
const VC = { p: 0x3e5872, pd: 0x2c4054, pl: 0x50708c, iron: 0x6f747b, bright: 0xc9ced6, jaw: 0xc4c9d0, jawD: 0x8a9098, ink: 0x17171b };
const hv = (x, y, z) => ((((x * 73856093) ^ (y * 19349663) ^ (z * 83492791)) >>> 0) % 1000) / 1000;
const worn = (x0, y0, z0, x1, y1, z1) => (x, y, z) => { const ex = x === x0 || x === x1 - 1, ey = y === y1 - 1, ez = z === z0 || z === z1 - 1; return ex + ey + ez >= 2 && hv(x, y, z) < .28 ? VC.iron : y === y0 ? VC.pd : VC.p; };
const teeth = (x, y) => y % 2 ? VC.jaw : VC.jawD;
const viseCells = () => { const f = cells();
  for (let x = -6; x < 6; x++) for (let z = -12; z < 1; z++) { const r = Math.hypot(x + .5, z + 5.5); if (r <= 6.2) f.set(x, 0, z, r > 5.4 ? VC.iron : VC.pd); if (r <= 4.6) f.set(x, 1, z, r > 3.9 ? VC.iron : VC.p); }
  for (const x of [-8, 6]) { f.box(x, 0, -7, x + 2, 1, -4, VC.pd); f.set(x + (x < 0 ? 0 : 1), 1, -6, VC.bright).set(x + (x < 0 ? 0 : 1), 1, -5, VC.bright); }
  f.box(-3, 2, -10, 3, 10, -1, worn(-3, 2, -10, 3, 10, -1));
  f.box(-2, 3, -1, 2, 7, 0, VC.ink);
  f.box(-5, 8, -4, 5, 13, -1, worn(-5, 8, -4, 5, 13, -1)).box(-5, 8, -1, 5, 13, 0, teeth);
  f.set(-4, 11, -1, VC.ink).set(3, 11, -1, VC.ink);
  f.box(-3, 10, -10, 3, 12, -4, (x, y) => y === 11 ? VC.bright : VC.p);
  return f.out; };
// (the material argument the crafter passes, MET / GLOSS, has no counterpart in a vertex-coloured mesh and is dropped)
export const VISE_SCALE = .65;
// the fit on the bench (body frame): the vise turned to face the walker (its body away from it, the screw toward it), the jaws' gap
// centred on VISE.jaws, the jaws' top at 0.60 (the plate and the swivel sunk 4 cm into the top)
const G = .025 * VISE_SCALE, GAP = .03, FACE_Z = VISE.jaws.z + GAP / 2, JAW_TOP = .60, Y0 = JAW_TOP - 13 * G;
export const VISE_FIT = { scale: VISE_SCALE, faceZ: FACE_Z, y0: Y0, jawTop: JAW_TOP, x: VISE.jaws.x };
export function viseGeometry(THREE) {
  return memo('vise', () => {
    const fixed = cellGeometry(THREE, viseCells(), G, (x, y, z, n) => n ? [-x, y, -z] : [VISE.jaws.x - x, Y0 + y, FACE_Z - z]);
    // the moving jaw on the walker's side of the gap, its screw and T-bar at VISE.hub (bench_clamp's crank circles it), the blank in the
    // jaws, the parts mat with a part on it beside the vise (bench_fit's −x hand reaches to it)
    const jz = VISE.jaws.z - GAP / 2, x = VISE.jaws.x, top = BB.TOP ?? .435;
    const rest = boxesGeometry(THREE, [
      [x - 5 * G, JAW_TOP - 5 * G, jz - G, x + 5 * G, JAW_TOP, jz, VC.jaw], [x - 5 * G, JAW_TOP - 5 * G, jz - 5 * G, x + 5 * G, JAW_TOP, jz - G, VC.p],
      [x - 3 * G, Y0 + 3 * G, jz - 5 * G, x + 3 * G, JAW_TOP - 5 * G, jz - G, VC.pd],
      [x - .04, .64 - .17, VISE.jaws.z - .012, x + .04, .64, VISE.jaws.z + .012, 0x9aa0a8],
      [VISE.hub[0] - .012, VISE.hub[1] - .012, VISE.hub[2], VISE.hub[0] + .012, VISE.hub[1] + .012, jz - 5 * G, VC.bright],
      [VISE.hub[0] - .1, VISE.hub[1] - .008, VISE.hub[2] - .008, VISE.hub[0] + .1, VISE.hub[1] + .008, VISE.hub[2] + .008, VC.bright],
      [-.38, top, .51, -.22, top + .01, .65, 0x2d2f33], [-.3, top + .01, .565, -.26, top + .035, .595, 0xb0b5bd]]);
    return merge(THREE, [fixed, rest]);
  });
}
export function lampGeometry(THREE) {
  return memo('lamp', () => { const t = BB.TOP ?? .435;
    return boxesGeometry(THREE, [[-.62, t, .72, -.54, t + .02, .80, 0x2a2c30], [-.595, t + .02, .745, -.565, .9, .775, 0x3a3d42], [-.58, .88, .69, -.42, .9, .72, 0x3a3d42],
      [-.5, .86, .63, -.34, .96, .77, 0x2f6b4f]]); });
}
// ── Precinct 9's vault (heist.md, the stand-in the clearances were measured on): the door's face is the plane z = 0 of this set's frame,
// the crew on its +z side; the hinge at x = −0.95 (from the heaver's line, door.hinge); the door centred 0.8 m up, radius 0.78
export const VAULT = { r: .78, cy: .8, thick: .25, hinge: -.95, cx: 0 };
export function vaultGeometry(THREE) {
  return memo('vault', () => {
    const W = [], wall = 0x59606a, rim = 0x8d949d, R = VAULT.r + .06;
    // the wall: a slab 3.2 m wide and 2.6 tall behind the door's face, built in strips round the round opening
    for (let y = 0; y < 2.6; y += .1) { const dy = y + .05 - VAULT.cy, h = Math.abs(dy) < R ? Math.sqrt(R * R - dy * dy) : 0;
      if (h) { W.push([-1.6, y, -.5, -h, y + .1, -.02, wall], [h, y, -.5, 1.6, y + .1, -.02, wall]); W.push([-h - .06, y, -.02, -h, y + .1, .02, rim], [h, y, -.02, h + .06, y + .1, .02, rim]); }
      else W.push([-1.6, y, -.5, 1.6, y + .1, -.02, wall]); }
    W.push([-1.7, 2.6, -.55, 1.7, 2.75, 0, 0x3d434b], [-1.7, 0, -.55, -1.6, 2.6, 0, 0x3d434b], [1.6, 0, -.55, 1.7, 2.6, 0, 0x3d434b]);
    // the inside: a dark drum behind the opening, a shelf of deposit boxes at its back
    W.push([-R, VAULT.cy - R, -1.4, R, VAULT.cy + R, -1.38, 0x0b0d10], [-.5, .5, -1.38, .5, 1.1, -1.3, 0x6a5a3a]);
    return boxesGeometry(THREE, W);
  });
}
// the door alone, in the hinge's frame: the hinge's axis at the origin, the door's face on z = 0, its free edge out along +x
export function vaultDoorGeometry(THREE) {
  return memo('vaultDoor', () => { const B = [], R = VAULT.r, off = -VAULT.hinge;
    for (let y = -R; y < R; y += .06) { const h = Math.sqrt(Math.max(0, R * R - (y + .03) ** 2)); B.push([off - h, VAULT.cy + y, -VAULT.thick, off + h, VAULT.cy + y + .06, 0, Math.abs(y) % .24 < .06 ? 0xa9b0b8 : 0x9aa1aa]); }
    // the wheel: a 0.2 m ring of spokes 0.12 m off the face, its hub; the hinge's two knuckles
    const wc = [off, VAULT.cy - .1]; for (let a = 0; a < 8; a++) { const c = Math.cos(a * Math.PI / 4) * .2, s = Math.sin(a * Math.PI / 4) * .2; B.push([wc[0] + c - .02, wc[1] + s - .02, .1, wc[0] + c + .02, wc[1] + s + .02, .14, 0xd6dbe1]); }
    B.push([wc[0] - .2, wc[1] - .012, .1, wc[0] + .2, wc[1] + .012, .12, 0xc0c6cd], [wc[0] - .012, wc[1] - .2, .1, wc[0] + .012, wc[1] + .2, .12, 0xc0c6cd], [wc[0] - .04, wc[1] - .04, 0, wc[0] + .04, wc[1] + .04, .14, 0x7a8089]);
    B.push([-.06, VAULT.cy + .3, -.2, .06, VAULT.cy + .5, .02, 0x4a4f57], [-.06, VAULT.cy - .5, -.2, .06, VAULT.cy - .3, .02, 0x4a4f57]);
    return boxesGeometry(THREE, B); });
}
// ── the docks' container (its doors open at +z, the run's agent works at its mouth), 6.1 × 2.6 × 2.4 m, ribbed
export function containerGeometry(THREE) {
  return memo('container', () => { const B = [], L = 6.1, W = 2.4, H = 2.6, red = 0x9c3b2b, dark = 0x6e271c;
    for (let x = -L / 2; x < L / 2 - .01; x += .2) { const c = Math.round(x / .2) % 2 ? red : dark; B.push([x, 0, -W / 2, x + .2, H, -W / 2 + .05, c], [x, 0, W / 2 - .05, x + .2, H, W / 2, c]); }
    B.push([-L / 2, H - .06, -W / 2, L / 2, H, W / 2, dark], [-L / 2, 0, -W / 2, L / 2, .08, W / 2, 0x3a2f28], [-L / 2, 0, -W / 2, -L / 2 + .05, H, W / 2, red]);
    // the open doors swung back along the sides, the boxes stacked inside toward the mouth
    B.push([L / 2, 0, W / 2, L / 2 + .05, H, W / 2 + 1.15, red], [L / 2, 0, -W / 2 - 1.15, L / 2 + .05, H, -W / 2, red]);
    const bx = [[1.6, 0, -.7], [1.6, 0, .1], [1.6, .55, -.3], [2.25, 0, -.6], [.95, 0, .5], [.95, .55, .5], [.95, 0, -.6]];
    for (const [x, y, z] of bx) B.push([x, .08 + y, z, x + .55, .08 + y + .55, z + .5, (x * 7 + z * 3) % 2 > 1 ? 0xb08a55 : 0x9c7746]);
    return boxesGeometry(THREE, B); });
}
export function moundGeometry(THREE) {
  return memo('mound', () => { const B = []; for (let k = 0; k < 4; k++) { const r = .55 - k * .12; B.push([-r, k * .07, -r * .8, r, (k + 1) * .07, r * .8, k % 2 ? 0x5a4630 : 0x4b3a27]); }
    B.push([-.25, 0, .55, .25, .02, .95, 0x2a2018]); return boxesGeometry(THREE, B); });
}
export function packageGeometry(THREE) {
  return memo('package', () => boxesGeometry(THREE, [[-.22, 0, -.15, .22, .2, .15, 0x4f5a34], [-.23, .07, -.16, .23, .1, .16, 0xc9b98a], [-.03, 0, -.16, .03, .21, .16, 0xc9b98a]]));
}
export function pileGeometry(THREE, kind = 'scrap') {
  return memo('pile:' + kind, () => { const B = [], c = kind === 'scrap' ? [0x6d6a66, 0x8a5a3a, 0x4d5560, 0x9a9488] : [0x22252a, 0x3b3f46, 0xa58a5c, 0x2c3a2e];
    const at = [[-.5, 0, -.3, .5], [.2, 0, -.4, .45], [-.1, .3, -.2, .4], [.5, 0, .1, .35], [-.6, 0, .25, .3], [.05, .55, -.15, .3]];
    at.forEach(([x, y, z, s], k) => B.push([x - s / 2, y, z - s / 2, x + s / 2, y + s * (kind === 'scrap' ? .6 : .9), z + s / 2, c[k % c.length]]));
    if (kind === 'scrap') B.push([-.9, 0, -.05, .7, .06, .05, 0x8b8f96], [-.2, .02, .4, .9, .1, .48, 0x7a4c33]);
    return boxesGeometry(THREE, B); });
}
// a booth: the table's middle at the origin, the two seats ±0.8 m along z, each facing the table; the seat top 0.42 m, the back 1.05 m
export const BOOTH = { seat: .68, top: .42 };
export function boothGeometry(THREE) {
  return memo('booth', () => { const B = [], red = 0x9b2f35, chrome = 0xb9bec6;
    B.push([-.45, .72, -.32, .45, .76, .32, 0xdfd6c4], [-.04, 0, -.04, .04, .72, .04, chrome], [-.2, 0, -.2, .2, .03, .2, chrome]);
    for (const s of [1, -1]) { const z0 = s * .6, z1 = s * 1.2; B.push([-.6, 0, Math.min(z0, z1), .6, BOOTH.top, Math.max(z0, z1), red], [-.6, 0, s > 0 ? z1 - .14 : z1, .6, 1.05, s > 0 ? z1 : z1 + .14, red],
      [-.62, BOOTH.top - .03, Math.min(z0, z1), -.6, 1.05, Math.max(z0, z1), chrome], [.6, BOOTH.top - .03, Math.min(z0, z1), .62, 1.05, Math.max(z0, z1), chrome]); }
    return boxesGeometry(THREE, B); });
}
function merge(THREE, list) {
  const P = [], N = [], K = [], I = []; let o = 0;
  for (const g of list) { P.push(...g.attributes.position.array); N.push(...g.attributes.normal.array); K.push(...g.attributes.color.array); for (const i of g.index.array) I.push(i + o); o += g.attributes.position.count; }
  return finish(THREE, P, N, K, I);
}
// a sedan along x (its nose at +x), its middle at the origin; the driver's door (on +z) open 75°: the doorway at x 0.1…1.0, z 0.9
export const CAR = { door: [.45, .9], seat: .45 };
export function carGeometry(THREE) {
  return memo('car', () => { const B = [], paint = 0x2f5d8a, dark = 0x1b2633, glass = 0x9fc3d8;
    B.push([-2.2, .3, -.9, 2.2, .85, .9, paint], [-1.1, .85, -.82, 1.0, 1.4, .82, glass], [-1.05, 1.36, -.8, .95, 1.44, .8, paint]);
    B.push([1.0, .85, -.8, 1.15, 1.36, .8, paint], [-1.25, .85, -.8, -1.1, 1.36, .8, paint]);
    // (the doorway: the body's side cut away there, the seat inside, the door swung out from its front hinge)
    B.push([.1, .3, .86, 1.0, .85, .91, 0x15181d], [.15, .3, .2, .95, CAR.seat, .85, 0x3a3027]);
    const hx = 1.0, hz = .9, L = .9, ang = 1.3; for (let k = 0; k < 6; k++) { const u = (k + .5) / 6 * L, x = hx - Math.cos(ang) * u, z = hz + Math.sin(ang) * u; B.push([x - .08, .35, z - .05, x + .08, 1.3, z + .05, k > 2 ? glass : paint]); }
    for (const [x, z] of [[1.4, .85], [1.4, -.95], [-1.4, .85], [-1.4, -.95]]) B.push([x - .33, 0, z, x + .33, .62, z + .1, dark]);
    B.push([2.2, .45, -.7, 2.24, .6, -.4, 0xfff4c8], [2.2, .45, .4, 2.24, .6, .7, 0xfff4c8], [-2.24, .45, -.7, -2.2, .58, -.45, 0xb0242a], [-2.24, .45, .45, -2.2, .58, .7, 0xb0242a]);
    return boxesGeometry(THREE, B); });
}
