// MILLENNIUM MALL · THE ATRIUM (block −7,1) · owner: the Sunny Acres / Millennium Mall agent. The sim's dig site (salts, cloth) at
// (−208, 49): the concourse's atrium roof came down and the scavengers dig where the fountain court was. From the lot you look straight
// in through the fallen entrance (the Y2K clock over it stuck at 00:00) past the dry fountain into the court: shopfronts under
// roll-down gates and liquidation banners, a balcony ring with half its glass gone, two escalators climbing to a floor that isn't
// there, the skylight's steel skeleton overhead. The dig itself keeps the sim's pile squares bare; round them: work lights on
// tripods (the only lights on at night), wheelbarrows, a sieve, shovels in the dirt, buckets, tarp shelters, caution tape.
import { blockCtx } from '../engine.js';
import { GEN } from '../gen.js';
import { REG } from '../audit.js';
import { frame, win, AIR, TOD } from '../kit.js';
import { PAL, CV, SIDE, hash, shade } from '../style.js';
import { PART, BLD, SITE, DIG } from '../districts/mall/plan.js';
import { shell, lot, framed, keep } from '../districts/mall/build.js';
import { txt, tw, mix, line } from '../districts/trailer/brush.js';
import * as MP from '../districts/mall/props.js';

const INK = PAL.ink, WHITE = PAL.white, BONE = 0xe6e1d6, TEAL = 0x12b3a0, PURPLE = 0x7a3cff, RED = 0xe8232a, GLASS = 0x9fd8e8, TERRAZZO = 0xe9e2d2;
const lit = (day = 1) => TOD.night ? 3 : day;
// the sim's pile squares (salts, cloth, the spill), kept bare and clear
const PILES = [[SITE.x - 2.7, SITE.z, 0], [SITE.x + 2.7, SITE.z, 0], [SITE.x + 4.6, SITE.z + 2.2, 1]].map(([x, z]) => [x - 1.75, z - 1.75, x + 1.75, z + 1.75]);

