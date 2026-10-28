// CLIP REGISTRY (2026-10-07) · authored animation clips on the walker: robberies, falls, arrests, skating, riding, work… (MOVEMENT.md §7).
// One file per small GROUP of clips (below), so agents working on different groups never touch the same file; this index is the only
// shared code, and it reads every group file statically. Adding a clip = adding an entry to your group's array (CLIPS.md).
//
// HOW A CLIP REACHES THE SHADER (no new texture row, no new attribute): a clip rides in the walker's IDLE slot. The gait state's
// g.idle = CLIP_BASE + the clip's id, g.iw = the clip's weight, g.it = the clip's clock (s). walk2.js reads the slot as before:
// idle.js idlePose ignores ids ≥ CLIP_BASE, and clipPose() (here) poses the body on top of the walk and the hold (grip.js), blended by
// the weight. A clip may also move the WHOLE body (cRot / cPiv / cMov: a lunge, a fall, a lie) and scale the walk's legs (cLegK: a run).
// The CPU half (playClip / stepClip) keeps the clock, the blend in and out, the chain into `next`, and restores the walker's own idle.
//
// The groups (MOVEMENT.md §7; one owner each):
//   events      robbery.js (rob_lunge_grab, hit_stumble_back, run_getaway, hands_up_point, pat_pockets) · falls.js · arrest.js
//   travel      skate.js · ride.js · transit.js
//   activities  deal-hang.js · talk-patrol.js · work.js
//   moods       high.js (the three behaviour families' walks and stands: wired, spaced, guarded; CLIPS.md § Moods and reactions)
//   react       react.js (bystanders: film_phone, rubberneck_walk; CLIPS.md § Moods and reactions)
//   new (2026-10-15, GAME.md §20's staging for the new game): heist.js · breakin.js · grab.js (events) · bench.js · cook.js ·
//               errands.js (activities) · drugs.js (moods)
//   game-port.js (2026-10-27, events + activities): the game's bare-handed clips that fit §20's staging (game-port.md)
import { CLIP_BASE } from '../idle.js';
import { CLIPS as robbery } from './robbery.js';
import { CLIPS as falls } from './falls.js';
import { CLIPS as arrest } from './arrest.js';
import { CLIPS as skate } from './skate.js';
import { CLIPS as ride } from './ride.js';
import { CLIPS as transit } from './transit.js';
import { CLIPS as dealHang } from './deal-hang.js';
import { CLIPS as talkPatrol } from './talk-patrol.js';
import { CLIPS as work } from './work.js';
import { CLIPS as high } from './high.js';
import { CLIPS as react } from './react.js';
import { CLIPS as heist } from './heist.js';
import { CLIPS as breakin } from './breakin.js';
import { CLIPS as bench } from './bench.js';
import { CLIPS as cook } from './cook.js';
import { CLIPS as grab } from './grab.js';
import { CLIPS as drugs } from './drugs.js';
import { CLIPS as errands } from './errands.js';
import { CLIPS as gamePort } from './game-port.js';
export { CLIP_BASE };

