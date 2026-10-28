// CHARACTER FITTING · LAYERS (2026-09-30): head items and accessories stack and fit by layer, per world/fit/contract.js.
// chars.js compose() calls in here at four points: slot tags as the head grid is drawn, the hat's cover after the hat, the ears,
// and the necklace renderer (NECK draws in chars.js and world/jewelry2.js go through strand / lay / plate below).
//
// 1 · SLOT TAGS. The head grid (H) records the slot that last wrote each voxel (tagHead: 'skin', 'marks', 'hair', 'hat',
//     'eyewear', 'ears', 'held'), the way compose already tags the body grid (B). Clipping and occlusion work by slot, never by
//     colour or y alone. shareCells(): a cell held by both grids goes to the LATER layer of contract LAYERS (the balaclava's
//     neck skirt beats a hood or the neck skin; nothing is drawn twice). A covering hat's cover includes its ear flaps (below).
//
// 2 · HAT COVER. Every hat exports a COVER volume, a predicate cover(x, y, z) (COVER / coverOf). It is read off the hat's own
//     voxels (drawn once on an empty grid, cached per id), in three parts:
//       crown  · everything at or above the hat's rim (the lowest voxel of its side walls, the head box x −9…8, z −8…8)
//       brim   · every column over a brim / bill / tail voxel (hat voxels outside the head box), from that voxel up
//       above  · the brim's footprint (its x/z box) from the brim's lowest y up
//     balaclava covers all hair; halo and cursorclip float over the head by design and cover nothing. clipHair() deletes the hair
//     inside the cover, then drops hair that is no longer 6-connected to the scalp (skin): no hair through a brim, no orphaned
//     locs, and hair below a brim outside the cover stays (braids hang under a bucket hat).
//
// 3 · EARS. contract EARS_COVERED (balaclava, skully, durag, silkrag, beanie, fuzzbucket and the long hair) hide the ears and the
//     ear jewellery: the ear item is not drawn (headphones excepted: they sit over hats and hair by design). A covering hat that
//     stops above the ear carries its fabric down over it (earFlaps: the ear keeps its shape in the hat's colour, joined to the
//     hat's side; glasses' arms go under the flap), the balaclava wraps it flat, long hair already hangs over it. No ear item ever
//     draws without an ear under it. (No hat-side sockets yet: every covered ear item hides.)
//
// 4 · NECKLACES. Every NECK item is a ring along neckRing(look) (round the neck at the top of the neckline, wrapping to the back)
//     plus a drop that lies on chestFront(look, x, y) + 1, both from world/fit/body.js. strand() draws the ring (once per piece) and
//     one drop (a chain's curve: low, half-width, rows, U or V); lay() puts one voxel on the chest; plate() lays a pendant flat at
//     one z (the chest's front under its footprint + 1: it can swing). No onFront stacking: chain relief ≤ 1, pendant ≤ 1 proud;
//     nothing is written into a cell another item holds (a chain never cuts the top). The drop drapes: where a zip, placket or patch
//     stands proud next to it the chain rides over it (the front dilated by one), and the drop's ends meet the ring over the collar's
//     edge (on the shoulder, never held up by the chin). endNeck() enforces the budget: where a run of necklace voxels would stand
//     2+ proud of a solid (along any axis) the link against the solid is taken out. The ring rides the chest segment; on open
//     necklines it lies on the shoulders at y 18, under the head (so the head's neck slab copies it: see the note in the report).
//     Closed necklines (hood, collar, high) give the front arc only: the ends tuck into the collar. The neckline decides the fit: a crew's
//     collar, a V's dip, a hood, a puffer's high collar, a tank's bare neck all come through neckRing / chestFront.
//     Link rhythm and colour carry each piece's identity (world/jewelry2.js LINK), never depth.
//
// 5 · RINGS. faceRing(): a closed voxel loop in a plane with every step face-connected (hoops, the hoopstack's door-knocker).
import { LAYERS, EARS_COVERED } from './contract.js';
import { neckRing, chestFront } from './body.js';   // the body agent's neckline: the ring's path and the chest's front
export { EARS_COVERED };

