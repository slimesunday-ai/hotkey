// PLEASANTVIEW · PLEASANTVIEW PARK (block −1,5; the sim's park at −16,176) · owner: the Pleasantview section agent. The district's green:
// a white bandstand with a red octagon roof, a cupola and a gold finial in the middle of a paved ring; four paths out to the four streets;
// a playground on its rubber tiles (swings, the slide tower, a seesaw), a duck pond with a fountain, stone chess tables under the oaks,
// benches round the ring, globe lamps, and the park's name on a brick wall at the Pine St gate. The south-west corner is a bare paved
// apron: Jay & Pine's dealing hotspot (the sim-state layer) stands there, at the corner nearest the crossing.
import { blockCtx } from '../engine.js';
import { GEN } from '../gen.js';
import { REG } from '../audit.js';
import { frame, TOD } from '../kit.js';
import { Vol } from '../vox.js';
import { PAL, CV, SIDE, hash, shade } from '../style.js';
import { bench, trashCan, milkCrate, phoneBooth } from '../props.js';
import { M, pv, done, cyl, ring, line, txt, tw, logSign, framed, frameR, kerb, keepB, off } from '../districts/suburbs/brush.js';
import * as SP from '../districts/suburbs/props.js';
import { wput } from '../districts/suburbs/yard.js';

const WHITE = PAL.white, INK = PAL.ink, RED = 0xe8232a, GOLD = PAL.gold, PAVE = 0xd9d2c3, JOINT = 0xc4bcaa, WATER = 0x2fb8e8, STONE = 0xb9b3a8;
const lit = (d = 1) => TOD.night ? 3 : d;
// ── the park's props (0.1 grain, base centre, facing +z)
const globe = () => M('pglobe', 'lamp', () => { const V = pv(6, 38, 6); V.box(1, 0, 1, 5, 2, 5, INK); V.box(2, 2, 2, 4, 30, 4, INK); V.box(1, 30, 1, 5, 31, 5, INK); cyl(V, 3, 3, 2.6, 31, 37, 0xfff6dc, lit(1)); return done(V, 'lamp'); });
const chess = v => M('chess' + (v % 2), 'table', () => { const V = pv(24, 9, 24, 12, 12);
  V.box(10, 0, 10, 14, 7, 14, STONE); V.box(7, 7, 7, 17, 8, 17, (x, y, z) => ((x + z) % 2) ? INK : WHITE); V.box(6, 7, 6, 18, 8, 7, STONE); V.box(6, 7, 17, 18, 8, 18, STONE); V.box(6, 7, 6, 7, 8, 18, STONE); V.box(17, 7, 6, 18, 8, 18, STONE);
  for (const [x, z] of [[1, 10], [20, 10], [10, 1], [10, 20]]) cyl(V, x + 1.5, z + 2, 1.6, 0, 4, STONE); return done(V, 'table'); });
const slideTower = () => M('ptower', 'playground', () => { const V = pv(30, 34, 22, 15, 11), Y = 0xffe23a, B = 0x2f5bff;
  for (const [x, z] of [[1, 1], [11, 1], [1, 11], [11, 11]]) V.box(x, 0, z, x + 2, 26, z + 2, RED); V.box(1, 12, 1, 13, 14, 13, B); V.box(0, 24, 0, 14, 26, 14, Y);   // the tower and its roof
  for (let k = 0; k < 6; k++) V.box(0, 26 + k, k, 14, 27 + k, 14 - k, k % 2 ? RED : Y);
  for (let k = 0; k < 12; k++) V.box(13 + k, 12 - k, 4, 15 + k, 13 - k, 10, Y); for (const z of [3, 10]) for (let k = 0; k < 12; k++) V.box(13 + k, 13 - k, z, 15 + k, 15 - k, z + 1, Y);   // the slide
  for (let y = 0; y < 12; y += 3) V.box(3, y, 13, 11, y + 1, 14, B); V.box(3, 0, 13, 4, 12, 14, B); V.box(10, 0, 13, 11, 12, 14, B);           // the ladder
  return done(V, 'playground'); });
