# Locations: the work split after pass 1d

One agent per location. Each owns exactly the files listed for it and nothing else. The shared generator and engine (`gen.js`, `facade.js`, `kit.js`, `props.js`, `roofs.js`, `yards.js`, `setpieces.js`, `street.js`, `vox.js`, `audit.js`, `stream.js`, `main.js`, `heroes/common.js`, `blocks/index.js`, `locations.js`) stay with the **systems agent**. If you find a bug that shows up in more than one location, report it to the systems agent instead of working around it.

Block `[i, j]` covers x 32i…32i+32 and z 32j…32j+32; −z is north. Counts are from `AUDIT.md` (before = pass 1c geometry, after = pass 1d).

## How to work on a location

1. **Look.** Open `?audit=1` to see every open issue as a red box with a label. Use `?cam=x,y,z&look=x,y,z&fov=50` for any close-up (add `&shot=1` for a still).
2. **Name.** Every generated item has a stable id, `block·group·kind·n`: for example `-3_-2·L10·street-tree·1` (lot L10), `2_-3·store·structure·2`, or `-1_-1·corner·crate·1`. `audit.json` lists every id per block with its box (`blocks[].ids`), plus the people (`blocks[].people`).
3. **Hand-craft.** Change your block in its override file (`blocks/<i>_<j>.js`). You can remove, move or replace items by id, tune a lot's spec, add one-offs and place people. The format is documented at the top of `blocks/index.js`. Hero agents also edit their `heroes/*.js` module.
4. **Check fast (pass 2).** `node style/city/tools/audit.mjs block <i>,<j>` builds and audits just your block in seconds. `AUDIT.md` now also lists **walker pinches**, a new check: sidewalk spots where the generic walkers (`peds.js`) would pass through furniture. Hand-move or remove the item it names, then re-check.
5. **Gate.** Before you hand back, run `node style/city/tools/audit.mjs run <label>` and then `node style/city/tools/audit.mjs report before <label>`. Your location must show no new issues. Then look at your shots.

## Overview

| location | blocks | owns | issues before → after | refused placements |
|---|---|---|---|---|
| Fit Street (DROP) | −3,0 | `heroes/fitstreet.js`, `blocks/-3_0.js` | 47 → **7** | person 1 |
| Hall of Justice | 0,−2 | `heroes/hall-of-justice.js`, `blocks/0_-2.js` | 1 → 0 | none |
| Precinct 9 | 1,−1 | `heroes/precinct.js`, `blocks/1_-1.js` | 0 → 0 | none |
| Glasswall Plaza | 0,−1 | `heroes/plaza.js`, `blocks/0_-1.js` | 2 → 0 | street tree 1, bags 1 |
| 24/7 Store | 2,−3 | `heroes/store.js`, `blocks/2_-3.js` | 144 → **7** | street tree 3, bags 1 |
| Glasswall Savings (bank) | −1,−1 | `heroes/bank.js`, `blocks/-1_-1.js` | 132 → 0 | bags 1 |
| The dealing corners | props in 0,−1 · −1,−1 · −1,0 · 0,0 | `heroes/corners.js`, `blocks/corners.js` | 5 → **1** | none |
| West Side | −3,−3 · −3,−2 · −3,−1 · −2,−3 · −2,−2 · −2,−1 | `blocks/` for those 6 | 823 → 0 | 14 (trash cans, trees, bags, planters, 2 people) |
| Uptown | −1,−3 · 0,−3 · 1,−3 · −1,−2 | `blocks/` for those 4 | 550 → 0 | 15 (trees 5, trash cans 4, bags, planters, 2 people) |
| East Side | 1,−2 · 2,−2 · 2,−1 | `blocks/` for those 3 | 363 → 0 | 10, including **a giant shop object** |
| South Row (Central Ave to Washington St) | −2,0 · −1,0 · 0,0 · 1,0 · 2,0 | `blocks/` for those 5 | 396 → 0 | 20, including **the newsstand, a moving-day scene and 2 giants** |

## Heroes

**Fit Street (DROP)**, block −3,0. It has 7 open issues.
- The DEAD AIR and BAR · GRILL neon names hang two rows below the bar's black fascia. The fascia starts at row 30, so it should start at row 27, as the tower name bands now do (`-3_0·bar·structure·0`).
- The OPEN neon in the bar window is half inside the window frame.
- Four display columns in the DROP vitrine float 0.7 m above the shop floor (`-3_0·drop·structure·0`, see `shots/audit-fitstreet-bar.png`).
- The parts are now clipped against each other through `planParts`. Keep those rectangles in step if a part changes size.

