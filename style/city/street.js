// Street furniture by rule: a lamp at every block corner (arm over the road), signals at each intersection, trees, hydrants,
// trash, and parked cars at the kerbs (never in a travel lane or on a crossing). Everything is stamped into the block bank it stands in.
import { stamp, Vol, meshed, textMask } from './vox.js';
import { P, segX, segZ, hwX, hwZ, kindAt, distOf, isAve, isHwy } from './plan.js';
import { PAL, SIDE, hash, rng } from './style.js';
import { lampPost, hydrant, bags, streetTree, car, taxi, newsstand, steamStack } from './props.js';
import { REG } from './audit.js';
import { vehicleProp, pickVehicle, byId as VEH, PARK, parkOff, PARK_IN, rotAlong, laneDir } from './vehicles/index.js';   // (cars pass)
import { isOneWay, oneWayDir } from './traffic/rules.js';
import { TOD } from './kit.js';
import { detourCornersOf } from './engine.js';
import { slab, cornerLamps, signalPoles, dneSigns, SIG } from './ground.js';
import { TAXI_KERB } from './transitnet.js';   // (CAB TRAFFIC: the stands' kerb bays stay clear of parked cars)

// ── streets pass · the signal and sign templates (authored in metres, in the pole's frame; ground.js SIG holds the numbers the live lamps
// share). The lenses are baked DARK: traffic/lamps.js lights the one that is on, every frame, from traffic/rules.js signalAt.
const memo = new Map(), T = (key, kind, f) => { let b = memo.get(key); if (!b) { memo.set(key, b = f()); b.kind = kind; } return b; };
const mbox = (V, x0, y0, z0, x1, y1, z1, c) => { const [ox, oy, oz] = V.org, k = V.s; V.box((x0 - ox) / k, (y0 - oy) / k, (z0 - oz) / k, (x1 - ox) / k, (y1 - oy) / k, (z1 - oz) / k, c); };
const HOUSING = 0xffc21a, LENS = [0x4a1616, 0x4a3a12, 0x123e26], PEDBOX = 0x26262c, POLE = PAL.lamp;
// a head's face: a black plate with three dark lenses under short visors. (a, b): the face's own across and up axes; n: its outward normal
function headFace(V, c, n, ys, face, half) { const [cx, cz] = c, [nx, nz] = n, ax = Math.abs(nz), az = Math.abs(nx), f0 = face - .1, f1 = face;
  const B = (u0, u1, y0, y1, d0, d1, col) => { const xa = cx + nx * d0 + ax * u0, xb = cx + nx * d1 + ax * u1, za = cz + nz * d0 + az * u0, zb = cz + nz * d1 + az * u1;
    mbox(V, Math.min(xa, xb), y0, Math.min(za, zb), Math.max(xa, xb), y1, Math.max(za, zb), col); };
  B(-half + .1, half - .1, ys[2] - .25, ys[0] + .25, f0, f1, PAL.ink);
  ys.forEach((y, k) => { B(-.15, .15, y - .15, y + .15, f0, f1, LENS[k]); B(-.15, .15, y + .15, y + .25, f1, f1 + .1, PAL.ink); }); }
