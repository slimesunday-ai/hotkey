// GLASSWALL · THE DOWNTOWN FRINGE · block 2,−4 (Market Ave & Linden St, a parking block, the Yards across the avenue) · owner: the
// downtown fringe agent (batch 5).
//   SKYLOT: a raw-concrete parking garage with a rooftop hangout. Three open decks on Market Ave, Linden St and 3rd St (the 24/7 Store is
//   across 3rd St), cars at every deck edge, the level painted on the Market Ave spandrels (2 · 3 · R), the way in on Linden St past the
//   attendant's booth and two striped arms, SKYLOT down a red neon blade over the avenue. At the north-west corner a round drum with the
//   ramp spiralling up inside it (a red stripe climbs its slots; from the overview an open spiral in a ring). On the roof the south half
//   is the neighbourhood's: a painted half-court at the brick stair tower, two couches, a grill and a speaker under string lights, the
//   kids who own it. The rest of the block (Maple St) is the generator's.
// Ids read 2_-4·garage·kind·n for the garage and 2_-4·L<k>·kind·n for the generated lots.
import { fillBlock, mk, framed, shiftR } from '../districts/downtown/fill.js';   // (SPREAD: authored in today's metres, the block's frame)
import { kerbX, kerbZ } from '../districts/frame.js';
import { brush, carVox, CARS, person, lit } from '../districts/downtown/lib.js';
import { blockCtx } from '../engine.js';
import { kitNow } from '../gen.js';
import { REG } from '../audit.js';
import { stamp } from '../vox.js';
import { AIR } from '../kit.js';
import { PAL, SIDE, hash } from '../style.js';
import { couch, grill, speaker, milkCrate, lawnChair } from '../props.js';

const G = [68, -122, 86, -100], LH = 2.9, Y = k => SIDE + k * LH, ROOF = Y(3);
const CONC = 0xc9c4ba, CONC2 = 0xb3aea4, DECK = 0x9d9a93, FLOOR = 0x7b7a80, BRICK = 0x9b4f3a, RED = 0xd8262f, YEL = 0xffd21f, COURT = 0xe07a3f, COURT2 = 0x2f5bff;
const HX = 73, HZ = -117, HR = 4.8;                    // the helix drum (north-west corner)
const TW = [82, -104, 86, -100], TH = SIDE + 12.2;      // the brick stair tower (south-east corner of the garage)

export function garage(bank, b, A) {
  fillBlock(bank, b, A, { seed: 52401,
    lots: [mk(86, -122, 92, -115, ['-z', '+x'], 'NE'), mk(86, -115, 92, -107, ['+x']), mk(86, -107, 92, -100, ['+z', '+x'], 'SE')],
    heroes: [{ rect: [68, -122, 86, -104], top: SIDE + 10.2, nh: 102, group: 'garage', faces: ['-z', '-x'], roofY: ROOF }, { rect: [68, -104, 82, -100], top: SIDE + 10.2, nh: 102, group: 'garage', faces: ['+z', '-x'], roofY: ROOF },
      { rect: TW, top: TH + .2, nh: 124, group: 'garage', faces: ['+z'], roofY: TH }],
    build() { const ctx = framed(blockCtx(bank, b, A, kitNow())); REG.group('garage'); REG.strict = true;
      try { build(ctx, A); ctx.finish(); } finally { REG.strict = false; } } });
}

