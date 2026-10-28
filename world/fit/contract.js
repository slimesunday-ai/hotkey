// CHARACTER FITTING CONTRACT (2026-09-30): the shared rules the body agent (world/fit/body.js) and the layers agent
// (world/fit/layers.js) both build on. Names and function shapes are fixed; values (budgets, lists) may be tuned with a note.
// Source of the rules: the character audit (style/city/studio/audit/, run.mjs --gate) and slime's review in the trait studio.
//
// Coordinates are chars.js character voxels (S = 1/20 m): +x the character's left, +y up, +z forward (the face looks +z).
// The bare body (chars.js base()): torso x −5..4, y 10..17, z −2..2 · arms x −8..−6 and 5..7, y 10..16 · neck x −1..0, y 17..18 ·
// head x −8..7, y 19..33, z −7..7 · ears x −10..−9 and 8..9, y 23..27 · legs below y 10.

// ── 1. REGIONS: every voxel of every garment rides the body segment of the region it belongs to (the walk v2 segments:
// anim/bake.js). The body agent owns the routing (region → segment) and the joint caps; a voxel's region is decided by the
// body geometry it covers, never by an x threshold (the audit's root cause: chars.js armZone sent every top's flanks x −6 / 5
// to the arm). Region names:
export const REGIONS = ['head', 'earL', 'earR', 'neck', 'chest', 'flankL', 'flankR', 'armL', 'armR',
  'handL', 'handR', 'pelvis', 'thighL', 'thighR', 'shinL', 'shinR', 'footL', 'footR'];
// flanks ride the chest segment. SIMPLE ARMS (2026-09-30, slime: "we go back to simple arms"): the arm is ONE rigid segment, shoulder
// to hand, that swings from the shoulder (the classic toon arm); there is no elbow. A sleeve is one piece per arm (region armL / armR:
// the full length for long sleeves, the top for short ones) and may be as big as the design wants; the shoulder cap (arm, y 17..18,
// overlapping the chest by 1) stays, and a big sleeve may simply overlap the shoulder. ('upperArm*' / 'forearm*' were the two arm
// segments before; body.js still reads them as the arm.) The legs keep the knee: thigh, shin, foot.

// ── 2. LAYERS: the draw and occlusion order (a later layer wins a shared voxel; a hidden layer draws nothing there)
export const LAYERS = ['skin', 'marks', 'bottom', 'top', 'neck', 'outerwear', 'hair', 'hat', 'eyewear', 'ears', 'acc', 'held'];
// Head-grid voxels carry their slot (the layers agent tags them), so clipping can be by layer.
// A hat exports a COVER volume (its crown, its brim footprint and the space above the brim, as a predicate cover(x, y, z)):
// hair inside it is deleted, then hair not 6-connected to the scalp is dropped (no orphaned locs).
// These cover the ears: ears (and ear jewellery) hide, or move to a hat-side socket where the item has one.
export const EARS_COVERED = ['balaclava', 'skully', 'durag', 'silkrag', 'beanie', 'fuzzbucket', 'long'];   // hat ids + the long hair id

// ── 3. NECKLINES: every top declares one (the body agent adds it to each top's entry: `neckline: '<type>'`)
export const NECKLINES = ['crew', 'vee', 'hood', 'collar', 'high', 'bare'];   // bare = a tank or no top
// The body agent implements and exports from world/fit/body.js (the layers agent consumes them for necklaces):
//   neckRing(look) → [{ x, y, z }, …]   the ordered path round the neck at the top of this look's neckline, where a chain
//                                        rests (front arc lowest, wrapping to the back at z −1), given the look's top
//   chestFront(look, x, y) → z | null   the front surface z of the outermost torso layer at (x, y) once the top is drawn:
//                                        a pendant lies on it (+1), never floats off it
// Necklaces (the layers agent) are a ring along neckRing plus a drop lying on chestFront: no onFront stacking.

// ── 4. DEPTH BUDGETS (voxels proud of the surface under them), enforced by style/city/studio/audit/run.mjs --gate
export { BUDGET } from '../../style/city/studio/audit/lib.mjs';
// the rules behind the numbers: prints, logos and letters recolour the shell (0) · collar or hood edge 1 · puffer structure 2 ·
// other structure 1 · chain 1 · pendant 1 · ear jewellery 1 · eyewear 1 · mouth jewels 0 · accessory 2.
// (slime: "t-shirt designs should be mostly flat, the puffers need structure, but the box-logo hoodie and varsity letters
// don't feel like they should be extruded".)

// ── 5. OWNERSHIP
//   body agent:   world/fit/body.js · the region routing + SLABS in style/city/anim/bake.js · `neckline` on top entries ·
//                 proof refits: top/puffer, top/jersey, top/tee
//   layers agent: world/fit/layers.js · head-grid slot tags · hat COVER volumes, the hair clip and scalp connectivity ·
//                 EARS_COVERED · the necklace renderer on neckRing / chestFront · proof: hat/bucket + hair/braids,
//                 hat/balaclava + ears/hoops, neck/icecuban on top/hoodie
//   both: the smallest wiring in world/chars.js (re-read it before every edit; the other agent edits it too)
