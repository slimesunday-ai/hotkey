// LOW TIDE DOCKS · THE SHIFT OFFICE and the dig site (block 2,−8) · owner: the supply agent. The sim's dock shift (rules WORK: 1 cr an
// hour from the city pool, only while you carry under 10, four hours a day) is paid out here; the goo and cloth site (80, −240) is the
// dig in the middle of the yard inside a painted hazard ring: broken slab, black mud, goo in the cracks and a pool. Where the stuff
// comes from is on show: a storm outfall bleeding lime goo into the bay, and a bonded container split open on the quay, its textile
// bales spilling out. The sim-state layer draws the piles themselves on the dig (DISTRICTS §4: 6.5 m around the point kept clear of
// props). No people: walkers only.
import { Vol } from '../vox.js';
import { AIR, TOD, frame } from '../kit.js';
import { blockCtx } from '../engine.js';
import { kitNamed } from '../modules.js';
import { C, PAL, CV, SIDE, REG, shade, hash, px, stencil, impact, vtext, vtextX, ftext, lit, doorAt, memo, pv, done, logSign } from '../districts/industrial/lib.js';
import { pallet, drums, forklift, cone, barrier, portaPotty, lightTower, postSign, generator } from '../districts/industrial/props.js';
import { floor, fence } from '../districts/industrial/yard.js';
import { quay, streetEnd, QUAY_Z } from '../districts/docks/parts.js';
import { framed, foot, sign } from '../districts/junkyard/parts.js';   // (SPREAD: the block's frame)
import { off, atB } from '../districts/frame.js';

const SITE = { x: 80, z: -240, r: 6.5 };
// the sim's spill tub (simstate/layer.js: 4.6 m east and 2.2 m south of the point, 3.2 m square) reaches past the ring onto the apron:
// that square is left out of the apron and drawn with the dig, half a voxel down, so no face of it is coplanar with the tub's base rows
const SPILL = [SITE.x + 3, SITE.z + .6, SITE.x + 6.2, SITE.z + 3.8], inSpill = (x, z) => x > SPILL[0] && x < SPILL[2] && z > SPILL[1] && z < SPILL[3];
export function shiftOffice(bank, b, A) {
  const kit = kitNamed('docks'), ctx = blockCtx(bank, b, A, kit); REG.strict = true;
  try { build(framed(ctx)); ctx.finish(); } finally { REG.strict = false; }
}
const OFFICE = [68.5, -252, 72.9, -235.5], STAIR = [68.5, -253.4, 73.2, -252], OUTFALL = [69.5, -260.5, 72.9, -254.8], BOX = [75.4, -252.4, 87.7, -248.1];
function build(ctx) {
  // the site is the dig (below); the rest of the yard is the concrete apron with the hazard ring painted round it
  ctx.group('apron'); const around = (r, m) => [r[0] - m, r[1] - m, r[2] + m, r[3] + m];
  floor(ctx, [68, -255.4, 92, -230.1], 'conc', [around(OFFICE, .3), around(STAIR, .1), around(OUTFALL, .1), BOX], {
    paint: (x, z) => { const d = Math.hypot(x - SITE.x, z - SITE.z); if (d < SITE.r || inSpill(x, z)) return -1; return d < SITE.r + .5 ? stripe(x, z) : null; } });
  ctx.group('dig'); dig(ctx); ctx.put(barrow(), 74.4, -233.9, { rot: 1, reach: .6 });
  ctx.group('office'); office(ctx); for (const t of ['DOCK SHIFT', 'PUNCH IN HERE', 'LOW TIDE PORT AUTHORITY', 'NOW HIRING', 'CASH EVERY HOUR', 'GATE 4', 'BONDED CARGO DO NOT SALVAGE', '1 CR / HR 4 HRS MAX BROKE ONLY', 'COFFEE', 'BEC $4']) sign(ctx, t, 76, -240);
  ctx.group('fence'); fence(ctx, [68, -230.2, 92, -230], ['+z'], 'chain', '+z', [], { gateAt: 80, gateW: 7 }); booth(ctx, 87.4, -232.4); banner(ctx, 68.6, 75.9, -230);
  // the ring: hazard barriers on the far side of the site, cones on the gate side
  ctx.group('ring'); for (const a of [250, 280, 310, 340]) { const t = a * Math.PI / 180; ctx.put(barrier(C.hazard), SITE.x + Math.cos(t) * 7.5, SITE.z + Math.sin(t) * 7.5, { rot: Math.abs(Math.sin(t)) > .7 ? 0 : 1, reach: .5, slide: [-Math.sin(t), Math.cos(t)] }); }
  for (const a of [45, 72, 118, 152]) { const t = a * Math.PI / 180; ctx.put(cone(), SITE.x + Math.cos(t) * 7.2, SITE.z + Math.sin(t) * 7.2, { reach: .4 }); }
  ctx.group('cargo'); bondedBox(ctx); outfall(ctx);
  ctx.put(postSign(['BONDED CARGO', 'DO NOT SALVAGE'], C.chalk, C.red, { post: 11, border: C.red }), 89.6, -249.8, { rot: 3, reach: 1 });
  ctx.put(postSign(['1 CR / HR', '4 HRS MAX', 'BROKE ONLY'], C.chalk, C.ink, { post: 24, face: 'stencil', border: C.red, s: .05 }), 74.4, -250.7, { rot: 1, reach: .8, slide: [0, 1] });
  // the east side: the lunch truck at shift change, the can, light towers over the site, drums, the forklift that never moves
  ctx.group('east'); ctx.put(lunchTruck(), 89.3, -238.6, { rot: 0, reach: 1.2 }); ctx.put(portaPotty(0x2f5bff), 90.7, -246.2, { rot: 3, reach: .6 });
  ctx.put(lightTower(), 89.9, -233.1, { reach: .8 }); ctx.put(lightTower(), 74.2, -254.6, { reach: .8 }); ctx.put(drums(C.green, 3), 90.3, -251.6, { reach: .8 }); ctx.put(forklift(C.hazard), 86.6, -254.2, { rot: 1, reach: 1 });
  ctx.put(generator(C.hazard), 79.5, -254.7, { reach: 1 }); ctx.put(pallet('empty', 1), 76.6, -254.8, { reach: 1 });
  ctx.group('quay'); quay(ctx, 66, 94, { gaps: [[OUTFALL[0] - .1, OUTFALL[2] + .1]] }); ctx.group('street-end'); streetEnd(ctx, 94, 98);
}