// the pole: `span` null (a post) or 'ns' / 'ew' (a mast whose arm runs along local +x / +z over that road, its head `reach` m out)
export const signalPole = (span = null, reach = 0) => T('sig' + (span || '') + reach, 'signal', () => {
  const ext = span ? reach + .6 : .6, nx = Math.round((ext + .55) / .1), V = new Vol(span === 'ns' ? nx : 11, span ? 59 : 50, span === 'ew' ? nx : 11, { s: .1, org: [-.55, 0, -.55] });
  mbox(V, -.25, 0, -.25, .25, .4, .25, POLE); mbox(V, -.15, 0, -.15, .15, span ? 5.7 : 4.8, .15, POLE);
  mbox(V, -.35, 3.2, -.35, .35, 4.8, .35, HOUSING); mbox(V, -.35, 4.8, -.35, .35, 4.9, .35, POLE);   // the four-faced head + its cap
  for (const n of [[1, 0], [-1, 0], [0, 1], [0, -1]]) headFace(V, [0, 0], n, SIG.lensY, SIG.face, .35);
  mbox(V, .15, 2.3, -.25, .45, 2.8, .25, PEDBOX); mbox(V, -.25, 2.3, .15, .25, 2.8, .45, PEDBOX);      // WALK / DON'T WALK boxes (local +x, +z)
  if (span) { const along = span === 'ns', A = (a0, a1, y0, y1, w) => along ? mbox(V, a0, y0, -w, a1, y1, w, POLE) : mbox(V, -w, y0, a0, w, y1, a1, POLE);
    A(.15, reach + .45, 5.4, 5.6, .1); for (let t = 0; t < 5; t++) A(.35 + t * .1, .45 + t * .1, 4.9 + t * .1, 5.0 + t * .1, .05);   // the arm and its brace
    A(reach - .05, reach + .05, 5.3, 5.4, .05);
    const c = along ? [reach, 0] : [0, reach]; along ? mbox(V, reach - .35, 3.7, -.25, reach + .35, 5.3, .25, HOUSING) : mbox(V, -.25, 3.7, reach - .35, .25, 5.3, reach + .35, HOUSING);
    for (const sg of [1, -1]) headFace(V, c, along ? [0, sg] : [sg, 0], SIG.mastY, SIG.mastFace, .35); }
  return meshed(V); });
// NYC ONE WAY (walkers-fix round: bigger — the 1.2 × 0.3 m plate's 14 cm letters could not be read from the street): the R6-1 as it hangs
// on every Manhattan corner pole — a black plate with a white border, a big white arrow along local +x and ONE WAY in black on its shaft
// — 1.62 × 0.51 m, 21 cm letters (3 cm voxels), readable from both faces. It flies off the pole like a flag on a short bracket, along
// the one-way street into the block (sx: the side of the pole it hangs on, along the arrow, ±1): clear of the WALK / DON'T WALK boxes
// and the head, under the lowest lens, over the walkers' heads, and the pole never stands in front of it.
export const OW = { y: 2.62, from: .15, gap: .09, px: .03 };   // (the plate from 0.24 m off the pole centre: clear of a DO NOT ENTER on the next lamp)
export const oneWaySign = (sx = 1) => T('oneway' + sx, 'sign', () => { const k = OW.px, W = 54, H = 17, B = Math.round(OW.gap / k), NX = W + B, t = textMask('ONE WAY');
  const V = new Vol(NX, H, 2, { s: k, org: [sx > 0 ? OW.from : -OW.from - NX * k, OW.y, -k], ground: false }), p0 = sx > 0 ? B : 0, X = p => p0 + p;
  for (const y of [1, H - 2]) V.box(sx > 0 ? 0 : W, y, 0, sx > 0 ? B : NX, y + 1, 2, POLE);   // the bracket: two bars from the pole to the plate
  for (let z = 0; z < 2; z++) { V.box(X(0), 0, z, X(W), H, z + 1, PAL.white); V.box(X(1), 1, z, X(W - 1), H - 1, z + 1, PAL.ink);   // white border, black field
    V.box(X(2), 4, z, X(43), 13, z + 1, PAL.white);                                                                   // the arrow's shaft
    for (let c = 43; c <= 51; c++) { const h = Math.round(6 * (51 - c) / 8); V.box(X(c), 8 - h, z, X(c) + 1, 9 + h, z + 1, PAL.white); }   // its head
    for (let j = 0; j < 7; j++) for (let i = 0; i < t.w; i++) if (t.at(i, j)) V.set(X(z ? 3 + i : 41 - i), 11 - j, z, PAL.ink); }   // (the back face mirrored: it reads from behind)
  return meshed(V); });
