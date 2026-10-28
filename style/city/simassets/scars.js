// scar(kind, { w, h }): damage on a lot. 0.05 grain.
//   burned      a window or door that burned out: a charred hole with shards and embers (lit at night), blackened trim, sill and head,
//               and a soot plume licking up the wall                                            facade · w × h = the opening (13 × 17)
//   boarded     plywood planks nailed over the opening, a cross brace, KEEP OUT sprayed on the planks  facade · the opening (13 × 17)
//   foreclosed  one plywood sheet over a door, the bank's NOTICE stapled on it, a chain across with a padlock
//                                                                                                  facade · the opening (14 × 24)
//   crimeScene  police tape on four posts around a footprint, a big-head chalk outline, numbered evidence markers, a dropped
//               sneaker and phone                                                                  ground · w × h = footprint (32 × 28)
//   memorial    photo on an easel, prayer candles (flames lit at night), bouquets, a teddy, a heart balloon on a string, RIP on
//               cardboard; its back edge goes against a wall, fence or lamp post                  ground · footprint (24 × 12)
// Facade pieces keep the kit.js depths (see security.js): the plug fills the opening from z −0.2, face parts clear +0.1 and +0.2.
import { vol, done, K, HV, mask3, mask5, print, printC, scribble, line, rng, hash, mix, TOD } from './lib.js';

const AZ = 4;
function faceVol(W, H, mx, mb, mt, nz = 14) { return vol(W + 2 * mx, H + mb + mt, nz, { s: HV, ax: W / 2 + mx, ay: mb, az: AZ, ground: false }); }

// ───────── boarded
function boarded(o) {
  const w = o.w ?? 13, h = o.h ?? 17, W = 2 * w, H = 2 * h, door = o.door ?? h >= 20, mx = 5, mb = door ? 0 : 3, V = faceVol(W, H, mx, mb, 4), X = x => x + mx, Y = y => y + mb, r = rng(w * 31 + h);
  V.box(X(0), Y(0), 0, X(W), Y(H), AZ + 4, 0x16161c);                                                           // the dark hole behind (z −0.2 … +0.2)
  const planks = []; let y = door ? 0 : -2;
  while (y < H + 2) { const t = Math.min(H + 2 - y, 5 + ((r() * 3) | 0)), a0 = -3 - ((r() * 2) | 0), a1 = W + 2 + ((r() * 2) | 0); if (t >= 3) planks.push([a0, y, a1, y + t]); y += t + 1 + (r() < .4 ? 1 : 0); }
  planks.forEach(([a0, y0, a1, y1], k) => { const base = k % 2 ? K.ply : mix(K.ply, K.plyD, .45);
    V.box(X(a0), Y(y0), AZ + 4, X(a1), Y(y1), AZ + 6, (x, yy) => (x === X(a0) || x === X(a1) - 1) ? K.plyE : (hash(x >> 2, yy, k) > .86 ? K.plyD : base));
    for (const nx of [a0 + 1, a1 - 2]) { V.set(X(nx), Y(y0) + 1, AZ + 6, K.iron); if (y1 - y0 > 4) V.set(X(nx), Y(y1) - 2, AZ + 6, K.iron); } });
  const bw = 4; for (let k = 0; k <= W + 2; k++) { const bx = -1 + k, by = Math.round((door ? 2 : 0) + (k / (W + 2)) * (H - (door ? 6 : 2)));   // the cross brace
    V.box(X(bx), Y(by), AZ + 6, X(bx) + 1, Y(by) + bw, AZ + 7, (xx, yy) => (yy === Y(by) || yy === Y(by) + bw - 1) ? K.plyE : K.ply); }
  const byOf = k => Math.round((door ? 2 : 0) + (k / (W + 2)) * (H - (door ? 6 : 2))); for (const k of [1, W]) V.set(X(k - 1), Y(byOf(k)) + 1, AZ + 7, K.iron);
  const words = door ? ['KEEP', 'OUT'] : ['KEEP', 'OUT'], ys = [Math.round(H * .72), Math.round(H * .38)];   // sprayed onto the planks only (the gaps stay clean)
  words.forEach((wd, k) => { const M = mask3(wd), sc = W >= 26 ? 2 : 1, x0 = Math.round(W / 2 - M.w * sc / 2) + (k ? 3 : -2);
    for (let j = 0; j < 5; j++) for (let i = 0; i < M.w; i++) if (M.at(i, j)) for (let a = 0; a < sc; a++) for (let b = 0; b < sc; b++) { const x = X(x0 + i * sc + a), yy = Y(ys[k] - j * sc - b);
      for (let z = AZ + 7; z >= AZ + 5; z--) if (V.has(x, yy, z)) { V.set(x, yy, z, K.red); if (j === 4 && b === sc - 1 && hash(i, k, a) > .7 && V.has(x, yy - 1, z)) V.set(x, yy - 1, z, K.red); break; } } });
  return done(V, 'scar-boarded', 'facade: bottom centre of the opening, on the wall plane (planks overhang the trim by ~0.15 m, front at +0.3/+0.35)');
}

