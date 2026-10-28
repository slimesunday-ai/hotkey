// THE VIG · 1 VIG PLAZA (block −1,−2, the tower lot L2: x −28…−14, z −50…−36) · LOOK round (2026-10-06, art review item 10): the
// city's skyline anchor. A loan shark's pencil tower: the vig is the interest you pay on the interest, and here it is 216 m of it.
// A navy billionaires'-row needle in a pinstripe suit (pale stripes between the window bays) on Glasswall's money blocks, north of the
// Hall of Justice, gold bands at every fifteenth floor (the payments), four gold finials, a three-step setback crown with VIG in gold
// on its four faces, a lantern and an aircraft mast. At night the crown's
// setback edges, the letters and the lantern burn gold and the mast light red; 45% of the windows are lit.
// Heights: podium 6.6 m (0.1 cubes, like every tower) · shaft to 192 m (0.2 cubes, 12 m square, in 30 m sections) · crown to 214 m ·
// mast to 238 m. The next tallest building on the island is PARAGON in Gatehill at 127 m (with its crown): the crown roof is 1.69×,
// the lantern 1.68×+, the mast tip 1.87×. The lot keeps its id, footprint and podium registry (gen.js massPlan); only its build and
// its far massing are this file's (gen.js towerLot and far.js call in when the block override sets spec.supertall = 'vig').
import { Vol, meshVol, textMask } from '../vox.js';
import { frame, mass, win, AIR, TOD } from '../kit.js';
import { PAL, CV, SIDE, hash } from '../style.js';
import { paintRoof, roofColor } from '../roofs.js';

export const VIG = { wall: 0x1c2030, trim: 0xe7bd4a, gold2: 0xb98f2c, stripe: 0xc9ccd6, roof: 0x3d3c42, podH: 66, shaftTop: 192, c1: [192, 201, 1.6], c2: [201, 208, 3.2], c3: [208, 214, 4.8], mastTop: 238, inset: 1.0 };
const S = .2, FLR = 15;   // shaft cube, one floor in cubes (3 m)
const litWin = (a, f, side) => TOD.night && hash(a * 7 + side * 131, f, 4242) < .45;

// the shaft: one 0.2-cube section from y0 (world) for nFl floors over the rect; floor index f0 at its base (gold band every 15th)
function section(bank, x0, z0, x1, z1, y0, nFl, f0, top) {
  const W = Math.round((x1 - x0) / S), D = Math.round((z1 - z0) / S), Hh = nFl * FLR, V = new Vol(W + 4, Hh + (top ? 8 : 1), D + 4, { s: S, org: [x0 - 2 * S, y0, z0 - 2 * S], ground: false }), B = { x0: 2, z0: 2, x1: W + 2, z1: D + 2 };
  V.box(B.x0, 0, B.z0, B.x1, Hh, B.z1, VIG.wall);
  ['-z', '+z', '-x', '+x'].forEach((side, si) => { const f = frame(V, B, side), L = f.len;
    for (let k = 0; k < nFl; k++) { const fl = f0 + k, y = k * FLR;
      if (fl % 15 === 14) { f.box(0, y, 0, L, y + FLR, 1, (a, yy) => (yy - y) % 3 === 0 ? VIG.gold2 : VIG.trim); continue; }   // the payment floors: gold louvres
      for (let a = 4; a + 12 <= L - 2; a += 10) { const lit = litWin(a, fl, si);   // [pinstripe 2][glass 8] × 5 and a closing stripe: the tower wears a pinstripe suit
        f.box(a, y, 0, a + 2, y + FLR, 1, VIG.stripe); f.box(a + 2, y + 4, -1, a + 10, y + FLR, 1, AIR);
        f.box(a + 2, y + 4, -2, a + 10, y + FLR, -1, (aa, yy) => lit ? (yy - y > 10 ? PAL.litHi : PAL.litLo) : (yy - y > 11 ? PAL.glassHi : PAL.glassLo), lit ? 3 : 1); }
      f.box(L - 6, y, 0, L - 4, y + FLR, 1, VIG.stripe); } });
  if (top) { V.box(B.x0 + 1, Hh - 1, B.z0 + 1, B.x1 - 1, Hh, B.z1 - 1, VIG.roof); V.box(B.x0, Hh, B.z0, B.x1, Hh + 3, B.z1, VIG.trim, TOD.night ? 3 : 0); V.clear(B.x0 + 1, Hh, B.z0 + 1, B.x1 - 1, Hh + 3, B.z1 - 1); }   // the shaft roof's gold parapet, lit at night
  meshVol(V, bank);
}
// a crown step: a 0.2-cube box over the rect from y0 to y1 (world), its top edge a gold strip (lit at night); `deco` paints its faces
function step(bank, x0, z0, x1, z1, y0, y1, deco) {
  const W = Math.round((x1 - x0) / S), D = Math.round((z1 - z0) / S), Hh = Math.round((y1 - y0) / S), V = new Vol(W + 4, Hh + 4, D + 4, { s: S, org: [x0 - 2 * S, y0, z0 - 2 * S], ground: false }), B = { x0: 2, z0: 2, x1: W + 2, z1: D + 2 };
  V.box(B.x0, 0, B.z0, B.x1, Hh, B.z1, VIG.wall); V.box(B.x0 + 1, Hh - 1, B.z0 + 1, B.x1 - 1, Hh, B.z1 - 1, VIG.roof);
  V.box(B.x0, Hh - 2, B.z0, B.x1, Hh, B.z1, (x, y, z) => (x === B.x0 || x === B.x1 - 1 || z === B.z0 || z === B.z1 - 1) ? VIG.trim : VIG.roof, TOD.night ? 3 : 0);
  ['-z', '+z', '-x', '+x'].forEach(side => deco?.(frame(V, B, side), Hh));
  meshVol(V, bank);
}

