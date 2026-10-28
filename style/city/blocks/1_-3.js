// Block 1,-3 (x 32…64, z -96…-64) · Uptown (north of the court) · owner: the uptown location agent (LOCATIONS.md).
// Hand-crafting on top of generation: remove / move / replace generated items by id, tune lot specs, add one-offs, place people.
// Ids and coordinates come from ?audit=1 (red boxes) and audit.json. Format and examples: blocks/index.js. Empty = pure generation.
export default {
  remove: [],
  move: {},
  replace: {},
  lots: {},
  // add({ bank, stamp, A, SIDE, P, i, j }) { },
  people: { remove: [], move: {}, add: [] },
};
