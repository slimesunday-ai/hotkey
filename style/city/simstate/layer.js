// Pass 2 · THE SIM-STATE LAYER — the WIRING (main thread). It draws the adapter's model (adapter.js) with the sim-state pieces from
// city/simassets/index.js (the ASSETS agent's library, loaded in isolation) or, when that module is missing or fails, the plain boxes in
// simstate/placeholders.js — the same interface either way:
//   forRentSign({ style }) · pile(kind, level 0–1) · security(kind) · doormanLobby({ width }) · scar(kind, { w, h }) · windowCard(kind)
//   hotspot({ heat 0–1 }) · patrolCar({ lights }) · SIZES
// What it wires:
//   homes    ground parcels and STACKED UNITS on the anchors each kit hands back per block (res.anchors: lots = parcels, buildings =
//            walk-ups / towers with their units, floors and windows). Night lights per window (home and awake = lit; asleep = dark +
//            a zzz card; away = dark + a curtain), FOR RENT (lawn sign · a card in the unit's window · a lobby board), security where it
//            shows (house: lock on the door, steel door, safe in a window, camera for the alarm, a gate for the dog; walk-up: buzzer and
//            steel street door at the entrance, safe / camera by the unit's window; tower: the doorman lobby), scars (burned, boarded,
//            foreclosed, crime scene, memorial). Only on blocks shown at the near or mid tier (their windows match the anchors).
//   piles    each supply site's stock, sized by its bank (0–1), a second heap for a spill · corners: the hotspot on each dealing corner
//   patrols  a few patrol cars driving the plan's road graph near the camera
// Turf and crew visuals are deferred: nothing here reads model.holders. Crowd density goes to peds.js (main.js wires it).
// SIM LIVE pass: createSimLayer({ live: true }) draws the same things INCREMENTALLY (applyDiff: only what a poll changed, redrawn per
// group within a frame budget; simstate/live.js). ?sim=demo keeps the one-shot rebuild() below, unchanged.
// STAGE hooks (2026-10-07, stage/index.js): homeAt(id) where a home's door, windows and alarm are · holdScar(id, ms) keeps a home's
// crime-scene tape back while its burglary plays (setStage(s): s.newScar(id) is asked when a home's tape first comes, so a diff that
// beats the event to the page doesn't show the tape first) · pieceMesh(name, args, rot) one piece as its own mesh (a street memorial)
import * as THREE from 'three';
import { Bank, stamp, stampM, boxInto, meshed } from '../vox.js';
import { packMerged } from '../lod.js';
import { meshOf, disposeMesh, geometryOf } from '../gpu.js';
import { TOD } from '../kit.js';
import { SIDE } from '../style.js';
import { bankBox } from '../audit.js';
import { P, segX, segZ, hwX, hwZ, kindAt, urban, isAve } from '../plan.js';
import { slab, hotspotSpot } from '../ground.js';
import { loadOptional } from '../modules.js';
import * as PH from './placeholders.js';