const seesaw = () => M('pseesaw', 'playground', () => { const V = pv(30, 8, 6); V.box(13, 0, 1, 17, 4, 5, INK); for (let x = 0; x < 30; x++) { const y = 2 + Math.round((x - 15) * .14); V.box(x, y, 2, x + 1, y + 1, 4, x < 15 ? RED : 0x2f5bff); } V.box(1, 1, 1, 3, 4, 5, 0xffe23a); V.box(27, 5, 1, 29, 8, 5, 0xffe23a); return done(V, 'playground'); });
const duck = v => M('duck' + (v % 2), 'duck', () => { const V = pv(4, 4, 6); V.box(0, 0, 0, 4, 2, 5, v % 2 ? WHITE : 0x8a6a3a); V.box(1, 2, 3, 3, 4, 5, v % 2 ? WHITE : 0x1f7a45); V.box(1, 2, 5, 3, 3, 6, 0xff7a1a); return done(V, 'duck'); });
// the park's name: brick pillars and a green board, white letters (0.05 grain), facing the Pine St gate
const parkSign = () => M('psign', 'sign', () => { const s = .05, t1 = 'PLEASANTVIEW', t2 = 'PARK · EST 1955', w = tw(t1) + 12, V = pv(w + 16, 30, 8, (w + 16) / 2, 4, s);
  for (const x of [0, w + 8]) { V.box(x, 0, 0, x + 8, 26, 8, (xx, y) => y % 3 === 2 ? 0x8a4430 : 0x9c4a34); V.box(x - 0, 26, 0, x + 8, 28, 8, 0xd9d2c3); }
  V.box(8, 6, 2, w + 8, 26, 6, 0x1f5c4a); V.box(8, 0, 3, w + 8, 6, 5, 0x9c4a34);
  txt(V, t1, 8 + ((w - tw(t1)) >> 1), 23, 6, WHITE, lit(0)); txt(V, t2, 8 + ((w - tw(t2)) >> 1), 13, 6, GOLD, lit(0)); return done(V, 'sign'); });

