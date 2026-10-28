// SUNNY ACRES · the park around the pads: the three lanes (patched asphalt, speed bumps, painted words), the wooden utility poles with
// their sagging wires and lamps, the perimeter fence (chain link, privacy slats, a broken run), the margin life and the far tier.
// Everything a block builds lies inside that block's own x/z range, so neighbours never draw on top of each other.
import { REG } from '../../audit.js';
import { PAL, CV, SIDE, hash, shade } from '../../style.js';
import { TOD } from '../../kit.js';
import { wire, air, board, textMask } from './brush.js';
import { IN, LANES, PADS, padsIn, CORNER, frameOf, SX, SZ } from './plan.js';
import { homeRect } from './homes.js';
import { deckOf } from './pads.js';
import * as TP from './props.js';
import { cooler } from './props.js';
import { Vol } from '../../vox.js';
import { frame, AIR } from '../../kit.js';
import { tires, dumpster, couch, bags, streetTree, tree } from '../../props.js';
import { P as PITCH, P0, rwX, rwZ } from '../../../../world/city.js';   // (SPREAD: the plan's pitch, never a literal 32)

const ASPH = 0x6f6e74, PATCH = 0x646369, CRACK = 0x616067, GRAVEL = 0xb9ad98, POLE = 0x7a5230, WIREC = 0x55565e, GALV = 0xb9bcc4;
export const blockRange = ctx => { const i = ctx.i ?? ctx.b.i, j = ctx.j ?? ctx.b.j; return [i * P0 + SX, j * P0 + SZ, i * P0 + P0 + SX, j * P0 + P0 + SZ]; };   // (the far context carries only ctx.b · SPREAD: the block's frame cell)
const cellRange = ctx => { const i = ctx.b.i, j = ctx.b.j; return [i * PITCH, j * PITCH, i * PITCH + PITCH, j * PITCH + PITCH]; };   // (the far tier's volume: the block's own cell)
// lane mouths on the perimeter: lane 2 (index 1) is the main gate on Elm St; lanes 1 and 3 open onto Elm St too; the west ends are fenced
export const MOUTHS = [{ lane: 0, x: IN.x1 }, { lane: 1, x: IN.x1 }, { lane: 2, x: IN.x1 }];
const poleXs = [-248.5, -230.5, -212.5, -194.5, -176.5, -167.2].map(x => x + SX);     // in the 1 m gaps between pad columns (and the east margin)

// ── the lanes: 0.1 m of old asphalt from the west fence to Elm St, patched, cracked, with speed bumps and paint
export function lanes(ctx) {
  const [bx0, bz0, bx1, bz1] = blockRange(ctx); ctx.group('lane');
  for (const [k, q] of LANES.entries()) { if (q.z1 <= bz0 || q.z0 >= bz1) continue;
    const x0 = Math.max(bx0, IN.x0 + .1), x1 = Math.min(bx1, IN.x1); if (x1 <= x0) continue;
    const V = ctx.volume(x0, SIDE, q.z0, x1, SIDE + CV, q.z1, { walk: true }), nz = V.nz;
    V.box(0, 0, 0, V.nx, 1, nz, (x, y, z) => { const wx = x0 + (x + .5) * CV - SX, wz = q.z0 + (z + .5) * CV - SZ, n = hash(Math.floor(wx / 1.3), Math.floor(wz / 1.1), 17 + k);   // (frame metres: the paint stays put)
      if (Math.abs(wx - (-200 + k * 13)) < .25 || Math.abs(wx - (-236 + k * 7)) < .25) return (Math.floor(wz * 2) & 1) ? 0xffc21a : PAL.ink;   // speed bumps (painted yellow and black)
      const tar = Math.abs(Math.sin(wx * .23 + k) * 1.6 + (wz - q.zc + SZ) * 1.1) < .06 && hash(Math.floor(wx / 3), k, 9) > .45; if (tar) return CRACK;
      return n > .9 ? PATCH : n < .06 ? shade(ASPH, 1.08) : ASPH; });
    // painted words on the lane (flush paint, part of the surface): SLOW at the gate lanes' mouths, a hopscotch on lane 3
    if (x1 > IN.x1 - 9 && x0 < IN.x1 - 2) stencil(V, x0, q.z0, k === 1 ? 'SLOW' : k === 0 ? 'KIDS' : 'DEAD END', IN.x1 - 6, q.zc, k === 2 ? 0xf7f7f2 : 0xffe23a);
    if (k === 2 && x0 - SX <= -220 && x1 - SX >= -224 + 0.1) hopscotch(V, x0, q.z0, -221.5 + SX, q.zc + .2); }
}
// flat letters painted into a lane (read from the east, at the mouth): voxel colour in the surface itself, no relief
function stencil(V, x0, z0, s, xc, zc, col) { const t = textMask(s), sc = 2, w = t.w * sc, h = 7 * sc;
  for (let j = 0; j < 7; j++) for (let i = 0; i < t.w; i++) if (t.at(i, j)) for (let a = 0; a < sc; a++) for (let b = 0; b < sc; b++) {
    // read from the east (looking −x): the letters' rows run along −x, columns along +z
    const wx = xc - ((h / 2) - (j * sc + b)) * CV, wz = zc + (w / 2 - (i * sc + a)) * CV; const x = Math.floor((wx - x0) / CV), z = Math.floor((wz - z0) / CV); if (x >= 0 && x < V.nx && z >= 0 && z < V.nz) V.set(x, 0, z, col); } }
