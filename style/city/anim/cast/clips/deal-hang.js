// CLIPS · deal-hang (activities; MOVEMENT.md §6–§7A). The clips that keep a dealer (or anyone hanging out) busy at a spot:
//   deal_pace     paces 4 steps along the corner, a glance at the street, a two-pivot turn, 4 steps back, turns home (root motion, loops)
//   deal_lookout  scans the street, looks back over the shoulder, a double-take that snaps back and stares, settles (loop)
//   brush_pass    the hand-off: both walkers play it face to face; each +x hand comes out low and in to the midline (a low dap), the
//                 palm opens and closes on the other's, the hand goes to the pocket (0.6 s one-shot, a pair with itself)
//   lean_wall     back to a wall, the +x foot planted up behind on it; shifts, re-plants the foot, a glance, a hand to the face (loop)
//   sit_stoop     sat on a kerb or a step (the seat 0.2 m over the feet), hunched over the knees, looking around (loop)
//   sit_bench     sat on a bench (the seat at the hip, y 0.5: the city's benches), the +x arm out along the backrest, feet dangling (loop)
// Every loop is seamless at D (its rhythms divide D; no cBreathe, whose 3.6 s breath would pop at the wrap) and starts and ends in a
// pose that blends from the bare stand. The big head (x ±0.4 m from y 0.95 up): no arm rises past ~10° over the horizontal at the
// sides. Arms are [pitch fwd, roll out, yaw in, twist in] (rad) + the elbow (cArm's 5-argument form); torso / head: x = pitch forward
// (head: look down), y = yaw (+: the front turns to +x), z = roll. Arm angles are relative to the CHEST: leaning it forward by L turns a
// forward arm down by L. The head is posed relative to the torso: a clip that turns the torso by ty and wants the eyes at hy writes
// head.y += hy − ty.
// THE ELBOW (the elbow-deal-hang agent, 2026-10-09; ../ELBOW.md): these six were first authored with one-piece arms (a straight arm
// pitched in to the belly for "hands in the pocket", a straight arm hung over the knees). They now bend the elbow. Every duration,
// root move, step, foot, drop, chest and head track, pair and speed is as before: only the arms changed. The poses were
// found by a search through the real shader (transform feedback: the forearm and hand against the chest, its flank, the core, the
// head and the legs, on the bare body, a slim tee and the Bubble Goose), then looked at on a hoodie:
//   · THE POCKET = [.54, .38, .32, .5], elbow 0.85: the hoodie's front pocket, the elbows bent and out at the sides, the forearms in
//     to the belly, the hands just in front of it (chest frame x ±0.16, y 0.63, z 0.37). The toon forearm can't bring them closer: it
//     then cuts the chest (the talk and robbery agents' finding too); this one keeps every forearm out of the body's core.
//   · THE CHIN = [.6, .1, .25, .2], elbow 1.4: the forearm up, the hand under the chin (lean_wall's rub).
//   · SAT, FOREARMS ON THE KNEES = [1, .2, 0, .6], elbow 0.9 (the stoop; the bench's lean forward [.95, .25, 0, .8], elbow 0.75): the
//     upper arms down over the thighs, the forearms hung forward from the knees, the hands loose in front of them. No hand ever
//     touches a leg: a hand on the leg fails the hand gate, so they hang just clear.
const f = v => (+v).toFixed(4), v4 = a => `vec4(${a.map(f).join(', ')})`;
const PK = v4([.54, .38, .32, .5]), PK_E = f(.85);   // the hoodie's front pocket
export const CLIPS = [
  { name: 'deal_pace', dur: 6, loop: true, blendIn: .3, blendOut: .3,
    note: 'a loop with its own root motion (the walker stays put; start it at t 0 and stop it at a wrap, the body is 1 m out and turned round mid-loop): 4 steps out along +z 0–1.78 s (0.9 m, a glance back at the buildings) · stops, looks to the street (+x) · a two-pivot right turn 2.5–3.3 (on the +x foot, then the −x) · 4 steps back 3.3–5.08 (a look at the street, now on its left, and one over the shoulder) · turns home 5.2–6. Footprint: x ±0.13 m, z 0 → 1.15 m. The +x hand stays in the hoodie pocket (the elbow out), the −x arm swings loose with a soft elbow; at the stop (1.75–2.7) it goes in the pocket too',
    glsl: /* glsl */`
  const float HX = .125, L = .9, H = 1.5707963;
  // the walk (out 0–1.78 s, back 3.3–5.08 s): four steps, −x to .3, +x to .6, −x to .9, +x closes to .9 (the feet's progress, m);
  // the root rides between the feet at an even pace through each step, so a planted foot sits at its spot − the root
  float ws = t < 3.3 ? t : t - 3.3;
  float zL = .3 * cS(ws, .05, .48) + .6 * cS(ws, .93, 1.38), zR = .6 * cS(ws, .48, .93) + .3 * cS(ws, 1.38, 1.78);
  float r = .5 * (.3 * cR(ws, .05, .48) + .6 * cR(ws, .93, 1.38) + .6 * cR(ws, .48, .93) + .3 * cR(ws, 1.38, 1.78));
  float lL = cLift(ws, .05, .48, .045) + cLift(ws, .93, 1.38, .05), lR = cLift(ws, .48, .93, .05) + cLift(ws, 1.38, 1.78, .035);
  float fL = -.32 * (cBump(ws, -.04, .2) + cBump(ws, .84, 1.08)) + .22 * (cBump(ws, .36, .54) + cBump(ws, 1.25, 1.44));   // heel off, toe up at the strike
  float fR = -.32 * (cBump(ws, .39, .63) + cBump(ws, 1.29, 1.5)) + .22 * (cBump(ws, .8, .98) + cBump(ws, 1.66, 1.82));
  float wk = cS(ws, 0., .2) * (1. - cS(ws, 1.6, 1.9));   // walking (0 at the ends)
  // the turns: two 90° pivots each, on the +x foot (the −x one swings round), then on the −x foot (the +x one swings). Pivoting on a
  // planted foot keeps it on its spot: the root turns about it (walker frame, x / z; R(a) takes (x, z) to (x cos a + z sin a, z cos a − x sin a))
  // (the ground point of a flat foot is A_HIPZ ahead of its cFoot z: the pivots are there)
  const float Z0 = A_HIPZ, ZB = 2. * HX + 2. * Z0;   // ZB: where the walk back ends (each turn carries the root on by 2·HX + 2·Z0)
  float th = 0.; vec2 T = vec2(0., r);
  if (t >= 2.5 && t < 2.9) { float f = H * cS(t, 2.5, 2.9), c = cos(f), s = sin(f); th = f; T = vec2(HX - c * HX - s * Z0, L + Z0 + s * HX - c * Z0); }
  else if (t >= 2.9 && t < 3.3) { float f = H * cS(t, 2.9, 3.3), c = cos(f), s = sin(f); th = H + f; T = vec2(HX - c * Z0 - s * HX, L + Z0 + 2. * HX + s * Z0 - c * HX); }
  else if (t >= 3.3 && t < 5.2) { th = 2. * H; T = vec2(0., L + ZB - r); }
  else if (t >= 5.2 && t < 5.6) { float f = H * cS(t, 5.2, 5.6), c = cos(f), s = sin(f); th = 2. * H + f; T = vec2(c * HX + s * Z0 - HX, ZB - Z0 - s * HX + c * Z0); }
  else if (t >= 5.6) { float f = H * cS(t, 5.6, 6.), c = cos(f), s = sin(f); th = 3. * H + f; T = vec2(c * Z0 + s * HX - HX, ZB - Z0 - 2. * HX - s * Z0 + c * HX); }
  cRot.y = th; cMov = vec3(T.x, 0., T.y);
  // the feet: walking, or pivoting (the planted one on its ball, the other lifted round with the body and set down beside it)
  float pa = cBump(t, 2.5, 2.9) + cBump(t, 5.2, 5.6), pb = cBump(t, 2.9, 3.3) + cBump(t, 5.6, 6.);
  bool walk = t < 2.5 || (t >= 3.3 && t < 5.2);
  if (walk) { cFoot(P, 0, zL - r, lL, fL); cFoot(P, 1, zR - r, lR, fR); }
  else { cFoot(P, 0, .05 * pa, .05 * pa, -.12 * pb); cFoot(P, 1, .05 * pb, .045 * pb, -.12 * pa); }
  // the body: a slouch, a small lean into the walk, the shoulders rolling with the steps; the head leads each turn
  float sw = clamp((zR - zL) / .45, -1., 1.) * (walk ? 1. : 0.);   // +: the +x foot ahead (the −x arm swings forward)
  P.torso.x += .05 + .04 * wk; P.head.x += .04 - .03 * wk;
  P.torso.y += .1 * sw * wk; P.torso.z += .035 * sw * wk; P.head.z -= .025 * sw * wk;
  float hy = -.55 * cBump(t, .6, 1.25)                                          // out: a glance back at the buildings (−x)
    + .95 * (cS(t, 1.75, 2.0) - cS(t, 2.3, 2.55)) + .45 * cBump(t, 2.4, 3.1)     // stops, looks down the street (+x); leads the turn
    - .9 * (cS(t, 3.85, 4.05) - cS(t, 4.45, 4.65))                               // back: the street is on its left now
    + 1.1 * cBump(t, 4.75, 5.15) + .45 * cBump(t, 5.15, 5.85);                   // over the shoulder (the corner behind); leads the turn
  float ty = .3 * hy;
  P.torso.y += ty; P.head.y += hy - ty; P.head.x -= .06 * cBump(t, 1.8, 2.5);   // (chin up at the street)
  P.drop += .006 * wk * (.5 + .5 * cos(6.2832 * (zL + zR) / .6)) + .01 * (pa + pb);
  // the arms: the +x hand in the hoodie's front pocket, the elbow out (bobbing with the steps); the −x arm loose, swinging opposite
  // the feet, the elbow soft (more at the front of the swing). At the stop it goes in the pocket too, and comes out for the turn
  float fr = max(sw, 0.) * wk, pk = cS(t, 1.75, 2.05) * (1. - cS(t, 2.4, 2.7));
  cArm(P, 1, ${PK} + vec4(.03 * sw, 0., 0., 0.), ${PK_E} + .06 * sw, 1.);
  cArm(P, 0, mix(vec4(.07 + .3 * sw * wk + .08 * (pa - pb), .2 + .04 * abs(sw), .0, .1), ${PK}, pk), mix(.15 + .35 * fr, ${PK_E}, pk), 1.);
  float br = sin(6.2832 * t / 3.);   // the breath (two a loop)
  P.torso.x += .02 * br; P.head.x -= .01 * br;` },

  { name: 'deal_lookout', dur: 7, loop: true, blendIn: .3, blendOut: .3,
    note: 'a loop, hands in the hoodie pocket (the elbows bent and out): scans the street, left 0.3–0.9 s, a slow sweep right 1.2–2.0 · looks back over the +x shoulder 2.1–3.0 (the weight on the −x foot, the +x heel up) · a casual glance left 3.5, away, then SNAPS back 4.0 (the double-take: leans in, the −x hand comes out and hangs ready, the elbow soft) and stares to 5.0 · settles 5.0–5.7 (an exhale: the hands push down in the pocket, the elbows open) · a weight shift and a look down 5.7–7',
    glsl: /* glsl */`
  // where the eyes are (hy, rad, +: to +x) and how much the chest follows (ty); head.y is relative to the chest
  float hy = -.75 * cS(t, .3, .9) + 1.5 * cS(t, 1.2, 2.) + .9 * cS(t, 2.1, 2.6) - 1.65 * cS(t, 3., 3.4)
    - .45 * cS(t, 3.5, 3.75) + .4 * cS(t, 3.75, 3.95) - .8 * cBack(t, 4., 4.12) + .85 * cS(t, 5., 5.7);
  float sh = cS(t, 2.1, 2.6) * (1. - cS(t, 3., 3.4)), dt = cOut(t, 4., 4.12) * (1. - cS(t, 5., 5.7));   // over the shoulder · the double-take
  float ty = .22 * (hy - .9 * sh + .8 * dt) + .5 * sh - .3 * dt;
  P.torso.y += ty; P.head.y += hy - ty;
  P.head.x += -.06 * cS(t, .3, .9) * (1. - cS(t, 2., 2.4)) - .05 * dt + .2 * cBump(t, 5.9, 6.7) - .12 * cBump(t, 3.98, 4.16);   // chin up to scan; the jolt (the head jerks up); a look down
  P.torso.x += .1 * dt - .08 * cBump(t, 3.98, 4.14) + .03 * cBump(t, 5.0, 5.8) - .04 * cBump(t, 5.2, 6.0);   // leans in to stare; the exhale drops the chest, then it lifts
  P.drop += .018 * cBump(t, 3.98, 4.3) + .012 * cBump(t, 5.1, 5.9);
  // the weight: a slow shift (once round the loop), onto the −x foot for the look back; the +x heel comes up there
  float ws = .7 * sin(6.2832 * t / 7.) - .8 * sh + .25 * sin(6.2832 * t / 3.5);
  P.bodyX += .03 * ws; P.pRoll += .085 * ws; P.torso.z -= .04 * ws; P.head.z += .05 * ws;
  cFoot(P, 1, 0., 0., -.22 * sh);
  // the arms: both hands in the hoodie's front pocket, the elbows out; on the double-take the −x hand comes out and hangs ready (the
  // elbow soft, the forearm a little forward), back in as it settles; the exhale pushes both hands down in the pocket (the elbows open)
  vec4 K = ${PK}, R = vec4(.3, .16, .05, .35);
  float ex = cBump(t, 5.0, 5.9), ot = cS(t, 4.02, 4.25) * (1. - cS(t, 5.3, 5.8));
  cArm(P, 1, K + vec4(.04 * sin(6.2832 * t / 3.5) - .06 * ex, 0., 0., 0.), ${PK_E} - .25 * ex, 1.);
  cArm(P, 0, mix(K - vec4(.06 * ex, 0., 0., 0.), R, ot), mix(${PK_E} - .25 * ex, .45, ot), 1.);
  float br = sin(6.2832 * t / 3.5);
  P.torso.x += .025 * br; P.head.x -= .01 * br; P.drop += .004 * (.5 - .5 * br);` },

  { name: 'brush_pass', dur: .6, blendIn: .08, blendOut: .3,
    pair: { with: 'brush_pass', gap: 1.02, delay: 0 },
    note: 'a pair with itself, face to face (gap 1.02 m: the heads stick out 0.4 m each and stop it closing; the low hands just meet at the midline): each +x hand comes out low (hip height), the forearm leading (the elbow bent, then opening: nearly straight at the contact), and in to the midline, palm in, 0–0.18 s · the palm opens (turns up) and closes 0.18–0.38 · the elbow bends and the hand takes it in to the hoodie\'s front pocket 0.38–0.58. The shoulder leads in, the knees dip, the eyes stay on the street. Ends hand in the hoodie pocket (blends out)',
    glsl: /* glsl */`
  // the hand swings out first and only crosses in once it is in front of the thigh, so it never sweeps through the leg. The forearm
  // leads (the elbow bent as the hand comes up off the thigh), the elbow opens into the dap (nearly straight at the contact: the reach),
  // and bends again to take the thing in to the hoodie's front pocket
  float o = cOut(t, 0., .16), b = cS(t, .38, .58), yi = cS(t, .07, .19);
  vec4 A = vec4(1.08, .04, 0., -.15);          // out low, palm in (a low dap)
  vec4 a = mix(vec4(.04, .06, 0., 0.), A, o); a.z += .58 * yi; a.y -= .04 * yi;
  a.w -= .75 * cBump(t, .18, .38);             // the palm opens (turns up) and closes
  a.x += .07 * cBump(t, .16, .3);              // the press
  float e = .7 * cS(t, 0., .07) * (1. - cS(t, .07, .17)) + .06 * cS(t, 0., .12);
  cArm(P, 1, mix(a, ${PK}, b), mix(e, ${PK_E}, b), 1.);
  cArm(P, 0, vec4(-.12 * cBump(t, 0., .45), .08, 0., .2), .1 + .25 * cBump(t, 0., .5), 1.);
  float in_ = cOut(t, 0., .18) * (1. - cS(t, .36, .6));
  // the shoulder leads; the head stays square to the partner and only glances off (a turned head pokes a corner 0.1 m further out)
  P.torso.y -= .2 * in_; P.torso.x += .04 * in_; P.head.y += .2 * in_ + .1 * cBump(t, .05, .58); P.head.x -= .07 * in_;
  P.drop += .022 * in_; P.bodyX += .012 * in_; P.pRoll += .03 * in_;` },

  { name: 'lean_wall', dur: 8, loop: true, blendIn: .4, blendOut: .4,
    note: 'a loop, the back to a wall (the wall ~0.2 m behind the walker\'s spot): the −x foot planted forward, the +x foot drawn back on its toe against the wall, knee forward (a sole flat on the wall tears these legs); hands in the hoodie pocket, the elbows out · a look along the street (+x) 0.5–2 s · the +x foot comes down flat and goes back up 2.3–3.2 · a quick glance left 3.6–4.4 · the +x hand up to the chin, the forearm up (rubs it) 4.9–6.3 · a shoulder roll (the elbows lift) and back 6.5–8',
    glsl: /* glsl */`
  // the lean: the feet forward of the hips, the chest back against the wall, the head level
  // (the foot can't go flat on the wall behind: past ~0.5 rad of foot pitch the leg's cloth rings shear apart, so the +x foot is
  // drawn back to the wall on its toe, heel up, the knee forward)
  float rp = cS(t, 2.3, 2.6) * (1. - cS(t, 2.75, 3.2));        // the +x foot comes down flat and goes back up on its toe
  cFoot(P, 0, .14, 0., 0.);
  cFoot(P, 1, mix(-.07, .05, rp), mix(.075, .0, rp) + .02 * cBump(t, 2.3, 3.2), mix(-.42, 0., rp));
  cRot.x = -.06; cPiv = vec3(0., 0., .14 + A_HIPZ);            // the whole body inclines back from the planted foot, like a plank
  P.fp.x -= .06; P.torso.x -= .12; P.head.x += .16;
  // a slow sway and the shifts; the head's looks
  float ws = .5 * sin(6.2832 * t / 8.) + .3 * sin(6.2832 * t / 4.) + .4 * rp;
  P.bodyX -= .015 * ws; P.pRoll -= .05 * ws; P.torso.z += .025 * ws; P.head.z -= .03 * ws;
  float fc = cS(t, 4.9, 5.3) * (1. - cS(t, 5.9, 6.3));          // the hand to the face
  float hy = .75 * cS(t, .5, 1.) * (1. - cS(t, 1.6, 2.)) - .8 * cS(t, 3.6, 3.75) * (1. - cS(t, 4.1, 4.4)) + .2 * fc;
  P.head.y += hy * .8; P.torso.y += hy * .2; P.head.x += .1 * fc - .05 * cBump(t, .5, 2.) + .12 * cBump(t, 2.2, 3.1);   // (watches the foot)
  float roll = cBump(t, 6.5, 7.3); P.torso.z += .06 * roll; P.head.z -= .1 * roll; P.torso.x -= .03 * roll; P.drop += .01 * roll;
  // the arms: hands in the hoodie's front pocket, the elbows out (the shoulder roll lifts them); the +x one comes up to the chin, the
  // forearm up, and rubs it
  vec4 K = ${PK}, F = vec4(.6, .1, .25, .2);
  float rb = sin(t * 20.) * fc;
  cArm(P, 0, K + vec4(-.05 * roll, .08 * roll, 0., 0.), ${PK_E} + .15 * roll, 1.);
  cArm(P, 1, mix(K, F, fc) + vec4(.03 * rb, .03 * roll, .03 * rb, 0.), mix(${PK_E}, 1.4, fc) + .06 * rb, 1.);
  float br = sin(6.2832 * t / 4.);
  P.torso.x += .025 * br; P.head.x -= .01 * br; P.drop += .004 * (.5 - .5 * br);` },

  { name: 'sit_stoop', dur: 7, loop: true, blendIn: .5, blendOut: .5,
    note: 'a loop, sat on a kerb or a step: the seat 0.2 m over the feet (the city\'s kerb, SIDE 0.2: the walker\'s spot in the gutter, facing out), the feet forward, hunched over the knees, the forearms on them (the elbows bent), the hands loose in front · looks left, then right up the street 0.4–2.6 s · head down, the hands come together and rub 2.9–4.1 · sits up (the hands on the knees, at the sides), looks back over the +x shoulder 4.4–5.6 · back down over the knees, a foot tap 5.8–7',
    glsl: /* glsl */`
  float up = cS(t, 4.2, 4.6) * (1. - cS(t, 5.6, 6.1)), dn = cS(t, 2.8, 3.1) * (1. - cS(t, 3.9, 4.2));
  cFoot(P, 0, .2, 0., 0.); cFoot(P, 1, .22, .015 * cBump(t, 6.1, 6.3) + .015 * cBump(t, 6.35, 6.55), .14 * (cBump(t, 6.1, 6.3) + cBump(t, 6.35, 6.55)));   // (a heel-down toe tap: the hands hang over the toes)
  P.drop += .23;
  P.torso.x += .42 - .3 * up + .08 * dn; P.head.x += -.34 + .26 * up + .32 * dn;
  float hy = -.7 * cS(t, .4, .9) + 1.4 * cS(t, 1.4, 2.0) - .7 * cS(t, 2.3, 2.7) + 1.1 * cS(t, 4.5, 4.9) - 1.1 * cS(t, 5.4, 5.8);
  float ty = .25 * hy + .2 * up * cS(t, 4.5, 4.9);
  P.torso.y += ty; P.head.y += hy - ty;
  float ws = .5 * sin(6.2832 * t / 7.); P.torso.z += .03 * ws; P.head.z -= .03 * ws;
  // the arms: the forearms on the knees (the upper arms down over the thighs, the elbows bent), the hands loose in front of them; head
  // down, the hands come together and rub; sat up, they rest on the knees at the sides, out wide (the hands hang just clear of the
  // legs and the shoes, never on them: a hand on the leg fails the hand gate; [.6, .3, 0, .6] brushed a high-top's collar as the chest
  // turned to look back)
  vec4 K = vec4(1., .2, 0., .6), I = vec4(1.05, .1, .14, .6), U = vec4(.55, .4, 0., .4);
  vec4 a = mix(mix(K, I, dn), U, up); float e = .9;
  float rub = sin(t * 18.) * dn;   // (the hands slide past each other: up and down, in and out)
  cArm(P, 0, a + vec4(.04 * rub, 0., .03 * rub, 0.), e + .1 * rub, 1.); cArm(P, 1, a - vec4(.04 * rub, 0., .03 * rub, 0.), e - .1 * rub, 1.);
  float br = sin(6.2832 * t / 3.5);
  P.torso.x += .025 * br; P.head.x -= .01 * br;` },

  { name: 'sit_bench', dur: 8, loop: true, blendIn: .5, blendOut: .5,
    note: 'a loop, perched on a bench seat (these legs cannot render a level thigh, so it is the seat\'s front edge: the hip joint at y 0.47 over the walker\'s spot, the seat contact ~0.40, the thighs sloping ~35° down, the shins hanging, the toes ~6 cm off the ground; on the city\'s 0.5 m benches raise the spot ~0.1 m): leaning back, the +x arm out and back along the backrest (the forearm draped over it), the −x hand on the thigh · the feet swing 0–2 s · looks round along the arm 2.2–3.4 · leans forward, the forearms on the knees, to watch something 3.8–5.2 · back, the backrest hand taps (off the wrist and the elbow) 5.4–6.6 · a look left, the feet swing again 6.8–8',
    glsl: /* glsl */`
  float fw = cS(t, 3.8, 4.2) * (1. - cS(t, 4.9, 5.4));          // leaning forward
  float kick = 1. - cS(t, 1.6, 2.2) + cS(t, 7.2, 7.9);           // the dangling feet swing (1 Hz, out of step)
  float k1 = sin(6.2832 * t) * kick, k2 = sin(6.2832 * t + 2.4) * kick;
  cFoot(P, 0, .17 + .05 * k1 - .03 * fw, .06 + .02 * k1, -.18 + .12 * k1); cFoot(P, 1, .19 + .05 * k2 - .03 * fw, .06 + .02 * k2, -.18 + .12 * k2);
  P.drop += .03;
  P.torso.x += -.2 + .52 * fw; P.head.x += .14 - .34 * fw;
  float hy = .95 * cS(t, 2.2, 2.6) * (1. - cS(t, 3.0, 3.4)) - .7 * cS(t, 6.8, 7.2) * (1. - cS(t, 7.5, 7.9)) + .3 * fw * sin(6.2832 * t / 2.);
  float ty = .25 * hy; P.torso.y += ty; P.head.y += hy - ty;
  float ws = .5 * sin(6.2832 * t / 8.); P.torso.z += .025 * ws; P.head.z -= .03 * ws;
  // the arms: +x out and back along the backrest (just under level: the head is in the way above), the −x hand on the thigh;
  // leaning forward, both hang over the knees
  // (the elbows: the backrest arm's upper arm back along the rail, the forearm draped over it, the hand tapping off the wrist and the
  // elbow; the thigh hand's elbow relaxed; leaning forward, the forearms on the knees, the hands loose in front)
  vec4 B = vec4(-.7, 1.2, -.2, .5), H = vec4(.66, .1, .14, .4), F = vec4(.95, .25, 0., .8);
  float tap = pow(max(0., sin(6.2832 * t * 2.5)), 3.) * cS(t, 5.4, 5.6) * (1. - cS(t, 6.4, 6.6));
  cArm(P, 1, mix(B, F, fw) + vec4(0., -.05 * tap, 0., 0.), mix(.5 + .25 * tap, .75, fw), 1.);
  cArm(P, 0, mix(H, F, fw), mix(.3, .75, fw), 1.);
  float br = sin(6.2832 * t / 4.);
  P.torso.x += .025 * br; P.head.x -= .01 * br;` },
];
