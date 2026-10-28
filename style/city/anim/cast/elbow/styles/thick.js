// ELBOW STYLE · the ring mitre, refined for THICK sleeves (slime 2026-10-08: "the bendy elbows are good, just need some refinement on
// the thicker jackets"). Thin arms (bare, tees, hoodies, the varsity: padding ≤ 1 voxel) bend EXACTLY as the mitre (styles/mitre.js: the
// same map, verbatim; their gate numbers are identical). An arm whose sleeve stands two proud around the elbow (the puffy family:
// puffers, bubbles, the parka, fur; README § Tops) is flagged at bake and gets, on top of the mitre:
//   · PADDING THAT COMPRESSES, never collapses. The mitre clamps every padding layer that would cross the bisector ONTO it, so at the
//     shared ring a puffer's two front layers fold into one point and along the crease three corners line up: thousands of zero-area
//     slivers. Here the padding in front of the hinge is scaled as a whole, s → s · min(1, L / SREF) (L: the bisector's depth on that row;
//     SREF 2.4 voxels, a little deeper than the two of padding, so the outer layer lands a hair behind the bisector and the crook stays a
//     crisp V). The inner layers keep their order and a share of their thickness: the quilting compresses into the crook, nothing
//     degenerates. Rows where L ≥ SREF are untouched, so the cuff and the hand stay rigid.
//   · A SOFT BEND CAP: a padded sleeve eases to a stop at about 105° (from 85°, so motion never hits a wall). Past that the forearm's two
//     voxels of padding were in the chest (every hanging 110–150° torso and head crossing). The six test poses bend ≤ 90°: only the 130°
//     grid column, the hanging sweep and future clips see the cap.
// The flag rides in aPart below the band tag: + 1/8192 (the part, grip and band decodes all round it away; bendArm reads it back).
// Tried and dropped: a fat quilt ring on the elbow rows (the hidden-joint trick): on the mink it read as a second cuff, a cast, and it
// added 200–2,300 forearm-on-torso crossings for nothing the compression hadn't already fixed.
import { tagBands } from '../bands.js';   // (not ../styles.js: that imports this file, an import cycle)
import { GRIP_DIV } from '../../grip.js';

const D2R = Math.PI / 180, SREF = .12, C0 = 85 * D2R, CAP = 105 * D2R, FLAG = 1 / 8192;
// which arms are thick: around the elbow (y 0.55…0.75) the sleeve reaches two voxels past the bare arm, in front (z +3) or behind (z −3)
function thickArms(full) { const out = { 3: false, 4: false }, n = full.P.length / 3;
  for (let v = 0; v < n; v++) { const p = Math.floor(full.K[v] + .5); if ((p !== 3 && p !== 4) || out[p]) continue; const y = full.P[v * 3 + 1], z = full.P[v * 3 + 2];
    if (y > .55 && y < .75 && (z > .145 || z < -.145)) out[p] = true; }
  return out; }
function bakeThick(full) {
  const thick = thickArms(full); tagBands(full);
  const K = full.K; for (let v = 0; v < K.length; v++) { const p = Math.floor(K[v] + .5); if ((p === 3 || p === 4) && thick[p]) K[v] += FLAG; }
  full.thick = thick; return full;
}

export default {
  id: 'thick',
  label: 'mitre, thick refined',
  note: 'the ring mitre; a two-proud sleeve (flagged at bake) compresses its padding into the crook instead of collapsing it, and eases to a stop at ~105°; thin arms: the mitre exactly',
  glsl: /* glsl */`
const float TK_SREF = ${SREF.toFixed(4)}, TK_C0 = ${C0.toFixed(4)}, TK_CAP = ${CAP.toFixed(4)};
bool tkThick() { int pt = int(aPart + .5), gp = int((aPart - float(pt)) * ${GRIP_DIV}. + .5); float x = ((aPart - float(pt)) * ${GRIP_DIV}. - float(gp)) * 16.; return (int(floor((x - floor(x + .5)) * 8. + .5)) & 1) == 1; }   // (flag bit 1: thick; bit 2 is a held thing's, styles.js)
vec2 tkFlex(vec2 q, float e) { float c = cos(e), s = sin(e); return vec2(q.x * c + q.y * s, -q.x * s + q.y * c); }   // (y, z) about the hinge: −y comes toward +z
// rest (a: height above the elbow ring, s: depth in front of the hinge line) → bent (y, z), relative to the hinge
vec2 tkMap(float a, float s, float e, bool thick) {
  float T = max(tan(.5 * e), 1e-6), k = .025 / T;
  if (thick && s > 0.) {   // THICK: the padding in front of the hinge compresses as a whole toward the bisector (L: its depth on this row)
    float L = abs(a) < 1e-5 ? k : abs(a) / T; s = min(s * min(1., L / TK_SREF), L);
    if (abs(a) < 1e-5) return vec2(s * T, s);
    return a > 0. ? vec2(a, s) : tkFlex(vec2(a, s), e); }
  // the ring mitre, verbatim (styles/mitre.js)
  if (abs(a) < 1e-5) return s > 0. ? vec2(min(s, k) * T, min(s, k)) : tkFlex(vec2(0., s), .5 * e);
  if (a > 0.) return vec2(a, s > 0. ? min(s, a / T) : s);
  return tkFlex(vec2(a, s > 0. ? min(s, -a / T) : s), e);
}
vec4 bendArm(vec3 p, vec3 n, float e, int band) {
  bool thick = tkThick();
  if (thick && e > TK_C0) e = TK_C0 + (TK_CAP - TK_C0) * (1. - exp(-(e - TK_C0) / (TK_CAP - TK_C0)));   // the soft cap
  float a = p.y - EB_Y, s = p.z - EB_Z; vec2 q = tkMap(a, s, e, thick); float ang;
  if (abs(n.z) > .5 && band > 0) {   // a face across a band of rows: the angle of its own edge (one flat normal for the whole face)
    float h = band > 2 ? .025 : .05, a0 = band == 1 || band == 3 ? a : a - h; vec2 d = tkMap(a0 + h, s, e, thick) - tkMap(a0, s, e, thick);
    ang = dot(d, d) > 1e-12 ? atan(d.y, d.x) : (a0 > -1e-5 ? 0. : -e); }
  else if (abs(a) < 1e-5) ang = -.5 * e;
  else ang = a > 0. ? 0. : -e;
  return vec4(p.x, EB_Y + q.x, EB_Z + q.y, ang);
}`,
  bakeOpts: { armInner: true },   // (bake.js: the forearm keeps its inner column under a shell's flank, as the mitre)
  bake: full => bakeThick(full),
};
