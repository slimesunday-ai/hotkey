// CLIPS · falls (events; MOVEMENT.md §7; 2026-10-07). Getting shot, falling, lying hurt or dead, cowering. Toon timing, never gore.
//   shot_hit        the hit snaps the body back, one full spin on the right foot (arms out), a wobble, a dazed beat → fall_back → lie_hurt
//   shot_hit_dead   the same body → death_collapse → lie_still
//   fall_back       the knees give, the butt lands first, it rolls onto the back, the head bonks, a hand goes to the head → lie_hurt
//   lie_hurt        on the back (loop): fast breaths, the head rolls side to side, a hand holding the side of the head, a pain spasm once a loop
//   death_collapse  the knees buckle, it topples over the right foot onto its side, the top arm flops over late → lie_still
//   lie_still       on the right side, a little face-down, no breath (loop): reads apart from lie_hurt by side, stillness, hidden face
//   cower           a deep crouch, head ducked, the hands clamped over the sides of the head, trembling; peeks up, then ducks back (loop)
// LYING DOWN on this rig: the root (cRot / cPiv / cMov) turns the whole body rigidly, so lying is safe; the giant head (1.0 wide, 0.8
// deep, 0.25 behind the chest's back) is the pillow: on the back the chest rests reclined on it, on the side it props the shoulder.
// Each root rotates about a REAL ground contact (heels, butt, the foot's outer edge), so nothing slides; the probe kept every pose's
// lowest point within ~6 cm of the ground. The chains are exact: each one-shot's last pose is its next clip's first (shared constants).
// THE LEG CLOTH (found here, the see-through gate): it is built in the FOOT's frame, so the hip must stay ≥ ~0.12 m above the ankle
// along the foot's up axis. A big foot pitch (fp ±1) or a pelvis near ankle height turns the cloth inside out. Hence: lying feet stay
// near flat (toes up), the sit drops ≤ 0.25 and tips back about the heels instead, crouches drop ≤ 0.2 (knee bend ≈ 140° is fine).
// Arms: [pitch fwd, roll out, yaw in, twist in] + the elbow. The big head: no hands over it (out of reach); the hands that go to it
// (lie_hurt, cower) hold its lower sides, by the IK below.
const f = v => (+v).toFixed(4), v4 = a => `vec4(${a.map(f).join(', ')})`;
// ── THE ELBOW (2026-10-09, the elbow-transit-falls agent; ../ELBOW.md). A hand to the head (lying hurt: fall_back, shove_fall, lie_hurt,
// get_up's start) and the cower's hands over the sides of the head are placed by a two-bone IK on the elbow (talk-patrol.js / work.js's
// method, copied: each group file stands alone): the reach sets the elbow, then the shoulder turns the bent arm so its grip point lands
// on the target, the elbow toward a pole. The targets RIDE THE HEAD: a point in the head's rest frame, turned by the head's pose about
// the neck (walk2.js), in the chest's rest frame. So any clip that has set P.head gets the same arm for the same head, which keeps the
// chains exact (fall_back's and shove_fall's last pose = lie_hurt's first = get_up's first). The toon arm reaches only 0.40–0.45 m from
// the shoulder (elbow 26–83°, under the thick sleeve's soft cap): the reachable part of the head is its lower sides, so that is where
// the hands go (the face's front, 0.45 m ahead, is out of reach).
const SH = { x: .25, y: .825 }, HINGE = { y: .65, z: .05 }, GRIP = { x: .325, y: .39, z: 0 }, ELB = { y: .65 }, NECK = .95;
const gx = GRIP.x - SH.x, hy = HINGE.y - SH.y, hz = HINGE.z, gy = GRIP.y - HINGE.y, gz = GRIP.z - HINGE.z;
const RA = gx * gx + hy * hy + hz * hz + gy * gy + gz * gz, Bc = 2 * (hy * gy + hz * gz), Bs = 2 * (hy * gz - hz * gy), RB = Math.hypot(Bc, Bs), PHI = Math.atan2(Bs, Bc);
const EMAX = 1.45, RMIN = Math.sqrt(RA + RB * Math.cos(EMAX - PHI)), RMAX = Math.sqrt(RA + RB);
// the IK into two locals: vec4 <o>A (the arm's four angles) and float <o>E (the elbow), for the clip to blend; side 0 (−x) / 1 (+x);
// T = the hand's target, H = where the elbow points (chest rest frame, vec3 expressions)
function ikv(side, T, H, o) {
  const sx = side ? 1 : -1;
  return /* glsl */`vec4 ${o}A; float ${o}E; { vec3 kT = (${T}) - vec3(${f(sx * SH.x)}, ${f(SH.y)}, 0.), kH = (${H});
    float kr2 = clamp(dot(kT, kT), ${f(RMIN ** 2)}, ${f(RMAX ** 2)}), ke = ${f(PHI)} + acos(clamp((kr2 - ${f(RA)}) / ${f(RB)}, -1., 1.)), kc = cos(ke), ks = sin(ke);
    vec3 kv = vec3(${f(sx * gx)}, ${f(hy)} + kc * ${f(gy)} + ks * ${f(gz)}, ${f(hz)} - ks * ${f(gy)} + kc * ${f(gz)}), kl = vec3(${f(sx * gx)}, ${f(ELB.y - SH.y)}, 0.);
    vec3 e1 = normalize(kv), e2 = normalize(kl - dot(kl, e1) * e1), f1 = normalize(kT), f2 = normalize(kH - dot(kH, f1) * f1);
    mat3 kR = mat3(f1, f2, cross(f1, f2)) * transpose(mat3(e1, e2, cross(e1, e2)));
    float kb = asin(clamp(kR[1][2], -1., 1.)), ka = atan(-kR[1][0], kR[1][1]), kcc = atan(-kR[0][2], kR[2][2]);
    if (abs(ka) > 1.5707963) { ka -= sign(ka) * 3.14159265; kb = (kb >= 0. ? 3.14159265 : -3.14159265) - kb; kcc += kcc > 0. ? -3.14159265 : 3.14159265; }
    ${o}A = vec4(-kb, ${f(sx)} * ka, 0., ${f(-sx)} * kcc); ${o}E = ke; }`;
}
// a point of the head (its rest frame, m) where the head is now: in the chest's rest frame (P.head must be set first)
const onHead = (p, d = '') => `(vec3(0., ${f(NECK)}, 0.) + aRY(P.head.y) * aRX(P.head.x) * aRZ(P.head.z) * (vec3(${f(p[0])}, ${f(p[1] - NECK)}, ${f(p[2])})${d}))`;
// ── fall_back's root, in two rotations about real ground contacts (pitch only, so they compose):
//   1. the sit (0–0.45 s): the feet slide forward (the heels at z FB.heelZ) and the root tips back FB.th1 about the heels while the
//      pelvis drops FB.d1: the butt lands at B' (world, y z), on the ground
//   2. the roll (0.45–0.85): about the butt, which stays at B' while the drop unwinds (the pivot B rides the pelvis: y 0.41 − drop)
// LB (lying on the back) is the end of 2: lie_hurt uses the same root, so the chain is exact.
const FB = { heelZ: .05, th1: -.78, d1: .25, butt: 0, sink: .02 };
const rotYZ = (th, y, z) => [Math.cos(th) * y - Math.sin(th) * z, Math.sin(th) * y + Math.cos(th) * z];
const Bp = (() => { const B = [.5 - FB.d1 - FB.butt, -.1], r = rotYZ(FB.th1, B[0], B[1] - FB.heelZ); return [r[0] - FB.sink, r[1] + FB.heelZ]; })();
const LB = { pitch: -1.32, torso: .2, head: -.1,
  armL: [1.45, -.05, .65, .3], ank: [.05, .3, .11, .22], fp: [0, -.25],
  handR: [.67, 1.04, .02], poleR: [1, -.6, -.3] };   // the +x hand on the side of the head (head frame), the elbow out and down to the ground
