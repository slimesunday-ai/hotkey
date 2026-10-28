// SUNNY ACRES · one pad: the home, its porch, a carport or a gravel strip, fences, the car, the yard's life, what's out back, the pad
// number, sometimes a hand-painted sign, and the anchor the sim-state layer draws on (lights, FOR RENT, locks, safes, scars).
// Nothing leaves the pad's own rect. The back 2 m of facing rows overlap: each pad uses only its own half of that strip (the pad in the
// north row of a pair the west half, the south row the east half; the rows at the park's edge have theirs to themselves).
// Placement: every prop looks for a spot in a zone of the pad (candidates nearest a preferred point first, a little jitter so no two
// pads come out alike) and takes the first one the registry says is clear — then the engine's strict put checks it again.
// Pass 3 (breaking the grid): most homes sit a few degrees off square. A turned home is meshed as one template with its porch and turned
// into place (vox.js stampA); its footprint (the turned shape's box) and door are registered by hand, its anchors are turned with it, and
// its porch furniture is turned onto the boards. Cars park askew, fences come in mismatched runs, paths are worn across the dirt.
import { REG, bankBox } from '../../audit.js';
import { Bank, meshVol, stampA } from '../../vox.js';
import { PAL, CV, SIDE, hash, shade } from '../../style.js';
import { carOnBlocks, grill, lawnChair, couch, kiddiePool, bike, tires, laundry, coop, trashCan, potPlant, milkCrate, speaker, picnic, streetTree } from '../../props.js';
import { board } from './brush.js';
import { frameOf, ONE_OFF, padAt } from './plan.js';
import { buildHome, homeRect, drawDeck, rotXZ, FLOOR } from './homes.js';
import * as TP from './props.js';

const WD = PAL.wood, GALV = 0xb9bcc4, TURF = 0x3fbf4f;
const CARC = [0xe8232a, 0x2f5bff, 0xf7f7f2, 0x17171b, 0x25b84c, 0x8a3cff, 0xff7a1a, 0x12b3a0, 0xc49a6c, 0x6d707a];
const COL = [0xe8232a, 0x2f5bff, 0x25b84c, 0xffc21a, 0xff4fa3, 0x12b3a0, 0xff7a1a];