function hopscotch(V, x0, z0, xc, zc) { const cells = [[0, 0], [1, 0], [2, -.5], [2, .5], [3, 0], [4, -.5], [4, .5], [5, 0]];
  for (const [c, o] of cells) { const cx = xc + c * .6, cz = zc + o * .6; for (let a = -3; a < 3; a++) for (let b = -3; b < 3; b++) if (Math.abs(a + .5) > 2.4 || Math.abs(b + .5) > 2.4) { const x = Math.floor((cx + a * CV - x0) / CV), z = Math.floor((cz + b * CV - z0) / CV); if (x >= 0 && x < V.nx && z >= 0 && z < V.nz) V.set(x, 0, z, [0xff4fa3, 0x2de2e6, 0xffe23a][c % 3]); } } }

// ── the utility poles: wooden poles in the gaps along each lane's north edge, a cross-arm, a transformer can on some, a lamp over the
// lane, and the wires sagging pole to pole (each block draws the part of every span that lies over it)
export function poles(ctx) {
  const [bx0, bz0, bx1, bz1] = blockRange(ctx); ctx.group('lane');
  for (const [k, q] of LANES.entries()) { const pz = q.z0 + .25; if (pz < bz0 || pz >= bz1) continue;
    const mine = poleXs.filter(x => x >= bx0 && x < bx1), spans = []; for (let n = 0; n + 1 < poleXs.length; n++) if (poleXs[n + 1] >= bx0 && poleXs[n] < bx1 && !(k === 1 && n === 3)) spans.push([poleXs[n], poleXs[n + 1]]);   // (lane 2's line ends at the swap meet)
    if (!mine.length && !spans.length) continue;
    const H = 62, y0 = SIDE + CV, V = ctx.volume(bx0, y0, pz - .9, bx1, y0 + (H + 4) * CV, pz + 1.9, { ground: false }), vx = x => Math.floor((x - bx0) / CV), vz = z => Math.floor((z - (pz - .9)) / CV);
    for (const x of mine) { const X = vx(x), Z = vz(pz);
      V.box(X - 1, 0, Z - 1, X + 2, H, Z + 2, (xx, y) => y % 9 === 0 ? shade(POLE, .85) : POLE); V.box(X - 8, H - 6, Z, X + 9, H - 5, Z + 1, shade(POLE, .8));   // pole, cross-arm
      for (const dx of [-7, 7]) V.box(X + dx, H - 5, Z, X + dx + 1, H - 3, Z + 1, 0xdfe2e8);                                                  // insulators
      if ((Math.round(x - SX) + k) % 3 === 0) { V.box(X + 2, H - 20, Z - 1, X + 6, H - 13, Z + 3, 0x8f9096, 2); V.box(X + 2, H - 13, Z - 1, X + 6, H - 12, Z + 3, 0x6d707a, 2); }   // transformer
      // the lamp: an arm out over the lane and a cobra head (lit at night)
      for (let d = 0; d < 14; d++) V.set(X, H - 16 + (d > 10 ? 1 : 0), Z + 2 + d, 0x6d707a, 2); V.box(X - 2, H - 17, Z + 12, X + 3, H - 15, Z + 18, 0x9a9ca4, 2); V.box(X - 2, H - 18, Z + 13, X + 3, H - 17, Z + 18, TOD.night ? 0xfff0b0 : 0xeae6da, TOD.night ? 3 : 1);
      REG.keep([x - .2, SIDE, pz - .2, x + .2, y0 + H * CV, pz + .2], 'pole'); }
    // wires: three conductors, span by span, sagging 0.5 m
    for (const [a, b] of spans) for (const dx of [-7, 7]) wire(V, vx(a) + dx, H - 3, vz(pz), vx(b) + dx, H - 3, vz(pz), 5, WIREC); }
}

