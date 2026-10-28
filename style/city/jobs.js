// Build jobs (pass 1c; pass 2: district kits + page isolation). Run inside the worker pool (worker.js loads this module graph from
// Blob URLs with `three` rewritten to the CDN, so world/city.js and world/chars.js work off the main thread) and on the main thread
// for deterministic ?shot=1 builds.
//   far(i, j)   the block's far tier: its kit's far(), else the spec pass (a few ms)
//   farChunk    streaming pass: the far tiers of a chunk of blocks (the woods, 4×4 blocks) merged into one mesh, tagged per member
//   block(i, j) full build → full tier (4 material layers) + mid tier (2× downsample, set pieces kept) + far tier + the cast baked
//               into all three character tiers + anchors (walkers, sim-state layer). Everything returns as compact tier meshes.
// Pass 2: nothing here imports a district kit, a hero or a block override. They arrive through modules.js (installModules), each
// loaded on its own, and every call into one is fenced: a module that throws costs only its block — the block is rebuilt as a
// placeholder (or without the override) and the failure rides back in `errors` for the page to list.
import * as THREE from 'three';
import * as CH from './cast.js';   // (cast pass, 2026-10-02: every character a block or the walker pool builds is the city's cast: cast.js)
import { Bank, LOD, stamp, farBank } from './vox.js';
import { TOD } from './kit.js';
import { rng, SIDE, hash } from './style.js';
import { buildBlock, planBlock, GEN } from './gen.js';
import { furnish, traffic, cornerKit } from './street.js';
import { taxi, steamStack, dog } from './props.js';
import { P, PLACES, blockAt, roadsOf, kindAt, urban, kerbOut } from './plan.js';
import { farFromPlan } from './far.js';
import { packFull, packMerged, mergeTiers } from './lod.js';
import { castOf } from './castspec.js';
import { bakeCast, castRoles } from './charbake.js';
import { REG, WALK } from './audit.js';
import { slab, hotspotKeep } from './ground.js';
import { SIM_PLACES } from './simplaces.js';
import { remap, unshift } from '../../world/city.js';
import { kerbX, kerbZ } from './districts/frame.js';
import { MODS, installModules, overrideFor, heroFn, kitFor, noteError, ModuleError } from './modules.js';
import { placeholderBlock, placeholderFar } from './placeholder.js';
import { blockCtx, farCtx, engineAfter, engineBefore, lanesOf, sidewalksOf, walkCorners, detourCornersOf, detourRamps } from './engine.js';
import { bakePeds } from './pedbake.js';
import { LETTERS } from './signage/type/index.js';   // lettering pass: ?letters=classic (setFlags)
// pass 2 · the generic pedestrians' looks (peds.js asks once): n looks of the city's cast (cast.js) baked into three tiers
export const jobPeds = job => { const r = bakePeds(job, CH, THREE); r.dogs = []; if (job.dogs === false) return r;   // (cast pass: the pool bakes in parallel jobs; one of them brings the dogs)
    // cleanup pass: + the walkers' dogs (props.js dog), 4 breeds × 5 coats × walk 0 · walk 1 · sit (peds.js)
  for (let b = 0; b < 4; b++) for (let c = 0; c < 5; c++) for (const [pose, fr] of [['walk', 0], ['walk', 1], ['sit', 0]]) r.dogs.push(packMerged(dog(b, c, pose, fr), [0, 0, 0])); return r; };
export { installModules, MODS };

// ground height under a point: the raised block slab (sidewalks, lots) or the road (pass 1d audit)
export const groundAt = (x, z) => { const i = Math.floor(x / P), j = Math.floor(z / P); if (!urban(kindAt(i, j))) return 0; const s = slab(i, j); return x >= s.x0 && x <= s.x1 && z >= s.z0 && z <= s.z1 ? SIDE : 0; };

