// AI City · HOME LIFE (2026-10-06) · "wouldn't it be nice to see your agent walking around the house, kinda sims like". The house's agent
// lives in it: one resident per home in a stable cast look (cast.js rollLook, seeded by the plot; later the owner's minted character),
// going about a day between ACTIVITY SPOTS read off the layout's own furniture. Main thread (three + DOM); one character, cheap.
//   SPOTS      spotsOf(A, fills, room) reads every placed piece (and every filled slot, and the garage's car) by its catalogue category,
//              id and tags (home/index.js), so any layout works, the presets and a layout the owner edited alike:
//                bed → sleep · stove / cook rig / hot plate → cook · fridge → a snack · a table with seats → eat · toilet → the toilet,
//                then the sink → wash · a seat facing a TV → TV (and game, if the house has a console), any other seat → chill ·
//                arcade cab → arcade · music → nod along · trophies → admire them · collectibles, collectible art, the family photos,
//                plinths, the fish tank → admire · stash spots and safes → check the stash · dresser, wardrobe, mirror, rack → get
//                dressed · bookshelf → read · floor plants · the car in the garage → admire it · tags 'weights' / 'gym' → lift (none in
//                the catalogue yet) · and wander (the phone in the hall) when nothing else calls
//              A spot is where the walker stands (a free cell in front of the piece, facing it) and, for a seat or a bed, where it sits or
//              lies (the piece's own seat height; the dining set's four chairs; a long sofa's two places).
//   MOVING     A* on the room's 0.25 m floor grid with a 2 × 2-cell walker (the homes check's own: home/rules.js geometry, so partition
//              walls, the car bay and floor slots are solid and the open front is the hall), dearer next to anything solid, string-pulled
//              and walked on rounded corners (anim/turn.js) in the cast's walk (anim/cast/walk2.js, gait2.js: the city's walker, one
//              BatchedMesh, one animation texel row) with its idles (anim/cast/idle.js: arms behind the back at the trophies, a look
//              round at the stash, a nod to the music, the phone in the hall). Sitting, lying and working (cooking, washing, the arcade)
//              swap to the same look built as a chars.js rig (cast.js build: the city's sitters and sleepers), posed on the CPU.
//   THE DAY    Sims-style needs (hunger, bladder, fun, hygiene, pride, money) run down; each spot's activity advertises what it gives and
//              the resident does what it needs most (with a little chance, nothing twice in a row, nearer is better). Cooking leads to
//              eating, the toilet to the sink. At night it sleeps, eyes shut, z Z over the pillow, and now and then gets up for a snack
//              or the toilet and goes back to bed. A little bubble now and then, never text: PIXEL ICONS from the city (bubbles.js),
//              by the activity and the piece (counting the banded cash at the stash, a pot on the boil, a slice, the TV's flicker, a
//              pad, a boombox, a hi-top at the sneaker wall, keys spinning by the whip, a bulb and the heist map at night), now and
//              then a two-icon thought (cash › sneaker: saving up for a pair); asleep, pixel z's and now and then a dream (the whip).
//   EDITING    the resident is not in the homes check, so it never blocks placement (and the builder's picking only sees its own views).
//              setLayout() re-plans: a moved piece it was using or heading for → a pixel "?" and it goes to the new place; a stored
//              piece → something else; a piece put down on top of it → it hops aside. held(id): the builder has lifted a piece it is
//              sitting on → it stands up (a pixel "!") and waits.
//   createLife({ parent, origin, A, fills, room, seed, look, night, dom, camera, renderer }) → Promise<life>
//     parent    the scene (or any group): the resident's group goes in it at `origin`, the room's back-left floor corner
//     A, fills  the layout (assembly format, FORMAT.md) and each slot's piece (or null) · room: { W, D, H, ox } (room.js buildRoom's)
//     seed      the home's seed (the look and the day's dice) · look: a cast look to use instead (the owner's character)
//     dom       an element over the canvas for the bubbles (position: relative or fixed) · camera, renderer: for placing them
//   life: { group, update(dt), setLayout(A, fills, room?, origin?), setNight(on), held(id | null), go(act), say(icon | [a, b]), state(), dispose() }
//   Reusable as is in the city's home cutaways (index.js): its walker material skips gpu.js's CUT (it stands inside the cut).
import * as THREE from 'three';
import * as HO from '../home/index.js';
import { makeRules, rectOf, C4 } from '../home/rules.js';
import * as C from '../../cast.js';
import { tierize } from '../../gpu.js';
import { bakeSegFull } from '../../anim/cast/bake.js';
import { WALK2, createAnimTexture2, animUniforms2, writeGait2, installAnim2 } from '../../anim/cast/walk2.js';
import { gait2State, stepGait2 } from '../../anim/cast/gait2.js';
import { IDLE, stepIdle } from '../../anim/cast/idle.js';
import { createFineAtlas, installFine, fineAttr } from '../../anim/cast/fine.js';
import { turnToward, wrapPi, roundedPath } from '../../anim/turn.js';
import { createBubbles } from './bubbles.js';

