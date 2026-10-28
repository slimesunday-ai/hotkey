// LOW TIDE DOCKS (docks) · the district kit (batch 3) · owner: the supply agent. The working waterfront on the bay: the dig site for goo
// and cloth at (80, −240) and the DOCK SHIFT (the sim's survival floor: paid work while broke) in the shift office's yard (hero),
// the gantry crane over a moored feeder ship (hero), the fish market where Main St reaches the water, the longshoremen's hall and
// the marine supply on Dock St, the dealing corner at the end of Linden St (the sim's Linden & Harbor Rd, (64, −256)), the tug yard.
// Street demand 1.5 by day, 4.5 at night. Every block has its quay edge; the streets end at guard rails over the water.
import { defineKit } from './api.js';
import { BASE, PALETTE, LEXICON } from '../grammar.js';
import { REG } from '../audit.js';
import { stamp } from '../vox.js';
import { AIR, TOD } from '../kit.js';
import { C, PAL, CV, SIDE, air, shade, hash, H, pickH, px, stencil, hand, impact, serif, vtext, vtextX, ftext, inkOn, lit, doorAt, fw, cyl, logSign } from './industrial/lib.js';
import { DECKS } from './industrial/names.js';
import { container, pallet, drums, forklift, boxTruck, trailer, bollard, cone, barrier, crates, fishCrates, iceChest, traps, handTruck, postSign, plate, lightTower, portaPotty } from './industrial/props.js';
import { front, sash, manDoor, rollup, fitName, paintName, nameW, nameH, hollow } from './industrial/works.js';
import { floor, fence } from './industrial/yard.js';
import { quay, pier, steps, tugboat, fishingBoat, streetEnd, QUAY_Z, seaOff } from './docks/parts.js';
import { framed, sign, plateOn, farBox } from './junkyard/parts.js';   // (SPREAD: each block's frame, junkyard/parts.js)
import { atB, off, kerbX, stopAt, camera } from './frame.js';
import { remap, shiftOf, SPREAD } from '../../../world/city.js';

export const LINES = DECKS.lines.slice(0, 14);   // the docks' shipping lines (the Yards draw from the rest)
const lineCol = n => (LINES.find(l => l[0] === n) || [0, 0, C.grey]);
export const CORNER = { x: 64, z: -256, zone: [57.6, -256, 62, -249.6] };   // Linden St & Harbor Rd: the crew's quadrant (the hotspot is drawn at 59.6, −251.7)
// SPREAD · the quadrant in the spread world: its lot part moves with block (1, −8), its sidewalk part keeps to Linden St's kerb
const zoneAt = ([sx, sz]) => [CORNER.zone[0] + sx, CORNER.zone[1] + sz, kerbX(CORNER.zone[2]), CORNER.zone[3] + sz];

// ── a container stack: a row of n stacks along x from x0 at z, h high, lines cycling; everything through ctx.put (strict)
export function stacks(ctx, x0, z, list, o = {}) { let x = x0; for (const [line, len, hgt] of list) { const [name, mk, col] = lineCol(line), bk = container(name, col, mk, len), L = len === 40 ? 12.2 : 6.1, cx = x + L / 2;
  for (let lv = 0; lv < hgt; lv++) if (!ctx.put(bk, cx, z, { rot: 0, y: (o.y ?? SIDE + CV) + lv * 2.6, reach: .01 })) break; x += L + (o.gap ?? .4); } }

