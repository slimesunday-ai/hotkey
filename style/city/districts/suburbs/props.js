// PLEASANTVIEW · the suburb's own props (owner: the Pleasantview section agent). Authored once in city voxels (base centre, facing
// +z), memoised per variant; flat toon colour, sized to the big-head body (STYLE §1). Trees have coarse crowns of 0.4 m cubes, one
// silhouette per species, so a street's trees say which street it is.
import { PAL, CV, hash, shade, TOD, M, lit, pv, done, txt, tw, cyl, ring, line } from './brush.js';

const IRON = PAL.iron, WD = PAL.wood, WDD = PAL.woodD, INK = PAL.ink, WHITE = PAL.white, TYRE = 0x1b1b20, RIM = 0xc9ced6, CHROME = 0xdfe3ea, GLASS = 0x9fd8ff;
const BARK = 0x7a4a22, BARKD = 0x5a3a22;
const GREENS = { oak: [0x2fbf55, 0x25a748, 0x1d8f3c, 0x46d466], maple: [0x3cc85a, 0x2fb04c, 0x249a42, 0x5ada70], red: [0xc8323a, 0xa82830, 0xe0474a, 0x8e2028],
  pine: [0x1f7a45, 0x196a3c, 0x2a8a50, 0x145c33], birch: [0x7ed957, 0x6cc84a, 0x92e46a, 0x5db83f], willow: [0x6fcf4f, 0x5dbb42, 0x83dc60, 0x4ea838],
  blossom: [0xff7ab6, 0xff5fa0, 0xffa0c8, 0xf7f7f2], gold: [0xffc21a, 0xf0a818, 0xffd84a, 0x3cc85a] };

// ── TREES. crown(V, …): a blob of 0.4 m cubes (ellipsoid with a ragged edge) on the lattice of its tree
function crown(V, cx, y0, cz, rx, ry, rz, G, seed, o = {}) { const q = 4, cells = new Map(), key = (a, b, c) => a + ',' + b + ',' + c;
  for (let bx = -Math.ceil(rx); bx <= rx; bx++) for (let by = 0; by <= Math.ceil(2 * ry); by++) for (let bz = -Math.ceil(rz); bz <= rz; bz++) {
    const r = (bx * bx) / (rx * rx) + ((by - ry) ** 2) / (ry * ry) + (bz * bz) / (rz * rz), axis = !bx && !bz && by <= ry; if (!axis && (r > 1.05 || (r > .62 && hash(seed, bx * 31 + by * 7, bz + 3) > (o.keep ?? .55)))) continue;
    cells.set(key(bx, by, bz), [bx, by, bz]); }
  // keep only the cubes joined (26-connected) to the one over the trunk: no crown piece ever floats
  const seen = new Set([key(0, 0, 0)]), todo = [[0, 0, 0]]; while (todo.length) { const [a, b, c] = todo.pop(); for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) { const n = key(a + i, b + j, c + k); if (cells.has(n) && !seen.has(n)) { seen.add(n); todo.push([a + i, b + j, c + k]); } } }
  for (const [k, [bx, by, bz]] of cells) { if (!seen.has(k)) continue; const x = cx + bx * q, y = y0 + by * q, z = cz + bz * q, top = by >= 2 * ry - 1;
    V.box(x - 2, y, z - 2, x + 2, y + q, z + 2, G[top ? 3 : (hash(seed, bx, by * 5 + bz) * 3) | 0]); } }
