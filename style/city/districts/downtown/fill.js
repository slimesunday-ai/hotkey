// GLASSWALL · THE DOWNTOWN FRINGE · the hero-block filler (owner: the downtown fringe agent, batch 5). A fringe hero builds its own
// piece by hand and lays out the rest of its block as lots (mk); fillBlock runs the shared generator on those lots with the kit's
// fringe grammar — gen.js buildBlock's sequence (specify → the block override's lot hooks → heights → exposures → plan → lots → yards →
// sidewalk clutter) — with the hero registered first as a planned mass, so a neighbour is clipped against it, never draws into it, and
// paints only the part of its side wall that shows above it.
import { specify, buildLot, massPlan, heightOf, exposures, GEN, kitNow, walkBand } from '../../gen.js';
import { yards } from '../../yards.js';
import { REG } from '../../audit.js';
import { rng, SIDE } from '../../style.js';
import { transitLots } from '../../transit.js';
import { ModuleError } from '../../modules.js';
import { off, kerbX, kerbZ } from '../frame.js';

// SPREAD · A HERO'S FRAME (style/city/SPREAD.md). A fringe (or Neon Row) hero authors in today's metres, the frame of its block: fillBlock
// carries its hand lots (mk) and hero rects into the spread world by the block's shift, and framed(ctx) does the same for the hero's
// building / volume / mass rects (every volume it makes remembers the shift, V.fo, so a brush on it draws in frame metres too:
// downtown/lib.js). A point goes through kerb: in the block the shift, in the street band kept to its kerb (districts/frame.js kerbX /
// kerbZ: a kerb thing stays at its kerb, a shopfront thing at the shopfront). A direct stamp, keep, door or person takes kerb(x, z);
// a value read back off a volume (V.org, a frame's xz) is already the spread world's. All of it the identity at SPREAD 0.
export const kerb = (x, z) => [kerbX(x), kerbZ(z)];
export const shiftR = (ctx, r) => { const [sx, sz] = off(ctx); return [r[0] + sx, r[1] + sz, r[2] + sx, r[3] + sz]; };
export function framed(ctx) { const [sx, sz] = off(ctx), fo = V => { V.fo = [sx, sz]; return V; };
  return Object.assign(Object.create(ctx), {
    building(x0, z0, x1, z1, o) { const q = ctx.building(x0 + sx, z0 + sz, x1 + sx, z1 + sz, o); fo(q.V); return q; },
    volume(x0, y0, z0, x1, y1, z1, o) { return fo(ctx.volume(x0 + sx, y0, z0 + sz, x1 + sx, y1, z1 + sz, o)); },
    mass(V, r, o) { return ctx.mass(V, shiftR(ctx, r), o); },
    put(prop, x, z, o) { return ctx.put(prop, ...kerb(x, z), o); },   // (returns the spread world's spot)
  }); }

// a lot by hand: world rect (today's metres, its block's frame: fillBlock carries it into the spread world), street faces (the first is the main face), corner tag; o.pin = spec fields to force after the generator's choice
export const mk = (x0, z0, x1, z1, faces, corner = null, o = {}) => ({ x0, z0, x1, z1, faces, corner, w: x1 - x0, d: z1 - z0, main: faces[0], front: faces[0][1] === 'z' ? x1 - x0 : z1 - z0, ...o });
// the facade frame's world point (a along the frontage from its left end seen from the street, d out from the lot line), as gen.js
export function facadeWorld(l, side, a, d = 0) { if (side === '-z') return [l.x1 - a, l.z0 - d]; if (side === '+z') return [l.x0 + a, l.z1 + d]; if (side === '-x') return [l.x0 - d, l.z0 + a]; return [l.x1 + d, l.z1 - a]; }

