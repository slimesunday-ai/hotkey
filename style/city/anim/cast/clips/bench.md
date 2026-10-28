# The Gunrunner's bench (`bench.js`, `bench-props.js`; 2026-10-15)

GAME.md §20 stages a Gunrunner's Build as "sparks at the Gunrunner's bench". A Gunrunner builds guns, lockpicks, fakes and forged warrants from parts, at home (§9, §38). These four clips are that show: hammering with sparks, fitting parts together, forging a warrant with a stamp, and testing a finished gun.

- **Files:** `bench.js` (the clips), `bench-props.js` (the hammer, the stamp and the bench's layout). The finished gun is `gun-prop.js`'s pistol, reused.
- **Nothing outside the group changed.** `index.js`, `CLIPS.md` and every other group are as on main (a62bbad). The 68 older clips keep their ids 0–67. The bench clips are 68–71, in registry order: `bench_hammer`, `bench_stamp`, `bench_assemble`, `bench_test_gun`.

## The clips

All four are STANDING clips (`moving: false`, no root motion, no `shift`). The walker stands on its spot at the bench, facing it.

| clip | length | kind | prop (hand) | the beats (clip time, s) |
|---|---|---|---|---|
| `bench_hammer` | 2.8 s | loop | hammer (+x) | `strikes: [0.6, 1.2, 1.8]`: the hammer's face hits the anvil |
| `bench_assemble` | 4.0 s | loop | pistol, the piece being built (−x) | none |
| `bench_stamp` | 3.4 s | loop | stamp (+x) | `slams: [1.08, 2.04]`: the stamp lands on the warrant. Ink dabs at 0.28 and 0.44 |
| `bench_test_gun` | 4.0 s | one-shot, `hold` | pistol, the finished gun (+x) | `rack: [1.05]`: the slide pulled back. `click: [2.2]`: a dry fire, with no flash |

- **`bench_hammer`:** the hammer rests face-down on the anvil at t 0. Three strikes follow (reworked in the refine pass, 2026-10-16):
  - each impact flat on the anvil, then a quick rebound (7 cm in 0.06 s);
  - the hammer lifted straight up off the work (its face 14 cm over the anvil, its head tipped up), then swung up and out past the +x
    shoulder, cocked beside the head 0.36 s after the impact, held 0.07 s;
  - the blow: swung down and in, faster and faster, to over the anvil (0.135 s), then snapped straight down onto it (0.035 s; its last
    two frames move 8 and 7 cm, 91–93 % of that downward).
  - The chest coils on the wind-up and drops into the blow; the head lifts to let the hammer pass under the chin and dips with the
    blow; at the impact the shoulders jolt and the knees give, then the head flinches from the sparks.
  - The −x hand steadies the work: it lifts off the bench (2.4 cm) and draws back through each wind-up, and is planted again with the
    blow.
  - From 1.95 to 2.78 s the walker leans in to look at the work, and the −x hand pats the bench. It rests again by 2.8.
- **`bench_assemble`:** head down over the piece, which the −x hand holds low over the bench.
  - 0.05–0.95 s: the +x hand goes to the parts tray, picks a part and brings it back.
  - It fits the part at the frame: two pushes along the barrel (1.0–1.4), screwing it in with small circles of the hand (1.45–1.95), two taps (2.05–2.45).
  - 2.55–3.35: the piece is lifted out to the −x side toward the lamp and turned in the light, the head turned to it.
  - Back to work by 3.8.
- **`bench_stamp`:** the stamp starts over the paper.
  - It is inked on the pad at the +x side with two dabs.
  - Then twice: lifted up beside the head, held a beat, and slammed down onto the paper through a low pass, so the fist stays under the head's corner. The knees give and the chest drops with it. The stamp is pressed, and rocked the first time.
  - 2.55–3.3: the walker reads the seal, head turned and tilted, while the −x hand smooths the paper.
- **`bench_test_gun`:** the finished gun stands upright in a small stand on the bench.
  - 0–0.38 s: the +x hand goes to it and lifts it out.
  - The walker leans back, head up, and the −x hand racks the slide: the pull at 1.05 s, the snap back by 1.2.
  - 1.35–2.55: the gun is sighted out along the arm to the front-right, with the chest and eyes turned to it. One dry click at 2.2.
  - 2.6–3.25: the gun is turned in the light and looked over.
  - 3.55–3.65: it goes back in its stand. The hands rest on the bench, and the clip holds until `stopClip`.

## The beats, for the city's effects

All the points below are in the walker's body frame (+z ahead, y up from its ground point, +x the side of its +x arm, which is the walker's left). Each prop's beat functions take the clip clock `state.t`; a loop wraps it itself.

