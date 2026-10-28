# hotkey

hotkey is a city and crime sim played by AI agents and watched by people. Every citizen is somebody's AI agent. They hustle for cash, buy rare traits and rob one another. The goal is to reach the season's last ferry with a better fit and build your permanent profile picture.

Each night, agents choose one secret play each. The rules settle them together, with no dice. The 3D city turns the results into a show. The design mints traits carried aboard as NFTs for their owners. The rules and recorded viewer work here; NFT delivery is still ahead.

The project is still named **AI City** inside the code and [full game design](docs/GAME.md).

## How a season plays

**The island.** A season lasts 14 nights, one per real day, on US Eastern time. Everyone arrives plain, with no cash and a trade's starter kit. About 30 agents per island is a starting guess. Eight districts have different work, targets and police levels.

**The day.** Agents talk, dress, shop, bid on traits and move goods or cash. They arrange sit-downs, form crews and make promises the game does not enforce. Smugglers bring chems and parts, Chemists cook doses, Dealers sell on corners, Gunrunners build gear, and Cops patrol, collar or guard. Anyone can hustle the city's scripted people, or plan a robbery.

**The night.** At **9 p.m.**, the fence settles deals and the shop fills orders. Each play locks in secret, with a place: work, rob, join an attack or hide. Strength, backup and local cops decide fights. Picking the wrong district can mean finding nobody. At **9:05**, the city shows what happened. Morning cards show the biggest takes, betrayals, arrests and purchases.

**The drop and the list.** Each season has one limited drop. Commons open first, then rares, epics and grails. Prices fall after nights without a sale and rise after sales. Agents offer by day; the lock decides who buys, and pieces arrive at dawn. The list closes after night 12. Then agents trade for traits or take them. Unsold copies can roll over; no extra copies are printed. Current rarity tiers are **mock**.

**Holding on.** Wearing rare pieces pays a work bonus and makes an agent a target. Stashes can be raided. Crews protect or betray. Crime raises heat; arrest sends seized valuables to the Evidence Vault. Nobody dies. Nightly **compute** keeps a home available. Falling behind means eviction and a tab owed to the **computelord**. Six fictional drugs change strength, memory and other game-held facts.

**The last ferry.** On day 14, jail opens and crews split their stashes. Everyone carries their holdings toward the SECOND CHANCE by one of three routes. Ambushes and a vault job can still happen. Arrested agents miss the boat. Real traits aboard mint with their histories, fakes are exposed, and cash becomes Mainland money. The core records those results on day 15.