// the porch (pad-local rect; homeRect sizes it with the home so every block agrees on it)
export function deckOf(p) { const H = homeRect(p); return { ...H.deck, doorU: H.doorU }; }
function buildDeck(ctx, p, dk) { const [x0, z0, x1, z1] = frameOf(p).rect(dk.u0, dk.v0, dk.u1, dk.v1), V = ctx.volume(x0, SIDE, z0, x1, SIDE + (dk.kind === 'rail' ? 13 : 3) * CV, z1, { walk: true }); drawDeck(V, p, dk, true); }
// a carport: four posts and a ribbed metal roof over the side strip (nose-ins); it stands on the strip's gravel
function buildCarport(ctx, p, u0, u1, v0, v1, base = CV) {
  const F = frameOf(p), [x0, z0, x1, z1] = F.rect(u0, v0, u1, v1), H = 24, V = ctx.volume(x0, SIDE + base, z0, x1, SIDE + base + (H + 2) * CV, z1, { ground: false }), nx = V.nx, nz = V.nz, c = [GALV, 0xe6e1d6, 0xd3d4d7, 0xc49a6c][(hash(p.spec.seed, 51) * 4) | 0];
  for (const [x, z] of [[0, 0], [nx - 2, 0], [0, nz - 2], [nx - 2, nz - 2]]) { V.box(x, 0, z, x + 2, H, z + 2, shade(c, .8)); REG.keep([V.org[0] + x * CV - .03, SIDE, V.org[2] + z * CV - .03, V.org[0] + (x + 2) * CV + .03, SIDE + base + H * CV, V.org[2] + (z + 2) * CV + .03], 'carport'); }
  V.box(0, H, 0, nx, H + 1, nz, (x, y, z) => ((F.f > 0 ? z : x) % 4 === 0) ? shade(c, .88) : c); V.box(0, H + 1, 1, nx, H + 2, nz - 1, (x) => (x % 4 === 0) ? shade(c, .9) : undefined);
  REG.keep([x0, SIDE + base + (H - 1) * CV, z0, x1, SIDE + base + (H + 2) * CV, z1], 'carport');
}
// the pad's ground: one voxel over the pad (never the shared back 2 m), walkable. Holes where a square home, its porch and the FOR RENT
// sign stand on the slab; regions paint the side strip's gravel and a lawn; `paint(u, v)` wears paths and tyre tracks into it
export const COVERS = { gravel: [0xcfc3ab, 0xbdb098], dirt: [0xb89568, 0xa4845a], grass: [0x86b35c, 0x74a04d], dry: [0xbdb56e, 0xa9a05c] };
function cover(ctx, p, kind, regions, holes, paint) {
  const F = frameOf(p), [x0, z0, x1, z1] = F.rect(0, 2, 8, 12), V = ctx.volume(x0, SIDE, z0, x1, SIDE + CV, z1, { walk: true }), [b0, b1] = COVERS[kind], lx = p.l.x0, lz = p.l.z0;
  const vr = r => { const [a, b, c, d] = F.rect(r[0], r[1], r[2], r[3]); return [Math.round((a - x0) / CV), Math.round((b - z0) / CV), Math.round((c - x0) / CV), Math.round((d - z0) / CV)]; };
  const Hs = holes.map(vr), R = regions.map(([r, c0, c1]) => [vr(r), c0, c1]), inR = (q, x, z) => x >= q[0] && x < q[2] && z >= q[1] && z < q[3];
  V.box(0, 0, 0, V.nx, 1, V.nz, (x, y, z) => { for (const q of Hs) if (inR(q, x, z)) return undefined; const wx = x0 + (x + .5) * CV, wz = z0 + (z + .5) * CV;
    const u = F.f > 0 ? wx - lx : lx + 8 - wx, v = F.f > 0 ? wz - lz : lz + 12 - wz, pc = paint?.(u, v, wx, wz); if (pc !== undefined) return pc;
    for (const [q, c0, c1] of R) if (inR(q, x, z)) return hash(Math.floor(wx / .3), Math.floor(wz / .3), 7) > .86 ? c1 : c0;
    return hash(Math.floor(wx / .4), Math.floor(wz / .4), 3) > .84 ? b1 : b0; });
  return V;
}
// fences: chain link, white pickets, pallets on end, corrugated tin, lattice panels, split rails (a run along u or along v)
function fence(ctx, p, kind, u0, v0, u1, v1) {
  const F = frameOf(p), [x0, z0, x1, z1] = F.rect(u0, v0, u1, v1), hgt = { picket: 9, pallet: 12, tin: 15, lattice: 11, rail: 9, chain: 13 }[kind] ?? 12, alongX = (x1 - x0) >= (z1 - z0);
  const V = ctx.volume(x0, SIDE + CV, z0, Math.max(x1, x0 + CV), SIDE + (hgt + 1) * CV, Math.max(z1, z0 + CV), { keep: 'fence', ground: false }), n = alongX ? V.nx : V.nz, sd = p.spec.seed;
  for (let k = 0; k < n; k++) for (let y = 0; y < hgt; y++) { let c;
    if (kind === 'chain') c = (k % 25 === 0 || k === n - 1 || y === hgt - 1) ? 0x9a9ca4 : ((k + y) % 2 === 0 ? GALV : undefined);
    else if (kind === 'picket') c = (k % 3 === 0 || y === 3 || y === 7) && !(y === hgt - 1 && k % 3 !== 0) ? PAL.white : undefined;
    else if (kind === 'tin') c = (k % 24 === 0) ? 0x8a5a2a : hash(k >> 3, y >> 2, sd) > .82 ? 0xa0552c : ((k & 1) ? 0xb9bcc4 : 0x9a9ca4);   // sheets on wood posts, rust patches
    else if (kind === 'lattice') c = (k % 20 === 0 || y === 0 || y === hgt - 1) ? 0xf2efe6 : (((k + y) % 4 === 0 || (k - y + 400) % 4 === 0) ? 0xe6e1d6 : undefined);
    else if (kind === 'rail') c = (k % 20 === 0 && y < hgt) || y === 3 || y === 7 ? (hash(k >> 4, 3, sd) > .5 ? 0x8a5a2a : 0x6e4a2a) : undefined;
    else c = (k % 12 < 11) && ((k % 12) % 3 === 0 || y % 4 === 0) ? (((k / 12) | 0) % 2 ? WD : shade(WD, .82)) : undefined;
    if (c !== undefined) for (let d = 0; d < (alongX ? V.nz : V.nx); d++) { if (alongX) V.set(k, y, d, c); else V.set(d, y, k, c); } }
  return V;
}
// find a clear spot for a prop in a pad-local zone [u0, v0, u1, v1] (its centre), nearest `near` first (with a little jitter), its box
// inside the pad (and inside o.clip, a pad-local rect, when given)
function inPad(p, F, bx, o) { const r = p.rect, back = o.back ? 0 : 2, minZ = F.f > 0 ? r[1] + back : r[1], maxZ = F.f > 0 ? r[3] : r[3] - back;
  if (bx[0] < r[0] + .03 || bx[3] > r[2] - .03 || bx[2] < minZ + .03 || bx[5] > maxZ - .03) return false;
  if (o.clip) { const [cx0, cz0, cx1, cz1] = F.rect(...o.clip); if (bx[0] < cx0 - 1e-6 || bx[3] > cx1 + 1e-6 || bx[2] < cz0 - 1e-6 || bx[5] > cz1 + 1e-6) return false; }
  return true; }
