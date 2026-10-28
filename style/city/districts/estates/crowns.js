// GATEHILL · the tops: every tower's crown and roof set piece, each one of a kind (the overhead set pieces of the district).
//   drawn into the shaft (0.2 cubes):  temple (green copper, a lantern) · cupolas (the twins' gold domes) · sunburst (the gold deco crown
//                                      and its spire) · feather (terracotta fins rising to a point) · mech (the pencil's open frame)
//   their own volumes (0.1 cubes, people on them): skypool (a glass pool cantilevered over Union Ave) · helipad (and its helicopter)
//                                      cabanas (a hot tub, striped cabanas, a bar) · infinity (the pencil's tiny pool) · palmpool ·
//                                      garden · orangery · forest · tank (a water tower on its stand) · skydeck · tennis (clay) · pickleball
//                                      (the diamond ring is the SOLITAIRE hero's: heroes/estates-solitaire.js)
// crownFar draws the same tops as 0.5-cube blobs for the far tier.
import { Vol, meshVol, stamp } from '../../vox.js';
import { AIR } from '../../kit.js';
import { C, CV, SIDE, H, TOD, REG, cyl, px, vtext, vtextUp, lit, logSign, memo, pv, done, RY, r2 } from './lib.js';
import { lawnChair, umbrella, bench, speaker } from '../../props.js';
import { podStrips } from './specs.js';
import { roofBillboard, giantLook } from '../../signage/index.js';
import { BILLBOARDS } from '../../lexicon.js';

const S2 = .2, FL = 15;
// the top tier's rects (world) and the roof's height (world y); the shaft volume's voxel helpers
export function topOf(P) { const st = P.st, t = st.tiers[st.tiers.length - 1]; return { t, rects: t.rects.map(r => P.rectW(r)), y: SIDE + st.top }; }
const LIT = () => TOD.night ? 3 : 1;
const person = (A, x, y, z, ry, act, seed) => { (A.life ??= []).push({ x: r2(x), y: r2(y), z: r2(z), ry, act, seed: seed | 0, hand: true }); };

