// CHARACTER AUDIT · the voxel model and the checks (read-only over world/chars.js and style/city/anim/).
// A look is composed (chars.js compose) once per layer, in compose's own order, so every voxel knows its OWNER (the slot that last
// wrote it) and what it overwrote or clipped. Voxels go to the walk v2 segments exactly as bake.js bakeSegFull assigns them
// (bodyPart + partOf + the pelvis rule, the joint slabs), and the segments are posed with the real shader's per-part transforms
// (poses.json, captured from walk2.js ANIM2_GLSL by poses.html). Units: voxels (1 voxel = 5 cm), chars.js body space.
export const S = 1 / 20;
export const vk = (x, y, z) => ((x + 256) << 18) | ((y + 256) << 9) | (z + 256), vd = k => [(k >> 18) - 256, ((k >> 9) & 511) - 256, (k & 511) - 256];
export const N6 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const N26 = []; for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) if (x || y || z) N26.push([x, y, z]);
const add = (k, d, s = 1) => { const [x, y, z] = vd(k); return vk(x + d[0] * s, y + d[1] * s, z + d[2] * s); };

// ── which segment: the routing and the joint slabs bake.js uses, from their one home (world/fit/body.js; was a verbatim copy here)
import { partOf, segOf, SLABS as SLABS0, slabRows, slabSkips } from '../../../../world/fit/body.js';
export const PARTN = ['chest', 'thighL', 'thighR', 'armL', 'armR', 'head', 'shinL', 'shinR', 'footL', 'footR', '(forearmL)', '(forearmR)', 'pelvis'];   // (simple arms: 10, 11 unused)
export const SLABS = SLABS0;
const SLABPAIR = new Set(); for (const [c, ps] of SLABS) for (const p of ps) { SLABPAIR.add(c * 16 + p); SLABPAIR.add(p * 16 + c); }
export const SKEL = new Set(['shoulder', 'waist', 'hip', 'hem→thigh', 'knee', 'ankle', 'neck', 'thigh→foot']);   // (simple arms, 2026-09-30: no elbow, no forearm)
export function jointOf(a, b) { const [p, q] = a < b ? [a, b] : [b, a], s = p + ',' + q;
  return { '0,3': 'shoulder', '0,4': 'shoulder', '0,12': 'waist', '1,12': 'hip', '2,12': 'hip', '0,1': 'hem→thigh', '0,2': 'hem→thigh',
    '1,6': 'knee', '2,7': 'knee', '6,8': 'ankle', '7,9': 'ankle', '0,5': 'neck', '1,8': 'thigh→foot', '2,9': 'thigh→foot', '1,2': 'crotch', '3,12': 'hand→pelvis', '4,12': 'hand→pelvis', '1,3': 'hand→thigh', '2,4': 'hand→thigh' }[s] || ('parts ' + PARTN[p] + '|' + PARTN[q]); }

// ── compose, layer by layer: owners, overwrites, clips
export const ORDER = ['mark', 'neck', 'hair', 'hat', 'eyewear', 'ears', 'acc', 'held'];   // compose()'s order for the optional slots (base, shoes, bottom, top come first)
export const RANK = { base: 0, face: 0, shoes: 1, bottom: 2, top: 3, hands: 3.5, mark: 4, neck: 5, hair: 6, hat: 7, eyewear: 8, ears: 9, acc: 10, held: 11 };
const off = s => s === 'mark' ? 'none' : { id: 'none' };
function cells(CH, L) { const c = CH.compose(structuredClone(L)), M = new Map();   // 'B'|'H' + key → [colour, layer]
  c.B.L.forEach((m, li) => { for (const [k, v] of m) M.set('B' + k, [v, li]); });
  if (c.HX) c.HX.L.forEach((m, li) => { for (const [k, v] of m) M.set('X' + k, [v, li]); });
  c.H.L.forEach((m, li) => { for (const [k, v] of m) M.set('H' + k, [v, li]); });
  c.F.L.forEach((m, li) => { for (const [k, v] of m) if (!M.has('H' + k)) M.set('F' + k, [v, li]); });
  return [c, M]; }