function candidates(p, zone, o) { const [u0, v0, u1, v1] = zone, st = o.step ?? .25, near = o.near ?? [(u0 + u1) / 2, (v0 + v1) / 2], salt = (o.salt ?? 0) + p.n * 13, c = [];
  for (let u = u0; u <= u1 + 1e-6; u += st) for (let v = v0; v <= v1 + 1e-6; v += st) c.push([u, v, Math.hypot(u - near[0], v - near[1]) + hash(Math.round(u * 8), Math.round(v * 8), salt) * (o.jitter ?? .5)]);
  return c.sort((a, b) => a[2] - b[2]); }
export function spot(ctx, p, bk, zone, q = 0, o = {}) {
  const F = frameOf(p), rot = F.rot(q), sf = REG.blk?.surfaces || [];
  for (const [u, v] of candidates(p, zone, o)) { const [x, z] = F.at(u, v), bx = REG.boxOf(bk, rot, x, SIDE, z);
    if (!inPad(p, F, bx, o)) continue;
    if (sf.some(f => bx[0] < f.box[3] && bx[3] > f.box[0] && bx[2] < f.box[5] && bx[5] > f.box[2] && !(bx[0] >= f.box[0] - .01 && bx[3] <= f.box[3] + .01 && bx[2] >= f.box[2] - .01 && bx[5] <= f.box[5] + .01))) continue;
    if (REG.why(bx)) continue;
    const at = ctx.put(bk, x, z, { rot, reach: 0 }); if (at) return at; }
  if (!o.quiet) { const nr = o.near ?? [(zone[0] + zone[2]) / 2, (zone[1] + zone[3]) / 2], [nx, nz] = F.at(nr[0], nr[1]); REG.skip(bk.kind || 'prop', [+nx.toFixed(2), SIDE, +nz.toFixed(2)], 'no clear spot on pad ' + p.n); } return null;
}
// the same, turned dA radians off its quarter turn (a car parked anyhow): tested with its turned box, laid on the pad's ground (+0.1 m);
// if no turned spot is clear it goes down square
const aBox = (bk, a, x, y, z) => { const b = bankBox(bk), c = Math.cos(a), s = Math.sin(a); let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
  for (const px of [b[0], b[3]]) for (const pz of [b[2], b[5]]) { const X = px * c + pz * s + x, Z = -px * s + pz * c + z; x0 = Math.min(x0, X); x1 = Math.max(x1, X); z0 = Math.min(z0, Z); z1 = Math.max(z1, Z); }
  return [x0, b[1] + y, z0, x1, b[4] + y, z1]; };
function spotA(ctx, p, bk, zone, q, dA, o = {}) {
  const F = frameOf(p), a = F.rot(q) * Math.PI / 2 + dA, y = SIDE + CV;
  if (Math.abs(dA) > .01) for (const [u, v] of candidates(p, zone, o)) { const [x, z] = F.at(u, v), bx = aBox(bk, a, x, y, z);
    if (!inPad(p, F, bx, o) || REG.why(bx)) continue; stampA(bk, ctx.bank, a, x, y, z); return [x, z]; }
  return spot(ctx, p, bk, zone, q, o);
}

