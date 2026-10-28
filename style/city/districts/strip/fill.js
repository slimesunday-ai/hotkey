// NEON ROW · the block filler (owner: the Neon Row agent). Every Neon Row block is a hero module (heroes/strip-*.js) that lays out its
// own lots BY HAND (fill.mk) and builds its hand-made pieces first; fillBlock then runs the shared generator on the other lots with the
// kit's grammar — gen.js buildBlock's sequence (specify → plan → lots → yards → one-off → sidewalk clutter), plus what the strip needs:
//   · the names: each block deals its own list (names.js), in lot order, so no shop, deli or building name repeats in the district
//   · the roof set pieces: each block its own kinds (no piece twice in the district), chosen by the generator's placement rule
//   · heroes as neighbours: the lots beside a hero see its real height (exposures), so a side wall is painted only where it shows
//   · no murals with tags or cursors (turf is deferred; the strip's voice is not the dial-up one)
//   · the walkers' half metre kept on the curb side while the shopfronts' clutter goes down (so the door-level life stays)
//   · the strip's night layer: window neon upstairs (o.neon), tall blades for upstairs businesses (o.blades), one one-off scene
//   · generic pedestrians only: the build leaves no static people on the sidewalks, stoops, doors or windows (roof set-piece figures stay)
import { specify, buildLot, massPlan, heightOf, exposures, GEN, kitNow, walkBand } from '../../gen.js';
import { yards } from '../../yards.js';
import { REG } from '../../audit.js';
import { rng, SIDE, hash } from '../../style.js';
import { stamp } from '../../vox.js';
import { windowNeon, bladeSign } from './props.js';
import { transitLots } from '../../transit.js';
import { PIECES } from '../../setpieces.js';
import { textW } from '../../facade.js';
import { ModuleError } from '../../modules.js';
import { slab } from '../../ground.js';
import { NAMES, BLADES, checkUnique } from './names.js';
import { off } from '../frame.js';
import { shiftR, kerb, framed } from '../downtown/fill.js';   // SPREAD · a hero's frame (downtown/fill.js): Neon Row's heroes author in today's metres too
export { shiftR, kerb, framed };
checkUnique();

// a lot by hand: world rect, street faces (the first is the main face), corner tag; o = { type, st, name } pins the generator's choice
// a lot by hand: today's metres, its block's frame (fillBlock carries it into the spread world, as the hero rects)
export const mk = (x0, z0, x1, z1, faces, corner = null, o = {}) => ({ x0, z0, x1, z1, faces, corner, w: x1 - x0, d: z1 - z0, main: faces[0], front: faces[0][1] === 'z' ? x1 - x0 : z1 - z0, ...o });
// the facade frame's world point (a along the frontage from its left end seen from the street, d out from the lot line), as gen.js
export function facadeWorld(l, side, a, d = 0) { if (side === '-z') return [l.x1 - a, l.z0 - d]; if (side === '+z') return [l.x0 + a, l.z1 + d]; if (side === '-x') return [l.x0 - d, l.z0 + a]; return [l.x1 + d, l.z1 - a]; }

