// CLIPS · high (moods; the K agent, 2026-10-10; the visible-highs plan §1, CLIPS.md § Moods and reactions). The three behaviour families a viewer can
// tell apart on the street (live shows only the family, never the drug: SPACED is ONE look for hallu, clear and sudo):
//   wired_walk      MOVING overlay · bent fists pumping hard with the steps, the shoulders forward, a quick nod on every step
//   spaced_walk     MOVING overlay · loose and lagging: floppy arms that trail the legs (the forearms flop), an extra torso roll, the
//                   head lolling and drifting
//   guarded_walk    MOVING overlay · hands in the hoodie pocket (deal-hang's pocket), the shoulders up, a head scan every 2.4 s
//   wired_bounce    1.2 s standing loop · on the balls of the feet, bouncing, fists up in the reach band, a jab each loop
//   spaced_drift    6 s standing loop · a slow circling sway, the +x arm floats up and reaches at nothing, the head follows it
//   guarded_stance  4.8 s standing loop · hands in the pocket, hunched, a glance over the +x shoulder at 1.0 s and the −x at 3.2 s
// THE WALKING OVERLAYS (moving: true, stride: 1, speed: 0; CLIPS.md § Moods and reactions): they play at the WALKER'S OWN PACE. speed 0 = the owner
// does not drive the walker (its own movement does), stride 1 = the walk's own cycle length, and they write NO cLegK, cMov or cRot
// and none of the leg channels (P.ank, P.fp, P.drop, P.bodyX, P.pRoll): only the chest, the head and the arms. So the legs and feet
// are the walk's, bit for bit (no foot slide, no root motion) and the travel speed is untouched. The arms are timed off the walk's
// cycle u (walk2.js: the +x arm swings with cos 2π(u − .07)), so a quicker cadence (the moods' step factor g.aK) speeds them up too.
// Everything that rides the walk is scaled by its weight w: a walker that stops mid-clip eases into the clip's standing version of the
// look (the city switches to the family's standing loop then).
// Every loop is seamless at D (each clock channel is keyed back to its start or runs a rhythm that divides D). Arms are [pitch fwd, roll
// out, yaw in, twist in] (rad) + the elbow (cArm's 5-argument form); torso / head: x = pitch forward (head: look down), y = yaw (+: the
// front turns to +x), z = roll. The head is posed relative to the chest: eyes at hy means head.y += hy − ty.
// THE REACH (talk-patrol.js): the toon arm reaches 0.403–0.453 m from the shoulder; fists in front work in a band ≥ 0.33 m ahead of the
// chest; the big head (x ±0.5, y 0.9–1.7, front z 0.45) owns everything above y 0.9 inside its width.
const f = v => (+v).toFixed(4), v4 = a => `vec4(${a.map(f).join(', ')})`;
// ── the rig (walk2.js; talk-patrol.js): the shoulder pivot, the elbow's hinge line, the hand's grip point, in the arm's rest frame
const SH = { x: .25, y: .825 }, HINGE = { y: .65, z: .05 }, GRIP = { x: .325, y: .39, z: 0 }, ELB = { y: .65 };
const gx = GRIP.x - SH.x, hy = HINGE.y - SH.y, hz = HINGE.z, gy = GRIP.y - HINGE.y, gz = GRIP.z - HINGE.z;
const RA = gx * gx + hy * hy + hz * hz + gy * gy + gz * gz, Bc = 2 * (hy * gy + hz * gz), Bs = 2 * (hy * gz - hz * gy), RB = Math.hypot(Bc, Bs), PHI = Math.atan2(Bs, Bc);
const EMAX = 1.45, RMIN = Math.sqrt(RA + RB * Math.cos(EMAX - PHI)), RMAX = Math.sqrt(RA + RB);
// THE HAND IK (talk-patrol.js's, GLSL): side 0 (−x) / 1 (+x); T = the hand's target, H = where the elbow points (chest rest frame)
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
const PK = v4([.54, .38, .32, .5]), PK_E = f(.85);   // THE POCKET: deal-hang.js's hoodie front pocket (the elbows out, the hands in front of the belly)

