# render/ · light, sky, fog, clouds, night

**Where.** `lighting.js` runs light, fog, time of day and the fog height term; plus `sky.js`, `sky-clouds.js`, `lighting-contacts.js`, `night.js`, and gpu.js `WIN` (window tints, emissive mask). main.js calls `createLighting()`.

**Default = today.** Fields default to today's values; `?tod=night` starts on today's night; new effects start off. Versus the old code: overview 0 px changed; street and night differ only by walkers' run-to-run noise.

**Times of day:** day, golden, overcast, blue, night. Each bundles Light, Sky and Fog values; feature switches stay yours. A live switch blends over `blend` s; start-up, shots and `?time=<name>` are instant.
- Blue and night need the night build (lit windows). Crossing builds reloads with or without `?tod=night`, carrying the look in sessionStorage (the bake has both: quick).
- Time registers first, so a look's own values beat its bundle.

**Exposure** stays with the post stack's tone section. Lighting never drives `toneMappingExposure`: use sun and fill.

**Emissive mask.** For the emissive-only bloom, post.js writes the lit flag into its scene target's alpha (`setLitMask`, only then) and bloom's prefilter reads it.

**Notes.**
- Height haze: one term in three's fog chunks; 0 is off.
- Tints: per 4.2 m × 3 m world cell of lit warm glass.
- Contacts read `peds.sim` and `traffic.sim` (no hooks).
- Lamp pools: every corner and kit lamp, one draw.

**Cost** (1080p high, GPU-finished, base 3.6 ms): clouds +0.3 ms, contacts +0.3, pools ~0, tints and haze +0.2 each, all +0.3.

## TAPE's time-of-day grade (2026-10-09)

slime: "grade now, one build later". TAPE holds LIVE's dusk/dawn reload off, so the tape's time of day and the build's can differ. `grade.js` grades the build toward the tape's time: `k` 0…1, eased by `ui/light.js` from the tape time. It applies only while they differ: on a day build it comes in over `dusk` game minutes (30) after 20:00 and goes out over the 30 before 06:00; a night build mirrors that around 06:00 and 20:00.
- **Night on a day build:** light, sky and fog go day → blue hour → night (the time bundles; the sun keeps its direction). Exposure × 1.25. A share of the day glass is lit as the night build lights its windows (gpu.js `TODWIN`, one by one as k grows). Pools under the street lamps, the water's moon glitter.
- **Day on a night build:** the reverse. The lit windows go back to day glass one by one, the lamp light, pools and water streaks go out.
- **Nothing recompiles:** every term is compiled in on `?sim=live` pages (never shots, bakes, hashes or audits; `?grade=0` is off) and moved by uniforms; the pools compile in the warm-up. Measured: 0 program links over force on/off, seeks across 20:00 and 4× play through dusk, on both builds.
- **Panel:** RENDER → "Tape: time-of-day grade". `lampLight` lends the night build's lamp term to the graded day build: the streets near the camera get warm walls and ground, as on the night build. It is on by default since the art fixes (2026-10-10, slime), at its cost (below). `lut` is a blue day-for-night grade in the materials, off: the night bundle alone already matches the night build's surfaces.
- **Cost** (the render review's paused-loop bench, 3200 × 1826, p10, scene / whole frame through the default look): moving k from 0 to 1 costs +0.00–0.015 ms on either build. Being installed costs +0.04–0.07 / +0.09–0.12 ms on a day page at k = 0, and +0.00–0.06 on a night page, against `?grade=0`. `lampLight` costs +0.23–0.31 / +0.43–0.60 ms more at street level, the same as the night build pays for that light. From 90 m up the term and the pools are off. Re-measured 2026-10-10 when it went on by default (a 22:00 tape, k = 1, lampLight off → on): avenue +0.31 / +0.60, low +0.22 / +0.43, ROUTE 9's street camera +0.20 / +0.19, the subway frames' default camera (26 m up) +0.28 / +0.27, the overview +0.00; at a noon tape and on the night build ±0.02 (nothing).
- **Not graded** (per voxel, or the traffic's): lit signs and neon, lit shop interiors and curtains, lamp heads, the traffic lights' night glow, car lamps, homes' night lights, and the water's lamp streaks on a day build. For those: the TAPE chip **Light it as night / day (~N s)** (`ui/light.js`) reloads into the matching build at the same tape minute, with the UI kept (`ui/reload.js`).