// gen.js towerLot hands over here; helpers: { lotVol, pushDoor, fw, faceRot } (gen.js's own)
export function vigTower(bank, l, A, h) {
  const s = l.spec, podH = VIG.podH;
  // the podium (0.1): black granite, a gold band carrying 1 VIG PLAZA, lobby glass, the door on the main face
  const { V, B } = h.lotVol(l, podH + 8, CV, 4);
  mass(V, B, podH, VIG.wall, VIG.trim, l.faces, { parapet: 3 });
  l.faces.forEach((side, fi) => { const f = frame(V, B, side); f.box(0, 0, 0, f.len, 36, 2, PAL.ink); f.box(0, 27, 0, f.len, 36, 3, VIG.trim);
    for (let a = 6; a + 24 < f.len - 4; a += 30) { f.box(a, 3, -3, a + 24, 26, 3, AIR); f.box(a, 3, -4, a + 24, 26, -3, (aa, y) => y > 21 ? PAL.litHi : 0x243a6a, 1); }
    f.text(f.len >= 80 ? '1 VIG PLAZA' : 'VIG', f.len >> 1, 35, 3, 4, PAL.ink, 0, 1, 1);
    for (let a = 8; a + 13 < f.len - 6; a += 27) win(f, a, 42, 13, 17, VIG.trim, { lit: TOD.night && hash(a, fi, 77) < .5 });
    if (fi === 0) h.pushDoor(A, h.fw(f, f.len >> 1, 6), h.faceRot[side]); });
  paintRoof(V, B, podH, { col: roofColor(s), deck: null }, VIG.wall);
  meshVol(V, bank);
  // the shaft: 62 floors in sections of 10 (30 m), 1 m in from the lot
  const fx0 = l.x0 + VIG.inset, fz0 = l.z0 + VIG.inset, fx1 = l.x1 - VIG.inset, fz1 = l.z1 - VIG.inset, y0 = SIDE + podH * CV, nFl = Math.round((VIG.shaftTop - podH * CV) / 3);
  for (let f0 = 0; f0 < nFl; f0 += 10) section(bank, fx0, fz0, fx1, fz1, y0 + f0 * 3, Math.min(10, nFl - f0), f0, f0 + 10 >= nFl);
  const yTop = y0 + nFl * 3, cx = (l.x0 + l.x1) / 2, cz = (l.z0 + l.z1) / 2;
  // the crown: three setbacks; VIG in gold on the first one's four faces (lit at night), slits on the second, the lantern on top
  const r = (k) => [fx0 + k, fz0 + k, fx1 - k, fz1 - k], hg = VIG.c1[1] - VIG.c1[0], h2 = VIG.c2[1] - VIG.c2[0], h3 = VIG.c3[1] - VIG.c3[0];
  const M = textMask('VIG'), N = TOD.night;
  step(bank, ...r(VIG.c1[2]), yTop, yTop + hg, (f, Hh) => { const sc = 2, w = M.w * sc; f.box(2, 4, 0, f.len - 2, 8, 1, VIG.trim); f.mask(M, Math.round((f.len - w) / 2) & ~1, Hh - 6, -1, 1, VIG.trim, N ? 3 : 0, sc); });   // (letters flush and two cubes deep, on the even grid: they survive the mid tier's 2× downsample)
  step(bank, ...r(VIG.c2[2]), yTop + hg, yTop + hg + h2, (f, Hh) => { for (let a = 3; a + 2 <= f.len - 3; a += 5) f.box(a, 4, 0, a + 2, Hh - 6, 1, N ? PAL.litHi : PAL.glassHi, N ? 3 : 1); });
  step(bank, ...r(VIG.c3[2]), yTop + hg + h2, yTop + hg + h2 + h3, (f, Hh) => f.box(1, 3, 0, f.len - 1, Hh - 4, 1, N ? PAL.litHi : VIG.trim, N ? 3 : 0));
  // four gold finials on the shaft's parapet corners (the crown's points), their tips lit at night
  for (const [fx, fz] of [[fx0, fz0], [fx1 - .6, fz0], [fx0, fz1 - .6], [fx1 - .6, fz1 - .6]]) { const Vf = new Vol(3, 36, 3, { s: S, org: [fx, yTop + .6, fz], ground: false });   // (standing on the parapet, not in it)
    Vf.box(0, 0, 0, 3, 32, 3, VIG.trim); Vf.box(0, 32, 0, 3, 35, 3, N ? PAL.litHi : VIG.trim, N ? 3 : 0); meshVol(Vf, bank); }
  // the mast: steel, red and white bands, the red aircraft light (lit at night)
  const ym = yTop + hg + h2 + h3, MH = Math.round((VIG.mastTop - ym) / S), Vm = new Vol(5, MH + 2, 5, { s: S, org: [cx - .5, ym, cz - .5], ground: false });
  Vm.box(1, 0, 1, 4, MH - 3, 4, (x, y) => ((y / 10) | 0) % 2 ? PAL.white : PAL.red); Vm.box(1, MH - 3, 1, 4, MH, 4, PAL.red, N ? 3 : 0); meshVol(Vm, bank);
  A.roofs.push({ x: cx, z: cz, y: yTop, w: 4, d: 4, tower: true });
  return (yTop - SIDE) / CV;
}

