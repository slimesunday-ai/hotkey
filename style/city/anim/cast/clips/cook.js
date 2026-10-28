// CLIPS · cook (activities): cooking: mixing, pouring and checking a batch at a lab bench (GAME.md §20; 2026-10-15). One owner;
// CLIPS.md has the entry format. A Chemist cooks doses from chems at home (the lab lights on) or in a shack in the woods (steam rising).
// Four clips, all standing at the bench, all on one pose between them (HOME):
//   cook_stir   3.6 s loop       the −x hand on the pot's handle, the +x hand stirring with the paddle: two rounds, then a lean in to
//                                peer at the batch, a tap on the rim; still at HOME at the seam
//   cook_pour   4.8 s → stir     the −x hand takes the bottle of chem off the bench and pours it in (a stream, two glugs) while the
//                                +x hand stirs it in; the bottle back on the bench
//   cook_check  5.4 s → stir     the +x hand leaves the paddle and holds the vial of the batch up beside the head, to the light: the
//                                chin up, the vial turned slowly round; back in its rack
//   cook_fan    3.6 s loop       the woods shack's thick steam: the cook pulls back, the face turned away, fans the fumes off with
//                                the −x hand, coughs; back over the pot; the +x hand keeps stirring
// HOME is the stir's seam, and every clip starts and ends on it (measured on the real shader: ≤ 0.005 mm), so a switch between cook
// clips on a seam never pops: the one-shots chain back into cook_stir by themselves (`next`). One look for every drug: the props
// (cook-props.js) never show which drug is cooked.
//
// THE SET is a prop (CLIPS.md § Props) of six parts in the walker's body frame (cook-props.js): the pot on the burner, the paddle, the
// bottle of chem, the vial and its rack, the pour's stream. Each clip's `prop` poses all of them at its clock: the city draws them
// instanced (partGeometry + partMatrices), the lab one live mesh. The bench and the burner are the city's set (cook.md).
//
// THE HANDS ON THE PROPS: each clip's track is written once as expressions valid in GLSL and JS (work.js's method). The JS side poses
// the props; the GLSL side poses the body and puts each hand on its target with work.js's two-bone IK on the elbow (the reach sets the
// elbow, the shoulder turns the bent arm so its grip point, the mitten's centre, lands on the target, the elbow toward a pole). A
// target is a point of a prop, a body-frame point or a chest-frame point, and a hand moves between them by weights; all of them are
// blended in the chest's rest frame, through walk2.js's standing pelvis, so the chest's lean never carries a hand off its prop.
// Measured on the real shader (transform feedback, the cast's elbow): each fist's grip point on its target to ≤ 0.04 mm, on the bare
// body and the puffer alike.
// THE TOON ARM reaches only 0.403–0.453 m from its shoulder (elbow ≤ 83°, under the thick sleeve's soft cap), and the head (x ±0.5,
// y 0.9–1.7, its front face at z 0.45) owns everything above y 0.9. So the bench is low (0.38 m) and close (0.22 m ahead), the hands
// work under the chin, the bottle is held by its body so the fist stays outside the pot's rim while the neck reaches over it, and the
// vial goes up beside the head (hail_taxi's place for a raised hand), not in front of the face.
import { SET, PROP, PART_IDS, BURNER, ROD_HOME, partMatrix, partGeometry, partPoint, liveMesh } from './cook-props.js';

const f = v => (+v).toFixed(4), PI = Math.PI;
// the rig (walk2.js; chars.js voxels × 0.05): the shoulder pivot, the elbow's hinge line, the hand's grip point (the mitten's centre),
// all in the arm's rest frame (hanging)
const SH = { x: .25, y: .825 }, HINGE = { y: .65, z: .05 }, GRIP = { x: .325, y: .39, z: 0 }, ELB = { y: .65 };
// the bent arm's reach, |grip − shoulder|² = A + B cos(e − φ) (work.js): the IK keeps the elbow in [φ, EMAX], EMAX under the thick
// sleeve's soft cap (85°), so the hand's grip is always 0.403–0.453 m from its shoulder
const gx = GRIP.x - SH.x, hy = HINGE.y - SH.y, hz = HINGE.z, gy = GRIP.y - HINGE.y, gz = GRIP.z - HINGE.z;
const RA = gx * gx + hy * hy + hz * hz + gy * gy + gz * gz, Bc = 2 * (hy * gy + hz * gz), Bs = 2 * (hy * gz - hz * gy), RB = Math.hypot(Bc, Bs), PHI = Math.atan2(Bs, Bc);
export const EMAX = 1.45;
export const REACH = { min: Math.sqrt(RA + RB * Math.cos(EMAX - PHI)), max: Math.sqrt(RA + RB), phi: PHI, RA, RB };
export const RIG = { SH, HINGE, GRIP, ELB, gx, hy, hz, gy, gz };

