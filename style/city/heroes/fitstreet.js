// FIT STREET (block −3,0) · owner: the Fit Street agent (LOCATIONS.md). The Springfield corner on the real lots: the DROP, 404 DELI,
// the walk-up with FRESH CUTZ, HOT SLICE, a brownstone and DEAD AIR. Ids read -3_0·<part>·kind·n (part = walkup, drop, deli, pizza, brownstone, bar).
import { Vol, Bank, meshVol, stamp, stampA, meshed, rasterMask, textMask } from '../vox.js';
import { frame, win, bays, mass, shopFront, stoop, fireEscape, AIR, TOD } from '../kit.js';
import { PAL, CV, SIDE, hash, shade, rng } from '../style.js';
import { buildLot, subdivide, specify, massPlan, heightOf } from '../gen.js';
import { neutralCap } from '../roofs.js';
import { tank, billboard, giantObject, bench, tree, lampPost, car, copCar, taxi, phoneBooth, newsstand, hydrant, bags, milkCrate, acBox, dish, antenna, skylight, solar, vent, pigeons, potPlant, couch, dumpster } from '../props.js';
import { REG } from '../audit.js';
import { heroVol, wx, wz, tm, interior, PRODUCTS, shelves, planParts } from './common.js';
import { kerbX } from '../districts/frame.js';   // (SPREAD: today's metres → the spread world: the bail board's and bail.money's x)

