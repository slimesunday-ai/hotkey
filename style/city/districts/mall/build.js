// MILLENNIUM MALL · the builders the kit and its heroes share (owner: the Sunny Acres / Millennium Mall agent): the hollow building
// shell, the parking lots (faded stalls, cracks, weeds, oil, the planter spine with its palms, dead light poles, corrals, carts,
// burnt cars), HOLLOWAY'S — the closed west anchor with its ghost letters —, the back lot and its loading docks, the rubble field
// where the east anchor came down, the fences, and the far tier. Every block builds only what lies inside its own x/z range.
import { Vol } from '../../vox.js';
import { frame, win, AIR, TOD } from '../../kit.js';
import { REG } from '../../audit.js';
import { PAL, CV, SIDE, hash, shade } from '../../style.js';
import { txt, txtX, tw, board, air, textMask, cyl } from '../trailer/brush.js';
import { IN, MARGIN, SITE, BLD, PART, PYLON, P, blockRange } from './plan.js';
import { off, atR, atB } from '../frame.js';
import * as MP from './props.js';
import { dumpster, bags, tires, couch, trashCan, streetTree, tree, bench, carOnBlocks, tent, lawnChair, grill } from '../../props.js';
import { burnBarrel, cinder, pallets, fridge, sedan, cooler, van } from '../trailer/props.js';

const INK = PAL.ink, WHITE = PAL.white, ASPH = 0x5d5e6b, ASPH2 = 0x676874, LINE = 0xc9c7bd, WEED = 0x6fa04a, WEED2 = 0x8ab04f, CONC = 0xcfc9bd, BUFF = 0xc49a6c;
const TEAL = 0x12b3a0, PURPLE = 0x7a3cff, BONE = 0xe6e1d6;
export const lit = (day = 1) => TOD.night ? 3 : day;
const g1 = x => Math.round(x * 10) / 10;

// ── SPREAD · THE FRAME (../frame.js). The mall authors in today's metres, the compound's frame; framed(ctx) is a block's context whose
// engine calls take frame metres and hand the engine spread-world ones (volume, mass, put); a registry box goes through keep / boxOf.
// The kit and the heroes frame their ctx first; a block's own part is its frame cell (plan.js blockRange)
export function framed(ctx) { if (ctx.framed) return ctx; const [sx, sz] = off(ctx), f = Object.create(ctx); f.framed = true;
  f.volume = (x0, y0, z0, x1, y1, z1, o) => ctx.volume(x0 + sx, y0, z0 + sz, x1 + sx, y1, z1 + sz, o);
  f.mass = (V, r, o) => ctx.mass(V, atR(ctx, r), o);
  f.put = (bk, x, z, o) => { const p = ctx.put(bk, x + sx, z + sz, o); return p && [p[0] - sx, p[1] - sz]; };
  return f; }
export const keep = (ctx, box, tag) => REG.keep(atB(ctx, box), tag);

