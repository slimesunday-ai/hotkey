// CLIPS · talk-patrol (activities; MOVEMENT.md §7; the talk-patrol animation agent, 2026-10-08). The clips that keep a street talking
// and a beat walked (the city's simstate/life.js plays them by NAME: NAMES.talk, NAMES.nod, NAMES.patrol):
//   talk_gesture    4.2 s loop · THE EXPLAINER: both hands out in front, the forearms forward (elbows ~70°), beats on the words (the
//                   hands dip and the head nods), the hands open out wide ("right?"), come in to hold a ball and roll it, back
//   talk_gesture_b  4.8 s loop · MAKING POINTS: the −x hand in the hoodie pocket, the +x forearm up, three counting chops, a point at
//                   the listener with two jabs, a flick out to the side, back up; the weight on the −x hip, the head tilted
//   talk_gesture_c  3.6 s loop · ANIMATED: a "come on!" (both forearms thrown out to the sides, the chest back, a head shake), the
//                   hands drop, a laugh (the head thrown back, bobbing) with a dismissive swat of the +x hand, back
//   listen_nod      6 s loop · the weight on the −x leg (the +x heel up), hands in the hoodie pocket, a double "mm-hm" nod, the +x hand
//                   up to the chin (thinking, the head tilted), a nod, a short laugh
//   patrol_walk     4.8 s MOVING loop at 1.05 m/s (the walk's legs): hands clasped at the small of the back (the elbows bent), the chest
//                   up, the head scanning: to +x first (the first second is what a short beat shows), back, to −x, back
// Every loop is seamless at D (each channel is keyed back to its start or runs a rhythm that divides D) and starts in its own ready pose:
// the city starts each one when the walker faces its partner (talk / listen) or sets off along the beat (patrol), from any frame.
// THE PAIR (life.js): the speaker plays a talk (picked per conversation), the other listen_nod, facing each other wherever their spots
// put them (talkR ≤ 7 m). The lab shows each talk with listen_nod 1.3 m in front (pair, for the lab and the sheets only: life.js pairs
// them itself). The big heads (1.0 wide, 0.8 deep) never meet at ≥ 1.2 m: every hand stays ≤ 0.5 m ahead of the chest, the heads ≤ 0.12 m
// forward of the neck in any lean (measured, see the notes in CLIPS.md).
// THE ARMS: the hands are placed by a two-bone IK on the elbow (work.js's method: the elbow from the reach, then the shoulder's turn
// takes the bent rest arm's grip point onto the target with the elbow toward a pole). Targets are in the CHEST's rest frame, so the
// chest's lean and turn carry the hands. THE TOON ARM reaches only 0.403–0.453 m from the shoulder (x ±0.25, y 0.825; elbows ≤ 83°, under
// the thick sleeve's soft cap): a hand can't come to the chest, the hip or the other hand at the midline, so: no folded arms (the hands
// would have to reach 0.55 m), no hand on the hip (0.25–0.35 m from the shoulder), the listener's hands go in the hoodie pocket
// (deal-hang.js's straight-arm pocket, gated clean there) and the speaker's hands work in a band in front of the chest, ≥ 0.33 m ahead.
// Arms are [pitch fwd, roll out, yaw in, twist in] (rad) + the elbow; torso / head: x = pitch forward (head: look down), y = yaw (+: the
// front turns to +x), z = roll. The head is posed relative to the chest: eyes at hy means head.y += hy − ty.
const f = v => (+v).toFixed(4), PI = Math.PI;
// ── the rig (walk2.js; work.js): the shoulder pivot, the elbow's hinge line, the hand's grip point (the mitten's centre), in the arm's rest frame
const SH = { x: .25, y: .825 }, HINGE = { y: .65, z: .05 }, GRIP = { x: .325, y: .39, z: 0 }, ELB = { y: .65 };
const gx = GRIP.x - SH.x, hy = HINGE.y - SH.y, hz = HINGE.z, gy = GRIP.y - HINGE.y, gz = GRIP.z - HINGE.z;
const RA = gx * gx + hy * hy + hz * hz + gy * gy + gz * gz, Bc = 2 * (hy * gy + hz * gz), Bs = 2 * (hy * gz - hz * gy), RB = Math.hypot(Bc, Bs), PHI = Math.atan2(Bs, Bc);
const EMAX = 1.45, RMIN = Math.sqrt(RA + RB * Math.cos(EMAX - PHI)), RMAX = Math.sqrt(RA + RB);
// a keyed channel: [[t, v, ease?], …] → one expression (eased steps added up; the ease of the segment that ENDS at the key)
const keys = (K, T = 't') => { let s = f(K[0][1]); for (let i = 1; i < K.length; i++) { const d = K[i][1] - K[i - 1][1]; if (Math.abs(d) < 1e-9) continue; s += ` + ${f(d)} * ${K[i][2] || 'cS'}(${T}, ${f(K[i - 1][0])}, ${f(K[i][0])})`; } return `(${s})`; };
// a keyed point: [[t, [x, y, z], ease?], …] → a vec3 expression
const k3 = K => `vec3(${[0, 1, 2].map(i => keys(K.map(k => [k[0], k[1][i], k[2]]))).join(', ')})`;
const mirror = K => K.map(k => [k[0], [-k[1][0], k[1][1], k[1][2]], k[2]]);
// a beat: the hand snaps down at a and eases back up by a + .3 (0 → 1 → 0)
const beat = (a, s = 1) => `${f(s)} * cOut(t, ${f(a)}, ${f(a + .07)}) * (1. - cS(t, ${f(a + .07)}, ${f(a + .32)}))`;
// THE HAND IK (GLSL): side 0 (−x) / 1 (+x); T = the hand's target, H = where the elbow points (both chest rest frame, vec3 expressions);
// k blends the arm onto it (cArm, 1 = on the target)
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
// the hoodie front pocket (deal-hang.js deal_lookout's straight arms, a little further forward: the fists just in front of the belly, not in it)
const POCKET = 'vec4(1., .08, .26, .45)';
const TALK_PAIR = { with: 'listen_nod', gap: 1.3, delay: 0 };

