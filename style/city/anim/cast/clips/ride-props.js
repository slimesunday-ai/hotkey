// RIDE PROPS · the one voxel model of the sim's `bike` and `scooter` items (MOVEMENT.md §2: one model everywhere: the icon, ridden,
// parked; owned, bought, stolen) and how the ride clips pose them (ride.js: scooter_ride, bike_pedal, bike_coast). No imports and no
// three at the top level (worker-safe, like skate-board.js: the icon baker can read bikeCells() / scooterCells() into its Vx grid:
// `for (const c of bikeCells()) v.set(...c)`).
//
// THE FRAME of both models: cells of GRAIN m; x across, y up, z ahead; the origin is ON THE GROUND under the rider's walker point (a
// ride clip draws its prop at the walker's own matrix, and lifts the body onto the saddle or the deck itself). One MAIN colour per item
// (the frame, the deck and stem) that the item can carry later (SCHEMES / { main }); everything else is the city's neutrals.
//   bike     a chunky toon cruiser: 0.6 m wheels (rolling radius BIKE.wheelR 0.30), wheelbase 1.16 m, a low step-through frame (the
//            rider's thighs meet at the body's midline, so no top tube), the bottom bracket forward of the saddle (a "flat-foot"
//            cruiser: the legs work forward and the saddle sits behind them), cruiser bars swept back to the grips, a front fender and
//            a lamp. Cranks 0.05 m, pedals 0.15 wide under the shoes' centres (x ±0.175: the rig's feet are fixed in x)
//   scooter  a stand-up e-scooter: a 0.95 × 0.30 m deck (the toon shoes are 0.45 m long; the rider stands turned 29° on it, one foot
//            ahead of the other), 0.2 m wheels, a raked stem, a T-bar, a lamp, a battery under the deck, a rear fender
// RIDDEN, the moving bits are separate PARTS posed by the clip's clock (ride.js): the wheels' rims and spokes spin inside their tyres
// (the tyre stays put, so a wheel always touches the ground), the bike's cranks turn, its pedals pitch with the feet, the kickstand
// folds. Each part is its own small mesh (one InstancedMesh per part geometry in the city): partGeometry(THREE, item, part) and its
// local → walker matrix from partMatrix(THREE, item, part, pose, out). PARKED (and the icon) it is one static model: bikeCells() /
// bikeGeometry(THREE) (likewise the scooter), standing on its kickstand at parkedMatrix(THREE, item, out).
// Grain 0.025 m (half the character's 0.05, as the board, the tools and the gun): tubes, cranks and pedals need the finer step.
export const GRAIN = .025;
const G = GRAIN, TAU = Math.PI * 2;

// ── THE LAYOUTS (metres, the item's frame). ride.js seats the rider from these numbers.
export const BIKE = {
  wheelR: .3, axleR: [-.36, .3], axleF: [.8, .3],        // [z, y]
  bb: [.225, .28], crank: .05, crankX: .0375,             // the bottom bracket; the crank arms' centre plane (x ±, inboard of the shoes)
  pedal: { x: .175, w: .15, len: .1, top: .0125 },        // under the shoe's centre; its top face is `top` above the spindle's axis
  grip: [.3, .83, .47],                                   // [x, y, z] the hands' grip points (the bar's axis, the grips' middles)
  saddle: { top: .655, back: .675, zb: -.14, z0: -.26, z1: -.08, w: .15 },   // a low seat under the thighs' backs, a raised back (a cantle) behind the hips
  gear: 2,                                               // wheel turns per crank turn
  speed: 5.5,
};
export const SCOOTER = {
  wheelR: .1, axleR: [-.59, .1], axleF: [.64, .1],
  deck: { top: .125, z0: -.475, z1: .475, w: .3 },
  grip: [.3, .725, .405],
  speed: 6.5,
};
export const SCHEMES = {   // colourways (STYLE.md §2: flat, bold, never pastel). main = the item's colour; the rest are neutrals
  bike: { red: { main: 0xe8232a }, cobalt: { main: 0x2f5bff }, yellow: { main: 0xffe23a }, lime: { main: 0x6cff4a }, pink: { main: 0xff4fa3 }, cyan: { main: 0x2de2e6 } },
  scooter: { cyan: { main: 0x2de2e6 }, red: { main: 0xe8232a }, cobalt: { main: 0x2f5bff }, yellow: { main: 0xffe23a }, lime: { main: 0x6cff4a }, pink: { main: 0xff4fa3 } },
};
export const DEFAULT = { bike: 'red', scooter: 'cyan' };
const NEUTRAL = { tyre: 0x26262c, ink: 0x17171b, metal: 0xa7a9b1, dark: 0x5d636c, rim: 0xfff0d0, grip: 0x26262c, saddle: 0x2b2b31, lamp: 0xfff7c2, tape: 0x34343c };
const colours = (item, scheme) => { const s = typeof scheme === 'object' && scheme ? scheme : SCHEMES[item][scheme] || SCHEMES[item][DEFAULT[item]];
  const main = s.main ?? SCHEMES[item][DEFAULT[item]].main, d = c => { const m = k => Math.round(((c >> k) & 255) * .72); return (m(16) << 16) | (m(8) << 8) | m(0); };
  return { ...NEUTRAL, main, mainD: d(main), ...s }; };