const RULES = makeRules(HO);
const FR = [[0, 1], [1, 0], [0, -1], [-1, 0]];   // a piece's front for its quarter turn (room.js / vox.js stamp: rot 90 faces +x)
const yawOf = (dx, dz) => Math.atan2(dx, dz);   // the walker faces +z at yaw 0
// a point in a piece's own frame (u across its foot[0], v deep toward its front; metres) → room metres, for a piece at X, Z turned r
const toRoom = (F, u, v) => { const { X, Z, w, d, r } = F; return r === 0 ? [X + u, Z + v] : r === 1 ? [X + v, Z + w - u] : r === 2 ? [X + w - u, Z + d - v] : [X + d - v, Z + u]; };
const dirRoom = (r, du, dv) => r === 0 ? [du, dv] : r === 1 ? [dv, -du] : r === 2 ? [-du, -dv] : [-dv, du];
const ease = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
const lerp = (a, b, t) => a + (b - a) * t;
const HEADK = .84, SIT_DROP = .47, WALK_V = 1.1;   // the sleeper's head (index.js) · seat top → the rig's root · indoor walking speed (m/s)

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
// the piece itself says what it is: a hi-top at the sneaker wall, a graded card, a vinyl toy, the fish (by catalogue id; first match)
const PIECE_ICONS = [[/sneaker|grails/, ['sneaker', 'glint'], [['cash', 'sneaker']]], [/cap-wall|streetwear/, ['cap', 'sneaker']], [/chain|watch|grill/, ['chain', 'glint']],
  [/card/, ['card', 'glint']], [/vinyl|toy|blindbox/, ['toy', 'glint']], [/duffel/, ['duffel', 'cash']], [/cash|money|counterfeit/, ['cash', 'glint']],
  [/^(art|frame|photos|poster|jersey)/, ['frame', 'glint']], [/fish/, ['fish']], [/crown|kingpin/, ['crown', 'trophy']], [/turntable/, ['record', 'notes']],
  [/boombox/, ['boombox', 'notes']], [/speaker/, ['notes', 'boombox']]];
const DREAMS = ['cash', 'whip', 'crown', 'chain', 'sneaker', 'duffel', 'map'];
const NEEDS = { hunger: .011, bladder: .007, fun: .016, hygiene: .005, pride: .009, money: .004 };   // run down per second (by day)
const COLLECT_ART = new Set(['photos-family']);   // base art worth a look (collectible art always is)

// what a catalogue piece offers (categories first, so a new piece of a known kind just works)
function actsOf(o) {
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
const isTV = o => (o.cat === 'electronics' && (o.tags ?? []).includes('tv')) || o.id === 'gaming-setup';
// a seat's places in its own frame: [u, v, facing (local, rad: 0 = the piece's front)] (metres), and its seat height
function seatsOf(o) {
  const w = o.foot[0] * C4, d = o.foot[1] * C4;
  if (o.id === 'dining-set') return [[.2, .75, Math.PI / 2], [1.8, .75, -Math.PI / 2], [1, .2, 0], [1, 1.3, Math.PI]];   // (extras.js: its four chairs)
  if (o.id === 'toilet') return [[w / 2, .3, 0]];
  if (o.id === 'beanbag') return [[w / 2, d * .5, 0]];
  if (o.id === 'stool-bar') return [[w / 2, d / 2, 0]];
  if (w >= 1.6) return [[w * .3, d * .44, 0], [w * .7, d * .44, 0]];   // a sofa: two places
  return [[w / 2, d * .45, 0]];
}

// ── the frames: where a piece stands in the room (the box in room metres, its front, a frame for toRoom)
function frameOf(it, o, A, room) {
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
function frontOf(F, gap) { const b = F.box, o = F.own ?? b, cx = (o[0] + o[2]) / 2, cz = (o[1] + o[3]) / 2, [fx, fz] = FR[F.r];
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
function gridOf(A, fills) {
  const R = A.room, RW = R.w, RD = R.d, g = RULES.geometry(A), blocked = new Uint8Array(RW * RD), built = new Uint8Array(RW * RD), at = (x, z) => x >= 0 && z >= 0 && x < RW && z < RD;
  for (const p of g.solid) for (const [x, z, over] of p.cells) if (!over && at(x, z)) { blocked[x + z * RW] = 1; if (p.built) built[x + z * RW] = 1; }
  for (const q of g.floorSlots) if (fills?.[q.i]) for (let x = q.rc[0]; x < q.rc[0] + q.rc[2]; x++) for (let z = q.rc[1]; z < q.rc[1] + q.rc[3]; z++) if (at(x, z)) blocked[x + z * RW] = 1;
  const B = (x, z) => !at(x, z) || blocked[x + z * RW];
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
const nodeXZ = (k, RW) => [((k % RW) + 1) * C4, (((k / RW) | 0) + 1) * C4];
// the nearest free node of the house to a point (within r m), or -1. see: { to: [x, z], own: [x0, z0, x1, z1] (m), any }: the line from
// the node to `to` crosses no wall or car bay (any: and no other solid piece; own: the piece's own cells don't count): a seat is never
// reached through a partition, a chair never through the table's neighbour
function snap(G, x, z, r = .8, comp = G.main, see = null) { let best = -1, bd = 1e9; const cx = Math.round(x / C4) - 1, cz = Math.round(z / C4) - 1, R = Math.ceil(r / C4);
  for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) { const X = cx + dx, Z = cz + dz; if (X < 0 || Z < 0 || X >= G.RW || Z >= G.RD) continue; const k = X + Z * G.RW; if (!G.free[k] || (comp >= 0 && G.comp[k] !== comp)) continue;
    const [nx, nz] = nodeXZ(k, G.RW), d = Math.hypot(nx - x, nz - z) + G.near[k] * .08; if (d < bd && d <= r + .2 && (!see || sight(G, [nx, nz], see))) { bd = d; best = k; } }
  return best; }
function sight(G, a, { to, own, any }) { const b = to, L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / .06));
  for (let i = 0; i <= n; i++) { const t = i / n, x = lerp(a[0], b[0], t), z = lerp(a[1], b[1], t), cx = Math.floor(x / C4), cz = Math.floor(z / C4);
    if (cx < 0 || cz < 0 || cx >= G.RW || cz >= G.RD) continue; if (own && x > own[0] + .01 && x < own[2] - .01 && z > own[1] + .01 && z < own[3] - .01) continue;
    const k = cx + cz * G.RW; if (G.built[k] || (any && G.blocked[k])) return false; }
  return true; }
// is the walker's disc clear all along a segment?
function clear(G, a, b) { const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / .08));
  for (let i = 0; i <= n; i++) { const t = i / n, x = lerp(a[0], b[0], t), z = lerp(a[1], b[1], t);
    for (let cz = Math.floor((z - .24) / C4); cz <= Math.floor((z + .24) / C4); cz++) for (let cx = Math.floor((x - .24) / C4); cx <= Math.floor((x + .24) / C4); cx++) if (G.B(cx, cz)) return false; }
  return true; }
