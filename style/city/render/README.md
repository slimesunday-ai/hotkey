# render/ · post stack, render panel, looks

**Use it.** Press **RENDER** in the top bar or `\`. Sections have an on/off switch and controls; double-click a row to reset it. ↑ ↓ reorder the post stack, which runs top to bottom. The header shows frame and GPU ms (per pass with a GPU timer). Lighting sections (group `light`) appear too.

**Looks.** A look is a JSON diff of the settings, `{ section: { key: value } }`, the same as `settings.snapshot()`, so `{}` is today's look.
- Built-ins are `presets/<name>.json`, listed in `presets/index.json`. `_` keys are notes.
- **Save as…** keeps a look in this browser; **Export** and **Import** move JSON; **Reset** returns to Current.
- `?preset=<name>` loads a look at start, in shots too. Picking one updates the URL.
- **The default look is Camcorder '98** (`presets/camcorder-98.json`, slime's own panel export installed as is; `looks.js` `DEFAULT_LOOK`). A viewer with no `?preset` gets it, and the URL stays clean for it. `?preset=current` is the plain render.
- **Tool runs stay on `current`.** Shots (`?shot`), bakes, hashes, audits, `?bench` and the `nodyn` tool runs load no look unless they pass `?preset`, so the pixel regression checks don't move (main.js).
- **Post-only looks keep the light.** A look that names no light section (time, light, sky, fog, clouds, contact, night) keeps the page's current light: Camcorder '98 and the film looks stay night on the night build. Bundled looks are unchanged.

**Default settings = today's plain render.** With nothing on, `post.render()` is the old `renderer.render()`: no composer, no targets. Tone mapping and exposure live in the materials, so they add no pass. Grain defaults to `static`, the CSS overlay. (Every section's default is still off: the viewer's Camcorder '98 is a look loaded on top.)

**How.** With an effect on, the scene draws into an MSAA half-float target flagged `isXRRenderTarget`. The flag makes three tone-map, encode and fog exactly as on the canvas. Passes then work in display values; the last draws to the screen.

**Add an effect.** Add an entry to `EFFECTS` in `fx.js`:
- `name`, `title`, `order` (its default stack slot)
- `fields`, including `on: { v: false }`
- `make(ctx)`, usually `simple(ctx, glsl, uniforms, set)`
- optionally `live(values)`

The panel, presets and stack order pick it up.

## Presets (look-dev pass, 2026-09-28)

Sheet: `render-presets-sheet.jpg` (3 cameras each, with GPU cost). Each file's `_tweak` note names the first sliders to move.
- **polished** (cheap): the art review's re-light. Warm key, violet shadow sides, soft shadows, clouds. Tweak `light.fill`/`env`.
- **golden-hour** (medium): low orange sun, coral sky, towering clouds. Tweak `light.elevation`/`azimuth`.
- **blue-hour-neon** (heavy, night build): indigo sky, mixed window tints, lamp pools, emissive bloom. Tweak `bloom.strength`, `night.pools`.
- **nostalgic-film** (medium): Portra warmth, milky blacks, halation, moving grain. Tweak `grade.fade`, `lutMix`.
- **kodachrome** (cheap): dense, saturated, contrasty. Tweak `grade.contrast`/`saturation`.
- **camcorder-97** (heavy): 4:3 tape with bloom, sharpening halos and chroma. Tweak `chroma.amount`, `letterbox.on`.
- **dazed-zine** (cheap): dithered to 8 city colours. Tweak `dither.colors`/`pixel`.
- **pop-cel** (medium): bright candy toon, hard shadows, lilac shade, light posterise. Tweak `light.skyFill`, `dither.strength`.
- **noir-night** (heavy, night build): silver B&W, lamp pools, 2.39 bars. Tweak `grade.saturation`.
- **overcast** (cheap): soft grey day, full cloud deck, colour kept. Tweak `clouds.coverage`.

Rules: bundled looks spell out their bundle, because a load resets unlisted fields to day. Keep `night.pools` at 0 on day looks, since pools draw by day too. Night bloom presets run grade before bloom (see `_stack`).

## Film emulation (2026-10-05)

`film.js`, research and sources in `style/research/film-emulation-2026-10-05.md`. All OFF by default. One extra pass (`film`, the post stack's "Film emulation", after grain) plus the grain section's `film` type; ≈0.2 ms at 1080p together (`shots/film/bench.json`).
- **Film emulation** (`film`): the master switch and the **film frame rate** (12–30 fps or every frame): every artefact and the film grain change once per film frame while the city renders at 60. `roll`: another run of dirt. Switching any film section on in the panel switches this on; off = an instant A/B.
- The panel's **Film** group, each with its own switch:
  - **Film stock** (`stock`): `stock`, `amount`, `toe`, `shoulder`. An analytic neg → print model per stock (per-layer gamma, toe/shoulder, D-max/D-min, cross-talk, hue nudges) baked into a 32³ LUT: print, portrait 400, tungsten 500T, consumer 400, pastel 400, slide 64, slide 100, super 8 reversal, faded print, warm print, cross-process.
  - **Gate weave** (`weave`): `amount` (px at 1080), `vertical`, `judder`.
  - **Flicker** (`flicker`): `amount`, `style` (projector / exposure / both), with a gentle gradient across the frame.
  - **Dust & dirt** (`dust`): `density` (per film frame), `size`, `white share` (negative vs print dirt), `lint & hairs`, `gate hair`.
  - **Scratches** (`scratches`): `density`, `width`, `persistence` (s), `wander` (px), `tone` (dark / green / bright / mixed), `base scratches` (brief, bright).
  - **Light leaks** (`leaks`): `amount`, `per minute`, `size`, `color`.
  - **Gate & borders** (`gate`): `aspect`, `rounded corners`, `soft edge`, `surround`, `borders` (none / frame lines / super 8 / 16 mm strips with perforations).
- **Film grain** (grain `type: film`): `format` (8 / 16 / 35 mm), `amount`, `size` (× the format's), `response`, `color` (colour = dye clouds per layer). Old `static` / `animated` grain is untouched.
- Everything is sized at a 1080 px frame and scaled, so photo-mode stills (4K, reels) and clips carry the same film. Deterministic per film frame and roll.

Looks (built on Camcorder '98; post-only, so they keep night on the night build). Each `_about` says what it keeps and swaps:
- **camcorder-98-film**: the '98 tape look whole, shot on 16 mm (film grain, weave, flicker, the odd speck, scratch and leak, soft corners).
- **super-8-home**: reversal stock, 8 mm grain, 18 fps, ~3 px weave and judder, breathing exposure, specks and hairs, warm leaks, a 4:3 rounded gate.
- **16mm-street-doc**: tungsten neg through a print, 16 mm grain, weave, scratches, the 1.37 gate.
- **35mm-print**: neutral print, fine grain, steady projection, black print dirt, 1.85.
- Stock homages (35 mm grain, a whisper of weave and dust, no gate): **portra-ish-400**, **vision-ish-500t**, **pro-ish-400h**, **superia-ish-400**, **kodachrome-ish-64**, **ektachrome-ish-100**.

Shots, clips, the six-frame strip and the bench: `node style/city/tools/filmshots.mjs --looks … --views … --clip 36 --strip super-8-home --bench` → `shots/film/`.
