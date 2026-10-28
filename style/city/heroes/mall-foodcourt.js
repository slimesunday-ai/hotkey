// MILLENNIUM MALL · THE FOOD COURT (block −6,1) · owner: the Sunny Acres / Millennium Mall agent. The east wing's roof came down over its
// south-east half and left the food court open to the sky: four stalls along its north and west sides (PRETZEL KING, TERIYAKI TOWN,
// GYRO HERO, TACO LOCO, each with its menu board gone dark), tables under faded umbrellas, stacked chairs, and in the middle the dead
// carousel — its striped canopy half fallen, one horse left on its pole (the block's gag, a striped circle from the overview).
// The wing's east and south walls are broken down to a jagged line; the rest of the wing still has its roof.
import { blockCtx } from '../engine.js';
import { GEN } from '../gen.js';
import { REG } from '../audit.js';
import { frame, AIR, TOD } from '../kit.js';
import { PAL, CV, SIDE, hash, shade } from '../style.js';
import { PART, BLD, IN } from '../districts/mall/plan.js';
import { shell, lot, crackWeeds, framed, keep } from '../districts/mall/build.js';
import { edges } from '../districts/mall.js';
import { board, cyl, ring } from '../districts/trailer/brush.js';
import * as MP from '../districts/mall/props.js';
import { trashCan } from '../props.js';

const INK = PAL.ink, WHITE = PAL.white, BONE = 0xe6e1d6, TEAL = 0x12b3a0, PURPLE = 0x7a3cff, TILE = 0xe9e2d2;
const lit = (day = 1) => TOD.night ? 3 : day;
const STALLS = [
  { name: 'PRETZEL KING', c: 0xffc21a, fg: 0x8a3a12 }, { name: 'TERIYAKI TOWN', c: 0xe8232a, fg: WHITE },
  { name: 'GYRO HERO', c: 0x2f5bff, fg: WHITE }, { name: 'TACO LOCO', c: 0x14a83b, fg: 0xffe23a },
];