function trunk(V, cx, cz, h, w = 2, c = BARK) { V.box(cx - w - 1, 0, cz - w - 1, cx + w + 1, 1, cz + w + 1, BARKD); V.box(cx - w, 0, cz - w, cx + w, h, cz + w, c); }
// species × size: 0 small (crown ≈ 1.8 m, fits a front yard), 1 medium (≈ 2.8 m), 2 large shade tree (≈ 3.6 m); curb: a street tree
// on a tall trunk (crown from 3 m up, so walkers and car roofs pass under it) for the kerb strip
export const tree = (sp, size = 0, v = 0, curb = false) => M(`tree:${sp}:${size}:${v % 3}:${curb ? 1 : 0}`, 'tree', () => {
  const sd = (v % 3) * 97 + sp.length * 13 + size * 7, R = [.75, 1.0, 1.25][size], lift = curb ? 9 : 0;
  if (sp === 'pine') { const n = [4, 6, 7][size], h = [12, 18, 22][size] + lift, V = pv(44, 110, 44, 22, 22); trunk(V, 22, 22, h + n * 10 - 2, 2, BARKD);
    for (let k = 0; k < n; k++) { const r = Math.max(1, Math.round((n - k) * [.55, .66, .75][size])), y = h + k * 10, G = GREENS.pine;
      for (let bx = -r; bx <= r; bx++) for (let bz = -r; bz <= r; bz++) { if (Math.abs(bx) + Math.abs(bz) > r + (k % 2 ? 0 : 1) || (Math.abs(bx) + Math.abs(bz) === r && hash(sd, bx * 7 + k, bz) > .7)) continue;
        V.box(22 + bx * 4 - 2, y, 22 + bz * 4 - 2, 22 + bx * 4 + 2, y + (k === n - 1 ? 8 : 6), 22 + bz * 4 + 2, G[(hash(sd, bx, bz + k * 9) * 3) | 0]); } }
    V.box(20, h + n * 10 - 4, 20, 24, h + n * 10 + 4, 24, GREENS.pine[3]); return done(V, 'tree'); }
  if (sp === 'birch') { const V = pv(36, 96, 36, 18, 18), h = [30, 38, 46][size] + lift; for (let y = 0; y < h; y++) V.box(17, y, 17, 19, y + 1, 19, (y % 7 === 3 || y % 11 === 5) ? INK : 0xf2efe6);
    crown(V, 18, h - 6, 18, R * 2, [1.6, 2, 2.4][size], R * 2, GREENS.birch, sd); return done(V, 'tree'); }
  if (sp === 'willow') { const V = pv(56, 80, 56, 28, 28), h = [18, 22, 26][size] + lift, rr = [3.4, 4.4, 5.4][size]; trunk(V, 28, 28, h + 6, 2);
    crown(V, 28, h, 28, rr, 1.6, rr, GREENS.willow, sd, { keep: .7 });
    const r = rr * 4 - 5; for (let k = 0; k < 28; k++) { const a = k / 28 * Math.PI * 2 + hash(sd, k) * .2, x = 28 + Math.round(Math.cos(a) * r), z = 28 + Math.round(Math.sin(a) * r), len = (curb ? 4 : 8) + ((hash(sd, k, 5) * (curb ? 5 : 10)) | 0);
      V.box(x - 1, h + 6 - len, z - 1, x + 1, h + 9, z + 1, GREENS.willow[k % 3]); }
    return done(V, 'tree'); }
  if (sp === 'ornamental') { const V = pv(30, 60, 30, 15, 15); trunk(V, 15, 15, 20 + lift, 1); crown(V, 15, 14 + lift, 15, 1.6, 1.4, 1.6, GREENS.blossom, sd); return done(V, 'tree'); }
  if (sp === 'oak') { const V = pv(52, 84, 52, 26, 26), h = [16, 22, 26][size] + lift; trunk(V, 26, 26, h + 6, size > 1 ? 3 : 2);
    crown(V, 26, h, 26, R * 3.4, [1.4, 1.7, 2][size], R * 3.4, GREENS.oak, sd);
    if (size === 2) { crown(V, 18, h + 8, 22, 2, 1.4, 2, GREENS.oak, sd + 3); crown(V, 32, h + 6, 30, 2, 1.4, 2, GREENS.oak, sd + 5); V.box(24, h, 24, 28, h + 12, 28, BARK); }
    return done(V, 'tree'); }
  // maple / red maple: a tall round-topped crown
  const V = pv(44, 88, 44, 22, 22), h = [14, 20, 24][size] + lift, G = sp === 'redmaple' ? GREENS.red : GREENS.maple; trunk(V, 22, 22, h + 6, size > 1 ? 3 : 2);
  crown(V, 22, h, 22, R * 2.6, [2, 2.6, 3][size], R * 2.6, G, sd); return done(V, 'tree'); });

// ── VEHICLES (toon scale, 1.8–2.0 m wide, a big-head driver fits)
function wheels(V, x0, x1, zs, rim = RIM) { for (const z of zs) for (const x of [x0, x1 - 3]) { V.box(x, 0, z - 3, x + 3, 7, z + 4, TYRE); V.box(x + (x === x0 ? 0 : 2), 2, z - 1, x + 1 + (x === x0 ? 0 : 2), 5, z + 2, rim, 2); } }
function lights(V, x0, x1, zf, zb) { V.box(x0, 6, zf, x0 + 4, 9, zf + 1, 0xffffff, lit(1)); V.box(x1 - 4, 6, zf, x1, 9, zf + 1, 0xffffff, lit(1)); V.box(x0, 6, zb, x0 + 3, 9, zb + 1, 0xd7141a, lit(1)); V.box(x1 - 3, 6, zb, x1, 9, zb + 1, 0xd7141a, lit(1)); }
export const wagon = c => M('wagon' + c, 'car', () => { const L = 48, W = 19, V = pv(W + 2, 30, L + 2), x0 = 1, x1 = x0 + W;
  V.box(x0, 3, 1, x1, 11, L + 1, c); V.box(x0, 11, 3, x1, 20, 33, c); V.box(x0 + 1, 20, 4, x1 - 1, 21, 32, c);
  V.box(x0, 5, 3, x1, 10, 36, (x, y, z) => (x === x0 || x === x1 - 1) && y > 5 && y < 10 ? (z % 9 === 0 ? 0x5a3a1c : 0x9a6232) : c);   // the wood panel sides
  V.box(x0 + 1, 12, 32, x1 - 1, 19, 33, GLASS, 1); V.box(x0 + 1, 12, 3, x1 - 1, 19, 4, GLASS, 1); for (const x of [x0, x1 - 1]) for (const [a, b] of [[5, 13], [15, 22], [24, 31]]) V.box(x, 12, a, x + 1, 19, b, GLASS, 1);
  V.box(x0 + 2, 21, 6, x0 + 3, 23, 30, IRON); V.box(x1 - 3, 21, 6, x1 - 2, 23, 30, IRON); for (const z of [8, 18, 28]) V.box(x0 + 2, 22, z, x1 - 2, 23, z + 1, IRON);   // roof rack
  V.box(x0 - 1, 3, L, x1 + 1, 5, L + 2, CHROME, 2); V.box(x0 - 1, 3, 0, x1 + 1, 5, 2, CHROME, 2); lights(V, x0, x1, L + 1, 0);
  wheels(V, x0 - 1, x1 + 1, [8, L - 9]); for (const z of [8, L - 9]) V.clear(x0 + 2, 0, z - 3, x1 - 2, 3, z + 4); return done(V, 'car'); });
