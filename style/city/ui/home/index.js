// HUMAN LAYER · HOME: what the dossier's Home tab knows about where an agent lives (ui/dossier.js draws it).
//   city      their OWN home: the lot the store's public card names (lens.js PUBLIC_AGENT 'home', the same field the dossier's head has
//             always shown as "home …"), its kind (places.json tier: trailer · house · estate, drawn as a penthouse (SIMLIVE.md) ·
//             apartment, when the sim rents the walk-ups' apt: units), its address and district, and "Go there" (the camera to the lot).
//             Rule 5 holds: this is never where they ARE, and never a lot they don't own (someone else's lot stays a district).
//   mainland  the land across the water (style/city/mainland/). Claiming land isn't designed yet: everyone has "No land yet". With
//             ?mainland=demo a mock owner book (deterministic per handle) gives each agent one of the Mainland's 17 built plots, a picture
//             of its house (./img/<plot>.jpg, baked from the Mainland itself by ./tools/bake.mjs) and Visit: the Mainland at that plot
//             (?plot=<id>&visit=1, the plot card's own VISIT; there, the card's Go inside opens openMainlandInterior). Your own agent
//             (?as=) walks out of its own front door instead (&owner=<id>&walk=1).
import { placesNow } from '../goto.js';

export const KIND = { trailer: 'Trailer', house: 'House', estate: 'Penthouse', apartment: 'Apartment' };
// the city home: { id, kind, tier, name, dist, distName } | null (no home: sleeping rough)
export function cityHome(card) {
  const id = card?.home; if (!id) return null; const P = placesNow(), lot = P?.get(id) || null;
  const tier = lot?.tier || (String(id).startsWith('apt:') ? 'apartment' : null);
  return { id, tier, kind: KIND[tier] || 'Home', name: card.homeName || lot?.name || String(id).replace(/^(lot|apt):/, ''), dist: lot?.dist || null, distName: lot?.dist ? P?.distName(lot.dist) || lot.dist : '' };
}

// ── the Mainland (the ?mainland=demo mock)
const Q = new URLSearchParams(location.search), DEMO = Q.get('mainland') === 'demo';
export const mainlandDemo = () => DEMO;
// the Mainland's built plots (mainland/plots.json, status 'built'): id, address, the house's style (yard.js KIT names)
const PLOTS = [['ML-001', '1 Sunny Ct', 'porch'], ['ML-002', '3 Sunny Ct', 'gambrel'], ['ML-003', '2 Sunny Ct', 'ranch'], ['ML-004', '3 Sunny Ct', 'slab'], ['ML-005', '5 Sunny Ct', 'springfield'],
  ['ML-006', '7 Sunny Ct', 'trophy'], ['ML-007', '9 Sunny Ct', 'cape'], ['ML-008', '11 Sunny Ct', 'springfield'], ['ML-009', '2 Harbor Rd', 'cape'], ['ML-010', '1 Willow Bend', 'butterfly'],
  ['ML-011', '3 Willow Bend', 'cape'], ['ML-012', '3 Willow Bend', 'slab'], ['ML-013', '5 Willow Bend', 'gambrel'], ['ML-014', '7 Willow Bend', 'porch'], ['ML-015', '9 Willow Bend', 'butterfly'],
  ['ML-016', '11 Willow Bend', 'springfield'], ['ML-017', '13 Willow Bend', 'ranch']];
const STYLE = { springfield: 'The Springfield', trophy: 'The Trophy House', cape: 'The Cape', porch: 'The Gable-Front', ranch: 'The Ranch', gambrel: 'The Gambrel', slab: 'The Slab', butterfly: 'The Butterfly' };
const fnv = s => { let x = 2166136261; for (const ch of String(s)) { x ^= ch.codePointAt(0); x = Math.imul(x, 16777619); } return x >>> 0; };
// their Mainland plot: null (no land: always, until land claiming is designed) or, in the demo, { id, address, style, pic, visit, walk }
export function mainlandPlot(handle, { mine = false } = {}) {
  if (!DEMO || !handle) return null; const [id, address, style] = PLOTS[fnv(handle) % PLOTS.length];
  const base = new URL('../../mainland/index.html', import.meta.url), u = new URL(base); u.searchParams.set('plot', id);
  if (mine) { u.searchParams.set('owner', id); u.searchParams.set('walk', '1'); } else u.searchParams.set('visit', '1');
  return { id, address, style: STYLE[style] || style, pic: new URL(`./img/${id}.jpg`, import.meta.url).href, url: u.href, mine };
}
// a small pictogram per kind (flat blocks, currentColor; no outline)
const ICON = {
  trailer: '<rect x="3" y="11" width="24" height="10" fill="currentColor"/><rect x="6" y="13" width="5" height="4" fill="var(--k-bg-solid, #fff)"/><rect x="14" y="13" width="4" height="8" fill="var(--k-bg-solid, #fff)"/><rect x="27" y="18" width="3" height="2" fill="currentColor"/><rect x="7" y="21" width="4" height="4" fill="currentColor"/><rect x="20" y="21" width="4" height="4" fill="currentColor"/>',
  house: '<path d="M16 4l12 10H4z" fill="currentColor"/><rect x="7" y="14" width="18" height="12" fill="currentColor"/><rect x="10" y="17" width="4" height="4" fill="var(--k-bg-solid, #fff)"/><rect x="18" y="18" width="4" height="8" fill="var(--k-bg-solid, #fff)"/>',
  estate: '<rect x="8" y="3" width="16" height="25" fill="currentColor"/><rect x="5" y="3" width="22" height="3" fill="currentColor"/>' + [8, 13, 18].map(y => `<rect x="11" y="${y}" width="3" height="3" fill="var(--k-bg-solid, #fff)"/><rect x="18" y="${y}" width="3" height="3" fill="var(--k-bg-solid, #fff)"/>`).join('') + '<rect x="14" y="23" width="4" height="5" fill="var(--k-bg-solid, #fff)"/>',
  apartment: '<rect x="6" y="5" width="20" height="23" fill="currentColor"/>' + [8, 13, 18].map(y => `<rect x="9" y="${y}" width="4" height="3" fill="var(--k-bg-solid, #fff)"/><rect x="19" y="${y}" width="4" height="3" fill="var(--k-bg-solid, #fff)"/>`).join('') + '<rect x="14" y="22" width="4" height="6" fill="var(--k-bg-solid, #fff)"/>',
  none: '<rect x="4" y="22" width="24" height="3" fill="currentColor"/><path d="M8 22l8-10 8 10z" fill="currentColor" opacity=".35"/>',
};
export function kindIcon(tier) { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 32 32'); s.setAttribute('aria-hidden', 'true'); s.setAttribute('class', 'd-home-ic'); s.innerHTML = ICON[tier] || ICON.house; return s; }
export const noneIcon = () => { const s = kindIcon('house'); s.innerHTML = ICON.none; return s; };