// the +x arm of LB as two locals hA (angles) and hE (the elbow), from the head as it is now: the end of fall_back / shove_fall, lie_hurt, get_up
const LB_R = (d = '') => ikv(1, onHead(LB.handR, d), `vec3(${LB.poleR.map(f)})`, 'h');
// the root about the butt pivot B (body frame y = 0.41 − d), kept at B' (d: the drop then)
const BUTT_ROOT = (th, d) => `{ vec2 B = vec2(${f(.5 - FB.butt)} - (${d}), -.1); cPiv = vec3(0., B); cRot.x = ${th}; cMov = vec3(0., vec2(${Bp.map(f)}) - B); }`;
// ── LS: lying still on the right side (death_collapse's end = lie_still): rolled over the right foot's outer edge until the head lands
const LS = { piv: [.3, 0, .05], roll: -1.36, pitch: .1, mov: [0, .12, 0], drop: .12, torso: .3, head: .2, headZ: -.3,
  armR: [1.3, .2, -.05, .2], armL: [1.2, -.1, .25, .3], ank: [.16, .2, .1, .16], fp: [-.15, -.3] };

// ── shot_hit: one body, two chains (the root's yaw can't carry over a chain, so the spin is a full turn and ends facing the shot)
// cower's hands (the +x one; the −x one mirrored): on the head's side, low and a little forward (head frame), and where the elbow points
const CW = { hand: [.67, 1.04, .1], pole: [0, -.35, 1] };
const SHOT = /* glsl */`
  float hit = cOut(t, 0., .08), spin = cOut(t, .06, .5), wob = cS(t, .45, .8), fin = cS(t, .7, .95);
  cRot.y = 6.2831853 * spin + .32 * cBump(t, .45, .66) - .12 * cBump(t, .62, .8);   // a full turn, an overshoot and back
  cRot.z = (.1 * sin(t * 26.) * cR(t, .1, .2) * (1. - wob)) + .08 * sin(t * 15.) * wob * (1. - fin);   // tilts while spinning, a wobble
  cMov.z = -.28 * cOut(t, 0., .45);
  P.torso.x += -.42 * hit * (1. - cS(t, .1, .4)) - .08 * wob * (1. - fin);
  P.head.x += -.35 * hit * (1. - cS(t, .1, .35)) + .1 * cBump(t, .3, .6);
  P.head.y -= 1.1 * cBump(t, .06, .5);                                 // the head lags the spin
  P.head.z += .22 * sin(t * 13.) * wob * (1. - fin);                    // dazed
  P.drop += .05 * cBump(t, 0., .2) + .03 * cBump(t, .45, .7);
  cFoot(P, 0, .08 * cBump(t, .08, .5), .1 * cBump(t, .08, .5), 0.);    // the left knee comes up: spinning on the right foot
  vec4 F = vec4(1.1, 1.25, 0., .3), O = vec4(.25, 1.5, 0., .5);
  vec4 a = mix(mix(vec4(0., .06, 0., 0.), F, hit), O, cS(t, .1, .25));
  a = mix(a, vec4(.1, .35, 0., .1), wob); a = mix(a, vec4(0., .06, 0., 0.), fin);
  float fl = .25 * sin(t * 30.) * wob * (1. - fin);                    // the arms flap as it wobbles
  cArm(P, 0, a + vec4(fl, 0., 0., 0.), 1. - fin); cArm(P, 1, a - vec4(fl, 0., 0., 0.), 1. - fin);`;

