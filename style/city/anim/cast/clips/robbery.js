// CLIPS · robbery (events; MOVEMENT.md §7C; the events agent's spec, 2026-10-07). The five clips a street robbery is made of:
//   rob_lunge_grab   the robber: rocks back (fists chambered), lunges, both arms snap out, fists close on the victim's front and
//                    yank, snatches the loot in to the chest
//   hit_stumble_back the victim: the chest takes it, the upper body snaps back, three backward steps with the arms flung out, caught
//   run_getaway      the robber's run: a long stride, a 15° lean, one arm pumping (elbow bent), the other fist clutching the loot to the chest
//   hands_up_point   the victim of a seen robbery: hands shoot up beside the head, a tremble, then one arm points after the robber (held)
//   pat_pockets      the victim of an unseen one: slaps the hip pockets, then the chest, head down; then a shrug, looks up and around (loop)
// Pairs: rob_lunge_grab plays hit_stumble_back on the victim, gap m in front of it and facing it, delay s after its own start (contact).
// THE ELBOW (the elbow-robbery agent, 2026-10-09; ../ELBOW.md): rob_lunge_grab, run_getaway, hands_up_point and pat_pockets were first
// authored with one-piece arms (a raised T for hands up, a straight arm across the belly for the loot); they now bend the elbow with the
// 5-argument cArm. Every timing, root move, step, shift, pair and speed is as before: only the arms (and, in pat_pockets, how far the
// head drops while the hands are at the chest) changed. The poses were found by a search through the real shader (transform feedback:
// the forearm and hand against the chest, its flank, the core and the head, on the bare body, a slim tee and the Bubble Goose):
//   · HANDS UP = [.22, 1.22, 0, −1.57], elbow 1.38: the upper arms out, the forearms up beside the head (the twist folds the elbow up),
//     palms forward, the hands at the head's lower corners (y ~1.0, x ±0.6). The big head (x ±0.5, y 0.9–1.7, z −0.35…0.45) sits over the
//     shoulders (x ±0.25, y 0.825) and the arm is 0.525 m to the fingertips, so the hands can't go higher without entering the head.
//   · THE CLUTCH = [.8, .35, 0, .7], elbow 1.3: the elbow out at the side, the forearm across the chest, the fist at the sternum (chest
//     frame x 0.13, y 0.78, z 0.38). It can't come closer: the toon forearm then cuts the chest (the talk agent's finding too).
//   · THE CHEST (pat_pockets) = [.65, .45, 0, .55], elbow 1.4, both hands (x ±0.18, y 0.77); THE SHRUG = [.15, .5, 0, −.6], elbow 1.4.
// Arms are [pitch fwd, roll out, yaw in, twist in] (rad) + the elbow; torso / head: x = pitch forward (head: look down), y = yaw (+: the
// front turns to +x), z = roll. Feet: cFoot (body-frame z of the foot's ground point).
const CLUTCH = 'vec4(.8, .35, 0., .7)', CLUTCH_E = '1.3';   // the loot clutched to the chest (the +x arm): rob_lunge_grab's end, run_getaway
export const CLIPS = [
  { name: 'rob_lunge_grab', dur: .9, hold: true, blendIn: .08, blendOut: .2, shift: [0, .16],
    pair: { with: 'hit_stumble_back', gap: 1.15, delay: .34 },
    note: 'lean back, fists chambered at the ribs 0–0.22 s · both arms snap out straight 0.25–0.42 (contact) · fists close and yank 0.45–0.7 · snatch the loot in to the chest 0.7–0.9; ends clutching it, ready to run',
    glsl: /* glsl */`
  // the root: rocks back 4 cm on the wind-up, lunges 28 cm to contact, gives 8 cm back on the snatch
  float m = -.04 * cS(t, 0., .2) + .28 * cOut(t, .22, .42) - .08 * cS(t, .7, .9); cMov.z = m;
  // the feet: the +x foot stays planted (its heel comes up in the lunge); the −x foot steps in 34 cm
  cFoot(P, 1, -m, 0., -.42 * cS(t, .24, .42) + .3 * cS(t, .7, .9));
  cFoot(P, 0, cStep(t, .2, .38, 0., .34) - m, cLift(t, .2, .38, .07), .22 * cBump(t, .26, .44));
  // the body: back, then snaps forward past it (overshoot), then upright as the loot comes in
  P.torso.x += -.2 * cS(t, 0., .2) + .5 * cBack(t, .22, .4) - .2 * cS(t, .7, .9);
  P.torso.y += -.12 * cS(t, 0., .2) + .12 * cOut(t, .22, .36) + .1 * cS(t, .7, .9);   // a coil away and back; the loot side turns in
  P.head.x += .12 * cS(t, 0., .2) - .3 * cOut(t, .24, .4) + .12 * cBump(t, .38, .56) + .14 * cS(t, .7, .9);   // eyes on the mark; the whip
  P.drop += .03 * cS(t, 0., .2) * (1. - cS(t, .22, .3));
  // the arms: chambered (the upper arms back, the elbows bent, the fists at the ribs), thrust (the elbows snap straight a beat after
  // the shoulders: the whip; palms out), fists closed on the front and yanked (the elbows pump), then the snatch: the +x fist in to the
  // sternum (the clutch, run_getaway's arm), the −x arm down, loose
  vec4 W = vec4(-.7, .4, 0., -.2), T = vec4(1.45, .04, .2, -.2), G = vec4(1.26, .02, .25, .55);
  vec4 a = mix(mix(vec4(0., .06, 0., 0.), W, cS(t, 0., .2)), T, cOut(t, .22, .38)); a = mix(a, G, cS(t, .42, .5));
  float e = 1.6 * cS(t, 0., .2) * (1. - cOut(t, .25, .4)) + .2 * cS(t, .42, .52);
  float tug = sin(t * 56.) * cR(t, .46, .5) * (1. - cR(t, .66, .7));
  a.x += .04 * tug; e += .15 * tug;
  cArm(P, 0, mix(a, vec4(.12, .16, .08, 0.), cOut(t, .7, .86)), mix(e, .2, cOut(t, .7, .86)), 1.);
  cArm(P, 1, mix(a, ${CLUTCH}, cOut(t, .7, .84)), mix(e, ${CLUTCH_E}, cOut(t, .7, .84)), 1.);
  cBreathe(P, t, cS(t, .9, 1.4));` },

  { name: 'hit_stumble_back', dur: .8, blendIn: .04, blendOut: .3, shift: [0, -.52],
    note: 'the chest takes it 0–0.1 s · the upper body snaps back · 3 steps back (R, L, R) to 0.58 with the arms flung out, windmilling · balance caught 0.6–0.8; ends 0.52 m back (shift)',
    glsl: /* glsl */`
  float hit = cOut(t, 0., .09);
  float m = -.52 * cOut(t, .02, .62); cMov.z = m;   // the body travels back, fast then slowing
  // three steps back: +x at 0.08–0.24, −x at 0.22–0.40, +x again (the catch) at 0.40–0.58; the toe lands first
  float zR = cStep(t, .08, .24, 0., -.28) + cStep(t, .4, .58, 0., -.3), zL = cStep(t, .22, .4, 0., -.46);
  cFoot(P, 1, zR - m, cLift(t, .08, .24, .06) + cLift(t, .4, .58, .04), -.3 * cBump(t, .08, .28) - .25 * cBump(t, .4, .62));
  cFoot(P, 0, zL - m, cLift(t, .22, .4, .07), -.3 * cBump(t, .22, .44));
  // the upper body snaps back (overshoot) and comes up as the balance is caught; the head lags, then looks up
  P.torso.x += -.42 * cBack(t, 0., .1) + .32 * cS(t, .45, .78);
  P.head.x += .32 * cBump(t, 0., .22) - .14 * cS(t, .15, .4) + .12 * cS(t, .6, .8);
  P.torso.z += .08 * sin(t * 13.) * (1. - cS(t, .5, .8)) * hit; P.head.z -= .06 * sin(t * 13. - .6) * (1. - cS(t, .5, .8)) * hit;
  P.drop += .04 * cBump(t, 0., .3) + .03 * cBump(t, .55, .8);   // the knees give on the hit, and once more on the catch
  // the arms: flung out forward and wide, windmilling against each other, then down and out (steadying)
  float wm = .5 * sin(t * 22.) * cR(t, .08, .14) * (1. - cS(t, .5, .66));
  vec4 F = vec4(.75, 1.25, 0., .3), S = vec4(.15, .38, 0., .1);
  cArm(P, 0, mix(F + vec4(wm, 0., 0., 0.), S, cS(t, .55, .8)), hit);
  cArm(P, 1, mix(F - vec4(wm, 0., 0., 0.), S, cS(t, .55, .8)), hit);` },

  { name: 'run_getaway', dur: .55, loop: true, moving: true, speed: 2.9, stride: 2, blendIn: .15, blendOut: .3,
    note: 'a moving loop: the walk at 2.9 m/s with the stride doubled (g.scale 2: one cycle = 1.6 m = 0.55 s), the hips and knees ×1.55 / ×1.6, a 15° lean, the −x arm pumping (the elbow at ~75°), the +x fist clutching the loot to the chest',
    glsl: /* glsl */`
  float T = 6.2831853, sw = cos(T * (u - .07));   // the walk's own arm phase (walk2.js: the +x arm swings with sw)
  cLegK = vec2(1.55, 1.6);
  P.torso.x += .26 * w; P.head.x -= .2 * w;                    // the lean; the head keeps looking ahead
  P.drop += .028 * (.5 + .5 * cos(2. * T * (u - .1))) * w;     // the bounce, twice a cycle
  P.torso.y += .14 * sw * w; P.head.y -= .14 * sw * w;         // the shoulders drive with the free arm
  float fL = max(-sw, 0.);   // (the −x arm's share of the front of its swing)
  cArm(P, 0, vec4(.1 - .72 * sw, .3 + .06 * max(sw, 0.), 0., -.3), 1.25 + .1 * fL, 1.);   // the pump: the elbow bent (more at the front), out a little on the back swing (the heel kicks up there)
  cArm(P, 1, ${CLUTCH} + vec4(.06 * sw, 0., 0., 0.), ${CLUTCH_E}, 1.);   // the loot, clutched to the chest (it bounces with the stride)` },

  { name: 'hands_up_point', dur: 1, hold: true, blendIn: .05, blendOut: .35,
    note: 'hands shoot up beside the head 0–0.16 s (the forearms up, palms forward), a flinch and a tremble · the +x arm swings to point after the robber 0.55–0.7 · two jabs (the elbow snaps straight) · the −x hand comes down to a raised "hey!" · held: a jab every 1.1 s (the mouth: no face channel yet)',
    glsl: /* glsl */`
  float up = cBack(t, 0., .16), upE = cOut(t, 0., .16), pt = cOut(t, .55, .7), hey = cS(t, .72, .9);
  float sh = .045 * sin(t * 55.) * cR(t, .14, .18) * (1. - cR(t, .5, .56));   // the tremble while the hands are up
  vec4 V = vec4(.4, 1.22, 0., -1.35);           // hands up: the upper arms out, the forearms up beside the head (the twist folds them up), palms forward
  vec4 PT = vec4(1.45, .14, -.06, -.3);        // the point: straight ahead, a hair out (the twist folds its slight bend outward, clear of the head)
  vec4 HY = vec4(.55, .8, 0., -.9);            // "hey!": the −x hand down to an open palm out in front, shoulder high
  float hold = step(1., t) * cBump(mod(max(t - 1., 0.), 1.1), 0., .14), jab = cBump(t, .74, .84) + cBump(t, .87, .97) + hold;
  cArm(P, 0, V + vec4(sh, -sh, 0., 0.), up); cElbow(P, 0, 1.25 + .6 * sh, upE); cArm(P, 0, HY, 1.05, hey);
  cArm(P, 1, V + vec4(-sh, sh, 0., 0.), up); cElbow(P, 1, 1.25 - .6 * sh, upE); cArm(P, 1, PT, .25 - .23 * min(jab, 1.), pt);   // (each jab: the elbow snaps straight)
  P.armP.y += .13 * (cBump(t, .74, .84) + cBump(t, .87, .97)) + .1 * hold;
  P.torso.x += -.16 * up + .28 * pt + .03 * hold; P.head.x += -.2 * up + .08 * pt;
  P.torso.y -= .2 * pt; P.head.y += .16 * pt;   // the +x shoulder comes forward into the point; the head stays on the robber
  P.drop += .045 * cBump(t, 0., .4);            // the flinch
  cBreathe(P, t, 1.);` },

  { name: 'pat_pockets', dur: 1.6, loop: true, blendIn: .15, blendOut: .3,
    note: 'a loop: slaps the hip pockets twice 0–0.3 s, head down · the hands up to the chest (the elbows bent), two pats 0.36–0.78 · a shrug (the forearms out, palms up), looks up, left, right 0.84–1.44 · back to the pockets',
    glsl: /* glsl */`
  vec4 K = vec4(-.06, .24, 0., .55), C = vec4(.65, .45, 0., .55), H = vec4(.15, .5, 0., -.6);
  float toC = cS(t, .34, .46), toH = cS(t, .82, .96), toK = cS(t, 1.42, 1.58);
  vec4 a = mix(mix(mix(K, C, toC), H, toH), K, toK);
  float e = 1.4 * toC * (1. - toK);                                     // the elbows: straight at the pockets (as before), bent at the chest and in the shrug
  a.y += .22 * cBump(t, .32, .46);
  float slap = (cBump(t, 0., .12) + cBump(t, .14, .28)) * (1. - toC), pat = cBump(t, .5, .62) + cBump(t, .64, .78);
  a.y += .26 * slap;                  // the pocket slaps: out, and in hard (to the side of the thigh, not into it)
  a.x -= .14 * pat; e -= .3 * pat;     // the chest pats: the hands drop off the chest, and back on
  cArms(P, a, e, 1.);
  float down = .3 * (1. - toH + toK) - .16 * toC * (1. - toH);         // (the head drops less while the hands are at the chest: its front edge would meet them)
  P.head.x += down - .1 * toH * (1. - toK); P.torso.x += .1 * (1. - toH + toK);
  float look = .75 * cS(t, .92, 1.06) - 1.5 * cS(t, 1.12, 1.28) + .75 * cS(t, 1.32, 1.44);
  P.head.y += look; P.torso.y += .28 * look;
  P.drop += .012 * (cBump(t, .02, .12) + cBump(t, .16, .26));          // a bob with each slap
  cBreathe(P, t, 1.);` },
];