// ── a hollow building shell over a world rect (x0, z0, x1, z1), h metres: walls t voxels thick, a roof slab with a parapet, the roof
// open where `holes` say (world rects). Registers its mass. Returns { V, B, o (the volume's corner in frame metres), F(side) } to draw on (kit.js frames).
export function shell(ctx, [x0, z0, x1, z1], h, o = {}) {
  const pad = o.pad ?? 14, H = Math.round(h / CV), t = o.t ?? 3, nx = Math.round((x1 - x0) / CV), nz = Math.round((z1 - z0) / CV);
  const org = [x0 - pad * CV, SIDE, z0 - pad * CV], [sx, sz] = off(ctx);   // (SPREAD: org, the volume's corner in the frame; the volume itself sits at the frame's place)
  const V = new Vol(nx + 2 * pad, H + (o.extra ?? 24), nz + 2 * pad, { s: CV, org: [org[0] + sx, SIDE, org[2] + sz] }), B = { x0: pad, z0: pad, x1: pad + nx, z1: pad + nz };
  for (const r of o.parts ?? [[x0, z0, x1, z1]]) ctx.mass(V, r, { top: SIDE + (H + 6) * CV, roofY: SIDE + H * CV });   // (open courts are not mass)
  const wall = o.wall ?? BONE, holes = (o.holes || []).map(([a, b, c, d]) => [Math.round((a - org[0]) / CV), Math.round((b - org[2]) / CV), Math.round((c - org[0]) / CV), Math.round((d - org[2]) / CV)]);
  const inHole = (x, z) => holes.some(q => x >= q[0] && x < q[2] && z >= q[1] && z < q[3]);
  // walls (where no hole reaches the ground), roof slab, parapet
  for (let x = B.x0; x < B.x1; x++) for (let z = B.z0; z < B.z1; z++) { const edge = x < B.x0 + t || x >= B.x1 - t || z < B.z0 + t || z >= B.z1 - t;
    if (inHole(x, z)) continue;
    if (edge) V.box(x, 0, z, x + 1, H + 6, z + 1, (xx, y) => y < 4 ? shade(wall, .8) : y >= H + 4 ? shade(wall, .92) : wall);
    else { V.box(x, H - 3, z, x + 1, H, z + 1, o.roof ?? 0xd9d6ce); V.set(x, 0, z, o.floor ?? 0xcfc9bd); } }
  // the parapet's inner ring (only at the outer walls), the roof top clears back to the membrane
  for (let x = B.x0 + t; x < B.x1 - t; x++) for (let z = B.z0 + t; z < B.z1 - t; z++) if (!inHole(x, z)) V.box(x, H, z, x + 1, H + 6, z + 1, -1);
  return { V, B, H, t, o: org, F: s => frame(V, B, s), inHole };
}
// ── the cracks of a block's lot: 4–6 random walks (hashed per block), 1–2.4 m steps turning up to 40°, kept inside the lot area
const CRK = new Map();
export function crackLines(i, j) { const k = i + ',' + j; if (CRK.has(k)) return CRK.get(k); const out = [], [bx0, bz0, bx1, bz1] = blockRange(i, j), x0 = Math.max(bx0, IN.x0) + .6, x1 = Math.min(bx1, IN.x1) - .6, z0 = Math.max(bz0, IN.z0) + .6, z1 = Math.min(bz1, IN.z1) - .6;
  const inBld = (x, z) => (j === 1 && x > PART.anchor.x0 - .6 && x < PART.wing.x1 + .6 && z > BLD.z0 - 2.4 && z < BLD.z1 + .6) || (j === 0 && z > 21.8 && z < 24.2);   // (the building, the palm spine)
  for (let n = 0, q = 0; n < 6 && q < 40; q++) { const r = hash(i * 31 + q, j * 17, 77); let x = x0 + hash(q, i, 5) * (x1 - x0), z = z0 + hash(q, j, 9) * (z1 - z0), a = hash(q, 3, i * 7 + j) * 6.283; if (inBld(x, z)) continue;
    const pts = [[x, z]]; for (let s2 = 0; s2 < 6 + ((r * 5) | 0); s2++) { a += (hash(q, s2, 41) - .5) * 1.4; const L = 1 + hash(q, s2, 43) * 1.4, nx = x + Math.cos(a) * L, nz = z + Math.sin(a) * L; if (nx < x0 || nx > x1 || nz < z0 || nz > z1 || inBld(nx, nz)) break; pts.push([x = nx, z = nz]); }
    if (pts.length > 2) { out.push(pts); n++; } }
  CRK.set(k, out); return out; }
