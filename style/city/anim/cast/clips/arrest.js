// CLIPS · arrest (events; MOVEMENT.md §7C; the arrest agent, 2026-10-08). An arrest, a scuffle and a run, on the cast's ELBOW (../ELBOW.md):
//   cuff_apply      the cop (one-shot 2.61 s, pair → cuffed_idle, the suspect's BACK to the cop): steps in, takes the wrists, CLICK at 1.31 s,
//                   a beat, steps back. Ends 0.06 m on (shift)
//   cuffed_idle     loop 6 s · wrists together behind the back (the elbows bent), head down, weight shifts, a glance over each shoulder, a tug
//   cuffed_walk     moving loop at 0.7 m/s (stride ×0.95): the same locked arms, short steps, hunched, the chest rolling over each foot, a glance
//   get_in_car      the suspect (one-shot 2.01 s + hold, pair → guide_in_car): turns to the door on its LEFT, ducks under the cop's hand,
//                   steps in and sinks low; held low and turned (see THE CITY)
//   guide_in_car    the cop (one-shot 2.21 s): a hand on the suspect's head (the door side), the other on the cuffs; then swings the door shut
//   scuffle_pair    loop 2.8 s (pair → scuffle_partner, face to face): re-grip, a SHOVE (lunge), takes the push back, then they wrestle
//   scuffle_partner loop 2.8 s: shoved, stumbles back two steps (arms flung), charges back in, the wrestle
//   flee_run        moving loop at 3.3 m/s (stride ×2): a panicked sprint, both arms pumping with the elbows at ~78°, a 0.3 lean, a look back
// THE ELBOW'S FIRST JOBS (clips/index.js 5-argument cArm / cArms; the bend comes up in the arm's plane, the twist picks the fold):
//   · CUFFS = [pitch −1.35, roll .2, yaw .2, twist 2.1], elbow 0.9 (52°): the twist turns the fold inward-and-back. Found by a search
//     through the real shader (transform feedback: the forearm and hand against the chest, pelvis, legs and head; the two hands' gap) on
//     the bare body, the tall tee, the baby tee, the tank, both hoodies: 0 forearm-on-torso crossings, 0 in the head, the fists 0.2 m apart
//     centre to centre (touching) at the small of the back (the chest's frame: y 0.75, 0.39 behind). "Behind the seat" is out of reach on
//     this rig: the arm is 0.53 m from the shoulder to the fingertips, and with the hands that low they stay ≥ 0.3 m apart and cut the
//     shell (measured); hands at mid-back also reach the head's overhang (the head sits 0.35 behind the neck), so they stay at ~0.75.
//   · PUFFERS (where the elbow didn't save the pose): a puffer's back is 0.25 m behind the shoulder line and its padded forearm 0.3 m
//     deep, so with the hands together the sleeves press into the jacket's back. Over all 76 tops (53 agent, 23 NPC): 55 clean; 11
//     jackets graze (8 crossings a frame); the 10 padded shells press in (100–200 forearm-on-shell crossings a frame: the puffers, furs,
//     minks, the snorkel, the mirrorball); 0 in the body core on every top. The best searched pose still had ≥ 100 and put the hands
//     at the neck. It reads as sleeves squashed into a puffy jacket: slime's call.
//   · flee_run: elbows 1.32–1.40 (76–80°), the arms rolled out 0.3 and twisted out 0.3 (the fold leans a hair outward): 0 forearm-on-torso
//     crossings on tees, hoodies and puffers, and the shell's flank brushed less than the resting arm's own (the arm's inner column).
//     The front fist stops under the chin: a higher pump puts it in the head. The look back shortens the pump (the head's corner swings).
//   · The cop's arms (cuff_apply, guide_in_car) swing in only once they are up and out in front, never through the belly. Any arm
//     raised forward grazes a tee's or hoodie's chest corner (the arm's inner column, ~32 crossings a frame for a plain forward arm):
//     cuff_apply sits at that baseline (17–33 a frame), 0 in the core or the head. guide_in_car's raised hand grazes the underside of
//     its own head at the elbow ring on sleeved tops (≤ 6 a frame, under the head; up to 37 on puffers).
// THE BIG HEADS set every gap (x ±0.5, z −0.35…+0.45 from y 0.9 up): two heads front to back need ≥ 0.8 m, face to face ≥ 0.9, side by
// side 1.0. A hand reaches ~0.5 m from the shoulder, so a hand meets the other walker only at its hands or its head's near edge. Every
// pair here was checked frame by frame through the real shader for head↔head, hand↔head and body↔body crossings (0 head↔head).
// THE CITY (what the integration must do; ids are build-time, wire by NAME):
//   · CUFFED is a state: from cuff_apply's click (1.31 s) the suspect is cuffed. Play cuffed_idle standing, cuffed_walk moving (owner moves
//     it at 0.7 m/s), get_in_car at the car. Switch between them with playClip straight (no stopClip between): the arms are the same CUFF
//     pose in all four, so nothing pops; the slot blends nothing between clips (CLIPS.md).
//   · cuff_apply's pair is BACK-TO-FRONT (pair.face 'away', a field this file adds): the suspect stands gap 1.22 m in front of the cop
//     FACING THE SAME WAY (its back to the cop) and starts cuffed_idle 0.45 s after the cop's start (its hands reach its back as the cop's
//     arrive). The lab's clip scene turns every partner to face its lead, so there the suspect faces the cop; the sheets turn it round
//     (lab.js clipActors would need `yaw + (p.face === 'away' ? 0 : Math.PI)`; not changed here). Exclaim/sound "click" at 1.31 s.
//   · get_in_car / guide_in_car: start both on the same frame, the cop 1.2 m in front of the suspect, facing it; the car's open rear door
//     is on the SUSPECT'S LEFT (the cop's right), its opening ~0.5 m to the suspect's −x. The suspect turns 90° to its left INSIDE the clip
//     (its walker's yaw does not change) and ends low, 0.45 m to its −x and 0.25 m toward the cop (shift [−0.45, 0.25]: move the walker
//     there on the end frame, keep its yaw). Then hide it (or close the door on it) while it holds, and clearClip/free it. The cop swings
//     the door shut at 1.6–2.05 s (close the door then); it ends 0.08 m on (shift).
//   · scuffle: both walkers face to face at gap 1.2, playClip both on the same frame (same t), stop both on the same frame. The shove lands
//     at 0.2 s of each 2.8 s round; stop near t mod 2.8 ≈ 0.6 to part them (the partner is 0.3 m back), then hit_stumble_back / flee_run.
//   · flee_run: moving, the owner moves it at 3.3 m/s; one round is 3 strides (the look back once a round).
//   · Shift clips here end off the 1/60 s grid (2.61, 2.01, 2.21 s): stepClip's clock (a float sum) can reach dur a hair late while the
//     shader's t ≥ D is already true, popping the body one frame (seen on turnstile in the lab; index.js, not this file).
// Arms are [pitch fwd, roll out, yaw in, twist in] (rad) + the elbow; torso / head: x = pitch forward (head: look down), y = yaw (+: the
// front turns to +x), z = roll. Feet: cFoot (body-frame z of the foot's ground point; a planted foot under a moving root sits at its spot − the root).
const f = v => (+v).toFixed(4), v4 = a => `vec4(${a.map(f).join(', ')})`;
const CUFF = [-1.35, .2, .2, 2.1], CUFF_E = .9;
const CUFFS = `${v4(CUFF)}, ${f(CUFF_E)}`;
export const CLIPS = [
  { name: 'cuff_apply', dur: 2.61, blendIn: .15, blendOut: .35, shift: [0, .06],
    pair: { with: 'cuffed_idle', gap: 1.22, delay: .45, face: 'away' },
    note: 'the cop, behind the suspect (pair.face away): steps in 0.2 m 0.05–0.7 s, leans in (the head kept level), the arms up then in to the wrists 0.3–0.85 · holds them · CLICK 1.28–1.34 (a squeeze and a jolt) · a beat · lets go, steps back 0.14 m 1.7–2.3 · ends 0.06 m on (shift)',
    glsl: /* glsl */`
  // the root: steps in 0.2 m (the −x foot, then the +x foot closes), back 0.14 m at the end
  float m = .14 * cS(t, .05, .45) + .06 * cS(t, .4, .7) - .14 * cS(t, 1.75, 2.15); cMov.z = m;
  cFoot(P, 0, cStep(t, .05, .45, 0., .2) - cStep(t, 1.95, 2.3, 0., .14) - m, cLift(t, .05, .45, .05) + cLift(t, 1.95, 2.3, .04), 0.);
  cFoot(P, 1, cStep(t, .4, .7, 0., .2) - cStep(t, 1.75, 2.1, 0., .14) - m, cLift(t, .4, .7, .04) + cLift(t, 1.75, 2.1, .045), 0.);
  float reach = cS(t, .3, .8) * (1. - cS(t, 1.7, 2.1)), close = cS(t, .55, .85) * (1. - cS(t, 1.65, 1.85)), click = cOut(t, 1.28, 1.34) * (1. - cS(t, 1.34, 1.5));
  P.torso.x += .24 * reach + .03 * click; P.head.x += -.38 * reach - .03 * click;
  P.drop += .03 * reach;
  // the arms: up and forward first, then in to the wrists (they only close once they are out in front: never through the belly)
  vec4 G = vec4(1.45, .15, 0., 0.), H = vec4(.02, .1, 0., .1);
  vec4 a = mix(H, G, reach); a.z += .44 * close + .06 * click; a.x -= .04 * click;
  cArms(P, a, .4 * reach, 1.);
  cBreathe(P, t, cS(t, 2.1, 2.6));` },

  { name: 'cuffed_idle', dur: 6, loop: true, blendIn: .35, blendOut: .35, note: 'a loop, wrists together behind the back (the elbows bent 52°), head down, a slow weight shift (the free heel up) · a glance over the +x shoulder 1.5–2.95 s · a double tug against the cuffs 3.25–3.7 · a glance over the −x shoulder 4.3–5.4', glsl: /* glsl */`
  float T = 6.2831853;
  float ws = sin(T * t / D) + .25 * sin(2. * T * t / D + .8);
  P.bodyX += .03 * ws; P.pRoll += .08 * ws; P.torso.z -= .04 * ws; P.head.z += .05 * ws;
  cFoot(P, 0, 0., 0., -.2 * max(ws, 0.)); cFoot(P, 1, 0., 0., -.2 * max(-ws, 0.));
  float gR = cS(t, 1.5, 1.85) * (1. - cS(t, 2.6, 2.95)), gL = cS(t, 4.3, 4.6) * (1. - cS(t, 5.1, 5.4));
  float hy = 1.05 * gR - .75 * gL, ty = .42 * gR - .3 * gL;
  P.torso.y += ty; P.head.y += hy - ty;
  P.head.x += .22 - .1 * gR - .08 * gL; P.torso.x += .1;
  float tug = cBump(t, 3.25, 3.45) + .6 * cBump(t, 3.5, 3.68);
  cArms(P, ${v4(CUFF)} + vec4(-.06 * tug, .05 * tug, 0., 0.), ${f(CUFF_E)} - .1 * tug, 1.);
  P.torso.x += .05 * tug; P.head.x += .06 * tug; P.drop += .01 * tug;
  float br = sin(T * t / 3.);
  P.torso.x += .025 * br; P.head.x -= .01 * br; P.drop += .004 * (.5 - .5 * br);` },

  { name: 'cuffed_walk', dur: 3.36, loop: true, moving: true, speed: .7, stride: .95, blendIn: .3, blendOut: .3, note: 'a moving loop at 0.7 m/s (stride ×0.95: short steps): the locked arms, hunched, head down, the chest rolling over each stance foot · a glance to the +x side 1.6–2.75 s', glsl: /* glsl */`
  float T = 6.2831853, st = cos(T * (u - .27));
  cArms(P, ${CUFFS}, 1.);
  P.torso.x += .14 * w; P.head.x += .16;
  P.torso.z += .05 * st * w; P.head.z -= .035 * st * w;
  float g = cS(t, 1.6, 1.9) * (1. - cS(t, 2.4, 2.75));
  P.head.y += .5 * g; P.torso.y += .3 * g; P.head.x -= .05 * g;` },

  { name: 'get_in_car', dur: 2.01, hold: true, blendIn: .2, blendOut: .3, shift: [-.45, .25],
    pair: { with: 'guide_in_car', gap: 1.2, delay: 0 },
    note: 'the suspect, facing the cop (guide_in_car), the car door on its LEFT: looks up and turns 90° left on its −x foot 0.2–0.65 s · ducks under the cop’s hand 0.6–1.1 · steps into the door (−x foot 0.75–1.15, +x foot 1.15–1.55) · sinks low 1.25–1.8 · held low and turned (hide it); ends 0.45 m to −x, 0.25 m on (shift)',
    glsl: /* glsl */`
  cArms(P, ${CUFFS}, 1.);
  // the turn: −90° (the front to −x, the door on the suspect's left), 0.2–0.65 s, pivoting on the −x foot (the sole spins about its
  // middle; the +x foot swings round in the air), which carries the body 0.1 m to −x and 0.25 m ahead
  float tn = cS(t, .2, .65); cPiv = vec3(-.175, 0., .075); cRot.y = -1.5707963 * tn;
  // then into the door (−x in the walker's frame = ahead in the turned body's frame): the −x foot, then the +x foot
  float m = .2 * cS(t, .75, 1.15) + .15 * cS(t, 1.15, 1.55); cMov.x = -m;
  cFoot(P, 1, cStep(t, 1.15, 1.55, 0., .35) - m, cLift(t, .18, .68, .05) + cLift(t, 1.15, 1.55, .08), -.25 * cBump(t, 1.05, 1.35));
  cFoot(P, 0, cStep(t, .75, 1.15, 0., .2) - m, cLift(t, .75, 1.15, .09), .15 * cBump(t, .75, 1.1));
  float dk = cS(t, .6, 1.1), sink = cS(t, 1.25, 1.8);
  float lk = cBump(t, 0., .8);   // looks up at the door while turning (an upright head's corners sweep the least)
  P.torso.x += .1 + .26 * dk - .06 * sink - .1 * lk; P.head.x += .2 + .25 * dk - .35 * lk; P.drop += .1 * dk + .1 * sink;
  cBreathe(P, t, cS(t, 1.9, 2.5));` },

  { name: 'guide_in_car', dur: 2.21, blendIn: .2, blendOut: .35, shift: [0, .08],
    note: 'the cop, facing the suspect: both hands up 0.3–0.65 s · steps in 0.08 m 0.7–1.15 · the +x hand on the suspect’s head, riding it down into the door 0.6–1.45; the −x hand on the cuffs · lets go 1.45–1.75 · swings the door shut with the +x hand 1.6–2.05',
    glsl: /* glsl */`
  // the root: steps in (toward the suspect), once the suspect has turned away
  float st = cS(t, .7, 1.15); cMov.z = .08 * st;
  cFoot(P, 1, .08 * cS(t, .7, .95) - cMov.z, cLift(t, .7, .95, .04), 0.); cFoot(P, 0, .08 * cS(t, .9, 1.15) - cMov.z, cLift(t, .9, 1.15, .035), 0.);
  float up = cS(t, .3, .65), fol = cS(t, .75, 1.45), off = cS(t, 1.45, 1.75), push = cBump(t, 1.6, 2.05);
  // the +x hand (the door side) to the suspect's head and down with it into the door; then it swings the door shut
  vec4 R0 = vec4(.02, .08, 0., .1), L1 = vec4(1.32, .3, 0., .2), L2 = vec4(1.2, .78, -.05, .2), LD = vec4(1.05, .35, .15, .2);
  vec4 aL = mix(mix(mix(R0, L1, up), L2, fol), LD, push); aL.z *= cS(aL.x, .9, 1.15);
  cArm(P, 1, aL, .6 * up * (1. - off), 1. - cS(t, 1.95, 2.2));
  // the −x hand holds the cuffs (the suspect's back is to the cop's −x side once it has turned)
  float k = up * (1. - off); vec4 R1 = vec4(1.2, .0, 0., .3);
  cArm(P, 0, mix(R0, R1, k) + vec4(0., 0., .3 * cS(k, .55, 1.), 0.), .25 * k, 1.);   // (it swings in only once it is up: never through the belly)
  P.torso.y += .15 * fol * (1. - off); P.head.x -= .16 * up * (1. - cS(t, 1.95, 2.2));   // (chin up: the head's front edge clears the raised sleeve)
  cBreathe(P, t, 1.);` },

  { name: 'scuffle_pair', dur: 2.8, loop: true, blendIn: .2, blendOut: .3,
    pair: { with: 'scuffle_partner', gap: 1.2, delay: 0 },
    note: 'a loop with scuffle_partner (face to face, gap 1.2 m): re-grip 0–0.15 s · the SHOVE 0.15–0.35 (a lunge, both arms thrust) · recovers 0.4–0.7 · takes the push back 0.75–1.0 · the wrestle 1.0–2.6: hands locked, leaning in, swaying and twisting together, push-pull every 0.8 s, a lurch (A drives B a step back and they come back) 1.7–2.5',
    glsl: /* glsl */`
  float T = 6.2831853;
  // beats: re-grip 0–0.15 · the SHOVE 0.15–0.35 (a lunge, both arms thrust) · recovers 0.4–0.7 · pushed back 0.75–1.0 · the wrestle 1.0–2.6
  float coil = cBump(t, 0., .2), sv = cOut(t, .15, .32) * (1. - cS(t, .4, .75)), pb = cBump(t, .72, 1.08);
  float wr = cS(t, .9, 1.15) * (1. - cS(t, 2.5, 2.8)), ph = T * (t - 1.) / 1.6, pp = sin(2. * ph) * wr;   // the wrestle's sway (1.6 s) and push-pull (0.8 s)
  // mid-wrestle both lurch 0.14 m one way (A drives, B gives a step) and back: 1.7–2.5 s, the feet stepping with it
  float lu = .14 * (cS(t, 1.72, 2.05) - cS(t, 2.17, 2.5));
  float m = .14 * sv - .1 * pb + .04 * pp + lu; cMov.z = m;
  cFoot(P, 0, .12 + .14 * cS(t, .12, .3) * (1. - cS(t, .45, .7)) + .14 * (cS(t, 1.7, 1.95) - cS(t, 2.15, 2.4)) - m, cLift(t, .12, .3, .05) + cLift(t, .45, .7, .03) + cLift(t, 1.25, 1.45, .035) + cLift(t, 1.7, 1.95, .04) + cLift(t, 2.15, 2.4, .035), -.1 * sv);
  cFoot(P, 1, -.1 + .14 * (cS(t, 1.85, 2.05) - cS(t, 2.3, 2.5)) - m, cLift(t, .8, 1., .03) + cLift(t, 1.85, 2.05, .04) + cLift(t, 2.3, 2.5, .035), -.2 * sv);
  float ty = .3 * sin(ph) * wr;
  P.torso.x += .22 + .2 * sv - .14 * pb - .05 * coil + .04 * pp; P.head.x -= .22 + .12 * sv - .1 * pb;
  P.torso.y += ty; P.head.y -= ty; P.torso.z += .11 * sin(ph + 1.3) * wr; P.head.z -= .07 * sin(ph + 1.3) * wr;
  P.drop += .05 + .02 * sv;
  // the arms: locked on the other's forearms; pulled in for the re-grip, thrust straight in the shove, pumping in the wrestle
  vec4 A = vec4(1.28, .1, .12, 0.);
  float pull = .25 * coil - .3 * sv + .2 * pb;
  cArm(P, 0, A + vec4(.12 * sv - .06 * pb + .05 * sin(2. * ph + 1.) * wr, 0., 0., 0.), .3 + pull + .12 * max(0., sin(2. * ph)) * wr, 1.);
  cArm(P, 1, A + vec4(.12 * sv - .06 * pb - .05 * sin(2. * ph + 1.) * wr, 0., 0., 0.), .3 + pull + .12 * max(0., -sin(2. * ph)) * wr, 1.);` },

  { name: 'scuffle_partner', dur: 2.8, loop: true, blendIn: .2, blendOut: .3,
    note: 'scuffle_pair’s partner: shoved at 0.2 s, stumbles back two steps 0.22–0.55 (arms flung, the head whips), charges back in 0.65–1.0 (shoves back) · the wrestle 1.0–2.6 (gives a step to the lurch 1.7–2.5)',
    glsl: /* glsl */`
  float T = 6.2831853;
  // beats: shoved 0.2–0.45, stumbles back two steps to 0.65 (arms flung) · charges back in 0.65–1.0 (shoves back) · the wrestle 1.0–2.6 (gives a step to the lurch 1.7–2.5)
  float hit = cOut(t, .18, .3) * (1. - cS(t, .55, .95)), bk = cS(t, .2, .6) * (1. - cS(t, .65, 1.)), ch = cBump(t, .65, 1.05);
  float wr = cS(t, .9, 1.15) * (1. - cS(t, 2.5, 2.8)), ph = T * (t - 1.) / 1.6, pp = sin(2. * ph) * wr;
  float lu = .14 * (cS(t, 1.72, 2.05) - cS(t, 2.17, 2.5));   // gives a step to A's lurch and comes back
  float m = -.3 * bk + .06 * ch - .04 * pp - lu; cMov.z = m;
  float zL = .1 - .3 * cS(t, .22, .42) + .3 * cS(t, .7, .9) - .14 * (cS(t, 1.82, 2.05) - cS(t, 2.17, 2.4)), zR = -.12 - .3 * cS(t, .35, .55) + .3 * cS(t, .82, 1.) - .14 * (cS(t, 1.7, 1.9) - cS(t, 2.3, 2.5));
  cFoot(P, 0, zL - m, cLift(t, .22, .42, .05) + cLift(t, .7, .9, .05) + cLift(t, 1.45, 1.65, .035) + cLift(t, 1.82, 2.05, .04) + cLift(t, 2.17, 2.4, .035), -.15 * cBump(t, .2, .45));
  cFoot(P, 1, zR - m, cLift(t, .35, .55, .05) + cLift(t, .82, 1., .045) + cLift(t, 1.7, 1.9, .04) + cLift(t, 2.3, 2.5, .035), -.2 * cBump(t, .35, .6));
  float ty = .3 * sin(ph) * wr;
  P.torso.x += .22 - .5 * hit + .22 * ch + .04 * pp; P.head.x -= .22 - .3 * hit + .12 * ch - .15 * cBump(t, .2, .5);
  P.torso.y += ty; P.head.y -= ty; P.torso.z -= .11 * sin(ph + 1.3) * wr; P.head.z += .07 * sin(ph + 1.3) * wr;
  P.drop += .05 + .04 * hit;
  // the arms: on the other's forearms (outside them); flung up and out by the shove, back on as it charges in
  vec4 A = vec4(1.24, .24, -.06, 0.), F = vec4(.55, .8, 0., .3);
  float fl = cS(t, .2, .32) * (1. - cS(t, .6, .85));
  cArm(P, 0, mix(A, F, fl) + vec4(.1 * ch + .05 * sin(2. * ph) * wr, 0., 0., 0.), .3 - .2 * ch + .15 * max(0., -sin(2. * ph + 1.)) * wr, 1.);
  cArm(P, 1, mix(A, F, fl) + vec4(.1 * ch - .05 * sin(2. * ph) * wr, 0., 0., 0.), .3 - .2 * ch + .15 * max(0., sin(2. * ph + 1.)) * wr, 1.);` },

  { name: 'flee_run', dur: 1.455, loop: true, moving: true, speed: 3.3, stride: 2, blendIn: .12, blendOut: .3, note: 'a moving loop at 3.3 m/s (stride ×2, hips and knees ×1.55 / ×1.6): a 0.3 lean, both arms pumping, elbows ~78° (forward to the chin, back past the hip) · looks back over the +x shoulder 0.55–1.05 s of each 1.455 s round (3 strides)', glsl: /* glsl */`
  float T = 6.2831853, sw = cos(T * (u - .07));
  cLegK = vec2(1.55, 1.6);
  P.torso.x += .3 * w; P.head.x -= .26 * w;
  P.drop += .03 * (.5 + .5 * cos(2. * T * (u - .1))) * w;
  P.torso.y += .16 * sw * w; P.head.y -= .14 * sw * w;
  float gb = cS(t, .55, .7) * (1. - cS(t, .9, 1.05)), sa = .72 - .2 * gb;   // (the look back: the arms pump a little shorter under it)
  float fL = max(-sw, 0.), fR = max(sw, 0.);
  cArm(P, 0, vec4(.05 - sa * sw, .3, 0., -.3), 1.32 + .08 * fL, 1.);
  cArm(P, 1, vec4(.05 + sa * sw, .3, 0., -.3), 1.32 + .08 * fR, 1.);
  P.head.y += .7 * gb; P.torso.y += .3 * gb; P.head.x -= .08 * gb;` },
];
