# A — Art Direction: What Makes Voxel Worlds Beautiful

Research for AI City. Scope: art-direction principles — scale/grammar, colour, silhouette, density/storytelling, diorama craft. Rendering, LOD and procedural-variation are other agents' lanes, noted only where they gate an art fix.

## 1. TL;DR

- **The original's charm was grammar consistency, not budget**: one voxel scale, bold per-object local colour, chunky silhouettes, applied to everything at once. Astra's kit is better *per object* but breaks grammar *between* objects — that's the "mechanical" read, not a detail-quantity problem.
- **A studio-stated rule for this exact problem already exists.** Hytale's public modeling guide restricts city geometry to cubes and quads only (no special topology, no spheres), fixes texel density at 32 px/unit for props/blocks vs 64 px/unit for characters, caps stretch at 0.7×–1.3× per axis [verified]. AI City has no written equivalent — hence hairline railings next to chunky voxel people.
- **Code-level finding, not just a screenshot read.** `palettes.js` already has a bold, Simpsons-style saturation-boost table (`SPRINGFIELD`), set as the live default the day before this verdict (picked 2026-09-23). But `style/treatment.mjs`, which recolors the kit's environment materials, defaults `MUTED=true` and routes through a separate desaturating `boroughColors` table instead — its own comment calls it an approved taste call, on by default. Two colour systems exist; the muted one wins for the kit by default. [verified — read directly]
- **Shadows of Doubt fought the exact "cartoonish voxel" stigma in writing** — "associated with Minecraft and a general cartoonishness, which doesn't fit the tone" — and solved it with lighting/material fidelity, not smoother geometry [verified]. Chunky ≠ cute; that's a render/lighting decision on top of the same grammar.
- **NYC's real skyline crowns are a zoning accident worth stealing**: the 1916 setback law sculpted the "wedding cake" towers (Empire State, Chrysler) directly [likely]. AI City's towers need stepped massing + a real cap, not a slab with a window checker.
- **Landmarks are a budget line, not a byproduct.** The original's stepped-dome courthouse and glass-tower mall are hero shapes; Astra's versions collapsed to the generic module because no silhouette budget was spent on them specifically.
- **Big flat areas want a few bold saturated objects, not scattered small clutter** — the original's docks read from color-blocked container stacks and one crane, not prop density.
- **"Imperfection" has two unrelated meanings, and the verdict names both as one.** Curated asymmetry (hand-painted light, varied rooflines) is what makes diorama art beautiful. Mechanical imperfection (identical trailers, LOD pop-in, a missing building) is a bug wearing charm's clothes — different fixes entirely.
- **NYC's "ugly" infrastructure is a free hero prop.** Sidewalk sheds are named in the locked direction and have a real, specific look — hunter-green pipe-and-plywood, flat deck, cross-bracing — cheap to build, instant grit signal for empty lots.

## 2. Findings by sub-question

### 2.1 Scale and grammar

Strong voxel worlds hold **one grammar contract**, stated as a rule:

- **Hytale**'s modeling guide (Dec 2025): world geometry is cubes/quads only — "No edge loops, no special topology, no triangles, pyramids... No spheres allowed!" Texel density: 32 px/unit props+blocks, 64 px/unit characters/tools (small handheld detail can be denser without breaking the world grid); stretch capped 0.7×–1.3×/axis. Philosophy: "work as simply as possible, then slightly increase geometry... to improve the silhouette" [verified, hytale.com/news/2025/12/an-introduction-to-making-models-for-hytale].
- **Teardown** goes the opposite way on scale — voxels reported near 10 cm ("two or three inches") per side, small enough that a wall reads as *material*, not *building block* [likely, gamedeveloper.com/design/how-beautiful-voxels-laid-the-way-for-i-teardown-s-i-heist-y-framework; teardown.fandom.com/wiki/Voxels]. Not directly transferable, but it shows the principle: pick a density *and a reason*, then hold it.
- **Cube World** holds one cubic unit for everything — terrain, creatures, props — no mixed fidelity, paired with a warm SNES-JRPG palette [likely, gamedeveloper.com/art/voxelart-styles-in-video-games]. Zero exceptions is the easy version of cohesion; AI City has already left that path (correctly), so it needs the harder version — a stated rule for how detail exceeds the base grid without breaking it.
- **Cloudpunk** is the useful counter-example: it deliberately mixes voxel (characters, hand props) with smooth low-poly (vehicles, architecture), reasoning that "most buildings in modern cities... are rather square than round" [likely, gamedeveloper.com/game-platforms/cloudpunk-creator-marko-dieckmann-on-cyberpunk-voxel-art-and-constant-fight-that-is-indie-development; techraptor.net/gaming/features/ion-lands-cloudpunk-visuals-worldbuilding]. Lesson: mixing works when **systematic** (grammar A always does job X), not incidental — which is exactly what fails in the comparison sheet: fine brick texture, hairline railings and coarse voxel trees colliding in one shot with no rule deciding which wins.
- **Shadows of Doubt** decouples tone from geometry grammar: names the cartoonishness risk directly, then keeps blocky geometry and fixes tone via Unity HDRP lighting and a Qubicle-based material workflow (chosen specifically for UV/normal-map export) instead of smoothing anything [verified, colepowered.com/shadows-of-doubt-devblog-21-how-voxels-saved-the-project/]. Direct rebuttal to "will chunky read as cutesy" — not if the render layer carries tone. Rendering-agent territory; flagged only because it removes a false constraint on this brief.
- **Stonehearth**: sourcing thin, no dedicated art-direction devblog found. Confirmed only: Qubicle-based voxel modeling, stated 16-bit Zelda/Chrono Trigger inspiration [likely, en.wikipedia.org/wiki/Stonehearth].

### 2.2 Colour and value

**Local colour vs. unified light.** James Gurney's framework: *local colour* is an object's own hue in white light (every roof its own colour); a *unified* scene subordinates local colour to one shared light/atmosphere tint [likely, jamesgurney.com/products/color-and-light-a-guide-for-the-realist-painter-signed-by-james-gurney]. The original is strongly local-colour. Astra's build still intends local colour but two things pull it toward unified/neutral: the muted material table below, and haze flattening far objects toward one grey-blue tone (docks, far suburbs). Simpsons-in-3D wants local colour to win; grade should tint, not replace it.

**Code confirms this is a live fork, not just an impression.** `palettes.js` defines `SPRINGFIELD`: a per-hex remap pushing saturation/value up — gold `#e7c24a→#ffd23f`, brick-red `#b04e37→#d9583c`, sky-blue `#5a86ae→#4fb0e8` — plus a grade (`sat:1.08`, cool-purple shadow `#6a5fd8`, warm highlight `#ffd9a8`) and a 10-keyframe day/dusk/night curve. `PAL_NAME` defaults to `'springfield'` (picked 2026-09-23). Separately, `style/treatment.mjs` (recolors kit "environment materials, before vertex/texture baking") has its own `colors` (saturated "pop" table) and `boroughColors` ("colour in painted details, weight in brick, aged limestone, iron and dark glazing"). Which applies depends on two flags: `POP` (needs explicit `?detail=kit&look!=previous` — off by default) and `MUTED` (on by default unless `?muted=0`). Its comment: on by default, as approved, and a taste call. Net effect as read: kit materials default to the muted table; the vivid table needs an opt-in flag nobody hits in normal play [verified — read directly, palettes.js and style/treatment.mjs]. I did not trace which meshes call `environmentColor()` vs `c()/ci()` — an engineering check, not a design one — but the gating alone explains a muted default sitting on top of code that already has the bold palette, dated the day before this verdict.