// ── into the shaft volume ────────────────────────────────────────────────────────────────────────────────────────────────────
// a temple: a colonnade round a lit core, an entablature, a stepped green-copper roof, a lantern and a gold finial
function temple(V, [x0, z0, x1, z1], y, o) {
  const W = o.wall, T = o.trim, CU = o.col ?? C.copper, CD = shade2(CU), core = [x0 + 5, z0 + 5, x1 - 5, z1 - 5];
  V.box(x0 + 1, y, z0 + 1, x1 - 1, y + 2, z1 - 1, W);                                                                        // the plinth
  V.box(core[0], y + 2, core[1], core[2], y + 18, core[3], (x, yy, z) => ((x + z) % 3 === 0 && yy > y + 4 && yy < y + 16) ? (TOD.night ? C.litHi : 0x3f6bc4) : W, LIT());
  for (let x = x0 + 2; x < x1 - 2; x += 5) for (const z of [z0 + 2, z1 - 4]) V.box(x, y + 2, z, x + 2, y + 18, z + 2, W);          // columns
  for (let z = z0 + 2; z < z1 - 2; z += 5) for (const x of [x0 + 2, x1 - 4]) V.box(x, y + 2, z, x + 2, y + 18, z + 2, W);
  V.box(x0 + 1, y + 18, z0 + 1, x1 - 1, y + 21, z1 - 1, T); V.box(x0, y + 20, z0, x1, y + 21, z1, T);                        // entablature
  let k = 0; for (; k < 12; k++) { const a0 = x0 + 1 + k * 2, b0 = z0 + 1 + k * 2, a1 = x1 - 1 - k * 2, b1 = z1 - 1 - k * 2; if (a1 - a0 < 6 || b1 - b0 < 6) break;
    V.box(a0, y + 21 + k * 2, b0, a1, y + 23 + k * 2, b1, (x, yy, z) => (x === a0 || x === a1 - 1 || z === b0 || z === b1 - 1) && yy === y + 22 + k * 2 ? CD : CU, TOD.night ? 3 : 0); }   // (floodlit at night)
  const ly = y + 21 + k * 2, cx = (x0 + x1) >> 1, cz = (z0 + z1) >> 1;
  for (const [dx, dz] of [[-2, -2], [1, -2], [-2, 1], [1, 1]]) V.box(cx + dx, ly, cz + dz, cx + dx + 1, ly + 6, cz + dz + 1, T);   // the lantern's posts
  V.box(cx - 1, ly, cz - 1, cx + 1, ly + 6, cz + 1, 0xfff3c4, TOD.night ? 3 : 1); V.box(cx - 3, ly + 6, cz - 3, cx + 3, ly + 8, cz + 3, CU); V.box(cx - 2, ly + 8, cz - 2, cx + 2, ly + 9, cz + 2, CU);
  V.box(cx, ly + 9, cz, cx + 1, ly + 16, cz + 1, C.gold, 2); V.box(cx - 1, ly + 13, cz, cx + 2, ly + 14, cz + 1, C.gold, 2);
  return ly + 16;
}
const shade2 = c => { const m = s => Math.round(((c >> s) & 255) * .78); return (m(16) << 16) | (m(8) << 8) | m(0); };
// a cupola: columns round a square drum, a stepped gold dome, a lantern, a finial
function cupola(V, [x0, z0, x1, z1], y, o) {
  const W = o.wall, T = o.trim, G = o.col ?? C.gold, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, rx = (x1 - x0) / 2 - 2, rz = (z1 - z0) / 2 - 2;
  V.box(x0 + 1, y, z0 + 1, x1 - 1, y + 2, z1 - 1, W); V.box(x0 + 4, y + 2, z0 + 4, x1 - 4, y + 12, z1 - 4, (x, yy, z) => (yy > y + 4 && yy < y + 10 && (x + z) % 3 === 0) ? (TOD.night ? C.litHi : 0x3f6bc4) : W, LIT());
  for (let x = x0 + 2; x < x1 - 2; x += 4) for (const z of [z0 + 2, z1 - 3]) V.box(x, y + 2, z, x + 1, y + 12, z + 1, W);
  for (let z = z0 + 2; z < z1 - 2; z += 4) for (const x of [x0 + 2, x1 - 3]) V.box(x, y + 2, z, x + 1, y + 12, z + 1, W);
  V.box(x0 + 1, y + 12, z0 + 1, x1 - 1, y + 14, z1 - 1, T);
  const hD = Math.round(Math.min(rx, rz) * 1.1) + 2;
  for (let k = 0; k < hD; k++) { const t = k / hD, f = Math.sqrt(1 - t * t); V.box(Math.round(cx - rx * f), y + 14 + k, Math.round(cz - rz * f), Math.round(cx + rx * f), y + 15 + k, Math.round(cz + rz * f), k % 3 === 2 ? shade2(G) : G, TOD.night ? 3 : 0); }   // (matte toon gold by day, floodlit at night)
  const ly = y + 14 + hD, X = Math.round(cx), Z = Math.round(cz);
  V.box(X - 1, ly, Z - 1, X + 1, ly + 3, Z + 1, 0xfff3c4, TOD.night ? 3 : 1); V.box(X - 1, ly + 3, Z - 1, X + 1, ly + 4, Z + 1, G, 2); V.box(X, ly + 4, Z, X + 1, ly + 9, Z + 1, G, 2);
  return ly + 9;
}
// the sunburst crown: three stepped tiers of arches in gold; in each arch, rays of glass (lit white at night); a steel spire on top
function sunburst(V, [x0, z0, x1, z1], y, o) {
  const G = o.col ?? C.gold, GD = C.goldD, W = o.wall; let top = y;
  for (let k = 0; k < 3; k++) { const a0 = x0 + 2 + k * 4, b0 = z0 + 2 + k * 4, a1 = x1 - 2 - k * 4, b1 = z1 - 2 - k * 4, h = 13 - k, y0 = top; if (a1 - a0 < 8) break;
    V.box(a0, y0, b0, a1, y0 + h, b1, W);
    // each face: arches across it; rays inside each arch
    for (const [len, put] of [[a1 - a0, (u, yy, c, l) => V.set(a0 + u, yy, b0, c, l)], [a1 - a0, (u, yy, c, l) => V.set(a0 + u, yy, b1 - 1, c, l)], [b1 - b0, (u, yy, c, l) => V.set(a0, yy, b0 + u, c, l)], [b1 - b0, (u, yy, c, l) => V.set(a1 - 1, yy, b0 + u, c, l)]]) {
      const n = Math.max(1, Math.round(len / 12)), aw = len / n;
      for (let u = 0; u < len; u++) for (let yy = 0; yy < h; yy++) { const q = Math.floor(u / aw), cu = (q + .5) * aw, r = aw / 2 - .5, du = u + .5 - cu, dy = yy, d = Math.hypot(du, dy * (aw / 2) / h * 1.6);
        if (d > r) { put(u, y0 + yy, G, TOD.night ? 3 : 0); continue; }                                                          // gold spandrels between arches
        const ang = Math.atan2(dy + .5, du), ray = Math.floor(ang / (Math.PI / 7)) % 2 === 0; put(u, y0 + yy, ray ? (TOD.night ? 0xfff6dc : 0x3f6bc4) : (d > r - 1.2 ? G : GD), TOD.night ? 3 : ray ? 1 : 0); } }
    top = y0 + h; }
  // the spire: a stepped needle, chrome, a red light at the tip
  const cx = (x0 + x1) >> 1, cz = (z0 + z1) >> 1, n = Math.round((o.spire ?? 18) / S2); let yy = top;
  for (const [w, h] of [[3, .18], [2, .3], [1, .52]]) { const hh = Math.round(n * h); V.box(cx - w + 1, yy, cz - w + 1, cx + w, yy + hh, cz + w, 0xc9ced6, 2); yy += hh; }
  V.box(cx, yy, cz, cx + 1, yy + 2, cz + 1, 0xff2a2a, TOD.night ? 3 : 1);
  return yy + 2;
}
// the feather: fins rising past the roof on three faces, tallest at the middle of the north face, stepping down round the corners
function feather(V, [x0, z0, x1, z1], y, o) { const A = o.accent, n = Math.round((o.h ?? 8) / S2), cx = (x0 + x1) / 2, L = x1 - x0 + (z1 - z0) * 2;
  const fin = (x, z, t) => { const hh = Math.max(3, Math.round(n * (1 - Math.abs(t)) ** 1.4)); V.box(x, y, z, x + 1, y + hh, z + 1, A); if (TOD.night) V.box(x, y + hh - 2, z, x + 1, y + hh, z + 1, 0xffd8a0, 3); };
  for (let x = x0; x < x1; x += 4) fin(x, z0 - 1, (x - cx) / ((x1 - x0) / 2) * .55);
  for (let z = z0; z < z1; z += 4) { fin(x0 - 1, z, .55 + (z - z0) / (z1 - z0) * .45); fin(x1, z, .55 + (z - z0) / (z1 - z0) * .45); }
  return y + n; }
// the pencil's crown: two open floors (the grid cut clean through, a dark core in the middle), a slab on top
function mech(V, [x0, z0, x1, z1], y, o) { const h = 2 * FL, W = o.wall, core = 18;
  V.box(x0, y, z0, x1, y + h, z1, W);
  for (let yy = y; yy < y + h; yy += FL) { const b = (len) => { const n = Math.max(1, Math.round(len / 15)); return Array.from({ length: n }, (_, k) => [Math.round(k * len / n), Math.round((k + 1) * len / n)]); };
    for (const [p, q] of b(x1 - x0)) { const w = Math.min(11, q - p - 3), a = x0 + p + ((q - p - w) >> 1); V.box(a, yy + 2, z0, a + w, yy + 13, z1, AIR); }
    for (const [p, q] of b(z1 - z0)) { const w = Math.min(11, q - p - 3), a = z0 + p + ((q - p - w) >> 1); V.box(x0, yy + 2, a, x1, yy + 13, a + w, AIR); } }
  const c0 = [x0 + core, z0 + core, x1 - core, z1 - core]; if (c0[2] > c0[0] && c0[3] > c0[1]) V.box(c0[0], y, c0[1], c0[2], y + h, c0[3], TOD.night ? 0xfff0d0 : 0x4d4f58, TOD.night ? 3 : 0);
  V.box(x0, y + h, z0, x1, y + h + 1, z1, W); return y + h + 1; }

