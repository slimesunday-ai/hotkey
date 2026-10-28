// THE YARDS · THE CHOP SHOP on Maple & Foundry (block 2,−6) · owner: the supply agent. A chop shop posing as a legit body shop: PREMIUM
// COLLISION on Maple St with its bays, a car on the lift with its doors already off; behind a high sheet-metal fence the truth: cars
// being taken down to parts, doors and wheels in piles, an engine on a hoist, a VIN board. WE BUY CARS on the Foundry St wall. The
// smith's workshop on the Mill St corner (locks, safes, welding: the sim's fixers craft here). The dealing corner's quadrant (the
// sim's Maple & Foundry, (96, −192)) is kept clear at the block's north-east corner. No people: walkers only.
import { Vol, meshVol } from '../vox.js';
import { AIR, TOD, frame } from '../kit.js';
import { blockCtx } from '../engine.js';
import { kitNamed } from '../modules.js';
import { C, PAL, CV, SIDE, REG, shade, hash, px, stencil, hand, impact, serif, vtext, vtextX, ftext, inkOn, lit, doorAt, fw, logSign, framed, kerb } from '../districts/industrial/lib.js';   // (SPREAD: framed / kerb, today's metres → the spread world)
import { tires, car, carOnBlocks } from '../props.js';
import { pallet, drums, cone, postSign, gasCage, forklift, handTruck } from '../districts/industrial/props.js';
import { floor, fence, plateOn } from '../districts/industrial/yard.js';
import { sash, rollup, manDoor, hollow, fitName, paintName } from '../districts/industrial/works.js';
import { carcass } from '../districts/junkyard/parts.js';

const ZONE = [89.8, -189.3, 93.3, -186];                  // the dealers' quadrant of Maple & Foundry (as heroes/corners.js draws it for section 1)
const SHOP = [82, -185.6, 92, -170.4], SMITH = [82, -169.6, 92, -164], YARD = [68, -188, 81.4, -164];
export function chopShop(bank, b, A) {
  const kit = kitNamed('industrial'), ctx = framed(blockCtx(bank, b, A, kit)); REG.strict = true;   // (authored in today's metres, the block's frame)
  try { build(ctx); ctx.finish(); } finally { REG.strict = false; }
}
function build(ctx) {
  const [zx0, zz0] = kerb(ZONE[0], ZONE[1]), [zx1, zz1] = kerb(ZONE[2], ZONE[3]); REG.keep([zx0, SIDE, zz0, zx1, SIDE + 2.6, zz1], 'corner-zone');   // (the corner's quadrant keeps to the kerb)
  ctx.group('shop'); shop(ctx); for (const t of ['PREMIUM COLLISION', 'INSURANCE WORK WELCOME', 'BODY · PAINT', 'LOCKS & SAFES', 'WELDING', 'WE BUY CARS ANY CONDITION NO TITLE NO PROBLEM', 'CUSTOMERS STAY OUT']) logSign(t, ...kerb(86, -178));
  ctx.group('smith'); smith(ctx);
  // the yard: tall sheet fence on Linden, Foundry and Mill; gravel; stripped cars, parts in piles, the engine hoist, the VIN board
  ctx.group('yard'); floor(ctx, YARD, 'gravel', [], { keep: [[68, -188, 81.4, -187.9], [68, -188, 68.1, -164], [68, -164.1, 81.4, -164]] });
  fence(ctx, YARD, ['-z', '-x', '+z'], 'panel', null, [], { panels: [0x6d707a, 0x2f5bff, 0xa7a9b1, 0x3a3a42, 0x17171b, 0x4b4f58] });
  ctx.group('apron'); floor(ctx, [81.6, -188, 92, -185.9], 'asph', [], { keep: [ZONE], paint: (x, z) => (Math.abs(((x - 82) * 10 | 0) % 26) < 1 && z > -187.6) ? C.chalk : null });
  ctx.group('parts'); ctx.put(carcass(0x2f5bff), 72.2, -182.6, { rot: 0, reach: 1 }); ctx.put(carcass(0xe8232a), 76.6, -178.8, { rot: 0, reach: 1 }); ctx.put(carOnBlocks(2), 72.4, -171.6, { rot: 0, reach: 1 });
  doorsPile(ctx, 77.6, -186.2); wheels(ctx, 70, -186.4); ctx.put(tires(), 79.8, -168.2, { reach: .5 }); ctx.put(tires(), 78.4, -166.4, { reach: .5 }); ctx.put(tires(), 80, -166.6, { reach: .5 });
  hoist(ctx, 78.4, -173); ctx.put(gasCage(), 69.6, -166.2, { rot: 1, reach: .6 }); ctx.put(drums(0x17171b, 3), 70, -176.4, { reach: .6 }); ctx.put(pallet('crates', 2), 79.8, -183.2, { reach: .6 });
  ctx.put(postSign(['CUSTOMERS', 'STAY OUT'], C.ink, C.hazard, { post: 12, face: 'stencil', s: .05 }), 80.4, -178.4, { rot: 3, reach: .6, slide: [0, 1] });
  // WE BUY CARS: hand-painted on the yard's Foundry St fence, facing the corner
  ctx.group('wall-sign'); weBuy(ctx);
  ctx.put(car(6), 85.8, -187, { rot: 1, reach: .8 });
}

