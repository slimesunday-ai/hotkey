// PLEASANTVIEW · THE CORNER STORE AT KENT & PINE (block 0,5; the sim's dealing corner Kent St & Pine St at 32,192) · owner: the
// Pleasantview section agent. The superette on the corner, the way the outer boroughs do it: a two-storey corner building on the sim's
// house lot (lot:17,176 stays the home: the owner's apartment upstairs, its own street door, its windows, its anchor). Downstairs: a lit
// store behind glass on both streets under a red-and-white awning, KENT & PINE on the band, a recessed corner door under a column, the
// payphone, the news box, a bench, firewood by the door, one car in the forecourt. On the roof, the gag: a giant soft-serve cone.
// The forecourt's corner is left bare: the dealing corner's hotspot (simstate/layer.js) stands there. The block's other three houses
// are built by the kit as everywhere else.
import { blockCtx } from '../engine.js';
import { GEN } from '../gen.js';
import { REG } from '../audit.js';
import { frame, win, AIR, TOD } from '../kit.js';
import { Vol } from '../vox.js';
import { PAL, CV, SIDE, hash, shade } from '../style.js';
import { interior, shelves } from './common.js';
import { bench, phoneBooth, newsBox, trashCan, car, milkCrate } from '../props.js';
import { specById } from '../districts/suburbs/plan.js';
import { buildLots } from '../districts/suburbs.js';
import { M, pv, done, cyl, txt, tw, board, logSign, framed, kerb, keepB, off } from '../districts/suburbs/brush.js';
import { wput } from '../districts/suburbs/yard.js';
import { paintedAd } from '../facade.js';

const INK = PAL.ink, WHITE = PAL.white, RED = 0xe8232a, CREAM = PAL.cream, GLASS = 0x9fd8ff, ASPH = 0x55565f;
const lit = (d = 1) => TOD.night ? 3 : d;
const LOT = 'lot:17,176', X0 = 17, Z0 = 176, BX0 = 17.6, BX1 = 26.6, BZ0 = 177, BZ1 = 184.2;
// ── the props: the soft-serve cone (the roof gag), a firewood rack, a sandwich board
const cone = () => M('sscone', 'giant', () => { const V = pv(24, 44, 24, 12, 12), W = 0xd9a04e, WD = 0xb07a34;
  for (let y = 0; y < 18; y++) { const r = 1.5 + y * .42; cyl(V, 12, 12, r, y, y + 1, (x, yy, z) => ((x + z + y) % 4 === 0) ? WD : W); }
  for (let y = 18; y < 38; y++) { const t = (y - 18) / 20, r = 9.5 - t * t * 8.5; cyl(V, 12, 12, r, y, y + 1, (x, yy, z) => (Math.floor((Math.atan2(z - 12, x - 12) + Math.PI) * 3 / Math.PI + y * .45) % 2) ? 0xff7ab6 : 0xfff4e6); }
  V.box(11, 38, 11, 13, 41, 13, 0xfff4e6); V.box(11, 41, 11, 13, 43, 13, RED); return done(V, 'giant'); });
const firewood = () => M('fwood', 'rack', () => { const s = .05, V = pv(30, 34, 14, 15, 7, s);
  V.box(0, 0, 0, 2, 30, 14, 0x8a8c94); V.box(28, 0, 0, 30, 30, 14, 0x8a8c94); V.box(0, 0, 0, 30, 2, 14, 0x8a8c94); V.box(0, 14, 0, 30, 15, 14, 0x8a8c94);
  for (const y0 of [2, 15]) for (let x = 3; x < 27; x += 6) V.box(x, y0, 2, x + 5, y0 + 10, 12, (xx, y, z) => (z === 2 || z === 11) ? 0xd9a060 : 0x8a5a2a);
  V.box(2, 26, 12, 28, 34, 14, 0xffe23a); txt(V, 'FIREWOOD', 15 - (tw('FIREWOOD') >> 1), 32, 14, INK); return done(V, 'rack'); });