// ── the dig: inside the ring the slab is broken up. Concrete plates split, heaved or gone at the rim, black mud where it's been dug,
// the goo coming up through the cracks and standing in a pool in the middle (lime, the sim tub's colours; it glows at night). The
// layer sits half a voxel down (SIDE − 0.05 … + 0.05): the sim's tubs and bales stand on SIDE at the point, and none of their faces
// (0.1 grain from SIDE) can be coplanar with it
const stripe = (x, z) => ((Math.atan2(z - SITE.z, x - SITE.x) * 12 / Math.PI + 48) | 0) % 2 ? C.hazard : C.ink;
function dig(ctx) {
  const r = SITE.r, x0 = SITE.x - r, z0 = SITE.z - r, V = ctx.volume(x0, SIDE - CV / 2, z0, SITE.x + r, SIDE + CV * 1.5, SITE.z + r, { walk: true }), gl = TOD.night ? 3 : 1;
  const GOO = 0x6cff4a, GOOD = 0x25b84c, MUD = 0x3a3129, MUDD = 0x2b251e, WET = 0x4b4136, TAU = Math.PI * 2, VEINS = [12, 64, 118, 166, 214, 262, 312].map(a => a * Math.PI / 180);
  for (let x = 0; x < V.nx; x++) for (let z = 0; z < V.nz; z++) {
    const wx = x0 + (x + .5) * CV, wz = z0 + (z + .5) * CV, dx = wx - SITE.x, dz = wz - SITE.z, d = Math.hypot(dx, dz), a = Math.atan2(dz, dx);
    if (d >= r) { if (inSpill(wx, wz)) V.set(x, 0, z, d < r + .5 ? stripe(wx, wz) : C.conc); continue; }
    const w = Math.sin(d * 1.7 + a * 2) * .07 + Math.sin(d * 4.3) * .03, edge = 5 + Math.sin(a * 4 + 2) * .3 + Math.sin(a * 9) * .12;
    const vein = d > .6 && VEINS.some(v => Math.abs((((a - v - w) % TAU) + TAU * 1.5) % TAU - Math.PI) * d < .06 + d * .016);
    if (d > edge) {   // the broken slab: plates split by wobbling radial cracks and a ring crack; some heaved a voxel, some gone to mud
      const sec = (a / TAU + 1) * 9 + Math.sin(d * 3 + a) * .18, ring = 5.75 + Math.sin(a * 5) * .22, plate = (sec | 0) + (d > ring ? 20 : 0), h = hash(plate, 3, 53);
      if (vein) { V.set(x, 0, z, GOO, gl); continue; }
      if (Math.abs(d - ring) < .06 || Math.abs(sec - Math.round(sec)) * TAU / 9 * d < .05 || h > .82) { V.set(x, 0, z, h > .82 ? MUD : MUDD); continue; }
      V.set(x, 0, z, C.conc); if (h > .5) V.set(x, 1, z, shade(C.conc, .93)); continue; }
    const pr = 1.9 + Math.sin(a * 3 + 1) * .35 + Math.sin(a * 7) * .12;
    if (d < pr) { V.set(x, 0, z, hash(x >> 1, z >> 1, 5) > .86 ? GOOD : GOO, gl); continue; }
    if (d < pr + .2) { V.set(x, 0, z, GOOD, 1); continue; }
    if (vein || (d < 4.6 && hash((wx * 2.5) | 0, (wz * 2.5) | 0, 47) > .94)) { V.set(x, 0, z, GOO, gl); continue; }
    V.set(x, 0, z, hash(x >> 1, z >> 1, 61) > .8 ? MUDD : hash(x >> 2, z >> 2, 67) > .85 ? WET : MUD);
    if (d > 2.4 && d < 4.4 && hash(x >> 1, z >> 1, 71) > .9) V.set(x, 1, z, MUD); }   // clods thrown up by the shovels
}
// a wheelbarrow of goo parked outside the ring, a shovel across it
const barrow = () => memo('goobarrow', () => { const V = pv(8, 7, 17), gl = TOD.night ? 3 : 1;
  V.box(3, 0, 0, 5, 3, 3, C.rubber); for (const x of [2, 5]) V.box(x, 0, 9, x + 1, 2, 10, C.steelD);
  V.box(1, 2, 1, 7, 5, 10, 0x2f5bff); V.box(2, 3, 2, 6, 5, 9, 0x6cff4a, gl); for (const x of [1, 6]) V.box(x, 3, 10, x + 1, 4, 17, C.steelD);
  V.box(3, 5, 0, 4, 6, 14, C.woodD); V.box(2, 5, 0, 5, 6, 2, C.steelL); return done(V, 'barrow'); });
