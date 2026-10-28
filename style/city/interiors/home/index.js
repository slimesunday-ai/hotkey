// AI City · home objects (interiors/home). The pieces a human places in their agent's home with the builder, and that generated homes
// draw on. Contract: ../FORMAT.md. Worker-safe (no three).
//   OBJECTS            every object: { id, name, set, cat, place, foot, h, mount, rot, tops, tiers, tags, variants, sim, build, far? }
//                      plus three optional fields the format may want to adopt (PASS.md): vnames (a label per variant), seat (the sitting
//                      height for seating and beds), states (sim pieces: build() also takes { state }; the first entry is the default)
//   volFor(o, far)     the Vol an object draws into (0.05 grain, or 0.1 for far): footprint cells × 5 cubes, height rounded up
//   buildObject(o, opt) → a filled Vol (opt: { variant, seed, state, far })
//   byId, CATS
import { volFor, farOf } from './lib.js';
import { LIVING } from './living.js';
import { MEDIA } from './media.js';
import { WALLS } from './walls.js';
import { COLLECT } from './collect.js';
import { SECURITY } from './security.js';
import { CLUTTER } from './clutter.js';
import { EXTRAS } from './extras.js';
import { CRIME } from './crime.js';
import { COLLECT2 } from './collect2.js';
import { WALL2 } from './wall2.js';
import { GEAR } from './gear.js';
import { BASE2 } from './base2.js';
import { TROPHIES } from './trophies.js';
import { DRESS } from './dress.js';
import { LIVED } from './lived.js';
import { GAME } from './game.js';
import { KITS, RETAG } from './kits.js';
export { KITS };
export { volFor };

export const CATS = ['seating', 'beds', 'tables', 'storage', 'electronics', 'gaming', 'music', 'decor', 'wall', 'rugs', 'lights', 'plants', 'kitchen', 'bath', 'collectibles', 'security', 'stash', 'clutter', 'trophies'];   // trophies: catalogue v2 (a FORMAT proposal)
export const TIERS = ['trailer', 'apartment', 'house', 'penthouse'];
export const OBJECTS = [...LIVING, ...MEDIA, ...WALLS, ...COLLECT, ...SECURITY, ...CLUTTER, ...EXTRAS, ...CRIME, ...COLLECT2, ...WALL2, ...GEAR, ...BASE2, ...TROPHIES, ...DRESS, ...LIVED]
  .sort((a, b) => CATS.indexOf(a.cat) - CATS.indexOf(b.cat));
for (const o of OBJECTS) { if (!o.game && GAME[o.id]) o.game = { ...GAME[o.id] };   // catalogue v2: the wave-1 objects' game blocks (game.js)
  for (const t of RETAG[o.id] ?? []) if (!o.tiers.includes(t)) o.tiers = [...o.tiers, t]; }
for (const o of OBJECTS) if (o.far === true) o.far = farOf(o);
export const byId = new Map(OBJECTS.map(o => [o.id, o]));
// catalogue v2: which sheet each new piece belongs to (preview.html ?view=v2&k=…)
export const V2 = new Map([[BASE2, 'base'], [GEAR, 'gear'], [CRIME, 'crime'], [COLLECT2, 'collector'], [WALL2, 'wallfloor'], [TROPHIES, 'trophy']].flatMap(([L, k]) => L.map(o => [o.id, k])));

// sanity at load: unique ids, known categories, placements and tiers (a bad entry throws here, not in the builder)
{ const seen = new Set();
  for (const o of OBJECTS) { if (seen.has(o.id)) throw new Error('home objects: duplicate id ' + o.id); seen.add(o.id);
    if (!CATS.includes(o.cat)) throw new Error(`home objects: ${o.id} has unknown cat ${o.cat}`);
    if (!['floor', 'wall', 'surface', 'ceiling'].includes(o.place)) throw new Error(`home objects: ${o.id} has unknown place ${o.place}`);
    if (!o.tiers.every(t => TIERS.includes(t))) throw new Error(`home objects: ${o.id} has an unknown tier`);
    if ((o.place === 'wall') !== (o.mount !== null)) throw new Error(`home objects: ${o.id} mount must be set for wall pieces only`); } }

export function buildObject(o, { variant = 0, seed = 1, state, far = false } = {}) {
  if (typeof o === 'string') o = byId.get(o);
  const V = volFor(o, far), opt = { variant, seed, state: state ?? o.states?.[0] };
  if (far && !o.far) return null;   // no far tier: too small to read from the street
  (far ? o.far : o.build)(V, opt); V.kind = o.id; return V;
}
