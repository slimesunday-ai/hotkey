// MAINLAND · DIRECTION A · "Sunny Springfield cul-de-sac" · the houses (copied ideas from districts/suburbs/house.js, rebuilt here:
// nothing in the city is edited). Every house is drawn in its LOT's local frame, in metres: x across the frontage (−W/2 … W/2, +x is
// the right as seen from the street), z from the front lot line (0) back into the lot (negative), y up from the lawn (0.2 in world).
// The street is at +z. A lot is meshed to its own Bank and stamped into the world at the lot's angle (stampA), so pie lots round the
// bulb face the turnaround. Upgrades over Pleasantview: sherbet walls (the palette lifted toward cream, still toon-saturated), bright
// trim, porches, dormers, a hoop over every other garage, and one showpiece (a trophy on the roof).
import { Vol, Bank, meshVol, stamp, stampA } from '../../vox.js';
import { frame, win, AIR, TOD } from '../../kit.js';
import { PAL, CV, hash, shade } from '../../style.js';
import { mailbox, flamingos, gnomes, sprinkler, toys, bin, planter, trampoline, lemonade, tree, swingset, birdbath } from '../../districts/suburbs/props.js';
import { bike } from '../../props.js';
import { vehicleProp } from '../../vehicles/index.js';

export const LAWN = 0.2;                                          // lawn / sidewalk top in world metres
const TRIM = 0xfffaf0, INK = PAL.ink, FOUND = 0xb9b3a8, CONC = 0xdcd6c9, BRICK = 0xb4553c, GOLD = 0xe7bd4a, WOOD = 0xb07a45;
export const ROOF = { choc: 0x6e5244, slate: 0x62656f, char: 0x4f4e57, warm: 0x8c7568, grey: 0x8f8e96 };
export const SHERBET = { coral: 0xff8a5c, butter: 0xffd23f, sky: 0x58b7f7, mint: 0x3fd0a0, lilac: 0xa57cff, pink: 0xff6fae, white: 0xf4f1ea, cobalt: 0x2f5bff };
const litWin = (k) => TOD.night && hash(k, 77) > .22;             // homes are mostly lit at night (warm, lived in)

