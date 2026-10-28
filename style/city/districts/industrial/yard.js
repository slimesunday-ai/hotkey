// THE SUPPLY SIDE · yards (owner: the supply agent): floors (walk surfaces props stand on), fences with gates and tin plates, and what
// each kind of yard holds. Fences stop 0.3 m short of every building so no two volumes ever share a voxel (the audit's z-fight).
import { Vol, stamp } from '../../vox.js';
import { TOD } from '../../kit.js';
import { C, PAL, CV, SIDE, REG, H, pickH, shade, hash, cyl, px, stencil, vtext, vtextX, inkOn, lit, faceRot, memo, pv, done, logSign } from './lib.js';
import { DECKS } from './names.js';
import { container, pallet, drums, drum, forklift, boxTruck, trailer, tractor, bollard, cone, barrier, spool, pipeStack, beams, lumber, crates, gasCage, lightTower, portaPotty, generator, oilTank, handTruck, plate, postSign, wheelStop } from './props.js';
import { car, tires, dumpster, carOnBlocks, bags, acBox } from '../../props.js';

const inRect = (x, z, r, m = 0) => x > r[0] - m && x < r[2] + m && z > r[1] - m && z < r[3] + m;
// ── floor: one voxel of asphalt, gravel, concrete or dirt over a world rect, skipping cells near the buildings (margin 0.3 m)
export function floor(ctx, [x0, z0, x1, z1], kind, blocks = [], o = {}) {
  const V = ctx.volume(x0, SIDE, z0, x1, SIDE + CV, z1, { walk: true }), keep = o.keep || [];
  const pat = { asph: (x, z) => hash(x >> 3, z >> 3, 31) > .93 ? C.asphD : C.asph, gravel: (x, z) => hash(x >> 2, z >> 2, 7) > .8 ? C.gravelD : hash(x >> 3, z >> 3, 9) > .9 ? 0xb0aa9e : C.gravel,
    conc: (x, z) => (x % 30 === 0 || z % 30 === 0) ? C.concD : C.conc, dirt: (x, z) => hash(x >> 2, z >> 2, 5) > .84 ? C.weed : hash(x >> 1, z >> 1, 6) > .9 ? C.dirtD : C.dirt }[kind];
  V.box(0, 0, 0, V.nx, 1, V.nz, (x, y, z) => { const wx = x0 + (x + .5) * CV, wz = z0 + (z + .5) * CV; for (const b of blocks) if (inRect(wx, wz, b, .3)) return undefined; for (const k of keep) if (inRect(wx, wz, k, 0)) return undefined;
    const p = o.paint?.(wx, wz); return p ?? pat(x, z); });
  return V;
}
// ── fences along the rect's street sides (world sides), a gate gap on one of them; kinds: chain (chain-link, razor wire), panel
// (corrugated sheets in patchwork colours), wall (concrete block with wire on top). Returns the gate centre in world metres.
export function fence(ctx, [x0, z0, x1, z1], sides, kind, gate, blocks = [], o = {}) {
  let gateAt = null; const Hf = kind === 'wall' ? 20 : 22, runs = [];
  for (const side of sides) { const alongX = side[1] === 'z', a0 = alongX ? x0 : z0 + (sides.includes('-z') ? CV : 0), a1 = alongX ? x1 : z1 - (sides.includes('+z') ? CV : 0), at = side === '-z' ? z0 : side === '+z' ? z1 - CV : side === '-x' ? x0 : x1 - CV;
    let cuts = []; for (const b of blocks) { const [b0, b1, c0, c1] = alongX ? [b[0], b[2], b[1], b[3]] : [b[1], b[3], b[0], b[2]]; if (at + CV > c0 - .3 && at < c1 + .3) cuts.push([b0 - .3, b1 + .3]); }
    if (side === gate) { const g = o.gateAt ?? (a0 + a1) / 2, gw = o.gateW ?? 4.6; cuts.push([g - gw / 2, g + gw / 2]); gateAt = alongX ? [g, at + (side === '-z' ? 0 : CV)] : [at + (side === '-x' ? 0 : CV), g]; }
    cuts.sort((p, q) => p[0] - q[0]); let s = a0; for (const [c0, c1] of cuts) { if (c0 > s + .4) runs.push({ side, alongX, s, e: Math.min(c0, a1), at }); s = Math.max(s, c1); } if (a1 > s + .4) runs.push({ side, alongX, s, e: a1, at }); }
  const PANELS = o.panels || [0x3fa9f5, 0x25b84c, C.rust, 0xa7a9b1, 0x2f5bff, 0xe8e2d0, 0x12b3a0];
  for (const r of runs) { const n = Math.max(1, Math.round((r.e - r.s) / CV)), V = r.alongX ? ctx.volume(r.s, SIDE, r.at, r.s + n * CV, SIDE + (Hf + 5) * CV, r.at + CV, { keep: 'fence' }) : ctx.volume(r.at, SIDE, r.s, r.at + CV, SIDE + (Hf + 5) * CV, r.s + n * CV, { keep: 'fence' });
    const P = (a, y, c) => r.alongX ? V.set(a, y, 0, c) : V.set(0, y, a, c);
    for (let a = 0; a < n; a++) { const post = a === 0 || a === n - 1 || a % 25 === 0;
      for (let y = 0; y < Hf; y++) { let c;
        if (kind === 'chain') c = post ? C.steelD : (y === Hf - 1 || y === 0 || a % 2 === 0 || y % 5 === 2) ? C.steel : undefined;
        else if (kind === 'panel') { const pc = PANELS[(hash((r.s * 10 + a) / 24 | 0, r.at * 10 | 0, 17) * PANELS.length) | 0]; c = post ? C.steelD : (a % 3 === 0 ? shade(pc, .82) : pc); }
        else c = y < Hf - 2 ? ((y % 4 === 3 || (a + (y >> 2) * 5) % 10 === 0) ? C.concD : C.conc) : C.concL;
        if (c !== undefined) P(a, y, c); }
      // razor wire: a coil of loops over the chain-link and the wall
      if (kind !== 'panel') { const t = a % 6; for (const [dy, on] of [[Hf, t === 0 || t === 3], [Hf + 1, t === 1 || t === 2 || t === 4 || t === 5], [Hf + 2, t === 0 || t === 3]]) if (on) P(a, dy, C.steelL); if (post) for (let y = Hf; y < Hf + 3; y++) P(a, y, C.steelD); } } }
  return gateAt;
}
// a tin plate on a fence or a wall, facing out of the yard (rot = the side's facing), y metres up; mounted (no support needed)
export function plateOn(ctx, text, side, x, z, y, bg, fg, style = 'tin') { const p = plate(text, bg, fg, style), rot = faceRot[side], [nx, nz] = [[0, 1], [1, 0], [0, -1], [-1, 0]][rot];
  stamp(p, ctx.bank, rot, x + nx * .06, SIDE + y, z + nz * .06); logSign(text, x, z); }

