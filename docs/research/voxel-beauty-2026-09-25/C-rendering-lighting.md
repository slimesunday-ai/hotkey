# C — Rendering and Light for Voxel Beauty in three.js

Scope: problems 1 (far-LOD reads as generic low-poly), 4 (style clash), 5 (haze swallows port/suburbs), 7 (flat night) from the side-by-side diagnosis. Grounded against `world/main.js`, `atmosphere/sky.js`, `atmosphere/contacts.js`, `atmosphere/plan.mjs`.

## TL;DR

- Across every case study (MagicaVoxel, Teardown, Minecraft shaders, Cloudpunk, LEGO Builder's Journey), the one universal beauty driver is **grounded, soft, coloured shadow + AO**, followed by **bounce/indirect light** and **bloom targeted at emissive elements only**. Specular variety, bevels and wet reflections are second-tier polish — real but not what makes these look "handmade."
- AI City's own code already proves the art-direction call correct: `main.js` has a dead code path that would switch to `THREE.ACESFilmicToneMapping`, with the comment *"kit mode now keeps Neutral (ACES greyed the palette ~27%)"*. Neutral is the right default. Don't spend time on AgX — it shares ACES's filmic-compression design goal and would likely fail the same measured test.
- three.js is at **r186, tagged 2026-09-24** [verified, GitHub API]. Everything needed for problems 1, 5 and 7 exists today inside the classic `WebGLRenderer` + `EffectComposer` pipeline AI City already runs — no WebGPU migration required.
- Problem 7 (flat night) is the cheapest fix on the table: `main.js` already drives `emissiveIntensity` on `SIGN_MATS.neon`/`SIGN_MATS.lit` by time-of-day but never blooms it. A **selective bloom** pass targeting that existing material group is close to a drop-in change.
- Problem 1 (far-LOD "painted-window boxes") is best attacked by **baking AO/bounce tint into vertex colour** at mesh-build time — the exact moment per-vertex AO is already computed — plus **interior mapping** for fake lit rooms behind far-LOD windows. Both are ~free at runtime.
- Problem 5 (haze swallowing docks/suburbs) is a consequence of AI City's fog being **flat/linear-by-distance only**. The fog is already colour-synced to the sky dome (good, keep it) — it just needs a height-falloff term added to the custom shader system they already own.
- A brand-new official three.js addition, `SunLight`/`SunLightShadow` (2-cascade CSM, runs under `WebGLRenderer`, shipped in r186), is a promising but literally one-day-old replacement for AI City's hand-rolled adaptive shadow frustum. Worth a spike, not urgent.
- N8AO (screen-space AO) and SSGI exist and are cheap-ish (N8AO's own docs claim ~1ms typical at half-res), but both risk muddying the already-baked per-vertex AO and flattening the bold colour if run at default strength. Use AO subtle and contact-only; skip SSGI for now.
- Tilt-shift/DOF and global outline passes are high-risk here: they read as "toy," undercut GTA street-level immersion once the camera zooms in, and an outline pass would visually amplify the hairline-railing complaint (problem 4).

## Findings by sub-question

### 1. What actually carries the "premium" voxel look

**MagicaVoxel**: the built-in renderer is a GPU path tracer — unbiased light transport gives soft shadows, colour-bleeding bounce light and "creamy" DOF bokeh as one physical side-effect, offline speed [likely, ephtracy.github.io + HN coverage]. Lesson: soft shadow + bounce + shallow DOF *together*, not any one alone, is what sells the diorama read.

**Teardown** (Tuxedo Labs), per a detailed third-party technical breakdown [likely, not Tuxedo Labs' own words, https://acko.net/blog/teardown-frame-teardown/]: deferred G-buffer, GPU ray-march through per-object voxel volumes with MIP-accelerated empty-space skipping, a CPU-built volumetric shadow map of the whole level, RTAO via cosine-hemisphere sampling, stochastic diffuse bounce denoised with spiral blur + temporal accumulation, blue-noise-jittered specular, mip-pyramid bloom. Notably it does **not** do full GI — it fakes bounce with ray-traced AO/soft-shadow, and that's enough to read as premium. No frame-time numbers found.

**Minecraft shader packs** (BSL, Complementary, SEUS) converge on one feature set: realtime coloured shadows, volumetric light shafts, AO, bloom, stylised water/clouds; SEUS leans brighter/"realistic," BSL leans warmer/stylised with bloom and outlines [likely, shader-pack comparison sites, consistent across sources]. Volumetric god-rays + bloom are what these add on top of AO+shadow — directly relevant to the "moody night with warm lamp pools" the original AI City map had.

**Cloudpunk**: hand-authored voxel city whose atmosphere is carried almost entirely by weather and night light density — constant rain, reflective puddles, saturated neon layered into fog [likely, multiple reviews]. No fancy GI — just wet reflections + neon + fog density, cheap and exactly matched to AI City's problem-7 needs.

**LEGO Builder's Journey**: Unity HDRP with hardware ray tracing (shadows, reflections, some GI) [likely, Unity's own case study + press coverage]. Its "diorama" read comes from *true*, depth-anchored macro-photography DOF and physically-correct glossy-plastic specular, not a cheap tilt-shift gradient — matters for sub-question 6.

**Ranking, synthesized across all five**: (1) soft grounded shadow + AO — universal, non-negotiable; (2) bounce/indirect light or a convincing fake; (3) bloom on bright/emissive elements only, never global; (4) fog/haze as scene colour, not grey; (5) DOF only when geometrically real. Specular variety and bevels are finishing touches everywhere, never the load-bearing effect.

### 2. AO and indirect light for voxels

**Per-vertex voxel AO** (what AI City's base engine already does — `AO = [.5, .68, .85, 1]` in main.js matches this scheme exactly): computed from 2 side neighbours + 1 corner neighbour per vertex, 4 discrete levels, baked at mesh-build time so it costs nothing at runtime, and merges correctly with greedy meshing because faces only merge where AO is equal across shared vertices; a known anisotropy artifact (interpolation direction depends on triangle-diagonal choice) is fixed by flipping the diagonal when `a00+a11 > a01+a10`. [verified, https://0fps.net/2013/07/03/ambient-occlusion-for-minecraft-like-worlds/ — the canonical source for this exact technique].

**SSAO/SAO/GTAO/N8AO** (real-time, per-pixel): what baked vertex AO structurally cannot do is occlude between *static* geometry and *dynamic* objects — a car in a driveway or a person against a wall gets no contact shading from vertex AO alone. N8AO (`N8python/n8ao`) plugs into three.js's own `EffectComposer` via `N8AOPostPass` (can replace `RenderPass`); its docs claim a roughly fixed ~1ms cost for the depth-aware half-res upscale path and a 2–4x speedup at half-res, with temporal stability as its main design goal (matters for AI City's orbiting camera) [verified, https://github.com/N8python/n8ao]. GTAO/SSAO/SSGI also ship as native TSL nodes for WebGPU (see §7) — not relevant unless AI City migrates renderers.
**Artifact risk**: screen-space AO stacked on already-baked vertex AO can double-darken corners and crush the bold local colour the direction wants. Keep intensity low and radius small (contact-scale, not city-scale).

**Baking bounce light into vertex colour**: buildings/roads/terrain are static per chunk except for scars, so a one-time or load-time bake — sampling a few bounce directions or biasing toward nearby ground/sky colour — written into the same vertex-colour channel AO already occupies costs nothing at runtime. `three-gpu-pathtracer` (gkjohnson) is a plausible *offline* tool (a path tracer on `three-mesh-bvh`; an open repo issue discusses adding a lightmap/AO-baking demo, so it's not turnkey today) [likely, https://github.com/gkjohnson/three-gpu-pathtracer].

**Light probes**: `THREE.LightProbe` (core) and `LightProbeGenerator` (examples/jsm/lights) both exist in current three.js [verified against the r186 tag] — spherical-harmonics ambient from a baked cubemap, useful for giving moving agents/cars location-correct ambient tint instead of one flat `HemisphereLight` island-wide. Infrastructure work (needs a probe-placement/bake pass per district), not a quick win.

**SSGI**: exists as a native WebGPU TSL node (`SSGINode.js`, example `webgpu_postprocessing_ssgi.html`) [verified] and as the mature WebGL library `realism-effects` (0beqz), which bundles SSGI/TRAA/SSR for classic `EffectComposer` scenes — its README notes v2 is "currently in the works," i.e. some churn risk [likely, https://github.com/0beqz/realism-effects]. Real bounce light, but noisier and pricier than AO-only; not a near-term recommendation at a strict 60fps browser target.

### 3. Shadows

AI City today (`main.js` lines 61, 81–83): `renderer.shadowMap.type = THREE.PCFShadowMap` (basic, small fixed kernel, not the softer `PCFSoftShadowMap`), one `DirectionalLight` sun at 4096×4096 (2048 on mobile), with a **hand-rolled adaptive single-cascade frustum** resized to camera-to-target distance and texel-snapped to avoid shimmer, plus an explicit cache: the map redraws only on frame movement, caster add/remove, or throttled to ~30Hz during continuous motion (the "cached sun shadow map" from the shared brief).

- **PCF vs PCFSoft vs PCSS vs VSM**: all four exist in three.js with official examples (`webgl_shadowmap.html`, `_pcss.html`, `_vsm.html`) [verified, present in the r186 examples tree]. PCFSoft is the same cost class as what's already running, just a larger/softer kernel — the obvious first upgrade. PCSS adds contact-hardening (penumbra grows with occluder distance) at extra per-sample cost. VSM is very soft/blurrable but has a documented compositing risk — a reported ~33% framerate drop when combined with an additional composited pass [likely, GitHub issue, not directly fetched] — a real concern for AI City's multi-pass composer.
- **Cascaded shadow maps**: the established third-party option is `three-csm` (`StrandedKitty/three-csm`), 4 cascades by default, but only patches Phong/Standard materials and needs manual per-material setup [likely]. More notably, three.js r186 (tagged yesterday) ships a **brand-new built-in** `SunLight`/`SunLightShadow` pair — 2 fixed cascades, 10% cross-cascade blend, auto-fit to the view frustum, default 1024×1024 per cascade, confirmed working under plain `WebGLRenderer` (not just WebGPU) via the official `webgl_lights_sunlight.html` example [verified, read `SunLight.js`/`SunLightShadow.js` source directly at the r186 tag]. A close match for what AI City's hand-rolled frustum-fit code already does, natively, with 2 cascades instead of 1 — one day old at time of writing, promising but untested.
- **Contact shadows**: AI City already has a cheap, effective fake — `atmosphere/contacts.js` draws soft radial-gradient blob decals (canvas-texture, batched `InstancedMesh` per kind) under trees, houses and people at ~0.20–0.23 opacity, dimmed further at night; cars have their own kit contact shadows. A legitimate, widely-used stylized technique already in place — extend its coverage, don't replace it.

### 4. Colour pipeline

`main.js` line 61: `renderer.toneMapping = THREE.NeutralToneMapping` by default. Line 75 has a *disabled-by-measurement* path: `if (colourShipped()) renderer.toneMapping = THREE.ACESFilmicToneMapping; // kit mode now keeps Neutral (ACES greyed the palette ~27%)` — AI City's own team already ran this experiment and rejected ACES quantitatively. NeutralToneMapping is the Khronos PBR Neutral operator, confirmed by three.js's own example to sit alongside Linear/Reinhard/Cineon/ACESFilmic/AgX/Custom as a selectable mode [verified, fetched `webgl_tonemapping.html`]. It's designed to leave low-to-mid range close to untouched and only compress values past typical SDR headroom — the least aggressive of the "filmic" family, which is exactly why it preserved the palette where ACES didn't. **AgX shares ACES's design goal** (deliberate filmic desaturation/rolloff) — skip testing it; same risk profile as the ACES result already measured.

**LUT grading**: `LUTPass` (WebGL) and `Lut3DNode` (WebGPU TSL, official example `webgpu_postprocessing_3dlut.html`) both exist [verified]. AI City already has a home-grown equivalent better suited to a multi-palette city: the `depthPass` `ShaderPass` (lines 468–478) does a per-palette split-tone shadow/highlight grade (`GR.amt/sat/shT/hiT`, driven by each district's `.grade`) plus an optional Bayer-dithered retro palette-quantize mode, no-op by default. Cheaper to maintain than a 32³/64³ LUT texture per palette and already wired to the city's district-identity system — keep it, don't bolt on a LUT unless a future "cinematic screenshot mode" wants one.

**Fog as colour**: already done right in one sense — `scene.fog` (`THREE.Fog`, linear) has its colour continuously copied from the sky shader's horizon/haze uniform every frame (`atmosphere/sky.js` line 47, `atmosphere.apply`), not an arbitrary grey. The gap is that `hazeRange()` (`atmosphere/plan.mjs` lines 69–71) computes near/far purely from camera-to-target **distance**, with no **height** term — every part of the city at a given distance gets the same haze regardless of whether it's a rooftop or a quay at sea level. That's the mechanical cause of problem 5.

### 5. Night (problem 7)

`main.js` already computes `lighting.windows`/`U.night.value` and drives two emissive material groups by time of day: `SIGN_MATS.neon` (`.35 + windows*1.6`) and `SIGN_MATS.lit` (`windows*.85`) — the infrastructure for "lit signage" exists; there is no bloom pass anywhere in the composer to make it pop, which matches the diagnosis exactly ("neon doesn't pop").

- **Selective bloom**: `SelectiveBloomEffect` (pmndrs/postprocessing) supports `mipmapBlur` for a soft rolloff and per-object selection lists [verified, official docs]; three.js also ships an official layer-based pattern (`webgl_postprocessing_unreal_bloom_selective.html`). Either integrates with the existing `SIGN_MATS` groups almost directly.
- **Interior mapping** (fake rooms behind windows, no geometry): a fragment-shader ray-cast against a box to fake a perspective-correct room behind a flat window quad, originating from a 2008 CGI-conference paper and in production use (The Sims, Forza Horizon, Spider-Man cited) [likely, https://www.gamedeveloper.com/programming/interior-mapping-rendering-real-rooms-without-geometry]. Runs entirely per-fragment, scales to any city size, rooms are necessarily flat-textured boxes (no real furniture) — appropriate fidelity for AI City's far-LOD buildings, exactly where problem 1 shows up worst.
- **Many small lights**: AI City already pools a constant 6 dynamic point lights (`createLightPool`) across streamed shop/street lights — sound, standard. `IESSpotLight` (real IES-profile cookies) is confirmed **WebGPU-only** [verified, docs] — not usable without a renderer migration. The WebGL-compatible substitute for "warm lamp pools" is a projected ground decal, and AI City already has the machinery in `groundContacts` — an additive warm-toned variant of that same system gets most of the visual goal for near-zero extra cost.
- **Wet asphalt**: nothing found in the grep of `main.js` (no SSR pass, no wet-road shader). True screen-space reflections exist (`SSRNode` in TSL/WebGPU, or `realism-effects`' WebGL package) but are a heavier ask. A fresnel-driven cheat — blend a blurred, flipped sky/building colour into the road material by view angle, night-gated — is the traditional low-cost substitute used across stylized racers and gets most of the "wet street" read for close to nothing.

### 6. Diorama / toy-camera effects

The LEGO Builder's Journey comparison matters here: its shallow DOF works because it's true, depth-anchored macro-photography DOF paired with physically-correct glossy plastic — the miniature illusion comes from correct optics at close range, not a screen gradient. A cheap fullscreen tilt-shift blur without matching focal geometry reads as an Instagram filter, and at AI City's typical wide overhead-district framing it risks looking like exactly the "tiny-planet"/toy-town presentation already ruled out — worse, it fights the GTA street-level-immersion goal once the camera zooms down, where it would need to disable anyway. **Outlines** (`OutlineNode` now exists natively in TSL, or the classic composer outline pass) could reinforce the original map's chunky-silhouette charm on landmarks, but applied globally they'd amplify problem 4's hairline-railing complaint — thin geometry with an outline either disappears or looks like a sticker. If used at all, restrict to a render-layer of large landmark silhouettes only. Edge/vignette darkening is cheap and low-risk but low-payoff.

### 7. three.js state in 2026

Current release: **r186**, tagged 2026-09-24 [verified, `https://api.github.com/repos/mrdoob/three.js/releases/latest`]. Two parallel post-processing worlds exist:

- **WebGL + `EffectComposer`** (what AI City runs today): mature and complete for everything needed here — `LUTPass`, selective bloom (pmndrs/postprocessing or three.js's own pattern), N8AO, `three-csm` or the new `SunLight`. No renderer change required.
- **WebGPURenderer + TSL nodes**: as of r186, `examples/jsm/tsl/display/` genuinely ships `GTAONode`, `SSAONode`, `SSGINode`, `SSRNode`, `TRAANode`, `TAAUNode`, `BloomNode`, `DepthOfFieldNode`, `Lut3DNode`, `OutlineNode`, `GodraysNode`, `MotionBlur`, `RetroPassNode`, `DenoiseNode`, `SSSNode` [verified, read the repo contents at the r186 tag], each with a live official example. A real, comprehensive, current node-based post stack — but adopting it means migrating off `WebGLRenderer`, rewriting materials/lights against TSL's registration model (`SunLightNode` needs `renderer.library.addLight(...)` under WebGPU specifically), and accepting WebGPU's younger, less-universal browser support — a strategic decision, not a rendering tweak.
- **Frame-cost numbers**: no authoritative, verifiable ms budget for GTAO/SSGI/TRAA on Apple-silicon or low-end integrated GPUs at 1080p was found — search surfaced only unattributable third-party blog figures not worth repeating without a primary source. The one concrete number I can stand behind is N8AO's own claimed ~1ms fixed cost for its half-res upscale path [verified, project README]. Recommend measuring directly (`renderer.info`, Chrome's GPU profiler) on the actual target hardware before budgeting any new pass — "unknown" is the honest answer, not a guess.

## Apply to AI City — prioritized

**Problem 7 (flat night, neon doesn't pop) — cheapest wins, do first:**
1. **Selective bloom on `SIGN_MATS.neon`/`.lit`.** Neon and lit windows glow, brick/asphalt stays crisp. Effort **S**. Cost ~1–3ms (measure, don't assume). Risk: none — additive at night only.
2. **Warm "lamp pool" ground decals**, cloned from `groundContacts`' InstancedMesh/canvas pattern (additive warm blend, not subtractive dark). Recovers the original map's lamp pools. Effort **S**. Cost <0.5ms (proven batching). Risk: none.
3. **Per-instance window colour-temperature + on/off variation** instead of two uniform emissive buckets. A skyline with variety, not flat beige. Effort **S–M** (touches per-instance data). Cost ~0. Risk: none.
4. **Interior mapping on far-LOD windows** (fake lit rooms, no geometry). Far buildings stop being flat painted boxes at night. Effort **M** (new shader + window-rect UVs on Astra's far-LOD meshes — cross-team). Cost ~0.1–0.3ms/building. Risk low-medium — keep room textures flat/Simpsons-bold, not photoreal, or it clashes with problem 4 instead of fixing it.

**Problem 1 (far view reads as generic low-poly):**
5. **Bake AO/bounce tint into vertex colour** for static far-LOD geometry at build time (same pass that already computes AO). Facades/roofs get contextual light instead of flat colour. Effort **M** (needs a bake step — `three-gpu-pathtracer` offline, or a simpler hand-rolled hemisphere sample). Cost **0ms runtime**. Risk low.
6. **Cheap edge/rim highlight reusing the existing per-vertex AO corner data** (fresnel/normal-based, no new geometry) as a stand-in for bevel highlights. Effort **S–M**. Cost <0.5ms. Risk low.
7. Interior mapping (shared with item 4).
8. **N8AO, tuned subtle, contact-only** — to seat cars/people/props against static geometry, not to relight the whole city. Effort **S–M** (drop-in `N8AOPostPass`, then tuning). Cost ~1ms class. Risk medium if over-applied (see "what not to do").

**Problem 5 (haze swallows port/suburbs):**
9. **Add a height-falloff term to the existing fog/sky shader** (`atmosphere/sky.js` + `plan.mjs`, files AI City already owns, no new library). Haze thickens near ground/water, rooftops stay crisp from the overhead camera. Effort **M**. Cost ~0. Risk low — tunes an existing system.
10. **Night-gated fresnel wet-asphalt tint** on road material. Quays/lots/plazas stop reading as dead flat space. Effort **S**. Cost near-0. Risk low.

**Problem 4 (style clash):**
11. **Unify the environment/reflection source**, currently kit-only (`RoomEnvironment` + PMREM, generic indoor room, intensity 0.18), so kit and base-engine materials sample the same sky-based reflection instead of only kit meshes getting any IBL at all. Effort **M**. Cost ~0 runtime (one-time PMREM bake, same as today). Risk low.
12. Hairline-railing/lamp-post thinness is a modeling/proportions issue, not rendering — flag to whoever owns kit assets/LOD.

## What not to do

- **Don't test AgX.** AI City already ran this experiment by proxy on ACES and measured a 27% palette hit; AgX shares the same filmic-desaturation design goal.
- **Don't migrate to WebGPURenderer to chase native GTAO/SSGI/TRAA/SunLight-CSM right now.** Genuine, comprehensive stack, but an L/XL rewrite with real browser-support risk, disproportionate to fixing problems 1, 5 and 7 — all solvable in the current WebGL pipeline.
- **Don't run screen-space AO at full strength/global scope.** It will double-dark the already-baked vertex AO and crush the bold flat colour the direction depends on — keep it subtle and contact-scoped.
- **Don't add a global outline pass or a signature tilt-shift/DOF look.** Both fight GTA street-level immersion and the ruled-out toy-town/tiny-planet presentation; an outline pass specifically would amplify the hairline-railing complaint instead of fixing it.
- **Don't switch to VSM shadows** given the documented compositing/perf risk stacked with other composer passes — PCFSoft is the safer, same-cost-class upgrade.
- **Don't bolt a 3D LUT onto the render pipeline.** The existing per-palette split-tone grade (`depthPass`) already does this job, cheaper, and already wired to the city's district-identity system.
- **Don't build true dynamic SSR for wet streets yet.** The fresnel cheat gets most of the read for near-zero cost; save SSR for a WebGPU-era pass if the renderer ever migrates.

## Sources

- [verified] https://0fps.net/2013/07/03/ambient-occlusion-for-minecraft-like-worlds/ — canonical per-vertex voxel AO technique
- [verified] https://api.github.com/repos/mrdoob/three.js/releases/latest — three.js r186, tagged 2026-09-24
- [verified] https://github.com/mrdoob/three.js/tree/r186/examples/jsm/tsl/display — TSL post-processing node listing (GTAO, SSGI, SSAO, SSR, TRAA, TAAU, Bloom, DepthOfField, Lut3D, Outline, Godrays, MotionBlur, Retro, Denoise, SSS)
- [verified] https://github.com/mrdoob/three.js/blob/dev/examples/webgl_tonemapping.html — confirms Neutral/AgX/ACESFilmic/etc. tone-mapping options
- [verified] https://threejs.org/examples/webgpu_postprocessing_ssgi.html / _traa.html / _ao.html / _3dlut.html / _dof.html / _bloom_selective.html / _godrays.html — live official examples, r186
- [verified] https://threejs.org/examples/webgl_shadowmap_pcss.html and webgl_shadowmap_vsm.html — PCSS/VSM official examples exist
- [verified] https://threejs.org/examples/webgl_lights_sunlight.html — confirms new SunLight works under WebGLRenderer
- [verified] https://github.com/mrdoob/three.js/blob/r186/examples/jsm/lights/SunLight.js and SunLightShadow.js — read directly: 2 cascades, 10% blend, auto-fit frustum, 1024×1024 default per cascade
- [verified] https://github.com/N8python/n8ao — N8AO README, ~1ms half-res cost claim, EffectComposer integration
- [verified] https://threejs.org/docs/pages/LUTPass.html — LUTPass API
- [verified] https://threejs.org/docs/pages/IESSpotLight.html — confirms WebGPU-only
- [verified] https://pmndrs.github.io/postprocessing/public/docs/class/src/effects/SelectiveBloomEffect.js~SelectiveBloomEffect.html — SelectiveBloomEffect API
- [likely] https://acko.net/blog/teardown-frame-teardown/ — third-party deep technical breakdown of Teardown's renderer (not Tuxedo Labs' own words)
- [likely] https://github.com/StrandedKitty/three-csm — CSM library, 4 cascades, Phong/Standard materials only
- [likely] https://www.gamedeveloper.com/programming/interior-mapping-rendering-real-rooms-without-geometry — interior mapping technique origin and production use
- [likely] https://resources.unity.com/games/lego-builders-journey-rendering-realistic-lego-bricks-in-unity — Unity HDRP + RTX confirmed for LEGO Builder's Journey
- [likely] https://www.jumpdashroll.com/article/cloudpunk-review and https://techraptor.net/gaming/features/ion-lands-cloudpunk-visuals-worldbuilding — Cloudpunk's voxel+neon+rain visual approach
- [likely] https://minecraftshader.com/bsl-shaders/ and https://complementaryshaders.com/complementary-shaders-vs-bsl/ — BSL/Complementary/SEUS feature comparison
- [likely] https://github.com/0beqz/realism-effects — SSGI/TRAA/SSR for WebGL EffectComposer; v2 noted as in progress
- [likely] http://ephtracy.github.io/mv_main.html — MagicaVoxel official page, path-tracer description
- [likely] https://github.com/mrdoob/three.js/issues/19778 — reported VSM + outline-pass framerate regression (not fetched directly, via search)
- [verified, code] `world/main.js`, `atmosphere/sky.js`, `atmosphere/contacts.js`, `atmosphere/plan.mjs` — read directly for all "AI City already does X" claims
