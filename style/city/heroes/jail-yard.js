// IRON ISLAND · hero · THE YARD (block 8,−11) · owner: the water-side agent (batch 5).
// Where the jailed wait (the sim's jail is the yard's gate, 256, −338). Welded mesh on the west, north and south (wire along the top,
// the gate across the corridor from intake), the outer wall on the east. A full court in cobalt with orange keys (the overview reads it),
// two hoops with chain nets; the weight pen on a rubber mat (bench press, squat cage, dumbbell rack, a pull-up bar); aluminium bleachers;
// two floodlight masts. On the wall, the mural, in the Dazed format: one flat colour, one huge character (the county jumpsuit, painted
// by someone inside), a small wordmark: INSIDE. Everyone here wears county orange but the officer at the gate.
import { kitNow } from '../gen.js';
import { heroBlock } from '../districts/jail/build.js';
import { C, CV, SIDE, TOD, REG, H, lit, shade, mix, wv, later, px, logSign, person, bench, floodMast, inBlock, put, keep } from '../districts/jail/lib.js';
import { YARD, COURT, WALL, JAIL } from '../districts/jail/plan.js';
import { charImg, charsReady } from '../signage/art.js';

export function yard(bank, b, A) { heroBlock(bank, b, A, kitNow(), content); }
// looks: castspec.js rolls a hand-placed person's look from (seed, its place among the block's hand-placed people, the block): these
// seeds roll the county jumpsuit for everyone here and a dark jacket for the officer (searched offline; re-search if people are added)
export const SEEDS = { pull: 1681, curl: 9356, spot: 16870, sit1: 24869, sit2: 32737, sit3: 40854, wait1: 48757, wait2: 56875, co: 64962, shoot: 72754, reach: 80225, arms: 88173 };   // (in A.life order: hk 0 … 11)
// cast pass (2026-10-02): the seeds above were searched against the old roll; with the fresh cast each person carries an `outfit` instead
// (castspec.js lays cast.js OUTFITS over the roll): 'county' = Iron Island issue, 'officer' = precinct blues + cap. The seeds still vary the rest.
const Y0 = SIDE + CV;   // the yard's floor (the ground layer's top)