// ── SPREAD · THE VERGE: the compound sits at its centre, so a spread opens a margin between its fence and each street's lot line (LOT:
// the four streets' lot lines, the same rect as IN at SPREAD 0). The park's own ground fills it: weedy gravel on Birch St, 3rd St and
// Elm St, the lanes' asphalt running on through their mouths to Elm St's sidewalk, a concrete apron along Central Ave in front of the
// laundry and the bait shack. Every strip has zero width at SPREAD 0; each block draws the part in its frame cell.
const LOT = { x0: -8 * PITCH + rwX(-8), z0: -3 * PITCH + rwZ(-3), x1: -5 * PITCH - rwX(-5), z1: -rwZ(0) };
function vergeStrips() { const out = [], g = 'gravel';
  out.push([g, [LOT.x0, LOT.z0, IN.x0, LOT.z1]], [g, [IN.x0, LOT.z0, IN.x1, IN.z0]], ['apron', [IN.x0, IN.z1, IN.x1, LOT.z1]]);
  let z = LOT.z0; for (const q of LANES) { out.push([g, [IN.x1, z, LOT.x1, q.z0]], ['lane', [IN.x1, q.z0, LOT.x1, q.z1]]); z = q.z1; } out.push([g, [IN.x1, z, LOT.x1, LOT.z1]]);
  return out.filter(([, r]) => r[2] - r[0] > 1e-6 && r[3] - r[1] > 1e-6); }
const VERGE = vergeStrips();
const vergePaint = (kind, x, z) => { const n = hash(Math.floor(x / .4), Math.floor(z / .4), 61);   // (frame metres: the grain stays put)
  if (kind === 'lane') return n > .9 ? PATCH : ASPH;
  if (kind === 'apron') return (((x % 2) + 2) % 2 < .1 || ((z % 2) + 2) % 2 < .1) ? 0xbdb6a8 : n > .9 ? 0xd6d0c4 : 0xcdc6b8;
  return n > .88 ? 0x7fa84a : n > .8 ? 0x6f9a3a : n < .1 ? 0xa89c86 : GRAVEL; };
export function verge(ctx) {
  if (!VERGE.length) return; const [bx0, bz0, bx1, bz1] = blockRange(ctx); ctx.group('verge');
  for (const [kind, r] of VERGE) { const c = [Math.max(r[0], bx0), Math.max(r[1], bz0), Math.min(r[2], bx1), Math.min(r[3], bz1)]; if (c[2] - c[0] < CV - 1e-6 || c[3] - c[1] < CV - 1e-6) continue;
    const V = ctx.volume(c[0], SIDE - .2, c[1], c[2], SIDE + CV, c[3], { walk: true });   // (two layers under the slab's plane: the far tier keeps it)
    V.box(0, 0, 0, V.nx, 3, V.nz, (x, y, z) => vergePaint(kind, c[0] + (x + .5) * CV - SX, c[1] + (z + .5) * CV - SZ)); } }

