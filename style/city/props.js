// Props: authored once in city voxels (origin at the base centre, facing +z), memoized, then stamped into block banks.
import { Vol, meshed, textMask, rasterMask } from './vox.js';
import { PAL, CV, hash, shade } from './style.js';
import { TOD } from './kit.js';
import { vehicleProp, bodyVol, byId as VEH } from './vehicles/index.js';
// pass 1d: every template carries a readable kind (the middle of every item id: i_j·group·KIND·n)
const KIND = { ac: 'ac', ant: 'antenna', bags: 'bags', bb: 'billboard', bed: 'planter-bed', bench: 'bench', bike: 'bike', bulk: 'bulkhead', can: 'trashcan', car: 'car', cart: 'cart', chair: 'chair', chim: 'chimney',
  cob: 'carOnBlocks', coop: 'coop', cop: 'copcar', couch: 'couch', crate: 'crate', dog: 'dog', dish: 'dish', dump: 'dumpster', grill: 'grill', hoop: 'hoop', hyd: 'hydrant', kpool: 'kiddie-pool', lamp: 'lamp', laun: 'laundry',
  mast: 'signal', nbox: 'newsbox', news: 'newsstand', obj: 'giant', pbox: 'planter', phone: 'phonebooth', pic: 'picnic', pig: 'pigeons', pole: 'barberpole', post: 'signal', pot: 'pot', rs: 'roofsign', sand: 'sandwich',
  shed: 'shed', sky: 'skylight', solar: 'solar', spk: 'speaker', steam: 'steam', stree: 'street-tree', tank: 'tank', tankv: 'tank', taxi: 'taxi', tent: 'tent', tires: 'tires', tree: 'tree', tub: 'hottub', umb: 'umbrella', vent: 'vent' };
const KEYS = Object.keys(KIND).sort((a, b) => b.length - a.length), kindOf = key => { const k = KEYS.find(p => key.startsWith(p)); return k ? KIND[k] : 'prop'; };
const memo = new Map(), M = (key, f) => { let b = memo.get(key); if (!b) { memo.set(key, b = f()); b.kind ??= kindOf(key); } return b; };
function pv(nx, ny, nz, cx = nx / 2, cz = nz / 2, ground = true) { return new Vol(nx, ny, nz, { s: CV, org: [-cx * CV, 0, -cz * CV], ground }); }
const GREEN = PAL.lamp;
const TM = new Map(); const tmask = s => { let m = TM.get(s); if (!m) TM.set(s, m = textMask(s)); return m; };
function text2(V, s, x0, ytop, z, c, l = 0, mirror = false, sc = 1) { const t = tmask(s); V.recNext(); for (let j = 0; j < 7; j++) for (let i = 0; i < t.w; i++) if (t.at(i, j)) for (let a = 0; a < sc; a++) for (let b = 0; b < sc; b++) { const x = x0 + (mirror ? (t.w - 1 - i) : i) * sc + a, y = ytop - j * sc - b; V.set(x, y, z, c, l); V.recN(s, x, y, z, 0, mirror ? -1 : 1); } return t.w * sc; }

export const lampPost = () => M('lamp' + TOD.night, () => { const V = pv(8, 62, 26, 4, 4);
  V.box(2, 0, 2, 7, 5, 7, GREEN); V.box(3, 5, 3, 6, 56, 6, GREEN); V.box(2, 20, 2, 7, 22, 7, GREEN);
  for (let z = 5; z < 20; z++) { const k = Math.round(Math.sin((z - 5) / 15 * 1.3) * 3); V.box(3, 55 + k, z, 6, 57 + k, z + 1, GREEN); }
  // (cleanup pass: the lamp's bulb sits flush in the underside of its head, 0.3 × 0.4 m and warm, seen only from below: the pale slab
  // that hung under the head read as a blown-out patch across the street at night)
  V.box(2, 57, 17, 7, 60, 25, GREEN); V.box(3, 57, 19, 6, 58, 23, 0xffe3a0, TOD.night ? 3 : 1); return meshed(V); });
function head(V, hx, y0, z0) { const Y = 0xffc21a; V.box(hx, y0, z0, hx + 6, y0 + 16, z0 + 5, Y); [[y0 + 12, 0xff2a2a, 3], [y0 + 7, 0x6a5a1a, 0], [y0 + 2, 0x2f5a3a, 0]].forEach(([y, c, l]) => { V.box(hx + 1, y, z0 + 5, hx + 5, y + 4, z0 + 6, c, l); V.box(hx + 1, y + 4, z0 + 5, hx + 5, y + 5, z0 + 7, PAL.ink); }); }
export const signalMast = () => M('mast', () => { const V = pv(40, 60, 12, 36, 6);
  V.box(34, 0, 3, 39, 4, 8, GREEN); V.box(35, 4, 4, 38, 58, 7, GREEN); V.box(8, 52, 4, 35, 55, 7, GREEN); for (let t = 0; t < 6; t++) V.box(34 - t * 2, 51 - t, 5, 35 - t * 2, 52 - t, 6, GREEN);
  head(V, 10, 36, 3); head(V, 22, 36, 3); return meshed(V); });
export const signalPost = () => M('post', () => { const V = pv(10, 50, 12, 5, 6); V.box(2, 0, 3, 7, 4, 8, GREEN); V.box(3, 4, 4, 6, 46, 7, GREEN); head(V, 2, 28, 7);
  V.box(2, 18, 0, 7, 25, 4, PAL.ink); V.box(3, 19, -1, 6, 24, 0, 0xff7a1a, 3); return meshed(V); });
export const hydrant = () => M('hyd', () => { const V = pv(10, 10, 10), R = PAL.red;
  V.box(2, 0, 2, 8, 1, 8, shade(R, .8)); V.box(3, 1, 3, 7, 7, 7, R); V.box(2, 5, 2, 8, 6, 8, R); V.box(3, 7, 3, 7, 8, 7, 0xf2f2f2); V.box(4, 8, 4, 6, 9, 6, 0xf2f2f2);
  V.box(1, 3, 4, 3, 5, 6, 0xf2f2f2); V.box(7, 3, 4, 9, 5, 6, 0xf2f2f2); V.box(4, 3, 7, 6, 5, 9, 0xf2f2f2); return meshed(V); });
