// PLEASANTVIEW · THE HOUSES (owner: the Pleasantview section agent). Ten types on the sim's own lots, each one volume in world axes,
// drawn in the lot's local frame (u along the frontage from the left, v from the front lot line in; voxels):
//   colonial   two storeys, side gable, centred door, shutters, a portico     hip        two storeys, hip roof, attached garage, picture window
//   gablefront two storeys, gable to the street, a full front porch            ranch      one storey, long and low, picture window, carport or garage
//   cape       a storey and a half, steep roof with two dormers                split      split-level: a two-storey half over the garage, a low half
//   gambrel    Dutch colonial barn roof with a shed dormer                     bungalow   low front gable, deep porch on piers
//   twofam     the outer-borough two-family: flat roof, cornice, stoop, awnings aframe     the A-frame by the woods, a glass gable and a deck
// Every house: one flat wall colour (lap siding lines on some), trim, a neutral shingle roof, a foundation band, a door 1.2 × 2.4 m at
// 0.3 m (the sim's door opening) on a landing wide enough for the sim's safe, windows on every face (the sim-state layer lights each
// one), and the anchor the layer draws on (lights, FOR RENT, locks, safes, scars).
import { Vol } from '../../vox.js';
import { frame, win, AIR, TOD } from '../../kit.js';
import { REG } from '../../audit.js';
import { PAL, CV, SIDE, hash, shade } from '../../style.js';
import { frameOf, layoutOf, FLOOR, STOREY } from './plan.js';
import { paintedAd, ghostSign } from '../../facade.js';

const INK = PAL.ink, WHITE = PAL.white, BRICK = 0x9c4a34, CONC = 0xb9b3a8, FOUND = 0xa39d92, GLASS = 0x9fd8ff, WOOD = 0xa4652f, DECK = 0x9a7650, IRON = PAL.iron;
const lit = (day = 1) => TOD.night ? 3 : day;
const SIDES = { f: { front: '+z', back: '-z', left: '-x', right: '+x' }, b: { front: '-z', back: '+z', left: '+x', right: '-x' } };
const ROT = { '+z': 0, '+x': 1, '-z': 2, '-x': 3 }, NRM = { '+z': [0, 1], '+x': [1, 0], '-z': [0, -1], '-x': [-1, 0] };
const H1 = FLOOR + STOREY + 1, H2 = FLOOR + 2 * STOREY + 1;   // wall tops: one storey 3.2 m, two 6.0 m
const WY = [FLOOR + 8, FLOOR + STOREY + 8];                    // window sills, ground floor and upstairs

// ── the house volume: a world-axis Vol over a lot-local rect, with local drawing helpers
export function hvol(s, U0, V0, U1, V1, NY) {
  const F = frameOf(s.l), f = F.f; U0 = Math.max(0, U0); V0 = Math.max(0, V0); U1 = Math.min(s.W10, U1); V1 = Math.min(s.D10, V1);
  const x0 = Math.min(F.x(U0 / 10), F.x(U1 / 10)), z0 = Math.min(F.z(V0 / 10), F.z(V1 / 10));
  const V = new Vol(U1 - U0, NY, V1 - V0, { s: CV, org: [+x0.toFixed(2), SIDE, +z0.toFixed(2)] });
  const X = f > 0 ? u => u - U0 : u => U1 - 1 - u, Z = f > 0 ? v => V1 - 1 - v : v => v - V0, iu = f > 0 ? x => x + U0 : x => U1 - 1 - x, iv = f > 0 ? z => V1 - 1 - z : z => z + V0;
  const hv = { V, F, f, s, U0, V0, U1, V1,
    box(u0, y0, v0, u1, y1, v1, c, l = 0) { u0 = Math.max(u0, U0); v0 = Math.max(v0, V0); u1 = Math.min(u1, U1); v1 = Math.min(v1, V1); if (u1 <= u0 || v1 <= v0 || y1 <= y0) return;
      const xa = X(u0), xb = X(u1 - 1), za = Z(v0), zb = Z(v1 - 1);
      V.box(Math.min(xa, xb), y0, Math.min(za, zb), Math.max(xa, xb) + 1, y1, Math.max(za, zb) + 1, typeof c === 'function' ? (x, y, z) => c(iu(x), y, iv(z)) : c, l); },
    set(u, y, v, c, l = 0) { if (u >= U0 && u < U1 && v >= V0 && v < V1) V.set(X(u), y, Z(v), c, l); },
    has(u, y, v) { return u >= U0 && u < U1 && v >= V0 && v < V1 && V.has(X(u), y, Z(v)); },
    B(u0, v0, u1, v1) { const xa = X(u0), xb = X(u1 - 1), za = Z(v0), zb = Z(v1 - 1); return { x0: Math.min(xa, xb), x1: Math.max(xa, xb) + 1, z0: Math.min(za, zb), z1: Math.max(za, zb) + 1 }; },
    side: k => SIDES[f > 0 ? 'f' : 'b'][k],
    frame(k, r) { return frame(V, hv.B(...r), hv.side(k)); },
    keep(u0, v0, u1, v1, y0, y1, tag = 'facade') { const [a, b, c, d] = F.rect(u0 / 10, v0 / 10, u1 / 10, v1 / 10); REG.keep([a, SIDE + y0 * CV, b, c, SIDE + y1 * CV, d], tag); },
    wrect(u0, v0, u1, v1) { return F.rect(u0 / 10, v0 / 10, u1 / 10, v1 / 10).map(q => +q.toFixed(2)); },
  };
  return hv;
}