// ── PREMIUM COLLISION: a one-and-a-half storey shop on Maple St, three bays (the middle one open: a car on the lift with its doors off),
// the office door, the big box sign on the parapet, the PAINT BOOTH vent stack on the roof; its north end faces the corner
function shop(ctx) {
  const [x0, z0, x1, z1] = SHOP, Hv = 62, W = 0xf4f1ea, night = TOD.night, b = ctx.building(x0, z0, x1, z1, { h: Hv * CV, wall: W, trim: C.ink, faces: ['+x', '-z'], cornice: false, parapet: 4, roof: 0xd2d3d6, extra: 60 }); hollow(b.V, b.B, Hv);
  const f = b.F('+x'), L = f.len;   // a runs south → north? ('+x': a runs toward −z, from z1 at a 0)
  f.box(0, 0, 0, L, 3, 1, C.ink); f.box(0, 37, 0, L, 47, 2, C.red, TOD.night ? 3 : 0); f.box(0, 47, 0, L, 48, 2, C.ink);
  const bays = [8, 46, 84]; bays.forEach((a, k) => { const c = rollup(f, a, 34, 32, k === 1 ? C.red : 0x2f5bff, 0, { open: k === 1 ? .82 : 0 }); doorAt(f, c, '+x'); });
  // inside the open bay: a lift, a car up on it with its doors gone, the doors leaning against the back wall
  const ba = bays[1]; f.box(ba + 3, 1, -12, ba + 5, 18, -10, C.steelL); f.box(ba + 29, 1, -12, ba + 31, 18, -10, C.steelL); f.box(ba + 3, 18, -12, ba + 31, 19, -3, C.hazard);
  f.box(ba + 6, 19, -11, ba + 28, 25, -4, 0x25b84c); f.box(ba + 9, 25, -10, ba + 25, 31, -5, (a, y, d) => (y > 26 && (a === ba + 9 || a === ba + 24)) ? undefined : 0x25b84c); f.box(ba + 6, 19, -12, ba + 28, 21, -11, 0x2a2624);
  for (const k of [0, 1]) f.box(ba + 6 + k * 12, 1, -11, ba + 14 + k * 12, 9, -10, 0x25b84c);
  manDoor(f, L - 24, C.ink, '+x', {});
  // the sign: PREMIUM COLLISION in red on a white box on the parapet, INSURANCE WORK WELCOME on the band; lit at night
  const M1 = fitName('PREMIUM COLLISION', 'impact', L - 16, 18) || fitName('PREMIUM COLLISION', 'px', L - 16, 18), bw = (M1.two ? Math.max(M1.fa.M.w * M1.fa.sc, M1.fb.M.w * M1.fb.sc) : M1.M.w * M1.sc) + 12, bh = (M1.two ? M1.fa.M.h * M1.fa.sc + M1.fb.M.h * M1.fb.sc + 3 : M1.M.h * M1.sc) + 8, ba0 = (L - bw) >> 1;
  f.box(ba0, Hv + 4, 0, ba0 + bw, Hv + 4 + bh, 3, W, night ? 3 : 0); f.box(ba0, Hv + 4, 3, ba0 + bw, Hv + 5, 4, C.red); f.box(ba0, Hv + 3 + bh, 3, ba0 + bw, Hv + 4 + bh, 4, C.red);
  for (const a of [ba0 + 6, ba0 + bw - 8]) f.box(a, Hv, 0, a + 2, Hv + 4, 2, C.steelD);
  paintName(f, M1, L >> 1, Hv + bh, C.red, { d0: 3, l: night ? 3 : 0 });
  const S = px('INSURANCE WORK WELCOME'); if (S.w < L - 6) ftext(f, S, L >> 1, 45, { c: C.chalk, d0: 2, d1: 3, l: night ? 3 : 0 });
  // the north end (Foundry St, the corner): windows, a camera watching the corner, BODY · PAINT · FRAME
  const n = b.F('-z'), Ln = n.len; n.box(0, 0, 0, Ln, 3, 1, C.ink); n.box(0, 37, 0, Ln, 47, 2, C.red, night ? 3 : 0);
  sash(n, 10, 12, 30, 18, { seed: 8, trim: C.ink, litShare: .4 }); sash(n, 54, 12, 30, 18, { seed: 9, trim: C.ink, litShare: .4 });
  const T = px('BODY · PAINT'); if (T.w < Ln - 4) ftext(n, T, Ln >> 1, 45, { c: C.chalk, d0: 2, d1: 3, l: night ? 3 : 0 });
  n.box(Ln - 5, 44, 0, Ln - 3, 47, 3, C.iron); n.box(Ln - 7, 45, 3, Ln - 2, 48, 7, 0xdfe3e8); n.set(Ln - 3, 46, 7, 0xff2a2a, night ? 3 : 0);
  // the paint booth's exhaust stack on the roof, painted
  const V = b.V, B = b.B; V.box(B.x0 + 12, Hv, B.z0 + 30, B.x0 + 30, Hv + 14, B.z0 + 52, 0xc9ced6); V.box(B.x0 + 18, Hv + 14, B.z0 + 38, B.x0 + 24, Hv + 34, B.z0 + 44, 0x9aa0a8); V.box(B.x0 + 17, Hv + 34, B.z0 + 37, B.x0 + 25, Hv + 36, B.z0 + 45, 0x6d707a);
}
// ── the smith: a small corrugated workshop on the Mill St corner, a roll-up open on the forge glow, an anvil, LOCKS · SAFES · WELDING
function smith(ctx) {
  const [x0, z0, x1, z1] = SMITH, Hv = 44, W = 0x7a3cff, night = TOD.night, b = ctx.building(x0, z0, x1, z1, { h: Hv * CV, wall: W, trim: C.chalk, faces: ['+x', '+z'], cornice: false, parapet: 3, roof: 0xb8b5ae }); hollow(b.V, b.B, Hv);
  for (const side of ['+x', '+z']) { const f = b.F(side); for (let a = 1; a < f.len - 1; a += 3) f.box(a, 3, 1, a + 1, Hv - 2, 2, shade(W, .86)); f.box(0, 0, 0, f.len, 3, 1, C.ink); }
  const f = b.F('+z'), L = f.len;   // Mill St: the open door on the forge
  const c = rollup(f, 8, 34, 32, C.ink, 0, { open: .9 }); doorAt(f, c, '+z');
  f.box(9, 1, -12, 42, 3, -4, 0x5a5650); f.box(12, 3, -11, 18, 9, -8, C.steelD); f.box(11, 9, -11, 20, 11, -7, C.steelD); f.box(30, 3, -12, 40, 14, -9, night ? 0xff6a1a : 0xc0391b, night ? 3 : 1);   // anvil, forge
  const M = px('LOCKS & SAFES'); if (M.w < L - 6) { f.box((L >> 1) - (M.w >> 1) - 3, 35, 1, (L >> 1) + (M.w >> 1) + 4, 44, 2, C.chalk); ftext(f, M, L >> 1, 42, { c: C.ink, d0: 2, d1: 3 }); }
  manDoor(f, 70, C.ink, '+z', {});
  const e = b.F('+x'); const N = hand('WELDING', 6); e.box(6, 20, 1, 6 + N.w + 6, 20 + N.h + 4, 2, C.hazard); ftext(e, N, 9, 20 + N.h + 1, { c: C.ink, d0: 2, d1: 3, align: 0 });
}
// ── parts: a heap of car doors leaning on each other, a stack of wheels, the engine hoist with an engine hanging (structures)
function doorsPile(ctx, x, z) { const V = ctx.volume(x - 1.6, SIDE + CV, z - .8, x + 1.6, SIDE + CV + 1.4, z + .8, { keep: 'parts' }); const cols = [0x25b84c, 0xe8232a, 0x2f5bff, 0xf4f1ea, 0xffc21a, 0x17171b];
  for (let k = 0; k < 6; k++) { const x0 = 1 + k * 5; for (let y = 0; y < 12; y++) { const zz = 2 + Math.round(y * .45); V.box(x0, y, zz, x0 + 4, y + 1, zz + 2, cols[k]); if (y > 6 && y < 10) V.box(x0 + 1, y, zz, x0 + 3, y + 1, zz + 1, 0x2a2d38); } } }