export const bags = s0 => bagsV(((s0 % 4) + 4) % 4);   // (cleanup pass: one template per variant, built from the variant — it was built from
// whichever seed asked first, so a block's bags depended on the order the blocks were built in)
const bagsV = seed => M('bags' + seed, () => { const V = pv(24, 12, 12);
  for (let k = 0; k < 5; k++) { const x = 4 + hash(seed, k) * 16, z = 4 + hash(seed, k, 1) * 4, r = 2.8 + hash(seed, k, 2) * 1.4, c = hash(seed, k, 3) > .7 ? 0xe9e9e9 : 0x1f1f26, y = hash(seed, k, 4) > .6 ? 3 : 0;
    V.ell(x, y + r * .9, z, r, r * .9, r * .85, (xx, yy, zz) => hash(xx, yy, zz) > .9 ? shade(c, 1.25) : c, 1); } return meshed(V); });
export const tree = s0 => treeV(((s0 % 6) + 6) % 6);   // (cleanup pass: one template per variant, built from the variant — it was built from
// whichever seed asked first, so a block's tree depended on the order the blocks were built in)
const treeV = seed => M('tree' + seed, () => { const V = pv(40, 70, 40, 20, 20), G = [0x2fbf55, 0x25a748, 0x1d8f3c, 0x46d466];
  V.box(17, 0, 17, 23, 1, 23, 0x5a3a22); V.box(19, 0, 19, 21, 34, 21, 0x7a4a22);
  for (let bx = -4; bx <= 4; bx++) for (let by = 0; by <= 5; by++) for (let bz = -4; bz <= 4; bz++) { const r = (bx * bx) / 16 + ((by - 2.4) ** 2) / 7 + (bz * bz) / 16; if (r > 1 || (r > .72 && hash(seed, bx * 31 + by * 7, bz) > .55)) continue;
    V.box(20 + bx * 4 - 2, 30 + by * 4, 20 + bz * 4 - 2, 20 + bx * 4 + 2, 34 + by * 4, 20 + bz * 4 + 2, G[by >= 4 ? 3 : (hash(seed, bx, by * 5 + bz) * 3) | 0]); } return meshed(V); });
// pass 1d: the curbside tree — a tall trunk and a crown ±1.0 m wide from 3.6 m up, so it clears awnings, canopies and facades on a 2 m sidewalk
export const streetTree = s0 => streetTreeV(((s0 % 6) + 6) % 6);   // (cleanup pass: one template per variant, built from the variant — it was built from
// whichever seed asked first, so a block's streetTree depended on the order the blocks were built in)
const streetTreeV = seed => M('stree' + seed, () => { const V = pv(24, 64, 24, 12, 12), G = [0x2fbf55, 0x25a748, 0x1d8f3c, 0x46d466];
  V.box(9, 0, 9, 15, 1, 15, 0x5a3a22); V.box(11, 0, 11, 13, 40, 13, 0x7a4a22);
  for (let bx = -2; bx <= 2; bx++) for (let by = 0; by <= 5; by++) for (let bz = -2; bz <= 2; bz++) { const r = (bx * bx) / 5.2 + ((by - 2.4) ** 2) / 7 + (bz * bz) / 5.2; if (r > 1 || (r > .72 && hash(seed, bx * 31 + by * 7, bz) > .55)) continue;
    V.box(12 + bx * 4 - 2, 36 + by * 4, 12 + bz * 4 - 2, 12 + bx * 4 + 2, 40 + by * 4, 12 + bz * 4 + 2, G[by >= 4 ? 3 : (hash(seed, bx, by * 5 + bz) * 3) | 0]); } return meshed(V); });
export const newsstand = () => M('news', () => { const V = pv(24, 30, 18), G = PAL.green;
  V.box(0, 0, 0, 24, 26, 16, G); V.clear(2, 7, 4, 22, 23, 17); V.box(1, 0, 14, 23, 7, 16, 0xf7f7f2); V.box(-1, 26, -1, 25, 28, 19, shade(G, .8));
  V.box(0, 18, 16, 24, 27, 17, PAL.red); text2(V, 'NEWS', 0, 25, 17, PAL.white);   // pass 1d: the red band is as tall and as wide as its word
  for (let r = 0; r < 3; r++) for (let k = 0; k < 5; k++) { const x = 3 + k * 3.6, y = 9 + r * 5; V.box(x, y, 4, x + 3, y + 4, 6, [0xff4fa3, 0xffe23a, 0x2f5bff, 0xffffff, 0xff7a1a, 0x6cff4a, 0xe8232a][(r * 5 + k) % 7]); }
  return meshed(V); });
export const phoneBooth = () => M('phone', () => { const V = pv(10, 24, 10); V.box(0, 0, 0, 10, 22, 10, 0xc9ced6); V.clear(1, 2, 2, 9, 19, 11); V.box(0, 19, 0, 10, 24, 10, 0x2f5bff);
  V.box(3, 9, 1, 7, 15, 3, 0x3a3a42, 2); V.box(6, 11, 3, 7, 15, 4, PAL.ink); for (let x = 1; x < 9; x += 2) V.box(x, 21, 10, x + 1, 23, 11, PAL.white); return meshed(V); });
export const bench = () => M('bench', () => { const V = pv(20, 8, 7); V.box(0, 4, 0, 20, 5, 5, 0x2f7a3a); V.box(0, 5, 5, 20, 8, 6, 0x2f7a3a); for (const x of [1, 17]) V.box(x, 0, 1, x + 2, 4, 5, PAL.iron); return meshed(V); });
export const milkCrate = c => M('crate' + c, () => { const V = pv(5, 5, 5); V.box(0, 0, 0, 5, 5, 5, (x, y, z) => ((x + y + z) % 2 && y > 0 && y < 4) ? undefined : c); return meshed(V); });
export const steamStack = () => M('steam', () => { const V = pv(12, 40, 12, 6, 6);
  for (let y = 0; y < 24; y++) for (let x = -4; x < 4; x++) for (let z = -4; z < 4; z++) if (Math.hypot(x + .5, z + .5) < 3.8) V.set(6 + x, y, 6 + z, (y >> 2) & 1 ? 0xffffff : 0xff6a1a);
  for (let k = 0; k < 5; k++) V.ell(6 + hash(k) * 2 - 1, 27 + k * 3, 6 + hash(k, 1) * 2 - 1, 2.4 + k * .5, 1.8 + k * .3, 2.4 + k * .5, 0xf4f8ff); return meshed(V); });
