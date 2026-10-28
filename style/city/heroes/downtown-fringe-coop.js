// GLASSWALL · THE DOWNTOWN FRINGE · block −5,−1 (Elm St & Central Ave, Sunny Acres across Elm St) · owner: the downtown fringe agent
// (batch 5).
//   THE COOP. A block of six-storey tenements (the shared generator, the fringe's west grammar), and on the tallest roof that has room
//   the pigeon man's loft: a wooden deck on short legs, a green coop with a white-trimmed tin roof, a mesh trap over the landing board
//   with the birds on it, more on the ridge, a bamboo pole with a red rag to wave the flock up, the old man in his lawn chair and the kid
//   with the pole. From the overview a green coop and a pale deck on a tenement roof over the trailer park.
// Ids read -5_-1·coop·kind·n for the coop and -5_-1·L<k>·kind·n for the generated lots.
import { kitNow } from '../gen.js';
import { fillBlock, mk, framed } from '../districts/downtown/fill.js';   // (SPREAD: authored in today's metres, the block's frame)
import { off, kerbX, kerbZ } from '../districts/frame.js';
import { blockCtx } from '../engine.js';
import { REG } from '../audit.js';
import { stamp } from '../vox.js';
import { AIR } from '../kit.js';
import { PAL, SIDE, CV, hash } from '../style.js';
import { lawnChair, milkCrate } from '../props.js';
import { brush, person } from '../districts/downtown/lib.js';

const DL = 4.8, DW = 3.2, GREEN = 0x25b84c, WHITE = 0xf7f7f2, TIN = 0x9aa0a8, TIN2 = 0x868c95, WOOD = 0xa4652f, WOODD = 0x6e3e19, MESH = 0xb9bec6;

// the block laid out by hand so the pigeon man's tenement is big enough: a 10 m six-storey corner on Elm St & 1st St (its set piece is the
// coop); the rest is the generator's west grammar
export function pigeonCoop(bank, b, A) {
  fillBlock(bank, b, A, { seed: 51501,
    lots: [mk(-156, -28, -146, -18, ['-z', '-x'], 'NW', { pin: { type: 'walkup', st: 6, piece: null, gag: null, fire: true } }), mk(-146, -28, -140, -21, ['-z']), mk(-140, -28, -134, -20, ['-z', '+x'], 'NE'),
      mk(-140, -20, -134, -13, ['+x']), mk(-141, -13, -134, -6, ['+z', '+x'], 'SE'), mk(-149, -13, -141, -6, ['+z']), mk(-156, -13, -149, -6, ['+z', '-x'], 'SW'), mk(-156, -18, -149, -13, ['-x'])],
    after(lots) { const spot = findRoof([lots[0]]); REG.group('coop');
      if (!spot) { REG.skip('coop', [kerbX(-151), SIDE, kerbZ(-23)], 'no room for the coop on the corner roof'); return; }
      const [sx, sz] = off(b), r = spot.rect, fr = [r[0] - sx, r[1] - sz, r[2] - sx, r[3] - sz];   // (the spot was found on the built lots, in the spread world: back to the frame)
      const ctx = framed(blockCtx(bank, b, A, kitNow())); REG.strict = true; try { coop(ctx, A, { ...spot, rect: fr }); ctx.finish(); } finally { REG.strict = false; } } });
}
// the tallest walk-up roof (five storeys or more, no set piece, no billboard) with a clear 4.8 × 3.2 m patch 0.3 m off its roof items
function findRoof(lots) {
  const items = REG.blk?.boxes || [], cands = lots.filter(l => l.spec && ['walkup', 'loft', 'bodega'].includes(l.spec.type) && !l.spec.piece && l.spec.gag?.kind !== 'billboard' && l.spec.st >= 5 && l.H)
    .sort((p, q) => q.H - p.H || p.x0 - q.x0);
  for (const l of cands) { const top = SIDE + l.H * CV, set = l.spec.ground === 'stoop' ? 2.5 : 0, m = l.main;
    const R = [l.x0 + .45 + (m === '-x' ? set : 0), l.z0 + .45 + (m === '-z' ? set : 0), l.x1 - .45 - (m === '+x' ? set : 0), l.z1 - .45 - (m === '+z' ? set : 0)];
    const mine = items.filter(it => it.box[4] > top - .05 && it.box[1] < top + 3 && it.box[3] > R[0] && it.box[0] < R[2] && it.box[5] > R[1] && it.box[2] < R[3]);
    for (const alongX of [R[2] - R[0] >= R[3] - R[1], R[2] - R[0] < R[3] - R[1]]) { const sx = alongX ? DL : DW, sz = alongX ? DW : DL;
      for (let x = R[0]; x + sx <= R[2] + 1e-6; x += .25) for (let z = R[1]; z + sz <= R[3] + 1e-6; z += .25)
        if (!mine.some(it => it.box[3] > x - .3 && it.box[0] < x + sx + .3 && it.box[5] > z - .3 && it.box[2] < z + sz + .3)) return { l, top, rect: [x, z, x + sx, z + sz], alongX }; } }
  return null;
}

