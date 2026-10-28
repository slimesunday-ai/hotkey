// CLIPS · transit (travel; MOVEMENT.md §5–§7; the transit agent, 2026-10-07). What an agent does on the way: the bus, the subway, a taxi.
//   sit_ride      loop 6 s · seated on a bus / subway seat (or a bench): the carriage's roll and a brake lurch, weight shifts, glances
//   stand_rail    loop 6 s · standing, the +x hand on a VERTICAL pole beside the body; braces through a brake and a pull-away
//   wait_stop     loop 9 s · at the bus stop: weight shifts, leans out to look down the street (+x side), a sigh, toe taps, the watch
//   stairs_down   loop 0.8 s (2 treads) · down a station stairwell, the feet planted on the treads; the OWNER moves the walker (below)
//   stairs_up     loop 0.8 s (2 treads) · up, the same contract
//   turnstile     one-shot 1.5 s · taps the card, pushes through the hip-high bar with a hip check; ends 0.7 m on (shift)
//   hail_taxi     one-shot 1.1 s + hold · a step to the kerb, the +x upper arm out to the side and the forearm up, a "hey!" bounce; held: a wave every 1.3 s
//   car_get_in    one-shot 1.3 s + hold · a hand on the door frame, ducks the head, steps in and sinks low; held low (hide the walker)
//   car_get_out   one-shot 1.3 s · from low in the door: a hand on the frame, steps out, rises, straightens, a look round; ends 0.6 m on
//
// THE LEGS CAN'T SIT 90/90 (proven in the lab, 2026-10-07): the connected leg's cloth rings are placed in the FOOT's frame, their height
// linear in the rest y between the shoe socket and the hip (walk2.js), so a knee bent toward 90° with the foot flat squashes the thigh
// and the shin into a ~7 cm slab with cloth shards at the back. A straight leg whose foot is pitched with it stays rigid and clean. So
// sit_ride is a SLOUCH: the legs straight out at ~58° to the heels, the shoes toe-up 40°, the hips at 0.39 m (seat top ≈ 0.30 m).
// STAIRS: rise 0.18 m, tread 0.36 m (the shoes are 0.45 m long: a shorter tread puts the heel inside the riser). The walker is NOT
// `moving` (its legs are its own, planted on the treads): the owner keeps the walk weight at 0 and moves the walker itself, at 0.9 m/s
// along and 0.45 m/s down (or up) the straight line from the stairs' start edge (down: the top landing's nosing, at the landing's
// height; up: the foot of the first riser, at the floor's height), starting the clip there at t = 0, and stops it at the far end.
// Arms are [pitch fwd, roll out, yaw in, twist in] (rad); torso / head: x = pitch forward (head: look down), y = yaw (+: the front turns
// to +x), z = roll. Feet: cFoot (body-frame z of the foot's ground point; a planted foot under a moving root sits at its spot − the root).
// THE ELBOW (2026-10-09, the elbow-transit-falls agent; ../ELBOW.md): stand_rail's hand on the pole and hail_taxi's raised forearm are
// placed by a two-bone IK on the elbow (talk-patrol.js / work.js's method, copied: each group file stands alone). The reach sets the
// elbow, then the shoulder turns the bent arm so its grip point lands on the target, the elbow toward a pole. Targets are in the CHEST's
// rest frame (the shoulder at x ±0.25, y 0.825), so the chest's lean and turn carry the hands. The toon arm reaches only 0.40–0.45 m
// from the shoulder (elbow 26–83°, under the thick sleeve's soft cap): every target here sits inside that shell.
const f = v => (+v).toFixed(4);
const SH = { x: .25, y: .825 }, HINGE = { y: .65, z: .05 }, GRIP = { x: .325, y: .39, z: 0 }, ELB = { y: .65 };
const gx = GRIP.x - SH.x, hy = HINGE.y - SH.y, hz = HINGE.z, gy = GRIP.y - HINGE.y, gz = GRIP.z - HINGE.z;
const RA = gx * gx + hy * hy + hz * hz + gy * gy + gz * gz, Bc = 2 * (hy * gy + hz * gz), Bs = 2 * (hy * gz - hz * gy), RB = Math.hypot(Bc, Bs), PHI = Math.atan2(Bs, Bc);
const EMAX = 1.45, RMIN = Math.sqrt(RA + RB * Math.cos(EMAX - PHI)), RMAX = Math.sqrt(RA + RB);
// side 0 (−x) / 1 (+x); T = the hand's target, H = where the elbow points (chest rest frame, vec3 expressions); k blends the arm onto it
function ik(side, T, H, k = '1.') {
  const sx = side ? 1 : -1;
  return /* glsl */`{ vec3 kT = (${T}) - vec3(${f(sx * SH.x)}, ${f(SH.y)}, 0.), kH = (${H});
    float kr2 = clamp(dot(kT, kT), ${f(RMIN ** 2)}, ${f(RMAX ** 2)}), ke = ${f(PHI)} + acos(clamp((kr2 - ${f(RA)}) / ${f(RB)}, -1., 1.)), kc = cos(ke), ks = sin(ke);
    vec3 kv = vec3(${f(sx * gx)}, ${f(hy)} + kc * ${f(gy)} + ks * ${f(gz)}, ${f(hz)} - ks * ${f(gy)} + kc * ${f(gz)}), kl = vec3(${f(sx * gx)}, ${f(ELB.y - SH.y)}, 0.);
    vec3 e1 = normalize(kv), e2 = normalize(kl - dot(kl, e1) * e1), f1 = normalize(kT), f2 = normalize(kH - dot(kH, f1) * f1);
    mat3 kR = mat3(f1, f2, cross(f1, f2)) * transpose(mat3(e1, e2, cross(e1, e2)));
    float kb = asin(clamp(kR[1][2], -1., 1.)), ka = atan(-kR[1][0], kR[1][1]), kcc = atan(-kR[0][2], kR[2][2]);
    if (abs(ka) > 1.5707963) { ka -= sign(ka) * 3.14159265; kb = (kb >= 0. ? 3.14159265 : -3.14159265) - kb; kcc += kcc > 0. ? -3.14159265 : 3.14159265; }
    cArm(P, ${side}, vec4(-kb, ${f(sx)} * ka, 0., ${f(-sx)} * kcc), ke, ${k}); }`;
}
// stand_rail's pole (body frame; the city places each standing spot so its pole is here: subway/carriage.js RAIL) and the grip's height
const RAIL = { x: .52, z: .27, y: .6 };
// hail_taxi's raised hand (chest rest frame) and where its elbow points
const HAIL = { x: .665, y: .95, z: .08, pole: [.8, -.8, .5], from: [.47, .43, .1], via: [.66, .74, .14] };
export const CLIPS = [
  { name: 'sit_ride', dur: 6, loop: true, blendIn: .35, blendOut: .35,
    note: 'a loop: seated (a slouch: the legs straight out to the heels, hips at 0.39 m, seat top ≈ 0.30 m, hands on the seat) · the carriage rolls (3 s) and rattles · a brake lurch at 3.4 s · glances: left 0.8–2.0, down at the hands 2.5–3.2, up and right 4.2–5.4',
    glsl: /* glsl */`
  float T = 6.2831853, roll = sin(T * t / 3.), rat = sin(T * t / .75 + 1.1) * .5 + .5 * sin(T * t / .5);
  float lurch = cOut(t, 3.4, 3.62) * (1. - cS(t, 3.7, 4.6));          // the brake: the body pitches on, the head lags, then both settle
  float shift = sin(T * t / 6. + .6);                                  // a slow weight shift, one way and back
  P.drop += .11; P.bodyX += .012 * shift + .006 * roll; P.pRoll += .03 * shift;
  cFoot(P, 0, .43, 0., .7 + .04 * shift); cFoot(P, 1, .43, 0., .7 - .04 * shift);   // the heels down, the toes up
  P.torso.x += -.05 + .13 * lurch + .008 * rat; P.torso.z += .05 * roll - .02 * shift; P.torso.y += .05 * shift;
  P.head.z -= .035 * roll; P.head.x -= .07 * cOut(t, 3.4, 3.55) * (1. - cS(t, 3.55, 4.)) - .03 * lurch;   // (the head lags the lurch)
  float look = .6 * cS(t, .8, 1.15) * (1. - cS(t, 1.75, 2.05)) - .5 * cS(t, 4.2, 4.55) * (1. - cS(t, 5.1, 5.45));
  P.head.y += look; P.torso.y += .15 * look;
  P.head.x += .22 * cS(t, 2.5, 2.75) * (1. - cS(t, 3., 3.25)) - .1 * cS(t, 4.2, 4.55) * (1. - cS(t, 5.1, 5.45));
  // the hands on the seat, wide of the thighs (clear of the baggiest bottoms); they brace a touch on the lurch
  vec4 A = vec4(.1 - .05 * lurch, .38, 0., .3);
  cArm(P, 0, A + vec4(-.02 * roll, .02 * roll, 0., 0.), 1.); cArm(P, 1, A + vec4(.02 * roll, -.02 * roll, 0., 0.), 1.);
  cBreathe(P, t, 1.);` },

  { name: 'stand_rail', dur: 6, loop: true, blendIn: .3, blendOut: .3,
    note: 'a loop: standing in a staggered stance, the +x hand grips a vertical pole beside the body, the elbow bent (the pole: body frame x 0.52, z 0.27; the grip at y 0.60, on it to ≤ 6 mm) · the carriage rolls (3 s) · brakes 1.6 s: the body pitches on and twists to the pole, the knees give, the free arm swings on · pulls away 4.2 s: rocks back · glances at the doors, up at the line map',
    glsl: /* glsl */`
  float T = 6.2831853, roll = sin(T * t / 3.), rat = sin(T * t / .75 + .4);
  float brake = cOut(t, 1.6, 1.9) * (1. - cS(t, 2.1, 3.1)), go = cOut(t, 4.2, 4.45) * (1. - cS(t, 4.6, 5.5));
  float fa = .1 * brake - .08 * go;                                   // fore and aft
  cFoot(P, 0, .1, 0., 0.); cFoot(P, 1, -.08, 0., 0.);                 // the brace: the −x foot ahead, the +x one back
  P.drop += .02 + .025 * brake + .015 * go;
  P.bodyX += .018 * roll; P.pRoll += .05 * roll;
  P.torso.x += fa + .006 * rat; P.torso.z -= .03 * roll; P.torso.y -= .12 * brake + .05 * go;   // (into the pole on the brake)
  P.head.x -= .6 * fa; P.head.z += .03 * roll;
  float look = -.55 * cS(t, .4, .7) * (1. - cS(t, 1.2, 1.5)) - .18 * cS(t, 3.4, 3.7) * (1. - cS(t, 4.1, 4.3));
  P.head.y += look; P.head.x -= .2 * cS(t, 3.4, 3.7) * (1. - cS(t, 4.1, 4.3));   // to the doors; then up at the line map (away from the pole)
  // the +x hand GRIPS the pole (the elbow bent, down and back): the grip point, fixed in the body frame, taken into the chest's rest
  // frame from where the chest is now (walk2.js: the chest turns about the hips' rest point), so the elbow takes up the body's sway
  // (the hips stand as high as both posed ankles allow: walk2.js's standing pelvis, so the breath goes in first. Two breaths a loop,
  // 3 s each: the idles' 3.6 s breath did not divide the 6 s loop and popped the chest and head ~25 mm at every wrap)
  cBreathe(P, t * 1.2, 1.);
  float lR = (A_L1 + A_L2) * .998, sr = sin(P.pRoll) * A_HIPX;
  float hip = min(A_HIPY - P.drop, min(P.ank.y + sqrt(max(lR * lR - P.ank.x * P.ank.x - P.bodyX * P.bodyX, 0.)) + sr, P.ank.w + sqrt(max(lR * lR - P.ank.z * P.ank.z - P.bodyX * P.bodyX, 0.)) - sr));
  mat3 M = aRZ(P.torso.z + .5 * P.pRoll) * aRX(P.torso.x) * aRY(P.torso.y);
  vec3 S = vec3(P.bodyX, hip, A_HIPZ) + M * vec3(${f(SH.x)}, ${f(SH.y)} - A_HIPY, -A_HIPZ);
  ${ik(1, `vec3(${f(SH.x)}, ${f(SH.y)}, 0.) + transpose(M) * (vec3(${f(RAIL.x)}, ${f(RAIL.y)}, ${f(RAIL.z)}) - S)`, 'vec3(.5, -1., -.55)')}
  // the free arm hangs, the elbow soft; it swings on with the brake and back with the pull-away (a pendulum: it overshoots and settles)
  // and the forearm trails the swing (straighter going on, folding as it comes back)
  float sw = .32 * cOut(t, 1.65, 1.95) * (1. - cS(t, 2., 2.9)) - .26 * cOut(t, 4.25, 4.5) * (1. - cS(t, 4.55, 5.4));
  float fe = .3 - .12 * cOut(t, 1.65, 1.95) * (1. - cS(t, 1.95, 2.4)) + .28 * cBump(t, 2.05, 2.9) + .18 * cBump(t, 4.25, 4.9) + .03 * roll;
  cArm(P, 0, vec4(.04 + sw - .03 * roll, .1 + .03 * roll, 0., .1), fe, 1.);` },

  { name: 'wait_stop', dur: 9, loop: true, blendIn: .3, blendOut: .3,
    note: 'a loop at the stop: weight on one leg 0–1.5 s · leans out and looks down the street (to its +x side) 1.5–3.5, a second look · a sigh 3.6–4.3 · toe taps 4.3–6.1 · checks the watch (−x wrist) 6.2–7.5 · a last glance 7.7–8.6',
    glsl: /* glsl */`
  float T = 6.2831853;
  float sh = sin(T * t / 9. + .3);                                    // the weight, from leg to leg once a loop
  P.bodyX += .02 * sh; P.pRoll += .06 * sh; P.torso.z -= .04 * sh; P.head.z += .04 * sh;
  // leaning out: the body tips to +x and on, the head turns down the street; it holds, comes back a little, looks again
  float lean = cS(t, 1.5, 2.) * (1. - .55 * cS(t, 2.55, 2.75) * (1. - cS(t, 2.85, 3.05))) * (1. - cS(t, 3.25, 3.6));
  P.torso.z -= .12 * lean; P.torso.x += .1 * lean; P.bodyX += .025 * lean; P.torso.y += .25 * lean; P.head.y += .85 * lean; P.head.z += .07 * lean;
  cFoot(P, 1, .06 * lean, 0., 0.); cFoot(P, 0, -.03 * lean, 0., -.18 * lean);   // the +x foot edges on, the −x heel comes up
  // the sigh: the shoulders rise, then drop with the head
  float sg = cBump(t, 3.6, 4.0), dn = cS(t, 3.9, 4.2) * (1. - cS(t, 5.6, 6.2));
  P.armR += vec2(.08 * sg); P.torso.x -= .05 * sg; P.head.x += .14 * dn - .08 * sg;
  // the toe taps (the +x foot, heel planted), in a burst
  float tap = pow(max(0., sin(T * 2.4 * (t - 4.3))), 2.) * cS(t, 4.3, 4.45) * (1. - cS(t, 5.9, 6.1));
  aFootRoll(P, 1, .3 * tap); P.head.x += .02 * tap;
  // the arms hang; the watch: the −x arm comes up across the front, the wrist turned up, the head goes down to it
  float wp = cS(t, 6.15, 6.45) * (1. - cS(t, 7.3, 7.6)), wt = cS(t, 6.35, 6.6) * (1. - cS(t, 7.1, 7.35));   // up first, then in; out first, then down
  cArm(P, 1, vec4(.02 - .06 * lean, .18 + .04 * lean, 0., .2), 1.);
  cArm(P, 0, vec4(mix(.02, 1.22, wp), mix(.18, .02, wt), .62 * wt, mix(.2, -.7, wt)), 1.); P.head.x += .3 * wt; P.head.y -= .3 * wt; P.torso.y -= .1 * wt;
  // a last glance down the street
  float gl = cS(t, 7.7, 7.95) * (1. - cS(t, 8.3, 8.6)); P.head.y += .7 * gl; P.torso.y += .1 * gl;
  cBreathe(P, t, 1.);` },

  { name: 'stairs_down', dur: .8, loop: true, blendIn: .15, blendOut: .25, speed: .9, stair: { rise: .18, tread: .36, vy: -.45 },
    note: 'a loop of 2 treads (rise 0.18, tread 0.36): the walker is moved by its OWNER at 0.9 m/s along and 0.45 m/s down the line through the nosings, from the top nosing at t = 0 (not `moving`: the legs are its own) · each foot clears the nosing, comes down toe-first two treads on and plants; the stance knee folds, the head watches the steps, the arms swing out a little',
    glsl: /* glsl */`
  const float V = .9, VY = .45, TR = .36;
  for (int s = 0; s < 2; s++) {
    float ph = mod(t + .4 * float(s), D);                          // the time since this foot lifted (L at t = 0, R at 0.4)
    float z = .72 * cOut(ph, 0., .27);                               // forward first, over the nosing …
    float y = -.36 * smoothstep(.17, .35, ph) + .03 * cBump(ph, 0., .34);   // … then down onto the tread two below
    float fp = -.3 * (1. - cS(ph, 0., .1)) + .22 * cBump(ph, .06, .28) - .12 * cBump(ph, .27, .37) - .3 * cS(ph, .62, .8);   // heel up at lift-off, the toe up with the reach, a toe-first touch, heel up late
    cFoot(P, s, -TR * .5 + z - V * ph, y + VY * ph, fp);
  }
  float T = 6.2831853, sw = sin(T * t / D - .785);
  cArms(P, vec4(.05, .32, 0., .2), 1.); P.armP += vec2(-.14, .14) * sw; P.armR += vec2(.04) * abs(sw);   // (out for balance, clear of the knees)
  P.torso.x += .07; P.head.x += .22; P.torso.y += .06 * sw; P.head.y -= .05 * sw;
  P.torso.z += .035 * sin(T * t / D + .6); P.head.z -= .02 * sin(T * t / D + .6);` },

  { name: 'stairs_up', dur: .8, loop: true, blendIn: .15, blendOut: .25, speed: .9, stair: { rise: .18, tread: .36, vy: .45 },
    note: 'a loop of 2 treads (rise 0.18, tread 0.36): the walker is moved by its OWNER at 0.9 m/s along and 0.45 m/s up the line from the foot of the first riser at t = 0 (not `moving`) · each knee drives up, the toe lifts over the nosing, the foot sets down two treads up; the body leans into the climb and pushes up off the lead leg',
    glsl: /* glsl */`
  const float V = .9, VY = .45;
  for (int s = 0; s < 2; s++) {
    float ph = mod(t + .4 * float(s), D);
    float z = .72 * smoothstep(.03, .34, ph);                        // the foot comes up with the knee, then on
    float y = .36 * smoothstep(.01, .3, ph) + .03 * cBump(ph, .04, .34);
    float fp = -.3 * (1. - cS(ph, .04, .14)) + .15 * cBump(ph, .08, .32) - .3 * cS(ph, .64, .8);   // toe-off (the heel stays up while the foot is far back), toe up over the nosing, flat
    cFoot(P, s, -.29 + z - V * ph, y - VY * ph, fp);
  }
  float T = 6.2831853, sw = sin(T * t / D - .785);
  P.drop -= .12;   // (the stance leg may push the pelvis above the root line: the body stands on a tread above it)
  cArms(P, vec4(.05, .32, 0., .2), 1.); P.armP += vec2(-.18, .18) * sw;
  P.torso.x += .2; P.head.x -= .1; P.torso.y += .08 * sw; P.head.y -= .06 * sw;
  P.torso.z += .03 * sin(T * t / D + .6);` },

  { name: 'turnstile', dur: 1.5, blendIn: .12, blendOut: .3, shift: [0, .7],
    note: 'taps the card on the reader (+x hand, 0–0.35 s) · steps in (−x foot) 0.3–0.7 · the hips meet the bar at 0.55: a hip check, the body leans back and stalls, the hands lift clear · pushes through, the +x foot steps on 0.75–1.15 · settles; ends 0.7 m on (shift: the bar is ~0.35 m ahead at the start)',
    glsl: /* glsl */`
  float m = .26 * cS(t, .28, .58) + .44 * cS(t, .66, 1.18); cMov.z = m;   // on, a stall at the bar, through
  cFoot(P, 0, cStep(t, .3, .66, 0., .4) - m, cLift(t, .3, .66, .06), -.2 * cBump(t, .26, .42));
  cFoot(P, 1, cStep(t, .74, 1.15, 0., .7) - m, cLift(t, .74, 1.15, .06), -.32 * cS(t, .42, .6) * (1. - cS(t, .8, .95)));   // (the trailing heel up through the stall: in reach)
  float tap = cS(t, 0., .14) * (1. - cS(t, .3, .48)), chk = cBump(t, .5, .78);
  cArms(P, vec4(.06, .24, 0., .2), 1.);   // (a little out: the stepping thighs pass under them)
  cArm(P, 1, vec4(.95, .2, .1, .2), tap); P.head.x += .2 * tap; P.head.y += .2 * tap; P.torso.y += .08 * tap;
  // the hip check: the pelvis leads into the bar, the chest leans back, the knees give; then a shove on and upright
  P.torso.x += -.16 * chk + .08 * cBump(t, .72, 1.) + .04 * cS(t, .1, .3) * (1. - cS(t, 1.1, 1.4));
  P.drop += .03 * chk; P.head.x += .1 * chk;
  P.torso.y -= .1 * chk; P.pRoll += .06 * chk;
  cArms(P, vec4(.45, .55, 0., .3), chk); cArm(P, 0, vec4(-.15, .26, 0., .1), cBump(t, .8, 1.25) * .6);
  cBreathe(P, t, cS(t, 1.2, 1.5));` },

  { name: 'hail_taxi', dur: 1.1, hold: true, blendIn: .1, blendOut: .35, shift: [0, .3],
    note: 'a step to the kerb (−x foot, then the +x foot beside it) 0–0.45 s · the +x arm comes up out to the side, the forearm up, the hand beside the head (y ≈ 1.03: as high as the reach allows clear of the head) 0.3–0.55 · up on the toes for the "hey!" 0.5–0.75, a wave · held: the arm stays up, a two-beat wave every 1.3 s; ends 0.3 m on (shift)',
    glsl: /* glsl */`
  float m = .3 * cS(t, 0., .45); cMov.z = m;
  cFoot(P, 0, cStep(t, 0., .3, 0., .3) - m, cLift(t, 0., .3, .05), 0.);
  cFoot(P, 1, cStep(t, .2, .45, 0., .3) - m, cLift(t, .2, .45, .04), 0.);
  float up = cBack(t, .3, .55), hey = cBump(t, .5, .78);
  cArms(P, vec4(.04, .22, 0., .2), 1.);
  // the +x arm: the upper arm out to the street side, the FOREARM UP, the hand beside the head (clear of its side by ~3 cm; the reach
  // shell puts it no higher than y ≈ 1.0); it shoots up with an overshoot, two waves on the "hey!", then held: a wave every 1.3 s
  float wv = sin(6.2831853 * (t - .6) / .28) * cBump(t, .6, .88) + step(1.1, t) * sin(6.2831853 * mod(max(t - 1.1, 0.), 1.3) / .26) * cBump(mod(max(t - 1.1, 0.), 1.3), 0., .52);
  // (on the way up the hand runs a curve out to the side below the head, then up beside it: a bezier through HAIL.via; Euler angles
  // blended straight from the hanging arm to the bent one carried the hand through the head's corner)
  float hs = cS(t, .3, .52);
  vec3 hT = (1. - hs) * (1. - hs) * vec3(${HAIL.from.map(f)}) + 2. * hs * (1. - hs) * vec3(${HAIL.via.map(f)}) + hs * hs * vec3(${f(HAIL.x)}, ${f(HAIL.y)}, ${f(HAIL.z)});
  ${ik(1, `hT + vec3(.035 * max(wv, 0.) - .01 * max(-wv, 0.), .4 * max(up - 1., 0.) - .01 * abs(wv), -.035 * wv)`, `vec3(${HAIL.pole.map(f)})`, 'cS(t, .3, .37)')}
  aFootRoll(P, 0, -.3 * hey); aFootRoll(P, 1, -.3 * hey); P.drop -= .03 * hey;   // on the toes
  P.torso.x -= .1 * up - .05 * hey; P.torso.z += .1 * up; P.torso.y -= .12 * up; P.head.x -= .12 * up + .06 * hey; P.head.y += .14 * up;
  cArm(P, 0, vec4(-.06, .26, 0., .1), up);
  cBreathe(P, t, cS(t, 1., 1.6));` },

  { name: 'car_get_in', dur: 1.3, hold: true, blendIn: .12, blendOut: .3, shift: [0, .55],
    note: 'facing the open door: the +x hand to the door frame 0–0.3 s · the −x foot steps in over the sill 0.15–0.55 · ducks: the chest pitches on, the head goes down 0.3–0.8 · the +x foot follows 0.6–1.0, the body sinks into the seat · held low (the walker is inside the door line: hide it or close the door on it, then clearClip); 0.55 m on (shift)',
    glsl: /* glsl */`
  float m = .3 * cS(t, .15, .55) + .25 * cS(t, .6, 1.05); cMov.z = m;
  cFoot(P, 0, cStep(t, .15, .55, 0., .45) - m, cLift(t, .15, .55, .08), .15 * cBump(t, .15, .5));
  cFoot(P, 1, cStep(t, .6, 1., 0., .55) - m, cLift(t, .6, 1., .09), -.3 * cBump(t, .5, .75));
  cArms(P, vec4(.06, .34, 0., .2), 1.);   // (out of the knees' way)
  float dk = cS(t, .3, .8), sink = cS(t, .7, 1.2);
  P.torso.x += .5 * dk - .1 * sink; P.head.x += .25 * dk; P.drop += .07 * dk + .1 * sink; P.torso.y += .1 * dk;
  cArm(P, 1, vec4(1.45, .3, -.1, .3), cS(t, 0., .3) * (1. - cS(t, .9, 1.25)));   // the hand on the frame, let go as the body is in
  cArm(P, 0, vec4(.35, .44, -.1, .2), dk);
  cBreathe(P, t, cS(t, 1.2, 1.8));` },

  { name: 'car_get_out', dur: 1.3, blendIn: .08, blendOut: .3, shift: [0, .6],
    note: 'starts low in the door (play it with { snap: true } as the walker appears) · the +x hand to the frame 0–0.25 s · the −x foot steps out 0.15–0.55 · the body rises and comes out, the head last 0.4–0.95 · the +x foot follows 0.6–0.95 · straightens with a shrug and a look round 0.95–1.3; ends 0.6 m on (shift)',
    glsl: /* glsl */`
  float m = .3 * cS(t, .15, .6) + .3 * cS(t, .55, .95); cMov.z = m;
  cFoot(P, 0, cStep(t, .15, .55, 0., .45) - m, cLift(t, .15, .55, .07), -.2 * cBump(t, .1, .3));
  cFoot(P, 1, cStep(t, .6, .95, 0., .6) - m, cLift(t, .6, .95, .08), -.3 * cBump(t, .5, .7));
  cArms(P, vec4(.06, .34, 0., .2), 1.);
  float low = 1. - cS(t, .3, .8), dk = 1. - cS(t, .45, .95);
  P.torso.x += .5 * dk; P.head.x += .25 * (1. - cS(t, .6, 1.)); P.drop += .07 * dk + .1 * low; P.torso.y += .1 * dk;
  cArm(P, 1, vec4(1.45, .3, -.1, .3), cS(t, 0., .25) * (1. - cS(t, .7, 1.)));
  cArm(P, 0, vec4(.35, .44, -.1, .2), dk);
  float sh = cBump(t, .95, 1.2); P.armR += vec2(.07 * sh); P.torso.x -= .06 * sh;   // the shrug
  P.head.y += .4 * cS(t, 1., 1.15) * (1. - cS(t, 1.2, 1.3)) - .1 * cBump(t, 1.15, 1.3);
  cBreathe(P, t, cS(t, 1., 1.5));` },
];