// ── a lot-local volume in metres
class LV {
  constructor(x0, z0, x1, z1, h) { this.ox = x0; this.oz = z0; this.V = new Vol(Math.round((x1 - x0) * 10), Math.round(h * 10), Math.round((z1 - z0) * 10), { s: CV, org: [x0, 0, z0], ground: true }); }
  X(m) { return Math.round((m - this.ox) * 10); } Z(m) { return Math.round((m - this.oz) * 10); }
  box(x0, y0, z0, x1, y1, z1, c, l = 0) { this.V.box(this.X(x0), Math.round(y0 * 10), this.Z(z0), this.X(x1), Math.round(y1 * 10), this.Z(z1), c, l); }
  set(x, y, z, c, l = 0) { this.V.set(this.X(x), Math.round(y * 10), this.Z(z), c, l); }
  face([x0, z0, x1, z1], side) { return frame(this.V, { x0: this.X(x0), x1: this.X(x1), z0: this.Z(z0), z1: this.Z(z1) }, side); }
}
// ── walls: one flat colour with lap-siding lines, a foundation band, white corner boards
function body(L, [x0, z0, x1, z1], h, wall, o = {}) {
  const fy = o.found ?? 4, lap = o.lap ?? true, line = shade(wall, .92);
  L.box(x0, 0, z0, x1, h, z1, (x, y) => y < fy ? FOUND : (lap && y % 3 === 0) ? line : wall);
  if (o.corners !== false) for (const [a, b] of [[x0, z1 - .2], [x1 - .2, z1 - .2], [x0, z0], [x1 - .2, z0]]) L.box(a, fy / 10, b, a + .2, h, b + .2, o.trim ?? TRIM);
}
// ── roofs (voxel steps; ported from house.js roofAlong / roofHip). axis 'x': ridge along x (slopes face the street); 'z': gable to the street
function gable(L, [x0, z0, x1, z1], y0m, axis, col, o = {}) {
  const V = L.V, ov = o.ov ?? 3, ovg = o.ovg ?? 2, fill = o.fill, steps = o.steps ?? (() => [o.rise ?? 1, o.run ?? 2]);
  const [A0, A1, B0, B1] = axis === 'x' ? [L.Z(z0), L.Z(z1), L.X(x0), L.X(x1)] : [L.X(x0), L.X(x1), L.Z(z0), L.Z(z1)];
  const put = (p, q, r0, r1, y, h, c) => { if (q <= p) return; if (axis === 'x') V.box(r0, y, p, r1, y + h, q, c); else V.box(p, y, r0, q, y + h, r1, c); };
  let y = Math.round(y0m * 10), aa = A0 - ov, ab = A1 + ov, k = 0;
  while (ab - aa > 0 && k < 200) { const [rise, run] = steps(k), t = Math.max(2, run + 1), c = k === 0 ? (o.fascia ?? TRIM) : (k % 2 ? shade(col, .9) : col), top = ab - aa <= 2 * t;
    put(aa, Math.min(ab, aa + t), B0 - ovg, B1 + ovg, y, rise, c); put(Math.max(aa, ab - t), ab, B0 - ovg, B1 + ovg, y, rise, c);
    if (!top) put(Math.max(aa + t, A0), Math.min(ab - t, A1), B0, B1, y, rise, fill);
    y += rise; aa += run; ab -= run; k++; }
  return y / 10;
}
function hip(L, [x0, z0, x1, z1], y0m, col, o = {}) {
  const V = L.V, ov = o.ov ?? 3, rise = o.rise ?? 1, run = o.run ?? 2; let y = Math.round(y0m * 10), k = 0;
  for (let ua = L.X(x0) - ov, ub = L.X(x1) + ov, va = L.Z(z0) - ov, vb = L.Z(z1) + ov; ub > ua && vb > va; ua += run, ub -= run, va += run, vb -= run, k++, y += rise)
    V.box(ua, y, va, ub, y + rise, vb, k === 0 ? (o.fascia ?? TRIM) : (k % 2 ? shade(col, .9) : col));
  return y / 10;
}
// ── openings (kit.js frames: a along the wall in voxels, y up, d out of the wall)
const W1 = (f, a, y, w = 12, h = 16, trim = TRIM, o = {}) => win(f, a, y, w, h, trim, { lit: litWin(a * 7 + y + f.len), ...o });
function shutters(f, a, y, w, h, c) { for (const s of [a - 6, a + w + 2]) f.box(s, y - 1, 0, s + 4, y + h + 1, 2, (aa, yy) => (yy - y) % 4 === 1 ? shade(c, .85) : c); }
function door(f, a, col, o = {}) {
  const y = o.y ?? 4, w = o.w ?? 12, h = 24;
  f.box(a - 2, y, 0, a + w + 2, y + h + 2, 2, o.trim ?? TRIM); f.box(a, y, -2, a + w, y + h, 2, AIR);
  f.box(a, y, -3, a + w, y + h, -2, (aa, yy) => (yy - y) % 8 === 7 || aa === a + 1 || aa === a + w - 2 ? shade(col, .82) : col);
  f.set(a + w - 3, y + 11, -2, GOLD, 2);
  if (o.glassTop) f.box(a + 2, y + h - 6, -3, a + w - 2, y + h - 2, -2, TOD.night ? PAL.litHi : PAL.glassHi, TOD.night ? 3 : 1);
  if (y > 1) { f.box(a - 4, 0, 1, a + w + 4, y, 10, CONC); f.box(a - 2, 0, 10, a + w + 2, Math.max(1, y - 2), 14, CONC); }   // landing + step
  if (o.lamp !== false) f.box(a + w + 3, y + 16, 1, a + w + 5, y + 20, 3, TOD.night ? 0xffe3a0 : 0xfff1c8, TOD.night ? 3 : 0);   // porch lantern
}
function garageDoor(f, a, w, col, trim = TRIM) {
  f.box(a - 2, 1, 0, a + w + 2, 26, 2, trim); f.box(a, 1, -2, a + w, 24, 2, AIR);
  f.box(a, 1, -3, a + w, 24, -2, (aa, yy) => (yy % 6 === 5) ? shade(col, .84) : ((aa - a) % 24 === 0 ? shade(col, .9) : col));
  if (col !== INK) f.box(a + 3, 18, -2, a + w - 3, 21, -1, TOD.night ? PAL.litLo : PAL.glassHi, TOD.night ? 3 : 1);   // the little window row
}
// the hoop over the garage: a white backboard with the red square, an orange rim, a white net (the garage gable carries it)
function hoopOn(f, a, y) {
  f.box(a, y, 1, a + 14, y + 9, 2, 0xf7f7f2); f.box(a + 4, y + 1, 2, a + 10, y + 5, 3, (aa, yy) => (aa === a + 4 || aa === a + 9 || yy === y + 1 || yy === y + 4) ? 0xe8232a : undefined);
  f.box(a + 6, y - 1, 1, a + 8, y + 1, 3, INK);
  for (let k = 0; k < 16; k++) { const t = k / 16 * Math.PI * 2; f.set(a + 7 + Math.round(Math.cos(t) * 2.6), y - 1, 5 + Math.round(Math.sin(t) * 2.4), 0xff6a1a, 2); }
  for (let yy = y - 5; yy < y - 1; yy++) for (const [dx, dd] of [[-2, 5], [2, 5], [0, 3], [0, 7]]) if ((yy + dx) & 1) f.set(a + 7 + dx, yy, dd, 0xf7f7f2);
}
function chimney(L, x, z, top) { L.box(x, 0, z, x + .9, top, z + .9, (xx, y) => y % 3 === 0 ? shade(BRICK, .85) : BRICK); L.box(x - .1, top - .3, z - .1, x + 1, top, z + 1, shade(BRICK, .7)); }
function porch(L, x0, x1, zf, dep, h, roofCol, o = {}) {
  const zb = zf + dep; L.box(x0, 0, zf, x1, .5, zb, o.floor ?? 0xd9cdb8);
  for (let x = x0; x <= x1 - .3 + 1e-6; x += (x1 - x0 - .3) / Math.max(1, Math.round((x1 - x0) / 2.6))) L.box(x, .5, zb - .35, x + .3, h, zb - .05, TRIM);
  L.box(x0 - .2, h, zf, x1 + .2, h + .3, zb + .25, TRIM); L.box(x0 - .1, h + .3, zf, x1 + .1, h + .5, zb + .15, roofCol);
  if (o.rail !== false) for (const [a, b] of [[x0 + .3, (o.gap ?? x0 + (x1 - x0) / 2) - .8], [(o.gap ?? x0 + (x1 - x0) / 2) + .8, x1 - .3]]) { L.box(a, 1.3, zb - .3, b, 1.4, zb - .1, TRIM); for (let x = a; x < b; x += .3) L.box(x, .5, zb - .25, x + .1, 1.3, zb - .15, TRIM); }
}
function picket(L, x0, x1, z, gap0, gap1) { for (let x = x0; x < x1; x += .2) { if (x > gap0 && x < gap1) continue; const tall = Math.round((x - x0) * 5) % 2 === 0; L.box(x, 0, z, x + .1, tall ? 1.0 : .9, z + .1, TRIM); }
  for (const [a, b] of [[x0, gap0], [gap1, x1]]) { L.box(a, .3, z - .1, b, .4, z, TRIM); L.box(a, .7, z - .1, b, .8, z, TRIM); } }
