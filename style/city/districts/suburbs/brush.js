// PLEASANTVIEW · voxel brushes (owner: the Pleasantview section agent). Memoised prop templates centred on their base, lettering that
// records itself for the audit (board behind, viewer in front), cylinders, rings, lines, hand-painted boards. Worker-safe (no DOM).
import { Vol, meshed, textMask } from '../../vox.js';
import { PAL, CV, hash, shade } from '../../style.js';
import { TOD } from '../../kit.js';
import { REG } from '../../audit.js';
import { off, kerbX, kerbZ } from '../frame.js';

export { PAL, CV, hash, shade, TOD, Vol };

// SPREAD · A HERO'S FRAME (style/city/SPREAD.md). Pleasantview's three heroes author in today's metres, the frame of their block:
// framed(ctx) carries a building / volume / mass rect by the block's shift and a put's point through kerb (in the block the shift; in the
// street band kept to its kerb: ../frame.js kerbX / kerbZ); frameR is the block's interior in that frame (today's); a direct keep, door,
// sign log, wput or anchor takes kerb / keepB; a volume's own origin takes the shift (off). A value read back off a volume (V.org, a
// frame's xz) is already the spread world's. The generated lots (buildLots, yard.js) build in the spread world: give them the plain ctx.
// The identity at SPREAD 0.
export { off };
export const kerb = (x, z) => [kerbX(x), kerbZ(z)], keepB = q => [kerbX(q[0]), q[1], kerbZ(q[2]), kerbX(q[3]), q[4], kerbZ(q[5])];
export const frameR = ctx => { const [sx, sz] = off(ctx), R = ctx.R; return { x0: R.x0 - sx, z0: R.z0 - sz, x1: R.x1 - sx, z1: R.z1 - sz }; };
export function framed(ctx) { const [sx, sz] = off(ctx);
  return Object.assign(Object.create(ctx), {
    volume: (x0, y0, z0, x1, y1, z1, o) => ctx.volume(x0 + sx, y0, z0 + sz, x1 + sx, y1, z1 + sz, o),
    mass: (V, r, o) => ctx.mass(V, [r[0] + sx, r[1] + sz, r[2] + sx, r[3] + sz], o),
    put: (prop, x, z, o) => ctx.put(prop, ...kerb(x, z), o) }); }
const memo = new Map();
// one template per key and time of day (lit parts switch to layer 3 at night); kind = the middle of every item id
export const M = (key, kind, f) => { const k = key + '|' + (TOD.night ? 1 : 0); let b = memo.get(k); if (!b) { b = f(); if (b && !b.kind) b.kind = kind; memo.set(k, b); } return b; };
export const lit = (day = 1) => TOD.night ? 3 : day;
// a prop volume: origin at its base centre (cx, cz in voxels), facing +z; s = grain
export const pv = (nx, ny, nz, cx = nx / 2, cz = nz / 2, s = CV) => new Vol(Math.max(1, Math.round(nx)), Math.max(1, Math.round(ny)), Math.max(1, Math.round(nz)), { s, org: [-cx * s, 0, -cz * s], ground: true });
export const done = (V, kind) => Object.assign(meshed(V), { kind });
const TM = new Map(); export const tm = s => { let m = TM.get(s); if (!m) TM.set(s, m = textMask(s)); return m; };
export const tw = (s, sc = 1) => tm(s).w * sc;
// lettering on the +z (dir 1) or −z (dir −1) face of a board one voxel behind it; every voxel is recorded for the audit
export function txt(V, s, x0, ytop, z, c, l = 0, dir = 1, sc = 1) {
  const t = tm(s); V.recNext();
  for (let j = 0; j < 7; j++) for (let i = 0; i < t.w; i++) if (t.at(i, j)) for (let a = 0; a < sc; a++) for (let b = 0; b < sc; b++) {
    const x = dir > 0 ? x0 + i * sc + a : x0 + (t.w - 1 - i) * sc + (sc - 1 - a), y = ytop - j * sc - b; V.set(x, y, z, c, l); V.recN(s, x, y, z, 0, dir); }
  return t.w * sc;
}
export function cyl(V, cx, cz, r, y0, y1, c, l = 0) { for (let y = y0; y < y1; y++) for (let x = Math.floor(cx - r - 1); x <= cx + r; x++) for (let z = Math.floor(cz - r - 1); z <= cz + r; z++) if (Math.hypot(x + .5 - cx, z + .5 - cz) <= r) V.set(x, y, z, typeof c === 'function' ? c(x, y, z) : c, l); }
export function ring(V, cx, cz, r0, r1, y0, y1, c, l = 0) { for (let y = y0; y < y1; y++) for (let x = Math.floor(cx - r1 - 1); x <= cx + r1; x++) for (let z = Math.floor(cz - r1 - 1); z <= cz + r1; z++) { const d = Math.hypot(x + .5 - cx, z + .5 - cz); if (d <= r1 && d > r0) V.set(x, y, z, typeof c === 'function' ? c(x, y, z) : c, l); } }
export function line(V, x0, y0, z0, x1, y1, z1, c, l = 0, t = 1) { const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0))));
  for (let k = 0; k <= n; k++) { const x = Math.round(x0 + (x1 - x0) * k / n), y = Math.round(y0 + (y1 - y0) * k / n), z = Math.round(z0 + (z1 - z0) * k / n); V.box(x, y, z, x + t, y + t, z + t, c, l); } }
