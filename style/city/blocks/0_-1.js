// Block 0,-1 (x 0…32, z -32…0) · Glasswall Plaza · owner: the plaza location agent (LOCATIONS.md).
// The dealing corner at Kent St & 1st St lands in this block too: its props (ids 0_-1·corner·…) belong to the corners agent (blocks/corners.js).
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