function content(ctx) {
  court(ctx); hoops(ctx); weights(ctx); bleachers(ctx); fences(ctx); mural(ctx);
  ctx.group('yard-life');
  for (const [x, z, rot] of [[263.0, -321.6, 2], [264.4, -350.6, 0]]) put(ctx, floodMast(72), x, z, { y: Y0, reach: .5, rot, slide: [1, 0] });
  const b1 = put(ctx, bench(C.steelD), 257.6, -340.6, { y: Y0, rot: 1, reach: .4, slide: [0, 1] });   // the waiting bench by the gate (backs to the fence)
  if (b1) { person(ctx, b1[0] + .1, Y0 + .05, b1[1] - .45, Math.PI / 2, 'sit', SEEDS.wait1, { outfit: 'county', seatY: .45 }); person(ctx, b1[0] + .1, Y0 + .05, b1[1] + .55, Math.PI / 2 - .3, 'sit', SEEDS.wait2, { outfit: 'county', seatY: .45 }); }
  person(ctx, 257.3, Y0, JAIL[1] + 1.6, -Math.PI / 2 + .4, 'stand', SEEDS.co, { outfit: 'officer' });                        // the officer just inside the gate
  // the game: a shooter at the top of the key, one reaching for the rebound, one with his arms up in defence
  person(ctx, 271.8, Y0, -330.2, 0, 'shoot', SEEDS.shoot, { outfit: 'county' }); person(ctx, 270.6, Y0, -325.6, Math.PI, 'reach', SEEDS.reach, { outfit: 'county' }); person(ctx, 272.9, Y0, -328.4, Math.PI - .4, 'arms', SEEDS.arms, { outfit: 'county' });
}
// ── the court (0.1 m, one layer over the yard's floor): cobalt, orange keys, white lines
function court(ctx) {
  const [x0, z0, x1, z1] = COURT.r, W = wv(ctx, COURT.r, .2, .3, { s: CV }); if (!W) return; ctx.group('court'); const V = W.V, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, hz = [z0 + 1.575, z1 - 1.575];
  const line = (x, z) => { const e = Math.min(x - x0, x1 - x, z - z0, z1 - z); if (e < .1) return true; if (Math.abs(z - cz) < .05) return true; if (Math.abs(Math.hypot(x - cx, z - cz) - 1.8) < .06) return true;
    for (const [bz, s] of [[z0, 1], [z1, -1]]) { const d = (z - bz) * s; if (d < 5.8 && Math.abs(Math.abs(x - cx) - 2.45) < .06) return true; if (Math.abs(d - 5.8) < .06 && Math.abs(x - cx) < 2.45) return true;
      if (d > 5.8 && d < 7.6 && Math.abs(Math.hypot(x - cx, z - (bz + s * 5.8)) - 1.8) < .06) return true;
      const hzz = bz + s * 1.575, r = Math.hypot(x - cx, z - hzz); if (d > 2.99 && Math.abs(r - 6.75) < .06 && Math.abs(x - cx) < 6.6) return true; if (d <= 2.99 && Math.abs(Math.abs(x - cx) - 6.6) < .06) return true; }
    return false; };
  for (let k = 0; k < V.nz; k++) for (let i = 0; i < V.nx; i++) { const x = W.wx(i), z = W.wz(k); let c = C.court;
    if (line(x, z)) c = C.lineW; else if (Math.abs(x - cx) < 2.45 && (z - z0 < 5.8 || z1 - z < 5.8)) c = C.courtKey; else if (H(i >> 2, k >> 2, 5) > .985) c = shade(C.court, .92);
    V.set(i, 0, k, c); }
  later(ctx, W, { walk: true }); logSign(ctx, 'COURT', cx, cz, 0);
}
// ── hoops: a steel pole behind each baseline, the arm, the backboard (white, the orange box), the rim, a chain net
function hoops(ctx) {
  ctx.group('hoops'); const cx = (COURT.r[0] + COURT.r[2]) / 2;
  for (const [zb, s] of [[COURT.r[1], 1], [COURT.r[3], -1]]) { const zp = zb - s * .7, W = wv(ctx, [cx - 1.2, Math.min(zp, zb + s * 2) - .3, cx + 1.2, Math.max(zp, zb + s * 2) + .3], Y0, Y0 + 4.2, { s: CV }); if (!W) continue; const B = W.box;
    B(cx - .1, Y0, zp - .1, cx + .1, Y0 + 3.4, zp + .1, C.steelD); B(cx - .25, Y0, zp - .25, cx + .25, Y0 + .1, zp + .25, C.steelD);
    const zbb = zb + s * 1.2, zf = Math.min(zp, zbb), zt = Math.max(zp, zbb); B(cx - .05, Y0 + 3.2, zf, cx + .05, Y0 + 3.3, zt, C.steelD);   // the arm
    B(cx - .9, Y0 + 2.9, zbb - .05, cx + .9, Y0 + 3.95, zbb + .05, (i, y) => { const x = W.wx(i), wy = W.wy(y); return (Math.abs(Math.abs(x - cx) - .3) < .05 && wy > Y0 + 3.0 && wy < Y0 + 3.45) || (Math.abs(wy - Y0 - 3.45) < .05 && Math.abs(x - cx) < .3) || (Math.abs(wy - Y0 - 3.0) < .05 && Math.abs(x - cx) < .3) ? C.courtKey : C.chalk; });
    const rz = zbb + s * .3; for (let a = 0; a < 24; a++) { const t = a / 24 * Math.PI * 2, x = cx + Math.cos(t) * .23, z = rz + s * .05 + Math.sin(t) * .23; B(x - .05, Y0 + 3.0, z - .05, x + .05, Y0 + 3.1, z + .05, C.courtKey); }
    B(cx - .05, Y0 + 3.0, Math.min(zbb, rz - s * .2), cx + .05, Y0 + 3.1, Math.max(zbb, rz - s * .2), C.courtKey);
    for (let a = 0; a < 8; a++) { const t = a / 8 * Math.PI * 2, x = cx + Math.cos(t) * .2, z = rz + s * .05 + Math.sin(t) * .2; B(x - .05, Y0 + 2.6, z - .05, x + .05, Y0 + 3.0, z + .05, a % 2 ? C.steelL : C.chalk); }
    later(ctx, W, { keep: [cx - .3, SIDE, zp - .3, cx + .3, SIDE + 3.5, zp + .3], tag: 'hoop' }); }
}
// ── the weight pen: a rubber mat, the bench press on its rack, the squat cage, a dumbbell rack, the pull-up bar; three lifting
function weights(ctx) {
  ctx.group('weights'); const x0 = 257.4, x1 = 262.8, z0 = -351.0, z1 = -341.2, W = wv(ctx, [x0, z0, x1, z1], Y0, Y0 + 2.6, { s: CV }); if (!W) return; const B = W.box, V = W.V, T = Y0 + .1;
  B(x0, Y0, z0, x1, T, z1, (i, y, k) => (i + k) % 9 === 0 ? 0x33363f : C.mat);                                                    // the mat
  // bench press (head north): the bench, two uprights, the bar with plates
  const bx = 259.0, bz = -348.4; B(bx - .2, T, bz, bx + .2, T + .45, bz + 1.3, C.ink); B(bx - .15, T + .45, bz, bx + .15, T + .5, bz + 1.3, 0x7a1f1f);
  for (const s of [-1, 1]) B(bx + s * .55 - .05, T, bz - .15, bx + s * .55 + .05, T + 1.15, bz - .05, C.steelD);
  B(bx - 1.1, T + 1.0, bz - .2, bx + 1.1, T + 1.1, bz - .1, C.steelL); for (const s of [-1, 1]) for (let d = 0; d < 3; d++) { const px_ = bx + s * (.8 + d * .1); B(Math.min(px_, px_ + s * .1), T + .8, bz - .4, Math.max(px_, px_ + s * .1), T + 1.3, bz + .1, d === 1 ? C.red : C.ink); }
  // the squat cage
  const qx = 261.4, qz = -349.6; for (const [dx, dz] of [[-.6, -.6], [.5, -.6], [-.6, .5], [.5, .5]]) B(qx + dx, T, qz + dz, qx + dx + .1, T + 2.2, qz + dz + .1, C.steelD);
  B(qx - .6, T + 2.1, qz - .6, qx + .6, T + 2.2, qz + .6, C.steelD); B(qx - .6, T, qz - .6, qx + .6, T + .1, qz + .6, C.steelD);
  B(qx - 1.0, T + 1.4, qz - .6, qx + 1.0, T + 1.5, qz - .5, C.steelL); for (const s of [-1, 1]) B(Math.min(qx + s * .8, qx + s * .9), T + 1.2, qz - .8, Math.max(qx + s * .8, qx + s * .9), T + 1.7, qz - .3, C.ink);
  // the dumbbell rack along the fence
  B(257.6, T, -345.4, 258.1, T + .7, -342.2, C.steelD); for (let z = -345.2; z < -342.4; z += .45) { B(257.6, T + .7, z, 258.1, T + .8, z + .1, C.ink); B(257.55, T + .7, z - .08, 257.65, T + .85, z + .18, C.ink); B(258.05, T + .7, z - .08, 258.15, T + .85, z + .18, C.ink); }
  // the pull-up bar
  for (const x of [259.9, 261.9]) B(x, T, -343.8, x + .1, T + 2.5, -343.7, C.steelD); B(259.9, T + 2.4, -343.8, 262.0, T + 2.5, -343.7, C.steelL);
  later(ctx, W, { walk: true }); keep(ctx, [bx - 1.2, SIDE, bz - .4, bx + 1.2, SIDE + 1.5, bz + 1.4], 'weights'); keep(ctx, [qx - .7, SIDE, qz - .7, qx + .7, SIDE + 2.4, qz + .7], 'weights');
  person(ctx, 260.9, T, -343.75, Math.PI, 'reach', SEEDS.pull, { outfit: 'county' });                                    // hanging on (under) the pull-up bar
  person(ctx, 258.9, T, -345.9, -Math.PI / 2 - .3, 'arms', SEEDS.curl, { outfit: 'county' });                           // curling, facing the rack
  person(ctx, 259.0, T, -349.1, 0, 'talk', SEEDS.spot, { outfit: 'county' });                                           // spotting at the bench's head
}
// ── bleachers: three tiers of aluminium planks on steel frames, facing the court (east); people on them
function bleachers(ctx) {
  ctx.group('bleachers'); const x0 = 257.4, x1 = 261.6, z0 = -335.8, z1 = -324.2, W = wv(ctx, [x0, z0, x1, z1], Y0, Y0 + 1.8, { s: CV }); if (!W) return; const B = W.box;
  const tiers = [[260.2, .45], [259.0, .9], [257.8, 1.35]];
  for (const [tx, h] of tiers) { B(tx, Y0 + h - .1, z0, tx + 1.2, Y0 + h, z1, C.steelL); B(tx + .1, Y0 + h - .25, z0, tx + 1.1, Y0 + h - .1, z1, C.steel);   // seat plank, its frame
    for (let z = z0; z < z1; z += 1.9) B(tx + .5, Y0, z, tx + .6, Y0 + h - .25, z + .1, C.steelD); }
  B(x0, Y0 + 1.35, z0, x0 + .1, Y0 + 1.8, z1, C.steelL);                                                                         // the back rail
  later(ctx, W, { keep: [x0, SIDE, z0, x1, SIDE + 1.8, z1], tag: 'bleachers' });
  person(ctx, 260.6, Y0 + .45 - .5, -333.2, Math.PI / 2, 'sit', SEEDS.sit1, { outfit: 'county', seatY: .5 }); person(ctx, 259.4, Y0 + .9 - .5, -329.6, Math.PI / 2 - .2, 'sit', SEEDS.sit2, { outfit: 'county', seatY: .5 });
  person(ctx, 258.2, Y0 + 1.35 - .5, -326.4, Math.PI / 2 + .3, 'sit', SEEDS.sit3, { outfit: 'county', seatY: .5 });
}
// ── welded-mesh fence on the west (the gate at the sim's place), north and south, 3.6 m with wire along the top; posts every 3 m
function fences(ctx) {
  ctx.group('fence'); const [x0, z0, x1, z1] = YARD.r, xe = WALL.x1 - WALL.t / 2, H0 = 3.6, gate = [JAIL[1] - .8, JAIL[1] + .8];
  const runs = [['z', x0, z0, z1], ['x', z0, x0 + .1, xe], ['x', z1 - .1, x0 + .1, xe]];
  for (const [ax, at, a, b] of runs) { const rect = ax === 'z' ? [at, a, at + .1, b] : [a, at, b, at + .1], W = wv(ctx, rect, Y0, Y0 + H0 + .5, { s: CV }); if (!W) continue; const V = W.V;
    for (let k = 0; k < V.nz; k++) for (let i = 0; i < V.nx; i++) { const u = ax === 'z' ? W.wz(k) : W.wx(i), q = Math.round(u * 10); if (!inBlock(ctx, W.wx(i), W.wz(k))) continue;
      const post = ((q % 30) + 30) % 30 === 0, inGate = ax === 'z' && u > gate[0] && u < gate[1], frame = ax === 'z' && (Math.abs(u - gate[0]) < .1 || Math.abs(u - gate[1]) < .1);
      for (let y = 0; y < V.ny; y++) { const h = y * .1; let c = null;
        if (h < H0) { if (post || frame) c = C.steelD; else if (y === V.ny - 6 || y === 0 || (inGate && (y === 1 || y === V.ny - 7))) c = C.steel; else if (((q % 3) + 3) % 3 === 0 || y % 3 === 0) c = inGate ? C.steelL : 0xa9aeb5; }   // welded mesh: wires every 0.3 m (long strips: cheap to mesh)
        else if (h < H0 + .5 && (post || y - Math.round(H0 / .1) === Math.abs(((q % 6) + 6) % 6 - 3))) c = C.steel;
        if (c !== null) V.set(i, y, k, c); } }
    later(ctx, W, { keep: ax === 'z' ? [at - .05, SIDE, a, at + .15, SIDE + H0, b] : [a, SIDE, at - .05, b, SIDE + H0, at + .15], tag: 'fence' }); }
}
// ── the mural on the outer wall's inner face (the yard side): hot pink, the county jumpsuit bust, huge; INSIDE, small, top corner
function mural(ctx) {
  const wall = (ctx.J.walls || []).find(w => Math.abs(w.r[0] - (WALL.x1 - WALL.t / 2)) < .01); if (!wall) return; const { W } = wall, xi = WALL.x1 - WALL.t / 2 + .1;   // the inner face's cell layer
  const za = -349.0, zb = -327.0, ya = SIDE + .6, yb = SIDE + 5.8, PINK = 0xff4fa3, set = (z, y, c) => { if (z >= W.uz0 && z < W.uz1 && y >= W.y0) W.set(xi, y, z, c); };   // (SPREAD: its bounds in today's metres)
  for (let z = za + .1; z < zb; z += .2) for (let y = ya + .1; y < yb; y += .2) set(z, y, PINK);
  // the character: a bust from the fit-check card (signage art), one cell per pixel, right of centre; a painted fallback face if no chars
  const I = charsReady() ? charImg({ handle: 'county.blues' }, { crop: 'bust' }) : null, cz = -334.4;
  if (I && I.w > 4) { const w = I.w * .2, h = I.h * .2, z0 = cz - w / 2, y0 = ya + .2;
    for (let py = 0; py < I.h; py++) for (let px_ = 0; px_ < I.w; px_++) { const c = I.get(px_, py); if (c < 0) continue; set(z0 + px_ * .2 + .1, y0 + h - py * .2 - .1, c); } }
  else { for (let z = cz - 1.8; z < cz + 1.8; z += .2) for (let y = ya + 1.4; y < ya + 4.6; y += .2) set(z + .1, y + .1, 0xc98a5b);
    for (let z = cz - 2.4; z < cz + 2.4; z += .2) for (let y = ya; y < ya + 1.4; y += .2) set(z + .1, y + .1, C.orange); for (const s of [-1, 1]) for (let z = cz + s * .8 - .3; z < cz + s * .8 + .3; z += .2) for (let y = ya + 3.0; y < ya + 3.6; y += .2) set(z + .1, y + .1, C.ink); }
  // the wordmark, small, top left as the yard sees it (the viewer faces east: left is north, −z)
  const M = px('INSIDE'); for (let j = 0; j < 7; j++) for (let a = 0; a < M.w; a++) if (M.at(a, j)) set(za + .8 + a * .2 + .1, yb - .5 - j * .2 - .1, C.chalk);
  logSign(ctx, 'INSIDE', WALL.x1 - WALL.t / 2, (za + zb) / 2, 96);
}