// ═══ TALK_GESTURE (4.2 s): the explainer. P = presenting (both hands out in front of the belly, the forearms forward), W = wide open,
// B = holding a ball between the hands (rolled 2.55–3.35 s). Beats at 0.22, 0.62, 1.02 (both hands) and 3.9; the head nods on them.
const TA_D = 4.2;
const TA_P = [.3, .63, .36], TA_W = [.49, .64, .25], TA_B = [.17, .67, .39];
const TA_R = [[0, TA_P], [1.35, TA_P], [1.75, TA_W], [2.15, TA_W], [2.55, TA_B], [3.35, TA_B], [3.85, TA_P], [TA_D, TA_P]];
const TA_POLE = [[0, [1, -1, -.4]], [1.35, [1, -1, -.4]], [1.75, [1, -.7, -.6]], [2.15, [1, -.7, -.6]], [2.55, [.9, -.5, -.1]], [3.35, [.9, -.5, -.1]], [3.85, [1, -1, -.4]], [TA_D, [1, -1, -.4]]];
const taBeats = `(${beat(.22)} + ${beat(.62)} + ${beat(1.02, .8)} + ${beat(3.9, .7)})`;
const talkA = /* glsl */`
  float bt = ${taBeats}, wd = cS(t, 1.35, 1.75) * (1. - cS(t, 2.15, 2.55)), bl = cS(t, 2.55, 2.75) * (1. - cS(t, 3.15, 3.35)), rl = sin(6.2831853 * (t - 2.55) / .8) * bl;
  // the hands: the +x one leads a hair, the −x one follows (asymmetry: two hands never move as one)
  vec3 tR = ${k3(TA_R)} + vec3(0., -.075 * bt + .04 * rl, .02 * bt), tL = ${k3(mirror(TA_R))} + vec3(0., -.06 * bt - .04 * rl, .015 * bt);
  ${ik(1, 'tR', k3(TA_POLE))}
  ${ik(0, 'tL', `${k3(TA_POLE)} * vec3(-1., 1., 1.)`)}
  // the body: leans in to talk, back a touch for the open "right?", the chest swaying slowly; the weight drifting (once a loop)
  float ws = sin(6.2831853 * t / D + .6);
  P.torso.x += .02 + .03 * bt - .08 * wd; P.torso.y += .07 * sin(6.2831853 * t / D) + .04 * rl; P.torso.z -= .02 * ws;
  P.bodyX += .02 * ws; P.pRoll += .06 * ws; P.head.z += .03 * ws + .09 * wd;
  float hy = -.12 * wd + .08 * bl - .3 * cBump(t, 1.75, 2.35);   // (a glance off for the word, mid "right?")
  P.head.y += hy - P.torso.y * .7; P.head.x += .07 * bt - .06 * wd - .03;
  P.drop += .006 * bt;
  float br = sin(6.2831853 * t / D * 2.); P.torso.x += .015 * br; P.head.x -= .008 * br;`;

