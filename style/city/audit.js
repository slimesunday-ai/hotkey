// Pass 1d · the item registry, per-block overrides and the audit behind ?audit=1 / AUDIT.md. Worker-safe (no three).
// Every build job opens a block record (REG.begin). While it is open:
//   · every top-level stamp into the block bank becomes an ITEM with a stable id  `i_j·group·kind·n`
//     (group = the lot or area that placed it: L0…Ln, yard, oneoff, street, traffic, corner, hand, or a hero part name;
//      n counts per group+kind in build order — builds are deterministic, so ids are too)
//   · the block's override (city/blocks/<i>_<j>.js) is applied at that moment: remove / move / replace by id
//   · with audit on, every voxel volume meshed into the block (lots, heroes, yards) is kept as a STRUCTURE and every item keeps
//     its voxel occupancy, so the checks below can test real voxels, not just boxes.
// Checks (REG.end): props inside building masses / facades / doorways, props overlapping props, floating or sunk props, sign text
// off its board (overhanging, floating, hidden), coincident faces between separately meshed volumes (z-fighting), floating voxel
// islands inside a volume, and characters inside geometry or floating.
import { SIDE } from './style.js';
import { P, segX, segZ, hwX, hwZ } from './plan.js';
import { lanesOf as carLanes } from './traffic/sim.js';
import { isOneWay, oneWayDir } from './traffic/rules.js';

// ── small helpers
const box0 = () => [1e9, 1e9, 1e9, -1e9, -1e9, -1e9];
const grow = (b, x, y, z) => { if (x < b[0]) b[0] = x; if (y < b[1]) b[1] = y; if (z < b[2]) b[2] = z; if (x > b[3]) b[3] = x; if (y > b[4]) b[4] = y; if (z > b[5]) b[5] = z; };
const hit = (a, b, e = 0) => a[0] < b[3] - e && a[3] > b[0] + e && a[1] < b[4] - e && a[4] > b[1] + e && a[2] < b[5] - e && a[5] > b[2] + e;
const r2 = v => Math.round(v * 100) / 100;
const rbox = b => b.map(r2);
const ROT = [[1, 0], [0, 1], [-1, 0], [0, -1]];   // stamp's quarter turns: x' = x c + z s, z' = −x s + z c
// cleanup pass · THE CLEAR WALKWAY RULE (DISTRICTS §3, STYLE §10). Every street sidewalk keeps a continuous clear path for the walkers at
// least WALK.clear m wide at walker height (WALK.lo–hi above the slab), inside the first WALK.face m from the curb (the last 0.2 m is the
// facade's plinth: sills, base courses). A placement that would leave a narrower path anywhere along its stretch is refused (it slides on,
// or is left out and logged); spots that were already narrower (a signal post, a bus stop) never block anything else. Street furniture
// lives in the kerb strip (c ≤ WALK.kerb from the curb: street.js, gen.js), shop things and standing people against the facade.
export const WALK = { clear: .9, people: .9, face: 1.8, kerb: .85, split: 1.0, win: .4, slope: .4, lo: .1, hi: 1.9, r: .3 };   // (0.9: a lane is carved 0.82 m wide, engine.js lanesOf)
// The path may bend: a kerb-side thing and a frontage-side thing further apart along the sidewalk than 2 × WALK.win leave the walkers
// WALK.slope m more room per metre beyond that (a lane shifts at most 0.5 m per metre: engine.js lanesOf), so two things on opposite
// sides a stride apart can't make the walkers slalom.
// kinds that are expected to hang, lean on walls or sit in things (never "floating" / "overlap" noise)
const MOUNTED = new Set(['giant', 'blade', 'laundry', 'sign']);
const SOFT = new Set(['bags']);   // soft heaps: may touch anything
const VEHICLES = new Set(['car', 'taxi', 'copcar', 'carOnBlocks']);

// ── bounds of a bank (all layers), cached on the bank
export function bankBox(bank) {
  if (bank._bb) return bank._bb; const b = box0();
  for (const O of bank.L) { const P = O.P.a; for (let k = 0; k < O.P.n; k += 3) grow(b, P[k], P[k + 1], P[k + 2]); }
  return (bank._bb = b[0] > b[3] ? [0, 0, 0, 0, 0, 0] : b);
}
function xformBox(b, rot, tx, ty, tz) {   // quarter-turn + translate an AABB
  const [c, s] = ROT[rot & 3], o = box0();
  for (const x of [b[0], b[3]]) for (const z of [b[2], b[5]]) { grow(o, x * c + z * s + tx, b[1] + ty, -x * s + z * c + tz); grow(o, x * c + z * s + tx, b[4] + ty, -x * s + z * c + tz); }
  return o;
}
function angBox(b, a, tx, ty, tz) { const c = Math.cos(a), s = Math.sin(a), o = box0();
  for (const x of [b[0], b[3]]) for (const z of [b[2], b[5]]) for (const y of [b[1], b[4]]) grow(o, x * c + z * s + tx, y + ty, -x * s + z * c + tz); return o; }

// ── voxel access: a placed volume = a Vol (+ quarter turn + translation). World point → solid?
function solidAt(pl, x, y, z) {
  const V = pl.V; let lx = x - pl.t[0], lz = z - pl.t[2]; const ly = y - pl.t[1];
  if (pl.rot) { const [c, s] = ROT[pl.rot & 3]; const ux = lx * c - lz * s, uz = lx * s + lz * c; lx = ux; lz = uz; }   // inverse rotation
  const i = Math.floor((lx - V.org[0]) / V.s), j = Math.floor((ly - V.org[1]) / V.s), k = Math.floor((lz - V.org[2]) / V.s);
  if (i < 0 || j < 0 || k < 0 || i >= V.nx || j >= V.ny || k >= V.nz) return false;
  return V.d[i + k * V.nx + j * V.sxz] !== 0;
}
// solid voxel centres of a placed volume, in world space (cached per placement)
function cells(pl) {
  if (pl._cells) return pl._cells; const V = pl.V, d = V.d, out = [], [c, s] = ROT[pl.rot & 3], [tx, ty, tz] = pl.t; let minJ = 1e9;
  for (let j = 0; j < V.ny; j++) for (let k = 0; k < V.nz; k++) for (let i = 0; i < V.nx; i++) if (d[i + k * V.nx + j * V.sxz]) {
    const x = V.org[0] + (i + .5) * V.s, y = V.org[1] + (j + .5) * V.s, z = V.org[2] + (k + .5) * V.s; out.push(x * c + z * s + tx, y + ty, -x * s + z * c + tz, j); if (j < minJ) minJ = j; }
  pl._minJ = minJ; return (pl._cells = out);
}

