// ROUTE 9 + MOTEL 9 · the two blocks at the highway edge of town (owner: the St. Mercy / Route 9 agent). Route 9 runs north along
// x = 224 to the Long Bridge and Iron Island; these are the last lit lots before it. Authored in world metres (hospital/lib.js slice).
//   (7,4) LAST CHANCE: the gas canopy and its pump island, the food mart (FOOD BEER ICE LOTTO, a billboard on its roof facing the
//         highway), the price pylon, the air machine, the payphone, and a semi on the shoulder with its back doors open on a load of
//         shoe boxes that fell off a truck
//   (7,5) MOTEL 9: a pink two-storey wing of twelve rooms with its walkway and stair, the googie office, the pole sign with the big neon
//         9, the pool behind its fence, the ice machine; the loan shark works out of room 9, upstairs
import { C, CV, SIDE, TOD, REG, AIR, lit, H, shade, slice, solid, part, fin, logSign, door, px, mini, impact, script, tubeOf, innerOf, vtext, vtextX, clipR, span, col, walls, parapet, at, atR, life, kerbX, kerbZ } from '../hospital/lib.js';   // (SPREAD: frame metres → the spread world, hospital/lib.js)
import { win } from '../../kit.js';
import { SPREAD } from '../../../../world/city.js';
import * as XP from './props.js';
import * as HP from '../hospital/props.js';
import { lawnChair, trashCan, newsBox, dumpster, dish } from '../../props.js';
import { roofBillboard } from '../../signage/index.js';
import { paintedAd, mural } from '../../facade.js';
import { stamp } from '../../vox.js';

// a walkable surface: a world rect minus holes, painted by fn(x, z) in world metres (its top voxel; two more under the slab's plane)
function surface(ctx, rects, fn, holes = []) {
  for (const r of rects) { const c = clipR(ctx, r); if (!c) continue; const [vx0, vz0, vx1, vz1] = atR(ctx, c), V = ctx.volume(vx0, SIDE - .2, vz0, vx1, SIDE + CV, vz1, { walk: true });   // (two layers under the slab's plane: the far tier keeps it)
    V.box(0, 0, 0, V.nx, 3, V.nz, (x, y, z) => { const wx = c[0] + (x + .5) * CV, wz = c[1] + (z + .5) * CV; return holes.some(h => wx > h[0] && wx < h[2] && wz > h[1] && wz < h[3]) ? undefined : fn(wx, wz); }); } }
const noise = (x, z, k = 0) => H(Math.floor(x / .3) + 7000, Math.floor(z / .3) + 7000, 23 + k);
const in2 = (x, z, r) => x > r[0] && x < r[2] && z > r[1] && z < r[3];