// ═════════ (0, −8) · the fish market where Main St meets the water, the bar on the corner, a pier and a boat behind
function fishMarket(ctx) {
  ctx.group('bar'); front(ctx, { kind: 'front', x0: 6, z0: -238.5, x1: 12.5, z1: -230, faces: ['-x', '+z'], main: '+z', st: 2, wall: C.cobalt, trim: C.chalk, name: 'THE BILGE', sign: C.ink, neon: true, awning: null, seed: 811, display: 'bar', door2: C.ink, roofCol: 0xdcd8cf });
  ctx.group('market'); market(ctx, 13, -242, 28, -230); for (const t of ['LOW TIDE', 'FISH MARKET', "SAL'S", "NG'S", 'BIG ED', 'PORGY 3.99', 'MISS PORGY', 'SALT & SPRAY SEAFOOD']) sign(ctx, t, 20, -236);
  // behind: the ice house, crates, traps, a reefer truck at the market's back
  ctx.group('apron'); floor(ctx, [6, -255.4, 28, -242.3], 'conc', [[6, -238.8, 12.8, -230]], { keep: [[19.4, -255.5, 25.6, -254.7]] });
  ctx.put(boxTruck(C.white, 'SALT & SPRAY SEAFOOD'), 9.5, -246.5, { rot: 0, reach: 1.5 });
  ctx.put(iceChest(), 21.5, -243.4, { reach: 1 }); ctx.put(traps(), 16.2, -244.2, { reach: 1 }); ctx.put(fishCrates(1), 26, -244.2, { reach: 1 }); ctx.put(pallet('fish', 2), 24, -249, { reach: 1.5 });
  ctx.put(handTruck(), 18.5, -249.5, { reach: 1 }); ctx.put(traps(), 14.5, -252.6, { rot: 1, reach: 1 });
  // the quay, a pier to the boat, the Main St end rail
  ctx.group('quay'); quay(ctx, 4, 30, { gaps: [[19.5, 25.5]] }); ctx.group('pier'); const p = pier(ctx, 19.5, -266, 25.5, QUAY_Z, 1.0); steps(ctx, 19.5, 25.5, QUAY_Z, 1.0);
  fishingBoat(ctx, 17.1, -262.3, 1, { col: C.teal, stripe: C.hazard, roof: C.red, name: 'MISS PORGY' });
  ctx.put(fishCrates(2), 22.5, -263.5, { y: p.top, reach: .5 });
  ctx.group('street-end'); streetEnd(ctx, -4, 4); streetEnd(ctx, 30, 34);
}
// the market shed: a steel roof on columns over three rows of stalls (ice beds, fish, scales, price boards), open to Dock St, the big
// sign on the fascia. One structure (the stalls are its voxels), so nothing in it is a loose prop.
function market(ctx, x0, z0, x1, z1) {
  const nx = Math.round((x1 - x0) / CV), nz = Math.round((z1 - z0) / CV), Hr = 46, V = ctx.volume(x0, SIDE, z0, x1, SIDE + (Hr + 52) * CV, z1, { keep: 'market' }), night = TOD.night;
  const ROOF = 0xc9ced6, RED = 0xe8232a;
  for (let x = 0; x < nx; x += 38) for (const z of [2, nz - 4]) V.box(Math.min(x, nx - 3), 0, z, Math.min(x, nx - 3) + 3, Hr, z + 3, C.steelD);            // columns
  V.box(nx - 3, 0, 2, nx, Hr, 5, C.steelD); V.box(nx - 3, 0, nz - 4, nx, Hr, nz - 1, C.steelD);
  for (let x = 0; x < nx; x++) for (let z = 0; z < nz; z++) { const t = Math.abs(z + .5 - nz / 2) / (nz / 2), y = Hr + Math.round((1 - t) * 7); V.box(x, y, z, x + 1, y + 2, z + 1, (x % 6 === 0) ? shade(ROOF, .9) : ROOF); }   // a low gable roof
  V.box(0, Hr - 2, 0, nx, Hr, 2, C.steelD); V.box(0, Hr - 2, nz - 2, nx, Hr, nz, C.steelD);
  // the sign on a fascia board over Dock St: LOW TIDE in red Impact on white, FISH MARKET under it in ink; lit at night
  const M = px('LOW TIDE'), sc1 = M.w * 3 <= nx - 10 ? 3 : 2, M2 = px('FISH MARKET'), sc2 = M2.w * 2 <= nx - 10 ? 2 : 1, hh = 7 * sc1 + 7 * sc2 + 11, bw = Math.min(nx - 2, Math.max(M.w * sc1, M2.w * sc2) + 8), bx = (nx - bw) >> 1, by = Hr + 3;
  V.box(bx, by, nz - 2, bx + bw, by + hh, nz - 1, C.chalk, night ? 3 : 0); V.box(bx, by, nz - 1, bx + bw, by + 2, nz, RED); V.box(bx, by + hh - 2, nz - 1, bx + bw, by + hh, nz, RED);
  vtext(V, M, (nx - M.w * sc1) >> 1, by + hh - 4, nz - 1, RED, { sc: sc1, l: night ? 3 : 0 }); vtext(V, M2, (nx - M2.w * sc2) >> 1, by + 3 + 7 * sc2, nz - 1, C.ink, { sc: sc2 });
  for (const x of [bx + 6, bx + bw - 9]) V.box(x, Hr, nz - 3, x + 3, by, nz - 1, C.steelD);
  // stalls: three counters across, each an ice bed with fish, a scale on a post, a crate stack, its own name board (hand-painted)
  const STALLS = [['SAL\'S', 0x2f5bff], ['NG\'S', 0x25b84c], ['BIG ED', 0xff7a1a]], FISH = [0xc9d3dc, 0xe7a0a8, 0x9fb3c8, 0xf2c14e, 0xb7c4cf];
  STALLS.forEach(([name, col], k) => { const sx0 = 4 + k * Math.floor((nx - 8) / 3), sx1 = sx0 + Math.floor((nx - 8) / 3) - 6, sz0 = 26, sz1 = nz - 26;
    V.box(sx0, 0, sz1 - 12, sx1, 9, sz1, col); V.box(sx0, 9, sz1 - 12, sx1, 10, sz1, 0xe8f6ff);                                                   // the counter + the ice bed
    for (let x = sx0 + 1; x < sx1 - 1; x += 2) for (let z = sz1 - 11; z < sz1 - 1; z += 3) if (hash(x, z, k) > .35) V.box(x, 10, z, x + 2, 11, z + 1, FISH[(hash(x, z, k + 3) * FISH.length) | 0]);
    V.box(sx0 + 2, 0, sz0, sx1 - 2, 6, sz0 + 8, 0x2f5bff); V.box(sx0 + 3, 6, sz0 + 1, sx1 - 8, 12, sz0 + 7, 0xe8e2d0);                                // tubs and crates behind the counter
    V.box(sx1 - 3, 10, sz1 - 6, sx1 - 2, 24, sz1 - 5, C.steelD); V.box(sx1 - 5, 18, sz1 - 8, sx1, 22, sz1 - 3, C.steelL);                          // the scale on its post
    const N = hand(name, k + 3), sw = N.w + 6; if (sw < sx1 - sx0) { const ax = sx0 + ((sx1 - sx0 - sw) >> 1); V.box(ax, 30, sz1 - 2, ax + sw, 30 + N.h + 4, sz1 - 1, C.chalk); vtext(V, N, ax + 3, 30 + N.h + 1, sz1 - 1, col, { dir: 1 });
      const roofAt = Hr + Math.round((1 - Math.abs(sz1 - 2 + .5 - nz / 2) / (nz / 2)) * 7); V.box(ax + 2, 30 + N.h + 4, sz1 - 2, ax + 3, roofAt, sz1 - 1, C.steelD); V.box(ax + sw - 3, 30 + N.h + 4, sz1 - 2, ax + sw - 2, roofAt, sz1 - 1, C.steelD); } });
  // the price board at the Kent St end: chalk on black, hand lettered
  const P = ['PORGY 3.99', 'BLUES 2.49', 'CLAMS 50¢', 'SQUID 4.25'].map(t => hand(t, t.length)), pw = Math.max(...P.map(m => m.w)) + 6, ph = P.length * 11 + 4;
  V.box(nx - 2, 8, 8, nx - 1, 8 + ph, 8 + pw, C.ink); V.box(nx - 2, 0, 8, nx - 1, 8, 10, C.steelD); V.box(nx - 2, 0, 6 + pw, nx - 1, 8, 8 + pw, C.steelD); P.forEach((m, n) => vtextX(V, m, 11, 8 + ph - 3 - n * 11, nx - 1, C.chalk, { dir: 1 }));
  // under the roof at night: tube lights
  for (let x = 6; x < nx - 6; x += 24) { V.box(x, Hr - 3, nz >> 1, x + 12, Hr - 2, (nz >> 1) + 1, night ? 0xfff6d8 : 0xe6e6ea, night ? 3 : 0); V.box(x + 5, Hr - 2, nz >> 1, x + 6, Hr + 8, (nz >> 1) + 1, C.steelD); }   // tube lights on rods from the ridge
}

