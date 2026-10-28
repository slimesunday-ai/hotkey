// Home objects · HARDENING pass (2026-10-05) · the pieces a room needed to read as lived in, or as empty on purpose: moving boxes, the
// FOR RENT board, a paint kit (fresh paint between tenants), crushed cans, a leaning fit-check mirror, a tall floor vase.
// Base = no stakes: never stolen, no buff (the layouts and the vacant sets use them). Brands and lettering are invented.
import { def, K, pick, cyl, line, shade, rng, txt, M3, prune } from './lib.js';
import { base } from './bits.js';

const CARD = 0xc49a62, CARD_D = 0xa0784a, TAPE = 0xe3cf9e;

// a cardboard box (x0..x1 × y0..y1 × z0..z1): flaps seam across the top, tape down the middle, a marker word on the front
function carton(V, x0, y0, z0, x1, y1, z1, word, ink, seed) {
  V.box(x0, y0, z0, x1, y1, z1, CARD);
  V.box(x0, y1 - 1, z0, x1, y1, z1, shade(CARD, 1.06));                                          // the lid, a shade lighter
  const mx = (x0 + x1) >> 1; V.box(mx, y1 - 1, z0, mx + 1, y1, z1, TAPE); V.box(mx, y1 - 3, z1 - 1, mx + 1, y1, z1, TAPE);   // tape over the seam, down the front
  V.box(x0, y0, z1 - 1, x0 + 1, y1, z1, CARD_D); V.box(x1 - 1, y0, z1 - 1, x1, y1, z1, CARD_D);    // the front's folded edges
  if (word && y1 - y0 >= 6) { const M = M3(word), w = M.w; if (w <= x1 - x0 - 2) txt(V, M, x0 + 1 + (((x1 - x0 - 2 - w) / 2) | 0), y1 - 2, z1 - 1, ink); }
}
export const boxesMoving = def({ id: 'boxes-moving', name: 'Moving boxes', cat: 'clutter', place: 'floor', foot: [3, 3], h: 0.8, rot: 45,
  tiers: ['trailer', 'apartment', 'house', 'penthouse'], tags: ['moving', 'vacant', 'day one', 'clutter'], variants: 3, vnames: ['two high', 'three high', 'one open'], far: true,
  game: base(),
  build(V, { variant = 0, seed = 1 } = {}) {
    const r = rng(seed * 17 + variant), W = ['KIX', 'TV', 'BKS', 'MOM', 'ETC', 'PAN'];
    const word = k => W[(seed * 7 + k * 3 + variant) % W.length];
    if (variant === 2) {                                                                         // one open: flaps up, a hoodie and a pan inside
      carton(V, 1, 0, 1, 14, 8, 14, word(0), K.ink, seed); V.box(2, 7, 2, 13, 8, 13, -1);
      V.box(2, 5, 2, 13, 7, 13, shade(CARD, .7)); V.ell(5, 7, 6, 3, 1.2, 3, K.red); cyl(V, 10, 9, 2.2, 7, 8, K.gun, 2); V.box(10, 7, 11, 11, 8, 14, K.gun, 2);
      V.box(1, 8, 1, 14, 12, 2, shade(CARD, 1.06)); V.box(1, 8, 13, 14, 11, 14, CARD); return; }   // the back flap up, the front flap half up
    const n = variant ? 3 : 2; let y = 0;
    for (let k = 0; k < n; k++) { const w = 13 - k * 2 - ((r() * 2) | 0), d = 12 - k * 2, ox = 1 + ((15 - 1 - w) >> 1) + ((r() * 3) | 0) - 1, oz = 1 + ((14 - d) >> 1), h = k === 2 ? 4 : 6;
      carton(V, Math.max(0, ox), y, oz, Math.min(15, ox + w), y + h, oz + d, word(k), k === 1 ? K.red : K.ink, seed + k); y += h; }
  } });

