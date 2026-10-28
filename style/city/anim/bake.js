// ANIM LAB · the walkers' full body, baked with a finer rig (a copy of pedbake.js bakeFull; pedbake.js is untouched).
// pedbake.js tags every vertex with its limb (0 body · 1 leg L · 2 leg R · 3 arm L · 4 arm R) and the leg swings as one piece.
// Here every voxel face is tagged by its VOXEL'S centre (a quad's centre minus half a voxel along its normal), so a split never
// stretches a face across a joint:
//   0 torso · 1 thigh L · 2 thigh R · 3 arm L · 4 arm R (shoulder to hand: one piece) · 5 head (everything under chars.js userData.head)
//   6 shin L · 7 shin R · 8 foot L · 9 foot R                                            (L = x < 0, chars.js's own naming)
//   (10 / 11 were the forearms: SIMPLE ARMS, 2026-09-30, merged them into the arm; the ids stay free so no other number moves)
// Joints (chars.js voxels, S = 0.05 m): hip y 10 · knee y 6 · ankle y 2.5 · shoulder y 16.5 · neck y 19 (no elbow).
// The foot is the chunky shoe: every leg voxel below y 3, plus the toe box (z ≥ 3) and heel (z ≤ −2) below the knee.
// Output per look (pedbake.js's shape): { full: { P, N, C, K, I, main }, main } in body-local metres, feet at y = 0, facing +z.
export const PART = { torso: 0, thighL: 1, thighR: 2, armL: 3, armR: 4, head: 5, shinL: 6, shinR: 7, footL: 8, footR: 9 };
export const RIG = { hip: [.125, .5, .025], knee: .3, ankle: .125, shoulder: [.25, .825, 0], neck: .95, heel: .175, toe: .275 };   // metres
import { holdId, GRIP_DIV } from './grip.js';   // (held + grip: the hold rides in aPart's fraction)
import { partOf, segOf, SLABS, slabRows, slabSkips } from '../../../world/fit/body.js';   // (fitting body: which segment a voxel rides, the joint slabs)
const LUT = new Uint8Array(4097); for (let i = 0; i <= 4096; i++) { const c = i / 4096; LUT[i] = Math.round(255 * (c <= .0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - .055)); }
const toS = v => LUT[v <= 0 ? 0 : v >= 1 ? 4096 : (v * 4096 + .5) | 0];
const visible = o => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
const under = (m, g) => { for (let p = m.parent; p; p = p.parent) if (p === g) return true; return false; };