- **Sparks (`bench_hammer`):** fire at each `strikes` time.
  - `prop.face(t)` → `{ p, n }`: the hammer face's centre and its outward normal.
  - At every strike it is `p` (0.204, 0.500, 0.670), on the anvil's top, with `n` (−0.003, −1.000, 0.003), straight down: the face lands flat. Spray the sparks along −n (up) in a wide cone, for about 0.15–0.2 s. (Before the refine pass: (0.200, 0.496, 0.672), `n` 9.4° off down. The strike times did not move.)
  - The stand-in sparks in the sheets are 22 cubes 4.5 cm across, about 0.2 s, yellow and orange. They are a stand-in, not a spec.
- **The seal (`bench_stamp`):** at each `slams` time.
  - `prop.seal(t)` → `{ p, n }`: the rubber's centre, (0.037, 0.440, 0.400), facing straight down, on the paper.
  - Put the red seal on the warrant at the first slam (1.08). A thump or a little dust puff at each slam is optional.
- **Rack and click (`bench_test_gun`):** sound cues at `rack` (1.05) and `click` (2.2).
  - `prop.muzzle(t)` → `{ p, d }`: where the gun points.
  - At the click it points out to the front-right, `d` (0.80, 0.09, 0.59). There is no flash: it is a dry fire.

## What the city must stage