// ═══ THE SHOOTER (the getup-aim agent, 2026-10-08; slime: "def show gun and flash"). Four clips on one stance, the gun a prop:
//   aim_draw   0.8 s   the gun is carried on the +x hip (CARRY: it shows there from the start, riding the hips); the +x hand goes back to
//                      it, takes it at 0.26 s and swings it forward and up while the body blades (the gun side leads) and the eyes find
//                      the target · chains to aim_hold
//   aim_hold   1.6 s   a loop: one-handed, the arm out at shoulder height, the elbow a little bent and down, the gun level at the target,
//                      a small sway. SEAMS every 0.8 s: its pose at t = 0, 0.8, 1.6 is its first pose, the first pose of aim_fire and
//                      aim_lower and the last of aim_draw and aim_fire. Switch to aim_fire / aim_lower when its clock crosses a seam
//   aim_fire   0.6 s   one shot at t 0 (the flash: `flash` [t0, t1] s, at prop.muzzle(t)): the recoil kicks the gun up, the elbow folds to
//                      absorb it, the chest rocks, the head flinches; back on the target by 0.45 · chains to aim_hold
//   aim_lower  1.0 s   the gun drops to the side, the stance unwinds, a glance, the hand puts it back in its carry on the hip (0.66 s)
//                      and lets go; ends in the plain stand with the gun on the hip, so the owner can play run_getaway (or let the walker
//                      go) without a pop
// WHY ONE-HANDED AND BLADED: the big head's front face is at z 0.45 and its bottom at y 0.9; the shoulders are 0.25 out and the arms reach
// 0.40–0.45 m. A square two-hand grip meets in front of the chest, BEHIND the head's front face: from the street camera the head hides
// fists and gun alike. Blading the body (the root −0.2 rad about the +x foot, the chest −0.28 more: the +x shoulder comes 0.11 m forward)
// lets the one arm put the fist ~0.5 m out, in front of the head, and the whole gun reads beyond it. The head turns back onto the target.
// THE GUN RIDES THE +x HAND RIGIDLY (gun-prop.js: its grip point at the mitten's centre, the barrel along the fingers, the slide on the
// thumb side). The body is posed by expressions valid in GLSL and JS (the skateboard's way, CLIPS.md); the CPU runs the same forward
// kinematics as walk2.js (the elbow's rigid hand about the hinge line, the shoulder's turn, the chest's turn about the pelvis, the clip's
// root) to place the gun, so the fist and the grip cannot part. prop.pose(t) / prop.matrix(THREE, t, out) / prop.muzzle(t): the CLIPS.md
// prop contract, plus the muzzle (body frame) for the flash.
import { GUN, gunGeometry, gunMatrix, gunPoint, gunDir } from './gun-prop.js';

