// ANIM LAB · idles: short loops a standing walker blends into, all in the vertex shader (walk.js composes them into the pose).
// Per walker (the animation texture, walk.js ROWS): the variant, the idle weight (blends in when a walker stops, out when it moves),
// its own idle clock (a random start, so nobody is in step) and a look direction (the crossing's signal, relative to the body).
// Variants (IDLE ids):
//   0 weight shift          the hips drift from leg to leg, the free knee softens, the head tilts against it
//   1 look around           the head turns left, holds, turns right, holds; the shoulders follow a little
//   2 hand to face          the whole +x arm comes up forward, the hand under the face, the head drops to it; now and then a glance up
//   3 pockets + foot tap    hands at the pockets, the right toe taps in bursts (heel planted)
//   4 hands behind the back (was arms crossed: a one-piece arm can't fold) both arms back and in, palms turned back, chest out, slow looks
//   5 stretch / neck roll   a slow neck roll, later both arms up and out in a V on tiptoe, then down
//   6 nod to music          the head nods on the beat, the knees bounce, the shoulders sway at half time
//   7 hands on hips         straight arms angled out from the hips (akimbo, without elbows)
// SIMPLE ARMS (2026-09-30): the arm is one piece from the shoulder (no elbow). Its pose is four angles per side (Pose armP · armR · ayaw ·
// atw: pitch forward, roll out, yaw in across the body, twist in about its own length; aArmRot), and every idle keeps each arm clear
// of the chest and the head (the big head is wider than the shoulders: a raised arm stays under the chin or outside the ears).
//   8 waiting at a crossing weight shift + a glance at the light every few seconds (+ now and then an impatient lean)
// Every idle breathes (the chest and shoulders rise, hardening pass: visibly) and keeps the feet planted: the legs are solved by the walk's IK from the pose's
// ankles, so a hip that sways or drops bends the knees instead of sliding the feet.
export const IDLE = { shift: 0, look: 1, face: 2, pockets: 3, crossed: 4, stretch: 5, music: 6, hips: 7, crossing: 8 };
export const IDLE_NAMES = ['weight shift', 'look around', 'hand to face', 'pockets + foot tap', 'arms crossed', 'stretch / neck roll', 'nod to music', 'hands on hips', 'waiting at a crossing'];
export const IDLE_POOL = [0, 1, 2, 3, 4, 5, 6, 7];   // what a walker picks from when it stops (8 is the crossing's own)
export const CLIP_BASE = 32;   // idle ids from here on are CLIPS (anim/clips/: they ride the idle slot; idlePose skips them, clips/index.js clipPose poses them)