// the GLSL helpers' JS twins (clips/index.js CLIP_HELPERS, and GLSL's own), so one expression string runs on both sides
const JS = (() => { const cl = (x, a, b) => Math.min(b, Math.max(a, x)), cR = (t, a, b) => cl((t - a) / (b - a), 0, 1);
  return { cR, cS: (t, a, b) => { const x = cR(t, a, b); return x * x * (3 - 2 * x); }, cOut: (t, a, b) => { const x = cR(t, a, b); return 1 - (1 - x) * (1 - x); },
    cIn: (t, a, b) => { const x = cR(t, a, b); return x * x; }, cBack: (t, a, b) => { const x = cR(t, a, b) - 1; return 1 + x * x * (2.7 * x + 1.7); },
    cBump: (t, a, b) => Math.sin(PI * cR(t, a, b)), mix: (a, b, k) => a + (b - a) * k, clamp: cl, sin: Math.sin, cos: Math.cos, abs: Math.abs, atan: Math.atan2,
    min: Math.min, max: Math.max, sqrt: Math.sqrt, mod: (x, y) => x - y * Math.floor(x / y), step: (e, x) => x < e ? 0 : 1, floor: Math.floor, fract: x => x - Math.floor(x),
    smoothstep: (a, b, t) => { const x = cl((t - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); } }; })();
// a keyed channel: [[t, v, ease?], …] → one expression (eased steps added up; the ease of the segment that ENDS at the key: cS, cIn,
// cOut, cR, cBack), as work.js keys()
export function keys(K, T = 't') { let s = f(K[0][1]); for (let i = 1; i < K.length; i++) { const d = K[i][1] - K[i - 1][1]; if (Math.abs(d) < 1e-9) continue; s += ` + ${f(d)} * ${K[i][2] || 'cS'}(${T}, ${f(K[i - 1][0])}, ${f(K[i][0])})`; } return `(${s})`; }

// THE TRACK of a cook clip, written once and read by both sides (work.js's method, with a hand that moves between props):
//   vars   [[name, expr], …]                 scalars the rest may use (in order)
//   body   { tx, ty, tz, drop, bx, pr }       the chest's pitch / yaw / roll, the pelvis drop, the hips' sway, the pelvis roll (absolute)
//   feet   { zL, lL, fL, zR, lR, fR }         cFoot of each foot
//   head   { hx, hy, hz }                     where the eyes look: pitch (+ down) and yaw in the body frame, and the head's roll
//   parts  { id: { x, y, z, az, el, sp, px, py, pz, len, show } }   the props the clip moves (cook-props.js partMatrix's pose); a field
//          left out is the SET's (the bench at rest)
//   hands  [L, R]: { on: [[w, target], …], pole: [x, y, z], k, free }
//          target: ['part', id, [qx, qy, qz]] (a point of that prop's own frame), ['at', [x, y, z]] (a body-frame point) or
//          ['chest', [x, y, z]] (a point of the chest's rest frame, where the shoulder is fixed). The hand's target is the w-weighted
//          mean of its targets, taken in the chest's frame (weights are expressions, ≥ 0); pole: where the elbow points (the chest's
//          rest frame); k (default 1): the IK's arm, toward 0 the `free` arm ([pitch, roll, yaw, twist, elbow], cArm's angles)
//   derive (JS only) (parts, v) → poses of props no hand holds that follow another (the pour's stream under the bottle's mouth)
const BODY = ['tx', 'ty', 'tz', 'drop', 'bx', 'pr'], FEET = ['zL', 'lL', 'fL', 'zR', 'lR', 'fR'], HEAD = ['hx', 'hy', 'hz'];
const POSE = ['x', 'y', 'z', 'az', 'el', 'sp', 'px', 'py', 'pz', 'len', 'show'];
const D0 = { tx: 0, ty: 0, tz: 0, drop: 0, bx: 0, pr: 0, zL: .02, lL: 0, fL: 0, zR: -.02, lR: 0, fR: 0, hx: 0, hy: 0, hz: 0 };
const ex = v => typeof v === 'number' ? f(v) : String(v);
const pexp = (T, id, k) => { const e = T.parts?.[id]?.[k]; if (e !== undefined) return ex(e); const s = SET[id][k]; return s === undefined ? null : f(s); };

// THE STANDING BODY in JS (walk2.js): the pelvis as high as both posed ankles allow, the chest turned about it. toChest takes a body-frame
// point into the chest's rest frame, toBody back: the same maths the shader runs on a hand's target.
const R2 = { hipX: .125, hipY: .5, hipZ: .025, heel: .175, toe: .275, ankY: .125, L: (.2 + .175) * .998 };
const ankle = (z, fp, lift) => { const c = Math.cos(fp), s = Math.sin(fp), r = fp >= 0 ? [R2.heel, R2.ankY] : [-R2.toe, R2.ankY];
  return [(fp >= 0 ? z - R2.heel : z + R2.toe) + r[0] * c - r[1] * s, r[0] * s + r[1] * c + lift]; };
export function chestFrame(b, fe) {
  const L = ankle(fe.zL, fe.fL, fe.lL), R = ankle(fe.zR, fe.fR, fe.lR), sr = Math.sin(b.pr) * R2.hipX;
  const hip = Math.min(R2.hipY - b.drop, L[1] + Math.sqrt(Math.max(R2.L ** 2 - L[0] ** 2 - b.bx ** 2, 0)) + sr, R[1] + Math.sqrt(Math.max(R2.L ** 2 - R[0] ** 2 - b.bx ** 2, 0)) - sr);
  // M = Rz(tz + pr / 2) · Rx(tx) · Ry(ty), as rows
  const cz = Math.cos(b.tz + .5 * b.pr), sz = Math.sin(b.tz + .5 * b.pr), cx = Math.cos(b.tx), sx = Math.sin(b.tx), cy = Math.cos(b.ty), sy = Math.sin(b.ty);
  const X = [[1, 0, 0], [0, cx, -sx], [0, sx, cx]], Y = [[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]], Z = [[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]];
  const mm = (A, B) => A.map(r => [0, 1, 2].map(j => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j])), M = mm(mm(Z, X), Y);
  const pn = [b.bx, hip, R2.hipZ], pc = [0, R2.hipY, R2.hipZ];
  const toChest = p => { const d = [p[0] - pn[0], p[1] - pn[1], p[2] - pn[2]]; return [0, 1, 2].map(i => pc[i] + M[0][i] * d[0] + M[1][i] * d[1] + M[2][i] * d[2]); };
  const toBody = p => { const d = [p[0] - pc[0], p[1] - pc[1], p[2] - pc[2]]; return [0, 1, 2].map(i => pn[i] + M[i][0] * d[0] + M[i][1] * d[1] + M[i][2] * d[2]); };
  return { hip, M, toChest, toBody };
}

