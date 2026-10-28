// BLACKPINE WOODS · THE ROUTE 9 FERRY LANDING (stitch pass, 2026-09-27 · the stitching agent, at the woods' border). Worker-safe.
// The plan's Route 9 ran on south past the island's coast and out over the sea. The island ends it the way a highway ends at the water:
// at the ferry (plan.js R9_END stops the road at z 384). A concrete apron from the road's end over the beach: the southbound lane past
// the ticket booth and its barrier arm, two cars in the queue, the northbound lanes open; then the slip, a yellow gantry with the
// green FERRY board over the steel ramp that hangs on its cables down to the car deck of the GETAWAY, an orange double-ended ferry
// with two cars aboard. One piece, built by block HOME (Route 9's centreline is the block line, so the apron spans two blocks; the
// woods of both leave it clear: plan.js LANDING). The far tier is a handful of boxes (landingFar).
import { Vol, meshVol, boxInto } from '../../vox.js';
import { REG } from '../../audit.js';
import { PAL, CV, hash } from '../../style.js';
import { TOD } from '../../kit.js';
import { lampPost, car } from '../../props.js';
import { LANDING } from './plan.js';
import { HWY, SPREAD } from '../../../../world/city.js';
// SPREAD · the landing is authored in today's metres, in its own frame: it moves with Route 9's south end (the highway's line and row 12's
// line: LX, LZ), and its walkways are Route 9's own, wider on a spread (plan.js LANDING: the apron's outer edges at Route 9's lot lines).
// The builders below draw in the frame; every volume, prop, sign, person and far box goes through LX / LZ into the spread world.
const LX = HWY * SPREAD, LZ = 12 * SPREAD;
import { M, pv, done, txt, txtX } from './props.js';
import { logSign } from './signs.js';

export const HOME = [6, 12];   // the block that builds it (the one west of the centreline: the east one keeps land of its own, so both far tiers draw something)
export const LAMPS = [[216.0, 389.0, 1], [232.0, 389.0, 3]].map(([x, z, r]) => [x + LX, z + LZ, r]);   // the apron's two lamps [x, z, rot] (the kit declares them: main.js lends them night lights)
const [AX0, AZ0, AX1, AZ1] = LANDING.apron.map((v, k) => v - (k & 1 ? LZ : LX)), RX0 = 217, RX1 = 231;           // the apron; Route 9's roadway (the walkways outside it)
const ISLE = [222.9, 389.6, 225.1, 397.4], BOOTH = [223.5, 391.0, 224.9, 396.0], ARM_Z = 393.8;
const TW = [218.8, 219.8], TE = [228.2, 229.2], TZ = [398.8, 399.8], BEAM = [8.4, 9.4], BOARD = [219.2, 228.8, 6.4, 9.4], SHEAVE = [220.8, 227.2];   // the gantry
const RAMP = [220.4, 400, 227.6, 406.6], DECK = 1.2;                                  // the ramp: from the roadway (0.1) up to the car deck
const [FX0, FZ0, FX1, FZ1] = LANDING.ferry.map((v, k) => v - (k & 1 ? LZ : LX));
const C = {
  conc: 0xc9c3b6, concJ: 0xb4ad9f, concD: 0xa9a397, oil: 0xaaa396, hazard: 0xffd21f, ink: PAL.ink, chalk: 0xf7f7f2, white: 0xf4f1ea, rail: 0xb9bec6,
  yellow: 0xffc21a, beamLo: 0xe0a800, green: PAL.green, sign: 0xffe23a, cable: 0x2a2d38, steel: 0x8a9099, steelL: 0x9aa0a8, steelD: 0x4b4f58,
  red: PAL.red, teal: 0x12b3a0, door: 0x0e6e62, orange: 0xff7a1a, boot: 0x8a2a22, deck: 0x5b5e66, cabinRoof: 0xd3d4d7, mast: 0xfff1c0,
  glass: PAL.glassLo, glint: PAL.glint, lit: PAL.litHi, litLo: PAL.litLo,
};
const lit = (day = 0) => TOD.night ? 3 : day;
const inR = (x, z, r) => x >= r[0] && x < r[2] && z >= r[1] && z < r[3];

