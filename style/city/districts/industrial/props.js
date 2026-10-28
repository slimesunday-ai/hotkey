// THE SUPPLY SIDE · props (owner: the supply agent). Authored once in city voxels at the base centre facing +z, memoized, stamped
// through ctx.put (engine.js: checked against masses, facades, doorways and each other). Sized to the big-head body (STYLE §1).
import { C, PAL, CV, TOD, pv, done, memo, cyl, cylX, px, stencil, hand, vtext, vtextX, inkOn, lit, shade } from './lib.js';

const AIRV = -1;
// ── words on a vehicle or box side, split into lines that fit a region (len voxels along the side, up to hMax tall): the first line
// as big as it can go (3× → 1×), the rest 1×. Returns the lines as [mask, scale, ytop]; the caller draws them.
export function sideLines(name, len, hMax, top) {
  const words = name.split(' '), lines = []; let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (px(t).w <= len) cur = t; else { if (cur) lines.push(cur); cur = w; } } if (cur) lines.push(cur);
  const out = []; let y = top;
  lines.forEach((t, k) => { const M = px(t); let sc = k === 0 ? 3 : 1; while (sc > 1 && (M.w * sc > len || 7 * sc + (lines.length - 1) * 9 > hMax)) sc--; if (M.w * sc > len) return; out.push([M, sc, y]); y -= 7 * sc + 2; });
  return out;
}
// ── container marks: a line's emblem, ~12 × 12 voxels on a z plane (x0, y0 = its lower-left corner as seen by the viewer)
function mark(V, kind, x0, y0, z, c, dir = 1) {
  const S = (x, y) => V.set(dir > 0 ? x0 + x : x0 + 11 - x, y0 + y, z, c);
  for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) { const dx = x - 5.5, dy = y - 5.5, r = Math.hypot(dx, dy); let on = false;
    if (kind === 'ring') on = r < 6 && r > 3.2; else if (kind === 'sun') on = r < 3.5 || (r < 6.2 && ((Math.atan2(dy, dx) * 8 / Math.PI + 16) | 0) % 2 === 0 && r > 4.4);
    else if (kind === 'star') { const a = Math.atan2(dy, dx) + Math.PI / 2, k = Math.cos(5 * a); on = r < 2.6 + 3.2 * Math.max(0, k); }
    else if (kind === 'diamond') on = Math.abs(dx) + Math.abs(dy) < 6.2; else if (kind === 'wave') on = Math.abs(dy - Math.sin(x * .9) * 2.2) < 1.6 || Math.abs(dy + 4 - Math.sin(x * .9 + 1) * 2) < 1.2;
    else if (kind === 'bar') on = (y >= 2 && y < 5) || (y >= 7 && y < 10); else if (kind === 'wing') on = y > 3 && y < 3 + (x < 6 ? x : 11 - x) + 3 && Math.abs(dx) < 6;
    else if (kind === 'anchor') on = (Math.abs(dx) < 1 && y > 1) || (y >= 8 && y < 10 && Math.abs(dx) < 4) || (r > 3.6 && r < 5.4 && dy < -.5) || (y >= 10 && Math.abs(dx) < 2);
    if (on) S(x, y); }
}
// ── the shipping container: 40 ft (12.2 × 2.4 × 2.6 m) or 20 ft (6.1 m), length along x, corrugated long sides, the line's name and mark
// on both long sides, doors with four locking bars on the +x end, dark rails and corner castings. One colour per line.
export const container = (line, col, mk, len = 40) => memo('ctr' + line + col + len, () => {
  const L = len === 40 ? 122 : 60, W = 24, Hh = 26, V = pv(L, Hh, W), dark = shade(col, .62), rib = shade(col, .86), fg = inkOn(col);
  V.box(0, 0, 0, L, Hh, W, col);
  for (let x = 4; x < L - 3; x += 4) for (const z of [0, W - 1]) V.box(x, 2, z, x + 1, Hh - 2, z + 1, AIRV);                            // corrugation: every 4th column steps in
  V.box(0, Hh - 1, 0, L, Hh, W, (x, y, z) => x % 6 === 0 ? rib : col);                                                                   // roof ribs
  V.box(0, 0, 0, L, 2, W, dark); V.box(0, Hh - 2, 0, L, Hh, 1, dark); V.box(0, Hh - 2, W - 1, L, Hh, W, dark);                      // rails
  for (const x of [0, L - 3]) for (const z of [0, W - 3]) { V.box(x, 0, z, x + 3, 3, z + 3, shade(col, .45)); V.box(x, Hh - 3, z, x + 3, Hh, z + 3, shade(col, .45)); }   // corner castings
  V.box(L - 1, 2, 3, L, Hh - 3, W - 3, rib); V.box(L - 1, 2, W >> 1, L, Hh - 3, (W >> 1) + 1, dark);                                   // doors (+x end)
  for (const z of [4, 8, 15, 19]) V.box(L - 1, 3, z, L, Hh - 4, z + 1, C.steelL);                                                       // four lock bars
  const M = px(line), sc = len === 40 ? 2 : 1, tw = M.w * sc + 14, x0 = Math.max(4, (L - tw) >> 1), yt = sc === 2 ? 20 : 17, my = sc === 2 ? yt - 13 : yt - 9;
  if (tw <= L - 6) { vtext(V, M, x0 + 14, yt, W - 1, fg, { sc, dir: 1 }); mark(V, mk, x0, my, W - 1, fg, 1);
    vtext(V, M, L - x0 - 14 - M.w * sc, yt, 0, fg, { sc, dir: -1 }); mark(V, mk, L - x0 - 12, my, 0, fg, -1); }
  return done(V, 'container'); });

