# The game-port clips (group `game-port`; 2026-10-27)

slime, 10-27: "b) Port the few that fit the sim's staging". The paused craft game (`ai-city/game`) made 69 clips of its own
(`src/anim/clips-game.js`). Twelve of them are ported here, the bare-handed ones that GAME.md §20 has a use for and that none of the
104 covers: the fight's punches and staggers, catching the breath after a chase, a drink and a smoke in the day, three more steps at
the Gunrunner's bench, and a pick-up off the ground for the hustles.

- **Files:** `game-port.js` (the clips), `game-port-props.js` (the lab's stand-in bench with a vise), `../game-port-shots.mjs` (the
  pictures). The registry gained one import and one `GROUPS` / `FAMILY` entry; the 104 older clips keep their ids 0–103, entries and
  generated functions (checked below). The new clips are ids 104–115, in this order.
- **Nothing comes from the game at run time.** The durations and phase times are a copy of the game's `logic/timeline.js` entries
  (`ACT` in `game-port.js`). The tracks are built by the game's own generator, copied into the file.
- **The game's poses, with the sim's fixes.** `drink` and `smoke` generate GLSL identical to the game's own clips, character for
  character (comments and whitespace aside), with one substitution: the game's aim pitch `cAim` is the constant 0. The bench loops
  differ only by their lift (§ The bench). The other seven needed small fixes to pass the sim's hand gate, which the game never ran
  (§ The sim's fixes); each is a named constant in `game-port.js` marked SIM FIX.

## The clips

All are standing (`moving: false`, no root motion, no `shift`) except `winded_walk`. None has a prop. The game's working hand is the
−x arm (its tracks are mirrored: the anatomical right), so the punch, the haymaker, the drink, the smoke and the bench's working hand
are the −x arm. The sim's own clips use the +x arm.

| clip | game clip | length | kind | §20 use | partner / chain | beats (clip clock, s) |
|---|---|---|---|---|---|---|
| `punch` | `g_punch` | 0.58 s | one-shot | Hit ("a jump in the street"), the muggings outside the clubs, the Grab's scramble | lead of `stagger` (1.15 m, facing, 0.2 s after) | `hit` 0.22 |
| `haymaker_wind` | `g_haymaker_wind` | 2.6 s | one-shot | the same, the big telegraphed blow | `next: haymaker`; lead of `stagger` (1.15 m, 2.65 s after: the lab) | the coil ends at 0.48 |
| `haymaker` | `g_haymaker` | 0.8 s | one-shot | the same | lead of `stagger` (1.15 m, 0.05 s after) | `hit` 0.08 |
| `stagger` | `g_stagger_none` | 0.9 s | one-shot | the one hit: rocked back in place, a wobble, back | the partner of all three | none |
| `winded_rest` | `g_winded_rest` | 0.75 s | loop | after a chase (Hit's scooter chase, `run_getaway`, `flee_run`): stopped, hands above the knees, heaving | none | none |
| `winded_walk` | `g_winded_walk` | 0.75 s | loop, MOVING overlay (speed 0, stride 1) | walking on after a chase, hunched, the arms slack | none | none |
| `drink` | `g_drink` | 1.7 s | one-shot | the day's idle routine on a corner; the drunks outside the clubs (the hustle's marks) | none | `swallow` 1.1 |
| `smoke` | `g_smoke` | 2.4 s | one-shot | the day's idle routine; the lookout's break | none | `drag` 1.05, `exhale` 1.62 (the puff) |
| `bench_clamp` | `g_bench_clamp` | 1.1 s | loop | Build ("sparks at the Gunrunner's bench"): a blank clamped in the vise | none | none |
| `bench_file` | `g_bench_file` | 0.85 s | loop | Build: filing the part in the vise | none | none |
| `bench_fit` | `g_bench_fit` | 1.6 s | loop | Build: a part from the mat, fitted to the work in the vise | none | none |
| `pick_up` | `g_pick_up_none` | 0.52 s | one-shot | the hustles: stripping scrap, shoplifting, stealing off the boats; the loot dropped in a robbery | none | `grab` 0.27 |

Each entry's `note` is its timeline in words, `game` names its source, and the beats are fields on the entry (`CLIP.punch.hit`).

## What the city stages

- **The fight.** `punch` on the attacker, `stagger` on the victim placed as the robbery's victim is: 1.15 m in front, facing, started
  0.2 s after the punch (0.05 s after `haymaker`, 2.65 s after `haymaker_wind`). Both start from the stand.
  - The fist stops about 0.45 m short of the victim's body (at the hit it is 0.40–0.51 m ahead of the puncher, at belly height). The
    big heads set the gap, as for `rob_lunge_grab` (CLIPS.md § Where an elbow would help): below about 1 m they meet. The stagger
    sells the blow.
  - `punch` starts and ends on one pose (the empty fist at the hip, out at the side, the chest turned 0.1 rad), and `haymaker` ends on it: a punch
    after a punch or after a haymaker is exact if `playClip` starts it on the frame the last one reaches its end, before the blend-out
    begins. Each blends out to the stand over 0.2 s.
  - `haymaker_wind` chains into `haymaker` by itself after its 2.1 s trembling hold. The chain steps the chest's yaw by 0.03 rad (the
    fist ~1.6 cm) and the tremble by ≤ 9 mrad. For a quicker blow, `playClip(g, 'haymaker')` on the frame the wind's clock crosses
    0.48 s (the coil): that seam is exact.
  - `stagger` blends in in 0.03 s (the blow) and ends in the bare stand with the arms a little out (roll 0.06–0.12); it blends out.