// ───────── foreclosed
function foreclosed(o) {
  const w = o.w ?? 14, h = o.h ?? 24, W = 2 * w, H = 2 * h, door = o.door ?? h >= 20, mx = 4, mb = door ? 0 : 2, V = faceVol(W, H, mx, mb, 3), X = x => x + mx, Y = y => y + mb;
  V.box(X(0), Y(0), 0, X(W), Y(H), AZ + 4, 0x16161c);
  const y0 = door ? 0 : -2, y1 = H + 2;
  V.box(X(-3), Y(y0), AZ + 4, X(W + 3), Y(y1), AZ + 6, (x, y) => (x === X(-3) || x === X(W + 3) - 1 || y === Y(y1) - 1) ? K.plyE : (hash(x >> 1, y >> 3, 5) > .9 ? K.plyD : K.ply));   // one sheet
  for (let x = -2; x < W + 2; x += 5) for (const y of [y0 + 1, y1 - 2]) V.set(X(x), Y(y), AZ + 6, K.iron);
  for (let y = y0 + 5; y < y1 - 3; y += 6) for (const x of [-2, W + 1]) V.set(X(x), Y(y), AZ + 6, K.iron);
  // the notice: red header, the bank, fine print, a signature; four staples
  const pw = Math.min(26, W + 2), ph = Math.max(18, Math.min(24, H - 14)), px = Math.round(W / 2 - pw / 2), py = y1 - 3 - ph, P = AZ + 6;
  V.box(X(px), Y(py), P, X(px + pw), Y(py + ph), P + 1, K.white); V.box(X(px), Y(py + ph - 7), P, X(px + pw), Y(py + ph), P + 1, K.red);
  printC(V, mask3(pw >= 25 ? 'NOTICE' : 'BANK'), X(px + pw / 2), Y(py + ph - 2), P + 1, K.white, 0);
  printC(V, mask3(pw >= 25 ? 'SEIZED' : 'REPO'), X(px + pw / 2), Y(py + ph - 9), P + 1, K.cobalt, 0);
  const lines = Math.max(1, Math.floor((ph - 17) / 2)); for (let k = 0; k < lines; k++) for (let x = 2; x < pw - 2; x++) if (hash(x, k, 3) > .22) V.set(X(px + x), Y(py + ph - 16 - 2 * k), P, 0x3a3a44);
  scribble(V, X(px + pw - 12), Y(py + 1), P, 9, K.cobalt, 41);
  for (const [a, b] of [[1, 1], [pw - 2, 1], [1, ph - 2], [pw - 2, ph - 2]]) V.set(X(px + a), Y(py + b), P + 1, K.steelD, 2);
  // chain between two eye bolts, sagging, a padlock at the low point
  const cy = Math.max(y0 + 8, py - 5), L = X(-1), R = X(W);
  for (const ex of [L, R]) V.box(ex, Y(cy) - 1, AZ + 6, ex + 1, Y(cy) + 1, AZ + 8, K.steelL, 2);
  for (let x = L + 1; x < R; x++) { const t = (x - L) / (R - L), yy = Y(cy) - Math.round(4 * 4 * t * (1 - t)); V.set(x, yy, AZ + 7, (x & 1) ? K.steel : K.steelL, 2); if (x & 1) V.set(x, yy + 1, AZ + 7, K.steel, 2);
    const tn = (x + 1 - L) / (R - L), yn = Y(cy) - Math.round(16 * tn * (1 - tn)); if (x + 1 < R) for (let k = Math.min(yy, yn); k <= Math.max(yy, yn); k++) V.set(x, k, AZ + 7, K.steel, 2); }
  const mx0 = Math.round((L + R) / 2) - 2, my = Y(cy) - 4; V.box(mx0, my - 5, AZ + 7, mx0 + 5, my - 1, AZ + 9, K.gold, 2); V.set(mx0 + 2, my - 3, AZ + 9, K.ink);
  V.box(mx0, my - 1, AZ + 7, mx0 + 1, my + 1, AZ + 8, K.steelL, 2); V.box(mx0 + 4, my - 1, AZ + 7, mx0 + 5, my + 1, AZ + 8, K.steelL, 2); V.box(mx0, my + 1, AZ + 7, mx0 + 5, my + 2, AZ + 8, K.steelL, 2);
  return done(V, 'scar-foreclosed', 'facade: bottom centre of the opening, on the wall plane (sheet overhangs 0.15 m, chain + lock to +0.45)');
}