function fence(L, pts, col = 0xd9c7a4) {   // a board fence along lot-local polyline (axis-aligned runs), 1.6 m
  for (let k = 0; k + 1 < pts.length; k++) { const [ax, az] = pts[k], [bx, bz] = pts[k + 1];
    if (az === bz) L.box(Math.min(ax, bx), 0, az - .1, Math.max(ax, bx), 1.6, az, (x) => x % 3 === 0 ? shade(col, .88) : col);
    else L.box(ax - .1, 0, Math.min(az, bz), ax, 1.6, Math.max(az, bz), (x, y, z) => z % 3 === 0 ? shade(col, .88) : col); } }
function hedge(L, x0, z0, x1, z1) { L.box(x0, 0, z0, x1, 1.0, z1, (x, y, z) => hash(x, y * 3, z) > .75 ? 0x2a9a48 : 0x33ad52); }
function shrubs(L, x0, x1, z, skip = []) { for (let x = x0; x < x1 - .5; x += .9) { if (skip.some(([a, b]) => x + .8 > a && x < b)) continue; const h = .5 + hash(x * 10 | 0, z * 10 | 0) * .35;
  L.box(x, 0, z, x + .8, h, z + .8, (xx, y, zz) => hash(xx, y, zz) > .88 ? [0xff4fa3, 0xffe23a, 0xf7f7f2][(hash(zz, xx) * 3) | 0] : (y > h * 10 - 2 ? 0x3cbc5a : 0x2e9f4a)); } }
