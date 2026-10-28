// NEON ROW · block −2,1 (Jay St west side, Washington to Lincoln) · owner: the Neon Row agent. Ids read -2_1·market·kind·n,
// -2_1·karaoke·kind·n, -2_1·festoon·structure·0 for the hand-made pieces and -2_1·L<k>·kind·n for the generated lots.
//   THE JAY ST NIGHT MARKET on the Jay & Washington corner: a parking lot that turns into a market — faded stall lines on the asphalt,
//   an arch on Washington St, eight stalls under striped tarps (every sign once), a picnic-table yard in the middle, festoon lights on
//   iron poles, and two strings across Jay St to NO WITNESS. The corner apron stays open: the sim's corner hotspot stands there.
//   SING SING KARAOKE on Jay St: a violet walk-up with a bulb marquee, a tall SING SING blade, karaoke rooms on the second floor
//   (every window its own colour), two floors of apartments above (walk-up units for the sim) and, on the wall over the market, the
//   district's big mural — a toon singer belting into a mic, lit like a billboard at night. The fill adds a TAROT blade upstairs on
//   the Lincoln corner, two window neons and a hot-dog cart on Washington St.
import { fillBlock, mk, oneOff, shiftR, kerb } from '../districts/strip/fill.js';   // (SPREAD: MK, KA, the stalls, the festoon and the lots in today's metres, the block's frame)
import { kerbX, kerbZ } from '../districts/frame.js';
import { stall, stallSign, word, textW, windowNeon, hotDogCart } from '../districts/strip/props.js';
import { STALLS } from '../districts/strip/names.js';
import { blockCtx } from '../engine.js';
import { kitNow } from '../gen.js';
import { REG } from '../audit.js';
import { stamp, textMask } from '../vox.js';
import { win, AIR, TOD } from '../kit.js';
import { PAL, CV, SIDE, hash, shade } from '../style.js';
import { picnic, milkCrate, trashCan } from '../props.js';

const MK = [-48, 36, -36, 47], KA = [-43, 47, -36, 53.5];
const POLE = 4.6;                                   // festoon poles, metres above the lot
// the two strings across Jay St (z of each, its west end x and height); heroes/strip-club.js hangs their east ends on NO WITNESS
export const FESTOON = [{ z: 46.8, x0: -36.2, y0: SIDE + POLE }, { z: 51.2, x0: -35.9, y0: SIDE + 5.3 }], CLUB_HOOK = { x: -28.2, y: SIDE + 5.4 };

export function jayMarket(bank, b, A) {
  fillBlock(bank, b, A, { seed: 21101, pieces: ['party', 'grow'], noFaceMural: true,   // (the singer is this block's character mural)
    neon: ['palm', 'eightball'], neonFaces: [1, 2], blades: [{ lot: 3, side: '+x', text: 'TAROT', bg: 0x7a1020, fg: 0xffe23a, rim: 0xff4fa3 }],
    oneOff: (lots, keep) => oneOff(bank, lots, { where: [[1, '-z'], [0, '-z'], [0, '-x'], [6, '-x'], [7, '-x'], [2, '-x'], [2, '+z'], [4, '+z'], [5, '+z'], [3, '+z']], parts: [[hotDogCart(), 0, 0, 1.5]], lane: [.35, .98] }, keep),
    lots: [mk(-60, 36, -53, 43, ['-z', '-x'], 'NW'), mk(-53, 36, -48, 43, ['-z']), mk(-60, 53, -53, 60, ['+z', '-x'], 'SW'), mk(-43, 53.5, -36, 60, ['+z', '+x'], 'SE', { name: 'GOLD GRILLZ' }),
      mk(-53, 53.5, -48, 60, ['+z']), mk(-48, 53.5, -43, 60, ['+z']), mk(-60, 43, -53, 48, ['-x']), mk(-60, 48, -53, 53, ['-x'])],
    heroes: [{ rect: MK, top: SIDE + 4.4, nh: 44, open: true, group: 'market', faces: ['+x', '-z'] }, { rect: KA, top: SIDE + 13.4, nh: 133, group: 'karaoke', faces: ['+x'] }],
    build() { const ctx = blockCtx(bank, b, A, kitNow()); REG.strict = true;   // the hand-made pieces get the kit's guards (strict placement, text on boards)
      try { karaoke(ctx); ctx.finish(); market(ctx); ctx.finish(); festoon(ctx); ctx.finish(); } finally { REG.strict = false; } } });
}