// ── a voxel set: cells keyed by (i, j, k); a cell spans [i, i + 1] × G (etc.) in its part's own frame
function vox() { const M = new Map(), key = (i, j, k) => `${i},${j},${k}`;
  const V = { M, set(i, j, k, c, l = 0) { M.set(key(i, j, k), [i, j, k, c, l]); }, has: (i, j, k) => M.has(key(i, j, k)), del(i, j, k) { M.delete(key(i, j, k)); },
    // a tube between two points of the y–z plane (metres, [z, y]): every cell whose centre is within r of the segment, in the x cells xs
    tube(a, b, r, xs, c, l = 0) { const [az, ay] = a, [bz, by] = b, dz = bz - az, dy = by - ay, L2 = dz * dz + dy * dy;
      for (let k = Math.floor((Math.min(az, bz) - r) / G) - 1; k <= Math.ceil((Math.max(az, bz) + r) / G); k++) for (let j = Math.floor((Math.min(ay, by) - r) / G) - 1; j <= Math.ceil((Math.max(ay, by) + r) / G); j++) {
        const cz = (k + .5) * G, cy = (j + .5) * G, u = Math.max(0, Math.min(1, ((cz - az) * dz + (cy - ay) * dy) / L2)), ez = az + u * dz - cz, ey = ay + u * dy - cy;
        if (ez * ez + ey * ey <= r * r + 1e-9) for (const i of xs) V.set(i, j, k, c, l); } },
    // a ring (or a disc, r0 = 0) about an axle [z, y] (metres) in the x cells xs: cells whose centre radius is in [r0, r1); an arc keeps
    // the cells whose angle from straight up (+ toward +z) is in [a0, a1]
    ring(ax, r0, r1, xs, c, l = 0, arc = null) { const [az, ay] = ax;
      for (let k = Math.floor((az - r1) / G) - 1; k <= Math.ceil((az + r1) / G); k++) for (let j = Math.floor((ay - r1) / G) - 1; j <= Math.ceil((ay + r1) / G); j++) {
        const dz = (k + .5) * G - az, dy = (j + .5) * G - ay, rr = Math.hypot(dz, dy); if (rr < r0 - 1e-9 || rr >= r1 - 1e-9) continue;
        if (arc) { let a = Math.atan2(dz, dy); if (a < arc[0] - 1e-9) a += TAU; if (a > arc[1] + 1e-9) continue; }
        for (const i of xs) V.set(i, j, k, c, l); } },
    // a bar across x (a handlebar): one cell thick, at (z, y) = at(x) (metres) for each x cell from i0 to i1, every cell joined face to
    // face to the next; `thick(x)` → a 2 × 2 section there (the grips)
    bar(i0, i1, at, c, l, thick = () => false, c2 = c, l2 = l) { let prev = null;
      for (let i = i0; i <= i1; i++) { const x = (i + .5) * G, [z, y] = at(x), j = cz(y), k = cz(z), th = thick(x);
        if (prev) { let [pj, pk] = prev; while (pj !== j || pk !== k) { if (pj !== j) pj += Math.sign(j - pj); else pk += Math.sign(k - pk); V.set(i, pj, pk, th ? c2 : c, th ? l2 : l); } }
        V.set(i, j, k, th ? c2 : c, th ? l2 : l); if (th) { const jj = j + (y - (j + .5) * G > 0 ? 1 : -1), kk = k + (z - (k + .5) * G > 0 ? 1 : -1); V.set(i, jj, k, c2, l2); V.set(i, j, kk, c2, l2); V.set(i, jj, kk, c2, l2); }
        prev = [j, k]; } },
    box(i0, i1, j0, j1, k0, k1, c, l = 0) { for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) for (let k = k0; k <= k1; k++) V.set(i, j, k, c, l); },
    cells: () => [...M.values()] };
  return V; }