// ── the office: the ground cabin (cobalt), the upper cabin (safety orange) set back behind a gallery, a steel stair up the north end. The
// time clock by the ground-floor door faces the site: DOCK SHIFT · PUNCH IN HERE, the clock, the card rack.
function office(ctx) {
  const [x0, z0, x1, z1] = OFFICE, night = TOD.night, low = ctx.building(x0, z0, x1, z1, { h: 2.9, wall: C.cobalt, trim: C.chalk, faces: [], cornice: false, parapet: 0, roof: 0xd2d3d6 });
  const f = low.F('+x'), L = f.len;                                   // a runs north from the south end (z1), d out toward the site
  f.box(0, 0, 0, L, 2, 1, shade(C.cobalt, .7));
  const d = 20; f.box(d - 1, 0, 0, d + 13, 23, 1, C.chalk); f.box(d, 1, -2, d + 12, 22, 1, AIR); f.box(d, 1, -3, d + 12, 22, -2, (a, y) => y > 17 && a > d + 2 && a < d + 10 ? 0xffe3a0 : 0x2a2d38, 1); doorAt(f, d + 6, '+x');
  f.box(d - 2, 23, 0, d + 14, 25, 3, C.steelD); f.box(d + 5, 26, 0, d + 8, 28, 2, 0xffe9b0, night ? 3 : 1);
  // the clock and the card rack left of the door
  f.box(d - 12, 11, 0, d - 4, 21, 2, 0xe6e6ea); face(f, d - 8, 16, 2.6); f.box(d - 20, 7, 0, d - 14, 23, 1, C.steelD); for (let y = 8; y < 22; y += 2) f.box(d - 19, y, 1, d - 15, y + 1, 2, [C.chalk, C.hazard, 0xff9f45, C.chalk][(y >> 1) & 3]);
  // DOCK SHIFT on a red board right of the door, PUNCH IN HERE under it; lit at night
  const T1 = px('DOCK SHIFT'), R1 = px('PUNCH IN HERE'), tw = Math.max(T1.w * 2, R1.w) + 6, t0 = d + 15;
  f.box(t0, 3, 0, t0 + tw, 28, 2, C.red, night ? 3 : 0); ftext(f, T1, t0 + (tw >> 1), 26, { sc: 2, c: C.chalk, d0: 2, d1: 3, l: night ? 3 : 0 }); ftext(f, R1, t0 + (tw >> 1), 11, { c: C.hazard, d0: 2, d1: 3 });
  for (const a of [t0 + tw + 8]) if (a + 14 < L - 2) { f.box(a - 1, 9, 0, a + 15, 22, 1, C.chalk); f.box(a, 10, -2, a + 14, 21, 1, AIR); f.box(a, 10, -3, a + 14, 21, -2, night ? C.lit : PAL.glassLo, night ? 3 : 1); }
  const fz = low.F('+z'); fz.box(5, 9, 0, fz.len - 5, 21, 1, C.chalk); fz.box(6, 10, -2, fz.len - 6, 20, 1, AIR); fz.box(6, 10, -3, fz.len - 6, 20, -2, night ? C.lit : PAL.glassLo, night ? 3 : 1);
  // the upper cabin on the lower roof: 0.6 back from the east face (the gallery), 0.4 back from the south end
  const ux1 = x1 - .6, uz1 = z1 - .4, nx = Math.round((ux1 - x0) / CV), nz = Math.round((uz1 - z0) / CV), up = new Vol(nx + 8, 34, nz + 8, { s: CV, org: [x0 - .4 + off(ctx)[0], SIDE + 2.9, z0 - .4 + off(ctx)[1]] }), B = { x0: 4, z0: 4, x1: 4 + nx, z1: 4 + nz };
  up.box(B.x0, 0, B.z0, B.x1, 28, B.z1, 0xff7a1a); up.box(B.x0 + 1, 27, B.z0 + 1, B.x1 - 1, 28, B.z1 - 1, 0xd2d3d6); up.box(B.x0, 28, B.z0, B.x1, 30, B.z1, C.ink); up.clear(B.x0 + 1, 28, B.z0 + 1, B.x1 - 1, 30, B.z1 - 1);
  up.clear(B.x0 + 5, 3, B.z0 + 5, B.x1 - 5, 24, B.z1 - 5);
  const g = frame(up, B, '+x'); for (let a = 8; a + 14 < g.len - 6; a += 26) { g.box(a - 1, 4, 0, a + 15, 17, 1, C.chalk); g.box(a, 5, -2, a + 14, 16, 1, AIR); g.box(a, 5, -3, a + 14, 16, -2, night && (a >> 3) % 3 ? C.lit : PAL.glassHi, night && (a >> 3) % 3 ? 3 : 1); }
  const T2 = px('LOW TIDE PORT AUTHORITY'); if (T2.w < g.len - 8) { g.box((g.len >> 1) - (T2.w >> 1) - 3, 18, 0, (g.len >> 1) + (T2.w >> 1) + 4, 27, 1, C.chalk); ftext(g, T2, g.len >> 1, 26, { c: C.cobalt, d0: 1, d1: 2 }); }
  const gz = frame(up, B, '+z'); gz.box(3, 5, 0, gz.len - 3, 17, 1, C.chalk); gz.box(4, 6, -2, gz.len - 4, 16, 1, AIR); gz.box(4, 6, -3, gz.len - 4, 16, -2, PAL.glassLo, 1);
  ctx.mass(up, [x0, z0, ux1, uz1], { top: SIDE + 2.9 + 3.0, roofY: SIDE + 2.9 + 2.8 });
  // the gallery along the east edge of the lower roof and the stair up the north end
  const gal = ctx.volume(ux1 + .1, SIDE + 2.9, z0, x1 + .3, SIDE + 4.1, z1 - .1, {}); gal.box(0, 0, 0, gal.nx, 1, gal.nz, C.steelD); gal.box(gal.nx - 1, 1, 0, gal.nx, 11, gal.nz, (x, y, z) => (y === 10 || z % 8 === 0) ? C.hazard : undefined);
  const [sx0, sz0, sx1, sz1] = STAIR, st = ctx.volume(sx0, SIDE, sz0, sx1, SIDE + 2.9, sz1, {}), n = st.nx;
  for (let k = 0; k < 14; k++) { const a = Math.round(k * (n - 4) / 13); st.box(a, 0, 1, a + 4, Math.min(29, 2 + k * 2), 12, k === 13 ? C.steelD : C.steelL); }
  for (let x = 0; x < n; x += 6) st.box(x, 0, 12, x + 1, Math.min(29, 3 + Math.round(x * .6)), 13, C.hazard);
}
// a round clock face: painted discs on the clock box, the hands in ink
function face(f, a, y, r) { for (let da = -3; da <= 3; da++) for (let dy = -3; dy <= 3; dy++) if (Math.hypot(da, dy) <= r) f.box(Math.round(a + da), Math.round(y + dy), 2, Math.round(a + da) + 1, Math.round(y + dy) + 1, 3, C.chalk);
  f.box(Math.round(a), Math.round(y), 3, Math.round(a) + 1, Math.round(y) + 3, 4, C.ink); f.box(Math.round(a), Math.round(y), 3, Math.round(a) + 2, Math.round(y) + 1, 4, C.ink); }