// a mooring bollard: an ink post with a yellow cap (0.3 × 0.6 m)
const bollard = () => M('stitch-bollard', 'bollard', () => { const V = pv(3, 6, 3); V.box(0, 0, 0, 3, 5, 3, C.ink); V.box(0, 5, 0, 3, 6, 3, C.hazard); return done(V, 'bollard'); });

export function landing(ctx) {
  if (ctx.i !== HOME[0] || ctx.j !== HOME[1]) return;
  ctx.group('landing'); apron(ctx); railings(ctx); booth(ctx); barrier(ctx); gantry(ctx); ramp(ctx);
  ctx.group('ferry'); ferry(ctx);
  ctx.group('landing');
  for (const [x, z, rot] of LAMPS) ctx.put(lampPost(), x, z, { rot, y: .2, reach: 0 });
  for (const x of [216.0, 232.0]) ctx.put(bollard(), x + LX, 398.9 + LZ, { y: .2, reach: .3, slide: [0, 1] });
  // the queue at the arm, and two cars aboard (car colours by seed)
  for (const [x, y, z, s] of [[219.95, .1, 391.2, 3], [219.95, .1, 386.5, 6], [221.0, DECK, 412.6, 1], [223.6, DECK, 418.2, 4]]) ctx.put(car(s), x + LX, z + LZ, { rot: 0, y, reach: 0 });
  logSign('FERRY', 224 + LX, 398.3 + LZ); logSign('TO THE MAINLAND', 224 + LX, 398.3 + LZ); logSign('TICKETS', 223.4 + LX, 393.5 + LZ); logSign('GETAWAY', 224 + LX, 417.6 + LZ);
  // people with jobs: a driver out of the queue on the phone, a walk-on with a bag waiting for the ramp, the deckhand waving cars aboard
  for (const [x, y, z, ry, act, seed] of [[216.0, .2, 392.6, 0, 'phone', 9101], [232.0, .2, 396.4, 0, 'carry', 9102], [225.2, DECK, 408.4, Math.PI, 'arms', 9103]])
    ctx.A.life.push({ x: x + LX, y, z: z + LZ, ry, act, seed, hand: true });
}

