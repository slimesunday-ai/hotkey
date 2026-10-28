# Clips: authored animations on the walker

One registry for every authored clip (MOVEMENT.md §7): robberies, falls, arrests, skating, riding, transit, deals, talk, work, the moods and the street's reactions.
Poses stay procedural in the vertex shader, like the idles; a clip is a GLSL body plus a few numbers.

## The files: one per small group, one owner each

| group file | family | clips |
|---|---|---|
| `robbery.js` | events | `rob_lunge_grab`, `hit_stumble_back`, `run_getaway`, `hands_up_point`, `pat_pockets` |
| `falls.js` | events | `fall_back` → `lie_hurt`, `death_collapse` → `lie_still`, `shot_hit`, `cower` |
| `arrest.js` | events | `cuffed_idle`, `cuffed_walk`, `cuff_apply`, `get_in_car`, `scuffle_pair`, `flee_run` |
| `skate.js`, `ride.js`, `transit.js` | travel | skate, scooter, bike, seats and rails, taxi, stairs, turnstile, the stop |
| `deal-hang.js`, `talk-patrol.js`, `work.js` | activities | deals, `brush_pass`, leaning, sitting, talking, patrol, digging, carrying, sweeping |
| `high.js` | moods | `wired_walk`, `spaced_walk`, `guarded_walk` (walking overlays), `wired_bounce`, `spaced_drift`, `guarded_stance` |
| `react.js` | react | `film_phone` (+ `phone-prop.js`), `rubberneck_walk` (a walking overlay) |

- **Your group file is the only file you edit.** `index.js` imports every group file statically, so a new clip never touches it.
- A new group means one import line and one `GROUPS` entry in `index.js`. Only the registry owner adds those.

## The entry

```js
export const CLIPS = [
  { name: 'pat_pockets',   // lower_snake_case, unique across all groups (the registry throws on a clash)
    dur: 1.6,               // seconds: a one-shot's length, or a loop's period
    loop: true,             // default false: a one-shot
    hold: false,            // a one-shot that holds its last pose until stopClip(); the body still gets t ≥ dur, so the hold can live
    next: null,             // a one-shot that chains into this clip when it ends (fall_back → lie_hurt). Its last pose = next's first.
    blendIn: .15, blendOut: .3,   // seconds (≈ 95 % of the blend)
    moving: false,          // true: the walker travels while it plays, and the walk's legs run under the clip (run_getaway)
    speed: 0,               // m/s, for a moving clip: what the owner moves the walker at (the lab runs it in place at this speed).
                            //   0 on a moving clip = a WALKING OVERLAY: the walker keeps its own pace (§ Moods and reactions)
    stride: 1,              // × the walk's cycle length while it plays (g.scale): a run's long stride
    shift: null,            // [x, z] m, body frame: where a one-shot leaves the body (its root's end place). See § Root motion.
    pair: null,             // { with: '<clip>', gap: m, delay: s, face? }: the partner plays `with`, gap m in front, facing, delay s after
                            //   (face: 'away' turns the partner's back to the lead: cuff_apply's suspect)
    note: '…',              // the timeline in words (the lab shows it)
    glsl: `…` },            // the body (below)
];
```

## The GLSL body

The body runs inside `void clip_<name>(inout Pose P, float t, float u, float w)` and has `const float D` (= dur). It reads and writes:

- **`t`:** the clip clock in seconds. A loop gets `mod(t, dur)`. A one-shot gets `t ≥ 0`, unclamped, so it must hold its own last pose past `D`. The helpers clamp: `cS(t, a, b)` stays 1 after `b`.
- **`u`, `w`:** the walk's cycle (0 → 1, the −x leg's) and its weight. A moving clip times its arms off `u` (walk2.js: the +x arm swings with `cos(2π(u − .07))`).
- **`P`, the pose (walk.js/walk2.js `Pose`):** a copy of the walk + hold pose. The dispatcher blends it in by the clip's weight.
  - `P.torso`, `P.head`: x pitches forward (head: looks down), y yaws (+: the front turns to +x), z rolls.
  - `P.armP / armR / ayaw / atw`: per arm, `.x` the −x arm and `.y` the +x arm. They are pitch forward, roll out, yaw in and twist in (idle.js `aArmRot`).
  - `P.ank`: the ankle targets (z, y) of the −x and +x foot. The standing legs are solved by IK from them; `P.fp` is the foot pitch.
  - `P.drop` (m) lowers the pelvis, which bends the knees. `P.bodyX` (m) sways the hips. `P.pRoll` rolls the pelvis.
- **`cLook` (read only):** the walker's look yaw (rad, body frame, +: to +x), the gait state's `g.look` (walk2.js passes A2.y). A clip that watches something turns the head to it (`rubberneck_walk`). No other clip reads it.
- **The root (globals):**
  - `cRot` (pitch, yaw, roll) turns the WHOLE body about `cPiv` (m, body frame).
  - `cMov` (m, body frame, +z ahead) then moves it.
  - `cLegK` (hip, knee) scales the walking legs.
  - Lunges, stumbles, falls and lying down are made from these.
- **Helpers:**
  - Easing: `cR` (linear), `cS` (eased), `cOut` (snap), `cIn` (hit), `cBack` (overshoots 10 %, settles) and `cBump` (0 → 1 → 0), all `(t, a, b)`.
  - Arms: `cArm(P, side, vec4(pitch, roll, yaw, twist), k)` and `cArms(P, a, k)` set ABSOLUTE arm angles, blended by `k`.
  - Elbow (in the cast since 2026-10-08, ../ELBOW.md): `cArm(P, side, a, elbow, k)`, `cArms(P, a, elbow, k)` and `cElbow(P, side, e, k)` also set the elbow bend (rad; + = the forearm forward in the arm's plane, so the twist picks the fold). The 4-angle forms leave it at 0. `elbow/identity.mjs` proves the elbow moves nothing where no elbow bends: it reads which clip states bend one off the shader itself (nothing to declare), lists those clips as moving by design, and its verdict covers the rest (the walk, turns, idles, holds, every clip that bends no elbow, and the straight-arm frames of the ones that do). A clip that bends an elbow runs the elbow gate's ideas on itself: check the hand gate (`lower-motion-check --clips`) and the see-through gate (`overlap-check --gate --clips`) on it. A padded sleeve eases to a stop at about 105°.
  - Feet: `cFoot(P, side, z, lift, fp)` places a foot's ground point at body-frame z. `cStep(t, a, b, z0, z1)` and `cLift(t, a, b, h)` make a step.
  - `cBreathe(P, t, k)` adds the idles' breath.
- **Planting feet under a moving root:** a foot planted at ground spot `s` while `cMov.z = m` sits at `cFoot(P, side, s - m, …)`.

## One-shot vs loop, blending in and out

- **CPU (`index.js`), on the walker's gait state `g`.** Call these after `stepGait2` and `stepIdle`, every frame:
  - `playClip(g, name, { t })` starts a clip. Two walkers started with the same `t` on the same frame stay in sync: pairs share a start.
  - `stopClip(g)` blends out (a loop, a held one-shot, or a one-shot cut short).
  - `stepClip(g, dt)` returns the clip's state or null:
    - It advances the clock and blends the weight in and out.
    - It chains into `next`, and ends a one-shot without `hold` by itself.
    - A one-shot ends on the frame the shader ends it: the clock as the GPU reads it (a float32) against the float32 `dur` (index.js `END`), so the shift, the chain and the blend-out never land a frame late. A `dur` on the 1/60 s grid is fine.
    - It gives back the walker's own idle and stride when the clip is done.
- **The data path.** The clip rides the idle slot of the animation texture, so the texture and the vertex attributes are unchanged:
  - `g.idle = CLIP_BASE + id`, where `CLIP_BASE` is 32 (idle.js).
  - `g.iw` is the clip's weight and `g.it` is its clock.
  - `idlePose` skips ids ≥ 32; walk2.js calls `clipPose` after the walk and the hold.
  - The walker's idle is not evaluated while a clip plays, so a clip blends in from the bare stand, not from the idle.
- **Ids are build-time.** Store and send clip NAMES, never the numbers.
- **From walk or idle:** the clip blends in over `blendIn` on top of whatever the walk is doing. A standing clip wants the walker stopped (walk weight 0): its legs come from `P.ank`. A moving clip keeps the walk's legs, scaled by `cLegK`.
- **Into walk or idle:** `stopClip`, or a one-shot's end, blends out over `blendOut`, and the idle eases back in.
- **Switching clips mid-play pops.** The slot holds one clip, so the outgoing clip doesn't cross-fade. Chain with `next`, or end one clip in a pose close to the next one's start.

## Root motion

- A one-shot whose root ends somewhere else (a lunge, a stumble back) declares that place as `shift: [x, z]`.
- On the frame it reaches `dur`, `stepClip` returns `state.shiftNow`. The owner moves the walker by that amount on THAT frame.
- From then on, the shader takes the shift off the clip's root, so the body stays put on screen while the hold or the blend-out runs.
- In world space the body-frame shift is `x' = x cos yaw + z sin yaw` and `z' = −x sin yaw + z cos yaw` (the lab's `clipStep`).

## Props: a thing under the feet (the skateboard; `skate.js`, `skate-board.js`)

- **Not the held path.** A held thing is baked into the body and rides the gripping arm (grip.js). A board lives under BOTH feet, tilts and pops on its own, and shows only while riding, so it is a separate mesh posed on the CPU by the clip's clock.
- **The entry field.** `prop: { id, geometry(THREE, scheme?), pose(t), matrix(THREE, t, out) }`. The registry passes extra fields through (index.js spreads the entry), so a prop needs no change to `index.js`.
  - `pose(t)` → `{ x, y, z, yaw, pitch, pz, roll }` in the walker's body frame at clip clock `t` (= `stepClip`'s `state.t`; a loop wraps it itself). skate-board.js `boardMatrix` says what the numbers mean.
  - `matrix(THREE, t, out)` → the prop's local → body-frame matrix. Its world matrix = the walker's matrix (ground point, yaw) × this. Use the playing clip's prop (`state.c.prop`: after a chain it is the next clip's).
- **One model per object** (MOVEMENT.md §2): the model lives in one file. `skate-board.js`: `boardCells()` (`[x, y, z, colour, layer]`, grain 0.025 m, for the icon baker's Vx grid), `boardGeometry(THREE)` (the same cells, the city's corner AO), `BOARD` (sizes; deck top 0.10 m), `SCHEMES` (colourways).
- **One source for the feet and the prop.** Each skate clip writes its board track once, as expressions valid in BOTH GLSL and JS (`cS`, `cOut`, `cBump`, `sin`, `mix`…). The GLSL stands the feet on the deck from them, and the CPU evaluates the same strings for the matrix. They cannot drift apart.
- **The lab** draws a clip's `prop` under its actor (`lab.js` `drawProps`, a few lines). That is the only shared change.
  - Since the refine pass (§ Refine, below) it draws the PLAYING clip's prop only while the clip's weight is ≥ 0.6, the city's rule for every prop (§ The shooter, "Showing it"), and passes the walker's gait state as the 4th argument, as the city does.
- **Two more entry fields** (skate):
  - `speed` on a standing-leg clip (`moving: false`): the walker TRAVELS at `speed` while it plays, but the legs are the clip's. The owner moves it and keeps the walk weight at 0 (`g.w = 0`).
  - `turn` (rad): a one-shot that turns the walker (the kickturns). On its end frame (`state.shiftNow` set) the owner moves the walker by the shift AND adds `turn` to its yaw.

## How the city triggers one (deadnet-style-cast)

- `tools/sync-cast.mjs` copies `anim/clips/` with the rest of the cast's anim files, into `style/city/anim/cast/clips/`.
- The stage (`style/city/stage/`) borrows a walker, then drives the clip in its gait hook. The hook (`w.stagePose`) runs after pedsim's own gait and idle step:
  - `playClip(w.g, 'rob_lunge_grab')` on the beat, then `stepClip(w.g, dt)` every frame in the hook.
  - Applies `shiftNow` to the actor's position.
  - Moves a `moving` clip's walker at its `speed`, and keeps the walk weight at 0 for a standing clip.