export const pickup = (c, load = 0) => M('pickup' + c + load, 'car', () => { const L = 46, W = 19, V = pv(W + 2, 30, L + 2), x0 = 1, x1 = x0 + W;
  V.box(x0, 3, 1, x1, 10, L + 1, c); V.box(x0, 10, 1, x1, 13, 21, c); V.clear(x0 + 1, 10, 2, x1 - 1, 13, 20); V.box(x0 + 1, 9, 2, x1 - 1, 10, 20, shade(c, .7));
  V.box(x0, 10, 22, x1, 20, 33, c); V.box(x0 + 1, 20, 23, x1 - 1, 21, 32, c); V.box(x0 + 1, 12, 32, x1 - 1, 19, 33, GLASS, 1); V.box(x0 + 1, 12, 22, x1 - 1, 19, 23, GLASS, 1);
  for (const x of [x0, x1 - 1]) V.box(x, 12, 24, x + 1, 19, 31, GLASS, 1); V.box(x0, 10, 33, x1, 11, L + 1, c);
  if (load === 1) { V.box(x0 + 2, 10, 3, x1 - 2, 16, 12, 0x9a6232); V.box(x0 + 3, 16, 4, x1 - 3, 17, 11, 0x7a4a22); }   // firewood
  if (load === 2) { V.box(x0 + 2, 10, 3, x0 + 9, 17, 10, 0x2f5bff); V.box(x0 + 10, 10, 4, x1 - 2, 15, 12, 0xe6e1d6); }   // a cooler and a toolbox
  V.box(x0 - 1, 3, L, x1 + 1, 5, L + 2, CHROME, 2); V.box(x0 - 1, 3, 0, x1 + 1, 5, 2, CHROME, 2); lights(V, x0, x1, L + 1, 0);
  wheels(V, x0 - 1, x1 + 1, [8, L - 9]); for (const z of [8, L - 9]) V.clear(x0 + 2, 0, z - 3, x1 - 2, 3, z + 4); return done(V, 'car'); });
export const van = (c, stripe) => M('van' + c + stripe, 'car', () => { const L = 46, W = 19, V = pv(W + 2, 30, L + 2), x0 = 1, x1 = x0 + W;
  V.box(x0, 3, 1, x1, 22, L - 8, c); V.box(x0, 3, L - 8, x1, 14, L + 1, c); for (let k = 0; k < 5; k++) V.box(x0, 14 + k, L - 8 - k, x1, 15 + k, L - 7 - k, c);
  V.box(x0 + 1, 15, L - 8, x1 - 1, 20, L - 7, GLASS, 1); for (const x of [x0, x1 - 1]) for (const [a, b] of [[4, 14], [16, 26], [28, 36]]) V.box(x, 14, a, x + 1, 20, b, GLASS, 1);
  if (stripe) V.box(x0, 9, 1, x1, 11, L - 8, stripe); V.box(x0 + 2, 22, 6, x1 - 2, 23, 30, shade(c, .85));
  V.box(x0 - 1, 3, L, x1 + 1, 5, L + 2, CHROME, 2); V.box(x0 - 1, 3, 0, x1 + 1, 5, 2, CHROME, 2); lights(V, x0, x1, L + 1, 0);
  wheels(V, x0 - 1, x1 + 1, [8, L - 9]); for (const z of [8, L - 9]) V.clear(x0 + 2, 0, z - 3, x1 - 2, 3, z + 4); return done(V, 'car'); });
// a motor boat on its trailer (bow toward +z), under a half tarp now and then
export const boat = (c, tarp) => M('boat' + c + tarp, 'boat', () => { const L = 50, V = pv(22, 26, L + 2, 11, 25);
  V.box(3, 3, 2, 19, 4, 44, IRON); V.box(10, 3, 44, 12, 5, 52, IRON); for (const x of [2, 17]) { V.box(x, 0, 18, x + 3, 7, 25, TYRE); } V.box(4, 4, 6, 18, 6, 40, IRON);
  for (let z = 4; z < 46; z++) { const t = z > 36 ? (z - 36) / 10 : 0, hw = Math.round(8 - t * 7), y0 = 6 + Math.round(t * 3); V.box(11 - hw, y0, z, 11 + hw, 16, z + 1, (x, y) => y < 9 ? c : y < 11 ? WHITE : WHITE); }
  V.box(4, 16, 4, 18, 17, 34, WHITE); V.box(5, 17, 20, 17, 22, 22, GLASS, 1); if (tarp) V.box(3, 17, 4, 19, 19, 20, 0x2f6bdf); return done(V, 'boat'); });
// a cab-over camper
export const camper = c => M('camper' + c, 'car', () => { const L = 56, W = 20, V = pv(W + 2, 36, L + 2), x0 = 1, x1 = x0 + W;
  V.box(x0, 3, 1, x1, 30, 42, 0xf2efe6); V.box(x0, 3, 42, x1, 18, L + 1, WHITE); V.box(x0, 18, 36, x1, 30, 50, 0xf2efe6); V.box(x0 + 1, 11, 50, x1 - 1, 17, 51, GLASS, 1);
  V.box(x0, 12, 1, x1, 16, 50, (x, y, z) => (x === x0 || x === x1 - 1) ? c : undefined); V.box(x0, 17, 1, x1, 18, 50, (x, y, z) => (x === x0 || x === x1 - 1) ? shade(c, .75) : undefined);
  for (const x of [x0, x1 - 1]) { V.box(x, 20, 8, x + 1, 26, 18, GLASS, 1); V.box(x, 6, 24, x + 1, 24, 32, shade(0xf2efe6, .85)); }
  V.box(x0 - 1, 3, L, x1 + 1, 5, L + 2, CHROME, 2); lights(V, x0, x1, L + 1, 0); wheels(V, x0 - 1, x1 + 1, [9, L - 10]); for (const z of [9, L - 10]) V.clear(x0 + 2, 0, z - 3, x1 - 2, 3, z + 4); return done(V, 'car'); });