// ── pallets and what stands on them (1.2 × 1.0 m, loads to ~1.4 m)
const palletBase = (V, x0, z0, w = 12, d = 10) => { V.box(x0, 0, z0, x0 + w, 1, z0 + d, (x, y, z) => (z - z0) % 3 === 0 ? C.woodD : undefined); V.box(x0, 1, z0, x0 + w, 2, z0 + d, (x, y, z) => (x - x0) % 3 === 2 ? undefined : C.woodL); };
export const pallet = (load, seed = 0) => palletV(load, ((seed % 12) + 12) % 12);   // (cleanup pass: the template was keyed seed % 4 but drawn from
// seed % 3, so a pallet was whichever one asked first: now one per load and seed % 12, drawn from that)
const palletV = (load, seed) => memo('pal' + load + seed, () => { const V = pv(12, 18, 10); palletBase(V, 0, 0);
  if (load === 'boxes') { const n = 2 + (seed % 3); for (let k = 0; k < n; k++) V.box(k % 2, 2 + k * 4, 0, 12 - (k % 2), 6 + k * 4, 10, (x, y, z) => (y === 5 + k * 4 && x % 6 === 2) ? 0xd9b77a : ((x + z) % 7 === 0 ? 0xb88a52 : 0xc99a5e)); V.box(0, 2, 4, 12, 2 + n * 4, 5, 0xe8e2d0); }
  else if (load === 'sacks') { for (let k = 0; k < 3; k++) V.box(1, 2 + k * 3, 1, 11, 5 + k * 3, 9, (x, y, z) => (y === 4 + k * 3 && (x + z + k) % 5 === 0) ? 0xd8cfb8 : [0xece4cc, 0xe0d6b9, 0xf1ead6][(k + seed) % 3]); }
  else if (load === 'bricks') { for (let k = 0; k < 4; k++) V.box(0, 2 + k * 2, 0, 12, 4 + k * 2, 10, (x, y, z) => (x % 3 === 0 || z % 5 === 0) ? 0xb3a89a : 0xb5553a); V.box(5, 2, 0, 7, 10, 10, 0xeae6de); }
  else if (load === 'empty') { for (let k = 1; k < 5; k++) { V.box(0, k * 2, 0, 12, k * 2 + 1, 10, (x, y, z) => (z % 3 === 0) ? C.woodD : undefined); V.box(0, k * 2 + 1, 0, 12, k * 2 + 2, 10, (x, y, z) => (x % 3 === 2) ? undefined : C.wood); } }
  else if (load === 'crates') V.box(0, 2, 0, 12, 10, 10, (x, y, z) => (x === 0 || x === 11 || y === 2 || y === 9 || z === 0 || z === 9 || (x + y) % 8 === 0) ? C.woodD : C.woodL);
  else if (load === 'fish') { for (let k = 0; k < 3; k++) { const c = [0x2f5bff, 0xe8e2d0, 0xff7a1a][(k + seed) % 3]; V.box(0, 2 + k * 3, 0, 12, 5 + k * 3, 10, c); V.box(1, 4 + k * 3, 1, 11, 5 + k * 3, 9, 0xdff4ff); } }
  return done(V, 'pallet'); });