export function model(CH, L0) {
  const L = structuredClone(L0), steps = [], own = new Map(), clipped = [], over = [];
  let cur = structuredClone(L); for (const s of ORDER) cur[s] = off(s);
  let [c, prev] = cells(CH, cur);
  for (const [id, v] of prev) { const k = +id.slice(1), g = id[0]; own.set(id, g === 'B' ? (c.tag.get(k) || 'base') : g === 'F' ? 'face' : 'base'); }
  for (const s of ORDER) { if ((s === 'mark' ? L.mark : L[s]?.id) === 'none' || L[s] === undefined) continue;
    cur[s] = structuredClone(L[s]); const [c2, M] = cells(CH, cur);
    for (const [id, v] of M) { const p = prev.get(id); if (!p || p[0] !== v[0] || p[1] !== v[1]) { if (p) over.push([s, own.get(id), id]); own.set(id, s); } }
    for (const [id] of prev) if (!M.has(id)) { clipped.push([s, own.get(id), id]); own.delete(id); }
    // (a later layer can also move a face voxel between H and F: keep owners in sync)
    for (const id of [...own.keys()]) if (!M.has(id)) own.delete(id);
    prev = M; c = c2; }
  // voxels → segments (bakeSegFull)
  const V = new Map();   // id → { k, x, y, z, c, l, own, part, g }
  for (const [id, [col, li]] of prev) { const g0 = id[0], k = +id.slice(1), [x, y, z] = vd(k), o = own.get(id) || 'base'; let part;
    if (g0 === 'B') part = segOf(c.tag.get(k) || 'base', x, y, z, c.fit);
    else if (g0 === 'X') part = partOf(x < 0 ? 'armL' : 'armR', x + .5, y + .5, z + .5);
    else part = 5;
    V.set(id, { id, k, x, y, z, c: col, l: li, own: o, part, g: g0 }); }
  // occupancy (a cell can hold a body voxel and a head voxel at once: the head grid is separate)
  const occ = new Map(); for (const v of V.values()) { const a = occ.get(v.k); if (a) a.push(v); else occ.set(v.k, [v]); }
  return { L, V, occ, over, clipped, tag: c.tag };
}
const exposedDirs = (m, v) => N6.filter(d => !m.occ.has(vk(v.x + d[0], v.y + d[1], v.z + d[2])));

// ── 1 · floating parts
export function floating(m) {
  const out = [], seen = new Set(), comps = [];
  for (const k of m.occ.keys()) { if (seen.has(k)) continue; const q = [k], cc = []; seen.add(k);
    while (q.length) { const a = q.pop(); cc.push(a); for (const d of N6) { const b = add(a, d); if (m.occ.has(b) && !seen.has(b)) { seen.add(b); q.push(b); } } } comps.push(cc); }
  comps.sort((a, b) => b.length - a.length);
  for (const cc of comps.slice(1)) { const owners = {}; for (const k of cc) for (const v of m.occ.get(k)) owners[v.own] = (owners[v.own] || 0) + 1;
    const set = new Set(cc); let diag = false; for (const k of cc) { for (const d of N26) { const b = add(k, d); if (m.occ.has(b) && !set.has(b)) { diag = true; break; } } if (diag) break; }
    out.push({ kind: diag ? 'diagonal-only contact' : 'detached', n: cc.length, owners, keys: cc }); }
  // per segment: a piece of a segment that isn't joined to the segment's main mass rides that segment but is held by another one
  const seg = [];
  for (let p = 0; p < 13; p++) { const ks = new Set(); for (const v of m.V.values()) if (v.part === p) ks.add(v.k); const sn = new Set(), cs = [];
    for (const k of ks) { if (sn.has(k)) continue; const q = [k], cc = []; sn.add(k); while (q.length) { const a = q.pop(); cc.push(a); for (const d of N6) { const b = add(a, d); if (ks.has(b) && !sn.has(b)) { sn.add(b); q.push(b); } } } cs.push(cc); }
    cs.sort((a, b) => b.length - a.length);
    for (const cc of cs.slice(1)) { const owners = {}; for (const k of cc) for (const v of m.occ.get(k)) if (v.part === p) owners[v.own] = (owners[v.own] || 0) + 1;
      const touch = {}; for (const k of cc) for (const d of N6) { const b = add(k, d), w = m.occ.get(b); if (w) for (const v of w) if (v.part !== p) touch[v.part] = (touch[v.part] || 0) + 1; }
      seg.push({ part: p, n: cc.length, owners, touch, keys: cc }); } }
  return { rest: out, seg };
}

