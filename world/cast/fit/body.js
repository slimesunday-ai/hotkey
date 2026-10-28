// CHARACTER FITTING · BODY (2026-09-30): which body segment every garment voxel rides, the joint caps and slabs that hide the
// cuts, and the neckline of every top. Rules: world/fit/contract.js (REGIONS, NECKLINES, neckRing / chestFront). No three.js here:
// chars.js, anim/bake.js (walk v2 segments) and the audit (style/city/studio/audit/lib.mjs) all route through this one file.
//
// 1 · ROUTING. A garment voxel's segment comes from the body geometry it covers, never from a bare x threshold.
//     A top is a SHELL round the torso plus SLEEVES round the arms. Its shell reaches `flank` columns past the torso's sides
//     (the torso is x −5…4; flank 1, x −6…5, is the default; 2, x −7…6, for a big padded shell; 0 for a shell that hugs the
//     torso): every shell voxel, flanks included, rides the CHEST. Only what lies outside the shell rides the arm: ONE rigid piece
//     from the shoulder to the hand (SIMPLE ARMS, 2026-09-30: no elbow, the classic toon arm; partOf). The bare arm keeps its own skin (x −8…−6 / 5…7): where a shell covers the arm's
//     inner column, that column is the shirt's side and stays with the chest (a hem cell at y 9 inside the hand's box is the hand's:
//     the hand is drawn over it, and fit/held.js draws the hands over their own limb). Pants: the waistband and seat (y 10…12) ride the
//     pelvis, with connected thighs (y 6…9) and shins (y 4…5). Complete shoes have a separate SH grid (y 0…3).
//     bakeSegFull joins thigh/shin surfaces; walk2 bends shared rings instead of exposing a cut. See anim/LOWER.md.
//     The routing is per look: TOPFIT[id].flank. A fresh top declares `flank` and `neckline` in its registry entry
//     (world/fresh/tops.js); chars.js copies them into TOPFIT at load (else flank 1, crew).
//     segOf(tag, x, y, z, fit) gives the walk v2 part (anim/bake.js PART2); bodyPart() the chars.js rig group; regionOf() the
//     contract's REGION name. `fit` is compose()'s per-look context (chars.js: { top, flank, seg, force }).
//
// 2 · AUTHORING SLEEVES. Inside a TOPS draw, wrap a piece in onSeg(B, region, () => { … }): every voxel it writes rides that
//     region whatever its position (a later write by anything else clears it). The arm is one segment (region 'armL' / 'armR'),
//     so a sleeve is ONE piece per arm, the full length for long sleeves, the top for short ones, as big as the design wants; only
//     the shoulder turns, and a sleeve may overlap it:
//       shoulderCap(B, side, paint, o)  arm · y 17…18 over the sleeve, overlapping the chest by one column
//       kneeCap(B, side, paint, o)      thigh · a one-voxel ring round the pant leg at y 6 (pants)
//     segY(region, y) is y counted from the segment's own first row (arm 9: the wrist, thigh 6, shin 3; use it in a paint function).
//     sleeve(B, side, region, box, paint, l) lays one sleeve piece: box {x0, x1, y0, y1, z0, z1} (inclusive, x for the LEFT arm;
//     mirrored for R), paint(lx, ly, z, X, y) with lx counted outwards from the arm's inner side and ly = segY.
//
// 3 · JOINT SLABS (SLABS below, used by anim/bake.js bakeSegFull and the audit): [child, parents, directions child → parent,
//     depth, rows?, skip?]. skip: slots whose voxels are never copied (the head's collar slab skips the necklace). A child carries copies of its parent's voxels next to it; at rest they sit inside the parent, in a bend they
//     fill the wedge. rows [y0, y1] limits the child voxels that grow one (the shoulder slab only grows off the top of the arm:
//     below it a copy of the shirt's side would ride the arm, the very fault the routing fixes).
//
// 4 · NECKLINES. TOPFIT[id].neckline ∈ contract NECKLINES (from the top's registry entry).
//     neckRing(look) → [{x, y, z}, …]: the ordered path where a chain rests round the neck at the top of the neckline: from the
//       left side at z −1, forward and across the front (the front arc is its lowest part), back along the right side to z −1.
//       Open necklines (crew, vee, bare, a low collar) give a ring round the neck on the shoulders (y 18); a closed one (hood,
//       a high collar, a padded shell that buries the neck) gives the front arc on the collar's front face only.
//     chestFront(look, x, y) → z | null: the front surface z of the outermost CHEST voxel at (x, y) once the top is drawn (arms
//       excluded; necklaces and accessories not drawn). A pendant lies at z + 1.
//     Both read the look's body + bottom + top, drawn on a fresh grid by the drawer chars.js installs (installFit), cached per
//     top + bottom, so they are safe to call from inside compose() (a necklace's draw).