// ── yard contents
const rotTo = side => faceRot[side];
const OPPS = { '-z': '+z', '+z': '-z', '-x': '+x', '+x': '-x' };
export function yardContents(ctx, y, P, built) {
  const [x0, z0, x1, z1] = [y.x0, y.z0, y.x1, y.z1], W = x1 - x0, D = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, r = ((s) => () => (s = (s * 16807) % 2147483647) / 2147483647)(y.seed | 1), seed = y.seed;
  const g = y.gate, inward = g ? OPPS[g] : null;
  switch (y.kind) {
    case 'court': { // box trucks backed to the dock doors, a forklift and pallets by the dock, a guard's booth at the gate
      const col = pickH([C.white, C.yellow, C.red, C.cobalt, C.orange, C.green], seed, 3); atDocks(ctx, y, built, boxTruck(col, y.truckName));
      ctx.put(forklift(pickH([C.yellow, C.orange, C.red], seed, 4)), cx + (r() - .5) * W * .5, cz + (r() - .5) * D * .4, { rot: (r() * 4) | 0, reach: 2 });
      for (let k = 0; k < 4; k++) ctx.put(pallet(pickH(['boxes', 'sacks', 'empty', 'crates', 'bricks'], seed, 10 + k), k), x0 + 1 + r() * (W - 2), z0 + 1 + r() * (D - 2), { rot: (r() * 4) | 0, reach: 1.5 });
      ctx.put(drums(pickH([C.cobalt, C.red, C.green, C.hazard], seed, 7)), x0 + 1.2 + r() * (W - 2.4), z0 + 1.2 + r() * (D - 2.4), { reach: 2 });
      break; }
    case 'trucks': { // the fleet: box trucks side by side facing the gate (backed to a dock if the yard serves one), a tractor
      if (atDocks(ctx, y, built, boxTruck(pickH([C.white, C.yellow, C.red, C.cobalt, C.green, C.orange], seed, 3), y.sign))) { if (y.sign) signAtGate(ctx, y, P); break; }
      const cols = [pickH([C.white, C.yellow, C.red, C.cobalt, C.green, C.orange], seed, 3), pickH([C.white, C.teal, C.pink, C.tang], seed, 4)];
      let face = inward ? OPPS[inward] : '+z', deep = face[1] === 'z' ? D : W; if (deep < 8.4) { face = W >= D ? '+x' : '+z'; deep = face[1] === 'z' ? D : W; }   // too shallow to face the gate: park nose to tail along the yard
      const rot = rotTo(face), along = face[1] === 'z' ? [1, 0] : [0, 1], wide = face[1] === 'z' ? W : D, lenT = deep >= 8.4 ? 3.1 : 8.2, n = Math.max(1, Math.floor(wide / lenT)); let placed = 0;
      for (let k = 0; k < n && placed < 4; k++) { const t = -((n - 1) * lenT) / 2 + k * lenT, bk = k % 3 === 2 && deep >= 8.4 ? tractor(cols[1]) : boxTruck(cols[k % 2 === 0 ? 0 : 1], y.sign);
        if (deep < 8.4 && lenT > 3.1) { const rr = along[0] ? 1 : 0; if (ctx.put(bk, cx + along[0] * t, cz + along[1] * t, { rot: rr, slide: [along[0], along[1]], reach: 1 })) placed++; continue; }
        if (ctx.put(bk, cx + along[0] * t, cz + along[1] * t, { rot, slide: [along[1], along[0]], reach: 1.5 })) placed++; }
      if (y.sign) signAtGate(ctx, y, P);
      break; }
    case 'containers': { // stacks of two lines, two or three high, rows along the long axis with a lane between; a reach forklift
      const lx = W >= D, len = lx ? W : D, dep = lx ? D : W, rows = dep >= 9 ? 2 : 1; let k = 0;
      for (let rw = 0; rw < rows; rw++) { const off = rows === 2 ? (rw ? 2.2 : -2.2) : 0, n40 = len >= 13.2 ? 1 : 0;
        const line = y.lines[rw % 2], lc = lineOf(line), c40 = container(line, lc.col, lc.mk, 40), c20 = container(line, lc.col, lc.mk, 20), bk = n40 ? c40 : c20, L = n40 ? 12.2 : 6.1;
        const x = lx ? cx : cx + off, z = lx ? cz + off : cz, rot = lx ? 0 : 1, hgt = 2 + ((H(seed, rw) * 2) | 0);
        for (let lv = 0; lv < hgt; lv++) { if (!ctx.put(lv === hgt - 1 && H(seed, rw, lv) < .5 ? c20 : bk, x, z, { rot, y: SIDE + CV + lv * 2.6, reach: .01 })) break; k++; } }
      ctx.put(forklift(C.orange), lx ? x0 + 2 : cx, lx ? cz : z0 + 2, { rot: lx ? 1 : 0, reach: 2 });
      break; }
    case 'materials': { // pipes, beams, lumber, bricks, spools and a forklift in a gravel yard
      const list = [pipeStack(pickH([C.steelL, C.orange, C.green, C.cobalt], seed, 2)), beams(), lumber(), pallet('bricks', seed), spool(pickH([C.orange, C.cobalt, C.red], seed, 5)), pallet('empty', 1), spool(C.ink), gasCage()];
      let n = 0; const want = Math.min(6, Math.floor(W * D / 22)); for (let t = 0; t < 14 + want * 2 && n < want; t++) { const bk = list[(n + seed) % list.length], x = x0 + 2.2 + r() * (W - 4.4), z = z0 + 2.2 + r() * (D - 4.4); if (ctx.put(bk, x, z, { rot: (r() * 2) | 0, reach: .9 })) n++; }
      ctx.put(forklift(pickH([C.yellow, C.red], seed, 6)), cx, cz, { rot: (r() * 4) | 0, reach: 3 });
      if (y.sign) signAtGate(ctx, y, P);
      break; }
    case 'tow': { // the pound: cars in rows, a tow truck, a booth with the rules
      const lx = W >= D, n = Math.floor((lx ? W : D) / 2.6) - 1; let s = 0;
      for (let rw = 0; rw < 2; rw++) for (let k = 0; k < n; k++) { const t = -((n - 1) * 2.6) / 2 + k * 2.6, off = (rw ? 1 : -1) * ((lx ? D : W) / 2 - 2.8);
        if (H(seed, rw, k) < .25) continue; ctx.put(H(seed, rw, k + 9) < .15 ? carOnBlocks(k + seed) : car(k * 3 + rw + seed), lx ? cx + t : cx + off, lx ? cz + off : cz + t, { rot: lx ? (rw ? 2 : 0) : (rw ? 3 : 1), reach: .4 }); s++; }
      if (y.sign) signAtGate(ctx, y, P, ['TOW POUND', 'CASH ONLY']);
      break; }
    case 'parking': { const lx = W >= D, n = Math.floor((lx ? W : D) / 2.7);
      for (let k = 0; k < n; k++) { if (H(seed, k) < .35) continue; const t = -((n - 1) * 2.7) / 2 + k * 2.7; ctx.put(car(k * 5 + seed), lx ? cx + t : cx, lx ? cz : cz + t, { rot: lx ? 0 : 1, reach: .5 }); }
      break; }
    case 'vacant': { // weeds, a mound of rubble, a dumped car, tyres, a mattress, the FOR LEASE board
      rubble(ctx, cx + (r() - .5) * W * .4, cz + (r() - .5) * D * .4, 2.2 + r() * 1.2, seed);
      ctx.put(carOnBlocks(seed), x0 + 3 + r() * (W - 6), z0 + 3 + r() * (D - 6), { rot: (r() * 4) | 0, reach: 3 });
      for (let k = 0; k < 3; k++) ctx.put(k === 1 ? bags(seed + k) : tires(), x0 + 1.5 + r() * (W - 3), z0 + 1.5 + r() * (D - 3), { reach: 2 });
      if (y.fence.length) { const sd = y.fence[0], [sx, sz] = edgeMid(y, sd, .6); ctx.put(postSign([y.lease, y.phone], C.chalk, C.red, { post: 14, border: C.red }), sx, sz, { rot: faceRot[sd], slide: sd[1] === 'z' ? [1, 0] : [0, 1], reach: 3 }); }
      break; }
    case 'aggregate': { // sand, gravel and crushed brick heaps against a concrete wall, a conveyor, a loader
      const heaps = [[0xe9c46a, 'sand'], [0xa7a9b1, 'stone'], [0xc0633f, 'brick']]; heaps.forEach(([c], k) => mound(ctx, x0 + W * (.2 + .3 * k), z0 + D * .45, 2.4 + (k === 1 ? .8 : 0), c, seed + k));
      ctx.put(loader(C.yellow), cx, z0 + D * .82, { rot: 0, reach: 3 }); if (y.sign) signAtGate(ctx, y, P);
      break; }
    case 'salt': { mound(ctx, cx, cz - D * .05, Math.min(W, D) * .36, 0xf1f3f5, seed, .55); ctx.put(dumpTruck(C.orange), x0 + W * .82, z0 + D * .75, { rot: 1, reach: 3 });
      if (y.fence.length) { const sd = y.fence[0], [sx, sz] = edgeMid(y, sd, .7, .25); ctx.put(postSign([y.saltSign, 'NO SCOOPING'], C.cobalt, C.chalk, { post: 16 }), sx, sz, { rot: faceRot[sd], reach: 3, slide: sd[1] === 'z' ? [1, 0] : [0, 1] }); }
      break; }
    case 'tanks': { const n = W > 26 ? 3 : 2; for (let k = 0; k < n; k++) tankFarm(ctx, x0 + W * ((k + .5) / n), z0 + D * .4, 3.6 + (k === 1 ? .6 : 0), 9 + (k % 2) * 3, y.tankNames?.[k], seed + k);
      ctx.put(oilTank(C.chalk, ''), cx, z0 + D * .84, { rot: 0, reach: 3 }); break; }
  }
}
// trucks backed up to the dock doors of the building whose dock faces this yard's gate side; returns how many went down
function atDocks(ctx, y, built, bk) { const bld = built.find(b => b.spec.dock && b.spec.dock === y.gate); if (!bld) return 0; let n = 0;
  for (const d of bld.doors.filter(d => d.side === bld.spec.dock).slice(0, 2)) { const [dx, dz] = d.world, [nx, nz] = { '-z': [0, -1], '+z': [0, 1], '-x': [-1, 0], '+x': [1, 0] }[d.side], len = 7.4;
    const tx = dx + nx * (1.75 + len / 2), tz = dz + nz * (1.75 + len / 2); if (inRect(tx, tz, [y.x0, y.z0, y.x1, y.z1], -1) && ctx.put(bk, tx, tz, { rot: rotTo(d.side), slide: [nz ? 1 : 0, nx ? 1 : 0], reach: 1.2 })) n++; }
  return n; }