// ── text records (kit.frame mask/text, blade letters, props' painted words): checked when their volume is meshed
// rec = { label, pts: [x, y, z, bx, bz, fx, fz, ci …] }  behind (b) = toward the board, front (f) = toward the viewer (volume coords)
export function textCheck(V) {
  const out = []; if (!V.texts) return out;
  const at = (x, y, z) => (x >= 0 && y >= 0 && z >= 0 && x < V.nx && y < V.ny && z < V.nz) ? V.d[x + z * V.nx + y * V.sxz] : 0;
  const later = V.texts.map(t => { const S = new Set(); for (let k = 0; k < t.pts.length; k += 8) S.add(t.pts[k] + ',' + t.pts[k + 1] + ',' + t.pts[k + 2]); return S; });
  V.texts.forEach((t, r) => { const p = t.pts, n = p.length / 8; let off = 0, hid = 0, gone = 0, far = 0; const bb = box0();
    for (let k = 0; k < p.length; k += 8) { const x = p[k], y = p[k + 1], z = p[k + 2]; grow(bb, x, y, z);
      const cur = at(x, y, z); if (cur !== p[k + 7]) { if (!later.some((S, q) => q > r && S.has(x + ',' + y + ',' + z))) gone++; continue; }   // a later text on top (a drop shadow) is fine
      if (!at(p[k + 3], y, p[k + 4])) off++;
      if (at(p[k + 5], y, p[k + 6])) hid++;
      else { const dx = p[k + 5] - x, dz = p[k + 6] - z; if (at(x + 2 * dx, y, z + 2 * dz) || at(x + 3 * dx, y, z + 3 * dz)) far++; } }   // pass 2: covered 0.2–0.3 m out, too
    const wb = [V.org[0] + bb[0] * V.s, V.org[1] + bb[1] * V.s, V.org[2] + bb[2] * V.s, V.org[0] + (bb[3] + 1) * V.s, V.org[1] + (bb[4] + 1) * V.s, V.org[2] + (bb[5] + 1) * V.s];
    const base = { text: t.label, voxels: n, box: wb };
    if (off === n) out.push({ type: 'text-floating', ...base, bad: off, note: `"${t.label}": no board behind any of it` });
    else if (off > Math.max(1, n * .02)) out.push({ type: 'text-overhang', ...base, bad: off, note: `"${t.label}": ${off}/${n} voxels hang off the board` });
    if (hid > n * .15) out.push({ type: 'text-hidden', ...base, bad: hid, note: `"${t.label}": ${hid}/${n} voxels covered in front` });
    if (gone > n * .15) out.push({ type: 'text-overwritten', ...base, bad: gone, note: `"${t.label}": ${gone}/${n} voxels painted over` });
    if (far > n * .25 && hid <= n * .15) out.push({ type: 'text-blocked', ...base, bad: far, note: `"${t.label}": ${far}/${n} voxels blocked 0.2–0.3 m in front` });
  });
  return out;
}
// floating voxel islands in one volume (26-connected; islands touching y = 0 or any volume face count as attached)
export function islands(V, minSize = 6) {
  const { nx, ny, nz, d, sxz } = V, seen = new Uint8Array(d.length), out = [], q = new Int32Array(Math.min(d.length, 1 << 22));
  for (let s0 = 0; s0 < d.length; s0++) { if (!d[s0] || seen[s0]) continue;
    let h = 0, t = 0, attached = false, n = 0; const bb = box0(), cc = new Map(); q[t++] = s0; seen[s0] = 1;
    while (h < t) { const c = q[h++]; n++; const y = (c / sxz) | 0, r = c - y * sxz, z = (r / nx) | 0, x = r - z * nx; grow(bb, x, y, z); cc.set(d[c], (cc.get(d[c]) || 0) + 1);
      if (y === 0 || x === 0 || z === 0 || x === nx - 1 || z === nz - 1 || y === ny - 1) attached = true;
      for (let dy = -1; dy <= 1; dy++) { const yy = y + dy; if (yy < 0 || yy >= ny) continue; for (let dz = -1; dz <= 1; dz++) { const zz = z + dz; if (zz < 0 || zz >= nz) continue;
        for (let dx = -1; dx <= 1; dx++) { const xx = x + dx; if (xx < 0 || xx >= nx) continue; const o = xx + zz * nx + yy * sxz; if (d[o] && !seen[o]) { seen[o] = 1; if (t < q.length) q[t++] = o; } } } } }
    if (!attached && n >= minSize) out.push({ n, col: V.pal[[...cc].sort((a, b) => b[1] - a[1])[0][0]], box: [V.org[0] + bb[0] * V.s, V.org[1] + bb[1] * V.s, V.org[2] + bb[2] * V.s, V.org[0] + (bb[3] + 1) * V.s, V.org[1] + (bb[4] + 1) * V.s, V.org[2] + (bb[5] + 1) * V.s] }); }
  return out;
}

// pass 2 · connected pieces of a prop template (26-connected), largest first: a prop should be one piece — a giant object hanging
// below its bracket, a sign floating off its post, a crown clear of its trunk all show up as a second piece (cached per template)
export function pieces(V) {
  if (V._pieces) return V._pieces; const { nx, ny, nz, d, sxz } = V, seen = new Uint8Array(d.length), out = [], q = new Int32Array(d.length);
  for (let s0 = 0; s0 < d.length; s0++) { if (!d[s0] || seen[s0]) continue; let h = 0, t = 0; q[t++] = s0; seen[s0] = 1; const bb = box0();
    while (h < t) { const c = q[h++], y = (c / sxz) | 0, r = c - y * sxz, z = (r / nx) | 0, x = r - z * nx; grow(bb, x, y, z);
      for (let dy = -1; dy <= 1; dy++) { const yy = y + dy; if (yy < 0 || yy >= ny) continue; for (let dz = -1; dz <= 1; dz++) { const zz = z + dz; if (zz < 0 || zz >= nz) continue;
        for (let dx = -1; dx <= 1; dx++) { const xx = x + dx; if (xx < 0 || xx >= nx) continue; const o = xx + zz * nx + yy * sxz; if (d[o] && !seen[o]) { seen[o] = 1; q[t++] = o; } } } } }
    out.push({ n: t, box: [V.org[0] + bb[0] * V.s, V.org[1] + bb[1] * V.s, V.org[2] + bb[2] * V.s, V.org[0] + (bb[3] + 1) * V.s, V.org[1] + (bb[4] + 1) * V.s, V.org[2] + (bb[5] + 1) * V.s] }); }
  return (V._pieces = out.sort((a, b) => b.n - a.n));
}
const LOOSE = new Set(['bags', 'pigeons', 'laundry', 'crate', 'box', 'steam']);   // kinds made of loose pieces on purpose

