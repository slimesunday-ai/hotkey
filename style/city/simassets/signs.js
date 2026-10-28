// FOR RENT signs (lawn stake · window card · lobby easel) and the window-scale cards (asleep · curtain · vacant FOR RENT).
// All at the 0.05 grain (small signs, STYLE.md §1). Agencies are invented, in the game's voice: SURE KEY (houses and trailers),
// DIAZ (walk-up landlords), GILDED LIVING (the glass towers). (Signage pass 3: they were HOME.EXE, PING and HI-RES LIVING.)
import { vol, done, K, HV, PAINT, mix, mask3, mask5, print, printC, scribble, line, TOD } from './lib.js';

// ───────── the card itself (also taped inside a vacant window): white stock, red rule, FOR / RENT, a hand-written number, the agency
// drawn with its bottom-left at (x0, y0) on layer z (letters at z + 1), w × h in half voxels (w ≥ 17, h ≥ 20)
export function rentCard(V, x0, y0, z, w, h, seed = 1) {
  V.box(x0, y0, z, x0 + w, y0 + h, z + 1, K.white);
  V.box(x0, y0, z, x0 + w, y0 + h, z + 1, (x, y) => (x === x0 || x === x0 + w - 1 || y === y0 || y === y0 + h - 1) ? K.red : undefined);
  const cx = x0 + w / 2, top = y0 + h - 3, big = h >= 24, o = {};
  printC(V, mask3('FOR'), cx, top, z + 1, K.red, 0, '+z', o);
  printC(V, mask3('RENT'), cx, top - 6, z + 1, K.red, 0, '+z', o);
  if (big) scribble(V, x0 + 3, y0 + 7, z + 1, w - 6, K.ink, seed);                 // the landlord's number, in marker
  printC(V, mask3('DIAZ'), cx, y0 + 5, z + 1, K.cobalt, 0);                          // the agency (DIAZ REALTY)
  for (const tx of [x0, x0 + w - 2]) V.box(tx, y0 + h - 2, z + 1, tx + 2, y0 + h, z + 2, K.cream);   // tape at the top corners
}

// ───────── forRentSign({ style })
export function forRentSign(style = 'lawn') {
  if (style === 'window') {   // the card alone: stands on the window's inside ledge, taped to the glass (facade piece, anchor = its bottom centre)
    const V = vol(20, 24, 2, { s: HV, az: 4, ground: false });                      // z −0.2…−0.1: in the recess, in front of the meeting rail
    rentCard(V, 0, 0, 0, 20, 24, 7); return done(V, 'rent-card', 'facade: bottom centre of the card, on the wall plane (sits 0.1–0.2 m inside the recess)');
  }
  if (style === 'lobby') return lobbyBoard();
  // lawn: a realtor's post and arm (white), the agency on the arm, the board hung on two hooks; double-sided; a tamped dirt collar
  const V = vol(44, 42, 8, { s: HV }), P = K.white;
  V.ell(5, 0, 4, 5, 1.2, 4, K.dirt); V.box(2, 0, 2, 7, 1, 7, K.dirtD);                // the dirt collar where the stake went in
  V.box(3, 0, 2, 7, 37, 6, P); V.box(3, 0, 2, 7, 37, 6, (x, y, z) => (y % 9 === 4 && x === 3) ? 0xe6e2d8 : undefined);   // post (a bit of grain)
  V.box(2, 37, 1, 8, 38, 7, P); V.box(3, 38, 2, 7, 39, 6, P); V.box(4, 39, 3, 6, 41, 5, K.gold, 2);             // finial + brass knob
  V.box(3, 27, 3, 43, 35, 5, K.ink); V.box(43, 27, 3, 44, 35, 5, P);                   // the arm: an ink header board, capped white
  for (const [n, at] of [['+z', 5], ['-z', 2]]) printC(V, mask3('SURE KEY'), 25, 33, at, K.lime, 0, n);
  for (const hx of [12, 37]) V.box(hx, 25, 3, hx + 1, 27, 5, K.iron, 2);            // hooks
  V.box(8, 5, 3, 42, 25, 5, K.white); V.box(8, 5, 3, 42, 25, 5, (x, y) => (x === 8 || x === 41 || y === 5 || y === 24) ? K.red : undefined);
  for (const [n, at] of [['+z', 5], ['-z', 2]]) { const o = { shadow: 0x9a1418 }; printC(V, mask5('FOR'), 25, 22, at, K.red, 0, n, o); printC(V, mask5('RENT'), 25, 13, at, K.red, 0, n, o); }
  V.box(35, 16, 5, 41, 23, 6, K.yellow); V.del(35, 16, 5); V.del(40, 22, 5); print(V, mask3('$'), 37, 21, 5, K.ink, 0, '+z', { flat: true });   // a slapped-on price sticker
  return done(V, 'rent-sign', 'ground: base centre; the board faces +z (street) and reads from both sides');
}
// the tower lobby: a brass easel with an ink board, gold lettering (the agency, a rule, FOR / RENT) — stands under the canopy
function lobbyBoard() {
  const V = vol(32, 44, 18, { s: HV, az: 9 }), B = K.ink, G = K.gold;
  // easel: two front legs splayed, one back leg, a brass ledge the board rests on
  line(V, 3, 0, 11, 8, 42, 10, G, 2); line(V, 28, 0, 11, 23, 42, 10, G, 2); line(V, 15, 0, 1, 15, 41, 9, G, 2); line(V, 16, 0, 1, 16, 41, 9, G, 2);
  V.box(8, 42, 9, 24, 43, 11, G, 2); V.box(2, 5, 10, 30, 6, 14, G, 2); V.box(2, 6, 13, 30, 7, 14, G, 2);
  V.box(3, 6, 10, 29, 40, 12, B);                                                   // the board (1.3 × 1.7 m), gold rim
  V.box(3, 6, 12, 29, 40, 13, (x, y) => (x === 3 || x === 28 || y === 6 || y === 39) ? G : undefined, 2);
  printC(V, mask3('GILDED'), 16, 37, 12, G, PAINT() || 2); printC(V, mask3('LIVING'), 16, 31, 12, G, PAINT() || 2);
  V.box(6, 25, 12, 26, 26, 13, G, 2);
  printC(V, mask5('FOR'), 16, 22, 12, K.white, PAINT()); printC(V, mask5('RENT'), 16, 14, 12, K.white, PAINT());
  for (const x of [7, 25]) V.box(x, 8, 12, x + 1, 9, 13, G, 2);                        // two brass studs
  return done(V, 'rent-board', 'ground: base centre; board faces +z (put it beside the lobby door, under the canopy)');
}

