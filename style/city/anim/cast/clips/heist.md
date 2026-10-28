# The heist clips (group `heist`, family events)

The vault heist at Precinct 9 (GAME.md §7, §13, §20): a crew with a forged warrant fights the vault's guards, drills and heaves the
Evidence Vault's door, and carries the loot out. Six clips in `heist.js`, two props in `heist-props.js` (the drill and the loot sack).
Nothing else changed: the other 68 clips keep their ids (the group is appended in `index.js`'s order) and their GLSL.

## The clips

| clip | length | kind | moves | partner / chain | prop | the beat |
|---|---|---|---|---|---|---|
| `vault_drill` | 4 s | loop | no | none | drill | braced at the door, a big drill in both fists, the bit in the door at the belly; it shudders, two hard pushes, backs the bit out and peers at the hole, runs it back in, a glance over the shoulder; sparks while the bit is in |
| `vault_heave` | 4.6 s | one-shot | root: 0.9 m back (`shift [0, −0.9]`) | none (the door is a set: `door.open(t)`) | none | both hands on the door's wheel, steps up and tips back on his heels, two heaves, the door gives, he walks it open, lets go, staggers back out of its swing, a fist pump |
| `loot_carry` | 3.2 s | loop | yes, 1.5 m/s (stride ×1.15) | none | sack | a stuffed cream loot sack with a green $, its cinched neck in the +x fist up by the head, the sack hanging down behind the +x shoulder; leaning into it, short heavy steps, the free arm pumping; the sack bounces and settles with every step and hangs back against the sway; a hitch of the sack, a heavy dip |
| `vault_shove` | 2.7 s | one-shot | root: 0.3 m on (`shift [0, 0.3]`) | lead of `guard_bowled` (gap 1.2 m, facing, the same start) | none | the jobber: a juke, steps in, the clinch, rips the guard's arms down, a two-hand shove (contact at 1.75 s), follows through, shakes it off |
| `guard_bowled` | 1.75 s | one-shot | root: 0.03 m on (`shift [0, 0.03]`) | partner of `vault_shove`; `next: shove_fall` (→ `lie_hurt`) | none | the guard: stamps into a wide block, catches the jobber in the clinch, gives a little, his arms ripped down, the plain stand at the moment of the shove, which chains into falls.js's knockdown |
| `lookout_wave` | 3.2 s | loop | no | none | none | on the balls of his feet, bouncing; scans the street both ways, then looks back at the crew over his +x shoulder and waves them on with two big arm sweeps |

Every number the city times on is on the entry (`dur`, `loop`, `next`, `shift`, `pair`, `speed`, `stride`, the blends). The timelines in
words are each entry's `note`.

## How they're built

- **One track per clip** (work.js's method): every channel (the body, the feet, the root, the eyes, each hand's target or free angles,
  each prop's pose, the door's angle) is one scalar expression valid in both GLSL and JS. The shader poses the body from it; the CPU
  evaluates the same strings for the props, the door and the sparks (`clip.track(t, u, w)` returns every channel and var). A fist and its
  prop cannot part: each fist is put ON its target by a two-bone IK on the elbow (talk-patrol.js / work.js's), measured on the real shader
  within 0.043 mm of its target: the drill's two grips, the sack's neck, and the door's wheel all the time it's held.
- **The toon arm reaches only 0.40–0.45 m from the shoulder, and the big head owns everything above y 0.95 inside x ±0.4.** So:
  - the drill is held at the belly, 0.3–0.35 m ahead: both fists fit the reach shell only there, below the chin;
  - the heave's wheel grips are 0.4 m ahead at y 0.70; leaning back 16° keeps them in reach only because the feet step up to the door's
    foot (the toes 3 cm off its face); and the wheel's top rim passes just under the chin, so he lifts his chin as he walks the door
    back;
  - the sack's fist sits beside the head's lower corner (x 0.59), outside it: the mitten points back at the head, so its inner edge is
    0.17 m inside the grip point. The sack's neck runs straight back from the fist, outside the head's back corner, to the tie, and the
    body of the sack hangs below the head's bottom or behind its back face.
- **The heave's lean** tips the whole body back about the heels (the root's pitch about the heel line, as falls.js sits; the toes come
  up, the heels dig in). That angled big head is what reads at the city's distance; a chest-only lean didn't.
- **The heave's root** keeps the shoulders 0.42 m behind the wheel's grips through the lean, the step-up, coming upright and the door's
  swing: `m = (the grips' mean z) − 0.42 + 0.8 × the root's pitch + 0.33 × the chest's`.
- **The fight's distance is set by the heads.** Face to face the walkers need ≥ 0.8 m (both fronts at z 0.40); the guard's head
  overhangs his chest by 0.25 m while the jobber's fists lead his own head by only 0.1 m, so a straight-arm shove can't reach the chest
  without the heads meeting. The shove lands at the guard's chin line at the chain point (the jobber 0.14 m in), and the rest of the
  lunge happens as the guard snaps back. Measured on the real shader, the two heads never overlap: the closest is 6.5 cm apart at the
  contact (rob_lunge_grab's closest is 1.9 cm).
- **The arms after the hands leave the door** ride the body (an IK target in the root's own frame, blended in as they let go), so the
  release, the stagger and the fist pump never Euler-blend a bent arm through the chest.

## What the city must stage

### The vault door (a set at Precinct 9; place it before the crew arrives)

- **Spots are given relative to the walker's ground point and heading at the clip's start** (the body frame: +z ahead, y up, and the
  sides named by their sign, "+x" and "−x", as every clip file does: the code labels −x "L", but facing +z that is the walker's right, so
  left and right are avoided here):
  - **the heave spot:** the door's face 0.52 m ahead (`vault_heave.door.face`); the wheel's centre at (0, 0.70, 0.40) and its two
    grips (where the fists close) at (±0.2, 0.70, 0.40), so the wheel stands 0.12 m off the face; the hinge's vertical axis on the −x side,
    0.95 m out, on the face's plane (`door.hinge` [−0.95, 0.52]). **Keep the wheel's radius ≤ 0.2 m:** its top rim passes 3 cm under the
    walker's chin at the start (the wheel's plane is level with the head's front face).
  - **the drill spot:** the door's face 1.01 m ahead (`vault_drill.door.face`), the bit going in at (0.12, 0.70) on the face
    (`door.at`). Drill the lock beside the wheel, not the wheel: with the bit 0.3 m to the +x of the wheel's centre (as in the preview),
    the driller stands 0.18 m to the +x of the heave spot's line and 0.49 m further back.
- **The door I checked the clearances against** (a stand-in, drawn in `shots/heist/vault_drill-door.jpg` and `vault_heave-door.jpg`):
  round, 1.56 m across (radius 0.78), centred 0.8 m up, 0.25 m thick behind its face, the hinge 0.17 m outside its edge; its wheel a
  0.2 m ring with spokes. A bigger door or wheel needs the clearances re-measured (below).
- **Swinging it:** turn the door about the hinge's vertical axis by `vault_heave.door.open(t)` (rad, + swings the free side toward the
  walker; t = the clip clock, `state.t`): 0 until 1.75 s; it gives and opens 0.3 rad by 2.4 s while he walks it back; after he lets go it
  swings on by itself to 0.55 rad (32°) by 3.7 s and holds.
- **Why it stops at 0.55 rad:** a swinging door sweeps everything within its width of the hinge (this one's far edge reaches 1.7 m), and
  the rig can't step sideways, so the walker can only back straight off. Measured against the stand-in, the door and its wheel stay
  ≥ 3.0 cm from his head and ≥ 16.8 cm from his chest at every frame, and ≥ 14 cm from his head once it has swung to 0.55 rad. A wider
  swing reaches him: **swing it wider only once he has walked off his end spot** (to open it fully he'd have to be about 1.3 m back).
- **The wheel doesn't spin** in these clips (no dial or wheel-turn beat: the heave grips its rim either side of the hub and pulls).

### The drill (`heist-props.js`, model `drill`)

- `vault_drill.prop` is the CLIPS.md prop contract: `prop.geometry(THREE)`, `prop.matrix(THREE, t, out)` (local → the walker's body
  frame at the clip clock; × the walker's world matrix), `prop.pose(t)`. Teal body (a yellow or orange one read as the tan hands holding
  it), black grips and vents, a steel bit.
- **Show it while the clip's weight is ≥ 0.6** (the gun's rule). It is 0.78 m long; the tip is at `HEIST.drill.tip` (0.65 m ahead of the
  grip).
- **Sparks:** `vault_drill.sparks(t)` → `{ p, d, on }`: the bit's tip (body frame), the spray's direction (back toward the driller and
  up) and whether the bit is in (1 from 0 to 1.9 s and from 2.9 s; 0 while he backs it out and peers at the hole). At the city's distance
  the head hides the drill from behind and from above, so **the sparks are what says "drilling"**: make them loud (a hot-white core,
  orange streaks, a flicker on the door) and give the drill a whine.
- After drilling: `stopClip` (it blends out over 0.35 s), drop the drill at his feet (or hide it), then the heave can start from the
  heave spot (0.49 m closer, the crew member steps in; or a different crew member heaves).

### The heave

- Start `vault_heave` with the walker on the heave spot, stopped (walk weight 0). It blends in from the stand (0.2 s).
- On the end frame (`state.shiftNow`), move the walker 0.9 m back along its heading (the CLIPS.md root-motion rule); it ends in the plain
  stand. The door's swing and the clip run off the same clock.
- The **open vault**: the gap the door opens (the dark round opening behind it) is what the crew walks into next; light spilling out of
  it would sell "the vault is open" from far away.

### The loot (`heist-props.js`, model `sack`)

- **The sack (the refine pass, 2026-10-16).** slime: "the loot carry is a bit off like the sack looks weird and should have a bit of
  movement".
  - **Before:** a speckled egg (0.68 × 0.72 × 0.56 m) stuck straight back behind the head at the fist's height. It was rigid in the
    chest's frame, and in the lab it was frozen at the walk's phase 0, so it never moved.
  - **The shape now:** the neck is gathered and twisted in the fist, with a rope tie. Under the tie the body hangs down behind the
    +x shoulder: pear-shaped, round under the gathered top and fullest low, flatter on the side that hangs against the back, and
    lumpy. Five creases run down from the tie, and the bottom is shaded. At rest it spans the chest frame's x 0.14…0.77, y 0.35…1.07 and
    z −0.80…−0.20 (the fist on the neck at z −0.22), and shows 0.25 m past the head's side from the front.
  - **The motion now:** it turns about the neck's tip in the fist (the IK's target), so the fist and the sack never part.
    - Each step it settles a beat after the pelvis's low point (gait2.js: u 0.125 and 0.625, the settle at +0.08): the fist gives
      1.2 cm and the sack swings 0.08 rad down, then floats back up as the body rises.
    - Side to side it hangs back against the sway and the chest's twist: roll ±0.06, yaw ±0.035 rad, a beat late. It stays put in the
      world while the body moves under it.
    - On the hitch (0.5–0.95 s) it lags as the fist jerks it up, then swings up past rest and settles. On the heavy step (1.7–2.3) it is
      left behind, then lands hard.
    - Every term is periodic in the walk's cycle or zero at the loop's ends, so the loop stays seamless.

- `loot_carry` is a MOVING clip at 1.5 m/s (stride ×1.15): the owner moves the walker at `speed` (as `run_getaway`), the walk's legs run
  under it. Any crew member can carry; give each carrier one sack.
- **The sack rides the chest:** pass the walker's gait state to the prop: `prop.matrix(THREE, t, out, g)` (as `carry_box`): it follows the
  walk's pelvis bob, sway and roll and the turn's lean. Without `g` (the lab's preview) it assumes a steady walk.
- **Colourways:** `heistGeometry(THREE, 'sack', 'green' | 'grey' | { canvas, shade, ink })`; the default is cream with a green $ on its
  outer side and its back. From behind and from the sack's side it's the loudest thing on the walker; from the front it peeks out behind
  the head.
- **Hide anything held** while carrying: the clip owns both arms (the held-item hand would ride the sack's fist).
- **The carrier's head doesn't turn** (no glance): the sack boxes it in. If the city's head springs turn it (a look-at), keep them under
  ~0.2 rad, or the head's back corners meet the fist or the sack.
- **Known brushes:** long hangers pass through the sack's front (`hair:old_long` hangs into it, as the ride props list for the bike):
  those looks wear the sack over their hair.

### The fight (the guards' defence)

- Place the guard 1.2 m in front of the jobber, facing it, and start both on the same frame: `playClip(jobber, 'vault_shove')`,
  `playClip(guard, 'guard_bowled')` (that is the entry's `pair: { with: 'guard_bowled', gap: 1.2, delay: 0 }`).
- The guard's chain is automatic: `guard_bowled` (1.75 s) → `shove_fall` (1.5 s) → `lie_hurt` (loop). Apply each one-shot's `shiftNow`
  on its end frame: 0.03 m (guard_bowled), −0.36 m (shove_fall). The chain into shove_fall is exact (measured below).
- The guard lies hurt until the scene moves on. `get_up` works from there (switch at a `lie_hurt` loop seam, falls.js's rule).
- The jobber moves 0.3 m on (`shiftNow` at 2.7 s) and ends in the plain stand: then it walks around the downed guard to the vault.
- **A crew that LOSES** (GAME.md: everyone in the job is arrested): not authored here. Use the existing ones: `scuffle_pair` /
  `scuffle_partner` for a longer struggle, then `cuff_apply` → `cuffed_idle` / `cuffed_walk` (arrest.js).
- Two or more guards: run more pairs side by side, ≥ 1.0 m apart sideways (the heads).

### The lookout

- `lookout_wave` stands at the precinct's street door (or the corner), facing the street; the crew comes out behind it on its +x side
  (it looks back over the +x shoulder and waves them on, the sweep pointing the way out along its own front). Turn the lookout so its +x
  side faces the building's door.
- Fine from any frame; blends in from the stand (0.3 s).

### A heist night, beat by beat (a suggestion for the director's cut)

1. The crew walks in (their walks; `guarded_walk` reads as "on a job"). The lookout peels off to the street door: `lookout_wave`.
2. The guards confront them at the vault: `vault_shove` ⇄ `guard_bowled` for each guard; extra crew can `scuffle_pair` other guards.
3. The driller at the drill spot: `vault_drill` for a few loops (4 s each), sparks flying.
4. The heaver at the heave spot: `vault_heave` (4.6 s); the door cracks open.
5. The crew goes in (the door can now swing wider), comes out with the loot: `loot_carry`, past the lookout, into the night.
6. If the crew loses: the guards win the scuffle and cuff everyone (arrest.js).

## The API (entry fields beyond CLIPS.md's)

- `clip.track(t, u, w)` (all six): every channel's value and the track's vars at the clip clock (the walk's cycle `u` and weight `w` for
  the moving clip).
- `vault_drill.door` `{ face, at }`, `vault_drill.sparks(t)` `{ p, d, on }`.
- `vault_heave.door` `{ face, wheel, hinge, open(t) }`.
- `prop` on `vault_drill` and `loot_carry`: `{ id, model, frame, geometry(THREE, scheme?), matrix(THREE, t, out, g?), pose(t, u, w), track }`
  (`frame` is 'body' for the drill, 'chest' for the sack).
- `heist-props.js`: `GRAIN` (0.025), `HEIST` (the drill's grip, side handle, tip; the sack's neck, bend, mouth (the tie), axis (its
  bottom) and r), `SCHEMES`, `SACK_SCHEMES`,
  `heistCells(id, scheme?)` (for the icon baker), `heistGeometry(THREE, id, scheme?)`, `heistMatrix(THREE, pose, out)`,
  `heistPoint(pose, q)`, `heistDir(pose, d)`.

## Checks (port 5361, this branch on ai-city-fresh main a62bbad)

`FRESH_URL=http://127.0.0.1:5361 node style/check.mjs clips --quick --jobs 2`: **PASS**, exit 0 (8 min 23 s wall), on the final code of
both files:
- **end check:** PASS (on every frame the CPU and the shader agree whether each one-shot has ended).
- **elbow identity:** PASS within 1e-6 m (max 1.19e-7 m) over 11,186 look-states where no elbow bends. The six here are listed as moving
  by design: `vault_drill` 81/81 states bend, elbow ≤ 1.41 rad · `vault_heave` 90/93, ≤ 1.45 · `loot_carry` 65/65, ≤ 1.21 ·
  `vault_shove` 53/55, ≤ 1.50 · `guard_bowled` 34/36, ≤ 0.60 · `lookout_wave` 65/65, ≤ 0.60 (all under the thick sleeve's ~105° stop).
- **hand gate** (`lower-motion-check --quick --clips`, every fresh bottom on the plain shoe): 74 clips (4,511 shader states) × 68
  fixtures (17 geometries), 8/8 shards: every count 0 (crossings, coplanar overlaps, opposite-leg, penetrations, leg/hand, foot/hand).
- **see-through gate** (`overlap-check --gate '&dbg=back' --clips`, the mannequin): 0 of 13,080 frames show inside faces. Mine:
  `vault_drill` 0/192 · `vault_heave` 0/200 · `loot_carry` 0/160 · `vault_shove` 0/124 · `guard_bowled` (and its chain) 0/240 ·
  `lookout_wave` 0/160.
- Every other clip keeps its id (0–67) and its GLSL: the heist group is appended (ids 68–73); `index.js` is untouched.

Measured with my own probes on the real shader (transform feedback of `ANIM2_GLSL`, the cast's elbow, every 0.05 s), on the mannequin,
`bubble_goose` and `old_furcoat`:
- **Fists on their targets:** within 0.043 mm (the drill's grips, the sack's neck, the door's wheel while held).
- **Hands in the head (the bare head box):** 0 vertices on every clip and look, except `old_furcoat`'s furry cuff on the drill at 0.5 s
  (7 vertices, ≤ 2.9 cm).
- **The pair's heads (separating-axis test on the two head boxes, the guard's chain followed):** never overlapping; the closest 6.5 cm
  apart, at the contact (the mannequin, `bubble_goose`, `old_hoodie`).
- **The sack against the body:** only its own fist inside it, on the mannequin, `bubble_goose` and `old_furcoat` (long hair: above).
- **The door (the stand-in above, swung by `door.open(t)`; its slab sampled every 4 cm, its wheel's rim every 7.5°):** nothing inside
  the posed head or torso at any frame of either door clip. The heave: the head ≥ 3.0 cm away (the wheel's rim under the chin at the
  start), the chest ≥ 16.8 cm, the head ≥ 14.2 cm in the last second; the drill: the head ≥ 28 cm (the bit is on the face, the head
  well back).
- **Seams and chains (every vertex):** the three loops' wraps ≤ 0.004 mm; `vault_shove`'s end → the stand 0 mm; `guard_bowled` →
  `shove_fall` 0.0001 mm (the walker moved by its 0.03 m shift); `vault_heave`'s end → the stand 0 mm (on the mannequin,
  `bubble_goose` and `old_hoodie`).
- **Forearm and hand vertices in the bare torso box (a frame, at most):** the drill 40 (the −x forearm across the chest's corner: its side
  handle is near the midline), the heave 48 (the second heave), the shove 8, the rest 0; on the Bubble Goose 86, 98, 24 and 0. The
  approved clips score 0–8 on this probe (dig_pick 147): this is the arm's inner column grazing the chest's corner whenever both hands
  work in front, and on the puffers the padded forearms press into the jacket's front, as in every clip with the hands forward.

### The refine pass (2026-10-16): the sack

Only `loot_carry` changed here: the sack's model (heist-props.js) and its pose and fist channels (heist.js). The gates over every clip
are in CLIPS.md § Refine. The sack against the body, by its own probe: the real shader by transform feedback, the lab's clip scene
(the lab's 1.5 m/s walk, every 1/60 s frame of one loop after the blend-in), the sack posed as the lab and the city draw it
(`prop.matrix(THREE, t, out, g)`), on six looks (the mannequin, `bubble_goose`, `old_furcoat`, `corner_hoodie` over
`blackout_cargo`, `gatehill_mink`, `old_puffer`):
- **Body vertices inside the sack's cells:** none, but the holding hand's on every look. Main's sack scored the same.
- **The head:** no head vertex inside the sack, and no corner of any sack cell inside the head's box (x ±0.5, y 0.9…1.7,
  z −0.35…0.45, posed with the head every frame). The closest is 0.5 cm. Main's sack reached 4.8 cm into that box, with 24,544
  cell corners inside it over the loop.
- **Long hair** (`hair:old_long`) still hangs into the sack's front: 44,202 hair vertices inside it over the loop (main 55,924).
- **The neck's tip on the fist's grip point:** ≤ 0.038 mm (main 0.037).

## Sheets (`shots/heist/`)

The refine pass: `loot_carry.jpg` is redrawn (the new sack; side, front and tq as before, plus the back quarter on the sack's side).
Its before and after are in `../refine/` (CLIPS.md § Refine). `filmstrip-25m-*.jpg` and `looks.jpg` still show main's sack.

Look at these first:
1. **`vault_heave-door.jpg`**: the heave against the stand-in door, side and behind: the reach, tipped back on his heels, the door
   gives, he walks it open, lets go and is clear when it stops, the fist pump.
2. **`filmstrip-25m-back.jpg`**: all of them at the city's pixel size from the back quarter, the door clips with the stand-in door:
   the door swinging out, the shove and the guard going down, the loot sack's $.
3. **`vault_shove.jpg`**: the fight pair close up (the block, the clinch, the rip, the shove, the guard's chain into the fall).

All of them:
- `<clip>.jpg` (the six): the lab's own sheet URL (`&scene=clip&clip=<name>&strip=12&cols=6`), side, front and the clip scene's tq
  camera, 12 frames each (a loop one period in, a one-shot from its start; `guard_bowled` alone plays its chain into the fall).
- `vault_drill-door.jpg`, `vault_heave-door.jpg`: the door clips against the stand-in door (drawn by a scratch copy of the lab page;
  the drill's sparks drawn from `sparks(t)`), side and behind.
- `filmstrip-25m-front.jpg`, `filmstrip-25m-back.jpg`: the city distance (the moods group's method): ~25 m, fov 22° on 640 × 360
  tiles (the city's pixel size at 1080p and fov 60°), 38° down, each figure cropped and shown 2× nearest, 12 frames; the front quarter
  without sets (from there the door's wall would hide the door clips), the back quarter with the stand-in door.
- `looks.jpg`: the clips on three dressed looks (the moods group's: a hoodie and sweats, the Bubble Goose and indigo, a tall tee,
  jorts and a fitted cap), four key frames each.

## Open items

- **The sack's blend-in (the refine pass):** the city shows a prop from a clip weight of 0.6 (the gun's rule). At that weight the
  carrier's +x fist is still 52 cm from the neck, low by the hip; it reaches it 0.1 s later, so for those frames the sack hangs by the
  shoulder on its own. A higher threshold for hand-held props would fix it (CLIPS.md § Refine, 1).
- **Drill at distance:** from behind and from above the big head hides the drill; the sparks have to carry it (above).
- **The door's full swing** is the city's, after the heaver has walked off (above). A dial or a wheel spin before the heave isn't
  authored (the heave pulls on the wheel's rim).
- **A losing crew** has no heist-specific takedown: the existing scuffle and cuff clips cover it.
- **The forged warrant** (shown at the precinct's desk) has no clip.
- **Not run:** the full clip gates (`style/check.mjs clips` without `--quick`: every bottom × every shoe and the see-through gate on every
  look). The quick gates and my probes on two puffers are above.