// ═════════ (7,4) · LAST CHANCE
export const GAS = { mart: [244.4, 136, 252, 154], canopy: [234.4, 137.6, 244.2, 152.4], island: [238.4, 139.2, 239.6, 150.8], pylon: [234.8, 135.3] };
function gasGround(ctx) {
  ctx.group('apron');
  surface(ctx, [[233, 134, 252, 156]], (x, z) => { const n = noise(x, z);
    if ((Math.abs(((x - 233) % 3.0)) < .1) || (Math.abs(((z - 134) % 3.0)) < .1)) return 0xb4ad9f;                               // expansion joints every 3 m
    if ((in2(x, z, [236.0, 140.4, 237.2, 149.6]) || in2(x, z, [240.8, 140.4, 242.0, 149.6])) && n > .55) return 0x8c8578;          // oil where the cars stop
    if (z > 153.4 && z < 153.6 && x > 234.4 && x < 243.6) return C.chalk;                                                         // the stop line
    return n > .9 ? 0xd2ccbf : n < .12 ? 0xbcb5a8 : C.conc; }, [GAS.mart, GAS.island]);
}
function mart(ctx) {
  const R = GAS.mart, S = slice(ctx, R, SIDE, SIDE + 5.6, { pad: 1.2 }); if (!S) return;
  const Hh = 44, W = C.bone, T = C.ink, RD = C.sRed, Y = C.yellow;
  walls(S, Hh, W); parapet(S, Hh, 5, W, C.chalk);
  for (const side of ['-x', '-z', '+z', '+x']) { const f = S.F(side), L = f.len; f.box(0, 1, 0, L, 4, 2, 0x8f8b84); f.box(-1, 33, 0, L + 1, 35, 2, Y); f.box(-1, 42, 0, L + 1, 44, 2, RD); }   // the brand stripes
  // the front on the pumps: glass full of posters, the door, FOOD BEER ICE LOTTO on the red band
  const f = S.F('-x'), L = f.len; f.box(0, 35, 0, L, 42, 2, RD); f.text('FOOD BEER ICE LOTTO', L >> 1, 41, 2, 3, C.chalk, lit(0), 1, 1);
  logSign(ctx, 'FOOD BEER ICE LOTTO', R[0], (R[1] + R[3]) / 2);
  f.box(6, 3, -2, L - 6, 30, 1, AIR); f.box(6, 3, -3, L - 6, 30, -2, (a, y) => TOD.night ? (y > 20 ? C.lit : C.litLo) : (y > 22 ? C.glassHi : ((a + y) % 17 === 0 ? 0xeaf6ff : 0x2f5d9a)), TOD.night ? 3 : 1);
  for (let a = 6; a < L - 5; a += 20) f.box(a, 3, -2, a + 1, 30, 0, C.steelL, 2); f.box(6, 30, -2, L - 6, 31, 1, C.steelL, 2);
  const [d0, d1] = span(S, '-x', 144.4, 146.0); f.box(d0, 3, -3, d1, 28, -2, (a) => a === ((d0 + d1) >> 1) ? C.steelL : (TOD.night ? 0xfff0c8 : 0x1b2a55), TOD.night ? 3 : 1); door(R[0], 145.2, '-x');
  // the posters (window vinyl): each a panel with its words, stuck on the glass
  const poster = (u0, u1, y0, y1, bg, fg, lines) => { const [a0, a1] = span(S, '-x', u0, u1); f.box(a0, y0, -2, a1, y1, -1, bg); lines.forEach((s, n) => f.mask(mini(s), ((a0 + a1) >> 1) - (mini(s).w >> 1), y1 - 2 - n * 7, -1, 0, fg, 0, 1)); };
  poster(137.2, 141.0, 16, 26, C.sYellow, C.sRed, ['COLD', 'BEER']); poster(141.6, 143.6, 18, 26, 0x14a83b, C.chalk, ['LOTTO']);
  poster(146.8, 148.8, 18, 26, C.cobalt, C.chalk, ['ATM']); poster(149.4, 153.2, 12, 26, C.chalk, 0x14a83b, ['WE CASH', 'PAY-', 'CHECKS']);
  // the north side on Union Ave: a painted ad from the city's pool; the back on Pike Rd: a condenser, pipes, the back door
  { const g = S.F('-z'), Lg = g.len; paintedAd(g, 6, 6, Lg - 12, 24, null, C.cobalt, C.chalk); }
  { const g = S.F('+x'), [b0, b1] = span(S, '+x', 147.0, 148.4); g.box(b0 - 1, 1, 0, b1 + 1, 26, 1, C.steelD); g.box(b0, 1, -1, b1, 24, 1, AIR); g.box(b0, 1, -2, b1, 24, -1, 0x6d707a, 2); door(R[2], 147.7, '+x');
    for (const u of [139.0, 151.0]) { const [a0] = span(S, '+x', u, u + .2); g.box(a0, 2, 0, a0 + 2, 42, 2, 0x9aa0a8, 2); } }
  solid(ctx, S, SIDE + 5.0, SIDE + 4.4);
}
function canopy(ctx) {
  const [x0, z0, x1, z1] = GAS.canopy, S = slice(ctx, GAS.canopy, SIDE + .3, SIDE + 6.2, { pad: .4 }); if (!S) return;   // (from the island's top: the columns stand on it)
  const box = S.box, y = SIDE + 4.8, Y = C.yellow, RD = C.sRed;
  box(x0, y, z0, x1, y + .3, z1, C.chalk); box(x0, y + .3, z0, x1, y + .4, z1, (x, yy, z) => { const e = Math.min(S.wx(x) - x0, x1 - S.wx(x), S.wz(z) - z0, z1 - S.wz(z)); return e < .5 ? RD : Y; });   // the slab, its yellow top (the overhead's read)
  for (const [a, b, c, d] of [[x0, z0, x1, z0 + .2], [x0, z1 - .2, x1, z1], [x0, z0, x0 + .2, z1], [x1 - .2, z0, x1, z1]]) { box(a, y - .2, b, c, y + .9, d, Y); box(a, y + .9, b, c, y + 1.0, d, RD); box(a, y - .2, b, c, y - .1, d, RD); }   // the fascia
  for (let x = x0 + 1.2; x < x1 - 1; x += 2.2) for (let z = z0 + 1.2; z < z1 - 1; z += 2.6) box(x, y - .1, z, x + .8, y, z + .8, TOD.night ? 0xffffff : 0xf2f2ea, lit(1));   // the lights under it
  // LAST CHANCE on the highway side and on Union Ave's; LAST GAS BEFORE BRIDGE on the side the northbound traffic sees
  { const M = px('LAST CHANCE'), zc = (z0 + z1) / 2; vtextX(S.V, M, S.Z(zc) - (M.w >> 1), S.Y(y + .8), S.X(x0) - 1, RD, { dir: -1, l: lit(0) }); }
  { const M = px('LAST CHANCE'), xc = (x0 + x1) / 2; vtext(S.V, M, S.X(xc) - (M.w >> 1), S.Y(y + .8), S.Z(z0) - 1, RD, { dir: -1, l: lit(0) }); }
  { const M = mini('LAST GAS BEFORE BRIDGE', 2), xc = (x0 + x1) / 2 + .2; vtext(S.V, M, S.X(xc) - (M.w >> 1), S.Y(y + .7), S.Z(z1), RD, { l: lit(0) }); }   // (it starts clear of the corner lamp pole in the street cameras' view)
  logSign(ctx, 'LAST CHANCE', x0, (z0 + z1) / 2); logSign(ctx, 'LAST GAS BEFORE BRIDGE', (x0 + x1) / 2, z1);
  // the columns on the island
  for (const z of [140.0, 149.6]) box(238.8, SIDE + .3, z, 239.2, y, z + .4, C.chalk);
  part(ctx, S, [[238.8, SIDE, 140.0, 239.2, y, 140.4], [238.8, SIDE, 149.6, 239.2, y, 150.0], [x0, y - .2, z0, x1, y + 1, z1]]);
  // the island: a concrete curb with yellow ends, under the columns
  const I = slice(ctx, GAS.island, SIDE, SIDE + .3, { pad: .1 }); if (I) { const [a, b, c, d] = GAS.island; I.box(a, SIDE, b, c, SIDE + .3, d, (x, yy, z) => { const wz = I.wz(z); return wz < b + .5 || wz > d - .5 ? Y : C.concL; }); solid(ctx, I, SIDE + .3, SIDE + .3, { plinth: false }); }
}
function pylon(ctx) {
  const [px0, pz] = GAS.pylon, S = slice(ctx, [px0 - 2.0, pz - .3, px0 + 2.0, pz + .3], SIDE + CV, SIDE + 7.8, { pad: .2 }); if (!S) return;
  const box = S.box, V = S.V, x0 = px0 - 1.9, x1 = px0 + 1.9, Y = C.yellow, RD = C.sRed, INK = 0x101216;
  for (const x of [px0 - 1.1, px0 + .8]) box(x, SIDE + CV, pz - .15, x + .3, SIDE + 3.4, pz + .15, C.steelD, 2);           // the legs
  box(x0, SIDE + 3.4, pz - .15, x1, SIDE + 7.6, pz + .15, INK); box(x0, SIDE + 5.2, pz - .15, x1, SIDE + 7.6, pz + .15, Y); box(x0, SIDE + 7.6, pz - .15, x1, SIDE + 7.7, pz + .15, RD);
  const zS = S.Z(pz + .15), zN = S.Z(pz - .15) - 1;
  for (const [z, dir] of [[zS, 1], [zN, -1]]) {
    for (const [s, yt] of [['LAST', 7.4], ['CHANCE', 6.5]]) { const M = px(s); vtext(V, M, S.X(px0) - (M.w >> 1), S.Y(SIDE + yt), z, RD, { dir, l: lit(0) }); }
    for (const [lab, price, yt, c] of [['REG', '3.99', 4.9, 0x6cff4a], ['DSL', '4.29', 4.1, 0xffb020]]) { const Ml = mini(lab), Mp = px(price), w = Ml.w + 3 + Mp.w, xl = S.X(px0) - (w >> 1);
      if (dir > 0) { vtext(V, Ml, xl, S.Y(SIDE + yt) - 1, z, C.chalk, { dir }); vtext(V, Mp, xl + Ml.w + 3, S.Y(SIDE + yt), z, c, { dir, l: 3 }); }
      else { vtext(V, Mp, xl, S.Y(SIDE + yt), z, c, { dir, l: 3 }); vtext(V, Ml, xl + Mp.w + 3, S.Y(SIDE + yt) - 1, z, C.chalk, { dir }); } } }
  logSign(ctx, 'LAST CHANCE REG 3.99 DSL 4.29', px0, pz);
  part(ctx, S, [[px0 - 1.1, SIDE, pz - .15, px0 + 1.1, SIDE + 3.4, pz + .15]]);
}
function gasLife(ctx) {
  const A = ctx.A, put = (bk, x, z, rot, o = {}) => ctx.put(bk, ...at(ctx, x, z), { rot, reach: o.reach ?? .5, slide: o.slide ?? [0, 1], y: o.y });
  const L = (x, z, ry, act, seed, y = SIDE + CV) => life(ctx, A, { x, y, z, ry, act, seed, hand: true });
  ctx.group('pumps'); for (const [z, g] of [[141.8, 0], [145.0, 1], [148.2, 2]]) put(XP.pump(g), 239.0, z, 0, { reach: .1, y: SIDE + .3 });
  for (const z of [139.5, 150.5]) put(XP.bollard(), 239.0, z, 0, { reach: .1, y: SIDE + .3 });
  put(HP.sedan(0x2f5bff), 241.7, 144.9, 2, { reach: .6 }); put(HP.sedan(0xff7a1a), 236.4, 146.6, 0, { reach: .6 }); L(240.2, 142.1, -Math.PI / 2, 'talk', 801);
  ctx.group('mart'); put(XP.iceBox(), 243.5, 138.6, 3, { reach: .4, slide: [0, 1] }); put(newsBox(0xe8232a), 243.7, 147.4, 3, { reach: .3 }); put(newsBox(0x2f5bff), 243.7, 148.2, 3, { reach: .3 });
  put(trashCan(0x2f7a3a), 243.6, 152.8, 0, { reach: .4 }); put(XP.payphone(), 245.4, 134.9, 2, { reach: .5, slide: [1, 0] }); L(246.5, 135.1, Math.PI, 'phone', 802);
  put(dumpster(0x2f7a3a), 247.8, 155.2, 0, { reach: .6, slide: [1, 0] }); put(XP.airPump(), 250.9, 155.3, 2, { reach: .4, slide: [1, 0] });
  // the semi on Route 9's shoulder (a load of shoe boxes that fell off it), its driver's buyers behind it in the road
  ctx.group('shoulder'); ctx.put(XP.semi(), kerbX(229.55), at(ctx, 0, 144.8)[1], { rot: 2, y: 0, reach: .3, slide: [0, 1] });   // (SPREAD: at Route 9's kerb, along with the block)
  // (walkers-fix round: its buyers stood in Route 9's outer northbound lanes, where the cars drive — they wait on the kerb behind it now)
  for (const [x, z, ry, act, seed] of [[231.5, 155.05, -.5, 'deal', 803], [231.55, 156.3, -1.2, 'carry', 804]]) A.life.push({ x: kerbX(x), y: SIDE, z: z < 156 ? at(ctx, 0, z)[1] : kerbZ(z), ry, act, seed, hand: true });   // (SPREAD: on the kerb)
}