// ── walls: one flat colour (lap siding lines on some), a foundation band, white corner boards on sided houses
function walls(hv, [u0, v0, u1, v1], y1, s, o = {}) {
  const w = o.wall ?? s.wall, lap = o.lap ?? s.lap, line = shade(w, .9), cb = s.neutral ? shade(w, .9) : s.trim;
  hv.box(u0, 0, v0, u1, y1, v1, (u, y, v) => y < FLOOR ? FOUND : (lap && (u === u0 || u === u1 - 1 || v === v0 || v === v1 - 1) && (u - u0 < 2 || u1 - 1 - u < 2) && (v - v0 < 2 || v1 - 1 - v < 2)) ? cb : (lap && y % 3 === 0) ? line : w);
}
// roofs over a rect: a stepped profile along one axis (gable, gambrel, A-frame) or a hip. steps(k) → [rise, run] of layer k.
const shg = (s, k) => (k % 2) ? shade(s.roof, .9) : s.roof;
export function roofAlong(hv, [u0, v0, u1, v1], y0, axis, steps, o) {
  const s = o.s, ove = o.ove ?? 3, ovg = o.ovg ?? 2, fill = o.gable ?? s.wall;
  const [a0, a1, b0, b1] = axis === 'u' ? [v0, v1, u0, u1] : [u0, u1, v0, v1];
  const put = (p, q, r0, r1, y, h, c) => { if (q <= p) return; if (axis === 'u') hv.box(r0, y, p, r1, y + h, q, c); else hv.box(p, y, r0, q, y + h, r1, c); };
  let y = y0, aa = a0 - ove, ab = a1 + ove, k = 0;
  while (ab - aa > 0 && k < 200) { const [rise, run] = steps(k), t = Math.max(2, run + 1), c = k === 0 && o.fascia ? o.fascia : o.col ? o.col(k) : shg(s, k), top = ab - aa <= 2 * t;
    put(aa, Math.min(ab, aa + t), b0 - ovg, b1 + ovg, y, rise, c); put(Math.max(aa, ab - t), ab, b0 - ovg, b1 + ovg, y, rise, c);
    if (!top) put(Math.max(aa + t, a0), Math.min(ab - t, a1), b0, b1, y, rise, fill);
    y += rise; aa += run; ab -= run; k++; }
  return y;
}
export function roofHip(hv, [u0, v0, u1, v1], y0, o) {
  const s = o.s, ov = o.ov ?? 3, rise = o.rise ?? 1, run = o.run ?? 1; let y = y0, k = 0;
  for (let ua = u0 - ov, ub = u1 + ov, va = v0 - ov, vb = v1 + ov; ub > ua && vb > va; ua += run, ub -= run, va += run, vb -= run, k++, y += rise)
    hv.box(ua, y, va, ub, y + rise, vb, k === 0 && o.fascia ? o.fascia : shg(s, k));
  return y;
}
// a flat roof: the deck, a parapet ring and a cornice band on the street face (the two-family)
function roofFlat(hv, [u0, v0, u1, v1], y0, s) {
  hv.box(u0, y0, v0, u1, y0 + 1, v1, 0x9c9aa2); hv.box(u0, y0 + 1, v0, u1, y0 + 4, v1, s.wall); hv.box(u0 + 2, y0 + 1, v0 + 2, u1 - 2, y0 + 4, v1 - 2, AIR);
  hv.box(u0 - 1, y0 + 3, v0 - 2, u1 + 1, y0 + 5, v1, s.trim); hv.box(u0 - 1, y0 - 3, v0 - 2, u1 + 1, y0 - 1, v0, s.trim);
  for (let u = u0 + 2; u < u1 - 1; u += 5) hv.box(u, y0 - 1, v0 - 2, u + 2, y0 + 3, v0, s.trim);   // brackets under the cornice
  return y0 + 5;
}

// ── openings on a facade frame (kit.js: a along the wall, y up, d out of the wall)
function hwin(fr, a0, y0, w, h, s, o = {}) {
  win(fr, a0, y0, w, h, o.trim ?? s.trim, { ac: o.ac, box: o.box });
  if (s.grid && w >= 10 && !o.ac) fr.box(a0 + (w >> 1), y0, -2, a0 + (w >> 1) + 1, y0 + h, -1, o.trim ?? s.trim);
  if (o.shutter) for (const sa of [a0 - 5, a0 + w + 1]) fr.box(sa, y0, 0, sa + 4, y0 + h, 2, (a, y) => (y % 3 === 0) ? shade(o.shutter, .82) : o.shutter);
  if (o.awning) awning(fr, a0 - 2, a0 + w + 2, y0 + h + 2, o.awning);
  return { a0, y0, w, h };
}
// an aluminium awning: a striped slope from the wall out 0.6 m, a valance hanging off its edge
function awning(fr, a0, a1, y, [c1, c2]) { const st = a => ((a - a0) % 6 < 3) ? c1 : c2;
  for (let d = 1; d <= 6; d++) fr.box(a0, y + 6 - d, d, a1, y + 7 - d, d + 1, st); fr.box(a0, y - 1, 6, a1, y + 1, 7, c1); for (const a of [a0, a1 - 1]) for (let d = 1; d <= 6; d++) fr.box(a, y, d, a + 1, y + 6 - d, d + 1, c1); }
// the front door: 1.2 × 2.4 m at y FLOOR (the sim's opening), a casing, a glazed leaf, a porch light (lit at night) → the door's centre a
function hdoor(fr, a, s, o = {}) {
  const y0 = FLOOR, w = 12, h = 24, c = o.door ?? s.door, tr = o.trim ?? s.trim;
  fr.box(a - 2, y0, 0, a + w + 2, y0 + h + 2, 2, tr); fr.box(a, y0, -2, a + w, y0 + h, 2, AIR);
  const kind = hash(s.seed, 71) * 3 | 0;
  fr.box(a, y0, -3, a + w, y0 + h, -2, (aa, y) => { const x = aa - a, yy = y - y0;
    if (kind === 0 && yy > 15 && yy < 21 && x > 2 && x < 9) return GLASS;                   // a window in the door
    if (kind === 1 && yy > 3 && yy < 21 && (x === 2 || x === 9)) return shade(c, .8);       // two panels
    if (kind === 2 && yy > 17 && yy < 21 && x > 1 && x < 10 && (x % 3)) return GLASS;       // a row of lights
    return c; }, 0);
  fr.box(a + 9, y0 + 10, -2, a + 10, y0 + 12, -1, PAL.gold, 2);
  if (o.light !== false) fr.box(a + w + 3, y0 + 16, 1, a + w + 5, y0 + 19, 3, 0xfff1c8, lit(1));
  return a + (w >> 1);
}
// a landing 0.3 m high from the wall out to d1 (a0…a1), steps down in front of the door, iron rails on a stoop
function landing(fr, a0, a1, d1, da, s, o = {}) {
  const c = o.c ?? CONC; fr.box(a0, 0, 1, a1, FLOOR, d1, c); fr.box(da - 7, 0, d1, da + 7, 2, d1 + 3, c); fr.box(da - 7, 0, d1 + 3, da + 7, 1, d1 + 5, shade(c, .94));
  if (o.rail) for (const a of [a0, a1 - 1]) { fr.box(a, FLOOR, 2, a + 1, FLOOR + 9, d1, (aa, y, d) => (y === FLOOR + 8 || d % 3 === 0) ? IRON : undefined); }
  return d1 + 5;
}
// garage door: panels, a row of lights near the top on some
function gdoor(fr, a0, w, h, s) { const c = s.gdoor, lights = hash(s.seed, 73) < .4;
  fr.box(a0 - 2, 1, 0, a0 + w + 2, h + 2, 2, s.trim); fr.box(a0, 0, -2, a0 + w, h, 2, AIR);
  fr.box(a0, 0, -3, a0 + w, h, -2, (a, y) => (lights && y > h - 6 && y < h - 2 && (a - a0) % 6 > 0 && (a - a0) % 6 < 5) ? GLASS : (y % 5 === 4) ? shade(c, .84) : c, 0); }
