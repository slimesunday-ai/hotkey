// GLASSWALL · THE DOWNTOWN FRINGE · block −4,0 (Grand Ave & Central Ave, a parking block; Fit Street across Hazel St) · owner: the
// downtown fringe agent (batch 5).
//   SOAPBOX: a drive-through car wash on the avenue corner. A teal tunnel along Central Ave, open-sided so the street sees the brushes
//   spin (blue, red and yellow bristles, a roller overhead, a green car in the foam), strip curtains at both ends, SOAPBOX in big white
//   letters on its hot-pink fascia and, on its roof, a hot-pink car twice life size buried in soap: the west side's landmark from the
//   overview. Cars come in off Grand Ave past the pay kiosk and its menu (WASH $10 · WAX $15 · DRY $5); they come out onto Hazel St where
//   two of the crew towel one down by the vacuum posts, and somebody waits on the bench by the drink machine. Walk-ups on Washington St.
// Ids read -4_0·wash·kind·n for the car wash and -4_0·L<k>·kind·n for the generated lots.
import { fillBlock, mk, framed } from '../districts/downtown/fill.js';   // (SPREAD: authored in today's metres, the block's frame)
import { kerbX, kerbZ } from '../districts/frame.js';
import { brush, carVox, bigCar, foam, person, lit } from '../districts/downtown/lib.js';
import { blockCtx } from '../engine.js';
import { kitNow } from '../gen.js';
import { REG } from '../audit.js';
import { AIR } from '../kit.js';
import { PAL, SIDE, hash } from '../style.js';
import { bench, trashCan, car } from '../props.js';

const TUN = [-117, 6, -106, 12], TH = 4.6, TEAL = 0x12b3a0, PINK = 0xff4fa3, WHITE = 0xf7f7f2, PAVE = 0xd6d2c8, WET = 0xa9c3d6, YEL = 0xffd21f;

export function carWash(bank, b, A) {
  fillBlock(bank, b, A, { seed: 50401,
    lots: [mk(-122, 17, -115, 28, ['+z', '-x'], 'SW'), mk(-115, 17, -108, 28, ['+z']), mk(-108, 17, -100, 28, ['+z', '+x'], 'SE')],
    // (the open parts' roofY is the paving: the crew and the customers stand on it)
    heroes: [{ rect: TUN, top: SIDE + 9.0, nh: 90, group: 'wash', faces: ['-z'] }, { rect: [-122, 6, -117, 17], top: SIDE + 3.9, nh: 39, open: true, group: 'wash', faces: ['-z', '-x'], roofY: SIDE + .1 },
      { rect: [-117, 12, -106, 17], top: SIDE + 2.2, nh: 22, open: true, group: 'wash', faces: [], roofY: SIDE + .1 }, { rect: [-106, 6, -100, 17], top: SIDE + 5.0, nh: 50, open: true, group: 'wash', faces: ['-z', '+x'], roofY: SIDE + .1 }],
    build() { const ctx = framed(blockCtx(bank, b, A, kitNow())); REG.group('wash'); REG.strict = true;
      try { build(ctx, A); ctx.finish(); } finally { REG.strict = false; } } });
}