// ── segments (anim/bake.js PART2) and the contract's regions
// (simple arms, 2026-09-30: the forearm is merged into the arm, shoulder to hand; ids 10 and 11 are unused, the rest keep their numbers.
// 'upperArm*' / 'forearm*' are kept as aliases of the arm region for anything authored before)
export const PART2 = { chest: 0, thighL: 1, thighR: 2, armL: 3, armR: 4, head: 5, shinL: 6, shinR: 7, footL: 8, footR: 9, pelvis: 12 };
const REGION_PART = { head: 5, earL: 5, earR: 5, neck: 0, chest: 0, flankL: 0, flankR: 0, armL: 3, armR: 4, handL: 3, handR: 4, upperArmL: 3, upperArmR: 4, forearmL: 3, forearmR: 4,
  pelvis: 12, thighL: 1, thighR: 2, shinL: 6, shinR: 7, footL: 8, footR: 9 };
const REGION_GROUP = r => /L$/.test(r) && /arm|Arm|hand/.test(r) ? 'armL' : /R$/.test(r) && /arm|Arm|hand/.test(r) ? 'armR' : /^(thigh|shin|foot)L$/.test(r) ? 'legL' : /^(thigh|shin|foot)R$/.test(r) ? 'legR'
  : /^(head|ear)/.test(r) ? 'head' : 'torso';
const SEG_BASE = { armL: 9, armR: 9, upperArmL: 9, upperArmR: 9, forearmL: 9, forearmR: 9, thighL: 6, thighR: 6, shinL: 3, shinR: 3, footL: 0, footR: 0, chest: 9, pelvis: 10 };
export const segY = (region, y) => y - (SEG_BASE[region] ?? 0);
export const vkey = (x, y, z) => ((x + 256) << 18) | ((y + 256) << 9) | (z + 256);

// ── the LOBE ANCHOR (2026-10-01): the exact earlobe voxel on each side, the one voxel every lobe-hung ear item enters. chars.js base()
// draws each ear x −10..−9 / 8..9, y 23..27, z −1..1; the lobe is the bottom row's outer middle voxel. A lobe-hung piece (a hoop, a
// dangle, a tag, a lock) passes its top into this voxel (touching it, from below or on its outer face) and hangs straight down from it
// inside the ear's own columns, its ring facing sideways like the ear; a stud sits flush on its outer face (`out` is that face's
// normal along x). R = the character's right ear (−x), L = its left (+x, the mirror x → −1 − x). The ears category reads it through
// world/fresh/kit.js; the audit's lobe check (style/city/studio/audit/lib.mjs) measures against it. Nothing here has an import, so
// any file (kit.js included) can read it without a cycle.
export const LOBE = Object.freeze({ R: Object.freeze([-10, 23, 0]), L: Object.freeze([9, 23, 0]), out: Object.freeze({ R: -1, L: 1 }),
  cols: Object.freeze({ R: Object.freeze([-10, -9]), L: Object.freeze([8, 9]) }) });   // (cols: the ear's own x columns a piece hangs in)