// ═══ TALK_GESTURE_B (4.8 s): making points. The −x hand in the hoodie pocket; the +x forearm up (U), three counting chops at 0.45,
// 0.85, 1.25, a point at the listener (A, 1.6–1.95) with jabs at 2.05 and 2.3, a flick out to the side (F, 2.55–3.0), back up (3.3–3.9),
// a last chop at 4.1. The weight on the −x hip, the chest turned a little so the +x shoulder leads, the head tilted while counting.
const TB_D = 4.8;
const TB_U = [.33, .8, .38], TB_A = [.22, .74, .45], TB_F = [.48, .62, .25];
const TB_R = [[0, TB_U], [1.6, TB_U], [1.95, TB_A, 'cOut'], [2.55, TB_A], [3.0, TB_F], [3.3, TB_F], [3.9, TB_U], [TB_D, TB_U]];
const TB_POLE = [[0, [1, -.6, -.2]], [1.6, [1, -.6, -.2]], [1.95, [1, -.8, -.3]], [2.55, [1, -.8, -.3]], [3.0, [1, -.6, -.4]], [3.3, [1, -.6, -.4]], [3.9, [1, -.6, -.2]], [TB_D, [1, -.6, -.2]]];
const talkB = /* glsl */`
  float ch = ${beat(.45)} + ${beat(.85)} + ${beat(1.25)} + ${beat(4.1, .8)}, jb = cBump(t, 2.0, 2.16) + .8 * cBump(t, 2.25, 2.41), pt = cS(t, 1.6, 1.95) * (1. - cS(t, 2.55, 3.0));
  float fl = cS(t, 2.6, 3.0) * (1. - cS(t, 3.3, 3.9)), cnt = cS(t, .25, .45) * (1. - cS(t, 1.4, 1.7));
  vec3 tR = ${k3(TB_R)} + vec3(0., -.12 * ch - .03 * jb + .04 * cBump(t, 3.0, 3.25), .03 * ch + .03 * jb);
  ${ik(1, 'tR', k3(TB_POLE))}
  cArm(P, 0, ${POCKET} + vec4(.03 * sin(6.2831853 * t / D), 0., 0., 0.), 0., 1.);
  // the body: on the −x hip, the +x shoulder forward; leans in for the point; the head tilted while counting, turned off with the flick
  float ty = -.12 + .05 * pt - .04 * fl;
  P.bodyX -= .025 + .006 * sin(6.2831853 * t / D * 2.); P.pRoll -= .07; P.torso.z += .03; P.head.z -= .02;
  cFoot(P, 1, .02, 0., -.12);
  P.torso.y += ty; P.torso.x += .02 + .05 * pt + .015 * ch + .02 * jb;
  P.head.y += -.2 * fl - ty; P.head.z += .1 * cnt; P.head.x += .04 * ch + .04 * jb - .02 - .04 * pt;
  float br = sin(6.2831853 * t / D * 2.); P.torso.x += .015 * br; P.head.x -= .008 * br;`;

