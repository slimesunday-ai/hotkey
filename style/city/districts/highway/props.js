// ROUTE 9 + MOTEL 9 · the highway's own props (owner: the St. Mercy / Route 9 agent). Base centre, facing +z, memoized per argument
// and time of day. The fuel pump, the semi on the shoulder with its back doors cracked (sneaker boxes: the load fell off a truck), the
// ice merchandiser with its penguin, the air machine, the payphone, the motel's ice machine and its soda machine, the loan shark's
// card table, a pool lounger and a flamingo float, the gas station's bollards.
import { C, CV, lit, memo, pv, done, cyl, px, mini, vtext, vtextX, shade, H } from '../hospital/lib.js';

const S2 = .05, fine = (nx, ny, nz) => pv(nx, ny, nz, S2);

// ── the fuel pump: a white cabinet, the LAST CHANCE red panel on top, a little screen, a hose and nozzle on each side (faces ±x)
export const pump = (grade = 0) => memo('pump' + grade, () => { const V = pv(8, 21, 12), R = C.sRed, Y = C.yellow;
  V.box(1, 0, 1, 7, 2, 11, 0x6d707a); V.box(1, 2, 2, 7, 16, 10, C.chalk); V.box(0, 16, 1, 8, 20, 11, R); V.box(0, 20, 1, 8, 21, 11, shade(R, .8));
  for (const x of [0, 7]) { V.box(x, 11, 3, x + 1, 14, 9, 0x101216); V.box(x, 12, 4, x + 1, 13, 8, [0x6cff4a, 0xffb020, 0x2de2e6][grade % 3], lit(1));   // the price screens
    V.box(x, 5, 3, x + 1, 9, 5, 0x2a2d38); V.box(x, 7, 8, x + 1, 9, 10, Y); V.set(x, 6, 9, C.ink); }                                               // the keypad, the grade button, the nozzle holster
  for (const x of [-0, 7]) for (let y = 2; y < 9; y++) V.set(x === 0 ? 0 : 7, y, 10, C.ink);                                                        // the hoses down the side
  return done(V, 'pump'); });