export function foodCourt(bank, b, A) {
  const kit = GEN.kit, ctx = framed(blockCtx(bank, b, A, kit)), Wg = PART.wing, [ox0, oz0, ox1, oz1] = Wg.open; REG.strict = true;
  try {
    ctx.group('lot'); lot(ctx, [[Wg.x0, BLD.z0 - .4, Wg.x1 + .4, BLD.z1 + .4]]); ctx.finish(); edges(ctx); ctx.finish();
    // ── the court's floor: cream tiles where the roof fell, a few slabs of it lying there
    ctx.group('court');
    { const V = ctx.volume(ox0 + .3, SIDE, oz0 + .3, ox1 - .3, SIDE + CV, oz1 - .3, { walk: true }); V.box(0, 0, 0, V.nx, 1, V.nz, (x, y, z) => ((((x / 8) | 0) + ((z / 8) | 0)) & 1) ? TILE : hash(x, z, 3) > .93 ? 0xbfb6a2 : 0xd9d0bc); }
    ctx.finish();
    // ── the wing: roofed in the west and north, open over the court; its east and south walls broken to a jagged top
    ctx.group('wing');
    const parts = [[Wg.x0, BLD.z0, Wg.x1, oz0], [Wg.x0, oz0, ox0, BLD.z1]];
    const PINKW = 0xff4fa3, S = shell(ctx, [Wg.x0, BLD.z0, Wg.x1, BLD.z1], Wg.h, { wall: PINKW, holes: [Wg.open], pad: 14, parts }), { V, B, H } = S;
    const W = x => Math.round((x - S.o[0]) / CV), Z = z => Math.round((z - S.o[2]) / CV);   // (SPREAD: S.o, the shell's corner in frame metres)
    // the broken walls: the east and south runs of the open part, a jagged top, a gap or two, rubble at their feet (props below)
    // (a wall that came down in courses: 0.8 m panels stepping down from the roofed corner, each broken top showing the grey block core)
    const CORE = 0xa7a9b1, REBAR = 0x9a4a24, stepH = k => Math.max(8, H - 6 - k * 5 - ((k * 7 + 3) % 3) * 4);
    const brokenRun = (n0, n1, put) => { const L = n1 - n0; for (let a = 0; a < L; a++) { const k = Math.floor(a / 8), h = Math.min(H, stepH(k)), notch = (a % 8 === 7 || a % 8 === 0) && (k % 2) ? 2 : 0;
      for (let y = 0; y < h - notch; y++) put(a, y, y >= h - notch - 2 ? CORE : PINKW); } };
    brokenRun(W(ox0), W(ox1), (a, y, c) => { const x = W(ox1) - 1 - a; if (x > W(-182) && x < W(-177)) return; for (let d = 0; d < 3; d++) V.set(x, y, Z(oz1) - 3 + d, c); });   // south run, highest at the east corner
    brokenRun(Z(oz0), Z(oz1), (a, y, c) => { const z = Z(oz0) + a; if (z > Z(52) && z < Z(56)) return; for (let d = 0; d < 3; d++) V.set(W(ox1) - 3 + d, y, z, c); });   // east run, highest at the north corner
    for (const [x, z] of [[W(ox1) - 2, Z(oz0) + 20], [W(ox1) - 18, Z(oz1) - 2], [W(ox1) - 2, Z(oz0) + 44]]) { let y = 0; while (V.has(x, y, z)) y++; for (let k = 0; k < 5; k++) V.set(x + (k > 2 ? 1 : 0), y + k, z, REBAR); }
    // the inner walls round the open court (floor to roof on the roofed side), a teal band; the stalls in them
    const inner = { N: [ox0, oz0 - .3, ox1 - .3, oz0, '+z'], Wst: [ox0 - .3, oz0 - .3, ox0, oz1 - .3, '+x'] };
    for (const [x0, z0, x1, z1] of Object.values(inner)) V.box(W(x0), 0, Z(z0), W(x1), H - 3, Z(z1), BONE);
    const fr = {}; for (const [k, [x0, z0, x1, z1, side]] of Object.entries(inner)) { fr[k] = frame(V, { x0: W(x0), z0: Z(z0), x1: W(x1), z1: Z(z1) }, side); fr[k].box(0, 40, 0, fr[k].len, 44, 1, TEAL); }
    const stall = (f, a, w, st) => { f.box(a - 1, 0, 0, a + w + 1, 36, 1, INK); f.box(a, 10, -10, a + w, 30, 1, AIR); f.box(a, 0, -11, a + w, 30, -10, 0x2a2d38);
      f.box(a, 0, 0, a + w, 10, 2, st.c); f.box(a, 10, 0, a + w, 11, 3, 0xc9ced6, 2);                                             // the counter
      f.box(a + 4, 18, -10, a + w - 4, 27, -9, 0x14151a);                                                                     // the dead menu board
      for (let k = 0; k < 3; k++) f.box(a + 6, 19 + k * 3, -9, a + w - 6, 20 + k * 3, -8, shade(st.c, .5));
      f.box(a, 30, 0, a + w, 36, 2, st.c); };
    const at = []; stall(fr.N, 6, 60, STALLS[0]); at.push([fr.N, 6, 60]); stall(fr.N, 76, 60, STALLS[1]); at.push([fr.N, 76, 60]);
    stall(fr.Wst, 8, 60, STALLS[2]); at.push([fr.Wst, 8, 60]); stall(fr.Wst, 80, 56, STALLS[3]); at.push([fr.Wst, 80, 56]);
    // the lot side: the food court's own doors, boarded, and a faded swoosh
    { const N = S.F('-z'); N.box(40, 0, 0, 84, 28, 2, INK); N.box(42, 1, -1, 82, 26, 2, AIR); N.box(42, 1, -1, 82, 26, 0, (a, y) => (((a / 10) | 0) + ((y / 12) | 0)) & 1 ? 0xc8a46a : 0xb89156);
      for (let a = 100; a < 200; a++) { const y = 34 + Math.round(Math.sin((a - 100) / 100 * Math.PI) * 10); N.box(a, y, 0, a + 1, y + 3, 1, a < 150 ? TEAL : 0xffe23a); } }
    ctx.finish();
    // the carousel (its own volume, standing on the court's tiles): a round deck, the centre post, the striped cone (the north half still
    // up, the rest lying on the deck), one horse left on its pole
    { const R = 26, C0 = [-180.2, 52.6], V3 = ctx.volume(C0[0] - 2.7, SIDE + CV, C0[1] - 2.7, C0[0] + 2.7, SIDE + CV + 5.8, C0[1] + 2.7, { ground: true }), cx = V3.nx >> 1, cz = V3.nz >> 1;
      for (let x = -R; x <= R; x++) for (let z = -R; z <= R; z++) { const d = Math.hypot(x, z); if (d > R) continue; V3.box(cx + x, 0, cz + z, cx + x + 1, 3, cz + z + 1, d > R - 2 ? 0xffc21a : ((Math.atan2(z, x) * 4 / Math.PI + 8) % 2 < 1) ? 0xf2efe6 : 0xd9c9a8); }
      V3.box(cx - 2, 3, cz - 2, cx + 2, 54, cz + 2, 0xdfe3ea, 2); ring(V3, cx + .5, cz + .5, 2, 4, 39, 43, 0xffc21a, 2);
      for (let k = 0; k < 10; k++) { const r = R - k * 2.4, y = 43 + k; for (let x = -R; x <= R; x++) for (let z = -R; z <= 0; z++) { const d = Math.hypot(x, z); if (d > r || d < r - 3.2) continue; V3.set(cx + x, y, cz + z, ((Math.atan2(z, x) * 8 / Math.PI + 16) % 2 < 1) ? 0xe8232a : WHITE); } }
      for (let x = -R + 2; x < R - 2; x++) for (let z = 2; z < R - 6; z++) { const d = Math.hypot(x, z); if (d < R - 4 && d > R - 12 && hash(x >> 2, z >> 2, 7) > .55) V3.set(cx + x, 3, cz + z, ((Math.atan2(z, x) * 8 / Math.PI + 16) % 2 < 1) ? 0xe8232a : WHITE); }
      const hx = cx + 14, hz = cz - 6; V3.box(hx, 3, hz, hx + 1, 41, hz + 1, PAL.gold, 2);
      V3.box(hx - 1, 13, hz - 4, hx + 2, 18, hz + 5, WHITE); V3.box(hx - 1, 18, hz + 3, hx + 2, 23, hz + 6, WHITE); V3.box(hx - 1, 21, hz + 5, hx + 2, 24, hz + 8, WHITE); V3.box(hx - 1, 17, hz - 5, hx + 2, 20, hz - 3, 0x9a7a4a);
      for (const dz of [-3, 3]) V3.box(hx - 1, 8, hz + dz, hx + 2, 13, hz + dz + 1, WHITE); V3.box(hx - 1, 18, hz - 1, hx + 2, 19, hz + 2, 0xe8232a);
      keep(ctx, [C0[0] - 2.7, SIDE, C0[1] - 2.7, C0[0] + 2.7, SIDE + 5, C0[1] + 2.7], 'carousel'); }
    ctx.finish();
    // ── the stall names, bolted on their bands (0.05 lettering), then the court's furniture
    ctx.group('court');
    at.forEach(([f, a, w], k) => { const st = STALLS[k], [vx, vz] = f.xz(Math.round(a + w / 2), 2), rot = f === fr.N ? 0 : 1;
      const x = rot === 0 ? S.o[0] + (vx + .5) * CV : S.o[0] + vx * CV, z = rot === 0 ? S.o[2] + vz * CV : S.o[2] + (vz + .5) * CV;   // (the board's back on the band's face)
      ctx.put(board(st.name, { kind: 'sign', posts: 0, bg: st.c, fg: st.fg, clean: true, pad: 2 }), x, z, { rot, y: SIDE + 3.05, reach: 0, ignore: ['plinth'] }); });
    const put = (bk, x, z, rot = 0, ax = 1, reach = .8) => ctx.put(bk, x, z, { rot, slide: [ax, 1 - ax], reach });
    for (const [x, z, c, u] of [[-184.6, 47.2, 0x2de2e6, true], [-174.4, 47.6, 0xff4fa3, true], [-184.4, 58.6, 0xffc21a, false], [-174.8, 58.8, 0x2f5bff, true], [-186.4, 52.6, 0xe8232a, false]]) put(MP.fcTable(c, u), x, z, 0, 1, 1);
    put(trashCan(0x2f5bff), -171.2, 45.2, 0); put(trashCan(0xe8232a), -187.2, 45.4, 0);
    put(MP.rubble(21, 2), -172.4, 60.4, 0); put(MP.rubble(22, 1), -179.6, 60.8, 1); put(MP.rubble(23, 1), -171.6, 53.6, 2, 0);
    put(MP.wallChunk(0), -175.8, 63.1, 0, 1, 1.2); put(MP.wallChunk(1), -168.6, 57.8, 1, 0, 1.2);   // pink wall pieces where they fell, outside the break
    put(MP.cart(true), -166.6, 48.6, 1, 0, 1); crackWeeds(ctx);
  } finally { REG.strict = false; }
  ctx.finish();
}