// ── the MOUTH ZONE (2026-10-01): the one box a mouth entry (world/fresh/mouths.js: draw(H, ctx) / fine(P, ctx)) may change, read off
// the head chars.js base() draws (x −8..7, y 19..33, z −7..7, the face plane z 7). The lower face: under the nose row (y 22, the nose
// at x −1..0, z 8) down to the chin (the head's bottom row, y 19), and as wide as a mouth can plausibly open on this head: from the
// left eye's second column to the right eye's (x −6..5, inside the eyes' outer corners at −7 / 6, leaving two cheek columns each
// side). Depth: one voxel proud of the face plane (z 8) and one voxel deep (z 6: the face plane may be opened there). In half units
// (fine voxels) that is hx −12..11, hy 38..43, hz 12..17. The audit (style/city/studio/audit/lib.mjs mouthZone) fails any change
// outside it. Nothing here has an import, so world/fresh/kit.js re-exports it for the mouth designer.
export const MOUTH = Object.freeze({ x: Object.freeze([-6, 5]), y: Object.freeze([19, 21]), z: Object.freeze([6, 8]), face: 7,
  has: (x, y, z) => x >= -6 && x <= 5 && y >= 19 && y <= 21 && z >= 6 && z <= 8,
  hasHalf: (hx, hy, hz) => hx >= -12 && hx <= 11 && hy >= 38 && hy <= 43 && hz >= 12 && hz <= 17 });

// ── per-top fit: the shell's side reach (flank columns past the torso) and the neckline (contract NECKLINES)
export const TOPFIT = {};   // top id → { flank, neckline }: filled from the fresh registry by chars.js (registerTopFit)
export function registerTopFit(id, { flank = 1, neckline = 'crew' } = {}) { TOPFIT[id] = { flank, neckline }; }
export const fitOf = L => { const id = L?.top?.id, t = TOPFIT[id] || {}; return { top: id, flank: t.flank ?? 1, neckline: t.neckline ?? 'crew', seg: null, force: new Map() }; };

// ── routing
const side = (x, a, b) => x < 0 ? a : b;
// the chars.js rig group ('torso' | 'armL' | 'armR' | 'legL' | 'legR') a body-grid voxel rides
export function bodyPart(t, x, y, z, fit) {
  const f = fit?.force?.get(vkey(x, y, z)); if (f !== undefined) return REGION_GROUP(f);
  if (t === 'armL' || t === 'armR' || t === 'legL' || t === 'legR' || t === 'torso') return t;
  if (t === 'hands' || t === 'held') return side(x, 'armL', 'armR');
  if (t === 'shoes') return side(x, 'legL', 'legR');
  if (t === 'bottom') return y >= 10 ? 'torso' : side(x, 'legL', 'legR');
  if (t === 'top') {   // the shell (flanks included) rides the chest; only what lies outside it is a sleeve
    if (y < 9) return side(x, 'legL', 'legR');
    const fl = fit?.flank ?? 1; if ((x < -5 - fl || x > 4 + fl) && y < 19) return side(x, 'armL', 'armR');
    if (y === 9 && (x <= -6 || x >= 5) && z >= -2 && z <= 1) return side(x, 'armL', 'armR');   // (a hem cell in the hand's box: the hand owns it; fit/held.js draws the hand over it)
    return 'torso'; }
  const armZone = (x <= -6 || x >= 5) && y >= 4;   // the bare body (and items drawn with their own tag): the skin's own arm columns
  if (t === 'base' && y < 10 && !armZone) return side(x, 'legL', 'legR');
  if (armZone && y < 18) return side(x, 'armL', 'armR');
  return 'torso';
}
// the walk v2 part within a rig group, by the voxel's centre (anim/bake.js's rule: hip y 10 · knee y 6 · ankle y 2.5; the arm is one piece)
export function partOf(group, vx, vy, vz) { const L = group.endsWith('L');
  if (group.startsWith('leg')) { if (vy < 3 || (vy < 6 && (vz >= 3 || vz <= -2))) return L ? 8 : 9; if (vy < 6) return L ? 6 : 7; return L ? 1 : 2; }
  if (group.startsWith('arm')) return L ? 3 : 4;
  return group === 'head' ? 5 : 0; }
// the walk v2 part of a body-grid voxel (tag = the slot that drew it)
export function segOf(t, x, y, z, fit) {
  const f = fit?.force?.get(vkey(x, y, z)); if (f !== undefined) return REGION_PART[f];
  const g = bodyPart(t, x, y, z, fit);
  return g === 'torso' ? (t === 'bottom' && y < 13 ? 12 : 0) : partOf(g, x + .5, y + .5, z + .5); }