- **After a chase.** `winded_rest` when the runner stops (blends in over 0.25 s from the stand; fine from any frame). `winded_walk`
  while it walks on: the walker's own route moves it, as for the mood walks; the legs are the walk's bit for bit (no leg channel). The
  overlay's arms hang still: hide a held thing, as for the other overlays.
- **The drink and the smoke.** One-shots from the stand, the −x hand. No prop: the city may draw a can or a flask, or a cigarette, in
  the −x fist while the clip's weight is ≥ 0.6 (the props' rule), and the smoke's puff at `exhale`. The hand comes up under the
  chin: the toon arm's reach ends there, and its top grazes the head's bottom-front edge, as in the game (below).
- **The bench loops** (§ The bench): at the Gunrunner's bench, on the walker's spot the `bench.js` clips use, with a vise on the
  bench. Each loop is seamless and fine from any frame; switching between them (or to `bench_hammer` and the rest) goes through
  `stopClip` and a fresh start, as the slot holds one clip.
- **`pick_up`.** From the stand, the +x hand to the ground in front of the feet (the knees and the waist bend, the pelvis drops
  0.2 m). Hide the thing on the ground at `grab` (0.27 s); the hand comes back up empty-looking (no prop), so show it in the fist
  from `grab` if the city has one.

## The bench

The game's bench loops work at the game's own bench. On the sim's bench (`bench-props.js` BENCH: the top at y 0.435, its front edge
0.30 m ahead) their hands would work at body y ≈ 0.29, 15 cm inside the top. So the hand targets are lifted 0.25 m in the chest's rest
frame (`BENCH_LIFT`), which puts them at y 0.45–0.62, z 0.34–0.60: at the jaws of a bench vise on the front half of the bench, in
front of the −x shoulder. Everything else (the bend, the head, the timing, the elbow poles) is the game's.