// partOf: world/fit/body.js (group: 'legL' | 'legR' | 'armL' | 'armR' | 'head' | 'torso'; v*: voxel centre in chars.js voxels)
export function bakeAnimFull(THREE, CH, o) {
  const rig = o.userData.rig, head = o.userData.head, S = CH.S, P = [], N = [], C = [], K = [], I = [], nm = new THREE.Matrix3(); let v = 0; const bands = [new Map(), new Map(), new Map()];
  const count = new Array(12).fill(0);
  o.traverse(m => { if (!m.isMesh || !visible(m)) return; let group = 'torso'; for (const n of ['legL', 'legR', 'armL', 'armR']) if (under(m, rig[n])) group = n; if (head && under(m, head)) group = 'head';
    const li = Math.max(0, CH.MATS.indexOf(m.material)), g = m.geometry, pos = g.attributes.position.array, nor = g.attributes.normal.array, col = g.attributes.color.array, idx = g.index.array, e = m.matrixWorld.elements; nm.getNormalMatrix(m.matrixWorld); const q = nm.elements, n = pos.length / 3;
    const W = new Float32Array(n * 3);
    for (let k = 0; k < n; k++) { const x = pos[k * 3], y = pos[k * 3 + 1], z = pos[k * 3 + 2];
      W[k * 3] = e[0] * x + e[4] * y + e[8] * z + e[12]; W[k * 3 + 1] = e[1] * x + e[5] * y + e[9] * z + e[13]; W[k * 3 + 2] = e[2] * x + e[6] * y + e[10] * z + e[14]; }
    for (let f = 0; f < n; f += 4) {   // voxGeo: four vertices per face, in order
      let a = nor[f * 3], b = nor[f * 3 + 1], c = nor[f * 3 + 2]; let nx = q[0] * a + q[3] * b + q[6] * c, ny = q[1] * a + q[4] * b + q[7] * c, nz = q[2] * a + q[5] * b + q[8] * c; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      let cx = 0, cy = 0, cz = 0; for (let t = 0; t < 4; t++) { cx += W[(f + t) * 3]; cy += W[(f + t) * 3 + 1]; cz += W[(f + t) * 3 + 2]; }
      const part = partOf(group, (cx / 4 - nx * S * .5) / S, (cy / 4 - ny * S * .5) / S, (cz / 4 - nz * S * .5) / S); count[part] += 4;
      for (let t = f; t < f + 4; t++) { const X = W[t * 3], Y = W[t * 3 + 1], Z = W[t * 3 + 2]; P.push(X, Y, Z); N.push(Math.round(nx * 127), Math.round(ny * 127), Math.round(nz * 127));
        const r = toS(col[t * 3]), gg = toS(col[t * 3 + 1]), bb = toS(col[t * 3 + 2]); C.push(r, gg, bb, li * 85); K.push(part);
        const band = Y < .48 ? 0 : Y < .95 ? 1 : 2, h = (r << 16) | (gg << 8) | bb; bands[band].set(h, (bands[band].get(h) || 0) + 1); } }
    for (let k = 0; k < idx.length; k++) I.push(idx[k] + v); v += n; });
  const main = bands.map(b => { let best = 0x777777, bc = -1; for (const [h, c] of b) if (c > bc) { bc = c; best = h; } return best; });
  return { P: new Float32Array(P), N: new Int8Array(N), C: new Uint8Array(C), K: new Uint8Array(K), I: new Uint32Array(I), main, count };
}
// looks → baked bodies (main thread: the lab bakes a dozen; the city would run this in its worker, jobs.js jobPeds, like bakePeds)
export function bakeAnimLooks(looks, CH, THREE) {
  return looks.map(look => { const o = CH.build(look); o.userData.open.visible = true; o.userData.shut.visible = false; CH.pose(o, 0, 0); o.updateMatrixWorld(true);
    const full = bakeAnimFull(THREE, CH, o); o.traverse(m => m.geometry?.dispose()); return { full, main: full.main, handle: look.handle }; });
}

// ── v2: CLOSED RIGID SEGMENTS (walk2.js). Each part is meshed on its own, every face kept where the neighbour belongs to another part,
// so a bend can never open a hole into a hollow limb (v1's glitch: the leg was meshed as one piece, so the faces between thigh and
// shin, shin and shoe were culled as hidden; when the joints turned, the cut opened and you saw inside, "the material under the shoe").
// Parts are v1's, plus the pelvis: 12 = the pants' seat and waistband (tops and accessories ride the chest, so nothing is cut across
// the waist). At each hinge the child also carries a JOINT SLAB: the parent's voxels next to it (2 deep, along the bone), copied
// with the parent's colour and shading. At rest a slab sits exactly inside the parent (same colour, same light: invisible); when the
// joint bends it swings out and fills the wedge that would open on the outside of the bend.
export const PART2 = { ...PART, pelvis: 12 };
const DIRS = [[1, 0, 0, [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]]], [-1, 0, 0, [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]]], [0, 1, 0, [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]]],
  [0, -1, 0, [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]]], [0, 0, 1, [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]]], [0, 0, -1, [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]]]];   // chars.js voxGeo's
