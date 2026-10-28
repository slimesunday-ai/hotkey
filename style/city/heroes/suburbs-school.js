// PLEASANTVIEW · P.S. 280 (block 3,7; the plan's second green, no sim lots) · owner: the Pleasantview section agent. The neighbourhood
// public school, New York style: three storeys of brick with limestone trim along Willow St, P.S. 280 in raised letters over the doors,
// tall classroom windows, a cornice; behind it the schoolyard, all asphalt and paint (a baseball diamond with its backstop, a half court,
// hopscotch, four-square), a climbing dome, benches along the wall, the yellow bus in its bay by the Maple St gate, chain-link all
// round, and on the yard wall the district's big mural (the shared signage's character mural, seen from Aspen St and from the overhead).
import { blockCtx } from '../engine.js';
import { GEN } from '../gen.js';
import { REG } from '../audit.js';
import { frame, win, AIR, TOD } from '../kit.js';
import { Vol } from '../vox.js';
import { PAL, CV, SIDE, hash, shade } from '../style.js';
import { bench, trashCan, hoop } from '../props.js';
import { mural } from '../facade.js';
import { M, pv, done, cyl, ring, txt, tw, tm, logSign, framed, frameR, kerb, keepB, off } from '../districts/suburbs/brush.js';
import { wput as wputW } from '../districts/suburbs/yard.js';
import * as SP from '../districts/suburbs/props.js';

const INK = PAL.ink, WHITE = PAL.white, WOOD = PAL.wood, BRICK = 0x9b4f3a, STONE = 0xe6dcc4, ASPH = 0x4f505a, LINE = 0xf7f7f2, YEL = 0xffc21a, CHAIN = 0xc3c6cc, POST = 0x9a9ca4;
const lit = (d = 1) => TOD.night ? 3 : d;
// ── the yellow school bus (10 m, facing +z) and the climbing dome
const bus = () => M('sbus' + TOD.night, 'bus', () => { const L = 96, W = 23, V = pv(W + 2, 32, L + 2), x0 = 1, x1 = x0 + W, Y = 0xffb400;
  V.box(x0, 4, 1, x1, 28, L - 12, Y); V.box(x0, 4, L - 12, x1, 17, L + 1, Y); V.box(x0 + 1, 28, 2, x1 - 1, 29, L - 13, Y);
  V.box(x0, 8, 1, x1, 9, L - 12, INK); V.box(x0, 5, 1, x1, 6, L + 1, INK); for (const x of [x0, x1 - 1]) for (let z = 6; z < L - 16; z += 8) V.box(x, 17, z, x + 1, 25, z + 6, 0x9fd8ff, 1);
  V.box(x0 + 1, 17, L - 12, x1 - 1, 26, L - 11, 0x9fd8ff, 1); V.box(x0, 13, L + 1, x0 + 4, 16, L + 2, 0xffffff, lit(1)); V.box(x1 - 4, 13, L + 1, x1, 16, L + 2, 0xffffff, lit(1));
  V.box(x0 - 1, 4, L, x1 + 1, 6, L + 2, INK); V.box(x0 - 1, 4, 0, x1 + 1, 6, 2, INK); V.box(x0 + 3, 26, 1, x1 - 3, 28, 2, 0xe8232a, lit(1));
  for (const z of [12, L - 20]) for (const x of [x0 - 1, x1 - 2]) { V.box(x, 0, z - 4, x + 3, 9, z + 5, 0x1b1b20); V.box(x + (x < x0 ? 0 : 2), 3, z - 1, x + 1 + (x < x0 ? 0 : 2), 6, z + 2, 0xc9ced6, 2); }
  for (const z of [12, L - 20]) V.clear(x0 + 2, 0, z - 4, x1 - 2, 4, z + 5);
  // SCHOOL BUS down the kerb side (+x), black on the yellow body: letters one voxel proud, read from outside (right = −z)
  const t = 'SCHOOL BUS', T = tm(t), z0 = 16; V.recNext(); for (let j = 0; j < 7; j++) for (let i = 0; i < T.w; i++) if (T.at(i, j)) { const z = z0 + (T.w - 1 - i), y = 16 - j; V.set(x1, y, z, INK); V.recN(t, x1, y, z, 1, 0); }
  return done(V, 'bus'); });