function spray(L, x, z, seed = 1) {   // the sprinkler's fan of water: droplets on parabolic arcs, glossy
  for (let a = 0; a < 7; a++) { const t0 = (a / 7) * Math.PI * 2 + seed; for (let k = 1; k < 12; k++) { const r = k * .28, y = .25 + r * 1.1 - r * r * .34; if (y < .05) break; L.box(x + Math.cos(t0) * r, y, z + Math.sin(t0) * r, x + Math.cos(t0) * r + .1, y + .1, z + Math.sin(t0) * r + .1, k % 3 ? 0xbfeaff : 0xf4fbff, 1); } } }
function walkPath(L, x0, x1, z0, z1) { for (let z = z0; z < z1; z += .6) L.box(x0, 0, z, x1, .05, Math.min(z1, z + .5), CONC); }
function drive(L, x0, x1, z0, z1) { L.box(x0, 0, z0, x1, .05, z1, (x, y, z) => (z % 30 === 0) ? 0xc9c2b4 : 0xd8d1c3); }

// ── the lot: a spec → a Bank in lot-local coordinates (stamped by main.js)
// every lot returns { bank, anchors } — anchors are lot-local spots main.js puts people on
export function buildLot(kind, seed = 1) {
  const L = new LV(-11, -26, 11, 1.5, 12), A = {}; let things = [];
  const put = (b, x, z, rot = 0, y = 0) => things.push([b, x, z, rot, y]);
  const F = HOUSES[kind]; F(L, put, A, seed);
  const bank = new Bank(); meshVol(L.V, bank);
  for (const [b, x, z, rot, y] of things) stampA(b, bank, rot, x, y, z);
  return { bank, A };
}