// ── names: the block's own list, first fit wins, never twice. SIGNS records what each block hung (tools and the signage census read it)
export const SIGNS = {};
function deal(lots, list, key) {
  const used = new Set(), shops = list.shops.slice(), delis = list.delis.slice(), plaques = list.plaques.slice(), nm = e => Array.isArray(e) ? e[0] : e;
  const take = (arr, ok) => { const k = arr.findIndex(e => !used.has(nm(e)) && ok(e)); if (k < 0) return null; const e = arr[k]; used.add(nm(e)); return e; };
  for (const l of lots) { const s = l.spec; if (!s) continue;
    const two = s.shops.length === 2, room = (two ? l.front * 10 * .42 : l.front * 10) - 8;
    s.shops = s.shops.filter((sh, k) => {
      if (s.type === 'bodega' && k === 0) { const d = take(delis, n => textW(n) <= l.front * 10 - 10) || take(delis, () => true); if (d) sh.name = d; return !!d; }
      const pin = k === 0 && l.name ? shops.find(e => e[0] === l.name) : null;
      const e = pin && !used.has(pin[0]) ? (used.add(pin[0]), pin) : take(shops, e => textW(e[0]) <= room) || take(shops, e => textW(e[0]) <= room + 16) || take(shops, () => true);
      if (e) Object.assign(sh, { name: e[0], sign: e[1], disp: e[2], obj: e[3] });
      if (e && (!BLADES.has(e[0]) || l.faces.length > 1)) { sh.blade = false; if (sh.kind === 'blade') sh.kind = l.faces.length > 1 ? 'neon' : 'box'; }   // no blade whose word would be cut or repeat (names.js), and none on a corner (it hangs one per face: two alike side by side)
      return !!e; });
  }
  // building names only where one shows: a loft's painted name first, then an entry canopy, then a parapet plaque (the rest go blank,
  // and a cornice without a name shows the house number)
  const shows = l => { const s = l.spec; return s.type === 'loft' && l.front >= 6 && s.cornice !== 'sign' ? 3 : s.canopy && !/^\d+$/.test(s.canopy) ? 2 : ['deco', 'sign', 'pediment'].includes(s.cornice) ? 1 : 0; };
  for (const l of lots.filter(l => l.spec).sort((p, q) => shows(q) - shows(p))) { const s = l.spec, n = shows(l), p = n ? take(plaques, () => true) : null; s.plaque = p || '';
    if (n === 2) s.canopy = p || String(100 + ((s.seed * 7) % 800)); if (n === 3 && !p) s.cornice = 'sign'; }
  SIGNS[key] = lots.flatMap(l => (l.spec?.shops || []).map(sh => sh.name).concat(l.spec?.plaque ? [l.spec.plaque] : []));
  // the block's one giant shop object hangs off the first shop that has one (a rooftop billboard gag stays as the generator chose it)
  for (const l of lots) if (l.spec?.gag?.kind === 'object') delete l.spec.gag;
  if (!lots.some(l => l.spec?.gag)) { const g = lots.find(l => l.spec && l.spec.shops[0]?.obj); if (g) g.spec.gag = { kind: 'object', obj: g.spec.shops[0].obj }; }
}
// ── roof set pieces: the generator chose which roofs; the block's own list says what stands on them (each kind once in the district)
function pieceKinds(lots, kinds) {
  const dims = l => { const st = l.spec.ground === 'stoop' ? 2.5 : 0, mx = l.main[1] === 'x'; return [l.w - .6 - (mx ? st : 0), l.d - .6 - (mx ? 0 : st)]; };
  const fits = (k, [rw, rd], st) => { const [a, b] = PIECES[k].min; return st >= PIECES[k].st && ((rw >= a && rd >= b) || (rw >= b && rd >= a)); };
  const left = kinds.slice();
  for (const l of lots) { const p = l.spec?.piece; if (!p) continue; const k = left.find(k => fits(k, dims(l), l.spec.st));
    if (!k) { l.spec.piece = null; continue; } left.splice(left.indexOf(k), 1); p.kind = k; l.spec.tank = !['burger', 'billboard', 'pizza'].includes(k) && l.spec.tank; }
}
// ── heroes as neighbours: a lot beside a hero sees the hero's height (city voxels above the slab) and paints only what shows above it
function heroExposure(lots, heroes, noFace = false) {
  const ov = (a0, a1, b0, b1) => Math.min(a1, b1) - Math.max(a0, b0);
  for (const l of lots) for (const [side, e] of Object.entries(l.expo || {})) {
    const h = heroes.find(h => { const [x0, z0, x1, z1] = h.rect; const len = side[1] === 'z' ? l.w : l.d;
      if (side === '-x' && Math.abs(x1 - l.x0) < .01) return ov(l.z0, l.z1, z0, z1) >= len * .45; if (side === '+x' && Math.abs(x0 - l.x1) < .01) return ov(l.z0, l.z1, z0, z1) >= len * .45;
      if (side === '-z' && Math.abs(z1 - l.z0) < .01) return ov(l.x0, l.x1, x0, x1) >= len * .45; if (side === '+z' && Math.abs(z0 - l.z1) < .01) return ov(l.x0, l.x1, x0, x1) >= len * .45; return false; });
    if (!h) continue; Object.assign(e, { kind: 'party', nh: h.nh, ex: l.H - h.nh, open: !!h.open });
    if (e.ex < 34) delete e.paint; else if (!e.paint) e.paint = h.open ? 'ad' : 'ghost'; }
  // no tag murals (turf is deferred) and no cursor (the dial-up voice): the same wall gets a heart or the money mural instead
  for (const l of lots) for (const e of Object.values(l.expo || {})) if (e.mural === 'tag' || e.mural === 'cursor') e.mural = hash(l.spec.seed, 7) < .5 ? 'money' : 'heart';
  // a block whose hero already carries its character mural (o.noFaceMural) paints the generator's face wall as a checker instead
  if (noFace) for (const l of lots) for (const e of Object.values(l.expo || {})) if (e.mural === 'face') e.mural = 'checker';
}