const cz = m => Math.floor(m / G + 1e-9);   // (the cell a coordinate falls in)

// ── THE PARTS. Each part's cells are in its own frame: the frame part in the item frame; a spinning part about its pivot (the axle or
// the bottom bracket at its origin), `off` cells shifting it (a half cell centres a one-cell-wide wheel on the tyre's mid-plane, so the
// spinning rim never shares a face with the tyre around it).
const XS = { mid: [-1, 0], L: [-2], R: [1], wide: [-2, -1, 0, 1] };
function bikeParts(K) {
  const B = BIKE, F = vox(), [bz, by] = B.bb;
  // the tyres (static: the rolling contact never moves), black, 2 cells wide, outer radius = the wheel's rolling radius
  for (const ax of [B.axleR, B.axleF]) F.ring(ax, B.wheelR - .05, B.wheelR, XS.mid, K.tyre, 0);
  // the frame: the down tube (the main colour, fat), the seat tube, the stays to the rear axle, the head tube, the fork, the stem
  const head0 = [.735, .6], head1 = [.705, .735], seat = [-.075, .565];
  F.tube(B.bb, head0, .032, XS.mid, K.main);                                   // down tube
  F.tube(B.bb, seat, .022, XS.mid, K.main);                                    // seat tube
  for (const xs of [XS.L, XS.R]) { F.tube(B.bb, B.axleR, .016, xs, xs === XS.R ? K.ink : K.main);   // chainstays (the right one dark: the chain)
    F.tube(seat, B.axleR, .014, xs, K.main); F.ring(B.axleR, 0, .028, xs, K.dark, 2); }            // seat stays · the dropouts
  F.ring(B.bb, 0, .045, XS.mid, K.dark, 2);                                    // the bottom-bracket shell
  F.tube(head0, head1, .036, XS.wide, K.main);                                 // head tube (4 wide)
  F.tube([.728, .58], B.axleF, .016, XS.L, K.main); F.tube([.728, .58], B.axleF, .016, XS.R, K.main);   // the fork's legs, beside the wheel
  F.ring(B.axleF, 0, .028, XS.L, K.dark, 2); F.ring(B.axleF, 0, .028, XS.R, K.dark, 2);
  F.tube(head1, [.68, .84], .02, XS.mid, K.metal, 2);                          // stem
  // the bars: a cross bar from the stem out to x ±0.075, then swept back to the grips (each grip 0.15 long, black, 2 × 2)
  const [gx, gy, gzz] = B.grip, by0 = .84, bz0 = .66, sweep = x => { const u = Math.max(0, Math.min(1, (x - .075) / (gx - .15 - .075))), e = u * u * (3 - 2 * u); return [bz0 + (gzz - bz0) * e, by0 + (gy - by0) * e]; };
  const gi = cz(gx + .085), isGrip = x => Math.abs(x) >= gx - .075 - 1e-9;
  F.bar(-gi - 1, gi, x => sweep(Math.abs(x)), K.metal, 2, isGrip, K.grip, 0);
  // the seat post and the saddle: a cruiser seat, its top at BIKE.saddle.top under the thighs' backs (the toon "butt" is the backs of
  // the thighs at the hip: the leg cloth hangs from there), rising behind the hips to a cantle at saddle.back (wider)
  const S = B.saddle, st = cz(S.top) - 1, sb = cz(S.back) - 1;
  F.tube(seat, [-.13, S.top - .04], .0126, XS.mid, K.metal, 2);
  for (let k = cz(S.z0); k <= cz(S.z1); k++) { const z = (k + .5) * G, nose = z > S.z1 - .05, back = z < S.zb, hw = nose ? 2 : back ? 4 : 3, top = back ? Math.min(sb, st + Math.round((S.zb - z) / G) + 1) : nose ? st - 1 : st;
    F.box(-hw, hw - 1, st - 1, top, k, k, K.saddle); }
  // the front fender over the top of the wheel (the main colour), the lamp on the head tube
  F.ring(B.axleF, B.wheelR + .0125, B.wheelR + .0375, XS.mid, K.main, 0, [-1.35, 1.0]);
  F.box(-1, 0, cz(.665), cz(.69), cz(.765), cz(.79), K.lamp, 1); F.box(-1, 0, cz(.665), cz(.69), cz(.79), cz(.79), K.ink, 0);
  // the wheel (spins about its axle; one cell wide, centred on the tyre's mid-plane): the rim, three fat spokes, the hub
  const W = vox(), R = B.wheelR;
  W.ring([0, 0], R - .1, R - .025, [0], K.rim, 1);
  for (let a = 0; a < 3; a++) { const t = a * TAU / 3; W.tube([0, 0], [Math.sin(t) * (R - .09), Math.cos(t) * (R - .09)], .028, [0], K.rim, 1); }
  W.ring([0, 0], 0, .045, [0], K.metal, 2);
  // the cranks (turn about the bottom bracket; the right arm points up at angle 0, the left down), each one cell wide, inboard of the
  // shoes (x ±0.025…0.05: the shoes' inner faces are at ±0.05), and the axle through the shell
  const C = vox();
  C.tube([0, 0], [0, B.crank], .0126, XS.R, K.metal, 2); C.tube([0, 0], [0, -B.crank], .0126, XS.L, K.metal, 2);
  C.ring([0, B.crank], 0, .02, XS.R, K.dark, 2); C.ring([0, -B.crank], 0, .02, XS.L, K.dark, 2);
  // a pedal (pitches with the foot about its spindle; the right one: x +; the left is its mirror): the spindle stub from the crank out,
  // the pedal under the shoe's centre, its top face BIKE.pedal.top above the axis (one cell thick, centred: off y −½)
  const P = vox(), PL = vox(), p0 = cz(B.pedal.x - B.pedal.w / 2), p1 = cz(B.pedal.x + B.pedal.w / 2) - 1, pset = (i, k, c, l) => { P.set(i, 0, k, c, l); PL.set(-1 - i, 0, k, c, l); };
  for (let i = 2; i < p0; i++) pset(i, -1, K.metal, 2), pset(i, 0, K.metal, 2);
  for (let i = p0; i <= p1; i++) for (let k = -2; k <= 1; k++) pset(i, k, (i === p0 || i === p1) ? K.ink : K.dark, 0);
  // the kickstand (pivots outside the left chainstay behind the bracket; down when parked, hidden when ridden: the left shoe sweeps there)
  const KS = vox(); KS.tube([0, 0], [0, -.27], .0126, [0], K.metal, 2); KS.box(0, 0, cz(-.27), cz(-.27), -1, 1, K.dark, 2);
  return {
    frame: { cells: F.cells(), off: [0, 0, 0] },
    wheel: { cells: W.cells(), off: [-.5, 0, 0] },
    crank: { cells: C.cells(), off: [0, 0, 0] },
    pedalR: { cells: P.cells(), off: [0, -.5, 0] },
    pedalL: { cells: PL.cells(), off: [0, -.5, 0] },
    stand: { cells: KS.cells(), off: [-.5, 0, 0] },
  };
}
function scooterParts(K) {
  const S = SCOOTER, F = vox(), D = S.deck, j1 = cz(D.top) - 1;
  for (const ax of [S.axleR, S.axleF]) F.ring(ax, S.wheelR - .04, S.wheelR, XS.mid, K.tyre, 0);
  // the deck: the main colour, black grip tape on top inset a cell (a rim of colour shows from above), a dark battery underneath
  const i0 = Math.round(-D.w / 2 / G), i1 = Math.round(D.w / 2 / G) - 1, k0 = cz(D.z0), k1 = cz(D.z1) - 1;
  for (let k = k0; k <= k1; k++) { const tip = k === k0 || k === k1, w = tip ? 1 : 0;
    F.box(i0 + w, i1 - w, j1 - 1, j1 - 1, k, k, K.main); if (!tip) F.box(i0 + 1, i1 - 1, j1, j1, k, k, K.tape); else F.box(i0 + w, i1 - w, j1, j1, k, k, K.main); }
  F.box(i0 + 2, i1 - 2, j1 - 2, j1 - 2, k0 + 3, k1 - 3, K.ink);
  // the rear: the deck carries on over the wheel as a fender; the front: the neck rises to the stem's foot, the fork down to the axle
  F.ring(S.axleR, S.wheelR + .0125, S.wheelR + .0375, XS.mid, K.main, 0, [-2.2, .2]);
  F.tube([D.z1 - .02, D.top - .03], [.6, .2], .03, XS.mid, K.main);
  for (const xs of [XS.L, XS.R]) { F.tube([.6, .2], S.axleF, .014, xs, K.dark, 2); F.ring(S.axleF, 0, .024, xs, K.dark, 2); F.ring(S.axleR, 0, .024, xs, K.dark, 2); F.tube([D.z0 + .04, D.top - .04], S.axleR, .014, xs, K.dark, 2); }
  // the stem (raked back, fat, the main colour), the lamp on its front, the T-bar with black grips
  const [gx, gy, gz] = S.grip, top = [gz + .02, gy + .015];
  F.tube([.6, .2], top, .03, XS.mid, K.main);
  { const u = (.5 - .2) / (top[1] - .2), lz = .6 + (top[0] - .6) * u + .045; F.box(-1, 0, cz(.48), cz(.52), cz(lz), cz(lz), K.lamp, 1); }   // (the lamp on the stem's front, y 0.5)
  F.bar(-cz(gx + .085) - 1, cz(gx + .085), () => [gz, gy], K.metal, 2, x => Math.abs(x) >= gx - .075 - 1e-9, K.grip, 0);
  F.tube([gz, gy], top, .02, XS.mid, K.main);
  // a wheel (spins): a solid grey hub disc with a bolt circle (one cell wide, centred)
  const W = vox(); W.ring([0, 0], 0, S.wheelR - .02, [0], K.metal, 2); for (let a = 0; a < 4; a++) { const t = a * TAU / 4; W.ring([Math.sin(t) * .035, Math.cos(t) * .035], 0, .013, [0], K.dark, 2); }
  const KS = vox(); KS.tube([0, 0], [0, -.11], .0126, [0], K.dark, 2);
  return { frame: { cells: F.cells(), off: [0, 0, 0] }, wheel: { cells: W.cells(), off: [-.5, 0, 0] }, stand: { cells: KS.cells(), off: [-.5, 0, 0] } };
}
const PARTS = { bike: bikeParts, scooter: scooterParts };
const partCache = new Map();
function partsOf(item, scheme) { const key = item + ':' + (typeof scheme === 'object' ? JSON.stringify(scheme) : scheme ?? DEFAULT[item]); if (!partCache.has(key)) partCache.set(key, PARTS[item](colours(item, scheme))); return partCache.get(key); }
export const PART_IDS = { bike: ['frame', 'wheel', 'crank', 'pedalR', 'pedalL', 'stand'], scooter: ['frame', 'wheel', 'stand'] };