export const CLIPS = [
  { name: 'fall_back', dur: 1.2, next: 'lie_hurt', blendIn: .06, blendOut: .3,
    note: 'the knees give 0–0.12 s, arms fly up · sits down hard 0.1–0.45 (butt first) · rolls onto the back 0.45–0.85, the feet kick up · the head bonks 0.8–0.95 · settles 0.95–1.2, a hand to the head; chains to lie_hurt',
    glsl: /* glsl */`
  float give = cOut(t, 0., .12), sit = cS(t, .08, .45), roll = cIn(t, .45, .84), land = cS(t, .8, 1.15);
  float d = .06 * give * (1. - sit) + ${f(FB.d1)} * sit * (1. - roll) + .02 * cBump(t, .43, .55) * (1. - roll);
  if (t < .45) { cPiv = vec3(0., 0., ${f(FB.heelZ)}); cRot.x = ${f(FB.th1)} * sit; cMov.y = -${f(FB.sink)} * sit; }   // 1. the sit: tips back about the heels
  else ${BUTT_ROOT(`${f(FB.th1)} + ${f(LB.pitch - FB.th1)} * roll`, 'd')}             // 2. the roll: about the butt
  P.drop += d;
  float zf = ${f(FB.heelZ + .175 - .025)} * sit;                                      // the feet slide forward: the heels end at FB.heelZ
  cFoot(P, 0, zf + .025 * sit, 0., .08 * sit); cFoot(P, 1, zf - .02 * sit, 0., .08 * sit);
  P.ank = mix(P.ank, vec4(${LB.ank.map(f)}), cS(t, .45, .85)); P.fp = mix(P.fp, vec2(${LB.fp.map(f)}), cS(t, .45, .9));
  P.ank.xz += .14 * cBump(t, .5, .9);                                 // the feet kick up as the back hits
  P.torso.x += -.15 * give * (1. - sit) + .25 * sit * (1. - roll) + ${f(LB.torso)} * roll;
  P.head.x += -.15 * give * (1. - sit) + .25 * cBump(t, .4, .6) - .25 * cBump(t, .78, .92) + ${f(LB.head)} * roll;
  vec4 fl = vec4(1.3, .8, 0., .3), bal = vec4(1.2, .5, .1, .3), flop = vec4(.4, 1.1, 0., .2);
  vec4 aL = mix(mix(mix(vec4(0., .04, 0., 0.), fl, give), bal, sit), flop, roll), aR = aL;   // (from the plain stand's arms, roll 0.04: shot_hit's end)
  cArm(P, 0, mix(aL, ${v4(LB.armL)}, land), 1.);
  ${LB_R()} cArm(P, 1, mix(aR, hA, land), hE * land, 1.);   // (the hand to the head: LB's, from the head as it lands)` },

  { name: 'lie_hurt', dur: 2, loop: true, blendIn: .3, blendOut: .4,
    note: 'a loop, on the back: four quick breaths, the head rolls side to side, the right hand holds the side of the head (riding its roll) and rubs it, the left knee up · a pain spasm 0.55–1.35 s: the chest and head curl up, both knees come up · played alone it blends in from the stand (use fall_back or shot_hit to get here)',
    glsl: /* glsl */`
  ${BUTT_ROOT(f(LB.pitch), '0.')}
  float T = 6.2831853, br = sin(T * t / .5), wr = sin(T * t / D), sp = cBump(t, .55, 1.35);
  P.torso.x += ${f(LB.torso)} + .04 * br + .16 * sp; P.torso.y += .12 * wr;
  P.head.x += ${f(LB.head)} - .02 * br + .22 * sp + .28 * wr * wr * (1. - sp); P.head.y -= .4 * wr * (1. - sp);   // (a rolled cube rides up on its edge)
  // the +x hand holds the side of the head and rides it as it rolls; it rubs (along the head's side, 3 a loop) and clutches on the spasm
  ${LB_R(' + vec3(0., .02, .03) * sin(T * t * 3.) + vec3(.01, .03, -.03) * sp')} cArm(P, 1, hA, hE, 1.);
  // the −x hand on the chest, under the chin: as the head rolls and curls (lk, 0 at the loop's seam) it drops, the forearm folding onto
  // the chest, so the chin never lands on it
  float lk = wr * wr * (1. - sp) + sp;
  cArm(P, 0, ${v4(LB.armL)} + vec4(-.45 * lk, .3 * lk, .1 * sp, 0.), .5 * lk, 1.);
  P.ank = vec4(${LB.ank.map(f)}) + vec4(0., -.06 * wr, .02 * wr, .03 * wr) + vec4(0., .05, -.02, .08) * sp; P.fp = vec2(${LB.fp.map(f)});` },

  { name: 'death_collapse', dur: 1.4, next: 'lie_still', blendIn: .1, blendOut: .4,
    note: 'a stiff beat 0–0.28 s (the head comes up) · the knees buckle 0.14–0.46, the head drops · topples over the right foot 0.4–0.9, the top arm swings up · lands on its side, a bounce 0.9–1.05 · the top arm flops over 1.08–1.32; chains to lie_still',
    glsl: /* glsl */`
  float stiff = cBump(t, 0., .28), buck = cIn(t, .14, .46), tip = cIn(t, .4, .9), land = cS(t, .88, 1.3);
  // the root: rolls over the right foot's outer edge until the head lands, riding up onto the right arm as it lands
  cPiv = vec3(${LS.piv.map(f)}); cRot.z = ${f(LS.roll)} * tip; cRot.x = ${f(LS.pitch)} * land; cMov = vec3(${LS.mov.map(f)}) * cS(t, .75, 1.);
  cMov.y += .035 * cBump(t, .9, 1.05);                                  // the bounce
  P.drop += .2 * buck * (1. - tip) + ${f(LS.drop)} * tip;
  cFoot(P, 0, -.05 * buck, 0., -.15 * buck); cFoot(P, 1, .03 * buck, 0., -.1 * buck);   // the knees buckle forward, the heels come up
  P.ank = mix(P.ank, vec4(${LS.ank.map(f)}), cS(t, .45, 1.)); P.fp = mix(P.fp, vec2(${LS.fp.map(f)}), cS(t, .45, 1.));
  P.torso.x += -.06 * stiff + .38 * buck * (1. - tip) + ${f(LS.torso)} * tip;
  P.torso.z -= .12 * buck * (1. - tip);                                 // the chest leads the tip
  P.head.x += -.14 * stiff + .45 * buck * (1. - tip) + ${f(LS.head)} * tip - .2 * cBump(t, .9, 1.06);
  P.head.z += ${f(LS.headZ)} * land + .18 * cBump(t, .9, 1.1);
  vec4 limp = vec4(-.2, .35, 0., 0.), fling = vec4(.6, 1.3, 0., .3);
  // (from the plain stand's arms, roll 0.04: shot_hit_dead's end, so the chain is exact; it was 0.08, a 21.8 mm pop)
  cArm(P, 0, mix(mix(mix(vec4(0., .04 + .3 * stiff, 0., 0.), limp, buck), fling, cS(t, .5, .85)), ${v4(LS.armL)}, cS(t, 1.08, 1.32)), 1.);   // the top arm swings up as it tips, then flops over (late)
  cArm(P, 1, mix(mix(vec4(0., .04 + .3 * stiff, 0., 0.), limp, buck), ${v4(LS.armR)}, cS(t, .55, .9)), 1.);` },

  { name: 'lie_still', dur: 2, loop: true, blendIn: .3, blendOut: .4,
    note: 'a loop with nothing in it: on the right side, a little face-down, the knees bent, the top arm flopped over in front, no breath',
    glsl: /* glsl */`
  cPiv = vec3(${LS.piv.map(f)}); cRot.z = ${f(LS.roll)}; cRot.x = ${f(LS.pitch)}; cMov = vec3(${LS.mov.map(f)});
  P.drop += ${f(LS.drop)}; P.ank = vec4(${LS.ank.map(f)}); P.fp = vec2(${LS.fp.map(f)});
  P.torso.x += ${f(LS.torso)}; P.head.x += ${f(LS.head)}; P.head.z += ${f(LS.headZ)};
  cArm(P, 0, ${v4(LS.armL)}, 1.); cArm(P, 1, ${v4(LS.armR)}, 1.);` },

  { name: 'shot_hit', dur: .95, next: 'fall_back', blendIn: .03, blendOut: .3, shift: [0, -.28], glsl: SHOT,
    note: 'the hit 0–0.08 s: snaps back, arms flung · one full spin 0.06–0.5 on the right foot (arms out, the left knee up, the head lagging) · a wobble 0.5–0.75 · a dazed beat, standing, 0.75–0.95; chains to fall_back → lie_hurt. Ends 0.28 m back (shift)' },
  { name: 'shot_hit_dead', dur: .95, next: 'death_collapse', blendIn: .03, blendOut: .3, shift: [0, -.28], glsl: SHOT,
    note: 'shot_hit, chaining to death_collapse → lie_still' },

  { name: 'cower', dur: 2.4, loop: true, blendIn: .2, blendOut: .35,
    note: 'a loop: a deep crouch, hunched, the head ducked, the hands clamped over the lower sides of the head, the elbows forward (the shield; the big head is out of reach above that), trembling all through · peeks up 0.9–1.6 s, the hands slipping forward · flinches back down 1.6–1.95',
    glsl: /* glsl */`
  float T = 6.2831853, tr = sin(T * 28. * t / D), tr2 = sin(T * 33. * t / D + 1.);
  float peek = cS(t, .9, 1.25) * (1. - cOut(t, 1.6, 1.75)), flinch = cBump(t, 1.6, 1.95);
  P.drop += .19 + .006 * tr + .01 * flinch;
  cFoot(P, 0, .06, 0., -.25); cFoot(P, 1, -.06, 0., -.25);
  P.torso.x += .45 - .12 * peek + .06 * flinch; P.torso.z += .02 * tr;
  P.head.x += .15 - .3 * peek + .12 * flinch; P.head.z -= .025 * tr2;
  // the hands clamped over the lower sides of the head, the elbows forward and down (the shield): they ride the head as it ducks and
  // peeks, slip a little forward as it peeks, press in on the flinch; trembling
  ${ikv(0, onHead([-CW.hand[0], CW.hand[1], CW.hand[2]], ` + vec3(.01 * flinch, .006 * tr2 - .02 * peek, .04 * peek + .006 * tr)`), `vec3(${f(-CW.pole[0])}, ${f(CW.pole[1])}, ${f(CW.pole[2])})`, 'cl')}
  ${ikv(1, onHead(CW.hand, ` + vec3(-.01 * flinch, -.006 * tr2 - .02 * peek, .04 * peek - .006 * tr)`), `vec3(${CW.pole.map(f)})`, 'cr')}
  cArm(P, 0, clA, clE, 1.); cArm(P, 1, crA, crE, 1.);` },
];

