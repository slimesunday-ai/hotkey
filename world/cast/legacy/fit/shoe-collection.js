// Surface designs share the three approved, motion-checked shoe forms.
// Painters receive coordinates only; only this module can place shoe voxels.
import { SHAPES } from './shoe-shapes.js';
import { DESIGNS as TERRACE } from './shoe-designs/terrace.js';
import { DESIGNS as LOWLINE } from './shoe-designs/lowline.js';
import { DESIGNS as FULLCOURT } from './shoe-designs/fullcourt.js';

const color = c => typeof c === 'number' ? c : parseInt(c.replace('#', ''), 16);
const forms = Object.fromEntries(SHAPES.map(shape => {
  const occupied = new Set(shape.cells.map(([u, y, z]) => `${u},${y},${z}`));
  const cells = shape.cells.map(([u, y, z, region]) => Object.freeze({
    u, y, z, region,
    outer: !occupied.has(`${u + 1},${y},${z}`),
    front: !occupied.has(`${u},${y},${z + 1}`),
    back: !occupied.has(`${u},${y},${z - 1}`),
    top: !occupied.has(`${u},${y + 1},${z}`),
  }));
  return [shape.id, cells];
}));

export const SHOE_COLLECTION = Object.fromEntries([...TERRACE, ...LOWLINE, ...FULLCOURT].map(design => [design.id, {
  ...design,
  cw: design.cw.map(([name, ...colors]) => [name, ...colors.map(color)]),
}]));

// Install after the legacy adapter. These cells already fit the rigid foot.
export function installShoeCollection({ SHOES, NEWT, NEWI, NAMES }) {
  for (const [id, trait] of Object.entries(SHOE_COLLECTION)) {
    const { name, tier, cw, why, shape, paint } = trait;
    NEWT.shoes[id] = [name, tier, cw, why];
    NEWI[id] = { id, slot: 'shoes', name, tier, cw, why, shape, new: true, origin: 'lower', collection: 'three-forms' };
    NAMES.shoes[id] = name;
    SHOES[id] = (grid, p = {}) => {
      const colors = cw[(((p.cw | 0) % cw.length) + cw.length) % cw.length];
      for (const side of [-1, 1]) for (const cell of forms[shape]) {
        const [tint, material = 0] = paint({ ...cell, side }, colors);
        grid.set(side < 0 ? -2 - cell.u : 1 + cell.u, cell.y, cell.z, color(tint), material);
      }
    };
  }
}