// ── the perimeter fence: chain link on the inside edge of the sidewalk, open at the lane mouths and the park office, privacy slats on
// the Central Ave run, a bent-down section on Birch St (the back way in), weeds along its foot
export function perimeter(ctx, skip = []) {
  verge(ctx); const [bx0, bz0, bx1, bz1] = blockRange(ctx); ctx.group('fence');
  const runs = [];
  if (ctx.i === -8) runs.push({ ax: 'z', x: IN.x0, a: Math.max(bz0, IN.z0), b: Math.min(bz1, IN.z1) });
  if (ctx.i === -6) runs.push({ ax: 'z', x: IN.x1 - .1, a: Math.max(bz0, IN.z0), b: Math.min(bz1, IN.z1) });
  if (ctx.j === -3) runs.push({ ax: 'x', z: IN.z0, a: Math.max(bx0, IN.x0 + .1), b: Math.min(bx1, IN.x1 - .1) });
  if (ctx.j === -1) runs.push({ ax: 'x', z: IN.z1 - .1, a: Math.max(bx0, IN.x0 + .1), b: Math.min(bx1, IN.x1 - .1) });
  const gaps = [...skip]; for (const q of LANES) gaps.push({ ax: 'z', x: IN.x1 - .1, a: q.z0, b: q.z1 });
  gaps.push({ ax: 'x', z: IN.z1 - .1, a: -187.2 + SX, b: -179.6 + SX });                                         // the bait shack's frontage on Central Ave
  gaps.push({ ax: 'z', x: IN.x0, a: CORNER.zone[1] - .4, b: CORNER.zone[3] + .4 });            // the dealing corner (a hole in the fence)
  for (const r of runs) { let segs = [[r.a, r.b]];
    for (const g of gaps) if (g.ax === r.ax && Math.abs((g.x ?? g.z) - (r.x ?? r.z)) < .5) segs = segs.flatMap(([a, b]) => g.b <= a || g.a >= b ? [[a, b]] : [[a, g.a], [g.b, b]].filter(([p, q]) => q - p > .3));
    for (const [a, b] of segs) { const H = 15, slats = r.ax === 'x' && r.z - SZ > -10, V = r.ax === 'z' ? ctx.volume(r.x, SIDE, a, r.x + .1, SIDE + H * CV, b, { keep: 'fence' }) : ctx.volume(a, SIDE, r.z, b, SIDE + H * CV, r.z + .1, { keep: 'fence' });
      const n = r.ax === 'z' ? V.nz : V.nx, bent = r.ax === 'z' && ctx.i === -8;
      for (let k = 0; k < n; k++) { const w0 = a + (k + .5) * CV - (r.ax === 'z' ? SZ : SX), post = Math.abs(((w0 + 400) % 2.5) - 1.25) > 1.15, sag = bent && w0 > -84 && w0 < -79 ? Math.round(6 * Math.sin((w0 + 84) / 5 * Math.PI)) : 0;   // (frame metres)
        for (let y = 0; y < H - sag; y++) { let c = post ? 0x8f9096 : y === H - 1 - sag ? 0x9a9ca4 : ((k + y) & 1) ? GALV : undefined;
          if (!post && slats && y < H - 1 && k % 3 !== 2) c = ((k / 18 | 0) % 2) ? 0x2f7a3a : 0xf2f2ee;
          if (c !== undefined) { if (r.ax === 'z') V.set(0, y, k, c); else V.set(k, y, 0, c); } } } } }
}

