// AI CITY · FRESH character construction: one skeleton, one head, the face grid, the compositor and the walk rig.
// NO trait art lives here. Every trait comes from the fresh registry (world/fresh/: one file per category, one owner each) and the
// base kit (world/base-kit.js: the mannequin's tan skin, bored eyes, plain pants and plain shoes; it has no mouth).
// Construction rules for designers: world/fresh/README.md. The fitting rules: world/fit/contract.js.
import * as THREE from 'three';
import { bodyPart as fitBodyPart, fitOf, installFit, sleeve, shoulderCap, onSeg, segY, kneeCap, chestFront, neckRing, registerTopFit } from './fit/body.js';
import * as LAY from './fit/layers.js';
import { EARS_COVERED, HAT_COVER } from './fit/contract.js';
import { drawLowerForm } from './fit/lower.js';
import { drawShoe, dressAnkle } from './fit/shoe.js';
import { hands, holdArm, holdSwing, registerHeld, poseOf, HOLD, gripCells, channelOf, ENVELOPE, mirror } from './fit/held.js';
import { REG, SLOTS, STRING_SLOTS, OPTIONAL, PROBLEMS, entry, list } from './fresh/index.js';
import { BASE, FIXTURES, mannequin } from './base-kit.js';
import { shade, lerpHex, hash3, mulberry32, line, strand } from './fresh/kit.js';
import { PLANE, painter, clearCell, clipHalves, texels, faceAverage, routeHalves, hk, hd, cellOf } from './fit/fine.js';   // (fine detail: sub-voxel paint + fine voxels)
export const S = 1 / 20;