// ═══ TALK_GESTURE_C (3.6 s): animated. R = the hands at a low ready, T = THROWN out to the sides (a "come on!", 0.25–0.6, held with a
// head shake 0.7–1.4), back to R 1.45–1.85 · the laugh 1.9–2.9 (the head thrown back, bobbing four times), the +x hand swats down 2.0–2.5 · back.
const TC_D = 3.6;
const TC_R = [.3, .56, .35], TC_T = [.52, .6, .24], TC_S = [.32, .78, .4], TC_H = [.36, .5, .36];
const TC_RK = [[0, TC_R], [.25, TC_R], [.6, TC_T, 'cOut'], [1.45, TC_T], [1.85, TC_R], [2.05, TC_R], [2.3, TC_S], [2.5, TC_H, 'cIn'], [3.1, TC_R], [TC_D, TC_R]];
const TC_LK = [[0, TC_R], [.27, TC_R], [.62, TC_T, 'cOut'], [1.45, TC_T], [1.85, TC_R], [TC_D, TC_R]];
const TC_POLE = [[0, [1, -1, -.4]], [.25, [1, -1, -.4]], [.6, [.5, -1, -.5]], [1.45, [.5, -1, -.5]], [1.85, [1, -1, -.4]], [TC_D, [1, -1, -.4]]];
const talkC = /* glsl */`
  float th = cOut(t, .25, .6) * (1. - cS(t, 1.45, 1.85)), sk = cS(t, .7, .8) * (1. - cS(t, 1.3, 1.4)) * sin(6.2831853 * 3.2 * (t - .7));
  float lg = cS(t, 1.9, 2.15) * (1. - cS(t, 2.7, 3.1)), bob = lg * (.5 - .5 * cos(6.2831853 * 4. * (t - 1.9)));
  vec3 tR = ${k3(TC_RK)} + vec3(0., .02 * cBump(t, .6, .9) - .02 * bob, 0.), tL = ${k3(mirror(TC_LK))} + vec3(0., .02 * cBump(t, .62, .92) - .03 * bob, 0.);
  ${ik(1, 'tR', k3(TC_POLE))}
  ${ik(0, 'tL', `${k3(TC_POLE)} * vec3(-1., 1., 1.)`)}
  // the body: thrown back with the "come on", the head shaking; the laugh throws the head back and bobs
  P.torso.x += .02 - .1 * th - .12 * lg + .04 * bob; P.head.x += -.06 * th - .14 * lg + .07 * bob;   // (the laugh throws the head BACK: a head pitched at a partner 1.2 m away must stay ≤ ~0.12 rad forward)
  P.head.y += .3 * sk; P.head.z += .06 * th + .05 * sk;
  P.drop += .012 * th + .02 * lg + .018 * bob; P.torso.y += .06 * sin(6.2831853 * t / D);
  float ws = sin(6.2831853 * t / D + 1.); P.bodyX += .015 * ws; P.pRoll += .05 * ws;`;

// ═══ LISTEN_NOD (6 s): the weight on the −x leg (the +x heel up, the knee soft), hands in the hoodie pocket · a double nod ("mm-hm")
// 0.5–1.5 · the +x hand up to the chin, thinking, the head tilted and up 2.2–3.7 (it rubs) · a nod 4.0–4.6 · a short laugh 4.85–5.5.
const LN_D = 6, LN_C = [.13, .84, .39];
const listen = /* glsl */`
  float nd = .11 * cBump(t, .5, .95) + .09 * cBump(t, 1.0, 1.45) + .11 * cBump(t, 4.0, 4.55), cn = cS(t, 2.2, 2.65) * (1. - cS(t, 3.3, 3.75));
  float lf = cBump(t, 4.85, 5.5), lb = lf * (.5 - .5 * cos(6.2831853 * 3. * (t - 4.85)));
  // the weight: on the −x leg, a slow sway over it; the +x heel up
  float ws = .7 + .3 * sin(6.2831853 * t / D);
  P.bodyX -= .03 * ws; P.pRoll -= .085 * ws; P.torso.z += .04 * ws; P.head.z -= .03 * ws;
  cFoot(P, 1, .03, 0., -.18 * ws);
  // the arms: both hands in the pocket; the +x one comes up to the chin and rubs it (elbow bent, the IK), back in
  cArm(P, 0, ${POCKET}, 0., 1.); cArm(P, 1, ${POCKET}, 0., 1.);
  vec3 tC = vec3(${LN_C.map(f).join(', ')}) + vec3(.012 * sin(t * 19.) * cS(t, 2.6, 2.8) * (1. - cS(t, 3.1, 3.3)), 0., 0.);
  ${ik(1, 'tC', 'vec3(1., -1.2, -.2)', 'cn')}
  // the head: the nods, the thinking tilt (up a little, the chin off the hand), the laugh (back, then bobbing)
  P.head.x += nd - .04 - .06 * cn - .12 * lf + .05 * lb; P.head.z += .12 * cn; P.head.y += .06 * sin(6.2831853 * t / D * 2.) + .1 * cn;
  P.torso.x += -.03 * cn - .04 * lf + .03 * lb; P.drop += .018 * lb;
  float br = sin(6.2831853 * t / 3.); P.torso.x += .025 * br; P.head.x -= .01 * br; P.drop += .004 * (.5 - .5 * br);`;