// ── 2 · hot extrusion: height of an item's voxel above what it lies on (accessories) or above its own shell (garments)
export const BUDGET = { 'mouth piece': 1, print: 0, collar: 1, structure: 1, 'puffer structure': 2, chain: 1, pendant: 1, 'ear jewellery': 1, eyewear: 1, accessory: 2, 'face ink': 0, 'hat decal': 0, 'shoe detail': 1 };
const PUFFY = /puffer|bubble|furcoat|fuzz|chenille/;
const GARMENT = new Set(['top', 'bottom', 'shoes', 'hat']), ACCS = new Set(['neck', 'ears', 'eyewear', 'acc', 'mark']);
// the bare body (chars.js base() + hands()): a garment's thickness is measured down to it, since garments overwrite the body's voxels
const BODY = new Set(); { const box = (x0, y0, z0, x1, y1, z1) => { for (let x = x0; x < x1; x++) for (let y = y0; y < y1; y++) for (let z = z0; z < z1; z++) BODY.add(vk(x, y, z)); };
  box(-4, 0, -1, -1, 10, 2); box(1, 0, -1, 4, 10, 2); box(-5, 10, -2, 5, 18, 3); box(-8, 10, -1, -5, 17, 1); box(5, 10, -1, 8, 17, 1); box(-1, 17, -1, 1, 19, 1); box(-8, 19, -7, 8, 34, 8);
  box(-10, 23, -1, -8, 28, 2); box(8, 23, -1, 10, 28, 2); box(-8, 6, -2, -5, 10, 2); box(5, 6, -2, 8, 10, 2); }