// ── the registry
export const REG = {
  blk: null, audit: false, strict: false, groundAt: null, templates: new WeakMap(),
  begin(i, j, bank, o = {}) {
    this.blk = { i, j, key: `${i}_${j}`, bank, group: 'block', n: new Map(), items: [], structs: [], issues: [], doors: [], feet: [], plan: [], keep: [], boxes: [], pls: [], surfaces: [], skipped: [], removed: [], ov: o.override || null, audit: !!o.audit, texts: 0,
      walk: (o.walk || []).map(w => ({ ...w, obs: [] })), life: null, holes: null };   // cleanup pass: the block's street sidewalks (engine.js sidewalksOf) and what stands on them
    this.audit = !!o.audit; return this.blk;
  },
  // ── placement knowledge, always on during a build (cheap boxes, no voxels): what generation code asks before it puts things down
  //   plan: the masses every lot of the block will have (so a lot never draws into a neighbour's mass, even one built later)
  //   keep: facade parts that project past the wall (awnings, canopies, stoops, stands, blades) + building masses
  //   boxes: every item stamped so far · doors: the clear zones · surfaces: walkable voxel floors (yards, plazas, lots)
  plan(list) { if (this.blk) this.blk.plan = list; },
  keep(box, tag) { if (this.blk) { this.blk.keep.push({ box, tag, group: this.blk.group }); if (WALK_TAGS.has(tag)) this.walkObs(box, tag); } },
  // cleanup pass · something walkers can't pass through (walker-height box): recorded on every sidewalk of the block it stands on
  walkObs(box, tag) { const b = this.blk; if (!b?.walk.length || !box || box[1] >= SIDE + WALK.hi - 1e-3 || box[4] <= SIDE + WALK.lo + 1e-3) return; for (const S of b.walk) { const iv = spanOf(S, box); if (iv) S.obs.push(iv); } },
  // the walker-height slice of a template at a placement (voxel-precise where the template keeps its voxels; cached per template and turn):
  // a street tree is its trunk, a lamp its pole, a signal its post
  wboxOf(src, rot, tx, ty, tz) { if (FLOCK.has(src.kind)) return null; const V = src.vol; if (!V || Math.abs(ty - SIDE) > .02) return xformBox(bankBox(src), rot, tx, ty, tz);
    const c = src._wb ??= (() => { const o = box0(); for (let j = 0; j < V.ny; j++) { const y = V.org[1] + (j + .5) * V.s; if (y < WALK.lo || y > WALK.hi) continue;
      for (let k = 0; k < V.nz; k++) for (let i = 0; i < V.nx; i++) if (V.d[i + k * V.nx + j * V.sxz]) { grow(o, V.org[0] + i * V.s, y - V.s / 2, V.org[2] + k * V.s); grow(o, V.org[0] + (i + 1) * V.s, y + V.s / 2, V.org[2] + (k + 1) * V.s); } }
      return o[0] > o[3] ? null : o; })();
    return c ? xformBox(c, rot, tx, ty, tz) : null; },
  // cleanup pass · is a point on one of the block's street sidewalks (their corner squares included)?
  onWalk(x, z) { for (const S of this.blk?.walk || []) { const [u, p] = S.ax === 'x' ? [x, z] : [z, x], c = S.dir > 0 ? p - S.cur : S.cur - p; if (u >= S.u0 && u <= S.u1 && c >= -.05 && c <= (S.w ?? 2)) return true; } return false; },
  // the sidewalk a point stands on (→ { S, c } or null): people step along it, or across to its other side
  walkAt(x, z) { for (const S of this.blk?.walk || []) { const [u, p] = S.ax === 'x' ? [x, z] : [z, x], c = S.dir > 0 ? p - S.cur : S.cur - p; if (u >= S.u0 + 2 && u <= S.u1 - 2 && c >= 0 && c <= (S.w ?? 2)) return { S, c }; } return null; },
  // is the clear path still ≥ WALK.clear wide along this box's stretch of sidewalk once the box stands there? → null, or why not
  walkGap(box, clear = WALK.clear) { const b = this.blk; if (!b?.walk.length || !box || box[1] >= SIDE + WALK.hi - 1e-3 || box[4] <= SIDE + WALK.lo + 1e-3) return null;
    for (const S of b.walk) { const iv = spanOf(S, box); if (!iv) continue; const u0 = Math.max(S.u0, iv[0] - .6), u1 = Math.min(S.u1, iv[1] + .6);
      for (let u = u0; u <= u1 + 1e-6; u += .25) { const w1 = gapAt(S, b, u, iv); if (w1 >= clear - 1e-6) continue; if (w1 < gapAt(S, b, u, null) - 1e-6) return `walkway gap (${Math.max(0, w1).toFixed(2)} m left on the ${S.k} sidewalk)`; } }
    return null; },
  surface(V) { if (this.blk) this.blk.surfaces.push({ V, box: volBox(V) }); },
  // is a world box free of building masses, facade projections, doorways and items already placed? (why() names the first blocker)
  fits(box, o = {}) { return !this.why(box, o); },
  why(box, o = {}) {
    const b = this.blk; if (!b) return null; const e = o.pad ?? 0, q = [box[0] - e, box[1], box[2] - e, box[3] + e, box[4], box[5] + e];
    for (const f of b.feet) if (hit(q, f.box, .005)) return 'mass ' + f.group;
    for (const f of b.plan) if (f.group !== b.group && hit(q, f.box, .005)) return 'planned mass ' + f.group;
    const ign = [].concat(o.ignore || []); for (const k of b.keep) if (!ign.includes(k.tag) && hit(q, k.box, .005)) return k.tag + ' ' + k.group;
    if (o.doors !== false) for (const d of b.doors) if (hit(q, doorZone(d), .005)) return 'door ' + d.group;
    if (o.items !== false) for (const it of b.boxes) if ((o.soft || !SOFT.has(it.kind)) && hit(q, it.box, .005)) return 'item ' + it.id;   // (o.soft: bags count too)
    if (o.walk !== false && b.walk.length) { const w = this.walkGap(box._w ? box._w() : box, o.clear); if (w) return w; }   // cleanup pass: the clear walkway rule (o.clear: a one-off scene squeezes it to the lane's own width)
    return null;
  },
  // placements generation gave up on (nothing clear within its search): listed in the audit so location agents can hand-place them
  skip(kind, at, why) { const b = this.blk; if (b) b.skipped.push({ kind, group: b.group, at: at.map(r2), why }); },
  // a building volume never draws inside another building's mass: before meshing, carve every other group's mass (built so far, or
  // planned for this block) out of it — cornice overhangs, pipes, sills and paint that ran into a neighbour were coincident faces
  clip(V) {
    const b = this.blk; if (!b || !V.own) return 0; const g = V.own.group, s = V.s; let n = 0;
    for (const f of b.feet.concat(b.plan, b.plan.flatMap(p => (p.zones || []).map(box => ({ box, group: p.group }))))) { if (f === V.own || f.group === g) continue; const [x0, , z0, x1, y1, z1] = f.box;
      const i0 = Math.max(0, Math.ceil((x0 - V.org[0]) / s - 1e-4)), i1 = Math.min(V.nx, Math.floor((x1 - V.org[0]) / s + 1e-4)), k0 = Math.max(0, Math.ceil((z0 - V.org[2]) / s - 1e-4)), k1 = Math.min(V.nz, Math.floor((z1 - V.org[2]) / s + 1e-4)), j1 = Math.min(V.ny, Math.floor((y1 - V.org[1]) / s + 1e-4));
      if (i0 >= i1 || k0 >= k1 || j1 <= 0) continue; V.clear(i0, 0, k0, i1, j1, k1); n++; }
    return n;
  },
  // (subway stations agent) a stairwell's column, reserved before the block is built (transit.js transitBefore: REG.blk.holes, world
  // boxes): whatever a builder meshes into the block over it — a yard's floor, a fence, a park path — is cut out there (vox.js meshVol)
  carve(V) {
    const b = this.blk; if (!b?.holes || V.keepHoles) return 0; const s = V.s, o = V.org; let n = 0;
    for (const [x0, y0, z0, x1, y1, z1] of b.holes) { const i0 = Math.max(0, Math.floor((x0 - o[0]) / s + 1e-4)), i1 = Math.min(V.nx, Math.ceil((x1 - o[0]) / s - 1e-4)), j0 = Math.max(0, Math.floor((y0 - o[1]) / s + 1e-4)),
      j1 = Math.min(V.ny, Math.ceil((y1 - o[1]) / s - 1e-4)), k0 = Math.max(0, Math.floor((z0 - o[2]) / s + 1e-4)), k1 = Math.min(V.nz, Math.ceil((z1 - o[2]) / s - 1e-4));
      if (i0 >= i1 || j0 >= j1 || k0 >= k1) continue; V.clear(i0, j0, k0, i1, j1, k1); n++; }
    return n;
  },
  // is a person's body column clear of every placed prop (voxel-precise) and every building mass? (the cast's safety net, jobs.js)
  personClear(x, y, z, seat = false) { const b = this.blk; if (!b) return true; const y0 = y + (seat ? .8 : .5), y1 = y + 1.45, col = [x - .16, y0, z - .16, x + .16, y1, z + .16];
    for (const f of b.feet.concat(b.plan)) if (hit(col, f.box, .01) && !(f.roofY !== undefined && y >= f.roofY - .05)) return false;   // pass 2: standing ON a roof is allowed
    for (const pl of b.pls) { if (!hit(col, pl.box, .005)) continue; for (const [dx, dz] of [[0, 0], [.14, 0], [-.14, 0], [0, .14], [0, -.14]]) for (let yy = y0; yy <= y1; yy += .15) if (solidAt(pl, x + dx, yy, z + dz)) return false; }
    return true; },
  // pass 2 · what holds a prop up: the ground (REG.groundAt), a walkable surface, a roof it stands on, the top of an item under it
  unsupported(bx) { const b = this.blk, y = bx[1], cx = (bx[0] + bx[3]) / 2, cz = (bx[2] + bx[5]) / 2, g = this.groundAt ? this.groundAt(cx, cz) : SIDE;
    if (Math.abs(y - g) < .06 || y < g) return null;
    for (const sf of b.surfaces) if (cx > sf.box[0] && cx < sf.box[3] && cz > sf.box[2] && cz < sf.box[5] && y <= sf.box[4] + .06) return null;
    for (const f of b.feet) if (f.roofY !== undefined && Math.abs(y - f.roofY) < .08 && cx > f.box[0] && cx < f.box[3] && cz > f.box[2] && cz < f.box[5]) return null;
    for (const it of b.boxes) if (Math.abs(y - it.box[4]) < .06 && bx[0] < it.box[3] && bx[3] > it.box[0] && bx[2] < it.box[5] && bx[5] > it.box[2]) return null;
    return `nothing under it (${r2(y - g)} m up)`; },
  // pass 2 · STRICT text: a letter with no board behind it gets one (the board colour of its text, else ink), so text is never off its board
  backText(V) { if (!this.strict || !V.texts) return 0; let n = 0; const at = (x, y, z) => (x >= 0 && y >= 0 && z >= 0 && x < V.nx && y < V.ny && z < V.nz) ? V.d[x + z * V.nx + y * V.sxz] : 0;
    for (const t of V.texts) { const p = t.pts, cols = new Map(); for (let k = 0; k < p.length; k += 8) { const c = at(p[k + 3], p[k + 1], p[k + 4]); if (c) cols.set(c, (cols.get(c) || 0) + 1); }
      let board = 0, bc = 0; for (const [c, m] of cols) if (m > bc) { bc = m; board = c; } const col = board ? V.pal[board] : 0x17171b, lay = board ? V.lay[board] : 0;
      for (let k = 0; k < p.length; k += 8) if (!at(p[k + 3], p[k + 1], p[k + 4])) { V.set(p[k + 3], p[k + 1], p[k + 4], col, lay); n++; } }
    return n; },
  // pass 2 · the big head (0.8 × 0.75 m, 1.0–1.6 m up) clear of building masses, the plinth zone and facade projections
  headClear(x, y, z) { const b = this.blk; if (!b) return true; const h = [x - .3, y + 1.0, z - .3, x + .3, y + 1.6, z + .3];
    for (const f of b.feet.concat(b.plan)) if (hit(h, f.box, .01) && !(f.roofY !== undefined && y >= f.roofY - .05)) return false;
    for (const k of b.keep) if ((k.tag === 'plinth' || k.tag === 'facade') && hit(h, k.box, .01)) return false; return true; },
  // pass 2 · can a walker (a 0.3 m radius column, 0.1–1.9 m up) pass at (x, z)? → null, or the id of what is in the way. Props are
  // tested voxel by voxel (a street tree blocks with its trunk, not its crown); facade parts that come down into that height, doorways
  // (their first 0.6 m) and the given people are boxes. peds.js walks the lanes this carves (engine.js lanesOf).
  walkBlock(x, z, people = [], rb = .24, rh = .37, y = SIDE) { return walkBlockIn(this.blk, x, z, people, rb, rh, y); },
  // cleanup pass: what walkBlock reads, kept after the build (audit builds: the walk check tests every walker against it, main.js ?report)
  walkSnap() { const b = this.blk; return b ? { feet: b.feet, keep: b.keep, doors: b.doors, pls: b.pls, boxes: b.boxes } : null; },
};
// a placed prop's voxel columns on a 0.1 m grid → Map(q × 65536 + r → [lowest, highest] y), cached on the placement
const CELL = .1;
// (only the voxels a walker could touch count — on the road 0.1 … 1.9 m, on the sidewalk 0.1 … 1.9 m above the slab: a street tree's
// grate and crown share columns with nothing in between, and a lamp's arm hangs over the road far above anyone's head)
const WALK_Y0 = .1, WALK_Y1 = SIDE + 1.9;
export function colsOf(pl) { if (pl._cols) return pl._cols; const M = new Map(), V = pl.V, d = V.d, [c, s] = ROT[pl.rot & 3], [tx, ty, tz] = pl.t, h = V.s / 2;
  for (let j = 0; j < V.ny; j++) { const y = V.org[1] + (j + .5) * V.s + ty; if (y + h <= WALK_Y0 + 1e-6 || y - h >= WALK_Y1 - 1e-6) continue;
  for (let k = 0; k < V.nz; k++) for (let i = 0; i < V.nx; i++) { if (!d[i + k * V.nx + j * V.sxz]) continue;
    const lx = V.org[0] + (i + .5) * V.s, lz = V.org[2] + (k + .5) * V.s, x = lx * c + lz * s + tx, z = -lx * s + lz * c + tz;
    for (let q = Math.floor((x - h) / CELL + 1e-6); q <= Math.floor((x + h) / CELL - 1e-6); q++) for (let r = Math.floor((z - h) / CELL + 1e-6); r <= Math.floor((z + h) / CELL - 1e-6); r++) {
      const key = q * 65536 + r, e = M.get(key); if (e) { if (y - h < e[0]) e[0] = y - h; if (y + h > e[1]) e[1] = y + h; } else M.set(key, [y - h, y + h]); } } }
  return (pl._cols = M); }
