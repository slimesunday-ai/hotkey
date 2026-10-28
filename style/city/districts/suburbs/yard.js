// PLEASANTVIEW · THE YARDS (owner: the Pleasantview section agent). Each lot: its drive and front path (walkable), the front yard's
// ground (lawn, a paved yard, dry grass, gravel, flower beds), fences in the street's own kinds (pickets, chain-link, iron, a low wall,
// hedges, split rail, a privacy fence round the back), trees by species, then the lot's life: cars in the drive, the mailbox, bins,
// the front-yard stuff (gnomes, flamingos, bikes …), the back yard (pools, trampolines, swing sets, sheds, dogs …) and, on about two
// blocks in three, a one-off scene. Everything goes down through the engine (ctx.put: clear and supported, else skipped and logged).
import { REG } from '../../audit.js';
import { PAL, CV, SIDE, hash, shade } from '../../style.js';
import { car, bike, hoop, grill, lawnChair, kiddiePool, hotTub, bench, carOnBlocks, dog } from '../../props.js';
import { frameOf, layoutOf } from './plan.js';
import { board, logSign } from './brush.js';
import { roofBillboard } from '../../signage/index.js';
import { FLOOR, STOREY } from './plan.js';
import * as SP from './props.js';

const WHITE = PAL.white, INK = PAL.ink, CONC = 0xc9c3b6, ASPH = 0x55565f, GRAV = 0xc9bca2, PAVER = 0xb07a5a;
const CARC = [0xe8232a, 0x2f5bff, 0xf7f7f2, 0x17171b, 0x25b84c, 0x8a3cff, 0xff7a1a, 0x12b3a0];
const H = (s, k) => hash(s.seed, k, 719);

// the engine lifts a prop onto a walkable surface when any of five points of its footprint (the centre, four corners) is over one
// (audit.js liftOnto): a prop whose points disagree would hang off the surface's edge (or its trunk float over the lawn), so it moves on
function surfTop(x, z) { let top = 0; for (const f of REG.blk?.surfaces || []) { if (x < f.box[0] || x >= f.box[3] || z < f.box[2] || z >= f.box[5]) continue; const V = f.V, i = Math.floor((x - V.org[0]) / V.s), k = Math.floor((z - V.org[2]) / V.s);
  if (i < 0 || k < 0 || i >= V.nx || k >= V.nz) continue; let j = Math.floor((SIDE + .02 - V.org[1]) / V.s); if (j < 0 || j >= V.ny || !V.d[i + k * V.nx + j * V.sxz]) continue; let t = j; while (t + 1 < V.ny && V.d[i + k * V.nx + (t + 1) * V.sxz] && t - j < 3) t++; top = Math.max(top, V.org[1] + (t + 1) * V.s - SIDE); } return top; }
export const uneven = bx => { const h = [[(bx[0] + bx[3]) / 2, (bx[2] + bx[5]) / 2], [bx[0] + .08, bx[2] + .08], [bx[3] - .08, bx[2] + .08], [bx[0] + .08, bx[5] - .08], [bx[3] - .08, bx[5] - .08]].map(([x, z]) => surfTop(x, z)); return h.some(v => Math.abs(v - h[0]) > .01); };
// ── lot-local placement: (u, v) in metres, q a local quarter turn (0 faces the street), slide along u or v
export function lput(ctx, s, bk, u, v, q = 0, o = {}) {
  const F = frameOf(s.l), rot = F.rot(q), [su, sv] = o.slide || [1, 0], reach = o.reach ?? .6, sf = REG.blk?.surfaces || [], whys = new Set();
  for (let k = 0, d = 0; Math.abs(d) <= reach + 1e-6; k++, d = (k % 2 ? 1 : -1) * Math.ceil(k / 2) * .2) {
    const [x, z] = F.at(u + su * d, v + sv * d), bx = REG.boxOf(bk, rot, x, SIDE, z);
    if (!o.loose && uneven(bx)) { whys.add('half on a path or drive'); continue; } const why = REG.why(bx); if (why) { whys.add(why); continue; }
    const at = ctx.put(bk, x, z, { rot, reach: 0 }); if (at) return at; }
  const [x, z] = F.at(u, v); REG.skip(bk.kind || 'prop', [+x.toFixed(2), SIDE, +z.toFixed(2)], [...whys].slice(0, 2).join(', ')); return null;
}
// the same in world metres (heroes): slide along [ax, az], never straddling a walkable surface's edge
export function wput(ctx, bk, x, z, o = {}) {
  const rot = o.rot ?? 0, [ax, az] = o.slide || [1, 0], reach = o.reach ?? .6, whys = new Set();
  for (let k = 0, d = 0; Math.abs(d) <= reach + 1e-6; k++, d = (k % 2 ? 1 : -1) * Math.ceil(k / 2) * .2) {
    const px = x + ax * d, pz = z + az * d, bx = REG.boxOf(bk, rot, px, SIDE, pz); if (!o.loose && uneven(bx)) { whys.add('half on a path'); continue; }
    const why = REG.why(bx); if (why) { whys.add(why); continue; } const at = ctx.put(bk, px, pz, { rot, reach: 0 }); if (at) return at; }
  REG.skip(bk.kind || 'prop', [+x.toFixed(2), SIDE, +z.toFixed(2)], [...whys].slice(0, 2).join(', ')); return null;
}
// a thin run of voxels on the lot (u0…u1 × v0…v1 in voxels) → a world volume
function lvol(ctx, s, u0, v0, u1, v1, y0, y1, o = {}) { const F = frameOf(s.l), [x0, z0, x1, z1] = F.rect(u0 / 10, v0 / 10, u1 / 10, v1 / 10); return ctx.volume(+x0.toFixed(2), SIDE + y0, +z0.toFixed(2), +x1.toFixed(2), SIDE + y1, +z1.toFixed(2), o); }

