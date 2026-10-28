// HELD + GRIP (2026-09-29) · the arm pose per held item, for walk v2 (walk2.js) and the idles (idle.js).
// The hold (world/held2.js HOLD: phone · side · hook · carry · display · drink) rides in the baked body itself: bake.js writes each
// vertex's part as part + hold / 64 (aPart stays a whole part number to anything that rounds it: the overlap check, the pixel gate),
// so the city needs no new attribute, texture row or per-walker state. walk2.js decodes it and, after the walk and the idle have
// posed the arms, gripPose() takes over the holding arm (both arms for a two-handed carry):
//   its shoulder pitch, roll, yaw and twist become the hold's (one-piece arm since simple arms, 2026-09-30), plus the walk's own swing scaled by the hold's share
//   (a bag swings less and later, a phone or a shown-off piece barely, a box not at all); the free arm walks and idles as before.
// Idles: gripIdle() swaps an idle the busy hand can't do (a box carrier doesn't cross his arms; nobody checks an empty hand for a
// phone); a phone holder's "check phone" is the idle's own raised arm, with the actual phone in it (idle.js's pose is the phone hold).
import { HOLD, HOLDS } from '../../../world/held2.js';
export const GRIP = Object.fromEntries(HOLDS.map(k => [k, HOLD[k].id]));
export const GRIP_DIV = 64;
const f = v => (+v).toFixed(4), v4 = a => `vec4(${a.map(f).join(', ')})`, HS = HOLDS.map(k => HOLD[k]);
// GLSL: after walk2.js's Pose and idle.js's IDLE_GLSL (which declares aGrip, so walk v1 compiles it too)
export const GRIP_GLSL = /* glsl */`
const vec4 G_POSE[${HS.length}] = vec4[${HS.length}](${HS.map(h => v4(h.pose || [0, 0, 0, 0])).join(', ')});
const vec4 G_WALK[${HS.length}] = vec4[${HS.length}](${HS.map(h => v4([h.swing ?? 1, 0, h.armOut ?? 1, h.both ?? 0])).join(', ')});
const float G_LAG[${HS.length}] = float[${HS.length}](${HS.map(h => f(h.lag ?? 0)).join(', ')});   // extra swing lag (share of the cycle): a heavy bag swings late
int gripIdle(int g, int v) {   // the idle a busy hand can still do
  if (g <= 0 || v < 0) return v;
  if (g == ${GRIP.phone}) return (v == 3 || v == 4 || v == 5 || v == 7) ? 2 : v;       // pockets, arms crossed, stretch, akimbo → check the phone
  if (g == ${GRIP.carry}) return v == 2 || v == 7 ? 1 : (v == 3 || v == 4) ? 0 : v == 5 ? 6 : v;   // both hands full: shift, look, nod
  return v == 2 ? 1 : v;                                                                  // one hand full, no phone: look around instead
}
// u, lag, amp: the walk's cycle, the arms' lag and swing amplitude (walk2.js: the right arm's swing is cos(2π(u − lag)) · amp);
// ao: its outward tilt (·w). The hold: [pitch, roll, yaw in, twist in] of the one-piece arm (held2.js HOLD)
void gripPose(inout Pose P, int g, float u, float lag, float amp, float ao, int iv, float iw) {
  if (g <= 0) return;
  vec4 h = G_POSE[g], k = G_WALK[g]; float sw = cos(6.2831853 * (u - lag - G_LAG[g])) * amp;
  float keep = (g == ${GRIP.phone} && iv == 2) ? iw : 0.;   // the check-phone idle raises the phone arm itself (idle.js)
  vec4 R = vec4(h.x + sw * k.x, h.y + ao * k.z, h.z, h.w);
  P.armP.y = mix(R.x, P.armP.y, keep); P.armR.y = mix(R.y, P.armR.y, keep); P.ayaw.y = mix(R.z, P.ayaw.y, keep); P.atw.y = mix(R.w, P.atw.y, keep);
  if (k.w > .5) { P.armP.x = h.x - sw * k.x; P.armR.x = h.y; P.ayaw.x = h.z; P.atw.x = h.w; }   // both hands: the left arm mirrors it exactly
}`;
// a look's hold (for anything that bakes or poses a body outside the shader)
export { holdOf, holdId } from '../../../world/held2.js';
