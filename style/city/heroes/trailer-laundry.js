// SUNNY ACRES · THE COIN LAUNDRY + PAD 47'S POOL (block −7,−1) · owner: the Sunny Acres / Millennium Mall agent. On Central Ave, facing
// the dead mall across the avenue: the park's coin laundry, a white block building with a cyan fascia, a storefront of washers under
// ceiling tubes (lit all night, 24 HRS in pink neon), SPIN CYCLE painted big on its east wall, and a giant washing machine on the roof
// (the block's gag, readable from the overview). Behind it, on lane 3, Pad 47 has the park's above-ground pool with its loungers.
import { blockCtx } from '../engine.js';
import { GEN } from '../gen.js';
import { REG } from '../audit.js';
import { frame, win, AIR, TOD } from '../kit.js';
import { Vol } from '../vox.js';
import { PAL, CV, SIDE, hash, shade } from '../style.js';
import { padsIn, IN, POOL_PAD, frameOf, SX, SZ } from '../districts/trailer/plan.js';
import { buildPad, spot, deckOf } from '../districts/trailer/pads.js';
import { lanes, poles, perimeter } from '../districts/trailer/park.js';
import { cyl } from '../districts/trailer/brush.js';
import * as TP from '../districts/trailer/props.js';
import { bench, trashCan, phoneBooth, umbrella, speaker } from '../props.js';

const INK = PAL.ink, WHITE = PAL.white, CYAN = 0x2de2e6, BLOCKW = 0xf4f1ea, PINK = 0xff4fa3;
const lit = (day = 1) => TOD.night ? 3 : day;