// ═════════ (1, −8) · the longshoremen's hall and the marine supply on Dock St, container rows on the quay, the corner at Linden St
function unionHall(ctx) {
  ctx.group('hall'); const b = ctx.building(36, -241, 47, -230, { h: 7.2, wall: C.brick, trim: C.cream, faces: ['-x', '+z'], cornice: false, parapet: 6, roof: 0xb8b5ae }); hollow(b.V, b.B, 72);
  { const f = b.F('+z'), L = f.len;
    f.box(-1, 64, 0, L + 1, 67, 2, C.cream); f.box(-1, 72 + 3, 0, L + 1, 72 + 6, 2, C.cream);
    for (const a of [8, L - 22]) { sash(f, a, 36, 14, 22, { arch: true, wall: C.brick, seed: 31, trim: C.cream }); sash(f, a, 8, 14, 16, { wall: C.brick, seed: 33, trim: C.cream }); }
    const d = (L >> 1) - 10; f.box(d - 2, 0, 0, d + 22, 30, 1, C.cream); f.box(d, 1, -3, d + 20, 27, 2, AIR); f.box(d, 1, -3, d + 20, 27, -2, (a, y) => (a === d + 10) ? C.ink : y > 22 ? 0xffe3a0 : 0x0b5a3a, 1); doorAt(f, d + 10, '+z');
    for (const a of [d - 5, d + 23]) { f.box(a, 20, 0, a + 2, 26, 2, C.iron); f.box(a - 1, 26, 1, a + 3, 30, 3, 0xffe9b0, TOD.night ? 3 : 1); }
    const M1 = fitName('DOCKWORKERS HALL', 'serif', L - 14, 13).M, M2 = px('LOCAL 117'), top = 62, bot = top - M1.h - 12; f.box((L >> 1) - (Math.max(M1.w, M2.w) >> 1) - 4, bot, 0, (L >> 1) + (Math.max(M1.w, M2.w) >> 1) + 4, top + 1, 1, C.ink);
    ftext(f, M1, L >> 1, top - 1, { c: PAL.gold, d0: 1, d1: 2, l: TOD.night ? 3 : 0 }); ftext(f, M2, L >> 1, top - M1.h - 3, { c: C.chalk, d0: 1, d1: 2 });
    // the shape-up board by the door: where the day's gangs are called
    const S = hand('SHAPE-UP 6AM', 7); f.box(d + 26, 12, 0, d + 26 + S.w + 6, 12 + S.h + 6, 2, C.woodD); ftext(f, S, d + 29, 12 + S.h + 3, { c: C.chalk, d0: 2, d1: 3, align: 0 }); }
  { const f = b.F('-x'), L = f.len; for (let a = 10; a + 14 < L - 6; a += 28) { sash(f, a, 36, 14, 22, { arch: true, wall: C.brick, seed: 35, trim: C.cream }); sash(f, a, 8, 14, 16, { wall: C.brick, seed: 37, trim: C.cream }); } f.box(-1, 64, 0, L + 1, 67, 2, C.cream); }
  for (const t of ['DOCKWORKERS HALL', 'LOCAL 117', 'SHAPE-UP 6AM']) sign(ctx, t, 41, -232);
  ctx.group('supply'); front(ctx, { kind: 'front', x0: 47.5, z0: -238.5, x1: 60, z1: -230, faces: ['+z', '+x'], main: '+z', st: 1, wall: C.yellow, trim: C.ink, name: 'HARBOR MARINE SUPPLY', sign: C.cobalt, neon: true, awning: C.cobalt, seed: 823, display: 'marine', roofCol: 0xdcd8cf, band: C.ink });
  // the quay: concrete apron, two container rows, a reach stacker, the corner left clear for the crew (the sim's hotspot)
  ctx.group('apron'); { const [x0, z0, x1, z1] = zoneAt(off(ctx)); REG.keep([x0, SIDE, z0, x1, SIDE + 2.6, z1], 'corner-zone'); }
  floor(ctx, [36, -255.4, 60, -241.3], 'conc', [[35.7, -241.3, 47.3, -230], [47.2, -238.8, 60.3, -230]], { keep: [CORNER.zone] });
  stacks(ctx, 37, -251.4, [[LINES[0][0], 40, 3], [LINES[1][0], 20, 2]]); stacks(ctx, 37, -246.6, [[LINES[2][0], 40, 2], [LINES[3][0], 20, 1]]);
  ctx.put(forklift(C.hazard), 58.5, -244.5, { rot: 3, reach: 1 }); ctx.put(cone(), 57.2, -248.8, { reach: .5 }); ctx.put(cone(), 55.8, -248.9, { reach: .5 });
  ctx.group('quay'); quay(ctx, 34, 62, { skip: [[57, 62]] }); ctx.group('street-end'); streetEnd(ctx, 62, 66);
  plateOn(ctx, 'NO SWIMMING', '+x', kerbX(61.95) - off(ctx)[0], -252.5, 1.2, C.chalk, C.red, 'tin');   // (SPREAD: at Linden St's kerb)
}
// ═════════ (4, −8) · the tug yard: the company office, its pier and tug, a boat hauled out on blocks, the marine fuel dock, containers
function tugYard(ctx) {
  ctx.group('office'); front(ctx, { kind: 'front', x0: 134, z0: -240, x1: 143, z1: -230, faces: ['-x', '+z'], main: '+z', st: 2, wall: C.chalk, trim: C.red, name: 'RIZZO TUG & BARGE', sign: C.red, neon: false, awning: null, seed: 841, roofCol: 0xb8b5ae, band: C.ink });
  ctx.group('yard'); floor(ctx, [134, -255.4, 156, -230.1], 'asph', [[133.7, -240.3, 143.3, -230]], { keep: [[143.9, -255.5, 148.1, -254.7]] });
  // the hauled-out boat on timber blocking, a ladder, paint cans: a boat being scraped
  hauled(ctx, 149, -247.5); for (const t of ['RIZZO III', 'MARINE FUEL DIESEL · GAS']) sign(ctx, t, 146, -250);
  stacks(ctx, 143.6, -234.2, [[LINES[4][0], 20, 2]]); stacks(ctx, 150, -234.2, [[LINES[5][0], 20, 1]]);
  ctx.put(drums(C.red, 4), 137, -243, { reach: 1 }); ctx.put(pallet('crates', 1), 139.2, -243.2, { reach: 1 }); ctx.put(lightTower(), 154.2, -241.5, { reach: 1 });
  ctx.group('quay'); quay(ctx, 132, 158, { gaps: [[144, 148]], skip: [[142, 150]], piers: [[142, 150]] }); ctx.group('pier'); const p = pier(ctx, 142, -268, 150, QUAY_Z, 1.0); steps(ctx, 144, 148, QUAY_Z, 1.0);
  tugboat(ctx, 153.1, -263.9, 3, { col: C.ink, stripe: C.red, stack: C.red, name: 'RIZZO III' });
  // the fuel dock: a pump on the pier head
  ctx.put(postSign(['MARINE FUEL', 'DIESEL · GAS'], C.red, C.chalk, { post: 10 }), 146, -266.8, { y: p.top, rot: 2, reach: .5 });
  ctx.group('street-end'); streetEnd(ctx, 158, 162);
}
// a small boat hauled out on timber blocking for its bottom to be scraped (its own structure)
function hauled(ctx, x, z) { const V = ctx.volume(x - 5, SIDE + CV, z - 2.2, x + 5, SIDE + 4.3, z + 2.2, {}), nx = V.nx, nz = V.nz;
  for (const bx of [16, 50, 80]) V.box(bx, 0, 14, bx + 6, 8, 30, C.woodD);                                                   // blocking
  for (let a = 4; a < nx - 4; a++) { const t = (a - 4) / (nx - 8), half = 17 * (1 - Math.max(0, t - .7) ** 2 * 9); for (let z2 = 0; z2 < nz; z2++) { const dz = Math.abs(z2 + .5 - nz / 2); if (dz > half) continue;
    const y0 = 8 + Math.round((dz / 17) ** 2 * 6), y1 = 26; for (let y = y0; y < y1; y++) { const edge = dz > half - 1.5 || y === y0; if (!edge && y < y1 - 1) continue; V.set(a, y, z2, y < 14 ? 0x8a2a22 : y > y1 - 3 ? C.chalk : 0x3fa9f5); } } }
  for (let y = 0; y < 27; y++) { V.set(nx - 8, y, 4, C.steelL); V.set(nx - 8, y, 7, C.steelL); if (y % 3 === 0) V.box(nx - 8, y, 4, nx - 7, y + 1, 8, C.steelL); }   // a ladder
  V.box(30, 26, 12, 70, 34, 32, C.chalk); V.box(32, 30, 12, 68, 33, 32, TOD.night ? 0xffe3a0 : PAL.glassLo, TOD.night ? 3 : 1);                               // the cuddy cabin
  REG.keep(atB(ctx, [x - 5, SIDE, z - 2.2, x + 5, SIDE + 4.2, z + 2.2]), 'boat'); }