// THE JS SIDE: the whole track at clip time t (a loop wraps it): body, feet, head, every prop's pose, each hand's target (body frame)
function jsTrack(T, dur, loop) {
  const ks = Object.keys(JS), vals = ks.map(k => JS[k]), F = [], seen = new Set();
  for (const [k] of T.vars || []) { if (seen.has(k) || ks.includes(k)) throw new Error(`cook.js: the track variable ${k} is declared twice (or shadows a helper)`); seen.add(k); }
  for (const k of BODY) F.push([`b_${k}`, ex(T.body?.[k] ?? D0[k])]);
  for (const k of FEET) F.push([`f_${k}`, ex(T.feet?.[k] ?? D0[k])]);
  for (const k of HEAD) F.push([`h_${k}`, ex(T.head?.[k] ?? D0[k])]);
  for (const id of PART_IDS) for (const k of POSE) { const e = pexp(T, id, k); if (e !== null) F.push([`p_${id}_${k}`, e]); }
  T.hands.forEach((h, i) => { h.on.forEach(([w, tg], j) => { F.push([`w_${i}_${j}`, ex(w)]); if (tg[0] !== 'part') tg[1].forEach((c, n) => F.push([`a_${i}_${j}_${n}`, ex(c)])); });
    (h.pole).forEach((c, n) => F.push([`o_${i}_${n}`, ex(c)])); F.push([`k_${i}`, ex(h.k ?? 1)]); });
  const src = `${(T.vars || []).map(([k, e]) => `const ${k} = ${e};`).join(' ')} return { ${F.map(([k, e]) => `${k}: ${e}`).join(', ')}${(T.vars || []).length ? ', ' + T.vars.map(([k]) => `v_${k}: ${k}`).join(', ') : ''} };`;
  const fn = new Function(...ks, 't', 'D', src);
  return t => {
    const tt = loop ? JS.mod(Math.max(t, 0), dur) : Math.max(t, 0), r = fn(...vals, tt, dur);
    const pick = (pre, list) => Object.fromEntries(list.map(k => [k, r[`${pre}_${k}`]]));
    const parts = Object.fromEntries(PART_IDS.map(id => [id, Object.fromEntries(POSE.filter(k => r[`p_${id}_${k}`] !== undefined).map(k => [k, r[`p_${id}_${k}`]]))]));
    const vars = Object.fromEntries((T.vars || []).map(([k]) => [k, r['v_' + k]]));
    if (T.derive) T.derive(parts, vars, tt);
    const body = pick('b', BODY), feet = pick('f', FEET), C = chestFrame(body, feet);
    const hands = T.hands.map((h, i) => { let W = 0; const P = [0, 0, 0];
      h.on.forEach(([, tg], j) => { const w = r[`w_${i}_${j}`], a = () => [0, 1, 2].map(n => r[`a_${i}_${j}_${n}`]);
        const q = tg[0] === 'part' ? C.toChest(partPoint(parts[tg[1]], tg[2])) : tg[0] === 'chest' ? a() : C.toChest(a());
        for (let n = 0; n < 3; n++) P[n] += w * q[n]; W += w; });
      const Tc = P.map(c => c / Math.max(W, 1e-4));
      return { Tc, T: C.toBody(Tc), H: [0, 1, 2].map(n => r[`o_${i}_${n}`]), k: r[`k_${i}`] }; });
    return { t: tt, body, feet, head: pick('h', HEAD), parts, hands, vars, hip: C.hip };
  };
}