export { BODY };
export function extrusion(m) {
  const byOwn = new Map(); for (const v of m.V.values()) { if (!GARMENT.has(v.own) && !ACCS.has(v.own)) continue; (byOwn.get(v.own) || byOwn.set(v.own, []).get(v.own)).push(v); }
  const out = [];
  for (const [o, vs] of byOwn) {
    const id = m.L[o]?.id ?? m.L[o], fam = colourFamily(vs), runs = [], acc = ACCS.has(o);
    for (const v of vs) { if (v.g === 'F') continue; if (o === 'hat' && !(v.x >= -9 && v.x <= 8 && v.z >= -8 && v.z <= 8)) continue;   // (a brim or a bill stands off by design)
      for (const d of exposedDirs(m, v)) { if (!acc && d[2] === 0) continue; let t = 0, k = v.k, on = false;   // garments: the front and back (prints, logos, letters, collars, quilting)
      if (acc) { for (;;) { const w = m.occ.get(k); if (!w) break; if (!w.some(u => u.own === o)) { on = true; break; } if (!BODY.has(k)) t++; k = add(k, d, -1); if (t > 12) break; } }   // (a voxel that replaced skin is a recolour, not relief)
      else { for (;;) { if (BODY.has(k)) { on = true; break; } const w = m.occ.get(k); if (!w || !w.some(u => u.own === o)) break; t++; k = add(k, d, -1); if (t > 12) break; } }
      runs.push({ v, d, t, on }); } }
    // a garment's own shell: the most common surface depth nearby (radius 5, same facing); relief is how far a face stands in front of it
    const plane = N6.map(() => new Map());
    for (const r of runs) { const di = N6.indexOf(r.d); if (acc || r.d[2] === 0) continue; const k = r.v.x * 1000 + r.v.y, h = r.v.z * r.d[2], o2 = plane[di].get(k); if (o2 === undefined || h > o2) plane[di].set(k, h); }
    const base = (r, di) => { const hs = {}; for (let a2 = -5; a2 <= 5; a2++) for (let b2 = -5; b2 <= 5; b2++) { const t = plane[di].get((r.v.x + a2) * 1000 + r.v.y + b2); if (t !== undefined) hs[t] = (hs[t] || 0) + 1; }
      let b = 0, bc = -1; for (const t in hs) if (hs[t] > bc) { bc = hs[t]; b = +t; } return b; };
    const hot = new Map(), panel = v => v.x >= -6 && v.x <= 5 && v.y >= 9 && v.y <= 16;
    for (const r of runs) { if (acc && !r.on) continue; const di = N6.indexOf(r.d); let relief = acc ? r.t : r.v.z * r.d[2] - base(r, di), cat;
      if (relief <= 0) continue;
      if (o === 'neck') cat = r.v.y <= 13 ? 'pendant' : 'chain'; else if (o === 'ears') cat = 'ear jewellery'; else if (o === 'eyewear') cat = 'eyewear'; else if (o === 'acc') cat = 'accessory'; else if (o === 'mark') cat = 'face ink';
      else if (o === 'hat') cat = fam.has(r.v.c) ? 'structure' : 'hat decal';
      else if (o === 'shoes') cat = 'shoe detail';
      else if (o === 'top' && r.v.y >= 17) cat = 'collar';
      else if (!fam.has(r.v.c) || (o === 'top' && r.d[2] !== 0 && panel(r.v) && !PUFFY.test(id))) cat = 'print';
      else cat = PUFFY.test(id) ? 'puffer structure' : 'structure';
      const ex = relief - BUDGET[cat]; if (ex <= 0) continue;
      const h = hot.get(r.v.id); if (!h || h.ex < ex) hot.set(r.v.id, { v: r.v, cat, relief, ex, dir: r.d }); }
    if (hot.size) { const byCat = {}; for (const h of hot.values()) { const b = byCat[h.cat] ||= { n: 0, max: 0, relief: 0, front: 0, keys: [] }; b.n++; b.max = Math.max(b.max, h.ex); b.relief = Math.max(b.relief, h.relief); if (h.dir[2] === 1) b.front++; b.keys.push(h.v.k); }
      for (const [cat, b] of Object.entries(byCat)) out.push({ own: o, id, cat, budget: BUDGET[cat], ...b }); } }
  // the face grid (eyes, mouth): anything in front of the face plane (z 7) stands proud of it
  const fv = [...m.V.values()].filter(v => v.g === 'F' && v.z >= 8);
  if (fv.length && Math.max(...fv.map(v => v.z)) > 8) out.push({ own: 'face', id: m.L.mouth, cat: 'mouth piece', budget: 1, n: fv.length, max: Math.max(...fv.map(v => v.z - 8)), relief: Math.max(...fv.map(v => v.z - 7)), front: fv.length, keys: fv.map(v => v.k) });
  return out;
}
function colourFamily(vs) {   // the item's main colours (≥ 12 % of its voxels) and their shades: a pixel outside it is a print / logo / letter
  const h = new Map(); for (const v of vs) h.set(v.c, (h.get(v.c) || 0) + 1); const main = [...h].filter(([, n]) => n >= vs.length * .12).map(([c]) => c), fam = new Set(main);
  const hue = c => { const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b); return [mx, mx - mn, mx === mn ? 0 : mx === r ? ((g - b) / (mx - mn) + 6) % 6 : mx === g ? (b - r) / (mx - mn) + 2 : (r - g) / (mx - mn) + 4]; };
  for (const [c] of h) { if (fam.has(c)) continue; const [v1, s1, h1] = hue(c); for (const mc of main) { const [v2, s2, h2] = hue(mc); const dh = Math.min(Math.abs(h1 - h2), 6 - Math.abs(h1 - h2));
    if ((s1 < 25 && s2 < 25) || (dh < .35 && Math.abs(s1 / Math.max(1, v1) - s2 / Math.max(1, v2)) < .25)) { fam.add(c); break; } } }
  return fam; }

