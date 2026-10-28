// security(kind, o): what a lot shows once security is installed. 0.05 grain; sized to STYLE.md's doors (1.4 × 2.4) and windows.
//   lock    a steel edge guard down the lock side of the existing door: two gold deadbolts, a hasp + padlock, a keypad
//   door    a reinforced steel door that plugs the opening: riveted frame, barred vision panel, pull bar, gold locks, kick plate
//   safe    a floor safe (0.8 × 0.9 × 0.7 m): dial, spoked handle, brass hinges and a 404 plate — for a porch, a yard or a terrace
//   gate    a roll-down gate on the face of a door or shop window (o.open 0…1 rolls it up); o.style 'bars' = iron window guards
//   buzzer  a walk-up's brass door panel: camera eye, speaker, four buttons with name labels — on the wall beside the street door
//   camera  a CCTV camera on a wall bracket, red LED (lit at night) — above a door or on a corner
// Door and window pieces keep the kit.js depths: the in-opening plug runs z −0.2 … +0.1 (it hides any door face 0.3–0.5 m deep and
// touches the jambs); face parts sit at z ≥ +0.15 so nothing is coplanar with a band (+0.1) or a trim surround (+0.2).
import { vol, done, K, HV, GLOW, mask3, printC, line, mix, TOD } from './lib.js';

const AZ = 4;   // z index of the wall plane in facade pieces (org z = −0.2)
function plugVol(W, H, extraX = 0, extraTop = 0, nz = 12) { return vol(W + 2 * extraX, H + extraTop, nz, { s: HV, ax: W / 2 + extraX, az: AZ, ground: false }); }
const disc = (V, cx, cy, z, r, c, l = 0) => { for (let x = Math.floor(cx - r); x <= cx + r; x++) for (let y = Math.floor(cy - r); y <= cy + r; y++) if (Math.hypot(x + .5 - cx, y + .5 - cy) <= r) V.set(x, y, z, typeof c === 'function' ? c(x, y) : c, l); };
function padlock(V, x, y, z) {   // body 4 × 4 gold, a steel shackle over it, a keyhole
  V.box(x, y, z, x + 4, y + 4, z + 2, K.gold, 2); V.set(x + 2, y + 1, z + 2, K.ink); V.set(x + 2, y + 2, z + 2, K.ink);
  V.box(x, y + 4, z, x + 1, y + 7, z + 1, K.steelL, 2); V.box(x + 3, y + 4, z, x + 4, y + 7, z + 1, K.steelL, 2); V.box(x, y + 7, z, x + 4, y + 8, z + 1, K.steelL, 2); }

function lock(o) {
  const W = 2 * (o.w ?? 14), H = 2 * (o.h ?? 24), V = plugVol(W, H), x0 = W - 7, S = 0x8d929c;
  V.box(x0, 0, 0, W, H, AZ + 2, S, 2); V.box(x0, 0, AZ + 1, x0 + 1, H, AZ + 2, K.steelD, 2);           // the guard (touches the right jamb)
  for (let y = 3; y < H - 2; y += 6) V.set(x0 + 5, y, AZ + 2, K.steelL, 2);                             // screws
  for (const yy of [Math.round(H * .6), Math.round(H * .44)]) { disc(V, x0 + 3.5, yy + .5, AZ + 2, 1.6, K.gold, 2); V.set(x0 + 3, yy, AZ + 3, K.ink); }   // two deadbolts
  V.box(x0 - 3, Math.round(H * .3), AZ + 2, x0 + 2, Math.round(H * .3) + 2, AZ + 3, K.steelD, 2); padlock(V, x0 - 4, Math.round(H * .3) - 6, AZ + 3);   // hasp + padlock
  const ky = Math.round(H * .74); V.box(x0 + 1, ky, AZ + 2, x0 + 6, ky + 6, AZ + 3, K.ink);          // keypad, a lit LED
  for (const a of [2, 4]) for (const b of [1, 3]) V.set(x0 + a, ky + b, AZ + 3, K.steelL);
  V.set(x0 + 5, ky + 5, AZ + 3, K.lime, GLOW());
  return done(V, 'sec-lock', 'facade: bottom centre of the door opening, on the wall plane (the guard runs down the right-hand jamb)');
}