const BLOCKS = { '0_-8': fishMarket, '1_-8': unionHall, '4_-8': tugYard };
function far(ctx) { const k = ctx.b.i + '_' + ctx.b.j, B = farBox(ctx), dz = seaOff(ctx);   // (SPREAD: frame metres; the tug keeps to the water's edge)
  if (k === '0_-8') { B(6, SIDE, -238.5, 12.5, SIDE + 7.2, -230, air(C.cobalt)); B(13, SIDE + 4.6, -242, 28, SIDE + 5.2, -230, 0xc9ced6); B(14, SIDE, -241, 27, SIDE + 1, -231, air(0x2f5bff)); B(19.5, 0, -266, 25.5, 1, -256.5, C.woodL); }
  if (k === '1_-8') { B(36, SIDE, -241, 47, SIDE + 7.8, -230, air(C.brick)); B(47.5, SIDE, -238.5, 60, SIDE + 4.2, -230, air(C.yellow));
    for (const [n, x0, z, len, h] of [[0, 37, -251.4, 12.2, 3], [1, 49.6, -251.4, 6.1, 2], [2, 37, -246.6, 12.2, 2], [3, 49.6, -246.6, 6.1, 1]]) B(x0, SIDE, z - 1.2, x0 + len, SIDE + h * 2.6, z + 1.2, air(LINES[n][2], .2)); }
  if (k === '4_-8') { B(134, SIDE, -240, 143, SIDE + 7.2, -230, air(C.chalk)); B(142, 0, -268, 150, 1, -256.5, C.woodL); B(143.6, SIDE, -235.4, 149.7, SIDE + 5.2, -233, air(LINES[4][2], .2)); B(150.5, 0, -270.8 + dz, 155.7, 3.2, -257 + dz, C.ink); }
}