// oil drums: 0.58 m across, 0.9 m tall, rolling hoops; a group of 2–4 on a pallet, or one loose
const drumIn = (V, cx, cz, y0, c) => { cyl(V, cx, cz, 2.9, y0, y0 + 9, (x, y) => (y - y0 === 3 || y - y0 === 6) ? shade(c, .75) : c); cyl(V, cx, cz, 2.2, y0 + 9, y0 + 10, shade(c, .8)); V.set(Math.round(cx) + 1, y0 + 10, Math.round(cz), C.steelD); };
export const drums = (c, n = 3) => memo('drums' + c + n, () => { const V = pv(12, 12, 12); palletBase(V, 0, 1, 12, 10);
  [[3, 3.5], [8.5, 3.5], [3, 8.5], [8.5, 8.5]].slice(0, n).forEach(([x, z], k) => drumIn(V, x, z, 2, k === 1 && c !== C.hazard ? C.hazard : c)); return done(V, 'drums'); });
export const drum = c => memo('drum' + c, () => { const V = pv(6, 11, 6); drumIn(V, 3, 3, 0, c); return done(V, 'drum'); });
// ── forklift: counterweight body, overhead guard, mast and forks at the front (+z); 1.2 × 2.6 × 2.3 m
export const forklift = c => memo('fork' + c, () => { const V = pv(12, 23, 26, CV, 6, 13);
  for (const [x, z] of [[0, 4], [9, 4], [0, 15], [9, 15]]) { V.box(x, 0, z, x + 3, 4, z + 5, C.rubber); V.box(x + (x ? 2 : 0), 1, z + 1, x + (x ? 3 : 1), 3, z + 4, C.steelL); }
  V.box(1, 3, 2, 11, 9, 20, c); V.box(1, 9, 2, 11, 12, 7, shade(c, .8)); V.box(3, 9, 8, 9, 11, 14, C.ink);                                // body, counterweight, seat
  for (const x of [1, 10]) for (const z of [7, 17]) V.box(x, 9, z, x + 1, 21, z + 1, C.ink); V.box(1, 21, 7, 11, 22, 18, C.ink);         // overhead guard
  V.box(2, 1, 20, 4, 23, 21, C.steelD); V.box(8, 1, 20, 10, 23, 21, C.steelD); V.box(2, 12, 20, 10, 13, 21, C.steelD); V.box(2, 22, 20, 10, 23, 21, C.steelD);   // mast
  V.box(2, 2, 21, 10, 7, 22, C.steelD); for (const x of [3, 8]) V.box(x, 1, 21, x + 1, 2, 26, C.steelL);                                // carriage, forks
  V.box(4, 22, 12, 8, 23, 14, 0xffa51a, TOD.night ? 3 : 1); return done(V, 'forklift'); });
