# The Cleaners (group `cleaners`, family events)

slime, 11-04: "cleaners is better, go with that". When a body from a street accident lies in view, two figures in white hazmat suits step
out of the nearest door, bag the body and carry it inside; one comes back out and mops up the blood. Nobody on the street reacts, and it
is always the same two. This is a FIRST PASS of their look and their animation for slime to art-direct. How they behave in the city (the
door, the route, the road, the blood) is the next lane's.

Seven clips in `cleaners.js` (ids 129–135: the group is last in `index.js`, every older clip keeps its id and its GLSL) and one prop file,
`cleaners-props.js` (the body bag, the mop). Their look is in the cast: `style/city/cast.js` `OUTFITS.cleaner_visor` / `cleaner_mask`.

## The look (cast.js OUTFITS; the NPC pool's files, the gloves in `skin.js`)

| piece | trait | |
|---|---|---|
| hood + face, variant A | `hat/npc_cleaner_hood_visor` | white hazmat hood round the whole head, a faceless dark gloss visor brow to chin |
| hood + face, variant B | `hat/npc_cleaner_hood_mask` | the same hood, a full-face respirator: two round lenses, the snout, two filters |
| coverall | `top/npc_cleaner_coverall` | white, a grey zip flap, a high collar under the hood, the cuffs taped grey |
| coverall legs | `bottom/npc_cleaner_coverall_legs` | white, roomy, taped grey over the boots |
| boots | `shoes/npc_cleaner_boots` | black rubber |
| gloves | `skin/cleaner_glove` | blue-grey nitrile. On this rig the hands ARE the skin (fit/held.js `hands()`), and the hood covers every other skin cell. In the agent pool's `skin.js`: the NPC palette check takes ordinary skin tones only, and failed it there (#7d93a8, hue 209°) |

- **`uniform: true`** on each: `cast.js` never rolls them (CAST / NPC_CAST leave them out; `UNIFORM_CAST` holds them for `wear()`), so
  every rolled look is unchanged (3000 seeds a pool and the 16 named looks, byte-identical to trunk a0245e4). Dress a Cleaner with
  `rollLook(seed, { pool: 'npc', wear: OUTFITS.cleaner_visor })`; both of the pair wear the same outfit.
- The gloves are blue-grey so the hands read on the black bag.

## The clips

| clip | length | kind | prop | the beat |
|---|---|---|---|---|
| `bag_body` | 5.4 s | one-shot, hold; pair → `bag_body_b` (gap `BODY.gap` 2.15 m, facing) | `body_bag` | cleaner A crouched at the body's side: the folded bag out and unfurled 0.4–1.0, its near edge held up · B rolls the body in 1.1–2.0 · in at 2.0 (`BODY.hide`), the bag fills 2.0–2.25 · the −x hand on the bag, the +x hand runs the zip 2.5–3.9 · up 4.1–4.9 |
| `bag_body_b` | 5.4 s | one-shot, hold | none | cleaner B across the body: hands on its far side 0.8–1.1, the push that rolls it into the bag 1.1–2.0, sits back, watches the zip, up 4.1–4.9 |
| `bag_lift` | 2.2 s | one-shot → `carry_back`; pair → `bag_lift_front` (gap `CARRY_GAP` 2.55 m, `face: 'away'`) | `body_bag` | A at the bag's FEET end, facing along it: a crouch 0–0.5, the hands into the foot loops 0.4–0.65, up with the bag 0.8–1.7 |
| `bag_lift_front` | 2.2 s | one-shot → `carry_front` | none | B at the HEAD end, its back to the bag: a straight-backed squat and a look back, the hands back into the head loops, up with it |
| `carry_back` | 2.0 s | loop, MOVING 0.8 m/s; pair → `carry_front` (`face: 'away'`) | `body_bag` (A's chest frame) | A behind, the foot loops in front, the bag slung to B; a glance aside |
| `carry_front` | 2.0 s | loop, MOVING 0.8 m/s | none | B in front, the head loops in its hands behind it; a glance back |
| `mop` | 2.4 s | loop | `mop` | **work.js `sweep`, verbatim** (its GLSL and its track), the broom swapped for a mop on the broom's frame |

**Sweep fits the mop.** The mop is built on the broom's frame (work-tools.js: a 0.55 m handle, the head to 0.825 m, the tip where the
bristles end), so sweep's own track carries it and its hands stay on the handle as they do on the broom. Two short right-to-left strokes
with the head on the ground read as mopping. Not a figure-eight; a wide mopping stroke would be its own clip.

