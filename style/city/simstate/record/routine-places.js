import { CITY_PLACES, STANDS, SITES, DISTRICTS } from './places.js';
import { idHash } from './addresses.js';
import { createTrips } from './trips.js';
// The show owns its close and final movements. Re-export the pure planner so
// routines can consume that same plan after its public night frame arrives.
export { planShow } from './show-plan.js';

// Trips are pure in (agent, from, to, departure, walk). Replays and prefix
// planners share that service's cache rather than book identical routes again.
export const continuityTrips = createTrips();

// Scene anchors only. The drawing owns roof access, the booth and the parked car.
// Use the exported SKYLOT rooftop, with a measured exterior in its own district.
const roof = CITY_PLACES['downtown.fringe-garage'];
const exterior = Object.values(CITY_PLACES).filter(p => p.dist === roof.dist && STANDS[p.id]?.length)
  .sort((a, b) => Math.hypot(a.x - roof.x, a.z - roof.z) - Math.hypot(b.x - roof.x, b.z - roof.z)
    || a.id.localeCompare(b.id))[0];
export const MEETING_PLACES = Object.freeze({
  diner: SITES.diner,
  rooftop: Object.freeze({ corePlace: 'sitdown-rooftop', cityPlace: roof.id, district: roof.dist,
    standPlace: exterior.id, note: 'SKYLOT roof scene; travel uses its measured district exterior.' }),
  car: Object.freeze({ ...DISTRICTS.suburbs, corePlace: 'sitdown-car',
    note: 'Parked-car scene at the public Pleasantview park anchor; no private destination.' }),
});

export function meetingPlace(a, b) {
  const pair = [a, b].sort();
  const venue = ['diner', 'rooftop', 'car'][idHash(JSON.stringify(pair)) % 3];
  return { venue, place: MEETING_PLACES[venue] };
}

// GAME §41, 10-31: "Who and where show". The core names only a place
// kind; this is the single city mapping. No item, amount, target or terms.
// The orchestrator’s follow-up: words stay at the speaker’s current place;
// a stash needs only its actor; a jailed actor uses the visiting place.
// A keeper with no home carries the stash at its current public place.
export const ACT_PLACES = Object.freeze({
  home: Object.freeze({ errands: ['dress', 'offer', 'shop', 'sell', 'take'],
    note: 'Agent’s dealt home; the Heap when evicted.' }),
  'keeper-home': Object.freeze({ errands: ['stash_put', 'stash_take'],
    note: 'Crew keeper’s dealt home; keeper’s current place when homeless.' }),
  fence: Object.freeze({ errands: ['fence_list', 'fence_unlist', 'fence_buy', 'fence_swap', 'fence_accept', 'bounty'],
    place: SITES.fence, note: 'The Heap’s existing fence booth, using its measured exterior.' }),
  precinct: Object.freeze({ errands: ['bribe', 'bail'], place: SITES.precinct, note: 'Precinct 9.' }),
  meeting: Object.freeze({ errands: ['give', 'pay'],
    note: 'Pair’s existing diner, SKYLOT roof or parked car; detained pair visits at jail.' }),
  current: Object.freeze({ errands: ['tip', 'lookout', 'listen', 'chat', 'attempt', 'ask', 'answer', 'decline', 'say', 'close', 'crew_invite', 'write', 'plan', 'orders', 'note', 'creed'],
    note: 'Current public place; no trip for a phone, earpiece or unsuccessful attempt.' }),
});

export const homePlace = address => ({ corePlace: 'home', cityPlace: address.home, district: 'suburbs',
  lot: address.lot, standPlace: null });

export function actPlace(event, { book, agentOf, current }) {
  // Kind is the core’s fact; this table owns its presentation, including old archives.
  const kind = Object.keys(ACT_PLACES).find(key => ACT_PLACES[key].errands.includes(event.kind));
  const rule = ACT_PLACES[kind];
  if (!rule) throw new Error(`unmapped live act ${event.kind}/${event.place}`);
  const partner = ['agent', 'keeper'].includes(event.counterpart?.kind) ? event.counterpart.id : null;
  if (agentOf(event.agent)?.jailed || kind === 'meeting' && agentOf(partner)?.jailed) return SITES.jail;
  const rest = id => agentOf(id)?.evicted ? SITES.heap : homePlace(book[id]);
  if (kind === 'home') return rest(event.agent);
  if (kind === 'keeper-home') return agentOf(partner)?.evicted ? current(partner) : rest(partner);
  if (kind === 'meeting') return meetingPlace(event.agent, partner).place;
  if (kind === 'current') return current(event.agent);
  return rule.place;
}

// Names on a call or an escrow order are counterparts, not travelling cast.
// Only give/pay are physical two-agent hand-overs; public meet owns sit-downs.
export const actAgents = event => [...new Set([event.agent,
  ...(['give', 'pay'].includes(event.kind) ? [event.counterpart.id] : [])])];
export const phoneAct = event => ACT_PLACES.current.errands.includes(event.kind);