function door(o) {
  const W = 2 * (o.w ?? 14), H = 2 * (o.h ?? 24), V = plugVol(W, H), F = AZ + 2, P = 0x6f7480, PD = 0x565a64;
  V.box(0, 0, 0, W, H, F, P);                                                                            // the plug (z −0.2 … +0.1)
  V.box(0, 0, F - 1, W, H, F, (x, y) => (x < 2 || x >= W - 2 || y >= H - 2) ? PD : undefined);          // frame reads darker
  for (let x = 3; x < W - 3; x += 4) for (const y of [H - 4, 7]) V.set(x, y, F, K.steelL, 2);          // rivets
  for (let y = 10; y < H - 5; y += 4) for (const x of [3, W - 4]) V.set(x, y, F, K.steelL, 2);
  const vx0 = Math.round(W / 2) - 4, vy0 = Math.round(H * .62); V.box(vx0, vy0, F - 1, vx0 + 8, vy0 + 7, F, 0x22305e, 1);   // vision panel, barred
  V.set(vx0 + 1, vy0 + 5, F - 1, K.glint, 1); for (const bx of [vx0 + 1, vx0 + 4, vx0 + 6]) V.box(bx, vy0, F, bx + 1, vy0 + 7, F + 1, K.ink);
  V.box(vx0 - 1, vy0 - 1, F, vx0 + 9, vy0, F + 1, K.ink); V.box(vx0 - 1, vy0 + 7, F, vx0 + 9, vy0 + 8, F + 1, K.ink);
  const hx = W - 6; V.box(hx, Math.round(H * .34), F + 1, hx + 1, Math.round(H * .56), F + 2, K.chrome, 2);                    // pull bar on two standoffs
  for (const y of [Math.round(H * .34), Math.round(H * .56) - 1]) V.box(hx, y, F, hx + 1, y + 1, F + 1, K.chrome, 2);
  for (const y of [Math.round(H * .6), Math.round(H * .28)]) { V.box(hx - 1, y, F, hx + 2, y + 3, F + 1, K.gold, 2); V.set(hx, y + 1, F + 1, K.ink); }
  V.box(1, 0, F, W - 1, 5, F + 1, (x, y) => ((x + y) % 3 === 0) ? K.steelL : 0xa8adb6, 2);            // diamond-plate kick
  disc(V, W / 2, Math.round(H * .79) + .5, F, 1.1, K.gold, 2); V.set(Math.floor(W / 2), Math.round(H * .79), F + 1, K.ink);   // peephole
  return done(V, 'sec-door', 'facade: bottom centre of the door opening, on the wall plane (plugs the opening; face parts to +0.15)');
}

function safe() {
  const V = vol(18, 20, 18, { s: HV, az: 8 }), B = 0x1f5c4a, BL = mix(B, 0xffffff, .12), G = K.gold;
  for (const [x, z] of [[2, 2], [14, 2], [2, 12], [14, 12]]) V.box(x, 0, z, x + 2, 2, z + 2, K.ink);          // stubby feet
  V.box(1, 2, 1, 17, 20, 15, B); V.box(1, 19, 1, 17, 20, 15, BL);                                         // body, a lighter lid edge
  V.box(3, 3, 15, 15, 19, 16, B); V.box(3, 3, 15, 15, 19, 16, (x, y) => (x === 3 || x === 14 || y === 3 || y === 18) ? G : undefined, 2);   // the door, gold pinstripe
  for (const y of [5, 13]) V.box(2, y, 15, 3, y + 3, 17, K.chrome, 2);                                    // hinges
  disc(V, 7, 8.5, 16, 2.6, (x, y) => ((x + y) % 2 === 0 && Math.hypot(x + .5 - 7, y + .5 - 8.5) > 1.8) ? K.ink : G, 2); V.set(6, 8, 17, K.ink);   // the dial
  V.box(12, 8, 16, 14, 10, 17, K.chrome, 2); line(V, 12, 9, 17, 12, 11, 17, K.chrome, 2); line(V, 12, 9, 17, 10, 6, 17, K.chrome, 2); line(V, 13, 9, 17, 15, 6, 17, K.chrome, 2);   // spoked handle
  V.box(3, 12, 16, 14, 17, 17, G, 2); printC(V, mask3('OAK'), 8.5, 16, 17, K.ink, 0);                    // the maker's plate: OAK SAFE CO.
  return done(V, 'sec-safe', 'ground: base centre; the door faces +z');
}

