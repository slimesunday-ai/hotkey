// GATEHILL · hero · GAVEL & GRAIL, the auction house (block −8,7: the Amberley, Birch St between Willow and Aspen). Owner: the Gatehill
// agent. Ids read -8_7·<group>·kind·n (groups: tower, shops, lobbyN, lobbyS, roof, auction).
//   Collector culture at the top of the ladder. The red-brick Amberley's ground floor on Birch St is an auction house: a stone front with
//   two arched windows (tonight's lots: a grail sneaker on a plinth, a framed pop painting), a loggia between them behind three columns
//   where four collectors queue behind a velvet rope, facing up the line to the north door, bronze doors, GAVEL & GRAIL in gold on the band, and three sale banners
//   hanging from the podium's parapet over the street (RARE · the sneaker, LOT 88 · SOLD). The loggia is cut out of the ground floor (the
//   kit's gf.cuts), so the queue stands inside the lot and Birch St keeps its whole sidewalk.
import { blockCtx } from '../engine.js';
import { kitNow } from '../gen.js';
import { REG } from '../audit.js';
import { AIR, TOD } from '../kit.js';
import { buildEstate } from '../districts/estates/build.js';
import { C, CV, SIDE, H, memo, pv, done, px, ftext, vtextX, lit, logSign, fw, FACE_ROT, r2 } from '../districts/estates/lib.js';

export function auction(bank, b, A) {
  const ctx = blockCtx(bank, b, A, kitNow()); REG.strict = true;
  try { buildEstate(ctx, { shop: front, after: banners }); ctx.finish(); } finally { REG.strict = false; }
}
// a velvet rope on brass posts, 2.4 m long, facing +z (posts at x ±1.2)
const rope = () => memo('auction-rope', () => { const V = pv(26, 11, 4); for (const x of [0, 12, 24]) { V.box(x, 0, 1, x + 2, 1, 3, C.brass, 2); V.box(x, 1, 1, x + 2, 10, 3, C.brass, 2); V.box(x, 10, 1, x + 2, 11, 3, C.brass, 2); }
  for (let x = 2; x < 24; x++) { if (x === 12 || x === 13) continue; const t = ((x - 2) % 11) / 10, y = 9 - Math.round(2.4 * 4 * t * (1 - t)); V.box(x, y, 1, x + 1, y + 1, 3, 0xb0102a); V.box(x, y + 1, 1, x + 1, 10, 2, x % 11 === 2 || x % 11 === 12 ? 0xb0102a : undefined); }
  return done(V, 'rope'); });