**A budget, not just a mood.** The 60-30-10 proportion rule (interior design, commonly restated for game environment art) gives numeric shape to the verdict: 60% "weight" colour (brick/iron/stone/glass/asphalt), 30% secondary local colour (roofs, doors, trim), 10% high-saturation accent (signage, neon, one hero colour per block) [likely, iragames.ir/the-60-30-10-color-rule/]. A flat-reading screenshot is probably missing its 10% band, not its 60%.

**Flat colour in 3D reads bold, not cheap, when shading is quantized.** Cel-shading — 2–3 discrete tonal bands instead of a smooth gradient — is what lets games like Jet Set Radio read as graphic/poster-like [likely, en.wikipedia.org/wiki/Cel_shading]. Baked, stepped shadow instead of soft PBR falloff on painted surfaces (real specular reserved for glass/chrome/neon/wet asphalt) helps bold colour survive lighting.

**Process lesson, two studios independently.** GTA V art director Aaron Garbut: "block the world in quickly and then... build out each part till we hit a good visual bar," judged against "Does it feel weathered? Does it have a sense of place and history?" [likely — secondary mirror of a BuzzFeed interview, igta5.com/buzzfeed-interview-with-gtav-art-director-aaron-garbut]. Diorama artist Thibault Simar (EXM) blocks shapes first, refines, and paints light into the model *last* [verified, 80.lv/articles/voxel-dioramas-tips-and-tricks]. Same order from two unrelated fields: a uniform "good enough" bar everywhere, before detail anywhere — the opposite of Astra's split (a few amazing near-LOD corners vs. a flat city-wide far-LOD default).

### 2.3 Shape and silhouette

NYC's skyline crowns are a legal accident worth stealing: the **1916 Zoning Resolution** forced setbacks as buildings rose (to protect street light), sculpting the "wedding cake" towers — Empire State, Chrysler, 40 Wall St — directly from the constraint [likely, 99percentinvisible.org/article/progressive-setbacks-the-century-old-nyc-mandate-that-shaped-modern-skylines/; skyscraper.org/skyline/impact-of-1916-zoning/]. Translation: towers need 2–4 setback tiers plus a distinctive cap (water tank, stepped crown, cornice, occasional spire), not a single extrusion. This is the biggest available fix for the checker-noise problem, because it changes the shape the windows sit on, not just the window texture.

From the comparison sheet, the original's **Hall of Justice** (stepped dome, statue plaza) and **Millennium Mall** (stepped blue-glass entrance against a flatter mass) are true hero shapes — unique massing, saturated accent colour, readable from the default overhead 3/4 camera at any zoom. Astra's versions collapsed to the generic module (plain box + portico; flat-roof strip mall): the landmark budget wasn't spent there, not a technique gap. Every district needs one hero shape that breaks the module grid on purpose.

The repeated water tower on most walk-up roofs is directionally correct as an NYC signifier, but identical repetition turns a charm detail into grid noise — it earns its place by varying (rotate, occasionally omit ~30–50%, occasionally swap for AC clusters/roof decks).

### 2.4 Density and storytelling

The original's docks read from a **small number of large, saturated, colour-blocked objects** — stacked containers in red/yellow/green/blue, one yellow gantry crane — not prop density. Cheap answer for flat areas (quays, lots, plazas): a handful of big modular shapes with strong local colour, reusing kit pieces that already exist (the container/vehicle kit is visible in Astra's own docks shot), beats scattering small props or leaving bare asphalt.

The locked direction's own callouts — bodegas, awnings, fire escapes, scaffolding — have a deep real reference: photographers **James and Karla Murray**, *Store Front: The Disappearing Face of New York* (2008/2015), a documentary archive of NYC storefronts' hand-painted signage and folk typography, held by the Smithsonian and NYPL [likely, en.wikipedia.org/wiki/James_and_Karla_Murray]. Practical use: source of *signage variety* — the fix for one deli sign getting reused city-wide.