function wheels(ctx, x, z) { const V = ctx.volume(x - .9, SIDE + CV, z - .9, x + .9, SIDE + CV + 1.6, z + .9, { keep: 'parts' });
  for (let k = 0; k < 6; k++) for (let a = 0; a < 18; a++) for (let b2 = 0; b2 < 18; b2++) { const d = Math.hypot(a + .5 - 9 + (k & 1) * .6, b2 + .5 - 9); if (d < 8.2) V.box(a, k * 2, b2, a + 1, k * 2 + 2, b2 + 1, d < 4 ? 0xc9ced6 : (k & 1 ? 0x2a2a30 : 0x1f1f26)); } }
function hoist(ctx, x, z) { const V = ctx.volume(x - 1, SIDE + CV, z - 1.4, x + 1, SIDE + CV + 2.6, z + 1.4, { keep: 'parts' });
  V.box(0, 0, 0, 20, 1, 3, C.red); V.box(0, 0, 25, 20, 1, 28, C.red); V.box(9, 0, 0, 11, 24, 3, C.red); for (let k = 0; k < 18; k++) V.box(9, 22, 2 + k, 11, 24, 3 + k, C.red);
  V.box(9, 12, 18, 11, 22, 19, C.ink); V.box(4, 4, 15, 16, 12, 23, 0x6d707a); V.box(6, 12, 16, 14, 14, 22, 0x9aa0a8); }
// WE BUY CARS · ANY CONDITION · NO TITLE NO PROBLEM: hand-painted on plywood nailed to the Foundry St fence, facing the corner
function weBuy(ctx) { const lines = ['WE BUY CARS', 'ANY CONDITION', 'NO TITLE NO PROBLEM'].map((t, k) => hand(t, 20 + k)), W = Math.max(...lines.map(m => m.w)) + 8, H2 = lines.length * 11 + 5, x0 = 69;
  const V = ctx.volume(x0, SIDE + .6, -188.2, x0 + W * CV, SIDE + .6 + H2 * CV, -188, { keep: 'wall-sign' }); V.box(0, 0, 1, W, H2, 2, 0xe8d4b0); for (let x = 0; x < W; x += 20) V.box(x, 0, 1, x + 1, H2, 2, 0xc9b48e);
  lines.forEach((m, k) => vtext(V, m, (W - m.w) >> 1, H2 - 3 - k * 11, 0, [C.red, C.cobalt, C.ink][k], { dir: -1 })); }
