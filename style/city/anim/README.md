# Animation lab

**Open:** http://127.0.0.1:5320/style/city/anim/

The city's own characters, bake and walker material; not in the city yet. Board: `style/city/board-walk.jpg`. GIFs: `style/city/shots/anim-walk/`.

**Scenes**
- **treadmill:** a side view. The slabs move under the walker, so a sliding foot shows against the joints.
- **feet:** the treadmill, close on the feet.
- **corners:** a loop round a square.
- **stop-start:** a kerb queue crosses on the signal, idles, turns round, comes back.
- **crowd:** 20, 200 or 2,000 walkers wandering and idling.
- **idle line-up:** all nine idles, labelled.

**Walk:** old, v1, v2, old | v1, or v1 | v2 (the default: both side by side).

**Time:** pause (space), step (.), 0.25×, restart, walking speed.

**Camera:** per-scene presets; free orbits. The treadmill adds close-ups: knee, legs, feet 3/4, feet back, knee 3/4, knee back.

**Tune the walk:** the panel tunes whichever walk is on screen.
- v1: stride, bob, arm swing, lean, turn rate, head lag, turn lean, foot lift, stance.
- v2: stride, bob (dip at down, rise at up), swing lift, heel strike, toe-off, arm swing, elbow, overlap, head spring, counter-rotation, pelvis roll, sway, lean, reach, turn rate, turn lean.

**Copy url** keeps your settings. **Bench** times 20, 200 and 2,000 walkers with the old walk, v1 and v2.

## Walk v2 (2026-09-29)

