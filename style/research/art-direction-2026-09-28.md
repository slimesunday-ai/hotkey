# AI City: art direction review (2026-09-28)

An opinion, not a proof. I made no in-page experiments (the scope was cut). Costs are estimates and no frame times were measured. It is based on the boards (reference, batch 4, batch 5, wave 1, streaming), 22 fresh stills in `style/city/shots/art-review/` (`d-*` day, `n-*` night) and a read of the renderer in `main.js`.

## 1. The honest read

**Where it already competes.** At street level it holds up against stylised AAA work. The frames are `d-corner`, `d-strip-street1`, `n-strip`, `d-hospital-street1`, `d-docks-street1` and the `INSIDE` mural in `d-jail-landmark`. The signage and lettering, the characters, the colour clustering and the prop density have a graphic voice that Jet Set Radio or Bomb Rush Cyberfunk would recognise. The grammar and the voice are finished. The rendering around them is not.

**Where it gives itself away.** Everything that isn't the geometry: the light, the sky, the water and the view from above.
- **One light for every hour.** The sun is 3.0 against a hemisphere fill of 1.05 plus an environment of 0.55 (`main.js:76,87-88`). So shadow sides stay bright and near-neutral, form reads through local colour alone, and every frame looks like noon under a light box.
- **An empty sky.** The dome is a two-stop gradient (`main.js:72-74`). STYLE §4 promises cubic clouds, but none exist in the code.
- **Confetti from above.** In `d-overview` and `d-downtown-overhead` every block has the same saliency and the same value: white roofs, bright walls and no hierarchy. The far third dissolves into a pale cyan milk that reads as "not loaded" rather than as air.
- **Night from above is navy soup** (`n-overview`, and the whole-island night tile on batch 5). The streets don't glow, because only 3–11 real lamp lights exist and only near the camera (`main.js:94`). The sky is the same violet as the buildings.
- **The sea is a flat cobalt poster** (`d-sea-overhead`), with no shallows, shore foam or glints. The boat wakes are the only life in it.
- **The weak districts:** the dead mall (`d-mall-landmark`) reads unlit and grey rather than dead with character. The woods are a flat green carpet by day and black mush at night (batch 4).

## 2. What's lacking, by layer
- **Light:** no warm/cool split, one sun angle, hard `PCFShadowMap`, nothing grounding cars and walkers, and fog with no height term.
- **Post:** none. It renders straight to the screen (`main.js:255`) with only the CSS grain.
- **Materials:** the flat walls are right; the ground is too clean.
- **Composition:** there's no skyline icon; Gatehill is coloured sticks of similar height.
- **Street life:** dense and good, but no small motion (steam, flicker, flags).
- **Vegetation and water:** the ground under the trees and the sea are both flat.
- **Night:** one window colour, no neon spill, dry roads, no horizon glow.
- **Weather and time of day:** no weather. Night is a page reload (`?tod=night`, baked per tod), with no golden hour or dusk.
- **Camera:** the shot rule centres a signal head in `d-downtown-street1` and `d-suburbs-street1`. I didn't review the live camera.
- **Consistency:** the grammar is even across districts. The values aren't: the woods and the mall sit greyer and lower.

## 3. Top 10 moves, ranked by impact over effort (none of them tested)