const API = ['forRentSign', 'pile', 'security', 'doormanLobby', 'scar', 'windowCard', 'hotspot', 'patrolCar'];
// the piece library: simassets (isolated) → per-function fallback to the placeholders. Never throws.
export async function loadPieces(importer = p => import('../' + p)) {
  const m = (await loadOptional(['simassets/index.js'], importer))['simassets/index.js'], missing = !m || /404|Failed to fetch|not found|Cannot find/i.test(m.__error || '');
  const lib = { SIZES: PH.SIZES }, used = [];
  for (const k of API) { const f = m && !m.__error && typeof m[k] === 'function' ? m[k] : null; lib[k] = f ? (...a) => { try { return f(...a); } catch (e) { return PH[k](...a); } } : PH[k]; if (f) used.push(k); }
  if (m && !m.__error && m.SIZES) lib.SIZES = m.SIZES;
  return { lib, source: used.length === API.length ? 'simassets' : used.length ? 'simassets (partly)' : 'placeholders', error: m?.__error && !missing ? m.__error : null, missing: !!missing };
}
const MESHED = new WeakMap(), asBank = x => { if (!x) return null; if (x.L) return x; if (x.bank?.L) return x.bank; if (x.d && x.nx) { let b = MESHED.get(x); if (!b) MESHED.set(x, b = meshed(x)); return b; } return null; };   // a template, or a Vol (simassets: V.bank)
const CELL = 256, cellOf = (x, z) => Math.floor(x / CELL) + ',' + Math.floor(z / CELL);
const groundAt = (x, z) => { const i = Math.floor(x / P), j = Math.floor(z / P); if (!urban(kindAt(i, j))) return 0; const s = slab(i, j); return x >= s.x0 && x <= s.x1 && z >= s.z0 && z <= s.z1 ? SIDE : 0; };
const LIT = 0xffd37a, DARK = 0x1b2240, FACE = [[0, 1], [1, 0], [0, -1], [-1, 0]], vx = m => Math.round(m / .1);
// cleanup pass: a hotspot (3.2 × 3.2 m) never stands on the corner's lamp or signal post (ground.js cornerPosts) (Jay & Washington's sat on
// the corner lamp). Kerb props pass (2026-10-09): where it stands is ground.js hotspotSpot — measured from the corner's own kerbs and lot
// lines, on the slab, clear of the posts (at SPREAD 4 Grand & 1st's stood through its signal pole and lamp) — and jobs.js reserves it
// before the block is built, so no kerb prop lands in it.
// where a corner's hotspot stands: the zone quadrant (the far one where a corner kit stands), +z toward the street corner → [x, z, rot, qx, qz,
// compact] (compact: the tight corners' smaller set, 3.2 × 2.6 m — drawn with hotspot({ heat, compact: true }))
// (SIM LIVE pass: a function of its own, so the stand spots (stands.js) know where the hotspot is)
export const hotspotAt = (c, kit) => hotspotSpot(c, kit);