// ── window neon: the second-floor business (a psychic, a bar upstairs, a card room) — a picture in tubes hung in a street window of
// a generated walk-up. Each block hangs its own (o.neon: kinds, every one once in the district), on its preferred faces first (o.neonFaces:
// rots, the streets its shots look down), one per building; a window with an AC unit or a flower box in it is passed over.
const hit = (a, b) => a[0] < b[3] && a[3] > b[0] && a[1] < b[4] && a[4] > b[1] && a[2] < b[5] && a[5] > b[2];
function windowNeons(bank, A, kinds, rots = []) {
  const blds = (A.anchors?.buildings || []).filter(b => /·L\d+$/.test(b.id)).sort((p, q) => (rots.includes(q.rot) ? 1 : 0) - (rots.includes(p.rot) ? 1 : 0) || (p.id < q.id ? -1 : 1));
  const keeps = (REG.blk?.keep || []).filter(k => k.tag === 'facade'); let n = 0;
  for (const b of blds) { if (n >= kinds.length) break; const u = b.units.find(u => u.floor === 1) || b.units[0]; if (!u) continue; const [fx, fz] = b.face;
    for (const w of u.windows) { if (w[3] > 1.45) continue;   // (a paired window's anchor is centred on the pier between its panes)
      const [x, y, z, ww, wh] = w, pw = Math.min(1.2, ww - .1), ph = Math.min(1.0, wh - .35), cx = x - fx * .17, cz = z - fz * .17;
      const box = fx ? [cx - .06, y - ph / 2, cz - pw / 2, cx + .06, y + ph / 2, cz + pw / 2] : [cx - pw / 2, y - ph / 2, cz - .06, cx + pw / 2, y + ph / 2, cz + .06];
      if (keeps.some(k => hit(box, k.box))) continue;
      stamp(windowNeon(kinds[n], pw, ph), bank, b.rot, cx, y - ph / 2, cz); n++; break; } }
}

// ── the block's one-off scene: props placed as a group relative to a frontage point (a metres along the lot's face from its left end,
// out metres from the facade), tried along the whole frontage, the whole scene or nothing (gen.js oneOff's rule). A walker's lane stays
// open beside it: on the curb side of a scene by the facade, or on the facade side of a scene at the curb.
export function oneOff(bank, lots, { where, parts, lane }, reserve = () => {}) {
  const sl = REG.blk ? slab(REG.blk.i, REG.blk.j) : null;
  for (const [lot, side] of where) { const l = lots[lot], len = side[1] === 'z' ? l.w : l.d, rot = { '+z': 0, '+x': 1, '-z': 2, '-x': 3 }[side], ax = side[1] === 'z' ? 0 : 2, shifts = [];
    for (let d = 0; d <= len / 2; d += .3) { shifts.push(d); if (d) shifts.push(-d); }
    for (const sh of shifts) { const mid = len / 2 + sh;
      const placed = parts.map(([bk, r, a, out]) => { const [x, z] = facadeWorld(l, side, mid + a, out), rr = (rot + r) & 3; return { bk, rr, x, z, box: REG.boxOf(bk, rr, x, SIDE, z) }; });
      const lo = Math.min(...placed.map(p => p.box[ax])), hi = Math.max(...placed.map(p => p.box[ax + 3]));
      if (sl && placed.some(p => p.box[0] < sl.x0 + .02 || p.box[3] > sl.x1 - .02 || p.box[2] < sl.z0 + .02 || p.box[5] > sl.z1 - .02)) continue;   // every part stays on the sidewalk
      if ((ax ? [l.z0, l.z1] : [l.x0, l.x1]).some((e, k) => k ? hi > e - .4 : lo < e + .4)) continue;                                              // and in front of its own lot
      if (placed.some(p => REG.why(p.box, { ignore: 'walkway' }))) continue;   // (it stands in the curb band on purpose: the lane goes behind it)
      const [p0, p1] = [facadeWorld(l, side, 0, lane[0]), facadeWorld(l, side, 0, lane[1])], lb = ax ? [Math.min(p0[0], p1[0]), SIDE + .05, lo - .4, Math.max(p0[0], p1[0]), SIDE + 1.9, hi + .4] : [lo - .4, SIDE + .05, Math.min(p0[1], p1[1]), hi + .4, SIDE + 1.9, Math.max(p0[1], p1[1])];
      if (REG.why(lb, { ignore: ['plinth', 'walkway'] })) continue;   // a walker's lane beside the whole scene: no item, facade part or doorway in it
      for (const p of placed) stamp(p.bk, bank, p.rr, p.x, SIDE, p.z); reserve(lb); return true; } }
  const l = lots[where[0][0]]; REG.skip('oneoff', [(l.x0 + l.x1) / 2, SIDE, (l.z0 + l.z1) / 2], 'no frontage with a lane beside it'); return false;
}