const AIM_JS = (() => { const cl = (x, a, b) => Math.min(b, Math.max(a, x)), cR = (t, a, b) => cl((t - a) / (b - a), 0, 1);
  return { cR, cS: (t, a, b) => { const x = cR(t, a, b); return x * x * (3 - 2 * x); }, cOut: (t, a, b) => { const x = cR(t, a, b); return 1 - (1 - x) * (1 - x); },
    cIn: (t, a, b) => { const x = cR(t, a, b); return x * x; }, cBack: (t, a, b) => { const x = cR(t, a, b) - 1; return 1 + x * x * (2.7 * x + 1.7); },
    cBump: (t, a, b) => Math.sin(Math.PI * cR(t, a, b)), mix: (a, b, k) => a + (b - a) * k, clamp: cl, sin: Math.sin, cos: Math.cos, abs: Math.abs,
    min: Math.min, max: Math.max, sqrt: Math.sqrt, mod: (x, y) => x - y * Math.floor(x / y), step: (e, x) => x < e ? 0 : 1, smoothstep: (a, b, t) => { const x = cl((t - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); } }; })();
const af = v => (+v).toFixed(4);
// THE TRACK: one expression per channel (in t, D and the vars), absolute values. The fields:
//   body tx ty tz (the chest's pitch / yaw / roll), drop, bx (the hips' sway), pr (the pelvis roll) · feet zL lL fL zR lR fR (cFoot)
//   root ry (the whole body's yaw about the ground point cx, cz) · head hx hy hz (where the eyes look, body frame; P.head = this − the
//   chest − the root) · the gun arm (+x) ap ar ay at ae (cArm's pitch, roll, yaw, twist + the elbow) · the free arm (−x) lp lr ly lt le,
//   lk (its weight: 0 leaves the stand's arm) · show (≥ 0.5: the gun shows) · cy (≥ 0.5: the gun is in its CARRY on the hip, not in
//   the hand; the CPU only: the shader never draws the gun)
const AIM_KEYS = ['tx', 'ty', 'tz', 'drop', 'bx', 'pr', 'zL', 'lL', 'fL', 'zR', 'lR', 'fR', 'ry', 'cx', 'cz', 'hx', 'hy', 'hz', 'ap', 'ar', 'ay', 'at', 'ae', 'ak', 'lp', 'lr', 'ly', 'lt', 'le', 'lk', 'show', 'cy'];
const AIM_D0 = { tz: '0.', bx: '0.', pr: '0.', lL: '0.', fL: '0.', lR: '0.', fR: '0.', ry: '0.', cx: '0.', cz: '0.', hz: '0.', ak: '1.', lk: '1.', show: '1.', cy: '0.' };
const aimVal = (T, k) => T[k] ?? AIM_D0[k] ?? '0.';
function aimJs(T, dur, loop) {
  const ks = Object.keys(AIM_JS), vals = ks.map(k => AIM_JS[k]);
  const fn = new Function(...ks, 't', 'D', `${(T.vars || []).map(([k, e]) => `const ${k} = ${e};`).join(' ')} return { ${AIM_KEYS.map(k => `${k}: ${aimVal(T, k)}`).join(', ')} };`);
  return t => fn(...vals, loop ? AIM_JS.mod(Math.max(t, 0), dur) : Math.max(t, 0), dur);
}
const aimGlsl = (T, extra = '') => /* glsl */`
  ${(T.vars || []).map(([k, e]) => `float ${k} = ${e};`).join(' ')}
  P.torso = vec3(${aimVal(T, 'tx')}, ${aimVal(T, 'ty')}, ${aimVal(T, 'tz')}); P.drop = ${aimVal(T, 'drop')}; P.bodyX = ${aimVal(T, 'bx')}; P.pRoll = ${aimVal(T, 'pr')};
  cFoot(P, 0, ${aimVal(T, 'zL')}, ${aimVal(T, 'lL')}, ${aimVal(T, 'fL')}); cFoot(P, 1, ${aimVal(T, 'zR')}, ${aimVal(T, 'lR')}, ${aimVal(T, 'fR')});
  cRot.y = ${aimVal(T, 'ry')}; cPiv = vec3(${aimVal(T, 'cx')}, 0., ${aimVal(T, 'cz')});
  P.head = vec3(${aimVal(T, 'hx')} - P.torso.x, ${aimVal(T, 'hy')} - P.torso.y - cRot.y, ${aimVal(T, 'hz')});
  cArm(P, 1, vec4(${aimVal(T, 'ap')}, ${aimVal(T, 'ar')}, ${aimVal(T, 'ay')}, ${aimVal(T, 'at')}), ${aimVal(T, 'ae')}, ${aimVal(T, 'ak')});
  cArm(P, 0, vec4(${aimVal(T, 'lp')}, ${aimVal(T, 'lr')}, ${aimVal(T, 'ly')}, ${aimVal(T, 'lt')}), ${aimVal(T, 'le')}, ${aimVal(T, 'lk')});
  ${extra}`;
// THE FORWARD KINEMATICS of the +x hand (walk2.js, the standing body; the walk's weight 0): a rest-frame point (the arm hanging) → the
// walker's body frame. GLSL's aRX / aRY / aRZ, as matrices on column vectors.
const R3 = { x: (a, v) => { const c = Math.cos(a), s = Math.sin(a); return [v[0], c * v[1] - s * v[2], s * v[1] + c * v[2]]; },
  y: (a, v) => { const c = Math.cos(a), s = Math.sin(a); return [c * v[0] + s * v[2], v[1], -s * v[0] + c * v[2]]; },
  z: (a, v) => { const c = Math.cos(a), s = Math.sin(a); return [c * v[0] - s * v[1], s * v[0] + c * v[1], v[2]]; } };
const vadd = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], vsub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const RIG = { hipY: .5, hipZ: .025, hipX: .125, L: (.2 + .175) * .998, ank: .125, heel: .175, toe: .275, sh: [.25, .825, 0], hinge: [0, .65, .05], grip: [.325, .39, 0] };
const ankle = (z, fp, lift) => { const c = Math.cos(fp), s = Math.sin(fp), r = fp >= 0 ? [RIG.heel, RIG.ank] : [-RIG.toe, RIG.ank];
  return [(fp >= 0 ? z - RIG.heel : z + RIG.toe) + r[0] * c - r[1] * s, r[0] * s + r[1] * c + lift]; };
