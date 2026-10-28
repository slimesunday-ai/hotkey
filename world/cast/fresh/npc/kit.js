// NPC POOL · the kit: the only import an NPC file (world/fresh/npc/<category>.js) may have. It re-exports the registry kit
// (../kit.js) and carries the construction helpers the NPC files share, COPIED from the agent category files (tops.js, hair.js,
// hats.js, held.js: each of those has one owner, so nothing here imports them; the copies are verbatim, renamed where two collide).
// Plus THE CIVILIAN PALETTE and the readability numbers the NPC palette check reads (style/city/studio/audit/npc-palette.mjs).
// README: world/fresh/README.md § The NPC pool.
import { shade, lerpHex, hash3 } from '../kit.js';
export { shade, lerpHex, hash3, HOLD, POSES, ENVELOPE, HELD_BUDGET, gripCells, channelOf, mirror, MOUTH } from '../kit.js';

// ───────────────────────── THE CIVILIAN PALETTE (README § The NPC pool · readability)
// Desaturated office, work and weekend colours: greys, navy, khaki, beige, denim, olive, brown, a few dusty accents. Every voxel an
// NPC trait draws (skin and the face's whites and pupils aside) stays at or under CHROMA_MAX: (max − min) of its RGB over 255. The
// agents' streetwear sits at 0.6–0.9 (hot pink 0.76, cobalt 0.81, hi-vis lime 0.81); a muted civilian is under 0.35. No metal (l 2)
// and no lit (l 3) material: no chains, grills, badges, chrome or glow.
export const CHROMA_MAX = 0.35;
export const chroma = c => (Math.max((c >> 16) & 255, (c >> 8) & 255, c & 255) - Math.min((c >> 16) & 255, (c >> 8) & 255, c & 255)) / 255;
export const CIV = {
  white: 0xe8e6e0, cream: 0xdcd5c4, oxford: 0xb9c4d4, pinkshirt: 0xd9c3c0, lightgrey: 0xbcbdc0, heather: 0x9d9fa4, grey: 0x7e8188, slate: 0x5d636d,
  charcoal: 0x3c3f45, black: 0x26272b, navy: 0x2d3546, denim: 0x4c5d78, lightdenim: 0x7d8ca3, dusty: 0x7f8fa6, teal: 0x5f8582, sage: 0x8f9a86,
  olive: 0x666a4f, forest: 0x47544a, khaki: 0xb3a27f, beige: 0xcbbf9f, tan: 0xa68b68, camel: 0x9a7b58, brown: 0x5b4838, darkbrown: 0x3d3129,
  burgundy: 0x6b3d40, rust: 0x8f6a55, mustard: 0xa99a62, mauve: 0x8e7880, lilac: 0xa89fae, peach: 0xd2b7a5, hivis: 0xbdbf72, hivisor: 0xc49a76,
};

