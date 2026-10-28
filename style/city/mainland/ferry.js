// MAINLAND v1 · SECOND CHANCE, with a real top deck. The hull, cabins and wheelhouse are the sea kit's ferry (districts/sea/boats.js,
// copied here, not edited: 0.2 m cells); its open upper deck was four teal slabs, the blocky top candidate A was marked down for. Here the
// slabs are gone and a 0.1 m deck goes on top: planking, slatted back-to-back benches, a striped sun canopy on posts, life rings on the
// rail, a funnel behind the wheelhouse and a pennant. Worker-safe. Bow toward +z, keel at y 0, centred (x across, z along).
import { Vol, meshed, stamp } from '../vox.js';
import { C, TOD, lit, pv, px } from '../districts/jail/lib.js';

const S2 = .2;
const volOf = (L, W, Hgt, s) => { const V = pv(W, Hgt, L, s, W / 2, L / 2); const P = (a, y, b, c, l = 0) => V.set(b, y, a, c, l); const box = (a0, y0, b0, a1, y1, b1, c, l = 0) => V.box(b0, y0, a0, b1, y1, a1, c, l); return { V, P, box }; };
function paintName(V, M, a0, ytop, col, sc = 1) {
  for (let j = 0; j < 7; j++) for (let i = 0; i < M.w; i++) { if (!M.at(i, j)) continue; for (let u = 0; u < sc; u++) for (let v = 0; v < sc; v++) { const y = ytop - j * sc - v;
    for (const side of [0, 1]) { const a = side ? a0 + i * sc + u : a0 + M.w * sc - 1 - (i * sc + u); let b = side ? 0 : V.nx - 1; while (b >= 0 && b < V.nx && !V.has(b, y, a)) b += side ? 1 : -1; if (b >= 0 && b < V.nx) V.set(b, y, a, col); } } } }