// a hot rod under restoration: primer grey body, one red door, the hood up
export const hotrod = () => M('hotrod', 'car', () => { const L = 44, W = 18, V = pv(W + 2, 30, L + 2), x0 = 1, x1 = x0 + W, P = 0x8f929b;
  V.box(x0, 3, 1, x1, 9, L + 1, P); V.box(x0 + 1, 9, 12, x1 - 1, 17, 26, P); V.box(x0 + 1, 17, 13, x1 - 1, 18, 25, P); V.box(x0, 4, 14, x0 + 1, 12, 24, 0xe8232a);
  V.box(x0 + 2, 10, 24, x1 - 2, 16, 25, GLASS, 1); V.box(x0 + 2, 9, 28, x1 - 2, 11, 42, 0x3d3f46); for (let k = 0; k < 6; k++) V.box(x0 + 2, 11 + k * 2, 42 - k, x1 - 2, 13 + k * 2, 43 - k, P);   // the hood up
  V.box(x0 + 5, 9, 32, x1 - 5, 13, 38, CHROME, 2); V.box(x0 - 1, 3, L, x1 + 1, 5, L + 2, CHROME, 2); wheels(V, x0 - 1, x1 + 1, [8, L - 9], PAL.gold); for (const z of [8, L - 9]) V.clear(x0 + 2, 0, z - 3, x1 - 2, 3, z + 4); return done(V, 'car'); });

// ── MAILBOXES: a box on a post, a brick pillar, a novelty fish (all face +z, the street)
export const mailbox = (kind, c, flag = 0) => M('mail' + kind + c + flag, 'mailbox', () => {
  if (kind === 'brick') { const V = pv(8, 14, 8); V.box(0, 0, 0, 8, 10, 8, (x, y) => y % 3 === 0 ? 0x8a4430 : 0x9c4a34); V.box(-0, 10, 0, 8, 11, 8, 0xd9d2c3); V.box(1, 11, 1, 7, 14, 7, c); return done(V, 'mailbox'); }
  if (kind === 'novelty') { const V = pv(14, 13, 6); V.box(6, 0, 2, 8, 8, 4, WD); V.box(1, 8, 1, 11, 13, 5, c); V.box(11, 9, 1, 14, 12, 5, shade(c, .8)); V.box(3, 10, 5, 4, 11, 6, INK); return done(V, 'mailbox'); }
  const V = pv(6, 13, 9); V.box(2, 0, 3, 4, 9, 5, flag ? IRON : WD); V.box(0, 8, 0, 6, 12, 9, c); V.box(1, 12, 1, 5, 13, 8, c); V.box(6, 9, 3, 7, 13, 4, 0xe8232a); return done(V, 'mailbox'); });

// ── YARD LIFE
export const gnomes = (v = 0) => M('gnomes' + (v % 3), 'gnome', () => { const V = pv(16, 8, 10);
  const g = (x, z, k) => { const hat = [0xe8232a, 0x2f5bff, 0x14a83b][(k + v) % 3]; V.box(x, 0, z, x + 3, 3, z + 3, [0x2f5bff, 0x8a5a2a, 0xe8232a][(k + v) % 3]); V.box(x, 3, z, x + 3, 5, z + 3, 0xf2c8a0); V.box(x, 3, z + 2, x + 3, 4, z + 3, WHITE); V.box(x, 5, z, x + 3, 6, z + 3, hat); V.box(x + 1, 6, z + 1, x + 2, 8, z + 2, hat); };
  g(1, 2, 0); g(7, 5, 1); g(12, 1, 2); return done(V, 'gnome'); });
export const flamingos = (v = 0) => M('flam' + (v % 2), 'flamingo', () => { const V = pv(14, 14, 8), P = 0xff4fa3;
  for (const [x, z, t] of [[3, 3, 0], [10, 4, 1]]) { V.box(x, 0, z, x + 1, 7, z + 1, INK); V.box(x - 2, 7, z - 1, x + 3, 10, z + 2, P); V.box(x + (t ? -3 : 2), 9, z, x + (t ? -2 : 3), 13, z + 1, P); V.box(x + (t ? -4 : 3), 12, z, x + (t ? -2 : 5), 13, z + 1, P); V.box(x + (t ? -5 : 5), 11, z, x + (t ? -4 : 6), 12, z + 1, INK); }
  return done(V, 'flamingo'); });
export const birdbath = () => M('bbath', 'birdbath', () => { const V = pv(8, 9, 8); V.box(2, 0, 2, 6, 1, 6, 0xc9c3b6); V.box(3, 1, 3, 5, 6, 5, 0xc9c3b6); V.box(0, 6, 0, 8, 8, 8, 0xd9d3c6); V.box(1, 7, 1, 7, 8, 7, 0x3fc8ff); return done(V, 'birdbath'); });
export const windmill = (v = 0) => M('wmill' + (v % 2), 'windmill', () => { const V = pv(12, 20, 6), c = v % 2 ? 0xe8232a : 0x2f5bff;
  V.box(4, 0, 2, 8, 12, 5, WD); V.box(3, 12, 1, 9, 14, 5, c); for (let k = -5; k <= 5; k++) { V.set(6 + k, 12 + k, 5, WHITE); V.set(6 + k, 12 - k, 5, WHITE); } V.box(5, 11, 5, 7, 13, 6, c); return done(V, 'windmill'); });
