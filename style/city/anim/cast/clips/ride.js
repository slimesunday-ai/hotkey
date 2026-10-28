// CLIPS · ride (travel; MOVEMENT.md §2, §7; the ride agent, 2026-10-08). The sim's `scooter` (6.5 m/s) and `bike` (5.5 m/s) items.
// (sit_ride and stand_rail, once planned here, live in transit.js.)
//   scooter_ride  a loop on a stand-up e-scooter: one foot ahead of the other on the deck, both hands on the T-bar, elbows bent, a
//                 slight lean; the knees give over two cracks in the pavement, a glance to the side, a look down the road
//   bike_pedal    a loop seated on the saddle, pedalling: the feet ride the pedals round the cranks, hands on the bars (elbows bent), the
//                 shoulders rock against the pedal strokes; a glance aside. The cadence is the wheel's: 5.5 m/s on 0.30 m wheels, two
//                 wheel turns a crank turn → 1.46 turns a second (88 rpm); six crank turns a loop
//   bike_coast    a loop coasting: the pedals level (the right one forward), the legs still; the rider sits up and stretches the back,
//                 rolls the shoulders, looks back over the left shoulder, settles. Switch to and from bike_pedal on its seams (below)
// THE PROPS (CLIPS.md § Props): ride-props.js's bike and scooter, one model each (the icon, ridden, parked). Their moving PARTS are
// posed by the clip's clock from the SAME expressions the shader poses the body with (the track below: valid GLSL and valid JS), so
// the feet cannot leave the pedals: the crank's angle, the pedals' pitch (= the feet's), the wheels' turn, the scooter deck's bumps.
//   prop.parts / prop.partGeometry(THREE, part, scheme?) / prop.partMatrices(THREE, t, outs?) → [[part, Matrix4 local → walker], …]:
//   what the city instances (one InstancedMesh per part geometry; the walker's matrix × each). prop.geometry / prop.matrix: one live
//   CPU-posed mesh of the whole item for the anim lab's single prop slot (lab.js drawProps), not for the city.
// THE RIG, and what it allows here (walk2.js; chars.js voxels × 0.05):
//   · the feet are fixed in x (ankles ±0.125, the shoes' centres ±0.175): a pedal sits under each shoe's centre, the cranks run inboard
//     of the shoes (x ±0.025…0.05) and every frame tube between the legs is one tube wide at the midline, below the knees
//   · THE SEAT (falls.js header: the leg cloth is built in the foot's frame, so the hip must stay ≥ ~0.12 m above the ankle along the
//     foot's up axis): the legs are the cast's standing legs (P.ank / P.fp from the pedals; the pelvis stays at its rest height and the
//     root lifts it onto the saddle), so no sitting knee is needed. What a bent knee costs here is the cloth's SHEAR (each ring is laid
//     flat in the foot's frame and slid sideways toward the knee; a long lateral run per ring reads as the jagged slab of a deep crouch,
//     stairs_up's look). The shear grows with the crank, so the pedals' circle is set forward and below the hip (a "flat-foot" cruiser:
//     the bottom bracket 0.20 m ahead of the hip), the cranks are short (0.05 m: 0.07 doubled the worst shear and the legs read as a
//     crumpled column), and the feet ankle with the stroke (toe up 0.18 rad over the top-front, toe down 0.12 through the bottom). Round
//     the circle the hip stays 0.27–0.33 m above the ankle along the foot's up axis and the knee bends 20–86°
//   · the toon "butt" is the backs of the thighs at the hip (the cloth hangs from there): the saddle sits under them, with a raised back
//     (a cantle) just behind the hips
//   · the arms reach only 0.403–0.453 m from the shoulder (work.js): each hand is put on its grip by a two-bone IK on the elbow (the
//     elbow from the reach, then the shoulder's turn takes the bent arm's grip point onto the grip, the elbow toward a pole: out, down
//     and back), as work.js puts hands on its tools. The grips sit 0.41–0.45 m from the shoulders through every loop, so the elbows bend 35–81°,
//     under the thick sleeve's soft cap (85°): every top bends alike. The bars pass into the fists (the grip, as a tool's handle)
//   · the big head (x ±0.5, y 0.95 up, z −0.35…0.45 off the neck): the grips sit 0.25–0.3 m under its bottom, and the head is kept level
// TRAVEL: every clip here is a STANDING-LEG clip that travels (moving: false, the skate convention): the owner moves the walker at
// `speed` along its heading and keeps the walk weight at 0 (g.w = 0); the walker itself stays on the ground (the root lifts the body
// onto the saddle or the deck; draw the prop at the walker's own matrix). Matching another speed: advance the clip's clock at
// dt × v / speed (the crank and the wheels then turn at v: `ride` below has the numbers).
// SEAMS: bike_pedal's crank is level (the right pedal forward) at every multiple of its crank turn (ride.tc); bike_coast holds that
// pose and starts and ends in it. Pedal → coast: playClip(g, 'bike_coast', { t: 0 }) on the frame bike_pedal's clock crosses a multiple
// of ride.tc. Coast → pedal: playClip(g, 'bike_pedal', { t: 0 }) at a wrap of bike_coast (its loop). The wheels' turn carries over too.
import { BIKE, SCOOTER, PART_IDS, partGeometry, partMatrices, liveMesh } from './ride-props.js';

