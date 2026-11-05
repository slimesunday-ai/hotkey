// AI City · HOME LIFE's pure half (C2-indoors, 2026-10-31: moved out of life.js verbatim, so interiors/city/plan.js and a node check
// read the same spots and the same walking grid life.js's resident uses): the activity spots a layout offers (spotsOf), the homes
// check's walking grid (gridOf, gridCells) and the way across it (snap, sight, clear, astar). No three, no DOM.
import * as HO from '../home/index.js';
import { makeRules, rectOf, C4 } from '../home/rules.js';
import { IDLE } from '../../anim/cast/idle.js';

export const RULES = makeRules(HO);
export const FR = [[0, 1], [1, 0], [0, -1], [-1, 0]];   // a piece's front for its quarter turn (room.js / vox.js stamp: rot 90 faces +x)
export const yawOf = (dx, dz) => Math.atan2(dx, dz);   // the walker faces +z at yaw 0
// a point in a piece's own frame (u across its foot[0], v deep toward its front; metres) → room metres, for a piece at X, Z turned r
export const toRoom = (F, u, v) => { const { X, Z, w, d, r } = F; return r === 0 ? [X + u, Z + v] : r === 1 ? [X + v, Z + w - u] : r === 2 ? [X + w - u, Z + d - v] : [X + d - v, Z + u]; };
export const dirRoom = (r, du, dv) => r === 0 ? [du, dv] : r === 1 ? [dv, -du] : r === 2 ? [-du, -dv] : [-dv, du];
export const lerp = (a, b, t) => a + (b - a) * t;

// ── the activities: how each is done (stand: the walker's idle · sit, lie: the rig on the piece · work: the rig standing, arms busy), how
// long (s), what it gives (needs, 0–1), its bubbles (glyph: pixel icons, bubbles.js; nglyph: at night; think: two-icon thoughts), when
// (night: only then; day: never at night) and what it leads to
export const ACTS = {
  sleep:  { pose: 'lie', dur: [45, 70], give: {}, glyph: [], when: 'night' },
  cook:   { pose: 'work', dur: [9, 13], give: { hunger: .35 }, adv: { hunger: 1 }, glyph: ['pot'], think: [['pot', 'burger'], ['pot', 'slice']], next: 'eat', when: 'day' },   // (adv: what it promises, the meal it leads to)
  eat:    { pose: 'sit', dur: [10, 14], give: { hunger: .65 }, glyph: ['burger', 'slice'], when: 'day' },
  fridge: { pose: 'stand', idle: IDLE.look, dur: [3.5, 5], give: { hunger: .25 }, glyph: ['soda', 'takeout'], nglyph: ['slice', 'takeout'] },
  toilet: { pose: 'sit', dur: [6, 9], give: { bladder: 1 }, glyph: ['phone'], next: 'wash' },
  wash:   { pose: 'work', dur: [3, 4.5], give: { hygiene: .6 }, glyph: ['drops'] },
  tv:     { pose: 'sit', dur: [16, 24], give: { fun: .5 }, glyph: ['tv'], think: [['tv', 'sneaker']], when: 'day' },   // (a drop on TV)
  chill:  { pose: 'sit', dur: [10, 15], give: { fun: .3 }, glyph: ['phone', 'notes'], think: [['phone', 'cash']], when: 'day' },
  game:   { pose: 'sit', dur: [14, 20], give: { fun: .75 }, glyph: ['pad'], think: [['pad', 'trophy']], when: 'day' },
  arcade: { pose: 'work', dur: [10, 15], give: { fun: .7 }, glyph: ['invader'], think: [['invader', 'crown']], when: 'day' },
  music:  { pose: 'stand', idle: IDLE.music, dur: [8, 12], give: { fun: .45 }, glyph: ['notes', 'boombox'], when: 'day' },
  trophy: { pose: 'stand', idle: IDLE.crossed, dur: [6, 9], give: { pride: .8 }, glyph: ['trophy'], think: [['trophy', 'crown']], when: 'day' },
  admire: { pose: 'stand', idle: IDLE.crossed, dur: [5, 8], give: { pride: .5, fun: .1 }, glyph: ['glint'], when: 'day' },
  car:    { pose: 'stand', idle: IDLE.hips, dur: [6, 9], give: { pride: .6 }, glyph: ['keys', 'whip'], think: [['whip', 'crown']], when: 'day' },
  stash:  { pose: 'stand', idle: IDLE.look, dur: [5, 7], give: { money: 1 }, glyph: ['cash', 'lock', 'cash'], think: [['cash', 'sneaker'], ['cash', 'whip'], ['cash', 'chain']], when: 'day' },
  dress:  { pose: 'stand', idle: IDLE.shift, dur: [4, 6], give: { pride: .3, hygiene: .2 }, glyph: ['sneaker', 'cap', 'chain'], think: [['sneaker', 'cash']], when: 'day' },   // (flip a pair)
  read:   { pose: 'stand', idle: IDLE.shift, dur: [6, 9], give: { fun: .3 }, glyph: ['book', 'map'], think: [['map', 'cash'], ['book', 'bulb']], when: 'day' },
  plant:  { pose: 'stand', idle: IDLE.shift, dur: [4, 6], give: { fun: .15, pride: .1 }, glyph: ['wcan'], when: 'day' },
  lift:   { pose: 'work', dur: [10, 14], give: { pride: .4, fun: .3 }, glyph: ['dumbbell'], when: 'day' },
  wander: { pose: 'stand', idle: IDLE.phone, dur: [5, 8], give: { fun: .12 }, glyph: ['burner'], nglyph: ['bulb', 'map'], think: [['burner', 'cash'], ['burner', 'duffel']], when: 'day' },
};
export const COLLECT_ART = new Set(['photos-family']);   // base art worth a look (collectible art always is)