// ───────── burned
function burned(o) {
  const w = o.w ?? 13, h = o.h ?? 17, W = 2 * w, H = 2 * h, door = o.door ?? h >= 20, PH = Math.max(4, Math.min(30, Math.round((o.plume ?? .7) / HV))), mx = 6, mb = door ? 0 : 7, mt = 7 + PH;
  const V = faceVol(W, H, mx, mb, mt, 12), X = x => x + mx, Y = y => y + mb, BEAM = 0x3a2a22;
  // the hole: burnt black to the trim line, a fallen beam across it, shards left in the corners, embers along the sill (lit at night)
  V.box(X(0), Y(0), 0, X(W), Y(H), AZ + 2, (x, y) => hash(x >> 2, y >> 2, 7) > .8 ? K.soot : K.char);
  for (let k = 0; k < W; k++) { const y = Math.round(H * .78 - k * (H * .5) / W); V.box(X(k), Y(y), AZ + 1, X(k) + 1, Y(y) + 3, AZ + 2, (xx, yy) => yy === Y(y) + 2 ? 0x5a4032 : BEAM); }
  for (const [cx, cy, n, sx, sy] of [[0, H - 1, 6, 1, -1], [W - 1, H - 1, 4, -1, -1], [W - 1, 0, 5, -1, 1], [0, 0, 3, 1, 1]]) for (let a = 0; a < n; a++) for (let b = 0; b < n - a; b++)
    V.set(X(cx + sx * a), Y(cy + sy * b), AZ + 1, a + b === n - 1 ? K.glint : K.glassHi, 1);
  for (const [ex, n] of [[.25, 3], [.55, 2], [.8, 3]]) { const x0 = Math.round(W * ex); V.box(X(x0), Y(door ? 0 : 0), AZ + 1, X(x0 + n), Y(door ? 1 : 1), AZ + 2, K.ember, TOD.night ? 3 : 0); V.set(X(x0 + 1), Y(1), AZ + 1, 0xffb13a, TOD.night ? 3 : 0); }
  // blackened trim ring, head and sill (each one voxel proud of and beyond kit.js's own, so nothing is coplanar)
  const lo = door ? 0 : -2, SOOT = (x, y) => { const t = (y - Y(lo)) / (H + 5); return hash(x, y, 31) > .9 ? K.ash : t < .3 ? 0x4a4446 : t < .6 ? 0x353133 : K.soot; };   // ash-grey low, charred toward the head
  V.box(X(-3), Y(lo), AZ, X(W + 3), Y(H + 3), AZ + 3, (x, y) => (x >= X(0) && x < X(W) && y >= Y(0) && y < Y(H)) ? undefined : SOOT(x, y));
  V.box(X(-5), Y(H + 2), AZ, X(W + 5), Y(H + 7), AZ + 3, (x, y) => y === Y(H + 6) ? K.ash : K.char);
  if (!door) V.box(X(-5), Y(-7), AZ, X(W + 5), Y(-1), AZ + 5, (x, y) => y === Y(-2) ? K.ash : K.char);
  // the plume: soot licks up the wall face (z 0 … +0.05) — tapered spikes rising off a band over the head, a softer smoke edge, streaks
  // up from the frame's corners. o.plume = the licks' height in metres (default 0.7: the gap to the window above on a 3 m storey)
  const licks = [[.08, .42, -1], [.28, .88, 1], [.5, .62, -1], [.7, 1, 1], [.9, .5, -1]], base = H + 7, TONE = [K.char, 0x2e2a2c, 0x3d3839, 0x57504f, 0x6d6664];
  for (let y = 0; y < PH; y++) for (let x = -5; x < W + 5; x++) { const t = y / PH; let d = y < 1 ? 1.5 : -1, tt = t;
    for (const [fx, th, bend] of licks) { if (t >= th) continue; const u = t / th, cx = fx * W + bend * Math.sin(u * 3) * 1.8, half = (W * .1 + 2) * Math.pow(1 - u, .9); const dd = half - Math.abs(x + .5 - cx); if (dd > d) { d = dd; tt = u; } }
    if (d <= 0) continue; V.set(X(x), Y(base + y), AZ, TONE[Math.min(4, Math.floor(tt * 4.2) + (d < 1.2 ? 1 : 0))]); }
  for (const sx of [-4, W + 3]) for (let y = 0; y < Math.round(PH * .45); y++) if (hash(sx, y, 5) > .25) V.set(X(sx), Y(base + y), AZ, y > PH * .25 ? 0x57504f : 0x3d3839);
  return done(V, 'scar-burned', 'facade: bottom centre of the opening, on the wall plane (charred trim to +0.15, sill to +0.25, a 0.7 m plume above)');
}

