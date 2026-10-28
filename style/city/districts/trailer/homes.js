// SUNNY ACRES · the homes. Nine kinds, all with the door on the lane (the sim's door opening: 1.2 × 2.4 m, 0.3 m up — the floor of
// every home is 0.3 m above the pad, so the sim-state layer's locks, steel doors and safes land on the threshold and the porch):
//   single  a single-wide along the lane          nose    a single-wide nose-in, door in its end wall, carport beside it
//   double  a park model with a shingle gable     camper  a canned-ham camper with a big awning
//   bullet  a silver bullet, riveted              bus     a short school bus somebody lives in
//   box     a shipping container with a cut door  rv      a cab-over motorhome that stopped moving
//   shack   plywood and tin, a lean-to roof, a tarp
// One flat wall colour per home (STYLE §2) with a stripe, trim and skirt; neutral roofs with the usual junk on them.
import { Vol } from '../../vox.js';
import { frame, win, AIR, TOD } from '../../kit.js';
import { REG } from '../../audit.js';
import { PAL, CV, SIDE, hash, shade } from '../../style.js';
import { cyl, line, mix, textMask } from './brush.js';
import { frameOf, SIZE } from './plan.js';

const INK = PAL.ink, WHITE = PAL.white, GALV = 0xb9bcc4, ALU = 0xc9ced6, TYRE = 0x1b1b20, TARP = 0x2f6bdf, CONC = 0xb8b3a8, UNDER = 0x2a2a30;
export const FLOOR = 3, WALL = 26;                                      // floor 0.3 m up; walls 2.6 m
const DOORC = [WHITE, 0x7a1020, INK, 0x8a5a2a, 0x0b5a3a, 0x2f5bff];
const ROT = { '+z': 0, '+x': 1, '-z': 2, '-x': 3 }, NRM = [[0, 1], [1, 0], [0, -1], [-1, 0]];
// continuous frame coordinate a (0 = the wall's left edge seen from outside) on the skin → world x, z of the face plane
function faceXZ(V, B, side, a) { const s = V.s, o = V.org;
  return side === '+z' ? [o[0] + (B.x0 + a) * s, o[2] + B.z1 * s] : side === '-z' ? [o[0] + (B.x1 - a) * s, o[2] + B.z0 * s] : side === '-x' ? [o[0] + B.x0 * s, o[2] + (B.z0 + a) * s] : [o[0] + B.x1 * s, o[2] + (B.z1 - a) * s]; }

// the stampA turn (radians) of a point about (cx, cz): the transform vox.js stampA applies, so anchors land on the turned geometry. The pad
// frame's 180° flip commutes with it, so the same formula turns pad-local (u, v) about a pad-local centre.
export const rotXZ = (x, z, cx, cz, a) => { const c = Math.cos(a), s = Math.sin(a), dx = x - cx, dz = z - cz; return [cx + dx * c + dz * s, cz - dx * s + dz * c]; };
const g1 = x => Math.round(x * 10) / 10;   // (every rect on the 0.1 grid: voxels of neighbouring volumes line up exactly)

