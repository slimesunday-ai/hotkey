# The reference board: the quality bar

`board-reference.jpg` is the bar every new district is held to. A reviewer agent puts a district's fixed shots (`node style/city/tools/shots.mjs <district>`) next to it at the same size. If a shot looks worse than the board, the shot is not done. The two TARGET tiles never change. The other tiles are replaced only by a better shot of the same kind, and the PASS notes say so.

Rebuild it (the tiles are git-ignored PNGs, so the board is the committed record):

```
python3 style/city/tools/board.py board-reference.jpg "AI CITY — REFERENCE BOARD (the quality bar)" "…" 4 "caption=path.png" …
```

## The tiles

| tile | source | what it holds the city to |
|---|---|---|
| **TARGET · street** | `springfield-street/shots/street.png` | The look slime picked, in the corner shot (eye 2.9, fov 54). One saturated flat wall per building, pale trims, ink fire escapes, fascia signs. The rooftop billboard carries a 4× character (BAIL BONDS · 1-800-GET-OUT). The DROP neon, a taxi and zebra crossings. The fog is exactly the horizon colour. |
| **TARGET · fit** | `springfield-street/shots/fit.png` | The people bar: big-head `chars.js` characters in brand-free streetwear (the Dazed/Hypebeast part), a velvet rope on brass posts, a lit shop interior, the sidewalk grid and curb. Every face and fit reads at a glance. |
| **NOW · overview** | `shots/pass2/overview-after.png` | The neutral mix (STYLE §2). About 37% of the buildings are white, grey or brick, so the colour lands in clusters, not confetti. Set pieces (pools, courts, billboards, the helipad) read from 150 m up, and the far third dissolves into the haze. |
| **Fit Street · roof party** | `shots/fitstreet/after-7-roofparty.png` | Roofs are places: a checkerboard deck, string lights, a water tank on its stand, a crowd where everyone has a job, and neighbours with gags (404.EXE · SANDWICH NOT FOUND). Everyone stands on the deck, and no head is in a railing. |
| **Fit Street · bar front** | `shots/fitstreet/after-10-bar-front.png` | Lettering craft. DEAD AIR in raised voxel letters on its band, and a framed OPEN card in a lit window. No text is off its board, and nothing is painted over. |
| **24/7 Store · front** | `shots/store/after-front.png` | A hero done right, with one idea: the 24/7 numerals on the roof. It has fascia stripes, a stocked window, sandwich boards (WIN · ICE · PROPANE), a NO LOITERING plate and a hatched no-parking bay. Every prop and person is on the ground and doing something. |
| **South Row · −2,0 Central Ave** | `shots/southrow/-2_0-central-ave-after.png` | A generated block at its best: COFFEE, NEWS, COMICS and LAG DELI with awnings, racks and crates, and people at door level. The avenue ends in a silhouette, a landmark in the fog. |

## Check every shot for

1. **Toon colour in clusters.** 30–40% of the buildings are neutral, and bold colour comes in runs, never confetti.
2. **Signs.** Every sign is legible and true to the lexicon (invented names, no real brands) with one idea each, and its text sits on its board.
3. **Props sit on things.** Nothing floats, sinks or clips into a wall (the audit proves it: `tools/audit.mjs district <name>`).
4. **People have jobs.** Poses read at a glance. In new districts, street life is the generic walkers plus whatever the section places.
5. **Street life at door level.** Awnings, crates, stoops, racks, bins and signs of use.
6. **Roofs are places.** Mostly calm and neutral, with 1–3 bold set pieces per block.
7. **Night.** The lit layer glows, windows split between lit and dark, and signs and lamps carry the street.
8. **Distance.** The far tier matches the fog: no pop, no seams, and every street axis ends in a silhouette.
9. **Handmade.** Neighbours never share colour, height, windows, cornice or sign kind (STYLE §7). If two blocks could swap places unnoticed, one of them is not done.

**Fails on sight:** pastel toy town, outlines, tiny planet, isometric views, realistic people, real brands, an empty sidewalk on a street shot, a district that is all neutral or all colour, and a grey sky or tinted fog.
