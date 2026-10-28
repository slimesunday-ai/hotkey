// BLACKPINE WOODS · the trees (owner: the Blackpine Woods agent). Worker-safe.
// Every tree is drawn straight into its block's WOODS volume (0.4 m cubes: coarse, visibly cubic crowns — never round) and, for the far
// tier, into the far volume (0.5 m cubes, the far grain). A block draws every tree whose crown reaches into it, clipped to its own
// rect, so crowns run across block edges without a seam and nothing is drawn twice.
//   black pine · spruce · oak · autumn maple (orange / red / yellow trees) · birch · snag (dead, grey) · bush
import { hash, shade } from '../../style.js';
import { boxInto } from '../../vox.js';
import { TOD } from '../../kit.js';
import { SP } from './plan.js';

const mix = (a, b, t) => { const m = k => Math.round(((a >> k) & 255) * (1 - t) + ((b >> k) & 255) * t); return (m(16) << 16) | (m(8) << 8) | m(0); };
export const PAL_W = {
  trunk: 0x6b4226, trunkD: 0x55341e, trunkL: 0x8a5a34, cut: 0xd9b27a,
  pine: [0x184c35, 0x1f5f40, 0x27744c, 0x35905c],            // deep → sunlit tips (black pine: the dark ring)
  spruce: [0x17494a, 0x1e5c59, 0x27716b, 0x368a7f],
  pines: [[0x184c35, 0x1f5f40, 0x27744c, 0x35905c], [0x1d4a2c, 0x255c34, 0x2f7040, 0x42884e]],                            // black pine: blue-black, olive-black
  spruces: [[0x17494a, 0x1e5c59, 0x27716b, 0x368a7f], [0x1f4f63, 0x285f75, 0x33738a, 0x4a8ea3], [0x1c4f3c, 0x23634a, 0x2d7a58, 0x3f9468]],   // teal, blue spruce, green
  moon: 0x6f9aa8,                                                                                                            // a moonlit rim (night)
  oak: [0x24803a, 0x2f9444, 0x3caa4d, 0x55c35a],
  birchLeaf: [0x7fb733, 0x96c93a, 0xb2da45, 0xcfe95a], birch: 0xf2eee2, birchMark: 0x26262c,
  autumn: [[0xe0531c, 0xf56f1f, 0xff8d2a, 0xffb040], [0xc8321f, 0xe0422a, 0xf05a35, 0xff7a4a], [0xe89a12, 0xf5b41c, 0xffcb2a, 0xffe05a]],
  snag: [0x7a746e, 0x938d86, 0x5f5a55], bush: [0x2c7338, 0x368743, 0x46a052], berry: 0xd4202a, bloom: 0xff5fae,
  rock: [0x8e8f96, 0x76777e, 0xa8a9ae], moss: 0x4f8a38,
};
const pick = (arr, u) => arr[Math.min(arr.length - 1, (u * arr.length) | 0)];