const f = v => (+v).toFixed(4), TAU = Math.PI * 2;
// ── the shared expressions' helpers on the JS side (clips/index.js CLIP_HELPERS and GLSL's built-ins), as skate.js
const JS = (() => { const cl = (x, a, b) => Math.min(b, Math.max(a, x)), cR = (t, a, b) => cl((t - a) / (b - a), 0, 1);
  return { cR, cS: (t, a, b) => { const x = cR(t, a, b); return x * x * (3 - 2 * x); }, cOut: (t, a, b) => { const x = cR(t, a, b); return 1 - (1 - x) * (1 - x); },
    cIn: (t, a, b) => { const x = cR(t, a, b); return x * x; }, cBump: (t, a, b) => Math.sin(Math.PI * cR(t, a, b)), mix: (a, b, k) => a + (b - a) * k, clamp: cl,
    sin: Math.sin, cos: Math.cos, abs: Math.abs, min: Math.min, max: Math.max, sqrt: Math.sqrt, mod: (x, y) => x - y * Math.floor(x / y), step: (e, x) => x < e ? 0 : 1 }; })();
// a track: [[name, expr], …] (in order; later ones may use earlier ones) → t ↦ { name: value } (the clip clock; a loop wraps it)
function trackFn(T, dur, loop) {
  const ks = Object.keys(JS), fn = new Function(...ks, 't', 'D', `${T.map(([k, e]) => `const ${k} = ${e};`).join(' ')} return { ${T.map(([k]) => k).join(', ')} };`), vals = ks.map(k => JS[k]);
  return t => fn(...vals, loop ? JS.mod(Math.max(t, 0), dur) : Math.max(t, 0), dur);
}
const glslVars = T => T.map(([k, e]) => `float ${k} = ${e};`).join('\n  ');