// ── GROUND: the drive, the path to the door, the front yard's cover
export function grounds(ctx, s) {
  const L = layoutOf(s), b = L.body, [d0, dv0, d1, dv1] = L.drive;
  // the drive (walkable): concrete with joints, asphalt, gravel, two concrete strips, brick pavers
  const dc = { concrete: (u, v) => v % 12 === 0 ? 0xb9b3a8 : CONC, asphalt: () => ASPH, gravel: (u, v) => hash(u >> 1, v >> 1, 5) > .8 ? 0xb3a58a : GRAV,
    strips: (u, v) => (u - d0 > 5 && u - d0 < d1 - d0 - 6) ? (hash(u >> 1, v >> 1, 9) > .7 ? 0x6fa84e : 0x7fae5a) : CONC, pavers: (u, v) => ((u >> 2) + (v >> 1)) % 2 ? PAVER : shade(PAVER, .9) }[s.drive];
  const dv = lvol(ctx, s, d0, dv0, d1, dv1, 0, .1, { walk: true }); paint(dv, s, d0, dv0, dc);
  // the path: from the street (straight), from the drive (an L along the front of the house), or stepping stones in the lawn
  const out = b[1] - (s._out ?? 17), du = L.door, pc = s.st.name === 'Jackson St' ? CONC : [CONC, 0xd9d2c3, PAVER][(H(s, 1) * 3) | 0];
  const toDrive = s.path === 'drive' && out > 16 && (du + 5 < d0 - 4 || du - 5 > d1 + 4), pw = 10, paths = [];
  if (s.path === 'stones') { for (let v = 4; v < out - 3; v += 7) { const u = du + ((v * 7) % 5) - 2; paths.push([u - 5, v, u + 5, v + 4, 'stone']); } }
  else if (toDrive) { const vp = out - pw; paths.push(du < d0 ? [du - 5, vp, d0, out] : [d1, vp, du + 5, out]); }   // along the house front to the drive
  else paths.push([du - 5, 0, du + 5, out]);
  for (const [u0, v0, u1, v1, k] of paths) { if (u1 <= u0 || v1 <= v0) continue; const V = lvol(ctx, s, u0, v0, u1, v1, 0, .1, { walk: true });
    V.box(0, 0, 0, V.nx, 1, V.nz, k === 'stone' ? (x, y, z) => (x === 0 || x === V.nx - 1) && (z === 0 || z === V.nz - 1) ? undefined : 0xbdb8ae : (x, y, z) => ((x + z) % 8 === 0 && !toDrive) ? shade(pc, .92) : pc); }
  s._path = toDrive ? 'drive' : s.path === 'drive' ? 'straight' : s.path;
  // the front yard's cover (walkable): the whole yard paved (Jackson St), dry grass, gravel; holes for the drive, the path and the stoop
  if (s.yard === 'paved' || s.yard === 'dry' || s.yard === 'gravel') {
    const holes = [[d0 - 1, 0, d1 + 1, dv1], ...paths.map(p => [p[0] - 1, p[1] - 1, p[2] + 1, p[3] + 1]), [b[0] - 2, out - 1, b[2] + 2, 999]], fv = s.fence === 'hedge' ? 6 : s.fence === 'wall' ? 3 : s.fence === 'none' ? 0 : 1, cu0 = s.corner.L ? fv : 0, cu1 = s.W10 - (s.corner.R ? fv : 0), cov = lvol(ctx, s, cu0, fv, cu1, Math.max(fv + 1, out - 1), 0, .1, { walk: true });
    const col = s.yard === 'paved' ? (u, v) => (u % 15 === 0 || v % 15 === 0) ? 0xb9b3a8 : CONC : s.yard === 'dry' ? (u, v) => hash(u >> 2, v >> 2, 11) > .75 ? 0xa8a055 : hash(u >> 2, v >> 2, 12) > .8 ? 0x8fae5a : 0xb5b068 : (u, v) => hash(u >> 1, v >> 1, 13) > .8 ? 0xb3a58a : GRAV;
    paint(cov, s, cu0, fv, (u, v) => holes.some(([a, c, e, g]) => u >= a && u < e && v >= c && v < g) ? undefined : col(u, v)); }
}
// paint a one-voxel layer volume by lot-local (u, v) (voxels)
function paint(V, s, u0, v0, c) { const F = frameOf(s.l), f = F.f, ox = Math.round((V.org[0] - s.l.x0) * 10), oz = Math.round((V.org[2] - s.l.z0) * 10);
  V.box(0, 0, 0, V.nx, 1, V.nz, (x, y, z) => { const u = f > 0 ? ox + x : s.W10 - 1 - (ox + x), v = f > 0 ? s.D10 - 1 - (oz + z) : oz + z; return c(u, v); }); }

