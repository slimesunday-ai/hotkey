// SUNNY ACRES + MILLENNIUM MALL · shared voxel brushes (owner: the Sunny Acres / Millennium Mall section agent, batch 3).
// Small helpers both kits draw with: memoised prop templates, a prop volume centred on its base, lettering that records itself for the
// audit (board behind, viewer in front), cylinders, lines, hand-painted boards. Worker-safe (no three, no DOM).
import { Vol, meshed, textMask } from '../../vox.js';
import { PAL, CV, hash, shade } from '../../style.js';
import { TOD } from '../../kit.js';

export { PAL, CV, hash, shade, TOD, Vol, meshed, textMask };
// a template per key and time of day (lit parts switch layer at night); kind = the middle of every item id
const memo = new Map();
export const M = (key, kind, f) => { const k = key + '|' + (TOD.night ? 1 : 0); let b = memo.get(k); if (!b) { b = f(); if (b && !b.kind) b.kind = kind; memo.set(k, b); } return b; };
export const lit = (day = 1) => TOD.night ? 3 : day;          // glowing at night, gloss (or matte) by day
// a prop volume: origin at its base centre (cx, cz in voxels), facing +z; s = grain
export const pv = (nx, ny, nz, cx = nx / 2, cz = nz / 2, s = CV) => new Vol(Math.max(1, Math.round(nx)), Math.max(1, Math.round(ny)), Math.max(1, Math.round(nz)), { s, org: [-cx * s, 0, -cz * s], ground: true });
export const done = (V, kind, o = {}) => Object.assign(meshed(V), { kind }, o);
// lettering on the +z (dir 1) or −z (dir −1) face of a board that sits one voxel behind (z − dir); records every voxel for the audit
const TM = new Map(); export const tm = s => { let m = TM.get(s); if (!m) TM.set(s, m = textMask(s)); return m; };
export function txt(V, s, x0, ytop, z, c, l = 0, dir = 1, sc = 1) {
  const t = tm(s); V.recNext();
  for (let j = 0; j < 7; j++) for (let i = 0; i < t.w; i++) if (t.at(i, j)) for (let a = 0; a < sc; a++) for (let b = 0; b < sc; b++) {
    const x = dir > 0 ? x0 + i * sc + a : x0 + (t.w - 1 - i) * sc + (sc - 1 - a), y = ytop - j * sc - b; V.set(x, y, z, c, l); V.recN(s, x, y, z, 0, dir); }
  return t.w * sc;
}
// lettering on a ±x face (dir 1: reads on the +x face, board at x − 1)
export function txtX(V, s, z0, ytop, x, c, l = 0, dir = 1, sc = 1) {
  const t = tm(s); V.recNext();
  for (let j = 0; j < 7; j++) for (let i = 0; i < t.w; i++) if (t.at(i, j)) for (let a = 0; a < sc; a++) for (let b = 0; b < sc; b++) {
    const z = dir > 0 ? z0 + (t.w - 1 - i) * sc + (sc - 1 - a) : z0 + i * sc + a, y = ytop - j * sc - b; V.set(x, y, z, c, l); V.recN(s, x, y, z, dir, 0); }
  return t.w * sc;
}
export const tw = (s, sc = 1) => tm(s).w * sc;
export function cyl(V, cx, cz, r, y0, y1, c, l = 0) { for (let y = y0; y < y1; y++) for (let x = Math.floor(cx - r - 1); x <= cx + r; x++) for (let z = Math.floor(cz - r - 1); z <= cz + r; z++) if (Math.hypot(x + .5 - cx, z + .5 - cz) <= r) V.set(x, y, z, typeof c === 'function' ? c(x, y, z) : c, l); }
export function ring(V, cx, cz, r0, r1, y0, y1, c, l = 0) { for (let y = y0; y < y1; y++) for (let x = Math.floor(cx - r1 - 1); x <= cx + r1; x++) for (let z = Math.floor(cz - r1 - 1); z <= cz + r1; z++) { const d = Math.hypot(x + .5 - cx, z + .5 - cz); if (d <= r1 && d > r0) V.set(x, y, z, typeof c === 'function' ? c(x, y, z) : c, l); } }
export function line(V, x0, y0, z0, x1, y1, z1, c, l = 0, t = 1) { const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0)))); for (let k = 0; k <= n; k++) { const x = Math.round(x0 + (x1 - x0) * k / n), y = Math.round(y0 + (y1 - y0) * k / n), z = Math.round(z0 + (z1 - z0) * k / n); V.box(x, y, z, x + t, y + t, z + t, c, l); } }
// a sagging wire between two points (a catenary-ish parabola), every step touching the last (no floating voxels)
export function wire(V, x0, y0, z0, x1, y1, z1, sag, c, l = 0) { const n = Math.max(2, Math.ceil(Math.hypot(x1 - x0, z1 - z0))); let px = null, py, pz;
  for (let k = 0; k <= n; k++) { const t = k / n, x = Math.round(x0 + (x1 - x0) * t), z = Math.round(z0 + (z1 - z0) * t), y = Math.round(y0 + (y1 - y0) * t - sag * 4 * t * (1 - t));
    if (px !== null && Math.abs(y - py) > 1) { const lo = Math.min(y, py), hi = Math.max(y, py); for (let yy = lo; yy <= hi; yy++) V.set(px, yy, pz, c, l); }
    V.set(x, y, z, c, l); px = x; py = y; pz = z; } }