**Sidewalk sheds are an explicit locked-direction callout and a real, citable prop.** NYC's standard shed (now being phased out) is "hunter green pipe-and-plywood," "permeated city streets for decades" — the city's own initiative had removed 15,224 of them as of the announcement, which tells you how common they still are [verified, nyc.gov/mayors-office/news/2025/11/mayor-adams-unveils-new-designs-for-sidewalk-sheds-and-scaffoldi]. As a prop: posts + panels + a flat deck — cheap geometry, instant grit, strong for dead lots and half-built blocks.

**Curated imperfection vs. mechanical imperfection are not the same thing.** Simar paints light by hand and separates materials per-part deliberately [verified, 80.lv/articles/voxel-dioramas-tips-and-tricks]; Tiny Glade's developers: "I create every single rule that goes into the system... we curate exactly the experience" [verified, 80.lv/articles/exclusive-tiny-glade-developers-discuss-bevy-proceduralism-publishers-cozy-games]. That's curated imperfection — someone chose the asymmetry. What the diagnosis lists under Astra's "imperfections" — identical trailers in a grid, an LOD hand-off gap, a building missing on arrival — is the opposite: *unintended* uniformity and *unintended* failure. Fixing the first is art direction; fixing the second is engineering, flagged once for the LOD agent.

### 2.5 Voxel diorama artists

Two verifiable artists, both MagicaVoxel, both via 80.lv:

- **Thibault Simar (EXM)** — pieces: *Train Wreck II*, *Tangled Castle*, *Lost Temple*, *Medieval Bridge*, *Let It Burn*. No preliminary sketch; blocks shapes in MagicaVoxel, refines, paints light onto the model last; exports parts separately (e.g. land vs. water) for per-part materials; notes voxel engines over-generate polygons, needing retopology for real-time use [verified, 80.lv/articles/voxel-dioramas-tips-and-tricks]. Names @Sir_carma and @zmei23 as influences — unverified beyond the mention [anecdotal].
- **Mari K (MadMaraca)** — temple/Persian-house diorama scenes blending architecture, culture, nature; source is showcase-level, no technique breakdown found [verified as to existence/description only, 80.lv/articles/incredibly-detailed-voxel-dioramas].

MagicaVoxel's own toolset explains part of the "expensive" look: built-in path tracing (soft shadows, GI, DOF, atmospheric fog), a curated palette (up to 255 adjustable colours), and a material system (glass, metal, emissive, cloud) on top of plain cubes [verified, 80.lv/articles/voxel-dioramas-tips-and-tricks]. One line for the rendering agent: the diorama look is baked light + a few special materials on simple geometry, not complex geometry.

## 3. Apply to AI City — prioritized

Mapped to the numbered problems in the diagnosis. Effort: S = data/config/placement, days. M = new authored content or a real pipeline change, 1–2 weeks. L = new system.

1. **Audit and likely flip the kit's default colour path** (→ problem 3, general "mechanical" verdict). Confirm which meshes call `treatment.mjs`'s `environmentColor()` (muted by default) vs `palettes.js`'s `c()/ci()` (bold Springfield, already default). If the kit defaults to muted while the engine defaults to Springfield, that alone flattens the kit relative to the original. Target: one consistent default, bold local colour plus the existing grade as the "weight," not a second desaturation pass. Effort: **S** (tables exist; this is wiring + a look-over). Runtime: ~0 (lookup-table swap). Risk: low — Springfield *is* the Simpsons-colour half of the locked direction. Caveat: gating logic read, not the full call graph — confirm with an engineer first.

2. **Write down a two-tier grammar rule, apply to props** (→ problem 4). Structural geometry (buildings, vehicles, big props) stays cubes/quads at one texel density; thin/round things (railings, lamp posts) either chunk up to the grammar or become a texture/decal on a chunky base, never bare hairline geometry next to chunky neighbors. Effort: **M** (bounded prop/street-furniture list). Runtime: neutral-to-positive (thicker geometry batches better). Risk: low — enforces the original's own rule, adds nothing new.

