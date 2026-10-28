# Cook: the Chemist at the bench (the cook agent, 2026-10-15)

Four clips in `cook.js` (group `cook`, family `activities`) and one model file, `cook-props.js` (the cook set: the pot, the paddle, the bottle of chem, the vial and its rack, the pour's stream). They stage GAME.md §20's Cook play: "the lab lights on at home, or a shack in the woods with steam rising". No other file changed.

**One look for every drug.** slime's call is that a drug's name never shows live, so nothing here can tell one drug from another. There is one colour scheme (`SCHEME`) and no labels: the batch is the same milky white in the pot and the vial, and the chem is the same amber bottle. No part changes shape or size, and nothing takes a drug as input. The city must not tint the steam, the light or the props by drug either.

## The clips

| clip | length | kind | what happens |
|---|---|---|---|
| `cook_stir` | 3.6 s | loop | The −x hand holds the pot's handle and the +x hand stirs with the paddle. Two rounds (0–2.4 s): the speed eases in and out, a round a second at the top, and the chest and the head go round with it. Then a look (2.45–3.55 s): the cook leans in, the head tips to peer at the batch, the paddle taps the rim (2.95 s) and the head nods. It is still at HOME by 3.6. |
| `cook_pour` | 4.8 s | one-shot → `cook_stir` | The −x hand leaves the handle, takes the bottle off the bench (0.8 s), lifts it and carries it out to the pot's far side (1.75). It tips it and the neck reaches over the rim: **the stream pours 1.925–3.175 s**, with two glugs (2.3 and 2.7 s). Meanwhile the +x hand stirs it in (two slow rounds, 0.6–4.2 s). The bottle goes upright, back on the bench (4.0), and the hand returns to the handle (4.7). |
| `cook_check` | 5.4 s | one-shot → `cook_stir` | The +x hand lets go of the paddle, which rests in the pot. It takes the vial out of its rack (0.6–0.9 s) and carries it out to the side under the head, then up beside it (0.9–1.6, hail_taxi's way up). It holds it to the light: the chin comes up, the head tips to it, and the vial turns once slowly round, swirling (1.7–3.7). Then it goes back down into the rack (4.5) and the hand returns to the paddle (5.3). The −x hand keeps the handle throughout. |
| `cook_fan` | 3.6 s | loop | For the woods shack, where the steam comes thick. The cook pulls back from the pot, the face turned away to −x and the chin up (0.05–0.45 s). The −x hand leaves the handle and fans the fumes off: five quick sweeps in front of the chest, 0.5–2.3 s. A cough at 1.5 s and another at 1.9 s, then the cook comes back over the pot: the hand is on the handle by 3.15, and the cook is still at HOME by 3.3. The +x hand keeps stirring, one slow round. |

- **HOME.** Every clip starts and ends on one pose: the stir's seam. The cook stands at the bench, leaning in a little (chest pitch 0.15). The −x hand is on the pot's handle, the +x hand on the paddle at the start of a round, the eyes on the pot. Measured on the real shader, every clip's first and last pose is within 0.005 mm of HOME on the bare body, a hoodie and the puffer.
- **The rounds start and stop still** (an eased angle), so leaving or joining the stir on a seam has no jerk either.
- **Blends:** 0.35 s in and out, on every clip.
- Each loop is seamless at its length (every channel returns to its start), and each is fine to blend into from the plain stand at any clock.

## How the hands stay on the props

- **One track for both sides** (work.js's method). Each clip's track is written once as expressions valid in GLSL and JS. The JS side poses the props from it; the GLSL side poses the body and puts each hand on its target with work.js's two-bone IK on the elbow (copied in, as talk-patrol.js and falls.js do).
- **A target** is a point of a prop (the handle's grip, the paddle's grip, the bottle's body, the vial), a body-frame point, or a chest-frame point (the fan's sweep: a circle about the −x shoulder, always in reach).
  - A hand moves between targets by weights, and the weights are blended in the chest's rest frame, through walk2.js's standing pelvis. So the chest's lean and sway never carry a hand off its prop.
  - Each hand's way out and back is bowed out and up from its shoulder, so it never cuts inside the arm's reach.
- **Measured on the real shader** (transform feedback of `anim2Glsl()`, the cast's elbow): each fist's grip point lands on its target to ≤ 0.04 mm, every 0.05 s through every clip, on the bare body, `corner_hoodie` and `bubble_goose`.
  - The props are posed from the same expressions, so a held prop is where the fist is.
  - The fist passes through a handle, as work.js's tools do.
- **What the toon body allows, and the choices it forced:**
  - **The reach.** A hand reaches only 0.403–0.453 m from its shoulder (elbow ≤ 83°, under the thick sleeve's soft cap). So the bench is low and close: its top is 0.38 m up, its front edge 0.22 m ahead.
  - **The head** (x ±0.5, y 0.9–1.7, its front face at z 0.45) owns everything above y 0.9. The fist is about 0.3 m tall in most orientations, so the hands work between the pot's rim (0.57) and the chin (about 0.84). The cook can't look far down into the pot: its head would meet its own hands. The eyes look down about 0.1 rad, and the lean in does the rest.
  - **The pour.** The bottle is held by its body, so the fist stays outside the rim while the neck reaches over it. A first pour held by the neck put the knuckles in the pot and the forearm in the head.
  - **The vial** goes up beside the head, hail_taxi's place for a raised hand, because a hand can't go in front of the face.
    - The head turns only 0.04 rad to it, rolls away and lifts its chin; turning further would swing the head's corner into the fist.
    - The pole is down and forward: hail_taxi's outward pole put the wrist 2 cm into the head's side here.

## Root and legs

No root motion: `cRot`, `cMov` and `cPiv` are unused, and `shift` is null. The feet stay planted (`cFoot`, z ±0.03), and the pelvis drops 0.02 m (the knees soften). The walker stands still for the whole clip: keep `g.w = 0`.

## The props: `cook-props.js`

- **One model per object** (MOVEMENT.md §2), on a 0.025 m grain; each prop is about twice a real one, as the fist is twice a real hand. `cookCells(id)` gives `[x, y, z, colour, layer]` for the icon baker, and `partGeometry(THREE, id)` the mesh (the city's corner AO).
  - `pot`: a red enamel saucepan, 0.30 m across and 0.15 m tall, a pale rim, the batch inside. Its long iron handle points out to −x.
  - `rod`: a wooden paddle, 0.425 m.
  - `bottle`: a 0.40 m amber reagent bottle with a pale lip.
  - `vial`: a 0.30 m test tube, the batch to two thirds, glass, a red cap.
  - `rack`: a small wooden block with a hole.
  - `stream`: a cross-section column of the chem, 1 m long, scaled to the pour.
- **Each clip's `prop`** (CLIPS.md § Props): `{ id: 'cook:<clip>', item: 'cookset', parts, pose(t), partGeometry(THREE, part), partMatrices(THREE, t, outs?), geometry(THREE), matrix(THREE, t, out), track(t) }`.
  - `t` is the clip clock, `state.t`; a loop wraps it itself.
  - `parts` is always `PART_IDS` = `pot, rod, bottle, vial, rack, stream`, in that order.
  - `partMatrices` returns `[[part, Matrix4]]` in the same order (local → walker), so it can fill instance slots. A hidden part (the stream when it isn't pouring) is collapsed onto its point (scale 1e-4).
  - `partMatrix(THREE, pose)`, `partPoint(pose, q)` and `SET` (every part's rest pose) are exported too.
- **`geometry` / `matrix`** are for the anim lab's single prop slot: one live mesh of the whole set, re-posed on the CPU (ride-props.js's way), one per clip. The city should draw the parts instead.
  - In the lab's line-up a chained one-shot and the stir share the stir's live mesh, so one of them shows the other's paddle. This is cosmetic and only in the lab.
- **`&cookset=1`** in the lab's URL also draws a plain stand-in for the city's bench and burner, so the sheets show the set. Without it the lab, and every gate, see only the props.

## What the city must stage

All in the walker's body frame (+z ahead, y up from its ground point). The cook stands on the bench's **cook spot**, facing the bench, and the props are drawn with the walker's matrix, as the board and the tools are.

### The set, at home (Pleasantview) and in the woods shack (Blackpine Woods)

- **The bench** (`BENCH`). Its top is 0.38 m above the walker's ground; its front edge is 0.22 m ahead, it runs back to 0.82 m and is 1.5 m wide (x −0.75 … 0.75).
  - Keep the space under the top's front clear for the knees: nothing between y 0.25 and 0.38 within 0.30 m of the cook.
  - At home: a kitchen counter or work table. In the woods: a plywood table in the shack.
- **The burner** (`BURNER`). Its top is at 0.42 m (0.04 tall), centred at x 0, z 0.40, 0.34 m square. At home a hot plate, in the woods a camp stove.
  - Its plate glows hot orange while any cook clip plays.
  - The pot sits on it (`SET.pot`).
- **The lab light** (`LAMP.at` = (0.30, 1.95, 0.55)): a lamp over the bench's +x half, so the vial the cook holds up sits in it.
  - On while the cook is at the bench. At home it is the "lab lights on" seen from the street: light the window.
  - In the shack, a bare bulb.
- **The steam** (`STEAM.at` = (0, 0.52, 0.40), the batch's surface, r 0.12) rises from the pot.
  - At home: thin wisps while stirring.
  - In the shack: thick, and out of the shack's roof and door (GAME.md's "steam rising" is the woods' read from the city).
  - During `cook_fan`'s sweeps (0.5–2.3 s) the steam can bend away from the −x hand.
  - During the pour (1.925–3.175 s) a puff where the stream meets the batch.
- **When there is no cook clip** (the cook stepped away), draw the set at rest: `SET`, or `CLIP.cook_stir.prop.partMatrices(THREE, 0)`. The paddle leans in the pot, the bottle stands at the bench's −x end, the vial in its rack at the +x end.

### Playing the clips

- **A batch on the night** (2 chems → 5 doses): `cook_stir` (×2), `cook_pour` (the second chem), `cook_stir`, `cook_check`.
  - At home that is 3.6 + 3.6 + 4.8 + 3.6 + 5.4 s.
  - In the woods, put `cook_fan` in place of a stir or two.
  - The show's vignette can be one stir, the pour and the check: about 14 s.
- **The day view** ("in its lab"): loop `cook_stir`, and switch to `cook_check` or `cook_fan` (woods) now and then. `cook_pour` goes once per batch.
- **Switch on a seam:** `playClip(g, 'cook_pour', { t: 0 })` on the frame the stir's clock crosses a multiple of 3.6 s; the same for `cook_check` and for stir ↔ fan.
  - The one-shots chain back into `cook_stir` by themselves.
  - To go straight from a one-shot's end to another clip, switch on the frame its chain happens (the state's name turns to `cook_stir`): `playClip(g, next, { t: state.t })`.
- **Leaving the bench:** `stopClip` on a seam. The props are posed by the clip clock, so if the stir stops mid-round the paddle keeps circling through the 0.35 s blend-out and then snaps to its rest pose. On a seam it is already there.
  - Draw the set from the playing clip's prop (`state.c.prop`) while a cook clip plays, and from `SET` otherwise.
- **The camera:** the hero angle is across the bench from the front, or front-right for the check (the raised vial is on the +x side). From behind, the head hides the hands.
- **Held things:** the clips own both arms. Hide a held trait while cooking, as while riding or filming.

## How it reads at city distance (about 25 m, the city's pixel size)

At that size the head is most of the figure, and the set (the bench, the red pot, the amber bottle) is a few pixels. The clips are told apart by the head's attitude and the big arm moves:

| clip | the head | the arms |
|---|---|---|
| `cook_stir` | bowed to the pot, going round with the paddle | small rounds |
| `cook_pour` | turned to the bottle, then level over the pot | the amber bottle travels: lifted, tipped over the pot and back |
| `cook_check` | chin up, tipped to the vial | an arm raised beside the head, a red dot (the cap) on top: the clearest silhouette |
| `cook_fan` | turned away and tipped back, two coughs | the −x arm sweeping |

The woods' read is mostly the city's thick steam.

## Checks (port 5364; this branch on main a62bbad)

- **`node style/check.mjs clips --quick --jobs 2`** (7 min 59 s wall, on the final tree): PASS, every step.
  - **End check:** PASS. The CPU and the shader agree on every one-shot's end frame.
  - **Elbow identity:** PASS within 1e-6 m (max 1.19e-7) over 11,137 look-states.
    - The four cook clips are listed as bending by design, every state: `cook_stir` 73/73 ≤ 1.32 rad, `cook_pour` 97/97 ≤ 1.25, `cook_check` 109/109 ≤ 1.38, `cook_fan` 73/73 ≤ 1.31, all under the 1.45 cap.
  - **Hands** (`lower-motion-check --quick --clips`, every fresh bottom on the plain shoe): 72 clips, 4,468 states, 8/8 shards, every count 0. PASS.
  - **See-through** (the clip line-up on the mannequin): 0 of 13,116 frames show inside faces. PASS.
- **On the real shader** (transform feedback; scratch probes, not in the repo):
  - Each fist on its target: ≤ 0.04 mm on 3 looks, every 0.05 s.
  - Every clip's ends against HOME: ≤ 0.005 mm.
- **A JS twin of the rig** (the planner, scratch): the chest, the head and the IK in JS, every 0.02 s.
  - Every hand target is inside the reach shell; the worst overshoot is ≤ 1 mm, once.
  - No fist point is in the head's box, the pot, the bench top or a prop it isn't holding.
  - The bottle grazes the head's bounding box by 1 mm at one moment (3.42 s) on its way back.
  - The stir's +x forearm, and the fan's −x hand at the inner end of its sweep, come ≤ 5 mm into a hoodie's front corner. That is the arms-forward graze CLIPS.md notes for the talk and deal clips.
- **Not run:** the full matrix (`check.mjs --all`: every bottom × shoe and every look). It is many job-hours; the quick run is the smoke run.

## Sheets (`shots/cook/`)

- **`<clip>.jpg`:** the lab's contact sheet (CLIPS.md's sheet URL with `&cookset=1&zoom=2.2`, through `style/shoot.sh`). Rows: side, front and three-quarter, 12 frames over the clip, on `corner_hoodie` / `ash_sweats`.
- **`<clip>-close.jpg`:** two closer cameras over the clip, on a hoodie (`corner_hoodie` / `ash_sweats`) and on the puffer (`bubble_goose` / `raw_indigo`), 8 frames each. The cameras: front for all four; the stir adds the two near three-quarters, the pour the near −x three-quarter, the check the +x three-quarter (the raised vial's side), the fan the near −x three-quarter.
- **`filmstrip-25m-<clip>.jpg`:** each clip at the city's pixel size (about 38 px a metre, as fov 22° on 640 × 360 at ~25 m = the city at 1080p and fov 60°), shown 3× (nearest). Three rows: from the front (across the bench), the front-left three-quarter, and the −x side, all about 45° down.
- **`lineup-25m.jpg`, `filmstrip-25m-lineup.jpg`, `lineup-25m.webm`:** a plain stander and the four clips side by side at about 25 m, at the city's pixel size (the lab's line-up, `&only=stand,cook_stir,cook_pour,cook_check,cook_fan&cookset=1`).
  - The jpg is 12 uncropped frames.
  - The filmstrip is each figure cropped and shown 2× (nearest).
  - The webm is 6 s at 25 fps, shown 2×.
- The lab's side camera stands on the cook's −x side, so the tall bottle at that end of the bench hides the hands; the front rows are the ones to read.

## Open items

- **`cook_bag` (bagging the doses) is not built.** The bench has no free spot both hands reach between the pot, the bottle, the rack and the stirring arm.
  - A design that needs no prop to pop in a loop: the −x hand holds one open zip bag, and the +x hand dips into a bowl of doses and drops one in, two dips a 2.4 s loop.
  - It wants its own spot: a second station on a longer bench, or a packing table. It would start from the plain stand, not HOME.
- **Looking into the pot:** the head can't pitch far down over the hands, so "peering in" is a lean and a tilt. A taller bench would let the eyes go lower, but the arm's reach can't follow it.
- **The full clip gates on every bottom × shoe and every look** (`check.mjs --all`) are not run.
