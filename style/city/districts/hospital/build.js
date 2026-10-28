// ST. MERCY · the buildings and grounds of the compound (owner: the St. Mercy / Route 9 agent). Every part is authored once in world
// metres; each of the four hero blocks draws only its own slice of it (lib.js slice), so the tower on the sim's place — where the four
// blocks meet — is one building. campus(ctx) builds everything that reaches the block; the heroes (heroes/hospital-*.js) call it.
import { C, CV, SIDE, TOD, REG, AIR, lit, H, shade, slice, solid, part, fin, logSign, door, px, mini, impact, vtext, vtextX, clipR, span, col, walls, parapet, at, atR, life, inBlock, kerbZ } from './lib.js';   // (SPREAD: at / atR / life: frame metres → the spread world, lib.js)
import { win } from '../../kit.js';
import { TOWER, PAD, ER, CANOPY, LOBBY, MARQUEE, ANNEX, GARAGE, OLD, O2, GROUND, IN } from './plan.js';
import { HS } from '../../../../world/city.js';
import * as HP from './props.js';
import { tree, dumpster, taxi } from '../../props.js';
import { patrolCar, bankOf } from '../../simassets/index.js';
import { buildSetPiece } from '../../setpieces.js';
import { paintedAd } from '../../facade.js';

const WORLD = { '+z': 0, '-z': 1, '-x': 2, '+x': 3 };
// a recessed glass band with mullions every m, a sill, lit panes at night (a hospital is never dark: litP of them)
function ribbon(f, a0, a1, y0, y1, o = {}) { if (a1 <= a0) return; const m = o.m ?? 12, trim = o.trim ?? C.chalk, dep = o.dep ?? 2, seed = o.seed ?? 0, litP = o.litP ?? .62;
  f.box(a0, y0, -dep, a1, y1, 1, AIR);
  for (let p = a0; p < a1; p += m) { const p1 = Math.min(a1, p + m), on = TOD.night && H(Math.floor(p / m) * 7 + seed, y0, f.len) < litP;
    f.box(p, y0, -dep - 1, p1, y1, -dep, (a, y) => on ? (y - y0 > (y1 - y0) * .6 ? C.lit : C.litLo) : (y - y0 > (y1 - y0) * .62 ? C.glassHi : ((a + y) % 23 === 0 ? 0xeaf6ff : C.glass)), on ? 3 : 1); }
  for (let a = a0; a < a1; a += m) f.box(a, y0, -dep, a + 1, y1, 0, trim);
  f.box(a0 - 1, y0 - 1, 0, a1 + 1, y0, 2, trim); }

// ═════════ THE GROUND: asphalt drives and yards, the garden's grass, the forecourt's pavers (walkable: props and people stand on it)
function paint(kind, x, z) {
  const n = H(Math.floor(x / .3) + 5000, Math.floor(z / .3) + 5000, 17);
  if (kind === 'grass') return n > .86 ? 0x6cbf52 : n < .2 ? C.grassD : C.grass;
  if (kind === 'pave') { const g = 1.2, gx = ((x % g) + g) % g, gz = ((z % g) + g) % g; if (gx < .1 || gz < .1) return 0xbdb4a4; const band = ((Math.floor(z / 6) % 2) + 2) % 2; return (Math.floor(x / g) + Math.floor(z / g)) & 1 ? (band ? 0xd6cfc2 : 0xdcd5c9) : (band ? 0xcfc6b8 : 0xd3cbbe); }
  // asphalt: the court's keep-clear hatch at the ER doors and its dashed entry line; the dock apron's hatch; the lane's arrows
  if (x > 139.8 && x < 141 && ((z > -47.0 && z < -45.4) || (z > -42.4 && z < -40.8))) return ((Math.floor((x + z) / .4) & 1) ? C.sYellow : C.asph);
  if (x > 134.2 && x < 134.4 && z > -58 && z < -34 && ((Math.floor(z / .6) & 1))) return C.sYellow;
  if (x > 160.6 && x < 170.6 && z > -47.6 && z < -44.4 && ((Math.floor((x - z) / .5) & 1))) return C.sYellow;
  if (z > -31.3 && z < -31.1 && x > 174.4 && x < 187.6) return C.chalk;                                          // the stop line at the gate
  return n > .9 ? C.asphL : n < .1 ? 0x4c4d5e : C.asph;
}
const HOLES = [[160.6, -44.2, 170.6, -42]], OLD_IN = (x, z) => x > OLD.rect[0] && x < OLD.rect[2] && z > OLD.rect[1] && z < OLD.rect[3];
// SPREAD · THE MARGIN: the compound sits at its centre, so a spread opens HS m between its edge and each street's lot line. A strip of
// the ground that meets the edge fills it (the court's asphalt to Bishop Ave, the garden's grass, the forecourt's pavers along Central
// Ave and the Medical Arts fronts, grass round the garage); each strip has zero width at SPREAD 0
const { x0: ex0, z0: ez0, x1: ex1, z1: ez1 } = IN, m = HS;
const MARGIN = {
  grass: [[ex0 - m, ez0 - m, ex0, -58], [ex0 - m, -34, ex0, -17.4], [ex0, ez0 - m, 151, ez0], [174, ez0 - m, ex1 + m, ez0], [ex1, ez0, ex1 + m, -34]],
  asph: [[ex0 - m, -58, ex0, -34], [151, ez0 - m, 174, ez0], [ex1, -34, ex1 + m, -28]],
  pave: [[ex0 - m, -17.4, ex0, ez1 + m], [ex1, -28, ex1 + m, ez1 + m], [ex0, ez1, ex1, ez1 + m]],
};
export function ground(ctx) {
  ctx.group('grounds');
  for (const [kind, list] of Object.entries(GROUND)) for (const r of [...list, ...MARGIN[kind]]) { const c = clipR(ctx, r); if (!c) continue;
    // (three layers: the top one is the surface; the two under it sit below the slab's plane, hidden, so the far tier's 0.5 m cells keep
    // the grass and the pavers instead of dropping them for the bare lot colour)
    const [vx0, vz0, vx1, vz1] = atR(ctx, c), V = ctx.volume(vx0, SIDE - .2, vz0, vx1, SIDE + CV, vz1, { walk: true }); V.box(0, 0, 0, V.nx, 3, V.nz, (x, y, z) => { const wx = c[0] + (x + .5) * CV, wz = c[1] + (z + .5) * CV; return HOLES.some(h => wx > h[0] && wx < h[2] && wz > h[1] && wz < h[3]) || OLD_IN(wx, wz) ? undefined : paint(kind, wx, wz); }); }
}

