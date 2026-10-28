// Pass 2 · THE DISTRICT KIT API (core, systems agent). One kit per plan district (world/city.js DIST: downtown, strip, suburbs,
// estates, trailer, industrial, docks, junkyard, jail, hospital, highway, bridge, mall, forest), one file each: districts/<name>.js,
// listed in manifest.js and loaded in isolation. A kit is DATA plus, optionally, its own block builder; the shared generator
// (gen.js + engine.js) owns every placement and clearance guarantee. DISTRICTS.md has the worked example.
//
//   export default defineKit({
//     district: 'suburbs', name: 'Pleasantview', owner: 'the Pleasantview + Gatehill agent', status: 'stub' | 'built',
//     built: 'all' | [[i, j], …],     blocks built at full detail (the rest of the district shows its far tier only)
//     adopt: [[i, j], …],             blocks of OTHER districts this kit builds (explicit; e.g. a strip kit taking a whole avenue)
//     grammar: { ...BASE, … },        the building grammar the shared generator reads (grammar.js): types, storeys, windows,
//                                     cornices, sign kinds, lot sizes, set pieces, one-offs, life
//     palette: { ...PALETTE, walls, neutral: { share: .35, … } },   wall colours + the neutral mix (30–40 % white / grey / brick)
//     lexicon: { ...LEXICON, shops, … },                           the sign voice: shop names, plaques, tags, boards
//     heroes: [{ id, block: [i, j], module: 'heroes/x.js', fn: 'buildX', far: true }],   hand-made set pieces, one module each
//     build(ctx) { … },               optional: build a block yourself with the engine helpers (engine.js); omit it to use the generator
//     far(ctx) { … },                 optional: the 0.5-cube far tier; omit it for the spec-pass far tier (generator kits only)
//     hooks: { lots: 'house', sites: { siteId: { x, z, r } } },   where the sim-state layer draws (anchors from ctx.anchor.*)
//     transit: [{ id, kind: 'subway' | 'bus' | 'taxi', name, x, z, rot }],  safehouses: [{ id, name, x, z }],
//     peds: { density: 1 },           multiplier on the sim's street demand (rules DEMAND) for this district's walkers
//     lamps: [[x, z, rot], …],        street lamps the kit stamps itself (props.js lampPost, head toward rot): the night's point lights
//                                     are lent to them like the corner lamps (main.js placeLamps) — stitch pass
//     cameras: { overhead, street: [a, b], landmark, night },   the fixed shot list (tools/shots.mjs); { pos, tgt, fov } or a rule
//     role: '…',                      the district's sim role in one paragraph (DISTRICTS.md prints it)
//   });
import { BASE, PALETTE, LEXICON } from '../grammar.js';
export const API = 2;
const DISTRICTS = ['downtown', 'strip', 'suburbs', 'estates', 'trailer', 'industrial', 'docks', 'junkyard', 'jail', 'hospital', 'highway', 'bridge', 'mall', 'forest', 'sea'];
const CAMERA_KEYS = ['overhead', 'street', 'landmark', 'night'];

export function defineKit(spec) {
  const problems = [];
  if (!DISTRICTS.includes(spec.district) && spec.district !== '*') problems.push(`district must be one of ${DISTRICTS.join(', ')}`);
  if (spec.build && typeof spec.build !== 'function') problems.push('build must be a function (ctx) → void');
  if (spec.far && typeof spec.far !== 'function') problems.push('far must be a function (ctx) → void');
  for (const h of spec.heroes || []) if (!h.module || !h.fn || !Array.isArray(h.block)) problems.push(`hero ${h.id}: needs { block: [i, j], module, fn }`);
  for (const k of Object.keys(spec.cameras || {})) if (!CAMERA_KEYS.includes(k)) problems.push(`camera "${k}": use ${CAMERA_KEYS.join(', ')}`);
  if (problems.length) throw new Error(`defineKit(${spec.district}): ${problems.join('; ')}`);
  const kit = {
    api: API, status: 'built', built: 'all', adopt: [], heroes: [], hooks: {}, transit: [], safehouses: [], peds: { density: 1 }, cameras: {}, role: '',
    ...spec,
    grammar: { ...BASE, ...(spec.grammar || {}) }, palette: { ...PALETTE, ...(spec.palette || {}), neutral: { ...PALETTE.neutral, ...(spec.palette?.neutral || {}) } },
    lexicon: { ...LEXICON, ...(spec.lexicon || {}) },
  };
  const heroAt = new Map(kit.heroes.map(h => [h.block[0] + ',' + h.block[1], h]));
  const built = kit.built === 'all' ? null : new Set(kit.built.map(([i, j]) => i + ',' + j)), adopt = new Set(kit.adopt.map(([i, j]) => i + ',' + j));
  kit.heroAt = (i, j) => heroAt.get(i + ',' + j) || null;
  kit.builds = (i, j, district) => (district === kit.district || adopt.has(i + ',' + j)) && (!built || built.has(i + ',' + j) || adopt.has(i + ',' + j));
  kit.owns = (i, j, district) => district === kit.district || adopt.has(i + ',' + j);
  return kit;
}

// the placeholder for a district with no kit yet (or whose kit failed to load): the standard grammar, far tier only unless ?stress=1
export const FALLBACK = defineKit({ district: '*', name: 'not built yet', owner: 'nobody yet', status: 'placeholder', built: [], role: 'placeholder massing until the district agent writes its kit', grammar: { ...BASE, walkway: .6 } });
