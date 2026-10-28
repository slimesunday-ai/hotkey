// REFIT 1 · PUFFY + STRUCTURED TOPS: puffer, bubble, furcoat, chenille, varsity (leather: refit 2, refit-tops.js). chars.js installs these
// over its TOPS entries (installOuter); ids and colourways unchanged.
//
// SIMPLE ARMS (2026-09-30, slime: "What happened to the bubble, I liked the original"). The arm is ONE rigid piece from the shoulder to
// the hand (anim/bake.js, world/fit/body.js): there is no elbow, so the interlocking elbow rows, the elbow ring and the armhole channel
// that slimmed these sleeves into tubes are gone, and each top is its ORIGINAL Drop 02 silhouette again (style-pre-fitting chars.js),
// the big stacked baffles included:
//   · the shell rides the chest (its flanks too: TOPFIT flank 2 for the puffers and the fur, 1 for the jackets); each sleeve is one box
//     outside it, the original box, on the arm (onSeg 'armL' / 'armR'), sitting flush on the shell's side: the arm swings from the
//     shoulder (pitch), so the sleeve slides past the shell; a roll out opens a wedge onto closed faces; nothing is cut at the elbow
//   · the fitting rules kept: nothing at y 18 (the head's collar slab copies what lies under the chin: the collars stop at y 17), prints,
//     letters, patches and snaps recolour the shell (0 proud; the varsity's and the chenille's letters were 1 proud in the original),
//     puffer structure ≤ 2 (the baffles are 1 deep, the fur's tufts 1 proud), the leopard's spots in clusters, clear of the hem
//   · the varsity and the chenille: the original sleeve box overlapped the shell's side column (x −6 / 5), hidden at rest; that column
//     stays the shell's (the chest), so the sleeve on the arm is its three outer columns, the same look at rest
//   · cloth on two segments never shares a face (kept from the refit): the shell's cells that touch a sleeve are taken out (unhook), a
//     closed channel behind the sleeve walled by the shell's own front and back columns, hidden at rest; so a raised or swung arm never
//     tears a face of the jacket, and the shoulder slab copies no shell colour onto the sleeve
import { onSeg } from './body.js';

// one sleeve per arm: box for the LEFT arm (x0 ≤ x ≤ x1, inclusive; the right arm is mirrored x → −1 − x), paint(x, y, z) → colour |
// [colour, layer] | null (x, z as for the left arm). Everything it writes rides the arm, whatever lies there.
const K = (x, y, z) => x * 4096 + y * 64 + z, dec = k => { const x = Math.round(k / 4096), r = k - x * 4096, y = Math.round(r / 64); return [x, y, r - y * 64]; };
function sleeves(B, { x0, x1, y0, y1, z0, z1 }, paint, l = 0) { const cells = new Set();
  for (const s of 'LR') onSeg(B, 'arm' + s, () => { for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) {
    const c = paint(x, y, z, s); if (c === null || c === undefined) continue; const [col, li] = Array.isArray(c) ? c : [c, l], X = s === 'L' ? x : -1 - x; B.set(X, y, z, col, li); cells.add(K(X, y, z)); } });
  return cells;
}
// the shell's cells (the keys a draw wrote), and the unhook: a shell cell sharing a face with a sleeve cell goes (+ a corner left hanging by one face)
function track(B, fn) { const got = new Set(), set0 = B.set; B.set = function (x, y, z, c, l) { set0.call(this, x, y, z, c, l); if (c !== undefined && c !== null) got.add(K(Math.round(x), Math.round(y), Math.round(z))); };
  try { fn(); } finally { B.set = set0; } return got; }
const N6 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
function unhook(B, cells, shell) { const cut = [];
  for (const k of cells) { const [x, y, z] = dec(k); for (const [dx, dy, dz] of N6) { const n = K(x + dx, y + dy, z + dz); if (shell.has(n) && !cells.has(n) && B.has(x + dx, y + dy, z + dz)) { B.del(x + dx, y + dy, z + dz); cut.push([x + dx, y + dy, z + dz]); } } }
  for (const [x, y, z] of cut) for (const [dx, dy, dz] of N6) { const X = x + dx, Y = y + dy, Z = z + dz;
    if (shell.has(K(X, Y, Z)) && B.has(X, Y, Z) && N6.filter(d => B.has(X + d[0], Y + d[1], Z + d[2])).length <= 1) B.del(X, Y, Z); } }