// the FOR RENT board, leaning on its strut: trailer = hand-lettered cardboard, apartment = the red hardware-store sign, house = the realtor's
export const signRent = def({ id: 'sign-rent', name: 'FOR RENT board', cat: 'decor', place: 'floor', foot: [4, 1], h: 0.75, rot: 90,
  tiers: ['trailer', 'apartment', 'house', 'penthouse'], tags: ['vacant', 'for rent', 'sign'], variants: 3, vnames: ['cardboard 4 RENT', 'red FOR RENT', 'KEYMASTER realty'], far: true,
  game: base(),
  build(V, { variant = 0 } = {}) {
    const [bg, fg, edge] = pick([[CARD, K.ink, CARD_D], [K.red, K.white, K.white], [K.navy, K.white, K.gold]], variant);
    V.box(0, 1, 2, 20, 15, 4, bg); V.box(0, 1, 2, 20, 15, 3, shade(bg, .8));                         // the board (2 thick, its back a shade down), front at +z
    if (variant) { V.box(0, 14, 3, 20, 15, 4, edge); V.box(0, 1, 3, 20, 2, 4, edge); V.box(0, 1, 3, 1, 15, 4, edge); V.box(19, 1, 3, 20, 15, 4, edge); }
    for (const x of [2, 17]) V.box(x, 0, 1, x + 1, 1, 4, shade(bg, .7));                               // the feet
    V.box(9, 0, 0, 11, 12, 1, K.woodD); V.box(9, 11, 1, 11, 12, 2, K.woodD);                             // the strut behind
    if (variant === 0) { txt(V, M3('4'), 4, 13, 3, K.red); V.box(9, 12, 3, 17, 13, 4, K.red); txt(V, M3('RENT'), 3, 8, 3, fg); return; }   // marker on cardboard: a red 4 + a dash, the word
    if (variant === 1) { txt(V, M3('FOR'), 5, 13, 3, fg); txt(V, M3('RENT'), 3, 7, 3, fg); return; }
    txt(V, M3('LEASE'), 1, 12, 3, fg); V.box(2, 6, 3, 18, 7, 4, K.gold); txt(V, M3('KEY'), 3, 5, 3, K.gold, 2);   // the realtor: LEASE, a rule, KEY + a little key
    V.box(16, 3, 3, 18, 5, 4, K.gold, 2); V.box(14, 4, 3, 16, 5, 4, K.gold, 2);
  } });

// between tenants: two paint cans (one open, wet white), a roller in its tray, a drip on the floor
export const paintKit = def({ id: 'paint-kit', name: 'Paint cans + roller', cat: 'clutter', place: 'floor', foot: [3, 2], h: 0.35, rot: 45,
  tiers: ['trailer', 'apartment', 'house', 'penthouse'], tags: ['vacant', 'fresh paint', 'clutter'], variants: 2, vnames: ['landlord white', 'bone'], far: true,
  game: base(),
  build(V, { variant = 0 } = {}) {
    const paint = pick([K.white, K.bone], variant);
    cyl(V, 3, 3, 2.6, 0, 6, K.steelL, 2); cyl(V, 3, 3, 2.6, 2, 4, K.red);                                  // can one: a red label band
    cyl(V, 3, 3, 2.6, 6, 7, K.steelL, 2); cyl(V, 3, 3, 1.9, 6, 7, paint, 1);                              // open, wet
    V.box(5, 3, 2, 6, 6, 3, paint, 1);                                                                   // a drip down its side
    cyl(V, 3, 7.4, 2.3, 0, 5, K.steelL, 2); cyl(V, 3, 7.4, 2.3, 2, 4, K.cobalt); cyl(V, 3, 7.4, 2.3, 5, 6, K.steelD, 2);   // can two: lid on
    V.box(8, 0, 1, 15, 1, 9, K.ink); V.box(9, 1, 2, 14, 2, 8, K.ink); V.box(9, 1, 2, 14, 2, 5, paint, 1);   // the tray, paint in its well
    V.box(9, 2, 5, 14, 4, 7, paint); V.box(11, 3, 7, 12, 4, 9, K.steelD, 2); V.box(11, 3, 9, 12, 4, 10, K.amber);   // the roller, its handle
    V.box(6, 0, 7, 9, 1, 9, paint, 1);                                                                  // a splash on the floor
  } });