// ───────── crime scene (ground)
function crimeScene(o) {
  const W = 2 * (o.w ?? 32), D = 2 * (o.h ?? 28), V = vol(W, 26, D, { s: HV }), Y0 = 17, TY = 7;
  const posts = [[1, 1], [W - 3, 1], [1, D - 3], [W - 3, D - 3]];
  for (const [x, z] of posts) { V.box(x - 1, 0, z - 1, x + 3, 1, z + 3, K.ink); V.box(x, 1, z, x + 2, Y0 + 3, z + 2, (xx, y) => (y === 12 || y === 13 || y === 6) ? K.white : K.orange); V.box(x, Y0 + 3, z, x + 2, Y0 + 4, z + 2, K.ink); }
  const tape = (i, k) => { const s = 'POLICE LINE · ', M = mask3(s), u = i % (M.w + 2); return (k >= 1 && k <= 5 && u < M.w && M.at(u, k - 1)) ? K.ink : K.yellow; };
  const runX = (z, x0, x1) => { for (let x = x0; x <= x1; x++) { const t = (x - x0) / (x1 - x0), sag = Math.round(3 * 4 * t * (1 - t)); for (let k = 0; k < TY; k++) V.set(x, Y0 + 1 - k - sag, z, tape(x - x0, k)); } };
  const runZ = (x, z0, z1) => { for (let z = z0; z <= z1; z++) { const t = (z - z0) / (z1 - z0), sag = Math.round(3 * 4 * t * (1 - t)); for (let k = 0; k < TY; k++) V.set(x, Y0 + 1 - k - sag, z, tape(z - z0, k)); } };
  runX(1, 3, W - 4); runX(D - 2, 3, W - 4); runZ(1, 3, D - 4); runZ(W - 2, 3, D - 4);
  // chalk outline of a big-head body (one voxel of chalk on the ground): rasterise the silhouette, keep its edge
  const cx = W / 2, cz = D / 2, S = new Set(), key = (x, z) => x * 4096 + z;
  const blob = (x0, z0, r) => { for (let x = Math.floor(x0 - r); x <= x0 + r; x++) for (let z = Math.floor(z0 - r); z <= z0 + r; z++) if (Math.hypot(x + .5 - x0, z + .5 - z0) <= r) S.add(key(x, z)); };
  const limb = (x0, z0, x1, z1, r) => { for (let t = 0; t <= 1; t += .04) blob(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, r); };
  blob(cx - 2, cz - 11, 7.5); limb(cx - 1, cz - 3, cx, cz + 6, 4.5); limb(cx - 3, cz - 2, cx - 13, cz - 6, 1.8); limb(cx + 2, cz - 1, cx + 11, cz + 3, 1.8);
  limb(cx - 2, cz + 8, cx - 8, cz + 17, 2); limb(cx + 2, cz + 8, cx + 7, cz + 16, 2);
  const edge = (x, z) => S.has(key(x, z)) && ![key(x + 1, z), key(x - 1, z), key(x, z + 1), key(x, z - 1)].every(n => S.has(n));
  for (const k of S) { const x = Math.floor(k / 4096), z = k % 4096; if (edge(x, z) || [[2, 0], [-2, 0], [0, 2], [0, -2], [1, 1], [-1, -1], [1, -1], [-1, 1]].some(([a, b]) => !S.has(key(x + a, z + b)))) V.set(x, 0, z, 0xf4f4f0); }
  // evidence tents (numbers on both slopes), a dropped sneaker, a phone
  const tent = (x, z, n) => { for (let y = 0; y < 5; y++) { const hz = 2 - Math.floor(y / 2); V.box(x, y, z - hz, x + 5, y + 1, z + hz + 1, K.yellow); }
    const M = mask3(String(n)); for (let j = 0; j < 5; j++) for (let i = 0; i < M.w; i++) if (M.at(i, j)) { const y = 4 - j; if (y < 5 && y >= 0) { const hz = 2 - Math.floor(y / 2); V.set(x + 1 + i, y, z + hz, K.ink); V.set(x + 3 - i, y, z - hz, K.ink); } } };
  tent(Math.round(cx + 8), Math.round(cz - 16), 1); tent(Math.round(cx - 18), Math.round(cz + 10), 2); tent(Math.round(cx + 13), Math.round(cz + 12), 3);
  const sx = Math.round(cx - 17), sz = Math.round(cz + 14); V.box(sx, 0, sz, sx + 6, 2, sz + 3, K.white); V.box(sx + 3, 2, sz, sx + 6, 3, sz + 3, K.white); V.box(sx, 0, sz, sx + 6, 1, sz + 3, K.red); V.box(sx + 1, 1, sz + 3, sx + 4, 2, sz + 4, K.red);
  const ph = Math.round(cx + 13), pz = Math.round(cz + 6); V.box(ph, 0, pz, ph + 2, 1, pz + 4, K.ink); V.set(ph, 1, pz + 1, 0x6fd6ff, 1);
  return done(V, 'scar-crime', 'ground: base centre of the footprint (tape on four posts at the corners, 1.0 m)');
}

