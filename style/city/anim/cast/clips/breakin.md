# Break-ins: the `breakin` group (2026-10-15)

GAME.md §20: "Break in | a lockpick at the door, a flashlight inside". A break-in takes the rarest real piece in a home and half its cash (§7, §9), and a lockpick adds 1 to it and is used up (§8). These five clips are the burglar's side of that night, in the order the show plays them. Only `breakin.js`, `breakin-props.js`, this file and `shots/breakin/` are this group's.

## The clips

| clip | length | kind | moving | prop | what it shows |
|---|---|---|---|---|---|
| `pick_lock` | 6.0 s | loop | no | `lockpick` (a tension wrench in the −x fist, a pick in the +x) | Crouched at the door on the balls of the feet, leaning in, both fists at the keyhole under the chin. Four rake strokes (0.25–1.25 s) with the head tilted to listen. A freeze at 1.75: the hands come off to the chest, the body rocks back 8 cm off the door, then the head whips round over the +x shoulder (2.0–2.26), held. Back on the lock by 3.2. Single-pin lifts (3.4–4.3), a frustrated jiggle (4.3–4.65), a quick look over the −x shoulder (4.75–5.75). |
| `door_give` | 1.8 s | one-shot, `shift: [0, 0.4]` | no (its root steps in) | `lockpick`, hidden from 0.58 | Starts on `pick_lock`'s first pose. The last turn of the wrench, the lock gives at 0.3 (a jolt). The pick goes to the hoodie pocket, the wrench up the sleeve. The −x hand comes up flat on the door (0.45–0.8) and pushes it (0.85–1.1) while the body rises out of the crouch. The door swings in on its own, and two steps take the burglar through the opening (1.1–1.76). It ends standing hunched 0.4 m in. |
| `creep_walk` | 4.8 s | loop, a **walking overlay** (`moving: true, stride: 1, speed: 0`) | yes, at the walker's own pace | `flashlight` (the +x fist) | Hunched low over the walk, the chin tucked, the torch out ahead, its beam on the floor 1.2–1.6 m ahead, scanning left and right once a loop with the eyes leading it. The −x arm is out for balance. It writes only the chest, the head and the arms (high.js's convention), so the legs are the walk's. |
| `flashlight_search` | 6.4 s | loop | no | `flashlight` | Standing in the dark room, knees soft, the torch out at chest height. The beam starts on the floor ahead to the −x side and sweeps across to the +x side (0.6–2.2 s), the chest turning with it. It holds on something there while the burglar leans in (2.2–2.8), drops to the floor by the feet and back. A noise: the beam whips to the −x side (3.6–3.85), a duck, the −x hand up, held, then it relaxes back by 6.4. |
| `rummage` | 4.4 s | loop | no | none (the torch is set down) | Bent over a low open drawer, both hands in it, digging in turn (0.2–1.4). The +x hand flings something aside (1.45–2.15). Two more digs. A freeze to listen (2.6–3.3): the hands come up to the rim, the head up and round to the −x side. The −x hand takes something to the hoodie pocket (3.3–3.95), and is back in by 4.4. |

Every loop is seamless at its length: every channel is keyed back to its start or runs a rhythm that divides it. All five blend from the bare stand (`blendIn` 0.1–0.4 s).

## The chain the show plays

1. **Arrive.** The walk to the door happens only in the show (GAME.md §20). Stop the walker at the door (below), facing it, and `playClip(g, 'pick_lock')`. It blends in over 0.4 s. Let it run at least one loop: the glances are what reads from the street.
2. **The lock gives.** Switch on a wrap of `pick_lock`: on the frame its clock crosses a multiple of 6 s, `playClip(g, 'door_give', { t: s.t % 6 })`. Its first pose is `pick_lock`'s first pose exactly (every channel is equal), so nothing pops. Swing the door by `CLIP.door_give.door(t)` (below).
3. **Inside.** `door_give` ends by itself. On its end frame `stepClip` returns `shiftNow = [0, 0.4]`; move the walker by it then (CLIPS.md § Root motion), and it blends out over 0.35 s. Start the walker moving into the room and `playClip(g, 'creep_walk')`. Drive it slowly (0.5–0.7 m/s) and don't move it for the clip: it is a speed-0 overlay.
4. **Search.** When the walker stops, `stopClip` the creep (it blends out to the stand), then `playClip(g, 'flashlight_search')`. Any frame is fine: it blends in from the stand. Going back to the creep works the same way.
5. **Rummage.** Stand the walker at the drawer (below), `stopClip` the search, `playClip(g, 'rummage')`. It has no prop: hide the torch, or set it down on the dresser with its light into the drawer.
6. **Leave** the way it came: `creep_walk` out, or `run_getaway` if it's seen (`robbery.js`).