// ── the apron (0.1 m cubes): the roadway 0.1 up (concrete slabs, Route 9's centre line on to the island, the edge lines, a STOP bar at
// the arm, a kerb along the water's edge beside the ramp), the walkways 0.2 up with the curb on the road side and a yellow coping on
// the water side, the booth's island 0.3 up with a striped nose
function apron(ctx) {
  const V = ctx.volume(AX0 + LX, 0, AZ0 + LZ, AX1 + LX, .3, AZ1 + LZ, { walk: true });
  V.box(0, 0, 0, V.nx, V.ny, V.nz, (x, y, z) => { const wx = AX0 + (x + .5) * CV, wz = AZ0 + (z + .5) * CV;
    if (wx < RX0 || wx > RX1) { if (y > 1) return undefined;   // the walkways
      const out = wx < RX0 ? wx - AX0 : AX1 - wx, inn = wx < RX0 ? RX0 - wx : wx - RX1;
      if (inn < .2) return y ? PAL.curbTop : PAL.curbFace; if (out < .25) return y ? C.hazard : C.concD;
      return ((wz - AZ0) % 1.5) < .1 ? PAL.joint : PAL.walk; }
    if (inR(wx, wz, ISLE)) { const e = Math.min(wx - ISLE[0], ISLE[2] - wx, wz - ISLE[1], ISLE[3] - wz);   // the island
      if (e < .2) return y === 2 ? PAL.curbTop : PAL.curbFace;
      if (y < 2) return C.concD; if (wz < ISLE[1] + 1.2) return (Math.floor((wx - wz) / .3) & 1) ? C.hazard : C.ink; return C.conc; }
    if (y === 1) return wz > AZ1 - .2 && (wx < RAMP[0] || wx >= RAMP[2]) ? C.hazard : undefined;   // the kerb at the water's edge
    if (y > 0) return undefined;
    // the roadway
    if (wz < AZ0 + .2) return C.steelL;                                                    // the joint plate where the asphalt ends
    if (wz < ISLE[1] && Math.abs(Math.abs(wx - 224) - .2) < .1) return PAL.lineY;           // the double yellow, on to the island
    if (Math.abs(wx - (RX0 + .35)) < .06 || Math.abs(wx - (RX1 - .35)) < .06) return PAL.lineW;   // the edge lines
    if (wx < ISLE[0] && wz > ARM_Z - .75 && wz < ARM_Z - .4) return PAL.lineW;               // STOP at the arm
    if (wx < ISLE[0] && wz > 384.6 && wz < ARM_Z - .8 && Math.abs(wx - 219.95) < .8 && hash(Math.floor(wx / .4), Math.floor(wz / .4), 71) < .07) return C.oil;   // where the queue idles
    return ((wz - AZ0) % 3) < .1 || ((wx - RX0) % 3.5) < .1 ? C.concJ : C.conc; });
}
// the walkways' railings: posts every 1.5 m, a top and a mid rail, along the water side and across the south end
function railings(ctx) {
  for (const [x0, x1, side] of [[AX0, RX0, -1], [RX1, AX1, 1]]) { const V = ctx.volume(x0 + LX, .2, AZ0 + LZ, x1 + LX, 1.2, AZ1 + LZ, {}), ox = side < 0 ? 0 : V.nx - 1;
    const rail = (x, z) => { V.set(x, 9, z, C.rail); V.set(x, 4, z, C.rail); };
    for (let z = 0; z < V.nz; z++) { rail(ox, z); if (z % 15 === 1) for (let y = 0; y < 9; y++) V.set(ox, y, z, C.rail); }
    for (let x = 0; x < V.nx; x++) { rail(x, V.nz - 1); if (x % 15 === 1 || x === V.nx - 1 - ox) for (let y = 0; y < 9; y++) V.set(x, y, V.nz - 1, C.rail); } }
}
// the ticket booth on its island: teal walls, a white band and roof, the window onto the lane and the end windows (lit at night), the
// door on the far side, TICKETS on a yellow board on the roof, facing the lane (the board lights up at night)
function booth(ctx) {
  const [x0, z0, x1, z1] = BOOTH, pad = 2, nx = Math.round((x1 - x0) / CV) + 2 * pad, nz = Math.round((z1 - z0) / CV) + 2 * pad, H = 26, night = TOD.night;
  const V = new Vol(nx, 42, nz, { s: CV, org: [x0 - pad * CV + LX, .3, z0 - pad * CV + LZ], ground: true }); ctx.mass(V, [x0 + LX, z0 + LZ, x1 + LX, z1 + LZ], { top: .3 + 4.2, roofY: .3 + 2.8 });
  const a0 = pad, a1 = nx - pad, b0 = pad, b1 = nz - pad;
  V.box(a0, 0, b0, a1, H, b1, (x, y, z) => { const ex = x === a0 || x === a1 - 1, ez = z === b0 || z === b1 - 1; if (!ex && !ez) return y === 0 ? C.concD : undefined;
    return y >= H - 3 || (y === 9 && x === a0) ? C.chalk : C.teal; });
  const glaze = (x, y, z) => V.set(x, y, z, night ? C.lit : ((y + z) % 13 === 0 ? C.glint : C.glass), lit(0));
  for (let y = 10; y < 22; y++) { for (let z = b0 + 3; z < b1 - 3; z++) glaze(a0, y, z); if (y >= 12) for (let x = a0 + 3; x < a1 - 3; x++) { glaze(x, y, b0); glaze(x, y, b1 - 1); } }
  for (let y = 0; y < 22; y++) for (let z = b0 + 20; z < b0 + 32; z++) V.set(a1 - 1, y, z, y === 21 ? C.chalk : C.door);   // the door (east)
  V.box(0, H, 0, nx, H + 2, nz, C.chalk);                                                                                  // the roof, 0.2 over all round
  const w = 39, zb = Math.round((nz - (w + 6)) / 2);                                                                       // TICKETS: ink on a yellow board
  V.box(pad + 1, H + 2, zb, pad + 3, H + 13, zb + w + 6, C.sign, lit(0)); for (const z of [zb, zb + w + 5]) V.box(pad + 1, H + 2, z, pad + 3, H + 14, z + 1, C.ink);
  txtX(V, 'TICKETS', zb + 3, H + 11, pad, C.ink, 0, -1);
}
// the barrier arm: a yellow post on the island's west kerb, a red and white striped arm across the southbound lane at 1.0 m
function barrier(ctx) {
  const V = ctx.volume(217.3 + LX, .3, ARM_Z - .2 + LZ, 223.3 + LX, 1.3, ARM_Z + .3 + LZ, {}), px = V.nx - 3;
  V.box(px, 0, 1, px + 3, 9, 4, C.yellow); V.box(px, 9, 1, px + 3, 10, 4, C.ink);
  for (let x = 0; x < px; x++) V.set(x, 7, 2, ((x / 5) | 0) % 2 ? C.chalk : C.red);
}
// the slip gantry (0.1 m cubes): two lattice towers (hazard stripes at their feet), the beam with its sheaves, the green board — FERRY /
// TO THE MAINLAND, the letters lit at night — and the two cables down to the ramp's tip
function gantry(ctx) {
  const X0 = 218.6, Y0 = .1, Z0 = 398.3, V = ctx.volume(X0 + LX, Y0, Z0 + LZ, 229.4 + LX, 9.8, TZ[1] + LZ, {}), cx = x => Math.round((x - X0) / CV), cy = y => Math.round((y - Y0) / CV), cz = z => Math.round((z - Z0) / CV);
  const tz0 = cz(TZ[0]), tz1 = cz(TZ[1]), top = cy(BEAM[1]);
  for (const [a, b] of [TW, TE]) { const x0 = cx(a), x1 = cx(b);
    for (let y = 0; y < top; y++) for (let x = x0; x < x1; x++) for (let z = tz0; z < tz1; z++) { const ex = x - x0 < 2 || x1 - 1 - x < 2, ez = z - tz0 < 2 || tz1 - 1 - z < 2; if (!ex && !ez) continue;
      const u = ex && ez ? 0 : ex ? z - tz0 : x - x0, post = ex && ez, ring = y % 20 < 2, brace = (y + u) % 20 < 2 || (y - u + 400) % 20 < 2;
      if (post || ring || brace) V.set(x, y, z, y < 12 && ((y + u) >> 2) % 2 ? C.ink : C.yellow); } }
  V.box(0, cy(BEAM[0]), tz0, V.nx, top, tz1, (x, y) => y === cy(BEAM[0]) ? C.beamLo : C.yellow);
  for (const x of SHEAVE) { const c = cx(x); V.box(c - 3, top, tz0 + 2, c + 3, top + 3, tz1 - 2, C.steelD); V.box(c - 1, top + 3, tz0 + 3, c + 1, top + 4, tz1 - 3, C.steelL); }
  // the board on the beam's north face (a white border), the lettering on its north face
  const bx0 = cx(BOARD[0]), bx1 = cx(BOARD[1]), by0 = cy(BOARD[2]), by1 = cy(BOARD[3]), bz0 = cz(398.4);
  V.box(bx0, by0, bz0, bx1, by1, tz0, (x, y, z) => z === bz0 && (x === bx0 || x === bx1 - 1 || y === by0 || y === by1 - 1) ? C.chalk : C.green);
  const row = (s, w, sc, ytop) => txt(V, s, cx(224) - ((w * sc) >> 1), ytop, bz0 - 1, C.chalk, lit(0), -1, sc);
  row('FERRY', 29, 2, by1 - 5); row('TO THE MAINLAND', 83, 1, by0 + 9);
  // the cables (one volume each, a cell wide): from the beam's underside down to the ramp's tip, in 26-connected steps
  for (const x of SHEAVE) { const za = (TZ[0] + TZ[1]) / 2, V2 = ctx.volume(x + LX, DECK, za + LZ, x + CV + LX, BEAM[0], RAMP[3] - .1 + LZ, {}), n = Math.max(V2.ny, V2.nz) - 1;
    for (let k = 0; k <= n; k++) V2.set(0, Math.round((V2.ny - 1) * (1 - k / n)), Math.round((V2.nz - 1) * k / n), C.cable); }
}
// the ramp: a checker-plate deck rising from the roadway to the car deck, girders under its edges, yellow kerbs on them
function ramp(ctx) {
  const [x0, z0, x1, z1] = RAMP, V = ctx.volume(x0 + LX, .1, z0 + LZ, x1 + LX, DECK + .3, z1 + LZ, {}), rise = Math.round((DECK - .1) / CV) - 1;
  for (let z = 0; z < V.nz; z++) { const h = Math.round(rise * (z + 1) / V.nz);
    for (let x = 0; x < V.nx; x++) { const edge = x < 2 || x >= V.nx - 2;
      V.set(x, h, z, edge ? C.hazard : ((x >> 1) + (z >> 1)) % 2 ? C.steel : C.steelL);
      if (edge) { V.set(x, h + 1, z, C.hazard); for (let y = Math.max(0, h - 3); y < h; y++) V.set(x, y, z, C.steelD); } } }
}