// ───────────────────────── voxels
const dec = k => [(k >> 18) - 256, ((k >> 9) & 511) - 256, (k & 511) - 256];
class Vox { static k(x, y, z) { return ((x + 256) << 18) | ((y + 256) << 9) | (z + 256); } }
// layers (materials): 0 matte · 1 gloss · 2 metal · 3 lit (unlit emissive). A later write always wins.
// fp / hv: FINE DETAIL (world/fit/fine.js): fp voxel key → [6] face paint (4 × 4 texels a face), hv half key → [colour, layer, slot] (fine
// voxels on the 2× grid). A full write on a voxel (set / del / clip) clears its paint and the fine voxels inside it: the later layer wins.
class Grid {
  constructor() { this.L = [new Map(), new Map(), new Map(), new Map()]; this.fp = new Map(); this.hv = new Map(); }
  set(x, y, z, c, l = 0) { if (c === undefined || c === null) return; const X = Math.round(x), Y = Math.round(y), Z = Math.round(z), k = Vox.k(X, Y, Z), li = l === true ? 1 : (l || 0); for (let i = 0; i < 4; i++) if (i !== li) this.L[i].delete(k); this.L[li].set(k, c);
    if (this.fp.size || this.hv.size) clearCell(this, X, Y, Z, k); }
  del(x, y, z) { const k = Vox.k(x, y, z); for (const M of this.L) M.delete(k); if (this.fp.size || this.hv.size) clearCell(this, x, y, z, k); }
  has(x, y, z) { const k = Vox.k(x, y, z); return this.L.some(M => M.has(k)); }
  get(x, y, z) { const k = Vox.k(x, y, z); for (const M of this.L) if (M.has(k)) return M.get(k); }
  *keys() { for (const M of this.L) yield* M.keys(); }
  // half-open boxes: x0 ≤ x < x1 (c may be (x, y, z) → colour)
  box(x0, y0, z0, x1, y1, z1, c, l) { for (let x = x0; x < x1; x++) for (let y = y0; y < y1; y++) for (let z = z0; z < z1; z++) this.set(x, y, z, typeof c === 'function' ? c(x, y, z) : c, l); }
  ell(cx, cy, cz, rx, ry, rz, c, l) { for (let x = Math.floor(cx - rx); x <= cx + rx; x++) for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let z = Math.floor(cz - rz); z <= cz + rz; z++)
    if (((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 + ((z + .5 - cz) / rz) ** 2 <= 1) this.set(x, y, z, typeof c === 'function' ? c(x, y, z) : c, l); }
  // a bitmap: rows top → bottom from y `top`, columns from x0, one char per voxel through z0 ≤ z < z1; pal: char → colour
  bmp(rows, pal, x0, top, z0, z1, l) { rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) { const c = pal[r[i]]; if (c !== undefined) for (let z = z0; z < z1; z++) this.set(x0 + i, top - j, z, c, l); } }); }
  frontZ(x, y) { for (let z = 24; z >= -24; z--) if (this.has(x, y, z)) return z; return null; }
  onFront(x, y, c, l, depth = 1) { const z = this.frontZ(x, y); if (z !== null) for (let d = 1; d <= depth; d++) this.set(x, y, z + d, c, l); }
  clip(pred) { for (const M of this.L) for (const k of [...M.keys()]) { const [x, y, z] = dec(k); if (pred(x, y, z)) { M.delete(k); this.fp.delete(k); } } clipHalves(this, pred); }
  maxY(pred) { let m = -1e9; for (const k of this.keys()) { const [x, y, z] = dec(k); if (pred(x, y, z) && y > m) m = y; } return m; }
}
const DIRS = [
  { n: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]] }, { n: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },
  { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] }, { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] }, { n: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]] },
];
const AOV = [0.55, 0.72, 0.87, 1];   // corner AO (the city's buildings use the same curve)
// fine (optional, world/fit/fine.js): { fp, sub, half: [[half key, colour]], hasHalf(k) }. A painted face is drawn in its texels' AVERAGE
// colour (sub false: the mid tier and anything resampled reads one colour a face) or as its 4 × 4 texels (sub true: the photo booth).
// Fine voxels are half-size cubes, culled against voxels and fine voxels, with the same corner AO counted in half cells.
function voxGeo(M, has, ao = true, fine = null) {
  const P = [], N = [], Co = [], I = []; let v = 0; const col = new THREE.Color(), fp = fine && fine.fp && fine.fp.size ? fine.fp : null, sub = !!(fine && fine.sub);
  const aoOf = (occ, x, y, z, d) => { const [nx, ny, nz] = d.n, ax = x + nx, ay = y + ny, az = z + nz, a4 = [];
    for (const c of d.c) { if (!ao) { a4.push(3); continue; } const t = [nx ? 0 : (c[0] ? 1 : -1), ny ? 0 : (c[1] ? 1 : -1), nz ? 0 : (c[2] ? 1 : -1)], e = [];
      if (t[0]) e.push([t[0], 0, 0]); if (t[1]) e.push([0, t[1], 0]); if (t[2]) e.push([0, 0, t[2]]);
      const s1 = occ(ax + e[0][0], ay + e[0][1], az + e[0][2]), s2 = occ(ax + e[1][0], ay + e[1][1], az + e[1][2]), cr = occ(ax + t[0], ay + t[1], az + t[2]);
      a4.push(s1 && s2 ? 0 : 3 - (s1 + s2 + cr)); } return a4; };
  for (const [k, hex] of M) { const [x, y, z] = dec(k), fa = fp && fp.get(k);
    for (let di = 0; di < 6; di++) { const d = DIRS[di], [nx, ny, nz] = d.n; if (has(x + nx, y + ny, z + nz)) continue; const a4 = aoOf(has, x, y, z, d), fe = fa && fa[di];
      if (fe && sub) {   // the 4 × 4 texels, each a small quad, AO interpolated across the face
        const tx = texels(fe, hex), [A, Bx] = PLANE[di], ac = [0, 0, 0, 0], o = [x, y, z]; for (let q = 0; q < 4; q++) { const c = d.c[q]; ac[c[A] * 2 + c[Bx]] = AOV[a4[q]]; }
        for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { col.setHex(tx[j * 4 + i]);
          for (const c of d.c) { const p = [x + c[0], y + c[1], z + c[2]], ua = (i + c[A]) / 4, ub = (j + c[Bx]) / 4; p[A] = o[A] + ua; p[Bx] = o[Bx] + ub;
            const a = ac[0] * (1 - ua) * (1 - ub) + ac[2] * ua * (1 - ub) + ac[1] * (1 - ua) * ub + ac[3] * ua * ub; P.push(p[0], p[1], p[2]); N.push(nx, ny, nz); Co.push(col.r * a, col.g * a, col.b * a); }
          I.push(v, v + 1, v + 2, v, v + 2, v + 3); v += 4; }
        continue; }
      col.setHex(fe ? faceAverage(fe, hex) : hex);
      for (let q = 0; q < 4; q++) { const c = d.c[q]; P.push(x + c[0], y + c[1], z + c[2]); N.push(nx, ny, nz); const a = AOV[a4[q]]; Co.push(col.r * a, col.g * a, col.b * a); }
      if (a4[0] + a4[2] < a4[1] + a4[3]) I.push(v + 1, v + 2, v + 3, v + 1, v + 3, v); else I.push(v, v + 1, v + 2, v, v + 2, v + 3); v += 4; } }
  if (fine && fine.half && fine.half.length) {   // fine voxels (half units: positions / 2)
    const hh = (a, b, c) => fine.hasHalf(hk(a, b, c)) || has(...cellOf(a, b, c));
    for (const [k, hex] of fine.half) { const [x, y, z] = hd(k); col.setHex(hex);
      for (const d of DIRS) { const [nx, ny, nz] = d.n; if (hh(x + nx, y + ny, z + nz)) continue; const a4 = aoOf(hh, x, y, z, d);
        for (let q = 0; q < 4; q++) { const c = d.c[q]; P.push((x + c[0]) / 2, (y + c[1]) / 2, (z + c[2]) / 2); N.push(nx, ny, nz); const a = AOV[a4[q]]; Co.push(col.r * a, col.g * a, col.b * a); }
        if (a4[0] + a4[2] < a4[1] + a4[3]) I.push(v + 1, v + 2, v + 3, v + 1, v + 3, v); else I.push(v, v + 1, v + 2, v, v + 2, v + 3); v += 4; } } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(Co, 3)); g.setIndex(I); return g;
}
const MATS = [new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .62, metalness: 0 }), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .2, metalness: .15 }),
  new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .22, metalness: .85, envMapIntensity: 2.6 }), new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })];