// ── margin life (the kit's plain blocks): the NO TRESPASSING sign at the bent fence, dumped junk behind the west fence, a burn barrel
// by the dealing corner's couch spot (the hotspot itself is the sim's: its zone stays clear), big trees in the corners
export function margins(ctx) {
  const [bx0, bz0, bx1, bz1] = blockRange(ctx); ctx.group('margin');
  REG.keep([CORNER.zone[0] - .2, SIDE, CORNER.zone[1] - .2, CORNER.zone[2] + .2, SIDE + 2.8, CORNER.zone[3] + .2], 'corner-zone');
  const P = (bk, x, z, rot = 0, o = {}) => { x += SX; z += SZ; return (x >= bx0 && x < bx1 && z >= bz0 && z < bz1) ? ctx.put(bk, x, z, { rot, slide: [0, 1], reach: 1.2, ...o }) : null; };   // (frame metres)
  if (ctx.i === -8 && ctx.j === -3) { ctx.put(TP.bigDish(), -250.5 + SX, -76 + SZ, { rot: 1, slide: [0, 1], reach: .6 });   // the old C-band dish at the end of lane 1 (the block's gag)
    P(board('NO/TRESPASSING', { kind: 'sign', bg: 0xf7f7f2, fg: 0xe8232a, posts: 2, h: .4, edge: 0xe8232a, tilt: 1 }), -250.6, -86.5, 1); P(TP.burnBarrel(), -250.4, -82.2, 1); P(streetTree(3), -250, -71.5, 0, { reach: 2 }); }
  if (ctx.i === -8 && ctx.j === -2) { P(couch(0x7a3cff), -250.3, -55.4, 1, { reach: .6 }); P(bags(7), -250.8, -52.8, 0); P(tires(), -250.8, -45.6, 0); P(TP.cinder(2), -250.6, -41.8, 1); }
  if (ctx.i === -8 && ctx.j === -1) { P(dumpster(0x2f7a3a), -250.8, -30.5, 1); P(board('NO DUMPING', { kind: 'sign', bg: 0x17171b, fg: 0xf7f7f2, posts: 2, h: .5, drip: 1 }), -250.5, -27.2, 1); P(TP.fridge(0xf2f2ee), -250.6, -19.8, 1); P(streetTree(5), -250, -14.5, 0, { reach: 2 }); }
  if (ctx.i === -6 && ctx.j === -3) { P(streetTree(2), -166, -88, 0, { reach: 1 }); P(TP.propane(0xd3d4d7), -166.2, -82.6, 1); }
  if (ctx.i === -6 && ctx.j === -1) { P(streetTree(4), -166, -13, 0, { reach: 1 }); baitShack(ctx); }
}

// ── BAIT & TACKLE (block −6,−1, on Central Ave): a green plywood shack with a tin lean-to roof, a service hatch, a fish three metres
// long on the ridge; WORMS / CRICKETS on a stake by the door, the cooler, the bench where the regulars sit
function baitShack(ctx) {
  ctx.group('bait');
  const x0 = -186.4 + SX, x1 = -180.4 + SX, z0 = -9.6 + SZ, z1 = -6.6 + SZ, H = 26, nx = Math.round((x1 - x0) / CV), nz = Math.round((z1 - z0) / CV), pad = 8;
  const V = new Vol(nx + 2 * pad, H + 34, nz + 2 * pad, { s: CV, org: [x0 - pad * CV, SIDE, z0 - pad * CV] }), B = { x0: pad, z0: pad, x1: pad + nx, z1: pad + nz }, G = 0x2f7a3a;
  ctx.mass(V, [x0, z0, x1, z1], { top: SIDE + (H + 4) * CV, roofY: SIDE + (H + 2) * CV });
  V.box(B.x0, 0, B.z0, B.x1, H, B.z1, (x, y) => ((x >> 3) & 1) ? G : shade(G, .9)); V.box(B.x0, 0, B.z0, B.x1, 3, B.z1, 0x6d707a);
  for (let z = B.z0 - 2; z < B.z1 + 3; z++) { const y = H + Math.round((B.z1 + 3 - z) / 6); V.box(B.x0 - 2, y, z, B.x1 + 2, y + 1, z + 1, (x) => x % 3 ? 0xb9bcc4 : 0x9a9ca4, 2); for (let yy = H; yy < y; yy++) if (z >= B.z0 && z < B.z1) V.box(B.x0, yy, z, B.x1, yy + 1, z + 1, G); }
  const F = frame(V, B, '+z'); F.box(6, 3, -1, 18, 27, 1, AIR); F.box(6, 3, -2, 18, 27, -1, 0x8a5a2a, 1); F.box(22, 11, -1, 50, 21, 1, AIR); F.box(22, 11, -2, 50, 21, -1, 0x14151a); F.box(21, 10, 0, 51, 11, 4, 0xa4652f);
  for (let d = 1; d < 9; d++) F.box(21, 21 + (d >> 1), d, 51, 22 + (d >> 1), d + 1, 0xb9bcc4, 2);                                         // the hatch, propped open
  // the fish on the ridge: a big yellow-and-blue bass on two brackets, mouth open toward Elm St
  const fz = ((B.z0 + B.z1) >> 1), fy = H + 10; for (const x of [B.x0 + 16, B.x0 + 40]) V.box(x, H + 2, fz, x + 1, fy - 3, fz + 1, 0x6d707a, 2);
  for (let x = 0; x < 42; x++) { const t = x / 42, r = t < .15 ? t / .15 * 5 : t > .8 ? 5 * (1 - (t - .8) / .2) + 1 : 5 + Math.sin(t * 3) * .8; for (let y = -r; y <= r; y++) for (let z = -2; z <= 2; z++) if ((y / r) ** 2 + (z / 2.4) ** 2 <= 1) V.set(B.x0 + 8 + x, fy + Math.round(y), fz + z, y > 1 ? 0x2f5bff : 0xffc21a); }
  for (let y = -6; y <= 6; y++) V.box(B.x0 + 4, fy + y, fz, B.x0 + 8, fy + y + 1, fz + 1, 0xffc21a); V.box(B.x0 + 46, fy - 1, fz - 2, B.x0 + 51, fy + 2, fz + 3, -1); V.set(B.x0 + 44, fy + 2, fz + 2, PAL.ink); V.set(B.x0 + 44, fy + 2, fz - 2, PAL.ink);
  ctx.finish();
  REG.door(x0 + 1.2, z1 + .5, 0);
  ctx.put(board('BAIT & TACKLE', { kind: 'yard-sign', posts: 2, h: 1.1, bg: 0xffc21a, fg: 0x2f7a3a, clean: true, pad: 2 }), -189.1 + SX, -7.4 + SZ, { rot: 0, slide: [1, 0], reach: .4 });
  ctx.put(board('WORMS/CRICKETS', { kind: 'sign', posts: 0, bg: 0xf7f7f2, fg: 0x8a3a12, drip: 1, tilt: -1 }), x1, -8.1 + SZ, { rot: 1, y: SIDE + 1.15, reach: 0, ignore: ['plinth'] });   // on the east wall
}