// Placement follows the piece library's anchors (simassets/index.js SIZES): ground pieces at their base centre; facade pieces at the
// bottom centre of their opening on the wall's outer plane (+z out of the wall, rot = the wall's facing); sizes in city voxels.
export function createSimLayer({ scene, mats, lib, isShown = () => true, night = TOD.night, cornerKits = new Set(), live = false, budgetMs = 2 }) {
  const PC = {};   // (SIM LIVE, ?bench=1: the slowest call of each piece — a first use builds and memoizes it)
  if (live) lib = Object.fromEntries(Object.entries(lib).map(([k, f]) => [k, typeof f !== 'function' ? f : (...a) => { const t0 = performance.now(), r = f(...a), ms = performance.now() - t0; if (ms > (PC[k] ?? 0)) PC[k] = +ms.toFixed(2); return r; }]));
  const anchors = new Map(); let model = null, dirty = false, meshes = [], shownKey = '', target = null;   // (target: the live path's group bank — bankAt draws into it)
  const scarHolds = new Map(); let stage = null; const scarHeld = id => scarHolds.has(id);   // (STAGE: a home's crime tape held back → performance.now() it comes at)
  const banks = new Map(), bankAt = (x, z) => { if (target) return target; const k = cellOf(x, z); let b = banks.get(k); if (!b) banks.set(k, b = new Bank(true)); return b; };
  const along = (rot, d) => [[d, 0], [0, -d], [-d, 0], [0, d]][rot & 3];   // d metres to the right along a wall facing `rot`, seen from the street
  const put = (t, rot, x, y, z) => { const b = asBank(t); if (b) stamp(b, bankAt(x, z), rot & 3, x, y, z); };
  const onGround = (t, rot, x, z, dy = 0) => put(t, rot, x, groundAt(x, z) + dy, z);
  // a window entry: [x, y, z, w, h] (centre, 0.02 m outside the wall plane) on the home's facing, or [x, y, z, w, h, rot] with its own
  const winRot = (w, rot) => w[5] ?? rot, sill = (w, rot) => { const r = winRot(w, rot), [fx, fz] = FACE[r & 3]; return [w[0] - fx * .02, w[1] - w[4] / 2, w[2] - fz * .02, r]; };
  const inWindow = (t, rot, w) => { const [x, y, z, r] = sill(w, rot); put(t, r, x, y, z); };
  const pane = (w, rot, col, layer) => { const r = winRot(w, rot), [x, y, z, ww, wh] = w, [fx, fz] = FACE[r & 3], b = bankAt(x, z), t = .02;
    if (fz) boxInto(b, layer, x - ww / 2, y - wh / 2, z - (fz > 0 ? 0 : t), x + ww / 2, y + wh / 2, z + (fz > 0 ? t : 0), col); else boxInto(b, layer, x - (fx > 0 ? 0 : t), y - wh / 2, z - ww / 2, x + (fx > 0 ? t : 0), y + wh / 2, z + ww / 2, col); };
  // a home's windows: scars cover them; at night the lights say who is home (asleep: dark + a zzz card; away: dark + the curtain drawn)
  function windows(ws, rot, st, guards = false) {
    const scar = st.scars.has('burned') ? 'burned' : st.scars.has('boarded') ? 'boarded' : null;
    if (scar) { for (const w of ws) inWindow(lib.scar(scar, { w: vx(w[3]), h: vx(w[4]) }), rot, w); return; }
    if (guards) for (const w of ws) inWindow(lib.security('gate', { style: 'bars', w: vx(w[3]), h: vx(w[4]) }), rot, w);
    if (!night) return;
    for (const w of ws) pane(w, rot, st.lit ? LIT : DARK, st.lit ? 3 : 1);
    const w = ws[0]; if (w && st.owner && (st.asleep || st.away)) inWindow(lib.windowCard(st.asleep ? 'zzz' : 'curtain', { w: vx(w[3]), h: vx(w[4]) }), rot, w); }
  // ── a ground parcel (house, trailer pad): a = { rot, face, door, sign, yard, wall, windows }. The door opening is 12 × 24 vx, 0.3 m up.
  function drawLot(a, st) {
    const rot = a.rot, [fx, fz] = a.face, dx = a.door[0] - fx * .55, dz = a.door[2] - fz * .55, zF = a.sign[1] + fz * .8, door = { w: 12, h: 24 };
    windows(a.windows || [], rot, st);
    if (st.forRent) onGround(lib.forRentSign({ style: 'lawn' }), rot, a.sign[0], a.sign[1]);
    if (st.sec.has('door')) put(lib.security('door', door), rot, dx, SIDE + .3, dz);
    if (st.sec.has('lock')) put(lib.security('lock', door), rot, dx, SIDE + .3, dz);
    if (st.sec.has('alarm')) { const [ax, az] = along(rot, -1.25); put(lib.security('camera'), rot, dx + ax, SIDE + 2.7, dz + az); }
    if (st.sec.has('safe')) { const [ax, az] = along(rot, 1.0); put(lib.security('safe'), rot, a.door[0] + ax, SIDE + .3, a.door[2] - fz * .1 + az); }   // on the porch, door out
    if (st.scars.has('boarded') || st.scars.has('burned')) put(lib.scar(st.scars.has('burned') ? 'burned' : 'boarded', { ...door, door: true }), rot, dx, SIDE + .3, dz);
    if (st.scars.has('foreclosed')) put(lib.scar('foreclosed', door), rot, dx, SIDE + .3, dz);
    if (st.scars.has('crime') && !scarHeld(st.id)) onGround(lib.scar('crimeScene'), rot, a.door[0], (a.door[2] + zF) / 2 + fz * .2);
    if (st.scars.has('memorial')) onGround(lib.scar('memorial'), rot, a.door[0] + along(rot, 1.6)[0], zF + fz * .65);   // on the sidewalk, its back to the picket fence
  }
  // ── a building with stacked units: b = { kind: 'walkup' | 'tower', rot, face, entrance: { door, stoop }, units: [{ id, floor, windows }] }
  // (SIM LIVE: a building in two parts — its units' windows, redrawn with every light, and its street door, redrawn only when what it
  // shows changes: the live layer draws them as two groups; drawBuilding draws both, in the same order as ever)
  const unitsOf = b => b.units.map(u => [u, model.homes.get(u.id)]).filter(([, s]) => s);
  function drawBuilding(b) { const list = unitsOf(b); if (!list.length && b.kind !== 'tower') return; drawUnits(b, list); drawEntrance(b, list); }
  function drawUnits(b, list = unitsOf(b)) {
    const rot = b.rot;
    for (const [u, st] of list) { windows(u.windows, rot, st, st.sec.has('lock') || st.sec.has('door'));
      if (st.forRent && u.windows[0]) inWindow(lib.forRentSign({ style: 'window' }), rot, u.windows[0]);
      if (st.sec.has('alarm') && u.windows[0]) { const w = u.windows[0], [x, y, z, r] = sill(w, rot), [ax, az] = along(r, -(w[3] / 2 + .4)); put(lib.security('camera'), r, x + ax, y + w[4] - .1, z + az); } } }
  function drawEntrance(b, list = unitsOf(b)) {
    const rot = b.rot, [fx, fz] = b.face; if (!list.length && b.kind !== 'tower') return;
    // the building's own street door: the doorman lobby for a tower; a buzzer (lock) and a steel door (door) for a walk-up
    const d = b.entrance.door, stoop = b.entrance.stoop, wx = d[0] - fx * (stoop ? 1.3 : .5), wz = d[2] - fz * (stoop ? 1.3 : .5), y0 = stoop ? SIDE + 1.2 : SIDE + .1;
    if (b.kind === 'tower') { put(lib.doormanLobby({ width: b.entrance.width ? vx(b.entrance.width) : 56, name: b.entrance.name, no: b.entrance.no }), rot, wx, b.entrance.door?.[1] ?? SIDE, wz); if (list.some(([, s]) => s.forRent)) { const [ax, az] = along(rot, -1.9); onGround(lib.forRentSign({ style: 'lobby' }), rot, wx + ax + fx * .7, wz + az + fz * .7); } return; }
    if (list.some(([, s]) => s.sec.has('lock'))) { const [ax, az] = along(rot, 1.0); put(lib.security('buzzer'), rot, wx + ax, y0 - .1 + 1.0, wz + az); }
    if (list.some(([, s]) => s.sec.has('door'))) put(lib.security('door', { w: 14, h: 24 }), rot, wx, y0, wz);
    if (list.some(([, s]) => s.scars.has('crime') && !scarHeld(s.id))) onGround(lib.scar('crimeScene', { w: 30, h: 16 }), rot, d[0] + fx * .6, d[2] + fz * .6);
    if (list.some(([, s]) => s.scars.has('memorial'))) { const [ax, az] = along(rot, 1.6); onGround(lib.scar('memorial'), rot, wx + ax + fx * .65, wz + az + fz * .65); }
  }
  function drawPile(p) { const ks = p.yields, lv = Math.min(1, p.level / (p.base + 10));
    ks.forEach((k, n) => onGround(lib.pile(k, lv), 0, p.x + (ks.length > 1 ? (n ? 2.7 : -2.7) : 0), p.z));
    if (p.spill) onGround(lib.pile(ks[0], .35), 1, p.x + 4.6, p.z + 2.2); }
  function drawPiles() { for (const p of model.piles.values()) drawPile(p); }
  function drawCorner(c) { const [cx, cz, rot, , , compact] = hotspotAt(c, cornerKits.has(c.id)); onGround(lib.hotspot(compact ? { heat: c.rush ? 1 : c.heat, compact } : { heat: c.rush ? 1 : c.heat }), rot, cx, cz); }   // (compact: a tight corner's set)
  function drawCorners() { for (const c of model.corners.values()) drawCorner(c); }
  function rebuild() {
    for (const m of meshes) disposeMesh(m); meshes = []; banks.clear(); if (!model) return;
    for (const [k, a] of anchors) { if (!isShown(k)) continue; for (const [id, l] of Object.entries(a.lots || {})) { const s = model.homes.get(id); if (s) drawLot(l, s); } for (const b of a.buildings || []) drawBuilding(b); }
    drawPiles(); drawCorners();
    for (const [k, b] of banks) { const [ci, cj] = k.split(',').map(Number), t = packMerged(b, [(ci + .5) * CELL, 0, (cj + .5) * CELL]); if (!t) continue; const m = meshOf(t, mats.tier, { cast: true }); m.userData.simstate = true; scene.add(m); meshes.push(m); }
    dirty = false;
  }
  // ── patrol cars on the road graph: every plan road segment, both ways, in the right-hand lane
  const nodes = new Map(), key = (a, b) => a + ',' + b, link = (a, b) => { const k = key(...a); if (!nodes.has(k)) nodes.set(k, []); nodes.get(k).push(b); };
  for (let L = -32; L <= 32; L++) for (let q = -32; q < 32; q++) { if (segX(L, q)) { link([L, q], [L, q + 1]); link([L, q + 1], [L, q]); } if (segZ(L, q)) { link([q, L], [q + 1, L]); link([q + 1, L], [q, L]); } }
  const carT = asBank(lib.patrolCar({ lights: night })), cars = new THREE.InstancedMesh(geometryOf(packMerged(carT, [0, 0, 0])), mats.tier, 8); cars.count = 0; cars.castShadow = true; cars.receiveShadow = true; cars.frustumCulled = false; scene.add(cars);
  const fleet = [], M4 = new THREE.Matrix4(), Qn = new THREE.Quaternion(), S3 = new THREE.Vector3(.01, .01, .01), V3 = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  let seq = 1; const rnd = () => { seq = (Math.imul(seq, 1664525) + 1013904223) >>> 0; return seq / 4294967296; };   // seeded: shots are repeatable
  const spawn = focus => { const ks = [...nodes.keys()].filter(n => { const [a, b] = n.split(',').map(Number); return Math.hypot(a * P - focus.x, b * P - focus.z) < 150; }); if (!ks.length) return null;
    const from = ks[(rnd() * ks.length) | 0].split(',').map(Number), nx = nodes.get(key(...from)); return { from, to: nx[(rnd() * nx.length) | 0], s: rnd() * 20, v: 6.5 + rnd() * 3 }; };
  function drive(c, dt) { c.s += c.v * dt; for (let L = Math.hypot(c.to[0] - c.from[0], c.to[1] - c.from[1]) * P; c.s >= L; L = P) { c.s -= L;
    const nx = (nodes.get(key(...c.to)) || []).filter(n => n[0] !== c.from[0] || n[1] !== c.from[1]); c.from = c.to; c.to = nx.length ? nx[(rnd() * nx.length) | 0] : c.from; } }
  function place(c, k) { const dx = c.to[0] - c.from[0], dz = c.to[1] - c.from[1], L = Math.hypot(dx, dz) || 1, ux = dx / L, uz = dz / L, lane = (dx ? isAve('z', c.from[1]) : isAve('x', c.from[0])) ? 1.5 : 1;
    const x = c.from[0] * P + ux * c.s - uz * lane, z = c.from[1] * P + uz * c.s + ux * lane; Qn.setFromAxisAngle(Y, Math.atan2(ux, uz)); V3.set(x, 0, z); M4.compose(V3, Qn, S3); cars.setMatrixAt(k, M4); return [x, z]; }
  // traffic pass · with the traffic sim (main.js setTraffic), the patrols ARE traffic: kind 'patrol' cars on its lanes, stopping at its
  // lights and following its cars (traffic/sim.js); they arrive and leave only out of view. This draws them where the sim has them.
  let tsim = null;
  function patrols(dt, focus) {
    if (tsim) { tsim.setPatrols(Math.min(8, model.patrols)); const list = tsim.patrols(); let k = 0;
      for (const c of list) { if (k >= 8) break; Qn.setFromAxisAngle(Y, c.h); V3.set(c.x, 0, c.z); M4.compose(V3, Qn, S3); cars.setMatrixAt(k++, M4); }
      fleet.length = 0; for (let q = 0; q < k; q++) fleet.push(list[q]); cars.count = k; cars.instanceMatrix.needsUpdate = true; return k > 0; }
    while (fleet.length < model.patrols) { const c = spawn(focus); if (!c) break; fleet.push(c); } fleet.length = Math.min(fleet.length, model.patrols);
    fleet.forEach((c, k) => { drive(c, Math.min(dt, .1)); const [x, z] = place(c, k); if (Math.hypot(x - focus.x, z - focus.z) > 260) { const n = spawn(focus); if (n) fleet[k] = n; } });
    cars.count = fleet.length; cars.instanceMatrix.needsUpdate = true; return fleet.length > 0; }

  // ── SIM LIVE pass · the incremental path (live: true). The same drawing as rebuild(), per GROUP: one home (a parcel, or a building with
  // its stacked units), a site's piles, a corner's hotspot. Each group is packed on its own and uploaded into ONE BatchedMesh of tier
  // geometry (the material rebuild()'s cell meshes use): its own geometry slot, reserved half as big again so a redraw of about the same
  // size lands in place and only that range goes to the GPU, and one instance at the group's origin (× 0.01: tier meshes are in cm).
  // One draw call for all of it. applyDiff() marks the groups a poll changed; update() redraws them within budgetMs, so a poll never
  // hitches the frame. flush() does everything now (shots).
  const G = new Map(), dirtyG = new Set(), homeKey = new Map(), shownOf = new Map(), blockGroups = new Map();   // (group keys: L|lot · B|building's units · E|its street door · pile:id · corner:id)
  const originOf = k => { if (k.startsWith('pile:')) { const p = model.piles.get(k.slice(5)); return [p.x, 0, p.z]; } if (k.startsWith('corner:')) { const c = model.corners.get(k.slice(7)); return [c.x, 0, c.z]; }
    const [i, j] = G.get(k).block.split(/[,_]/).map(Number); return [(i + .5) * P, 0, (j + .5) * P]; };
  // a group is redrawn only when what it shows changed (stale); a block that goes out of view and comes back just hides and shows its groups
  const markGroup = (k, block) => { let g = G.get(k); if (!g) G.set(k, g = { k, block }); g.stale = true; dirtyG.add(g); };
  const showGroup = g => { if (g.block && !isShown(g.block)) { if (g.inst !== undefined) BM.setVisibleAt(g.inst, false); return; } if (g.stale || g.geo === undefined) dirtyG.add(g); else if (g.inst !== undefined) BM.setVisibleAt(g.inst, !g.empty); };
  const markBlock = bk => { for (const k of blockGroups.get(bk) || []) { const g = G.get(k); if (g) showGroup(g); } };
  const doorSig = st => `${st.forRent ? 1 : 0}${st.sec.has('lock') ? 1 : 0}${st.sec.has('door') ? 1 : 0}${st.scars.has('crime') ? 1 : 0}${st.scars.has('memorial') ? 1 : 0}`;
  const LS = { groups: 0, frames: 0, workMs: [], maxMs: 0, groupMax: 0, grows: 0, compacts: 0, vertices: 0 };   // (?bench=1: the live layer's per-frame cost)
  let BM = null, cap = { v: 0, i: 0 }; const M4b = new THREE.Matrix4(), Qb = new THREE.Quaternion(), Pb = new THREE.Vector3(), Sb = new THREE.Vector3(.01, .01, .01);
  function addGeo(geo, rv, ri) {
    if (!BM) { cap = { v: Math.max(1 << 19, rv * 4), i: Math.max(3 << 18, ri * 4) }; BM = new THREE.BatchedMesh(4096, cap.v, cap.i, mats.tier);
      Object.assign(BM, { castShadow: true, receiveShadow: true, sortObjects: false, perObjectFrustumCulled: true, frustumCulled: false }); BM.userData.simstate = true; scene.add(BM); }
    try { return BM.addGeometry(geo, rv, ri); } catch {}
    BM.optimize(); LS.compacts++; try { return BM.addGeometry(geo, rv, ri); } catch {}   // (reclaim the slots of groups that outgrew theirs)
    cap = { v: Math.ceil((cap.v + rv) * 1.5), i: Math.ceil((cap.i + ri) * 1.5) }; BM.setGeometrySize(cap.v, cap.i); LS.grows++; return BM.addGeometry(geo, rv, ri); }
  function upload(g, t) {
    if (!t) { if (g.inst !== undefined) BM.setVisibleAt(g.inst, false); return; }
    const geo = geometryOf(t), nv = geo.attributes.position.count, ni = geo.index.count;
    if (g.geo !== undefined && nv <= g.rv && ni <= g.ri) BM.setGeometryAt(g.geo, geo);
    else { if (g.geo !== undefined) { BM.deleteGeometry(g.geo); g.inst = undefined; }   // (deleting a geometry deletes its instances)
      g.rv = Math.ceil(nv * 1.5) + 64; g.ri = Math.ceil(ni * 1.5) + 96; g.geo = addGeo(geo, g.rv, g.ri); }
    if (g.inst === undefined) g.inst = BM.addInstance(g.geo);
    Pb.set(t.o[0], t.o[1], t.o[2]); M4b.compose(Pb, Qb, Sb); BM.setMatrixAt(g.inst, M4b); BM.setVisibleAt(g.inst, true); geo.dispose(); LS.vertices = Math.max(LS.vertices, cap.v); }
  function drawGroup(g) {
    if (g.block && !isShown(g.block)) { dirtyG.delete(g); if (g.inst !== undefined) BM.setVisibleAt(g.inst, false); return; }   // (out of view: drawn when it comes back, still stale)
    const t0 = performance.now(), b = new Bank(true); target = b;
    try { if (g.k.startsWith('pile:')) { const p = model.piles.get(g.k.slice(5)); if (p) drawPile(p); }
      else if (g.k.startsWith('corner:')) { const c = model.corners.get(g.k.slice(7)); if (c) drawCorner(c); }
      else { const a = anchors.get(g.block), id = g.k.slice(2); if (a && isShown(g.block)) { if (g.k[0] === 'L') { const l = a.lots?.[id], st = model.homes.get(id); if (l && st) drawLot(l, st); }
        else { const bd = (a.buildings || []).find(b => b.id === id); if (bd) { const list = unitsOf(bd); if (list.length || bd.kind === 'tower') g.k[0] === 'B' ? drawUnits(bd, list) : drawEntrance(bd, list); } } } } }
    finally { target = null; }
    const tier = packMerged(b, originOf(g.k)) || null; upload(g, tier); g.stale = false; g.empty = !tier; dirtyG.delete(g); LS.groups++;
    const ms = performance.now() - t0; if (ms > LS.groupMax) { LS.groupMax = ms; LS.groupMaxKey = g.k; } }
  function liveWork(budget) {
    if (!model) return; const t0 = performance.now();
    for (const g of dirtyG) { if (performance.now() - t0 > budget) break; drawGroup(g); }
    const ms = performance.now() - t0; if (ms > .01) { LS.frames++; LS.workMs.push(ms); if (LS.workMs.length > 600) LS.workMs.shift(); LS.maxMs = Math.max(LS.maxMs, ms); } }
  function applyDiff(d) {
    model ??= { homes: new Map(), piles: new Map(), corners: new Map(), patrols: 0, crowd: null };
    for (const h of d.homes || []) { const was = model.homes.get(h.id), st = { ...h, sec: new Set(h.sec), scars: new Set(h.scars) }; model.homes.set(h.id, st);
      if (stage && was && !was.scars.has('crime') && st.scars.has('crime')) { const ms = stage.newScar?.(h.id); if (ms > 0) holdScar(h.id, ms); }   // (STAGE: the burglary plays first)
      const k = homeKey.get(h.id); if (!k) continue; markGroup(k);
      if (k[0] === 'B' && (!was || doorSig(was) !== doorSig(st))) markGroup('E' + k.slice(1)); }   // (a building's street door only when what it shows changed)
    for (const p of d.piles || []) { model.piles.set(p.id, p); markGroup('pile:' + p.id); }
    for (const c of d.corners || []) { model.corners.set(c.id, c); markGroup('corner:' + c.id); }
    if (d.patrols !== undefined) model.patrols = d.patrols; if (d.crowd) model.crowd = d.crowd; model.rush = d.rush ?? null; model.clock = d.clock ?? model.clock; }

  function holdScar(id, ms) { const until = performance.now() + ms, had = scarHolds.has(id); scarHolds.set(id, Math.max(scarHolds.get(id) || 0, until)); if (!had) redrawHome(id); }
  function redrawHome(id) { const k = homeKey.get(id); if (!k || !live) { dirty = true; return; } markGroup(k); if (k[0] === 'B') markGroup('E' + k.slice(1)); }
  function releaseScars() { if (!scarHolds.size) return; const now = performance.now(); for (const [id, t] of scarHolds) if (now >= t) { scarHolds.delete(id); redrawHome(id); } }
  // where a home's door, windows and alarm are (the anchors' own numbers): a lot → { kind: 'lot', door, face, rot, windows, alarm }; a
  // stacked unit → { kind: 'unit', door (the street door), face, rot, windows }; null when its block hasn't handed its anchors back
  function homeAt(id) { for (const a of anchors.values()) { const l = a?.lots?.[id];
      if (l) { const [fx, fz] = l.face, dx = l.door[0] - fx * .55, dz = l.door[2] - fz * .55, [ax, az] = along(l.rot, -1.25); return { kind: 'lot', door: l.door, face: l.face, rot: l.rot, windows: l.windows || [], alarm: [dx + ax, SIDE + 2.7, dz + az] }; }
      for (const b of a?.buildings || []) { const u = (b.units || []).find(u => u.id === id); if (u) return { kind: 'unit', door: b.entrance?.door, face: b.face, rot: b.rot, windows: u.windows || [], alarm: null }; } }
    return null; }
  // one piece of the library as a mesh of its own, origin at its base (a street memorial where someone died)
  function pieceMesh(name, args = [], rot = 0) { const f = lib[name]; if (typeof f !== 'function') return null; const t = asBank(f(...args)); if (!t) return null;
    const b = new Bank(true); stamp(t, b, rot & 3, 0, 0, 0); const tier = packMerged(b, [0, 0, 0]); return tier ? meshOf(tier, mats.tier, { cast: true }) : null; }
  let tick = 0;
  return {
    homeAt, holdScar, pieceMesh, setStage(s) { stage = s; },
    get model() { return model; }, anchors, cars,
    setModel(m) { model = m; dirty = true; }, setTraffic(t) { tsim = t; fleet.length = 0; },
    addAnchors(k, a) { anchors.set(k, a); if (!live) { dirty = true; return; }
      const keys = []; for (const id of Object.keys(a?.lots || {})) { homeKey.set(id, 'L|' + id); keys.push('L|' + id); } for (const b of a?.buildings || []) { for (const u of b.units || []) homeKey.set(u.id, 'B|' + b.id); keys.push('B|' + b.id, 'E|' + b.id); }
      blockGroups.set(k, keys); for (const g of keys) markGroup(g, k); },
    update(dt, focus) {
      releaseScars();
      if (live) {   // (SIM LIVE: a block that goes near / mid, or leaves, redraws just its own group)
        if (++tick % 30 === 0) for (const k of anchors.keys()) { const s = !!isShown(k); if (shownOf.get(k) !== s) { shownOf.set(k, s); markBlock(k); } }
        liveWork(budgetMs); if (!model) { cars.count = 0; tsim?.setPatrols(0); return false; } return patrols(dt, focus); }
      if (++tick % 30 === 0) { const sk = [...anchors.keys()].filter(isShown).join('|'); if (sk !== shownKey) { shownKey = sk; dirty = true; } }   // a block went near / mid (or left)
      if (dirty) rebuild(); if (!model) { cars.count = 0; tsim?.setPatrols(0); return false; }
      return patrols(dt, focus); },
    applyDiff, flush: () => { for (const k of anchors.keys()) { const s = !!isShown(k); if (shownOf.get(k) !== s) { shownOf.set(k, s); markBlock(k); } } liveWork(Infinity); },
    pieceMs: () => ({ ...PC }), resetStats: () => { LS.workMs.length = 0; LS.maxMs = 0; LS.groupMax = 0; LS.groups = 0; LS.frames = 0; },   // (?bench=1: the steady state, after the first flood)
    pending: () => dirtyG.size, liveStats: () => ({ ...LS, workMs: undefined, p50: q(LS.workMs, .5), p95: q(LS.workMs, .95), groupsNow: G.size, groupMax: +LS.groupMax.toFixed(2), maxMs: +LS.maxMs.toFixed(2) }),
    counts: () => ({ meshes: live ? (BM ? 1 : 0) : meshes.length, anchored: anchors.size, cars: fleet.length }),
    rebuild: () => rebuild(),
  };
}
const q = (a, p) => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return +s[Math.min(s.length - 1, Math.floor(s.length * p))].toFixed(3); };
