// THE YARDS · the spec pass (owner: the supply agent). Pure: block → parcels (buildings and yards) with rects, kinds, heights, colours
// and names, so the full build (industrial.js build) and the far tier (far) always agree. The names come from one allocation over the
// whole district in a fixed order, so no company, number or warning is painted twice (names.js).
import { blockAt, kindAt, distOf } from '../../plan.js';
import { neutralAt } from '../../neutral.js';
import { C, WALLS, NEUTRALS, H, pickH, allocator, clamp } from './lib.js';
import { DECKS } from './names.js';

export const HERO_BLOCKS = new Set(['2_-6', '3_-7']);            // the chop shop on Maple & Foundry, the foundry across the street
const AVENUE = { '-z': j => j === -7, '+z': j => j === -8 || j === -5, '-x': i => i === 0 || i === 4, '+x': i => i === -1 || i === 3 };
const OPP = { '-z': '+z', '+z': '-z', '-x': '+x', '+x': '-x' };
// the local frame of a block seen from its main street: u along the street (left → right), v inward from the property line
export function frameOf(R, m) {
  const W = R.x1 - R.x0, D = R.z1 - R.z0, Wm = m[1] === 'z' ? W : D, Dm = m[1] === 'z' ? D : W;
  const side = { '-z': { left: '+x', right: '-x' }, '+z': { left: '-x', right: '+x' }, '-x': { left: '-z', right: '+z' }, '+x': { left: '+z', right: '-z' } }[m];
  const rect = (u0, v0, u1, v1) => { const r = m === '-z' ? [R.x1 - u1, R.z0 + v0, R.x1 - u0, R.z0 + v1] : m === '+z' ? [R.x0 + u0, R.z1 - v1, R.x0 + u1, R.z1 - v0]
    : m === '-x' ? [R.x0 + v0, R.z0 + u0, R.x0 + v1, R.z0 + u1] : [R.x1 - v1, R.z1 - u1, R.x1 - v0, R.z1 - u0]; return r.map(v => Math.round(v * 10) / 10); };
  return { W: Wm, D: Dm, rect, front: m, back: OPP[m], left: side.left, right: side.right };
}
const snap = v => Math.round(v * 2) / 2;

// ── the district's blocks in plan order (north → south, west → east), heroes excluded
export function yardsBlocks() { const out = []; for (let j = -8; j <= -5; j++) for (let i = -2; i <= 6; i++) if (distOf(kindAt(i, j)) === 'industrial') out.push([i, j]); return out; }
const TEMPLATES = ['court', 'pair', 'big', 'yard', 'corner', 'vacant'];
const WATER = { '-2_-8': 'aggregate', '-1_-8': 'court', '5_-8': 'salt', '6_-8': 'tanks' };
let PLANS = null; const BLADES = new Set();
export function yardsPlan(K) { if (PLANS) return PLANS; PLANS = new Map(); const take = allocator(DECKS); let dockNo = 1, bayNo = 1, addr = 301;
  const nums = { dock: () => 'DOCK ' + dockNo++, bay: () => 'BAY ' + bayNo++, addr: () => 'No ' + (addr += 2 + ((addr * 7) % 5)) };
  const tpl = new Map();
  // shipping lines: the docks own the first fourteen; the Yards stacks draw from the rest
  for (let n = 0; n < 14; n++) take('lines', 'docks');
  for (const [i, j] of yardsBlocks()) { const key = i + '_' + j; if (HERO_BLOCKS.has(key)) { PLANS.set(key, { hero: true }); continue; }
    let t = WATER[key]; if (!t) { const west = tpl.get((i - 1) + '_' + j), north = tpl.get(i + '_' + (j - 1)); let k = (H(i * 31 + 7, j * 17 + 3, 11) * TEMPLATES.length) | 0;
      for (let g = 0; g < TEMPLATES.length && (TEMPLATES[k] === west || TEMPLATES[k] === north || (TEMPLATES[k] === 'vacant' && (i + j) % 3 !== 0)); g++) k = (k + 1) % TEMPLATES.length; t = TEMPLATES[k]; }
    tpl.set(key, t); PLANS.set(key, planBlock(i, j, t, take, nums, K)); }
  return PLANS; }

