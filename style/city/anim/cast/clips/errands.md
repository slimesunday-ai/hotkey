# The small ones (group `errands`, family activities)

The everyday moments the show needs that no clip covered (GAME.md §10, §13, §15 and §20): phoning in a tip, handing a cop a bribe, a
Cop on guard at the Evidence Vault, walking up the ferry's gangway on the last night, and an evicted agent carrying everything it owns.
Six clips in `errands.js` (five moments, the bribe being a pair), one prop file of my own, `errands-props.js` (the envelope and the
bundle). The phone is `phone-prop.js`'s, reused. Nothing else changed: the 87 older clips keep their ids (0–86) and their GLSL, and
the errands clips are 87–92 in registry order (`phone_tip`, `bribe_pass`, `bribe_take`, `guard_post`, `gangway_up`, `evicted_carry`).

## The clips

| clip | length | kind | moves | partner | prop (hand) | the beat |
|---|---|---|---|---|---|---|
| `phone_tip` | 6 s | one-shot | no | none | phone (+x) | both hands in the hoodie pocket; the phone out (0.45 s) and up to the ear round the shoulder (0.55–1.05), the head tilted to it; a glance round while it rings (the chest turns, the head with it, 1.25–3.15); the call: hunched, turned a little away, three nods (3.0–4.5); the phone down into the pocket (gone at 5.12); a look back over the −x shoulder; ends with the hands in the pocket |
| `bribe_pass` | 1.8 s | one-shot | no | lead of `bribe_take` (gap 1.02 m, facing, the same start) | envelope (+x) | the chin up, the eyes over the cop's head throughout; the envelope out of the hoodie pocket and low out to its +x side (0.3–0.56), held out; the cop's fingers close on it (0.72), a press, let go (0.92); the hand back in the pocket, a nod, the chest turned a little away |
| `bribe_take` | 2 s | one-shot | no | partner of `bribe_pass` | envelope (−x), from the handoff | the +x thumb in the belt, the chin up throughout ("I see nothing"); the −x hand out low (0.48–0.7), takes the envelope (0.92) and pockets it (gone at 1.3) |
| `guard_post` | 12 s | loop | no | none | none | feet planted, the chest and chin up, the thumbs in the belt at its front (the elbows out); a long look to −x (0.9–3.6 s) and to +x (3.9–6.6); up onto the toes twice (6.9–8.1); a belt hitch (8.35–8.9); a look at the watch (9.3–10.9); a settle of the shoulders |
| `gangway_up` | 0.85 s | loop | travels on its own legs: 0.75 m/s along, 0.18 m/s up (`ramp`) | none | none (the +x hand on the rail) | two steps up a 13.75° slope, each foot planted on it (the heel strikes toe-up, rolls flat along the slope, pushes off the toe); leaning into the climb, the eyes on the ramp ahead; the +x hand slides up the rail, the −x arm swings |
| `evicted_carry` | 4.4 s | loop | travels on its own legs: 0.62 m/s | none | bundle (both) | everything it owns in a bedsheet, hugged at the chest; short, flat, scuffing steps, the weight dropping onto each, a waddle, leaning back against the load, the head down and tilted; the bundle sinks a beat after each step and sways a beat behind the waddle (the hands go with it); a hitch (2.4–2.9); a weary roll of the head (3.4–4.2) |

Every number the city times on is on the entry (`dur`, `loop`, `pair`, `speed`, the blends, `ramp`). The timelines in words are the
entries' `note`s.

## How they're built