// ── the pad
export function buildPad(ctx, p, o = {}) {
  const s = p.spec, F = frameOf(p), H = homeRect(p), t = s.type, h = k => hash(s.seed, k, 97), one = o.one ?? ONE_OFF[p.n] ?? {}, g = 'P' + p.n, turned = !!H.rad;
  ctx.group(g);
  const dk = deckOf(p), doorRight = H.doorU >= 4, [hx, hz] = H.centre, T = (x, z) => rotXZ(x, z, hx, hz, H.rad);
  // where the porch step comes down (turned with the home), in pad-local terms: the path to the lane starts there
  const [sx0, sz0] = T(...F.at(H.doorU, dk.v1)), stepU = F.f > 0 ? sx0 - p.l.x0 : p.l.x0 + 8 - sx0, stepV = F.f > 0 ? sz0 - p.l.z0 : p.l.z0 + 12 - sz0;
  // the lawn sign (FOR RENT, drawn by the sim-state layer) stands in the front corner away from the door; keep it clear
  const signU = doorRight ? 1.4 : 6.6, signV = 11.4, [sx, sz] = F.at(signU, signV), SG = [signU - 1.2, 11.1, signU + 1.2, 11.7], sgn = F.rect(...SG);   // (on the 0.1 grid: the keep and the ground's hole agree)
  REG.keep([sgn[0], SIDE, sgn[1], sgn[2], SIDE + 2.1, sgn[3]], 'forrent');
  if (!o.noPath) { const pth = F.rect(stepU - .6, stepV, stepU + .6, 12); REG.keep([pth[0], SIDE, pth[1], pth[2], SIDE + 2, pth[3]], 'path'); }
  // the facing pad's home, when another block builds it: nothing of ours goes there
  const mate = padAt([-1, 2, 1, 4, 3, -1][p.r], p.c); if (mate && (mate.i !== ctx.i || mate.j !== ctx.j)) { const A = homeRect(mate).aabb; REG.keep([A[0] - .3, SIDE, A[1] - .3, A[2] + .3, SIDE + 6, A[3] + .3], 'neighbour'); }
  // ── structures: a side strip (gravel, a carport over it on nose-ins), a lawn, the ground, the porch, the home, fences
  const AU = H.aabbUV;
  let side = t === 'nose' || H.L <= 4.8 ? (s.side ? [.3, AU[0] - .2] : [AU[2] + .2, 7.7]) : null; if (side && side[1] - side[0] < 2.2) side = null;
  let carSlot = null;
  if (side) carSlot = { u: (side[0] + side[1]) / 2, v: t === 'nose' ? 6.3 : 7.5, along: 'v' };
  else if (H.carU) carSlot = { u: doorRight ? 2.35 : 5.65, v: 9.95, along: 'u' };
  if (o.noCar) carSlot = null;
  const kinds = ['gravel', 'dirt', 'grass', 'dry'], kind = o.ground ?? kinds[(p.r + p.c * 3 + (h(20) < .3 ? 1 : 0)) % 4], regions = [], hr = o.holes ? [...o.holes] : [];
  if (side) regions.push([[side[0] + .1, t === 'nose' ? 2.6 : 4.4, side[1] - .1, 11.3], t === 'nose' ? 0xd9d2c3 : 0xcfc9bd, 0xbfb8aa]);
  let lawn = null;
  if (s.yard[0] < .4 && !o.noYard && carSlot?.along !== 'u' && kind !== 'grass') { let [la, lb] = doorRight ? [.3, dk.u0 - .3] : [dk.u1 + .3, 7.7];
    if (side) { if (side[0] < H.u0) la = Math.max(la, side[1] + .15); else lb = Math.min(lb, side[0] - .15); }
    if (lb - la > 1.2) { lawn = [la, dk.v0 + .2, lb, 10.9]; regions.push([lawn, s.yard[1] < .5 ? 0x86b35c : TURF, s.yard[1] < .5 ? 0x74a04d : 0x36a845]); } }
  if (!turned) { hr.push([H.u0, H.v0, H.u1, H.v1], [dk.u0, dk.v0, dk.u1, dk.v1]); if (H.addon) hr.push([H.addon.u0, H.addon.v0, H.addon.u1, H.addon.v1]); }
  hr.push(SG);
  // worn into the ground: the path from the porch step to the lane (it wanders), a short cut across the side yard, tyre tracks to the car
  const DIRT = kind === 'dirt' ? 0x8f7048 : 0xa4845a, TRACK = kind === 'gravel' ? 0xa89e8a : 0x9c7c52, ph = h(21) * 6;
  const ax = s.desire === 0 ? .5 : 7.5, bu = s.desire === 0 ? 7.5 : .5, lenD = Math.hypot(bu - ax, 11.8 - 2.6);
  const paint = (u, v) => {
    if (s.worn && v > stepV && Math.abs(u - (stepU + .3 * Math.sin(v * 1.6 + ph))) < .38 && hash(Math.round(u * 5), Math.round(v * 5), p.n) > .12) return DIRT;
    if (s.desire >= 0) { const tt = ((u - ax) * (bu - ax) + (v - 11.8) * (2.6 - 11.8)) / (lenD * lenD); if (tt > 0 && tt < 1) { const du = u - (ax + (bu - ax) * tt), dv = v - (11.8 + (2.6 - 11.8) * tt); if (Math.hypot(du, dv) < .26 && hash(Math.round(u * 6), Math.round(v * 6), p.n + 5) > .2) return DIRT; } }
    if (carSlot?.along === 'v' && v > carSlot.v - 1.6 && Math.abs(Math.abs(u - carSlot.u) - .72) < .16) return TRACK;
    return undefined; };
  cover(ctx, p, kind, regions, hr, paint);
  if (side && t === 'nose') buildCarport(ctx, p, side[0], side[1], 3.2, 9.4);
  if (!turned) buildDeck(ctx, p, dk);
  const home = buildHome(ctx, p, { deckD: Math.round(dk.d / CV), roofText: one.roof, roofBoat: one.extra === 'roofboat', template: turned });
  // the pad number on the end wall (drawn now, before the home is meshed)
  const numStyle = (p.n * 7 + 3) % 3, plated = numStyle === 1 && plate(home, p.n, s, doorRight);
  if (turned) {   // the porch joins the home's volume, the whole is meshed about the home's centre and turned into place
    drawDeck(home.V, p, dk); const V = home.V; V.org = [V.org[0] - hx, V.org[1] - SIDE, V.org[2] - hz];
    const tb = new Bank(); meshVol(V, tb); stampA(tb, ctx.bank, H.rad, hx, SIDE, hz);
    const A = H.aabb; REG.footprint(A[0], A[1], A[2], A[3], home.top, home.roofY); REG.keep([A[0] - .35, SIDE, A[1] - .35, A[2] + .35, SIDE + 3.2, A[3] + .35], 'plinth');
    const [dx, dz] = T(home.doorXZ[0], home.doorXZ[1]); home.doorXZ = [dx, dz]; home.door = [+(dx + home.face[0] * .55).toFixed(2), SIDE, +(dz + home.face[1] * .55).toFixed(2)];
    home.wins = home.wins.map(([x, y, z, w, hh, r]) => { const [a, b] = T(x, z); return [+a.toFixed(2), y, +b.toFixed(2), w, hh, r]; }); }
  REG.door(home.doorXZ[0] + home.face[0] * .5, home.doorXZ[1] + home.face[1] * .5, home.rot);
  // fences: the front run in two materials either side of the gate (or one missing), a side fence in a third
  if (!o.noYard) {
    if (s.fence === 'pallet' && !H.hitch && (doorRight ? 7.8 - AU[2] : AU[0] - .2) >= .4) fence(ctx, p, 'pallet', doorRight ? 7.8 : .1, 2.4, doorRight ? 7.9 : .2, 9.0);
    else if (s.fence !== 'none' && s.fence !== 'pallet' && (!carSlot || carSlot.along === 'v')) { const gate = [stepU - .7, stepU + .7], cs = carSlot ? [carSlot.u - 1.4, carSlot.u + 1.4] : null;
      const runs = [[.1, gate[0]], [gate[1], 7.9]].flatMap(([a, b]) => cs && cs[0] < b && cs[1] > a ? [[a, cs[0]], [cs[1], b]] : [[a, b]]).filter(([a, b]) => b - a > .4);
      runs.forEach(([a, b], k) => { const kd = k % 2 && s.fence2 !== 'none' ? s.fence2 : s.fence; if (kd !== 'none') fence(ctx, p, kd, a, 11.9, b, 12.0); }); }
    const sf = s.sideFence; if (sf && !(side && (sf.side === 0 ? side[0] < 1 : side[1] > 7))) { const u = sf.side ? 7.8 : .1; fence(ctx, p, sf.type, u, 2.3, u + .1, Math.min(10.6, sf.v1)); } }
  ctx.finish();   // (mesh this pad's volumes now, so their ids carry the pad's group)
  ctx.group(g);
  // ── the meter post at the back (u 1, v 1: in this pad's own half of the back strip)
  { const [mx, mz] = F.at(1, 1); ctx.put(TP.pedestal(), mx, mz, { rot: F.rot(0), reach: 0 }); }
  // ── the car (on the side strip, nose in, or along the lane in front), parked anyhow
  if (carSlot) { const vs = s.vehicle === 'none' ? 'sedan' : s.vehicle, cc = CARC[(h(1) * CARC.length) | 0];
    const bk = one.extra === 'forsale' ? TP.sedan(0x2f5bff, 1) : vs === 'pickup' ? TP.pickup(cc, (h(2) * 3) | 0) : vs === 'van' && t !== 'nose' ? TP.van(cc, h(3) < .5 ? CARC[(h(4) * CARC.length) | 0] : 0) : vs === 'moto' ? TP.motorbike(cc) : vs === 'blocks' ? carOnBlocks((h(5) * 3) | 0) : TP.sedan(cc, (h(6) * 3) | 0);
    const q = carSlot.along === 'v' ? (h(7) < .5 ? 0 : 2) : (h(7) < .5 ? 1 : 3), dA = carSlot.along === 'v' ? s.carAng : s.carAng * .28;
    const zone = carSlot.along === 'v' ? [carSlot.u, carSlot.v - .8, carSlot.u, carSlot.v + .8] : doorRight ? [2.3, carSlot.v, Math.max(2.3, stepU - 2.9), carSlot.v] : [Math.min(5.7, stepU + 2.9), carSlot.v, 5.7, carSlot.v];
    if (!spotA(ctx, p, bk, zone, q, dA, { near: [carSlot.u, carSlot.v], step: .2, jitter: 0, quiet: true })) spot(ctx, p, TP.motorbike(cc), [.3, carSlot.v - .6, 7.7, carSlot.v + .6], carSlot.along === 'v' ? 0 : 1, { near: [carSlot.u, carSlot.v], step: .2 }); }
  // ── the pad number: a plate on the end wall (above), else a mailbox by the path or a post at the corner
  const lane = [.15, 10.95, 7.85, 11.85], mU = Math.max(.5, Math.min(7.5, stepU + (doorRight ? -1.05 : 1.05)));
  if (!plated) spot(ctx, p, numStyle === 2 ? numberPost(p.n, p.n % 4) : TP.mailbox(p.n, p.n % 5), lane, 0, { near: [mU, 11.4], jitter: .1 });
  // ── one-off: a hand-painted sign on the lane edge and its scene
  if (one.sign) { const bd = board(one.sign, { kind: 'yard-sign', h: .5, ...one.signStyle });
    if (!spot(ctx, p, bd, lane, 0, { near: [doorRight ? 3.2 : 4.8, 11.5], jitter: .2, quiet: true })) spot(ctx, p, bd, [.15, dk.v1 + .2, 7.85, 11.85], 0, { near: [doorRight ? 3.2 : 4.8, 11.5], jitter: .2 }); }
  if (!o.noYard) { yard(ctx, p, H, dk, carSlot, one, home, lawn, side); backYard(ctx, p, H); }
  // ── the anchor: where the sim-state layer draws this pad's state
  const [yx, yz] = F.at(Math.max(.5, Math.min(7.5, stepU + (doorRight ? -1.8 : 1.8))), Math.min(10.9, stepV + .8));
  ctx.anchor.lot(p.id, { tier: 'trailer', rot: home.rot, face: home.face, door: home.door, sign: [+sx.toFixed(2), +sz.toFixed(2)], yard: [+yx.toFixed(2), +yz.toFixed(2)],
    wall: [+hx.toFixed(2), +(SIDE + 1.6).toFixed(2), +(home.doorXZ[1]).toFixed(2), +(H.rect[2] - H.rect[0]).toFixed(2), 2.9], windows: home.wins, roof: +home.top.toFixed(2), house: H.aabb.map(v => +v.toFixed(2)), ...(turned ? { yaw: +H.rad.toFixed(4) } : {}) });   // (yaw: the home's turn off its quarter turn, radians, for a layer that can draw panes turned)
  return { home, H, dk, carSlot, side };
}
// the number on the end wall away from the door (painted plate, 0.1 grain, above the hitch); homes with round or cab ends skip it
function plate(home, n, s, doorRight) { if (['camper', 'bullet', 'bus', 'rv'].includes(s.type)) return false;
  const f = doorRight ? home.lf : home.rt, lab = String(n), w = lab.length * 6 - 1, a = doorRight ? f.len - w - 6 : 6, y = FLOOR + 21;
  if (a < 2 || a + w > f.len - 2) return false; f.box(a - 2, y - 9, 0, a + w + 2, y + 2, 1, s.neutral ? 0xffe23a : PAL.white); f.text(lab, a, y, 1, 2, PAL.ink, 0); return true; }