// ── THE POSE of a ridden item at the clip's clock (ride.js evaluates its track into this): { wheel (rad, both wheels' turn: + = the top
// rolls forward), crank (rad, the right arm's angle from straight up, + = forward; the left is opposite), fpL, fpR (the pedals' pitch,
// + toe up, = the feet's), lift, pitch (the whole item: a bump, m and rad about the rear contact), stand (0 folded, 1 down) }
export const REST = Object.freeze({ wheel: 0, crank: Math.PI / 2, fpL: 0, fpR: 0, lift: 0, pitch: 0, stand: 0 });
// where each part sits: the item's whole-body matrix (the bump) × the part's own (the axle or the bracket, its turn)
function placements(item, p) {
  const out = [], X = item === 'bike' ? BIKE : SCOOTER;
  out.push(['frame', [0, 0, 0], 0]);
  out.push(['wheel', [0, X.axleR[1], X.axleR[0]], p.wheel], ['wheel', [0, X.axleF[1], X.axleF[0]], p.wheel]);
  if (item === 'bike') { const [bz, by] = BIKE.bb, c = p.crank, r = BIKE.crank;
    out.push(['crank', [0, by, bz], c]);
    out.push(['pedalR', [0, by + r * Math.cos(c), bz + r * Math.sin(c)], -p.fpR]);
    out.push(['pedalL', [0, by - r * Math.cos(c), bz - r * Math.sin(c)], -p.fpL]);
    out.push(['stand', [-.0625, .27, .07], .36, p.stand >= .5 ? 1 : 0]); }
  else out.push(['stand', [-.0875, .075, -.25], .3, p.stand >= .5 ? 1 : 0]);
  return out; }
