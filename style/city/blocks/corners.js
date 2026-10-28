// The dealing corners' hand overrides · owner: the corners agent (LOCATIONS.md). Their props are stamped into whichever block they
// land in (group `corner`: ids i_j·corner·kind·n), so this file is keyed by block and merged into that block's override.
//   '-1_-1': { move: { '-1_-1·corner·crate·1': [0, 0, -.6] } }
export default {
  // cleanup pass (systems agent, the section-1 leftovers): Jay & 1st's blue crate stood in L0's facade parts; at Jay & Washington and
  // Kent & Washington the sitter's big head was in the corner lobby's wall: crate and sitter step 0.25 m off the wall and 0.5 m along
  '-1_-1': { move: { '-1_-1·corner·crate·1': [-.3, 0, -.55] } },
  '-1_0': { move: { '-1_0·corner·crate·1': [-.25, 0, -.5] }, people: { move: { '-1_0·char·3': [-.25, 0, -.5] } } },
  '0_0': { move: { '0_0·corner·crate·1': [.25, 0, -.5] }, people: { move: { '0_0·char·2': [.25, 0, -.5] } } },
};
