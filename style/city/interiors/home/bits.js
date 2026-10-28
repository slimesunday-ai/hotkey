// Home objects · catalogue v2 helpers: the shared parts of the dope items (crime shelf, collector culture, stash boxes, trophies).
// Every piece is a toon shape at the character grain (0.05): invented silhouettes, no real firearm, toy, watch or brand design.
import { K, cyl, line, LIT, shade } from './lib.js';

// the game block (FORMAT.md): g('gear', 'rare', 'store', { stashTake: -.3 }) · trophies: tro('epic', 'kingpin-crown')
export const g = (kind, rarity, source, buff = null) => ({ kind, rarity, source, stealable: kind === 'gear' || kind === 'collectible', buff, mark: null });
export const flex = (rarity, crib, source = 'store') => g('collectible', rarity, source, { crib });
export const tro = (rarity, mark) => ({ kind: 'trophy', rarity, source: 'award', stealable: false, buff: null, mark });
export const base = (source = 'base') => g('base', 'common', source);

// a cartoon piece lying on the wall plane (profile along +x, depth z..z+t): chunky toy shapes, never a real model
export function pistol(V, x, y, z, c, c2, t = 1, flip = false) {   // 10 long × 6 tall, the grip at the bottom left
  const X = (a, b) => flip ? [x + 10 - b, x + 10 - a] : [x + a, x + b], B = (a, b, y0, y1, col, l = 0) => { const [p, q] = X(a, b); V.box(p, y + y0, z, q, y + y1, z + t, col, l); };
  B(1, 4, 0, 3, c2); B(0, 10, 3, 6, c, c === K.gold || c === K.chrome ? 2 : 0); B(9, 10, 6, 7, c); B(4, 6, 2, 3, c); B(5, 6, 1, 2, c);   // grip, slide, sight, trigger guard
}
export function rifle(V, x, y, z, c, c2, t = 1, drum = false) {       // 30 long × 7 tall; y is the bottom of the stock
  const m = c === K.gold || c === K.chrome ? 2 : 0;
  for (let i = 0; i < 7; i++) V.box(x + i, y + (i < 3 ? 0 : 1), z, x + i + 1, y + 4, z + t, c2);      // the stock, tapering in
  V.box(x + 7, y + 1, z, x + 21, y + 5, z + t, c, m); V.box(x + 21, y + 2, z, x + 30, y + 4, z + t, K.gun, 2);   // body, barrel
  V.box(x + 11, y - 2, z, x + 13, y + 1, z + t, c2); V.box(x + 17, y + 5, z, x + 19, y + 6, z + t, K.ink); V.box(x + 28, y + 4, z, x + 29, y + 5, z + t, K.ink);   // grip, sight, front sight
  if (drum) cylZ2(V, x + 16, y - 1, 2.6, z, z + t, c2); else V.box(x + 14, y - 3, z, x + 16, y + 1, z + t, c2);   // a drum or a stick mag
}
function cylZ2(V, cx, cy, r, z0, z1, c) { for (let z = z0; z < z1; z++) for (let xx = Math.floor(cx - r); xx <= cx + r; xx++) for (let yy = Math.floor(cy - r); yy <= cy + r; yy++) if (Math.hypot(xx + .5 - cx, yy + .5 - cy) <= r) V.set(xx, yy, z, c); }