// partMatrices(THREE, item, pose) → [[partId, Matrix4 (local → walker)], …]: one entry per instance, always the same list (the bike:
// frame, 2 wheels, the crank, the right and left pedals, the stand · the scooter: frame, 2 wheels, the stand). A hidden part (the
// stand while ridden) is collapsed onto its pivot (scale 1e-4), as work-tools.js hides a tool.
export function partMatrices(THREE, item, p = REST, outs = null) {
  const A = new THREE.Matrix4(), base = baseMatrix(THREE, item, p, new THREE.Matrix4()), list = placements(item, p);
  return list.map(([id, pos, ang, show], n) => { const m = outs?.[n]?.[1] || new THREE.Matrix4();
    m.copy(base).multiply(A.makeTranslation(pos[0], pos[1], pos[2])).multiply(A.makeRotationX(ang));
    if (show === 0) m.multiply(A.makeScale(1e-4, 1e-4, 1e-4));
    return [id, m]; });
}
// the whole item's bump: lifted `lift` and pitched `pitch` (+ nose up) about the rear wheel's ground contact
function baseMatrix(THREE, item, p, out) { const X = item === 'bike' ? BIKE : SCOOTER, A = new THREE.Matrix4(), zc = X.axleR[0];
  return out.makeTranslation(0, p.lift || 0, zc).multiply(A.makeRotationX(-(p.pitch || 0))).multiply(A.makeTranslation(0, 0, -zc)); }