export const GROUPS = { robbery, falls, arrest, skate, ride, transit, 'deal-hang': dealHang, 'talk-patrol': talkPatrol, work, high, react, heist, breakin, bench, cook, grab, drugs, errands, 'game-port': gamePort };   // (new groups go LAST: ids are registry order)
export const FAMILY = { robbery: 'events', falls: 'events', arrest: 'events', skate: 'travel', ride: 'travel', transit: 'travel', 'deal-hang': 'activities', 'talk-patrol': 'activities', work: 'activities', high: 'moods', react: 'react', heist: 'events', breakin: 'events', bench: 'activities', cook: 'activities', grab: 'events', drugs: 'moods', errands: 'activities', 'game-port': 'events' };
// the defaults every clip entry gets (CLIPS.md § The entry)
const DEF = { loop: false, hold: false, next: null, blendIn: .1, blendOut: .25, moving: false, speed: 0, stride: 1, shift: null, pair: null, note: '' };
const NAME_RE = /^[a-z][a-z0-9_]*$/;
// ids: registry order (group order above, then the entry's place in its group). They are BUILD-TIME numbers: the shader and the CPU are
// built from the same registry, so never store an id; store the name.
export const CLIPS = [];
for (const [group, list] of Object.entries(GROUPS)) for (const c of list) {
  if (!NAME_RE.test(c.name || '')) throw new Error(`clips/${group}.js: bad clip name ${JSON.stringify(c.name)} (lower_snake_case)`);
  if (CLIPS.some(o => o.name === c.name)) throw new Error(`clips/${group}.js: clip ${c.name} is already registered`);
  if (!(c.dur > 0)) throw new Error(`clips/${group}.js: ${c.name} needs dur > 0 (s)`);
  if (typeof c.glsl !== 'string') throw new Error(`clips/${group}.js: ${c.name} needs its glsl body`);
  CLIPS.push({ ...DEF, ...c, group, family: FAMILY[group], id: CLIPS.length });
}
export const CLIP = Object.fromEntries(CLIPS.map(c => [c.name, c]));
for (const c of CLIPS) { if (c.next && !CLIP[c.next]) throw new Error(`clip ${c.name}: next ${c.next} is not registered`); if (c.pair && !CLIP[c.pair.with]) throw new Error(`clip ${c.name}: pair.with ${c.pair.with} is not registered`); }
export const clipId = name => { const c = CLIP[name]; if (!c) throw new Error('no clip ' + name); return CLIP_BASE + c.id; };   // the value for g.idle
export const clipOf = idle => idle >= CLIP_BASE ? CLIPS[idle - CLIP_BASE] || null : null;

