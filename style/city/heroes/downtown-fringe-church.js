// GLASSWALL · THE DOWNTOWN FRINGE · block 1,1 (Kent St & Washington St, a parking block) · owner: the downtown fringe agent (batch 5).
//   OUR LADY OF LOST CAUSES and its soup line. A bone-white stone church on the corner across Washington St from the WASHINGTON subway
//   (and the Kent & Washington crew): a square bell tower with a clock and a copper spire (the south side's landmark from the overview),
//   a pitched slate nave with a rose window over red doors, lancet windows in stained glass that glow at night, the changeable-letter board
//   (SOUP 12-2 · BINGO FRI · SINNERS OK), and the brick parish hall on Kent St whose door is the soup kitchen: a green canopy, the pots on
//   the table inside, a volunteer, and the line along the wall. The parish lot on Linden St; brownstones on Lincoln St (the generator).
// Ids read 1_1·church·kind·n for the church and 1_1·L<k>·kind·n for the generated lots.
import { fillBlock, mk, framed } from '../districts/downtown/fill.js';   // (SPREAD: authored in today's metres, the block's frame)
import { kerbX, kerbZ } from '../districts/frame.js';
import { blockCtx } from '../engine.js';
import { kitNow } from '../gen.js';
import { REG } from '../audit.js';
import { stamp } from '../vox.js';
import { AIR, TOD } from '../kit.js';
import { PAL, CV, SIDE, hash } from '../style.js';
import { car, acBox, vent, trashCan } from '../props.js';

const STONE = 0xe6e1d6, TRIM = 0x9a9ca6, SLATE = 0x565a66, SLATE2 = 0x4a4e59, COPPER = 0x3fa37a, COPPER2 = 0x348a67, DOOR = 0xb3122e, BRICK = 0x9b4f3a, CANOPY = 0x14a83b;
const GLASS = [0xe8232a, 0x2f5bff, 0xffe23a, 0x14a83b, 0x7a3cff, 0xff7a1a];
const lit = (day = 1) => TOD.night ? 3 : day;

export function church(bank, b, A) {
  fillBlock(bank, b, A, { seed: 51101,
    lots: [mk(36, 52, 44, 60, ['+z', '-x'], 'SW'), mk(44, 52, 52, 60, ['+z']), mk(52, 52, 60, 60, ['+z', '+x'], 'SE')],
    // the parts as the lots see them (top in metres, nh in voxels: the same height, so nothing a lot paints runs into a planned part)
    heroes: [{ rect: [36, 36, 42, 42], top: SIDE + 31.4, nh: 314, group: 'church', faces: ['-z', '-x'] }, { rect: [36, 42, 42, 52], top: SIDE + 5.2, nh: 52, group: 'church', faces: ['-x'] },
      { rect: [42, 36, 52, 52], top: SIDE + 14, nh: 140, group: 'church', faces: ['-z', '+x'] }, { rect: [52, 36, 60, 52], top: SIDE + 1.4, nh: 14, open: true, group: 'church', faces: ['-z', '+x'] }],
    build() { const ctx = framed(blockCtx(bank, b, A, kitNow())); REG.group('church'); REG.strict = true;
      try { tower(ctx); nave(ctx); hall(ctx); lot(ctx); ctx.finish(); } finally { REG.strict = false; } people(A); } });
}

// a pointed (lancet) opening on a frame: a0..a0+w, y0..y1 (straight sides) plus the point; glass(a, y) paints it, recessed `dep`
function lancet(f, a0, w, y0, y1, glass, dep = 2, frameCol = TRIM) {
  const pt = w >> 1, top = y => y < y1 ? [a0, a0 + w] : [a0 + Math.round((y - y1) * .7), a0 + w - Math.round((y - y1) * .7)];
  for (let y = y0; y < y1 + pt; y++) { const [l, r] = top(y); if (r - l < 1) break; f.box(l, y, -dep, r, y + 1, 1, AIR); f.box(l, y, -dep - 1, r, y + 1, -dep, (a) => glass(a - a0, y - y0), lit(1));
    f.box(l - 1, y, 0, l, y + 1, 2, frameCol); f.box(r, y, 0, r + 1, y + 1, 2, frameCol); }
  f.box(a0 - 2, y0 - 2, 0, a0 + w + 2, y0, 3, frameCol);   // the sill
}
const stripes = (a, y) => GLASS[((a >> 2) + (y >> 3)) % GLASS.length];

