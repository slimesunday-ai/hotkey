// Pass 1d · who owns what. One location agent per entry; each owns exactly the files listed (and the override files of its blocks).
// Shared code (gen.js, facade.js, props.js, kit.js, vox.js, roofs.js, yards.js, setpieces.js, street.js, audit.js, stream.js, main.js…)
// stays with the systems agent. Blocks are [i, j] on the plan grid (x = 32 i … 32 i + 32, z = 32 j … 32 j + 32; −z is north).
const ov = (i, j) => `blocks/${i}_${j}.js`;
export const LOCATIONS = [
  { id: 'fitstreet', name: 'Fit Street (DROP)', kind: 'hero', blocks: [[-3, 0]], files: ['heroes/fitstreet.js', ov(-3, 0)] },
  { id: 'hall-of-justice', name: 'Hall of Justice', kind: 'hero', blocks: [[0, -2]], files: ['heroes/hall-of-justice.js', ov(0, -2)] },
  { id: 'precinct', name: 'Precinct 9', kind: 'hero', blocks: [[1, -1]], files: ['heroes/precinct.js', ov(1, -1)] },
  { id: 'plaza', name: 'Glasswall Plaza', kind: 'hero', blocks: [[0, -1]], files: ['heroes/plaza.js', ov(0, -1)] },
  { id: 'store', name: '24/7 Store', kind: 'hero', blocks: [[2, -3]], files: ['heroes/store.js', ov(2, -3)] },
  { id: 'bank', name: 'Glasswall Savings (bank)', kind: 'hero', blocks: [[-1, -1]], files: ['heroes/bank.js', ov(-1, -1)] },
  // the four dealing corners: their props are stamped into the blocks they land in, under the group `corner` (ids i_j·corner·kind·n)
  { id: 'corners', name: 'The dealing corners', kind: 'corners', blocks: [[0, -1], [-1, -1], [-1, 0], [0, 0]], group: 'corner', files: ['heroes/corners.js'] },
  { id: 'west-side', name: 'West Side', kind: 'neighbourhood', blocks: [[-3, -3], [-3, -2], [-3, -1], [-2, -3], [-2, -2], [-2, -1]] },
  { id: 'uptown', name: 'Uptown (north of the court)', kind: 'neighbourhood', blocks: [[-1, -3], [0, -3], [1, -3], [-1, -2]] },
  { id: 'east-side', name: 'East Side', kind: 'neighbourhood', blocks: [[1, -2], [2, -2], [2, -1]] },
  { id: 'south-row', name: 'South Row (Central Ave to Washington St)', kind: 'neighbourhood', blocks: [[-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0]] },
];
for (const L of LOCATIONS) if (L.kind === 'neighbourhood') L.files = L.blocks.map(([i, j]) => ov(i, j));
// the location an issue belongs to: corner-group items go to the corners agent, everything else to the block's owner
export function locationOf(key, group) {
  if (group === 'corner') return 'corners';
  const [i, j] = key.split('_').map(Number);
  for (const L of LOCATIONS) if (L.kind !== 'corners' && L.blocks.some(([a, b]) => a === i && b === j)) return L.id;
  return 'unassigned';
}