// the home's world rect, the door's place on the front, the porch and any add-on, from the pad and its spec (every block can compute any
// pad's shape: the yard builder, the facing pad's block and the far tier all read this). Pure and memoised.
// Pass 3 (breaking the grid): the home sits at its own depth and, unless it is a nose-in, a few degrees off square; the turned shape (home,
// porch, add-on) is kept inside the pad, out of the shared back strip (v ≥ 2) and clear of the lane edge, the path and the car.
export function homeRect(p) {
  if (p._H) return p._H;
  const s = p.spec, F = frameOf(p), t = s.type, [L, W, vb] = SIZE[t], j = (hash(s.seed, 3) - .5) * .3;
  const nL = Math.round(L / CV), a = t === 'nose' ? (s.side ? nL - 16 : 4) : t === 'double' ? (nL >> 1) - 6 : t === 'bus' ? (s.side ? nL - 26 : 14) : t === 'rv' ? (s.side ? 10 : nL - 22)
    : t === 'camper' ? (s.side ? 7 : nL - 19) : t === 'shack' ? (nL >> 1) - 10 : (s.side ? 9 : nL - 21);
  // single-wides and bullets keep their tow hitch: it points away from the door and gets a metre of the pad
  const hitch = (t === 'single' || t === 'bullet') ? (a < nL / 2 ? 1 : -1) : 0;
  const baseU = L <= 4.8 ? (s.side ? 8 - .5 - L : .5) : hitch > 0 ? .4 : hitch < 0 ? 8 - .4 - L : Math.max(.3, Math.min(8 - .3 - L, (8 - L) / 2 + j));
  // the porch (sizes by hash) and the add-on, relative to the home
  const kind = t === 'double' ? 'rail' : t === 'bus' || t === 'rv' ? 'metal' : s.deck, hk = k => hash(s.seed, k, 41);
  const dw = kind === 'metal' ? 1.6 : kind === 'stoop' ? 2.4 : t === 'nose' ? L : t === 'double' ? 2.8 : 3.0 + ((hk(1) * 4) | 0) * .2, dd = kind === 'metal' ? 1.1 : kind === 'stoop' ? 1.2 : 1.8 + ((hk(2) * 3) | 0) * .2;
  const dA = (a + 6) * CV, du0 = kind === 'metal' || t === 'double' ? dA - dw / 2 : t === 'nose' ? 0 : dA < L / 2 ? dA - .9 : dA + .9 - dw;   // (porch start, from the home's u0)
  const far = dA < L / 2 ? 1 : -1, carU = !['bus', 'rv', 'double', 'nose'].includes(t) && L > 4.8 && s.vehicle !== 'none';
  let add = null;
  if (s.addon === 'room' && ['single', 'box', 'bullet', 'rv', 'bus', 'shack'].includes(t)) { const room = far > 0 ? L - (du0 + dw) - .2 : du0 - .2, aw = g1(Math.min(2.2 + hash(s.seed, 61, 3) * .8, room)), ad = g1(Math.max(1.4, Math.min(2.0, dd)));
    if (aw >= 1.6) add = { kind: 'room', du0: far > 0 ? L - aw : 0, du1: far > 0 ? L : aw, dv0: W, dv1: W + ad, mat: (hash(s.seed, 62, 3) * 3) | 0 }; }
  if (s.addon === 'leanto' && ['camper', 'shack', 'box', 'double'].includes(t)) add = { kind: 'leanto', du0: far > 0 ? L : -1.1, du1: far > 0 ? L + 1.1 : 0, dv0: .2, dv1: W - .2, mat: (hash(s.seed, 62, 3) * 3) | 0 };
  // place the (turned) shape: its corners inside [0.15, 7.85] × [2.05, front], front = 8.9 with a car along the lane in front, else 10.3
  const front = t === 'nose' ? 11.45 : carU ? 8.9 : 10.3, rects = [[0, 0, L, W], [du0, W, du0 + dw, W + dd]].concat(add ? [[add.du0, add.dv0, add.du1, add.dv1]] : []);
  const shape = (u0, v0, r) => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; const cu = u0 + L / 2, cv = v0 + W / 2;
    for (const [a0, b0, a1, b1] of rects) for (const uu of [a0, a1]) for (const vv of [b0, b1]) { const [ru, rv] = rotXZ(u0 + uu, v0 + vv, cu, cv, r); x0 = Math.min(x0, ru); x1 = Math.max(x1, ru); y0 = Math.min(y0, rv); y1 = Math.max(y1, rv); }
    return [x0, y0, x1, y1]; };
  let rad = t === 'nose' ? 0 : (s.ang || 0) * Math.PI / 180, u0 = baseU, v0 = vb;
  for (let tries = 0; tries < 3; tries++) { const A = shape(baseU, vb, rad), lo = vb + (2.05 - A[1]), hi = vb + (front - A[3]), ulo = baseU + (.15 - A[0]), uhi = baseU + (7.85 - A[2]);
    if ((lo <= hi + 1e-6 && ulo <= uhi + 1e-6) || rad === 0) { v0 = t === 'nose' ? vb : Math.max(lo, Math.min(hi, vb + (s.vbJ || 0))); u0 = Math.max(ulo, Math.min(uhi, baseU)); break; }
    if (tries === 1 && add) add = null, rects.length = 2; else rad = tries === 0 ? rad / 2 : 0; }
  u0 = g1(u0); v0 = g1(v0);
  const v1 = v0 + W, deck = { kind, u0: g1(u0 + du0), u1: g1(u0 + du0 + dw), v0: v1, v1: g1(v1 + dd), w: dw, d: dd };
  const addon = add && { ...add, u0: g1(u0 + add.du0), u1: g1(u0 + add.du1), v0: g1(v0 + add.dv0), v1: g1(v0 + add.dv1) };
  const aabbUV = shape(u0, v0, rad), [ax0, az0, ax1, az1] = F.rect(...aabbUV);
  return (p._H = { F, u0, u1: u0 + L, v0, v1, L, W, hitch, rad, deck, addon, carU, rect: F.rect(u0, v0, u0 + L, v1), aabb: [ax0, az0, ax1, az1], aabbUV,
    centre: F.at(u0 + L / 2, v0 + W / 2), doorA: a, doorU: u0 + dA });
}