const LINES = DECKS.lines, lineOf = name => { for (const L of LINES) if (L[0] === name) return { col: L[2], mk: L[1] }; return { col: C.grey, mk: 'bar' }; };
const edgeMid = (y, side, inset = .5, t = .5) => { const u = (a, b) => a + (b - a) * t; return side === '-z' ? [u(y.x0, y.x1), y.z0 + inset] : side === '+z' ? [u(y.x0, y.x1), y.z1 - inset] : side === '-x' ? [y.x0 + inset, u(y.z0, y.z1)] : [y.x1 - inset, u(y.z0, y.z1)]; };
// the yard's name on a post sign just inside the fence beside the gate
function signAtGate(ctx, y, P, extra = null) { if (!y.gate) return; const sd = y.gate, [sx, sz] = edgeMid(y, sd, .55, .18), lines = extra ? [y.sign, ...extra] : [y.sign];
  const bg = pickH([C.cobalt, C.red, C.green, C.ink, C.chalk], y.seed, 12); if (ctx.put(postSign(lines, bg, inkOn(bg), { post: 13, border: bg === C.chalk ? C.red : null }), sx, sz, { rot: faceRot[sd], slide: sd[1] === 'z' ? [1, 0] : [0, 1], reach: 2.5 })) logSign(lines.join(' '), sx, sz); }