// ── the bell tower: 18 m of stone, the clock, the belfry and the copper spire with its cross (the corner of Kent & Washington)
function tower(ctx) {
  const T = ctx.building(36, 36, 42, 42, { h: 18, wall: STONE, trim: TRIM, faces: ['-z', '-x'], parapet: 0, cornice: false, extra: 140, roof: 0xd9d5cc }), V = T.V, B = T.B, H = 180;
  for (const side of ['-z', '-x', '+x', '+z']) { const f = T.F(side), L = f.len, street = side === '-z' || side === '-x';
    if (street) { f.box(0, 0, 0, L, 8, 2, TRIM); for (let y = 8; y < 150; y += 12) for (const a of [0, L - 5]) f.box(a, y, 0, a + 5, y + 6, 2, TRIM); }   // plinth + quoins
    f.box(-1, 150, 0, L + 1, 154, 3, TRIM); f.box(-1, 176, 0, L + 1, H, 3, TRIM);                                                            // belfry string courses
    // the belfry: a pointed opening on every side, dark inside, the bell hanging in the middle of the shaft
    const bw = 22, ba = (L - bw) >> 1; for (let y = 156; y < 172; y++) { const inset = y < 166 ? 0 : Math.round((y - 166) * .9); if (bw - 2 * inset < 2) break; f.box(ba + inset, y, -31, ba + bw - inset, y + 1, 1, AIR); }
    f.box(ba - 2, 154, 0, ba + bw + 2, 156, 3, TRIM);
    if (side === '-x') lancet(f, (L >> 1) - 5, 10, 60, 110, stripes);
  }
  V.box(B.x0 + 8, 154, B.z0 + 8, B.x1 - 8, 155, B.z1 - 8, 0x3b3d45);   // belfry floor
  const cx = (B.x0 + B.x1) >> 1, cz = (B.z0 + B.z1) >> 1; V.box(cx - 1, 166, cz - 1, cx + 1, 176, cz + 1, PAL.iron);   // the bell's yoke and the bell
  for (let y = 158; y < 167; y++) { const r = 2.5 + (166 - y) * .45; for (let x = -7; x <= 7; x++) for (let z = -7; z <= 7; z++) if (x * x + z * z <= r * r) V.set(cx + x, y, cz + z, PAL.gold, 2); }
  // the clock on the Washington St face, its hands at ten past ten, lit at night
  const N = T.F('-z'), ca = N.len >> 1, cy = 128;
  for (let dy = -12; dy <= 12; dy++) for (let da = -12; da <= 12; da++) { const r = Math.hypot(da, dy); if (r > 12.4) continue; N.set(ca + da, cy + dy, 1, r > 10.5 ? TRIM : 0xfbf6e6, r > 10.5 ? 0 : lit(0)); if (r > 10.5) N.set(ca + da, cy + dy, 2, TRIM); }
  for (let k = 0; k < 12; k++) { const t = k / 12 * Math.PI * 2; N.set(ca + Math.round(Math.sin(t) * 9), cy + Math.round(Math.cos(t) * 9), 2, PAL.ink); }
  for (let t = 0; t <= 7; t++) { N.set(ca - Math.round(t * .8), cy + Math.round(t * .45), 2, PAL.ink); if (t <= 5) N.set(ca + Math.round(t * .8), cy + Math.round(t * .45), 2, PAL.ink); }
  // the changeable-letter board over the sidewalk to the subway: SOUP 12-2 · BINGO FRI · SINNERS OK (white, lit, in a black frame)
  N.box(3, 26, 0, 57, 60, 2, PAL.ink); N.box(5, 28, 1, 55, 58, 3, 0xf7f7f2, lit(0));
  for (const [s, y] of [['SOUP 12-2', 55], ['BINGO FRI', 45], ['SINNERS OK', 35]]) N.text(s, 30, y, 3, 4, PAL.ink, 0, 1, 1);
  // the spire: a steep copper pyramid on the tower top, four stone pinnacles, the gold cross
  V.box(B.x0, H, B.z0, B.x1, H + 2, B.z1, TRIM);
  for (const [px, pz] of [[B.x0, B.z0], [B.x1 - 5, B.z0], [B.x0, B.z1 - 5], [B.x1 - 5, B.z1 - 5]]) { V.box(px, H + 2, pz, px + 5, H + 14, pz + 5, STONE); V.box(px + 1, H + 14, pz + 1, px + 4, H + 18, pz + 4, TRIM); }
  let k = 0; for (let y = H + 2; ; y += 4, k++) { const x0 = B.x0 + 5 + k, x1 = B.x1 - 5 - k, z0 = B.z0 + 5 + k, z1 = B.z1 - 5 - k; if (x1 - x0 < 2) { V.box(cx - 1, y, cz - 1, cx + 1, y + 2, cz + 1, COPPER); var spireTop = y + 2; break; }
    V.box(x0, y, z0, x1, y + 4, z1, (x, yy, z) => (yy - H) % 16 < 3 && (x === x0 || x === x1 - 1 || z === z0 || z === z1 - 1) ? COPPER2 : COPPER); }
  V.box(cx - 1, spireTop, cz - 1, cx + 1, spireTop + 22, cz + 1, PAL.gold, 2); V.box(cx - 6, spireTop + 13, cz - 1, cx + 6, spireTop + 16, cz + 1, PAL.gold, 2);
}