export default defineKit({
  district: 'docks', name: 'Low Tide Docks', owner: 'the supply agent (batch 3)', status: 'built',
  role: 'The working waterfront: the dig site for goo and cloth at (80, −240) and the dock shift (rules WORK: paid work while broke) in the shift office yard; the gantry crane over a moored feeder ship; the fish market at the foot of Main St, the longshoremen\'s hall, the marine supply, the tug yard; the dealing corner at the end of Linden St (Linden & Harbor Rd, (64, −256)). Street demand 1.5 by day, 4.5 at night.',
  built: 'all',
  // the bay in front of the quay (sea blocks, never built: they aren't urban) is the docks' own water — the piers, the moored feeder
  // and the boats stand in it; adopting it tells the skyline (skyline.js landmarks) not to stand a vista tower there
  adopt: [[0, -9], [1, -9], [2, -9], [3, -9], [4, -9]],
  grammar: { ...BASE, life: [0, 0], walkway: .6 },
  palette: { ...PALETTE, neutral: { ...PALETTE.neutral, share: .34 } },
  lexicon: LEXICON,
  heroes: [
    { id: 'shift-office', block: [2, -8], module: 'heroes/docks-shift.js', fn: 'shiftOffice', place: 'docks' },
    { id: 'gantry', block: [3, -8], module: 'heroes/docks-crane.js', fn: 'gantry' },
  ],
  build(ctx) { const f = BLOCKS[ctx.i + '_' + ctx.j]; if (f) f(framed(ctx)); },   // (SPREAD: the block's frame)
  far,
  hooks: { sites: { docks: (([x, z]) => ({ x, z, r: 6.5 }))(remap(80, -240)) }, corners: { 'corner-2_-8': zoneAt(shiftOf(1, -8)) } },
  // (SPREAD: the stop keeps to Dock St's kerb, the safehouse through remap, the cameras frame their block (the two on Dock St stand
  // where they stood); districts/frame.js)
  // BUS RETIME (2026-10-09): at a spread the 4 serves Dock St's SOUTH kerb (the lane past Linden St won the export's choice when the
  // street got wider), so its shelter stands there — on the block across the street, declared by its kit (districts/industrial.js)
  transit: SPREAD ? [] : [stopAt({ id: 'bus-dock-shift', kind: 'bus', name: 'DOCK ST', x: 71.5, z: -228.5, rot: 0 })],
  safehouses: [{ id: 'safe-reefer-box', name: 'the dead reefer box', ...(([x, z]) => ({ x, z }))(remap(113, -234)), note: 'a container in the second row at the crane; the door that isn\'t locked' }],
  peds: { density: 1 },
  cameras: {
    overhead: camera({ pos: [80, 100, -168], tgt: [80, 0, -252], fov: 44, sh: [80, -248, 100] }, shiftOf(2, -8)),
    street: [camera({ name: 'dock-st', pos: [47, 2.9, -224.5], tgt: [73, 3.8, -230.5], fov: 54, sh: [66, -238, 40] }, shiftOf(2, -8), 'place'), { name: 'linden-st', rule: 'street', block: [1, -8], side: '+x' }],
    landmark: camera({ name: 'time-clock', pos: [82.4, 2.0, -233.6], tgt: [71.6, 2.0, -245.2], fov: 50, sh: [76, -242, 18] }, shiftOf(2, -8)),
    night: camera({ name: 'dock-st-night', pos: [41.5, 2.9, -224.2], tgt: [15.5, 4.2, -230.6], fov: 54, sh: [26, -236, 40] }, shiftOf(0, -8), 'place'),
  },
});
