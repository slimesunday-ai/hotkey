# C1-6 logic seam — 2026-10-27

The planner and staged player are implemented. **The logic gate passes:** every
non-hooded play is staged by its public kind; every hooded play is represented
anonymously, in a fight's hooded side or a count-only district scene. Hooded scene
and fight counts sum exactly to `show.hooded` in each district.
This round changes only `show-plan.js`, the new `showcheck.mjs`, and this handoff.
The supplied `player.js` and C1-5 diffs remain intact. No core, tracked check,
sim2, world, stage or page file was edited; no commit or model/server run was made.

## Staging reads

```js
import { createShowPlanner, createShowPlayer } from './show-plan.js';
const planner = createShowPlanner(frames);
const plan = planner.night(night);
const player = createShowPlayer(frames, { clock, speed: 1 });
sim.useRecord(player);
const current = player.snapshot().show;
// current: null outside the show, otherwise {night,start,end,active,completed}
// active: scene rows plus progress in [0,1); completed: scene ids
```

`planShow(nightFrame, precedingBoard)` is the pure single-night entry point.
`planner.at(minute)` / `showState(plan, minute)` select the same scene state on
playback and on a seek. All times are absolute island minutes on the existing
player clock. There is no additional clock, RNG, simulation or event-text read.

```js
plan = {night, frame, eventId, start, end, openingIds, scenes};
scene = {id, night, eventId, kind, beat, place, start, end,
         publicActors, hoodedCount, revealIds, variant?};
place = {corePlace, cityPlace, district, standPlace, lot};
```

`kind` keeps the public play/fight kind, including guard and finale board. Hustles
keep kind `hustle`; `variant` is the receipt's typed `how`: stickup, mugging,
crates, cars, boats, scrap, shoplift, campers. `arrest`, `hooded` and `results`
are additional scene kinds. `beat` is ambient, fight, arrest or results. Every
named public play has its own ambient row; ambient rows overlap the separate,
nonoverlapping fight/arrest beats. Source ids and scene ids are different:
many play rows share the show envelope's `eventId`. Use `id` as the drawing key.

Places reuse C1-3's `targetsAt` and `fightsAt` with the preceding board. Fight
results, strengths and prose never enter scene rows. Public actors are restricted
to `show.seen`; even a public arrest of someone absent from seen is staged
anonymously. Hooded district rows stage only the remainder after subtracting
public fights' hooded side counts in that district. They carry kind `hooded`,
`hoodedCount`, an empty actor list, a district anchor and scene timing/metadata;
no attacker identity, target or play kind. Zero remainders produce no row. Sum
these rows and fight hooded counts to recover `show.hooded` exactly; anonymous
arrest appearances are not additional attackers. Dock arrests use the typed dock
reason and the existing ferry anchor. Nothing selects clips, looks or poses.

Shows with fights, arrests, anonymous attempts, grab/vault/collar plays or the
finale run 15 minutes. Ordinary nights run 3 minutes. The staged player's
`reveal.end` retains `plan.end` after the active show becomes null. Placement
uses that end for both show targets and the daytime cutoff, returning everyone
home at the close on nights 1–13 (with jail and eviction respected). Night 14
follows the departure contract below. Snapshots without a plan
retain C1-3's 15-minute compatibility window.
The visual builder must wire `createShowPlayer` into `record/page.js`; the default
`createRecordPlayer` retains C1-2's behavior and unchanged `recordcheck` contract.
The stager can retain the original typed public event by `eventId` internally
for its payoff animation; it must use the presented store for board/ticker UI.

## Reveal

At the opening, only the safe show envelope and previously delayed disclosures
are applied. Each hustle, fight and arrest result is applied at its scene's end.
Turf waits for all public dealers on that corner to finish. Other current-night
events wait for the closing results beat. Event forms are passed unchanged:
their `minute` is still core publication time, not a fabricated occurrence time.
`reveal.revealIds` is the cumulative list of forms released from that night frame.

The complete board, sightings and result metadata stay held until the close.
The player applies the supplied board verbatim; it never patches heat, jail,
prices, holdings or any other game fact from events. Dawn cards and subsequent
full receipt replacements retain their original publication boundaries and ids.
Seeking resets and consumes these same cues. A partial feed ending at a night
still includes its closing beat in the player's bounds. The playlist uses each
actual show end, including quiet nights.