// far.js: the same tower in 0.5 cubes inside the block's far volume (cx, cy, cz: world → cell); walls lean toward the haze like the far
// fill's (air), the crown edges and the mast light lit at night
export function vigFar(V, cx, cy, cz, l, air) {
  const N = TOD.night, wall = air(VIG.wall), gold = air(VIG.trim), gA = air(PAL.glassLo), gB = air(PAL.glassHi), stripe = air(VIG.stripe);
  const X = cx(l.x0), XX = cx(l.x1), Z = cz(l.z0), ZZ = cz(l.z1), Hp = cy(SIDE + VIG.podH * CV);
  V.box(X, 0, Z, XX, Hp, ZZ, (x, y) => y < 7 ? (y >= 5 ? PAL.ink : gA) : wall);
  const ix = cx(l.x0 + VIG.inset), ixx = cx(l.x1 - VIG.inset), iz = cz(l.z0 + VIG.inset), izz = cz(l.z1 - VIG.inset), Ht = cy(VIG.shaftTop + SIDE);
  V.box(ix, Hp, iz, ixx, Ht, izz, (x, y, z) => { const edge = x === ix || x === ixx - 1 || z === iz || z === izz - 1, fl = ((y - Hp) / 6) | 0, r = (y - Hp) % 6;
    if (fl % 15 === 14) return gold; if (!edge) return wall; const a = (x === ix || x === ixx - 1) ? z - iz : x - ix; return a % 4 === 2 ? stripe : r >= 2 && a > 0 && a < (ixx - ix) - 1 ? (r >= 4 ? gB : gA) : wall; });
  for (const [x, z] of [[ix, iz], [ixx - 1, iz], [ix, izz - 1], [ixx - 1, izz - 1]]) { V.box(x, Ht, z, x + 1, Ht + 13, z + 1, gold); V.box(x, Ht + 13, z, x + 1, Ht + 14, z + 1, gold, N ? 3 : 0); }
  let y = Ht; for (const [y0, y1, k] of [VIG.c1, VIG.c2, VIG.c3]) { const a = Math.round(k / .5), y2 = cy(y1 + SIDE);
    V.box(ix + a, y, iz + a, ixx - a, y2, izz - a, wall); V.box(ix + a, y2 - 1, iz + a, ixx - a, y2, izz - a, gold, N ? 3 : 0); y = y2; }
  const mx = cx((l.x0 + l.x1) / 2), mz = cz((l.z0 + l.z1) / 2), yt = cy(VIG.mastTop + SIDE);
  V.box(mx, y, mz, mx + 1, yt - 1, mz + 1, PAL.white); V.box(mx, yt - 1, mz, mx + 1, yt, mz + 1, PAL.red, N ? 3 : 0);
}
export const vigTopY = () => VIG.mastTop + SIDE + 1;
