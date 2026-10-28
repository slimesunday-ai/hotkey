// LEGACY · THE OLD LOWER BODY (imported 2026-10-02 from deadnet-style-wardrobe, branch opus/wardrobe-diversity @ 4fc5c22, world/fit/).
// ISOLATED CONSTRUCTION for the imported bottoms and shoes only (world/fresh/imported/, README § Imported traits). Nothing in the fresh
// construction (world/chars.js, world/fit/, world/base-kit.js) or any fresh trait file imports world/legacy/.
//
// What this is: the old wardrobe modules the imported pants and shoes are drawn from, copied VERBATIM (byte for byte, `git show
// 4fc5c22:world/<path>`, no edits, their own relative imports unchanged) under world/legacy/fit/:
//   lower-traits.js · socks.js · pants-collection.js · pants-designs/{denim,sport}.js · drop-collection.js ·
//   drop-designs/{pants,shorts,shoes,socks}.js · opus-pants/{index,designs}.js · opus-pants-2/{index,designs}.js        (the pants)
//   shoe-collection.js · shoe-shapes.js · shoe-designs/{terrace,lowline,fullcourt}.js · shoe-archive.js ·
//   opus-shoes/shoes.js · opus-shoes-2/shoes.js · classic-shoes/shoes.js                                               (the shoes)
// (drop-designs/shorts.js, drop-designs/socks.js and socks.js come along because drop-collection.js and lower-traits.js import them: no short or
// sock is imported.) Then the old shoe install passes run in the old order (old chars.js 899–905) into this module's own tables, so
// SHOES holds the draw the old Trait Studio rendered for each shoe id. installShoeTraits (old shoe-traits.js, the six "sculpted shoe
// studies") is left out: slime killed all six. The pants need no install: the old compose resolved a bottom with resolveBottom (old
// lower-traits.js) and drew it on the leg form, which the fresh construction now owns (world/fit/leg-forms.js, the same forms).
// The import adapters (world/fresh/imported/lower-kit.js) read these. No three.js, no body, no compose.
import { resolveBottom, BOTTOM_TRAITS } from './fit/lower-traits.js';
import { PANTS_COLLECTION } from './fit/pants-collection.js';
import { DROP_BOTTOMS, DROP_SHOES, installDropTraits } from './fit/drop-collection.js';
import { OPUS_PANTS } from './fit/opus-pants/index.js';
import { OPUS2_PANTS } from './fit/opus-pants-2/index.js';
import { installShoeCollection } from './fit/shoe-collection.js';
import { installArchivedShoes } from './fit/shoe-archive.js';
import { installOpusShoes } from './fit/opus-shoes/shoes.js';
import { installOpus2Shoes } from './fit/opus-shoes-2/shoes.js';
import { installClassicShoes } from './fit/classic-shoes/shoes.js';

export { resolveBottom, DROP_SHOES };
// every old bottom design, by id (old lower-traits.js installBottomTraits' table)
export const BOTTOMS = { ...BOTTOM_TRAITS, ...PANTS_COLLECTION, ...DROP_BOTTOMS, ...OPUS_PANTS, ...OPUS2_PANTS };
// the old registries the install passes write into (old chars.js SHOES, NEWT, NEWI, NAMES), shoes only
export const SHOES = {}, NEWT = { shoes: {} }, NEWI = {}, NAMES = { shoes: {} };
// old chars.js 900–905, same order
installShoeCollection({ SHOES, NEWT, NEWI, NAMES });
installArchivedShoes({ SHOES, NEWT, NEWI, NAMES });
installDropTraits({ SHOES, NEWT, NEWI, NAMES });
installOpusShoes({ SHOES, NEWT, NEWI, NAMES });
installOpus2Shoes({ SHOES, NEWT, NEWI, NAMES });
installClassicShoes({ SHOES, NEWT, NEWI, NAMES });
