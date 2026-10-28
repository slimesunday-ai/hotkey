// THE SUPPLY SIDE · roofs (owner: the supply agent). Flat roofs stay calm and neutral: a stair bulkhead, rows of factory skylights,
// vents and a condenser or two, drawn straight into the building's own volume (a kit's strict placement refuses stamps on roofs).
// The colour of a block's skyline lives in 1–2 set pieces, each its own volume standing on the roof: painted roof numbers read
// from the air, a bold cooling tower, a shipping container turned roof office, a grow-op greenhouse, a court painted for the lunch
// break, a pigeon coop. far() draws the same pieces as blobs (farPiece).
import { TOD } from '../../kit.js';
import { C, PAL, CV, SIDE, REG, H, pickH, shade, hash, cyl, px, impact, vtext, inkOn } from './lib.js';

// the roof interior of a ctx.building volume: voxel rect inside the parapet (B from ctx.building, H in voxels)
const inner = (B, t = 3) => ({ x0: B.x0 + t, x1: B.x1 - t, z0: B.z0 + t, z1: B.z1 - t });
// the set piece footprint (world rect) on a roof rect, so the clutter keeps out of it
export function pieceRect(p, r) { const W = r[2] - r[0], D = r[3] - r[1], cx = (r[0] + r[2]) / 2, cz = (r[1] + r[3]) / 2, box = (w, d) => [cx - Math.min(W - .6, w) / 2, cz - Math.min(D - .6, d) / 2, cx + Math.min(W - .6, w) / 2, cz + Math.min(D - .6, d) / 2];
  const ax = W >= D; switch (p.kind) { case 'letters': return box(W - 1.2, D - 1.2); case 'cooler': return box(3.6, 3.6); case 'boxoffice': return ax ? box(6.6, 3.0) : box(3.0, 6.6); case 'grow': return ax ? box(6.0, 4.2) : box(4.2, 6.0);
    case 'hoops': return box(Math.min(W - 1.4, 11), Math.min(D - 1.4, 7.5)); case 'coop': return box(3.4, 2.6); } return box(3, 3); }
// calm clutter in the building's own volume: bulkhead, skylights, vents, condensers; skips the piece rect
export function roofKit(b, s, pr) {
  const V = b.V, B = b.B, Hv = b.H ?? Math.round((b.top - SIDE) / CV), I = inner(B), s0 = s.seed, wx = x => V.org[0] + (x + .5) * V.s, wz = z => V.org[2] + (z + .5) * V.s;
  const occ = new Set(), free = (x0, z0, x1, z1) => { for (let x = x0 - 3; x < x1 + 3; x++) for (let z = z0 - 3; z < z1 + 3; z++) { if (occ.has(x * 4096 + z)) return false; if (pr && wx(x) > pr[0] - .3 && wx(x) < pr[2] + .3 && wz(z) > pr[1] - .3 && wz(z) < pr[3] + .3) return false; } return true; };
  const take = (x0, z0, x1, z1) => { for (let x = x0; x < x1; x++) for (let z = z0; z < z1; z++) occ.add(x * 4096 + z); };
  const place = (w, d, f, tries = 12, k = 0) => { for (let t = 0; t < tries; t++) { const x0 = I.x0 + Math.floor(hash(s0, t, 31 + k) * Math.max(1, I.x1 - I.x0 - w)), z0 = I.z0 + Math.floor(hash(s0, t, 37 + k) * Math.max(1, I.z1 - I.z0 - d));
    if (x0 + w > I.x1 || z0 + d > I.z1) continue; if (!free(x0, z0, x0 + w, z0 + d)) continue; take(x0, z0, x0 + w, z0 + d); f(x0, z0); return true; } return false; };
  const y = Hv, bulk = pickH([0xd6d2ca, 0xc4c0b8, 0xb0aca5, 0xe4e1da], s0, 1);
  place(22, 20, (x, z) => { V.box(x, y, z, x + 22, y + 24, z + 20, bulk); V.box(x - 1, y + 24, z - 1, x + 23, y + 26, z + 21, shade(bulk, .8)); V.box(x + 7, y, z + 19, x + 15, y + 20, z + 20, C.steelD); });
  const nSky = (I.x1 - I.x0) * (I.z1 - I.z0) > 12000 ? 3 + (s0 % 3) : 1;                                                          // factory skylights: raised glass ridges
  for (let k = 0; k < nSky; k++) place(26, 14, (x, z) => { V.box(x, y, z, x + 26, y + 3, z + 14, C.concL); for (let t = 0; t < 4; t++) V.box(x + 1 + t, y + 3 + t, z + 1 + t, x + 25 - t, y + 4 + t, z + 13 - t, (xx) => (xx - x) % 6 === 0 ? C.steelD : TOD.night && hash(x, z, 5) > .5 ? 0xffe2a0 : 0xa8cde6, TOD.night && hash(x, z, 5) > .5 ? 3 : 1); }, 16, k * 7);
  for (let k = 0, n = 1 + (s0 % 3); k < n; k++) place(15, 11, (x, z) => { V.box(x, y, z, x + 15, y + 9, z + 11, 0xe6e6ea); V.box(x + 1, y + 9, z + 1, x + 14, y + 10, z + 10, 0xbdbdc4); cyl(V, x + 7.5, z + 5.5, 3.5, y + 10, y + 11, 0x55555e); }, 12, 50 + k);
  for (let k = 0, n = 2 + (s0 % 3); k < n; k++) place(5, 5, (x, z) => { cyl(V, x + 2.5, z + 2.5, 2, y, y + 12, 0xc9ced6, 2); V.box(x, y + 12, z, x + 5, y + 14, z + 5, 0xc9ced6, 2); }, 10, 80 + k);
  if ((s.st ?? 0) >= 5) place(28, 28, (x, z) => { const cx = x + 14, cz = z + 14; for (const [dx, dz] of [[-8, -8], [7, -8], [-8, 7], [7, 7]]) V.box(cx + dx, y, cz + dz, cx + dx + 2, y + 16, cz + dz + 2, PAL.iron);   // the wooden water tank (5+ storeys only)
    V.box(cx - 11, y + 16, cz - 11, cx + 11, y + 17, cz + 11, PAL.iron); cyl(V, cx, cz, 10, y + 17, y + 40, (xx, yy) => (yy - y) % 7 === 0 ? C.woodD : C.wood); for (let k = 0; k < 7; k++) cyl(V, cx, cz, Math.max(1, 10 - k * 1.6), y + 40 + k, y + 41 + k, C.woodD); }, 12, 90);
}