const HOUSES = {
  // 1 · THE SPRINGFIELD: two storeys, hip roof, a front-gable garage with the hoop, a portico, a bay window, the chimney
  springfield(L, put, A) {
    const wall = SHERBET.coral, M = [-9, -16, 2.5, -7], G = [2.5, -15, 9.2, -6.2];
    drive(L, 3.1, 8.6, -6.2, 1.5); walkPath(L, -4.3, -3.1, -6, 1.5);
    body(L, M, 6.4, wall); body(L, G, 3.2, wall, { found: 1 });
    hip(L, M, 6.4, ROOF.choc, { ov: 4 }); gable(L, G, 3.2, 'z', ROOF.choc, { fill: wall, run: 2, rise: 1, ovg: 3 });
    const f = L.face(M, '+z'), g = L.face(G, '+z');
    door(f, 52, 0x7a3cff, { glassTop: true }); W1(f, 8, 13, 22, 16); W1(f, 74, 13, 14, 16); for (const a of [8, 44, 78]) W1(f, a, 43, 14, 15);
    f.box(4, 9, 0, 34, 12, 6, TRIM); f.box(6, 12, 0, 32, 30, 4, TRIM); for (const a of [8, 16, 24]) f.box(a, 14, 3, a + 7, 29, 4, (aa, y) => litWin(3) ? (y > 23 ? PAL.litHi : PAL.litLo) : (y > 24 ? PAL.glassHi : PAL.glassLo), litWin(3) ? 3 : 1); f.box(4, 30, 0, 34, 32, 6, ROOF.choc);   // bay window
    f.box(48, 30, 0, 68, 31, 16, TRIM); for (const a of [48, 66]) f.box(a, 4, 13, a + 2, 30, 15, TRIM); f.box(47, 31, 0, 69, 33, 17, ROOF.choc);   // portico
    garageDoor(g, 8, 51, TRIM); hoopOn(g, 26, 36);
    chimney(L, -9.6, -12.5, 9.2); shrubs(L, -8.8, 2.4, -7, [[-4.8, -2.2]]);
    for (const a of [10, 50]) W1(L.face(M, '-x'), a, 43, 12, 15);
    put(mailbox('post', wall, 1), 2.4, .6, 0); put(bin(0x2f7a3a), 9.4, .2, 0); put(bike(0xff4fa3), -6.5, -3.6, 1.1); put(toys(1), -7.8, -2.2, .3);
    put(tree('maple', 1, 2), -8.8, -2.5); put(sprinkler(), -2, -3.6); spray(L, -2, -3.6, .3);
    fence(L, [[-10.5, -8], [-10.5, -25.5], [10.5, -25.5], [10.5, -8]]);
    A.hoop = [5.8, -3.0]; A.sprinkler = [-2, -3.6]; A.drive = [5.8, -1];
  },
  // 2 · THE TROPHY HOUSE (the upgraded showpiece): white box, a cobalt upper storey cantilevered forward, a glass wall, a roof deck
  //     with a giant gold trophy, an in-ground pool behind a glass fence
  trophy(L, put, A) {
    const M = [-3, -17, 9.5, -8], U = [-4.5, -17, 7.5, -6.6];
    drive(L, 4.6, 9.2, -8, 1.5); walkPath(L, 1.4, 2.6, -8, 1.5);
    body(L, M, 3.4, SHERBET.white, { lap: false, trim: 0xd3d4d7 });
    L.box(U[0], 3.4, U[1], U[2], 6.8, U[3], (x, y) => (y === 34 || y === 67) ? INK : SHERBET.cobalt);
    L.box(U[0], 6.8, U[1], U[2], 7.2, U[3], 0xf4f1ea); L.box(U[0] + .3, 7.0, U[1] + .3, U[2] - .3, 7.2, U[3] - .3, 0x9c9aa2);   // roof, parapet top
    const u = L.face(U, '+z'); u.box(6, 44, -2, 114, 58, 1, (a, y) => litWin(a >> 4) ? (y > 52 ? PAL.litHi : PAL.litLo) : (y > 53 ? PAL.glassHi : PAL.glassLo), TOD.night ? 3 : 1); u.box(6, 43, 0, 114, 44, 2, INK); u.box(6, 58, 0, 114, 59, 2, INK);
    const f = L.face(M, '+z'); f.box(3, 4, -1, 38, 30, 1, (a, y) => (a - 3) % 9 === 0 || y === 4 ? INK : (TOD.night ? (y > 20 ? PAL.litHi : PAL.litLo) : (y > 22 ? PAL.glassHi : PAL.glassLo)), TOD.night ? 3 : 1);   // the glass wall
    door(f, 43, INK, { lamp: true, y: 4 }); garageDoor(f, 78, 45, INK, 0xd3d4d7);
    f.box(78, 28, 0, 123, 30, 2, 0xd3d4d7);
    // roof deck on the upper box: string of lights, two loungers, THE TROPHY (gold, metal layer) on a plinth
    const ty = 7.2, tx = 3.2, tz = -11.5; L.box(tx - 1, ty, tz - 1, tx + 1, ty + .5, tz + 1, INK);
    L.box(tx - .5, ty + .5, tz - .5, tx + .5, ty + .8, tz + .5, GOLD, 2); L.box(tx - .2, ty + .8, tz - .2, tx + .2, ty + 1.6, tz + .2, GOLD, 2);
    for (let k = 0; k < 14; k++) { const r = [.5, .6, .8, .9, 1.0, 1.05, 1.1, 1.1, 1.1, 1.1, 1.05, 1.0, .9, .8][k]; L.box(tx - r, ty + 1.6 + k * .1, tz - r, tx + r, ty + 1.7 + k * .1, tz + r, GOLD, 2); }
    L.box(tx - .8, ty + 1.9, tz - .8, tx + .8, ty + 3.0, tz + .8, AIR);   // the cup is open
    for (const s of [-1, 1]) { L.box(tx + s * 1.1, ty + 2.4, tz - .15, tx + s * 1.5, ty + 2.5, tz + .15, GOLD, 2); L.box(tx + s * 1.4, ty + 1.9, tz - .15, tx + s * 1.5, ty + 2.5, tz + .15, GOLD, 2); L.box(tx + s * 1.1, ty + 1.9, tz - .15, tx + s * 1.5, ty + 2.0, tz + .15, GOLD, 2); }
    L.box(tx - .6, ty + .8, tz + 1.0, tx + .6, ty + 1.1, tz + 1.01, INK);   // plaque edge
    for (let x = U[0] + .6; x < U[2] - .4; x += .8) L.box(x, ty + 1.9, U[3] - .5, x + .2, ty + 2.1, U[3] - .3, TOD.night ? [0xffe23a, 0xff4fa3, 0x2de2e6][Math.round(x * 3) % 3 & 3] ?? 0xffe23a : 0xf7f7f2, TOD.night ? 3 : 0);
    for (const x of [U[0] + .4, U[2] - .6]) L.box(x, ty, U[3] - .6, x + .2, ty + 2.1, U[3] - .4, INK);
    L.box(U[0] + .4, ty + 2.1, U[3] - .6, U[2] - .4, ty + 2.15, U[3] - .5, INK);
    // pool in the left side yard, behind a glass fence, loungers
    L.box(-10.3, 0, -18, -3.4, .3, -9, 0xf4f1ea); L.box(-9.8, .05, -17.5, -3.9, .3, -9.5, 0x3fc8ff, 1); L.box(-9.8, .05, -17.5, -3.9, .2, -9.5, 0x2aa9e8, 1);
    L.box(-10.4, .3, -8.9, -3.3, 1.4, -8.8, 0xbfeaff, 1);
    put(mailbox('brick', SHERBET.cobalt), 4.0, .6); put(planter(0x17171b, 1), -1.2, -7.4); put(planter(0x17171b, 2), 4.0, -7.4);
    put(tree('birch', 1, 1), -9.5, -3); put(tree('birch', 0, 2), -6.8, -2.2);
    put(vehicleProp('supercar', { variant: 2, kind: 'car' }), 6.9, -3.8, Math.PI);
    fence(L, [[-10.5, -18.5], [-10.5, -25.5], [10.5, -25.5], [10.5, -8]], 0xe6e1d6);
    A.roof = [tx + 2.2, ty, tz + 2.8]; A.pool = [-6.8, -8.3];
  },
  // 3 · THE CAPE: a storey and a half, a steep side gable with two dormers, shutters, flower boxes, a white picket fence
  cape(L, put, A) {
    const wall = SHERBET.butter, M = [-6.5, -15, 6.5, -7];
    drive(L, 7, 10, -12, 1.5); walkPath(L, -.6, .6, -7, 1.5);
    body(L, M, 3.4, wall); gable(L, M, 3.4, 'x', ROOF.slate, { fill: wall, rise: 1, run: 1, ov: 4, ovg: 3 });
    const f = L.face(M, '+z'); door(f, 59, 0x14a83b, { glassTop: true });
    for (const a of [14, 34, 86, 104]) { W1(f, a, 13, 12, 16, TRIM, { box: true }); shutters(f, a, 13, 12, 16, 0x14a83b); }
    for (const dx of [-3.2, 3.2]) { const D = [dx - 1, -11.5, dx + 1, -7.8]; L.box(D[0], 3.8, D[1], D[2], 5.9, D[3], wall); gable(L, D, 5.9, 'z', ROOF.slate, { fill: wall, rise: 1, run: 1, ov: 2, ovg: 2 }); W1(L.face(D, '+z'), 5, 42, 10, 13); }
    chimney(L, 5.2, -12.8, 8.6); shrubs(L, -6.3, 6.4, -7, [[-1.2, 1.2]]);
    picket(L, -10.4, 10.4, -.3, -1.1, 1.1);
    put(mailbox('post', 0x14a83b), 2, .5); put(gnomes(1), -4.5, -5.6, .4); put(sprinkler(), 4.4, -2.2); spray(L, 4.4, -2.2, 1.1); put(birdbath(), 4.5, -4.2); put(tree('blossom', 1, 0), -8.2, -4.2);
    put(bike(0x2f5bff), 8.2, -9.5, 2.6); put(planter(0xe8232a, 0), -1.8, -6.5); put(planter(0xe8232a, 1), 1.8, -6.5);
    fence(L, [[-10.5, -12], [-10.5, -25.5], [10.5, -25.5], [10.5, -14]]);
    A.gate = [0, -1.2]; A.lawn = [-3.2, -3.4];
  },
  // 4 · THE GABLE-FRONT: two storeys, the gable to the street, a full-width porch with a swing, a trampoline out back
  porch(L, put, A) {
    const wall = SHERBET.sky, M = [-5.5, -17.5, 4.5, -8];
    drive(L, 5.5, 9, -20, 1.5); walkPath(L, -1.6, -.4, -5.4, 1.5);
    body(L, M, 6.4, wall); gable(L, M, 6.4, 'z', ROOF.char, { fill: wall, rise: 2, run: 3, ovg: 3, ov: 4 });
    const f = L.face(M, '+z'); door(f, 38, 0xe8232a, { glassTop: true, y: 5 }); W1(f, 10, 14, 16, 16); W1(f, 68, 14, 16, 16);
    for (const a of [12, 70]) W1(f, a, 43, 14, 15); W1(f, 44, 72, 12, 10);
    porch(L, -5.5, 4.5, -8, 2.6, 3.0, ROOF.char, { gap: -1 });
    L.box(-4.8, 1.0, -7.6, -3.0, 1.1, -7.2, WOOD); L.box(-4.8, 1.1, -7.7, -3.0, 1.6, -7.6, WOOD);   // porch swing (on chains)
    for (const x of [-4.7, -3.2]) L.box(x, 1.1, -7.45, x + .1, 3.0, -7.35, INK);
    shrubs(L, -5.5, 4.6, -5.3, [[-2.2, .3]]); put(mailbox('novelty', 0xe8232a), 4.7, .5); put(trampoline(0), 0, -21.5); put(tree('oak', 2, 1), -8.5, -4.5);
    put(vehicleProp('sedan', { variant: 5, kind: 'car' }), 7.25, -14, Math.PI); put(bin(0x2f5bff), 9.6, .25);
    fence(L, [[-10.5, -9], [-10.5, -25.5], [10.5, -25.5], [10.5, -21]]);
    A.porch = [-3.9, -7.45]; A.steps = [-1, -5];
  },
  // 5 · THE RANCH: one storey, long and low, a hip roof, a picture window, a carport with the pickup, flamingos, the kids' lemonade stand
  ranch(L, put, A) {
    const wall = SHERBET.mint, M = [-9.5, -15, 3, -7], C = [3, -15, 9.5, -7];
    drive(L, 3.6, 9, -15, 1.5); walkPath(L, -3.6, -2.4, -7, 1.5);
    body(L, M, 3.3, wall); hip(L, M, 3.3, ROOF.warm, { run: 3, rise: 1, ov: 5 });
    const f = L.face(M, '+z'); door(f, 58, 0xffc21a, { y: 3 }); f.box(10, 11, 0, 50, 26, 1, TRIM); W1(f, 12, 12, 36, 13); W1(f, 90, 13, 16, 14);
    for (const x of [3.2, 9.1]) for (const z of [-7.5, -14.6]) L.box(x, 0, z, x + .3, 2.8, z + .3, TRIM);
    L.box(2.7, 2.8, -15.3, 9.8, 3.1, -6.6, TRIM); L.box(2.8, 3.1, -15.2, 9.7, 3.3, -6.7, ROOF.warm);
    shrubs(L, -9.3, 3, -7, [[-4.2, -1.8]]); put(vehicleProp('pickup', { variant: 3, kind: 'car' }), 6.3, -11, Math.PI); put(flamingos(0), -7.5, -3.5, .3); put(flamingos(1), -5.8, -4.6, -.4);
    put(mailbox('post', 0xffc21a), 3.2, .5); put(lemonade(), -7.6, -.2, 0); put(tree('oak', 1, 2), -9.6, -8.8);
    put(swingset(1), -4, -21);
    fence(L, [[-10.5, -8], [-10.5, -25.5], [10.5, -25.5], [10.5, -15]]);
    A.stand = [-7.6, -.2]; A.lawn = [-2, -3];
  },
  // 6 · THE GAMBREL: a Dutch barn roof, the garage wing with the second hoop, a shed dormer
  gambrel(L, put, A) {
    const wall = SHERBET.lilac, M = [-4.5, -16, 6.5, -7.5], G = [-10.2, -15, -4.5, -6.8];
    drive(L, -9.7, -5, -6.8, 1.5); walkPath(L, 1.1, 2.3, -7.5, 1.5);
    body(L, M, 3.4, wall); body(L, G, 3.1, shade(wall, .92), { found: 1 });
    gable(L, M, 3.4, 'x', ROOF.grey, { fill: wall, ov: 4, ovg: 3, steps: k => k < 14 ? [2, 1] : [1, 2] });
    hip(L, G, 3.1, ROOF.grey, { run: 2, rise: 1 });
    const f = L.face(M, '+z'); door(f, 53, 0xffffff, { trim: 0xfff0d0 }); W1(f, 12, 13, 14, 16); W1(f, 82, 13, 14, 16);
    f.box(4, 30, 0, 106, 32, 3, TRIM);
    L.box(-3, 5.4, -12, 5, 6.6, -9.1, wall); L.box(-3.2, 6.6, -12, 5.2, 6.8, -8.9, ROOF.grey); for (const a of [4, 34, 62]) W1(L.face([-3, -12, 5, -9.1], '+z'), a, 56, 12, 9);   // shed dormer
    const g = L.face(G, '+z'); garageDoor(g, 5, 47, TRIM); hoopOn(g, 20, 27);
    chimney(L, 6.6, -12.5, 8.4); shrubs(L, -4.3, 6.4, -7.5, [[.4, 3]]);
    put(mailbox('post', wall), -4.4, .5); put(bike(0xffc21a), -1.5, -3, .6); put(tree('maple', 2, 0), 8.5, -4); put(planter(0xff4fa3, 2), -.2, -6.8);
    fence(L, [[-10.5, -15], [-10.5, -25.5], [10.5, -25.5], [10.5, -9]]);
    A.hoop = [-7.4, -3.4]; A.lawn = [4, -3];
  },
  // an open lot: mown grass, the footprint staked with pink-flag stakes and string, a realtor sign (main.js adds the words)
  empty(L, put, A) {
    const [x0, z0, x1, z1] = [-6, -17, 6, -7];
    for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) { L.box(x - .05, 0, z - .05, x + .05, .7, z + .05, 0xe9d8b8); L.box(x - .08, .6, z - .02, x + .12, .7, z + .08, 0xff4fa3); }
    for (const [a, b, c, d] of [[x0, z0, x1, z0], [x0, z1, x1, z1], [x0, z0, x0, z1], [x1, z0, x1, z1]]) L.box(Math.min(a, c), .4, Math.min(b, d), Math.max(a, c) + .04, .44, Math.max(b, d) + .04, 0xff4fa3);
    L.box(-2, 0, -13, 2, .03, -10, 0x8a6a4a);   // a fresh patch of dirt where the survey pin went in
    put(tree('oak', 2, 0), 7.5, -20);
    A.sign = [-4.5, -2.2]; A.look = [-2, -2.5];
  },
};