// what a catalogue piece offers (categories first, so a new piece of a known kind just works)
export function actsOf(o) {
  const t = new Set(o.tags ?? []), id = o.id, L = [];
  if (o.cat === 'beds') L.push('sleep');
  if (id === 'toilet') return ['toilet'];
  if (id === 'sink-bath') L.push('wash');
  if (id === 'stove' || id === 'cook-rig' || id === 'hot-plate' || (o.cat === 'kitchen' && t.has('cook'))) L.push('cook');
  if (id === 'fridge') L.push('fridge');
  if (o.cat === 'tables' && o.seat) L.push('eat');
  if (o.cat === 'seating') L.push('seat');   // (resolved per seat: tv · game · chill; a bar stool eats when there's no table)
  if (id === 'arcade-cab') L.push('arcade');
  if (o.cat === 'music') L.push('music');
  if (o.cat === 'trophies' || o.game?.kind === 'trophy') L.push('trophy');
  else if (o.cat === 'collectibles' || (o.cat === 'wall' && o.game?.kind === 'collectible') || COLLECT_ART.has(id) || id === 'plinth' || id === 'fish-tank') L.push('admire');
  if (o.cat === 'stash' || o.sim === 'stash' || o.sim === 'safe') L.push('stash');
  if (['dresser', 'wardrobe', 'mirror-lean', 'streetwear-rack'].includes(id)) L.push('dress');
  if (id === 'bookshelf') L.push('read');
  if (o.cat === 'plants' && o.place === 'floor') L.push('plant');
  if (t.has('weights') || t.has('gym')) L.push('lift');
  return L;
}
export const isTV = o => (o.cat === 'electronics' && (o.tags ?? []).includes('tv')) || o.id === 'gaming-setup';
// a seat's places in its own frame: [u, v, facing (local, rad: 0 = the piece's front)] (metres), and its seat height
export function seatsOf(o) {
  const w = o.foot[0] * C4, d = o.foot[1] * C4;
  if (o.id === 'dining-set') return [[.2, .75, Math.PI / 2], [1.8, .75, -Math.PI / 2], [1, .2, 0], [1, 1.3, Math.PI]];   // (extras.js: its four chairs)
  if (o.id === 'toilet') return [[w / 2, .3, 0]];
  if (o.id === 'beanbag') return [[w / 2, d * .5, 0]];
  if (o.id === 'stool-bar') return [[w / 2, d / 2, 0]];
  if (w >= 1.6) return [[w * .3, d * .44, 0], [w * .7, d * .44, 0]];   // a sofa: two places
  return [[w / 2, d * .45, 0]];
}