// ── the GETAWAY (0.2 m cubes, like the docks' boats): an orange double-ended ferry, a boot-top at the waterline, a white cap on the
// bulwarks, GETAWAY on both sides; the car deck open at the slip end (hazard stripes on its lip); the white cabin along the east side
// with its row of windows, the wheelhouse over it (windows all round), the red funnel with a white band, the mast and its light, two
// life rings. Lit windows at night.
function ferry(ctx) {
  const S = .2, nx = Math.round((FX1 - FX0) / S), nz = Math.round((FZ1 - FZ0) / S), V = new Vol(nx, 38, nz, { s: S, org: [FX0 + LX, 0, FZ0 + LZ], ground: true }), night = TOD.night;
  const inset = a => { const t = Math.min(a, nz - 1 - a); return t < 8 ? Math.round(((8 - t) / 8) ** 2 * 4) : 0; };
  const inHull = (a, b) => b >= inset(a) && b < nx - inset(a), edge = (a, b) => !inHull(a, b - 2) || !inHull(a, b + 2) || !inHull(a - 2, b) || !inHull(a + 2, b);
  for (let a = 0; a < nz; a++) for (let b = 0; b < nx; b++) { if (!inHull(a, b)) continue; const e = edge(a, b), open = a < 3 && b >= 5 && b < nx - 5;
    for (let y = 0; y < 9; y++) { if (y > 5 && (!e || open)) continue;
      V.set(b, y, a, y === 0 ? C.boot : y === 8 ? C.chalk : e || y < 5 ? C.orange : a < 3 ? (((a + b) >> 1) % 2 ? C.hazard : C.ink) : b === 14 && a % 6 < 3 ? PAL.lineY : C.deck); } }
  const pane = (x, y, z, k) => { const on = night && hash(k, 3, 91) < .66; V.set(x, y, z, on ? C.lit : C.glass, on ? 3 : 0); };
  V.box(33, 6, 18, 44, 18, 91, (x, y) => y === 17 ? C.cabinRoof : C.white);                                               // the cabin
  for (let z = 20; z < 89; z++) if (z % 6 > 1) for (let y = 11; y < 14; y++) for (const x of [33, 43]) pane(x, y, z, z * 7 + x);
  V.box(28, 18, 44, 46, 27, 71, (x, y) => y === 26 ? C.ink : C.white);                                                  // the wheelhouse
  for (let y = 21; y < 25; y++) { for (let x = 29; x < 45; x++) for (const z of [44, 70]) if ((x + z) % 4) pane(x, y, z, x * 11 + z); for (let z = 45; z < 70; z++) for (const x of [28, 45]) if ((x + z) % 4) pane(x, y, z, x * 11 + z); }
  V.box(36, 18, 78, 42, 33, 87, (x, y) => y >= 31 ? C.ink : y === 26 || y === 27 ? C.chalk : C.red);                   // the funnel
  V.box(38, 27, 56, 39, 37, 57, C.chalk); V.set(38, 37, 56, night ? C.mast : C.chalk, lit(0));                           // the mast and its light
  for (const z of [30, 64]) for (let dy = 0; dy < 3; dy++) for (let dz = 0; dz < 3; dz++) if (dy !== 1 || dz !== 1) V.set(32, 8 + dy, z + dz, (dy + dz) % 2 ? C.chalk : C.orange);   // life rings
  const n0 = (nz - 41) >> 1; txtX(V, 'GETAWAY', n0, 7, 0, C.chalk, 0, -1); txtX(V, 'GETAWAY', n0, 7, nx - 1, C.chalk, 0, 1);                                         // amidships, both sides
  REG.surface(V); REG.keep([FX0 + 28 * S + LX, DECK, FZ0 + 18 * S + LZ, FX1 + LX, 7.6, FZ0 + 91 * S + LZ], 'ferry'); meshVol(V, ctx.bank);
}