// the gun's axes in the hand's rest frame (the +x arm hanging): x across, its up (the slide) to the hand's front (the thumb side, +z),
// the barrel down the fingers (−y): aRX(π/2)
const GUN_IN_HAND = [[1, 0, 0], [0, 0, 1], [0, -1, 0]];
// a = the arm's angles (ap ar ay at ae; default the track's own): the CARRY passes the waistband grab's, so the gun sits where the hand
// takes it from, riding the chest's frame (the pelvis turns with the chest while standing: walk2.js part 12) and the root
function handFK(v, a = v) {
  const L = ankle(v.zL, v.fL, v.lL), Rr = ankle(v.zR, v.fR, v.lR), sr = Math.sin(v.pr) * RIG.hipX;
  const hL = L[1] + Math.sqrt(Math.max(RIG.L ** 2 - L[0] ** 2 - v.bx ** 2, 0)) + sr, hR = Rr[1] + Math.sqrt(Math.max(RIG.L ** 2 - Rr[0] ** 2 - v.bx ** 2, 0)) - sr;
  const hip = Math.min(RIG.hipY - v.drop, hL, hR), pc = [0, RIG.hipY, RIG.hipZ], piv = [v.cx, 0, v.cz];
  // (the elbow, then the arm: aArmRot, sx +1; then the chest; then the root, yaw only)
  const rot = d => { d = R3.x(-a.ae, d); d = R3.y(-a.at, d); d = R3.x(-a.ap, d); d = R3.z(a.ar, d); d = R3.y(-a.ay, d);
    d = R3.y(v.ty, d); d = R3.x(v.tx, d); d = R3.z(v.tz + .5 * v.pr, d);
    return R3.y(v.ry, d); };
  const pt = p => { let q = vadd(RIG.hinge, R3.x(-a.ae, vsub(p, RIG.hinge))); q = vadd(RIG.sh, (d => { d = R3.y(-a.at, d); d = R3.x(-a.ap, d); d = R3.z(a.ar, d); return R3.y(-a.ay, d); })(vsub(q, RIG.sh)));
    q = vadd([v.bx, hip, RIG.hipZ], (d => R3.z(v.tz + .5 * v.pr, R3.x(v.tx, R3.y(v.ty, d))))(vsub(q, pc)));
    return vadd(piv, R3.y(v.ry, vsub(q, piv))); };
  return { p: pt(RIG.grip), R: GUN_IN_HAND.flatMap(rot), hip };
}
// the CARRY (where the shooter keeps the gun: on the +x hip, its grip behind the hip at belt height, the barrel down along the outside
// of the thigh, the slide's top to the front) is the gun as the hand holds it at the waistband grab, WB below: aim_draw takes it from
// there and aim_lower puts it back there. While the track's cy ≥ 0.5 the gun rides the body in it, not the hand
function aimProp(T, dur, loop) {
  const tr = aimJs(T, dur, loop);
  const pose = t => { const v = tr(t), h = handFK(v, v.cy >= .5 ? WB : v); return { p: h.p, R: h.R, show: v.show }; };
  return { id: 'pistol', geometry: THREE => gunGeometry(THREE), pose, track: tr,
    matrix: (THREE, t, out) => gunMatrix(THREE, pose(t), out),
    muzzle: t => { const q = pose(t); return { p: gunPoint(q, GUN.muzzle), d: gunDir(q, GUN.dir), show: q.show }; } };
}
// ── the stance (AH: aim_hold's first pose, every aim clip's seam). The root turns about the +x foot's ball; the eyes stay on the target.
const AH = { ry: -.2, cx: .175, cz: .12, tx: .03, ty: -.28, tz: -.03, drop: .04, bx: .015, zL: -.14, zR: 0, hx: .12, hy: 0,
  ap: 1.35, ar: .02, ay: -.4, at: .05, ae: .27, lp: .1, lr: .2, ly: .05, lt: .3, le: .35 };
