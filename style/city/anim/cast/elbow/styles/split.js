// ELBOW STYLE · old split (REFERENCE ONLY: what slime dropped on 2026-09-30). Two rigid segments hinged at the arm's centre line: every
// face below the elbow ring turns with the forearm, every face above stays, so the sleeve is sliced at the joint and opens up as it
// bends. Kept in the harness as the "before" column, not as a candidate.
import { tagBands } from '../bands.js';   // (not ../styles.js: that imports this file, an import cycle)
export default {
  id: 'split',
  label: 'old split (reference)',
  note: 'two rigid segments, hinged at the arm centre, nothing joins them: the sleeve is cut at the elbow and gapes (the rejected look)',
  glsl: /* glsl */`
vec4 bendArm(vec3 p, vec3 n, float e, int band) {
  float a = p.y - EB_Y; bool below = a < -1e-5 || (abs(a) < 1e-5 && (band == 2 || band == 4 || (band == 0 && n.y > .5)));
  if (!below) return vec4(p, 0.);
  float c = cos(e), s = sin(e), z = p.z - EB_ZC; return vec4(p.x, EB_Y + a * c + z * s, EB_ZC - a * s + z * c, -e);
}`,
  bake: full => tagBands(full),   // (no armInner: the old arm's routing, as it was)
};