const segD = (px, pz, [ax, az], [bx, bz]) => { const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz))); return Math.hypot(px - ax - t * dx, pz - az - t * dz); };
// ── the parking lot: one voxel of old asphalt over the block's lot area (minus `skip` world rects), stall stripes, cracks and weeds
export function lot(ctx, skip = []) {
  const [bx0, bz0, bx1, bz1] = blockRange(ctx.i, ctx.j), x0 = Math.max(bx0, IN.x0), x1 = Math.min(bx1, IN.x1), z0 = Math.max(bz0, IN.z0), z1 = Math.min(bz1, IN.z1);
  if (x1 <= x0 || z1 <= z0) return null;
  const V = ctx.volume(x0, SIDE, z0, x1, SIDE + CV, z1, { walk: true }), sk = skip.map(([a, b, c, d]) => [Math.round((a - x0) / CV), Math.round((b - z0) / CV), Math.round((c - x0) / CV), Math.round((d - z0) / CV)]), CL = crackLines(ctx.i, ctx.j);
  V.box(0, 0, 0, V.nx, 1, V.nz, (x, y, z) => { for (const q of sk) if (x >= q[0] && x < q[2] && z >= q[1] && z < q[3]) return undefined;
    const wx = x0 + (x + .5) * CV, wz = z0 + (z + .5) * CV, n = hash(Math.floor(wx / 1.7), Math.floor(wz / 1.3), 41);
    // stalls: rows along x (north lot: stripes every 2.7 m in the stall bands); back lot: fainter, half worn off
    const band = (wz > 7 && wz < 12) || (wz > 18 && wz < 23) || (wz > 23.2 && wz < 28) || (wz > 70 && wz < 75) || (wz > 80.5 && wz < 86), sx = ((wx + 400) % 2.7);
    if (band && sx < .12 && hash(Math.floor(wx / 2.7), Math.floor(wz / 5), 7) > .2) return hash(x, z, 3) > .3 ? LINE : ASPH;
    if (wz > 32 && wz < 34 && wx > PART.anchor.x0 && wx < PART.wing.x1) return ((Math.floor(wx) + Math.floor(wz * 2)) & 1) ? CONC : shade(CONC, .94);   // the front walk
    if (wz > 23.2 && wz < 28 && ((wx > -216.2 && wx < -210.8) || (wx > -205.4 && wx < -200)) && sx > .12) { const lx = ((wx + 400) % 2.7) - 1.35, lz = wz - 25.6; return (Math.abs(lx) < .45 && Math.abs(lz) < .6 && !(Math.abs(lx) < .3 && Math.abs(lz) < .45)) ? WHITE : 0x2f5bff; }   // accessible stalls
    if (Math.abs(Math.sin(wx * .31 + wz * .07) * 2.2 + Math.cos(wz * .23) * 1.7 - ((wx + wz) % 7) * .1) < .05 && n > .35) return 0x4b4c57;       // cracks
    for (const pl of CL) for (let k = 1; k < pl.length; k++) { const d = segD(wx, wz, pl[k - 1], pl[k]); if (d < .09) return 0x3f404a; if (d < .22 && hash(x, z, 17) > .55) return hash(x, z, 18) > .5 ? WEED : 0x55773a; }   // the big cracks, green at the edges
    const wn = hash(Math.floor(wx / .4), Math.floor(wz / .4), 43); if (wn > .965 && n > .55) return hash(x, z, 5) > .5 ? WEED : WEED2;   // weeds, in small clumps
    if (n < .04) return 0x45464f;                                                                                                   // oil
    return n > .6 ? ASPH2 : ASPH; });
  margin(ctx);
  return V;
}
// SPREAD · THE MARGIN between the compound's edge and the streets' lot lines (plan.js MARGIN; none at SPREAD 0): the lot's old asphalt
// where the lot is open to the street, a weedy verge outside the kerb and the fences
function margin(ctx) {
  const cell = blockRange(ctx.i, ctx.j);
  for (const { k, r } of MARGIN) { const x0 = Math.max(r[0], cell[0]), z0 = Math.max(r[1], cell[1]), x1 = Math.min(r[2], cell[2]), z1 = Math.min(r[3], cell[3]); if (x1 - x0 < CV - 1e-6 || z1 - z0 < CV - 1e-6) continue;
    const V = ctx.volume(x0, SIDE, z0, x1, SIDE + CV, z1, { walk: true });
    V.box(0, 0, 0, V.nx, 1, V.nz, (x, y, z) => { const wx = x0 + (x + .5) * CV, wz = z0 + (z + .5) * CV, n = hash(Math.floor(wx / 1.7), Math.floor(wz / 1.3), 41), w = hash(Math.floor(wx / .4), Math.floor(wz / .4), 43);
      if (k === 'asph') return w > .965 && n > .55 ? WEED : n < .04 ? 0x45464f : n > .6 ? ASPH2 : ASPH;
      return w > .8 ? WEED2 : n < .18 ? (hash(x, z, 6) > .5 ? 0x7a5a32 : 0x6b4a2a) : n > .7 ? 0x5f9440 : WEED; }); }
}
// the planter spine down the middle of the north lot: a concrete kerb with dirt, weeds and a palm every 16 m (dead or alive)
export function spine(ctx) {
  const [bx0, bz0, bx1, bz1] = blockRange(ctx.i, ctx.j); if (bz0 > 23 || bz1 < 23) return;
  const x0 = Math.max(bx0 + 1.5, IN.x0 + 2), x1 = Math.min(bx1 - 1.5, IN.x1 - 2), V = ctx.volume(x0, SIDE + CV, 22.4, x1, SIDE + .4, 23.6, { walk: true, ground: false });
  V.box(0, 0, 0, V.nx, 3, V.nz, (x, y, z) => (x === 0 || z === 0 || x === V.nx - 1 || z === V.nz - 1) ? (y < 2 ? 0xa7a9b1 : CONC) : (y < 2 ? 0x6b4a2a : (hash(x, z, 9) > .6 ? WEED : 0x7a5a32)));
  ctx.finish();
  for (let x = Math.ceil((x0 + 400) / 16) * 16 - 400 + 4; x < x1 - 1; x += 16) ctx.put(MP.palm(hash(Math.round(x), 3, 5) < .55), x, 23, { rot: 0, y: SIDE + .4, slide: [1, 0], reach: 1.5 });
}
// dead light poles on a 16 m grid in the lot bands; carts, corrals and a few cars left behind (by the block's own hash)
export function lotLife(ctx, o = {}) {
  const [bx0, bz0, bx1, bz1] = blockRange(ctx.i, ctx.j), h = k => hash(ctx.i * 13 + k, ctx.j * 7, 811), P = (bk, x, z, rot = 0, ax = 1, reach = 1.4) => (x >= bx0 + .5 && x < bx1 - .5 && z >= bz0 + .5 && z < bz1 - .5) ? ctx.put(bk, x, z, { rot, slide: [ax, 1 - ax], reach }) : null;
  ctx.group('lot');
  for (const z of o.poleZ ?? [15, 30]) for (let x = Math.ceil((bx0 + 400 - 8) / 16) * 16 - 400 + 8; x < bx1; x += 16) if (x > IN.x0 + 2 && x < IN.x1 - 2) P(MP.lotLight(((x + z) / 16 | 0) + ctx.i), x, z, 0, 1, 1);
  const C = [0xe8232a, 0x2f5bff, 0xf7f7f2, 0x25b84c, 0x6d707a, 0xc49a6c, 0x17171b];
  for (const [k, [x, z, rot, what]] of (o.cars ?? []).entries()) P(what === 'burnt' ? MP.burntCar(k) : what === 'blocks' ? carOnBlocks(ctx.i + 9) : sedan(C[(h(k) * C.length) | 0], 1), x, z, rot, 1, .8);
  for (const [x, z, rot] of o.carts ?? []) P(MP.cart(hash(x, z) < .4), x, z, rot, 1, .8);
  if (o.corral) P(MP.corral(ctx.i + 8), o.corral[0], o.corral[1], o.corral[2] ?? 0, 1, 2);   // (−8: CART RETURN, −7: RETURN CARTS, −6: CARTS ONLY)
}
// weeds out of the big cracks: a clump every metre or two along each crack (where the registry says the spot is free)
export function crackWeeds(ctx) {
  const [bx0, bz0, bx1, bz1] = blockRange(ctx.i, ctx.j); ctx.group('weeds'); let n = 0;
  for (const [q, pl] of crackLines(ctx.i, ctx.j).entries()) for (let k = 1; k < pl.length; k++) { const [ax, az] = pl[k - 1], [bx, bz] = pl[k], L = Math.hypot(bx - ax, bz - az);
    for (let t = .3; t < L; t += 1.1 + hash(q, k, Math.round(t * 10)) * 1.2) { const x = ax + (bx - ax) * t / L, z = az + (bz - az) * t / L; if (x < bx0 + .4 || x > bx1 - .4 || z < bz0 + .4 || z > bz1 - .4) continue;
      const bk = MP.weeds(q + k + n), rot = (k + n) & 3, [sx, sz] = off(ctx); if (REG.why(REG.boxOf(bk, rot, x + sx, SIDE, z + sz))) continue;   // (optional: only where it is free, nothing logged)
      if (ctx.put(bk, x, z, { rot, reach: 0 })) n++; } }
}
// the camp by the Birch St fence (block −8,0): two tents, a tarp over a couch, the burn barrel, a cart of belongings, bags
export function camp(ctx) {
  ctx.group('camp'); const P = (bk, x, z, rot = 0, ax = 0, reach = .6) => ctx.put(bk, x, z, { rot, slide: [ax, 1 - ax], reach });
  P(tent(0xff7a1a), -249.6, 10.6, 1); P(tent(0x25b84c), -249.6, 14.1, 1); P(MP.tarpShelter(0x2f6bdf), -246.9, 18.6, 1);
  P(burnBarrel(), -246.3, 12.6); P(couch(0x7a3cff), -244.6, 10.4, 3); P(MP.cart(false), -245.2, 15.2, 1); P(bags(21), -250.4, 17.6, 0); P(cooler(0xe8232a), -247.8, 16.2, 1); P(MP.mattress(0x9fd8ff), -244.2, 17.8, 1);
}
// dumped by the doors (block −7,0): two dumpsters, a mattress, a couch, bags; a line of carts nobody pushed back
export function dumping(ctx) {
  ctx.group('dumping'); const P = (bk, x, z, rot = 0, ax = 1, reach = .6) => ctx.put(bk, x, z, { rot, slide: [ax, 1 - ax], reach });
  P(dumpster(0x2f7a3a), -204.6, 30.2, 2); P(dumpster(0xe8232a), -201.6, 30.2, 2); P(MP.mattress(0xf2efe6), -208.6, 30.6, 0); P(couch(0x2f5bff), -207.6, 28.4, 2); P(bags(22), -198.8, 28.6); P(bags(23), -210.8, 29.8);
  for (let k = 0; k < 5; k++) P(MP.cart(false), -219.6 + k * .95, 16.6, 1, 1, .3);
}
// a van somebody lives in (block −6,0): a camp chair, a grill, the side door open onto the lot
export function vanCamp(ctx) {
  ctx.group('van'); const P = (bk, x, z, rot = 0, ax = 0, reach = .6) => ctx.put(bk, x, z, { rot, slide: [ax, 1 - ax], reach });
  P(van(0xe6e1d6, 0x2f6bdf), -189.4, 20.4, 0); P(lawnChair(0xffc21a), -187.1, 19.2, 1); P(grill(), -187.3, 21.9, 1); P(MP.weeds(3), -187.6, 17.8, 0);
}
// a chain-link fence run on the compound edge (world line), gaps where asked; signs hang on it
export function fenceRun(ctx, ax, at, a, b, o = {}) {
  const [bx0, bz0, bx1, bz1] = blockRange(ctx.i, ctx.j), lo = Math.max(a, ax === 'x' ? bx0 : bz0), hi = Math.min(b, ax === 'x' ? bx1 : bz1); if (hi - lo < .3) return;
  if (ax === 'x' ? (at < bz0 || at >= bz1) : (at < bx0 || at >= bx1)) return;
  let segs = [[lo, hi]]; for (const [g0, g1] of o.gaps ?? []) segs = segs.flatMap(([p, q]) => g1 <= p || g0 >= q ? [[p, q]] : [[p, g0], [g1, q]].filter(([u, v]) => v - u > .3));
  for (const [p, q] of segs) { const Hh = 18, y0 = SIDE + (o.base ?? CV), V = ax === 'x' ? ctx.volume(p, y0, at, q, y0 + Hh * CV, at + CV, { keep: 'fence', ground: false }) : ctx.volume(at, y0, p, at + CV, y0 + Hh * CV, q, { keep: 'fence', ground: false }), n = ax === 'x' ? V.nx : V.nz;
    for (let k = 0; k < n; k++) { const w = p + (k + .5) * CV, post = Math.abs(((w + 400) % 3) - 1.5) > 1.42, orange = o.orange;
      for (let y = 0; y < Hh; y++) { let c = post ? 0x8f9096 : (y === Hh - 1 || y === 0) ? 0x9a9ca4 : ((k + y) & 1) ? (orange ? 0xff7a1a : 0xb9bcc4) : undefined; if (orange && !post && y > 11) c = undefined; if (orange && post && y > 12) c = undefined;
        if (c !== undefined) { if (ax === 'x') V.set(k, y, 0, c); else V.set(0, y, k, c); } } } }
}
// ── HOLLOWAY'S: the closed west anchor (block −8,1). Buff walls, a dark base, the white cornice band; the letters were taken down
// and left their shapes on the wall; a vinyl SPACE AVAILABLE banner sags across the boarded doors; dock doors at the back
export function anchor(ctx) {
  const A = PART.anchor, S = shell(ctx, [A.x0, BLD.z0, A.x1, BLD.z1], A.h, { wall: BUFF, roof: 0xd2cfc6 }), { V, B, H } = S;
  const N = S.F('-z'), W = S.F('-x'), So = S.F('+z'), E = S.F('+x');
  for (const f of [N, W, So, E]) { f.box(0, H - 8, 0, f.len, H - 5, 2, WHITE); f.box(0, 0, 0, f.len, 5, 1, 0x6e4a2e); }
  // the ghost letters: the wall stayed bright where HOLLOWAY'S hung for twenty years; the bolt holes still show
  { const s = "HOLLOWAY'S", sc = 2, t = textMask(s), w = t.w * sc, a0 = (N.len - w) >> 1, top = H - 14;
    for (let j = 0; j < 7; j++) for (let i = 0; i < t.w; i++) if (t.at(i, j)) for (let u = 0; u < sc; u++) for (let v = 0; v < sc; v++) N.set(a0 + i * sc + u, top - j * sc - v, 0, shade(BUFF, 1.18));
    for (let i = 0; i < t.w; i += 3) N.set(a0 + i * sc + 1, top - 7, 1, 0x3a3330); }
  // the boarded entrance and the banner over it
  const ea = (N.len >> 1) - 20; N.box(ea - 2, 0, 0, ea + 42, 30, 2, 0x3a3d45); N.box(ea, 1, -1, ea + 40, 28, 2, AIR); N.box(ea, 1, -1, ea + 40, 28, 0, (a, y) => (((a / 10) | 0) + ((y / 14) | 0)) & 1 ? 0xc8a46a : 0xb89156);
  N.box(ea - 6, 30, 0, ea + 46, 34, 6, 0x9a9ca4); for (let d = 0; d < 6; d++) N.set(ea - 6, 29 - d, d, 0x9a9ca4);
  { const s1 = 'SPACE', s2 = 'AVAILABLE', w = tw(s2) + 8, a0 = (N.len >> 1) - (w >> 1); N.box(a0, 40, 1, a0 + w, 58, 2, WHITE); N.box(a0, 40, 1, a0 + w, 41, 2, 0xe8232a); N.box(a0, 57, 1, a0 + w, 58, 2, 0xe8232a);
    N.text(s1, N.len >> 1, 56, 2, 3, 0xe8232a, 0, 1, 1); N.text(s2, N.len >> 1, 48, 2, 3, INK, 0, 1, 1); for (let a = a0 + w - 6; a < a0 + w; a++) N.set(a, 39 - ((a - a0 - w + 6) >> 1), 1, WHITE); }
  // the side and the back: a painted stripe, two dock doors (one rolled half up, dark inside), bumpers
  W.box(0, 30, 0, W.len, 33, 1, TEAL); So.box(0, 30, 0, So.len, 33, 1, TEAL);
  for (const [a, open] of [[40, false], [120, true]]) { So.box(a - 2, 10, 0, a + 32, 42, 2, 0x6d707a); So.box(a, 12, -1, a + 30, 40, 1, (aa, y) => open && y < 26 ? 0x14151a : (y % 3 === 0 ? 0x9a9ca4 : 0xc9ced6), open ? 0 : 2);
    if (open) So.box(a, 12, 0, a + 30, 26, 1, AIR); for (const b of [a + 4, a + 22]) So.box(b, 6, 1, b + 4, 12, 3, INK); So.box(a, 10, 1, a + 30, 12, 8, 0x8f9096); }
  // the roof: HVAC boxes (one knocked over), ponding stains, a hole and the weeds that found it
  const R = (x, z) => [B.x0 + Math.round((x - A.x0) / CV), B.z0 + Math.round((z - BLD.z0) / CV)];
  for (const [x, z, w, d] of [[-244, 38, 3, 2], [-238, 38, 2.4, 2.4], [-230, 44, 3, 2]]) { const [vx, vz] = R(x, z); V.box(vx, H, vz, vx + w * 10, H + 12, vz + d * 10, 0xe6e6ea); V.box(vx + 2, H + 12, vz + 2, vx + w * 10 - 2, H + 13, vz + d * 10 - 2, 0xbdbdc4); }
  { const [vx, vz] = R(-236, 52); V.box(vx, H, vz, vx + 26, H + 8, vz + 18, 0xe6e6ea); }
  for (const [x, z, r] of [[-242, 54, 30], [-229, 55, 22], [-234, 47, 18]]) { const [vx, vz] = R(x, z); for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) if (Math.hypot(a, b * 1.3) < r * (.8 + hash(a >> 2, b >> 2, 3) * .25)) { const px = vx + a, pz = vz + b; if (px > B.x0 + 3 && px < B.x1 - 3 && pz > B.z0 + 3 && pz < B.z1 - 3) V.set(px, H - 1, pz, 0xb9b5aa); } }
  { const [vx, vz] = R(-240, 44); for (let a = -14; a <= 14; a++) for (let b = -10; b <= 10; b++) { const d = Math.hypot(a, b * 1.3); if (d < 11) V.box(vx + a, H - 3, vz + b, vx + a + 1, H, vz + b + 1, -1); else if (d < 14 && hash(a, b, 5) > .4) V.set(vx + a, H - 1, vz + b, WEED); } }
  { const [vx, vz] = R(-231, 52); V.box(vx - 40, H, vz - 28, vx + 40, H + 1, vz + 28, (x, y, z) => hash(x >> 3, z >> 3, 9) > .88 ? 0x2656c0 : 0x2f6bdf); for (const [a, b] of [[-36, -24], [36, -24], [-36, 24], [36, 24], [0, 0], [-18, 10], [20, -8]]) cyl(V, vx + a, vz + b, 3.2, H + 1, H + 3, (x, y, z) => Math.hypot(x + .5 - vx - a, z + .5 - vz - b) < 1.5 ? undefined : 0x1b1b20); }
  return S;
}
// ── the back lot: the service road, dumpsters, pallets, a trash compactor, a scavenger's camp, trees taking the asphalt back
export function backLot(ctx) {
  const [bx0, bz0, bx1, bz1] = blockRange(ctx.i, ctx.j), P = (bk, x, z, rot = 0, ax = 1, reach = 1.5) => (x >= bx0 + .5 && x < bx1 - .5 && z >= bz0 + .5 && z < bz1 - .5) ? ctx.put(bk, x, z, { rot, slide: [ax, 1 - ax], reach }) : null;
  ctx.group('back');
  if (ctx.i === -8) { P(dumpster(0x2f7a3a), -244, 65.4, 2); P(dumpster(0x2f5bff), -240.8, 65.4, 2); P(pallets(4), -233, 65.2, 0); P(bags(11), -236.4, 65.4, 0); P(bags(12), -229.5, 65.6, 0);
    P(MP.tarpShelter(0x2f6bdf), -244.5, 84, 1, 0); P(burnBarrel(), -241.2, 84.5, 0); P(couch(0x8a5a2a), -241.5, 80.8, 2, 1); P(MP.burntCar(1), -233, 82.4, 1);
    for (const [x, z, s] of [[-249, 74, 1], [-230, 89, 3], [-226.5, 76, 5]]) P(tree(s), x, z, 0, 1, 2); P(MP.lotLight(3), -236, 78); P(MP.lotLight(2), -228, 86); }
  if (ctx.i === -7) { P(dumpster(0xe8232a), -219, 65.6, 2); P(dumpster(0x6d707a), -215.8, 65.6, 2); P(MP.cart(true), -212, 66, 1); P(tires(), -208.6, 65.8, 0); P(fridge(0xf2f2ee), -206.4, 65.8, 2);
    P(MP.jersey(0xff7a1a), -200, 72.5, 0); P(MP.jersey(0), -197.6, 72.5, 0); P(MP.burntCar(0), -214, 84.5, 1); P(MP.lotLight(1), -208, 78); P(MP.lotLight(0), -192.5 + 1.2, 86);
    for (const [x, z, s] of [[-222.5, 90, 2], [-203, 90, 4]]) P(tree(s), x, z, 0, 1, 2); P(MP.cart(false), -199, 82, 2); P(MP.cart(false), -221, 80, 1); }
  if (ctx.i === -6) { P(MP.lotLight(3), -186, 88); for (const [x, z, s] of [[-170, 89, 1], [-188, 90, 6]]) P(tree(s), x, z, 0, 1, 2); }
}
// ── the rubble field (block −6,2): where the east anchor stood — heaps, a wall fragment with its tiles, rebar, the excavator nobody
// came back for, an orange construction fence and its CONDEMNED notice
export function rubbleField(ctx) {
  ctx.group('rubble');
  ctx.put(MP.excavator(), -177.5, 76, { rot: 3, slide: [1, 0], reach: 2 });   // the gag: parked mid-job, bucket down in the heap
  // the one wall left standing: a corner of the anchor's facade, 2 m of its purple band still on it
  { const V = ctx.volume(-186, SIDE, 67, -176, SIDE + 6.2, 67.6), nx = V.nx; V.box(0, 0, 0, nx, 62, V.nz, (x, y) => y > 44 + Math.round(Math.sin(x * .4) * 5 + (hash(x, 3) - .5) * 6) ? undefined : y > 36 && y < 42 ? PURPLE : y < 4 ? 0x8a8c94 : BONE);
    for (let x = 6; x < nx - 6; x += 14) V.box(x, 8, 0, x + 8, 30, V.nz, (xx, y, z) => z === 0 ? undefined : 0x2a2d38); keep(ctx, [-186, SIDE, 67, -176, SIDE + 6.2, 67.6], 'wall'); }
  ctx.finish();
  const P = (bk, x, z, rot = 0, ax = 1, reach = 1.6) => ctx.put(bk, x, z, { rot, slide: [ax, 1 - ax], reach });
  for (const [x, z, n, v] of [[-186.5, 72.5, 3, 1], [-170.5, 70.5, 2, 2], [-186.5, 81.5, 3, 3], [-171, 84.5, 2, 4], [-183, 88, 2, 6], [-176.5, 89, 1, 7]]) P(MP.rubble(v, n), x, z, v & 3, 1, 2);
  P(MP.cone(), -189, 71.8); P(MP.cone(), -188.3, 74.6); P(MP.jersey(0xff7a1a), -189.6, 77.5, 1, 0);
}
// the orange construction fence round the rubble field, with its CONDEMNED notice
export function rubbleFence(ctx) {
  fenceRun(ctx, 'z', -191, 65.5, 91, { orange: true, gaps: [[76, 79]] }); fenceRun(ctx, 'x', 65.4, -190.9, -164.2, { orange: true });
  if (ctx.i === -6 && ctx.j === 2) ctx.put(board('CONDEMNED/UNSAFE STRUCTURE', { kind: 'sign', posts: 0, bg: 0xf7f7f2, fg: 0xe8232a, edge: 0xe8232a, pad: 3 }), -191.12, 72, { rot: 3, y: SIDE + .45, reach: 0 });
}
// ── the far tier (0.5 cubes): the lots, the buildings, the rubble, the pylon, the trees (heroes build their own from their full build)
// (SPREAD: the far tier's volume is the block's cell in the spread world, so it draws what of the frame reaches that cell, at the frame's place)
export function farMall(fctx) {
  const i = fctx.b.i, j = fctx.b.j, [sx, sz] = off(fctx), [bx0, bz0, bx1, bz1] = [i * P - sx, j * P - sz, (i + 1) * P - sx, (j + 1) * P - sz], cl = (a, b, c, d) => [Math.max(a, bx0), Math.max(b, bz0), Math.min(c, bx1), Math.min(d, bz1)];
  const ctx = { box: (x0, y0, z0, x1, y1, z1, c) => fctx.box(x0 + sx, y0, z0 + sz, x1 + sx, y1, z1 + sz, c) };
  const [lx0, lz0, lx1, lz1] = cl(IN.x0, IN.z0, IN.x1, IN.z1); ctx.box(lx0, SIDE, lz0, lx1, SIDE + .5, lz1, air(ASPH, .2));
  for (const { k, r } of MARGIN) { const [a, b, c, d] = cl(...r); if (c - a > .25 && d - b > .25) ctx.box(a, SIDE, b, c, SIDE + .5, d, k === 'asph' ? air(ASPH, .2) : WEED); }
  if (j === 1) { for (const [k, p] of Object.entries(PART)) { const [a, b, c, d] = cl(p.x0, BLD.z0, p.x1, BLD.z1); if (c <= a) continue; ctx.box(a, SIDE, b, c, SIDE + p.h, d, air(k === 'anchor' ? BUFF : BONE)); ctx.box(a, SIDE + p.h, b, c, SIDE + p.h + .5, d, 0xd9d6ce); } }
  if (j === 0) { const [a, b, c, d] = cl(IN.x0 + 2, 22.4, IN.x1 - 2, 23.6); if (c > a) ctx.box(a, SIDE, b, c, SIDE + .5, d, 0x7a5a32); }
  if (i === -6 && j === 2) for (const [x, z] of [[-181, 73], [-186.5, 80], [-176, 81]]) ctx.box(x - 2, SIDE, z - 2, x + 2, SIDE + 1.5, z + 2, 0xb8b3a8);
}
