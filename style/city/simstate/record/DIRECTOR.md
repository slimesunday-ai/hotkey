# C1-8: director logic seam (2026-10-27)

This 10-27 follow-up changes only this note and `tools/directorcheck.mjs`.
`day-director.js`, `cut-plan.js`, the C1-5/6/10 diffs, player, other checks,
core, sim2 and world sources are untouched. No commit, server, browser, port or model call.
The store contract is `../STORE.md` (there is no `record/STORE.md`).

## Night camera input

```js
import { createCutPlanner } from './cut-plan.js';
const cuts = createCutPlanner(frames);
const runningOrder = cuts.night(night);
const shot = cuts.at(player.minute);
// For an old replay, pass a SEPARATE currently disclosed snapshot:
const namedShot = cuts.at(replayPlayer.minute, disclosedPlayer.snapshot());
```

`night(n)` returns the frozen array
`[{sceneId,score,start,end,subjects,captionFields}]`. `at(minute)` returns its
current row or null. Times are absolute island minutes, on C1-2's clock.
`sceneId` joins C1-6's `plan.scenes[].id` for the camera/stage's place and marks.
Every fight and arrest is covered for its entire scene; other scenes are
selected around those reserved intervals. The cut spans the exact C1-6 show
(15 minutes, or D9's 3-minute quiet night). There are at most two cut starts in
any rolling, half-open minute, including across minute boundaries.

A cut can start with an establishing view before the scene begins and hold its
place for aftermath after that scene ends. `end` is the next camera cut/show
end; it does not extend a staging scene or move its result reveal. The camera
builder retains C1-6's scene start/end, progress and revealIds. No cut publishes
an outcome, moves a board reveal or chooses the winner's camera.

`captionFields = {kind,beat,place,subjects:[{id,name,driver}],anonymousCount}`.
Names/drivers are exact board values selected by id. Driver is opaque; a model,
owner or bot label is never inferred from words. The renderer uses text nodes.
Captions contain the public action, without a still-held win/haul/result.
No event text, private reasons, holdings or card envelope is a caption input.
Live subjects are exactly the scene's public actors; hooded stand-ins have a
count and no identity. Public morning cards remain C1-10's separately masked
projection; this code neither reads nor changes them.

D6 is a separate nonmutating overlay. Both the full show must be more than
1,440 island minutes old AND its matching full receipt must already be in the
supplied disclosed snapshot. Only a unique typed rob/burgle receipt with the
same night, target and place supplies its explicit members to a fight caption.
No attack/backer membership is reconstructed from missing people or plays.
Failed/ambiguous attacks and count-only anonymous scenes remain anonymous.
The overlay adds `recordEventId` and `identityMode:'disclosed-record'`.
The live cache always stays anonymous, even after requesting a named replay.

Low-level exports: `planCuts(plan,precedingBoard)`, `cutAt(cuts,minute)`,
`sceneCaption(scene,board)`, `captionSubjects(ids,board)`, and
`replayCut(cut,scene,plan,disclosedSnapshot)`.

## Day camera input

```js
import { createDayDirector } from './day-director.js';
const director = createDayDirector({ routines, preferred: [ownedId, ...stars] });
// Once per second, using the presented snapshot and existing player's clock:
const decision = director.tick(player.snapshot(), { arrivals: publicTrips });
// decision: {action:'cut'|'hold'|'idle',minute,broadcastDelay,cut}
// On seek / epoch, reset before ticking again:
director.reset();
```

A day cut has the night fields plus `momentId`, `place`,
`setup:{minute,publicSince,source}`, `payoff`, and `routineCloseup`.
`payoff` is null when no future public event is known. For an announced public
arrival it is `{minute,kind:'arrival',tripId}`. Out-loud/release events carry
already-occurring payoff times, without invented earlier warnings. Meetings
have no predicted end or private words. Their public setup can remain in view
without paying off. Out-loud speech itself stays C1-4's bubble job, by event id.

The scorer reads C1-4's routines only at the presented minute. Candidate order:
public arrivals/releases (7), out-loud (6), sit-downs (5), routines (2); owned or
starred subjects double it, a place/subject repeated within three minutes halves
it. Stable ids break ties. Shots last at least a minute and arrivals can retain
the shot through their announced payoff. Same-second calls return the same
result. Backward ticks require reset. Night/over returns idle.

Optional public trip shape:
`{id,announcedMinute,setupMinute,minute,subjects,place}`. The trip planner owns
all those presentation times and publishes the announcement. The scorer never
calculates a route/travel duration, reads an unannounced trip, or identifies a
private destination. Unknown/unmapped/coarse destinations cannot be featured.

Only `delayS` is imported from the broadcast module. No lookahead import/call,
queue passthrough or new camera file is needed. Fifteen seconds of delay cannot
create thirty seconds of warning. The future camera director remains the only
permitted lookahead importer under broadcastcheck §0.

## Gate interpretation and evidence

**The 70% day gate PASSES: 100/100 sampled cuts have a qualifying payoff.**
slime, 10-27: **"go with our suggestions"**. His reading of task 8's day bar
counts staged payoffs: either a public setup shown at least thirty seconds
before its public payoff, or an establishing view followed at least thirty
seconds later by a `routineCloseup` of the SAME still-current C1-4 loop.
The observer records the actual establishing cut, then re-queries C1-4 at the
close-up's minute for the same agent, row minute, act and city place. A missing
establishing view, early close-up or changed loop earns no routine credit.
Public and routine credits are counted as a union of cut ids, once per cut.

A routine payoff remains a presentation mark, never a successful errand,
robbery, invented game result or predicted next act. The director still cannot
obtain thirty seconds of warning from a fifteen-second queue and never reads
future day frames. Runtime behavior and night gates have not changed.

Fresh baseline before this edit: public 0/100, routine 100/100; credited 0/100,
exit 1 because staging was excluded. After slime's reading: public 0/100,
routine 100/100, total 100/100 (100%), exit 0. Same ten seeded uniform ten-minute
windows, two per season; absolute island start minutes below:

| Seed | Window | Start | Public payoffs | Routine payoffs | Total |
| --- | --- | --- | --- | --- | --- |
| 404 | 1 | 9821 | 0/10 | 10/10 | 10/10 |
| 404 | 2 | 9554 | 0/10 | 10/10 | 10/10 |
| 405 | 1 | 9012 | 0/10 | 10/10 | 10/10 |
| 405 | 2 | 3826 | 0/10 | 10/10 | 10/10 |
| 406 | 1 | 9092 | 0/10 | 10/10 | 10/10 |
| 406 | 2 | 16819 | 0/10 | 10/10 | 10/10 |
| 407 | 1 | 9173 | 0/10 | 10/10 | 10/10 |
| 407 | 2 | 11092 | 0/10 | 10/10 | 10/10 |
| 408 | 1 | 9254 | 0/10 | 10/10 | 10/10 |
| 408 | 2 | 5365 | 0/10 | 10/10 | 10/10 |

`SIM2="$PWD/sim2" node style/city/tools/directorcheck.mjs` first runs eleven
child-process faults, all exit 1 for their intended property. The seven existing
production-source mutations are unchanged: missing-fight, cut-rate, hooded-cut,
hooded-caption, early-record, future-day, short-setup. Four new observation faults
plant, in memory: early-closeup (29.4 seconds), changed-loop (C1-4 changes the
loop at thirty seconds), missing-establishing (only a held close-up is observed),
unstaged-window (a ten-minute window with all payoff marks absent). Each new
fault's first error must be its intended timing, loop, establishing-view or 70%
property. Clean probes also reject the three invalid close-ups and credit a
typed public arrival. Sources/fixtures are never left faulted.

The clean run then verifies seeds 404–408: 70 shows, 85 fights, 47 arrests,
457 cuts, 65 hooded scene cuts, 33 named old-replay overlays; all night
properties pass with the same counts as the baseline. Existing synthetic
probes still verify announcements and held arrival payoffs, sit-downs, releases,
out-loud, D=0, owner/repetition scores, reset and strict D6 boundaries. Prefix
equality, poisoned future payloads and forbidden words getters still pass.

Regenerated fixtures with `node core/bench/runner.mjs --seed 404 --rule A --cast
layer4 --feed --out core/runs` (405–408 likewise; ignored output). Only
directorcheck was run in this follow-up, before and after; no network or model
run. Logs: `/tmp/C1-8a-followup-before.log`, `/tmp/C1-8a-followup-after.log`.
The orchestrator still runs the full broadcastcheck with its own port.

Page work remains with the camera builder: shots/framing, stage-mark close-ups,
TV first visit, 60 s attract, input hand-back, camera return, 80% staged in view,
20 input trials and screenshots. Public trip arrival announcements are an
optional caller seam; the record has no core-owned travel. C1-6's documented
coarse board-at-close reveal limitation and count-only attack scenes persist.
Brain write-back is outside this task's writable/new-file boundary; this handoff
records the durable findings for the orchestrator's capture.