// build the home into a volume, register its mass, return what the yard and the sim-state layer need
export function buildHome(ctx, p, o = {}) {
  const s = p.spec, H = homeRect(p), F = H.F, front = F.side(0), back = F.side(2), rightS = F.side(1), leftS = F.side(3), [x0, z0, x1, z1] = H.rect, t = s.type;
  const padF = 24, padB = 10, padS = 12, gable = t === 'double' ? 16 : 0, roofH = FLOOR + WALL + (t === 'bus' || t === 'bullet' ? 1 : 0);
  const pz0 = front === '-z' ? padF : padB, pz1 = front === '+z' ? padF : padB, nxM = Math.round((x1 - x0) / CV), nzM = Math.round((z1 - z0) / CV);
  const V = new Vol(nxM + 2 * padS, roofH + gable + 18, nzM + pz0 + pz1, { s: CV, org: [x0 - padS * CV, SIDE, z0 - pz0 * CV] });
  const B = { x0: padS, z0: pz0, x1: padS + nxM, z1: pz0 + nzM }, fr = frame(V, B, front), bk = frame(V, B, back), lf = frame(V, B, leftS), rt = frame(V, B, rightS);
  const L = fr.len, D = lf.len, top = FLOOR + WALL, wall = s.wall, trim = s.trim, h = k => hash(s.seed, k, 71), wins = [], door = H.doorA;
  // ── the body
  const body = (y0, y1, c = wall) => V.box(B.x0, y0, B.z0, B.x1, y1, B.z1, c);
  if (t === 'box') { body(FLOOR, top, (x, y, z) => (((x + z) >> 1) & 1) ? shade(wall, .86) : wall); V.box(B.x0, FLOOR, B.z0, B.x1, FLOOR + 1, B.z1, shade(wall, .7)); V.box(B.x0, top - 1, B.z0, B.x1, top, B.z1, shade(wall, .7)); }
  else if (t === 'bullet') { body(FLOOR, top, ALU); }
  else if (t === 'shack') { body(FLOOR, top - 2, (x, y, z) => { const pnl = ((x / 12 | 0) + (z / 12 | 0) + (y / 13 | 0)) % 3; return pnl === 0 ? wall : pnl === 1 ? shade(wall, .9) : mix(wall, 0xc49a6c, .45); }); }
  else body(FLOOR, top);
  // the stripe (flush paint): a band along every side at a type-specific height; campers and RVs get three
  const band = (y0, y1, c) => { for (const f of [fr, bk, lf, rt]) f.box(0, y0, 0, f.len, y1, 1, c); };
  if (t === 'single' || t === 'nose' || t === 'double') band(17, 19, s.stripe);
  if (t === 'camper') { band(14, 16, WHITE); band(16, 17, s.stripe); }
  if (t === 'rv') { band(12, 13, s.stripe); band(14, 15, s.awn); band(16, 17, s.stripe); }
  if (t === 'bus') { band(10, 11, INK); band(17, 18, INK); }
  if (t === 'bullet') for (const f of [fr, bk, lf, rt]) for (let y = FLOOR + 4; y < top; y += 7) f.box(0, y, 0, f.len, y + 1, 1, shade(ALU, .88), 2);
  // ── under the floor: the skirt (lattice, tin, a painted board) or the cinder-block piers with the dark frame showing
  const piers = () => { V.box(B.x0 + 1, 2, B.z0 + 1, B.x1 - 1, 3, B.z1 - 1, UNDER); for (let x = B.x0 + 2; x < B.x1 - 4; x += 16) for (const z of [B.z0 + 2, B.z1 - 6]) V.box(x, 0, z, x + 4, 2, z + 4, CONC); for (const z of [B.z0 + 2, B.z1 - 6]) V.box(B.x1 - 6, 0, z, B.x1 - 2, 2, z + 4, CONC); };
  if (t === 'box' || t === 'shack' || s.skirt === 'blocks') piers();
  else if (t === 'bus' || t === 'rv') { V.box(B.x0 + 2, 1, B.z0 + 2, B.x1 - 2, 3, B.z1 - 2, UNDER); }
  else { const sc = s.skirt === 'tin' ? GALV : s.skirt === 'paint' ? s.stripe : (h(1) < .5 ? WHITE : 0xe6e1d6);
    for (const f of [fr, bk, lf, rt]) f.box(0, 0, 0, f.len, FLOOR, 1, (a, y) => s.skirt === 'lattice' ? (((a + y) % 3 === 0 || (a - y + 30) % 3 === 0) ? sc : shade(sc, .55)) : s.skirt === 'tin' ? (a % 2 ? sc : shade(sc, .88)) : sc);
    V.box(B.x0 + 1, 0, B.z0 + 1, B.x1 - 1, FLOOR, B.z1 - 1, UNDER); }
  // ── the roof: neutral, one step in at the eave; per type a crown, a barrel, a gable or a lean-to
  const R = s.roof;
  if (t === 'double') { const ov = 3; for (let k = 0; B.z0 - ov + k < B.z1 + ov - k; k++) { const y = top + Math.floor(k / 2);
      V.box(B.x0 - 2, y, B.z0 - ov + k, B.x1 + 2, y + 1, B.z1 + ov - k, (x, yy, z) => (z === B.z0 - ov + k || z === B.z1 + ov - k - 1) ? shade(R, .86) : R);
      const za = Math.max(B.z0, B.z0 - ov + k + 1), zb = Math.min(B.z1, B.z1 + ov - k - 1); if (za < zb) for (const x of [B.x0, B.x1 - 1]) V.box(x, y, za, x + 1, y + 1, zb, wall); } }
  else if (t === 'shack') { const lo = top - 2; for (let z = B.z0 - 2; z < B.z1 + 2; z++) { const y = lo + Math.round((front === '+z' ? (B.z1 + 2 - z) : (z - B.z0 + 2)) / 8); V.box(B.x0 - 2, y, z, B.x1 + 2, y + 1, z + 1, (x) => (x % 3 === 0) ? shade(R, .82) : R); for (const x of [B.x0, B.x1 - 1]) V.box(x, lo, z, x + 1, y, z + 1, (z >= B.z0 && z < B.z1) ? shade(wall, .9) : undefined); }
    for (let x = B.x0; x < B.x1; x++) for (let z = B.z0; z < B.z1; z++) { let y = lo; while (y < V.ny && !V.has(x, y, z)) V.set(x, y++, z, shade(wall, .9)); } }
  else if (t === 'bullet') { const cz = (B.z0 + B.z1) / 2, hw = (B.z1 - B.z0) / 2; for (let z = B.z0; z < B.z1; z++) { const e = Math.abs(z + .5 - cz) / hw, dy = Math.round(4 * (1 - Math.sqrt(Math.max(0, 1 - e * e))));
      V.clear(B.x0, top - dy, z, B.x1, top, z + 1); V.box(B.x0 + 2, top - dy, z, B.x1 - 2, top - dy + 1, z + 1, ALU, 2); }
    for (const f of [lf, rt]) for (let a = 0; a < f.len; a++) { const e = Math.abs(a + .5 - f.len / 2) / (f.len / 2); for (let y = top - 6; y < top; y++) if (e > .55 && (y - (top - 6)) > (1 - e) * 14) f.set(a, y, 0, AIR); } }
  else { V.box(B.x0, top, B.z0, B.x1, top + 1, B.z1, R); V.box(B.x0 + 1, top + 1, B.z0 + 1, B.x1 - 1, top + 2, B.z1 - 1, shade(R, .96)); }
  // campers: round the upper ends; the RV's cab (the lower end under a bunk) at its −u or +u end, the bus's hood
  const endCut = (f0, r) => { for (let y = top - r; y < top + 2; y++) for (let k = 0; k < r; k++) { const e = Math.hypot(r - k - .5, y - (top - r) + .5); if (e > r) { for (let d = 0; d < D; d++) { const [vx, vz] = f0 === 'L' ? lf.xz(d, -k) : rt.xz(d, -k); V.del(vx, y, vz); } } } };
  if (t === 'camper') { endCut('L', 9); endCut('R', 9); }
  if (t === 'rv' || t === 'bus') { const end = s.side ? rt : lf, hood = t === 'bus' ? 12 : 4, low = t === 'bus' ? 15 : 19;
    for (let k = 0; k < hood; k++) for (let d = 0; d < D; d++) { const [vx, vz] = end.xz(d, -k); for (let y = low; y < top + 3; y++) V.del(vx, y, vz); }
    if (t === 'bus') { end.box(2, low + 2, -hood, end.len - 2, top - 3, -hood + 1, 0x9fd8ff, 1); end.box(4, FLOOR + 3, 0, end.len - 4, FLOOR + 9, 1, (a, y) => y % 2 ? 0x9a9aa6 : INK, 2); }
    else { end.box(2, FLOOR + 8, 0, end.len - 2, low - 1, 1, 0x9fd8ff, 1); end.box(6, low + 3, -hood, end.len - 6, top - 3, -hood + 1, 0x9fd8ff, 1); end.box(4, FLOOR + 2, 0, end.len - 4, FLOOR + 6, 1, 0xdfe3ea, 2); }
    for (const a of [2, end.len - 6]) end.box(a, FLOOR + 5, 0, a + 4, FLOOR + 7, 1, 0xfff6d0, 1); }
  // wheels (campers, bullets, buses, RVs): black boxes in the skirt line
  if (['camper', 'bullet', 'bus', 'rv'].includes(t)) { const at = t === 'camper' ? [L >> 1] : [9, L - 16]; for (const a of at) for (const f of [fr, bk]) { const a2 = f === fr ? a : L - 7 - a; f.box(a2, 0, -3, a2 + 7, 7, 1, TYRE); f.box(a2 + 2, 2, 0, a2 + 5, 5, 1, 0xc9ced6, 2); } }
  // the hitch: an A-frame, a jack, two propane bottles (single-wides, campers, bullets: at the end away from the door)
  if (H.hitch || t === 'nose') { const hf = t === 'nose' ? bk : H.hitch > 0 ? rt : lf, mid = hf.len >> 1;
    for (let k = 1; k < 8; k++) { const w = Math.max(1, Math.round((8 - k) * .8)); hf.box(mid - w, 2, k, mid - w + 1, 3, k + 1, INK); hf.box(mid + w - 1, 2, k, mid + w, 3, k + 1, INK); }
    hf.box(mid - 1, 2, 7, mid + 1, 3, 9, INK); hf.box(mid - 1, 1, 8, mid + 1, 2, 10, CONC);
    if (t !== 'nose') for (const dd of [-4, 2]) { hf.box(mid + dd, 3, 2, mid + dd + 2, 9, 4, WHITE); hf.box(mid + dd, 9, 2, mid + dd + 2, 10, 4, 0x9a9aa6); } }
  // ── the front: the door (trim, a recess, the slab, its window, a knob, a porch light), then the windows around it
  const dc = DOORC[(h(2) * DOORC.length) | 0] === wall ? INK : DOORC[(h(2) * DOORC.length) | 0];
  fr.box(door - 1, FLOOR, 0, door + 13, FLOOR + 25, 1, t === 'bullet' ? 0x9a9ca4 : trim); fr.box(door, FLOOR, -1, door + 12, FLOOR + 24, 1, AIR);
  fr.box(door, FLOOR, -2, door + 12, FLOOR + 24, -1, (a, y) => (y > FLOOR + 15 && y < FLOOR + 21 && a > door + 2 && a < door + 9) ? 0x9fd8ff : dc, 1); fr.set(door + 9, FLOOR + 11, -1, PAL.gold, 2);
  fr.box(door + 14, FLOOR + 18, 1, door + 17, FLOOR + 22, 2, TOD.night ? 0xffd98a : 0xeae6da, TOD.night ? 3 : 1); fr.box(door + 15, FLOOR + 22, 1, door + 16, FLOOR + 23, 2, 0x3a3d45);
  const W = (f, a0, y0, w, hh, o2 = {}) => { if (a0 < 2 || a0 + w > f.len - 2) return; win(f, a0, y0, w, hh, t === 'bullet' ? 0x9a9ca4 : trim, { lit: TOD.night && hash(s.seed, a0 * 7 + y0, f.side.charCodeAt(1)) < .6, ...o2 }); const [cx, cz] = faceXZ(V, B, f.side, a0 + w / 2), [nx, nz] = NRM[ROT[f.side]];
    wins.push([+(cx + nx * .07).toFixed(2), +(SIDE + (y0 + hh / 2) * CV).toFixed(2), +(cz + nz * .07).toFixed(2), +(w * CV).toFixed(2), +(hh * CV).toFixed(2), ROT[f.side]]); };
  const clearOf = (a, w) => a + w < door - 2 || a > door + 14;
  // front windows first (the sim puts its zzz / curtain card in the first one)
  const fw = t === 'nose' ? [[door < L / 2 ? door + 16 : door - 16, 12]] : t === 'camper' ? [[door < L / 2 ? L - 18 : 5, 13]] : t === 'bus' || t === 'rv' ? [] : t === 'box' ? [[door < L / 2 ? L - 24 : 6, 18]] : t === 'shack' ? [[door < L / 2 ? L - 15 : 4, 11]]
    : t === 'double' ? [[6, 12], [L - 18, 12]] : [[door < L / 2 ? door + 20 : 6, 14], [door < L / 2 ? L - 20 : door - 22, 14]];
  const covered = (a, w) => H.addon?.kind === 'room' && H.u0 + (a + w) * CV > H.addon.u0 && H.u0 + a * CV < H.addon.u1;   // (an add-on room stands in front of it)
  for (const [a, w] of fw) if (clearOf(a, w) && !covered(a, w)) { W(fr, a, FLOOR + 10, w, t === 'box' ? 13 : 11, { ac: t === 'single' && h(4) < .35 && a === fw[0][0] }); if (t === 'double') { fr.box(a - 4, FLOOR + 10, 0, a - 1, FLOOR + 21, 2, s.stripe); fr.box(a + w + 1, FLOOR + 10, 0, a + w + 4, FLOOR + 21, 2, s.stripe); } }
  if (t === 'bus' || t === 'rv') for (let a = (s.side ? 4 : 26); a + 8 < L - (s.side ? 26 : 4); a += 11) if (clearOf(a, 8) && !covered(a, 8)) W(fr, a, FLOOR + 11, 8, 8);
  // the other sides: a window or two each, so a sleeping owner's whole home goes dark
  for (const f of [bk, lf, rt]) { const n = f.len > 50 ? 2 : 1, w = f.len > 40 ? 12 : 8; if (f !== bk && ['bus', 'camper', 'bullet', 'rv'].includes(t)) continue; for (let k = 0; k < n; k++) { const a = n === 1 ? (f.len - w) >> 1 : k ? f.len - w - 8 : 8; W(f, a, FLOOR + 11, w, 9); } }
  if (t === 'bus') for (let a = 5; a + 8 < L - 5; a += 11) W(bk, a, FLOOR + 11, 8, 8);
  // shack: plastic sheeting over one window, a stovepipe; box: the end doors with their bars
  if (t === 'box') { const e = s.side ? lf : rt; for (const a of [2, (e.len >> 1) + 1]) { e.box(a, FLOOR + 1, 1, a + ((e.len >> 1) - 3), top - 1, 2, shade(wall, .8)); for (const b of [a + 3, a + (e.len >> 1) - 7]) e.box(b, FLOOR + 1, 2, b + 1, top - 1, 3, 0x9a9aa6, 2); } }
  // ── the awning over the door: striped canvas, an aluminium patio cover, a blue tarp on two sticks
  const aw = o.awning ?? (t === 'camper' || t === 'bullet' || t === 'rv' ? (s.awning === 'none' ? 'stripe' : s.awning) : t === 'double' ? 'porch' : t === 'shack' ? 'tarp' : s.awning);
  const aL = Math.max(0, door - (t === 'camper' || t === 'rv' ? 14 : 8)), aR = Math.min(L, door + (t === 'camper' || t === 'rv' ? 30 : 22)), depth = Math.min(padF, Math.max(19, (o.deckD || 0) + 3)), ay = top - 1;
  const pole = (a, d, yTop, c = GALV) => fr.box(a, 1, d, a + 1, yTop, d + 1, c, 2);
  let awnRect = null;
  const bulbs = (y, d) => { if (h(6) > .55) return; fr.box(aL, y, d, aR, y + 1, d + 1, 0x3a3d45); for (let a = aL + 1; a < aR - 1; a += 3) fr.box(a, y - 1, d, a + 1, y, d + 1, TOD.night ? [0xffd98a, 0xff9ad0, 0x9fe8ff, 0xfff0b0][(a / 3 | 0) % 4] : 0xf2efe6, TOD.night ? 3 : 1); };
  if (aw === 'stripe') { for (let d = 1; d < depth; d++) { const y = ay - Math.floor(d / 7); fr.box(aL, y, d, aR, y + 1, d + 1, (a) => ((a >> 2) & 1) ? s.awn : WHITE); } fr.box(aL, ay - 3, depth - 1, aR, ay - 2, depth, (a) => (a & 1) ? s.awn : undefined);
    pole(aL, depth - 1, ay - 2); pole(aR - 1, depth - 1, ay - 2); awnRect = [aL, aR, depth]; bulbs(ay - Math.floor((depth - 1) / 7) - 1, depth - 2); }
  else if (aw === 'metal') { fr.box(aL, ay, 1, aR, ay + 1, depth, WHITE); fr.box(aL, ay - 1, depth - 1, aR, ay + 1, depth, 0xdfe2e8); pole(aL, depth - 1, ay - 1, WHITE); pole(aR - 1, depth - 1, ay - 1, WHITE); awnRect = [aL, aR, depth]; bulbs(ay - 2, depth - 2); }
  else if (aw === 'tarp') { for (let d = 1; d < depth - 2; d++) { const y = ay - 1 - Math.floor(d / 4); fr.box(aL, y, d, aR, y + 1, d + 1, (a, yy, dd) => (hash(a, dd, 5) > .93) ? shade(TARP, .8) : TARP); } pole(aL, depth - 3, ay - 5, 0x8a5a2a); pole(aR - 1, depth - 3, ay - 5, 0x8a5a2a); awnRect = [aL, aR, depth - 2]; }
  else if (aw === 'porch') { const pa = door - 5, pb = door + 17; for (let d = 1; d < 11; d++) { const y = ay - 1 + Math.floor((10 - d) / 5); fr.box(pa - 1, y, d, pb + 1, y + 1, d + 1, d === 10 ? WHITE : shade(R, .9)); }
    for (const a of [pa, pb - 1]) for (let k = 0; k < 6; k++) fr.box(a, ay - 7 + k, 1, a + 1, ay - 6 + k, 2 + k, WHITE); awnRect = [pa, pb, 11]; }
  // ── the roof junk (voxels on the roof: a vent, a swamp cooler, tyres on a patched tarp, an antenna, a dish)
  const RT = t === 'double' ? top + 4 : t === 'bullet' ? top : t === 'shack' ? top - 1 : top + 2, cxv = (B.x0 + B.x1) >> 1, czv = (B.z0 + B.z1) >> 1, j = s.roofJunk;
  if (t !== 'double' && t !== 'shack' && t !== 'bullet') {
    if (j === 1 || j === 5) { V.box(cxv - 8, RT, czv - 1, cxv - 6, RT + 4, czv + 1, 0x9a9aa6, 2); }
    if (j === 2) { V.box(cxv + 2, RT, czv - 4, cxv + 10, RT + 6, czv + 4, 0xb9bcc4); for (let y = RT + 1; y < RT + 6; y += 2) V.box(cxv + 2, y, czv - 5, cxv + 10, y + 1, czv - 4, 0x8f9096); }
    if (j === 3) { V.box(cxv - 12, RT, czv - 8, cxv + 6, RT + 1, czv + 6, 0x7a7d86); for (const [dx, dz] of [[-8, -4], [0, 2], [-4, 3]]) { cyl(V, cxv + dx, czv + dz, 3.2, RT + 1, RT + 3, (x, y, z) => Math.hypot(x + .5 - cxv - dx, z + .5 - czv - dz) < 1.5 ? undefined : TYRE); } }
    if (j === 4) { V.box(cxv, RT, czv, cxv + 1, RT + 16, czv + 1, 0x9a9aa6, 2); for (const [y, w] of [[RT + 15, 6], [RT + 12, 4], [RT + 9, 3]]) V.box(cxv - w, y, czv, cxv + w + 1, y + 1, czv + 1, 0x9a9aa6, 2); }
    if (j === 5) { V.box(cxv + 4, RT, czv + 1, cxv + 5, RT + 4, czv + 2, 0x9a9aa6, 2); for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) if (a * a + b * b <= 10) V.set(cxv + 4 + a, RT + 7 + b, czv + 3, WHITE); V.box(cxv + 4, RT + 4, czv + 2, cxv + 5, RT + 6, czv + 3, 0x9a9aa6, 2); } }
  if (t === 'shack' || t === 'bus') { const sx = t === 'bus' ? (s.side ? B.x0 + 8 : B.x1 - 10) : B.x0 + 4, sz = czv; let yb = V.ny - 1; while (yb > 0 && !V.has(sx, yb - 1, sz)) yb--; V.box(sx, yb, sz, sx + 2, yb + 9, sz + 2, INK); V.box(sx - 1, yb + 9, sz - 1, sx + 3, yb + 10, sz + 3, INK); }
  if (t === 'box' && j % 2) { V.box(B.x0 + 4, RT - 2, B.z0 + 3, B.x0 + 20, RT - 1, B.z1 - 3, 0x2a3564, 2); for (let x = B.x0 + 4; x < B.x0 + 20; x += 4) V.box(x, RT - 2, B.z0 + 3, x + 1, RT - 1, B.z1 - 3, GALV, 2); }
  if (o.roofText && t !== 'double' && t !== 'shack' && t !== 'bullet') { const tmk = textMask(o.roofText), sc = 1, w = tmk.w * sc, x0 = ((B.x0 + B.x1) >> 1) - (w >> 1), z0 = ((B.z0 + B.z1) >> 1) - 3;
    for (let j = 0; j < 7; j++) for (let i = 0; i < tmk.w; i++) if (tmk.at(i, j)) V.set(x0 + i, top + 1, z0 + j, 0xe8232a); }
  // a dinghy stored upside down on the roof, a tyre on its keel to keep the wind off it
  if (o.roofBoat) { const cx = (B.x0 + B.x1) >> 1, cz = (B.z0 + B.z1) >> 1, y0 = top + 2; for (let k = -20; k < 20; k++) { const e = Math.abs(k) / 20, hw = Math.round(7 * (1 - Math.pow(Math.max(0, (k - 8) / 12), 2) * .9)), hh = k > 14 ? 3 : 5;
      V.box(cx + k, y0, cz - hw, cx + k + 1, y0 + hh, cz + hw, (x, y, z) => y === y0 + hh - 1 && Math.abs(z - cz) < 1 ? 0xf7f7f2 : y < y0 + 2 ? 0xf7f7f2 : 0xe8232a); }
    cyl(V, cx - 4, cz, 3.2, y0 + 5, y0 + 7, (x, y, z) => Math.hypot(x + .5 - cx + 4, z + .5 - cz) < 1.5 ? undefined : 0x1b1b20); }
  // ── the add-on (pass 3): a room built onto the front away from the door, or a lean-to over junk at the far end; plywood, tin or leftover paint
  const vx = x => Math.round((x - V.org[0]) / CV), vz = z => Math.round((z - V.org[2]) / CV);
  let addonTop = 0;
  if (H.addon) { const A = H.addon, [wx0, wz0, wx1, wz1] = F.rect(A.u0, A.v0, A.u1, A.v1), bx0 = vx(wx0), bz0 = vz(wz0), bx1 = vx(wx1), bz1 = vz(wz1);
    const MAT = [[0xc49a6c, 0x9a6a3a], [0xb9bcc4, 0x9a9ca4], [s.awn, shade(s.awn, .8)]][A.mat], tex = (x, y, z) => A.mat === 1 ? (((x + z) & 1) ? MAT[0] : MAT[1]) : A.mat === 0 ? ((((x + z) % 12) === 0 || y === 15) ? MAT[1] : MAT[0]) : ((y === 15) ? MAT[1] : MAT[0]);
    if (A.kind === 'room') {   // out from the home's front: the roof slopes from 2.6 m at the wall to 2.2 m at the front
      const depth = Math.max(1, (front === '+z' ? bz1 - bz0 : bz1 - bz0)), out = z => front === '+z' ? z - B.z1 : B.z0 - 1 - z, roofY = z => 25 - Math.floor(Math.max(0, out(z)) * 4 / depth);
      for (let x = bx0; x < bx1; x++) for (let z = bz0; z < bz1; z++) { const ry = roofY(z); V.box(x, FLOOR, z, x + 1, ry, z + 1, tex); }
      for (let x = bx0 - 1; x < bx1 + 1; x++) for (let z = Math.min(bz0, bz1) - 1; z < Math.max(bz0, bz1) + 1; z++) { if (out(z) < 0) continue; V.set(x, roofY(z), z, ((x + z) & 1) ? 0x8f9096 : 0x9a9ca4, 2); }
      V.box(bx0 + 1, 2, bz0 + 1, bx1 - 1, FLOOR, bz1 - 1, UNDER); for (const [x, z] of [[bx0, bz0], [bx1 - 3, bz0], [bx0, bz1 - 3], [bx1 - 3, bz1 - 3]]) V.box(x, 0, z, x + 3, FLOOR, z + 3, CONC);
      const Br = { x0: bx0, z0: bz0, x1: bx1, z1: bz1 }, rf = frame(V, Br, front), w = Math.min(10, rf.len - 6); if (w >= 6) W(rf, (rf.len - w) >> 1, FLOOR + 9, w, 8);
      addonTop = SIDE + 27 * CV; }
    else {   // the lean-to: two posts, a tin roof falling away from the home's end wall, tyres and a crate under it
      const hi = t === 'camper' ? 19 : 25, lo = hi - 5, wide = Math.abs(bx1 - bx0), outX = x => (H.addon.du0 >= L - 1e-6) === (F.f > 0) ? x - Math.min(bx0, bx1) : Math.max(bx0, bx1) - 1 - x;
      const xs0 = Math.min(bx0, bx1), xs1 = Math.max(bx0, bx1), zs0 = Math.min(bz0, bz1), zs1 = Math.max(bz0, bz1);
      for (let x = xs0; x < xs1 + 1; x++) for (let z = zs0 - 1; z < zs1 + 1; z++) { const o2 = outX(x); if (o2 < 0 || o2 > wide) continue; V.set(x, hi - Math.floor(o2 * 5 / wide), z, ((z) & 1) ? 0xb9bcc4 : 0x9a9ca4, 2); }
      for (const z of [zs0, zs1 - 1]) { const x = outX(xs0) > outX(xs1 - 1) ? xs0 : xs1 - 1; V.box(x, 0, z, x + 1, lo, z + 1, 0x8a5a2a); }
      const tx = (xs0 + xs1) >> 1, tz = zs0 + 5; for (let k = 0; k < 3; k++) cyl(V, tx, tz, 3.2, k * 3, k * 3 + 3, (x, y, z) => Math.hypot(x + .5 - tx, z + .5 - tz) < 1.5 ? undefined : TYRE);
      V.box(tx - 3, 0, zs1 - 9, tx + 3, 6, zs1 - 3, (x, y, z) => ((x + y + z) % 2 && y > 0 && y < 5) ? undefined : [0x2f5bff, 0xe8232a, 0x25b84c][A.mat]);
      addonTop = SIDE + (hi + 1) * CV; } }
  // ── mass + anchor points (a turned home is a template: the pad builder meshes it, turns it and registers its footprint)
  const topY = SIDE + (t === 'double' ? top + 13 : top + 2) * CV, roofY = SIDE + (t === 'double' ? top : t === 'bullet' ? top - 1 : t === 'shack' ? top - 1 : top + 2) * CV;
  if (!o.template) { ctx.mass(V, [x0, z0, x1, z1], { top: topY, roofY });
    if (H.addon) { const A = H.addon, [ax0, az0, ax1, az1] = F.rect(A.u0, A.v0, A.u1, A.v1); REG.footprint(ax0, az0, ax1, az1, addonTop, addonTop); REG.keep([ax0 - .35, SIDE, az0 - .35, ax1 + .35, SIDE + 3.2, az1 + .35], 'plinth'); } }
  const [dx, dz] = faceXZ(V, B, front, door + 6), [fx, fz] = NRM[ROT[front]];
  return { V, B, fr, lf, rt, bk, H, roofY, door: [+(dx + fx * .55).toFixed(2), SIDE, +(dz + fz * .55).toFixed(2)], doorXZ: [dx, dz], face: [fx, fz], rot: ROT[front], wins, awnRect, top: topY,
    wallPlane: front === '+z' ? V.org[2] + B.z1 * CV : V.org[2] + B.z0 * CV, frontSide: front };
}