export const tank = () => M('tank', () => { const V = pv(26, 52, 26, 13, 13), tr = 11;
  for (const [x, z] of [[-8, -8], [7, -8], [-8, 7], [7, 7]]) V.box(13 + x, 0, 13 + z, 13 + x + 2, 14, 13 + z + 2, PAL.iron);
  V.box(3, 14, 3, 23, 15, 23, PAL.iron);
  for (let y = 15; y < 40; y++) for (let x = -tr; x <= tr; x++) for (let z = -tr; z <= tr; z++) if (Math.hypot(x + .5, z + .5) <= tr) V.set(13 + x, y, 13 + z, (y - 15) % 7 === 0 ? PAL.woodD : ((x * 7 + z * 3 + 99) % 5 === 0 ? shade(PAL.wood, .88) : PAL.wood));
  for (let k = 0; k < 8; k++) for (let x = -tr; x <= tr; x++) for (let z = -tr; z <= tr; z++) if (Math.hypot(x + .5, z + .5) <= tr - k * 1.5) V.set(13 + x, 40 + k, 13 + z, PAL.woodD);
  return meshed(V); });
// stair bulkhead: neutral (pass 1c) — the tone varies with the roof it stands on (the first arg), never the wall colour
export const bulkhead = (roof, trim) => { const v = (hash(roof | 0, 23) * 4) | 0; return M('bulk' + v, () => { const V = pv(24, 26, 20), c = [0xd6d2ca, 0xc4c0b8, 0xb0aca5, 0xe4e1da][v];
  V.box(0, 0, 0, 24, 22, 20, c); V.box(-1, 22, -1, 25, 24, 21, shade(c, .78)); V.box(8, 0, 20, 16, 18, 21, 0x3a3a42); V.box(9, 18, 20, 15, 19, 22, shade(c, .7)); return meshed(V); }); };
export const acBox = () => M('ac', () => { const V = pv(14, 10, 10); V.box(0, 0, 0, 14, 8, 10, 0xe6e6ea); V.box(1, 8, 1, 13, 9, 9, 0xbdbdc4); V.box(3, 9, 3, 11, 10, 7, 0x9a9aa2); return meshed(V); });

// ── oversized shop objects (the per-block big gag): hang off a bracket, perpendicular to the facade (local +x = out of the wall)
export const giantObject = kind => M('obj' + kind, () => { const V = pv(40, 34, 6, 0, 3, false), B = (x0, y0, x1, y1, c, z0 = 1, z1 = 5) => V.box(x0, y0, z0, x1, y1, z1, c);
  V.box(0, 28, 2, 18, 30, 4, PAL.iron);                                                               // bracket (the hanger is added last)
  const cx = 16, cy = 12;
  if (kind === 'slice') { for (let j = 0; j < 22; j++) { const h = Math.round((22 - j) * .42); for (let i = -h; i <= h; i++) V.box(cx + i, 23 - j, 1, cx + i + 1, 24 - j, 5, j < 3 ? 0xc9782a : (((i + 40) * 7 + j * 5) % 9 === 0 && j < 18 ? 0xd7141a : 0xffd23a)); } }
  else if (kind === 'donut') { for (let x = -11; x <= 11; x++) for (let y = -11; y <= 11; y++) { const r = Math.hypot(x, y); if (r > 11 || r < 4) continue; B(cx + x, cy + y, cx + x + 1, cy + y + 1, r > 9.5 || y < -3 ? 0xd9a05b : ((x * 7 + y * 13) % 11 === 0 ? [0xffe23a, 0x2de2e6, 0xffffff][(x + y + 30) % 3] : 0xff7ab6)); } }
  else if (kind === 'cup') { B(cx - 8, 2, cx + 8, 20, 0xf7f7f2); B(cx - 8, 8, cx + 8, 14, 0x8b4a24); B(cx + 8, 8, cx + 12, 16, 0xf7f7f2); B(cx + 9, 10, cx + 11, 14, -1); B(cx - 9, 20, cx + 9, 22, 0x17171b); for (let k = 0; k < 3; k++) B(cx - 4 + k * 4, 22, cx - 2 + k * 4, 29 - (k & 1) * 2, 0xe4f3ff); }   // pass 2: the steam rises off the lid (it floated)
  else if (kind === 'tooth') { const c = 0xf7f7f2; B(cx - 9, 8, cx + 9, 22, c); B(cx - 9, 0, cx - 3, 8, c); B(cx + 3, 0, cx + 9, 8, c); B(cx - 7, 22, cx - 2, 24, c); B(cx + 2, 22, cx + 7, 24, c); B(cx - 6, 16, cx - 3, 20, 0xffffff, 0, 6); }
  else if (kind === 'key') { for (let x = -7; x <= 7; x++) for (let y = -7; y <= 7; y++) { const r = Math.hypot(x, y); if (r <= 7 && r >= 3) B(cx - 8 + x, cy + 4 + y, cx - 7 + x, cy + 5 + y, PAL.gold); } B(cx - 1, cy + 3, cx + 16, cy + 6, PAL.gold); B(cx + 10, cy - 1, cx + 12, cy + 3, PAL.gold); B(cx + 14, cy - 2, cx + 16, cy + 3, PAL.gold); }
  else if (kind === 'sneaker') { B(cx - 12, 2, cx + 12, 4, 0xf7f7f2); B(cx - 12, 4, cx + 8, 12, 0xffffff); B(cx - 12, 12, cx - 2, 20, 0xffffff); B(cx - 6, 5, cx + 4, 10, PAL.red); B(cx - 12, 4, cx - 9, 20, PAL.ink); B(cx - 12, 0, cx + 12, 2, PAL.ink); }
  else if (kind === 'eye') { for (let x = -11; x <= 11; x++) for (let y = -11; y <= 11; y++) { const r = Math.hypot(x, y); if (r > 11) continue; B(cx + x, cy + y, cx + x + 1, cy + y + 1, r < 3 ? PAL.ink : r < 6.5 ? 0x2f9bff : 0xf7f7f2, r < 6.5 ? 0 : 1, r < 6.5 ? 6 : 5); } }
  else if (kind === 'burger') { B(cx - 11, 16, cx + 11, 22, 0xe0a040); B(cx - 9, 22, cx + 9, 24, 0xe0a040); B(cx - 12, 13, cx + 12, 16, 0x5cc93a); B(cx - 11, 9, cx + 11, 13, 0x6b3a1e); B(cx - 12, 7, cx + 12, 9, 0xffd21f); B(cx - 11, 2, cx + 11, 7, 0xe0a040); for (let k = 0; k < 6; k++) B(cx - 8 + k * 3, 22 + (k & 1), cx - 7 + k * 3, 23 + (k & 1), 0xfff0d0, 0, 6); }
  // pass 2: the hanger drops from the arm to the object's top, wherever the object's top is (the donut, cup, key, sneaker and eye
  // used to hang 0.1–0.4 m below a fixed 0.4 m hanger — two pieces, one floating)
  for (const hx of [10, 11, 9, 12, 8, 13, 7, 14, 15, 16, 17, 6, 5]) { let top = -1; for (let y = 27; y >= 0 && top < 0; y--) if (V.has(hx, y, 2) || V.has(hx, y, 3)) top = y; if (top >= 0) { V.box(hx, top + 1, 2, hx + 1, 28, 4, PAL.iron); break; } }
  return meshed(V); });

