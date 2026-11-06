# Interior view: how premium cozy / dollhouse home views do it (2026-10-06)

The brief: the Mainland house's interior view (`interiors/city/mainland.js`) is "a bit basic": a cutaway floating on a flat green slab in a
flat sky-blue void, with flat light, no shadows, no context and no post. A short look at the games that do this well. Notes come from
playing and watching these games, plus the links. Where a claim comes from a link, the link is given.

| game | context | light | materials and the cut | camera and presentation |
|---|---|---|---|---|
| **The Sims 4** | The lot sits in its neighbourhood. The yard, the street and the neighbours' houses stay drawn around the cutaway at lower detail. | The sun moves with the time of day. Windows let daylight in, and lamps make warm pools at night. Build/Buy mode has a day/night toggle ([hotkeys](https://www.magicgameworld.com/the-sims-4-build-mode-hotkeys-keyboard-shortcuts/)). | **Walls Up / Cutaway / Walls Down** ([EA forum](https://forums.ea.com/discussions/the-sims-4-gameplay-en/request-to-add-another-walls-up-view/8654173)). A cut wall shows its thickness as a clean cap. Skirting, trim, wallpaper and floor are chosen per room. | A three-quarter orbit with clamped pitch, and zoom from lot to room. Cutaway hides only the walls between the camera and the room. |
| **Animal Crossing: Happy Home Paradise / Happy Home Designer** | No exterior. The room is a box, and the open front faces the camera. | Soft, warm ambient light with strong AO in the corners. HHP adds per-room lighting colour and brightness sliders ([Nintendo Life](https://www.nintendolife.com/guides/animal-crossing-new-horizons-lighting-how-to-change-lighting-in-the-happy-home-paradise-dlc)). | Partition walls, pillars and counters split one room into zones ([Real Homes](https://www.realhomes.com/features/happy-home-paradise-pillars-counters-partition-walls)). Every wall and floor has a pattern. | A fixed high three-quarter view, a gentle zoom, and nothing to fight with. |
| **Unpacking** | Rooms hang in a void ([Mechanics of Magic](https://mechanicsofmagic.com/2024/06/10/mcmai-rwp-unpacking-week-7/)). The void works because the frame is the art. | Daylight is painted in through the windows, and the rooms change with the life stage. | Pixel-exact isometric. The floor slab and the wall caps read as a clean section ([Game Developer interview](https://www.gamedeveloper.com/design/unpacking---witch-beam)). | One fixed isometric view, the room centred, with generous margins. |
| **Tiny Glade** | The building sits in a meadow that runs to soft, hazy edges. You never see an end to the world. | **Lighting is the product.** Ray-traced GI and reflections give the warm pastel look ([Wikipedia](https://en.wikipedia.org/wiki/Tiny_Glade)). A low warm sun, a cool sky fill, long soft shadows, and bounce in every corner. | Simple shapes with soft, bevelled edges. Ground contact (AO, grass round the base) seats everything. | A slow orbit and a tilt-shift-like softness at the frame edges, which reads as a miniature. |
| **Townscaper** | A small town on water under a gradient sky. Fog fades the far sea into the horizon. | Soft sun shadows and strong AO. Windows glow at night. | Pastel blocks with a few repeated trims (cornices, sills, frames). | A free orbit around the island with the horizon always in frame. |
| **House Flipper** | First person. The "after" moments are framed shots of a finished room. | Practical lights and sunlight through the windows sell the finished room. | Floor and wall materials change per room (bathroom tile, kitchen tile, wood). | An inspection-style camera. Not a model for us beyond the per-room finishes. |
| **GTA / Hitman property showcases** | The property sits in its city. Windows and balconies look out on it. | Warm practical lights against a cooler outside. | Real materials. We skip the grime. | Slow cinematic pushes with shallow depth of field and a low eye line, which make a room feel expensive. |

## What makes these feel premium (the four we can steal)
1. **Context, not a void.** The home sits on its own lot (yard, fence, path, car), and the neighbourhood fades into atmosphere behind it
   (Sims, Townscaper, Tiny Glade). Unpacking's void only works because its frame is pixel-perfect. Ours isn't, so we need the context.
2. **Light carries the look.** A warm key and a cool sky fill, soft sun shadows, contact shadows or AO under every object, daylight through the
   windows, and warm practical pools at night (Tiny Glade, Sims). Flat even light is what reads as "basic".
3. **The cut reads as architecture.** Cut walls show thickness and a cap, with skirting, ceiling trim, door and window frames, and a finish per
   room (tile in the bathroom and kitchen, wood, rugs, wallpaper) (Sims, Happy Home Paradise, Unpacking).
4. **Camera and post.** A lower, slightly cinematic three-quarter view, a clamped orbit, a little edge softness (the miniature cue), and one
   consistent colour grade with the rest of the game (here: the city's Camcorder '98 stack).

## What we did with it
See `style/city/interiors/city/README.md` ("Interior view art pass"): the real lot from `mainland/houses.js` `buildLot` with the house
clipped out, two faded neighbour lots and the street, the city's sky dome and fog, the warm key and cool fill with a soft shadow
map, contact blobs under every piece, window light and lamp pools, two-sided walls with caps and a crown line, per-room finishes, the
city's post stack (`render/post.js`) with the default look, and a lower three-quarter camera with a clamped orbit and edge depth of field.