// ── the nave: stone walls 8 m, a slate roof pitched along Kent St, the gable on Washington St with its doors, name and rose window
function nave(ctx) {
  const Nv = ctx.building(42, 36, 52, 52, { h: 8, wall: STONE, trim: TRIM, faces: ['-z', '+x'], parapet: 0, cornice: false, extra: 62, roof: 0xd9d5cc }), V = Nv.V, B = Nv.B, H = 80;
  const xc = (B.x0 + B.x1) / 2, half = (B.x1 - B.x0) / 2 + 3, yt = x => H + Math.round((half - Math.abs(x + .5 - xc)) * 1.04);
  for (let x = B.x0 - 3; x < B.x1 + 3; x++) { const t = yt(x);
    if (x >= B.x0 && x < B.x1) V.box(x, H, B.z0, x + 1, t - 2, B.z1, STONE);                                                       // the attic (solid)
    V.box(x, Math.max(H - 3, t - 3), B.z0 - 3, x + 1, t, B.z1, (xx, y, z) => (z - B.z0) % 10 === 0 && y === t - 1 ? SLATE2 : SLATE); }   // the slate roof (overhanging the street gable, flush over the lots behind)
  V.box(Math.floor(xc) - 1, yt(Math.floor(xc)), B.z0 - 3, Math.ceil(xc) + 1, yt(Math.floor(xc)) + 2, B.z1, SLATE2);                // ridge cap
  // the Washington St gable
  const G = Nv.F('-z'), L = G.len, m = L >> 1;
  G.box(0, 0, 0, L, 8, 2, TRIM); for (const a of [0, L - 5]) for (let y = 8; y < H; y += 12) G.box(a, y, 0, a + 5, y + 6, 2, TRIM);
  // the doors: a pointed arch recessed 0.8 m, two red leaves with iron straps and brass rings, the stone surround
  const dw = 26, d0 = m - (dw >> 1);
  for (let y = 0; y < 52; y++) { const inset = y < 38 ? 0 : Math.round((y - 38) * .95); if (dw - 2 * inset < 2) break; G.box(d0 + inset, y, -8, d0 + dw - inset, y + 1, 1, AIR);
    G.box(d0 + inset, y, -9, d0 + dw - inset, y + 1, -8, (a) => a === m || a === m - 1 ? PAL.iron : (y === 12 || y === 28) ? PAL.iron : DOOR);
    G.box(d0 + inset - 3, y, 0, d0 + inset, y + 1, 2, TRIM); G.box(d0 + dw - inset, y, 0, d0 + dw - inset + 3, y + 1, 2, TRIM); }
  for (const a of [m - 4, m + 3]) G.box(a, 18, -8, a + 1, 20, -7, PAL.gold, 2);
  G.box(d0 - 4, 0, -8, d0 + dw + 4, 2, 1, TRIM);                                                                                   // the worn step in the recess
  // the name, carved: OUR LADY OF / LOST CAUSES on a stone band
  G.box(m - 38, 56, 0, m + 38, 76, 2, TRIM); G.text('OUR LADY OF', m, 73, 2, 3, PAL.ink, 0, 1, 1); G.text('LOST CAUSES', m, 64, 2, 3, PAL.ink, 0, 1, 1);
  // the rose window
  const rc = 98; for (let dy = -15; dy <= 15; dy++) for (let da = -15; da <= 15; da++) { const r = Math.hypot(da, dy); if (r > 15.4) continue;
    if (r > 12.5) { G.set(m + da, rc + dy, 1, TRIM); G.set(m + da, rc + dy, 2, TRIM); continue; }
    const ang = Math.atan2(dy, da), petal = ((ang + Math.PI) / (Math.PI * 2) * 8 + .5) | 0, spoke = Math.abs(((ang + Math.PI) / (Math.PI * 2) * 8) % 1 - .5) > .44 && r > 3;
    G.set(m + da, rc + dy, 0, AIR); G.set(m + da, rc + dy, -1, spoke || (r > 8 && r < 9.2) ? TRIM : r < 3.5 ? PAL.yellow : GLASS[petal % 4], spoke ? 0 : lit(1)); }
  // the long side over the parish lot: four lancets between stepped buttresses
  const E = Nv.F('+x'); E.box(0, 0, 0, E.len, 8, 2, TRIM);
  for (const a of [20, 60, 100, 140]) lancet(E, a - 6, 12, 18, 58, stripes);
  for (const a of [40, 80, 120]) { E.box(a - 3, 0, 0, a + 3, 64, 5, TRIM); E.box(a - 3, 0, 5, a + 3, 40, 9, TRIM); }
  // the Kent St side over the hall's roof: clerestory lancets
  const W = Nv.F('-x'); for (const a of [30, 70, 110, 150]) lancet(W, a - 4, 8, 54, 68, stripes, 2);
}