// THE GLSL SIDE: the body, the feet, the head, then each hand onto its target with a two-bone IK on the elbow (work.js's): the reach
// sets the elbow, then the shoulder turns the bent arm so its grip point (the mitten's centre, rigid on the forearm) lands on the
// target, the elbow toward the pole. The targets are taken from the body frame into the chest's rest frame through walk2.js's standing
// pelvis, so the chest's lean and turn carry nothing off: the hands stay on the props.
function glslTrack(T) {
  const v = (grp, k) => ex(T[grp]?.[k] ?? D0[k]);
  const used = [...new Set(T.hands.flatMap(h => h.on.filter(([, tg]) => tg[0] === 'part').map(([, tg]) => tg[1])))];
  const parts = used.map(id => `mat3 cqR_${id} = aRY(${pexp(T, id, 'az')}) * aRX(1.5707963 - (${pexp(T, id, 'el')})) * aRY(${pexp(T, id, 'sp')});
    vec3 cqO_${id} = vec3(${pexp(T, id, 'x')}, ${pexp(T, id, 'y')}, ${pexp(T, id, 'z')}) - cqR_${id} * vec3(${pexp(T, id, 'px')}, ${pexp(T, id, 'py')}, ${pexp(T, id, 'pz')});`).join('\n    ');
  // a target in the chest's rest frame: a prop's point or a body-frame point go through the standing pelvis and the chest's turn
  const inChest = e => `(vec3(0., A_HIPY, A_HIPZ) + cqMt * (${e} - vec3(P.bodyX, cqHip, A_HIPZ)))`;
  const tgt = tg => tg[0] === 'part' ? inChest(`(cqO_${tg[1]} + cqR_${tg[1]} * vec3(${tg[2].map(ex).join(', ')}))`) : tg[0] === 'chest' ? `vec3(${tg[1].map(ex).join(', ')})` : inChest(`vec3(${tg[1].map(ex).join(', ')})`);
  const handT = h => h.on.length === 1 ? tgt(h.on[0][1]) : `((${h.on.map(([w, tg]) => `(${ex(w)}) * ${tgt(tg)}`).join(' + ')}) / max(${h.on.map(([w]) => `(${ex(w)})`).join(' + ')}, 1e-4))`;
  const ik = (s, h) => `// the ${s ? '+x' : '−x'} hand
    {
      float sx = ${s ? '1.' : '-1.'};
      ${h.free ? `cArm(P, ${s}, vec4(${h.free.slice(0, 4).map(ex).join(', ')}), ${ex(h.free[4] ?? 0)}, 1.);` : ''}
      vec3 cqH = vec3(${h.pole.map(ex).join(', ')});
      vec3 wkT = ${handT(h)} - vec3(sx * A_SHX, A_SHY, 0.);
      float wr2 = clamp(dot(wkT, wkT), ${f(REACH.min ** 2)}, ${f(REACH.max ** 2)}), we = ${f(PHI)} + acos(clamp((wr2 - ${f(RA)}) / ${f(RB)}, -1., 1.)), wc = cos(we), ws = sin(we);
      vec3 wv = vec3(sx * ${f(gx)}, ${f(hy)} + wc * ${f(gy)} + ws * ${f(gz)}, ${f(hz)} - ws * ${f(gy)} + wc * ${f(gz)}), wl = vec3(sx * ${f(gx)}, ${f(ELB.y - SH.y)}, 0.);
      vec3 e1 = normalize(wv), e2 = normalize(wl - dot(wl, e1) * e1), f1 = normalize(wkT), f2 = normalize(cqH - dot(cqH, f1) * f1);
      mat3 wR = mat3(f1, f2, cross(f1, f2)) * transpose(mat3(e1, e2, cross(e1, e2)));
      float wb = asin(clamp(wR[1][2], -1., 1.)), wa = atan(-wR[1][0], wR[1][1]), wcc = atan(-wR[0][2], wR[2][2]);
      if (abs(wa) > 1.5707963) { wa -= sign(wa) * 3.14159265; wb = (wb >= 0. ? 3.14159265 : -3.14159265) - wb; wcc += wcc > 0. ? -3.14159265 : 3.14159265; }
      cArm(P, ${s}, vec4(-wb, sx * wa, 0., -sx * wcc), we, ${ex(h.k ?? 1)});
    }`;
  return /* glsl */`
  ${(T.vars || []).map(([k, e]) => `float ${k} = ${e};`).join(' ')}
  P.torso = vec3(${v('body', 'tx')}, ${v('body', 'ty')}, ${v('body', 'tz')}); P.drop = ${v('body', 'drop')}; P.pRoll = ${v('body', 'pr')}; P.bodyX = ${v('body', 'bx')};
  cFoot(P, 0, ${v('feet', 'zL')}, ${v('feet', 'lL')}, ${v('feet', 'fL')}); cFoot(P, 1, ${v('feet', 'zR')}, ${v('feet', 'lR')}, ${v('feet', 'fR')});
  P.head = vec3((${v('head', 'hx')}) - P.torso.x, (${v('head', 'hy')}) - P.torso.y, ${v('head', 'hz')});
  {
    ${parts}
    // the body frame → the chest's rest frame (walk2.js: the standing pelvis, then the chest's turn about it)
    float cqL = (A_L1 + A_L2) * .998, cqSr = sin(P.pRoll) * A_HIPX;
    float cqHip = min(A_HIPY - P.drop, min(P.ank.y + sqrt(max(cqL * cqL - P.ank.x * P.ank.x - P.bodyX * P.bodyX, 0.)) + cqSr, P.ank.w + sqrt(max(cqL * cqL - P.ank.z * P.ank.z - P.bodyX * P.bodyX, 0.)) - cqSr));
    mat3 cqMt = transpose(aRZ(P.torso.z + .5 * P.pRoll) * aRX(P.torso.x) * aRY(P.torso.y));
    ${ik(0, T.hands[0])}
    ${ik(1, T.hands[1])}
  }`;
}