// ═════════ (7,5) · MOTEL 9
export const MOTEL = { wing: [245, 164, 252, 188], office: [233, 164, 240, 170], pool: [233.4, 180.4, 242.0, 187.6], walk: [243.6, 164, 245, 188], stair: [242.2, 180, 243.6, 185], landing: [242.2, 185, 243.6, 188], sign: [238.2, 176.0], rooms: 6, room9: 174 };   // (the sign stands clear of the street and landmark cameras' lines to OFFICE, LAST GAS BEFORE BRIDGE and LOANS)
const ROOM = k => 164 + k * 4;                               // room k's north wall (k 0…5, north to south; 1–6 downstairs, 7–12 up)
function motelGround(ctx) {
  ctx.group('court');
  surface(ctx, [[233, 170, 243.6, 180.4], [240, 164, 243.6, 170], [242.0, 180.4, 243.6, 188]], (x, z) => { const n = noise(x, z, 1);
    for (let k = 0; k <= 4; k++) if (Math.abs(z - (164.0 + k * 4)) < .06 && x > 238.2 && x < 243.2 && z > 167.9) return C.chalk;   // bay lines in front of the rooms
    return n > .9 ? C.asphL : n < .1 ? 0x4c4d5e : C.asph; });
  surface(ctx, [MOTEL.walk], (x, z) => ((Math.floor(z / .6) & 1) ? 0xd8d2c6 : 0xcfc9bc));
}
function wing(ctx) {
  const R = MOTEL.wing, S = slice(ctx, R, SIDE, SIDE + 7.0, { pad: 1 }); if (!S) return;
  const Hh = 60, W = C.pink, T = C.chalk, DOOR = C.teal;
  walls(S, Hh, W); parapet(S, Hh, 5, W, T);
  for (const side of ['-x', '-z', '+z', '+x']) { const f = S.F(side), L = f.len; f.box(0, 1, 0, L, 3, 2, shade(W, .78)); f.box(-1, 30, 0, L + 1, 32, 2, T); f.box(-1, 56, 0, L + 1, 60, 2, T); }
  // the room fronts on the court (west face): a door (the number in gold), a window with its curtain, the wall unit under it
  const f = S.F('-x');
  for (let fl = 0; fl < 2; fl++) for (let k = 0; k < MOTEL.rooms; k++) { const y0 = fl ? 32 : 0, n = fl * 6 + k + 1, zc = ROOM(k) + 2, [a0, a1] = span(S, '-x', zc + .4, zc + 1.4), [w0, w1] = span(S, '-x', zc - 1.6, zc - .2);
    const on = TOD.night && (n === 9 || H(n, 5) > .45), open = n === 9;
    f.box(a0 - 1, y0 + 1, 0, a1 + 1, y0 + 23, 1, T); f.box(a0, y0 + 1, -1, a1, y0 + 22, 1, AIR);
    f.box(a0, y0 + 1, -2, a1, y0 + 22, -1, open ? (on && TOD.night ? 0xffd9a0 : 0x6e4a3a) : DOOR, open && TOD.night ? 3 : 0);
    if (!open) { const M = px(String(n)); f.mask(M, ((a0 + a1) >> 1) - (M.w >> 1), y0 + 18, -1, 0, C.gold, 0, 1); }
    f.box(w0 - 1, y0 + 9, 0, w1 + 1, y0 + 22, 1, T); f.box(w0, y0 + 10, -1, w1, y0 + 21, 1, AIR);
    f.box(w0, y0 + 10, -2, w1, y0 + 21, -1, (a, y) => { const cur = (a - w0) < 4 || (a - w0) > (w1 - w0) - 5; return on ? (cur ? 0xff9a6a : C.litLo) : (cur ? 0xd65a8a : C.glass); }, on ? 3 : 1);
    f.box(w0 + 2, y0 + 4, 0, w1 - 2, y0 + 8, 2, 0xc9ced6); for (let y = y0 + 5; y < y0 + 8; y += 2) f.box(w0 + 3, y, 2, w1 - 3, y + 1, 3, 0x8f949c);
    if (fl === 0) door(R[0], zc + .9, '-x'); }
  // the back on Pike Rd: bathroom windows high up, a painted ad from the pool; the ends: a mural on Oak St, the pool side on Pine St
  { const g = S.F('+x'); for (let fl = 0; fl < 2; fl++) for (let k = 0; k < MOTEL.rooms; k++) { const [a0] = span(S, '+x', ROOM(k) + 2.2, ROOM(k) + 3.0); g.box(a0, fl * 32 + 16, -1, a0 + 8, fl * 32 + 22, 1, AIR); g.box(a0, fl * 32 + 16, -2, a0 + 8, fl * 32 + 22, -1, 0xd8e8f0, 1); g.box(a0 - 1, fl * 32 + 15, 0, a0 + 9, fl * 32 + 16, 2, T); } }
  { const g = S.F('-z'), Lg = g.len; mural(g, 6, 6, Lg - 12, 48, 'face', 7771, [C.cyan, C.violet, C.chalk, 'NITE']); }
  { const g = S.F('+z'), Lg = g.len; paintedAd(g, 6, 34, Lg - 12, 20, null, C.sYellow, C.ink); }
  // the roof: a condenser and a vent stack for every room (two rows: from the overhead the wing reads as twelve rooms), neutral
  for (let k = 0; k < MOTEL.rooms; k++) for (const [x, w] of [[246.2, 1.0], [249.6, 1.0]]) { const z = ROOM(k) + 1.2 + (x > 248 ? 1.2 : 0);
    S.box(x, SIDE + 6.0, z, x + w, SIDE + 6.6, z + .8, 0xd9dce2); S.box(x + .1, SIDE + 6.6, z + .1, x + w - .1, SIDE + 6.7, z + .7, 0x9aa0a8); S.box(x + w + .3, SIDE + 6.0, z + .3, x + w + .5, SIDE + 6.9, z + .5, 0x8a9099, 2); }
  solid(ctx, S, SIDE + 6.6, SIDE + 6.0);
}
function walkway(ctx, A) {
  const R = [242.2, 164, 245, 188], S = slice(ctx, R, SIDE + CV, SIDE + 6.3, { pad: .2 }); if (!S) return;
  const box = S.box, dk = SIDE + 3.0, T = C.chalk, I = 0x2a2d38, [wx0, wz0, wx1, wz1] = MOTEL.walk;
  box(wx0, dk, wz0, wx1 - .1, dk + .2, wz1, 0xd9d4c9); box(MOTEL.landing[0], dk, MOTEL.landing[1], MOTEL.landing[2], dk + .2, MOTEL.landing[3], 0xd9d4c9);   // the deck and the landing (to the wing's band)
  box(wx0, SIDE + 5.8, wz0, wx1 - .1, SIDE + 6.0, wz1, C.pink); box(wx0, SIDE + 5.7, wz0, wx0 + .1, SIDE + 5.8, wz1, T);                                  // the roof over it
  for (const z of [164.1, 168.0, 172.0, 176.0, 180.0, 184.0, 187.8]) box(wx0, SIDE + CV, z - .1, wx0 + .2, SIDE + 5.8, z + .1, T);                      // posts
  // the rail along the deck (and round the landing), white pipe on balusters
  for (let z = wz0; z < wz1 - .01; z += .1) { const zz = Math.round(z * 10) / 10; if (zz >= 185 - .01) continue; box(wx0, dk + 1.0, zz, wx0 + .1, dk + 1.1, zz + .1, T); if (Math.round(zz * 10) % 3 === 0) box(wx0, dk + .2, zz, wx0 + .1, dk + 1.0, zz + .1, T); }
  for (let x = MOTEL.landing[0]; x < MOTEL.landing[2] - .01; x += .1) { box(x, dk + 1.0, 187.9, x + .1, dk + 1.1, 188.0, T); if (Math.round(x * 10) % 3 === 0) box(x, dk + .2, 187.9, x + .1, dk + 1.0, 188.0, T); }
  for (let z = 185; z < 188 - .01; z += .1) { box(MOTEL.landing[0], dk + 1.0, z, MOTEL.landing[0] + .1, dk + 1.1, z + .1, T); if (Math.round(z * 10) % 3 === 0) box(MOTEL.landing[0], dk + .2, z, MOTEL.landing[0] + .1, dk + 1.0, z + .1, T); }
  // the stair: up from the court at z 180 to the landing at z 185, steel stringers, concrete treads
  const [sx0, sz0, sx1, sz1] = MOTEL.stair; for (let k = 0; k < 15; k++) { const z = sz0 + k * (sz1 - sz0) / 15, y = SIDE + CV + (k + 1) * (dk + .2 - SIDE - CV) / 15; box(sx0 + .1, y - .2, z, sx1 - .1, y, z + (sz1 - sz0) / 15, 0xc9c3b6); }
  for (const x of [sx0, sx1 - .1]) for (let k = 0; k < 50; k++) { const z = sz0 + k * .1, y = SIDE + CV + (k + 1) * (dk + .2 - SIDE - CV) / 50; box(x, y - .3, z, x + .1, y + .9, z + .1, I); }
  part(ctx, S, [...[164.1, 168.0, 172.0, 176.0, 180.0, 184.0, 187.8].map(z => [wx0, SIDE, z - .1, wx0 + .2, SIDE + 5.8, z + .1]), [sx0, SIDE, sz0, sx1, dk + 1.2, 188]]); REG.surface(S.V);   // (the deck: a surface the chair and the table stand on)
  // the loan shark in a lawn chair outside room 9, his card table, the man who stands by the door; the ice machine and the soda at the
  // north end of the walk, a guest filling a bucket; the clerk's bell at the office
  if (ctx.i === 7 && ctx.j === 5) { const put = (bk, x, z, rot, o = {}) => ctx.put(bk, ...at(ctx, x, z), { rot, reach: o.reach ?? .3, slide: o.slide ?? [0, 1], y: o.y });
    ctx.group('room-9'); const up = dk + .2, z9 = ROOM(2) + 2;
    put(lawnChair(0x2de2e6), 244.4, z9 + 1.9, 3, { y: up, reach: .1 }); put(XP.cardTable(), SPREAD ? 244.3 : 244.35, z9 + 3.05, 0, { y: up, reach: .1 });   // south of his open door (SPREAD: 5 cm in from the deck's edge at a spread — shifted 30 m, its voxels round one column onto room 10's wall unit)
    life(ctx, A, { x: 244.4, y: up, z: z9 + 1.9, ry: -Math.PI / 2, act: 'sit', seed: 911, hand: true, seatY: .35 });
    life(ctx, A, { x: 244.3, y: up, z: z9 - 2.1, ry: -Math.PI / 2 + .5, act: 'arms', seed: 912, hand: true });   // his man, north of the window with the card in it
    ctx.put(HP.plate(['LOANS', 'ROOM 9'], 0xc9a877, C.ink, { face: 'hand', posts: 0 }), ...at(ctx, 243.45, z9 - .9), { rot: 3, y: up + .25, reach: .2 });   // cardboard, zip-tied to the rail
    logSign(ctx, 'LOANS ROOM 9', 243.45, z9 - .9);
    ctx.group('ice'); put(XP.iceMachine(), 244.4, 164.8, 3, { y: up, reach: .2 }); put(XP.soda(), 244.4, 166.0, 3, { y: up, reach: .2 });   // up on the walkway, by the stair's far end
    life(ctx, A, { x: 244.25, y: up, z: 167.4, ry: Math.PI, act: 'carry', seed: 913, hand: true }); }
}
function office(ctx) {
  const R = MOTEL.office, S = slice(ctx, R, SIDE, SIDE + 5.2, { pad: .8 }); if (!S) return;
  const Hh = 34, W = C.teal, T = C.chalk, { V, B } = S;
  V.box(B.x0, 0, B.z0, B.x1, Hh, B.z1, W);
  // the butterfly roof: two planes rising from a valley down the middle to the eaves, overhanging 0.6 m (googie)
  const xm = (R[0] + R[2]) / 2; S.box(R[0] - .6, SIDE + Hh * CV - .3, R[1] - .6, R[2] + .6, SIDE + 4.8, R[3] + .6, (x, y, z) => { const wx = S.wx(x), wz = S.wz(z), rise = Math.abs(wx - xm) / (R[2] - xm) * .9, yy = SIDE + Hh * CV + rise, wy = S.y0 + (y + .5) * CV, inside = wx > R[0] && wx < R[2] && wz > R[1] && wz < R[3];
    if (wy >= yy) return undefined; if (wy >= yy - .3) return (Math.abs(wx - (R[0] - .6)) < .15 || Math.abs(wx - (R[2] + .6)) < .15) ? C.sRed : 0xf2efe6; return inside ? W : undefined; });   // the plate, and the walls up to it
  for (const side of ['-x', '+z', '-z', '+x']) { const f = S.F(side), L = f.len; f.box(0, 1, 0, L, 3, 2, shade(W, .75)); }
  const Wf = S.F('-x'), Sf = S.F('+z');
  win(Wf, 8, 8, 44, 18, T, { lit: TOD.night }); win(S.F('-z'), 14, 10, 28, 14, T, { lit: TOD.night });
  { const [a0, a1] = span(S, '+z', 237.9, 239.2); Sf.box(a0 - 1, 1, 0, a1 + 1, 25, 1, T); Sf.box(a0, 1, -1, a1, 24, 1, AIR); Sf.box(a0, 1, -2, a1, 24, -1, (a, y) => y > 8 && y < 20 ? (TOD.night ? 0xfff0c8 : 0x9fd8ff) : DOORC, TOD.night ? 3 : 1); door(238.55, R[3], '+z'); }
  win(Sf, 6, 8, 36, 16, T, { lit: TOD.night });
  Sf.box(4, 26, 0, 46, 33, 2, C.chalk); Sf.text('OFFICE', 25, 32, 2, 3, W, 0, 1, 1); logSign(ctx, 'OFFICE', 236.5, R[3]);
  // VACANCY? ask inside: RING BELL, on the glass
  Wf.mask(mini('RING BELL'), 12, 24, -2, -1, C.sRed, 0, 1);
  solid(ctx, S, SIDE + 4.8, SIDE + 3.4);
}
const DOORC = 0x0e7a6e;
// ── THE SIGN: a pole on the court's mouth, double-faced to the highway's traffic both ways: MOTEL in pink script on an arrow that
// points in, the big 9 in yellow neon on a red disc ringed with chasing bulbs, VACANCY in green neon, 5 A NITE on a card under it
function sign(ctx) {
  const [sx, sz] = MOTEL.sign, S = slice(ctx, [sx - 3.7, sz - .3, sx + 4.3, sz + .3], SIDE + CV, SIDE + 12.4, { pad: .3 }); if (!S) return;
  const U = .3;   // the boards over the rate card ride 0.3 m higher: the court camera's line to the canopy's lettering passes under VACANCY
  const { V } = S, box = S.box, RD = 0xd7141a, PK = C.pink, INK = 0x101216, zA = S.Z(sz - .2), zB = S.Z(sz + .2), nightL = TOD.night ? 3 : 1;
  box(sx - .3, SIDE + CV, sz - .2, sx + .3, SIDE + 10.0 + U, sz + .2, 0x6d707a, 2);                                                    // the pole
  box(sx - .6, SIDE + CV, sz - .4, sx + .6, SIDE + .6, sz + .4, C.concL);                                                               // its footing
  // the 9 on its disc
  const cy = SIDE + 7.4 + U, r = 1.9; box(sx - r, cy - r, sz - .2, sx + r, cy + r, sz + .2, (x, y, z) => { const d = Math.hypot(S.wx(x) - sx, S.y0 + (y + .5) * CV - cy); return d <= r ? (d > r - .15 ? (((x + y) & 1) ? 0xfff3c4 : C.sYellow) : RD) : undefined; }, 0);
  if (TOD.night) box(sx - r, cy - r, sz - .2, sx + r, cy + r, sz + .2, (x, y, z) => { const d = Math.hypot(S.wx(x) - sx, S.y0 + (y + .5) * CV - cy); return d <= r && d > r - .15 && ((x + y) & 1) ? 0xfff3c4 : undefined; }, 3);
  const N9 = impact('9', 40), T9 = tubeOf(N9), I9 = innerOf(N9);
  for (const [z, dir] of [[zB, 1], [zA - 1, -1]]) { const x0 = S.X(sx) - (N9.w >> 1), yt = S.Y(cy) + (N9.h >> 1);
    vtext(V, I9, x0, yt, z, 0xb01018, { dir }); vtext(V, T9, x0, yt, z, C.sYellow, { dir, l: nightL }); }
  // MOTEL in pink script on its arrow board (pointing east, into the court)
  { const y0 = SIDE + 9.3 + U, y1 = SIDE + 11.6 + U, xa = sx - 3.5, xb = sx + 3.2; box(xa, y0, sz - .2, xb, y1, sz + .2, INK);
    for (let k = 0; k < 11; k++) box(xb + k * .1, y0 + k * .1, sz - .2, xb + (k + 1) * .1, y1 - k * .1, sz + .2, INK); box(xa, y0, sz - .2, xa + .1, y1, sz + .2, PK); box(xa, y0, sz - .2, xb, y0 + .1, sz + .2, PK); box(xa, y1 - .1, sz - .2, xb, y1, sz + .2, PK);
    let M = null; for (let size = 30; size >= 14; size -= 2) { M = script('Motel', size); if (M.w <= (xb - xa) / CV - 6 && M.h <= (y1 - y0) / CV - 4) break; }   // the biggest script that fits the board
    for (const [z, dir] of [[zB, 1], [zA - 1, -1]]) vtext(V, M, S.X((xa + xb) / 2) - (M.w >> 1), S.Y(y1) - 2 - (((y1 - y0) / CV - 4 - M.h) >> 1), z, PK, { dir, l: nightL });
    box(sx - .3, y0 - .3, sz - .2, sx + .3, y0, sz + .2, 0x6d707a, 2); }
  // VACANCY in green neon on a black board, 5 A NITE on the white card under it
  { const y0 = SIDE + 4.5 + U, y1 = SIDE + 5.3 + U; box(sx - 2.3, y0, sz - .15, sx + 2.3, y1, sz + .15, INK); const M = px('VACANCY');
    for (const [z, dir] of [[S.Z(sz + .15), 1], [S.Z(sz - .15) - 1, -1]]) vtext(V, M, S.X(sx) - (M.w >> 1), S.Y(y1 - .1), z, 0x3dff6a, { dir, l: nightL }); }
  { const y0 = SIDE + 3.4, y1 = SIDE + 4.1, M = mini('5 A NITE'), hw = (M.w + 6) * CV / 2; box(sx - hw, y0, sz - .15, sx + hw, y1, sz + .15, C.chalk, TOD.night ? 3 : 0);   // a backlit card (narrow: it keeps out of the cameras' lines)
    for (const [z, dir] of [[S.Z(sz + .15), 1], [S.Z(sz - .15) - 1, -1]]) vtext(V, M, S.X(sx) - (M.w >> 1), S.Y(y1 - .2), z, C.sRed, { dir }); }
  logSign(ctx, 'MOTEL 9', sx, sz); logSign(ctx, 'VACANCY', sx, sz); logSign(ctx, '5 A NITE', sx, sz);
  part(ctx, S, [[sx - .6, SIDE, sz - .4, sx + .6, SIDE + 10.0 + U, sz + .4]], { big: true });
}
function pool(ctx, A) {
  const R = MOTEL.pool, S = slice(ctx, R, SIDE, SIDE + 2.4, { pad: .2 }); if (!S) return;
  const box = S.box, [x0, z0, x1, z1] = R, b = [234.6, 181.8, 240.4, 186.2], T = SIDE + .3;
  box(x0, SIDE, z0, x1, T, z1, (x, y, z) => { const wx = S.wx(x), wz = S.wz(z); return ((Math.floor(wx / .6) + Math.floor(wz / .6)) & 1) ? 0xe8e4dc : 0xdedad0; });   // the deck
  box(b[0] - .2, T, b[1] - .2, b[2] + .2, T + .1, b[3] + .2, C.chalk); box(b[0], T - .1, b[1], b[2], T + .1, b[3], AIR);          // the coping, the basin
  box(b[0], T - .2, b[1], b[2], T - .1, b[3], (x, y, z) => { const wx = S.wx(x); return wx < b[0] + .2 || Math.abs(wx - (b[0] + b[2]) / 2) < .05 ? 0x1f8fd8 : (H(x, z, 4) > .96 ? 0xbff0ff : 0x2fc4ff); }, TOD.night ? 3 : 1);   // the water
  { const fx = b[0] + 3.6, fz = b[1] + 1.6; for (let a = -3; a <= 3; a++) for (let c = -3; c <= 3; c++) { const rr = Math.hypot(a, c); if (rr <= 3.2 && rr >= 1.6) V_set(S, fx + a * .1, T - .1, fz + c * .1, 0xff6fb5); } box(fx + .2, T - .1, fz - .1, fx + .3, T + .3, fz, 0xff6fb5); box(fx + .2, T + .2, fz - .2, fx + .3, T + .3, fz, 0xffb000); }   // the flamingo float
  box(b[0] - .2, T, b[1] + 1.6, b[0] + 1.2, T + .15, b[1] + 2.4, C.chalk); box(b[0] - .6, SIDE, b[1] + 1.8, b[0] - .2, T + .15, b[1] + 2.2, 0x9aa0a8, 2);   // the diving board
  solid(ctx, S, T, T, { plinth: false });
  fence(ctx, 'x', z0, x0, x1, [[236.4, 238.0]]); fence(ctx, 'z', x0, z0 + .1, z1 - .1); fence(ctx, 'z', x1 - .1, z0 + .1, z1 - .1); fence(ctx, 'x', z1 - .1, x0, x1);   // (the side runs stop short of the corner posts)
  if (ctx.i === 7 && ctx.j === 5) { ctx.group('pool'); ctx.put(XP.lounger(0xffe23a), ...at(ctx, 241.1, 184.4), { rot: 0, y: T, reach: .3, slide: [0, 1] }); ctx.put(XP.lounger(0xff4fa3), ...at(ctx, 241.1, 181.9), { rot: 0, y: T, reach: .3, slide: [0, 1] });
    life(ctx, A, { x: 241.1, y: T, z: 184.5, ry: 0, act: 'lounge', seed: 921, hand: true });
    ctx.put(HP.plate(['NO LIFEGUARD', 'ON DUTY'], C.chalk, C.sRed, { face: 'mini', posts: 0 }), ...at(ctx, 239.6, z0 - .12), { rot: 2, y: SIDE + 1.0, reach: .3, slide: [1, 0] }); }
}
const V_set = (S, x, y, z, c) => S.V.set(S.X(x), S.Y(y), S.Z(z), c);
function fence(ctx, ax, at, u0, u1, gaps = []) { const h = 12, r = ax === 'x' ? [u0, at, u1, at + CV] : [at, u0, at + CV, u1], S = slice(ctx, r, SIDE + .3, SIDE + .3 + (h + 2) * CV, { pad: .2 }); if (!S || !S.clip) return;
  const { V } = S, n = Math.round((u1 - u0) / CV), q0 = ax === 'x' ? S.X(u0) : S.Z(u0), c = ax === 'x' ? S.Z(at) : S.X(at), set = (q, y, cl, l = 2) => ax === 'x' ? V.set(q0 + q, y, c, cl, l) : V.set(c, y, q0 + q, cl, l);
  const gap = q => { const u = u0 + (q + .5) * CV; return gaps.some(([a, b]) => u >= a && u < b); };
  for (let q = 0; q < n; q++) { if (gap(q)) continue; const post = q % 20 === 0 || q === n - 1 || gap(q - 1) || gap(q + 1); if (post) { for (let y = 0; y < h; y++) set(q, y, 0xaeb3ba); continue; }
    set(q, h - 1, 0xaeb3ba); for (let y = 0; y < h - 1; y++) if (((y + q) & 1) === 0) set(q, y, 0xc4c8ce); }
  const k = S.clip; part(ctx, S, [[k[0], SIDE, k[1], k[2], SIDE + .3 + h * CV, k[3]]]); }