// ── roof pieces in their own volumes (0.1 cubes) ─────────────────────────────────────────────────────────────────────────────
function pieceVol(ctx, x0, z0, x1, z1, y, h, walk = false) { const V = ctx.volume(x0, y, z0, x1, y + h * CV, z1, { walk, ground: true }); return V; }
const wx = (V, x) => V.org[0] + (x + .5) * CV, wz = (V, z) => V.org[2] + (z + .5) * CV;
// a pool: coping, cyan water (lit at night), a lane line or a float
function pool(V, a0, b0, a1, b1, cop, y = 0) { V.box(a0 - 2, y, b0 - 2, a1 + 2, y + 2, b1 + 2, cop); V.box(a0, y, b0, a1, y + 2, b1, (x, yy, z) => yy === y ? C.waterD : (H(x, z, 7) > .97 ? 0xbff0ff : C.water), TOD.night ? 3 : 1); }
export const palm = v => memo('palm' + v, () => { const V = pv(22, 56, 22), lean = [1, -1, 0][v % 3], c = 11;
  V.box(c - 2, 0, c - 2, c + 2, 5, c + 2, 0x8b5a2b); let tx = c; for (let y = 5; y < 44; y++) { tx = c - 1 + Math.round(lean * (y / 44) ** 2 * 4); V.box(tx, y, c - 1, tx + 2, y + 1, c + 1, y % 4 ? 0xa4652f : 0x8b5a2b); }
  V.box(tx - 1, 43, c - 2, tx + 3, 46, c + 2, C.leafD);
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) for (let k = 1; k < 9; k++) { const x = tx + 1 + dx * k, z = c + dz * k, y = 45 - Math.floor(k * k / 16);
    V.box(Math.min(x, x - dx), y - 1, Math.min(z, z - dz), Math.max(x, x - dx) + 1, y + 1, Math.max(z, z - dz) + 1, k % 3 === 0 ? C.leafD : C.leaf); }
  return done(V, 'palm'); });
export const cubeTree = (v, big = false) => memo('ctree' + v + big, () => { const s = big ? 1.4 : 1, V = pv(Math.round(24 * s), Math.round(44 * s), Math.round(24 * s)), c = V.nx >> 1;
  V.box(c - 1, 0, c - 1, c + 1, Math.round(16 * s), c + 1, C.trunk);
  [[8, 12], [10, 17], [8, 24], [5, 30]].forEach(([r, y], k) => { const R = Math.round(r * s), Y = Math.round(y * s); V.box(c - R, Y, c - R, c + R, Y + Math.round(7 * s), c + R, (x, yy, z) => ((x + yy + z + k + v) % 5 === 0) ? C.leafD : [C.leaf, C.leafL, C.leaf][(k + v) % 3]); });
  return done(V, 'roof-tree'); });

