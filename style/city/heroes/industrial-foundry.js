// THE YARDS · ST. ELMO IRON FOUNDRY (block 3,−7) · owner: the supply agent. A brick pour house with a clerestory monitor roof, three
// brick stacks (the Yards' skyline: 24–30 m, banded, the name down the middle one), the pour doors on Foundry St glowing at night,
// and the casting yard: manhole covers and hydrant bodies in stacks, black foundry sand, a slag heap, the melt bins. It faces the chop
// shop across Maple & Foundry. No people: walkers only.
import { Vol, meshVol } from '../vox.js';
import { AIR, TOD, frame } from '../kit.js';
import { blockCtx } from '../engine.js';
import { kitNamed } from '../modules.js';
import { C, PAL, CV, SIDE, REG, shade, hash, px, stencil, serif, impact, vtext, ftext, inkOn, lit, doorAt, cyl, memo, pv, done, logSign, framed, kerb } from '../districts/industrial/lib.js';   // (SPREAD: framed / kerb, today's metres → the spread world)
import { pallet, drums, forklift, cone, postSign, gasCage, trailer } from '../districts/industrial/props.js';
import { floor, fence, plateOn, mound, curveText } from '../districts/industrial/yard.js';
import { sash, rollup, manDoor, hollow, fitName, paintName } from '../districts/industrial/works.js';

