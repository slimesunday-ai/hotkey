// Block -1,-2 (x -32…0, z -64…-32) · Uptown (north of the court) · owner: the uptown location agent (LOCATIONS.md).
// Hand-crafting on top of generation: remove / move / replace generated items by id, tune lot specs, add one-offs, place people.
// Ids and coordinates come from ?audit=1 (red boxes) and audit.json. Format and examples: blocks/index.js. Empty = pure generation.
export default {
  remove: [],
  move: {},
  replace: {},
  // LOOK round (2026-10-06, art review item 10): the SW tower lot becomes THE VIG, the skyline's supertall (heroes/vig-tower.js); same lot,
  // same id, same footprint, only its build and far massing change
  lots: { L2: (spec) => { if (spec.type === 'tower') { spec.supertall = 'vig'; spec.corp = 'THE VIG'; } } },
  // add({ bank, stamp, A, SIDE, P, i, j }) { },
  people: { remove: [], move: {}, add: [] },
};