// ═════════════════════════ the night market
function market(ctx) {
  REG.group('market'); const [x0, z0, x1, z1] = shiftR(ctx, MK), nx = Math.round((x1 - x0) / CV), nz = Math.round((z1 - z0) / CV), H = 58, LT = TOD.night ? 3 : 1;
  const V = ctx.volume(x0, SIDE, z0, x1, SIDE + H * CV, z1, { walk: true });
  // the lot: dark asphalt with faded yellow stall lines (it is a parking lot by day) and a pale painted border
  const ASPH = 0x4c4d5a, LINE = 0xd9b43a;
  V.box(0, 0, 0, nx, 1, nz, (x, y, z) => (x === 0 || z === nz - 1 || x === nx - 1 || z === 0) ? 0x6a6b78 : ((z % 26 === 12 && x > 6 && x < nx - 30) || (x === 60 && z > 12 && z < nz - 8)) && hash(x, z) > .2 ? LINE : ((x * 7 + z * 13) % 29 === 0 ? 0x444552 : ASPH));
  // a chain-link fence along the two back sides (L1 to the west, the yard to the south), iron posts at its ends
  const fence = (ax, az, bx, bz) => { for (let x = ax; x <= bx; x++) for (let z = az; z <= bz; z++) for (let y = 1; y < 16; y++) if ((x + y + z) % 2 === 0 || y === 15 || y === 1) V.set(x, y, z, 0x9aa0a8); };
  fence(0, 30, 0, nz - 1); fence(1, nz - 1, 68, nz - 1); V.box(0, 1, 30, 1, 18, 31, PAL.iron); V.box(0, 1, nz - 1, 1, 18, nz, PAL.iron); V.box(68, 1, nz - 1, 69, 18, nz, PAL.iron);
  // festoon poles (iron, a collar, a cap); the two on Washington St are the arch's posts. None near the corner apron (the hotspot).
  const P = { w: [2, 2], a: [78, 2], sw: [2, 105], s: [66, 105], se: [117, 108], e: [117, 36] }, top = Math.round(POLE / CV);
  for (const [px, pz] of Object.values(P)) { V.box(px - 1, 1, pz - 1, px + 2, 3, pz + 2, 0x2a2d38); V.box(px, 1, pz, px + 1, top + 1, pz + 1, PAL.iron); V.box(px - 1, top + 1, pz - 1, px + 2, top + 2, pz + 2, PAL.iron); }
  const BULBS = [0xffe23a, 0xff4fa3, 0x2de2e6, 0x6cff4a, 0xff7a1a];
  const string = ([ax, az], [bx, bz], sag, k0) => { const n = Math.round(Math.hypot(bx - ax, bz - az));
    for (let t = 0; t <= n; t++) { const u = t / n, x = Math.round(ax + (bx - ax) * u), z = Math.round(az + (bz - az) * u), y = top - Math.round(Math.sin(u * Math.PI) * sag);
      V.set(x, y, z, PAL.iron); if (t % 5 === 2 && t > 2 && t < n - 2) V.set(x, y - 1, z, BULBS[(t / 5 + k0 | 0) % 5], 3); } };
  string(P.w, P.se, 8, 0); string(P.a, P.sw, 8, 2); string(P.w, P.sw, 5, 1); string(P.sw, P.s, 5, 3); string(P.s, P.se, 5, 4); string(P.e, P.se, 4, 2); string(P.a, P.e, 6, 1); string(P.a, P.s, 7, 3);
  // THE ARCH on Washington St: the posts carry an ink board ringed in bulbs (they chase at night), JAY ST over NIGHT MARKET in neon
  const [aw, ae] = [P.w[0], P.a[0]], by0 = 30, by1 = 56, bz = 1;
  for (const x of [aw, ae]) V.box(x, top + 2, 2, x + 1, by1 + 1, 3, PAL.iron);
  V.box(aw + 1, by0, bz, ae, by1, bz + 2, PAL.ink); V.box(aw + 1, by1, bz, ae, by1 + 1, bz + 2, 0xc4122f); V.box(aw + 1, by0 - 1, bz, ae, by0, bz + 2, 0xc4122f);
  for (let x = aw + 2; x < ae - 1; x += 2) for (const y of [by0 + 1, by1 - 2]) V.set(x, y, bz - 1, (x >> 1) % 2 ? 0xffe23a : 0xff4fa3, LT);
  const mid = (aw + ae + 1) >> 1;   // the board faces −z (Washington St): seen from the street its letters run toward −x
  word(V, 'JAY ST', mid - (textW('JAY ST') >> 1), by1 - 5, bz - 1, 0xffe23a, 3, -1);
  word(V, 'NIGHT MARKET', mid - (textW('NIGHT MARKET') >> 1), by1 - 15, bz - 1, 0xff2d6f, 3, -1);
  // eight stalls, every sign once: the west row faces the aisle, the middle row faces back across it, two stalls sell to Jay St itself
  const TARPS = [0xe8232a, 0x2f5bff, 0x14a83b, 0xff7a1a, 0x7a3cff, 0xffc21a, 0x12b3a0, 0xff4fa3];
  const list = [   // [x, z, rot (its front), trade, steam]
    [-47.1, 38.9, 1, 'food', true], [-47.1, 41.6, 1, 'skewer', true], [-47.1, 44.3, 1, 'fruit', false],
    [-42.9, 38.9, 3, 'cups', false], [-42.9, 41.6, 3, 'discs', false], [-42.9, 44.3, 3, 'bags', false],
    [-36.8, 41.3, 1, 'shades', false], [-36.8, 44.0, 1, 'chains', false]];
  const front = (rot, d) => [[0, d], [d, 0], [0, -d], [-d, 0]][rot];
  list.forEach(([x, z, rot, trade, steam], k) => { const tarp = TARPS[k], at = ctx.put(stall(2100 + k, tarp, trade, steam), ...kerb(x, z), { rot, slide: rot & 1 ? [0, 1] : [1, 0], reach: .3 });
    if (!at) return; const [fx, fz] = front(rot, .55); stamp(stallSign(STALLS[k], shade(tarp, .82)), ctx.bank, rot, at[0] + fx, SIDE + CV + 2.3, at[1] + fz); });
  // the yard in the middle: two picnic tables, crate stools, a can
  ctx.put(picnic(0xc98a4b), ...kerb(-39.9, 39.9), { rot: 1, slide: [0, 1], reach: .6 }); ctx.put(picnic(0x2f5bff), ...kerb(-39.9, 43.9), { rot: 1, slide: [0, 1], reach: .6 });
  ctx.put(milkCrate(PAL.red), ...kerb(-40.9, 45.6), { slide: [1, 0], reach: .4 }); ctx.put(milkCrate(0xffe23a), ...kerb(-40.2, 46.0), { slide: [1, 0], reach: .4 }); ctx.put(trashCan(0x25b84c), ...kerb(-38.4, 46.1), { slide: [1, 0], reach: .6 });
}

