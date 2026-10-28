// LOW TIDE DOCKS · THE GANTRY (block 3,−8) · owner: the supply agent. A ship-to-shore crane on its rails at the quay, its boom out over
// the bay above a moored feeder ship, a box swinging on the spreader; container rows under the portal and on the apron, the truck gate
// on Dock St. The crane is the waterfront's landmark (red-orange, 40 m, a red light on the apex): it ends the view down Maple St and
// Bishop Ave. Built at 0.2 (STYLE §1: landmark grain) in two volumes (crane, ship); the rest goes through the engine's checks.
import { Vol, meshVol } from '../vox.js';
import { TOD } from '../kit.js';
import { blockCtx } from '../engine.js';
import { kitNamed } from '../modules.js';
import { C, PAL, CV, SIDE, REG, shade, hash, px, impact, vtext, vtextX, lit, logSign } from '../districts/industrial/lib.js';
import { DECKS } from '../districts/industrial/names.js';
import { container, forklift, cone, pallet, postSign, lightTower, mooring } from '../districts/industrial/props.js';
import { floor, fence } from '../districts/industrial/yard.js';
import { quay, streetEnd, QUAY_Z, seaOff } from '../districts/docks/parts.js';
import { framed, foot, sign } from '../districts/junkyard/parts.js';   // (SPREAD: the block's frame)
import { off } from '../districts/frame.js';

const LINES = DECKS.lines;   // the docks own 0–13; this block: 6 GULLWING, 8 BALLAST, 9 LODESTAR, 10 CAPSTAN, 11 BOSUN, 12 HAWSER, 13 MISTRAL
const CR = 0xef4a2a, RAIL = [-253.6, -241.6], LEGX = [103, 119];
export function gantry(bank, b, A) {
  const kit = kitNamed('docks'), ctx = blockCtx(bank, b, A, kit); REG.strict = true;
  try { build(framed(ctx)); ctx.finish(); } finally { REG.strict = false; }
}
function build(ctx) {
  // the apron: concrete with the two crane rails set in it (steel strips on a darker beam)
  ctx.group('apron'); floor(ctx, [100, -255.4, 122, -230.1], 'conc', [], { paint: (x, z) => { for (const rz of RAIL) { const d = Math.abs(z - rz); if (d < .12) return C.steelL; if (d < .45) return C.concD; } return null; } });
  ctx.group('crane'); crane(ctx); for (const t of ['PORT OF LOW TIDE', 'SALT QUEEN', 'PIER 3']) sign(ctx, t, 111, -240);
  ctx.group('ship'); ship(ctx);
  // containers: three rows under the portal, two on the landside apron; a reach stacker; the gate
  ctx.group('stacks'); const put = (line, len, x, z, h) => { const [name, mk, col] = LINES[line], bk = container(name, col, mk, len); for (let lv = 0; lv < h; lv++) if (!ctx.put(bk, x, z, { y: SIDE + CV + lv * 2.6, reach: .01 })) break; };
  put(6, 40, 111, -250.9, 2); put(11, 40, 111, -247.6, 3); put(6, 20, 107.9, -244.3, 1); put(11, 20, 114.3, -244.3, 2);
  put(12, 20, 104.2, -236.4, 2); put(13, 20, 110.6, -236.4, 3); put(12, 40, 115.9, -233.1, 1); put(13, 20, 104.2, -233.1, 1);
  ctx.put(forklift(C.hazard), 120.3, -238.4, { rot: 3, reach: 1 }); for (const [x, z] of [[101.2, -243.2], [121, -251], [121, -245.6]]) ctx.put(cone(), x, z, { reach: .4 });
  ctx.put(lightTower(), 101, -248.2, { reach: .6 });
  ctx.group('gate'); fence(ctx, [100, -230.2, 122, -230], ['+z'], 'chain', '+z', [], { gateAt: 110.6, gateW: 8 });
  ctx.put(postSign(['PIER 3'], C.cobalt, C.chalk, { post: 13, border: C.hazard }), 104.2, -231.2, { rot: 0, reach: .8, slide: [1, 0] });
  ctx.group('quay'); quay(ctx, 98, 124, { bollards: false }); for (const x of [99.6, 116]) ctx.put(mooring(), x, QUAY_Z + .3, { reach: .4, slide: [1, 0] }); ctx.group('street-end'); streetEnd(ctx, 124, 132);
}

