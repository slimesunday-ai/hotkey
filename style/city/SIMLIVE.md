# SIM LIVE: the city draws the running sim

`?sim=live` points the city at the sim's own state (`GET /state` from `sim2/server.mjs`, or a recorded run through `tools/simreplay.mjs`). It shows what the sim is doing right now:
- **homes:** lights, zzz, FOR RENT, security and scars
- **supply piles:** sized by each site's bank
- **dealing-corner hotspots:** heat from sales and price
- **patrol cars**
- **the sim's own agents:** walking the sidewalks, standing at their places, jailed on Iron Island

Day and night follow the sim's clock. Without `?sim`, and with `?sim=demo`, nothing changes: the pixels are identical to before this pass (checked A/B).

**Live is the full city.** Nothing in the city branches on `?sim`: the same quality preset, streaming tiers, walkers (count, tiers, the fresh cast, fine paint), traffic, signage, lighting, props and load-in as without it. The sim only adds its layer on top. Checked 2026-10-05 (`shots/live-check/`): the same three views, normal against live (replay, public view) against demo, show the same detail.

## Run it

The page server must be running: `node style/serve.mjs 5320`.

**With the sim.** The sim session starts its server (`node sim2/server.mjs …`; it calls model APIs, so it is never started from here). It serves `http://127.0.0.1:5251/state`. Then open:

    http://127.0.0.1:5320/style/city/?sim=live                  (the sim's default port, 5251)
    http://127.0.0.1:5320/style/city/?sim=live&simport=5259     (a sim started with --port 5259)

**With a recorded run (no sim, no cost).**

    node style/city/tools/simreplay.mjs [run] [--port 5262] [--speed 1] [--from "D2 22:00"] [--loop] [--for 900]
    http://127.0.0.1:5320/style/city/?sim=live&simport=5262

- **`run`:** a directory under the repository’s `sim2/runs/` output folder, as a full path or its stamp. The default is the latest real run with at least two snapshots; names containing `-dry` are skipped. It only reads the run.
- **`--port`:** 5262 by default, never 5251 (the sim session may be serving there). 5261 is held by an unrelated static server on this machine (`nocache_server.py`), so the default moved to 5262. If a port is taken, the tool says so and exits; pass another with `--port`.
- **`--speed`:** a multiplier of the run's own pace (`meta.json` `day`, in real minutes per game day). `0` pauses.
- **`--view`:** `public` (the default since the human layer, 2026-10-07) serves what the sim's own `/state` gives viewers (see "The public view" below); `full` serves the recorded snapshots as they are. `/state?view=public|full|owner|director` overrides it per request. The replay also serves the owner view, the director's cut, `/tape`, `/events` and `--archive`: see `simstate/STORE.md`.
- **Endpoints:** `GET /seek?t=<minutes or "D2 22:00">` and `GET /speed?x=` steer it; `GET /` reports where it is.
- **Between snapshots.** The run records one snapshot per game hour. Between two, the served state is the earlier snapshot advanced minute by minute by the events log: trips, arrivals, sleep and waking, arrests and releases, hospital, deaths, activities, homes bought, security installed, burglaries, raids, evictions, corner sales and rushes. Checked against the next snapshot: 639 of 640 agents matched. The odd one was arrested on the hour.

**Page parameters**

| Parameter | What it does |
|---|---|
| `simport` | The port (default 5251). |
| `simurl` | A whole URL instead of the port. |
| `simpoll` | ms between polls (default 1000). |
| `simbudget` | ms per frame for layer redraws (default 2). |
| `simtod=0` | Keep the page's own `?tod` instead of following the sim's clock. |
| `bench=1` | Adds a SIM LIVE line under the bench results. |
| `delay` | The broadcast delay in seconds for this page (default 15, or Settings → Broadcast). `delay=0`: no delay, the page as before. A tool that moves the replay and reads the page at once (a seek forward, `pollNow()`) wants `delay=0`. |

