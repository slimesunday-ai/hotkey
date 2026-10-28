// 24/7 STORE (block 2,−3) · owner: the Store agent (LOCATIONS.md). Ids read 2_-3·store·kind·n for the store and its lot, 2_-3·L<k>·kind·n
// for the generated lots around it.
import { Vol, Bank, meshVol, stamp, stampA, meshed, rasterMask, textMask } from '../vox.js';
import { frame, win, bays, mass, shopFront, stoop, fireEscape, AIR, TOD } from '../kit.js';
import { PAL, CV, SIDE, hash, shade, rng } from '../style.js';
import { buildLot, subdivide, specify, massPlan, heightOf } from '../gen.js';
import { neutralCap } from '../roofs.js';
import { tank, billboard, giantObject, bench, tree, lampPost, car, copCar, taxi, phoneBooth, newsstand, hydrant, bags, milkCrate, acBox, dish, antenna, skylight, solar, vent, pigeons, potPlant, trashCan, newsBox } from '../props.js';
import { REG } from '../audit.js';
import { heroVol, wx, wz, tm, interior, PRODUCTS, shelves, planParts } from './common.js';
import { off } from '../districts/frame.js';   // SPREAD: the store is authored in today's metres, its block's frame (ox, oz: where that frame sits)

// ── the store's own small props (authored at base centre facing +z, memoized per day/night like props.js)
const MEMO = new Map(), memo = (k, f) => { k += '|' + TOD.night; let b = MEMO.get(k); if (!b) MEMO.set(k, b = f()); return b; };
const pvol = (nx, ny, nz, s = CV) => new Vol(nx, ny, nz, { s, org: [-nx * s / 2, 0, -nz * s / 2], ground: true });
const done = (V, kind) => { const b = meshed(V); b.kind = kind; return b; };
// raised lettering on a prop's +z face (every voxel recorded, so the audit checks it sits on its board)
function word(V, s, x0, ytop, z, c, l = 0) { const t = textMask(s); V.recNext(); for (let j = 0; j < 7; j++) for (let i = 0; i < t.w; i++) if (t.at(i, j)) { V.set(x0 + i, ytop - j, z, c, l); V.recN(s, x0 + i, ytop - j, z, 0, 1); } return t.w; }
// ice merchandiser: white two-door box, blue kick band, frosted lid, ICE across both doors (1.9 × 0.8 × 1.3 m)
const iceBox = () => memo('ice', () => { const V = pvol(19, 14, 8), Bl = 0x2f5bff;
  V.box(0, 0, 0, 19, 1, 7, Bl); V.box(0, 1, 0, 19, 13, 7, 0xf4f8fb); V.box(0, 13, 0, 19, 14, 7, 0xbfe6ff); V.box(9, 1, 6, 10, 13, 7, 0xd3dbe2);
  for (let x = 1; x < 19; x += 3) V.set(x, 12, 7, 0xbfe6ff);   // frost drips over the door tops
  word(V, 'ICE', (19 - textMask('ICE').w) >> 1, 11, 7, Bl, TOD.night ? 3 : 0); return done(V, 'icechest'); });
// propane exchange cage: iron frame + mesh, a shelf, ten white tanks with grey collars (2.2 × 0.8 × 1.5 m); its sign stands on top
const propaneCage = () => memo('propane', () => { const V = pvol(22, 15, 8), I = PAL.iron, T = 0xf4f4f0, C = 0x8a93a3;
  V.box(0, 0, 0, 22, 1, 8, I); V.box(0, 14, 0, 22, 15, 8, I); V.box(1, 7, 1, 21, 8, 7, 0x6e7480);
  for (const x of [0, 21]) for (const z of [0, 7]) V.box(x, 1, z, x + 1, 14, z + 1, I);
  for (const y0 of [1, 8]) for (let k = 0; k < 5; k++) { const x0 = 1 + k * 4; V.box(x0, y0, 2, x0 + 4, y0 + 5, 6, (x, y, z) => ((x === x0 || x === x0 + 3) && (z === 2 || z === 5)) ? undefined : (y === y0 + 4 ? C : T)); V.box(x0 + 1, y0 + 5, 3, x0 + 3, y0 + 6, 5, C); }
  const mesh = (u, y) => (u % 4 === 0 || y === 7) ? I : undefined;   // open mesh: the tanks read through it
  V.box(1, 1, 7, 21, 14, 8, (x, y) => mesh(x, y)); V.box(0, 1, 1, 1, 14, 7, (x, y, z) => mesh(z, y)); V.box(21, 1, 1, 22, 14, 7, (x, y, z) => mesh(z, y));
  V.box(10, 5, 7, 12, 7, 8, PAL.gold); return done(V, 'propane'); });