// ── the arms: each hand's grip point onto a grip fixed in the walker frame (the bar), by the two-bone IK of work.js (the same rig numbers:
// the shoulder pivot, the elbow's hinge line, the mitten's centre). The grip goes walker → body (the clip's root, undone) → the chest's
// rest frame (the standing pelvis, the chest's turn), then the elbow bend from its distance and the arm's turn from its direction.
const SH = { x: .25, y: .825 }, HINGE = { y: .65, z: .05 }, GRIP = { x: .325, y: .39, z: 0 }, ELB = { y: .65 };
const gx = GRIP.x - SH.x, hy = HINGE.y - SH.y, hz = HINGE.z, gy = GRIP.y - HINGE.y, gz = GRIP.z - HINGE.z;
const RA = gx * gx + hy * hy + hz * hz + gy * gy + gz * gz, Bc = 2 * (hy * gy + hz * gz), Bs = 2 * (hy * gz - hz * gy), RB = Math.hypot(Bc, Bs), PHI = Math.atan2(Bs, Bc);
const EMAX = 1.45, REACH = { min: Math.sqrt(RA + RB * Math.cos(EMAX - PHI)), max: Math.sqrt(RA + RB) };
const v3 = a => `vec3(${a.map(x => typeof x === 'string' ? x : f(x)).join(', ')})`;
function handsOn(grips, poles, k = ['1.', '1.']) { return /* glsl */`
  { // THE HANDS ON THE BAR (work.js's IK): the grip, walker → body → the chest's rest frame
    mat3 rR = aRY(cRot.y) * aRX(cRot.x) * aRZ(cRot.z);
    float rL = (A_L1 + A_L2) * .998, rSr = sin(P.pRoll) * A_HIPX;
    float rHip = min(A_HIPY - P.drop, min(P.ank.y + sqrt(max(rL * rL - P.ank.x * P.ank.x - P.bodyX * P.bodyX, 0.)) + rSr, P.ank.w + sqrt(max(rL * rL - P.ank.z * P.ank.z - P.bodyX * P.bodyX, 0.)) - rSr));
    mat3 rMt = transpose(aRZ(P.torso.z + .5 * P.pRoll) * aRX(P.torso.x) * aRY(P.torso.y));
    for (int s = 0; s < 2; s++) {
      float sx = s == 0 ? -1. : 1.;
      vec3 rW = s == 0 ? ${v3(grips[0])} : ${v3(grips[1])}, rB = cPiv + transpose(rR) * (rW - cPiv - cMov);
      vec3 wkT = vec3(0., A_HIPY, A_HIPZ) + rMt * (rB - vec3(P.bodyX, rHip, A_HIPZ)) - vec3(sx * A_SHX, A_SHY, 0.), wkH = s == 0 ? ${v3(poles[0])} : ${v3(poles[1])};
      float wr2 = clamp(dot(wkT, wkT), ${f(REACH.min ** 2)}, ${f(REACH.max ** 2)}), we = ${f(PHI)} + acos(clamp((wr2 - ${f(RA)}) / ${f(RB)}, -1., 1.)), wc = cos(we), ws = sin(we);
      vec3 wv = vec3(sx * ${f(gx)}, ${f(hy)} + wc * ${f(gy)} + ws * ${f(gz)}, ${f(hz)} - ws * ${f(gy)} + wc * ${f(gz)}), wl = vec3(sx * ${f(gx)}, ${f(ELB.y - SH.y)}, 0.);
      vec3 e1 = normalize(wv), e2 = normalize(wl - dot(wl, e1) * e1), f1 = normalize(wkT), f2 = normalize(wkH - dot(wkH, f1) * f1);
      mat3 wR = mat3(f1, f2, cross(f1, f2)) * transpose(mat3(e1, e2, cross(e1, e2)));
      float wb = asin(clamp(wR[1][2], -1., 1.)), wa = atan(-wR[1][0], wR[1][1]), wcc = atan(-wR[0][2], wR[2][2]);
      if (abs(wa) > 1.5707963) { wa -= sign(wa) * 3.14159265; wb = (wb >= 0. ? 3.14159265 : -3.14159265) - wb; wcc += wcc > 0. ? -3.14159265 : 3.14159265; }
      cArm(P, s, vec4(-wb, sx * wa, 0., -sx * wcc), we, s == 0 ? ${k[0]} : ${k[1]});
    }
  }`; }