export const lantern = () => M('lantern' + TOD.night, 'lantern', () => { const V = pv(4, 14, 4); V.box(1, 0, 1, 3, 10, 3, INK); V.box(0, 10, 0, 4, 13, 4, 0xfff1c8, lit(1)); V.box(0, 13, 0, 4, 14, 4, INK); return done(V, 'lantern'); });
export const statue = () => M('statue', 'statue', () => { const V = pv(6, 12, 6); V.box(0, 0, 0, 6, 2, 6, 0xd9d3c6); V.box(1, 2, 1, 5, 8, 5, 0xe6e1d6); V.box(2, 8, 2, 4, 11, 4, 0xe6e1d6); V.box(1, 9, 1, 5, 10, 5, 0x3fa9f5); return done(V, 'statue'); });
export const sprinkler = () => M('spr', 'sprinkler', () => { const V = pv(12, 8, 12); V.box(5, 0, 5, 7, 2, 7, 0xe8232a); for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; V.set(6 + Math.round(Math.cos(a) * 4), 3 + (k % 2), 6 + Math.round(Math.sin(a) * 4), 0xbfeaff, 1); line(V, 6, 2, 6, 6 + Math.round(Math.cos(a) * 4), 3 + (k % 2), 6 + Math.round(Math.sin(a) * 4), 0xbfeaff, 1); } return done(V, 'sprinkler'); });
export const toys = (v = 0) => M('toys' + (v % 3), 'toys', () => { const V = pv(16, 8, 12);
  if (v % 3 === 0) { V.box(1, 0, 2, 9, 3, 10, 0xe8232a); V.box(2, 3, 3, 8, 6, 5, 0xffe23a); cyl(V, 13, 6, 2.5, 0, 5, 0x2f5bff); }                    // a ride-on car and a ball
  else if (v % 3 === 1) { V.box(2, 0, 2, 14, 1, 10, 0xffe23a); V.box(3, 1, 3, 7, 6, 6, 0xe8232a); V.box(9, 1, 5, 13, 4, 9, 0x2f5bff); }            // a sandbox and a bucket
  else { V.box(2, 0, 4, 4, 5, 6, 0x2f5bff); V.box(2, 4, 4, 12, 5, 6, 0x2f5bff); V.box(10, 0, 4, 12, 5, 6, 0x2f5bff); cyl(V, 6, 9, 2, 0, 4, 0xff4fa3); }   // a little goal, a ball
  return done(V, 'toys'); });
export const bin = (c, lid) => M('bin' + c + lid, 'bin', () => { const V = pv(7, 11, 7); V.box(0, 0, 0, 7, 9, 7, c); V.box(0, 9, 0, 7, 10, 7, lid ?? shade(c, .7)); V.box(2, 10, 5, 5, 11, 7, shade(c, .7)); V.box(0, 0, 6, 1, 2, 7, TYRE); V.box(6, 0, 6, 7, 2, 7, TYRE); return done(V, 'bin'); });
export const planter = (c, fl) => M('pl' + c + fl, 'planter', () => { const V = pv(8, 9, 8); V.box(0, 0, 0, 8, 5, 8, c); V.box(1, 5, 1, 7, 6, 7, 0x5a3a22); for (let x = 1; x < 7; x += 2) for (let z = 1; z < 7; z += 2) V.box(x, 6, z, x + 2, 8 + ((x + z) % 3), z + 2, (x + z) % 4 ? 0x2a9a48 : fl); return done(V, 'planter'); });
export const woodpile = (v = 0) => M('wpile' + (v % 2), 'woodpile', () => { const V = pv(24, 12, 8); for (let y = 0; y < (v % 2 ? 3 : 4); y++) for (let x = y; x < 22 - y; x += 3) cyl(V, x + 1.5, 4, 1.5, y * 3, y * 3 + 3, (xx, yy, zz) => zz === 0 || zz === 7 ? 0xd9a060 : 0x8a5a2a);
  V.box(0, 0, 0, 1, 11, 8, WDD); V.box(23, 0, 0, 24, 11, 8, WDD); return done(V, 'woodpile'); });
export const tires = () => M('stires', 'tires', () => { const V = pv(12, 10, 12); for (let k = 0; k < 3; k++) ring(V, 6 + (k === 1 ? 1 : 0), 6, 2.2, 5, k * 3, k * 3 + 3, TYRE); return done(V, 'tires'); });
export const fridge = () => M('fridge', 'junk', () => { const V = pv(8, 17, 8); V.box(0, 0, 0, 8, 17, 7, 0xf2efe6); V.box(0, 11, 7, 8, 12, 8, 0xc9ced6); V.box(6, 12, 7, 7, 15, 8, 0xc9ced6); V.box(6, 3, 7, 7, 9, 8, 0xc9ced6); return done(V, 'junk'); });
export const couch = c => M('couch' + c, 'couch', () => { const V = pv(22, 10, 10); V.box(0, 0, 0, 22, 5, 9, c); V.box(0, 5, 7, 22, 10, 10, c); V.box(0, 5, 0, 3, 8, 9, shade(c, .85)); V.box(19, 5, 0, 22, 8, 9, shade(c, .85)); V.box(3, 5, 1, 11, 6, 7, shade(c, 1.12)); V.box(11, 5, 1, 19, 6, 7, shade(c, 1.12)); return done(V, 'couch'); });

// ── BACK YARDS
export const trampoline = (v = 0) => M('tramp' + (v % 3), 'trampoline', () => { const V = pv(30, 24, 30, 15, 15), c = [0x2f5bff, 0x14a83b, 0xe8232a][v % 3], net = v % 3 !== 1;
  for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2, x = 15 + Math.round(Math.cos(a) * 12.5), z = 15 + Math.round(Math.sin(a) * 12.5); V.box(x - 1, 0, z - 1, x + 1, net ? 22 : 7, z + 1, IRON); }
  ring(V, 15, 15, 11.5, 14, 7, 8, c); cyl(V, 15, 15, 11.5, 6, 7, 0x2a2a30);
  if (net) { ring(V, 15, 15, 13, 14, 22, 23, c); for (let k = 0; k < 40; k++) { const a = k / 40 * Math.PI * 2, x = 15 + Math.round(Math.cos(a) * 13.3), z = 15 + Math.round(Math.sin(a) * 13.3); if (k % 2 === 0) V.box(x, 8, z, x + 1, 22, z + 1, 0x3d3f46); } }
  return done(V, 'trampoline'); });
