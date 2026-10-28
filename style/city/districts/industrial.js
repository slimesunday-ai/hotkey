// THE YARDS (industrial) · the district kit (batch 3) · owner: the supply agent. Industry and warehouses between the docks and downtown:
// street demand 2 by day, 3 at night; the dealing corner at Maple & Foundry (96, −192). A custom generator (districts/industrial/):
// every block is planned once (plan.js: parcels of brick loft warehouses, corrugated sheds, sawtooth factories, cold storage, auto
// shops, quonsets and small fronts, with courts, truck fleets, container stacks, materials, a tow pound, a vacant lot, aggregate,
// road salt and a tank farm), built at full detail (works.js, yard.js, roofs.js) and drawn at 0.5 for the far tier from the same plan.
// Every painted name on the supply side is allocated once (names.js). Two heroes: the chop shop on the corner and the foundry.
import { defineKit } from './api.js';
import { BASE, PALETTE, LEXICON } from '../grammar.js';
import { REG } from '../audit.js';
import { C, CV, SIDE, air, shade, hash, H } from './industrial/lib.js';
import { yardsPlan, HERO_BLOCKS } from './industrial/plan.js';
import { brick, shed, sawtooth, cold, garage, quonset, front } from './industrial/works.js';
import { floor, fence, plateOn, yardContents, mound } from './industrial/yard.js';
import { roofKit, roofPiece, pieceRect, farPiece } from './industrial/roofs.js';
import { DECKS } from './industrial/names.js';
import { remap, shiftOf, SPREAD } from '../../../world/city.js';
import { kerbX, kerbZ, camera, stopAt } from './frame.js';
// SPREAD · the hand-placed marks below are today's metres (districts/frame.js): the station on its lot (kerbX / kerbZ: the block's shift),
// the safehouse through remap, a camera on what it frames (camera; the corner and Bishop Ave views from places of their own). The
// identity at SPREAD 0
const rp = (x, z) => { const [X, Z] = remap(x, z); return { x: X, z: Z }; };

const BUILD = { brick, shed, sawtooth, cold, garage, quonset, front };
// heights of a parcel in metres (wall top, highest point): the full build, the plan's masses and the far tier all read this
export function heightOf(s) {
  switch (s.kind) {
    case 'brick': { const w = (42 + (s.st - 1) * 34 + 18) * CV; return { wall: w, top: w + .8 }; }
    case 'cold': return { wall: s.hv * CV, top: s.hv * CV + .5 };
    case 'garage': { const w = ((s.st ?? 1) === 1 ? 52 : 82) * CV; return { wall: w, top: w + .6 }; }
    case 'front': { const w = (40 + ((s.st ?? 2) - 1) * 32) * CV; return { wall: w, top: w + .6 }; }
    case 'shed': { const hw = (s.hw ?? 62) * CV, span = Math.min(s.x1 - s.x0, s.z1 - s.z0); return { wall: hw, top: hw + span / 6 + .4, pitched: true }; }
    case 'sawtooth': { const hw = (s.hw ?? 58) * CV; return { wall: hw, top: hw + 2.4, pitched: true }; }
    case 'quonset': { const r = Math.min(s.x1 - s.x0, s.z1 - s.z0) / 2; return { wall: r, top: r + .2, pitched: true }; }
  } return { wall: 6, top: 6.5 };
}
const rectOf = s => [s.x0, s.z0, s.x1, s.z1];
// the ground the building's facade parts stand on: its rect grown by 0.3 m (1.6 m on a dock side), so floors and fences keep off them
const footOf = s => { const m = { '-z': .3, '+z': .3, '-x': .3, '+x': .3 }; if (s.dock) m[s.dock] = 1.7; for (const f of s.faces) m[f] = Math.max(m[f], .3); return [s.x0 - m['-x'], s.z0 - m['-z'], s.x1 + m['+x'], s.z1 + m['+z']]; };