const ah = k => af(AH[k]);
// a track from the stance plus offsets: o[k] = an expression added to AH[k] (keys AH doesn't hold are absolute: show, feet lifts …)
const fromAH = (o = {}, vars = []) => { const T = { vars }; for (const k of AIM_KEYS) { if (k in AH) T[k] = o[k] ? `(${ah(k)} + ${o[k]})` : ah(k); else if (o[k] !== undefined) T[k] = o[k]; } return T; };
// the stand (the walker's own pose under a clip: the arm hangs, rolled out 0.04) and the waistband grab (the +x hand back at the hip)
const STAND = { tx: 0, ty: 0, tz: 0, drop: 0, bx: 0, ry: 0, zL: 0, zR: 0, hx: 0, hy: 0, ap: 0, ar: .04, ay: 0, at: 0, ae: 0, lp: 0, lr: .04, ly: 0, lt: 0, le: 0 };
// the waistband grab: the grip behind the hip at belt height (body (0.354, 0.490, −0.213) at the stand), the barrel straight down, the
// slide's top to the front: the CARRY's hand. As far back as the reach shell allows (elbow 1.37), so the carried gun clears the hanging
// arm (its front 1.5 cm inside the back of a resting fist; the old grab, [−1, .2, 0, .2] elbow 1.1, put it 11 cm into the fist)
const WB = { ap: -1.38, ar: .37, ay: 0, at: .33, ae: 1.37 };
// k-blend helpers for the tracks: from a to b by the expression k
const lerp = (a, b, k) => `(${af(a)} + ${af(b - a)} * ${k})`;