export const swingset = (v = 0) => M('swing' + (v % 2), 'swingset', () => { const V = pv(34, 26, 20, 17, 10), c = v % 2 ? 0xe8232a : 0x2f5bff, sl = v % 2 ? 0xffe23a : 0x14a83b;
  for (const x of [1, 29]) for (let y = 0; y < 23; y++) { const o = Math.round((23 - y) * .3); V.box(x, y, 10 - 2 - o, x + 3, y + 1, 10 - o, c); V.box(x, y, 10 + o, x + 3, y + 1, 12 + o, c); }
  V.box(1, 23, 9, 32, 25, 12, c); for (const x of [8, 20]) { V.box(x, 6, 10, x + 1, 23, 11, IRON); V.box(x + 5, 6, 10, x + 6, 23, 11, IRON); V.box(x, 5, 9, x + 6, 6, 12, 0xffe23a); }
  for (let k = 0; k < 10; k++) V.box(26 - k, 14 - k, 12, 29 - k, 15 - k, 18, sl); return done(V, 'swingset'); });
export const pool = (v = 0) => M('agpool' + (v % 2) + TOD.night, 'pool', () => { const V = pv(36, 14, 36, 18, 18), c = v % 2 ? 0x2f5bff : 0x8f929b;   // above-ground pool
  ring(V, 18, 18, 14.5, 16.5, 0, 12, (x, y) => y % 4 === 3 ? shade(c, .82) : c); cyl(V, 18, 18, 14.5, 0, 10, 0x2fb8e8, 1); ring(V, 18, 18, 14.5, 17, 12, 13, WHITE);
  for (let y = 0; y < 13; y++) V.box(33, y, 16, 36, y + 1, 18, y % 3 === 0 ? RIM : undefined); V.box(33, 0, 16, 34, 13, 17, RIM, 2); V.box(35, 0, 16, 36, 13, 17, RIM, 2); return done(V, 'pool'); });
export const doghouse = c => M('dogh' + c, 'doghouse', () => { const V = pv(14, 14, 14); V.box(0, 0, 0, 14, 8, 14, c); V.clear(5, 0, 12, 9, 6, 14);
  for (let k = 0; k < 7; k++) V.box(-0 + k, 8 + k, -1 + 1, 14 - k, 9 + k, 14, (x, y, z) => (x === k || x === 13 - k) ? 0x6d707a : 0x6d707a); V.box(6, 0, 11, 8, 1, 14, 0x3d3f46); return done(V, 'doghouse'); });
export const barn = (c, v = 0) => M('barn' + c + (v % 2), 'shed', () => { const V = pv(26, 30, 22, 13, 11), T = WHITE;   // a little barn shed with a gambrel roof
  V.box(1, 0, 1, 25, 16, 21, c); V.box(8, 0, 20, 18, 13, 21, shade(c, .85)); for (let k = 0; k < 10; k++) { const d = 8 + ((10 - k) * .8 | 0); V.box(8 + (k % 2), k, 21, 9 + (k % 2), k + 1, 22, T); V.box(17 - (k % 2), k, 21, 18 - (k % 2), k + 1, 22, T); }
  V.box(7, 13, 21, 19, 14, 22, T); V.box(0, 0, 0, 1, 16, 22, T);
  for (let k = 0; k < 7; k++) { const i = k < 4 ? k * 2 : 6 + (k - 3); V.box(i - 1, 16 + k * 2, 0, 27 - i, 18 + k * 2, 22, k % 2 ? 0x5c5b62 : 0x6d707a); } return done(V, 'shed'); });
export const clothesline = (v = 0) => M('cline' + (v % 3), 'laundry', () => { const V = pv(34, 20, 6, 17, 3), C = [[0xe8232a, WHITE, 0x2f5bff, 0xffe23a], [0x14a83b, 0xff4fa3, WHITE, 0x2f5bff], [WHITE, WHITE, 0xff7a1a, 0x7a3cff]][v % 3];
  for (const x of [1, 31]) { V.box(x, 0, 2, x + 2, 18, 4, 0x9a9ca4); V.box(x - 1, 17, 0, x + 3, 18, 6, 0x9a9ca4); }
  for (const z of [1, 4]) V.box(3, 17, z, 31, 18, z + 1, 0xdfe3ea);
  let x = 4; C.forEach((c, k) => { const w = 4 + (k % 2) * 2, h = 5 + (k % 3); V.box(x, 17 - h, 1 + (k % 2) * 3, x + w, 17, 2 + (k % 2) * 3, c); x += w + 2; });
  return done(V, 'laundry'); });
export const patio = (c, v = 0) => M('patio' + c + (v % 2), 'patio', () => { const V = pv(28, 30, 28, 14, 14);
  V.box(13, 0, 13, 15, 26, 15, WHITE); for (let k = 0; k < 6; k++) { const r = 12 - k * 2; V.box(14 - r, 24 + k, 14 - r, 14 + r, 25 + k, 14 + r, (x, y, z) => ((Math.atan2(z - 14, x - 14) * 8 / Math.PI + 16) | 0) % 2 ? c : WHITE); }
  cyl(V, 14, 14, 5, 7, 8, WHITE); V.box(13, 0, 13, 15, 7, 15, WHITE);
  for (const [x, z] of [[4, 14], [24, 14], [14, 4], [14, 24]]) { V.box(x - 2, 0, z - 2, x + 2, 4, z + 2, v % 2 ? 0x2f5bff : WHITE); V.box(x - 2, 4, z - 2, x + 2, 5, z + 2, c); }
  return done(V, 'patio'); });