function build(ctx) {
  const P = yardsPlan(ctx.kit).get(ctx.i + '_' + ctx.j); if (!P || P.hero) return;
  REG.plan(P.parcels.map((s, k) => ({ box: [s.x0, SIDE, s.z0, s.x1, SIDE + heightOf(s).top + .2, s.z1], group: 'P' + k })));
  const built = [];
  P.parcels.forEach((s, k) => { ctx.group('P' + k); const out = BUILD[s.kind](ctx, s); built.push({ spec: s, ...out }); });
  // roofs: calm clutter in the building's volume, the set piece as its own volume on top
  built.forEach((b, k) => { const s = b.spec; if (b.pitched || !b.V) return; ctx.group('P' + k);
    const roof = [s.x0 + .5, s.z0 + .5, s.x1 - .5, s.z1 - .5], pr = s.piece ? pieceRect(s.piece, roof) : null; roofKit(b, s, pr);
    if (s.piece) roofPiece(ctx, s.piece, pr, b.top); });
  // yards: floor, fence and gate, a tin plate, what it holds
  const feet = P.parcels.map(footOf);
  P.yards.forEach((y, k) => { ctx.group('Y' + k); const R = [y.x0, y.z0, y.x1, y.z1], fl = { court: 'asph', trucks: 'asph', parking: 'asph', tow: 'gravel', containers: 'conc', materials: 'gravel', vacant: 'dirt', aggregate: 'conc', salt: 'conc', tanks: 'gravel' }[y.kind] || 'gravel';
    const lines = y.fence.map(sd => sd === '-z' ? [y.x0, y.z0, y.x1, y.z0 + CV] : sd === '+z' ? [y.x0, y.z1 - CV, y.x1, y.z1] : sd === '-x' ? [y.x0, y.z0, y.x0 + CV, y.z1] : [y.x1 - CV, y.z0, y.x1, y.z1]);
    floor(ctx, R, fl, feet, { paint: paintFor(y), keep: lines });
    const g = fence(ctx, R, y.fence, y.fenceKind, y.gate, feet.map((f, n) => P.parcels[n] ? rectOf(P.parcels[n]) : f), { gateW: y.kind === 'parking' ? 5 : 5.4 });
    if (y.warn && y.fence.length) { const sd = y.fence.find(f => f !== y.gate) || y.fence[0], t = .3 + H(y.seed, 9) * .4, x = sd[1] === 'z' ? y.x0 + (y.x1 - y.x0) * t : sd === '-x' ? y.x0 : y.x1, z = sd[1] === 'x' ? y.z0 + (y.z1 - y.z0) * t : sd === '-z' ? y.z0 : y.z1;
      plateOn(ctx, y.warn, sd, x, z, 1.3, [C.chalk, C.hazard, C.red, C.cobalt][(y.seed >> 3) & 3], [C.red, C.ink, C.chalk, C.chalk][(y.seed >> 3) & 3], H(y.seed, 10) < .5 ? 'tin' : 'stencil'); }
    yardContents(ctx, y, P, built); });
}
// painted ground: hatched loading aprons and stall lines on asphalt, a yellow walkway on concrete
function paintFor(y) {
  if (y.kind === 'court') return (x, z) => (Math.abs(((x + z) * 10 | 0) % 14) < 2 && ((y.gate === '-z' || y.gate === '+z') ? Math.abs(z - (y.gate === '-z' ? y.z1 : y.z0)) < 2.2 : Math.abs(x - (y.gate === '-x' ? y.x1 : y.x0)) < 2.2)) ? C.hazard : null;
  if (y.kind === 'parking' || y.kind === 'trucks') { const lx = (y.x1 - y.x0) >= (y.z1 - y.z0), pitch = y.kind === 'trucks' ? 3.1 : 2.7; return (x, z) => { const u = lx ? x - y.x0 : z - y.z0; return (Math.abs(u % pitch) < .1 && u > .5) ? C.chalk : null; }; }
  if (y.kind === 'containers') return (x, z) => ((x * 10 | 0) % 40 < 20 && Math.abs(z - (y.z0 + y.z1) / 2) < .08) ? C.hazard : null;
  return null;
}