// ───────────────────────── tops (from tops.js, verbatim)
// the torso shell. Rows y y0 … 18; per row the shell reaches fl(y) columns past the torso (x −5−fl … 4+fl) and per column it is
// d(x, y, edge) deep (z −d … d; edge: how many columns in from the shell's side). c(x, y, z) → colour. The torso's own skin under
// the shell is left alone; open necklines keep the neck; rows under y 10 are a ring round the hips (the pants keep their top row).
// skip(x, y, z) leaves a cell out (a V neck, an armhole).
function shell(B, c, { y0 = 9, fl = 1, d = 3, neck = true, skip = null, l = 0 } = {}) {
  const F = typeof fl === 'function' ? fl : () => fl, D = typeof d === 'function' ? d : () => d;
  for (let y = y0; y <= 18; y++) { const f = F(y), x0 = -5 - f, x1 = 4 + f;
    for (let x = x0; x <= x1; x++) { const dz = D(x, y, Math.min(x - x0, x1 - x));
      for (let z = -dz; z <= dz; z++) {
        if (neck && y >= 17 && x >= -1 && x <= 0 && z >= -1 && z <= 0) continue;
        const inner = x > x0 && x < x1 && z > -dz && z < dz;
        if (inner && (y < 10 ? x >= -5 && x <= 4 && z >= -2 && z <= 2 : y <= 17 && x >= -5 && x <= 4 && z >= -2 && z <= 2)) continue;
        if (skip && skip(x, y, z)) continue;
        const col = typeof c === 'function' ? c(x, y, z) : c; if (col !== null && col !== undefined) B.set(x, y, z, col, l);
      } } }
}
// both sleeves, to THE SLEEVE RULE (README § Tops · Sleeves, 2026-10-01: slime, "the arms are so massive/bulky"). The bare arm is
// x −8…−6, y 10…16, z −1…0 (chars.js base()); the hand x −8…−6, y 6…9, z −2…1. The shell's flank takes the arm's inner column(s) into
// the shirt's side, so each sleeve is ONE box round the rest of the arm: from the hem or cuff row y0 up to y 16, centred on the arm,
// `pad` voxels proud front and back (1; padded outerwear 2), its outer face `out` voxels past the arm's (0 flush, at most `pad`), its
// inner column the one just outside the shell on that row (fl: the shell's flank, a number or y → number). The shoulder cap (y 17…18)
// is the same box carried up, in to one column over the shell's side. Given for the x < 0 arm, mirrored for the other.
// paint(lx, ly, z, X, y): lx counts outwards from the box's inner column, ly from the wrist (y 9 = 0). null leaves a cell out.
const ARM = { x0: -8, z0: -1, z1: 0 };
function sleeves(ctx, paint, { y0 = 13, out = 0, pad = 1, fl = 1, l = 0 } = {}) {
  const F = typeof fl === 'function' ? fl : () => fl, P = typeof paint === 'function' ? paint : () => paint;
  const x0 = ARM.x0 - Math.min(out, pad), z0 = ARM.z0 - pad, z1 = ARM.z1 + pad;
  let x1 = -99; for (let y = y0; y <= 16; y++) x1 = Math.max(x1, -6 - F(y));
  const cell = (lx, ly, z, X, y) => (x1 - lx > -6 - F(y) ? null : P(lx, ly, z, X, y));   // (a cell the shell holds on this row stays the shell's)
  for (const s of ['L', 'R']) {
    ctx.sleeve(s, 'arm' + s, { x0, x1, y0, y1: 16, z0, z1 }, cell, l);
    ctx.shoulderCap(s, P, { outer: x0, inner: -5 - F(17), z0, z1, l });
  }
}
// a hem or cuff row: the cloth one shade down
const hem = (c, k = .86) => shade(c, k);
// a V neck: the front of the top two rows opened onto the skin, narrowing to y 16
const vee = (x, y, z) => (y === 18 && x >= -3 && x <= 2 && z >= 1) || (y === 17 && x >= -2 && x <= 1 && z >= 3) || (y === 16 && x >= -1 && x <= 0 && z >= 3);
// shirt-collar wings lying on the front of the top two rows (collar zone: 1 proud)
function collarWings(B, col, zf, { open = false, l = 0 } = {}) {
  const xs18 = open ? [-5, -4, 3, 4] : [-4, -3, -2, 1, 2, 3], xs17 = open ? [-4, -3, 2, 3] : [-3, -2, 1, 2];
  for (const x of xs18) B.set(x, 18, zf + 1, col, l); for (const x of xs17) B.set(x, 17, zf + 1, col, l);
}

// ───────────────────────── hair (from hair.js, verbatim: line → hairline, shell → hairShell, c → at)
const X0 = -8, X1 = 7, Y0 = 19, Y1 = 33, Z0 = -7, Z1 = 7;
const cl = (v, a, b) => v < a ? a : v > b ? b : v;
const inHead = (x, y, z) => x >= X0 && x <= X1 && y >= Y0 && y <= Y1 && z >= Z0 && z <= Z1;
const FACE = (x, y, z) => z >= 8 && y <= 29;                                                // brows, eyes, the eyewear front
const ARMS = (x, y, z) => (x === -9 || x === 8) && y >= 21 && y <= 28 && z >= 2;              // the eyewear arms
const EAR = (x, y, z) => (x <= -9 || x >= 8) && y >= 19 && y <= 29 && z >= -3 && z <= 2;      // the ear and its items (hoops, a pencil or a bill tucked over it)
const N6 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const kk = (x, y, z) => ((x + 64) << 14) | ((y + 64) << 7) | (z + 64), uk = k => [(k >> 14) - 64, ((k >> 7) & 127) - 64, (k & 127) - 64];
const sym = x => x < 0 ? -1 - x : x;                 // the head's centre is between x −1 and 0: x and −1 − x are a mirror pair
const rnd = (x, y, z, s = 0) => hash3(sym(x) + s * 131, y, z) / 4294967296;   // a mirror-symmetric hash in [0, 1)