// AIM_HOLD (1.6 s loop; seams at 0, 0.8, 1.6): every sway term is sin(2πn t / 1.6), n whole, so it is 0 at the seams
const HOLD_D = 1.6, sw = n => `sin(${af(2 * Math.PI * n / HOLD_D)} * t)`;
const aimHold = fromAH({ ap: `.022 * ${sw(1)} + .008 * ${sw(3)}`, ay: `.018 * ${sw(2)}`, ae: `-.012 * ${sw(1)}`, tx: `.012 * ${sw(1)}`, ty: `.01 * ${sw(2)}`,
  hx: `.012 * ${sw(2)}`, hy: `-.01 * ${sw(2)}`, lp: `.03 * ${sw(1)}`, drop: `.004 * ${sw(2)}` });

// AIM_DRAW (0.8 s): the gun in its CARRY on the hip from the start · the stand → the hand on it at the waistband (0–0.24 s, held to 0.27)
// → the grab at 0.26 (from here the gun rides the hand) → forward and up, wide of the hip, the body blades, the −x foot steps back
// (0.2–0.6) → a settle: the gun dips a hair under the aim and comes back up (0.52–0.8) → AH, exactly, at 0.8
const DRAW_D = .8;
const draw = (() => { const T = { vars: [['wb', 'cS(t, 0., .24)'], ['up', 'cOut(t, .27, .6)'], ['wbx', 'wb * (1. - cS(t, .26, .5))'], ['bl', 'cS(t, .12, .5)'], ['st', 'cS(t, .2, .5)']] };
  for (const k of ['ap', 'ar', 'ay', 'at', 'ae']) T[k] = `(${lerp(STAND[k], WB[k], 'wb')} * (1. - up) + ${af(AH[k])} * up)`;
  T.ap = `(${T.ap} - .07 * cBump(t, .52, .8))`;   // (the settle: the gun dips a hair under the aim and comes back up)
  // (the swing passes wide of the hip: clear of the puffiest jackets. It starts at the grab, so the hand holds WB exactly, the carry)
  T.ar = `(${T.ar} + .3 * cBump(t, .26, .5))`;
  for (const k of ['tx', 'ty', 'tz', 'drop', 'bx', 'ry']) T[k] = lerp(STAND[k] ?? 0, AH[k], 'bl');
  T.ty = `(${T.ty} + .08 * wbx)`; T.tz = `(${T.tz} + .04 * wbx)`;   // (the +x shoulder drops back to the hip as the hand goes there)
  T.cx = af(AH.cx); T.cz = af(AH.cz); T.zR = af(AH.zR);
  T.zL = lerp(0, AH.zL, 'st'); T.lL = '.05 * cBump(t, .2, .5)'; T.fL = '-.12 * cBump(t, .2, .36)';
  T.hx = lerp(0, AH.hx, 'cS(t, .05, .35)'); T.hy = af(AH.hy);
  for (const k of ['lp', 'lr', 'ly', 'lt', 'le']) T[k] = lerp(STAND[k], AH[k], 'bl');
  T.lp = `(${T.lp} + .2 * cBump(t, .18, .56))`; T.lr = `(${T.lr} + .08 * cBump(t, .18, .56))`;   // (the −x arm swings forward and out as its foot steps back)
  T.show = '1.'; T.cy = '(1. - step(.26, t))'; return T; })();