export const mix = (a, b, t) => { const m = k => Math.round(((a >> k) & 255) * (1 - t) + ((b >> k) & 255) * t); return (m(16) << 16) | (m(8) << 8) | m(0); };
export const air = (c, t = .3) => mix(c, PAL.horizon, t);     // far tiers lean 30 % toward the haze (far.js)
export const pick = (arr, u) => arr[Math.min(arr.length - 1, (u * arr.length) | 0)];

// ── A HAND-PAINTED BOARD: plywood (or tin) with painted letters, 0.05 grain, on stakes, a post, or for a wall (posts: 0).
//   lines: 'BEWARE/OF DOG' ('/' breaks a line) · o: { bg, fg, edge, posts: 0 | 1 | 2, h (post height to the board's foot, m),
//   tilt (a crooked board: each column steps), drip (paint runs under a few letters), frame (a painted border), arrow ('L'|'R'),
//   tin (corrugated sheet), s (grain) }. Every call with new text is its own template: no two signs in the district share one.
export function board(lines, o = {}) {
  const key = 'board:' + lines + JSON.stringify(o);
  return M(key, o.kind || 'sign', () => {
    const s = o.s ?? .05, rows = lines.split('/'), sc = o.sc ?? 1, pad = o.pad ?? 3, gap = 2 * sc;
    const w = Math.max(...rows.map(r => tw(r, sc))) + 2 * pad + (o.arrow ? 8 : 0), h = rows.length * 7 * sc + (rows.length - 1) * gap + 2 * pad;
    const post = o.posts ?? 2, ph = Math.round((o.h ?? .45) / s), tilt = o.tilt ? Math.ceil(w / 14) : 0, th = post ? ph + h + tilt + 1 : h + tilt + 1, D = 4;
    const V = new Vol(w + 2, th + 1, D, { s, org: [-(w + 2) * s / 2, 0, -D * s / 2], ground: true }), bg = o.bg ?? 0xe9dcc0, fg = o.fg ?? PAL.ink, y0 = post ? ph : 0;
    const off = x => o.tilt ? Math.round((o.tilt > 0 ? x : w - x) / 14) : 0;   // a crooked board: every 14 columns step up one
    // posts / stakes (wood), behind the board
    if (post === 1) V.box((w >> 1), 0, 0, (w >> 1) + 2, y0 + h - 2, 2, o.postC ?? PAL.woodD);
    if (post === 2) for (const x of [2, w - 2]) V.box(x, 0, 0, x + 2, y0 + off(x) + h - 2, 2, o.postC ?? PAL.woodD);
    // the board (1 voxel thick at z = 2), a ragged edge, an arrow point, a tin sheet's ribs
    for (let x = 1; x < w + 1; x++) { const yb = y0 + off(x); let top = yb + h, bot = yb;
      if (o.arrow === 'R' && x > w - 8) { const k = x - (w - 8); bot += k; top -= k; } if (o.arrow === 'L' && x < 9) { const k = 9 - x; bot += k; top -= k; }
      if (!o.clean && hash(x, 7, lines.length) > .86) top -= 1; if (!o.clean && hash(x, 9, lines.length) > .9) bot += 1;
      if (top > bot) V.box(x, bot, 2, x + 1, top, 3, (xx, y) => o.tin ? (x % 3 === 0 ? shade(bg, .86) : bg) : (o.edge && (y === bot || y === top - 1 || x === 1 || x === w) ? o.edge : bg), o.lit && TOD.night ? 3 : 0); }
    if (o.frame) for (let x = 3; x < w - 1; x++) { const yb = y0 + off(x); V.set(x, yb + 1, 3, o.frame); V.set(x, yb + h - 2, 3, o.frame); }
    // the lettering, one row at a time, riding the tilt; a few paint drips run down from letters
    rows.forEach((r, k) => { const rw = tw(r, sc), xs = 1 + (o.arrow === 'L' ? 8 : 0) + pad + (((w - 2 * pad - (o.arrow ? 8 : 0)) - rw) >> 1), top = y0 + h - pad - k * (7 * sc + gap) - 1;
      const t = tm(r); V.recNext();
      for (let j = 0; j < 7; j++) for (let i = 0; i < t.w; i++) if (t.at(i, j)) for (let a = 0; a < sc; a++) for (let b = 0; b < sc; b++) { const x = xs + i * sc + a, y = top - j * sc - b + off(x); V.set(x, y, 3, fg); V.recN(r, x, y, 3, 0, 1); }
      if (o.drip) for (let i = 0; i < t.w; i += 3) if (t.at(i, 6) && hash(i, k, 31) > .5) { const x = xs + i * sc, y = top - 7 * sc + off(x); if (y > y0 + off(x) + 1) V.set(x, y, 3, fg); } });
    return done(V, o.kind || 'sign');
  });
}