function chimney(hv, u0, v0, u1, v1, top, c = BRICK) { hv.box(u0, 0, v0, u1, top, v1, (u, y) => (y % 4 === 0) ? shade(c, .86) : c); hv.box(u0 - 1, top, v0 - 1, u1 + 1, top + 2, v1 + 1, shade(c, .72)); hv.box(u0 + 1, top + 2, v0 + 1, u1 - 1, top + 4, v1 - 1, 0x3d3f46); }

function bay(fr, a0, w, s) { const y0 = FLOOR + 3, y1 = FLOOR + 27, D = 5, tr = s.trim;
  fr.box(a0, y0 - 3, 1, a0 + w, y1, D, s.wall); fr.box(a0 - 1, y0 - 3, 1, a0 + w + 1, y0, D + 1, shade(s.wall, .8));
  fr.box(a0 + 2, y0 + 2, D - 1, a0 + w - 2, y1 - 3, D, (a, y) => (a === a0 + (w >> 1) || y === ((y0 + y1) >> 1)) ? tr : TOD.night && hash(a0, s.seed) > .5 ? PAL.litHi : GLASS, TOD.night ? 3 : 1);
  for (const a of [a0, a0 + w - 1]) fr.box(a, y0 + 2, 2, a + 1, y1 - 3, D - 1, TOD.night && hash(a0, s.seed) > .5 ? PAL.litHi : GLASS, TOD.night ? 3 : 1);
  fr.box(a0 - 1, y1, 0, a0 + w + 1, y1 + 1, D + 1, tr); for (let k = 0; k < 3; k++) fr.box(a0 - 1 + k, y1 + 1 + k, 0, a0 + w + 1 - k, y1 + 2 + k, D + 1 - k * 2, shade(s.roof, k % 2 ? .9 : 1));
  return { a0: a0 + 2, y0: y0 + 2, w: w - 4, h: y1 - y0 - 5 }; }
// the topmost voxel of each column in a lot-local rect gets one more on top (solar panels laid on a roof slope; an antenna's foot)
function onRoof(hv, u0, v0, u1, v1, c, l = 0) { let top = 0; for (let u = u0; u < u1; u++) for (let v = v0; v < v1; v++) { let y = hv.V.ny - 2; while (y > 0 && !hv.has(u, y, v)) y--; if (y > 0) { hv.set(u, y + 1, v, typeof c === 'function' ? c(u, v) : c, l); top = Math.max(top, y + 1); } } return top; }
// a satellite dish on a short mast at the drive-side end of the roof, turned to the street (on the roof, clear of every window and shutter)
function roofDish(hv, s, b) { const u = s.driveSide === 'R' ? b[2] - 5 : b[0] + 3, v = b[1] + 7, y = onRoof(hv, u, v, u + 2, v + 2, 0x8f929b); if (!y) return;
  hv.box(u, y, v, u + 2, y + 5, v + 2, IRON, 2);
  for (let dx = -4; dx <= 4; dx++) for (let dy = -4; dy <= 4; dy++) { const r = dx * dx + dy * dy; if (r <= 17) hv.set(u + 1 + dx, y + 7 + dy, v - 1 - (r > 9 ? 1 : 0), 0xe6e9ee); }
  hv.box(u + 1, y + 6, v - 5, u + 2, y + 7, v - 1, IRON, 2); }
// windows along a facade row: n windows spread over [a0, a1), skipping [skip0, skip1)
function row(fr, a0, a1, y, n, w, h, s, o = {}) { const out = [], span = a1 - a0, gap = span / n;
  for (let k = 0; k < n; k++) { const c = Math.round(a0 + gap * (k + .5)), wa = c - (w >> 1); if (o.skip && wa + w + 5 > o.skip[0] && wa - 5 < o.skip[1]) continue; if (wa < 5 || wa + w > fr.len - 5) continue;
    out.push(hwin(fr, wa, y, w, h, s, { shutter: o.shutter, awning: o.awning, box: o.box && hash(s.seed, y, k) < .6, ac: o.ac && hash(s.seed, y, k + 9) < .35 })); }
  return out; }

// ════════════════════════ THE TYPES: each draws its body, roof, front and sides, and returns what the anchors need
// r = { fr (front frame), fw: front windows [{a0,y0,w,h}], sides: [[frame, list]], door: a (centre on fr), plane: dOut (door plane, voxels out
// from the wall), top (voxels), eave (voxels) }
function sidesWindows(hv, body, s, y1rows, o = {}) { const out = [], L = layoutOf(s);
  for (const k of o.only || ['left', 'right', 'back']) { if (k === L.skipSide && !o.only) continue; const g = hv.frame(k, body), n = Math.max(1, Math.round(g.len / (k === 'back' ? 34 : 40))), list = [];
    for (const y of y1rows) list.push(...row(g, 8, g.len - 8, y, n, k === 'back' ? 13 : 11, 15, s, { shutter: o.shutter && k === 'back' ? s.shutter : null }));
    out.push([g, list]); }
  return out; }

