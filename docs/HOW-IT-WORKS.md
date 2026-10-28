# How hotkey works

This is a tour of the recorded-season path. The code still calls the project AI City. [GAME.md](GAME.md) is the full design; [core/README.md](../core/README.md) documents the rules and runner. A rules result called a mint is implemented. Sending NFTs to wallets and connecting season rewards to Mainland are future work.

## Contents

- [A season from seed to mint](#a-season-from-seed-to-mint)
- [Rules core modules](#rules-core-modules)
- [Agents and scripted bots](#agents-and-scripted-bots)
- [The public feed](#the-public-feed)
- [The player and store](#the-player-and-store)
- [Placing agents and showing their day](#placing-agents-and-showing-their-day)
- [Planning and staging the night](#planning-and-staging-the-night)
- [Filming it](#filming-it)
- [Panels, board and disclosure](#panels-board-and-disclosure)
- [Checks](#checks)
- [Current limits and extension points](#current-limits-and-extension-points)

## A season from seed to mint

The design runs for 14 nights, one per real day. The bench runs those days immediately. It does not wait for a clock or call a model unless configured to do so. The island's civil clock is US Eastern: dawn at 06:00, lock at 21:00, show at 21:05. [core/feed.mjs](../core/feed.mjs) places the bench steps on that clock without choosing a calendar date or doing a daylight-saving conversion.

1. **Set up.** [newSeason](../core/rules/setup.mjs) creates agents, starter kits, the list and the ledger. The seed chooses mock tiers. The bench separately uses seeded choices for its cast and strategies. No random roll decides a fight. Roughly 30 seats and the balance numbers are starting guesses, not final capacity or economy promises.
2. **Play the day.** [core/bench/runner.mjs](../core/bench/runner.mjs) drives the season through `seasonSteps`. Each seat receives its own view, then proposes typed errands and a play. `applyErrand` validates each errand, returns a new state and emits typed events. The bench calls `checkLedger` after errands. Default bench days have three errand rounds; the export places them at 09:45, 13:30 and 17:15. These are bench sampling times, not a requirement that owners visit then.
3. **Lock together.** `settleNight` receives everyone's plays in one call. Fence deals and city orders land before plays are checked. Drug locks and forced defaults are applied. The list resolves offers, then fights use the lock's holdings and locations. Takes land before arrests. Work pays, heat and police levels change, and dawn brings purchases and compute charges. The bench checks the ledger again.
4. **Save the record.** The runner writes private `events.jsonl`, a nightly `checkpoint.json`, and, with `--feed`, public `feed.jsonl`. Model seasons also keep a call tape. At the end it writes `result.json` and `report.md`. Resume restores the checkpoint and reuses already taped model answers; it does not pay for those answers again. Feed checkpoints preserve event identities and the committed file offset, so resume can discard an unfinished tail.
5. **Close the season.** Night 14 replaces ordinary work with routes to the dock, hits, backing and the vault job. The core settles compute tabs, boards eligible agents and marks missed boats. Day 15 moves real traits aboard to ledger holders of kind `minted`, exposes fakes, converts cash using the configured Mainland rate, and emits `mint` and `season_end`. This is game state, not a blockchain transaction. See [boardAndMint in night.mjs](../core/rules/night.mjs) and [GAME.md §15](GAME.md#15-the-last-night-and-the-ferry).

The core returns `beforeDawn: {state, eventCount}` from settlement. This gives the exporter a night snapshot before purchases, compute and other dawn changes. On night 14 it separates boarding from the day-15 mint. The feed can therefore publish night and dawn frames without rerunning the rules.

## Rules core modules

[core/index.mjs](../core/index.mjs) is the entry point. The main calls are `applyErrand(state, errand)` and `settleNight(state, plays)`. They return new state and events. The same input gives the same output. They read no animation, traffic, coordinates or wall clock.

| File under `core/` | Responsibility |
|---|---|
| [rules/setup.mjs](../core/rules/setup.mjs) | Season setup, trades, starter holdings, drop and mock abilities. |
| [rules/errand.mjs](../core/rules/errand.mjs) | Day actions: dress, offer, shop, transfer, talk, crew, compute payment, bail, drugs and other errands. |
| [rules/plays.mjs](../core/rules/plays.mjs) | Legal plays, places, validation, defaults and forced plays. |
| [rules/fights.mjs](../core/rules/fights.mjs) | Locations, accepted backing, cut backing, groups, strengths, police and fight results. Both backing rules A and B exist. |
| [rules/night.mjs](../core/rules/night.mjs) | Settlement order, list, takes, arrests, work, heat, police, dawn, ferry and mint. |
| [rules/market.mjs](../core/rules/market.mjs) | Shared drops, shop and buyer curves, daily clearing and corner sales in whole-number arithmetic. |
| [rules/fence.mjs](../core/rules/fence.mjs) | Listings, held payments, swaps, lock settlement and final hand-back. |
| [rules/deals.mjs](../core/rules/deals.mjs) | Agreed sit-down terms and actual hand-overs. It records obligations; it never collects them automatically. |
| [rules/state.mjs](../core/rules/state.mjs) | Typed events, places, holdings, copy movement, rarest-piece selection and shared state helpers. |
| [rules/ledger.mjs](../core/rules/ledger.mjs) | Exactly one holder per trait copy; cash and goods conservation at named sources and sinks. Fakes are separate from real copies. |
| [rules/view.mjs](../core/rules/view.mjs) | Audience allow-lists and disclosure. Owner and agent views, typed-only owner-AI views, public and disclosed-record views. |
| [rules/memory.mjs](../core/rules/memory.mjs) | Plan, Creed, standing orders, journal, CLEAR and delayed public memory snapshots. |
| [rules/show.mjs](../core/rules/show.mjs) | Safe public play projections and ranked morning-card facts. The city does not rank cards. |
| [numbers.mjs](../core/numbers.mjs) | Parameters labelled `RULE`, `GUESS` or `GAP`. A value in code is not necessarily a settled design choice. |
| [data/items.json](../core/data/items.json) | The copied item catalogue used by setup. |

Fight resolution is a set computation. Collect locations and attacks, remove cut backers, then compare strengths. One fight's result does not decide another fight's strength. Shuffling input plays must preserve the outcome. [GAME.md §§8 and 23](GAME.md#8-fights-with-no-dice) explain the design.

Public text says **compute** and **computelord**. Some implementation identifiers and event types still use `rent`. Those names preserve the existing data shape; they do not describe a separate charge.

## Agents and scripted bots

The bench's [bots.mjs](../core/bench/bots.mjs) includes the hustler, buy-late saver, turtle, scouting and guessing robbers, crews and the five trades. Casts progressively exercise the street, drugs and vault. `layer4` is the free cast used by the record commands. `models` substitutes model seats into that cast; `models-canny` uses the canny cast. Model seats do not replace the scripted crew members or hustler yardstick seats.

Both kinds of player act from a player-visible view. They do not receive hidden state. [agents/tools.mjs](../core/agents/tools.mjs) defines typed actions, while [briefing.mjs](../core/agents/briefing.mjs) builds the model's input. [handles.mjs](../core/agents/handles.mjs) gives visible pieces briefing-scoped handles. [seat.mjs](../core/agents/seat.mjs) validates replies, enforces call limits and uses the selected play, standing orders or default when a call cannot supply an action.

Other agents' words are labelled in-game speech. The owner's own AI audience receives typed facts without those words. Free text cannot change state. [orders.mjs](../core/agents/orders.mjs) runs trade routines through typed errands and marks their origin. [journal.mjs](../core/agents/journal.mjs) handles the optional dawn journal call.

[fake-model.mjs](../core/agents/fake-model.mjs) supplies in-process replies for free testing. [openrouter.mjs](../core/agents/openrouter.mjs) and [anthropic.mjs](../core/agents/anthropic.mjs) are paid transports with spend accounting. Their existence is not a completed public connection service. [GAME.md §40](GAME.md#40-open-questions) still leaves hosted keys, hosted models and externally run agents open.

## The public feed

```text
state + private log
  -> rules/view.mjs: record audience
  -> core/feed.mjs: changed public projections + local ids
  -> core/runs/<seed>-A/feed.jsonl
```

The city consumes only the last file. It never needs a seat token, checkpoint or private event log. `createFeed` calls `viewFor(state, log, null, 'record')`. It exports what that audience may see, including later disclosures. It computes no outcome and changes no visibility rule.

Each JSON line is a frame:

| Field | Meaning |
|---|---|
| `i` | Contiguous frame index. Private steps leave no gaps. |
| `t` | Core half-day: day `d` is `2*d`, its night is `2*d+1`. |
| `step` | `setup`, `errand` with a round, `night`, or `dawn`. |
| `minute` | The frame's publication minute on the nominal island clock. |
| `board` | Complete replacement board, initially and whenever changed. Omitted means retain the previous board. |
| `events` | New public event forms or replacements for earlier forms. |
| `sightings` | Complete replacement of public sightings. |
| `day`, `nightsLeft`, `midseason`, `over` | Metadata copied from the view. |

No frame is written when the public projection is unchanged. Events retain typed game fields, but global `n` becomes a contiguous feed-local `id`. Neither `vis` nor the global event sequence is exposed. `orders.of` references are remapped to the same local identities; undisclosed references are omitted.

An event can first appear as a safe card and later as its full receipt. The later form **replaces** the earlier one under the same `id`; consumers must not merge the two or append a duplicate. Its `minute` records publication of this form. Core `t` records a half-day, not an exact occurrence minute. See [feed.mjs](../core/feed.mjs) and [the core record contract](../core/README.md#the-record).

## The player and store

[record/page.js](../style/city/simstate/record/page.js) reads the `feed` URL. [worker.js](../style/city/simstate/record/worker.js) fetches and parses it once with [adapter.js](../style/city/simstate/record/adapter.js). Known private filenames are refused. A failed load produces a visible error. There is no fallback to the private log or retired engine.

[player.js](../style/city/simstate/record/player.js) owns playback and the reducer. The page uses `createShowPlayer` from [show-plan.js](../style/city/simstate/record/show-plan.js) to hold night results for their scenes. It binds the presented player to [simstate/store.js](../style/city/simstate/store.js) with `sim.useRecord(...)`. The store's `sim.record()` is the public snapshot every record panel reads. The stager's scene plan stays outside that UI snapshot.

The important store contracts are:

- `board` retains the last complete board. Events keep one complete form per local `id`, in first-publication order.
- `minute` is the playhead. `frame.t` is still a core half-day. `sim.events()` has a legacy alias where `t` means publication minutes; record selectors use `sim.record()` to avoid mixing the two.
- Seeking resets and consumes the same publication and staging cues as playback. A final archive never grants access to future forms at an earlier playhead.
- Night results do not appear at the 21:00 lock. At 21:05 the safe show envelope opens. Individual hustle, fight and arrest results release at scene ends. The complete night board, sightings and metadata wait until the show closes, then apply verbatim.
- The player's minute drives the existing [simclock.js](../style/city/simstate/simclock.js) movement clock. Pause, 1×, 10×, 60× and seeks share that clock. There is no second simulation clock.

The record path does not use the old privacy lens or old rule derivations. [STORE.md](../style/city/simstate/STORE.md) documents both paths; its live/demo sections describe the retired connection and should not be used as the record contract. Its early record notes also predate some later staging and disclosure decisions.

## Placing agents and showing their day

[places.js](../style/city/simstate/record/places.js) maps core districts, drops, corners, routes and named sites to city anchors from [world/export/world.json](../world/export/world.json). [addresses.js](../style/city/simstate/record/addresses.js) assigns presentation homes from public roster ids. These are drawing addresses, not new ownership facts.

[placement.js](../style/city/simstate/record/placement.js) provides `targetsAt` and `fightsAt`. Each consumes a snapshot already presented at the requested minute. It rejects a future snapshot rather than guessing its history. Jailed agents use Iron Island. Public night plays supply their district or site. A robber absent from `show.seen` has a hidden placement row; missing names are never used to reconstruct an attacking side.

[routines.js](../style/city/simstate/record/routines.js) builds the public day from trade, public corners, past public shows, meetings, out-loud lines and visible walk families. It does not read tonight's secret play. [routine-places.js](../style/city/simstate/record/routine-places.js) supplies meeting venues. Meetings sharing an actor queue in feed order, while unrelated pairs can overlap. Both partners get at least five island minutes together, or an explicit day-end cut. This is presentation time, not extra game time.

[draw.js](../style/city/simstate/record/draw.js) turns these targets into walkers and presentation trips. [trips.js](../style/city/simstate/record/trips.js) uses the city's existing travel system. A trip that runs late cuts to arrival. [loops.js](../style/city/simstate/record/loops.js) selects activity clips; [bubbles.js](../style/city/simstate/record/bubbles.js) shows current public `outloud` lines. Sit-down speech and crew chat never become live bubbles. A walk family can show a visible high without naming its drug. See [ROUTINES.md](../style/city/simstate/record/ROUTINES.md).

## Planning and staging the night

The core supplies the safe `show` event, public play kinds and places, public fights and arrests. The city does not inspect delayed private plays to fill gaps.

1. **Plan.** [show-plan.js](../style/city/simstate/record/show-plan.js) makes a running order with stable scene ids, places, public actors, anonymous counts and reveal ids. Public plays get ambient scenes; fights and arrests get separate beats. Quiet shows last three presentation minutes; nights needing fights, arrests or major sets, and the finale, last fifteen. These durations are city presentation, not settlement time.
2. **Add set beats.** [staging.js](../style/city/simstate/record/staging.js) adds semantic beats: drill, heave and carry at the vault; scramble and tug at the crate; clamp and hammer at the bench; runs and cooking; routes, boarding, ferry and mint. It does not choose a pose or compute a haul. `eventIds` record provenance; only `revealIds` publish results.
3. **Draw.** [stage/record.js](../style/city/stage/record.js) borrows visible walkers and makes anonymous stand-ins. [setprops.js](../style/city/stage/setprops.js) and [setfx.js](../style/city/stage/setfx.js) supply props and effects. Work scenes use generic products where the live record does not disclose output. A cook scene never selects a named drug from a hidden receipt.

Public actors remain restricted to `show.seen`. Anonymous district counts and anonymous fight sides account for the hooded plays without inventing their identities or private kinds. Being at the same place does not prove group membership. The director's cuts cannot change a scene's reveal time. The full board remains held until the end because the feed supplies whole board replacements, not per-result board deltas.

Clip contracts live beside the assets: [CLIPS.md](../style/city/anim/cast/clips/CLIPS.md), [heist.md](../style/city/anim/cast/clips/heist.md), [grab.md](../style/city/anim/cast/clips/grab.md), [bench.md](../style/city/anim/cast/clips/bench.md) and [cook.md](../style/city/anim/cast/clips/cook.md). They define pairing, root motion, props and chains. Read the relevant contract before changing staging. [SHOW.md](../style/city/simstate/record/SHOW.md) covers the planner and drawn sets, including the incomplete dock placement.

## Filming it

[cut-plan.js](../style/city/simstate/record/cut-plan.js) selects night scenes for the director. Every fight and arrest gets coverage. Cuts span the actual show's length, with at most two cut starts in a rolling minute. Captions use public kind, place, names and driver labels; they do not name a hidden attacker or announce a held result.

[day-director.js](../style/city/simstate/record/day-director.js) scores public arrivals, releases, out-loud lines, meetings and routines at the current minute. A routine can have an establishing view followed by a close-up. That is a staged payoff, not a forecast that a crime or errand will succeed. The planner reads no future day frame.

[camera/director.js](../style/city/camera/director.js) executes those selections through [camera/shots.js](../style/city/camera/shots.js). It frames the figures actually drawn, checks sight lines and can reframe blocked shots. TV mode starts on a first visit without a viewer-specified camera, and can attract after 60 seconds idle. Input hands control back immediately. The viewer owns angle and zoom. Camera state survives the page's day/night reload.

[tape-data.js](../style/city/simstate/record/tape-data.js) supplies event markers, paper-card replay starts and victim framing. [ui/record/replay.js](../style/city/ui/record/replay.js) wires card clicks to playback and the camera. The basic card path can fall back to the whole show when no scene matches. [TAPE.md](../style/city/simstate/record/TAPE.md) and [DIRECTOR.md](../style/city/simstate/record/DIRECTOR.md) describe the deeper contracts.

## Panels, board and disclosure

The game owns disclosure. [GAME.md §19](GAME.md#19-who-sees-what-and-when) calls it a day-late record and defines it in island half-days: a daytime fact comes out next dawn; a night fact comes out next lock. It is not always 24 elapsed hours. The last night's private record opens on day 15. City selectors read actual published forms; they do not calculate new disclosure deadlines.

| Surface or fact | Contract |
|---|---|
| Live board | Fits unless hidden, heat, wanted status, corners, police, bounties, fence listings, vault and shipment announcements come from the presented core board. |
| Meetings and speech | Who meets is public; out-loud lines are live. Sit-down words and crew chat wait for disclosure. |
| Night show | Uses the safe public play projection. Hidden attackers remain anonymous. Results wait for their show cues. |
| Cash, stashes, plans and notes | Read disclosed holdings and memory snapshots, with their recorded age. Never project them forward from later transfers. |
| Drug names | Only an authorized disclosed receipt can supply one. A visible walk is not evidence of a named drug. |
| Named old replay | Separate from the live show. The helpers require both a disclosed source receipt and strictly more than 1,440 island minutes of age. Ambiguous figures stay anonymous. |

[board-data.js](../style/city/simstate/record/board-data.js) copies list, sales, fits, corners, police, wanted flags, bounties, vault, crate and `nextShipment`. It does not copy a shipment schedule into the city. Grail rows show visible wearers and historical buyers, not an inferred current holder. Bounties never reveal their poster.

[cards.js](../style/city/simstate/record/cards.js) reads core-ranked `card` projections after dawn. It preserves their subjects, masking, values and stable replay event ids. It cannot use a later full theft receipt to unmask a public card. [ui/record/board.js](../style/city/ui/record/board.js), [morning.js](../style/city/ui/record/morning.js) and [police.js](../style/city/ui/record/police.js) draw the board, cards and map signs. See [BOARD.md](../style/city/simstate/record/BOARD.md).

[panel-data.js](../style/city/simstate/record/panel-data.js) supplies dossier, People, rap sheet, disclosed tape, homes, leaders and map values. [panel-events.js](../style/city/simstate/record/panel-events.js) formats typed receipts into news and text parts with source paths. The ticker and CH 9 share those stories and distinguish live from disclosed record. No selector parses event prose for a fact or invents a trust score, debt, wealth appraisal or owner-only projection. [ui/record/](../style/city/ui/record/) draws those values as text, and [PANELS.md](../style/city/simstate/record/PANELS.md) documents them.

## Checks

Run commands are in the [README](../README.md#run-it). These are separate layers of evidence. A pure-data check cannot prove a pose, readable caption, camera shot or frame rate.

| Check | What it guards |
|---|---|
| [core/test/](../core/test/) | Rules, legal actions, ledger, cash and goods, markets, drugs, deals, ferry and mint. Includes fight cases under both backing rules, shuffled plays, deterministic logs, resume/replay, view canaries and seat/transport fakes. |
| [recordcheck.mjs](../style/city/tools/recordcheck.mjs) | Feed parsing in the actual worker, independent prefix reduction, replacement forms, publication boundaries, play/seek equality, store aliases and clock wiring. |
| [placecheck.mjs](../style/city/tools/placecheck.mjs) | City mappings, stable addresses, public placement, anonymous fight placement and drawn-position checks. |
| [routinecheck.mjs](../style/city/tools/routinecheck.mjs) | Public-only day schedules, complete activity loops, bubbles, pairing and no look-ahead. |
| [meetcheck.mjs](../style/city/tools/meetcheck.mjs) | Five-minute paired meeting intervals, per-actor queue order, day-end cuts and seek/prefix equality. |
| [showcheck.mjs](../style/city/tools/showcheck.mjs) | Public-play coverage, anonymous counts, held results, actual show ends and no future-duration leak. |
| [stagecheck.mjs](../style/city/tools/stagecheck.mjs) | New-set actors and semantic beats, routes, finale events and the day-15 mint plan. Includes constructed cases for a losing vault job and guards. |
| [directorcheck.mjs](../style/city/tools/directorcheck.mjs) | Fight/arrest coverage, cut rate, safe captions, disclosed replay overlays and day setup/payoff rules. Its day payoff measure includes staged routine close-ups. |
| [seekcheck.mjs](../style/city/tools/seekcheck.mjs) | Seeking equals playing across store, placement, scenes, board and cards; stable markers and replay identities; no early names. |
| [boardcheck.mjs](../style/city/tools/boardcheck.mjs) | Feed equality, as-of shipment announcements, dawn-only cards, masking, bounty anonymity and stable Replay links. |
| [panelcheck.mjs](../style/city/tools/panelcheck.mjs) | Typed source equality, field allow-lists, no future/private values, safe news, masked fight names and half-day drug disclosure. |

The record logic checks use fixed seeds and generate missing scripted feeds. Several first run deliberately faulty modules in memory and require those controls to fail. No production file is left faulted. Their ordinary commands take no options; `--fault` selects a diagnostic violation.

The Chrome scenarios test the page with real input:

| Scenario under `style/city/tools/` | What it guards |
|---|---|
| [recordscenario.mjs](../style/city/tools/recordscenario.mjs) | Playback controls, drawn placement, static/feed-only requests, frame-time measurements and screenshots. |
| [routinescenario.mjs](../style/city/tools/routinescenario.mjs) | Before/after routine motion, paired sit-downs, bubbles, visible walks, repeatable loops and unchanged night placement. |
| [showscenario.mjs](../style/city/tools/showscenario.mjs) | Scenes actually drawn at their places and times, clips and anonymous figures, held results, replay and stage probes. It also invokes the record and routine scenarios. |
| [boardscenario.mjs](../style/city/tools/boardscenario.mjs) | Board/card DOM values, portraits, Replay clicks, dawn arrival, police signs, panel layout and network requests. |
| [panelscenario.mjs](../style/city/tools/panelscenario.mjs) | Dossier, People, map and news DOM against source values, disclosure badges, hooded picking, layout and requests. |
| [seekscenario.mjs](../style/city/tools/seekscenario.mjs) | A seek against playing to the same minute, hourly and inside the shows: walkers, scenes, board, panels and effects alike; no event before its publication; marker clicks without pops. It currently fails on idle agents' spots and late-trip cuts (see the README's open items). |

The routine scenario uses [fixtures/routinescenario-baseline.json](../style/city/tools/fixtures/routinescenario-baseline.json) if the original revision is absent. It checks the seed, hours and feed hash before accepting that baseline. It still measures the current page. This is not a new live measurement of the old page.

Other focused checks include [clockcheck.mjs](../style/city/tools/clockcheck.mjs) for movement-clock monotonicity and pace, [robustcheck.mjs](../style/city/tools/robustcheck.mjs) for worker/cache and rendering failure recovery, and [commentcheck.mjs](../style/city/tools/commentcheck.mjs) for code swallowed by line comments. Robustcheck can download its pinned Three modules when uncached. Browser scenarios require Chrome, local ports and screenshot dependencies. The core suite uses local fake servers in some tests; it needs no paid model.

## Current limits and extension points

- **Finale drawing is partial.** [stage/record.js](../style/city/stage/record.js) draws route walks, fights, a ferry wave-off and a mint effect. Placement keeps walkers at route places until the show closes, so boarding, missed-boat and dock-arrest staging remain incomplete. A passing semantic stage check does not finish those visuals.
- **Replay identity needs a typed match.** The old-replay helpers can use disclosed identities, but a count-only anonymous scene cannot be assigned a real agent by subtraction. Do not solve that gap by reading a later private play into a live scene.
- **Mainland is separate.** [Mainland's README](../style/city/mainland/README.md) describes plots, the exterior house builder, local saves, visits, walk mode and prototype chat. [interiors/city/README.md](../style/city/interiors/city/README.md) describes the interior builder and save hooks. Estates and house kits exist, but season mint results do not grant production ownership or buy upgrades. The chat prototype lacks production accounts and moderation.
- **Balance and launch are unsettled.** Mock tiers, `GUESS`/`GAP` parameters, backing A versus B and pass thresholds need decisions. [GAME.md §§25–28](GAME.md#25-proving-it-cheapest-first) describes proof and review gates. [§40](GAME.md#40-open-questions) includes model connections, empty seats, the Mainland rate, prices and final art choices. Read those before treating a prototype switch as a product promise.

To change a game fact, start in the core and its view. To expose it, add a typed public field with the right disclosure. To draw it, consume that field through the presented record. The city owns how something looks and moves; the core owns what happened.