// ───────── memorial (ground). Plan (48 × 24 half voxels, back edge z 0 against the wall): bouquets stood against the wall on the
// left, the photo on its easel in the middle (a heart balloon tied to it), RIP on cardboard propped on a brick and a teddy on the right,
// prayer candles and pillar candles in an arc in front (flames lit at night)
function memorial(o) {
  const W = 2 * (o.w ?? 24), D = 2 * (o.h ?? 12), V = vol(W, 36, D, { s: HV }), cx = Math.round(W / 2), G = K.gold, k = W / 48;
  const fx = cx - 6, fz = 5, fy = 6;
  line(V, fx + 2, 0, fz + 2, fx + 3, fy + 13, fz, K.woodD); line(V, fx + 9, 0, fz + 2, fx + 8, fy + 13, fz, K.woodD); line(V, cx, 0, 1, cx, fy + 12, fz - 1, K.woodD);
  V.box(fx, fy - 1, fz, fx + 12, fy, fz + 3, K.woodD);
  V.box(fx, fy, fz, fx + 12, fy + 14, fz + 1, G, 2); V.box(fx + 1, fy + 1, fz + 1, fx + 11, fy + 13, fz + 2, K.cobalt);                  // gold frame, blue backdrop
  V.box(fx + 3, fy + 3, fz + 2, fx + 9, fy + 10, fz + 3, 0xd9a06b); V.box(fx + 3, fy + 9, fz + 2, fx + 9, fy + 11, fz + 3, K.ink);           // a big head, hair
  for (const [a, b] of [[4, 7], [7, 7], [4, 5], [7, 5]]) V.set(fx + a, fy + b, fz + 3, K.ink); V.box(fx + 5, fy + 4, fz + 3, fx + 7, fy + 5, fz + 4, K.ink);   // eyes, a smile
  V.box(fx + 2, fy + 1, fz + 2, fx + 10, fy + 3, fz + 3, K.red);                                                                        // shoulders (a red hoodie)
  line(V, fx + 11, fy + 14, fz, fx + 15, 26, fz, K.white);                                                                               // the balloon's string
  ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'].forEach((row, j) => { for (let i = 0; i < 7; i++) if (row[i] === 'X') V.box(fx + 12 + i, 32 - j, fz - 1, fx + 13 + i, 33 - j, fz + 1, i < 2 && j < 2 ? 0xff8a9a : K.red, 1); });
  // bouquets stood against the wall, heads up, in paper cones
  const stood = [[3, K.white, [K.red, K.pink]], [7, K.pink, [K.yellow, K.white]], [11, 0x2de2e6, [K.pink, K.red]], [15, K.white, [K.orange, K.yellow]]];
  for (const [x, wrap, heads] of stood) { for (let y = 0; y < 9; y++) { const hw = y < 3 ? 0 : 1; V.box(x - hw, y, 1, x + hw + 1, y + 1, 3 + (y >> 2), wrap); }
    for (let a = -2; a <= 2; a++) for (let b = 0; b <= 2; b++) for (let q = 0; q < 2; q++) if (Math.abs(a) + b + q < 4) V.set(x + a, 9 + q, 1 + b + (q ? 0 : 1), (a + b + q) % 3 === 0 ? 0x2fbf55 : heads[(a + 2 + q) & 1]); }
  // RIP on a piece of box, propped on a brick; a teddy in front of it
  const rx = fx + 13, rz = 4, rw = Math.min(17, W - rx); V.box(rx, 0, rz, rx + rw, 10, rz + 1, K.card); V.box(rx + 5, 0, rz - 2, rx + 10, 3, rz, 0xb04a3a); printC(V, mask5('RIP'), rx + rw / 2, 8, rz + 1, K.ink, 0);
  const tx = 1, tz = 8, T = K.pink; V.box(tx, 0, tz, tx + 6, 5, tz + 5, T); V.box(tx + 1, 5, tz, tx + 5, 9, tz + 4, T); V.set(tx + 1, 9, tz + 1, T); V.set(tx + 4, 9, tz + 1, T);
  V.box(tx + 2, 6, tz + 4, tx + 4, 7, tz + 5, K.cream); V.set(tx + 2, 8, tz + 4, K.ink); V.set(tx + 3, 8, tz + 4, K.ink); V.box(tx, 0, tz + 5, tx + 2, 2, tz + 7, T); V.box(tx + 4, 0, tz + 5, tx + 6, 2, tz + 7, T);
  // candles in an arc
  const cand = [[5, 16, K.white, 5], [8, 12, K.red, 6], [13, 16, K.white, 8], [18, 18, K.yellow, 6], [26, 19, K.red, 7], [31, 17, K.cobalt, 6], [34, 14, K.white, 9], [40, 18, K.red, 6]];
  for (const [x0, z, c, hh] of cand) { const x = Math.round(x0 * k); V.box(x, 0, z, x + 3, hh, z + 3, c, c === K.white ? 0 : 1); if (c !== K.white) V.box(x, 2, z + 3, x + 3, 4, z + 4, K.white);
    V.set(x + 1, hh, z + 1, 0xfff0b0, TOD.night ? 3 : 1); V.set(x + 1, hh + 1, z + 1, K.orange, TOD.night ? 3 : 1); }
  return done(V, 'scar-memorial', 'ground: base centre; its back edge (−z) goes against a wall, fence or lamp post, the front faces the sidewalk');
}

const KINDS = { burned, boarded, foreclosed, crimeScene, memorial };
export function scar(kind = 'boarded', o = {}) { return (KINDS[kind] || boarded)(o); }