// ═══ KNOCKED DOWN AND BACK UP (the getup-aim agent, 2026-10-08; slime: "instead of them disappearing, they should fall down and get
// back up"). The robbery's victim: rob_lunge_grab on the robber, shove_fall on the victim (paired as hit_stumble_back is: 1.15 m in front,
// facing, 0.34 s after the robber's start) → lie_hurt (a beat) → get_up → walk_hurt (or the walk).
//   shove_fall  the shove lands on the chest, two quick steps back, the heels catch and slip, the butt lands, the roll onto the back, the
//               head bonks; ends EXACTLY on lie_hurt's first pose, 0.36 m back (shift) · chains to lie_hurt
//   get_up      from lie_hurt's first pose (switch to it at a lie_hurt loop seam: its clock crossing a multiple of 2 s): … (below)
//   walk_hurt   … (below)
// The root math is fall_back's (FB, LB, BUTT_ROOT above): the sit tips the root back about the heels, the roll turns it about the butt,
// and lying is LB. shove_fall runs it 0.36 m back (cMov.z += SF.M), so with the shift taken off at its end it is lie_hurt's first pose.
const SF = { M: -.36, t0: .4, tB: .75 };   // the stumble's travel (m), the sit's start, the butt's landing (the switch to the butt pivot)
CLIPS.push({ name: 'shove_fall', dur: 1.5, next: 'lie_hurt', blendIn: .05, blendOut: .3, shift: [0, SF.M],
  note: 'the shove lands on the chest 0–0.1 s (the upper body snaps back, the arms fly out) · two quick steps back 0.06–0.4 · the heels catch and slip forward, the knees give, the butt lands 0.4–0.75 · rolls onto the back 0.75–1.14, the feet kick up · the head bonks · settles to 1.5, a hand to the head; ends 0.36 m back (shift) on lie_hurt\'s first pose; chains to lie_hurt',
  glsl: /* glsl */`
  float hit = cOut(t, 0., .09), m = ${f(SF.M)} * cOut(t, .03, .42);
  float sit = cS(t, ${f(SF.t0)}, ${f(SF.tB)}), roll = cIn(t, ${f(SF.tB)}, 1.14), land = cS(t, 1.1, 1.45), give = cS(t, .3, .45);
  float d = .05 * cBump(t, 0., .25) + .04 * give * (1. - sit) + ${f(FB.d1)} * sit * (1. - roll) + .02 * cBump(t, .73, .85) * (1. - roll);
  if (t < ${f(SF.tB)}) { cPiv = vec3(0., 0., ${f(FB.heelZ)}); cRot.x = ${f(FB.th1)} * sit; cMov = vec3(0., -${f(FB.sink)} * sit, m); }   // the stumble, then the sit: tips back about the heels
  else { ${BUTT_ROOT(`${f(FB.th1)} + ${f(LB.pitch - FB.th1)} * roll`, 'd')} cMov.z += ${f(SF.M)}; }        // the roll: about the butt, 0.36 m back
  P.drop += d;
  // two steps back under the moving root (a foot planted at spot s sits at s − m): +x at 0.06–0.24, −x (the catch) at 0.2–0.38; then
  // both slide forward as the heels catch (fall_back's sit: the heels end at FB.heelZ), then onto LB's ankles as it rolls
  float zR = cStep(t, .06, .24, 0., ${f(SF.M + .06)}) - m, zL = cStep(t, .2, .38, 0., ${f(SF.M - .02)}) - m;
  cFoot(P, 1, mix(zR, ${f(FB.heelZ + .175 - .025 - .02)}, sit), cLift(t, .06, .24, .06), -.25 * cBump(t, .06, .26) + .08 * sit);
  cFoot(P, 0, mix(zL, ${f(FB.heelZ + .175)}, sit), cLift(t, .2, .38, .05), -.25 * cBump(t, .2, .4) + .08 * sit);
  P.ank = mix(P.ank, vec4(${LB.ank.map(f)}), cS(t, ${f(SF.tB)}, 1.15)); P.fp = mix(P.fp, vec2(${LB.fp.map(f)}), cS(t, ${f(SF.tB)}, 1.2));
  P.ank.xz += .14 * cBump(t, .8, 1.2);                                  // the feet kick up as the back hits
  // the upper body: snaps back on the shove, comes forward into the sit, then the roll's (fall_back's) and LB
  P.torso.x += -.42 * cBack(t, 0., .1) * (1. - cS(t, .18, .4)) - .2 * cS(t, .18, .4) * (1. - sit) + .25 * sit * (1. - roll) + ${f(LB.torso)} * roll;   // (stays back, off balance, into the sit)
  P.torso.z += .08 * sin(t * 13.) * (1. - cS(t, .3, .5)) * hit;
  P.head.x += .3 * cBump(t, 0., .22) - .1 * cS(t, .15, .35) * (1. - sit) + .25 * cBump(t, .68, .88) - .25 * cBump(t, 1.08, 1.22) + ${f(LB.head)} * roll;
  P.head.z -= .06 * sin(t * 13. - .6) * (1. - cS(t, .3, .5)) * hit;
  // the arms: flung forward and out, windmilling through the steps, then fall_back's balance (the sit) and flop (the roll), then LB
  float wm = .5 * sin(t * 22.) * cR(t, .08, .14) * (1. - cS(t, .32, .45));
  vec4 F = vec4(.75, 1.25, 0., .3), bal = vec4(1.2, .5, .1, .3), flop = vec4(.4, 1.1, 0., .2);
  vec4 aL = mix(mix(F + vec4(wm, 0., 0., 0.), bal, sit), flop, roll), aR = mix(mix(F - vec4(wm, 0., 0., 0.), bal, sit), flop, roll);
  cArm(P, 0, mix(aL, ${v4(LB.armL)}, land), hit);
  ${LB_R()} cArm(P, 1, mix(aR, hA, land), hE * land, hit);   // (the hand to the head: LB's)` });