function roofPiece(ctx, P, T, kind, R, y, shV) {
  const [x0, z0, x1, z1] = R, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, A = ctx.A, sd = P.seed, ins = .5;
  const clearParapet = (a0, b0, a1, b1) => { const X = x => Math.round((x - shV.org[0]) / S2), Z = z => Math.round((z - shV.org[2]) / S2), yv = Math.round((y - shV.org[1]) / S2); shV.clear(X(a0), yv, Z(b0), X(a1), yv + 8, Z(b1)); };
  REG.group('roof');
  if (kind === 'infinity' || kind === 'palmpool' || kind === 'cabanas' || kind === 'garden' || kind === 'forest' || kind === 'orangery' || kind === 'tank' || kind === 'pickleball' || kind === 'tennis') {
    const V = pieceVol(ctx, x0 + ins, z0 + ins, x1 - ins, z1 - ins, y, { cabanas: 30, tennis: 22, pickleball: 11, tank: 8 }[kind] || 2, true), nx = V.nx, nz = V.nz;
    if (kind === 'infinity') { V.box(0, 0, 0, nx, 1, nz, 0xe9e4da); pool(V, 6, 6, nx - 6, nz - 18, 0x17171b); V.box(0, 1, 0, nx, 2, 3, 0xbfe6ff, 1);
      for (const k of [0, 1]) ctx.put(lawnChair(k ? C.chalk : C.ink), wx(V, 12 + k * 14), wz(V, nz - 9), { y: y + CV, rot: 2, slide: [1, 0], reach: .8 }); person(A, wx(V, nx * .55), y + CV, wz(V, nz * .4), 0, 'soak', sd + 1); }
    else if (kind === 'palmpool') { V.box(0, 0, 0, nx, 1, nz, (x, yy, z) => ((x >> 3) + (z >> 3)) & 1 ? 0xf2efe6 : 0xe6e1d6); pool(V, 32, 24, nx - 32, nz - 40, C.chalk);
      for (const [px2, pz2, k] of [[13, 13, 0], [nx - 13, 13, 1], [13, nz - 13, 2], [nx - 13, nz - 13, 0]]) ctx.put(palm(k), wx(V, px2), wz(V, pz2), { y: y + CV, rot: k, slide: [1, 0], reach: .5 });
      const ch = []; for (let k = 0; k < 3; k++) ch.push(ctx.put(lawnChair([C.pink, C.yellow, C.teal][k]), wx(V, 36 + k * 16), wz(V, nz - 24), { y: y + CV, rot: 2, slide: [1, 0], reach: .6 }));
      ctx.put(umbrella(C.pink), wx(V, nx - 34), wz(V, nz - 22), { y: y + CV, slide: [1, 0], reach: .8 }); person(A, wx(V, nx * .5), y + 1.0, wz(V, nz * .4), 1, 'soak', sd + 2); if (ch[1]) person(A, ch[1][0], y + CV + .1, ch[1][1], Math.PI, 'lounge', sd + 3); }
    else if (kind === 'cabanas') { V.box(0, 0, 0, nx, 1, nz, (x, yy, z) => x % 4 === 0 ? 0x8b5a2b : 0xa4652f);
      cyl(V, nx * .3, nz * .38, 13, 0, 2, (x, yy, z) => Math.hypot(x + .5 - nx * .3, z + .5 - nz * .38) > 11.5 ? C.ink : C.water, TOD.night ? 3 : 1);   // the hot tub
      for (let k = 0; k < 3; k++) { const a = nx - 26, b = 6 + k * 24; if (b + 20 > nz) break; cabana(ctx, V, a, b, T, y, k); }
      V.box(6, 1, nz - 10, 40, 11, nz - 4, C.ink); V.box(5, 11, nz - 11, 41, 12, nz - 3, C.gold);   // the bar
      person(A, wx(V, nx * .3), y + CV, wz(V, nz * .38), 2, 'soak', sd + 4); person(A, wx(V, 20), y + CV, wz(V, nz - 14), 0, 'talk', sd + 5); person(A, wx(V, 32), y + CV, wz(V, nz - 14.5), .4, 'phone', sd + 6); }
    else if (kind === 'garden' || kind === 'forest') { V.box(0, 0, 0, nx, 1, nz, (x, yy, z) => (((x / 6) | 0) % 2) ? C.grass : C.grassD); V.box(0, 0, (nz >> 1) - 2, nx, 1, (nz >> 1) + 2, 0xe2dccf);
      // trees on a jittered grid (one per cell, never two in one), clear of the path across the middle
      const cell = kind === 'forest' ? 36 : 44; for (let gx = 0; gx + cell <= nx; gx += cell) for (let gz = 0; gz + cell <= nz; gz += cell) { const k = gx * 7 + gz, tx = gx + (cell >> 1) + (((H(sd, k, 1) - .5) * 8) | 0), tz = gz + (cell >> 1) + (((H(sd, k, 2) - .5) * 8) | 0);
        if (Math.abs(tz - (nz >> 1)) < 16 || (kind === 'garden' && H(sd, k, 3) < .4)) continue; ctx.put(cubeTree(k % 3, kind === 'forest' && H(sd, k, 4) < .5), wx(V, tx), wz(V, tz), { y: y + CV, slide: [1, 0], reach: .6 }); }
      ctx.put(bench(), wx(V, nx >> 1), wz(V, (nz >> 1) + 5), { y: y + CV, rot: 0, slide: [1, 0], reach: 1.2 }); person(A, wx(V, (nx >> 1) - 6), y + CV, wz(V, (nz >> 1) + 1), .3, 'garden', sd + 7); }
    else if (kind === 'orangery') { V.box(0, 0, 0, nx, 1, nz, (x, yy, z) => ((x + z) % 8 < 4) ? 0xe6e1d6 : 0xd3cfc5); orangery(ctx, P, V, y); }
    else if (kind === 'tank') { V.box(0, 0, 0, nx, 1, nz, 0x9a9890); ctx.put(waterTower(), wx(V, nx * .68), wz(V, nz * .35), { y: y + CV, slide: [1, 0], reach: 1.5 });
      for (let k = 0; k < 4; k++) V.box(8 + k * 16, 1, nz - 16, 20 + k * 16, 6, nz - 6, (x, yy) => yy === 5 ? C.leaf : 0x8b5a2b);   // planter beds
      ctx.put(umbrella(C.rasp), wx(V, 24), wz(V, 22), { y: y + CV, slide: [1, 0], reach: 1 }); person(A, wx(V, 30), y + CV, wz(V, 24), 1.2, 'phone', sd + 8); }
    else if (kind === 'tennis') {   // CLUBHOUSE: one clay court, full tennis lines, a 1 m net on posts, a dark green windscreen, the umpire's chair
      V.box(0, 0, 0, nx, 1, nz, 0x1f6a3a); const cw = Math.min(nx - 14, 134), cd = Math.min(nz - 30, 61), a0 = (nx - cw) >> 1, b0 = (nz - cd) >> 1, m = cw >> 1, sv = Math.round(cw * .269), sg = Math.round(cd * .125);
      V.box(a0, 0, b0, a0 + cw, 1, b0 + cd, (x, yy, z) => { const u = x - a0, v = z - b0, du = Math.abs(u - m);
        const line = u === 0 || u === cw - 1 || v === 0 || v === cd - 1 || v === sg || v === cd - 1 - sg || (du === sv && v > sg && v < cd - 1 - sg) || (v === (cd >> 1) && du < sv) || (v === (cd >> 1) && (u < 3 || u > cw - 4));
        return line ? C.chalk : ((u * 3 + v * 7) % 23 === 0 ? 0xc85a33 : C.clay); });
      V.box(a0 + m, 1, b0 - 4, a0 + m + 1, 11, b0 + cd + 4, (x, yy, z) => yy >= 9 ? C.chalk : (z % 2 === 0 || yy === 1 ? C.ink : undefined)); for (const z of [b0 - 5, b0 + cd + 4]) V.box(a0 + m - 1, 1, z, a0 + m + 2, 12, z + 1, C.iron);   // the net and its posts
      for (let x = 1; x < nx - 1; x++) for (const z of [1, nz - 2]) V.box(x, 1, z, x + 1, 20, z + 1, (xx, yy) => (x % 12 === 0 || yy >= 18) ? C.ink : 0x1f5a34);   // the windscreen: dark green fabric on posts
      for (let z = 1; z < nz - 1; z++) for (const x of [1, nx - 2]) V.box(x, 1, z, x + 1, 20, z + 1, (xx, yy) => (z % 12 === 0 || yy >= 18) ? C.ink : 0x1f5a34);
      { const ux = a0 + m - 2, uz = b0 - 13; for (const [dx, dz] of [[0, 0], [4, 0], [0, 4], [4, 4]]) V.box(ux + dx, 1, uz + dz, ux + dx + 1, 16, uz + dz + 1, C.chalk); V.box(ux, 16, uz, ux + 5, 17, uz + 5, C.chalk); V.box(ux, 17, uz + 4, ux + 5, 21, uz + 5, C.chalk); for (let yy = 3; yy < 16; yy += 3) V.box(ux, yy, uz + 5, ux + 5, yy + 1, uz + 6, C.chalk); }   // the umpire's chair
      person(A, wx(V, a0 + cw * .12), y + CV, wz(V, b0 + cd * .4), -Math.PI / 2, 'shoot', sd + 9); person(A, wx(V, a0 + cw * .86), y + CV, wz(V, b0 + cd * .62), Math.PI / 2, 'arms', sd + 10); }
    else if (kind === 'pickleball') {   // NO COMMENT: two blue courts side by side with lime kitchens, white lines, low nets, a pink deck, a low divider
      V.box(0, 0, 0, nx, 1, nz, (x, yy, z) => ((x >> 3) + (z >> 3)) & 1 ? C.pink : 0xff6fb5); const cw = Math.min(nx - 14, 104), cd = Math.min(((nz - 24) >> 1), 47), a0 = (nx - cw) >> 1, m = cw >> 1, kz = Math.round(cw * .159);
      for (const b0 of [8, nz - 8 - cd]) { V.box(a0, 0, b0, a0 + cw, 1, b0 + cd, (x, yy, z) => { const u = x - a0, v = z - b0, du = Math.abs(u - m);
          if (u === 0 || u === cw - 1 || v === 0 || v === cd - 1 || du === kz || (v === (cd >> 1) && du > kz)) return C.chalk; return du < kz ? 0x6cff4a : C.blue; });
        V.box(a0 + m, 1, b0 - 2, a0 + m + 1, 9, b0 + cd + 2, (x, yy, z) => yy === 8 ? C.chalk : (z % 2 === 0 || yy === 1 ? C.ink : undefined)); for (const z of [b0 - 3, b0 + cd + 2]) V.box(a0 + m - 1, 1, z, a0 + m + 2, 10, z + 1, C.ink); }   // low net + posts
      for (let x = a0 - 4; x < a0 + cw + 4; x++) V.box(x, 1, nz >> 1, x + 1, 9, (nz >> 1) + 1, (xx, yy) => (x % 8 === 0 || yy === 8) ? C.ink : ((x + yy) % 2 ? 0x2a2a30 : undefined));   // the low divider between the courts
      [[.2, 8 + cd * .3, -Math.PI / 2, 'shoot'], [.8, 8 + cd * .7, Math.PI / 2, 'arms'], [.25, nz - 8 - cd * .4, -Math.PI / 2, 'arms'], [.78, nz - 8 - cd * .6, Math.PI / 2, 'shoot']].forEach(([fu, z, ry, act], k) => person(A, wx(V, a0 + cw * fu), y + CV, wz(V, z), ry, act, sd + 11 + k)); }
    return y + 4;
  }
  if (kind === 'skypool') {
    // the pool box: 1.4 m deep, glass sides, a glass bottom that shows from Union Ave, cantilevered 4 m past the north face
    const a0 = cx - 4.6, a1 = cx + 4.6, b0 = z0 - 4.2, b1 = z0 + 5.4; clearParapet(a0 - .2, b0, a1 + .2, b1);
    const V = pieceVol(ctx, a0, b0, a1, b1, y, 18), nx = V.nx, nz = V.nz;
    V.box(0, 0, 0, nx, 2, nz, 0x9ff0ff, 1); V.box(0, 2, 0, 2, 16, nz, 0xbfe6ff, 1); V.box(nx - 2, 2, 0, nx, 16, nz, 0xbfe6ff, 1); V.box(0, 2, 0, nx, 16, 2, 0xbfe6ff, 1); V.box(0, 2, nz - 2, nx, 16, nz, 0xbfe6ff, 1);
    V.box(2, 2, 2, nx - 2, 14, nz - 2, (x, yy, z) => yy === 13 ? (H(x, z, 3) > .95 ? 0xbff0ff : C.water) : C.waterD, TOD.night ? 3 : 1); V.box(0, 16, 0, nx, 17, 2, C.chalk); V.box(0, 16, 0, 2, 17, nz, C.chalk); V.box(nx - 2, 16, 0, nx, 17, nz, C.chalk); V.box(0, 16, nz - 2, nx, 17, nz, C.chalk);
    for (let k = 0; k < 4; k++) V.box(8 + k * 22, 0, 0, 10 + k * 22, 1, nz, 0x17171b);   // the steel ribs under the glass
    // the roof deck behind it: teak, loungers, a couple in the water
    const D = pieceVol(ctx, x0 + ins, b1 + .1, x1 - ins, z1 - ins, y, 1, true); D.box(0, 0, 0, D.nx, 1, D.nz, (x) => x % 6 === 0 ? 0xc9c5bd : 0xe2ded6);   // pale stone decking: part of the roof, not a panel
    for (let k = 0; k < 3; k++) ctx.put(lawnChair([C.rasp, C.chalk, C.rasp][k]), wx(D, 14 + k * 12), wz(D, 16), { y: y + CV, rot: 2, slide: [1, 0], reach: .6 });
    person(A, cx - 1.5, y + 1.1, z0 - 1.5, 2.8, 'soak', sd + 11); person(A, cx + 1.2, y + 1.1, z0 - 2.6, 3.4, 'soak', sd + 12); person(A, wx(D, 30), y + CV, wz(D, 30), 0, 'phone', sd + 13);
    return y + 2;
  }
  if (kind === 'skydeck') {
    // the sky deck (the Edge): a triangle of deck cantilevered 5.4 m off the south face, flush with the roof (the parapet opens onto it),
    // pale decking with a white edge, a glass rail down both sloped sides to the point, three steel struts under it back to the facade
    // (it starts 0.2 m out, clear of the facade's trims), a party on it
    const b0 = z1 + .2, b1 = z1 + 5.6, a0 = cx - 5.2, a1 = cx + 5.2, yb = y - 3.2, fl = 29;   // floor rows 29–31: y − 0.3 … y
    clearParapet(cx - 2.6, z1 - .4, cx + 2.6, z1 + .01);
    const V = pieceVol(ctx, a0, b0, a1, b1, yb, 45, true), nx = V.nx, nz = V.nz, half = z => (nx / 2) * (1 - z / nz);
    for (let z = 0; z < nz; z++) { const h = half(z); if (h < 1) continue; const l = Math.round(nx / 2 - h), r = Math.round(nx / 2 + h);
      const tip = z > nz * .55;   // the glass floor at the point, a white grid
      V.box(l, fl, z, r, fl + 3, z + 1, (x, yy) => (x <= l + 1 || x >= r - 2) ? C.chalk : yy === fl ? C.iron : tip ? ((x % 6 === 0 || z % 6 === 0) ? C.chalk : 0x9fe8ff) : (x % 6 === 0 ? 0xc9c5bd : 0xe2ded6), tip ? 1 : 0);
      if (z > 3) for (const x of [l, l + 1, r - 2, r - 1]) { V.box(x, fl + 3, z, x + 1, fl + 14, z + 1, 0xbfe6ff, 1); V.set(x, fl + 14, z, C.chalk); } }   // a 0.2 m glass wall, a white cap
    for (const [sx, ze] of [[-26, .42], [0, .72], [26, .42]]) for (let t = 0; t <= fl; t++) { const x = Math.round(nx / 2 + sx * (1 - t / fl * .25)), z = Math.round((t / fl) * nz * ze); V.box(x - 1, t, z, x + 1, t + 1, z + 2, C.iron); }   // (each ends under the deck, inside its edges)
    const yd = y + CV * 0; [[-2.2, 1.2, 'dance'], [1.0, 1.2, 'dance'], [-.8, 2.5, 'phone'], [1.6, 2.3, 'dance']].forEach(([dx, dz, act], k) => person(A, cx + dx, yd, b0 + dz, k * 1.4 + .5, act, sd + 20 + k));
    ctx.put(speaker(), cx - 3.6, b0 + .6, { y: yd, rot: 0, slide: [1, 0], reach: .5 });
    return y + 1.3;
  }
  if (kind === 'helipad') return y;   // the OFFSHORE hero draws it
  return y;
}
function cabana(ctx, V, a, b, T, y, k) { const c1 = [T.wall, C.chalk], s = ctx.A;
  for (let z = b; z < b + 20; z++) for (let x = a; x < a + 20; x++) { const e = x === a || x === a + 19 || z === b || z === b + 19; if (e && (x - a) % 19 === 0 && (z - b) % 19 === 0) V.box(x, 1, z, x + 1, 22, z + 1, C.chalk); }
  for (let t = 0; t < 5; t++) V.box(a - 1 + t, 22 + t, b - 1 + t, a + 21 - t, 23 + t, b + 21 - t, (x) => ((x >> 2) & 1) ? c1[0] : c1[1]);
  for (let z = b + 1; z < b + 19; z += 2) V.box(a, 12, z, a + 1, 22, z + 1, (x, yy) => ((yy >> 2) & 1) ? c1[0] : c1[1]); V.box(a + 4, 1, b + 4, a + 16, 4, b + 16, C.chalk); V.box(a + 4, 4, b + 4, a + 16, 5, b + 16, k % 2 ? C.pink : C.yellow); }
