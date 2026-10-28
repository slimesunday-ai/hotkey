// Facade kit: every facade is authored in a local frame — a along the wall (left→right seen from the street), y up, d depth
// (0 = wall skin, + out toward the street, − into the wall). Sizes are in city voxels (0.1); `q` rescales for coarser grains.
import { textMask, rasterMask } from './vox.js';
import { PAL, CV, hash, shade } from './style.js';
import { REG } from './audit.js';
export const AIR = -1;
export const TOD = { night: false };

export function frame(V, B, side) {
  const m = { '+z': (a, d) => [B.x0 + a, B.z1 - 1 + d], '-z': (a, d) => [B.x1 - 1 - a, B.z0 - d], '-x': (a, d) => [B.x0 - d, B.z0 + a], '+x': (a, d) => [B.x1 - 1 + d, B.z1 - 1 - a] }[side];
  const k = CV / V.s, f = { len: side[1] === 'z' ? B.x1 - B.x0 : B.z1 - B.z0, side, xz: m, V, k, q: v => Math.max(1, Math.round(v * k)),
    set(a, y, d, c, l) { const [x, z] = m(a, d); if (c === AIR) V.del(x, y, z); else V.set(x, y, z, c, l); },
    box(a0, y0, d0, a1, y1, d1, c, l) { for (let a = a0; a < a1; a++) for (let y = y0; y < y1; y++) for (let d = d0; d < d1; d++) f.set(a, y, d, typeof c === 'function' ? c(a, y, d) : c, l);
      // pass 1d: anything that projects past the plinth zone (> 0.3 m: awnings, canopies, stoops, stands, blades, fire escapes) is a keep-out
      // (cleanup pass: only what lands inside the volume — a part drawn past its edge is cut there, and so is its keep)
      if (d1 > 3 && c !== AIR && a1 > a0 && y1 > y0 && REG.blk) { let [xa, za] = m(a0, Math.max(d0, 0)), [xb, zb] = m(a1 - 1, d1 - 1); const s = V.s, cl = (v, n) => Math.max(0, Math.min(n - 1, v));
        if (Math.max(xa, xb) >= 0 && Math.min(xa, xb) < V.nx && Math.max(za, zb) >= 0 && Math.min(za, zb) < V.nz && y0 < V.ny) { xa = cl(xa, V.nx); xb = cl(xb, V.nx); za = cl(za, V.nz); zb = cl(zb, V.nz);
          REG.keep([V.org[0] + Math.min(xa, xb) * s, V.org[1] + Math.max(0, y0) * s, V.org[2] + Math.min(za, zb) * s, V.org[0] + (Math.max(xa, xb) + 1) * s, V.org[1] + Math.min(V.ny, y1) * s, V.org[2] + (Math.max(za, zb) + 1) * s], 'facade'); } } },
    // cleanup pass · the world box of a frame box, to ask the registry before drawing (REG.why, REG.walkGap: a stand, a stoop or a post
    // that projects onto the sidewalk keeps the walkers' clear path like any prop)
    world(a0, y0, d0, a1, y1, d1) { const [xa, za] = m(a0, Math.max(d0, 0)), [xb, zb] = m(a1 - 1, d1 - 1), s = V.s;
      return [V.org[0] + Math.min(xa, xb) * s, V.org[1] + y0 * s, V.org[2] + Math.min(za, zb) * s, V.org[0] + (Math.max(xa, xb) + 1) * s, V.org[1] + y1 * s, V.org[2] + (Math.max(za, zb) + 1) * s]; },
    mask(M, a0, ytop, d0, d1, c, l, sc = 1) { for (let j = 0; j < M.h; j++) for (let i = 0; i < M.w; i++) if (M.at(i, j)) f.box(a0 + i * sc, ytop - (j + 1) * sc, d0, a0 + (i + 1) * sc, ytop - j * sc, d1, typeof c === 'function' ? c(i, j) : c, l);
      // pass 1d: every text voxel remembers where its board and its viewer are (the audit checks it once the volume is done)
      V.recNext(); const lab = M.s ?? 'text'; for (let j = 0; j < M.h; j++) for (let i = 0; i < M.w; i++) if (M.at(i, j)) for (let u = 0; u < sc; u++) for (let v = 0; v < sc; v++) f.rec(lab, a0 + i * sc + u, ytop - j * sc - 1 - v, d1 - 1, 0, 1, d1 - d0); },
    // record one text voxel at (a, y, d) whose board is at −(na, nd) (and, for thick letters, `depth` voxels deep)
    rec(label, a, y, d, na, nd, depth = 1) { const [x, z] = m(a, d), [bx, bz] = m(a - na * depth, d - nd * depth), [fx, fz] = m(a + na, d + nd); V.rec(label, x, y, z, bx, bz, fx, fz); },
    text(s, a0, ytop, d0, d1, c, l, sc = 1, align = 0) { const M = textMask(s); const x = align === 0 ? a0 : align === 1 ? Math.round(a0 - M.w * sc / 2) : a0 - M.w * sc; f.mask(M, x, ytop, d0, d1, c, l, sc); return M.w * sc; },
  };
  return f;
}
export const glass = (w, h, lit, glint = true) => (a, y) => { const t = y / Math.max(1, h - 1); if (lit) return t > .6 ? PAL.litHi : PAL.litLo;
  if (glint && (a + y === h - 3 || a + y === h - 2) && a < w * .45) return PAL.glint; return t > .62 ? PAL.glassHi : PAL.glassLo; };
