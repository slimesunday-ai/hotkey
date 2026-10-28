// AI City · home layouts · THE RULES (home builder, 2026-10-06): the homes check's rules as a pure module (no node, no DOM, no three), so
// the check (check.mjs, the CLI) and the home builder's live validity test (interiors/city/builder.js) read ONE set of rules. Moved here
// verbatim from check.mjs (2026-10-05); check.mjs keeps the CLI, the --map plans and the per-tier vacant comparison.
//   makeRules({ byId, OBJECTS, CATS }) → { geometry, tierCheck, simSpots, vacantCheck, check }
//     geometry(A, mode)    one item list ('items' with its slots, or 'vacant'): overlaps, support, walls, the door and its swing, the walk path
//     tierCheck(A, g)      the tier's basics, the dressing minimums, the slots, and simSpots
//     simSpots(A, g, err)  room.js spot() must still find free floor for the tier's safe and a dog bed (the builder runs it per candidate)
//     check(A, tierSets?)  one layout, owned and vacant → { E, W, g, v } (exactly what check.mjs prints for it)
//   rectOf, cellOf, inside, hit, span, fitsSlot, C4, KINDS, FIXTURE …   the footprint helpers
export const C4 = .25, KINDS = ['base', 'gear', 'collectible', 'trophy'];
export const CLUTTER_OK = new Set(['pizza-boxes', 'laundry-pile', 'sneakers-kicked', 'box-fan', 'beer-cans', 'boxes-moving', 'paint-kit']);   // floor clutter that tells a story

// a piece's rotated footprint in room cells: [x, z, w, d] (x, z = the min corner, as room.js places it)
export const rectOf = (x, z, foot, rot) => { const r = ((rot ?? 0) / 90) & 3, [w, d] = r & 1 ? [foot[1], foot[0]] : foot; return [x, z, w, d]; };
// one object-frame cell (u across, v deep) → its room cell, for a piece at (x, z) turned r quarter turns (vox.js stamp)
export function cellOf(x, z, foot, rot, u, v) { const r = ((rot ?? 0) / 90) & 3, [w, d] = foot;
  return [[x + u, z + v], [x + v, z + w - 1 - u], [x + w - 1 - u, z + d - 1 - v], [x + d - 1 - v, z + u]][r]; }
export const inside = (a, b) => a[0] >= b[0] && a[1] >= b[1] && a[0] + a[2] <= b[0] + b[2] && a[1] + a[3] <= b[1] + b[3];
export const hit = (a, b) => a[0] < b[0] + b[2] && a[0] + a[2] > b[0] && a[1] < b[1] + b[3] && a[1] + a[3] > b[1];
export const span = (a0, a1, b0, b1) => a0 < b1 && a1 > b0;

// ── the tier and the sim (on top of the geometry)
export const BEDS = { trailer: ['mattress-floor', 'bed-double'], apartment: ['mattress-floor', 'bed-double'], house: ['bed-double'], penthouse: ['bed-platform'], mainland: ['bed-double', 'bed-platform'] };
export const SAFE = { trailer: 'safe-small', apartment: 'safe-small', house: 'safe-floor', penthouse: 'safe-floor', mainland: 'safe-floor' };   // room.js: the safe it places for sec 'safe'
// MAINLAND (2026-10-06): the collectors' neighbourhood's own tier, one layout per house style (assemblies/mainland-<style>.json). Its pieces
// come from the house and penthouse catalogues (CATALOGUE); it marks more slots (display walls, the trophy shelf, the garage or den),
// dresses richer, and is never vacant (a built Mainland house is always somebody's)
export const CATALOGUE = { mainland: ['house', 'penthouse'] };   // a tier with no catalogue of its own draws on these tiers' pieces
export const SLOTN = { mainland: [3, 6] };                        // slots a layout marks (every other tier: 2–4)
// the dressing minimums: rugs · wall art (wall pieces and wall lights, not the door, windows or panelling) · lived-in pieces (decor,
// plants, lights, clutter, music, the ceiling fan): the jump from trailer to penthouse is in the count as much as in the pieces
export const DRESS = { trailer: { rugs: 1, art: 1, lived: 4 }, apartment: { rugs: 1, art: 2, lived: 5 }, house: { rugs: 2, art: 2, lived: 6 }, penthouse: { rugs: 2, art: 1, lived: 7 }, mainland: { rugs: 3, art: 3, lived: 9 } };
export const FIXTURE = new Set(['door-front', 'window', 'ac-window', 'radiator', 'wall-panelling']);
export const VACANT_OK = new Set(['beds', 'kitchen', 'bath', 'clutter', 'decor', 'wall', 'electronics', 'lights']);   // what an empty unit may hold: no seats, no tables
// a catalogue piece fits a slot when its kind or its category is listed, it has the slot's placement, and its footprint is no bigger
export const fitsSlot = (o, s) => (s.fits.includes(o.game?.kind) || s.fits.includes(o.cat)) && o.place === s.place && o.foot[0] <= s.foot[0] && o.foot[1] <= s.foot[1];