const PART_REGION = ['chest', 'thighL', 'thighR', 'armL', 'armR', 'head', 'shinL', 'shinR', 'footL', 'footR', 'armL', 'armR', 'pelvis'];
export function regionOf(t, x, y, z, fit) { const p = segOf(t, x, y, z, fit), r = PART_REGION[p];
  if (r === 'chest') { if (t === 'top' && (x < -5 || x > 4)) return x < 0 ? 'flankL' : 'flankR'; if (t === 'base' && y >= 17 && x >= -1 && x <= 0) return 'neck'; }
  if (t === 'hands' && (p === 3 || p === 4)) return x < 0 ? 'handL' : 'handR';
  return r; }

// ── joint slabs: [child, parents, directions child → parent, depth, rows?]
// (lower body, world/fit/lower.js: the thigh never copies a top's hem, the belt or what lies on the chest (the hem → thigh slab
// swung shirt-coloured blocks out under the hem). The old lower slab entries below are retained for legacy diagnostics;
// bakeSegFull and the connected-leg audit skip them. Connected knees and foot-following cuffs need no slabs.
const LEG_SKIP = ['bottom', 'acc', 'held', 'hands'], THIGH_SKIP = ['top', 'neck', 'torso', ...LEG_SKIP];   // ('base': the bare torso's skin; on a body with no top the thigh's slab swung skin-coloured blocks out of the hips)
export const SLABS = [[1, [0, 12], [[0, 1, 0]], 2, null, THIGH_SKIP], [2, [0, 12], [[0, 1, 0]], 2, null, THIGH_SKIP], [6, [1], [[0, 1, 0]], 2, null, LEG_SKIP], [7, [2], [[0, 1, 0]], 2, null, LEG_SKIP],
  [8, [6], [[0, 1, 0], [0, 0, 1], [0, 0, -1]], 2, null, LEG_SKIP], [9, [7], [[0, 1, 0], [0, 0, 1], [0, 0, -1]], 2, null, LEG_SKIP],   // (no elbow slab: simple arms)
  // the head's collar slab: the chest's voxels under the chin, never a necklace (its ring lies under the chin; copied, it swung with a nod)
  [5, [0], [[0, -1, 0]], 1, null, ['neck']],
  // chest → upper arm (the shoulder): off the top of the arm only (rows 17…18: the cap), inwards, so a raised arm carries the shoulder's
  // corner with it and no notch opens on top; lower down the arm slides past the shirt's side, which stays on the chest
  [3, [0], [[1, 0, 0]], 1, [17, 18]], [4, [0], [[-1, 0, 0]], 1, [17, 18]]];
export const slabRows = (e, y) => !e[4] || (y >= e[4][0] && y <= e[4][1]);
export const slabSkips = (e, tag) => !!e[5] && e[5].includes(tag);   // a parent voxel drawn by one of these slots is never copied

// ── authoring: per-segment pieces and caps (inside a TOPS / BOTTOMS draw; B is compose's body grid, B.fit its fit)
export function onSeg(B, region, fn) { const f = B.fit; if (!f) return fn(); const was = f.seg; f.seg = region; try { return fn(); } finally { f.seg = was; } }
// one sleeve piece (a whole sleeve: the arm is one segment). box for the LEFT arm (x ≤ −6), inclusive; the right arm is mirrored (x → −1 − x).
// paint(lx, ly, z, x, y): lx counted outwards from the box's inner column, ly = segY.
export function sleeve(B, s, region, { x0, x1, y0, y1, z0, z1 }, paint, l) {
  onSeg(B, region, () => { for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) {
    const X = s === 'L' ? x : -1 - x, c = typeof paint === 'function' ? paint(x1 - x, segY(region, y), z, X, y) : paint; if (c !== undefined && c !== null) B.set(X, y, z, c, l); } }); }
// shoulder cap: on the arm, rows y 17…18, from the sleeve's outer column in to one column over the chest's side (ly: 8, 9)
export function shoulderCap(B, s, paint, { outer = -8, inner = -6, z0 = -2, z1 = 1, rows = [17, 18], l } = {}) {
  sleeve(B, s, 'arm' + s, { x0: outer, x1: inner, y0: rows[0], y1: rows[1], z0, z1 }, paint, l); }
