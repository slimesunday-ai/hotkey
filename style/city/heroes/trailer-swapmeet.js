// SUNNY ACRES · THE SWAP MEET (block −7,−2) · owner: the Sunny Acres / Millennium Mall agent. One of the sim's two markets: the
// hangout at (−208, −49) sits in the middle of lane 2, and the market runs the length of the block. The six pads here keep their
// homes (and their anchors); their front yards turn into stalls — canopies over folding tables, tarp lean-tos over blankets, rims,
// bikes — each with its own hand-lettered board. Over the lane: bunting and string lights on crossing lines, the SWAP MEET banner at
// the east end (you walk in from the park gate on Elm St), the elote cart, and the hangout's folding chairs, cooler and boombox.
import { blockCtx } from '../engine.js';
import { GEN } from '../gen.js';
import { REG } from '../audit.js';
import { PAL, CV, SIDE, hash, shade } from '../style.js';
import { TOD } from '../kit.js';
import { padsIn, LANES, frameOf, HANGOUT, SX } from '../districts/trailer/plan.js';
import { buildPad, spot, deckOf } from '../districts/trailer/pads.js';
import { lanes, poles, blockRange } from '../districts/trailer/park.js';
import { txtX, tw, wire } from '../districts/trailer/brush.js';
import * as MK from '../districts/trailer/market.js';
import * as TP from '../districts/trailer/props.js';

const INK = PAL.ink, WHITE = PAL.white, GALV = 0xb9bcc4;
// what each pad's yard sells (pad number → stalls, first one under a canopy)
const STALLS = {
  25: [{ k: 'canopy', c: 0xe8232a, stripe: 1, goods: 'tools', second: 'junk', sign: 'TOOLS/$5 EACH' }, { k: 'rims', sign: 'RIMS $40' }],
  27: [{ k: 'tarp', goods: 'dvds', sign: 'DVDS/3 FOR $5', rug: 0x7a3cff }],
  29: [{ k: 'canopy', c: 0x2f5bff, goods: 'phones', sign: 'CASES/CHARGERS', bg: 0xffe23a }],
  26: [{ k: 'canopy', c: 0x14a83b, goods: 'food', sign: 'TAMALES/$2', bg: 0xe8232a, fg: WHITE }, { k: 'bikes', sign: 'BIKES/AS FOUND' }],
  28: [{ k: 'canopy', c: 0xffc21a, stripe: 1, goods: 'stereos', second: 'vinyl', sign: 'HOT AUDIO/CHEAP', bg: INK, fg: 0xffe23a }],
  30: [{ k: 'canopy', c: 0xff4fa3, goods: 'gold', second: 'perfume', sign: 'GOLD/CHAINS', bg: INK, fg: PAL.gold }],
};
const stallOf = o => o.k === 'canopy' ? MK.canopyStall({ c: o.c, stripe: o.stripe, goods: o.goods, second: o.second, sign: o.sign, bg: o.bg, fg: o.fg })
  : o.k === 'tarp' ? MK.tarpStall({ goods: o.goods, sign: o.sign, c: o.c, rug: o.rug }) : o.k === 'rims' ? MK.rimStall(o.sign) : MK.bikeRow(o.sign);