const numberPost = (n, st) => board(String(n), { kind: 'yard-sign', posts: 1, h: .7, bg: [0xf7f7f2, 0xffe23a, 0x17171b, 0x2de2e6][st], fg: st === 2 ? 0xf7f7f2 : 0x17171b, clean: true, pad: 2 });
// porch furniture on a turned home's boards: along the porch's back half, clear of the door, turned with the home
function porch(ctx, p, H, dk, list) {
  const F = frameOf(p), [hx, hz] = H.centre, used = [], lo = H.doorU - .8, hi = H.doorU + .8;
  for (const [bk, q] of list) { const bb = bankBox(bk), half = ((q & 1) ? bb[5] - bb[2] : bb[3] - bb[0]) / 2 + .06, dep = (q & 1) ? bb[3] - bb[0] : bb[5] - bb[2];
    if (dep > dk.d - .45) continue;
    for (let u = dk.u0 + half + .1; u <= dk.u1 - half - .1 + 1e-6; u += .1) { if (u + half > lo && u - half < hi) continue; if (used.some(([a, b]) => u + half > a && u - half < b)) continue;
      const [x0, z0] = F.at(u, dk.v0 + .14 + dep / 2), [x, z] = rotXZ(x0, z0, hx, hz, H.rad); stampA(bk, ctx.bank, F.rot(q) * Math.PI / 2 + H.rad, x, SIDE + .3, z); used.push([u - half, u + half]); break; } }
}