// ───────────────────────── the registry, wired (world/fresh/index.js → the fitting rules)
// (both pools: the agents' REG and the NPC pool, world/fresh/index.js list(slot, 'all'); their ids never overlap)
for (const t of list('top', 'all')) registerTopFit(t.id, t);   // each top's flank and neckline (world/fit/body.js)
for (const t of list('hat', 'all')) { if (t.coversEars) EARS_COVERED.add('hat/' + t.id); if (t.cover && t.cover !== 'auto') HAT_COVER.set('hat/' + t.id, t.cover); }
for (const t of list('hair', 'all')) if (t.coversEars) EARS_COVERED.add('hair/' + t.id);
for (const t of list('ears', 'all')) if (t.overHat || t.socket) LAY.EAR_SOCKET.set(t.id, t.overHat ? 'over' : 'socket');
for (const t of list('held', 'all')) registerHeld(t.id, t.pose);   // (each held trait's hold pose: world/fit/held.js)
if (PROBLEMS.length && typeof console !== 'undefined') console.warn(`fresh registry: ${PROBLEMS.length} problem(s)\n` + PROBLEMS.join('\n'));
// a slot's entry for a look value: 'base' → the base kit, 'none' → null, an unknown id → the base kit (required slots) or null
function traitOr(slot, v) { const id = typeof v === 'string' ? v : v && v.id; if (!id || id === 'none') return null; if (id === 'base') return BASE[slot] || null; if (id.startsWith('base:')) return FIXTURES[slot]?.[id] || BASE[slot] || null;
  return entry(slot, id) || (OPTIONAL.has(slot) ? null : BASE[slot] || null); }