const AOV = [0.55, 0.72, 0.87, 1];
const vk = (x, y, z) => ((x + 256) << 18) | ((y + 256) << 9) | (z + 256), vd = k => [(k >> 18) - 256, ((k >> 9) & 511) - 256, (k & 511) - 256];
// the routing (chars.js bodyPart → world/fit/body.js segOf: a top's shell, flanks included, rides the chest; sleeves ride the arm by
// their own rows; a garment piece authored per segment rides that segment) and the joint slabs [child, parents, directions child →
// parent, depth, rows?] live in world/fit/body.js (SLABS: + the shoulder, chest → upper arm off the arm's top rows).
// DE-COPLANAR (walk polish, 2026-09-29): a pitch hinge (hip, knee, ankle; the elbow until simple arms) keeps a child's side faces, and its slab's, in the
// plane of the parent's side faces at every angle, and a slab's faces lie on its parent's at rest. There the two parts' pixels tied in
// depth and flickered frame to frame (the slab's copy of the parent's colours, turned by the joint, against the parent's own). So each
// part is GROWN away from its own bone axis (x and z; the bone's length is untouched) by a hair per link it is above the chain's end:
// pelvis 3 · thighs 2 · shins, arms 1 · feet 0 hairs of 0.5 mm (o.inset; 0 = off). A parent's face always lies just
// outside its child's (the parent wins), and growing never opens a gap where two parts touch (a hand and a hip, the arm and the chest):
// it only sinks the touching faces a hair into each other. The legs grow outwards only (their axis in x is the midline, where they
// touch). The map is by position, so every part stays closed. The chest and head keep their size: grown, the chest's top face slid
// out under the head's overhang (the see-through gate saw that pair), a shrunk head cracked, and the chest's growth bought nothing
// in the z-fight count. So the head's one-voxel collar slab still lies on the chest's top row, as before.
const LINK = [0, 2, 2, 1, 1, 0, 1, 1, 0, 0, 0, 0, 3];   // per part (PART2 numbering)
export function bakeSegFull(THREE, CH, look, o = {}) {
  const { H, B, F, tag, HX, fit } = CH.compose(look), S = CH.S, groups = new Map(), parts = Array.from({ length: 13 }, () => new Map());   // part → key → [hex, layer, group]
  const JW = o.jewel ? new Map([...(H.jw || []), ...(F.jw || []), ...(B.jw || [])]) : null, JWa = [];   // (lab: jewelry-motion.js) voxel → pendant pivot m (+ 2 iced)
  const gHas = {}; const addG = (g, k) => { (gHas[g] ||= new Set()).add(k); };
  const GRP = ['torso', 'legL', 'legR', 'armL', 'armR', 'head', 'legL', 'legR', 'legL', 'legR', 'armL', 'armR', 'torso'];   // part → its rig group (AO within the group)
  B.L.forEach((M, li) => { for (const [k, c] of M) { const [x, y, z] = vd(k), t = tag.get(k) || 'base', p = segOf(t, x, y, z, fit), g = GRP[p]; addG(g, k); parts[p].set(k, [c, li, g, undefined, t]); } });
  if (HX) HX.L.forEach((M, li) => { for (const [k, c] of M) { const [x, y, z] = vd(k), g = x < 0 ? 'armL' : 'armR'; addG(g, k); parts[partOf(g, x + .5, y + .5, z + .5)].set(k, [c, li, g]); } });   // (held2.js: the item's voxels that sit in another limb at rest)
  const gk = HX ? holdId(look) / GRIP_DIV : 0;   // the hold, as aPart's fraction (grip.js; 0: none, and the K array stays bytes)
  for (const G of [H, F]) G.L.forEach((M, li) => { for (const [k, c] of M) { if (G === F && parts[5].has(k)) continue; addG('head', k); parts[5].set(k, [c, li, 'head']); } });
  const axis = parts.map((V, p) => { let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const k of V.keys()) { const [x, , z] = vd(k); x0 = Math.min(x0, x); x1 = Math.max(x1, x + 1); z0 = Math.min(z0, z); z1 = Math.max(z1, z + 1); }
    return [[1, 2, 6, 7, 8, 9].includes(p) ? 0 : (x0 + x1) / 2 * S, (z0 + z1) / 2 * S]; });   // each part's own axis (its footprint's centre, before the slabs join it; the legs': the midline)
  const hair = o.inset ?? .0005, pull = (u, c, d) => { const v = u - c; return c + Math.sign(v) * (Math.abs(v) + d); };   // (v = 0: on the axis, stays)
  const slabs = o.slabs ?? true, count = new Array(13).fill(0), slabN = new Array(13).fill(0);
  if (slabs) for (const E of SLABS) { const [ch, par, dirs, depth] = E, C = parts[ch];
    for (const k of [...C.keys()]) { const [x, y, z] = vd(k); if (!slabRows(E, y)) continue; for (const [dx, dy, dz] of dirs) for (let s = 1; s <= depth; s++) { const kk = vk(x + dx * s, y + dy * s, z + dz * s); if (C.has(kk)) continue;
      for (const p of par) { const e = parts[p].get(kk); if (e && e[3] === undefined && !slabSkips(E, e[4])) { C.set(kk, [e[0], e[1], e[2], 1]); slabN[ch]++; break; } } } } }
  const P = [], N = [], Cc = [], Kp = [], SL = [], I = [], col = new THREE.Color(), bands = [new Map(), new Map(), new Map()]; let v = 0;
  // (cX, cZ: the part's axis. It was ax / az, shadowed inside the face loop by the AO neighbour's ax / az, so the growth pushed each FACE by
  // its neighbour cell's sign instead of each vertex off the axis: faces sharing an edge parted by a hair and the upper arms cracked open;
  // the see-through gate caught it once the flanks left the arm. Fitting body, 2026-09-30.)
  parts.forEach((V, part) => { const [cX, cZ] = axis[part], ins = LINK[part] * hair; for (const [k, [hex, li, g, sl]] of V) { const [x, y, z] = vd(k), gs = gHas[g], has = (a, b, c) => gs.has(vk(a, b, c)); col.setHex(hex);
    for (const [nx, ny, nz, cs] of DIRS) { const nb = vk(x + nx, y + ny, z + nz); if (V.has(nb) && (!JW || (JW.get(k) ?? 0) % 2 === (JW.get(nb) ?? 0) % 2)) continue;   // closed: only a neighbour in the SAME part hides a face (a pendant is closed against what it lies on)
      const ax = x + nx, ay = y + ny, az = z + nz, a4 = [];
      for (const c of cs) { if (li === 3) { a4.push(3); continue; } const t = [nx ? 0 : (c[0] ? 1 : -1), ny ? 0 : (c[1] ? 1 : -1), nz ? 0 : (c[2] ? 1 : -1)], e = [];   // AO within the voxel's own rig group, as chars.js does
        if (t[0]) e.push([t[0], 0, 0]); if (t[1]) e.push([0, t[1], 0]); if (t[2]) e.push([0, 0, t[2]]);
        const s1 = has(ax + e[0][0], ay + e[0][1], az + e[0][2]), s2 = has(ax + e[1][0], ay + e[1][1], az + e[1][2]), cr = has(ax + t[0], ay + t[1], az + t[2]); a4.push(s1 && s2 ? 0 : 3 - (s1 + s2 + cr)); }
      for (let q = 0; q < 4; q++) { const c = cs[q], X = pull((x + c[0]) * S, cX, ins), Y = (y + c[1]) * S, Z = pull((z + c[2]) * S, cZ, ins), ao = AOV[a4[q]];
        P.push(X, Y, Z); N.push(nx * 127, ny * 127, nz * 127); const r = toS(col.r * ao), gg = toS(col.g * ao), bb = toS(col.b * ao); Cc.push(r, gg, bb, li * 85); Kp.push(part + gk); SL.push(sl ? 1 : 0); if (JW) JWa.push(JW.get(k) ?? 0);
        const band = Y < .48 ? 0 : Y < .95 ? 1 : 2, hh = (r << 16) | (gg << 8) | bb; bands[band].set(hh, (bands[band].get(hh) || 0) + 1); }
      if (a4[0] + a4[2] < a4[1] + a4[3]) I.push(v + 1, v + 2, v + 3, v + 1, v + 3, v); else I.push(v, v + 1, v + 2, v, v + 2, v + 3); v += 4; count[part] += 4; } } });
  const main = bands.map(b => { let best = 0x777777, bc = -1; for (const [h, c] of b) if (c > bc) { bc = c; best = h; } return best; });
  return { P: new Float32Array(P), N: new Int8Array(N), C: new Uint8Array(Cc), K: gk ? new Float32Array(Kp) : new Uint8Array(Kp), SL: new Uint8Array(SL), I: new Uint32Array(I), main, count, slabN, JW: JW ? new Float32Array(JWa) : undefined };
}
export function bakeSegLooks(looks, CH, THREE, o = {}) { return looks.map(look => { const full = bakeSegFull(THREE, CH, look, o); return { full, main: full.main, handle: look.handle }; }); }
