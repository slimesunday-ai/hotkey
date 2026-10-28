# Camera rig — research, diagnosis and rebuild spec (2026-10-05)

Branch `cast/fresh-traits` @ bc75ad4. Read-only research pass: no code was changed. Every `file:line` refers to **HEAD bc75ad4**.

**Concurrent edits.** Other passes edited this worktree while the research ran: `main.js`, `nav.js`, `vox.js`, `jobs.js` and more are modified and uncommitted, though none of `camera/`. In the working tree `main.js` lines after 37 have shifted by about −2. Re-check line numbers before editing. Evidence frames are in `style/city/shots/camera-research/`. The probe that produced every number here is in Appendix A.

slime's complaint: *"follow and fly are still very janky … we are flying through people and buildings get stuck behind light posts in follow, etc… i also think we need a first person pov in follow"*.

---

## 0. TL;DR

**Root causes, one line each**
1. **Nothing dynamic is solid.** Fly collides only with `solid.js`'s slab grid, which holds block meshes. Walkers (`peds.sim`) and cars (`traffic.sim`) are never queried, so the camera passes through heads and car bodies (`fly.js:48-60`, `solid.js:1-9`).
2. **The slab grid is the wrong collision world.**
   - It stores one `[lo, hi]` interval and one rectangle per 1 m cell, taken from the **mid** tier (`solid.js:15, 27-28`).
   - Everything in a cell is unioned into one box. That creates false solids: in follow run A2 the camera was "inside" a slab in 681 frames where the real geometry was ≥ 0.3 m away.
   - A lamp becomes a 0.75 × 0.8 m box, 2.5 m tall. The real pole is 0.3 m wide.
   - Props that the mid tier drops are missing altogether: anything under 1.3 m wide and under 2.5 m tall (`vox.js:205, 226`).
3. **Follow is "stuck" at light posts.**
   - The occlusion test treats a lamp's box as a wall and pulls the arm in to `minDist` 1.7 m (`follow.js:43-45`, `solid.js:79-82`).
   - The camera then waits at the post while the person walks on. It stalls for 1.0–1.8 s per lamp.
   - When the post is just off the test band, it is not pulled in at all. The pole then stands in the middle of the frame: the subject drops to 0 % visible and stays under 75 % for 1.9–5 s.
4. **A hard clamp after the spring teleports the camera.** `follow.js:81` writes `pose.p` directly and leaves the spring velocity alone.
   - In real follow runs: 23–63 frames per 30 s move faster than 5 m/s, up to **175 m/s** (about 3 m in one frame).
   - Position acceleration peaks at 10,424 m/s². Angular acceleration peaks at 158 rad/s².
5. **Pull-in plus "rise" gives overhead shots of the back of the head.** `minDist` 1.7 m and a rise of up to +2.4 m (`follow.js:46`) produce them.
6. **Orbit lags, and the arm sags, because the spring acts on the camera's x/y/z position.** It acts on the world position, not on azimuth and distance (`follow.js:79`). At a 2 rad/s orbit the camera trails the input by 31–37°.
7. **Fly slams into walls.** At full boost (62 m/s) the camera stops with a peak deceleration of **720 / 1,121 / 1,567 m/s²** at 30 / 60 / 120 Hz.
   - The cushion's 38 m/s² cannot stop it, so the sweep's per-axis `vel *= .2` does (`fly.js:48-60`, `solid.js:68-74`).
8. **The motion depends on the frame rate.**
   - Follow: `allowed` uses a linear `dt/.04` (`follow.js:44`), and the spring is implicit Euler (`follow.js:13-14`). The 30 Hz path drifts up to 0.92 m from the 120 Hz path.
   - Fly: several factors are applied per frame rather than per second (`fly.js:56-58, 60`). The glide distance varies by 15 % across frame rates.
9. **Smaller issues.**
   - Fly's floor sits at head height (1.4 m) and bounces back up to 3.2 m.
   - Mouse look has a 35 ms smoothing lag and no filter for pointer-lock spikes (`fly.js:36`, `input.js:27`).
   - The camera reads walker positions one frame old (`main.js:374-375`). That is fatal for a POV camera.
   - Hand-off blends and Tab switches travel in straight lines through geometry (`rig.js:95-98`).
   - The rig's worst frame reaches 1.6 ms, which matches the rasterising budget spent inside `update` (`solid.js:12, 40`).

**Recommended approach**
- **One new collision world.** It is a 0.25 m column-interval voxel model built in a worker from the full tier's horizontal faces, which gives exact solid spans with no unioning. It flags thin columns (poles). Walkers and cars are added each frame as capsules and boxes from their CPU-side simulation state. It offers four queries: ray, sphere sweep, distance and floor.
- **Follow** works in parameter space: pivot, azimuth, pitch and arm length are each damped as scalars, with no spring on the world position.
  - It sweeps a sphere for physical collision (snap in, ease out).
  - Line of sight is tested separately with a 5-ray fan. Wide occluders are resolved by a swing, lift or pull-in search after 0.2 s.
  - Thin occluders (posts) and people never move the arm.
  - Whiskers predict walls before they arrive.
- **POV** is a sub-mode of follow. The eye sits at the walker's head, the walker's body is hidden, the heading is smoothed and rate-limited, and the field of view is 70°. It runs after the walker simulation each frame.
- **Fly** uses exponential velocity. A speed governor caps deceleration using the time to contact, collide-and-slide handles walls (Quake-style velocity clipping), and people and cars are solid. Mouse look is applied directly, with a spike filter.

**Acceptance (§5):**
- 0 frames with the camera inside geometry, a person or a car.
- No snaps: camera speed ≤ subject speed + 6 m/s.
- Angular acceleration ≤ 25 rad/s² without input.
- No wide occlusion run longer than 250 ms; no stall at a post.
- Fly deceleration ≤ 60 m/s².
- The 30 / 60 / 120 Hz paths agree within 0.10 m.
- POV yaw rate ≤ 90°/s and yaw acceleration ≤ 360°/s².
- Rig cost ≤ 0.3 ms mean and ≤ 0.6 ms p99.

**Effort:** two agent passes.
- Pass 1: collision world, late-update hook, follow, and the probe tool.
- Pass 2: fly, POV, blends, the full acceptance run, and tuning with slime.

---

## 1. How this was measured

**Setup**
- A probe ran headless Chrome against my own server on 5337: `q=medium`, 1280×720, 60 fps. The server was stopped afterwards.
- The probe reads `window.__city` and imports the rig's own modules (`camera/fly.js`, `camera/follow.js`, `ground.js`). It changes no code.

**Ground truth (GT)**
- GT is the **full tier's quads**: `r.data.full` P arrays, every non-ground quad as an axis-aligned box, bucketed into 1 m cells.
- This is independent of `solid.js`. The voxel meshes are axis-aligned quads, so these boxes are exact.

**Measured quantities**

| Measure | How it is computed |
|---|---|
| Camera → geometry distance | Nearest point on any box |
| Subject visibility | 12 rays to points on the body (4 heights × 3 lateral) |
| People and cars | Walker capsules (feet + 0.3 → + 1.45 m, r 0.3) from `peds.sim.walkers`; car boxes (`c.x, c.z, c.h, c.len`, 1.9 × 1.55 m) from `traffic.sim.cars` |
| Kinematics | Angular and positional velocity, acceleration and jerk from per-frame poses |

**Scenarios**

| id | what | how |
|---|---|---|
| A1–A3 | follow, real time, the rig's own follow mode | Fit Street / (20, −20) / (−30, 60); 30 s each, Tab every 10 s (9 subjects) |
| L | follow past real corner lamps | a scripted walker passes 4 lamps (`ground.js cornerLamps`) at 0 / 0.3 / 0.6 / 1.0 m off the lamp line; a private `createFollow` at 60 Hz; 16 passes |
| B | frame-rate dependence of follow | A1's longest single-subject path replayed into `createFollow` at 30 / 60 / 120 Hz |
| O | orbit lag | a standing subject, a steady 2 rad/s orbit for 1.5 s, at 30 / 60 / 120 Hz |
| C | fly, fixed dt | a private `createFly` on scripted input at 30 / 60 / 120 Hz: boost into a wall 75 m away; descend to the floor; a look flick; cruise and glide |
| D | fly, real time | the rig's fly mode with synthetic keys: W along a busy sidewalk (D1), W+Q down along it (D1b), W+Q down a busy road (D2), boost into the wall (D3) |
| Q | sizes and costs | quads per block; cost of a GT query |

**Caveat.** In scenario L the scripted walker stands at y = 0, not on the raised sidewalk. A few "0 % visible" readings at the 1.0 m offset are curb false positives; frame `L0-lamp-lat1-occl` shows the subject in plain view. The lamp-on-line findings at 0 and 0.3 m are confirmed by the frames. The harness in §5 must put scripted walkers on the column top.

---

## 2. Diagnosis (evidence → root cause)