// ── PARKED: the item on its kickstand, leaned onto it (roll about the line through the wheels' ground contacts), the parts at rest
export const PARKED = { bike: { roll: .14, stand: 1, crank: Math.PI / 2 }, scooter: { roll: .12, stand: 1 } };
export function parkedMatrix(THREE, item, out = new THREE.Matrix4()) { return out.makeRotationZ(-PARKED[item].roll); }   // (− : it leans onto its left, the stand's side)
const parkedPose = item => ({ ...REST, ...PARKED[item], fpL: 0, fpR: 0 });

// ── THE CELLS of the whole item, parked pose, on the item's grid (the icon baker's Vx grid; also the parked mesh): every part placed
// and re-voxelised onto the frame's grid (a spinning part's half-cell offset rounds onto the grid). [x, y, z, colour, layer]
export function itemCells(item, scheme = null) {
  const parts = partsOf(item, scheme ?? DEFAULT[item]), p = parkedPose(item), M = new Map(), key = c => `${c[0]},${c[1]},${c[2]}`;
  for (const c of parts.frame.cells) M.set(key(c), c);
  for (const [id, pos, ang] of placements(item, p)) { if (id === 'frame') continue; const P = parts[id], ca = Math.cos(ang), sa = Math.sin(ang);
    for (const [i, j, k, col, l] of P.cells) { const x = (i + .5 + P.off[0]) * G, y = (j + .5 + P.off[1]) * G, z = (k + .5 + P.off[2]) * G;
      const Y = y * ca - z * sa + pos[1], Z = y * sa + z * ca + pos[2], c = [cz(x + pos[0]), cz(Y), cz(Z), col, l], kk = key(c); if (!M.has(kk) || id !== 'stand') M.set(kk, c); } }
  return [...M.values()];
}
export const bikeCells = scheme => itemCells('bike', scheme), scooterCells = scheme => itemCells('scooter', scheme);

