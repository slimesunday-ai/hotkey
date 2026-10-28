// GRIPS · the arm pose of a hold, for walk v2 (walk2.js) and the idles (idle.js). Construction only: world/fit/held.js HOLD names the
// poses by geometry (down · forward · both · raised) and world/fresh/README.md § Held gives the rules.
// The hold rides in the baked body itself: bake.js writes each vertex's part as part + hold / 64 (aPart stays a whole part number to
// anything that rounds it: the overlap check, the pixel gate), so the city needs no new attribute, texture row or per-walker state.
// walk2.js decodes it and, after the walk and the idle have posed the arms, gripPose() takes over the gripping arm (both arms in a
// two-hand pose): its shoulder pitch, roll, yaw and twist become the hold's, plus the walk's own swing scaled by the hold's share and
// delayed by its lag; the free arm walks and idles as before.
// Idles: gripIdle() swaps an idle the busy hand can't do. One hand busy: the idle that raises that hand to the face (2) becomes look
// around, except in `raised`, where the hand is already up and the head bows to it (and the stretch, whose neck roll would meet the
// raised hand, becomes nod). Both hands busy: every idle that moves the arms
// (2 hand to face, 3 pockets, 4 behind the back, 5 stretch, 7 hips) becomes weight shift, look around or nod.
import { HOLD, HOLDS } from '../../../../world/cast/fit/held.js';
export const GRIP = Object.fromEntries(HOLDS.map(k => [k, HOLD[k].id]));
export const GRIP_DIV = 64;
const f = v => (+v).toFixed(4), v4 = a => `vec4(${a.map(f).join(', ')})`, HS = HOLDS.map(k => HOLD[k]);
// GLSL: after walk2.js's Pose and idle.js's IDLE_GLSL (which declares aGrip, so walk v1 compiles it too)
export const GRIP_GLSL = /* glsl */`
const vec4 G_POSE[${HS.length}] = vec4[${HS.length}](${HS.map(h => v4(h.pose || [0, 0, 0, 0])).join(', ')});
const vec4 G_WALK[${HS.length}] = vec4[${HS.length}](${HS.map(h => v4([h.swing ?? 1, 0, h.armOut ?? 1, h.hands === 2 ? 1 : 0])).join(', ')});
const float G_LAG[${HS.length}] = float[${HS.length}](${HS.map(h => f(h.lag ?? 0)).join(', ')});   // extra swing lag (share of the cycle)
const float G_ELB[${HS.length}] = float[${HS.length}](${HS.map(h => f(h.elbow ?? 0)).join(', ')});   // ELBOW: the gripping arm's elbow (rad; fit/held.js HOLD.elbow)
int gripIdle(int g, int v) {   // the idle a busy hand can still do
  if (g <= 0 || v < 0) return v;
  if (G_WALK[g].w > .5) return v == 2 || v == 7 ? 1 : (v == 3 || v == 4) ? 0 : v == 5 ? 6 : v;   // both hands busy: shift, look, nod
  if (g == ${GRIP.raised}) return v == 5 ? 6 : v;                                            // the raised hand: the head bows to it in idle 2; no stretch (its neck roll meets the hand)
  return v == 2 ? 1 : v;                                                                     // one hand busy and low: look around instead
}
// u, lag, amp: the walk's cycle, the arms' lag and swing amplitude (walk2.js: the +x arm's swing is cos(2π(u − lag)) · amp);
// ao: its outward tilt (·w). The hold: [pitch, roll, yaw in, twist in] of the one-piece arm (fit/held.js HOLD)
void gripPose(inout Pose P, int g, float u, float lag, float amp, float ao, int iv, float iw) {
  if (g <= 0) return;
  vec4 h = G_POSE[g], k = G_WALK[g]; float sw = cos(6.2831853 * (u - lag - G_LAG[g])) * amp;
  vec4 R = vec4(h.x + sw * k.x, h.y + ao * k.z, h.z, h.w);
  P.armP.y = R.x; P.armR.y = R.y; P.ayaw.y = R.z; P.atw.y = R.w; P.elb.y = G_ELB[g];   // (ELBOW: the hold sets the elbow, so the walk's swing never bends a gripping arm)
  if (k.w > .5) { P.armP.x = R.x; P.armR.x = R.y; P.ayaw.x = R.z; P.atw.x = R.w; P.elb.x = G_ELB[g]; }   // both hands: the −x arm mirrors it exactly, elbow too (one rigid piece between them)
}`;
// a look's hold (for anything that bakes or poses a body outside the shader)
export { holdOf, holdId } from '../../../../world/cast/fit/held.js';