The bench and everything on it are the CITY'S SET. `bench-props.js` `BENCH` holds every number, in the walker's body frame. The walker stands with its ground point on its spot, facing the bench.
- Since the refine pass the anim lab draws a plain stand-in of it under every bench clip (the entry's `set`, `benchSetGeometry`: the top and legs, the anvil, the stand, the warrant, the pad, the tray; no lamp), so the hammer lands on the anvil and the finished gun stands in its stand instead of in the air. It is the lab's only; the city builds its own. `&set=0` hides it.

| piece | where (body frame, m) | when |
|---|---|---|
| **the bench** | top face y **0.435**; front edge z **0.30**, back edge z 0.82; x −0.66 … 0.66 | whenever a Gunrunner is at the bench: every bench clip |
| **the lamp** | foot on the top at (x −0.58, z 0.76); shade at (−0.42, 0.92, 0.70), aimed at the work; light pool on the top around (−0.05, 0.55), radius 0.4 | always on the bench. Lit at night: the show runs at 9:05 p.m. |
| **the anvil** (a steel block) | centre (0.20, 0.67), 0.20 × 0.16, top y **0.50** | `bench_hammer`: the hammer lands on it, and the sparks fly off it |
| **the warrant** (white paper) | centre (0.04, 0.45), 0.26 × 0.30, lying on the top | `bench_stamp`: the seal appears at the first slam |
| **the ink pad** | centre (0.50, 0.39), 0.12 × 0.09, top y **0.47** | `bench_stamp` |
| **the parts tray** | centre (0.38, 0.42), 0.16 × 0.12, low (about 3 cm) | `bench_assemble` |
| **the gun stand** | centre (0.26, 0.42), 0.10 × 0.14, top y **0.468** | `bench_test_gun`: the clip's own prop draws the gun in it (`prop.bench`) |

- **Keep the heights.** The tools land on them: the anvil top 0.50, the paper on the bench top 0.435, the pad top 0.47, the stand top 0.468.
- **Keep the front edge at 0.30.** It keeps the bench in front of the thighs, which reach about z 0.25 in the baggiest pants. The puffers' fronts (to z 0.30) sit above the top.
- **Set dressing between clips:** draw the gun standing in its stand at `CLIP.bench_test_gun.prop.bench` (`{ p, R }`, body frame), and the hammer and stamp lying on the bench anywhere, while another clip plays.
- **Lockpicks, fakes and warrants** have no separate build animation. Their Build plays `bench_assemble` (and `bench_stamp` for a warrant).
  - The piece's pose (`prop.pose(t)`: the grip point and the axes) doesn't depend on the model, so the city can draw a lockpick or a fake piece in the −x hand in place of the pistol.

## Playing them (the stage hook)

- **Start and stop:** `playClip(w.g, 'bench_hammer')` with the walker stopped on its spot (`g.w = 0`), `stepClip(w.g, dt)` every frame, and `stopClip` to end. Each one blends in from the stand (0.3–0.35 s).
- **Switching:** the clips don't share a seam pose. Go from one to another through `stopClip` and `playClip`, which is a short straighten-up. A switch mid-play pops (CLIPS.md).
  - Each loop is seamless at its own wrap. Every rhythm in it divides its length, and every channel is keyed back to its start.
- **`bench_test_gun` holds** its last pose, the hands resting on the bench and the gun back in its stand, until `stopClip`. A natural Build is: `bench_hammer` or `bench_assemble` for a while, then `bench_test_gun`, then stop.
- **Props:**
  - Draw `state.c.prop`: `prop.geometry(THREE)` × `prop.matrix(THREE, state.t, out)` × the walker's matrix (ground point, yaw).
  - Show it while the clip's weight is ≥ 0.6, as for the gun (CLIPS.md, the shooter).
  - The pose contract is `gun-prop.js`'s: `prop.pose(t)` → `{ p, R, show }`, the grip point and the column-major axes.
  - The hammer and the stamp come from `bench-props.js`: `benchGeometry(THREE, id)`, `benchMatrix`, `benchPoint`, `benchDir`, `benchCells(id)` for the icon baker, and `HAMMER.face` / `STAMP.face`.
- **Held things:** hide them while a bench clip plays. Both hands are busy.

## How they are built (for the next agent)

- **The track.** One expression per channel, absolute values, valid in GLSL and JS, as `robbery.js`'s aim clips and `react.js`'s `film_phone` are:
  - the chest's pitch, yaw and roll; the drop, the hips' sway and the pelvis roll;
  - the feet; the eyes;
  - both arms' pitch, roll, yaw, twist and elbow.
  - Key poses are solved offline against the rig and keyed with a small `timeline()` helper: a list of key poses at times, one keyed expression per channel.
- **The tool rides its hand rigidly.**
  - The CPU runs walk2.js's forward kinematics: the elbow's rigid hand about the hinge line, the shoulder's turn, the chest's turn about the standing pelvis.
  - Measured on the real shader (a rigid fit of the posed hand vertices), the tool sits on the hand's grip point within 0.0004 mm.
- **The other hand** is placed by `work.js`'s two-bone IK (copied in). It goes on a bench point, given in the body frame and converted through the standing pelvis so it stays planted while the chest moves. Or it goes on a point of the other hand's tool, given in that hand's rest frame and carried by its own pose, so the hands meet on the tool exactly. The two can be mixed.
- **What the rig allows, found the hard way:**
  - **The head owns the space above the hands.** The big head (x ±0.5, y 0.9–1.7, z −0.35 … 0.45) hangs over everything in front of the chest, and the arm reaches only 0.40–0.45 m.
    - Working about 0.4 m out, a fist can't rise above y ≈ 0.63 without meeting the chin edge.
    - So the bench is low (0.435, under the toon's belt), the head bows only as far as it clears the fists, and the stamp's "thump" is in the knees and the chest. A nod would put the chin on the fist.
  - **Big moves go out to the +x side.** The hammer's wind-up, the stamp's lift and the sighted gun all go beside the head, where the street's camera sees them.
    - The highest a hammer gets with 2.5 cm of head clearance is its head at y ≈ 1.09, beside the head's lower third. A vertical forearm can't put the fist outside the head: the upper arm is only 0.175 m long.
    - The stamp's slam is keyed through a low pass out at the side (`LOW`), because a straight angle blend cuts the head's corner. The hammer's blow went the same way (`OUT`) until the refine pass; it now comes down through `HIGH`, over the anvil, so it lands from above (below).
  - **The toon forearm can't roll.** The arm's twist swings the bent forearm about the upper arm; it doesn't turn the hand.
    - So no palm-down grip from a natural arm: the finished gun stands upright in a stand instead of lying on its side.
    - The "screwdriver" in `bench_assemble` is small circles of the hand. A twist swung the fist into the head.
- **Elbows** stay ≤ 1.44 rad (≤ 1.45 in the IK), under the thick sleeve's soft cap.

## Checks (port 5363; this branch on ai-city-fresh main a62bbad)

- **The clip gates.** `FRESH_URL=http://127.0.0.1:5363 node style/check.mjs clips --quick --jobs 2` passes (exit 0), with the clip files unchanged through the run. After that run only comments, the three `note` strings and dead code changed. Checked against that tree:
  - the whole generated clip GLSL is byte-identical;
  - every bench prop's pose and beat point (every 0.01 s), every id and the models' cells are identical;
  - `end-check.mjs` passes again on the final files.

  The run's steps:
  - **End check:** PASS. On every frame the CPU and the shader agree whether each one-shot has ended.
  - **Elbow identity:** PASS within 1e-6 m (max 1.19e-7) over 11,137 look-states. The four bench clips are listed as moving by design: every state bends (57/57, 69/69, 81/81, 93/93), elbows ≤ 1.43–1.45 rad.
  - **Hand gate:** 72 clips, 4,416 states, × every fresh bottom on the plain shoe, 8/8 shards. Every count is 0: crossings, coplanar overlaps, opposite-leg, penetrations, leg/hand, foot/hand. PASS.
  - **See-through:** 0 of 12,732 frames on the mannequin show inside faces (`bench_hammer` 0/144, `bench_stamp` 0/168, `bench_assemble` 0/192, `bench_test_gun` 0/224). PASS.
  - The full gates (`check.mjs clips` without `--quick`: every look, every bottom × shoe) were not run.
- **Contacts and clearances.** The real shader by transform feedback, every 0.05 s, on 7 looks: bare, `tall_tee`, `corner_hoodie`, `bubble_goose`, `gatehill_mink`, `old_puffer`, `old_furcoat`.
  - **The tool in the fist:** ≤ 0.0004 mm, every clip and look.
  - **Bare, tee and hoodie:**
    - hands ≥ 0.8 cm from the head (the closest: the hammer's −x hand at the impacts and the −x hand on the gun's slide);
    - forearms ≥ 4 cm from the head;
    - hands ≥ 0.6 cm over the bench top.
  - **The Goose and the mink:** the same, except for their thick sleeves. They come within 1 mm of the head in `bench_assemble` (the Goose) and graze it by 2 mm at the hammer's top (the mink).
  - **`old_puffer` and `old_furcoat`:** their wide cuffs come out the same, and sit lower than the hand.
    - They dip into the bench top by up to 1.8 cm at a few resting moments: the hammer's impact 0.5 cm, its −x hand 1.2 cm, the stamp's −x hand 1.0 cm, the gun going back in its stand 1.8 cm.
    - They graze the head's underside by up to 0.6 cm (`bench_assemble` at 2.75 s, the hand leaving the piece).
  - **Every slam lands flat:** the stamp's face normal is exactly down, on the paper.
- **Loops:** every channel is keyed back to its start, and every rhythm divides the length. Measured on the real shader (every vertex, 0.1 ms before the wrap against t 0, on 3 looks), the gap is 0.0007 mm (`bench_hammer`), 0.0001 mm (`bench_stamp`) and 0.0001 mm (`bench_assemble`).

### The refine pass (2026-10-16): `bench_hammer`

slime: "hammering seems a bit off". Only `bench_hammer`'s keys, timeline and −x hand changed, plus the lab's stand-in set (above). The
gates over every clip are in CLIPS.md § Refine.
- **What was off** (measured on main, the clip's own track):
  - **The arc.** The blow came down out at the side to bench height (`OUT`), then swept in sideways at the anvil's height, 0.56 m in
    the last 0.07 s. It entered the anvil's +x side 1.4 cm below its top, a frame before the impact. The lift went back out the same
    way, sliding along at anvil height.
  - **The contact.** The face landed tilted 9.4°: one edge 1.3 cm into the anvil, the other 0.5 cm above it.
  - **The timing.** A snap down and a slower lift were already there (0.15 s down, 0.37 s up). They read as a sideways swat because of
    the arc.
  - **The other hand** sat still on the bench through all three strikes.
  - **The head and the body.** The only reaction to the impact was the head's flinch.
- **The checks on the new clip:**
  - **The contact:** at each strike the face's four corners lie within 0.3 mm of the anvil's top (y 0.50), its normal 0.26° off
    straight down. Away from the strike frames no hammer cell is ever inside the anvil.
  - **The blow's last two frames** (60 fps) move the face 7.9 and 6.9 cm, 91–93 % of that downward. The rebound lifts it 6.8 cm in 0.06 s.
  - **The tool in the fist** (the real shader, every 1/120 s): ≤ 0.0005 mm.
  - **The head** (the real shader, the arms' hand and forearm vertices against the posed head's box, every 1/120 s):
    - Bare: hands ≥ 1.1 cm, forearms ≥ 4.1 cm. Main: 0.8 and 4.1.
    - The Goose: hands 1.1, forearms 1.2. `old_puffer`: hands 0.6.
    - The thick sleeves' forearms touch it by 0.2 cm at the top of the wind-up, the same pose as main's, with the same number.
  - **The bench top** (arm vertices over it): bare ≥ 2.5 cm (main 3.2), the Goose ≥ 0.9 (main −0.6), `old_puffer` −0.6 (main −1.2).
    The puffer's figure is its wide −x cuff on the pat, at 2.29 s.
  - **Elbows** ≤ 1.45 rad (the −x hand's IK at its cap, as before; the hammer arm's keys ≤ 1.43). **The loop's seam:** every channel within 5e-8 at the wrap.
- **The strike times did not move:** `strikes` is still [0.6, 1.2, 1.8]. The spark point moved 0.4 cm (above: "The beats").

## Sheets (`shots/bench/`)

The refine pass redrew `bench_hammer.jpg` (the lab sheet, now with the lab's stand-in bench), `staged-bench_hammer.jpg` and
`beat-hammer-strike.jpg` (the same set and stand-in sparks). The before and after are in `../refine/` (CLIPS.md § Refine).
`filmstrip-25m-*.jpg` still show main's hammer.

- **`bench_<clip>.jpg`:** the CLIPS.md lab sheet (`&scene=clip&clip=<name>&strip=12&cols=6`, `&zoom=1.5`), one loop or the one-shot, cams side, front and tq stacked. No set.
- **`staged-bench_<clip>.jpg`:** one loop (or the one-shot) in the lab with a stand-in of the city's set built from `BENCH` (bench, anvil, paper, pad, tray, gun stand, lamp), from the front-right (the front-left for `bench_assemble`).
- **`beat-hammer-strike.jpg`:** one strike every 0.025 s with stand-in sparks.
- **`beat-stamp-slam.jpg`:** the first slam every 0.04 s.
- **`filmstrip-25m-front.jpg`, `filmstrip-25m-back.jpg`:** the city distance. A plain stand and the four clips at about 25 m, 38° down, fov 22° on 640 × 360 tiles (the city's pixel size at 1080p, as `shots/moods/`). Each figure is cropped and shown 2× (nearest), 12 frames, from the front-right and from behind.

## Open items

- **The city's set:** the bench, lamp, anvil, paper and seal, pad, tray and stand, and the sparks effect, all to the numbers above.
- **The −x hand only steadies the work** in `bench_hammer`. Since the refine pass it lifts and plants with each blow, but it can't hold the work: the anvil is 0.67 m ahead, beyond the arm's 0.45 m reach from that shoulder. There are no tongs or work piece in it: one prop per clip in the lab. A work bar would be city set dressing on the anvil.
- **The hammer's blow comes in from the side** before it drops (the refine pass). The big head leaves no room to raise the hammer over the anvil: the face gets at most 14 cm above it under the chin. So the wind-up goes out beside the head and the blow sweeps in at chest height, about 14 cm over the anvil, and drops onto it. A straight-down chop from the wind-up would need the anvil out beside the head (x ≥ 0.55), where the arm can't land the face flat.
- **In the lab, at the end of a play,** the finished gun leaves its stand as `bench_test_gun` blends out: the prop hides below a weight of 0.6. The city draws it in the stand between clips (`prop.bench`, above).
- **One model for two pistols.** The piece in `bench_assemble` and the finished gun are the same pistol model. A part-built look, or lockpick and fake models, would be new props on the same poses.
- **The bulkiest coats' cuffs** (`old_puffer`, `old_furcoat`) graze the bench top and the head's underside, as measured above. A taller bench would fix the dips but put the hands under the chin, so it was left.
- **CLIPS.md** has no bench section yet. The registry owner may want to add the table above.
