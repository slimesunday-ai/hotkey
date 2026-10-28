// AI City · the sim-state asset library: the pieces of the city that change with the game's state. Standalone; the systems agent wires
// them in. Every function returns a Vol (vox.js), like props.js: authored in voxels around an ANCHOR (its local origin), memoized per
// arguments and per TOD.night (lamps, LEDs, flames and lit signs switch to the lit layer 3 at night, exactly like props.js).
// Treat returned Vols as read-only (they are shared). To stamp one: stamp(bankOf(V), dst, rotQ, x, y, z)  (bankOf memoizes meshed(V)).
//   V.kind (the middle of an item id) · V.anchor (how to place it) · V.box3 / V.size (measured, metres, anchor-relative)
// Placement conventions (see ASSETS.md and SIZES):
//   ground pieces: origin = base centre, +z = the front (street); rotate with stamp's quarter turns
//   facade pieces: origin = bottom centre of the opening on the wall's outer plane (kit.js frame d = 0 face); x along the wall,
//                  +z out of the wall; rotQ = FACE_ROT[side] (the same map as gen.js faceRot)
import { meshed } from '../vox.js';
import { TOD } from './lib.js';
import { forRentSign as rentF, windowCard as cardF } from './signs.js';
import { pile as pileF, stageOf } from './piles.js';
import { security as secF } from './security.js';
import { doormanLobby as lobbyF, STAND } from './lobby.js';
import { scar as scarF } from './scars.js';
import { hotspot as hotF, heatStep, patrolCar as carF } from './street.js';

export { stageOf, heatStep, STAND };
export const FACE_ROT = { '+z': 0, '+x': 1, '-z': 2, '-x': 3 };
const memo = new Map(), BANKS = new WeakMap();
const M = (key, f) => { key += TOD.night ? '|n' : '|d'; let V = memo.get(key); if (!V) { memo.set(key, V = f()); Object.defineProperty(V, 'bank', { get() { return bankOf(this); } }); } return V; };
export function bankOf(V) { let b = BANKS.get(V); if (!b) { b = meshed(V); b.kind = V.kind; BANKS.set(V, b); } return b; }

// ── the interface
export const forRentSign = ({ style = 'lawn' } = {}) => M('rent:' + style, () => rentF(style));
export const pile = (kind = 'scrap', level = 1) => M(`pile:${kind}:${stageOf(level)}`, () => pileF(kind, level));
export const security = (kind = 'lock', o = {}) => M(`sec:${kind}:${o.w ?? ''}x${o.h ?? ''}:${o.style ?? ''}:${o.open ?? 0}`, () => secF(kind, o));
export const doormanLobby = ({ width = 56, name = 'CROWN', no = '1' } = {}) => M(`lobby:${Math.round(width)}:${name}:${no}`, () => lobbyF({ width, name, no }));
export const scar = (kind = 'boarded', o = {}) => M(`scar:${kind}:${o.w ?? ''}x${o.h ?? ''}:${o.door ?? ''}`, () => scarF(kind, o));
export const windowCard = (kind = 'zzz', o = {}) => M(`card:${kind}:${o.w ?? 13}x${o.h ?? 17}:${o.seed ?? 0}`, () => cardF(kind, o));
export const hotspot = ({ heat = .5, compact = false } = {}) => M('hot:' + heatStep(heat) + (compact ? ':c' : ''), () => hotF({ heat, compact }));   // (compact: the tight corners' set, 2026-10-09)
export const patrolCar = ({ lights = false } = {}) => M('car:' + !!lights, () => carF({ lights }));