// ── the frames: where a piece stands in the room (the box in room metres, its front, a frame for toRoom)
export function frameOf(it, o, A, room) {
  const { W, ox } = room;
  if (it.on && it.on.wall) { const a = it.x * C4, len = o.foot[0] * C4;
    return it.on.wall === 'N' ? { X: ox + a, Z: 0, w: len, d: .1, r: 0, box: [ox + a, 0, ox + a + len, .1], wall: 'N' } : { X: W - .1, Z: a, w: len, d: .1, r: 3, box: [W - .1, a, W, a + len], wall: 'E' }; }
  if (it.on === 'ceiling') return null;
  if (it.on && it.on.top !== undefined) { const P = A.items[it.on.top], po = P && HO.byId.get(P.id); if (!po) return null;
    const pf = frameOf(P, po, A, room), rc = rectOf(it.x, it.z, o.foot, it.rot); if (!pf) return null;
    return { ...pf, own: [ox + rc[0] * C4, rc[1] * C4, ox + (rc[0] + rc[2]) * C4, (rc[1] + rc[3]) * C4] }; }
  const r = ((it.rot ?? 0) / 90) & 3, rc = rectOf(it.x, it.z, o.foot, it.rot);
  return { X: ox + it.x * C4, Z: it.z * C4, w: o.foot[0] * C4, d: o.foot[1] * C4, r, box: [ox + rc[0] * C4, rc[1] * C4, ox + (rc[0] + rc[2]) * C4, (rc[1] + rc[3]) * C4] };
}
// in front of a piece, `gap` m out from its front face, level with its centre (a surface piece: its own centre on its parent's front)
export function frontOf(F, gap) { const b = F.box, o = F.own ?? b, cx = (o[0] + o[2]) / 2, cz = (o[1] + o[3]) / 2, [fx, fz] = FR[F.r];
  return fx > 0 ? [b[2] + gap, cz] : fx < 0 ? [b[0] - gap, cz] : fz > 0 ? [cx, b[3] + gap] : [cx, b[1] - gap]; }

// ── THE SPOTS (pure: no three, no DOM): every activity the layout offers, with its raw targets (the grid snaps them)
//   → [{ act, key, pose, at: [x, z] (stand here), face: [x, z] (look at this), seat?: { x, z, y, yaw }, bed?: {...}, alt?: [[x, z], …] }]
export function spotsOf(A, fills, room) {
  const out = [], seen = new Map(), pieces = [];
  const keyOf = id => { const n = seen.get(id) ?? 0; seen.set(id, n + 1); return id + '#' + n; };
  A.items.forEach(it => { const o = HO.byId.get(it.id); if (o) pieces.push({ it, o, key: keyOf(it.id) }); });
  (A.slots ?? []).forEach((s, i) => { const f = fills?.[i], o = f ? HO.byId.get(f.id) : s.fits?.includes('stash') ? HO.byId.get(s.demo) : null; if (!o) return;   // (the stash slot: the stash is there, shown or not)
    const [sw, sd] = s.foot, [ow, od] = o.foot, dx = s.place === 'wall' || s.place === 'floor' || s.place === 'surface' ? Math.max(0, Math.floor((sw - ow) / 2)) : 0, dz = s.place === 'floor' || s.place === 'surface' ? Math.max(0, Math.floor((sd - od) / 2)) : 0;
    pieces.push({ it: { x: s.x + dx, z: s.z + dz, rot: s.rot, y: s.y, on: s.place === 'wall' ? { wall: s.wall } : s.place === 'surface' ? { top: s.on } : s.place === 'ceiling' ? 'ceiling' : 'floor' }, o, key: 'slot' + i + ':' + (f?.id ?? o.id) }); });
  for (const p of pieces) p.F = frameOf(p.it, p.o, A, room);
  const tvs = pieces.filter(p => p.F && isTV(p.o)), consoles = pieces.some(p => p.o.cat === 'gaming'), table = pieces.some(p => p.o.cat === 'tables' && p.o.seat);
  for (const p of pieces) { const { o, F, key } = p; if (!F) continue;
    for (const act of actsOf(o)) {
      if (act === 'sleep') { const w = F.w, d = F.d, top = o.seat ?? Math.min(.55, o.h * .55), [x, z] = toRoom(F, w / 2, d - .1), [fx, fz] = dirRoom(F.r, 0, 1);
        out.push({ act, key, pose: 'lie', own: F.box, bed: { x, z, y: top + .12, yaw: yawOf(fx, fz), w }, at: toRoom(F, -.4, d * .55), alt: [toRoom(F, w + .4, d * .55), toRoom(F, w / 2, d + .4)], face: toRoom(F, w / 2, d * .55) }); continue; }
      if (act === 'eat' || act === 'seat' || act === 'toilet') { const d = F.d, top = o.seat ?? .45;
        seatsOf(o).forEach(([u, v, lf], si) => { const [x, z] = toRoom(F, u, v), [lx, lz] = [Math.sin(lf), Math.cos(lf)], [fx, fz] = dirRoom(F.r, lx, lz), yaw = yawOf(fx, fz);
          const back = o.id === 'dining-set' ? -.55 : (lf === 0 ? d - v + .32 : .5), at = o.id === 'dining-set' ? [x + fx * back, z + fz * back] : toRoom(F, u, d + .32);
          let a = act; if (act === 'seat') { const tv = tvs.find(q => { const b = q.F.own ?? q.F.box, cx = (b[0] + b[2]) / 2, cz = (b[1] + b[3]) / 2, dx = cx - x, dz = cz - z, L = Math.hypot(dx, dz);
            return L < 7 && L > .8 && (dx * fx + dz * fz) / L > .55; }); a = o.id === 'stool-bar' ? (table ? 'chill' : 'eat') : tv ? 'tv' : 'chill';
            if (a === 'tv' && consoles) out.push({ act: 'game', key: key + '/' + si, pose: 'sit', own: F.box, seat: { x, z, y: top, yaw }, at, face: [x + fx, z + fz] }); }
          out.push({ act: a, key: key + '/' + si, pose: 'sit', own: F.box, seat: { x, z, y: top, yaw }, at, face: [x + fx, z + fz] }); });
        continue; }
      const def = ACTS[act]; if (!def) continue;
      const gap = act === 'cook' || act === 'wash' || act === 'arcade' ? .36 : act === 'trophy' || act === 'admire' ? .62 : .45, at = frontOf(F, gap), b = F.own ?? F.box;
      out.push({ act, key, pose: def.pose, own: F.box, at, face: [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2], work: act }); } }
  // the house's car (room.built kind 'car'): admire it from beside the bay
  (A.room.built ?? []).forEach((b, i) => { if (b.kind !== 'car') return; const x0 = room.ox + b.x * C4, x1 = x0 + b.w * C4, z0 = b.z * C4, z1 = z0 + b.d * C4, zm = lerp(z0, z1, .62);
    out.push({ act: 'car', key: 'built' + i, pose: 'stand', own: [x0, z0, x1, z1], at: [x1 + .4, zm], alt: [[x0 - .4, zm], [(x0 + x1) / 2, z1 + .45]], face: [(x0 + x1) / 2, zm] }); });
  return out;
}