// ── full / mid grain (0.4). V: a Vol with s = 0.4 whose org y is the forest floor. t = { x, z, sp, h, r, seed, v }
export function drawTree(V, t) {
  const s = V.s, cx = Math.floor((t.x - V.org[0]) / s), cz = Math.floor((t.z - V.org[2]) / s), H = Math.max(3, Math.round(t.h / s)), R = Math.max(1, Math.round(t.r / s)), sd = t.seed;
  const u = (a, b = 0) => hash(sd, a, b);
  switch (t.sp) {
    case SP.pine: case SP.spruce: return conifer(V, cx, cz, H, R, sd, t.sp === SP.spruce, u);
    case SP.oak: return broadleaf(V, cx, cz, H, R, sd, PAL_W.oak, u, 2);
    case SP.maple: return broadleaf(V, cx, cz, H, R, sd, PAL_W.autumn[(u(9) * 3) | 0], u, u(10) < .5 ? 2 : 1, true);
    case SP.birch: return birch(V, cx, cz, H, R, sd, u);
    case SP.snag: return snag(V, cx, cz, H, sd, u);
    case SP.bush: return bush(V, cx, cz, H, R, sd, u);
  }
}
// black pine / spruce: a trunk and stacked tiers that shrink to a spike. Every tree its own: a palette of three (spruce) or two (pine),
// square or diamond tiers, tiers that shift a cube this way or that and skip a beat, a ragged rim (a cube missing here, a tip drooping
// past it there), so a stand of them never reads as stacked floors — and at night the moon catches the west rims.
function conifer(V, cx, cz, H, R, sd, spruce, u) {
  const C = spruce ? PAL_W.spruces[(u(11) * 3) | 0] : PAL_W.pines[(u(11) * 2) | 0], night = TOD.night, base = Math.round(H * (spruce ? .16 : .26) + u(1) * 2);
  const heavy = [[1, 0], [-1, 0], [0, 1], [0, -1]][(u(12) * 4) | 0], shape0 = u(6) < (spruce ? .25 : .4);
  for (let y = 0; y < H - 1; y++) V.set(cx, y, cz, y < base + 2 ? PAL_W.trunk : C[0]);
  const top = H, inside = (dx, dz, r, dia) => dia ? Math.abs(dx) + Math.abs(dz) <= r + (r > 2 ? 1 : 0) : !(Math.abs(dx) === r && Math.abs(dz) === r && r > 0);
  const rimCol = (dx, dz, y, t) => night && (dx < 0 || dz > 0) && hash(sd, y * 7 + dx, dz * 3 + t) < .5 ? PAL_W.moon : C[t];   // (the moon sits west and south)
  // one layer of a tier: its cells, a ragged rim (a cube missing, a tip one cube out and one down), the heavy side a cube fuller
  const layer = (y, r, ox, oz, dia, body, rimT, droop) => {
    for (let dx = -r - 1; dx <= r + 1; dx++) for (let dz = -r - 1; dz <= r + 1; dz++) {
      const ext = r >= 2 && (dx * heavy[0] > 0 || dz * heavy[1] > 0) && hash(sd, y, dx * 17 + dz) < .35, rr = r + (ext ? 1 : 0); if (!inside(dx, dz, rr, dia)) continue;
      const rim = !inside(dx + Math.sign(dx), dz, rr, dia) || !inside(dx, dz + Math.sign(dz), rr, dia), h = hash(sd, y * 131 + dx * 7, dz + 91);
      if (rim && r >= 2 && h < .13) continue;                                                                                 // a gap in the rim
      V.set(cx + dx + ox, y, cz + dz + oz, rim ? rimCol(dx, dz, y, rimT) : body);
      if (rim && droop && r >= 2 && h > .86) { const sx = Math.sign(dx), sz = Math.sign(dz); V.set(cx + dx + ox + (Math.abs(dx) >= Math.abs(dz) ? sx : 0), y - 1, cz + dz + oz + (Math.abs(dz) > Math.abs(dx) ? sz : 0), rimCol(dx, dz, y, 3)); } } };
  if (spruce) {   // spruce: a stepped cone, every other layer a cube in (a zig-zag edge), each layer's reach jittered
    for (let y = base; y < top; y++) { const f = 1 - (y - base) / (top - base), r0 = Math.round(R * Math.pow(f, .9 + u(13) * .3)), full = (y - base) % 2 === 0 || r0 <= 1, jit = r0 >= 3 && hash(sd, y, 5) < .25 ? -1 : 0, r = Math.max(0, r0 - (full ? 0 : 1) + jit);
      layer(y, r, 0, 0, shape0, full ? C[1] : C[0], full ? 2 : 0, full); }
    V.set(cx, top, cz, C[3]); if (u(14) < .3) V.set(cx, top + 1, cz, C[2]); return; }
  // black pine: stacked tiers, a gap of two to four cubes between, each tier shifted a cube or turned (square ↔ diamond), a skirt under the rim
  let y = base, k = 0;
  while (y < top - 1) { const f = 1 - (y - base) / (top - base), r = Math.max(0, Math.round((R + .6) * Math.pow(f, .85)) - (hash(sd, k, 21) < .18 ? 1 : 0)), th = r <= 0 ? 3 : r >= 3 ? 2 : 1;
    const ox = r >= 2 ? Math.round((hash(sd, k, 22) - .5) * 2.2) : 0, oz = r >= 2 ? Math.round((hash(sd, k, 23) - .5) * 2.2) : 0, dia = hash(sd, k, 24) < .3 ? !shape0 : shape0;
    for (let t = 0; t < th; t++) layer(y + t, r, ox, oz, dia, t === th - 1 ? C[2] : C[1], t === th - 1 ? 3 : 1, t === 0);
    if (r >= 2) layer(y - 1, r - 1, ox, oz, dia, C[0], 0, false);                                                           // the skirt's shadow side
    y += th + 1 + (hash(sd, k, 25) < .45 ? 1 : 0) + (r <= 1 ? 0 : hash(sd, k, 26) < .2 ? 1 : 0); k++; }
  V.set(cx, top - 1, cz, C[2]); V.set(cx, top, cz, C[3]);
}
// oak / maple: a thick trunk that forks, a crown built as a cluster of cube blocks (4–6, different sizes and greens — or orange, red,
// yellow), each with a sunlit top layer and a shaded underside, so the crown is lumpy and plainly made of cubes (never round)
function broadleaf(V, cx, cz, H, R, sd, C, u, tw, autumn = false) {
  const tb = Math.round(H * (.36 + u(1) * .08)), rw = Math.max(2, R), h0 = Math.max(4, H - tb);
  for (let y = 0; y < tb + 2; y++) for (let a = 0; a < tw; a++) for (let b = 0; b < tw; b++) V.set(cx + a - (tw >> 1), y, cz + b - (tw >> 1), PAL_W.trunk);
  const blocks = [[0, tb + 1, 0, Math.max(2, Math.round(rw * .75)), Math.max(3, Math.round(h0 * .7))]], n = 3 + ((u(2) * 3) | 0);
  for (let k = 0; k < n; k++) { const a = u(20 + k) * 6.283, d = rw * (.35 + u(30 + k) * .45), r = Math.max(1, Math.round(rw * (.4 + u(50 + k) * .3)));
    blocks.push([Math.round(Math.cos(a) * d), tb + 1 + Math.round(h0 * (.1 + u(40 + k) * .55)), Math.round(Math.sin(a) * d), r, Math.max(2, Math.round(r * (1.3 + u(45 + k) * .6)))]); }
  blocks.forEach(([ox, y0, oz, r, h], k) => {
    const body = autumn && u(90 + k) < .2 ? PAL_W.autumn[(u(95 + k) * 3) | 0][1] : C[k % 3 === 2 ? 0 : k % 3 === 1 ? 2 : 1];
    if (ox || oz) { const st = Math.max(Math.abs(ox), Math.abs(oz)); for (let q = 1; q <= st; q++) V.set(cx + Math.round(ox * q / st), tb + Math.round((y0 - tb) * q / st), cz + Math.round(oz * q / st), PAL_W.trunkD); }
    for (let y = y0; y < y0 + h; y++) { const rr = y === y0 ? r - 1 : r; if (rr < 1 && y === y0) continue;
      for (let dx = -rr; dx <= rr; dx++) for (let dz = -rr; dz <= rr; dz++) { if (Math.abs(dx) === rr && Math.abs(dz) === rr && rr > 1) continue;
        V.set(cx + ox + dx, y, cz + oz + dz, y === y0 + h - 1 ? C[3] : y === y0 ? C[0] : body); } } });
}
// birch: a white trunk with black marks, a narrow crown like a flame — small lime blocks stepping up and to alternate sides
function birch(V, cx, cz, H, R, sd, u) {
  const C = PAL_W.birchLeaf; for (let y = 0; y < H - 1; y++) V.set(cx, y, cz, y % 3 === 1 && hash(sd, y, 3) < .6 ? PAL_W.birchMark : PAL_W.birch);
  const y0 = Math.round(H * .4), L = H - y0;
  for (let k = 0; k < 4; k++) { const yb = y0 + Math.round(L * k / 4.3), h = Math.max(2, Math.round(L / 3.2)), r = Math.max(1, Math.round(R * (1 - k * .22))), ox = k % 2 ? 1 : -1, sx = u(5) < .5;
    for (let y = yb; y < yb + h; y++) for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) { if (Math.abs(dx) === r && Math.abs(dz) === r) continue;
      V.set(cx + dx + (sx ? ox : 0), y, cz + dz + (sx ? 0 : ox), y === yb + h - 1 ? C[3] : y === yb ? C[0] : C[1]); } }
  V.set(cx, H, cz, C[2]);
}
// snag: a dead grey trunk, broken off, two or three stubs
function snag(V, cx, cz, H, sd, u) {
  const C = PAL_W.snag, h = Math.max(6, Math.round(H * (.7 + u(1) * .3)));
  for (let y = 0; y < h; y++) V.set(cx, y, cz, C[0]);
  for (let k = 0; k < 3; k++) { const y = Math.round(h * (.35 + k * .2 + u(k) * .08)), d = [[1, 0], [-1, 0], [0, 1], [0, -1]][(u(5 + k) * 4) | 0], L = 1 + ((u(8 + k) * 2) | 0);
    for (let q = 1; q <= L; q++) V.set(cx + d[0] * q, y + (q > 1 ? 1 : 0), cz + d[1] * q, C[1]); }
  V.set(cx, h, cz, C[1]);
}
// bush: a low clump (sometimes with berries or blossom on top)
function bush(V, cx, cz, H, R, sd, u) {
  const C = PAL_W.bush, extra = u(1) < .18 ? PAL_W.berry : u(1) > .9 ? PAL_W.bloom : 0, r = 1 + ((u(2) * 2) | 0), h = 1 + ((u(3) * 2) | 0);
  for (let y = 0; y <= h; y++) for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) { if (Math.abs(dx) + Math.abs(dz) > r + (y < h ? 1 : 0) - (y === h ? 1 : 0)) continue;
    V.set(cx + dx, y, cz + dz, y === h ? (extra && (dx + dz) % 2 === 0 ? extra : C[2]) : C[1]); }
}
// ── scatter in the woods volume (0.4): a boulder, a fallen log, a stump
export function boulder(V, x, z, r, sd) { const cx = Math.floor((x - V.org[0]) / V.s), cz = Math.floor((z - V.org[2]) / V.s), R = Math.max(1, Math.round(r / V.s)), C = PAL_W.rock;
  for (let y = 0; y <= R; y++) for (let dx = -R; dx <= R; dx++) for (let dz = -R; dz <= R; dz++) { const q = (dx * dx + dz * dz) / (R * R) + (y * y) / (R * R * .7); if (q > 1.05 || (q > .75 && hash(sd, dx * 7 + y, dz) < .35)) continue;
    V.set(cx + dx, y, cz + dz, y === R || (q < .5 && y >= R - 1 && hash(sd, dx, dz) < .4) ? PAL_W.moss : pick(C, hash(sd, dx + y * 3, dz))); } }