// ── a yellow bollard (steel pipe filled with concrete), 1 m
export const bollard = () => memo('bollard', () => { const V = fine(6, 20, 6); cyl(V, 3, 3, 2.6, 0, 19, (x, y) => y % 6 === 5 ? C.ink : C.yellow); cyl(V, 3, 3, 1.8, 19, 20, C.yellow); return done(V, 'bollard'); });
// ── THE SEMI on the shoulder: a red cab-over tractor with chrome stacks, a white trailer lettered HOT BOX HAULING, its back doors swung
// open on a wall of orange shoe boxes (18.5 m, facing +z = the cab end)
export const semi = () => memo('semi', () => { const L = 185, W = 25, V = pv(W + 4, 42, L + 4, CV, (W + 4) / 2, (L + 4) / 2), x0 = 2, x1 = x0 + W, z0 = 2, RD = 0xc4122f, TR = C.chalk;
  const tz0 = z0, tz1 = z0 + 136, cz0 = z0 + 141, cz1 = z0 + L;                       // the trailer, then the tractor (fifth wheel under the trailer's nose)
  // the trailer: a box on its bogie, a steel frame under it, landing legs, the rear bumper
  V.box(x0, 12, tz0, x1, 40, tz1, TR); V.box(x0 + 1, 40, tz0 + 1, x1 - 1, 41, tz1 - 1, 0xdfe3e8); V.box(x0 + 2, 9, tz0 + 2, x1 - 2, 12, tz1, 0x3b3f4a);
  for (let z = tz0 + 3; z < tz1; z += 9) V.box(x0, 12, z, x1, 13, z + 1, 0xc9ced6);                                                               // the ribs along the bottom rail
  for (const x of [x0 + 2, x1 - 3]) V.box(x, 3, tz1 - 30, x + 1, 9, tz1 - 29, C.steelD, 2);                                                        // the landing legs
  for (const z of [tz0 + 10, tz0 + 22]) for (const x of [x0, x1 - 4]) { V.box(x, 0, z - 5, x + 4, 10, z + 5, C.rubber); V.box(x + (x === x0 ? 0 : 3), 3, z - 2, x + 1 + (x === x0 ? 0 : 3), 7, z + 2, C.chrome, 2); }
  V.clear(x0 + 4, 0, tz0 + 5, x1 - 4, 9, tz0 + 27); V.box(x0 + 1, 6, tz0 - 1, x1 - 1, 8, tz0, 0xd7141a); for (const x of [x0 + 3, x1 - 4]) V.box(x, 6, tz0 - 1, x + 1, 12, tz0 + 3, C.steelD, 2);   // the ICC bumper on its brackets                                          // the bogie gap, the ICC bumper
  // the lettering on both sides: HOT BOX in red, HAULING under it, a phone number that's been painted over
  for (const [x, dir] of [[x0 - 1, 1], [x1, -1]]) { const M1 = px('HOT BOX'), M2 = px('HAULING'), zc = (tz0 + tz1) >> 1;
    vtextX(V, M1, zc - M1.w, 36, x, RD, { sc: 2, dir: dir > 0 ? -1 : 1 }); vtextX(V, M2, zc - (M2.w >> 1), 20, x, C.ink, { dir: dir > 0 ? -1 : 1 });
    V.box(x, 14, zc + 24, x + 1, 17, zc + 58, 0xc9ced6); }
  // the back doors swung open flat against the sides; inside, stacks of orange shoe boxes, a few pulled out
  V.box(x0 + 1, 13, tz0, x1 - 1, 40, tz0 + 16, -1); V.box(x0 + 1, 12, tz0, x1 - 1, 13, tz0 + 16, 0x6e5a48);
  for (let x = x0 + 2; x < x1 - 2; x += 4) for (let y = 13; y < 38; y += 3) for (let z = tz0 + 4; z < tz0 + 16; z += 5) if (H(x, y, z) > .12) { V.box(x, y, z, x + 4, y + 3, z + 5, 0xff7a1a); V.box(x, y + 2, z, x + 4, y + 3, z + 1, C.ink); V.set(x + 1, y + 1, z, C.chalk); }
  for (const x of [x0 - 1, x1]) V.box(x, 13, tz0, x + 1, 40, tz0 + 12, TR);
  // the tractor: frame, fuel tanks, wheels, the cab-over (red, a white stripe, the windscreen), chrome stacks behind it
  V.box(x0 + 3, 6, tz1 - 12, x1 - 3, 10, cz1, 0x2a2d38); V.box(x0 + 5, 10, tz1 - 8, x1 - 5, 12, tz1 + 2, C.steelD, 2);                            // frame, fifth wheel
  for (const x of [x0, x1 - 3]) cylZ2(V, cz0 - 10, cz0 + 2, x + 1.5, 7.5, 2.8, C.chrome);                                                         // the fuel tanks
  for (const z of [tz1 - 4, cz1 - 12]) for (const x of [x0, x1 - 4]) { V.box(x, 0, z - 5, x + 4, 10, z + 5, C.rubber); V.box(x + (x === x0 ? 0 : 3), 3, z - 2, x + 1 + (x === x0 ? 0 : 3), 7, z + 2, C.chrome, 2); }
  V.box(x0, 10, cz0 + 12, x1, 36, cz1, RD); V.box(x0 + 1, 36, cz0 + 13, x1 - 1, 38, cz1 - 1, RD); V.box(x0, 18, cz0 + 12, x1, 20, cz1, C.chalk);   // the cab
  V.box(x0 + 2, 24, cz1, x1 - 2, 34, cz1 + 1, 0x22345e, 1); for (const x of [x0 - 1, x1]) V.box(x, 25, cz1 - 14, x + 1, 33, cz1 - 3, 0x22345e, 1);   // windscreen, door windows
  V.box(x0 + 4, 11, cz1, x1 - 4, 17, cz1 + 1, C.chrome, 2); V.box(x0 + 1, 7, cz1, x1 - 1, 10, cz1 + 2, C.chrome, 2);                                 // grille, bumper
  for (const x of [x0 + 1, x1 - 4]) V.box(x, 12, cz1, x + 3, 15, cz1 + 1, 0xfff6d8, lit(1));
  for (const x of [x0 + 1, x1 - 3]) V.box(x, 10, cz0 + 8, x + 2, 41, cz0 + 10, C.chrome, 2);                                                      // the stacks
  V.box(x0 + 3, 38, cz1 - 10, x1 - 3, 40, cz1 - 2, RD); for (let x = x0 + 5; x < x1 - 5; x += 3) V.box(x, 38, cz1 - 3, x + 1, 40, cz1 - 2, 0xffb000, lit(1));   // the roof fairing and its marker lamps
  return done(V, 'semi'); });
const cylZ2 = (V, z0, z1, cx, cy, r, c) => { for (let z = z0; z < z1; z++) for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) if (Math.hypot(x + .5 - cx, y + .5 - cy) <= r) V.set(x, y, z, c, 2); };
// ── the ice merchandiser outside the mart: an upright blue freezer, ICE in white, a penguin in a scarf painted on its door
export const iceBox = () => memo('icebox', () => { const V = pv(14, 21, 11, CV, 7, 4.5), B = 0x1f6fd8;
  V.box(0, 0, 0, 14, 20, 8, B); V.box(0, 20, 0, 14, 21, 8, shade(B, .8)); V.box(1, 1, 8, 13, 19, 9, 0xdff2ff); V.box(1, 1, 8, 13, 2, 9, B);
  { const M = px('ICE'); vtext(V, M, 7 - (M.w >> 1), 18, 9, B); }
  V.box(4, 3, 9, 10, 10, 10, C.ink); V.box(5, 4, 9, 9, 9, 10, C.chalk); V.box(5, 8, 10, 6, 9, 11, C.ink); V.box(8, 8, 10, 9, 9, 11, C.ink); V.box(6, 7, 10, 8, 8, 11, 0xffb000); V.box(4, 6, 10, 10, 7, 11, 0xe8232a);   // the penguin, its scarf
  return done(V, 'freezer'); });