const TYPE = {
  colonial(hv, s, L) {
    const b = L.body, fr = hv.frame('front', b), da = L.door - b[0] - 6; walls(hv, b, H2, s);
    const top = roofAlong(hv, b, H2, 'u', () => [1, 1], { s, fascia: s.trim });
    const port = L.porch === 'portico', hood = L.porch === 'hood';
    const fw = s.bay && da - 8 > 28 && fr.len - (da + 20) > 28 ? [bay(fr, 5, 22, s), bay(fr, fr.len - 27, 22, s)] : row(fr, 0, fr.len, WY[0], fr.len > 80 ? 4 : 2, 12, 16, s, { skip: [da - 8, da + 20], shutter: s.shutter, box: s.box });
    fw.push(...row(fr, 0, fr.len, WY[1], fr.len > 80 ? 5 : 3, 12, 16, s, { shutter: s.shutter, ac: s.ac }));
    hdoor(fr, da, s); let out = landing(fr, da - 6, da + 22, 12, da + 6, s);
    if (port) { for (const a of [da - 6, da + 16]) fr.box(a, FLOOR, 8, a + 3, FLOOR + 27, 11, WHITE); fr.box(da - 8, FLOOR + 27, 0, da + 21, FLOOR + 29, 13, s.trim);
      for (let k = 0; k < 7; k++) fr.box(da - 8 + k * 2, FLOOR + 29 + k, 10, da + 21 - k * 2, FLOOR + 30 + k, 13, k % 2 ? shade(s.roof, .9) : s.roof); fr.box(da - 4, FLOOR + 29, 11, da + 17, FLOOR + 32, 12, s.trim); }
    if (hood) { fr.box(da - 4, FLOOR + 27, 0, da + 16, FLOOR + 29, 8, s.roof); for (const a of [da - 3, da + 14]) fr.box(a, FLOOR + 22, 1, a + 1, FLOOR + 27, 5, s.trim); }
    if (!port && !hood) fr.box(da - 3, FLOOR + 27, 1, da + 15, FLOOR + 28, 4, s.trim);
    return { fr, fw, sides: sidesWindows(hv, b, s, WY), door: da + 6, out, top, eave: H2, chimney: 'end' };
  },
  hip(hv, s, L) {
    const b = L.body, fr = hv.frame('front', b), da = L.door - b[0] - 6; walls(hv, b, H2, s);
    const top = roofHip(hv, b, H2, { s, ov: 3, fascia: s.trim });
    const left = da + 6 > fr.len / 2, pa = left ? 7 : da + 20, pw = Math.max(14, Math.min(30, left ? da - 9 - pa : fr.len - 7 - pa)), fw = [s.bay && pw >= 20 ? bay(fr, pa, pw, s) : hwin(fr, pa, WY[0] - 1, pw, 17, s, { box: s.box })];
    fw.push(...row(fr, 0, fr.len, WY[1], 3, 12, 16, s, { shutter: s.shutter, ac: s.ac }));
    hdoor(fr, da, s); let out;
    let span = null; if (L.porch === 'porch') { const a0 = Math.max(1, Math.min(da - 8, pa - 4)), a1 = Math.min(fr.len - 1, Math.max(da + 22, pa + pw + 4)); out = porch(fr, a0, a1, 16, da + 6, s, {}); span = [a0, a1, 16]; }
    else { out = landing(fr, da - 6, da + 22, 12, da + 6, s); if (L.porch === 'hood') fr.box(da - 4, FLOOR + 27, 0, da + 16, FLOOR + 29, 8, s.roof); }
    return { fr, fw, sides: sidesWindows(hv, b, s, WY), door: da + 6, out, top, eave: H2, chimney: 'side', span };
  },
  gablefront(hv, s, L) {
    const b = L.body, fr = hv.frame('front', b), da = L.door - b[0] - 6; walls(hv, b, H2, s);
    const top = roofAlong(hv, b, H2, 'v', () => [1, 1], { s, fascia: s.trim, ove: 3, ovg: 3 });
    const aw = s.awning, fw = [];
    const ga = da < fr.len / 2 ? da + 20 : 8, gw = Math.min(24, fr.len - ga - 8); fw.push(s.bay && !aw && gw >= 18 ? bay(fr, ga, gw, s) : hwin(fr, ga, WY[0], gw, 16, s, { awning: aw, box: s.box }));
    fw.push(...row(fr, 0, fr.len, WY[1], 2, 12, 16, s, { shutter: s.shutter, awning: aw, ac: s.ac }));
    const ya = H2 + Math.round((b[2] - b[0]) / 2) - 16; hwin(fr, (fr.len >> 1) - 5, ya, 10, 9, s, {});      // the attic window in the gable
    hdoor(fr, da, s); let out;
    let span = null; if (L.porch === 'porch') { out = porch(fr, 1, fr.len - 1, 20, da + 6, s, { shed: true }); span = [1, fr.len - 1, 20]; }
    else if (L.porch === 'enclosed') out = enclosed(fr, da - 10, da + 22, s);
    else out = landing(fr, da - 6, da + 22, 12, da + 6, s, { rail: true });
    return { fr, fw, sides: sidesWindows(hv, b, s, WY), door: out.door ?? da + 6, plane: out.plane, out: out.d ?? out, top, eave: H2, chimney: 'side', span, encl: L.porch === 'enclosed' ? [da - 10, da + 22] : null };
  },
  ranch(hv, s, L) {
    const b = L.body, fr = hv.frame('front', b), da = L.door - b[0] - 6; walls(hv, b, H1, s);
    const low = hash(s.seed, 81) < .5, top = low ? roofHip(hv, b, H1, { s, ov: 4, run: 2, fascia: s.trim }) : roofAlong(hv, b, H1, 'u', () => [1, 2], { s, ove: 4, ovg: 3, fascia: s.trim });
    const R = da > fr.len / 2, pw = 34, pa = R ? Math.max(6, da - pw - 12) : da + 20, fw = [];
    fw.push(hwin(fr, pa, WY[0] - 2, pw, 18, s, {})); fr.box(pa - 2, 0, 1, pa + pw + 2, FLOOR + 3, 6, BRICK); fr.box(pa - 1, FLOOR + 3, 2, pa + pw + 1, FLOOR + 4, 5, 0x3f8f3a);   // a brick planter under the picture window
    fw.push(...row(fr, R ? da + 18 : 0, R ? fr.len : Math.max(12, pa - 6), WY[0] + 2, 1, 14, 12, s, { shutter: s.shutter }));
    hdoor(fr, da, s); const out = landing(fr, da - 6, da + 22, 10, da + 6, s);
    if (L.porch === 'hood') fr.box(da - 4, FLOOR + 26, 0, da + 16, FLOOR + 27, 9, s.roof);
    return { fr, fw, sides: sidesWindows(hv, b, s, [WY[0] + 2]), door: da + 6, out, top, eave: H1, chimney: low ? 'mid' : 'end' };
  },
  cape(hv, s, L) {
    const b = L.body, fr = hv.frame('front', b), da = L.door - b[0] - 6; walls(hv, b, H1, s);
    const top = roofAlong(hv, b, H1, 'u', () => [3, 2], { s, fascia: s.trim, ove: 3, ovg: 2 });
    const fw = row(fr, 0, fr.len, WY[0], 2, 12, 16, s, { skip: [da - 8, da + 20], shutter: s.shutter, box: s.box });
    for (const a of [Math.round(fr.len * .25), Math.round(fr.len * .75)]) fw.push(dormer(hv, b, a, H1, s));
    hdoor(fr, da, s); const out = landing(fr, da - 6, da + 22, 12, da + 6, s);
    if (L.porch === 'hood' || L.porch === 'portico') { fr.box(da - 4, FLOOR + 26, 0, da + 16, FLOOR + 28, 8, s.roof); for (const a of [da - 3, da + 14]) fr.box(a, FLOOR + 21, 1, a + 1, FLOOR + 26, 5, s.trim); }
    return { fr, fw: fw.filter(Boolean), sides: sidesWindows(hv, b, s, [WY[0], WY[1] + 4]), door: da + 6, out, top, eave: H1, chimney: 'end' };
  },
  split(hv, s, L) {
    const b = L.body, R = s.driveSide === 'R', mid = R ? b[2] - 40 : b[0] + 40, A = R ? [mid, b[1], b[2], b[3]] : [b[0], b[1], mid, b[3]], Bw = R ? [b[0], b[1] + 6, mid, b[3] - 4] : [mid, b[1] + 6, b[2], b[3] - 4];
    walls(hv, A, H2, s); walls(hv, Bw, H1 + 6, s);
    const topA = roofAlong(hv, A, H2, 'v', () => [1, 2], { s, fascia: s.trim, ove: 3, ovg: 4 }), topB = roofAlong(hv, Bw, H1 + 6, 'u', () => [1, 2], { s, fascia: s.trim, ove: 4, ovg: 2 });
    const fa = hv.frame('front', A), fb = hv.frame('front', Bw), fw = [];
    gdoor(fa, (fa.len - 26) >> 1, 26, 22, s); for (const w of row(fa, 0, fa.len, WY[1], 2, 12, 15, s, { shutter: s.shutter })) fw.push({ ...w, f: fa });
    const da = L.door - Bw[0] - 6; hdoor(fb, da, s); const out = landing(fb, da - 6, da + 22, 12, da + 6, s) - 6;
    fb.box(da - 4, FLOOR + 27, 0, da + 16, FLOOR + 29, 7, s.roof);
    const pa = da + 6 > fb.len / 2 ? 6 : da + 20, pw = Math.max(12, Math.min(26, da + 6 > fb.len / 2 ? da - 14 : fb.len - 6 - pa)); if (pw >= 12) fw.push({ ...hwin(fb, pa, WY[0] + 3, pw, 16, s, { box: s.box }), f: fb });
    const sides = [...sidesWindows(hv, A, s, [WY[0] + 2, WY[1]], { only: [R ? 'right' : 'left', 'back'] }), ...sidesWindows(hv, Bw, s, [WY[0] + 2], { only: [R ? 'left' : 'right', 'back'] })];
    return { fr: fb, fw, sides, door: da + 6, doorU: Bw[0] + da + 6, plane: -6, out, top: Math.max(topA, topB), eave: H1 + 6, chimney: 'none' };
  },
  gambrel(hv, s, L) {
    const b = L.body, fr = hv.frame('front', b), da = L.door - b[0] - 6; walls(hv, b, H1, s);
    const top = roofAlong(hv, b, H1, 'u', k => k < 9 ? [3, 1] : [1, 2], { s, fascia: s.trim, ove: 2, ovg: 2 });
    // the shed dormer across the front of the lower slope: a band of wall with three windows under its own flat roof
    const d0 = b[1], u0 = b[0] + 8, u1 = b[2] - 8; walls(hv, [u0, d0, u1, d0 + 18], H1 + 24, s, { lap: false }); hv.box(u0 - 2, H1 + 24, d0 - 3, u1 + 2, H1 + 26, d0 + 20, shade(s.roof, .9)); hv.box(u0 - 2, H1 + 23, d0 - 3, u1 + 2, H1 + 24, d0 - 1, s.trim);
    const fd = hv.frame('front', [u0, d0, u1, d0 + 18]), fw = row(fd, 0, fd.len, H1 + 6, 3, 11, 13, s, { shutter: s.shutter });
    fw.forEach(w => w.f = fd);
    fw.push(...row(fr, 0, fr.len, WY[0], 2, 12, 16, s, { skip: [da - 8, da + 20], shutter: s.shutter, box: s.box }));
    hdoor(fr, da, s); const out = landing(fr, da - 6, da + 22, 12, da + 6, s);
    if (L.porch !== 'stoop') { fr.box(da - 6, FLOOR + 27, 0, da + 18, FLOOR + 29, 10, s.roof); for (const a of [da - 5, da + 15]) fr.box(a, FLOOR, 9, a + 2, FLOOR + 27, 11, WHITE); }
    return { fr, fw, sides: sidesWindows(hv, b, s, [WY[0], WY[1] + 2]), door: da + 6, out, top, eave: H1, chimney: 'end' };
  },
  bungalow(hv, s, L) {
    const b = L.body, fr = hv.frame('front', b), da = L.door - b[0] - 6; walls(hv, b, H1 + 2, s);
    const top = roofAlong(hv, b, H1 + 2, 'v', () => [1, 2], { s, fascia: s.trim, ove: 4, ovg: 4 });
    const fw = [];
    for (const a of [8, fr.len - 30]) if (Math.abs(a + 11 - (da + 6)) > 18) { if (s.bay) { fw.push(bay(fr, a, 22, s)); continue; } const w1 = hwin(fr, a, WY[0], 10, 16, s, { box: s.box }), w2 = hwin(fr, a + 12, WY[0], 10, 16, s, {}); fw.push(w1, w2); }
    hwin(fr, (fr.len >> 1) - 6, H1 + 10, 12, 8, s, {});   // the attic vent window
    hdoor(fr, da, s); const out = porch(fr, 2, fr.len - 2, 22, da + 6, s, { piers: true, gable: true, roofTop: H1 + 2 });
    return { fr, fw, sides: sidesWindows(hv, b, s, [WY[0]]), door: da + 6, out, top, eave: H1 + 2, chimney: 'side', span: [2, fr.len - 2, 22] };
  },
  twofam(hv, s, L) {
    const b = L.body, fr = hv.frame('front', b), da = L.door - b[0] - 6; walls(hv, b, H2, s);
    const top = roofFlat(hv, b, H2, s), aw = s.awning || [0x14a83b, WHITE], fw = [];
    if (L.under) gdoor(fr, L.under[0] - b[0] + 1, 26, 22, s);
    const skip0 = L.under ? [L.under[0] - b[0], L.under[1] - b[0]] : null;
    fw.push(...row(fr, 0, fr.len, WY[0], 2, 12, 16, s, { skip: skip0 ? [Math.min(da - 8, skip0[0]), Math.max(da + 20, skip0[1])] : [da - 8, da + 20], awning: aw, ac: s.ac }));
    for (const w of row(fr, 0, fr.len, WY[1], 2, 20, 16, s, { ac: s.ac })) { fw.push(w); fr.box(w.a0 + 9, w.y0, -2, w.a0 + 11, w.y0 + w.h, 0, s.trim); }   // paired sash windows upstairs
    hdoor(fr, da, s); let out;
    if (L.porch === 'enclosed') out = enclosed(fr, da - 10, da + 22, s);
    else { out = landing(fr, da - 6, da + 22, 13, da + 6, s, { rail: true }); awning(fr, da - 4, da + 16, FLOOR + 27, aw); }
    const adSide = (s.street === 'Jackson St' || s.street === 'Pine St' || s.street === 'Union Ave') && hash(s.seed, 231) < .65 ? (s.corner.L ? 'left' : s.corner.R ? 'right' : null) : null;
    if (adSide) { const g = hv.frame(adSide, b), w = Math.min(46, g.len - 12), a0 = (g.len - w) >> 1; if (hash(s.seed, 233) < .6) paintedAd(g, a0, WY[1] - 3, w, 22, null, WHITE, INK); else ghostSign(g, a0, H2 - 3, w, null, s.wall);
      const sides = sidesWindows(hv, b, s, WY, { only: ['back', adSide === 'left' ? 'right' : 'left'] }).concat(sidesWindows(hv, b, s, [WY[0]], { only: [adSide] }));
      return { fr, fw, sides, door: out.door ?? da + 6, plane: out.plane, out: out.d ?? out, top, eave: H2, chimney: 'none', encl: L.porch === 'enclosed' ? [da - 10, da + 22] : null }; }
    return { fr, fw, sides: sidesWindows(hv, b, s, WY), door: out.door ?? da + 6, plane: out.plane, out: out.d ?? out, top, eave: H2, chimney: 'none', encl: L.porch === 'enclosed' ? [da - 10, da + 22] : null };
  },
  aframe(hv, s, L) {
    const b = L.body, fr = hv.frame('front', b), da = L.door - b[0] - 6; walls(hv, b, FLOOR + 6, s);
    const top = roofAlong(hv, b, FLOOR + 6, 'v', () => [2, 1], { s, fascia: s.trim, ove: 3, ovg: 3, gable: s.wall });
    // the glass gable: tall windows filling the triangle over the door
    const n = fr.len, fw = [];
    for (let y = FLOOR + 30; y < FLOOR + 30 + 2 * (n >> 1) - 20; y += 2) { const half = (n >> 1) - Math.ceil((y - FLOOR - 6) / 2) - 4; if (half < 4) break;
      fr.box((n >> 1) - half, y, -1, (n >> 1) + half, y + 2, 0, (a) => (a % 8 === 0) ? s.trim : TOD.night && hash(s.seed, y >> 3) > .4 ? PAL.litHi : GLASS, TOD.night ? 3 : 1); }
    fw.push({ a0: (n >> 1) - 10, y0: FLOOR + 32, w: 20, h: 14 });
    hdoor(fr, da, s); const out = porch(fr, 1, n - 1, 20, da + 6, s, { deck: true });
    return { fr, fw, sides: [], door: da + 6, out, top, eave: FLOOR + 6, chimney: 'mid', span: [1, n - 1, 20] };
  },
};
// a cape's dormer on the front slope: a little wall with a window under its own gable → the window
function dormer(hv, b, a, y0, s) {
  const u = b[0] + a, v0 = b[1] + 2, w = 18, r = [u - (w >> 1), v0, u + (w >> 1), v0 + 22]; walls(hv, r, y0 + 26, s, { lap: false });
  roofAlong(hv, r, y0 + 26, 'v', () => [1, 1], { s, ove: 2, ovg: 2, fascia: s.trim });
  const fd = hv.frame('front', r), wd = hwin(fd, 4, y0 + 11, 10, 11, s, {}); return { ...wd, f: fd };
}
// a full front porch: deck, posts, rails, a roof (flat, shed, or its own gable), steps at the door
function porch(fr, a0, a1, D, dc, s, o = {}) {
  const deck = o.deck ? DECK : hash(s.seed, 91) < .5 ? 0x8f929b : DECK, post = o.piers ? s.trim : WHITE, yR = FLOOR + 27;
  fr.box(a0, 0, 1, a1, FLOOR, D, deck);
  const posts = [a0, a1 - 3]; for (let a = a0 + 24; a < a1 - 20; a += 24) if (Math.abs(a - dc) > 10) posts.push(a);
  if (!o.deck) for (const a of posts) { if (o.piers) { fr.box(a - 1, FLOOR, D - 5, a + 4, FLOOR + 9, D, 0x8a8c94); fr.box(a, FLOOR + 9, D - 4, a + 3, yR, D - 1, post); } else fr.box(a, FLOOR, D - 4, a + 3, yR, D - 1, post); }
  // rails: balusters every 2, a top rail, open at the steps
  fr.box(a0, FLOOR, D - 2, a1, FLOOR + 9, D - 1, (a, y) => Math.abs(a - dc) < 9 ? undefined : (y === FLOOR + 8 || a % 2 === 0) ? WHITE : undefined);
  if (o.deck) { for (const a of [a0, a1 - 1]) fr.box(a, FLOOR, 2, a + 1, FLOOR + 9, D, (aa, y, d) => (y === FLOOR + 8 || d % 3 === 0) ? WHITE : undefined); }
  else if (o.gable) { fr.box(a0 - 2, yR, 0, a1 + 2, yR + 2, D + 3, s.trim); for (let k = 0; ; k++) { const p0 = a0 - 2 + k * 2, p1 = a1 + 2 - k * 2; if (p1 - p0 < 2 || k > 30) break; fr.box(p0, yR + 2 + k, 0, p1, yR + 3 + k, D + 3, k % 2 ? shade(s.roof, .9) : s.roof); if (p1 - p0 > 8) fr.box(p0 + 3, yR + 2 + k, D + 1, p1 - 3, yR + 3 + k, D + 2, s.wall); } }
  else if (o.shed) { for (let k = 0; k < 4; k++) fr.box(a0 - 2, yR + k, 0, a1 + 2, yR + k + 1, D + 3 - k * 5, k ? shade(s.roof, k % 2 ? .9 : 1) : s.trim); }
  else { fr.box(a0 - 2, yR, 0, a1 + 2, yR + 2, D + 3, s.roof); fr.box(a0 - 2, yR - 1, D + 1, a1 + 2, yR, D + 3, s.trim); }
  fr.box(dc - 8, 0, D, dc + 8, 2, D + 3, deck); fr.box(dc - 8, 0, D + 3, dc + 8, 1, D + 6, CONC);
  return D + 6;
}
// an enclosed front porch (outer boroughs): a glassed box in front of the door with its own door and stoop → { d, door, plane }
function enclosed(fr, a0, a1, s) {
  const D = 20, y1 = FLOOR + 28, dc = (a0 + a1) >> 1;
  fr.box(a0, 0, 1, a1, y1, D, (a, y, d) => y < FLOOR ? FOUND : (y > FLOOR + 9 && y < FLOOR + 24 && (a > a0 && a < a1 - 1 && d === D - 1 || (a === a0 || a === a1 - 1) && d > 2 && d < D - 1) && (a - a0) % 7 && d % 7) ? GLASS : s.wall);
  fr.box(a0 + 1, FLOOR + 9, 1, a1 - 1, FLOOR + 24, D - 1, (a, y, d) => (a === a0 + 1 || a === a1 - 2 || d === D - 2) ? undefined : AIR);
  fr.box(a0 - 1, y1, 0, a1 + 1, y1 + 2, D + 2, s.trim);
  const door = hdoorAt(fr, dc - 6, D, s); fr.box(dc - 9, 0, D, dc + 15 - 6, FLOOR, D + 11, CONC); fr.box(dc - 6, 0, D + 11, dc + 6, 1, D + 14, CONC);
  return { d: D + 14, door: dc, plane: D - 1 };
}
// a door set in a projecting face (the enclosed porch's front, d = D − 1)
function hdoorAt(fr, a, D, s) { const y0 = FLOOR; fr.box(a - 1, y0, D - 1, a + 13, y0 + 26, D + 1, s.trim); fr.box(a, y0, D - 2, a + 12, y0 + 24, D + 1, AIR); fr.box(a, y0, D - 3, a + 12, y0 + 24, D - 2, (aa, y) => (y > y0 + 14 && y < y0 + 21 && aa > a + 2 && aa < a + 9) ? GLASS : s.door); return a + 6; }

