// HUMAN LAYER · ITEM ICONS · the models: one small voxel object per thing an agent can hold, stash, buy, install, craft, wear or earn.
// tools/bake-icons.mjs renders every entry here (and the worn traits, tools/traits.js) into the sprite atlas; icons.js reads the atlas.
// A NEW ITEM = one entry in MODELS + a re-bake. Keys are the sim's own (sim2/rules.mjs, see CATALOG.md); `src` says where the model came
// from: 'reused: …' (built by the city's own code) or 'new' (authored here, in the same voxel language).
// Grain: every model is authored at ~12–22 voxels across, so the voxels read the same size in every cell (the bake frames each model to
// its cell). Palette: the house range (simassets/lib.js K + style.js PAL): bold, flat, never pastel. Layers: 0 matte · 1 gloss · 2 metal ·
// 3 lit (unlit: goo, a hot coil, a strobe). Worker-safe: no three here.
import { K } from '../../simassets/lib.js';
import { security } from '../../simassets/index.js';
import { dog } from '../../props.js';

// ── a tiny unbounded voxel grid (negative coordinates fine); the bake reads `cells` → [x, y, z, colour, layer]
export class Vx {
  constructor() { this.m = new Map(); }
  static k(x, y, z) { return `${x},${y},${z}`; }
  set(x, y, z, c, l = 0) { if (c === undefined || c === null) return; x = Math.round(x); y = Math.round(y); z = Math.round(z); if (c < 0) this.m.delete(Vx.k(x, y, z)); else this.m.set(Vx.k(x, y, z), [x, y, z, c, l]); }
  del(x, y, z) { this.m.delete(Vx.k(Math.round(x), Math.round(y), Math.round(z))); }
  has(x, y, z) { return this.m.has(Vx.k(Math.round(x), Math.round(y), Math.round(z))); }
  box(x0, y0, z0, x1, y1, z1, c, l = 0) { for (let x = x0; x < x1; x++) for (let y = y0; y < y1; y++) for (let z = z0; z < z1; z++) this.set(x, y, z, typeof c === 'function' ? c(x, y, z) : c, l); }
  cyl(cx, cz, r, y0, y1, c, l = 0) { for (let y = y0; y < y1; y++) for (let x = Math.floor(cx - r - 1); x <= cx + r; x++) for (let z = Math.floor(cz - r - 1); z <= cz + r; z++)
    if (Math.hypot(x + .5 - cx, z + .5 - cz) <= r) this.set(x, y, z, typeof c === 'function' ? c(x, y, z) : c, l); }
  cylX(cy, cz, r, x0, x1, c, l = 0) { for (let x = x0; x < x1; x++) for (let y = Math.floor(cy - r - 1); y <= cy + r; y++) for (let z = Math.floor(cz - r - 1); z <= cz + r; z++)
    if (Math.hypot(y + .5 - cy, z + .5 - cz) <= r) this.set(x, y, z, typeof c === 'function' ? c(x, y, z) : c, l); }
  cylZ(cx, cy, r, z0, z1, c, l = 0) { for (let z = z0; z < z1; z++) for (let x = Math.floor(cx - r - 1); x <= cx + r; x++) for (let y = Math.floor(cy - r - 1); y <= cy + r; y++)
    if (Math.hypot(x + .5 - cx, y + .5 - cy) <= r) this.set(x, y, z, typeof c === 'function' ? c(x, y, z) : c, l); }
  line(x0, y0, z0, x1, y1, z1, c, l = 0) {   // 6-connected (every step shares a face), like simassets/lib.js line
    let p = [Math.round(x0), Math.round(y0), Math.round(z0)]; const q = [Math.round(x1), Math.round(y1), Math.round(z1)], n = Math.max(1, Math.abs(q[0] - p[0]) + Math.abs(q[1] - p[1]) + Math.abs(q[2] - p[2]));
    this.set(...p, c, l);
    for (let k = 0; k < n; k++) { let best = -1, bd = 1e9; const t = (k + 1) / n, tg = [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, z0 + (z1 - z0) * t];
      for (let a = 0; a < 3; a++) { if (p[a] === q[a]) continue; const tr = p.slice(); tr[a] += Math.sign(q[a] - p[a]); const d = Math.hypot(tr[0] - tg[0], tr[1] - tg[1], tr[2] - tg[2]); if (d < bd) { bd = d; best = a; } }
      if (best < 0) break; p[best] += Math.sign(q[best] - p[best]); this.set(...p, c, l); } }
  // a pixel bitmap on the x–y plane (row 0 = top), extruded z0…z1: pal maps a character to a colour (or [colour, layer])
  bmp(rows, pal, x0, ytop, z0, z1) { rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) { const p = pal[r[i]]; if (p === undefined) continue; const [c, l] = Array.isArray(p) ? p : [p, 0]; for (let z = z0; z < z1; z++) this.set(x0 + i, ytop - j, z, c, l); } }); }
  get cells() { return [...this.m.values()]; }
}
// a city Vol (vox.js: simassets, props) → cells
export function fromVol(V) { const out = [], { nx, ny, nz, sxz, d, pal, lay } = V;
  for (let y = 0; y < ny; y++) for (let z = 0; z < nz; z++) for (let x = 0; x < nx; x++) { const i = d[x + z * nx + y * sxz]; if (i) out.push([x, y, z, pal[i], lay[i]]); }
  return out; }
