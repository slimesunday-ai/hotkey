// LOW TIDE DOCKS · waterfront parts (owner: the supply agent): the quay edge (a yellow-lipped concrete coping, bollards), timber piers
// on piles a metre over the bay (tyre fenders on their faces), steps up to them, boats moored in the bay (a tug, a fishing boat), and
// guard rails where the streets run into the water. The bay is the ground plan's flat sea (y 0) north of z −256; the quay slab is 0.2
// up. Big pieces are structures (their own volumes, meshed straight into the block); the bollards are props.
import { Vol, meshVol } from '../../vox.js';
import { TOD } from '../../kit.js';
import { C, PAL, CV, SIDE, REG, hash, px } from '../industrial/lib.js';
import { mooring } from '../industrial/props.js';
import { P0, P, HS } from '../../../../world/city.js';
import { off, kerbX } from '../frame.js';
// SPREAD · the docks author in today's metres, each block's frame (the kit and its heroes build through junkyard/parts.js framed(ctx));
// what stands on the quay moves with its block. The water's edge is the city's edge (the sea's line): at a spread it lies HS m further out
// than the quay, so the boats keep to the water's edge (seaOff: today's metres → their frame place), the streets' guard rails keep to
// the water's edge and to their kerbs, and the HS m between the quay and the water is the quay's own concrete with the yellow lip at the
// new edge (zero wide at SPREAD 0)
export const seaOff = ctx => (Math.round(QUAY_Z / P0) * P - QUAY_Z) - off(ctx)[1];

export const QUAY_Z = -256;
// ── the quay edge along z −256 over x0…x1: a 0.6 m coping standing 0.1 proud of the slab with a yellow lip, bollards every ~8 m inland
export function quay(ctx, x0, x1, o = {}) {
  const n = Math.round((x1 - x0) / CV), V = ctx.volume(x0, SIDE, QUAY_Z, x0 + n * CV, SIDE + CV, QUAY_Z + .6, { walk: true }), gap = x => o.gaps?.some(([a, b]) => x >= a && x < b);
  V.box(0, 0, 0, n, 1, 6, (x, y, z) => gap(x0 + (x + .5) * CV) ? undefined : z === 0 ? C.hazard : (x % 30 === 0 ? C.concD : C.conc));
  if (HS) { const M = ctx.volume(x0, SIDE, QUAY_Z - HS, x0 + n * CV, SIDE + CV, QUAY_Z, { walk: true }), hole = x => gap(x) || o.piers?.some(([a, b]) => x >= a && x < b);   // (SPREAD: the margin to the water)
    M.box(0, 0, 0, n, 1, M.nz, (x, y, z) => hole(x0 + (x + .5) * CV) ? undefined : z === 0 ? C.hazard : (x % 30 === 0 ? C.concD : C.conc)); }
  const out = [], none = [...(o.gaps || []), ...(o.skip || [])]; if (o.bollards !== false) for (let x = x0 + 3; x < x1 - 2; x += 8) { if (none.some(([a, b]) => x > a - 1 && x < b + 1)) continue; if (ctx.put(mooring(), x, QUAY_Z + .3, { slide: [1, 0], reach: 1 })) out.push(x); }
  return out;
}
// ── a timber pier over the bay: plank deck at deckY (m), piles down into the water, curb logs on its outer edges, tyre fenders hung on
// its seaward face; x0…x1, z0…z1 in world metres (z1 = the quay line)
export function pier(ctx, x0, z0, x1, z1, deckY = 1.0, o = {}) {
  const nx = Math.round((x1 - x0) / CV), nz = Math.round((z1 - z0) / CV), dy = Math.round(deckY / CV), [sx, sz] = off(ctx), V = new Vol(nx, dy + 4, nz + 3, { s: CV, org: [x0 + sx, 0, z0 - .3 + sz], ground: false });   // (SPREAD: at the frame's place)
  const ax = nx >= nz, d0 = dy - 3, Z = z => z + 3;
  V.box(0, d0, Z(0), nx, dy, Z(nz), (x, y, z) => { const u = ax ? x : z; return y === dy - 1 ? ((u % 5 === 0) ? C.woodD : (hash(u >> 2, (ax ? z : x) >> 3, 3) > .85 ? 0xb67a3e : C.woodL)) : C.woodD; });
  for (let x = 1; x < nx - 2; x += 18) for (let z = 1; z < nz - 2; z += 18) V.box(x, 0, Z(z), x + 3, d0, Z(z + 3), 0x5a4632);                  // piles
  const edges = o.curb ?? ['-z', '-x', '+x'];
  for (const e of edges) { if (e === '-z') V.box(0, dy, Z(0), nx, dy + 2, Z(3), C.woodD); if (e === '+x') V.box(nx - 3, dy, Z(0), nx, dy + 2, Z(nz - 2), C.woodD); if (e === '-x') V.box(0, dy, Z(0), 3, dy + 2, Z(nz - 2), C.woodD); }
  for (let x = 1; x < nx - 2; x += 18) V.box(x, 0, Z(0), x + 3, dy + 3, Z(3), 0x5a4632);                                                       // the outer piles stand proud
  if (o.fenders !== false) for (let x = 9; x < nx - 6; x += 18) for (let a = 0; a < 20; a++) { const t = a / 20 * Math.PI * 2, y = d0 - 1 + Math.round(Math.sin(t) * 2.4), z = 1 + Math.round(Math.cos(t) * 1.2); V.box(x, y, z, x + 2, y + 1, z + 1, C.rubber); }
  REG.surface(V); meshVol(V, ctx.bank);
  return { top: dy * CV, x0, x1, z0, z1 };
}
// steps up from the quay slab to a pier deck: 0.2 rises, 0.3 runs, x0…x1 wide, running north from zQuay
export function steps(ctx, x0, x1, zQuay, deckY) { const n = Math.max(1, Math.round((deckY - SIDE) / .2)), nz = n * 3, V = ctx.volume(x0, SIDE, zQuay, x1, deckY, zQuay + nz * CV, { walk: true });
  for (let k = 0; k < n; k++) V.box(0, 0, 0, V.nx, Math.min(V.ny, (n - k) * 2), 3 * (k + 1), k % 2 ? C.concD : C.conc); return V; }