// ═══ PATROL_WALK (4.8 s, MOVING at 1.05 m/s, the walk's legs): hands clasped at the small of the back (arrest.js's cuffs, looser), the
// chest up, the head scanning: to +x 0.2–0.75 s (held), back 1.5–2.0, to −x 2.5–3.0 (held), back 3.7–4.2. A short beat (~1 m) shows only
// its first second: the look to +x. The arms rock a little with the steps (off the walk's cycle u).
const PATROL = [-1.28, .22, .2, 2.05], PATROL_E = .85;
const patrol = /* glsl */`
  float T = 6.2831853, st = cos(T * (u - .27)), sw = sin(T * u);
  cArms(P, vec4(${PATROL.map(f).join(', ')}) + vec4(.03 * sw * w, 0., 0., 0.), ${f(PATROL_E)}, 1.);
  P.torso.x -= .05 * w; P.head.x -= .02;
  P.torso.z += .03 * st * w; P.head.z -= .02 * st * w;
  float hy = ${keys([[0, 0], [.2, 0], [.75, .55], [1.5, .55], [2.0, 0], [2.5, 0], [3.0, -.45], [3.7, -.45], [4.2, 0], [4.8, 0]])};
  float ty = .25 * hy; P.torso.y += ty; P.head.y += hy - ty; P.head.x -= .04 * abs(hy);`;

export const CLIPS = [
  { name: 'talk_gesture', dur: TA_D, loop: true, blendIn: .35, blendOut: .35, pair: TALK_PAIR,
    note: 'a loop, the explainer (with listen_nod 1.3 m in front: the lab only; life.js pairs them): both hands out in front, the forearms forward · beats 0.22, 0.62, 1.02 s (the hands dip, the head nods) · the hands open out wide 1.35–1.75 ("right?", the chest back, the head tilted) · in to hold a ball 2.15–2.55, rolled to 3.35 · back to presenting 3.35–3.85, a last beat 3.9', glsl: talkA },
  { name: 'talk_gesture_b', dur: TB_D, loop: true, blendIn: .35, blendOut: .35, pair: TALK_PAIR,
    note: 'a loop, making points (with listen_nod 1.3 m in front: the lab only): the −x hand in the hoodie pocket, the weight on that hip · the +x forearm up · three counting chops 0.45, 0.85, 1.25 s (the head tilted) · points at the listener 1.6–1.95, jabs 2.05 and 2.3 · a flick out to the side 2.6–3.0 (the eyes off) · back up 3.3–3.9 · a last chop 4.1', glsl: talkB },
  { name: 'talk_gesture_c', dur: TC_D, loop: true, blendIn: .3, blendOut: .35, pair: TALK_PAIR,
    note: 'a loop, animated (with listen_nod 1.3 m in front: the lab only): both hands thrown out to the sides 0.25–0.6 s ("come on!", the chest back), held with a head shake 0.7–1.4 · down 1.45–1.85 · a laugh 1.9–2.9 (the head thrown back, bobbing), the +x hand swats down 2.05–2.5 · back by 3.1', glsl: talkC },
  { name: 'listen_nod', dur: LN_D, loop: true, blendIn: .4, blendOut: .4,
    note: 'a loop, listening: the weight on the −x leg (the +x heel up), hands in the hoodie pocket · a double nod ("mm-hm") 0.5–1.5 s · the +x hand up to the chin, thinking, the head tilted 2.2–3.75 · a nod 4.0–4.6 · a short laugh 4.85–5.5', glsl: listen },
  { name: 'patrol_walk', dur: 4.8, loop: true, moving: true, speed: 1.05, blendIn: .3, blendOut: .3,
    note: 'a MOVING loop at 1.05 m/s (the walk\'s legs; the owner moves it at `speed`): hands clasped at the small of the back, the chest up · the head scans: to +x 0.2–0.75 s, held, back 1.5–2.0 · to −x 2.5–3.0, held, back 3.7–4.2', glsl: patrol },
];