// a scratch set of hair cells on the head grid H. o.ears: the style hangs over the ears (registered coversEars).
function hair(H, o = {}) {
  const m = new Map(), ears = !!o.ears, floor = o.floor ?? 19;
  const ok = (x, y, z) => y >= floor && !inHead(x, y, z) && !FACE(x, y, z) && !ARMS(x, y, z) && (ears || !EAR(x, y, z)) && !H.has(x, y, z);
  const A = {
    put(x, y, z, c, l = 0) { if (ok(x, y, z)) m.set(kk(x, y, z), [c, l]); },
    cut(x, y, z) { m.delete(kk(x, y, z)); },
    has: (x, y, z) => m.has(kk(x, y, z)),
    // a shell grown off the head: t(px, py, pz, ox, oy, oz) → the thickness over the nearest head cell p, in the outward direction o
    grow(t, c, l = 0, round = .3) {
      for (let x = -16; x <= 15; x++) for (let y = floor; y <= 50; y++) for (let z = -16; z <= 16; z++) { if (inHead(x, y, z)) continue;
        const px = cl(x, X0, X1), py = cl(y, Y0, Y1), pz = cl(z, Z0, Z1), ox = x - px, oy = y - py, oz = z - pz, T = t(px, py, pz, ox, oy, oz);
        if (T > 0 && Math.hypot(ox, oy, oz) <= T + round) A.put(x, y, z, typeof c === 'function' ? c(x, y, z) : c, l); } },
    // an ellipsoid round (cx, cy, cz) in continuous coordinates (cell centres at +.5); fuzz roughens its surface
    ball(cx, cy, cz, rx, ry, rz, c, l = 0, fuzz = 0, keep = () => true) {
      for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++) for (let z = Math.floor(cz - rz - 1); z <= cz + rz + 1; z++) {
        const e = ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 + ((z + .5 - cz) / rz) ** 2;
        if (e <= 1 + fuzz * (rnd(x, y, z, 7) - .5) && keep(x, y, z)) A.put(x, y, z, typeof c === 'function' ? c(x, y, z) : c, l); } },
    box(x0, y0, z0, x1, y1, z1, c, l = 0) { for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) A.put(x, y, z, typeof c === 'function' ? c(x, y, z) : c, l); },
    // a 6-connected run of cells through points [x, y, z] (one axis a step, so a strand never hangs on an edge)
    path(pts, c, l = 0) { let p = pts[0].map(Math.round); A.put(...p, typeof c === 'function' ? c(...p, 0) : c, l); let n = 0;
      for (const q0 of pts.slice(1)) { const q = q0.map(Math.round);
        while (p[0] !== q[0] || p[1] !== q[1] || p[2] !== q[2]) { const d = [0, 1, 2].map(i => q[i] - p[i]), i = [0, 1, 2].reduce((a, b) => Math.abs(d[b]) > Math.abs(d[a]) ? b : a);
          p = p.slice(); p[i] += Math.sign(d[i]); n++; A.put(...p, typeof c === 'function' ? c(...p, n) : c, l); } } },
    recolor(fn) { for (const [k, v] of m) { const r = fn(...uk(k), v[0]); if (r !== undefined) v[0] = r; } },
    exposed: (x, y, z) => N6.some(([a, b, c]) => !m.has(kk(x + a, y + b, z + c)) && !inHead(x + a, y + b, z + c)),
    // write what is 6-connected to the head (skin and ears); anything else is dropped here, so nothing ever floats
    commit() { const seen = new Set(), q = [];
      for (const k of m.keys()) { const [x, y, z] = uk(k); if (N6.some(([a, b, c]) => H.has(x + a, y + b, z + c))) { seen.add(k); q.push(k); } }
      while (q.length) { const [x, y, z] = uk(q.pop()); for (const [a, b, c] of N6) { const n = kk(x + a, y + b, z + c); if (m.has(n) && !seen.has(n)) { seen.add(n); q.push(n); } } }
      for (const [k, [c, l]] of m) if (seen.has(k)) { const [x, y, z] = uk(k); H.set(x, y, z, c, l); } },
  };
  return A;
}