// punched window, toon-sized: recess, glass, trim ring, chunky sill + cap, meeting rail; optional AC unit / flower box
export function win(f, a0, y0, w, h, trim, o = {}) {
  const q = f.q, r = q(2), lit = o.lit ?? (TOD.night && hash(a0 * 3 + f.len, y0, w + (f.side.charCodeAt(1) << 4)) > .5);
  f.box(a0 - 1, y0 - 1, 0, a0 + w + 1, y0 + h + 1, q(2), trim);
  f.box(a0, y0, -r, a0 + w, y0 + h, q(2), AIR);
  const gl = glass(w, h, lit, f.k === 1 && y0 < 100); f.box(a0, y0, -r - 1, a0 + w, y0 + h, -r, (a, y) => gl(a - a0, y - y0), lit ? 3 : 1);
  if (h > 6) f.box(a0, y0 + (h >> 1), -r, a0 + w, y0 + (h >> 1) + 1, -r + 1, trim);
  f.box(a0 - q(2), y0 - q(3), 0, a0 + w + q(2), y0 - 1, q(3), trim);
  f.box(a0 - q(2), y0 + h + 1, 0, a0 + w + q(2), y0 + h + q(3), q(2), trim);
  if (o.ac) { f.box(a0 + q(2), y0, -r, a0 + w - q(2), y0 + q(6), q(4), 0xe6e6e6); for (let y = y0 + 1; y < y0 + q(6); y += 2) f.box(a0 + q(3), y, q(4), a0 + w - q(3), y + 1, q(5), 0xb9b9bd); }
  if (o.box) { f.box(a0 - 1, y0 - q(7), q(1), a0 + w + 1, y0 - q(4), q(4), 0x8b4a24); for (let a = a0; a < a0 + w; a++) if (hash(a, y0) > .35) f.set(a, y0 - q(4), q(3), [0xff3b6b, 0xffd21f, 0xffffff, 0xff7a1a][(hash(a, y0, 7) * 4) | 0]); }
}
export function bays(len, bw) { const n = Math.max(1, Math.floor(len / bw)), m = Math.floor((len - n * bw) / 2); return Array.from({ length: n }, (_, i) => m + i * bw); }
// solid mass + roof + parapet ring; cornice + plinth on the street sides
export function mass(V, B, H, wall, trim, sides, o = {}) {
  const k = CV / V.s, q = v => Math.max(1, Math.round(v * k));
  V.box(B.x0, 0, B.z0, B.x1, H, B.z1, wall);
  V.box(B.x0 + 1, H - 1, B.z0 + 1, B.x1 - 1, H, B.z1 - 1, o.roof ?? PAL.roof);
  const ph = o.parapet ?? q(6); V.box(B.x0, H, B.z0, B.x1, H + ph, B.z1, wall); V.clear(B.x0 + q(2), H, B.z0 + q(2), B.x1 - q(2), H + ph, B.z1 - q(2));
  // pass 1d: the mass (placement, clipping, audit) + the plinth zone: bands, sills, pipes and bases reach 0.3 m out on the lower 3 m
  const X0 = V.org[0] + B.x0 * V.s, Z0 = V.org[2] + B.z0 * V.s, X1 = V.org[0] + B.x1 * V.s, Z1 = V.org[2] + B.z1 * V.s;
  V.own = REG.footprint(X0, Z0, X1, Z1, V.org[1] + (H + ph + 1) * V.s, V.org[1] + H * V.s); if (V.org[1] < 1) REG.keep([X0 - .35, V.org[1], Z0 - .35, X1 + .35, V.org[1] + 3.2, Z1 + .35], 'plinth');   // pass 2: + roofY, the roof surface (people may stand on it)
  for (const s of sides) { const f = frame(V, B, s);
    f.box(-1, H + ph - 1, 0, f.len + 1, H + ph + 1, q(2), trim);
    if (o.cornice !== false) { f.box(-1, H - q(5), 0, f.len + 1, H - 1, q(2), trim); f.box(-q(2), H - q(3), 0, f.len + q(2), H - 1, q(3), trim); for (let a = 1; a < f.len - 1; a += q(4)) f.set(a, H - q(6), 1, trim); }
    f.box(0, 0, 0, f.len, q(3), q(2), shade(wall, .78)); }
  return s => frame(V, B, s);
}
// storefront: frame, door, big windows (lit shop glow), sign band with an invented name, optional box awning
export function shopFront(f, o) {
  const q = f.q, L = f.len, H = q(36), name = o.name, sc = o.sign, band = o.band ?? PAL.ink, a0 = o.a0 ?? 0, a1 = o.a1 ?? L;
  f.box(a0, 0, 0, a1, H, q(2), band); f.box(a0, q(27), 0, a1, H, q(4), sc);
  const doorAt = o.door ?? (o.doorLeft ? a0 + q(4) : a1 - q(18));
  f.box(doorAt, 1, -q(3), doorAt + q(14), q(25), q(3), AIR); f.box(doorAt, 1, -q(4), doorAt + q(14), q(25), -q(3), (a, y) => y > q(20) ? 0xffe3a0 : 0x2a2d38, 1);
  for (let a = a0 + q(4); a + q(12) <= a1 - q(4); a += q(26)) { if (a + q(12) > doorAt - q(2) && a < doorAt + q(16)) continue; const w = Math.min(q(22), Math.max(q(12), (doorAt > a ? doorAt - q(3) : a1 - q(4)) - a));
    f.box(a, q(6), -q(3), a + w, q(24), q(3), AIR); f.box(a, q(6), -q(4), a + w, q(20), -q(3), (aa, y) => hash(aa, y, a) > .82 ? [0xff4fa3, 0xffe23a, 0x2de2e6][(hash(aa, a) * 3) | 0] : 0x3b3f4a, 1); f.box(a, q(20), -q(4), a + w, q(24), -q(3), PAL.litHi, TOD.night ? 3 : 1); }
  if (name && f.k === 1) { const light = [0xffe23a, 0xffc21a, 0x2de2e6, 0x6cff4a, 0xf7f7f2].includes(sc); f.text(name, Math.round((a0 + a1) / 2), q(35), q(4), q(5), light ? PAL.ink : PAL.white, TOD.night ? 3 : 0, 1, 1); }
  if (o.awning) { const ac = o.awning; f.box(a0 - (o.wrapL ? q(14) : 0), q(26), q(4), a1 + (o.wrapR ? q(14) : 0), q(28), q(14), (a) => ((a >> 2) & 1) ? ac : PAL.white); }
  return doorAt;
}
// NYC stoop: steps rise 0.2 / run 0.3 up to a landing 1.2 high; stone cheek walls you can sit on; door at the top
export function stoop(f, a0, w, stone, door, trim) {
  const top = d => d < 10 ? 12 : Math.max(0, 12 - 2 * (Math.floor((d - 10) / 3) + 1));
  for (let d = 1; d < 25; d++) { const t = top(d); if (t <= 0) continue; f.box(a0, 0, d, a0 + w, t, d + 1, stone); f.box(a0 - 3, 0, d, a0, t + 4, d + 1, shade(stone, .9)); f.box(a0 + w, 0, d, a0 + w + 3, t + 4, d + 1, shade(stone, .9)); }
  for (const a of [a0 - 3, a0 + w]) f.box(a, 0, 22, a + 3, 9, 25, shade(stone, .82));
  f.box(a0 + 3, 12, -3, a0 + w - 3, 38, 1, AIR); f.box(a0 + 3, 12, -3, a0 + w - 3, 38, -2, (a, y) => (a === a0 + w - 5 && y === 25) ? PAL.gold : door, 1);
  f.box(a0 + 1, 38, 0, a0 + w - 1, 42, 2, trim); f.box(a0, 42, 0, a0 + w, 44, 3, trim);
}
// fire escape: black grid platforms at each floor, railings, zig-zag stairs, drop ladder
export function fireEscape(f, a0, a1, levels, I = PAL.iron) {
  levels.forEach((py, k) => { f.box(a0, py, 1, a1, py + 1, 13, (a, y, d) => (d & 1) ? I : undefined); f.box(a0, py, 1, a1, py + 1, 2, I); f.box(a0, py, 12, a1, py + 1, 13, I);
    for (let a = a0; a < a1; a += 2) f.box(a, py + 1, 12, a + 1, py + 10, 13, I); f.box(a0, py + 10, 1, a1, py + 11, 13, (a, y, d) => (d === 12 || a === a0 || a === a1 - 1) ? I : undefined);
    for (let d = 1; d < 13; d += 2) { f.box(a0, py + 1, d, a0 + 1, py + 10, d + 1, I); f.box(a1 - 1, py + 1, d, a1, py + 10, d + 1, I); }
    // stairs: each tread runs from the previous tread's end to its own, so the flight is one connected piece (pass 1d: no floating treads)
    if (k < levels.length - 1) { const rise = levels[k + 1] - py - 1, at = t => k & 1 ? a1 - 6 - Math.round(t * (a1 - a0 - 12) / rise) : a0 + 6 + Math.round(t * (a1 - a0 - 12) / rise);
      for (let t = 0; t < rise; t++) { const a = at(t), p = t ? at(t - 1) : a; f.box(Math.min(a, p), py + 1 + t, 4, Math.max(a, p) + 1, py + 2 + t, 10, I); } } });
  const l = levels[0]; for (let y = l - 22; y < l; y++) { f.set(a1 - 10, y, 11, I); f.set(a1 - 5, y, 11, I); if (y % 3 === 0) f.box(a1 - 10, y, 11, a1 - 4, y + 1, 12, I); }
}
export { textMask, rasterMask };
