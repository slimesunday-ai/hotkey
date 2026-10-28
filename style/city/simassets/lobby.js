// doormanLobby({ width }): the luxury tower's street entrance. 0.05 grain. width = the frontage it may use, in city voxels (default 56 =
// 5.6 m; ≥ 52 adds the planters). Facade piece: origin = the wall plane at the entrance's centre, on the sidewalk; +z = the street.
//   · a brass revolving door (a half drum, r 0.9 m) on an ink portal with brass lanterns (lit at night)
//   · an ink canopy with brass piping on two brass poles near the curb: the building's name across its 0.9 m fascia (and on its top,
//     for the overhead camera; o.name, default CROWN), the street number on its sides (o.no, default 1), downlights under it (lit at
//     night); brass tie rods back to the wall. A name too long for 0.7 m letters is set in 0.35 m ones
//   · a red carpet to the curb between brass stanchions and velvet ropes
//   · the doorman's podium (wood, brass, a green-shaded lamp, the guest book); the doorman stands behind it: STAND (below)
//   · two ink planters with cubic topiary
// The building is THE CROWN (the tower's penthouse is the top home of the ladder); nothing here carries a crew colour.
import { vol, done, K, HV, GLOW, mask5, printC, line, mix, TOD } from './lib.js';

export const STAND = { x: 1.3, y: 0, z: 0.6, face: '+z' };   // the doorman's feet, metres from the origin (behind the podium, facing the street)
const hvx = m => Math.round(m / HV);