// ── the heavy stuff that isn't a building: mounds (stepped cones) and storage tanks are structures (volumes meshed into the block)
export function mound(ctx, cx, cz, r, col, seed, flat = .8) {
  const n = Math.ceil(r / CV), hgt = Math.round(r * flat / CV), V = ctx.volume(cx - n * CV, SIDE + CV, cz - n * CV, cx + n * CV, SIDE + (hgt + 3) * CV, cz + n * CV, { keep: 'mound' });   // (on the yard floor)
  for (let x = 0; x < 2 * n; x++) for (let z = 0; z < 2 * n; z++) { const d = Math.hypot(x + .5 - n, z + .5 - n) / n + (hash(x >> 2, z >> 2, seed) - .5) * .12; if (d >= 1) continue;
    const h = Math.max(1, Math.round(hgt * (1 - d))); V.box(x, 0, z, x + 1, h, z + 1, (xx, yy) => (yy === h - 1 && hash(xx >> 2, z >> 2, seed + 3) > .78) ? shade(col, .9) : col); }
  REG.surface(V); return V;
}
export function rubble(ctx, cx, cz, r, seed) { mound(ctx, cx, cz, r, 0xa39a8e, seed, .4); }
function tankFarm(ctx, cx, cz, r, hgt, name, seed) {
  const n = Math.ceil(r / CV) + 2, hv = Math.round(hgt / CV), V = ctx.volume(cx - n * CV, SIDE + CV, cz - n * CV, cx + n * CV, SIDE + (hv + 9) * CV, cz + n * CV, {}), col = pickH([C.chalk, C.bone, C.pale], seed, 1), band = pickH([C.red, C.cobalt, C.green, C.orange], seed, 2);
  const R = r / CV; cyl(V, n, n, R + .8, 0, 3, C.concD);
  cyl(V, n, n, R, 3, hv, (x, y) => (y > hv * .72 && y < hv * .72 + 8) ? band : (y % 20 === 0 ? shade(col, .9) : col)); cyl(V, n, n, R - 1, hv, hv + 2, shade(col, .9)); cyl(V, n, n, R * .45, hv + 2, hv + 3, shade(col, .85));
  // a stair wrapping a quarter of it, a railing ring on top
  for (let t = 0; t < hv - 4; t++) { const a = t / (hv - 4) * Math.PI * .6 + seed, x = Math.round(n + Math.cos(a) * (R + 1)), z = Math.round(n + Math.sin(a) * (R + 1)); V.box(x - 1, t + 3, z - 1, x + 1, t + 4, z + 1, C.steelD); }
  for (let k = 0; k < 64; k++) { const a = k / 64 * Math.PI * 2; V.set(Math.round(n + Math.cos(a) * (R - .6)), hv + 2, Math.round(n + Math.sin(a) * (R - .6)), C.steelD); }
  if (name) { const M = px(name); if (M.w * 2 < 2 * R * 1.1) curveText(V, M, n - M.w, Math.round(hv * .55) + 7, 2, band); }
  cyl(V, n, n, R - 5, 4, hv - 2, -1);   // hollow (a 0.5 m skin)
  ctx.mass(V, [cx - r - .1, cz - r - .1, cx + r + .1, cz + r + .1], { top: SIDE + (hv + 4) * CV, roofY: SIDE + (hv + 1) * CV });
}
// lettering painted round a tank (a volume whose front bulges toward +z): each letter voxel goes on the outermost solid voxel of its
// column, the board recorded one voxel behind it, so the audit sees paint on the curve, never letters floating off it
export function curveText(V, M, x0, ytop, sc, col) { V.recNext();
  for (let j = 0; j < M.h; j++) for (let i = 0; i < M.w; i++) { if (!M.at(i, j)) continue;
    for (let u = 0; u < sc; u++) for (let v = 0; v < sc; v++) { const x = x0 + i * sc + u, y = ytop - j * sc - v; let z = V.nz - 1; while (z > 0 && !V.has(x, y, z)) z--; if (z <= 1) continue;
      V.set(x, y, z, col); V.rec(M.s, x, y, z, x, z - 1, x, z + 1); } } }
