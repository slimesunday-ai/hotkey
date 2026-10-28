# The grab clips (group `grab`, family events)

The crate grab at the Low Tide Docks (GAME.md §7, §9, §20: "Grab | a scramble for the crate at the docks"). On shipment nights a crate
of cash or goods lands at the docks and the strongest group takes it all. Six clips in `grab.js` and one prop in `grab-props.js` (the
crate). Nothing else changed: the other clips keep their ids (the group was empty; its six clips take ids 87–92, before `drugs` and
`errands`), and `index.js`, `CLIPS.md` and `lab.js` are untouched.

## The clips

| clip | length | kind | moves | partner / chain | prop | the beat |
|---|---|---|---|---|---|---|
| `crate_lift` | 3.2 s | one-shot | root: 0.12 m back (`shift [0, −0.12]`) | `next: crate_run` | crate | the crate on the ground ahead: squats, the fists close on the rope handles; a first heave that won't budge it (2 cm, a thump); a breath; THE HEAVE from the legs to the belly; a hitch up to the chest; staggers back a step under the weight; settles into the hold |
| `crate_run` | 3 s | loop | yes, 2.0 m/s (stride ×1.25) | none | crate (chest frame) | the hurried heavy carry: short quick steps leaning into it, a jolt on every step (the crate drops, nods and swings, the arms give), a hitch, a glance back over the shoulder. At walk weight 0 (standing) it is the hold, still |
| `crate_tug` | 4.6 s | one-shot | root: 0.15 m back (`shift [0, −0.15]`) | lead of `crate_tug_lose` (gap 1.45 m, facing, the same start); `next: crate_run` | crate | the scramble's winner: lifts it as the loser hooks its far edge; three surges and a deadlock, both leaning back; twists it free and staggers back into the hold |
| `crate_tug_lose` | 4.4 s | one-shot | root: 0.05 m back (`shift [0, −0.05]`) | partner of `crate_tug`; ends in the plain stand | none | the loser: hangs back while the winner is bent over it, steps in, hooks both fists over the far top edge; pulls and is dragged; his fists slip off as it is twisted free; reels back three steps, arms windmilling, catches himself |
| `crate_ram` | 2.5 s | one-shot | root: 0.27 m on (`shift [0, 0.27]`) | lead of `crate_rammed` (gap 1.15 m, facing, the same start); `next: crate_run` | crate | "shoving a rival off the crate": the holder (from the hold) has a rival's fists on its edge; a tussle; rips it back with a twist; winds up; RAMS him with it at arm's length (contact at 1.25 s); follows through, gathers it into the hold |
| `crate_rammed` | 1.25 s | one-shot | root: 0.10 m on (`shift [0, 0.10]`) | partner of `crate_ram`; `next: shove_fall` (→ `lie_hurt`) | none | the rival: steps in, hooks the crate's top front edge, pulls; it is torn out of his fists; the plain stand at the ram, which chains into falls.js's knockdown |

Every number the city times on is on the entry (`dur`, `next`, `shift`, `pair`, `speed`, `stride`, the blends). Each entry's `note` is
its timeline in words. `crate_lift.spot` and `crate_tug.spot` give the crate's ground spot (`{ crate: [x, z], yaw }`, the walker's body
frame).

## How they're built

- **One track per clip** (heist.js's and work.js's method): the body, the feet, the root, the eyes, the crate's pose and each hand's
  target are scalar expressions valid in GLSL and JS. The shader poses the body from them and puts each fist ON its target with a
  two-bone IK on the elbow; the CPU evaluates the same strings for the crate's matrix. `clip.track(t, u, w)` returns every channel.
- **The crate never moves before the fists have it.** It stands exactly on the ground (`groundPose`) until both fists are on its rope
  handles, and it rises only along the track the fists follow. Measured on the real shader (five looks): 0 states with the crate off
  the ground while a fist is more than 3 mm off its handle; the fists ≤ 0.04 mm off their targets; the crate never below the ground.
- **The back follows the hands.** The arm reaches only 0.403–0.453 m from the shoulder, a 5 cm shell. So in the standing clips the
  legs, the feet and the crate are keyed and the chest's pitch is solved at load (`solveTx`) to keep the fists mid-shell (0.428 m),
  through the shader's own body → chest conversion. That is the lift's back angle, the tuggers' lean-backs and the holder's wind-up.
  Every target stays 0.414–0.451 m from its shoulder.