Core-side option for field-by-field board reveal: export typed result deltas,
e.g. `{afterIds:[feedLocalId], boardDelta:{agents:[{id,heat,wanted,jailed}],
corners:[{corner,holder}], ...}}`. These are core-produced replacement values
with explicit removals and base/revision metadata, never arithmetic instructions.
The core must supply dependencies when several results affect the same field;
the city schedules the delta after the last associated payoff. Feed references
must be remapped like `orders.of`. Complete core-owned board snapshots at those
boundaries are a larger but simpler alternative. Neither option is implemented.

## Anonymous plays and D6

Example: seed 404, night 3 has `hooded:{junkyard:1,industrial:1}` and no fight.
No live field says whether either person hits, breaks in or backs. Both are
staged as `hooded`, one in each district, without guessing kinds or targets.
The planner uses only the current public show/fights and the preceding board;
it never reads delayed play payloads or reconstructs attack membership.

Only the check reads the delayed plays. It verifies named kinds unchanged and
consumes one anonymous slot per hooded play in its district (following a back's
disclosed target play to find that district). No slot can cover two plays and no
slot may remain unused. It does not claim a private correspondence between a
specific person and a fight: an intercepted backer can leave its attack's fight
smaller than the group. Public fight sizes and per-district conservation are
checked independently. Ambient hooded rows have a strict count-only schema.
The current seam always returns the live-safe version; D6's named replay overlay
still needs a separate disclosed mapping and remains outside this logic work.

## Evidence

Feeds: existing `core/runs/{404,405,406}-A/feed.jsonl`; none regenerated this round.
Checks: `SIM2="$PWD/sim2" node style/city/tools/<name>check.mjs` for show,
record, place, routine, clock and robust. Robust used the already available
`THREE_DIR=<a local folder of Three modules>`;
no dependency download was required. Logs are `/tmp/c1-6a-show-{before,after}.log`
and `/tmp/c1-6a-{record,place,routine,clock,robust}.log`. `git diff --check` passes.

Before fixing the planner, the two requested in-memory production faults failed:
`--fault hooded-kind` → anonymous ambient scene withholds play kind;
`--fault hooded-dropped` → night 3 junkyard counts no longer sum to show.hooded.
Both remain automatic controls, alongside fold-fight (fight 156 lacks its own
beat), hooded-named (hooded public actor), and early-result (premature result).
All five controls exit 1; no source is left faulted. Properties exercise 42
nights, 1,281 scenes, 1,121 public plays, 52 fights, 28 arrests, 89 hooded
attackers, 6 short shows, all eight hustle variants and 5,479 playback/seek
points. They pass, including dawn card forms, partial feeds, reverse/fresh seeks,
no-future plan dependence, input
immutability, forbidden prose/private getters and a Math.random trap.

Before: the audit demanded hidden kinds and failed on 57/1,210 plays (38 hits,
19 backs), with 22/11/24 misses on seeds 404/405/406. After: **SHOWCHECK PASS,
0 unstaged / 1,210 plays**; each seed has 0 misses, including 32/21/36 hooded
plays respectively. Unchanged recordcheck, placecheck and routinecheck pass seeds
404–406; clockcheck reports GATE PASS; robustcheck reports 10 checks passed.
No rendered standing time, clip/prop behavior, camera or visual QA was measured.

## Look-ahead repair — 2026-10-27

`player.shows()` lists future night numbers and their scheduled jump minute but
omits `end` until the source night frame's publication minute. Reverse seeks
hide it again; the internal playlist still uses each actual end. The public
row contains no publication helper or scene content.

Before the repair, `showcheck --fault future-show-length` exited 1: at minute
1800, seed 404's night 1 picker exposed `end:2708`. Independently,
`--fault fixed-show-window` exited 1: 30 agents retained show targets at 2708.
The final default showcheck runs both mutations automatically and rejects each.
The repaired properties pass publication boundaries, future-only duration
mutations, reverse seeks, all 42 closes at end and end + 0.1, retained active
snapshots queried after close, jail/eviction and the unplanned fallback.

All six gates pass with `SIM2="$PWD/sim2"`: showcheck, placecheck, recordcheck,
routinecheck, clockcheck and robustcheck (the same existing `THREE_DIR` above).
Seeds 404–406 retain 0 unstaged / 1,210 plays and 5,479 playback/seek points;
robustcheck passes all 10 checks. Logs: `/tmp/c1-6a-lookahead-before-*.log` and
`/tmp/c1-6a-lookahead-{show,place,record,routine,clock,robust}.log`.
Only player, placement, this new showcheck and this handoff changed this round.