// a complete look (every slot present; missing ones from the mannequin)
function look(o = {}) { const M = mannequin(), L = { ...M, ...o };
  for (const s of SLOTS) { if (STRING_SLOTS.has(s)) { if (typeof L[s] !== 'string') L[s] = M[s]; } else if (!L[s] || typeof L[s] !== 'object' || typeof L[s].id !== 'string') L[s] = M[s]; }
  return L; }

// ───────────────────────── skin: surface and face colours only (the skeleton never moves)
function skinOf(id) {
  const t = traitOr('skin', id) || BASE.skin, c = typeof t.c === 'function' ? t.c : (() => t.c), base0 = typeof t.c === 'number' ? t.c : t.c(0, 26, 7);
  const sh = typeof t.sh === 'function' ? t.sh : t.sh !== undefined ? (() => t.sh) : ((x, y, z) => shade(c(x, y, z), .8));
  return { id, c, sh, layer: t.layer ?? 0, ink: t.ink ?? 0x2a1a14, brow: t.brow === null ? null : (t.brow ?? 0x22160f), mouth: t.mouth ?? 0x3e211a, lash: t.lash ?? 0x160f0f,
    lip: t.lip ?? lerpHex(shade(base0, .85), 0xd0505a, .35), noEars: !!t.noEars, decorate: t.decorate, fine: t.fine };
}

// ───────────────────────── the base: one skeleton, one head (the anchors)
// head x −8..7, y 19..33, z −7..7 (face z = 7) · eyes 5 wide, x −7..−3 and 2..6, rows y 26..23 · brows y 29..27 · nose y 22 ·
// the mouth zone x −6..5, y 19..21, z 6..8 (world/fit/body.js MOUTH; mouth.js rows: x −3..2, rows y 21..19) · ears x −10..−9 and 8..9, y 23..27, z −1..1 · neck x −1..0, y 17..18 · torso x −5..4, y 10..17, z −2..2 ·
// arms x −8..−6 and 5..7, y 10..16 (hands y 6..9) · legs x −4..−2 and 1..3, z −1..1 (the shoe owns y 0..3, the pants y 4..10)
function base(H, B, sk) {
  const c = sk.c, L = sk.layer;
  B.box(-4, 0, -1, -1, 10, 2, c, L); B.box(1, 0, -1, 4, 10, 2, c, L); B.box(-5, 10, -2, 5, 18, 3, c, L);
  B.box(-8, 10, -1, -5, 17, 1, c, L); B.box(5, 10, -1, 8, 17, 1, c, L); B.box(-1, 17, -1, 1, 19, 1, c, L);
  H.box(-8, 19, -7, 8, 34, 8, c, L);
  if (!sk.noEars) { H.box(-10, 23, -1, -8, 28, 2, c, L); H.box(8, 23, -1, 10, 28, 2, c, L); for (let y = 24; y < 27; y++) { H.set(-10, y, 1, sk.sh(-10, y, 1), L); H.set(9, y, 1, sk.sh(9, y, 1), L); } }
}