// ── the air machine (AIR 50¢ on a red box on a post, the hose coiled on its hook)
export const airPump = () => memo('air', () => { const V = pv(8, 18, 9, CV, 4, 4); V.box(3, 0, 3, 5, 10, 5, C.steelD, 2); V.box(0, 10, 1, 8, 17, 7, C.sRed); V.box(0, 17, 1, 8, 18, 7, shade(C.sRed, .8));
  V.box(1, 13, 7, 7, 16, 8, C.chalk); { const M = mini('AIR'); vtext(V, M, 4 - (M.w >> 1), 15, 8, C.sRed); } for (let a = 0; a < 16; a++) { const t = a / 16 * Math.PI * 2; V.set(4 + Math.round(Math.cos(t) * 2.5), 7 + Math.round(Math.sin(t) * 2.5), 7, C.ink); }
  V.box(4, 9, 6, 5, 10, 8, C.ink); return done(V, 'air-pump'); });
// ── the payphone on its post under a steel hood (the handset hangs off the hook)
export const payphone = () => memo('payphone', () => { const V = pv(8, 22, 8); V.box(3, 0, 3, 5, 11, 5, C.steelL, 2); V.box(1, 11, 2, 7, 20, 6, 0x9aa0a8, 2); V.box(0, 20, 0, 8, 22, 7, 0x6d707a, 2);
  V.box(2, 12, 6, 6, 18, 7, 0x2a2d38); V.box(2, 17, 6, 4, 18, 7, 0x6cff4a, lit(1)); V.box(5, 12, 6, 6, 15, 8, C.ink); V.box(4, 9, 7, 6, 13, 8, C.ink); return done(V, 'payphone'); });
// ── the motel's ice machine (steel, ICE in blue on a white panel, a little blue light) and its soda machine (lime and ink: ICE COLD)
export const iceMachine = () => memo('icemachine', () => { const V = pv(9, 20, 10, CV, 4.5, 4); V.box(0, 0, 0, 9, 19, 8, 0xb9bec6, 2); V.box(0, 19, 0, 9, 20, 8, 0x9aa0a8, 2);
  V.box(1, 10, 8, 8, 17, 9, C.chalk); { const M = px('ICE'); vtext(V, M, 5 - (M.w >> 1) - 0, 16, 9, 0x1f6fd8); } V.box(2, 3, 8, 7, 8, 9, 0x6d707a, 2); V.box(7, 17, 8, 8, 18, 9, 0x3dd6ff, lit(1));
  return done(V, 'ice-machine'); });
export const soda = () => memo('soda', () => { const V = pv(10, 19, 10, CV, 5, 4), B = 0x151518; V.box(0, 0, 0, 10, 19, 8, B);
  V.box(1, 6, 8, 7, 18, 9, 0x6cff4a, lit(1)); { const M = mini('ICE'); vtext(V, M, 4 - (M.w >> 1), 16, 9, B); } { const M = mini('COLD'); vtext(V, M, 4 - (M.w >> 1), 10, 9, B); }
  V.box(8, 8, 8, 9, 14, 9, 0x9aa0a8, 2); V.box(1, 1, 8, 7, 3, 9, 0x0c0d12); return done(V, 'vending'); });
// ── the loan shark's card table: a folding table, a cash box, a ledger, a calculator, a coffee
export const cardTable = () => memo('cardtable', () => { const V = pv(10, 11, 8); for (const [x, z] of [[1, 1], [8, 1], [1, 6], [8, 6]]) V.box(x, 0, z, x + 1, 7, z + 1, 0x9aa0a8, 2);
  V.box(0, 7, 0, 10, 8, 8, 0x3a6b3a); V.box(1, 8, 1, 4, 10, 4, 0x9aa0a8, 2); V.box(2, 10, 2, 3, 10, 3, C.ink); V.box(5, 8, 2, 8, 9, 6, 0x6e2230); V.box(8, 8, 6, 9, 10, 7, C.chalk);   // cash box, ledger, a coffee
  return done(V, 'table'); });
// ── the pool: a white lounger, a flamingo float
export const lounger = (c = 0xffe23a) => memo('lounger' + c, () => { const V = pv(7, 11, 20); for (const [x, z] of [[0, 1], [6, 1], [0, 13], [6, 13]]) V.box(x, 0, z, x + 1, 3, z + 1, C.chalk);
  for (let z = 0; z < 20; z++) { const y = z < 14 ? 3 : 3 + (z - 13); V.box(0, y, z, 7, y + 1, z + 1, (z & 1) ? c : C.chalk); } return done(V, 'lounger'); });