// ── the lived-in front: foundation shrubs, a clipped hedge or a flower bed along the wall; porch chairs; a pot on the stoop (left of the
// door: the right side is the sim's safe spot)
const GRN = [0x2a9a48, 0x238a3e, 0x35b055], FLW = [0xe8232a, 0xff4fa3, 0xffe23a, 0xf7f7f2, 0xff7a1a, 0x7a3cff];
function plantings(fr, s, skip) {
  const kind = s.yard === 'garden' ? 'bed' : hash(s.seed, 201) < .3 ? 'hedge' : 'shrubs', fl = FLW[(hash(s.seed, 203) * FLW.length) | 0], free = (a0, a1) => a0 >= 2 && a1 <= fr.len - 2 && !skip.some(([p, q]) => a1 > p && a0 < q);
  for (let a = 2; a < fr.len - 2; a += kind === 'shrubs' ? 7 : 6) { const a1 = a + (kind === 'shrubs' ? 5 : 6); if (!free(a, a1)) continue;
    if (kind === 'hedge') fr.box(a, 0, 1, a1, 7, 5, (aa, y) => (y === 6 && (aa + a) % 3 === 0) ? GRN[2] : GRN[(aa + y) % 2]);
    else if (kind === 'bed') { fr.box(a, 0, 1, a1, 2, 6, 0x6b3a1e); fr.box(a, 2, 1, a1, 4, 6, (aa, y, d) => ((aa + d * 3 + y) % 4 === 0) ? FLW[(aa + d + (s.seed & 7)) % FLW.length] : ((aa + d) % 3 ? GRN[0] : undefined)); }
    else if (hash(a, s.seed, 205) < .7) { const h = 4 + ((hash(a, s.seed, 207) * 3) | 0); fr.box(a, 0, 1, a1, h, 5, (aa, y, d) => (y === h - 1 && (aa + d) % 2) ? GRN[2] : GRN[(aa + y + d) % 2]); if (hash(a, s.seed, 209) < .3) fr.set(a + 2, h, 3, fl); } }
}
function porchLife(fr, s, [a0, a1, D], dc) {
  const c = [WHITE, 0x2f5bff, 0xe8232a, 0x0b5a3a, 0xffc21a][(hash(s.seed, 211) * 5) | 0], chair = a => { fr.box(a, FLOOR, 5, a + 5, FLOOR + 4, 9, c); fr.box(a, FLOOR + 4, 4, a + 5, FLOOR + 9, 5, c); fr.box(a, FLOOR, 4, a + 1, FLOOR + 6, 9, c); fr.box(a + 4, FLOOR, 4, a + 5, FLOOR + 6, 9, c); };
  if (a0 + 12 < dc - 10) chair(a0 + 5); if (a1 - 10 > dc + 18) chair(a1 - 10);
  if (hash(s.seed, 213) < .5 && a1 - 18 > dc + 18) { fr.box(a1 - 18, FLOOR, 5, a1 - 15, FLOOR + 5, 8, 0x8a5a2a); fr.box(a1 - 18, FLOOR + 5, 5, a1 - 15, FLOOR + 6, 8, 0x3f8f3a); }   // a potted fern
}