// ── 3 · layer conflicts
const COVER = new Set(['balaclava', 'skully', 'durag', 'beanie', 'silkrag', 'fuzzbucket', 'bandana', 'tiedana']);
const inEar = v => (v.x >= -10 && v.x <= -9 || v.x >= 8 && v.x <= 9) && v.y >= 23 && v.y <= 27 && v.z >= -1 && v.z <= 1;
export function layers(m) {
  const out = [], of = o => [...m.V.values()].filter(v => v.own === o);
  const hat = of('hat'), hair = of('hair'), ears = of('ears'), neck = of('neck');
  // hair × hat: hair outside the hat above its rim, or above / through its brim
  if (hat.length && hair.length) {
    const inBox = v => v.x >= -9 && v.x <= 8 && v.z >= -8 && v.z <= 8, crown = hat.filter(inBox), brim = hat.filter(v => !inBox(v) && v.y <= 33);
    const rim = crown.filter(v => v.x === -9 || v.x === 8 || v.z === -8 || v.z === 8), rimY = rim.length ? Math.min(...rim.map(v => v.y)) : Infinity;
    const bcol = new Map(); for (const v of brim) { const k = v.x + ',' + v.z, b = bcol.get(k); bcol.set(k, b ? [Math.min(b[0], v.y), Math.max(b[1], v.y)] : [v.y, v.y]); }
    const bx = brim.length ? [Math.min(...brim.map(v => v.x)), Math.max(...brim.map(v => v.x)), Math.min(...brim.map(v => v.z)), Math.max(...brim.map(v => v.z))] : null, bMin = brim.length ? Math.min(...brim.map(v => v.y)) : Infinity;
    const thru = [], out2 = [], top = []; const crownTop = crown.length ? Math.max(...crown.map(v => v.y)) : -Infinity;
    for (const v of hair) { if (!exposedDirs(m, v).length) continue;
      const b = bcol.get(v.x + ',' + v.z);
      if (b && v.y > b[1]) thru.push(v);   // above a brim voxel in the same column
      else if (bx && !inBox(v) && v.y >= bMin && v.x >= bx[0] && v.x <= bx[1] && v.z >= bx[2] && v.z <= bx[3]) thru.push(v);   // at brim level, inside the brim's reach
      else if (!inBox(v) && v.y >= rimY) out2.push(v);
      else if (inBox(v) && v.y > crownTop) top.push(v); }
    if (thru.length) out.push({ kind: 'hair through brim', n: thru.length, keys: thru.map(v => v.k) });
    if (out2.length) out.push({ kind: 'hair outside hat above its rim', n: out2.length, keys: out2.map(v => v.k) });
    if (top.length) out.push({ kind: 'hair through hat crown', n: top.length, keys: top.map(v => v.k) });
  }
  // ear slot: each piece must touch a visible ear
  if (ears.length && m.L.ears?.id !== 'phones') { const ks = new Set(ears.map(v => v.k))   // (headphones sit over hats and hair by design)
, seen = new Set(); const earVis = [...m.V.values()].some(v => v.own === 'base' && inEar(v) && exposedDirs(m, v).length);
    for (const e of ears) { if (seen.has(e.k)) continue; const q = [e.k], cc = []; seen.add(e.k); while (q.length) { const a = q.pop(); cc.push(a); for (const d of N26) { const b = add(a, d); if (ks.has(b) && !seen.has(b)) { seen.add(b); q.push(b); } } }
      const touch = new Set(); for (const k of cc) for (const d of N26) { const w = m.occ.get(add(k, d)); if (w) for (const v of w) if (v.own !== 'ears') touch.add(v.own === 'base' && inEar(v) ? 'ear' : v.own); }
      if (touch.has('ear')) continue;
      const kind = touch.size === 0 ? 'ear item floating' : touch.has('hat') ? 'ear item on a covering hat' : touch.has('hair') ? 'ear item on hair (ear hidden)' : 'ear item off the ear';
      out.push({ kind, n: cc.length, touch: [...touch], earVisible: earVis, keys: cc }); } }
  // necklace: crossing the top, standing off the neck, not wrapping
  if (neck.length) {
    const cross = m.over.filter(([s, o]) => s === 'neck' && (o === 'top' || o === 'hair')); if (cross.length) out.push({ kind: 'necklace cuts into the top', n: cross.length, keys: cross.map(c => +c[2].slice(1)) });
    const upper = neck.filter(v => v.y >= 16), zMin = upper.length ? Math.min(...upper.map(v => v.z)) : null;
    const wraps = neck.some(v => v.z <= 0 && Math.abs(v.x + .5) >= 1.5);
    if (zMin !== null && zMin - 0 > 2) out.push({ kind: 'necklace stands off the neck', n: upper.length, standoff: zMin, wraps, keys: upper.map(v => v.k) });
    if (!wraps) out.push({ kind: 'necklace is a front decal (no wrap)', n: neck.length, keys: [] });
  }
  // coincident voxels: the head grid and the body grid can hold the same cell (both are drawn: z-fight / poke-through)
  const co = {}; for (const [k, w] of m.occ) if (w.length > 1) { const os = [...new Set(w.map(v => v.own))].sort().join('∩'); if (w[0].own === w[1].own && w[0].own === 'base') continue; (co[os] ||= []).push(k); }
  for (const [os, ks] of Object.entries(co)) out.push({ kind: 'items share voxels', pair: os, n: ks.length, keys: ks });
  // overwrites: a later item wrote over an earlier one (expected: a hat over hair, hands, held over hands)
  const ow = {}; for (const [s, o, id] of m.over) { if (o === 'base' || o === 'face' || s === o || (s === 'hat' && o === 'hair') || (s === 'held' && o === 'hands')) continue; (ow[s + '→' + o] ||= []).push(+id.slice(1)); }
  for (const [p, ks] of Object.entries(ow)) out.push({ kind: 'item overwrites item', pair: p, n: ks.length, keys: ks });
  // covering hat with ear jewellery: flagged above; covering hat clipping the ears
  return out;
}