// ── GET_UP: back on the feet from lie_hurt's first pose (LB), 3.3 s, ending in the plain stand 0.23 m ahead of where it lay (shift).
// THE RIG DECIDES THE ROUTE. The leg cloth wants the hip ≥ ~0.12 m above the ankle along the foot's up axis, so a flat-footed deep squat
// (the hip ~0.15 m off the ground) is out; a sitting body keeps its feet tilted with it (fall_back's sit, toes up). So: sit up about the
// butt (BUTT_ROOT, the butt fixed where lie_hurt left it) into GS, a sit with the knees up and the HEELS ON THE GROUND (GS.th is solved
// below so they land exactly at y 0); the hands plant behind the hips, elbows bent, and push; the root then ROCKS FORWARD ABOUT THE HEEL
// LINE (fixed in the world: the feet don't slide; the toes come down as it rocks), the chest folded over the knees; the body rises over
// the planted feet (the root slides forward 0.225 m while the feet slide back in its frame: planted under a moving root, CLIPS.md);
// a stagger, a dazed head shake, the arms shaken out; the plain stand from 3.15 s. The root's travel is the shift.
const GS = { d: .25, hz: .05 };   // the sit: the pelvis drop, the heels' body-frame z (cFoot z = hz + 0.175: the ankles 0.2 m ahead of the hips)
{ const Bz = -.1, By = .5 - FB.butt - GS.d, yAt = th => Bp[0] + Math.cos(th) * (0 - By) - Math.sin(th) * (GS.hz - Bz);   // the heel's world y under BUTT_ROOT(th, d)
  let a = -1.3, b = -.4; for (let i = 0; i < 60; i++) { const m = (a + b) / 2; if (yAt(m) * yAt(a) <= 0) b = m; else a = m; } GS.th = (a + b) / 2;
  GS.hw = Bp[1] + Math.sin(GS.th) * (0 - By) + Math.cos(GS.th) * (GS.hz - Bz);   // the heel line's world z (fixed while it rocks)
  GS.fz = GS.hz + .175; GS.shift = GS.hw - GS.hz + GS.fz; }   // the feet's cFoot z in the sit; where the body ends (body z of the old frame)