// ═════════════════════════ the festoon across Jay St (west ends on the market's corner pole and on Sing Sing, east ends on NO WITNESS)
function festoon(ctx) {
  REG.group('festoon'); const xa = kerbX(FESTOON[0].x0), xb = kerbX(CLUB_HOOK.x), zs = FESTOON.map(f => kerbZ(f.z)), zo = Math.min(...zs) - .1;   // (SPREAD: across the wider street, market lot to club wall)
  const V = ctx.volume(xa, SIDE + 3.6, zo, xb, SIDE + 6, Math.max(...zs) + .2, { ground: false }), BULBS = [0xff4fa3, 0xffe23a, 0x2de2e6, 0x6cff4a, 0xff7a1a];
  const yi = m => Math.round((m - V.org[1]) / CV), zi = z => Math.floor((z - zo) / CV + 1e-6);
  for (const f of FESTOON) { const i0 = Math.round((kerbX(f.x0) - xa) / CV), n = V.nx - 1 - i0, ya = yi(f.y0), yb = yi(CLUB_HOOK.y), z = zi(kerbZ(f.z));
    for (let t = 0; t <= n; t++) { const u = t / n, yy = Math.round(ya + (yb - ya) * u - Math.sin(u * Math.PI) * 7); V.set(i0 + t, yy, z, PAL.iron); if (t % 5 === 3 && t > 3 && t < n - 3) V.set(i0 + t, yy - 1, z, BULBS[(t / 5 | 0) % 5], 3); } }
}