// the guard booth at the gate: a white box with windows all round, GATE 4 on a red band
function booth(ctx, x, z) { const V = ctx.volume(x - .9, SIDE + CV, z - .9, x + .9, SIDE + 3.1, z + .9, { keep: 'booth' }), n = V.nx;
  V.box(0, 0, 0, n, 30, n, C.chalk); V.box(1, 9, 0, n - 1, 20, n, TOD.night ? C.lit : PAL.glassLo, TOD.night ? 3 : 1); V.box(0, 9, 3, n, 20, n - 3, C.chalk); V.box(0, 21, 0, n, 30, n, C.red);
  const M = px('GATE 4'); vtext(V, M, (n - M.w) >> 1, 28, n - 1, C.chalk, {}); foot(ctx, x - .9, z - .9, x + .9, z + .9, SIDE + 3.1, SIDE + 3.1); }
// NOW HIRING · CASH EVERY HOUR on a vinyl banner tied to the outside of the chain-link (board at z 0, letters at z 1)
function banner(ctx, xa, xb, z) { const T = impact('NOW HIRING', 12), S = px('CASH EVERY HOUR'), n = Math.round((xb - xa) / CV), V = ctx.volume(xa, SIDE + .6, z, xa + n * CV, SIDE + 2.1, z + 2 * CV, { keep: 'banner' });
  V.box(0, 0, 0, n, V.ny, 1, C.red); V.box(0, 0, 1, n, 1, 2, C.chalk); V.box(0, V.ny - 1, 1, n, V.ny, 2, C.chalk);
  if (T.w < n - 4) vtext(V, T, (n - T.w) >> 1, V.ny - 3, 1, C.chalk, { dir: 1 }); if (S.w < n - 4) vtext(V, S, (n - S.w) >> 1, V.ny - 5 - T.h, 1, C.hazard, { dir: 1 }); }