function gate(o) {
  if (o.style === 'bars') return bars(o);
  const W = 2 * (o.w ?? 14), H = 2 * (o.h ?? 24), open = Math.max(0, Math.min(.85, o.open ?? 0)), V = plugVol(W, H, 3, 3, 12), X = x => x + 3;
  const hb = H - 5, bot = Math.min(hb - 2, Math.round(hb * open)), top = H + 2;                        // the coil housing sits in the head of the opening (0.1 m above it at most, so a sign band over the door stays clear)
  V.box(X(-3), hb, AZ, X(W + 3), top, AZ + 7, 0x9aa0aa, 2); V.box(X(-3), top - 1, AZ, X(W + 3), top, AZ + 7, 0x7d838e, 2);
  V.box(X(-3), hb, AZ + 6, X(W + 3), hb + 1, AZ + 7, 0x7d838e, 2); for (const x of [X(-2), X(W + 1)]) V.set(x, hb + 3, AZ + 7, K.ink);
  for (const x0 of [X(-3), X(W)]) V.box(x0, 0, AZ, x0 + 3, hb, AZ + 5, 0x7d838e, 2);                      // guide rails (front at +0.25)
  for (let y = bot; y < hb; y++) V.box(X(0), y, AZ + 3, X(W), y + 1, AZ + ((y - bot) % 2 ? 4 : 5), (y - bot) % 2 ? 0x8f949c : 0xb9bec6, 2);   // the slats
  V.box(X(0), bot, AZ + 3, X(W), bot + 2, AZ + 5, K.gun, 2);                                              // bottom bar, two handles, the padlock
  for (const hx of [X(3), X(W - 5)]) V.box(hx, bot + 2, AZ + 5, hx + 2, bot + 3, AZ + 6, K.steelL, 2);
  if (!bot) { padlock(V, X(W / 2 - 2), 0, AZ + 5); V.box(X(W / 2 - 3), 0, AZ + 3, X(W / 2 + 3), 1, AZ + 5, K.gun, 2); }
  for (const [dx, dy] of [[5, 9], [W - 9, 17], [11, 26]]) if (dy > bot + 3 && dy < hb - 1) for (const x of [X(dx), X(dx + 1)]) for (let z = AZ + 4; z >= AZ + 3; z--) if (V.has(x, dy, z)) { V.set(x, dy, z, 0x6d727c, 2); break; }   // dents (recoloured slats)
  return done(V, 'sec-gate', 'facade: bottom centre of the opening, on the wall plane (rails 0.15 m beyond each jamb, the housing fills the top 0.25 m of the opening)', { open });
}
function bars(o) {   // iron window guards over a window (default 13 × 17): bars, three rails, scrolls, tabs back to the wall
  const W = 2 * (o.w ?? 13), H = 2 * (o.h ?? 17), I = K.iron, z = AZ + 4, X = x => x + 2, Y = y => y + 2;
  const V = vol(W + 4, H + 8, 12, { s: HV, ax: W / 2 + 2, ay: 2, az: AZ, ground: false });            // y = −2 (the sill top) … H + 5
  for (let x = -2; x < W + 2; x += 3) V.box(X(x), Y(-2), z, X(x) + 1, Y(H + 3), z + 1, I, 2);
  for (const y of [-2, Math.round(H / 2), H + 2]) V.box(X(-2), Y(y), z, X(W + 1), Y(y) + 1, z + 1, I, 2);
  for (let x = 1; x < W - 1; x += 6) V.box(X(x), Y(H + 3), z, X(x) + 3, Y(H + 5), z + 1, (xx, yy) => (yy === Y(H + 4) || xx !== X(x) + 1) ? I : undefined, 2);   // little arches on top
  for (const [x, y] of [[-1, -2], [W, -2], [-1, H + 2], [W, H + 2]]) V.box(X(x), Y(y), AZ, X(x) + 1, Y(y) + 1, z, I, 2);                     // tabs to the wall
  return done(V, 'sec-bars', 'facade: bottom centre of the window opening, on the wall plane (guards 0.1 m past the trim, front at +0.25)');
}
function buzzer() {
  const V = vol(10, 16, 8, { s: HV, az: 0, ground: false }), G = K.gold;
  V.box(0, 0, 0, 10, 16, 3, G, 2); V.box(1, 1, 2, 9, 15, 3, K.steelL, 2);                               // brass plate, steel face (front at +0.15)
  disc(V, 5, 13, 3, 1.3, K.ink); V.set(5, 13, 3, 0x6fd6ff, 1);                                           // the camera eye
  for (let x = 2; x < 9; x += 2) for (const y of [10, 11]) V.set(x, y, 3, K.ink);                          // speaker grille
  for (let r = 0; r < 4; r++) { const y = 2 + r * 2; V.box(2, y, 3, 4, y + 1, 4, K.ink); V.box(5, y, 3, 8, y + 1, 4, K.cream); V.set(5 + (r % 3), y, 4, K.ink); }   // buttons + name labels
  V.set(8, 14, 3, K.lime, GLOW());
  return done(V, 'sec-buzzer', 'facade: bottom centre of the panel on the wall plane (mount at 1.0–1.1 m, beside the street door)');
}

function camera() {
  const V = vol(10, 12, 16, { s: HV, ay: 5, az: 0, ground: false }), Wt = K.white;
  V.box(2, 5, 0, 8, 11, 3, K.gun); V.box(4, 7, 3, 6, 9, 5, K.gun); V.box(3, 6, 4, 7, 10, 6, K.steelD, 2);            // wall plate, arm, knuckle
  V.box(2, 1, 5, 8, 7, 12, Wt); V.box(2, 0, 9, 8, 6, 14, Wt); V.box(2, 1, 5, 8, 2, 9, 0xdfe2e8);                     // body, stepped down toward the lens
  V.box(1, 7, 6, 9, 8, 15, K.ink); V.box(1, 6, 13, 9, 7, 16, K.ink);                                                 // sun hood
  disc(V, 5, 3, 14, 2.2, K.ink); disc(V, 5, 3, 14, 1.2, K.glassHi, 1); V.set(4, 3, 14, K.glint, 1);                   // lens
  V.set(7, 5, 14, 0xff2a2a, TOD.night ? 3 : 1);                                                                       // the red LED
  line(V, 3, 2, 5, 3, 5, 2, K.ink);                                                                                   // cable
  return done(V, 'sec-camera', 'facade: bottom centre of the wall plate on the wall plane (mount 2.6–3.0 m up, over the door)');
}

const KINDS = { lock, door, safe, gate, buzzer, camera };
export function security(kind = 'lock', o = {}) { return (KINDS[kind] || lock)(o); }