// ── the parish hall on Kent St: brick, one storey, the soup kitchen door under a green canopy, the pots inside, the volunteer
function hall(ctx) {
  const P = ctx.building(36, 42, 42, 52, { h: 4.6, wall: BRICK, trim: PAL.cream, faces: ['-x'], parapet: 4, extra: 16 }), f = P.F('-x'), L = f.len, V = P.V, B = P.B;
  // the door (a 0 at the tower end): open, the lit room behind it, a table with two pots and the steam off them
  const da = 8, dw = 16; f.box(da, 0, -30, da + dw, 28, 1, AIR); f.box(da - 2, 0, 0, da + dw + 2, 30, 2, PAL.cream); f.box(da, 0, -30, da + dw, 28, 0, AIR);
  f.box(da, 0, -31, da + dw, 28, -30, 0xfff0c8, lit(1)); f.box(da, 27, -30, da + dw, 28, 0, 0xfff7dc, lit(1));
  f.box(da + 1, 7, -9, da + dw - 1, 8, -4, 0xf7f7f2); f.box(da + 2, 0, -8, da + 3, 7, -7, PAL.iron); f.box(da + dw - 3, 0, -8, da + dw - 2, 7, -7, PAL.iron);
  for (const pa of [da + 4, da + 10]) { f.box(pa - 2, 8, -8, pa + 3, 13, -5, 0x8f949c, 2); f.box(pa - 2, 13, -8, pa + 3, 14, -5, 0x6f747c, 2); if (hash(pa, 7) > -1) { f.set(pa, 16, -7, 0xf7f7f2); f.set(pa + 1, 18, -6, 0xf7f7f2); f.set(pa, 20, -7, 0xf7f7f2); } }
  REG.door(...(() => { const [x, z] = f.xz(da + (dw >> 1), 0), o = V.org; return [o[0] + (x + .5) * CV - .5, o[2] + (z + .5) * CV]; })(), 3);
  // the canopy over the line: green, 1 m deep, SOUP KITCHEN on its fascia, 3 m up (the walkers pass under it)
  f.box(4, 30, 0, L - 6, 33, 10, CANOPY); f.box(4, 24, 9, L - 6, 33, 10, CANOPY); f.text('SOUP KITCHEN', (L - 2) >> 1, 31, 10, 11, PAL.white, lit(0), 1, 1);
  // two windows (a lit card in one), and a cork board of notices between them
  for (const a of [32, 80]) { f.box(a, 8, -2, a + 14, 24, 1, AIR); f.box(a, 8, -3, a + 14, 24, -2, (aa, y) => y > 20 ? PAL.litHi : PAL.glassLo, 1); f.box(a - 1, 6, 0, a + 15, 8, 2, PAL.cream); f.box(a - 1, 24, 0, a + 15, 26, 2, PAL.cream); }
  f.box(35, 11, -2, 41, 17, -1, 0xffe23a, lit(1));
  f.box(52, 6, 0, 74, 26, 1, 0x7a4a22); f.box(53, 7, 0, 73, 25, 1, 0xc9a26b);   // (flush with the wall: the line's heads pass it)
  for (const [a, y, w, h, c] of [[55, 17, 5, 6, 0xf7f7f2], [62, 18, 4, 5, 0xffe23a], [68, 16, 4, 7, 0xf7f7f2], [56, 9, 6, 5, 0x9fd8ff], [64, 9, 7, 6, 0xf7f7f2]]) { f.box(a, y, 0, a + w, y + h, 1, c); f.set(a + (w >> 1), y + h - 1, 0, PAL.red); }
  // the roof: a hatch and the kitchen's vents (stamped plain: strict mode reads a roof as its own mass)
  const top = P.top; REG.strict = false; stamp(vent(1), ctx.bank, 0, kerbX(37.2), top, kerbZ(50.6)); stamp(vent(0), ctx.bank, 0, kerbX(38.4), top, kerbZ(50.6)); stamp(acBox(), ctx.bank, 1, kerbX(40.4), top, kerbZ(47.5)); REG.strict = true;
}