// ═════════════════════════ FIT STREET (block −3,0): the Springfield corner, re-fitted to the real lots
export function fitStreet(bank, b, A) {
  const R = b.R;  // x −92…−68, z 6…28 · Central Ave north (avenue), Ivy St east, Hazel St west, Washington St south
  // NW: tomato walk-up with a barber, fire escape, water tank
  // pass 1d: every part's mass up front (so each is clipped against its neighbours) and a group per part (the middle of its ids)
  planParts([[R.x0, R.z0, R.x0 + 8, R.z0 + 10, 162, 'walkup'], [R.x0 + 8, R.z0, R.x0 + 16, R.z0 + 10, 73, 'drop'], [R.x0 + 16, R.z0, R.x1, R.z0 + 9, 103, 'deli'],
    [R.x0, R.z0 + 11, R.x0 + 7, R.z1, 102, 'pizza'], [R.x0 + 7, R.z0 + 12, R.x0 + 15, R.z1 - 2.5, 138, 'brownstone'], [R.x0 + 15, R.z0 + 11, R.x1, R.z1, 73, 'bar']]);
  const walk = { x0: R.x0, z0: R.z0, x1: R.x0 + 8, z1: R.z0 + 10, faces: ['-z', '-x'], corner: 'NW' };
  walk.w = 8; walk.d = 10; walk.main = '-z'; walk.front = 8;
  walk.spec = { type: 'walkup', st: 5, wall: 0xef4a2a, trim: PAL.cream, seed: 4041, shop: { name: 'FRESH CUTZ', sign: PAL.red }, fire: true, tank: true, awning: null };
  REG.group('walkup'); buildLot(bank, walk, A);
  REG.group('drop'); drop(bank, { x0: R.x0 + 8, z0: R.z0, x1: R.x0 + 16, z1: R.z0 + 10 }, A); REG.door(A.drop.door[0], A.drop.door[1] - .5, 2);
  REG.group('deli'); deli(bank, { x0: R.x0 + 16, z0: R.z0, x1: R.x1, z1: R.z0 + 9 }, A); REG.door(A.deliDoor[0], A.deliDoor[1] - .4, 2);
  // south row on Washington St: pizza corner (giant slice), a brownstone, the bar with the roof party
  const piz = { x0: R.x0, z0: R.z0 + 11, x1: R.x0 + 7, z1: R.z1, faces: ['+z', '-x'], corner: 'SW' }; piz.w = 7; piz.d = R.z1 - piz.z0; piz.main = '+z'; piz.front = 7;
  piz.spec = { type: 'shop2', st: 3, wall: 0xff7a1a, trim: PAL.white, seed: 5150, shop: { name: 'HOT SLICE', sign: PAL.green }, awning: PAL.red, gag: { kind: 'object', obj: 'slice' } };
  REG.group('pizza'); buildLot(bank, piz, A);
  const bs = { x0: R.x0 + 7, z0: R.z0 + 12, x1: R.x0 + 15, z1: R.z1, faces: ['+z'] }; bs.w = 8; bs.d = R.z1 - bs.z0; bs.main = '+z'; bs.front = 8;
  bs.spec = { type: 'brownstone', st: 4, wall: 0x8c52ff, trim: PAL.cream, seed: 777, shop: null, stoop: true, fire: false, tank: false };
  REG.group('brownstone'); buildLot(bank, bs, A);
  REG.group('bar'); bar(bank, { x0: R.x0 + 15, z0: R.z0 + 11, x1: R.x1, z1: R.z1 }, A);
  // pass 1e: the service alley between the two rows gets chain-link gates at both mouths, and the deli's dumpster inside off Ivy St
  REG.group('alley'); meshVol(alleyGate(R.x1 - .2, R.z0 + 9, R.z0 + 11), bank); meshVol(alleyGate(R.x0 + .1, R.z0 + 10, R.z0 + 10.9), bank);
  stamp(dumpster(0x25b84c), bank, 0, R.x1 - 2.6, SIDE, R.z0 + 10); REG.group('fitstreet');
}
// a chain-link alley gate one voxel thick, in the plane x … x + 0.1 from z0 to z1: iron posts and rails, a diamond mesh, and on a
// 2 m opening two leaves meeting at a centre post with a padlock
function alleyGate(x, z0, z1) {
  const nz = Math.round((z1 - z0) / CV), V = new Vol(1, 22, nz, { s: CV, org: [x, SIDE, z0] }), I = PAL.iron, MESH = 0xb8bcc4;
  V.box(0, 1, 1, 1, 21, nz - 1, (xx, y, z) => ((y + z) % 4 === 0 || (y - z + 400) % 4 === 0) ? MESH : undefined, 2);
  for (const z of nz >= 16 ? [0, nz >> 1, nz - 1] : [0, nz - 1]) V.box(0, 0, z, 1, 22, z + 1, I);
  V.box(0, 0, 0, 1, 1, nz, I); V.box(0, 20, 0, 1, 21, nz, I); if (nz >= 16) V.box(0, 10, (nz >> 1) - 1, 1, 12, (nz >> 1) + 2, PAL.gold, 2);
  return V;
}
function drop(bank, L, A) {       // the DROP: hot pink, black vitrine, lime slime off the parapet, giant letters facing down the avenue
  const H = 66, { V, B } = heroVol(L.x0, L.z0, L.x1, L.z1, 12, ['-z']), K = PAL.ink;
  const F = mass(V, B, H, PAL.pink, PAL.white, ['-z'], { roof: 0xdcd8cf }); neutralCap(V, B, H, PAL.pink, 0xb0aca5); interior(V, B, 34, 0xf4f4f4);
  const f = F('-z');     // a = 0 at the east end (the deli side)
  f.box(0, 0, 0, f.len, 3, 2, K); f.box(0, 33, 0, f.len, 36, 3, K);
  f.box(4, 1, -3, 18, 27, 3, AIR); f.box(3, 27, 0, 19, 29, 3, PAL.lime); f.box(2, 1, 0, 4, 29, 3, K); f.box(18, 1, 0, 20, 29, 3, K);
  f.box(24, 5, -3, f.len - 4, 31, 3, AIR); f.box(23, 4, 0, f.len - 3, 5, 3, K); f.box(23, 31, 0, f.len - 3, 32, 3, K); f.box(23, 5, 0, 24, 31, 3, K); f.box(f.len - 4, 5, 0, f.len - 3, 31, 3, K);
  const px = B.x0 + 20, pz = B.z0 + 7; V.box(px, 1, pz, px + 12, 10, pz + 10, 0xffffff); V.box(px + 1, 10, pz + 2, px + 11, 11, pz + 9, PAL.lime); V.box(px + 1, 11, pz + 2, px + 11, 14, pz + 9, 0xf7f7f7);
  V.box(px + 5, 14, pz + 2, px + 11, 18, pz + 9, (x, y) => y > 16 ? K : (x < px + 8 ? 0xffffff : PAL.red));
  // pass 1e: the five drop hoodies hang on a chrome rack that stands on the shop floor (they used to float 0.7 m up), hem to hanger
  const hz = B.z0 + 5, CH = 0xc9ced6;
  for (const x of [B.x0 + 3, B.x0 + 24]) { V.box(x, 1, hz - 2, x + 1, 2, hz + 2, CH, 2); V.box(x, 2, hz, x + 1, 26, hz + 1, CH, 2); }   // feet + uprights
  V.box(B.x0 + 3, 25, hz, B.x0 + 25, 26, hz + 1, CH, 2);                                                                      // the rail
  [K, PAL.lime, PAL.pink, 0xffffff, 0x2f5bff].forEach((c, k) => { const x = B.x0 + 5 + k * 4;
    V.box(x, 22, hz, x + 3, 23, hz + 1, CH, 2); V.box(x + 1, 23, hz, x + 2, 25, hz + 1, CH, 2);                                 // hanger + hook
    V.box(x, 9, hz - 1, x + 3, 22, hz + 2, c); V.box(x, 9, hz - 1, x + 3, 10, hz + 2, shade(c, .8)); V.box(x + 1, 21, hz - 1, x + 2, 22, hz + 2, shade(c, .8));   // hoodie, hem, hood seam
    V.set(x + 1, 17, hz - 2, c === PAL.lime ? K : PAL.lime); });                                                               // the chest logo faces the street
  // the sneaker wall across the back of the shop (seen through the vitrine and the open door): white shelving, one pair per slot
  const wz = B.z1 - 4, SN = [0xffffff, PAL.red, PAL.lime, K, 0x2f5bff, PAL.pink, 0xffe23a, 0xff7a1a];
  V.box(B.x0 + 4, 3, wz, B.x1 - 4, 29, wz + 2, 0xf4f1ea); V.clear(B.x0 + 5, 4, wz, B.x1 - 5, 28, wz + 1);   // the carcass, open to the shop
  for (let y = 4; y < 28; y += 6) { V.box(B.x0 + 5, y, wz, B.x1 - 5, y + 1, wz + 1, 0xf4f1ea);
    for (let x = B.x0 + 6; x + 3 <= B.x1 - 6; x += 5) { const c = SN[(hash(x, y, 7) * SN.length) | 0]; V.box(x, y + 1, wz, x + 3, y + 3, wz + 1, c); V.box(x, y + 1, wz, x + 3, y + 2, wz + 1, c === 0xffffff ? PAL.red : 0xffffff); } }
  for (const a0 of bays(f.len, 26)) win(f, a0 + 6, 42, 13, 15, PAL.white, {});
  const SL = TOD.night ? 3 : 0; f.box(-1, H - 2, 2, f.len + 1, H + 1, 4, PAL.lime, SL);
  for (let a = 1; a < f.len - 2; a += 3 + ((hash(a, 9) * 4) | 0)) { const Ln = 4 + ((hash(a, 3) * hash(a, 5) * 26) | 0), wd = 2 + (hash(a) > .6); f.box(a, H - 2 - Ln, 1, a + wd, H - 2, 3, PAL.lime, SL); f.box(a - (Ln > 10), H - 3 - Ln, 1, a + wd + (Ln > 10), H - 1 - Ln, 3, PAL.lime, SL); }
  // rooftop letters: a double-sided V-sign opening onto Central Ave, so DROP reads face-on from both avenue approaches and from above.
  // Pass 1e: the arms close to 36° off the avenue (at 45° their tips ran 0.17 m into the walk-up's and the deli's walls, and their end
  // posts stood in the parapet) and stop 0.3 m short of the apex, where a black mast joins them.
  const top = SIDE + H * CV, ax = (L.x0 + L.x1) / 2, az = L.z0 + 6.4, arm = dropPanel(SL), th = .63, gap = .3, sn = Math.sin(th), cs = Math.cos(th);
  const mx = Math.round((ax - V.org[0]) / CV), mz = Math.round((az - V.org[2]) / CV); V.box(mx - 1, H, mz - 3, mx + 1, H + arm.h, mz, K);
  meshVol(V, bank);
  stampA(arm.bank, bank, Math.PI / 2 + th, ax - sn * gap, top, az - cs * gap);                                   // west arm: mast → NW tip, inner face looks ENE
  stampA(arm.bank, bank, -Math.PI / 2 - th, ax + sn * (gap + arm.len), top, az - cs * (gap + arm.len));          // east arm: NE tip → mast, inner face looks WNW
  // velvet rope along the queue, hip height (gold posts, red rope) — the queue runs west from the door, facing east
  const rz = L.z0 - 1.55, R2 = new Vol(Math.round(12 / CV), 12, 4, { s: CV, org: [L.x0 - 4, SIDE, rz - .2] });
  for (let x = 4; x < 116; x += 14) { R2.box(x - 1, 0, 1, x + 2, 1, 4, 0xc8962c, 2); R2.box(x, 1, 2, x + 1, 9, 3, PAL.gold, 2); R2.box(x - 1, 9, 1, x + 2, 10, 4, 0xf2cc55, 2); if (x + 14 < 116) for (let t = 1; t < 14; t++) R2.set(x + t, 8 - Math.round(Math.sin(t / 14 * Math.PI) * 2.5), 2, 0xd7141a); }
  meshVol(R2, bank);
  A.drop = { door: [L.x1 - 1.1, L.z0], queueZ: L.z0 - .8, ropeZ: rz };
}
function dropPanel(SL) {
  const M = rasterMask('DROP', '900 26px Impact, "Arial Black", sans-serif'), W = M.w + 4, K = PAL.ink, V = new Vol(W, M.h + 32, 6, { s: CV, org: [0, 0, -.3], ground: true });
  for (const x of [3, W >> 1, W - 4]) { V.box(x, 0, 2, x + 1, 26, 4, K); for (let y = 2; y < 24; y += 6) V.box(x - 2, y, 2, x + 3, y + 1, 4, K); } V.box(0, 25, 2, W, 26, 4, K);
  for (let j = 0; j < M.h; j++) for (let i = 0; i < M.w; i++) if (M.at(i, j)) { const y = 27 + M.h - j; V.box(2 + i, y, 1, 3 + i, y + 1, 5, K); V.set(2 + i, y, 5, PAL.lime, SL); V.set(2 + (M.w - 1 - i), y, 0, PAL.lime, SL); }
  const bk = meshed(V); bk.kind = 'letters'; return { bank: bk, len: W * CV, h: 28 + M.h };
}
function deli(bank, L, A) {       // LUCKY 7 DELI (signage pass 3: it was 404 DELI) on the Central Ave / Ivy St corner: box awning, open door, counter, fruit, billboard giant on the roof
  const H = 96, { V, B } = heroVol(L.x0, L.z0, L.x1, L.z1, 11, ['-z', '+x']), T = PAL.white;
  const F = mass(V, B, H, 0xffc21a, T, ['-z', '+x'], { roof: 0xd2d3d6 }); neutralCap(V, B, H, 0xffc21a, 0xa9a7a4); interior(V, B, 34);
  const N = F('-z'), E = F('+x');
  for (const f of [N, E]) { f.box(0, 0, 0, f.len, 36, 2, T); f.box(0, 0, 0, f.len, 4, 3, 0xd8d3c8); }
  N.box(5, 1, -3, 19, 25, 3, AIR); N.box(4, 25, 0, 20, 27, 3, T); A.deliDoor = [L.x1 - 1.2, L.z0 + .1];
  N.box(24, 5, -3, N.len - 5, 27, 3, AIR); E.box(8, 5, -3, 38, 27, 3, AIR); E.box(46, 5, -3, E.len - 8, 27, 3, AIR);
  shelves(V, B.x0 + 3, B.z1 - 9, B.x1 - 3, B.z1 - 3, 26, 1); shelves(V, B.x0 + 3, B.z0 + 14, B.x0 + 9, B.z1 - 12, 26, 2);
  const cx0 = B.x1 - 30, cz0 = B.z0 + 9; V.box(cx0, 1, cz0, cx0 + 20, 7, cz0 + 7, PAL.red); V.box(cx0 - 1, 7, cz0 - 1, cx0 + 21, 8, cz0 + 8, T);
  V.box(cx0 + 2, 8, cz0 + 1, cx0 + 8, 12, cz0 + 6, 0x3a3a42); V.box(cx0 + 3, 11, cz0 + 5, cx0 + 7, 12, cz0 + 6, PAL.lime, 3);
  V.box(cx0 + 11, 8, cz0 + 4, cx0 + 19, 16, cz0 + 6, (x, y) => [0xffd21f, 0x2f5bff, 0xff4fa3, 0xe8232a][(x + y) & 3]);
  // pass 1e: the clerk leans on the counter, hands on the till. Inside the shop on purpose, so he takes the cast's placed pose ('dj':
  // arms forward), as the 24/7 clerk does; as a plain stander (A.clerk) the people check refused him every build.
  A.life.push({ x: wx(V, cx0 + 10), y: SIDE + .1, z: wz(V, cz0 + 11), ry: Math.PI, act: 'dj', seed: 0x51a7 });
  const AW = PAL.green; N.box(-14, 26, 1, N.len, 37, 15, AW); E.box(0, 26, 1, E.len + 14, 37, 15, AW); N.box(-14, 26, 13, N.len, 28, 15, shade(AW, .78)); E.box(0, 26, 13, E.len + 14, 28, 15, shade(AW, .78));
  N.text('LUCKY 7 DELI', N.len >> 1, 35, 15, 16, T, TOD.night ? 3 : 0, 1, 1); E.text('GROCERY · ATM', E.len >> 1, 35, 15, 16, T, TOD.night ? 3 : 0, 1, 1);
  const fruit = [0xff7a1a, 0xe8232a, 0x7bd12f, 0xffd93b, 0x7b3fb5];
  for (let k = 0; k < 2; k++) { const a0 = 10 + k * 34; E.box(a0, 0, 2, a0 + 30, 7, 9, (a, y, d) => (d === 8 && y % 2) ? 0x2a9a44 : 0x34b653);
    for (const [row, dd, yy] of [[0, 6, 9], [1, 3, 11]]) { E.box(a0 + 1, yy - 3, dd, a0 + 29, yy - 2, dd + 3, PAL.wood); E.box(a0 + 1, yy - 2, dd, a0 + 29, yy, dd + 3, (a, y, d) => shade(fruit[(k * 2 + row) % 5], hash(a, y, d) > .75 ? 1.18 : 1)); } }
  for (const y0 of [42, 70]) { for (const a0 of bays(N.len, 22)) win(N, a0 + 5, y0, 12, 17, T, { ac: hash(a0, y0) > .6 }); for (const a0 of bays(E.len, 22)) win(E, a0 + 5, y0, 12, 17, T, { ac: hash(a0, y0, 2) > .7 }); }
  // pass 1e: the back wall over the bar (seen from the roof party and Washington St) was blank: a painted error dialog, flush paint
  // with one voxel of relief on the lettering. West of a = 18 the bar's water tank stands in front of it.
  const SW = F('+z'), da = 18, dw = 60, GR = 0xe9e5dc;
  SW.box(da, 70, 0, da + dw, 100, 1, PAL.ink); SW.box(da + 1, 71, 0, da + dw - 1, 90, 1, GR); SW.box(da + 1, 90, 0, da + dw - 1, 99, 1, 0x2f5bff);
  SW.text('404.EXE', da + 3, 98, 0, 2, T); SW.box(da + dw - 10, 91, 0, da + dw - 3, 98, 1, GR); SW.text('X', da + dw - 9, 98, 0, 2, PAL.red);
  SW.text('SANDWICH', da + (dw >> 1), 88, 0, 2, PAL.ink, 0, 1, 1); SW.text('NOT FOUND', da + (dw >> 1), 79, 0, 2, PAL.ink, 0, 1, 1);
  meshVol(V, bank);
  // the BAIL BONDS board faces east down Central Ave, with bail.money (castspec.js) standing at its north end
  const top = SIDE + H * CV; meshVol(bailBoard(L.z0 + .2, top), bank);
  A.giants.push({ x: kerbX(-71.95), z: L.z0 + 1.05, y: top + 1.9, rot: 1, look: 'bail.money', ry: Math.PI / 2 + .45 });
  A.fruit = [L.x1 + .75, L.z0 + 3.2];
}
// Fit Street's own BAIL BONDS board (pass 1e; it was the shared billboard(0)). At 4× bail.money's head is 3 m deep, so on that
// board's 1.3 m catwalk it ran through the face and the lamps, and standing clear in front of it he hid BAIL from the corner. Here
// the phone strip runs the full 8.4 m, but the face above it stops 2.6 m short of the north end, where he stands on a deck at the
// catwalk's level that runs back from the strip (its legs behind, so nothing stands in front of a letter from any side): just
// behind the board's plane, his head clear above the face's top (5.4 m), his feet where they were on the old catwalk.
// Built in the facade kit's frame for the '+x' side: a runs south → north (left → right from the street), d toward the street.
// Rows (0.1 m over the roof): posts 0–10 · phone strip 10–19 (letters 11–17) · catwalk 18 · face 19–54 (BONDS 24–30, BAIL 33–51).
function bailBoard(z0, y) {
  const V = new Vol(20, 56, 84, { s: CV, org: [kerbX(-72.5), y, z0] }), f = frame(V, { x0: 0, z0: 0, x1: 14, z1: 84 }, '+x');
  const K = PAL.ink, BG = 0x2f5bff, FG = 0xffe23a, SB = 0x9a9ba2, NL = TOD.night ? 3 : 0, FW = 58, G = (a, yy, d) => (a + d) % 3 === 0 ? 0x2a2a30 : 0x3a3a42;
  for (const a of [2, 40, 79]) f.box(a, 0, -3, a + 3, 10, 0, K);                                                   // posts
  f.box(0, 10, -3, 84, 19, 1, K); f.text('1-800-GET-OUT', 42, 18, 1, 2, PAL.white, NL, 1, 1);                     // the phone strip, full width
  f.box(0, 18, 1, 84, 19, 6, G); f.box(0, 18, 5, 84, 19, 6, K);                                                    // catwalk (no rail: from the corner it crossed BONDS)
  f.box(FW, 18, -13, 84, 19, 6, G);                                                                                 // … widening into bail.money's deck
  for (const a of [FW + 2, 81]) f.box(a, 0, -13, a + 2, 18, -11, K); f.box(FW + 2, 8, -13, 83, 9, -12, K);         // … on its own legs, tied
  // steel back one voxel thick, the face two voxels of blue inside an ink ring: so the 2× (mid) and 5× (far) tiers keep a blue face
  // (a full ink sheet behind a one-voxel face tied with it in the downsample and the board went black from a distance)
  f.box(0, 19, -2, FW, 54, -1, SB); f.box(0, 19, -1, FW, 54, 1, BG);
  for (const [a0, y0, a1, y1] of [[0, 19, FW, 21], [0, 52, FW, 54], [0, 19, 2, 54], [FW - 2, 19, FW, 54]]) f.box(a0, y0, -1, a1, y1, 1, K);
  for (const yy of [26, 38, 48]) f.box(0, yy, -3, FW, yy + 1, -2, PAL.iron); for (let a = 5; a < FW; a += 13) f.box(a, 19, -3, a + 1, 54, -2, PAL.iron);
  const M = rasterMask('BAIL', '900 24px Impact, "Arial Black", sans-serif');
  for (let j = 0; j < M.h; j++) for (let i = 0; i < M.w; i++) if (M.at(i, j)) f.box(4 + i, 50 - j, 0, 5 + i, 51 - j, 1, K);   // drop shadow, painted flush
  f.mask(M, 3, 52, 1, 2, FG, NL); f.text('BONDS', 3, 31, 1, 2, FG, NL);                                            // one voxel proud: counters stay open at an angle
  f.box(44, 34, 1, 56, 52, 2, PAL.red); f.text('24', 45, 50, 2, 3, PAL.white, NL); f.text('HR', 45, 42, 2, 3, PAL.white, NL);   // the 24/HR tag
  for (const a of [12, 36]) { f.box(a, 54, -1, a + 2, 55, 6, K); f.box(a - 1, 52, 4, a + 3, 54, 7, 0xdfe6ee, TOD.night ? 3 : 2); }   // lamps
  return V;
}
function bar(bank, L, A) {        // DEAD AIR: violet, black front, neon, and the roof party (string lights, DJ, speakers, tank)
  const H = 66, { V, B } = heroVol(L.x0, L.z0, L.x1, L.z1, 12, ['+z', '+x']), RY = H;
  const F = mass(V, B, H, 0x7a3cff, PAL.white, ['+z', '+x']); neutralCap(V, B, H, 0x7a3cff, 0xb8b5ae); const S = F('+z'), E = F('+x');
  // pass 1e: the fascia starts at row 27, so it backs every row of the neon names (from row 30 their bottom two rows hung off it); the
  // S runs one voxel (black front) and two (fascia) past the corner, closing the notch where the two faces met
  for (const f of [S, E]) { f.box(0, 0, 0, f.len + (f === S), 36, 2, PAL.ink); f.box(0, 27, 0, f.len + 2 * (f === S), 36, 3, PAL.ink); }
  S.box(4, 1, -3, 18, 25, 1, AIR); S.box(4, 1, -3, 18, 25, -2, (a, y) => (y > 16 && y < 21 && a > 8 && a < 14) ? 0xffc766 : 0x7a1020, 1);
  for (const [f, a0, w] of [[S, 24, 31], [E, 10, 24], [E, 49, 27]]) { f.box(a0, 9, -2, a0 + w, 27, 2, AIR); f.box(a0, 9, -3, a0 + w, 27, -2, (a, y) => y > 20 ? 0xffd08a : 0xff9f45, 3); }
  // the OPEN neon hangs inside the (wider) south window, centred in a cyan tube frame; it used to run 4 voxels into the wall
  const NC = 0x2de2e6; S.box(26, 15, -2, 53, 16, -1, NC, 3); S.box(26, 25, -2, 53, 26, -1, NC, 3); S.box(26, 16, -2, 27, 25, -1, NC, 3); S.box(52, 16, -2, 53, 25, -1, NC, 3);
  S.text('OPEN', 39, 24, -2, -1, 0xff2d7a, 3, 1, 1); S.text('DEAD AIR', S.len >> 1, 35, 3, 4, PAL.pink, TOD.night ? 3 : 0, 1, 1); E.text('BAR · GRILL', E.len >> 1, 35, 3, 4, PAL.pink, TOD.night ? 3 : 0, 1, 1);
  // pass 1e: the Ivy St windows get their neon, a martini glass (cyan tubes, lime olive) and BEER, hung like OPEN in front of the glow
  for (let k = 0; k < 6; k++) { E.set(16 + k, 24 - k, -2, 0x2de2e6, 3); E.set(28 - k, 24 - k, -2, 0x2de2e6, 3); }
  E.box(16, 24, -2, 29, 25, -1, 0x2de2e6, 3); E.box(22, 14, -2, 23, 19, -1, 0x2de2e6, 3); E.box(19, 13, -2, 26, 14, -1, 0x2de2e6, 3); E.set(24, 21, -2, PAL.lime, 3); E.set(23, 22, -2, PAL.pink, 3);
  E.text('BEER', 62, 22, -2, -1, 0xffe23a, 3, 1, 1);
  for (const f of [S, E]) for (const a0 of bays(f.len, 24)) win(f, a0 + 5, 42, 13, 14, PAL.white, { ac: hash(a0, f.len) > .7 });
  // the dance floor, two voxels deep (pass 1e): one voxel over the violet fill tied in the 2× downsample, so from the overview (mid
  // tier) the checkerboard went flat violet
  V.box(B.x0 + 2, RY - 2, B.z0 + 2, B.x1 - 2, RY, B.z1 - 2, (x, y, z) => ((x >> 3) + (z >> 3)) & 1 ? 0xf7f7f2 : 0x17171b);
  const dx = B.x0 + 30, dz = B.z1 - 20; V.box(dx, RY, dz, dx + 16, RY + 8, dz + 5, PAL.ink); V.box(dx + 2, RY + 8, dz + 1, dx + 6, RY + 9, dz + 4, 0x55555f); V.box(dx + 10, RY + 8, dz + 1, dx + 14, RY + 9, dz + 4, 0x55555f);
  V.box(dx + 7, RY + 8, dz + 1, dx + 9, RY + 9, dz + 4, (x, y, z) => [PAL.lime, 0x2de2e6, PAL.pink][z % 3], 3);   // the mixer's lit faders between the decks
  for (const x of [dx - 8, dx + 17]) { V.box(x, RY, dz - 1, x + 7, RY + 15, dz + 5, PAL.ink); for (const [cy, r] of [[RY + 5, 2.4], [RY + 11, 1.6]]) for (let a = -3; a <= 3; a++) for (let c = -3; c <= 3; c++) if (Math.hypot(a, c) <= r) V.set(x + 3 + a, cy + c, dz - 2, a * a + c * c < 2 ? 0x9a9aa6 : 0x33333b); }
  // the cooler (pass 1e: it stood inside the water tank's north-west leg; now in the south-east corner, by the east speaker's side)
  const cx = B.x1 - 12, cz = B.z1 - 13; V.box(cx, RY, cz, cx + 7, RY + 6, cz + 5, 0x2f5bff); V.box(cx, RY + 6, cz, cx + 7, RY + 7, cz + 5, 0xffffff); V.box(cx + 2, RY + 4, cz - 1, cx + 5, RY + 5, cz, 0xffffff);
  const bulbs = [0xffe23a, 0xff4fa3, 0x2de2e6, 0x6cff4a, 0xff7a1a], poles = [[B.x0 + 3, B.z0 + 3], [B.x1 - 4, B.z0 + 3], [B.x1 - 4, B.z1 - 4], [B.x0 + 3, B.z1 - 4]];
  for (const [x, z] of poles) V.box(x, RY, z, x + 1, RY + 22, z + 1, PAL.iron);
  for (let k = 0; k < 4; k++) { const [x0, z0] = poles[k], [x1, z1] = poles[(k + 1) % 4], n = Math.round(Math.hypot(x1 - x0, z1 - z0));
    for (let t = 0; t <= n; t++) { const u = t / n, x = x0 + (x1 - x0) * u, z = z0 + (z1 - z0) * u, y = RY + 21 - Math.sin(u * Math.PI) * 5; V.set(x, y, z, PAL.iron); if (t % 5 === 2) V.set(x, y - 1, z, bulbs[(t / 5 | 0) % 5], 3); } }
  meshVol(V, bank); const RW = SIDE + RY * CV; stamp(tank(), bank, 0, L.x0 + 1.8, RW, L.z0 + 1.8);
  stamp(couch(0xffe23a), bank, 3, L.x0 + 1.1, RW, L.z0 + 6.6);                  // a yellow couch along the west parapet, facing the floor
  A.roof = [(L.x0 + L.x1) / 2 - .4, RW, (L.z0 + L.z1) / 2 - .6];
  // pass 1e: the booth gets its DJ (behind the decks, facing the floor), two more dancers and someone on the couch. The DJ and dancers
  // take the cast's placed-on-purpose poses; the four named dancers are spread over the floor in blocks/-3_0.js.
  const life = (x, z, ry, act, seed) => A.life.push({ x, y: RW, z, ry, act, seed });
  life(wx(V, dx + 8), L.z1 - .95, Math.PI, 'dj', 0xda01); life(L.x1 - 2.3, L.z0 + 7.6, -.9, 'dance', 0xda02); life(L.x0 + 3.1, L.z0 + 6.7, .2, 'dance', 0xda03);
  life(L.x0 + 1.25, L.z0 + 6.4, Math.PI / 2, 'sit', 0xda04);
}