export const garden = (v0 = 0) => M('garden' + (v0 % 2), 'garden', () => { const v = v0 % 2, V = pv(30, 8, 16), P = [0xe8232a, 0xffa21a, 0x2a9a48];   // (a template is built from its key's variant only)
  for (const z0 of [1, 9]) { V.box(0, 0, z0, 30, 3, z0 + 6, WD); V.box(1, 1, z0 + 1, 29, 3, z0 + 5, 0x5a3a22); for (let x = 2; x < 28; x += 3) V.box(x, 3, z0 + 2, x + 2, 5 + ((x + z0 + v) % 3), z0 + 4, (x + v) % 6 === 2 ? P[(x >> 1) % 2] : P[2]); }
  return done(V, 'garden'); });
export const playhouse = (v = 0) => M('phouse' + (v % 2), 'playhouse', () => { const V = pv(18, 20, 16), w = v % 2 ? 0xffe23a : 0xff4fa3, r = v % 2 ? 0xe8232a : 0x2f5bff;
  V.box(0, 0, 0, 18, 12, 16, w); V.clear(6, 0, 15, 12, 9, 16); V.box(2, 5, 15, 5, 9, 16, GLASS, 1); V.box(13, 5, 15, 16, 9, 16, GLASS, 1);
  for (let k = 0; k < 7; k++) V.box(-1 + k + 1, 12 + k, 0, 19 - k - 1, 13 + k, 16, r); return done(V, 'playhouse'); });
export const firepit = () => M('fpit' + TOD.night, 'firepit', () => { const V = pv(26, 8, 26, 13, 13); ring(V, 13, 13, 3, 5, 0, 2, 0x8f929b); for (const [x, z] of [[11, 12], [14, 13], [12, 15]]) V.box(x, 1, z, x + 3, 2, z + 1, 0x7a4a22);
  V.box(12, 2, 12, 14, 4, 14, 0xff7a1a, lit(1)); for (const [x, z] of [[2, 13], [24, 13], [13, 2], [13, 24]]) { V.box(x - 2, 0, z - 2, x + 2, 3, z + 2, 0x3d7a4a); V.box(x - 2, 3, z - 2, x + 2, 6, z - 1, 0x3d7a4a); } return done(V, 'firepit'); });

// ── ONE-OFF SCENES (their props)
export const saleTable = v0 => M('stable' + (v0 % 3), 'table', () => { const v = v0 % 3, V = pv(22, 12, 10), I = [[0xe8232a, 0xffe23a, 0x2f5bff, WHITE], [0x14a83b, 0xff7a1a, 0x7a3cff, 0x8a5a2a], [WHITE, 0xff4fa3, 0x2de2e6, 0x3d3f46]][v % 3];
  V.box(0, 6, 0, 22, 7, 10, WHITE); for (const [x, z] of [[1, 1], [20, 1], [1, 8], [20, 8]]) V.box(x, 0, z, x + 1, 6, z + 1, 0x9a9ca4);
  let x = 1; I.forEach((c, k) => { const w = 3 + (k % 3), h = 2 + ((k * 7 + v) % 4); V.box(x, 7, 2 + (k % 2) * 3, x + w, 7 + h, 5 + (k % 2) * 3, c); x += w + 1; }); return done(V, 'table'); });
export const rack = () => M('rack', 'rack', () => { const V = pv(20, 16, 6); for (const x of [0, 19]) V.box(x, 0, 2, x + 1, 16, 4, 0xc9ced6); V.box(0, 15, 2, 20, 16, 4, 0xc9ced6);
  [0xe8232a, 0x2f5bff, 0xffe23a, 0x14a83b, 0xff4fa3].forEach((c, k) => V.box(2 + k * 3, 7, 1, 4 + k * 3, 15, 5, c)); return done(V, 'rack'); });
export const boxes = (v = 0) => M('mboxes' + (v % 2), 'boxes', () => { const V = pv(16, 12, 12), K = 0xc49a6c; V.box(0, 0, 0, 7, 6, 6, K); V.box(8, 0, 1, 15, 5, 7, shade(K, .92)); V.box(1, 6, 1, 6, 11, 5, shade(K, 1.05)); V.box(3, 0, 7, 10, 7, 12, K);
  for (const [x, y, z] of [[3, 6, 0], [11, 5, 1], [3, 11, 1], [6, 7, 7]]) V.box(x, y, z, x + 1, y + 1, z + 5, 0x8a6a3a); return done(V, 'boxes'); });
export const truck = c => M('mtruck' + c, 'car', () => { const L = 64, W = 20, V = pv(W + 2, 40, L + 2), x0 = 1, x1 = x0 + W;   // a box truck (the movers)
  V.box(x0, 4, 1, x1, 34, 44, WHITE); V.box(x0, 3, 44, x1, 20, L + 1, c); V.box(x0 + 1, 20, 46, x1 - 1, 28, L - 4, c); V.box(x0 + 1, 21, L - 4, x1 - 1, 27, L - 3, GLASS, 1);
  V.box(x0, 12, 1, x1, 30, 44, (x, y, z) => (x === x0 || x === x1 - 1) && y > 14 && y < 28 && z > 3 && z < 42 ? c : undefined);
  V.box(x0 - 1, 3, L, x1 + 1, 5, L + 2, CHROME, 2); lights(V, x0, x1, L + 1, 0); wheels(V, x0 - 1, x1 + 1, [9, 20, L - 10]); for (const z of [9, 20, L - 10]) V.clear(x0 + 2, 0, z - 3, x1 - 2, 3, z + 4); return done(V, 'car'); });