// ── the rooftop billboard (pass 3 · signage/boards.js): a design allocated per block (no repeat within ~6 blocks), the face in the
// lot's colourway (seed % BILLBOARDS, as far.js paints it far off), steel frame, catwalk, gooseneck lamps, a cut-out breaking the top.
// gen.js stands a 4× character on the catwalk when seed % 3 === 0: then the copy keeps to the left and the right is his backdrop.
import { roofBillboard } from './signage/index.js';
export const billboard = (seed, o = {}) => roofBillboard(seed, { giant: seed % 3 === 0, ...o }).bank;

// ── cars (CARS pass, 2026-09-28): the fleet registry in vehicles/ (twelve models, round spinning wheels, no hollow cabins). car / taxi /
// copCar / carOnBlocks keep their signatures, so every kit, hero and yard that calls them gets the new fleet; parked cars (street.js
// traffic) use the registry's district mix directly. car(seed): a sedan in one of eight colours, or a beater hatchback.
const vseed = s => Math.abs(Math.floor(+s || 0));
export const car = seed => { const k = vseed(seed) % 12; return M('car' + k, () => vehicleProp(k < 8 ? 'sedan' : 'beater', { variant: k < 8 ? k : k - 8, kind: 'car' })); };
export const taxi = () => M('taxi' + TOD.night, () => vehicleProp('taxi', { variant: 3, driver: true, night: TOD.night, kind: 'taxi' }));   // a driver waits in it; the roof sign is lit at night
export const copCar = () => M('cop' + TOD.night, () => vehicleProp('cruiser', { variant: 0, night: TOD.night, kind: 'copcar' }));             // the light bar is lit at night

// ═════════ pass 1b vocabulary: roof life, yard life, sidewalk clutter. All authored at base-centre, facing +z, memoized by variant.
const IRON = PAL.iron, WD = PAL.wood, WDD = PAL.woodD;
const cyl = (V, cx, cz, r, y0, y1, c, l = 0) => { for (let y = y0; y < y1; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) for (let z = Math.floor(cz - r); z <= cz + r; z++) if (Math.hypot(x + .5 - cx, z + .5 - cz) <= r) V.set(x, y, z, typeof c === 'function' ? c(x, y, z) : c, l); };
// water tanks: only on taller roofs; four variants (wood, painted steel + cone, tall stand + ladder, tagged)
export const tankV = v => M('tankv' + v, () => { v = v % 4; if (v === 0) return tank();
  const leg = v === 2 ? 26 : 12, r = v === 1 ? 9 : 10, V = pv(26, leg + 50, 26, 13, 13), body = v === 1 ? 0xaeb4ba : WD;
  for (const [x, z] of [[-8, -8], [7, -8], [-8, 7], [7, 7]]) V.box(13 + x, 0, 13 + z, 13 + x + 2, leg, 13 + z + 2, IRON); if (v === 2) for (let y = 4; y < leg; y += 7) { V.box(5, y, 5, 22, y + 1, 7, IRON); V.box(5, y, 20, 22, y + 1, 22, IRON); }
  V.box(3, leg, 3, 23, leg + 1, 23, IRON); const top = leg + 1 + (v === 1 ? 20 : 24);
  cyl(V, 13, 13, r, leg + 1, top, (x, y, z) => v === 1 ? ((y - leg) % 8 === 0 ? shade(body, .8) : body) : ((y - leg - 1) % 7 === 0 ? WDD : ((x * 7 + z * 3 + 99) % 5 === 0 ? shade(WD, .88) : WD)));
  if (v === 1) for (let k = 0; k < 9; k++) cyl(V, 13, 13, Math.max(1, r - k * 1.1), top + k, top + k + 1, shade(body, .85)); else for (let k = 0; k < 7; k++) cyl(V, 13, 13, Math.max(1, r - k * 1.6), top + k, top + k + 1, WDD);
  if (v === 2) for (let y = 0; y < top; y++) { V.set(12, y, 24, IRON); V.set(15, y, 24, IRON); if (y % 3 === 0) V.box(12, y, 24, 16, y + 1, 25, IRON); }
  if (v === 3) { const t = tmask('59'); for (let j = 0; j < 7; j++) for (let i = 0; i < t.w; i++) if (t.at(i, j)) { const x = 13 - (t.w >> 1) + i, y = top - 6 - j; for (let z = 25; z > 13; z--) if (V.has(x, y, z)) { V.set(x, y, z, 0xff4fa3); break; } } }   // pass 2: painted onto the curve (the letters floated off it)
  return meshed(V); });
export const dish = v => M('dish' + (v % 2), () => { const V = pv(16, 22, 16, 8, 8), c = v % 2 ? 0xf7f7f2 : 0xdfe6ee; V.box(7, 0, 7, 9, 15, 9, IRON); V.box(4, 0, 4, 12, 1, 12, IRON);   // pass 2: the pole reaches the dish
  for (let x = -6; x <= 6; x++) for (let y = -6; y <= 6; y++) { const r = Math.hypot(x, y); if (r <= 6.3) V.set(8 + x, 14 + y, 9 + Math.round(r * r * .06) - Math.round(y * .45), c); }
  V.box(7, 13, 10, 9, 15, 15, IRON); return meshed(V); });
export const antenna = v => M('ant' + (v % 3), () => { const h = 30 + (v % 3) * 12, V = pv(22, h + 2, 4, 11, 2); V.box(10, 0, 1, 12, h, 3, IRON);
  for (let k = 0; k < 3 + (v % 3); k++) { const y = h - 3 - k * 6, w = 10 - k * 2; V.box(11 - w, y, 1, 11 + w, y + 1, 3, IRON); } if (v % 3 === 2) V.box(10, h, 1, 12, h + 2, 3, PAL.red, 3); return meshed(V); });