// ── attached garage / carport / detached garage
function garageWing(hv, s, L, gr, detached) {
  const H = 26, T = hash(s.seed, 95);
  walls(hv, gr, H, s, { lap: s.lap && !detached });
  const top = detached || T < .45 ? roofAlong(hv, gr, H, 'v', () => [1, 2], { s, ove: 2, ovg: 3, fascia: s.trim }) : T < .8 ? roofHip(hv, gr, H, { s, ov: 2, run: 2, fascia: s.trim }) : roofAlong(hv, gr, H, 'u', () => [1, 2], { s, ove: 3, ovg: 2, fascia: s.trim });
  const g = hv.frame('front', gr), gw = Math.min(26, g.len - 6); gdoor(g, (g.len - gw) >> 1, gw, 22, s);
  if (!detached && hash(s.seed, 97) < .35 && s.st.name !== 'Jackson St') { const a = g.len >> 1; g.box(a - 6, H - 1, 1, a + 6, H + 8, 2, WHITE); g.box(a - 2, H + 1, 2, a + 2, H + 5, 3, 0xff7a1a); g.box(a - 2, H, 3, a + 2, H + 1, 6, 0xff7a1a); }   // a hoop over the garage door
  for (const k of ['left', 'right', 'back']) { const f = hv.frame(k, gr); if (f.len > 30 && hash(s.seed, k.length) < .6) hwin(f, (f.len >> 1) - 6, 10, 12, 10, s, {}); }
  return top;
}
function carport(hv, s, cr, eave) {
  const [u0, v0, u1, v1] = cr, y1 = eave - 2, c = [WHITE, 0xd3d4d7, s.trim][(hash(s.seed, 99) * 3) | 0];
  for (const [u, v] of [[u0, v0 + 2], [u1 - 2, v0 + 2], [u0, v1 - 4], [u1 - 2, v1 - 4]]) { hv.box(u, 0, v, u + 2, y1, v + 2, c); hv.keep(u - .3, v - .3, u + 2.3, v + 2.3, 0, y1); }
  hv.box(u0 - 1, y1, v0, u1 + 1, y1 + 2, v1, (u, y, v) => (v % 4 === 0) ? shade(s.roof, .9) : s.roof); hv.box(u0 - 1, y1 - 1, v0, u1 + 1, y1, v0 + 1, s.trim);
  hv.keep(u0 - 1, v0, u1 + 1, v1, y1 - 1, y1 + 2, 'carport');
}