const HALL = [101, -214.2, 121, -202.4], STACKS = [[104.2, -216.3, 1.0, 24], [110.6, -216.3, 1.2, 30], [117, -216.3, 1.0, 26]];
export function foundry(bank, b, A) {
  const kit = kitNamed('industrial'), ctx = framed(blockCtx(bank, b, A, kit)); REG.strict = true;   // (authored in today's metres, the block's frame)
  try { build(ctx); ctx.finish(); } finally { REG.strict = false; }
}
function build(ctx) {
  ctx.group('hall'); hall(ctx); for (const t of ['ST. ELMO IRON FOUNDRY', 'EST. 1908', 'STELMO', 'NO ENTRY POUR IN PROGRESS']) logSign(t, ...kerb(111, -208));
  ctx.group('stacks'); for (const [x, z, r, h] of STACKS) stack(ctx, x, z, r, h, x === 110.6 ? 'ST ELMO' : null);
  // the casting yard on Foundry St: concrete, a wall with the gate, covers and hydrants stacked, the sand, the slag, the bins
  ctx.group('yard'); floor(ctx, [100, -201.9, 122, -196.1], 'conc', [], { keep: [[100, -196.1, 122, -196], [100, -201.9, 100.1, -196], [121.9, -201.9, 122, -196]] });
  fence(ctx, [100, -201.9, 122, -196], ['+z', '-x', '+x'], 'wall', '+z', [], { gateAt: 111, gateW: 5 });
  ctx.group('castings'); for (const [x, n] of [[102.4, 5], [104.2, 3]]) for (let k = 0; k < n; k++) ctx.put(cover(), x, -199.4, { y: SIDE + CV + k * CV, reach: .01 });
  for (const x of [118.2, 119.6]) ctx.put(hydrantBody(), x, -200.6, { reach: .3 }); ctx.put(hydrantBody(), 118.9, -199.2, { reach: .3 });
  mound(ctx, 115.8, -199.9, 1.2, 0x2a2826, 77, .5); ctx.put(drums(0x7a3a1e, 4), 107.2, -200.4, { reach: .5 }); ctx.put(forklift(C.hazard), 116.4, -197.4, { rot: 1, reach: .8 });
  ctx.put(postSign(['NO ENTRY', 'POUR IN PROGRESS'], C.red, C.chalk, { post: 13, s: .05 }), 105.9, -197.2, { rot: 0, reach: .6, slide: [1, 0] });
}
// ── the pour house: brick walls 9 m, arched windows in bays, a monitor roof along x with glass on both sides, the pour doors on
// Foundry St (open, the furnace glow behind), the name in cream on the Maple St end and over the doors
function hall(ctx) {
  const [x0, z0, x1, z1] = HALL, Hv = 90, W = C.brick, night = TOD.night, b = ctx.building(x0, z0, x1, z1, { h: Hv * CV, wall: W, trim: C.cream, faces: ['+z', '-x', '+x'], cornice: false, parapet: 5, roof: 0x5c5b62, extra: 50 }); hollow(b.V, b.B, Hv);
  const V = b.V, B = b.B, glow = night ? 0xff8a2a : 0xd9531a;
  for (const side of ['+z', '-x', '+x']) { const f = b.F(side), L = f.len; f.box(-1, Hv - 6, 0, L + 1, Hv - 3, 2, C.cream); for (let a = 1; a < L - 1; a += 4) f.box(a, Hv - 8, 0, a + 2, Hv - 6, 2, C.cream);
    for (let a = 4; a < L - 4; a += 30) f.box(a, 3, 1, a + 3, Hv - 8, 2, shade(W, .88));
    if (side !== '+z') for (let a = 10; a + 16 < L - 6; a += 30) sash(f, a, 44, 16, 28, { arch: true, wall: W, seed: 13 + a, trim: C.cream, litShare: .45 }); }
  // Foundry St: the pour doors (two tall openings on the glow), the name over them
  const f = b.F('+z'), L = f.len;
  for (const a of [58, 104]) { f.box(a - 2, 0, 0, a + 38, 50, 1, C.cream); f.box(a, 1, -14, a + 36, 48, 2, AIR); f.box(a, 1, -15, a + 36, 48, -14, glow, 3); f.box(a + 6, 1, -13, a + 30, 8, -6, 0x3a2a24); f.box(a + 12, 8, -12, a + 24, 14, -7, 0xffb030, 3); doorAt(f, a + 18, '+z'); }
  // (hardening pass: the name in the serif with even letter spacing — the plain raster read "ST. ELM O IR ON F OUN DRY"; evenly set
  // it is ~7 % wider, so it gets 184 of the face's 200 voxels: at 170 the fit dropped to the pixel face). Raised (cast letters, 1 voxel
  // proud): painted flush, the brick piers (1 voxel proud, every 3 m) hid the letters behind them and read as gaps in the name
  const M = fitName('ST. ELMO IRON FOUNDRY', 'serif-even', 184, 16); if (M) paintName(f, M, L >> 1, Hv - 12, C.cream, { raised: true });
  // Maple St end: EST 1908 and the old number
  const E = px('EST. 1908'); ftext(f, E, L >> 1, 59, { c: C.cream }); const g = b.F('-x'); manDoor(g, 20, C.ink, '-x', {});
  // the monitor: a raised glazed box running along x on the roof, its glass lit at night
  const my = Hv, mz0 = B.z0 + 40, mz1 = B.z1 - 40; V.box(B.x0 + 10, my, mz0, B.x1 - 10, my + 22, mz1, W); V.box(B.x0 + 10, my + 22, mz0 - 2, B.x1 - 10, my + 25, mz1 + 2, 0x5c5b62);
  for (const z of [mz0, mz1 - 1]) V.box(B.x0 + 12, my + 6, z, B.x1 - 12, my + 19, z + 1, (x) => (x - B.x0) % 10 === 0 ? W : (night ? 0xffc766 : 0x9fc4e6), night ? 3 : 1);
}
// a brick stack: round, a white band near the top, iron rings, a dark lip; the middle one carries the name down its face
function stack(ctx, x, z, r, h, name) {
  const R = r / CV, n = Math.ceil(R) + 3, hv = Math.round(h / CV), V = ctx.volume(x - n * CV, SIDE, z - n * CV, x + n * CV, SIDE + (hv + 4) * CV, z + n * CV, {});
  cyl(V, n, n, R + 1.2, 0, 16, shade(C.brick, .9)); cyl(V, n, n, R, 16, hv, (xx, y) => (y > hv - 24 && y < hv - 14) ? C.cream : (y % 30 === 0 ? C.steelD : C.brick)); cyl(V, n, n, R + .8, hv, hv + 3, C.steelD); cyl(V, n, n, R - 3, hv - 6, hv + 3, -1);
  if (name) name.replace(/ /g, '').split('').forEach((ch, k) => curveText(V, px(ch), n - 2, hv - 32 - k * 9, 1, C.cream));
  ctx.mass(V, [x - r - .2, z - r - .2, x + r + .2, z + r + .2], { top: SIDE + (hv + 3) * CV, roofY: SIDE + hv * CV });
}
// a manhole cover (cast, 0.8 m, a grid pattern) and a hydrant body fresh from the sand
const cover = () => memo('mhcover', () => { const V = pv(8, 1, 8); cyl(V, 4, 4, 3.9, 0, 1, (x, y, z) => ((x + z) % 2 === 0 ? 0x3a3a42 : 0x4b4f58)); return done(V, 'cover'); });
const hydrantBody = () => memo('hydbody', () => { const V = pv(8, 9, 8); cyl(V, 4, 4, 2.4, 0, 7, 0x3a3a42); cyl(V, 4, 4, 3, 0, 1, 0x3a3a42); cyl(V, 4, 4, 1.4, 7, 9, 0x3a3a42); V.box(0, 4, 3, 8, 6, 5, 0x3a3a42); return done(V, 'hydrant'); });