// ═══ THE BIKE (ride-props.js BIKE): the rider's hip sits 0.20 m behind and 0.3925 m above the bottom bracket (the pedals' circle,
// forward and below), on the saddle; the root lifts the body by LY (the walker stays on the ground)
const B = BIKE, SEAT = { z: .2, y: .42 }, HIP = [B.bb[0] - SEAT.z, B.bb[1] + SEAT.y + B.pedal.top], LY = HIP[1] - .5, MZ = HIP[0] - .025;   // SEAT: the pedals' circle (their tops) off the hip
const RW = B.wheelR, VB = B.speed, TC = TAU * RW * B.gear / VB;           // the crank's turn (s): 0.6854
const BIKE_D = +(6 * TC).toFixed(4);                                     // six crank turns a loop (12 wheel turns)
const CR = B.crank, PED = B.pedal.top;
const FOOT = { up: .125 + PED + .0015, back: .075 };   // (1.5 mm over the pedal: the sole never grazes it)                             // the ankle off the pedal's spindle, in the foot's frame (the pedal under the ball)
// the feet: the ankle = the spindle + Rx(−fp)·(0, up, −back), into the body frame (− the root's lift)
const feet = (thR, fR, fL) => /* glsl */`
  { vec2 sR = vec2(${f(B.bb[0])} + ${f(CR)} * sin(${thR}), ${f(B.bb[1])} + ${f(CR)} * cos(${thR})), sL = vec2(${f(B.bb[0])} - ${f(CR)} * sin(${thR}), ${f(B.bb[1])} - ${f(CR)} * cos(${thR}));
    vec2 aR = sR + vec2(-${f(FOOT.up)} * sin(${fR}) - ${f(FOOT.back)} * cos(${fR}), ${f(FOOT.up)} * cos(${fR}) - ${f(FOOT.back)} * sin(${fR})) - vec2(${f(MZ)}, ${f(LY)});
    vec2 aL = sL + vec2(-${f(FOOT.up)} * sin(${fL}) - ${f(FOOT.back)} * cos(${fL}), ${f(FOOT.up)} * cos(${fL}) - ${f(FOOT.back)} * sin(${fL})) - vec2(${f(MZ)}, ${f(LY)});
    P.ank = vec4(aL.x - A_HIPZ, aL.y, aR.x - A_HIPZ, aR.y); P.fp = vec2(${fL}, ${fR}); }`;
const BG = [[-B.grip[0], B.grip[1], B.grip[2]], [B.grip[0], B.grip[1], B.grip[2]]], BPOLE = [[-1, -.35, -.55], [1, -.35, -.55]];
// the ankling: toe up as the foot comes over the top, toe down through the bottom (+ = toe up)
const ANK = th => `(.03 + .15 * cos(${th} - .6))`;
const W0 = (TC / 4) * VB / RW;   // (the wheels' turn at the seam: coast's wheel carries on from pedal's)
const PEDAL_T = [
  ['th', `1.5707963 + ${f(TAU / TC)} * t`],                 // the right crank's angle from straight up (+ forward): level forward at t 0
  ['fR', ANK('th')], ['fL', ANK('(th + 3.14159265)')],
  ['wheel', `${f(VB / RW)} * t`],                           // both wheels: rolling at 5.5 m/s
  ['gla', 'cS(t, 1.75, 2.1) * (1. - cS(t, 2.55, 2.95))'],    // a glance to the right (a shop window)
  ['dn', 'cBump(t, 3.2, 3.9)'],                             // a look down at the road ahead
];
const COAST_T = [
  ['th', '1.5707963'], ['fR', '.06'], ['fL', '.06'],
  ['wheel', `${f(VB / RW)} * t`],
  ['up', 'cS(t, .3, 1.) * (1. - cS(t, 1.9, 2.5))'],          // sits up, the back arched (a stretch)
  ['rl', 'cBump(t, .8, 1.9)'],                              // the shoulders roll
  ['bk', 'cS(t, 2.3, 2.7) * (1. - cS(t, 3.25, 3.75))'],      // a look back over the left shoulder
];
const TXB = .3;   // the lean onto the bars
function bikeProp(T, dur) { const tr = trackFn(T, dur, true), pose = t => { const r = tr(t); return { wheel: r.wheel, crank: r.th, fpL: r.fL, fpR: r.fR, lift: 0, pitch: 0, stand: 0 }; };
  return propOf('bike', pose); }
// the clip entry's prop (CLIPS.md § Props, plus the parts): see the header
const LIVE = {};
function propOf(item, pose) {
  return { id: item, item, parts: PART_IDS[item], pose,
    partGeometry: (THREE, part, scheme) => partGeometry(THREE, item, part, scheme),
    partMatrices: (THREE, t, outs) => partMatrices(THREE, item, pose(t), outs),
    geometry: THREE => LIVE[item] ||= liveMesh(THREE, item),
    matrix(THREE, t, out = new THREE.Matrix4()) { LIVE[item]?.userData.pose(pose(t)); return out.identity(); } };
}

