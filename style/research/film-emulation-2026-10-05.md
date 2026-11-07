# Film emulation: research and build (2026-10-05)

**Brief.** A film emulator with dust and scratches that looks like real film, starting from the real emulators (Kodak, Fujicolor and so on).

**Built.** `style/city/render/film.js`, plus the grain section's new `film` type in `fx.js`. Looks are in `render/presets/`. Cost is measured below.

**Method.** About 30 minutes of web research came first, and its numbers drive the defaults. Pixel figures assume a 1080 px tall frame (1920 across).

## 1. What the good emulators do

| Tool | Pipeline / key technique | What we took |
|---|---|---|
| [Dehancer](https://www.dehancer.com/learn/articles/the-classic-color-film-production-process) | Negative profile, then print profile. Separate grain, [halation](https://www.dehancer.com/learn/articles/halation-in-dehancer), bloom, breath and weave modules. [Grain](https://www.dehancer.com/learn/articles/how-does-film-grain-work-in-dehancer-ofx-plugin) is a procedural emulsion model. | Stock (neg → print) is separate from the artefacts. Halation and bloom are separate sections. |
| [FilmConvert Nitrate](https://jonnyelwyn.co.uk/film-and-video-editing/understanding-film-emulation-with-filmconvert-nitrate/) | Normalises the camera, applies the stock curve, then adds grain from 6K scans with a response curve keyed to the image tone. | Grain amplitude follows the tone, and each stock carries a grain amount. |
| [Video Village Filmbox](https://videovillage.com/filmbox/technical_faq) | Measured Vision3 neg contact-printed to 2383. Grain, dust, halation and weave are modelled from Super 35 scans. Grain has 9 tonal zones. | The split into stock, grain, dust, halation and weave. |
| [Genesis (Cullen Kelly)](https://mixinglight.com/color-grading-tutorials/deep-dive-cullen-kelly-genesis-plugin/) | Parametric chain from Kodak papers: negative → development → print → printer points → interlayer saturation → halation → grain. | An analytic, parametric stock model, not a captured LUT. |
| [Juan Melara](https://juanmelara.com.au/blog/print-film-emulation-luts-for-download) | Emulates the negative first, then the 2383 print. He says this gives "far superior results". | The print stage gives the deep blacks and rolled highlights. |
| darktable [negadoctor](https://docs.darktable.org/usermanual/development/en/module-reference/processing-modules/negadoctor/) and [filmic](https://docs.darktable.org/usermanual/development/en/module-reference/processing-modules/filmic-rgb/) | Densitometric controls: Dmin, Dmax, paper grade and gloss. Filmic is a log shaper plus an S-curve. | Per-layer black and white limits (D-max, D-min), and toe and shoulder controls. |
| [TrueGrain](https://grubbasoftware.com/faq.html) | Real scanned B&W grain. A [patent](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/12705810) notes overlay grain is not signal-dependent. | Our grain is signal-dependent. |
| [spektrafilm](https://github.com/andreavolpato/spektrafilm) (open) | Spectral pipeline: negative curves, DIR couplers, grain in density, halation, print, scan ([whitepaper](https://spektrafilm.114c.de/technical/)). | The per-channel gammas, blue grain about 1.4× coarser, and the halation strengths. |
| RNI ([DPReview](https://www.dpreview.com/news/7403491504/really-nice-images-releases-all-films-5-for-capture-one-offering-real-film-icc-profiles/)) and [VSCO](https://eng.vsco.co/vsco-film-x-&-the-imaging-lab/) | Charts shot on film and digital, then the profiles matched. | We have no charts, so our stocks are homages tuned by eye to the descriptions below. |

## 2. Physics that shaped the model

### Negative → print
- The negative's gamma is about 0.6 ([Spitzak/Cineon](https://spitzak.github.io/conversion/cineon.html)). The print's gamma is about 2.5–3.1 per channel; for 2383, red is steepest: R 3.14, G 2.55, B 2.47, from spektrafilm's datasheet-derived profiles.
- Each dye channel is stretched about 2.5–3× around mid-grey. That separates the channels, which raises saturation. The print toe rolls the highlights off, and the print reaches D-max above 3, which gives dense blacks.
- With mid-grey timed neutral, the steeper red gives warm highlights and cyan shadows. Our cinema stock does exactly this.
- Dye cross-talk comes from unwanted absorptions, which the orange mask cancels ([patent](https://patents.google.com/patent/EP0603964A2/en)). DIR couplers between layers raise saturation and local contrast.

### Grain
- In the Boolean grain model ([Newson, Delon, Galerne 2017, IPOL](https://www.ipol.im/pub/art/2017/192/)), coverage variance is u(1−u). Grain therefore peaks around the mid-tones and vanishes at pure black and pure white.
- Kodak and ARRI say grain is finer in the highlights and strongest in the shadows to mid-tones ([film grain and perception](https://cool.culturalheritage.org/videopreservation/library/film_grain_resolution_and_perception_v24.pdf), [CineD on ARRI Film Lab](https://www.cined.com/arri-film-lab-announced-real-time-analog-film-emulation-plugin-for-davinci-resolve-baselight-nuke/)).
- The blue layer is the coarsest.
- Grain clumps are about 10–30 µm. At 1080p that is about 0.8–2.3 px on 35 mm, 1.9–5.6 px on 16 mm, and 3.4–10 px on Super 8.

### Halation vs bloom
- Halation is light reflected off the film base back into the emulsion. It hits the red layer first, so the glow is red to orange, and it only shows round highlights against dark ([Dehancer](https://blog.dehancer.com/articles/halation/), [Color Finale](https://colorfinale.com/blog/post/cf-halation-11-24)).
- Bloom is a neutral, broad glow.
- spektrafilm puts halation at σ about 50 µm. That is about 4 px at 1080p on 35 mm, 9 px on 16 mm and 17 px on Super 8.

### Gate weave
- Professional registration is about 0.1 % of the image height, about 1 px ([Larry Blake](https://larryblake.substack.com/p/in-praise-of-super-8-part-three-of)).
- Super 8 cartridges have 30–40 µm of platen play ([patent](https://patents.google.com/patent/US20030180040A1/en)).
- Our estimates: 35 mm about 0.5–1 px, 16 mm about 1–2 px, Super 8 about 3–8 px. The motion is a fresh random offset each film frame plus a slow wander.

### Dirt and scratches
- **Dust.** Dust on the negative blocks light, so it prints white. Dust on the print projects black ([Photrio](https://www.photrio.com/forum/threads/little-white-dots-on-prints.73348/)). Blotches last about one frame; line scratches carry through many frames ([Springer](https://link.springer.com/article/10.1186/1687-5281-2013-33)).
- **Scratches** ([Pritchard](http://www.brianpritchard.com/FAOL/contents/2604200faol/Foncd/TEXTS/sect_6/scratches6.html), [Film-Tech](https://www.film-tech.com/ubb/f1/t005961.html)):
  - A base scratch on the print shows black. A base scratch on the negative shows white.
  - An emulsion scratch on a colour print goes green when the top magenta layer is gone, then yellow, then white when every dye layer is gone.
- **Hair in the gate.** A dark fibre at the frame edge for the length of a shot ([Wikipedia](https://en.wikipedia.org/wiki/Film_gate)).

### Flicker and light leaks
- Flicker is y = αx + β, with α and β smooth across the frame ([van Roosmalen](https://repository.tudelft.nl/file/File_d1ba9f68-7c17-4294-98d3-3c895dbf7864)). We estimate about ±1–3 % on 35 mm and ±3–8 % on Super 8.
- Light leaks are orange, red or magenta and strongest at the film edge ([Photo Studio Berlin](https://photostudioberlin.com/blogs/film-knowledge/what-causes-light-leaks-on-film)).

### Framing
- **Super 8.** The frame is about 5.46 × 4.01 mm. Its one perforation sits beside the middle of the frame, not at the frame line ([Wikipedia](https://en.wikipedia.org/wiki/Super_8_film), [Legacybox](https://legacybox.com/blogs/analog/8mm-vs-super8-film)). The gate has rounded corners.
- **16 mm.** The frame is 10.26 × 7.49 mm (1.37). Perforations are 1.83 × 1.27 mm at the frame lines, on both sides on double-perf film ([NFSA](https://www.nfsa.gov.au/preservation/preservation-glossary/double-perforation-16mm)).

### Stock signatures
Stock signatures come from:
- spektrafilm's profiles
- reviews: [Portra](https://timlaytonfineart.com/portra/), [500T](https://www.analog.cafe/r/kodak-vision-3-500t-52197219-film-review-kxxq) with its [datasheet](https://www.kodak.com/content/products-brochures/Film/VISION3_5219_7219_Technical-data.pdf), [Pro 400H](https://casualphotophile.com/2018/11/28/fujifilm-fujicolor-pro-400h-film-profile/), [Superia](https://parallaxphotographic.coop/fuji-superia-400-film-review/), [Kodachrome 64](https://photography-fyi.com/film/kodak-kodachrome-64), [E100](https://www.kodak.com/en/still-film/product/professional/ektachrome-e100-film/) and [Ektachrome 100D Super 8](https://www.pro8mm.com/blogs/blog/working-with-the-new-ektachrome-100d-7294)

What each one looks like:
- **Portra 400:** flat, open shadows, slow roll-off, warm skin, muted.
- **500T through a print:** contrasty, teal shadows, warm highlights, red halation.
- **Pro 400H:** cool and pastel, greens toward mint.
- **Superia 400:** the most contrast of the negatives, saturated reds and greens. Its shadows are disputed (green or magenta).
- **Kodachrome 64:** dense, punchy, magenta-leaning reds, restrained blues.
- **E100:** neutral to cool, clean whites, clean blues.

### Unverified
The SMPTE weave and jump specs, and the ARRI system-gamma figure, appeared only in search snippets.

## 3. What we built, and the research it rests on

Everything is one pass plus the grain pass, in display values. All of it is OFF by default.

- **Film stock (`stock`).** Each stock is an analytic stand-in for exposure → negative → print, baked into a 32³ LUT. A LUT is rebuilt only when a slider moves.
  - The stand-in has these parts:
    - cross-talk in linear light (saturation, hue)
    - a per-layer gamma (the crossover)
    - a per-layer toe and shoulder (print blacks and highlight roll-off)
    - D-max and D-min per layer
    - saturation, plus a hue hook (skin, greens, blues)
  - Stocks:
    - `print`, `portrait 400`, `tungsten 500T`, `consumer 400`, `pastel 400`
    - `slide 64`, `slide 100`, `super 8 reversal`
    - `faded print`, `warm print`, `cross-process`
  - The names are neutral, and there is no third-party LUT data.
- **Film grain (grain `type: film`).**
  - Generated once: a 256² noise tile per channel (white noise, a [1 2 1] blur, normalised).
  - Each pixel samples:
    - a fine layer
    - a rotated clump layer at a 0.53× scale
    - the blue layer at 0.7× (coarsest)
    - a 1 px hash for the single grains
  - The field goes through a steep soft-sign, so each clump is nearly all-or-nothing (the Boolean model seen through a viewing blur) rather than a soft blob.
  - Each layer shares part of the noise (the silver image) and keeps part as its own dye clouds.
  - Amplitude is about √(u(1−u)), peaking a little below mid-grey.
  - Format sets the clump size: 35 mm 1.1 px, 16 mm 2.1 px, 8 mm 3.5 px at 1080p. Strength is ×0.72 / 1 / 1.3. Size is scaled to the frame being drawn.
  - The offsets change every film frame.
- **Gate weave (`weave`).** Each film frame gets a slow sideways wander plus a fresh per-frame jitter, a vertical share, and rare judder slips (a frame jumps 1.6–3.8× the amount). The defaults are 0.8 px, 35 mm about 0.5 px, and Super 8 about 2.8 px.
- **Flicker (`flicker`).** The styles are projector (per frame), exposure (slow breathing) or both. A per-frame linear gradient across the frame implements the y = αx + β model.
- **Dust (`dust`).**
  - Births follow a Poisson process per film frame, and a third of the specks live two frames.
  - Specks are irregular blobs, lint is a fuzzy, fibrous, elongated clump, and hairs are thin curled arcs with taper.
  - White and black dust are set by `white share` (negative vs print dirt).
  - An optional gate hair sits at an edge for 1–4 s and trembles.
- **Scratches (`scratches`).**
  - Emulsion scratches live in slots. Each lives `persistence` s (±50 %), drifts slowly, jitters `wander` px per frame, and breaks along its length.
  - Tone is dark (print base), green (top dye layer), bright (all layers) or mixed.
  - Brief bright base scratches (negative base) flash through for 0.1–0.3 s.
- **Light leaks (`leaks`).** About `rate` per minute, each 0.6–2.4 s. A warm, red, golden or magenta glow comes in from a side edge, with a hotter core, a sin² envelope and per-frame flutter, screen-blended.
- **Gate & borders (`gate`).**
  - The projector aperture: aspect, soft edge and rounded corners. The gate stays still and the image weaves inside it.
  - Optional borders:
    - frame lines (the frames above and below)
    - a Super 8 strip with its perforation beside mid-frame
    - a 16 mm double-perf strip with perforations at the frame lines
  - In the two strip modes, the picture shrinks into the frame.
- **Film frame rate (`film.fps`).** 12, 16, 18, 24, 25 or 30, or every frame. Every artefact and the film grain change once per film frame, while the city renders at the screen rate.
- **Halation and bloom.** These stay the existing `halation` and `bloom` sections. The film looks switch halation on, red-orange, which is the research's split.

## 4. Cost (1920 × 1080, headless Chrome on this Mac Studio, Metal)

Method: `tools/filmshots.mjs --bench`. Each live pass is rendered 120× from the same input and synced with a 1 px read; the scene render is excluded. The numbers are in `style/city/shots/film/bench.json`.

| Pass | ms per frame |
|---|---|
| `film` (stock + weave + flicker + dust + scratches + leaks + gate) | 0.06–0.11 |
| `grain`, film type | 0.07–0.10 |
| **The new film stack** | **≈0.2** |
| Halation, which the film looks switch on (an existing section) | ≈0.8 |
| Bloom, carried over from Camcorder '98 | ≈1.1 |

The new film stack alone is about 0.2 ms. With halation it is about 1.0 ms, inside the 1.5 ms budget. The bloom is Camcorder '98's own, not part of the film stack.