// the bonded container split open: its doors gone, one leaf hanging along the side, bales tumbling out toward the site
function bondedBox(ctx) { const [x0, z0] = BOX, L = 122, W = 24, Hh = 26, V = ctx.volume(x0, SIDE + CV, z0, x0 + (L + 1) * CV, SIDE + CV + 2.8, z0 + (W + 19) * CV, {}), col = 0x8c52ff, dark = shade(col, .65);
  V.box(0, 0, 0, L, Hh, W, col); V.clear(3, 2, 3, L - 1, Hh - 3, W - 3); for (let x = 4; x < L - 4; x += 4) { V.box(x, 2, 0, x + 1, Hh - 2, 1, dark); V.box(x, 2, W - 1, x + 1, Hh - 2, W, dark); }
  V.box(0, 0, 0, L, 2, W, dark); const M = px('FOGHORN'); vtext(V, M, (L - M.w * 2) >> 1, 20, W - 1, C.chalk, { sc: 2 });
  V.clear(L - 1, 2, 2, L, Hh - 2, W - 2);                                                                                   // the doors are off the +x end
  V.box(L - 1, 2, W, L, Hh - 3, W + 11, shade(col, .86)); for (let y = 4; y < Hh - 4; y += 6) V.box(L - 1, y, W + 2, L, y + 1, W + 10, C.steelL);   // one leaf swung round
  const BL = [[0xe8232a, 0xf7f7f2], [0x2f5bff, 0xffe23a], [0x14a83b, 0xff4fa3], [0xff7a1a, 0x2de2e6]];
  for (let k = 0; k < 9; k++) { const inside = k < 5, bx = inside ? 88 + (k % 3) * 9 : 60 + (k - 5) * 13, bz = inside ? 4 + ((k / 3) | 0) * 8 : W + 5 + (k % 2) * 6, by = inside ? 2 : 0, [c1, c2] = BL[k % 4];
    V.box(bx, by, bz, bx + 8, by + 6, bz + 6, (xx, yy) => (yy - by) % 2 ? c1 : c2); V.box(bx + 3, by, bz, bx + 4, by + 6, bz + 6, C.ink); }
  foot(ctx, x0, z0, x0 + L * CV, z0 + W * CV, SIDE + 2.9, SIDE + 2.9); REG.keep(atB(ctx, [x0, SIDE, z0 + W * CV, x0 + L * CV, SIDE + .8, z0 + (W + 19) * CV]), 'bales'); }