// ── the yard's life: a few things per pad, by the pad's own hash, each where it fits
function yard(ctx, p, H, dk, carSlot, one, home, lawn, sideStrip) {
  const F = frameOf(p), s = p.spec, h = k => hash(s.seed, k, 131), y = s.yard, doorRight = H.doorU >= 4, t = s.type, ex = one.extra, turned = !!H.rad, AU = H.aabbUV;
  const deckZ = dk.kind === 'metal' || turned ? null : [dk.u0 + .12, dk.v0 + .38, dk.u1 - .12, dk.v1 - .32];
  const frontTop = carSlot?.along === 'u' ? 8.95 : 10.85, front = [.2, AU[3] + .15, 7.8, frontTop], farU = doorRight ? .6 : 7.4, sideZ = carSlot?.along === 'v' ? null : (H.L <= 4.8 || t === 'nose') ? [doorRight ? .3 : AU[2] + .3, 2.2, doorRight ? AU[0] - .3 : 7.7, 10.8] : null;
  const S = (bk, zone, q, near, o = {}) => zone ? spot(ctx, p, bk, zone, q, { near, quiet: true, ...o }) : null;   // yard clutter is optional: it goes where it fits
  const edgeRow = p.r === 0 || p.r === 5, backClip = [.15, .12, edgeRow ? 7.85 : 3.9, AU[1] - .12];
  const X = (bk, zone, q, near, o = {}) => { for (const z of [zone, sideZ, deckZ, [.2, 2.2, 7.8, frontTop]].filter(Boolean)) { const at = spot(ctx, p, bk, z, q, { near, ...o, quiet: true }); if (at) return at; }
    if (backClip[3] > 1.4) { const at = spot(ctx, p, bk, [.3, .3, backClip[2] - .3, backClip[3] - .3], q, { near: [backClip[2] / 2, backClip[3] / 2], back: true, clip: backClip, quiet: true, step: .2 }); if (at) return at; }
    return spot(ctx, p, bk, [.15, 2.1, 7.85, 11.85], q, { near, ...o }); };   // the one-off scenes are not optional: every zone of the pad (its own back yard too), then a logged refusal
  const deckFar = [doorRight ? dk.u0 + .5 : dk.u1 - .5, dk.v0 + .9];
  // porch: chairs, a couch, a cooler, plants, the washer that never left (turned onto a turned home's boards)
  const k1 = (y[2] * 5) | 0, Q = { quiet: true };
  const set = k1 === 0 ? [[TP.resinChair(0xf2f2ee), 0], [TP.resinChair(h(1) < .5 ? 0xf2f2ee : 0x2f7a3a), 0]] : k1 === 1 ? [[couch(COL[(h(2) * COL.length) | 0]), 0]] : k1 === 2 ? [[TP.cooler(h(4) < .5 ? 0xe8232a : 0x2f5bff), 0], [lawnChair(COL[(h(3) * COL.length) | 0]), 0]]
    : k1 === 3 ? [[potPlant((h(5) * 3) | 0), 0], [TP.bucketGarden((h(6) * 3) | 0), 0], [TP.resinChair(0xf2f2ee), 0]] : [[h(7) < .5 ? TP.washer() : TP.fridge(h(8) < .5 ? 0xf2f2ee : 0xe8d9b0), 0]];
  if (turned && dk.kind !== 'metal') porch(ctx, p, H, dk, set);
  else if (deckZ) set.forEach(([bk, q], k) => S(bk, deckZ, q, deckFar, k ? Q : {}));
  // the grill or the smoker, a fire pit with chairs, the burn barrel
  const k2 = (y[3] * 6) | 0, near2 = [farU, AU[3] + .8];
  if (k2 === 0) S(grill(), front, 0, near2);
  else if (k2 === 1) S(TP.smoker(), front, 0, near2);
  else if (k2 === 2) { const at = S(TP.firePit(p.n), front, 0, [4, AU[3] + 1.4], Q); if (at) { S(TP.resinChair(0xf2f2ee), front, 1, [3, AU[3] + 1.4], Q); S(TP.resinChair(0xe8232a), front, 3, [5, AU[3] + 1.4], Q); } else S(grill(), front, 0, near2); }
  else if (k2 === 3) S(TP.burnBarrel(), sideZ || front, 0, [farU, 3]);
  // kids, deco, utility
  const k3 = (y[4] * 10) | 0, kid = [doorRight ? 1.4 : 6.6, AU[3] + 1.2];
  if (k3 === 0) S(kiddiePool(), front, 0, kid);
  else if (k3 === 1) S(TP.slide(COL[(h(9) * COL.length) | 0]), front, 1, kid);
  else if (k3 === 2) S(bike(COL[(h(10) * COL.length) | 0]), front, 1, kid);
  else if (k3 === 3) S(TP.playhouse(COL[(h(11) * COL.length) | 0]), sideZ || front, 0, kid);
  else if (k3 === 4 && !carSlot && !sideZ) S(TP.trampoline(COL[(h(12) * COL.length) | 0]), [2, AU[3] + 2, 6, 9.9], 0, [4, 8.5]);
  const k4 = (y[5] * 9) | 0, edge = [.15, 10.9, 7.85, 11.85], edgeNear = [farU, 11.3];
  if (k4 === 0) for (let q = 0; q < 2 + (p.n % 2); q++) S(TP.flamingo(q), edge, q & 1 ? 1 : 0, edgeNear, { step: .15, jitter: .3 });
  else if (k4 === 1) for (let q = 0; q < 3; q++) S(TP.gnome([0xe8232a, 0x2f5bff, 0x25b84c][q]), edge, 0, edgeNear, { step: .15, jitter: .2 });
  else if (k4 === 2) for (let q = 0; q < 3; q++) S(TP.pinwheel(COL[(q + p.n) % COL.length]), edge, 0, edgeNear, { step: .15, jitter: .3 });
  else if (k4 === 3) { S(TP.tikiTorch(), front, 0, [dk.u0 - .3, AU[3] + .3]); S(TP.tikiTorch(), front, 0, [dk.u1 + .3, AU[3] + .3]); }
  else if (k4 === 4) S(TP.smallDish(p.n), sideZ || front, 0, [farU, 3.2]);
  else if (k4 === 5 && !carSlot) S(laundry(p.n), [2.2, AU[3] + .5, 5.8, 10.6], 0, [4, 9.5]);
  // propane by the wall, tyres, pallets or blocks round the side
  const k5 = (hash(s.seed, 33, 7) * 6) | 0, byWall = [doorRight ? AU[0] - .5 : AU[2] + .5, H.v0 + .6], wallZ = [.15, 2.1, 7.85, H.v1 + .6];
  if (k5 === 0) { S(TP.propane(), wallZ, 0, byWall, { step: .15 }); S(TP.propane(0xd3d4d7), wallZ, 0, byWall, { step: .15 }); }
  else if (k5 === 1) S(tires(), wallZ, 0, byWall);
  else if (k5 === 2) S(TP.cinder(3), wallZ, 1, byWall);
  else if (k5 === 3) S(TP.pallets(3), wallZ, 1, byWall);
  else if (k5 === 4) S(trashCan([0x25b84c, 0x17171b, 0x2f5bff][p.n % 3]), wallZ, 0, byWall);
  // a yard tree: in a side strip nobody parks on, a park model's front yard, or the corner of a yard with room
  if (sideZ && h(13) < .75) S(streetTree(p.n), sideZ, 0, [(sideZ[0] + sideZ[2]) / 2, 8.2], { step: .2 });
  else if ((t === 'double' || !carSlot) && h(13) < .6) S(streetTree(p.n + 3), front, 0, [farU, 9.8], { step: .2 });
  // the one-off scenes
  const O = [.2, 2.2, 7.8, frontTop], oNear = [farU, AU[3] + 1];
  if (ex === 'dog') { X(TP.doghouse(0xc49a6c), sideZ || front, doorRight ? 1 : 3, oNear); X(TP.bowl(), sideZ || front, 0, oNear); }
  if (ex === 'coop') X(coop(), sideZ || front, 0, oNear);
  if (ex === 'psychic') { X(TP.palmSign(), O, 0, [doorRight ? 1 : 7, 10.4], { step: .2 }); X(TP.resinChair(0x7a3cff), front, 0, oNear); }
  if (ex === 'bigflamingo') X(TP.bigFlamingo(), O, F.f > 0 ? 3 : 1, [doorRight ? 1.4 : 6.6, 9.6], { step: .2 });
  if (ex === 'engines') { X(TP.motorbike(0xe8232a), front, 1, oNear); X(tires(), front, 0, oNear); X(milkCrate(0x2f5bff), front, 0, oNear); }
  if (ex === 'dish') X(TP.bigDish(), O, 0, [doorRight ? 1.8 : 6.2, 7.5], { step: .3 });
  if (ex === 'boat') X(TP.boat(0x2f5bff), O, 0, [doorRight ? 1.2 : 6.8, 7.2], { step: .3 });
  if (ex === 'firewood') X(TP.pallets(2), front, 0, oNear);
  if (ex === 'fish') { X(TP.cooler(0xf7f7f2), front, 0, oNear); X(lawnChair(0x12b3a0), front, 0, oNear); }
  if (ex === 'flag') X(TP.flagPole('sock'), O, 0, [farU, 9.4]);
  if (ex === 'tattoo') X(speaker(), front, 0, oNear);
  if (ex === 'salon') { X(TP.resinChair(0xff4fa3), front, 0, oNear); X(potPlant(1), front, 0, oNear); }
  if (ex === 'notary') X(TP.flagPole('checker'), O, 0, [farU, 9.4]);
  if (ex === 'office') X(picnic(0xf7f7f2), front, 0, oNear);
}

