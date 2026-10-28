// GLASSWALL · THE DOWNTOWN FRINGE · block −2,−4 (Market Ave & Jay St, the Yards across the avenue) · owner: the downtown fringe agent
// (batch 5).
//   KID GLOVES BOXING, in the old brick warehouse on the corner. The name is painted big on the Market Ave wall over the loading dock
//   (the roll-up door up, pallets on the dock plate, black bumpers), and through the steel loft windows on both streets you see the gym:
//   a blue ring with red, white and blue ropes and two sparring in it, the trainer at the apron, three heavy bags on chains and a kid on
//   one, the mirror wall. FRI NITE FIGHTS on a lit board on Jay St, a red door under GYM. On the roof a giant red glove on a steel stand
//   throws a punch at the Yards: the north side's landmark from the overview. The rest of the block is the generator's.
// Ids read -2_-4·gym·kind·n for the gym and -2_-4·L<k>·kind·n for the generated lots.
import { fillBlock, mk, framed, shiftR } from '../districts/downtown/fill.js';   // (SPREAD: authored in today's metres, the block's frame)
import { kerbX, kerbZ } from '../districts/frame.js';
import { brush, person, lit } from '../districts/downtown/lib.js';
import { blockCtx } from '../engine.js';
import { kitNow } from '../gen.js';
import { REG } from '../audit.js';
import { AIR } from '../kit.js';
import { PAL, SIDE, hash } from '../style.js';

const GYM = [-50, -122, -36, -108], H = 8.4, BRICK = 0x9b4f3a, CREAM = 0xfff0d0, STEEL = 0x2a2d38, RED = 0xd8262f, BLUE = 0x2f5bff, WHITE = 0xf7f7f2, RUBBER = 0x33353f;
const RING = [-45.5, -120.5, -39.5, -114.5], RH = .8;   // the ring: 6 m square, its canvas 0.8 m up

export function boxingGym(bank, b, A) {
  fillBlock(bank, b, A, { seed: 52101,
    lots: [mk(-60, -122, -54, -115, ['-z', '-x'], 'NW'), mk(-54, -122, -50, -114, ['-z']), mk(-60, -115, -54, -107, ['-x']), mk(-60, -107, -52, -100, ['+z', '-x'], 'SW'),
      mk(-52, -108, -45, -100, ['+z']), mk(-45, -108, -36, -100, ['+z', '+x'], 'SE')],
    heroes: [{ rect: GYM, top: SIDE + 13.4, nh: 134, group: 'gym', faces: ['-z', '+x'] }],
    build() { const ctx = framed(blockCtx(bank, b, A, kitNow())); REG.group('gym'); REG.strict = true;
      try { gym(ctx, A); ctx.finish(); } finally { REG.strict = false; } } });
}

// a steel loft window opening through the wall: a grid of mullions (the room shows through), a sill
function loftWindow(f, a0, a1, y0, y1) { f.box(a0, y0, -3, a1, y1, 1, AIR); for (let a = a0; a < a1; a++) for (let y = y0; y < y1; y++) if ((a - a0) % 7 === 0 || (y - y0) % 9 === 0 || a === a1 - 1 || y === y1 - 1) f.set(a, y, -2, STEEL, 2);
  f.box(a0 - 1, y0 - 2, 0, a1 + 1, y0, 2, CREAM); f.box(a0 - 1, y1, 0, a1 + 1, y1 + 2, 1, 0x7a3a2b); }