// AIM_FIRE (0.6 s): the shot at t 0 · the kick 0–0.05 (the gun flips ~25° up: the arm up, the elbow folding back) · the recovery
// 0.05–0.45 (eased, a small second dip) · AH from 0.45
const FIRE_D = .6;
const aimFire = fromAH({ ap: '.1 * kk - .03 * k2', ae: '.26 * kk', at: '.04 * kk', tx: '-.07 * kk', ty: '.03 * kk', drop: '.012 * kk',
  hx: '-.16 * fl', hy: '.05 * fl', lp: '-.12 * fl', lr: '.06 * fl' },
  [['kk', 'cOut(t, 0., .05) * (1. - cS(t, .05, .42))'], ['k2', 'cBump(t, .3, .45)'], ['fl', 'cOut(t, 0., .04) * (1. - cS(t, .1, .38))']]);

// AIM_LOWER (1.0 s): the arm drops to the side, the gun pointing down ahead, the blade opens, a glance left and right (0–0.45) · the
// hand puts the gun back in its CARRY on the hip (0.42–0.66; from 0.66 it rides the hip) and lets go · the arms hang, the −x foot steps
// back in, the stand (0.62–1.0), the gun on the hip
const LOW_D = 1;
const lower = (() => { const T = { vars: [['dn', 'cS(t, 0., .32)'], ['tk', 'cS(t, .42, .66)'], ['hg', 'cS(t, .66, .95)'], ['un', 'cS(t, .1, .9)']] };
  const SIDE = { ap: .2, ar: .22, ay: 0, at: .1, ae: .35 };   // (the fist 0.15 m out from the thigh, the barrel 57° down ahead)
  for (const k of ['ap', 'ar', 'ay', 'at', 'ae']) T[k] = `mix(mix(mix(${af(AH[k])}, ${af(SIDE[k])}, dn), ${af(WB[k])}, tk), ${af(STAND[k])}, hg)`;
  for (const k of ['tx', 'ty', 'tz', 'drop', 'bx', 'ry']) T[k] = lerp(AH[k], STAND[k] ?? 0, 'un');
  T.cx = af(AH.cx); T.cz = af(AH.cz); T.zR = af(AH.zR);
  T.zL = lerp(AH.zL, 0, 'cS(t, .6, .88)'); T.lL = '.05 * cBump(t, .6, .88)';
  T.hx = lerp(AH.hx, 0, 'cS(t, .1, .9)'); T.hy = '(-.4 * cBump(t, .15, .45) + .25 * cBump(t, .4, .7))';
  for (const k of ['lp', 'lr', 'ly', 'lt', 'le']) T[k] = lerp(AH[k], STAND[k], 'un');
  T.ak = '(1. - cS(t, .8, 1.))'; T.lk = T.ak; T.show = '1.'; T.cy = 'step(.66, t)'; return T; })();