// ── FENCES (volumes; registered as keep-outs after the trees are down, so a crown may overhang a fence)
const FH = { picket: 9, chain: 12, iron: 10, wall: 6, hedge: 11, split: 9, privacy: 17 };
function fenceRun(ctx, s, kind, u0, v0, u1, v1) {
  if (u1 - u0 < 2 && v1 - v0 < 2) return; const alongU = (u1 - u0) >= (v1 - v0), hgt = FH[kind], thick = kind === 'hedge' ? 6 : kind === 'wall' ? 3 : 1;
  if (alongU) v1 = v0 + thick; else u1 = u0 + thick;
  const V = lvol(ctx, s, u0, v0, u1, v1, 0, hgt * CV + .001), n = alongU ? u1 - u0 : v1 - v0, sd = s.seed, F = frameOf(s.l);
  const kx = alongU ? (F.f > 0 ? x => x : x => n - 1 - x) : null;
  V.box(0, 0, 0, V.nx, V.ny, V.nz, (x, y, z) => { const k = alongU ? x : z, m = (alongU ? z : x);
    switch (kind) {
      case 'picket': return (k % 3 === 0 && y < hgt) || y === 3 || y === 6 ? (y === hgt - 1 && k % 3 !== 0 ? undefined : WHITE) : undefined;
      case 'chain': return (k % 20 === 0 || y === hgt - 1) ? 0x9a9ca4 : ((k + y) % 2 === 0 ? 0xc3c6cc : undefined);
      case 'iron': return (k % 12 === 0 && y < hgt) ? INK : (y === hgt - 2 || y === 1) ? INK : (k % 2 === 0 && y < hgt - 1) ? INK : undefined;
      case 'wall': return (k % 18 < 3) ? (y < hgt ? 0x8f929b : undefined) : y === hgt - 1 ? 0xd9d2c3 : (y % 2 ? 0x9c4a34 : 0x8a4430);
      case 'hedge': return hash(k >> 2, y >> 2, m + sd) > .9 && y > hgt - 3 ? undefined : [0x2a9a48, 0x238a3e, 0x35b055][(hash(k >> 2, y >> 2, sd) * 3) | 0];
      case 'split': return (k % 20 === 0 && y < hgt) ? 0x6e4a2a : (y === 3 || y === 7) ? (hash(k >> 4, 3, sd) > .5 ? 0x8a5a2a : 0x7a4a22) : undefined;
      case 'privacy': return (k % 10 === 0) ? 0x8a5a2a : (y === hgt - 1 ? 0x9a6a3a : (k % 2 ? 0xc49a6c : 0xb88c5e));
    } return undefined; });
  return V;
}
export function fences(ctx, s) {
  const L = layoutOf(s), b = L.body, W = s.W10, D = s.D10, [d0, , d1] = L.drive, du = L.door, k = s.fence, out = b[1] - (s._out ?? 17);
  const reg = (u0, v0, u1, v1, h) => { if (u1 - u0 < 1 || v1 - v0 < 1) return; const F = frameOf(s.l), [x0, z0, x1, z1] = F.rect(u0 / 10, v0 / 10, u1 / 10, v1 / 10); REG.keep([x0 - .02, SIDE, z0 - .02, x1 + .02, SIDE + h * CV, z1 + .02], 'fence'); };
  const run = (kind, u0, v0, u1, v1) => { const alongU = (u1 - u0) >= (v1 - v0); fenceRun(ctx, s, kind, u0, v0, u1, v1); reg(u0, v0, alongU ? u1 : u0 + (kind === 'hedge' ? 6 : kind === 'wall' ? 3 : 1), alongU ? v0 + (kind === 'hedge' ? 6 : kind === 'wall' ? 3 : 1) : v1, FH[kind]); };
  // the front fence along the lot line: gaps for the drive and the path (a gate gap), wrapping round a corner lot's side-street front
  if (k !== 'none') { const gaps = [[d0 - 2, d1 + 2]]; if (s._path !== 'drive') gaps.push([du - 7, du + 7]); if (L.mail) gaps.push([L.mail[0] - 6, L.mail[0] + 6]); gaps.sort((a, c) => a[0] - c[0]);
    let a = 0; for (const [g0, g1] of gaps) { if (g0 > a + 2) run(k, a, 0, g0, 1); a = Math.max(a, g1); } if (W > a + 2) run(k, a, 0, W, 1);
    const kk = k === 'hedge' ? 6 : k === 'wall' ? 3 : 1;
    for (const side of ['L', 'R']) if (s.corner[side]) { const u = side === 'L' ? 0 : W - kk, dr = side === 'L' ? d0 < 10 : d1 > W - 10; if (!dr) run(k, u, kk, u + kk, Math.max(kk + 2, out - 2)); } }
  // the back yard: a privacy fence (or the street's kind) along the back line and the left lot line, the side street's side of a corner lot
  const bk = s.backFence; if (bk === 'none') return;
  const vb = b[3] + 4, kk = bk === 'hedge' ? 6 : 1;
  run(bk, 0, D - kk, W, D);
  if (!s.corner.L) run(bk, 0, vb, 1, D - kk); else if (!(d0 < 10 && L.detached)) run(bk === 'chain' ? 'chain' : 'privacy', 0, vb, 1, D - kk);
  if (s.corner.R && !(d1 > W - 10 && L.detached)) run(bk === 'chain' ? 'chain' : 'privacy', W - 1, vb, W, D - kk);
  // (and from the house's back corners to the side lines, so the back yard is closed: a gate on the drive side)
  if (s.driveSide === 'R') { if (b[0] - 3 > 4) run(bk, 1, vb, b[0] - 3, vb + 1); } else if (W - 1 - (b[2] + 3) > 4) run(bk, b[2] + 3, vb, W - 1, vb + 1);
}