export const towerCornerOf = b => b.k === 'D' ? ['NW', 'NE', 'SW', 'SE'][Math.floor(rng(b.i * 31 + b.j * 7 + 5)() * 4)] : null;
const originOf = (i, j) => [i * P + P / 2, 0, j * P + P / 2];
const KIT_CORNERS = new Set(PLACES.filter(p => p.kind === 'corner').map(p => p.id));   // (kerb props pass: the corners with a corner kit, heroes/corners.js — simstate/layer.js's cornerKits)
const TAKEN = [[-60, 1.6, 7], [-74, 1.6, 8], [-88.5, 1.2, 5], [-52, 1.6, 4], [80, -64, 6], [33, -17, 6]].map(([x, z, r]) => [...remap(x, z), r]);   // (SPREAD: today's spots, remapped)
const setFlags = f => { GEN.flags.neutral = !(f && (f.neutral === false || f.pass2 === false)); GEN.flags.pass2 = !(f && f.pass2 === false); LOD.faces = !(f && (f.pass2 === false || f.faces === false)); LETTERS.mode = f && f.letters === 'classic' ? 'classic' : 'new'; };
const errText = e => String(e && (e.stack || e.message) || e).split('\n').slice(0, 2).join(' · ').slice(0, 300);

// two generated people whose big heads overlap (< 0.7 m apart at the same height): the later one steps aside up to 0.8 m where it is
// clear (REG.personClear), else it is left out (logged). Ids were given before, so nothing else renumbers; hand-placed people, people
// an override moves or removes by id, sitters in scenes and giants are never touched, and they claim their spots FIRST: a generated
// person standing where a hand-placed one sits is the one that steps aside. Someone up on a roof only steps aside within that roof.
const KEEP = new Set(['window', 'soak', 'fe', 'giant', 'dj', 'dance', 'clerk']);
const roofUnder = (x, y, z) => (REG.blk?.feet || []).find(f => f.roofY !== undefined && y >= f.roofY - .05 && y < f.roofY + 1.5 && x > f.box[0] + .3 && x < f.box[3] - .3 && z > f.box[2] + .3 && z < f.box[5] - .3);
function unstack(persons, ov) {
  const pinned = new Set([...Object.keys(ov?.people?.move || {}), ...(ov?.people?.remove || [])]), free = c => !c.hand && !pinned.has(c.id) && !KEEP.has(c.act) && (c.scale || 1) <= 1.5;
  const kept = persons.filter(c => !free(c)), clash = (c, x, z) => kept.find(o => o !== c && Math.hypot(o.x - x, o.z - z) < .7 && Math.abs(o.y - c.y) < .6);
  for (const c of persons) { if (!free(c)) continue; if (!clash(c, c.x, c.z)) { kept.push(c); continue; } let ok = false;
    const up = c.y - groundAt(c.x, c.z) > .3, roof = up && roofUnder(c.x, c.y, c.z);
    if (!up || roof) for (const [dx, dz] of [[.4, 0], [-.4, 0], [0, .4], [0, -.4], [.8, 0], [-.8, 0], [0, .8], [0, -.8], [.57, .57], [-.57, .57], [.57, -.57], [-.57, -.57]]) {
      if (roof && roofUnder(c.x + dx, c.y, c.z + dz) !== roof) continue;
      if (!clash(c, c.x + dx, c.z + dz) && REG.personClear(c.x + dx, c.y, c.z + dz, /sit|lounge/.test(c.act || '')) && REG.headClear(c.x + dx, c.y, c.z + dz) && Math.abs(groundAt(c.x + dx, c.z + dz) - groundAt(c.x, c.z)) < .05) { c.x += dx; c.z += dz; ok = true; break; } }
    if (ok) kept.push(c); else REG.skip('person', [c.x, c.y, c.z], 'would stand inside ' + clash(c, c.x, c.z).id); }
  const k = new Set(kept); return persons.filter(c => k.has(c));   // (the cast keeps its order)
}