// ── THE GRID: the homes check's own solids (home/rules.js geometry) on the 0.25 m cells; the walker is 2 × 2 cells (its node: the
// min corner; its centre the cells' shared corner). A* with an octile heuristic, dearer next to anything solid; string-pulled.
export function gridOf(A, fills) {
  const R = A.room, RW = R.w, RD = R.d, g = RULES.geometry(A), blocked = new Uint8Array(RW * RD), built = new Uint8Array(RW * RD), at = (x, z) => x >= 0 && z >= 0 && x < RW && z < RD;
  for (const p of g.solid) for (const [x, z, over] of p.cells) if (!over && at(x, z)) { blocked[x + z * RW] = 1; if (p.built) built[x + z * RW] = 1; }
  for (const q of g.floorSlots) if (fills?.[q.i]) for (let x = q.rc[0]; x < q.rc[0] + q.rc[2]; x++) for (let z = q.rc[1]; z < q.rc[1] + q.rc[3]; z++) if (at(x, z)) blocked[x + z * RW] = 1;
  return gridCells(RW, RD, blocked, built);
}
// (C2-indoors: the grid from any blocked / built cells, so interiors/city/plan.js walks a record home's whole room the same way)
export function gridCells(RW, RD, blocked, built) {
  const at = (x, z) => x >= 0 && z >= 0 && x < RW && z < RD, B = (x, z) => !at(x, z) || blocked[x + z * RW];
  const free = new Uint8Array(RW * RD), near = new Uint8Array(RW * RD);
  for (let z = 0; z + 1 < RD; z++) for (let x = 0; x + 1 < RW; x++) { if (B(x, z) || B(x + 1, z) || B(x, z + 1) || B(x + 1, z + 1)) continue; free[x + z * RW] = 1;
    let n = 0; for (let a = -1; a <= 2 && !n; a++) for (let b = -1; b <= 2; b++) if ((a < 0 || a > 1 || b < 0 || b > 1) && at(x + a, z + b) && blocked[x + a + (z + b) * RW]) { n = 1; break; } near[x + z * RW] = n; }
  // connected regions (the house is the biggest; a closet nobody can reach is left out)
  const comp = new Int32Array(RW * RD).fill(-1), sizes = []; const Q = new Int32Array(RW * RD);
  for (let s = 0; s < RW * RD; s++) { if (!free[s] || comp[s] >= 0) continue; const c = sizes.length; let h = 0, t = 0; Q[t++] = s; comp[s] = c; let n = 0;
    while (h < t) { const k = Q[h++], x = k % RW, z = (k / RW) | 0; n++; for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx, Z = z + dz, j = X + Z * RW; if (X >= 0 && Z >= 0 && X < RW && Z < RD && free[j] && comp[j] < 0) { comp[j] = c; Q[t++] = j; } } }
    sizes.push(n); }
  const main = sizes.indexOf(Math.max(-1, ...sizes));
  return { RW, RD, blocked, built, free, near, comp, main, B };
}
export const nodeXZ = (k, RW) => [((k % RW) + 1) * C4, (((k / RW) | 0) + 1) * C4];
// the nearest free node of the house to a point (within r m), or -1. see: { to: [x, z], own: [x0, z0, x1, z1] (m), any }: the line from
// the node to `to` crosses no wall or car bay (any: and no other solid piece; own: the piece's own cells don't count): a seat is never
// reached through a partition, a chair never through the table's neighbour
export function snap(G, x, z, r = .8, comp = G.main, see = null) { let best = -1, bd = 1e9; const cx = Math.round(x / C4) - 1, cz = Math.round(z / C4) - 1, R = Math.ceil(r / C4);
  for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) { const X = cx + dx, Z = cz + dz; if (X < 0 || Z < 0 || X >= G.RW || Z >= G.RD) continue; const k = X + Z * G.RW; if (!G.free[k] || (comp >= 0 && G.comp[k] !== comp)) continue;
    const [nx, nz] = nodeXZ(k, G.RW), d = Math.hypot(nx - x, nz - z) + G.near[k] * .08; if (d < bd && d <= r + .2 && (!see || sight(G, [nx, nz], see))) { bd = d; best = k; } }
  return best; }
