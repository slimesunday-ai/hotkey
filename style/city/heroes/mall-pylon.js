// MILLENNIUM MALL · THE PYLON (block −6,0) · owner: the Sunny Acres / Millennium Mall agent. The first thing you see of the mall from
// downtown: a 1999 pylon at Central Ave and Elm St — two silver legs, a purple cabinet, a silver globe in an orbit ring on top. The east
// face still says M LLENNIUM / MA L, the U hanging off its bolts; three letters still light up at night. Two of the fallen letters lie
// on the asphalt at its foot. The west face was gutted to the tubes. Below the name, the tenant panels: FOOD COURT (still lit), CINEMA
// 8, one blank, one smashed. Jersey barriers close the Elm St driveway; the guard booth by it has no glass left.
import { blockCtx } from '../engine.js';
import { GEN } from '../gen.js';
import { REG } from '../audit.js';
import { TOD } from '../kit.js';
import { PAL, CV, SIDE, hash, shade } from '../style.js';
import { PYLON, IN } from '../districts/mall/plan.js';
import { lot, spine, lotLife, crackWeeds, vanCamp, framed, keep } from '../districts/mall/build.js';
import { edges } from '../districts/mall.js';
import { txtX, tw, tm, cyl, ring, M, pv, done, txt } from '../districts/trailer/brush.js';
import * as MP from '../districts/mall/props.js';
import { burnBarrel } from '../districts/trailer/props.js';

const INK = PAL.ink, WHITE = PAL.white, PURPLE = 0x7a3cff, TEAL = 0x12b3a0, SILVER = 0xc9ced6, PINK = 0xff4fa3;
const lit = (day = 1) => TOD.night ? 3 : day;
// the guard booth (0.05 grain): a square kiosk, no glass, GUARD on its band
const booth = () => M('guardbooth', 'booth', () => { const V = pv(34, 56, 34, 17, 17, .05); V.box(1, 0, 1, 33, 2, 33, 0x9a9ca4); V.box(2, 2, 2, 32, 46, 32, 0xe6e1d6);
  for (const [a0, a1] of [[6, 28]]) for (const f of [0, 1, 2, 3]) { const box = [[a0, 20, 31, a1, 40, 33], [a0, 20, 1, a1, 40, 3], [31, 20, a0, 33, 40, a1], [1, 20, a0, 3, 40, a1]][f]; V.box(...box, -1); }
  V.box(3, 20, 3, 31, 21, 31, 0x3a3d45); V.box(1, 41, 1, 33, 50, 33, TEAL); V.box(0, 50, 0, 34, 52, 34, 0xd9d6ce); txt(V, 'GUARD', 17 - (tw('GUARD') >> 1), 48, 33, WHITE); V.box(12, 2, 32, 22, 19, 33, 0x2a2d38);
  return done(V, 'booth'); });