// DO NOT ENTER: a white plate 0.7 m square, the red disc and its white bar, facing local +z (the intersection), 0.22 m out from a lamp pole
// and hung toward the road (local +x is the street side at every corner lamp, dneSigns' turns): 0.3 m over the curb, clear of awnings
export const doNotEnter = () => T('dne', 'sign', () => { const V = new Vol(35, 35, 2, { s: .02, org: [-.05, SIG.dneY, .22], ground: false });
  V.box(0, 0, 0, 35, 35, 1, 0x8d8f99); V.box(0, 0, 1, 35, 35, 2, PAL.white);
  for (let y = 0; y < 35; y++) for (let x = 0; x < 35; x++) if (Math.hypot(x - 17, y - 17) < 15.5) V.set(x, y, 1, PAL.red);
  V.box(7, 15, 1, 28, 20, 2, PAL.white); return meshed(V); });
const OW_ROT = { '1,0': 0, '0,-1': 1, '-1,0': 2, '0,1': 3 };   // the quarter turn that points local +x along a world direction

// the fixed corner furniture of a block: lamps (arm over the street the corner faces first), the signal poles of the nodes at its NW and SE
// corners (ground.js signalPoles), ONE WAY signs on them and DO NOT ENTER signs on the lamps at one-way streets' wrong-way ends (streets
// pass). Pass 1d: reserved before the lots are built (jobs.js), so nothing lands on it.
export function cornerKit(i, j) {
  const lamps = cornerLamps(i, j), out = lamps.map(([x, z, rot]) => [lampPost(), rot, x, z]);   // (cleanup pass: ground.js cornerLamps, shared with the night lights)
  // (cleanup pass: the posts stand 0.45 m in from both curbs, tight in the corner: the walkers' crossings pass 1.2 m in, clear of the
  // pedestrian signal box at head height)
  for (const q of signalPoles(i, j)) { out.push([signalPole(q.span, q.reach), q.rot, q.x, q.z]);
    if (q.ow) { const inw = q.rot === 2 ? 1 : -1;   // (the block's side of the pole, along either axis: the pole stands in its NW or SE corner)
      out.push([oneWaySign(inw === q.owDir ? 1 : -1), OW_ROT[q.ow === 'ns' ? `0,${q.owDir}` : `${q.owDir},0`], q.x, q.z]); } }
  for (const [k, rot] of dneSigns(i, j)) { const [x, z] = lamps[k]; out.push([doNotEnter(), rot, x, z]); }
  return out;
}
export function furnish(bankOf, b, taken = [], A = null) {
  const { i, j } = b, s = slab(i, j), r = rng(3000 + (i + 50) * 71 + (j + 50) * 7), bank = bankOf(i, j);
  const hasW = segX(i, j), hasE = segX(i + 1, j), hasN = segZ(j, i), hasS = segZ(j + 1, i), free = (x, z) => !taken.some(t => Math.abs(t[0] - x) < (t[2] || 2) && Math.abs(t[1] - z) < (t[2] || 2));
  for (const [bk, rot, x, z] of cornerKit(i, j)) stamp(bk, bank, rot, x, SIDE, z);
  // hydrant, trees, trash bags along the curbs. Pass 1d: each goes down only where it is clear of facades (plinth zone, stands, awnings,
  // canopies), doorways and what the lots already put on the sidewalk, sliding along the curb up to ±2.4 m to find a spot
  const curb = (b, rot, x, z, ax, az) => { let why = null; for (const off of [0, .8, -.8, 1.6, -1.6, 2.4, -2.4, 3.2, -3.2, 4, -4]) { const px = x + ax * off, pz = z + az * off;
    if ((ax && (px < s.x0 + 1 || px > s.x1 - 1)) || (az && (pz < s.z0 + 1 || pz > s.z1 - 1)) || !free(px, pz)) continue; why = REG.why(REG.boxOf(b, rot, px, SIDE, pz)) || null; if (!why) { stamp(b, bank, rot, px, SIDE, pz); return true; } }
    REG.skip(b.kind, [x, SIDE, z], why || 'no room on the curb'); return false; };
  if (hasS) { const x = s.x0 + 5 + r() * 4; if (free(s.x0 + 5, s.z1 - .5)) curb(hydrant(), 0, x, s.z1 - .5, 1, 0); }
  for (const [ok, x, z, rot, ax, az] of [[hasN, s.x0 + 9 + r() * 6, s.z0 + .45, 0, 1, 0], [hasS, s.x1 - 9 - r() * 6, s.z1 - .45, 1, 1, 0], [hasW, s.x0 + .45, s.z0 + 10 + r() * 6, 2, 0, 1], [hasE, s.x1 - .45, s.z1 - 10 - r() * 6, 3, 0, 1]])
    if (ok && r() < .55) curb(streetTree(i * 7 + j * 3 + rot), rot, x, z, ax, az);
  for (let k = 0; k < 2; k++) { const side = Math.floor(r() * 4), t = .3 + r() * .4, x = side < 2 ? s.x0 + (s.x1 - s.x0) * t : (side === 2 ? s.x0 + .45 : s.x1 - .45), z = side < 2 ? (side === 0 ? s.z0 + .45 : s.z1 - .45) : s.z0 + (s.z1 - s.z0) * t;   // (cleanup pass: in the kerb strip)
    if ([hasN, hasS, hasW, hasE][side]) curb(bags(i * 13 + j * 5 + k), side < 2 ? 0 : 1, x, z, side < 2 ? 1 : 0, side < 2 ? 0 : 1); }
}
// CARS pass (2026-09-28) · PARKED CARS at the kerbs (they used to stand stopped mid-lane). A one-way side street parks along the right-hand
// kerb of its direction of travel (traffic/rules.js isOneWay, oneWayDir), beside its one travel lane; an avenue parks in both kerb lanes
// (±3) and drives in the inner two; Route 9 has no kerb parking. Never in a travel lane, in an intersection or on a crossing (the
// crossing band + its stop line + a margin at every end that meets a cross street), at a hydrant or a bus / taxi stop, or on anything
// the block already placed, or in a taxi stand's kerb bays. Models come from the registry's district mix (vehicles/index.js), nose along the lane's travel direction.
// Each road side has its own seed, so the two blocks that share a road agree; each stamps only the cars on its own side.
const CROSS = 2.5, CLEAR = 1.4, KEEP = { hydrant: 1.6, transit: 2.2 };
const DRIVER = new Set(['taxi', 'livery', 'cruiser', 'icecream']);
export function traffic(bankOf, roads, taken = []) {
  const B = REG.blk;
  for (const rd of roads) {
    if (isHwy(rd.axis, rd.L)) continue;
    const X = rd.axis === 'x', offs = isAve(rd.axis, rd.L) ? [-(rd.hw - PARK_IN), rd.hw - PARK_IN] : [parkOff(rd.axis, rd.L, rd.hw)].filter(o => o !== null);
    // the ends: a cross street at a node means its half-width + the crossing band + the stop line + a margin stay clear
    const endGap = at => { const n = Math.round(at / P), cross = X ? (segZ(n, rd.L - 1) || segZ(n, rd.L)) : (segX(n, rd.L - 1) || segX(n, rd.L)); return cross ? (X ? hwZ(n) : hwX(n)) + CROSS + CLEAR : CLEAR; };
    const t0 = rd.a + endGap(rd.a), t1 = rd.b - endGap(rd.b), mid = (rd.a + rd.b) / 2;
    for (const off of offs) {
      const lat = rd.at + off, bi = Math.floor((X ? lat : mid) / P), bj = Math.floor((X ? mid : lat) / P);
      if (B && (bi !== B.i || bj !== B.j)) continue;   // the other side of this road belongs to the neighbour's build
      const r = rng(7000 + rd.L * 131 + Math.round(rd.a) * 7 + (X ? 17 : 0) + (off > 0 ? 3 : 0)), district = distOf(kindAt(bi, bj)), dens = PARK[district] ?? .35;
      if (!dens) continue;
      const sg = Math.sign(off), kerb = rd.at + sg * rd.hw, sgn = isOneWay(rd.axis, rd.L) ? oneWayDir(rd.axis, rd.L) : laneDir(rd.axis, off), rot = rotAlong(rd.axis, sgn);
      // no-park stretches along this kerb: hydrants and stops on the sidewalk beside it, and the plan's reserved spots (taken)
      const near = e => { const l0 = X ? e[0] : e[2], l1 = X ? e[3] : e[5], a = Math.min(kerb, kerb + sg * 3), b = Math.max(kerb, kerb + sg * 3); return l1 > a && l0 < b; };
      const nope = [];
      if (B) { for (const it of B.boxes) if (it.kind === 'hydrant' && near(it.box)) nope.push([(X ? it.box[2] : it.box[0]) - KEEP.hydrant, (X ? it.box[5] : it.box[3]) + KEEP.hydrant]);
        for (const k of B.keep) if (k.tag === 'transit' && near(k.box)) nope.push([(X ? k.box[2] : k.box[0]) - KEEP.transit, (X ? k.box[5] : k.box[3]) + KEEP.transit]); }
      // a dealing corner's detour: its walkers leave the sidewalk and walk the road along the kerb out to r1 from the corner (engine.js)
      if (B) { const s = slab(B.i, B.j), c0 = X ? s.z0 : s.x0, c1 = X ? s.z1 : s.x1, side = X ? (lat < (s.x0 + s.x1) / 2 ? 'W' : 'E') : (lat < (s.z0 + s.z1) / 2 ? 'N' : 'S');
        for (const d of detourCornersOf(B.i, B.j)) { if (!d.c.includes(side)) continue; const lo = X ? d.c[0] === 'N' : d.c[1] === 'W'; nope.push(lo ? [c0 - 4, c0 + d.r1 + 1.5] : [c1 - d.r1 - 1.5, c1 + 4]); } }
      for (const q of taken) { const rq = q[2] || 5, ql = X ? q[0] : q[1], qa = X ? q[1] : q[0]; if (Math.abs(ql - lat) < rq) nope.push([qa - rq, qa + rq]); }
      // CAB TRAFFIC (2026-10-10) · a taxi stand's kerb bays (transitnet.js TAXI_KERB: a cab pulls in there out of the travel lane) — no parked car in one
      for (const K of Object.values(TAXI_KERB)) for (const [bx, bz] of K.slots) { const bl = X ? bx : bz, ba = X ? bz : bx; if (Math.abs(bl - lat) < 1.2) nope.push([ba - 2.2 - .6, ba + 2.2 + .6]); }
      let t = t0 + r() * 1.5;
      while (t < t1 - 3.4) {
        if (r() > dens) { t += 1.5 + r() * 4; continue; }   // an empty space
        const id = pickVehicle(district, r(), X ? lat : t, X ? t : lat), S = id && VEH[id], len = S ? S.dims.l : 4, variant = Math.floor(r() * (S?.variants || 1));
        if (!S || t + len > t1) { t += 1; continue; }
        if (nope.some(([a, b]) => t < b && t + len > a)) { t += .8; continue; }
        const c = t + len / 2, x = X ? lat : c, z = X ? c : lat;
        const tpl = vehicleProp(id, { variant, night: TOD.night, lights: TOD.night && id === 'livery', driver: DRIVER.has(id), kind: 'car' });
        if (B && REG.why(REG.boxOf(tpl, rot, x, 0, z), { doors: false, walk: false })) { t += .8; continue; }
        stamp(tpl, bankOf(bi, bj), rot, x, 0, z); t += len + .6 + r() * 1.3;
      }
    }
  }
}