Durable handoff for brain capture: this sandbox cannot write the external vault;
the measured staging contract, look-ahead repairs and passing audit are recorded
here for promotion.

## C1-7: new-set data — 2026-10-27

`show-plan.js` now calls `staging.js` after assigning C1-6's intervals and before
assigning unclaimed reveal ids. C1-6's scene ids, kinds, public-play rows, frozen
plans, show selection and event/board reveal contract remain the seam. Named
set scenes and finale scenes gain these fields:

```js
scene = { ...c1_6_scene, actors: [publicId], hoodedCount,
          route?, roles?, eventIds: [feedLocalId],
          beats: [{name, start, end, eventIds: [feedLocalId]}] };
```

`actors` equals `publicActors`. `eventIds` are staging provenance; `revealIds`
remain the sole publication cues. Beat intervals are ordered, positive,
nonoverlapping within their scene and expressed in absolute island minutes.
They partition that scene's interval. These are semantic beats, with no clip,
pose, prop, movement speed or spatial arrangement selected. Ordinary anonymous
`hooded` rows retain C1-6's exact count-only schema and gain no fields.

| Set/row | Beat names in order |
|---|---|
| Vault arrival | `arrive`, `lookout` |
| Guard | `post` |
| Won vault fight | `shove`, `drill`, `heave`, `carry` |
| Lost vault fight | `shove`, `struggle` |
| Arrest | `cuff`, `escort` |
| Grab arrival | `converge` |
| Won grab fight | `scramble`, `tug`, `ram`, `carry` |
| Lost grab fight | `scramble`, `struggle` |
| Build | `clamp`, `hammer`, `file`, `fit`, `assemble` |
| Run: forest | `dig`, `unearth`, `carry` |
| Run: docks | `container`, `lift`, `carry` |
| Run: mall/junkyard | `search`, `pick_up`, `carry` |
| Cook: home | `stir`, `pour`, `stir`, `check` |
| Cook: forest | `stir`, `pour`, `fan`, `check` |
| Finale walk | `walk`, `arrive` |
| Finale fight | `fight`, followed by set beats if it is a vault/grab fight |
| Boarding | `queue`, `gangway` |
| Ferry | `leave` |
| Missed boat | `missed` |
| Day-15 mint | `mint` |

Build/cook/run places use the existing public `targetsAt` result, including
addresses, evicted homes at the Heap, and the woods' existing lab assignment.
Vault and grab confrontations keep C1-3's Precinct 9/docks anchors. Vault arrival
and guard-post scenes finish before the confrontation. A vault fight's
`roles:{jobbers,guards}` lists the ids whose public plays say vault/guard.
A known vault jobber's fight arrest uses Precinct 9; other arrests keep C1-6's
public placement. No arrest is invented from a losing result.

The planner reads public `show.plays`, `show.seen`, fight kind/outcome, and
arrest/board/missed fields in that night frame, plus the preceding board.
It never reads delayed plays, gather/cook/craft/grab/vault receipts, consent,
membership, outputs or a drug name. Work scenes cite the show id, because their
receipts are not published yet. Build products therefore do not select a stamp
or a gun test. Cook has one generic batch appearance, at home and in the woods.
Run variants follow the public drop place, without predicting gathered goods.
Hustles retain C1-6's eight typed `variant` values and existing staging seam.

Public vault/grab fights supply anonymous side sizes and a won flag, without
winning member ids. Their scene actors are public jobbers/grabbers and guards,
not attributed sides or carriers. Backers keep their own public scenes; being
in the same district does not prove which group they joined. The drawing must
keep that ambiguity, including any unnamed carrier. A later disclosed receipt
may supply a replay mapping; this round adds no D6 identity overlay.

### Finale and day 15

Every public board receipt supplies its `route` to a walk and a boarding scene.
The existing ambient `board` row is its walk when available; other walkers get
kind `walk`, beat `finale`. Boarding has kind `board`, beat `finale` and the
receipt id as `eventId`. An actor absent from `show.seen` remains unnamed in
both rows, even when a boarding receipt exists; its `hoodedCount` is one.
These repeated appearances are not additional anonymous attackers.

All night-14 shows last 15 minutes. Relative to `plan.start`: walks occupy
0.125–3; serial fights/arrests occupy slots within 3.25–9.75; boarding is queued
within 10–13; the ferry leaves at 13.25–14; missed-boat scenes occupy 14–14.75;
C1-6's results close at 14.75–15. Every fight preserves its public route in
`route`, even when its set is Precinct 9. A missed agent gets a route walk only
when the public show supplies a route. An agent already jailed on the preceding
board stays in jail with no invented route. Boarding/missed results reveal at
their scenes' ends; fights/arrests retain their original individual reveal cues.