- **The vise the city needs** (`game-port-props.js` `VISE` and the stand-in boxes, body frame): its body on the bench top at x −0.20…0.06,
  z 0.50–0.64; the jaws to y 0.58 centred on (−0.07, 0.55); the work standing in the jaws to y 0.64; the screw toward the walker with
  its T-bar turning about (−0.16, 0.53, 0.44) (`bench_clamp`'s −x hand circles it, radius 0.09). The parts mat on the bench to −x of the
  vise (x −0.38…−0.22, z 0.51–0.65): `bench_fit`'s −x hand reaches out to it.
- `bench_hammer`'s anvil (x 0.2) and the paper (x 0.04, z 0.45) share that part of the bench: the vise sits where the paper is.
  The city can put the vise on the bench only while these loops play, or move the paper; that is the bench owner's call.
- In the lab the three loops carry `set`: the city's bench with this vise (lab only; never under `&dbg=back`; `&set=0` hides it).
- The big head hangs over the work (the game's head pitch, 0.45–0.5): from the street camera the hands show under it from the
  side and the front quarter, not from above.

## Not ported, and why

- **`g_bandage_none`** (2.2 s: the hands wrap a forearm): ported, looked at, dropped. Both forearms come up under the head (pitched
  0.45 down) and pass into its underside through the whole wrap (0.3–1.9 s): from the front the wrapping hand shows through the chin.
  The game has the same. Its §20 use was the weakest (a hit's aftermath; `walk_hurt` and `get_up` already cover being hurt). A fix
  would be authoring, not a port: the head up to ~0.2 and the forearms lower, in front of the belly (about 30 min with the gates).
- **Out of scope** (the brief): the guns, their reloads and aims (`g_aim_*`, `g_fire_*`, `g_reload_*`, the pump and long-gun loads),
  the melee weapons (`g_swing*`, `g_homerun*`, `g_sledge_swing`, `g_machete_swing`, `g_cut`, `g_throw`, `g_hold_melee`), mining
  (`g_mine`, `g_pick_mine`), `g_rig_set`, the stash reach and the other hold classes' variants.
- **No runtime change was needed.** The game's only runtime change its clips read is the aim pitch (`cAim`, walk2.js's look slot, and
  the `cLow` uniform for the gun carries); every clip here uses the aim at 0, and none of the bare-handed ones reads `cLow`.

## The sim's fixes (the hand gate)

The game never ran the sim's hand gate (`lower-motion-check --clips`: any hand or arm crossing a leg, on every bottom). As ported
first, seven of the clips failed it on every bottom (counts on one shard of six bottoms; the gate wants 0): `winded_rest` 15,821 leg/hand
crossings and 18,766 hand penetrations (the palms braced ON the knees: CLIPS.md § What the arm can't do), `pick_up` 253, `stagger`
224, `haymaker` 214, `punch` 106, `winded_walk` 101, `haymaker_wind` 62. The fixes, each the smallest that clears the gate:

| clip | what crossed | the fix (`game-port.js`) |
|---|---|---|
| `punch`, `haymaker`, `haymaker_wind` | the fist, coming back from the blow, through the front of the thigh | `FIST_LIFT` 0.15: the empty fist rests at the hip, out at the side (the game's rest was the handle's place, at mid-thigh) |
| `punch` | the same, at 0.4 s | `STRIKE_LIFT` 0.07: the blow ends at the belly, not the belt |
| `haymaker` | the fist sweeping back across the hips at 0.65 s | its height held up (0.8) until it is back at the side |
| `haymaker_wind`, `haymaker` | the hanging free hand, swung into the thigh by the coil's chest turn | `FLARE` 0.25: that arm rolls out over the coil, eased back by the release's end (the chain stays exact) |
| `stagger` | the hanging hands, met by the knees as the drop bends them | the arms fling out for balance (roll + 0.35) through the rock and the wobble |
| `winded_rest` | the palms on the knees | `WIND_AT`: the hands hang just clear in front of the knees (as `sit_stoop`'s) |
| `winded_walk` | the swinging thighs into the still, slack hands | `WALK_ROLL` 0.22: the slack arms hang a little further out (roll 0.1 → 0.22) |
| `pick_up` | the reach coming down in front of the knee, onto the toes | the reach goes down outside the +x foot (roll + 0.25, no yaw in); the other arm hangs out of the bent thigh |

## What differs from the game

- The aim pitch is level (`aim` = 0): the game's punch and haymaker tip the head with the player's look; here the head stays as at a
  level look.
- `winded_walk` writes no `P.drop`, `P.pRoll`, `P.bodyX` (CLIPS.md § Moods and reactions: the overlay convention). The game's version
  lowered the pelvis 2.5 cm and zeroed the walk's hip sway and pelvis roll.
- The fight, the drink and the smoke are standing clips here; the game played them as overlays (the player walks while punching).
  Their GLSL is the same either way.
- `haymaker_wind` chains into `haymaker`: in the game the player's release switched it.
- The bench loops' lift (§ The bench), and the hand-gate fixes (above).

## Checks

(this branch on ai-city-fresh main 1417f67, my server on port 5930)

- **The four clip gates** (`FRESH_URL=http://127.0.0.1:5930 node style/check.mjs clips --quick --jobs 4`, 9 min 31 s wall): PASS, exit 0,
  on every clip, the 12 new and the 104 unchanged.
  - End frames (`clips/end-check.mjs`): PASS. 232 plays and 12,840 frames at 60 fps, 6,396 at 30 fps, 255,881 jittered, 70,906 at the
    float32 edge, all agree.
  - Elbow identity: PASS within 1e-6 m (max 1.19e-7) over 11,368 look-states (7,973 shader states × 7 looks). The 12 new clips are
    listed as bending by design, every state of each: `punch` 12/12, `haymaker_wind` 53/53, `haymaker` 17/17, `smoke` 49/49, `drink`
    35/35, `bench_file` 18/18 and `bench_fit` 33/33 to ≤ 1.45 rad; `bench_clamp` ≤ 1.16, `winded_rest` ≤ 1.17, `stagger` and `pick_up`
    ≤ 0.25, `winded_walk` ≤ 0.15.
  - Hands (`lower-motion-check --quick --clips`, every fresh bottom on the plain shoe): 116 clips, 7,397 states, 68 fixtures (22
    geometries), 13/13 shards; every count 0 (crossings, coplanar, opposite-leg, penetrations, leg/hand, hand penetrations,
    foot/hand). PASS. (Before the fixes, § The sim's fixes: 7 of the 12 failed.)
  - See-through (`overlap-check --gate '&dbg=back' --clips --quick`, the mannequin): 0 of 20,976 frames show inside faces. The new
    clips: `punch` 32, `stagger` 56 and as the partner 208, `haymaker_wind` 148, `haymaker` 44, `winded_rest` 56, `winded_walk` 56,
    `drink` 84, `smoke` 112, `bench_clamp` 68, `bench_file` 60, `bench_fit` 88, `pick_up` 32 frames, all 0.
  - Not run: the full set (`node style/check.mjs clips` without `--quick`: every bottom × every shoe, every look), many job-hours.
- **The registry:** 116 clips (104 + 12). Against main, the 104 older clips have the same ids (0–103), the same entries and the same
  generated GLSL functions, and the helpers are the same (a script imports both registries and compares them).
- **The port against the game:** before the hand-gate fixes, every clip's generated GLSL equalled the game's (`clips-game.js` at
  94d1abf) with `cAim` → 0, whitespace and comments aside (the bench loops once their `+ 0.2500` lift is taken out, `winded_walk` once
  the game's `P.drop` / `P.pRoll` / `P.bodyX` line is). After them, `drink`, `smoke` and the three bench loops still do; every `dur`
  and phase time is the game's.
- **The haymaker's seams** (the game's CPU track, the same expressions): the wind at 0.48 s against `haymaker` at 0: every channel
  identical (measured on the game's tracks; the fixes keep both ends equal: the fist's lift and the free arm's flare are the same
  expression at the seam). The wind at 2.6 s: the chest yaw 0.03 rad, the drop 2.4 mm, the fist's place 3.5 mm and its turn 9 mrad.

## Pixels (`shots/game-port/`)

`node style/city/anim/game-port-shots.mjs` (with `FRESH_URL`) takes them all in one run (about a minute): for each clip a 2×2
sheet of its key moments (`<clip>.jpg`; each tile names the clip, the moment, the clip clock and the camera) and a webm of one play in
the lab's clip scene (`<clip>.webm`, 30 fps, the partner beside the fight clips, the bench clips at the stand-in bench).

The lab, one clip with its partner: `/style/city/anim/index.html?scene=clip&clip=<name>` on any server of this tree
(`node style/serve.mjs <port>`); `&once=1` plays it once, `&cam=side|tq|front|close` picks the camera.
