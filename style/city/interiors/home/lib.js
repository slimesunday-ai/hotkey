// Home objects · shared helpers (worker-safe: no three). Every object is authored at the character grain (0.05 m, 5 cubes per
// 0.25 m cell) into a vox.js Vol whose origin is the footprint's back-left corner on the floor (FORMAT.md): +x width, +z toward
// the room (the front), +y up. Wall pieces: origin = bottom-left of the footprint on the wall plane, +z out of the wall.
// Ceiling pieces: origin = back-left of the footprint on the ceiling plane, the piece hangs down to −h.
import { Vol, downVol, textMask } from '../../vox.js';
import { hash, shade, rng } from '../../style.js';
import { TOD } from '../../kit.js';
import { mask3 } from '../../simassets/lib.js';
export { hash, shade, rng, TOD, mask3 };

export const G = 0.05, CELL = 5;                    // grain (m) · cubes per 0.25 m cell
export const LIT = 3;                               // screens, LEDs, neon: always unlit (STYLE §3)
export const glow = () => (TOD.night ? 3 : 1);      // lamp shades and bulbs: glow at night, gloss by day (props.js lamps)
export const mix = (a, b, t) => { const m = s => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t); return (m(16) << 16) | (m(8) << 8) | m(0); };
export const pick = (a, v) => a[((v % a.length) + a.length) % a.length];

// ── colours: STYLE.md's palette plus the materials a home needs. Toon and saturated; neutrals only on materials, never pastel.
export const K = {
  ink: 0x17171b, iron: 0x1d1d24, white: 0xf7f7f2, cream: 0xfff0d0, bone: 0xe6e1d6, pale: 0xd3d4d7, grey: 0xa7a9b1, slate: 0x6d707a,
  red: 0xe8232a, yellow: 0xffe23a, lime: 0x6cff4a, cyan: 0x2de2e6, pink: 0xff4fa3, green: 0x14a83b, gold: 0xe7bd4a, amber: 0xffc21a,
  cobalt: 0x2f5bff, orange: 0xff7a1a, purple: 0x7a3cff, teal: 0x12b3a0, violet: 0x8c52ff, rose: 0xe83b5b, sky: 0x3fa9f5, grass: 0x25b84c,
  tang: 0xff8a1f, brick: 0x9b4f3a, buff: 0xc49a6c, plum: 0xa2438f, navy: 0x23306e, oxblood: 0x7a1020, forest: 0x1f5c4a, mustard: 0xd9a21a,
  wood: 0xa4652f, woodD: 0x6e3e19, woodL: 0xc98a4b, oak: 0xd9a25e, walnut: 0x5a3418, ply: 0xcf9a55,
  steel: 0x9a9aa6, steelD: 0x5b5d63, steelL: 0xc9ced6, chrome: 0xdfe6ee, gun: 0x3a3c44, black: 0x26262c,
  glassLo: 0x1b2a55, glassHi: 0x3f6bc4, glint: 0xeaf6ff, glass: 0x9fd8ff, water: 0x3fc8ff,
  beige: 0xd8c9a3, beigeD: 0xb3a27c, cash: 0x5cb85c, cashD: 0x3f8f45, soil: 0x5a3a22,
  leaf: 0x2fbf55, leafD: 0x1d8f3c, leafL: 0x46d466, terracotta: 0xd9643a,
  skin: [0xf2c9a0, 0xd99a6c, 0xb8643c, 0x8a5030, 0x5a3420, 0xffd21f],
};
export const SAFE = { body: 0x1f5c4a, lid: mix(0x1f5c4a, 0xffffff, .12) };   // the simassets safe (security.js): green body, gold pinstripe, OAK plate