export function fallenLog(V, x, z, len, ax, sd) { const cx = Math.floor((x - V.org[0]) / V.s), cz = Math.floor((z - V.org[2]) / V.s), L = Math.max(4, Math.round(len / V.s));
  for (let q = 0; q < L; q++) for (let y = 0; y < 2; y++) for (let w = 0; w < 2; w++) { const end = q === 0 || q === L - 1, c = end ? PAL_W.cut : y === 1 && hash(sd, q, w) < .25 ? PAL_W.moss : (q + y) % 3 === 0 ? PAL_W.trunkD : PAL_W.trunk;
    if (ax) V.set(cx + q, y, cz + w, c); else V.set(cx + w, y, cz + q, c); } }
export function stump(V, x, z, sd) { const cx = Math.floor((x - V.org[0]) / V.s), cz = Math.floor((z - V.org[2]) / V.s), h = 2;   // a stump: dark bark, a root flare
  for (let y = 0; y < h; y++) for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) V.set(cx + a, y, cz + b, y === h - 1 ? PAL_W.trunkD : PAL_W.trunk);
  for (const [a, b] of [[-1, 0], [2, 1], [1, -1], [0, 2]]) if (hash(sd, a, b) < .6) V.set(cx + a, 0, cz + b, PAL_W.trunkD); }

