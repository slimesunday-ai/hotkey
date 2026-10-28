// IMPORTED · tops from the old Trait Studio (deadnet-style-wardrobe, opus/wardrobe-diversity @ 4fc5c22), generated 2026-10-02 by the tops
// import (reference/import/MANIFEST.md lists every slot: in, killed, left out). Each entry: the old display name, `origin` (the old page's
// collection: the studio's ORIGIN filter), `from` (the old slot/id: slime's decision key in reference/import/old-curation.json), the
// old `why` where it had one, and the adapter (./kit.js → ./tops-kit.js) that draws the old top, in its base colours, on the fresh
// body (flank and neckline from the old TOPFIT). Ids are the old ones under `old_`. Not here: the three tops slime killed on the old
// page (county jumpsuit, Mohair fuzz cardigan, Dynasty warm-up). Edit an entry only to fix a clash, with the smallest change that keeps
// the old look (README § Imported traits).
//
// PUFFY (README § Tops: padded outerwear may stand two proud, sleeves included): the old page's padded and fur outerwear, the tops built
// on its puffer, bubble and parka cuts (flank 2): the puffer, the bubble puffer, the fur coat, the Bankroll and Traffic-barrel puffers,
// the Snorkel parka, the Gator & mink jacket and the Mirrorball bomber (a bomber on the parka cut). Their sleeves were drawn two proud
// (or three: the five FIX entries below); every other old sleeve is one proud at most and needs nothing.
import * as K from "./kit.js";
export default {
  old_hoodie: { name: "box-logo hoodie", origin: "original", from: "top/hoodie", ...K.top("hoodie") },
  old_desktop: { name: "desktop hoodie", origin: "original", from: "top/desktop", ...K.top("desktop") },
  old_puffer: { name: "puffer", origin: "original", from: "top/puffer", puffy: true, ...K.top("puffer") },
  old_jersey: { name: "56K jersey", origin: "original", from: "top/jersey", ...K.top("jersey") },
  old_tee: { name: "graphic tee", origin: "original", from: "top/tee", ...K.top("tee") },
  old_bsodtee: { name: "bsod tee", origin: "original", from: "top/bsodtee", ...K.top("bsodtee") },
  old_varsity: { name: "varsity", origin: "original", from: "top/varsity", ...K.top("varsity") },
  old_track: { name: "rainbow track top", origin: "original", from: "top/track", ...K.top("track") },
  old_tank: { name: "ribbed tank", origin: "original", from: "top/tank", ...K.top("tank") },
  old_babytee: { name: "baby tee", origin: "original", from: "top/babytee", ...K.top("babytee") },
  old_velour: { name: "velour tracksuit", origin: "original", from: "top/velour", ...K.top("velour") },
  old_flannel: { name: "flannel over tee", origin: "original", from: "top/flannel", ...K.top("flannel") },
  old_catee: { name: "bodega-cat tee", origin: "drop02", from: "top/catee", ...K.top("catee") },
  old_tapetee: { name: "caution-tape tee", origin: "drop02", from: "top/tapetee", ...K.top("tapetee") },
  old_dyehoodie: { name: "tie-dye hoodie", origin: "drop02", from: "top/dyehoodie", ...K.top("dyehoodie") },
  old_trackjkt: { name: "track jacket", origin: "drop02", from: "top/trackjkt", ...K.top("trackjkt") },
  old_bball: { name: "04 mesh jersey", origin: "drop02", from: "top/bball", ...K.top("bball") },
  old_buffalo: { name: "buffalo-check overshirt", origin: "drop02", from: "top/buffalo", ...K.top("buffalo") },
  old_bootleg: { name: "bootleg rap tee", origin: "drop02", from: "top/bootleg", ...K.top("bootleg") },
  old_slabtee: { name: "graded-slab tee", origin: "drop02", from: "top/slabtee", ...K.top("slabtee") },
  old_chenille: { name: "chenille varsity", origin: "drop02", from: "top/chenille", ...K.top("chenille") },
  // FIX (the sleeve rule: three proud, x −11…−8, z −4…3): one layer slimmer each way (x −10…−8, z −3…2), the outer faces and the
  // grooves kept, the shell re-cut against it (tops-kit.js drop).
  old_bubble: { name: "bubble puffer", origin: "drop02", from: "top/bubble", puffy: true, ...K.top("bubble", { drop: { x: [-9], z: [-3, 2] } }) },
  old_leather: { name: "moto leather", origin: "drop02", from: "top/leather", ...K.top("leather") },
  // FIX (the sleeve rule: three proud front and back, z −4…3): one layer slimmer front and back (z −3…2), the fur faces kept, the
  // shell re-cut against it (tops-kit.js drop).
  old_furcoat: { name: "fur coat", origin: "drop02", from: "top/furcoat", puffy: true, why: "The boss coat: you only wear fur on this street if nobody can take it off you.", ...K.top("furcoat", { drop: { z: [-3, 2] } }) },
  // FIX (the sleeve rule: the bubble cut, three proud): as the bubble puffer, x −10…−8, z −3…2, the bills and grooves kept.
  old_opus_bankroll_puffer: { name: "Bankroll puffer", origin: "opus", from: "top/opus_bankroll_puffer", puffy: true, why: "The stacked-baffle puffer printed edge to edge in banknotes, a bank strap down the front: you wear the stack.", ...K.top("opus_bankroll_puffer", { drop: { x: [-9], z: [-3, 2] } }) },
  // FIX (the sleeve rule: the mink cuffs flared to x −11, three proud): the flare column is left out; the cuff rows stay mink in the
  // sleeve itself (tops-kit.js clip).
  old_opus_gator_mink: { name: "Gator & mink jacket", origin: "opus", from: "top/opus_gator_mink", puffy: true, why: "Gloss croc scales with a mink collar, mink lapels and mink cuffs, gold zip: the jacket that tells the block who owns it.", ...K.top("opus_gator_mink", { clip: { x: -10 } }) },
  old_opus_mirrorball: { name: "Mirrorball bomber", origin: "opus", from: "top/opus_mirrorball", puffy: true, why: "A bomber tiled in mirror squares that throw colour back at the street lights, fat knit rib at the collar, cuffs and hem.", ...K.top("opus_mirrorball") },
  old_opus_sukajan: { name: "Tiger sukajan", origin: "opus", from: "top/opus_sukajan", why: "A gloss satin souvenir jacket, two-tone with striped rib, a big flat tiger across the back and a bolt on the chest.", ...K.top("opus_sukajan") },
  // FIX (the sleeve rule: the bubble cut, three proud): as the bubble puffer, x −10…−8, z −3…2, the tape in the grooves kept.
  old_opus_barrel_puffer: { name: "Traffic-barrel puffer", origin: "opus", from: "top/opus_barrel_puffer", puffy: true, why: "Fat stacked baffles in construction-barrel stripes with reflective tape sunk in every groove: you can see it from the next block.", ...K.top("opus_barrel_puffer", { drop: { x: [-9], z: [-3, 2] } }) },
  old_opus_patch_denim: { name: "Collector's patch jacket", origin: "opus", from: "top/opus_patch_denim", why: "A trucker jacket covered in flat patches: a star, a bolt, sleeve flashes and a giant smiley across the back.", ...K.top("opus_patch_denim") },
  old_opus_racer: { name: "Pit-lane racing jacket", origin: "opus", from: "top/opus_racer", why: "Gloss nylon colour-block with a chequered-flag sleeve, a number roundel on the chest and V12 across the back.", ...K.top("opus_racer") },
  old_opus_snorkel: { name: "Snorkel parka", origin: "opus", from: "top/opus_snorkel", puffy: true, why: "A big matte parka with a fur ruff round the neck, the orange lining showing at the hem and huge flap pockets.", ...K.top("opus_snorkel") },
  old_opus_hivis: { name: "Dock hi-vis vest", origin: "opus", from: "top/opus_hivis", why: "A neon safety vest over a waffle thermal, reflective tape round the waist and over both shoulders.", ...K.top("opus_hivis") },
  old_opus_scrubs: { name: "Night-shift scrubs", origin: "opus", from: "top/opus_scrubs", why: "Short-sleeve scrubs in a loud print (pills, hearts or stars) with a chest pocket and a pen.", ...K.top("opus_scrubs") },
  old_opus_stripes: { name: "Lockup stripes", origin: "opus", from: "top/opus_stripes", why: "The cartoon convict top: fat horizontal bands all the way round and a big flat number across the back.", ...K.top("opus_stripes") },
  old_opus_windbreaker: { name: "Pier windbreaker", origin: "opus", from: "top/opus_windbreaker", why: "A gloss nineties windbreaker cut in zig-zag colour blocks, odd sleeves and a half-zip.", ...K.top("opus_windbreaker") },
};