// ── the yard machines (props)
const axleP = (V, x0, x1, z, rr = 4) => { for (const x of [x0, x1 - 3]) { V.box(x, 0, z - rr, x + 3, 2 * rr - 1, z + rr, C.rubber); V.box(x + (x === x0 ? 0 : 2), 2, z - 2, x + (x === x0 ? 1 : 3), 2 * rr - 3, z + 2, C.steelL); } };
export const loader = c => memo('loader' + c, () => { const V = pv(26, 34, 64); axleP(V, 0, 26, 16, 7); axleP(V, 0, 26, 42, 7);
  V.box(2, 7, 6, 24, 16, 50, c); V.box(4, 16, 8, 22, 20, 22, shade(c, .8)); V.box(5, 16, 26, 21, 33, 40, c); V.box(6, 22, 26, 20, 31, 27, 0x9fd8ff, 1); V.box(6, 22, 39, 20, 31, 40, 0x9fd8ff, 1); V.box(5, 33, 25, 21, 34, 41, C.ink);
  for (const x of [3, 21]) V.box(x, 10, 50, x + 2, 16, 56, C.steelD); V.box(1, 1, 56, 25, 12, 58, C.steelD); V.box(1, 1, 58, 25, 3, 64, C.steelD); V.box(1, 3, 62, 25, 12, 64, C.steelD);
  return done(V, 'loader'); });
export const dumpTruck = c => memo('dumptr' + c, () => { const V = pv(26, 34, 76); axleP(V, 0, 26, 12); axleP(V, 0, 26, 21); axleP(V, 0, 26, 62);
  V.box(2, 7, 2, 24, 10, 70, C.steelD); V.box(1, 10, 2, 25, 28, 48, c); V.box(3, 13, 4, 23, 28, 46, 0xf1f3f5); V.box(1, 28, 4, 25, 30, 46, shade(c, .8));
  V.box(1, 8, 50, 25, 30, 70, c); V.box(2, 20, 69, 24, 28, 70, 0x9fd8ff, 1); V.box(1, 30, 52, 25, 32, 68, shade(c, .85)); V.box(0, 6, 70, 26, 10, 76, C.steelD);   // box full of salt, cab, plow
  V.box(2, 30, 60, 24, 31, 62, 0xffb400, TOD.night ? 3 : 1); return done(V, 'truck'); });