const K = (x, y, z) => ((x + 256) << 18) | ((y + 256) << 9) | (z + 256), D = k => [(k >> 18) - 256, ((k >> 9) & 511) - 256, (k & 511) - 256];
const N6 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const RANK = Object.fromEntries(LAYERS.map((s, i) => [s, i]));
// compose's body-grid tags → contract layers
const LAYER_OF = { base: 'skin', skin: 'skin', mark: 'marks', marks: 'marks', shoes: 'bottom', bottom: 'bottom', top: 'top', neck: 'neck', hair: 'hair', hat: 'hat',
  eyewear: 'eyewear', ears: 'ears', acc: 'acc', held: 'held', hands: 'skin', torso: 'acc', armL: 'acc', armR: 'acc', legL: 'acc', legR: 'acc' };
export const layerOf = t => LAYER_OF[t] ?? 'acc';

// ── 1 · slot tags on the head grid
export function tagHead(H) { const tag = new Map(); let cur = 'skin'; const set0 = H.set.bind(H);
  H.set = (x, y, z, c, l) => { const k = K(Math.round(x), Math.round(y), Math.round(z)); if (cur === 'eyewear' && H.flap?.has(k)) return;   // (glasses' arms go under a hat's ear flap)
    set0(x, y, z, c, l); if (c !== undefined && c !== null) tag.set(k, cur); };
  return { tag, slot(s) { cur = s; } }; }
// a cell in both grids: the later layer keeps it
export function shareCells(H, htag, B, btag) {
  for (const k of [...H.keys()]) { const [x, y, z] = D(k); if (!B.has(x, y, z)) continue;
    const h = RANK[htag.get(k) || 'skin'] ?? 0, b = RANK[layerOf(btag.get(k) || 'base')] ?? 0;
    if (h >= b) B.del(x, y, z); else H.del(x, y, z); } }

// ── 2 · hat cover
const BOX = (x, z) => x >= -9 && x <= 8 && z >= -8 && z <= 8;
export const COVER = {};   // hat id → cover(x, y, z) (filled on first use from the hat's own voxels; see coverOf)
const FIXED = { balaclava: () => true, halo: null, cursorclip: null };
export function coverOf(id, draw, Grid) {
  if (id in FIXED) return FIXED[id]; if (id in COVER) return COVER[id];
  const G = new Grid(); draw(G); const hv = [...G.keys()].map(D);
  if (EARS_COVERED.includes(id)) for (const [x0, x1, sx] of EARBOX) { const side = hv.filter(([x, y, z]) => (x0 < 0 ? x <= sx : x >= sx) && Math.abs(z) <= 3), low = side.length ? Math.min(...side.map(v => v[1])) : 28;   // (+ its ear flaps)
    for (let x = x0; x <= x1; x++) for (let y = 23; y < 28; y++) for (let z = -1; z < 2; z++) hv.push([x, y, z]); for (let y = 28; y < low; y++) for (let z = -1; z < 2; z++) hv.push([sx, y, z]); }
  const crown = hv.filter(([x, , z]) => BOX(x, z)), rim = crown.filter(([x, , z]) => x === -9 || x === 8 || z === -8 || z === 8);
  const rimY = rim.length ? Math.min(...rim.map(v => v[1])) : Infinity, brim = hv.filter(([x, y, z]) => !BOX(x, z) && y <= 33);
  const col = new Map(); for (const [x, y, z] of brim) { const c = x * 64 + z, o = col.get(c); col.set(c, o === undefined ? y : Math.min(o, y)); }
  const bb = brim.length ? [Math.min(...brim.map(v => v[0])), Math.max(...brim.map(v => v[0])), Math.min(...brim.map(v => v[2])), Math.max(...brim.map(v => v[2])), Math.min(...brim.map(v => v[1]))] : null;
  return COVER[id] = (x, y, z) => { if (y >= rimY) return true; const c = col.get(x * 64 + z); if (c !== undefined && y >= c) return true;
    return !!bb && y >= bb[4] && x >= bb[0] && x <= bb[1] && z >= bb[2] && z <= bb[3]; };
}
// hair inside the cover goes, then hair no longer joined (6-connected) to the scalp
export function clipHair(H, tag, cover) {
  const hair = new Set(); for (const k of H.keys()) if (tag.get(k) === 'hair') hair.add(k);
  if (cover) for (const k of [...hair]) { const [x, y, z] = D(k); if (cover(x, y, z)) { H.del(x, y, z); hair.delete(k); } }
  const seen = new Set(), q = [];
  for (const k of hair) { const [x, y, z] = D(k); if (N6.some(d => { const n = K(x + d[0], y + d[1], z + d[2]); return tag.get(n) === 'skin' && H.has(x + d[0], y + d[1], z + d[2]); })) { seen.add(k); q.push(k); } }
  while (q.length) { const [x, y, z] = D(q.pop()); for (const d of N6) { const n = K(x + d[0], y + d[1], z + d[2]); if (hair.has(n) && !seen.has(n)) { seen.add(n); q.push(n); } } }
  for (const k of hair) if (!seen.has(k)) { const [x, y, z] = D(k); H.del(x, y, z); } }