// ───────────────────────── the face: eyes (5-wide grid, brows per style) + the nose + a rows-form mouth (mouth.js: the 6-wide grid),
// drawn open and closed (the blink). A zone mouth (mouths.js) is drawn on the head in compose(); mouth 'base' draws no mouth.
const CLOSED = ['LLLLL', 'LLLLL', 'KKKKK', '.....'];
const cell = p => Array.isArray(p) ? p : [p];   // a palette value: colour | [colour, layer, z]
function eyeVox(F, ch, x, y, sk, pal) {
  const p = pal && pal[ch]; if (p !== undefined) { const [c, l = 0, z = 7] = cell(p); F.set(x, y, z, c, l); return; }
  switch (ch) {
    case 'L': F.set(x, y, 8, sk.sh(x, y, 8), sk.layer); F.set(x, y, 7, sk.lash); break;   // the lid: skin one proud, the lash under it
    case 'W': F.set(x, y, 7, 0xf6f4ef); break; case 'P': F.set(x, y, 7, 0x141013, 1); break; case 'K': F.set(x, y, 7, 0x141013); break;
  }
}
function faceGrid(sk, L, closed, flog) {
  const F = new Grid(), ec = { sk, shade, lerpHex, hash3, closed };
  const st = traitOr('eyes', L.eyes) || BASE.eyes, mirror = st.mirror !== false;
  for (const side of [0, 1]) {
    const spec = side === 1 && st.right ? st.right : st, rows = closed ? (st.closed ?? CLOSED) : spec.rows, X = i => mirror ? (side ? 6 - i : -7 + i) : (side ? 2 + i : -7 + i);
    rows.forEach((r, j) => { for (let i = 0; i < 5; i++) eyeVox(F, r[i], X(i), 26 - j, sk, st.palette); });
    if (sk.brow !== null) spec.brow.forEach((r, j) => { for (let i = 0; i < 5; i++) if (r[i] === 'B') F.set(X(i), 29 - j, 8, sk.brow); });
  }
  if (st.fx) st.fx(F, ec);
  if (st.fine) st.fine(painter([F], 'eyes', closed ? null : flog), ec);
  F.set(-1, 22, 8, sk.sh(-1, 22, 8), sk.layer); F.set(0, 22, 8, sk.sh(0, 22, 8), sk.layer);   // the nose
  const mo = traitOr('mouth', L.mouth); if (!mo || !mo.rows) return F;   // (no mouth, or a zone mouth: compose draws it on the head)
  mo.rows.forEach((r, j) => { for (let i = 0; i < 6; i++) { const x = -3 + i, y = 21 - j, ch = r[i], p = mo.palette && mo.palette[ch];
    if (p !== undefined) { const [c, l = 0, z = 7] = cell(p); F.set(x, y, z, c, l); continue; }
    switch (ch) { case 'K': F.set(x, y, 7, sk.mouth); break; case 'W': F.set(x, y, 7, 0xf6f4ef); break;
      case 'L': F.set(x, y, 8, sk.lip, 1); if (j === 1) F.set(x, y, 9, sk.lip, 1); break; } } });
  if (mo.fx) mo.fx(F, ec);
  if (mo.fine) mo.fine(painter([F], 'mouth', closed ? null : flog), ec);
  return F;
}

// ───────────────────────── what a trait's draw gets (ctx). Head pieces draw on H, body pieces on B; see world/fresh/README.md.
function ctxOf(L, sk, B, extra) {
  return { look: L, sk, S, shade, lerpHex, hash3, mulberry32, line, strand, segY,
    sleeve: (s, region, box, paint, l) => sleeve(B, s, region, box, paint, l), shoulderCap: (s, paint, o) => shoulderCap(B, s, paint, o),
    onSeg: (region, fn) => onSeg(B, region, fn), kneeCap: (s, paint, o) => kneeCap(B, s, paint, o),
    chestFront: (x, y) => chestFront(L, x, y), neckRing: () => neckRing(L), frontZ: (x, y) => B ? B.frontZ(x, y) : null, ...extra };
}
// a bottom entry → the leg form's draw parameters (world/fit/leg-forms.js drawLegForm)
// what a held trait's draw gets as ctx.grip (world/fit/held.js; README § Held): the pose, its channel cells, the +x hand's channel and
// the envelope it must stay inside (rest voxels, +x hand; mirror(x) = −1 − x gives the −x hand)
export const gripOf = pose => ({ pose, axis: HOLD[pose].axis, hands: HOLD[pose].hands, cells: gripCells(pose), channel: channelOf(HOLD[pose].axis), envelope: ENVELOPE[pose], mirror });
const lowerOf = t => ({ form: t.form, formSpec: t.formSpec, c: t.color, waistC: t.waist ?? t.color, sock: t.sock ?? 'none', sockColor: t.sockColor,
  paint: t.paint ? (q => { const v = t.paint(q); return v === undefined || v === null ? [q.c, q.l] : Array.isArray(v) ? [v[0], v[1] ?? 0] : [v, 0]; }) : undefined });

