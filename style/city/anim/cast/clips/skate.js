// CLIPS · skate (travel; MOVEMENT.md §2, §6, §7B; the skate agent, 2026-10-07). The sim's `skateboard` item: 4 m/s on the sidewalks.
//   skate_push       a loop: from the ride stance the rider turns to face ahead, two pushes with the back foot, back onto the tail
//   skate_ride       a loop: the sideways stance, a slight crouch, arms out for balance, a slow carve (the board rolls with the lean)
//   skate_kickturn   a one-shot: the tail presses, the nose lifts, the board pivots 90° on its back wheels, the nose slaps down → ride
//   skate_kickturn_r the same turn the other way (the walker's yaw −90° instead of +90°)
//   skate_ollie      a one-shot: the feet set up, crouch, pop (the tail slaps), the board rises to the tucked feet, a knee-bend land → ride
// THE BOARD is a prop (CLIPS.md § Props): one voxel model (skate-board.js) the city draws under the walker, posed by the clip's clock.
// Its pose and the feet come from the SAME expressions (BT below: valid GLSL and valid JS), so the shader's feet and the CPU's board agree.
//
// THE STANCE (the rig: hips at x ±0.125, the shoes 0.25 × 0.45 m centred at x ±0.175, z +0.075 off the cFoot point; one-piece legs by IK):
// the rider's feet are always 0.35 m apart across the body, so a sideways stance is the WHOLE body turned φ off the board (cRot.y), the
// +x foot to the nose (on the nose side of the board) and the −x foot to the tail. One foot's sole centre is pinned to its spot on the
// deck (cPiv, cMov); the other's height and place follow from the board's pitch. The body stands on the deck through the root (cMov.y =
// the deck's height under the pinned foot), so the walker itself stays at ground level. Feet stay flat (no foot roll in the rig): on a
// pitched board the body rolls part of the way with it (cRot.z) and the upper body leans back against it.
//   ride stance φ = −1.40 (≈ −80°: the toes a touch to the nose), the feet over the bolts (deck z +0.18 / −0.175), the chest opened
//   0.35 toward the travel, the head the rest of the way: the big head looks where the board goes.
// TRAVEL: every skate clip is a STANDING-LEG clip (moving: false) on a walker that travels. The owner moves the walker at `speed` and keeps
// the walk weight at 0 (g.w = 0: the legs are the clip's). `speed` here is that travel speed, for the owner (and the lab's label).
// TURNS: a kickturn turns the walker. On the frame it ends (stepClip's state.shiftNow is set; it chains into skate_ride) the owner moves
// the walker by the shift (body frame, CLIPS.md § Root motion) AND turns its yaw by `turn` (rad). Stop the travel while it plays.
// SEAMS: every clip starts and ends in the base ride stance (skate_push at its loop seam, skate_ride at t = 0), so push ↔ ride ↔ the
// one-shots switch without a pop if push hands over at its seam (state.t crosses a multiple of 2 s).
import { BOARD, REST, boardGeometry, boardMatrix } from './skate-board.js';

const f = v => (+v).toFixed(4), H = BOARD.deck, AXL = BOARD.axle;
const FX = .175, FZ = .075, SEPX = 2 * FX;                 // the shoes' sole centres: x ±0.175, z +0.075 off the cFoot point
const PHI = -1.4, ZB = SEPX * Math.cos(PHI) / Math.sin(PHI), SEP = SEPX / Math.sin(PHI);   // the ride stance; the back foot's place (R and deck)
const FZS = .18;                                            // the front foot's deck spot (the back one: FZS + SEP = −0.175)
const B0 = { drop: .055, tx: .05, ty: .35, hy: .93 * -PHI - .35 };   // the base ride stance: crouch, lean, the chest open, the head to the travel
const ARM_LEAD = [.22, 1.12, .05, -.2], ARM_TRAIL = [-.12, .92, 0, .1];   // balance: the +x (nose-side) arm out ahead, the −x trailing
const v4 = a => `vec4(${a.map(f).join(', ')})`;

