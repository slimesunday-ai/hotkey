// CARS pass (2026-09-28) · the fleet's bodies, drawn in city voxels (0.1 m). Worker-safe: no three, no DOM.
// Frame of every body Vol: x 0…W+1 (the body is x 1…W, 1.8 m; x 0 and W+1 hold only the mirrors), y up from the road, z 0 = rear
// bumper … L−1 = front bumper, facing +z. The car's LEFT (the driver's side) is +x. Wheels are NOT drawn here: the body gets round
// wheel arches cut to the wheel radius (arch()), and the wheels are separate 0.05 m parts (index.js wheelVol) that spin in them.
import { PAL, shade } from '../style.js';
import { textMask } from '../vox.js';
import { mask } from '../signage/type/index.js';

export const C = {
  glass: 0x2f5694, glint: 0xbfe4ff, tint: 0x161c2c, trim: 0x26262d, liner: 0x1f1f25, chrome: 0xc9ced6, plate: 0xf7f7f2, ink: PAL.ink,
  head: 0xfff6d0, headOff: 0xdfe6ee, tail: 0xd7141a, tailOff: 0x9a1a22, amber: 0xff9a1a, white: PAL.white, cream: PAL.cream,
  skin: [0xf2c09a, 0xc98a5a, 0x8d5a3a, 0xe8b48a], hair: [0x2a1a12, 0x17171b, 0x6b3a1e, 0xe0b040],
};
const GL = 1, MT = 2, LIT = 3;

// ── lettering without audit records: livery paint, not signage (it rides on a car, never faces a board rule)
// du: the direction the text reads in, as seen from outside the face: +x face → [0, −1], −x face → [0, 1], rear (z 0) → [−1, 0], front → [1, 0]
export function paint(V, s, x0, z0, ytop, du, c, sc = 1, l = 0) {
  const t = textMask(s); for (let j = 0; j < 7; j++) for (let i = 0; i < t.w; i++) if (t.at(i, j)) for (let a = 0; a < sc; a++) for (let b = 0; b < sc; b++) {
    const u = i * sc + a; V.set(x0 + du[0] * u, ytop - j * sc - b, z0 + du[1] * u, c, l); }
  return t.w * sc;
}
const textW = (s, sc = 1) => textMask(s).w * sc;
// a type-library mask (signage/type) painted the same way: rows top-down from ytop
function paintM(V, M, x0, z0, ytop, du, c, l = 0) { for (let j = 0; j < M.h; j++) for (let u = 0; u < M.w; u++) if (M.at(u, j)) V.set(x0 + du[0] * u, ytop - j, z0 + du[1] * u, c, l); return M.w; }