- **One track per clip** (heist.js's and work.js's method): every channel (the body, the feet, the eyes, each hand's target or free
  angles, each prop's pose) is one scalar expression valid in both GLSL and JS. The shader poses the body from it and puts each holding
  fist ON its prop with the two-bone IK on the elbow; the CPU evaluates the same strings for the prop. A prop's pose IS its fist's
  target, so the two cannot part: measured on the real shader within 0.06 mm (below).
- **The toon arm reaches only 0.403–0.453 m from the shoulder**, and the IK silently clamps a target outside that shell (the hand then
  leaves its prop). So every held target was checked against the shell over the whole clip:
  - the phone goes from the pocket to the ear ROUND the shoulder, on the shell (`onShell`: a great circle about the shoulder, the
    distance eased between the ends). A bezier between them dipped inside the shell and the hand landed 8.5 cm off the phone;
  - the bribe passes at the briber's +x side, 0.39 m ahead, at y 0.62, where both fists sit 0.41–0.42 m from their shoulders. The cop
    doesn't dip its knees for the take: the dip put its target inside the shell;
  - the bundle's grips stay 0.41–0.45 m from the shoulders through its bounce, sway and hitch.
- **The big head** (x ±0.4, the ears to ±0.5 at y 1.15–1.4, y 0.95–1.7, z −0.35…0.4) owns everything above the chin:
  - the phone's fist sits beside the head's lower side, where hail_taxi's does (the shell allows no higher), and the phone stands up from
    it along the side of the head to the ear, its loud back out and forward. On its way up and down its far end swings out to the side:
    turned up any sooner it clipped the chin's corner;
  - while the phone is at the ear the head turns only with the chest (turned toward the phone, its front corner meets the fist);
  - the pair's heads, and their caps, set the bribe's gap: both keep their chins up the whole time, the eyes over the other's head.
    That tips the heads' fronts back and lifts a cap's brim clear of the other's face (a fitted cap's brim reaches 0.78 m out from the
    neck: level, at this gap it would be 0.21 m inside the other's head). No glances while they stand face to face: a turned head swings
    its brim across;
  - the bundle's top stays under the chin (it tips forward a little, and the head tips back on the hitch).
- **Hands into a pocket.** A hand moving inside a clip from the hanging arm into the hoodie pocket swept through a baggy thigh (the hand
  gate caught it, on `ash_sweats`). So a pocketed hand is in the pocket from the clip's first frame to its last, and the clip's own blend
  in and out carry it there and back, as for every deal-hang pocket clip.
- **Walking on its own legs** (`gangway_up`, `evicted_carry`: walk_hurt's and the stairs' way). The feet are the clip's (`wFoot`): each
  foot's heel or toe is pinned to its spot on the ground (or the slope) and slides back at exactly the travel speed, so a planted foot
  stays put while the owner moves the walker. A foot strikes on its heel toe-up, rolls flat, pushes off about its toe (heel up), and
  swings to the next strike. On the slope every pivot sits on the slope's line.
  - The carry walks this way so its bundle's bounce and sway can be timed to its own steps from the clock alone: the CPU knows the
    pelvis exactly, and the bundle needs no gait state.
- **The bundle's secondary motion** (chest frame): it sinks 2.6 cm about 0.1 s after each step lands (the body's dip, a beat later) and
  comes back; it rolls 0.075 rad and slides 1.5 cm a beat behind the waddle; it yaws 0.03 rad with the chest's twist and its front sags
  a little on each step. The hands are IK'd onto its grip points, so they ride all of it.

## What the city must stage