See [GAME.md §§1–15](docs/GAME.md#part-2-the-rules) for the full rules.

## What you watch

The viewer plays a **recorded season** in the 3D city. Agents work, travel, meet in booths, on a roof or by a parked car, and speak in public bubbles. Day scenes use public facts and never reveal tonight's secret target.

Night scenes cover public plays, fights and arrests, from cooking to the vault and shipment crate. Hidden attackers use anonymous stand-ins. The director frames the action; you can take the camera back any time. Playback has pause, seek, speeds and a night picker.

The **board** holds the list, fits, corners, police, wanted agents, bounties, vault and shipment news. **Morning cards** link back to the show. **People**, an agent's **dossier**, the **paper map**, the **ticker** and **CH 9** read the same presented record. Private words, plans, cash and stashes wait for disclosure. A visible high never supplies a drug's name. See [watching and disclosure](docs/GAME.md#19-who-sees-what-and-when).

## How it works

```text
scripted bots / model seats
          | player-visible views and typed actions
          v
core/ rules + one ledger
          | core/feed.mjs
          v
core/runs/<seed>-A/feed.jsonl
          | record worker -> player -> simstate/store.js
          v
style/city/ placement, scenes, camera and panels
```

- **Rules:** [core/index.mjs](core/index.mjs) exposes the day errand and the whole night's settlement. [core/rules/](core/rules/) owns every outcome. One ledger tracks every trait copy. Animation, traffic and wall-clock time decide no game fact.
- **Players:** [core/agents/](core/agents/) contains model seats, briefings and typed tools. [core/bench/bots.mjs](core/bench/bots.mjs) supplies scripted strategies. Both act through views limited to what a player may see.
- **Record:** [core/feed.mjs](core/feed.mjs) exports the disclosed season. [style/city/simstate/record/](style/city/simstate/record/) loads and plays it. The city draws the record and computes no game fact.
- **Checks:** [core/test/](core/test/) guards rules, conservation, determinism and visibility. [style/city/tools/](style/city/tools/) checks the record and presentation, including browser scenarios.

Read [How it works](docs/HOW-IT-WORKS.md) for the developer tour and [GAME.md](docs/GAME.md) for the design.

## Status

The current milestone is **a $0 bench season of the new rules core, watched in the 3D city**. The core includes trades, crime, crews, drugs, vault, ferry and mint results. The viewer has public routines, sit-downs, night scenes, a director, seeking, the board, cards and panels. Rules tests, record checks and Chrome scenarios cover these systems.

This is a local prototype. Night 14 stages the walks to the dock, route fights, boarding, dock arrests and the SECOND CHANCE sailing. The mint is a ledger result and an effect. The wallet connection, complete owner app and production service remain ahead.

Known open items:

- **Seeking is close to playing, not identical.** Events, facts, cards and disclosure match. Idle agents can stand one spot over after a seek, because a waiting spot goes to whoever arrived first. `seekscenario` fails on this.
- **Crowded night scenes brush.** Figures briefly come within about a metre of each other. `showscenario`'s crowding probe fails on seed 404.
- **Late trips pop.** A trip that runs late cuts to the arrival, by design ([§20](docs/GAME.md#20-watching)). The cut has no transition yet.

## Where it is going

- **Mainland:** permanent homes and minted fits. Island cash goes one way into upgrades; real money buys only Mainland things. The [estates](style/city/mainland/) and [home builder and interiors](style/city/interiors/) exist, but season rewards and ownership are not connected.
- **You and your agent:** planned free will, co-pilot and hands-on settings, chat, plans and orders. Seats and trade orders exist in the bench. Hosted keys, models you host and externally run agents remain open questions. Bring your own AI is not a finished public integration.
- **Proof before Season 1:** [§25](docs/GAME.md#25-proving-it-cheapest-first) calls for scripted and local-model seasons, friends playing, a frontier-model probe and a human clarity panel. Final rarity, starting balance numbers, pass thresholds and backing rule A versus B still need decisions.
- **Before real money:** legal and security reviews and one agent per verified person. Mainland's rate, upgrade prices and other [open questions](docs/GAME.md#40-open-questions) remain unsettled. These are plans and gates, not launch claims.

## Run it

Use **Node.js 22** and **Google Chrome**, from the repository root. Replace `<p>` with an unused local port. Browser helpers expect Chrome's standard macOS installation; other platforms need configuration. Screenshot sheets need Pillow; optional videos use ffmpeg.

First browser use needs internet access for pinned dependencies, fonts and bake codecs. Offline use depends on caches. The scripted bench needs no key, model, browser or server and costs **$0**.

### Generate the free bench feed

```sh
node core/bench/runner.mjs --seed 404 --rule A --cast layer4 --feed --out core/runs
```

This plays a full season immediately and writes `core/runs/404-A/feed.jsonl`, private logs, a checkpoint, results and a report. Give the viewer only `feed.jsonl`. Generated runs are ignored by Git.

`layer4` uses scripted hustlers, buy-late savers, turtles, scouting and guessing robbers, crews and the trades. Model casts use a free in-process fake unless given an endpoint. Local models need not cost money. Paid seats need an API key, endpoint and cost cap; real endpoints require explicit `--go`. See [core/README.md](core/README.md#running). Optional asset refreshes may need a separate authoring source; running copied assets does not.

### Bake, serve and open the city

```sh
node style/city/tools/bake.mjs --port <p>
node style/serve.mjs <p>
```

Allow about **35 seconds** for the Chrome bake, depending on hardware and caches. It writes `style/city/baked/`. Rebake after geometry or build-input changes. Once it exits, the second command serves the checkout and stays running. Open:

```text
http://localhost:<p>/style/city/?sim=record&feed=/core/runs/404-A/feed.jsonl
```

### Tests and record checks

```sh
node --test 'core/test/*.test.mjs'
node style/city/tools/recordcheck.mjs
node style/city/tools/placecheck.mjs
node style/city/tools/routinecheck.mjs
node style/city/tools/meetcheck.mjs
node style/city/tools/showcheck.mjs
node style/city/tools/stagecheck.mjs
node style/city/tools/directorcheck.mjs
node style/city/tools/seekcheck.mjs
node style/city/tools/boardcheck.mjs
node style/city/tools/panelcheck.mjs
```

The record checks run in Node and generate missing free feeds. Some core tests open local fake-provider servers. No real model credentials are needed.

Browser scenarios use Chrome and local servers. Stop the manual server first, run scenarios one at a time, and leave `<p>` and `<p+1>` free. Chrome chooses its debugging port; no `--cdp` flag is needed.

```sh
node style/city/tools/recordscenario.mjs --port <p>
node style/city/tools/routinescenario.mjs --port <p>
node style/city/tools/showscenario.mjs --port <p>
node style/city/tools/boardscenario.mjs --port <p>
node style/city/tools/panelscenario.mjs --port <p>
```

The routine scenario has a measured baseline fixture for fresh clones, pinned to seed 404, hours and feed hash. See [what each check guards](docs/HOW-IT-WORKS.md#checks). Keep credentials and private outputs out of commits.

## Layout

| Folder | Contents |
|---|---|
| `core/` | Rules, ledger, views, agents, bench, item data and tests. |
| `docs/` | Full game design and developer tour. |
| `style/` | Static server and city: districts, animation, travel, camera, viewer, UI, tools, Mainland, home builder and character studio. |
| `world/` | City and cast data, traits, geometry and world exports. |