// ── 4 · joint seams (posed)
const mul = (T, p) => [T[0] * p[0] + T[1] * p[1] + T[2] * p[2] + T[9], T[3] * p[0] + T[4] * p[1] + T[5] * p[2] + T[10], T[6] * p[0] + T[7] * p[1] + T[8] * p[2] + T[11]];
const inv = (T, p) => { const q = [p[0] - T[9], p[1] - T[10], p[2] - T[11]]; return [T[0] * q[0] + T[3] * q[1] + T[6] * q[2], T[1] * q[0] + T[4] * q[1] + T[7] * q[2], T[2] * q[0] + T[5] * q[1] + T[8] * q[2]]; };
export function slabCells(m) {   // bake.js SLABS: child copies of the parent's voxels next to it
  const byPart = Array.from({ length: 13 }, () => new Map()); for (const v of m.V.values()) if (v.g !== 'H' && v.g !== 'F' || v.part === 5) byPart[v.part].set(v.k, v);
  const out = [];
  for (const E of SLABS) { const [ch, par, dirs, depth] = E, C = byPart[ch], add2 = new Map();
    for (const v of C.values()) if (slabRows(E, v.y)) for (const d of dirs) for (let s = 1; s <= depth; s++) { const kk = vk(v.x + d[0] * s, v.y + d[1] * s, v.z + d[2] * s); if (C.has(kk) || add2.has(kk)) continue;
      for (const p of par) { const e = byPart[p].get(kk); if (e && !slabSkips(E, e.own)) { add2.set(kk, { ...e, part: ch, from: p, slab: true }); break; } } }
    out.push(...add2.values()); }
  return out; }