export function ferry() {
  const L = 120, W = 40, N = TOD.night, { V, P, box } = volOf(L, W, 48, S2), TEAL = 0x12b3a0, h = 2;
  const glass = (a, y) => N ? ((a * 7 + y) % 9 > 2 ? C.litHi : C.litLo) : (y > 18 + h ? C.glassHi : C.glass);
  for (const [b0, b1] of [[0, 9], [W - 9, W]]) for (let a = 0; a < L; a++) { const t = a / (L - 1), cut = t > .82 ? Math.round((t - .82) / .18 * 6) : 0;
    for (let b = b0; b < b1; b++) { const inner = b0 === 0 ? b1 - 1 - b : b - b0; if (inner < cut) continue; const edge = b === b0 || b === b1 - 1 || a === 0 || a === L - 1;
      for (let y = 0; y < 9 + h; y++) { if (!edge && y > 1 && y < 8 + h) continue; P(a, y, b, y < 4 ? 0x1f3a44 : y === 8 + h ? C.chalk : TEAL); } } }
  box(4, 6 + h, 1, 104, 9 + h, W - 1, (b, y, a) => y === 8 + h ? 0xb9b3a6 : TEAL);
  for (let a = 104; a < 112; a++) { const w = Math.round((a - 104) * 1.6); box(a, 6 + h, 1 + w, a + 1, 9 + h, W - 1 - w, TEAL); }
  const c0 = 9 + h; box(12, c0, 2, 96, c0 + 12, W - 2, C.chalk); box(12, c0 + 1, 2, 96, c0 + 2, W - 2, TEAL);
  for (let a = 13; a < 95; a++) for (const b of [2, W - 3]) for (let y = c0 + 4; y < c0 + 10; y++) V.set(b, y, a, (a - 13) % 7 === 6 ? C.chalk : glass(a, y), N ? 3 : 1);
  for (let b = 3; b < W - 3; b++) for (let y = c0 + 4; y < c0 + 10; y++) { V.set(b, y, 95, (b % 6 === 0) ? C.chalk : glass(b, y), N ? 3 : 1); V.set(b, y, 12, (b % 6 === 0) ? C.chalk : glass(b, y), N ? 3 : 1); }
  box(96, c0, 4, 100, c0 + 10, W - 4, C.chalk); box(12, c0 + 12, 2, 96, c0 + 13, W - 2, 0xc9c3b6);
  const u0 = c0 + 13; box(70, u0, 8, 92, u0 + 9, W - 8, C.chalk); box(69, u0 + 9, 7, 93, u0 + 10, W - 7, TEAL);
  for (let b = 9; b < W - 9; b++) for (let y = u0 + 3; y < u0 + 8; y++) V.set(b, y, 91, (b === W / 2) ? C.chalk : N ? C.litLo : 0x1d2a3a, N ? 3 : 1);
  for (let a = 71; a < 91; a++) for (const b of [8, W - 9]) for (let y = u0 + 3; y < u0 + 8; y++) V.set(b, y, a, a % 5 === 0 ? C.chalk : N ? C.litLo : 0x1d2a3a, N ? 3 : 1);
  box(79, u0 + 10, W / 2 - 1, 81, u0 + 18, W / 2 + 1, C.steelL); box(78, u0 + 18, W / 2 - 2, 82, u0 + 19, W / 2 + 2, C.steelL); V.set(W / 2, u0 + 19, 80, 0xffffff, lit(1));
  for (let a = 14; a < 68; a++) if (a % 4 === 0) for (const b of [3, W - 4]) V.box(b, u0, a, b + 1, u0 + 4, a + 1, C.chalk);
  for (let a = 14; a < 68; a++) for (const b of [3, W - 4]) V.set(b, u0 + 3, a, C.chalk); for (let b = 3; b < W - 3; b++) V.set(b, u0 + 3, 14, C.chalk);
  paintName(V, px('SECOND CHANCE'), 30, 10, C.chalk);
  const bank = meshed(V);
  // ── the new top deck (0.1 m), in metres: x across (−4 … 4), y up from the keel, z along (−12 stern … 12 bow); the cabin roof is y 4.8
  const D = new Vol(80, 34, 240, { s: .1, org: [-4, 4.8, -12], ground: false }), q = (m, o) => Math.round((m - o) / .1);
  const bx = (x0, y0, z0, x1, y1, z1, c, l = 0) => D.box(q(x0, -4), q(y0, 4.8), q(z0, -12), q(x1, -4), q(y1, 4.8), q(z1, -12), typeof c === 'function' ? (i, j, k) => c(i, j, k) : c, l);
  bx(-3.3, 4.8, -9.1, 3.3, 4.9, 1.7, (i, j, k) => (i % 3 === 0) ? 0xa87a4c : (k % 40 === 0 ? 0x9a6e44 : 0xc4955f));                           // planking, joints
  for (const s of [-1, 1]) {                                                                                                             // back-to-back benches facing the rails
    const xi = s * .5, xo = s * 1.05;
    for (let z = -7.8; z < .4; z += 2.1) { const z1 = z + 1.8;
      bx(Math.min(xi, xo), 5.25, z, Math.max(xi, xo), 5.35, z1, (i, j, k) => k % 2 ? 0x1b7f74 : TEAL);                                  // the slatted seat
      bx(s > 0 ? .4 : -.5, 5.35, z, s > 0 ? .5 : -.4, 5.85, z1, (i, j, k) => j % 2 ? TEAL : 0x1b7f74);                                   // the back
      for (const zz of [z + .1, z1 - .2]) bx(Math.min(xi, xo) + .05, 4.9, zz, Math.max(xi, xo) - .05, 5.25, zz + .1, 0x8a9099); } }
  for (let x = -2.6; x < 2.6; x += 1.9) { bx(x, 5.25, -8.9, x + 1.6, 5.35, -8.5, TEAL); bx(x, 5.35, -9.05, x + 1.6, 5.8, -8.95, TEAL); }    // the stern bench
  for (const [x, z] of [[-2.7, -7.9], [2.6, -7.9], [-2.7, -.7], [2.6, -.7]]) bx(x, 4.9, z, x + .1, 7.5, z + .1, C.chalk);                   // canopy posts
  bx(-3.0, 7.5, -8.3, 3.0, 7.6, -.3, (i) => ((i / 5) | 0) % 2 ? 0xffe23a : 0xf7f7f2); bx(-3.0, 7.3, -8.3, 3.0, 7.5, -8.2, 0xffe23a); bx(-3.0, 7.3, -.4, 3.0, 7.5, -.3, 0xffe23a);   // the striped canopy + valances
  for (const [s, z] of [[-1, -5.4], [1, -3.2], [-1, -1.0], [1, -6.8]]) { const x = s * 3.5;                                              // life rings on the rails
    bx(x - .05, 5.1, z - .3, x + .05, 5.2, z + .3, 0xff7a1a); bx(x - .05, 5.7, z - .3, x + .05, 5.8, z + .3, 0xff7a1a); bx(x - .05, 5.2, z - .3, x + .05, 5.7, z - .2, 0xf7f7f2); bx(x - .05, 5.2, z + .2, x + .05, 5.7, z + .3, 0xf7f7f2); }
  bx(-.6, 4.9, .6, .6, 7.2, 1.6, (i, j) => j > 20 ? C.ink : (j > 14 && j < 18) ? 0xf7f7f2 : TEAL);                                      // the funnel
  bx(-.05, 4.9, -9.6, .05, 7.6, -9.5, C.steelL); bx(.05, 7.0, -9.6, .9, 7.5, -9.5, 0xff4fa3);                                             // the pennant
  bx(-2.9, 4.9, 3.0, -2.2, 5.3, 5.8, 0xf7f7f2); bx(2.2, 4.9, 3.0, 2.9, 5.3, 5.8, 0xf7f7f2);                                            // life-raft canisters by the wheelhouse
  stamp(meshed(D), bank, 0, 0, 0, 0);
  bank.kind = 'ferry'; return bank;
}
// where people stand on the new deck (ferry-local metres: x, y, z, facing yaw)
export const DECK = [[-1.6, 4.9, -4.2, -Math.PI / 2], [1.5, 4.9, -6.3, Math.PI / 2], [0, 4.9, -9.3, Math.PI], [2.9, 4.9, -2.0, Math.PI / 2 + .3]];