function gym(ctx, A) {
  const [x0, z0, x1, z1] = GYM, G = ctx.building(x0, z0, x1, z1, { h: H, wall: BRICK, trim: CREAM, faces: ['-z', '+x'], parapet: 5, extra: 52 }), V = G.V, B = G.B, P = brush(V), TOP = G.top;
  // ── the hall: the ground floor cleared to 4.4 m, rubber floor, lit strips in the ceiling, the mirror wall (west)
  V.clear(B.x0 + 3, 1, B.z0 + 3, B.x1 - 3, 44, B.z1 - 3); V.box(B.x0 + 3, 0, B.z0 + 3, B.x1 - 3, 1, B.z1 - 3, RUBBER);
  for (let x = B.x0 + 12; x < B.x1 - 12; x += 26) V.box(x, 43, B.z0 + 8, x + 6, 44, B.z1 - 8, 0xfff7dc, lit(1));
  P.box(x0 + .3, SIDE + .5, -120.8, x0 + .4, SIDE + 3.0, -111.0, 0xcfe6f5, 1);
  // the ring: platform, red apron, blue canvas, four corner posts, three ropes
  const [rx0, rz0, rx1, rz1] = RING; P.box(rx0, SIDE + .1, rz0, rx1, SIDE + RH - .1, rz1, RED); P.box(rx0 - .1, SIDE + RH - .1, rz0 - .1, rx1 + .1, SIDE + RH, rz1 + .1, BLUE);
  for (const [px, pz, c] of [[rx0, rz0, RED], [rx1 - .2, rz0, BLUE], [rx0, rz1 - .2, WHITE], [rx1 - .2, rz1 - .2, WHITE]]) P.box(px, SIDE + RH, pz, px + .2, SIDE + RH + 1.3, pz + .2, c, 1);
  [[.4, RED], [.75, WHITE], [1.1, BLUE]].forEach(([h, c]) => { const y = SIDE + RH + h; P.box(rx0, y, rz0 + .05, rx1, y + .06, rz0 + .15, c); P.box(rx0, y, rz1 - .15, rx1, y + .06, rz1 - .05, c); P.box(rx0 + .05, y, rz0, rx0 + .15, y + .06, rz1, c); P.box(rx1 - .15, y, rz0, rx1 - .05, y + .06, rz1, c); });
  REG.footprint(...shiftR(ctx, RING), SIDE + RH, SIDE + RH);   // (the canvas is a floor people stand on)
  // three heavy bags on chains from the ceiling, along the south of the hall
  [[-48.2, RED], [-46.2, 0x17171b], [-44.2, BLUE]].forEach(([x, c]) => { P.cyl(x, -110.9, .36, SIDE + .9, SIDE + 2.3, (a, y) => y > SIDE + 2.15 || y < SIDE + 1.05 ? 0x17171b : c, 0);
    P.box(x - .04, SIDE + 2.3, -110.94, x + .04, SIDE + 4.4, -110.86, 0x8f949c, 2); });
  // ── Market Ave (a 0 at the Jay St end): the loading dock, the ground-floor loft windows, KID GLOVES / BOXING painted big on the brick
  const N = G.F('-z'), NL = N.len;
  N.box(102, 0, -24, 136, 12, 1, 0xb3aea4); N.box(102, 12, -40, 136, 44, 1, AIR); N.box(100, 44, 0, 138, 47, 2, STEEL);                  // the dock plate, the bay, its header
  for (let y = 44; y < 47; y++) N.box(104, y - 3, -2, 134, y - 2, -1, 0x9aa0a8, 2);                                                     // the roll-up door, rolled
  for (const a of [106, 128]) N.box(a, 3, 0, a + 4, 10, 3, 0x17171b);                                                                   // bumpers
  for (const [a, h] of [[106, 4], [112, 7], [124, 3]]) N.box(a, 12, -18, a + 10, 12 + h, -8, 0xa4652f);                                // pallets on the plate
  N.box(0, 0, 0, NL, 5, 2, 0x7a3a2b); for (const [a0, a1] of [[10, 34], [40, 64], [70, 94]]) loftWindow(N, a0, a1, 8, 34);
  N.text('KID GLOVES', NL >> 1, 78, 1, 2, CREAM, 0, 2, 1); N.text('BOXING', NL >> 1, 61, 1, 2, CREAM, 0, 2, 1);
  // ── Jay St (a 0 at the 3rd St end): the red door under GYM, loft windows on the hall, FRI NITE FIGHTS lit upstairs
  const E = G.F('+x'), EL = E.len;
  E.box(0, 0, 0, EL, 5, 2, 0x7a3a2b); E.box(12, 0, -3, 26, 24, 1, AIR); E.box(12, 0, -4, 26, 24, -3, RED); E.box(18, 10, -3, 20, 12, -2, PAL.gold, 2);
  E.box(8, 25, 0, 30, 35, 3, STEEL); E.text('GYM', 19, 33, 3, 4, CREAM, lit(0), 1, 1);
  const dz = z1 - 1.9, dx = x1 + .5; REG.door(kerbX(dx), kerbZ(dz), 1);
  for (const [a0, a1] of [[36, 62], [68, 94], [100, 126]]) loftWindow(E, a0, a1, 8, 34);
  for (const [a0, a1] of [[20, 44], [52, 76]]) { E.box(a0, 50, -2, a1, 72, 1, AIR); E.box(a0, 50, -3, a1, 72, -2, (a, y) => ((a - a0) % 6 === 0 || (y - 50) % 11 === 0) ? STEEL : (y > 67 ? PAL.litHi : PAL.glassLo), 1); }
  E.box(86, 48, 0, 132, 72, 2, STEEL); E.box(87, 49, 1, 131, 71, 2, WHITE, lit(0)); E.text('FRI NITE', 109, 68, 2, 3, RED, lit(0), 1, 1); E.text('FIGHTS', 109, 58, 2, 3, PAL.ink, 0, 1, 1);
  // ── the roof: the giant red glove on its stand, punching north at the Yards (fist, thumb, knuckle seam, white laced cuff)
  const gx = -43, gy = TOP + 3.0, gz = -115.4, X = P.X, Yv = P.Y, Z = P.Z, s = .1;
  P.box(gx - .2, TOP, gz + .9, gx + .2, gy - .6, gz + 1.3, 0x6d707a, 2); P.box(gx - 1.0, TOP, gz + .5, gx + 1.0, TOP + .2, gz + 1.7, 0x6d707a, 2);
  V.ell(X(gx), Yv(gy), Z(gz - .4), 1.35 / s, 1.1 / s, 1.6 / s, RED); V.ell(X(gx + 1.05), Yv(gy + .45), Z(gz - .9), .5 / s, .45 / s, 1.0 / s, RED);
  V.ell(X(gx), Yv(gy + .05), Z(gz - 1.55), 1.3 / s, 1.05 / s, .12 / s, 0xa81a22);
  for (let z = gz + .6; z < gz + 1.9; z += .1) for (let x = -1.0; x <= 1.0; x += .1) for (let y = -1.0; y <= 1.0; y += .1) if (x * x + y * y <= 1.0) P.box(gx + x, gy + y, z, gx + x + .1, gy + y + .1, z + .1, (Math.abs(x) < .15 && ((z * 10) | 0) % 3 === 0) ? RED : WHITE);
  // ── the people: two sparring on the canvas, the trainer at the apron, a kid on the middle bag (their guard up: the dj pose)
  const cy = SIDE + RH; person(A, -43.5, -117.5, Math.PI / 2, 'dj', 2101, cy); person(A, -41.5, -117.5, -Math.PI / 2, 'dj', 2102, cy);
  A.life.push({ x: kerbX(-44.6), y: SIDE + .1, z: kerbZ(-113.7), ry: Math.PI, act: 'clerk', seed: 2103, hand: true });
  person(A, -46.2, -111.9, Math.PI, 'dj', 2104, SIDE + .1);
}
