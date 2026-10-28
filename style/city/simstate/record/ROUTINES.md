# C1-4: the public day (logic seam)

```js
import { createRoutinePlanner } from './routines.js';
import { targetsAt } from './placement.js';

const routines = createRoutinePlanner(frames); // the worker's public feed
const rows = routines.at(player.minute);
const plan = routines.day(day, player.minute);
const targets = targetsAt(player.snapshot(), player.minute, routines);
```

Use the existing player's minute. The planner uses C1-2's reducer and `revealAt`,
and does not advance a clock, plan a route, or decide a game result. Without the
third argument, placement retains C1-3's home/corner fallback. The visual builder
must pass this planner to use routines; no store schema or page wiring changed.

`at(minute)` returns one current entry per known roster id, in roster order:

```js
{ agent, minute, place, act, role, walk, loopSeed, source,
  meet?, cut?, scenePlace?, lineEvent? }
// place: { corePlace, cityPlace, district, standPlace, lot, ...tableMetadata }
// source: { kind: 'routine'|'public-act'|'meet'|'resume'|'corner', eventId? }
```

`minute` is an absolute island minute, the entry's start. An entry applies until
the next entry for that agent. It has no future-derived end time. `loopSeed` is
a deterministic variant/desynchronisation seed, from the public season seed,
agent id, minute and act; the drawing must not replace it with ambient randomness.
`place` uses the C1-3 place/address tables; `routine-places.js` adds the three
meeting scene anchors using the same city export and measured exteriors.

`day(day, asOf = day*1440+1260)` returns `{day, asOf, entries, meetings, bubbles}`.
The default runs from 06:00 to 21:00; an explicit `asOf` can include the remaining
day loops up to the 21:05 show boundary. It is the observed schedule, not a forecast
of future public errands. Equal-minute entries retain their per-agent insertion
order. Use `at` for the current state and the cue arrays for transient events;
two consecutive cuts can share a minute. Querying backwards returns the same
prefix, including after previously querying the entire archive.

Loop roles: `deal`, `work`, `patrol`, `hang` match life.js; `cook`, `bench`, `meet`
are the new drawing roles. Acts include `gather`/`prepare` for Smugglers, `cook`,
`craft`, `deal`, `patrol`, `hang`, `yard`, and public `fit`, `crew`, `housing`,
`release`, `high`, `outloud`. Roles always name a playable loop, including at
home and in the yard. No clip, pose, movement mode or NPC victim is selected here.
Visible walk families are passed only outdoors; drug names are never consulted.

Meetings: `{eventId, sitdown, a, b, minute, published, minimum, venue, place, cut:true, reason}`.
The venue is dealt by sorted pair ids, independently of the seed or private words.
Every staged pair gets **five island minutes minimum** (`MEET_MINUTES = 5`):
five minutes live, 30 seconds at 10x, or five seconds at 60x. This is presentation time, never a rule or
a change to the feed's `published` minute. Both schedules start together at the
cue's `minute`, with an arrival cut and no invented earlier walk.

Meets sharing an actor queue in feed order, including across frames at the same
minute. A pair starts only when both actors have served earlier minimums;
unrelated pairs can overlap. That publication minute's other public rows follow
its meets, and later acts wait for earlier queued pairs too. Once its minimum
has elapsed, a pair stays seated until either actor's next staged public act,
another meeting, or the 21:05 boundary. Routine ticks never interrupt it.
If the remaining day cannot fit a queued minimum, a paired `day-end` cut cue
records the omitted interval explicitly. A jailed participant's street place
stays Iron Island: both entries' `scenePlace` and cut cue name the common set.
A fresh public meet stages a lasting sit-down again on each day both act;
`close` and its delayed words never drive today's movement.

The queue contains only already published acts. Rows and cues are appended only
when the existing player minute reaches their staging time; none is prewritten
with a future board or later-derived end. Reverse seeks and fresh cut feeds
therefore return identical prefixes, including while a pair is still waiting.

Bubbles: `{agent, minute, line, eventId, place}`. Every current-day public
`outloud` is cued once at its speaker's then place. Never use `say`, crew `chat`,
memory, `terms.who`, or board line snapshots for live bubbles or destinations.
Private disclosures, even once available, do not drive routines. Past shows
contribute only their public `seen` districts, using the previous three shows.
A Smuggler visits a drop only after a past show publicly saw it there. A night
hustle supplies a familiar district; no honest shift or tonight's crime is
inferred from it. Lock-time routines continue without revealing tonight's play.
Speech cues retain the feed's publication minute at the speaker's current place;
only the corresponding movement row waits behind queued meeting minimums.

`node style/city/tools/meetcheck.mjs` measures intervals returned by `at`, rather
than counting rows that can overwrite each other. On the untouched planner it
failed seed 404: **43/126 meets had zero duration**, including 3465 and 3690.
It checks every meet on seeds 404–406 for the original one-minute paired interval or an
explicit day-end cut, per-actor feed order, and fresh/guarded/reverse prefixes at
frame, row and fractional staging boundaries. Synthetic cases cover shared
partners, queued public rows, jailed scene cuts and the day boundary. In-memory
controls restore zero minimums and read a later frame; both must fail.
Measured 2026-10-27 against the captured one-minute baseline, seeds 404/405/406
still stage 126/123/129 meets, all paired throughout the five-minute minimum.
Maximum push of any queued public row is **4/4/4 → 20/20/20 island minutes**;
meeting-only maxima are **4/3/4 → 20/15/20**. The extra baseline minute on seed
405 is a board-driven fit row. Day-end cuts are **0/0/0 → 0/0/0**, and no queued
row passes its day's 21:05 boundary before or after. The queue rule is unchanged.
Seed 404's three a18 meets, published at 3465, start at **3465/3466/3467 →
3465/3470/3475**. Meet 83 (a09 + a18) occupies at least [3470,3475); the unchanged
scenario's two-minutes-in sample is now 3472, with both rows at the diner.
A18's next row is meet 84 at 3475. No browser scenario or sampling was changed.

Reproduce with `node tmp/c1-fixes-audit.mjs`; captured sources, before/after logs
and detailed results are under `tmp/c1-fixes-*`. The audit observes each queued
job's publication and staging times, including board-driven rows without an
event id, and checks each paired interval at its start, midpoint and just before
its minimum ends. The unchanged `meetcheck.mjs` still pins `MINIMUM = 1`, exact
one-minute synthetic times and a literal one-minute mutation site. It cannot
validate this five-minute contract; changing that existing check is outside this
task's authorization. The required gate outputs are retained under `tmp/`.

`node style/city/tools/routinecheck.mjs` first rejects in-memory planted faults
(early night-show read, missing meeting partner, random planner call), then
checks seeds 404–406 minute by minute, fresh cut feeds, reverse seeks, day prefixes,
meet pairing, complete loop coverage and forbidden payload getters. Its zero
unassigned loop seconds is a schedule measure. Rendered standing time, bubbles,
paired poses, travel/cuts and visual QA belong to the next drawing job.