export const vent = v => M('vent' + (v % 2), () => { const V = pv(8, 20, 8, 4, 4); if (v % 2) { cyl(V, 4, 4, 2.2, 0, 14, 0xc9ced6, 2); V.box(1, 14, 1, 7, 16, 7, 0xc9ced6, 2); V.box(2, 16, 2, 6, 17, 6, 0xc9ced6, 2); }
  else { V.box(1, 0, 1, 7, 12, 7, 0xc9ced6, 2); V.box(0, 12, 0, 8, 14, 8, IRON); } return meshed(V); });
export const chimney = c => M('chim' + c, () => { const V = pv(10, 26, 10); V.box(1, 0, 1, 9, 22, 9, (x, y, z) => (y % 4 === 0) ? shade(c, .82) : c); V.box(0, 22, 0, 10, 24, 10, shade(c, .7)); V.box(3, 24, 3, 7, 26, 7, IRON); return meshed(V); });
export const skylight = () => M('sky', () => { const V = pv(20, 8, 14); V.box(0, 0, 0, 20, 3, 14, PAL.white); for (let k = 0; k < 4; k++) V.box(1 + k, 3 + k, 1 + k, 19 - k, 4 + k, 13 - k, (x, y, z) => (x % 5 === 0) ? PAL.white : 0x9fd8ff, 1); return meshed(V); });
export const solar = () => M('solar', () => { const V = pv(34, 12, 18); for (let r = 0; r < 2; r++) for (let z = 0; z < 8; z++) { const y = 2 + Math.round(z * .8), z0 = r * 9 + z; V.box(0, y, z0, 34, y + 1, z0 + 1, (x) => (x % 7 === 0 || z === 0) ? 0xdfe6ee : 0x1f3f9a, 1); V.box(2, 0, z0, 3, y, z0 + 1, IRON); V.box(31, 0, z0, 32, y, z0 + 1, IRON); } return meshed(V); });
export const coop = () => M('coop', () => { const V = pv(26, 26, 16); for (const [x, z] of [[1, 1], [23, 1], [1, 13], [23, 13]]) V.box(x, 0, z, x + 2, 8, z + 2, WDD); V.box(0, 8, 0, 26, 22, 16, WD);
  V.box(2, 10, 15, 24, 20, 16, (x, y) => ((x + y) % 2) ? IRON : undefined); V.clear(2, 10, 14, 24, 20, 15); V.box(-1, 22, -1, 27, 24, 17, 0x6e6e76); V.box(4, 11, 12, 22, 12, 14, WDD); return meshed(V); });
// pigeons: a loose flock (grey-blue, white, one pink-footed) on a flat surface
export const pigeons = s0 => pigeonsV(((s0 % 5) + 5) % 5);   // (cleanup pass: one template per variant, built from the variant — it was built from
// whichever seed asked first, so a block's pigeons depended on the order the blocks were built in)
const pigeonsV = seed => M('pig' + seed, () => { const V = pv(40, 6, 14, 20, 7);
  for (let k = 0; k < 7; k++) { const x = 3 + ((hash(seed, k) * 34) | 0), z = 2 + ((hash(seed, k, 1) * 9) | 0), c = [0x8a93b8, 0x8a93b8, 0xf7f7f2, 0x6f7aa8][k % 4], d = hash(seed, k, 2) > .5 ? 1 : -1;
    V.box(x, 0, z, x + 3, 2, z + 2, c); V.set(x + (d > 0 ? 3 : -1), 2, z, c); V.set(x + (d > 0 ? 3 : -1), 3, z, c); V.set(x + (d > 0 ? 3 : -1), 3, z + 1, 0x2fbf8f); V.set(x + (d > 0 ? 4 : -2), 3, z, 0xffb400); }
  return meshed(V); });
export const laundry = s0 => laundryV(((s0 % 4) + 4) % 4);   // (cleanup pass: one template per variant, built from the variant — it was built from
// whichever seed asked first, so a block's laundry depended on the order the blocks were built in)
const laundryV = seed => M('laun' + seed, () => { const W = 44, V = pv(W, 26, 4, W / 2, 2); for (const x of [0, W - 2]) V.box(x, 0, 1, x + 2, 24, 3, IRON);
  for (let x = 2; x < W - 2; x++) V.set(x, 22 - Math.round(Math.sin((x - 2) / (W - 4) * Math.PI) * 2), 2, 0xf7f7f2);
  let x = 4; for (let k = 0; x < W - 8; k++) { const w = 4 + ((hash(seed, k) * 5) | 0), h = 5 + ((hash(seed, k, 1) * 7) | 0), c = [0xe8232a, 0xf7f7f2, 0x2f5bff, 0xffe23a, 0xff4fa3, 0x25b84c, 0x17171b][(hash(seed, k, 2) * 7) | 0], top = 21 - Math.round(Math.sin((x + w / 2 - 2) / (W - 4) * Math.PI) * 2);
    V.box(x, top - h, 1, x + w, top, 3, c); if (h > 8) V.box(x + 1, top - h - 2, 1, x + 2, top - h, 3, c); x += w + 1 + ((hash(seed, k, 3) * 3) | 0); }
  return meshed(V); });
export const hotTub = () => M('tub' + TOD.night, () => { const V = pv(24, 9, 24); cyl(V, 12, 12, 11.5, 0, 8, (x, y, z) => (Math.hypot(x + .5 - 12, z + .5 - 12) > 10 || y < 1) ? ((x + z) % 4 === 0 ? WDD : WD) : undefined);
  cyl(V, 12, 12, 10, 1, 6, 0x3fc8ff, TOD.night ? 3 : 1); for (let k = 0; k < 6; k++) V.set(6 + k * 2, 6, 10 + (k % 3), 0xe4f7ff, 1); V.box(-2, 0, 4, 1, 5, 12, WDD); return meshed(V); });
