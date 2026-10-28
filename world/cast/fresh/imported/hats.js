// IMPORTED · hats from the old Trait Studio (deadnet-style-wardrobe, opus/wardrobe-diversity @ 4fc5c22), generated 2026-10-02 by the head
// import (reference/import/MANIFEST.md lists every slot: in, killed, left out). Each entry: the old display name, `origin` (the old page's
// collection: the studio's ORIGIN filter), `from` (the old slot/id: slime's decision key in reference/import/old-curation.json) and the
// adapter (./kit.js) that draws the old trait, in its base colours, on the fresh construction. Ids are the old ones under `old_`.
// Not here: every trait slime killed on the old page, and the ones listed as left out in the manifest. Edit an entry only to fix a
// clash, with the smallest change that keeps the old look (README § Imported traits).
import * as K from './kit.js';
export default {
  old_trucker: { name: "WWW trucker", origin: "original", from: "hat/trucker", ...K.hat("trucker") },
  old_bucket: { name: "title-bar bucket", origin: "original", from: "hat/bucket", ...K.hat("bucket") },
  // FIX (import audit: a socket ear item floated off it): a cover-'all' hat wraps the ears itself (README § Hats), and the old balaclava
  // clipped them off, so the knit now goes over each ear in its own colours (x −10 / 9, the ear's box). Nothing else changes.
  old_balaclava: { name: "balaclava", origin: "original", from: "hat/balaclava", ...K.hat("balaclava", H => {
    for (const x of [-10, 9]) for (let y = 23; y < 28; y++) for (let z = -1; z < 2; z++) H.set(x, y, z, (x & 1) ? 0x202024 : 0x18181b); }) },
  old_durag: { name: "durag", origin: "original", from: "hat/durag", ...K.hat("durag") },
  old_beanie: { name: "fisherman beanie", origin: "original", from: "hat/beanie", ...K.hat("beanie") },
  old_halo: { name: "beachball halo", origin: "original", from: "hat/halo", ...K.hat("halo") },
  old_beret: { name: "paint beret", origin: "original", from: "hat/beret", ...K.hat("beret") },
  old_fitted: { name: "flat-brim fitted", origin: "original", from: "hat/fitted", ...K.hat("fitted") },
  old_bandana: { name: "bandana", origin: "original", from: "hat/bandana", ...K.hat("bandana") },
  old_silkrag: { name: "silk durag", origin: "drop02", from: "hat/silkrag", ...K.hat("silkrag") },
  old_fuzzbucket: { name: "fuzzy bucket", origin: "drop02", from: "hat/fuzzbucket", ...K.hat("fuzzbucket") },
  old_holofitted: { name: "holo-sticker fitted", origin: "drop02", from: "hat/holofitted", ...K.hat("holofitted") },
  old_skully: { name: "high skully", origin: "drop02", from: "hat/skully", ...K.hat("skully") },
  old_tiedana: { name: "knotted bandana", origin: "drop02", from: "hat/tiedana", ...K.hat("tiedana") },
};