export function walkBlockIn(b, x, z, people = [], rb = .24, rh = .37, y = SIDE) { if (!b) return null; const y0 = y + .1, yh = y + 1.25, y1 = y + 1.9;
  // cleanup pass: the walker is two discs — its body (rb, y0–yh) and its big head (rh, yh–y1) — tested exactly against every box (masses,
  // facade parts, items), every standing person (a 0.3 m disc) and every voxel column of every prop; engine.js lanesOf carves with the same
  // shapes (walkObstacles), so a lane carved with wider discs is clear for these. A doorway is no obstacle: walkers pass in front of doors.
  const hitBox = bx => (bx[1] < yh && bx[4] > y0 && dXZ(x, z, bx) < rb) || (bx[1] < y1 && bx[4] > yh && dXZ(x, z, bx) < rh);
  for (const f of b.feet) if (hitBox(f.box)) return 'mass ' + f.group;
  for (const k of b.keep) if (!WALK_FREE.has(k.tag) && hitBox(k.box)) return k.tag + ' ' + k.group;
  for (const p of people) { const py = p.y ?? SIDE; if (py < y1 && py + 1.7 > y0 && Math.hypot(p.x - x, p.z - z) < rh + WALK.r) return 'person ' + p.id; }
  for (const pl of b.pls) { if (FLOCK.has(pl.kind) || dXZ(x, z, pl.box) >= rh || pl.box[1] >= y1 || pl.box[4] <= y0) continue; const C = colsOf(pl), q0 = Math.floor((x - rh) / CELL), q1 = Math.floor((x + rh) / CELL), r0 = Math.floor((z - rh) / CELL), r1 = Math.floor((z + rh) / CELL);
    for (let q = q0; q <= q1; q++) { const dx = Math.max(q * CELL - x, 0, x - (q + 1) * CELL); if (dx > rh) continue;
      for (let r = r0; r <= r1; r++) { const col = C.get(q * 65536 + r); if (!col) continue; const d = Math.hypot(dx, Math.max(r * CELL - z, 0, z - (r + 1) * CELL));
        if ((d < rb && col[0] < yh && col[1] > y0) || (d < rh && col[0] < y1 && col[1] > yh)) return pl.id; } } }
  const vox = b._plsIds ??= new Set(b.pls.map(pl => pl.id)); for (const it of b.boxes) if (!vox.has(it.id) && hitBox(it.box)) return it.id;
  return null; }
