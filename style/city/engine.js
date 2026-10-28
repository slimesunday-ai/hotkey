// Pass 2 · THE ENGINE a district kit builds with (core, systems agent). A kit's build(ctx) never stamps blind: every helper here asks
// the registry (audit.js REG) first and slides, lifts or refuses, so a kit cannot create intersections, floating props or
// off-board text (the generator itself runs on the same guarantees). Worker-safe (no three, no DOM).
//
//   ctx.building(x0, z0, x1, z1, { h, wall, trim, faces, roof, parapet })   a mass (voxels, registered, clipped against its
//        neighbours) → { V, B, F(side) → facade frame, top }. Draw on it with kit.js (win, frame.box, …); it is meshed at the end.
//   ctx.volume(x0, y0, z0, x1, y1, z1, { walk })      a free structure volume (fences, yards, decks); walk: a surface props stand on
//   ctx.put(prop, x, z, { rot, y, slide: [ax, az], reach })   place a prop where it is clear and supported (slides ±reach m, else skipped)
//   ctx.sign(frame, text, a, ytop, { board, fg, d })  lettering that always sits on a board sized to it (frames from ctx.building)
//   ctx.lot(simLot) → { frame, door, … }              the plan's sim lots in this block (world/city.js LOTS), with their frames
//   ctx.anchor.lot(id, { door, sign, windows, wall, yard })   where the sim-state layer draws a lot's state (simstate/layer.js)
//   ctx.anchor.building({ id, kind, tier, entrance, units })  a walk-up or tower with stacked units (apartments, penthouses)
//   ctx.rng(k)                                         a seeded rng for this block (k: any integer salt)
import { Vol, Bank, meshVol, stamp } from './vox.js';
import { frame, mass, TOD } from './kit.js';
import { PAL, CV, SIDE, rng as mkRng, hash } from './style.js';
import { REG, walkObstacles } from './audit.js';
import { P, PLACES, segX, segZ, swX, swZ, SWALK } from './plan.js';
import { MODS } from './modules.js';
import { LOTS, compoundAt } from '../../world/city.js';
import { slab } from './ground.js';
import { textMask } from './vox.js';
import { GEN } from './gen.js';
import { transitBefore, transitAfter } from './transit.js';
import { NODE, DETOUR_ROAD, KERB } from './pedsim.js';

const simLotsIn = (i, j) => LOTS.filter(l => { const cx = l.x0 + l.sx / 2, cz = l.z0 + l.sz / 2; return Math.floor(cx / P) === i && Math.floor(cz / P) === j; });
const doorOf = l => ({ z: [l.x0 + l.sx / 2, l.z0 + l.sz + 1], '-z': [l.x0 + l.sx / 2, l.z0 - 1], x: [l.x0 + l.sx + 1, l.z0 + l.sz / 2], '-x': [l.x0 - 1, l.z0 + l.sz / 2] })[l.face];   // sim2/places.mjs door rule

