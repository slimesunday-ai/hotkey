// GLASSWALL · THE DOWNTOWN FRINGE · drawing helpers for the fringe heroes (owner: the downtown fringe agent, batch 5). World metres in,
// voxels out: a box, a cylinder, a parked car and a lettered face on any volume, plus the hand-placed people of a hero.
import { frame, TOD } from '../../kit.js';
import { PAL, SIDE } from '../../style.js';
import { kerbX, kerbZ } from '../frame.js';

export const lit = (day = 0) => TOD.night ? 3 : day;
// a world-space brush on a volume: box(x0, y0, z0, x1, y1, z1, colour | fn(wx, wy, wz), layer) in metres. SPREAD: a volume a framed ctx
// made (downtown/fill.js framed: V.fo, its block's shift) is drawn in today's metres, the block's frame (wx / wy / wz read back the same)
export function brush(V) {
  const s = V.s, [fx, fz] = V.fo || [0, 0], ox = V.org[0] - fx, oy = V.org[1], oz = V.org[2] - fz, X = x => Math.round((x - ox) / s), Y = y => Math.round((y - oy) / s), Z = z => Math.round((z - oz) / s);
  const wx = i => ox + (i + .5) * s, wy = j => oy + (j + .5) * s, wz = k => oz + (k + .5) * s;
  return { V, X, Y, Z, wx, wy, wz,
    box(x0, y0, z0, x1, y1, z1, c, l = 0) { const i0 = X(x0), j0 = Y(y0), k0 = Z(z0), i1 = Math.max(i0 + 1, X(x1)), j1 = Math.max(j0 + 1, Y(y1)), k1 = Math.max(k0 + 1, Z(z1));
      if (typeof c === 'function') V.box(i0, j0, k0, i1, j1, k1, (i, j, k) => c(wx(i), wy(j), wz(k), i, j, k), l); else V.box(i0, j0, k0, i1, j1, k1, c, l); },
    // an upright cylinder (radius r, centre cx, cz) from y0 to y1; c may be a function of (angle, y, radius-fraction)
    cyl(cx, cz, r, y0, y1, c, l = 0, r0 = 0) { const i0 = X(cx - r) - 1, i1 = X(cx + r) + 1, k0 = Z(cz - r) - 1, k1 = Z(cz + r) + 1, j0 = Y(y0), j1 = Y(y1);
      for (let i = i0; i <= i1; i++) for (let k = k0; k <= k1; k++) { const dx = wx(i) - cx, dz = wz(k) - cz, d = Math.hypot(dx, dz); if (d > r || d < r0) continue;
        for (let j = j0; j < j1; j++) { const col = typeof c === 'function' ? c(Math.atan2(dz, dx), wy(j), d / r) : c; if (col !== undefined && col !== null) V.set(i, j, k, col, l); } } },
    // a lettering face: a kit.js frame on the world rect [x0, z0, x1, z1] of this volume, facing `side` (text, box, set in its own a/y/d)
    face(x0, z0, x1, z1, side, y0 = oy) { const B = { x0: X(x0), z0: Z(z0), x1: X(x1), z1: Z(z1) }, f = frame(V, B, side), dy = Y(y0);
      return { f, len: f.len, text: (t, a, ytop, d0, d1, c, l, sc = 1, al = 1) => f.text(t, a, dy + ytop, d0, d1, c, l, sc, al), box: (a0, y0_, d0, a1, y1, d1, c, l) => f.box(a0, dy + y0_, d0, a1, dy + y1, d1, c, l), set: (a, y, d, c, l) => f.set(a, dy + y, d, c, l) }; },
  };
}
// a parked car drawn into a volume (garage decks, lots): 1.8 × 4.2 m, along x (ax 'x') or z, nose toward dir (±1)
export function carVox(P, cx, y, cz, dir, c, ax = 'x') {
  const L = 2.1, W = .9, bx = (a0, y0, b0, a1, y1, b1, col) => ax === 'x' ? P.box(cx + a0, y + y0, cz + b0, cx + a1, y + y1, cz + b1, col) : P.box(cx + b0, y + y0, cz + a0, cx + b1, y + y1, cz + a1, col);
  for (const a of [-L + .5, L - 1.1]) for (const b of [-W - .05, W - .25]) bx(a, 0, b, a + .6, .6, b + .3, 0x1d1d24);
  bx(-L, .25, -W, L, .85, W, c); bx(dir > 0 ? -L + .9 : -L + 1.1, .85, -W + .1, dir > 0 ? L - 1.1 : L - .9, 1.55, W - .1, c);
  bx(dir > 0 ? -L + 1.0 : -L + 1.2, 1.0, -W + .05, dir > 0 ? L - 1.2 : L - 1.0, 1.45, W - .05, 0x9fd8ff);
  const n = dir > 0 ? L : -L; bx(Math.min(n, n - dir * .1), .45, -W + .2, Math.max(n, n - dir * .1), .65, -W + .5, 0xffffff); bx(Math.min(n, n - dir * .1), .45, W - .5, Math.max(n, n - dir * .1), .65, W - .2, 0xffffff);
}
export const CARS = [0xe8232a, 0x2f5bff, 0xf7f7f2, 0x17171b, 0x25b84c, 0x7a3cff, 0xff7a1a, 0x12b3a0, 0xffc21a, 0x8f949c];
// the same car at any scale (a rooftop giant): k × 1.8 × 4.2 m, along x, nose toward +x; chrome bumpers, round wheels
export function bigCar(P, cx, y, cz, k, c, trim = 0xf7f7f2) {
  const bx = (a0, y0, b0, a1, y1, b1, col, l = 0) => P.box(cx + a0 * k, y + y0 * k, cz + b0 * k, cx + a1 * k, y + y1 * k, cz + b1 * k, col, l);
  for (const a of [-1.45, 1.05]) for (const b of [-.95, .75]) { bx(a, 0, b, a + .7, .7, b + .2, 0x1d1d24); bx(a + .2, .2, b - .02, a + .5, .5, b + .22, 0xd3d4d7, 2); }
  bx(-2.1, .25, -.9, 2.1, .85, .9, c); bx(-1.0, .85, -.8, 1.0, 1.55, .8, c); bx(-.95, 1.0, -.82, .95, 1.45, .82, 0x9fd8ff, 1); bx(-1.05, 1.0, -.7, 1.05, 1.45, .7, 0x9fd8ff, 1);
  bx(-2.2, .3, -.85, -2.1, .55, .85, trim, 2); bx(2.1, .3, -.85, 2.2, .55, .85, trim, 2); bx(2.1, .6, -.7, 2.16, .75, -.45, 0xfff3c4, 3); bx(2.1, .6, .45, 2.16, .75, .7, 0xfff3c4, 3);
  bx(-2.16, .6, -.7, -2.1, .75, -.45, 0xe8232a, 3); bx(-2.16, .6, .45, -2.1, .75, .7, 0xe8232a, 3);
}
// soap foam: a heap of white and pale-pink balls over a footprint (seeded), for the car wash
export function foam(P, x0, z0, x1, z1, y, n, seed, h = 1) {
  let s = seed | 0; const R = () => { s = (Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) + 0x9e3779b9) >>> 0; return s / 4294967296; };
  for (let q = 0; q < n; q++) { const r = .18 + R() * .32, x = x0 + r + R() * Math.max(0, x1 - x0 - 2 * r), z = z0 + r + R() * Math.max(0, z1 - z0 - 2 * r), yy = y + r * .6 + R() * h * .5, col = R() < .8 ? 0xfbfbfb : 0xffd6ea;
    for (let dx = -r; dx <= r; dx += .1) for (let dy = -r; dy <= r; dy += .1) for (let dz = -r; dz <= r; dz += .1) if (dx * dx + dy * dy + dz * dz <= r * r) P.box(x + dx, yy + dy, z + dz, x + dx + .1, yy + dy + .1, z + dz + .1, col, 1); }
}
// a hero's hand-placed person (DISTRICTS §3: people for heroes and one-off scenes only; they keep the walkers' clear path like anyone)
export const person = (A, x, z, ry, act, seed, y = SIDE, extra = {}) => A.life.push({ x: kerbX(x), y, z: kerbZ(z), ry, act, seed, hand: true, ...extra });   // (SPREAD: x, z in today's metres)
export { PAL };