// ── GPU. Helpers every clip body may use (all c-prefixed), the root globals, one function per clip and the dispatcher.
const f = v => (+v).toFixed(4);
// THE END OF A ONE-SHOT is the shader's: the dispatcher's `t >= D` compares the clock as the GPU holds it (a float32: writeGait2 writes
// g.it into the Float32 animation texture) with the float32 literal f(dur). stepClip compares exactly those two numbers, so the CPU and
// the shader agree on every frame. (A float64 sum of 1/60 s steps reaches 1.4999999999999996, which the GPU reads as 1.5: the shader had
// ended turnstile a frame before the CPU moved the walker by its shift, and the body jumped back 0.7 m for that frame. end-check.mjs.)
const END = Float32Array.from(CLIPS, c => +f(c.dur)), ended = (c, t) => Math.fround(t) >= END[c.id];
export const CLIP_HELPERS = /* glsl */`
vec3 cRot = vec3(0.), cPiv = vec3(0.), cMov = vec3(0.); vec2 cLegK = vec2(1.);   // the root (pitch fwd +, yaw, roll) about cPiv, then moved by cMov (m, body frame: +z ahead); the walk's hip and knee scale
float cLook = 0.;   // READ ONLY: the walker's look yaw (rad, body frame, +: to +x; the gait state's g.look, walk2.js A2.y): where a clip that looks at something (rubberneck_walk) turns the head
float cR(float t, float a, float b) { return clamp((t - a) / (b - a), 0., 1.); }                 // linear 0 → 1 over [a, b]
float cS(float t, float a, float b) { return smoothstep(a, b, t); }                                // eased 0 → 1 over [a, b]
float cOut(float t, float a, float b) { float x = cR(t, a, b); return 1. - (1. - x) * (1. - x); } // fast start, soft stop (a snap)
float cIn(float t, float a, float b) { float x = cR(t, a, b); return x * x; }                      // slow start, hard stop (a hit)
float cBack(float t, float a, float b) { float x = cR(t, a, b) - 1.; return 1. + x * x * (2.7 * x + 1.7); }   // overshoots ~10 %, settles
float cBump(float t, float a, float b) { float x = cR(t, a, b); return sin(3.14159265 * x); }      // 0 → 1 → 0 over [a, b]
// arms: [pitch fwd, roll out, yaw in, twist in] (rad; idle.js aArmRot), side 0 = the −x arm (L), 1 = the +x arm (R); k blends toward it
void cArm(inout Pose P, int side, vec4 a, float k) { if (side == 0) { P.armP.x = mix(P.armP.x, a.x, k); P.armR.x = mix(P.armR.x, a.y, k); P.ayaw.x = mix(P.ayaw.x, a.z, k); P.atw.x = mix(P.atw.x, a.w, k); }
  else { P.armP.y = mix(P.armP.y, a.x, k); P.armR.y = mix(P.armR.y, a.y, k); P.ayaw.y = mix(P.ayaw.y, a.z, k); P.atw.y = mix(P.atw.y, a.w, k); } }
void cArms(inout Pose P, vec4 a, float k) { cArm(P, 0, a, k); cArm(P, 1, a, k); }
// ELBOW (elbow/ELBOW.md): the bend of the elbow (rad, 0 straight, + the forearm forward; it comes up in the arm's own plane, so the twist
// a.w turns which way it folds). The 4-angle cArm leaves the elbow alone; the 5-argument form sets it too. Without a bend style compiled
// in, the elbow is ignored (the arm stays one straight piece).
void cElbow(inout Pose P, int side, float e, float k) { if (side == 0) P.elb.x = mix(P.elb.x, e, k); else P.elb.y = mix(P.elb.y, e, k); }
void cArm(inout Pose P, int side, vec4 a, float e, float k) { cArm(P, side, a, k); cElbow(P, side, e, k); }
void cArms(inout Pose P, vec4 a, float e, float k) { cArm(P, 0, a, e, k); cArm(P, 1, a, e, k); }
// a foot (side 0 L, 1 R) planted at body-frame z, or stepping: from z0 to z1 over [a, b] with a lift (m); its ankle target for the IK.
// Feet live in the body frame; a clip that moves the root (cMov.z = m) keeps a planted foot still on the ground with z = its spot − m.
void cFoot(inout Pose P, int side, float z, float lift, float fp) { vec2 an = aAnkle(z, fp) + vec2(0., lift); if (side == 0) { P.ank.xy = an; P.fp.x = fp; } else { P.ank.zw = an; P.fp.y = fp; } }
float cStep(float t, float a, float b, float z0, float z1) { return mix(z0, z1, cS(t, a, b)); }
float cLift(float t, float a, float b, float h) { return h * cBump(t, a, b); }
// the idles' breath (idle.js), for a clip that stands: the chest rises every 3.6 s, k = how much
void cBreathe(inout Pose P, float t, float k) { float br = sin(6.2832 * t / 3.6); P.torso.x += .03 * br * k; P.head.x -= .012 * br * k; P.armR += vec2(.015 * k); P.drop += .005 * (.5 - .5 * br) * k; }
`;
const fnOf = c => `void clip_${c.name}(inout Pose P, float t, float u, float w) {   // ${c.group}: ${c.name} (${c.dur} s${c.loop ? ' loop' : ''})\n  const float D = ${f(c.dur)};\n${c.glsl}\n}`;
export const CLIPS_GLSL = /* glsl */`
${CLIP_HELPERS}
${CLIPS.map(fnOf).join('\n')}
// the dispatcher: v = the idle slot, t = its clock, W = its weight, u / w = the walk's cycle and weight (moving clips walk under it),
// look = the walker's look yaw (cLook)
void clipPose(inout Pose P, int v, float t, float W, float u, float w, float look) {
  cRot = vec3(0.); cPiv = vec3(0.); cMov = vec3(0.); cLegK = vec2(1.); cLook = look;
  int c = v - ${CLIP_BASE}; if (c < 0 || c >= ${Math.max(1, CLIPS.length)} || W < .001) return;
  Pose Q = P;   // (a one-shot with a shift: past its end the walker itself has moved by it, so the root takes it off)
  // a SWITCH, not an else-if chain (from slime's crafter game, its 1585fe4): each else-if nests one level deeper in the shader's
  // syntax tree, and WebGL's compiler (ANGLE: MaxExpressionComplexity 256) refuses a deeper tree with "Expression too complex". The
  // game's chain broke at 126 clips (measured 10-25); this registry is at 116. A switch's cases sit side by side at one depth
  switch (c) {
  ${CLIPS.map(c => `case ${c.id}: clip_${c.name}(Q, ${c.loop ? `mod(max(t, 0.), ${f(c.dur)})` : 'max(t, 0.)'}, u, w);${c.shift && !c.loop ? ` if (t >= ${f(c.dur)}) { cMov.x -= ${f(c.shift[0])}; cMov.z -= ${f(c.shift[1])}; }` : ''} break;`).join('\n  ')}
  }
  P.ank = mix(P.ank, Q.ank, W); P.fp = mix(P.fp, Q.fp, W); P.drop = mix(P.drop, Q.drop, W); P.bodyX = mix(P.bodyX, Q.bodyX, W); P.pRoll = mix(P.pRoll, Q.pRoll, W);
  P.torso = mix(P.torso, Q.torso, W); P.head = mix(P.head, Q.head, W); P.armP = mix(P.armP, Q.armP, W); P.armR = mix(P.armR, Q.armR, W); P.ayaw = mix(P.ayaw, Q.ayaw, W); P.atw = mix(P.atw, Q.atw, W); P.elb = mix(P.elb, Q.elb, W);
  cRot *= W; cMov *= W; cLegK = mix(vec2(1.), cLegK, W);
}
void clipRoot() { if (dot(cRot, cRot) + dot(cMov, cMov) < 1e-10) return;          // the whole body, last (before the turn's roll)
  mat3 M = aRY(cRot.y) * aRX(cRot.x) * aRZ(cRot.z); gR = M * gR; gT = cPiv + M * (gT - cPiv) + cMov; }
`;