// a lot beside a hero sees the hero's height (voxels above the slab: h.nh) and paints only what shows above it. A side along two hero
// parts sees the taller one (a wall painted below it would run into that part's planned mass and be carved off by the clip)
function heroExposure(lots, heroes) {
  const ov = (a0, a1, b0, b1) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
  for (const l of lots) for (const [side, e] of Object.entries(l.expo || {})) {
    const len = side[1] === 'z' ? l.w : l.d, touch = heroes.map(h => { const [x0, z0, x1, z1] = h.rect;
      const o = side === '-x' && Math.abs(x1 - l.x0) < .01 ? ov(l.z0, l.z1, z0, z1) : side === '+x' && Math.abs(x0 - l.x1) < .01 ? ov(l.z0, l.z1, z0, z1)
        : side === '-z' && Math.abs(z1 - l.z0) < .01 ? ov(l.x0, l.x1, x0, x1) : side === '+z' && Math.abs(z0 - l.z1) < .01 ? ov(l.x0, l.x1, x0, x1) : 0; return { h, o }; }).filter(t => t.o > .05);
    if (!touch.length || touch.reduce((s, t) => s + t.o, 0) < len * .45) continue;
    const nh = Math.max(...touch.map(t => t.h.nh)), open = touch.every(t => t.h.open);
    Object.assign(e, { kind: 'party', nh, ex: l.H - nh, open }); if (e.ex < 34) delete e.paint; else if (!e.paint) e.paint = open ? 'ad' : 'ghost'; }
}
// o = { seed, lots: [mk…], heroes: [{ rect: [x0, z0, x1, z1], top (m), nh (voxels), open, group, faces, roofY }], build(lots): the hand-made
// hero (after the plan, before the generated lots), after(lots) }. Returns the lots (their l.H set).
export function fillBlock(bank, b, A, o) {
  const [sx, sz] = off(b), at = l => sx || sz ? { ...l, x0: l.x0 + sx, z0: l.z0 + sz, x1: l.x1 + sx, z1: l.z1 + sz } : l;   // (SPREAD: the hand lots and hero rects, frame → spread world)
  const K = kitNow(), key = `${b.i}_${b.j}`, lots = o.lots.map(l => ({ ...at(l), faces: [...l.faces] })), r = rng(o.seed), heroes = (o.heroes || []).map(h => sx || sz ? { ...h, rect: shiftR(b, h.rect) } : h);
  specify({ ...b, noAlley: true, place: 'hero' }, lots, r, o.seed * 7 + 1000);   // (place: a hero block takes one roof set piece and no pocket plaza)
  const ov = GEN.override; if (ov?.lots) lots.forEach((l, k) => { const fn = ov.lots['L' + k]; if (fn) try { fn(l.spec, l); } catch (e) { throw new ModuleError(`blocks/${key}.js`, e, 'lots.L' + k); } });
  for (const l of lots) if (l.pin) Object.assign(l.spec, l.pin);
  transitLots(b, lots, K);
  for (const l of lots) l.H = heightOf(l.spec);
  const pseudo = heroes.map(h => { const [x0, z0, x1, z1] = h.rect; return { x0, z0, x1, z1, w: x1 - x0, d: z1 - z0, faces: h.faces || [], main: (h.faces || ['-z'])[0], front: 0, spec: { type: 'calm', seed: 1 }, hero: h }; });
  exposures([...lots, ...pseudo], r); heroExposure(lots, heroes);
  const zonesOf = h => { const [x0, z0, x1, z1] = h.rect, t = h.top; return (h.faces || []).map(f => f === '-z' ? [x0, SIDE, z0 - 1.6, x1, t, z0] : f === '+z' ? [x0, SIDE, z1, x1, t, z1 + 1.6] : f === '-x' ? [x0 - 1.6, SIDE, z0, x0, t, z1] : [x1, SIDE, z0, x1 + 1.6, t, z1]); };
  REG.plan([...lots.map((l, k) => massPlan(l, 'L' + k)).filter(Boolean), ...heroes.map(h => ({ box: [h.rect[0], SIDE, h.rect[1], h.rect[2], h.top, h.rect[3]], group: h.group, zones: zonesOf(h), roofY: h.roofY }))]);   // (roofY: people may stand on that part's roof)
  const band = walkBand(b, [...lots, ...pseudo], K.grammar), life0 = A.life.length;
  o.build?.(lots);
  A.clutter = []; lots.forEach((l, k) => { REG.group('L' + k); const n0 = A.clutter.length; l.H = buildLot(bank, l, A) || l.H; for (let q = n0; q < A.clutter.length; q++) A.clutter[q] = [k, A.clutter[q]]; });
  REG.group('yard'); yards(bank, b, [...lots, ...pseudo], r, A, {});
  for (const [k, fn] of A.clutter) { REG.group('L' + k); fn(); } A.clutter = null;
  band.lift();
  o.after?.(lots);
  // the ring's life rule (the kit's grammar life [0, 0], as gen.js buildBlock applies it): the generator's generic door poses go; the
  // hero's own people (hand: true), scene sitters, window leaners and fire-escape sitters stay
  for (let k = A.life.length - 1; k >= life0; k--) { const p = A.life[k]; if (!p.hand && ['carry', 'phone', 'lean', 'walk', 'stand'].includes(p.act)) A.life.splice(k, 1); }
  A.stats = [{ b: b.i + ',' + b.j, lots: lots.filter(l => !['alley', 'parking', 'calm'].includes(l.spec.type)).length, hero: heroes.map(h => h.group).join(',') }];
  return lots;
}