// ═════════════════════════ SING SING KARAOKE
function karaoke(ctx) {
  REG.group('karaoke'); const [x0, z0, x1, z1] = shiftR(ctx, KA), H = 126, VIO = 0x7a3cff, TR = PAL.cream, LT = TOD.night ? 3 : 1;
  const K = ctx.building(x0, z0, x1, z1, { h: H * CV, wall: VIO, trim: TR, faces: ['+x'], parapet: 6, extra: 24 }), f = K.F('+x'), L = f.len, O = K.V.org;   // a: 0 at the south end → 65 at the market
  const wx = a => O[0] + (f.xz(a, 0)[0] + 1) * CV, wz = a => O[2] + (f.xz(a, 0)[1] + .5) * CV;   // world x of the wall plane, z of the voxel column a
  // ground floor: a black front; the karaoke's door by the market (north), the apartments' street door at the south end, the lounge window
  f.box(0, 0, 0, L, 36, 2, PAL.ink); f.box(0, 0, 0, L, 4, 3, 0x2a2a30);
  const kd = 47; f.box(kd, 1, -4, kd + 14, 26, 2, AIR); f.box(kd, 1, -5, kd + 14, 26, -4, (a, y) => (y > 21 || a === kd + 7) ? 0xffb3d9 : 0x2a1030, LT);
  const ad = 3; f.box(ad, 1, -3, ad + 12, 25, 2, AIR); f.box(ad, 1, -4, ad + 12, 25, -3, (a, y) => y > 20 ? 0xffe3a0 : 0x0b5a3a, 1); f.box(ad + 12, 10, 2, ad + 14, 16, 3, 0xc9ced6, 2);
  const w0 = 19, w1 = 44; f.box(w0, 6, -8, w1, 26, 2, AIR); f.box(w0, 6, -9, w1, 26, -8, (a, y) => y > 22 ? 0xffd6ec : 0xd8338f, LT);   // pink glow, a sofa's back, the lyrics screen
  f.box(w0, 6, -8, w1, 9, -5, 0x3b1340); f.box(w0 + 3, 16, -8, w0 + 12, 22, -7, 0x1b2a55, 1); f.box(w0 + 4, 18, -7, w0 + 11, 19, -6, 0xffe23a, LT); f.box(w0 + 4, 20, -7, w0 + 9, 21, -6, 0xffffff, LT);
  f.box(w0 - 1, 5, 0, w1 + 1, 6, 4, TR);
  // THE MARQUEE: a pink box canopy over the door and the window, bulbs round its fascia and under it, KARAOKE across the front
  const m0 = 17, m1 = 64; f.box(m0, 28, 1, m1, 36, 12, 0xff4fa3); f.box(m0, 28, 12, m1, 36, 13, PAL.ink); f.box(m0, 27, 2, m1, 28, 12, 0x2a2a30);
  for (let a = m0 + 1; a < m1 - 1; a += 2) { f.set(a, 36, 12, (a >> 1) % 2 ? 0xffe23a : 0xfff3c4, LT); f.set(a, 27, 11, (a >> 1) % 2 ? 0xfff3c4 : 0xffe23a, LT); }
  f.text('KARAOKE', ((m0 + m1) >> 1) - (textW('KARAOKE') >> 1), 35, 13, 14, 0xffe23a, 3);
  for (const a of [m0 + 2, m1 - 3]) for (let t = 0; t <= 9; t++) f.set(a, 36 + t, 10 - t, PAL.iron);   // tie rods from the marquee's front edge back up to the wall
  // second floor: the karaoke rooms, each window its own light (a mirror ball in the middle one)
  const ROOM = [[0xff4fa3, 0xffc2e6], [0x2de2e6, 0xc8fbff], [0x8c52ff, 0xd9c6ff]];
  [[6, 0], [26, 1], [46, 2]].forEach(([a0, k]) => { const [c, hi] = ROOM[k]; f.box(a0 - 1, 43, 0, a0 + 14, 62, 2, TR); f.box(a0, 44, -3, a0 + 13, 61, 2, AIR);
    f.box(a0, 44, -4, a0 + 13, 61, -3, (a, y) => y > 57 ? hi : c, LT); f.box(a0 - 2, 41, 0, a0 + 15, 43, 3, TR); f.box(a0, 52, -3, a0 + 13, 53, -2, TR);
    if (k === 1) { f.box(a0 + 5, 55, -3, a0 + 8, 58, -2, 0xdfe6ee, 2); f.box(a0 + 6, 58, -3, a0 + 7, 61, -2, PAL.iron); } });
  f.box(22, 52, 1, 23, 54, 2, PAL.iron);   // the hook for the second festoon string, between two room windows (a 22 = z 51.2)
  // third and fourth floors: apartments — punched windows with sills; the sim lights them when somebody is home
  const units = [];
  for (const [n, y0] of [[1, 73], [2, 103]]) { const ws = [];
    for (const a0 of [9, 42]) { win(f, a0, y0, 13, 17, TR, {}); ws.push([+(wx(a0 + 6) + .07).toFixed(2), +(SIDE + (y0 + 8.5) * CV).toFixed(2), +wz(a0 + 6).toFixed(2), 1.3, 1.7]); }
    units.push({ id: `apt:${ctx.i}_${ctx.j}·karaoke·${n}`, floor: n + 1, windows: ws }); }
  // the SING SING blade: pink, ringed in cyan tube, two storeys at the north end, the letters on both faces (read up and down Jay St)
  const ba = 60, BL = 0xff2d95, CY = 0x2de2e6, yb0 = 40, yb1 = 112;
  f.box(ba, yb0, 2, ba + 3, yb1, 16, BL); f.box(ba, yb0 - 1, 2, ba + 3, yb0, 16, CY, 3); f.box(ba, yb1, 2, ba + 3, yb1 + 1, 16, CY, 3); f.box(ba, yb0, 15, ba + 3, yb1, 16, CY, 3);
  for (const y of [yb0 + 4, yb1 - 6]) f.box(ba + 1, y, 0, ba + 2, y + 2, 2, PAL.iron);
  [...'SINGSING'].forEach((ch, i) => blade(f, ch, ba, yb1 - 3 - i * 8 - (i >= 4 ? 4 : 0), 3, 14));
  f.box(ba - 1, 76, 5, ba + 4, 77, 12, 0xffe23a, 3);   // a gold bar between the two words
  ctx.anchor.building({ id: `bld:${ctx.i}_${ctx.j}·karaoke`, kind: 'walkup', type: 'walkup', tier: 'apartment', rot: 1, face: [1, 0],
    entrance: { door: [+(wx(ad + 6) + .5).toFixed(2), SIDE, +wz(ad + 6).toFixed(2)], stoop: false }, units, top: +(SIDE + H * CV).toFixed(2) });
  for (const a of [kd + 7, ad + 6]) REG.door(wx(a) + .5, wz(a), 1);   // both doorways stay clear
  // the north wall over the market faces straight down Jay St: the district's big mural — a toon singer belting into a mic
  singer(K.F('-z'), 3, 50, 59, 70, 0x2de2e6);
  stamp(windowNeon('mic', 1.1, 1.0), ctx.bank, 1, wx(31) - .25, SIDE + 1.05, wz(31) - .05);   // the mic in tubes, hung in the lounge window
}
// a painted wall (flush on the skin, relief only high up): a big-head singer, eyes shut, mouth wide on a mic, notes flying; a pink
// frame round a flat ground. a0, y0: bottom-left seen from the street; w × h in voxels
function singer(f, a0, y0, w, h, bg) {
  // at night the wall is lit like a billboard by the gooseneck lamps along its top (the paint glows flat, a shade down)
  const N = TOD.night, lt = N ? 3 : 0, col = c => N ? shade(c, .82) : c;
  const P = (a, y, c, d = 0) => f.set(a, y, d, col(c), lt), R = (a1, y1, a2, y2, c, d = 0) => f.box(a1, y1, d, a2, y2, d + 1, col(c), lt);
  for (let a = a0 + 4; a < a0 + w - 2; a += 11) { f.box(a, y0 + h + 2, 1, a + 1, y0 + h + 5, 2, PAL.iron); f.box(a, y0 + h + 4, 2, a + 1, y0 + h + 5, 5, PAL.iron); f.box(a - 1, y0 + h + 2, 4, a + 2, y0 + h + 4, 6, 0x2a2d38); f.box(a, y0 + h + 2, 4, a + 1, y0 + h + 3, 5, 0xfff3c4, N ? 3 : 1); }
  R(a0, y0, a0 + w, y0 + h, bg); R(a0 - 2, y0 - 2, a0 + w + 2, y0, 0xff2d95); R(a0 - 2, y0 + h, a0 + w + 2, y0 + h + 2, 0xff2d95); R(a0 - 2, y0, a0, y0 + h, 0xff2d95); R(a0 + w, y0, a0 + w + 2, y0 + h, 0xff2d95);
  const cx = a0 + (w >> 1) - 4, hw = 30, hh = 27, hx = cx - (hw >> 1), hy = y0 + 20, SKIN = 0xe0a070, HAIR = 0x17171b;
  R(hx + 6, y0, hx + hw - 6, hy, 0xff4fa3); R(hx + 10, y0, hx + hw - 10, y0 + 4, 0xffe23a);                       // the shoulders in a pink jacket, a gold chain
  R(hx + 11, hy - 3, hx + hw - 11, hy + 1, SKIN);                                                                   // the neck
  R(hx, hy, hx + hw, hy + hh, SKIN); R(hx - 2, hy + 10, hx, hy + 17, SKIN); R(hx + hw, hy + 10, hx + hw + 2, hy + 17, SKIN);   // the big head, the ears
  R(hx - 2, hy + hh - 4, hx + hw + 2, hy + hh + 6, HAIR); R(hx + 2, hy + hh + 6, hx + hw - 4, hy + hh + 10, HAIR); R(hx - 2, hy + 14, hx + 1, hy + hh, HAIR); R(hx + hw - 1, hy + 14, hx + hw + 2, hy + hh, HAIR);   // the pompadour
  for (const s of [-1, 1]) { const ex = cx + s * 8; for (let k = -3; k <= 3; k++) P(ex + k, hy + 18 - Math.round(Math.abs(k) * .5), HAIR); R(ex - 4, hy + 21, ex + 4, hy + 22, HAIR); }   // eyes shut (arcs), brows up
  R(cx - 6, hy + 3, cx + 6, hy + 11, 0x7a1020); R(cx - 4, hy + 4, cx + 4, hy + 6, 0xff6b8a); R(cx - 5, hy + 10, cx + 5, hy + 11, 0xf7f7f2);   // the mouth wide open, tongue, teeth
  const mx = cx + 9; R(mx - 1, y0 + 2, mx + 2, hy + 4, 0x2a2a30); for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (dx * dx + dy * dy <= 10) P(mx + dx, hy + 6 + dy, (dx + dy) % 2 ? 0x9aa0a8 : 0xc9ced6, 1);   // the mic (in relief)
  R(hx + hw - 3, hy + 1, hx + hw + 3, hy + 6, SKIN);                                                                // the hand on the mic
  const note = (a, y, c) => { R(a, y, a + 3, y + 2, c); R(a + 2, y + 2, a + 3, y + 10, c); R(a + 3, y + 8, a + 6, y + 10, c); };
  note(a0 + 4, y0 + h - 18, 0xff2d95); note(a0 + w - 10, y0 + h - 14, 0x7a3cff); note(a0 + w - 16, y0 + 28, 0xffe23a); note(a0 + 6, y0 + 30, 0x7a3cff);
}
// one letter on the blade, on both faces: the south face reads left→right with d, the north face mirrored (each on its own board)
const TMC = new Map(), mask = s => { let m = TMC.get(s); if (!m) TMC.set(s, m = textMask(s)); return m; };
function blade(f, ch, a0, ytop, d0, d1) {
  const t = mask(ch), off = d0 + (((d1 - d0) - t.w) >> 1); f.V.recNext();
  for (let j = 0; j < 7; j++) for (let i = 0; i < t.w; i++) if (t.at(i, j)) { const y = ytop - j;
    f.set(a0 - 1, y, off + i, 0xffe23a, 3); f.rec(ch, a0 - 1, y, off + i, -1, 0);
    f.set(a0 + 3, y, off + (t.w - 1 - i), 0xffe23a, 3); f.rec(ch, a0 + 3, y, off + (t.w - 1 - i), 1, 0); }
}
