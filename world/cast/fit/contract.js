// CHARACTER FITTING CONTRACT: the shared rules world/fit/body.js (routing) and world/fit/layers.js (stacking) build on, and that
// every fresh trait obeys (world/fresh/README.md is the designer-facing version). Values may be tuned with a note; names are fixed.
//
// Coordinates are chars.js character voxels (S = 1/20 m): +x the character's left, +y up, +z forward (the face looks +z).
// The bare body (chars.js base()): torso x −5..4, y 10..17, z −2..2 · arms x −8..−6 and 5..7, y 10..16 · neck x −1..0, y 17..18 ·
// head x −8..7, y 19..33, z −7..7 · ears x −10..−9 and 8..9, y 23..27 · legs below y 10 (the shoe owns y 0..3).
// THE LOBE ANCHOR: LOBE (world/fit/body.js, re-exported here and in world/fresh/kit.js) is the exact earlobe voxel on each side,
// R [−10, 23, 0] and L [9, 23, 0]: a lobe-hung ear item passes its top into it and hangs straight down inside the ear's columns; a stud
// sits flush on its outer face. The audit fails a lobe-tagged ear item that misses it (README § Ears).
export { LOBE } from './body.js';

// ── 1. REGIONS: every voxel of every garment rides the body segment of the region it belongs to (the walk v2 segments:
// anim/bake.js). A voxel's region is decided by the body geometry it covers, never by a bare x threshold.
export const REGIONS = ['head', 'earL', 'earR', 'neck', 'chest', 'flankL', 'flankR', 'armL', 'armR',
  'handL', 'handR', 'pelvis', 'thighL', 'thighR', 'shinL', 'shinR', 'footL', 'footR'];
// Flanks ride the chest segment. SIMPLE ARMS: the arm is ONE rigid segment, shoulder to hand, that swings from the shoulder (the
// classic toon arm); there is no elbow. A sleeve is one piece per arm (region armL / armR: the full length for a long sleeve, the
// top for a short one) and may be as big as the design wants; the shoulder cap (arm, y 17..18, overlapping the chest by 1) stays,
// and a big sleeve may simply overlap the shoulder. ('upperArm*' / 'forearm*' are read as the arm.) The legs keep the knee: thigh,
// shin, foot; the thigh and shin are one connected surface (anim/walk2.js bends it), the foot is the rigid shoe.

// ── 2. LAYERS: the draw and occlusion order (a later layer wins a shared voxel; a hidden layer draws nothing there)
export const LAYERS = ['skin', 'marks', 'bottom', 'top', 'neck', 'outerwear', 'hair', 'hat', 'eyewear', 'ears', 'acc', 'held'];
// Head-grid voxels carry their slot (layers.js tags them), so clipping is by layer.
// A hat exports a COVER volume (its crown, its brim footprint and the space above the brim): hair inside it is deleted, then hair
// not 6-connected to the scalp is dropped (no orphaned strands). A hat or a hair registry entry with `coversEars: true` hides the
// ears and every ear item (unless the ear item is `overHat` or `socket`); a covering hat that stops above the ear carries its fabric
// down over it (earFlaps). Keys are 'hat/<id>' and 'hair/<id>', filled from the registry by chars.js at load.
export const EARS_COVERED = new Set();
// Hats whose cover is fixed rather than read off their voxels: 'all' (covers every hair voxel, e.g. a full head wrap) or 'none'
// (floats over the head by design and covers nothing). 'hat/<id>' → 'all' | 'none'.
export const HAT_COVER = new Map();

// ── 3. NECKLINES: every top declares one (registry `neckline`, default 'crew')
export const NECKLINES = ['crew', 'vee', 'hood', 'collar', 'high', 'bare'];   // bare = no collar at all
// body.js exports neckRing(look) (the path round the neck at the top of the neckline) and chestFront(look, x, y) (the front
// surface z of the outermost chest voxel once the top is drawn): something lying on the chest uses them, never a bare z.

// ── 4. DEPTH BUDGETS (voxels proud of the surface under them), enforced by style/city/studio/audit/run.mjs --gate
export const BUDGET = { 'mouth piece': 1, print: 0, collar: 1, structure: 1, 'padded structure': 2, chain: 1, pendant: 1, 'ear item': 1, eyewear: 1, accessory: 2, 'face ink': 0, 'hat decal': 0, 'shoe detail': 1 };   // (sync-cast.mjs: copied from style/city/studio/audit/lib.mjs, which is not in the city and would close an import cycle)
// the rules behind the numbers: prints, logos and letters recolour the shell (0) · a collar or hood edge 1 · padded structure 2
// (registry `puffy: true` on a top) · other structure 1 · ear items 1 · eyewear 1 · mouth pieces 1 · face ink 0 · accessory 2 ·
// shoe detail 1. (slime: graphics on a top should be mostly flat; padding needs structure; logos and letters are not extruded.)
// FINE DETAIL (world/fit/fine.js): fine voxels obey the same budgets in half units (one fine voxel is ½ proud); per trait at most
// FINE.faces painted faces and FINE.voxels fine voxels. Fine paint is flat: it never adds relief.

// ── 5. OWNERSHIP: body.js owns routing, caps and slabs; layers.js owns head-grid tags, hat covers, ears and chest-lying pieces;
// chars.js owns compose() and the registry wiring. A designer owns exactly one file in world/fresh/.