// every obstacle of the block a walker must keep clear of, as primitives for lane carving: { box: [x0, y0, z0, x1, y1, z1], name } (masses,
// facade parts, items without voxels, one per voxel column of every prop) and { disc: [x, z, r], y: [y0, y1], name } (standing people)
export function walkObstacles(b, people = []) { const out = [];
  for (const f of b.feet) out.push({ box: f.box, name: 'mass ' + f.group });
  for (const k of b.keep) if (!WALK_FREE.has(k.tag)) out.push({ box: k.box, name: k.tag + ' ' + k.group });
  for (const p of people) { const py = p.y ?? SIDE; out.push({ disc: [p.x, p.z, WALK.r], y: [py, py + 1.7], name: 'person ' + p.id }); }
  for (const pl of b.pls) if (!FLOCK.has(pl.kind)) for (const [key, [ya, yb]] of colsOf(pl)) { const q = Math.round(key / 65536), r = key - q * 65536; out.push({ box: [q * CELL, ya, r * CELL, (q + 1) * CELL, yb, (r + 1) * CELL], name: pl.id }); }
  const vox = b._plsIds ??= new Set(b.pls.map(pl => pl.id)); for (const it of b.boxes) if (!vox.has(it.id)) out.push({ box: it.box, name: it.id });
  return out; }
const FLOCK = new Set(['pigeons']);   // cleanup pass: a flock on the pavement scatters: walkers go through it, it never narrows the clear path
const WALK_FREE = new Set(['plinth', 'corner-zone', 'corner-furniture', 'walkway', 'cop-stand']);   // reservations, not things (the lamps and signals themselves are items; crowd grid: a station cop's stand is a body only while posted — pedsim.js's body map)
const dXZ = (x, z, b) => Math.hypot(Math.max(b[0] - x, 0, x - b[3]), Math.max(b[2] - z, 0, z - b[5]));
const REG2 = {
  // people standing on a walkable surface (yard floor, paving, lot asphalt) stand on top of it, not ankle-deep in it
  snapLife(list) { const b = this.blk; if (!b || !b.surfaces.length) return; for (const p of list) { const y = p.y ?? SIDE; if (y > SIDE + .02) continue;
    const l = liftOnto(b.surfaces, [p.x - .12, y, p.z - .12, p.x + .12, y + 1, p.z + .12]); if (l > 0) p.y = y + l; } },
  // world box of a template at a placement (for fits)
  boxOf(src, rot, tx, ty, tz) { const e = xformBox(bankBox(src), rot, tx, ty, tz); Object.defineProperty(e, '_w', { value: () => this.wboxOf(src, rot, tx, ty, tz) }); return e; },   // (_w: its walker-height slice)
  // a standing (or seated) person needs a clear 0.5 × 1.7 column; doorways are fine for people
  fitsPerson(x, z, y = SIDE, o = {}) { const r = WALK.r; return this.fits([x - .22, y + .05, z - .22, x + .22, y + 1.7, z + .22], { doors: false, walk: false, ...o }) && (o.walk === false || y > SIDE + .4 || !this.walkGap([x - r, y + .1, z - r, x + r, y + 1.7, z + r], o.clear ?? WALK.people)); },   // (a standing person keeps the clear path too)
  group(g) { if (this.blk) this.blk.group = g; },
  idFor(kind) { const b = this.blk, k = b.group + '·' + kind, n = b.n.get(k) || 0; b.n.set(k, n + 1); return `${b.key}·${b.group}·${kind}·${n}`; },
  // stamp hook: returns null to drop the stamp, else { src, rot, tx, ty, tz } (override applied)
  place(src, dst, rot, tx, ty, tz, mode = 'q') {
    const b = this.blk; if (!b || dst !== b.bank) return { src, rot, tx, ty, tz };
    const kind = src.kind || 'mesh', id = this.idFor(kind), ov = b.ov;   // the kind never depends on audit mode: ids match in every build
    if (ov) {
      if (ov.remove && ov.remove.includes(id)) { b.removed.push(id); return null; }
      const rp = ov.replace && ov.replace[id]; if (rp) { const nb = typeof rp === 'function' ? rp() : rp; if (nb && nb.L) src = nb; }
      const mv = ov.move && ov.move[id]; if (mv) { if (mv.to) { tx = mv.to[0]; ty = mv.to[1]; tz = mv.to[2]; } else { tx += mv[0] || 0; ty += mv[1] || 0; tz += mv[2] || 0; } if (mv.rot !== undefined) rot = mv.rot; else if (mv[3] !== undefined) rot = mv[3]; }
    }
    // props snap onto the walkable surface under them (yard floors, plaza paving, parking asphalt sit one voxel above the slab)
    if (src.vol && mode === 'q' && b.surfaces.length) ty += liftOnto(b.surfaces, xformBox(bankBox(src), rot, tx, ty, tz));
    // pass 2 · STRICT (while a district kit's own build runs): a prop that would stand in a mass, a facade part, a doorway or another
    // item, or float with nothing under it, is refused and logged — a kit cannot create intersections or floating props
    if (this.strict && src.vol && mode === 'q' && kind !== 'structure' && !MOUNTED.has(kind)) { const bx = xformBox(bankBox(src), rot, tx, ty, tz), why = this.why(bx) || this.unsupported(bx);
      if (why) { b.skipped.push({ kind, group: b.group, at: [r2(tx), r2(ty), r2(tz)], why: 'strict: ' + why }); b.n.set(b.group + '·' + kind, (b.n.get(b.group + '·' + kind) || 1) - 1); return null; } }
    { const bb0 = bankBox(src), bx = mode === 'q' ? xformBox(bb0, rot, tx, ty, tz) : mode === 'a' ? angBox(bb0, rot, tx, ty, tz) : bb0.slice(); if (!src.vols && kind !== 'structure') b.boxes.push({ id, kind, box: bx });
      if (src.vol && mode === 'q') b.pls.push({ id, kind, V: src.vol, rot, t: [tx, ty, tz], box: bx });
      if (b.walk.length && kind !== 'structure' && !src.vols && !FLOCK.has(kind) && bx[1] < SIDE + WALK.hi) this.walkObs(mode === 'q' ? this.wboxOf(src, rot, tx, ty, tz) || bx : bx, kind); }   // cleanup pass: it stands on the sidewalk now
    if (this.audit) {
      const bb = bankBox(src), box = mode === 'q' ? xformBox(bb, rot, tx, ty, tz) : mode === 'a' ? angBox(bb, rot, tx, ty, tz) : bb.slice();
      const it = { id, kind, group: b.group, box, rot, t: [tx, ty, tz], mode };
      if (src.vols && mode === 'q') { for (const V of src.vols) b.structs.push({ id, kind, V, rot, t: [tx, ty, tz], group: b.group, box: xformBox(volBox(V), rot, tx, ty, tz) }); it.struct = true; }
      else if (src.vol && mode === 'q') it.pl = { V: src.vol, rot, t: [tx, ty, tz] };
      // text problems baked into this template (props' words, lot facades meshed into a temp bank) → per instance
      const ti = src.vol ? (src._ti ??= textCheck(src.vol)) : src.vols ? (src._ti ??= src.vols.flatMap(textCheck)) : [];
      if (mode === 'q') for (const tb of ti) b.issues.push({ ...tb, id, kind: it.kind, group: b.group, box: xformBox(tb.box, rot, tx, ty, tz) });
      b.items.push(it);
    }
    return { src, rot, tx, ty, tz };
  },
  // a volume meshed straight into the block bank (heroes, yards, towers): a structure of the current group
  vol(V, bank) {
    const b = this.blk; if (!b || bank !== b.bank) return; const id = this.idFor('structure'); if (!this.audit) return;
    b.structs.push({ id, V, rot: 0, t: [0, 0, 0], group: b.group, box: volBox(V) }); b.items.push({ id, kind: 'structure', group: b.group, box: volBox(V), struct: true, rot: 0, t: [0, 0, 0] });
    for (const tb of textCheck(V)) b.issues.push({ ...tb, id, kind: 'structure', group: b.group });
  },
  door(x, z, rot) { if (this.blk) this.blk.doors.push({ x, z, rot, group: this.blk.group }); },
  footprint(x0, z0, x1, z1, y1, roofY) { if (!this.blk) return null; const f = { box: [x0, SIDE, z0, x1, y1, z1], group: this.blk.group, roofY }; this.blk.feet.push(f); return f; },
  end(cast, ground) { const b = this.blk; this.blk = null; this.audit = false; if (!b) return null; return b.audit ? { ...runChecks(b, cast, ground), skipped: b.skipped, signs: b.signs || [] } : { key: b.key, removed: b.removed }; },   // pass 3: + the signage log (tools/audit.mjs sign-repeat)
};
Object.assign(REG, REG2);   // (the registry's second half: walkBlock sits outside it as walkBlockIn, cleanup pass)
const volBox = V => [V.org[0], V.org[1], V.org[2], V.org[0] + V.nx * V.s, V.org[1] + V.ny * V.s, V.org[2] + V.nz * V.s];
// ── the clear walkway rule's geometry. A sidewalk S = { k, ax ('x': it runs along x), u0, u1 (its length, corners included), cur (the
// curb line), dir (+1: c grows with the coordinate), w (its width: 2 today; SPREAD: swX / swZ) }; c = metres from the curb (0) to the lot line (w).
const WALK_TAGS = new Set(['facade', 'transit', 'corner-zone', 'hotspot']);
function spanOf(S, box) {   // → [u0, u1, c0, c1] of a world box on this sidewalk, or null when it misses it
  const [a0, a1, p0, p1] = S.ax === 'x' ? [box[0], box[3], box[2], box[5]] : [box[2], box[5], box[0], box[3]];
  if (a1 <= S.u0 + 1e-3 || a0 >= S.u1 - 1e-3) return null; const c0 = S.dir > 0 ? p0 - S.cur : S.cur - p1, c1 = S.dir > 0 ? p1 - S.cur : S.cur - p0;
  return c1 <= 1e-3 || c0 >= (S.w ?? 2) - 1e-3 ? null : [a0, a1, c0, c1]; }