**Hide held things** (grip.js) while any of these clips play: they own both arms, so a held trait would ride the pick hand or the torch hand. Also hide them while riding.

## What the city must stage

### The burglar's look

GAME.md §19: an attacker in a break-in shows hooded, and a ski mask hides the name. The **Stick-Up Knit** (`hats.js` `stick_up_knit`, "three-hole knit mask, red-trimmed, the robbery uniform") fits every clip. On the real shader it makes 0 arm-on-head crossings in all five, and the masked head stays 3 cm behind the door's face.

- A **forward brim** (a fitted cap) reaches 0.22 m past the face: at the lock it goes 0.22 m into the door. Dress the burglar in the mask or a hood, or turn the cap round.
- Big hair (`fro`) still clears the door (by 3.4 cm).
- `old_balaclava`'s skirt hangs 5.5 cm under the head. The clips were lowered to clear it too: 0 head crossings in four clips, 22 in `rummage`'s fling.

### The door (`pick_lock`, `door_give`): `breakin.js` `DOOR`

In the burglar's body frame (it faces +z; x across):

| what | where |
|---|---|
| the door's face (the leaf) | the plane z = 0.62: the walker's ground point is **0.62 m out from the leaf**, facing it |
| the opening | x −0.6 … +0.6: the house kit's 1.2 m opening, **the walker centred in it** |
| the keyhole | (0, 0.59, 0.62): **0.59 m above the landing**, centred |
| the hinge | x +0.6, z 0.62 (the +x jamb); the leaf swings in, away from the burglar |