export function mallPylon(bank, b, A) {
  const kit = GEN.kit, ctx = framed(blockCtx(bank, b, A, kit)); REG.strict = true;   // (SPREAD: frame metres, mall/build.js framed)
  try {
    ctx.group('lot'); lot(ctx); ctx.finish(); spine(ctx); edges(ctx); ctx.finish();
    // ── THE PYLON: a concrete planter base, two silver legs, the tenant panels, the name cabinet, the globe in its ring
    ctx.group('pylon');
    const px = PYLON.x, pz = PYLON.z, V = ctx.volume(px - 1.5, SIDE + CV, pz - 3.7, px + 1.5, SIDE + CV + 17, pz + 3.7, { ground: false }), cx = V.nx >> 1, cz = V.nz >> 1, X = x => cx + x, Z = z => cz + z;
    V.box(X(-12), 0, Z(-34), X(12), 5, Z(34), 0xb8b3a8); V.box(X(-11), 5, Z(-33), X(11), 6, Z(33), 0x6b4a2a); for (let z = -31; z < 31; z += 4) V.box(X(-6 + (z % 7)), 6, Z(z), X(-4 + (z % 7)), 8 + ((z * 7) & 3), Z(z + 2), 0x8a9a3a);
    for (const z of [-35, 29]) V.box(X(-3), 0, Z(z), X(3), 150, Z(z + 6), SILVER, 2);
    // tenant panels between the legs (broad faces east and west); lettering on the east face only
    const panels = [{ y: 30, s: 'FOOD COURT', bg: WHITE, fg: 0xe8232a, on: true }, { y: 44, s: 'CINEMA 8', bg: WHITE, fg: 0x2f5bff }, { y: 58, bg: WHITE }, { y: 72, bg: 0x2a2d38, smashed: true }];
    for (const p of panels) { V.box(X(-2), p.y, Z(-29), X(2), p.y + 12, Z(29), 0x9a9ca4, 2); V.box(X(-2), p.y + 1, Z(-28), X(2), p.y + 11, Z(28), p.bg, p.on ? lit() : 0);
      if (p.smashed) for (let z = -28; z < 28; z++) for (let y = 1; y < 11; y++) if (hash(z, y, 3) > .7) V.box(X(-2), p.y + y, Z(z), X(2), p.y + y + 1, Z(z + 1), (z + y) % 3 ? 0xdfe2e8 : 0x9fd8ff);
      if (p.s) txtX(V, p.s, Z(-(tw(p.s) >> 1)), p.y + 9, X(2), p.fg, p.on ? lit(0) : 0, 1); }
    // the name cabinet: purple, a teal band; the east face M LLENNIUM / MAL (the U askew, three letters still lit); the west face gutted
    const cy0 = 88, cy1 = 124; V.box(X(-3), cy0, Z(-32), X(3), cy1, Z(32), PURPLE); V.box(X(-3), cy0, Z(-32), X(3), cy0 + 3, Z(32), TEAL); V.box(X(-3), cy1 - 2, Z(-32), X(3), cy1, Z(32), SILVER, 2);
    { const x = X(3), line1 = 'MILLENNIUM', line2 = 'MALL', t1 = tm(line1), t2 = tm(line2), BOARD = 0x2a1d5a, GHOST = 0x6a5c9e, DEAD = 0x9c93b4;
      V.box(x, cy0 + 4, Z(-31), x + 1, cy1 - 3, Z(31), BOARD);
      // letter by letter: 'on' (the neon still works: pink, glowing at night), 'dead' (tubes gone dark: dull lavender, never lit),
      // 'gone' (fell off: the cabinet stayed dark where it hung, so a sun-bleached ghost of it shows on the board, bolt holes and all)
      const draw = (t, s, z0, ytop, state) => { let off = 0; V.recNext(); for (let n = 0; n < s.length; n++) { const g = tm(s[n]), st = state[n];
          for (let j = 0; j < 7; j++) for (let i = 0; i < g.w; i++) if (g.at(i, j)) { const zz = z0 + (t.w - 1 - (off + i)), y = ytop - j;
            if (st === 'gone') { V.set(x, y, zz, GHOST); continue; }
            V.set(x + 1, y, zz, st === 'on' ? PINK : DEAD, st === 'on' ? lit(0) : 0); V.recN(s, x + 1, y, zz, 1, 0); }
          if (st === 'gone') for (const j of [0, 6]) V.set(x, ytop - j, z0 + (t.w - 1 - (off + (g.w >> 1))), 0x14101f);   // the bolt holes
          off += g.w + 1; } };
      draw(t1, line1, Z(-(t1.w >> 1)), cy1 - 6, ['on', 'gone', 'dead', 'dead', 'on', 'on', 'dead', 'dead', 'dead', 'on']);
      draw(t2, line2, Z(-(t2.w >> 1)), cy1 - 17, ['on', 'on', 'dead', 'gone']); }
    { const x = X(-4); V.box(x, cy0 + 4, Z(-31), x + 1, cy1 - 3, Z(31), 0x3a3d45); for (let z = -28; z < 29; z += 8) V.box(x - 1, cy0 + 6, Z(z), x, cy1 - 5, Z(z + 1), 0xeff3f6, 1); }
    // the globe on top in its tilted orbit ring (the Y2K bit)
    const gy = cy1 + 16, gr = 10; for (let x = -gr; x <= gr; x++) for (let y = -gr; y <= gr; y++) for (let z = -gr; z <= gr; z++) if (x * x + y * y + z * z <= gr * gr) V.set(X(x), gy + y, Z(z), ((y + gr) >> 2) % 2 ? SILVER : 0xdfe3ea, 2);
    V.box(X(-2), cy1, Z(-2), X(2), gy - gr + 1, Z(2), SILVER, 2);
    for (let a = 0; a < 240; a++) { const t = a / 240 * Math.PI * 2, x = Math.round(Math.sin(t) * 9), z = Math.round(Math.cos(t) * 20), y = gy + Math.round(Math.cos(t) * 5); V.box(X(x), y, Z(z), X(x) + 1, y + 1, Z(z) + 1, TEAL, 2); }
    keep(ctx, [px - 1.3, SIDE, pz - 3.6, px + 1.3, SIDE + 17, pz + 3.6], 'pylon');
    ctx.finish();
    // ── at its foot: the fallen letters; along Elm St: jersey barriers across the driveway, the guard booth; the lot's usual wreckage
    const put = (bk, x, z, rot = 0, ax = 1, reach = 1) => ctx.put(bk, x, z, { rot, slide: [ax, 1 - ax], reach });
    put(MP.fallenLetter('I', 0xd9d4e8), px - 2.4, pz + 1.2, 1, 0); put(MP.fallenLetter('L', 0xd9d4e8), px + 2.0, pz - 1.4, 2, 0); put(MP.cone(), px + 2.2, pz + 2.2);
    for (const z of [10.2, 12.4, 14.6, 16.8, 19.0, 21.2]) put(MP.jersey(z > 15 ? 0xff7a1a : 0), IN.x1 - 1.4, z, 1, 0, .4);
    put(booth(), -167.6, 27.4, 3, 0, 1); put(burnBarrel(), -169.6, 25.2, 0, 1, .6); put(MP.lotLight(0, true), -176, 20.5, 0, 1, 1);
    lotLife(ctx, { cars: [[-184, 17.6, 1, 'burnt']], carts: [[-176, 26, 2], [-186.6, 9.6, 1], [-170.5, 18.4, 0]], corral: [-181, 26.6, 1] });
    vanCamp(ctx); crackWeeds(ctx);
  } finally { REG.strict = false; }
  ctx.finish();
}