// the walkers' corridor at u: between what stands on the kerb side (its middle nearer the curb than WALK.split) and what stands on the
// frontage side, each counted in full within ±WALK.win along the sidewalk and WALK.slope m per metre less beyond that (the lane bends
// round it: a pair of things on opposite sides narrows the path by their gap across plus WALK.slope × their distance along − 2 WALK.win)
function gapAt(S, b, u, extra) {
  const dw = (S.w ?? 2) - 2, face = WALK.face + dw, split = WALK.split * (S.w ?? 2) / 2;   // (SPREAD: the side's own walk — the face 0.2 short of its lot line, the split its middle)
  let K = 0, F = face;
  const take = o => { if (!o) return; const t = WALK.slope * Math.max(0, Math.max(o[0] - u, u - o[1]) - WALK.win); if (t >= face) return;
    if ((o[2] + o[3]) / 2 < split) K = Math.max(K, o[3] - t); else F = Math.min(F, o[2] + t); };
  for (const o of S.obs) take(o); take(extra);
  for (const f of b.feet) take(spanOf(S, f.box)); for (const f of b.plan) take(spanOf(S, f.box));
  if (b.life) for (const p of b.life) { if ((p.y ?? SIDE) > SIDE + .4) continue; take(spanOf(S, [p.x - WALK.r, SIDE, p.z - WALK.r, p.x + WALK.r, SIDE + 1.7, p.z + WALK.r])); }
  return F - K; }
// how far to lift a prop whose base sits inside a walkable surface (≤ 0.35 m; never onto fences or walls taller than that)
function liftOnto(surfaces, box) {
  const base = box[1], pts = [[(box[0] + box[3]) / 2, (box[2] + box[5]) / 2], [box[0] + .08, box[2] + .08], [box[3] - .08, box[2] + .08], [box[0] + .08, box[5] - .08], [box[3] - .08, box[5] - .08]]; let lift = 0;
  for (const sf of surfaces) { if (!(box[0] < sf.box[3] && box[3] > sf.box[0] && box[2] < sf.box[5] && box[5] > sf.box[2])) continue; const V = sf.V;
    for (const [x, z] of pts) { const i = Math.floor((x - V.org[0]) / V.s), k = Math.floor((z - V.org[2]) / V.s); if (i < 0 || k < 0 || i >= V.nx || k >= V.nz) continue;
      let j = Math.floor((base + .02 - V.org[1]) / V.s); if (j < 0 || j >= V.ny || !V.d[i + k * V.nx + j * V.sxz]) continue;
      let top = j; while (top + 1 < V.ny && V.d[i + k * V.nx + (top + 1) * V.sxz] && top - j < 3) top++;
      const l = V.org[1] + (top + 1) * V.s - base; if (l > 0 && l <= .35) lift = Math.max(lift, l); } }
  return lift;
}