// ── the crane: rail bogies, four legs, the portal, the A-frame, the boom over the bay (tip at z −284), the machinery house on the
// back end with PORT OF LOW TIDE, the operator's cab under the boom, the trolley with a box on the spreader over the ship
function crane(ctx) {
  const S = .2, O = [100.6, SIDE + CV, -285.4], [sx, sz] = off(ctx), V = new Vol(Math.round(20.4 / S), 200, Math.round(51 / S), { s: S, org: [O[0] + sx, O[1], O[2] + sz], ground: true }), night = TOD.night;   // (SPREAD: drawn in frame metres, at the frame's place)
  const X = x => Math.round((x - O[0]) / S), Y = y => Math.round((y - O[1]) / S), Z = z => Math.round((z - O[2]) / S);
  const bx = (x0, y0, z0, x1, y1, z1, c, l = 0) => V.box(X(x0), Y(y0), Z(z0), X(x1), Y(y1), Z(z1), c, l);
  const line = (a, b, c, t = 1) => { const n = Math.ceil(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) / S * 1.2); for (let k = 0; k <= n; k++) { const u = k / n, x = X(a[0] + (b[0] - a[0]) * u), y = Y(a[1] + (b[1] - a[1]) * u), z = Z(a[2] + (b[2] - a[2]) * u); V.box(x, y, z, x + t, y + t, z + t, c); } };
  const W = CR, WD = shade(CR, .78), yP = 14, yB = 26.5, yA = 38;
  // bogies on the rails, legs (hazard-striped feet), the portal beams
  for (const x of LEGX) for (const z of RAIL) { bx(x - 1.4, SIDE + CV, z - .5, x + 1.4, SIDE + 1.1, z + .5, C.ink); for (const dx of [-1, 0, 1]) bx(x + dx - .3, SIDE + CV, z - .6, x + dx + .3, SIDE + .7, z + .6, C.steelD);
    bx(x - .6, SIDE + 1.1, z - .6, x + .6, yP, z + .6, (xx, yy) => yy < Y(3.4) ? (((yy + xx) >> 1) & 1 ? C.hazard : C.ink) : W); }
  for (const x of LEGX) bx(x - .6, yP, RAIL[0] - .6, x + .6, yP + 1.4, RAIL[1] + .6, W);
  for (const z of RAIL) bx(LEGX[0] - .6, yP, z - .6, LEGX[1] + .6, yP + 1.2, z + .6, WD);
  // the seaside legs run on up to the boom; the landside back-stays lean in to meet them
  for (const x of LEGX) { bx(x - .5, yP + 1.4, RAIL[0] - .5, x + .5, yB, RAIL[0] + .5, W); line([x, yP + 1.4, RAIL[1]], [x, yB - .2, RAIL[0] + 1.2], W, 4); }
  // the boom: two box girders at x 105.4 and 115.6 from the tip (z −284.4) to the back end (z −236.4), cross beams, a walkway
  for (const x of [105.4, 115.6]) bx(x - .5, yB, -284.4, x + .5, yB + 1.6, -236.4, W);
  for (let z = -284; z < -237; z += 6) bx(105.4, yB + .4, z, 115.6, yB + 1.2, z + .6, WD);
  bx(104.2, yB, -283, 104.9, yB + .2, -237.6, C.steelD); for (let z = -283; z < -238; z += 1.2) bx(104.2, yB + .2, z, 104.4, yB + 1.2, z + .2, C.hazard);
  // the A-frame over the seaside legs and the forestays to the tip and the back end
  for (const x of [105.4, 115.6]) { line([x, yB + 1.6, RAIL[0] + 1.8], [x, yA, -250], W, 5); line([x, yB + 1.6, -240], [x, yA, -250], W, 5); }
  bx(105, yA, -250.6, 116, yA + 1, -249.4, W); bx(110.1, yA + 1, -250.2, 110.9, yA + 2.6, -249.8, C.steelD); bx(109.9, yA + 2.6, -250.4, 111.1, yA + 3.2, -249.6, 0xff2a2a, night ? 3 : 1);
  for (const x of [105.9, 115.1]) { line([x, yA, -250.6], [x, yB + 1.6, -283.6], C.ink, 1); line([x, yA, -249.4], [x, yB + 1.6, -237.2], C.ink, 1); }
  bx(115.1, yB + 1.6, -284.4, 115.9, yB + 2.4, -283.6, 0xff2a2a, night ? 3 : 1);
  // the machinery house on the back end, the name on its landside face and its flanks
  bx(104.4, yB + 1.6, -243.6, 116.6, yB + 5.4, -236.2, C.chalk); bx(104.2, yB + 5.4, -243.8, 116.8, yB + 5.8, -236, C.steelL);
  for (const [x0, x1] of [[104.2, 104.4], [116.6, 116.8]]) for (let k = 0; k < 3; k++) bx(x0, yB + 3.6, -242.6 + k * 2.2, x1, yB + 4.6, -241.4 + k * 2.2, night ? C.lit : PAL.glassLo, night ? 3 : 1);
  const zf = Z(-236.2); for (const [t, top] of [['PORT OF', yB + 5.2], ['LOW TIDE', yB + 3.4]]) { const M = px(t); V.recNext(); for (let j = 0; j < 7; j++) for (let i = 0; i < M.w; i++) if (M.at(i, j)) { const x = X(110.6) - (M.w >> 1) + i, y = Y(top) - j; V.set(x, y, zf, C.red); V.rec(M.s, x, y, zf, x, zf - 1, x, zf + 1); } }
  // the cab under the boom, seaward of the legs: glass all round, lit at night
  bx(105.4, yB, -258.4, 115.6, yB + 1, -257, WD); bx(109.4, yB - .8, -258.4, 111.8, yB, -257, C.steelD); bx(109, yB - 3.6, -259, 112.2, yB - .8, -256.4, (x, y, z) => (y === Y(yB - 3.6) || y >= Y(yB - 1.2)) ? C.chalk : (night ? C.lit : 0x9fd8ff), 1);
  // the trolley at z −266 and the spreader with a CAPSTAN box on it, over the ship
  const zt = -266.4; bx(105.8, yB + 1.6, zt - 1.2, 115.2, yB + 2.6, zt + 1.2, C.hazard); const yS = 16.2;
  for (const x of [106.6, 114.4]) for (const dz of [-.8, .8]) bx(x, yS + .6, zt + dz, x + .2, yB + 1.6, zt + dz + .2, C.ink);
  bx(104.4, yS, zt - 1.4, 116.6, yS + .6, zt + 1.4, C.hazard); const [cn, , cc] = LINES[10]; bx(104.5, yS - 2.6, zt - 1.2, 116.5, yS, zt + 1.2, (x) => x % 4 === 0 ? shade(cc, .86) : cc);
  const N = px(cn); for (let j = 0; j < 7; j++) for (let i = 0; i < N.w; i++) if (N.at(i, j)) { V.set(X(110.5) - (N.w >> 1) + i, Y(yS - .6) - j, Z(zt + 1.2) - 1, C.chalk); V.set(X(110.5) + (N.w >> 1) - i, Y(yS - .6) - j, Z(zt - 1.2), C.chalk); }
  meshVol(V, ctx.bank);
  foot(ctx, LEGX[0] - 1.4, RAIL[0] - .6, LEGX[0] + 1.4, RAIL[1] + .6, SIDE + yP, SIDE + yP); foot(ctx, LEGX[1] - 1.4, RAIL[0] - .6, LEGX[1] + 1.4, RAIL[1] + .6, SIDE + yP, SIDE + yP);
}

