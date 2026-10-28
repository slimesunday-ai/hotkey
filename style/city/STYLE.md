# Springfield Street: the style contract

Rules for any block of AI City. Numbers match `style.js`; names live in `lexicon.js`.

## 1. Units and toon scale
- **City voxel = 0.1 = 2 × S** (`S = 1/20`): one city cube = 2×2×2 character cubes. Characters are about 1.75 tall. **Size everything to the big-head body.**
- **Grain**: 0.1 city cubes; 0.2 for tower shafts and mid tiers, 0.5 for far tiers, 1.0 for landmarks; small signs may use 0.05.
- **Storey** 3.0; shop ground floor 3.6. **Door** 1.4 × 2.4. **Window** 1.1–1.4 × 1.6–2.1, recessed 0.3, with trim, sill and cap.
- **Counter**, rope, bench back 0.7; bench seat 0.5.
- **Stoop**: rise 0.2, run 0.3, landing 1.2; the mass steps back, never the sidewalk.
- **Curb** 0.2. Sidewalk 2.0 and lanes come from the plan.
- **Car** 1.8 × 4.2 × 2.1, cabin fits a big head. **Lamp post** 5.6; hydrant 0.8.

## 2. Colour: one flat colour per building
- **Each building mass is one flat colour.** No gradients or grime, and neighbours never share one.
- **The neutral mix (pass 2, slime's default): 30–40% of a district's buildings are white, grey or neutral brick** (`NEUTRALS` in `grammar.js`: white `#F4F1EA`, bone `#E6E1D6`, pale `#D3D4D7`, grey `#A7A9B1`, slate `#6D707A`, brick `#9B4F3A`, buff `#C49A6C`). The rest are saturated.
  - Two noise fields decide which buildings (`neutral.js`), so neutral buildings come in runs and whole blocks lean one way. Colour lands in **clusters**, never confetti.
  - Towers and offices lean neutral, and small shops keep their colour.
  - A neutral wall gets a contrasting trim: ink or grey on white, now and then an accent; cream or white on brick.
  - Kits set the share: `palette.neutral.share`, where downtown is 0.36.
- **Walls**: `#FFC21A` `#EF4A2A` `#FF4FA3` `#7A3CFF` `#FF7A1A` `#25B84C` `#3FA9F5` `#2F5BFF` `#12B3A0` `#8C52FF` `#E83B5B` `#FF8A1F`
- **Trim** `#FFF0D0` / `#F7F7F2`, sometimes ink or a sign colour. **Ink** `#17171B` for storefront bands, fire escapes, frames.
- **Glass** `#1B2A55` → `#3F6BC4`, with a `#EAF6FF` glint; lit `#FFC766` → `#FFE3A0`.
- **Signs and awnings**: green `#14A83B`, red `#E8232A`, yellow `#FFE23A`, lime `#6CFF4A`, cyan `#2DE2E6`, pink `#FF4FA3`.
- **Roofs are neutral** (`ROOFS` in `lexicon.js`): tar, gravel, warm concrete, light greys, white; the parapet top reads neutral from above. **Colour on roofs lives only in set pieces** (§6).
  - **Weighted dark (look round, 2026-10-06):** four tars, six gravel and concrete greys, one warm concrete and one white of twelve, so the roofscape sits darker than the walls and the set pieces from above (value hierarchy, not confetti). A dark roof's coping is its own grey lifted, never a white rim.
- **Ground**: asphalt `#5D5E6B`, sidewalk `#CDC5B8`, curb `#ECE8DF`, lanes `#F4F3EE` / `#FFC41F`.
- **Water** (`water.js`, look round): three flat bands by distance to shore, teal `#2AB7C6` to 4.5 m, sea blue `#2E8FD9` to 13 m, cobalt `#2A6CD0` beyond, stepped on a 0.2 m grid; a stepped white foam line `#F4F8FB` on every shore and a pale `#CFE6F4` broken line beyond it; a white waterline band on every hull, pile and rock (`gpu.js` WATER). Glitter by day, lamp streaks by night. No reflections, no normal maps, no waves in geometry.
- **Never**: pastel walls; grey, white or brick outside the neutral mix; beige mush; coloured roof membranes; pastel anything on a roof.

## 3. Light, shadow, tone
- **Sun**: one directional, `#FFF2DC` at 3.0, south-west, about 48°. Hard PCF shadows fitted per view, cached (1024/2048/4096 by preset).
- **Fill**: hemisphere `#D6ECFF` / `#E0CFB0` at 1.05, plus a sky-gradient environment at 0.55.
- **Tone mapping**: `NeutralToneMapping` at 1.0.
- **Characters and buildings share every light** and the MeshStandard model; corner AO uses the `chars.js` curve (0.55 / 0.72 / 0.87 / 1). Only neon, screens, lamps and lit windows are unlit.
- **Night**: moon `#8FA4FF` at 0.35, exposure 1.25, half the windows lit, signs glowing, lamp point lights. The lights hang under the corner lamps nearest the camera, anywhere on the island (`ground.js cornerLamps`), and a lamp's bulb is a warm `#FFE3A0` panel 0.3 × 0.4 m set flush in the underside of its head, seen only from below (cleanup pass: the pale slab hung under the head read as a blown-out patch).

## 4. Sky and distance haze
- **Sky dome**: zenith `#2F9BFF` → horizon `#9FDCFF`, cubic clouds.
- **The distant fade is `THREE.Fog` in exactly the horizon colour**, never exponential or tinted. It must be clearly visible and soft at every height, never a clear, sharp far city (pass 1d, `FADE` in `main.js`):
  - **Street level is the first example exactly: 90 → 380.**
  - **Overhead the band tightens, to 150 → 340 at the overview.** From 150 m up, the camera sees only about 260 m of depth, so the centre stays crisp and the far third dissolves into the horizon.
  - Between the two, it blends smoothly with camera height (6 → 150 m).
  - **It always closes at 0.92 × the draw distance.**
- **The fade does the loading work.** Blocks appear and disappear only behind the band, and mid→far swaps happen inside it. Every new block, and every tier swap, dissolves in over 0.5 s with a dither, with the outgoing tier dithering out in the complementary pattern. Nothing pops.
- **Every far mesh takes the fog:** far tiers, the ring, skyline silhouettes, ground, curbs and far character boxes. Only the sky dome is exempt.
- **`?blur=1` is optional and off by default.** It is a depth blur that starts at 120 m and ramps to 2.4 px at 480 m (per 1000 px of frame), with no near blur and no focus band. It exists only to compare against the fade; it must never read as tilt-shift.
- **Every street axis ends in a silhouette**: far-tier blocks, landmarks 180–320 out.

## 5. Camera
- **Street (default)**: eye 2.6–3.6, fov 50–58, looking down a street; orbit up. Reference: the corner shot, eye 2.9, fov 54, centreline, 16 past the intersection.
- **Close-ups**: eye 1.3–1.6, fov 40–46. **Overview**: about 55° down, fov 42–44.
- **Banned**: orthographic, isometric, tiny planet, fisheye.
- **Street views by rule, never by hand-tuning**: stand on the street's centreline.
  - **Wide streets** (≥ 12 m facade to facade): 16 m before the intersection, target 26 ahead and 6 toward the block (the corner shot).
  - **Narrow streets**: prefer the end where an avenue crosses. Stand at its mouth (behind the crossing's far curb) and look straight down the centreline, fov 56. The crossing is the open foreground.
  - **Narrow into narrow**: 3 m back past the crossing, eye 3.3, fov 50, centred. No near wall fills the frame.

## 6. Density minimums (every block, every section)
- **Every building carries an identity**: shop sign, blade, neon, named awning, canopy, plaque, mural, ghost sign, painted ad or gag.
- **Roofs are mostly calm**: a neutral membrane with a stair hatch, usually a few AC units and vents, some fully plain. All small clutter is neutral. Water tanks on stands **only on buildings of five storeys or more**, in varied builds.
- **1–3 roof set pieces per block** (`setpieces.js`), **bold saturated colour, big enough to read from the overview** (about 6 px per metre).
  - The pieces: burger on a tank stand, billboard with a 4× character, pool, basketball court, tilted neon frame, roof garden, disco party, giant sneaker, boxing ring, grow-op greenhouse, painted roof throw-up, giant pizza, cash stack.
  - Biggest and tallest roofs first, at least 10.5 m apart.
  - **Only set-piece roofs have people.**
- **Calm areas**: rests between the busy bits.
  - 60% of generated blocks turn one mid-row lot into a pocket plaza or a green (paving or grass, cubic trees, a bench).
  - Yards use neutral fences and sheds and more trees.
  - Parking and plain roofs count as rests: busy bits read as clusters, not noise.
- **Commercial ground floors** are continuous shopfronts: sign, stocked display window, door, and a sticker, gate or sandwich board. Wide frontages split into two shops.
- **Residential ground floors**: a stoop or lamp-lit entry, planters, cans, bikes.
- **Exposed side walls** get paint (the biggest per block is a mural, one a character face; the rest ghost signs, painted ads, pipes). **Back walls** get windows, AC, downspouts, fire escapes.
- **Block interiors**: yards per lot (fences, paving, grass), sheds, hoops, cars, tables, gardens, trees, laundry; most blocks get a service alley.
- **Life: 12–22 `chars.js` characters per block** in section 1, each doing something specific (talking, carrying, phone, leaning, stoops, windows, fire escapes, set-piece roofs, yards). **New districts place no static people:** generic walkers fill the sidewalks (§11), and hand-placed people are only for heroes and one-off scenes.
- **One one-off scene per block**: domino table, curb couch, car on blocks, food cart, moving day, yard sale.
- **One big gag per block**: a giant shop object or a rooftop billboard (which counts as a set piece).

## 7. Variety: combination, not repetition (rules in `gen.js`)
- **Axes vary independently**: type, storeys, wall, trim, window style (10), cornice (7), ground floor, sign kind (6), wall paint, roof piece.
- **Neighbours never share** a colour, storey count, window style, cornice or sign kind. Split widths never repeat back to back. **This holds in every tier:** the far fill (`far.js`) gives each window style and cornice its own 0.5-cube pattern (punched, arched, tall, paired, shuttered, bay, balcony, loft, ribbon, grid; bracket, band, deco, crenel, pediment, thin, sign band), so a row of lots never reads as one module repeated from afar.
- **Names are drawn without replacement per block** from the lexicon: invented shops, delis, corps, plaques, ghost signs, ads, tags. No real brands.
- **Lots**: 8–12 per block, frontage 4–9; corners 6–9 square; `D` blocks get one 14×14 tower.

## 8. Banned (from slime)
- Pastel toy town
- Outlines or ink lines of any kind
- Tiny planet
- *Echo Generation* as a reference
- Round tree crowns (crowns are 0.4 cubes)
- Realistic people (everyone is a `chars.js` character)
- Real brands or logos

## 9. Performance (pass 1c; details in `PERF.md`)
- **Same cube grammar at every distance.** A tier is the same block at a coarser cube, never a different model.
  - **near:** the full 0.1 build.
  - **mid:** the same voxels downsampled 2× to 0.2 cubes, as one merged mesh per block. Set pieces and big signs stay at 0.1, and props under 1.3 m drop out.
  - **far:** 0.5 cubes from the spec pass: massing, window pattern and cornice per spec, shop band, neutral roof, and set pieces as colour blobs, with walls leaning 30% toward the haze colour. A hero's far tier is its own build downsampled to 0.5 cubes (a far-only build, its side faces leaning 30% toward the haze), so its identity reads from the overview.
- **Characters:**
  - **full:** `chars.js` bodies for the nearest clusters, capped at 24 on low, 60 on medium, 120 on high.
  - **mid:** the same posed voxels at one city cube (0.1); giants keep a cube of 0.2 or less.
  - **far:** three boxes in the person's main colours.
- **Never pop in empty.** A block shows the best tier it already has. The haze closes before the draw distance, and new tiers dissolve in (§4).
- **Budgets at the default camera on medium:** 200 draw calls or fewer, 2–3M triangles or fewer, first view within 3 s. Dynamic resolution holds 60 fps.
- **`?q=low|medium|high|auto`**, **`?stress=1`** (every urban block of the plan, a placeholder generator), and **`?bench=1`** (the benchmark path plus a results panel).
- **Lazy heroes (cleanup pass).** Hero blocks stream like any block: the far tier first, the full build only when the camera comes near. Measured (1080p, medium): the first view appears in 1.22–1.33 s cold and 0.65–0.74 s cached at the overview and every district overhead (before: 2.5–3.0 s cold); `node style/city/tools/loadtime.mjs` measures it.
- **Walkers:** their whole step (following, corners, moving ~800 walkers) is 0.2 ms p50 and 0.4–0.6 ms p95 per frame; the avoidance part is 0.1–0.2 ms of it (`?bench=1`, `?avoid=0` for the A/B). No RVO or ORCA: one-way lanes and following.
- **Pass 2 budget, for every district:** street views need 300 draw calls or fewer, and the first view must appear within about 2 s.
  - Measured (1080p, medium, cold cache): overview 106 calls / 1.87M tris; avenue 165 / 3.25M; side street 140 / 2.59M; stress 123 / 2.97M. GPU p50 is 0.86–1.38 ms.
  - The first view appears in 1.99 s and the island is fully streamed in 3.71 s.
  - The walkers add about 5 draw calls and about 0.5M triangles near the camera.

## 10. Placement, ids and hand-crafting (pass 1d)
- **Nothing is stamped blind.** Before generation puts anything down, it asks the registry (`REG.fits` in `audit.js`) whether that spot is clear of:
  - building masses and their 0.35 m plinth zone
  - facade parts that project past 0.3 m (stands, stoops, awnings, canopies, blades, fire escapes, AC units)
  - doorways (1.5 × 1.1 m)
  - lamps and signals (reserved before the lots are built)
  - the dealing corners' zones
  - everything already placed

  If the spot isn't clear, the item slides along the wall or curb. If nothing fits, it is left out and logged. Never force it in.
- **The clear walkway rule (cleanup pass, `WALK` in `audit.js`).** Every street sidewalk keeps a continuous clear path at least 0.9 m wide at walker height (0.1–1.9 m), inside the first 1.8 m from the curb. Street furniture stands in the kerb strip (0.85 m from the curb), shop things and standing people against the frontage, and the walkers' corner lines (1.2 m in from both curbs) stay open. A placement that would narrow the path, counting how far the lane can bend (0.4 m per metre beyond 0.8 m apart along the sidewalk), is refused. Standing people follow it too, hand-placed ones included: they step along or across the sidewalk (up to 1.6 m), else they are left out and logged. Facade parts that project onto the sidewalk (fruit stands, canopy posts) ask first and slide or are left out. A flock of pigeons is the one exception.
- **Props rest on what is under them.** Yard floors, paving and lot asphalt are walkable surfaces, and props and people are lifted onto them. Roof items stand on the roof or the deck.
- **A building never draws inside a neighbour.** Each lot's volume is clipped against every other mass, planned or built, and against the frontage in front of it. So no cornice, pipe or sill overhang ever shares faces with the next building.
- **Sign text always sits on its board.** A fascia or band must cover every row of its text. Canopies carry a 0.9 m fascia, and a sloped awning hangs under its sign board, never across it.
- **Stable ids:** every generated item is `block · group · kind · n`, for example `-3_-2·L10·street-tree·1`. The group is the lot `L<k>` (numbered in subdivide order), `yard`, `oneoff`, `street`, `traffic`, `corner`, `hand`, `dogs`, or a hero part. Builds are deterministic, so ids are stable. Generated people are `block·char·n`, hand-placed ones `block·char·h<k>` (a generator change that adds or drops a generated person never turns an override's id into a hand-placed one).
- **Hand-crafting lives in overrides, never in the shared generator.** Each block has a file, `blocks/<i>_<j>.js`, owned by its location agent (`LOCATIONS.md`). In it you can remove, move or replace items by id, tune lot specs, add one-offs, and place or remove people. Heroes live one per file in `heroes/`. `heroes/common.js` and the generator belong to the systems agent.
- **The audit is a gate for every pass.** Run `node style/city/tools/audit.mjs run <label>`, then `report before <label>`, and check `?audit=1` (red boxes). A pass may not add issues to any location. Pass 1d took the section from 2463 issues to 15, and the 15 are listed per hero in `LOCATIONS.md`. The checks are:
  - props in masses, facades or doorways
  - props overlapping props
  - floating or sunk props
  - cars in curbs
  - text off its board, hidden or painted over
  - coincident faces between volumes
  - floating voxel islands
  - people inside geometry or standing on nothing
  - **pass 2:** people inside people (heads closer than 0.7 m); heads in a railing or wall; props in more than one piece (a giant object below its bracket); text covered 0.2–0.3 m in front; sidewalk spots where walkers would pass through street furniture (`walker-blocked`, which now includes a lane that can't reach its corner node)
  - **cleanup pass, the walk check** (`district` runs): 60 s of walkers over the district, counting walkers (and their dogs) walking through each other (`walker-overlap`) and through anything (`walker-furniture`). Both must be 0.
- **Builds are deterministic in any order (cleanup pass).** A memoized prop template is built from its variant, never from whichever seed asked first (street trees, bags, pigeons, laundry, planter beds, pallets), and its mid and far meshes are made from its own voxels on first use (they existed only if the template was first built during an LOD build). A district built alone hashes the same as the whole island built in one page.
- **Strict mode (pass 2)** is on while a district kit's own build runs. Any stamp that would land in a mass, a facade part, a doorway or another item, or would stand on nothing, is refused and logged. Any letter without a board gets one.
- **The fast check (pass 2):** `node style/city/tools/audit.mjs block <i>,<j>` or `district <name>` builds and audits just those blocks in seconds.

## 11. The living city and the district framework (pass 2)
- **District kits.** Every district is one kit (`districts/<name>.js`, `DISTRICTS.md`): its grammar, palette (with the neutral mix), sign lexicon, heroes, sim-state hooks, transit, safehouses and cameras. The shared engine owns placement, so every rule in §10 holds for every district.
- **Generic pedestrians** (`peds.js`). There is one walker system for the whole island.
  - Walkers are `chars.js` characters (`rollLook`) on every sidewalk and zebra crossing, walked by `pedsim.js` (the audit runs the same code). The sidewalks run one way (every block's ring clockwise, every intersection's crossings anticlockwise), so nobody meets anyone head-on on a 2 m sidewalk. They follow the lanes each block's build carves, clear of everything they could touch; follow the walker ahead (never closer than 1.1 m); take turns at the corners; and let sim agents go first. Where a dealing crew holds a corner they step off the curb and go round it.
  - They come in three tiers: the full body swinging its limbs on the GPU near the camera, a coarse body mid-stride, and three boxes far away. One in 16 walks a dog (4 breeds × 5 coats, two walking frames, sitting while the owner waits).
  - **Density** follows the sim's street demand, `DEMAND` [day, night] in `rules.mjs`, × the kit's `peds.density`, ×2 in a Director rush (the **Rush** button, or `?rush=<district>`): walkers per 100 m = 3.5 + 2.1 × demand. Downtown is about 13; Neon Row 7.7 by day and 24.5 at night. They live round what the camera looks at.
  - `?peds=0` turns them off.
  - New districts use only walkers for crowd life; section 1 keeps its hand-placed people.
  - **Window leaners** lean out of an open window (lit room, curtain) on about one building in three, never over an AC unit; **dogs** sit by some stoops and in about one yard in three (cleanup pass).
- **Sim-state visuals, in Springfield language** (`simstate/`, pieces from `simassets/`). The pieces are the same flat toon voxels, sized to the big-head body, and they read from the street and from overhead. `?sim=demo` (or `live`) draws:
  - **Homes** (parcels and stacked units):
    - windows lit when the owner is home and awake; dark with a zzz card when asleep; a curtain when away
    - FOR RENT: a lawn sign, a card in the unit's window, or a lobby board
    - locks, steel doors and safes where they show
    - burned, boarded, foreclosed, crime-scene and memorial scars
  - **Supply piles** sized by the site's bank, with a second heap for a spill
  - **Hotspots** on the dealing corners, heated by demand and saturation
  - **Crowd density** (the walkers)
  - **Patrol cars** on the plan's roads, more when someone is WANTED
  - **Turf visuals are deferred:** no crew colours, tags, flags, rooftop cues, territory overlay or "Locals" markings. Lot scars never include crew tags.
- **The home ladder:** trailer pad → **walk-up apartment** → house → **penthouse** in a tower. Tier names are data.
  - A stacked unit belongs to its building, with its own floor and windows. Its lights are per unit. Security shows at the building entrance: a buzzer and steel door for walk-ups, a doorman lobby for towers.
- **Transit and safehouse slots.** Kits declare subway entrances (a green station house with line bullets and globe lamps), bus stops (a shelter on a reserved curb strip), taxi stands and safehouse spots. `tools/reserved.mjs` writes them to `simstate/reserved.json` for the sim.
- **The fixed shot list.** Every district delivers five shots from its kit's cameras: overhead, two street views, a landmark and a night view (`node style/city/tools/shots.mjs <district>`). Close-ups are taken only for a specific problem, never tours.
- **The reference board** (`REFERENCE.md`, `board-reference.jpg`) is the bar. Every shot is compared with it before a pass is handed back.
- **Efficiency.**
  - Audit per block while iterating (`tools/audit.mjs block` or `district`), and run the full audit once at the end.
  - Put a timeout on every background wait or poll loop, and stop all your background tasks before handing back.
  - Only look at shots you need, and look at every shot you take.

## 12. Signage: the city's voice (pass 3; code in `signage/`, notes in `SIGNAGE.md`)
- **Vocabulary.** Crime world × NYC × bodegas × Hypebeast × Dazed × collector culture. Everything is invented: no real brands, people or trademarks.
  - **The bulk is everyday NYC and crime-world services:** bail bonds, injury lawyers, cheque cashing, tax prep, pawn and gold, wire transfers, lotto and OTB, malt liquor, locksmiths, exterminators, movers, tow, urgent care, dentists, radio, TV shows, concerts, boxing cards, churches, campaigns, police recruiting, crime stoppers, WANTED and MISSING posters, loan-shark flyers, transit notices and condos.
  - **The caps, per pool:** fashion and sneaker drops 15% or less, collector culture 10% or less, internet winks 10% or less. Internet winks are **a few, never the theme**: a crime trade with a dial-up pun (PROXY BAIL, CACHE 4 GOLD, 404 LAW) or a rooftop tag. No CLICK HERE, cursors or loading bars.
  - **District flavour:** Neon Row gets vice and nightlife. The docks and the Yards get unions, marine supply and tow. The suburbs and the trailer park get propane, auto and discount stores. Downtown gets lawyers, condos and campaigns.
- **Characters in campaigns.** Ads star `chars.js` characters: a lawyer's face on a bust panel, a candidate's portrait, a figure breaking out of a roof board, a 4× giant on a catwalk, and the Dazed mural (one flat colour, one huge character, a small wordmark).
- **Formats.** Every format reads at street level and from the overhead.
  - **Roof billboards:** a steel frame, a catwalk and gooseneck lamps, with a character or a product breaking the frame as a 3D cut-out.
  - **Side walls:** painted ads, ghost signs, fashion murals and wheat-paste runs.
  - **Shops:** blade signs, window vinyl, window cards and sandwich boards.
  - **Transit:** bus-shelter lightboxes.
- **Variety is a hard rule.**
  - **Designs combine independently:** character or product × slogan × colour × layout × frame. There are about 1,200 designs, 14 layouts and 14 tones.
  - **Placement is a city-wide seeded draw without replacement** (`signage/alloc.js`). Blocks sit on a lattice of classes, so the same design never shows twice within about 3 blocks (96 m; 160 m for roof boards) and never twice in a block. One candidate's posters, or one label's campaigns, share a class.
  - **Shop and bodega names** are unique per block and never repeat within about 3 blocks.
  - **The audit checks it:** a `sign-repeat` issue is the same words within the radius. Regulatory plates (BEWARE OF DOG, NO PARKING) are street furniture and are exempt. `signage/census.mjs` counts internet references and repeats.
- **Text sits exactly on its board.**
  - Lettering is pixel type (5×7 or 3×5), or a display face when it is big enough to stay crisp.
  - Bands keep a margin of one row.
  - A design whose words don't fit a wall is not painted there: the allocator picks one that fits.
- **District kits take all of this from the shared system:** billboards, wall ads, ghost signs, murals, paste-ups, transit ads, rooftop neon and throw-ups. A kit writes only its own hero signs (DISTRICTS.md §8).