```js
const planner = createShowPlanner(frames);
const finale = planner.night(14);
const mint = planner.day(15);          // requires the actual day-15 dawn frame
const staged = planner.stagingAt(player.minute);
// night: same result as planner.at(minute)
// mint: {day:15,start,end,active:[scene + progress],completed:[sceneId]}
```

The mint plan lasts three presentation minutes from the actual dawn frame's
publication minute. Every typed `mint` receipt supplies one subject and one
source id; no card contents or amounts are copied into the plan. Mint scenes
have empty `revealIds`: the dawn frame publishes normally. `stagingAt` returns
null before that frame, after this window, or for a feed ending before dawn.
`at` / `player.snapshot().show` keep C1-6's night-only contract. A renderer must
use `stagingAt` for the mint. The existing player's terminal bound is the last
source minute, so the visual integration must also allow this presentation tail
on the existing clock; no player or clock file was changed in this half.

### Evidence and remaining integration

`stagecheck` first rejects twelve in-memory faults: missing-set, missing-actor,
missing-beat, early-beat, hooded-name, wrong-route, missing-walk, missing-missed,
missing-route-fight, early-mint, lost-cuffs, missing-guard. Before implementation,
`stagecheck --fault missing-set` failed on absent run scene data. No file or
fixture remains faulted; no committed check or test was edited.

Measured all seeds 404–423 under A and B with the supplied layer-4 feed command.
The six vault seasons are **406-A/B night 14, 412-A/B night 14, 415-A/B night 5**.
All won; no measured losing vault job or guard confrontation is claimed.
A constructed public loss/guard frame verifies guards, unhooded jobbers, no
inferred back membership, struggle without successful door/loot beats, subsequent
cuffs/escort at Precinct 9, and the unchanged arrest cue. A constructed all-jailed
finale verifies a full ferry window, missed agents in jail without invented
routes/identities, and no read of the resulting night board.

Coverage on baseline 404–406 A plus the other five vault seasons: 112 nights,
984 public set plays, 4,725 beats, 238 route walks/boardings, 2 missed agents,
6 route fights, 2 dock arrests, 238 mints. An independent delayed-receipt audit
checks 531 gather, 74 craft, 301 cook, 18 grab and 6 vault receipts against the
live-safe plans. Both cook locations, all four drops and all three routes occur.
Frozen inputs, future-prefix equality, fresh/cached selection, publication
boundaries, private receipt/prose/product getters and an RNG trap pass.

Commands: `SIM2="$PWD/sim2" node style/city/tools/<name>check.mjs` for stage,
show, place, record, routine, board, clock, robust. All pass. Robust uses the
already supplied `THREE_DIR=<a local folder of Three modules>`.
Showcheck reports 0 unstaged / 1,210 plays; 1,392 scenes and 5,537 playback/seek
points. Robust reports 10 checks passed. Logs: `/tmp/c1-7-{stage,show,place,record,routine,board,clock,robust}.log`.

The Claude half still builds props, pair spacing, chains, effects, routes,
boarding/ferry drawing, the mint tail and visual QA from the eight clip-group
notes. Clip audit fixes remain deferred. No clip/pose choice, visual claim,
server, paid/model call, commit, core/sim2/world edit or existing-check edit was
made. Durable capture for the brain: this handoff holds the measured seam and
field gaps for promotion; the external vault is outside this sandbox's writable
roots.

## C1-7 drawn half: night 14 and the mint, 2026-10-27

Staged (`stage/record.js`, `simstate/record/draw.js`):
- **Walks:** a named walk row (the ambient `board` row, or kind `walk`) is the agent's show trip. It goes on foot
  (`trips.plan(..., { walk: true })`) from its home in Pleasantview to the row's place on its route, and cuts to the
  arrival at the `arrive` beat or at the agent's first other scene. Its arrival plays `SHOW_LOOPS.walk`/`board`. An unnamed
  walker is a hooded stand-in that walks the lanes in from the Pleasantview side and cuts to its mark at `arrive`.
- **Ferry:** a dockhand stand-in waves the baked SECOND CHANCE off (`districts/sea/bay.js` FERRY).
- **Mint:** `planner.stagingAt` shows one blank card of light per receipt, rising off the docks in record order. The
  player's bound runs to `planner.day(15).end` when the record ends at day 15's dawn.