// shopping cart: wire basket on four casters, red handle and bumper (0.55 × 0.95 × 1.0 m), left in an empty stall
const trolley = () => memo('trolley', () => { const V = pvol(6, 10, 10), I = 0x9aa0a8;
  for (const [x, z] of [[0, 1], [5, 1], [0, 8], [5, 8]]) { V.set(x, 0, z, PAL.ink); V.set(x, 1, z, I); }
  V.box(0, 2, 1, 6, 3, 9, I); V.box(0, 3, 0, 6, 8, 9, (x, y, z) => (x === 0 || x === 5 || z === 0 || z === 8 || y === 3) && ((x + y + z) % 2 === 0 || y === 7 || y === 3) ? I : undefined);
  V.box(0, 7, 9, 6, 9, 10, PAL.red); V.box(0, 3, 9, 1, 7, 10, I); V.box(5, 3, 9, 6, 7, 10, I); return done(V, 'trolley'); });
// half-grain boards (STYLE §1: small signs may use 0.05): PROPANE on the cage, the OPEN neon hanging in the window, NO LOITERING
const noLoiter = () => memo('noloiter', () => { const S2 = .05, t = textMask('NO LOITERING'), W = t.w + 6, V = pvol(W, 11, 2, S2);
  V.box(0, 0, 0, W, 11, 1, PAL.white); V.box(0, 0, 0, W, 1, 1, PAL.red); V.box(0, 10, 0, W, 11, 1, PAL.red);
  word(V, 'NO LOITERING', 3, 8, 1, PAL.red); return done(V, 'sign'); });
const propaneSign = () => memo('propsign', () => { const S2 = .05, t = textMask('PROPANE'), W = t.w + 4, V = pvol(W, 13, 3, S2);
  for (const x of [3, W - 5]) V.box(x, 0, 0, x + 2, 2, 2, PAL.iron);
  V.box(0, 2, 0, W, 13, 2, PAL.red); V.box(0, 2, 0, W, 3, 2, PAL.white); V.box(0, 12, 0, W, 13, 2, PAL.white);
  word(V, 'PROPANE', 2, 10, 2, PAL.white, TOD.night ? 3 : 0); return done(V, 'sign'); });
const openSign = () => memo('open', () => { const S2 = .05, t = textMask('OPEN'), W = t.w + 4, V = pvol(W, 14, 3, S2), N = 0xff3b6b, l = 3;   // neon: always lit (STYLE §3)
  V.box(0, 0, 0, W, 11, 2, PAL.ink); V.box(0, 0, 2, W, 11, 3, (x, y) => (x === 0 || x === W - 1 || y === 0 || y === 10) ? 0x2de2e6 : undefined, l);
  for (const x of [3, W - 4]) V.box(x, 11, 0, x + 1, 14, 2, PAL.iron);
  word(V, 'OPEN', 2, 9, 2, N, l); return done(V, 'sign'); });