// ── wheels for the vehicles (a pair on an axle across x at z)
const axle = (V, x0, x1, z, r = 4) => { for (const x of [x0, x1 - 3]) { V.box(x, 0, z - r, x + 3, 2 * r - 1, z + r, C.rubber); V.box(x + (x === x0 ? 0 : 2), 2, z - 2, x + (x === x0 ? 1 : 3), 2 * r - 3, z + 2, C.steelL); } };
// box truck: cab at the front (+z), a tall box with the company on both sides and the roll-up at the back; 2.6 × 7.4 × 3.4 m
export const boxTruck = (col, name, cab = C.white) => memo('btruck' + col + name + cab, () => { const W = 26, V = pv(W, 35, 74);
  axle(V, 0, W, 10); axle(V, 0, W, 17); axle(V, 0, W, 61);
  V.box(1, 4, 2, W - 1, 34, 54, col); V.box(1, 33, 2, W - 1, 34, 54, shade(col, .9)); V.box(1, 4, 0, W - 1, 6, 2, C.steelD);            // the box, its roof, the bumper step
  V.box(2, 6, 1, W - 2, 33, 2, (x, y) => y % 3 === 0 ? shade(col, .82) : shade(col, .94));                                               // roll-up door (−z end)
  V.box(1, 4, 54, W - 1, 22, 72, cab); V.box(1, 22, 55, W - 1, 24, 66, cab); V.box(2, 13, 71, W - 2, 21, 72, 0x9fd8ff, 1);           // cab, roof, windscreen
  for (const x of [1, W - 2]) V.box(x, 13, 58, x + 1, 20, 68, 0x9fd8ff, 1); V.box(1, 4, 72, W - 1, 8, 74, C.steelD);                 // side windows, bumper
  V.box(2, 8, 72, 6, 11, 73, 0xfff6d0, TOD.night ? 3 : 1); V.box(W - 6, 8, 72, W - 2, 11, 73, 0xfff6d0, TOD.night ? 3 : 1);
  const fg = inkOn(col); for (const [M, sc, y] of sideLines(name, 48, 24, 30)) { const z0 = 3 + ((50 - M.w * sc) >> 1); vtextX(V, M, z0, y, W - 1, fg, { sc, dir: 1 }); vtextX(V, M, z0, y, 0, fg, { sc, dir: -1 }); }
  return done(V, 'truck'); });
// semi trailer dropped at a dock on its landing legs: 2.6 × 12.2 × 3.9 m, the company along both sides
export const trailer = (col, name) => memo('trl' + col + name, () => { const W = 26, V = pv(W, 40, 122);
  axle(V, 0, W, 10, 4); axle(V, 0, W, 19, 4); V.box(2, 7, 2, W - 2, 12, 118, C.steelD); for (const x of [3, W - 5]) V.box(x, 0, 96, x + 2, 12, 98, C.steelD);
  V.box(1, 12, 0, W - 1, 39, 122, col); V.box(1, 38, 0, W - 1, 39, 122, (x, y, z) => z % 8 === 0 ? shade(col, .88) : col);
  V.box(2, 13, 0, W - 2, 38, 1, shade(col, .8)); for (const x of [6, 11, 15, 20]) V.box(x, 14, 0, x + 1, 37, 1, C.steelL);                // rear doors + bars
  const fg = inkOn(col); for (const [M, sc, y] of sideLines(name, 108, 24, 35)) { const z0 = 8 + ((110 - M.w * sc) >> 1); vtextX(V, M, z0, y, W - 1, fg, { sc, dir: 1 }); vtextX(V, M, z0, y, 0, fg, { sc, dir: -1 }); }
  return done(V, 'trailer'); });
// semi tractor (day cab): 2.6 × 5.6 × 3.3 m, facing +z
export const tractor = col => memo('trac' + col, () => { const W = 26, V = pv(W, 34, 56);
  axle(V, 0, W, 8, 5); axle(V, 0, W, 18, 5); axle(V, 0, W, 46, 5); V.box(2, 8, 2, W - 2, 11, 30, C.steelD); V.box(5, 11, 6, W - 5, 13, 16, C.ink);   // chassis, fifth wheel
  V.box(1, 8, 30, W - 1, 30, 44, col); V.box(1, 30, 31, W - 1, 33, 43, shade(col, .85)); V.box(1, 8, 44, W - 1, 20, 54, col); V.box(2, 8, 54, W - 2, 18, 56, C.steelL, 2);   // cab, visor roof, hood, grille
  V.box(2, 20, 43, W - 2, 28, 44, 0x9fd8ff, 1); for (const x of [1, W - 2]) V.box(x, 20, 33, x + 1, 28, 41, 0x9fd8ff, 1);
  for (const x of [1, W - 2]) V.box(x, 20, 28, x + 1, 33, 30, C.steelL, 2);                                                               // exhaust stacks behind the cab
  V.box(2, 12, 55, 6, 15, 56, 0xfff6d0, TOD.night ? 3 : 1); V.box(W - 6, 12, 55, W - 2, 15, 56, 0xfff6d0, TOD.night ? 3 : 1);
  return done(V, 'truck'); });