// ── the far tier: the same parcels at 0.5 (walls lean 30% to the haze), window bands on brick, roofs neutral, pieces and yards as blobs
function far(ctx) {
  const P = yardsPlan(ctx.kit).get(ctx.b.i + '_' + ctx.b.j); if (!P || P.hero) return;
  const V = ctx.V, S = .5, X0 = V.org[0], Z0 = V.org[2], ix = x => Math.round((x - X0) / S), iz = z => Math.round((z - Z0) / S), iy = y => Math.round((y - SIDE) / S);
  for (const s of P.parcels) { const h = heightOf(s), wall = air(s.wall), X = ix(s.x0), XX = ix(s.x1), Z = iz(s.z0), ZZ = iz(s.z1), Hc = Math.max(2, iy(SIDE + h.wall)), glassA = air(0x1b2a55);
    V.box(X, 0, Z, XX, Hc, ZZ, (x, y, z) => { const edge = x === X || x === XX - 1 || z === Z || z === ZZ - 1; if (!edge) return wall;
      if (y < 2 && s.kind !== 'front') return (x + z) % 3 === 0 ? air(s.door) : wall; if (s.kind === 'front' && y < 3) return y === 2 ? (s.sign ?? C.red) : C.ink;
      if (s.kind === 'brick' && y >= 5 && y < Hc - 3 && (y - 5) % 7 >= 2 && (y - 5) % 7 <= 4 && (x + z) % 3 !== 0) return glassA; return wall; });
    ctx.maxH = Math.max(ctx.maxH, h.top);
    if (s.kind === 'shed') { const ax = (s.x1 - s.x0) >= (s.z1 - s.z0); for (let k = 0; k < 3; k++) { const i0 = ax ? X : X + k * 2, i1 = ax ? XX : XX - k * 2, k0 = ax ? Z + k * 2 : Z, k1 = ax ? ZZ - k * 2 : ZZ; if (i1 - i0 < 1 || k1 - k0 < 1) break; V.box(i0, Hc + k, k0, i1, Hc + k + 1, k1, 0xb9bec6); } }
    else if (s.kind === 'sawtooth') { const n = s.teeth ?? 4, per = (ZZ - Z) / n; for (let t = 0; t < n; t++) { const za = Math.round(Z + t * per); V.box(X, Hc, za, XX, Hc + 4, za + 1, 0xbfe0ff); V.box(X, Hc, za + 1, XX, Hc + 2, Math.round(za + per), 0xd2d3d6); } }
    else if (s.kind === 'quonset') { /* the barrel reads as its massing */ }
    else { V.box(X, Hc, Z, XX, Hc + 1, ZZ, (x, y, z) => (x === X || x === XX - 1 || z === Z || z === ZZ - 1) ? shade(s.roofCol ?? 0xdcd8cf, .85) : s.roofCol ?? 0xdcd8cf);
      if (s.piece) farPiece((a, b, c, d, e, f, col) => V.box(ix(a), iy(b), iz(c), Math.max(ix(a) + 1, ix(d)), Math.max(iy(b) + 1, iy(e)), Math.max(iz(c) + 1, iz(f)), col), s.piece, pieceRect(s.piece, [s.x0 + .5, s.z0 + .5, s.x1 - .5, s.z1 - .5]), SIDE + h.wall); } }
  for (const y of P.yards) { const cx = (y.x0 + y.x1) / 2, cz = (y.z0 + y.z1) / 2;
    if (y.kind === 'containers') for (const [k, line] of (y.lines || []).entries()) { const col = lineCol(line), lx = (y.x1 - y.x0) >= (y.z1 - y.z0), off = (k ? 2.2 : -2.2);
      ctx.box(lx ? cx - 6 : cx + off - 1.2, SIDE, lx ? cz + off - 1.2 : cz - 6, lx ? cx + 6 : cx + off + 1.2, SIDE + 5.2, lx ? cz + off + 1.2 : cz + 6, air(col, .2)); }
    else if (y.kind === 'salt') ctx.box(cx - 4, SIDE, cz - 4, cx + 4, SIDE + 3, cz + 4, 0xf1f3f5);
    else if (y.kind === 'tanks') { const n = (y.x1 - y.x0) > 26 ? 3 : 2; for (let k = 0; k < n; k++) { const tx = y.x0 + (y.x1 - y.x0) * ((k + .5) / n), tz = y.z0 + (y.z1 - y.z0) * .4, r = 3.2; ctx.box(tx - r, SIDE, tz - r, tx + r, SIDE + 9 + (k % 2) * 3, tz + r, 0xf4f1ea); } }
    else if (y.kind === 'aggregate') [[0xe9c46a], [0xa7a9b1], [0xc0633f]].forEach(([c], k) => ctx.box(y.x0 + (y.x1 - y.x0) * (.2 + .3 * k) - 2, SIDE, y.z0 + (y.z1 - y.z0) * .45 - 2, y.x0 + (y.x1 - y.x0) * (.2 + .3 * k) + 2, SIDE + 1.5, y.z0 + (y.z1 - y.z0) * .45 + 2, c)); }
}
const lineCol = name => (DECKS.lines.find(l => l[0] === name) || [0, 0, C.grey])[2];

