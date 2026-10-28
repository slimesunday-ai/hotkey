// The approved fuller trouser profile (roomy: the base kit's pants) and its knee-length cut (longshorts).
// A bottom opts into a profile by id (registry `form`); see world/fit/WARDROBE.md.
export const ROOMY = {
  id: 'roomy', name: 'Roomy', hem: 4,
  rows: [[5, -1, 1], [4, -2, 3], [4, -2, 3], [4, -2, 3], [4, -2, 3], [4, -1, 1]],
  cuts: [[4, 4, 1], [5, 3, 1], [5, 3, 2], [5, 3, 3], [6, 3, 1], [6, 3, 2], [6, 3, 3], [7, 3, 1], [7, 3, 2], [7, 3, 3], [8, 3, 2], [8, 3, 3], [7, 2, -2], [7, 3, -2], [8, 2, -2], [8, 3, -2]],
};
export const LONG_SHORTS = {
  ...ROOMY, id: 'longshorts', name: 'Long shorts', hem: 6,
  rows: [[3, -1, 1], [3, -1, 1], ...ROOMY.rows.slice(2)],
  cuts: ROOMY.cuts.filter(([y]) => y >= 6),
};
export const COLLECTION_FORMS = { roomy: ROOMY, longshorts: LONG_SHORTS };