// ── the small hard stuff
export const bollard = (c = C.hazard) => memo('boll' + c, () => { const V = pv(3, 11, 3); V.box(0, 0, 0, 3, 11, 3, (x, y) => y >= 9 ? C.ink : c); return done(V, 'bollard'); });
export const mooring = () => memo('moor', () => { const V = pv(7, 8, 7); cyl(V, 3.5, 3.5, 2.2, 0, 5, C.ink); cyl(V, 3.5, 3.5, 3.4, 5, 7, C.ink); cyl(V, 3.5, 3.5, 2.2, 7, 8, C.ink); return done(V, 'mooring'); });
export const cone = () => memo('cone', () => { const V = pv(5, 8, 5); V.box(0, 0, 0, 5, 1, 5, C.orange); V.box(1, 1, 1, 4, 4, 4, C.orange); V.box(1, 4, 1, 4, 5, 4, C.chalk); V.box(2, 5, 2, 3, 8, 3, C.orange); return done(V, 'cone'); });
export const barrier = c => memo('jersey' + c, () => { const V = pv(24, 8, 6); for (let y = 0; y < 8; y++) { const t = y < 2 ? 0 : y < 4 ? 1 : 2; V.box(0, y, t, 24, y + 1, 6 - t, x => c === C.conc ? (x % 12 === 0 ? C.concD : c) : ((x >> 2) & 1 && y > 3 ? C.chalk : c)); } return done(V, 'barrier'); });
export const spool = c => memo('spool' + c, () => { const V = pv(9, 13, 12); cylX(V, 0, 1, 6, 6, 6, C.woodL); cylX(V, 8, 9, 6, 6, 6, C.woodL); cylX(V, 1, 8, 6, 6, 4, c); cylX(V, 1, 8, 6, 6, 1.5, C.woodD); return done(V, 'spool'); });
export const pipeStack = c => memo('pipes' + c, () => { const V = pv(40, 10, 14); for (const x of [4, 34]) V.box(x, 0, 0, x + 2, 2, 14, C.woodD);
  for (const [y, zs] of [[3.9, [2.5, 6.5, 10.5]], [7.3, [4.5, 8.5]]]) for (const z of zs) cylX(V, 0, 40, y, z, 1.9, (x, yy, zz) => Math.hypot(yy + .5 - y, zz + .5 - z) < 1 ? shade(c, .45) : c);
  return done(V, 'pipes'); });
export const beams = () => memo('beams', () => { const V = pv(50, 8, 12); for (const x of [5, 43]) V.box(x, 0, 0, x + 2, 2, 12, C.woodD);
  for (let k = 0; k < 2; k++) for (let z = 1; z < 11; z += 5) { const y = 2 + k * 3; V.box(0, y, z, 50, y + 1, z + 4, 0xb3432a); V.box(0, y + 1, z + 1, 50, y + 2, z + 3, 0xb3432a); V.box(0, y + 2, z, 50, y + 3, z + 4, 0xb3432a); }
  return done(V, 'beams'); });
export const lumber = () => memo('lumber', () => { const V = pv(42, 10, 12); for (const x of [4, 36]) V.box(x, 0, 0, x + 2, 2, 12, C.woodD);
  for (let k = 0; k < 3; k++) V.box(0, 2 + k * 2, 1, 42, 4 + k * 2, 11, (x, y, z) => (z % 2 === 0 && y % 2 === 0) ? 0xd9a866 : (x % 14 === 7 && y === 2 + k * 2 + 1 ? 0xe8d4b0 : 0xe0b577));
  V.box(10, 2, 0, 11, 8, 12, C.ink); V.box(30, 2, 0, 31, 8, 12, C.ink); return done(V, 'lumber'); });
export const crates = seed => memo('crates' + (seed % 3), () => { const V = pv(16, 16, 12), s = seed % 3;
  const cr = (x0, y0, z0, w, h, d) => V.box(x0, y0, z0, x0 + w, y0 + h, z0 + d, (x, y, z) => (x === x0 || x === x0 + w - 1 || y === y0 || y === y0 + h - 1 || ((x - x0 + y - y0) % 7 === 0)) ? C.woodD : C.woodL);
  cr(0, 0, 1, 8, 7, 10); cr(8, 0, 0, 8, 8, 12); if (s !== 1) cr(2, 7, 2, 7, 6, 8); if (s === 2) cr(9, 8, 2, 6, 6, 8); return done(V, 'crate'); });
