// IMPORTED TOPS · the adapter (README § Imported traits; kit.js re-exports `top`, so imported/tops.js imports only ./kit.js). One OLD
// top (the old Trait Studio's final draw, isolated legacy construction in world/legacy/tops.js) → one fresh registry entry: the fresh
// compose calls draw(B, ctx) as it calls a fresh top's, and the adapter runs the old draw on the fresh body grid, in the old page's
// base colours (colourway 0, or the draw's defaults), fixed here, never a parameter. flank and neckline are the old TOPFIT's (the
// old shell's side reach and neckline), so the fresh routing (world/fit/body.js) sends the same voxels to the chest and the arms.
//
// How the old draw meets the fresh grid. The old tops drew on the old body grid with B.fit, the routing context: onSeg(B, 'armL' |
// 'armR', …) marks a sleeve's voxels for the arm. The fresh body grid carries the same context (B.fit: seg + force) and the same
// set / del / box / bmp, so the old draw runs on it unchanged, through a view that adds the old Grid's text() / textBack() (the
// jersey's 56, the mesh jersey's 04, the varsity's D): every write still goes through the fresh grid's own set (tags, routing).
//
// THE SLEEVE RULE (README § Tops: a sleeve at most one voxel proud of the arm, centred; padded outerwear, `puffy`, two). Every old
// sleeve but five already fits it: the everyday tops' sleeves (x −8…−7, z −2…1), the jackets' (x −9…−7, z −2…1) and the puffer /
// parka cut (x −10…−8, z −3…2, padded). The five, fixed per trait in imported/tops.js (each commented FIX), with one of these:
//   drop  { x: [...], z: [...] }  the bubble cut (x −11…−8, z −4…3: the bubble, the bankroll and barrel puffers) and the fur coat
//         (z −4…3) stand THREE proud. The sleeve loses the named layers (in the left arm's frame, x < 0; mirrored for the other arm)
//         and the layers outside them close in by one, so its outer faces keep every row of the old paint (the baffles' grooves and
//         the tape sunk in them on the outer side, the front and back faces): the same sleeve, one layer slimmer each way. The old
//         draw had cut the shell's side away wherever the sleeve touched it (the old `unhook`: a closed channel behind the sleeve);
//         that cut is redone against the slimmer sleeve, from the shell the old draw makes with the sleeves left out, exactly as
//         the old code would have cut it had it drawn the slimmer sleeve.
//   clip  { x: n }  arm voxels beyond x n (left frame) are left out: the gator & mink's cuffs flared one wider on the outer side, to
//         x −11 (three proud), drawn after the jacket on their own; the cuff rows stay mink in the sleeve itself.
import { TOPS, TOPFIT, baseOf } from '../../legacy/tops.js';
import { Grid as OldGrid } from '../../legacy/head.js';

const KEY = (x, y, z) => ((x + 256) << 18) | ((y + 256) << 9) | (z + 256), dk = k => [(k >> 18) - 256, ((k >> 9) & 511) - 256, (k & 511) - 256];
const N6 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const isArm = f => !!(f && f.seg && /^arm[LR]$/.test(f.seg));
// a view of the fresh grid with the old Grid's text() / textBack() (always a view: the clip below overrides its set, never the grid's)
const view = B => { const V = Object.create(B); if (!B.text) { V.text = OldGrid.prototype.text; V.textBack = OldGrid.prototype.textBack; } return V; };
const layerOf = (G, k) => G.L.findIndex(M => M.has(k));