// ── the mid and far tiers: the same trees as a handful of boxes each (no voxels, no AO: a few faces per tree), snapped to the tier's
// grain (0.4 mid, 0.5 far) — a conifer is stacked tiers and a spike, a broadleaf a cross of two crown boxes and a lighter top, a birch
// a lime wisp. Colours lean into the haze (air). Each block draws the parts inside its own rect (clipped), like the full tier.
export function treeBoxes(t, g, tiers = 3) {
  const q = v => Math.round(v / g) * g, x = q(t.x - g / 2), z = q(t.z - g / 2), H = Math.max(2 * g, q(t.h)), R = Math.max(g, q(t.r)), out = [], sd = t.seed;
  const B = (x0, y0, z0, x1, y1, z1, c) => out.push([x + x0, y0, z + z0, x + x1, y1, z + z1, c]);
  if (t.sp === SP.bush) { B(-g, 0, -g, 2 * g, g * 2, 2 * g, PAL_W.bush[1]); return out; }
  if (t.sp === SP.snag) { B(0, 0, 0, g, q(t.h * .8), g, PAL_W.snag[0]); return out; }
  if (t.sp === SP.pine || t.sp === SP.spruce) { const C = t.sp === SP.spruce ? PAL_W.spruce : PAL_W.pine, base = q(t.h * .24), L = H - base;
    B(0, 0, 0, g, base, g, PAL_W.trunk);
    for (let k = 0; k < tiers; k++) { const y0 = base + q(L * k / (tiers + .2)), y1 = base + q(L * (k + 1) / (tiers + .2)), r = Math.max(0, q(R * (1 - k / tiers)));
      B(-r, y0, -r, r + g, Math.max(y0 + g, y1), r + g, k === tiers - 1 ? C[2] : k % 2 ? C[0] : C[1]); }
    B(0, base + q(L * tiers / (tiers + .2)), 0, g, H + g, g, C[3]); return out; }
  if (t.sp === SP.birch) { const C = PAL_W.birchLeaf, y0 = q(t.h * .45), r = Math.max(0, q(t.r * .6)); B(0, 0, 0, g, y0, g, PAL_W.birch); B(-r, y0, -r, r + g, H, r + g, C[1]); return out; }
  const C = t.sp === SP.maple ? PAL_W.autumn[(hash(sd, 9) * 3) | 0] : PAL_W.oak, tb = q(t.h * .4), r2 = Math.max(g, R - g);
  B(0, 0, 0, g, tb, g, PAL_W.trunk); B(-R, tb, -r2, R + g, H - g, r2 + g, C[1]); B(-r2, tb + g, -R, r2 + g, H - g, R + g, C[2]); B(-r2 + g, H - g, -r2 + g, r2, H, r2, C[3]);
  return out;
}
// draw boxes into a bank, clipped to a rect [x0, z0, x1, z1]; a face cut by the rect is left out (the neighbour draws on); y from `y0`
export function drawBoxes(bank, boxes, rect, y0, air, eps = 0) {
  const [rx0, rz0, rx1, rz1] = rect;
  for (const [a0, b0, c0, a1, b1, c1, col] of boxes) { const x0 = Math.max(a0, rx0), x1 = Math.min(a1, rx1), z0 = Math.max(c0, rz0), z1 = Math.min(c1, rz1); if (x1 - x0 < 1e-3 || z1 - z0 < 1e-3 || b1 - b0 < 1e-3) continue;
    const sides = (x1 === a1 ? 1 : 0) | (x0 === a0 ? 2 : 0) | 4 | (z1 === c1 ? 16 : 0) | (z0 === c0 ? 32 : 0);
    boxInto(bank, 0, x0, y0 + b0 + eps, z0, x1, y0 + b1 + eps, z1, air(col), sides); }
}
export { mix };