export const gasCage = () => memo('gascage', () => { const V = pv(16, 17, 8);
  V.box(0, 0, 0, 16, 1, 8, C.steelD); V.box(0, 16, 0, 16, 17, 8, C.steelD); for (const x of [0, 15]) for (const z of [0, 7]) V.box(x, 1, z, x + 1, 16, z + 1, C.steelD);
  for (let k = 0; k < 5; k++) { const x = 2 + k * 3; cyl(V, x + .5, 3.5, 1.3, 1, 12, [0x25b84c, 0xe8232a, 0x2f5bff, 0xe8232a, 0x25b84c][k]); V.box(x, 12, 3, x + 1, 14, 4, C.steelL); }
  V.box(1, 1, 7, 15, 16, 8, (x, y) => (x % 3 === 0 || y % 5 === 0) ? C.steelD : undefined); return done(V, 'gascage'); });
export const lightTower = () => memo('ltower', () => { const V = pv(14, 92, 8); V.box(4, 0, 2, 10, 2, 6, C.steelD); V.box(6, 2, 3, 8, 84, 5, C.steelL, 2);
  V.box(1, 84, 2, 13, 86, 6, C.steelD); for (let k = 0; k < 3; k++) V.box(1 + k * 4, 86, 2, 4 + k * 4, 90, 6, k === 1 ? C.steelD : 0xfff2c4, TOD.night ? 3 : 1); V.box(1, 90, 2, 13, 91, 6, C.steelD);
  return done(V, 'lamp'); });
export const portaPotty = c => memo('potty' + c, () => { const V = pv(11, 23, 11); V.box(0, 0, 0, 11, 1, 11, C.steelD); V.box(0, 1, 0, 11, 21, 11, c); V.box(1, 21, 1, 10, 23, 10, C.chalk);
  V.box(2, 1, 10, 9, 20, 11, shade(c, .85)); V.box(7, 10, 10, 8, 12, 11, C.chalk); V.box(4, 16, 10, 7, 17, 11, 0xe8232a); return done(V, 'potty'); });
export const generator = c => memo('gen' + c, () => { const V = pv(24, 14, 11); for (const x of [2, 20]) V.box(x, 0, 1, x + 2, 2, 10, C.steelD); V.box(0, 2, 0, 24, 13, 11, c);
  V.box(2, 5, 10, 22, 11, 11, x => x % 2 ? shade(c, .7) : c); V.box(18, 13, 4, 20, 14, 7, C.ink); return done(V, 'generator'); });
export const oilTank = (c, name) => memo('otank' + c + name, () => { const V = pv(50, 24, 22); for (const x of [8, 40]) V.box(x, 0, 3, x + 3, 6, 19, C.conc);
  cylX(V, 1, 49, 13, 11, 10, x => (x === 1 || x === 48) ? shade(c, .8) : c); V.box(22, 23, 9, 26, 24, 13, C.steelD);
  if (name) { const M = px(name); if (M.w < 44) vtext(V, M, 25 - (M.w >> 1), 15, 20, inkOn(c), {}); } return done(V, 'tank'); });
export const fishCrates = seed => memo('fishc' + (seed % 3), () => { const V = pv(14, 10, 10), cols = [[0x2f5bff, 0xff7a1a], [0xe8e2d0, 0x2f5bff], [0xff7a1a, 0x25b84c]][seed % 3];
  for (let k = 0; k < 3; k++) { const c = cols[k % 2], y = k * 3; V.box(k === 2 ? 3 : 0, y, 0, k === 2 ? 11 : 14, y + 3, 10, c); V.box(k === 2 ? 4 : 1, y + 2, 1, k === 2 ? 10 : 13, y + 3, 9, 0xdff4ff); }
  return done(V, 'fish'); });