function orangery(ctx, P, V, y) { const nx = V.nx, nz = V.nz, a0 = 14, b0 = 12, a1 = nx - 14, b1 = nz - 12, H2 = 26, FR = C.chalk, GL = 0xcdefff;
  const W = pieceVol(ctx, V.org[0] + a0 * CV, V.org[2] + b0 * CV, V.org[0] + a1 * CV, V.org[2] + b1 * CV, y + CV, 40), n2 = W.nx, m2 = W.nz;
  for (let x = 0; x < n2; x++) for (let z = 0; z < m2; z++) { const e = x === 0 || x === n2 - 1 || z === 0 || z === m2 - 1; if (!e) continue; const post = x % 10 === 0 || z % 10 === 0 || x === n2 - 1 || z === m2 - 1;
    W.box(x, 0, z, x + 1, H2, z + 1, (xx, yy) => post || yy === 0 || yy === H2 - 1 || yy === 12 ? FR : GL, post ? 0 : 1); }
  const half = m2 >> 1; for (let k = 0; k < half; k++) { const yy = H2 + Math.round(k * .7); W.box(0, yy, k, n2, yy + 1, k + 1, (x) => x % 10 === 0 ? FR : (k % 3 === 0 ? FR : GL), 1); W.box(0, yy, m2 - 1 - k, n2, yy + 1, m2 - k, (x) => x % 10 === 0 ? FR : (k % 3 === 0 ? FR : GL), 1); }
  W.box(0, H2, half - 1, n2, H2 + Math.round(half * .7) + 1, half + 1, FR);
  for (let k = 0; k < 5; k++) { const tx = 8 + ((k * (n2 - 16)) / 4) | 0, tz = k % 2 ? 10 : m2 - 11; W.box(tx - 2, 0, tz - 2, tx + 3, 4, tz + 3, 0xd9643a); W.box(tx, 4, tz, tx + 1, 10, tz + 1, C.trunk);
    W.box(tx - 3, 10, tz - 3, tx + 4, 17, tz + 4, (x, yy, z) => ((x * 7 + yy * 3 + z * 5) % 9 === 0) ? C.orange : ((x + yy + z) % 4 === 0 ? C.leafD : C.leaf)); }
  W.box(4, 0, half - 3, n2 - 4, 7, half + 3, 0x8b5a2b); W.box(3, 7, half - 4, n2 - 3, 8, half + 4, C.chalk);   // the dining table
  person(ctx.A, V.org[0] + (a0 + n2 * .3) * CV, y + CV + CV, V.org[2] + (b0 + half + 5) * CV, Math.PI, 'talk', P.seed + 30); person(ctx.A, V.org[0] + (a0 + n2 * .55) * CV, y + CV + CV, V.org[2] + (b0 + half - 5) * CV, 0, 'arms', P.seed + 31); }
