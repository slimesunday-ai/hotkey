// IMPORTED · skins from the old Trait Studio (deadnet-style-wardrobe, opus/wardrobe-diversity @ 4fc5c22), generated 2026-10-02 by the head
// import (reference/import/MANIFEST.md lists every slot: in, killed, left out). Each entry: the old display name, `origin` (the old page's
// collection: the studio's ORIGIN filter), `from` (the old slot/id: slime's decision key in reference/import/old-curation.json) and the
// adapter (./kit.js) that draws the old trait, in its base colours, on the fresh construction. Ids are the old ones under `old_`.
// Not here: every trait slime killed on the old page, and the ones listed as left out in the manifest. Edit an entry only to fix a
// clash, with the smallest change that keeps the old look (README § Imported traits).
import * as K from './kit.js';
export default {
  old_pale: { name: "pale", origin: "original", from: "skin/pale", ...K.skin("pale") },
  old_tan: { name: "tan", origin: "original", from: "skin/tan", ...K.skin("tan") },
  old_terracotta: { name: "terracotta", origin: "original", from: "skin/terracotta", ...K.skin("terracotta") },
  old_brown: { name: "brown", origin: "original", from: "skin/brown", ...K.skin("brown") },
  old_deep: { name: "deep", origin: "original", from: "skin/deep", ...K.skin("deep") },
  old_alien: { name: "alien", origin: "original", from: "skin/alien", ...K.skin("alien") },
  old_dialog: { name: "dialog", origin: "original", from: "skin/dialog", ...K.skin("dialog") },
  old_chrome: { name: "chrome", origin: "original", from: "skin/chrome", ...K.skin("chrome") },
  // FIX (import, the see-through gate): the checker's pure magenta 0xff00ff is the exact colour the gate reads as a hole into the body
  // (lit R > 200, G < 60, B > 200: the lab draws inside faces magenta), so every frame of this skin failed. The pink squares are now
  // 0xd050d0, the same magenta a step down, out of the gate's range under the lab's sun (tried: 0xf050f0 and 0xf064f0 still tripped
  // it); the black squares, the shade and the face colours are the old ones.
  old_missing: { name: "missing texture", origin: "original", from: "skin/missing", ...K.skin("missing", { recolour: { 0xff00ff: 0xd050d0 } }) },
  old_opus_golden: { name: "golden", origin: "opus", from: "skin/opus_golden", why: "Deli counters, bus drivers, the block's aunties: a warm golden tone that holds its colour under the noon sun.", ...K.skin("opus_golden") },
  old_opus_ebony: { name: "ebony", origin: "opus", from: "skin/opus_ebony", why: "The deepest tone on the island: night-shift security, the corner barber, the man who owns the laundromat.", ...K.skin("opus_ebony") },
  old_opus_freckle: { name: "freckled", origin: "opus", from: "skin/opus_freckle", why: "Bike messengers and stoop kids: a peach tone dusted with freckles on the nose, cheeks and shoulders.", ...K.skin("opus_freckle") },
  old_opus_vinyl: { name: "designer vinyl", origin: "opus", from: "skin/opus_vinyl", why: "A collector's agent cast as its own art toy: glossy bubblegum vinyl, still smelling of the box.", ...K.skin("opus_vinyl") },
  old_opus_inked: { name: "inked", origin: "opus", from: "skin/opus_inked", why: "The tattoo parlour's best customer: sailor bands, a heart for mom on each arm, dots across the knuckles, flash on the calves.", ...K.skin("opus_inked") },
  old_opus_gold: { name: "24k", origin: "opus", from: "skin/opus_gold", why: "The kingpin's agent, gold-plated after the first big score: every inch of it is the flex.", ...K.skin("opus_gold") },
  old_opus2_dissected: { name: "dissected", origin: "opus2", from: "skin/opus2_dissected", why: "The art toy's anatomy cut, walking around: clean vinyl down one side, muscle, bone and brain down the other. Museum gift shops can't keep it.", ...K.skin("opus2_dissected") },
  old_opus2_dipped: { name: "dipped", origin: "opus2", from: "skin/opus2_dipped", why: "The gallery opening's living brush: dipped head first in ultramarine pigment, hands dyed from the performance, blue to the shins.", ...K.skin("opus2_dipped") },
};