// ── 3 · ears
export const earsCovered = L => EARS_COVERED.includes(L.hat?.id) || EARS_COVERED.includes(L.hair?.id);
// hat-side sockets (opus 2 ears, 2026-10-01): an ear item listed here still draws under a covering hat or hair: 'socket' (tucked
// into or clipped onto the hat's side over the ear) or 'over' (on top of the hat by design). The item fits itself (world/fit/opus-ears/).
export const EAR_SOCKET = {};
export const showEarItem = L => L.ears.id === 'phones' || !earsCovered(L) || !!EAR_SOCKET[L.ears.id];
const EARBOX = [[-10, -9, -9], [8, 9, 8]];   // [x0, x1, the head-side column]
// a covering hat that stops above the ear carries its fabric down over it (the ear's shape in the hat's colour)
export function earFlaps(H, tag, hatId) { if (!EARS_COVERED.includes(hatId) || hatId === 'balaclava') return;
  for (const [x0, x1, sx] of EARBOX) { const own = [...H.keys()].map(D).filter(([x, y, z]) => tag.get(K(x, y, z)) === 'hat' && (x0 < 0 ? x <= sx : x >= sx) && Math.abs(z) <= 3 && y <= 34);
    if (!own.length) continue; const low = Math.min(...own.map(v => v[1])), src = own.reduce((a, b) => (Math.abs(b[2]) + b[1] * .1 < Math.abs(a[2]) + a[1] * .1 ? b : a));
    const c = H.get(src[0], src[1], src[2]), li = H.L.findIndex(M => M.has(K(src[0], src[1], src[2]))), sh = f => { const m = s => Math.max(0, Math.min(255, Math.round(((c >> s) & 255) * f))); return (m(16) << 16) | (m(8) << 8) | m(0); };
    const F = H.flap ||= new Set(), put = (x, y, z) => { H.set(x, y, z, (y + z) & 1 ? c : sh(.86), li); F.add(K(x, y, z)); };
    for (let x = x0; x <= x1; x++) for (let y = 23; y < 28; y++) for (let z = -1; z < 2; z++) if (H.has(x, y, z) && tag.get(K(x, y, z)) === 'skin') put(x, y, z);
    for (let y = 28; y < low; y++) for (let z = -1; z < 2; z++) if (!H.has(sx, y, z) || tag.get(K(sx, y, z)) !== 'hat') put(sx, y, z); } }