export function blockCtx(bank, b, A, kit) {
  const pending = [], i = b.i, j = b.j, anchors = A.anchors ??= { lots: {}, sites: [] };
  const ctx = {
    b, i, j, kit, bank, A, night: TOD.night, R: b.R, slab: slab(i, j), F: b.F, HW: b.HW, compound: compoundAt(i, j),
    rng: (k = 0) => mkRng(9000 + (i + 64) * 131 + (j + 64) * 17 + k * 7919),
    simLots: simLotsIn(i, j),
    group: g => REG.group(g),
    building(x0, z0, x1, z1, o = {}) {
      const h = Math.round((o.h ?? 6) / CV), faces = o.faces || [], pad = f => faces.includes(f) ? 16 : 4, px0 = pad('-x'), px1 = pad('+x'), pz0 = pad('-z'), pz1 = pad('+z');
      const nx = Math.round((x1 - x0) / CV) + px0 + px1, nz = Math.round((z1 - z0) / CV) + pz0 + pz1, V = new Vol(nx, h + (o.extra ?? 30), nz, { s: CV, org: [x0 - px0 * CV, SIDE, z0 - pz0 * CV] });
      const B = { x0: px0, z0: pz0, x1: nx - px1, z1: nz - pz1 }, F = mass(V, B, h, o.wall ?? PAL.white, o.trim ?? PAL.cream, faces, { parapet: o.parapet, cornice: o.cornice, roof: o.roof });
      pending.push(V); return { V, B, F, h, top: SIDE + h * CV };
    },
    // a custom building volume (pitched roofs, sheds, kiosks): registers its mass [x0, z0, x1, z1] up to `top` (roof surface at roofY),
    // so props keep clear of it, neighbours are clipped against it and people may stand on its roof. Draw into V, it meshes at the end.
    mass(V, [x0, z0, x1, z1], o = {}) { const top = o.top ?? V.org[1] + V.ny * V.s; V.own = REG.footprint(x0, z0, x1, z1, top, o.roofY ?? top);
      if (V.org[1] < 1) REG.keep([x0 - .35, V.org[1], z0 - .35, x1 + .35, V.org[1] + 3.2, z1 + .35], 'plinth'); if (!pending.includes(V)) pending.push(V); return V; },
    volume(x0, y0, z0, x1, y1, z1, o = {}) { const s = o.s ?? CV, V = new Vol(Math.max(1, Math.round((x1 - x0) / s)), Math.max(1, Math.round((y1 - y0) / s)), Math.max(1, Math.round((z1 - z0) / s)), { s, org: [x0, y0, z0], ground: o.ground ?? true });
      pending.push(V); if (o.walk) REG.surface(V); if (o.keep) REG.keep([x0, y0, z0, x1, y1, z1], o.keep); return V; },   // (a walk surface counts at once: props put on it later are lifted onto it)
    put(prop, x, z, o = {}) {
      const rot = o.rot ?? 0, y = o.y ?? SIDE, [ax, az] = o.slide || [1, 0], reach = o.reach ?? 1.2, whys = new Set();
      for (let k = 0, d = 0; Math.abs(d) <= reach + 1e-6; k++, d = (k % 2 ? 1 : -1) * Math.ceil(k / 2) * .3) {
        const px = x + ax * d, pz = z + az * d, box = REG.boxOf(prop, rot, px, y, pz), why = REG.why(box, { ignore: o.ignore, doors: o.doors });
        if (!why) { stamp(prop, bank, rot, px, y, pz); return [px, pz]; } whys.add(why); }
      REG.skip(prop.kind || 'prop', [x, y, z], [...whys].slice(0, 3).join(', ')); return null; },
    sign(f, text, a, ytop, o = {}) {   // a board sized to the text (≥ 3 voxels margin), then the letters on it
      const M = textMask(text), sc = o.sc ?? 1, w = M.w * sc, h = 7 * sc, d = o.d ?? 2, a0 = Math.round(a - w / 2);
      f.box(a0 - 3, ytop - h - 3, 0, a0 + w + 3, ytop + 3, d, o.board ?? PAL.ink); f.text(text, a0, ytop, d, d + 1, o.fg ?? PAL.white, o.lit ?? (TOD.night ? 3 : 0), sc); return w; },
    lot(l) { const W = (l.face === 'z' || l.face === '-z') ? l.sx : l.sz, D = (l.face === 'z' || l.face === '-z') ? l.sz : l.sx; return { ...l, W, D, door: doorOf(l) }; },
    anchor: {
      lot(id, a) { anchors.lots[id] = a; },
      site(id, a) { anchors.sites.push({ id, ...a }); },
      building(b) { (anchors.buildings ??= []).push(b); },   // stacked units: { id, kind: 'walkup' | 'tower', tier, rot, face, entrance: { door, stoop, width }, units: [{ id, floor, windows }], top }
    },
    finish() { for (const V of pending) meshVol(V, bank); pending.length = 0; },
  };
  return ctx;
}
// the far tier of a custom kit: 0.5 cubes. far(ctx) draws with ctx.box(x0, y0, z0, x1, y1, z1, colour) in world metres.
export function farCtx(b, kit) {
  const R = b.R, S = .5, X0 = b.i * P, Z0 = b.j * P, V = new Vol(Math.ceil(P / S), 80, Math.ceil(P / S), { s: S, org: [X0, SIDE, Z0] }), cx = x => Math.round((x - X0) / S), cz = z => Math.round((z - Z0) / S), cy = y => Math.round((y - SIDE) / S);
  const c = { b, i: b.i, j: b.j, kit, R, S, V, maxH: 0, bank: new Bank(true), simLots: simLotsIn(b.i, b.j), rng: (k = 0) => mkRng(9000 + (b.i + 64) * 131 + (b.j + 64) * 17 + k * 7919), lot: l => blockCtx(null, b, {}, kit).lot(l),
    box(x0, y0, z0, x1, y1, z1, col) { V.box(cx(x0), cy(y0), cz(z0), Math.max(cx(x0) + 1, cx(x1)), Math.max(cy(y0) + 1, cy(y1)), Math.max(cz(z0) + 1, cz(z1)), col); c.maxH = Math.max(c.maxH, y1 - SIDE); } };
  const done = c.bank; Object.defineProperty(c, 'bank', { get() { if (!c._meshed) { meshVol(V, done); c._meshed = true; } return done; } });
  return c;
}
// cleanup pass · the block's street sidewalks for the clear walkway rule (audit.js WALK): one per side with a road, running the whole side
// (its corner squares included); c = metres from the curb (0) to the lot line (w: the side's own walk, 2 today — SPREAD: swX / swZ)
export function sidewalksOf(i, j) { const s = slab(i, j), out = [];
  if (segZ(j, i)) out.push({ k: 'N', ax: 'x', u0: s.x0, u1: s.x1, cur: s.z0, dir: 1, w: swZ(j) }); if (segZ(j + 1, i)) out.push({ k: 'S', ax: 'x', u0: s.x0, u1: s.x1, cur: s.z1, dir: -1, w: swZ(j + 1) });
  if (segX(i, j)) out.push({ k: 'W', ax: 'z', u0: s.z0, u1: s.z1, cur: s.x0, dir: 1, w: swX(i) }); if (segX(i + 1, j)) out.push({ k: 'E', ax: 'z', u0: s.z0, u1: s.z1, cur: s.x1, dir: -1, w: swX(i + 1) });
  return out; }