// ── the far tier: the same things as boxes (drawn by block HOME, whatever block their centre lies in) → the top (m), 0 elsewhere
export function landingFar(bank, i, j, air) {
  if (i !== HOME[0] || j !== HOME[1]) return 0;
  const B = (x0, y0, z0, x1, y1, z1, c, sides = 63) => boxInto(bank, 0, x0 + LX, y0, z0 + LZ, x1 + LX, y1, z1 + LZ, air(c), sides);
  B(RX0, 0, AZ0, RX1, .1, AZ1, C.conc, 4); B(AX0, 0, AZ0, RX0, .2, AZ1, PAL.walk, 4 | 2); B(RX1, 0, AZ0, AX1, .2, AZ1, PAL.walk, 4 | 1);
  B(ISLE[0], .1, ISLE[1], ISLE[2], .3, ISLE[3], C.conc); B(BOOTH[0], .3, BOOTH[1], BOOTH[2], 2.9, BOOTH[3], C.teal); B(BOOTH[0] - .2, 2.9, BOOTH[1] - .2, BOOTH[2] + .2, 3.1, BOOTH[3] + .2, C.chalk);
  for (const [a, b] of [TW, TE]) B(a, .1, TZ[0], b, BEAM[1], TZ[1], C.yellow);
  B(218.6, BEAM[0], TZ[0], 229.4, BEAM[1], TZ[1], C.yellow); B(BOARD[0], BOARD[2], 398.4, BOARD[1], BOARD[3], TZ[0], C.green);
  B(RAMP[0], .1, RAMP[1], RAMP[2], .7, RAMP[3], C.steel);
  B(FX0, 0, FZ0, FX1, 1.8, FZ1, C.orange, 63 - 4); B(FX0 + .4, 1.2, FZ0 + .2, FX1 - .4, 1.25, FZ1 - .4, C.deck, 4);
  B(FX0 + 6.6, 1.2, FZ0 + 3.6, FX0 + 8.8, 3.6, FZ0 + 18.2, C.white); B(FX0 + 5.6, 3.6, FZ0 + 8.8, FX1, 5.4, FZ0 + 14.2, C.white); B(FX0 + 7.2, 3.6, FZ0 + 15.6, FX0 + 8.4, 6.6, FZ0 + 17.4, C.red);
  return BEAM[1];
}