// ── 4 · necklaces
// the current compose (set by beginNeck): the look, the grids, and the body's front before any necklace voxel
const CX = { L: null, B: null, H: null, tag: null, ring: false };
export function beginNeck(L, B, H, tag) { Object.assign(CX, { L, B, H, tag, ring: false }); }
export function endNeck() { if (CX.B) trimRelief(); Object.assign(CX, { L: null, B: null, H: null, tag: null, ring: false }); }
// the budget, enforced: a necklace voxel may stand 1 proud of what it lies on, never more (a run of necklace voxels along any axis
// from an open face back to a solid is its relief); where a run would stand 2+ proud, its link against the solid is taken out
function trimRelief() { const B = CX.B, T = CX.tag;
  for (let pass = 0; pass < 4; pass++) { let cut = 0;
    for (const k of [...T.keys()]) { if (T.get(k) !== 'neck' || !B.has(...D(k))) continue; const [x, y, z] = D(k);
      for (const d of N6) { const X = x + d[0], Y = y + d[1], Z = z + d[2]; if (B.has(X, Y, Z) || CX.H.has(X, Y, Z)) continue;
        let t = 0, a = x, b = y, c = z; while (B.has(a, b, c) && mine(a, b, c)) { t++; a -= d[0]; b -= d[1]; c -= d[2]; if (t > 12) break; }
        if (t > 1 && (B.has(a, b, c) || CX.H.has(a, b, c))) { const bx = a + d[0], by = b + d[1], bz = c + d[2]; B.del(bx, by, bz); if (B.jw) B.jw.delete(K(bx, by, bz)); cut++; break; } } }   // (the link against the solid goes: a notch, not a lost pendant)
    if (!cut) break; } }
const free = (x, y, z) => !CX.B.has(x, y, z) && !CX.H.has(x, y, z), mine = (x, y, z) => CX.tag.get(K(x, y, z)) === 'neck';
const front = (x, y) => chestFront(CX.L, x, y);
const drape = (x, y) => { const f0 = front(x, y); if (f0 === null) return null; let f = f0; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const g = front(x + a, y + b); if (g !== null && g > f && g - f0 <= 2) f = g; } return f; };
const solid = (x, y, z) => CX.B.has(x, y, z) && !mine(x, y, z);
const place = (x, y, z, cell, put) => { if (!cell) return; if (!free(x, y, z) && !mine(x, y, z)) return; if (typeof cell === 'function') cell = cell(x, y, z); if (!cell) return;
  if (put) put(CX.B, x, y, z, cell); else CX.B.set(x, y, z, cell[0], cell[1]); };
// the curve a drop hangs on (jewelry2's hang: a V's parabola, `u` a stiff U for heavy links)
export const hang = (x, low, half, u) => { const f = (x + .5) / half, d = u ? f * f * f * f : f * f; return Math.round(17 - (17 - low) * (1 - d)); };
// a face-connected path between two cells through free cells that touch a surface (the chain lies on something all the way)
function bridge(a, b) { if (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) <= 1) return [];
  const lo = [0, 1, 2].map(i => Math.min(a[i], b[i]) - 2), hi = [0, 1, 2].map(i => Math.max(a[i], b[i]) + 2), s = K(...a), t = K(...b), prev = new Map([[s, null]]), q = [s];
  const ok = (x, y, z) => { if (x < lo[0] || x > hi[0] || y < lo[1] || y > hi[1] || z < lo[2] || z > hi[2]) return false; if (!free(x, y, z) && !mine(x, y, z)) return false;
    return N6.some(d => d[1] <= 0 && solid(x + d[0], y + d[1], z + d[2])); };   // (lying on the body: a cell held up only by the chin doesn't count)
  for (let i = 0; i < q.length && i < 600; i++) { const k = q[i]; if (k === t) break; const [x, y, z] = D(k);
    for (const d of N6) { const n = K(x + d[0], y + d[1], z + d[2]); if (prev.has(n)) continue; if (n !== t && !ok(x + d[0], y + d[1], z + d[2])) continue; prev.set(n, k); q.push(n); } }
  if (!prev.has(t)) return []; const out = []; for (let k = prev.get(t); k !== null && k !== s; k = prev.get(k)) out.push(D(k)); return out.reverse(); }
