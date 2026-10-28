# The fresh registry: how a trait is built

Thirteen category files, each starting empty and each with exactly ONE owner. You add traits to your file and nothing else. Traits imported from the old Trait Studio live apart, in `imported/` (§ Imported traits). The Trait Studio, the anim lab and every check read the registry from `world/fresh/index.js`, which validates each entry and lists problems.

| Category | File | Look slot(s) |
|---|---|---|
| skin | `skin.js` | `skin` |
| hair | `hair.js` | `hair` |
| hats | `hats.js` | `hat` |
| eyes | `eyes.js` | `eyes` |
| eyewear | `eyewear.js` | `eyewear` |
| mouth + face ink | `mouth.js` | `mouth`, `mark` (each entry says `slot: 'mouth'` or `slot: 'mark'`) |
| mouths | `mouths.js` | `mouth` (§ Mouth: the mouth zone) |
| ears | `ears.js` | `ears` |
| tops | `tops.js` | `top` |
| bottoms | `bottoms.js` | `bottom` |
| shoes | `shoes.js` | `shoes` |
| accessories | `accessories.js` | `acc` |
| held | `held.js` | `held` (§ Held: through the closed fist) |

The registry holds **two pools that never mix**: the agents' traits (everything above, fresh and imported: what a real citizen, someone's AI agent, wears) and the **NPC pool**, the plain background civilians in `npc/` (§ The NPC pool).

Every trait is designed and checked on the **base mannequin** (`world/base-kit.js`): tan skin, bored eyes, one solid-colour pair of pants on the approved fuller leg form, and a plain neutral shoe. It has no mouth (the face is clean skin under the nose), hair, hat, top, eyewear, ear item, face ink or accessory. The base pieces are construction. They are never listed, kept or killed.

## The registry API

```js
// world/fresh/<category>.js: the only import allowed is './kit.js'
import { shade } from './kit.js';
export default {
  my_id: { name: 'Display Name', /* the slot's fields, below */ },
};
```