// cleanup pass · the walkers' corners: in each corner square their paths cross — the turn from one sidewalk into the next and the zebra
// crossings — along two lines NODE m in from the curbs (pedsim.js). Both lines are kept clear (±0.45 m) from the curb through the square
// and on into the sidewalk, before anything is placed: corner clutter, standing people and a dealing crew stand beside them, not on them.
export function walkCorners(i, j, detours = []) { const s = slab(i, j), out = [], H = SIDE + 2.2, w = .45, N = segZ(j, i), S = segZ(j + 1, i), W = segX(i, j), E = segX(i + 1, j);
  for (const [cn, ok] of [['NW', N || W], ['NE', N || E], ['SW', S || W], ['SE', S || E]]) { if (!ok || detours.some(d => d.c === cn)) continue;   // (a detour corner's walkers go round through the road)
    const west = cn[1] === 'W', north = cn[0] === 'N', xn = west ? s.x0 + NODE : s.x1 - NODE, zn = north ? s.z0 + NODE : s.z1 - NODE;
    const Lx = 2.6 + ((west ? swX(i) : swX(i + 1)) - SWALK), Lz = 2.6 + ((north ? swZ(j) : swZ(j + 1)) - SWALK);   // (the corner square and 0.6 on: SPREAD, the walks' own widths)
    const xa = west ? s.x0 : s.x1 - Lx, xb = west ? s.x0 + Lx : s.x1, za = north ? s.z0 : s.z1 - Lz, zb = north ? s.z0 + Lz : s.z1;
    if (north ? N : S) out.push([xa, SIDE, zn - w, xb, H, zn + w]);   // along the N or S sidewalk, and the crossing over the W or E road
    if (west ? W : E) out.push([xn - w, SIDE, za, xn + w, H, zb]); }   // along the W or E sidewalk, and the crossing over the N or S road
  return out; }