// ── boats. A hull is drawn through P(a, y, b, colour): a along the boat (bow at a = L − 1), b across, y up from 0.6 below the sea.
function hullP(P, L, W, Hh, o) { const mid = W / 2;
  for (let a = 0; a < L; a++) { const t = a / (L - 1), bow = t > .72 ? (t - .72) / .28 : 0, half = mid * (1 - bow * bow * .92) - (t < .04 ? 1 : 0), rise = Math.round(bow * bow * 5);
    for (let b = 0; b < W; b++) { const db = Math.abs(b + .5 - mid); if (db > half) continue; const edge = db > half - 1.5 || a === 0, top = Hh + rise;
      for (let y = 0; y < top; y++) { if (!edge && y > 3 && y !== Hh - 2) continue; const c = y < 4 ? o.bottom : (y >= top - 1 && edge) ? o.gunwale : (y >= Hh - 6 && y < Hh - 4 && edge) ? o.stripe : (y === Hh - 2 && !edge) ? o.deck : o.col; P(a, y, b, c); } } } }
// a boat volume: rot 0 = bow toward +x, 1 = +z, 2 = −x, 3 = −z; returns P (the drawing function) and a box helper in boat coordinates
function boatVol(x, z, L, W, Hgt, rot) { const S = .2, along = (rot & 1) === 0, nx = along ? L : W, nz = along ? W : L, V = new Vol(nx, Hgt, nz, { s: S, org: [x - nx * S / 2, -.6, z - nz * S / 2], ground: false });
  const P = (a, y, b, c, l = 0) => { if (a < 0 || a >= L || b < 0 || b >= W) return; if (rot === 0) V.set(a, y, b, c, l); else if (rot === 2) V.set(L - 1 - a, y, W - 1 - b, c, l); else if (rot === 1) V.set(W - 1 - b, y, a, c, l); else V.set(b, y, L - 1 - a, c, l); };
  const box = (a0, y0, b0, a1, y1, b1, c, l = 0) => { for (let a = a0; a < a1; a++) for (let y = y0; y < y1; y++) for (let b = b0; b < b1; b++) P(a, y, b, typeof c === 'function' ? c(a, y, b) : c, l); };
  return { V, P, box, S };
}
// a name on both sides of the hull, amidships (bow to the right on the starboard side, as painted)
function hullName(P, name, a0, y, W, col) { const M = px(name); for (let j = 0; j < 7; j++) for (let i = 0; i < M.w; i++) if (M.at(i, j)) { P(a0 + i, y - j, W - 1, col); P(a0 + M.w - 1 - i, y - j, 0, col); } }
const boatAt = (ctx, x, z) => { const [sx, sz] = off(ctx); return [x + sx, z + sz + seaOff(ctx)]; };   // (SPREAD: a boat keeps to the water's edge)
const finish = (ctx, V) => { REG.keep([V.org[0], -.6, V.org[2], V.org[0] + V.nx * V.s, 3, V.org[2] + V.nz * V.s], 'boat'); meshVol(V, ctx.bank); return V; };
export function tugboat(ctx, x, z, rot = 0, o = {}) {   // 14 × 5.2 m: a dark hull with a red stripe, a white house, the wheelhouse, a stack with the company band, bow fenders
  const L = 70, W = 26, Hh = 16, { V, P, box } = boatVol(...boatAt(ctx, x, z), L, W, 64, rot);
  hullP(P, L, W, Hh, { col: o.col ?? C.ink, stripe: o.stripe ?? C.red, bottom: 0x8a2a22, gunwale: C.hazard, deck: 0x6d707a });
  box(20, Hh - 1, 7, 46, Hh + 10, 19, C.chalk); box(24, Hh + 10, 8, 40, Hh + 18, 18, C.chalk);
  box(24, Hh + 13, 8, 40, Hh + 16, 18, (a, y, b) => (a % 4 === 0 || (b > 8 && b < 17 && a > 24 && a < 39)) ? C.chalk : (TOD.night ? 0xffe3a0 : PAL.glassLo), TOD.night ? 3 : 1);
  box(23, Hh + 18, 7, 41, Hh + 19, 19, C.ink); box(30, Hh + 19, 11, 36, Hh + 30, 15, o.stack ?? C.red); box(30, Hh + 24, 11, 36, Hh + 26, 15, C.chalk); box(29, Hh + 30, 10, 37, Hh + 31, 16, C.ink);
  box(8, Hh - 1, 10, 14, Hh + 2, 16, C.steelD); box(48, Hh - 1, 11, 52, Hh + 3, 15, C.steelD);
  for (let k = 0; k < 4; k++) box(60 + k * 2, 5, k % 2 ? 0 : W - 1, 62 + k * 2, 10, k % 2 ? 1 : W, C.rubber);
  if (o.name) hullName(P, o.name, 8, Hh - 3, W, C.chalk);
  return finish(ctx, V);
}
export function fishingBoat(ctx, x, z, rot = 0, o = {}) {   // 12 × 4 m: a bright hull, the cabin forward, a mast and boom aft with a net, tubs and crates on deck
  const L = 60, W = 20, Hh = 13, { V, P, box } = boatVol(...boatAt(ctx, x, z), L, W, 56, rot);
  hullP(P, L, W, Hh, { col: o.col ?? C.teal, stripe: o.stripe ?? C.hazard, bottom: 0x8a2a22, gunwale: C.chalk, deck: C.woodL });
  box(34, Hh - 1, 5, 48, Hh + 10, 15, C.chalk); box(34, Hh + 5, 5, 48, Hh + 8, 15, (a) => a % 4 === 0 ? C.chalk : (TOD.night ? 0xffe3a0 : PAL.glassLo), TOD.night ? 3 : 1); box(33, Hh + 10, 4, 49, Hh + 11, 16, o.roof ?? C.red);
  box(18, Hh - 1, 9, 20, Hh + 26, 11, C.steelD); for (let k = 0; k < 20; k++) box(4 + k, Hh + 20 - (k >> 1), 9, 5 + k, Hh + 21 - (k >> 1), 11, C.steelD);
  for (let a = 4; a < 24; a++) for (let y = Hh + 5; y < Hh + 20 - ((a - 4) >> 1); y++) if ((a + y) % 3 === 0 || a === 4 || y === Hh + 5) P(a, y, 10, 0x2a9a44);   // the net, its edge ropes
  box(6, Hh - 1, 4, 12, Hh + 3, 9, 0x2f5bff); box(6, Hh - 1, 12, 12, Hh + 2, 16, C.orange); box(24, Hh - 1, 12, 30, Hh + 2, 17, C.hazard);
  if (o.name) hullName(P, o.name, 6, Hh - 3, W, C.chalk);
  return finish(ctx, V);
}
// ── where a street runs into the water: a steel guardrail with hazard chevrons across the road end (x0…x1), just inland of z −256
export function streetEnd(ctx, x0, x1) { const [sx] = off(ctx), dz = seaOff(ctx); x0 = kerbX(x0) - sx; x1 = kerbX(x1) - sx;   // (SPREAD: across the road from kerb to kerb, at the water's edge)
  const n = Math.round((x1 - x0) / CV), V = ctx.volume(x0, 0, QUAY_Z + .1 + dz, x0 + n * CV, 1.0, QUAY_Z + .4 + dz, { keep: 'rail' });
  for (let x = 0; x < n; x += 20) V.box(x, 0, 1, x + 2, 9, 3, C.steelD); V.box(0, 5, 0, n, 8, 1, (x, y) => ((x + y * 2) >> 3) & 1 ? C.hazard : C.ink); }