export const lawnChair = c => M('chair' + c, () => { const V = pv(8, 10, 12); for (let z = 0; z < 12; z++) V.box(1, z < 7 ? 3 : 3 + (z - 6), z, 7, (z < 7 ? 4 : 4 + (z - 6)), z + 1, (z & 1) ? c : 0xf7f7f2); for (const [x, z] of [[1, 1], [6, 1], [1, 9], [6, 9]]) V.box(x, 0, z, x + 1, 3, z + 1, 0xdfe6ee, 2); return meshed(V); });
export const umbrella = c => M('umb' + c, () => { const V = pv(26, 30, 26, 13, 13); V.box(12, 0, 12, 14, 26, 14, 0xf7f7f2); for (let k = 0; k < 5; k++) { const r = 12 - k * 2.4; cyl(V, 13, 13, r, 24 + k, 25 + k, (x, y, z) => ((Math.atan2(z - 13, x - 13) * 4 / Math.PI + 8) | 0) % 2 ? c : 0xf7f7f2); } return meshed(V); });
export const grill = () => M('grill', () => { const V = pv(10, 12, 8); V.box(1, 0, 1, 2, 7, 2, IRON); V.box(8, 0, 1, 9, 7, 2, IRON); V.box(1, 0, 6, 2, 7, 7, IRON); V.box(8, 0, 6, 9, 7, 7, IRON); V.box(0, 7, 0, 10, 10, 8, PAL.ink); V.box(1, 10, 1, 9, 11, 7, 0xff6a1a, 3); V.box(2, 11, 3, 4, 12, 5, 0x6b3a1e); V.box(6, 11, 2, 8, 12, 4, 0xd7141a); return meshed(V); });
export const planterBed = s0 => planterBedV(((s0 % 3) + 3) % 3);   // (cleanup pass: one template per variant, built from the variant — it was built from
// whichever seed asked first, so a block's planterBed depended on the order the blocks were built in)
const planterBedV = seed => M('bed' + seed, () => { const V = pv(26, 12, 10); V.box(0, 0, 0, 26, 5, 10, WD); V.box(1, 4, 1, 25, 5, 9, 0x6b3a1e);
  for (let x = 2; x < 24; x += 3) for (let z = 2; z < 8; z += 3) { const h = 2 + ((hash(seed, x, z) * 4) | 0); V.box(x, 5, z, x + 2, 5 + h, z + 2, [0x2fbf55, 0x46d466, 0x25a748][(x + z) % 3]); if (hash(seed, x, z + 9) > .6) V.set(x + (seed & 1), 5 + h, z, [0xe8232a, 0xffe23a, 0xff4fa3][(x >> 1) % 3]); } return meshed(V); });
// cleanup pass · DOGS: chunky toon dogs for yards, stoops and the walkers (peds.js), origin at the paws' centre, nose toward +z.
// breed 0 terrier · 1 lab · 2 dachshund · 3 poodle; coat 0 tan · 1 black · 2 white · 3 golden · 4 grey (a poodle's white, black or
// apricot); pose 'sit', or 'walk' with frame 0 / 1 (the legs change step: peds.js swaps the two as its walker strides)
const DOG_COATS = [[0xc98a4b, 0x7a4a24, 0xf2dcb4], [0x2a2622, 0x0f0d0c, 0x6a5a4e], [0xf2efe6, 0x9a8474, 0xe8c8b8], [0xe8b86a, 0xb07a34, 0xf7e2b8], [0x9a9aa6, 0x55555f, 0xd4d4dc]];   // [coat, dark (ears, paws), muzzle]
const POODLE_COATS = [[0xf7f5ee, 0xd9d4c8, 0xf7f5ee], [0x2a2622, 0x121010, 0x4a3e36], [0xe8a878, 0xc47a4a, 0xf2c8a4]];
const DOG_BREEDS = [{ G: 2, H: 3, L: 5, ear: 'up' }, { G: 3, H: 3, L: 6, ear: 'flop', snout: 2 }, { G: 1, H: 2, L: 7, ear: 'flop', snout: 2 }, { G: 3, H: 3, L: 5, ear: 'pom' }];
export const dog = (breed = 0, coat = 0, pose = 'walk', frame = 0) => M('dog' + (breed & 3) + (coat % 5) + pose[0] + (frame & 1), () => {
  const B = DOG_BREEDS[breed & 3], poodle = (breed & 3) === 3, [C, D, MZ] = poodle ? POODLE_COATS[coat % 3] : DOG_COATS[coat % 5], { G, H, L } = B, sn = B.snout || 1;
  const lum = (((C >> 16) & 255) * .3 + ((C >> 8) & 255) * .59 + (C & 255) * .11) / 255, EYE = lum < .3 ? 0xf7f7f2 : 0x17171b, INK = 0x17171b;
  const COL = [0xe8232a, 0x2f5bff, 0x25b84c, 0xffc21a, 0xff4fa3][(breed * 3 + coat) % 5], V = pv(7, 12, L + 8, 3.5, 3), X0 = 2, X1 = 5, z0 = 2;   // body x 2…4 (0.3 m wide), tail end at z 2
  const leg = (x, z, h) => { V.box(x, 1, z, x + 1, h, z + 1, C); V.set(x, 0, z, D); };
  // a head whose front face is at zf (exclusive), bottom at y: ears, eyes, a full-width muzzle with the nose on its tip, the collar under it
  const head = (y, zf) => { V.box(X0, y, zf - 3, X1, y + 3, zf, C); V.box(X0, y, zf, X1, y + 1, zf + sn, MZ); V.set(X0 + 1, y, zf + sn - 1, INK); V.set(X0, y + 1, zf - 1, EYE); V.set(X1 - 1, y + 1, zf - 1, EYE);
    if (B.ear === 'up') { V.set(X0, y + 3, zf - 3, D); V.set(X1 - 1, y + 3, zf - 3, D); } else if (B.ear === 'flop') { V.box(X0 - 1, y + 1, zf - 3, X0, y + 3, zf - 2, D); V.box(X1, y + 1, zf - 3, X1 + 1, y + 3, zf - 2, D); }
    else V.box(X0, y + 3, zf - 3, X1, y + 4, zf - 1, C);   // the poodle's topknot
    V.box(X0, y - 1, zf - 3, X1, y, zf - 1, COL); };
  if (pose === 'sit') {   // haunches on the ground, chest up on straight front legs, head high
    V.box(X0, 0, z0, X1, H, z0 + 3, C); V.box(X0, G, z0 + 2, X1, G + H + 1, z0 + L, C); leg(X0, z0 + L - 1, G); leg(X1 - 1, z0 + L - 1, G);
    V.set(X0, 0, z0 + 3, D); V.set(X1 - 1, 0, z0 + 3, D);   // the hind paws
    head(G + H + 1, z0 + L + 1); V.set(X0 + 1, 0, z0 - 1, poodle ? C : D); if (poodle || breed === 0) V.set(X0 + 1, 1, z0 - 1, C);   // the tail on the ground (a stub up for terrier and poodle)
  } else {   // walking: four legs, one diagonal pair a step ahead (frame swaps them)
    const f = frame & 1, fz = z0 + L - 1, bz = z0;
    leg(X0, fz - (f ? 0 : 1), G + 1); leg(X1 - 1, fz - (f ? 1 : 0), G + 1); leg(X0, bz + (f ? 1 : 0), G + 1); leg(X1 - 1, bz + (f ? 0 : 1), G + 1);
    V.box(X0, G, z0, X1, G + H, z0 + L, C); V.box(X0 + 1, G, z0 + 1, X1 - 1, G + 1, z0 + L - 1, MZ);   // body, pale belly
    if (poodle) { V.box(X0, G, z0, X1, G + H + 1, z0 + 2, C); }   // the puffed rump
    head(G + H - 1, z0 + L + 1);
    if (breed === 2) V.box(X0 + 1, G + 1, z0 - 2, X1 - 1, G + 2, z0, D); else { V.set(X0 + 1, G + H, z0 - 1, poodle ? C : D); V.set(X0 + 1, G + H + 1, z0 - 1, poodle ? C : D); }   // tail
  }
  return meshed(V); });