// ═══ WIRED_WALK: the fists pump hard and bent (the elbows ~75°, a run's arms at a walk), driven off the walk's own arm phase; the chest
// forward (the shoulders rounded over), the shoulders drive with the free arm; a quick, sharp nod on every step (at each contact); a
// twitchy glance to the side once a loop. Standing (w → 0): the fists stay up at the ribs.
const wiredWalk = /* glsl */`
  float T = 6.2831853, sw = cos(T * (u - .07)), fL = max(-sw, 0.), fR = max(sw, 0.);
  vec4 S = vec4(.25, .42, 0., -.35);
  cArm(P, 0, mix(S, vec4(.06 - .54 * sw, .4 + .08 * fR, 0., -.35), w), mix(1.35, 1.25 + .12 * fL, w), 1.);   // (the elbows out: the arms leave the head's
  cArm(P, 1, mix(S, vec4(.06 + .54 * sw, .4 + .08 * fL, 0., -.35), w), mix(1.35, 1.25 + .12 * fR, w), 1.);   //  shadow, so the pump shows from above)
  P.torso.x += .11; P.head.x -= .14;                                  // the shoulders forward, driving; the chin UP (from above: the face, not the crown)
  P.torso.y += .13 * sw * w; P.head.y -= .13 * sw * w;                 // the shoulders drive with the arms; the head stays on the path
  float nd = pow(max(cos(2. * T * (u - .03)), 0.), 10.);               // a sharp nod at each contact
  P.head.x += .11 * nd * w;
  P.head.y += .24 * (cOut(t, .5, .58) - cS(t, .74, .92));              // the twitch: a quick glance to +x and back`;

// ═══ SPACED_WALK: the arms hang loose and trail the legs far behind the walk's own lag (they lag), swinging wide; each forearm flops
// (the elbow folds as its arm swings back, then flicks open); the torso rolls side to side over the steps, more than the walk, and late;
// the head lolls against it, tilted back, drifting slowly round (once a loop).
const spacedWalk = /* glsl */`
  float T = 6.2831853, sw = cos(T * (u - .19)), sv = sin(T * (u - .19)), st = cos(T * (u - .37));
  float eL = .18 + .5 * max(-sv, 0.), eR = .18 + .5 * max(sv, 0.);      // the flop: the elbow folds as the arm swings back
  cArm(P, 0, vec4(.05 - .6 * sw * w, .28 + .06 * sv * w, 0., -.15), mix(.15, eL, w), 1.);   // (wide and loose: out of the body's line)
  cArm(P, 1, vec4(.05 + .6 * sw * w, .28 - .06 * sv * w, 0., -.15), mix(.15, eR, w), 1.);
  P.torso.z += .12 * st * w; P.head.z -= .1 * cos(T * (u - .5)) * w;      // the roll, late; the head lolls the other way
  P.torso.y += .07 * cos(T * (u - .25)) * w;
  P.torso.x -= .08; P.head.x -= .14 + .05 * sin(T * t / D);                // slumped back, the head tipped up (dazed: the face to the sky)
  P.head.y += .35 * sin(T * t / D) + .08 * sin(2. * T * t / D + 1.);       // drifting round
  P.head.z += .17 * sin(T * t / D + 2.);                                    // lolling over to one side, then the other (from above: a tilted head)`;

// ═══ GUARDED_WALK: hands in the hoodie pocket (the pocket bobs with the steps), the shoulders up and in (the chest hunched a little
// forward, the chin down), a quick head scan every 2.4 s: over the +x shoulder 0.3–1.35 s, over the −x 2.7–3.75 s.
const guardedWalk = /* glsl */`
  float T = 6.2831853, sw = cos(T * (u - .07));
  cArm(P, 0, ${PK} + vec4(-.03 * sw * w, 0., 0., 0.), ${PK_E} - .05 * sw * w, 1.);
  cArm(P, 1, ${PK} + vec4(.03 * sw * w, 0., 0., 0.), ${PK_E} + .05 * sw * w, 1.);
  P.torso.x += .1; P.head.x += .1;                                         // hunched, the chin down (from above: the crown, not the face)
  float r = cOut(t, .3, .5) * (1. - cS(t, 1.0, 1.35)), l = cOut(t, 2.7, 2.9) * (1. - cS(t, 3.4, 3.75));
  float hy = .85 * (r - l), ty = .22 * hy;
  P.torso.y += ty; P.head.y += hy - ty; P.head.x -= .05 * (r + l);`;