**Kneeling is a crouch.** The rig can't kneel (CLIPS.md, get_up: the leg cloth wants the hip ≥ ~0.12 m above the ankle). Both
`bag_body` sides crouch (drop 0.22 m, the chest pitched 0.55).

**The roll is a cut.** `lie_still` can't be rolled, so the body stays where it lies until `BODY.hide` (2.0 s on `bag_body`'s clock), when
the city hides it and the bag (laid out between A and the body) fills. B's push and A's held edge sell it.

## The bag (`cleaners-props.js`)

- `body_bag`: one model (0.05 m cells), the shape of a toon lying on its back (the head end a big lump: x 0.4–0.9, 0.7 wide, 0.6 high;
  the shoulders, the hips, the legs, the feet), black, a grey J-zip near the top of the near side, four webbing loops on a strap across
  each end (`BAG.handles`, at ±0.45 across: wide, so the carriers' fists stay clear of their own legs — the hand gate decided it).
- **Empty is the full model flattened** to `BAG.flat` (8 %) of its height by the clip's matrix: one model, two states, the outline the same.
- `mop`: 0.025 m cells, an aluminium handle with a dark grip, a grey socket, grey-white strings with wet ends.
- `cleanersCells(id)` (for the icon baker), `cleanersGeometry(THREE, id)`, `BAG`, `zipAt(x)`, `GRAIN`, `SCHEMES`.

## What the city must stage

All spots are in the LEAD's body frame (+z ahead, +x its left). `BODY`, `LIFT` and `CARRY_GAP` are exported by `cleaners.js`.

1. **Step out:** both walk (their own walk) from the nearest door to their `bag_body` marks.
2. **`bag_body` / `bag_body_b`**, started on the same frame: A with the body's walker at `BODY.at` = (−0.85, 1.25) in A's frame, the
   same heading as A (lie_still lies along its own +x); B `BODY.gap` = 2.15 m ahead of A, facing A. Keep both still (`g.w = 0`).
   **Hide the body at `BODY.hide` = 2.0 s** on `bag_body`'s clock. Both hold standing at the end.
3. **The resting bag:** from `bag_body`'s end until `bag_lift` starts, no clip draws the bag: draw `body_bag` at its rest pose, A's frame
   at `bag_body`'s end × `T(0.2, 0, 0.65)` (its +x along A's +x). Then walk A to the bag's FEET end and B to its HEAD end.
4. **`bag_lift` / `bag_lift_front`**, started on the same frame: A at the bag's origin − 1.245 m along the bag's +x, facing the bag's +x
   (`LIFT.at`); B `CARRY_GAP` = 2.55 m ahead of A, the same heading. They chain into the carry by themselves.
5. **The carry:** move both at the clip's `speed` (0.8 m/s) along their heading. **Keep their gaits in step:** the same `g.u` (start
   both `bag_lift`s on the same frame from walkers standing in the same cycle phase, and step them with the same distances). The bag
   rides A's chest frame (`prop.matrix(THREE, t, out, gA)`: pass A's gait state); B's hands meet it only when B steps like A
   (§ Checks: in step 0.05 mm; a quarter cycle apart, 42 mm). Turning the pair is the next lane's: a turn should pivot round the bag's
   centre, both walkers on the bag's line.
