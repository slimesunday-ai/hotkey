// GATEHILL · hero · OFFSHORE (block −6,4: Union Ave & Elm St, the district's corner toward the city). Owner: the Gatehill agent.
// Ids read -6_4·<group>·kind·n (groups: tower, shops, lobbyN, lobbyS, roof, heli).
//   The first tower you see from Pleasantview: a blue ribbon slab, and on its roof the district's helipad, a steel deck on legs with the
//   yellow ring and the white H, landing lights set in its rim (green and white, lit at night), and a black helicopter with a gold stripe
//   parked off the H, its pilot waiting and a client walking out with a case. At street level on Elm St: APEX MOTORCARS, a supercar
//   showroom with the car in the window (voxels of the ground floor, not a prop), and the private bank.
import { blockCtx } from '../engine.js';
import { kitNow } from '../gen.js';
import { REG } from '../audit.js';
import { AIR, TOD } from '../kit.js';
import { buildEstate } from '../districts/estates/build.js';
import { topOf } from '../districts/estates/crowns.js';
import { supercar } from '../districts/estates/props.js';
import { C, CV, memo, pv, done, px, ftext, lit, logSign, fw, FACE_ROT, r2 } from '../districts/estates/lib.js';

// the helicopter: 9.6 m nose to tail, facing +z; a black body, a gold stripe, a tinted bubble, chrome skids, four rotor blades
export const helicopter = () => memo('heli', () => { const V = pv(100, 26, 100), c = 50, B = 0x17171b, G = C.gold, GL = 0x1c2a44, CH = 0xc9ced6;
  for (const x of [c - 9, c + 8]) { V.box(x, 0, c - 16, x + 1, 1, c + 18, CH, 2); for (const z of [c - 10, c + 10]) V.box(x, 1, z, x + 1, 5, z + 1, CH, 2); }   // skids + struts
  for (const z of [c - 10, c + 10]) V.box(c - 9, 4, z, c + 9, 5, z + 1, CH, 2);                                                                               // cross tubes under the cabin
  for (let z = c - 14; z < c + 16; z++) { const t = (z - (c - 14)) / 30, w = Math.round(7 * Math.sin(Math.PI * Math.min(1, .25 + t * .9))), h1 = 5 + Math.round(12 * Math.sin(Math.PI * Math.min(1, .2 + t * .85)));
    V.box(c - w, 5, z, c + w + 1, h1, z + 1, (x, y) => y === 9 || y === 10 ? G : B); }                                                                         // the cabin, a gold stripe
  for (let z = c + 6; z < c + 17; z++) { const t = (z - c - 6) / 11, w = Math.round(6 * (1 - t * t)); if (w > 0) V.box(c - w, 8, z, c + w + 1, 15 - Math.round(t * 4), z + 1, GL, 1); }   // the tinted bubble
  V.box(c - 1, 11, c - 44, c + 2, 14, c - 13, B); V.box(c - 1, 12, c - 40, c + 2, 13, c - 26, G);                                                            // the tail boom
  V.box(c - 1, 14, c - 45, c + 2, 22, c - 40, B); V.box(c + 2, 14, c - 44, c + 3, 22, c - 42, 0x9aa0aa, 2); V.box(c + 2, 17, c - 46, c + 3, 19, c - 40, 0x9aa0aa, 2);   // fin + tail rotor
  V.box(c - 2, 14, c - 2, c + 3, 20, c + 3, 0x2a2a30); V.box(c - 1, 20, c - 1, c + 2, 21, c + 2, CH, 2);                                                      // the mast
  V.box(c + 2, 21, c - 1, c + 48, 22, c + 2, 0x2a2a30); V.box(c - 47, 21, c - 1, c - 1, 22, c + 2, 0x2a2a30); V.box(c - 1, 21, c + 2, c + 2, 22, c + 48, 0x2a2a30); V.box(c - 1, 21, c - 47, c + 2, 22, c - 1, 0x2a2a30);   // blades
  V.box(c - 1, 21, c - 1, c + 2, 22, c + 2, CH, 2);
  V.box(c - 4, 10, c + 16, c + 5, 11, c + 17, 0xffffff, TOD.night ? 3 : 1); V.box(c - 1, 13, c - 45, c + 2, 14, c - 44, 0xff2a2a, TOD.night ? 3 : 1);
  return done(V, 'helicopter'); });

