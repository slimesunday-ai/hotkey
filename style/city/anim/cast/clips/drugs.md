# Drugs: taking a dose, the crash and the withdrawal (the drugs agent, 2026-10-15)

Five clips in `drugs.js` (group `drugs`, family `moods`) and one model file, `drugs-props.js` (the dose packet). They stage GAME.md §11's drugs in the city's day (§20): the dose going down, the crash the day after TEMP, and the withdrawal of a hooked agent without its drug. The visible highs (`high.js`: wired, spaced, guarded) were already built; nothing here changes them.

- **Nothing outside the group changed.** `index.js`, `CLIPS.md`, `lab.js`, `high.js` and every other group are as on main (7355dd1). The 87 older clips keep their ids 0–86. The drug clips are 87–91, in registry order: `dose_take`, `crash_walk`, `crash_slump`, `withdrawal_shake`, `withdrawal_walk`.

## One look for every drug

slime's call is that a drug's name never shows live. So:
- **The dose is one gesture and one packet.** TEMP, TRUTH, HALLU, FIREWALL, CLEAR and SUDO all go down the same way, from the same packet: one model, one colour scheme (`SCHEME`: a pale clear baggie, white pills, a red zip strip), no label, no colourways, no per-drug shape or size.
- **Nothing here takes a drug.** No clip, prop or function has a drug parameter. The city must not tint, label or swap anything by drug (the packet, the pills, the zip, the clips' timing).
- **The crash and the withdrawal are one look each.** Every crash looks the same, and so does every withdrawal, whatever the drug. When the city plays them is the rules' business: GAME.md makes a drug's name public once it wears off, and the crash comes the day after TEMP has worn off.

## The clips

| clip | length | kind | prop | the beats (clip time, s) |
|---|---|---|---|---|
| `dose_take` | 2.5 s | one-shot, standing (`moving: false`) | packet (+x hand) | the +x hand to the hoodie's front pocket 0–0.3, digs 0.3–0.46 (the packet appears inside the fist at 0.42), comes out and up (the packet slides out of the fist 0.5–0.72), under the mouth at 0.8, pops up to the lips 0.82–0.93 as the packet slides back into the fist (the pill goes in; the packet hides at 1.0), the head tossed back 1.0–1.12 (the swallow), a gulp 1.3–1.5, a shudder and a shake of the head 1.75–2.3, the plain stand by 2.5 |
| `crash_walk` | 4.8 s | loop, walking overlay (`moving: true`, `speed: 0`, `stride: 1`) | none | slumped (the chest forward 0.13, the head hanging 0.22 more), the arms dead (straight down, a small late swing, soft elbows); at every step's landing (u ≈ 0.1, 0.6) the head and shoulders drop and the arms jolt; the weight rolls heavily onto each leg; the head lolls over to one side and the other; nods off 2.3–3.4 and jerks awake 3.4–3.52 |
| `crash_slump` | 8 s | loop, stand | none | the knees soft, slumped, the head hanging, the arms dangling, a slow heavy sway from leg to leg (once a loop), the head lolling; a big sigh 0.6–2.4 (the chest and head come up, then fall further); nods off 3.4–5.2 and jerks awake at 5.2, sinking back by 6.8 |
| `withdrawal_shake` | 6 s | loop, stand | none | sick: hunched over the stomach, the knees bent, rocking forward and back (twice a loop), the feet stepping in place (each foot 8 times a loop); one forearm clutched across the stomach while the other hand holds the side of the head and scratches at it in bursts (the +x hand 0.5–3.1, the −x hand 3.05–5.9: a hand is at the head most of the loop); a constant fine shiver (~9 Hz) and two hard shudders (1.2–1.6, 4.0–4.4); quick glances 0.08 (+x), 1.75 (−x), 4.5 (+x), 5.88 (−x) |
| `withdrawal_walk` | 4.8 s | loop, walking overlay (as `crash_walk`) | none | the stand's look on the walk's legs: hunched, the head down, a forearm clutched across the stomach, the other hand at the side of the head (the +x 0.3–2.55, the −x 2.5–4.75), the shiver, shudders 1.0–1.4 and 3.4–3.8, glances 1.2 (−x), 3.45 (+x) |

- **Blends:** `dose_take` 0.15 s in, 0.3 out (it starts and ends exactly on the plain stand: 0.000 mm on the real shader, so the walker's own idle takes over with no pop). The loops 0.4–0.7 s.
- **Loops are seamless.** Every rhythm divides its loop, and every keyed beat is back to its start by the end. Measured on the real shader (every vertex, 0.1 ms before the wrap against t 0, 3 looks): `crash_walk` 0.026 mm, `crash_slump` 0.015, `withdrawal_shake` 0.12, `withdrawal_walk` 0.10 (the fast shiver's own motion in 0.1 ms).
- **The overlays follow high.js's convention** (CLIPS.md § Moods and reactions): they write no `cLegK`, `cMov`, `cRot`, `cPiv` and none of `P.ank`, `P.fp`, `P.drop`, `P.bodyX`, `P.pRoll`, `P.turnRoll`, `cFoot`, `aFootRoll` (static check: clean), only the chest, the head and the arms. Their legs are the walk's bit for bit: every leg vertex on the real shader against the plain walk, 0 m over 192 states a look (2 step sizes × 3 walk weights × 8 phases × 2 clip times × 2 clips) on 3 looks. Everything that rides the walk is scaled by its weight `w`, so a walker that stops mid-clip eases into the clip's standing version.

## How the city plays them

### Which look, when (a proposal: the city's call)

Each agent shows at most one of these at a time. When two apply, the one higher in this list wins:

1. **`dose_take`**, when the record says a dose goes down (a one-shot).
2. **The high** (high.js's family: `wired_*` for TEMP and SUDO sold as TEMP, `spaced_*` for HALLU and CLEAR, `guarded_*` for FIREWALL; TRUTH shows nothing). A dose taken today masks a withdrawal or a crash.
3. **The withdrawal** (hooked, and a day without its drug): `withdrawal_walk` / `withdrawal_shake`. It wins over the crash when both apply (a TEMP-hooked agent's first day without TEMP): it is the hook's tell, and rarer (46 in 40 bench seasons against 288 crashes).
4. **The crash** (the day after TEMP): `crash_walk` / `crash_slump`.
5. The plain walk and idles.

### Switching

- **Walking or standing**, as for the moods: the overlay while the agent walks (`playClip(w.g, 'crash_walk')`), its stand when it stops (`'crash_slump'`), switched at the stop or the start through `stopClip` and `playClip`. Each blends from the bare walk or stand. Don't move the walker for an overlay (speed 0): its own route does.
- **Taking a dose:** stop the walker (`g.w = 0`), `stopClip` anything playing and let it blend out (a switch mid-play pops: the slot holds one clip), then `playClip(g, 'dose_take')`. It ends in the plain stand by itself (no `shift`, no `hold`), and the high's stand (or walk) starts from there.
- **The day turning over** (a high wearing off, a crash day starting): switch at the agent's next stop or start, through `stopClip`.
- **The pace** (the owner's, not the clips'): walk a crashed agent slowly, about 0.8 m/s, on its own step size (`crash_walk.jpg` walks it at 0.85 m/s; the 25 m line-ups walk everyone at 1.1); a withdrawing one at its usual speed, with the moods' step factor `g.aK` about 0.85 if the city wants the steps short and restless. Neither clip touches `aK`.
- **Held things:** these clips own both arms (as the moods do). Hide a held thing while one plays, or skip the clip for a walker holding something.

### The packet (`drugs-props.js`)

- **The model:** `GRAIN` (0.025), `PACKET` (`origin` [0, 0, 0] its bottom edge's centre, `top` [0, 0.125, 0], `w` 0.1, `len` 0.125, `d` 0.025), `SCHEME`, `packetCells()` (`[x, y, z, colour, layer]` for the icon baker), `packetGeometry(THREE)`, `packetMatrix(THREE, pose, out)`, `packetPoint(pose, q)`. About twice a real baggie, as the fist is twice a real hand.
- **`dose_take`'s `prop`:** `{ id: 'packet', geometry(THREE), pose(t), matrix(THREE, t, out), top(t), track(t) }`, the phone's contract (CLIPS.md, react.js). `t` is the clip clock, `state.t`.
  - `pose(t)` → `{ p, R, show }`: the packet's origin and its axes (column-major 3×3) in the walker's body frame. `matrix` is collapsed onto `p` while `show < 0.5`.
  - To world: the walker's matrix (ground point, yaw) × `matrix`. Draw it while the clip's weight is ≥ 0.6 and `show` ≥ 0.5.
- **It never floats.** It appears at 0.42 s inside the closed fist at the pocket, slides out between the thumb and the fingers as the hand rises (0.5–0.72), slides back into the fist as the fist reaches the mouth (0.82–0.93), and disappears inside the fist at 1.0.
- **It rides the fist exactly.** The clip's body is one track of expressions valid in GLSL and JS (react.js's `film_phone` method), and the CPU runs walk2.js's forward kinematics to place the packet. Measured against the real shader's hand every 0.05 s: ≤ 0.0002 mm, the axes to 1.6e-6.
- **Clearances** (every 0.02 s while shown, 3 looks): never inside the head or the chest; its tip comes within 2.2 cm of the head at the lips (0.84 s).

## How they are built (for the next agent)

- **The reach.** The toon arm reaches 0.403–0.453 m from the shoulder (elbow ≤ 1.45 rad); the face is 0.45 m ahead of it.
  - **The mouth is out of reach** from the front: a fist in front of the face's centre is ~0.5 m from the shoulder. The fist meets the mouth at the head's bottom edge, 0.1 m in front of the face (chest frame (0.30, 0.86, 0.44); the grip at head frame (0.12, 0.86, 0.52)), with the head turned 0.38 to it. Found on the real shader over sweeps of targets, poles and head turns: 0 hand vertices in the head and 0 hand triangles crossing it through the pop (0.7–1.3 s, 4 looks), no arm crossing the head on the bare body. Dipping the head to the fist put the chin's edge into it (3 vertices, 1 cm, at a 0.06 dip); a raised elbow put the upper arm under the turned head's side.
  - **No folded arms** (the talk agent's finding). The clutch across the stomach is the closest the reach allows: the hands at chest frame (±0.14, 0.69, 0.38), a little in front of and above the hoodie pocket.
  - **A hand on the side of the head** targets a point of the HEAD's rest frame, (±0.6, 1.06, −0.03), the elbow down and out, so it rides the head's shiver (falls.js `onHead`: cower's method). It goes up and down through a point out at the side (a straight blend from the belly cuts inside the reach). The temple is out of reach (0.53 m).
  - **The elbow's pole rides the head too** (pole (0.7, −0.7, 0.3) in the head's rest frame), so the whole arm turns with the head and the fist keeps its place on it through a glance. With the pole fixed in the chest, a glance during a hold bent the arm round and pushed the fist into the head (8 vertices, 3.7 cm). Now a hand vertex touches the head in 2 of 121 stand states and 4 of 97 walk states, ≤ 7 mm; the rest of each hold the hand sits 1.5–6 cm off the head's side.
- **The head can pitch only ~0.33 rad on the chest** before its chin's edge meets the chest's top corner (bare body; 0.38 put 36 chin vertices in). So "head low" is the chest leaning: the crash leans the chest 0.13 and hangs the head 0.22 more. A first crash walk leaned the chest 0.24: the big head swung 0.4 m ahead of the feet and the walker looked like it was diving.
- **The hand gate caught the first `crash_slump`:** the dangling hands brushed the thighs on every bottom (up to 54 crossings a state, through most of the loop) as the hips swayed. The arms now hang rolled out 0.15 with the sway's roll added to the downhill arm, and the sway is two thirds as wide.
- **The 25 m read** (the city camera, ~38° down): most of the figure is the head. The families differ by the head's attitude first, the arms second:
  - the highs show the face (wired: the chin up, fists out; spaced: the face to the sky, loose arms) or the crown with the hands in front (guarded: big slow head turns);
  - the crash shows the crown, lolling side to side, with no hands in front, and once a loop the face snaps up as it jerks awake;
  - the withdrawal shows the crown, hunched lower than guarded, a hand up at the side of the head most of the loop, the body rocking and the feet stepping.

## Checks (port 5367; this branch on ai-city-fresh main 7355dd1)

- **`FRESH_URL=http://127.0.0.1:5367 node style/check.mjs clips --quick --jobs 2`: PASS (exit 0)**, on the final files (their hashes unchanged through the run). 14 jobs in 4 steps:
  - **End frames** (`clips/end-check.mjs`): PASS. On every frame the CPU and the shader agree whether each one-shot has ended.
  - **Elbow identity:** PASS within 1e-6 m (max 1.19e-7) over 11,200 look-states. The drug clips are listed as bending by design: `dose_take` 49/51 states, elbow ≤ 1.36 rad · `crash_walk` 97/97, ≤ 0.24 · `crash_slump` 161/161, ≤ 0.12 · `withdrawal_shake` 121/121, ≤ 1.45 · `withdrawal_walk` 97/97, ≤ 1.45. All are under the thick sleeve's soft cap (85°); the withdrawal's shiver is clamped to the IK's 1.45.
  - **Hands** (`lower-motion-check --quick --clips`): 92 clips (6,163 states) × every fresh bottom on the plain shoe (68 fixtures), 11/11 shards, every count 0 (crossings, coplanar, opposite-leg, penetrations, leg/hand, foot/hand). PASS.
  - **See-through** (`overlap-check --gate '&dbg=back' --clips --quick`, the mannequin): 0 of 17,276 frames show inside faces. The drug clips: `dose_take` 0/116, `crash_walk` 0/244, `crash_slump` 0/380, `withdrawal_shake` 0/280, `withdrawal_walk` 0/232. PASS.
  - The first run of the gate (an earlier draft) failed the hand gate on `crash_slump` alone: its dangling hands crossed the thighs on every bottom (§ How they are built).
- **The hand gate on the full bottom × shoe matrix, the drug clips only** (a scratch copy of `lower-motion-check.mjs` with a clip filter, as the ride, talk and robbery agents ran theirs): the five clips (527 states) × every bottom and plain form × every shoe and the plain shoe, 4,662 fixtures (1,671 distinct leg/shoe geometries), 16/16 shards, every count 0. PASS. The other clips are unchanged.
- **On the real shader** (transform feedback of `anim2Glsl()`, the cast's elbow; scratch probes, not in the repo), on the bare body, `corner_hoodie` and `bubble_goose`, every 0.05 s:
  - **Hands against the head:** none in the head for `dose_take`, `crash_walk` and `crash_slump`. The withdrawal clips touch it in 2 of 121 (stand) and 4 of 97 (walk) states, ≤ 7 mm.
  - **Hands against the legs:** 0 crossings for every clip on these looks (the hand gate above is the real check, on every bottom).
  - **Forearm crossings into the chest, over the stand's own** (the arm's inner column grazing the chest's corner, CLIPS.md's baseline), a state on the bare body: `dose_take` ~1, the crash clips 0, the withdrawal clips ~20 (`guarded_stance` ~16 and `deal_lookout` ~18 by the same probe). On the puffer the clutched hands sink up to 6 cm into the padding.
  - **The packet:** on the hand to 0.0002 mm, the axes to 1.6e-6; never inside the head or the chest.
  - **The overlays' legs:** 0 m from the plain walk (§ The clips). **Seams:** ≤ 0.12 mm. **The dose's ends:** 0.000 mm from the plain stand.
- **A static check** of the overlays' generated GLSL: no root or leg channel (`cLegK`, `cMov`, `cRot`, `cPiv`, `P.ank`, `P.fp`, `P.drop`, `P.bodyX`, `P.pRoll`, `P.turnRoll`, `cFoot`, `aFootRoll`): clean.
- **Every older clip keeps its id** (0–86, `cook_fan` last). Only `drugs.js` changed in the tree, plus the new `drugs-props.js`, `drugs.md` and `shots/drugs/`.

## Sheets (`shots/drugs/`)

All on this branch's lab (port 5367), `corner_hoodie` / `ash_sweats` unless named. The 25 m files are the moods' city-distance method (`shots/moods/`): the lab's line-up at about 25 m, 38° down, fov 22° on 360-px-tall tiles (the city's pixel size at 1080p and fov 60°), every figure the same look so only the motion differs, each cropped and shown ×2 (nearest).

- **Look at these first:**
  - `filmstrip-25m-stands.jpg`: a plain stand, the three highs' stands, `crash_slump` and `withdrawal_shake`, 12 frames over 6 s.
  - `filmstrip-25m-walks.jpg`: a plain walk, the three highs' walks, `crash_walk` and `withdrawal_walk`, walking at 1.1 m/s, 12 frames over 4.8 s.
  - `dose_take-mouth.jpg`: the packet and the pop, 0.6–1.5 s every 0.08 s, from a close camera at the +x front.
- **Every clip's contact sheet** (CLIPS.md's lab URL through `style/shoot.sh`; the clip scene's side, front and three-quarter cameras, 12 frames each): `dose_take.jpg` (0.1–2.3 s), `crash_walk.jpg` (one loop at 0.85 m/s), `crash_slump.jpg`, `withdrawal_shake.jpg`, `withdrawal_walk.jpg` (one loop each).
- **The city distance, more:**
  - `filmstrip-25m-stands-L2.jpg`, `filmstrip-25m-walks-L2.jpg`: the same line-ups on `bubble_goose` / `raw_indigo` with `fro` hair.
  - `filmstrip-25m-dose.jpg`: `dose_take` between a plain stand and `guarded_stance`, 0.2–2.4 s.
  - `stands-25m.webm` (8 s), `walks-25m.webm` (6 s), `dose-25m.webm` (4 s): the line-ups moving, 25 fps, ×2, labelled. The shiver, the stepping, the heavy bob and the nod-offs only show in motion.
- **`looks.jpg`:** each clip's busiest moments on three looks: the hoodie, the puffer (`bubble_goose`), and `tall_tee` / `stoop_jorts` with `locs` and a fitted cap.

## Open items

- **The fist can't reach the mouth itself.** It meets the mouth at the head's bottom edge, 0.1 m in front of the face, with the head turned to it, then the head's toss sells the swallow. From the city's high camera the fist sits over the lower face; from a level camera it reads as a fist at the chin. A real hand-to-mouth needs a longer arm or a smaller head.
- **A slumped sit or a lean on a wall is not built.** `crash_slump` stands free, so it plays wherever a crashed walker stops.
  - Sitting is what the legs support best: `sit_stoop`'s kerb seat (the pelvis 0.23 m down, the feet 0.2 m forward) already works with the city's kerb spots. A `crash_sit` (that seat, the head down over the forearms, nodding off) can start from it.
  - A slide down a wall can't be built: the leg cloth wants the hip ≥ ~0.12 m over the ankle, so there is no deep squat (CLIPS.md, get_up). A plank lean like `lean_wall`'s, sagging, could be built for the city's wall spots.
- **Long hair at the sides** (`locs`, `box_braids`, `old_long`) takes in the withdrawal's hand at the head through most of each hold: up to 65 hand vertices, 10 cm deep (`old_long` 50, 8.8 cm), where `lie_hurt`'s hand goes 5 cm into them. The hand is under the hair, which reads as holding the head through it. Big hair that sits on the head (`fro`, `old_afro`) and hats (`old_fuzzbucket`) take ≤ 5 vertices, 5 mm. Holding the hand clear of the long hair (8–10 cm off the side) leaves it floating beside a bald head, where it reads as a wave.
- **The puffer swallows the clutched hands** (`bubble_goose`: up to 6 cm into its padding through the withdrawal clips, 2.2 cm at the dose's pocket), as it does deal-hang's pocket and the talks' forward hands (CLIPS.md).
- **The withdrawal's clutch grazes the chest's corner** on the bare body (about 20 forearm crossings a state, against `guarded_stance`'s 16 and `deal_lookout`'s 18 by the same probe; none on the hoodie): the arm's inner column, the hands as close in as the reach allows.
- **The packet's display in the lab:** another worker is fixing `lab.js`'s prop display. These sheets show the packet as the current `lab.js` draws it (the playing clip's `prop` at the clip clock). The city should draw it from `state.c.prop` at `state.t`, at the walker's matrix, while the weight is ≥ 0.6 and `show` ≥ 0.5.
- **City side, to build:** the switching above (the state per agent, the priority, the stops and starts), the crash's slow pace and the withdrawal's step factor, hiding held things, and the packet's mesh.
- **CLIPS.md** has no drugs section. The registry owner may want the table above in it.
- **The see-through gate on every look** (`check.mjs clips` without `--quick`) was not run: the drug clips' see-through ran on the mannequin only (the quick step). Their hand gate ran on the full matrix (above).