export const waterTower = () => memo('wtank', () => { const V = pv(36, 84, 36), c = 18; for (const [x, z] of [[8, 8], [27, 8], [8, 27], [27, 27]]) V.box(x, 0, z, x + 2, 30, z + 2, C.iron);
  for (let y = 6; y < 30; y += 12) { V.box(8, y, 8, 29, y + 1, 9, C.iron); V.box(8, y, 27, 29, y + 1, 28, C.iron); V.box(8, y, 8, 9, y + 1, 29, C.iron); V.box(27, y, 8, 28, y + 1, 29, C.iron); }
  V.box(6, 30, 6, 31, 32, 31, C.iron); cyl(V, c, c, 13, 32, 66, (x, y) => y % 6 === 0 ? 0x6e3e19 : (x % 3 === 0 ? 0x8b5a2b : 0xa4652f)); for (let k = 0; k < 12; k++) cyl(V, c, c, 14 - k * 1.2, 66 + k, 67 + k, 0x6e3e19);
  V.box(c, 78, c, c + 1, 84, c + 1, C.iron); for (let y = 36; y < 66; y += 10) cyl(V, c, c, 13.5, y, y + 1, (x, yy, z) => Math.hypot(x + .5 - c, z + .5 - c) > 13 ? C.iron : undefined);
  return done(V, 'water-tower'); });

