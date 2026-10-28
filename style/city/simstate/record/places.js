// Presentation only, at the city's default spread (4). Importable in node and the page.
// Read the city's export directly: no second coordinate/lot catalogue to drift.
import world from '../../../../world/export/world.json' with { type: 'json' };
import stands from '../stands.json' with { type: 'json' };

export const WORLD_SOURCE = world.generated;
export const CITY_PLACES = Object.freeze(Object.fromEntries(world.places.map(p => [p.id, Object.freeze({ ...p })])));
export const HOUSE_LOTS = Object.freeze(world.lots.filter(p => p.tier === 'house' && p.dist === 'suburbs')
  .map(p => Object.freeze({ ...p })).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
export const STANDS = Object.freeze(Object.fromEntries(Object.entries(stands.places).map(([id, p]) =>
  [id, Object.freeze(p.spots.map(s => Object.freeze({ x: s.x, y: s.y, z: s.z })))])));

function entry(corePlace, cityPlace, note = '') {
  const p = CITY_PLACES[cityPlace];
  if (!p) throw new Error(`no city place: ${cityPlace}`);
  // Kit estimates are not measured stands. Keep the real set, and name the nearest
  // measured exterior in the SAME district for travel/standing outside a cutaway.
  const nearby = world.places.filter(q => q.dist === p.dist && STANDS[q.id]?.length)
    .sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z) || a.id.localeCompare(b.id));
  const standPlace = STANDS[cityPlace]?.length ? cityPlace : nearby[0]?.id;
  if (!standPlace) throw new Error(`no measured exterior in ${p.dist}: ${cityPlace}`);
  const status = STANDS[cityPlace]?.length ? 'measured' : p.standsEst ? 'estimated' : 'none';
  return Object.freeze({ corePlace, cityPlace, district: p.dist, standPlace,
    stands: Object.freeze({ status, count: STANDS[cityPlace]?.length ?? p.stands, exteriorCount: STANDS[standPlace].length }),
    note: [note, status === 'measured' ? '' : `No measured stands at this set; exterior at ${standPlace}.`].filter(Boolean).join(' ') });
}
const table = rows => Object.freeze(Object.fromEntries(rows.map(([core, city, note]) => [core, entry(core, city, note)])));

// First two in each core district, in the exported city order. Surplus downtown
// Jay & 1st, strip Maple & Washington, trailer Birch & 2nd and Route 9 & Oak stay scenery.
// This keeps eight distinct corners and the core's district counts; no invented turf.
export const CORNERS = table([
  ['downtown-1', 'corner-1_-1'], ['downtown-2', 'corner-1_1'],
  ['strip-1', 'corner--1_1'], ['strip-2', 'corner--4_-1'],
  ['suburbs-1', 'corner-1_6'], ['suburbs-2', 'corner--1_6'],
  ['industrial-1', 'corner-3_-6'], ['docks-1', 'corner-2_-8'],
]);
export const DROPS = table([['mall', 'mall'], ['forest', 'woods'], ['junkyard', 'heap'], ['docks', 'docks']]);
export const DISTRICTS = table([
  ['downtown', 'store', 'Glasswall stickup set.'], ['strip', 'strip.no-witness', 'Neon Row club street.'],
  ['industrial', 'industrial.foundry', 'The Yards warehouse/crates set.'], ['suburbs', 'park', 'Pleasantview parked-car routine.'],
  ['docks', 'docks'], ['junkyard', 'heap'], ['mall', 'mall'], ['forest', 'woods'],
]);
export const SITES = table([
  ['lab-north', 'lab-north'], ['lab-west', 'lab-west'], ['lab-south', 'lab-south'],
  ['precinct', 'police'], ['vault', 'police', 'Evidence Vault shares Precinct 9; no separate vault place.'],
  ['docks', 'docks'], ['crate', 'docks', 'Shipment uses the docks set; no separate crate place.'],
  ['ferry', 'docks', 'SECOND CHANCE is sea.second-chance (districts/sea.js, block 4,-11), absent from the place export and stand table. Use its docks boarding set, never forest.ferry-landing.'],
  ['jail', 'jail'], ['heap', 'heap'], ['diner', 'strip.graveyard-diner'],
]);
export const ROUTES = table([
  ['downtown', 'plaza', 'Pleasantview → Glasswall → docks; this is the route scene anchor, not a computed trip.'],
  ['industrial', 'corner-3_-6', 'Pleasantview → The Yards → docks.'],
  ['junkyard', 'heap', 'Pleasantview → waterfront past The Heap → docks.'],
]);
export const HOME = Object.freeze({ corePlace: 'home', cityPlace: 'address', district: 'suburbs',
  note: 'Resolve to the agent’s dealt Pleasantview house lot; homes use doors/interiors, not shared outdoor stands.' });
export const PLACE_TABLE = Object.freeze({ corners: CORNERS, drops: DROPS, districts: DISTRICTS, sites: SITES, routes: ROUTES, home: HOME });

export function placeIn(table, key) {
  if (!Object.hasOwn(table, key)) throw new Error(`unmapped public place: ${String(key)}`);
  return table[key];
}