3. **Give towers a silhouette pass: setbacks + a real cap** (→ problem 3). 2–4 stepped massing tiers instead of one slab, plus a distinct crown (water tank, stepped cap, cornice, occasional spire); replace the uniform beige checker with value-blocked window bands (irregular dark-glass clusters, not per-tile noise). Effort: **M** (tower kit variation, likely a small base-module count). Runtime: modest (more tris per tower; small population relative to walk-ups). Risk: low.

4. **Landmark budget: restore hero shapes for courthouse/mall, confirm one per district** (→ problem 6, supports 3). Courthouse gets a stepped/domed silhouette and plaza set piece; mall gets a distinct saturated entrance volume against a flatter mass (original's stepped blue-glass tower is a literal template). Audit remaining districts for one unmistakable hero shape each. Effort: **M** per landmark, **S** overall if the list is short (~5–8). Runtime: negligible. Risk: low — this is literally what "iconic landmarks" in the locked direction asks for.

5. **Break grid repetition with cheap, systematic variation** (→ problem 2). Vary roofline/water-tower presence (~30–50% of roofs), rotate/mirror/recolor walk-up and suburb-house modules, stagger trailer orientation and paint. Effort: **S–M** (picking from variant pools per instance; add 2–3 variants first if the kit only has one). Runtime: ~0 (same instance count). Risk: low. One line for the neighboring lane: this overlaps procedural-variation territory — the ask here is the *visual* axis (colour/roofline/rotation), not the system behind it.

6. **Fill big flat areas with a few bold modular shapes** (→ problem 5, partial). Quays/lots/plazas get 3–6 large saturated kit-reused objects (mixed-colour container stacks, painted lot striping, a food truck, angled parked cars) instead of uniform small props or bare asphalt. Effort: **S** (placement pass, existing assets). Runtime: low. Risk: low. Note: haze swallowing the port/far suburbs is a rendering/atmosphere fix (one line, not mine to prescribe) — no ground-level colour-blocking reads if fog hides it past a few hundred meters.

7. **Push the night palette warm/narrow plus a few loud accents** (→ problem 7). Unlit windows go dark, not beige; lit windows narrow to a warm hue band with randomized on/off ratio; a small number of true accents (neon, marquee, brand colour) get to be much brighter/more saturated than everything else — the 10% band, deliberately not diffused. Effort: **S** (the existing day-cycle `key`/`grade` table is tuning, not a new system; plus a windows-lit-ratio pass). Runtime: ~0. Risk: low — serves the original's "warm lamp pools" while keeping Astra's geometry.

8. **LOD pop-in / missing-building gap** (→ problem 8) — flag only, not art direction's to fix. Undermines every other fix on this list regardless: a beautiful building that visibly assembles itself reads as *more* mechanical, not less. One line for the rendering/LOD agent.

## 4. What not to do

- Don't chase photoreal PBR or realistic lighting response on painted surfaces — collapses local colour into unified/neutral lighting, kills the Simpsons-in-3D read. Keep shading quantized on bold-colour surfaces; save real specular for glass/chrome/neon/wet asphalt.
- Don't smooth geometry, and don't shrink heads or tree crowns toward natural proportion to "fix" the mechanical read — all explicitly ruled out, and none of them are the actual cause (grammar/colour/silhouette are).
- Don't apply a uniform detail budget everywhere before any landmark gets a silhouette pass — evenly 70%-good citywide reads flatter than 50%-good citywide with five unmistakable hero buildings.
- Don't treat "more props" as the answer to empty lots/quays/plazas — a few large saturated shapes read better and cost less than scattered small clutter.
- Don't let fixing "imperfection" mean smoothing out variation — the repeated water tower, identical trailers and identical houses are the *bad* kind (unintended uniformity); the fix is more authored variety, not less randomness.
- Don't let atmospheric haze double as colour-grade — if it's currently hiding both pop-in seams and the port's colour, tune it in coordination with whoever owns LOD/rendering, not unilaterally from the art side.
- Don't take "Springfield" as license to go pastel/cute — this brief's Simpsons colour means bold flat local colour plus a defined shadow/highlight grade over "brick, iron, stone, dark glass and asphalt" weight, not a soft toy palette.

## 6. Sources

- [verified] hytale.com/news/2025/12/an-introduction-to-making-models-for-hytale — cube/quad-only geometry, texel density, stretch limits, design philosophy.
- [verified] colepowered.com/shadows-of-doubt-devblog-21-how-voxels-saved-the-project/ — cartoonishness risk, HDRP lighting, Qubicle choice.
- [verified] colepowered.com/shadows-of-doubt-devblog-8-simulating-a-city/ — fetched directly; mostly simulation, not visual design (noted as a limitation).
- [verified] 80.lv/articles/exclusive-tiny-glade-developers-discuss-bevy-proceduralism-publishers-cozy-games — hand-curated proceduralism.
- [verified] 80.lv/articles/voxel-dioramas-tips-and-tricks — Thibault Simar (EXM) workflow, named pieces, MagicaVoxel renderer/materials.
- [verified] 80.lv/articles/incredibly-detailed-voxel-dioramas — Mari K (MadMaraca) diorama work (showcase-level only).
- [verified] nyc.gov/mayors-office/news/2025/11/mayor-adams-unveils-new-designs-for-sidewalk-sheds-and-scaffoldi — "hunter green pipe-and-plywood," 15,224 removed.
- [verified — local source, read directly] `deadnet-crowds/world/palettes.js` and `.../style/treatment.mjs` — SPRINGFIELD palette, MUTED/boroughColors gating, day-cycle grade table.
- [likely] gamedeveloper.com/design/how-beautiful-voxels-laid-the-way-for-i-teardown-s-i-heist-y-framework; teardown.fandom.com/wiki/Voxels — Teardown voxel scale/material framing (fan wiki = lower authority).
- [likely] gamedeveloper.com/art/voxelart-styles-in-video-games — Cube World's cubic-everything grammar and palette.
- [likely] en.wikipedia.org/wiki/Stonehearth — Qubicle workflow, stated 16-bit inspiration (thin sourcing).
- [likely] gamedeveloper.com/game-platforms/cloudpunk-creator-marko-dieckmann-on-cyberpunk-voxel-art-and-constant-fight-that-is-indie-development; techraptor.net/gaming/features/ion-lands-cloudpunk-visuals-worldbuilding — Cloudpunk's deliberate voxel/low-poly split.
- [likely] igta5.com/buzzfeed-interview-with-gtav-art-director-aaron-garbut — Garbut quotes (secondary mirror of a BuzzFeed interview).
- [likely] en.wikipedia.org/wiki/James_and_Karla_Murray — Store Front NYC storefront-photography archive.
- [likely] 99percentinvisible.org/article/progressive-setbacks-the-century-old-nyc-mandate-that-shaped-modern-skylines/; skyscraper.org/skyline/impact-of-1916-zoning/ — 1916 NYC zoning setback law, ziggurat skyline.
- [likely] jamesgurney.com/products/color-and-light-a-guide-for-the-realist-painter-signed-by-james-gurney — local colour vs. colour-of-illumination.
- [likely] iragames.ir/the-60-30-10-color-rule/ — 60-30-10 rule applied to game art.
- [likely] en.wikipedia.org/wiki/Cel_shading — quantized/cel shading, Jet Set Radio.
- [likely] blockbench.net/wiki/guides/minecraft-style-guide/ — exaggerated-proportion readability (supports keeping the locked big-head shape, not relitigating it).
- [likely] perfectly-nintendo.com/dragon-quest-builders-2-details-famitsu-interview/ — DQB2's blocky style chosen for pixel-art-heritage continuity.
- [likely] laughingsquid.com/crossy-road-an-endless-hopper-video-game-featuring-voxel-artwork/ — Crossy Road's high-readability voxel simplicity.
- [anecdotal] @Sir_carma and @zmei23 (X/Twitter handles), named by Thibault Simar as influences — mentioned only, not independently verified.