const colDist = (a, b) => Math.max(Math.abs(((a >> 16) & 255) - ((b >> 16) & 255)), Math.abs(((a >> 8) & 255) - ((b >> 8) & 255)), Math.abs((a & 255) - (b & 255)));
export function seams(m, P, poseIdx, grip) {
  // boundary faces between segments (each once), with the owner on each side
  const faces = [];
  for (const v of m.V.values()) { if (v.g === 'H' || v.g === 'F') { if (v.y >= 19) continue; }   // the head's own faces above the neck belong to the head
    for (let i = 0; i < 6; i++) { const d = N6[i]; if (d[0] + d[1] + d[2] < 0) continue; const w = m.occ.get(vk(v.x + d[0], v.y + d[1], v.z + d[2])); if (!w) continue;
      for (const u of w) { if (u.part === v.part) continue; if ((v.part === 5) !== (u.part === 5) && (v.part === 5 ? v : u).y >= 19) continue;
        const exp = exposedDirs(m, v).length > 0 || exposedDirs(m, u).length > 0; if (!exp) continue;
        const joint = jointOf(v.part, u.part); if (!SKEL.has(joint)) continue;
        const cloth = v.own === u.own && !['base', 'hands', 'face'].includes(v.own);
        const tang = N6.filter(t => t[i >> 1 === 0 ? 0 : i >> 1 === 1 ? 1 : 2] === 0);
        const pat = v.c !== u.c || tang.some(t => { const a = m.occ.get(vk(v.x + t[0], v.y + t[1], v.z + t[2])); return a && a.some(x => x.part === v.part && x.own === v.own && colDist(x.c, v.c) > 40); });
        faces.push({ a: v, b: u, c: [v.x + .5 + d[0] * .5, v.y + .5 + d[1] * .5, v.z + .5 + d[2] * .5], cloth, pat, joint, slab: SLABPAIR.has(v.part * 16 + u.part) }); } } }
  const slabs = slabCells(m), byPart = Array.from({ length: 13 }, () => new Set()); for (const v of m.V.values()) byPart[v.part].add(v.k);
  const res = {};   // joint|owner → stats
  for (const pi of poseIdx) { const T = P.T[pi][grip];
    const per = {};
    for (const f of faces) { const p = f.c.map(x => x * S), A = mul(T[f.a.part], p), B = mul(T[f.b.part], p), sep = Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]) / S;
      const key = f.joint + '|' + (f.cloth ? f.a.own : 'skin/mixed'), r = per[key] ||= { faces: 0, split: 0, patBreak: 0, open: 0, sepSum: 0, sepMax: 0, keys: [] };
      r.faces++; r.sepSum += sep; r.sepMax = Math.max(r.sepMax, sep); if (sep >= .5) { r.split++; if (f.pat) r.patBreak++; if (r.keys.length < 400) r.keys.push(f.a.k, f.b.k); } if (sep >= 1 && !f.slab) r.open++; }
    // joint slabs showing: a slab voxel outside its parent, in a colour unlike the child's surface next to it
    for (const s of slabs) { const c = [(s.x + .5) * S, (s.y + .5) * S, (s.z + .5) * S], W = mul(T[s.part], c), q = inv(T[s.from], W).map(x => Math.floor(x / S));
      if (byPart[s.from].has(vk(q[0], q[1], q[2]))) continue;
      let near = null; for (const d of N6) { const w = m.occ.get(vk(s.x + d[0], s.y + d[1], s.z + d[2])); const u = w && w.find(x => x.part === s.part); if (u) { near = u; break; } }
      const key = jointOf(s.part, s.from) + '|slab|' + s.own, r = per[key] ||= { faces: 0, split: 0, patBreak: 0, open: 0, sepSum: 0, sepMax: 0, slabOut: 0, slabShow: 0, keys: [] };
      r.slabOut = (r.slabOut || 0) + 1; if (near && colDist(near.c, s.c) > 40) { r.slabShow = (r.slabShow || 0) + 1; if (r.keys.length < 400) r.keys.push(s.k); } }
    for (const [k, r] of Object.entries(per)) { const R = res[k] ||= { faces: r.faces, worst: null, split: 0, patBreak: 0, open: 0, sepMean: 0, sepMax: 0, slabShow: 0, slabOut: 0 };
      const score = r.split + r.patBreak + r.open + (r.slabShow || 0);
      if (!R.worst || score > R.score) Object.assign(R, { worst: P.poses[pi].name, score, split: r.split, patBreak: r.patBreak, open: r.open, sepMean: r.faces ? r.sepSum / r.faces : 0, sepMax: r.sepMax, slabShow: r.slabShow || 0, slabOut: r.slabOut || 0, keys: r.keys, pose: pi }); } }
  // cut-edge raggedness: per garment and joint, how many planes the cut lies in, and its outline against a disc of the same area
  const cut = {}; for (const f of faces) { if (!f.cloth) continue; const key = f.joint + '|' + f.a.own, c = cut[key] ||= { n: 0, axes: new Set(), set: new Set() };
    c.n++; const ax = f.c.findIndex(x => Math.abs(x - Math.round(x)) < 1e-6); c.axes.add(ax); c.set.add(f.c.join(',')); }
  for (const [key, c] of Object.entries(cut)) { let per = 0; for (const s of c.set) { const p = s.split(',').map(Number), ax = p.findIndex(x => Math.abs(x - Math.round(x)) < 1e-6);
      for (const t of [0, 1, 2]) if (t !== ax) for (const sg of [-1, 1]) { const q = p.slice(); q[t] += sg; if (!c.set.has(q.join(','))) per++; } }
    const R = res[key] ||= { faces: c.n }; R.planes = c.axes.size; R.ragged = +(per / (2 * Math.sqrt(Math.PI * c.set.size))).toFixed(2); }
  return res;
}