// ── CPU. A walker's clip, on its gait state g (gait2.js gait2State): call stepClip AFTER the walk and the idle stepped (stepGait2,
// stepIdle), every frame. It owns g.idle / g.iw / g.it while a clip plays and gives them back after.
//   playClip(g, name, { t, loop })   start (t: the clip clock to start at; two walkers given the same t on the same frame stay in sync)
//   stopClip(g)                      blend out now (a looping clip, or a one-shot early) · clearClip(g): drop it at once, no blend
//   stepClip(g, dt) → the clip's state or null; state.done is true on the frame it finished; state.shiftNow is [x, z] (body frame, m)
//                                    on the frame a one-shot with a `shift` reaches its end: move the walker by it THAT frame (the shader
//                                    takes the same amount off the clip's root from then on, so nothing jumps)
export function playClip(g, name, o = {}) {
  const c = CLIP[name]; if (!c) throw new Error('no clip ' + name);
  const prev = g.clip, own = prev ? prev.own : { idle: g.idle, scale: g.scale ?? 1 };
  g.clip = { name, c, t: o.t ?? 0, w: prev && !prev.out ? prev.w : (o.snap ? 1 : 0), out: false, loop: o.loop ?? c.loop, own, done: false };
  if (c.moving) g.scale = c.stride;
  return g.clip;
}
export function stopClip(g) { if (g.clip) g.clip.out = true; }
export function clearClip(g) { const s = g?.clip; if (!s) return; g.idle = s.own.idle; g.scale = s.own.scale; g.iw = 0; g.clip = null; }   // drop it now, no blend (a walker handed back)
export function stepClip(g, dt) {
  const s = g.clip; if (!s) return null;
  const t0 = s.t; s.t += dt; let c = s.c; const end = !s.loop && ended(c, s.t);   // (the shader's end test: END above)
  s.shiftNow = end && !ended(c, t0) && c.shift ? c.shift : null;   // (the owner moves the walker by it, this frame)
  if (end && !s.out && (c.next || !c.hold)) { if (c.next) { s.t = Math.max(0, s.t - c.dur); s.name = c.next; s.c = c = CLIP[c.next]; s.loop = c.loop; g.scale = c.moving ? c.stride : s.own.scale; } else s.out = true; }
  const target = s.out ? 0 : 1, tau = s.out ? c.blendOut : c.blendIn;
  s.w = tau > 0 ? s.w + (target - s.w) * (1 - Math.exp(-dt * 3 / tau)) : target; if (Math.abs(s.w - target) < .01) s.w = target;
  if (s.out && s.w <= 0) { g.idle = s.own.idle; g.iw = 0; g.scale = s.own.scale; g.clip = null; s.done = true; return s; }
  g.idle = CLIP_BASE + c.id; g.iw = s.w; g.it = s.t; return s;
}
// the body-frame [x, z] (m) a finished clip leaves the body displaced by (its root's end place): the owner moves the walker by it when
// the clip hands over (CLIPS.md § Root motion)
export const clipShift = name => CLIP[name]?.shift || [0, 0];