// the front: 16 m of the west wall from the north corner (a0 … a1 on the frame, a = 0 at the north end); the loggia is at 4.6 … 11.4 m
function front(f, a0, a1, S, P, T) {
  if (S.hero !== 'auction') return false; const L = a1 - a0, stone = 0xe8e1d2, trim = C.gold, la = 46, lb = 114, dep = 22;
  f.box(a0, 0, 0, a1, 44, 1, stone); f.box(a0, 0, 0, a1, 3, 2, 0xb9b0a0);
  // two arched windows with tonight's lots
  for (const [w0, lot] of [[6, 0], [lb + 8, 1]]) { const w1 = w0 + 28; f.box(w0 - 2, 3, 0, w1 + 2, 34, 2, trim); f.box(w0, 5, -12, w1, 32, 2, AIR); f.box(w0, 5, -13, w1, 32, -12, lot ? 0x7a1020 : 0x17171b); f.box(w0, 5, -12, w1, 8, -1, 0xf2efe6);
    for (let t = 0; t < 5; t++) { f.box(w0 - 2 + t, 32 + t, 0, w1 + 2 - t, 33 + t, 2, trim); if (t < 4) f.box(w0 + t, 32 + t, -12, w1 - t, 33 + t, 2, AIR); }
    f.box(w0, 31, -12, w1, 32, -2, 0xfff3c4, TOD.night ? 3 : 1);
    const c = (w0 + w1) >> 1; f.box(c - 5, 8, -9, c + 5, 16, -3, 0xf2efe6);
    if (!lot) { f.box(c - 6, 16, -8, c + 7, 18, -4, 0xffffff); f.box(c - 6, 18, -8, c + 7, 21, -4, C.rasp); f.box(c - 6, 21, -8, c - 1, 25, -4, C.rasp); f.box(c - 6, 18, -8, c - 3, 23, -4, 0x17171b); f.box(c + 2, 21, -7, c + 7, 22, -5, 0xffffff); }   // the grail sneaker
    else { f.box(c - 9, 13, -12, c + 9, 30, -11, C.gold, 2); f.box(c - 8, 14, -11, c + 8, 29, -10, (a, y) => ((a - c + 8) >> 2) % 2 ? (y > 21 ? C.yellow : C.blue) : (y > 21 ? C.pink : 0x17171b)); } }   // a framed pop painting
  // the loggia: clear its front (the kit's plinth ran across it), three columns, the back wall with bronze doors and a lit interior
  f.box(la, 0, -dep, lb, 44, 2, AIR); f.box(la, 0, -dep - 1, lb, 44, -dep, stone);
  for (const a of [la, (la + lb) >> 1, lb - 4]) { f.box(a, 0, -2, a + 4, 44, 1, stone); f.box(a - 1, 0, -2, a + 5, 3, 2, 0xb9b0a0); f.box(a - 1, 40, -2, a + 5, 44, 2, trim); }
  const dm = (la + lb) >> 1; for (const d0 of [dm - 20, dm + 6]) { f.box(d0, 0, -dep - 1, d0 + 14, 28, -dep, 0x5a3a22); f.box(d0 + 6, 0, -dep - 1, d0 + 8, 28, -dep, 0x3a2418); f.box(d0 + 2, 12, -dep, d0 + 12, 13, -dep + 1, C.brass, 2); f.box(d0 - 1, 28, -dep - 1, d0 + 15, 32, -dep, C.litHi, TOD.night ? 3 : 1); }
  f.box(la, 43, -dep, lb, 44, 0, 0xfff3c4, TOD.night ? 3 : 1);
  // the band: GAVEL & GRAIL in gold on ink over the whole front, a smaller line under it
  f.box(a0, 44, 0, a1, 52, 2, C.ink); const M = px(S.name); ftext(f, M, (a0 + a1) >> 1, 51, { d0: 2, d1: 3, c: C.gold, l: lit() }); { const [x, z] = fw(f, (a0 + a1) >> 1, 0); logSign(S.name, x, z, { where: 'shop' }); }
  const sub = px('AUCTIONEERS'); if (sub.w + 4 < la - 4) { f.box(4, 36, 0, 8 + sub.w, 44, 1, C.ink); ftext(f, sub, 6, 42, { align: 0, d0: 1, d1: 2, c: C.chalk, l: lit() }); }
  // the doors (the audit's clear zones); the queue is placed after the build (banners)
  for (const d0 of [dm - 20, dm + 6]) { const [dx, dz] = fw(f, d0 + 7, -dep + 5); REG.door(dx, dz, FACE_ROT[f.side]); }
  front.queue = { f, la, lb, dep };
  return true;
}
// the banners over Birch St (their own volume, hung from the podium's parapet on brass rods) and the queue in the loggia
function banners(ctx, P, T) {
  REG.group('auction');
  // the queue: four collectors in a line along the loggia behind a velvet rope, the head at the north door. They face up the line (north)
  // and half toward Birch St, so their faces read from the street and from the landmark camera; each has a job: the head talks to the
  // door, then a phone held up (filming the lot), a bag of cash, a paddle-arm up
  const q = front.queue; if (q) { const { f, la, lb, dep } = q;
    const [rx, rz] = fw(f, 88, -5); ctx.put(rope(), rx, rz, { rot: 1, slide: [0, 1], reach: .4, ignore: ['plinth'] });
    const life = ctx.A.life ??= [];
    [[70, -2.05, 'talk'], [82, -2.45, 'phone'], [94, -2.2, 'carry'], [106, -2.6, 'arms']].forEach(([a, ry, act], k) => { const [x, z] = fw(f, a, -15); life.push({ x: r2(x), y: SIDE, z: r2(z), ry, act, seed: P.seed + 60 + k, hand: true }); }); }
  // three banners, 2 m wide, from the parapet (9.2 m) down to 5.4 m (over the band), 0.3–0.5 m off the wall
  const x1 = P.X0, x0 = P.X0 - .5, yb = SIDE + 5.4, yt = SIDE + 9.2, V = ctx.volume(x0, yb, P.Z0 + 1.2, x1, yt, P.Z0 + 15, { ground: false }), n = V.nx, m = V.nz, top = V.ny;
  const B = [{ z: 0, bg: C.pink, fg: C.chalk, word: 'RARE' }, { z: 46, bg: C.yellow, fg: C.ink, word: '88', shoe: true }, { z: 92, bg: C.ink, fg: C.gold, word: 'SOLD' }];
  for (const b of B) { const z0 = b.z, z1 = b.z + 20; V.box(0, top - 2, z0 + 3, n, top - 1, z0 + 5, C.brass, 2); V.box(0, top - 2, z1 - 5, n, top - 1, z1 - 3, C.brass, 2);   // rods back to the parapet
    V.box(0, 2, z0, 2, top - 1, z1, b.bg); V.box(0, top - 3, z0, 2, top - 1, z1, C.gold, 2); V.box(0, 2, z0, 2, 4, z1, C.gold, 2);
    if (b.shoe) { const cz = z0 + 10, y0 = 5; V.box(0, y0, cz - 7, 1, y0 + 2, cz + 7, 0xffffff); V.box(0, y0 + 2, cz - 7, 1, y0 + 6, cz + 6, C.rasp); V.box(0, y0 + 6, cz - 7, 1, y0 + 10, cz - 1, C.rasp); V.box(0, y0 + 2, cz - 7, 1, y0 + 8, cz - 4, 0x17171b); }
    let yy = top - 5; for (const ch of b.word) { const G = px(ch); vtextX(V, G, z0 + ((20 - G.w) >> 1), yy, 0, b.fg, { dir: -1, l: lit() }); yy -= 8; }
    logSign(`GAVEL & GRAIL ${b.word}`, x0, P.Z0 + 1.2 + (z0 + 10) * CV, { where: 'banner' }); }
  REG.group('tower');
}