// ── 5 · odd bits: stray single voxels, one-sided glitches, colour speckle
export function oddBits(m) {
  const out = [], byOwn = new Map(); for (const v of m.V.values()) { if (['base', 'face', 'hands', 'held', 'acc', 'mark'].includes(v.own)) continue; (byOwn.get(v.own) || byOwn.set(v.own, []).get(v.own)).push(v); }
  for (const [o, vs] of byOwn) {
    const stray = vs.filter(v => { let n = 0; for (const d of N6) if (m.occ.has(vk(v.x + d[0], v.y + d[1], v.z + d[2]))) n++; return n <= 1; });
    if (stray.length && o !== 'hair') out.push({ kind: 'stray voxel', own: o, n: stray.length, keys: stray.map(v => v.k) });
    const occ = new Set(vs.map(v => v.k)), mis = vs.filter(v => !occ.has(vk(-1 - v.x, v.y, v.z)));
    if (mis.length && mis.length <= vs.length * .06) out.push({ kind: 'one-sided glitch', own: o, n: mis.length, of: vs.length, keys: mis.map(v => v.k) });
    const col = new Map(vs.map(v => [v.k, v.c])); let sp = [];
    for (const v of vs) { if (!exposedDirs(m, v).length) continue; const ns = N6.map(d => col.get(vk(v.x + d[0], v.y + d[1], v.z + d[2]))).filter(c => c !== undefined);
      if (ns.length >= 3 && ns.every(c => c === ns[0]) && colDist(ns[0], v.c) > 60) sp.push(v); }
    const expN = vs.filter(v => exposedDirs(m, v).length).length;
    if (sp.length && sp.length <= Math.max(2, expN * .03)) out.push({ kind: 'colour speckle', own: o, n: sp.length, of: expN, keys: sp.map(v => v.k) });
  }
  return out;
}