export function kentPine(bank, b, A) {
  const kit = GEN.kit, raw = blockCtx(bank, b, A, kit), ctx = framed(raw), [ox, oz] = off(b), s = specById('17,176');   // (SPREAD: the store is authored in today's metres, the block's frame: brush.js framed / kerb; the plain ctx for wput and the generated lots)   // (Kent & Pine's corner lot, by its frozen id: a made-up lot from coordinates no longer finds it)
  REG.strict = true;
  try {
    // the corner's hotspot apron (Kent & Pine) stays bare
    REG.keep(keepB([25.4, SIDE, 185.5, 28, SIDE + 2.8, 188]), 'simcorner');
    // ── the forecourt and the side strip (walkable asphalt, a painted bay)
    ctx.group('store');
    const G = ctx.volume(X0, SIDE, BZ1, 28, SIDE + .1, 188, { walk: true }), E = ctx.volume(BX1, SIDE, BZ0, 28, SIDE + .1, BZ1, { walk: true });
    G.box(0, 0, 0, G.nx, 1, G.nz, (x, y, z) => { const wx = X0 + (x + .5) * CV, wz = BZ1 + (z + .5) * CV;
      if ((Math.abs(wx - 18.7) < .06 || Math.abs(wx - 23.5) < .06) && wz > 185.2 && wz < 187.4) return WHITE; return ((x * 7 + z * 13) % 23 === 0) ? 0x4d4e57 : ASPH; });
    E.box(0, 0, 0, E.nx, 1, E.nz, ASPH); ctx.finish();
    // ── the building: 2 storeys (the store 3.6 m, the apartment 2.8 m), a flat roof behind a parapet and a cornice
    const nx = 110, nz = 120, V = new Vol(nx, 112, nz, { s: CV, org: [X0 + ox, SIDE, Z0 + oz] }), B = { x0: 6, x1: 96, z0: 10, z1: 82 }, H = 64, wall = s.wall, trim = s.neutral ? s.trim : WHITE;
    ctx.mass(V, [BX0, BZ0, BX1, BZ1], { top: SIDE + H * CV, roofY: SIDE + H * CV });
    V.box(B.x0, 0, B.z0, B.x1, H, B.z1, (x, y) => y < 36 ? INK : (y % 3 === 0 ? shade(wall, .9) : wall));
    V.box(B.x0 + 1, H - 1, B.z0 + 1, B.x1 - 1, H, B.z1 - 1, 0x9c9aa2); V.box(B.x0, H, B.z0, B.x1, H + 4, B.z1, wall); V.clear(B.x0 + 2, H, B.z0 + 2, B.x1 - 2, H + 4, B.z1 - 2);
    const S = frame(V, B, '+z'), Ef = frame(V, B, '+x'), Wf = frame(V, B, '-x'), Nf = frame(V, B, '-z');
    for (const f of [S, Ef, Wf, Nf]) { f.box(-1, H + 3, 0, f.len + 1, H + 5, 2, trim); f.box(-1, H - 4, 0, f.len + 1, H - 2, 2, trim); for (let a = 1; a < f.len - 1; a += 4) f.set(a, H - 5, 1, trim); f.box(-1, 36, 0, f.len + 1, 37, 2, trim); }
    // the store: a lit room (checker floor, light strips), shelves of stock, a counter by the corner door
    interior(V, B, 34, (x, y, z) => ((x >> 2) + (z >> 2)) & 1 ? 0xf2f2ee : 0x9a9ca4);
    shelves(V, B.x0 + 8, B.z0 + 4, B.x1 - 20, B.z0 + 10, 22, 11); shelves(V, B.x0 + 8, B.z0 + 24, B.x1 - 34, B.z0 + 30, 20, 12); shelves(V, B.x0 + 8, B.z0 + 44, B.x1 - 34, B.z0 + 50, 20, 13);
    V.box(B.x1 - 26, 0, B.z1 - 22, B.x1 - 6, 10, B.z1 - 16, 0xc49a6c); V.box(B.x1 - 26, 10, B.z1 - 22, B.x1 - 6, 11, B.z1 - 16, 0xe6e1d6); V.box(B.x1 - 14, 11, B.z1 - 21, B.x1 - 10, 14, B.z1 - 17, INK);
    for (let z = B.z0 + 4; z < B.z1 - 26; z += 10) V.box(B.x1 - 8, 0, z, B.x1 - 3, 26, z + 8, (x, y) => y > 24 ? WHITE : (y % 6 === 0 ? 0xc9ced6 : x === B.x1 - 8 ? GLASS : [0xe8232a, 0x2f5bff, 0xffe23a, 0x14a83b][(z >> 3) % 4]), 1);   // the drinks coolers
    // the south front (Pine St): the apartment's street door at the west end, a stoop; glass; the red band with the name; the awning
    const da = 5; S.box(da - 2, 3, 0, da + 14, 29, 2, CREAM); S.box(da, 3, 0, da + 12, 27, 2, AIR); S.box(da, 3, -1, da + 12, 27, 0, (a, y) => (y > 18 && y < 25 && a > da + 2 && a < da + 10) ? GLASS : 0x7a1020);
    S.box(da + 9, 13, 0, da + 10, 15, 1, PAL.gold, 2); S.box(da + 13, 20, 1, da + 15, 23, 3, 0xfff1c8, lit(1));
    S.box(da - 4, 1, 1, da + 22, 3, 10, 0xc9c3b6); S.box(da - 1, 1, 10, da + 14, 2, 13, 0xc9c3b6);   // the landing (the sim's safe stands on it, right of the door)
    const g0 = 24, g1 = 74; S.box(g0, 2, -2, g1, 25, 2, AIR); S.box(g0, 2, -2, g1, 25, -1, (a, y) => ((a - g0) % 17 === 0 || y === 2 || y === 24) ? INK : TOD.night ? 0xffe8a8 : GLASS, TOD.night ? 3 : 1);
    S.box(g0 - 1, 26, 0, 76, 36, 2, RED); S.text('KENT & PINE', (g0 + 76) >> 1, 34, 2, 3, WHITE, lit(0), 1, 1);
    for (let d = 1; d <= 9; d++) S.box(g0 - 1, 25 - Math.round(d * .5), d, 76, 26 - Math.round(d * .5), d + 1, (a) => ((a >> 2) & 1) ? RED : WHITE); S.box(g0 - 1, 19, 9, 76, 21, 10, RED);
    // the corner: the ground floor steps in (a door facing Pine St in the notch), a round column holds the corner up
    const cn = 14; V.clear(B.x1 - cn, 0, B.z1 - cn, B.x1, 36, B.z1); V.box(B.x1 - cn, 0, B.z1 - cn, B.x1, 1, B.z1, 0xc9c3b6); V.box(B.x1 - cn, 35, B.z1 - cn, B.x1, 36, B.z1, INK);
    V.box(B.x1 - 3, 1, B.z1 - 3, B.x1, 35, B.z1, WHITE); V.box(B.x1 - cn + 1, 1, B.z1 - cn, B.x1 - 2, 26, B.z1 - cn + 1, (x, y) => (y > 3 && y < 24 && x > B.x1 - cn + 2 && x < B.x1 - 4) ? GLASS : INK, 1);
    V.box(B.x1 - cn - 1, 1, B.z1 - cn - 1, B.x1 - cn, 36, B.z1, INK);
    // the east front (Kent St): glass, a band DELI · GROCERY, the awning; a painted ad upstairs between the windows
    const e0 = 4, e1 = 52; Ef.box(e0 + cn, 2, -2, e1, 25, 2, AIR); Ef.box(e0 + cn, 2, -2, e1, 25, -1, (a, y) => ((a - e0) % 17 === 0 || y === 2 || y === 24) ? INK : TOD.night ? 0xffe8a8 : GLASS, TOD.night ? 3 : 1);
    Ef.box(cn - 1, 26, 0, Ef.len - 4, 36, 2, RED); Ef.text('GROCERY', (cn + Ef.len - 4) >> 1, 34, 2, 3, WHITE, lit(0), 1, 1);
    for (let d = 1; d <= 9; d++) Ef.box(cn - 1, 25 - Math.round(d * .5), d, e1 + 2, 26 - Math.round(d * .5), d + 1, (a) => ((a >> 2) & 1) ? RED : WHITE); Ef.box(cn - 1, 19, 9, e1 + 2, 21, 10, RED);
    // upstairs: the apartment's windows (south 3, east 2, west and north), an AC unit, a dish on the parapet corner
    const wins = []; for (const a of [10, 38, 66]) wins.push(['S', a, win(S, a, 44, 13, 15, trim, { ac: a === 38 })]); for (const a of [6, 58]) wins.push(['E', a, win(Ef, a, 44, 13, 15, trim, {})]);
    for (const a of [20, 46]) { win(Wf, a, 44, 12, 15, trim, {}); win(Nf, a + 10, 44, 12, 15, trim, {}); }
    paintedAd(Ef, 24, 41, 30, 20, null, WHITE, INK);
    V.box(B.x0 + 4, H, B.z0 + 30, B.x0 + 12, H + 5, B.z0 + 38, 0xe6e6ea); V.box(B.x0 + 20, H, B.z0 + 12, B.x0 + 30, H + 6, B.z0 + 20, 0xe6e6ea);
    ctx.finish();
    logSign('KENT & PINE', ...kerb(22, 184.2), 0); logSign('GROCERY', ...kerb(26.6, 180), 0);
    REG.door(...kerb(18.7, BZ1 + .5), 0); REG.door(...kerb(25.9, BZ1 - 1.4 + .5), 0);
    // ── outside: the payphone, the news box, a bench under the window, firewood by the corner door, a can; the cone on the roof; one car
    const at = (bk, x, z, rot = 0, r = .4) => wput(raw, bk, ...kerb(x, z), { rot, reach: r, loose: true });
    at(phoneBooth(), 17.6, 186.4, 1); at(newsBox(0x2f5bff), 27.3, 181.6, 3); at(bench(), 21.4, 185.3, 2); at(firewood(), 24.2, 185.2, 0); at(trashCan(0x3d3f46), 27.3, 177.5);
    ctx.put(cone(), 24.4, 178.8, { y: SIDE + H * CV, reach: .6 });
    at(car((s.seed % 97) | 0), 22.7, 187, 1, .3);
    // ── Kent & Pine's corner life (downtown's dealing corners, baseline): a milk-crate seat in the Kent St kerb strip just past the corner
    // square, a payphone at the Pine St frontage; both clear of the walkers' corner lines, the clear path and the hotspot's square
    ctx.group('corner');
    ctx.put(milkCrate(PAL.red), 29.45, 186.3, { reach: 0 }); ctx.put(milkCrate(0x2f5bff), 29.45, 185.7, { reach: 0 }); ctx.put(milkCrate(0xffc21a), 29.45, 186.3, { y: SIDE + .5, reach: 0 });
    ctx.put(phoneBooth(), 24.3, 188.55, { rot: 0, slide: [1, 0], reach: .4 });
    // the home upstairs: the sim-state layer's anchor (the door is the apartment's street door; the windows are upstairs)
    const r2 = v => +v.toFixed(2), wv = (f, a) => { const [x, z] = f.xz(a + 6.5, 0); return [r2(X0 + (x + .5) * CV), r2(Z0 + (z + .5) * CV)]; }, kx = x => r2(kerb(x, 0)[0]), kz = z => r2(kerb(0, z)[1]);   // (kx / kz: the anchor's frame metres → the spread world)
    const winAnchors = wins.map(([k, a]) => { const f = k === 'S' ? S : Ef, [x, z] = wv(f, a); return k === 'S' ? [kx(x), r2(SIDE + 5.15), kz(r2(BZ1 + .07)), 1.3, 1.5] : [kx(r2(BX1 + .07)), r2(SIDE + 5.15), kz(z), 1.3, 1.5, 1]; });
    ctx.anchor.lot(LOT, { tier: 'house', rot: 0, face: [0, 1], door: [kx(18.7), SIDE, kz(r2(BZ1 + .55))], sign: [kx(18.6), kz(187.6)], yard: [kx(21), kz(176.6)], wall: [kx(22.1), r2(SIDE + 5), kz(r2(BZ1 + .02)), 9, 3],
      windows: winAnchors, roof: r2(SIDE + H * CV), house: [kx(BX0), kz(BZ0), kx(BX1), kz(BZ1)] });
    // ── the other three houses of the block, as the kit builds them everywhere
    buildLots(raw, raw.simLots, { skip: q => q.id === LOT });
  } finally { REG.strict = false; }
  ctx.finish();
}