// ── the Vol an object draws into (near: 0.05, far: 0.1). Footprint cells × 5 cubes; height rounded up to whole cubes.
export function volFor(o, far = false) {
  const k = far ? 2 : 1, s = G * k, [a, b] = o.foot, n = c => Math.ceil(c * CELL / k), ny = Math.max(1, Math.ceil(o.h / s - 1e-6));
  if (o.place === 'wall') return new Vol(n(a), n(b), ny, { s, org: [0, 0, 0], ground: false });
  if (o.place === 'ceiling') return new Vol(n(a), ny, n(b), { s, org: [0, -ny * s, 0], ground: false });
  return new Vol(n(a), ny, n(b), { s, org: [0, 0, 0], ground: true });
}
// far: the object's own voxels downsampled 2× (0.05 → 0.1), weighted toward the faces you'd see (vox.js downVol), so the tier is the
// same object at the city's grain, never a different model (STYLE §9)
export function farOf(o) {
  return (V, opt = {}) => { const N = volFor(o); o.build(N, opt); const D = downVol(N, 2, 2), dy = Math.round((D.org[1] - V.org[1]) / V.s);
    for (let y = 0; y < D.ny; y++) for (let z = 0; z < D.nz; z++) for (let x = 0; x < D.nx; x++) { const c = D.d[x + z * D.nx + y * D.sxz]; if (c) V.set(x, y + dy, z, D.pal[c], D.lay[c]); }
    return V; };
}
// defaults for the FORMAT fields (every object states its own foot, h, place, tiers, tags)
export const def = o => ({ set: 'home', mount: null, rot: 90, tops: [], variants: 1, sim: null, ...o });