// ── the entry: draw a tower's top (after the shaft is filled, before it is meshed). Returns the highest point (world y).
export function crownOf(ctx, P, T, sh) {
  const cr = T.crown, rf = T.roof, top = topOf(P), V = sh.V, X = x => Math.round((x - V.org[0]) / S2), Z = z => Math.round((z - V.org[2]) / S2), yv = Math.round((top.y - V.org[1]) / S2);
  let hi = top.y + 1; const o = { wall: T.wall, trim: T.trim, accent: T.accent, col: cr?.col, spire: cr?.spire, h: cr?.h };
  const vr = r => [X(r[0]), Z(r[1]), X(r[2]), Z(r[3])];
  if (cr) for (const R of top.rects) { const r = vr(R); let yy = null;
    if (cr.kind === 'temple') yy = temple(V, r, yv, o); else if (cr.kind === 'cupolas') yy = cupola(V, r, yv, o); else if (cr.kind === 'sunburst') yy = sunburst(V, r, yv, o);
    else if (cr.kind === 'feather') yy = feather(V, r, yv, o); else if (cr.kind === 'mech') yy = mech(V, r, yv, o);
    if (yy !== null) hi = Math.max(hi, V.org[1] + yy * S2); }
  // roof pieces sit on the top (the pencil's on its open crown)
  const kind = rf?.kind || (cr && ['skypool', 'cabanas', 'palmpool', 'skydeck', 'helipad'].includes(cr.kind) ? cr.kind : null);
  if (kind) { const R = top.rects[0], y = cr?.kind === 'mech' ? hi : top.y; hi = Math.max(hi, roofPiece(ctx, P, T, kind, R, y, V)); }
  podRoof(ctx, P, T); terraces(ctx, P, T);
  REG.group('tower');
  return { top: hi, roofY: top.y };
}
// ── the podium's roof: amenity strips either side of the tower (a lap pool, a lawn with trees, planters), colour between the towers
function podRoof(ctx, P, T) {
  const A = ctx.A; REG.group('podium');
  for (const S of podStrips(P.i, P.j, T)) { const { x0, x1, z0, z1, k, kind } = S, y = SIDE + S.y;
    if (kind === 'bill') { const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, rot = k ? 1 : 3, r = roofBillboard(P.seed + 5, { giant: true, flip: false, at: [cx, cz] }), p = ctx.put(r.bank, cx, cz, { y, rot, slide: [0, 1], reach: 2 });
      if (p) { const gx = k ? .45 : -.45, gz = k ? -2.2 : 2.2; (A.giants ??= []).push({ x: p[0] + gx, z: p[1] + gz, y: y + 1.8, rot, seed: P.seed + 5, look: giantLook(r.design, P.seed + 5) }); } continue; }
    if (kind === 'lap') { const V = pieceVol(ctx, x0, z0, x1, z1, y, 2, true), nx = V.nx, nz = V.nz; V.box(0, 0, 0, nx, 1, nz, (x) => x % 4 === 0 ? 0x8b5a2b : 0xa4652f);
      const a0 = Math.round((nx - 18) / 2); pool(V, a0, 10, a0 + 18, nz - 10, C.chalk); person(A, wx(V, a0 + 9), y + 1.0, wz(V, nz * (.3 + .4 * H(P.seed, k))), 0, 'soak', P.seed + 80 + k); }
    else if (kind === 'lawn') { const V = pieceVol(ctx, x0, z0, x1, z1, y, 1, true), nx = V.nx, nz = V.nz; V.box(0, 0, 0, nx, 1, nz, (x, yy, z) => ((z / 8) | 0) % 2 ? C.grass : C.grassD);
      for (let t = 0; t < 3; t++) ctx.put(cubeTree((P.seed + t) % 3), (x0 + x1) / 2, z0 + 2.4 + t * (z1 - z0 - 4.8) / 2, { y: y + CV, slide: [0, 1], reach: 1 }); }
    else { const V = pieceVol(ctx, x0, z0, x1, z1, y, 7, true), nx = V.nx, nz = V.nz; V.box(0, 0, 0, nx, 1, nz, 0xcfc9bd);
      for (let z = 6; z + 14 < nz; z += 24) { V.box(2, 1, z, nx - 2, 5, z + 14, 0x9a948a); V.box(3, 5, z + 1, nx - 3, 7, z + 13, (x, yy, zz) => ((x + zz + yy) % 3 === 0) ? C.leafD : C.leaf); } } }
  REG.group('roof');
}
// ── the setback terraces: small cubic trees at the corners of a terrace marked 'trees'
function terraces(ctx, P, T) {
  const st = P.st;
  st.tiers.forEach((t, k) => { if (t.terr !== 'trees' || k === 0) return; const low = st.tiers[k - 1], y = SIDE + low.y1;
    for (const R of low.rects.map(r => P.rectW(r))) for (const U of t.rects.map(r => P.rectW(r))) {
      const spots = [[(R[0] + U[0]) / 2, (R[1] + U[1]) / 2], [(R[2] + U[2]) / 2, (R[1] + U[1]) / 2], [(R[0] + U[0]) / 2, (R[3] + U[3]) / 2], [(R[2] + U[2]) / 2, (R[3] + U[3]) / 2]];
      spots.forEach(([x, z], q) => { if (Math.min(U[0] - R[0], R[2] - U[2], U[1] - R[1], R[3] - U[3]) < .5) return; ctx.put(cubeTree((q + k) % 3), x, z, { y, slide: [1, 0], reach: .4 }); }); } });
}