// ── the shared hull: lower body, bumpers, greenhouse (glass cabin, solid: no hollow), pillars, roof, recessed side glass
// o: { L, W, clr, belt, roof, cab: [c0, c1], rake: [rear, front], c, roofC, glass, tumble, bumper, bl (bumper layer), pillars: [z…] }
export function hull(V, o) {
  const { L, W = 18, clr = 3, belt = 10, roof = 20, cab: [c0, c1], rake: [rr, rf] = [3, 5], c, roofC = c, glass = C.glass, tumble = 1, bumper = C.trim, bl = 0 } = o;
  const X0 = 1, X1 = W + 1, gx0 = X0 + tumble, gx1 = X1 - tumble;
  V.box(X0, clr, 1, X1, belt, L - 1, c);
  V.box(X0, clr, 0, X1, clr + 2, 1, bumper, bl); V.box(X0, clr, L - 1, X1, clr + 2, L, bumper, bl);
  for (const x of [X0, X1 - 1]) for (const z of [1, L - 2]) for (let y = clr + 2; y < belt; y++) V.del(x, y, z);   // rounded corners
  for (let x = X0; x < X1; x++) { V.del(x, belt - 1, L - 2); V.del(x, belt - 1, 1); }                          // softened nose + tail
  const zr = y => { const t = (y - belt) / Math.max(1, roof - belt - 1); return [Math.round(c0 + rr * t), Math.round(c1 - rf * t)]; };
  if (roof > belt) {
    for (let y = belt; y < roof; y++) { const [a, b] = zr(y); V.box(gx0, y, a, gx1, y + 1, b, y === belt ? c : y === roof - 1 ? roofC : glass, y > belt && y < roof - 1 ? GL : 0); }
    for (let y = belt + 1; y < roof - 1; y++) { const [a, b] = zr(y);
      for (const x of [gx0, gx1 - 1]) { V.set(x, y, a, c); V.set(x, y, b - 1, c); }                              // C and A pillars
      for (const x of [gx0, gx1 - 1]) for (let z = a + 1; z < b - 1; z++) if (!(o.pillars || []).includes(z)) V.del(x, y, z);   // side glass recessed one voxel
      for (const z of o.pillars || []) for (const x of [gx0, gx1 - 1]) V.set(x, y, z, c);
      const g = (y - belt) % 4; for (let x = gx0 + 1; x < gx1 - 1; x++) if ((x + y) % 9 === g) V.set(x, y, b - 1, C.glint, GL); }   // windshield glint
  }
  return { X0, X1, gx0, gx1, zr };
}
// round wheel arches: the body is cut to a cylinder round each axle (clearance for a wheel of radius r m spinning in it), the cut's edge
// is a dark liner (reads as the arch outline from the side). wz: axle positions (voxels from the rear), depth: how far in the cut goes
export function arch(V, wz, r, W = 18, depth = 4) {
  const rv = r / .1, R = rv + .8;
  for (const z0 of wz) for (const [xa, xb] of [[1, 1 + depth], [W + 1 - depth, W + 1]]) for (let x = xa; x < xb; x++)
    for (let y = 0; y < rv * 2 + 3; y++) for (let z = Math.floor(z0 - R - 2); z <= z0 + R + 2; z++) { const d = Math.hypot(y + .5 - rv, z + .5 - z0);
      if (d <= R) V.del(x, y, z); else if (d <= R + 1.1 && V.has(x, y, z)) V.set(x, y, z, C.liner); }
}
// lamps, recorded on V.meta so the brake-light part can sit exactly over the tail lamps
export function lamps(V, o, lit) {
  const { W = 18, belt = 10, zf, zb = 1, hy = belt - 4, hh = 2, hw = 3, ty = belt - 4, th = 2, tw = 3, tail = C.tail } = o, X0 = 1, X1 = W + 1, m = V.meta ??= { tails: [] };
  const HL = lit ? LIT : GL, hc = lit ? C.head : C.headOff, tc = lit ? tail : C.tailOff;
  V.box(X0 + 1, hy, zf, X0 + 1 + hw, hy + hh, zf + 1, hc, HL); V.box(X1 - 1 - hw, hy, zf, X1 - 1, hy + hh, zf + 1, hc, HL);
  for (const [x0, x1] of [[X0, X0 + tw], [X1 - tw, X1]]) { V.box(x0, ty, zb, x1, ty + th, zb + 1, tc, lit ? LIT : GL); m.tails.push([x0, ty, x1, ty + th, zb]); }
}
export function plate(V, W, y, z) { V.box(W / 2 - 1, y, z, W / 2 + 3, y + 2, z + 1, C.plate); V.set(W / 2, y + 1, z, C.ink); V.set(W / 2 + 2, y, z, C.ink); }
export function mirrors(V, W, y, z, c) { for (const x of [0, W]) V.box(x, y, z, x + 2, y + 2, z + 2, c); }   // two voxels deep: they touch the cabin sill
export function doorLine(V, W, z, y0, y1, handle = C.chrome) { for (const x of [1, W]) { for (let y = y0; y < y1; y++) if (V.has(x, y, z)) V.set(x, y, z, C.trim); V.box(x, y1 - 2, z - 3, x + 1, y1 - 1, z - 1, handle, MT); } }
// a big-head driver seen through the glass: a face and hair on the side window (driver's side, +x) and the windshield
export function driver(V, h, o) {
  const { W = 18, zs, ytop, variant = 0 } = o, skin = C.skin[variant % 4], hair = C.hair[(variant >> 1) % 4], xs = h.gx1 - 2;
  for (let y = ytop - 5; y < ytop; y++) for (let z = zs - 2; z < zs + 2; z++) if (V.has(xs, y, z)) V.set(xs, y, z, y >= ytop - 2 ? hair : skin, 0);
  for (let y = ytop - 5; y < ytop; y++) { const b = h.zr(y)[1] - 1; for (let x = Math.round(W / 2) + 2; x < Math.round(W / 2) + 6; x++) if (V.has(x, y, b)) V.set(x, y, b, y >= ytop - 2 ? hair : skin, 0); }
}
// a one-box upper (vans, trucks, the ice cream truck): a box body from y0 to y1 over z0…z1, windshield raked at the front
export function boxUpper(V, o) {
  const { W = 18, y0, y1, z0, z1, c, rake = 3, glass = C.glass, gy = y0 + 1 } = o;
  for (let y = y0; y < y1; y++) { const t = Math.max(0, (y - gy) / Math.max(1, y1 - gy - 1)); V.box(1, y, z0, W + 1, y + 1, Math.round(z1 - rake * t), c); }
  return y => Math.round(z1 - rake * Math.max(0, (y - gy) / Math.max(1, y1 - gy - 1)));   // front face z (exclusive) at height y
}

