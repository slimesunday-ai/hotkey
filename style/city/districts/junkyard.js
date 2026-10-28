// THE HEAP (junkyard) · the district kit (batch 3) · owner: the supply agent. A walled scrapyard of four blocks round the sim's place
// at (−33, −191): the dig site for scrap, THE FENCE (buys anything at a bad price: rules FENCE) and the SWAP MEET (rules MARKET) all
// meet there. The sim found it turns into a robbery hotspot on its own, so it looks like it: patchwork sheet-metal walls with razor
// wire and a hole cut in them, a burnt-out car, a fire in a barrel, a dog that is somewhere, a camera that doesn't work, an ATM
// someone brought in whole. The site stays bare ground inside a ring of half-sunk tyres on a sprayed line; the stalls and the fence's booth stand
// round it. The scrap mountain with its crusher crane is the hero (heroes/junkyard-mountain.js, block −2,−7).
import { defineKit } from './api.js';
import { BASE, PALETTE, LEXICON } from '../grammar.js';
import { REG } from '../audit.js';
import { Vol, stamp } from '../vox.js';
import { TOD } from '../kit.js';
import { C, PAL, CV, SIDE, air, shade, hash, H, pickH, px, stencil, hand, impact, vtext, vtextX, inkOn, lit, memo, pv, done, cyl, logSign } from './industrial/lib.js';
import { pallet, drums, drum, forklift, cone, postSign, plate, lightTower, portaPotty, gasCage, spool } from './industrial/props.js';
import { floor, fence } from './industrial/yard.js';
import { SITE, inSite, stall, GOODS, fenceBooth, bin, burnBarrel, carcass, cube, towTruck, doghouse, junkMound, officeTrailer, PANELS, heapFloor, ringTyre, tyreRing, framed, foot, sign, plateOn, farBox, margin } from './junkyard/parts.js';
import { remap, shiftOf } from '../../../world/city.js';
import { stopAt, camera } from './frame.js';
import { car, tires, couch, bags } from '../props.js';

// string lights over the swap meet: steel poles, a sagging wire, bulbs in four colours (lit at night)
function lights(ctx, pts, h) { for (let k = 0; k + 1 < pts.length; k++) { const [a, b2] = [pts[k], pts[k + 1]], x0 = Math.min(a[0], b2[0]) - .2, x1 = Math.max(a[0], b2[0]) + .2, z0 = Math.min(a[1], b2[1]) - .2, z1 = Math.max(a[1], b2[1]) + .2;
  const V = ctx.volume(x0, SIDE + CV, z0, x1, SIDE + CV + h + .3, z1, { keep: 'lights' }), X = x => Math.round((x - x0) / CV), Z = z => Math.round((z - z0) / CV), top = Math.round(h / CV), n = Math.ceil(Math.hypot(b2[0] - a[0], b2[1] - a[1]) / CV);
  for (const p of k + 2 === pts.length ? [a, b2] : [a]) V.box(X(p[0]) - 1, 0, Z(p[1]) - 1, X(p[0]) + 1, top + 2, Z(p[1]) + 1, C.steelD);
  for (let q = 0; q <= n; q++) { const u = q / n, x = X(a[0] + (b2[0] - a[0]) * u), z = Z(a[1] + (b2[1] - a[1]) * u), y = top - Math.round(Math.sin(u * Math.PI) * 5); V.set(x, y, z, C.ink);
    if (q % 5 === 2) V.box(x - 1, y - 2, z - 1, x + 1, y, z + 1, [0xffe23a, 0xff4fa3, 0x2de2e6, 0x6cff4a][(q / 5 | 0) % 4], TOD.night ? 3 : 1); } } }