export const potPlant = v => M('pot' + (v % 3), () => { const V = pv(8, 16, 8); V.box(1, 0, 1, 7, 5, 7, [0xd9643a, 0xf7f7f2, 0x2f5bff][v % 3]); const h = 6 + (v % 3) * 3; V.box(3, 5, 3, 5, 5 + h, 5, 0x3a8a3a);
  for (let k = 0; k < 4; k++) V.box(1 + (k & 1) * 3, 4 + h - k * 2, 1 + (k >> 1) * 3, 4 + (k & 1) * 3, 6 + h - k * 2, 4 + (k >> 1) * 3, [0x2fbf55, 0x46d466][k & 1]); return meshed(V); });
export const tent = c => M('tent' + c, () => { const V = pv(22, 14, 26); for (let y = 0; y < 12; y++) { const w = Math.round(10 - y * .85); V.box(11 - w, y, 0, 11 + w, y + 1, 24, c); } V.clear(8, 0, 23, 14, 7, 25); V.box(8, 0, 22, 14, 7, 23, 0x2a2d38); return meshed(V); });
export const kiddiePool = () => M('kpool' + TOD.night, () => { const V = pv(22, 4, 22); cyl(V, 11, 11, 10.5, 0, 3, (x, y, z) => Math.hypot(x + .5 - 11, z + .5 - 11) > 9 ? 0xff4fa3 : (y < 2 ? 0x3fc8ff : undefined), 1); V.box(9, 2, 5, 13, 4, 8, 0xffe23a); return meshed(V); });
export const speaker = () => M('spk', () => { const V = pv(8, 16, 7); V.box(0, 0, 0, 8, 16, 7, PAL.ink); for (const [cy, r] of [[5, 2.6], [12, 1.6]]) for (let a = -3; a <= 3; a++) for (let c = -3; c <= 3; c++) if (Math.hypot(a, c) <= r) V.set(4 + a, cy + c, 7, a * a + c * c < 2 ? 0x9a9aa6 : 0x33333b); return meshed(V); });
export const roofSign = (text, bg, fg) => M('rs' + text + bg + TOD.night, () => { const t = tmask(text), W = t.w * 2 + 8, V = pv(W, 30, 6, W / 2, 3);
  for (const x of [3, W - 5]) V.box(x, 0, 2, x + 2, 12, 4, IRON); V.box(0, 12, 1, W, 30, 4, bg); text2(V, text, 4, 27, 4, fg, TOD.night ? 3 : 0, false, 2); text2(V, text, 4, 27, 0, fg, TOD.night ? 3 : 0, true, 2); return meshed(V); });
// ── sidewalk + yard clutter
export const trashCan = c => M('can' + c, () => { const V = pv(7, 10, 7); cyl(V, 3.5, 3.5, 3.2, 0, 8, (x, y) => y % 3 === 0 ? shade(c, .8) : c); cyl(V, 3.5, 3.5, 3.6, 8, 9, shade(c, .7)); V.box(3, 9, 3, 4, 10, 4, shade(c, .7)); return meshed(V); });
export const bike = c => M('bike' + c, () => { const V = pv(4, 12, 20, 2, 10); for (const zc of [4, 15]) for (let a = 0; a < 24; a++) { const t = a / 24 * Math.PI * 2; V.set(2, 4 + Math.round(Math.sin(t) * 3.6), zc + Math.round(Math.cos(t) * 3.6), 0x17171b); }
  for (let z = 4; z <= 15; z++) V.set(2, 5 + Math.round((z - 4) * .35), z, c); V.box(2, 5, 9, 3, 10, 10, c); V.box(1, 10, 8, 4, 11, 11, 0x17171b); V.box(2, 5, 15, 3, 11, 16, c); V.box(0, 11, 15, 5, 12, 16, 0x17171b); return meshed(V); });
export const planterBox = c => M('pbox' + c, () => { const V = pv(12, 16, 8); V.box(0, 0, 0, 12, 6, 8, c); V.box(1, 5, 1, 11, 6, 7, 0x6b3a1e);
  for (let k = 0; k < 6; k++) { const x = 1 + (k % 3) * 3.5, z = 1 + (k >> 1 & 1) * 3.5, h = 3 + (k * 7 % 5); V.box(x, 6, z, x + 3, 6 + h, z + 3, [0x2fbf55, 0x46d466, 0x25a748][k % 3]); } V.set(4, 12, 3, 0xff4fa3); V.set(8, 11, 4, 0xffe23a); return meshed(V); });
export const sandwich = (text, c) => M('sand' + text + c, () => { const t = tmask(text.slice(0, 6)), W = t.w + 4, S2 = .05, V = new Vol(W, 20, 10, { s: S2, org: [-W * S2 / 2, 0, -.25], ground: true });   // half-grain board: 0.35 letters
  V.box(0, 4, 4, W, 19, 6, c); for (const x of [0, W - 1]) V.box(x, 0, 3, x + 1, 4, 7, PAL.ink); V.box(0, 18, 4, W, 19, 6, PAL.ink); V.box(0, 4, 4, W, 5, 6, PAL.ink);
  for (const [z, mir] of [[6, false], [3, true]]) for (let j = 0; j < 7; j++) for (let i = 0; i < t.w; i++) if (t.at(i, j)) V.set(2 + (mir ? t.w - 1 - i : i), 15 - j, z, PAL.white);
  return meshed(V); });
