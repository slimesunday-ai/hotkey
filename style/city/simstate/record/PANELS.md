# C1-11 logic handoff — 2026-10-27

**Timing follow-up resolved — 2026-10-27.** slime: "go with our suggestions".
GAME.md §19 and §41 (C1 lane `53c0dd5`) settle disclosure in island half-days,
as the core already supplies it. The drug-name property now follows that rule
and actual feed publication. This follow-up changes only `panelcheck.mjs` and
this handoff; the selectors and all other properties/mutations are unchanged.
No commit was made. Visual integration remains open below.

## UI seam

```js
import { panelsAt, peopleAt, replaySideAt } from './panel-data.js';
const panels = panelsAt(sim.record(), agentId);
const roster = peopleAt(sim.record());
const side = replaySideAt(replayPlayer.snapshot(), retainedViewingHorizon, agentId);
```

All selectors accept a **presented** `sim.record()` / player snapshot, not
`sim.events()`'s compatibility clock or an archive's final board. The optional
last argument is the current island minute. A snapshot newer than that minute
is rejected. Seeking belongs to C1-2/C1-6. Treat inputs and returned cached rows
as read-only; each new snapshot has its own wording cache.

`panelsAt` returns `{frame,minute,card,rap,bounties,people,tape,home,leaders,map,news}`.
Named exports also provide `cardAt`, `rapAt`, `bountiesAt`, `tapeAt`, `homeAt`,
`leadersAt`, `mapAt`, `newsAt`. No selector fetches data or reads an owner view.
The store contract is **`../STORE.md`**, not `record/STORE.md`.

| Panel | Values and source |
|---|---|
| `card` | Public board `id,name,trade,driver,crew,heat,wanted,jailed,bail,evicted,tab,boarded,walk,fit,fitHidden`, plus `home` and today's last public out-loud words (`lastSay`). A hidden fit stays null; no holdings receipt fills it in. A missing agent returns null. |
| `rap` | Newest first, every public event whose typed roles name this agent. Show roles come from `seen`, never missing roster ids. Public card subjects remain the public subjects when their enclosing receipt becomes a full record. |
| `bounties` | Only explicit `board.bounties[].agent` targets, through C1-10's target-only allow-list. No poster or inferred copy holder. |
| `people` | Dossier `{crew,public,record,sources}`. Crew comes from the board; each tie is `{agent,eventId,type,minute}`, from typed participant roles. `peopleAt(snapshot)` without an id returns the public roster cards. No trust or deal scores. |
| `tape` | `{asOf,pending,events,holdings,memory,sources}`. Events are disclosed private receipts naming the agent. Holdings is the last exact holdings row, never advanced; crew stash/pieces/goods are preserved. Memory is the complete disclosed `board.memories` snapshot with `asOfDay/asOfClock`, plan routes, standing orders, Creed and `{day,line}` journal. Historical pre-CLEAR events remain. |
| `home` | `{address,evicted,sources}`. The complete C1-3 address book row is presentation, derived from public roster ids. Eviction comes from the board; the assigned address is not a tenancy claim. |
| `leaders` | `{heat,crews,sources}`: exact public heat values and crew memberships, sorted by heat and membership length. No Most Wanted crime ladder, Drip, wealth appraisal or survival timer. |
| `map` | City-export `places`, district anchors with exact `board.police/tonight` levels, board corners with C1-3 anchors, public wanted posters. No station-cop count. |

Each receipt/news row is
`{id,type,t,day,minute,scope,fields,subjects,text,parts,paths,source}`.
`t` is the original core half-day; `minute` is publication, not an invented
occurrence time. `fields` has a per-kind allow-list, including nested speech
terms, payments/hand-overs, actual work outputs, theft haul versus mark,
memory, order returns/fills and `orders.of`'s feed-local ids. Private deal
state/paid/owed projections are excluded; public rent tab amounts remain.
Source maps name board paths; receipt sources are `{eventId,minute}`.

