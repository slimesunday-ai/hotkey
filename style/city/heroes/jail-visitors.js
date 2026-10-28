// IRON ISLAND · hero · THE VISITORS' ENTRANCE (block 7,−10) · owner: the water-side agent (batch 5).
// The public face of the jail, on the island road where the bridge lands: a cobalt two-storey block built into the wall, IRON ISLAND
// CORRECTIONAL in steel letters on its cream band, a canopy over the glass doors lettered VISITORS, and the BAIL window — thick glass,
// a steel tray, a speaker grille, BAIL in red neon over it (25 halves your time, cash only). A queue at the window on its rail (the
// bondsman on the phone, a mother with the bag she brought, a man counting cash), two benches of people waiting for visiting hours, the
// visiting-hours board, a payphone on the wall, planters, the flag, a camera pole. The IRON ISLAND bus stop is at the curb (the kit).
import { kitNow } from '../gen.js';
import { heroBlock } from '../districts/jail/build.js';
import { C, CV, SIDE, TOD, REG, H, lit, shade, wv, later, letters, wboard, wletters, panel, px, mini, disp, logSign, inBlock, person, bench, planter, flagpole, camPole, bin, plate, pv, prop, memo, put as putAt, keep, doorAt } from '../districts/jail/lib.js';
import { VISIT, FORE } from '../districts/jail/plan.js';

export function visitors(bank, b, A) { heroBlock(bank, b, A, kitNow(), content); }
// looks: seeds picked so each reads (the bondsman in black, the rest their own clothes)
const SEEDS = { bond: 811, mom: 812, cash: 813, sit1: 814, sit2: 815, sit3: 816, kid: 817, co: 818 };