const GU = { tR: 1.2, D: 3.3 };   // the switch from the butt pivot to the heel line; the length
// (REACH: the arms forward and a little down, the fists out by the knees, clear of the chin. At pitch 1.6, level with the shoulders,
// both fists sat 8–9.5 cm up inside the chin from 1.7 to 2.3 s: the giant head hangs over anything held out in front of the chest)
const PUSH = { L: [-1.3, .7, 0, .1], R: [-1.3, .7, 0, .1], e: 1.45 }, REACH = [1., .65, 0, .3];
// the +x arm's way down from the head (LB) to PUSH.R, by the IK: PUSH.R's grip point and where its elbow points (the arm's forward
// kinematics, walk2.js), and a waypoint out at the side between them (chest rest frame)
const armFK = (sx, [p, r, y, tw], e) => { const c = Math.cos, s = Math.sin, rot = (v, ax, a) => { const [i, j] = ax === 'x' ? [1, 2] : ax === 'y' ? [2, 0] : [0, 1], o = [...v]; o[i] = c(a) * v[i] - s(a) * v[j]; o[j] = s(a) * v[i] + c(a) * v[j]; return o; };
  const R = v => rot(rot(rot(rot(v, 'y', -sx * tw), 'x', -p), 'z', sx * r), 'y', -sx * y), sh = [sx * SH.x, SH.y, 0];
  const g = R([sx * gx, hy + Math.cos(e) * gy + Math.sin(e) * gz, hz - Math.sin(e) * gy + Math.cos(e) * gz]).map((v, i) => v + sh[i]), el = R([sx * gx, ELB.y - SH.y, 0]).map((v, i) => v + sh[i]);
  const d = g.map((v, i) => v - sh[i]), u = d.map(v => v / Math.hypot(...d)), q = el.map((v, i) => v - sh[i]), k = q[0] * u[0] + q[1] * u[1] + q[2] * u[2];
  return { grip: g, pole: q.map((v, i) => v - k * u[i]) }; };