// ───────────────────────── the compositor: look → voxels (face carved, blink-ready)
function compose(L0, o = {}) {   // o.torso: stop after the top (world/fit/body.js neckRing / chestFront read that)
  const L = look(L0), H = new Grid(), B = new Grid(), SH = new Grid(), sk = skinOf(L.skin), tag = new Map(), fit = fitOf(L); let cur = 'base'; B.fit = fit;   // (fit: the per-look routing context, world/fit/body.js)
  const set0 = B.set.bind(B); B.set = (x, y, z, c, l) => { set0(x, y, z, c, l); if (c !== undefined && c !== null) { const k = Vox.k(Math.round(x), Math.round(y), Math.round(z)); tag.set(k, cur); if (fit.seg) fit.force.set(k, fit.seg); else fit.force.delete(k); } };
  const HT = LAY.tagHead(H);   // (every head-grid voxel carries its slot)
  // FINE DETAIL: each slot's fine(P, ctx) pass runs right after its draw, on its own grids (world/fit/fine.js painter); FL logs it per slot
  const FL = {}, fineOf = (t, slot, grids, ctx) => { if (t && typeof t.fine === 'function') t.fine(painter(grids, slot, FL), ctx); };
  base(H, B, sk); if (sk.decorate) sk.decorate(H, ctxOf(L, sk, null)); fineOf(sk, 'skin', [H, B], ctxOf(L, sk, B));
  HT.slot('marks'); const mk = traitOr('mark', L.mark); if (mk) { mk.draw(H, ctxOf(L, sk, null)); fineOf(mk, 'mark', [H], ctxOf(L, sk, null)); }
  // the MOUTH, zone form (mouths.js): on the head, over the skin and the face ink, under hair, hat (a mask or a rag wins) and eyewear;
  // it may change only the mouth zone (world/fit/body.js MOUTH; the audit's mouthZone check). Tagged 'mouth' on the head grid.
  HT.slot('mouth'); const mz = traitOr('mouth', L.mouth); if (mz && !mz.rows) { if (mz.draw) mz.draw(H, ctxOf(L, sk, null)); fineOf(mz, 'mouth', [H], ctxOf(L, sk, null)); }
  // shoes have their own grid: a pant draw can never cut a tongue or collar off the foot
  const shoe = traitOr('shoes', L.shoes) || BASE.shoes; drawShoe(SH, shoe, ctxOf(L, sk, null)); B.shoeGrid = SH;
  for (const k of [...B.keys()]) { const [x, y, z] = dec(k); if (y < 4) B.del(x, y, z); }
  const bt = traitOr('bottom', L.bottom) || BASE.bottom, lower = lowerOf(bt);
  const tp = traitOr('top', L.top);   // (the pants paint the waist groove as a seam and close the seat, whatever the top: world/fit/lower.js)
  cur = 'bottom'; drawLowerForm(B, lower, sk); fineOf(bt, 'bottom', [B], ctxOf(L, sk, B));
  dressAnkle(SH, B, shoe, lower, sk); fineOf(shoe, 'shoes', [SH], ctxOf(L, sk, null));
  cur = 'top'; if (tp) { tp.draw(B, ctxOf(L, sk, B)); fineOf(tp, 'top', [B], ctxOf(L, sk, B)); }
  if (o.torso) return { B, tag, fit };
  HT.slot('hair'); const hr = traitOr('hair', L.hair); if (hr) { hr.draw(H, ctxOf(L, sk, null)); fineOf(hr, 'hair', [H], ctxOf(L, sk, null)); }
  HT.slot('hat'); const ht = traitOr('hat', L.hat);
  if (ht) { ht.draw(H, ctxOf(L, sk, null)); fineOf(ht, 'hat', [H], ctxOf(L, sk, null));   // (the cover is read off the hat's voxels AND its fine voxels, in half units)
    LAY.clipHair(H, HT.tag, LAY.coverOf(L.hat.id, G => { ht.draw(G, ctxOf(L, sk, null)); if (typeof ht.fine === 'function') ht.fine(painter([G], 'hat', null), ctxOf(L, sk, null)); }, Grid)); LAY.earFlaps(H, HT.tag, L.hat.id); }
  HT.slot('eyewear'); const ew = traitOr('eyewear', L.eyewear); if (ew) { ew.draw(H, ctxOf(L, sk, null)); fineOf(ew, 'eyewear', [H], ctxOf(L, sk, null)); }
  HT.slot('ears'); const er = traitOr('ears', L.ears); if (er && (!sk.noEars || er.overHat || er.socket) && LAY.showEarItem(L)) { er.draw(H, ctxOf(L, sk, null)); fineOf(er, 'ears', [H], ctxOf(L, sk, null)); }
  const ac = traitOr('acc', L.acc); if (ac) { cur = 'acc'; const cx = ctxOf(L, sk, B, { as: part => { cur = part; } }); ac.draw(B, cx); fineOf(ac, 'acc', [B], cx); }   // (as: the body part the next voxels ride)
  // HELD (world/fit/held.js, README § Held): drawn on its own grid HX in the rest frame of the gripping arm, so it never takes a body
  // cell; it rides that arm (both arms in a two-hand pose) and passes through the closed fist's channel. Then the hands, last.
  const HX = new Grid(), hl = traitOr('held', L.held), hp = poseOf(L);
  if (hl && HOLD[hp].hands) { const cx = ctxOf(L, sk, HX, { grip: gripOf(hp) }); hl.draw(HX, cx); fineOf(hl, 'held', [HX], cx); }
  cur = 'hands'; hands(B, sk, L);   // hands last, so nothing eats them: a mitten, or a fist round the channel when it grips
  LAY.shareCells(H, HT.tag, B, tag);   // (a cell in both grids: the later layer keeps it)
  const F = faceGrid(sk, L, false, FL), Fc = faceGrid(sk, L, true, FL);
  for (const k of new Set([...F.keys(), ...Fc.keys()])) { const [x, y, z] = dec(k);
    if (z <= 7) { const c = H.get(x, y, z); if (c === undefined || c === sk.c(x, y, z)) H.del(x, y, z); else { F.del(x, y, z); Fc.del(x, y, z); } }
    else if (H.has(x, y, z)) { F.del(x, y, z); Fc.del(x, y, z); } }
  for (const G of [F, Fc]) for (const k of [...G.hv.keys()]) if (H.has(...cellOf(...hd(k)))) G.hv.delete(k);   // (a face-grid fine voxel inside a head voxel, under a mask: the head wins, as for voxels)
  for (const [A, Bv] of [[F, Fc], [Fc, F]]) for (const k of [...A.keys()]) { const [x, y, z] = dec(k); if (z <= 7 && !Bv.has(x, y, z)) Bv.set(x, y, z, sk.c(x, y, z), sk.layer); }
  return { H, B, SH, F, Fc, tag, HX, fit, flog: FL, htag: HT.tag };   // (htag: the head grid's slot tags)
}
function meshes(G, parent, off, extra, sub = false) { const has = extra ? ((x, y, z) => G.has(x, y, z) || extra.has(x, y, z)) : ((x, y, z) => G.has(x, y, z)); const out = [];
  const half = [[], [], [], []]; for (const [k, v] of G.hv) half[v[1]].push([k, v[0]]); const hasHalf = k => G.hv.has(k) || !!(extra && extra.hv.has(k));
  G.L.forEach((M, i) => { if (!M.size && !half[i].length) return; const m = new THREE.Mesh(voxGeo(M, has, i !== 3, { fp: G.fp, sub, half: half[i], hasHalf }), MATS[i]); m.castShadow = i !== 3; m.receiveShadow = true; m.position.y = off; parent.add(m); out.push(m); }); return out; }
