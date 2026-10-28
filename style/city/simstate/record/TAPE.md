# C1-9 logic: rewind and the tape

New files only; no commit. C1-5/6/10's supplied diffs are untouched. The store
contract is `../STORE.md` (there is no `record/STORE.md`). Design: GAME.md §19–20,
C1 D4/D6/D9 and TV-PLAN A4. This supplies data; the Claude builder owns the rail,
scrubber, missed detection/throttling, pointer handlers, camera and stage reset.

```js
import { createTapeReader, recordSideAt } from './tape-data.js';
const tape = createTapeReader(frames);
const current = sim.record();
const markers = tape.markersAt(current);
const paper = tape.paperCardAt(current, eventId);
// On an explicit click: pause, seek(paper.replayStart), frame paper.framing,
// then play once the camera arrives. Save and restore the viewer's camera.
// Keep the current disclosed horizon while another player seeks the replay:
const side = recordSideAt(replayPlayer.snapshot(), current);
```

No callback moves a camera or starts playback. Use C1-6's `createShowPlayer`,
not the compatibility single-beat player. Inputs are presented `sim.record()`
snapshots, never `sim.events()`'s compatibility time or a future board. The
reader's private planner is queried only for already-present show envelopes;
every such plan reads no frame after the requested snapshot. A future frame
proxy that throws on every property access is exercised at every hour.

```js
marker = {id, minute, kind, place, replayStart, subjects:{agent,others}};
paper = {id, night, kind, minute, place, replayStart, subjects,
         framing:{agent,place}};
place = {corePlace,cityPlace,district,standPlace,lot} | null;
side = {minute,asOf,events,names};
name = {agent,name,play:{kind,place?,target?,corner?},victim,
        source:{eventId,minute,robbedId}};
```

Markers cover every released show/fight/arrest/turf/buy, the season arrival and
each typed ferry boarding. `kind` is show/fight/arrest/turf/sale/ferry. Feed-local
id order is retained, even when scene payoff order differs; ids never change on
receipt replacement. `minute` is the staged publication cue, not the core
half-day `t`. Replay starts a quarter island minute before the matching scene,
clamped to its show opening. Boarding replays start at the named public route
scene, sales just before dawn, arrival just before setup. No source for a
specific place stays null (the city-wide show and a purchase). No merchant,
buyer position, sale copy identity or ferry departure time is inferred.

Paper rows accept the stable event id in `cardsAt(...).replay.eventId` or a
marker id. Missing/unpublished ids return null. Picture subjects come only from
the typed card, even after a masked card becomes a full robbery receipt.
Theft framing uses its victim, never its attacker. A unique fight with that
night/typed victim supplies the scene and C1-3 anchor, including the victim's
house for a break-in. Frame that house even when the victim is elsewhere.
Ambiguous/missing fight matches start at the whole show; unknown locations stay
null or use the disclosed district. Other cards frame their typed subject;
Turned frames the first typed victim. No caption or event prose is parsed.

The record overlay is separate from the sought store. It requires the viewing
horizon to be strictly more than 1,440 minutes after the replay moment AND each
source to be present in the disclosed snapshot. Some private forms publish at
the next lock before the literal 24-hour boundary: publication alone does not
unmask them. Day-15 disclosure does not bypass the age requirement. After the
season's last feed frame, the host may supply a later current island minute on
that retained final snapshot; the helper does not invent a clock or advance a
player past its bounds. Names are roster ids/display names joined to disclosed
`play` fields for figures absent from the old `show.seen`. Typed `robbed.by`
can supply an additional victim/source link. A back retains its typed leader
target; the helper does not invent its victim or assign intercepted backers to
fight sides. The drawing layer must retain anonymous stand-ins without a typed
identity correspondence. `events` is the disclosed source half-day (`event.t`
equals the sought frame's `t`), including reasons/words/holdings if supplied;
the feed does not provide precise occurrence minutes for delayed day errands.

## Verification

Feeds were generated locally with `node core/bench/runner.mjs --seed <s>
--rule A --cast layer4 --feed --out core/runs`, seeds 404–406, no models/ports.
Run `SIM2="$PWD/sim2" node style/city/tools/seekcheck.mjs`. Default execution
first requires each in-memory planted source fault to exit 1:
future-marker (later-frame fight marker), hooded-live (future private name on
the live view), seek-board (reset drops a board). Then production must pass.
Each can also run alone with `--fault <name>`. No file is left faulted.

Measured: 367 hourly seeks per seed (including the empty pre-setup period),
915/906/909 publication edges and scene midpoints, 135/136/129 final markers,
3,163/3,189/2,837 card replay observations, 64/41/71 disclosed-name observations.
The independent publication oracle checks boards, complete event replacements
and metadata. Seek/play comparison includes the store, routine `targetsAt`,
active scenes/progress, board and cards. Reverse/fresh/prefix seeks, before-cue
absence, 24-hour equality and epsilon edges, withheld records, masked full
receipts, stable paper rows, forbidden text/private getters, a Math.random trap
and immutable inputs are checked. All three planted faults fail first.

Existing gates, each with `SIM2="$PWD/sim2"`: showcheck, recordcheck, placecheck,
routinecheck, boardcheck, clockcheck, robustcheck all exit 0. Robustcheck uses
`THREE_DIR=<a local folder of Three modules>`
(the existing local modules). Logs: `/tmp/c1-9a-{seek,show,record,place,routine,
board,clock,robust}.log`. No browser/pointer/camera/geometry checks were run.

## Existing seam findings for their owners

Neither is repaired here because existing files and the supplied C1-6 diff are
out of scope. The requested seek equality gates pass despite these issues:

* `player.js:15–16` eagerly asks every future night's plan for its `end` and
  exposes it in `shows()`. Seed 404 at minute 1800: night 3 returns
  `{night:3,minute:5585,end:5600}`; changing only that future show's hooded count
  to `{}` changes the exposed end to 5588. Future show duration reveals unseen
  activity. The reader added here never exposes or consults that navigation list.
* `placement.js:18–21` still assumes a 15-minute show, as SHOW.md already warns.
  Seed 404 night 1 ends at 2708; at 2708.1 the staged player returns `show:null`,
  while `targetsAt` returns 30 rows with `source.kind:'show'`. D9's return home
  therefore waits until 2720. The visual integration must use the actual end.

Durable brain capture: promote this handoff's measured C1-9 seam and these two
owner findings to the external vault when reviewing; this sandbox only permits
writes in the worktree and temporary directories.