// ── shapes (centres at voxel centres: c + .5)
export function cyl(V, cx, cz, r, y0, y1, c, l = 0) {
  for (let y = y0; y < y1; y++) for (let x = Math.floor(cx - r - 1); x <= cx + r; x++) for (let z = Math.floor(cz - r - 1); z <= cz + r; z++)
    if (Math.hypot(x + .5 - cx, z + .5 - cz) <= r) V.set(x, y, z, typeof c === 'function' ? c(x, y, z) : c, l);
}
export function cylX(V, cy, cz, r, x0, x1, c, l = 0) {   // lying along x
  for (let x = x0; x < x1; x++) for (let y = Math.floor(cy - r - 1); y <= cy + r; y++) for (let z = Math.floor(cz - r - 1); z <= cz + r; z++)
    if (Math.hypot(y + .5 - cy, z + .5 - cz) <= r) V.set(x, y, z, typeof c === 'function' ? c(x, y, z) : c, l);
}
export function cylZ(V, cx, cy, r, z0, z1, c, l = 0) {   // lying along z (a disc on the +z face when z1 = z0 + 1)
  for (let z = z0; z < z1; z++) for (let x = Math.floor(cx - r - 1); x <= cx + r; x++) for (let y = Math.floor(cy - r - 1); y <= cy + r; y++)
    if (Math.hypot(x + .5 - cx, y + .5 - cy) <= r) V.set(x, y, z, typeof c === 'function' ? c(x, y, z) : c, l);
}
// a 6-connected line (every step shares a face with the last, so a rod, a cord or a leg is never loose)
export function line(V, x0, y0, z0, x1, y1, z1, c, l = 0) {
  const p = [Math.round(x0), Math.round(y0), Math.round(z0)], q = [Math.round(x1), Math.round(y1), Math.round(z1)], n = Math.max(1, Math.abs(q[0] - p[0]) + Math.abs(q[1] - p[1]) + Math.abs(q[2] - p[2]));
  const put = () => V.set(p[0], p[1], p[2], typeof c === 'function' ? c(p[0], p[1], p[2]) : c, l); put();
  for (let k = 0; k < n; k++) { let best = -1, bd = 1e9; const t = (k + 1) / n, tg = [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, z0 + (z1 - z0) * t];
    for (let a = 0; a < 3; a++) { if (p[a] === q[a]) continue; const tr = p.slice(); tr[a] += Math.sign(q[a] - p[a]); const dd = Math.hypot(tr[0] - tg[0], tr[1] - tg[1], tr[2] - tg[2]); if (dd < bd) { bd = dd; best = a; } }
    if (best < 0) break; p[best] += Math.sign(q[best] - p[best]); put(); }
}
// drop every piece of a floor object that does not reach the floor (leaf tips that only touch diagonally): never a loose cube
export function prune(V) {
  const { nx, ny, nz, d } = V, keep = new Uint8Array(d.length), st = [];
  for (let z = 0; z < nz; z++) for (let x = 0; x < nx; x++) { const i = x + z * nx; if (d[i]) { keep[i] = 1; st.push(i); } }
  while (st.length) { const j = st.pop(), x = j % nx, z = ((j / nx) | 0) % nz, y = (j / (nx * nz)) | 0;
    for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) { const X = x + dx, Y = y + dy, Z = z + dz;
      if (X < 0 || Y < 0 || Z < 0 || X >= nx || Y >= ny || Z >= nz) continue; const k = X + Z * nx + Y * nx * nz; if (d[k] && !keep[k]) { keep[k] = 1; st.push(k); } } }
  for (let i = 0; i < d.length; i++) if (!keep[i]) d[i] = 0; return V;
}
// ── lettering: a mask (3×5 small print, or vox.js's 5×7) on the +z face at depth z, reading left → right from the front
export const M3 = s => mask3(s), M5 = s => textMask(s);
export function txt(V, M, x0, ytop, z, c, l = 0, sc = 1) {
  for (let j = 0; j < M.h; j++) for (let i = 0; i < M.w; i++) if (M.at(i, j)) for (let a = 0; a < sc; a++) for (let b = 0; b < sc; b++) V.set(x0 + i * sc + a, ytop - j * sc - b, z, typeof c === 'function' ? c(i, j) : c, l);
  return M.w * sc;
}
// on a top face at height y: rows run toward +z (the letters' tops at z0), read from the front of the object
export function txtTop(V, M, x0, z0, y, c, l = 0) { for (let j = 0; j < M.h; j++) for (let i = 0; i < M.w; i++) if (M.at(i, j)) V.set(x0 + i, y, z0 + j, c, l); return M.w; }
// ── small pieces used across groups
// a cash brick: green notes with a white band (lying, along x)
export function cash(V, x, y, z, w = 3, d = 2, h = 1) { V.box(x, y, z, x + w, y + h, z + d, K.cash); V.box(x + (w >> 1), y, z, x + (w >> 1) + 1, y + h, z + d, K.white); }
// a sneaker in profile (length along x, toe at +x unless flip), sole, upper, colour-blocked panels: invented, no marks
export function sneaker(V, x, y, z, c1, c2, sole = K.white, flip = false, w = 2) {
  const X = i => flip ? x + 7 - i : x + i;
  for (let i = 0; i < 8; i++) V.box(X(i), y, z, X(i) + 1, y + 1, z + w, sole);                                // sole
  for (let i = 0; i < 7; i++) V.box(X(i), y + 1, z, X(i) + 1, y + (i < 4 ? 3 : 2), z + w, i > 4 ? c2 : c1);   // upper: heel → toe
  V.box(X(0), y + 3, z, X(0) + 1, y + 4, z + w, c2);                                                            // heel tab
  V.box(X(2), y + 1, z, X(2) + 1, y + 3, z + w, c2); V.set(X(3), y + 3, z, K.white); if (w > 1) V.set(X(3), y + 3, z + w - 1, K.white);   // panel + laces
}
// a big-head face (the city's characters, simplified): skin, hair or cap, two eyes, a mouth; drawn on the +z face at depth z
export function face(V, x0, y0, z, w, h, o = {}) {
  const sk = o.skin ?? K.skin[1], hair = o.hair ?? K.ink;
  V.box(x0, y0, z, x0 + w, y0 + h, z + 1, sk);
  const hh = Math.max(1, Math.round(h * (o.cap ? .34 : .26))); V.box(x0 - (o.cap ? 0 : 0), y0 + h - hh, z, x0 + w, y0 + h, z + 1, hair);
  if (o.cap) V.box(x0 + (o.brimL ? -2 : w - 1), y0 + h - hh, z, x0 + (o.brimL ? 1 : w + 2), y0 + h - hh + 1, z + 1, hair);
  const ey = y0 + Math.round(h * .5), ex = w <= 3 ? 0 : Math.max(1, Math.round(w * .22));
  const eye = o.eye ?? K.ink; V.set(x0 + ex, ey, z, eye); V.set(x0 + w - 1 - ex, ey, z, eye);
  if (w >= 8) { V.set(x0 + ex + 1, ey, z, eye); V.set(x0 + w - 2 - ex, ey, z, eye); if (o.lids) { V.box(x0 + ex, ey + 1, z, x0 + ex + 2, ey + 2, z + 1, shade(sk, .8)); V.box(x0 + w - 2 - ex, ey + 1, z, x0 + w - ex, ey + 2, z + 1, shade(sk, .8)); } }
  const my = y0 + Math.max(1, Math.round(h * .2)), mw = Math.max(1, Math.round(w * .3)); V.box(x0 + ((w - mw) >> 1), my, z, x0 + ((w - mw) >> 1) + mw, my + 1, z + 1, o.mouth ?? K.ink);
}