const hsh = (x, y, z) => { let h = Math.imul(x | 0, 73856093) ^ Math.imul(y | 0, 19349663) ^ Math.imul(z | 0, 83492791); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const INK = K.ink, W = K.white;

// ───────────────────────── ingredients (sim2 INGREDIENTS: where they're dug)
function leaf() {   // after simassets/piles.js bundle(): a leaf bundle tied with twine, loose leaves on top
  const V = new Vx(), G = [0x2fbf55, 0x25a748, 0x46d466, 0x1d8f3c], TW = 0xc9a36b;
  V.cylX(4, 4, 3.6, 0, 14, (x, y, z) => (x === 3 || x === 10) ? TW : G[(hsh(x >> 1, y, z) * 4) | 0]);
  for (const ex of [-1, 14]) for (let y = 1; y <= 7; y++) for (let z = 1; z <= 7; z++) if (Math.hypot(y + .5 - 4, z + .5 - 4) <= 3.6 && hsh(ex, y, z) > .35) V.set(ex, y, z, G[(y + z) & 3]);
  for (const ex of [-2, 15]) for (const [y, z] of [[4, 4], [5, 3], [3, 5]]) if (hsh(ex, y, z) > .3) V.set(ex, y, z, G[2]);
  V.box(5, 8, 3, 9, 9, 6, G[2]); V.set(6, 9, 4, G[0]); V.set(7, 9, 4, G[0]); V.set(8, 9, 5, G[3]);   // a loose sprig on top
  return V; }
function salts() {   // after piles.js drum(): the dead mall's blue drum, white band, open and heaped with pink-and-white crystals
  const V = new Vx(); V.cyl(5, 5, 5, 0, 9, (x, y) => (y === 3 || y === 4) ? W : K.cobalt);
  V.cyl(5, 5, 5, 8, 9, 0x1c3aa8); for (let k = 0; k < 4; k++) V.cyl(5, 5, 4.4 - k * 1.25, 9 + k, 10 + k, (x, y, z) => hsh(x, y, z) > .55 ? K.pink : W, 1);
  return V; }
function goo() {   // after piles.js barrel(): a yellow hazard can, the ink stripe band, brimming lime goo running down the front
  const V = new Vx(); V.cyl(5, 5, 4.6, 0, 10, (x, y, z) => (y === 4 || y === 5) ? (((x + z + y) & 1) ? INK : K.yellow) : K.yellow);
  V.cyl(5, 5, 4.6, 10, 11, K.gooD); V.cyl(5, 5, 3.6, 10, 11, K.goo, 3); V.set(5, 11, 5, K.goo, 3); V.set(4, 11, 6, K.goo, 3);
  for (const [x, y0, y1] of [[4, 6, 11], [6, 8, 11]]) for (let y = y0; y < y1; y++) V.set(x, y, 10, K.goo, 3);   // the drips (front face)
  V.box(3, 0, 10, 5, 1, 12, K.goo, 3);   // the puddle
  return V; }
// ───────────────────────── scrap parts (sim2 PARTS: the Heap)
function pipe() {   // a length of steel pipe with an elbow and a flange, a rust patch
  const V = new Vx(), S = K.steelL, SD = K.steel;
  V.cylX(3, 3, 2.4, 0, 12, (x, y, z) => (x === 0 || x === 1) ? SD : (x > 6 && x < 10 && hsh(x, y, z) > .55) ? K.rust : S, 2);   // (S = steelL: a pipe reads by its light)
  V.cyl(12.5, 3, 2.4, 1, 13, (x, y) => y >= 11 ? SD : S, 2); V.cylX(3, 3, 2.4, 10, 14, S, 2);   // the elbow, up
  V.cyl(12.5, 3, 3.3, 12, 13, SD, 2); V.cylX(3, 3, 3.3, 0, 1, SD, 2);                            // flanges
  V.cylX(3, 3, 1.1, 0, 1, INK); V.cyl(12.5, 3, 1.1, 12, 13, INK);                                 // the bore
  return V; }
function spring() {   // a coil spring: a 6-connected helix, flattened ends
  const V = new Vx(), R = 4, turns = 4.5, h = 14, n = 260; let last = null;
  for (let i = 0; i <= n; i++) { const t = i / n, a = t * turns * Math.PI * 2, y = t * h, p = [5 + Math.cos(a) * R, y, 5 + Math.sin(a) * R];
    if (last) V.line(...last, ...p, K.steelL, 2); last = p; }
  V.cyl(5, 5, 4.6, 0, 1, (x, y, z) => Math.hypot(x + .5 - 5, z + .5 - 5) > 3.2 ? K.steelL : undefined, 2);
  V.cyl(5, 5, 4.6, h, h + 1, (x, y, z) => Math.hypot(x + .5 - 5, z + .5 - 5) > 3.2 ? K.steelL : undefined, 2);
  return V; }
function grip() {   // a pistol grip off the Heap: a raked wooden block, ink checkering, a steel screw and the frame stub on top
  const V = new Vx(), WD = K.wood, WDD = K.woodD;
  for (let y = 0; y < 13; y++) { const s = Math.floor(y / 3); V.box(s, y, 0, s + 6, y + 1, 4, (x, yy, z) => (z === 3 && ((x + yy) & 1) && yy > 1 && yy < 11 && x > s && x < s + 5) ? WDD : WD); }
  V.box(4, 13, 0, 13, 15, 4, K.gun, 2); V.box(3, 0, 0, 7, 1, 4, WDD);                             // the frame stub, the butt
  V.set(Math.floor(6 / 3) + 3, 6, 4, K.steelL, 2);                                                  // the screw
  return V; }
// ───────────────────────── product (sim2 DRUGS): invented, city-flavoured; a different container for each so they read at 32 px
function temp() {   // TEMP (reckless, hot): a zip baggie, red-hot crystals heaped in the bottom, a red zip strip
  const V = new Vx(), BAG = 0xdff0ff, HOT = [0xff6a1a, 0xe8232a, 0xff9a3a, 0xc81a1a];
  for (let y = 0; y < 16; y++) { const w = y < 1 ? 1 : 0; V.box(w, y, 0, 13 - w, y + 1, 2, BAG, 1); }
  const top = x => 6 + Math.round(Math.sin(x * 1.3) * 1.2 + (x > 3 && x < 9 ? 1.5 : 0));
  for (let x = 1; x < 12; x++) for (let y = 1; y <= top(x); y++) { V.set(x, y, 2, HOT[(hsh(x, y, 2) * 4) | 0], 1); if (y < top(x) - 1) V.set(x, y, 1, HOT[(hsh(x, y, 1) * 4) | 0], 1); }
  for (const [x, y] of [[3, 9], [8, 10], [10, 8]]) V.set(x, y, 2, HOT[0], 1);                          // loose crystals up the film
  V.box(0, 12, 0, 13, 14, 3, K.red, 1); V.box(0, 14, 0, 13, 16, 2, BAG, 1);                             // the zip, the lip above it
  return V; }
function hallu() {   // HALLU (false rumours, one real secret): a dropper bottle of purple swirl, pink bulb, a label with an eye
  const V = new Vx(), GL = K.purple;
  V.cyl(4, 4, 4, 0, 10, (x, y, z) => (y >= 3 && y <= 6) ? (z > 5 ? 0xff9ad0 : 0xff9ad0) : ((hsh(x, y, z) > .78) ? K.pink : GL), 1);
  V.box(2, 4, 8, 7, 6, 9, W); V.set(4, 4, 8, INK); V.set(4, 5, 8, K.cyan, 1); V.set(3, 5, 8, INK); V.set(5, 5, 8, INK);   // the label's eye
  V.cyl(4, 4, 2, 10, 12, INK); V.cyl(4, 4, 2.6, 12, 17, K.pink, 1); V.cyl(4, 4, 1.7, 17, 18, K.pink, 1);                    // neck, rubber bulb
  return V; }
function sudo() {   // SUDO (takes the next message as an order): a squat black jar, a terminal prompt label in lime, a steel lid
  const V = new Vx(); V.box(0, 0, 0, 12, 10, 12, 0x2b2d3a, 1); V.box(1, 10, 1, 11, 11, 11, 0x2a2a30);
  V.box(-1, 11, -1, 13, 14, 13, K.steelL, 2); V.box(0, 14, 0, 12, 15, 12, K.steel, 2);
  V.box(1, 2, 12, 11, 9, 13, K.lime); V.bmp(['x.....', '.x....', '..x...', '.x....', 'x..xxx'], { x: INK }, 3, 7, 13, 14);   // >_
  return V; }
function truth() {   // TRUTH (VERIFIED, real thoughts): a blister card of cyan-and-white capsules, a check mark across the top
  const V = new Vx(); V.box(0, 0, 0, 13, 17, 1, W); V.box(0, 0, -1, 13, 17, 0, 0xdfe2e8);
  V.bmp(['......x', '.....x.', 'x...x..', '.x.x...', '..x....'], { x: [K.cyan, 1] }, 3, 16, 1, 2);
  for (const cx of [2, 7]) for (const cy of [2, 6]) { V.box(cx, cy, 1, cx + 4, cy + 3, 2, 0xc9e8f2, 1); V.box(cx + 1, cy + 1, 2, cx + 2, cy + 2, 3, K.cyan, 1); V.box(cx + 2, cy + 1, 2, cx + 3, cy + 2, 3, W, 1); }
  return V; }
function clear() {   // CLEAR (heat off, memory wiped): a slim glass vial of ice-clear liquid, a white stopper, a white tape label
  const V = new Vx(); V.cyl(3, 3, 2.7, 0, 13, (x, y) => y < 9 ? 0xbff6ff : 0x7fd9ff, 1); V.cyl(3, 3, 2.7, 0, 1, 0x7fd9ff, 1);
  V.cyl(3, 3, 3, 13, 17, W); V.cyl(3, 3, 3.4, 16, 17, 0xdfe2e8);
  V.box(1, 4, 5, 6, 7, 6, W); V.set(2, 5, 6, K.cyan, 1); V.set(4, 5, 6, K.cyan, 1);                  // the label
  V.set(2, 10, 5, K.glint, 1); V.set(2, 11, 5, K.glint, 1);                                            // a glint
  return V; }
function firewall() {   // FIREWALL (immune, refuses deals): a round pill tin, its lid a brick wall
  const V = new Vx(); V.cyl(7, 7, 7, 0, 4, K.steel, 2); V.cyl(7, 7, 7.3, 4, 6, K.steelL, 2);
  V.cyl(7, 7, 6.2, 6, 7, (x, y, z) => ((z % 3 === 0) || ((x + (((z / 3) | 0) & 1) * 2) % 4 === 0)) ? 0x7a2a12 : (hsh(x, 1, z) > .5 ? K.orange : 0xe8462a));
  return V; }
// ───────────────────────── crafted from scrap (sim2 CRAFT) and the 24/7 Store (STORE)
function gun() {   // the smith's pipe gun (CRAFT.gun = pipe + spring + grip): a pipe barrel on a blocky receiver, the spring showing, a taped grip
  const V = new Vx(), RC = K.steelD, S = K.steelL;
  V.box(7, 10, 1, 19, 12, 3, S, 2); V.box(18, 10, 1, 19, 12, 3, K.steel, 2); V.set(18, 11, 2, INK);       // the pipe barrel, its bore
  V.box(1, 8, 0, 9, 13, 4, RC, 2); V.box(0, 11, 0, 2, 14, 4, RC, 2);                                    // receiver, hammer
  for (let x = 2; x < 9; x++) V.set(x, 13, (x & 1) ? 1 : 2, K.yellow, 2);                               // the spring along the top
  for (let y = 0; y < 8; y++) { const s = Math.floor((7 - y) / 2.5); V.box(s, y, 0, s + 4, y + 1, 4, (y % 3 === 1) ? K.red : K.wood); }   // taped grip, raked back
  V.box(5, 5, 1, 6, 8, 3, INK); V.box(5, 5, 1, 10, 6, 3, INK); V.box(9, 6, 1, 10, 8, 3, INK); V.set(7, 7, 2, K.steelL, 2);   // trigger guard, trigger
  return V; }
function lockItem() {   // a padlock, after simassets/security.js padlock(): a gold body, a steel shackle, an ink keyhole
  const V = new Vx(); V.box(0, 0, 0, 12, 10, 5, K.gold, 2); V.box(0, 9, 0, 12, 10, 5, 0xf2d27a, 2);
  V.box(5, 3, 5, 7, 7, 6, INK); V.box(5, 2, 5, 7, 3, 6, INK);
  for (const x of [1, 2, 9, 10]) V.box(x, 10, 1, x + 1, 15, 4, K.steelL, 2); V.box(1, 15, 1, 11, 17, 4, K.steelL, 2); V.box(3, 10, 1, 9, 15, 4, -1);
  return V; }
function pick() {   // a pickaxe: an ash handle, a steel head with two points
  const V = new Vx(); for (let k = 0; k < 2; k++) V.line(2 + k, 0, 1, 10 + k, 16, 1, K.wood); V.box(1, 0, 0, 4, 2, 3, K.woodD);
  const H = [[0, 13], [1, 14], [2, 15], [3, 16], [4, 16], [5, 17], [6, 17], [7, 17], [8, 17], [9, 17], [10, 17], [11, 17], [12, 17], [13, 16], [14, 16], [15, 15], [16, 14], [17, 13]];
  for (const [x, y] of H) V.box(x, y - 1, 0, x + 1, y + 1, 3, (y >= 16 && x > 5 && x < 13) ? K.steelD : K.steelL, 2);
  V.box(9, 15, 0, 12, 18, 3, K.steelD, 2);
  return V; }
function stove() {   // a hotplate (CRAFT.stove; at home: 20 batches): white enamel, one coil glowing, a dented pot on the other
  const V = new Vx(); V.box(0, 0, 0, 18, 4, 11, W); V.box(0, 3, 0, 18, 4, 11, 0xdfe2e8);
  for (const x of [1, 15]) for (const z of [1, 8]) V.box(x, -1, z, x + 2, 0, z + 2, INK);
  V.cyl(5, 5, 3.6, 4, 5, (x, y, z) => { const d = Math.hypot(x + .5 - 5, z + .5 - 5); return d > 2.6 || (d > 1.2 && d < 1.9) ? K.ember : undefined; }, 3);
  for (const x of [3, 7, 11, 15]) { V.box(x, 1, 11, x + 2, 3, 12, INK); }
  V.cyl(13, 5, 4, 4, 10, (x, y, z) => y === 9 ? K.steelD : K.steel, 2); V.cyl(13, 5, 3, 9, 10, 0x6a3cff, 1); V.box(16, 8, 4, 20, 9, 6, INK);   // the pot, purple inside, its handle
  return V; }
function rig() {   // the rig (big-batch cooking: up to 4 sets per batch): a steel vat on a burner frame, a copper coil to a glass flask
  const V = new Vx(), F = K.steelD, CU = 0xd9843a;
  for (const [x, z] of [[0, 0], [15, 0], [0, 9], [15, 9]]) V.box(x, 0, z, x + 2, 6, z + 2, F, 2);
  V.box(0, 6, 0, 17, 7, 11, F, 2); V.cyl(8.5, 5.5, 2.4, 5, 6, K.ember, 3);
  V.cyl(8.5, 5.5, 5.5, 7, 15, (x, y) => (y === 7 || y === 14) ? K.steelD : K.steelL, 2); V.cyl(8.5, 5.5, 4.4, 14, 15, K.goo, 3);
  for (let i = 0; i <= 40; i++) { const t = i / 40, a = t * Math.PI * 5; V.set(Math.round(15 + Math.cos(a) * 2), Math.round(15 - t * 7), Math.round(5.5 + Math.sin(a) * 2), CU, 2); }
  V.line(13, 15, 5, 15, 15, 5, CU, 2);
  V.cyl(19, 5.5, 2.6, 0, 5, 0x9fe7ff, 1); V.cyl(19, 5.5, 1.6, 0, 3, K.goo, 3); V.cyl(19, 5.5, 1.2, 5, 8, 0x9fe7ff, 1);   // the flask
  return V; }
function alarm() {   // the alarm (STORE: installs at home; may trip on a burglar): a red bell on a white box, a blue strobe on top
  const V = new Vx(); V.box(0, 0, 0, 14, 14, 3, W); V.box(0, 0, 0, 14, 1, 3, 0xdfe2e8);
  V.cylZ(7, 7, 5.6, 3, 5, K.red, 1); V.cylZ(7, 7, 4.2, 5, 6, K.red, 1); V.cylZ(7, 7, 1.6, 6, 7, K.steelL, 2); V.box(6, 3, 6, 8, 5, 8, K.steelL, 2);
  V.box(4, 14, 0, 10, 17, 3, 0x2f9bff, 3); V.box(5, 17, 1, 9, 18, 2, 0x9fdcff, 3);
  return V; }
function kit() {   // a test kit (STORE: tests one stack, true drug + quality): an open white box, three reagent vials, a colour chart
  const V = new Vx(); V.box(0, 0, 0, 14, 5, 9, W); V.box(1, 1, 1, 13, 5, 8, -1); V.box(0, 5, 8, 14, 13, 9, W);   // the box, its lid up behind
  V.box(2, 7, 9, 12, 11, 10, 0xdfe2e8); [[3, K.red], [6, K.yellow], [9, K.cobalt]].forEach(([x, c]) => V.box(x, 8, 10, x + 2, 10, 11, c));   // the chart on the lid
  [[3, K.red], [6, K.yellow], [9, K.cobalt]].forEach(([x, c]) => { V.box(x, 1, 3, x + 2, 9, 5, 0xc9eef7, 1); V.box(x, 1, 3, x + 2, 5, 5, c, 1); V.box(x, 9, 3, x + 2, 10, 5, INK); });
  V.box(0, 3, 9, 14, 4, 10, K.cyan);   // a cyan stripe on the front
  return V; }
function cash() {   // credits (cr), after the cast's Big Face Wad (world/cast/fresh/held.js): two strapped bricks of notes, a gold bank strap
  const V = new Vx(), N = 0x8fbf78, ND = 0x5fa84a, E = 0xf0f4e4, BAND = K.gold;
  const brick = (x0, y0, z0, rot) => { const w = rot ? 7 : 14, d = rot ? 14 : 7;
    for (let y = 0; y < 4; y++) V.box(x0, y0 + y, z0, x0 + w, y0 + y + 1, z0 + d, (x, yy, z) => { const edge = rot ? (z === z0 || z === z0 + d - 1) : (x === x0 || x === x0 + w - 1); return edge ? ((yy & 1) ? E : N) : ((yy & 1) ? N : ND); });
    V.box(x0, y0 + 4, z0, x0 + w, y0 + 5, z0 + d, N);
    if (rot) V.box(x0 - 1 + 1, y0, z0 + 5, x0 + w, y0 + 5, z0 + 8, BAND); else V.box(x0 + 5, y0, z0, x0 + 8, y0 + 5, z0 + d, BAND);
    if (!rot) { V.box(x0 + 2, y0 + 5, z0 + 2, x0 + 4, y0 + 5 + 0, z0 + 5, N); V.set(x0 + 10, y0 + 5, z0 + 3, 0x2e6b22); V.set(x0 + 11, y0 + 5, z0 + 3, 0x2e6b22); V.set(x0 + 10, y0 + 5, z0 + 4, 0x2e6b22); } };
  brick(0, 0, 4, false); brick(4, 5, 2, false);
  V.bmp(['.xx', 'xx.', '.x.', '.xx', 'xx.'], { x: 0x2e6b22 }, 10, 9, 9, 10);   // $ on the top brick's front
  return V; }
function unknown() {   // the fallback: a taped cardboard box with a question mark
  const V = new Vx(), C = K.card, CD = K.cardD; V.box(0, 0, 0, 14, 12, 12, C); V.box(0, 11, 0, 14, 12, 12, CD); V.box(6, 0, 0, 8, 13, 12, 0xe8d39a); V.box(6, 12, 0, 8, 13, 12, 0xe8d39a);
  V.bmp(['xxx', '..x', '.xx', '...', '.x.'], { x: INK }, 2, 8, 12, 13);
  return V; }
// ───────────────────────── marks (trophies): a pin badge — an ink-rimmed coin, a coloured field, the emblem raised in relief
const EMBLEM = {
  founder: { field: K.red, rim: K.gold, rows: ['x...x...x', 'xx.xxx.xx', 'xxxxxxxxx', 'xxxxxxxxx', 'xxxxxxxxx', '.........', 'xxxxxxxxx'], c: K.gold },   // a crown
  ghost: { field: K.purple, rim: INK, rows: ['..xxxxx..', '.xxxxxxx.', 'xxoxxxoxx', 'xxoxxxoxx', 'xxxxxxxxx', 'xxxxxxxxx', 'xxxxxxxxx', 'x.xx.xx.x'], c: W, o: INK },   // a sheet ghost
  evicted: { field: K.orange, rim: INK, rows: ['....x....', '...xxx...', '..xxxxx..', '.xxxxxxx.', 'xoxxxxxox', '.xoxxxox.', '.xxoxox..', '.xxxoxxx.', '.xxoxoxx.', '.xoxxxox.'], c: W, o: INK },   // a house, boarded with an X
  rugger: { field: K.lime, rim: INK, rows: ['x.x.x.x.x', 'xxxxxxxxx', 'xoxxxoxxx', 'oxoxoxoxo', 'xxxoxxxox', 'xxxxxxxxx', 'x.x.x.x.x'], c: K.red, o: K.yellow },   // a rug, fringed (pulled out from under the crew)
  booked: { field: K.cobalt, rim: INK, rows: ['.xxx...xxx.', 'x...x.x...x', 'x...xxx...x', 'x...x.x...x', '.xxx...xxx.'], c: K.white, l: 0 },   // handcuffs
};
function badge(id) {
  const E = EMBLEM[id], V = new Vx(), R = 9;
  V.cylZ(0, 0, R + .2, 0, 2, E.rim, E.rim === K.gold ? 2 : 0); V.cylZ(0, 0, R - 1.2, 2, 3, E.field); V.cylZ(0, 0, R - 1.2, 1, 2, E.field);
  const w = E.rows[0].length, h = E.rows.length, x0 = -Math.floor(w / 2), yt = Math.floor(h / 2);
  V.bmp(E.rows, { x: [E.c, E.l ?? (E.c === K.gold ? 2 : 0)], ...(E.o ? { o: E.o } : {}) }, x0, yt - (h % 2 ? 0 : 1), 3, 4);
  V.box(-3, -R - 3, 0, 3, -R + 1, 1, E.rim === K.gold ? K.red : E.field); V.box(-3, -R - 4, 0, -1, -R - 3, 1, E.rim === K.gold ? K.red : E.field); V.box(1, -R - 4, 0, 3, -R - 3, 1, E.rim === K.gold ? K.red : E.field);   // the ribbon tails
  return V; }
// the iced watch (wrist · epic): a gold link band in a loop, a big iced face
function watch() {
  const V = new Vx(); for (let i = 0; i < 28; i++) { const a = i / 28 * Math.PI * 2, x = Math.round(Math.cos(a) * 6), y = Math.round(Math.sin(a) * 6); V.box(x, y, 0, x + 1, y + 1, 4, (i & 1) ? K.gold : 0xc9962a, 2); }
  V.cylZ(6.5, 0.5, 4.6, -1, 5, 0xe6f6ff, 1); V.cylZ(6.5, 0.5, 3.4, 5, 6, 0x9fdcff, 1); V.cylZ(6.5, 0.5, 4.6, 4, 5, K.gold, 2);
  V.set(6, 0, 6, INK); V.set(6, 1, 6, INK); V.set(6, 2, 6, INK); V.set(7, 0, 6, INK); V.set(8, 0, 6, INK);   // the hands
  for (const [x, y] of [[4, 3], [9, 3], [4, -2], [9, -2]]) V.set(x, y, 5, K.glint, 3);                         // the ice
  return V; }
// the bags (bag slot): the cast draws a crossbody as a strap across the chest and a duffel as a fist-sized lump; as objects they need their shape
function crossbody() {   // a crossbody pouch: red nylon, a zip with a pull, a buckle, the strap looping up
  const V = new Vx(), C = 0xe8232a, D = 0xb81c22; V.box(0, 0, 0, 12, 8, 4, C); V.box(0, 7, 0, 12, 8, 4, D); V.box(1, 6, 4, 11, 7, 5, K.steelL, 2); V.box(9, 4, 4, 11, 6, 5, K.steelL, 2);
  V.box(4, 2, 4, 8, 4, 5, INK); V.box(5, 2, 5, 7, 4, 6, K.yellow);   // the patch
  for (let i = 0; i <= 30; i++) { const a = Math.PI * i / 30, x = Math.round(6 - Math.cos(a) * 7), y = Math.round(8 + Math.sin(a) * 9); V.box(x, y, 1, x + 1, y + 1, 3, INK); }
  return V; }
function duffel() {   // a duffel: the cast's Bag Money Duffel colours (black nylon, orange ends), a white stripe, two handles
  const V = new Vx(), B = 0x2c2f3a, E = 0xee5a24; V.cylX(4, 4, 4.2, 0, 16, (x, y, z) => (x < 2 || x > 13) ? E : (y === 4 && z > 4) ? 0xf2f2f2 : B);
  for (const x of [5, 10]) { V.box(x, 8, 3, x + 1, 11, 5, INK); } V.box(5, 11, 3, 11, 12, 5, INK); V.box(4, 8, 7, 12, 9, 8, K.steelL, 2);   // handles, the zip
  return V; }
// dental grills (the sim's mouth traits: grill · gold · iced): the top row of teeth in an arch, worn metal
function grill(kind) {
  const V = new Vx(), C = { grill: K.steelL, gold: K.gold, iced: 0xe6f6ff }[kind], L = kind === 'iced' ? 1 : 2;
  for (let i = 0; i < 9; i++) { const a = (i / 8 - .5) * Math.PI * .9, x = Math.round(Math.sin(a) * 8), z = Math.round(Math.cos(a) * 5);
    V.box(x, 0, z, x + 2, 5, z + 2, C, L); V.box(x, 0, z, x + 2, 1, z + 2, kind === 'gold' ? 0xc9962a : kind === 'iced' ? K.cyan : K.steel, L);
    if (kind === 'iced' && (i & 1)) V.set(x, 3, z + 2, K.glint, 3); }
  V.box(-6, 4, -1, 8, 6, 1, kind === 'gold' ? 0xc9962a : K.steel, 2);   // the bar behind
  return V; }

// ───────────────────────── the registry
const R = (f, name, group, what, src = 'new') => ({ build: f, name, group, what, src });
const reusedVol = (f, name, group, what, src) => ({ build: () => { const V = f(); const v = new Vx(); for (const c of fromVol(V)) v.set(...c); return v; }, name, group, what, src });
export const MODELS = {
  // ingredients
  leaf: R(leaf, 'Leaf', 'ingredient', 'a bundle of leaf from the woods (cooking ingredient)', 'new, after simassets/piles.js bundle()'),
  salts: R(salts, 'Salts', 'ingredient', 'a drum of salts from the dead mall (cooking ingredient)', 'new, after simassets/piles.js drum()'),
  goo: R(goo, 'Goo', 'ingredient', 'a can of goo from the docks (cooking ingredient)', 'new, after simassets/piles.js barrel()'),
  // scrap parts
  pipe: R(pipe, 'Pipe', 'part', 'scrap pipe from the Heap (every recipe wants it)'),
  spring: R(spring, 'Spring', 'part', 'a scrap spring from the Heap'),
  grip: R(grip, 'Grip', 'part', 'a scrap grip from the Heap'),
  // product
  temp: R(temp, 'Temp', 'product', 'reckless: +3 decisions, +15% fight odds'),
  hallu: R(hallu, 'Hallu', 'product', 'sees rumours that may be false, and one real secret'),
  sudo: R(sudo, 'Sudo', 'product', 'treats the next message it reads as an order'),
  truth: R(truth, 'Truth', 'product', 'words marked VERIFIED, real thoughts shown'),
  clear: R(clear, 'Clear', 'product', 'heat −25, short-term memory wiped'),
  firewall: R(firewall, 'Firewall', 'product', 'robbers −20%, immune to SUDO and HALLU, refuses deals'),
  // crafted · store · installed
  gun: R(gun, 'Gun', 'crafted', 'a pipe gun (pipe + spring + grip): +20% fight odds, contraband'),
  lock: R(lockItem, 'Lock', 'security', 'a lock: burglary −25%, 4 days, a break-in wrecks it', 'new, after simassets/security.js padlock()'),
  door: reusedVol(() => security('door'), 'Steel door', 'security', 'a reinforced door: burglary −20%, 6 days', 'reused: simassets/security.js door'),
  safe: reusedVol(() => security('safe'), 'Safe', 'security', 'a safe: halves what a burglar takes from the stash, 8 days', 'reused: simassets/security.js safe'),
  dog: reusedVol(() => dog(1, 3, 'sit', 0).vol, 'Guard dog', 'security', 'a dog: burglary −35%, 5 days (Store, 25cr)', 'reused: props.js dog (sitting)'),
  camera: reusedVol(() => security('camera'), 'CCTV camera', 'security', 'a camera (lot security key cctv / camera: records a burglar; the city reads it, the sim has none yet)', 'reused: simassets/security.js camera'),
  alarm: R(alarm, 'Alarm', 'security', 'an alarm: may trip on a burglar and wake you, 7 days (Store, 18cr)'),
  pick: R(pick, 'Pick', 'tool', 'a pick: digs +1 an hour, wears out after 12 hours'),
  stove: R(stove, 'Stove', 'gear', 'a stove: cook at home, 20 batches'),
  rig: R(rig, 'Rig', 'gear', 'a rig: up to 4 ingredient sets per batch, 12 batches (Store, 150cr)'),
  kit: R(kit, 'Test kit', 'tool', 'tests one stack: the true drug, its quality, who sold it (Store, 3cr)'),
  cash: R(cash, 'Cash', 'cash', 'credits (cr)', 'new, after world/cast/fresh/held.js big_face_wad'),
  // marks (trophies)
  'mark:founder': R(() => badge('founder'), 'Founder', 'mark', 'founded a crew'),
  'mark:ghost': R(() => badge('ghost'), 'Ghost', 'mark', 'died'),
  'mark:evicted': R(() => badge('evicted'), 'Evicted', 'mark', 'evicted for missed rent'),
  'mark:rugger': R(() => badge('rugger'), 'Rugger', 'mark', 'rugged their crew (took the treasury)'),
  'mark:booked': R(() => badge('booked'), 'Booked', 'mark', 'arrested'),
  // mouth traits (the other worn traits are cut from the cast: tools/traits.js)
  grill: R(() => grill('grill'), 'Silver grill', 'trait', 'mouth · rare'),
  gold: R(() => grill('gold'), 'Gold grill', 'trait', 'mouth · epic'),
  iced: R(() => grill('iced'), 'Iced grill', 'trait', 'mouth · grail'),
  watch: R(watch, 'Iced watch', 'trait', 'wrist · epic'),
  crossbody: R(crossbody, 'Crossbody bag', 'trait', 'bag · common'),
  duffel: R(duffel, 'Duffel bag', 'trait', 'bag · rare'),
  // the fallback for any key without a model
  unknown: R(unknown, 'Unknown item', 'fallback', 'a key the atlas has no icon for'),
};