- **id**: `a-z`, `0-9`, `_`, at most 40 characters, unique in its slot. `none` and `base` are reserved. The curation key is `<slot>/<id>`.
- **name**: the display name, at most 40 characters. An optional `why` is one line the studio shows under the name.
- **One colour scheme per trait.** There are no colourways and no colour parameters (`cw`, `colorways` and the like are rejected). The studio shows exactly what you draw, and slime decides on that.
- **Units.** Character voxels, `S = 1/20 m` (5 cm). `+x` is the character's LEFT, `+y` is up, `+z` is forward (the face looks `+z`).
- **Colours** are 24-bit numbers (`0xRRGGBB`). **Materials** (`l`): `0` matte, `1` gloss, `2` metal, `3` lit (unlit emissive; keep it rare).
- **Grids.** A draw writes to a voxel grid with these methods:
  - `set(x, y, z, colour, l)`, `del`, `has`, `get`
  - `box(x0, y0, z0, x1, y1, z1, colour, l)`: half-open, `x0 ≤ x < x1`; colour may be `(x, y, z) => colour`
  - `ell(cx, cy, cz, rx, ry, rz, colour, l)`
  - `bmp(rows, palette, x0, top, z0, z1, l)`
  - `frontZ(x, y)` (the frontmost voxel's z), `onFront(x, y, colour, l)`
  - `clip(pred)` (delete what matches), `maxY(pred)`
- **`ctx`** is passed to every draw:
  - `ctx.sk`: the worn skin. `c(x, y, z)` and `sh(x, y, z)` (shade) give its colours, plus `layer`, `ink`, `brow`, `mouth`, `lash`, `lip` and `noEars`.
  - `ctx.look`: the whole look (read-only). Don't let your shape depend on other slots.
  - helpers: `shade`, `lerpHex`, `hash3`, `mulberry32`, `line(G, a, b, colour, l, t)`, `strand(G, points, colour, l, t)`
  - body helpers (tops and accessories): `sleeve`, `shoulderCap`, `onSeg`, `segY`, `kneeCap`, `frontZ(x, y)`, `chestFront(x, y)`, `neckRing()`
  - `as(part)`: accessories only
- **fine** (optional, on any entry in any file): `fine(P, ctx)`, the fine-detail pass: paint finer than a voxel and half-size voxels. See § Fine detail.
- The studio and every check show **registry problems** and fail on them. A broken entry is left out until it's fixed.

## The body: where everything is

| Part | Voxels |
|---|---|
| head | x −8..7, y 19..33, z −7..7 (the face plane is z 7) |
| eyes | 5-wide grids at x −7..−3 and 2..6, rows y 26..23 · brows y 29..27 · nose y 22 · the mouth zone x −6..5, y 19..21, z 6..8 (§ Mouth) |
| ears | x −10..−9 and 8..9, y 23..27, z −1..1 · **the lobe anchor** `LOBE`: R [−10, 23, 0], L [9, 23, 0] (§ Ears) |
| neck | x −1..0, y 17..18 |
| torso | x −5..4, y 10..17, z −2..2 |
| arms | x −8..−6 and 5..7, y 10..16 · hands (mittens) y 6..9, z −2..1, thumb at z 2 |
| legs | x −4..−2 and 1..3 · pants y 4..10 (waistband y 10) · shoes y 0..3 |

**Segments** (walk v2):
- The head is one rigid piece. It nods like a spring a beat after each step.
- The chest carries the torso, the shell of every top and anything lying on the chest.
- The pelvis carries the waistband and the seat.
- **Simple arms:** each arm is ONE rigid piece, shoulder to hand, swinging from the shoulder. There is no elbow.
- Each leg is one connected surface from hip to ankle, bending at the knee (the shader bends shared rings, so nothing is cut). Each shoe is a rigid foot.
- A body voxel's segment is decided by the body geometry it covers (`world/fit/body.js`), never by a bare x threshold.

**Depth budgets** (voxels proud of the surface underneath; the audit enforces them):

| What | Budget |
|---|---|
| prints, logos and letters on garments (recolour the shell) | 0 |
| face ink | 0 |
| a collar or hood edge | 1 |
| garment structure | 1 |
| padded structure (a top registered `puffy: true`) | 2 |
| eyewear | 1 |
| ear items | 1 |
| mouths (1 proud of the face plane; also 1 deep, § Mouth) | 1 |
| shoe detail | 1 |
| accessories | 2 |

A garment's relief is measured against its own shell: the most common depth of its own front (or back) nearby, counting the faces that a strap, a bag or a chain lies over. A chest sling or a pack covering the chest never makes a top's own front read as proud, so a top never needs bigger sleeves to pass (tops fix, 2026-10-01).

Eyewear and ear items are measured out of the surface they sit on: the eyewear front (z ≥ 8) along z, its arms along x, an ear item never up or down. A frame resting on a brow, a brim, a mouth piece or an eye's flick is contact, not depth (compat pass, 2026-10-01: the audit used to read a 5-tall frame touching a brow as 5 proud).

## Motion every trait must survive

The walk: five stride levels, arm swing, pelvis bob and roll, and the head's spring nod. Turns and arcs (the corners scene). The nine idles:

0. weight shift
1. look around
2. hand to face: the +x arm comes up forward to the face, the head drops
3. pockets + foot tap: both hands go into the hips; their contact with the leg is a known construction limit
4. hands behind the back: both arms pitched back and in
5. stretch / neck roll: one arm raised high, about 1.6 rad
6. nod to music
7. hands on hips
8. waiting at a crossing: the head turned

Look at your work in the lab (walk, corners, idle line-up) and in the studio's three modes.

## Per slot

### Skin (`skin.js`)
`{ name, c, sh?, layer?, ink?, brow?, mouth?, lash?, lip?, noEars?, decorate?(H, ctx) }`

- Skin is surface and face colour only: the skeleton never moves.
- `c` is a colour or `(x, y, z) => colour` (a per-voxel pattern). `sh` is the shade (default 0.8 × `c`). `layer` is the material.
- `ink` is the face-ink colour on this skin. Set it for contrast; the default is a dark brown.
- `brow`, `mouth`, `lash` and `lip` are face colours. `brow: null` means no brows.
- `noEars: true` drops the ears, and ear items hide with them unless they are `overHat`.
- `decorate(H, ctx)` paints the head after the base: recolour the skin, never add relief.

### Hair (`hair.js`)
`{ name, draw(H, ctx), coversEars? }`

- Hair sits on the head grid as a shell over the scalp: usually x −9..8, z −8..8, from the sides up past y 33. It may hang lower.
- **Every hair voxel must be 6-connected to the scalp.** Hats clip hair, and any hair cut off from the scalp is dropped. A strand you want must touch.
- `coversEars: true` marks hair that hangs over the ears: ear items then hide.
- Hair below the neck (y < 19) rides the HEAD, so it swings with the nod. Keep it clear of the shoulders and arms (x −8..7, y ≤ 18), or it cuts into the top and the arms in motion.

### Hats (`hats.js`)
`{ name, draw(H, ctx), coversEars?, cover?: 'auto' | 'all' | 'none', floats? }`

- First `H.clip(pred)` the volume the hat takes (it removes the head's skin and hair there), then draw. The head's top row is y 33, and a hat usually starts around y 30–31.
- **Cover.** `cover: 'auto'` (the default) reads a COVER volume off your own voxels:
  - the crown (everything at or above the rim)
  - every column over a brim voxel
  - the box above the brim
  All hair inside the cover is deleted automatically, then orphaned hair is dropped. Hair below a brim outside the cover stays.
- `cover: 'all'` covers every hair voxel (a full head wrap). `cover: 'none'` covers nothing.
- `coversEars: true` hides the ears and their items. If the hat stops above the ears, ear flaps in the hat's colour are drawn down over them automatically. A `cover: 'all'` hat draws its own ear covering.
- `floats: true`: the hat hovers over the head by design, so the floating-part check skips it. Use it with `cover: 'none'`.
- The cover is cached per hat id: the hat's shape must not depend on other slots.

### Eyes (`eyes.js`)
`{ name, rows, brow, right?, mirror?, closed?, palette?, fx?(F, ctx) }`

- `rows` is 4 strings of 5: rows y 26 → 23, columns outer → inner, for the eye at x −7..−3.
- The other eye mirrors it (x 6..2). With `mirror: false` it uses the same order (x 2..6). `right: { rows, brow }` gives the second eye its own grid.
- Letters:
  - `L` lid: skin shade at z 8 plus a lash at z 7
  - `W` white
  - `P` pupil (gloss)
  - `K` ink
  - `.` skin
- `brow` is 3 strings of 5 (y 29 → 27). `B` puts a brow voxel at z 8 in the skin's brow colour.
- `closed` is the blink, 4 × 5. The default is lid, lid, ink line.
- `palette: { char: colour | [colour, layer, z] }` adds letters. z 7 is flat in the face; z 8 is one proud.
- `fx(F, ctx)` adds voxels to the face grid; `ctx.closed` says whether this is the blink.
- The face grid is drawn open and closed, and the head is carved under it, so the blink works with any eyes.

### Mouth (`mouths.js`)
`{ name, why?, draw?(H, ctx), fine?(P, ctx) }`: at least one of `draw` and `fine`.

- **The mouth zone.** `MOUTH` in `kit.js` (from `world/fit/body.js`). It is the lower face: under the nose row (y 22; the nose is x −1..0 at z 8) down to the chin (y 19, the head's bottom row), and as wide as a mouth can open on this head. The eyes' outer corners are x −7 and 6, so two cheek columns stay clear on each side. The face plane is z 7.

  | Axis | Voxels | Half units (fine voxels) | Quarter units (fine paint on `'+z'`) |
  |---|---|---|---|
  | x | −6..5 | hx −12..11 | qa −24..23 |
  | y | 19..21 | hy 38..43 | qb 76..87 |
  | z | 6..8 | hz 12..17 | (the face it lands on) |

  `MOUTH.has(x, y, z)` and `MOUTH.hasHalf(hx, hy, hz)` test a cell.
- **Change nothing outside the zone.** Every voxel you set, recolour or remove, every face you paint and every fine voxel you place lies inside it. The rest of the face belongs to the skin, the eyes, the nose and the face ink.
- **The mannequin has no mouth.** With the mouth slot on `base`, the zone is clean skin. Your entry is the only thing drawn there.
- **Depth budget: one proud, one deep.**
  - z 8 is one voxel proud of the face plane. Fine voxels may go to hz 17, so relief comes in half and whole voxels.
  - z 6 is one voxel deep. You may remove face-plane voxels (z 7) and place or show z 6 behind them.
  - Nothing at z 9 or beyond. Nothing removed at z 6 or deeper.
- **`draw(H, ctx)`** draws on the head grid with the grid methods (§ The registry API). The head is there when you draw: the skin's face plane and any face ink. Read it with `H.get` and `H.frontZ`, or `ctx.sk.c(x, y, z)`. `ctx.sk` also gives the skin's face colours: `mouth`, `lip`, `ink`, `brow`, `lash`.
- **`fine(P, ctx)`** runs right after your draw, on the head grid (§ Fine detail). Fine paint lands on the outermost voxel, which is your own voxels or the skin of the face plane, so a mouth can be paint alone.
  - Each voxel face carries 4 × 4 texels. The zone's front is 12 × 3 faces: 48 × 12 texels.
  - Fine voxels give relief smaller than a voxel. They must touch a voxel, as everywhere.
  - Budget per mouth: at most 64 painted faces and 32 fine voxels (§ Budgets).
- **Layering.** The head draws in this order: skin, face ink, mouth, hair, hat, eyewear, ears. A later layer wins a shared voxel or texel.
  - **Skins.** The mouth draws over the skin, its pattern and its `decorate` recolours. Take colours from `ctx.sk` so the mouth reads on the palest and the darkest skin, and on the patterned ones.
  - **Face ink** draws before the mouth. Inside the zone, your voxels and your paint cover it.
  - **Eyes.** An eye design may run a piece (a tear, a scar) down into the zone. Your voxels cover it there. On a cell you only paint, the eye's piece stays on top.
  - **Hats that cover the face** (masks, rags) and **eyewear** draw after the mouth and cover it. The mouth shows only through their openings. Hair over the face covers it the same way. Design the mouth for the bare face, never around one hat.
- **No blink.** The mouth is part of the head, not the face grid, so it does not change when the eyes shut.
- **Ids** share the mouth slot with `mouth.js`, whose mouths still load in an older form. A duplicate id is a registry problem: rename yours.
- **Checks.** `node style/check.mjs mouths` (§ Checks). It tests `mouths.js` only:
  - **The mouth zone check.** The look is composed again with no mouth and the two heads compared. Anything changed outside the zone, or past the depth budget, fails with severity 100.
  - The fine budgets, fine-voxel depth in half units, and floating parts.
  - **The combos:** each mouth with every face ink, eye, skin, eyewear and hat.
  - The see-through gate and the studio sweep.
- **Look at it** in the lab: `?slot=mouths&cam=face`, by day and with `&night=1`, and at `&fine=avg` (the mid and far tiers).

### Face ink (`mouth.js`)
`{ slot: 'mark', name, draw(H, ctx) }`. Every `mouth.js` entry says its slot: `slot: 'mark'` for face ink; its earlier mouths say `slot: 'mouth'`.

- It recolours the head's skin on its surface (the face plane is z 7) with zero relief.
- `ctx.sk.ink` is the skin's ink colour.
- Keep off the eye grids, the nose, and the `mouth.js` rows grid (x −3..2, y 19..21): the face grid draws over them and the blink carves there.
- Anywhere else in the mouth zone, a `mouths.js` mouth is drawn over the ink.

### Eyewear (`eyewear.js`)
`{ name, draw(H, ctx) }`

- The front sits at z 8 (one proud of the face) around y 22–28.
- The arms run back along the head's sides at x −9 and 8. End them before the ears (z ≥ 2): the ear is x −10..−9 / 8..9, z −1..1.
- Eyewear is drawn after hats. Under a covering hat's ear flap the arms hide automatically.

### Ears (`ears.js`)
`{ name, draw(H, ctx), overHat?, socket?, lobe?: 'hang' | 'stud' }`

- An ear item sits on the ear (x −10..−9 / 8..9, y 23..27, z −1..1). Its outer face is x −11 / 10, and it stands at most 1 proud.
- It must touch the ear: nothing floats.
- It hides when the ears are covered (a `coversEars` hat or hair) or when the skin is `noEars`.
- `overHat: true` sits over hats and hair by design. `socket: true` fits itself onto a covering hat's side.
- **The lobe anchor.** `import { LOBE } from './kit.js'` (construction: `world/fit/body.js`). It is the exact earlobe voxel on each side: `LOBE.R` = [−10, 23, 0] on the right ear, `LOBE.L` = [9, 23, 0] on the left (the mirror x → −1 − x). `LOBE.out` gives each lobe's outer-face normal along x (R −1, L +1) and `LOBE.cols` the ear's own x columns (R −10..−9, L 8..9). Everything that hangs from the lobe uses it. slime: the door knockers should "go through the ear, not off the side".
- **`lobe: 'hang'`** (hoops, huggies, dangles, tags, locks, pearls). The piece goes *through* the ear:
  - its top passes into the lobe voxel: its highest voxel touches it (usually the cell right under it, [−10, 22, 0]), and the wire entering it is painted on the lobe's outer face (the piercing)
  - it hangs straight down from the lobe, inside the ear's own columns (x −10..−9 / 8..9). Nothing below the lobe row sits outside them (beside the jaw, off the side of the head), and nothing rises above the lobe row.
  - its ring faces sideways like the ear, so from the side you see the ring's face
  - long pieces stop at y 19: below that, a big shoulder cap (x −10, y 17..18) is in the way
- **`lobe: 'stud'`** (studs, plugs, rocks, a chain's lobe end). The piece sits flush on the lobe voxel's outer face: a voxel at [−11, 23, 0], fine voxels on that face, or the piece's own paint on it.
- Pieces that don't hang from the lobe have no `lobe` and keep their own placement: tucks behind the ear, headsets and coils, and over-the-hat pieces.
- Under a covering hat, each trait keeps its own behaviour (hide, socket or over). A socket piece hangs from the lobe wherever the ear shows, and tucks under the hat's edge where it doesn't.
- **The lobe check.** The audit fails a `lobe` piece that misses the lobe on any side where the ear shows (not wrapped, not under a covering hat or hair). A `hang` piece fails if its top doesn't touch the lobe voxel, or if it hangs beside the lobe. A `stud` fails if it isn't on the lobe's outer face. The check runs in `node style/check.mjs ears` (the audit) and in `--all` (the compat audit, where it counts in every combination and never nets out against the trait worn alone).

### Tops (`tops.js`)
`{ name, flank?: 0 | 1 | 2, neckline?, puffy?, draw(B, ctx) }`

- **The shell** goes round the torso (x −5..4, y 9..18). One voxel proud is x −6..5, z −3..3. `flank` says how many columns past the torso's sides the shell reaches (default 1). The shell, flanks included, rides the chest.
- **Sleeves.** Whatever lies outside the shell rides the arm.
  - `ctx.sleeve(side, 'armL' | 'armR', { x0, x1, y0, y1, z0, z1 }, paint, l)` lays one sleeve. The box is given for the left arm and mirrored for the right. `paint(lx, ly, z)` counts lx outwards and ly from the wrist.
  - `ctx.shoulderCap(side, paint, o)` covers y 17..18 over the sleeve, overlapping the chest by one column. Use it: with the joint slab, it covers the shoulder cut when the arm swings.
- **The sleeve rule: a sleeve hugs the arm.** slime (2026-10-01): "the arms are so massive/bulky … the construction of the sleeves is poor". A sleeve as deep as the body reads, from the side, as a block jutting off the shoulder every time the arm swings.
  - **The arm it wraps.** The bare arm is x −8..−6, y 10..16, z −1..0: 3 wide and only 2 deep. The hand is x −8..−6, y 6..9, z −2..1. The shell's flank takes the arm's inner column (x −6, or x −7..−6 under `flank: 2`) into the shirt's side, so the sleeve wraps the rest of the arm. Its inner column is the first one outside the shell on that row.
  - **At most ONE voxel proud of the arm on each side, centred on the arm:** z −2..1, one proud front and back. Its outer face is flush with the arm's at x −8, or at most one proud at x −9. It is never deeper than the torso shell.
  - **Short sleeves** cover the upper arm, from y 12 or 13 to y 16, and end in a hem row: the bottom row in the cloth one shade down.
  - **Long sleeves** run to the wrist (y 10) and end in a cuff row there. The hand shows below the cuff.
  - **Padded outerwear** (`puffy: true`: the goose, the mink) may go TWO proud: z −3..2, with the outer face out to x −10, still centred on the arm.
  - **One clean piece per arm.** Each sleeve is one continuous box from its hem or cuff up to y 16, and the shoulder cap is the same box carried up to y 18, with the same z and the same outer face, overlapping the shell's side by one column. The hem, the sleeve and the cap line up, with no stray or offset blocks. Quilting, ribs and rounded edges are cells left out of that box, never blocks added to it.
  - `tops.js` `sleeves(ctx, paint, { y0, out, pad, fl })` lays both sleeves and both caps to this rule. `y0` is the hem or cuff row, `out` how far the outer face stands past the arm's (0 or 1; up to 2 when padded), `pad` how far proud front and back (1, or 2 when padded) and `fl` the shell's flank (a number, or `y => n` for a flank that changes with the row).
- **Hem** at y 9 at the lowest. Below y 9 is the legs. The hand's box at y 9 belongs to the hand.
- `neckline`: `crew` (default), `vee`, `hood`, `collar`, `high` or `bare`. `hood`, `high` and `collar` bury the neck.
- `puffy: true` allows padded structure 2 proud.
- **Prints, logos and letters recolour the shell (0 proud).** Collars and hood edges may stand 1 proud.

### Bottoms (`bottoms.js`)
`{ name, form, color, waist?, sock?, sockColor?, paint?(q) }`

- **Geometry is the approved leg form.** You paint it; you can't add or remove voxels, because the clearances are structural.
- Forms:
  - `roomy`: the approved fuller profile, as on the base kit
  - `longshorts`: the same, cut at the knee
  - `slim`, `straight`, `baggy`
  - `shorts`: hem at y 7
- `color` is the cloth. `waist` is the waistband row (y 10); it defaults to `color`.
- `paint(q)` returns a colour or `[colour, material]` for each covered or sock cell. Return `undefined` to keep `color`. `q` is:
  - `x`, `y`, `z`
  - `u`: the column, 0 at the inner leg, counting outwards
  - `side`: −1 left, 1 right
  - `width`, `z0`, `z1`: the row's width and back/front z
  - `covered`, `socks`, `c`, `l`
- Shorts: the leg below the hem is the skin. `sock` is `'none'` (default), `'ankle'` or `'crew'`, coloured `sockColor` (or painted where `q.socks` is true). Full pants hide socks.
- The thigh and shin are one surface through the knee: paint flows through it. Pants end at the 3×3 ankle seat on top of the shoe (y 4).
- **The seat (construction, `world/fit/leg-forms.js` `drawSeat`).** Pants are one garment at the hips: the two-voxel gap between the legs closes for the top two rows (y 8..9), so the seat and crotch run unbroken from the waistband to the top of the thigh, and the legs split below it (y 4..7). Each leg grows in by the gap's column on its side, `u` −1 (x −1 on the x<0 leg, x 0 on the x>0 leg), in that row's back/front z. Your `paint(q)` colours it with `q.u === -1`, so a pattern carries on across the seat; a `paint` that only tests `u >= 0` columns leaves it your `color`. Each half rides its own thigh; in the walk the two halves meet on the midline and slide past each other (`style/city/anim/walk2.js`).
- **The waist seam (construction, `world/fit/lower.js`).** The hip joint's clearance cuts a rim at y 10 over a groove at y 9. A top whose hem comes down to y 9 fills the groove. Whatever the top (none, or a short one ending at y 10), the construction paints everything the groove can show in your `color`, one shade darker (`SEAM_SHADE` 0.8): the body's core kept at y 9..10 and the cloth left in the groove at y 9, the seat's top row included. The look then reads as a clean pants top edge with a seam under the waistband, never a strip of skin. Only colours change: the clearance stays, so nothing clips when the thigh swings. You don't paint this row yourself.

### Shoes (`shoes.js`)
`{ name, last, paint(q) }` or `{ name, draw(F, ctx) }`, plus an optional `ankle: 'shoe'`.

- **Foot-local coordinates**, mirrored onto both feet: `u` runs outwards from the inner edge (u 0 is x −2 on the left foot, x 1 on the right), `y` 0..3, `z` heel → toe.
- **The envelope:**
  - u 0..4: u 5 meets the hands-in-pockets hand
  - y 0..3: nothing above y 3, because the pant leg owns y 4 up
  - ground cells (y 0) inside z −3..5
  - z −4 (a heel tab) and z 6 (a raised toe point) only above y 0
  - one connected piece per foot
  - the two-voxel gap between the feet stays empty
- **The socket** is the 3×3 ankle seat at y 3 (u 0..2, z −1..1). It is always filled. By default it is *dressed* in the pant's colour under full pants, and in the skin or sock under shorts, so no band shows at the ankle. `ankle: 'shoe'` keeps your own colour there.
- **Lasts** are approved, motion-checked volumes. `last: 'tongue'` (the base kit's), `'terrace'`, `'lowline'` or `'fullcourt'`, with `paint(q)` per cell. `q` is:
  - `u`, `y`, `z`, `side`
  - `region`: `outsole`, `midsole`, `upper` or `tongue` on the tongue last; `sole` or `upper` on the others
  - `outer`, `front`, `back`, `top`: is the neighbour in that direction empty?
- **Free-form:** `draw(F, ctx)` on a foot pad. The pad has:
  - `set(u, y, z, colour, l)`, `del`, `has`, `get`, `paint`, `each`
  - `box(u0, u1, y0, y1, z0, z1, colour, l)`: inclusive
  - `rows(y, z0, spans, colour, l)`: one `[u0, u1]` span per z
  A free-form shoe is a new shape: the lower-body motion check must pass.
- Shoes live in their own grid. Pants can never cut a shoe, and every shoe cell rides its foot.

### Accessories (`accessories.js`)
`{ name, draw(B, ctx) }`

- Accessories are drawn on the body grid after the top.
- `ctx.as(part)` picks the segment the next voxels ride:
  - `'armL'` or `'armR'`: the whole arm, shoulder to hand
  - `'torso'`
  - `'legL'` or `'legR'`: thigh, shin or foot by height
  `ctx.onSeg(region, fn)` pins one piece to a contract region such as `'thighR'`, `'pelvis'` or `'chest'`. Without `as`, voxels in the arm columns ride the arm and the rest ride the torso.
- At most 2 proud of what it lies on. Use `ctx.frontZ(x, y)` or `ctx.chestFront(x, y)` to sit on the current surface (the top's, if one is worn), never a hard-coded z.
- **Straps, bands and bags drape.** A padded or quilted top (`puffy`) has ridges and grooves row by row. A strap laid cell by cell on `chestFront` dips into every groove, where the ridges either side hide it in steps (a sash's letters break up). Read the surface once before you draw, take the highest of the rows either side (at most 2 above the cell's own), and keep one depth per column across a band. On a flat top that is the surface itself. `accessories.js` `drape()` does this for the sling, the pack, the sash and the chain.
- The hands are drawn after you: the mittens own their box (x −8..−6 / 5..7, y 6..9, z −2..2). Keep clear of the space the hands sweep past the hips while walking.

### Held (`held.js`)
`{ name, pose, draw(G, ctx), fine?(P, ctx) }`: a thing in the hand. It passes THROUGH the closed fist and rides the gripping arm. The mannequin holds nothing; with the held slot on `none` both hands are mittens.

- **pose** picks the arm pose, named by geometry (`world/fit/held.js` `HOLD`, compiled into the walk shader by `style/city/anim/grip.js`):

  | pose | hands | the arm | walk swing kept | grip axis |
  |---|---|---|---|---|
  | `down` | the +x hand | down at the side, rolled 0.24 rad out from the leg, a touch forward | 55 %, a beat late | z (front to back) |
  | `forward` | the +x hand | pitched 0.62 rad forward, rolled 0.28 out | 30 % | z |
  | `both` | both hands | both pitched 1.25 rad forward as one, no roll, yaw or twist | none | x (side to side) |
  | `raised` | the +x hand | pitched 1.0 rad forward, turned 0.45 out, in front of the chest | 8 % | z |

  The free arm walks and idles as usual. Idles the busy hand can't do are swapped (`grip.js` `gripIdle`): one low hand busy, hand to face becomes look around; `raised`, the stretch becomes nod; both hands busy, hand to face, pockets, behind the back, stretch and hips become weight shift, look around or nod.
- **The grip anchor: the fist's channel.** A gripping hand is drawn as a closed fist: its box (x 5..7, y 6..9, z −2..1 for the +x hand; the −x hand is the mirror x → −1 − x) with one straight run of cells left open through it, along the pose's grip axis.

  | axis | channel cells (+x hand) | the fist round it |
  |---|---|---|
  | z | x 6, y 7, z −2..1 | fingers below (y 6) and outside (x 7, a shade down), palm above (y 8..9), the thumb over the front end (x 5..6, y 8, z 2) |
  | x | x 5..7, y 7, z −1 | fingers in front (z 0..1) and below (y 6, a shade down), palm behind and above, the thumb at the inner front (x 5, y 7..8, z 2) |

  `ctx.grip` gives `pose`, `axis`, `hands`, `cells` (every channel cell of every gripping hand), `channel` (the +x hand's), `envelope` and `mirror(x)`. The same tables are exported from `kit.js` (`HOLD`, `POSES`, `ENVELOPE`, `HELD_BUDGET`, `gripCells`, `channelOf`, `mirror`).
- **Pass through the hand.** Your geometry fills EVERY channel cell (a voxel, or a fine voxel inside the cell), so it goes into the fist on one face and comes out of the opposite face, the fingers wrapped round it. It never rests on the end of the hand. Everything you draw is one piece joined to the channel through itself. The fist owns the rest of the hand's box: nothing of yours goes there (the hands are drawn after you and would overwrite it).
- **Draw** on `G`, the held grid, in the rest frame (arms hanging, the same coordinates as § The body). It is a grid of its own in the gripping arm's frame, so it never takes a body cell: in `both` it crosses the body at rest and is only ever seen posed in front of it. Grid methods as in § The registry API; `ctx.sk` is the worn skin.
- **The hang rule.** A thing gripped by a handle hangs BELOW the fist: the handle fills the channel, its body hangs under the fist. It rides the arm segment rigidly (no pendulum): it swings with the arm, a beat late in `down`. It never comes inward of the hand's inner face (x 5), which keeps it clear of the leg through the whole stride.
- **Budgets** (`world/fit/held.js` `ENVELOPE`, `BUDGET`; inclusive, rest voxels, the +x hand). Every voxel and fine voxel lies inside the pose's envelope:

  | pose | x | y | z |
  |---|---|---|---|
  | `down` | 5..8 | 2..8 (hangs 4 below the fist) | −4..3 |
  | `forward` | 5..8 | 5..8 | −3..4 |
  | `both` | −8..7 (the span between the fists' outer faces) | 4..8 | −1..2 |
  | `raised` | 5..8 | 6..8 | −2..4 (up past the fist when raised) |

  - at most 120 voxels; fine detail as everywhere (64 painted faces, 32 fine voxels)
  - clearance: the envelope keeps one column (x 4) between the hand's inner face and the leg's outer column (x 3) at rest; in motion it is measured
  - each envelope, filled solid (`base-kit.js` `FIXTURES.held`, look value `{ id: 'base:<pose>' }`), passes the held motion check: no crossing into the torso, pelvis, legs, shoes, head or the free arm in the walk, the turns and every idle, at least 1.6 voxels above the ground in the walker's own frame (a turn leans the whole walker), and in `both` the two arms carry it as one piece (0.000 mm apart)
- **Living with the other slots.**
  - **Tops:** the envelope stops at y 8, under a hem's lowest row (y 9) and the wrist (y 10), where a long sleeve's cuff row ends and the hand shows below it. Sleeves never reach into the hand's box or the channel. A padded sleeve (out to x −10 / 9) stays above y 10. Measured: every envelope clears all 53 fresh and imported tops, all 12 accessories and all 68 bottoms in motion, except a few padded and long imported coats against `down` and `forward`, and the padded tops against the fist in `both` (the fist's contact with a garment is reported, not failed).
  - **Accessories:** wrist pieces sit on the arm at y 10 and up; the hand's box (y 6..9) is the hands', so nothing of an accessory sits in the fist and nothing of yours sits on the wrist.
  - **Bottoms:** the pockets are the free hand's: the gripping arm never takes the pockets idle (its hold overrides the idle's arm). The leg's outer column is x 3 (the shoe's u 4 is x 5, below y 4): `down` hangs outside x 5 and stops at y 2, `forward` stops at y 5, where the toe tap can't reach.
  - The hold applies to the static rig too, so thumbnails and the photo booth show the arm in its pose.
- **Checks.** `node style/check.mjs held` (§ Checks):
  - **the grip check** (the audit): FAILS a held trait with an empty channel cell (not gripped), a piece not joined to the channel (floating), anything inside the fist outside the channel, anything outside its envelope, or more than 120 voxels; plus the fine budgets
  - **the combos:** each held trait with every registered top, accessory and bottom, in the audit and in motion
  - **the see-through gate** and the studio sweep
  - **the held motion check** (`style/city/anim/held-motion-check.mjs --combos`, the real walk v2 shader): every pose's envelope and every held trait, alone and with every top, accessory and bottom, through the walk at every stride level, turns both ways, standing and all nine idles. The held thing and the gripping fist must not cross any surface of the torso, pelvis, legs, shoes, head or free arm, nor sit inside a rigid part; it stays above the ground; a two-hand piece never parts.
- **Look at it** in the lab: `?slot=held` (one look per held trait), `&held=<id>` on every look, `&scene=idles`, `&cam=side|tq|front`. In the studio: `&held=<id>` wears it on the first fit.

## Fine detail: below the voxel

Two tools for detail smaller than a voxel. Both are used from your entry's optional `fine(P, ctx)` pass, in any category file. The pass runs right after your slot's draw, in the same layer order (eyes and the `mouth.js` mouths: on the face grid, open and closed, and `ctx.closed` says which; a `mouths.js` mouth: on the head). It works on the surface as it stands at that moment. Anything later in the order covers it, exactly as it covers your voxels.

| You want | Use |
|---|---|
| Flat detail on a surface: lines, marks, letters, graphics, prints finer than a voxel | **fine paint** |
| A raised piece too small for a whole voxel | **fine voxels**, sparingly |
| Anything a whole voxel can draw | voxels, as before |

If it's flat, paint it. A fine voxel is real geometry on every walker in the city.

### Fine paint: 4 × 4 texels on a voxel face

- Every visible voxel face can carry 4 × 4 texels. Painting adds no geometry. The paint belongs to that voxel: it rides the voxel's segment through the walk, the turns, the idles and the blink, and it is lit like the voxel, by day and by night.
- **Quarter coordinates.** A texel is addressed by quarter-voxel coordinates on the face's two in-plane axes: `qa = 4 × a + i` and `qb = 4 × b + j`, with `i` and `j` from 0 to 3.

  | Face | a | b |
  |---|---|---|
  | `'+z'` front, `'-z'` back | x | y |
  | `'+x'` the character's left side, `'-x'` its right side | z | y |
  | `'+y'` top, `'-y'` underside | x | z |

  For example, texel (qa, qb) on `'+z'` covers x qa/4 to (qa+1)/4 and y qb/4 to (qb+1)/4.
- `P.paint(face, qa, qb, colour)` paints one texel on the **outermost** voxel along that face's normal in that column. The search covers the grids your slot draws on:

  | Slot | Grids searched |
  |---|---|
  | head slots | the head |
  | body slots | the body |
  | shoes | the shoe grid |
  | skin | the head and the body |
  | eyes, and the `mouth.js` mouths | the face grid |
  | mouths (`mouths.js`) | the head |
| held | the held grid |

  So the paint lands on whatever is visible there now: your own voxels, or the surface under you.
- `P.rect(face, qa0, qb0, qa1, qb1, colour)` paints a half-open rectangle. The colour may be `(qa, qb) => colour`.
- `P.bmp(face, rows, palette, qa, qb)` paints a bitmap at 4× resolution, read **as seen from outside that face**, so it never comes out mirrored. (qa, qb) is the top-left texel as seen from outside. Each character is one texel; a character not in the palette is skipped.
- `P.at(x, y, z, face, i, j, colour)` paints texel (i, j) of one given voxel's face, for when the outermost rule isn't what you want. The voxel must exist.
- **What each texel carries.** It holds one colour. The material is the voxel's. An unpainted texel shows the voxel's own colour.
- **Order matters.** Paint after your voxels are final. A voxel that is written again, by you or by a later layer, loses its paint, and paint on a face that ends up covered shows nothing.
- **Shoes.** Fine paint and fine voxels use body coordinates on both feet. Draw each foot yourself; the right foot mirrors the left as x → −1 − x.
- You can't paint the faces of a fine voxel.
- **From a distance.** Once a texel is smaller than a pixel, it fades to the face's average colour. The city's mid and far tiers draw each painted face in its average colour. Design so the average still reads.

### Fine voxels: half size, on a 2× grid

- `P.half(hx, hy, hz, colour, l)` places one fine voxel. `P.halfBox(hx0, hy0, hz0, hx1, hy1, hz1, colour, l)` fills a half-open box, and its colour may be `(hx, hy, hz) => colour`. The materials (`l`) are the voxel materials.
- **Half coordinates are 2 × voxel coordinates.** Half (hx, hy, hz) fills x from hx/2 to hx/2 + ½, and the same on y and z. Voxel (x, y, z) holds halves 2x to 2x + 1.
- **Touching a face.** To sit on a voxel face at x = X (the plane between cells X − 1 and X), use hx = 2X on the + side or hx = 2X − 1 on the − side. The same rule holds on y and z.
- **What it rides.** A fine voxel rides the segment of the voxel it touches. A connected group of fine voxels rides the part that most of its contacts touch.
- **It must touch.** A fine voxel must touch a voxel, or a fine voxel that does. One touching nothing fails the checks.
- **Inside a voxel.** A fine voxel inside a voxel is not drawn, and the checks report it. A voxel written later over a cell deletes the fine voxels inside it: the later layer wins.
- **The fit rules apply in half units:**
  - **Depth budgets.** These are the table above, in voxels; one fine voxel is ½. Where the budget is 0 (prints, logos and letters on garments, face ink), no fine voxel may stand proud.
  - **Overlaps.** A half cell holds one fine voxel, and no fine voxel may sit inside another grid's voxel.
  - **Floating and connection.** As above. Fine hair voxels also obey the hair rule: they must be joined through fine hair to hair or to the scalp, or they are dropped.
  - **Hat cover and clipping.** A hat's fine voxels join its cover at their own half cells. A fine hair voxel inside the cover is deleted.

### Budgets (per trait; the audit gates on them)

| What | Budget |
|---|---|
| fine paint | at most 64 painted faces (each 4 × 4 texels; every distinct face is stored once in one atlas shared by every walker) |
| fine voxels | at most 32 |
| depth | the depth budgets above, in half units |

### Checks and looking at it

- **The audit and the cross-category combo check** include fine detail. They gate on:
  - the budgets
  - fine voxels floating, overlapping or over their depth budget
  - fine hair left inside a hat's cover
- **Overwrites.** One trait's paint written over another's is scored like any other overwrite.
- **On the trait alone,** the audit reports, without failing:
  - paint that lands on no voxel
  - paint on a face that ends up covered
  - a fine voxel drawn inside a voxel
- **The see-through gate and the studio sweep** bake fine detail like everything else, and the studio's thumbnails draw every texel.
- **In the lab,** `&fine=avg` shows what the mid and far tiers see, and `&night=1` shows the city's night light.

## All traits work together

slime: "it's important that hats dont break hair, etc… all traits need to work together". **Every trait must look right with every trait in every other file**, not only on the bare mannequin. These mechanisms guarantee it. Design inside them, never around them.

1. **One layer order.** Head pieces draw in the order skin, face ink, mouth (`mouths.js`), hair, hat, eyewear, ears. Body pieces draw in the order base, bottom, top, accessory, held (its own grid, in the gripping arm's frame), hands. Shoes have their own grid. A cell held by both the head and the body grids goes to the later layer (`world/fit/contract.js` LAYERS). Every head voxel is tagged with its slot, so clipping is by slot, never by colour.
2. **Hats and hair.** A hat's cover deletes every hair voxel inside it, then hair that lost contact with the scalp is dropped. No hair pokes through a crown or a brim, and nothing floats. Hair must therefore grow from the scalp, and a hat must `clip` its own volume and draw a closed crown.
3. **Ears.** `coversEars` (hats and hair) hides the ears and every ear item. Ear flaps carry a covering hat's fabric over the ear. Ear items draw only on a visible ear, unless they are registered `overHat` or `socket`.
4. **Eyewear and hats.** Eyewear draws after the hat and its arms tuck under ear flaps. Keep the front at z 8 and the arms on the head's sides, so a brim or a crown never cuts them.
5. **Tops, bottoms and accessories.**
   - Bottoms own y 4..10 (waistband y 10). A top's hem may overlap the waistband, where the top wins.
   - Tops never go below y 9.
   - Accessories draw after tops and lie on whatever surface is there (`frontZ`, `chestFront`), draped over a padded top's ridges (§ Accessories).
   - The hands draw last.
   - The segment routing comes from the body's geometry, so a sleeve, a flank or a strap rides the right part whatever else is worn.
6. **Shoes and pants.** Separate grids and a dressed ankle seat: any bottom works with any shoe.
7. **The face.** Eyes (and the `mouth.js` mouths) live in the face grid, carved into the head for the blink. A `mouths.js` mouth is drawn on the head, inside the mouth zone only (§ Mouth). Face ink and skin patterns sit under both. Hair, hats and eyewear draw over them.

**The cross-category combo check** tests your category against everything currently registered in the other files:

```sh
node style/city/studio/audit/run.mjs --slot <your category> --combos --gate
```

It wears each of your traits with every trait in every slot it can collide with (hats × hair, ears, eyewear and tops; tops × bottoms and accessories; bottoms × shoes; and so on). It then builds 40 random full looks from the whole registry, each wearing one of yours. It reports:

- floating parts
- hair through a hat
- ear items with no ear under them, and `lobe` ear items that miss the lobe anchor (§ Ears)
- items sharing or overwriting voxels
- depth over budget
- joint seams that open in the walk and the idles

Run it again whenever another file changes. Your trait has to keep working as the others arrive.

**The compatibility sweep** (`node style/check.mjs --all`) is the exhaustive version, for the whole registry at once. It wears every combination, with no sampling, of these families:

- pairs: hat × hair, hat × ears, hat × eyewear, hair × ears, hair × eyewear, eyewear × eyes, eyewear × mouth and face ink, eyes × skin, mouth and face ink × skin, top × bottom, top × accessory, bottom × shoes, bottom × accessory, shoes × accessory
- triples: hat × hair × ears, hat × hair × eyewear, top × bottom × accessory

It is the full check: it first runs every category's own checks (the studio sweep over every trait, the audit + combos of every category, the see-through gate of every category), then three sweep steps:

1. **The compat audit** (`style/city/studio/audit/compat.mjs --gate`). It runs the audit's checks on each combination, with seams in the walk and the idles for the body families, and keeps only what the combination adds over each trait worn alone. It also counts hair crumbs: bits of hair of 3 voxels or fewer that a hat's cover cut off, not counting hair tucked right under the hat's edge. It reports, without failing, the face colours that nearly vanish on a skin, the eyewear a hat hides, and odd bits. It writes `audit/compat.json`.
2. **The see-through gate** over every combination of each body family: top × bottom, top × accessory, bottom × accessory and shoes × accessory. It uses the lab's `&combo=` looks. These are the pairings that move together: a hem, a strap or a band rides another part in the walk and the idles. A head pairing can't open a body. The hat's cover deletes only hair, a shell over the closed scalp. Eyewear and ear flaps only skip cells, and ear items only add them. Each head trait's own see-through gate covers its holes.
3. **The lower-body motion check** over every bottom × every shoe.

Without `--pool npc`, it also runs the authored clips' gates on every clip (`style/city/anim/clips/CLIPS.md` § The lab and the checks): the end check, the elbow identity, the hand gate over every bottom × every shoe, and the see-through gate over every look. `node style/check.mjs clips [--quick]` runs only those.

`--family top×acc,…` runs only steps 1 and 2 for those families (and 3 if `bottom×shoes` is named). The steps run in parallel chunks, `--jobs N` at a time (default: the cores less 4), each chunk in its own process with its own 30-minute limit: the motion check in `--shard i/n` slices of its fixtures, the compat audit one job per family with the triples in `--shard i/n` slices, the see-through gate 100 looks a chunk. The chunks of a step together check exactly what the unsplit step checks, and the step passes only if every chunk passes. The studio sweep runs first, alone, because it gates on the trait-switch time. Each chunk's log is kept in a temp folder, and the path is printed. With about 450 traits the full check takes about 55 minutes (the see-through gate, GPU-bound, sets the pace) on the studio Mac.

## Imported traits (from the old Trait Studio)

slime asked for the old page's categories to be brought in and combined with this one (everything but held, shorts, socks, neck, accessories, face ink and every ear trait except the original headphones; nothing he killed). The full list, per slot, with every old id → new id and what was left out and why: `reference/import/MANIFEST.md`.

**How it fits together.**

| Piece | What it is |
|---|---|
| `world/legacy/` | The old construction the imported traits need, copied from the old repo (`deadnet-style-wardrobe` @ `4fc5c22`) and isolated: `head.js` is the old `chars.js` head tables (verbatim line ranges, listed in its header) with the old install passes run in the old order, so each table holds the draw the old page rendered. Nothing fresh imports it. |
| `world/fresh/imported/kit.js` | The adapters: one old trait → one registry entry. Each runs the old draw on the fresh grids, in the old page's base colours (colourway 0, or the draw's defaults). |
| `world/fresh/imported/tops-kit.js` | The tops adapter (re-exported by `kit.js` as `top`), over `world/legacy/tops.js` (the old top tables and the old refit-tops, refit-outer and Opus tops passes, verbatim, listed in its header): `top(id, fix?)` runs the old top's draw on the fresh body grid, with `flank` and `neckline` from the old `TOPFIT`. Its two sleeve fixes (`drop`: a sleeve one layer slimmer, the shell's side channel re-cut against it; `clip`: arm voxels past a column left out) bring the five old sleeves that stood three proud inside the sleeve rule (manifest § Tops). |
| `world/fresh/imported/lower-kit.js` | The lower-body adapters (the only import of `imported/bottoms.js` and `shoes.js`), over `world/legacy/lower.js` (the old wardrobe modules, verbatim, listed in its header): `bottom(id)` is the old design's cloth, waistband and paint on the leg form it named (the same forms; the fresh seat and waist seam come with them); `shoe(id, fix?)` lays the old foot's exact cells as a free-form draw, `ankle: 'shoe'` unless the old page dressed it (only the new-drop shoes). |
| `world/fresh/imported/<slot>.js` | One file per slot, loaded by `index.js` after the fresh files: `skin`, `hair`, `hats`, `eyes`, `eyewear`, `mouth`, `ears` (done), `tops` (done: 36), `bottoms` (done: 49 pants), `shoes` (done: 45). |

**An imported entry** is a normal registry entry plus two fields (the registry rejects an imported entry without them, and a fresh entry with them):

```js
// world/fresh/imported/hair.js
import * as K from './kit.js';   // the only import an imported file has
export default {
  old_dreads: { name: 'two-tone dreads', origin: 'original', from: 'hair/dreads', ...K.hair('dreads') },
};
```

- **id** `old_<old id>`, in the same slot as on the old page: nothing collides with a fresh id. The curation key is `<slot>/old_<old id>`.
- **name** the old display name, unchanged. `why` the old one, when it had one.
- **origin** the old page's collection: one of `index.js` `ORIGINS` (`original`, `drop02`, `jewelry`, `v2`, `shoes`, `newdrop`, `earlier`, `opus`, `opus2`, `classic`). The studio's ORIGIN filter shows `fresh` and each imported origin present (labels: `ORIGIN_LABEL`; astra's wardrobe collections are `newdrop` and `earlier`).
- **from** the old `slot/id`: the key of slime's old decision in `reference/import/old-curation.json`.
- Everything else (draw, rows, flags such as `coversEars`, `cover`, `overHat`) comes from the adapter and is checked like any fresh entry.

**Decisions.** An imported trait slime kept on the old page starts as keep in `world/fresh-curation.json` (its old `at` and note kept); everything else starts undecided (with its old note, if it had one). A whole-design kill is never imported. Existing fresh decisions are never touched: only keys that aren't in the file are added.

**The import rules.**
- One colour scheme: the old page's base colours. Never a colourway parameter.
- Fix a clash with the smallest change that keeps the old look, in the slot's imported file (a per-trait fix argument to the adapter, commented `FIX` with why) or, when every trait of the slot needs it, in the adapter (commented). Never redesign or rename.
- A trait that truly can't work in the fresh construction is left out and listed in the manifest with the reason.
- Fresh traits, the fresh construction (`world/chars.js`, `world/fit/`, `world/base-kit.js`) and `world/fresh/<category>.js` are never edited for an import.
- The head import's bridges (details in `kit.js`'s comments and the manifest): an old cut never replaces the scalp's hidden cells (a hat's cover would leave the head hollow) and leaves the ear the ear (hair over it goes one voxel out); an imported hat clears the hair crumbs its cover would leave; imported eyewear lays a head inlay only where it shows; imported eyewear and ear items clear the hair debris they leave, and the headphones' cups yield their edge rows; the old face (eyes, rows mouths) is run on its own grid with only that trait and copied onto the fresh face grid; the old trucker's letters get the old grid's `text()`.

**How the tops and lower-body import agents add their slots.**
1. List the old page's slot: `node reference/import/old-catalog.mjs top` (or `bottom`, `shoes`): name, origin, status, note, colourways, and for bottoms `cat` (`pants` / `shorts`: shorts are excluded) and `form`.
2. Copy the legacy construction those traits need into `world/legacy/` (e.g. `world/legacy/tops.js` with the old `chars.js` `TOPS` and the old install passes `refit-tops`, `refit-outer`, `opus-tops` and the old `fit/body.js` sleeve and shoulder cap they call; `world/legacy/lower.js` with the old leg forms, `lower-traits`, the shoe collections and the wardrobe manifest). Copy verbatim, note the source lines in the header, and fix only import paths. `world/legacy/fit/body.js`, `layers.js` and `contract.js` are already there (old copies; `contract.js`'s `BUDGET` is inlined).
3. Add an adapter to `world/fresh/imported/kit.js` (`top(id)`, `bottom(id)`, `shoe(id)`) that returns the slot's fresh fields (§ Per slot): tops `{ draw(B, ctx), flank?, neckline?, puffy? }` from the old draw and the old `TOPFIT`; bottoms and shoes whatever the fresh form or last needs, or a `draw` over the legacy lower-body code. Base colours: `{ id, cw: 0 }` for a trait with colourways.
4. Fill `world/fresh/imported/tops.js` / `bottoms.js` / `shoes.js`, one entry per old trait that is not killed (and, for bottoms, full-length pants only), ids `old_<old id>`, with `origin` and `from`. Add a new origin to `ORIGINS` / `ORIGIN_LABEL` only if the old page had one not listed.
5. Carry the decisions (keeps and notes, only keys not already in `world/fresh-curation.json`; write the file atomically, slime's studio writes it too), add your slot's rows to `reference/import/MANIFEST.md` (counts in / killed / left out with reasons, the id map, the fixes), and add the new legacy files to `LEGACY` in `style/city/studio/studio.js` (the thumbnail cache key).
6. `node style/check.mjs tops` (or `bottoms`, `shoes`), then `--all`, on your own server (`node style/serve.mjs <port>`, `FRESH_URL=http://127.0.0.1:<port>`); look at a board of your slot on the mannequin and in mixed fresh + imported fits.

## The NPC pool (`npc/`): background civilians

slime: "fake agents in the map on roofs, waiting in drop lines, etc. … we should have some generic characters so it's easy to tell who's an NPC and who's a real agent. The exact same character bodies we have now, same walk, etc., but the only difference is the traits." The NPC pool is those traits. **The point is readability:** at a glance, on the street, a viewer tells a background civilian from a real agent. The agents are hype streetwear (bold colour, chains, grills, rare pieces, fine-detail logos); an NPC is plainly, believably ordinary in this city, and never reads as a weaker agent.

**The mechanism.**

| Piece | What it is |
|---|---|
| `npc/<category>.js` | One file per slot the NPC pool fills: `skin`, `hair`, `hats`, `eyes`, `eyewear`, `mouths`, `tops`, `bottoms`, `shoes`, `held`. There is no NPC file for ears, face ink or accessories: those are where the agents flex. |
| `npc/kit.js` | The only import an NPC file has. It re-exports `../kit.js`, carries copies of the construction helpers the agent files use (`tops.js` shell and sleeves, `hair.js` hair builder, `hats.js` solids, `held.js` grip helpers: copied, because each agent file has one owner), and **the civilian palette** `CIV` with `CHROMA_MAX` and `chroma()`. |
| `index.js` `NPC`, `NPC_REG` | The NPC files load into their own registry, `NPC_REG`. `REG` stays the agent pool only (the city's cast reads `REG` whole, so an NPC trait can never be rolled for an agent). Every entry carries `pool: 'agent' \| 'npc'`. |
| ids | An NPC id starts with `npc_`; an agent id never does (both are registry problems). So `entry(slot, id)` resolves either pool, `compose()` wears either, and the curation key `<slot>/npc_<id>` can't collide with an agent's. |
| `list(slot, pool)` | `list(slot)` is the agent pool, as it always was (every existing check and tool reads it unchanged). `list(slot, 'npc')` is the NPC pool, `list(slot, 'all')` both (`chars.js` registers top fits, ear covers and hold poses from both). |
| curation | NPC traits are kept, killed, noted and ranked like any trait, in the same `world/fresh-curation.json`, under `<slot>/npc_<id>` (the store's key regex already takes them; `style/curation-store.test.mjs` proves it, and that an NPC decision leaves every agent entry byte-for-byte). |
| the studio | A **POOL** filter, `Agents \| NPCs` (`&pool=npc`). The studio shows one pool at a time: the grid, the counts, randomise, the progress line, RANK mode and its rarity panel stay inside it, and switching takes the other pool's traits off both fits. |
| the checks | An NPC category has the `npc-` prefix: `node style/check.mjs npc-tops`. It runs the category's usual steps against the NPC pool **only** (its pairs, its 40 random full looks, the motion fixtures and the held combos are NPC × NPC), plus the **NPC palette check**. `node style/check.mjs --all --pool npc` is the full check of the pool (its compat result goes to `audit/compat-npc.json`). |
| the board | `style/city/studio/npc-board.html` (`reference/boards/npc.jpg`): every NPC trait on the mannequin, 20 random NPCs, 20 random agents and a mixed street row. |

**The readability rules.** Follow them in every NPC file; the registry and the palette check enforce what they can.

1. **A muted civilian palette.** Desaturated greys, navy, khaki, beige, denim, olive, brown, office colours and a few dusty accents (`npc/kit.js` `CIV`). Every voxel an NPC trait draws stays at or under **chroma 0.35** (max − min of its RGB, over 255); the agents sit at 0.6–0.9. Even the hi-vis is sun-faded. *Checked*: `audit/npc-palette.mjs` reads every composed voxel.
2. **Matte, no metal, no glow.** Materials 0 or 1 only: no chains, grills, badges, chrome, gold or lit parts. *Checked* (palette check).
3. **Plain shapes, no fine detail.** No logos, prints, lettering, graphics or half voxels: a tie, a placket, a pocket or an apron is the shell recoloured. *Enforced*: the registry refuses `fine` on an NPC entry.
4. **Common only.** No rare tiers: `tier` is `'common'` or absent. *Enforced* (registry).
5. **No jewellery, no grills, no face ink.** There is no NPC file for ears, face ink or accessories, and no NPC mouth draws teeth.
6. **Simple base faces.** Plain eyes (dots, plain whites and pupil, tired lids; no lashes, colour or ink) and a plain mouth line taken from the skin's own mouth colour.
7. **Ordinary human skin tones only.** One plain colour per skin: no pattern, no `decorate`, no special face colours. *Enforced* (registry) and *checked* (palette check: warm hue, chroma 0.12–0.45).
8. **A small held set** (briefcase, coffee, tote, newspaper, grocery bag) under the grip rules (§ Held).
9. **The same bodies.** Same construction, same walk, same leg forms and lasts as the agents: every rule in this file applies to an NPC trait exactly as to an agent's.

**The archetypes** (75 traits). Office workers (two suits with ties, a short-sleeved shirt and tie, an oxford, two blouses, a cardigan, a trench, slacks, oxfords, loafers, a briefcase), tradespeople (work shirt, overalls, faded hi-vis, canvas work pants, work boots, a hard hat), service (deli apron, scrubs and scrub pants, a guard shirt, a delivery uniform, clogs), and everyday city-goers (students, joggers, retirees, tourists, parents: plain tees, a crew sweater, a fleece, a windbreaker, a running top, jeans, khakis, chinos, sweatpants, tourist shorts, plain sneakers, runners, canvas slip-ons, a flat cap, a plain ball cap, a knit, a tourist bucket, glasses, a coffee, a tote, a newspaper, groceries). Male- and female-reading hair: side part, crew cut, receding, bald crown, short and plain, bob, low bun, ponytail, shoulder length, grey set curls.

**Not built (follow-ups).** Skirts and dresses need a new leg form (the forms are construction, README § Bottoms): not built. A pencil skirt and a plain dress would round out the office and the moms; worth a form if slime wants them. The city also needs the NPC files in its bundle (the cast sync lists `FILE_OF` and `IMPORTED`; add `NPC`) and a roll that dresses its crowd from `list(slot, 'npc')`.

## Checks

The server must be running: `node style/serve.mjs 5350`. slime keeps it up. Every check exits 1 on failure. A category covers its imported traits too (`imported/<slot>.js`).

| Check | Command |
|---|---|
| **All of the below, one category** | `node style/check.mjs <category> [--quick]` |
| **The compatibility sweep: every cross-category pair and triple** (§ All traits work together) | `node style/check.mjs --all [--family hat×hair,…]` |
| The authored clips' gates (end frames, elbow identity, hands, see-through; `anim/clips/CLIPS.md`) | `node style/check.mjs clips [--quick]` |
| Audit + the cross-category combos (fit, overlaps, depth budgets, floating voxels, seams) | `node style/city/studio/audit/run.mjs --slot <category> --combos --gate` |
| See-through gate (any hole into a body shows magenta) | `node style/city/anim/overlap-check.mjs --slot <category> --gate '&dbg=back' [--quick]` |
| Overlap sweep (z-fighting, poke-through, slab show; a diagnostic, compare before/after) | `node style/city/anim/overlap-check.mjs --slot <category> --quick` |
| Lower-body motion (bottoms and shoes) | `node style/city/anim/lower-motion-check.mjs --slot bottoms\|shoes [--quick]` |
| Held motion (the grip poses, every held trait × every top, accessory and bottom) | `node style/city/anim/held-motion-check.mjs --combos [--quick]` |
| Studio sweep (every trait worn, baked, walked, idled, drawn, thumbnailed; console clean) | `node style/city/studio/sweep.mjs --slot <category> [--quick]` |

`<category>` is one of `skin`, `hair`, `hats`, `eyes`, `eyewear`, `mouth` (`mouth.js`: its mouths and the face ink, plus the imported rows mouths, `imported/mouth.js`), `mouths` (`mouths.js`), `ears`, `tops`, `bottoms`, `shoes`, `accessories` or `held`. The NPC pool's categories carry the `npc-` prefix (`npc-skin`, `npc-hair`, `npc-hats`, `npc-eyes`, `npc-eyewear`, `npc-mouths`, `npc-tops`, `npc-bottoms`, `npc-shoes`, `npc-held`) and add the NPC palette check (`node style/city/studio/audit/npc-palette.mjs --slot npc-<category>`); `--all --pool npc` is the pool's full check (§ The NPC pool).

**Known construction limits.** These are reported, never failed:

- **Hands-in-pockets (idle 3):** the hands reach into even the bare leg. The motion check reports this contact separately, and it does not fail the hand-clearance gate.
- **The shoulder cut on a sleeved top** moves when the arm swings. While it stays closed (the cap and the joint slab cover it), the audit lists it as a moving cut line, not a failure. A cut that OPENS fails.
- **The overlap sweep** reports small hip-slab and thigh/chest counts on the bare mannequin. Use it to compare before and after, not as a gate.

## Look at it

- **Studio:** <http://127.0.0.1:5350/style/city/studio/>. Your traits appear on reload. Click a card to wear it, then check walk-in-place, circle and the nine idles.
- **Lab:** <http://127.0.0.1:5350/style/city/anim/>.
  - `?slot=<category>`: one look per trait in that category.
  - `&<slot>=<id>`: put a trait on every look (for example `&hat=<id>&hair=<id>` for a pair, `&held=<id>`).
  - `&combo=<look>;<look>;…`: explicit looks in place of the per-trait list, each `slot:id,slot:id` on the mannequin (for example `&combo=hat:<id>,hair:<id>;top:<id>,acc:<id>`). The compatibility sweep and the crowd board use it.
  - Scenes: `&scene=treadmill|feet|idles|square`. Cameras: `&cam=face|chest|feet|knee|tq|…`. `&idle=<0..8>` stands in one idle.
- **Screenshots:** `style/shoot.sh "<url>&shot=1" out.png`
