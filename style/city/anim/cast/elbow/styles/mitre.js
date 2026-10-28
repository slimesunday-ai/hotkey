// ELBOW STYLE · ring mitre (the leg's knee technique, concentrated on one shared ring). The sleeve stays ONE continuous surface: the
// arm's vertex rings are never cut. Above the elbow ring every ring rides the upper arm, below it every ring rides the forearm (both
// rigid, so every voxel, stripe and cuff keeps its exact shape); the ONE shared ring at the elbow (y 13) is laid on the bend's
// bisector, so the two straight blocks meet on a clean diagonal seam, the way a mitred tube or a bent cardboard sleeve does.
//   · the hinge line is the bare arm's FRONT face (z +1): the skin arm folds into a clean square L with no crush at all
//   · the inside of the bend (cloth in front of the hinge: a sleeve's 1-2 voxels of padding) is SLIMMED in depth, ring by ring: padding
//     that would cross the bisector is pressed back toward the hinge line onto it (no ring ever slides along the arm), so the crook is a
//     crisp V crease, a puffer's cuff stays at its wrist, and the two halves can never fold into each other
//   · the outside: the ring's outer half turns by HALF the bend about the hinge (the knee's "each ring turns by its share", here one
//     ring, one share): the elbow's back is a two-facet chamfer hugging the hinge, never a spike (an exact mitre puts a 130° puffer's
//     corner 9 voxels out, and a plain 45° bevel still hung a 4-voxel flap under a puffer)
//   · every face stays planar and gets its own flat normal (tagBands): no smooth shading across the joint, nothing rubbery
import { tagBands } from '../bands.js';   // (not ../styles.js: that imports this file, an import cycle)
export default {
  id: 'mitre',
  label: 'ring mitre',
  note: 'one continuous sleeve; one shared ring at the elbow turned by half the bend; inside slimmed onto the bisector (a V crease); outside a two-facet chamfer; flat faces',
  glsl: /* glsl */`
vec2 mtFlex(vec2 q, float e) { float c = cos(e), s = sin(e); return vec2(q.x * c + q.y * s, -q.x * s + q.y * c); }   // (y, z) about the hinge: −y comes toward +z
// rest (a: height above the elbow ring, s: depth in front of the hinge line) → bent (y, z), relative to the hinge
vec2 mtMap(float a, float s, float e) {
  float T = max(tan(.5 * e), 1e-6), k = .025 / T;   // (k: the shared ring's inside climbs the bisector half a row at most)
  if (abs(a) < 1e-5) return s > 0. ? vec2(min(s, k) * T, min(s, k)) : mtFlex(vec2(0., s), .5 * e);   // the shared ring: inside on the bisector, outside turned by half
  if (a > 0.) return vec2(a, s > 0. ? min(s, a / T) : s);                 // the upper arm: rigid rings; padding past the bisector slimmed toward the hinge line
  return mtFlex(vec2(a, s > 0. ? min(s, -a / T) : s), e);                 // the forearm and hand: the same, flexed about the hinge
}
vec4 bendArm(vec3 p, vec3 n, float e, int band) {
  float a = p.y - EB_Y, s = p.z - EB_Z; vec2 q = mtMap(a, s, e); float ang;
  if (abs(n.z) > .5 && band > 0) {   // a face across a band of rows: the angle of its own edge (one flat normal for the whole face)
    float h = band > 2 ? .025 : .05, a0 = band == 1 || band == 3 ? a : a - h; vec2 d = mtMap(a0 + h, s, e) - mtMap(a0, s, e);
    ang = dot(d, d) > 1e-12 ? atan(d.y, d.x) : (a0 > -1e-5 ? 0. : -e); }
  else if (abs(a) < 1e-5) ang = -.5 * e;   // a face lying in the shared ring
  else ang = a > 0. ? 0. : -e;
  return vec4(p.x, EB_Y + q.x, EB_Z + q.y, ang);
}`,
  bakeOpts: { armInner: true },   // (bake.js: the forearm keeps its inner column under a shell's flank)
  bake: full => tagBands(full),
};