// ── the board track: expressions in t (the clip clock) and D (its length). bW (yaw) and bP (pitch) come first; the others may use them.
// The JS side evaluates them with the same helpers (cS, cOut, cBump… as clips/index.js CLIP_HELPERS, and GLSL's mix / clamp / sin…).
const BT0 = { yaw: '0.', pitch: '0.', pz: '0.', x: '0.', y: '0.', z: '0.', roll: '0.' };
const JS = (() => { const cl = (x, a, b) => Math.min(b, Math.max(a, x)), cR = (t, a, b) => cl((t - a) / (b - a), 0, 1);
  return { cR, cS: (t, a, b) => { const x = cR(t, a, b); return x * x * (3 - 2 * x); }, cOut: (t, a, b) => { const x = cR(t, a, b); return 1 - (1 - x) * (1 - x); },
    cIn: (t, a, b) => { const x = cR(t, a, b); return x * x; }, cBack: (t, a, b) => { const x = cR(t, a, b) - 1; return 1 + x * x * (2.7 * x + 1.7); },
    cBump: (t, a, b) => Math.sin(Math.PI * cR(t, a, b)), mix: (a, b, k) => a + (b - a) * k, clamp: cl, sin: Math.sin, cos: Math.cos, abs: Math.abs,
    min: Math.min, max: Math.max, sqrt: Math.sqrt, mod: (x, y) => x - y * Math.floor(x / y), step: (e, x) => x < e ? 0 : 1, smoothstep: (a, b, t) => { const x = cl((t - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); } }; })();
function trackFn(B, dur, loop) {
  const b = { ...BT0, ...B }, ks = Object.keys(JS);
  const fn = new Function(...ks, 't', 'D', `const bW = ${b.yaw}, bP = ${b.pitch}; return { yaw: bW, pitch: bP, pz: ${b.pz}, x: ${b.x}, y: ${b.y}, z: ${b.z}, roll: ${b.roll} };`);
  const vals = ks.map(k => JS[k]);
  return t => fn(...vals, loop ? JS.mod(Math.max(t, 0), dur) : Math.max(t, 0), dur);
}
// the clip entry's prop (CLIPS.md § Props): the model and its pose at the clip clock t (s; a loop wraps it itself)
function propOf(B, dur, loop) {
  const pose = trackFn(B, dur, loop);
  return { id: 'skateboard', geometry: (THREE, scheme) => boardGeometry(THREE, scheme), pose, matrix: (THREE, t, out) => boardMatrix(THREE, pose(t), out) };
}

// ── the GLSL: the board, then the rider on it. o: { pin: 'front' | 'back', spot (the pinned foot's deck z), phi, rz (root roll), rx (root pitch),
// back: { on (1 = on its deck spot), z (R-frame cFoot z off the board), lift (m above the GROUND off the board), fp } }. Writes cRot /
// cPiv / cMov and both feet, and leaves fY / gY (deck heights under the feet) and phi for the clip's own body.
function rig(B, o) {
  const b = { ...BT0, ...B }, phi = o.phi ?? f(PHI), rz = o.rz ?? '0.', rx = o.rx ?? '0.', bk = o.back || null;
  const zF = '0.', zB = f(ZB);
  return /* glsl */`
  // the board (the prop's pose: the same expressions; skate-board.js boardMatrix)
  float bW = ${b.yaw}, bP = ${b.pitch};
  float bPz = ${b.pz}, bX = ${b.x}, bY = ${b.y}, bZ = ${b.z};
  float bc = cos(bP), bs = sin(bP); vec2 bF = vec2(sin(bW), cos(bW));
  // the deck spots under the feet (centre line): height, and where they lie along the board once it pitches
  ${o.pin === 'back' ? `float gz = ${o.spot ?? f(FZS + SEP)}, fz = gz - ${f(SEP)} / bc;` : `float fz = ${o.spot ?? f(FZS)}, gz = fz + ${f(SEP)} / bc;`}   // (the pinned foot's spot is fixed; the other slides as the deck pitches)
  float fY = bY + bc * ${f(H)} + bs * (fz - bPz), gY = bY + bc * ${f(H)} + bs * (gz - bPz);
  vec2 fW = vec2(bX, bZ) + (bPz + bc * (fz - bPz) - bs * ${f(H)}) * bF, gW = vec2(bX, bZ) + (bPz + bc * (gz - bPz) - bs * ${f(H)}) * bF;
  // the rider: turned phi off the board, rolled rz with it, one sole centre pinned on its spot
  float phi = ${phi}, rz = ${rz};
  cRot = vec3(${rx}, bW + phi, rz);
  ${o.pin === 'back'
    ? `cPiv = vec3(${f(-FX)}, 0., ${zB} + ${f(FZ)}); cMov = vec3(gW.x, gY, gW.y) - cPiv;
  cFoot(P, 0, ${zB}, 0., 0.);
  cFoot(P, 1, ${zF}, (fY - gY - ${f(SEPX)} * sin(rz)) / cos(rz), 0.);`
    : `cPiv = vec3(${f(FX)}, 0., ${zF} + ${f(FZ)}); cMov = vec3(fW.x, fY, fW.y) - cPiv;
  cFoot(P, 1, ${zF}, 0., 0.);
  ${bk ? `float bOn = ${bk.on}; cFoot(P, 0, mix(${bk.z}, ${zB}, bOn), mix(${bk.lift} - fY, gY - fY, bOn) / cos(rz) + ${f(SEPX)} * tan(rz), ${bk.fp ?? '0.'});`
         : `cFoot(P, 0, ${zB}, (gY - fY + ${f(SEPX)} * sin(rz)) / cos(rz), 0.);`}`}`;
}
// the base ride stance's upper body (k = how much), on top of whatever the clip sets
const rideBody = k => /* glsl */`
  P.drop += ${f(B0.drop)} * ${k}; P.torso.x += ${f(B0.tx)} * ${k}; P.torso.y += ${f(B0.ty)} * ${k}; P.head.y += ${f(B0.hy)} * ${k}; P.head.x -= .04 * ${k};
  cArm(P, 1, ${v4(ARM_LEAD)}, ${k}); cArm(P, 0, ${v4(ARM_TRAIL)}, ${k});`;

// ── the clips
const PUSH_D = 2, RIDE_D = 4.8, KT_D = .75, OL_D = .8;
const RIDE_B = { roll: `.075 * sin(12.566371 * t / ${f(RIDE_D)})` };         // the carve (two a loop): the board rolls with the rider's toe / heel lean
const ktB = s => ({ yaw: `${f(s * Math.PI / 2)} * cBack(t, .16, .5)`, pitch: '.42 * cOut(t, .07, .17) * (1. - cIn(t, .44, .53))', pz: f(-AXL),
  x: `${f(AXL)} * sin(bW)`, z: `${f(-AXL)} + ${f(AXL)} * cos(bW)` });
const OL_B = { pitch: '.46 * cOut(t, .19, .235) * (1. - cS(t, .25, .4))', pz: f(-AXL), y: '.34 * cOut(t, .225, .4) * (1. - cIn(t, .4, .56))',
  z: '.12 * (cS(t, 0., .16) - cS(t, .6, .8))' };

// one push stroke at clip time t, starting at s0 (0.6 s): the back foot reaches, plants, sweeps back at ground speed (0.3 m in 0.075 s
// = 4 m/s: planted, on the travelling walker), kicks out behind with the toe down, and swings back to hover beside the board
const stroke = s0 => { const q = `(t - ${f(s0)})`;
  return { z: `(.15 * cS(${q}, 0., .11) - .3 * cR(${q}, .11, .185) - .17 * cOut(${q}, .185, .28) + .32 * cS(${q}, .28, .6))`,
    lift: `(.07 * (1. - cIn(${q}, 0., .11)) + .06 * cOut(${q}, .185, .28) + .01 * cS(${q}, .28, .6) + .03 * cBump(${q}, .28, .6))`,
    fp: `(.12 * cBump(${q}, 0., .12) - .55 * cBump(${q}, .15, .44))` }; };
const S1 = stroke(.25), S2 = stroke(.85);
const PHIP = -.09;   // the push stance: facing ahead, the front foot along the board

export const CLIPS = [
  { name: 'skate_push', dur: PUSH_D, loop: true, blendIn: .25, blendOut: .3, speed: 4, prop: propOf({}, PUSH_D, true),
    note: 'a loop from the ride stance: turns to face ahead 0–0.25 s, the back foot off the tail · push 0.25–0.85 and 0.85–1.45 (plant, sweep at 4 m/s, kick out behind, toe down) · back onto the tail as the body turns sideways 1.42–1.7 · settles; the seam IS the ride stance',
    glsl: /* glsl */`
  float kR = 1. - cS(t, .02, .24) + cS(t, 1.42, 1.7);          // 1 = the ride stance, 0 = the push stance
  float inP = step(t, .85);                                     // which stroke
  float sz = mix(${S2.z}, ${S1.z}, inP), sl = mix(${S2.lift}, ${S1.lift}, inP), sf = mix(${S2.fp}, ${S1.fp}, inP);
  float act = cS(t, .2, .25) * (1. - cS(t, 1.45, 1.5));          // the strokes run between the turns (hover before and after)
  sz *= act; sf *= act; sl = mix(.07, sl, act);
  float on = 1. - cS(t, .02, .2) + cS(t, 1.5, 1.68);            // the back foot on its deck spot (lifted over the rim between)
  ${rig({}, { pin: 'front', phi: `mix(${f(PHIP)}, ${f(PHI)}, kR)`,
    back: { on: 'on', z: 'sz', lift: `sl + .09 * (cBump(t, .02, .24) + cBump(t, 1.46, 1.7))`, fp: 'sf' } })}
  ${rideBody('kR')}
  // the push stance: upright, leaning into each plant, the head on the travel; the arms swing against the push leg
  float pk = 1. - kR, za = sz / .32;
  P.drop += .012 * pk + .015 * act * (cBump(t, .33, .5) + cBump(t, .93, 1.1));
  P.torso.x += pk * (.06 + .1 * act * (cBump(t, .3, .55) + cBump(t, .9, 1.15)));
  P.head.y += pk * .93 * ${f(-PHIP)}; P.head.x -= .5 * (P.torso.x - ${f(B0.tx)} * kR);
  P.torso.y -= .12 * za * pk;                                   // the shoulders counter the stroke (the push side's shoulder back as its foot reaches)
  // the arms swing against the legs (the push side's arm back as its foot reaches), held 22° out: the plant folds the board knee
  // deep and the thighs rise, so a hand hung close would meet them
  cArm(P, 1, vec4(.45 * za + .05, .38, .05, .2), pk); cArm(P, 0, vec4(-.45 * za + .05, .38, .05, .2), pk);
  P.bodyX -= .03 * pk;                                          // the weight over the board foot` },

  { name: 'skate_ride', dur: RIDE_D, loop: true, blendIn: .25, blendOut: .3, speed: 4, prop: propOf(RIDE_B, RIDE_D, true),
    note: 'a loop at 4 m/s: the sideways stance (φ −80°, feet over the bolts), knees soft, the chest and head turned to the travel, arms out for balance · two slow carves (toe / heel lean, the board rolls with it, 2.4 s each), the hips shift nose ↔ tail and the knees pump with each · a glance down at the board 1–1.9 s · a look back over the trailing shoulder 2.9–4.2 s. Start riders at a random t so a crowd does not carve in step',
    glsl: /* glsl */`
  float T = 6.2831853, ph = T * t / D;
  ${rig(RIDE_B, { pin: 'front', rx: '.075 * sin(12.566371 * t / D)' })}
  ${rideBody('1.')}
  P.drop += .014 * (.5 - .5 * cos(4. * ph));                   // the knees pump twice a carve
  P.bodyX += .02 * sin(4. * ph);                                // the hips: toward the nose, the tail
  P.torso.z -= .04 * sin(4. * ph); P.head.z += .03 * sin(4. * ph);
  P.head.x -= .075 * sin(2. * ph);                              // (the head stays level through the carve)
  P.armR += vec2(.08, -.06) * sin(2. * ph); P.armP += vec2(.06, -.05) * sin(4. * ph);   // the arms float, against the lean
  // life: a glance down at the board ahead, then a check over the trailing shoulder (who's behind?)
  float gl = cBump(t, 1., 1.9), bk = cS(t, 2.9, 3.25) * (1. - cS(t, 3.75, 4.2));
  P.head.x += .22 * gl; P.head.y -= .75 * bk; P.torso.y -= .12 * bk; P.armR.x += .12 * bk;` },

  ...[[1, 'skate_kickturn'], [-1, 'skate_kickturn_r']].map(([s, name]) => ({
    name, dur: KT_D, next: 'skate_ride', blendIn: .1, blendOut: .3, speed: 0, shift: [s * AXL, -AXL], turn: s * Math.PI / 2, prop: propOf(ktB(s), KT_D, false),
    note: `a one-shot (stop the travel): weight back, a wind-up 0–0.15 s · the tail presses, the nose lifts 0.07–0.17 · the board pivots ${s > 0 ? '+' : '−'}90° on its back wheels 0.16–0.5 (overshoots, settles), the shoulders and the head lead · the nose slaps down 0.44–0.53, the knees take it · ride stance → skate_ride. Root motion: shift [${f(s * AXL)}, ${f(-AXL)}], turn ${s > 0 ? '+' : '−'}π/2 on the end frame`,
    glsl: /* glsl */`
  ${rig(ktB(s), { pin: 'back', rz: '.42 * bP' })}
  ${rideBody('1.')}
  float up = bP / .42;
  P.drop += .035 * cS(t, 0., .12) * (1. - cS(t, .3, .5)) + .05 * cOut(t, .52, .58) * (1. - cS(t, .58, .75));
  P.torso.z -= .32 * bP;                                         // the upper body stays over the tail as the body rolls with the board
  P.bodyX -= .04 * up;                                          // the hips over the back foot
  P.torso.y += ${f(s)} * (-.18 * cBump(t, 0., .2) + .3 * cBump(t, .16, .62));   // a wind-up, then the shoulders lead the pivot
  P.head.y += ${f(s)} * .5 * cS(t, .06, .22) * (1. - cS(t, .38, .66));          // the head looks into the turn first
  P.armR += vec2(.28, .2) * cBump(t, .1, .62); P.armP.y += .25 * cBump(t, .1, .55) * ${f(s)}; P.armP.x -= .25 * cBump(t, .1, .55) * ${f(s)};` })),

  { name: 'skate_ollie', dur: OL_D, next: 'skate_ride', blendIn: .1, blendOut: .3, speed: 4, prop: propOf(OL_B, OL_D, false),
    note: 'a one-shot at 4 m/s: the back foot slides onto the tail, a crouch 0–0.19 s, eyes on the board · POP 0.19–0.235: the tail slaps, the body springs · the board rises to the tucked feet and levels out, peak 0.34 m at 0.4 · the drop, a knee-bend land at 0.56 with the arms out · ride stance → skate_ride',
    glsl: /* glsl */`
  float sl = cS(t, 0., .16) - cS(t, .6, .8);
  ${rig(OL_B, { pin: 'back', spot: `${f(FZS + SEP)} - .12 * sl`, rz: '.3 * bP' })}
  ${rideBody('1.')}
  float crouch = cS(t, .03, .19) * (1. - cOut(t, .19, .25)), air = cBump(t, .23, .54), land = cOut(t, .555, .6) * (1. - cS(t, .6, .78));
  P.drop += .085 * crouch - .02 * cBump(t, .2, .3) + .16 * air + .085 * land;   // crouch, spring, tuck the knees up, take the land
  P.torso.x += .2 * crouch + .06 * air + .14 * land; P.head.x += .2 * crouch - .1 * cBump(t, .2, .45) - .1 * land;
  P.torso.z -= .25 * bP;
  // the arms: down and back in the crouch, up and out on the pop, held wide in the air, out and settling on the land
  vec4 dn = vec4(-.35, .42, 0., 0.), wide = vec4(.25, 1.45, .05, -.2);
  float aDn = crouch, aUp = cOut(t, .2, .3) * (1. - cS(t, .56, .8));
  cArm(P, 1, dn, aDn); cArm(P, 0, dn, aDn); cArm(P, 1, wide, aUp); cArm(P, 0, wide + vec4(-.3, -.15, 0., 0.), aUp);
  P.armR += vec2(.12) * land;` },
];