function build(ctx, A) {
  // ── the paved lot round the tunnel: drains every 1.5 m, wet by the exit, the lane arrow in from Grand Ave
  const Pv = ctx.volume(-122, SIDE, 6, -100, SIDE + .1, 17, { walk: true }), PV = brush(Pv);
  PV.box(-122, SIDE, 6, -100, SIDE + .1, 17, (x, y, z) => { if ((x > TUN[0] && x < TUN[2] && z < TUN[3]) || (x > -120.1 && x < -117.5 && z > 11.9 && z < 14.3)) return undefined;   // (not under the tunnel or the kiosk and its plinth)
    const drain = (Math.abs(((x + 122) % 1.5) - .75) < .05 && z > 6.4 && z < 11.6 && (x < -117 || x > -106)), wet = x > -106 && x < -102 && z < 12 && hash(Math.round(x * 3), Math.round(z * 3), 5) < .6;
    const arrow = z > 8.6 && z < 9.4 && x > -121.4 && x < -118.8 || (x >= -118.8 && x < -118 && Math.abs(z - 9) < (-118 - x) * .9 + .05);
    return arrow ? WHITE : drain ? 0x8f8b84 : wet ? WET : PAVE; });
  // ── the tunnel: teal, open along the avenue between four piers, the roof slab 0.6 m, open at both ends
  const T = ctx.building(TUN[0], TUN[1], TUN[2], TUN[3], { h: TH, wall: TEAL, trim: WHITE, faces: ['-z'], parapet: 3, extra: 52 }), V = T.V, B = T.B, P = brush(V), TOP = T.top;
  V.clear(B.x0, 1, B.z0 + 3, B.x1, 40, B.z1 - 3);                                                                          // the bay
  V.box(B.x0, 0, B.z0 + 3, B.x1, 1, B.z1 - 3, (x, y, z) => Math.abs(z - (B.z0 + B.z1) / 2) === 11 || Math.abs(z - (B.z0 + B.z1) / 2) === 12 ? YEL : 0x55565f);   // the floor and its track
  const N = T.F('-z'), L = N.len; for (const [a0, a1] of [[6, 34], [40, 70], [76, 104]]) N.box(a0, 6, -3, a1, 30, 1, AIR);            // the openings on Central Ave
  N.box(0, 0, 0, L, 6, 2, 0x0e8f80); N.box(0, 30, 0, L, 46, 2, PINK); N.text('SOAPBOX', L >> 1, 44, 2, 3, WHITE, lit(0), 2, 1);   // the kerb wall, the fascia, the name
  // strip curtains hanging in both ends (red, blue, yellow strips)
  for (const x of [TUN[0] + .05, TUN[2] - .15]) for (let z = 6.4, n = 0; z < 11.6; z += .2, n++) P.box(x, SIDE + 1.6 + (n % 3) * .2, z, x + .1, SIDE + 4.0, z + .1, [PAL.red, 0x2f5bff, YEL][n % 3], 1);   // (hung from the roof slab)
  // the brushes: three pairs of standing brushes in stripes, a roller overhead by the exit
  [[-114.6, 0x2f5bff], [-112.0, PAL.red], [-109.4, YEL]].forEach(([x, c], k) => { for (const z of [7.1, 10.9]) { P.cyl(x, z, .7, SIDE + .3, SIDE + 3.3, (a, y) => (((y * 5) | 0) + ((a * 2.6) | 0)) % 3 ? c : WHITE, 0);
    P.box(x - .08, SIDE + 3.3, z - .08, x + .08, SIDE + 4.0, z + .08, 0x8f949c, 2); } });
  P.box(-107.9, SIDE + 2.5, 7.4, -107.1, SIDE + 3.3, 10.6, (x, y, z) => (((z * 5) | 0) % 2) ? 0x2de2e6 : WHITE); P.box(-107.6, SIDE + 3.3, 7.4, -107.4, SIDE + 4.0, 7.6, 0x8f949c, 2); P.box(-107.6, SIDE + 3.3, 10.4, -107.4, SIDE + 4.0, 10.6, 0x8f949c, 2);
  carVox(P, -111.2, SIDE + .1, 9.0, 1, 0x25b84c, 'x'); foam(P, -112.8, 8.3, -109.6, 9.7, SIDE + 1.55, 18, 777, .6); foam(P, -106.9, 6.5, -106.1, 11.5, SIDE + .1, 10, 778, .3);
  // the roof: the giant hot-pink car in its foam (twice life size, nose to Hazel St)
  bigCar(P, -111.5, TOP, 9.0, 2, PINK); foam(P, -113.6, 7.7, -109.2, 10.3, TOP + 3.05, 46, 991, 1.1); foam(P, -107.6, 7.4, -106.6, 10.6, TOP + 1.7, 9, 992, .4);
  // ── the pay kiosk by the way in (a serving hatch to the lane, the attendant inside), the menu to Grand Ave on two posts
  const K = ctx.building(-119.8, 12.2, -117.8, 14.0, { h: 2.6, wall: WHITE, trim: PINK, faces: ['-z'], parapet: 2, extra: 8 }), KF = K.F('-z');
  K.V.clear(K.B.x0 + 1, 1, K.B.z0 + 1, K.B.x1 - 1, 24, K.B.z1 - 1); K.V.box(K.B.x0 + 1, 23, K.B.z0 + 1, K.B.x1 - 1, 24, K.B.z1 - 1, 0xfff7dc, lit(1));
  KF.box(3, 9, -1, 17, 21, 1, AIR); KF.box(2, 8, 0, 18, 9, 3, WHITE); KF.box(0, 22, 0, KF.len, 26, 3, PINK);
  A.life.push({ x: kerbX(-118.8), y: SIDE, z: kerbZ(13.2), ry: Math.PI, act: 'clerk', seed: 4001, hand: true });
  const M = ctx.volume(-122, SIDE + .1, 12.2, -121.4, SIDE + 3.9, 17), MP = brush(M);
  for (const z of [12.5, 16.5]) MP.box(-121.7, SIDE + .1, z, -121.5, SIDE + 1.0, z + .2, PAL.iron);
  MP.box(-121.8, SIDE + 1.0, 12.3, -121.5, SIDE + 3.9, 16.9, PINK); MP.box(-121.8, SIDE + 1.1, 12.4, -121.7, SIDE + 3.8, 16.8, WHITE, lit(0));
  const MF = MP.face(-121.8, 12.3, -121.5, 16.9, '-x', SIDE + 1.0); [['WASH $10', 26], ['WAX $15', 17], ['DRY $5', 8]].forEach(([t, y]) => MF.text(t, MF.len >> 1, y, 1, 2, PAL.ink, 0));
  // ── the way out onto Hazel St: the crew towelling a car down; the waiting side: a bench, a bin, the drink machine
  ctx.put(car(23), -103.2, 9.0, { rot: 1, reach: .4 });
  person(A, -103.8, 7.35, 0, 'arms', 4011); person(A, -102.4, 10.65, Math.PI, 'arms', 4012);
  ctx.put(bench(), -111.6, 16.35, { rot: 2, reach: .4 }); ctx.put(trashCan(0x2f5bff), -109.5, 16.4, { reach: .4 });
  person(A, -111.4, 16.3, Math.PI, 'sit', 4013, SIDE, { seatY: .5 }); person(A, -107.0, 15.7, -.4, 'phone', 4014);
  // the air over the lot (from 0.1 m up, clear of the paving): the vacuum posts, the drink machine, the bunting, the tube man
  const Air = ctx.volume(-122, SIDE + .1, 6, -100, SIDE + 5.2, 17), Q = brush(Air), y0 = SIDE + .1;
  for (const x of [-105.2, -101.8]) { Q.box(x, y0, 15.9, x + .6, y0 + 1.5, 16.4, YEL); Q.box(x + .1, y0 + 1.1, 15.85, x + .5, y0 + 1.4, 15.9, PAL.ink);
    for (let t = 0; t <= 1; t += .02) { const hx = x + .3 + Math.sin(t * Math.PI) * .5, hy = y0 + 1.45 - t * 1.4 + Math.sin(t * Math.PI) * .3; Q.box(hx - .05, hy - .05, 15.8, hx + .05, hy + .05, 15.9, PAL.ink); } }   // (the hose hangs off the post to the ground)
  Q.box(-108.8, y0, 12.05, -108.0, y0 + 1.9, 12.7, PAL.red); Q.box(-108.7, y0 + .6, 12.7, -108.1, y0 + 1.7, 12.8, 0xfff3c4, lit(1)); Q.box(-108.7, y0 + .2, 12.7, -108.1, y0 + .4, 12.8, PAL.ink);
  // bunting between four poles (a string of pennants, every 0.1 m of it touching the next, so it hangs off its poles)
  const bunting = (xa, ya, za, xb, yb, zb) => { const len = Math.hypot(xb - xa, yb - ya, zb - za), n = Math.ceil(len / .07);
    for (let q = 0; q <= n; q++) { const t = q / n, x = xa + (xb - xa) * t, z = za + (zb - za) * t, y = ya + (yb - ya) * t - Math.sin(t * Math.PI) * .45; Q.box(x - .05, y - .05, z - .05, x + .05, y + .05, z + .05, PAL.iron);
      if (q % 5 || q === 0 || q === n) continue; const c = [PAL.red, YEL, 0x2f5bff, PAL.green][(q / 5) % 4];
      for (let k = 0; k < 3; k++) Q.box(x - .15 + k * .05, y - .1 - k * .1, z - .05, x + .15 - k * .05, y - k * .1, z + .05, c); } };
  for (const [x, z, h] of [[-120.2, 12.1, 3.2], [-117.5, 6.2, 5.0], [-105.5, 6.2, 5.0], [-100.6, 16.4, 4.4]]) Q.box(x - .1, y0, z - .1, x + .1, y0 + h, z + .1, PAL.iron);
  bunting(-120.2, y0 + 3.1, 12.1, -117.5, y0 + 4.9, 6.2); bunting(-105.5, y0 + 4.9, 6.2, -100.6, y0 + 4.3, 16.4);
  // the inflatable tube man at the corner of Grand & Central: red, arms up, a face (drawn in the air volume, his feet on his blower)
  Q.box(-121.6, y0, 6.3, -121.0, y0 + .3, 6.9, PAL.ink); for (let y = .3; y < 3.8; y += .1) { const sway = Math.sin(y * 1.7) * .22; Q.box(-121.55 + sway, y0 + y, 6.35, -121.05 + sway, y0 + y + .1, 6.85, PAL.red); }
  const hs = Math.sin(3.7 * 1.7) * .22; Q.box(-121.5 + hs, y0 + 3.2, 6.34, -121.4 + hs, y0 + 3.3, 6.35, WHITE); Q.box(-121.2 + hs, y0 + 3.2, 6.34, -121.1 + hs, y0 + 3.3, 6.35, WHITE); Q.box(-121.45 + hs, y0 + 2.95, 6.34, -121.15 + hs, y0 + 3.0, 6.35, PAL.ink);
  for (const [dir, ya] of [[-1, 2.6], [1, 2.4]]) for (let t = 0; t < 1; t += .1) { const ax = -121.3 + Math.sin(2.5 * 1.7) * .22 + dir * (.25 + t * .9), ay = y0 + ya + t * (dir < 0 ? .9 : .4) + Math.sin(t * 5) * .1; Q.box(ax - .1, ay - .1, 6.45, ax + .1, ay + .1, 6.75, PAL.red); }
}