## The lab and the checks

- **The anim lab** (`anim/index.html`):
  - The clip picker lists every registered clip by group: ⟳ marks a loop, ⇄ a pair.
  - `&scene=clip&clip=<name>` plays one clip, with its partner beside it. `play` restarts it; `loop` or `once` toggles replay.
  - `&scene=clips` lines up every clip.
  - Contact sheet: `&scene=clip&clip=<name>&strip=12&cols=6&sdt=.1&t=0&cam=side`. Its cameras are side, front, tq, top, watcher and close.
  - A prop shows only while its clip plays at a weight ≥ 0.6, as in the city (§ Refine). A clip with a `set` (lab only: the bench clips' stand-in bench, bench.md) gets it drawn under its actor, never under `&dbg=back`; `&set=0` hides it.
  - **The per-clip sheets `shots/<clip>.jpg` are stale for the elbow clips.** Each was captured from that URL by hand, and no tool regenerates them in one command.
    - 17 predate their clip's move to the elbow and still show one-piece arms: the robbery four (`rob_lunge_grab`, `run_getaway`, `hands_up_point`, `pat_pockets`); `stand_rail`, `hail_taxi`, `lie_hurt`, `cower`, `fall_back`, `shove_fall` and `get_up`; and the deal-hang six (`deal_pace`, `deal_lookout`, `brush_pass`, `lean_wall`, `sit_stoop`, `sit_bench`).
    - `death_collapse.jpg` predates 0fe1230's start pose.
    - The current poses are in each pass's before/after sheets: `shots/elbow-robbery/`, `shots/elbow-transit-falls/`, `shots/elbow-deal-hang/` and `shots/falls-seams/`.
- **The gates:**
  - See-through: `node style/city/anim/overlap-check.mjs --gate '&dbg=back' --clips` (the clips line-up, every clip through its cycle).
  - Hands: `node style/city/anim/lower-motion-check.mjs --quick --clips` (the legs and hands through every clip at 0.1 s steps).
  - Both take `FRESH_URL=http://127.0.0.1:<port>`.
  - End frames: `node style/city/anim/clips/end-check.mjs` (no server): every clip at 60 fps, 30 fps, a jittered dt and at its float32 end; the CPU and the shader must agree on every frame whether it has ended.
  - Elbow identity: `node style/city/anim/elbow/identity.mjs` (§ The GLSL body, Elbow).
- **In the full check.** `node style/check.mjs --all` runs all four gates on every clip: the hands on the full bottom × shoe matrix and the see-through on every look, both in shards. It fails when any clip fails one. (`--all --pool npc` doesn't run them.)
  - `node style/check.mjs clips` runs the same four alone.
  - `node style/check.mjs clips --quick` is the smoke run: the hands on every fresh bottom over the plain shoe, the see-through on the mannequin. It takes a few minutes; the full set takes many job-hours.

## Where an elbow would help (the one-piece arms' list: every item is done)

This list was written when the clips had one-piece arms. The cast's elbow (2026-10-08, ../ELBOW.md) has since covered every item; the commits are on main.

- **Hands up:** done (71acfd7, § The robbery on the elbow). `hands_up_point`'s hands go up beside the head, the forearms up.
  - Before: the big head (x ±0.4 from y 0.95 up) sits over the shoulders (x ±0.25), so a straight arm could rise only about 10° above horizontal at the sides. The clip was a wide, raised T.
- **At the chest:** done (71acfd7). `rob_lunge_grab` and `run_getaway` clutch the loot with the +x fist at the sternum (`CLUTCH`), and `pat_pockets` pats at the chest.
  - Before: a straight arm crossed in front of the belly.
- **The grab:** the elbows now bend 0.2 on the grab (71acfd7), but the geometry stands. The fists close on the victim's front at about arm's length, and the heads stick out 0.4 m, so the pair gap (1.15 m) is still set by the heads, not the hands.
- **Later groups:**
  - Cuffs, the wrists together behind the back: done (6211909, the arrest clips, the elbow's first).
  - A hand on a rail: done (cd01a8a). `stand_rail` grips the pole.
  - A hand to the head: done (cd01a8a). `lie_hurt` holds the side of the head, and `cower`'s hands clamp it. `fall_back` and `shove_fall` land into the pose, and `get_up` starts from it; 0fe1230 then took `get_up`'s reach clear of the chin.
  - Hailing a taxi, the forearm up: done (cd01a8a, `hail_taxi`).
  - `talk_gesture`: authored on the elbow (4802d9c, the talk-patrol clips).
- The deal and hang clips have moved to the elbow too (d4e2366): the hoodie pocket, the chin rub, the forearms on the knees, the bench's backrest arm.

## Knocked down, back up, and the shooter (the getup-aim agent, 2026-10-08)

New clips, appended to their groups' arrays (`falls.js`: `shove_fall`, `get_up`, `walk_hurt`; `robbery.js`: `aim_draw`, `aim_hold`, `aim_fire`, `aim_lower`) and one new model file, `gun-prop.js`. When they landed, the five robbery clips and the falls clips above were unchanged (elbow/identity: every one within 2.4e-7 m).

Several have changed since. Their timings, chains and shifts are still as written here:
- Four robbery clips moved to the elbow (71acfd7): `rob_lunge_grab`, `run_getaway`, `hands_up_point` and `pat_pockets`. `hit_stumble_back` and the aim clips are untouched.
- `lie_hurt` and `cower` moved to the elbow, with the chain around `lie_hurt`'s first pose: `fall_back`'s and `shove_fall`'s ends and `get_up`'s start (cd01a8a).
- 0fe1230 changed `death_collapse`'s start and `get_up`'s reach (§ The elbow on transit and falls).

### The robbery's victim: down, and back up

- **The stage:** `rob_lunge_grab` on the robber; `shove_fall` on the victim, placed as `hit_stumble_back` is (1.15 m in front, facing, 0.34 s after the robber starts) → it chains into `lie_hurt` by itself.
  - `shove_fall` (1.5 s) has `shift: [0, -0.36]`: move the walker by `state.shiftNow` on its end frame, as for `shot_hit`.
- **Lying → `get_up`:** switch when `lie_hurt`'s clock crosses a multiple of its 2 s loop: `playClip(g, 'get_up', { t: s.t % 2 })` on that frame. `get_up` starts exactly on `lie_hurt`'s first pose; anywhere else in the loop it pops (the head roll is up to 0.4 rad).
  - `get_up` (3.3 s) ends in the plain stand with `shift: [0, 0.229]` (it rises over its feet, ahead of where it lay). Apply `shiftNow`; the walker's own walk or idle then takes over with no pop.
- **`walk_hurt`** (0.75 s loop) is a STANDING-LEG clip that travels, like the skate clips: `moving: false`, `speed: 0.8`. The owner moves the walker at `speed` along its heading and keeps `g.w = 0`.
  - Why not `moving: true`: the walk's keyed legs are symmetric (`cLegK` scales both), and a limp is the uneven step. The feet here are the clip's, planted under the moving body at exactly the speed.
  - Start it after `get_up` has ended (it blends in from the stand).
- **The get_up route is the rig's.** The leg cloth wants the hip ≥ ~0.12 m above the ankle along the foot's up axis, so there is no flat-footed deep squat and no kneel. The route:
  1. Sit up about the butt (`BUTT_ROOT`), the heels set down on a line solved to y = 0, the hands planted behind the hips, elbows bent ~83°.
  2. Rock forward about that heel line (the toes come down as it rocks).
  3. Rise over the planted feet (the root slides forward while the feet slide back in its frame).
  4. A stagger, a dazed head shake, the arms shaken out.

### The shooter

- **The chain:** `aim_draw` (0.8 s) chains to `aim_hold` (1.6 s loop).
  - `aim_hold` has SEAMS every 0.8 s: its pose at t = 0, 0.8, 1.6 is its first pose. That pose is also `aim_fire`'s and `aim_lower`'s first and `aim_draw`'s and `aim_fire`'s last.
  - Switch on a seam: `playClip(g, 'aim_fire', { t: s.t % 0.8 })`. `aim_fire` (0.6 s) chains back to `aim_hold`.
  - `aim_lower` (1.0 s) ends in the plain stand with the gun back in its carry on the hip (put there at 0.66 s; it shows until the clip blends out): play `run_getaway` after it, or let the walker go.
  - **The carry (since the refine pass):** the gun is carried on the +x hip, its grip behind the hip at belt height, the barrel straight down along the outside of the thigh. `aim_draw` shows it there from its first frame and the hand takes it at 0.26 s; `aim_lower` puts it back there at 0.66 s. While carried it rides the hips (the chest's frame and the root), so `prop.pose(t)` covers it with no extra field. Before, the gun only appeared in the hand at 0.26 s, and it was hidden again at 0.66 s.
- **One-handed and bladed, on purpose.** The head's front face is at z 0.45 and its bottom at y 0.9. The shoulders are 0.25 out and the arms reach 0.40–0.45 m.
  - A square two-hand grip meets behind the head's front face, so from the street camera the head hides fists and gun.
  - The root turns −0.2 rad about the +x foot and the chest −0.28 more. That puts the fist ~0.55 m out, in front of the head, with the gun level at shoulder height (the muzzle ~0.87 m up, ~0.77 m ahead). The eyes stay on the target.
- **The gun rides the +x hand rigidly.**
  - The arm and body are one track of expressions valid in GLSL and JS, and the CPU runs walk2.js's forward kinematics (the elbow's rigid hand about the hinge line, the shoulder, the chest about the pelvis, the root) to place the gun.
  - Measured on the real shader over 77 looks: hand to grip ≤ 0.0002 mm.

### The gun's API (for the stage)

- **`gun-prop.js`:** `GRAIN` (0.025), `GUN` (`grip` [0, 0, 0]; `muzzle` [0, 0.125, 0.225]; `dir` [0, 0, 1], in the gun's frame), `SCHEME`, `gunCells()` (for the icon baker), `gunGeometry(THREE)`, `gunMatrix(THREE, pose, out)`, `gunPoint(pose, q)`, `gunDir(pose, d)`.
- **Each aim clip's `prop`:** `{ id: 'pistol', geometry(THREE), pose(t), matrix(THREE, t, out), muzzle(t), track(t) }`. `t` is the clip clock, `state.t`; a loop wraps it itself.
  - `pose(t)` returns `{ p, R, show }`: the grip point and the gun's axes (column-major 3×3) in the walker's body frame.
  - `matrix(THREE, t, out)` is the gun's local → body-frame matrix. When `show < 0.5` it is collapsed onto the grip (hidden).
  - `muzzle(t)` returns `{ p, d, show }`: the muzzle point and the barrel direction, body frame.
- **To world:** the walker's matrix (ground point, yaw) × these. For a point, `x' = x cos yaw + z sin yaw`, `z' = −x sin yaw + z cos yaw`, `y' = y + ground`, then add the walker's position.
- **Showing it:** show the gun while the aim clip's weight is ≥ 0.6. Use the playing clip's prop (`state.c.prop`). The anim lab applies the same rule to every clip's prop (§ Refine).
- **The flash:** `aim_fire.flash = [0, 0.06]` (s). Draw it at `prop.muzzle(state.t)` while `state.t` is in that window. The shot is at t 0; the gun flips ~25° up by 0.05 s, so the muzzle moves under the flash.

### Checks (on this branch, port 5497)

- The chains are exact on the real shader (max vertex Δ ≤ 0.0004 mm):
  - shove_fall end → lie_hurt;
  - lie_hurt at 0 and at 2 s → get_up;
  - get_up end → the stand;
  - aim_draw end → aim_hold;
  - aim_hold at 0.8 and 1.6 → aim_hold, aim_fire, aim_lower;
  - aim_fire end → aim_hold;
  - aim_lower end → the stand.
- Contacts and pixels: `shots/<clip>.jpg`, and `shots/getup-aim/` (`robbery-knockdown.webm`, `shot-pair.webm`, `shot-pair-city.jpg`, `looks.jpg`).

## Riding: the e-scooter and the bike (the ride agent, 2026-10-08)

Three loops in `ride.js` (`scooter_ride`, `bike_pedal`, `bike_coast`) and one new model file, `ride-props.js` (the bike and the e-scooter). No other file changed.

### The clips

- **All three are standing-leg clips that travel** (`moving: false`, `speed`: the skate convention). The owner moves the walker at `speed` and keeps `g.w = 0`. The walker stays ON THE GROUND: the clip's root lifts the body onto the saddle (0.2125 m) or the deck (0.1265 m). Draw the prop at the walker's own matrix.
- **`scooter_ride`** (4.8332 s = 50 turns of the 0.2 m wheels at 6.5 m/s): turned 29° on the deck, the left foot ahead (the rig's feet are fixed in x, so "one behind the other" is the whole body turned, the chest turned back square to the bar). Both hands on the T-bar, a lean, two cracks (the scooter jolts 6 mm, the knees give), a glance left, a look right.
- **`bike_pedal`** (4.1126 s = six crank turns): seated, the feet ride the pedals. Cadence: 0.30 m wheels at 5.5 m/s, two wheel turns a crank turn → one crank turn every 0.6854 s (88 rpm). A glance right, a look down the road; the shoulders rock against the strokes.
- **`bike_coast`** (4.1126 s): the pedals level (right forward), the legs still; sits up a little, rolls the shoulders, looks back over the left shoulder.
- **Seams:** `bike_pedal` is level (right pedal forward) at every multiple of `ride.tc` (0.6854 s). Pedal → coast: `playClip(g, 'bike_coast', { t: 0 })` on the frame `bike_pedal`'s clock crosses a multiple of `ride.tc`. Coast → pedal: `playClip(g, 'bike_pedal', { t: 0 })` at a wrap of `bike_coast`. The wheels' turn carries over too.
- **Another speed:** advance the clip's clock by `dt × v / clip.speed`: the cranks and the wheels then turn at the real `v` (each entry's `ride` field: `{ item, v, wheelR, gear?, tc?, crank0? }`).

### The rig, and what the seat costs

- **The legs are the cast's standing legs** (P.ank / P.fp set from the pedals; the pelvis stays at its rest height and the root lifts it). No sitting knee is needed.
- **The cost is the cloth's shear**, not the 0.12 m rule (the hip stays 0.27–0.33 m above the ankle along the foot's up axis). A bent knee slides each ring sideways toward the knee, and long slides read as stairs_up's jagged slab. The shear grows with the crank: 0.07 m cranks doubled it and the legs read as a crumpled column, so the cranks are 0.05 m, the pedals' circle sits 0.20 m ahead of and 0.42 m below the hip (a "flat-foot" cruiser) and the feet ankle (toe up 0.18 rad over the top-front, down 0.12 at the bottom). The knee bends 20–86°.
- **The butt is the backs of the thighs at the hip** (the cloth hangs from there), so the saddle sits under them, 5 mm under their lowest point, with a cantle rising just behind the hips.
- **The hands** go onto the grips by work.js's two-bone IK (copied into ride.js `handsOn`). Every loop keeps the grips 0.41–0.45 m from the shoulders, so the elbows bend 35–81° (under the thick sleeve's 85° cap). The bars pass into the fists, as a tool's handle does.
- **The scooter's lean** is split into the chest's pitch and roll (the chest's pitch axis is the hips', turned 29° off the travel).

### The props (`ride-props.js`): one model each, the item's colour

- **`BIKE`, `SCOOTER`:** the layouts in metres (axles, the bottom bracket, the crank, the pedal, the grips, the saddle, the deck, the speed).
- **Colour:** `SCHEMES.bike` / `SCHEMES.scooter` (one `main` colour each: red, cobalt, yellow, lime, pink, cyan), or pass `{ main: 0x… }`. Default: the bike red, the scooter cyan. Everything else is the city's neutrals.
- **Ridden: PARTS** (each its own mesh; the tyres are part of the frame, so a wheel always touches the ground; the rim and spokes spin inside it):
  - bike: `frame`, `wheel` (×2), `crank`, `pedalR`, `pedalL`, `stand` (collapsed while ridden). Scooter: `frame`, `wheel` (×2), `stand`.
  - `partGeometry(THREE, item, part, scheme?)`, and `partMatrices(THREE, item, pose, outs?)` → `[[part, Matrix4 local → walker], …]` (always the same list, so it can fill instance slots).
  - Each clip's `prop`: `{ id: 'bike' | 'scooter', item, parts, pose(t), partGeometry(THREE, part, scheme?), partMatrices(THREE, t, outs?), geometry, matrix }`. `pose(t)` → `{ wheel, crank, fpL, fpR, lift, pitch, stand }` from the clip's own track (the same expressions as the shader's feet).
  - `prop.geometry` / `prop.matrix` are ONE live CPU-posed mesh of the whole item for the anim lab's single prop slot (`matrix(THREE, t)` re-poses it and returns the identity). One per item, so the clips line-up shows both bikes at the last-drawn pose. The city should draw the parts instead.
- **Parked / the icon:** `itemCells(item, scheme?)` (`bikeCells`, `scooterCells`: `[x, y, z, colour, layer]` on the 0.025 grid, for the icon baker), `itemGeometry(THREE, item, scheme?)` (one static mesh, the stand down) and `parkedMatrix(THREE, item, out)` (it leans onto its stand).

### What the city's movement.js does to draw them (deadnet-style-cast `style/city/simstate/movement.js`, ~line 45 and ~485–520)

1. **The lift:** set `MOVE.ride.bike.lift = MOVE.ride.scooter.lift = 0` when the clips are registered, as it already does for the skateboard: the clips' roots stand the body on the deck and sit it on the saddle. Also set `stand: true` for the bike (the legs are the clip's).
2. **The props:**
   - Replace `propGeo('bike' | 'scooter')`'s boxes with one InstancedMesh per part geometry: `CLIP.bike_pedal.prop.partGeometry(THREE, part)` for `frame`, `wheel`, `crank`, `pedalR`, `pedalL` and `stand` (the scooter: `frame`, `wheel`, `stand`). A wheel is two instances per item.
   - Each frame, per rider: `prop.partMatrices(THREE, t, outs)` at the clip's clock (`g.clip.t` in the gait hook for a near walker, the plan's clock for a mid one, as `propWorld` does for the board). Each instance's world = the walker's matrix (ground point, yaw) × its matrix.
   - Use the playing clip's prop (`g.clip.c.prop`), so pedal → coast keeps the cranks right.
3. **The turn lean:** walk2.js rolls the whole body by `turnRoll = clamp(−0.09 · omega · v, −0.3, 0.3)` after the clip's root, and at 5.5–6.5 m/s that is the full 0.3 rad in a corner. Give the parts the same roll about the walker's forward axis (world = walker × Rz(turnRoll) × part), or the rider leans off the bike.
4. **Parked bikes and scooters:** `itemGeometry(THREE, item, scheme)` with `parkedMatrix(THREE, item)` on the ground.

### Checks (port 5497)

- **Contacts, on the real shader** (transform feedback of `ANIM2_GLSL`, every 0.05 s through every loop):
  - Hands to the grips ≤ 0.04 mm (thin and thick sleeves alike).
  - Soles 1.5 mm over the pedal tops and the deck (a set gap).
- **The props against the body** (edge/triangle crossings both ways, every 0.1–0.2 s; prop cell centres inside a body part, on the mannequin):
  - 0 on the mannequin and on every agent top (54), bottom (69), shoe (63) and accessory (13) look. The bars in the fists are by design.
  - The known brushes are the long hangers:
    - `hat:old_silkrag`'s tail (rest y 0.35 behind the head) on the rear tyre and frame;
    - `hair:old_long` on the bar ends;
    - `hair:old_braids` on the cantle during the coast's look back.
  - **Held things:** a bag in a hand on the bar hangs through the frame, and a two-hand thing (the safe, the boombox) through the scooter's stem. Hide held things while riding.
- **The hand gate:**
  - `lower-motion-check --quick --clips` on the full bottom × shoe matrix (4,662 fixtures, 6 shards): PASS, every count 0.
  - It was run on these three clips only (a scratch copy with a clip filter: 263 states). The other clips are unchanged.
- **The see-through gate:** `overlap-check --gate '&dbg=back' --clips` on every look (6 shards), these three clips: 0 of 298,980 frames.
- **`elbow/identity.mjs`:** PASS. 17,766 look-states within 2.38e-7 m; the three ride clips are listed as moving by design (elbow ≤ 1.41 rad).
- **`clips/end-check.mjs`:** PASS.
- **Pixels:** `shots/{scooter_ride,bike_pedal,bike_coast}.jpg` and `shots/ride/` (`ride-by.webm`, `props.jpg`, `looks.jpg`).

## Talk and patrol (the talk-patrol agent, 2026-10-08)

Five loops in `talk-patrol.js`, the names the city's `simstate/life.js` already plays (`NAMES.talk`, `NAMES.nod`, `NAMES.patrol`): `talk_gesture` (4.2 s), `talk_gesture_b` (4.8 s), `talk_gesture_c` (3.6 s), `listen_nod` (6 s) and `patrol_walk` (4.8 s, moving). Every other clip is unchanged (elbow/identity: every clip that bends no elbow within 2.4e-7 m).

### The clips

- **`talk_gesture`, the explainer:** both hands out in front, the forearms forward. Beats at 0.22, 0.62 and 1.02 s (the hands dip, the head nods). The hands open out wide ("right?", 1.35–1.75 s, a glance off for the word), come in to hold a ball and roll it (2.15–3.35 s), and go back.
- **`talk_gesture_b`, making points:** the −x hand at the hoodie pocket, the weight on that hip. The +x forearm comes up and chops three times (counting, the head tilted), points at the listener with two jabs, flicks out to the side (the eyes off), and comes back up.
- **`talk_gesture_c`, animated:** both forearms thrown out to the sides ("come on!", the chest back), held through a head shake. The hands drop, then a laugh that throws the head back and bobs, with a dismissive swat of the +x hand.
- **`listen_nod`:** the weight on the −x leg (the +x heel up), hands at the hoodie pocket. A double nod ("mm-hm"), the +x hand up to the chin while thinking (the head tilted), a nod, a short laugh.
- **`patrol_walk`:** moving at 1.05 m/s on the walk's legs (stride 1). Hands clasped at the small of the back (arrest.js's cuffs, a little looser), the chest up, the head scanning: to +x at 0.2–0.75 s and held, back, to −x at 2.5–3.0 s and held, back.

### How the hands are placed

- **A two-bone IK on the elbow** (work.js's method, `ik()` in the file): the reach sets the elbow, then the shoulder turns the bent arm so its grip point lands on the target, with the elbow toward a pole. The targets are keyed in the chest's rest frame, so the chest's lean and turn carry the hands.
- **The reach shell.** The toon arm reaches only 0.403–0.453 m from the shoulder with the elbow ≤ 83° (under the thick sleeve's soft cap). So:
  - No folded arms: the hands would need 0.55 m.
  - No hand on the hip: that is 0.25–0.35 m from the shoulder.
  - No hand at the midline in front of the chest.
  - The speakers' hands work in a band ≥ 0.33 m in front of the chest.
  - The listener's hands go to the pocket: deal_lookout's straight-arm pocket, a little further forward (`[1.0, .08, .26, .45]`), so the fists sit in front of the belly instead of in it. A bent-elbow belly pose was tried and dropped: its forearms cut the torso (7,000+ crossings).
- **Poles never swing through the body.** An early `talk_gesture_c` flipped the elbow's pole between the throw and the drop, and the elbow brushed the waistband. The poles now stay on the outside.

### What the city needs to know (life.js)

- **Talk.** life.js picks the speaker's clip as `NAMES.talk[v % 3]` (the three that exist) and gives the other one `listen_nod`. Both loops are fine from any frame and blend in from the stand (`blendIn` 0.3–0.4 s). Nothing else is needed. The `pair` field on the talks (`listen_nod`, gap 1.3) is for the lab and the sheets only.
- **The gap.** The heads were measured at a 1.2 m gap (neck to neck, facing) on the real shader, every 0.05 s over 13 s, while the phases drift through each other. The heads stay ≥ 0.155 m apart (`talk_gesture` 0.161, `talk_gesture_b` 0.155, `talk_gesture_c` 0.196), with 0 head↔head, arm↔head, arm↔body or body↔body crossings. The closest the hands come is 0.067 m (the point in `talk_gesture_b`).
  - Below ~1.1 m the heads can meet, so keep talkers ≥ 1.2 m apart.
  - Every talk keeps the head ≤ ~0.12 rad pitched toward the partner, which is why `talk_gesture_c` laughs with the head thrown back.
- **Patrol.** life.js already moves the patroller at `REG.CLIP.patrol_walk.speed` (1.05 m/s) and restarts the clip at t 0 on each leg (`L.wt`). A ~1.15 m leg shows about 1.1 s of the clip, so the clip looks to +x first (0.2–0.75 s): every leg opens with a look along the street.
  - The "stop to look" between legs is life.js's own idle step.
  - Nothing to change.

### Checks (port 5491; the final tree is this branch merged with main at bd04a9d, the ride clips)

- **Hands** (`lower-motion-check --quick --clips`, the full bottom × shoe matrix, 4,662 fixtures):
  - On the tree merged with cece151: every clip (3,269 shader states), 8 shards, every count 0 (crossings, coplanar overlaps, opposite-leg, penetrations, leg/hand, foot/hand). PASS.
  - On the final tree: the five clips here (473 states, the gate filtered to them), every count 0. PASS. The ride clips were gated by their own agent; each clip's shader function is its own.
- **See-through** (`overlap-check --gate '&dbg=back' --clips`, my five clips' line-up actors only, every look, 4 shards, on both trees): 0 of 823,680 frames show inside faces (`talk_gesture` 99,000 · `talk_gesture_b` 110,880 · `talk_gesture_c` 87,120 · `listen_nod` 415,800 as the partner of all three · `patrol_walk` 110,880), PASS. The other clips were not re-run here: nothing of theirs changed (identity), and the orchestrator's `check.mjs --all` covers them.
- **elbow/identity** (main's new verdict, final tree): PASS within 1e-6 m (max 2.38e-7) over 18,403 look-states. The five clips here are listed as bending by design: elbows ≤ 1.45 rad, and `listen_nod` bends only for the chin, 30 of its 121 states. `clips/end-check.mjs`: PASS.
- **Forearm/hand triangles crossing the torso** (an arm probe on the real shader, every 0.05 s; counts summed over the clip):
  - On the bare body (torso / flank / core): `talk_gesture` 497 / 395 / 0, `talk_gesture_b` 672 / 224 / 0, `talk_gesture_c` 509 / 490 / 54, `listen_nod` 1,795 / 349 / 0, `patrol_walk` 0 / 0 / 0 (arm↔arm 1,361: the clasped hands).
  - On a slim fresh tee (Airbrush Memorial, the same fit as the tall tee): 1,263 / 4,977 / 109, 2,168 / 2,626 / 0, 738 / 4,275 / 115, 4,767 / 3,743 / 0, 1,892 / 75 / 0.
  - For scale, the pocket clip `deal_lookout` scores 3,860 / 848 / 1,392 bare and 7,864 / 6,292 / 1,847 on that tee: these sit at or under it. This is the arm's inner column grazing the chest corner whenever an arm comes forward (the arrest notes' baseline).
- **The puffer (Bubble Goose)** swallows the forward hands and the clasped ones:
  - talks: 2,353–7,666 torso and 8,839–10,195 flank crossings;
  - `listen_nod`: 16,319;
  - `patrol_walk`: 16,183, like `cuffed_walk`'s 10,812.
  - The forearms press into the padding; 0 crossings in the body core except `talk_gesture` and `talk_gesture_c` (≤ 29 a frame).
  - The raised hand of `talk_gesture_b` and the nodding listener touch the Goose's high collar (905 / 487 head-part crossings; deal_lookout shows 116).
  - The reach can't hold the hands any further out.
- **Feet.** The planted soles wander ≤ 30 mm over 12.5 s (the weight shifts' leg roll; the cast's weight-shift idle shows 28 mm). `listen_nod`'s heel-up foot rolls 50 mm. `patrol_walk` is on the walk's legs: 5.6–5.9 cm a contact by the lab probe, against 20 cm for `carry_box` by the same probe.
- **Pixels:** `shots/<clip>.jpg` (side and three-quarter, 12 frames; the talks shown alone on a dressed look). `shots/talk-patrol/`:
  - `conversation.webm`: two walkers 1.3 m apart. One cycles the three talks while the other listens, then they swap.
  - `street.webm`: four pairs at random phases and a cop on a beat in front of them.
  - `looks.jpg`: the talks on a baby tee and the Bubble Goose.

## The robbery on the elbow (the elbow-robbery agent, 2026-10-09)

slime liked the robbery clips and asked for them refined with the elbow. `rob_lunge_grab`, `run_getaway`, `hands_up_point` and `pat_pockets` were authored with one-piece arms (§ Where an elbow would help); they now bend the elbow with the 5-argument `cArm`. Only `robbery.js` changed.

### What the city depends on: unchanged

- Every `dur`, `next`, `shift`, `pair` (gap 1.15, delay 0.34), `moving` / `speed` / `stride`, blend time, and every root, foot, drop and step track is as before. The stage (`stage/vignettes.js`) needs nothing.
- `hit_stumble_back` and the four aim clips are untouched.
- `rob_lunge_grab` ends on the same clutch as `run_getaway`'s +x arm (the `CLUTCH` constant in `robbery.js`), so the flee at 1.05 s doesn't pop that arm. The −x arm pops as it did before, into the pump's phase.

### What changed, per clip

- **`hands_up_point`:** the hands shoot up BESIDE the head: the upper arms out, the forearms up and splayed a little, palms forward (`[.4, 1.22, 0, −1.35]`, elbow 1.25; the shoulders overshoot, the elbows ease in). That replaces the raised T. The hands land at the head's lower corners (chest frame y ≈ 1.0, x ±0.6). They can't go higher: the head is x ±0.5, y 0.9–1.7, and the arm is 0.525 m to the fingertips.
  - The tremble shakes the elbows too.
  - The point is straight ahead with a slight bend, twisted −0.3 so the bend folds outward (untwisted, the bend lifted the forearm into the head: 13 crossings a frame on the bare body, 71 on the Goose). Each jab snaps the elbow straight.
  - The −x arm comes down to a raised open hand out in front, shoulder high ("hey!"), not a straight arm out and down.
- **`rob_lunge_grab`:**
  - The wind-up chambers the fists: the upper arms pulled back (pitch −0.7), the elbows at 1.6, the fists at the hips. Before, the straight arms swung back.
  - The thrust's elbows snap straight a beat after the shoulders.
  - On the grab the elbows bend 0.2 and the yank pumps them ±0.15. The grab's yaw and pitch came down a hair (0.28 → 0.25, 1.32 → 1.26) so the bent fists don't meet.
  - The snatch brings the +x fist to the sternum: `CLUTCH = [.8, .35, 0, .7]`, elbow 1.3. The elbow is out at the side, the forearm across the chest, and the fist sits at chest-frame (0.13, 0.78, 0.38). The −x arm hangs, bent 0.2.
- **`run_getaway`:**
  - The −x arm pumps bent: pitch 0.1 ∓ 0.72, roll 0.3, twist −0.3, elbow 1.25–1.35 (more at the front), like `flee_run`. The front of the pump stops under the chin; 0.95 put the fist in the head.
  - The +x fist clutches the loot to the chest (`CLUTCH`), bouncing with the stride.
- **`pat_pockets`:**
  - The pocket slaps are as before, straight-armed; a bend there only added flank grazes.
  - The chest pats are now at the chest: `[.65, .45, 0, .55]`, elbow 1.4, the hands at chest-frame y 0.77. Before, they were straight arms across the belly at y 0.64. Each pat drops the hands off the chest and back (the pitch and the elbow).
  - The "where is it?" is a shrug: `[.15, .5, 0, −.6]`, elbow 1.4, the forearms out and forward, the hands out at the sides. Before, it was straight arms out and down.
  - The head drops 0.14 at the chest instead of 0.3: its front edge would come down onto the hands.

### How the poses were found

- A search through the real shader (transform feedback of `anim2Glsl()`, the cast's thick-refined mitre) over hundreds of candidate arm poses.
- Each pose was counted for forearm and hand crossings into the chest, its flank, the core and the head, on the bare body, a slim tee (`rip_airbrush`) and the Bubble Goose. The probe also gave the hand and elbow positions in the chest's frame.
- The hand can't come any closer to the chest than about 0.38 m in front of the chest's centre: the toon forearm then cuts the chest. The talk agent found the same.

### Forearm and hand crossings (that probe, every 0.05 s, summed over the clip; torso / flank / core / head; before → after)

| clip | bare body | slim tee | Bubble Goose |
|---|---|---|---|
| `rob_lunge_grab` | 286/13/6/0 → 19/9/0/0 | 952/1857/84/8 → 678/1717/0/0 | 2579/2922/198/597 → 1938/3197/0/880 |
| `run_getaway` | 150/1/0/0 → 0/0/0/0 | 440/358/0/0 → 159/201/0/0 | 1144/865/0/199 → 782/1057/0/0 |
| `hands_up_point` | 0/0/0/313 → 0/0/0/0 | 56/606/0/552 → 10/628/0/0 | 229/1714/0/2464 → 29/1415/0/237 |
| `pat_pockets` | 219/41/36/0 → 0/0/0/0 | 533/908/48/0 → 58/924/0/0 | 1340/3121/115/796 → 825/2564/89/275 |

- The flank counts are mostly the arm's inner column grazing the shirt's side. The stand alone shows 113–148 a frame on these tops.
- The Goose's head count in the grab went up (597 → 880). Its padded forearm reaches under the head's overhang while the elbows are bent on the yank (0.35–0.7 s). Everything else is at or under the old clips.

### Checks (port 5491)

- **Hands** (`lower-motion-check --quick --clips`, the full bottom × shoe matrix, 4,662 fixtures, 8 shards): PASS, every count 0 (crossings, coplanar overlaps, opposite-leg, penetrations, leg/hand, foot/hand).
  - It ran on these four clips only: 109 shader states, through a scratch copy of the gate with a clip filter, as the ride and talk agents did. The other clips are unchanged (identity, below).
- **See-through** (`overlap-check --gate '&dbg=back' --clips`, every look (495), 4 shards, these four clips' line-up actors): 0 of 164,340 frames show inside faces. PASS.
  - Per clip: `rob_lunge_grab` 47,520 · `run_getaway` 21,780 · `hands_up_point` 51,480 · `pat_pockets` 43,560.
- **`elbow/identity.mjs`:** PASS within 1e-6 m (max 2.38e-7) over 17,717 look-states.
  - 29 clips bend no elbow. The four here are listed as bending by design:
    - `rob_lunge_grab`: 29 of 31 states bend, elbow ≤ 1.60 rad.
    - `run_getaway`: 12 of 12, ≤ 1.35.
    - `hands_up_point`: 32 of 33, ≤ 1.28.
    - `pat_pockets`: 25 of 33, ≤ 1.40. Its pocket frames bend nothing and are in the verdict.
- **`clips/end-check.mjs`:** PASS.

### Pixels

`shots/elbow-robbery/<clip>.jpg`: each camera's row of the old clip (main at 4802d9c) over the new one, at the same times. The cameras are side, the +x side and the city's high three-quarter for the grab; side, three-quarter and city for the run; front, three-quarter and city for the hands up and the pockets. `shots/<clip>.jpg` for these four clips still show the one-piece arms.

## The elbow on transit and falls (the elbow-transit-falls agent, 2026-10-09)

Seven clips re-armed with the elbow: `stand_rail` and `hail_taxi` (`transit.js`); `lie_hurt`, `cower`, and the chain around `lie_hurt`'s first pose (`fall_back`'s and `shove_fall`'s ends, `get_up`'s start) (`falls.js`). Three items from § Where an elbow would help are done: a hand on a rail, a hand to the head, the forearm up to hail a taxi.
- **What the city times on is unchanged.** Every entry's numbers (dur, loop, hold, next, blends, moving, speed, stride, shift, pair) are the same. The other 53 clips' generated GLSL, the helpers and the dispatcher are byte-identical to main.
- **Not changed:** `car_get_in`, `car_get_out`, `turnstile`. A bend doesn't clearly help there.
  - The door-frame hand would need to stay planted while the body travels 0.3–0.55 m, and the arm's reach shell is only 5 cm deep (below).
  - The card tap already lands its hand where a bent arm would.

### The clips

- **`stand_rail`:** the +x hand GRIPS the pole (body frame x 0.52, z 0.27, the city's `RAIL`), the elbow bent down and back, at y 0.60 (belt height).
  - The old straight arm was aimed at y 0.72, and its hand stopped 8–11 cm off the pole.
  - Now the grip sits on the pole exactly (0.0 mm) through the loop. On the brake (1.7–2.3 s) the shoulder comes inside the reach shell and it slips ≤ 6 mm.
  - The free arm has a soft elbow (0.3) that trails its swing: straighter going on with the brake, folding as it comes back.
  - The breath is now two 3 s breaths a loop. The idles' 3.6 s breath didn't divide the 6 s loop and popped the chest and head 25 mm at every wrap (now 0.02 mm).
- **`hail_taxi`:** the upper arm out to the street side, the FOREARM UP, the fist beside the head (y ≈ 1.03 in the body frame; the old straight arm stopped ~16° above level).
  - On the way up the hand runs a curve out to the side, below the head, then up. The Euler-blended arm had carried the fist 6–12 cm through the head's corner.
  - The "hey!" has one wave. The hold has a two-beat wave every 1.3 s, moving outward, never in toward the head.
  - The fist clears the head everywhere: ≤ 3 hand vertices touch it, ≤ 1 mm deep. The blend-out also stays clear: an elbow out to the side keeps the Euler path a side-raise.
- **`lie_hurt`:** the +x hand HOLDS THE SIDE OF THE HEAD, the elbow out on the ground. The hand rides the head's roll, rubs it (3 strokes a loop) and clutches on the spasm.
  - The old hand sat 25–33 cm inside the face; now ≤ 15 hand vertices, ≤ 4.6 cm, at the head roll's far end.
  - The −x hand stays on the chest, but drops and rolls out a little as the head rolls and curls (0 at the loop's seam).
    - The chin used to land on it: 170 vertices, 16 cm deep. Now ≤ 29 vertices, ≤ 3.1 cm.
    - Dropping it further puts it in the drawn-up knees: the hand gate catches that.
- **`fall_back` / `shove_fall`:** they land into the new hand-to-head pose.
  - `fall_back` now starts from the plain stand's arms (roll 0.04, was 0.06), so `shot_hit` → `fall_back` is exact (it was a 10.9 mm pop).
- **`get_up`:** starts with the +x hand on the head (the old start had it 25–29 cm inside the face).
  - The hand comes down to the push behind the hips by the IK: its target runs on a curve out at the side, and the elbow's pole turns from LB's to PUSH's.
  - It reaches PUSH.R exactly. From 0.9 s the arm is handed to PUSH.R's own angles, so from 1.0 s it is main's arm.
  - A straight Euler blend from the head to the push swept the fist through the face and then the drawn-up knees: the hand gate failed at 0.70–0.75 s, about 65,000 leg/hand crossings.
  - The reach forward at 1.7–2.3 s put both fists 8–9.5 cm up into the chin, as on main then. Fixed in 0fe1230: `REACH`'s pitch went from 1.6 to 1.0, so the arms reach forward and a little down, the fists out by the knees.
    - Now 0 on the mannequin, `tall_tee`, `gatehill_mink` and `bubble_goose`. `old_puffer`'s wide cuff still grazes the chin: 7 vertices, ≤ 1.9 cm (was 11.5 cm).
- **`cower`:** the hands are clamped over the lower sides of the head, the elbows forward and down. They ride the head as it ducks and peeks, slip forward on the peek and press in on the flinch.
  - The old fists sat in the head's bottom-front edge (64–68 vertices, 7.7 cm deep). Now 0.

### How: the IK, the reach shell, the hands that ride the head

- **The IK.** Both files carry the two-bone IK of `talk-patrol.js` / `work.js` (targets in the chest's rest frame).
  - `falls.js` adds `ikv()`, which returns the angles and the elbow as locals so a clip can blend them.
  - It also adds `onHead(p)`: a point of the head's rest frame where the head is now (the head turns about the neck, walk2.js).
- **Why a head target keeps the chains exact.** A hand target on the head makes the arm a function of `P.head` alone. `fall_back`, `shove_fall`, `lie_hurt` and `get_up` all set the head first and call the same `LB_R()`, so their shared pose is the same arm.
- **`stand_rail`'s grip** takes the pole into the chest frame from where the chest is now. It uses walk2.js's standing pelvis (as high as both ankles allow), which is why the breath goes in before the IK.
- **The reach shell.** The toon arm reaches only 0.40–0.45 m from the shoulder for elbows of 26–83°. The face (0.45 m ahead) and anything above the head's bottom edge near its middle are out of reach, so a hand goes to the head's LOWER SIDES.
- **The mitten.** The hand is 0.25 m deep, and that depth lies in the bend's plane, pointing back up the upper arm.
  - With the elbow out to the side (the hail, the lying hand), it points at the head.
  - So those targets sit 0.16–0.17 m off the head's side: x 0.665–0.67, where x ±0.5 is the side.

### What the city needs to know

Nothing changes in the city:
- The subway's poles are full-height columns at `RAIL`, so the lower grip needs nothing.
- The hail's arm is still the +x one.
- `lie_hurt` → `get_up` still switches at a 2 s wrap.

### Checks (port 5497; the final tree)

- **Chains, on the real shader** (max vertex Δ; 6 looks: the mannequin, old_puffer, bubble_goose, tall_tee, stolen_safe, snatched_piece):
  - ≤ 0.0002 mm: shove_fall → lie_hurt, fall_back → lie_hurt, shot_hit → fall_back (was 10.9 mm), death_collapse → lie_still, get_up → the stand.
  - 0.0000 mm: lie_hurt at 0 and at 2 s → get_up.
  - The loops' wraps: stand_rail 0.02 mm (was 24.8), cower 0.14 mm, lie_hurt 0.24 mm.
  - **Not mine, as on main then:**
    - `shot_hit_dead` → `death_collapse` popped 21.8 mm: the arms' roll 0.04 vs 0.08. Fixed in 0fe1230: `death_collapse` starts from the plain stand's roll (0.04), `shot_hit_dead`'s end, so the chain is exact (21.8444 → 0.0002 mm on the real shader). Its sheets: `shots/falls-seams/`.
    - Still open: with a HELD thing, `shot_hit` → `fall_back` / `death_collapse` pops 0.14–0.71 m: the hold's arms vs the bare stand's. Drop held things before a shot.
- **The hand gate** (`lower-motion-check --quick --clips`, the full bottom × shoe matrix, 4,662 fixtures, 6 shards; a copy of the gate filtered to my seven clips, 369 shader states). Run on the final tree (main at 71acfd7, the robbery clips, merged in): every count 0 (crossings, coplanar, opposite-leg, penetrations, leg/hand, foot/hand). PASS.
  - The first run caught `get_up`: the straight Euler blend, at 0.70–0.75 s.
  - It also caught a deeper drop of `lie_hurt`'s −x hand, into the knees.
- **The see-through gate** (`overlap-check --gate '&dbg=back' --clips`, every look (495), 6 shards, the final tree): 0 of 645,480 frames show inside faces. PASS.
  - It covered the line-up actors of my clips and `shot_hit`, whose chain plays `fall_back` → `lie_hurt`: `stand_rail` 134,640 · `hail_taxi` 53,460 · `fall_back` 81,180 · `lie_hurt` 57,420 · `shove_fall` 87,120 · `get_up` 73,260 · `cower` 61,380 · `shot_hit` 97,020.
- **Hands against the head** (my probe: hand vertices inside the head's box, every 0.05 s, mannequin):
  - `cower` 64–68 / 7.7 cm → 0.
  - `lie_hurt` +x 268 / 33 cm → 15 / 4.6 cm; −x 170 / 16 cm → 29 / 3.1 cm.
  - `get_up`'s start 268 / 29 cm → 3 / 3 mm.
  - `hail_taxi` ≤ 3 / 1 mm, in the hold and on the blend-out.
- **`elbow/identity.mjs`** (the final tree): PASS within 1e-6 m (max 1.19e-7) over 15,876 look-states.
  - My seven are listed as bending by design: `stand_rail` and `hail_taxi` ≤ 1.45 rad; `lie_hurt` ≤ 0.50; `cower`, `fall_back` and `shove_fall` ≤ 0.47; `get_up` ≤ 1.45 (its push, as before).
- **`clips/end-check.mjs`** (the final tree): PASS.
- **Sheets** (`shots/elbow-transit-falls/`): `<clip>.jpg`, before | after side by side, the same times and cameras (stand_rail with its pole drawn). `looks.jpg`: the four poses on the Bubble Goose, the Gatehill Mink and a baby tee.

## Deal and hang on the elbow (the elbow-deal-hang agent, 2026-10-09)

slime asked for the older clips refined with the elbow. `deal_pace`, `deal_lookout`, `brush_pass`, `lean_wall`, `sit_stoop` and `sit_bench` were authored with one-piece arms (a straight arm pitched in to the belly for "hands in the pocket", a straight arm hung over the knees); they now bend the elbow with the 5-argument `cArm`. Only `deal-hang.js` changed.

### What the city depends on: unchanged

- Every `dur`, `loop`, blend time, `pair` (`brush_pass` with itself, gap 1.02, delay 0), root move (`deal_pace`'s walk and pivots, `lean_wall`'s plank lean), foot, step, drop, sway and seat is as before. `simstate/life.js` and `stands.js` need nothing.
- The chest and head tracks are as before too: only the arms changed.
- `brush_pass` still meets at the midline: the +x hand at the contact (0.2–0.35 s) is 1 cm further out than before (body frame z 0.375–0.39 against 0.363–0.381), so the pair gap stays 1.02 m.

### What changed, per clip

- **The pocket** (`deal_pace`, `deal_lookout`, `lean_wall`, `brush_pass`'s end): `[.54, .38, .32, .5]`, elbow 0.85. The elbows bend and sit out at the sides, the forearms come in to the belly, the hands rest just in front of it (chest frame x ±0.16, y 0.63, z 0.37). Before, it was a straight arm pitched 0.85 and yawed in, the hands meeting in front of the crotch in a V.
  - Held, it puts no forearm in the body's core on any probe look (bare, slim tee, Goose, `old_hoodie`). `deal_lookout`'s few core crossings (18–24 over the clip, at most 8 a frame) come at 4.2 s, mid-way through the −x hand coming out. A first try with the elbows bent more (`[.38, .32, .42, .35]`, elbow 1.05) put the forearms into the core on the tee and the Goose.
- **`deal_pace`:**
  - The +x hand in the pocket bobs with the steps, the elbow too.
  - The loose −x arm swings with a soft elbow (0.15, up to 0.5 at the front of the swing), twist 0.1. A twist of 0.3 put the bent hand into the thigh at the start of the walk (4 leg crossings a frame), so it stays near the old twist.
  - New: at the stop (1.75–2.7 s, looking at the street) the −x hand goes in the pocket too, and comes out for the pivot.
- **`deal_lookout`:**
  - Both hands in the pocket.
  - On the double-take the −x hand comes out and hangs ready: `[.3, .16, .05, .35]`, elbow 0.45, the forearm a little forward. Before, it was a straight arm.
  - New: on the exhale (5.0–5.9 s) the elbows open by 0.25 and the arms drop 0.06, as if the hands push down in the pocket.
- **`brush_pass`:**
  - The forearm leads out: the elbow is bent 0.7 as the hand comes up off the thigh (0–0.1 s), opens into the dap (0.06 at the contact, for the reach), and bends again to take the thing in to the hoodie's front pocket (0.38–0.58).
  - Before, the hand went back out and down to the hip pocket at the side of the thigh. The hoodie pocket reads as the stash at street distance and keeps the hand off the leg.
  - The −x arm's counter-swing has a soft elbow.
- **`lean_wall`:**
  - Hands in the pocket. The shoulder roll (6.5–7.3 s) lifts the elbows (+0.15, out 0.08).
  - The chin rub is now a bent arm: `[.6, .1, .25, .2]`, elbow 1.4, the forearm up and the hand under the chin, rubbing off the elbow and the shoulder. Before, it was a straight arm raised to the face.
- **`sit_stoop`:**
  - The forearms rest on the knees: `[1, .2, 0, .6]`, elbow 0.9. The upper arms come down over the thighs, the forearms hang forward from the knees, and the hands hang loose in front of them (body frame y 0.38–0.40, z 0.49–0.54; the knees' tops are at y 0.22, z 0.32). Before, the straight arms hung forward over the knees.
  - Head down (2.9–4.1 s): the hands come together (`[1.05, .1, .14, .6]`, elbow 0.9) and rub. They slide past each other (pitch, yaw and elbow), touching: 161 arm↔arm crossings summed over the clip.
  - Sat up (4.4–5.6 s): the hands rest on the knees at the sides, out wide (`[.55, .4, 0, .4]`, elbow 0.9). The first try (`[.6, .3, 0, .6]`) failed the hand gate: at 4.6 s, as the chest turns to look back, the −x hand brushed the collar of one high-top (`old_opus2_porcupine_hi`, 4 crossings, on every bottom).
- **`sit_bench`:**
  - The backrest arm: the upper arm goes further back along the rail (`[-.7, 1.2, -.2, .5]`), and the elbow (0.5, twisted so it folds down) drapes the forearm over it. The hand stays where the straight arm's was in depth (body frame z −0.24 against −0.25) and hangs 9 cm lower. Its tap now comes off the wrist and the elbow (the elbow pumps 0.25).
  - A first try kept the old line with the bend (`[-.45, 1.2, 0, .5]`, elbow 0.35): the forearm curled forward and the hand came 15 cm toward the front, beside the body instead of along the rail.
  - The −x hand on the thigh is a relaxed elbow (0.3).
  - The lean forward puts the forearms on the knees, as in the stoop: `[.95, .25, 0, .8]`, elbow 0.75.

### What the arm can't do here

- **Folded arms** (the talk agent's finding): the hands would have to reach 0.55 m from the shoulder, and the arm reaches 0.40–0.45 m.
- **A hand ON a thigh or a knee:** any hand-on-leg contact fails the hand gate. Every sat hand hangs just clear of the legs.
  - On the bench, every pose that brought the −x hand lower onto the sloping thigh crossed it (44 or more leg crossings a frame). It stays where it was, at the hip crease, just over the thigh.
- **Thumbs in the waistband, hands in the jeans pockets:** the hand would sit on the thigh's top rows (the hand gate). The hoodie's front pocket is the only pocket.
- **Hands behind the back against the wall** (`lean_wall`): the wall is ~0.2 m behind the walker's spot, and the hands would go into it.

### How the poses were found

- A search through the real shader (transform feedback of `anim2Glsl()`), on the clip at a given time, with the arms (and the chest and head) overridden through the elbow lab's hook. About 2,000 candidate poses.
- Each pose was counted for forearm and hand crossings into the chest, its flank, the core, the head, the other arm and the legs, on the bare body, a slim tee (`rip_airbrush`), the Bubble Goose and (for the pocket) `old_hoodie`. The probe also gave the hand and elbow positions in the chest's frame and the body's.
- The best few were looked at on a hoodie, at the front, side and three-quarter cameras.

### Forearm and hand crossings

The same probe as the robbery notes, every 0.05 s, summed over the clip. Counts are torso / flank / core / head / legs.

| clip | bare body | slim tee | Bubble Goose |
|---|---|---|---|
| `deal_pace` | 1400/242/96/0/0 → 675/284/0/0/0 | 3267/7815/128/0/0 → 2492/5735/0/0/0 | 8518/13793/112/48/0 → 10382/11037/0/0/0 |
| `deal_lookout` | 3860/848/1392/0/0 → 1440/1028/18/0/0 | 7864/6292/1847/0/0 → 5081/5887/24/0/0 | 17153/13127/1509/116/0 → 20556/10098/21/44/0 |
| `brush_pass` | 115/17/48/0/0 → 181/71/50/0/0 | 278/1333/143/0/0 → 451/1338/194/0/0 | 933/1960/335/0/39 → 1316/1776/443/0/36 |
| `lean_wall` | 4678/897/1782/810/0 → 1916/998/0/804/0 | 10219/4672/2376/1183/0 → 6116/5286/0/804/0 | 21695/13249/1918/4325/0 → 25745/10495/0/2214/0 |
| `sit_stoop` | 52/52/0/2249/0 → 0/0/0/561/0 | 6495/2955/0/3573/0 → 3814/3898/0/561/0 | 13538/9669/0/11578/0 → 9387/12653/0/3231/0 |
| `sit_bench` | 1391/961/0/0/0 → 1484/812/0/0/0 | 3906/7120/0/32/0 → 3890/5062/0/0/0 | 6572/10751/0/1233/0 → 9593/8815/0/183/0 |

- The pocket clips drop sharply on the bare body and the tee, and lose almost all their core crossings, because the old straight arm's upper end went into the chest.
- On the Goose the padded forearms press into its front a little more than before (torso about +20 % on the pocket clips, +46 % on `sit_bench`), with less flank. Its core is 0–21 against 112–1,918 before, and every head count goes down (`lean_wall` 4,325 → 2,214, `sit_stoop` 11,578 → 3,231).
- `sit_stoop`'s head count drops (2,249 → 561 bare): the bent forearms stay under the big head when it looks down.
- `brush_pass` is up a little (bare 115/17/48 → 181/71/50, tee 278 → 451 torso): the bent forearm grazes the flank on its way out and back in to the pocket.
- The legs stay at 0 on every clip and look except the Goose's `brush_pass` (39 → 36: its padded sleeve on the thigh at the dap, as before). The hand gate below is the real check, on every bottom and shoe.

### Checks (port 5491)

The final tree is this branch merged with main at 0fe1230 (the transit/falls elbow pass, then the falls seam fix). Every gate below first passed on this branch alone, then on the merge with cd01a8a. On the merge with 0fe1230 (only `falls.js` moved; every other clip's name, timing, GLSL and id hash the same) the hand gate, identity and end-check ran again and pass; the see-through numbers are from the cd01a8a merge.

- **Hands** (`lower-motion-check --quick --clips`, the full bottom × shoe matrix, 4,662 fixtures, 8 shards): PASS, every count 0 (crossings, coplanar overlaps, opposite-leg, penetrations, leg/hand, foot/hand).
  - It ran on these six clips only: 738 shader states, through a scratch copy of the gate with a clip filter, as the ride, talk and robbery agents did. The other clips are unchanged (identity, below).
  - An earlier run on this branch caught `sit_stoop`'s first sat-up pose on one high-top at 4.6 s (above). The pose was widened and the whole matrix re-run.
- **See-through** (`overlap-check --gate '&dbg=back' --clips`, every look (495), 10 shards, these six clips' line-up actors): 0 of 851,400 frames show inside faces. PASS.
  - Per clip: `deal_pace` 134,640 · `deal_lookout` 154,440 · `brush_pass` 19,800 and its partner 19,800 · `lean_wall` 178,200 · `sit_stoop` 162,360 · `sit_bench` 182,160.
- **`elbow/identity.mjs`:** PASS within 1e-6 m (max 1.19e-7) over 10,710 look-states.
  - 17 clips bend no elbow, 43 do. The six here are listed as bending by design, every state of each: `deal_pace` elbow ≤ 0.89 rad, `deal_lookout` ≤ 0.85, `brush_pass` ≤ 0.85, `lean_wall` ≤ 1.46 (the chin; under the thick sleeve's 85° soft cap), `sit_stoop` ≤ 1.00, `sit_bench` ≤ 0.75.
- **`clips/end-check.mjs`:** PASS.

### Pixels

`shots/elbow-deal-hang/<clip>.jpg`: each camera's row of the old clip (main at 71acfd7) over the new one, at the same times, on a black hoodie (`old_hoodie`) so the arms read against the body. Loops are shown one period in, after the blend-in.
- `deal_pace`, `deal_lookout`: three-quarter, front, city.
- `brush_pass` (the pair): side, three-quarter, city.
- `lean_wall`: front, three-quarter, city.
- `sit_stoop`: side, front, city.
- `sit_bench`: front, side, city.

`shots/<clip>.jpg` for these six clips still show the one-piece arms (§ The lab and the checks).

## Moods and reactions (the K agent, 2026-10-10)

Two new groups for the visible-highs plan (`ai-city/reviews/2026-10-10/visible-highs-plan.md` §1, §2): `high.js` (family `moods`) and `react.js` (family `react`), plus the phone, `phone-prop.js`. The city side (`simstate/moods.js`, the effects, the chips, the barks, `simstate/react.js`) is built later, from these.

### The moods: one look per behaviour family

Live, a viewer sees only the family, never the drug. SPACED is ONE look for hallu, clear and sudo, so there are exactly three of each kind:

| family | walking (overlay, the walker's pace) | standing (loop) |
|---|---|---|
| WIRED | `wired_walk` (1.2 s): bent fists pumping hard off the walk's arm phase, the elbows out, the shoulders driving and forward, the chin up; a sharp nod at every step; a twitchy glance to +x at 0.5–0.9 s | `wired_bounce` (1.2 s): a boxer's bounce on the balls of the feet (heels up, two a loop, the weight shuffling side to side), the −x foot forward, the fists up in the guard in the reach band; a jab with the lead (−x) fist at 0.62–0.86 s, the chest turning into it |
| SPACED | `spaced_walk` (4.8 s): wide, loose arms that trail the legs (a lag of 0.19 cycle against the walk's 0.07) and flop (the elbow folds as each arm swings back); a big, late torso roll; slumped back, the face to the sky, the head lolling over to one side and the other and drifting round once a loop | `spaced_drift` (6 s): a slow circling sway (twice a loop), the head lolling behind it; the +x arm floats up and out to the front-side (0.9–2.4 s) and reaches at nothing twice (2.5–3.7, the forearm opening out), floats down (3.8–5.2); the head watches it |
| GUARDED | `guarded_walk` (4.8 s): hands in the hoodie pocket (deal-hang's pocket, bobbing with the steps), hunched, the chin down; a quick scan over the +x shoulder (0.3–1.35 s) and over the −x (2.7–3.75): one every 2.4 s | `guarded_stance` (4.8 s): hands in the pocket, hunched, the chin down; a glance over the +x shoulder at 1.0 s (the weight onto the −x foot, the +x heel up), back by 2.2; over the −x at 3.2 s, back by 4.4 |

**What tells them apart from the city camera (~25 m, looking down).** Most of a figure there is its head, so the families are built on the head's attitude first and the arms second:
- WIRED shows the face (chin up) and two fists pumping out at the sides.
- SPACED shows the face tipped to the sky, the head tilted and wandering; loose arms out wide; standing, one arm floats out to the side.
- GUARDED shows the crown (chin down), no arms (they are in front, in the pocket), and big head turns.
- `shots/moods/filmstrip-25m-*.jpg` and the webms show them side by side at the city's pixel size. The plan's H1 layer (moods.js: the step factor, the fake turn rate, the head springs) adds to this.

### The walking overlay convention: `moving: true, stride: 1, speed: 0`

A clip that rides ON a walk the walker is already doing, at its own pace (the moods' walks, `rubberneck_walk`):
- **`speed: 0`:** the owner does NOT drive the walker. Its own movement (pedsim, the agent's route) moves it, and the clip plays on top. A moving clip with `speed > 0` (`run_getaway`, `patrol_walk`) is still driven at its speed, as before.
- **`stride: 1`:** `playClip` sets `g.scale` to 1, the walk's own cycle length, so the cadence follows the speed as for any walker.
- **They write no root and no leg channel:** no `cLegK`, `cMov`, `cRot` or `cPiv`, and none of `P.ank`, `P.fp`, `P.drop`, `P.bodyX`, `P.pRoll` (or `cFoot`). Only the chest, the head and the arms. So the legs and feet are the walk's, bit for bit (checked on the real shader: 0 m over every leg vertex, below), there is no foot slide and no root motion, and the travel speed is untouched.
- **The arms run off the walk's cycle `u`.** walk2.js swings the +x arm with `cos 2π(u − .07)`, so a quicker cadence (the step factor below) speeds the pump up too.
- **Everything that rides the walk is scaled by its weight `w`.** A walker that stops mid-clip eases into the clip's standing version of the look; the city switches to the family's standing loop when it stands.
- **The lab** walks a speed-0 overlay at its `&v` (default 1.2 m/s), so the line-up and the see-through gate see it walking. The hand gate and `elbow/identity.mjs` sample it at the walk's `vRef` (they used `c.speed`, which is 0 here; a no-op for every older clip, all of whose moving clips have a speed).
- **The static check** (the moving clips of `moods` and `react`: stride 1, speed 0, none of those 12 root and leg names in the generated GLSL) passes.

### The step factor `g.aK` (gait2.js `sub()`)

`at = clamp(at × (g.aK ?? 1), LEVELS[0], 1)`: shorter steps at the same speed, so a quicker cadence. The plan's H1 sets it per family (wired ×0.7, spaced ×0.85, guarded ×0.8); the clips never touch it.
- **Unset or 1, the walk is bit-identical.** `× 1` is exact, and the clamp leaves the value alone (it is already in [0.4, 1]).
- **Proof:** a differential trace against main (e064f3c)'s gait2.js: 400 random walkers × 2,000 steps (speed changes, stops, standing turns, a jittered dt, odd `g.scale`), aK unset and aK = 1. 30.4 M field comparisons by `Object.is`, 0 differ. `buildGait` is unchanged too.
- **Feet, aK in [0.6, 1].** The keyed leg is a function of the step size `a` and the cycle `u` alone, and the body travels `cycleLen(a)` per cycle at any speed. So a step size reached through aK plants the feet exactly as the plain walk already does at that step size, at a lower speed.
  - Measured on the real shader at 480 Hz: the contact point's slip per stance (each foot's lowest sole vertex within 1 mm of the ground, its world travel summed over the stance).
  - Ten pairs (v 0.9–1.6 m/s, aK 0.6–1), each against the plain walk at the same `a`: |Δ| ≤ 1.16 mm.
  - The step factor LOWERS the slip at a given speed (at 1.2 m/s: 38.5 mm a stance at aK 1, 25.2 mm at aK 0.6).
  - **The walk's own contact slides 23–39 mm a stance by this measure** (the hips' yaw and sway swing the planted leg; main's walk, not the factor). See § Checks.
- **The city's crowd copy** (`pedsim.js` imports the city's `anim/gait2.js`) gets the same line when it syncs. The plan's V agent mirrors it and checks the two match.

### `cLook`: the look yaw, for a clip

- walk2.js passes A2.y (the look yaw the idles already read for the crossing's glance) into `clipPose`, which sets the global `cLook`.
- Only `rubberneck_walk` reads it, so it is a no-op for every older clip: their generated GLSL is byte-identical and their posed bodies are bit-identical (§ Checks).
- The city points `g.look` at the incident: the yaw to it relative to the walker's heading, wrapped to ±π. Ease it there, because the clip can't (it is stateless).

### `film_phone` and the phone (`phone-prop.js`)

- **The pose.** A 3 s standing loop:
  - The phone is held out at chest height in landscape by the +x hand, the arm nearly straight. The grip sits in the reach band, ~0.45 m ahead of the chest and ~0.68 m up.
  - The eyes are on the screen; the head pitches down only 0.06–0.09 rad, because the big head's front edge must stay over the phone.
  - A slow pan with the action, once a loop. A look up over the phone at the real thing at 1.3–2.1 s.
  - The −x arm hangs. In the hoodie pocket its fist met the phone's far end.
- **Why landscape, at chest height.** The toon head owns everything above y 0.9 out to x ±0.5 and z 0.45, and the arm reaches 0.40–0.45 m. A portrait phone's top would be in the chin, and a phone up at the eyes would be inside the head.
- **The model.** 0.30 × 0.15 × 0.025 m, about twice a real phone, as the fist is twice a real hand.
  - The fist holds its +x end; the rest reaches in front of the chest toward the midline.
  - A loud case (`SCHEMES`: pink by default, cyan, yellow, lime, white, black): a white case, lit flat, read as the grey of a hoodie.
  - The screen is the −z face, toward the holder; the camera bump is on the back at the far end.
- **The API** (as the gun's):
  - `GRAIN`, `PHONE` (`grip` [0, 0, 0], `lens`, `screen`, `dir` [0, 0, 1]: where it films), `SCHEME`, `SCHEMES`.
  - `phoneCells(scheme?)`, `phoneGeometry(THREE, scheme?)`, `phoneMatrix(THREE, pose, out)`, `phonePoint(pose, q)`, `phoneDir(pose, d)`.
- **The clip's `prop`.** `{ id: 'phone', geometry(THREE, scheme?), pose(t), matrix(THREE, t, out), lens(t), track(t) }`. `pose(t)` → `{ p, R, show }`, body frame.
  - The body is ONE track of expressions valid in GLSL and JS (robbery.js's aim clips' method).
  - The CPU runs walk2.js's forward kinematics to place the phone, so the fist and the phone cannot part.
  - To world: the walker's matrix × `matrix`. Show it while the clip's weight is ≥ 0.6.
- **Held things.** The clip owns both arms, so a held thing would ride the phone hand. Hide held things while filming, as while riding.

### `rubberneck_walk`

- **The overlay.** A walking overlay (3 s loop). The eyes go on `cLook`, clamped to ±1.35 rad: the head turns ≤ 1.11 rad on the chest and the chest ≤ 0.24 on the hips. A curious tilt toward it.
- **Past the clamp the walker should stop and turn.** More chest turn swung a hanging hand into the passing thigh.
- **The arms.** The walk's arm swing is damped and the arms are a little wider. A walker holding something keeps its hold's arms (the clip checks `aGrip`).
- **The glance.** A glance back at the path ahead at 1.9–2.75 s.
- **The lab.** It sweeps the look yaw −1.6 → 1.6 over each play (the entry's `glance` field, lab only), so the line-up and the see-through gate turn the head through its whole range. `&glance=a[,b]` overrides it.

### The lab (lab.js, a few lines)

- A speed-0 moving clip walks at `&v`.
- `&only=<clip>,…` lines up just those clips; `walk` and `stand` are a plain walker and a plain stander.
- `&glance=a[,b]` sets the look yaw.
- `&aK=` sets every actor's step factor.
- `&campos=x,y,z&camtgt=x,y,z&fov=` gives a camera of your own: the 25 m sheets use fov 22° on 640 × 360 tiles, the city's pixel size at 1080p and fov 60°.
- Without these parameters the lab is as before.

### What the city needs (later: V moods, R reactions)

- **Requesting a mood clip.**
  - `playClip(w.g, 'wired_walk')` while the agent walks and `'wired_bounce'` while it stands. Switch at a stop or a start, through `stopClip` (each blends from the bare walk or stand).
  - Don't move the walker for a speed-0 clip: its own route does.
  - The standing loops are fine from any frame.
- **The overlays own both arms** (except `rubberneck_walk`). A held thing rides the hand into the pocket or the pump. Skip the arm clips for walkers holding something, or hide the held thing.
- **Head springs.** The plan's H1 head springs add to `P.head` after the clip. At their extremes these clips already turn the head up to 1.11 rad on the chest (`rubberneck_walk`) and pitch it back up to ~0.26 rad (`spaced_*`). Re-run the see-through gate with the springs at their limits on the allow-listed clips (the plan's §4).

### Checks (port 5770; this branch on ai-city-fresh main e064f3c)

- **The full clip gates** (`node style/check.mjs clips`, `FRESH_URL` on this branch's server, 556 jobs, 12 at a time, 2 h 05 min wall): PASS on every clip, old and new.
  - **End frames** (`clips/end-check.mjs`): PASS (68 clips, 22 one-shots; 123,539 frames checked at 60 fps, 30 fps, jittered and at the float32 edge).
  - **Elbow identity:** PASS within 1e-6 m (max 1.19e-7) over 11,137 look-states.
    - 18 clips bend no elbow (`rubberneck_walk` among them).
    - The seven new clips that bend by design, every state of each: `wired_walk` 25/25 ≤ 1.37 rad · `spaced_walk` 97/97 ≤ 0.68 · `guarded_walk` 97/97 ≤ 0.90 · `wired_bounce` 25/25 ≤ 1.45 · `spaced_drift` 121/121 ≤ 1.36 · `guarded_stance` 97/97 ≤ 0.85 · `film_phone` 61/61 ≤ 0.33.
  - **Hands** (`lower-motion-check --quick --clips`, the full bottom × shoe matrix): 68 clips (4,116 shader states) × 4,662 fixtures (1,323 geometries), 504/504 shards. Every count 0 (crossings, coplanar, opposite-leg, penetrations, leg/hand, foot/hand), PASS.
  - **See-through** (`overlap-check --gate '&dbg=back' --clips`, every look (495), 50 shards): 0 of 5,941,980 frames show inside faces, PASS. The line-up walks the overlays at 1.2 m/s and sweeps `rubberneck_walk`'s head through its whole range.
- **The overlays' legs are the walk's, bit for bit.** The real shader, every leg vertex (thighs, shins, feet), the clip against the plain walk: 0 m (exactly) over 1,440 states per mood walk and 4,320 for `rubberneck_walk` (cLook −1.6 / 0 / 1.2).
  - Sampled at 5 step sizes (0.4–1), walk weights 1 / 0.6 / 0.25 (starting and stopping) and 24 cycle phases.
  - On 4 looks: the bare body, `old_hoodie`, `old_cargo`, `bubble_goose`.
- **The static check** (`moods` / `react` moving clips: stride 1, speed 0, no `cLegK` `cMov` `cRot` `cPiv` `P.ank` `P.fp` `P.drop` `P.bodyX` `P.pRoll` `P.turnRoll` `cFoot` `aFootRoll` in the generated GLSL): PASS.
- **Loop seams** (the clip at t = D, unwrapped, against t = 0; every vertex; the moving ones at 6 walk phases; 4 looks): ≤ 0.00083 mm (`film_phone`); the walks ≤ 0.00024 mm.
- **The phone** (the real shader's +x grip point against `prop.pose(t).p`, every 0.05 s, 7 looks):
  - The grip ≤ 0.0008 mm; the hand's axes match the prop's to 1.5e-6.
  - The phone's slab never enters the head or the chest box. No body vertex but the holding arm's comes within 5 mm of it.
- **Every older clip is unchanged.**
  - The 60 old clips' generated GLSL functions, bodies, entry numbers and ids are byte-identical to main (e064f3c). The helpers gained only the `cLook` declaration.
  - Their posed bodies are bit-identical: an FNV hash of every vertex, main's shader against this branch's, over every old clip every 0.05 s, the walk, turns and idles, × 7 looks. 28,756 look-states (24,724 of them clip states), 0 differ.
- **gait2 `aK`:** bit-identity and the matched-pair slip as in § The step factor.
- **Forearm and hand crossings** (the robbery notes' probe, every 0.05 s, summed over the clip; torso / head / legs / core; bare body · slim tee `rip_airbrush` · Bubble Goose):
  - `wired_walk`, `spaced_walk`, `spaced_drift`, `rubberneck_walk`: 0 everywhere.
  - `guarded_walk` 1,067 / 0 / 0 / 0 · 3,837 · 15,422 and `guarded_stance` 1,067 · 3,815 · 15,895: torso only. This is deal-hang's pocket, at or under `deal_lookout` (1,440 · 5,081 · 20,556).
  - `wired_bounce` 3 · 100 · 685: torso only.
  - `film_phone` 113 · 1,331 · 2,991, plus 14 head crossings on the Goose: its padded forearm under the head's front edge as the eyes come back to the screen at 2.15 s.
  - Over the overlays' full grid (16 phases × 2 step sizes × 2 walk weights × the clock, and 5 look yaws for `rubberneck_walk`), hands against legs: 0. The hand gate above is the real check.

### Pixels

`shots/moods/` (all on this branch's shader, the lab):
- **`<clip>.jpg`, the 8 clips.** Each has six rows: three looks (L1 `corner_hoodie` / `ash_sweats`, L2 `bubble_goose` / `raw_indigo`, L3 `tall_tee` / `stoop_jorts` with a fitted cap), each at the mid camera (the clip scene's tq, ~5 m) and the close one (~3.5 m). Every row is 8 key frames over one loop.
  - The walking overlays walk in place at 1.2 m/s: that is their walking strip.
  - `rubberneck_walk` shows the lab's look sweep.
- **`filmstrip-25m-{walks,stands,react}-L{1,2,3}.jpg`: the city distance.** The line-up at ~25 m (fov 22° on 640 × 360 tiles = the city's pixel size at 1080p and fov 60°), each figure cropped and shown 2× (nearest), 12 frames.
  - walks: plain walk, `wired_walk`, `spaced_walk`, `guarded_walk`.
  - stands: plain stand, `wired_bounce`, `spaced_drift`, `guarded_stance`.
  - react: plain stand, `film_phone`, plain walk, `rubberneck_walk`.
  - `compare-25m-*-L1.jpg` are the uncropped sheets.
- **`{walks,stands,react}-25m.webm`:** the same line-ups moving, 6 s, at the city's pixel size (×2).

## Refine: floating props, the draw, the sack, the hammer (the anim-refine agent, 2026-10-16)

slime watched the clips play in the lab (10-15): "how come some of the objects are floating at the start, like guns, the loot carry is a bit off like the sack looks weird and should have a bit of movement, like aim draw the gun floats in mid air, hammering seems a bit off". Four fixes, nothing else:
- The other 83 clips' generated GLSL, ids and entry numbers are byte-identical to main (7355dd1), and so are the helpers and the dispatcher.
- The four whose GLSL changed are `aim_draw`, `aim_lower`, `loot_carry` and `bench_hammer`. Every `dur`, `loop`, `next`, `shift`, `pair`, blend time and beat time is as before: `bench_hammer`'s `strikes` are still 0.6, 1.2 and 1.8 s.

### 1. Props in the lab: one rule, the city's
- **What floated.** `lab.js` drew a clip's prop on every frame. Between plays it drew it at the clip's first pose, in front of a walker standing with its arms down; through the blend-in and the blend-out it drew it at the clip's full-weight pose while the hand was still on its way.
  - The worst was the end of every `aim_draw` cycle: the arm blended down out of the aim and the gun hung in the air for 0.4 s. That is "the gun floats in mid air".
  - Measured (the real shader, every prop clip played from rest in the lab's clip scene, 1/60 s): while a clip blended in or out, the old lab drew a hand's prop as far as 42–79 cm from its hand (`stock_shelf` 20 cm).
- **Now** (`drawProps`):
  - Only the PLAYING clip's prop (`state.c.prop`), and only while the clip's weight is ≥ 0.6 (`PROP_SHOW`): the shooter's "Showing it", which heist.md, bench.md and breakin.md copy. One rule for every prop.
  - The walker's gait state goes in as `matrix`'s 4th argument, as the city passes it, so a chest-frame prop rides the real walk: the loot sack, `carry_box`'s box, `creep_walk`'s torch. Before, the lab's sack was frozen at the walk's phase 0.
- **What the rule still lets through.** At a weight of 0.6 the arm is only 60 % of the way there.
  - On the first frame a hand's prop shows, its hand is still 16–27 cm short of it (the sack 52 cm, `stock_shelf` 6). The hand closes the gap in 3–6 frames (0.05–0.1 s).
  - On the last frame a blend-out shows it, the hand has left it by 10–26 cm. In the city that only happens where a clip blends out holding something.
  - A threshold of 0.95 would cut the first-frame gap to 2–4 cm (the sack 7.5), and of 0.98 to ≤ 1.4 cm (the sack 2.7). The prop then appears 0.15–0.55 s into the blend, and a bike, a scooter or a board would appear under a rider already sat on it. That is a change to the city's rule (here, heist.md, bench.md, breakin.md), so it is left at 0.6. In the lab it is one constant.
- **A stand-in set.** A clip may carry `set: { id, geometry(THREE) }` (lab only): a mesh in the walker's body frame, drawn under its actor whether the clip plays or not.
  - The bench clips carry the city's bench (bench-props.js `benchSetGeometry`, from `BENCH`): the top and legs, the anvil, the gun's stand, the warrant, the ink pad, the parts tray. So the hammer lands on the anvil and the finished gun stands in its stand, where before they hung in the air at bench height.
  - Never drawn under `&dbg=back`, so the see-through gate sees what it saw before. `&set=0` hides it.

### 2. `aim_draw`: the gun comes off the hip
- **What was wrong.** The gun only appeared in the hand at the waistband grab (0.26 s), behind the far hip. From the lab's camera, which faces the walker's other side, it first showed mid-swing beside the thigh: it "appeared in front".
- **Now** the gun is carried on the +x hip from the clip's first frame. The hand goes back to it, takes it at 0.26 s and swings it out (§ The shooter, the carry).
  - The waistband grab (`WB`) moved back and up: `[−1.38, .37, 0, .33]`, elbow 1.37 (was `[−1, .2, 0, .2]`, 1.1). Its grip is at body (0.354, 0.490, −0.213) at the stand.
  - That puts the carried gun just behind a resting fist: its front edge is 1.5 cm inside the fist's back. The old grab spot would have put it 11 cm into the fist.
  - The swing's wide arc now starts at the grab (`cBump(t, .26, .5)`, was `.24, .48`), so the hand holds the grab pose exactly when it takes the gun: the switch from the hip to the hand is 0.07 mm.
- **The other gun clips.**
  - `aim_lower` puts the gun back in the same carry at 0.66 s and lets go; it stays on the hip to the end. Before, it vanished in the hand at 0.66.
  - `aim_hold` and `aim_fire` hold the gun all the time. Their floating was the lab's alone (between plays, the blends), which fix 1 ends. In the city they start from a seam, at full weight.
  - `bench_test_gun`'s gun rests in its stand on the bench before the pick-up and after the put-down. It floated in the lab only because the lab drew no bench; the stand-in set ends that (bench.md).

### 3. `loot_carry`: the sack (heist.md has the details)
- A stuffed loot sack replaces the speckled egg behind the head: a gathered neck with a rope tie in the fist, and a pear-shaped body hanging down behind the +x shoulder, lumpy, creased at the top, shaded at the bottom, with the $ on its outer side and its back.
- Secondary motion: it turns about the neck in the fist, so the two never part. Each step it settles a beat after the pelvis's low point (the fist gives 1.2 cm and the sack swings down), then floats back up. It lags the sway and the chest's twist, and it swings with the hitch and the heavy step.

### 4. `bench_hammer`: the blow lands from above (bench.md has the details)
- The old blow came down out at the side to bench height and swept in sideways at the anvil's height, 0.56 m in its last 0.07 s, into the anvil's side, landing tilted 9.4°. The lift slid back out the same way, and the −x hand never moved.
- Now the blow comes down and in over the anvil and snaps straight down onto it, the face flat. A quick rebound follows, and the lift goes up off the work before it swings out. The shoulders jolt, the head dips with the blow, and the −x hand lifts off the bench through each wind-up and is planted again with the blow.

### Checks (port 5365; this branch on ai-city-fresh main 7355dd1)

- **The clip gates.** `FRESH_URL=http://127.0.0.1:5365 node style/check.mjs clips --quick --jobs 2`: PASS, exit 0 (11 min wall), on the final files.
  - End check: PASS. Elbow identity: PASS within 1e-6 m (max 1.19e-7) over 11,186 look-states. The four changed clips are listed as bending by design: `aim_draw` 16/17 states, elbow ≤ 1.37 rad · `aim_lower` 19/21, ≤ 1.36 · `loot_carry` 65/65, ≤ 1.26 · `bench_hammer` 57/57, ≤ 1.45.
  - Hand gate: 87 clips (5,636 states) × every fresh bottom on the plain shoe, 10/10 shards, every count 0. See-through: 0 of 16,024 frames on the mannequin.
- **Every other clip is unchanged.** The 83 untouched clips' generated GLSL functions, ids (0–86) and entry numbers are byte-identical to main, and so are the helpers and the dispatcher. Every other prop's `pose(t)` and beat points (every 0.01 s) and every other model's cells are identical too.
- **The tools on their hands** (the real shader, every 1/120 s, full weight): the gun ≤ 0.0002 mm wherever it is in the hand, in all four aim clips; the hammer ≤ 0.0005 mm; the switches between the hip and the hand ≤ 0.07 mm; the sack's neck on the fist ≤ 0.038 mm.
- The sack and the hammer have their own checks in heist.md and bench.md (§ The refine pass).

### Pixels (`shots/refine/`)

Each sheet is main (7355dd1, the BEFORE rows) over this branch (AFTER), the same lab URL and times. Look at these first:
1. **`2-aim_draw.jpg`**: the draw from the gun's side, then the lab's default camera.
2. **`3-loot_carry.jpg`**: one stride from the sack's side, the +x side and the front quarter.
3. **`4-bench_hammer-blow.jpg`**: one blow at 60 fps, from the front quarter and from the hammer's side.
4. **`1-props-aim_draw-cycle.jpg`**: the end of the lab's `aim_draw` cycle, where the gun used to hang in the air.

All of them:
- `1-props-aim_draw-cycle.jpg`, `1-props-blend.jpg` (`vault_drill`, `film_phone`, `aim_hold` across a lab cycle's end and replay), `1-props-bench_test_gun.jpg` (its start, the put-back and the hold): the 0.6 rule and the stand-in bench.
- `2-aim_draw.jpg`, `2-aim_lower.jpg`: the carry.
- `3-loot_carry.jpg`: the sack.
- `4-bench_hammer-blow.jpg`, `4-bench_hammer-loop.jpg` (the lift and the first blow every 0.1 s): the hammer.
- `{aim_draw,loot_carry,bench_hammer}-{before,after}.webm`: the lab's clip scene at 60 fps, 640 × 480 (`aim_draw` one whole lab cycle, 6.4 s, from the gun's side; `loot_carry` 4 s from the sack's side; `bench_hammer` 3.6 s from the front quarter).
- The changed clips' own sheets are redrawn: `shots/aim_draw.jpg`, `shots/aim_lower.jpg`, `shots/heist/loot_carry.jpg`, `shots/bench/bench_hammer.jpg`, `staged-bench_hammer.jpg`, `beat-hammer-strike.jpg`.