// cleanup pass · DETOUR CORNERS. Where a dealing crew holds a corner square (heroes/corners.js cornerZones: the crew, its booth and crates
// fill the 2 × 2 m square, with the signal or the lamp at the kerb), walkers can't turn there on the sidewalk: they step off the curb
// DETOUR.ramp m before it, go round the crew through the intersection's corner (no car stops within 9 m of one, street.js traffic) and
// step back up after it (pedsim.js). The ramps are kept clear here, before anything is placed. → the block's detour corners ['SW', …]
export const DETOUR = { road: DETOUR_ROAD, ramp: 2 };   // the walkers' path DETOUR.road m out in the road; each ramp DETOUR.ramp m long, starting just past the crew's zone
export function detourCornersOf(i, j) { const out = [], CM = MODS.corners; if (!CM?.cornerZones) return out; const s = slab(i, j);
  for (const z of CM.cornerZones(PLACES, P)) { if (z.i !== i || z.j !== j) continue; const cx = (z.box[0] + z.box[3]) / 2, cz = (z.box[2] + z.box[5]) / 2;
    const west = Math.abs(cx - s.x0) < Math.abs(cx - s.x1), north = Math.abs(cz - s.z0) < Math.abs(cz - s.z1), ux = west ? z.box[3] - s.x0 : s.x1 - z.box[0], uz = north ? z.box[5] - s.z0 : s.z1 - z.box[2];
    const r0 = Math.max(2.6, ux, uz) + .3; out.push({ c: (north ? 'N' : 'S') + (west ? 'W' : 'E'), r0: +r0.toFixed(2), r1: +(r0 + DETOUR.ramp).toFixed(2) }); }
  return out; }
export function detourRamps(i, j, corners) { const s = slab(i, j), out = [], H = SIDE + 2.2;
  for (const { c: cn, r0, r1 } of corners) { const west = cn[1] === 'W', north = cn[0] === 'N';
    const wz = 1.8 + ((north ? swZ(j) : swZ(j + 1)) - SWALK), wx = 1.8 + ((west ? swX(i) : swX(i + 1)) - SWALK);   // (SPREAD: the walk less 0.2)
    if (north ? segZ(j, i) : segZ(j + 1, i)) { const zc = north ? s.z0 : s.z1 - wz, xa = west ? s.x0 + r0 - .2 : s.x1 - r1 - .2, xb = west ? s.x0 + r1 + .2 : s.x1 - r0 + .2; out.push([xa, SIDE, zc, xb, H, zc + wz]); }   // on the N or S sidewalk
    if (west ? segX(i, j) : segX(i + 1, j)) { const xc = west ? s.x0 : s.x1 - wx, za = north ? s.z0 + r0 - .2 : s.z1 - r1 - .2, zb = north ? s.z0 + r1 + .2 : s.z1 - r0 + .2; out.push([xc, SIDE, za, xc + wx, H, zb]); } }   // on the W or E sidewalk
  return out; }
// every block, whatever built it: kit reservations before (transit strips) and kit furniture after (transit props, anchors)
export function engineBefore(b, kit, bank, A) { if (!GEN.flags.pass2) return; transitBefore(b, kit, bank, A); }
export function engineAfter(b, kit, bank, A) { if (!GEN.flags.pass2) return; transitAfter(b, kit, bank, A); }