// ── TREES (props: clear of the houses, the doors and each other; a crown may overhang a fence or the sidewalk)
const BACKSP = { 'Jackson St': 'maple', 'Union Ave': 'maple', 'Oak St': 'oak', 'Pine St': 'pine', 'Willow St': 'willow', 'Aspen St': 'birch', 'Fox Run': 'pine' };
const CURBSP = { 'Jackson St': 'maple', 'Union Ave': 'maple', 'Oak St': 'oak', 'Pine St': 'maple', 'Willow St': 'maple', 'Aspen St': 'birch', 'Fox Run': 'oak' };
export function trees(ctx, s) {
  const L = layoutOf(s), b = L.body, W = s.W, D = s.D, [d0, , d1] = L.drive.map(x => x / 10), sp = s.front, v = s.seed;
  const out = (b[1] - (s._out ?? 17)) / 10, du = L.door / 10;
  // the street tree in the kerb strip (the street's own species), in front of the lawn, not the drive
  if (H(s, 6) < .78) { const cu = [du < W / 2 ? W - 1.2 : 1.2, (d0 + d1) / 2 < W / 2 ? W - 2.5 : 2.5, W / 2].find(u => u < d0 - 1.2 || u > d1 + 1.2);
    if (cu !== undefined) { const was = REG.strict; REG.strict = false; try { lput(ctx, s, SP.tree(CURBSP[s.street], 1, v, true), cu, -1.55, 0, { slide: [1, 0], reach: 1.2 }); } finally { REG.strict = was; } } }
  if (sp !== 'none' && out > 2.4) { // the front tree: in the lawn beside the path, away from the drive
    const lo = d0 < W / 2 ? d1 + 1.2 : 1.1, hi = d0 < W / 2 ? W - 1.1 : d0 - 1.2, cands = [];
    for (let u = lo; u <= hi; u += .4) if (Math.abs(u - du) > 1.6) cands.push(u);
    cands.sort((a, c) => Math.abs(a - (du < W / 2 ? hi : lo)) - Math.abs(c - (du < W / 2 ? hi : lo)));
    for (const u of cands.slice(0, 5)) if (lput(ctx, s, SP.tree(sp === 'maple' && H(s, 3) < .25 ? 'redmaple' : sp, 0, v), u, Math.min(out - 1.1, 1.3), 0, { slide: [0, 1], reach: .3 })) break; }
  if (s.big) { // a shade tree at the back line (its crown over the fence into the yard behind), or the side yard of a corner lot
    const bsp = BACKSP[s.street], spots = [[W / 2 + (H(s, 5) - .5) * 4, D - .5], [1.5, D - .5], [W - 1.5, D - .5]];
    for (const size of [2, 1]) { let ok = false; for (const [u, vv] of spots) if (lput(ctx, s, SP.tree(bsp, size, v + 1), u, vv, 0, { slide: [1, 0], reach: 1.2 })) { ok = true; break; } if (ok) break; } }
}