// THE HEAP over the Main St gate: two pipe posts, a crossbar, the letters cut from sheet metal in whatever colour the sheet was
function arch(ctx, x, z0, z1) { const Hh = 64, V = ctx.volume(x - .3, SIDE + CV, z0, x + .3, SIDE + CV + Hh * CV + 2, z1, { keep: 'arch' }), nz = V.nz, cols = [0xe8232a, 0xffc21a, 0x2f5bff, 0xa4502a, 0xf4f1ea, 0x25b84c, 0xff7a1a, 0xe8232a];
  for (const z of [0, nz - 3]) V.box(1, 0, z, 4, Hh, z + 3, C.steelD); V.box(1, Hh - 3, 0, 4, Hh, nz, C.steelD); V.box(1, Hh - 22, 0, 4, Hh - 20, nz, C.steelD);
  const M = impact('THE HEAP', 17); let k = 0, prev = -1; const zS = Math.round((nz - M.w) / 2);
  for (let i = 0; i < M.w; i++) { let any = false; for (let j = 0; j < M.h; j++) if (M.at(i, j)) any = true; if (any && prev < 0) k++; prev = any ? 1 : -1;
    for (let j = 0; j < M.h; j++) if (M.at(i, j)) { const z = zS + M.w - 1 - i, y = Hh - 20 - j - 1; if (z >= 0 && z < nz && y > 0) V.box(0, y, z, 5, y + 1, z + 1, cols[k % cols.length]); } }
  for (let q = 0; q < 3; q++) V.box(2, Hh - 20 - M.h - 1, zS + q * (M.w >> 1), 3, Hh - 20, zS + q * (M.w >> 1) + 1, C.steelD);   // hangers from the crossbar
  for (let z = 2; z < nz - 2; z += 4) V.box(0, Hh - 2, z, 5, Hh - 1, z + 2, TOD.night ? 0xffe9a0 : 0xf4f1ea, TOD.night ? 3 : 1);     // marquee bulbs along the crossbar
  foot(ctx, x - .3, z0, x + .3, z0 + .3, SIDE + Hh * CV, SIDE + Hh * CV); foot(ctx, x - .3, z1 - .3, x + .3, z1, SIDE + Hh * CV, SIDE + Hh * CV); }