// knee cap: a ring one voxel proud round the pant leg at y 6, on the thigh
export function kneeCap(B, s, paint, { x0 = -6, x1 = -1, z0 = -2, z1 = 2, y = 6, l } = {}) {
  onSeg(B, 'thigh' + s, () => { const put = (x, z) => { const X = s === 'L' ? x : -1 - x, c = typeof paint === 'function' ? paint(x, y, z) : paint; if (c != null) B.set(X, y, z, c, l); };
    for (let z = z0 - 1; z <= z1 + 1; z++) put(x0 - 1, z); for (let x = x0; x <= x1; x++) { put(x, z0 - 1); put(x, z1 + 1); } }); }

// ── necklines: neckRing / chestFront over the look's body + bottom + top (drawn by chars.js's installFit drawer)
let DRAW = null; const CACHE = new Map();
export function installFit(o) { DRAW = o.draw; CACHE.clear(); }
function torsoOf(L) { if (!DRAW || !L) return null; const key = JSON.stringify([L.top, L.bottom]); let T = CACHE.get(key); if (T) return T;
  const { B, tag, fit } = DRAW(L), chest = new Map();   // (x, y) → front z of the chest's voxels
  const occ = new Set();
  for (const M of B.L) for (const k of M.keys()) { const x = (k >> 18) - 256, y = ((k >> 9) & 511) - 256, z = (k & 511) - 256, t = tag.get(k) || 'base';
    if (bodyPart(t, x, y, z, fit) !== 'torso') continue; occ.add(vkey(x, y, z)); const c = x * 1000 + y, f = chest.get(c); if (f === undefined || z > f) chest.set(c, z); }
  T = { chest, occ, neckline: fit.neckline }; if (CACHE.size > 400) CACHE.clear(); CACHE.set(key, T); return T; }
export function chestFront(L, x, y) { const T = torsoOf(L); if (!T) return null; const z = T.chest.get(x * 1000 + y); return z === undefined ? null : z; }
export const necklineOf = L => (TOPFIT[L?.top?.id]?.neckline) ?? 'bare';
export function neckRing(L) {
  const T = torsoOf(L); if (!T) return []; const Y = 18, has = (x, y, z) => T.occ.has(vkey(x, y, z)), nl = T.neckline;
  // the solid at the ring's height round the neck (the neck itself, or a collar / hood / a shell that buries it)
  let x0 = 9, x1 = -9, z0 = 9, z1 = -9; for (let x = -8; x <= 7; x++) for (let z = -7; z <= 7; z++) if (has(x, Y, z)) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  if (x0 > x1) { x0 = -1; x1 = 0; z0 = -1; z1 = 0; }
  const out = [], push = (x, y, z) => out.push({ x, y, z });
  const open = x0 - 1 >= -5 && x1 + 1 <= 4 && nl !== 'hood';   // the ring fits on the shoulders round it (rests on the chest's top row)
  if (open) {
    const zb = -1, zf = z1 + 1, low = nl === 'vee' || nl === 'bare';   // open necklines: the front arc drops onto the chest's top edge
    for (let z = zb; z < zf; z++) push(x0 - 1, Y, z);
    for (let x = x0 - 1; x <= x1 + 1; x++) { const centre = x >= x0 && x <= x1, f = chestFront(L, x, Y - 1);
      if (low && centre && f !== null && f + 1 > zf && !has(x, Y - 1, f + 1)) { if (x === x0) push(x, Y, zf); push(x, Y - 1, f + 1); if (x === x1) push(x, Y, zf); } else push(x, Y, zf); }
    for (let z = zf - 1; z >= zb; z--) push(x1 + 1, Y, z);
  } else {   // closed: the front arc on the collar's front face, x −3…2 (the ends tuck into the collar)
    for (let x = -3; x <= 2; x++) { let zf = null; for (let z = 7; z >= -7; z--) if (has(x, Y, z)) { zf = z; break; }
      if (zf === null) { const f = chestFront(L, x, Y - 1); if (f === null) continue; push(x, Y, f); } else push(x, Y, zf + 1); } }
  return out;
}
