// GATEHILL · the ground floor's street walls (0.1 cubes, 5.2 m): luxury shopfronts at the corners of the side streets (a name on the
// band or the awning, a lit display niche with one kind of stock, a recessed door), tall grilled windows, a residents' car lift, and
// the wings' ends on the north and south streets. Nothing at walker height stands more than 0.1 m proud of the lot line: awnings hang
// at 3.2 m and higher, so the side streets keep their full sidewalks (DISTRICTS.md §3).
import { AIR } from '../../kit.js';
import { C, CV, SIDE, H, TOD, REG, shade, px, ftext, inkOn, lit, logSign, fw, FACE_ROT, FACE_N } from './lib.js';
import { noteFront, nicheRoom } from '../../interiors/store/fill.js';   // hardening (2026-10-05): the coverage log; a stocked room behind every niche

const GFV = 52;
// ── the display niches: one idea each, stocked in voxels (a along the niche, y up, d into the shop: −10 … −1)
const DISP = {
  flowers: { back: 0xf6f1e6, floor: 0x3a8a3a, kind: 'buckets', cols: [C.pink, C.yellow, C.rasp, 0xffffff, C.orange] },
  flowers2: { back: 0x2a2d38, floor: 0x5a3a22, kind: 'buckets', cols: [0xffffff, C.pink, C.violet, C.yellow] },
  cigars: { back: 0x3a2418, floor: 0x5a3a22, kind: 'boxes', cols: [0x8b4a24, 0xa4652f, C.gold, 0x6e3e19] },
  cigars2: { back: 0x2a2d38, floor: 0x6e3e19, kind: 'boxes', cols: [0xa4652f, C.gold, 0x7a1020] },
  cakes: { back: 0xffe4ef, floor: 0xffffff, kind: 'tiers', cols: [C.pink, 0xffffff, C.yellow, 0x7a3cff] },
  bags: { back: 0xf2efe6, floor: 0x17171b, kind: 'bags', cols: [C.rasp, C.yellow, 0x17171b, C.teal, C.orange] },
  art: { back: 0xffffff, floor: 0xe6e1d6, kind: 'art', cols: [C.blue, C.yellow, C.rasp, 0x17171b] },
  perfume: { back: 0x17171b, floor: 0x2a2d38, kind: 'bottles', cols: [C.pink, C.gold, 0x2de2e6, C.violet] },
  bank: { back: 0x2a2d38, floor: 0x5a4a3a, kind: 'plaque', cols: [C.gold] },
  wine: { back: 0x3a1a1a, floor: 0x5a3a22, kind: 'racks', cols: [0x5a1020, 0x1f4a2a, 0x7a1020, C.gold] },
  wine2: { back: 0x1f1f26, floor: 0x5a3a22, kind: 'racks', cols: [0x1f4a2a, 0x7a1020, 0x5a1020] },
  watches: { back: 0x17171b, floor: 0x2a1a3a, kind: 'busts', cols: [C.gold, 0xc9ced6] },
  fashion: { back: 0xffffff, floor: 0x17171b, kind: 'mannequins', cols: [C.rasp, 0x17171b, C.yellow, 0xffffff] },
  tailor: { back: 0xe6e1d6, floor: 0x5a3a22, kind: 'mannequins', cols: [0x1b2a55, 0x6d707a, 0x3a2418] },
  club: { back: 0x2a2d38, floor: 0x2a2d38, kind: 'frosted', cols: [C.gold] },
  caviar: { back: 0x17171b, floor: 0x2a2d38, kind: 'tins', cols: [0x17171b, C.gold, 0x2a4a8a] },
  dogs: { back: 0xffe4ef, floor: 0x2de2e6, kind: 'dogs', cols: [0xffffff, C.pink, 0x3a2418] },
  drip: { back: 0xf2fbff, floor: 0x2de2e6, kind: 'drip', cols: [0xc9ced6, 0x2de2e6, C.pink] },
  jewels: { back: 0x17171b, floor: 0x2a1a3a, kind: 'diamond', cols: [0xdff8ff, 0x9fe8ff, C.gold] },
  jewels2: { back: 0x0b3a2a, floor: 0x17171b, kind: 'busts', cols: [0x25b84c, C.gold, 0xdff8ff] },
  objects: { back: 0xf2efe6, floor: 0xe6e1d6, kind: 'objects', cols: [C.violet, C.orange, C.yellow, 0x17171b] },
  sneakers: { back: 0x17171b, floor: 0x6d707a, kind: 'sneakers', cols: [0xffffff, C.green, C.rasp, C.yellow, C.sky] },
  gym: { back: 0x2a2d38, floor: 0x6d707a, kind: 'objects', cols: [C.green, 0xc9ced6, 0x17171b] },
  juice: { back: 0xeafbe2, floor: 0xffffff, kind: 'bottles', cols: [C.green, 0x6cff4a, C.orange, C.yellow] },
  pawn: { back: 0x17171b, floor: 0x2a1a1a, kind: 'busts', cols: [C.gold, C.goldL, 0xc9ced6] },
  luggage: { back: 0xf2efe6, floor: 0x5a3a22, kind: 'trunks', cols: [0x8b4a24, C.sky, 0x6e3e19, C.gold] },
  clinic: { back: 0xffffff, floor: 0xf2efe6, kind: 'neon', cols: [C.pink, 0x2de2e6] },
  tennis: { back: 0xffffff, floor: C.clay, kind: 'objects', cols: [0x6cff4a, 0xffffff, C.green] },
  dining: { back: 0x3a2418, floor: 0x5a3a22, kind: 'tables', cols: [0xffffff, C.gold, C.rasp] },
  cars: { back: 0xf2efe6, floor: 0xd3d4d7, kind: 'objects', cols: [C.orange] },
  auction: { back: 0x17171b, floor: 0x3a2418, kind: 'art', cols: [C.gold, C.rasp, C.blue] },
};
function stock(f, a0, a1, y0, y1, disp, seed) {
  const D = DISP[disp] || DISP.objects, cols = D.cols, cc = k => cols[((k % cols.length) + cols.length) % cols.length], L = TOD.night ? 3 : 1;
  f.box(a0, y0, -11, a1, y1, 1, AIR); f.box(a0, y0, -12, a1, y1, -11, D.back, D.kind === 'frosted' ? 1 : 0); f.box(a0, y0, -11, a1, y0 + 3, -1, D.floor);
  f.box(a0, y1 - 1, -11, a1, y1, -2, 0xfff3d6, L);   // the display light, a strip in the niche's ceiling
  const W = a1 - a0, base = y0 + 3;
  switch (D.kind) {
    case 'buckets': for (let a = a0 + 1; a + 4 <= a1; a += 5) { f.box(a, base, -6, a + 4, base + 4, -3, 0xc9ced6, 2); for (let k = 0; k < 6; k++) { const da = (H(seed, a, k) * 4) | 0, h = 4 + ((H(a, k, seed) * 5) | 0); f.box(a + da, base + 4, -6 + (k % 3), a + da + 1, base + 4 + h, -5 + (k % 3), C.leafD); f.box(a + da - (k & 1), base + 3 + h, -6 + (k % 3), a + da + 1, base + 5 + h, -4 + (k % 3), cc(k + a)); } } break;
    case 'boxes': for (let a = a0 + 1, k = 0; a + 6 <= a1; a += 7, k++) for (let s = 0; s < 3; s++) f.box(a, base + s * 3, -8 + s, a + 6, base + s * 3 + 3, -3, s === 1 ? cc(k + 2) : cc(k)); break;
    case 'tiers': for (let a = a0 + 2, k = 0; a + 7 <= a1; a += 9, k++) { f.box(a + 3, base, -6, a + 4, base + 4, -5, C.gold, 2); for (let t = 0; t < 3; t++) f.box(a + t, base + 4 + t * 3, -8 + t, a + 7 - t, base + 7 + t * 3, -3 - t, cc(k + t)); f.box(a + 3, base + 13, -6, a + 4, base + 14, -5, C.rasp); } break;
    case 'bags': for (let r = 0; r < 2; r++) { const y = base + r * 11; if (r) f.box(a0, y - 1, -11, a1, y, -3, 0xd9d2c3); for (let a = a0 + 1, k = r * 3; a + 5 <= a1; a += 7, k++) { f.box(a, y, -7, a + 5, y + 5, -4, cc(k)); f.box(a + 1, y + 5, -6, a + 2, y + 7, -5, cc(k)); f.box(a + 3, y + 5, -6, a + 4, y + 7, -5, cc(k)); f.box(a + 1, y + 7, -6, a + 4, y + 8, -5, cc(k)); } } break;
    case 'art': { const pw = Math.min(W - 6, 18), pa = a0 + ((W - pw) >> 1); f.box(pa - 1, base + 5, -11, pa + pw + 1, y1 - 4, -10, C.gold, 2); f.box(pa, base + 6, -11, pa + pw, y1 - 5, -9, (a, y) => ((a - pa) * 3 + (y - base) * 2) % 11 < 4 ? cc(0) : ((a - pa) + (y - base)) % 7 < 3 ? cc(1) : cc(2));
      f.box(a0 + 2, base, -6, a0 + 5, base + 6, -3, 0xf2efe6); f.box(a0 + 2, base + 6, -6, a0 + 5, base + 9, -3, cc(3)); break; }
    case 'bottles': for (let r = 0; r < 3; r++) { const y = base + r * 8; f.box(a0, y, -11, a1, y + 1, -3, 0xdff4ff, 1); for (let a = a0 + 1, k = r; a + 2 <= a1; a += 3, k++) { f.box(a, y + 1, -6, a + 2, y + 5, -4, cc(k), 1); f.box(a, y + 5, -6, a + 1, y + 6, -5, C.gold, 2); } } break;
    case 'plaque': f.box(a0 + 2, base + 4, -11, a1 - 2, y1 - 6, -10, 0x5a4a3a); f.box(a0 + ((W - 10) >> 1), base + 10, -10, a0 + ((W - 10) >> 1) + 10, base + 16, -9, C.gold, 2); break;
    case 'racks': for (let a = a0; a < a1; a += 2) for (let y = base; y < y1 - 4; y += 2) f.box(a, y, -11, a + 1, y + 1, -9, (a + y) % 4 ? cc((a + y) >> 1) : 0x3a2418); break;
    case 'busts': for (let a = a0 + 2, k = 0; a + 5 <= a1; a += 8, k++) { f.box(a + 1, base, -7, a + 4, base + 8, -4, 0x2a2d38); f.box(a, base + 8, -8, a + 5, base + 13, -4, 0x17171b); f.box(a + 1, base + 13, -7, a + 4, base + 15, -5, 0x17171b); for (let t = 0; t < 5; t++) f.set(a + t, base + 12 - Math.abs(t - 2), -3, cc(k), 2); f.set(a + 2, base + 9, -3, cc(k + 1), 3); } break;
    case 'mannequins': for (let a = a0 + 2, k = 0; a + 5 <= a1; a += 8, k++) { f.box(a + 2, base, -6, a + 3, base + 3, -5, C.ink); f.box(a, base + 3, -7, a + 5, base + 16, -4, cc(k)); f.box(a + 1, base + 16, -7, a + 4, base + 20, -4, 0xf2efe6); f.box(a - 1, base + 10, -6, a, base + 15, -5, cc(k)); f.box(a + 5, base + 10, -6, a + 6, base + 15, -5, cc(k)); } break;
    case 'frosted': f.box(a0, y0, -1, a1, y1, 0, (a, y) => y > y1 - 6 ? 0x5a6070 : 0x3a3f4a, 1); f.box(a0 + ((W - 8) >> 1), y0 + 12, 0, a0 + ((W - 8) >> 1) + 8, y0 + 17, 1, C.brass, 2); break;   // smoked glass, a brass plate
    case 'tins': for (let a = a0 + 1, k = 0; a + 4 <= a1; a += 5, k++) for (let s = 0; s < 2; s++) { f.box(a, base + s * 3, -7, a + 4, base + s * 3 + 2, -3, cc(k + s)); f.box(a, base + s * 3 + 2, -7, a + 4, base + s * 3 + 3, -3, C.gold, 2); } break;
    case 'dogs': { const a = a0 + ((W - 10) >> 1); f.box(a, base, -8, a + 10, base + 6, -3, 0xc9ced6, 2); f.box(a + 2, base + 6, -7, a + 8, base + 10, -4, cc(0)); f.box(a + 7, base + 9, -7, a + 10, base + 14, -4, cc(0)); f.box(a + 8, base + 13, -7, a + 11, base + 16, -4, cc(1)); f.box(a + 2, base + 10, -7, a + 3, base + 13, -5, cc(1)); break; }
    case 'drip': for (let a = a0 + 3, k = 0; a + 6 <= a1; a += 10, k++) { f.box(a, base, -8, a + 6, base + 4, -3, cc(1)); f.box(a, base + 4, -8, a + 2, base + 9, -3, cc(1)); f.box(a + 7, base, -6, a + 8, base + 20, -5, cc(0), 2); f.box(a + 6, base + 18, -7, a + 9, base + 22, -4, cc(2), 1); } break;
    case 'diamond': { const cx = a0 + (W >> 1); f.box(cx - 4, base, -9, cx + 4, base + 10, -3, 0x2a1a3a); for (let t = 0; t < 7; t++) { const w = t < 3 ? 1 + t * 2 : 11 - (t - 3) * 3; if (w > 0) f.box(cx - (w >> 1), base + 10 + t, -7, cx + (w >> 1) + 1, base + 11 + t, -5, t === 2 || t === 4 ? cc(1) : cc(0), 3); }
      for (let a = a0 + 1; a < a1 - 1; a += 3) f.set(a, base + 6 + ((a * 7) % 5), -11, cc(2), 2); break; }
    case 'objects': for (let a = a0 + 2, k = 0; a + 6 <= a1; a += 9, k++) { f.box(a, base, -8, a + 6, base + 4, -3, 0xf2efe6); const h = 4 + ((H(seed, k) * 8) | 0); f.box(a + 1, base + 4, -7, a + 5, base + 4 + h, -4, cc(k)); if (k % 2) f.box(a, base + 4 + h, -8, a + 6, base + 5 + h, -3, cc(k + 1)); } break;
    case 'sneakers': for (let r = 0; r < 3; r++) { const y = base + r * 8; f.box(a0, y, -11, a1, y + 1, -4, 0x9a9aa6); for (let a = a0 + 1, k = r * 2; a + 4 <= a1; a += 5, k++) { f.box(a, y + 1, -7, a + 4, y + 3, -4, cc(k)); f.box(a, y + 3, -7, a + 2, y + 5, -4, cc(k)); f.box(a, y + 1, -7, a + 4, y + 2, -4, 0xffffff); } } break;
    case 'trunks': for (let s = 0, a = a0 + 2; s < 4 && a + 10 <= a1; s++) { const w = 12 - s * 2; f.box(a + s, base + s * 5, -9 + s, a + s + w, base + s * 5 + 5, -3, cc(s)); f.box(a + s, base + s * 5 + 2, -9 + s, a + s + w, base + s * 5 + 3, -2, C.gold, 2); } break;
    case 'neon': { const M = px('GLOW'); if (M.w + 4 <= W) { f.box(a0 + ((W - M.w) >> 1) - 2, base + 6, -11, a0 + ((W - M.w) >> 1) + M.w + 2, base + 17, -10, 0xffe4ef); f.mask(M, a0 + ((W - M.w) >> 1), base + 15, -10, -9, cc(0), 3); } break; }
    case 'tables': for (let a = a0 + 2, k = 0; a + 7 <= a1; a += 10, k++) { f.box(a + 3, base, -7, a + 4, base + 7, -6, 0x3a2418); f.box(a, base + 7, -9, a + 7, base + 8, -4, cc(0)); f.box(a + 3, base + 8, -7, a + 4, base + 10, -6, cc(1), L); for (const s of [-2, 8]) f.box(a + s, base, -7, a + s + 1, base + 9, -6, cc(2)); } break;
  }
}
// hardening (2026-10-05) · the room behind a niche (interiors/store/fill.js nicheRoom: the shop's stock, its clerk; the wall stays where the
// display hangs on it), as deep as the wing allows: the solid behind the niche, probed at mid-height across the shop, less a 0.4 m wall
function room(f, a0, a1, s0, s1, disp, seed, doorLeft, ends) {
  let solid = 1e9; for (let a = a0 + 2; a < a1 - 1; a += 4) { let n = 0; for (let d = -13; n < 60; d--, n++) { const [x, z] = f.xz(a, d); if (!f.V.has(x, 20, z)) break; } solid = Math.min(solid, n); }
  const D = DISP[disp] || DISP.objects, ok = nicheRoom(f, { a0, a1, s0, s1, y0: 5, y1: 34, depth: 17 + solid, doorLeft, ends, disp, back: D.back, seed });
  noteFront(f, s0, s1, D.kind === 'frosted' ? 'gatehill-frosted' : 'gatehill', !!ok); }