function build(ctx, A) {
  const [x0, z0, x1, z1] = G, V = ctx.volume(x0, SIDE, z0 - 1.2, x1, SIDE + 12.6, z1), P = brush(V);
  REG.footprint(...shiftR(ctx, G), SIDE + 10.2, ROOF); REG.footprint(...shiftR(ctx, TW), TH + .2, TH);
  const inHelix = (x, z, pad = 0) => Math.hypot(x - HX, z - HZ) < HR + pad, inTower = (x, z) => x >= TW[0] && x < TW[2] && z >= TW[1] && z < TW[3];
  // floors: the ground slab, three decks (0.3 m), cut round the drum
  P.box(x0, SIDE, z0, x1, SIDE + .1, z1, (x, y, z) => inHelix(x, z) ? undefined : FLOOR);
  for (let k = 1; k <= 3; k++) P.box(x0, Y(k) - .3, z0, x1, Y(k), z1, (x, y, z) => inHelix(x, z, .05) ? undefined : (k === 3 ? DECK : CONC2));
  // columns round the edge (clear of the stalls) and two down the aisle
  const cols = []; for (const x of [x0, 74.8, 81.4, x1 - .4]) cols.push([x, z0], [x, z1 - .4]); for (const z of [-116, -110, -104.4]) cols.push([x0, z], [x1 - .4, z]); cols.push([74.8, -112.6], [81.4, -112.6]);
  for (const [x, z] of cols) { if (inHelix(x + .2, z + .2, .6) || inTower(x + .2, z + .2)) continue; P.box(x, SIDE, z, x + .4, ROOF + 1.1, z + .4, CONC); }
  // spandrels on the three street faces (1 m, a light cap), the roof parapet 1.1 m; the ground floor walled on Market Ave and 3rd St
  for (let k = 1; k <= 3; k++) { const h = k === 3 ? 1.1 : 1.0, ya = Y(k), cap = (x, y) => y > ya + h - .12 ? 0xe4e0d8 : CONC;
    P.box(x0, ya, z0, x1, ya + h, z0 + .25, (x, y, z) => inHelix(x, z, .5) ? undefined : cap(x, y)); P.box(x0, ya, z1 - .25, x1, ya + h, z1, (x, y, z) => inTower(x, z) ? undefined : cap(x, y));
    P.box(x0, ya, z0, x0 + .25, ya + h, z1, (x, y, z) => inHelix(x, z, .5) ? undefined : cap(x, y)); P.box(x1 - .25, ya, z0, x1, ya + h, z1, (x, y, z) => inTower(x, z) ? undefined : cap(x, y)); }
  P.box(x0, SIDE, z0, x1, SIDE + 1.0, z0 + .25, (x, y, z) => inHelix(x, z, .5) ? undefined : CONC); P.box(x0, SIDE, z1 - .25, 82, SIDE + 1.0, z1, CONC);
  P.box(x0, SIDE, -104.4, x0 + .25, SIDE + 1.0, z1, CONC);                                                           // the ground floor's Linden St wall south of the way in
  // ── the drum: a ramp spiralling up inside a ring of slots (one turn a deck), a red stripe on the slot sills, open at the top
  const phase = (a, y) => ((y - SIDE - (a + Math.PI) / (Math.PI * 2) * LH) % LH + LH) % LH;
  P.cyl(HX, HZ, HR, SIDE, ROOF + 1.1, (a, y) => { const p = phase(a, y); return p >= 1.15 && p < 2.55 ? undefined : p >= 1.0 && p < 1.15 ? RED : CONC; }, 0, HR - .4);
  P.cyl(HX, HZ, 1.3, SIDE, ROOF + 1.1, CONC2);                                                                       // the core
  for (let turn = 0; turn < 3; turn++) P.cyl(HX, HZ, HR - .4, SIDE, ROOF, (a, y) => { const t = SIDE + turn * LH + (a + Math.PI) / (Math.PI * 2) * LH; return y >= t - .3 && y < t ? (y > t - .1 ? 0x8a877f : CONC2) : undefined; }, 0, 1.3);
  P.cyl(HX, HZ, HR, ROOF + .98, ROOF + 1.1, 0xe4e0d8, 0, HR - .4);                                                  // the drum's cap ring
  // ── the stair tower (brick): a door on 3rd St, a door to the roof, the hoop on its north face
  P.box(TW[0], SIDE, TW[1], TW[2], TH, TW[3], BRICK); P.box(TW[0], TH - .1, TW[1], TW[2], TH + .2, TW[3], 0xd9d5cc);
  P.box(TW[0] + .2, TH - .25, TW[1] + .2, TW[2] - .2, TH, TW[3] - .2, 0xa9a7ad);
  const T3 = P.face(TW[0], TW[1], TW[2], TW[3], '+z'); T3.box(14, 0, -3, 28, 24, 1, AIR); T3.box(14, 0, -4, 28, 24, -3, 0x2f5bff); T3.box(13, 24, 0, 29, 26, 2, PAL.cream);
  T3.box(8, 28, 0, 34, 37, 1, PAL.ink); T3.text('ROOF', 21, 35, 1, 2, PAL.white, lit(0));
  const TN = P.face(TW[0], TW[1], TW[2], TW[3], '-z', ROOF); TN.box(4, 0, -3, 16, 22, 1, AIR); TN.box(4, 0, -4, 16, 22, -3, 0x6d707a);   // the roof door (a 0 at the tower's east end)
  TN.box(5, 24, 0, 15, 31, 1, 0xf7f7f2); TN.box(5, 29, 0, 15, 31, 1, RED);                                          // the house rules card nobody reads
  // the hoop: backboard flat on the tower, the rim 0.45 m out over the court, a chain net
  TN.box(20, 25, 0, 38, 36, 1, PAL.white); TN.box(25, 26, 1, 33, 31, 2, PAL.white); TN.box(26, 27, 1, 32, 30, 2, AIR); TN.box(26, 27, 1, 32, 30, 2, RED);
  for (let d = 2; d <= 6; d++) { TN.set(26, 26, d, 0xff7a1a); TN.set(31, 26, d, 0xff7a1a); } TN.box(26, 26, 6, 32, 27, 7, 0xff7a1a); for (let d = 3; d < 7; d += 2) for (let y = 22; y < 26; y++) { TN.set(27, y, d, 0xd3d4d7); TN.set(30, y, d, 0xd3d4d7); }
  // ── the half-court on the roof in front of the hoop, painted on the deck
  const [cx0, cz0, cx1, cz1] = [78.2, -111.6, 85.6, -104.2];   // (the rim hangs over x 83.0: the key is centred on it)
  P.box(cx0, ROOF - .1, cz0, cx1, ROOF, cz1, (x, y, z) => { const dx = x - 83.0, dz = z + 104.2, key = Math.abs(dx) < 1.8 && dz > -4.6;
    const line = x < cx0 + .1 || x > cx1 - .1 || z < cz0 + .1 || (key && (Math.abs(Math.abs(dx) - 1.8) < .06 || Math.abs(dz + 4.6) < .06)) || Math.abs(Math.hypot(dx, dz) - 6.4) < .06; return line ? PAL.white : key ? COURT2 : COURT; });
  // ── the level signs on Market Ave (2 · 3 · R) and the name along 3rd St
  const N = P.face(x0, z0, x1, z1, '-z');
  [[1, '2'], [2, '3'], [3, 'R']].forEach(([k, t]) => { const y = Math.round((Y(k) - SIDE) * 10); N.box(24, y + 1, 1, 34, y + 10, 2, RED); N.text(t, 29, y + 9, 2, 3, PAL.white, lit(0)); });
  const S3 = P.face(x0, z0, x1, z1, '+z'); { const y = Math.round((Y(1) - SIDE) * 10); S3.box(22, y + 1, 1, 118, y + 10, 2, YEL); S3.text('SKYLOT PARKING', 70, y + 9, 2, 3, PAL.ink, 0); }
  // the blade over the avenue: SKYLOT down a red box, on both faces, a yellow border that glows at night
  { const bx0 = 84.2, bz0 = z0 - 1.15, bz1 = z0 - .05, by0 = SIDE + 3.6, by1 = SIDE + 9.8; P.box(bx0, by0, bz0, bx0 + .3, by1, bz1, RED, lit(0));
    P.box(bx0 - .1, by0, bz0, bx0 + .4, by0 + .1, bz1, YEL, lit(1)); P.box(bx0 - .1, by1 - .1, bz0, bx0 + .4, by1, bz1, YEL, lit(1)); P.box(bx0 - .1, by0, bz0, bx0 + .4, by1, bz0 + .1, YEL, lit(1));
    P.box(bx0 + .05, by0 - .6, z0 - .3, bx0 + .25, by0, z0, PAL.iron); P.box(bx0 + .05, by1, z0 - .3, bx0 + .25, by1 + .4, z0, PAL.iron);
    for (const [side, fx0, fx1] of [['+x', bx0, bx0 + .3], ['-x', bx0, bx0 + .3]]) { const F = P.face(fx0, bz0, fx1, bz1, side, by0); [...'SKYLOT'].forEach((ch, k) => F.text(ch, (F.len >> 1), 58 - k * 9, 1, 2, YEL, lit(1))); } }
  // ── the way in on Linden St: the attendant's booth between the lanes, two striped arms, the rates over it
  { const bz = -106.6; P.box(x0 + .5, SIDE, bz - .8, x0 + 2.1, SIDE + .15, bz + .8, 0xe4e0d8); P.box(x0 + .6, SIDE + .15, bz - .7, x0 + 2.0, SIDE + 2.4, bz + .7, 0x9fd8ff, 1);
    P.box(x0 + .9, SIDE + .15, bz - .4, x0 + 1.7, SIDE + 2.4, bz + .4, AIR); P.box(x0 + .5, SIDE + 2.4, bz - .8, x0 + 2.1, SIDE + 2.6, bz + .8, RED);
    for (const [za, zb] of [[bz - 3.4, bz - .9], [bz + .9, bz + 3.4]]) { P.box(x0 + 1.2, SIDE, za < bz ? zb : za, x0 + 1.4, SIDE + 1.0, (za < bz ? zb : za) + .2, PAL.iron); P.box(x0 + 1.25, SIDE + .9, za, x0 + 1.35, SIDE + 1.0, zb, (x, y, z) => ((z * 3.3) | 0) & 1 ? RED : PAL.white); }
    const W = P.face(x0, z0, x1, z1, '-x'), y = Math.round((Y(1) - SIDE) * 10); W.box(94, y + 1, 1, 182, y + 10, 2, PAL.ink); W.text('$9 HR $30 DAY', 138, y + 9, 2, 3, YEL, lit(0));
    A.life.push({ x: kerbX(x0 + 1.3), y: SIDE + .15, z: kerbZ(bz), ry: -Math.PI / 2, act: 'clerk', seed: 2401, hand: true }); }
  // ── cars at every deck edge (seeded gaps), none in the way in or on the hangout half of the roof
  for (let k = 0; k <= 3; k++) { const y = k ? Y(k) : SIDE + .1;
    for (const [x, n] of [[79.4, 0], [82.0, 1], [84.6, 2]]) if (hash(k * 7 + n, 11, 5) > .22) carVox(P, x, y, -119.3, -1, CARS[(hash(k, n, 3) * CARS.length) | 0], 'z');
    if (k === 3) continue;
    for (const [x, n] of [[69.4, 5], [72.0, 6], [74.6, 7], [77.2, 8], [79.8, 9]]) { if (k === 0 && x < 75) continue; if (hash(k * 5 + n, 13, 5) > .25) carVox(P, x, y, -102.6, 1, CARS[(hash(k, n, 15) * CARS.length) | 0], 'z');
      if (hash(k * 3 + n, 17, 5) > .35 && !(k === 0 && x < 75)) carVox(P, x, y, -107.9, -1, CARS[(hash(n, k, 19) * CARS.length) | 0], 'z'); } }
  // ── the hangout: string lights on four poles, two couches, a grill, a speaker, crates, a lawn chair (stamped plain on the deck)
  for (const [px, pz] of [[68.6, -110.8], [77.4, -110.8], [68.6, -100.9], [77.4, -100.9], [68.6, -105.85], [77.4, -105.85]]) { P.box(px - .05, ROOF, pz - .05, px + .05, ROOF + 3.0, pz + .05, PAL.iron); P.box(px - .1, ROOF + 2.9, pz - .1, px + .1, ROOF + 3.05, pz + .1, PAL.iron); }
  const bulbs = (xa, za, xb, zb) => { for (let t = 0; t <= 1.0001; t += .025) { const x = xa + (xb - xa) * t, z = za + (zb - za) * t, sag = Math.sin(t * Math.PI) * .35; P.box(x - .03, ROOF + 2.95 - sag, z - .03, x + .03, ROOF + 3.0 - sag, z + .03, ((t * 40) | 0) % 3 ? PAL.iron : [PAL.yellow, 0xff4fa3, 0x2de2e6, 0x6cff4a][((t * 40) / 3 | 0) % 4], ((t * 40) | 0) % 3 ? 0 : 3); } };
  bulbs(68.6, -110.8, 77.4, -110.8); bulbs(68.6, -100.9, 77.4, -100.9); bulbs(68.6, -110.8, 68.6, -100.9); bulbs(77.4, -110.8, 77.4, -100.9); bulbs(68.6, -105.85, 77.4, -105.85);
  REG.strict = false; const put = (bk, rot, x, z) => stamp(bk, ctx.bank, rot, kerbX(x), ROOF, kerbZ(z));
  put(couch(0x7a3cff), 2, 71.0, -101.3); put(couch(0xe8232a), 0, 71.0, -106.9); put(milkCrate(PAL.red), 0, 70.2, -104.1); put(milkCrate(0x2f5bff), 0, 71.8, -104.1);
  put(grill(), 0, 75.6, -109.6); put(speaker(), 2, 76.2, -101.2); put(lawnChair(PAL.yellow), 3, 74.6, -104.0); REG.strict = true;
  // the kids: one shooting at the hoop, one waiting on the rebound, two on the couches, one at the speaker, one at the parapet over Linden St
  person(A, 83.0, -109.0, 0, 'shoot', 2411, ROOF); person(A, 81.2, -106.2, .6, 'arms', 2412, ROOF);
  person(A, 70.6, -101.5, Math.PI, 'sit', 2413, ROOF, { seatY: .5 }); person(A, 71.5, -106.7, 0, 'sit', 2414, ROOF, { seatY: .5 });
  person(A, 76.0, -102.2, Math.PI, 'dj', 2415, ROOF); person(A, 68.75, -108.0, -Math.PI / 2, 'lean', 2416, ROOF);
}