export function coinLaundry(bank, b, A) {
  const kit = GEN.kit, ctx = blockCtx(bank, b, A, kit); REG.strict = true;
  const lx0 = -216 + SX, lx1 = -200.4 + SX, lz0 = -9.8 + SZ, lz1 = -6.2 + SZ;   // (SPREAD: the park's metres + its shift, trailer/plan.js)
  try {
    lanes(ctx); poles(ctx); perimeter(ctx, [{ ax: 'x', z: IN.z1 - .1, a: lx0 - .6, b: lx1 + .6 }]); ctx.finish();
    // ── THE COIN LAUNDRY
    ctx.group('laundry');
    const H = 38, pad = 16, nx = Math.round((lx1 - lx0) / CV), nz = Math.round((lz1 - lz0) / CV), V = new Vol(nx + 2 * pad, H + 40, nz + 2 * pad, { s: CV, org: [lx0 - pad * CV, SIDE, lz0 - pad * CV] });
    const B = { x0: pad, z0: pad, x1: pad + nx, z1: pad + nz }, cx = (B.x0 + B.x1) >> 1, cz = (B.z0 + B.z1) >> 1;
    ctx.mass(V, [lx0, lz0, lx1, lz1], { top: SIDE + (H + 4) * CV, roofY: SIDE + H * CV });
    V.box(B.x0, 0, B.z0, B.x1, H, B.z1, (x, y, z) => (y % 4 === 3) ? shade(BLOCKW, .94) : BLOCKW);                          // painted block, a joint every course
    V.box(B.x0 + 1, H - 1, B.z0 + 1, B.x1 - 1, H, B.z1 - 1, 0xd2d3d6); V.box(B.x0, H, B.z0, B.x1, H + 3, B.z1, BLOCKW); V.clear(B.x0 + 2, H, B.z0 + 2, B.x1 - 2, H + 3, B.z1 - 2);
    const S = frame(V, B, '+z'), Ew = frame(V, B, '+x'), Wf = frame(V, B, '-x'), Nf = frame(V, B, '-z'), L = S.len;
    // the storefront: a long window on a cyan base, the glass door at the east end, the fascia band with COIN LAUNDRY
    S.box(0, 0, 0, L, 5, 2, CYAN); S.box(0, 28, 0, L, 37, 3, CYAN); S.box(0, 27, 0, L, 28, 3, INK); S.box(0, 36, 0, L, 37, 3, WHITE);
    S.text('COIN LAUNDRY', L >> 1, 35, 3, 4, WHITE, lit(0), 1, 1);
    const wa0 = 6, wa1 = L - 24;                                                                                        // (the window, then the door)
    S.box(wa0 - 1, 5, 0, wa1 + 1, 26, 2, INK); S.box(wa0, 6, -31, wa1, 25, 2, AIR);                                    // (the back wall stays: 0.4 m)
    // inside: a checker floor, washers along the back wall, dryers stacked on them at the west end, a folding table, the ceiling tubes
    S.box(wa0, 5, -31, wa1, 6, -2, (a, y, d) => (((a >> 2) + (d >> 2)) & 1) ? 0xf2f2ee : 0x9a9ca4);
    for (let a = wa0 + 2; a + 7 < wa1; a += 9) { S.box(a, 6, -31, a + 8, 16, -25, 0xf7f7f2); S.box(a, 16, -31, a + 8, 17, -25, 0xdfe2e8); for (let u = -2; u <= 2; u++) for (let v = -2; v <= 2; v++) if (u * u + v * v <= 5) S.set(a + 4 + u, 11 + v, -25, u * u + v * v <= 2 ? 0x2a3564 : 0x9a9ca4, 2); }
    for (let a = wa0 + 2; a + 7 < wa0 + 30; a += 9) { S.box(a, 17, -31, a + 8, 24, -25, 0xdfe2e8); for (let u = -2; u <= 2; u++) for (let v = -2; v <= 2; v++) if (u * u + v * v <= 5) S.set(a + 4 + u, 20 + v, -25, 0x3a3d45, 2); }
    S.box(wa0 + 40, 6, -16, wa0 + 70, 13, -11, 0xc49a6c); S.box(wa0 + 40, 13, -16, wa0 + 70, 14, -11, 0xe6e1d6);
    for (let a = wa0 + 6; a < wa1 - 4; a += 16) S.box(a, 24, -28, a + 10, 25, -6, 0xfffbe8, lit());
    // the glass (the room is lit at night) with 24 HRS in pink neon set in it on a dark panel
    S.box(wa0, 6, -1, wa1, 25, 0, (a, y) => (y === 15) ? INK : TOD.night ? 0xffe8a8 : (a + y) % 11 === 0 ? 0xeaf6ff : 0x9fcfe8, TOD.night ? 3 : 1);
    S.box(wa0 + 4, 16, -2, wa0 + 40, 25, -1, INK); S.box(wa0 + 4, 16, -1, wa0 + 40, 25, 0, INK); S.text('24 HRS', wa0 + 22, 24, -1, 0, PINK, lit(0), 1, 1);
    // the door (the size of every door in the sim), glass with a push bar
    const da = L - 18; S.box(da - 1, 0, 0, da + 13, 26, 2, INK); S.box(da, 1, -2, da + 12, 25, 2, AIR); S.box(da, 1, -3, da + 12, 25, -2, (a, y) => (a === da || a === da + 11 || y === 1 || y === 24) ? 0x9a9ca4 : 0x9fcfe8, 1); S.box(da + 2, 12, -2, da + 10, 13, -1, 0xdfe3ea, 2);
    // SPIN CYCLE painted on the east wall (seen all the way down Central Ave), with a big round porthole
    Ew.box(1, 4, 0, Ew.len - 1, 36, 1, 0x2f5bff);
    for (let u = -10; u <= 10; u++) for (let v = -10; v <= 10; v++) { const r = Math.hypot(u, v); if (r <= 10) Ew.set((Ew.len >> 1) + u, 22 + v, 0, r > 8 ? WHITE : r > 6.5 ? 0x9fd8ff : 0x3fc8ff); }
    Ew.text('SPIN', Ew.len >> 1, 10, 0, 1, WHITE, 0, 1, 1);
    // back and west walls: a window or two, a vent; the dryer exhaust hoods
    win(Nf, 20, 14, 12, 9, WHITE, {}); win(Nf, L - 34, 14, 12, 9, WHITE, {}); for (const a of [50, 70, 90]) Nf.box(a, 30, 0, a + 4, 33, 3, 0x9a9ca4, 2);
    // ── the roof: AC units, and the giant washing machine on its stand (the gag)
    for (const [x, z] of [[B.x0 + 8, cz - 6], [B.x0 + 20, cz - 6]]) { V.box(x, H, z, x + 9, H + 6, z + 8, 0xe6e6ea); V.box(x + 1, H + 6, z + 1, x + 8, H + 7, z + 7, 0xbdbdc4); }
    { const gx = B.x1 - 34, gz = cz - 12, y0 = H + 3; V.box(gx + 2, H, gz + 2, gx + 5, y0, gz + 5, 0x6d707a); V.box(gx + 21, H, gz + 2, gx + 24, y0, gz + 5, 0x6d707a); V.box(gx + 2, H, gz + 19, gx + 5, y0, gz + 22, 0x6d707a); V.box(gx + 21, H, gz + 19, gx + 24, y0, gz + 22, 0x6d707a);
      V.box(gx, y0, gz, gx + 26, y0 + 26, gz + 24, WHITE); V.box(gx, y0 + 26, gz, gx + 26, y0 + 28, gz + 24, 0xdfe2e8); V.box(gx + 3, y0 + 22, gz + 24, gx + 23, y0 + 25, gz + 25, 0x3a3d45);
      for (let u = -9; u <= 9; u++) for (let v = -9; v <= 9; v++) { const r = Math.hypot(u, v); if (r <= 9) V.box(gx + 13 + u, y0 + 11 + v, gz + 24, gx + 14 + u, y0 + 12 + v, gz + 25 + (r > 7.5 ? 1 : 0), r > 7.5 ? 0xb9bcc4 : r > 6 ? 0x2a3564 : 0x3fc8ff, r > 7.5 ? 2 : lit()); }
      for (const x of [gx + 5, gx + 9]) V.box(x, y0 + 23, gz + 25, x + 2, y0 + 24, gz + 26, PINK, lit()); }
    ctx.finish();
    // outside: a bench under the window, the trash can, the phone, a laundry cart
    ctx.group('laundry');
    REG.door(lx0 + (da + 6) * CV, lz1 + .5, 0);
    const put = (bk, x, z, rot, reach = .8) => ctx.put(bk, x, z, { rot, slide: [1, 0], reach });
    put(trashCan(0x2f5bff), -205.3 + SX, -5.45 + SZ, 0); put(phoneBooth(), -217.4 + SX, -7.2 + SZ, 0, .5); put(TP.burnBarrel(), -222.5 + SX, -8.2 + SZ, 0, .5);
    // ── the pads, and Pad 47's pool
    for (const p of padsIn(b.i, b.j)) {
      if (p.n !== POOL_PAD) { buildPad(ctx, p); continue; }
      const r = buildPad(ctx, p, { noYard: true, noCar: true, noPath: true }), dk = deckOf(p), zone = [.2, dk.v1 + .1, 7.8, 11.0];
      ctx.group('P' + p.n); const at = spot(ctx, p, TP.pool(), zone, 0, { near: [4.4, 8.9], step: .1, jitter: 0 });
      spot(ctx, p, TP.lounger(0xff4fa3), zone, 0, { near: [1, 10], step: .2, quiet: true }); spot(ctx, p, TP.lounger(0x2de2e6), zone, 0, { near: [7.2, 10], step: .2, quiet: true });
      spot(ctx, p, speaker(), zone, 0, { near: [1.2, 7.4], step: .2, quiet: true }); spot(ctx, p, TP.tikiTorch(), zone, 0, { near: [7.4, 7.2], step: .2, quiet: true });
      spot(ctx, p, TP.cooler(0xff7a1a), zone, 0, { near: [6.8, 8], step: .2, quiet: true }); }
  } finally { REG.strict = false; }
  ctx.finish();
}