// ── out back: in this pad's own half of the shared back strip (the whole of it on the park's edge rows) and up to the home's back wall —
// a shade tree, a dish on a pole, what got dragged back there (a tarped pile, a camper shell, washers, tyres, a burn barrel)
function backYard(ctx, p, H) {
  const s = p.spec, b = s.back, edgeRow = p.r === 0 || p.r === 5, vb = H.aabbUV[1] - .12, clip = [.15, .12, edgeRow ? 7.85 : 3.9, vb];
  if (vb - .12 < .9) return;
  const put = (bk, near, q = 0, o = {}) => spot(ctx, p, bk, [clip[0] + .3, .3, clip[2] - .3, Math.max(.3, vb - .3)], q, { near, back: true, clip, quiet: true, step: .2, ...o });
  if (b[0] < .42) put(streetTree(p.n * 3 + 1), [clip[2] * .5, Math.min(1.3, vb / 2)]);
  if (b[1] < .38) put(TP.smallDish(p.n + 1), [1.8, .5], (p.n % 2) * 2);
  const junk = [() => TP.tarpPile(p.n % 3 ? 0x2f6bdf : 0x8a5a2a), () => tires(), () => TP.camperShell(CARC[p.n % CARC.length]), () => TP.washer(), () => TP.burnBarrel(), () => TP.pallets(2), () => TP.fridge(0xf2f2ee)];
  put(junk[(b[2] * junk.length) | 0](), [clip[2] - .9, .6], (p.n >> 1) & 1);
  if (edgeRow && b[1] > .7) put(junk[((b[2] * 13) | 0) % junk.length](), [clip[2] * .25, .6], p.n & 1);
}