// ═════════ THE TOWER: the podium (two storeys, 0.1 cubes), the shaft (six storeys of ribbon glass, 0.2 cubes), the red crown with
// ST. MERCY on it, the neon cross on the Central Ave face, the helipad and the air ambulance on the roof
function podium(ctx) {
  const S = slice(ctx, TOWER.rect, SIDE, SIDE + 8.6, { pad: 1 }); if (!S) return;
  const Hp = 78, W = C.white, T = C.chalk, R = C.sRed, erJoin = [150.8, -42.2, 151.3, -35.9];
  walls(S, Hp, W); parapet(S, Hp, 5, W, T, [erJoin]);
  for (const side of ['+z', '-z', '-x', '+x']) { const f = S.F(side), L = f.len, open = side === '-x' ? span(S, '-x', -35.8, -24.4) : [4, L - 4], p0 = side === '-x' ? open[0] : -1;   // (the west face's trim starts past the ER wing)
    f.box(Math.max(0, p0), 1, 0, L, 3, 2, shade(W, .84)); if (side !== '+z') f.box(p0, 40, 0, L + 1, 44, 2, R); f.box(p0, 74, 0, L + 1, 78, 2, T);
    ribbon(f, Math.max(4, open[0]), Math.min(L - 4, open[1]), 50, 70, { seed: WORLD[side] * 31 }); }
  // the ground floor: the loading dock's doors and a staff door on 2nd St's side; windows round the garden and the lane
  const N = S.F('-z'), Wf = S.F('-x'), E = S.F('+x');
  for (const [u0, u1] of [[161.2, 164.2], [166.2, 169.2]]) { const [a0, a1] = span(S, '-z', u0, u1); N.box(a0 - 2, 10, 0, a1 + 2, 40, 1, C.steelD); N.box(a0, 12, -1, a1, 38, 1, AIR); N.box(a0, 12, -2, a1, 38, -1, (a, y) => y % 3 === 0 ? 0x9aa0a8 : 0xb9bec6, 2); }
  { const [a0, a1] = span(S, '-z', 155.0, 156.4); N.box(a0 - 1, 0, 0, a1 + 1, 26, 1, C.steelD); N.box(a0, 1, -1, a1, 24, 1, AIR); N.box(a0, 1, -2, a1, 24, -1, 0x6d707a, 2); N.box(a0 - 3, 26, 0, a1 + 3, 28, 6, T); door(155.7, -42, '-z'); }
  for (const u of [152.2, 157.8]) { const [a0] = span(S, '-z', u, u + 1.6); win(N, a0, 12, 16, 24, T, {}); }
  for (const u of [-34.6, -31.0, -27.4]) { const [a0] = span(S, '-x', u, u + 1.6); win(Wf, a0, 10, 16, 24, T, {}); }
  for (const u of [-41.0, -37.4, -33.8, -26.6]) { const [a0] = span(S, '+x', u, u + 1.6); win(E, a0, 10, 16, 24, T, {}); }
  { const [a0, a1] = span(S, '+x', -30.4, -29.0); E.box(a0 - 1, 0, 0, a1 + 1, 26, 1, C.steelD); E.box(a0, 1, -1, a1, 24, 1, AIR); E.box(a0, 1, -2, a1, 24, -1, 0x6d707a, 2); door(171, -29.7, '+x'); }
  solid(ctx, S, SIDE + 8.4, SIDE + 7.8);
}
function shaft(ctx) {
  const S = slice(ctx, TOWER.shaft, SIDE + TOWER.pod, TOWER.top + 2.4, { s: .2, pad: 1, ground: false }); if (!S) return;
  const { V, B } = S, Hs = 96, W = C.white, R = C.sRed;
  walls(S, Hs, W, 0xcfccc4);
  V.box(B.x0, Hs, B.z0, B.x1, Hs + 9, B.z1, R); V.clear(B.x0 + 2, Hs, B.z0 + 2, B.x1 - 2, Hs + 9, B.z1 - 2);
  V.box(B.x0, Hs + 9, B.z0, B.x1, Hs + 10, B.z1, C.chalk); V.clear(B.x0 + 2, Hs + 9, B.z0 + 2, B.x1 - 2, Hs + 10, B.z1 - 2);
  for (const side of ['+z', '-z', '-x', '+x']) { const f = S.F(side), L = f.len; f.box(-1, 0, 0, L + 1, 1, 1, C.chalk);
    for (let k = 0; k < TOWER.floors; k++) ribbon(f, 4, L - 4, k * 16 + 5, k * 16 + 13, { m: 6, dep: 1, seed: k * 13 + WORLD[side] * 7, litP: .7 }); }
  // the big cross on Central Ave's face: a white panel over the ribbons, the red cross proud of it — neon at night
  { const f = S.F('+z'), ca = col(S, '+z', 161), cy = 62; f.box(ca - 16, cy - 17, 0, ca + 16, cy + 17, 2, C.chalk);
    f.box(ca - 4, cy - 13, 1, ca + 4, cy + 13, 3, R, lit(1)); f.box(ca - 13, cy - 4, 1, ca + 13, cy + 4, 3, R, lit(1));
    f.box(ca - 1, cy - 11, 3, ca + 1, cy + 11, 4, TOD.night ? 0xffb0a8 : 0xff5a4a, lit(1)); f.box(ca - 11, cy - 1, 3, ca + 11, cy + 1, 4, TOD.night ? 0xffb0a8 : 0xff5a4a, lit(1)); }
  // ST. MERCY on the crown, on Central Ave's side and 2nd St's (one name: logged once)
  for (const side of ['+z', '-z']) S.F(side).text('ST. MERCY', col(S, side, 161), Hs + 8, 1, 2, C.chalk, lit(0), 1, 1);
  logSign(ctx, 'ST. MERCY', 161, -24.8);
  solid(ctx, S, TOWER.top + 2.0, TOWER.top, { big: true });
}
// the H: two legs along z, a crossbar (metres from the pad's centre)
const inH = (dx, dz) => (Math.abs(dx) >= 1.1 && Math.abs(dx) <= 1.8 && Math.abs(dz) <= 2.1) || (Math.abs(dx) < 1.1 && Math.abs(dz) <= .35);
function helipad(ctx, A) {
  const top = TOWER.top, S = slice(ctx, [152.4, -40.6, 169.6, -25.4], top, top + 4.4, { pad: 0, ground: false }); if (!S) return;
  const { V } = S, [x0, z0, x1, z1] = PAD.rect, cx = PAD.cx, cz = PAD.cz, box = S.box;
  box(x0, top, z0, x1, top + .3, z1, 0x3a3f47);
  box(x0, top + .3, z0, x1, top + .4, z1, (x, y, z) => { const wx = S.wx(x), wz = S.wz(z), e = Math.min(wx - x0, x1 - wx, wz - z0, z1 - wz), r = Math.hypot(wx - cx, wz - cz);
    if (e > .12 && e < .42) return C.chalk; if (r > 4.25 && r < 4.75) return C.sYellow; if (inH(wx - cx, wz - cz)) return C.chalk; return (Math.floor(wx / .8) + Math.floor(wz / .8)) & 1 ? 0x464c55 : 0x41464f; });
  for (let u = x0 + .4; u < x1 - .2; u += 1.3) for (const z of [z0, z1 - .2]) box(u, top + .4, z, u + .2, top + .5, z + .2, 0x3dff7a, lit(1));   // the edge lights
  for (let u = z0 + 1.1; u < z1 - .6; u += 1.3) for (const x of [x0, x1 - .2]) box(x, top + .4, u, x + .2, top + .5, u + .2, 0x3dff7a, lit(1));
  // the windsock on its mast in the pad's north-east corner (on the roof, outside the deck)
  box(169.0, top, -40.2, 169.2, top + 3.1, -40.0, C.steelL, 2); for (let k = 0; k < 12; k++) { const r = .22 - k * .012; box(168.9 - k * .1, top + 2.75 - r, -40.1 - r, 169.0 - k * .1, top + 2.75 + r, -40.1 + r, (k >> 1) & 1 ? C.chalk : 0xff4a2a); }
  // MERCY ONE: the air ambulance on the pad, nose to the north between the legs of the H — white, a red belly band, a red engine deck
  // and tail (it reads red and white from the overhead), four rotor blades, skids
  const T = top + .4, WH = C.chalk, RD = C.sRed, GL = 0x22345e;
  for (const x of [159.8, 162.0]) { box(x, T, -35.8, x + .2, T + .1, -30.8, C.steelD, 2); box(x, T + .1, -36.0, x + .2, T + .2, -35.8, C.steelD, 2); for (const z of [-35.0, -32.0]) box(x, T + .1, z, x + .2, T + .5, z + .2, C.steelD, 2); }
  box(160.0, T + .5, -35.6, 162.0, T + 2.3, -31.0, WH); box(160.2, T + .7, -36.0, 161.8, T + 2.0, -35.6, WH);            // the cabin and its nose
  box(160.0, T + .5, -35.6, 162.0, T + 1.0, -31.0, RD); box(160.2, T + .7, -36.0, 161.8, T + 1.0, -35.6, RD);            // the red belly band
  box(160.2, T + 1.2, -36.1, 161.8, T + 2.0, -35.9, GL, 1); box(160.0, T + 1.3, -35.6, 162.0, T + 2.1, -35.1, GL, 1);    // the windscreen
  for (const x of [159.9, 162.0]) { box(x, T + 1.3, -34.8, x + .1, T + 2.0, -33.4, GL, 1); box(x, T + 1.1, -32.9, x + .1, T + 2.1, -31.9, RD); box(x, T + 1.5, -32.6, x + .1, T + 1.7, -32.2, WH); box(x, T + 1.4, -32.5, x + .1, T + 1.8, -32.3, WH); }   // side windows, the cross on the doors
  box(160.3, T + 2.3, -34.6, 161.7, T + 2.8, -31.2, RD); box(160.9, T + 2.8, -33.4, 161.1, T + 3.2, -33.2, C.steelD, 2);   // the engine deck, the mast
  box(160.8, T + 1.5, -31.0, 161.2, T + 2.0, -27.4, RD); box(160.9, T + 1.5, -27.9, 161.1, T + 3.0, -27.3, RD); box(160.9, T + 3.0, -27.8, 161.1, T + 3.1, -27.6, 0xff2a2a, lit(1));   // the boom, the fin, its beacon
  box(161.1, T + 2.0, -27.8, 161.2, T + 2.8, -27.6, C.ink); box(161.1, T + 2.3, -28.2, 161.2, T + 2.5, -27.2, C.ink);    // the tail rotor
  for (const [dx, dz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) for (let t = .15; t < 4.7; t += .05) { const x = 161 + dx * t * .7071, z = -33.3 + dz * t * .7071, y = T + 3.2 - (t > 3.2 ? .1 : 0);
    V.box(S.X(x), S.Y(y), S.Z(z), S.X(x) + 2, S.Y(y) + 1, S.Z(z) + 1, C.ink); }
  box(160.8, T + 3.2, -33.5, 161.2, T + 3.3, -33.1, C.steelD, 2);
  part(ctx, S, [[x0, top, z0, x1, top + .5, z1], [168.8, top, -40.3, 169.3, top + 3.2, -39.9]], { big: true });
  if (inBlock(ctx, 164.4, -36.4)) life(ctx, A, { x: 164.6, y: top + .4, z: -36.4, ry: -Math.PI / 2 - .4, act: 'phone', seed: 881, hand: true });   // the flight nurse
}

// ═════════ THE ER: the wing on the ambulance court, cobalt, WAIT 6 HRS over the doors, ER on a blade at the corner, a red cross on
// its roof for the overhead; the EMERGENCY canopy over the court; the ambulances, the patrol car that came with the stabbing, the crew
function erWing(ctx) {
  const S = slice(ctx, ER.rect, SIDE, SIDE + 9.2, { pad: 1.8 }); if (!S) return;
  const Hh = 78, W = C.cobalt, T = C.chalk;
  walls(S, Hh, W); parapet(S, Hh, 5, W, T, [[150.6, -42.2, 151.2, -35.9]]);
  for (const side of ['-x', '-z', '+x', '+z']) { const f = S.F(side), L = f.len, open = side === '+x' ? span(S, '+x', -56, -42.2) : [4, L - 4], p0 = side === '+x' ? open[0] : -1;   // (the east face stops short of the tower)
    f.box(Math.max(0, p0), 1, 0, L, 3, 2, shade(W, .78)); f.box(p0, 40, 0, L + 1, 43, 2, T); f.box(p0, 74, 0, L + 1, 78, 2, T);
    ribbon(f, Math.max(4, open[0]), Math.min(L - 4, open[1]), 50, 70, { seed: 70 + WORLD[side] * 11, trim: T, litP: .7 }); }
  const Wf = S.F('-x'), N = S.F('-z'), E = S.F('+x'), So = S.F('+z');
  // the ER doors: a glass front under the canopy, two sliding doors, the white header, WAIT 6 HRS in amber LEDs above
  { const [g0, g1] = span(S, '-x', -48.8, -39.2); Wf.box(g0 - 2, 1, 0, g1 + 2, 33, 2, T); Wf.box(g0, 1, -2, g1, 30, 2, AIR);
    Wf.box(g0, 1, -3, g1, 30, -2, (a, y) => y > 24 ? 0xbfe6f2 : (a % 12 === 0 ? T : 0x7fb8d4), 1);
    for (const u of ER.doors) { const [d0, d1] = span(S, '-x', u - 1.1, u + 1.1); Wf.box(d0, 1, -3, d1, 26, -2, (a) => a === ((d0 + d1) >> 1) ? C.steelD : (TOD.night ? 0xffe9b8 : 0xd8f0f8), TOD.night ? 3 : 1); door(141, u, '-x'); }
    const [l0, l1] = span(S, '-x', -47.2, -40.8); Wf.box(l0, 33, 0, l1, 44, 2, 0x101216); Wf.text('WAIT 6 HRS', (l0 + l1) >> 1, 42, 2, 3, 0xffb020, 3, 1, 1); }
  logSign(ctx, 'WAIT 6 HRS', 141, -44);
  for (const u of [-54.6, -51.8]) { const [a0] = span(S, '-x', u, u + 1.6); win(Wf, a0, 10, 16, 24, T, {}); }
  { const [a0] = span(S, '-x', -38.4, -37.0); win(Wf, a0, 10, 14, 24, T, {}); }
  for (const u of [142.6, 146.6]) { const [a0] = span(S, '-z', u, u + 1.6); win(N, a0, 10, 16, 24, T, {}); }
  for (const u of [142.6, 146.6]) { const [a0] = span(S, '+z', u, u + 1.6); win(So, a0, 10, 16, 24, T, {}); }
  for (const u of [-54.4, -44.6]) { const [a0] = span(S, '+x', u, u + 1.6); win(E, a0, 10, 16, 24, T, {}); }
  { const [a0, a1] = span(S, '+x', -50.2, -48.8); E.box(a0 - 1, 0, 0, a1 + 1, 26, 1, C.steelD); E.box(a0, 1, -1, a1, 24, 1, AIR); E.box(a0, 1, -2, a1, 24, -1, 0x6d707a, 2); door(151, -49.5, '+x'); }
  // ER on a red blade at the court's north corner, projecting over the court (both faces lettered, lit at night)
  { const [b0] = span(S, '-x', -55.6, -55.4), sideA = S.Z(-55.6), X0 = S.X(141) - 17, y0 = 44, y1 = 78;
    Wf.box(b0, y0, 1, b0 + 2, y1, 17, C.sRed); Wf.box(b0, y0 - 1, 1, b0 + 2, y0, 17, C.chalk); Wf.box(b0, y1, 1, b0 + 2, y1 + 1, 17, C.chalk);
    for (const [ch, yt] of [['E', 75], ['R', 60]]) { const M = px(ch); vtext(S.V, M, X0 + 3, yt, sideA + 2, C.chalk, { sc: 2, l: lit(0) }); vtext(S.V, M, X0 + 3, yt, sideA - 1, C.chalk, { sc: 2, l: lit(0), dir: -1 }); } }
  // the roof: a red cross in a white square for the overhead, three condensers at the south end
  { const V = S.V, y = Hh - 1, cx = 146, cz = -50.8; S.box(cx - 3.8, SIDE + y * CV, cz - 3.8, cx + 3.8, SIDE + (y + 1) * CV, cz + 3.8, (x, yy, z) => { const dx = Math.abs(S.wx(x) - cx), dz = Math.abs(S.wz(z) - cz); return (dx < 1.1 && dz < 3.2) || (dz < 1.1 && dx < 3.2) ? C.sRed : C.chalk; });
    for (const z of [-44.4, -41.6, -38.8]) { S.box(143.2, SIDE + Hh * CV, z, 145.6, SIDE + Hh * CV + .9, z + 1.4, 0xd9dce2); S.box(143.6, SIDE + Hh * CV + .9, z + .3, 145.2, SIDE + Hh * CV + 1.0, z + 1.1, 0x9aa0a8); }
    S.box(148.4, SIDE + Hh * CV, -40.6, 149.2, SIDE + Hh * CV + 1.4, -39.8, C.steelL); void V; }
  solid(ctx, S, SIDE + 8.4, SIDE + 7.8);
}
function canopy(ctx) {
  const [x0, z0, x1, z1] = CANOPY.rect, S = slice(ctx, CANOPY.rect, SIDE + CV, SIDE + 6.6, { pad: .6 }); if (!S) return;
  const y = SIDE + CANOPY.y, box = S.box;
  box(x0, y, z0, x1, y + .3, z1, 0xe9e7e1);
  box(x0, y - .4, z0, x0 + .3, y + 1.6, z1, C.sRed); for (const [a, b] of [[z0, z0 + .3], [z1 - .3, z1]]) box(x0, y - .4, a, x0 + 1.4, y + 1.6, b, C.sRed);
  box(x0, y + 1.6, z0, x0 + .3, y + 1.7, z1, C.chalk); box(x0, y - .5, z0, x0 + .3, y - .4, z1, C.chalk);
  { const M = px('EMERGENCY'), sc = 2, zc = (z0 + z1) / 2; vtextX(S.V, M, S.Z(zc) - ((M.w * sc) >> 1), S.Y(y + 1.6) - 3, S.X(x0) - 1, C.chalk, { sc, dir: -1, l: lit(0) }); }
  logSign(ctx, 'EMERGENCY', x0, (z0 + z1) / 2);
  for (const z of [z0 + .5, z1 - .9]) box(x0 + .5, SIDE + CV, z, x0 + .9, y, z + .4, C.chalk);
  for (let z = z0 + 1.6; z < z1 - 1.4; z += 2.6) box(x0 + 2.2, y - .1, z, x1 - 1.2, y, z + .3, 0xfff6d8, lit(1));   // lights under the slab
  part(ctx, S, [[x0 + .5, SIDE, z0 + .5, x0 + .9, y, z0 + .9], [x0 + .5, SIDE, z1 - .9, x0 + .9, y, z1 - .5], [x0, y - .5, z0, x1, y + 1.7, z1]]);
}
function court(ctx, A) {
  if (ctx.i !== 4 || ctx.j !== -2) return;
  ctx.group('court'); const put = (bk, x, z, rot, o = {}) => ctx.put(bk, ...at(ctx, x, z), { rot, reach: o.reach ?? .4, slide: o.slide ?? [0, 1], y: o.y });
  put(HP.ambulance({ unit: 7, open: true }), 137.5, -48.6, 3); put(HP.ambulance({ unit: 12 }), 137.5, -44.0, 3); put(HP.ambulance({ unit: 3, lights: true }), 137.6, -55.7, 1, { slide: [1, 0] });
  put(HP.gurney(), 139.7, -51.4, 1, { slide: [1, 0] });
  put(bankOf(patrolCar({ lights: false })), 137.5, -36.4, 3, { slide: [1, 0] });
  const L = (x, z, ry, act, seed) => life(ctx, A, { x, y: SIDE + CV, z, ry, act, seed, hand: true });
  L(140.2, -52.35, 0, 'carry', 701); L(138.1, -45.75, Math.PI, 'lean', 702); L(140.3, -38.0, -Math.PI / 2, 'arms', 703); L(140.2, -39.7, -Math.PI / 2 + .5, 'phone', 704);
}
// the oxygen yard behind the ER: the liquid-oxygen tank in its chain-link pen, the generator, the fence and gate on 2nd St
function o2yard(ctx) {
  if (ctx.i !== 4 || ctx.j !== -2) return;
  ctx.group('o2'); fenceRun(ctx, 'x', -56.2, 153.2, 157.8, 'chain'); fenceRun(ctx, 'x', -50.3, 153.2, 157.8, 'chain', { gaps: [[154.6, 156.0]] }); fenceRun(ctx, 'z', 153.2, -56.1, -50.3, 'chain'); fenceRun(ctx, 'z', 157.7, -56.1, -50.3, 'chain');
  ctx.put(HP.o2Tank(), ...at(ctx, O2.x, O2.z), { rot: 1, reach: .3 });
  ctx.put(HP.plate(['OXYGEN', 'NO FLAMES'], C.chalk, 0x14a83b, { face: 'mini', posts: 2, h: .9 }), ...at(ctx, 156.9, -49.5), { rot: 0, reach: .6, slide: [1, 0] });
  ctx.put(HP.generator(), ...at(ctx, 156.4, -45.1), { rot: 0, reach: .5, slide: [1, 0] });
}

// ═════════ THE FRONT: the glass lobby, the entrance canopy, the forecourt (the smokers' corner, the vending machines, the saint with
// the cone, the flower cart, the planters), the garden on Bishop Ave
function lobby(ctx) {
  const S = slice(ctx, LOBBY.rect, SIDE, SIDE + 5.4, { pad: 1 }); if (!S) return;
  const Hh = 46, W = C.white, T = C.chalk, tow = [150.9, -24.6, 171.1, -23.9];
  walls(S, Hh, W, 0xdcdad3); parapet(S, Hh, 4, W, T, [tow]);
  const f = S.F('+z'), L = f.len; f.box(0, 1, 0, L, 3, 2, shade(W, .84)); f.box(-1, 38, 0, L + 1, 46, 2, T);
  // the curtain wall: glass floor to fascia, mullions every 1.2 m, a transom; warm light inside at night
  f.box(4, 3, -2, L - 4, 38, 1, AIR); f.box(4, 3, -3, L - 4, 38, -2, (a, y) => y > 26 ? (TOD.night ? C.lit : C.glassHi) : (TOD.night ? C.litLo : ((a + y) % 19 === 0 ? 0xeaf6ff : 0x2f5d9a)), TOD.night ? 3 : 1);
  for (let a = 4; a < L - 3; a += 12) f.box(a, 3, -2, a + 1, 38, 0, T); f.box(4, 26, -2, L - 4, 27, 0, T);
  // the doors: a revolving drum in the middle, a sliding pair either side (dark gaps in the glass)
  for (const [u, w2] of [[LOBBY.door, 1.3], [157.4, .9], [164.6, .9]]) { const [a0, a1] = span(S, '+z', u - w2, u + w2); f.box(a0, 3, -3, a1, 25, -2, (a) => (a - a0) % 6 === 0 ? C.steelL : (TOD.night ? 0xfff0c8 : 0x1b2a55), TOD.night ? 3 : 1); door(u, -17.4, '+z'); }
  // VISITING HOURS on the glass by the doors (small vinyl)
  // VISITING 11-8 on a lightbox on the fascia: cobalt letters on a cream panel that glows after dark (the fascia itself goes dark at night)
  { const [a0] = span(S, '+z', 148.3, 148.5), M = mini('VISITING 11-8'); f.box(a0 - 2, 39, 2, a0 + M.w + 2, 46, 3, C.cream, TOD.night ? 3 : 0); f.mask(M, a0, 44, 3, 4, C.cobalt, 0, 1); }
  for (const side of ['-x', '+x']) { const g = S.F(side), Lg = g.len; g.box(0, 1, 0, Lg, 3, 2, shade(W, .84)); g.box(-1, 38, 0, Lg + 1, 46, 2, T); win(g, (Lg >> 1) - 8, 10, 16, 22, T, {}); }
  solid(ctx, S, SIDE + 5.0, SIDE + 4.6);
}
function marquee(ctx) {
  const [x0, z0, x1, z1] = MARQUEE.rect, S = slice(ctx, MARQUEE.rect, SIDE + CV, SIDE + 5.0, { pad: .6 }); if (!S) return;
  const y = SIDE + MARQUEE.y, box = S.box, TL = C.teal;
  box(x0, y, z0, x1, y + .3, z1, 0xe9e7e1); box(x0, y - .2, z1 - .3, x1, y + .8, z1, TL); for (const x of [x0, x1 - .3]) box(x, y - .2, z0, x + .3, y + .8, z1, TL);
  box(x0, y + .8, z1 - .3, x1, y + .9, z1, C.chalk);
  { const M = px('MAIN ENTRANCE'); vtext(S.V, M, S.X((x0 + x1) / 2) - (M.w >> 1), S.Y(y + .8) - 1, S.Z(z1), C.chalk, { l: lit(0) }); }
  logSign(ctx, 'MAIN ENTRANCE', (x0 + x1) / 2, z1);
  for (const x of [x0 + .4, x1 - .8]) box(x, SIDE + CV, z1 - .7, x + .3, y, z1 - .4, C.steelL, 2);
  for (let x = x0 + 1.4; x < x1 - 1; x += 2.4) box(x, y - .1, z0 + 1, x + .6, y, z1 - 1, 0xfff6d8, lit(1));
  part(ctx, S, [[x0 + .4, SIDE, z1 - .7, x0 + .7, y, z1 - .4], [x1 - .8, SIDE, z1 - .7, x1 - .5, y, z1 - .4], [x0, y - .2, z0, x1, y + .9, z1]]);
}
function forecourt(ctx, A) {
  const L = (x, z, ry, act, seed, extra = {}) => { if (inBlock(ctx, x, z)) life(ctx, A, { x, y: SIDE + CV, z, ry, act, seed, hand: true, ...extra }); };
  const put = (bk, x, z, rot, o = {}) => inBlock(ctx, x, z) ? ctx.put(bk, ...at(ctx, x, z), { rot, reach: o.reach ?? .6, slide: o.slide ?? [1, 0], y: o.y }) : null;
  ctx.group('forecourt');
  // the smokers' corner at the lobby's west end: two machines, the urn, a bench, the plate everybody smokes under
  put(HP.snacks(), 149.1, -16.5, 0, { reach: .2 }); put(HP.drinks(), 150.3, -16.5, 0, { reach: .2 });
  put(HP.urn(), 147.3, -15.6, 0, { reach: .3 }); put(HP.bench(), 145.0, -16.45, 2, { reach: .4 });
  put(HP.plate(['NO SMOKING', 'WITHIN 25 FT'], C.chalk, C.sRed, { face: 'mini', posts: 1, h: 1.3 }), 147.9, -13.1, 0, { reach: .5 });
  if (ctx.i === 4 && ctx.j === -1) logSign(ctx, 'NO SMOKING WITHIN 25 FT', 147.9, -13.1);
  put(HP.wheelchair(), 143.6, -14.6, 1, { reach: .2 }); put(HP.ivPole(), 145.95, -13.5, 0, { reach: .2 });
  L(143.6, -14.6, Math.PI / 2, 'sit', 711, { seatY: .5 }); L(145.3, -14.3, -Math.PI / 2, 'talk', 712); L(146.6, -15.0, -Math.PI / 2 - .4, 'phone', 713);
  // the saint on her plinth at the Bishop Ave corner, the flower cart by the bus stop, planters on Central Ave
  put(HP.saint(), 139.4, -11.2, 0, { reach: .5 });
  put(HP.flowerCart(), 155.6, -9.8, 0, { reach: .8 }); L(155.6, -8.55, Math.PI, 'talk2', 714);
  for (const [x, s] of [[143.4, 0], [150.4, 1], [171.4, 2]]) put(HP.planterTree(s), x, -8.0, 0, { reach: .6 });
  L(162.9, -15.8, 0, 'arms', 715); L(159.0, -14.4, Math.PI, 'carry', 716); L(167.2, -10.6, -2.4, 'walk', 717);
  // a cab waiting at the curb on Central Ave (the taxi stand is on the sidewalk behind it)
  if (ctx.i === 5 && ctx.j === -1) ctx.put(taxi(), at(ctx, 164.6, 0)[0], kerbZ(-2.9), { rot: 3, y: 0, reach: .6, slide: [1, 0] });   // (SPREAD: along with the compound, at its kerb)
}
function garden(ctx) {
  ctx.group('garden');
  const put = (bk, x, z, rot, reach = .6) => inBlock(ctx, x, z) ? ctx.put(bk, ...at(ctx, x, z), { rot, reach, slide: [1, 0] }) : null;
  fenceRun(ctx, 'z', 134.0, -34, -17.4, 'iron'); fenceRun(ctx, 'x', -34.0, 134.1, 141, 'iron'); fenceRun(ctx, 'x', -60.0, 134.1, 151, 'iron'); fenceRun(ctx, 'z', 134.0, -60, -58, 'iron');
  for (const [x, z, s] of [[137.8, -30.4, 1], [145.2, -28.4, 3], [138.6, -21.4, 4], [146.4, -33.4, 0]]) put(tree(s), x, z, 0, .8);
  put(HP.bench(0x2f5b4a), 141.4, -24.3, 2); put(HP.bench(0x2f5b4a), 143.6, -31.9, 0);
}

// ═════════ THE BACK OF HOUSE: the loading dock, the 1889 wing (pathology, the morgue), the hearse, the bins; the parking garage
function dock(ctx) {
  const S = slice(ctx, [160.6, -44.2, 170.6, -42], SIDE, SIDE + 1.6, { pad: .3 }); if (!S) return;
  const box = S.box, t = SIDE + 1.2; box(160.6, SIDE, -44.2, 170.6, t, -42, C.conc); box(161.8, t - .1, -44.2, 170.6, t, -44.0, C.sYellow);
  for (let x = 162.4; x < 170.4; x += 1.6) box(x, SIDE + .4, -44.4, x + .4, SIDE + 1.0, -44.2, C.rubber);
  for (let k = 0; k < 4; k++) box(160.6 + k * .3, SIDE, -44.2, 160.6 + (k + 1) * .3, SIDE + .3 * (k + 1), -42, C.concL);   // steps up from the west
  solid(ctx, S, t, t, { plinth: false });
}
function oldWing(ctx) {
  const S = slice(ctx, OLD.rect, SIDE, SIDE + 10.4, { pad: 1 }); if (!S) return;
  const { V, B } = S, Hh = 72, BR = C.brick, CR = C.cream, SL = 0x5a5f6b;
  V.box(B.x0, 0, B.z0, B.x1, Hh, B.z1, BR);
  for (let k = 0; k < 26; k++) { const i = 2 * k; if (B.x0 + i >= B.x1 - i || B.z0 + i >= B.z1 - i) break; V.box(B.x0 - 2 + i, Hh + k, B.z0 - 2 + i, B.x1 + 2 - i, Hh + k + 1, B.z1 + 2 - i, k % 3 === 2 ? 0x4c515c : SL); }   // the hip roof, slate
  const WINS = { '-z': [[4, 82], [4, 82]], '+z': [[10, 43, 76], [10, 43, 76]], '-x': [[10, 43, 76], [10, 43, 76]], '+x': [[6, 78], [6, 43, 78]] };
  for (const side of ['-z', '+z', '-x', '+x']) { const f = S.F(side), L = f.len;
    f.box(0, 1, 0, L, 6, 2, CR); f.box(-1, 36, 0, L + 1, 39, 2, CR); f.box(-2, 66, 0, L + 2, 72, 3, CR); for (let a = 0; a < L; a += 3) f.set(a, 65, 1, CR);   // base, string course, cornice + dentils
    WINS[side].forEach((list, fl) => { const [y0, h] = fl ? [44, 17] : [10, 20]; for (const a of list) { const on = TOD.night && H(a, y0, WORLD[side]) > .6;
      f.box(a - 2, y0 - 2, 0, a + 16, y0 + h + 4, 1, CR); f.box(a, y0, -2, a + 14, y0 + h, 1, AIR);
      f.box(a, y0, -3, a + 14, y0 + h, -2, (aa, y) => (Math.abs(aa - a - 6.5) + (y - y0 - h + 7) * 2 > 12 && y > y0 + h - 7) ? BR : (on ? C.litLo : ((aa - a) === 7 || y === y0 + 9 ? CR : C.glass)), on ? 3 : 1);
      f.box(a + 6, y0 + h + 1, 0, a + 8, y0 + h + 4, 2, CR); } }); }
  // the old front on 2nd St: a stone portal, the door bricked up long ago, PATHOLOGY cut in the lintel, 1889 on a plaque over it
  { const f = S.F('-z'), [a0, a1] = span(S, '-z', 163.6, 166.4), m = (a0 + a1) >> 1; f.box(a0 - 4, 1, 0, a1 + 4, 40, 3, CR); f.box(a0, 6, 1, a1, 30, 3, shade(BR, .85));
    f.box(m - 30, 40, 0, m + 30, 50, 4, CR); f.text('PATHOLOGY', m, 48, 4, 5, BR, 0, 1, 1); f.box(m - 12, 52, 0, m + 12, 62, 2, CR); f.text('1889', m, 60, 2, 3, BR, 0, 1, 1); }
  logSign(ctx, 'PATHOLOGY 1889', 165, -58);
  // the east side: the steel doors on the service lane (the morgue's), a lamp over them, RECEIVING on a board
  { const f = S.F('+x'), [a0, a1] = span(S, '+x', -53.4, -51.0), m = (a0 + a1) >> 1; f.box(a0 - 2, 1, 0, a1 + 2, 30, 2, C.steelD); f.box(a0, 1, -1, a1, 28, 2, AIR); f.box(a0, 1, -2, a1, 28, -1, (a) => a === m ? C.ink : 0x8a9099, 2);
    f.box(m - 2, 31, 0, m + 2, 34, 3, 0xfff0b0, lit(1)); f.box(m - 20, 36, 0, m + 20, 43, 2, C.ink); f.mask(mini('RECEIVING'), m - 17, 41, 2, 3, C.chalk, 0, 1); door(170, -52.2, '+x'); }
  logSign(ctx, 'RECEIVING', 170, -52.2);
  solid(ctx, S, SIDE + Hh * CV + 2.6, SIDE + Hh * CV);
}
function yard(ctx) {
  const put = (bk, x, z, rot, o = {}) => inBlock(ctx, x, z) ? ctx.put(bk, ...at(ctx, x, z), { rot, reach: o.reach ?? .6, slide: o.slide ?? [1, 0], y: o.y }) : null;
  ctx.group('yard');
  fenceRun(ctx, 'x', -60.0, 151, 160, 'chain', { gaps: [[156.8, 160]] });
  put(dumpster(0x2f7a3a), 162.6, -46.4, 0); put(dumpster(0x6d707a), 165.2, -46.4, 0); put(HP.bioBin(), 167.6, -46.1, 0, { reach: .3 }); put(HP.bioBin(), 168.5, -46.1, 0, { reach: .3 });
  put(HP.linenCart(), 163.4, -43.1, 0, { y: SIDE + 1.2, reach: .3 }); put(HP.linenCart(), 166.8, -43.1, 0, { y: SIDE + 1.2, reach: .3 }); put(HP.bioBin(), 169.4, -43.1, 0, { y: SIDE + 1.2, reach: .2 });
  put(HP.hearse(), 172.3, -53.0, 2, { slide: [0, 1], reach: .8 });
  if (ctx.i === 5 && ctx.j === -2) { A_LIFE(ctx, 172.4, -49.3, Math.PI, 'phone', 721); }
}
const A_LIFE = (ctx, x, z, ry, act, seed) => life(ctx, ctx.A, { x, y: SIDE + CV, z, ry, act, seed, hand: true });
function garage(ctx) {
  const [x0, z0, x1, z1] = GARAGE.rect, S = slice(ctx, GARAGE.rect, SIDE, SIDE + 10.6, { pad: 2 }); if (!S) return;
  const { V } = S, box = S.box, CO = C.conc, LV = [null, C.yellow, C.green, C.cobalt], lh = GARAGE.lh, ramp = [179.6, 182.4], Y = k => SIDE + k * lh;
  box(x0, SIDE, z0, x1, SIDE + .1, z1, 0x8f8b84);                                                               // the ground floor
  for (let k = 1; k <= 3; k++) { box(x0, Y(k) - .3, z0, x1, Y(k), z1, CO); box(ramp[0], Y(k) - .3, -50, ramp[1], Y(k), -38, AIR);   // decks, the ramp well
    box(x0, Y(k), z0, x1, Y(k) + 1.0, z0 + .2, LV[k]); box(x0, Y(k), z1 - .2, x1, Y(k) + 1.0, z1, LV[k]); box(x0, Y(k), z0, x0 + .2, Y(k) + 1.0, z1, LV[k]); box(x1 - .2, Y(k), z0, x1, Y(k) + 1.0, z1, LV[k]);   // the level's colour
    box(x0, Y(k) + 1.0, z0, x1, Y(k) + 1.1, z1, (x, y, z) => { const wx = S.wx(x), wz = S.wz(z); return (wx < x0 + .2 || wx > x1 - .2 || wz < z0 + .2 || wz > z1 - .2) ? C.concL : undefined; }); }
  for (let k = 0; k < 3; k++) { const ya = Y(k), yb = Y(k + 1), up = k % 2 === 0;   // scissor ramps up the aisle
    for (let z = -50; z < -38; z += .1) { const t = up ? (-38 - z) / 12 : (z + 50) / 12, y = ya + t * (yb - ya); box(ramp[0], Math.max(ya, y - .3), z, ramp[1], y, z + .1, 0xb8b2a6); } }
  for (const x of [x0, 181, x1 - .4]) for (const z of [z0, -53.4, -47, -40.6, z1 - .4]) { if (x === 181 && z > -52 && z < -37) continue; box(x, SIDE, z, x + .4, Y(3), z + .4, CO); }
  // cars on every level, nose to the walls (seeded gaps), in bright colours: from the overhead the decks read as a car park
  const CARS = [0xe8232a, 0x2f5bff, 0xf7f7f2, 0x17171b, 0x25b84c, 0x8a3cff, 0xff7a1a, 0x12b3a0, 0xffc21a];
  for (let k = 0; k <= 3; k++) for (const [cx, dir] of [[176.8, -1], [185.2, 1]]) for (let z = z0 + 1.6, n = 0; z < z1 - 1.2; z += 2.6, n++) {
    if (k === 0 && z > -38.5) continue; if (H(k * 31 + n, cx | 0, 9) < (k === 3 ? .45 : .28)) continue; carVox(S, cx, Y(k) + (k ? 0 : .1), z, dir, CARS[(H(k, n, cx | 0) * CARS.length) | 0]); }
  // the south face: the way in and out, the clearance bar (MAX 7 FT), PATIENT PARKING on the yellow deck; the blue P over Orchard St
  box(176.2, Y(1) - 1.0, z1 - .1, 187.6, Y(1) - .3, z1 + .1, (x) => { const wx = S.wx(x); return (wx < 177.6 || wx > 186.2) && ((Math.floor(wx / .3)) & 1) ? C.ink : C.sYellow; });
  { const M = mini('MAX 7 FT'); vtext(V, M, S.X(181.9) - (M.w >> 1), S.Y(Y(1) - .45), S.Z(z1 + .1), C.ink); }
  { const M = px('PATIENT PARKING'); vtext(V, M, S.X((x0 + x1) / 2) - (M.w >> 1), S.Y(Y(1) + .85), S.Z(z1), C.cobalt); }
  logSign(ctx, 'PATIENT PARKING', (x0 + x1) / 2, z1);
  { const zb = z1 - 1.0, yb0 = Y(2) + .2, yb1 = Y(3) - .3; box(x1, yb0, zb, x1 + 2.0, yb1, zb + .2, C.cobalt);
    const P = impact('P', 30), xL = S.X(x1 + 1.0) - (P.w >> 1), yT = S.Y(yb1 - .2); vtext(V, P, xL, yT, S.Z(zb + .2), C.chalk, { l: lit(0) }); vtext(V, P, xL, yT, S.Z(zb) - 1, C.chalk, { l: lit(0), dir: -1 }); }
  solid(ctx, S, Y(3) + 1.1, Y(3));
  { const [x, z] = at(ctx, (x0 + x1) / 2, (z0 + z1) / 2); ctx.A.roofs.push({ x, z, y: Y(3) + 1.1, w: x1 - x0, d: z1 - z0 }); }
}
// a parked car drawn into a slice (garage decks): 1.8 × 4.2 m along x, nose toward dir (±1)
function carVox(S, cx, y, cz, dir, c) { const box = S.box, x0 = cx - 2.1, x1 = cx + 2.1, z0 = cz - .9, z1 = cz + .9, nose = dir > 0 ? x1 : x0;
  for (const x of [x0 + .5, x1 - 1.1]) for (const z of [z0 - .05, z1 - .25]) box(x, y, z, x + .6, y + .6, z + .3, C.rubber);
  box(x0, y + .25, z0, x1, y + .85, z1, c); box(x0 + (dir > 0 ? .9 : 1.1), y + .85, z0 + .1, x1 - (dir > 0 ? 1.1 : .9), y + 1.55, z1 - .1, c);
  box(x0 + (dir > 0 ? 1.0 : 1.2), y + 1.0, z0 + .05, x1 - (dir > 0 ? 1.2 : 1.0), y + 1.45, z1 - .05, 0x9fd8ff);
  box(nose - (dir > 0 ? .1 : 0), y + .45, z0 + .2, nose + (dir > 0 ? 0 : .1), y + .65, z0 + .5, 0xffffff); box(nose - (dir > 0 ? .1 : 0), y + .45, z1 - .5, nose + (dir > 0 ? 0 : .1), y + .65, z1 - .2, 0xffffff); }
function lane(ctx) {
  if (ctx.i !== 5 || ctx.j !== -2 && ctx.j !== -1) return;
  const put = (bk, x, z, rot, o = {}) => inBlock(ctx, x, z) ? ctx.put(bk, ...at(ctx, x, z), { rot, reach: o.reach ?? .4, slide: o.slide ?? [1, 0] }) : null;
  ctx.group('lane'); put(HP.payBooth(), 181.0, -31.6, 0, { reach: .2 }); put(HP.gateArm(34), 182.5, -31.6, 0, { reach: .1 }); put(HP.gateArm(34), 179.5, -31.6, 2, { reach: .1 });
  if (ctx.j === -1) life(ctx, ctx.A, { x: 181.0, y: SIDE + CV + .2, z: -31.6, ry: 0, act: 'clerk', seed: 731, hand: true });
}

// ═════════ THE MEDICAL ARTS BUILDING on Central Ave & Orchard St: violet, MERCY RX on the corner with its green cross, GET WELL GIFTS
// with balloons in the window, the injury doctor and the dentist upstairs, a painted ad on the lane side, a billboard on the roof
function annex(ctx) {
  const [x0, z0, x1, z1] = ANNEX.rect, S = slice(ctx, ANNEX.rect, SIDE, SIDE + 11.6, { pad: 1.8 }); if (!S) return;
  const Hh = 108, W = C.violet, T = C.chalk;
  walls(S, Hh, W); parapet(S, Hh, 5, W, T);
  for (const side of ['+z', '-x', '+x', '-z']) { const f = S.F(side), L = f.len; f.box(0, 1, 0, L, 3, 2, shade(W, .75)); f.box(-1, 42, 0, L + 1, 45, 2, T); f.box(-1, 103, 0, L + 1, 108, 2, T);
    if (side === '-z') { const [d0, d1] = span(S, '-z', 185.6, 187.0); f.box(d0 - 1, 0, 0, d1 + 1, 26, 1, C.steelD); f.box(d0, 1, -1, d1, 24, 1, AIR); f.box(d0, 1, -2, d1, 24, -1, 0x6d707a, 2); door(186.3, -28, '-z'); continue; }
    for (const y0 of [52, 85]) for (let a = 8; a + 14 <= L - 6; a += 24) win(f, a, y0, 14, 18, T, {});
    if (side === '+x') for (let a = 14; a + 14 <= L - 10; a += 34) win(f, a, 10, 14, 22, T, {}); }
  const Sf = S.F('+z'), Wf = S.F('-x'), Nf = S.F('-z');
  // the storefronts on Central Ave: MERCY RX (the corner) and GET WELL GIFTS
  const front = (f, a0, a1, name, band, fg, goods) => { f.box(a0, 3, 0, a1, 42, 2, C.ink); f.box(a0 + 2, 32, 0, a1 - 2, 41, 3, band); f.text(name, (a0 + a1) >> 1, 40, 3, 4, fg, lit(0), 1, 1);
    f.box(a0 + 3, 6, -2, a1 - 3, 29, 1, AIR); f.box(a0 + 3, 6, -3, a1 - 3, 29, -2, (a, y) => goods(a - a0, y), 1); };
  const bottles = (a, y) => y > 25 ? (TOD.night ? C.lit : 0xeaf6ff) : (y % 5 === 0 ? 0xf7f7f2 : [0xe8232a, 0x2de2e6, 0xffe23a, 0xf7f7f2, 0x25b84c][(a * 7 + (y / 5 | 0)) % 5]);
  const balloons = (a, y) => { const k = (a / 7 | 0) * 3 + (y / 7 | 0), cx = (a / 7 | 0) * 7 + 3.5, cy = (y / 7 | 0) * 7 + 3.5; return Math.hypot(a + .5 - cx, y + .5 - cy) < 3.2 && H(k, 3) > .25 ? [0xff4fa3, 0xffe23a, 0x2de2e6, 0xe8232a, 0x6cff4a][(H(k, 5) * 5) | 0] : (TOD.night ? C.litLo : 0x2a3354); };
  { const [a0, a1] = span(S, '+z', 176, 181.8); front(Sf, a0 + 1, a1 - 1, 'MERCY RX', C.chalk, 0x14a83b, bottles); }
  { const [a0, a1] = span(S, '+z', 181.8, 188); front(Sf, a0 + 1, a1 - 1, 'GET WELL', 0xff4fa3, C.chalk, balloons); const [d0, d1] = span(S, '+z', 186.2, 187.4); Sf.box(d0, 1, -3, d1, 29, -2, TOD.night ? 0xfff0c8 : 0x1b2a55, TOD.night ? 3 : 1); door(186.8, -6, '+z'); }
  logSign(ctx, 'MERCY RX', 179.3, -6); logSign(ctx, 'GET WELL', 185.3, -6);
  { const [a0, a1] = span(S, '-x', -14.0, -6.0); front(Wf, a0, a1 - 2, 'RX', C.chalk, 0x14a83b, bottles); door(176, -16.0, '-x'); const [d0, d1] = span(S, '-x', -16.8, -15.2); Wf.box(d0, 1, -2, d1, 25, 1, AIR); Wf.box(d0, 1, -3, d1, 25, -2, TOD.night ? 0xfff0c8 : 0x1b2a55, TOD.night ? 3 : 1); }
  { const [a0, a1] = span(S, '-x', -26.0, -18.0); Wf.box(a0, 3, 0, a1, 42, 2, C.ink); Wf.box(a0 + 2, 32, 0, a1 - 2, 41, 3, C.chalk); Wf.text('MEDICAL ARTS', (a0 + a1) >> 1, 40, 3, 4, W, 0, 1, 1);
    Wf.box(a0 + 30, 1, -2, a1 - 30, 28, 1, AIR); Wf.box(a0 + 30, 1, -3, a1 - 30, 28, -2, TOD.night ? 0xfff0c8 : 0x1b2a55, TOD.night ? 3 : 1); door(176, -22.0, '-x'); }
  logSign(ctx, 'MEDICAL ARTS', 176, -22);
  // the doctors upstairs, on sign bands between the floors (Central Ave)
  { const f = Sf, L = f.len; f.box(8, 71, 0, L - 8, 81, 2, C.chalk); f.text('INJURY & SPINE', L >> 1, 79, 2, 3, C.sRed, 0, 1, 1); f.box(8, 104, 0, L - 8, 108, 2, T); }
  logSign(ctx, 'INJURY & SPINE', 182, -6);
  // the pharmacy's green cross on a blade at the corner, over the forecourt (lit at night)
  { const [b0] = span(S, '-x', -7.4, -7.2), X0 = S.X(x0) - 13, zA = S.Z(-7.4); Wf.box(b0, 48, 1, b0 + 2, 70, 13, C.ink);
    for (const [zz, dir] of [[zA - 1, -1], [zA + 2, 1]]) for (let y = 52; y < 67; y++) for (let x = 1; x < 12; x++) { const dx = Math.abs(x - 6), dy = Math.abs(y - 59); if ((dx <= 1 && dy <= 5) || (dy <= 1 && dx <= 5)) S.V.set(X0 + x, y, zz, 0x3dff6a, lit(1)); } }
  // the lane side: a painted ad from the city's pool (the shared signage system)
  { const L = Nf.len; paintedAd(Nf, 10, 50, L - 20, 46, null, C.sRed, C.chalk); }
  solid(ctx, S, SIDE + 11.4, SIDE + 10.8);
  // the rooftop billboard over Central Ave (the shared signage system: a design from the city's pool, a 4× character on its catwalk)
  if (ctx.i === 5 && ctx.j === -1) { const was = REG.strict; REG.strict = false; ctx.group('annex-roof');
    buildSetPiece(ctx.bank, { kind: 'billboard', seed: 5171, alongX: true, col: C.sYellow, col2: C.pink }, (([x0, z0, x1, z1]) => ({ x0, z0, x1, z1 }))(atR(ctx, [177.2, -11.4, 186.8, -8.2])), SIDE + Hh * CV, { seed: 5171 }, ctx.A);
    REG.strict = was; }
}

// ═════════ fences: black iron round the garden and along 2nd St, galvanized chain-link at the yards (drawn per block, a keep each)
function fenceRun(ctx, ax, at, u0, u1, style = 'iron', o = {}) {
  const h = style === 'iron' ? 11 : 19, r = ax === 'x' ? [u0, at, u1, at + CV] : [at, u0, at + CV, u1], S = slice(ctx, r, SIDE + CV, SIDE + (h + 4) * CV, { pad: .2 });
  if (!S || !S.clip) return; const { V } = S, gaps = o.gaps || [], IR = style === 'iron' ? C.ink : 0xaeb3ba, MESH = 0xc4c8ce;
  const n = Math.round((u1 - u0) / CV), q0 = ax === 'x' ? S.X(u0) : S.Z(u0), c = ax === 'x' ? S.Z(at) : S.X(at);
  const set = (q, y, cl, l = 0) => ax === 'x' ? V.set(q0 + q, y, c, cl, l) : V.set(c, y, q0 + q, cl, l);
  const gap = q => { const u = u0 + (q + .5) * CV; return gaps.some(([a, b]) => u >= a && u < b); };
  for (let q = 0; q < n; q++) { if (gap(q)) continue; const post = q % (style === 'iron' ? 12 : 24) === 0 || q === n - 1 || gap(q - 1) || gap(q + 1);
    if (post) { for (let y = 0; y < h + (style === 'iron' ? 2 : 0); y++) set(q, y, IR, style === 'iron' ? 0 : 2); continue; }
    if (style === 'iron') { set(q, 1, IR); set(q, h - 1, IR); if (q % 2 === 0) for (let y = 1; y < h + 1; y++) set(q, y, IR); }
    else { set(q, h - 1, IR, 2); for (let y = 1; y < h - 1; y++) if (((y + q) & 1) === 0) set(q, y, MESH, 2); } }
  const k = S.clip; part(ctx, S, [[k[0], SIDE, k[1], k[2], SIDE + (h + 3) * CV, k[3]]]);
}

// ═════════ the whole compound, as far as it reaches this block
export function campus(ctx) {
  const A = ctx.A;
  ground(ctx);
  ctx.group('tower'); podium(ctx); shaft(ctx); ctx.group('helipad'); helipad(ctx, A);
  ctx.group('er'); erWing(ctx); ctx.group('canopy'); canopy(ctx);
  ctx.group('lobby'); lobby(ctx); ctx.group('marquee'); marquee(ctx);
  ctx.group('dock'); dock(ctx); ctx.group('old'); oldWing(ctx); ctx.group('garage'); garage(ctx);
  ctx.group('annex'); annex(ctx);
  garden(ctx); ctx.group('o2'); o2yard(ctx);
  ctx.group('structure'); fin(ctx);
  court(ctx, A); forecourt(ctx, A); yard(ctx); lane(ctx);
  fin(ctx);
  if (clipR(ctx, TOWER.rect)) { const [x, z] = at(ctx, 161, -33); A.roofs.push({ x, z, y: TOWER.top + 3.2, w: 18, d: 16, tower: true }); }
}