// the static rig (the photo booth, thumbnails): shoes and pants ride the legs; hands and sleeves ride the arms; the rest is torso
function bodyPart(t, x, y, z, fit) { return fitBodyPart(t, x, y, z, fit); }
const PIVOT = { legL: [0, 10, .5], legR: [0, 10, .5], armL: [0, 16.5, 0], armR: [0, 16.5, 0] };
// o.fine: 'tex' draws fine paint as its 4 × 4 texels (the photo booth); default 'avg' draws each painted face in its average colour (what
// the city's mid tier resamples). Fine voxels are drawn either way, each riding the rig group of the voxel it touches.
function build(L0, o = {}) {
  const L = look(L0), { H, B, SH, F, Fc, tag, HX, fit } = compose(L), root = new THREE.Group(), head = new THREE.Group(), sub = o.fine === 'tex'; head.position.set(0, 19, 0); root.add(head);
  const parts = { torso: new Grid(), legL: new Grid(), legR: new Grid(), armL: new Grid(), armR: new Grid() }, grp = new Map();
  const carry = (G, k, c, li, n) => { parts[n].L[li].set(k, c); const f = G.fp.get(k); if (f) parts[n].fp.set(k, f); };
  B.L.forEach((M, li) => { for (const [k, c] of M) { const [x, y, z] = dec(k), n = bodyPart(tag.get(k) || 'base', x, y, z, fit); grp.set(k, n); carry(B, k, c, li, n); } });
  SH.L.forEach((M, li) => { for (const [k, c] of M) carry(SH, k, c, li, dec(k)[0] < 0 ? 'legL' : 'legR'); });
  HX.L.forEach((M, li) => { for (const [k, c] of M) carry(HX, k, c, li, dec(k)[0] < 0 ? 'armL' : 'armR'); });
  if (B.hv.size) { const r = routeHalves(B.hv.keys(), (x, y, z) => grp.get(Vox.k(x, y, z)), k => { const [x, y, z] = cellOf(...hd(k)); return bodyPart(B.hv.get(k)[2], x, y, z, fit); });
    for (const [k, v] of B.hv) parts[r.get(k)].hv.set(k, v); }
  for (const [k, v] of SH.hv) parts[hd(k)[0] < 0 ? 'legL' : 'legR'].hv.set(k, v);
  for (const [k, v] of HX.hv) parts[hd(k)[0] < 0 ? 'armL' : 'armR'].hv.set(k, v);   // (held fine voxels ride the gripping arm)
  meshes(parts.torso, root, 0, null, sub); const rig = { swing: holdSwing(L) };
  for (const n of ['legL', 'legR', 'armL', 'armR']) { const g = new THREE.Group(), pv = PIVOT[n]; g.position.set(...pv); if (!holdArm(THREE, L, n, g, parts[n], pv, (G, p, off) => meshes(G, p, off, null, sub))) for (const m of meshes(parts[n], g, 0, null, sub)) m.position.set(-pv[0], -pv[1], -pv[2]); root.add(g); rig[n] = g; }
  meshes(H, head, -19, F, sub); const open = new THREE.Group(), shut = new THREE.Group(); head.add(open, shut); shut.visible = false;
  meshes(F, open, -19, H, sub); meshes(Fc, shut, -19, H, sub);
  root.scale.setScalar(S); root.userData = { head, open, shut, L, rig }; return root;
}
// pose: gait is the stride phase (radians), w blends from standing (0) to walking (1). (The city's walkers use anim/walk2.js instead.)
function pose(o, gait, w = 1) { const r = o.userData.rig; if (!r) return; const s = Math.sin(gait) * w;
  r.legL.rotation.x = s * .6; r.legR.rotation.x = -s * .6; r.armR.rotation.x = s * .45 * (r.swing ? r.swing[1] : 1); r.armL.rotation.x = -s * .45 * (r.swing ? r.swing[0] : 1); }
function dispose(o) { o.traverse(n => { if (n.geometry) n.geometry.dispose(); }); }

installFit({ draw: L => compose(L, { torso: true }) });   // (the fitting body reads the drawn torso: neckRing, chestFront)

export { Grid, Vox, voxGeo, MATS, skinOf, compose, build, pose, dispose, look, mannequin, faceGrid, traitOr, shade, lerpHex, hash3, mulberry32, SLOTS, REG, PROBLEMS };