// ── the checks
const hex = c => '#' + (c >>> 0).toString(16).padStart(6, '0');
function voxelAt(pl, x, y, z) {   // → { j, v, up } (up: the voxel above is solid) or null
  const V = pl.V; let lx = x - pl.t[0], lz = z - pl.t[2]; const ly = y - pl.t[1];
  if (pl.rot) { const [c, s] = ROT[pl.rot & 3]; const ux = lx * c - lz * s, uz = lx * s + lz * c; lx = ux; lz = uz; }
  const i = Math.floor((lx - V.org[0]) / V.s), j = Math.floor((ly - V.org[1]) / V.s), k = Math.floor((lz - V.org[2]) / V.s);
  if (i < 0 || j < 0 || k < 0 || i >= V.nx || j >= V.ny || k >= V.nz) return null; const v = V.d[i + k * V.nx + j * V.sxz]; if (!v) return null;
  return { j, v: V.pal[v], up: j + 1 < V.ny && V.d[i + k * V.nx + (j + 1) * V.sxz] !== 0 };
}
function runChecks(b, cast, groundAt) {
  const t0 = Date.now(), issues = b.issues, S = b.structs, props = b.items.filter(it => !it.struct), add = (type, it, extra) => issues.push({ type, id: it.id, kind: it.kind, group: it.group, box: it.box, ...extra });
  const inFoot = (x, y, z) => { for (const f of b.feet) { const q = f.box; if (x > q[0] + .02 && x < q[3] - .02 && z > q[2] + .02 && z < q[5] - .02 && y < q[4]) return f; } return null; };
  const inBox = (s, x, y, z) => x >= s.box[0] && x < s.box[3] && y >= s.box[1] && y < s.box[4] && z >= s.box[2] && z < s.box[5];
  const structAt = (x, y, z, near) => { for (const s of near) if (inBox(s, x, y, z) && solidAt(s, x, y, z)) return s; return null; };
  const hitAt = (x, y, z, near) => { for (const s of near) if (inBox(s, x, y, z)) { const h = voxelAt(s, x, y, z); if (h) return { s, ...h }; } return null; };
  const P = props.filter(it => it.pl), propAt = (x, y, z, list, not) => list.some(it => it !== not && solidAt(it.pl, x, y, z));
  // 1 · props against structures, doors, the ground and each other
  for (const it of props) {
    if (!it.pl) continue; const c = cells(it.pl), s0 = it.pl.V.s, grow2 = [it.box[0] - .2, it.box[1] - .2, it.box[2] - .2, it.box[3] + .2, it.box[4] + .2, it.box[5] + .2];
    const near = S.filter(s => hit(s.box, grow2)), nearP = P.filter(o => o !== it && hit(o.box, grow2)), bottomJ = it.pl._minJ, soft = SOFT.has(it.kind);
    let inMass = 0, inFacade = 0, sunk = 0, n = 0, bot = 0, botOk = 0, touch = 0, where = null; const cols = new Map();
    for (let k = 0; k < c.length; k += 4) { const x = c[k], y = c[k + 1], z = c[k + 2], j = c[k + 3]; n++;
      const h = near.length ? hitAt(x, y, z, near) : null;
      if (h) { if (h.j === 0 && !h.up && j <= bottomJ + 1) sunk++; else if (inFoot(x, y, z)) { inMass++; where ??= h.s.group; } else { inFacade++; where ??= h.s.group; cols.set(h.v, (cols.get(h.v) || 0) + 1); } }
      if (j === bottomJ) { bot++; const yb = y - s0 * .5 - .04, g = groundAt(x, z);
        if (yb <= g + .005 || (near.length && structAt(x, yb, z, near)) || propAt(x, yb, z, nearP, it)) botOk++; }
      if (!touch && near.length && (j === bottomJ || k % 12 === 0)) for (const [dx, dy, dz] of [[s0, 0, 0], [-s0, 0, 0], [0, 0, s0], [0, 0, -s0], [0, -s0, 0]]) if (structAt(x + dx, y + dy, z + dz, near)) { touch++; break; }
    }
    const lim = Math.max(2, n * .01), col = [...cols].sort((p, q) => q[1] - p[1])[0];
    if (!soft && inMass > lim) add('prop-in-building', it, { bad: inMass, of: n, note: `${inMass} voxels inside the ${where} building mass` });
    else if (!soft && inFacade > lim) add('prop-in-facade', it, { bad: inFacade, of: n, note: `${inFacade} voxels inside ${where} facade parts (colour ${col ? hex(col[0]) : '?'})` });
    if (sunk > Math.max(2, bot * .3)) add('prop-sunk', it, { bad: sunk, note: `base sits inside the ${near[0]?.group || ''} ground surface (${sunk} voxels)` });
    const g0 = groundAt((it.box[0] + it.box[3]) / 2, (it.box[2] + it.box[5]) / 2);
    if (bot && botOk / bot < .2 && !touch && !MOUNTED.has(it.kind)) add('prop-floating', it, { gap: r2(it.box[1] - g0), note: `${Math.round(100 - 100 * botOk / bot)}% of its base has nothing under it, ${r2(it.box[1] - g0)} m above the ground` });
    // pass 2: a prop in more than one piece (giant objects hanging below their bracket, signs off their posts)
    // (pieces standing on the prop's floor are fine — two solar rows, a stand — a piece in the air is not; a wall-mounted prop is one piece)
    if (!LOOSE.has(it.kind)) { const V = it.pl.V, pc = pieces(V).filter(p => p.n >= 4), floor = V.org[1] + .05, air = V.ground ? pc.filter(p => p.box[1] > floor) : pc.slice(1);
      if (pc.length > 1 && air.length) add('prop-detached', it, { bad: air.reduce((s, p) => s + p.n, 0), note: `${pc.length} separate pieces, ${air.length} in the air (${air.slice(0, 2).map(p => p.n + ' voxels at ' + r2(p.box[1] - V.org[1]) + ' m').join(', ')})` }); }
    // vehicles on the road must stay off the curb (the slab is 0.2 up)
    if (VEHICLES.has(it.kind) && it.t[1] < .05) { const e = it.box, pts = [[e[0] + .15, e[2] + .15], [e[3] - .15, e[2] + .15], [e[0] + .15, e[5] - .15], [e[3] - .15, e[5] - .15]];
      if (pts.some(([x, z]) => groundAt(x, z) > .1)) add('car-in-curb', it, { note: 'a wheel stands inside the raised sidewalk' }); }
    // doorways: a 1.5 m wide, 1.1 m deep, 2.4 m tall zone in front of every door stays clear (voxel test)
    for (const dr of b.doors) { const zone = doorZone(dr); if (!hit(zone, it.box, .02)) continue; let m = 0;
      for (let k = 0; k < c.length; k += 4) if (c[k] > zone[0] && c[k] < zone[3] && c[k + 1] > zone[1] && c[k + 1] < zone[4] && c[k + 2] > zone[2] && c[k + 2] < zone[5]) m++;
      if (m > 2) { add('blocks-door', it, { bad: m, note: `${m} voxels in the ${dr.group} doorway` }); break; } }
  }
  // 2 · props against props (voxel overlap)
  for (let a = 0; a < P.length; a++) for (let c2 = a + 1; c2 < P.length; c2++) { const A = P[a], B = P[c2]; if (!hit(A.box, B.box, .01)) continue; if (SOFT.has(A.kind) || SOFT.has(B.kind)) continue;
    const [sm, lg] = cells(A.pl).length <= cells(B.pl).length ? [A, B] : [B, A], c = cells(sm.pl); let ov = 0;
    for (let k = 0; k < c.length; k += 4) if (solidAt(lg.pl, c[k], c[k + 1], c[k + 2])) ov++;
    if (ov > Math.max(2, (c.length / 4) * .01)) issues.push({ type: 'prop-overlap', id: sm.id, other: lg.id, kind: sm.kind, group: sm.group, box: sm.box, bad: ov, note: `${sm.kind} runs ${ov} voxels into ${lg.kind} ${lg.id}` }); }
  // 3 · structures against structures: solid in both = coincident faces (z-fighting) where exposed
  for (let a = 0; a < S.length; a++) for (let c2 = a + 1; c2 < S.length; c2++) { const A = S[a], B = S[c2]; if (!hit(A.box, B.box, .01) || A.rot || B.rot) continue;
    const s = Math.min(A.V.s, B.V.s), bx = [Math.max(A.box[0], B.box[0]), Math.max(A.box[1], B.box[1]), Math.max(A.box[2], B.box[2]), Math.min(A.box[3], B.box[3]), Math.min(A.box[4], B.box[4]), Math.min(A.box[5], B.box[5])];
    const nx = Math.round((bx[3] - bx[0]) / s), ny = Math.round((bx[4] - bx[1]) / s), nz = Math.round((bx[5] - bx[2]) / s); if (nx * ny * nz > 4e6) continue;
    let n = 0, cA = 0, cB = 0; const bb = box0(), both = (x, y, z) => solidAt(A, x, y, z) && solidAt(B, x, y, z);
    for (let j = 0; j < ny; j++) for (let k = 0; k < nz; k++) for (let i = 0; i < nx; i++) { const x = bx[0] + (i + .5) * s, y = bx[1] + (j + .5) * s, z = bx[2] + (k + .5) * s; if (!both(x, y, z)) continue;
      const open = [[s, 0, 0], [-s, 0, 0], [0, s, 0], [0, -s, 0], [0, 0, s], [0, 0, -s]].some(([dx, dy, dz]) => !solidAt(A, x + dx, y + dy, z + dz) && !solidAt(B, x + dx, y + dy, z + dz));
      if (open) { n++; grow(bb, x - s / 2, y - s / 2, z - s / 2); grow(bb, x + s / 2, y + s / 2, z + s / 2); if (!cA) { cA = voxelAt(A, x, y, z).v; cB = voxelAt(B, x, y, z).v; } } }
    if (n >= 4) issues.push({ type: 'z-fight', id: A.id, other: B.id, kind: 'structure', group: A.group, box: bb, bad: n, note: `${n} exposed voxels drawn by both ${A.id} (${hex(cA)}) and ${B.id} (${hex(cB)})${cA === cB ? ', same colour' : ''}` }); }
  // 4 · floating islands inside each structure
  for (const s of S) { if (s.rot) continue; for (const f of islands(s.V)) issues.push({ type: 'floating-geometry', id: s.id, kind: s.kind || 'structure', group: s.group, box: f.box, bad: f.n, note: `${f.n} voxels (mostly ${hex(f.col)}) float free of the ${s.group} volume` }); }
  // 5 · characters: body column inside geometry; feet (or seat) with nothing under them
  let chars = 0;
  for (const c of cast || []) { chars++; if (c.act === 'window' || c.act === 'soak') continue;
    const sc = c.scale || 1, giant = sc > 1.5, near = S.filter(s => c.x >= s.box[0] - .6 * sc && c.x <= s.box[3] + .6 * sc && c.z >= s.box[2] - .6 * sc && c.z <= s.box[5] + .6 * sc),
      nearP = P.filter(it => c.x >= it.box[0] - .6 && c.x <= it.box[3] + .6 && c.z >= it.box[2] - .6 && c.z <= it.box[5] + .6);
    const seat = /sit|lounge|fe/.test(c.act || ''), y0 = c.y + (seat ? .8 : .5) * sc, y1 = c.y + 1.45 * sc, offs = giant ? [[0, 0]] : [[0, 0], [.14, 0], [-.14, 0], [0, .14], [0, -.14]]; let inside = 0, tot = 0, what = null;
    for (const [dx, dz] of offs) for (let y = y0; y <= y1; y += .15 * sc) { tot++; const x = c.x + dx * sc, z = c.z + dz * sc; const s = structAt(x, y, z, near), p = s ? null : nearP.find(it => solidAt(it.pl, x, y, z)); if (s || p) { inside++; what ??= s ? s.id : p.id; } }
    const box = [c.x - .3 * sc, c.y, c.z - .3 * sc, c.x + .3 * sc, c.y + 1.75 * sc, c.z + .3 * sc];
    if (inside > tot * .2) issues.push({ type: 'char-inside', id: c.id, kind: 'char', group: c.act || 'person', box, bad: inside, other: what, note: `${c.act || 'person'}: ${Math.round(100 * inside / tot)}% of the body inside ${what}` });
    // support: scan 0.3 m below the feet (seated: below the seat) for ground, a structure or a prop
    const top = seat ? c.y + .55 * sc : c.y + .06; let ok = false;
    for (const [dx, dz] of [[0, 0], [.15, 0], [-.15, 0], [0, .15], [0, -.15]]) { const x = c.x + dx * sc, z = c.z + dz * sc; if (top - .35 <= groundAt(x, z) + .02) { ok = true; break; }
      for (let y = top; y >= top - .35 && !ok; y -= .05) if (structAt(x, y, z, near) || nearP.some(it => solidAt(it.pl, x, y, z))) ok = true; if (ok) break; }
    if (!ok) issues.push({ type: 'char-floating', id: c.id, kind: 'char', group: c.act || 'person', box, note: `${c.act || 'person'} ${seat ? 'sits' : 'stands'} on nothing` });
    // walkers-fix round · nobody stands where the cars drive: a travel lane (traffic/sim.js lanesOf, ± a car's half-width) or an intersection
    { const lane = c.y < SIDE - .05 ? laneAt(c.x, c.z, .3 * sc) : null; if (lane) issues.push({ type: 'char-in-lane', id: c.id, kind: 'char', group: c.act || 'person', box, note: `${c.act || 'person'} stands in ${lane}: the cars drive through it` }); }
    // pass 2 · the big head (0.8 × 0.75 m) inside a railing or a wall: fire-escape sitters (their body is placed against geometry on
    // purpose, so the column test above skips them) and everyone else whose head, not body, runs into something
    if (!giant && c.act !== 'window' && c.act !== 'soak') { let hh = 0, ht = 0;
      let hc = null; for (const dx of [-.28, 0, .28]) for (const dz of [-.26, 0, .26]) for (const dy of [1.02, 1.3, 1.58]) { ht++; const x = c.x + dx, y = c.y + dy, z = c.z + dz, h = hitAt(x, y, z, near); if (h) { hh++; hc ??= h; } }
      if (hh > 3) issues.push({ type: 'char-railing', id: c.id, kind: 'char', group: c.act || 'person', box, bad: hh, other: hc?.s.id, note: `${c.act || 'person'}: ${hh}/${ht} points of the head inside ${c.act === 'fe' ? 'the fire-escape railing' : hc?.s.id || 'geometry'} (${hc ? hex(hc.v) : '?'})` }); }
  }
  // pass 2 · people inside people: two heads closer than 0.7 m at the same height (the queue at 1.15 m still touched)
  const cs = (cast || []).filter(c => (c.scale || 1) <= 1.5);
  for (let a = 0; a < cs.length; a++) for (let q2 = a + 1; q2 < cs.length; q2++) { const A = cs[a], B2 = cs[q2], d = Math.hypot(A.x - B2.x, A.z - B2.z);
    if (d < .7 && Math.abs(A.y - B2.y) < .6) issues.push({ type: 'char-overlap', id: A.id, other: B2.id, kind: 'char', group: A.act || 'person', box: [Math.min(A.x, B2.x) - .4, Math.min(A.y, B2.y), Math.min(A.z, B2.z) - .4, Math.max(A.x, B2.x) + .4, Math.max(A.y, B2.y) + 1.75, Math.max(A.z, B2.z) + .4], bad: +(100 * (.7 - d)).toFixed(0), note: `${A.act || 'person'} and ${B2.act || 'person'} ${d.toFixed(2)} m apart: heads overlap` }); }
  // tidy: one line per (type, id, other)
  const seen = new Set(), out = [];
  for (const q of issues) { const k = q.type + '|' + q.id + '|' + (q.other || '') + '|' + (q.text || '') + '|' + (q.type === 'floating-geometry' ? q.box.join() : ''); if (seen.has(k)) continue; seen.add(k); out.push({ ...q, box: rbox(q.box) }); }
  const kinds = {}; for (const it of b.items) kinds[it.kind] = (kinds[it.kind] || 0) + 1;
  return { key: b.key, i: b.i, j: b.j, items: b.items.length, structs: S.length, chars, kinds, removed: b.removed, issues: out, ms: Date.now() - t0,
    list: b.items.map(it => [it.id, rbox(it.box)]), people: (cast || []).map(c => [c.id, c.act, r2(c.x), r2(c.y), r2(c.z)]) };   // every id, for override files
}
// walkers-fix round · is (x, z) in a travel lane (its centre ± 1 m, a car's half-width, + r) or an intersection box? → what, or null.
// Parking lanes, a one-way's parking half and the road outside the lanes are not travel lanes.
export function laneAt(x, z, r = .25) { const Lx = Math.round(x / P), Lz = Math.round(z / P), dx = x - Lx * P, dz = z - Lz * P, i = Math.floor(x / P), j = Math.floor(z / P);
  if ((segX(Lx, Lz - 1) || segX(Lx, Lz)) && (segZ(Lz, Lx - 1) || segZ(Lz, Lx)) && Math.abs(dx) < hwX(Lx) && Math.abs(dz) < hwZ(Lz)) return `the intersection at ${Lx},${Lz}`;
  const offs = (axis, L) => { const o = carLanes(axis, L), sg = axis === 'x' ? -1 : 1; if (!isOneWay(axis, L)) return o.flatMap(v => [v, -v]); const d = oneWayDir(axis, L); return o.map(v => v * sg * d); };   // (right of travel: −x going +z, +z going +x)
  if (segX(Lx, j) && Math.abs(dx) < hwX(Lx)) { const o = offs('x', Lx).find(v => Math.abs(dx - v) < 1 + r); if (o !== undefined) return `the N–S road at x ${Lx * P}'s lane at ${o > 0 ? '+' : ''}${+o.toFixed(2)}`; }
  if (segZ(Lz, i) && Math.abs(dz) < hwZ(Lz)) { const o = offs('z', Lz).find(v => Math.abs(dz - v) < 1 + r); if (o !== undefined) return `the E–W road at z ${Lz * P}'s lane at ${o > 0 ? '+' : ''}${+o.toFixed(2)}`; }
  return null; }
// the clear zone in front of a door: 1.5 m wide, 1.1 m out from the wall, 2.4 m tall (door.x/z = 0.5 m out, rot = facing)
export function doorZone(dr) { const [nx, nz] = [[0, 1], [1, 0], [0, -1], [-1, 0]][dr.rot], cx = dr.x - nx * .5, cz = dr.z - nz * .5, hw = .75;
  return nx ? [Math.min(cx, cx + nx * 1.1), SIDE, cz - hw, Math.max(cx, cx + nx * 1.1), SIDE + 2.4, cz + hw] : [cx - hw, SIDE, Math.min(cz, cz + nz * 1.1), cx + hw, SIDE + 2.4, Math.max(cz, cz + nz * 1.1)]; }