`news` is `{live:[story],record:[story]}`. Ticker and CH 9 share each story's
`ticker` / `ch9` generated text, with a presentation `weight` and typed `where`.
Select the desired span in the UI; `record` must wear its disclosed-record badge.
Do not run the old `feed.js.textOf` or old privacy lens on these rows.
Every supported public kind has words, including quiet kinds and variants;
delayed receipts also have words for the record segment. Examples:

* `penny (@a01) hustles in downtown for $60 · method: stickup.`
* `The breakin fight breaks out in suburbs. The attack wins.` (a target, when supplied, is named instead).
* `dash (@a06) acts on standing orders: pay · refused.` (synthetic attribution example).

`parts` contains literal city copy plus `{text,value,source:{eventId,path}}`.
A person part adds `nameSource:{agent,path:'board.agents[].name'}` for its
display-name join. Render as text, never HTML. No prose is parsed for facts.
Free words are only feed-authorized `line`, `reason`, crew names, Creed and
journal lines. Show/fight lines do not name an attacking side. Public arrest
identities and typed public card subjects retain their own core authorization;
neither is joined back to name a hooded fight participant. A masked card never
borrows its receipt's leader. No drug fact is obtained from a walk.

`replaySideAt` delegates C1-9's literal **strictly more than 1,440 minutes**
gate and actual source disclosure to `recordSideAt`, then formats its selected
receipts. Its names stay separate from live show/fight rows. The dossier's
ordinary `tapeAt` follows the core's feed disclosure under §19's half-day counting.
Only the check computes expected disclosure boundaries; panels never do.

No source means omitted: loans, station cops, death/hospital/sober histories,
Drip, titles, owner budgets and `me.fight/run/hustle` or deal status. The board,
morning cards and tape markers keep their C1-10/C1-9 owners; no second model of
those values is introduced here.

## Verification

Generated with `node core/bench/runner.mjs --seed <s> --rule A --cast layer4
--feed --out core/runs`, seeds 404–406: 3,221 / 3,282 / 3,238 events.
No models, browser or ports. Run:

```sh
SIM2="$PWD/sim2" node style/city/tools/panelcheck.mjs
```

The gate first requires six faulty modules in child processes to exit 1:
`event-text` (words copied from event prose), `early-record` (an undisclosed
memory row), `hooded-name` (an attacker named in a fight line), `drug-at-high`
(a take named at the high's own minute), `drug-before-disclosure` (a take named
one minute before its half-day boundary), and `drug-future-frame` (a naming
event read from a frame after the playhead, even after the half-day boundary).
Production modules are never changed. Each is also runnable with `--fault <name>`.

Then all three seeds pass feed-source equality, publication/cue boundaries,
all disclosed forms, field allow-lists, source words, board values, public
subjects, nested terms/holdings/memories, repeat/reverse/fresh seeks and
no-seat/deal projections. Positive probes cover absent public kinds, named-drug
fields on a public walk, hidden memory, CLEAR/dawn journals, attributed play and
standing orders, placed/filled/returned orders, bounty anonymity, forbidden
getters, RNG and C1-9's strict replay boundary.

| Seed | Frames | Minutes/cues | News forms checked | Dossier observations | Event kinds |
|---|---:|---:|---:|---:|---:|
| 404 | 242 | 2,166 | 3,255 | 4,080 | 57 |
| 405 | 251 | 2,114 | 3,314 | 3,999 | 57 |
| 406 | 237 | 2,126 | 3,269 | 4,040 | 59 |

The half-day drug-name property **passes** for every take, including those
without a public high. It checks the dossier and both news scopes at the
boundary minus one minute, just before/equal/after the boundary, actual
publication edges and each uniquely matched high's own minute. Synthetic day
and night cases cover publication exactly at the next dawn/lock and publication
withheld five minutes longer: crossing the boundary alone never names a drug.

