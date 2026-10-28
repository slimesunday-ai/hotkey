// Home objects · catalogue v2 · the base kit everyone gets, per tier (brief 2026-09-28 §5.5). Kit pieces are game.kind 'base': no buff,
// never stolen. Homes don't each differ: every home of a tier gets one of the preset layouts in assemblies/, built from this kit (plus
// plain store decor), and the owner's own items go in the layout's slots. RETAG adds tiers to wave-1 objects the kits now lean on.
export const KITS = {
  trailer: ['door-front', 'window', 'recliner', 'mattress-floor', 'bed-double', 'table-coffee', 'table-end', 'tv-crt', 'tv-console', 'kitchenette', 'dresser', 'crate-shelf',
    'wall-panelling', 'rug-rag', 'rug-shag', 'lamp-table', 'box-fan', 'ceiling-fan', 'photos-family', 'toilet', 'sink-bath'],
  apartment: ['door-front', 'window', 'futon', 'mattress-floor', 'crate-shelf', 'tv-crt', 'desk', 'computer-beige', 'radiator', 'ac-window', 'fridge', 'stove', 'counter-sink',
    'dining-set', 'dresser', 'bookshelf', 'table-coffee', 'table-end', 'rug-shag', 'lamp-table', 'toilet', 'bathtub', 'sink-bath', 'medicine-cabinet'],
  house: ['door-front', 'window', 'couch-house', 'recliner', 'bed-double', 'table-coffee', 'table-end', 'lamp-table', 'tv-console', 'dresser', 'wardrobe', 'dining-set', 'fridge',
    'stove', 'counter-sink', 'bookshelf', 'radiator', 'desk', 'rug-rag', 'rug-shag', 'photos-family', 'ceiling-fan', 'plant-monstera', 'lamp-arc', 'bar-home', 'stool-bar',
    'toilet', 'bathtub', 'sink-bath', 'medicine-cabinet'],
  penthouse: ['door-front', 'window', 'sofa-low', 'bed-platform', 'table-coffee', 'table-end', 'lamp-arc', 'bar-home', 'stool-bar', 'fridge', 'stove', 'counter-sink', 'wardrobe',
    'bookshelf', 'dining-set', 'desk', 'rug-persian', 'plant-monstera', 'art-print', 'toilet', 'bathtub', 'sink-bath', 'medicine-cabinet'],
};
// wave-1 objects given extra tiers (the kits and the layouts use them there)
export const RETAG = { poster: ['trailer'], 'crate-shelf': ['trailer'], stove: ['penthouse'], 'pizza-boxes': ['penthouse'], 'bed-double': [], 'table-end': [] };