- **Docks:** stand spots go from 10 to 24, made by `simstate/stands.mjs` with `STAND.place.docks`. The rules are
  unchanged and only the docks entry was merged.

The drawing integration was blocked by placement. Before C1-7a2, `targetsAt` kept every night-14 walker at its
play's route place (back players at their back place) until `plan.end`, then home. `staging.js` already put:
- the boarding (`board`, finale) at the docks, 10–13;
- the ferry with them aboard, 13.25–14;
- `missed` at the docks;
- a dock arrest at the docks;
- a backer's walk at its route's place, not its back place.

Before C1-7a2, seed 404 at 21437 had plaza 14, corner-3_-6 10, store 5 and heap 1. Placement now has docks 30.
The contract is fixed below; the remaining ferry, hiding and movement drawing work is still the next visual job.

## C1-7a2: finale placement — 2026-10-27

slime chose option (a), "go with a": placement follows the finale. This section
replaces the earlier stop note after the wider scope authorized the night-14
close pin in `showcheck`, alongside `placecheck`. Nights 1–13 retain their rule.

`staging.js:finaleTiming(start,end)` owns all finale windows. `targetsAt` reads
that shared schedule and the **current** `snapshot.show.active` scene anchors,
with no new caller argument or planner recursion. The snapshot contains active
scenes and completed ids, not the whole plan. Named actors use their active
scene's place, then a disclosed fight's place until boarding. Public board/back
walks use the public route; anonymous walkers retain null, hidden targets.
The staged board stays the preceding board until close. An arrest form publishes
at escort's end and moves its subject to Iron Island immediately; the resulting
night board is never read early. Prisoners on the preceding board stay in jail.

Relative to the existing start (night 14: 21425):
- ordinary route walks: .125–3 (21425.125–21428);
- serial route fights and dock arrests: slots in 3.25–9.75;
- boarding: 10–13 (21435–21438), with all free named walkers at the docks;
- ferry `leave`: 13.25–14 (21438.25–21439);
- missed: 14–14.75, at the docks or Iron Island for prisoners;
- close: 14.75–15; day 15's mint still starts at its actual dawn frame.

The exception follows GAME.md §15: "Job the vault, then run for the boat through
Glasswall." Seed 406's a22 now stays at the vault through the job, walks at
`plaza` from the job's end (21432.15) to boarding's start (21435), then boards.
Backers reuse their existing ambient row as a walk, retaining kind `back` and
its identity, so there is no simultaneous back-place and route-place appearance.
A missed vault prisoner never gets an invented post-arrest route walk.

`departed` is a new placement reason, with `corePlace`, `cityPlace`, `district`,
`lot` and `standPlace` all null. From `leave.start`, published board receipts
hide passengers even while the old board is held. After close, the public
`board.agents[].boarded` field keeps them absent through the night and day 15.
The feed has that field at both night-14 close and day-15 dawn: 30/30/29 boarded
on seeds 404/405/406; seed 406's a05 remains jailed. There is no `missed` board
field. Neither mint nor `gone` receipts place agents back on the island.
GAME.md §15 says a missed agent comes home after the season without an island
return minute. After its missed scene, a subject uses the ordinary rest rule:
jailed → Iron Island, evicted → The Heap (GAME.md §10; D9), otherwise home.
This also holds through close, the night and day 15; `rest()` owns the home/Heap
choice. Correction in this same change: the initial finale fallback ignored
eviction. Baseline seeds 404–406 lack a non-jailed evicted missed subject, so a
constructed public night frame and preceding board cover it, including reverse
seeks and jail precedence. `evicted-missed-home` plants the old-home drawing
after the missed scene and must fail its own property.
The eviction follow-through passes place/show/stage/record/seek checks, all seven
fault controls and the restored HEAD-reversion proof; logs use `*-eviction.log`.

`checkDrawn` treats `departed` exactly as `hidden`: omission or an invisible
marker is allowed, a visible walker is rejected. During night 14 it needs the
full player snapshot for scene anchors. The page's `storeView` deliberately
strips `show` from `sim.record()` (STORE.md, "Held results on the page"). The
only external caller found, `tools/recordscenario.mjs`, already uses
`window.__record.player.snapshot()` and needs no change. `draw.js:buildTimeline`
also already passes its full probe snapshot. Any future store-view caller must
use the full player snapshot or attach that same current `show`; no scenario
or draw file was edited in this pass.