export function sight(G, a, { to, own, any }) { const b = to, L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / .06));
  for (let i = 0; i <= n; i++) { const t = i / n, x = lerp(a[0], b[0], t), z = lerp(a[1], b[1], t), cx = Math.floor(x / C4), cz = Math.floor(z / C4);
    if (cx < 0 || cz < 0 || cx >= G.RW || cz >= G.RD) continue; if (own && x > own[0] + .01 && x < own[2] - .01 && z > own[1] + .01 && z < own[3] - .01) continue;
    const k = cx + cz * G.RW; if (G.built[k] || (any && G.blocked[k])) return false; }
  return true; }
// is the walker's disc clear all along a segment?
export function clear(G, a, b) { const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / .08));
  for (let i = 0; i <= n; i++) { const t = i / n, x = lerp(a[0], b[0], t), z = lerp(a[1], b[1], t);
    for (let cz = Math.floor((z - .24) / C4); cz <= Math.floor((z + .24) / C4); cz++) for (let cx = Math.floor((x - .24) / C4); cx <= Math.floor((x + .24) / C4); cx++) if (G.B(cx, cz)) return false; }
  return true; }
export function astar(G, s, t) {
  const { RW, free, near } = G, N = free.length, gS = new Float32Array(N).fill(Infinity), from = new Int32Array(N).fill(-1), shut = new Uint8Array(N), heap = [];
  const [tx, tz] = [t % RW, (t / RW) | 0], h = k => { const dx = Math.abs(k % RW - tx), dz = Math.abs(((k / RW) | 0) - tz); return Math.max(dx, dz) + .414 * Math.min(dx, dz); };
  const push = (k, f) => { heap.push([f, k]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  gS[s] = 0; push(s, h(s));
  while (heap.length) { const [, k] = pop(); if (shut[k]) continue; if (k === t) break; shut[k] = 1; const x = k % RW, z = (k / RW) | 0;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dz) continue; const X = x + dx, Z = z + dz; if (X < 0 || Z < 0 || X >= RW || Z >= G.RD) continue; const j = X + Z * RW; if (!free[j] || shut[j]) continue;
      if (dx && dz && (!free[x + dx + z * RW] || !free[x + (z + dz) * RW])) continue;   // (no corner cutting)
      const c = gS[k] + (dx && dz ? 1.414 : 1) + near[j] * .7; if (c < gS[j]) { gS[j] = c; from[j] = k; push(j, c + h(j)); } } }
  if (s !== t && from[t] < 0) return null;
  const path = []; for (let k = t; k >= 0; k = k === s ? -1 : from[k]) path.push(nodeXZ(k, RW)); path.reverse();
  // string-pull: the farthest node still in a clear line
  const out = [path[0]]; let i = 0; while (i < path.length - 1) { let j = path.length - 1; while (j > i + 1 && !clear(G, path[i], path[j])) j--; out.push(path[j]); i = j; }
  return out;
}