// the clip entry's prop (CLIPS.md § Props): the whole cook set (cook-props.js PART_IDS, every part, always the same list), posed at the
// clip clock t (a loop wraps it itself). For the city: partGeometry + partMatrices, one InstancedMesh per part. For the anim lab's one
// prop slot: geometry / matrix, one live mesh of the set re-posed on the CPU (ride-props.js's way), one per clip.
const LIVE = {};
function propOf(name, T, dur, loop) {
  const tr = jsTrack(T, dur, loop), list = PART_IDS.map(id => [id, 1]); let cache = null;
  const prop = { id: 'cook:' + name, item: 'cookset', parts: PART_IDS, track: tr,
    pose: t => tr(t).parts,
    partGeometry: (THREE, part) => partGeometry(THREE, part),
    partMatrices(THREE, t, outs = null) { const P = tr(t).parts; return PART_IDS.map((id, n) => [id, partMatrix(THREE, P[id], outs?.[n]?.[1] || new THREE.Matrix4())]); },
    geometry: THREE => LIVE[name] ||= liveMesh(THREE, list),
    matrix(THREE, t, out = new THREE.Matrix4()) { if (LIVE[name]) { cache = prop.partMatrices(THREE, t, cache); LIVE[name].userData.pose(cache); } return out.identity(); } };
  return prop;
}
function clip(o) {
  const T = o.track, loop = !!o.loop;
  return { name: o.name, dur: o.dur, loop, hold: !!o.hold, next: o.next ?? null, blendIn: o.blendIn ?? .35, blendOut: o.blendOut ?? .35, note: o.note,
    prop: propOf(o.name, T, o.dur, loop), glsl: glslTrack(T) };
}

// ═══ the clips
// HOME: the pose every cook clip starts and ends on (the stir's seam): at the bench, leaning in a little, the −x hand on the pot's
// handle, the +x hand on the paddle at the start of a round, the eyes on the pot. A switch between cook clips on a seam never pops.
const BT = BURNER.top, TAU = 2 * PI;
const HOME = { tx: .15, ty: 0, tz: -.03, drop: .02, bx: .015, pr: .015, hx: .1, hy: .052, hz: .03 };
// THE STIR's paddle: its blade's foot circles the pot's floor (r 0.055) while the top of the handle circles above the +x hand's ring
// (r 0.03); the +x hand holds it 0.35 m up (PROP.rod.grip). ph is the stir's angle (0 at HOME), r its size (0 … 1), lf a lift.
const ROD = { foot: [ROD_HOME.foot[0] - .055, ROD_HOME.foot[1], ROD_HOME.foot[2]], top: [ROD_HOME.top[0] - .03, ROD_HOME.top[1], ROD_HOME.top[2]], rf: .055, rt: .03 };
const rodVars = (ph, r = '1.', lf = '0.') => [['cw', `cos(${ph})`], ['sw', `sin(${ph})`],
  ['rx', `${f(ROD.foot[0] + ROD.rf)} + ${f(ROD.rf)} * (cw - 1.) * (${r})`], ['rz', `${f(ROD.foot[2])} + ${f(ROD.rf)} * sw * (${r})`],
  ['dx', `${f(ROD.top[0] + ROD.rt)} + ${f(ROD.rt)} * (cw - 1.) * (${r}) - rx`], ['dy', `${f(ROD.top[1] - ROD.foot[1])} + (${lf})`], ['dz', `${f(ROD.top[2])} + ${f(ROD.rt)} * sw * (${r}) - rz`]];