// the hairline: is head cell p inside the hair? f(px) the lowest row on the front, s(pz) on the sides, b(px) on the back
const hairline = (f, s, b) => (px, py, pz, ox, oy, oz) => {
  if (oy > 0) return true;
  const lo = Math.max(oz > 0 ? f(px) : -99, oz < 0 ? b(px) : -99, ox !== 0 ? s(pz) : -99);
  return py >= lo;
};
const hairShell = (inside, T = 1) => (...a) => inside(...a) ? (typeof T === 'function' ? T(...a) : T) : 0;
const at = v => () => v;   // a constant hairline

// ───────────────────────── hats (from hats.js, verbatim)
// ── helpers ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// a footprint: box x0..x1, z0..z1 (inclusive), vertical corners chamfered by c (c 1 drops the corner cell, c 2 a 3-cell step)
const inFoot = (x, z, f) => { const dx = Math.min(x - f[0], f[1] - x), dz = Math.min(z - f[2], f[3] - z); return dx >= 0 && dz >= 0 && dx + dz >= (f[4] ?? 1); };
// fill a solid, one footprint per row: rows = { y: [x0, x1, z0, z1, c] }; col: colour or (x, y, z) → colour; skip(x, y, z) leaves a cell
function solid(H, rows, col, l = 0, skip) {
  for (const [ys, f] of Object.entries(rows)) { const y = +ys;
    for (let x = f[0]; x <= f[1]; x++) for (let z = f[2]; z <= f[3]; z++) if (inFoot(x, z, f) && !(skip && skip(x, y, z))) H.set(x, y, z, typeof col === 'function' ? col(x, y, z) : col, l); } }
const rowsOf = (y0, y1, f, o = {}) => { for (let y = y0; y <= y1; y++) o[y] = f; return o; };
// a ring: the cells of footprint `o` that are not inside footprint `i` (both [x0, x1, z0, z1, c])
const ring = (H, y, o, i, col, l = 0) => { for (let x = o[0]; x <= o[1]; x++) for (let z = o[2]; z <= o[3]; z++) if (inFoot(x, z, o) && !(x > i[0] && x < i[1] && z > i[2] && z < i[3])) H.set(x, y, z, typeof col === 'function' ? col(x, y, z) : col, l); };

// ───────────────────────── held (from held.js, verbatim)
const INK = 0x17171b;
const bx = (G, x0, x1, y0, y1, z0, z1, c, l = 0) => G.box(x0, y0, z0, x1 + 1, y1 + 1, z1 + 1, c, l);   // inclusive box
const grip = (G, ctx, c, l = 0) => { for (const [x, y, z] of ctx.grip.cells) G.set(x, y, z, c, l); };
// the strap / handle of a hanging thing: down from the fist's front (z 2) and back (z −3) to the top of what hangs (y 5 → 7)
const hangers = (G, c, l = 0, y0 = 6) => { for (const z of [-3, 2]) for (let y = y0; y <= 7; y++) G.set(6, y, z, c, l); };
const RING2 = [[5, 6], [6, 6], [7, 6], [6, 7], [7, 7], [7, 8]];
const sq3 = (G, z, c, l = 0) => bx(G, 5, 7, 6, 8, z, z, c, l);
const plus = (G, z, c, l = 0) => { for (const [x, y] of [[6, 7], [5, 7], [7, 7], [6, 6], [6, 8]]) G.set(x, y, z, c, l); };

export { shell, sleeves, hem, vee, collarWings, ARM, hair, hairline, hairShell, at, inHead, inFoot, solid, rowsOf, ring, INK, bx, grip, hangers, RING2, sq3, plus };