export function makeRules({ byId, OBJECTS, CATS }) {
// ── geometry (layout-check.mjs, 2026-09-29): one item list — the owned layout's `items` with its slots, or the `vacant` set alone
function geometry(A, mode = 'items') {
  const LIST = mode === 'vacant' ? A.vacant : A.items, SLOTS = mode === 'vacant' ? [] : A.slots, E = [], W = [], R = A.room, H = R.h ?? 2.8;
  const err = s => E.push(s), warn = s => W.push(s), len = side => side === 'N' ? R.w : R.d;
  const solid = [], floorSlots = [], wallPieces = [], tops = new Map();   // solid floor pieces · floor slots · everything on a wall · what sits on each surface
  let beds = 0, door = null;
  LIST.forEach((it, k) => {
    const o = byId.get(it.id), tag = `#${k} ${it.id}`; if (!o) return err(`${tag}: not in the catalogue`);
    if (o.game?.kind && o.game.kind !== 'base') err(`${tag}: a ${o.game.kind} piece in the base layout (stakes items come through slots)`);
    if (o.cat === 'beds' || it.id === 'futon') beds++;   // (a futon folds out: somewhere to sleep, brief §8)
    const on = it.on;
    if (on && on.wall) { if (o.place !== 'wall') err(`${tag}: a ${o.place} piece hung on a wall`);
      const y0 = it.y ?? o.mount, y1 = y0 + o.foot[1] * C4, a0 = it.x, a1 = it.x + o.foot[0];
      if (a0 < 0 || a1 > len(on.wall)) err(`${tag}: runs off the ${on.wall} wall (${a0}–${a1} of ${len(on.wall)})`);
      if (y1 > H + 1e-6) err(`${tag}: pokes through the ceiling (top ${y1.toFixed(2)} m)`);
      if (it.id === 'door-front') door = { side: on.wall, a: it.x };
      wallPieces.push({ k, id: it.id, side: on.wall, a0, a1, y0, y1, o }); return; }
    if (on === 'ceiling') { if (o.place !== 'ceiling') err(`${tag}: a ${o.place} piece on the ceiling`); return; }
    const rc = rectOf(it.x, it.z, o.foot, it.rot);
    if (on && on.top !== undefined) { const P = LIST[on.top], po = P && byId.get(P.id);
      if (!po || !po.tops?.length) return err(`${tag}: on #${on.top}, which has no top`);
      if (o.place !== 'surface') warn(`${tag}: a ${o.place} piece stacked on #${on.top} ${P.id}`);
      const pr = rectOf(P.x, P.z, po.foot, P.rot); if (!inside(rc, pr)) err(`${tag}: hangs off #${on.top} ${P.id} (${rc} vs ${pr})`);
      if (po.tops[0] + o.h > H) err(`${tag}: on #${on.top} it pokes through the ceiling`);
      for (const q of tops.get(on.top) ?? []) if (hit(q.rc, rc)) err(`${tag}: collides with #${q.k} ${q.id} on #${on.top}`);
      (tops.get(on.top) ?? tops.set(on.top, []).get(on.top)).push({ k, id: it.id, rc, h: o.h }); return; }
    if (o.place === 'surface') err(`${tag}: a surface piece loose on the floor`);
    if (rc[0] < 0 || rc[1] < 0 || rc[0] + rc[2] > R.w || rc[1] + rc[3] > R.d) err(`${tag}: off the floor (${rc} in ${R.w}×${R.d})`);
    if (o.cat === 'rugs') return;
    if (o.cat === 'clutter' && !CLUTTER_OK.has(it.id)) warn(`${tag}: loose clutter`);
    // the arc lamp stands on its base (the first 2 × 2 cells); the arm and dome overhang anything under ~1.3 m
    const cells = []; for (let u = 0; u < o.foot[0]; u++) for (let v = 0; v < o.foot[1]; v++) { const low = it.id === 'lamp-arc' && u >= 2; cells.push([...cellOf(it.x, it.z, o.foot, it.rot, u, v), low]); }
    solid.push({ k, id: it.id, o, rc, cells, h: o.h });
  });
  // ── the house's built-ins (room.built, MAINLAND 2026-10-06): partition walls and the garage's car bay are part of the building, solid
  // floor that nothing stands on and no one walks through (room.js draws them; the builder never picks them up, CLEAR ROOM never clears them)
  if (mode !== 'vacant') (R.built ?? []).forEach((b, i) => { const rc = [b.x, b.z, b.w, b.d], tag = `built ${i} (${b.kind})`;
    if (!['wall', 'car'].includes(b.kind)) err(`${tag}: unknown kind`);
    if (rc[0] < 0 || rc[1] < 0 || rc[0] + rc[2] > R.w || rc[1] + rc[3] > R.d || rc[2] < 1 || rc[3] < 1) err(`${tag}: off the floor (${rc} in ${R.w}×${R.d})`);
    const cells = []; for (let x = b.x; x < b.x + b.w; x++) for (let z = b.z; z < b.z + b.d; z++) cells.push([x, z, false]);
    solid.push({ k: 'built' + i, id: 'built-' + b.kind, o: { id: 'built-' + b.kind, cat: 'built', tops: [], h: b.kind === 'wall' ? H : 1.5, foot: [b.w, b.d] }, rc, cells, h: b.kind === 'wall' ? H : 1.5, built: true }); });
  // ── floor pieces against each other
  const grid = new Map(); for (const p of solid) for (const [x, z, over] of p.cells) { const key = x + ',' + z, q = grid.get(key);
    if (q && !(over && q.h < 1.3) && !(q.over && p.h < 1.3)) err(`#${p.k} ${p.id} overlaps #${q.k} ${q.id} at ${key}`); if (!q || !over) grid.set(key, { k: p.k, id: p.id, h: p.h, over }); }
  // ── walls: pieces overlapping on a wall, art hidden behind furniture, windows and doors blocked
  for (let i = 0; i < wallPieces.length; i++) for (let j = i + 1; j < wallPieces.length; j++) { const a = wallPieces[i], b = wallPieces[j];
    if (a.side === b.side && a.id !== 'wall-panelling' && b.id !== 'wall-panelling' && span(a.a0, a.a1, b.a0, b.a1) && span(a.y0, a.y1, b.y0, b.y1)) err(`#${a.k} ${a.id} and #${b.k} ${b.id} overlap on the ${a.side} wall`); }
  const against = (p, side) => side === 'N' ? p.rc[1] <= 1 && [p.rc[0], p.rc[0] + p.rc[2]] : p.rc[0] + p.rc[2] >= R.w - 1 && [p.rc[1], p.rc[1] + p.rc[3]];
  const topH = p => Math.max(p.h, ...(tops.get(p.k) ?? []).map(q => q.h + p.o.tops[0]));   // (what stands on it counts: a TV on a dresser)
  const blockers = (w, s) => solid.filter(p => { const r = against(p, w.side); return r && span(r[0], r[1], w.a0, w.a1) && topH(p) > w.y0 + (s ?? .02); });
  for (const w of wallPieces) { const b = blockers(w); if (!b.length) continue; const names = b.map(p => `#${p.k} ${p.id}`).join(', ');
    if (w.id === 'door-front') err(`the door is blocked by ${names}`); else if (w.id === 'window' || w.id === 'ac-window') warn(`#${w.k} ${w.id} is blocked by ${names}`);
    else if (w.id !== 'wall-panelling') err(`#${w.k} ${w.id} is hidden behind ${names}`); }
  // ── the door's swing: a 1 m square in front of it stays clear
  const doorRect = !door ? null : door.side === 'E' ? [R.w - 4, door.a, 4, 4] : [door.a, 0, 4, 4];
  if (!door) err('no front door'); else for (const p of solid) if (hit(p.rc, doorRect)) err(`#${p.k} ${p.id} stands in the door's swing`);
  if (!beds) err('nowhere to sleep (no bed, futon-bed or mattress)');
  // ── slots
  const rugSlots = [];
  SLOTS.forEach((s, i) => { const tag = `slot ${i} "${s.label}"`, d = byId.get(s.demo);
    if (!Array.isArray(s.fits) || !s.fits.length) err(`${tag}: no fits`);
    if (!d) return err(`${tag}: demo ${s.demo} is not in the catalogue`);
    if (d.place !== s.place) err(`${tag}: demo ${s.demo} is a ${d.place} piece in a ${s.place} slot`);
    if (s.fits && !s.fits.includes(d.game?.kind) && !s.fits.includes(d.cat)) err(`${tag}: demo ${s.demo} (${d.game?.kind}/${d.cat}) is not in fits [${s.fits}]`);
    if (s.fits) for (const f of s.fits) if (!KINDS.includes(f) && !['rugs', 'security', 'lights', 'collectibles', 'trophies', 'stash', 'gaming', 'wall', 'electronics', 'kitchen', 'music', 'decor'].includes(f)) warn(`${tag}: fits "${f}" is neither a kind nor a category`);
    if (d.foot[0] > s.foot[0] || d.foot[1] > s.foot[1]) err(`${tag}: demo ${s.demo} ${d.foot} does not fit the slot ${s.foot}`);
    const rc = rectOf(s.x, s.z, s.foot, s.rot);
    if (s.place === 'floor') { if (rc[0] < 0 || rc[1] < 0 || rc[0] + rc[2] > R.w || rc[1] + rc[3] > R.d) err(`${tag}: off the floor`);
      if (s.under) return rugSlots.push(rc);
      for (const p of solid) if (hit(p.rc, rc)) err(`${tag}: overlaps #${p.k} ${p.id}`);
      for (const q of floorSlots) if (hit(q.rc, rc)) err(`${tag}: overlaps slot "${q.label}"`);
      if (doorRect && hit(rc, doorRect) && d.cat !== 'security') err(`${tag}: in the door's swing`);
      floorSlots.push({ label: s.label, rc, h: d.h, i }); }
    if (s.place === 'surface') { const P = LIST[s.on], po = P && byId.get(P.id); if (!po?.tops?.length) return err(`${tag}: on #${s.on}, which has no top`);
      const pr = rectOf(P.x, P.z, po.foot, P.rot); if (!inside(rc, pr)) err(`${tag}: hangs off #${s.on} ${P.id}`);
      for (const q of tops.get(s.on) ?? []) if (hit(q.rc, rc)) err(`${tag}: collides with #${q.k} ${q.id} on #${s.on}`);
      (tops.get(s.on) ?? tops.set(s.on, []).get(s.on)).push({ k: 'slot' + i, id: s.label, rc, h: d.h }); }
    if (s.place === 'wall') { const y0 = s.y ?? d.mount, y1 = y0 + s.foot[1] * C4, w = { side: s.wall, a0: s.x, a1: s.x + s.foot[0], y0, y1 };
      if (!s.wall) err(`${tag}: no wall`); if (w.a0 < 0 || w.a1 > len(s.wall)) err(`${tag}: runs off the ${s.wall} wall`); if (y1 > H + 1e-6) err(`${tag}: pokes through the ceiling`);
      for (const p of wallPieces) if (p.side === w.side && p.id !== 'wall-panelling' && !(d.sim === 'door' && p.id === 'window') && span(p.a0, p.a1, w.a0, w.a1) && span(p.y0, p.y1, w.y0, w.y1)) err(`${tag}: overlaps #${p.k} ${p.id} on the ${w.side} wall`);
      const b = blockers(w); if (b.length) err(`${tag}: hidden behind ${b.map(p => `#${p.k} ${p.id}`).join(', ')}`); wallPieces.push({ k: 'slot' + i, id: s.label, ...w }); }
  });
  // ── a walkable path (a 0.5 m wide character) from the door to the bed, every seat, the kitchen and the open front
  // (MAINLAND 2026-10-06: on typed grids, not string sets: a Mainland room has 4× a penthouse's cells and the builder runs this per candidate)
  const RW = R.w, RD = R.d, blocked = new Uint8Array(RW * RD), at = (x, z) => x >= 0 && z >= 0 && x < RW && z < RD;
  for (const p of solid) for (const [x, z, over] of p.cells) if (!over && at(x, z)) blocked[x + z * RW] = 1;
  for (const q of floorSlots) for (let x = q.rc[0]; x < q.rc[0] + q.rc[2]; x++) for (let z = q.rc[1]; z < q.rc[1] + q.rc[3]; z++) if (at(x, z)) blocked[x + z * RW] = 1;
  const free = (x, z) => x >= 0 && z >= 0 && x + 2 <= RW && z + 2 <= RD && !blocked[x + z * RW] && !blocked[x + 1 + z * RW] && !blocked[x + (z + 1) * RW] && !blocked[x + 1 + (z + 1) * RW];
  const seenG = new Uint8Array(RW * RD), Q = new Int32Array(RW * RD + 3); let qh = 0, qt = 0;
  if (doorRect) for (let a = 0; a < 3; a++) { const [x, z] = door.side === 'E' ? [R.w - 2, door.a + a] : [door.a + a, 0]; if (free(x, z) && !seenG[x + z * RW]) { seenG[x + z * RW] = 1; Q[qt++] = x + z * RW; } }
  while (qh < qt) { const c = Q[qh++], x = c % RW, z = (c / RW) | 0;
    for (const [nx, nz] of [[x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1]]) if (free(nx, nz) && !seenG[nx + nz * RW]) { seenG[nx + nz * RW] = 1; Q[qt++] = nx + nz * RW; } }
  // a 2 × 2 walker at (x, z) reaches a rect when it touches it (the same test as before, over the grid round the rect)
  const reach = rc => { for (let z = Math.max(0, rc[1] - 2); z <= Math.min(RD - 1, rc[1] + rc[3]); z++) for (let x = Math.max(0, rc[0] - 2); x <= Math.min(RW - 1, rc[0] + rc[2]); x++) if (seenG[x + z * RW]) return true; return false; };
  for (const p of solid) if (['beds', 'seating', 'kitchen', 'tables', 'storage'].includes(p.o.cat) && !reach(p.rc)) (p.o.cat === 'beds' || p.o.cat === 'seating' ? err : warn)(`#${p.k} ${p.id} can't be reached from the door`);
  if (doorRect) { let front = false; for (let z = Math.max(0, RD - 3); z < RD && !front; z++) for (let x = 0; x < RW; x++) if (seenG[x + z * RW]) { front = true; break; } if (!front) warn('no path from the door to the open front'); }
  let seen0 = null;   // (the walkable cells as "x,z" keys, built only when asked: check.mjs --map draws them)
  return { A, LIST, mode, E, W, solid, floorSlots, rugSlots, doorRect, grid, seenG, get seen() { if (!seen0) { seen0 = new Set(); for (let k = 0; k < seenG.length; k++) if (seenG[k]) seen0.add((k % RW) + ',' + ((k / RW) | 0)); } return seen0; } };
}


function tierCheck(A, g) {
  const { E, W, LIST, solid } = g, err = s => E.push(s), warn = s => W.push(s), T = A.tier, R = A.room, ids = LIST.map(it => it.id), objs = LIST.map(it => byId.get(it.id)).filter(Boolean);
  if (!BEDS[T]) return err(`unknown tier ${T}`);
  if (g.mode === 'vacant') return;
  if (!ids.some(id => BEDS[T].includes(id))) err(`no bed sized to the ${T} (${BEDS[T].join(' or ')})`);
  if (!objs.some(o => o.cat === 'seating' || o.id === 'dining-set')) err('nowhere to sit');   // (a dining set brings its chairs)
  if (!objs.some(o => o.cat === 'kitchen')) err('no kitchen piece (nowhere to cook or keep food)');
  if (T === 'house' && !ids.includes('fridge')) err('a house with no fridge');
  if (T === 'mainland' && !ids.includes('fridge')) err('a Mainland house with no fridge');
  if ((T === 'house' || T === 'penthouse' || T === 'mainland') && !ids.some(id => ['dining-set', 'bar-home'].includes(id))) err('nowhere to eat (a dining set or a bar)');
  const D = DRESS[T], rugs = objs.filter(o => o.cat === 'rugs').length;
  const art = LIST.filter(it => { const o = byId.get(it.id); return o && it.on?.wall && !FIXTURE.has(it.id) && (o.cat === 'wall' || o.cat === 'lights'); }).length
    + (T === 'penthouse' || T === 'mainland' ? (A.slots ?? []).filter(s => s.place === 'wall').length : 0);   // (a penthouse's art is the owner's, or the realtor's staging; a Mainland house's display walls are its collector's: their wall slots count)
  const lived = objs.filter(o => !FIXTURE.has(o.id) && (['decor', 'plants', 'lights', 'clutter', 'music'].includes(o.cat))).length;
  if (rugs < D.rugs) err(`dressing: ${rugs} rug(s), a ${T} wants ${D.rugs}`);
  if (art < D.art) err(`dressing: ${art} piece(s) of wall art, a ${T} wants ${D.art}`);
  if (lived < D.lived) err(`dressing: ${lived} lived-in piece(s), a ${T} wants ${D.lived}`);
  // slots: 2–4 (a Mainland house 3–6), unique ids, fits, a demo that fits
  const S = A.slots ?? [], [n0, n1] = SLOTN[T] ?? [2, 4]; if (S.length < n0 || S.length > n1) err(`${S.length} slots (a ${T} layout marks ${n0}–${n1})`);
  const sids = new Set(); for (const [i, s] of S.entries()) { const tag = `slot ${i} "${s.label}"`;
    if (!s.id || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s.id)) err(`${tag}: no kebab-case id`); else if (sids.has(s.id)) err(`${tag}: duplicate id ${s.id}`); else sids.add(s.id);
    if (!Array.isArray(s.fits) || !s.fits.length) continue;   // (geometry already says so)
    for (const f of s.fits) if (!KINDS.includes(f) && !CATS.includes(f)) err(`${tag}: fits "${f}" is neither a kind nor a category`);
    const d = byId.get(s.demo); if (d && !fitsSlot(d, s)) err(`${tag}: the demo ${s.demo} does not fit the slot (fits, place or size)`);
    if (!OBJECTS.some(o => o.id !== s.demo && o.game?.kind !== 'base' && fitsSlot(o, s))) warn(`${tag}: nothing but the demo fits it`); }
  if (!S.some(s => s.fits?.includes('stash') && OBJECTS.some(o => o.cat === 'stash' && fitsSlot(o, s)))) err('no stash spot (a slot whose fits take a stash piece)');
  simSpots(A, g, err);
}
// the safe and the dog: room.js spot() must still find free floor for them (split out of tierCheck so the builder can run it per candidate)
function simSpots(A, g, err = s => g.E.push(s)) {
  const { solid } = g, T = A.tier, R = A.room, S = A.slots ?? [];
  // free floor clear of every floor piece and floor slot, off the open front row
  const occ = new Set(); for (const p of solid) for (const [x, z, over] of p.cells) if (!over) occ.add(x + ',' + z);
  const reserved = S.filter(s => s.place === 'floor').map(s => rectOf(s.x, s.z, s.foot, s.rot));
  const spot = (w, d) => { for (let z = 0; z + d <= R.d - 1; z++) for (let x = 0; x + w <= R.w; x++) { let ok = true;
      for (let a = 0; a < w && ok; a++) for (let b = 0; b < d && ok; b++) if (occ.has((x + a) + ',' + (z + b))) ok = false;
      if (ok && !reserved.some(([sx, sz, sw, sd]) => x < sx + sw && x + w > sx && z < sz + sd && z + d > sz)) return [x, z]; } return null; };
  const slotHas = sim => S.some(s => byId.get(s.demo)?.sim === sim);
  if (!slotHas('safe')) { const o = byId.get(SAFE[T]); if (!spot(o.foot[0], o.foot[1])) err(`no free floor for the ${SAFE[T]} (sec: safe)`); }
  if (!slotHas('dog') && !spot(4, 3)) err('no free floor for a dog bed (sec: dog)');
}
// the vacant set: the shell as the owned layout has it, a bare mattress, boxes, the board; the same pieces across a tier
function vacantCheck(A, g, tierSets) {
  const err = s => g.E.push(s), V = A.vacant;
  if (!Array.isArray(V)) { if (A.tier !== 'penthouse' && A.tier !== 'mainland') err('no vacant set (an empty home falls back to the bare kit)'); return; }   // (an empty penthouse is the realtor's staged show unit; a Mainland house is never vacant)
  const key = it => `${it.id}@${it.x},${it.z},${it.y ?? ''}:${JSON.stringify(it.on)}`, shell = L => L.filter(it => ['door-front', 'window', 'ac-window'].includes(it.id)).map(key).sort().join(' ');
  if (shell(V) !== shell(A.items)) err('vacant: the door and windows differ from the owned layout (the street sees the same unit)');
  for (const it of V) { const o = byId.get(it.id); if (o && !VACANT_OK.has(o.cat)) err(`vacant: ${it.id} (${o.cat}) in an empty unit`);
    if (it.on?.top !== undefined) err(`vacant: ${it.id} stands on another piece (room.js reads a vacant piece's top from the owned layout: keep the set on the floor and walls)`); }
  for (const need of ['mattress-floor', 'boxes-moving', 'sign-rent']) if (!V.some(it => it.id === need)) err(`vacant: no ${need}`);
  const set = V.filter(it => !FIXTURE.has(it.id) && byId.get(it.id)?.cat !== 'kitchen').map(it => `${it.id}:${it.variant ?? 0}`).sort().join(' ');
  (tierSets[A.tier] ??= new Map()).set(A.name, set);
}

// one layout, owned and vacant, as check.mjs reads it (tierSets: the per-tier vacant sets, compared across a tier by the CLI)
  function check(A, tierSets = {}) { const g = geometry(A); tierCheck(A, g); vacantCheck(A, g, tierSets);
    const v = Array.isArray(A.vacant) ? geometry(A, 'vacant') : null; if (v) { g.E.push(...v.E.map(e => 'vacant: ' + e)); g.W.push(...v.W.map(e => 'vacant: ' + e)); }
    return { E: g.E, W: g.W, g, v }; }
  return { geometry, tierCheck, simSpots, vacantCheck, check };
}