function motelLife(ctx) {
  const put = (bk, x, z, rot, o = {}) => ctx.put(bk, ...at(ctx, x, z), { rot, reach: o.reach ?? .6, slide: o.slide ?? [0, 1] });
  ctx.group('cars'); put(HP.sedan(0x17171b, { rim: C.gold }), 240.8, ROOM(2) + 2, 1); put(HP.sedan(0x12b3a0), 240.8, ROOM(3) + 2, 1);   // the shark's black car with the gold rims under room 9; a guest's
  life(ctx, ctx.A, { x: 238.6, y: SIDE + CV, z: 170.9, ry: Math.PI, act: 'phone', seed: 931, hand: true });
  ctx.group('roof'); const was = REG.strict; REG.strict = false; for (const [x, z, v] of [[248.4, 169.5, 0], [249.2, 181.5, 1]]) { const [wx, wz] = at(ctx, x, z); stamp(dish(v), ctx.bank, 1, wx, SIDE + 6.0, wz); } REG.strict = was;
}

// ═════════ the block builders (the heroes call these)
export function gasBlock(ctx) {
  gasGround(ctx); ctx.group('mart'); mart(ctx); ctx.group('canopy'); canopy(ctx); ctx.group('pylon'); pylon(ctx);
  ctx.group('structure'); fin(ctx);
  gasLife(ctx);
  // the mart's roof: a billboard from the city's pool, turned to the highway
  if (ctx.i === 7 && ctx.j === 4) { const was = REG.strict; REG.strict = false; ctx.group('billboard'); const r = roofBillboard(7401, { giant: false, flip: false, at: at(ctx, 248.2, 145) }), [bx, bz] = at(ctx, 248.6, 145.0); stamp(r.bank, ctx.bank, 3, bx, SIDE + 4.4, bz); REG.strict = was; }
  fin(ctx); { const [x, z] = at(ctx, 248, 145); ctx.A.roofs.push({ x, z, y: SIDE + 11, w: 7, d: 18 }); }
}
export function motelBlock(ctx) {
  motelGround(ctx); ctx.group('wing'); wing(ctx); ctx.group('office'); office(ctx); ctx.group('walkway'); walkway(ctx, ctx.A); ctx.group('sign'); sign(ctx); ctx.group('pool'); pool(ctx, ctx.A);
  ctx.group('structure'); fin(ctx);
  motelLife(ctx);
  fin(ctx); { const [x, z] = at(ctx, MOTEL.sign[0], MOTEL.sign[1]); ctx.A.roofs.push({ x, z, y: SIDE + 11, w: 5, d: 1 }); }
}