// the porch, drawn into any volume over its world rect (its own walk volume for a square home; the home's template for a turned one):
// boards on joists, one step at the door, a rail round a park model's porch (its keeps registered only when `keeps`)
export function drawDeck(V, p, dk, keeps = false) {
  const F = frameOf(p), s = p.spec, [x0, z0, x1, z1] = F.rect(dk.u0, dk.v0, dk.u1, dk.v1), ox = Math.round((x0 - V.org[0]) / CV), oz = Math.round((z0 - V.org[2]) / CV), nx = Math.round((x1 - x0) / CV), nz = Math.round((z1 - z0) / CV);
  const along = F.f > 0 ? (a, b) => [ox + a, oz + b] : (a, b) => [ox + nx - 1 - a, oz + nz - 1 - b], A = nx, Bd = nz, rail = dk.kind === 'rail';   // a along u, b out toward the lane
  const put = (a, y, b, c) => { const [x, z] = along(a, b); V.set(x, y, z, c); };
  const step = 3, sc = Math.round((H0(p).doorU - dk.u0) / CV), sA0 = Math.max(0, sc - 6), sA1 = Math.min(A, sA0 + 12);
  const topC = dk.kind === 'turf' ? 0x3fbf4f : dk.kind === 'metal' ? GALV : s.neutral && hash(s.seed, 43) < .5 ? 0x8f9096 : PAL.wood, rim = dk.kind === 'metal' ? 0x6d707a : PAL.woodD;
  for (let a = 0; a < A; a++) for (let b = 0; b < Bd; b++) { const fr0 = b >= Bd - step, inStep = a >= sA0 && a < sA1; if (fr0 && !inStep) continue; const hh = fr0 ? 2 : 3;
    for (let y = 0; y < hh; y++) put(a, y, b, y < hh - 1 ? ((a === 0 || a === A - 1 || b === Bd - 1 - (fr0 ? 0 : step)) ? rim : shade(rim, 1.15))
      : dk.kind === 'metal' ? ((a + b) & 1 ? GALV : 0x8f9096) : dk.kind === 'turf' && !fr0 ? 0x3fbf4f : ((a >> 1) & 1 ? topC : shade(topC, .88))); }
  if (rail) { const rc = s.neutral || hash(s.seed, 44) < .5 ? PAL.white : PAL.wood, bF = Bd - step - 1;
    for (let a = 0; a < A; a++) { if (a >= sA0 - 1 && a < sA1 + 1) continue; for (let y = 3; y < 12; y++) if (y === 11 || a % 3 === 0) put(a, y, bF, rc); }
    for (const a of [0, A - 1]) for (let b = 3; b <= bF; b++) for (let y = 3; y < 12; y++) if (y === 11 || b % 3 === 0) put(a, y, b, rc);
    if (keeps) { const R = (a0, b0, a1, b1) => { if (a1 < a0) return; const [xa, za] = along(a0, b0), [xb, zb] = along(a1, b1), o = V.org; REG.keep([o[0] + Math.min(xa, xb) * CV - .02, SIDE, o[2] + Math.min(za, zb) * CV - .02, o[0] + (Math.max(xa, xb) + 1) * CV + .02, SIDE + 1.3, o[2] + (Math.max(za, zb) + 1) * CV + .02], 'rail'); };
      R(0, bF, sA0 - 2, bF); R(sA1 + 1, bF, A - 1, bF); R(0, 3, 0, bF); R(A - 1, 3, A - 1, bF); } }
}
const H0 = p => homeRect(p);