// an ornate gilded frame (w × h cubes, 3 deep at the corners): bead, cove and corner scrolls in metal gold; the picture 2 back
export function gilded(V, w, h, img, l = 2) {
  const G1 = K.gold, G2 = shade(K.gold, .78), G3 = shade(K.gold, 1.12);
  for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) { const e = Math.min(i, j, w - 1 - i, h - 1 - j);
    if (e >= 3) { V.set(i, j, 0, img(i - 3, j - 3, w - 6, h - 6)); continue; }
    V.box(i, j, 0, i + 1, j + 1, e === 1 ? 3 : 2, e === 2 ? G2 : (e === 1 && (i + j) % 3 === 0) ? G3 : G1, l); }   // outer lip, a beaded crown, the inner cove
  for (const [cx, cy] of [[2, 2], [w - 3, 2], [2, h - 3], [w - 3, h - 3]]) for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) { const x = cx + a, y = cy + b; if (Math.abs(a) + Math.abs(b) <= 2 && Math.min(x, y, w - 1 - x, h - 1 - y) <= 2) V.box(x, y, 2, x + 1, y + 1, Math.abs(a) + Math.abs(b) < 2 ? 4 : 3, G3, l); }   // corner scrolls
  const mx = w >> 1; for (const y of [0, h - 1]) for (let a = -2; a <= 2; a++) V.set(mx + a, y, 2, G3, l);                   // cartouches
}
// a plinth (box with a darker base and a lighter lip), top at y1
export function plinth(V, x0, z0, x1, z1, y1, c, l = 0) { V.box(x0, 0, z0, x1, 1, z1, shade(c, .7), l); V.box(x0 + 1, 1, z0 + 1, x1 - 1, y1 - 1, z1 - 1, c, l); V.box(x0, y1 - 1, z0, x1, y1, z1, shade(c, 1.12), l); }
// a vitrine: four glass edges, a lid with a light under it, a glint across the front (the look of grails-case)
export function vitrine(V, x0, z0, x1, z1, y0, y1, trim = K.gold, l = 2) {
  for (const x of [x0, x1 - 1]) for (const z of [z0, z1 - 1]) V.box(x, y0, z, x + 1, y1, z + 1, trim, l);
  V.box(x0, y1 - 1, z0, x1, y1, z1, trim, l); V.box(x0 + 1, y1 - 2, z0 + 1, x1 - 1, y1 - 1, z1 - 1, K.cream, 1);
  const n = Math.min(x1 - x0 - 4, y1 - y0 - 3); for (let k = 0; k < n; k++) { V.set(x0 + 1 + k, y0 + k, z1 - 1, K.glint, 1); V.set(x0 + 1 + k, y0 + 1 + k, z1 - 1, K.glint, 1); }
}
// velvet: a cushion with tassel corners
export function cushion(V, x0, z0, x1, z1, y0, c, tassel = K.gold) {
  V.box(x0, y0, z0, x1, y0 + 2, z1, c); V.box(x0 + 1, y0 + 2, z0 + 1, x1 - 1, y0 + 3, z1 - 1, shade(c, 1.1));
  for (const x of [x0, x1 - 1]) for (const z of [z0, z1 - 1]) V.set(x, y0 + 2, z, tassel, 2);
}
// a designer-vinyl big head (w wide, h tall, d deep) with two eyes on the front: the art-toy proportion (head ≥ body)
export function vinylHead(V, x0, y0, z0, w, h, d, c, eye = K.ink, l = 1) {
  V.box(x0, y0, z0, x0 + w, y0 + h, z0 + d, c, l); for (const [x, y] of [[x0, y0], [x0 + w - 1, y0], [x0, y0 + h - 1], [x0 + w - 1, y0 + h - 1]]) for (const z of [z0, z0 + d - 1]) V.del(x, y, z);
  const ey = y0 + Math.round(h * .5); for (const ex of [x0 + Math.round(w * .28), x0 + w - 1 - Math.round(w * .28)]) V.set(ex, ey, z0 + d, eye, eye === K.white || eye === K.cyan || eye === K.lime ? LIT : 0);
}
// a cash brick on the floor of a box, standing up (for piles and stacks)
export function brick(V, x, y, z, w = 4, d = 2, h = 2, c = K.cash) { V.box(x, y, z, x + w, y + h, z + d, c); V.box(x + (w >> 1), y, z, x + (w >> 1) + 1, y + h, z + d, K.white); }
export { cyl, line };