// the storm outfall: a concrete headwall on the quay, the pipe mouth over the water, lime goo running out and a slick on the bay
function outfall(ctx) { const [x0, z0, x1, z1] = OUTFALL, V = ctx.volume(x0, -.2, z0, x1, SIDE + 1.6, z1, {}), cx = V.nx / 2, g = 0x6cff4a, glow = TOD.night ? 3 : 1, zq = Math.round((QUAY_Z - z0) / CV);
  V.box(0, 0, zq, V.nx, V.ny, V.nz, (x, y) => (y >= 2 && y <= 18 && Math.hypot(x + .5 - cx, y + .5 - 10) < 7.2) ? undefined : C.concD);
  for (let z = zq - 15; z < zq + 2; z++) for (let x = 0; x < V.nx; x++) for (let y = 0; y < 20; y++) { const dd = Math.hypot(x + .5 - cx, y + .5 - 10); if (dd <= 8.4) V.set(x, y, z, dd < 7.2 ? (z < zq - 13 ? g : 0x22252c) : C.conc, dd < 7.2 && z < zq - 13 ? glow : 0); }
  for (let z = zq - 23; z < zq - 14; z++) for (let x = Math.floor(cx - 4); x < cx + 4; x++) V.box(x, 2, z, x + 1, Math.max(3, 3 + Math.round((z - (zq - 23)) * .8)), z + 1, g, glow);   // the run into the bay
  for (let x = 0; x < V.nx; x++) for (let z = 0; z < zq - 13; z++) if (Math.hypot(x + .5 - cx, (z - (zq - 25)) * 1.5) < 16 + (hash(x >> 1, z >> 1, 3) - .5) * 4) V.set(x, 2, z, g, glow);   // the slick
  REG.keep(atB(ctx, [x0, -.2, z0, x1, SIDE + 1.6, z1]), 'outfall'); }
// the lunch truck that parks inside the gate at shift change (its menu on the service-window side)
const lunchTruck = () => memo('lunchtr', () => { const W = 24, V = pv(W, 32, 62); for (const z of [12, 50]) for (const x of [0, W - 3]) V.box(x, 0, z - 4, x + 3, 7, z + 4, C.rubber);
  V.box(1, 4, 2, W - 1, 30, 46, 0xf4f4f0); V.box(1, 4, 46, W - 1, 20, 60, 0xf4f4f0); V.box(2, 12, 59, W - 2, 19, 60, 0x9fd8ff, 1); V.box(1, 29, 2, W - 1, 31, 46, C.red);
  V.box(W - 1, 13, 8, W, 24, 38, 0x2a2d38); V.box(W - 1, 24, 6, W, 26, 40, C.red);
  const M = px('COFFEE'), N = px('BEC $4'); vtextX(V, M, 6 + ((40 - M.w) >> 1), 22, W - 1, 0xffe23a, { dir: 1, l: lit() }); vtextX(V, N, 6 + ((40 - N.w) >> 1), 11, W - 1, C.red, { dir: 1 });
  return done(V, 'truck'); });