**Hall of Justice**, block 0,−2. It is clean.
- Only the plaza face carries an identity: the pediment name, the steps and the people. The other three faces share one window rhythm, and the north face toward Uptown is plain. It needs a hand detail there.

**Precinct 9**, block 1,−1. It is clean.
- Nearly everything sits on the Kent St face: the giant 9, the green lamps and the steps. The south face has the garage doors, and the north and east faces are one blue wall of gridded and barred windows.
- The two cruisers are hand-placed at fixed coordinates.

**Glasswall Plaza**, block 0,−1. It is clean.
- The Kent St & 1st St dealing corner lands in this block, but it belongs to the corners agent.
- The only people are 4 bench sitters and 3 standers, which is thin for a plaza.

**24/7 Store**, block 2,−3. It has 7 open issues (see `shots/audit-store.png`).
- The rooftop 24/7 letters hover one voxel above their iron bar (`2_-3·store·structure·2`).
- Two colour panels float in the storefront opening.
- The lot's asphalt (`2_-3·store·structure·1`) overlaps the storefront base and the facades of L6 and L7 by one voxel. It should start one voxel in.

**Glasswall Savings**, block −1,−1. It is clean: 132 issues were fixed, mostly in its generated west lots.
- Only the east face has the portico. The Jay St & 1st St crew is crammed against a west lot's shopfront (corners agent).

## The dealing corners

These are four sim places on intersections. Their props are stamped into the blocks they land in, with ids `i_j·corner·kind·n`. Each corner's zone is now reserved before the block is built, so lots, scenes and trees keep out of it.
- **1 open issue:** at Jay St & 1st St, the red crate sits inside the COUNTY CUTZ shopfront base (`-1_-1·corner·crate·1`, see `shots/audit-corner-jay-1st.png`).
- **Weakest:** the kit needs about 2.5 × 2.5 m: a booth, two crates, bags and 3–4 people. A corner's L-shaped sidewalk is only 2 m wide, so the kit pushes into shopfronts. Lay the kit out along the sidewalk arms in `heroes/corners.js`, and nudge individual corners in `blocks/corners.js`.

## Neighbourhoods (generated blocks)

**West Side**: −3,−3 · −3,−2 · −3,−1 · −2,−3 · −2,−2 · −2,−1. It is clean (823 issues fixed).
- The narrow side streets are busy and read well (see `random-3`).
- Weakest: the yards read emptier. Props now need a clear footprint, so couches, sheds and yard cars dropped in number, and only 3 sheds were placed across the city.
- The pocket plazas use the slim tree now. Check that they don't read bare.

**Uptown**: −1,−3 · 0,−3 · 1,−3 · −1,−2. It is clean (550 issues fixed).
- Loft names now sit on painted boards across the top floor. Check that they read as signage, not patches.
- 5 street trees were refused where awnings, blades and fire escapes run continuously, so some blocks are bare of trees.

**East Side**: 1,−2 · 2,−2 · 2,−1. It is clean (363 issues fixed).
- Block 2,−1 has no giant shop object: no clear spot was found on L0's facade. Hand-place one with `add()` in `blocks/2_-1.js`.
- The roof-garden bench in 2,−2 moved onto open turf. Check that the garden still composes.

**South Row**: −2,0 · −1,0 · 0,0 · 1,0 · 2,0. It is clean (396 issues fixed), but it lost the most.
- The pass-1 **newsstand** on Ivy St no longer fits: a 2.8 m kiosk can't stand under the awnings. Hand-place it in `blocks/-2_0.js`, perhaps on Central Ave.
- Block −1,0 has **no one-off scene**: the moving day found no doorless frontage.
- Blocks 0,0 and 2,0 have **no giant object**.
- 5 people were refused.
- These are the sparsest blocks now.

## Shared notes for every agent

- Street trees are the slim kind now: a tall trunk and a crown ±1 m from 3.6 m up. 59 were placed and 15 refused under awnings, blade signs or fire escapes.
- 9 of 12 giant shop objects found a clear spot on their facade.
- Generated shop display windows are open now. Before, the band sealed them, so displays and stickers were invisible. They are the new ground-floor detail, so compose around them.