// ═══ WIRED_BOUNCE (1.2 s): a boxer's bounce on the balls of the feet, the −x foot forward; two bounces a loop; the fists up in the guard
// in the reach band (the −x lead fist ahead), a jab with the lead at 0.62–0.86 s (the chest turns into it), back to the guard.
const WB_GL = [-.3, .76, .38], WB_GR = [.33, .73, .36], WB_J = [-.16, .78, .5];
const wiredBounce = /* glsl */`
  float T = 6.2831853, b = .5 - .5 * cos(2. * T * t / D), jb = cOut(t, .62, .7) * (1. - cS(t, .72, .88));
  cFoot(P, 0, .09, 0., -.32 + .1 * b); cFoot(P, 1, -.08, 0., -.36 + .1 * b);
  P.drop += -.04 + .045 * b;
  P.torso.y += .16 + .14 * jb; P.head.y -= .16 + .14 * jb;
  P.torso.x += .1 + .04 * b; P.head.x -= .13 - .05 * b;                   // (the chin up: from above, the face)
  float sh = sin(T * t / D);                                               // the shuffle: the weight side to side, once a loop
  P.bodyX += .018 * sh; P.pRoll += .05 * sh; P.torso.z -= .05 * sh; P.head.z += .04 * sh;
  vec3 tL = mix(vec3(${WB_GL.map(f).join(', ')}), vec3(${WB_J.map(f).join(', ')}), jb) + vec3(0., -.02 * b, 0.), tR = vec3(${WB_GR.map(f).join(', ')}) + vec3(0., -.025 * b + .015 * jb, -.02 * jb);
  ${ik(0, 'tL', 'vec3(-1., -1., -.3)')}
  ${ik(1, 'tR', 'vec3(1., -1., -.3)')}
  P.head.y += .14 * cBump(t, .2, .4);`;

// ═══ SPACED_DRIFT (6 s): a slow circling sway (the chest and hips go round twice a loop, the head lolling behind them); the +x arm
// floats up and out in front, 0.9–2.4 s, the hand hangs there reaching at nothing (twice, 2.5–3.7), floats down 3.8–5.2;
// the head turns to watch it and drifts. (The reaches OPEN the elbow: bending it past the IK's 1.45 rad passes the thick sleeve's cap.)
const SD_UP = [.62, .8, .18];
const spacedDrift = /* glsl */`
  float T = 6.2831853, c = cos(2. * T * t / D), s = sin(2. * T * t / D), cl = cos(2. * T * (t - .5) / D);
  P.bodyX += .035 * c; P.pRoll += .08 * c; P.torso.z -= .1 * c; P.torso.x += .07 * s - .05; P.head.z += .14 * cl; P.head.x -= .12 + .06 * sin(2. * T * (t - .5) / D);
  float up = cS(t, .9, 2.4) * (1. - cS(t, 3.8, 5.2)), gr = cBump(t, 2.5, 3.1) + cBump(t, 3.1, 3.7);
  vec3 tR = vec3(${SD_UP.map(f).join(', ')}) + vec3(0., .02 * sin(T * t / 1.5), 0.);
  vec4 HANG = vec4(.03, .16, 0., -.1);
  cArm(P, 1, HANG, .15, 1.);
  ${ik(1, 'tR', 'vec3(1., -1., -.6)', 'up')}
  P.elb.y = max(P.elb.y - .3 * gr * up, 0.);                              // the reaches: the forearm opens out after it, twice
  cArm(P, 0, HANG + vec4(.05 * s, .03 * c, 0., 0.), .15 + .05 * s, 1.);
  float hy = .3 * up + .2 * sin(T * t / D), ty = .3 * hy;
  P.torso.y += ty; P.head.y += hy - ty; P.head.x += -.08 * up;`;

