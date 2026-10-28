// Opus 2 pants: registration data only. Geometry is astra's approved ROOMY profile;
// these traits are review-only (NEWT/NEWI), so ordinary city rolls never pick them.
// collection 'opus2' puts them under the Trait Studio's "opus 2" origin.
import { DESIGNS } from './designs.js';

// lower-traits.resolveBottom hands non-drop02 paint the full row (name first).
const colorsOf = row => (typeof row[0] === 'string' ? row.slice(1) : row);
export const OPUS2_PANTS = Object.fromEntries(DESIGNS.map(d => [d.id, {
  ...d, collection: 'opus2', paint: (q, row, index) => (q.covered ? d.paint(q, colorsOf(row), index) : [q.c, q.l]),
}]));