const DOWN_R = { ...armFK(1, PUSH.R, PUSH.e), via: [.75, .8, .05] }, f6 = v => (+v).toFixed(6);
CLIPS.push({ name: 'get_up', dur: GU.D, blendIn: .25, blendOut: .3, shift: [0, GS.shift],
  note: 'from lie_hurt\'s first pose (switch at a lie_hurt loop seam, its clock crossing a multiple of 2 s): a groan, the head lifts 0–0.35 s · sits up 0.25–1.0 (about the butt), the knees come up, the heels set down, the hands go down behind the hips · propped on them, elbows bent, 1.0–1.2 · rocks forward onto the feet 1.2–1.9 (about the heels), the hands lift off out and up, the arms reach forward, the chest over the knees · rises over the feet 1.8–2.45, a stagger · a dazed head shake, the arms shaken out 2.35–3.15 · the plain stand by 3.3; ends 0.23 m ahead (shift)',
  glsl: /* glsl */`
  float su = cS(t, .25, 1.), rk = cS(t, ${f(GU.tR)}, 1.9), ri = cS(t, 1.8, 2.45), fd = cS(t, .3, .95), ps = cBump(t, 1., 1.3);
  // the root: about the butt (LB → the sit), then about the heel line (the sit → upright), then the walk forward over the feet
  float d = ${f(GS.d)} * su * (1. - rk) + .14 * rk * (1. - ri);
  if (t < ${f(GU.tR)}) ${BUTT_ROOT(`${f(LB.pitch)} + ${f(GS.th - LB.pitch)} * su`, 'd')}
  else { cPiv = vec3(0., 0., ${f(GS.hz)}); cRot.x = ${f(GS.th)} * (1. - rk); cMov = vec3(0., 0., ${f(GS.hw - GS.hz)} + ${f(GS.fz)} * ri); }
  P.drop += d;
  // the feet: from LB's (in the air) down to the sit's spot (the heels on the line), planted; then planted under the moving root
  float fz = ${f(GS.fz)} * (1. - ri);
  float fl = .05 * cS(t, .22, .4) * (1. - cS(t, .88, 1.));                 // (held a hair off the ground until the root stops: the heels set down, no drag)
  cFoot(P, 0, fz, fl + .05 * cBump(t, 2.15, 2.4), 0.); cFoot(P, 1, fz, fl, 0.);
  P.ank = mix(vec4(${LB.ank.map(f)}), P.ank, fd); P.fp = mix(vec2(${LB.fp.map(f)}), P.fp, fd);
  P.ank.xz += vec2(.05, .07) * cBump(t, 0., .45) * (1. - fd);           // (the knees draw up with the groan)
  // the upper body: curls up to sit (the chest over the hips), folds over the knees to rock, rises; a stagger and the daze
  float dz = cS(t, 2.35, 2.5) * (1. - cS(t, 2.95, 3.15)), sh = sin(6.2831853 * (t - 2.35) / .32) * dz;
  P.torso.x += ${f(LB.torso)} * (1. - su) + .4 * su * (1. - rk) + .75 * rk * (1. - ri) + .12 * cBump(t, 2.3, 2.7);
  P.torso.z += .06 * sh + .05 * cBump(t, 2.1, 2.45);
  P.head.x += ${f(LB.head)} * (1. - su) + .15 * cBump(t, 0., .4) + .1 * su * (1. - rk) + .15 * ps - .25 * rk * (1. - ri) + .08 * dz;
  P.head.y += .35 * sh; P.head.z += .12 * sh + .08 * cBump(t, 2.1, 2.45);
  P.bodyX += .03 * cBump(t, 2.1, 2.45); P.pRoll += .06 * cBump(t, 2.1, 2.45);
  // the arms: LB → planted behind the hips, elbows bent ~83° → lifted off as it rocks, the elbows opening → reaching forward → hanging, shaken out
  // (planted 1.0–1.2 s: nothing on the arms moves while the root is still; the rock then lifts them off the ground, the elbows opening)
  vec4 aL = mix(mix(${v4(LB.armL)}, ${v4(PUSH.L)}, cS(t, .35, 1.)), ${v4(REACH)}, cS(t, 1.35, 1.75));
  // (the +x hand goes from the head down to the push behind the hips by the IK, its target on a curve out at the side (DOWN_R.via), the
  // elbow's pole turning from LB's to PUSH's: Euler angles blended straight across swept the fist through the face and the drawn-up
  // knees. At its end the IK is PUSH.R; from 0.9 s the arm is handed to PUSH.R's own angles, so from 1.0 s it is main's arm exactly)
  float us = cS(t, .2, 1.);
  ${ikv(1, `(1. - us) * (1. - us) * ${onHead(LB.handR)} + 2. * us * (1. - us) * vec3(${DOWN_R.via.map(f)}) + us * us * vec3(${DOWN_R.grip.map(f6)})`, `mix(vec3(${LB.poleR.map(f)}), vec3(${DOWN_R.pole.map(f6)}), us)`, 'u')}
  vec4 aR = mix(mix(uA, ${v4(PUSH.R)}, cS(t, .9, 1.)), ${v4(REACH)}, cS(t, 1.3, 1.7));
  aL.y += .6 * cBump(t, .3, 1.) + .5 * cBump(t, 1.2, 1.65); aR.y += .5 * cBump(t, 1.18, 1.6);   // (out wide on the way down, clear of the knees; out and up off the ground before they swing forward)
  float e = ${f(PUSH.e)} * cS(t, .35, 1.) * (1. - cS(t, 1.35, 1.6)) + .4 * cS(t, 1.4, 1.65) * (1. - ri);
  float k = 1. - cS(t, 2.2, 2.75), so = .25 * cBump(t, 2.5, 2.7) + .2 * cBump(t, 2.75, 2.95);
  cArm(P, 0, aL, e, k); cArm(P, 1, aR, mix(uE, e, cS(t, .9, 1.)), k);
  P.armR += vec2(so); P.armP += vec2(.1, -.1) * sh;` });

