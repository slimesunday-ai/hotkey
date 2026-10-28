// Three independent clay studies. Front is +z; u runs from the inner edge out.
// Each line describes one quiet, continuous tier rather than decorative pieces.
function tiered(rows) {
  const cells = [];
  for (const [y, region, bands] of rows) {
    for (const [z0, z1, width] of bands) {
      for (let z = z0; z <= z1; z += 1) {
        for (let u = 0; u < width; u += 1) cells.push([u, y, z, region]);
      }
    }
  }
  return cells;
}

export const SHAPES = [
  {
    id: 'terrace',
    name: 'Terrace',
    note: 'A broad toe platform, close-fitting upper and measured three-step rise give the most balanced sneaker stance.',
    cells: tiered([
      [0, 0, [[-3, 5, 4]]],
      [1, 1, [[-2, 4, 4]]],
      [2, 1, [[-2, 3, 3]]],
      [3, 1, [[-1, 1, 3]]],
    ]),
  },
  {
    id: 'lowline',
    name: 'Lowline',
    note: 'A slim continuous upper leaves a visible sole ledge and a long low toe before the compact ankle rise.',
    cells: tiered([
      [0, 0, [[-3, 5, 4]]],
      [1, 1, [[-3, 4, 3]]],
      [2, 1, [[-2, 2, 3]]],
      [3, 1, [[-1, 1, 3]]],
    ]),
  },
  {
    id: 'fullcourt',
    name: 'Fullcourt',
    note: 'A fuller forefoot and deeper toe volume create the boldest front read while a narrow ankle keeps the mass grounded.',
    cells: tiered([
      [0, 0, [[-3, -3, 4], [-2, 4, 5], [5, 5, 4]]],
      [1, 1, [[-2, 4, 4]]],
      [2, 1, [[-2, -2, 3], [-1, 3, 4]]],
      [3, 1, [[-1, 1, 3]]],
    ]),
  },
];