- **Why the keyhole is low and centred.** The toon arm reaches only 0.40–0.45 m from the shoulder, and the big head (1.0 m wide) owns everything above the shoulders. So the hands can only work under the chin, at shoulder height when crouched. The house kit's gold knob (`suburbs/house.js` `hdoor`, 1.0–1.2 m above the landing) is at the toon's face, where no hand reaches. Draw a lock plate or deadbolt at the keyhole for the show. The sim-state layer's `lock` placeholder (`placeholders.js`) could stand there.
- **Why centred.** The opening is 1.2 m and the head 1.0 m wide, so the head fits only when centred (0.1 m each side). The kit recesses the leaf 0.2–0.3 m behind the casing's front; that's fine as long as the casing is outside x ±0.6.
- **Clearance.** Keep everything else out of the head's way: nothing within x ±0.5 in front of z 0.62 between 0.73 and 1.75 m up. The bare head's front comes to z 0.545 at most (the masked head 0.59).
- **The swing**, `CLIP.door_give.door(t)` (rad about the hinge, + opens in; the same function the sheets' preview uses):

  | t (s) | 0–0.85 | 1.0 | 1.1 | 1.2 | 1.3 | 1.4 | 1.5 → |
  |---|---|---|---|---|---|---|---|
  | angle | 0 | 0.05 | 0.39 | 0.90 | 1.26 | 1.48 | 1.55 |

  - The hand pushes the leaf 0.85–1.1; from 1.05 it swings open on its own.
  - The steps start at 1.1. The head clears the swinging leaf by ≥ 3 cm.
  - The open leaf lies along the +x jamb (x 0.57–0.6), 7 cm from the head.
  - A door hinged on the −x side would need the clip mirrored: the push is near the free (−x) edge.
- **The porch light** (the kit lights it at night) is what shows the burglar at the door from the street.

### The flashlight's beam (`creep_walk`, `flashlight_search`)

The beam and its light are the city's. The clip says where it points: `prop.beam(t[, g])` → `{ p, d, show }` in the walker's body frame. `p` is the lens (the torch's front face) and `d` the beam's direction.

- **To world:** the walker's matrix (ground point, yaw) × these. For a point, `x' = x cos yaw + z sin yaw`, `z' = −x sin yaw + z cos yaw`, `y' = y + ground`, plus the walker's position. Rotate `d` the same way, without the translation.
- **Show it** while the clip's weight is ≥ 0.6 and `show` ≥ 0.5. Use the playing clip's prop (`state.c.prop`).
- **`creep_walk` is a walking overlay.** Its torch rides the chest over the walk, so pass the walker's gait state `g` (gait2.js; the city has it in the gait hook) to `pose`, `matrix` and `beam`, as for `carry_box`'s box. Without `g` (the lab's live preview), it assumes a steady 0.6 m/s creep at the walk's mean pelvis, and the torch drifts up to 2.3 cm off the hand (measured over 0.5–0.7 m/s).
- **The sheets' preview light:** a warm spot light (0xfff1c8, angle 0.32 rad, penumbra 0.45, range 9 m) and a faint cone. The pool on the floor is what reads at 25 m.

Where the beam points (yaw +: toward the walker's +x side; pitch +: up; the spot = where it meets the floor, from the lens):

| `flashlight_search` t (s) | 0–0.8 | 1.2 | 1.6 | 2.0–2.8 | 3.2 | 3.6 | 4.0–4.8 | 5.6–6.4 |
|---|---|---|---|---|---|---|---|---|
| yaw | −47° | −19° | 14° | 39–43° | 27° | 8° | −56° | −47° |
| pitch | −17° | −14° | −13° | −13° | −17° | −14° | −14° | −17° |
| spot | 1.7 m | 2.3 m | 2.5 m | 2.5–2.7 m | 1.8 m | 2.5 m | 2.0–2.2 m | 1.7 m |

- **The lens** is 0.52–0.61 m up, 0.34–0.72 m ahead of the walker's ground point.
- **The startle** at 3.6–3.85 is the beam's fastest move: about 1.1 rad in a quarter second. A flicker of the light there sells the noise.

| `creep_walk` t (s) | 0 | 0.6 | 1.2 | 1.8 | 2.4 | 3.0 | 3.6 | 4.2 |
|---|---|---|---|---|---|---|---|---|
| yaw | −1° | 14° | 20° | 14° | −1° | −15° | −21° | −15° |
| pitch | −20° | −18° | −19° | −22° | −20° | −17° | −18° | −21° |
| spot | 1.3 m | 1.6 m | 1.5 m | 1.2 m | 1.3 m | 1.6 m | 1.4 m | 1.2 m |

The creep's lens is 0.45–0.51 m up and ~0.7 m ahead, at the walk's mean pelvis.

- **Seeing it from the street.** The house hides the inside. Show the light through the windows (the sim-state layer already lights window panes), cut the walls away, or cut inside: that's the director's call. GAME.md §20 promises "a flashlight inside".

### The drawer (`rummage`): `breakin.js` `RUMMAGE`

| what | where (the burglar's body frame) |
|---|---|
| the dresser's front | z 0.62, its top 0.78 m up |
| the drawer | 0.7 m wide, pulled out 0.32 m toward the burglar (its front panel at z 0.30), its floor 0.34 m up, its rim 0.48 m up |

- **A low drawer:** the second of a dresser, or an open chest. The fists dig just under the rim. The big head's bottom comes down to 0.67 m when it looks in, so a drawer at hip height would put the head into the hands.
- **The loot.** At 3.3–3.95 the −x hand takes something to the hoodie pocket. That's where the city can show the piece that was taken (the rarest real piece, §7) in that hand. It isn't built.

## The props: `breakin-props.js`

One voxel model per tool (MOVEMENT.md §2: in the hand, dropped, the icon), grain 0.025 m, about twice a real one (the toon fist is twice a real hand).

| tool | the model | its points (`TOOL`) |
|---|---|---|
| `pick` | a yellow grip out of the fist's front, a one-cell steel shaft, the hook turned up | `tip` |
| `wrench` | a yellow grip, a one-cell steel bar, its tip bent down | `tip` |
| `flashlight` | the Lights Out Torch's colours (`held.js` `lights_out`): black body, yellow band, chrome bezel, a lit warm lens; 0.325 m | `lens`, `dir` (the beam) |

- **The frame:** the origin is the hand's grip point (the mitten's centre), +z along the fingers, +y the thumb side: the gun's mapping (robbery.js). Nothing reaches back past the wrist.
- **Exports:**
  - `GRAIN`, `TOOL`, `SCHEMES`, `TOOL_IDS`;
  - `toolCells(id, scheme?)` (`[x, y, z, colour, layer]`, layer 3 = the lit lens);
  - `lockpickSetCells()`: the pick and the wrench side by side, as one model: **the lockpick item's icon** (the Gunrunner builds lockpicks, GAME.md §9);
  - `toolGeometry(THREE, id)`, `lockpickSetGeometry(THREE)`, `toolMatrix(THREE, pose, out)`, `toolPoint(pose, q)`, `toolDir(pose, d)`;
  - `lockpickLive(THREE)` (the lab's single prop slot only).
- **Each clip's `prop`:**
  - The lockpick clips (`pick_lock`, `door_give`): `{ id: 'lockpick', parts: ['wrench', 'pick'], pose(t) → { wrench, pick } (each { p, R, show }), partGeometry(THREE, part), partMatrices(THREE, t, outs?) → [[part, Matrix4], …], tips(t) }`. The city draws the two parts, each × the walker's matrix (ride.js's way).
    - `geometry` and `matrix` are one live CPU-posed mesh for the anim lab's single prop slot. Don't use them in the city.
  - The flashlight clips: `{ id: 'flashlight', pose(t, g?), matrix(THREE, t, out, g?), beam(t, g?), geometry(THREE), frame: 'walk' | 'body' }`.
- **The tools ride the hands exactly.** Each clip's body is one track of expressions valid in GLSL and JS; the CPU runs walk2.js's forward kinematics (and the same two-bone IK, to the GLSL's own 4-decimal constants). Measured on the real shader, the hand's grip point against the prop's: ≤ 0.001 mm on every clip, look and state while the tool shows.
- **The pick and the wrench meet the keyhole.** Each is turned in its fist so its tip line runs through the keyhole. While the hands are on the lock, the wrench's tip stays within 1.9 cm of it and the pick's within 2.8 cm (the rakes).

## How they were made

- **One track per clip.** It holds the body, the feet, the root, the head and the two hands' targets, as expressions read by both the shader (`trackGlsl`) and the CPU (`trackJs`). The hands are placed by a two-bone IK on the elbow (talk-patrol.js / high.js's), in the chest's rest frame.
  - A target can be fixed in the **body frame**, like the lock or the drawer. The shader then takes it through the clip's root and the standing pelvis into the chest's frame, so the fists stay on the lock while the chest breathes, rakes and turns.
  - A walking overlay takes **chest-frame** targets only, because the shader can't see the walk's keyed pelvis.
- **The rig's limits, measured:**
  - **The reach shell** is 0.403–0.453 m with the elbow ≤ 83° (under the thick sleeve's soft cap): every IK target stays in it.
  - **The head's corners** sweep 0.15–0.22 m forward as it turns 0.3–1.2 rad. So `pick_lock` rocks back off the door before every glance, and `door_give` doesn't look round in the doorway (the jambs).
  - **An overhand torch grip** (the elbow up and out, the beam down) was tried for the search. The raised elbow went into the head (9,800 crossings). Instead the torch is tipped 0.3 rad down in the fist, the elbow down.
  - **Hands at a drawer at hip height** put the head into the hands. Hence the low drawer.
- **The probe:** transform feedback of the cast's walker shader (`walk2.js` `ANIM2_GLSL`, the elbow compiled in), every 0.05 s through every clip. It counts forearm and hand triangles crossing the torso, the pelvis, the legs, the head and the other arm, and checks hand ↔ prop and the head's front. The same probe on the accepted clips, for scale:

  | crossings (torso, summed over the clip) | bare body | `corner_hoodie` | `bubble_goose` |
  |---|---|---|---|
  | `pick_lock` | 443 | 12,641 | 37,315 |
  | `door_give` | 134 | 3,904 | 11,502 |
  | `creep_walk` | 357 | 7,759 | 21,953 |
  | `flashlight_search` | 905 | 13,460 | 36,553 |
  | `rummage` | 920 | 11,549 | 32,119 |
  | `deal_lookout` (for scale) | 2,164 | 20,336 | 54,812 |
  | `lean_wall` (for scale) | 2,084 | 22,045 | 64,584 |
  | `talk_gesture` (for scale) | 818 | 10,611 | 27,429 |

  - **On the bare body and the hoodie**, the five clips have 0 head, 0 leg, 0 pelvis and 0 arm-on-arm crossings.
  - **On the Bubble Goose**, the padded forearms brush the head's underside: 0–1,514 summed, the most in `pick_lock`, whose fists sit under the chin (`lean_wall` 9,214, `sit_stoop` 6,373).
  - **On the Goose and the Gatehill Mink**, the padded sleeves also touch the pelvis and the thigh: `creep_walk` 56–84 pelvis and 22 leg, `flashlight_search` 780–1,026 pelvis (the torch arm's padding over the hip).
  - **What these are:** the arm's inner column grazing the chest's corner, and padding pressing into padding. That's the known look (CLIPS.md, the talk and robbery notes).

## Checks (this branch on main a62bbad, port 5362)

- **`FRESH_URL=http://127.0.0.1:5362 node style/check.mjs clips --quick --jobs 2`:** PASS. 73 clips (4,589 shader states).
  - The end check: PASS.
  - The elbow identity: PASS within 1e-6 m. The five breakin clips are listed as bending by design.
  - The hand gate: every fresh bottom on the plain shoe, 68 fixtures in 8 shards, every count 0.
  - The see-through gate: the clip line-up on the mannequin, 0 frames with inside faces.
- **The registry loads, and the old clips keep their ids:** 0–67 as on main; the breakin clips are 68–72, appended in this group.
- **Seams:**
  - Every loop's channels at t = D (unwrapped) equal t = 0 exactly.
  - `door_give`'s first pose equals `pick_lock`'s at t = 0 on every channel.
- **The hand gate on the full bottom × shoe matrix, these five clips only:** PASS. 4,662 fixtures (378 distinct leg/shoe geometries) × 473 shader states, 63 shards, every count 0. It ran through a scratch copy of `lower-motion-check.mjs` with a clip filter, as the ride, talk and robbery agents did.
- **The see-through gate on every look (495), these five clips only:** PASS. `overlap-check --gate '&dbg=back' --clips '&only=pick_lock,door_give,creep_walk,flashlight_search,rummage'`, 8 shards: 0 of 546,480 frames show inside faces (`pick_lock` 136,620 · `door_give` 43,560 · `creep_walk` 114,840 · `flashlight_search` 146,520 · `rummage` 104,940).
- **Not run here:** a probe sweep of every top and hat. The probe covered the bare body, `corner_hoodie`, `box_hoodie_4am`, `bubble_goose`, `gatehill_mink`, `tall_tee` with `nines_fitted`, `fro`, `old_balaclava` and `stick_up_knit`.

## Sheets: `shots/breakin/`

- `<clip>-{side,front,tq}.jpg`: the lab's own contact sheet (CLIPS.md's sheet URL), 12 frames over one loop (or the one-shot), on the burglar look: the Stick-Up Knit, `corner_hoodie`, `ash_sweats`.
- `staged-*.jpg`: the clips with the city's sets drawn for the preview only. A scratch harness drives the lab and adds the sets; the lab itself has none.
  - `staged-pick_lock.jpg`, `staged-door_give.jpg`: at the kit's recessed door, with the porch light. The side rows use a leaf-only cutaway, because the wall hides the hands.
  - `staged-creep_walk-night.jpg`, `staged-flashlight_search-night.jpg`: at night with the beam (a spot light and a faint cone).
  - `staged-rummage.jpg`, `staged-rummage-night.jpg`: at the drawer; at night, the torch set down on the dresser.
- `filmstrip-25m-day.jpg`, `filmstrip-25m-night.jpg`: the city distance.
  - Each clip at ~25 m, fov 22° on a 640 × 360 tile (the city's pixel size at 1080p, as in `shots/moods/`).
  - Seen from the street, behind the burglar, cropped round the figure (112 × 96 px) and shown 2× nearest, 12 frames over one loop.
  - The top row is a plain walk for scale. `day` is the clips alone; `night` is staged with the sets and the beam.
- **What reads at 25 m from the street:**
  - the crouch at the door;
  - the masked head turning on each glance;
  - the rise and the step in;
  - the hunched creep;
  - above all, the beam's pool sweeping the floor.
  - The hands and the tools don't read at that distance; they're for the close cameras.