export function doormanLobby({ width = 56, name = 'CROWN', no = '1' } = {}) {
  const W = Math.max(80, 2 * Math.round(width)), D = 40, V = vol(W, 84, D, { s: HV, az: 0, ground: true }), cx = W / 2, G = K.gold, INK = K.ink;
  const cw = Math.min(36, cx - 4);                                         // canopy half width
  // ── the portal (on the wall, z 0 … 0.2): ink stone, brass frame, a transom
  V.box(cx - 24, 0, 0, cx + 24, 60, 4, INK); V.box(cx - 24, 0, 3, cx + 24, 60, 4, (x, y) => (x < cx - 22 || x >= cx + 22 || y >= 58) ? G : undefined, 2);
  V.box(cx - 20, 55, 3, cx + 20, 58, 4, 0x22305e, 1);                                                        // a transom band over the drum, under the canopy
  for (const lx of [cx - 22, cx + 19]) { V.box(lx, 38, 4, lx + 3, 40, 6, G, 2); V.box(lx, 40, 5, lx + 3, 46, 8, G, 2); V.box(lx + 1 - (lx < cx ? 0 : 0), 41, 5, lx + 2, 45, 8, 0xfff3c4, GLOW()); V.box(lx, 46, 5, lx + 3, 47, 8, INK); }   // lanterns
  // ── the revolving door: a glass half drum with brass mullions, kick band, push bar and a brass-rimmed ink cap
  const R = 18;
  for (let x = Math.floor(cx - R); x < cx + R; x++) for (let z = 4; z < R + 1; z++) { const d = Math.hypot(x + .5 - cx, z + .5 - 0); if (d > R) continue; const skin = d > R - 1.5;
    const ang = Math.atan2(z + .5, x + .5 - cx), mull = skin && Math.abs(((ang / (Math.PI / 4)) % 1 + 1) % 1 - .5) > .42;
    for (let y = 0; y < 50; y++) { let c = 0x1b2233, l = 0; if (skin) { if (y < 4 || y >= 47 || mull) { c = G; l = 2; } else { c = y > 32 ? K.glassHi : K.glassLo; l = 1; if ((x + y) % 23 === 0 && y > 20) c = K.glint; } } V.set(x, y, z, c, l); }
    for (let y = 50; y < 54; y++) V.set(x, y, z, d > R - 1.5 ? G : INK, d > R - 1.5 ? 2 : 0); }
  V.box(cx - 5, 22, R, cx + 5, 23, R + 1, G, 2); for (const px of [cx - 5, cx + 4]) V.box(px, 22, R - 1, px + 1, 23, R, G, 2);
  // ── the carpet to the curb (0.05 thick), gold edges
  V.box(cx - 12, 0, R, cx + 12, 1, D - 1, (x, y, z) => (x === cx - 12 || x === cx + 11) ? G : K.red, 0);
  // ── stanchions + velvet ropes either side of the carpet
  for (const sx of [cx - 16, cx + 14]) { for (const sz of [22, 36]) { V.box(sx - 1, 0, sz - 1, sx + 3, 1, sz + 3, G, 2); V.box(sx, 1, sz, sx + 2, 18, sz + 2, G, 2); V.box(sx - 1 + 1, 18, sz, sx + 2, 20, sz + 2, G, 2); }
    let prev = 16; for (let z = 24; z < 36; z++) { const t = (z - 23) / 13, y = 16 - Math.round(3 * 4 * t * (1 - t)); V.box(sx, Math.min(y, prev), z, sx + 2, Math.max(y, prev) + 1, z + 1, 0xb0102a, 0); prev = y; } }   // sagging, every step joined
  // ── the canopy: slab + a 0.9 m fascia on three sides, brass piping, the name, downlights; poles; tie rods
  const zf = D - 2, y0 = 48, y1 = 66;
  V.box(cx - cw, y1 - 8, 0, cx + cw, y1, zf, INK);                                                        // slab (0.4 m)
  V.box(cx - cw, y0, zf - 2, cx + cw, y1, zf, INK); for (const sx of [cx - cw, cx + cw - 2]) V.box(sx, y0, 4, sx + 2, y1, zf, INK);   // fascia: front + sides
  for (const y of [y0, y1 - 1]) { V.box(cx - cw, y, zf - 2, cx + cw, y + 1, zf, G, 2); for (const sx of [cx - cw, cx + cw - 2]) V.box(sx, y, 4, sx + 2, y + 1, zf, G, 2); }
  const NM = mask5(mask5(name).w <= 2 * cw - 4 ? name : 'CROWN'), sc = NM.w * 2 <= 2 * cw - 4 ? 2 : 1, NO = mask5(no), sn = NO.w * 2 <= 30 ? 2 : 1;   // (the default: 0.7 m letters, as before)
  printC(V, NM, cx, sc === 2 ? y1 - 3 : y1 - 6, zf, G, TOD.night ? 3 : 2, '+z', { sc });                       // front fascia
  printC(V, NO, 20, sn === 2 ? y1 - 3 : y1 - 6, cx - cw - 1, G, TOD.night ? 3 : 2, '-x', { sc: sn }); printC(V, NO, 20, sn === 2 ? y1 - 3 : y1 - 6, cx + cw, G, TOD.night ? 3 : 2, '+x', { sc: sn });
  { const M = NM, x0 = Math.round(cx - M.w * sc / 2), z0 = 10; for (let j = 0; j < 7; j++) for (let i = 0; i < M.w; i++) if (M.at(i, j)) for (let a = 0; a < sc; a++) for (let b = 0; b < sc; b++) V.set(x0 + i * sc + a, y1 - 1, z0 + j * sc + b, G, 2);   // on the top, reading from the street
    V.box(cx - cw + 2, y1 - 1, 3, cx + cw - 2, y1, 4, G, 2); V.box(cx - cw + 2, y1 - 1, zf - 3, cx + cw - 2, y1, zf - 2, G, 2); }
  for (const lx of [cx - 20, cx, cx + 20]) V.box(lx - 2, y1 - 9, 20, lx + 2, y1 - 8, 24, 0xfff3c4, GLOW());   // downlights in the soffit
  for (const sx of [cx - cw + 1, cx + cw - 3]) { V.box(sx, 0, zf - 4, sx + 2, y0, zf - 2, G, 2); V.box(sx - 1, 0, zf - 5, sx + 3, 1, zf - 1, G, 2); }   // brass poles
  for (const rx of [cx - cw + 6, cx + cw - 7]) line(V, rx, 80, 0, rx, y1, zf - 6, G, 2);                  // tie rods to the wall
  for (const rx of [cx - cw + 6, cx + cw - 7]) V.box(rx - 1, 79, 0, rx + 2, 82, 1, G, 2);                 // their wall plates
  // ── the podium (right of the door), lamp + book; the doorman stands behind it (STAND)
  const px = hvx(STAND.x) + cx, pz = 20;
  V.box(px - 6, 0, pz, px + 6, 16, pz + 8, K.woodD); V.box(px - 6, 0, pz + 7, px + 6, 16, pz + 8, (x, y) => (x === px - 6 || x === px + 5 || y === 0 || y === 15) ? G : (y % 5 === 2 ? mix(K.woodD, 0x000000, .2) : undefined), 2);
  for (let k = 0; k < 3; k++) V.box(px - 7, 16 + k, pz + k, px + 7, 17 + k, pz + 9 - (2 - k) * 0, k === 2 ? G : K.woodD, k === 2 ? 2 : 0);   // stepped top, brass lip
  V.box(px - 5, 19, pz + 3, px + 1, 20, pz + 8, K.white); V.box(px - 2, 19, pz + 7, px - 1, 20, pz + 9, K.red); V.box(px - 5, 19, pz + 5, px + 1, 20, pz + 6, 0xe8e2d0);   // guest book + ribbon
  V.box(px + 3, 19, pz + 2, px + 4, 25, pz + 3, G, 2); V.box(px + 1, 25, pz + 1, px + 6, 27, pz + 4, K.green); V.box(px + 2, 24, pz + 2, px + 5, 25, pz + 3, 0xfff3c4, GLOW());   // banker's lamp
  // ── planters with cubic topiary (0.4 m cubes, never round)
  if (cx >= 52) for (const qx of [cx - 46, cx + 34]) { V.box(qx, 0, 2, qx + 12, 10, 14, INK); V.box(qx, 9, 2, qx + 12, 10, 14, G, 2); V.box(qx + 5, 10, 7, qx + 7, 16, 9, K.woodD);
    [[8, 16], [6, 24], [4, 30]].forEach(([s, y], k) => V.box(qx + 6 - s / 2, y, 8 - s / 2, qx + 6 + s / 2, y + s, 8 + s / 2, (x, yy, z) => ((x + yy + z + k) % 4 === 0) ? 0x1d8f3c : 0x25a748)); }
  return done(V, 'lobby', 'facade: the wall plane at the entrance centre, on the sidewalk (canopy to z 1.9 m; stand spot = STAND)', { stand: STAND });
}