function astar(G, s, t) {
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

export async function createLife({ parent, origin = [0, 0, 0], A, fills, room, seed = 1, look, night = false, dom = null, camera = null, renderer = null } = {}) {
  const rnd = C.mulberry32((seed * 2654435761) >>> 0 ^ 0x51f1);
  const L = look ? structuredClone(look) : C.rollLook((seed * 7919) & 0xffffff);
  const group = new THREE.Group(); group.name = 'home-life'; group.position.set(...(origin.isVector3 ? origin.toArray() : origin)); parent.add(group);
  // ── the walker: the city's near walker for ONE look (peds.js: tierize → walk v2 → fine paint), with gpu.js's cut skipped
  const t0 = performance.now(), full = bakeSegFull(THREE, C, structuredClone(L)), bakeMs = performance.now() - t0;
  const tex = createAnimTexture2(1), [uni, GAIT] = animUniforms2(tex, WALK2, { turnLean: .09 }), atlas = createFineAtlas(THREE);
  const mat = tierize(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .62, metalness: 0 }), { vmat: true });
  mat.customProgramCacheKey = () => 'home-life'; installAnim2(mat, uni); installFine(mat, atlas);
  { const prev = mat.onBeforeCompile, key = mat.customProgramCacheKey.bind(mat); mat.onBeforeCompile = (sh, r) => { prev.call(mat, sh, r); sh.fragmentShader = sh.fragmentShader.replace('if ( uCut[1].w > 0. )', 'if ( false )'); }; mat.customProgramCacheKey = () => key() + '|nocut'; }
  atlas.adopt(full);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(full.P, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(full.N, 3, true));
  geo.setAttribute('color', new THREE.BufferAttribute(full.C, 4, true)); geo.setAttribute('aPart', new THREE.BufferAttribute(new Float32Array(full.K), 1)); geo.setAttribute('aFine', fineAttr(THREE, full)); geo.setIndex(new THREE.BufferAttribute(full.I, 1));
  const batch = new THREE.BatchedMesh(1, geo.attributes.position.count, geo.index.count, mat); batch.addInstance(batch.addGeometry(geo)); batch.frustumCulled = false; batch.perObjectFrustumCulled = false; batch.sortObjects = false; group.add(batch);
  const M4 = new THREE.Matrix4(), QN = new THREE.Quaternion(), V3 = new THREE.Vector3(), ONE = new THREE.Vector3(1, 1, 1), YA = new THREE.Vector3(0, 1, 0);
  // ── the rig: the same look as a chars.js body (cast.js build), for sitting, lying and busy hands
  const body = C.build(L, { fine: 'tex' }), hold = new THREE.Group(); hold.rotation.order = 'YXZ'; hold.add(body); hold.visible = false; group.add(hold);
  const rig = body.userData.rig, head = body.userData.head, eyes = body.userData;
  // the duvet over the sleeper (the Sims' blanket: lying in the open the big shoes stood up and hid the body from the street side)
  const duvet = new THREE.Group(), dm = new THREE.MeshStandardMaterial({ color: 0xf1e7d2, roughness: .92 }), fm = new THREE.MeshStandardMaterial({ color: 0xfffaf0, roughness: .9 }), BX = new THREE.BoxGeometry(1, 1, 1);
  const dFoot = new THREE.Mesh(BX, dm), dBody = new THREE.Mesh(BX, dm), dFold = new THREE.Mesh(BX, fm); duvet.add(dFoot, dBody, dFold); duvet.visible = false; group.add(duvet);
  const neutral = () => { for (const n of ['legL', 'legR', 'armL', 'armR']) rig[n].rotation.set(0, 0, 0); head.rotation.set(0, 0, 0); head.scale.setScalar(1); body.scale.setScalar(C.S); if (eyes.open) { eyes.open.visible = true; eyes.shut.visible = false; } };
  neutral();

  // ── state
  const S = { x: 0, z: 0, yaw: 0, mode: 'think', act: null, spot: null, path: null, s: 0, v: 0, timer: 0, clock: 0, k: 0, from: null, next: null, recent: [], bub: 6 + rnd() * 4, dream: 4, wait: 0, force: null, heldId: null, night: !!night, out: null, midnight: 0 };
  const st = { yaw: 0, omega: 0 }, g = gait2State({ it: rnd() * 10 }); g.idle = IDLE.shift;
  const need = Object.fromEntries(Object.keys(NEEDS).map(k => [k, .35 + rnd() * .6]));
  let G = null, spots = [], byAct = new Map(), room0 = room;
  function plan(A1, fills1) {
    G = gridOf(A1, fills1); spots = [];
    for (const sp of spotsOf(A1, fills1, room0)) { const to = sp.seat ? [sp.seat.x, sp.seat.z] : sp.bed ? sp.face : sp.face, see = { to, own: sp.own, any: !!(sp.seat || sp.bed) };
      let k = snap(G, sp.at[0], sp.at[1], sp.pose === 'lie' ? .45 : .7, G.main, see);
      for (const a of sp.alt ?? []) { if (k >= 0) break; k = snap(G, a[0], a[1], .45, G.main, see); }
      if (k < 0) continue; const [x, z] = nodeXZ(k, G.RW), f = sp.seat ? [x + Math.sin(sp.seat.yaw), z + Math.cos(sp.seat.yaw)] : sp.face;
      spots.push({ ...sp, node: k, p: [x, z], yaw: sp.seat ? sp.seat.yaw : yawOf(f[0] - x, f[1] - z) }); }
    byAct = new Map(); for (const sp of spots) (byAct.get(sp.act) ?? byAct.set(sp.act, []).get(sp.act)).push(sp); }
  plan(A, fills);

  // ── bubbles (bubbles.js: pixel icons on a canvas over the scene, placed at the head's top each frame)
  const B = dom ? createBubbles(dom) : null, pieceOf = sp => sp?.key ? sp.key.replace(/^slot\d+:/, '').split(/[#/]/)[0] : '';
  function bubble(ids) { if (!B) return; if (Array.isArray(ids)) B.think(ids, 2.9, ids.length > 1 ? 'L' : 'R'); else B.say(ids); }
  function chatter() {   // what it says now: the piece's own icons (or the activity's, or the night's), now and then a two-icon thought
    const def = ACTS[S.act] ?? ACTS.wander, pc = pieceOf(S.spot), P = ['admire', 'trophy', 'music', 'dress'].includes(S.act) ? PIECE_ICONS.find(q => q[0].test(pc)) : null;
    const gl = (S.night && def.nglyph) || P?.[1] || def.glyph, th = S.night ? null : P?.[2] ?? def.think;
    if (th?.length && rnd() < .24) return bubble(th[(rnd() * th.length) | 0]);
    if (gl.length) bubble(gl[(rnd() * gl.length) | 0]); }
  const headAt = new THREE.Vector3();
  function placeBubbles(dt) {
    if (!B || !camera || !renderer) return;
    const asleep = S.act === 'sleep' && (S.mode === 'hold') && S.k > .9; B.sleep(asleep);
    if (asleep) { S.dream -= dt; if (S.dream <= 0) { S.dream = 9 + rnd() * 7; bubble(rnd() < .2 ? ['map', 'cash'] : [DREAMS[(rnd() * DREAMS.length) | 0]]); } } else S.dream = 3 + rnd() * 3;
    if (!B.busy && !asleep) { B.update(dt, 0, 0); return; }
    if (hold.visible) { hold.updateMatrixWorld(true); head.localToWorld(headAt.set(0, asleep ? 6 : 21, 0)); if (asleep) headAt.y += .25; } else group.localToWorld(headAt.set(S.x, 2.2, S.z));
    headAt.y += .12;   // (a hand over the hair: the tail never touches the head)
    const r = renderer.domElement.getBoundingClientRect(), d = dom.getBoundingClientRect(), p = headAt.project(camera), on = p.z < 1;
    B.update(dt, r.left - d.left + (p.x + 1) / 2 * r.width + 6, r.top - d.top + (1 - p.y) / 2 * r.height, on); }

  // ── choosing what to do next
  const avail = a => (byAct.get(a) ?? []).length > 0;
  function pickSpot(a) { const L0 = byAct.get(a) ?? []; if (!L0.length) return null; let best = null, bs = -1;
    for (const sp of L0) { const d = Math.hypot(sp.p[0] - S.x, sp.p[1] - S.z), s = (.4 + rnd()) / (1 + d * .12); if (s > bs) { bs = s; best = sp; } } return best; }
  function choose() {
    if (S.force && (avail(S.force) || S.force === 'wander')) { const a = S.force; S.force = null; return a; }   // (go(): a debug nudge, or the seat that moved)
    if (S.next && avail(S.next)) { const a = S.next; S.next = null; return a; } S.next = null;
    if (S.night) { if (S.midnight > 0) { S.midnight = 0; const m = ['fridge', 'toilet'].filter(avail); if (m.length && rnd() < .85) return m[(rnd() * m.length) | 0]; } return avail('sleep') ? 'sleep' : 'wander'; }
    let best = 'wander', bs = -1;
    for (const [a, def] of Object.entries(ACTS)) { if (a === 'sleep' || def.when === 'night' || !(avail(a) || a === 'wander')) continue; if (a === 'eat' && avail('cook')) continue;   // (eating follows cooking)
      let s = .03; for (const [n, v] of Object.entries(def.adv ?? def.give)) s += v * (.06 + 2 * (1 - need[n]) ** 2); s *= .7 + .6 * rnd();
      const i = S.recent.indexOf(a); if (i >= 0) s *= i === 0 ? .05 : .3;
      const sp = a === 'wander' ? null : pickSpot(a); if (sp) s /= 1 + Math.hypot(sp.p[0] - S.x, sp.p[1] - S.z) * .04;
      if (s > bs) { bs = s; best = a; } }
    return best; }
  function wanderSpot() {   // a free spot in the house, toward the open front, facing the street
    const cand = []; for (let k = 0; k < G.free.length; k++) if (G.free[k] && G.comp[k] === G.main && !G.near[k]) { const [x, z] = nodeXZ(k, G.RW); if (z > G.RD * C4 * .5) cand.push(k); }
    if (!cand.length) for (let k = 0; k < G.free.length; k++) if (G.free[k] && G.comp[k] === G.main) cand.push(k);
    if (!cand.length) return null; const k = cand[(rnd() * cand.length) | 0], [x, z] = nodeXZ(k, G.RW);
    return { act: 'wander', key: 'wander', pose: 'stand', node: k, p: [x, z], yaw: (rnd() - .5) * 1.2, idle: rnd() < .5 ? IDLE.phone : IDLE.stretch }; }
  function startAct(a) {
    const sp = a === 'wander' ? wanderSpot() : pickSpot(a); if (!sp) { S.mode = 'think'; S.wait = 1; return false; }
    S.act = a; S.spot = sp; S.mode = 'walk'; route(); return true; }
  function route() {   // a path from where it stands to its spot
    const sp = S.spot; let s0 = snap(G, S.x, S.z, .5, -1); if (s0 >= 0 && G.comp[s0] !== G.main) s0 = snap(G, S.x, S.z, 1.5);
    if (s0 < 0) s0 = snap(G, S.x, S.z, 3);
    const pts = s0 >= 0 ? astar(G, s0, sp.node) : null;
    if (!pts) { S.path = null; S.mode = 'turn'; S.x = sp.p[0]; S.z = sp.p[1]; return; }   // (nowhere to walk from: be there)
    if (Math.hypot(pts[0][0] - S.x, pts[0][1] - S.z) > .02) pts.unshift([S.x, S.z]);
    const P = pts.filter((p, i) => i === 0 || Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) > .01);
    if (P.length < 2) { S.path = null; S.mode = 'turn'; return; }
    // rounded corners where they stay clear of everything (an arc cuts the inside of its corner), else tighter, else nearly sharp
    const ok = R => { for (let s = .3; s < R.len; s += .08) { const p = R.at(s); if (!clear(G, p, p)) return false; } return true; };
    let R = null; for (const r of [.35, .18, .02]) { R = roundedPath(P, r); if (ok(R)) break; }
    S.path = R; S.pts = P; S.s = 0; S.mode = 'walk'; S.start = true; }
  function finish() { const def = ACTS[S.act]; if (def) for (const [n, v] of Object.entries(def.give)) need[n] = Math.min(1, need[n] + v);
    S.recent.unshift(S.act); S.recent.length = Math.min(S.recent.length, 3); if (def?.next) S.next = def.next; S.act = null; S.spot = null; S.mode = 'think'; S.wait = .3 + rnd() * .8; }

  // ── the rig's poses (k: 0 → 1 how far into it; t: the activity's clock)
  function poseRig(sp, k, t) {
    neutral(); const e = ease(k), act = sp?.act, pose = sp?.pose;
    if (pose === 'sit') { rig.legL.rotation.x = rig.legR.rotation.x = -1.25 * e; rig.armL.rotation.x = rig.armR.rotation.x = -.45 * e;
      const s = sp.seat, [ax, az] = S.from ?? sp.p; hold.position.set(lerp(ax, s.x, e), lerp(0, s.y - SIT_DROP, e) + Math.sin(Math.PI * k) * .05, lerp(az, s.z, e)); hold.rotation.set(0, s.yaw, 0);
      if (act === 'tv') { const laugh = Math.max(0, Math.sin(t * 1.3) - .93) * 14; head.rotation.x = (-.1 - .15 * laugh) * e; hold.position.y += .02 * laugh * Math.abs(Math.sin(t * 22)) * e; }
      else if (act === 'chill' || act === 'toilet') { rig.armR.rotation.x = -1.5 * e; rig.armR.rotation.y = .25 * e; head.rotation.x = .32 * e; rig.armR.rotation.z = .03 * Math.sin(t * 9) * e; }
      else if (act === 'eat') { const bite = Math.max(0, Math.sin(t * 2.4)) ** 3; rig.armL.rotation.x = -.95 * e; rig.armR.rotation.x = (-.95 - .6 * bite) * e; head.rotation.x = (.18 - .12 * bite) * e; }
      else if (act === 'game') { const j = Math.sin(t * 17) * .05 + Math.sin(t * 5.3) * .04; rig.armL.rotation.x = (-1.05 + j) * e; rig.armR.rotation.x = (-1.05 - j) * e; head.rotation.x = .05 * e; hold.position.y += Math.max(0, Math.sin(t * .9) - .9) * .3 * e; }
      return; }
    if (pose === 'lie') { const b = sp.bed, [ax, az] = S.from ?? sp.p, yaw0 = S.fromYaw ?? b.yaw, dy = wrapPi(b.yaw - yaw0);
      hold.position.set(lerp(ax, b.x, e), lerp(0, b.y, e) + Math.sin(Math.PI * Math.min(1, k * 1.15)) * .22, lerp(az, b.z, e)); hold.rotation.set(-Math.PI / 2 * ease(Math.min(1, k * 1.25 - .1)), yaw0 + dy * e, 0);
      rig.armL.rotation.x = rig.armR.rotation.x = .05 * e; rig.armL.rotation.z = -.12 * e; rig.armR.rotation.z = .12 * e;
      if (k > .55 && eyes.open) { eyes.open.visible = false; eyes.shut.visible = true; head.scale.setScalar(lerp(1, HEADK, e)); head.rotation.y = .5 * e; }
      body.scale.z = C.S * (1 + .03 * Math.sin(t * 1.4) * e);
      const dk = Math.max(0, (k - .7) / .3); duvet.visible = dk > 0; if (dk > 0) { const w = Math.max(.6, (b.w ?? 1.5) - .14), top = b.y - .12, br = 1 + .012 * Math.sin(t * 1.4);   // (feet at the root: the duvet runs from there toward the pillow)
        duvet.position.set(b.x, top, b.z); duvet.rotation.y = b.yaw; duvet.scale.set(1, ease(dk), 1);
        dFoot.scale.set(w, .44, .42); dFoot.position.set(0, .22, -.14); dBody.scale.set(w, .3 * br, .42); dBody.position.set(0, .15 * br, -.55); dFold.scale.set(w + .01, .31 * br, .1); dFold.position.set(0, .155 * br, -.79); }
      return; }
    duvet.visible = false;
    // work: standing at a counter, the arcade, the sink
    hold.position.set(S.x, 0, S.z); hold.rotation.set(0, S.yaw, 0);
    if (act === 'cook') { rig.armL.rotation.x = -.85 * e; rig.armR.rotation.x = (-1.05 + .14 * Math.sin(t * 6)) * e; rig.armR.rotation.z = .1 * Math.cos(t * 6) * e; head.rotation.x = .3 * e; head.rotation.y = .2 * Math.sin(t * .7) * e; }
    else if (act === 'wash') { const w = Math.sin(t * 10) * .1; rig.armL.rotation.x = (-1.05 + w) * e; rig.armR.rotation.x = (-1.05 - w) * e; head.rotation.x = .35 * e; }
    else if (act === 'arcade') { const j = Math.sin(t * 19) * .06; rig.armL.rotation.x = (-1.15 + j) * e; rig.armR.rotation.x = (-1.15 + Math.sin(t * 13) * .08) * e; head.rotation.x = -.05 * e; body.position.y = Math.max(0, Math.sin(t * 1.1) - .92) * .5 * e; }
    else if (act === 'lift') { const u = (Math.sin(t * 2.2) + 1) / 2; rig.armL.rotation.z = -(.2 + 2.5 * u) * e; rig.armR.rotation.z = (.2 + 2.5 * u) * e; }
    else { rig.armL.rotation.x = rig.armR.rotation.x = -.9 * e; } }
  const toRig = () => { if (hold.visible) return; batch.visible = false; hold.visible = true; body.position.set(0, 0, 0); hold.position.set(S.x, 0, S.z); hold.rotation.set(0, S.yaw, 0); };
  const toWalker = () => { if (!hold.visible) return; hold.visible = false; batch.visible = true; neutral(); body.position.set(0, 0, 0); g.w = 0; g.iw = 0; g.still = 0; g.wasStill = false; st.yaw = S.yaw; st.omega = 0; };

  // ── interruptions (an edit, a lifted piece)
  function standUp(why) { S.out = why; S.mode = 'exit'; if (why !== 'night' && S.spot?.pose === 'sit') S.from = [hold.position.x, hold.position.z]; }   // (the seat went: up where it sits)
  function interrupt(why) {
    if (S.mode === 'enter' || S.mode === 'hold') { standUp(why); return; }
    if (why === 'lifted') { S.mode = 'wait'; S.path = null; return; }
    if (S.act && S.act !== 'wander') { const again = (byAct.get(S.act) ?? []).find(q => q.key === S.spot?.key) ?? null; if (again) { S.spot = again; route(); return; } }
    S.act = null; S.spot = null; S.path = null; S.mode = 'think'; S.wait = .4; }
  function setLayout(A1, fills1, room1, origin1) {
    if (room1) room0 = room1; if (origin1) group.position.set(...(origin1.isVector3 ? origin1.toArray() : origin1));
    const old = S.spot; plan(A1, fills1);
    // standing where a piece was just put down: hop aside
    if (!hold.visible) { const at = snap(G, S.x, S.z, .14, -1); if (at < 0) { const k = snap(G, S.x, S.z, 3); if (k >= 0) { bubble('alert'); S.hop = nodeXZ(k, G.RW); } } }
    if (!old || old.act === 'wander') { if (old?.act === 'wander' && !G.free[old.node]) interrupt('gone'); return; }
    const now = spots.find(q => q.key === old.key && q.act === old.act);
    if (now && Math.hypot(now.p[0] - old.p[0], now.p[1] - old.p[1]) < .01 && (!old.seat || Math.hypot(now.seat.x - old.seat.x, now.seat.z - old.seat.z) < .01) && (!old.bed || Math.hypot(now.bed.x - old.bed.x, now.bed.z - old.bed.z) < .01)) { S.spot = now; if (S.mode === 'wait' || S.mode === 'walk') { S.mode = 'walk'; route(); } return; }
    bubble('huh'); if (S.mode === 'enter' || S.mode === 'hold' || S.mode === 'exit') { if (S.mode !== 'exit' || !S.out) standUp('moved'); S.out = 'moved'; S.again = now ? old.act : null; return; }
    if (now) { S.spot = now; route(); } else { S.act = null; S.spot = null; S.path = null; S.mode = 'think'; S.wait = .6; } }

  // ── a start that already reads as a life: in bed at night; by day somewhere mid-activity
  function begin() {
    const a = S.night ? (avail('sleep') ? 'sleep' : 'wander') : (['tv', 'cook', 'trophy', 'chill', 'music', 'eat', 'game', 'admire'].filter(avail)[(rnd() * 3) | 0] ?? choose());
    const sp = a === 'wander' ? wanderSpot() : pickSpot(a); if (!sp) { const w = wanderSpot(); if (w) { S.x = w.p[0]; S.z = w.p[1]; } return; }
    S.act = a; S.spot = sp; S.x = sp.p[0]; S.z = sp.p[1]; S.yaw = st.yaw = sp.yaw;
    const def = ACTS[a]; S.timer = lerp(def.dur[0], def.dur[1], rnd()) * (a === 'sleep' ? 1 : .6); S.clock = rnd() * 5;
    if (sp.pose === 'stand') { S.mode = 'stand'; g.idle = sp.idle ?? def.idle ?? IDLE.shift; g.iw = 1; g.still = 1; g.wasStill = true; }
    else { S.from = sp.p; S.fromYaw = sp.yaw; toRig(); S.mode = 'hold'; S.k = 1; if (a === 'sleep') S.midnight = 0; } }
  begin();

  // ── the frame
  function update(dt) {
    dt = Math.min(.1, Math.max(0, dt)); if (!dt) return; for (const n of Object.keys(NEEDS)) need[n] = Math.max(0, need[n] - NEEDS[n] * dt * (S.night ? .2 : 1));
    S.clock += dt; let dist = 0, turn = 0, standing = false;
    if (S.hop && !hold.visible) {   // a piece landed on it: straight out to the nearest free spot
      const dx = S.hop[0] - S.x, dz = S.hop[1] - S.z, L = Math.hypot(dx, dz); if (L < .02) { S.hop = null; if (S.mode === 'walk' && S.spot) route(); } else { const v = Math.min(L, 1.3 * dt); S.x += dx / L * v; S.z += dz / L * v; dist = v; turn = turnToward(st, yawOf(dx, dz), dt, 6); S.yaw = st.yaw; } }
    else switch (S.mode) {
      case 'think': S.wait -= dt * (S.force ? 3 : 1); standing = true; if (S.wait <= 0) { const a = choose(); startAct(a); } break;
      case 'wait': standing = true; g.idle = IDLE.look; if (!S.heldId) { S.mode = 'think'; S.wait = .2; } break;
      case 'walk': { if (!S.path) { S.mode = 'turn'; break; } const P = S.path, rem = P.len - S.s, w0 = P.at(S.s + Math.min(.15, rem * .5))[2], arr = S.spot && rem < .7 ? ease(1 - rem / .7) * .85 : 0, want = w0 + wrapPi((S.spot?.yaw ?? w0) - w0) * arr, err = Math.abs(wrapPi(w0 - st.yaw));   // (the last steps already turn toward the spot)
        if (S.start && err > 1.1) { turn = turnToward(st, want, dt, 4); S.yaw = st.yaw; break; } S.start = false;
        const vt = Math.min(WALK_V, Math.sqrt(2 * 1.3 * Math.max(0, rem)) + .05) * (err > .9 ? .45 : 1); S.v += Math.max(-3 * dt, Math.min(1.6 * dt, vt - S.v));
        const ds = Math.min(rem, Math.max(0, S.v) * dt), p = P.at(S.s + ds); dist = Math.hypot(p[0] - S.x, p[1] - S.z); S.s += ds; S.x = p[0]; S.z = p[1];
        turn = turnToward(st, want, dt, 3.6); S.yaw = st.yaw;
        if (rem - ds <= .005) { S.mode = 'turn'; S.v = 0; S.x = S.spot.p[0]; S.z = S.spot.p[1]; } break; }
      case 'turn': { const want = S.spot?.yaw ?? S.yaw; turn = turnToward(st, want, dt, 3.4); S.yaw = st.yaw;
        if (Math.abs(wrapPi(want - st.yaw)) < .06 && (S.spot.pose === 'stand' || g.w < .22)) { const def = ACTS[S.act] ?? ACTS.wander; S.timer = lerp(def.dur[0], def.dur[1], rnd()); S.clock = 0; S.bub = .4 + rnd() * .6;   // (the first bubble soon after it gets there)
          if (S.spot.pose === 'stand') { S.mode = 'stand'; g.idle = S.spot.idle ?? def.idle ?? IDLE.shift; }
          else { S.from = [S.x, S.z]; S.fromYaw = S.yaw; toRig(); S.mode = 'enter'; S.k = 0; } } break; }
      case 'stand': standing = true; S.timer -= dt; if (S.timer <= 0) finish(); break;
      case 'enter': S.k = Math.min(1, S.k + dt / (S.spot.pose === 'lie' ? 1.1 : S.spot.pose === 'sit' ? .55 : .3)); poseRig(S.spot, S.k, S.clock); if (S.k >= 1) S.mode = 'hold'; break;
      case 'hold': S.timer -= dt; poseRig(S.spot, 1, S.clock);
        if (S.act === 'sleep') { if (!S.night) { S.timer = 0; } else { S.midnight += dt; if (S.midnight > 40 && rnd() < dt * .03) { S.timer = 0; S.midnight = 1; } else S.timer = 1; } }
        if (S.timer <= 0) { S.mode = 'exit'; S.out = null; } break;
      case 'exit': { const sp = S.spot; S.k = Math.max(0, S.k - dt / (sp?.pose === 'lie' ? .9 : sp?.pose === 'sit' ? .45 : .25));
        poseRig(sp, S.k, S.clock); if (S.k <= 0) { const [x, z] = S.from ?? [S.x, S.z]; S.x = x; S.z = z; S.yaw = hold.rotation.y; toWalker();
          const out = S.out, again = S.again; S.out = null; S.again = null;
          if (out === 'lifted') { S.mode = 'wait'; break; }
          if (out === 'moved' || out === 'gone') { S.act = null; S.spot = null; S.mode = 'think'; S.wait = .5; if (again) S.force = again; if (snap(G, S.x, S.z, .14, -1) < 0) { const k = snap(G, S.x, S.z, 3); if (k >= 0) S.hop = nodeXZ(k, G.RW); } break; }
          if (S.act === 'sleep') { g.idle = IDLE.stretch; }   // (up: a stretch first)
          finish(); if (S.recent[0] === 'sleep' || S.recent[0] === 'fridge' && S.night) S.wait = 1.6; } break; }
    }
    // bubbles now and then while busy
    if ((S.mode === 'stand' || S.mode === 'hold') && S.act && S.act !== 'sleep') { S.bub -= dt; if (S.bub <= 0) { chatter(); S.bub = 4.5 + rnd() * 4; } }
    // the walker: gait + idle → its texel row; the instance matrix
    if (!hold.visible) { stepGait2(g, dist, dt, WALK2, GAIT, turn); stepIdle(g, standing && !S.hop, dt); writeGait2(tex.image.data, 1, 0, g); tex.needsUpdate = true;
      QN.setFromAxisAngle(YA, S.yaw); V3.set(S.x, 0, S.z); M4.compose(V3, QN, ONE); batch.setMatrixAt(0, M4); }
    placeBubbles(dt);
  }
  function setNight(on) { on = !!on; if (on === S.night) return; S.night = on; if (on) { if (S.act !== 'sleep') interrupt('night'); } else if (S.act === 'sleep' && S.mode === 'hold') S.timer = 0; }
  function held(id) { if (id === S.heldId) return; S.heldId = id ?? null; if (!id || !S.spot) return; const mine = S.spot.key.replace(/^slot\d+:/, '').split(/[#/]/)[0] === id;
    if (mine) { bubble('alert'); interrupt('lifted'); } }
  function dispose() { group.removeFromParent(); geo.dispose(); BX.dispose(); dm.dispose(); fm.dispose(); batch.dispose(); mat.dispose(); tex.dispose(); atlas.tex?.dispose?.(); body.traverse(m => m.geometry?.dispose()); B?.dispose(); }
  return { group, update, setLayout, setNight, held, dispose, bakeMs, say: ids => { S.bub = Math.max(S.bub, 4); bubble(ids); }, bubble: () => B?.shown() ?? null,
    go: a => { S.force = a; if (S.mode === 'hold' || S.mode === 'enter') { S.mode = 'exit'; S.out = null; S.again = null; } else if (S.mode !== 'exit') { S.act = null; S.spot = null; S.path = null; S.mode = 'think'; S.wait = 0; } },
    state: () => ({ act: S.act, mode: S.mode, x: +S.x.toFixed(2), z: +S.z.toFixed(2), yaw: +S.yaw.toFixed(2), night: S.night, clip: !hold.visible && !S.hop && !clear(G, [S.x, S.z], [S.x, S.z]), pts: S.mode === 'walk' ? S.pts?.map(p => p.map(v => +v.toFixed(2))) : null, spot: S.spot && { key: S.spot.key, p: S.spot.p }, needs: Object.fromEntries(Object.entries(need).map(([k, v]) => [k, +v.toFixed(2)])),
      spots: spots.map(q => ({ act: q.act, key: q.key, p: q.p.map(v => +v.toFixed(2)) })), look: L.handle }) };
}