// ───────── windowCard(kind, { w, h, seed }): fills a kit.js window opening w × h (city voxels, default 13 × 17), 0.05 grain.
// Occupies the recess only: z −0.2 … 0 in front of the meeting rail (which sits at −0.3 … −0.2), inside the opening's outline.
export function windowCard(kind = 'zzz', o = {}) {
  const w = Math.max(7, Math.round(o.w ?? 13)), h = Math.max(10, Math.round(o.h ?? 17)), W = w * 2, H = h * 2, seed = o.seed ?? 0;
  const V = vol(W, H, 4, { s: HV, az: 4, ground: false });                           // layers 0…3 = z −0.2 … 0
  if (kind === 'zzz') {   // asleep: lights off behind closed blinds, a pull cord, and the Zzz rising out of the dark
    V.box(0, 0, 0, W, H, 1, (x, y) => y >= H - 3 ? 0x8f96b0 : y < 1 ? 0x8f96b0 : (y & 1) ? 0x2a3564 : 0x1c2446);
    const cx = W - 4; for (let y = Math.round(H * .45); y < H - 3; y++) V.set(cx, y, 1, K.cream); V.box(cx - 1, Math.round(H * .45) - 2, 1, cx + 1, Math.round(H * .45), 2, K.cream);
    const zc = TOD.night ? 0xbfe6ff : K.white, zl = TOD.night ? 3 : 0, Z = [['XXX', '.X.', 'XXX'], ['XXXX', '..X.', '.X..', 'XXXX'], ['XXXXX', '...X.', '..X..', '.X...', 'XXXXX']];
    [[.22, .3], [.4, .5], [.58, .7]].forEach(([fx, fy], k) => { const g = Z[k], x0 = Math.round(W * fx), y0 = Math.round(H * fy);
      g.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === 'X') V.set(x0 + i, y0 + g.length - 1 - j, 1, zc, zl); }); });
    return done(V, 'window-zzz', 'facade: bottom centre of the window opening, on the wall plane (fills the opening, z −0.2…0)');
  }
  if (kind === 'curtain') {   // drawn curtains: pleated panels (every other pleat 1 proud), a scalloped valance; lit from behind at night
    const C0 = [K.red, K.pink, K.orange, K.purple, K.green][seed % 5], C1 = TOD.night ? mix(C0, K.litLo, .45) : C0, l = TOD.night ? 3 : 0, mid = W >> 1;
    for (let x = 0; x < W; x++) { const p = ((x < mid ? x : x - mid + 1) >> 1) & 1, c = p ? C1 : mix(C1, 0x000000, .22);
      V.box(x, 0, 0, x + 1, H - 3, 1, c, l); if (p && x % 4 !== 0 && x !== mid - 1 && x !== mid) V.box(x, 1, 1, x + 1, H - 4, 2, c, l); }
    V.box(0, H - 4, 0, W, H, 2, mix(C0, 0x000000, .35)); for (let x = 0; x < W; x += 3) V.set(x + 1, H - 5, 1, mix(C0, 0x000000, .35));
    V.box(mid - 1, 0, 1, mid + 1, H - 4, 2, TOD.night ? mix(K.litHi, C0, .25) : mix(C0, 0x000000, .45), l);   // the seam where they meet
    return done(V, 'window-curtain', 'facade: bottom centre of the window opening, on the wall plane (fills the opening, z −0.2…0)');
  }
  // forRent: a vacant flat — bare dark glass (never lit), a half-drawn paper shade, the FOR RENT card taped in the lower left
  V.box(0, 0, 0, W, H, 1, (x, y) => { const t = y / H; if ((x + y === Math.round(H * .8) || x + y === Math.round(H * .8) + 1) && x < W * .4) return K.glint; return t > .6 ? 0x22305e : K.room; }, 1);
  const sh = Math.round(H * .3); V.box(0, H - sh, 1, W, H, 2, 0xece6d6); V.box(0, H - sh, 1, W, H - sh + 1, 2, 0xc9bfa6);
  V.box(0, H - sh + 3, 1, W, H - sh + 4, 2, 0xdcd3bd); V.box((W >> 1) - 1, H - sh - 2, 1, (W >> 1) + 1, H - sh, 2, K.gold, 2);
  const cw = Math.max(17, Math.min(20, W - 4)), ch = Math.min(24, Math.max(20, H - sh - 5));
  rentCard(V, 2, 1, 1, cw, ch, seed + 3);
  return done(V, 'window-rent', 'facade: bottom centre of the window opening, on the wall plane (fills the opening, z −0.2…0)');
}