// ═════════ (−1, −7) · north-east: the fence's booth by the site, the swap-meet rows, the main gate on Main St under THE HEAP, the bins
function northEast(ctx) {
  const R = [-32, -218, -6, -192];
  ctx.group('booth'); fenceBooth(ctx, -22.4, -199.6, 0); for (const t of ['WE BUY ANYTHING', 'CASH · NO QUESTIONS', 'COPPER 3.10 BRASS 1.85 ALUMINUM .45 CAT CONV $$$', 'THE HEAP', 'RIMS', 'PHONES', 'VINYL', 'TOOLS $5', 'WATCHES', 'RADIOS', 'COPPER', 'BRASS']) sign(ctx, t, -22, -200);
  ctx.group('ground'); heapFloor(ctx, R, [[-28.8, -201, -15.8, -197.4]], [[-32, -218, -6, -217.9], [-6.1, -218, -6, -192]]);
  ctx.group('wall'); fence(ctx, R, ['-z', '+x'], 'panel', '+x', [], { gateAt: -196.4, gateW: 6.4, panels: PANELS }); arch(ctx, -6.3, -199.6, -193.2);
  ctx.group('stalls'); const S = [['RIMS', 0xe8232a, GOODS.rims], ['PHONES', 0x3fa9f5, GOODS.phones], ['VINYL', 0xffc21a, GOODS.vinyl], ['TOOLS $5', 0x25b84c, GOODS.tools], ['WATCHES', 0xff4fa3, GOODS.watches], ['RADIOS', C.chalk, GOODS.radios]];
  [[-28.5, -205.6, 0], [-24.4, -205.6, 0], [-20.3, -205.6, 0], [-16.2, -205.6, 0], [-28.5, -212.6, 2], [-24.4, -212.6, 2]].forEach(([x, z, rot], k) => stall(ctx, x, z, rot, S[k][0], S[k][1], S[k][2], 71 + k));
  // the fence's price list, propped on short legs in front of his booth by the left door (below the CASH band; out of Main St's view)
  ctx.group('yard'); ctx.put(postSign(['COPPER 3.10', 'BRASS 1.85', 'ALUMINUM .45', 'CAT CONV $$$'], C.ink, C.chalk, { post: 6, face: 'hand', s: .05 }), -26.4, -196.7, { rot: 0, reach: .6, slide: [1, 0] });
  lights(ctx, [[-30.3, -207.2], [-14.4, -207.2], [-14.4, -211]], 3); lights(ctx, [[-30.3, -210.9], [-19, -210.9]], 3.2);
  for (const [c, l, f, x] of [[0x2f5bff, 'COPPER', 0xc0633f, -13.5], [0x25b84c, 'BRASS', 0xe7bd4a, -10.5]]) ctx.put(bin(c, l, f), x, -212, { rot: 1, reach: .8 });
  ctx.put(burnBarrel(), -14.3, -199.6, { reach: .5 }); ctx.put(couch(0x7a3cff), -12.6, -201.4, { rot: 3, reach: .6 }); ctx.put(tires(), -9.4, -206.4, { reach: .8 }); ctx.put(tires(), -9.2, -204.6, { reach: .8 });
  ctx.put(lightTower(), -8.6, -216, { reach: .6 }); ctx.put(carcass(0x2f5bff), -17.2, -214.6, { rot: 1, reach: 1 });
  ctx.group('ring'); tyreRing(ctx, 0, 360);
  plateOn(ctx, 'SMILE · CAMERA BROKEN', '+x', -6, -209.5, 1.5, C.chalk, C.ink, 'hand');
}
// ═════════ (−2, −6) · south-west: the office trailer, the dog's house, the burnt car, the lounge by the fire, the hole in the Mill St wall
function southWest(ctx) {
  const R = [-60, -192, -32, -164];
  ctx.group('office'); officeTrailer(ctx, -58.6, -175.4, -45.6, -171, 0xe8e2d0); for (const t of ['OFFICE · KNOCK LOUD', 'BIKES', 'LAMPS', 'DVDS 3/$5', 'SNEAKERS']) sign(ctx, t, -50, -178);
  ctx.group('ground'); heapFloor(ctx, R, [[-58.9, -175.7, -45.3, -169.3]], [[-60, -192, -59.9, -164], [-60, -164.1, -32, -164]]);
  ctx.group('wall'); fence(ctx, R, ['-x', '+z'], 'panel', '+z', [], { gateAt: -47.5, gateW: 2.2, panels: PANELS });
  ctx.group('stalls'); const S = [['BIKES', 0x2f5bff, GOODS.bikes], ['LAMPS', 0xff7a1a, GOODS.lamps], ['DVDS 3/$5', 0x12b3a0, GOODS.dvds], ['SNEAKERS', 0xe8232a, GOODS.sneakers]];
  [[-44.5, -185.4, 1], [-44.5, -181.2, 1], [-38.6, -178.6, 2], [-34.4, -178.6, 2]].forEach(([x, z, rot], k) => stall(ctx, x, z, rot, S[k][0], S[k][1], S[k][2], 91 + k));
  ctx.group('yard'); ctx.put(carcass(0x2a2624, true), -54.2, -185.4, { rot: 0, reach: 1 }); ctx.put(burnBarrel(), -51.4, -181.2, { reach: .5 }); ctx.put(couch(0xe8232a), -53.3, -179.2, { rot: 2, reach: .6 });
  ctx.put(doghouse(), -42.2, -167.4, { rot: 2, reach: .8 }); ctx.put(tires(), -58.6, -189.6, { reach: .8 }); ctx.put(tires(), -57.1, -189.9, { reach: .8 }); ctx.put(bags(3), -49.8, -166.4, { reach: .8 });
  ctx.put(portaPotty(0x25b84c), -58.9, -178.8, { rot: 1, reach: .6 }); ctx.put(car(4), -38.6, -170.5, { rot: 1, reach: 1 });
  ctx.group('ring'); tyreRing(ctx, 0, 360);
  plateOn(ctx, 'BEWARE OF DOG', '+z', -41.5, -164, 1.4, C.hazard, C.ink, 'tin'); plateOn(ctx, 'TRESPASSERS WILL BE SOLD', '-x', -60, -181, 1.5, C.chalk, C.red, 'hand');
}
// ═════════ (−1, −6) · south-east: the truck scale and its house, the tow truck, the bins, cubes from the crusher, the ATM that came in whole
function southEast(ctx) {
  const R = [-32, -192, -6, -164];
  ctx.group('scale'); scale(ctx, -13.2, -181.5); for (const t of ['SCALE', 'TONY', 'ALUMINUM', 'STEEL']) sign(ctx, t, -15, -178);
  ctx.group('ground'); heapFloor(ctx, R, [[-17.8, -187.4, -8.6, -175.6], [-9.6, -181.2, -6.6, -177.4]], [[-6.1, -192, -6, -164], [-32, -164.1, -6, -164]]);
  ctx.group('wall'); fence(ctx, R, ['+x', '+z'], 'panel', '+x', [], { gateAt: -171.2, gateW: 6, panels: PANELS });
  ctx.group('yard'); ctx.put(towTruck(0xffc21a, 'TONY'), -21.4, -170.4, { rot: 1, reach: 1 });
  for (const [c, l, f, x] of [[0xe8232a, 'ALUMINUM', 0xc9ced6, -27.8], [0xa7a9b1, 'STEEL', 0x7a3a1e, -21.4]]) ctx.put(bin(c, l, f), x, -166.9, { rot: 0, reach: .8 });
  const CUBES = [0xe8232a, 0x2f5bff, 0xffc21a, 0x25b84c, 0xf4f1ea, 0xff4fa3]; let k = 0;
  for (const [x, z] of [[-29.4, -181.6], [-29.4, -179.8], [-27.6, -181.6]]) for (let lv = 0; lv < 3 - (k % 2); lv++) { ctx.put(cube(CUBES[(k + lv) % CUBES.length]), x, z, { y: SIDE + CV + lv * .9, reach: .01 }); k++; }
  ctx.put(atm(), -24.6, -186.4, { rot: 1, reach: .6 }); ctx.put(forklift(C.hazard), -25.2, -176.2, { rot: 2, reach: 1 }); ctx.put(spool(0xc0633f), -29.8, -176, { reach: .8 }); ctx.put(gasCage(), -31, -172, { rot: 1, reach: .8 });
  ctx.group('ring'); tyreRing(ctx, 0, 360);
  plateOn(ctx, 'ALL SALES FINAL', '+z', -14.5, -164, 1.4, C.red, C.chalk, 'tin'); plateOn(ctx, 'WEIGH IN HERE', '+x', -6, -184.6, 1.5, C.hazard, C.ink, 'stencil');
}
// the truck scale: a steel deck flush with the yard, hazard edges, and the scale house (a white hut, a window, the dial, SCALE on it)
function scale(ctx, x, z) { const D = ctx.volume(x - 1.6, SIDE, z - 5, x + 1.6, SIDE + CV, z + 5, { walk: true }); D.box(0, 0, 0, D.nx, 1, D.nz, (xx, y, zz) => (xx < 2 || xx >= D.nx - 2 || zz < 2 || zz >= D.nz - 2) ? (((xx + zz) >> 2) & 1 ? C.hazard : C.ink) : ((xx + zz) % 8 === 0 ? C.steelD : C.steel));
  const V = ctx.volume(x + 2.2, SIDE, z - 1.9, x + 4.8, SIDE + 3.2, z + 1.9, { keep: 'scale' }), n = V.nx, m = V.nz, night = TOD.night;
  V.box(0, 0, 0, n, 26, m, C.chalk); V.box(0, 26, 0, n, 28, m, C.red); V.box(0, 11, 8, 1, 22, m - 8, night ? C.lit : PAL.glassLo, night ? 3 : 1); V.box(0, 22, 6, 1, 23, m - 6, C.ink);
  cyl2x(V, 0, 17, 20, 3.2, 0xf7f7f2); const M = px('SCALE'); vtextX(V, M, (m - M.w) >> 1, 25, 0, C.red, { dir: -1 });
  foot(ctx, x + 2.2, z - 1.9, x + 4.8, z + 1.9, SIDE + 2.8, SIDE + 2.8); }