All the spots below are in the walker's body frame at the clip's start: +z ahead, y up from its ground point, the sides by their sign
("+x" and "−x", as the clip files name them; facing +z, +x is the walker's left).

### The tip (`phone_tip`)

- Any agent, anywhere, standing: `playClip(w.g, 'phone_tip')` with the walker stopped (`g.w = 0`). It ends by itself (6 s) with the
  hands in the hoodie pocket and blends out (0.3 s) into whatever the walker does next.
- It's an errand of the day (GAME.md §10, §13: one tip a day), about 3 a season: a short, furtive call is what the street sees. The
  words (who and which night) are the board's business, not the clip's.

### The bribe (`bribe_pass` ⇄ `bribe_take`)

- **The cop.** Place the cop 1.02 m in front of the briber, facing it, and start both on the same frame: `playClip(briber,
  'bribe_pass')`, `playClip(cop, 'bribe_take')` (the entry's `pair: { with: 'bribe_take', gap: 1.02, delay: 0 }`). A Cop agent (GAME.md
  §13, the player cops) or a precinct NPC; in the sheets it wears `precinct_cap` and `precinct_blues`.
- **The gap is the heads' and the caps'.** At 1.02 m, with both chins up, the heads stay ≥ 14 cm apart (the widest hair included), and
  a brim clears the other: the precinct cap ≥ 40 cm from a bare head and ≥ 14 cm from a fitted cap's brim and head; two fitted caps ≥ 3 cm.
  The longest brims (`old_fitted`, 0.85 m out) on both still meet (6 cm into each other): give one of them a brimless hat, or stand them
  further apart and skip the hand-off. Don't stand them closer.
- **Start them as they meet, part them as it ends.** The chins come up in the blend in (0.1 s) and go down in the blend out (0.3 s).
  Level-headed at 1.02 m, a precinct brim is up to 8 cm into the other's head (its hair) and a fitted cap's 21 cm
  (`staged-bribe-caps.jpg`, the first frame), the same as at `brush_pass`'s gap. So don't stand the pair there idling before or after:
  walk them up and start both clips on arrival, and walk them apart, or turn them away, as the clips end.
- **The envelope** passes at the briber's +x side, which is the cop's −x side: from the briber's side of the street it shows best.
  Under the big heads' overhang it is a white-and-green fleck from above: a "$" pop or a glint at 0.92 s would sell it at 25 m.
- Both end by themselves (1.8 s and 2 s) with their hands where they are (the pocket, the belt) and blend out.

### The guard (`guard_post`)

- **The vault door** (Precinct 9, the Evidence Vault, GAME.md §13): the guard stands with the door BEHIND it, facing away from it (into
  the room the crew comes in by). Put the door's face ≥ 0.8 m behind the guard's ground point (its wheel's ring ≥ 0.7 m): as the
  guard turns its head (up to 0.85 rad) with its chin up, the head's back corners reach 0.62 m behind the ground point (0.73 m for
  the widest hair).
- Two or more guards (194 guard nights in 40 seasons; the vault defends at 4 + one per guard): side by side, ≥ 1.25 m apart (each
  turning head sweeps 0.53 m round its neck, 0.61 m with the widest hair).
- Start it at any frame (it is seamless at 12 s). It blends in from the stand (0.4 s). A guard who is fought plays the heist's
  `guard_bowled` (heist.md): stop this loop first.

### The gangway (`gangway_up`)

- **The ramp:** straight, rising at 0.24 rad (13.75°, `ramp.slope`; a rise of 0.245 m a metre, `ramp.rise`). The clip's feet are planted
  on exactly that slope: a different slope needs the clip's `GW.th` changed.
- **The rail:** on the walker's +x side, its top `ramp.rail.h` = 0.6 m above the ramp's surface (measured straight up), 0.64 m out from
  the walker's line (`ramp.rail.x`); the hand rides it 0.16 m ahead of the walker's ground point. That is the toon's belt height: the
  rail is built for the cast's proportions, not a real person's. Turn the walker so its +x side is toward the rail (a gangway with a
  rail on the other side: mirror it, or build the rail on both sides).
- **The travel** (stairs_up's contract): start the clip at the gangway's foot (the walker's ground point on the ramp's bottom edge) at
  t 0, keep the walk weight at 0 (`g.w = 0`), and move the walker along its heading at `speed` (0.75 m/s) and up at `ramp.vy` (0.1835
  m/s), so its ground point stays on the ramp. At the top, `stopClip` and let the walk take over on the deck.
- Every agent who boards does this (the last night, GAME.md §15). A queue up the gangway needs ≥ 0.9 m between ground points: leaning
  into the climb, a head reaches 0.66 m ahead of its ground point (the widest hair) and the back of the one in front 0.23 m behind its own.

### The eviction (`evicted_carry`)

- **The travel** (walk_hurt's contract): keep the walk weight at 0 and move the walker along its heading at `speed` (0.62 m/s). It is
  slower than a walk: the agent trudges. Start it where the agent comes out of the home it lost (the door); it is a loop, so stop it
  where the walk ends.
- **The bundle** (`prop.id` 'bundle', `errands-props.js`): draw `state.c.prop.geometry(THREE)` × `prop.matrix(THREE, state.t, out,
  w.g)` × the walker's matrix. It is posed in the body frame from the clip clock alone (the clip's own legs give the pelvis). Its
  colourways: `BUNDLE_SCHEMES` (`red` by default, `blue`, `green`, `purple`), passed as `prop.geometry(THREE, 'blue')`.
- About 14 evictions a season (GAME.md §10: can't pay the rent, and everything you own is on you).

### The props (all clips)

- **Show a prop only while its clip's weight is ≥ 0.6** (the gun's rule, CLIPS.md). Pass the walker's gait state as the last argument
  (`prop.matrix(THREE, state.t, out, w.g)`, `prop.pose(state.t, w.g)`) and the prop hides itself below that (it reads `g.iw`).
- **Each prop also hides itself until its hand has it** (`pose(t).show`, from the clip clock): the phone from 0.45 s (the hand has
  been in the pocket since the blend-in ended), the briber's envelope from 0.3 s, the cop's from the handoff (0.92 s), the bundle from
  0.5 s of the clip's first pass. So at the clip's start, and between plays at t 0, no prop floats where a hand isn't yet. The phone
  and the envelopes are gone again before their clips end (5.12 s, 0.92 s, 1.3 s).
- Use the playing clip's prop (`state.c.prop`). The cop's envelope is the same model as the briber's, posed in the cop's own frame.
- **Hide held things** while an errands clip with a prop plays: the clip owns the arms.

## The API (entry fields beyond CLIPS.md's)

- `prop` (phone_tip, bribe_pass, bribe_take, evicted_carry): `{ id, model, frame: 'body', geometry(THREE, scheme?), pose(t, g?) → { p,
  R, show }, matrix(THREE, t, out?, g?), point(t, q), track }` (the gun's pose contract: the prop's origin and its column-major axes,
  in the walker's body frame).
- `clip.track(t)`: every channel's value and the track's vars at the clip clock (the envelope's centre `ecx ecy ecz` and its long
  axis `edx edy edz` on both bribe clips, in the briber's frame).
- `gangway_up.ramp`: `{ slope, rise, vy, rail: { x, h, z } }`.
- `errands-props.js`: `GRAIN` (0.025), `ERRANDS` (`envelope.gripA` / `gripB` / `bills`; `bundle.grip`, `knot`, `lamp`), `SCHEMES`,
  `BUNDLE_SCHEMES`, `errandsCells(id, scheme?)` (for the icon baker), `errandsGeometry(THREE, id, scheme?)`, `errandsMatrix(THREE, pose,
  out)`, `errandsPoint(pose, q)`, `errandsDir(pose, d)`.
- `SHOW_W` (0.6), exported by `errands.js`.

## Checks

Port 5368, this branch (`anim/errands`) on ai-city-fresh main 7355dd1.

**The clip gates.** `FRESH_URL=http://127.0.0.1:5368 node style/check.mjs clips --quick --jobs 2`: **PASS**, exit 0 (12 min 47 s wall), on
the final files:
- **end check:** PASS (93 clips, 31 one-shots whose end the CPU acts on; on every frame the CPU and the shader agree whether each one-shot
  has ended, at 60 fps, 30 fps, a jittered dt and at the float32 edge).
- **elbow identity:** PASS within 1e-6 m (max 1.19e-7 m) over 11,186 look-states where no elbow bends. The six here are listed as moving
  by design, every state of each: `phone_tip` 121/121, elbow ≤ 1.16 rad · `bribe_pass` 37/37, ≤ 1.42 · `bribe_take` 41/41, ≤ 1.40 ·
  `guard_post` 241/241, ≤ 1.29 · `gangway_up` 18/18, ≤ 1.34 · `evicted_carry` 89/89, ≤ 1.39 (all under the IK's 1.45 rad cap, below
  the thick sleeve's soft cap).
- **hand gate** (`lower-motion-check --quick --clips`, every fresh bottom on the plain shoe): 93 clips (6,183 shader states) × 68
  fixtures (20 geometries), 11/11 shards: every count 0 (crossings, coplanar overlaps, opposite-leg, penetrations, leg/hand, foot/hand).
  - An earlier run caught three things, all fixed: a hand moving inside a clip from the hanging arm into the pocket swept a baggy thigh
    (`ash_sweats`; now the blends carry pocketed hands), the briber's free hand met its thigh as the knees dipped (eased out), and the
    gangway's swinging hand met the thigh swinging past it (wider).
- **see-through gate** (`overlap-check --gate '&dbg=back' --clips`, the mannequin): 0 of 17,248 frames show inside faces.
- Every older clip keeps its id (0–86) and its GLSL: the errands group is the last in `index.js`'s registry (ids 87–92); `index.js`,
  `CLIPS.md`, `lab.js` and every other group's file are untouched.

**Beyond the quick gate** (the see-through gate's line-up of my clips, `&only=…` with a top on every look): 0 of 1,224 frames show inside
faces on each of the mannequin, `bubble_goose`, `old_furcoat`, `old_puffer`, `old_opus_barrel_puffer`, `gatehill_mink`, `corner_hoodie`,
`tall_tee`, `precinct_blues` and `old_hoodie`.

**My probes on the real shader** (transform feedback of `ANIM2_GLSL`, the cast's elbow; every 0.05 s; the mannequin, `corner_hoodie`,
`bubble_goose` and `old_furcoat`):
- **The props on their fists** (the shader's grip point against the prop's): the phone ≤ 0.040 mm, the briber's envelope ≤ 0.040 mm, the
  cop's ≤ 0.040 mm (also through 0.72–0.92 s, its fingers on the briber's envelope), the bundle's two grips ≤ 0.060 mm. The gangway's hand
  stays ≤ 1.6 mm off the rail's line.
- **Hands in the head** (the look's head box in the head's own frame, the ears included): 0 vertices on every clip and look, except
  `old_furcoat`'s big fur cuff, whose top-front corner grazes the head's lower-front corner in `evicted_carry` (one corner, ≤ 2 mm,
  1.0–1.05 s).
- **The props against the head:** the phone ≥ 2.0 cm from it at the ear and on its way (its far end swings out to the side: turned up
  any sooner it clipped the chin's corner by 1.1 cm); the bundle ≥ 2.4 cm under the chin.
- **The reach** (every IK target against the shell, every 0.01 s): the phone 0.428–0.441 m, the briber 0.406–0.423, the cop 0.408–0.421
  once its hand comes in, the guard 0.417–0.441, the rail 0.415–0.446, the bundle's grips 0.409–0.446.
- **The pair's heads and caps** (the bribe, through both clips, the partner placed as the pair says; boxes from the looks' own head
  meshes: the head ±0.5 m, y 0.9–1.75, z −0.4…0.45; the brims: the precinct cap's x ±0.35, y 1.45–1.75, to z 0.65; a fitted cap's x ±0.4,
  y 1.5–1.55, to z 0.775; `old_fitted`'s to z 0.85): the heads ≥ 14 cm apart; the precinct cap's brim ≥ 40 cm from a bare head, ≥ 14 cm
  from a fitted cap; two fitted caps ≥ 3 cm; two `old_fitted` caps meet (6 cm into each other). Level (the chins down), a fitted cap's
  brim would be 21 cm inside the other's head, a precinct cap's 8 cm.
- **The feet:** each walking foot's heel or toe is pinned to its spot (by construction: the spot slides back at exactly the travel), and
  a sole's lowest point sits ≤ 8 mm (`gangway_up`, on the slope) and ≤ 10 mm (`evicted_carry`) under the ground: the outer edge of the
  sole as the leg leans with the hips' sway (the rig's own; the approved `walk_hurt` shows 18 mm, `stairs_up` 8.5, `guard_post` 7).
- **The loops' seams** (every vertex 0.1 ms before the wrap against t 0, 3 looks): `guard_post` 0.002 mm, `gangway_up` 0.14 mm and
  `evicted_carry` 0.11 mm (the travel within that 0.1 ms: no seam).
- **The guard's head** reaches 0.62 m behind its ground point (0.73 m for the widest hair): hence the door's ≥ 0.8 m.

## Sheets (`shots/errands/`)

Look at these first:
1. **`staged-bribe.jpg`**: the pair from the pass side, the cop in precinct blues: the envelope out of the pocket, held out low, the
   cop's fingers close on it, into the cop's pocket.
2. **`staged-phone_tip.jpg`**: the phone out of the pocket, up to the ear round the shoulder, the glance, the call, back down.
3. **`filmstrip-25m-frontpx.jpg`**: all five at the city's pixel size from the front quarter on their +x side (the phone side).

All of them:
- `<clip>.jpg` (the six): the lab's own sheet (`style/shoot.sh` on `&scene=clip&clip=<name>&strip=12&cols=6`), side, front and the clip
  scene's three-quarter, 12 frames each (a loop one period in, a one-shot from its start). In the lab the props are the stock lab's
  drawing (every frame, at the clip clock), the travelling clips run in place (their feet slide back, as `walk_hurt`'s do there), and
  `gangway_up`'s feet sit on its slope, so on the lab's flat floor the rear foot dips under it and the front one floats: see the staged
  sheets for the ramp.
- `staged-*.jpg`: the lab driven over CDP with stand-in sets built from the numbers above (the vault door 0.8 m behind the guard; the
  13.75° ramp and its rail), the props drawn by the rule (weight ≥ 0.6, the gait state passed), the travelling clips moved at their speed
  (the camera riding along): `staged-phone_tip`, `staged-bribe`, `staged-guard_post`, `staged-gangway_up-side`, `staged-gangway_up-rail`,
  `staged-evicted_carry-side`, `staged-evicted_carry-front`.
- `staged-bribe-caps.jpg`: the pair side on, both in brimmed caps (the briber a fitted cap and `old_hoodie`, the cop its precinct cap):
  the chins up keep the brims clear; the first frame (t 0, the blend in) shows them level-headed, the brim in the other's head.
- `prop-start.jpg`: the first 0.75 s of each prop clip every 1/20 s, drawn by the STOCK lab's prop slot (every frame, no weight rule):
  each prop appears only in its hand (the phone at 0.45 s in the pocket, the envelope at 0.3 s, the cop's at the handoff, the bundle at
  0.5 s with both hands on it).
- `filmstrip-25m-front.jpg` (the front quarter on their −x side), `filmstrip-25m-frontpx.jpg` (on their +x side),
  `filmstrip-25m-back.jpg` (the back quarter on their +x side; the guard without its wall, which hides it from behind): ~25 m, 38° down,
  fov 22° on 640 × 360 tiles (the city's pixel size at 1080p and fov 60°), each figure cropped and shown 2× nearest, 12 frames.
- `evicted_carry.webm`, `gangway_up.webm` (on the ramp), `bribe.webm` (the pass side), `phone_tip.webm`: 30 fps, the camera riding along.

## Open items

- **The phone at the ear reads from the front and its +x side only.** From the −x side and from behind, the big head hides the fist
  and the phone (`filmstrip-25m-front.jpg` vs `-frontpx.jpg`). A call bubble or a glint on the phone would carry it from every side.
- **Brimmed caps face to face.** The bribe's chins-up clears every brim but the longest pair (above), and only while the clips are
  weighted in: before and after, level-headed, the brims are in the other's head. The older face-to-face pairs (`brush_pass` 1.02 m,
  the talks 1.2 m, `vault_shove` 1.2 m) were measured on bare heads only: at their gaps a fitted cap's brim (0.78 m out from the neck)
  reaches into the other's face. That is a cast-wide staging question, not this group's.
- **The chins-up is a clearance fix.** If it reads as both looking at the sky, the other way to clear the heads is a sideways offset
  between the two. CLIPS.md's pair contract (`{ with, gap, delay, face? }`) has only the straight gap, and the contract isn't this
  group's to change, so it isn't done here.
- **The bribe is under the heads.** From above, the pass is a white-and-green fleck under the two heads' overhang, best seen from the
  briber's +x side. A "$" pop at the handoff (0.92 s) would sell it at 25 m.
- **The gangway is one slope** (13.75°) with its rail on the walker's +x side; another slope needs `GW.th` changed and re-checked. Walking
  DOWN a gangway isn't authored (only boarding is needed).
- **The travelling clips run straight**: a turn while they play swings the planted feet with the body (walk_hurt's caveat). The carry is
  one speed (0.62 m/s).
- **The bundle has no pick-up or put-down.** It appears with the hands on it 0.5 s into the clip and goes when the clip's weight drops
  under 0.6. A short `evicted_lift` (from a pile at the door) would make the start a beat of its own.
- **The guard's arms can't fold**: the hands would have to reach 0.55 m and the arm reaches 0.45 (the talk agent's finding), so it is the
  thumbs in the belt. A hand ON the hip is inside the reach shell.
- **The fur coat's cuff** grazes the head's lower-front corner by 2 mm for a moment of the carry (above).
- **Seen, not this group's:** at 25 m the `waves` hair's top turns near-white when the head rolls toward the camera's side
  (`filmstrip-25m-frontpx.jpg`: `phone_tip` at the ear, the carry's head roll); level, the same top is grey-brown. It's the look's
  shading, but at that size it can read as a white cap.
- **The stock lab draws every prop at every frame.** My props hide themselves before their hands have them; the weight rule needs the
  gait state passed (`prop.matrix(THREE, t, out, g)`), which the lab doesn't do yet (another worker is fixing its prop display).
- **Not run:** the full clip gates (`style/check.mjs clips` without `--quick`: every look, every bottom × every shoe). The quick gates, the
  ten looks above and my probes are what was run.
- **CLIPS.md** has no errands section yet: the table above is ready for the registry owner.