const rodPart = (lf = '0.') => ({ x: 'rx', y: `${f(ROD.foot[1])} + (${lf})`, z: 'rz', az: 'atan(dx, dz)', el: 'atan(dy, sqrt(dx * dx + dz * dz))', sp: '.3' });
const ON_HANDLE = ['part', 'pot', PROP.pot.handle], ON_ROD = ['part', 'rod', [0, PROP.rod.grip, 0]];
const POLE_L = [-1, -.4, -.2], POLE_R = [1, -.6, -.3];

// COOK_STIR (3.6 s loop): two rounds of the pot with the paddle (0–2.4 s; the speed eases in and out, a round a second at the top), the
// chest and the head going round with it · then a look: the cook leans in over the pot and peers (2.5–3.3 s), a small nod · a tap of
// the paddle on the rim (2.95 s) · back to HOME, still, by 3.6.
const STIR_D = 3.6;
const stir = {
  vars: [['ph', keys([[0, 0], [.4, .4 * PI, 'cIn'], [2, 3.6 * PI, 'cR'], [2.4, 4 * PI, 'cOut']])], ...rodVars('ph'),
    ['br', 'sin(6.2831853 * t / 3.6)'], ['pk', 'cS(t, 2.45, 2.8) * (1. - cS(t, 3.15, 3.55))'], ['tap', 'cBump(t, 2.9, 3.02)'], ['nd', 'cBump(t, 3.05, 3.35)']],
  body: { tx: `${f(HOME.tx)} + .035 * sw + .006 * br + .03 * pk`, ty: '0.', tz: `${f(HOME.tz)} * cw`, drop: `${f(HOME.drop)} + .01 * pk`, bx: `${f(HOME.bx)} * cw`, pr: `${f(HOME.pr)} * cw` },
  feet: { zL: .03, zR: -.03 },
  head: { hx: `${f(HOME.hx)} + .01 * br + .04 * nd`, hy: `${f(HOME.hy)} + .09 * (sin(ph - .6) + .5646) - .12 * pk`, hz: `${f(HOME.hz)} * cw + .03 * (cw - 1.) + .08 * pk` },
  parts: { rod: { ...rodPart(), x: 'rx + .012 * tap' } },
  hands: [{ on: [[1, ON_HANDLE]], pole: POLE_L }, { on: [[1, ON_ROD]], pole: POLE_R }],
};

// n eased rounds of the stir between t0 and t1 (ramps of r s at each end; continuous speed): the angle as one keyed expression
const rounds = (t0, t1, n, r = .5) => { const P = TAU * n, v = P / (t1 - t0 - r), a = v * r / 2; return keys([[0, 0], [t0, 0], [t0 + r, a, 'cIn'], [t1 - r, P - a, 'cR'], [t1, P, 'cOut']]); };
// a hand that leaves its HOME target (home: a target) for a path and comes back: weight 1 − k on home, k on the path (p, three
// body-frame expressions), bowed out on the way by arc × dir (a body-frame direction: out and up, so the hand's way never cuts in
// toward its shoulder). At k 0 the target is home's exactly, so the seams are exact.
const away = (home, p, k, arc = '0.', dir = [0, 1, 0]) => [[`1. - ${k}`, home], [k, ['at', [0, 1, 2].map(i => `${p[i]}${dir[i] ? ` + ${f(dir[i])} * ${arc}` : ''}`)]]];

// a quadratic curve a → b → c by k, one component (a hand's way up beside the head: out to the side under it, then up, hail_taxi's)
const bez = (k, a, b, c) => `((1. - ${k}) * (1. - ${k}) * (${a}) + 2. * ${k} * (1. - ${k}) * (${b}) + ${k} * ${k} * (${c}))`;