// ── WALK_HURT: a limp on the +x leg, holding the gut. 0.75 s loop, TRAVELLING at 0.8 m/s on its own legs: a STANDING-LEG clip (moving:
// false) with a speed, as the skate clips (CLIPS.md § Props, two more fields): the owner moves the walker at `speed` and keeps the walk
// weight at 0 (g.w = 0). The walk's keyed legs are symmetric (cLegK scales both), and a limp is the uneven step: so the feet are the
// clip's, planted under the moving body (a planted foot slides back in the body frame at exactly the speed). The good (−x) foot stands
// 75 % of the cycle and swings fast and high; the bad (+x) foot stands 35 %, short and quick, and swings slow and low, nearly stiff.
// On the bad foot the body dips, lurches over it and the head bobs; the +x hand clutches the belly (the elbow bent ~80°: the forearm
// across the front), the −x arm swings with the good leg. The pelvis's own dip at double support comes from the leg IK.
const WH = { D: .75, v: .8, L: { td: -.08, st: .75, z0: .23, h: .065 }, R: { td: .62, st: .35, z0: .12, h: .03 } };
for (const k of ['L', 'R']) WH[k].z1 = WH[k].z0 - WH.v * WH[k].st * WH.D;   // (the stance slides back at exactly the speed)
const limpFoot = (side, o) => /* glsl */`
  { float ph = mod(t / D - ${f(o.td)}, 1.), sw = cR(ph, ${f(o.st)}, 1.), st = 1. - step(${f(o.st)}, ph);
    float z = st > .5 ? mix(${f(o.z0)}, ${f(o.z1)}, ph / ${f(o.st)}) : mix(${f(o.z1)}, ${f(o.z0)}, smoothstep(0., 1., sw));
    float fp = st > .5 ? .15 * (1. - cS(ph, 0., ${f(o.st * .2)})) - .3 * cS(ph, ${f(o.st * .7)}, ${f(o.st)}) : mix(-.3, .15, cS(sw, .1, .85));
    cFoot(P, ${side}, z, ${f(o.h)} * sin(3.14159265 * sw) * (1. - st), fp); }`;
CLIPS.push({ name: 'walk_hurt', dur: WH.D, loop: true, speed: WH.v, blendIn: .3, blendOut: .3,
  note: 'a loop, TRAVELLING at 0.8 m/s on its own legs (moving: false + speed, as the skate clips: the owner moves it, walk weight 0): a limp on the +x leg (stands 35 % of the cycle, a dip and a lurch over it, the head bobs), the good leg swings fast; the +x hand clutches the belly, the −x arm swings',
  glsl: /* glsl */`
  ${limpFoot(0, WH.L)}
  ${limpFoot(1, WH.R)}
  float ph = mod(t / D, 1.), bad = cBump(ph, ${f(WH.R.td)}, ${f(WH.R.td + WH.R.st)}), good = cBump(mod(ph + .08, 1.), 0., .75);
  P.drop += .012 + .035 * bad; P.bodyX += .035 * bad - .02 * good; P.pRoll += -.05 * bad + .03 * good;
  P.torso.x += .14 + .06 * bad; P.torso.z += -.07 * bad + .02 * good; P.torso.y += .06 * sin(6.2831853 * ph);
  P.head.x += .06 + .1 * bad - .04 * good; P.head.z += .06 * bad; P.head.y -= .05 * sin(6.2831853 * ph);
  cArm(P, 1, vec4(.3, .15, .42, .54) + vec4(.04, 0., 0., 0.) * bad, 1.4, 1.);   // (the gut clutch: the forearm across the belly)
  float sw = sin(6.2831853 * (ph - .25));                              // (the −x arm against the −x leg: forward while that foot is back)
  cArm(P, 0, vec4(.05 + .28 * sw, .22, 0., .2), .25 + .15 * max(sw, 0.), 1.);` });