export const mix = (a, b, t) => { const m = k => Math.round(((a >> k) & 255) * (1 - t) + ((b >> k) & 255) * t); return (m(16) << 16) | (m(8) << 8) | m(0); };
export const air = (c, t = .3) => mix(c, PAL.horizon, t);   // far tiers lean 30 % toward the haze (STYLE §9)
export const pick = (arr, u) => arr[Math.min(arr.length - 1, (u * arr.length) | 0)];
export const wpick = (u, opts) => { const t = opts.reduce((s, o) => s + o[1], 0); let x = u * t; for (const [v, w] of opts) if ((x -= w) < 0) return v; return opts[opts.length - 1][0]; };

// ── A HAND-PAINTED BOARD at 0.05 grain: plywood with painted letters on one or two stakes (or none, for a wall or a fence).
//   lines: 'YARD/SALE' ('/' breaks a line) · o: { bg, fg, posts: 0|1|2, h (stake height under the board, m), frame, s, lit }
export function board(lines, o = {}) {
  return M('board:' + lines + JSON.stringify(o), o.kind || 'sign', () => {
    const s = o.s ?? .05, rows = lines.split('/'), sc = o.sc ?? 1, pad = o.pad ?? 3, gap = 2 * sc;
    const w = Math.max(...rows.map(r => tw(r, sc))) + 2 * pad, h = rows.length * 7 * sc + (rows.length - 1) * gap + 2 * pad;
    const post = o.posts ?? 2, ph = Math.round((o.h ?? .45) / s), th = post ? ph + h + 1 : h + 1, D = 4;
    const V = new Vol(w + 2, th + 1, D, { s, org: [-(w + 2) * s / 2, 0, -D * s / 2], ground: true }), bg = o.bg ?? 0xe9dcc0, fg = o.fg ?? PAL.ink, y0 = post ? ph : 0;
    if (post === 1) V.box((w >> 1), 0, 0, (w >> 1) + 2, y0 + h - 2, 2, o.postC ?? PAL.woodD);
    if (post === 2) for (const x of [2, w - 2]) V.box(x, 0, 0, x + 2, y0 + h - 2, 2, o.postC ?? PAL.woodD);
    for (let x = 1; x < w + 1; x++) { let top = y0 + h, bot = y0; if (!o.clean && hash(x, 7, lines.length) > .86) top -= 1;
      V.box(x, bot, 2, x + 1, top, 3, (xx, y) => (o.edge && (y === bot || y === top - 1 || x === 1 || x === w) ? o.edge : bg), o.lit && TOD.night ? 3 : 0); }
    if (o.frame) for (let x = 3; x < w - 1; x++) { V.set(x, y0 + 1, 3, o.frame); V.set(x, y0 + h - 2, 3, o.frame); }
    rows.forEach((r, k) => { const rw = tw(r, sc), xs = 1 + pad + ((w - 2 * pad - rw) >> 1), top = y0 + h - pad - k * (7 * sc + gap) - 1, t = tm(r); V.recNext();
      for (let j = 0; j < 7; j++) for (let i = 0; i < t.w; i++) if (t.at(i, j)) for (let a = 0; a < sc; a++) for (let b = 0; b < sc; b++) { const x = xs + i * sc + a, y = top - j * sc - b; V.set(x, y, 3, fg, o.lit && TOD.night ? 3 : 0); V.recN(r, x, y, 3, 0, 1); } });
    return done(V, o.kind || 'sign');
  });
}
// the kit's own signs go into the block's sign log (the audit's sign-repeat check: the same words within 96 m are a repeat)
export function logSign(key, x, z, r = 96) { const b = REG.blk; if (!b || !key) return; (b.signs ??= []).push({ fam: 'kit', key: String(key), x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10, r, group: b.group }); }
