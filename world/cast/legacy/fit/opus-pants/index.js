// Opus pants: registration data only. Geometry is astra's approved ROOMY profile;
// these traits are review-only (NEWT/NEWI), so ordinary city rolls never pick them.
import { DESIGNS } from './designs.js';

// lower-traits.resolveBottom hands non-drop02 paint the full row (name first).
const colorsOf = row => (typeof row[0] === 'string' ? row.slice(1) : row);
export const OPUS_PANTS = Object.fromEntries(DESIGNS.map(d => [d.id, {
  ...d, collection: 'opus', paint: (q, row, index) => (q.covered ? d.paint(q, colorsOf(row), index) : [q.c, q.l]),
}]));

// A plain, quiet review shoe for pants cards: the approved tongue construction in
// greys, so the trousers carry the card instead of a loud colorway. Not a trait:
// it is never in NAMES/NEWT, the catalog, curation or the city roller.
export const CARD_SHOE_ID = 'opus_card_shoe';
const CARD = { outsole: 0x55575f, midsole: 0xe4e0d6, upper: 0x8d9097, tongue: 0xe4e0d6 };
export const CARD_SHOES = { [CARD_SHOE_ID]: CARD };
// cells: drop-collection's DROP_SHOE_CELLS, passed in to keep this module acyclic.
export function installCardShoes(registry, cells) {
  registry[CARD_SHOE_ID] = grid => {
    for (const side of [-1, 1]) {
      for (const q of cells) grid.set(side < 0 ? -2 - q.u : 1 + q.u, q.y, q.z, CARD[q.region], 0);
      for (let u = 0; u < 3; u++) for (let z = -1; z <= 1; z++) grid.set(side < 0 ? -2 - u : 1 + u, 3, z, CARD.upper, 0);
    }
  };
}