export function pleasantviewPark(bank, b, A) {
  // (SPREAD: authored in today's metres, the block's frame: brush.js framed / frameR / kerb; the plain ctx for wput, which reads the registry)
  const kit = GEN.kit, raw = blockCtx(bank, b, A, kit), ctx = framed(raw), R = frameR(raw), [ox, oz] = off(b), wp = (bk, x, z, o) => wput(raw, bk, ...kerb(x, z), o), cx = -17, cz = 176, rR = 5.6, rr = 4.3;
  REG.strict = true;
  try {
    // ── the ground: paved ring round the bandstand, four paths to the streets, the corner apron (walkable)
    ctx.group('paths');
    const G = ctx.volume(R.x0, SIDE, R.z0, R.x1, SIDE + .1, R.z1, { walk: true });
    G.box(0, 0, 0, G.nx, 1, G.nz, (x, y, z) => { const wx = R.x0 + (x + .5) * CV, wz = R.z0 + (z + .5) * CV, dx = wx - cx, dz = wz - cz, d = Math.hypot(dx, dz);
      const ringP = d > rr && d < rR, spoke = (Math.abs(dx) < .8 && d >= rr) || (Math.abs(dz) < .8 && d >= rr), apron = wx < -23.6 && wz > 183.6, diag = Math.abs((wx - cx) + (wz - cz)) < 1 && wx < cx - 3 && wz > cz + 3;
      if (!(ringP || spoke || apron || diag)) return undefined; return ((x >> 3) + (z >> 3)) % 2 && (x % 8 === 0 || z % 8 === 0) ? JOINT : PAVE; });
    ctx.finish();
    // the dealing corner's apron stays bare (simstate/layer.js puts Jay & Pine's hotspot here): nothing may be placed on it
    REG.keep(keepB([-28, SIDE, 185.2, -25.1, SIDE + 2.8, 188]), 'simcorner');
    // ── the bandstand: a raised octagon deck, eight white posts, a rail, a red octagon roof with a white fascia, a cupola, a gold finial
    ctx.group('bandstand');
    const n = 80, V = new Vol(n, 76, n, { s: CV, org: [cx + ox - n * CV / 2, SIDE, cz + oz - n * CV / 2] }), c = n / 2, oct = (x, z, r) => { const a = Math.abs(x + .5 - c), b2 = Math.abs(z + .5 - c); return Math.max(a, b2, (a + b2) / 1.41) <= r; };
    ctx.mass(V, [cx - 3.3, cz - 3.3, cx + 3.3, cz + 3.3], { top: SIDE + 7.8, roofY: SIDE + .7 });
    for (let x = 0; x < n; x++) for (let z = 0; z < n; z++) {
      if (oct(x, z, 32)) V.box(x, 0, z, x + 1, 5, z + 1, oct(x, z, 30) ? ((x + z) % 2 ? 0xe6e1d6 : 0xf2efe6) : WHITE);                      // the deck, a white skirt
      if (oct(x, z, 33) && !oct(x, z, 32) && Math.abs(x + .5 - c) > 4 && Math.abs(z + .5 - c) > 4) V.box(x, 0, z, x + 1, 2, z + 1, 0x8f929b);   // the plinth
      if (oct(x, z, 31) && !oct(x, z, 30) && !(Math.abs(x + .5 - c) < 5 && z > c)) V.box(x, 5, z, x + 1, 13, z + 1, (xx, y) => (y === 12 || (x + z) % 3 === 0) ? WHITE : undefined);   // the rail (open at the steps)
    }
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2 + Math.PI / 8, x = Math.round(c + Math.cos(a) * 29 - 1), z = Math.round(c + Math.sin(a) * 29 - 1); V.box(x, 5, z, x + 3, 36, z + 3, WHITE); }
    for (let x = 0; x < n; x++) for (let z = 0; z < n; z++) if (oct(x, z, 36) && !oct(x, z, 27)) V.box(x, 33, z, x + 1, 36, z + 1, WHITE);   // the ring beam: posts to roof
    for (let y = 36; y < 58; y++) { const r = 36 - (y - 36) * 1.45; if (r < 2) break; for (let x = 0; x < n; x++) for (let z = 0; z < n; z++) if (oct(x, z, r) && !oct(x, z, r - 3.2)) V.set(x, y, z, y < 38 ? WHITE : (y % 2 ? RED : shade(RED, .88))); }
    for (let x = 0; x < n; x++) for (let z = 0; z < n; z++) { if (oct(x, z, 6)) V.box(x, 51, z, x + 1, 57, z + 1, (xx, y) => y > 55 ? RED : (y > 52 && (x + z) % 2) ? 0x9fd8ff : WHITE); if (oct(x, z, 7)) V.box(x, 57, z, x + 1, 58, z + 1, RED); }
    for (let k = 0; k < 6; k++) { const r = 6 - k; for (let x = 0; x < n; x++) for (let z = 0; z < n; z++) if (oct(x, z, r)) V.set(x, 58 + k, z, RED); }
    V.box(c - 2, 64, c - 2, c + 2, 66, c + 2, GOLD, 2); V.box(c - 1, 66, c - 1, c + 1, 71, c + 1, GOLD, 2);   // a gold spire (it only ever tapers: nothing that reads as a cross)
    for (let s = 0; s < 3; s++) V.box(c - 5, 0, n - 7 + s * 2 - 4, c + 5, 5 - s * 2, n - 5 + s * 2 - 4, STONE);                               // steps down to the south path
    ctx.finish();
    // ── the playground (north-east) on red and blue rubber tiles; the duck pond (south-east); chess tables (north-west)
    ctx.group('playground');
    const P = ctx.volume(-13.8, SIDE, 164.6, -7.2, SIDE + .1, 171, { walk: true }); P.box(0, 0, 0, P.nx, 1, P.nz, (x, y, z) => (x < 2 || z < 2 || x >= P.nx - 2 || z >= P.nz - 2) ? 0x2f5bff : ((x >> 3) + (z >> 3)) % 2 ? 0xe8232a : 0xd8403a);
    ctx.finish();
    // the trees first (the biggest things), their crowns kept inside the park
    ctx.group('trees');
    for (const [x, z, sp, sz] of [[-26.6, 173.6, 'oak', 1], [-19.4, 165.4, 'maple', 1], [-7.8, 173.4, 'maple', 1], [-24.4, 180.2, 'oak', 1], [-14.6, 187.2, 'redmaple', 0], [-6.9, 178.4, 'ornamental', 0], [-26.8, 165.8, 'oak', 0]])
      wp(SP.tree(sp, sz, Math.round(-x * 3)), x, z, { reach: .8 });
    ctx.group('playground');
    wp(SP.swingset(1), -11.2, 166.4, { reach: .4, loose: true }); wp(slideTower(), -8.9, 169.3, { rot: 3, reach: .4, loose: true }); wp(seesaw(), -12.4, 169.4, { rot: 1, reach: .3, loose: true });
    ctx.group('pond');
    const PD = ctx.volume(-14.4, SIDE, 179.6, -7.2, SIDE + .8, 186.8, { walk: true }), pc = [(-14.4 - 7.2) / 2, (179.6 + 186.8) / 2], pcx = PD.nx >> 1, pcz = PD.nz >> 1;
    PD.box(0, 0, 0, PD.nx, 2, PD.nz, (x, y, z) => { const wx = -14.4 + (x + .5) * CV, wz = 179.6 + (z + .5) * CV, e = ((wx - pc[0]) / 3.5) ** 2 + ((wz - pc[1]) / 3.5) ** 2 + .18 * Math.sin(wx * 2.1) * Math.cos(wz * 1.7);
      if (e > 1) return undefined; if (e > .78) return y ? STONE : 0x9a948a; return y ? undefined : ((x * 7 + z * 3) % 11 === 0 ? 0x7fe3f5 : WATER); }, 1);
    PD.box(pcx - 2, 0, pcz - 2, pcx + 2, 3, pcz + 2, STONE); PD.box(pcx - 1, 3, pcz - 1, pcx + 1, 7, pcz + 1, 0xdff6ff, 1); ctx.finish();   // the fountain in the middle
    ctx.group('chess');
    wp(chess(0), -24.4, 168.2, { reach: .4 }); wp(chess(1), -21.4, 169.6, { reach: .4 }); wp(chess(0), -23.8, 171.2, { reach: .4 });
    // ── the name on a brick wall by the Pine St gate (the park's own sign), globe lamps, benches round the ring, cans, trees
    ctx.group('gate');
    if (wp(parkSign(), -20.5, 187.25, { reach: .3 })) logSign('PLEASANTVIEW PARK', ...kerb(-20.5, 187.25));
    ctx.group('furniture');
    for (const [x, z] of [[-15.6, 187.3], [-6.8, 177.2], [-27.2, 174.6], [-18.4, 164.6]]) wp(globe(), x, z, { reach: .4 });   // at the four gates (the north one west of its path: the subway's stairs are east of it, transit.js)
    // benches round the ring, their backs to the lawn, facing the bandstand (bench() faces −z)
    for (const [x, z, rot] of [[-19.6, 169.6, 2], [-15, 170, 2], [-19.6, 182.4, 0], [-23.2, 178.6, 1], [-10.8, 173.4, 3]]) wp(bench(), x, z, { rot, slide: [rot % 2 ? 0 : 1, rot % 2 ? 1 : 0], reach: .5 });
    wp(trashCan(0x1f5c4a), -15.2, 185.4, { reach: .5 }); wp(trashCan(0x1f5c4a), -18.9, 166.2, { reach: .5 });
    for (let k = 0; k < 5; k++) wp(duck(k), pc[0] - 1.8 + (k % 3) * 1.4, pc[1] - 1.6 + (k >> 1) * 1.5, { rot: k % 4, reach: .3, loose: true });
    // ── Jay & Pine's corner life (downtown's dealing corners, baseline): a milk-crate seat in the Jay St kerb strip just past the corner
    // square, a payphone at the Pine St frontage; clear of the walkers' corner lines, the clear path and the hotspot's square
    ctx.group('corner');
    ctx.put(milkCrate(0x14a83b), -29.45, 185.9, { reach: 0 }); ctx.put(milkCrate(PAL.red), -29.45, 185.3, { reach: 0 }); ctx.put(milkCrate(0x2f5bff), -29.45, 185.9, { y: SIDE + .5, reach: 0 });
    ctx.put(phoneBooth(), -21.4, 188.55, { rot: 0, slide: [1, 0], reach: .4 });
  } finally { REG.strict = false; }
  ctx.finish();
}