const aimClip = (o) => ({ name: o.name, dur: o.dur, loop: !!o.loop, next: o.next || null, blendIn: o.blendIn ?? .15, blendOut: o.blendOut ?? .3, note: o.note,
  ...(o.flash ? { flash: o.flash } : {}), prop: aimProp(o.track, o.dur, !!o.loop), glsl: aimGlsl(o.track) });
CLIPS.push(
  aimClip({ name: 'aim_draw', dur: DRAW_D, next: 'aim_hold', track: draw, blendIn: .12,
    note: 'the shooter draws (prop: pistol, carried on the +x hip: it shows there from the start): the +x hand back to it at the waistband 0–0.24 s · the grab at 0.26 (the gun now rides the hand) · forward and up to the aim 0.26–0.62 while the body blades (the gun side leads) and the −x foot steps back · a settle (a small dip) to 0.8; chains to aim_hold' }),
  aimClip({ name: 'aim_hold', dur: HOLD_D, loop: true, track: aimHold, blendIn: .15,
    note: 'a loop (prop: pistol): one-handed, bladed, the arm out at shoulder height, the elbow a little bent and down, the gun level at the target, a small sway; seams at 0, 0.8, 1.6 s (switch to aim_fire or aim_lower there: no pop)' }),
  aimClip({ name: 'aim_fire', dur: FIRE_D, next: 'aim_hold', track: aimFire, flash: [0, .06],
    note: 'one shot (prop: pistol; the flash 0–0.06 s at prop.muzzle(t)): the recoil flips the gun ~25° up 0–0.05, the elbow folds to absorb it, the chest rocks back, the head flinches · back on the target by 0.45; chains to aim_hold' }),
  aimClip({ name: 'aim_lower', dur: LOW_D, track: lower, blendOut: .2,
    note: 'the gun drops to the side 0–0.32 s, the stance opens, a glance left and right · the hand puts it back in its carry on the hip 0.42–0.66 and lets go (it stays there, on the hip, to the end) · the arms hang, the −x foot steps in, the plain stand by 1.0 (then run_getaway, or the walk)' }),
);