// ═════════════════════════ 24/7 STORE (block 2,−3): one-storey box, its own lot, giant 24/7 sign; generator fills the rest
// Pass 1e (store agent): nothing floats, clips or overhangs — the rooftop letters stand on their bar and the bar on the roof, the
// window posters hang from the transom and the mullions, the lot's asphalt stops at the walls — and the store is lived in: a front
// apron (payphone, ICE, propane cage, papers, a can, a crate), backed-in cars in striped stalls, a hatched bay at the door, a camera
// on the corner, the counter with its clerk (hands up: the Kwik-E-Mart gag), power wall, coolers and the slushie bar.
export function store(bank, b, A) {
  REG.group('store'); const [ox, oz] = off(b), R = b.R, S = { x0: 74 + ox, z0: -86 + oz, x1: 86 + ox, z1: -77 + oz }, lotZ1 = R.z1;   // the store at the block's heart (80,−80 is inside), its lot to 2nd St
  const { V, B } = heroVol(S.x0, S.z0, S.x1, S.z1, 9, ['+z']), H = 42, OR = 0xff7a1a, LIT = TOD.night ? 3 : 1, W = PAL.white;
  const F = mass(V, B, H, OR, PAL.white, ['+z'], { parapet: 6, roof: 0xdcd8cf }); neutralCap(V, B, H, OR, 0xb0aca5); interior(V, B, 38, (x, y, z) => ((x >> 2) + (z >> 2)) & 1 ? 0xf2f2f2 : 0xd9d9de);
  if (TOD.night) V.box(B.x0 + 2, 0, B.z0 + 2, B.x1 - 2, 1, B.z1 - 2, (x, y, z) => ((x >> 2) + (z >> 2)) & 1 ? 0xe4e2d6 : 0xc2c2c8, 3);   // night: the fluorescent floor glows
  // ── storefront (a: 0 at x 74 → 120 at x 86; d: 0 = wall skin, + toward the lot); at night the fascia is a backlit sign box
  const f = F('+z'), L = f.len, door = (L >> 1) - 7, BOX = TOD.night ? 3 : 0;
  f.box(0, 0, 0, L, 4, 2, PAL.ink); f.box(-1, 30, 0, L + 1, 42, 3, W, BOX); f.box(-1, 32, 3, L + 1, 34, 4, PAL.green, BOX); f.box(-1, 36, 3, L + 1, 38, 4, PAL.red, BOX);
  f.box(4, 5, -3, L - 4, 29, 3, AIR); f.box(door, 1, -3, door + 14, 29, 3, AIR);
  for (const a of [4, 20, 36, door - 1, door + 14, 83, 99, L - 5]) f.box(a, 4, 1, a + 1, 30, 2, W);   // mullions and door jambs, standing on the base band
  f.box(4, 24, 1, L - 4, 25, 2, W); f.box(door, 1, 0, door + 14, 2, 2, 0xc9ced6, 2);                 // transom at door height · aluminium threshold, flush with the apron
  // window posters, above the apron clutter: WIN taped across the second mullion and the transom; the coffee and slushie cards hang
  // from the transom left of the door (one on the mullion, one on the jamb). The OPEN neon hangs right of the door and the next bay
  // stays clear: the counter is behind it.
  f.box(11, 16, 2, 30, 27, 3, PAL.yellow); f.box(11, 16, 2, 30, 17, 3, PAL.red); f.box(11, 26, 2, 30, 27, 3, PAL.red);
  f.box(37, 15, 1, 44, 24, 2, PAL.pink); f.box(38, 16, 2, 42, 20, 3, W); f.box(42, 17, 2, 43, 19, 3, W); f.box(39, 19, 2, 41, 20, 3, 0x6b3a1e); for (const [a, y] of [[39, 21], [40, 22], [41, 21]]) f.set(a, y, 2, W);
  f.box(46, 14, 1, 52, 24, 2, PAL.cyan); f.box(47, 15, 2, 51, 19, 3, PAL.red); f.box(47, 17, 2, 51, 18, 3, W); f.box(47, 19, 2, 51, 20, 3, 0x3f8cff); f.box(49, 20, 2, 50, 22, 3, W);
  // payphone on the west pier: back plate, steel body, keypad, handset on its hook, blue hood; flyers stapled above and below
  f.box(0, 10, 1, 4, 21, 2, PAL.iron); f.box(0, 11, 2, 4, 19, 4, 0xc9ced6, 2); f.box(1, 13, 4, 3, 16, 5, 0x33333b); f.box(1, 17, 4, 3, 18, 5, PAL.ink);
  f.box(-1, 13, 2, 0, 18, 4, PAL.ink); f.box(-1, 11, 3, 0, 13, 4, PAL.ink); f.box(-1, 20, 1, 4, 21, 5, 0x2f5bff); f.box(-1, 12, 1, 0, 20, 2, 0x2f5bff);
  f.box(0, 23, 1, 3, 27, 2, 0xfff3a0); f.box(1, 25, 1, 3, 26, 2, PAL.ink); f.box(1, 5, 1, 4, 9, 2, PAL.pink);
  for (const [y0, y1, c] of [[6, 10, PAL.lime], [11, 16, 0xf4f3ee], [17, 21, PAL.cyan]]) { const a = 116 + (y0 & 1); f.box(a, y0, 1, a + 3, y1, 2, c); f.set(a + 1, y1 - 2, 1, PAL.ink); }
  // security camera on the east corner, looking at the lot and the door (red tally lit at night)
  f.box(117, 26, 1, 119, 28, 3, PAL.iron); f.box(115, 25, 3, 119, 28, 7, 0xdfe3e8); f.box(116, 26, 7, 118, 27, 8, PAL.ink); f.set(118, 27, 6, 0xff2a2a, TOD.night ? 3 : 0);
  f.text('WIN', 20, 25, 3, 4, PAL.red, 0, 1, 1); f.text('24/7 STORE', L >> 1, 41, 3, 4, PAL.ink, TOD.night ? 3 : 0, 1, 1);
  // ── the room (i → x 73.7 + 0.1 i, k → z −86.3 + 0.1 k): coolers back-left, shelves back-right, two gondolas, the slushie bar on the
  //    west wall, the counter + power wall + LOTTO on the east side
  const cold = 0x3f8cff;
  V.box(7, 1, 6, 59, 21, 12, 0xdfe6ee); V.box(8, 2, 11, 58, 20, 12, (x, y) => (x - 8) % 10 === 0 ? 0xc9ced6 : (y % 5 === 1 ? 0xf4f8fb : PRODUCTS[(hash(x, y, 7) * PRODUCTS.length) | 0]), LIT);
  V.box(7, 21, 6, 59, 30, 12, cold); const wc = textMask('COLD'); V.recNext(); for (let j = 0; j < 7; j++) for (let i = 0; i < wc.w; i++) if (wc.at(i, j)) { V.set(22 + i, 28 - j, 12, W, TOD.night ? 3 : 0); V.recN('COLD', 22 + i, 28 - j, 12, 0, 1); }
  shelves(V, 61, 6, 118, 12, 26, 5); for (const x of [29, 63]) shelves(V, x, 19, x + 8, 71, 18, x);
  V.box(5, 1, 60, 11, 9, 87, 0xf4f3ee); V.box(5, 8, 60, 12, 9, 87, PAL.green);                                                // slushie + coffee bar
  V.box(5, 9, 62, 10, 11, 76, 0xc9ced6, 2); V.box(6, 11, 63, 10, 17, 68, 0x3f8cff, 1); V.box(6, 11, 70, 10, 17, 75, 0xff3b5c, 1); V.box(5, 17, 62, 10, 18, 76, W);
  V.box(5, 9, 78, 10, 15, 84, 0x26262c); V.set(9, 13, 80, 0xff2a2a, TOD.night ? 3 : 0); V.box(6, 9, 85, 9, 13, 87, W);
  V.box(88, 1, 60, 120, 9, 63, 0x6b3a1e); V.box(88, 9, 60, 120, 25, 62, 0x2a2a30);                                            // power wall
  for (let y = 10; y < 24; y += 2) for (let x = 89; x < 119; x++) V.set(x, y, 62, [0xe8232a, 0xf7f7f2, 0xe7bd4a, 0x2f5bff, 0x14a83b, 0xf7f7f2][(hash(x >> 1, y, 3) * 6) | 0]);
  V.box(89, 25, 60, 120, 35, 62, PAL.yellow); const wl = textMask('LOTTO'); V.recNext(); for (let j = 0; j < 7; j++) for (let i = 0; i < wl.w; i++) if (wl.at(i, j)) { V.set(90 + i, 33 - j, 62, PAL.red, TOD.night ? 3 : 0); V.recN('LOTTO', 90 + i, 33 - j, 62, 0, 1); }
  V.box(86, 1, 76, 116, 8, 83, PAL.red); V.box(86, 1, 82, 116, 2, 83, PAL.ink); V.box(85, 8, 75, 117, 9, 84, W);             // the counter
  V.box(97, 9, 77, 103, 12, 81, 0x33333b); V.box(98, 12, 77, 102, 14, 78, 0x33333b); V.box(98, 10, 81, 101, 11, 82, 0x6cff4a, LIT);   // register, at the robber
  V.box(98, 9, 74, 102, 10, 77, 0x2a2a30); V.box(99, 10, 74, 101, 11, 76, 0x3aa840);                                            // …its drawer out, cash showing
  V.box(106, 9, 77, 114, 10, 82, 0xc9ced6, 2); for (let x = 106; x < 114; x++) V.box(x, 10, 78, x + 1, 11, 81, x & 1 ? 0xb5542a : 0xd9763a); V.box(106, 12, 77, 114, 13, 82, 0xbfe6ff, 1);   // hot dog roller
  for (const x of [106, 113]) V.box(x, 11, 77, x + 1, 12, 78, 0xbfe6ff, 1);
  V.box(88, 9, 78, 91, 13, 81, PAL.gold); V.box(88, 13, 78, 91, 14, 81, 0x6b3a1e);                                              // the tip jar is a coffee tin
  V.ell(116.5, 35, 86.5, 2.2, 2, 2.2, 0xdfe3e8, 2);                                                                            // dome mirror under the ceiling
  meshVol(V, bank); for (const [dx, k] of [[-3.5, 0], [3.5, 0], [0, 1]]) stamp(k ? vent(0) : acBox(), bank, 0, 80 + ox + dx, SIDE + H * CV, -84 + oz);
  // the doorway stays clear (audit). A.storeDoor is no longer published: castspec's three fixed door people would stand in the apron
  // props, so the store places its own cast (below)
  const dx0 = S.x0 + (door + 7) * CV, dz0 = S.z1 + .4; REG.door(dx0, dz0 + .1, 0);
  // ── the lot (x 73…87, z −77…2nd St): asphalt that stops one voxel short of the neighbours' walls and the store's base band, a raised
  //    concrete apron along the front with a yellow curb, five stalls (the middle one hatched: the door), wheel stops, oil, a drain
  const LX0 = 73 + ox, LX1 = 87 + ox, P2 = new Vol((LX1 - LX0) * 10, 4, Math.round((lotZ1 - S.z1) / CV), { s: CV, org: [LX0, SIDE, S.z1] }), NX = P2.nx, NZ = P2.nz;
  const LINES = [5, 31, 57, 83, 109, 135], AP = { x0: 4, x1: 136, z1: 14 }, stall = k => (LINES[k] + LINES[k + 1]) >> 1;
  const oil = (x, z) => { for (const [cx, cz, r] of [[stall(1), 34, 6], [stall(3), 29, 5], [48, 67, 4]]) { const d = Math.hypot((x - cx) / r, (z - cz) / (r * 1.4)) + (hash(x, z, 5) - .5) * .5; if (d < .55) return 0x484954; if (d < 1) return 0x51525e; } return null; };
  P2.box(1, 0, 0, NX - 1, 1, NZ, (x, y, z) => {
    if (z === 0 && x >= 10 && x < NX - 10) return undefined;                                                   // the store's base band owns this row
    if (LINES.includes(x) && z >= AP.z1 && z < 63) return PAL.lineW;
    if (x > LINES[2] && x < LINES[3] && z >= AP.z1 && z < 63) return ((x + z) % 7 < 2 || z === 62) ? PAL.lineY : PAL.asphalt;   // hatched: keep the door clear
    if (z >= 84 && z < 88 && x >= 64 && x < 76) return (z === 84 || z === 87 || x === 64 || x === 75) ? 0x3a3a42 : (x & 1 ? PAL.ink : 0x3a3a42);   // storm drain
    if (Math.abs(z - 72 - Math.round(Math.sin(x * .21) * 2 + (x - 20) * .18)) < .5 && x > 18 && x < 62) return 0x4b4c57;   // a crack across the aisle
    if (x >= 100 && x < 119 && z >= 70 && z < 81) return PAL.patch;
    return oil(x, z) ?? PAL.asphalt; });
  const melt = (x, z) => Math.hypot((x - 38) / 7, (z - 10) / 2.4) + (hash(x, z, 9) - .5) * .45 < 1;                      // the ICE box leaks
  P2.box(AP.x0, 1, 1, AP.x1, 2, AP.z1, (x, y, z) => z === AP.z1 - 1 ? PAL.lineY : melt(x, z) ? 0xa3c4de : ((x - AP.x0) % 12 === 0 ? PAL.joint : hash(x, z, 13) > .985 ? 0x5a5660 : (hash(x, z, 11) > .97 ? 0xbdb5a8 : PAL.walk)));   // …and old gum
  for (const k of [0, 1, 3, 4]) { const c = stall(k); P2.box(c - 7, 1, 16, c + 7, 2, 18, 0xd9d5cc); }
  REG.surface(P2); meshVol(P2, bank);   // pass 1d: the store's lot is a walkable surface
  // ── the rooftop 24/7: posts stand on the roof (braced back), the bar on the posts, every glyph on the bar (letters sit on their
  //    baseline; the slash's tail below it is trimmed)
  const M = rasterMask('24/7', '900 44px Impact, "Arial Black", sans-serif'), lows = new Map();
  for (let i = 0; i < M.w; i++) { let lo = -1; for (let j = 0; j < M.h; j++) if (M.at(i, j)) lo = j; if (lo >= 0) lows.set(lo, (lows.get(lo) || 0) + 1); }
  const base = [...lows].sort((p, q) => q[1] - p[1] || q[0] - p[0])[0][0], barY = 15, ZB = 8;
  const RS = new Vol(M.w + 8, barY + base + 3, 16, { s: CV, org: [80 + ox - (M.w + 8) * CV / 2, SIDE + H * CV, S.z1 - 2.4 - ZB * CV] });
  for (const x of [4, M.w + 2]) { RS.box(x - 1, 0, ZB + 2, x + 3, 1, ZB + 6, PAL.iron); RS.box(x, 0, ZB + 3, x + 2, barY, ZB + 5, PAL.iron); for (let t = 0; t <= 8; t++) RS.box(x, 8 - t, ZB + 2 - t, x + 2, 9 - t, ZB + 3 - t, PAL.iron); }
  RS.box(2, barY, ZB + 2, M.w + 6, barY + 1, ZB + 6, PAL.iron);
  for (let j = 0; j <= base; j++) for (let i = 0; i < M.w; i++) if (M.at(i, j)) { const y = barY + 1 + base - j; RS.box(4 + i, y, ZB + 3, 5 + i, y + 1, ZB + 5, PAL.red); RS.set(4 + i, y, ZB + 5, PAL.yellow, TOD.night ? 3 : 0); }
  meshVol(RS, bank);
  // ── parked: backed into the outer stalls against their wheel stops (a quick exit), clear of every line
  stamp(car(3), bank, 0, LX0 + (stall(0) + .5) * CV, SIDE + .1, -73.4 + oz); stamp(car(0), bank, 0, LX0 + (stall(4) + .5) * CV, SIDE + .1, -73.4 + oz);
  // ── the apron, west → east: [payphone on the pier] ICE · crate | door | can · papers · propane cage
  const AY = SIDE + .2;
  stamp(iceBox(), bank, 0, 76.6 + ox, AY, -76.5 + oz); stamp(milkCrate(0x2f5bff), bank, 0, 78.3 + ox, AY, -76.55 + oz);
  stamp(trashCan(0x2a2d38), bank, 0, 81.2 + ox, AY, -76.5 + oz); stamp(newsBox(PAL.red), bank, 0, 82.0 + ox, AY, -76.55 + oz); stamp(newsBox(0x2f5bff), bank, 0, 82.7 + ox, AY, -76.55 + oz);
  stamp(propaneCage(), bank, 0, 85.45 + ox, AY, -76.5 + oz); stamp(propaneSign(), bank, 0, 85.45 + ox, AY + 1.5, -76.5 + oz);
  stamp(openSign(), bank, 0, S.x0 + 7.55, SIDE + 2.4 - .7, -76.95 + oz);           // hangs from the transom right of the door
  stamp(trolley(), bank, 1, 77.5 + ox, SIDE, -72.6 + oz);                                 // abandoned in the empty stall
  stamp(pigeons(7), bank, 1, 80.0 + ox, SIDE, -70.8 + oz);                                // working the hatched bay for fries
  stamp(noLoiter(), bank, 3, LX1 - .05, SIDE + 2.2, -73.4 + oz);                     // on the SE lot's blank wall, over the loiterers
  // ── the life: the clerk with his hands up behind the counter and the guy holding him up at the register (both inside: 'dance' and
  //    'dj' are the cast's placed-on-purpose poses), and outside a caller at the payphone, a crate sitter and his friend, a shopper
  //    coming out, and a lookout leaning on the red car. The window right of the door stays clear so the stick-up reads from the street.
  const pp = (x, y, z, ry, act, seed) => A.life.push({ x: x + ox, y, z: z + oz, ry, act, seed });   // (frame metres)
  pp(82.9, SIDE + .1, -79.15, .35, 'dance', 0x7a11); pp(83.8, SIDE + .1, -77.7, -2.59, 'dj', 0x7a12);
  pp(74.25, AY, -75.95, Math.PI + .25, 'phone', 0x7a13); pp(78.3, AY, -76.55, 1.0, 'sit', 0x7a14); pp(79.0, AY, -76.05, -2.19, 'talk', 0x7a16);
  pp(80.35, AY, -76.2, .35, 'carry', 0x7a15); pp(83.85, SIDE + .1, -72.6, -Math.PI / 2, 'lean', 0x7a18);
  // the rest of the block: explicit lots in the generator's language
  const mk = (x0, z0, x1, z1, faces, corner) => ({ x0: x0 + ox, z0: z0 + oz, x1: x1 + ox, z1: z1 + oz, faces, corner, w: x1 - x0, d: z1 - z0, main: faces[0], front: faces[0][1] === 'z' ? x1 - x0 : z1 - z0 });
  const lots = [mk(68, -92, 75, -84, ['-z', '-x'], 'NW'), mk(75, -92, 81, -86, ['-z']), mk(81, -92, 85, -86, ['-z']), mk(85, -92, 92, -84, ['-z', '+x'], 'NE'),
    mk(68, -84, 73, -77, ['-x']), mk(87, -84, 92, -77, ['+x']), mk(68, -77, 73, -68, ['+z', '-x'], 'SW'), mk(87, -77, 92, -68, ['+z', '+x'], 'SE')];
  const r = rng(24724); specify({ ...b, noAlley: true }, lots, r, 91000); for (const l of lots) { if (l.spec.gag?.kind === 'billboard') delete l.spec.gag; if (l.spec.type === 'parking') l.spec.type = 'shop2'; l.H = heightOf(l.spec); }
  // pass 1e: the NW and NE corner lots used to reach 1 × 2 m into the store's back corners (the store carved them only up to its
  // parapet, so their upper floors sat on it). Once the specs are drawn (names, colours, heights unchanged) they stop at the store's
  // back wall, and the west and east lots run on to meet them.
  for (const [k, e] of [[0, 'z1'], [3, 'z1'], [4, 'z0'], [5, 'z0']]) { const l = lots[k]; l[e] = S.z0; l.d = l.z1 - l.z0; if (l.main[1] === 'x') l.front = l.d; }
  REG.plan(lots.map((l, k) => massPlan(l, 'L' + k)).filter(Boolean)); lots.forEach((l, k) => { REG.group('L' + k); buildLot(bank, l, A); }); REG.group('store');
}