export function offshore(bank, b, A) {
  const ctx = blockCtx(bank, b, A, kitNow()); REG.strict = true;
  try { buildEstate(ctx, { shop: showroom, after: helipad }); ctx.finish(); } finally { REG.strict = false; }
}
// APEX MOTORCARS: a 10 m window 4 m tall into a white showroom 3.6 m deep, the car on a turntable in it, the name in chrome on ink
function showroom(f, a0, a1, S, P, T) {
  if (S.disp !== 'cars') return false; const L = a1 - a0, w0 = a0 + 4, w1 = a1 - 20, dep = 36;
  f.box(a0, 0, 0, a1, 3, 2, 0x23232a); f.box(a0, 3, 0, a0 + 3, 44, 2, C.chalk); f.box(w1, 3, 0, w1 + 3, 44, 2, C.chalk); f.box(a1 - 3, 3, 0, a1, 44, 2, C.chalk);
  f.box(w0, 3, -dep, w1, 38, 2, AIR); f.box(w0, 3, -dep - 1, w1, 38, -dep, 0x17171b); f.box(w0, 3, -dep, w1, 4, 0, 0xf2efe6); f.box(w0, 37, -dep, w1, 38, -2, 0xfff6dc, TOD.night ? 3 : 1);
  for (let a = w0 + 2; a < w1 - 2; a += 6) f.box(a, 36, -dep + 2, a + 2, 37, -4, 0xfff6dc, TOD.night ? 3 : 1);
  // the car: the supercar's own voxels copied into the showroom, on a chrome turntable
  const car = supercar(C.orange).vol, cm = (w0 + w1) >> 1, cd = -Math.round(dep / 2); cylF(f, cm, cd, 16, 4, 5, 0xc9ced6);
  for (let y = 0; y < car.ny; y++) for (let z = 0; z < car.nz; z++) for (let x = 0; x < car.nx; x++) { const v = car.d[x + z * car.nx + y * car.sxz]; if (!v) continue; f.set(cm - (car.nz >> 1) + z, 5 + y, cd - (car.nx >> 1) + x, car.pal[v], car.lay[v]); }
  // the band: APEX MOTORCARS in chrome letters on ink; the door at the right
  f.box(a0, 38, 0, a1, 46, 2, C.ink); const M = px(S.name); if (M.w + 4 <= L) { ftext(f, M, (a0 + a1) >> 1, 45, { d0: 2, d1: 3, c: 0xc9ced6, l: lit() }); const [x, z] = fw(f, (a0 + a1) >> 1, 0); logSign(S.name, x, z, { where: 'shop' }); }
  const d0 = w1 + 4; f.box(d0, 1, -4, d0 + 13, 30, 2, AIR); f.box(d0, 1, -5, d0 + 13, 26, -4, 0x2a2d38, 1); f.box(d0, 26, -5, d0 + 13, 30, -4, C.litHi, TOD.night ? 3 : 1);
  const [dx, dz] = fw(f, d0 + 6, 5); REG.door(dx, dz, FACE_ROT[f.side]); return true;
}
const cylF = (f, ca, cd, r, y0, y1, c) => { for (let a = -r; a <= r; a++) for (let d = -r; d <= r; d++) if (a * a + d * d <= r * r) f.box(ca + a, y0, cd + d, ca + a + 1, y1, cd + d + 1, c, 2); };
// the deck: 11.6 × 11.6 m of steel on legs, 0.9 m over the roof, inside the parapet; the lights are flush with it
function helipad(ctx, P, T) {
  const top = topOf(P), [x0, z0, x1, z1] = top.rects[0], cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, s = Math.min(11.6, z1 - z0 - .8), h = 9, y = top.y;
  REG.group('heli');
  const V = ctx.volume(cx - s / 2, y, cz - s / 2, cx + s / 2, y + h * CV, cz + s / 2, { walk: true }), n = V.nx, m = V.nz, c = n / 2;
  for (let x = 4; x < n - 4; x += 14) for (let z = 4; z < m - 4; z += 14) V.box(x, 0, z, x + 2, h - 1, z + 2, C.iron);                                              // legs
  V.box(0, h - 1, 0, n, h, m, (x, yy, z) => { const r = Math.hypot(x + .5 - c, z + .5 - c), e = Math.min(x, z, n - 1 - x, m - 1 - z), u = x - c, v = z - c;
    if (e === 0 && (x + z) % 8 < 2) return (x + z) % 16 < 8 ? 0x6cff4a : 0xffffff; if (e < 2) return C.yellow; if (r > 44 && r < 49) return C.yellow;
    if ((Math.abs(u + 11) < 3 || Math.abs(u - 11) < 3) && Math.abs(v) < 18) return C.chalk; if (Math.abs(u) < 11 && Math.abs(v) < 3) return C.chalk;   // the H
    return ((x >> 3) + (z >> 3)) & 1 ? 0x3a3d45 : 0x34373f; }, 0);
  if (TOD.night) for (let x = 0; x < n; x++) for (let z = 0; z < m; z++) if (Math.min(x, z, n - 1 - x, m - 1 - z) === 0 && (x + z) % 8 < 2) V.set(x, h - 1, z, (x + z) % 16 < 8 ? 0x6cff4a : 0xffffff, 3);
  const hy = y + h * CV; ctx.put(helicopter(), cx + s * .1, cz + s * .08, { y: hy, rot: 3, slide: [0, 1], reach: 1.2 });
  // the pilot by the door, a client walking out to it with the case
  (ctx.A.life ??= []).push({ x: r2(cx - s * .22), y: r2(hy), z: r2(cz + s * .34), ry: Math.PI / 2, act: 'stand', seed: P.seed + 41, hand: true }, { x: r2(cx - s * .38), y: r2(hy), z: r2(cz - s * .32), ry: .6, act: 'carry', seed: P.seed + 42, hand: true });
  REG.group('tower');
}