**Why v1 looked janky**
- *See-through:* confirmed. chars.js meshes each rig group (a whole leg, a whole arm) as one piece and culls the faces between its voxels. v1 then cut the leg into thigh, shin and foot along those culled faces. When a joint turned, the cut opened and you saw inside, "the material under the shoe". (The body isn't greedy-meshed, and v1 turns rigid parts, not vertices, but the cause is the same.) With inside faces drawn magenta, all 720 test frames show it. The elbow shows it even standing.
- *Robotic* (from reading the code): the pelvis height is the lower of the two legs' reaches, recomputed every frame, so it kinks twice a step. The legs are solved by IK each frame. The shoulders turned against the arm swing: v1's torso yaw has the wrong sign.

**v2**
1. **Rigid closed segments** (`bake.js` `bakeSegLooks`): pelvis, chest, head, and thigh, shin, foot, upper arm and forearm (with the hand) on each side.
   - Each part is meshed closed.
   - Each child carries a **joint slab**: the parent's voxels next to it, two deep along the bone. At rest the slab hides exactly inside the parent (same colour, same shading). In a bend it fills the wedge.
   - The pelvis is the pants' seat and waistband. Tops and accessories ride the chest, so nothing is cut across the waist.
2. **A keyed cycle** (`gait2.js`, `walk2.js`): the eight classic poses (contact, down, passing, up, and the mirror).
   - The animator's keys: foot pitch, pelvis bob and swing lift.
   - The hips and knees on 16 keys a cycle are solved once, when the keys are built. The planted heel, then the toe, stays on its spot; the swing leaves and lands at ground speed.
   - At run time the joints follow Catmull-Rom curves; the foot pitch is monotone, so the flat foot stays flat. There's no IK, so nothing snaps.
   - Five step sizes (40 % to 100 % of the stride) are blended by speed. The cycle is driven by distance.
   - Planted slide: heel 1–4 mm, toe 1–2 mm a step.
3. **Motion:**
   - The pelvis dips at down and rises at up.
   - The hips turn with the forward leg; the chest counter-turns with the arms.
   - The pelvis sways and rolls over the stance foot.
   - The arms trail the legs by `overlap`; the forearms trail by half as much again.
   - The big head is a damped spring (about 3.5 Hz): it nods a beat after each dip and settles after a stop.
   - The start and stop eases and the turning (turn.js) are v1's.
4. **Frame rate:** the gait is sub-stepped at 1/120 s, so the same distance gives the same pose at 25, 60 or 120 fps.
5. **Idles:** unchanged (idle.js). A standing leg is still solved from the idle's ankles, exactly as in v1, and the walk weight blends the two sets of joint angles. All nine play on the new body: 0.3 % of pixels differ from v1 (the new joint faces), and 0 of 60 frames show inside faces.
   - What doesn't map: nothing breaks. The idles never pose the new pelvis, so it follows the chest as the torso did in v1.

**Gates** (lab, headless Chrome, `&dbg=back`, magenta pixels counted)
- v2: 0 of 1,680 frames. That covers feet and knees from the side, 3/4 front and back, × 5 looks × 0.6, 1.2 and 1.8 m/s.
- v1: 720 of 720 frames.

**Cost** (crowd scene, 1600×1000, shadow pass included; frame time, p50)

| Walkers | old | v1 | v2 |
|---|---|---|---|
| 20 | 1.8 ms | 1.8 ms | 2.0 ms |
| 200 | 3.0 ms | 3.0 ms | 3.7 ms |
| 2,000 | 10.4 ms | 12.2 ms | 13.9 ms |

- CPU at 2,000 walkers: v1 0.5 ms, v2 0.9 ms.
- A body is about 9,850 triangles, against v1's 8,600 (+14.5 %).
- Only leg vertices evaluate curves. The pelvis height is one float per walker, read off a table.

**Walk polish (2026-09-29): the overlap glitches**
- *What flickered:* z-fighting. A pitch hinge keeps a child's side faces, and its slab's, in the plane of its parent's, so the slab's turned copy of the parent's colours fought the parent frame to frame. The worst spots were a striped sleeve at the elbow and the knee and ankle.
- *Fix:*
  - `bake.js` grows each part off its bone axis by 0.5 mm per link above the chain's end (pelvis 3, thigh 2, shin and upper arm 1). The parent always wins, and no gap opens where parts touch.
  - The arms tilt out 0.03 rad more while walking (`armOut`), so the hands clear the hips.
- *Measured* by `overlap-check.mjs`: 25,380 frames at 1/120 s (5 looks × 3 speeds × 10 cameras, plus the corner loop, the kerb and the idles).
  - z-fight: 52.5 M → 1.6 M px (15.3 → 0.47 per 1,000 body px).
  - Hand through hip: −31 %.
  - Legs crossing: −86 %.
  - See-through gate: 0 of 12,690 frames. The gait keys and feet are untouched.
- *Left alone:*
  - Overlaps that belong to the looks: big hair over the shoulders, thighs through long tops.
  - Slabs swinging out of their parent in deep bends (elbow, ankle, knee).
  - The collar.
- GIFs: `walk-*-v2-fixed.gif`, `walk-zfight-closeup-before-after.gif`. For the old walk, use `noinset&v2.armOut=.05`.

## URL parameters (for shots)
- `scene`, `ab` (`old`, `new` = v1, `v2`, `ab`, `v12`), `cam`, `n`, `v`, `t` (deterministic time)
- `look=<i>`: the treadmill's character
- `shot=1` hides the UI
- `strip=8&sdt=…&cols=4` renders a contact sheet
- `cx=`/`zoom=` frame close-ups
- any v1 slider by name, e.g. `stride=.45`
- any v2 slider as `v2.<name>`, e.g. `v2.stride=.44`
- `dbg=back`: draws the inside of every mesh magenta (the see-through gate)
- `noslab`: v2 without joint slabs · `noinset`: v2 without the walk polish's de-coplanar growth

**Files:**
- v2: `gait2.js` (keys, solve, per-walker step; plain JS, node can test it), `walk2.js` (the shader), `bake.js` `bakeSegLooks`
- checks: `overlap-check.mjs` (glitch pixels per frame: z-fight, poke-through, slab show; `--gate '&dbg=back'` for the see-through gate)
- v1: `walk.js`, `bake.js` `bakeAnimLooks`
- shared: `idle.js`, `turn.js`, `lab.js`

Merge plan: MERGE.md.