// cleanup pass · a hero's far tier. A hero slot may name its own: far: 'kit' (the kit's far(ctx) draws the hero block too), far: '<export>'
// (a function of the hero module, (ctx) → void, with the far helpers of engine.js farCtx), or a function. Without one (the default) the
// far tier is the hero's own build downsampled to 0.5 cubes — a far-only build (vox.js farBank: no 0.1 or 0.2 mesh, no cast, no audit),
// so its silhouette and colours are exactly what the full build shows, at a fraction of the cost.
function heroFarFn(kit, slot) {
  const f = slot?.far; if (!f) return null; if (typeof f === 'function') return f; if (f === 'kit') return kit.far || null;
  const { f: fn, error } = heroFn(slot.module, f); if (!fn) throw new ModuleError(slot.module, error, 'far'); return fn;
}
// cleanup pass · the clear walkway rule for the cast (audit.js WALK): nobody standing on a sidewalk may narrow the walkers' clear path
// below WALK.clear, or stand on their corner lines. Hand-placed people (blocks/<i>_<j>.js, heroes) and people an override moves go
// first, in their order, then the generated ones (in reverse: the build's own scenes and poses claim their spots before the generic
// door figures). Whoever breaks the path steps along the sidewalk up to 1.6 m, or across it (shopfront ↔ curb), where the path stays
// clear; else it is left out. Every hand-placed move or drop is logged (the audit's skipped list: 'person'). Sitters (a scene's, a
// stoop's), the KEEP acts, giants and people off the sidewalks (in the road, yards, plazas, on roofs) keep their spots.
const STEP = [.4, -.4, .8, -.8, 1.2, -1.2, 1.6, -1.6];   // along the sidewalk; then the same at the other side of it (shopfront ↔ curb)
function clearPath(persons, ov) {
  const b = REG.blk; if (!b?.walk.length) return persons;
  const pinned = new Set([...Object.keys(ov?.people?.move || {}), ...(ov?.people?.remove || [])]), r = WALK.r;
  const stands = c => c.y <= SIDE + .4 && c.y >= SIDE - .05 && (c.scale || 1) <= 1.5 && !KEEP.has(c.act) && !/sit|lounge/.test(c.act || '') && REG.onWalk(c.x, c.z), mine = c => c.hand || pinned.has(c.id);   // (on a sidewalk: in the road, a yard or a plaza nobody walks through them)
  const kept = persons.filter(c => !stands(c)); b.life = kept;   // (audit.js gapAt reads the standing people from here)
  const ok = (c, x, z) => !REG.walkGap([x - r, SIDE + .1, z - r, x + r, SIDE + 1.7, z + r], WALK.people) && !kept.some(o => o !== c && Math.hypot(o.x - x, o.z - z) < .7 && Math.abs(o.y - c.y) < .6)
    && !REG.why([x - .22, c.y + .05, z - .22, x + .22, c.y + 1.7, z + .22], { ignore: ['plinth', 'corner-zone'], doors: false, items: false, walk: false });   // (and off the walkers' corner lines and facade parts: a dealing crew keeps its zone)
  const order = persons.filter(c => stands(c) && mine(c)).concat(persons.filter(c => stands(c) && !mine(c)).reverse());
  for (const c of order) { let done = ok(c, c.x, c.z); const x0 = c.x, z0 = c.z;
    const w = done ? null : REG.walkAt(c.x, c.z), tries = [];   // steps along the sidewalk it stands on, then the same across it
    if (w) { const { S } = w, [ax, az] = S.ax === 'x' ? [1, 0] : [0, 1], [nx, nz] = S.ax === 'x' ? [0, S.dir] : [S.dir, 0], flip = (w.c < 1 ? 1.6 : .4) - w.c;
      for (const f of [0, flip]) for (const t of [0, ...STEP]) if (f || t) tries.push([ax * t + nx * f, az * t + nz * f]); }
    if (!done) for (const [dx, dz] of tries) { const x = c.x + dx, z = c.z + dz; if ([[x - .25, z - .25], [x + .25, z - .25], [x - .25, z + .25], [x + .25, z + .25]].some(([gx, gz]) => Math.abs(groundAt(gx, gz) - groundAt(c.x, c.z)) > .05)) continue;
      if (!REG.fitsPerson(x, z, c.y, { ignore: 'plinth', items: false, walk: false }) || !REG.personClear(x, c.y, z) || !REG.headClear(x, c.y, z) || !ok(c, x, z)) continue; c.x = x; c.z = z; done = true; break; }
    if (done) { kept.push(c); if (mine(c) && (c.x !== x0 || c.z !== z0)) REG.skip('person', [x0, c.y, z0], `${c.id} moved ${Math.hypot(c.x - x0, c.z - z0).toFixed(1)} m to [${c.x.toFixed(2)}, ${c.z.toFixed(2)}]: it stood on the walkers' clear path`); }
    else REG.skip('person', [c.x, c.y, c.z], `${mine(c) ? c.id + ' (hand-placed) left out' : 'left out'}: it would block the walkers' clear path`); }
  const k = new Set(kept); return persons.filter(c => k.has(c));   // (the cast keeps its order)
}
// cleanup pass · DOGS (props.js dog): a dog by some stoops (in the front yard, beside the steps someone sits on) and in about one
// backyard in three (yards.js), stamped after the cast is made so no person ever makes room for one, and only where it is clear of
// props, facade parts, doorways and people. Items i_j·dogs·dog·n. (The walkers' dogs are peds.js.)
function placeDogs(bank, A, persons) {
  const list = (A.dogs || []).map(d => ({ ...d, pose: hash(d.seed, 94) < .5 ? 'sit' : 'walk' }));
  (A.stoops || []).forEach((s, k) => { if (k % 2 || !s.dog) return; const [ax, az] = unshift(s.at[0], s.at[1]);   // (SPREAD pin: the stoop's dog rolls on today's place)
    if (hash(Math.round(ax * 10), Math.round(az * 10), 61) > .35) return; list.push({ x: s.dog[0], z: s.dog[1], rot: s.rot, seed: Math.round(ax * 31 + az * 17), pose: 'sit' }); });
  if (!list.length || !REG.blk) return; const g = REG.blk.group; REG.group('dogs');
  for (const d of list) { const bk = dog((hash(d.seed, 95) * 4) | 0, (hash(d.seed, 96) * 5) | 0, d.pose), box = REG.boxOf(bk, d.rot, d.x, SIDE, d.z);
    if (persons.some(c => Math.abs(c.y - SIDE) < 1.2 && Math.hypot(c.x - d.x, c.z - d.z) < .8) || REG.why(box, { ignore: 'plinth' })) continue; stamp(bk, bank, d.rot, d.x, SIDE, d.z); }
  REG.group(g); }