// ── THE LOT'S LIFE
const CAR = (s, kind, k) => { const c = CARC[(H(s, 20 + k) * CARC.length) | 0];
  return kind === 'wagon' ? SP.wagon(c) : kind === 'pickup' ? SP.pickup(c, (H(s, 22 + k) * 3) | 0) : kind === 'van' ? SP.van(c, H(s, 24) < .5 ? WHITE : null) : kind === 'boat' ? SP.boat([0xe8232a, 0x2f5bff, 0x12b3a0][(H(s, 25) * 3) | 0], H(s, 26) < .5)
    : kind === 'camper' ? SP.camper([0x2f5bff, 0xe8232a, 0x14a83b][(H(s, 27) * 3) | 0]) : car((H(s, 28 + k) * 97) | 0); };
export function life(ctx, s, oneOff) {
  const L = layoutOf(s), b = L.body, W = s.W, D = s.D, [d0, dv0, d1, dv1] = L.drive.map(x => x / 10), dc = (d0 + d1) / 2, F = frameOf(s.l);
  const out = (b[1] - (s._out ?? 17)) / 10, du = L.door / 10, vb = b[3] / 10 + .6, R = s.driveSide === 'R', sd = s.seed;
  const put = (bk, u, v, q = 0, o) => lput(ctx, s, bk, u, v, q, o);
  // the drive: the car (nose to the street or backed in), a second one behind it, a boat or a camper; a carport or a garage shelters the first
  const nose = H(s, 30) < .5 ? 0 : 2, oc = oneOff, stage = ['carBlocks', 'moving', 'fixer', 'hotrod', 'carWash', 'yardSale', 'party'].includes(oc);
  if (!stage) {
    const long = s.car === 'camper' || s.car === 'boat', len = long ? 5.8 : 4.9;
    if (s.car !== 'none' && dv1 - dv0 >= len) put(CAR(s, s.car, 0), dc, dv1 - len / 2 - .1, long ? 0 : nose, { slide: [0, 1], reach: Math.max(.2, dv1 - dv0 - len) });
    if (s.car2 !== 'none' && dv1 - dv0 >= len + 4.9) put(CAR(s, s.car2, 1), dc, 2.5, nose, { slide: [0, 1], reach: .4 }); }
  // the mailbox by the drive or the path, facing the street (the wall kind hangs by the door: a Jackson St habit, skipped here)
  if (s.mailbox !== 'wall' && oc !== 'party' && oc !== 'yardSale') { const [mu, mv] = L.mail; put(SP.mailbox(s.mailbox, [INK, 0x2f5bff, 0xe8232a, WHITE, 0x14a83b][(H(s, 31) * 5) | 0], H(s, 32) < .3 ? 1 : 0), mu / 10, mv / 10, 0, { slide: [1, 0], reach: .3 }); }
  // bins by the drive (trash day on Pine St and Jackson St: at the curb end)
  if (!oc && (s.extra === 'bins' || s.extra2 === 'bins' || H(s, 33) < .35)) { const bu = R ? d0 - 1.75 : d1 + 1.75, bv = .65;
    put(SP.bin([0x25b84c, 0x3d3f46, 0x2f5bff][(H(s, 34) * 3) | 0]), bu, bv, 0, { slide: [0, 1], reach: .3 }); put(SP.bin(0x3d3f46, 0x2f5bff), bu - (R ? .8 : -.8), bv, 0, { slide: [0, 1], reach: .3 }); }
  // a roof billboard on the flat roof, facing the street (the design comes from the shared signage system, allocated for this block)
  if (s.billboard) { const [x, z] = F.at((b[0] + b[2]) / 20, (b[1] + b[3]) / 20 + .2), r = roofBillboard(sd, { giant: false, flip: false, at: [x, z] }); ctx.put(r.bank, x, z, { y: SIDE + (FLOOR + 2 * STOREY + 2) * CV, rot: F.rot(0), reach: 0 }); }
  // the front yard: the lot's one or two things
  if (!oc) for (const [k, ex] of [[0, s.extra], [1, s.extra2]]) frontThing(ctx, s, ex, k, { out, du, d0, d1, W, R });
  // the back yard: one or two things, then a dog in some
  const zone = backZone(s); for (const [k, ex] of [[0, s.yardB], [1, s.yardB2]]) backThing(ctx, s, ex, k, zone);
  if (s.dog && s.yardB !== 'pool') { const [u, v] = [zone.u0 + (zone.u1 - zone.u0) * H(s, 40), zone.v0 + (zone.v1 - zone.v0) * .5]; const [x, z] = F.at(u, v); (ctx.A.dogs ??= []).push({ x, z, rot: F.rot((H(s, 41) * 4) | 0), seed: sd }); }
}
function frontThing(ctx, s, ex, k, { out, du, d0, d1, W, R }) {
  if (ex === 'none' || ex === 'bins') return; const sd = s.seed + k, lawnLo = R ? .8 : d1 + .8, lawnHi = R ? d0 - .8 : W - .8, far = du < (lawnLo + lawnHi) / 2 ? lawnHi - .9 : lawnLo + .9, v = Math.max(.75, Math.min(out - .9, 1.1 + H(s, 50 + k) * Math.max(.1, out - 2.4)));
  const put = (bk, u, vv, q = 0) => lput(ctx, s, bk, u, vv, q, { slide: [1, 0], reach: 1.2 });
  switch (ex) {
    case 'gnomes': put(SP.gnomes(sd), far, v); break;
    case 'flamingos': put(SP.flamingos(sd), far, v, (sd % 2) ? 1 : 3); break;
    case 'birdbath': put(SP.birdbath(), far, v); break;
    case 'windmill': put(SP.windmill(sd), far, v); break;
    case 'statue': put(SP.statue(), far, Math.min(out - .6, .9)); break;
    case 'planters': put(SP.planter(0xc9c3b6, [0xe8232a, 0xff4fa3, 0xffe23a][sd % 3]), du + 1.2, Math.max(.6, out - .6)); put(SP.planter(0xc9c3b6, [0xe8232a, 0xff4fa3, 0xffe23a][(sd + 1) % 3]), du - 1.2, Math.max(.6, out - .6)); break;
    case 'lantern': put(SP.lantern(), du + .95, Math.max(.5, out / 2)); put(SP.lantern(), du - .95, Math.max(.5, out / 2)); break;
    case 'bench': put(bench(), far, Math.min(out - .6, 1)); break;
    case 'bike': put(bike([0xe8232a, 0x2f5bff, 0x14a83b, 0xff4fa3][sd % 4]), far, v, 1); break;
    case 'toys': put(SP.toys(sd), far, v); break;
    case 'sprinkler': put(SP.sprinkler(), (lawnLo + lawnHi) / 2, v); break;
    case 'junk': put([SP.tires(), SP.fridge(), SP.couch(0x8a5a2a)][sd % 3], far, v, 1); break;
    case 'woodpile': put(SP.woodpile(sd), far, Math.min(out - .6, 1.2), 0); break;
  }
}
// the back yard's free rect (metres, lot-local): behind the house, inside the fences
function backZone(s) { const L = layoutOf(s), b = L.body, W = s.W, D = s.D; let u0 = .5, u1 = W - .5; const v0 = b[3] / 10 + .75, v1 = D - .55;
  if (L.detached) { const g = L.garage; if (g[0] < s.W10 / 2) u0 = Math.max(u0, g[2] / 10 + .5); else u1 = Math.min(u1, g[0] / 10 - .5); }
  return { u0, u1, v0, v1, w: u1 - u0, d: v1 - v0 }; }