export function installOuter({ TOPS, cwOf, shade, hash3 }) {
  // a quilted shell: x −7…6, y 9…17, z −d…d, a baffle groove every third row (y 9, 12, 15: the front, back and side cells taken out)
  const quilted = (B, d, q, l) => { B.box(-7, 9, -d, 7, 18, d + 1, (x, y) => q(y), l);
    for (let y = 9; y < 18; y += 3) { for (let x = -7; x < 7; x++) { B.del(x, y, d); B.del(x, y, -d); } for (let z = -d; z <= d; z++) { B.del(-7, y, z); B.del(6, y, z); } } };
  Object.assign(TOPS, {
    puffer(B, p) { const C = p.c ?? 0xc9ced6, L = shade(C, 1.12), D = shade(C, .74), q = y => y % 3 === 0 ? D : (y % 3 === 2 ? L : C);
      const shell = track(B, () => { quilted(B, 4, q, 1); for (let y = 9; y < 18; y++) if (y % 3) B.set(-1, y, 4, 0x55585f, 1); });   // (+ the zip, on the baffles)
      unhook(B, sleeves(B, { x0: -10, x1: -8, y0: 9, y1: 17, z0: -3, z1: 2 }, (x, y) => y % 3 === 0 ? D : C, 1), shell); },   // the original: 3 wide, 6 deep, full length   // the zip, on the baffles
    bubble(B, p) { const [, C, l] = cwOf('bubble', p), Lt = shade(C, 1.14), D = shade(C, .7), q = y => y % 3 === 0 ? D : (y % 3 === 2 ? Lt : C);
      const shell = track(B, () => { quilted(B, 5, q, l);
        for (let x = -4; x < 4; x++) for (let z = -4; z < 4; z++) B.set(x, 17, z, D, l);   // the dark collar (the original's y 18 ring, one row down)
        for (let y = 9; y < 18; y++) if (y % 3) B.set(-1, y, 5, 0x3a3d44, 2); });
      unhook(B, sleeves(B, { x0: -11, x1: -8, y0: 9, y1: 17, z0: -4, z1: 3 }, (x, y) => x === -11 && y % 3 === 0 ? null : q(y), l), shell); },   // the original: 4 wide, 8 deep, grooved outside
    furcoat(B, p) { const [, C, C2, Kd] = cwOf('furcoat', p), C85 = shade(C, .85);
      const spot = (x, y, z) => Kd !== undefined && y > 10 && hash3(x >> 1, y >> 1, z >> 1) % 5 === 0;   // (leopard: spots in clusters, clear of the hem)
      const fur = (x, y, z) => { if (spot(x, y, z)) return Kd; const h = hash3(x, y, z) & 3; return h === 0 ? C2 : h === 1 ? C85 : C; };
      const shell = track(B, () => { B.box(-7, 9, -5, 7, 18, 6, fur); B.box(-6, 16, -6, 6, 18, 7, fur);   // the shell and the big collar (y 16…17, one proud all round)
        for (let y = 9; y < 16; y++) B.set(-1, y, 5, shade(C, .55)); });   // the closure: a recolour
      unhook(B, sleeves(B, { x0: -10, x1: -8, y0: 9, y1: 17, z0: -4, z1: 3 }, (x, y, z, s) => fur(s === 'L' ? x : -1 - x, y, z)), shell); },   // the original: 3 wide, 8 deep
      // (the original's loose one-voxel tufts, front, back and on the sleeves, are left off: single cells hung by one face, random per side)
    chenille(B, p) { const [, W, Sl, Pt] = cwOf('chenille', p);
      const shell = track(B, () => { B.box(-6, 9, -3, 6, 18, 4, W); for (let x = -6; x < 6; x++) for (let z = -3; z < 4; z++) B.set(x, 9, z, (z & 1) ? Pt : W);   // the shell, the ribbed hem
        for (let x = -5; x < 5; x++) for (let z = -4; z < 2; z++) B.set(x, 17, z, (x & 1) ? Pt : W);   // the knit collar (the original's, y 17: one proud at the back)
        for (const y of [11, 12, 14, 15]) B.set(-1, y, 3, 0xe9e9e9);   // snaps, flat (two-high: a single one reads as a speck)
        [['..XX', '.XX.', 'XXXX', '.XX.', 'XX..']].forEach(rows => rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] === 'X') B.set(i, 16 - j, 3, ((i + j) & 1) ? Pt : shade(Pt, .85)); })); });   // the chenille patch, flat
      unhook(B, sleeves(B, { x0: -9, x1: -7, y0: 10, y1: 17, z0: -2, z1: 1 }, (x, y, z, s) => y === 10 ? ((x & 1) ? Pt : W)   // the ribbed cuff
        : s === 'L' && x === -9 && ((y === 14 && z >= -2 && z <= 0) || (z === -1 && (y === 13 || y === 15))) ? Pt : [Sl, 1]), shell); },   // the sleeve letter (a plus), flat
    varsity(B, p) { const C = p.c ?? 0x1b2a4a, Sl = p.s ?? 0xefe6d2;
      const shell = track(B, () => { B.box(-6, 9, -3, 6, 18, 4, C); for (let x = -6; x < 6; x++) for (let z = -3; z < 4; z++) B.set(x, 9, z, (z & 1) ? Sl : C);   // the shell, the striped hem
        for (const y of [11, 12, 14, 15]) B.set(-1, y, 3, 0xe9e9e9);   // snaps, flat (two-high: a single one reads as a speck)
        for (let x = 1; x < 6; x++) for (let y = 11; y < 18; y++) B.set(x, y, 3, Sl); B.text('D', 2, 16, 3, C); });   // the letter patch, flat on the shell
      unhook(B, sleeves(B, { x0: -9, x1: -7, y0: 10, y1: 17, z0: -2, z1: 1 }, (x, y) => y === 10 ? C : Sl), shell); },   // the cream sleeves, the dark cuff
  });
}