// ── an upstairs business's blade on a generated walk-up (o.blades: [{ lot, side, text, bg, fg, rim }]): it hangs between two window
// bays (the boundaries gen.js windowRow lays out for the lot's window style), from over the shop sign to under the cornice, only
// where no fire escape, balcony, AC unit, bay or shop blade is in the way
const BAY = { loft: 30, paired: 32, tall: 22, bay: 34 };
function blades(bank, lots, list) {
  const FR = { '+z': 0, '+x': 1, '-z': 2, '-x': 3 };
  for (const { lot, side, text, bg, fg, rim } of list) { const l = lots[lot], s = l?.spec; if (!s || s.ground === 'stoop' || !['walkup', 'loft', 'bodega', 'shop2'].includes(s.type)) continue;
    const bk = bladeSign(text, bg, fg, rim), h = (text.length * 8 + 6) * .1, y = SIDE + 4.0; if (y + h > SIDE + l.H * .1 - .6) continue;
    const L = Math.round((side[1] === 'z' ? l.w : l.d) * 10), bw = BAY[s.win] || 26, n = Math.max(1, Math.floor((L - 4) / bw)), m = Math.floor((L - n * bw) / 2);
    const cands = []; for (let k = 0; k <= n; k++) { const a = m + k * bw; if (a > 8 && a < L - 8) cands.push(a); }
    cands.sort((p, q) => Math.abs(p - L / 2) - Math.abs(q - L / 2));
    for (const a of cands) { const [x, z] = facadeWorld(l, side, (a + .5) * .1, 0), box = REG.boxOf(bk, FR[side], x, y, z);
      if (REG.why(box, { ignore: ['plinth', 'walkway'] })) continue; stamp(bk, bank, FR[side], x, y, z); break; } }
}