export const iceChest = () => memo('ice', () => { const V = pv(18, 13, 8); V.box(0, 0, 0, 18, 12, 8, 0xf4f8fb); V.box(0, 0, 0, 18, 1, 8, 0x2f5bff); V.box(0, 12, 0, 18, 13, 8, 0xbfe6ff);
  V.box(8, 1, 7, 10, 12, 8, 0xd3dbe2); const M = px('ICE'); vtext(V, M, 9 - (M.w >> 1), 10, 7, 0x2f5bff, { l: lit() }); return done(V, 'icechest'); });
export const traps = () => memo('traps', () => { const V = pv(16, 12, 10); for (let k = 0; k < 3; k++) { const x0 = k === 2 ? 4 : k * 8, y0 = k === 2 ? 5 : 0;
  V.box(x0, y0, 0, x0 + 8, y0 + 5, 10, (x, y, z) => (x === x0 || x === x0 + 7 || y === y0 || y === y0 + 4 || z === 0 || z === 9) && ((x + y + z) % 2 === 0 || y === y0) ? [0x25b84c, 0xffc21a, 0x2f5bff][k] : undefined); V.box(x0 + 3, y0 + 1, 4, x0 + 5, y0 + 2, 6, 0xe8232a); }
  return done(V, 'traps'); });
export const handTruck = () => memo('dolly', () => { const V = pv(6, 13, 6); V.box(0, 0, 2, 2, 2, 5, C.rubber); V.box(4, 0, 2, 6, 2, 5, C.rubber); V.box(0, 2, 1, 6, 3, 5, C.steelD); V.box(1, 3, 1, 2, 13, 2, C.hazard); V.box(4, 3, 1, 5, 13, 2, C.hazard); V.box(1, 12, 1, 5, 13, 2, C.hazard); return done(V, 'dolly'); });
export const wheelStop = () => memo('wstop', () => { const V = pv(18, 2, 3); V.box(0, 0, 0, 18, 2, 3, x => (x >> 2) & 1 ? C.hazard : C.conc); return done(V, 'wheelstop'); });

// ── lettered plates, mounted on fences and walls (kind 'sign': mounted, never "floating"): tin plates with rivets, stencils, hand-painted
// boards. Authored facing +z at 0.05 grain (small signs, STYLE §1): the board at z 0, the letters on it at z 1.
export const plate = (text, bg, fg, style = 'tin') => memo('plate' + text + bg + fg + style, () => {
  const M = style === 'stencil' ? stencil(text) : style === 'hand' ? hand(text, text.length) : px(text), W = M.w + 8, Hh = M.h + 8, V = pv(W, Hh, 2, .05);
  V.box(0, 0, 0, W, Hh, 1, bg);
  if (style === 'tin') { V.box(0, 0, 1, W, 1, 2, shade(bg, .7)); V.box(0, Hh - 1, 1, W, Hh, 2, shade(bg, .7)); for (const x of [1, W - 2]) for (const y of [2, Hh - 3]) V.set(x, y, 1, C.steelL); }
  vtext(V, M, 4, Hh - 5, 1, fg, {}); return done(V, 'sign'); });
// a sign on two posts standing on the ground: posts behind (z 0–1), the board at z 2, the letters on it at z 3; 0.1 grain
export const postSign = (lines, bg, fg, o = {}) => memo('psign' + lines.join('|') + bg + fg + (o.face || '') + (o.post ?? 12) + (o.s ?? CV), () => {
  const Ms = lines.map(t => o.face === 'hand' ? hand(t, t.length) : o.face === 'stencil' ? stencil(t) : px(t)), W = Math.max(...Ms.map(m => m.w)) + 6, hL = Ms.reduce((s, m) => s + m.h + 2, 2), post = o.post ?? 12, V = pv(W, post + hL, 4, o.s ?? CV);
  for (const x of [2, W - 4]) V.box(x, 0, 0, x + 2, post + hL - 1, 2, C.steelD);
  V.box(0, post, 2, W, post + hL, 3, bg); if (o.border) { V.box(0, post, 3, W, post + 1, 4, o.border); V.box(0, post + hL - 1, 3, W, post + hL, 4, o.border); }
  let y = post + hL - 3; for (const M of Ms) { vtext(V, M, (W - M.w) >> 1, y, 3, fg, { l: o.lit ? lit() : 0 }); y -= M.h + 2; }
  return done(V, 'postsign'); });