// ── pass 2 · walker lanes. Each road side of the block's sidewalk ring gets a lateral offset every 0.5 m (c = metres from the curb,
// 0.45 … 1.45 on the 2 m sidewalk), chosen to pass clear of street furniture, facade parts, doorways and the standing cast, as near
// the middle as it can and never jumping more than 0.25 m a step. Where no gap of a walker's width exists it records a PINCH (the
// audit's walker-blocked). peds.js walks these lanes; blocks never built use the plain middle (c = 1).
const RB = .26, RH = .39;   // (cleanup pass: the lane is carved 2 cm wider than the walker the walk check tests, REG.walkBlock's .24 / .37)
// cleanup pass · THE LANES as a shortest path. Each road side of the block's sidewalk ring gets a lane every 0.1 m: c = metres from the
// curb, a path through (u, c) states that are all clear of everything a walker could run into (audit.js walkObstacles, with the walker's
// body and head discs, 2 cm wider than the walk check's), that moves at most 0.05 m sideways per 0.1 m, rests 1.2 m out (NODE, where the
// corner nodes are, and passes through them), and steps into the road margin (c < 0, the walker drops to the road) only where the
// sidewalk is full. Where no clear path exists it records a PINCH (the audit's walker-blocked). peds / pedsim.js walk these lanes.
const LC0 = -.8, LDC = .025, LNC = 100, LDK = 2;   // lane states c = LC0 + k × LDC, k < LNC (−0.8 … 1.675); at most LDK states sideways per sample (0.05 m per 0.1 m)
// SPREAD · the lattice spans the side's own walk: nC = LNC + (sw − 2) / LDC states (up to sw − 0.325 from the curb, as 1.675 is on 2 m),
// and between the corner nodes the lane rests at REST = NODE × sw / 2, the same place across a wider walk (1.2 on 2 m, 1.8 on 3, 2.4 on 4);
// the corner nodes stay NODE in from the curbs (inside the 2 m zebras), so a lane leaves its rest line to pass through them
export function lanesOf(b, persons) {
  if (!REG.blk) return null; const s = slab(b.i, b.j), i = b.i, j = b.j, out = { step: .1, sides: {}, pinches: [], detour: detourCornersOf(b.i, b.j) }, people = persons.filter(p => p.y < SIDE + .4);
  const obs = walkObstacles(REG.blk, people), R = Math.max(RB, RH) + .01;
  const sides = { N: segZ(j, i) && [s.x0, s.x1, 'x', s.z0, 1], S: segZ(j + 1, i) && [s.x0, s.x1, 'x', s.z1, -1], W: segX(i, j) && [s.z0, s.z1, 'z', s.x0, 1], E: segX(i + 1, j) && [s.z0, s.z1, 'z', s.x1, -1] };
  for (const [k, side] of Object.entries(sides)) { if (!side) continue; const [u0, u1, ax, cur, dir] = side, n = Math.max(2, Math.round((u1 - u0) / out.step) + 1), c = new Float32Array(n);
    const sw = { N: swZ(j), S: swZ(j + 1), W: swX(i), E: swX(i + 1) }[k], nC = LNC + Math.round((sw - SWALK) / LDC), REST = NODE * sw / SWALK;
    // blocked intervals per sample, for a walker on the slab (lv 0) and out in the road (lv 1): each obstacle dilated by the disc of the band it reaches
    const blk = [[], []].map(() => Array.from({ length: n }, () => []));
    for (const o of obs) { let bu0, bu1, bc0, bc1, ya, yb, disc = !!o.disc;
      if (disc) { const [x, z, r] = o.disc, u = ax === 'x' ? x : z, cc = dir > 0 ? (ax === 'x' ? z : x) - cur : cur - (ax === 'x' ? z : x); bu0 = bu1 = u; bc0 = bc1 = cc; ya = o.y[0]; yb = o.y[1]; o.r0 = r; }
      else { const bx = o.box; [bu0, bu1] = ax === 'x' ? [bx[0], bx[3]] : [bx[2], bx[5]]; const [p0, p1] = ax === 'x' ? [bx[2], bx[5]] : [bx[0], bx[3]]; [bc0, bc1] = dir > 0 ? [p0 - cur, p1 - cur] : [cur - p1, cur - p0]; ya = bx[1]; yb = bx[4]; }
      if (bu1 < u0 - 1.2 || bu0 > u1 + 1.2 || bc1 < LC0 - 1.2 || bc0 > LC0 + nC * LDC + 1.2) continue;
      for (let lv = 0; lv < 2; lv++) { const y = lv ? 0 : SIDE, y0 = y + .1, yh = y + 1.25, y1 = y + 1.9, body = ya < yh && yb > y0, head = ya < y1 && yb > yh; if (!body && !head) continue;
        const r = (disc ? o.r0 : 0) + (head ? RH : RB), qa = Math.max(0, Math.floor((bu0 - r - u0) / out.step)), qb = Math.min(n - 1, Math.ceil((bu1 + r - u0) / out.step));
        for (let q = qa; q <= qb; q++) { const u = u0 + q * out.step, du = Math.max(bu0 - u, 0, u - bu1); if (du >= r) continue; const dc = Math.sqrt(r * r - du * du); blk[lv][q].push([bc0 - dc, bc1 + dc, o.name]); } } }
    // the shortest path: every state clear if it can be, near NODE, on the slab rather than the road, smooth; through the corner nodes
    const BIG = 1e3, cost = new Float64Array(n * nC), from = new Int8Array(n * nC), state = (q, kk) => { const cc = LC0 + kk * LDC; for (const [a, b2] of blk[cc < -.05 ? 1 : 0][q]) if (cc > a && cc < b2) return BIG; return Math.abs(cc - REST) * .5 + (cc < -.05 ? 4 : 0); };
    // (a detour corner at either end: its walkers leave the sidewalk before the crew, so no node there and no pinch in its stretch)
    const cA = { N: 'NW', S: 'SW', W: 'NW', E: 'NE' }[k], cB = { N: 'NE', S: 'SE', W: 'SW', E: 'SE' }[k], dA = out.detour.find(d => d.c === cA), dB = out.detour.find(d => d.c === cB);
    const kN = Math.round((NODE - LC0) / LDC), qN0 = dA ? Math.ceil(dA.r1 / out.step) : Math.round(NODE / out.step), qN1 = dB ? n - 1 - Math.ceil(dB.r1 / out.step) : n - 1 - Math.round(NODE / out.step);
    for (let q = 0; q < n; q++) for (let kk = 0; kk < nC; kk++) { let base = state(q, kk); if (((q === qN0 && !dA) || (q === qN1 && !dB)) && kk !== kN) base += BIG;
      if (!q) { cost[kk] = base; continue; } let best = Infinity, bi = 0; for (let d = -LDK; d <= LDK; d++) { const kp = kk + d; if (kp < 0 || kp >= nC) continue; const v = cost[(q - 1) * nC + kp] + Math.abs(d) * LDC; if (v < best - 1e-9 || (v < best + 1e-9 && Math.abs(d) < Math.abs(bi))) { best = v; bi = d; } }
      cost[q * nC + kk] = best + base; from[q * nC + kk] = bi; }
    let kk = 0; for (let t = 1; t < nC; t++) if (cost[(n - 1) * nC + t] < cost[(n - 1) * nC + kk]) kk = t;
    const at = (q, cc) => { const u = u0 + q * out.step, p = dir > 0 ? cur + cc : cur - cc; return { x: +(ax === 'x' ? u : p).toFixed(2), z: +(ax === 'x' ? p : u).toFixed(2) }; };
    let pinchAt = 1e9; for (let q = n - 1; q >= 0; q--) { const cc = LC0 + kk * LDC; c[q] = cc;
      if (state(q, kk) >= BIG && q >= qN0 && q <= qN1) { if (pinchAt - q > 20) { const iv = blk[cc < -.05 ? 1 : 0][q].find(([a, b2]) => cc > a && cc < b2); out.pinches.push({ ...at(q, cc), why: iv?.[2] || '?' }); } pinchAt = q; }   // (once per 2 m)
      // a lane that can't pass through its corner node: the walkers turning or crossing there would walk into each other
      if (((q === qN0 && !dA) || (q === qN1 && !dB)) && kk !== kN) { const iv = blk[0][q].find(([a, b2]) => NODE > a && NODE < b2); out.pinches.push({ ...at(q, NODE), why: (iv ? iv[2] : 'the sidewalk next to it') + ' (the corner node)' }); }
      kk += from[q * nC + kk]; }
    // walkers-fix round · THE KERB at each end: how far from the corner node along this side's kerb strip a waiting walker stands clear of
    // everything (the same discs as the lane). pedsim.js KERB: a crossing's second file and the kerb-wait row stand KERB.c m from the
    // curb, and the second file steps out to it through KERB.ramp; kz = [from the u0 end's node, from the u1 end's node] (m, −1: none)
    const clearAt = (q, cc) => !blk[0][q].some(([a, b2]) => cc > a && cc < b2);
    const kz = [dA, dB].map((d, e) => { if (d) return -1; const uN = e ? u1 - NODE : u0 + NODE; let D = -1;
      for (let x = 0; x <= KERB.reach + 1e-6; x += out.step) { const q = Math.round((uN + (e ? -x : x) - u0) / out.step); if (q < 0 || q >= n) break;
        if (!KERB.cs.every(cc => clearAt(q, cc)) || (x <= KERB.rampX && !KERB.ramp.every(cc => clearAt(q, cc)))) break; D = x; }
      return +D.toFixed(2); });
    out.sides[k] = { u0, c, step: out.step, kz }; }
  // audit builds only: everything a walker could run into on this block, for the walk check (walkcheck.js tests every walker's exact
  // position against it with the same REG.walkBlock); never cached, never in the game
  if (REG.audit) { Object.defineProperty(out, 'snap', { value: REG.walkSnap(), enumerable: false }); Object.defineProperty(out, 'people', { value: people, enumerable: false }); }
  return out;
}