// the old draw on a scratch copy of the body grid (the body and the pants as they are, so the old draw's neighbour tests read what
// they read in the old compose). 'all': the draw as it is; 'shell': the sleeves left out, and with them the old unhook's deletes
// (every delete after the first sleeve write; the unhook is the only thing that deletes after the sleeves in these draws).
function scratch(B, id, sk, mode) {
  const G = new OldGrid(); B.L.forEach((M, i) => { G.L[i] = new Map(M); });
  const fit = { seg: null, force: new Map() }, arm = new Map(), own = new Set(); let armed = false; G.fit = fit;
  G.set = (x, y, z, c, l) => { if (c === undefined || c === null) return; const k = KEY(Math.round(x), Math.round(y), Math.round(z));
    if (isArm(fit)) { armed = true; if (mode === 'shell') return; arm.set(k, fit.seg); } else arm.delete(k);
    own.add(k); OldGrid.prototype.set.call(G, x, y, z, c, l); };
  G.del = (x, y, z) => { if (mode === 'shell' && armed) return; arm.delete(KEY(x, y, z)); OldGrid.prototype.del.call(G, x, y, z); };
  TOPS[id](G, baseOf(id), sk); delete G.set; delete G.del;
  return { G, arm, own };
}
// drop: the slimmer sleeve, the shell re-cut against it, laid on the fresh grid (sleeve voxels through onSeg, as the old draw laid them)
function drawSlim(B, ctx, id, drop) {
  const A = scratch(B, id, ctx.sk, 'all'), S = scratch(B, id, ctx.sk, 'shell'), F = S.G;
  const close = (v, ds) => { let o = v; for (const d of ds) { if (v === d) return null; if (d < 0 && v < d) o++; if (d >= 0 && v > d) o--; } return o; };
  const sleeve = new Map();   // key → region
  for (const [k, region] of A.arm) { const [X, y, z] = dk(k), R = region === 'armR', lx = R ? -1 - X : X;
    const nx = close(lx, drop.x || []), nz = close(z, drop.z || []); if (nx === null || nz === null) continue;
    const NX = R ? -1 - nx : nx, nk = KEY(NX, y, nz); F.set(NX, y, nz, A.G.get(...dk(k)), layerOf(A.G, k)); sleeve.set(nk, region); }
  // the old unhook (fit/refit-outer.js, fit/opus-tops/tops.js), against the slimmer sleeve
  const cut = [];
  for (const k of sleeve.keys()) { const [x, y, z] = dk(k); for (const [a, b, c] of N6) { const n = KEY(x + a, y + b, z + c);
    if (S.own.has(n) && !sleeve.has(n) && F.has(x + a, y + b, z + c)) { F.del(x + a, y + b, z + c); cut.push([x + a, y + b, z + c]); } } }
  for (const [x, y, z] of cut) for (const [a, b, c] of N6) { const X = x + a, Y = y + b, Z = z + c;
    if (S.own.has(KEY(X, Y, Z)) && F.has(X, Y, Z) && N6.filter(d => F.has(X + d[0], Y + d[1], Z + d[2])).length <= 1) F.del(X, Y, Z); }
  // onto the fresh grid: what the old draw deleted goes, what it drew is laid (only those cells: the rest stays the body's and the pants')
  for (const k of [...B.keys()]) { const [x, y, z] = dk(k); if (!F.has(x, y, z)) B.del(x, y, z); }
  for (const k of new Set([...S.own, ...sleeve.keys()])) { const [x, y, z] = dk(k); if (!F.has(x, y, z)) continue; const c = F.get(x, y, z), l = layerOf(F, k);
    if (sleeve.has(k)) ctx.onSeg(sleeve.get(k), () => B.set(x, y, z, c, l)); else B.set(x, y, z, c, l); }
}
// one old top → the fresh fields: { draw, flank, neckline } (fix: { drop } or { clip }, above; the tops file says why, per trait)
export function top(id, fix = {}) {
  const f = TOPFIT[id] || {};
  return { flank: f.flank ?? 1, neckline: f.neckline ?? 'crew',
    draw(B, ctx) {
      if (fix.drop) return drawSlim(B, ctx, id, fix.drop);
      const V = view(B);
      if (fix.clip) V.set = (x, y, z, c, l) => { if (isArm(B.fit) && (x < 0 ? x : -1 - x) < fix.clip.x) return; B.set(x, y, z, c, l); };
      TOPS[id](V, baseOf(id), ctx.sk);
    } };
}