// ── SIZES: measured at the default arguments. w (along local x) × d (along local z) × h, metres; box = [x0, y0, z0, x1, y1, z1] relative to
// the anchor; anchor + place say where it goes. Parametric pieces grow with their arguments (every Vol carries its own V.size / V.box3).
// Facade pieces: the wall plane is z = 0; negative z is inside the opening's recess (kit.js: glass at −0.3, doors at −0.3 … −0.5).
const F = 'facade: bottom centre of the opening, on the wall plane';
export const SIZES = {
  forRentSign: {
    lawn: { w: 2.2, d: 0.4, h: 2.05, box: [-1.1, 0, -0.2, 1.1, 2.05, 0.2], anchor: 'base centre (the post stands at x −0.9)', place: 'lot: a house or trailer lawn, board facing the street, ≥ 0.3 m inside the lot line; reads from both sides' },
    window: { w: 1.0, d: 0.1, h: 1.2, box: [-0.5, 0, -0.2, 0.5, 1.2, -0.1], anchor: 'facade: bottom centre of the card, on the wall plane', place: 'inside any kit window ≥ 11 vx wide: stamp at the opening bottom (y0), x within ±0.1 of its centre; the card stands 0.1–0.2 m inside the recess' },
    lobby: { w: 1.4, d: 0.65, h: 2.15, box: [-0.7, 0, -0.4, 0.7, 2.15, 0.25], anchor: 'base centre, board facing +z', place: 'tower sidewalk beside the lobby: e.g. doormanLobby origin + (−3.3, 0, 0.75), clear of its planter' },
  },
  windowCard: {
    zzz: { w: 1.3, d: 0.1, h: 1.7, box: [-0.65, 0, -0.2, 0.65, 1.7, -0.1] }, curtain: { w: 1.3, d: 0.1, h: 1.7, box: [-0.65, 0, -0.2, 0.65, 1.7, -0.1] },
    forRent: { w: 1.3, d: 0.15, h: 1.7, box: [-0.65, 0, -0.2, 0.65, 1.7, -0.05] },
    anchor: F, place: 'fills a kit.js window opening: pass its w, h (city voxels; default 13 × 17, min 7 × 10; forRent needs w ≥ 11). Occupies z −0.2 … 0 in front of the meeting rail; o.seed picks the curtain colour' },
  pile: {
    scrap: { w: 3.2, d: 3.0, h: 2.6, box: [-1.6, 0, -1.5, 1.6, 2.6, 1.5], empty: 0.5 }, salts: { w: 3.0, d: 3.0, h: 2.3, box: [-1.6, 0, -1.4, 1.4, 2.3, 1.6], empty: 0.8 },
    goo: { w: 2.4, d: 2.9, h: 1.5, box: [-1.2, 0, -1.4, 1.2, 1.5, 1.5], empty: 0.5 }, leaf: { w: 3.2, d: 3.0, h: 2.0, box: [-1.6, 0, -1.6, 1.6, 2.0, 1.4], empty: 1.2 },
    cloth: { w: 2.8, d: 2.8, h: 2.3, box: [-1.4, 0, -1.3, 1.4, 2.3, 1.5], empty: 0.3 },
    anchor: 'base centre (h at level 1; empty = height at level 0)', place: 'site ground: the Heap (scrap), the dead mall (salts, cloth), the docks (goo, cloth), the woods (leaf); reserve 3.4 × 3.4 m', stages: '0 empty · 1 ≤ 25% · 2 ≤ 50% · 3 ≤ 75% · 4 full (stageOf)' },
  security: {
    lock: { w: 0.55, d: 0.5, h: 2.4, box: [0.15, 0, -0.2, 0.7, 2.4, 0.3], anchor: F, place: 'the lot’s street door (o.w, o.h = its opening, default 14 × 24 vx): a steel guard down the right-hand jamb with the locks' },
    door: { w: 1.4, d: 0.4, h: 2.4, box: [-0.7, 0, -0.2, 0.7, 2.4, 0.2], anchor: F, place: 'plugs the street door opening (o.w, o.h): hides any kit door face 0.3–0.5 m deep' },
    safe: { w: 0.8, d: 0.85, h: 1.0, box: [-0.4, 0, -0.35, 0.4, 1.0, 0.5], anchor: 'base centre, door facing +z', place: 'lot: a porch, yard, trailer pad or penthouse terrace' },
    gate: { w: 1.7, d: 0.4, h: 2.5, box: [-0.85, 0, 0, 0.85, 2.5, 0.4], anchor: F, place: 'a shop door or window (o.w, o.h; o.open 0 … 0.85): rails 0.15 m past each jamb, the coil housing fills the top 0.25 m of the opening' },
    bars: { w: 1.45, d: 0.25, h: 2.05, box: [-0.75, -0.1, 0, 0.7, 1.95, 0.25], anchor: F, place: 'security("gate", { style: "bars", w, h }): iron guards over a window (default 13 × 17)' },
    buzzer: { w: 0.5, d: 0.25, h: 0.8, box: [-0.25, 0, 0, 0.25, 0.8, 0.25], anchor: 'facade: bottom centre of the panel, on the wall plane', place: 'beside a walk-up street door, bottom 1.0 m up, clear of the trim surround' },
    camera: { w: 0.4, d: 0.8, h: 0.55, box: [-0.2, -0.25, 0, 0.2, 0.3, 0.8], anchor: 'facade: bottom centre of the wall plate, on the wall plane (the camera hangs 0.25 m below it)', place: '2.6–3.0 m up, over or beside the door' },
  },
  doormanLobby: { w: 4.6, d: 1.95, h: 4.1, box: [-2.3, 0, 0, 2.3, 4.1, 1.95], anchor: 'facade: the wall plane at the entrance centre, sidewalk level',
    place: 'the tower’s main face, centred (width = frontage in vx, default 56, min 40; ≥ 52 adds the planters): needs the 2 m sidewalk; poles at z 1.75', stand: STAND },
  scar: {
    burned: { w: 1.8, d: 0.45, h: 3.1, box: [-0.9, -0.35, -0.2, 0.9, 2.75, 0.25], anchor: F, place: 'a window (w × h vx, default 13 × 17) or a door (door: true); o.plume = soot height above the head (default 0.7 m)' },
    boarded: { w: 1.65, d: 0.6, h: 1.9, box: [-0.85, -0.1, -0.2, 0.8, 1.8, 0.4], anchor: F, place: 'over a window or door (w × h vx, default 13 × 17)' },
    foreclosed: { w: 1.7, d: 0.7, h: 2.5, box: [-0.85, 0, -0.2, 0.85, 2.5, 0.5], anchor: F, place: 'over the lot’s front door (w × h vx, default 14 × 24); works on windows too' },
    crimeScene: { w: 3.2, d: 2.8, h: 1.05, box: [-1.6, 0, -1.4, 1.6, 1.05, 1.4], anchor: 'base centre', place: 'a lot or sidewalk: w × h = its footprint in vx (default 32 × 28)' },
    memorial: { w: 2.35, d: 1.1, h: 1.65, box: [-1.15, 0, -0.55, 1.2, 1.65, 0.55], anchor: 'base centre; back edge at z −0.6', place: 'sidewalk: back edge against a wall, fence or lamp post (footprint w × h vx, default 24 × 12)' },
  },
  hotspot: { w: 3.2, d: 3.1, h: 2.6, box: [-1.6, 0, -1.5, 1.6, 2.6, 1.6], anchor: 'base centre, +z toward the street corner', place: 'corner: inside the dealing-corner zone (≈ 3.5 × 3.3 m); heat 0 … 1 → five steps (heatStep); heat 0 is 0.9 m tall',
    compact: { w: 3.2, d: 2.6, h: 2.6, box: [-1.6, 0, -1.3, 1.6, 2.6, 1.3], place: 'hotspot({ heat, compact: true }): the same pieces and steps, closed up front to back, for a corner whose 3 m walks the full set overfills (ground.js hotspotSpot)' } },
  patrolCar: { w: 2.0, d: 4.7, h: 2.8, box: [-1, 0, -2.3, 1, 2.8, 2.4], anchor: 'base centre of the body, nose toward +z (the push bar adds 0.1 m)', place: 'road: a lane, like props.js copCar (1.8 m body in a 2.0 m lane)' },
};