| Seed | Takes | Boundary probes | Unique high witnesses | Witness gaps |
|---|---:|---:|---:|---|
| 404 | 7 | 30 | 3 | 765 / 1,215 minutes |
| 405 | 9 | 43 | 7 | 765 / 1,215 minutes |
| 406 | 4 | 16 | 0 | none |

The previous ten literal-1,440-minute failures become **zero half-day timing
violations**. The 20 takes and 89 boundary probes pass, as do every unchanged
property and all six planted-fault exits. Final log:
`/tmp/c1-11a-panelcheck-halfday.log`. Only panelcheck is rerun in this follow-up.

The original C1-11a handoff recorded the following prior checks (not rerun here),
each with `SIM2="$PWD/sim2"` and exit 0:
`node style/city/tools/{seekcheck,boardcheck,showcheck,recordcheck,placecheck,routinecheck,clockcheck,robustcheck}.mjs`
(the braces enumerate separate commands). Logs:
`/tmp/c1-11a-{seekcheck,boardcheck,showcheck,recordcheck,placecheck,routinecheck,clockcheck,robustcheck}.log`.
Robustcheck used its documented `THREE_DIR` override at
`<a local folder of Three modules>`;
10 checks passed with local Three modules, without a download.

## Open producer/seam items — no upstream edits

1. **Resolved: disclosure timing belongs to the core.** slime, 10-27:
   "go with our suggestions". GAME.md §19's "How '24 hours' counts" and §41
   (C1 lane `53c0dd5`) say that a day's event comes out at the next dawn and
   a night's at the next lock. The core already discloses this way; no core
   change or extra city delay is needed. The check computes the boundary from
   the event's typed half-day and the island's 06:00 dawn / 21:00 lock, while
   the panel/news readers only use published feed fields at the playhead.
   Seed 404 `high` id 2399,
   `agent:a17,t:24,minute:18315`, and the unique matching `take` id 2639,
   `drug:temp,minute:19080`: only **765 minutes**. The core emits a take and its
   changed public walk in the same action (`core/rules/errand.mjs:758–761`).
   This matching is evidence in the check, not a city rule for deriving drugs.
   The other witnessed gaps are 765 or 1,215 minutes. The feed's `minute` stamps
   publication, and `t` only a half-day (`core/feed.mjs:24–43`); it cannot supply
   the precise occurrence minute for every private event. The former ten
   failures (3 / 7 / 0) are valid under the settled half-day rule; the new
   timing measurement above passes without changing any selector.
2. **Future show duration leaks through C1-6's navigation list.** Reproduced
   at minute 1800, seed 404: night 3 `shows()` reports `end:5600`; changing only
   that future show's `hooded` to `{}` changes it to `5588` (`player.js:15–16`).
   These selectors never consult that navigation list.
3. **Placement still uses a fixed 15-minute show.** At 2708.1, after seed 404
   night 1's actual close, the staged player returns `show:null` while
   `targetsAt` returns 30 targets with `source.kind:'show'`
   (`placement.js:18–21`). The UI builder must use C1-6's actual close.
4. Visual integration/DOM/screenshots remain the next builder's job. The new
   selectors do not wire or alter the existing panels.

Durable handoff capture: the measured C1-11 seam and these owner findings are
recorded here for review/promotion to the external brain. This sandbox allows
writes only in the worktree and temporary directories, not that vault.

## Demo wording follow-up — 2026-10-27

Counted labels use the typed numeric value: exactly `1` selects the singular;
zero and all other counts select the plural. This covers nights, heat stars,
arrest stars, batches, chems, parts, guns, lockpicks, warrants, fakes, doses and
copies, including market units and shared goods/output quantities. Numbers
remain unchanged sourced parts. Known item nouns are literal city copy selected
by the typed `item` enum and `units`; `paths` retains `item`. Unknown item names
and drug names remain verbatim. No event prose is read or parsed.

