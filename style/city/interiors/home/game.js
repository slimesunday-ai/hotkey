// Home objects · the game block (FORMAT.md, catalogue v2) for the 76 wave-1 + round-2 objects. The v2 modules carry their own block
// inline; index.js merges this table onto the older ones so EVERY object has one. The numbers are proposals: the sim owns the values.
//   base         no stakes: the tier kits (kits.js) and plain store decor (source says which)
//   gear         a buff tied to an existing sim mechanic; stealable when brought into the game
//   collectible  flex: buff.crib raises the home's crib value (and draws burglars); stealable
import { g, flex, base } from './bits.js';

const B = base(), S = base('store');
const sec = (mech, burgleOdds, rarity = 'common', extra = {}) => g('gear', rarity, 'store', { secure: mech, burgleOdds, ...extra });
const safe = (safeTake, rarity) => g('gear', rarity, 'store', { secure: 'safe', safeTake });
const stash = (stashTake, rarity = 'common') => g('gear', rarity, 'craft', { stashTake });
const lowkey = (heatDecay, rarity = 'common') => g('gear', rarity, 'store', { heatDecay });

export const GAME = {
  // seating, beds, tables, storage: the kits, plus two store pieces
  'couch-house': B, recliner: B, futon: B, 'sofa-low': B, 'stool-bar': B, beanbag: S, 'chair-puffer': flex('rare', 8),
  'bed-double': B, 'mattress-floor': B, 'bed-platform': B,
  'table-coffee': B, desk: B, 'table-end': B, 'dining-set': B, 'crate-shelf': B, dresser: B, wardrobe: B,
  // electronics + gaming: the old TVs are kit; a big flat screen and the consoles are "laying low" gear (heat decays faster at home)
  'tv-crt': B, 'tv-console': B, 'computer-beige': B, 'ac-window': B,
  'tv-flat': lowkey(1.15), 'computer-rig': lowkey(1.2, 'rare'), 'console-toastr': lowkey(1.2), 'console-yolk': lowkey(1.2), 'console-zigg': lowkey(1.2), 'gaming-setup': lowkey(1.3, 'rare'),
  // music
  boombox: S, speaker: S, turntables: flex('rare', 8),
  // wall, rugs
  'art-print': S, poster: S, 'photos-family': B, 'wall-panelling': B, 'art-graffiti': flex('rare', 12), 'art-big': flex('epic', 25),
  'rug-shag': B, 'rug-rag': B, 'rug-persian': B, 'rug-logo': flex('rare', 10),
  // lights, decor, plants
  'lamp-table': B, 'lamp-arc': B, 'ceiling-fan': B, 'plant-monstera': B, 'plant-cactus': S, 'lava-lamp': S, 'neon-sign': flex('common', 5), 'fish-tank': flex('rare', 8),
  // kitchen, bath
  fridge: B, stove: B, 'counter-sink': B, 'bar-home': B, toilet: B, bathtub: B, 'sink-bath': B, 'medicine-cabinet': B,
  // collectibles
  'sneaker-wall': flex('epic', 25), 'sneaker-boxes': flex('common', 6), 'card-display': flex('rare', 15), 'toy-case': flex('rare', 15), 'streetwear-rack': flex('rare', 10), 'grails-case': flex('grail', 50, 'drop'),
  // security: the sim's lock, alarm, dog and safe (FORMAT `sim`)
  'door-locks': sec('lock', -10), 'alarm-keypad': sec('alarm', -20, 'rare'), 'dog-bed': sec('dog', -25, 'rare'),
  'safe-small': safe(-.5, 'common'), 'safe-big': safe(-.8, 'epic'), 'safe-painting': safe(-.6, 'rare'),
  // stash spots: a burglar's stash take falls
  'stash-floorboard': stash(-.3), 'stash-book': stash(-.2), 'stash-vent': stash(-.3), 'stash-shoebox': stash(-.2),
  // clutter
  'pizza-boxes': S, 'laundry-pile': S, 'box-fan': B, 'sneakers-kicked': S,
};