export function jobFar(job) {
  const { i, j, night, flags } = job;
  TOD.night = night; LOD.on = false; REG.blk = null; REG.audit = false; setFlags(flags); const b = blockAt(i, j), t = performance.now(), kit = kitFor(i, j); GEN.kit = kit;
  const errors = []; let bank = null, maxH = 0; const slot = kit.status !== 'broken' ? kit.heroAt(i, j) : null;
  // lazy heroes: a hero block streams like any block — this far tier first, its full build only once the camera comes near
  if (slot) { let hf = null; try { hf = heroFarFn(kit, slot); } catch (e) { errors.push({ path: slot.module, stage: 'far', block: `${i}_${j}`, error: errText(e) }); }
    if (!hf) { const out = jobBlock({ ...job, chars: false, audit: false }, { farOnly: true }); out.errors = errors.concat(out.errors || []); return emptyFar(out, kit, i, j); }
    try { const c = farCtx(b, kit); hf(c); bank = c.bank; maxH = c.maxH; } catch (e) { errors.push({ path: slot.far === 'kit' ? kit.path : slot.module, stage: 'far', block: `${i}_${j}`, error: errText(e) }); bank = placeholderFar(new Bank(true), b); } }
  else if (kit.status === 'broken') bank = placeholderFar(new Bank(true), b);
  else if (kit.far) { try { const c = farCtx(b, kit); kit.far(c); bank = c.bank; maxH = c.maxH; } catch (e) { errors.push({ path: kit.path, stage: 'far', block: `${i}_${j}`, error: errText(e) }); bank = placeholderFar(new Bank(true), b); } }
  else { const { lots } = planBlock(b, towerCornerOf(b)); bank = farFromPlan(b, lots); for (const l of lots) maxH = Math.max(maxH, (l.H || 0) * .1); }
  GEN.kit = null; return emptyFar({ i, j, far: packMerged(bank, originOf(i, j)), maxH, ms: performance.now() - t, errors }, kit, i, j);
}
// streaming pass · a chunk of far tiers (the woods: stream.js merges the far tiers of every woods block in a 4×4-block chunk): each member
// is exactly jobFar's far tier, merged into one mesh at the chunk's origin `o` (lod.js mergeTiers), its vertices tagged with the member's
// index (K), so the page hides or dissolves one member at a time. One job, one cache record and one draw call instead of sixteen.
export function jobFarChunk(job) {
  const t = performance.now(), parts = [], errors = [];
  const members = job.members.map(([i, j], k) => { const r = jobFar({ ...job, type: 'far', i, j }); if (r.errors?.length) errors.push(...r.errors); if (r.far) parts.push([r.far, k]);
    return { i, j, maxH: r.maxH || 0, n: r.far ? r.far.n : 0 }; });
  return { chunk: true, members, far: mergeTiers(parts, job.o), errors, ms: performance.now() - t };
}
// an empty far tier (a far() that drew nothing) can't be shown: it is reported as a failure, and the stream counts the block as done
// instead of waiting for it (an empty one once hung the first view)
function emptyFar(out, kit, i, j) { if (!out.far) out.errors = (out.errors || []).concat([{ path: kit.path || 'core', stage: 'far', block: `${i}_${j}`, error: 'the far tier is empty: far(ctx) drew nothing' }]); return out; }