// ═══ THE SCOOTER (ride-props.js SCOOTER): the rider stands on the deck turned PHI_S (the left foot ahead), the chest turned back
// square to the bar, the head the rest of the way. Two cracks in the pavement a loop: the scooter rides over each (the front wheel,
// then the rear 0.18 s later), the knees take it.
const S = SCOOTER, PHI_S = .5, RWS = S.wheelR, VS = S.speed;
const SC_D = +(50 * TAU * RWS / VS).toFixed(4);            // 50 wheel turns a loop: 4.8332 s
const FZ = [.225, -.075];                                  // the shoes' centres along the body (L ahead): the ankles ±0.15 about the hip
// where the feet land on the deck, and the root that centres them (walker frame): R_y(PHI_S) · body
const rot = (x, z) => [x * Math.cos(PHI_S) + z * Math.sin(PHI_S), -x * Math.sin(PHI_S) + z * Math.cos(PHI_S)];
const SL = rot(-.175, FZ[0]), SR = rot(.175, FZ[1]), SMOV = [-(SL[0] + SR[0]) / 2 + .024, -(SL[1] + SR[1]) / 2];   // (+ x: the chest, not the feet, centred over the deck)
const SG = [[-S.grip[0], S.grip[1], S.grip[2]], [S.grip[0], S.grip[1], S.grip[2]]], SPOLE = [[-1, -.4, -.5], [1, -.4, -.5]];
const SBUMP = (a) => `(cBump(t, ${f(a)}, ${f(a + .12)}) * .5 + cBump(t, ${f(a + .18)}, ${f(a + .3)}) * .5)`;
const SCOOT_T = [
  ['wheel', `${f(VS / RWS)} * t`],
  ['fb', `cBump(t, 1.2, 1.3) + cBump(t, 3.5, 3.6)`],          // the front wheel over a crack
  ['rb', `cBump(t, 1.38, 1.48) + cBump(t, 3.68, 3.78)`],      // … then the rear
  ['lift', '.012 * (fb + rb) * .5'],                        // the jolt (the whole scooter, both wheels' bumps)
  ['give', `cBump(t, 1.22, 1.75) + .8 * cBump(t, 3.52, 4.05)`],  // the knees take the bumps
  ['gla', 'cS(t, .4, .75) * (1. - cS(t, 1.0, 1.35))'],        // a glance left
  ['lk', 'cS(t, 2.3, 2.6) * (1. - cS(t, 3.0, 3.35))'],       // a look right, down the cross street
];
function scooterProp() { const tr = trackFn(SCOOT_T, SC_D, true), pose = t => { const r = tr(t); return { wheel: r.wheel, crank: 0, fpL: 0, fpR: 0, lift: r.lift, pitch: 0, stand: 0 }; };
  return propOf('scooter', pose); }