// ring + drop. col(t, k, x, y) → cell ([colour, layer, …] or (x, y, z) → cell): t links along the chain, k 0 bottom · 1 middle · 2 top
export function strand(B, { low, half, rows = 1, u = false, col, ring = true }, put) {
  const pts = []; let py = null;
  for (let x = -half; x < half; x++) { const y = hang(x, low, half, u), end = x === -half || x === half - 1, top = end ? 17 : Math.max(y, py ?? y), bot = Math.min(y, py ?? y) - rows + 1;
    for (let yy = top; yy >= bot; yy--) { const f = drape(x, yy); if (f === null) continue; const t = ((17 - yy) + (half - Math.abs(x + .5))) | 0, k = yy === bot ? 0 : yy === top ? 2 : 1;
      place(x, yy, f + 1, col(t, k, x, yy), put); if (end && yy === top) pts.push([x, yy, f + 1]); } py = y; }
  // (each end of the drop meets the ring over the collar's edge: the cell above and behind its top link, on the shoulder)
  for (const e of pts) { const a = [e[0], e[1] + 1, e[2] - 1]; if (free(...a) && solid(a[0], a[1] - 1, a[2])) e.splice(0, 3, ...a); }
  if (ring && !CX.ring) { CX.ring = true; const R = neckRing(CX.L).map(p => [p.x, p.y, p.z]); if (!R.length) return;
    const cellAt = (i, p) => col(i + 3, 1, p[0], p[1]);
    R.forEach((p, i) => place(p[0], p[1], p[2], cellAt(i, p), put));
    for (let i = 0; i < R.length; i++) { const a = R[i], b = R[(i + 1) % R.length]; bridge(a, b).forEach(p => place(p[0], p[1], p[2], cellAt(i, p), put)); }
    // the drop's two ends join the ring at its nearest points
    for (const e of pts) { let best = null, bd = 1e9; for (const p of R) { const d = Math.abs(p[0] - e[0]) * 2 + Math.abs(p[1] - e[1]) + Math.abs(p[2] - e[2]); if (d < bd) { bd = d; best = p; } }
      if (best) [...bridge(best, e), e].forEach(p => place(p[0], p[1], p[2], col(1, 2, p[0], p[1]), put)); } } }
// one voxel lying on the chest (+1); drop 01's pendants use it in place of onFront
export function lay(B, x, y, cell, put) { const f = drape(x, y); if (f !== null) place(x, y, f + 1, cell, put); }
// a flat pendant plate at one z: the chest's front under its footprint + 1. cells: [x, y, cell]. Returns that z.
export function plate(B, cells, put) { let zf = -99; for (const [x, y] of cells) zf = Math.max(zf, front(x, y) ?? -99); if (zf === -99) return null;
  for (const [x, y, c] of cells) place(x, y, zf + 1, c, put); return zf + 1; }

// ── 5 · face-connected rings: a closed loop in the plane of axes (a, b) round (ca, cb), radii (ra, rb), every step a face step
export function faceRing(ca, cb, ra, rb, n = 48) { const out = []; let p = null;
  for (let i = 0; i <= n; i++) { const t = i / n * Math.PI * 2, q = [Math.round(ca + ra * Math.cos(t)), Math.round(cb + rb * Math.sin(t))];
    if (p && q[0] === p[0] && q[1] === p[1]) continue;
    if (p && q[0] !== p[0] && q[1] !== p[1]) out.push([q[0], p[1]]);   // a diagonal step becomes two face steps (the outer corner)
    out.push(q); p = q; }
  const seen = new Set(); return out.filter(([a, b]) => { const k = a * 1000 + b; if (seen.has(k)) return false; seen.add(k); return true; }); }