// ── the parish lot on Linden St: asphalt, stalls, a low brick wall with railings (a gap for the drive), three cars
function lot(ctx) {
  const [x0, z0, x1, z1] = [53, 36, 60, 52], W = ctx.volume(x0, SIDE, z0, x1, SIDE + 1.3, z1, { walk: true });   // (one volume: the asphalt and its wall share no faces; a gravel strip under the buttresses)
  W.box(0, 0, 0, W.nx, 1, W.nz, (x, y, z) => (z % 26 === 0 && x > 24 && x < W.nx - 4) ? PAL.lineW : PAL.asphalt);
  const wall = (x, z, x2, z2) => { W.box(x, 0, z, x2, 6, z2, BRICK); W.box(x, 6, z, x2, 7, z2, PAL.cream); for (let t = 0; t < Math.max(x2 - x, z2 - z); t += 3) { const px = x2 - x > z2 - z ? x + t : x, pz = x2 - x > z2 - z ? z : z + t; W.box(px, 7, pz, px + 1, 13, pz + 1, PAL.iron); }
    W.box(x, 12, z, x2, 13, z2, PAL.iron); };
  wall(0, 0, W.nx, 3);                                           // along Washington St
  wall(W.nx - 3, 3, W.nx, 72); wall(W.nx - 3, 112, W.nx, W.nz);   // along Linden St, the drive between (z 43.2 … 47.2)
  for (const [z, s, r] of [[39.4, 11, 1], [42.0, 23, 3], [49.4, 37, 1]]) ctx.put(car(s), 56.2, z, { rot: r, slide: [0, 1], reach: .6 });
  ctx.put(trashCan(0x2f5bff), 53.6, 50.8, { reach: .6 });
}

// ── the people: the line along the hall (they face the door), the volunteer serving, a man in black at the doors
function people(A) {
  // the kerb strip across from the line: trees, bins and bags keep off it, so the walkers' clear path (0.9 m) runs between the line
  // and the curb
  REG.keep([kerbX(34), SIDE, kerbZ(43.8), kerbX(34.95), SIDE + 4, kerbZ(51.6)], 'walkway');   // (a walkers' reservation: props keep off it, the lane may use it)
  const P = (x, z, ry, act, seed, y = SIDE) => A.life.push({ x: kerbX(x), y, z: kerbZ(z), ry, act, seed, hand: true });
  [[45.0, 'stand'], [45.9, 'phone'], [46.8, 'stand'], [47.7, 'carry'], [48.6, 'stand'], [49.5, 'arms'], [50.4, 'stand']].forEach(([z, act], k) => P(35.68, z, Math.PI + (hash(k, 3) - .5) * .5, act, 1101 + k * 13));
  A.life.push({ x: kerbX(37.3), y: SIDE, z: kerbZ(43.7), ry: -Math.PI / 2, act: 'clerk', seed: 1190, hand: true });
  P(47.0, 35.45, Math.PI, 'stand', 1191);
}
