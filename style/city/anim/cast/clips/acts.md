# The day's acts (group `acts`, family activities)

The record viewer draws every agent's day (GAME.md §41, slime 10-30: "every action the agent preforms ... needs to be watchable"), and
several errand acts played a stand-in clip because the right one didn't exist. The city's `style/city/stage/acts-clips.md` is the spec.
This is a FIRST PASS for slime to art-direct (10-31: "Make a first pass"; "if anything is related to art, I make the decision").

Thirteen clips in `acts.js`, one prop file of my own, `acts-props.js` (the garment, the duvet, the floorboard patch and its loose board,
the haggle counter). The phone is `phone-prop.js`'s and the plain parcel `errands-props.js`'s envelope in kraft paper (the city's
hand-over parcel), both reused. Every older clip keeps its id and its GLSL: the group is the last in `index.js` (ids 116–128).

**Neutral by §19.** No label, number or drug colour on any prop: the garment is plain grey, the parcel kraft paper, the duvet cream,
the floorboard and the counter wood. `count_cash` is not built: it shows "cash" and "how much" live.

## The clips

| clip | length | kind | prop | the beat | replaces (stage/acts.js) |
|---|---|---|---|---|---|
| `phone_up` | 1.05 s | one-shot → `phone_call` | phone (+x) | both hands in the hoodie pocket; the phone out (0.45) and up to the ear round the shoulder (0.55–1.05), the head tilted to it. phone_tip's first second without its breath, so it ends EXACTLY on the call's pose | `call`: phone_tip again and again |
| `phone_call` | 4.8 s | loop | phone at the ear | two breaths, the weight over and back; two nods (0.55–1.2); the free hand out of the pocket and turned out once, the eyes on it (2.0–3.25); a glance round, the chest turning away from the phone (3.45–4.55). No lip sync | |
| `phone_down` | 1.2 s | one-shot | phone | from the call's pose: the phone down into the pocket (gone at 0.6), a look back over the −x shoulder; ends with the hands in the pocket | |
| `phone_type` | 4 s | loop | phone, both hands | landscape at chest height, its screen tipped up to the eyes (plain: never readable); thumbing (the fists tap 7 a second, out of step) 0–1.6 · reading 1.6–2.4 · the head up and round 2.4–3.2 · thumbing 3.2–4 | `message`, `order`: film_phone |
| `earpiece_listen` | 5 s | loop | none | the +x fist up beside the head's lower side (the mitten has no fingers: "two fingers" is the fist pressed in, 0.05–0.5); the head down and still; a glance round 4.0–4.7; the hand stays up | `listen` (now its own set): phone_tip |
| `parcel_tuck` | 2.4 s | one-shot | parcel (−x) | after `act_take` (bribe_take's last pose): out of the pocket and weighed (0–0.6, two bounces) · turned over (0.6–1.2) · a glance round · tucked into the hoodie's front (1.2–2.0, gone at 1.85) · patted flat (2.0–2.4) | `handover` partner: act_take then listen_nod |
| `haggle_counter` | 4.4 s | loop | none (a counter: lab set) | forearms on the counter, leaning, the elbows out (0–0.8) · a point, the chest leaning in (0.8–1.6) · a shrug, the hands up and open (1.6–2.4) · a head shake and a lean back, the hands on the edge (2.4–3.4) · back on the counter | `fence`: listen_nod |
| `change_clothes` | 6 s | one-shot, then the stand | garment (both) | the hands at the hem · the old top pulled up to the chin, the head ducked (0.75–1.25), up and out at the head's sides (1.25–1.85), tossed (1.9–2.4) · the new one (from beside the hip at 2.5) shaken open (2.75–3.35), pulled on over the head (3.4–4.0, gone) · drawn down to the hem (4.0–4.8) · the hem tugged twice, a look down (5.0–5.9) | `dress`: pat_pockets, deal_lookout |
| `floorboard_lift` | 2.0 s | one-shot → `floorboard_rummage` | parcel in the gap; the board | a deep crouch leaning over to the +x side (0–0.8) · the +x hand under the loose board's inner edge, prised up (open at 1.4) and flipped onto its outer edge (to 1.6) · the hand to the gap | `stash`: rummage beside a parcel |
| `floorboard_rummage` | 1.6 s | loop | parcel | the hand in at the parcel (0.3–0.55), lifts it, turns it over and sets it back (0.6–1.3), back (1.35–1.55). In or out is the record's, a day late | |
| `floorboard_close` | 1.9 s | one-shot | parcel (gone at 0.6) | the board pushed back down from its top edge (0.15–0.6: closed), pressed flat · up out of the crouch (0.9–1.9), a look round | |
| `sleep` | 4 s | loop | duvet | on the back under a duvet to the chin, one slow breath a loop (the chest and the duvet rise), the chin tucked on the pillow, the arms down the sides | interiors/city/plan.js: lie_still, fitted by eye |
| `shove_walk` | 0.45 s | one-shot WALKING OVERLAY | none | both arms thrust out to cLook's side (+x when cLook ≥ 0) at chest height (0.04–0.13, held to 0.24), the lead arm straight out, the other across the chest, the torso twisting into it; back into the walk's swing by 0.43. The legs are the walk's | lane C2-gore's agent shove |

The spec's `floorboard_lift` (one 5.5 s one-shot with its middle looped) is three clips here, aim_draw → aim_hold → aim_lower's way:
the registry loops a whole clip, so the middle is its own loop. lift's last pose = rummage's first = rummage's last = close's first.

## What the city must stage

All spots are in the walker's body frame: +z ahead, +x the walker's left.

### The call (`phone_up` → `phone_call` → `phone_down`)
- `phone_up` once, `phone_call` loops, `phone_down` once at the end, starting on a wrap of `phone_call` (its pose at 0 and 4.8 is the
  call's pose, phone_up's last and phone_down's first). `phone_up` has `next: 'phone_call'`.
- The phone at the ear reads from the front and its +x side only (errands.md: the big head hides the fist from −x and behind).

### `phone_type`, `earpiece_listen`
- Loops, fine from any frame; they blend in from the stand.

### The hand-over's taker (`parcel_tuck`)
- Play it right after `act_take` (bribe_take's track) ends: it starts on bribe_take's last pose (the −x hand at its pocket, the +x
  thumb in the belt, the chin up), the parcel back in the −x hand. Then `listen_nod` (a pop: listen_nod's pocket is its own angles).
- Its prop is the plain parcel: the kraft envelope (`errands-props.js` envelope with `KRAFT`); the city gives it its neutral id.

### The fence (`haggle_counter`)
- THE COUNTER IS THE TOON'S: its top 0.74 m, its near edge 0.26 m ahead (`ACTS.counter`; the entry's `counter`). The cast's shoulders
  are at 0.825 m, so the Heap's booth shelf (~1.2 m up, measured on the booth's voxel code) is above them: no forearm can rest there.
  The lab draws `acts-props.js`'s counter as the set; the city needs a counter at that height where the act stands (an art call).
- The hands are planted on the counter in the body frame: keep the walker still while it plays.

### Dressing (`change_clothes`)
- A one-shot that ends with the hands at the hem; it blends out to the stand. The walker's look does not change (a hoodie conceals
  the fit: the board's business). The garment shows 2.5–4.0 only.

### The stash (`floorboard_lift` → `floorboard_rummage` → `floorboard_close`)
- **The floorboard is beside the walker**, at its +x side: the patch's centre at body (0.6, 0, 0.2) (`board.at`), three planks along
  z, the middle one loose. The rig can't kneel and can't reach the floor in front of it (bent over that far, the big head comes down
  onto the work; a hand between the knees goes through them: the hand gate caught every frame of a first version in front).
- Draw the patch (`board.floor(THREE)` × `board.floorMatrix(THREE)`) and the loose board (`board.geometry(THREE)` × `board.matrix(THREE,
  state.t)`) in the walker's frame, by the PLAYING clip's `board` (each of the three has its own: lifting, standing, closing).
- Its open state is neutral: the dark gap and the plain parcel (the clip's prop) in it. Nothing else (no cash, no gold, no product).
  interiors/home/security.js's stash-floorboard `open` state (cash, gold) is not used here.
- Play `floorboard_close` on a wrap of `floorboard_rummage`. It ends in the stand with the +x arm out at the side (it blends out).

### Sleep (`sleep`)
- The walker's ground point on the mattress top at the sleeper's FEET, facing the bed's foot: the body lies back along −z from there,
  the head 1.7 m behind (on the pillow end). The root turns the whole body back a quarter turn about the pelvis (`SL` in acts.js).
- The duvet (`prop.id` 'duvet', body frame) covers 1.1 × 1.15 m from under the chin to past the feet, its top 0.42 m up: it is drawn
  over the bed's own duvet. Its colour is one neutral (`acts-props.js` SCHEMES.duvet); the beds' own covers vary.
- Near tier only, as every clip: the mid and far tiers have no clips.

### The shove (`shove_walk`, for lane C2-gore's traffic/accident.js)
- A walking overlay (moving, speed 0, stride 1: CLIPS.md § Moods and reactions): it writes only the chest, the head and the arms.
- **The side is cLook's sign.** Set the shover's `g.look` to the shoved walker's bearing in the shover's body frame (+ toward +x),
  then `playClip(a.g, 'shove_walk')`; step it with `stepClip(a.g, dt)` every frame from the hook that owns the shover (movement.js
  steps only its own `mvClip` clips). It ends by itself (0.45 s) and blends out over 0.15 s. Don't drive the walker: its own route does.
- In accident.js's `start(w, pl, a)` (the shove's start, where `S.shoves++`): the shover is `a`; the bearing is
  `atan2(dx, dz)` of the victim in the shover's frame (dx, dz the world offset turned by −yaw).

## The API (entry fields beyond CLIPS.md's)
- `prop` (the phone clips, parcel_tuck, the floorboard clips, change_clothes, sleep): errands.js's contract — `{ id, model, frame:
  'body', geometry(THREE, scheme?), pose(t, g?) → { p, R, show }, matrix(THREE, t, out?, g?), point(t, q), track }`. Pass the gait
  state and the prop hides below a weight of 0.6 (`SHOW_W`).
- `board` (the floorboard clips): `{ at, geometry, floor, angle(t), pose(t), matrix(THREE, t, out), floorMatrix(THREE, out) }`.
- `counter` (haggle_counter): `{ top, near, far, w }` (m); `set` (haggle_counter, the floorboard clips: lab only).
- `acts-props.js`: `ACTS`, `SCHEMES`, `actsCells(id)`, `actsGeometry(THREE, id, scheme?)`, `actsMatrix(THREE, pose, out)`, `actsPoint`,
  `actsDir`, `grainOf(id)`; models `garment`, `duvet`, `floor`, `board`, `counter`.

## Checks
See the commit message and the hand-back for the numbers of this pass (port 5962, branch `c2-clips` on ai-city-fresh main 6d68cec).

## Open items (art: slime's)
- The floorboard is at the walker's side, not in front of it (the rig, above). The board stands on its edge while open.
- The haggle counter needs a counter at the toon's height at the booth; the booth's shelf is too high.
- The garment is one rigid open tee: the old top's removal is a mime (no prop), the new one appears in the hands at 2.5 beside the hip.
- The duvet is one colour over every bed; the toes make a bump near its foot.
- `earpiece_listen`'s "two fingers" are the mitten fist at the ear.
- `parcel_tuck` → `listen_nod` pops the arms (two different pocket poses).