function content(ctx) {
  building(ctx); forecourt(ctx);
}
// ── the building (0.1 m): cobalt walls, cream trim, a stone base; upper windows; the parapet band with the name
function building(ctx) {
  ctx.group('visitors');
  const [x0, z0, x1, z1] = VISIT.r, h = VISIT.h, N = TOD.night, W = wv(ctx, [x0 - .2, z0, x1 + .2, z1 + 1.8], SIDE, SIDE + h + 1.4, { s: CV }); if (!W) return; const V = W.V, B = W.box;
  const top = SIDE + h, gf = SIDE + 3.8;
  B(x0, SIDE, z0, x1, top, z1, C.cobalt); B(x0, SIDE, z0, x1, SIDE + .5, z1, C.concD);                                             // the mass, a stone base
  B(x0 + .1, top - .1, z0 + .1, x1 - .1, top, z1 - .1, 0x8b8e97); B(x0, top, z0, x1, top + .7, z1, C.cream); B(x0 + .2, top, z0 + .2, x1 - .2, top + .7, z1 - .2, undefined);
  V.clear(W.X(x0 + .2), W.Y(top), W.Z(z0 + .2), W.X(x1 - .2), W.Y(top + .7), W.Z(z1 - .2));                                           // the parapet ring
  B(x0, top - 1.1, z1 - .1, x1, top - .1, z1 + .1, C.cream);                                                                         // the name band on the front
  wletters(W, '+z', x0 + .4, x1 - .4, top - .25, z1 + .1, px('IRON ISLAND CORRECTIONAL'), C.steelD);
  logSign(ctx, 'IRON ISLAND CORRECTIONAL', (x0 + x1) / 2, z1, 96);
  B(x0, gf, z1 - .1, x1, gf + .2, z1 + .15, C.cream);                                                                               // the floor band
  // upper windows: four pairs, cream frames, blinds half down, lit at night
  for (let k = 0; k < 4; k++) { const a = x0 + 1.4 + k * 3.6, on = N && H(k, 3) > .35; B(a - .1, gf + .8, z1 - .1, a + 2.3, gf + 2.5, z1 + .1, C.cream);
    B(a, gf + .9, z1 - .2, a + 2.2, gf + 2.4, z1, (i, y) => { const wy = W.wy(y), x = W.wx(i); return Math.abs(x - a - 1.1) < .06 ? C.cream : on ? (wy > gf + 1.8 ? C.litHi : C.litLo) : (x - a + wy - gf < 1.4 && x - a + wy - gf > 1.2 ? C.glint : wy > gf + 1.7 ? C.glassHi : C.glass); }, N ? 3 : 1);
    V.clear(W.X(a), W.Y(gf + .9), W.Z(z1 - .1), W.X(a + 2.2), W.Y(gf + 2.4), W.Z(z1)); }
  // the entrance: a recess with glass doors in steel frames, the canopy lettered VISITORS on its fascia (both lit at night)
  const ea = 237.2, eb = 241.6; V.clear(W.X(ea), W.Y(SIDE + .5), W.Z(z1 - .6), W.X(eb), W.Y(SIDE + 3.0), W.Z(z1));
  B(ea, SIDE + .1, z1 - .6, eb, SIDE + .5, z1, C.concL);
  B(ea, SIDE + .5, z1 - .7, eb, SIDE + 3.0, z1 - .6, (i, y) => { const x = W.wx(i), wy = W.wy(y); return Math.abs(x - (ea + eb) / 2) < .08 || x < ea + .12 || x > eb - .12 || wy > SIDE + 2.85 || Math.abs(wy - SIDE - 2.4) < .05 ? C.steelD : N ? C.litHi : 0x8fb3d6; }, N ? 3 : 1);
  B(ea + 1.1, SIDE + 1.3, z1 - .6, ea + 1.2, SIDE + 1.9, z1 - .5, C.chrome); B(eb - 1.2, SIDE + 1.3, z1 - .6, eb - 1.1, SIDE + 1.9, z1 - .5, C.chrome);
  if (inBlock(ctx, (ea + eb) / 2, z1 + .5)) doorAt(ctx, (ea + eb) / 2, z1 + .5, 0);
  const cy = SIDE + 3.0; B(ea - .6, cy, z1, eb + .6, cy + .2, z1 + 1.6, C.slate); B(ea - .6, cy + .2, z1 + 1.4, eb + .6, cy + .9, z1 + 1.6, C.cream);
  wletters(W, '+z', ea - .6, eb + .6, cy + .75, z1 + 1.6, px('VISITORS'), C.cobalt, { l: N ? 3 : 0 });
  for (const lx of [ea + .6, eb - .9]) B(lx, cy - .1, z1 + .6, lx + .3, cy, z1 + .9, N ? C.litHi : 0xf2eedd, lit(1));
  // the BAIL window: a steel surround, thick glass (a clerk's lamp behind it at night), a tray, a speaker grille; BAIL in red neon above,
  // the terms on a plate beside it
  const ba = 244.2, bb = 247.4; B(ba - .2, SIDE + .9, z1 - .1, bb + .2, SIDE + 2.7, z1 + .12, C.steel); V.clear(W.X(ba), W.Y(SIDE + 1.1), W.Z(z1 - .3), W.X(bb), W.Y(SIDE + 2.5), W.Z(z1 + .12));
  B(ba, SIDE + 1.1, z1 - .4, bb, SIDE + 2.5, z1 - .3, (i, y) => Math.abs(W.wx(i) - (ba + bb) / 2) < .06 ? C.steelD : N ? C.litLo : 0x6f8fb6, N ? 3 : 1);
  B(ba - .1, SIDE + 1.0, z1 - .3, bb + .1, SIDE + 1.1, z1 + .35, C.steelL);                                                        // the tray
  B((ba + bb) / 2 - .25, SIDE + 1.55, z1 - .3, (ba + bb) / 2 + .25, SIDE + 1.75, z1 - .2, (i, y) => (i + y) & 1 ? C.ink : C.steelD);   // the grille
  B(ba - .3, SIDE + 2.8, z1 - .1, bb + .3, SIDE + 3.6, z1 + .02, C.ink);
  const BM = disp('BAIL', 10); wletters(W, '+z', ba - .3, bb + .3, SIDE + 3.55, z1 + .02, BM, 0xff3344, { l: N ? 3 : 1 });
  logSign(ctx, 'BAIL', (ba + bb) / 2, z1, 96);
  panel(ctx, '+z', bb + .45, bb + 2.3, SIDE + 1.3, SIDE + 2.45, z1, C.chalk, [['BAIL 25', C.red], ['CASH ONLY', C.ink], ['HALF TIME', C.ink]]);
  // the visiting-hours board and the payphone on the wall, west of the doors
  panel(ctx, '+z', x0 + .4, x0 + 2.3, SIDE + 1.1, SIDE + 2.7, z1, C.ink, [['VISITS', C.yellow], ['THU-SUN', C.chalk], ['9 TO 3', C.chalk], ['NO PHONES', C.chalk]]);
  { const pa = x0 + 2.45; B(pa, SIDE + 1.0, z1, pa + .6, SIDE + 2.2, z1 + .3, C.steelL); B(pa + .1, SIDE + 1.6, z1 + .3, pa + .5, SIDE + 2.0, z1 + .35, C.ink); B(pa + .05, SIDE + 1.1, z1 + .3, pa + .25, SIDE + 1.5, z1 + .4, C.ink); B(pa, SIDE + 2.2, z1, pa + .6, SIDE + 2.5, z1 + .15, C.cobalt); }
  // sides: a few windows on the west (over the lawn) and the east (over the apron), a door to the apron
  for (const [f, xp] of [['-x', x0], ['+x', x1]]) for (let k = 0; k < 3; k++) { const za = z0 + 1.4 + k * 4; if (f === '+x' && k === 2) continue;
    B(f === '-x' ? xp - .1 : xp - .1, gf + .9, za, f === '-x' ? xp + .1 : xp + .1, gf + 2.4, za + 2, (i, y, kk) => Math.abs(W.wz(kk) - za - 1) < .06 ? C.cream : N && H(k, f.length) > .4 ? C.litLo : C.glass, N ? 3 : 1); }
  B(x1 - .1, SIDE, z1 - 3.6, x1 + .1, SIDE + 2.5, z1 - 2.2, C.steelD); if (inBlock(ctx, x1 + .5, z1 - 2.9)) doorAt(ctx, x1 + .5, z1 - 2.9, 1);
  // the roof: two air handlers and the stair hatch
  for (const [ax, az] of [[x0 + 2, z0 + 2], [x0 + 7, z0 + 2]]) B(ax, top, az, ax + 2.2, top + 1.0, az + 1.4, C.steelL);
  B(x1 - 3, top, z0 + 1.5, x1 - 1.4, top + 1.6, z0 + 3.4, C.pale);
  later(ctx, W, { mass: [x0, z0, x1, z1], top: top + .8, roofY: top - .1 });
  keep(ctx, [ea - .6, SIDE, z1, eb + .6, SIDE + 4.2, z1 + 1.6], 'facade');
  bailBlade(ctx, (ba + bb) / 2, z1, SIDE + 4.3);
}
// the BAIL blade: a double-sided sign out over the queue, in the pier above the window, so BAIL reads from along the island road (the neon
// flat on the facade is too oblique from there): white letters on red in an ink frame, lit at night; 2.5 m out, 1.1 m tall, 0.3 m thick
function bailBlade(ctx, x, z1, y0) {
  const M = px('BAIL'), N = TOD.night, L = 25, Hc = 11, W = wv(ctx, [x - .15, z1, x + .15, z1 + L * CV], y0, y0 + Hc * CV, { s: CV }); if (!W) return; const V = W.V;
  V.box(0, 0, 0, 3, Hc, L, C.ink); V.box(1, 1, 1, 2, Hc - 1, L - 1, C.red); V.clear(0, 1, 1, 1, Hc - 1, L - 1); V.clear(2, 1, 1, 3, Hc - 1, L - 1);   // the frame on both faces, the red board between
  const u0 = (L - M.w) >> 1, top = Hc - 3; letters(V, M, '-x', u0, top, 0, C.chalk, { l: N ? 3 : 0 }); letters(V, M, '+x', u0, top, 2, C.chalk, { l: N ? 3 : 0 });
  later(ctx, W, { keep: [x - .15, y0, z1, x + .15, y0 + Hc * CV, z1 + L * CV], tag: 'blade' });
}
// ── the forecourt: the queue rail and the queue at the BAIL window, benches, planters, the flag, the camera, a bin; people
function forecourt(ctx) {
  ctx.group('forecourt'); const y = SIDE + CV, z1 = VISIT.r[3], put = (bk, x, z, o = {}) => putAt(ctx, bk, x, z, { y, reach: .6, ...o });
  // the queue rail: stanchions and a rope running out from the window (a structure on the pavers)
  const W = wv(ctx, [243.6, z1 + .6, 248.2, z1 + 3.6], y, y + 1.1, { s: CV }); if (W) { const B = W.box;
    for (const [px_, pz] of [[243.8, z1 + .8], [243.8, z1 + 3.2], [248.0, z1 + 3.2]]) { B(px_ - .1, y, pz - .1, px_ + .1, y + .05, pz + .1, C.steelD); B(px_ - .03, y, pz - .03, px_ + .03, y + .95, pz + .03, C.chrome); B(px_ - .06, y + .95, pz - .06, px_ + .06, y + 1.05, pz + .06, C.chrome); }
    B(243.77, y + .85, z1 + .8, 243.83, y + .9, z1 + 3.2, C.red); B(243.8, y + .85, z1 + 3.17, 248.0, y + .9, z1 + 3.23, C.red);
    later(ctx, W, { keep: [243.6, SIDE, z1 + .6, 243.9, SIDE + 1.1, z1 + 3.4], tag: 'rail' }); keep(ctx, [243.6, SIDE, z1 + 3.1, 248.2, SIDE + 1.1, z1 + 3.4], 'rail'); }
  // the queue: at the window, then two more along the rail
  person(ctx, 245.8, y, z1 + .75, Math.PI, 'talk', SEEDS.bond);    // at the window: the bondsman, talking into the grille
  person(ctx, 245.6, y, z1 + 1.75, Math.PI + .2, 'carry', SEEDS.mom);   // next: a bag for inside
  person(ctx, 246.0, y, z1 + 2.6, Math.PI - .3, 'phone', SEEDS.cash);   // counting on the phone
  // benches for visiting hours, people on them; planters, the flag, a bin, the camera pole
  const b1 = put(bench(C.slate), 231.2, z1 + 1.2, { rot: 2, slide: [1, 0] }), b2 = put(bench(C.slate), 251.8, z1 + 1.2, { rot: 2, slide: [1, 0] });
  if (b1) { person(ctx, b1[0] - .5, y + .05, b1[1] + .1, 0, 'sit', SEEDS.sit1, { seatY: .45 }); person(ctx, b1[0] + .6, y + .05, b1[1] + .1, .3, 'sit', SEEDS.sit2, { seatY: .45 }); }
  if (b2) person(ctx, b2[0] + .4, y + .05, b2[1] + .1, -.2, 'sit', SEEDS.sit3, { seatY: .45 });
  put(planter(1), 227.8, z1 + 1.4); put(planter(2), 254.8, z1 + 1.6); put(flagpole(), 227.6, z1 + 2.8, { rot: 0 });
  put(bin(0x2f5bff), 242.2, z1 + .5); put(camPole(), 253.6, z1 + .5, { rot: 2 });
}