// a night's crushed cans (free rotation): invented labels, just colour blocks
export const beerCans = def({ id: 'beer-cans', name: 'Crushed cans', cat: 'clutter', place: 'floor', foot: [2, 2], h: 0.15, rot: 45,
  tiers: ['trailer', 'apartment', 'house', 'penthouse'], tags: ['clutter', 'late night', 'party'], variants: 3, vnames: ['DOGG silver', 'red + gold', 'tall greens'],
  game: base(),
  build(V, { variant = 0, seed = 1 } = {}) {
    const [a, b] = pick([[K.steelL, K.cobalt], [K.red, K.gold], [K.green, K.white]], variant), r = rng(seed * 29 + variant);
    for (let k = 0; k < 4; k++) { const x = 1 + ((r() * 6) | 0), z = 1 + ((r() * 6) | 0);
      if (k < 2) { V.box(x, 0, z, x + 2, 2, z + 2, a, 2); V.box(x, 1, z, x + 2, 2, z + 1, b); V.box(x, 2, z, x + 2, 3, z + 2, K.steelL, 2); }   // standing, dented
      else { V.box(x, 0, z, x + 3, 1, z + 2, a, 2); V.box(x + 1, 0, z, x + 2, 1, z + 2, b); } }        // flat
  } });

// the fit-check mirror leaning on the wall: a tall gloss pane, a frame, a sticker in the corner
export const mirrorLean = def({ id: 'mirror-lean', name: 'Fit-check mirror', cat: 'decor', place: 'floor', foot: [3, 1], h: 1.8, rot: 90,
  tiers: ['apartment', 'house', 'penthouse'], tags: ['fit check', 'hypebeast', 'bedroom'], variants: 3, vnames: ['black', 'gold', 'white'], far: true,
  game: base(),
  build(V, { variant = 0 } = {}) {
    const fr = pick([K.ink, K.gold, K.white], variant), l = variant === 1 ? 2 : 0;
    V.box(0, 0, 0, 15, 36, 3, fr, l); V.box(1, 1, 2, 14, 35, 3, K.glassHi, 1);                          // frame, then the pane on its front
    for (let k = 0; k < 9; k++) { V.set(3 + k, 12 + k, 2, K.glint, 1); V.set(3 + k, 13 + k, 2, K.glint, 1); }   // the glint
    V.box(10, 28, 2, 13, 31, 3, K.pink); V.set(11, 29, 2, K.white);                                      // a sticker
    V.box(1, 0, 3, 14, 1, 5, shade(fr, .8), l);                                                          // the foot rail
  } });

// a tall glossy floor vase with dried branches: the money's quiet corner piece
export const vaseFloor = def({ id: 'vase-floor', name: 'Floor vase', cat: 'decor', place: 'floor', foot: [2, 2], h: 1.5, rot: 90,
  tiers: ['house', 'penthouse'], tags: ['gallery', 'quiet money', 'corner'], variants: 3, vnames: ['white gloss', 'black gloss', 'terracotta'], far: true,
  game: base(),
  build(V, { variant = 0, seed = 1 } = {}) {
    const c = pick([K.white, K.ink, K.terracotta], variant);
    for (let y = 0; y < 16; y++) { const t = y / 15, rr = 2.2 + Math.sin(t * Math.PI) * 2.3 - (y > 13 ? .9 : 0); cyl(V, 5, 5, rr, y, y + 1, c, 1); }
    cyl(V, 5, 5, 1.6, 15, 16, K.ink);
    const r = rng(seed * 13 + 5);
    for (let k = 0; k < 4; k++) { const a = r() * 6.28, rr = 2 + r() * 2.5, top = 22 + ((r() * 6) | 0); line(V, 5, 15, 5, 5 + Math.cos(a) * rr, top, 5 + Math.sin(a) * rr, K.woodD);
      V.set(Math.round(5 + Math.cos(a) * rr), top + 1, Math.round(5 + Math.sin(a) * rr), K.woodL); }
    prune(V);
  } });

export const LIVED = [boxesMoving, signRent, paintKit, beerCans, mirrorLean, vaseFloor];