// ═══ GUARDED_STANCE (4.8 s): hands in the pocket, hunched (the chest forward, the chin down); a glance over the +x shoulder at 1.0 s
// (the head whips round, the chest follows, the weight onto the −x foot, the +x heel up), held, back; over the −x shoulder at 3.2 s.
const guardedStance = /* glsl */`
  float T = 6.2831853, r = cOut(t, 1.0, 1.25) * (1. - cS(t, 1.75, 2.2)), l = cOut(t, 3.2, 3.45) * (1. - cS(t, 3.95, 4.4));
  cArm(P, 0, ${PK} + vec4(.03 * sin(T * t / D), 0., 0., 0.), ${PK_E}, 1.);
  cArm(P, 1, ${PK} - vec4(.03 * sin(T * t / D), 0., 0., 0.), ${PK_E}, 1.);
  P.torso.x += .1; P.head.x += .1;                                         // hunched, the chin down
  float hy = 1.1 * (r - l) + .12 * sin(T * t / D), ty = .4 * (r - l);
  P.torso.y += ty; P.head.y += hy - ty; P.head.x -= .07 * (r + l);
  float ws = .4 * sin(T * t / D) - .7 * r + .7 * l;
  P.bodyX += .03 * ws; P.pRoll += .085 * ws; P.torso.z -= .04 * ws; P.head.z += .05 * ws;
  cFoot(P, 1, 0., 0., -.2 * r); cFoot(P, 0, 0., 0., -.2 * l);
  float br = sin(2. * T * t / D); P.torso.x += .025 * br; P.head.x -= .01 * br; P.drop += .004 * (.5 - .5 * br);`;

// the walking overlays' entry fields (CLIPS.md § Moods and reactions): moving at the walker's own pace
const OVERLAY = { loop: true, moving: true, stride: 1, speed: 0 };
export const CLIPS = [
  { name: 'wired_walk', dur: 1.2, ...OVERLAY, blendIn: .3, blendOut: .3,
    note: 'a MOVING overlay at the walker\'s own pace (speed 0: the owner moves it; stride 1; no cLegK, cMov or cRot: the legs are the walk\'s): the fists pump bent and hard with the steps (off the walk\'s cycle), the shoulders forward and driving · a sharp nod at each step · a twitchy glance to +x 0.5–0.9 s', glsl: wiredWalk },
  { name: 'spaced_walk', dur: 4.8, ...OVERLAY, blendIn: .5, blendOut: .5,
    note: 'a MOVING overlay at the walker\'s own pace (as wired_walk): loose, lagging arms that trail the legs, the forearms flopping · an extra, late torso roll, the head lolling against it, tipped back, drifting round once a loop', glsl: spacedWalk },
  { name: 'guarded_walk', dur: 4.8, ...OVERLAY, blendIn: .4, blendOut: .4,
    note: 'a MOVING overlay at the walker\'s own pace (as wired_walk): hands in the hoodie pocket (bobbing with the steps), hunched, the chin down · a quick scan over the +x shoulder 0.3–1.35 s, over the −x 2.7–3.75 s', glsl: guardedWalk },
  { name: 'wired_bounce', dur: 1.2, loop: true, blendIn: .25, blendOut: .3,
    note: 'a loop: a boxer\'s bounce on the balls of the feet (two a loop), the −x foot forward, the fists up in the guard · a jab with the lead (−x) fist 0.62–0.86 s, the chest turning into it · a twitch of the head 0.2–0.4', glsl: wiredBounce },
  { name: 'spaced_drift', dur: 6, loop: true, blendIn: .6, blendOut: .6,
    note: 'a loop: a slow circling sway (twice a loop), the head lolling behind it · the +x arm floats up and out in front 0.9–2.4 s, reaches at nothing (twice, 2.5–3.7: the forearm opens out after it), floats down 3.8–5.2; the head watches it', glsl: spacedDrift },
  { name: 'guarded_stance', dur: 4.8, loop: true, blendIn: .4, blendOut: .4,
    note: 'a loop: hands in the hoodie pocket, hunched · a glance over the +x shoulder at 1.0 s (the weight onto the −x foot, the +x heel up), held, back by 2.2 · over the −x shoulder at 3.2 s, back by 4.4', glsl: guardedStance },
];
