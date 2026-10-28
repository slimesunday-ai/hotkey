// ELBOW · the bend-style registry (ELBOW.md § Adding a bend style). A bend style decides how the ONE arm piece (shoulder to hand,
// bake.js part 3 / 4) bends at the elbow: it is a GLSL function the walk shader (walk2.js, anim2Glsl({ elbow })) calls per arm vertex,
// plus an optional bake pass. The rig around it (the keyed angle, the shoulder, the hand, held items, the clips' cArm) is shared.
//
//   { id, label, note, glsl, bake? }
//   glsl  defines  vec4 bendArm(vec3 p, vec3 n, float e, int band)
//         p     the vertex's REST position (body metres, the arm hanging; x < 0 is the L arm, both arms bend the same way: forward)
//         n     its rest normal (a voxel face's: ±x, ±y or ±z)
//         e     the elbow's bend (rad, 0 < e ≤ 2.8; + = the forearm comes forward). e = 0 never calls it (today's arm, bit for bit)
//         band  where this vertex's face lies (tagBands below): 0 a face lying in one ring (±y) or untagged · 1 the face lies ABOVE
//               this vertex · 2 BELOW it · 3 / 4 the same for a half-voxel (fine) face. Lets a style give each face its own flat normal.
//         →     xyz: the bent rest position (still hanging from the shoulder: the shoulder's rotation is applied after, as before)
//               w:   the angle (about x, aRX: +y toward +z) that turns this vertex's normal
//   bakeOpts  (optional) options for bake.js bakeSegFull (e.g. { armInner: true }: the arm keeps its inner column under a shell's flank)
//   bake  (optional) (full) → void: post-process the baked body (bake.js bakeSegFull's output) before it is drawn
//
// The rig's numbers every style shares (GLSL: EB_Y, EB_Z, EB_ZC; chars.js voxels × 0.05 m):
//   the elbow ring  y 13 (0.65 m): the upper arm is y 13…16.5 (shoulder), the forearm y 9.5…13, the hand y 6…9.5
//   the arm's front face  z +1 (0.05 m) · its centre z 0
import split from './styles/split.js';
import mitre from './styles/mitre.js';
import thick from './styles/thick.js';   // (the mitre refined for two-proud sleeves, 2026-10-08)
export const ELBOW_RIG = { y: .65, zFront: .05, zMid: 0, cuff: .475 };
const PRE = `const float EB_Y = ${ELBOW_RIG.y.toFixed(4)}, EB_Z = ${ELBOW_RIG.zFront.toFixed(4)}, EB_ZC = ${ELBOW_RIG.zMid.toFixed(4)}, EB_CUFF = ${(ELBOW_RIG.cuff - 1e-4).toFixed(4)};\n`;   // (EB_CUFF: below it the hand rides the forearm rigidly, walk2.js)
const LIST = [mitre, split, thick];   // ADD A STYLE: one file in styles/, one import above, one entry here (ELBOW.md)
export const STYLES = Object.fromEntries(LIST.map(s => {
  if (!/^[a-z][a-z0-9_]*$/.test(s.id)) throw new Error('elbow style id ' + s.id);
  if (!/vec4\s+bendArm\s*\(/.test(s.glsl)) throw new Error(`elbow style ${s.id}: glsl must define vec4 bendArm(vec3 p, vec3 n, float e, int band)`);
  return [s.id, { ...s, glsl: PRE + s.glsl }];
}));
export const STYLE_IDS = LIST.map(s => s.id);
export const styleOf = id => { const s = STYLES[id]; if (!s) throw new Error(`no elbow style ${id} (have: ${STYLE_IDS.join(', ')})`); return s; };
// THE CAST'S ELBOW (the migration, 2026-10-08, ELBOW.md § The cast): slime approved the mitre with the thick-jacket refinement, so
// 'thick' is compiled into every walker by default: walk2.js anim2Glsl() / installAnim2() and bake.js bakeSegFull() use it unless
// told { elbow: null } (today's straight arm: the elbow lab's 'none' column). Thin arms run the mitre verbatim; two-proud sleeves
// get the refinement. At elbow 0 (the walk's default, every hold, every 4-angle clip) the bend is skipped: the arm is one piece.
export const ELBOW_DEFAULT = 'thick';
// aPart's elbow flags, below the band tag (aPart = part + hold / 64 + band / 1024 + flags / 8192): + 1 a THICK sleeve (styles/thick.js),
// + 2 a HELD thing's vertex (bake.js: it rides the forearm rigidly, walk2.js, whatever the style does to the sleeve). GLSL: elbowFlags().
export const ELBOW_HELD = 2 / 8192;
export const ELBOW = STYLES[ELBOW_DEFAULT];

// THE BAND TAGS: bands.js (a module of its own, so the styles import it without an import cycle: the city's worker bundler refuses
// cycles, and styles.js imports the styles). Re-exported here for anything that imported it from styles.js.
export { tagBands } from './bands.js';