- **The hold.** The crate is carried at the chest, its pivot (between the handles) 0.415 m out and 0.70 up in the chest's frame: the
  fists 0.445 m from the shoulders, the back face 0.29 m from the chest (a puffer's front is at 0.30), the top 0.15 m under the chin
  (the head nods 0.3 rad when a runner stops: it still clears). `crate_run` at walk weight 0 is the hold, still; `crate_lift`,
  `crate_tug` and `crate_ram` end on it and chain into `crate_run`; `crate_ram` starts on it.
- **The pairs share one crate.** The crate's track lives in the lead's clip (its prop); the partner's clip reads the same expressions
  and mirrors them into its own frame (it stands `gap` m ahead, facing: a point p of the lead's frame is (−p.x, p.y, gap − p.z)). So the
  partner's fists land on the lead's crate, ≤ 0.04 mm, as long as the city places the pair exactly at the gap.
- **The big heads set the pairs.** Two bent-over heads meet over a crate on the ground, so in the tug the loser hangs back while the
  winner squats and steps in as the crate comes up. A crate between two chests is out of the arms' reach for a shove, so the ram is the
  holder driving the crate itself, upright (a lean swings the head forward faster than the crate), in under the rival's chin; the rest
  of the lunge follows `shove_fall`'s snap back. The head boxes stay ≥ 9.6 cm apart in the tug and ≥ 6.9 cm in the ram (the real
  shader; `vault_shove` keeps 6.5 cm).

## What the city must stage

### The crate (`grab-props.js`)

- **One model:** 0.55 × 0.40 × 0.25 m (twice a real crate, as the toon fist is twice a real hand): dark battens (the corner posts, rims
  round the top and bottom), painted planks with grooves, a rope handle on each end 0.10 m below the top, the contents' stencil on both
  long faces. Its origin is the middle of its bottom.
- **Its colourway is the shipment's contents** (GAME.md §9, posted that morning): `SCHEMES` `cash` (green, a pale $, the default),
  `guns` (olive, a crosshair), `chems` (hazard yellow, a black !), `parts` (blue, a hex nut), `doses` (pink, a split capsule). Pass the
  key (or `{ paint, shade, trim, mark, rope }`) to `crateGeometry(THREE, scheme)` / `crateCells(scheme)`.
- **On the ground (before anyone has it):** the city draws it as a set piece, `crateGeometry(THREE, scheme)` with the world matrix
  T(x, ground, z) · Ry(yaw): the model needs no offset, its bottom is on the ground.
- **In a clip:** draw the playing clip's prop (`state.c.prop`) while the clip's weight is ≥ 0.6, with world = the walker's matrix
  (ground point, yaw) × `prop.matrix(THREE, state.t, out, g)`. Pass the gait state `g` for `crate_run` (its crate rides the chest:
  `prop.frame === 'chest'`); the others ignore it. Hide the set piece meanwhile.
- **The hand-overs are seamless:** `crate_lift`'s and `crate_tug`'s crate at t 0 is exactly the set piece at its ground spot (swap
  them when the clip's weight reaches 0.6); the chains into `crate_run` and the switch from the hold into `crate_ram` keep the clip's
  weight at 1, and the crate's pose across each seam agrees to 0.0005 mm.
- **The partners have no prop** (`crate_tug_lose`, `crate_rammed`): the lead's clip draws the one crate.
- **Hide held things** while a crate clip plays: the clips own both arms.

### The docks

- The crate lands on the quay's ground (Low Tide Docks), clear of the edge. Leave about 2.5 m clear along one line through it (the
  tug: the winner 0.48 m on one side of its middle, the loser 0.97 m on the other, he reels back 0.53 m; the ram's rival falls back
  0.36 m and lies along the line) and about 1 m to either side.
- **The lift's spot:** the lifter stands with the crate's middle 0.48 m ahead (`crate_lift.spot.crate`), its length across his
  heading (its long faces toward him), stopped (walk weight 0). It blends in from the stand (0.25 s).
- **The tug:** the winner (the lead, `crate_tug`) on the lift's spot; the loser (`crate_tug_lose`) 1.45 m ahead of the winner, facing
  him, on the crate's other side; start both on the same frame. Who wins is the rules' call: make the winner the lead.
- **The ram:** the holder in the hold (standing in `crate_run`, or just chained into it), the rival 1.15 m ahead, facing him; start
  `crate_ram` on the holder (`playClip`: the weight carries over, so the crate never blinks) and `crate_rammed` on the rival on the same
  frame.

### The chains and the shifts (apply each one-shot's `state.shiftNow` on its end frame)

- `crate_lift` (−0.12 m) → `crate_run`; `crate_tug` (−0.15 m) → `crate_run`; `crate_ram` (+0.27 m) → `crate_run`.
- `crate_rammed` (+0.10 m) → `shove_fall` (−0.36 m) → `lie_hurt`; `get_up` works from there (switch at a `lie_hurt` loop seam,
  falls.js's rule).
- `crate_tug_lose` (−0.05 m) ends in the plain stand: the walker's own walk or idle takes over (or the city starts him into the ram as
  he comes back for it).
- **`crate_run` is MOVING at 2.0 m/s** (`speed`, `stride` 1.25): the owner moves the walker at `speed` (as `run_getaway`); standing
  still it is the hold. **Turn the runner before driving him:** after the tug or the ram the winner faces his rival, and `crate_run`
  goes where the walker heads (it turns with the walker like any walk).
- **Don't stop a carrier in view** (`stopClip` on `crate_run`): below weight 0.6 the crate goes. Setting it down isn't authored (open
  items).

### A grab night, beat by beat (a suggestion for the director's cut)

1. The crate on the quay, the contents' colours. The crews converge (`guarded_walk` reads as "on a job"; `flee_run` to get there first).
2. Uncontested: `crate_lift` → `crate_run`, off the docks.
3. Contested: two arrive at once: `crate_tug` ⇄ `crate_tug_lose`; the winner chains into the hold.
4. The loser comes back for it: `crate_ram` ⇄ `crate_rammed`; the rival goes down (`shove_fall` → `lie_hurt`), the holder runs.
5. More crew: run other pairs (`scuffle_pair`, `vault_shove` ⇄ `guard_bowled`) beside them, ≥ 1.0 m apart sideways (the heads).

## The API (entry fields beyond CLIPS.md's)

- `clip.track(t, u, w)` (all six): every channel's value, the vars and each arm's target, at the clip clock.
- `prop` on `crate_lift`, `crate_run`, `crate_tug` and `crate_ram`: `{ id: 'crate', model, frame, geometry(THREE, scheme?), matrix(THREE,
  t, out, g?), pose(t, u, w), track }` (`frame` is 'chest' for `crate_run`, 'body' for the others; past a one-shot's end its pose takes
  the shift off, as the shader does).
- `spot` on `crate_lift` and `crate_tug`: `{ crate: [x, z], yaw }`, the crate's ground spot in the walker's body frame.
- `grab-props.js`: `GRAIN` (0.025), `CRATE` (`size`, `pivot`, the two `grip` points, `rest`), `SCHEMES`, `SCHEME`, `crateCells(scheme?)`
  (for the icon baker), `crateGeometry(THREE, scheme?)`, `crateMatrix(THREE, pose, out)`, `cratePoint(pose, q)`, `crateDir(pose, d)`,
  `groundPose(x, z, yaw)`.
- `grab.js` also exports `REACH`, `keys`, `toChest`, `reachOf` and `chestMatrix` (the chest's rest frame → the body frame, work.js's).

## Checks (port 5366; this branch on ai-city-fresh main 7355dd1)

`FRESH_URL=http://127.0.0.1:5366 node style/check.mjs clips --quick --jobs 2`: **PASS** (12 min 46 s wall), on the final code of both
files:
- **end check:** PASS (93 clips, 33 one-shots the CPU acts on; 60 fps, 30 fps, jittered and at the float32 edge, all agree).
- **elbow identity:** PASS within 1e-6 m (max 1.19e-7) over 11,354 look-states where no elbow bends. The six here are listed as moving
  by design: `crate_lift` 62/65 states bend, elbow ≤ 1.27 rad · `crate_run` 61/61, ≤ 1.16 · `crate_tug` 90/93, ≤ 1.24 ·
  `crate_tug_lose` 76/89, ≤ 1.45 · `crate_ram` 51/51, ≤ 1.21 · `crate_rammed` 21/26, ≤ 1.45 (all under the thick sleeve's soft stop).
- **hand gate** (`lower-motion-check --quick --clips`, every fresh bottom on the plain shoe): 93 clips (6,021 shader states) × 68
  fixtures, 11/11 shards, every count 0 (crossings, coplanar, opposite-leg, penetrations, leg/hand, foot/hand).
- **see-through gate** (`overlap-check --gate '&dbg=back' --clips`, the mannequin): 0 of 17,456 frames. Mine: `crate_lift` 0/280 ·
  `crate_run` 0/152 · `crate_tug` 0/336 · `crate_tug_lose` 0/192 · `crate_ram` 0/252 · `crate_rammed` 0/220.

Measured with my own probes on the real shader (transform feedback of `anim2Glsl()`, the cast's elbow, every 0.05 s or finer), on the
mannequin, `bubble_goose`, `old_furcoat`, `old_hoodie` over `old_denim_turnup` (baggy), and `tall_tee` with `nines_fitted`:
- **Fists on the crate:** ≤ 0.04 mm off their targets (the leads' on the handles, the partners' on the edge), every state they hold it.
- **Floating:** 0 states with the crate off the ground and a fist off its handle; the crate's lowest corner never below the ground.
- **The seams (every vertex, the walker moved by the shift):** `crate_lift`, `crate_tug`, `crate_ram` → `crate_run` ≤ 0.003 mm;
  `crate_run` standing → `crate_ram` ≤ 0.0023 mm; `crate_rammed` → `shove_fall` 0.0001 mm; `crate_tug_lose` → the plain stand 0.0002
  mm. The crate across the seams ≤ 0.0005 mm.
- **The heads (separating-axis test on the two head boxes, the chain into `shove_fall` followed):** ≥ 9.6 cm apart in the tug, ≥ 6.9 cm
  in the ram (closest at the contact).
- **The body in the crate:** the fists overlap its end faces where they close on the rope handles (≤ 60 mm, the mitten round the
  handle); the knees, thighs and shins 0 on the mannequin and the baggy denim; the padded tops press into its back face (Bubble Goose
  ≤ 42 mm running, ≤ 75 mm in the tug; the fur coat ≤ 55–75 mm), as the work and heist props do on those jackets.

## Sheets (`shots/grab/`)

Look at these first:
1. **`crate_tug.jpg`**: the scramble close up (side, front, three-quarter): the lift, the loser hooking the edge, the lean-backs and
   head tips of the surges, the twist free, the loser reeling back.
2. **`filmstrip-25m-side.jpg`**: all four scenes at the city's pixel size from the side quarter: the crate on the ground, lifted,
   carried; the tug; the ram's knockdown.
3. **`crate_ram.jpg`**: the ram pair close up: the grab, the rip, the ram, the knockdown into `shove_fall`.

All of them:
- `<clip>.jpg` (the six): the lab's sheet URL (`&scene=clip&clip=<name>&strip=12&cols=6`), 12 frames, side, front and three-quarter.
  The partners' sheets (`crate_tug_lose`, `crate_rammed`) play their lead's scene with the cameras on the partner (side, its own
  front three-quarter, and top: a face-to-face partner's front is hidden behind its lead's head).
- `filmstrip-25m-{side,front,back}.jpg`: the city distance (the moods group's method): ~25 m, fov 22° on 640 × 360 tiles (the city's
  pixel size at 1080p and fov 60°), 38° down, cropped and shown 2× nearest, 12 frames over each scene.
- `grab-25m.webm`: the three scenes in a line at the city distance, 7 s. `lift-close.webm`, `tug-close.webm`, `ram-close.webm`: close.
- `looks.jpg`: the lift, the tug and the ram on three dressed looks (`corner_hoodie` / `ash_sweats`; `bubble_goose` / `raw_indigo` /
  `cornrows`; `tall_tee` / `stoop_jorts` / `nines_fitted`).
- **They were shot through a staging copy of the lab** (scratch, not committed) that draws the crate by the city's rule above (the clip's
  crate while its weight is ≥ 0.6, else the set piece on the ground) and enters `crate_run` and `crate_ram` at full weight, as the city
  does from the hold. `lab.js` itself draws a clip's prop whatever the weight, so in the lab `crate_ram`'s crate floats in front of
  the holder for its first 0.15 s and `crate_run`'s between plays (the lab's prop display is being fixed elsewhere).

## Open items

- **Setting it down** isn't authored: a carrier stopped in view loses the crate as `crate_run` blends out. A reverse lift
  (`crate_set_down`, ending with the crate on the ground at a known spot) would close it.
- **From behind, the carrier hides the crate** (his head and back), as the drill is hidden at the heist; frame carriers from the front
  or the side.
- **Peaked caps meet in the pairs:** a cap's brim reaches 0.65–0.85 m in front of the walker (the bare face 0.45), so the brims cross
  in the tug and the ram's tussle, as in every face-to-face pair at these gaps (`vault_shove`, `scuffle_pair`, the talks at 1.2 m).
- **Padded tops** (Bubble Goose, the furs) press 4–7.5 cm into the crate's back face; the arms can't hold it further out.
- **The other outcomes** aren't authored: the tug's loser keeping it (the city makes the winner the lead), a crate dropped in a fight.
- **Not run:** the full clip gates (every bottom × every shoe, the see-through gate on every look). The quick gates and the probes on
  five looks are above.