// ── set pieces: each its own volume on the roof (world rect r, roof surface y0 in metres)
export function roofPiece(ctx, p, r, y0) {
  const x0 = r[0], z0 = r[1], nx = Math.max(2, Math.round((r[2] - r[0]) / CV)), nz = Math.max(2, Math.round((r[3] - r[1]) / CV)), col = p.col, s = p.seed;
  const vol = hy => ctx.volume(x0, y0, z0, x0 + nx * CV, y0 + hy * CV, z0 + nz * CV, {});
  if (p.kind === 'letters') { // roof numbers: painted onto a thin coat laid on the membrane (no audit text record: it faces the sky)
    const V = vol(1), M = impact(p.text, 36), sc = Math.max(1, Math.min(Math.floor((nx - 8) / M.w), Math.floor((nz - 8) / M.h))), W = M.w * sc, Hh = M.h * sc, ox = (nx - W) >> 1, oz = (nz - Hh) >> 1;
    for (let j = 0; j < M.h; j++) for (let i = 0; i < M.w; i++) if (M.at(i, j)) V.box(ox + i * sc, 0, oz + j * sc, ox + (i + 1) * sc, 1, oz + (j + 1) * sc, col);
    for (let x = ox - 4; x < ox + W + 4; x++) for (const z of [oz - 5, oz + Hh + 4]) if (x >= 0 && x < nx && z >= 0 && z < nz && (x >> 2) % 2 === 0) V.set(x, 0, z, col);   // a dashed frame
    return; }
  if (p.kind === 'cooler') { const V = vol(34), c = col; V.box(2, 0, 2, nx - 2, 3, nz - 2, C.steelD); V.box(3, 3, 3, nx - 3, 26, nz - 3, (x, y, z) => ((x + z) % 3 === 0 && y > 6 && y < 22) ? shade(c, .72) : c);
    V.box(2, 26, 2, nx - 2, 28, nz - 2, shade(c, .8)); cyl(V, nx / 2, nz / 2, Math.min(nx, nz) / 2 - 5, 28, 33, shade(c, .9)); cyl(V, nx / 2, nz / 2, Math.min(nx, nz) / 2 - 7, 32, 33, C.ink); return; }
  if (p.kind === 'boxoffice') { const V = vol(34), ax = nx >= nz, L = ax ? nx : nz, Wd = ax ? nz : nx, set = (a, y, d, c, l = 0) => ax ? V.set(a, y, d, c, l) : V.set(d, y, a, c, l);
    const boxA = (a0, y0b, d0, a1, y1, d1, c, l = 0) => { for (let a = a0; a < a1; a++) for (let y = y0b; y < y1; y++) for (let d = d0; d < d1; d++) set(a, y, d, typeof c === 'function' ? c(a, y, d) : c, l); };
    boxA(3, 0, 3, L - 3, 2, Wd - 3, C.steelD); boxA(2, 2, 2, L - 2, 28, Wd - 2, (a, y, d) => ((a % 4 === 0) && (d === 2 || d === Wd - 3)) ? shade(col, .85) : col);
    boxA(8, 6, Wd - 3, 16, 24, Wd - 2, C.ink); boxA(22, 12, Wd - 3, 36, 22, Wd - 2, (a, y) => TOD.night ? 0xffe3a0 : (y > 18 ? PAL.glassHi : PAL.glassLo), TOD.night ? 3 : 1); boxA(L - 14, 28, 5, L - 6, 32, 11, 0xe6e6ea);
    boxA(2, 28, 2, L - 2, 29, Wd - 2, shade(col, .9)); return; }
  if (p.kind === 'grow') { const V = vol(30), glowing = TOD.night; V.box(0, 0, 0, nx, 2, nz, C.steelD);
    V.box(0, 2, 0, nx, 22, nz, (x, y, z) => (x === 0 || x === nx - 1 || z === 0 || z === nz - 1) ? ((x % 8 === 0 || z % 8 === 0 || y === 21) ? C.steelD : (glowing ? 0xff6ad5 : 0xc7f0d8)) : undefined, glowing ? 3 : 1);
    for (let k = 0; k < 6; k++) V.box(1, 22 + k, 1 + k * 2, nx - 1, 23 + k, nz - 1 - k * 2, (x) => x % 8 === 0 ? C.steelD : (glowing ? 0xff6ad5 : 0xc7f0d8), glowing ? 3 : 1);
    for (let x = 3; x < nx - 3; x += 4) for (let z = 3; z < nz - 3; z += 4) { V.box(x, 2, z, x + 2, 5, z + 2, C.wood); V.box(x - 1, 5, z - 1, x + 3, 9 + (hash(x, z, s) * 4 | 0), z + 3, 0x2fbf55); }
    return; }
  if (p.kind === 'hoops') { const V = vol(40), c = col, line = C.chalk;
    V.box(0, 0, 0, nx, 1, nz, (x, y, z) => (x === 2 || x === nx - 3 || z === 2 || z === nz - 3 || x === (nx >> 1)) ? line : (Math.hypot(x - nx / 2, z - nz / 2) < 14 && Math.hypot(x - nx / 2, z - nz / 2) > 12.8) ? line : c);
    const ax = nx >= nz; for (const e of [0, 1]) { const px2 = ax ? (e ? nx - 5 : 3) : (nx >> 1) - 1, pz = ax ? (nz >> 1) - 1 : (e ? nz - 5 : 3); V.box(px2, 1, pz, px2 + 2, 30, pz + 2, PAL.iron);
      const bx = ax ? (e ? px2 - 1 : px2 + 2) : px2 - 6, bz = ax ? pz - 6 : (e ? pz - 1 : pz + 2); if (ax) V.box(bx, 26, bz, bx + 1, 36, bz + 14, C.chalk); else V.box(bx, 26, bz, bx + 14, 36, bz + 1, C.chalk);
      if (ax) V.box(e ? bx - 4 : bx + 1, 27, bz + 5, e ? bx : bx + 5, 28, bz + 9, 0xff6a1a); else V.box(bx + 5, 27, e ? bz - 4 : bz + 1, bx + 9, 28, e ? bz : bz + 5, 0xff6a1a); }
    return; }
  if (p.kind === 'coop') { const V = vol(26), c = col; for (const [x, z] of [[1, 1], [nx - 3, 1], [1, nz - 3], [nx - 3, nz - 3]]) V.box(x, 0, z, x + 2, 8, z + 2, C.woodD);
    V.box(0, 8, 0, nx, 22, nz, (x, y, z) => (x === 0 || x === nx - 1 || z === 0 || z === nz - 1) ? ((x + y) % 4 === 0 ? shade(c, .8) : c) : undefined); V.box(0, 22, 0, nx, 24, nz, C.ink);
    V.box(4, 12, nz - 1, nx - 4, 20, nz, (x, y) => (x % 2 === 0 || y % 3 === 0) ? PAL.iron : undefined); V.box(0, 22, -0, nx, 23, nz, shade(c, .7));
    for (let k = 0; k < 7; k++) { const x = 3 + ((hash(s, k) * (nx - 6)) | 0), z = 2 + ((hash(s, k, 3) * (nz - 4)) | 0); V.box(x, 24, z, x + 2, 25, z + 1, [0x9aa0aa, 0xf4f4f0, 0x6d707a][k % 3]); V.set(x + (k & 1 ? 0 : 1), 25, z, [0x9aa0aa, 0xf4f4f0, 0x6d707a][k % 3]); }
    return; }
}
// the far tier's version of a piece: colour blobs (0.5 cubes) in world metres
export function farPiece(box, p, r, y0) { const cx = (r[0] + r[2]) / 2, cz = (r[1] + r[3]) / 2;
  if (p.kind === 'letters') { box(r[0] + .6, y0, r[1] + .6, r[2] - .6, y0 + .1, r[3] - .6, shade(p.col, .95)); return; }
  const hgt = { cooler: 3.3, boxoffice: 2.9, grow: 2.8, hoops: .1, coop: 2.4 }[p.kind] ?? 2; box(r[0], y0, r[1], r[2], y0 + hgt, r[3], p.kind === 'grow' ? 0xc7f0d8 : p.col); }