const cyl2x = (V, x, y, z, r, c) => { for (let yy = Math.floor(y - r); yy <= y + r; yy++) for (let zz = Math.floor(z - r); zz <= z + r; zz++) if (Math.hypot(yy + .5 - y, zz + .5 - z) <= r) V.set(x, yy, zz, c); };
// the ATM somebody brought in whole: on its back in the mud, the screen cracked, the cash door jimmied open
const atm = () => memo('atm', () => { const V = pv(18, 8, 9); V.box(0, 0, 0, 18, 7, 9, 0x2f5bff); V.box(2, 7, 1, 8, 8, 8, 0x1b2a55); V.box(3, 7, 2, 7, 8, 7, 0x3fa9f5, 1); V.set(4, 7, 3, C.chalk); V.set(5, 7, 5, C.chalk);
  V.box(10, 7, 2, 16, 8, 7, 0xc9ced6); V.box(10, 4, 8, 16, 7, 9, 0x2a2624); V.box(11, 7, 7, 15, 8, 9, 0x14a83b); return done(V, 'atm'); });

const BLOCKS = { '-1_-7': northEast, '-2_-6': southWest, '-1_-6': southEast };
function far(ctx) { const k = ctx.b.i + '_' + ctx.b.j, B = farBox(ctx);   // (SPREAD: frame metres, junkyard/parts.js)
  if (k === '-1_-7') { B(-27.4, SIDE, -200.2, -21.4, SIDE + 3, -197.8, air(0x25b84c)); for (const x of [-28.5, -24.4, -20.3, -16.2]) B(x - 1.6, SIDE + 2, -206.8, x + 1.6, SIDE + 2.6, -204.4, air(pickH([0xe8232a, 0x3fa9f5, 0xffc21a, 0x25b84c], x | 0, 3)));
    B(-16, SIDE, -214, -9, SIDE + 1.7, -210, air(0x2f5bff)); }
  if (k === '-2_-6') { B(-58.6, SIDE, -175.4, -45.6, SIDE + 3.2, -171, air(0xe8e2d0)); B(-46, SIDE + 2, -187, -43, SIDE + 2.6, -180, air(0xff7a1a)); }
  if (k === '-1_-6') { B(-11, SIDE, -183.4, -8.4, SIDE + 3, -179.6, air(C.chalk)); B(-23.5, SIDE, -171.6, -19.3, SIDE + 3, -165, air(0xffc21a)); B(-31, SIDE, -168, -18, SIDE + 1.7, -165.8, air(0xe8232a)); }
}