// ════════════════════════ build one house (its volume, masses, keeps, door zone) and hand its anchor to the sim-state layer
export function buildHouse(ctx, s) {
  const L = layoutOf(s), b = L.body, F = frameOf(s.l);
  const parts = [b, L.garage && !L.detached ? L.garage : null, L.carport].filter(Boolean);
  const U0 = Math.min(...parts.map(p => p[0])) - 8, U1 = Math.max(...parts.map(p => p[2])) + 8, V0 = b[1] - 34, V1 = Math.max(...parts.map(p => p[3])) + 6;
  const hv = hvol(s, U0, V0, U1, V1, 140), res = TYPE[s.type](hv, s, L);
  let top = res.top;
  if (L.garage && !L.detached) top = Math.max(top, garageWing(hv, s, L, L.garage, false));
  if (L.carport) carport(hv, s, L.carport, res.eave > H1 ? H1 : res.eave);
  // the chimney: up a gable end (outside the wall, on the side away from the drive), up a side wall, or through the roof
  if (s.chimney && res.chimney !== 'none') { const R = s.driveSide === 'R', cv = (b[1] + b[3]) >> 1;
    if (res.chimney === 'mid') chimney(hv, ((b[0] + b[2]) >> 1) - 3, cv - 3, ((b[0] + b[2]) >> 1) + 3, cv + 3, res.top + 4);
    else { const u0 = R ? b[0] - 6 : b[2], v0 = res.chimney === 'end' ? cv - 4 : b[1] + 12; if (!L.garage || L.detached || (R ? u0 >= 0 : u0 + 6 <= s.W10)) { chimney(hv, u0, v0, u0 + 6, v0 + 8, res.top + (res.chimney === 'end' ? 3 : 2)); hv.keep(u0, v0, u0 + 6, v0 + 8, 0, 30); } } }
  if (s.dish) roofDish(hv, s, b);
  if (s.lights) { const fr = res.fr; fr.box(0, res.eave - 1, 1, fr.len, res.eave, 3, (a) => [0xe8232a, 0x14a83b, 0xffe23a, 0x2f5bff][(a >> 1) % 4], TOD.night ? 3 : 1); }
  { const fr = res.fr, dc = res.door, skip = [[dc - 17, dc + 17]]; if (res.span) skip.push([res.span[0] - 2, res.span[1] + 2]); if (res.encl) skip.push([res.encl[0] - 2, res.encl[1] + 2]);
    if (L.under) skip.push([L.under[0] - b[0] - 3, L.under[1] - b[0] + 3]); if (s.type === 'ranch') { skip.push([0, 0]); }
    if (s.type !== 'split' && s.type !== 'aframe') plantings(fr, s, skip);
    if (res.span && s.type !== 'aframe') porchLife(fr, s, res.span, dc);
    else if (!res.encl && s.type !== 'split') { fr.box(dc - 11, FLOOR, 3, dc - 8, FLOOR + 4, 6, [0xd9643a, 0xf7f7f2, 0x2f5bff][s.seed % 3]); fr.box(dc - 11, FLOOR + 4, 3, dc - 8, FLOOR + 7, 6, 0x2a9a48); } }
  // solar panels on the back slope
  if (s.solar && (s.type === 'colonial' || s.type === 'cape' || s.type === 'ranch' || s.type === 'hip')) { const mv = (b[1] + b[3]) >> 1; onRoof(hv, b[0] + 8, mv + 3, b[2] - 8, b[3] - 1, (u, v) => ((u - b[0]) % 9 === 0 || (v - mv) % 7 === 0) ? 0xc9ced6 : 0x1b2a55, 1); }
  top = Math.max(top, res.top + 8);
  // register the masses (props keep clear, people may stand on the roof), then mesh at the end of the block
  if (s.billboard) ctx.mass(hv.V, hv.wrect(b[0], b[1], b[2], b[3]), { top: SIDE + (res.eave + 1) * CV, roofY: SIDE + (res.eave + 1) * CV });
  else ctx.mass(hv.V, hv.wrect(b[0], b[1], b[2], b[3]), { top: SIDE + top * CV, roofY: SIDE + res.eave * CV });
  if (L.garage && !L.detached) ctx.mass(hv.V, hv.wrect(...L.garage), { top: SIDE + 42 * CV, roofY: SIDE + 26 * CV });
  // the detached garage at the back of the drive: its own volume and mass
  if (L.detached) { const g = L.garage, gv = hvol(s, g[0] - 5, g[1] - 4, g[2] + 5, g[3] + 3, 60); const gt = garageWing(gv, s, L, g, true); ctx.mass(gv.V, gv.wrect(...g), { top: SIDE + (gt + 2) * CV, roofY: SIDE + 26 * CV }); }
  // the door: its clear zone and the anchor
  const f = F.f, plane = res.plane ?? 0, doorU = res.doorU ?? b[0] + res.door, wallV = b[1] - plane, dx = F.x(doorU / 10), dz = F.z(wallV / 10);
  REG.door(dx, dz + f * .5, f > 0 ? 0 : 2);
  anchor(ctx, s, L, hv, res, { dx, dz, wallV });
  return { hv, res, L };
}