export function jobBlock(job, base = {}) {
  const errors = []; let mode = { ...base };
  for (let attempt = 0; attempt < 3; attempt++) {
    try { const out = buildJob(job, mode); out.errors = errors; return out; }
    catch (e) { REG.blk = null; REG.audit = false; REG.strict = false; LOD.on = false; GEN.kit = null; GEN.override = undefined;
      const path = e instanceof ModuleError ? e.path : 'core', er = { path, stage: e.stage || 'build', block: `${job.i}_${job.j}`, error: errText(e instanceof ModuleError ? e.cause : e) }; errors.push(er);
      if (path.startsWith('blocks/')) mode = { ...mode, noOverride: true };          // an override broke: build the block without it
      else mode = { ...mode, placeholder: er }; }                                      // a hero or a kit broke (or the core): the placeholder
  }
  throw new Error('block ' + job.i + ',' + job.j + ' failed three times: ' + errors.map(e => e.error).join(' | '));
}

function buildJob({ i, j, night, chars = true, audit = false, flags }, mode) {
  TOD.night = night; setFlags(flags); const b = blockAt(i, j), kit = kitFor(i, j), heroSlot = kit.heroAt(i, j), t0 = performance.now();
  const hero = !!heroSlot || !!mode.placeholder || kit.status === 'broken', hf = heroSlot && !mode.placeholder && kit.status !== 'broken' && !mode.farOnly ? heroFarFn(kit, heroSlot) : null;
  GEN.kit = kit; LOD.on = true; LOD.far = (hero && !hf) || (!!kit.build && !kit.far && !heroSlot);
  const bank = mode.farOnly ? farBank() : new Bank(), A = { stoops: [], doors: [], roofs: [], giants: [], life: [] }, sink = new Bank(true);   // (farOnly: the far tier alone, jobFar)
  const bankOf = (bi, bj) => (bi === i && bj === j) ? bank : sink, ov = mode.noOverride || mode.placeholder ? null : overrideFor(i, j);
  GEN.override = ov;   // planBlock (gen.js) reads the lot hooks from here (null: none, or this build skips a broken override)
  REG.begin(i, j, bank, { override: ov, audit, walk: GEN.flags.pass2 ? sidewalksOf(i, j) : [] }); REG.groundAt = groundAt; REG.blk.life = A.life;   // pass 1d: every stamp into `bank` gets an id; the block's override applies by id (cleanup pass: + its sidewalks and standing people, for the clear walkway rule)
  for (const [bk, rot, x, z] of cornerKit(i, j)) { REG.keep(REG.boxOf(bk, rot, x, SIDE, z), 'corner-furniture'); REG.walkObs(REG.wboxOf(bk, rot, x, SIDE, z), 'corner-furniture'); }   // lamps + signals are reserved up front
  if (GEN.flags.pass2) { const det = detourCornersOf(i, j); for (const box of walkCorners(i, j, det).concat(detourRamps(i, j, det))) REG.keep(box, 'walkway'); }   // cleanup pass: and the walkers' turning and crossing lines in every corner square (at a dealing corner, their ramps into the road)
  const CM = MODS.corners;
  if (CM?.cornerZones) { try { for (const z of CM.cornerZones(PLACES, P)) if (z.i === i && z.j === j) REG.keep(z.box, 'corner-zone'); } catch (e) { noteError('heroes/corners.js', errText(e), 'build', { block: `${i}_${j}` }); } }   // so are the dealing corners' spots
  // kerb props pass (2026-10-09): and the sim's dealing-corner hotspots (ground.js hotspotSpot; simstate/layer.js draws them at run time,
  // so the build never saw them: a kerb prop could stand in one): their footprint on the walks, before anything is put down
  for (const c of SIM_PLACES) if (c.kind === 'corner') for (const box of hotspotKeep(c, KIT_CORNERS.has(c.id))) if (Math.floor((box[0] + box[3]) / 2 / P) === i && Math.floor((box[2] + box[5]) / 2 / P) === j) REG.keep(box, 'hotspot-zone');
  engineBefore(b, kit, bank, A);   // pass 2: transit strips, sim-place yards and other kit reservations, before anything is built
  // ── the block itself: a hero, the kit's own builder, or the shared generator with the kit's grammar
  if (mode.placeholder || kit.status === 'broken') placeholderBlock(bank, b, mode.placeholder || kit.error);
  else if (heroSlot) { const { f, error } = heroFn(heroSlot.module, heroSlot.fn); if (!f) throw new ModuleError(heroSlot.module, error, 'load');
    try { f(bank, b, A); } catch (e) { throw new ModuleError(heroSlot.module, e, 'build'); } }
  else if (kit.build) { const c = blockCtx(bank, b, A, kit); REG.strict = true; try { kit.build(c); c.finish(); } catch (e) { throw new ModuleError(kit.path, e, 'build'); } finally { REG.strict = false; } }   // pass 2: strict placement while kit code runs
  else buildBlock(bank, b, A, towerCornerOf(b));
  const stats = A.stats?.[0] || null;
  // street furniture, dealing corners, traffic: computed for the whole plan, stamped only where they land in this block
  const C = { stoops: [], doors: [], roofs: [], giants: [] }; REG.group('corner');
  if (CM?.corners) { try { CM.corners(bankOf, C, PLACES, P, groundAt); } catch (e) { noteError('heroes/corners.js', errText(e), 'build', { block: `${i}_${j}` }); C.corners = []; } }
  const mine = (C.corners || []).map((c, k) => ({ ...c, k })).filter(c => Math.floor(c.cx / P) === i && Math.floor(c.cz / P) === j); A.corners = mine;
  const taken = TAKEN.concat((C.corners || []).map(c => [c.cx, c.cz, 2.5]));
  REG.group('street'); furnish(bankOf, b, taken, A); REG.group('traffic'); traffic(bankOf, roadsOf(i, j), taken);
  REG.group('street');
  // hand-placed street one-offs (pass 1d: checked like everything else, nudged along the street up to 2 m if something is in the way)
  const nudge = (bk, rot, x, y, z, ax, az) => { const whys = new Set(); for (const d of [0, .5, -.5, 1, -1, 1.5, -1.5, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6, 7, -7, 8, -8, 10, -10]) { const px = x + ax * d, pz = z + az * d, e = REG.boxOf(bk, rot, px, y, pz), onSlab = y < .1 || [[e[0] + .05, e[2] + .05], [e[3] - .05, e[2] + .05], [e[0] + .05, e[5] - .05], [e[3] - .05, e[5] - .05]].every(([gx, gz]) => groundAt(gx, gz) > .1);
      const why = onSlab ? REG.why(e, { doors: y > .1, ignore: 'plinth' }) : 'off the sidewalk'; if (!why) { stamp(bk, bank, rot, px, y, pz); return; } whys.add(why); } REG.skip(bk.kind, [x, y, z], 'no room: ' + [...whys].join(', ')); };
  if (i === -3 && j === 0) nudge(taxi(), 1, kerbX(-88.5), 0, kerbZ(1.2), 1, 0);   // (SPREAD: today's metres, kept to Central Ave's kerb lane)
  if (i === -3 && j === -1) nudge(steamStack(), 0, kerbX(-84), 0, kerbZ(-1.5), 1, 0);
  // (pass 2: the Ivy St newsstand the generator kept trying is gone — South Row hand-placed it on Central Ave in blocks/-2_0.js)
  engineAfter(b, kit, bank, A);   // pass 2: transit props, sim-state anchors (lots, tag slots, sites), walker lanes come later
  REG.snapLife(A.life);   // pass 1d: people on yard floors, paving and lot asphalt stand on it
  // hand-crafted one-offs from the block's override (city/blocks/<i>_<j>.js)
  if (ov?.add) { REG.group('hand'); try { ov.add({ bank, stamp, A, SIDE, P, i, j, night }); } catch (e) { throw new ModuleError(`blocks/${i}_${j}.js`, e, 'add'); } }
  const tBuild = performance.now() - t0, o = originOf(i, j);
  // the cast of this block → three character tiers (cleanup pass: made before the tiers are packed, since its dogs go into the bank;
  // a far-only build has no cast)
  const t1 = performance.now(); let persons = [], retired = [];
  if (!mode.farOnly) {
    // the life budget and people overrides: add anchors before the cast is made, then ids, removals and moves on the cast itself
    try { if (ov?.people?.add) for (const p of ov.people.add) A.life.push({ y: SIDE, ry: 0, seed: 1, act: 'stand', ...p, hand: true }); } catch (e) { throw new ModuleError(`blocks/${i}_${j}.js`, e, 'people'); }
    // ids: the generated cast in order (i_j·char·n), hand-placed people apart (i_j·char·h<k>, in the order the block file adds them), so a
    // generator change that makes one more or one fewer person never turns an override's id into someone the block file placed
    persons = castOf(A, CH, (i + 64) * 131 + (j + 64)); let gn = 0, hn = 0; persons.forEach(c => { c.id = `${i}_${j}·char·${c.hand ? 'h' + hn++ : gn++}`; });
    // pass 1d: nobody stands inside a prop or a wall — nudge up to 0.6 m, else leave them out (window leaners, bathers, fire-escape
    // sitters and giants are placed against geometry on purpose)
    const HOME = new Set(['window', 'soak', 'fe', 'giant', 'dj', 'dance', 'clerk']);
    persons = persons.filter(c => { if (HOME.has(c.act) || (c.scale || 1) > 1.5) return true; const seat = /sit|lounge/.test(c.act || ''); if (REG.personClear(c.x, c.y, c.z, seat)) return true;
      for (const [dx, dz] of [[.3, 0], [-.3, 0], [0, .3], [0, -.3], [.6, 0], [-.6, 0], [0, .6], [0, -.6]]) if (REG.personClear(c.x + dx, c.y, c.z + dz, seat)) { c.x += dx; c.z += dz; return true; }
      REG.skip('person', [c.x, c.y, c.z], 'inside a prop or wall'); return false; });
    if (ov?.people) { try { const rm = new Set(ov.people.remove || []), mv = ov.people.move || {}; persons = persons.filter(c => !rm.has(c.id));
      for (const c of persons) { const m = mv[c.id]; if (m) { c.x += m[0] || 0; c.y += m[1] || 0; c.z += m[2] || 0; if (m[3] !== undefined) c.ry = m[3]; } } } catch (e) { throw new ModuleError(`blocks/${i}_${j}.js`, e, 'people'); } }
    // hardening pass · the retired sidewalk crowd (charbake.js castRoles: never baked, never drawn) leaves HERE, before anyone makes room
    // for it: it used to claim spots in unstack (the kept stepped aside or were dropped), narrow the clear path in clearPath (REG.blk.life,
    // so the kept moved or were left out, and dogs were refused), keep dogs away, and sit in the audit's cast. Only the lanes skipped it.
    if (GEN.flags.pass2) { const roles = castRoles(persons); retired = roles.filter(r => r.retire); persons = persons.filter((p, k) => !roles[k].retire); }
    if (GEN.flags.pass2) persons = unstack(persons, ov);   // pass 2: people inside people (the audit's char-overlap), resolved after ids exist
    if (GEN.flags.pass2) persons = clearPath(persons, ov);   // cleanup pass: standing people keep the walkers' clear path, like every prop
    if (GEN.flags.pass2) placeDogs(bank, A, persons);   // cleanup pass: dogs by stoops and in yards, clear of the cast
  }
  if (mode.farOnly) { let maxH = 0; for (const r of A.roofs) maxH = Math.max(maxH, r.y); REG.end(null, groundAt); LOD.on = false; GEN.kit = null; GEN.override = undefined;
    return { i, j, far: packMerged(bank.far, o), maxH, kit: kit.district, placeholder: !!(mode.placeholder || kit.status === 'broken'), ms: performance.now() - t0 }; }
  const out = { i, j, full: packFull(bank, o), mid: packMerged(bank.mid, o), far: null, tris: bank.tris() | 0, trisMid: bank.mid.tris() | 0, stats, kit: kit.district, placeholder: !!(mode.placeholder || kit.status === 'broken'),
    pieces: (A.pieces || []).map(p => ({ kind: p.kind, x: +p.x.toFixed(1), z: +p.z.toFixed(1), y: +(p.y || 0).toFixed(1) })), anchors: A.anchors || null };
  if (hf) { LOD.on = false; const c = farCtx(b, kit); try { hf(c); } catch (e) { throw new ModuleError(heroSlot.far === 'kit' ? kit.path : heroSlot.module, e, 'far'); } out.far = packMerged(c.bank, o); }   // the hero's own far tier (as jobFar)
  else if (LOD.far) out.far = packMerged(bank.far, o);
  else if (kit.far) { LOD.on = false; const c = farCtx(b, kit); kit.far(c); out.far = packMerged(c.bank, o); }
  else { LOD.on = false; const { lots } = planBlock(b, towerCornerOf(b)); out.far = packMerged(farFromPlan(b, lots), o); }
  LOD.on = false; GEN.kit = null; GEN.override = undefined;
  let maxH = 0; for (const r of A.roofs) maxH = Math.max(maxH, r.y); out.maxH = maxH;
  // pass 2: the walkers' lanes around this block (peds.js), before the registry closes. Streaming pass (for the fidelity pass): round the
  // people who are drawn only — the retired sidewalk crowd (charbake.js castRoles) is not baked, so walkers no longer bend round its spots
  // (hardening pass: it already left the cast above; this catches anyone a later step moved out of a queue)
  if (GEN.flags.pass2) { const roles = castRoles(persons); out.lanes = lanesOf(b, persons.filter((p, k) => !roles[k].retire)); }
  // CAB FOLLOW-UP (2026-10-10) · THE CARS STANDING IN THE ROAD (parked by street.js, a hero's or a block file's own: the forecourt taxi at
  // ST MERCY, the plaza's cruisers): their footprints [x0, z0, x1, z1] in the anchors, so a cab pulling in to the kerb to drop its rider
  // finds a free spot (main.js parkedIn → traffic/cabs.js) instead of letting them out beside one
  if (REG.blk?.boxes) { const VEHK = /^(car|copcar|taxi|truck|van|cruiser|livery|sedan|beater|ambulance|pickup|limo|icecream)/;
    for (const it of REG.blk.boxes) { const e = it.box; if (!e || !VEHK.test(it.kind || '') || e[4] - e[1] > 4.5) continue; const cx = (e[0] + e[3]) / 2, cz = (e[2] + e[5]) / 2; if (kerbOut(cx, cz) > 0) continue;
      ((A.anchors ??= { lots: {}, sites: [] }).parked ??= []).push([+e[0].toFixed(2), +e[2].toFixed(2), +e[3].toFixed(2), +e[5].toFixed(2)]); } }
  const aud = REG.end(persons, groundAt); if (audit) { out.audit = aud; for (const p of out.lanes?.pinches || []) aud.issues.push({ type: 'walker-blocked', id: `${i}_${j}·lane·${p.x},${p.z}`, other: p.why, kind: 'lane', group: 'street', box: [p.x - .3, SIDE, p.z - .3, p.x + .3, SIDE + 1.9, p.z + .3], note: `no walker-wide gap on the sidewalk: ${p.why}` }); }
  if (chars) { const cellOf = (x, z) => (x - i * P >= P / 2 ? 1 : 0) + (z - j * P >= P / 2 ? 2 : 0);
    out.chars = bakeCast(persons, CH, THREE, o, cellOf, retired); }
  out.ms = [tBuild | 0, (performance.now() - t1) | 0];
  return out;
}