// ── the far tier (0.5 cubes): lanes, homes as their wall colour leaning into the haze with a neutral roof, carports, big yard colour
export function farPark(ctx) {
  const [bx0, bz0, bx1, bz1] = cellRange(ctx), i = ctx.b.i, j = ctx.b.j;
  ctx.box(Math.max(bx0, IN.x0), SIDE, Math.max(bz0, IN.z0), Math.min(bx1, IN.x1), SIDE + .5, Math.min(bz1, IN.z1), air(0xb9ad98, .2));   // the park's ground (never an empty tier)
  for (const [kind, r] of VERGE) { const c = [Math.max(r[0], bx0), Math.max(r[1], bz0), Math.min(r[2], bx1), Math.min(r[3], bz1)]; if (c[2] > c[0] && c[3] > c[1]) ctx.box(c[0], SIDE, c[1], c[2], SIDE + .5, c[3], air(kind === 'lane' ? ASPH : kind === 'apron' ? 0xcdc6b8 : GRAVEL, .2)); }   // (SPREAD: the verge)
  for (const q of LANES) { const x0 = Math.max(bx0, IN.x0), x1 = Math.min(bx1, IN.x1); if (x1 > x0 && q.z1 > bz0 && q.z0 < bz1) ctx.box(x0, SIDE, q.z0, x1, SIDE + .5, q.z1, air(ASPH, .2)); }
  for (const p of PADS.filter(p => Math.floor(p.cx / PITCH) === i && Math.floor(p.cz / PITCH) === j)) { const H = homeRect(p),   // (the far tier: the pads whose centre is in this block's own cell)
     s = p.spec, [x0, z0, x1, z1] = H.rect, hh = s.type === 'double' ? 3.6 : 3.2;
    ctx.box(x0, SIDE, z0, x1, SIDE + hh, z1, air(s.type === 'bullet' ? 0xc9ced6 : s.wall)); ctx.box(x0, SIDE + hh, z0, x1, SIDE + hh + .5, z1, s.roof);
    const dk = deckOf(p), F = frameOf(p), [dx0, dz0, dx1, dz1] = F.rect(dk.u0, dk.v0, dk.u1, dk.v1); ctx.box(dx0, SIDE, dz0, dx1, SIDE + .5, dz1, air(PAL.wood, .2));
    if (s.type === 'nose') { const [a, b] = s.side ? [.3, H.u0 - .2] : [H.u1 + .2, 7.7], [cx0, cz0, cx1, cz1] = F.rect(a, 3.2, b, 9.4); ctx.box(cx0, SIDE + 2.4, cz0, cx1, SIDE + 2.9, cz1, 0xc4c7cc); } }
}
