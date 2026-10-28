// IMPORTED · hair from the old Trait Studio (deadnet-style-wardrobe, opus/wardrobe-diversity @ 4fc5c22), generated 2026-10-02 by the head
// import (reference/import/MANIFEST.md lists every slot: in, killed, left out). Each entry: the old display name, `origin` (the old page's
// collection: the studio's ORIGIN filter), `from` (the old slot/id: slime's decision key in reference/import/old-curation.json) and the
// adapter (./kit.js) that draws the old trait, in its base colours, on the fresh construction. Ids are the old ones under `old_`.
// Not here: every trait slime killed on the old page, and the ones listed as left out in the manifest. Edit an entry only to fix a
// clash, with the smallest change that keeps the old look (README § Imported traits).
import * as K from './kit.js';
export default {
  old_dreads: { name: "two-tone dreads", origin: "original", from: "hair/dreads", ...K.hair("dreads") },
  old_swoop: { name: "scene swoop", origin: "original", from: "hair/swoop", ...K.hair("swoop") },
  old_spikes: { name: "frosted tips", origin: "original", from: "hair/spikes", ...K.hair("spikes") },
  old_buzz: { name: "bleached buzz", origin: "original", from: "hair/buzz", ...K.hair("buzz") },
  // FIX (compat check: fresh eyewear/shop_specs' arms stood 2 proud of it): the sideburns stopped one short of the face (z 6), so a
  // frame's corner at the temple had nothing under it; they now reach the face's front edge (z 7), in the buns' own black.
  old_buns: { name: "space buns", origin: "original", from: "hair/buns", ...K.hair("buns", H => { for (const x of [-9, 8]) for (let y = 22; y < 33; y++) H.set(x, y, 7, 0x151214); }) },
  old_afro: { name: "afro", origin: "original", from: "hair/afro", ...K.hair("afro") },
  old_long: { name: "y2k straight", origin: "original", from: "hair/long", ...K.hair("long") },
  old_braids: { name: "box braids", origin: "drop02", from: "hair/braids", ...K.hair("braids") },
  old_mohawk: { name: "liberty mohawk", origin: "drop02", from: "hair/mohawk", ...K.hair("mohawk") },
  old_leopard: { name: "leopard buzz", origin: "drop02", from: "hair/leopard", ...K.hair("leopard") },
  old_opus_waves: { name: "360 waves", origin: "opus", from: "hair/opus_waves", why: "Brushed till the pomade rings ripple out from the crown, with a line-up you could cut paper on. Fits under every hat on the block.", ...K.hair("opus_waves") },
  old_opus_cornrows: { name: "straight-back cornrows", origin: "opus", from: "hair/opus_cornrows", why: "Five plaits front to back with the scalp showing in the parts, ending in short tails with metal cuffs at the nape.", ...K.hair("opus_cornrows") },
  old_opus_mullet: { name: "trailer mullet", origin: "opus", from: "hair/opus_mullet", why: "Business up front, party in the back: a feathered crop on top and a long, flicked-out back that still hangs out under a bucket or a beanie.", ...K.hair("opus_mullet") },
  old_opus_bowl: { name: "skate mop", origin: "opus", from: "hair/opus_bowl", why: "A heavy bowl that hangs over the ears and rests a fringe on the brows: the eyes still read, nothing else does.", ...K.hair("opus_bowl") },
  old_opus_hitop: { name: "hi-top fade", origin: "opus", from: "hair/opus_hitop", why: "A flat-topped box standing a hand tall off a faded side, the front edge a step higher. Biggest silhouette on the corner.", ...K.hair("opus_hitop") },
  old_opus_pony: { name: "snatched pony", origin: "opus", from: "hair/opus_pony", why: "Scraped back glossy into a high pony with a scrunchie; the tail lies down the back of the head, so it still swings out under a fitted.", ...K.hair("opus_pony") },
  old_opus_bunches: { name: "club-kid bunches", origin: "opus", from: "hair/opus_bunches", why: "Split-dye bunches flaring out from high on the head, a bobble at each root and blunt micro-bangs. Two colours, one per side.", ...K.hair("opus_bunches") },
  old_opus_bantu: { name: "bantu knots", origin: "opus", from: "hair/opus_bantu", why: "Parted into sections and coiled into knots: six on the crown, two each side, two at the back, the scalp showing in the parts.", ...K.hair("opus_bantu") },
  old_opus_slick: { name: "penthouse slickback", origin: "opus", from: "hair/opus_slick", why: "Combed straight back wet, the comb's teeth still in it, and a little flick at the collar. Money you can smell.", ...K.hair("opus_slick") },
  old_opus_pompadour: { name: "greaser pompadour", origin: "opus", from: "hair/opus_pompadour", why: "A lacquered roll that climbs a hand above the forehead and leans out over it, slicked sides and a duck tail at the back.", ...K.hair("opus_pompadour") },
  old_opus_razor: { name: "razor-art fade", origin: "opus", from: "hair/opus_razor", why: "A tight Caesar with a design razored into both sides, down to the skin: a bolt, a crown, slashes or a stone.", ...K.hair("opus_razor") },
  old_opus_softserve: { name: "soft-serve swirl", origin: "opus", from: "hair/opus_softserve", why: "The head is the waffle cone and the hair is the serve: five piped rings and a curl, with sprinkles. The truck is a front; the swirl is the flex.", ...K.hair("opus_softserve") },
};