export const lemonade = () => M('lemon', 'stand', () => { const V = pv(20, 22, 12); V.box(0, 0, 0, 20, 9, 8, 0xf2d15a); V.box(0, 9, 0, 20, 10, 9, WD); for (const x of [0, 18]) V.box(x, 10, 0, x + 2, 20, 2, WD);
  V.box(0, 20, 0, 20, 22, 5, 0xe8232a); V.box(4, 10, 3, 7, 15, 6, 0xfff4a0, 1); for (const x of [10, 13]) V.box(x, 10, 3, x + 2, 13, 5, WHITE); return done(V, 'stand'); });
export const bouncy = (v = 0) => M('bouncy' + (v % 2), 'bouncy', () => { const V = pv(26, 28, 26, 13, 13), A = v % 2 ? [0xe8232a, 0xffe23a, 0x2f5bff] : [0x2f5bff, 0xff4fa3, 0x14a83b];   // a kids' inflatable castle, 2.6 m
  V.box(1, 0, 1, 25, 4, 25, A[0]); V.box(3, 4, 3, 23, 5, 23, A[1]);
  for (const [x, z] of [[1, 1], [20, 1], [1, 20], [20, 20]]) { V.box(x, 0, z, x + 5, 22, z + 5, A[2]); V.box(x, 22, z, x + 5, 25, z + 5, A[1]); V.box(x + 2, 25, z + 2, x + 3, 28, z + 3, A[0]); }
  for (const [x0, z0, x1, z1] of [[6, 1, 20, 3], [6, 23, 20, 25], [1, 6, 3, 20], [23, 6, 25, 20]]) V.box(x0, 4, z0, x1, 14, z1, (x, y, z) => y > 11 ? A[1] : A[0]);
  V.clear(9, 4, 23, 17, 12, 25); return done(V, 'bouncy'); });
export const balloons = () => M('balloons', 'balloons', () => { const V = pv(10, 26, 10); const B = [[2, 22, 3, 0xe8232a], [6, 24, 5, 0xffe23a], [4, 20, 7, 0x2f5bff], [7, 21, 2, 0xff4fa3]];
  V.box(4, 0, 4, 6, 3, 6, 0x9a9ca4); for (const [x, y, z, c] of B) { line(V, 5, 3, 5, x, y - 2, z, 0xdfe3ea); V.box(x - 1, y - 2, z - 1, x + 2, y + 2, z + 2, c, 1); } return done(V, 'balloons'); });
export const bucket = () => M('bucket', 'bucket', () => { const V = pv(12, 5, 10); V.box(0, 0, 0, 4, 4, 4, 0xffe23a); V.box(1, 4, 1, 3, 5, 3, 0xffffff); V.box(5, 0, 2, 12, 1, 9, 0xe6f6ff, 1); V.box(7, 1, 4, 10, 2, 7, 0xffffff); return done(V, 'bucket'); });
export const dumpster = () => M('rdump', 'dumpster', () => { const V = pv(24, 14, 44, 12, 22), c = 0xff7a1a; V.box(1, 1, 1, 23, 13, 43, c); V.box(3, 3, 3, 21, 13, 41, 0x6b5a50);
  V.box(3, 12, 3, 21, 13, 41, (x, y, z) => ((x * 3 + z) % 5 === 0) ? 0xc9c3b6 : ((x + z * 7) % 9 === 0) ? 0x8a5a2a : undefined); V.box(0, 0, 0, 24, 1, 44, 0x3d3f46); V.box(4, 13, 10, 12, 16, 12, 0x8a5a2a); return done(V, 'dumpster'); });
export const logs = () => M('logs', 'logs', () => { const V = pv(40, 12, 14);
  for (const [x0, z, r, y] of [[1, 4, 3, 0], [13, 4, 3.4, 0], [26, 4, 3, 0], [7, 9, 3, 0]]) for (let x = x0; x < Math.min(40, x0 + 12); x++) for (let yy = 0; yy < 7; yy++) for (let zz = 0; zz < 14; zz++) if (Math.hypot(yy + .5 - r, zz + .5 - z) <= r) V.set(x, yy + y, zz, (x === x0 || x === x0 + 11) ? 0xd9a060 : 0x7a4a22);
  V.box(33, 0, 8, 39, 5, 13, 0x7a4a22); V.box(34, 5, 9, 38, 6, 12, 0xd9a060); return done(V, 'logs'); });
export const tent = c => M('tent' + c, 'tent', () => { const V = pv(24, 14, 22); for (let y = 0; y < 12; y++) { const w = Math.round(11 - y * .9); V.box(12 - w, y, 0, 12 + w, y + 1, 22, c); } V.clear(9, 0, 21, 15, 7, 22); V.box(9, 0, 21, 15, 7, 22, 0x2a2d38); return done(V, 'tent'); });
export const slide = () => M('slipslide', 'slide', () => { const V = pv(10, 2, 40, 5, 20); V.box(0, 0, 0, 10, 1, 40, 0xffe23a, 1); V.box(1, 1, 2, 9, 2, 38, 0xbfeaff, 1); V.box(0, 1, 0, 10, 2, 2, 0x2f5bff); return done(V, 'slide'); });
export const snowman = () => M('snowman' + TOD.night, 'inflatable', () => { const V = pv(16, 30, 16); cyl(V, 8, 8, 7, 0, 12, WHITE, 1); cyl(V, 8, 8, 5, 12, 21, WHITE, 1); cyl(V, 8, 8, 4, 21, 27, WHITE, 1);
  V.box(3, 27, 3, 13, 28, 13, INK); V.box(5, 28, 5, 11, 30, 11, INK); V.box(7, 23, 12, 9, 24, 15, 0xff7a1a); V.box(4, 19, 3, 12, 21, 13, 0xe8232a); for (const x of [6, 10]) V.box(x, 25, 12, x + 1, 26, 13, INK); return done(V, 'inflatable'); });