// ── the meshes: one quad per open cell face, the city's corner AO (as skate-board.js boardGeometry), vertex colours, metres. THREE is
// passed in (no import here). Memoised per item, part and scheme.
const DIRS = [
  { n: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]] }, { n: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },
  { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] }, { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] }, { n: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]] },
];
const AOV = [.55, .72, .87, 1], GEO = new Map();
function mesh(THREE, cells, off = [0, 0, 0]) {
  const M = new Map(), k = (x, y, z) => `${x},${y},${z}`; for (const c of cells) M.set(k(c[0], c[1], c[2]), c[3]);
  const has = (x, y, z) => M.has(k(x, y, z)) ? 1 : 0, P = [], N = [], C = [], I = [], col = new THREE.Color(); let v = 0;
  for (const [x, y, z, hex] of cells) for (const d of DIRS) { const [nx, ny, nz] = d.n; if (has(x + nx, y + ny, z + nz)) continue;
    const a4 = d.c.map(c => { const t = [nx ? 0 : (c[0] ? 1 : -1), ny ? 0 : (c[1] ? 1 : -1), nz ? 0 : (c[2] ? 1 : -1)], e = [];
      if (t[0]) e.push([t[0], 0, 0]); if (t[1]) e.push([0, t[1], 0]); if (t[2]) e.push([0, 0, t[2]]);
      const ax = x + nx, ay = y + ny, az = z + nz, s1 = has(ax + e[0][0], ay + e[0][1], az + e[0][2]), s2 = has(ax + e[1][0], ay + e[1][1], az + e[1][2]), cr = has(ax + t[0], ay + t[1], az + t[2]);
      return s1 && s2 ? 0 : 3 - (s1 + s2 + cr); });
    col.setHex(hex);
    d.c.forEach((c, q) => { P.push((x + c[0] + off[0]) * G, (y + c[1] + off[1]) * G, (z + c[2] + off[2]) * G); N.push(nx, ny, nz); const a = AOV[a4[q]]; C.push(col.r * a, col.g * a, col.b * a); });
    if (a4[0] + a4[2] < a4[1] + a4[3]) I.push(v + 1, v + 2, v + 3, v + 1, v + 3, v); else I.push(v, v + 1, v + 2, v, v + 2, v + 3); v += 4; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setIndex(I); g.computeBoundingSphere(); return g;
}
const skey = (item, scheme) => typeof scheme === 'object' && scheme ? JSON.stringify(scheme) : scheme ?? DEFAULT[item];
// one part's mesh, in its own frame (partMatrices places it)
export function partGeometry(THREE, item, part, scheme = null) { const key = `${item}:${part}:${skey(item, scheme)}`;
  if (!GEO.has(key)) { const P = partsOf(item, scheme ?? DEFAULT[item])[part]; GEO.set(key, mesh(THREE, P.cells, P.off)); } return GEO.get(key); }
// the whole item as one static mesh (parked, the icon's model): itemCells
export function itemGeometry(THREE, item, scheme = null) { const key = `${item}:whole:${skey(item, scheme)}`; if (!GEO.has(key)) GEO.set(key, mesh(THREE, itemCells(item, scheme))); return GEO.get(key); }
export const bikeGeometry = (THREE, scheme) => itemGeometry(THREE, 'bike', scheme), scooterGeometry = (THREE, scheme) => itemGeometry(THREE, 'scooter', scheme);

// ── ONE LIVE MESH (the anim lab's prop slot draws one geometry with one matrix: lab.js drawProps): every part merged into one geometry
// whose vertices are re-posed on the CPU by pose(p) (a few thousand vertices). For a single preview (the lab, a sheet); the city draws
// the parts instanced (partGeometry + partMatrices), never this.
export function liveMesh(THREE, item, scheme = null) {
  const parts = partsOf(item, scheme ?? DEFAULT[item]), list = placements(item, REST), src = list.map(([id]) => partGeometry(THREE, item, id, scheme));
  const n = src.reduce((s, g) => s + g.attributes.position.count, 0), P = new Float32Array(n * 3), N = new Float32Array(n * 3), C = new Float32Array(n * 3), I = [];
  let o = 0; src.forEach(g => { C.set(g.attributes.color.array, o * 3); for (const i of g.index.array) I.push(i + o); o += g.attributes.position.count; });
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(P, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(N, 3)); geo.setAttribute('color', new THREE.BufferAttribute(C, 3)); geo.setIndex(I);
  const V = new THREE.Vector3(), NM = new THREE.Matrix3(); let mats = null;
  geo.userData.pose = (p) => { mats = partMatrices(THREE, item, p, mats); let q = 0;
    mats.forEach(([id, m], n) => { const g = src[n], sp = g.attributes.position.array, sn = g.attributes.normal.array; NM.getNormalMatrix(m);
      for (let i = 0; i < sp.length; i += 3, q += 3) { V.set(sp[i], sp[i + 1], sp[i + 2]).applyMatrix4(m); P[q] = V.x; P[q + 1] = V.y; P[q + 2] = V.z; V.set(sn[i], sn[i + 1], sn[i + 2]).applyMatrix3(NM).normalize(); N[q] = V.x; N[q + 1] = V.y; N[q + 2] = V.z; } });
    geo.attributes.position.needsUpdate = geo.attributes.normal.needsUpdate = true; geo.computeBoundingSphere(); };
  geo.userData.pose(REST); return geo;
}