export const CLIPS = [
  { name: 'scooter_ride', dur: SC_D, loop: true, blendIn: .3, blendOut: .3, speed: VS, prop: scooterProp(),
    ride: { item: 'scooter', v: VS, wheelR: RWS },
    note: 'a loop at 6.5 m/s on the e-scooter (prop: scooter; a standing-leg clip that travels: the owner moves the walker, g.w = 0): turned 29° on the deck, the left foot ahead, the chest square to the T-bar, both hands on its grips (elbows bent), a slight lean · a glance left 0.4–1.35 s · the front wheel, then the rear, over a crack at 1.2 and 3.5 (the scooter jolts 6 mm, the knees give) · a look right 2.3–3.35. Start riders at a random t',
    glsl: /* glsl */`
  ${glslVars(SCOOT_T)}
  cRot.y = ${f(PHI_S)}; cMov = vec3(${f(SMOV[0])}, ${f(S.deck.top + .0015)}, ${f(SMOV[1])});   // (the soles 1.5 mm over the deck)
  // the feet flat on the deck; the root rides its bumps
  cFoot(P, 0, ${f(FZ[0] - .075)}, 0., 0.); cFoot(P, 1, ${f(FZ[1] - .075)}, 0., 0.); cMov.y += lift;
  P.drop = .045 + .035 * give; P.bodyX = 0.; P.pRoll = 0.;
  float ty = ${f(-PHI_S)} - .05 * gla + .06 * lk;
  float lean = .25 + .03 * give;   // (a lean toward the travel: the chest's pitch axis is the hips', turned PHI_S off it, so it is split into pitch and roll)
  P.torso = vec3(lean * ${f(Math.cos(PHI_S))}, ty, lean * ${f(Math.sin(PHI_S))});
  P.head = vec3(-.12 - .03 * give + .05 * cBump(t, 2.3, 3.35), ${f(-.05)} - .55 * gla + .7 * lk, -.02);
  ${handsOn(SG, SPOLE)}` },

  { name: 'bike_pedal', dur: BIKE_D, loop: true, blendIn: .3, blendOut: .3, speed: VB, prop: bikeProp(PEDAL_T, BIKE_D),
    ride: { item: 'bike', v: VB, wheelR: RW, gear: B.gear, tc: +TC.toFixed(6), crank0: Math.PI / 2 },
    note: `a loop at 5.5 m/s on the bike (prop: bike; a standing-leg clip that travels: the owner moves the walker, g.w = 0): seated, the feet on the pedals round the cranks at 88 rpm (one turn ${f(TC)} s: the 0.30 m wheels at 5.5 m/s, two wheel turns a crank turn), the heels drop over the top, hands on the grips (elbows bent), leaning on; the shoulders rock against the strokes · a glance right 1.75–2.95 s · a look down the road 3.2–3.9. Level (right pedal forward) at every multiple of ${f(TC)} s: switch to bike_coast there`,
    glsl: /* glsl */`
  ${glslVars(PEDAL_T)}
  cMov = vec3(0., ${f(LY)}, ${f(MZ)});
  ${feet('th', 'fR', 'fL')}
  P.drop = 0.; P.bodyX = 0.; P.pRoll = 0.;
  float rk = sin(th);                                        // the stroke: + while the right foot pushes down
  float ty = .03 * rk + .04 * gla;
  P.torso = vec3(${f(TXB)} + .01 * cos(2. * th) + .02 * dn, ty, .02 * rk);
  P.head = vec3(${f(-TXB + .08)} + .18 * dn - .015 * cos(2. * th), -ty + .75 * gla, -.03 * rk);
  ${handsOn(BG, BPOLE)}` },

  { name: 'bike_coast', dur: BIKE_D, loop: true, blendIn: .3, blendOut: .3, speed: VB, prop: bikeProp(COAST_T.map(([k, e]) => k === 'wheel' ? [k, `${f(W0)} + ${e}`] : [k, e]), BIKE_D),
    ride: { item: 'bike', v: VB, wheelR: RW, gear: B.gear, tc: +TC.toFixed(6), crank0: Math.PI / 2 },
    note: 'a loop at 5.5 m/s coasting (prop: bike; the owner moves the walker, g.w = 0): the pedals level, the right one forward, the legs still · sits up and stretches the back 0.3–2.5 s, the shoulders roll 0.8–1.9 · a look back over the left shoulder 2.3–3.75 · settles. Starts and ends on bike_pedal\'s level pose: switch on the seams',
    glsl: /* glsl */`
  ${glslVars(COAST_T.map(([k, e]) => k === 'wheel' ? [k, `${f(W0)} + ${e}`] : [k, e]))}
  cMov = vec3(0., ${f(LY)}, ${f(MZ)});
  ${feet('th', 'fR', 'fL')}
  P.drop = 0.; P.bodyX = 0.; P.pRoll = 0.;
  float ty = -.08 * bk;
  P.torso = vec3(${f(TXB)} - .05 * up - .02 * rl, ty, .025 * rl * sin(6.2831853 * cR(t, .8, 1.9)));
  P.head = vec3(${f(-TXB + .08)} - .12 * up - .06 * rl, -ty - 1.2 * bk, .05 * bk);
  ${handsOn(BG, BPOLE)}` },
];