// the block: o = { lots: [mk…], heroes: [{ rect, top (m), nh (voxels, what neighbours see), open, group, faces }], seed, pieces: [kinds],
// neon: [kinds], neonFaces: [rots], blades: [{ lot, side, text, bg, fg, rim }], build(lots): the hand-made pieces (after the plan, before
// the generated lots), oneOff(lots, keep): the block's scene (keep reserves its walker lane while the clutter goes down), after(lots) }
export function fillBlock(bank, b, A, o) {
  const [sx, sz] = off(b), at = l => sx || sz ? { ...l, x0: l.x0 + sx, z0: l.z0 + sz, x1: l.x1 + sx, z1: l.z1 + sz } : l;   // (SPREAD: the hand lots and hero rects, frame → spread world)
  const K = kitNow(), key = `${b.i}_${b.j}`, list = NAMES[key], lots = o.lots.map(l => ({ ...at(l), faces: [...l.faces] })), r = rng(o.seed), heroes = (o.heroes || []).map(h => sx || sz ? { ...h, rect: shiftR(b, h.rect) } : h);
  specify({ ...b, noAlley: !!o.noAlley }, lots, r, o.seed * 7 + 1000);
  for (const l of lots) { if (l.st && l.spec.st) l.spec.st = l.st; if (l.shops === 1 && l.spec.shops.length > 1) l.spec.shops.length = 1; }
  const ov = GEN.override; if (ov?.lots) lots.forEach((l, k) => { const fn = ov.lots['L' + k]; if (fn) try { fn(l.spec, l); } catch (e) { throw new ModuleError(`blocks/${key}.js`, e, 'lots.L' + k); } });
  transitLots(b, lots, K);
  if (list) deal(lots, list, key);
  pieceKinds(lots, o.pieces || []);
  for (const l of lots) l.H = heightOf(l.spec);
  // exposures: the heroes stand in as low calm lots (never painted themselves), then each side facing a hero takes its real height
  const pseudo = heroes.map(h => { const [x0, z0, x1, z1] = h.rect; return { x0, z0, x1, z1, w: x1 - x0, d: z1 - z0, faces: h.faces || [], main: (h.faces || ['-z'])[0], front: 0, spec: { type: 'calm', seed: 1 }, hero: h }; });
  exposures([...lots, ...pseudo], r); heroExposure(lots, heroes, !!o.noFaceMural);
  // the heroes' planned masses carry their frontage zones out to the curb (as gen.js massPlan): a neighbour's cornice or band never
  // runs on into a hero's frontage, and a hero's awning never into a neighbour's
  const zonesOf = h => { const [x0, z0, x1, z1] = h.rect, t = h.top; return (h.faces || []).map(f => f === '-z' ? [x0, SIDE, z0 - 1.6, x1, t, z0] : f === '+z' ? [x0, SIDE, z1, x1, t, z1 + 1.6] : f === '-x' ? [x0 - 1.6, SIDE, z0, x0, t, z1] : [x1, SIDE, z0, x1 + 1.6, t, z1]); };
  REG.plan([...lots.map((l, k) => massPlan(l, 'L' + k)).filter(Boolean), ...heroes.map(h => ({ box: [h.rect[0], SIDE, h.rect[1], h.rect[2], h.top, h.rect[3]], group: h.group, zones: zonesOf(h) }))]);
  // the walkers' half metre (grammar.walkway, walkband): Neon Row keeps it on the CURB side of every sidewalk (1.2 m out from the facade),
  // so the door-level clutter — crates, bins, boards, racks — stays at the shopfronts, and around every corner lamp, signal and transit
  // stand the whole sidewalk stays clear for 0.8 m either side. The band is the core's (gen.js walkBand, cleanup pass): it steers this
  // build's own placements (heroes, lots, the one-off, the clutter) and is lifted once the clutter is down, before the street furniture.
  const band = walkBand(b, [...lots, ...pseudo], K.grammar), keep = band.keep;
  const life0 = A.life.length;
  o.build?.(lots);
  A.clutter = []; lots.forEach((l, k) => { REG.group('L' + k); const n0 = A.clutter.length; l.H = buildLot(bank, l, A) || l.H; for (let q = n0; q < A.clutter.length; q++) A.clutter[q] = [k, A.clutter[q]]; });
  REG.group('yard'); yards(bank, b, [...lots, ...pseudo], r, A, {});
  REG.group('oneoff'); o.oneOff?.(lots, keep);   // the one-off first (gen.js order), its walker lane kept clear of the clutter that follows
  for (const [k, fn] of A.clutter) { REG.group('L' + k); fn(); } A.clutter = null;
  band.lift();
  REG.group('neon'); if (o.neon) windowNeons(bank, A, o.neon, o.neonFaces); if (o.blades) blades(bank, lots, o.blades);
  o.after?.(lots);
  // generic pedestrians only (DISTRICTS §3): the walkers come from peds.js. The generator's standing cast goes — door and stoop
  // figures, window leaners, sidewalk poses — and only the roof set-piece figures (the party, the counter) stay up on their roofs.
  A.life.splice(life0, A.life.length - life0, ...A.life.slice(life0).filter(p => (p.y ?? SIDE) > SIDE + 2.5 && ['dance', 'dj', 'arms'].includes(p.act)));
  A.doors.length = 0; A.stoops.length = 0;
  return lots;
}