// ── the feeder ship moored along the quay: navy hull, red below the waterline, container bays on deck (three lines), the white house
// aft with the bridge wings, the funnel in the line's green, her name on the quarter; mooring lines to the quay
function ship(ctx) {
  const S = .2, [sx, sz] = off(ctx), O = [95 + sx, -.6, -267.6 + sz + seaOff(ctx)], L = 180, Wd = 50, V = new Vol(L, 92, Wd + 8, { s: S, org: O, ground: false }), night = TOD.night;   // (SPREAD: the ship keeps to the water's edge)
  const HULL = 0x243a6a, DECKY = 25, mid = Wd / 2;
  for (let a = 0; a < L; a++) { const t = a / (L - 1), bow = t > .8 ? (t - .8) / .2 : 0, stern = t < .03 ? 1 : 0, half = mid * (1 - bow * bow * .9) - stern, rise = Math.round(bow * bow * 6);
    for (let b = 0; b < Wd; b++) { const db = Math.abs(b + .5 - mid); if (db > half) continue; const edge = db > half - 1.2 || a === 0 || stern;
      for (let y = 0; y < DECKY + 3 + rise; y++) { if (!edge && y > 3 && y !== DECKY) continue; if (!edge && y > DECKY) continue;
        V.set(a, y, b, y < 3 ? 0x8a2a22 : y < 4 ? C.ink : y === DECKY + 2 + rise ? C.chalk : y >= DECKY && !edge ? 0x5e6e62 : y > DECKY ? HULL : HULL); } } }
  // container bays: two 40 ft bays, four rows across, two or three high (BALLAST rust, LODESTAR green, CAPSTAN rose)
  const BAY = [[36, 97], [99, 160]], CL = [LINES[8][2], LINES[9][2], LINES[10][2]];
  BAY.forEach(([a0, a1], k) => { for (let r = 0; r < 4; r++) { const b0 = 3 + r * 11, tiers = 2 + ((hash(k, r, 7) * 2) | 0), col = CL[(k * 2 + r) % 3];
    for (let t = 0; t < tiers; t++) { const y0 = DECKY + 1 + t * 13; V.box(a0, y0, b0, a1, y0 + 13, b0 + 11, (a, y) => (y === y0 + 12) ? shade(col, .9) : (a - a0) % 5 === 0 ? shade(col, .84) : col); } } });
  // the house aft: four decks of windows, the wheelhouse, wings to the full beam; the funnel behind it
  const h0 = 3, h1 = 33, w0 = 8, w1 = 42; V.box(h0, DECKY + 1, w0, h1, DECKY + 49, w1, C.chalk);
  for (let dk = 0; dk < 4; dk++) { const y = DECKY + 5 + dk * 12; V.box(h1, y, w0 + 2, h1 + 1, y + 5, w1 - 2, (a, yy, b) => (b % 5 === 0) ? C.chalk : (night && hash(b, dk) > .5 ? C.lit : PAL.glassLo), night ? 3 : 1); }
  V.box(h0 + 2, DECKY + 49, 0, h1 + 2, DECKY + 57, Wd, C.chalk); V.box(h1 + 2, DECKY + 51, 3, h1 + 3, DECKY + 55, Wd - 3, night ? C.lit : PAL.glassHi, night ? 3 : 1); V.box(h0 + 2, DECKY + 57, 0, h1 + 2, DECKY + 58, Wd, C.steelD);
  V.box(h0 - 1, DECKY + 49, mid - 4, h0 + 9, DECKY + 66, mid + 4, CL[1]); V.box(h0 - 1, DECKY + 58, mid - 4, h0 + 9, DECKY + 61, mid + 4, C.chalk); V.box(h0 - 1, DECKY + 66, mid - 4, h0 + 9, DECKY + 68, mid + 4, C.ink);
  // her name on both quarters (bow to the right as painted)
  const M = px('SALT QUEEN'); for (let j = 0; j < 7; j++) for (let i = 0; i < M.w; i++) if (M.at(i, j)) { V.set(40 + i, DECKY - 5 - j, Wd - 1, C.chalk); V.set(40 + M.w - 1 - i, DECKY - 5 - j, 0, C.chalk); }
  // mooring lines: bow and stern to the quay (z −256), sagging
  for (const [a, dx] of [[8, 3], [90, 3]]) for (let k = 0; k <= 40; k++) { const u = k / 40, x = a + dx * u * 5, z = Wd + Math.round(u * 7), y = DECKY + 2 - Math.round(Math.sin(u * Math.PI) * 4) - Math.round(u * 20); V.set(Math.round(x), Math.max(y, 3), z, C.ink); }
  REG.keep([O[0], -.6, O[2], O[0] + L * S, 6, O[2] + Wd * S], 'ship'); meshVol(V, ctx.bank);
}