// ── colour: one flat wall per building, the neutral mix by the kit's fields, never the neighbour's colour
function wallFor(K, x, z, seed, prev, kind) {
  const neutral = K ? neutralAt(K, x, z, H(seed, 5)) : H(seed, 5) < .35;
  const pool = neutral ? (kind === 'brick' ? [C.brick, C.brick, C.buff, C.white, C.slate] : kind === 'cold' ? [C.white, C.bone, C.pale] : NEUTRALS) : WALLS;
  let c = pool[(H(seed, 6) * pool.length) | 0]; for (let g = 0; g < 4 && prev.includes(c); g++) c = pool[(H(seed, 7 + g) * pool.length) | 0]; return c;
}
const trimFor = (wall, seed) => wall === C.brick || wall === C.buff ? pickH([C.cream, C.chalk, C.concL], seed, 8) : NEUTRALS.includes(wall) ? pickH([C.ink, C.slate, C.cobalt, C.red], seed, 8) : pickH([C.chalk, C.cream, C.ink], seed, 8);
const DOORS = [C.red, C.cobalt, C.green, C.yellow, C.orange, C.teal, C.grey, C.slate, C.pink];

function planBlock(i, j, t, take, nums, K) {
  const b = blockAt(i, j), R = b.R, streets = Object.keys(b.F).filter(s => b.F[s]), seed = (i + 50) * 977 + (j + 50) * 131;
  const avenues = streets.filter(s => AVENUE[s](s[1] === 'z' ? j : i)), main = avenues.length ? avenues[(H(seed, 1) * avenues.length) | 0] : streets[(H(seed, 2) * streets.length) | 0];
  const L = frameOf(R, main), onStreet = s => streets.includes(s), P = { i, j, key: i + '_' + j, R, main, t, parcels: [], yards: [], seed }, prev = [];
  // a parcel in local coordinates → world rect + the world sides it shows to a street (or to its own court)
  const parcel = (kind, u0, v0, u1, v1, o = {}) => { u0 = snap(u0); v0 = snap(v0); u1 = snap(u1); v1 = snap(v1); const [x0, z0, x1, z1] = L.rect(u0, v0, u1, v1), faces = [];
    if (v0 <= 0.01 && onStreet(L.front)) faces.push(L.front); if (v1 >= L.D - .01 && onStreet(L.back)) faces.push(L.back);
    if (u0 <= 0.01 && onStreet(L.left)) faces.push(L.left); if (u1 >= L.W - .01 && onStreet(L.right)) faces.push(L.right);
    for (const k of [o.court, o.dock]) if (k && !faces.includes(k)) faces.push(k);
    const s = { kind, x0, z0, x1, z1, faces, main: o.main ?? (faces.includes(L.front) ? L.front : faces[0] ?? L.front), seed: seed + P.parcels.length * 37 + 11, ...o };
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2; s.wall = o.wall ?? wallFor(K, cx, cz, s.seed, prev, kind); prev.push(s.wall); s.trim = trimFor(s.wall, s.seed);
    s.door = pickH(DOORS.filter(c => c !== s.wall), s.seed, 21); s.door2 = pickH([C.ink, C.green, C.red, C.cobalt, C.slate].filter(c => c !== s.wall), s.seed, 22);
    s.font = o.font ?? (kind === 'brick' ? pickH(['serif', 'px', 'serif', 'impact'], s.seed, 23) : kind === 'cold' ? pickH(['impact', 'px'], s.seed, 23) : kind === 'shed' || kind === 'sawtooth' ? pickH(['px', 'impact', 'stencil'], s.seed, 23) : 'px');
    s.name = o.name ?? take({ brick: 'warehouse', shed: 'shed', sawtooth: 'shed', cold: 'cold', garage: 'auto', quonset: 'shed', front: 'small' }[kind], P.key);
    if (kind === 'brick' || kind === 'cold') { s.sub = nums.addr(); s.dockNums = []; s.gradeNums = []; }
    if (s.dock) s.dockNums = [nums.dock(), nums.dock(), nums.dock()]; if (kind !== 'front') s.gradeNums = [nums.bay()];
    if (H(s.seed, 24) < .3) s.plate = take('warn', P.key);
    if ((kind === 'brick' && (o.st ?? 0) >= 3) || (kind === 'front' && (o.st ?? 2) >= 2)) { const w = s.name.split(/[ &·]+/).filter(t => t.length >= 3 && t.length <= 7 && !BLADES.has(t)).sort((p, q) => q.length - p.length)[0]; if (w) { BLADES.add(w); s.blade = w; s.bladeBg = pickH([C.red, C.cobalt, C.green, C.ink, C.teal], s.seed, 26); } }
    s.roofCol = pickH([0xefeee9, 0xdcd8cf, 0xd2d3d6, 0xc9c0b0, 0xb8b5ae, 0x5c5b62, 0xa9a7a4], s.seed, 25);
    P.parcels.push(s); return s; };
  const yard = (kind, u0, v0, u1, v1, o = {}) => { u0 = snap(u0); v0 = snap(v0); u1 = snap(u1); v1 = snap(v1); const [x0, z0, x1, z1] = L.rect(u0, v0, u1, v1), fence = [];
    if (v0 <= .01 && onStreet(L.front)) fence.push(L.front); if (v1 >= L.D - .01 && onStreet(L.back)) fence.push(L.back); if (u0 <= .01 && onStreet(L.left)) fence.push(L.left); if (u1 >= L.W - .01 && onStreet(L.right)) fence.push(L.right);
    const y = { kind, x0, z0, x1, z1, fence, gate: o.gate ?? fence[0] ?? null, seed: seed + 500 + P.yards.length * 41, ...o };
    y.sign = o.sign ?? (kind === 'trucks' ? take('trucking', P.key) : kind === 'materials' || kind === 'aggregate' ? take('yard', P.key) : kind === 'tow' ? take('auto', P.key) : null);
    if (fence.length && H(y.seed, 4) < .6) y.warn = take('warn', P.key);
    if (kind === 'containers') y.lines = [take('lines', P.key)[0], take('lines', P.key)[0]]; if (kind === 'court') y.truckName = take('trucking', P.key);
    if (kind === 'vacant') { y.lease = take('lease', P.key); y.phone = '555-' + String(1000 + ((y.seed * 7919) % 9000)).padStart(4, '0'); }
    if (kind === 'salt') y.saltSign = 'ROAD SALT'; if (kind === 'tanks') { y.tankNames = ['TANK 1', 'TANK 2', 'TANK 3']; y.sign = take('fuel', P.key); }
    y.fenceKind = o.fenceKind ?? pickH(['chain', 'chain', 'panel', 'wall'], y.seed, 3); P.yards.push(y); return y; };
  const W = L.W, D = L.D, h = k => H(seed, 40 + k);
  if (t === 'court') { const dv = snap(D * (.42 + h(1) * .1)), k = h(2) < .45 ? 'brick' : h(2) < .75 ? 'cold' : 'shed';
    parcel(k, 0, dv, W, D, { st: 2 + ((h(3) * 3) | 0), hv: 110 + ((h(3) * 4) | 0) * 10, dock: L.front, main: onStreet(L.back) ? L.back : undefined, court: L.front, win: h(4) < .5 ? 'pair' : 'one', arch: h(5) < .5 });
    yard('court', 0, 0, W, dv, { gate: L.front }); }
  else if (t === 'pair') { const su = snap(W * (.42 + h(1) * .16)), da = D * (h(2) < .5 ? 1 : .72), db = D * (h(3) < .5 ? 1 : .64);
    const ka = h(4) < .5 ? 'brick' : 'garage', kb = ka === 'brick' ? (h(5) < .5 ? 'shed' : 'sawtooth') : 'brick';
    parcel(ka, 0, 0, su, da, { st: ka === 'brick' ? 3 + ((h(6) * 3) | 0) : 1 + (h(6) < .4 ? 1 : 0), win: 'pair', arch: h(7) < .6, bays: 2 + (h(8) < .5 ? 1 : 0), sign: pickH([C.yellow, C.red, C.cobalt, C.green], seed, 9) });
    parcel(kb, su, 0, W, db, { st: kb === 'brick' ? 2 + ((h(10) * 2) | 0) : 1, hw: 56 + ((h(11) * 3) | 0) * 6, teeth: 3 + (h(12) < .5 ? 1 : 0) });
    if (da < D) yard(h(13) < .5 ? 'parking' : 'materials', 0, da, su, D); if (db < D) yard(h(14) < .5 ? 'materials' : 'trucks', su, db, W, D); }
  else if (t === 'big') { const k = h(1) < .55 ? 'sawtooth' : 'brick', back = onStreet(L.back), apron = back && k === 'brick' ? 9.6 : 5.5;
    parcel(k, 0, 0, W, D - apron, { st: 2 + ((h(2) * 2) | 0), hw: 52 + ((h(3) * 3) | 0) * 4, teeth: 4 + (h(4) < .4 ? 1 : 0), dock: back ? L.back : undefined, win: 'one', arch: true });
    yard(back ? 'trucks' : 'parking', 0, D - apron, W, D, { gate: back ? L.back : null }); }
  else if (t === 'yard') { const su = snap(W * (.56 + h(1) * .12)), kinds = ['containers', 'materials', 'trucks', 'tow'], yk = kinds[(h(2) * 4) | 0];
    yard(yk, 0, 0, su, D, { gate: L.front });
    const k = h(3) < .4 ? 'quonset' : h(3) < .75 ? 'shed' : 'garage'; parcel(k, su, 0, W, k === 'garage' ? D * .55 : D, { hw: 54 + ((h(4) * 3) | 0) * 6, st: 1, bays: 1, sign: pickH([C.red, C.yellow, C.green], seed, 5) });
    if (k === 'garage') yard('parking', su, D * .55, W, D); }
  else if (t === 'corner') { const cu = 7 + ((h(1) * 3) | 0), cv = 8 + ((h(2) * 3) | 0);
    parcel('front', 0, 0, cu, cv, { st: 2 + (h(3) < .4 ? 1 : 0), sign: pickH([C.red, C.green, C.yellow, C.cobalt, C.pink], seed, 4), neon: h(5) < .6, awning: h(6) < .5 ? pickH([C.red, C.green, C.cobalt], seed, 7) : null });
    parcel('garage', cu, 0, W, cv + 2, { st: 1 + (h(8) < .35 ? 1 : 0), bays: 3, sign: pickH([C.yellow, C.cobalt, C.red, C.green, C.orange], seed, 10) });
    const k = h(11) < .5 ? 'shed' : 'brick'; if (h(12) < .55) parcel(k, 0, cv + 2 + .5, W, D, { st: 2, hw: 58, win: 'one' }); else { yard(h(13) < .5 ? 'tow' : 'materials', 0, cv + 2 + .5, W, D); } }
  else if (t === 'vacant') { const su = snap(W * (.5 + h(1) * .12));
    yard('vacant', 0, 0, su, D, { fenceKind: 'chain' });
    parcel('brick', su, 0, W, D, { st: 3 + ((h(2) * 2) | 0), win: 'pair', arch: true }); }
  else if (t === 'aggregate') { const su = snap(W * .62); yard('aggregate', 0, 0, W, D * .64, { gate: L.front, fenceKind: 'wall' }); parcel('quonset', su, D * .64 + .5, W, D, { hw: 50 }); yard('parking', 0, D * .64 + .5, su, D); }
  else if (t === 'salt') { yard('salt', 0, 0, W, D * .7, { gate: L.front, fenceKind: 'chain' }); parcel('shed', 0, D * .7 + .5, W, D, { hw: 50 }); }
  else if (t === 'tanks') { yard('tanks', 0, 0, W, D, { gate: L.front, fenceKind: 'chain' }); }
  // roof pieces: the largest flat roof gets one, a second one ≥ 10.5 m away half the time
  const flat = P.parcels.filter(s => ['brick', 'cold', 'garage', 'front'].includes(s.kind) && (s.x1 - s.x0) >= 6 && (s.z1 - s.z0) >= 6).sort((p, q) => (q.x1 - q.x0) * (q.z1 - q.z0) - (p.x1 - p.x0) * (p.z1 - p.z0));
  const PIECES = ['letters', 'cooler', 'boxoffice', 'grow', 'hoops', 'coop', 'letters'];
  flat.slice(0, 2).forEach((s, k) => { if (k === 1 && (H(seed, 60) < .5 || Math.hypot((s.x0 + s.x1) / 2 - (flat[0].x0 + flat[0].x1) / 2, (s.z0 + s.z1) / 2 - (flat[0].z0 + flat[0].z1) / 2) < 10.5)) return;
    const kind = PIECES[((H(seed, 61 + k) * PIECES.length) | 0)]; s.piece = { kind, seed: s.seed * 3 + k, col: pickH([C.yellow, C.pink, C.cobalt, C.green, C.orange, C.teal, C.red, C.violet], s.seed, 62 + k) };
    if (kind === 'letters') s.piece.text = take('roof', P.key); });
  return P;
}