// ── one shopfront between a0 and a1 on a ground-floor wall: pilasters, the band with the name, display niches, a door, an awning
export function luxShop(f, a0, a1, S, seed, doorLeft) {
  const trim = S.trim ?? C.gold, band = S.band ?? C.ink, L = a1 - a0, dw = 14, door = doorLeft ? a0 + 5 : a1 - 5 - dw;
  f.box(a0, 3, 0, a0 + 3, 44, 2, trim); f.box(a1 - 3, 3, 0, a1, 44, 2, trim);
  // the band: the name in raised letters (gold on ink, or the band's own contrast), lit at night
  f.box(a0, 36, 0, a1, 46, 2, band); f.box(a0, 36, 0, a1, 37, 3, trim); f.box(a0, 45, 0, a1, 46, 3, trim);
  const M = px(S.name), ink = band === C.ink ? C.gold : inkOn(band);
  if (M.w + 4 <= L) { ftext(f, M, (a0 + a1) >> 1, 44, { d0: 2, d1: 3, c: ink, l: lit() }); const [x, z] = fw(f, (a0 + a1) >> 1, 0); logSign(S.name, x, z, { where: 'shop' }); }
  // display niches either side of the door
  const spans = doorLeft ? [[door + dw + 3, a1 - 4]] : [[a0 + 4, door - 3]]; if (L > 90) spans.push(doorLeft ? [a0 + 4, door - 3] : [door + dw + 3, a1 - 4]);
  for (const [s0, s1] of spans) if (s1 - s0 >= 8) { stock(f, s0, s1, 5, 34, S.disp, seed); f.box(s0 - 1, 4, 0, s1 + 1, 5, 2, trim); f.box(s0 - 1, 34, 0, s1 + 1, 35, 2, trim);
    room(f, a0, a1, s0, s1, S.disp, seed, doorLeft, doorLeft ? [4, 14] : [14, 4]); }   // (the corner end keeps the wing end's niche whole)
  // the door: recessed, dark glass, a brass bar, a lit transom
  f.box(door, 1, -4, door + dw, 30, 1, AIR); f.box(door, 1, -5, door + dw, 26, -4, (a) => a === door + (dw >> 1) ? trim : 0x2a2d38, 1); f.box(door, 26, -5, door + dw, 30, -4, C.litHi, TOD.night ? 3 : 1);
  f.box(door + 2, 12, -4, door + dw - 2, 13, -3, trim, 2); f.box(door - 1, 30, 0, door + dw + 1, 32, 2, trim);
  const [dx, dz] = fw(f, door + (dw >> 1), 5); REG.door(dx, dz, FACE_ROT[f.side]);
  // an awning in the shop's colour under the band (3.0 m up and higher: over the walkers' heads); a luxury palette when the spec has none
  const aw = S.awn === null ? null : (S.awn ?? [0x0b5a3a, 0x7a1020, 0x1b2a55, C.ink, 0x5a3a22][(seed >>> 0) % 5]);
  if (aw) { f.box(a0 + 1, 34, 1, a1 - 1, 36, 3, aw); for (let d = 3; d < 13; d++) f.box(a0 + 1, 35 - ((d / 5) | 0), d, a1 - 1, 36 - ((d / 5) | 0), d + 1, aw);
    f.box(a0 + 1, 30, 11, a1 - 1, 33, 13, aw); f.box(a0 + 1, 29, 12, a1 - 1, 30, 13, trim); }
  // brass lanterns either side of the door (2.1–2.9 m up)
  for (const la of [door - 3, door + dw]) { f.box(la, 21, 1, la + 2, 22, 3, trim, 2); f.box(la, 22, 1, la + 2, 28, 3, 0xfff3c4, TOD.night ? 3 : 1); f.box(la, 28, 1, la + 2, 29, 3, trim, 2); }
  // a blade flag at the shop's outer end when it has no awning: 2.0–3.4 m up (under the band, so it never hides the name; over the walkers)
  if (!aw) { const fa = doorLeft ? a1 - 1 : a0, fc = band === C.ink ? C.gold : band, fl = inkOn(fc); f.box(fa, 34, 1, fa + 1, 35, 14, trim, 2); f.box(fa, 20, 4, fa + 1, 34, 14, fc); f.box(fa, 20, 4, fa + 1, 21, 14, trim);
    const ini = px(S.name.replace(/^THE /, '')[0]); for (let j = 0; j < 7; j++) for (let i = 0; i < ini.w; i++) if (ini.at(i, j)) { f.set(fa - 1, 30 - j, 7 + i, fl, lit()); f.set(fa + 1, 30 - j, 7 + (ini.w - 1 - i), fl, lit()); } }
  return door + (dw >> 1);
}
// ── the rest of a street wall: tall grilled windows (a private floor's), or the residents' car lift
export function tallWindows(f, a0, a1, trim, seed) {
  for (let a = a0 + 6; a + 14 <= a1 - 4; a += 26) { f.box(a - 2, 5, 0, a + 16, 40, 2, trim); f.box(a, 7, -2, a + 14, 38, 2, AIR);
    const on = H(seed, a, 3) < .45; f.box(a, 7, -3, a + 14, 38, -2, (x, y) => on ? (y > 26 ? C.litHi : 0x6a4a3a) : (y > 30 ? 0x3f6bc4 : 0x1b2a55), on && TOD.night ? 3 : 1); if (on) f.box(a + 5, 32, -2, a + 9, 34, -1, C.gold, 2);   // a lit room and its chandelier, or dark glass
    for (let x = a + 1; x < a + 14; x += 3) f.box(x, 7, -1, x + 1, 38, 0, C.iron); f.box(a, 20, -1, a + 14, 21, 0, C.iron); f.box(a - 3, 39, 0, a + 17, 42, 3, trim); }
}
// the residents' car lift: a steel door 3.4 m wide in a trim frame, its word on an ink plate (every tower its own: LIFTS below)
export const LIFTS = ['CAR LIFT', 'GARAGE', 'VALET', 'SERVICE', 'PRIVATE', 'LOADING', 'AUTOS', 'MOTORS', 'PARKING', 'STAFF', 'KEEP OUT', 'NO ENTRY', 'VEHICLES', 'DOCK', 'LIFT', 'GARAGE 2'];
export function carLift(f, a0, trim, label = 'CAR LIFT') {
  const w = 34; f.box(a0 - 3, 0, 0, a0 + w + 3, 36, 2, trim); f.box(a0, 0, -3, a0 + w, 32, 1, AIR); f.box(a0, 0, -4, a0 + w, 32, -3, (a, y) => y % 3 === 0 ? 0x7a7f88 : 0xa7acb4, 2);
  const M = px(label), pw = M.w + 6; if (pw <= w + 18) { const p0 = a0 + ((w - pw) >> 1); f.box(p0, 33, 0, p0 + pw, 43, 2, C.ink); f.mask(M, p0 + 3, 41, 2, 3, C.chalk, lit()); }
  const [dx, dz] = fw(f, a0 + (w >> 1), 5); REG.door(dx, dz, FACE_ROT[f.side]);
}
// ── the wing's end on the north / south street (6 m): a tall arched window, or the corner shop's second display
export function wingEnd(f, S, trim, seed) { const L = f.len; if (L < 30) return;
  if (S) { const a0 = 6, a1 = L - 6; stock(f, a0, a1, 5, 34, S.disp, seed + 7); room(f, 0, L, a0, a1, S.disp, seed + 7, false, [14, 14]); f.box(a0 - 2, 3, 0, a0, 38, 2, trim); f.box(a1, 3, 0, a1 + 2, 38, 2, trim); f.box(a0 - 2, 34, 0, a1 + 2, 38, 2, trim); f.box(a0 - 2, 3, 0, a1 + 2, 5, 2, trim); return; }
  // an arched window: a trim surround, dark glass, the arch in steps over it
  const a = (L >> 1) - 9; f.box(a - 3, 3, 0, a + 21, 36, 2, trim); f.box(a, 5, -2, a + 18, 36, 2, AIR); f.box(a, 5, -3, a + 18, 36, -2, (x, y) => y > 28 ? 0x3f6bc4 : 0x1b2a55, 1);
  for (let t = 0; t < 5; t++) { f.box(a - 3 + t, 36 + t, 0, a + 21 - t, 37 + t, 2, trim); if (t < 4) { f.box(a + 1 + t, 36 + t, -2, a + 17 - t, 37 + t, 2, AIR); f.box(a + 1 + t, 36 + t, -3, a + 17 - t, 37 + t, -2, 0x3f6bc4, 1); } }
}