The drawing job still must recognize `departed` before resolving a place or a
trip, remove every passenger's walker and attached scene/prop/label from the
leave beat through day 15, and never respawn island subjects for the mint.
Its timeline must sample the plan's scene and beat boundaries, especially
`leave.start`. Walk detection must recognize back rows by their `walk` beat,
and the vault walk must start from the completed job rather than its home.
Ferry motion, stand-ins, pair spacing and visual QA remain the drawing job.

Both re-pinned checks carry the same one-line note quoting slime's call. Every
old placecheck property and fault remains. New `boarded-island`, `boarding-home`
and `jailed-docks` mutations each fail on their own drawn property. The independent
prefix projection holds the preceding board to close and publishes by scene
cues; it does not call the player/reducer. All named beat midpoints on seeds
404–406 pass (120/120, 116/116, 125/125), with no overlapping named places.
The check also covers exact leave/close boundaries, retained snapshots, reverse
seeks, routine planners, day-15 absence and the non-jailed missed fallback.

Evidence is in `tmp/c1-finale-placement/*-final.log`, `before-v2.log` and
`after-v2.log` (exact per-place counts, also with routines). The isolated
`head-proof.mjs` copies the current seam under `tmp/`, replaces only placement
with HEAD, requires the re-pinned check to exit 1, restores it and requires a
pass. The working placement is untouched throughout. No commit, drawing edit,
network, port or model run was made. This handoff queues the durable finding
for brain promotion; the external vault is outside the writable roots.

## C1-7 drawn half: the sets, 2026-10-27

Staged in `stage/record.js` (props `stage/setprops.js`, effects `stage/setfx.js`, beat clips `loops.js` BEAT_LOOPS):
- **Vault** (seed 415 night 5): the wall and door at Precinct 9 on the open side of the anchor; public jobbers keep the street
  door (`lookout_wave`), the rest of the crew are unhooded unnamed stand-ins; `vault_shove` ⇄ `guard_bowled`, `vault_drill`
  with sparks, `vault_heave` swinging the door by the clip's `door.open(t)`, every stand-in out with a sack (`loot_carry`), one
  at a time. A lost job (shove, struggle, cuffs) is staged too; no season measured one: the frame is constructed
  (`tmp/c17c-lost-vault/feed.jsonl`, stagecheck's loss fixture written as a feed).
- **Grab** (seed 404 nights 2, 8): the crate set piece on a line clear of bystanders; tug, ram, carry by stand-ins only.
- **Build, cook, runs**: each beat's clip; the bench with the crafter's vise (0.65) and lamp, hammer sparks; the cook set
  posed from the clip, steam (thin at home, thick from the woods shack); the woods' mound and package, dust; the docks'
  container and crate; the Mall's and the Heap's piles.
- **Corner fights** (seed 406 night 13): staged as a hit on the corner's holder.
- **Sit-downs by venue**: `venue(cue)` gives draw.js two spots under `venue:<event id>`: a booth by the diner (both sat), the
  garage roof (standing), a parked car by the park (one sat in the doorway). life.js keeps a venue pair on its spots and lets a
  sat pair talk.
Effects are closed-form in the clip clock (sparks, dust) or the island clock since the scene began (steam: a seek lands mid-plume) and a
hash of the scene id.

## C1-7d drawn half: the finale drawn, 2026-10-27

- **Timeline:** `draw.js buildTimeline` samples every scene and beat boundary of each night's plan, so night 14's placement (route,
  fight/arrest, docks, `departed`) is drawn when it changes. `departed` is drawn as absent: no walker, no bubble (bubbles.js `gone`).
  Backers' night-14 rows walk as walks; the vault jobber's walk starts at the vault. The leg from the route to the docks walks on foot
  and cuts to its arrival by boarding's start + 0.5 (or the agent's next scene).
- **SECOND CHANCE** is live (`second-chance.js`), out of the bake on every path (sea.js hero, bay.js far hull). Other paths: her bay
  mark (HERO), with a plain live wake. Record: HERO until day 14's dawn frame, BERTH with the gangway down, `leave` = a cubic from the
  berth round past HERO and on, a function of the beat's clock; then gone.
- **Boarding line** (`stage/record.js`): queue along the quay from the gangway's foot (12 places), climb in the gangway beat by its
  clock, held in her cabin until `leave.start`, then removed out of sight (`inCar`). While held, `draw.drawn()` reports the boarder's
  label only (no x/z): it is on its way aboard, not at a stand spot.
- Missed (berth or jail), dock arrest (taken to the quay past her stern), dockhand facing her as she goes. `shortBy` clears on reset.
