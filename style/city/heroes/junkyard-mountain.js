// THE HEAP · THE SCRAP MOUNTAIN (block −2,−7) · owner: the supply agent. An eight-metre mountain of cars, fridges, tyres and pipe; the
// crawler crane on its north-east shoulder swinging a car over it on the magnet; the car crusher by the site with its cubes stacked
// in their old paint; the walls on Dock St and Ivy St with the truck gate and the Heap's one advertisement. The site (−33, −191) is
// the bare ground at this block's south-east corner, inside the ring of white tyres. No people: walkers only.
import { Vol } from '../vox.js';
import { TOD } from '../kit.js';
import { blockCtx } from '../engine.js';
import { kitNamed } from '../modules.js';
import { C, PAL, CV, SIDE, REG, shade, hash, px, stencil, hand, vtext, vtextX, lit, logSign } from '../districts/industrial/lib.js';
import { lightTower, pallet, drums } from '../districts/industrial/props.js';
import { fence } from '../districts/industrial/yard.js';
import { junkMound, cube, carcass, burnBarrel, heapFloor, tyreRing, PANELS, framed, foot, sign, plateOn, margin } from '../districts/junkyard/parts.js';
import { off } from '../districts/frame.js';
import { tires } from '../props.js';

const MT = { x: -47, z: -205.5, r: 8, h: 8 }, CRANE = { x: -35.8, z: -211.4 }, CRUSH = [-58.6, -196.4, -51.2, -192.6];
export function scrapMountain(bank, b, A) {
  const kit = kitNamed('junkyard'), ctx = blockCtx(bank, b, A, kit); REG.strict = true;
  try { const F = framed(ctx); build(F); margin(F); ctx.finish(); } finally { REG.strict = false; }   // (SPREAD: the compound's frame, junkyard/parts.js)
}
function build(ctx) {
  const R = [-60, -218, -32, -192];
  ctx.group('mountain'); junkMound(ctx, MT.x, MT.z, MT.r, MT.h, 4242);
  ctx.group('crane'); crane(ctx); for (const t of ['MAGS', 'CRUSH', 'SCRAP METAL WE PAY CASH']) sign(ctx, t, -46, -205);
  ctx.group('crusher'); crusher(ctx);
  ctx.group('ground'); heapFloor(ctx, R, [[MT.x - MT.r, MT.z - MT.r, MT.x + MT.r, MT.z + MT.r], [CRANE.x - 1.9, CRANE.z - 2.6, CRANE.x + 2.3, CRANE.z + 2.6], CRUSH], [[-60, -218, -32, -217.9], [-60, -218, -59.9, -192]]);
  ctx.group('wall'); fence(ctx, R, ['-z', '-x'], 'panel', '-z', [], { gateAt: -57.2, gateW: 4.6, panels: PANELS }); ad(ctx);
  ctx.group('cubes'); const CUBES = [0xe8232a, 0x2f5bff, 0xffc21a, 0x25b84c, 0xf4f1ea, 0xff4fa3, 0x7a3cff, 0xff7a1a]; let k = 0;
  for (const [x, z, n] of [[-49.4, -194.4, 3], [-47.8, -194.4, 2], [-46.2, -194.4, 3], [-44.6, -194.4, 1], [-49.4, -193.2, 2], [-47.8, -193.2, 3]]) for (let lv = 0; lv < n; lv++) { ctx.put(cube(CUBES[(k * 3 + lv) % CUBES.length]), x, z, { y: SIDE + CV + lv * .9, reach: .01 }); k++; }
  ctx.group('yard'); ctx.put(lightTower(), -33.8, -216.6, { reach: .6 }); ctx.put(tires(), -58.6, -212.4, { reach: .6 }); ctx.put(tires(), -58.6, -210.8, { reach: .6 }); ctx.put(tires(), -58.4, -202.6, { reach: .6 });
  ctx.put(carcass(0x25b84c), -41.2, -195.2, { rot: 1, reach: .8 }); ctx.put(drums(0x7a3a1e, 4), -38.8, -216.2, { reach: .6 }); ctx.put(burnBarrel(), -56.6, -200, { reach: .5 });
  ctx.group('ring'); tyreRing(ctx, 0, 360);
  plateOn(ctx, 'DUMPING $500 FINE', '-x', -60, -207, 1.4, C.chalk, C.red, 'tin');
}
// ── the crawler crane: tracks along z, the body facing −x, a lattice boom at 42° over the mountain, the magnet and a car on it
function crane(ctx) {
  const S = CV, O = [CRANE.x - 14, SIDE + CV, CRANE.z - 2.6], [sx, sz] = off(ctx), V = new Vol(Math.round(16.4 / S), 134, Math.round(5.2 / S), { s: S, org: [O[0] + sx, O[1], O[2] + sz], ground: true }), night = TOD.night;   // (SPREAD: drawn in frame metres, the volume at the frame's place)
  const X = x => Math.round((x - O[0]) / S), Y = y => Math.round((y - O[1]) / S), Z = z => Math.round((z - O[2]) / S), bx = (x0, y0, z0, x1, y1, z1, c, l = 0) => V.box(X(x0), Y(y0), Z(z0), X(x1), Y(y1), Z(z1), c, l);
  const YEL = 0xffc21a, cx = CRANE.x, cz = CRANE.z;
  for (const dz of [-1.5, 1.5]) { bx(cx - 2.3, SIDE + CV, cz + dz - .45, cx + 2.3, SIDE + 1.0, cz + dz + .45, C.ink); for (let x = cx - 2.2; x < cx + 2.2; x += .4) bx(x, SIDE + .9, cz + dz - .45, x + .2, SIDE + 1.05, cz + dz + .45, C.steelD); }
  bx(cx - 1.2, SIDE + 1.0, cz - 1.2, cx + 1.2, SIDE + 1.4, cz + 1.2, C.steelD);
  bx(cx - 1.6, SIDE + 1.4, cz - 1.2, cx + 1.9, SIDE + 3.4, cz + 1.2, YEL); bx(cx + 1.2, SIDE + 1.4, cz - 1.2, cx + 1.9, SIDE + 3.0, cz + 1.2, 0x6d707a);   // the house and the counterweight
  bx(cx - 1.9, SIDE + 1.4, cz + .2, cx - .7, SIDE + 3.4, cz + 1.2, night ? C.lit : 0x9fd8ff, 1); bx(cx - 1.9, SIDE + 3.4, cz + .1, cx - .6, SIDE + 3.6, cz + 1.3, YEL);           // the cab (glass)
  bx(cx + .4, SIDE + 3.4, cz - .6, cx + .8, SIDE + 5.4, cz + .6, C.steelD);                                                                       // the gantry for the pendants
  const M = stencil('MAGS'); vtextX(V, M, Z(cz) - (M.w >> 1), Y(SIDE + 2.7), X(cx + 1.9), C.ink, { dir: 1 });
  // the lattice boom: two chords in z (±0.35), top and bottom lines, lacing between; pivot at the house front
  const px0 = cx - 1.6, py0 = SIDE + 2.4, L = 14.2, ang = 42 * Math.PI / 180, tip = [px0 - Math.cos(ang) * L, py0 + Math.sin(ang) * L];
  const seg = (a, b2, z0, t, c) => { const n = Math.ceil(Math.hypot(a[0] - b2[0], a[1] - b2[1]) / S * 1.3); for (let k = 0; k <= n; k++) { const u = k / n, x = X(a[0] + (b2[0] - a[0]) * u), y = Y(a[1] + (b2[1] - a[1]) * u); V.box(x, y, Z(z0), x + t, y + t, Z(z0) + t, c); } };
  const up = [-Math.sin(ang) * .45, Math.cos(ang) * .45];
  for (const dz of [-.4, .3]) { seg([px0, py0], tip, cz + dz, 2, YEL); seg([px0 + up[0], py0 + up[1]], [tip[0] + up[0], tip[1] + up[1]], cz + dz, 2, YEL);
    for (let k = 0; k < 14; k++) { const u0 = k / 14, u1 = (k + .5) / 14, a = [px0 + (tip[0] - px0) * u0, py0 + (tip[1] - py0) * u0], b2 = [px0 + (tip[0] - px0) * u1 + up[0], py0 + (tip[1] - py0) * u1 + up[1]]; seg(a, b2, cz + dz, 1, YEL); seg(b2, [px0 + (tip[0] - px0) * (u0 + 1 / 14), py0 + (tip[1] - py0) * (u0 + 1 / 14)], cz + dz, 1, YEL); } }
  for (let k = 0; k <= 14; k++) { const u = k / 14, x = px0 + (tip[0] - px0) * u, y = py0 + (tip[1] - py0) * u; bx(x, y, cz - .4, x + .2, y + .2, cz + .5, YEL); }
  seg([cx + .6, SIDE + 5.4], [tip[0] + up[0], tip[1] + up[1]], cz, 1, C.ink);                                                                                  // the pendant
  // the hoist line, the magnet, the car it has; a red light on the tip
  const hx = tip[0] - .1, hy = tip[1] - 1.6; bx(hx, hy + .4, cz, hx + .1, tip[1], cz + .1, C.ink); bx(hx - .7, hy, cz - .7, hx + .8, hy + .4, cz + .8, 0x2a2d38);
  bx(hx - .9, hy - 1.3, cz - 2.1, hx + .9, hy, cz + 2.1, (x, y, z) => (y < Y(hy - .9) || hash(x, y, z) > .8) ? 0xa4502a : 0xe8232a); bx(hx - .8, hy - .9, cz - .8, hx + .8, hy - .3, cz + .8, 0x2a2624);
  bx(tip[0] + up[0] - .1, tip[1] + up[1] + .1, cz - .1, tip[0] + up[0] + .1, tip[1] + up[1] + .3, cz + .1, 0xff2a2a, night ? 3 : 1);
  meshVolInto(ctx, V); foot(ctx, cx - 2.3, cz - 2, cx + 2.3, cz + 2, SIDE + 3.6, SIDE + 3.6);
}
// ── the car crusher: a steel bed, four rams, the platen down on a car flattened to a sandwich; a control box with a lamp
function crusher(ctx) { const [x0, z0, x1, z1] = CRUSH, V = ctx.volume(x0, SIDE + CV, z0, x1, SIDE + CV + 3.4, z1, { keep: 'crusher' }), nx = V.nx, nz = V.nz, Y = 0xffc21a;
  V.box(0, 0, 0, nx, 6, nz, C.steelD); V.box(2, 6, 2, nx - 14, 9, nz - 2, (x, y, z) => (x + z) % 5 === 0 ? 0xa4502a : 0x2f5bff);   // the flattened car
  for (const x of [2, nx - 18]) for (const z of [1, nz - 4]) V.box(x, 6, z, x + 3, 30, z + 3, 0xc9ced6);                                 // rams
  V.box(0, 9, 0, nx - 14, 13, nz, Y); V.box(0, 30, 0, nx - 14, 34, nz, Y);                                                                 // the platen, the crosshead
  V.box(nx - 12, 6, 6, nx - 2, 24, nz - 6, 0x6d707a); V.box(nx - 10, 16, nz - 6, nx - 4, 22, nz - 5, 0x2a2d38); V.box(nx - 8, 24, 10, nx - 5, 27, 14, 0xff2a2a, TOD.night ? 3 : 1);
  const M = stencil('CRUSH'); vtext(V, M, ((nx - 14) >> 1) - (M.w >> 1), 33, nz - 1, C.ink, { dir: 1 });
  foot(ctx, x0, z0, x1, z1, SIDE + 3.5, SIDE + 3.5); }
// the Heap's one advertisement: hand-painted on plywood nailed to the Dock St wall, facing the avenue
function ad(ctx) { const T1 = hand('SCRAP METAL', 5), T2 = hand('WE PAY CASH', 6), W = Math.max(T1.w, T2.w) * 2 + 10, x0 = -46 - W * CV / 2, V = ctx.volume(x0, SIDE + .5, -218.2, x0 + W * CV, SIDE + .5 + 4.1, -218, { keep: 'ad' });
  V.box(0, 0, 1, W, V.ny, 2, 0xe8d4b0); for (let x = 0; x < W; x += 24) V.box(x, 0, 1, x + 1, V.ny, 2, 0xc9b48e);
  vtext(V, T1, (W - T1.w * 2) >> 1, V.ny - 3, 0, 0xe8232a, { sc: 2, dir: -1 }); vtext(V, T2, (W - T2.w * 2) >> 1, V.ny - 5 - T1.h * 2, 0, 0x2f5bff, { sc: 2, dir: -1 }); }
import { meshVol } from '../vox.js';
const meshVolInto = (ctx, V) => meshVol(V, ctx.bank);