1. **Re-key the day light.** Warm the key (`#FFE0B0`, about 3.4). Make the fill bluer and lower (hemisphere about 0.75, environment about 0.35), so shadow sides drop to roughly half the value of lit sides and go cool violet. Edit `main.js:76,87-88` and STYLE §3. **Cost:** 0 ms, half a day including re-shooting the boards. **Risk:** shaded walls go muddy if the fill turns grey; keep it chromatic.
2. **A real sky.** Add chunky box clouds (one merged mesh with `fog: false`, like the dome, drifting slowly), a sun glow term toward `sunDir`, and a deeper horizon band. The work is in the sky shader (`main.js:72-75`) plus a small clouds module. **Cost:** about 0.1 ms, 1 day. **Risk:** low.
3. **Night: light the grid.** Make the lamp heads emissive and put an additive warm pool decal under every corner lamp (instanced, with no real lights). This makes the street grid glow from the overview. Give windows 3–4 colour temperatures (tungsten, cool fluorescent, TV blue, one neon pink), lit in clusters by floor and building. Add a sodium glow at the night horizon. **Files:** `ground.js cornerLamps`, `facade.js`, `far.js`, the night sky colours in `style.js PAL`. **Cost:** about 0.2 ms, 2–3 days. **Risk:** looks cheap if over-lit; keep about 60% of windows dark.
4. **Bloom on emissives only.** An `EffectComposer` with a HalfFloat target, `UnrealBloomPass` at a high threshold and `OutputPass`. The pattern is already in `blur.js`, and it hooks into `frame()`. **Cost:** about 1–2 ms at 1080p (unmeasured), 1 day. **Risk:** a hazy glow if the threshold is low; keep it at night, or barely there by day.
5. **Ground everything.** Use `PCFSoftShadowMap` (or `shadow.radius`), plus instanced blob contact shadows under walkers, cars and street props (`peds.js`, `traffic/render.js`). GTAO at half resolution with a radius of 1 m or less is the heavier alternative. **Cost:** blobs about 0.1 ms, GTAO 1–2 ms; 1–2 days. **Risk:** strong AO dirties the toon colour.
6. **Value structure from above.** Ten of the twelve `ROOFS` in `lexicon.js` are whites or light greys; only two are dark. Weight them toward tar and gravel mid-greys (and the roofs in `far.js`), so walls and set pieces pop against a darker roofscape. Add a height term to the haze so it pools low over streets and water while the roofs stay crisp: one fog-chunk patch that every material picks up. **Cost:** 0 ms, 1 day. **Risk:** it touches the tuned §4 fade, so it's a taste call.
7. **Golden hour and blue hour as named states.** Blend sun, sky, fog, emissive and lamps between them. A neon city at blue hour is the money shot. This needs emissive as a uniform rather than baked per tod (`kit.js TOD`, `baked/`). **Cost:** 0 ms, 3–5 days. **Risk:** low, provided dusk stays saturated orange, magenta and indigo, never pastel.
8. **Stylised water.** A depth or distance-to-shore ramp (teal shallows to cobalt), a stepped white foam line on every seawall, pier and hull, sun glitter by day and vertical light streaks at night. **Files:** the `sea` kit, `PASS-water.md`. **Cost:** about 0.3 ms, 2–3 days. **Risk:** realism creep; keep it to 2–3 flat bands.
9. **A handmade ground.** Flat-colour decal voxels on the ground only: asphalt patches, darker tyre lanes, manholes that steam at night, oil spots, chipped crosswalk bars, slab seams and gum dots. Optionally add ±2% per-voxel value jitter in the shader (a world-voxel hash, so no geometry cost). **Files:** `ground.js`, `street.js`. **Cost:** 0 ms, 2–3 days. **Risk:** STYLE §2 bans grime; this stays on the ground unless the style guide changes.
10. **Skyline hierarchy.** One downtown supertall, at least 1.6× the next tallest, with a setback crown lit at night. Then 3–4 secondary silhouettes on the main sight lines: the lift-bridge towers lit, aircraft lights on the dock cranes, a giant rooftop neon at the docks. **Files:** `skyline.js`, `heroes/`. **Cost:** 0 ms, 3–5 days. **Risk:** low, at 1.0 grain.

**Next, beyond the ten:** a rainy night (wet-road reflections of the neon, puddles, streaks, umbrellas on the walkers) is the biggest mood per shot but large effort. Small motion (neon flicker, steam, flags, laundry) is cheap and adds a lot. The camera rule should offset about 1.5 m off the centreline so a signal mast never centres the frame.

## 4. What NOT to do
- No outlines, no tilt-shift or DOF, and no isometric or tiny-planet views (the existing bans hold).
- No ACES or AgX: both grey the palette. Keep Neutral.
- No PBR roughness, normal maps or texture grime on walls. One flat colour per mass is the style.
- Don't sell "crime" by desaturating. Grit lives in the signage, props and ground, never in a grey grade.
- Don't tint the fog away from the horizon. Change the sky colour, and the rule still holds.
- No global high-strength SSAO, no volumetric god-rays everywhere, and no realistic water.
- Don't light every window, and don't bloom the day.
- No pastel dusk.

## 5. References
- **Bomb Rush Cyberfunk** and **Jet Set Radio Future**: graphic city colour and voice.
- **Sunset Overdrive**: saturated key light with coloured shadows.
- **Fortnite (Chapter 1–2 era)**: warm key, cool fill and chunky clouds.
- **Sea of Thieves**: stylised water bands and foam.
- **Townscaper**: handmade variation at toy scale.
- **Spider-Man: Into the Spider-Verse**: the NYC night palette and neon spill (take the palette only, not the lines).