### D1 — Fly goes through people and cars
- **Evidence.**
  - D1b, W + Q down a sidewalk: 4 frames inside a walker (capsule distance −0.08 m) and 3 inside a car.
  - D2, a road at about 1.5 m: 10 frames inside a car (0.00 m).
  - Frames: `D1b-fly-t1.8.png` (the camera is inside a walker's head, which fills the lower left of the frame) and `D2-fly-t2.0.png` (inside a box truck).
  - D1, level flight, stayed above heads only because the soft floor pushed it to 2.2–3.9 m.
- **Root cause.**
  - `solid.js` rasterises only block meshes (`solid.js:1-9, 15`). Walkers are BatchedMesh instances posed by a shader; their CPU positions live in `peds.sim.walkers[i].p`. Cars live in `traffic.sim.cars` (`x, z, h, len`).
  - `fly.js` never reads either (`fly.js:48-60`).
  - The fly floor is `floor: 1.4` m (`config.js:15`), which is head height (walker capsule top is about 1.75 m). Descending, or pitching down, puts the camera inside heads.
  - Even outside the body, anything within about 0.3 m of the camera is cut by the 0.1 m near plane (`main.js:142`).

*In plain words: fly only knows about buildings. People and cars are drawn by the GPU, but their positions exist in JavaScript; the camera just never asks.*

### D2 — The slab grid is the wrong collision world
- **Evidence.**
  - **False solids.** Frames where `solids.blocked(cam, .05)` was true but GT clearance was ≥ 0.3 m: A1 33/33, A2 **681/890**, A3 108/108. Almost every "inside" reading is false.
  - **Lamps.** The slab cell under each lamp reads `lo .2, hi 2.7, 0.75 × 0.8 m` (5 of 8 lamps sampled), or the lamp is merged into a 1 × 1 m box 4.2–8.7 m tall (3 of 8). The real lamp is a 0.3 m pole, 6.2 m tall, with an arm and head (`props.js:20-23`, `CV = .1`).
- **Root cause.**
  - **One interval per cell.** Per 1 m cell the grid keeps only the lowest `lo` and highest `hi` of every quad over it, plus the union rectangle (`solid.js:27-28`). An awning above a bench, or a lamp's base, pole, arm and head, become one solid box.
  - **Mid tier, not full.**
    - The source prefers the **mid** tier (`solid.js:15`). The mid tier keeps only volumes ≥ 1.3 m wide or ≥ 2.5 m tall (`vox.js:205, 226`).
    - Hydrants, cans, benches and newsboxes are absent. A green trash can blocks half the subject in `L1-lamp-lat0.3-occl.png`.
    - Thin parts are resampled 2× coarser.
  - **The thin filter never matches real posts.** The follow test ignores rectangles under 0.45 m (`solid.js:80`). Real post cells are 0.75–1 m because of the union, so posts count as walls.
  - **Inside means free.** If the camera is already "inside", `sweep` moves it with no collision at all (`solid.js:69`). This is a latent pass-through-walls bug whenever a block's mesh is swapped under the camera.
  - **Rasterising runs inside the rig's update.** It is time-sliced at 1.5 ms per frame (`solid.js:12, 40`). The rig's frame maximum was 0.9–1.6 ms in the runs.

*In plain words: the collision map is a coarse, lumpy simplification. Small posts become fat pillars, open space under awnings becomes solid, and small props disappear.*

### D3 — Follow gets "stuck behind light posts"
- **Evidence (scenario L, 16 passes).**
  - **Pull-in:** 13 of 16 passes pulled the arm to the 1.7 m minimum. For 3 of the 4 lamps that happened at every lateral offset.
  - **Stall:** in 8 passes the camera **stalled 1.0–1.8 s** (camera < 0.4 m/s while the walker walks at 1.35 m/s). The camera parks at the post until the walker is 5.2 m beyond it.
  - **Pole in frame:** with the walker on the lamp line the pole stands in the middle of the frame. The subject drops to 0 % visible and stays under 75 % for 1.9–5.0 s. At 0.3 m off the line the least-visible frame still shows 50–67 % of the subject.
  - Frames:
    - `L1-lamp-lat0-occl.png`: the pole fills the frame centre, 0 % visible, and the camera moved at 170 m/s that frame.
    - `L0-lamp-lat0-pull.png`: pulled in by the lamp, the pole in front of the subject.
    - `L0-lamp-lat0.3-occl.png`, `L0-lamp-lat1-occl.png`: pulled to 1.7 m beside the pole, looking steeply down.
- **Root cause.**
  - **One band test against the slab grid** (`follow.js:43`, `solid.js:79-82`). Three parallel rays ±0.4 m apart must all hit for a pull-in.
    - With the fat lamp box this fires when the arm passes within about 0.3 m of the box: the arm snaps in (`follow.js:44`, rate `dt/.04`).
    - Slightly further off it does not fire, and the post stays in the shot.
  - **Wrong response.** Whatever the occluder, the only response is to pull in along the arm. There is no swing, no lift, no thin-occluder policy and no prediction.
  - **Why it parks.** A post that lands on the arm after the walker passes moves toward the camera as the walker walks on. The allowed arm length then equals the distance from the post to the walker, so the camera stays at the post.
  - **Where lamps stand.** Lamps sit on the curb line 2.6 m from each corner (`ground.js:17-19`), exactly where walkers queue and turn.

*In plain words: when the person walks past a lamp, the camera decides the lamp is a wall, jumps close to the person, then sits at the lamp while they walk away. Or it ignores the lamp, and the pole blocks the view.*

### D4 — Teleports and chatter from the post-spring clamp
- **Evidence.**
  - Real follow runs, frames where the camera moved faster than 5 m/s with the same subject (walkers walk at 1.35 m/s): A1 54, A2 63, A3 23.
  - Peaks: 109 / 175 / 6.9 m/s. Lamp passes: 138 such frames, max 181 m/s.
  - Position acceleration maximum 6,413 / 10,424 m/s². Angular acceleration maximum 49 / 158 rad/s². Angular jerk maximum 3,399 / 9,491 rad/s³.
- **Root cause.** `follow.js:81` re-tests the line from the look spring to the camera spring. If blocked, it **writes `pose.p` directly** and leaves the spring velocity `camV` unchanged.
  - The next frame the spring carries its old velocity back into the wall and gets clamped again.
  - A critically damped spring with ω = 5.5 cannot exceed about 10 m/s on a 5 m change. The 100–180 m/s frames can only come from this direct write.

### D5 — Overhead "top of the head" shots
- **Evidence.**
  - `A2-follow-t27.0.png`: arm pulled to 1.70 m, the back of the head fills a third of the frame, the camera 9 cm from a wall.
  - `A2-follow-t20.1.png`: just after a Tab, the camera is wedged in a corner looking straight down at the head, 8 cm from geometry.
- **Root cause.** The minimum distance is 1.7 m (`config.js:28`). When the arm is pulled in, the target rises by up to +2.4 m (`follow.js:46`). The camera spring then follows that rising target. The result is a steep top-down view at arm's length.

### D6 — Orbit lag and arm sag
- **Evidence (O).** Orbiting at 2 rad/s, the camera azimuth trails the input by 0.54 rad (31°) after 1 s and 0.64 rad (37°) after 1.5 s, at every frame rate.
- **Theory.** For a critically damped spring with ω = 5.5 driven at Ω = 2 the expected phase lag is 2·atan(Ω/ω) ≈ 40°, and the gain is ω²/(ω²+Ω²) = 0.88, so the radius sags by about 12 %. The measured sag was 36 %, but the run started next to a wall.
- **Root cause.** The camera's world position is sprung toward a target on a circle (`follow.js:79`), so the spring cuts the chord. Input should move the azimuth directly; smoothing belongs in the parameters.

### D7 — Other walkers block the sight line
- **Evidence.** Frames with another walker's capsule on the line from the camera to the subject's chest: A1 20 %, A2 15 %, A3 41 %.
- **Root cause.** Walkers walk in single file on 2 m sidewalks ("no passing": `pedsim.js:16`). The camera trails at 5.2 m with pitch 0.2 rad, about 2.4 m high, which puts the sight line through the walker behind. No height or shoulder framing avoids the queue.

### D8 — Tab and hand-off travel goes through geometry
- **Evidence.** A2's Tab at t = 20 s (an 8.3 m switch): within 1.5 s GT clearance hit 0.01 m and the subject was 0 % visible (`A2-follow-t20.1.png`).
- **Root cause.**
  - `follow.next()` only swaps the subject. The two springs then fly to the new target (up to 70 m: `cycleRadius`), and only the look-to-camera line is checked.
  - Mode hand-offs `lerpVectors` in a straight line, arcing only beyond 80 m (`rig.js:47-49, 95-98`). Clicking a person from 40 m up blends straight down through whatever is in between.

### D9 — Frame-rate dependence
- **Follow (B, same path).** Max deviation from the 120 Hz path: 30 Hz **0.92 m** (mean 0.28 m); 60 Hz 0.01 m.
  - Causes: the arm-length rate `Math.min(1, dt / .04)` is linear in dt (`follow.js:44`), and the implicit-Euler spring adds damping that grows with dt (`follow.js:13-14`).
- **Fly (C).**
  - Glide after release: 7.49 / 8.62 / 8.84 m at 30 / 60 / 120 Hz (15 % spread). Wall-stop peak deceleration scales with the frame rate: 720 / 1,121 / 1,567 m/s².
  - Per-frame factors that ignore dt:
    - the floor `u*u*.5` term (`fly.js:56`) and the ceiling `u*u` term (`fly.js:57`);
    - `vel.y *= .8` under an overhang (`fly.js:58`);
    - `vel *= .2` on a blocked axis (`fly.js:60`).
  - `kill = w*w*14*dt` is linear in dt (`fly.js:52`).
- **Rig.** `dt` is clamped to 0.1 s (`rig.js:91`). Below 10 fps the camera slows down. That is acceptable but should be documented.

### D10 — Fly wall slam
- **Evidence (C wall, 62 m/s).**
  - The camera stops 0.40 m off the wall at every frame rate, which is good, but with a peak deceleration of 720–1,567 m/s² (73–160 g) and jerk up to 2 × 10⁵ m/s³. That is a jolt.
  - Mid-flight the 30 Hz path differs from the 120 Hz path by 6.1 m.
- **Root cause.**
  - The cushion reaches at most 9 m and pushes at 38 m/s² (`fly.js:48, 51`). At 62 m/s the stopping distance is v²/2a ≈ 50 m, so the cushion cannot stop the camera.
  - The swept move is what stops it, multiplying the velocity on that axis by 0.2 every frame (`fly.js:60`).
  - The sweep has no slide plane, only per-axis stepping in 0.4 m steps (`solid.js:68-74`). Grazing a wall at an angle stalls one axis instead of sliding.

### D11 — Fly floor at head height, then a bounce
- **Evidence (C floor).** Descending, the camera holds 1.39–1.46 m, inside walker heads (D1). Released, it floats up to 3.2 m, past the soft band's 2.8 m.
- **Root cause.** The soft floor pushes up with `u²·30 m/s²` (`fly.js:56`), which is open loop. Nothing removes the upward speed when the camera leaves the band.

### D12 — Input
- **Smoothing lag.** Fly mouse look is smoothed with `lookSmooth .035` s (`fly.js:36`). Measured, 90 % of a flick lands 33 ms after the input ends: about 2 frames of extra latency on a direct control.
  - Haigh-Hutchinson exempts direct player control from smoothing and rate limits.
- **No spike filter.** Pointer-lock deltas are summed with no filter (`input.js:27`). Chrome is known to emit spurious ±300–400 px `movementX` values (three.js #12757, #27040).
- **Fallback lock.** `unadjustedMovement` is requested with a fallback, which is correct (`input.js:57`).

### D13 — The camera reads walker positions one frame old
- **Root cause.** Each frame the loop runs `cam.update()` **before** `frame()`, and `frame()` runs `peds.update()` and then renders (`main.js:374-375, 256`). So the camera aims at last frame's walker position: 2.3 cm behind at 60 fps and 4.5 cm at 30 fps, and the heading is one frame old.
- **Impact.** Invisible in third person. In POV it puts the eye inside the head and makes turns judder.
- **Also.** Walkers beyond `charMid` update every other frame and walkers out of view every sixth frame (`peds.js:134-135`). That matters for following at long distances.

### D14 — Cost spikes
- **Mean cost is low:** 0.03–0.14 ms.
- **Maxima reach 1.6 ms** (0.2–1.6 ms across the runs). They match the 1.5 ms rasterising budget that `solid.js` spends inside `rig.update` (`solid.js:12, 40`).

**What was fine.**
- No near-plane clipping of static geometry in A1/A3 (A2: 11 frames).
- Fly never ended up inside a building in D3 or C.
- The follow springs are stable.
- The rig's mean cost is low.

---

## 3. Research: how games and engines solve this

Every source below was opened. Items marked *unverified* were not confirmed against a primary source.

### 3.1 Third-person and follow cameras

**Unreal SpringArm** ([docs](https://dev.epicgames.com/documentation/en-us/unreal-engine/python-api/class/SpringArmComponent?application_version=5.2))
- It sweeps a probe sphere (`ProbeSize`, on channel `ProbeChannel`, default `ECC_Camera`) from the arm's base to the desired end and puts the camera at the hit. `TargetArmLength` is kept, so the arm springs back when clear.
- `CameraLagSpeed` and `CameraRotationLagSpeed` act on the *target*. Optional sub-stepping (`bUseCameraLagSubstepping`, `CameraLagMaxTimeStep`) handles fluctuating frame rates.
- The collision pull-in and its return are **unsmoothed** ([forum](https://forums.unrealengine.com/t/camera-spring-arm-collision-lag-speed/296784)).
- A probe of about 12 cm is commonly cited ([guide](https://uhiyama-lab.com/en/notes/ue/camera-spring-arm-guide/)); the engine source was not checked.

**Lyra (Epic's UE5 sample): penetration avoidance with feelers** ([.cpp](https://raw.githubusercontent.com/LeNidViolet/Lyra/main/Source/LyraGame/Camera/LyraCameraMode_ThirdPerson.cpp), [.h](https://raw.githubusercontent.com/LeNidViolet/Lyra/main/Source/LyraGame/Camera/LyraCameraMode_ThirdPerson.h))
- Seven feelers:
  - the centre, as a 14 cm sphere sweep every frame;
  - yaw ±16° (weight 0.75, retraced every 3 frames);
  - yaw ±32° (0.5, every 5);
  - pitch +20° (1.0) and −20° (0.5), every 4.
- Blending: a hard block snaps in instantly; soft blocks ease in over `PenetrationBlendInTime 0.1` s; clearing eases out over `BlendOutTime 0.15` s; push-out is 2 cm. `bDoPredictiveAvoidance` ("move the camera in anticipation… prevents popping").
- The safe point is the point on the pawn capsule nearest the view line. Actors tagged `IgnoreCameraCollision` are skipped.

**Cinemachine 3rd Person Follow** ([source](https://raw.githubusercontent.com/Unity-Technologies/com.unity.cinemachine/main/com.unity.cinemachine/Runtime/Components/CinemachineThirdPersonFollow.cs), [docs](https://docs.unity3d.com/Packages/com.unity.cinemachine@3.1/manual/CinemachineThirdPersonFollow.html))
- **Damping per axis:** (0.1, 0.5, 0.3) s.
- **Rig defaults:** shoulder offset (0.5, −0.4, 0), vertical arm 0.4, camera distance 2, **CameraRadius 0.2**.
- **Collision damping:** **DampingIntoCollision 0, DampingFromCollision 0.5** (snap in, ease out).
- **Two sphere casts:** root to hand, then hand to camera. The corrected position is `hit.point + normal·radius`.
- A damp time T means about 1 % residual after T, so λ = 4.605 / T ([Predictor.cs](https://raw.githubusercontent.com/Unity-Technologies/com.unity.cinemachine/main/com.unity.cinemachine/Runtime/Core/Predictor.cs)).

**Cinemachine Deoccluder / Collider** ([source](https://raw.githubusercontent.com/Unity-Technologies/com.unity.cinemachine/main/com.unity.cinemachine/Runtime/Behaviours/CinemachineDeoccluder.cs), [docs](https://docs.unity3d.com/Packages/com.unity.cinemachine@3.1/manual/CinemachineDeoccluder.html))
- **Strategies:** PullCameraForward, PreserveCameraHeight, PreserveCameraDistance.
- **Defaults:**
  - MinimumDistanceFromTarget 0.3, CameraRadius 0.4, MaximumEffort 4;
  - **MinimumOcclusionTime 0** ("do not act unless the occlusion has lasted this long");
  - **SmoothingTime 0** (hold the camera at the nearest point for this long, which stops popping on bumpy occluders);
  - Damping 0.4, **DampingWhenOccluded 0.2**.
- **TransparentLayers** "never obstruct the view": the hook for thin or see-through occluders.
- The 2.x doc adds that "four hits is enough" ([2.9 doc](https://docs.unity3d.com/Packages/com.unity.cinemachine@2.9/manual/CinemachineCollider.html)).

**Look-ahead and framing (Cinemachine)**
- Lookahead time ranges 0–1 s, with smoothing 0–30; it is off by default and sensitive to noisy animation ([LookaheadSettings.cs](https://raw.githubusercontent.com/Unity-Technologies/com.unity.cinemachine/main/com.unity.cinemachine/Runtime/Core/LookaheadSettings.cs)).
- Dead zone 0.2, hard limits 0.8 ([ScreenComposerSettings.cs](https://raw.githubusercontent.com/Unity-Technologies/com.unity.cinemachine/main/com.unity.cinemachine/Runtime/Core/ScreenComposerSettings.cs)).
- **Recentering:** Wait 1 s, then Time 2 s, implemented as SmoothDamp at Time/2 ([InputAxis.cs](https://raw.githubusercontent.com/Unity-Technologies/com.unity.cinemachine/main/com.unity.cinemachine/Runtime/Core/InputAxis.cs)).

**John Nesky, "50 Game Camera Mistakes" (GDC 2014)** ([vault](https://gdcvault.com/play/1020460/50-Camera); summaries [1](https://matellion.blogspot.com/2016/08/50-common-game-camera-mistakes-and-how.html), [2](https://matellion.blogspot.com/2016/08/50-common-game-camera-mistakes-and-how_21.html), [3](https://shermanrose.uk/knowledge/programming/games/50-game-camera-mistakes/))
- Directly relevant:
  - **#5** whisker raycasts detect side obstacles early;
  - **#7** shrink the line-of-sight distance from the whiskers;
  - **#8** organise competing forces per degree of freedom;
  - **#9** tag dispensable obstacles (narrow columns) and let the whiskers *ignore* them;
  - **#10** but still sphere-collide with them, because "breaking line-of-sight differs from physical collision";
  - **#12** pull forward for occluders from behind instead of swinging;
  - **#13** the near plane cuts the avatar: add spacing or fade it;
  - **#23** drift the yaw behind a running player;
  - **#35** after the player adjusts, let the camera rest;
  - **#43** don't bounce with the walk cycle;
  - **#45** no rapid transitions.
- **This is the frame for D3:** posts must be solid to the camera's body but transparent to the line-of-sight logic.

**Haigh-Hutchinson** ([GDC 2005 slides](https://media.gdcvault.com/gdc05/slides/GD_Haigh-Hutchinson_FundamentalsReal-TimeCameraDesign2.pdf); book excerpt, chapters 8–9: [gamedeveloper](https://www.gamedeveloper.com/design/real-time-cameras---navigation-and-occlusion))
- Predictive cameras beat reactive ones.
- Cast rays in a grid around the proposed position, toward the target, and keep "ray-casting hysteresis" across frames.
- The camera collision sphere should be slightly larger than the near-plane distance.
- Limit reorientation speed unless the player is driving it directly.
- Look ahead of a moving character.
- Never change the control frame instantly.
- The slides also give a pitfall: velocity damping lets the target "overtake and interpenetrate" the camera.

**How shipped games treat thin occluders** ([gamedeveloper survey](https://www.gamedeveloper.com/design/third-person-camera-view-in-games-a-record-of-the-most-common-problems-in-modern-games-solutions-taken-from-new-and-retro-games))
- Witcher 3 dithers vegetation near the camera.
- Mario Sunshine shows a silhouette through walls.
- A Hat in Time uses whiskers.
- Unreal's camera channel is how props are set to be ignored; that props are set to Ignore on it is an inference, not a quoted doc.
- Studio talks (Uncharted 3 cameras, God of War's no-cut camera) were found as abstracts only; no techniques could be extracted (*unverified*).

### 3.2 Free-fly and spectator cameras

**Frame-rate-independent smoothing**
- `damp(a, b, λ, dt) = lerp(a, b, 1 − e^(−λ·dt))` ([Driscoll](https://www.rorydriscoll.com/2016/03/07/frame-rate-independent-damping-using-lerp/)).
- Half-life form: `1 − 2^(−dt/halflife)`.
- Exact critically damped spring ([Holden, "Spring-It-On" / "spring roll call"](https://theorangeduck.com/page/spring-roll-call)):

  ```
  y  = 2·ln2 / halflife
  j0 = x − g
  j1 = v + j0·y
  e  = exp(−y·dt)
  x  = e·(j0 + j1·dt) + g
  v  = e·(v − j1·y·dt)
  ```

  This is exact at any dt, which is the fix for D9.
- Unity `SmoothDamp` (Game Programming Gems 4, chapter 1.10) uses the 1/(1 + x + 0.48x² + 0.235x³) approximation ([Mathf.cs](https://raw.githubusercontent.com/Unity-Technologies/UnityCsReference/master/Runtime/Export/Math/Mathf.cs)).
- [Juckett](https://www.ryanjuckett.com/damped-springs/) gives the closed form `x(t) = ((v0 + x0·ω)t + x0)e^(−ωt)`.

**Collide-and-slide**
- Quake III `PM_ClipVelocity`: `v −= n·dot(v, n)·OVERCLIP` with OVERCLIP 1.001 ([bg_pmove.c](https://raw.githubusercontent.com/id-Software/Quake-III-Arena/master/code/game/bg_pmove.c)).
- `PM_SlideMove`: 4 bumps, at most 5 clip planes; a crease slides along `cross(n1, n2)`; a third plane stops ([bg_slidemove.c](https://raw.githubusercontent.com/id-Software/Quake-III-Arena/master/code/game/bg_slidemove.c)).
- Quake's **spectator** is traced and slides along walls; noclip is not.
- Fauerby's recursive slide stops after depth 5 ([paper](https://www.peroxide.dk/papers/collision/collision.pdf)).
- Unreal's Spectator collision preset collides with WorldStatic only ([collision reference](https://dev.epicgames.com/documentation/en-us/unreal-engine/collision-response-reference?application_version=4.27)).

**Altitude-scaled speed**
- The Cesium camera tutorial moves at `cameraHeight / 100` per tick ([Sandcastle](https://raw.githubusercontent.com/CesiumGS/cesium/1.110/Apps/Sandcastle/gallery/Camera%20Tutorial.html)).
- The rig's `speed + altGain·y` is the same idea, but it should use *clearance* (height above what is below), not absolute y.

**Mouse look**
- `requestPointerLock({unadjustedMovement: true})` disables OS acceleration ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_Lock_API)).
- Chrome produces spurious ±300–400 px deltas ([three.js #12757](https://github.com/mrdoob/three.js/issues/12757), [#27040](https://github.com/mrdoob/three.js/issues/27040), still open).
- A shipped fix drops motion for 150 ms after a lock change and discards events over 400 px ([PR](https://github.com/kathirmeyyappan/world/pull/31)).
- Look should be direct: apply raw deltas the same frame. A latency number for mouse smoothing was found only in a snippet (*unverified*); the 33 ms measured in D12 stands on its own.

### 3.3 First-person POV of a followed character

**Unreal first-person setup** ([docs](https://dev.epicgames.com/documentation/unreal-engine/coder-04-adding-a-firstperson-camera-mesh-and-animation))
- The third-person body is **OwnerNoSee**: hidden from its own camera but still casting a shadow (`bCastHiddenShadow`).
- First-person FOV 70.
- The camera sits at the head with a small forward offset.
- Hiding only the head bone gives a headless shadow ([forum](https://forums.unrealengine.com/t/hide-head-but-still-cast-shadow/390006)).

**Smoothing and comfort**
- Haigh-Hutchinson: don't lock the camera to the head bone; vertical motion needs lag so small bumps don't jar (slides above).
- Spectator smoothing:
  - Source interpolates a spectated view over 100 ms ([Valve wiki mirror](https://gist.github.com/CoolOppo/fe0586836de3fb2f90f9));
  - Gaffer recommends a buffer of about 3 send intervals ([snapshot interpolation](https://gafferongames.com/post/snapshot_interpolation/));
  - CS2 `cl_obs_interp_pos_rate 0.27` applies only *between* targets ([guide](https://steamcommunity.com/sharedfiles/filedetails/?id=3046217806)).

**Motion sickness** ([Oculus Best Practices](https://s3.amazonaws.com/arena-attachments/238441/2330603062c2e502c5c2ca40443c2fa4.pdf), VR guidance but the most rigorous we found)
- "Do not use head bobbing."
- Turning counts as acceleration.
- Make accelerations short and infrequent.
- Walk about 1.4 m/s.
- Zoom worsens sickness.

**Not found.** Primary sources for GTA V's first-person transition timing and for Overwatch or Valorant POV internals (*unverified*). The 0.45 s hand-off below is our choice, not copied from anywhere.

### 3.4 Collision without a physics engine, voxel and three.js

**three-mesh-bvh** ([README](https://raw.githubusercontent.com/gkjohnson/three-mesh-bvh/master/README.md), [API](https://raw.githubusercontent.com/gkjohnson/three-mesh-bvh/master/API.md), [character example](https://raw.githubusercontent.com/gkjohnson/three-mesh-bvh/master/example/characterMovement.js))
- Shapecast and capsule collision; "500 rays against 80,000 polygons at 60 fps"; BatchedMesh support.
- **Rejected here:**
  - The tier meshes are packed Int16 quads (`lod.js:1-6`). A BVH needs a float copy: about 97k quads ≈ 390k vertices per block, roughly 4.7 MB of positions plus the tree, per block.
  - The geometry is axis-aligned voxel faces, so an exact, cheaper voxel structure exists.

**three.js `games_fps`** ([source](https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/games_fps.html)): an Octree capsule (r 0.35), 5 sub-steps, damping `exp(−4·dt)`. A useful shape for the fly sub-stepping.

**Voxel traversal and distance fields**
- Amanatides & Woo grid traversal (step, tMax, tDelta; [pdf](http://www.cse.chalmers.se/edu/year/2011/course/TDA361/grid.pdf)) is the ray and sweep backbone on a column grid.
- Felzenszwalb & Huttenlocher exact distance transforms in linear time ([pdf](https://cs.brown.edu/people/pfelzens/papers/dt-final.pdf)) give an optional clearance field.
- Sphere tracing ([Hart](https://graphics.stanford.edu/courses/cs348b-20-spring-content/uploads/hart.pdf)) is optional.

**Crowds**
- No source covers camera-versus-GPU-crowd collision specifically.
- The standard approach is Teschner-style spatial hashing over CPU-side capsules ([pdf](https://matthias-research.github.io/pages/publications/tetraederCollision.pdf)). Here a linear scan with a distance cut is enough: about 1,500 walkers, about 5 µs.

---

## 4. Spec: the rebuilt rig

**Principles (they map to the diagnosis)**
- (a) Physical collision and line of sight are separate systems (Nesky #9/#10).
- (b) Smooth **parameters**, never the world position: pivot, azimuth, pitch, arm length, velocity. This fixes D4 and D6.
- (c) Every rate is a half-life or a per-second quantity used with an exact exponential. No per-frame factors (D9).
- (d) The collision world is exact at voxel scale and built off the main thread (D2, D14).
- (e) Follow and POV run **after** the walker simulation each frame (D13).

### 4.1 Frame order and files

- **`main.js`.** Keep `cam.update(dts)` before `frame()`; it handles input, fly, photo-free and orbit. Inside `frame()`, after `traffic.update` and `peds.update` (`main.js:255-256`) and before `post.render`, call `api.late?.(dt)`. The rig sets `api.late = dt => rig.late(dt)`.
  - Follow and POV compute their pose in `late`, and so do blends whose destination is follow or POV.
  - Fly also reads people and cars in `update`, using last frame's positions. That is acceptable: push-out absorbs 2 cm.
- **New files:**
  - `camera/world.js`: collision world and queries; replaces `solid.js`.
  - `camera/world.worker.js`: builds the static columns.
  - `camera/damp.js`: math.
  - `camera/pov.js`: POV sub-mode, or a section of `follow.js`.
- **`solid.js`.** Delete it once nothing imports it. Photo autofocus uses `ray`, which `world.js` provides.
- **`peds.js` gets two small hooks:**
  - `hide(w, on)`: `setVisibleAt(k, false)` on whichever tier batch draws `w`, and on its dog if any.
  - `heightOf(w)`: the look's geometry bounding-box top, via `BatchedMesh.getBoundingBoxAt(geometryId)`, cached per look.

### 4.2 The collision world (`world.js` + worker)

**Static geometry: column intervals, 0.25 m columns**
- **Source.** The block's **full** tier (`r.data.full`: P Int16 in cm relative to `o`, N Int8 normals, 4 vertices per quad; `lod.js:1-6`), else mid, else far.
  - Rebuild when the source object changes, using the same rule as `solid.js:36-41` but full-first.
- **Worker input and caching.** The main thread posts `{key, x0, z0, parts: [{P: P.slice(), N: N.slice(), o, n}]}`. That is copies, transferred; at most one block per frame. Keep results for blocks within 96 m of the camera, LRU, at most 24 blocks.
- **Worker build:**
  - Use only **horizontal quads** (`N.y ≠ 0`). An up-facing quad at height `y_t` starts solid below it; a down-facing quad at `y_b` ends it.
  - Stamp each quad's xz rectangle into every 0.25 m column it overlaps at all. This is conservative: a 0.1 m fence still occupies one column.
  - Per column, sort the events and sweep from the top down to y = 0. That gives exact solid intervals. Ground faces at y ≤ 0.05 are skipped. Merge intervals with gaps under 0.1 m.
  - Vertical quads are not needed. The voxel meshes are closed, and faces culled against the ground or neighbours correctly extend the solid downward.
  - Result: lamp poles are a 6.2 m column of 1–2 cells, awnings are a thin interval, and the air under them is free. **No unioning.**
- **Layout per block (P = 32 m → 128 × 128 columns):**
  - `off: Uint32Array(16385)` (CSR offsets);
  - `iv: Float32Array` (`[lo, hi]` pairs);
  - `top: Float32Array(16384)` (highest solid top);
  - `flags: Uint8Array(16384)`.
  - Estimated about 0.3 MB per block. Build is estimated at 5–15 ms per block in the worker (median 97k full-tier quads per block, max 126k; measured, Q).
- **Thin flag (computed in the worker).**
  - In the band 0.8–2.4 m, flood-fill solid columns 8-connected, stopping at 4 × 4 columns.
  - If a component's footprint is ≤ 0.6 × 0.6 m, flag its columns `THIN`. That covers poles, posts, sign and lamp masts, and tree trunks.
  - A component that reaches 4 cells is not thin.

**Dynamic shapes (main thread, rebuilt each query frame)**
- **Walkers:**
  - from `peds.sim.walkers` with `!gone` and within 12 m of the query;
  - a capsule from feet `w.p[1] + .1` to `w.p[1] + heightOf(w)`, default 1.75 m;
  - radius 0.32 m.
- **Cars:** `traffic.sim.cars`, an oriented box `len × 1.95 × 1.6` m at `(c.x, c.z)`, heading `c.h`. Use real vehicle dimensions if the registry exposes them.
- **Sim agents with `fix`:** their `p` is already correct (`pedsim.js:115`).

**Queries** (masks: `STATIC = 1`, `PEOPLE = 2`, `CARS = 4`, `STATIC_WIDE = 8` (static without `THIN` columns), `EXCEPT(w)`)

| Query | Returns | Cost target |
|---|---|---|
| `ray(a, b, mask) → {t, n, thin, kind}` | first hit along segment a→b: fraction, face normal, `THIN` flag of the column, kind | ≤ 15 µs for 8 m |
| `sweep(a, b, r, mask) → {t, n}` | first contact of a sphere of radius r moving a→b | ≤ 30 µs for 8 m, r 0.25 |
| `overlap(p, r, mask) → {depth, n}` | penetration and push direction (static: the nearest column face; dynamic: the capsule or box normal) | ≤ 10 µs |
| `distance(p, R, mask)` | nearest solid within R | ≤ 15 µs for R 2 m |
| `floorAt(x, z, y)` / `ceilAt(x, z, y)` | the nearest interval top below y and bottom above it | ≤ 2 µs |

- **`ray`** uses Amanatides & Woo 2D DDA over columns, testing the ray's y-span inside each column against that column's intervals.
- **`sweep`** uses a "fat" DDA: it visits columns within `r + 0.18` m of the segment and tests the sphere against each interval box (`[x, x+.25] × [lo, hi] × [z, z+.25]`), the closest-point test on a moving sphere. Dynamic shapes are tested analytically.
- **Status signals.**
  - `world.ready(x, z)` is true when the column data for that block exists.
  - Until it does, **fall back to the block's far-tier massing** (built at once, as `solid.js:38` does today). Never treat a block as empty while it loads.
- **Reference cost.** The probe's naive GT quad-box query, a 6 m segment through 1 m buckets in plain JavaScript, measured **0.033 ms**, and a point-distance query **0.020 ms**. The column DDA is expected to be several times cheaper.

### 4.3 Shared math (`damp.js`)

- `damp(x, target, hl, dt) = target + (x − target)·2^(−dt/hl)`, plus `dampAngle` (wrapped) and `dampVec3`.
- `spring(x, v, target, hl, dt)`: Holden's exact critically damped spring (§3.2), per component.
- `limitRate(prev, next, maxVel, maxAcc, dt, state)` for angles: clamp the angular velocity, then its change.
- **Rule.** No constant per-frame multipliers anywhere. Sub-step only where integration is non-linear: fly velocity uses up to 4 sub-steps of ≤ 1/120 s; collision runs once per frame on the total displacement.

### 4.4 Follow

**State (all scalars, all smoothed)**
- Pivot `Pv` (vector, spring);
- azimuth `az` and pitch `pt` (the user's);
- assist offsets `aAz`, `aPt`, `aLen`;
- arm length `arm`;
- look-ahead `La`.

**Per `late(dt)`**

1. **Anchor.**
   - `A = w.p + (0, 0.82·heightOf(w), 0)`, which is shoulder height (about 1.45 m for a 1.75 m look).
   - `Pv = spring(Pv, A)` with half-lives: xz **0.06 s**, y **0.18 s**. The y half-life filters curbs and the gait (Nesky #43).
   - Look-ahead: `La = damp(La, clamp(v_xz·0.35 s, 0.6 m), 0.3 s)`, where v is the walker's velocity from successive `w.p`. The look point is `Lk = Pv + La + (0, 0.1, 0)`.
2. **Orientation.**
   - Mouse, keys and pad change `az` and `pt` **directly this frame**, with no lag (fixes D6).
   - Auto-trail: when the walker moves (`vc > .25`) and there has been no orbit input for **1.0 s**, `az = dampAngle(az, heading + π, 0.6 s)` with the angular velocity capped at **1.2 rad/s**. When the walker stands still, the camera holds.
   - Pitch range [−0.15, 1.2]; default **0.24**.
3. **Desired arm.**
   - Direction `D(az + aAz, pt + aPt)`.
   - Length `L* = dist + aLen`, where `aLen ≤ 0`; `dist` default **4.6**, range [2.2, 42].
   - Shoulder offset: `so = 0.3 m` to the camera's right, scaled by `min(1, arm/4.6)`. This frames the subject slightly left and takes the line of sight out of the walker queue (D7).
4. **Physical collision (hard, every frame). Two different tests (Nesky #9/#10):**
   - **(a) The arm.** `t = world.sweep(Pv, Pv + D·L* + so, r = 0.22, STATIC_WIDE | CARS)`; `armColl = |D·L*|·t − 0.05`.
     - `STATIC_WIDE` skips `THIN` columns, so a post on the arm does **not** shorten it. This removes the "parks at the post" stall in D3.
     - `armColl` is a hard ceiling on `arm`: walls and cars never get between the pivot and the camera body.
   - **(b) The camera body.** Each frame, sweep the camera's own motion from last frame's pose to this frame's pose, `world.sweep(Cprev, C, 0.22, STATIC)`, with THIN columns included. On a hit, do 2 iterations of collide-and-slide (§4.6 step 4).
     - The camera physically goes *around* a pole (a lateral shift of centimetres) instead of through it or in front of it.
     - Then `world.overlap(C, 0.22, STATIC)` must be empty.
   - **People:** they are not in the sweep. If any walker capsule except the subject comes within 0.55 m horizontally of the camera point, apply PreserveHeight: raise the camera to the capsule top + 0.35 m (damped, half-life 0.12 s; at most +0.9 m).
5. **Line of sight (soft; tested every frame on 5 rays, STATIC only).**
   - From the would-be camera point `C' = Pv + D·min(L*, armColl) + so`, cast rays to the subject's head (0.95 h), chest (0.7 h), hips (0.45 h) and shoulders (±0.18 m at 0.78 h).
   - A ray counts as **wide-blocked** if its hit column is not `THIN`. Rays blocked only by thin columns are tolerated (Nesky #9).
   - `vis = 1 − wideBlocked/5`.
   - **Trigger:** `vis < 0.6` continuously for **0.2 s** (MinimumOcclusionTime). Then run the candidate search, at most every 3rd frame while occluded, and reuse the last winner otherwise (hysteresis):
     - candidates: `Δaz ∈ {0, ±0.26, ±0.52, ±0.87}` × `Δpt ∈ {0, +0.25}`, plus `pull` (`aLen` to the first wide hit − 0.3 m, arm ≥ 2.2 m);
     - for each, test the collision sweep, then the 5 rays;
     - score `= 4·(1 − vis) + 1.0·|Δaz| + 0.8·Δpt + 0.6·|Δlen|/dist + 0.5·[switching side vs. the last winner]`;
     - the lowest score becomes the assist target.
   - **Into the assist:** half-life **0.12 s**.
   - **Release:** after the line has been clear for **0.5 s**, the assist decays to 0 with half-life **0.35 s**. That is about the old `occlusionOut` (τ 0.55 s ≈ half-life 0.38 s).
   - **For comparison:** a Cinemachine damp time T is half-life ≈ 0.15·T, so DampingWhenOccluded 0.2 ≈ half-life 0.03 s and DampingFromCollision 0.5 ≈ half-life 0.075 s. Lyra eases out linearly over 0.15 s. Both are snappier. These calmer values suit a watch-the-city camera, and slime should tune them live.
   - **Thin occluders never trigger the search.** Optional for slime to decide: dither-fade static geometry inside the camera-to-subject cylinder (r 0.45 m, in front of the subject) in the block materials' shader, off by default.
6. **Whiskers (predictive; every 3rd frame).**
   - Rays from `Pv` at `az ± 0.35` and `az ± 0.7` rad, length `dist`, STATIC wide only.
   - If one side is blocked closer than `0.7·dist` and the other is not, and the walker is moving with no input, nudge `az` away at ≤ **0.4 rad/s**, fading in over 0.3 s (Nesky #5/#7, Lyra feelers).
7. **Arm length.**
   - `target = min(L*, armColl)`.
   - If `target < arm`: when the limit is `armColl`, `arm = target` (instant, hard); otherwise `arm = damp(arm, target, 0.08 s)`.
   - If `target > arm`: `arm = damp(arm, target, 0.35 s)` (ease out).
8. **Close-arm lift (replaces `follow.js:46`).**
   - While `arm < 2.6 m`, add `aPt += 0.3·(2.6 − arm)/(2.6 − 2.2)`, at most +0.3 rad. That looks over the shoulder.
   - Never place the camera within 0.5 m horizontally of the subject's axis. If it would be, lift it to the head + 0.5 m.
   - Minimum arm **2.2 m**. This ends the 1.7 m "back of the head" frames (D5).
9. **Pose.**
   - `C = Pv + D(az + aAz, pt + aPt)·arm + so·k`.
   - Final safety: `world.overlap(C, 0.2, STATIC)` should be empty; if not, put `C` at the collision point (hard), which should never trigger.
   - Rotation `lookAt(C, Lk)`.
   - When no input is active, auto-motion angular velocity is limited to **2.5 rad/s** and angular acceleration to **12 rad/s²** (`limitRate`). This catches any leftover pop. Input-driven rotation bypasses the limit.
10. **Subject switch (Tab, G, click).**
    - If the new subject is ≤ 25 m away and `world.ray(oldPv, newA, STATIC)` is clear: retarget `Pv` with a temporary half-life of **0.25 s**, and run steps 4–9 every frame. The camera glides and stays collision-correct throughout.
    - Otherwise **cut**: re-enter instantly at the new subject (Nesky #45: no rapid sweeping transitions).
    - Replace the rig's straight-line blend for follow with this.
11. **Lost subject.** Keep the current wait (`lostWait` 1.6 s, then the nearest walker), with the pivot holding `last`.

**Frame-rate independence.** Every step above uses `damp` / `spring` / `limitRate` with dt; nothing is per-frame. The candidate search's 3-frame cadence is the only frame-count rule. It changes when decisions are made, not the motion, and must be time-gated as well: at most every 50 ms.

### 4.5 First-person POV (a sub-mode of follow)

- **Enter/exit:**
  - **V** toggles (gamepad R3); wheel or F past the minimum arm also enters, and wheel or R exits.
  - The HUD shows "POV · <label>".
  - Photo mode with a follow subject may use POV too.
- **Eye:**
  - `E = w.p + R_y(h)·(0, 0.93·heightOf(w), 0.14)` (in front of the face).
  - Vertical half-life **0.1 s** (curbs). **No gait bob** (Oculus; Nesky #43).
  - Computed in `late`, after `peds.update` (D13), so it matches the body drawn this frame.
- **Heading:**
  - `h = yawS` passed through `spring` (half-life **0.18 s**), then `limitRate(1.6 rad/s ≈ 92°/s, 6 rad/s² ≈ 344°/s²)`.
  - Base pitch −0.06 rad.
  - The walker's own corner arcs (turn.js) are already soft; this removes the remaining per-step jitter.
- **Free look:**
  - Mouse and stick add `lookYaw` (±1.75 rad) and `lookPitch` ([−1.2, 1.0]) **directly**.
  - After **1.5 s** without input they recenter with half-life **0.8 s** (Cinemachine recentering Wait 1 / Time 2).
  - Keys A/D or Q/E rotate the look, not the walker.
- **Body:** `peds.hide(w, true)` on entry, `false` on exit or when the subject changes. Accept the loss of the subject's self-shadow in POV (Unreal does the same unless a hidden-shadow pass is added).
- **Projection:**
  - FOV **70°**, blended from 55° over the hand-off (Unreal FP template).
  - `camera.near = 0.06` in POV, restored to 0.1 on exit, with `updateProjectionMatrix` only on change.
- **Collision:**
  - `world.overlap(E, 0.12, STATIC | CARS)`. If it overlaps (a walker hugging a wall or stepping through a door), slide the eye back toward the head centre along −forward by up to 0.25 m (damp 0.05 s).
  - If it still overlaps, or the walker goes `gone` (indoors), drop to third-person follow automatically with a toast.
  - Other walkers inside 0.4 m of the eye are hidden (`peds.hide`, temporary) rather than letting the camera sit inside them.
- **Hand-off, follow → POV, 0.45 s smootherstep in parameter space:**
  - `arm` goes 2.2 m → 0;
  - the pivot goes from the shoulder to the eye;
  - rotation slerps from the follow rotation to the POV rotation;
  - FOV 55° → 70°;
  - the body hides when `arm < 0.6 m`, before the camera reaches the head.
  - POV → follow is the reverse; the body shows at `arm > 0.6 m`.
- **Comfort options** in `config.js`: `pov.rateLimit` (on), `pov.recentre` (on), `pov.fov`. Off-switches for slime to test.

### 4.6 Fly

1. **Look.** Raw deltas are applied this frame: `lookSmooth 0` in fly. Photo keeps its 0.14 s "cinematic" smoothing.
   - Spike filter in `input.js`: discard any single event with |movementX| or |movementY| > 400 px, and ignore motion for 150 ms after `pointerlockchange`.
2. **Wish velocity.**
   - Camera-space input × `speed`.
   - `speed = clamp(9 + 0.55·clearance, ·, 420) × speedMul × boost(3.2) × slow(0.3)`, where `clearance = y − max(world.top over a 3 × 3 sample within 6 m below)`.
   - `vel = wish + (vel − wish)·2^(−dt/hl)` with hl **0.12 s** while held and **0.28 s** when released. Inputs ramp over `inputSmooth` 0.07 s (keep).
   - Up to 4 sub-steps when dt > 1/120.
3. **Approach governor (fixes D10).**
   - Cast `world.sweep(p, p + v̂·Lg, r = 0.3, STATIC | CARS | PEOPLE)` with `Lg = min(300, v²/(2·a_max) + 3)`.
   - With a hit at distance d and normal n, cap the velocity component into the surface:
     `v_in,max = min( sqrt(2·a_max·max(0, d − 0.5)), max(0, d − 0.5)/0.25 s )`.
   - `a_max = 25 + 1.2·max(0, |v| − 100) m/s²`: 2.5 g up to 100 m/s; at 420 m/s it is 409 m/s², with a stopping distance of about 216 m.
   - The arrival runs at constant deceleration, then switches to the exponential law, never hitting anything.
   - Where the two laws meet, the deceleration jumps to 2·a_max: 50 m/s² at street speeds, under the 60 m/s² limit in Y2.
   - Keep the tangential component, so the camera turns along the wall instead of stopping.
4. **Collide-and-slide.**
   - Move by `vel·dt` with `world.sweep(r = 0.3)`, up to **4** iterations.
   - On a hit, advance to contact − 0.02 m, then clip the remaining displacement and `vel` against the face normal: `v −= n·min(0, v·n)·1.001` (Quake `PM_ClipVelocity`).
   - In a crease of two normals, slide along `n1 × n2`; with a third plane, stop.
   - Masks: STATIC | CARS | PEOPLE. People and cars move, so do this after their update; the one-frame staleness is absorbed by step 5.
5. **Depenetration.**
   - If `world.overlap(p, 0.3, ALL)` > 0 at frame start (a walker walked into a hovering camera, a car drove through it, or a block's mesh was swapped), push out along `n` by `depth + 0.02`.
   - Soft over half-life 0.06 s, with a hard cap: never leave a frame with depth > 0.05 m.
   - **Replaces `solid.js:69`'s "already inside, move freely".**
6. **Floor and ceiling.**
   - `floor = world.floorAt(x, z, y) + 1.4`. The descent speed is governed like walls, `v_down ≤ (y − floor)/0.25 s`, with no push-up spring, so there is no bounce (D11).
   - Ceiling 480 m the same way.
   - The camera still flies at eye level; collision with people now keeps it out of heads.
7. **Speed wheel, boost, slow:** unchanged.

### 4.7 Hand-offs (rig blends)

- Orbit → fly and fly → orbit: keep smootherstep. Each frame, test the blended point against the previous one: `world.sweep(prev, next, 0.25, STATIC)`.
  - If the straight path is blocked (a ray at start shows wide geometry), use the arc, with its apex at the maximum `top` along the path + 4 m, instead of the 80 m rule (`rig.js:49`).
- Into follow or POV: blend in parameter space (§4.4 step 10, §4.5). The rig's blend only eases from the old pose for the first ≤ 0.35 s, the follow pose being collision-correct from the start.

### 4.8 Tunables (`config.js`, replacing the follow and fly blocks; values above, gathered)

```js
world:  { col: .25, keepR: 96, maxBlocks: 24, thinMax: .6, thinBand: [.8, 2.4], fallbackFar: true },
follow: { dist: 4.6, distRange: [2.2, 42], pitch: .24, pitchRange: [-.15, 1.2], anchorH: .82, shoulder: .3,
          pivotHL: [.06, .18], lookAhead: .35, lookAheadMax: .6, lookAheadHL: .3,
          trailWait: 1.0, trailHL: .6, trailMaxRate: 1.2,
          radius: .22, peopleClear: .55, peopleLiftMax: .9,
          occl: { minTime: .2, clearTime: .5, inHL: .12, outHL: .35, vis: .6, every: .05,
                  yaws: [.26, .52, .87], lift: .25, w: { vis: 4, yaw: 1, pitch: .8, len: .6, flip: .5 } },
          whisk: { yaws: [.35, .7], near: .7, rate: .4 },
          armInHL: .08, armOutHL: .35, closeLift: { from: 2.6, max: .3 },
          autoRate: 2.5, autoAcc: 12, switchGlideMax: 25, switchHL: .25, fov: 55, lostWait: 1.6, cycleRadius: 70 },
pov:    { key: 'KeyV', eye: .93, fwd: .14, yHL: .1, headHL: .18, rate: 1.6, acc: 6, pitch: -.06,
          yawRange: 1.75, pitchRange: [-1.2, 1.0], recentreWait: 1.5, recentreHL: .8, fov: 70, near: .06,
          handoff: .45, hideAt: .6, eyeR: .12, eyeBack: .25 },
fly:    { speed: 9, altGain: .55, maxSpeed: 420, boost: 3.2, slow: .3, accelHL: .12, brakeHL: .28, inputSmooth: .07,
          lookSmooth: 0, radius: .3, aMin: 25, aFrom: 100, aPerV: 1.2, approachT: .25, slideIters: 4, floor: 1.4, ceiling: 480,
          depenHL: .06, spikePx: 400, lockQuietMs: 150, maxStep: 1 / 120, ... },
```

### 4.9 Performance budget (60 fps; the whole rig ≤ 0.3 ms mean, ≤ 0.6 ms p99)

| Mode | Per-frame work | Expected cost |
|---|---|---|
| Follow | 1 sweep (≤ 5 m) + 5 rays + people scan; every 3rd frame 4 whiskers; while occluded ≤ 14 candidates × (1 sweep + 5 rays), cadence ≥ 50 ms | 0.08–0.15 ms; worst search frame ≤ 0.5 ms |
| POV | 1 overlap + dynamic scan | < 0.03 ms |
| Fly | 1 governor sweep (≤ 300 m) + ≤ 4 slide sweeps + 1 overlap + floor | 0.05–0.2 ms |

- **Main thread:**
  - 0 ms of rasterising;
  - the structured-clone copy of a block's P and N arrays for the worker, at most one block per frame (median 97k quads ≈ 3.5 MB, about 0.3–0.5 ms, only when a block's full tier arrives);
  - receiving the result.
  - A later option: emit the columns from the block-build worker (`jobs.js`) and cache them with the tier. That removes the copy but changes the cache format.
- **Memory:** about 0.3 MB per block, ≤ 24 blocks ≈ 8 MB, against the slab grid's 6 × 4 KB arrays per block today.

---

## 5. Acceptance tests (the build agent must pass these)

**The harness.** Create `tools/camprobe.mjs` from Appendix A. It is this research probe plus pass/fail thresholds. Run it on a private port (not 5330), `q=medium`, 1280×720, and repeat scenarios B, C and the lamp passes at 30, 60 and 120 Hz using fixed-dt drivers.

**Ground-truth rule.** GT is the full tier's quad boxes, never the world being tested. Scripted walkers stand on `world.floorAt`, not on y = 0.

### Follow

| # | Metric (scenario) | Pass | Today |
|---|---|---|---|
| F1 | frames with GT camera→geometry < 0.12 m, or camera inside a walker or car (A1–A3, L, Tab switches) | **0** | 11 (A2); 0.01 m during a Tab |
| F2 | snaps: frames where camera speed > subject speed + 6 m/s, same subject (A, L) | **0** | 23–63 per 30 s; 138 in L; max 181 m/s |
| F3 | camera position acceleration, no input: p99 / max (A, L, B) | ≤ 25 / ≤ 60 m/s² | max 6,413–10,424 |
| F4 | view angular acceleration, no input: max; angular jerk p99 (A, L, B) | ≤ 25 rad/s²; ≤ 400 rad/s³ | 158 rad/s²; max 9,491 |
| F5 | lamp passes (L, 4 lamps × 0/0.3/0.6/1.0 m): arm shortened > 0.5 m by a THIN column | **0** passes | 13/16 pulled to 1.7 m |
| F6 | lamp passes: camera stall (camera < 0.5 × walker speed while the walker moves, no input) | **0** s | 1.0–1.8 s in 8 passes |
| F7 | wide occlusion: longest run with GT visibility < 50 % where the blockers are not thin or people (A, plus a scripted wall-corner walk) | ≤ 250 ms | 500 ms (A2) |
| F8 | thin occlusion: longest run with < 50 % visible due to a post (L at 0 m) | ≤ 900 ms (a walker passes a pole in about 0.6 s) | under 75 % for 1.9–5.0 s, reaching 0 % |
| F9 | frame-rate: the same replayed path at 30 / 60 / 120 Hz, max position Δ vs 120 Hz | ≤ 0.10 m | 0.92 m (30 Hz) |
| F10 | orbit at 2 rad/s for 1.5 s: azimuth lag; radius sag (open ground) | ≤ 3°; ≤ 2 % | 31–37°; ≈ 12 % in theory |
| F11 | minimum arm, and maximum pitch reached automatically (A) | arm ≥ 2.2 m; auto pitch ≤ pitch + 0.55 rad | 1.70 m; overhead shots |
| F12 | Tab switch ≤ 25 m: GT clearance during the glide; switch > 25 m is a cut (no travel frames) | ≥ 0.12 m | 0.01 m |
| F13 | *(report only)* frames with another walker on the camera→chest line (A) | target ≤ 10 % | 15–41 % |

### Fly

| # | Metric (scenario) | Pass | Today |
|---|---|---|---|
| Y1 | frames inside a walker capsule or a car box, or GT camera→geometry < 0.12 m (D1, D1b, D2, D3, plus a hover test: camera still at 1.6 m over a busy sidewalk for 10 s) | **0** | 4 (person) + 3 (car) in D1b; 10 (car) in D2 |
| Y2 | full-boost run at a wall (C wall): peak deceleration; jerk max | ≤ 60 m/s²; ≤ 3,000 m/s³ | 720 / 1,121 / 1,567 m/s²; jerk up to 204,898 m/s³ |
| Y3 | same, stop position spread across 30 / 60 / 120 Hz | ≤ 0.25 m | about 0.1 m (ok) |
| Y4 | 30° glancing run at a wall: tangential speed kept after contact | ≥ 80 % | per-axis stop (×0.2 per frame) |
| Y5 | glide after release (C cruise): spread across 30 / 60 / 120 Hz | ≤ 2 % | 15 % |
| Y6 | floor approach (C floor): overshoot above floor + 0.1 m after release | ≤ 0.2 m | rises to 3.2 m (+1.8) |
| Y7 | mouse look: yaw applied in the frame the delta arrives; a single 1,000 px event ignored | yes / yes | 33 ms smoothing; no filter |
| Y8 | start a frame inside a solid (inject one): out within 0.25 s, never moving deeper | yes | moves freely (`solid.js:69`) |

### POV

| # | Metric | Pass |
|---|---|---|
| P1 | follow a walker for 60 s in POV (A spots): GT eye→geometry < 0.06 m frames; the subject's own body drawn while arm < 0.6 m | 0 ; 0 |
| P2 | yaw rate ≤ 1.6 rad/s and yaw acceleration ≤ 6 rad/s² without input; vertical eye jitter (high-pass > 2 Hz) amplitude | yes ; ≤ 1 cm |
| P3 | eye vs. the body drawn this frame: `|E − (w.p + offset)|`, measured after `peds.update` | ≤ 1 mm |
| P4 | hand-off follow ↔ POV duration; no frame with the camera inside the subject's capsule while the body is visible | ≤ 0.5 s ; 0 |
| P5 | subject goes indoors, or the eye is stuck in a wall: falls back to third person within | ≤ 0.3 s |

### Performance

| # | Metric | Pass | Today |
|---|---|---|---|
| R1 | rig `update + late`, mean / p99 over A + D runs | ≤ 0.3 / ≤ 0.6 ms | 0.03–0.14 / max 1.6 ms |
| R2 | main-thread time spent building collision data per frame | ≤ 0.5 ms, on block arrival only (copy) | up to 1.5 ms of rasterising |
| R3 | frame-time p95 unchanged versus the camera pass (`tools/flythrough.mjs --only camfly,camfollow`) | ≤ +0.5 ms | — |

---

## 6. Build plan and effort

**Pass 1** (one agent session, about 4–5 h of agent time): the core.
1. `damp.js`, `world.js`, `world.worker.js`: column intervals, the thin flag, dynamic shapes, all queries, the far-tier fallback. Unit-check the queries against the GT quad boxes on 3 blocks.
2. The `main.js` late hook. The rig calls follow in `late`.
3. Follow rewrite (§4.4) and the subject-switch glide or cut.
4. `tools/camprobe.mjs` from Appendix A with the follow metrics F1–F12 and R1–R2; run it at 30 / 60 / 120 Hz.
5. Delete `solid.js` once photo autofocus and fly use `world.js`. If fly still depends on `solid.js`, port only the floor and sweep calls to `world.js` in this pass.

**Pass 2** (one session, about 3–4 h):
1. Fly (§4.6): governor, collide-and-slide, depenetration, people and cars, raw look and the spike filter.
2. POV (§4.5): `peds.hide`, `heightOf`, the controller, the hand-off, comfort switches.
3. Blend path checks (§4.7).
4. The full acceptance run F, Y, P, R at 30 / 60 / 120 Hz, a review board of before and after frames at the same lamp passes and wall runs, and a live session with slime to tune the half-lives and `shoulder`.

**Risks**
- The thin-flag heuristic may tag a narrow wall pier as thin. The fallback is the 5-ray fan's "3 of 5 wide" rule; the probe's lamp and wall-corner scenarios will show it.
- The one-frame-old dynamic shapes in fly are absorbed by depenetration.
- Worker build latency on first arrival is covered by the far fallback.

**Decisions for slime** (defaults in brackets)
- (1) Dither-fade thin occluders inside the camera-to-subject cylinder? [off]
- (2) Over-the-shoulder framing `shoulder 0.3` versus centred [0.3]
- (3) POV key V [V]
- (4) Fly eye-level floor 1.4 m with people solid, versus a 2.0 m floor above heads [1.4]

---

## 7. Evidence frames (`style/city/shots/camera-research/`)

| Frame | Shows |
|---|---|
| `A2-follow-t27.0.png` | arm pulled to 1.70 m; the back of the head fills a third of the frame; camera 9 cm from a wall (D5) |
| `A2-follow-t20.1.png` | right after a Tab: the camera wedged in a corner, looking straight down at the head, 8 cm from geometry (D8, D5) |
| `L1-lamp-lat0-occl.png` | the lamp pole fills the frame centre, the subject 0 % visible, the camera snapped at 170 m/s that frame (D3, D4) |
| `L0-lamp-lat0-pull.png` | most pulled-in frame of a lamp pass: the pole in front of the walker, 33 % visible (D3) |
| `L0-lamp-lat0.3-occl.png`, `L0-lamp-lat1-occl.png` | pulled to 1.7 m beside the pole, looking steeply down (D3, D5). The "0 % visible" label on the second is a curb false positive (§1 caveat). |
| `L1-lamp-lat0.3-occl.png` | a trash can (a small prop the mid tier drops) covering half the walker (D2) |
| `L0-*`, `L1-*` (others) | the remaining lamp passes (least-visible and most-pulled frames) |
| `D1b-fly-t1.8.png` | fly with the camera inside a walker's head, which fills the lower left of the frame (D1) |
| `D2-fly-t2.0.png` | fly with the camera inside a box truck (D1) |

The magenta capsule in the L frames is the scripted walker, drawn by the probe.

---

## Appendix A — the probe (in-page instrument; the base for `tools/camprobe.mjs`)

**Driver.** A Node driver opens headless Chrome over the DevTools protocol. Copy `session()` from `tools/flythrough.mjs` and use `?q=medium&w=1280&h=720&nodyn=1`. It waits for `__city.marks.full`, then evaluates `(() => { <this file> ; return pageProbe(); })()`. After that it calls the following and saves the JSON plus the shots:
- `__cp.followReal({...})`
- `__cp.lampPass(lamp, lat)` for lamps from `__cp.lampsNear(-70, 10, 90)`
- `__cp.followFixed(path, hz)`
- `__cp.flyFixed(script, hz, start)`
- `__cp.flyReal({...})`

**Fixed-dt scenarios.** They drive *private* controllers (`createFollow` / `createFly` imported from the rig's own modules, sharing the rig's solids) without rendering. For the rebuilt rig, point them at the new controllers and `world.js`.

**Metrics** were computed offline from the per-frame rows:
- kinematics by finite differences with the recorded dt;
- runs of `vis < .5`;
- `allowed < dist − .6` for pull-ins;
- camera speed > subject speed + 6 m/s for snaps.

```js
// in-page camera probe (read-only research instrument; injected via CDP). Ground truth = the FULL tier's quads (exact voxel faces),
// independent of solid.js's mid-tier slab grid.
async function pageProbe() {
  const C = window.__city, THREE = C.THREE, R = C.cam, S = R.solids;
  const { P } = await import(new URL('plan.js', location.href).href);
  const { createFly } = await import(new URL('camera/fly.js', location.href).href);
  const { createFollow } = await import(new URL('camera/follow.js', location.href).href);
  const { CAM } = await import(new URL('camera/config.js', location.href).href);
  // ── ground truth geometry: per block, AABBs of every non-ground quad of the full tier (else mid), bucketed into 1 m cells
  const GT = new Map(); let stamp = 1; const seen = new Uint32Array(1 << 22);
  function gtBlock(i, j) {
    const k = i + ',' + j, r = C.stream.blocks.get(k); if (!r) return null;
    const full = Array.isArray(r.data.full) ? r.data.full.filter(t => t && t.n) : [];
    const src = full.length ? full : r.data.mid?.P ? [r.data.mid] : r.data.far?.P ? [r.data.far] : null; if (!src) return null;
    let g = GT.get(k); if (g && g.src === src[0]) return g;
    let nq = 0; for (const t of src) nq += t.n / 4; const B = new Float32Array(nq * 6); let m = 0;
    const cells = Array.from({ length: P * P }, () => []);
    for (const t of src) { const p = t.P, o = t.o;
      for (let q = 0; q < t.n; q += 4) { let ax = 1e9, bx = -1e9, ay = 1e9, by = -1e9, az = 1e9, bz = -1e9;
        for (let v = q * 3, e = v + 12; v < e; v += 3) { const x = p[v] * .01 + o[0], y = p[v + 1] * .01 + o[1], z = p[v + 2] * .01 + o[2];
          if (x < ax) ax = x; if (x > bx) bx = x; if (y < ay) ay = y; if (y > by) by = y; if (z < az) az = z; if (z > bz) bz = z; }
        if (by < .3) continue; const b = m * 6; B[b] = ax; B[b + 1] = ay; B[b + 2] = az; B[b + 3] = bx; B[b + 4] = by; B[b + 5] = bz;
        const ix0 = Math.max(0, Math.floor(ax - r.x0)), ix1 = Math.min(P - 1, Math.floor(bx - r.x0 - 1e-6)), iz0 = Math.max(0, Math.floor(az - r.z0)), iz1 = Math.min(P - 1, Math.floor(bz - r.z0 - 1e-6));
        for (let iz = iz0; iz <= iz1; iz++) for (let ix = ix0; ix <= ix1; ix++) cells[iz * P + ix].push(m); m++; } }
    g = { src: src[0], B, n: m, cells, x0: r.x0, z0: r.z0, tier: full.length ? 'full' : 'mid' }; GT.set(k, g); return g;
  }
  function cellQuads(x, z, cb) { const i = Math.floor(x / P), j = Math.floor(z / P), g = gtBlock(i, j); if (!g) return; const ix = Math.floor(x - g.x0), iz = Math.floor(z - g.z0);
    if (ix < 0 || iz < 0 || ix >= P || iz >= P) return; for (const q of g.cells[iz * P + ix]) { const key = (((i & 1023) * 1024 + (j & 1023)) * 0 + q); cb(g, q); } }
  // first hit of segment a→b (fraction 0..1) against quad AABBs; also returns the hit point's quad box
  function segHit(ax, ay, az, bx, by, bz, from = 0) {
    const dx = bx - ax, dy = by - ay, dz = bz - az, L = Math.hypot(dx, dy, dz); if (L < 1e-6) return null; stamp++; let best = 1, bq = null, bg = null; const done = new Set();
    for (let s = 0; s <= L + .2; s += .25) { const f = Math.min(1, s / L), x = ax + dx * f, z = az + dz * f;
      for (const ox of [-.3, 0, .3]) for (const oz of [-.3, 0, .3]) { const cx = Math.floor(x + ox), cz = Math.floor(z + oz), ck = cx * 100003 + cz; if (done.has(ck)) continue; done.add(ck);
        cellQuads(cx + .5, cz + .5, (g, q) => { const B = g.B, b = q * 6, id = (g.x0 * 7 + g.z0 * 13 + q) >>> 0; // per-block quad dedupe is cheap enough to skip
          let t0 = 0, t1 = 1; const e = .005;
          for (let k = 0; k < 3; k++) { const o = k === 0 ? ax : k === 1 ? ay : az, d = k === 0 ? dx : k === 1 ? dy : dz, lo = B[b + k] - e, hi = B[b + 3 + k] + e;
            if (Math.abs(d) < 1e-9) { if (o < lo || o > hi) return; continue; } let ta = (lo - o) / d, tb = (hi - o) / d; if (ta > tb) [ta, tb] = [tb, ta]; if (ta > t0) t0 = ta; if (tb < t1) t1 = tb; if (t0 > t1) return; }
          if (t0 >= from && t0 < best) { best = t0; bq = q; bg = g; } }); } }
    if (!bq && bq !== 0) return null; const B = bg.B, b = bq * 6; return { f: best, box: [B[b], B[b + 1], B[b + 2], B[b + 3], B[b + 4], B[b + 5]] };
  }
  // min distance from a point to any quad within rad
  function minDist(x, y, z, rad = .8) { let best = 1e9; for (let cx = Math.floor(x - rad); cx <= Math.floor(x + rad); cx++) for (let cz = Math.floor(z - rad); cz <= Math.floor(z + rad); cz++)
      cellQuads(cx + .5, cz + .5, (g, q) => { const B = g.B, b = q * 6; const ddx = Math.max(B[b] - x, 0, x - B[b + 3]), ddy = Math.max(B[b + 1] - y, 0, y - B[b + 4]), ddz = Math.max(B[b + 2] - z, 0, z - B[b + 5]); const d = Math.hypot(ddx, ddy, ddz); if (d < best) best = d; });
    return Math.min(best, y); }
  // is the camera point inside a building mass? (the slab grid says so with r≈0 AND the ground-truth box ray up/down hits on both sides)
  const walkers = () => C.peds?.sim?.walkers || [];
  // capsule distance (feet → head) for a walker: axis from y+.3 to y+1.45, radius .3
  const capD = (w, x, y, z) => { const yy = Math.max(w.p[1] + .3, Math.min(w.p[1] + 1.45, y)); return Math.hypot(x - w.p[0], y - yy, z - w.p[2]) - .3; };
  function nearestPerson(x, y, z, skip) { let best = 1e9, bw = null; for (const w of walkers()) { if (w === skip || w.gone) continue; const dx = w.p[0] - x, dz = w.p[2] - z; if (dx * dx + dz * dz > 25) continue; const d = capD(w, x, y, z); if (d < best) { best = d; bw = w; } } return [best, bw]; }
  const cars = () => C.traffic?.sim?.cars || [];
  function nearestCar(x, y, z) { let best = 1e9; for (const c of cars()) { const dx = x - c.x, dz = z - c.z; if (dx * dx + dz * dz > 64) continue; const s = Math.sin(c.h), co = Math.cos(c.h), lz = dx * s + dz * co, lx = dx * co - dz * s; // local: z along heading
      const hl = (c.len || 4.4) / 2, hw = .95, ex = Math.max(Math.abs(lx) - hw, 0), ez = Math.max(Math.abs(lz) - hl, 0), ey = Math.max(y - 1.55, 0, -y); const d = Math.hypot(ex, ey, ez); if (d < best) best = d; } return best; }
  // segment vs walker capsules (approx: closest approach of the segment to the capsule axis)
  function segPerson(a, b, skip) { let hit = 0; const d = new THREE.Vector3().subVectors(b, a), L = d.length(); d.divideScalar(L);
    for (const w of walkers()) { if (w === skip || w.gone) continue; const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2; if ((w.p[0] - mx) ** 2 + (w.p[2] - mz) ** 2 > (L / 2 + 1) ** 2) continue;
      for (let s = .5; s < L - .3; s += .2) { const x = a.x + d.x * s, y = a.y + d.y * s, z = a.z + d.z * s; if (capD(w, x, y, z) < 0) { hit++; break; } } } return hit; }
  // subject visibility: 12 rays from the camera to points on the body; fraction not blocked by geometry; thin = the blocker is a post/pole/sign
  const RV = new THREE.Vector3(), SV = new THREE.Vector3();
  function visibility(cam, w) { const yaw = Math.atan2(w.p[0] - cam.x, w.p[2] - cam.z), lx = Math.cos(yaw), lz = -Math.sin(yaw); let vis = 0, n = 0, thin = 0, wide = 0, people = 0; const boxes = [];
    for (const h of [.4, .85, 1.25, 1.6]) for (const o of [-.17, 0, .17]) { n++; const tx = w.p[0] + lx * o, ty = w.p[1] + h, tz = w.p[2] + lz * o;
      const hit = segHit(cam.x, cam.y, cam.z, tx, ty, tz); const dd = Math.hypot(tx - cam.x, ty - cam.y, tz - cam.z);
      if (!hit || hit.f * dd > dd - .35) { vis++; continue; }
      const bx = hit.box, ext = Math.max(bx[3] - bx[0], bx[5] - bx[2]); const hx = cam.x + (tx - cam.x) * hit.f, hz = cam.z + (tz - cam.z) * hit.f; const sl = S.slab(hx, hz);
      const sw = sl ? Math.max(sl.x1 - sl.x0, sl.z1 - sl.z0) : 1; if (sw < .75 && ext < 1.2) thin++; else wide++; if (boxes.length < 2) boxes.push(bx.map(v => +v.toFixed(2))); }
    RV.set(cam.x, cam.y, cam.z); SV.set(w.p[0], w.p[1] + 1.2, w.p[2]); people = segPerson(RV, SV, w);
    return { vis: vis / n, thin, wide, people, boxes }; }

  const raf = () => new Promise(r => requestAnimationFrame(r));
  const key = (code, down) => dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, key: code }));
  const shots = [];
  function capture(name, notes = [], mark = null) { C.renderer.render(C.scene, C.camera); const c = document.createElement('canvas'); c.width = 960; c.height = 540; const g = c.getContext('2d');
    g.drawImage(C.renderer.domElement, 0, 0, 960, 540);
    if (mark) { const v = new THREE.Vector3(...mark).project(C.camera); if (v.z < 1) { const x = (v.x + 1) / 2 * 960, y = (1 - v.y) / 2 * 540; g.strokeStyle = '#ff2a6a'; g.lineWidth = 3; g.beginPath(); g.arc(x, y, 22, 0, 7); g.stroke(); } }
    g.fillStyle = 'rgba(0,0,0,.62)'; g.fillRect(0, 0, 960, 18 + notes.length * 17); g.fillStyle = '#fff'; g.font = '13px monospace'; notes.forEach((s, k) => g.fillText(s, 8, 16 + k * 17));
    shots.push({ name, data: c.toDataURL('image/png') }); }
  const yawPitch = q => { const e = new THREE.Euler().setFromQuaternion(q, 'YXZ'); return [e.y, e.x]; };

  // ── A. FOLLOW, real time: the rig's own follow mode on real walkers; per frame the ground truth
  async function followReal({ view = 'fitstreet', at = null, dur = 24, tab = 8, shotBudget = 6, label = 'A' } = {}) {
    R.toOrbit({ instant: true }); if (at) { C.camera.position.set(at[0] + 20, 30, at[1] + 20); C.controls.target.set(at[0], 0, at[1]); C.controls.update(); } else C.setView(view);
    for (let k = 0; k < 90; k++) await raf();   // walkers populate
    if (!R.setMode('follow')) return { error: 'nobody to follow' };
    for (let k = 0; k < 10; k++) await raf();
    const F = []; let t0 = performance.now(), last = t0, tabs = 0, lastShot = -9, occRun = 0, prevAllowed = null; const W0 = R.follow.subject;
    while (true) { const now = await raf(), t = (now - t0) / 1000; if (t > dur) break; const dt = (now - last) / 1000; last = now;
      if (t > (tabs + 1) * tab) { tabs++; key('Tab', true); key('Tab', false); }
      const w = R.follow.subject; if (!w || R.blending) { F.push({ t, dt, blend: 1 }); continue; }
      const cam = C.camera.position, [yaw, pitch] = yawPitch(C.camera.quaternion), dbg = R.follow.dbg; const v = visibility(cam, w);
      const nc = minDist(cam.x, cam.y, cam.z, .8), [pd] = nearestPerson(cam.x, cam.y, cam.z, w);
      // what pulled the camera in: the slab under the clear point
      let pullThin = null; if (dbg.allowed < dbg.dist - .6) { const az = Math.atan2(dbg.C[0] - dbg.L[0], dbg.C[2] - dbg.L[2]), pt = dbg.pitch, ux = Math.sin(az) * Math.cos(pt), uy = Math.sin(pt), uz = Math.cos(az) * Math.cos(pt);
        for (let s = CAM.follow.skip; s < dbg.dist; s += .25) { const x = dbg.L[0] + ux * s, y = dbg.L[1] + uy * s, z = dbg.L[2] + uz * s; const sl = S.slab(x, z);
          if (sl && sl.lo < S.FLOAT && sl.lo - .3 < y && y < sl.hi + .3) { pullThin = +Math.max(sl.x1 - sl.x0, sl.z1 - sl.z0).toFixed(2); break; } } }
      const row = { t: +t.toFixed(3), dt: +dt.toFixed(4), c: [cam.x, cam.y, cam.z].map(v => +v.toFixed(3)), yaw: +yaw.toFixed(4), pitch: +pitch.toFixed(4), s: [w.p[0], w.p[1], w.p[2]].map(v => +v.toFixed(3)), sy: +(w.yawS ?? w.p[3]).toFixed(3), vc: +(w.vc ?? 0).toFixed(2),
        allowed: +dbg.allowed.toFixed(2), dist: +dbg.dist.toFixed(2), clear: +dbg.clear.toFixed(2), duck: +dbg.duck.toFixed(2), vis: +v.vis.toFixed(2), thin: v.thin, wide: v.wide, ppl: v.people, nc: +nc.toFixed(2), pd: +pd.toFixed(2), pullThin, id: w.id, inside: S.blocked(cam.x, cam.y, cam.z, .05) ? 1 : 0 };
      F.push(row);
      occRun = v.vis < .5 ? occRun + dt : 0; const big = prevAllowed !== null && Math.abs(row.allowed - prevAllowed) > .8; prevAllowed = row.allowed;
      if (shots.length < 40 && t - lastShot > 2.5 && ((occRun > .25 && v.thin) || (occRun > .4) || (pullThin !== null && pullThin < .8 && big) || nc < .12 || (pd < .05))) { lastShot = t;
        const why = v.vis < .5 ? (v.thin ? 'OCCLUDED by thin prop' : v.people ? 'OCCLUDED (geometry + people)' : 'OCCLUDED by wall/mass') : pullThin !== null ? 'PULLED IN by a ' + pullThin + ' m footprint' : nc < .12 ? 'NEAR-CLIP into geometry' : 'camera inside a walker';
        capture(`${label}-follow-t${t.toFixed(1)}`, [`FOLLOW t=${t.toFixed(2)}s  ${why}`, `visible ${Math.round(v.vis * 100)}%  (thin-blocked rays ${v.thin}, wall rays ${v.wide}, people on line ${v.people})`, `arm: wanted ${dbg.dist.toFixed(2)} m, allowed ${dbg.allowed.toFixed(2)} m, clear ${dbg.clear.toFixed(2)} m · cam→geom ${nc.toFixed(2)} m · cam→person ${pd.toFixed(2)} m`], [w.p[0], w.p[1] + 1.2, w.p[2]]); } }
    R.toOrbit({ instant: true }); return { F, perf: R.stats() };
  }

  // ── B. FOLLOW, fixed dt: the follow controller on a replayed (recorded) walker path, at 30 / 60 / 120 Hz, no rendering
  function followFixed(path, hz, opts = {}) { const fol = createFollow(S, R.people), dt = 1 / hz, fake = { p: [0, 0, 0, 0], yawS: 0, vc: 1.3, id: -1, tier: 1 };
    const at = t => { let k = 0; while (k < path.length - 2 && path[k + 1].t < t) k++; const a = path[k], b = path[k + 1], f = Math.max(0, Math.min(1, (t - a.t) / Math.max(1e-6, b.t - a.t)));
      for (let i = 0; i < 3; i++) fake.p[i] = a.s[i] + (b.s[i] - a.s[i]) * f; let dy = b.sy - a.sy; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); fake.yawS = a.sy + dy * f; fake.p[3] = fake.yawS; fake.vc = a.vc + (b.vc - a.vc) * f; };
    at(path[0].t); fol.enter({ p: new THREE.Vector3(), q: new THREE.Quaternion(), fov: 55 }, fake); const out = []; const T1 = path[path.length - 1].t - path[0].t;
    const I = { look: { x: 0, y: 0 }, move: { x: 0, y: 0, z: 0 }, rate: { x: 0, y: 0 }, wheel: 0, boost: false, slow: false, pad: false, key: () => false, any: () => false };
    let ms = 0, n = 0;
    for (let t = 0; t <= T1; t += dt) { at(path[0].t + t); if (opts.orbit && t > 1 && t < 1 + opts.orbit.dur) I.look.x = -opts.orbit.rate * dt / (CAM.look.base * CAM.look.sens * 1.4); else I.look.x = 0;
      const t0 = performance.now(); fol.update(dt, I); ms += performance.now() - t0; n++; const d = fol.dbg, [yaw, pitch] = yawPitch(fol.pose.q);
      out.push({ t: +t.toFixed(4), c: fol.pose.p.toArray().map(v => +v.toFixed(4)), yaw: +yaw.toFixed(5), pitch: +pitch.toFixed(5), allowed: +d.allowed.toFixed(3), s: fake.p.slice(0, 3).map(v => +v.toFixed(3)), L: d.L }); }
    return { hz, out, ms: ms / n };
  }

  // ── C. FLY, fixed dt: a private fly controller (same code, same solids) on scripted input at 30 / 60 / 120 Hz
  function flyFixed(script, hz, start) { const fl = createFly(S), dt = 1 / hz; const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(start.pitch || 0, start.yaw, 0, 'YXZ'));
    fl.enter({ p: new THREE.Vector3(...start.p), q, fov: 60 }); const out = []; let ms = 0, n = 0;
    const I = { look: { x: 0, y: 0 }, move: { x: 0, y: 0, z: 0 }, rate: { x: 0, y: 0 }, wheel: 0, boost: false, slow: false, pad: false, keys: new Set(), key(c) { return this.keys.has(c); }, any(...c) { return c.some(x => this.keys.has(x)); } };
    let lookAcc = 0;
    for (let t = 0; t <= script.dur; t += dt) { const s = script.at(t); I.move.x = s.mx || 0; I.move.z = s.mz || 0; I.move.y = s.my || 0; I.boost = !!s.boost; I.keys = new Set(s.keys || []);
      // look: a flick of `flick` px spread over the frames inside [f0, f1] (what a mouse delivers at that frame rate)
      I.look.x = s.lookRate ? s.lookRate * dt : 0; I.look.y = 0;
      const t0 = performance.now(); fl.update(dt, I); ms += performance.now() - t0; n++; const [yaw, pitch] = yawPitch(fl.pose.q), p = fl.pose.p;
      out.push({ t: +t.toFixed(4), c: [p.x, p.y, p.z].map(v => +v.toFixed(4)), v: +fl.speed.toFixed(3), yaw: +yaw.toFixed(5), nc: +minDist(p.x, p.y, p.z, 1.2).toFixed(3), inside: S.blocked(p.x, p.y, p.z, .05) ? 1 : 0, pd: +nearestPerson(p.x, p.y, p.z)[0].toFixed(2) }); }
    return { hz, out, ms: ms / n };
  }

  // ── D. FLY, real time through people / cars / a wall (the rig's own fly mode, synthetic keys)
  async function flyReal({ pos, yaw, pitch = 0, keys = ['KeyW'], dur = 5, label = 'D', shotEvery = null, shotWhen = 'person' }) {
    R.toOrbit({ instant: true }); C.camera.position.set(...pos); C.camera.quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(C.camera.quaternion); C.controls.target.copy(C.camera.position).addScaledVector(fwd, 20);
    for (let k = 0; k < 60; k++) { C.camera.position.set(...pos); C.camera.quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ')); await raf(); }
    R.setMode('fly', { lock: false }); await raf(); R.fly.look(yaw, pitch);
    for (const k of keys) key(k, true); const F = []; const t0 = performance.now(); let last = t0, lastShot = -9;
    while (true) { const now = await raf(), t = (now - t0) / 1000; if (t > dur) break; const dt = (now - last) / 1000; last = now; const p = C.camera.position;
      const [pd, pw] = nearestPerson(p.x, p.y, p.z), cd = nearestCar(p.x, p.y, p.z), nc = minDist(p.x, p.y, p.z, 1.2);
      F.push({ t: +t.toFixed(3), dt: +dt.toFixed(4), c: [p.x, p.y, p.z].map(v => +v.toFixed(3)), v: +R.fly.speed.toFixed(2), pd: +pd.toFixed(2), cd: +cd.toFixed(2), nc: +nc.toFixed(3), inside: S.blocked(p.x, p.y, p.z, .05) ? 1 : 0 });
      const trig = shotWhen === 'person' ? pd < .05 : shotWhen === 'car' ? cd < .05 : nc < .12;
      if (shots.length < 40 && t - lastShot > (shotEvery || 1.2) && trig) { lastShot = t; capture(`${label}-fly-t${t.toFixed(1)}`, [`FLY t=${t.toFixed(2)}s  speed ${R.fly.speed.toFixed(1)} m/s  height ${p.y.toFixed(2)} m`, `camera→nearest person ${pd.toFixed(2)} m (<0 = inside the body) · →car ${cd.toFixed(2)} m · →geometry ${nc.toFixed(2)} m`], pw && pd < 1 ? [pw.p[0], pw.p[1] + 1, pw.p[2]] : null); } }
    for (const k of keys) key(k, false); for (let k = 0; k < 30; k++) await raf(); R.toOrbit({ instant: true }); return { F, perf: R.stats() };
  }
  // find a straight, busy sidewalk run near (x, z): the walker with the most walkers within 12 m ahead along its heading
  function busyRun(x, z, r = 120) { let best = null, bn = -1; for (const w of walkers()) { if (w.gone || !w.tier || (w.vc ?? 0) < .5) continue; if (Math.hypot(w.p[0] - x, w.p[2] - z) > r) continue; const h = w.yawS ?? w.p[3], fx = Math.sin(h), fz = Math.cos(h); let n = 0;
      for (const o of walkers()) { const dx = o.p[0] - w.p[0], dz = o.p[2] - w.p[2], a = dx * fx + dz * fz, l = Math.abs(dx * fz - dz * fx); if (a > 0 && a < 25 && l < 1.2) n++; } if (n > bn) { bn = n; best = w; } }
    return best ? { p: [best.p[0], best.p[1], best.p[2]], h: best.yawS ?? best.p[3], n: bn } : null; }
  function busyRoad(x, z, r = 150) { let best = null, bn = -1; for (const c of cars()) { if (Math.hypot(c.x - x, c.z - z) > r) continue; let n = 0; const fx = Math.sin(c.h), fz = Math.cos(c.h);
      for (const o of cars()) { const dx = o.x - c.x, dz = o.z - c.z, a = dx * fx + dz * fz, l = Math.abs(dx * fz - dz * fx); if (a > 0 && a < 60 && l < 2) n++; } if (n > bn) { bn = n; best = c; } } return best ? { p: [best.x, 0, best.z], h: best.h, n: bn } : null; }
  // ── L. LAMP POSTS: a scripted walker passing a real corner lamp at lateral offsets; the follow controller at fixed dt; ground truth per frame
  const { cornerLamps, signalPoles } = await import(new URL('ground.js', location.href).href);
  function lampsNear(x, z, r = 90) { const out = []; const i0 = Math.floor((x - r) / P), i1 = Math.floor((x + r) / P), j0 = Math.floor((z - r) / P), j1 = Math.floor((z + r) / P);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const b = C.stream.blocks.get(i + ',' + j); if (!b || !Array.isArray(b.data.full) || !b.data.full.some(Boolean)) continue;
      for (const [lx, lz, rot] of cornerLamps(i, j)) { const cells = []; for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) { const s = S.slab(lx + dx, lz + dz); if (s) cells.push([dx, dz, +s.lo.toFixed(2), +s.hi.toFixed(2), +(s.x1 - s.x0).toFixed(2), +(s.z1 - s.z0).toFixed(2)]); }
        out.push({ i, j, x: lx, z: lz, rot, cells }); } } return out; }
  let marker = null;
  function mark(p) { if (!marker) { marker = new THREE.Mesh(new THREE.CapsuleGeometry(.28, 1.1, 4, 8), new THREE.MeshBasicMaterial({ color: 0xff2a9a })); C.scene.add(marker); } marker.visible = !!p; if (p) marker.position.set(p[0], p[1] + .85, p[2]); }
  async function lampPass(lamp, lat, { hz = 60, shoot = true, label = 'L' } = {}) {
    // the lamp stands .35 m in from a curb; the sidewalk runs along z if rot is 3 or 1 (west / east side), along x if 0 or 2
    const alongZ = lamp.rot === 3 || lamp.rot === 1, inward = lamp.rot === 3 || lamp.rot === 2 ? 1 : -1;
    const ax = alongZ ? lamp.x + inward * lat : lamp.x - 5, az = alongZ ? lamp.z - 5 : lamp.z + inward * lat, ux = alongZ ? 0 : 1, uz = alongZ ? 1 : 0;
    const fol = createFollow(S, R.people), dt = 1 / hz, fake = { p: [ax, 0, az, Math.atan2(ux, uz)], yawS: Math.atan2(ux, uz), vc: 1.35, id: -7, tier: 1 };
    const I = { look: { x: 0, y: 0 }, move: { x: 0, y: 0, z: 0 }, rate: { x: 0, y: 0 }, wheel: 0, boost: false, slow: false, pad: false, key: () => false, any: () => false };
    fol.enter({ p: new THREE.Vector3(), q: new THREE.Quaternion(), fov: 55 }, fake); const out = []; let worst = null, worstPull = null; const prev = new THREE.Vector3().copy(fol.pose.p);
    for (let t = 0; t <= 16; t += dt) { fake.p[0] = ax + ux * 1.35 * t; fake.p[2] = az + uz * 1.35 * t; fol.update(dt, I); const d = fol.dbg, cp = fol.pose.p;
      const v = visibility(cp, fake), sp = cp.distanceTo(prev) / dt; prev.copy(cp); const camLamp = Math.hypot(cp.x - lamp.x, cp.z - lamp.z), subjCam = Math.hypot(cp.x - fake.p[0], cp.z - fake.p[2]);
      const row = { t: +t.toFixed(3), vis: v.vis, thin: v.thin, allowed: +d.allowed.toFixed(2), clear: +d.clear.toFixed(2), camSpeed: +sp.toFixed(2), camLamp: +camLamp.toFixed(2), subjCam: +subjCam.toFixed(2), nc: +minDist(cp.x, cp.y, cp.z, .8).toFixed(2), c: cp.toArray().map(x => +x.toFixed(2)) };
      out.push(row); if (!worst || v.vis < worst.vis) worst = { ...row, q: fol.pose.q.toArray(), s: fake.p.slice() }; if (!worstPull || d.allowed < worstPull.allowed) worstPull = { ...row, q: fol.pose.q.toArray(), s: fake.p.slice() }; }
    if (shoot) for (const [k, w] of [['occl', worst], ['pull', worstPull]]) { if (!w || (k === 'occl' && w.vis > .9) || (k === 'pull' && w.allowed > 4.6)) continue;
      C.camera.position.set(...w.c); C.camera.quaternion.fromArray(w.q); C.camera.fov = 55; C.camera.updateProjectionMatrix(); C.controls.target.set(w.s[0], 0, w.s[2]); mark(w.s); C.tick(1 / 60, 1);
      capture(`${label}-lamp-lat${lat}-${k}`, [`FOLLOW past a corner lamp (walker ${lat} m beside the lamp line) t=${w.t.toFixed(2)}s  [${k === 'occl' ? 'least visible frame' : 'most pulled-in frame'}]`, `subject visible ${Math.round(w.vis * 100)}% (thin-prop rays ${w.thin}) · arm allowed ${w.allowed} m of 5.2 · camera ${w.camLamp} m from the lamp, ${w.subjCam} m from the walker`, `camera speed ${w.camSpeed} m/s (walker 1.35 m/s) · magenta capsule = the followed walker`], null); mark(null); }
    return { lamp: { x: lamp.x, z: lamp.z, rot: lamp.rot, cells: lamp.cells }, lat, out };
  }
  window.__cp = { lampsNear, lampPass, followReal, followFixed, flyFixed, flyReal, busyRun, busyRoad, minDist, segHit, visibility, shots, capture, CAM, stats: () => R.stats(), shotCount: () => shots.length, shot: k => shots[k], clearShots: () => { shots.length = 0; },
    stopLoop() { C.renderer.setAnimationLoop(null); }, slabAt: (x, z) => { const s = S.slab(x, z); return s ? { ...s } : null; } };
  return true;
}
```