**Zero heat is a change, not a nightly status reminder.** The only core `heat`
emission is `core/rules/night.mjs:201`: it requires `a.heat !== was` and publishes
`{agent,heat,was,wanted}` to everyone. Its preceding calculation cools heat on a
night without crime. At zero, the agent has cooled from positive heat to none.
Arrest clears heat separately (`night.mjs:727`) and emits `arrest`, not `heat`.
`core/feed.mjs:24–36` publishes the changed authorized event form with its local
id and publication minute. Keep these stories live and in the public record:
`carries 0 heat stars.` → `drops from 1 heat star to 0 heat stars.`
The previous count is a sourced `was` part, not a reconstructed board value.

Feed witnesses (`core/runs/<seed>-A/feed.jsonl`, one-based line):

| Seed | Line / frame | Event id | Agent | t / minute | was → heat |
|---|---|---:|---|---|---|
| 404 | 31 / 30 | 362 | a27 (rue) | 7 / 5580 | 1 → 0 |
| 405 | 85 / 84 | 1017 | a27 (rue) | 13 / 9900 | 1 → 0 |
| 406 | 20 / 19 | 167 | a03 (mo) | 5 / 4140 | 1 → 0 |

Seeds 404/405/406 contain 251/251/268 heat rows, of which 65/64/67 reach zero.
All 196 zero rows have positive `was`; no heat row is unchanged. This copy does
not claim that a drug wore off or that an arrest caused the change.

Other grammar oddities found and corrected on these seeds:

| Old | New |
|---|---|
| `1 heat stars`, `1 stars`, `1 batches` | `1 heat star`, `1 star`, `1 batch` |
| `1 chems/parts/guns/warrants/doses` | `1 chem/part/gun/warrant/dose` in every counted context |
| `chems/parts/doses costs …` | `chems/parts/doses cost …` |
| `hustles stickup in downtown for $60` | `hustles in downtown for $60 · method: stickup` (all methods retain their names) |
| `brings back · …`, `builds · …`, `uses · …` | `brings back …`, `builds …`, `uses …` |
| `says offer to … · trade: ` | `speaks to … · offer · trade` (no dangling colon on an empty line) |
| `says promise to … · back: <line>` | `speaks to … · promise · back: <line>` (nonempty speech unchanged) |
| `loses a seizure · fine … · vault …` | `gets a seizure receipt · fine … · vault …` (also valid for zero seizure amounts) |
| `fills a buy: …` | `fills a buy order: …` |
| `vault loses …` | `The vault loses …` |

Typed action labels such as `breakin`, `crew form`, `back`, `walk`, and the walk
label `spaced` stay verbatim; rewriting these names or supplied speech/reasons
would exceed grammar. No selector, fact, name, scope, weight or timing changed.

Reproduce the complete census with `node tmp/panel-wording.mjs`; its output is
`tmp/panel-wording.log`. It imports the before module from HEAD, visits every
published form with that frame's board, and groups by literal parts plus typed
source paths, with each before/after branch pair and one feed example. Results:
9,803 forms, 127 before / 161 after templates, 161 pairs, 2,279 changed forms,
zero field/scope/subject changes. Extra 0/1/2 probes cover nouns absent from the
seeds, including copy/copies, lockpick/lockpicks and fake/fakes.

Fresh fixtures: `node core/bench/runner.mjs --seed <seed> --rule A --cast layer4
--feed --out core/runs`, for 404–406, produce 3,221/3,282/3,238 events and
242/251/237 feed lines. No feeds are committed. Verification commands and full
outputs are in `tmp/{panelcheck,recordcheck,boardcheck}.log`, each run with
`SIM2="$PWD/sim2" node style/city/tools/<name>.mjs`. No check was edited.
All three exited 0. Their last lines are:

* `PANELCHECK PASS: all feed values at/before playhead; disclosed record only; no seat/deal projections; no hooded fight names; half-day drug disclosure.`
* `RECORDCHECK PASS`
* `boardcheck PASS: feed equality, as-of shipment announcements, dawn-only typed cards, stable Replay, anonymous bounties and masked pictures`

This section is the durable handoff capture for external-brain promotion under
the same sandbox restriction described above. No commit was made.