// COOK_POUR (4.8 s, chains to cook_stir): the −x hand leaves the pot's handle for the bottle of chem on the bench (0.8 s), lifts it
// and carries it out to the pot's far side (1.75), tips it: the neck reaches over the rim and the chem pours in a stream (1.925–3.175 s,
// two glugs) while the +x hand stirs it in · the bottle upright, back down on the bench (4.0), the hand back on the handle by 4.7: HOME.
// The fist stays outside the rim (the bottle is held by its body, its neck over the pot) and under the big head: the chin comes level.
const POUR_D = 4.8, BO = SET.bottle, OVER = [-.46, .64, .44], TIP = [-.28, .7, .48], POLE_P = [.87, -.4, -.5];
const AZP = Math.atan2(BURNER.x - TIP[0], BURNER.z - TIP[2]);
const pour = {
  vars: [['ph', rounds(.6, 4.2, 2)], ...rodVars('ph', '.6'),
    ['kf', 'cS(t, .05, .8) * (1. - cS(t, 4.05, 4.7))'], ['arc', '.045 * (cBump(t, .05, .8) + cBump(t, 4.05, 4.7))'],
    ['lf', 'cS(t, .85, 1.1) * (1. - cS(t, 3.85, 4.))'], ['mv', 'cS(t, 1.05, 1.75) * (1. - cS(t, 3.35, 3.95))'],
    ['fx', bez('mv', `${f(BO.x)} - .02 * lf`, f(OVER[0]), f(TIP[0]))], ['fy', bez('mv', `${f(BO.y)} + .06 * lf`, f(OVER[1]), f(TIP[1]))], ['fz', bez('mv', `${f(BO.z)} + .04 * lf`, f(OVER[2]), f(TIP[2]))],
    ['fel', `${keys([[0, PI / 2], [1.2, PI / 2], [1.65, 1.2], [2, -.1, 'cOut'], [3.1, -.1], [3.5, PI / 2], [POUR_D, PI / 2]])} - .1 * (cBump(t, 2.15, 2.45) + cBump(t, 2.55, 2.85))`],
    ['lean', 'cS(t, .1, .8) * (1. - cS(t, 3.9, 4.7))'], ['po', 'cS(t, 1.1, 1.7) * (1. - cS(t, 3.3, 3.9))'], ['kp', 'cS(t, .1, .8) * (1. - cS(t, 4., 4.7))']],
  body: { tx: `${f(HOME.tx)} + .01 * lean + .02 * sin(ph)`, ty: '0.', tz: `${f(HOME.tz)} * cos(ph) + .02 * lean`, drop: HOME.drop, bx: `${f(HOME.bx)} * cos(ph) - .015 * lean`, pr: `${f(HOME.pr)} * cos(ph)` },
  feet: { zL: .03, zR: -.03 },
  head: { hx: `${f(HOME.hx)} - .1 * po`, hy: `${f(HOME.hy)} - .25 * lean + .17 * po`, hz: `${f(HOME.hz)} - .1 * po` },
  parts: { rod: rodPart(), bottle: { x: 'fx', y: 'fy', z: 'fz', az: f(AZP), el: 'fel', sp: f(BO.sp + BO.az - AZP), py: f(PROP.bottle.grip) } },
  derive(P, v, t) { const m = partPoint(P.bottle, [0, PROP.bottle.mouth, 0]), on = t > 1.92 && t < 3.2 && P.bottle.el < .05;
    P.stream = { x: m[0], y: m[1], z: m[2], az: 0, el: PI / 2, sp: 0, px: 0, py: 0, pz: 0, len: Math.max(.01, m[1] - (SET.pot.y + PROP.pot.batch)), show: on ? 1 : 0 }; },
  hands: [{ on: away(ON_HANDLE, ['fx', 'fy', 'fz'], 'kf', 'arc', [-.5, .6, .6]), pole: POLE_L.map((v, i) => `mix(${f(v)}, ${f(POLE_P[i])}, kp)`) },
    { on: [[1, ON_ROD]], pole: POLE_R }],
};

// COOK_CHECK (5.4 s, chains to cook_stir): the +x hand leaves the paddle (it rests in the pot) for the vial in its rack (0.6 s), lifts
// it out and takes it up beside the head (out to the side under the head, then up: hail_taxi's way, 0.9–1.6 s), holds it to the light:
// the chin comes up, the head tips to it, the vial turns once slowly round, swirling (1.7–3.7 s) · back down into the rack (4.5), the hand
// back on the paddle by 5.4: HOME. The −x hand keeps the pot's handle. Beside the head is as high as a hand goes (the head owns x ±0.5
// above y 0.9): the fist sits off its side, the eyes turned only a little to it.
const CHECK_D = 5.4, VI = SET.vial, VIA = [.68, .69, .168], TOPV = [.69, .905, .133], POLE_V = [-.22, -.5, .84];
const check = {
  vars: [...rodVars('0.'),
    ['kv', 'cS(t, .05, .6) * (1. - cS(t, 4.6, 5.3))'], ['arc', '.04 * (cBump(t, .05, .6) + cBump(t, 4.6, 5.3))'],
    ['up', 'cS(t, .9, 1.6) * (1. - cS(t, 3.8, 4.4))'], ['lf', 'cS(t, .6, .9) * (1. - cS(t, 4.4, 4.55))'],
    ['vx', bez('up', `${f(VI.x)} + .02 * lf`, f(VIA[0]), f(TOPV[0]))], ['vy', bez('up', `${f(VI.y)} + .05 * lf`, f(VIA[1]), f(TOPV[1]))], ['vz', bez('up', f(VI.z), f(VIA[2]), f(TOPV[2]))],
    ['spin', `${f(TAU)} * cS(t, 1.7, 3.7)`], ['swl', 'cS(t, 1.7, 2.) * (1. - cS(t, 3.4, 3.7))'],
    ['look', 'cS(t, 1.1, 1.7) * (1. - cS(t, 3.45, 3.95))'], ['cu', 'cS(t, .7, 1.3) * (1. - cS(t, 4.25, 4.75))']],
  body: { tx: `${f(HOME.tx)} - .03 * up`, ty: '0.', tz: HOME.tz, drop: HOME.drop, bx: HOME.bx, pr: HOME.pr },
  feet: { zL: .03, zR: -.03 },
  head: { hx: `${f(HOME.hx)} - .16 * cu`, hy: `${f(HOME.hy)} + .04 * look + .03 * sin(3.1416 * (t - 1.7)) * look`, hz: `${f(HOME.hz)} + .06 * cu` },
  parts: { rod: rodPart(), vial: { x: 'vx', y: 'vy', z: 'vz', az: 'spin', el: `${f(PI / 2)} - .15 * swl`, sp: '0.', py: f(PROP.vial.grip) } },
  hands: [{ on: [[1, ON_HANDLE]], pole: POLE_L },
    { on: away(ON_ROD, ['vx', 'vy', 'vz'], 'kv', 'arc', [.6, .3, .6]), pole: POLE_R.map((v, i) => `mix(${f(v)}, ${f(POLE_V[i])}, kv)`) }],
};