export const barberPole = () => M('pole', () => { const V = pv(6, 22, 6); V.box(1, 0, 1, 5, 2, 5, PAL.white); cyl(V, 3, 3, 2, 2, 18, (x, y, z) => { const t = (Math.atan2(z - 3, x - 3) / (Math.PI * 2) + y / 8) % 1; const u = (t + 1) % 1; return u < .33 ? PAL.red : u < .5 ? PAL.white : u < .83 ? 0x2f5bff : PAL.white; }, TOD.night ? 3 : 1);
  V.box(1, 18, 1, 5, 20, 5, PAL.white); V.box(2, 20, 2, 4, 22, 4, 0xe7bd4a, 2); return meshed(V); });
export const dumpster = c => M('dump' + c, () => { const V = pv(20, 14, 12); V.box(0, 1, 0, 20, 11, 12, c); V.box(-1, 11, -1, 21, 12, 13, shade(c, .7)); V.box(1, 0, 1, 3, 1, 3, IRON); V.box(17, 0, 9, 19, 1, 11, IRON); V.box(2, 8, 12, 18, 9, 13, shade(c, .8)); V.box(4, 12, 3, 9, 14, 8, 0x1f1f26); return meshed(V); });
export const shed = (c, v) => M('shed' + c + (v & 1), () => { const V = pv(24, 30, 20); V.box(0, 0, 0, 24, 20, 20, (x, y, z) => (x % 4 === 0 && (z === 0 || z === 19)) ? shade(c, .85) : c);
  for (let k = 0; k < 7; k++) V.box(-1, 20 + k, (v & 1) ? k * 3 - 1 : 0, 25, 21 + k, 20 - k * 3 + ((v & 1) ? 0 : 0), (v & 1) ? 0x5d5e6b : PAL.white);
  V.box(8, 0, 20, 16, 16, 21, shade(c, .7)); V.set(14, 8, 21, PAL.gold); return meshed(V); });
export const hoop = () => M('hoop', () => { const V = pv(18, 44, 16, 9, 2); V.box(8, 0, 1, 10, 36, 3, IRON); V.box(8, 34, 3, 10, 36, 6, IRON); V.box(2, 30, 6, 16, 40, 7, PAL.white); V.box(6, 31, 7, 12, 36, 7 + 1, (x, y) => (x === 6 || x === 11 || y === 35 || y === 31) ? PAL.red : undefined);
  for (let a = 0; a < 16; a++) { const t = a / 16 * Math.PI * 2; V.set(9 + Math.round(Math.cos(t) * 2.6), 31, 10 + Math.round(Math.sin(t) * 2.6), 0xff6a1a, 2); } for (let y = 27; y < 31; y++) for (const [dx, dz] of [[-2, 0], [2, 0], [0, 2], [0, -2]]) if ((y + dx) % 2) V.set(9 + dx, y, 10 + dz, PAL.white); return meshed(V); });
export const picnic = c => M('pic' + c, () => { const V = pv(20, 8, 16); V.box(0, 6, 3, 20, 7, 13, c); V.box(0, 3, 0, 20, 4, 3, c); V.box(0, 3, 13, 20, 4, 16, c); for (const x of [2, 17]) { V.box(x, 0, 4, x + 1, 6, 5, shade(c, .7)); V.box(x, 0, 11, x + 1, 6, 12, shade(c, .7));
  V.box(x, 0, 1, x + 1, 3, 2, shade(c, .7)); V.box(x, 0, 14, x + 1, 3, 15, shade(c, .7)); } return meshed(V); });   // pass 2: the benches stand on legs
export const couch = c => M('couch' + c, () => { const V = pv(22, 10, 10); V.box(0, 1, 0, 22, 5, 9, c); V.box(0, 5, 7, 22, 10, 10, c); V.box(0, 5, 0, 3, 8, 9, shade(c, .85)); V.box(19, 5, 0, 22, 8, 9, shade(c, .85)); V.box(3, 5, 1, 11, 6, 7, shade(c, 1.12)); V.box(11, 5, 1, 19, 6, 7, shade(c, 1.12)); for (const x of [1, 20]) V.box(x, 0, 1, x + 1, 1, 8, PAL.woodD); V.box(12, 6, 4, 15, 8, 6, 0xffe23a); return meshed(V); });
export const tires = () => M('tires', () => { const V = pv(12, 12, 12); for (let k = 0; k < 3; k++) cyl(V, 6 + (k === 2 ? 1 : 0), 6, 5, k * 3, k * 3 + 3, (x, y, z) => Math.hypot(x + .5 - 6 - (k === 2 ? 1 : 0), z + .5 - 6) < 2.4 ? undefined : 0x1f1f26); return meshed(V); });
export const carOnBlocks = seed => { const v = vseed(seed) % 3; return M('cob' + v, () => {   // a beater stripped of its wheels, up on cinder blocks
  const B = bodyVol('beater', { variant: [0, 1, 4][v] }), V = new Vol(B.nx, B.ny + 2, B.nz, { s: CV, org: B.org, ground: true });
  for (let y = 0; y < B.ny; y++) for (let z = 0; z < B.nz; z++) for (let x = 0; x < B.nx; x++) { const k = B.d[x + z * B.nx + y * B.sxz]; if (k) V.set(x, y + 2, z, B.pal[k], B.lay[k]); }
  for (const z of VEH.beater.wz) for (const x of [5, 12]) V.box(x, 0, z - 2, x + 3, 5, z + 3, (xx, y) => y === 2 ? 0x8a8a96 : 0x9a9aa6);   // two blocks high, under the sills
  return meshed(V); }); };
export const newsBox = c => M('nbox' + c, () => { const V = pv(6, 12, 6); V.box(0, 0, 0, 6, 1, 6, IRON); V.box(1, 1, 1, 2, 5, 2, IRON); V.box(4, 1, 1, 5, 5, 2, IRON); V.box(0, 5, 0, 6, 12, 6, c); V.box(1, 8, 6, 5, 11, 7, 0x9fd8ff, 1); return meshed(V); });
export const cart = () => M('cart' + TOD.night, () => { const V = pv(20, 26, 12); V.box(0, 4, 0, 20, 14, 12, 0xdfe6ee, 2); V.box(1, 14, 1, 19, 15, 11, 0xc9ced6, 2); for (const [x, z] of [[1, 1], [17, 1], [1, 9], [17, 9]]) V.box(x, 0, z, x + 2, 4, z + 2, IRON);
  for (const x of [0, 19]) V.box(x, 14, 5, x + 1, 26, 7, IRON); V.box(0, 24, 0, 20, 26, 12, 0xffe23a); V.box(2, 5, 12, 18, 14, 13, 0xe8232a); text2(V, 'HOT', 5, 12, 13, PAL.white, TOD.night ? 3 : 0); return meshed(V); });   // pass 1d: the board carries all of HOT