**Stand spots.** `node style/city/simstate/stands.mjs` writes `simstate/stands.json` from the blocks' own audit builds (about 70 s). Re-run it whenever a kit changes the ground round a sim place, or a spot could stand inside a new prop.
- **Kinds (W8, 2026-10-08):** every spot is `wall` (a building's flat wall in reach: `lean`, 0.2 m off it), `stoop` (a 0.15–0.35 m ledge: `sit`), `bench` (a seat on one of the city's benches, the spot raised 0.1 m), `corner` (within 9 m of a corner's crossing) or `open`.
- **Room to move:** `pace` (deal_pace's strip, 1.15 m ahead with the street on the walker's +x), `beat` (one or two ends, up to 4.5 m, along the kerb or round the pile) and `st` (the yaw facing the street). Every path is checked with a walker's discs, 0.8 m off every lane and clear of every other spot and path.
- **Wider look:** a place that finds fewer than 5 spots looks again further out (`STAND.wide`). That is how Grand & 1st, the precinct and the Hall of Justice got theirs.

**In the console**
- `__simlive`: `.bench()`, `.benchLine()`, `.agents.stats()`, `.agents.list()`, `.agents.life.stats()` (what each standing agent is doing now, the loops played, the per-frame cost), `.layer.liveStats()`, `.info`
- `__city.simInfo`
- `__city.tick(dt, n)`: frames where `requestAnimationFrame` doesn't run, such as hidden headless tabs.

## How it works

**The feed** (`simstate/feed.js`, in a worker: `feedworker.js`)
- Polls `/state` once a second, parses it and adapts it (`adapter.js adaptLive`), off the main thread.
- Sends the page only what changed: a signature of exactly what the layer draws per home, pile and corner. The agents go every time (they are small).
- **When the sim doesn't answer**, the last state stays and a small red **SIM OFFLINE · retrying in N s** badge shows (`#simbadge`), counting down to the next try. It retries after 1, 2, 4, 8, 16 and then every 30 s, and the badge goes when the sim answers again. Meanwhile every LIVE badge of the human layer says OFFLINE (grey, still) and the store's clock stands at the last state (`ui/kit.js` simOffline).

**The layer** (`layer.js`, live mode)
- Draws exactly what the demo draws, per group:
  - one home: a parcel, or a building's units and, apart, its street door (a doorman lobby is never re-stamped for a light)
  - a site's piles
  - a corner's hotspot
- Every group is a slot in **one BatchedMesh**, reserved half as big again. A redraw uploads only that slot, and all the sim state is one draw call.
- A poll's changes are redrawn within 2 ms a frame.
- A block that leaves the view and comes back just hides and shows its groups; only what changed is redrawn.

**The agents** (`agents.js`, driving `pedsim.js`)
- **At a place** they stand at one of its stand spots. A spot touches no prop or person, stays 0.95 m from every walker lane, and has its own straight, clear step to a lane point. Homes, shops, the precinct, St. Mercy, and any place whose spots are all taken count as indoors: the agent is not drawn, and a home's lights say who is in.
- **Leaving**, an agent walks up to 1 m short of its lane point, off every lane, and waits there for a gap in the walkers. Then it takes the point and steps on.
- **Arriving**, it halts at the point (the walkers behind keep their gap) and steps off to its spot.
- **On a trip** it walks the one-way sidewalk graph from place to place. It leaves at `dep` and aims for `arr` at 1.1 to 2.6 m/s, following walkers like anyone, never overtaking. The sim's trips are faster than walking at any live pace (25 m per game minute; about 50 m/s at the default 1 day per 12 min). A walker that falls 30 m behind the sim's clock is moved on only where nobody sees it: off screen, or beyond the mid tier.
- **Not walked:** a taxi ride, and a trip with no sidewalk (the woods, the labs, Iron Island over the bridge). The agent is gone for the ride and walks up from the lane on arrival.
- **Jailed:** standing in the yard on Iron Island (the jail kit's `place: 'jail'` block, never the corridor outside it), in the county jumpsuit like the yard's own inmates.
- **Asleep:** indoors.
- **In hospital, or dead:** not drawn.
- **City life (W8, `life.js`):** nobody stands still. Each standing agent runs a small plan of the authored loops (by name, so a clip that isn't synced yet falls back) and short walks, chosen by its act and its spot:
  - **deal:** deal_pace on its strip (started at t 0, stopped only at a wrap) mixed with deal_lookout, now and then a lean at a wall.
  - **patrol:** walks its beat along the kerb (patrol_walk once it exists), stops, looks, walks back past the spot.
  - **gather, craft, work:** shuttles along the pile and works at each end (dig_pick, dig_shovel, stock_shelf, sweep, carry_box once they exist; until then a stop facing the pile).
  - **wait, hanging out, the yard:** sit_bench, sit_stoop, lean_wall, deal_lookout, the walkers' own idles, sometimes a stroll along the beat.
  - **Clean switches:** a loop changes only at its wrap, and each agent starts after its own random wait, so a corner never moves in sync.
  - **Social:** a public `say` turns the speaker and the one it talks to (the last other speaker there, else the nearest within 7 m) to face each other for 6–9 s (talk_gesture and listen_nod once they exist). Crews claim spots next to their crew-mates; a dealer prefers a spot with a pace strip, a cop or a worker one with a beat, half of those hanging out a bench, a stoop or a wall.
  - **Travel wins:** the moment the walker leaves its spot (a trip leg, a step on, the stage's hold) life lets go and forgets its plan; stepping on starts from wherever life had it. `?life=0` turns it off.
- **Looks:** the cast's own look for `look` 0–11 (`world/chars.js LOOKS`, the same cast in the same order), wearing its bought traits. The Locals and later handles get a look rolled from their handle. Each look is baked in its own worker (`lookjob.js`) and appended to the walkers' batches.

**The clock.** The page is built for day or night (`TOD.night`). When the sim's night and the page's differ for two polls, the page reloads into the sim's, keeping the camera. It never reloads twice within 15 s, and never in a shot. The reload drops a link's one-time openers (`tape`, `tapeat`, `tapeagent`, `tapeplay`, `people`, `home`) and keeps what the viewer has open: the dossier, the follow, the City / TV panel, the map or People, the heat map and TAPE come back on the new page (`ui/reload.js`, sessionStorage; the follow camera's zoom and pitch are its own, in localStorage). TAPE holds this reload off. Instead, while the tape's time of day isn't the build's, the build is graded toward it (`render/grade.js`, `render/LIGHTING.md`). A chip over the transport, **Light it as night / day (~N s)** (`ui/light.js`), reloads into the matching build: TAPE comes back at its minute with its speed and play state, plus the dossier, the follow, the panel and the heat map. The new page holds this reload off until TAPE is back.

**The broadcast delay (TV plan A1, 2026-10-09).** The map shows the sim **D seconds late**, 15 s by default (`?delay=`, Settings → Broadcast; 0 is the page as before). `simstate/broadcast.js` holds each diff from the feed worker D s and then hands it to `onDiff`'s old body: the layer, the walkers, the clock and the reload all run on the released stream. The store (`simstate/STORE.md`, "The broadcast delay") does the same in step, so the ticker, CH 9 and the stage are on the same time as the walkers.
- **In order, on a timer** and on every arrival, so a hidden tab never releases a burst. Diffs due together are folded into one (homes, piles and corners by id).
- **The clock** (`simclock.js`) is unchanged: it fits the released stream. `tools/clockcheck.mjs` runs the line on a simulated page timer: 0 frames backward in all 9 delay scenarios; |err| against the sim's time D s earlier p95 0.045–0.062 game min where the sim runs steadily (0.05 without the delay); the line adds at most 0.013 p95 against the same scenario without it, through a pause and a speed-up.
- **Joining:** the first diff at once, then 0.8× until D behind. The 0.8 → 1× step at the end of that ramp is a pace change the clock settles like any other: about 0.6 game min off (p95 0.62) for a minute or two (`speedUp` at D = 0: 1.0). A server with `GET /state?lag=` (the replay) lets the feed backfill the line on joining: D behind from the first frame, no ramp. The dusk/dawn reload is a join.
- **The sim going back** (a loop, a seek back, a restart) flushes the queue into the new diff, released at once, and the ramp starts again.
- Measured on the page (my replay of 10-09T12-43-05 dry, D1 11:40 → 12:16 at 1×, a seen robbery at Grand & 1st): D = 0 and D = 15 aired the same 20 events and staged the same (robSeen 1; aftermath deal 3, burglary 1; skipped robUnseen 1); frames 16.7 p50, 16.8 p95, 16.8 max at both. The robbery aired 15.25 s later at D = 15, and the stage started it 0.02 s after the store released it. `shots/broadcast/`.

## The field mapping

`adapter.js` is the only file that reads the sim's names. It logs an unknown field once and ignores it. A missing or malformed one is logged once and defaulted.

| Sim field | What the map does with it |
|---|---|
| `t` (game minutes) | The clock, with night from 20:00 to 06:00 (`rules.mjs TIME`). It sets the page's day or night and the trip timing. It comes in whole minutes and says nothing of the pace, so the page fits a line to the polls and runs the movement on a clock that follows it and never goes backward (`simstate/simclock.js`, MOVEMENT.md §1). |
| `ts` | Shown in `simInfo`. |
| `running` | When false, the clock stops and the agents stroll. |
| `agents[].handle` | The walker's id. |
| `agents[].look` | The cast look (0–11), otherwise a look rolled from the handle: the Locals (`npc`) and handles with look ≥ 100. |
| `agents[].wear` | Worn traits. Slots map hat→hat, eyes→eyewear, top→top, feet→shoes, neck→neck, mouth→mouth, wrist→acc, bag→held; the trait ids are the fit-check's. |
| `agents[].status` | `active` or `busy`: at a place, or on a trip. `asleep`: indoors. `jail`: Iron Island. `hospital` or `dead`: not drawn. |
| `agents[].at` | A place or lot id: stand there, or go indoors. |
| `agents[].trip` | `{from, to, dep, arr, taxi}`: walked, timed to `dep`/`arr`. A taxi is not drawn. |
| `agents[].act` | `deal` at a corner feeds that corner's hotspot. |
| `agents[].wanted` | WANTED: one more patrol car each, up to six. On a full snapshot, `heat` of 75 or more counts instead. |
| `agents[].marks`, `drip` | The home cutaway's furnishing (`interiors/city/fill.js wealthOf`). |
| `lots[].id` | A lot, or a tower unit (Gatehill's anchors use the lot ids). |
| `lots[].owner` | None: FOR RENT. Owner home and awake: lights on. Owner asleep: dark with a zzz card. Owner out: dark with the curtain drawn. |
| `lots[].tier` | `estate` is drawn as a penthouse, then `house` and `trailer`; `apartment` when the sim adds it. |
| `lots[].sec` | Expiry game minutes. `lock`: lock. `door`: steel door. `alarm`: camera. `safe`: safe. `dog`: not drawn (the layer has no dog yet). |
| `lots[].scars` | `burgled` and `raided`: crime-scene tape. `boarded` (eviction): boards. `burned`, `foreclosed` and `memorial`: their pieces. Never tags. |
| `corners{}.sat` | The corner's price, 1 − 0.1 × sat with a floor of 0.25 (`rules.mjs STREET`). |
| `cityEv.rush` | `{dist, mult, until}`: that district's walkers ×2, and its hotspots at full heat. |
| `events[]` (last 150) | `gather` and a `director` spill: the pile banks. `sale`: corner sales. `list`, `market` and `fence`: the boards. |
| `loans[]` | The loan shark's open book (`boards.shark`). |

**Hotspot heat, live** = 0.25 × (demand now ÷ 10) × price + 0.3 per agent dealing there + 0.1 per sale in the last two game hours, capped at 1. A quiet corner gets a lone couch at most; one dealer selling gets the umbrella. The demo keeps its own formula.

**Pile level** = each site's bank. The snapshot doesn't carry the bank, so it is estimated: 12 each, minus every `gather` there, plus 10 for a spill, refilling 6 an hour up to 12 (`rules.mjs SITES`, `DIRECTOR.spill`). The estimate starts from the first events the page sees.

**Carried, not drawn:**
- `crews[]` and `corners{}.turf`: turf visuals are deferred (slime, 2026-09-26).
- The loan shark's book, fence sales and swap-meet listings: the layer has no pieces for them yet.

**Unused:** `pool`, `money`, `stats`, `mostWanted`, `trend`, `drop`, `inSlot`, `hires`, `news`; per agent `cls`, `model`, `budget`, `inv`, `high`, `n`, `lastThink`, `lastSay`, `localOf`, `retired`; and never read: `cash`, `heat` (only as the WANTED test on a full snapshot), a lot's `stash`, a crew's `treasury`.

## The public view (sim2/server.mjs, 2026-10-01)

`GET /state` now defaults to what viewers may see live. Agents come without `cash`, `heat` and the rest of their private side, with a `wanted` flag instead. Lots come without `stash`, crews without `treasury`, and private events (offers, whispers, tips, scams, bribes, plans …) are removed. The adapter reads it cleanly and still reads full snapshots (demo, simreplay, `view=full`). Checked over the whole replay run, hour by hour: the public view gives the same model as the full one, except the stash.

What the map loses under it:
- **The home cutaway's furnishing.** How many of the owner's slots are filled, and how rare the pieces are, came from cash plus the home's stash. The live feed never passed these on, so a live home read as broke, with about half its slots empty. Now, without them, the tier's typical money stands in (demo.json's median per tier), nudged by the security installed and the drip worn, plus the marks as before. The demo still uses its own cash and stash.
- **Patrols:** nothing lost. They only ever used the WANTED threshold.
- **Piles, hotspots and the boards:** nothing lost. `gather`, `sale`, `director`, `list`, `market` and `fence` events are public, and so are the corners, the rush and the loans.
- **Later, live only through the owner or director view:** two of the requests below, a lot's gear (7) and the motel room (9).

## What the sim doesn't expose yet that the map could show

1. **`banks`** (`g.banks`, each site's stock). The piles are estimated from events now and start wrong when the page joins mid-run.
2. **The swap-meet boards** (`g.market` listings at Sunny Acres and the Heap), buy orders (`g.bids`) and the fence's stock. The boards could show goods and prices. They need pieces from simassets too.
3. **A corner's price and crowd now.** The sim computes `priceFactor` and `demandNow`; the adapter re-derives them from `sat`, `DEMAND` and the rush.
4. **When things end:** `act.until`, and `until` for jail, hospital and sleep. The map could show "out in 2 h" at the yard gate, or a cook's timer.
5. **Where someone died.** The `death` event has `at`, the snapshot doesn't. The memorial piece is lot-bound, so it would need a street memorial too.
6. **Rough sleepers.** `asleep` away from home (`sleep` event `rough`) is drawn indoors, because walkers have no lying pose.
7. **A lot's gear** (stove, rig): a cook's setup at home. Needs a piece.
8. **Apartments:** the sim has no apartment tier. The walk-up units are anchored (`apt:` ids) but nobody can rent them.
9. **The motel room** (`a.room`): who sleeps at Motel 9.

## Walkers and closed crossings

`pedsim.js route()` now skips closed crossings (a dealing crew's corner, `E.off`), as `routeFast` always did; `route()` serves the demo's and the walk check's agents. An agent whose way crosses a crossing that a detour closes after it set off is re-routed round it. This fixes the downtown walk-check issue: an agent crossed the closed crossing at Jay & Washington into a signal post.

## Known gaps on the map's side

- **Compound interiors have no walker paths.** The Sunny Acres hangout, the Heap, the mall and Birch & 2nd sit inside compounds; the woods and the jail yard have no sidewalks. Agents walk to the nearest lane point, disappear, and appear at their spot when the sim says they arrived. Straight walk-ups are allowed up to 14 m. Tried at 55 m, only 2 of 12 hangout spots got one, at 10× the generation time, so it was dropped.
- **Crowded corners (fixed by the wider look, W8):** Grand & 1st has no free ground within 14 m; its 10 spots are 15–26 m out along the sidewalks, and none has a clear walk-up, so an arrival appears at its spot. Jay & 1st went from 2 spots to 10, Maple & Washington from 4 to 10, the Precinct from none to 6, the Hall of Justice has 4. Still indoors by design: the labs (cooking), the 24/7 Store, St. Mercy.
- **Stoops are rare:** the ledge probe finds one (Jay & 1st). The brownstones' real stoops aren't in the audit build's anchors yet, and kerb sitting in the gutter would sit in the parked cars' lane.
- **Hotspots are not walker obstacles** (open since the cleanup pass). The live mode draws them where the demo does.
- **The first time a Gatehill tower's doorman lobby is drawn** costs 12–20 ms: simassets builds and meshes the piece, with its name and number, then memoizes it. Revisits are free. Demo mode pays all 32 at once, in one frame. Building it off the main thread would need the piece built in a worker.