// COOK_FAN (3.6 s loop, for the woods shack where the steam comes thick): the steam hits; the cook pulls back from the pot, the face
// turned away to −x and the chin up · the −x hand leaves the handle and fans the fumes off in front of the face (five sweeps, 0.5–2.3 s;
// the sweep is a circle about its shoulder in the chest's frame, so it is always in reach) · two coughs (1.5, 1.9 s) · back over the
// pot, the hand on the handle by 3.15, still by 3.3: HOME. The +x hand keeps the paddle going, one slow round.
const FAN_D = 3.6;
const fan = {
  vars: [['ph', rounds(.3, 3.3, 1, .6)], ...rodVars('ph', '.6'),
    ['bk', 'cS(t, .05, .45) * (1. - cS(t, 2.5, 3.3))'], ['kf', 'cS(t, .15, .5) * (1. - cS(t, 2.35, 3.15))'],
    ['fw', `cS(t, .35, .6) * (1. - cS(t, 2.1, 2.4))`], ['fa', `${f(TAU * 5 / 1.8)} * (t - .5)`], ['al', '.04 + .22 * sin(fa) * fw'],
    ['cg', 'cBump(t, 1.42, 1.62) + .8 * cBump(t, 1.78, 1.98)']],
  body: { tx: `${f(HOME.tx)} - .06 * bk + .07 * cg + .015 * sin(ph)`, ty: '-.06 * bk', tz: `${f(HOME.tz)} * cos(ph) - .02 * bk`, drop: `${f(HOME.drop)} + .015 * cg`, bx: `${f(HOME.bx)} * cos(ph)`, pr: `${f(HOME.pr)} * cos(ph)` },
  feet: { zL: .03, zR: -.03 },
  head: { hx: `${f(HOME.hx)} - .28 * bk + .1 * cg`, hy: `${f(HOME.hy)} - .5 * bk + .06 * sin(${f(TAU * 5 / 1.8)} * (t - .62)) * fw`, hz: `${f(HOME.hz)} + .04 * bk` },
  parts: { rod: rodPart() },
  hands: [{ on: [[`1. - kf`, ON_HANDLE], ['kf', ['chest', ['-.25 + .43 * sin(al)', '.75 + .025 * cos(2. * fa) * fw', '.43 * cos(al)']]]], pole: ['-1.', 'mix(-.4, .3, kf)', 'mix(-.2, -.4, kf)'] },
    { on: [[1, ON_ROD]], pole: POLE_R }],
};

export const CLIPS = [
  clip({ name: 'cook_stir', dur: STIR_D, loop: true, track: stir, note: 'a loop at the bench (prop: the cook set): the −x hand on the pot\'s handle, the +x hand stirring with the paddle, two rounds (0–2.4 s), a lean in to peer at the batch and a tap on the rim, still at HOME by 3.6' }),
  clip({ name: 'cook_pour', dur: POUR_D, next: 'cook_stir', track: pour, note: 'a one-shot from HOME (chains to cook_stir): the −x hand takes the bottle of chem off the bench, tips it over the pot (the stream 1.925–3.175 s) while the +x hand stirs it in, sets it back, back on the handle' }),
  clip({ name: 'cook_check', dur: CHECK_D, next: 'cook_stir', track: check, note: 'a one-shot from HOME (chains to cook_stir): the +x hand leaves the paddle, lifts the vial out of its rack and up beside the head to the light, the head turns to it, the vial turns once slowly round (1.7–3.7 s), back in the rack, back on the paddle' }),
  clip({ name: 'cook_fan', dur: FAN_D, loop: true, track: fan, note: 'a loop for the woods shack (thick steam): the cook pulls back from the pot, face turned away, and fans the fumes off it with the −x hand (five sweeps 0.5–2.3 s), coughs (1.5, 1.9 s), back over the pot by 3.3; the +x hand keeps stirring' }),
];