export function swapMeet(bank, b, A) {
  const kit = GEN.kit, ctx = blockCtx(bank, b, A, kit), q = LANES[1], [x0, , x1] = blockRange(ctx); REG.strict = true;   // (SPREAD: the block's frame cell; the park's metres + SX, trailer/plan.js)
  try {
    lanes(ctx); poles(ctx); ctx.finish();
    // ── over the lane: crossing lines of bunting and lights on thin poles at the lane's edges, the banner at the east end
    ctx.group('swap');
    const cross = [-221.5, -213.2, -203.5, -195.3].map(x => x + SX), V = ctx.volume(x0, SIDE + CV, q.z0, x1, SIDE + 6.2, q.z1, { ground: false }), vx = x => Math.round((x - x0) / CV), vz = z => Math.round((z - q.z0) / CV), nz = V.nz;
    const BUNT = [0xe8232a, 0xffc21a, 0x2f5bff, 0x14a83b, 0xff4fa3, 0xff7a1a, WHITE];
    for (const [k, cx] of cross.entries()) { const X = vx(cx);
      for (const Z of [1, nz - 2]) { V.box(X, 0, Z, X + 1, 38, Z + 1, GALV, 2); REG.keep([cx - .15, SIDE, q.z0 + (Z - .5) * CV - .1, cx + .25, SIDE + 3.9, q.z0 + (Z + 1.5) * CV + .1], 'pole'); }
      // the pennant line (top) and the light line (0.4 m under it), each sagging to mid-lane
      for (let z = 1; z < nz - 1; z++) { const t = (z - 1) / (nz - 3), sag = Math.round(4 * 4 * t * (1 - t)), y = 37 - sag;
        V.set(X, y, z, INK); if (z % 3 === 1 && z > 2 && z < nz - 3) { const c = BUNT[(z / 3 + k * 3) % BUNT.length | 0]; V.set(X, y - 1, z, c); V.set(X, y - 1, z + 1, c); V.set(X, y - 2, z, c); }
        const yl = 33 - sag; V.set(X, yl, z, INK); if (z % 3 === 2) { const c = TOD.night ? [0xfff0b0, 0xffb0d8, 0xa8f0ff][(z / 3 | 0) % 3] : 0xfff6d8; V.set(X, yl - 1, z, c, TOD.night ? 3 : 1); V.set(X, yl - 2, z, c, TOD.night ? 3 : 1); } }
      for (const Z of [1, nz - 2]) for (let y = 33; y < 38; y++) V.set(X, y, Z, GALV, 2); }
    // the banner over the market's east end: two lines of 0.1 letters on a canvas stretched between the last pair of poles
    { const bx = vx(-192.9 + SX), zA = 2, zB = nz - 2, top = 56; V.box(bx, 37, zA, bx + 1, top, zB, TOD.night ? 0xfff6e0 : WHITE, TOD.night ? 3 : 0); V.box(bx, 37, zA, bx + 1, 38, zB, 0xe8232a); V.box(bx, top - 1, zA, bx + 1, top, zB, 0xe8232a);
      for (const Z of [1, nz - 2]) { V.box(bx - 1, 0, Z, bx, top, Z + 1, GALV, 2); REG.keep([-193.1 + SX, SIDE, q.z0 + (Z - .5) * CV - .1, -192.8 + SX, SIDE + 5.7, q.z0 + (Z + 1.5) * CV + .1], 'pole'); }
      const mid = (zA + zB) >> 1, word = (s, yt, c) => txtX(V, s, mid - (tw(s) >> 1), yt, bx + 1, c, 0, 1);
      word('SWAP', top - 3, 0xe8232a); word('MEET', top - 11, 0x2f5bff); }
    ctx.finish();
    // ── the pads: homes, porches, numbers and anchors as ever; the yards are the market
    const pads = padsIn(b.i, b.j);
    const built = pads.map(p => buildPad(ctx, p, { noYard: true, noCar: true }));
    pads.forEach((p, n) => { ctx.group('P' + p.n); const dk = deckOf(p), list = STALLS[p.n] || [], side = built[n].side, zone = 11.85 - dk.v1 < 2.9 && side ? [side[0], 2.6, side[1], 11.3] : [.2, dk.v1 + .2, 7.8, 11.85];
      list.forEach((o, k) => spot(ctx, p, stallOf(o), zone, 0, { near: [k ? (dk.doorU < 4 ? 6.2 : 1.8) : (dk.doorU < 4 ? 5.2 : 2.8), 11.2 - (o.k === 'canopy' ? 1.6 : 1.4)], step: .2, jitter: .2 })); });
    // ── the lane: the elote cart on the north edge, the hangout at the sim's point (chairs round a cooler, a boombox)
    ctx.group('swap');
    const put = (bk, x, z, rot, reach = 1.6, ax = 1) => ctx.put(bk, x, z, { rot, slide: [ax, 1 - ax], reach });
    put(MK.eloteCart('ELOTES'), -217.6 + SX, q.z0 + .9, 0);
    const hx = HANGOUT.x, hz = HANGOUT.z;
    put(TP.cooler(0x2f5bff), hx, hz, 2, .6); put(MK.foldChair(0xe8232a), hx - 1.0, hz - .1, 1, .6); put(MK.foldChair(0x14a83b), hx + 1.0, hz, 3, .6);
    put(MK.foldChair(0xffc21a), hx - .1, hz - 1.0, 0, .6); put(MK.boombox(), hx + .2, hz + .7, 2, .6);
    put(TP.resinChair(0xf2f2ee), -200.2 + SX, q.z1 - .7, 2, 1); put(TP.cooler(0xe8232a), -199.3 + SX, q.z1 - .6, 2, 1);
  } finally { REG.strict = false; }
  ctx.finish();
}