// the anchor (simstate/layer.js drawLot): door 0.55 m out from the door's wall plane, the FOR RENT sign spot in the front yard, the front
// wall, every window with its own facing (so the whole house goes dark when its owner sleeps), the roof line, the house rect
function anchor(ctx, s, L, hv, res, { dx, dz, wallV }) {
  const F = hv.F, f = F.f, b = L.body, r2 = v => +v.toFixed(2);
  const winOf = (fr, w) => { const [x0, z0] = fr.xz(w.a0, 0), [x1, z1] = fr.xz(w.a0 + w.w - 1, 0), V = fr.V, [nx, nz] = NRM[fr.side];
    return [r2(V.org[0] + ((x0 + x1) / 2 + .5) * V.s + nx * .12), r2(SIDE + (w.y0 + w.h / 2) * CV), r2(V.org[2] + ((z0 + z1) / 2 + .5) * V.s + nz * .12), r2(w.w * CV), r2(w.h * CV), ROT[fr.side]]; };
  const front = [], more = [];
  for (const w of res.fw) { const e = winOf(w.f || res.fr, w); (e[5] === (f > 0 ? 0 : 2) ? front : more).push(e); }
  for (const [fr, list] of res.sides) for (const w of list) more.push(winOf(fr, w));
  const sign = s.sign || [r2(F.x(L.sign ? L.sign[0] / 10 : 1.6)), r2(F.z(.8))];
  ctx.anchor.lot(s.id, { tier: 'house', rot: f > 0 ? 0 : 2, face: [0, f], door: [r2(dx), SIDE, r2(dz + f * .55)], sign, yard: [r2(F.x((b[0] + b[2]) / 20)), r2(F.z((b[3] + s.D10) / 20))],
    wall: [r2(F.x((b[0] + b[2]) / 20)), r2(SIDE + 1.5), r2(F.z(b[1] / 10) + f * .02), r2((b[2] - b[0]) * CV), 3],
    windows: front.map(w => w.slice(0, 5)).concat(more), roof: r2(SIDE + res.eave * CV), house: hv.wrect(b[0], b[1], b[2], b[3]) });
}