// ── the far tier: the same tops as 0.5-cube blobs (box(x0, y0, z0, x1, y1, z1, colour) in world metres, y from the slab)
export function crownFar(T, st, L, box) {
  const t = st.tiers[st.tiers.length - 1], y = st.top, cr = T.crown, rf = T.roof, N = TOD.night, gl = N ? 3 : 0;
  for (const r of t.rects) { const [a, b, c, d] = [L.X0 + r[0], L.Z0 + r[1], L.X0 + r[2], L.Z0 + r[3]], cx = (a + c) / 2, cz = (b + d) / 2, w = c - a, dd = d - b;
    if (cr?.kind === 'temple') { box(a + 1, y, b + 1, c - 1, y + 4, d - 1, N ? C.litLo : T.wall, gl); for (let k = 0; k < 4; k++) box(a + 1 + k, y + 4 + k * .5, b + 1 + k, c - 1 - k, y + 4.5 + k * .5, d - 1 - k, cr.col, gl); box(cx - .5, y + 6, cz - .5, cx + .5, y + 9, cz + .5, C.gold, gl); }
    if (cr?.kind === 'cupolas') { box(a + 1, y, b + 1, c - 1, y + 3, d - 1, N ? C.litLo : T.wall, gl); box(a + 1.5, y + 3, b + 1, c - 1.5, y + 4.5, d - 1, cr.col, gl); box(cx - 1.5, y + 4.5, cz - 1, cx + 1.5, y + 6, cz + 1, cr.col, gl); box(cx - .25, y + 6, cz - .25, cx + .25, y + 8, cz + .25, C.gold, gl); }
    if (cr?.kind === 'sunburst') { for (let k = 0; k < 3; k++) box(a + .5 + k * .8, y + k * 2.6, b + .5 + k * .8, c - .5 - k * .8, y + (k + 1) * 2.6, d - .5 - k * .8, k % 2 ? C.gold : C.goldD, gl); box(cx - .5, y + 7.8, cz - .5, cx + .5, y + 7.8 + (cr.spire ?? 18), cz + .5, 0xc9ced6); }
    if (cr?.kind === 'feather') for (let x = a; x < c; x += 1) box(x, y, b - .2, x + .5, y + Math.max(.6, (cr.h ?? 8) * (1 - Math.abs((x - cx) / (w / 2)) * .55)), b + .3, T.accent, 0);
    if (cr?.kind === 'mech') { box(a, y, b, c, y + 6, d, T.wall); box(a + .5, y + .5, b - .01, c - .5, y + 2.5, d + .01, N ? 0xfff0d0 : 0x9fdcff, gl); box(a + .5, y + 3.5, b - .01, c - .5, y + 5.5, d + .01, N ? 0xfff0d0 : 0x9fdcff, gl); box(a, y + 6, b, c, y + 6.5, d, T.wall); }
    const k2 = rf?.kind || cr?.kind, y2 = cr?.kind === 'mech' ? y + 6.5 : y;
    if (k2 === 'infinity' || k2 === 'palmpool') { box(a + 1, y2, b + 1, c - 1, y2 + .4, d - 1, 0xf2efe6); box(a + 2, y2 + .2, b + 2, c - 2, y2 + .5, d - 3, C.water, gl); if (k2 === 'palmpool') for (const [x, z] of [[a + 1.5, b + 1.5], [c - 1.5, b + 1.5], [a + 1.5, d - 1.5], [c - 1.5, d - 1.5]]) box(x - 1, y2 + 3.5, z - 1, x + 1, y2 + 4.5, z + 1, C.leaf); }
    if (k2 === 'cabanas') { box(a + 1, y2, b + 1, c - 1, y2 + .3, d - 1, 0xa4652f); box(c - 3.5, y2, b + 1, c - 1, y2 + 2.6, d - 2, T.wall); box(a + 2, y2 + .2, b + 2.5, a + 5, y2 + .5, b + 5.5, C.water, gl); }
    if (k2 === 'garden' || k2 === 'forest') { box(a + 1, y2, b + 1, c - 1, y2 + .3, d - 1, C.grass); for (let k = 0; k < (k2 === 'forest' ? 6 : 3); k++) { const x = a + 2 + H(k, 3) * (w - 4), z = b + 2 + H(k, 5) * (dd - 4); box(x - 1, y2 + 1.5, z - 1, x + 1, y2 + 4, z + 1, C.leaf); } }
    if (k2 === 'orangery') { box(a + 2, y2, b + 2, c - 2, y2 + 3.2, d - 2, N ? C.litLo : 0xcdefff, gl); box(a + 2, y2 + 3.2, cz - .5, c - 2, y2 + 4, cz + .5, C.chalk); }
    if (k2 === 'tank') { box(cx + 1, y2, cz - 3, cx + 5, y2 + 3, cz + 1, C.iron); box(cx + 1.4, y2 + 3.2, cz - 2.6, cx + 4.6, y2 + 6.6, cz + .6, 0xa4652f); box(cx + 2, y2 + 6.6, cz - 2, cx + 4, y2 + 7.6, cz, 0x6e3e19); }
    if (k2 === 'tennis') { box(a + .5, y2, b + .5, c - .5, y2 + .3, d - .5, 0x1f6a3a); box(cx - 6.7, y2 + .1, cz - 3, cx + 6.7, y2 + .4, cz + 3, C.clay); box(cx - .25, y2 + .1, cz - 3.4, cx + .25, y2 + 1, cz + 3.4, C.chalk);
      for (const z of [b + .5, d - 1]) box(a + .5, y2, z, c - .5, y2 + 2, z + .5, 0x1f5a34); for (const x of [a + .5, c - 1]) box(x, y2, b + .5, x + .5, y2 + 2, d - .5, 0x1f5a34); }
    if (k2 === 'pickleball') { box(a + .5, y2, b + .5, c - .5, y2 + .3, d - .5, C.pink); for (const z0 of [b + 1.3, d - 1.3 - 4.7]) { box(cx - 5.2, y2 + .1, z0, cx + 5.2, y2 + .4, z0 + 4.7, C.blue); box(cx - 1.6, y2 + .1, z0, cx + 1.6, y2 + .5, z0 + 4.7, 0x6cff4a); } }
    if (k2 === 'skypool') box(cx - 4.6, y, b - 4.2, cx + 4.6, y + 1.6, b + 5.4, C.water, gl);
    if (k2 === 'skydeck') { box(cx - 5, y - .5, d + .2, cx + 5, y, d + 2.4, 0xe2ded6); box(cx - 3, y - .5, d + 2.4, cx + 3, y, d + 4, 0xe2ded6); box(cx - 1.2, y - .5, d + 4, cx + 1.2, y, d + 5.2, 0xe2ded6); }
    if (k2 === 'helipad') { box(cx - 6, y + .5, cz - 6, cx + 6, y + 1.2, cz + 6, 0x3a3d45); box(cx - 1.5, y + 1.2, cz - 3, cx - .5, y + 1.3, cz + 3, C.yellow); box(cx + .5, y + 1.2, cz - 3, cx + 1.5, y + 1.3, cz + 3, C.yellow); box(cx - .5, y + 1.2, cz - .5, cx + .5, y + 1.3, cz + .5, C.yellow); box(cx - 1, y + 1.2, cz + 3.5, cx + 1.5, y + 3, cz + 8, 0x17171b); }
    if (T.hero && T.name === 'SOLITAIRE') { box(cx - 3, y, cz - 1.8, cx + 3, y + 1.2, cz + 2.6, 0x17171b); box(cx - 3.2, y + 1.2, cz + .2, cx + 3.2, y + 7.4, cz + 1.2, C.gold, gl); box(cx - 1.8, y + 7.4, cz - .5, cx + 1.8, y + 9.2, cz + 1.9, 0xdff8ff, N ? 3 : 1); }
  }
}