function coop(ctx, A, { top, rect: [x0, z0, x1, z1], alongX }) {
  const V = ctx.volume(x0, top, z0, x1, top + 3.2, z1, { walk: true }), P = brush(V);
  // deck-local: u along the deck (0 … 4.8, the coop at u 0 … 2.4), v across (0 … 3.2)
  const Bx = (u0, y0, v0, u1, y1, v1, c, l = 0) => alongX ? P.box(x0 + u0, top + y0, z0 + v0, x0 + u1, top + y1, z0 + v1, c, l) : P.box(x0 + v0, top + y0, z0 + u0, x0 + v1, top + y1, z0 + u1, c, l);
  const W = (u, v) => alongX ? [x0 + u, z0 + v] : [x0 + v, z0 + u];
  // the deck on its legs
  for (const [u, v] of [[.1, .1], [DL - .3, .1], [.1, DW - .3], [DL - .3, DW - .3], [2.4, .1], [2.4, DW - .3]]) Bx(u, 0, v, u + .2, .3, v + .2, WOODD);
  Bx(0, .3, 0, DL, .4, DW, (x, y, z) => ((((alongX ? z : x) * 10) | 0) % 4 === 0) ? WOODD : WOOD);
  // the coop: green walls, white corners, a low tin roof in stripes, the mesh trap and the landing board on its open-deck face (u 2.4)
  Bx(.1, .4, .1, 2.4, 2.4, DW - .1, GREEN); for (const v of [.1, DW - .3]) { Bx(.1, .4, v, .3, 2.4, v + .2, WHITE); Bx(2.2, .4, v, 2.4, 2.4, v + .2, WHITE); }
  for (let k = 0; k < 6; k++) { const y = 2.4 + k * .1, i = k * .22; Bx(0, y, i, 2.5, y + .1, DW - i, (x, yy, z) => ((((alongX ? x : z) * 10) | 0) % 3 === 0) ? TIN2 : TIN); }
  Bx(1.9, .9, .5, 2.4, 2.0, 2.0, AIR); Bx(1.8, .9, .5, 1.9, 2.0, 2.0, 0x2a2d38);                                            // the trap: dark inside…
  for (let y = .9; y < 2.0; y += .1) for (let v = .5; v < 2.0; v += .1) if ((Math.round(y * 10) + Math.round(v * 10)) % 2 === 0) Bx(2.3, y, v, 2.4, y + .1, v + .1, MESH);   // …behind the mesh
  Bx(2.0, .9, .7, 2.2, 1.02, .82, WHITE); Bx(2.0, .9, 1.4, 2.2, 1.02, 1.52, 0x8f949c);                                        // two birds inside
  Bx(2.4, .8, 2.3, 2.5, 2.1, 2.9, WHITE); Bx(2.4, .9, 2.4, 2.5, 2.0, 2.8, 0x2f5bff);                                         // the little door in its frame
  Bx(2.4, .7, .3, 2.8, .8, 2.2, WOOD);                                                                                         // the landing board
  // birds on the ridge and the landing board (grey bodies, white heads, drawn on the roof so they sit on it)
  const bird = (u, y, v, c = 0x8f949c) => { Bx(u, y, v, u + .2, y + .12, v + .12, c); Bx(u + .14, y + .12, v, u + .22, y + .2, v + .12, WHITE); };
  for (const [u, v] of [[.4, 1.55], [.9, 1.55], [1.6, 1.55]]) bird(u, 3.0, v);
  for (const [v, c] of [[.6, 0x8f949c], [1.2, 0x6d707a], [1.8, WHITE]]) bird(2.5, .8, v, c);
  for (const [u, v, c] of [[3.0, 2.0, 0x8f949c], [3.3, 2.6, 0x6d707a], [2.8, 2.8, WHITE], [3.6, 2.2, 0x8f949c]]) bird(u, .4, v, c);   // and pecking on the deck
  // the pole with the red rag, in its holder at the deck's far corner
  Bx(DL - .35, .4, DW - .35, DL - .25, 3.2, DW - .25, 0xc9b77a); Bx(DL - .25, 2.7, DW - .34, DL - .05, 3.15, DW - .26, 0xe8232a);
  // a line from the pole's top to the coop's ridge, birds perched all along it (every voxel of the line touches the next)
  { const [ua, ya, va, ub, yb, vb] = [DL - .3, 3.05, DW - .3, 2.45, 2.95, 1.6], n = Math.ceil(Math.hypot(ua - ub, va - vb) / .07);
    for (let q = 0; q <= n; q++) { const t = q / n, u = ua + (ub - ua) * t, v = va + (vb - va) * t, y = ya + (yb - ya) * t - Math.sin(t * Math.PI) * .25; Bx(u - .05, y - .05, v - .05, u + .05, y + .05, v + .05, 0x3b3d45);
      if (q % 6 === 3 && q < n - 2) { Bx(u - .1, y + .05, v - .06, u + .1, y + .17, v + .06, [0x8f949c, 0x6d707a, WHITE][q % 3]); Bx(u - .04, y + .17, v - .06, u + .04, y + .23, v + .06, WHITE); } } }
  // the old man's chair, a crate and a feed bucket; two flocks on the deck (stamped plain: the deck is their floor)
  const ft = top + .4; REG.strict = false;
  const put = (bk, rot, u, v) => { const [x, z] = W(u, v); stamp(bk, ctx.bank, alongX ? rot : [1, 0, 3, 2][rot], kerbX(x), ft, kerbZ(z)); };   // (rot in the deck's frame: +u is +x along x, +z along z)
  put(lawnChair(0xffe23a), 3, 3.6, .9); put(milkCrate(PAL.red), 0, 4.4, .5); REG.strict = true;
  P.cyl(W(3.1, .45)[0], W(3.1, .45)[1], .16, ft, ft + .3, 0x9aa0a8);
  const [sx, sz] = W(3.6, .95), [kx, kz] = W(4.25, 2.45), face = alongX ? -Math.PI / 2 : Math.PI;
  person(A, sx, sz, face, 'sit', 5101, ft, { seatY: .45 }); person(A, kx, kz, face + .5, 'reach', 5102, ft);
}