export default defineKit({
  district: 'industrial', name: 'The Yards', owner: 'the supply agent (batch 3)', status: 'built',
  role: 'Industry and warehouses between the docks and downtown. Street demand 2 by day, 3 at night (rules DEMAND); the dealing corner at Maple & Foundry (96, −192); the chop shop on that corner and the foundry across Foundry St. Brick loft warehouses, corrugated sheds, sawtooth factories, cold storage, auto shops, truck courts, container stacks, a tow pound, road salt and a tank farm on the water.',
  built: 'all',
  grammar: { ...BASE, life: [0, 0], walkway: .6 },
  palette: { ...PALETTE, neutral: { ...PALETTE.neutral, share: .38 } },
  lexicon: LEXICON,
  heroes: [
    { id: 'chop-shop', block: [2, -6], module: 'heroes/industrial-chopshop.js', fn: 'chopShop' },
    { id: 'foundry', block: [3, -7], module: 'heroes/industrial-foundry.js', fn: 'foundry' },
  ],
  build, far,
  hooks: {},
  transit: [{ id: 'subway-low-tide', kind: 'subway', name: 'LOW TIDE', lines: 'T H', x: kerbX(72.5), z: kerbZ(-216.5), face: '-z', entry: 'stairs' },   // (W3b) the TIDE line's south end on Dock St, across from the shift office (block 2,−7: the truck court); (subway stations, 10-08) an open stair entrance set into the court's fence west of its gate (x 79.5 → 72.5: 79.5 was the gate)
    // BUS RETIME (2026-10-09) · at a spread the 4's DOCK ST shelter is on THIS side of Dock St, the kerb its bus pulls in at (it stood
    // across the street, districts/docks.js: the wider street's nearer kerb won the export's choice): east of the truck court's gate
    // (today's x 79.5) and the subway stairs, facing the street (rot 2)
    ...(SPREAD ? [stopAt({ id: 'bus-dock-shift', kind: 'bus', name: 'DOCK ST', x: 85, z: -219.5, rot: 2 })] : []),
    // (SUBWAY PLAN 2026-10-09) MAIN ST on the HARBOR: open stairs on the Yards' Main St lot, across Main St from the Heap's gate, the flight
    // east into the lot, set into the yard's fence between its gate and the shed (the spec's (9.5, −198.5) at +4, 0.95 m south: at −198.5 a
    // 1.1 m stub of the fence stood between it and the shed, in front of its board; today's 7.5, −175.55 through remap)
    { id: 'subway-heap', kind: 'subway', name: 'MAIN ST', lines: 'H', ...rp(7.5, -175.55), face: '-x', entry: 'stairs' }],
  safehouses: [{ id: 'safe-chop-back-room', name: 'the chop shop back room', ...rp(86.5, -178), note: 'behind the paint booth on Maple & Foundry' }],
  peds: { density: 1 },
  cameras: {
    overhead: camera({ pos: [96, 150, -60], tgt: [96, 0, -186], fov: 44, sh: [96, -186, 120] }, shiftOf(2, -6)),
    // Bishop Ave looks south into the Yards from its north end (the street rule stood inside the district and looked north, out at
    // downtown's block 3,−4 across the street), the foundry stacks and the port gantry closing the view
    street: [{ name: 'foundry-st', rule: 'street', block: [1, -6], side: '-z' }, camera({ name: 'bishop-ave', pos: [127.5, 2.9, -132], tgt: [133.5, 3.8, -158], fov: 54, sh: [130, -150, 34] }, shiftOf(3, -5), 'place')],
    landmark: camera({ name: 'maple-foundry', pos: [99.4, 2.6, -159.5], tgt: [88.5, 5.6, -182], fov: 54, sh: [92, -180, 30] }, shiftOf(2, -6), 'place'),
    night: camera({ name: 'maple-foundry-night', pos: [98.2, 2.9, -163.5], tgt: [95.2, 4.8, -190], fov: 56, sh: [95, -184, 34] }, shiftOf(2, -6), 'place'),   // clear of the lamp head at (95.5, −164.6)
  },
});