const dome = () => M('cdome', 'playground', () => { const V = pv(30, 17, 30, 15, 15), C = [0xe8232a, 0xffe23a, 0x2f5bff, 0x14a83b];
  for (let x = 0; x < 30; x++) for (let y = 0; y < 16; y++) for (let z = 0; z < 30; z++) { const r = Math.hypot(x + .5 - 15, y * 1.1, z + .5 - 15); if (r > 14.6 || r < 13.4) continue; if ((x % 5) && (z % 5) && (y % 4)) continue; V.set(x, y, z, C[((x / 5 | 0) + (z / 5 | 0) + (y >> 2)) % 4]); }
  return done(V, 'playground'); });

export function ps280(bank, b, A) {
  const kit = GEN.kit, raw = blockCtx(bank, b, A, kit), ctx = framed(raw), R = frameR(raw), [ox, oz] = off(b), wput = (_, bk, x, z, o) => wputW(raw, bk, ...kerb(x, z), o);   // (x 100…122, z 228…252: today's metres, the block's frame — brush.js framed / frameR / kerb)
  REG.strict = true;
  try {
    const BX0 = 100.8, BX1 = 121.2, BZ0 = 229.4, BZ1 = 237.6, H = 102;
    // ── the forecourt on Willow St and the yard (walkable asphalt, painted), inside the fence line
    ctx.group('yard');
    const F = ctx.volume(R.x0, SIDE, R.z0, R.x1, SIDE + .1, BZ0, { walk: true }); F.box(0, 0, 0, F.nx, 1, F.nz, (x, y, z) => (x % 15 === 0) ? 0xc4bcaa : 0xd9d2c3);
    const Y0 = BZ1, Y1 = R.z1 - .1, X0 = R.x0 + .1, X1 = R.x1 - .1, G = ctx.volume(X0, SIDE, Y0, X1, SIDE + .1, Y1, { walk: true });
    const home = [108, 250.4], dia = (x, z) => Math.abs(x - home[0]) + Math.abs(z - (home[1] - 2.8)), hc = [120.4, 245.6];
    G.box(0, 0, 0, G.nx, 1, G.nz, (x, y, z) => { const wx = X0 + (x + .5) * CV, wz = Y0 + (z + .5) * CV, d = dia(wx, wz), dh = Math.hypot(wx - hc[0], wz - hc[1]);
      if (Math.abs(d - 2.8) < .06 && wz < home[1] + .05) return LINE;                                                                   // the diamond's base paths
      for (const [bx, bz] of [[home[0], home[1] - .15], [home[0] + 2.8, home[1] - 2.8], [home[0], home[1] - 5.6], [home[0] - 2.8, home[1] - 2.8]]) if (Math.abs(wx - bx) < .2 && Math.abs(wz - bz) < .2) return WHITE;
      if (d < 1.6 && d > 1.2 && Math.abs(wx - home[0]) < .8 && wz < home[1] - 2) return 0xc47a4a;                                        // the pitcher's circle
      if (wx > 114 && (Math.abs(dh - 4.6) < .06 || (Math.abs(wz - 243.6) < .06 || Math.abs(wz - 247.6) < .06) && wx > 117.2 || Math.abs(wx - 117.2) < .06 && wz > 243.6 && wz < 247.6)) return YEL;   // the half court
      if (wx > 117.2 && wz > 243.6 && wz < 247.6) return 0x3a6fc4;
      if (wx > 107.6 && wx < 109.2 && wz > 238.4 && wz < 242.8) { const k = Math.floor((wz - 238.4) / .8); return (Math.abs(wx - 108.4) < .04 || (wz - 238.4) % .8 < .06) ? LINE : [0xff4fa3, 0x2de2e6, 0xffe23a, 0x6cff4a, 0xff7a1a, 0x7a3cff][k % 6]; }   // hopscotch
      if (wx > 110.6 && wx < 113.8 && wz > 239 && wz < 242.2) return (Math.abs(wx - 112.2) < .05 || Math.abs(wz - 240.6) < .05 || wx < 110.7 || wx > 113.7 || wz < 239.1 || wz > 242.1) ? LINE : 0xe8232a;   // four-square
      if (wx < 103.2 && (Math.abs(wx - 103.1) < .06 || Math.abs(wz - 238.6) < .06) && wz < 249.4) return YEL;                            // the bus bay
      return ((x * 7 + z * 13) % 29 === 0) ? 0x474852 : ASPH; });
    ctx.finish();
    // ── the building
    ctx.group('school');
    const nx = Math.round((BX1 - BX0) / CV), nz = Math.round((BZ1 - BZ0) / CV), pad = 12, V = new Vol(nx + 2 * pad, H + 34, nz + 2 * pad, { s: CV, org: [BX0 + ox - pad * CV, SIDE, BZ0 + oz - pad * CV] }), B = { x0: pad, z0: pad, x1: pad + nx, z1: pad + nz };
    ctx.mass(V, [BX0, BZ0, BX1, BZ1], { top: SIDE + (H + 30) * CV, roofY: SIDE + H * CV });
    V.box(B.x0, 0, B.z0, B.x1, H, B.z1, (x, y) => y < 6 ? STONE : (y % 3 === 2 ? shade(BRICK, .92) : BRICK));
    V.box(B.x0 + 1, H - 1, B.z0 + 1, B.x1 - 1, H, B.z1 - 1, 0x9c9aa2); V.box(B.x0, H, B.z0, B.x1, H + 6, B.z1, BRICK); V.clear(B.x0 + 2, H, B.z0 + 2, B.x1 - 2, H + 6, B.z1 - 2);
    const Nf = frame(V, B, '-z'), Sf = frame(V, B, '+z'), Ef = frame(V, B, '+x'), Wf = frame(V, B, '-x');
    for (const f of [Nf, Sf, Ef, Wf]) { f.box(-1, H + 5, 0, f.len + 1, H + 7, 2, STONE); f.box(-1, H - 5, 0, f.len + 1, H - 2, 3, STONE); for (let a = 1; a < f.len - 1; a += 5) f.box(a, H - 7, 1, a + 2, H - 5, 3, STONE);
      f.box(0, 34, 0, f.len, 36, 2, STONE); f.box(0, 68, 0, f.len, 70, 2, STONE); }
    // the Willow St front: tall classroom windows in pairs on three floors, the entrance bay in the middle with P.S. 280 over the doors
    const ea0 = (Nf.len >> 1) - 26, ea1 = (Nf.len >> 1) + 26;
    for (const y of [8, 42, 76]) for (let a = 8; a + 14 < Nf.len - 6; a += 21) { if (a + 16 > ea0 - 2 && a < ea1 + 2) continue; win(Nf, a, y, 13, 22, STONE, {}); }
    Nf.box(ea0, 1, 0, ea1, 96, 6, STONE); Nf.box(ea0 + 2, 6, 0, ea1 - 2, 94, 6, shade(STONE, .95));
    // the bay has its own face (5 voxels proud): the doors, the plaque, two tall windows over them
    const Bf = frame(V, { x0: B.x1 - ea1, x1: B.x1 - ea0, z0: B.z0 - 6, z1: B.z0 }, '-z'), bc = Bf.len >> 1;
    Bf.box(8, 4, -6, Bf.len - 8, 30, 1, AIR); Bf.box(8, 4, -6, Bf.len - 8, 30, -5, (a, y) => (a === bc || y === 4 || y === 29 || a === 8 || a === Bf.len - 9) ? 0x1f5c4a : (y > 16 ? 0x9fd8ff : 0x1f5c4a), 1);
    for (const y of [48, 74]) win(Bf, bc - 8, y, 16, 20, WHITE, {});
    for (let k = 0; k < 3; k++) Nf.box(ea0 + 6 - k, 1, 6 + k * 2, ea1 - 6 + k, 4 - k, 8 + k * 2, 0xc9c3b6);                                    // the steps down to the forecourt
    Bf.box(4, 33, 0, Bf.len - 4, 43, 2, INK); Bf.text('P.S. 280', bc, 41, 2, 3, WHITE, lit(0), 1, 1);
    for (const a of [ea0 - 3, ea1 + 1]) Nf.box(a, 1, 0, a + 2, 96, 7, STONE);
    // the yard side: ground-floor windows and doors; the mural over the two upper floors; the ends: windows
    for (let a = 10; a + 14 < Sf.len - 8; a += 24) win(Sf, a, 8, 13, 20, STONE, {});
    mural(Sf, 16, 40, Sf.len - 32, 56, 'sunset', 2801, [0xffe23a, 0xe8232a, WHITE, INK]);   // (art, not an ad: it's a school)
    for (const f of [Ef, Wf]) for (const y of [8, 42, 76]) for (const a of [12, f.len - 26]) win(f, a, y, 13, 22, STONE, {});
    // ── the roof is a place: a fenced play court (east), the school garden with raised beds and a greenhouse (west), the stair bulkhead between
    const cx0 = B.x0 + 112, cx1 = B.x1 - 6, cz0 = B.z0 + 7, cz1 = B.z1 - 7, ccx = (cx0 + cx1) >> 1, ccz = (cz0 + cz1) >> 1;
    V.box(cx0 - 3, H - 1, cz0 - 3, cx1 + 3, H, cz1 + 3, (x, y, z) => { if (x < cx0 || x >= cx1 || z < cz0 || z >= cz1) return 0x2fa35a;
      const line = x === cx0 || x === cx1 - 1 || z === cz0 || z === cz1 - 1 || x === ccx || Math.abs(Math.hypot(x - ccx, z - ccz) - 9) < .6; return line ? WHITE : 0x2f6fd4; });
    for (const [x0, z0, x1, z1] of [[cx0 - 3, cz0 - 3, cx1 + 3, cz0 - 2], [cx0 - 3, cz1 + 2, cx1 + 3, cz1 + 3], [cx0 - 3, cz0 - 3, cx0 - 2, cz1 + 3], [cx1 + 2, cz0 - 3, cx1 + 3, cz1 + 3]])
      V.box(x0, H, z0, x1, H + 24, z1, (x, y, z) => { const k = x1 - x0 > 1 ? x - x0 : z - z0; return (k % 25 === 0 || y === H + 23) ? POST : ((k + y) % 2 === 0 ? CHAIN : undefined); });
    for (const [px, pz] of [[cx0 - 3, cz0 - 3], [cx1 + 2, cz0 - 3], [cx0 - 3, cz1 + 2], [cx1 + 2, cz1 + 2]]) V.box(px, H, pz, px + 1, H + 24, pz + 1, POST);
    for (const x of [cx0 + 2, cx1 - 3]) { V.box(x, H, ccz, x + 1, H + 26, ccz + 1, POST); V.box(x + (x < ccx ? 1 : -4), H + 22, ccz - 3, x + (x < ccx ? 5 : 0), H + 29, ccz + 4, WHITE); }   // two hoops
    for (let k = 0; k < 3; k++) { const x0 = B.x0 + 8 + k * 24, z0 = B.z0 + 12, z1 = B.z1 - 12;
      V.box(x0, H, z0, x0 + 18, H + 4, z1, (x, y, z) => (x === x0 || x === x0 + 17 || z === z0 || z === z1 - 1) ? WOOD : y === H + 3 ? 0x5a3a22 : undefined);
      V.box(x0 + 1, H + 1, z0 + 1, x0 + 17, H + 3, z1 - 1, 0x5a3a22);
      for (let x = x0 + 2; x < x0 + 16; x += 3) for (let z = z0 + 2; z < z1 - 2; z += 3) { const h = 2 + ((x * 7 + z * 3 + k) % 4); V.box(x, H + 4, z, x + 2, H + 4 + h, z + 2, (xx, y) => (y === H + 3 + h && (x + z + k) % 5 === 0) ? [0xe8232a, 0xffe23a, 0xff7a1a][(x + z) % 3] : [0x2fa35a, 0x3cc85a, 0x238a3e][(x + z + y) % 3]); } }
    const gx0 = B.x0 + 82, gx1 = B.x0 + 104, gz0 = B.z0 + 12, gz1 = B.z0 + 40, gh = 18;
    V.box(gx0, H, gz0, gx1, H + gh, gz1, (x, y, z) => { const ex = x === gx0 || x === gx1 - 1, ez = z === gz0 || z === gz1 - 1; if (!ex && !ez) return y === H ? 0x8a8c94 : undefined; return (y === H || y === H + gh - 1 || (ex && ez) || (x - gx0) % 6 === 0 || (z - gz0) % 7 === 0) ? WHITE : 0xbfeaff; }, 1);
    for (let k = 0; k < 6; k++) V.box(gx0 + k, H + gh + k, gz0, gx1 - k, H + gh + k + 1, gz1, (x, y, z) => (x === gx0 + k || x === gx1 - k - 1 || z === gz0 || z === gz1 - 1) ? WHITE : 0xbfeaff, 1);
    V.box(B.x0 + 84, H, B.z1 - 24, B.x0 + 102, H + 26, B.z1 - 6, (x, y) => y === H + 25 ? STONE : BRICK); V.box(B.x0 + 90, H, B.z1 - 25, B.x0 + 96, H + 20, B.z1 - 24, 0x1f5c4a);   // the stair bulkhead, its door to the court
    V.box(B.x0 + 60, H, B.z0 + 50, B.x0 + 76, H + 9, B.z0 + 66, 0xe6e6ea); V.box(B.x0 + 61, H + 9, B.z0 + 51, B.x0 + 75, H + 10, B.z0 + 65, 0xbdbdc4);   // one HVAC unit
    ctx.finish();
    logSign('P.S. 280', ...kerb(111, 229.4));
    REG.door(...kerb(111, BZ0 - .5), 2);
    // ── the fence (chain-link, 2.4 m) round the yard: the Aspen St gate, the bus gate on Maple St
    ctx.group('fence');
    const run = (x0, z0, x1, z1) => { const Vf = ctx.volume(x0, SIDE, z0, Math.max(x1, x0 + .1), SIDE + 2.4, Math.max(z1, z0 + .1)), n = Math.max(Vf.nx, Vf.nz), alongX = Vf.nx >= Vf.nz;
      Vf.box(0, 0, 0, Vf.nx, Vf.ny, Vf.nz, (x, y, z) => { const k = alongX ? x : z; return (k % 25 === 0 || k === n - 1 || y === Vf.ny - 1) ? POST : ((k + y) % 2 === 0 ? CHAIN : undefined); }); REG.keep(keepB([x0 - .02, SIDE, z0 - .02, Math.max(x1, x0 + .1) + .02, SIDE + 2.4, Math.max(z1, z0 + .1) + .02]), 'fence'); };
    run(R.x0, R.z1 - .1, 109.6, R.z1); run(111.8, R.z1 - .1, R.x1, R.z1); run(R.x1 - .1, BZ1 + .3, R.x1, R.z1 - .1); run(R.x0, 249.8, R.x0 + .1, R.z1 - .1);
    // the backstop behind home plate (a taller chain-link corner)
    const bs = ctx.volume(home[0] - 2, SIDE + .1, home[1] + .6, home[0] + 2, SIDE + 3.2, home[1] + .7); bs.box(0, 0, 0, bs.nx, bs.ny, bs.nz, (x, y) => (x % 10 === 0 || y === bs.ny - 1) ? POST : ((x + y) % 2 === 0 ? CHAIN : undefined));
    REG.keep(keepB([home[0] - 2, SIDE, home[1] + .58, home[0] + 2, SIDE + 3.2, home[1] + .72]), 'fence'); ctx.finish();
    // ── the yard's things
    ctx.group('schoolyard');
    wput(ctx, bus(), 101.8, 244, { rot: 0, reach: .6, loose: true });
    wput(ctx, dome(), 115.4, 240.4, { reach: .6, loose: true });
    wput(ctx, hoop(), 121.1, hc[1], { rot: 3, reach: .3, loose: true });
    for (const x of [104.4, 110.6, 117]) wput(ctx, bench(), x, 238.2, { rot: 2, reach: .5, loose: true });
    wput(ctx, trashCan(0x2f5bff), 113.8, 238.2, { reach: .4, loose: true }); wput(ctx, trashCan(0x2f5bff), 102.6, 251.2, { reach: .4, loose: true });
    for (const [x, z] of [[102.4, 228.5], [119.6, 228.5]]) wput(ctx, SP.planter(0x8f929b, 0xe8232a), x, z, { reach: .4, loose: true });
  } finally { REG.strict = false; }
  ctx.finish();
}