function backThing(ctx, s, ex, k, z) {
  if (ex === 'none') return; const sd = s.seed + k, cu = (z.u0 + z.u1) / 2, cv = (z.v0 + z.v1) / 2, side = k ? (H(s, 60) < .5 ? z.u0 + 1.2 : z.u1 - 1.2) : cu;
  const put = (bk, u, v, q = 0, o = {}) => lput(ctx, s, bk, u, v, q, { slide: [1, 0], reach: o.reach ?? Math.max(.6, z.w / 2 - 1.2) });
  switch (ex) {
    case 'pool': if (z.d >= 3.2 && z.w >= 6 && !k) { inPool(ctx, s, z); return; } put(SP.pool(sd), cu, cv); break;
    case 'aboveground': if (z.d >= 3.7) put(SP.pool(sd), side, cv); else put(kiddiePool(), side, cv); break;
    case 'trampoline': if (z.d >= 3.1) put(SP.trampoline(sd), side, cv); break;
    case 'swing': put(SP.swingset(sd), side, cv, 0); break;
    case 'shed': put(SP.barn([0xc8323a, 0x6d707a, 0x2f7a4a, 0xe6e1d6][sd % 4], sd), H(s, 61) < .5 ? z.u0 + 1.4 : z.u1 - 1.4, z.v1 - 1.2, 2, { reach: 1.5 }); break;
    case 'doghouse': put(SP.doghouse([0xc8323a, 0x2f5bff, 0xe6e1d6][sd % 3]), side, z.v1 - .8, 0); break;
    case 'clothesline': put(SP.clothesline(sd), cu, cv, 0); break;
    case 'garden': put(SP.garden(sd), side, cv); break;
    case 'patio': put(SP.patio([0xe8232a, 0x14a83b, 0x2f5bff, 0xffe23a][sd % 4], sd), side, cv); put(grill(), side + (side < cu ? 1.9 : -1.9), cv - .2, 0, { reach: .6 }); break;
    case 'hottub': put(hotTub(), side, cv); break;
    case 'kpool': put(kiddiePool(), side, cv); break;
    case 'playhouse': put(SP.playhouse(sd), side, cv, 0); break;
    case 'treehouse': put(SP.swingset(sd + 1), side, cv); break;
    case 'woodpile': put(SP.woodpile(sd), side, z.v1 - .5, 0); break;
    case 'firepit': put(SP.firepit(), cu, cv); break;
    case 'junk': put(SP.tires(), side, cv); put(SP.fridge(), side + (side < cu ? 1.2 : -1.2), cv, 2); break;
    case 'hoop': put(hoop(), side, z.v1 - .4, 0); break;
  }
}
// an in-ground pool: a coping ring round turquoise water, a diving board, two loungers (a structure: props keep off it)
function inPool(ctx, s, z) {
  const pw = Math.min(6.4, z.w - 1.2), pd = Math.min(3.4, z.d - .6), u0 = (z.u0 + z.u1) / 2 - pw / 2, v0 = z.v0 + (z.d - pd) / 2, F = frameOf(s.l), [x0, z0, x1, z1] = F.rect(u0, v0, u0 + pw, v0 + pd);
  const V = ctx.volume(+x0.toFixed(1), SIDE, +z0.toFixed(1), +x1.toFixed(1), SIDE + .3, +z1.toFixed(1)), nx = V.nx, nz = V.nz, kidney = H(s, 70) < .4;
  V.box(0, 0, 0, nx, 2, nz, (x, y, zz) => { const e = Math.min(x, zz, nx - 1 - x, nz - 1 - zz), cut = kidney && Math.hypot(x - nx * .5, zz - (F.f > 0 ? nz : -1)) < nz * .45;
    if (cut) return undefined; if (e < 2) return y === 1 ? 0xf2efe6 : 0xe6e1d6; return y === 0 ? (((x + zz) % 9 === 0) ? 0x7fe3f5 : 0x2fc1e8) : undefined; }, 1);
  REG.keep([x0, SIDE, z0, x1, SIDE + .35, z1], 'pool');
  lput(ctx, s, lawnChairC(s), u0 - .6, v0 + pd / 2, 1, { slide: [0, 1], reach: .8 }); lput(ctx, s, lawnChairC(s, 1), u0 + pw + .6, v0 + pd / 2, 3, { slide: [0, 1], reach: .8 });
}
const lawnChairC = (s, k = 0) => lawnChair([0xff4fa3, 0x2de2e6, 0xffe23a, 0x2f5bff][(H(s, 80 + k) * 4) | 0]);