// ═════════ the models. Each: (V, o) → draws the body. o: { variant, lights, driver }
const SEDAN_C = [0xe8232a, 0x2f5bff, 0xf7f7f2, 0x17171b, 0x25b84c, 0x8a3cff, 0xff7a1a, 0x12b3a0, 0xa7a9b1, 0x3fa9f5];
export const sedan = (V, o) => {
  const c = SEDAN_C[o.variant % SEDAN_C.length], L = 42, h = hull(V, { L, clr: 3, belt: 10, roof: 20, cab: [12, 31], rake: [3, 3], c, pillars: [22], bumper: c === 0x17171b ? C.chrome : C.trim, bl: c === 0x17171b ? MT : 0 });
  lamps(V, { zf: L - 2, belt: 10 }, o.lights); V.box(7, 5, L - 2, 13, 7, L - 1, C.trim); plate(V, 18, 4, 1);
  doorLine(V, 18, 22, 4, 10); doorLine(V, 18, 31, 4, 10); mirrors(V, 18, 10, 29, c); arch(V, [8, 34], .4);
  if (o.driver) driver(V, h, { zs: 26, ytop: 19, variant: o.variant });
};
export const taxi = (V, o) => {
  const c = 0xffc21a, L = 42, h = hull(V, { L, clr: 3, belt: 10, roof: 20, cab: [12, 31], rake: [3, 3], c, pillars: [22] });
  for (let z = 12; z < 31; z++) for (const x of [1, 18]) { V.set(x, 8, z, ((z >> 1) & 1) ? C.ink : C.white); V.set(x, 7, z, ((z >> 1) & 1) ? C.white : C.ink); }   // checker band
  lamps(V, { zf: L - 2, belt: 10 }, o.lights); V.box(7, 5, L - 2, 13, 7, L - 1, C.trim); plate(V, 18, 4, 1);
  doorLine(V, 18, 22, 3, 10); mirrors(V, 18, 10, 29, c); arch(V, [8, 34], .4);
  // the roof sign: CAB both ways, lit from inside at night
  V.box(8, 20, 19, 12, 21, 21, C.trim); V.box(3, 21, 18, 17, 26, 22, 0xfff6d0, o.night ? LIT : GL); V.box(3, 21, 18, 17, 22, 22, C.ink);
  (V.fine ??= []).push({ text: 'TAXI', c: C.ink, x: 10, y: 25.6, zf: 22, zb: 18 });   // 0.05 m letters on both faces (index.js fineOf)
  if (o.driver) driver(V, h, { zs: 26, ytop: 19, variant: o.variant + 1 });
};
export const livery = (V, o) => {
  const c = 0x17171b, L = 46, h = hull(V, { L, clr: 3, belt: 10, roof: 19, cab: [13, 33], rake: [3, 3], c, glass: C.tint, pillars: [23], bumper: C.chrome, bl: MT });
  lamps(V, { zf: L - 2, belt: 10, hw: 2 }, o.lights); V.box(5, 4, L - 2, 13, 8, L - 1, C.chrome, MT); for (let x = 6; x < 12; x += 2) V.box(x, 5, L - 2, x + 1, 7, L - 1, C.trim);
  V.box(1, 6, 2, 19, 7, L - 2, (x, y, z) => (x === 1 || x === 18) ? C.chrome : undefined, MT);   // chrome rub strip
  plate(V, 18, 4, 1); doorLine(V, 18, 23, 4, 10); doorLine(V, 18, 33, 4, 10); mirrors(V, 18, 10, 31, c); arch(V, [9, 37], .4);
  V.box(10, 10, 42, 11, 12, 43, C.chrome, MT);   // the hood ornament
  if (o.driver) driver(V, h, { zs: 28, ytop: 18, variant: o.variant + 2 });
};
const DELI = ['DELI', 'LUCKY', '404', 'NITE'];
export const van = (V, o) => {
  const c = 0xf7f7f2, L = 44, s = [0xe8232a, 0x14a83b, 0x2f5bff, 0xff7a1a][o.variant % 4];
  V.box(1, 3, 1, 19, 11, 43, c); V.box(1, 3, 0, 19, 5, 1, C.trim); V.box(1, 3, 43, 19, 5, 44, C.trim);
  const fz = boxUpper(V, { y0: 11, y1: 24, z0: 1, z1: 37, c, rake: 2, gy: 12 });
  for (let y = 12; y < 23; y++) { const b = fz(y); for (let x = 2; x < 18; x++) V.set(x, y, b - 1, C.glass, GL); if (y > 13) for (const x of [1, 18]) V.box(x, y, 31, x + 1, y + 1, b - 1, C.glass, GL); }
  for (let y = 12; y < 23; y++) for (const x of [1, 18]) { V.set(x, y, 30, C.trim); }
  V.box(1, 9, 2, 19, 10, 30, (x) => x === 1 || x === 18 ? s : undefined); V.box(1, 23, 1, 19, 24, 34, 0xe6e1d6);
  const word = DELI[(o.variant >> 2) % DELI.length], w = textW(word); paint(V, word, 18, 3 + Math.round((28 + w) / 2), 20, [0, -1], s); paint(V, word, 1, 3 + Math.round((28 - w) / 2), 20, [0, 1], s);
  lamps(V, { zf: 42, belt: 11, hy: 7, ty: 15, th: 3, tw: 2 }, o.lights); V.box(7, 5, 42, 13, 9, 43, C.trim); plate(V, 18, 5, 0);
  V.box(3, 12, 0, 17, 23, 1, (x, y) => x === 10 ? C.trim : c); mirrors(V, 18, 14, 33, C.trim); arch(V, [8, 36], .4);
  if (o.driver) { for (let y = 17; y < 22; y++) for (let z = 33; z < 36; z++) V.set(18, y, z, y >= 20 ? C.hair[o.variant % 4] : C.skin[o.variant % 4]); }
};
export const boxTruck = (V, o) => {
  const L = 66, c = [0xe8232a, 0x2f5bff, 0x14a83b, 0x17171b][o.variant % 4], box = 0xf7f7f2;
  V.box(1, 4, 1, 19, 7, 65, C.trim);   // the frame
  V.box(1, 7, 1, 19, 31, 48, box); V.box(1, 30, 1, 19, 31, 48, 0xd3d4d7); V.box(1, 7, 0, 19, 31, 1, (x, y) => (y % 3 === 0 || x === 1 || x === 18) ? 0xb0b2b8 : 0xd3d4d7, MT);   // the box + roll-up door
  V.box(1, 11, 2, 19, 13, 47, (x) => x === 1 || x === 18 ? c : undefined);
  { const M = mask('deli', 'HAULR', { big: true }), w = M.w; paintM(V, M, 18, 24 + Math.round(w / 2), 26, [0, -1], c); paintM(V, M, 1, 24 - Math.round(w / 2), 26, [0, 1], c); }   // the deli face's big cut, 37 wide: it fits the 47-long box (the 5×7 at ×2 was 58 and ran off both ends)
  V.box(1, 7, 49, 19, 14, 65, c); const fz = boxUpper(V, { y0: 14, y1: 26, z0: 49, z1: 63, c, rake: 3, gy: 15 });
  for (let y = 16; y < 24; y++) { const b = fz(y); for (let x = 2; x < 18; x++) V.set(x, y, b - 1, C.glass, GL); for (const x of [1, 18]) V.box(x, y, 55, x + 1, y + 1, b - 2, C.glass, GL); }
  V.box(1, 4, 65, 19, 7, 66, C.chrome, MT); V.box(5, 8, 64, 15, 12, 65, C.trim);
  const m = V.meta ??= { tails: [] }; V.box(2, 8, 0, 4, 12, 1, o.lights ? C.tail : C.tailOff, o.lights ? LIT : GL); V.box(16, 8, 0, 18, 12, 1, o.lights ? C.tail : C.tailOff, o.lights ? LIT : GL); m.tails.push([2, 8, 4, 12, 0], [16, 8, 18, 12, 0]);
  V.box(2, 9, 64, 5, 12, 65, o.lights ? C.head : C.headOff, o.lights ? LIT : GL); V.box(15, 9, 64, 18, 12, 65, o.lights ? C.head : C.headOff, o.lights ? LIT : GL);
  V.box(1, 26, 50, 19, 27, 60, C.trim); mirrors(V, 18, 18, 60, C.trim); arch(V, [12, 57], .45);
  if (o.driver) for (let y = 18; y < 23; y++) for (let z = 58; z < 61; z++) V.set(18, y, z, y >= 21 ? C.hair[o.variant % 4] : C.skin[o.variant % 4]);
};
const PICK_C = [0xe8232a, 0x1f5c4a, 0xc49a6c, 0x2a3a7a, 0xf7f7f2, 0xb0572a];
export const pickup = (V, o) => {
  const c = PICK_C[o.variant % PICK_C.length], L = 48, h = hull(V, { L, clr: 4, belt: 11, roof: 21, cab: [22, 34], rake: [0, 4], c, bumper: C.chrome, bl: MT });
  V.clear(2, 7, 2, 18, 11, 21); V.box(2, 7, 2, 18, 8, 21, shade(c, .7));   // the open bed
  const v = o.variant % 3; if (v === 0) V.box(2, 8, 18, 18, 12, 21, C.chrome, MT);   // toolbox across the bed
  else if (v === 1) { V.box(3, 8, 5, 12, 11, 15, 0x2f7a3a); V.box(4, 11, 6, 11, 12, 14, 0x2f7a3a); } else { V.box(3, 8, 4, 8, 12, 9, 0xa4652f); V.box(10, 8, 11, 16, 11, 17, 0xa4652f); }   // tarp / crates
  lamps(V, { zf: L - 2, belt: 11, hy: 7 }, o.lights); V.box(6, 5, L - 2, 14, 9, L - 1, C.chrome, MT); V.box(7, 6, L - 2, 13, 8, L - 1, C.trim); plate(V, 18, 5, 1);
  doorLine(V, 18, 34, 5, 11); mirrors(V, 18, 11, 32, C.trim); arch(V, [9, 38], .4);
  if (o.driver) driver(V, h, { zs: 28, ytop: 20, variant: o.variant });
};
const LOW_C = [0x8a3cff, 0xe83b5b, 0x12b3a0, 0x2f5bff, 0xff4fa3];
export const lowrider = (V, o) => {
  const c = LOW_C[o.variant % LOW_C.length], L = 50, h = hull(V, { L, clr: 2, belt: 8, roof: 15, cab: [16, 33], rake: [5, 4], c, roofC: 0xf7f7f2, pillars: [], bumper: C.chrome, bl: MT });
  for (let z = 36; z < 47; z++) { V.set(5 + ((z * 3) >> 3) % 2, 7, z, PAL.gold, MT); V.set(14 - ((z * 3) >> 3) % 2, 7, z, PAL.gold, MT); }   // gold pinstripe on the hood
  V.box(1, 5, 2, 19, 6, L - 2, (x) => (x === 1 || x === 18) ? PAL.gold : undefined, MT);
  lamps(V, { zf: L - 2, belt: 8, hy: 5 }, o.lights); V.box(6, 3, L - 2, 14, 6, L - 1, C.chrome, MT); plate(V, 18, 3, 1);
  for (let x = 6; x < 15; x++) for (let y = 2; y < 11; y++) { const d = Math.hypot(x + .5 - 10.5, y + .5 - 6.5); if (d <= 4.3) V.set(x, y, 0, d <= 1.6 ? C.chrome : d <= 2.6 ? 0xf7f7f2 : C.trim, d <= 1.6 ? MT : 0); }   // continental kit: the spare on the bumper
  doorLine(V, 18, 25, 3, 8); mirrors(V, 18, 8, 31, C.chrome); arch(V, [9, 40], .35);
  if (o.driver) driver(V, h, { zs: 27, ytop: 15, variant: o.variant + 3 });
};
const BEAT_C = [0xb0572a, 0x3a7d44, 0x6d707a, 0x9b4f3a, 0x2f5bff, 0xc49a6c];
export const beater = (V, o) => {
  const c = BEAT_C[o.variant % BEAT_C.length], L = 36, h = hull(V, { L, clr: 3, belt: 10, roof: 20, cab: [7, 27], rake: [1, 6], c, pillars: [18] });
  const door = BEAT_C[(o.variant + 2) % BEAT_C.length]; V.box(18, 4, 18, 19, 10, 26, door);   // mismatched door (left side)
  V.box(4, 9, 29, 12, 10, 34, 0x9a9aa2); V.box(2, 7, 30, 5, 9, 33, 0x9a9aa2);   // primer on the hood
  for (const [x, y, z] of [[1, 5, 10], [1, 6, 11], [18, 4, 30], [1, 8, 28]]) V.set(x, y, z, 0x7a3a1e);   // rust
  V.del(1, 7, 14); V.del(1, 7, 15);   // a dent
  lamps(V, { zf: L - 2, belt: 10 }, o.lights); V.box(6, 5, L - 2, 12, 7, L - 1, C.trim); plate(V, 18, 4, 1);
  V.box(16, 6, 1, 19, 8, 2, 0xc9ced6); V.set(17, 7, 1, 0x9a9aa2);   // a taped tail lamp (the tape over it, left)
  doorLine(V, 18, 18, 4, 10); mirrors(V, 18, 10, 25, C.trim); V.del(19, 11, 26); arch(V, [7, 29], .35);
  if (o.driver) driver(V, h, { zs: 22, ytop: 19, variant: o.variant + 1 });
};
export const cruiser = (V, o) => {
  const k = C.ink, w = C.white, L = 44, h = hull(V, { L, clr: 3, belt: 10, roof: 20, cab: [13, 32], rake: [3, 3], c: k, roofC: w, pillars: [23] });
  V.box(1, 4, 13, 19, 10, 33, (x) => (x === 1 || x === 18) ? w : undefined);   // black-and-white: white doors
  for (const x of [1, 18]) { paint(V, 'P9', x, x === 18 ? 25 : 20, 9, x === 18 ? [0, -1] : [0, 1], k); }
  lamps(V, { zf: L - 2, belt: 10 }, o.lights); V.box(7, 5, L - 2, 13, 7, L - 1, C.trim); plate(V, 18, 4, 1);
  V.box(3, 3, L - 1, 17, 8, L, C.trim); V.box(3, 3, L - 1, 17, 4, L, C.trim);   // push bar
  V.box(4, 20, 19, 16, 21, 25, C.trim); V.box(4, 21, 19, 9, 23, 25, 0xff2a2a, o.night ? LIT : GL); V.box(11, 21, 19, 16, 23, 25, 0x2f7bff, o.night ? LIT : GL); V.box(9, 21, 19, 11, 23, 25, C.chrome, MT);
  doorLine(V, 18, 23, 4, 10); mirrors(V, 18, 10, 30, k); V.box(19, 11, 30, 20, 13, 31, C.chrome, MT); arch(V, [8, 36], .4);
  if (o.driver) driver(V, h, { zs: 27, ytop: 19, variant: o.variant + 2 });
};
export const icecream = (V, o) => {
  const L = 50, c = 0xf7f7f2, p = 0xff4fa3, cy = 0x2de2e6;
  V.box(1, 3, 1, 19, 12, 49, c); V.box(1, 3, 0, 19, 5, 1, C.chrome, MT); V.box(1, 3, 49, 19, 5, 50, C.chrome, MT);
  V.box(1, 12, 1, 19, 27, 38, c); const fz = boxUpper(V, { y0: 12, y1: 24, z0: 38, z1: 44, c, rake: 3, gy: 13 });
  for (let y = 14; y < 23; y++) { const b = fz(y); for (let x = 2; x < 18; x++) V.set(x, y, b - 1, C.glass, GL); for (const x of [1, 18]) V.box(x, y, 39, x + 1, y + 1, b - 1, C.glass, GL); }
  V.box(1, 24, 38, 19, 27, 44, c);
  V.box(1, 9, 1, 19, 11, 49, (x) => (x === 1 || x === 18) ? p : undefined); V.box(1, 11, 1, 19, 12, 49, (x) => (x === 1 || x === 18) ? cy : undefined);
  V.box(1, 26, 1, 19, 27, 38, (x) => (x === 1 || x === 18) ? p : undefined);
  // service window on the kerb side (−x, the right), with a little awning and a menu of pops
  V.box(1, 14, 12, 2, 22, 30, C.tint, GL); V.box(0, 22, 11, 1, 23, 31, p); V.box(1, 13, 11, 2, 14, 31, C.chrome, MT);
  for (const [z, col] of [[4, 0xffe23a], [7, 0x6cff4a], [32, 0xe8232a], [35, 0x8a3cff]]) V.box(1, 17, z, 2, 21, z + 2, col);
  paint(V, 'KOOL', 18, 18 + 12, 25, [0, -1], p); paint(V, 'KONE', 18, 18 + 12, 17, [0, -1], cy);
  // the cone on the roof: a waffle cone and a pink swirl
  for (let y = 27; y < 35; y++) { const r = 1 + (y - 27) * .45; for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) if (Math.hypot(x, z) <= r) V.set(10 + x, y, 18 + z, ((x + z + y) & 1) ? 0xd9a35a : 0xc48a3e); }
  for (let y = 35; y < 40; y++) { const r = 4.2 - (y - 35) * .8; for (let x = -4; x <= 4; x++) for (let z = -4; z <= 4; z++) if (Math.hypot(x, z) <= r) V.set(10 + x, y, 18 + z, (y & 1) ? p : 0xffb3d6); }
  lamps(V, { zf: 48, belt: 12, hy: 8 }, o.lights); V.box(7, 5, 48, 13, 9, 49, C.chrome, MT); plate(V, 18, 5, 0);
  mirrors(V, 18, 14, 40, C.trim); arch(V, [9, 42], .4);
  if (o.driver) for (let y = 17; y < 22; y++) for (let z = 40; z < 42; z++) V.set(18, y, z, y >= 20 ? C.hair[o.variant % 4] : C.skin[o.variant % 4]);
};
const SUPER_C = [0x6cff4a, 0xff7a1a, 0x8c52ff, 0xffc21a, 0xf7f7f2, 0xff4fa3];
export const supercar = (V, o) => {
  const c = SUPER_C[o.variant % SUPER_C.length], L = 44, h = hull(V, { L, clr: 2, belt: 8, roof: 13, cab: [14, 30], rake: [6, 7], c, glass: C.tint, roofC: C.ink });
  for (let z = 31; z < L; z++) { const top = Math.round(8 - (z - 31) * .3); for (let x = 1; x < 19; x++) for (let y = top; y < 8; y++) V.del(x, y, z); }   // the wedge nose
  V.box(3, 7, 30, 17, 8, 31, C.tint, GL);
  V.box(1, 4, 9, 2, 7, 14, C.ink); V.box(18, 4, 9, 19, 7, 14, C.ink);   // side intakes
  for (const x of [3, 16]) V.box(x, 8, 2, x + 1, 11, 3, C.ink); V.box(1, 11, 0, 19, 12, 4, C.ink);   // the wing
  const m = V.meta ??= { tails: [] }; V.box(2, 6, 1, 18, 7, 2, o.lights ? C.tail : C.tailOff, o.lights ? LIT : GL); m.tails.push([2, 6, 18, 7, 1]);
  V.box(2, 5, 38, 5, 6, 40, o.lights ? C.head : C.headOff, o.lights ? LIT : GL); V.box(15, 5, 38, 18, 6, 40, o.lights ? C.head : C.headOff, o.lights ? LIT : GL);
  V.box(6, 2, 1, 14, 4, 2, C.ink); mirrors(V, 18, 8, 28, c); arch(V, [9, 34], .4);
  if (o.driver) driver(V, h, { zs: 22, ytop: 13, variant: o.variant + 1 });
};
// BUS RETIME (2026-10-09, slime: "yeah 8m bus") · 8 m long (it was 110 voxels, 11 m): eight windows a side, the front door ahead of the front
// wheel (simstate/movement.js: 0.62 of the half-length ahead of the middle), the middle door, the wheels 1.6 m from each end
export const bus = (V, o) => {
  const L = 80, W = 20, c = 0x2f5bff, s = 0xffc21a;
  V.box(1, 3, 1, W + 1, 30, L - 1, c); V.box(1, 3, 0, W + 1, 5, 1, C.trim); V.box(1, 3, L - 1, W + 1, 5, L, C.trim);
  V.box(1, 29, 1, W + 1, 30, L - 1, 0xe6e1d6); V.box(1, 9, 1, W + 1, 11, L - 1, (x) => (x === 1 || x === W) ? s : undefined);
  for (let z = 6; z < 72; z += 9) for (const x of [1, W]) V.box(x, 14, z, x + 1, 25, z + 7, C.glass, GL);
  V.box(2, 12, L - 1, W, 21, L, C.glass, GL); V.box(2, 21, L - 1, W, 29, L, 0xff9a1a, o.lights ? LIT : GL); paint(V, '9', 9, L - 1, 28, [1, 0], C.ink);
  for (const z of [61, 30]) V.box(0, 4, z, 1, 27, z + 8, C.glass, GL);   // doors on the kerb side (−x)
  const m = V.meta ??= { tails: [] }; for (const [x0, x1] of [[2, 5], [W - 3, W]]) { V.box(x0, 8, 0, x1, 12, 1, o.lights ? C.tail : C.tailOff, o.lights ? LIT : GL); m.tails.push([x0, 8, x1, 12, 0]); }
  for (const [x0, x1] of [[2, 5], [W - 3, W]]) V.box(x0, 6, L - 1, x1, 9, L, o.lights ? C.head : C.headOff, o.lights ? LIT : GL);
  mirrors(V, W, 20, 74, C.trim); arch(V, [16, 64], .5, W, 4);
  if (o.driver) for (let y = 18; y < 23; y++) for (let z = 72; z < 75; z++) V.set(W, y, z, y >= 21 ? C.hair[1] : C.skin[1]);
};