6. **In:** at the door the stage takes them out of view (the bag goes in with A's prop).
7. **The mop:** B alone, `mop` looped at the blood, the mop head about 0.65 m ahead of B.

Near tier only, as every clip: the mid and far tiers draw the standing body (their look reads at both: the sheets).

## The API (entry fields beyond CLIPS.md's)

- `prop` on `bag_body`, `bag_lift`, `carry_back`: `{ id: 'body_bag', frame, geometry(THREE), pose(t, g?), matrix(THREE, t, out?, g?),
  loops(t, g?) → { feet: [−x, +x], head: [−x, +x], show } (the loops' grip points in the lead's body frame), track }`.
- `prop` on `mop`: sweep's prop with the mop's geometry (`matrix(THREE, t, out)` = work-tools.js `toolMatrix` of sweep's pose).
- `body` on `bag_body` (= `BODY`), `lift` on `bag_lift` (= `LIFT`), `track` on every track clip (the JS side of its track).
- The hands are put on their targets by breakin.js's track model (`MODEL`, imported unchanged): the body-frame targets go through the
  standing pelvis and the chest, then the two-bone IK on the elbow; the carry's are chest-frame targets.

## Checks

See the commit message and the hand-back for this pass's numbers. The tools:
- `node style/city/anim/cast/clips/end-check.mjs` (no server).
- The hand gate and the see-through gate run on the clean room (ai-city-fresh; CLIPS.md § The lab and the checks):
  `FRESH_URL=… node style/check.mjs clips --quick`.
- `node style/city/tools/cleanershands.mjs --port <p>`: the carriers' grip points against the bag's loops on the real shader
  (transform feedback of the cast's `ANIM2_GLSL`), through `bag_lift` and 8 s of carrying, in step and a quarter and half a cycle apart.
- `node style/city/tools/cleanersshots.mjs --port <p>`: the look sheets and the beat clip (`style/city/shots/c2-cleaners/`).
- The studio: `style/city/studio/cleaners.html?mode=look&tier=near|mid|far&tod=day|night` · `?mode=beat&t=<s>&face=visor|mask`.

## Open items (art: slime's)

- **Which face:** `cleaner_visor` (faceless dark visor) or `cleaner_mask` (respirator). Both are built; the sheets show both.
- **Do they ever look at the camera?** Not built. Option: a head turn to `cLook` held 0.6 s in `carry_front`'s glance (one line).
- **Night extras:** none yet. Options: reflective strips on the coverall (a pale band on the shell's arms and legs: two rows recoloured),
  a head torch on the hood (a lit-layer voxel pair above the visor: material 3).
- **The bag past "black":** the zip is grey, the loops dark grey webbing; no label, no colour.
- The roll is a cut (above); `bag_body`'s heads crowd each other over the body (the toon heads are 0.8 m wide).
- These files were authored on a scratch clone of ai-city-fresh (c2-clips 34d25ec) and copied here byte for byte: they must go upstream
  to ai-city-fresh before the next `sync-cast.mjs`, which replaces `world/cast/` and `style/city/anim/cast/` whole.

## The van (lane C2-van, 2026-11-05)

slime, 11-05: "Vans is fine if you think that's the best option." The Cleaners arrive in a plain white van. It stops in the travel lane
beside the body, double-parked, the way the arrest's cruiser does (stage/cruiser.js planStop), and traffic queues behind it while it
works (the coordinator, 11-05: this replaced "parks at the kerb like a parked car"). The body lies at the kerb beside the van or a few
metres ahead or behind it. The two step out of the back, bag the body, carry it straight to the van's tail, put it in the back, one mops,
they climb back in, the doors are pulled to and the van drives off until it is unseen. This pass is the van and the
crew's van beats, for slime to direct; the city's lane (traffic/cleaners.js, after the traffic bend) wires them in.

### The model (the city's `style/city/vehicles/`, owned there)

- **`cleanvan`** in the fleet table (`VEHICLES`, after the bus): the Qwik Kargo van's body (4.4 × 1.8 × 2.4 m, its wheels and lamps), plain
  white, no stripe, no lettering. Its mix is empty (as the bus's): traffic never picks it; `stage: true` keeps it off the lineup's rows.
- **variant** 0: dark glass all round, nobody seen at the wheel · 1: clear glass, and with `driver: true` a Cleaner at the wheel (the white
  hood, the dark visor). Lamps lit at night as the fleet's (`lights: night`).
- **The doors:** `vehicleMesh('cleanvan', o, mat).userData.setDoors(open)` (vehicles/three.js), `open` 0 … 1, the stage's value: at 0 the
  shut body; above 0 the open bay (dark, a ribbed floor, the wheel housings) and the two leaves, each turned about its hinge by
  `doorYaw(id, leaf, open)` (index.js: ± 1.745 · open rad, 100° at 1). For the traffic agent's BatchedMesh: `vehicleGeometries(id, o)`
  gives `bay` and `leaves[0 | 1]` beside `body`; draw a leaf at the car's matrix · T(hinge) · Ry(doorYaw) · T(−hinge)
  (`spec.doors.leaves[k].hinge`, [x, z] m in the body frame).
- **The footprint, open at 1:** the leaves stay within the van's width (x ±0.821 m against its 0.9 half-width) and reach 0.707 m behind
  its tail (`doorReach(id, open)`): the double-parked van's stop needs that much clear road behind it, and the crew's marks behind it.
- **`spec.doors`:** `floor` 0.2 m (the bay's floor and the rear sill, flush), `tail` −2.2 (the tail's face, body frame z), the
  `doorway` (x ±0.7, y 0.2 … 2.3) and the `bay` (x ±0.7, y 0.2 … 2.2, z −2.1 … 0.7; 0.8 m between the wheel housings over z −2.0 … −0.7).
- **Why 0.2 m and not a real van's 0.55:** the toon's hip is 0.5 m up. Measured on the clips' own track (the hip over each ankle along
  the foot's up, the leg cloth's ≥ ~0.12 m): a 0.3 m floor left −0.19 … 0.06 m in the step and the legs tore into streaks in the studio;
  0.2 m (one stair riser: transit.js stairs are 0.18) leaves ≥ 0.118 m.

### The clips (ids 136–141, after mop: every older clip keeps its id and its GLSL)

All six are standing-leg one-shots with root motion: the clip walks the body on its own feet. **The walker's ground point stays on the
road**: while it stands in the bay, the clip raises the body by the floor itself (`cMov.y`), so the stage never moves a walker up or
down. Marks are in each clip's own start frame, +z the way it faces; `VAN_MARKS` (cleaners.js) holds them; `VAN.floor` is 0.2.

| clip | length | end | the stage | the beat |
|---|---|---|---|---|
| `van_step_down_back` | 2.55 s | shift [0, 1.29] | A in the bay facing out, the lip `VAN_MARKS.out.lip + .back` = 1.11 m ahead; pair → `van_step_down` (gap 0.9, `face: 'away'`, delay 0) | three steps along the floor to the lip 0.1–1.1 s · the +x foot down to the road toe first 1.3–1.8 · the −x foot down 1.9–2.25 · ends standing on the road |
| `van_step_down` | 2.55 s | shift [0, 1.33] | B in the bay facing out, the lip 0.21 m ahead | the +x foot down toe first 0.15–0.65 s · the −x foot down 0.75–1.1 · three steps on 1.2–2.25 |
| `bag_in` | 5.4 s | shift [0, 2.47] | A from the carry: B's toes at the lip, `VAN_MARKS.bag.lip` = 2.87 m ahead of A; pair → `bag_in_front` (gap CARRY_GAP, `face: 'away'`, delay 0); prop `body_bag` | B up into the bay 0.55–1.35 s, the bag lifted level by the floor 0.75–1.3 · both walk it in 1.3–2.75 · set down on the floor 2.95–3.5 · B lets go 3.45–3.75 · A pushes it home 3.9–4.75, lets go 4.75–5.05 |
| `bag_in_front` | 5.4 s | hold | B, CARRY_GAP ahead of A, its back to the bag | up onto the floor pulling (the +x foot first), three steps in · crouches to set it down · lets go · two steps on to the front of the bay, a look back · holds (hide it) |
| `van_in` | 2.5 s | hold | a cleaner on the road facing the tail, in line with the doorway's middle, the lip `VAN_MARKS.in.lip` = 0.32 m ahead | the +x hand on the +x jamb 0.2–1.3 s · up onto the floor 0.3–1.1 · three steps in · holds (hide it) |
| `van_in_close` | 3.6 s | hold; `doors(t)` | as `van_in` | up and a step in 0.3–1.7 s · turns round to face out 1.75–2.35 · both hands on beside the hips 2.3–2.45, out 2.45–2.75 · pulls the doors to 2.5–3.25: **`doors(t)`** (the entry's field) is the doors' open value it asks for, 1 → 0; feed it to `setDoors` · holds facing out, the hands out (hide it once the doors are shut) |

- **Start a clip that begins in the bay with `playClip(g, name, { t: 0, snap: true })`** on the frame the walker is shown (it was in the
  van, hidden): its first pose is already raised by the floor, so a blend-in from the road would show it rising.
- **Keep `g.w = 0`** (standing legs), and apply `state.shiftNow` on the end frame (CLIPS.md § Root motion), as every clip here.
- **The bag in `bag_in`:** its prop (`frame: 'body'`, A's ground frame at bag_in's start: the walker's ground point, which stays until the
  end shift). From the end, draw `body_bag` resting at `prop.matrix(THREE, dur)` in that same frame (`prop.rest`: its origin at
  [0, 0.2, 3.845], in the bay, its feet end 0.075 m inside the lip) until the doors are shut.
- **The carry → `bag_in` hand-over** switches both clips on one frame (`playClip`, the same t); the walk under the carry blends out over
  bag_in's 0.35 s. Stop the carry when B's toes reach the lip.

### Calls this pass made (engineering) and proposals (art: slime's)

- **B goes in first, pulling.** The toon heads are 1.0 m wide; the bay and the doorway are 1.4 m; open leaves stand 0.7 m back on both
  sides of the doorway. Nobody fits beside the doorway, so whoever holds the head end must go in ahead of it. So B (in front) steps up and
  pulls, A pushes; B is then at the front of the bay, behind the bag.
- **Who mops: the one left outside, A.** Both wear the same uniform; nobody can tell A from B. The stage plays `mop` on A after `bag_in`,
  then `van_in_close` on A. If slime wants B to be the one who mops, B has to get out past the bag in a 1.4 m bay, and there is no room:
  that needs a kerb-side sliding door on the van and a fourth beat.
- **The mop comes out of the van** in the city's cut (as the door story's): it shows when `mop` starts. Option: a `mop_take` one-shot,
  A at the lip reaching in to the +x wall (the mop clipped upright inside the doorway), 1.2 s.
- **The doors are pulled to from inside** by the last one in (`van_in_close`); the toon arms (0.45 m) can't reach the leaves' edges
  0.7 m out, so the hands go out and in as the leaves swing to by themselves (`doors(t)`). Option: each leaf pulled to from outside before
  climbing in, which would leave the last one outside: no.
- **Who drives** (the model's variant): 0, dark glass, nobody seen · 1, clear glass, a third Cleaner at the wheel. The sheets show both.
- **Open:** the van's look (plain white, as slime took it); how the beats feel; the 0.2 m floor reads low next to a real van.

### Checks and pictures

- `node style/city/anim/clips/end-check.mjs` and `FRESH_URL=… node style/check.mjs clips --quick` (the studio).
- The city: `node style/city/tools/vanshots.mjs --port <p>`: the lineup's 12 trunk models pixel-diffed against a084874's, the van sheets
  (`lineup.html?mode=van`), the beat sheets and the clip (`studio/cleaners.html?mode=beat&set=van&beat=out|in|back[&view=side|tail]`),
  into `style/city/shots/c2-van/`.