export function mallAtrium(bank, b, A) {
  const kit = GEN.kit, ctx = framed(blockCtx(bank, b, A, kit)), C = PART.concourse, [hx0, hz0, hx1, hz1] = C.hole, [cx0, cz0, cx1, cz1] = C.corridor; REG.strict = true;
  try {
    ctx.group('lot'); lot(ctx, [[C.x0, BLD.z0 - .8, C.x1, BLD.z1 + .4]]); ctx.finish();
    // ── the floor of the court and the corridor: terrazzo, dug-up earth round the pile squares, the squares themselves bare
    ctx.group('atrium');
    { const x0 = hx0 + .3, z0 = cz0 + .3, V = ctx.volume(x0, SIDE, z0, hx1 - .3, SIDE + CV, hz1 - .3, { walk: true }), inT = (x, z) => ((x >= hx0 + .3 && x < hx1 - .3 && z >= hz0 + .3) || (x >= cx0 + .3 && x < cx1 - .3)) && !(x < hx0 + 2.6 && z > 46.8 && z < 55.4);   // (not under the escalators)
      V.box(0, 0, 0, V.nx, 1, V.nz, (x, y, z) => { const wx = x0 + (x + .5) * CV, wz = z0 + (z + .5) * CV; if (!inT(wx, wz)) return undefined;
        for (const q of PILES) if (wx >= q[0] - .1 && wx < q[2] + .1 && wz >= q[1] - .1 && wz < q[3] + .1) return undefined;
        if (wx > DIG[0] - .8 && wx < DIG[2] + .8 && wz > DIG[1] - .8 && wz < DIG[3] + .6) return hash(Math.floor(wx / .3), Math.floor(wz / .3), 5) > .7 ? 0x7a5a36 : 0x8f6b42;
        const n = hash(Math.floor(wx / .7), Math.floor(wz / .7), 13);
        if (n > .9) return 0x8f9aa6;                                                                   // a puddle under the open roof
        if (n < .12) return hash(x, z, 4) > .5 ? 0x9a8f7c : 0xa89c86;                                   // grime, roof grit
        return ((Math.floor(wx / 1.2) + Math.floor(wz / 1.2)) & 1) ? 0xd6ccb6 : hash(x, z, 9) > .9 ? 0xb8ad96 : 0xc8bda6; }); }
    ctx.finish();
    // ── the concourse: a hollow shell open over the court and the corridor (the entrance fell in)
    const parts = [[C.x0, BLD.z0, hx0, BLD.z1], [hx1, BLD.z0, C.x1, BLD.z1], [hx0, BLD.z0, cx0, hz0], [cx1, BLD.z0, hx1, hz0], [hx0, hz1, hx1, BLD.z1]];
    const S = shell(ctx, [C.x0, BLD.z0, C.x1, BLD.z1], C.h, { wall: TEAL, holes: [C.hole, C.corridor], pad: 18, extra: 26, parts }), { V, B, H } = S;
    const W = x => Math.round((x - S.o[0]) / CV), Z = z => Math.round((z - S.o[2]) / CV), N = S.F('-z'), So = S.F('+z');   // (SPREAD: S.o, the shell's corner in frame metres)
    for (const f of [N, So, S.F('-x'), S.F('+x')]) { f.box(0, 44, 0, f.len, 48, 1, PURPLE); f.box(0, H - 4, 0, f.len, H - 2, 2, WHITE); }
    // the entrance: two purple piers, the torn arch, and the clock that stopped at the millennium (north face: a runs from the east end)
    const aN = x => B.x1 - W(x);
    { const a0 = aN(cx1), a1 = aN(cx0); for (const a of [a0 - 8, a1]) { N.box(a, 0, 0, a + 8, H + 8, 6, PURPLE); N.box(a + 1, 0, 6, a + 7, 4, 7, shade(PURPLE, .8)); }
      for (let a = a0 - 8; a < a1 + 8; a++) { const t = (a - a0 + 8) / (a1 - a0 + 16), y = H + 4 + Math.round(Math.sin(t * Math.PI) * 6); if (t > .74 && t < .86) continue; N.box(a, y, 1, a + 1, y + 3, 5, PURPLE); }
      const ca = ((a0 + a1) >> 1) - 16; N.box(ca, H + 13, 1, ca + 32, H + 26, 4, INK); N.box(ca - 1, H + 12, 1, ca + 33, H + 13, 4, 0x9a9ca4, 2); N.text('00:00', ca + 16, H + 23, 4, 5, RED, lit(0), 1, 1);
      for (const a of [ca + 4, ca + 26]) N.box(a, H + 9, 1, a + 2, H + 12, 3, 0x9a9ca4, 2); }
    // the lot side's papered shopfronts: LAST DAYS east of the doors, STORE CLOSING to the west
    for (const [a, s, bg] of [[14, 'LAST DAYS', WHITE], [null, 'STORE CLOSING', 0xffe23a]]) { const w = Math.max(76, tw(s) + 14), a0 = a ?? N.len - 14 - w;
      N.box(a0 - 1, 4, 0, a0 + w + 1, 30, 2, INK); N.box(a0, 5, -1, a0 + w, 29, 1, (aa, y) => ((aa * 3 + y) % 17 < 9) ? 0xe8dcc0 : 0xd6c8a8);   // papered glass
      N.box(a0 + 3, 31, 1, a0 + w - 3, 41, 2, bg); N.text(s, a0 + (w >> 1), 39, 2, 3, RED, 0, 1, 1); }
    // ── the court's inner walls (floor to roof), shopfronts on them, the balcony ring, the upper floor's glass
    // the walls round the court and the corridor, just outside the open roof, floor to roof: they close off the dark hollow
    const inner = { W: [hx0 - .3, hz0, hx0, hz1, '+x'], E: [hx1, hz0, hx1 + .3, hz1, '-x'], S: [hx0 - .3, hz1, hx1 + .3, hz1 + .3, '-z'], Nw: [hx0 - .3, hz0 - .3, cx0, hz0, '+z'], Ne: [cx1, hz0 - .3, hx1 + .3, hz0, '+z'],
      Cw: [cx0 - .3, BLD.z0 + .3, cx0, hz0 - .3, '+x'], Ce: [cx1, BLD.z0 + .3, cx1 + .3, hz0 - .3, '-x'] };
    for (const [x0, z0, x1, z1] of Object.values(inner)) V.box(W(x0), 0, Z(z0), W(x1), H - 3, Z(z1), BONE);
    const walls = {}; for (const [k, [x0, z0, x1, z1, side]] of Object.entries(inner)) walls[k] = frame(V, { x0: W(x0), z0: Z(z0), x1: W(x1), z1: Z(z1) }, side);
    for (const k of ['W', 'E', 'S', 'Nw', 'Ne']) walls[k].box(0, 40, 0, walls[k].len, 47, 1, 0x2a3354);                       // the upper floor's glass
    const shop = (f, a, w, o) => { f.box(a - 1, 0, 0, a + w + 1, 33, 1, o.frame ?? 0x6d707a); f.box(a, 1, -8, a + w, 30, 1, AIR); f.box(a, 1, -9, a + w, 30, -8, 0x14151a);
      if (o.gate) f.box(a, o.gate, -1, a + w, 30, 0, (aa, y) => y % 2 ? 0xa7a9b1 : 0x8f9096, 2);
      f.box(a, 30, 0, a + w, 34, 2, o.band ?? 0x3a3d45); };
    shop(walls.W, 6, 46, { gate: 1 }); shop(walls.W, 62, 40, { gate: 12 }); shop(walls.W, 108, 30, { gate: 20, band: TEAL });
    shop(walls.E, 8, 40, { gate: 1 }); shop(walls.E, 56, 42, { gate: 6, band: PURPLE }); shop(walls.E, 104, 34, { gate: 1 });
    shop(walls.S, 10, 44, { gate: 1 }); shop(walls.S, 64, 32, {}); shop(walls.S, 104, 46, { gate: 16 });
    shop(walls.Nw, 6, 24, { gate: 1 }); shop(walls.Ne, 6, 24, { gate: 10 });
    // the liquidation banners across the court walls (vinyl, one line each)
    const banner = (f, a, s, bg, fg, y = 50) => { const w = tw(s) + 8; f.box(a, y - 10, 0, a + w, y + 1, 1, bg); f.box(a, y - 10, 0, a + w, y - 9, 1, fg); f.text(s, a + 4, y - 1, 1, 2, fg, 0); for (const aa of [a, a + w - 1]) f.box(aa, y + 1, 0, aa + 1, y + 4, 1, 0x9a9ca4); };
    banner(walls.S, 20, 'EVERYTHING MUST GO', 0xffe23a, RED, 60); banner(walls.W, 40, '70% OFF', RED, WHITE, 60); banner(walls.E, 30, 'LIQUIDATION', WHITE, 0x2f5bff, 60);
    // the balcony ring at 3.5 m, 1.4 m deep, its glass rail; a whole run gone on the west where the escalators arrive
    { const y = 35, d = 14; for (const [x0, z0, x1, z1] of [[hx0, hz0, hx0 + 1.4, hz1], [hx1 - 1.4, hz0, hx1, hz1], [hx0, hz1 - 1.4, hx1, hz1], [hx0, hz0, cx0, hz0 + 1.4], [cx1, hz0, hx1, hz0 + 1.4]]) {
        for (let x = W(x0); x < W(x1); x++) for (let z = Z(z0); z < Z(z1); z++) { const wx = S.o[0] + (x + .5) * CV, wz = S.o[2] + (z + .5) * CV;
          if (wx < hx0 + 1.4 && wz > 44.5 && wz < 55.2) continue;                                                      // (the broken west run)
          if (wx > hx1 - 1.4 && wz > 49 && wz < 52 && hash(x >> 1, z >> 1, 4) > .5) continue;                            // (a ragged bite on the east)
          V.box(x, y, z, x + 1, y + 3, z + 1, (xx, yy) => yy === y ? 0xb9b5aa : 0xd9d4c8);
          const inner = (wx < hx0 + 1.5 && wx > hx0 + 1.3) || (wx > hx1 - 1.5 && wx < hx1 - 1.3) || (wz > hz1 - 1.5 && wz < hz1 - 1.3) || (wz < hz0 + 1.5 && wz > hz0 + 1.3);
          if (inner && hash(x >> 3, z >> 3, 7) > .35) V.box(x, y + 3, z, x + 1, y + 13, z + 1, (xx, yy) => yy === y + 12 ? 0x9a9ca4 : GLASS, 1); } } }
    // the escalators on the west side: two flights rising north from the floor to where the balcony was, and stopping in the air
    for (const [x0, rail] of [[hx0 + .25, 0x3a3d45], [hx0 + 1.45, 0x3a3d45]]) { const X = W(x0), zb = Z(55.0), zt = Z(47.2), run = zb - zt;
      for (let k = 0; k <= run; k++) { const z = zb - k, y = Math.round(k * 34 / run); V.box(X, Math.max(0, y - 3), z, X + 10, y + 1, z + 1, (xx, yy) => yy === y ? 0x6d707a : 0x9a9ca4, 2);
        for (const xr of [X, X + 9]) { V.box(xr, y + 1, z, xr + 1, y + 8, z + 1, 0xcfe8ee, 1); V.box(xr, y + 8, z, xr + 1, y + 9, z + 1, rail); } } }
    // the skylight's skeleton: the ring on the roof edge, two ridges still up, purlins, a few panes of glass left
    { const y0 = H, top = H + 18, px = W((hx0 + hx1) / 2), pz = Z((hz0 + hz1) / 2), I = 0x2a2d38;
      for (let x = W(hx0); x < W(hx1); x++) for (const z of [Z(hz0), Z(hz1) - 1]) V.box(x, y0 - 1, z, x + 1, y0 + 1, z + 1, I);
      for (let z = Z(hz0); z < Z(hz1); z++) for (const x of [W(hx0), W(hx1) - 1]) V.box(x, y0 - 1, z, x + 1, y0 + 1, z + 1, I);
      for (const [ex, ez] of [[W(hx0), Z(hz0)], [W(hx1) - 1, Z(hz0)]]) line(V, ex, y0, ez, px, top, pz, I);
      for (let k = 1; k < 4; k++) { const t = k / 4, y = Math.round(y0 + (top - y0) * t), zz = Math.round(Z(hz0) + (pz - Z(hz0)) * t); for (let x = Math.round(W(hx0) + (px - W(hx0)) * t); x <= Math.round(W(hx1) - 1 + (px - W(hx1) + 1) * t); x++) V.set(x, y, zz, I); }
      for (const k of [1, 2]) { const t = k / 4, y = Math.round(y0 + (top - y0) * t), zz = Math.round(Z(hz0) + (pz - Z(hz0)) * t); for (let x = px + 4; x < px + 26; x++) if (((x >> 2) & 1) === 0) V.box(x, y - 3, zz, x + 1, y, zz + 1, 0x7fd2d8, 1); } }
    // the roof around the court: HVAC units (one pushed over), stains, debris
    for (const [x, z] of [[-221, 38], [-196, 38], [-221, 59], [-195.5, 59.5]]) { const vx = W(x), vz = Z(z); V.box(vx, H, vz, vx + 24, H + 11, vz + 16, 0xe6e6ea); V.box(vx + 2, H + 11, vz + 2, vx + 22, H + 12, vz + 14, 0xbdbdc4); }
    for (let x = B.x0 + 3; x < B.x1 - 3; x++) for (let z = B.z0 + 3; z < B.z1 - 3; z++) if (!S.inHole(x, z) && hash(x >> 3, z >> 3, 21) > .86 && V.has(x, H - 1, z)) V.set(x, H - 1, z, 0xb9b5aa);
    ctx.finish();
    // ── the dry fountain in the corridor: a teal tiled basin, coins, a cart somebody pushed in
    ctx.group('fountain');
    { const fx = (cx0 + cx1) / 2, fz = 38.2, R = 1.7, V2 = ctx.volume(fx - R - .1, SIDE + CV, fz - R - .1, fx + R + .1, SIDE + CV + 1.6, fz + R + .1, { walk: true, ground: false }), c = V2.nx / 2;
      for (let x = 0; x < V2.nx; x++) for (let z = 0; z < V2.nz; z++) { const d = Math.hypot(x + .5 - c, z + .5 - c) * CV; if (d > R) continue;
        if (d > R - .25) V2.box(x, 0, z, x + 1, 5, z + 1, (xx, y) => y === 4 ? 0xe9e2d2 : ((x + z + y) & 1) ? TEAL : shade(TEAL, .85));
        else { V2.set(x, 0, z, hash(x, z, 3) > .93 ? PAL.gold : 0x8fb7b0); if (d < .25) V2.box(x, 1, z, x + 1, 13, z + 1, (xx, y) => y === 12 ? 0xe9e2d2 : TEAL); } }
      keep(ctx, [fx - R, SIDE, fz - R, fx + R, SIDE + 1.4, fz + R], 'fountain'); }
    ctx.finish();
    // ── the dig: the pile squares stay bare; round them the scavengers' kit
    ctx.group('dig');
    for (const q of PILES) keep(ctx, [q[0], SIDE, q[1], q[2], SIDE + 2.8, q[3]], 'pile');
    keep(ctx, [hx0, SIDE, 46.8, hx0 + 2.45, SIDE + 4.4, 55.4], 'escalator');
    const put = (bk, x, z, rot = 0, ax = 1, reach = .6) => ctx.put(bk, x, z, { rot, slide: [ax, 1 - ax], reach });
    // the north band (where you walk in): a tarp shelter, two work lights, a barrow, a shovel, buckets, the tape
    put(MP.tarpShelter(0x2f6bdf), -202.4, 43.7, 2); put(MP.workLight(), -212.8, 45.6, 1); put(MP.workLight(), -200.8, 45.9, 3);
    put(MP.wheelbarrow(0xe8232a), -206.6, 45.9, 1); put(MP.shovel(1), -207.9, 46.3, 0); put(MP.bucket(0xff7a1a), -209.2, 46.0); put(MP.bucket(0xf7f7f2), -213.1, 47.4, 0, 0);
    put(MP.tapeRun(3.6), -211.3, 44.9, 0); put(MP.tapeRun(3.0), -205.2, 44.6, 0);
    // the south band: the sieve, the other barrow, buckets, the generator, two more lights, tape; a shovel standing in the earth
    put(MP.workLight(), -212.6, 55.5, 1); put(MP.workLight(), -201.2, 55.3, 3); put(MP.generator(), -203.8, 55.6, 2); put(MP.sieve(), -208.4, 53.8, 0);
    put(MP.wheelbarrow(0x2f5bff), -210.6, 54.6, 3); put(MP.bucket(0x2f5bff), -205.4, 54.4); put(MP.bucket(0x25b84c), -206.3, 54.9); put(MP.shovel(0), -202.2, 48.2, 3, 0);
    put(MP.tapeRun(4.0), -207.4, 55.9, 0);
    // the corridor: the debris where the entrance roof came down, carts dumped by the fountain
    put(MP.rubble(11, 1), -210.9, 40.8, 0); put(MP.rubble(12, 1), -205.2, 41.0, 1); put(MP.cart(false), -205.4, 36.2, 3, 0, 1); put(MP.cart(true), -210.6, 36.0, 1, 0, 1);
    // on the front walk: the planters that are left, a cart corral missing its carts
    ctx.group('front');
    put(MP.planter(0), -219.5, 32.9, 0, 1, 1.5); put(MP.planter(1), -196.8, 32.9, 0, 1, 1.5);
  } finally { REG.strict = false; }
  ctx.finish();
}