// ── ONE-OFF SCENES (one lot on about two blocks in three): their words are the kit's own signs, each unique in the district
// the widest strip of front lawn (metres, lot-local): between the lot line, the drive and the path, in front of the stoop line
export function frontLawn(s) { const L = layoutOf(s), W = s.W, [d0, , d1] = L.drive.map(x => x / 10), du = L.door / 10, out = (L.body[1] - (s._out ?? 17)) / 10, fv = s.fence === 'hedge' ? .7 : s.fence === 'wall' ? .4 : .2;
  const cuts = [[d0 - .3, d1 + .3], [du - .8, du + .8]].sort((a, b) => a[0] - b[0]), segs = []; let u = .3;
  for (const [a, b] of cuts) { if (a - u > .5) segs.push([u, a]); u = Math.max(u, b); } if (W - .3 - u > .5) segs.push([u, W - .3]);
  const [u0, u1] = segs.sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]))[0] || [.3, 1]; return { u0, u1, v0: fv, v1: out - .3, w: u1 - u0, d: out - .3 - fv }; }
export function oneOff(ctx, s) {
  const kind = s.oneOff; if (!kind) return; const L = layoutOf(s), W = s.W, [d0, dv0, d1, dv1] = L.drive.map(x => x / 10), dc = (d0 + d1) / 2, dl = dv1 - dv0, F = frameOf(s.l), n = Math.abs(s.i * 7 + s.j * 3) + 1;
  const lawn = frontLawn(s), lc = (lawn.u0 + lawn.u1) / 2, lv = (lawn.v0 + lawn.v1) / 2;
  const put = (bk, u, v, q = 0, o = {}) => lput(ctx, s, bk, u, v, q, { slide: o.slide ?? [1, 0], reach: o.reach ?? .8 });
  const onDrive = (bk, v, q = 0) => lput(ctx, s, bk, dc, v, q, { slide: [0, 1], reach: Math.max(.2, dl / 2 - 1) });
  const sign = (words, u, v) => { const bk = board(words, { bg: [0xffe23a, WHITE, 0x2de2e6, 0xff4fa3][n & 3], fg: INK, posts: 1, h: .5 }); if (put(bk, u, v, 0, { reach: 1 })) { const [x, z] = F.at(u, v); logSign(words.replace('/', ' '), x, z); } };
  const mouth = d0 > W / 2 ? d0 - 1.3 : d1 + 1.3;   // the lawn beside the drive's mouth
  switch (kind) {
    case 'yardSale': onDrive(SP.saleTable(n), dv0 + 1.1); onDrive(SP.saleTable(n + 1), dv0 + 2.5); if (dl > 5) onDrive(SP.rack(), dv0 + 3.9); sign(s.oneOffText || 'YARD SALE', mouth, .6); break;
    case 'party': { const ok = dl > 3.8 && onDrive(SP.bouncy(n), dv0 + 2.1); if (!ok) put(SP.bouncy(n), lc, lv, 0, { reach: lawn.w / 2 }); put(SP.balloons(), mouth, .6); put(SP.saleTable(n + 2), lc, Math.max(lawn.v0 + .6, lv), 0, { reach: lawn.w / 2 }); break; }
    case 'carBlocks': onDrive(carOnBlocks(n), dv1 - 2.4); onDrive(SP.tires(), dv0 + .7); break;
    case 'moving': if (dl > 7) onDrive(SP.truck(0xff7a1a), dv1 - 3.4); put(SP.boxes(n), lc, lv, 0, { reach: lawn.w / 2 }); put(SP.couch([0x7a3cff, 0x8a5a2a, 0x2f7a4a][n % 3]), lc, lv + .9, 0, { reach: lawn.w / 2 }); break;
    case 'lemonade': { const u = lawn.u0 + 1.1 < lawn.u1 - 1.1 ? lawn.u0 + 1.1 : lc; put(SP.lemonade(), u, Math.max(lawn.v0 + .7, .8), 0, { reach: lawn.w / 2 }); sign(s.oneOffText || 'LEMONADE/25¢', u + 1.6, .6); break; }
    case 'carWash': onDrive(car(n * 5 + 3), dv1 - 2.4); onDrive(SP.bucket(), dv0 + .5); break;
    case 'fixer': onDrive(SP.dumpster(), dv1 - 2.4); put(SP.boxes(n + 1), lc, lv, 0, { reach: lawn.w / 2 }); break;
    case 'treeDown': put(SP.logs(), lc, lv, 0, { reach: lawn.w / 2 }); break;
    case 'camping': { const z = backZone(s); put(SP.tent([0xff7a1a, 0x2f5bff, 0x14a83b][n % 3]), (z.u0 + z.u1) / 2, (z.v0 + z.v1) / 2, 1, { reach: 1.5 }); break; }
    case 'sprinklerFun': put(SP.slide(), lc, lv, 1, { reach: lawn.w / 2 }); put(SP.sprinkler(), lc, Math.max(lawn.v0 + .6, lv - 1), 0, { reach: lawn.w / 2 }); break;
    case 'hotrod': onDrive(SP.hotrod(), dv1 - 2.4); onDrive(SP.tires(), dv0 + .7); break;
    case 'xmas': put(SP.snowman(), lc, lv, 0, { reach: lawn.w / 2 }); break;
  }
}