const J = shiftOf(-2, -7);   // (SPREAD: the compound's shift)
export default defineKit({
  district: 'junkyard', name: 'The Heap', owner: 'the supply agent (batch 3)', status: 'built',
  role: 'The scrapyard at the sim\'s place (−33, −191): the dig site for scrap, THE FENCE (buys anything at a bad price, less for every unit it already holds: rules FENCE) and the SWAP MEET (rules MARKET), all at one point. The sim found it becomes a robbery hotspot on its own. No street market of its own (the walkers use CROWD).',
  built: 'all',
  grammar: { ...BASE, life: [0, 0], walkway: .6 },
  palette: { ...PALETTE, neutral: { ...PALETTE.neutral, share: .34 } },
  lexicon: LEXICON,
  heroes: [{ id: 'scrap-mountain', block: [-2, -7], module: 'heroes/junkyard-mountain.js', fn: 'scrapMountain' }],
  build(ctx) { const f = BLOCKS[ctx.i + '_' + ctx.j]; if (f) { const F = framed(ctx); f(F); margin(F); } },   // (SPREAD: the compound's frame; its margin)
  far,
  hooks: { sites: { heap: (([x, z]) => ({ x, z, r: 6.5 }))(remap(-33, -191)) } },
  // (SPREAD: the stop keeps to the Main St kerb and moves with the compound, so it stays at the gate; the safehouse through remap; the
  // cameras frame the compound (its shift J); districts/frame.js)
  transit: [stopAt({ id: 'bus-heap-gate', kind: 'bus', name: 'MAIN ST', x: -4.5, z: -186.5, rot: 1 })],
  safehouses: [{ id: 'safe-heap-trailer', name: 'the office trailer', ...(([x, z]) => ({ x, z }))(remap(-52, -173)), note: 'the Heap\'s office; knock loud' }],
  peds: { density: 1 },
  cameras: {
    overhead: camera({ pos: [-10, 92, -120], tgt: [-33, 0, -191], fov: 44, sh: [-33, -191, 90] }, J),
    street: [camera({ name: 'main-st-gate', pos: [2.6, 2.9, -176], tgt: [0.6, 3.8, -202], fov: 54, sh: [-4, -190, 40] }, J), { name: 'mill-st', rule: 'street', block: [-2, -6], side: '+z' }],
    // the booth right of centre, the magnet crane and the mountain left (the docks gantry, 140 m off, stays out of frame)
    landmark: camera({ name: 'the-fence', pos: [-33, 2.4, -181], tgt: [-29.6, 3.4, -205.8], fov: 54, sh: [-31, -197, 24] }, J),
    night: camera({ name: 'swap-meet-night', pos: [-33.5, 3.2, -181.2], tgt: [-29.8, 3.6, -206], fov: 56, sh: [-30, -198, 28] }, J),
  },
});