// the straight-arm idle poses [pitch fwd, roll out, yaw in, twist in] (rad), each checked clear of the chest and the head
// (face: the arm up forward, the hand under the chin; back: pitch BACK, yaw OUT as written; hips: pitch back)
export const ARMPOSE = { face: [1.5, 0, .3, 0], faceHead: [.06, -.1], back: [.55, -.1, .3, 0], stretch: [.35, 1.6, 0, .6], hips: [.1, .4, 0, .3] };
const v4 = a => `vec4(${[0, 1, 2, 3].map(i => (+(a[i] ?? 0)).toFixed(4)).join(', ')})`;
// GLSL: needs walk.js's Pose, aFootRoll and A_PI (walk.js puts this after them)
export const IDLE_GLSL = /* glsl */`
const vec4 PH = ${v4(ARMPOSE.face)}, BK = ${v4(ARMPOSE.back)}, ST = ${v4(ARMPOSE.stretch)}, HP = ${v4(ARMPOSE.hips)};
const vec2 PHH = vec2(${ARMPOSE.faceHead.map(v => v.toFixed(4)).join(', ')});
int aGrip = 0;   // the look's hold (grip.js; walk2.js sets it per vertex)
float aKeys(float t, float period, vec4 v) {   // four keys round a loop: hold 60 %, ease 40 % to the next
  float x = fract(t / period) * 4.; int i = int(x); float f = smoothstep(.6, 1., fract(x));
  float a = i == 0 ? v.x : i == 1 ? v.y : i == 2 ? v.z : v.w, b = i == 0 ? v.y : i == 1 ? v.z : i == 2 ? v.w : v.x; return mix(a, b, f); }
float aWin(float t, float a, float b, float e) { return smoothstep(a, a + e, t) * (1. - smoothstep(b - e, b, t)); }   // a soft window [a, b]
mat3 aArmRot(Pose P, float sx) { bool l = sx < 0.;   // the arm's rotation about its shoulder (walk v1 and v2)
  return aRY(-sx * (l ? P.ayaw.x : P.ayaw.y)) * aRZ(sx * (l ? P.armR.x : P.armR.y)) * aRX(-(l ? P.armP.x : P.armP.y)) * aRY(-sx * (l ? P.atw.x : P.atw.y)); }
void aShift(inout Pose P, float t, float k) {   // weight shift, k = how much (hardening pass: bigger, and the holds drift: it read as frozen)
  float s = (aKeys(t, 8., vec4(1., .75, -1., -.8)) + .22 * sin(6.2832 * t / 5.3)) * k;
  P.bodyX += .036 * s; P.pRoll += .095 * s; P.torso.z -= .045 * s; P.head.z += .055 * s;
  P.armR += vec2(.03, .03) + vec2(-.01, .01) * s; }
void idlePose(inout Pose P, int v, float t, float W, float look) {
  if (W < .001 || v >= ${CLIP_BASE}) return;   // (a clip: clips/index.js clipPose)
  Pose Q = P;   // work on a copy, blend by W at the end
  // breathing (hardening pass: was 0.012 rad, invisible at street distance: a standing walker looked frozen): the chest rises and
  // settles every 3.6 s, the shoulders with it, the body dips a few mm on the out-breath; the head drifts slowly (a look that never
  // quite becomes one). Calm: nothing faster than the breath, nothing bigger than a hand's width
  float br = sin(6.2832 * t / 3.6);
  Q.torso.x += .03 * br; Q.head.x -= .012 * br; Q.armR += vec2(.015) + vec2(.015) * sin(6.2832 * t / 3.6 + .6); Q.armP += vec2(.03 * br); Q.drop += .005 * (.5 - .5 * br);
  Q.head.y += .07 * sin(6.2832 * t / 7.3 + 1.) + .03 * sin(6.2832 * t / 3.1); Q.head.x += .02 * sin(6.2832 * t / 5.1 + 2.);
  if (v == 0) { aShift(Q, t, 1.); Q.armP += vec2(.04, -.03) * sin(t * .9); }
  else if (v == 1) { aShift(Q, t + 3., .4); float y = aKeys(t, 9., vec4(0., .8, 0., -.75)); Q.head.y += y; Q.head.x -= .09 * abs(y); Q.torso.y += .22 * y; }
  else if (v == 2) { aShift(Q, t, .3); float g = aKeys(t, 7., vec4(1., 1., 1., 0.));   // (the whole arm up forward: the hand under the chin, the head bowed to it)
    Q.armP.y += PH.x + .03 * sin(t * 8.) * g; Q.armR.y += PH.y; Q.ayaw.y += PH.z; Q.atw.y += PH.w; Q.head.x += PHH.x * g; Q.head.y += PHH.y * g; Q.armP.x -= .04; }
  else if (v == 3) { aShift(Q, t, .25); Q.bodyX -= .018; Q.pRoll -= .04;
    Q.armP -= vec2(.1); Q.armR -= vec2(.02); Q.atw += vec2(.5);   // (straight arms, the hands turned in at the hip pockets)
    float burst = aWin(fract(t / 6.) * 6., .8, 4.2, .3), tap = pow(max(0., sin(6.2832 * 2.3 * t)), 2.) * burst;
    aFootRoll(Q, 1, .32 * tap); Q.head.x += .03 * tap; }
  else if (v == 4) { aShift(Q, t, .5); Q.armP -= BK.xx; Q.armR += BK.yy; Q.ayaw -= BK.zz; Q.atw += BK.ww;   // hands behind the back: back and in, palms back
    Q.torso.x -= .035; Q.head.y += .22 * aKeys(t + 2., 11., vec4(0., .8, 0., -.6)); }
  else if (v == 5) { float T = fract(t / 12.) * 12., e1 = aWin(T, .3, 4.6, .8), e2 = aWin(T, 5.6, 10.2, 1.1), w = 6.2832 / 2.2;
    aShift(Q, t, .3 * (1. - e2));
    Q.head.x += (.2 * sin(w * T) + .05) * e1; Q.head.z += .22 * cos(w * T) * e1;
    Q.armP += ST.xx * e2; Q.armR += ST.yy * e2; Q.atw += ST.ww * e2; Q.torso.x -= .1 * e2; Q.head.x -= .16 * e2;   // (a V overhead, out past the ears: straight up, the arms vanish inside the head)
    Q.drop -= .06 * e2; aFootRoll(Q, 0, -.24 * e2); aFootRoll(Q, 1, -.24 * e2); }
  else if (v == 6) { float f = 1.8, b = sin(6.2832 * f * t), h = sin(3.1416 * f * t);
    Q.head.x += .05 + .1 * pow(max(b, 0.), 1.5); Q.drop += .012 * (.5 + .5 * b); Q.torso.z += .045 * h; Q.head.z += .05 * h; Q.bodyX += .01 * h;
    Q.armP += vec2(.1, -.1) * h; Q.armR += vec2(.04); }
  else if (v == 7) { aShift(Q, t, .6); Q.armR += HP.yy; Q.armP -= HP.xx; Q.atw += HP.ww; Q.head.z += .06 * sin(t * .7); }   // (straight arms angled out, the palms turned back to the hips)
  else { aShift(Q, t, .6); float g = aKeys(t, 5.5, vec4(0., 1., 1., 0.)), lk = clamp(look, -1.3, 1.3);
    Q.head.y += lk * .8 * g; Q.torso.y += lk * .2 * g; Q.head.x -= .05 * g; Q.torso.x += .03 * aWin(fract(t / 13.) * 13., 7., 10., .8); }
  P.ank = mix(P.ank, Q.ank, W); P.fp = mix(P.fp, Q.fp, W); P.drop = mix(P.drop, Q.drop, W); P.bodyX = mix(P.bodyX, Q.bodyX, W); P.pRoll = mix(P.pRoll, Q.pRoll, W);
  P.torso = mix(P.torso, Q.torso, W); P.head = mix(P.head, Q.head, W); P.armP = mix(P.armP, Q.armP, W); P.armR = mix(P.armR, Q.armR, W); P.ayaw = mix(P.ayaw, Q.ayaw, W); P.atw = mix(P.atw, Q.atw, W); P.elb = mix(P.elb, Q.elb, W);
}`;

// JS: a stopped walker's idle: which variant, when it blends in (after `delay` s standing), and its clock
export function stepIdle(g, standing, dt, pick) {
  if (standing) { if (!g.wasStill) { g.wasStill = true; if (pick) g.idle = pick(); } g.still += dt; } else { g.wasStill = false; g.still = 0; }
  const on = standing && g.still > .35 && g.idle >= 0;
  g.iw += ((on ? 1 : 0) - g.iw) * (1 - Math.exp(-dt / (on ? .5 : .1)));
  g.it += dt;
}
