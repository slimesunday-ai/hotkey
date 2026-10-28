# THE SIM STORE: what every human-facing screen reads

`simstate/store.js` is the one place the human layer (menus, click-an-agent, the dossier, the tape, stats) gets sim data from.
On **live/demo**, `simstate/lens.js` enforces the old sim's disclosure. On **record**, the core's feed already owns disclosure;
the record path never imports that lens or runs the old adapter/price/rule derivations. Screens never fetch `/state` themselves.

```js
import { sim } from './simstate/store.js'
```

## Record mode: C1-2's seam (2026-10-27)

Generate the $0 fixtures from the worktree root; `core/runs/` is ignored:

```sh
node core/bench/runner.mjs --seed 404 --rule A --cast layer4 --feed --out core/runs
node core/bench/runner.mjs --seed 405 --rule A --cast layer4 --feed --out core/runs
node core/bench/runner.mjs --seed 406 --rule A --cast layer4 --feed --out core/runs
node style/city/tools/recordcheck.mjs
```

Open `/style/city/?sim=record&feed=/core/runs/404-A/feed.jsonl`. Only `feed` is fetched for game data, once, and parsed
in `record/worker.js`. The page also loads the city's static assets. There is no polling, owner claim, server, private-log
fallback, or main-thread parsing fallback. A failed worker/feed load leaves a visible module error. Known private filenames
are refused before fetching. No core/rules module is a city dependency.

`record/page.js` starts the player and binds it with `sim.useRecord(player)`. Until C1-3 adds placement, it draws the
existing island and playback controls; it does not spawn or position agents. Old home cutaways are disabled on record
because their fallback loads the retired demo. Later consumers subscribe to `sim.on('tick')`,
read this store, and attach the walkers' existing clock with `player.attachClock(agents.clock)` (returns a detach function).
There is no second movement clock or reconstruction of game state. Cached data is read-only, as on the old path.

| API / field | Source and meaning on record |
|---|---|
| `sim.record()` | Current feed projection plus playhead `minute` and `reveal`, described below. No future frames. |
| `.frame` | Last applied frame's `{i,t,step,minute}`; `t` remains the **core half-day**, not island minutes. Null before setup. |
| `.board` / `sim.board()` | Last complete `frame.board`; retained unchanged through frames that omit it. Null before setup. |
| `.events` | Latest complete form per feed `id`, first-publication order; each retains every typed field, core `t`, and publication `minute`. Updates replace, never merge or append duplicates. |
| `.sightings`, `.day`, `.nightsLeft`, `.midseason`, `.over` | Complete replacements from the last applied frame, with the same names. Before setup: `{}` / null. |
| `.minute` | Player's current island minute, including time between feed frames. |
| `.reveal` | Last applied night frame's `{night:frame.day, frame:frame.i, minute:frame.minute, start, revealIds:frame.events[].id}`; null before the first show. These are event **forms** in that frame, including updates. |
| `sim.agents()` | Roster order from `board.agents`. Each card preserves **all** its board fields and adds the aliases below. |
| card `id`, `name`, `trade`, `driver` | `board.agents[]` verbatim. Identity lookups always use `id`, never display `name`. |
| card `heat`, `wanted`, `jailed`, `bail`, `evicted`, `tab`, `crew`, `boarded`, `fit`, `fitHidden`, `walk` | Same-named `board.agents[]` fields, unchanged. Public heat belongs to the new board; the old path's heat restriction below still applies to the old path. |
| card `handle`, `cls`, `model`, `wear`, `mood` | Compatibility aliases of `id`, `trade`, `driver`, `fit`, `walk`. `wear` can be null when the feed hides the fit. |
| card `status` | Presentation status `jail` when board `jailed`, otherwise `active`; no sleep, hospital, death or retirement inferred. |
| card `lastSay` | Last matching `board.outloud[].line` for that agent today; absent when none. Never sit-down/chat text. |
| `sim.agent(id)` | `{live:card, mine:null, tape:null, rap:null, people:null}`. Disclosed history is in events; C1-11 supplies panel selectors. |
| `sim.world()` | Every board field unchanged, plus `news:sim.events()`. No derived holdings, prices, stats or deal statuses. |
| world `startingStake`, `memories`, `street`, `outloud` | Same-named board fields. Memory snapshots retain their own `asOfDay/asOfClock`; no seat-only projections. |
| world `list`, `sales`, `agents`, `crews`, `corners` | Same-named board fields, including the list's prices/copies and corners' holders/hot flags. No copy inferred from a sale. |
| world `police`, `tonight`, `vault`, `market`, `marketSteps`, `crate`, `fence`, `bounties` | Same-named board fields. All nested fields preserved, no arithmetic or cross-event reconstruction. |
| `sim.events(options)` | Same events as `.record().events`, with compatibility aliases: `coreT=event.t`, **`t=event.minute`**, `who=agent ?? from ?? a`, `to=to ?? target ?? b`, `at=place ?? corner`. No alias when its source is absent; no `text` invented. Existing filters still apply. |
| `sim.clock()` | `{t:player.minute,day,hhmm,night,speed,running}`. Civil **day 0** numbering; night 20:00–06:00; speed game minutes/real second, zero paused. No half-day/DST conversion. |
| `sim.tape` | Local disclosed history only: horizon/asOf = playhead; delay 0, pending false. `get(from,to,{handle})` returns the current event forms in that publication-minute range and `snapshots:[]`, without a request. It does not reconstruct earlier forms; use player seeking for that. |
| `sim.history()` | Complete file prefix, no gaps or trimming. No director's cut separate from the disclosed record. |
| `sim.info` | `source:'record', status:'record'`; `sim.me=null`, `sim.lens='public'` even at the season end. An archive is not permission to use future forms. |

No source means absent/null: `look`, `npc`, `localOf`, `retired`, `home`, addresses, trips, poses, `act`, coordinates,
`placeName`, `district`, `indoors`, `coarse`, `now`, `marks`, `drip`; homes/piles/crowd/rush/patrol scenery; station cops,
loans, city events, mostWanted, owner `mine`, budget and seat-only fight/run/hustle/deal projections. C1-3 owns addresses,
placement and trips; C1-4 owns public routines; C1-11 reads disclosed events for panels. No old rule fills these holes.
`where()` is null until there is placement; drawn walkers, when supplied, remain its first source.

Playback: `sim.playback` (also `window.__record.player`) has `play()`, `pause()`, `setSpeed(1|10|60)`, `seek(minute)`,
`jumpShow(night)`, `playShows(firstNight=1)`, `playSeason()`, `snapshot()`, `on(fn)`, `attachClock(clock)`, and read-only
`minute/speed/running/mode/bounds`. `advance(realSeconds)` is driven once by each page frame, using actual elapsed time.
`shows()` returns only night numbers and their scheduled start minutes for navigation. Seeking clamps to 0..last feed
minute; playback starts at setup. Seek rebuilds from the beginning, emits `epoch`, then `agent:<id>` and `tick`. Ordinary
frame releases emit changed event forms by id, agent updates and `tick`. Clock-only progress doesn't emit feed events.

**Publication and staging are distinct.** The reducer's state after frame i is exactly feed frames 0..i. The player
applies non-night frames at their `minute`. D4(c) holds the **whole** night frame (board, events, sightings and metadata)
until `max(frame.minute, day*1440+1265)`, the 21:05 show. Before then the presented store remains at its previous frame.
No individual night result is recomputed or released early. Until C1-6 supplies scene beats, all `revealIds` release at
that first beat. Shows-only plays 15 game minutes per show and skips to the next show, preserving elapsed overshoot;
C1-6 owns shorter shows and the per-scene board reveal. Jumping still applies every earlier due frame.

**Held results on the page (C1-6, D4 (c)).** `record/page.js` plays `createShowPlayer` (show-plan.js) and binds the store
to it through a view that drops the stager's scene plan: `sim.record()` keeps exactly the fields above, no `show`. What
changes is when a night's results arrive. At 21:05 only the show envelope (`plan.openingIds`) is applied; each hustle,
fight and arrest form reaches `.events`, `sim.events()` and the ticker at its scene's end, the rest at the closing
results beat. `.board`, `.sightings`, `.nightsLeft`, `.midseason` and `.over` stay at the previous frame's until the
show closes (`plan.end`: 3 minutes on a quiet night, 15 otherwise), then the whole frame applies verbatim. During the
show `.reveal` is `{night, frame, minute, start, end, revealIds}`, `revealIds` cumulative; `end` stays after the close
(placement reads it). Seeking replays the same cues. The stager reads the plan from the player itself
(`window.__record.player.snapshot().show`); `createRecordPlayer` alone still behaves as described above.

The shared `simclock.js` live binding `GAME_MIN` is real seconds/game minute: 60 at live pace, 6 at 10×, 1 at 60×;
pause retains the selected conversion but sets the writable clock's rate to 0. Record writes `clock.t/at/rate/running`
and advances `epoch` on seek, as the tape does. Every old path leaves `GAME_MIN=2.5`. Day/night asset reloads preserve
the playhead, speed, pause, shows mode and camera; `simtod=0` disables them. URL resume parameters are `recordAt`,
`recordSpeed`, `recordPaused=1`, `recordShows=1`.

`recordcheck` compares an independent prefix oracle at every frame and every distinct publication/show boundary,
including just before boundaries. It checks play/seek/repeat/suffix independence, store aliases, actual worker parsing,
page clock wiring and all 14 shows back to back. Its default run first mutates an in-memory player module to prove
look-ahead, a dropped frame, and a seek that drops a board each fail; production files are never changed.
The core's half-day disclosure versus literal 24 hours remains open for slime (`core/README.md`, "The record").

## Live/demo contract

The remaining sections document the existing live/demo behavior, unchanged by record mode.

## Start it

It starts on its own on a `?sim=live` page (and on `?sim=demo`, which reads `demo.json` once a minute). It polls in its own worker (`storeworker.js` → `storefeed.js`). Everything is derived there, once per poll and never per frame, and only what changed is posted. The map's own feed (`feed.js` → `layer.js`, `agents.js`) is not touched: `?sim=live` draws exactly the same with or without the store.

Run it against a recorded run (no sim, no cost):

    node style/city/tools/simreplay.mjs 2026-09-29T23-18-20-641Z-mixed --port 5263 --from "D2 12:00"
    node style/serve.mjs 5333          (from the worktree root)
    http://127.0.0.1:5333/style/city/?sim=live&simport=5263                 the public lens
    http://127.0.0.1:5333/style/city/?sim=live&simport=5263&as=www.girl     + claim @www.girl (the replay hands out the token)

| Page parameter | What it does |
|---|---|
| `sim=live`, `simport`, `simurl`, `simpoll` | As for the map (SIMLIVE.md). The store asks for `view=public` itself, whatever `simurl` says. |
| `as=<handle>` | Claims that agent: the store polls `view=owner&handle=&token=` and fills `mine`. |
| `token=<t>` | The owner token. Without it, the store asks the replay's `GET /dev/token?handle=` (dev only; the real sim never hands tokens out). |

`sim.start({ url, as, token, interval, places })` starts it by hand (tests, other pages). `window.__simstore` is the same object, for the console.

## The API

Everything here runs at **broadcast time**: D seconds behind the sim (the broadcast delay, below; 15 s by default). The exceptions are `sim.info` and `'status'` (the connection, as it is), and the claimed agent's `mine` (its owner's panel is real time).

```js
sim.ready                 // Promise → sim, on the first state
sim.info                  // { status: 'off' | 'connecting' | 'live' | 'offline', error, url, stats, ownerErr }
sim.clock()               // { t, day, hhmm, night, speed, running } or null. t runs on between polls at the measured rate; speed = game min per real s; offline (once the delay line has played out) it stands at the last state
sim.lens                  // 'public' (a live season) | 'archive' (a finished season: the replay's --archive)
sim.me                    // the claimed handle (?as=), or null
sim.agents()              // the public cards, roster order (cached array: don't mutate)
sim.agent(handle)         // { live, mine | null, tape | 'pending' | null, rap: [...], people: {...} } or null
sim.where(handle)         // { x, y, z, drawn, indoors, moving?, place } | null
sim.pick(x, z, r = 1.5)   // the drawn agent nearest a world point (a ground click), within r m → handle | null
sim.on(type, fn)          // → unsubscribe. 'tick', 'event', 'agent:<handle>', 'mine', 'status', 'lens', 'epoch' (the sim's clock went back: the store started over; the tape closes)
sim.events({ handle, types, since, limit })   // public events, oldest first; since = game minute (exclusive)
sim.world()               // { crews, loans, news, cityEv, mostWanted, stationCops }: the public extras (mostWanted: the public one, rule 6; stationCops: below)
sim.tape                  // { horizon, asOf, delay, pending, get(from, to, { handle, snaps }) }
sim.pollNow()             // one poll now (tests, shots)
```

### `sim.agents()`: a card per agent (public)

`{ handle, cls, model, look, status, at, placeName, now, crew, home, homeName, wear, drip, marks, wanted, mood, lastSay, npc, localOf, retired, trip, act, x, z, district, indoors, coarse }`

- **`now`:** one plain sentence: "dealing at Kent & 1st", "asleep at home", "in the yard on Iron Island", "walking to the Heap", "in a taxi to Fit Street", "cooking at home", "on patrol", "in hospital at St. Mercy", "hanging out at Sunny Acres", "dead", "retired". With a `mood`, the family word is appended: "dealing at Kent & 1st, wired", "walking to the Heap, spaced out", "at Glasswall Plaza, guarded".
- **`mood`:** `'wired' | 'spaced' | 'guarded'`, or absent: the behaviour family of a drug the agent is on, shown only outdoors (rule 9, "visible highs"). Never a drug's name; `look` is the appearance, not this. `adapter.js` `agentsOf` passes it to the walkers (`mood`, null when absent).
- **`placeName`:** the full name of where it is ("Kent St & 1st St", "Pad 7 Sunny Acres"); null on a trip. **`homeName`:** the home's name. **`district`:** where it is or is heading ("Neon Row").
- **`wanted`:** the public flag (heat ≥ 75). There is never a `heat`.
- **`indoors`:** at a lot, asleep or in hospital (not on the street).

### `sim.agent(handle)`

- **`live`:** the card above.
- **`rap`:** the rap sheet, newest first, from **public events only**: `{ id, t, ts, kind, text, with, at }`. Kinds: `arrest`, `release`, `bail`, `warrant`, `bounty`, `bounty-hunter`, `loan`, `late`, `repaid`, `rent`, `evicted`, `mark`, `hospital`, `death`, `killed`, `robbery`, `robbed`, `burgled`, `sober` ("was on SUDO (12:02–12:10)": only from a public `sober`, rule 9). The text is written from the agent's side: "arrested by @pop.up.ad, held till D2 07:18". A burglar is never named (the sim's own text hides them). The last 80 entries are kept.
- **`people`:** `{ crew: { name, leader, members, turf } | null, ties: [{ handle, n, deals, fights, last, kinds }] }`. Ties come from public events between two handles, most first. Deals are contracts, hires, fronts, loans, repayments, talk and crew. Fights are robberies, arrests, bounties, kills, searches, warnings and paybacks. Burglaries are never counted.
- **`tape`:** the agent's private side **as of the director's cut** (now − delay, default one game day): `{ asOf, ts, cash, heat, inv, stash, budget, high, think, thoughts: [{ t, ts, think, did }], plan: { t, ts, steps, text } | null, deals: [{ id, t, ts, type, who, to, text, secret }], whispers: [{ t, ts, text }] }`. It is `'pending'` until the city is that old, and null when the server doesn't serve a director's cut. `asOf` is the cut itself: the director's hourly snapshot is advanced to it by the events in between (`timeline.js`), so cash and pockets agree with the deals listed (audit F17).
- **`mine`:** only for the claimed agent: `{ me, myEvents }`. `me` is the agent's full record now (cash, heat, inv, home stash, plan, triggers, notes, memory, `sees`: its own view text). `myEvents` is its own events, private ones too, the last 200. On the replay `notes`, `memory` and `sees` are null (a recording doesn't hold them), and plan and triggers are rebuilt from the run's events. If the token is refused, `mine` is null and `sim.info.ownerErr` says why. Under the broadcast delay `mine` is **real time**: it is taken when a state arrives, before the delay line, and `agent:<me>` fires then. The agent's own card (`live`), its walker and its alerts (`'mine'`) stay on the broadcast.

### `sim.where(handle)`

- **Drawn:** the walker's position (`agents.js`, read on call). `drawn: true`.
- **Not drawn:** the place it is in (jail, hospital, its lot, a shop): `drawn: false, indoors: true, place`.
- **On a ride that isn't walked** (a taxi, the woods, Iron Island): between the two places by the clock, `moving: true`.
- Dead or unknown: null.

It costs one Map lookup, so a follow camera may call it every frame.

### `sim.on(type, fn)`

- **`tick`:** every poll (about once a second): `{ t, changed: [handles] }`.
- **`event`:** each new public event. The first poll's events (the log so far, backfilled) are history: they fill `sim.events()` but don't fire.

### `sim.history()` (audit F18)

Whether `sim.events()` is the whole public log: `{ complete, from, gaps, lastGap: { after, before, t, ts } | null, trimmed, director }`.

- `/state` carries only the last 150 public events, fewer after the lens drops DMs and warns. The feed fills the log from `GET /events?since=<last id>`: on joining, and whenever a poll's window doesn't reach back to the newest event the page holds (a busy minute, a slow or failed poll, a hidden tab). The replay and the sim (since b46c49e) both serve it, so nothing is lost.
- A server without `/events`: each skipped stretch counts in `gaps`, and `lastGap` says where. If the page joined such a server late, `from` is the minute its log starts.
- `trimmed`: events dropped off the page's 20 000.
- `director`: the same for the director's events (filled from `GET /tape?snaps=0`), or null.
- City Info's survivor board says "its log has gaps" instead of "Untouched all season" when it isn't complete.
- **`agent:<handle>`:** that agent's card, rap, people, tape or mine changed. Gets `sim.agent(h)`.
- **`mine`:** the owner's alerts: one per new event of the claimed agent's own (`myEvents`, private ones too), fired when the state that brought it is released (at broadcast time), together with that moment's public `event`s. The first state's are history and don't fire.
- **`status`:** `{ status, error }` when the connection changes.
- **`lens`:** the lens or the claim changed.

All of these fire at most once per poll (1 s). None fire per frame. All fire at broadcast time except `status`, and `agent:<me>` when only the claimed agent's `mine` changed.

### The station cops: `stationCops` (sim/subway cfe86be, 2026-10-09)

A top-level field of the public state, next to `mostWanted`: where the police are posted this shift.

    stationCops: { posted: ['subway-…', …] (station ids, sorted), from: <game min>, until: <game min> }

- **The rota:** `rules.mjs STATION_COPS { share .5, shiftMin 120 }`: 7 of the 13 stations are posted at a time, a new posting every 2
  game hours (the shift starts at `from`, ends at `until`), drawn per shift from the seed on its own stream. Only a posted station checks:
  a WANTED rider boarding there may be taken (the sim's).
- **Public:** a city-wide rota from the seed, nothing about any agent. `lens.js` passes it through in `publicOf` after the verbatim
  `publicView` block (the sim's own publicView doesn't know it), only in that shape (`stationCopsOf`: `posted` strings, sorted; `from` and
  `until` numbers or null), and keeps it on the public tape's snapshots (`publicTapeSnap`) so the rewind draws the cops of its minute.
- **In the store:** `sim.world().stationCops` (null from an older sim). **On the map:** `simstate/stationcops.js` stands two officers (the
  precinct outfit, `cast.js OUTFITS.officer`) at each posted station's entrance, one each side of the mouth, facing the street, on the
  stands the station's block chose when it was built (`transit.js copStands`, the subway anchor's `cops`: checked like the cast's standing
  people, clear of every prop, wall and the entrance's own reservations, off the walkway's clear path, reserved so the walkers' lanes go
  round them; a side without room has none). A new shift brings new officers (a pool of 8 looks, baked up front). In TAPE
  (`ui/tape/map.js`) the rota at the scrub time.

### `sim.tape` (section 2)

- **`horizon`:** the newest game minute the director's cut may show (now − delay). Null while pending or not served.
- **`get(from, to, { handle, snaps })`:** fetches `GET /tape` from the server, which clamps the range to its horizon: `{ horizon, from, to, clamped, snapshots: [full hourly snapshots], events: [every event, private ones too] }`. `from` and `to` are game minutes or "D2 22:00". The replay and the sim (since deadnet-sim-move b46c49e) serve it.

### The ledger events: `payout`, `refund`, `worn_out` (sim/payouts, 2026-10-10)

The money and items the city moves on its own used to change with no event, so the tape (the director's cut, `timeline.js`) was wrong until the next hourly snapshot: `tools/tapecheck.mjs` hour ends were 94.9–96.4% right on dry seeds 404–406. Each of those changes now has a private event at its minute:

    payout   { who, of: 'locals' | 'tipfee' | 'front', cr, … }
    refund   { who, of: 'bid' | 'listing' | 'contract' | 'loan_offer' | 'bounty', why: 'expired' | 'withdrawn', cr?, items?, … }
    worn_out { who, item: 'pick', n: 1 }

- **`payout`:**
  - `of: 'locals'` (+ `crew`): each Local's share of the Locals' treasury, every hour (`floor(treasury / members)` each; the rest stays).
  - `of: 'tipfee'` (+ `about`: the arrested, `patrol`: a patrol's or station cops' arrest, in the hour's tick): the tipster's fee when someone they tipped on is arrested (`rules.mjs COPS.tipFee`).
  - `of: 'front'` (+ `to`: the dealer, `fronted`, `item`, `label`): right after every street `sale` by a dealer who has a job. `who` is the boss and `cr` the boss's share. `fronted: false` (and 0cr) is a sale of the dealer's own product.
- **`refund`:** an order, a listing, a contract's side, a loan offer or a bounty coming back. `why: 'expired'` is the hour's tick (an order or a listing after a day, a contract or a loan offer after 12 game hours, a bounty after 3 days); `why: 'withdrawn'` is `unbid` / `unlist` (their public events carry no amounts). `cr` is the cash, `items` the stacks (`{ k, label, n, q, fake }`, the snapshot's pocket shape). Also: an order's `item`, `n`, `price`; a listing's `board`; a contract's or loan offer's `offer` id; a bounty's target as `about`.
- **`worn_out`:** a pick breaking while its owner digs (in the tick).
- **Private.** Cash and pockets are, so these are. The sim marks them `secret` (the verbatim `publicEvent` drops them), and `lens.js` `LEDGER_EVENTS` refuses the three types even unmarked (`cityEvent`; `leaks()` counts one as a leak). They are on the director's tape (`/tape`, `view=director`) and in the agent's own owner view (`myEvents`: `who`; a dealer's owner also sees its sale's share, `to`). Never a `to` that would tell someone what they don't know: a tip fee and a bounty refund name the other agent only as `about`, so the arrested never learns who tipped.
- **On the tape:** `timeline.js` applies them at their minute. The hour's ones (`why: 'expired'`, the Locals', a patrol's tip fee, a sale's share, a pick) are part of the tick, before the snapshot's edge (`snapCut`). A tape from an older sim has none: what they carry lands at the next snapshot, and a dealer's sale falls back to counting the boss's units.
- **Still without an exact event:** dock wages (derived from the shift's `activity`; exact while the pool can pay), a cop's turned-in evidence (the `evidence` event doesn't say which stacks leave the pockets), `cut` (its event says the new count, not the quality), and an arrest bonus the pool can't pay in full.
- **Checked:** `tools/tapecheck.mjs` (hour ends), `tools/lenscheck.mjs` (never public, unmarked ones caught by the self-test; on the tape and in their owner's `myEvents`), `sim2/ledger-events.test.mjs` (each one's amounts, its minute and its privacy; no silent change to cash, pockets or a stash in bench cities).

### The public tape: `GET /tape?view=public` (the public rewind, 2026-10-09)

The public city between the director's horizon and the broadcast edge, for rewinding LIVE without the director's cut. The replay (`tools/simreplay.mjs`) and the sim (`sim2/server.mjs`, branch `sim/public-tape`) serve the same shape. The store doesn't read it yet (the page side is next).

    GET /tape?view=public[&from=&to=][&lag=<game min>][&handle=<h>][&snaps=0]
    → { view: 'public', t, horizon, edge, lag, from, to, clamped, delay, snapshots: [{ t, ts, stationCops?, agents: [{ handle, status, act, at, x, z, trip }] }], events: [public events] }

- **The window:** from the director's horizon (`horizon` = now − `delay`, default 1440: older is on the director's tape, everything) to the broadcast edge (`edge` = now − `lag`; `lag` is the page's broadcast delay in game minutes, as for `/state?lag`, default 0). `from` and `to` default to those two and are clamped to them (`clamped` says so). Nothing past the edge, nothing before the horizon. An edge before the horizon gives an empty tape. `t` is the server's now.
- **`snapshots`:** hourly. Each one is the public answer at the end of its hour (`lens.js` `publicOf` of the full state then), cut to where everyone is: `handle`, `status`, `act`, `at`, `x`, `z`, `trip` (`lens.js` `PUBLIC_TAPE_AGENT`, `publicTapeSnap`). Rule 5 holds as it did live (an agent at someone else's lot is its district). An hour's snapshot comes once its minute is over (or the season is). No lots, crews, stats, news or Most Wanted: the page has those live.
- **`events`:** every public event in the window, exactly as `/events` serves it (the form it had live, below). `handle`: only that agent's (who or to). `snaps=0`: no snapshots.
- **Never** cash, heat, stash, pockets, thoughts, plans, DMs, an unseen robber or a burglar: nothing an owner's or the director's view has.
- **Checked:** `tools/lenscheck.mjs` 3b (every hour, lag 0, 6, 30 and everything: never past the edge or before the horizon, `leaks()` = 0, the rules on every event and card) and `tools/rewindcheck.mjs` (every snapshot equals the public answer at its hour; every event its live form).

## The broadcast delay (TV plan A1, 2026-10-09)

The public city reaches the screen **D seconds after the sim served it** (slime's pick: 15 s, about 6 game minutes at the 60-minute day). The page always knows the next D seconds before the viewer sees them, so a camera director can cut to a robbery before it plays.

- **Where:** `simstate/broadcast.js`, a delay line between both workers and the main thread: the map's diffs (`live.js` `onDiff`: layer, walkers, the clock, the dusk/dawn reload) and the store's states (`store.js` `onMsg`: everything in this file). The two lines run in step, so the ticker, CH 9, the stage, Go-to, pins and the dossier all switch to broadcast time with no code of their own.
- **D:** `?delay=<s>` for one page (not kept), else Settings → Broadcast (Off, 10, 15, 20, 30 s; kept in this browser), else 15. **D = 0 is the page as it was**: each message is handed on at once, synchronously. A shot (`?shot`) is always D = 0. The ticker's clock badge (and the menu bar's, with the ticker off) says `LIVE · 15 s delay`.
- **Release:** each message D s after it arrived, in order, on a timer and on every arrival (a hidden tab's timers are throttled, the workers' messages aren't), so a hidden tab never piles up a burst. Messages due together (a late timer) are folded and applied once: the store's cards by handle, its events in order.
- **Joining:** the line starts empty. It releases its first message at once and plays at 0.8× until it is D behind (about 75 s of slight slow motion at 15 s). A server that serves its recent past (`GET /state?lag=<game min>`: the replay, and the sim on branch `sim/public-tape`; request 5 below) lets the join backfill the line instead: the page starts D behind, with no ramp.
- **The clock going back** (a replay loop or seek back, a restarted sim): the queue is flushed into the new state (a complete reset), released at once, and the ramp starts again.
- **The owner:** `mine` is real time, its alerts (`'mine'`) wait for broadcast time (above).
- **The tape** keeps its own horizon (server side, now − 1440 game min). On screen the gap between the tape and LIVE shrinks by D. Back to LIVE goes to the broadcast edge.
- **The lookahead, `ahead()`:** the store line's queued, not yet released public events and cards, each with its release time: `{ delay, lag, events: [{ at, in, t, e }], agents: [{ at, in, t, handle, card }] }`. It holds only what the worker already made through `lens.js`: never a state's `mine`, `tape`, `rap` or `people`, never the claimed agent's own card, never a reset's backfilled log. **Only `camera/director.js` may import it**, and nothing on screen shows it: `tools/broadcastcheck.mjs` greps for that (no other import of `ahead`, no namespace, default or dynamic import of the module in page code, no re-export, no call; `broadcast.js` touches no window, document or postMessage; the director never puts it on a line that reaches the window, the DOM or the console), self-tests the grep with 9 planted violations, and checks what `ahead()` returns against the lens over 12 game hours with an owner claimed.
- **Checks:** `node style/city/tools/clockcheck.mjs` (the delay scenarios: steady, join, a join with backfill, loop, pause, hidden 6 s, 30 s and 90 s with timers once a minute, speed-up: 0 frames backward, |err| p95 ≤ 0.1 game min where the sim runs steadily, at most one message a release) · `node style/city/tools/broadcastcheck.mjs [--port 5474]`.

## The lenses (decided 2026-10-01, built in the sim: deadnet 77ce68c)

| Lens | Who | What |
|---|---|---|
| **LIVE / public** | everyone | What someone on the street could see. Agents: handle, cls, model, look, status, at, trip, act, home, crew, wear, drip, marks, lastSay, x, z, npc, localOf, retired, and `wanted` instead of heat. Lots without stash, crews without treasury, loans, hires without money, trend, drop, corners, cityEv, news, and events with `think` stripped and private types removed (the ledger's payouts, refunds and worn-out tools too). **Never** cash, heat, stash, inventory, thoughts or plans. |
| **MINE / owner** | the owner (handle + token) | public + `me` + `myEvents` |
| **TAPE / director's cut** | everyone, delayed | the full snapshot and events from `delay` game minutes ago (default 1440), `pending` before |
| **ARCHIVE** | a finished season | everything, always. The replay's `--archive`: every state says `archive: true`, the city's rules below are off, and the director's cut and the tape run with no delay. |

**The city's rules (slime, 2026-10-07).** LIVE shows only what a witness on the street could know. Everything else goes on the tape a day late. These rules hold on the city's side now (`lens.js` `cityRules`, `cityEvents` and `ownerEvents`). They run after the sim's verbatim `publicView`, in the replay's public, owner and `/events` answers, and again in the store.

1. **DMs** (`say` with `dm: true`) are private.
   - They leave the public events, the public log and `lastSay`. An agent whose last line was a DM shows its last line said out loud, or none.
   - They stay on the tape, in archive, and live to both parties' owners (`myEvents`).
2. **Burglaries:** the public event says the house was burgled and names no burglar anywhere.
   - `who` is stripped, and "@X failed to break into …" becomes "someone failed …".
   - Nothing else that minute names them either: a victim's crew payback call, or the burglar's hospital trip. Only a break-in sets a dog on someone, so the one bitten IS the burglar: "@X was taken to St. Mercy: bitten by @Y's dog" is "someone was taken to St. Mercy: bitten by a dog", with `who` stripped (2026-10-10; it named the burglar before). Their card still goes to St. Mercy at that minute: see "Still open" under the arrival minute.
   - **A break-in is found** (slime 2026-10-10, the 10-09 leftover #1, option a). The minute a burglar arrives is the burglary's, and a reader can re-plan the arrival (rule 5, "the arrival minute" below). So a burglary goes public when it is **discovered**, not at its minute:
     - The sim (`rules.mjs` `FOUND { near: 40, min: 60, max: 360 }`, `game.mjs` `foundTick`) emits a burglary nobody noticed with `secret: true` at its own minute, not as news. The tape has it then, and so do the owners (the victim's `myEvents`, the burglar's). The victim's crew's payback call waits for it to be found (below).
     - It is found at the end of the first minute when anyone but the burglar ARRIVES at the house or at a lot within 40 m, when the owner wakes up there, or else by a passer-by 60–360 game minutes later (drawn per burglary off its own seeded stream: the game's RNG is untouched, and a run's other events stay the same). Then every waiting break-in of that house is reported: a public `burgle` with `of` (the burglary's id), `found` (`owner`, `woke`, `neighbour` or `street`), `to`, `at`, `ok`, the take, and no burglar. "@Y came home to find their house (Pad 1 Sunny Acres) burgled: 12cr", "@Y's house (…) was found burgled: …", "signs of a break-in were found at @Y's house (…)".
     - At once, as before: when the alarm went off (the street heard it), the dog bit, or the owner woke up.
     - Nothing public moves at the burglary's minute: the live `stats.burglaries` is the sim's count of the public ones (`burglariesPublic`; `stats.burglaries` on the tape still counts every attempt at its minute), and the lot's `burgled` scars and wrecked security (the event's `secBefore`) show as they were until it is found (`lens.js` `unfoundOf`, from the record).
     - `simstate/timeline.js` skips a report (`of`): the tape applies the break-in once, at its minute.
     - What a viewer sees change: break-ins reach the news ticker, CH 9 and the boards when they are found, mostly 1–6 game hours later (2.5–15 real minutes), at once with an alarm. The text says who found it. On the tape they keep their minute and their burglar.
     - **The victim's agent learns when it is found** (2026-10-10, a leak the privacy build found: in a model run the victim could speak of the break-in before the street knew). Its memory lines ("your house was burgled while you were out …", "the break-in wrecked your lock"), its payback right on the burglar (its menu's KILL RIGHTS line names them), its crew's call (the crew's memories and rights, and the `crew_payback` event, public and anonymous like any burglary's) and the `robbed` plan trigger all come at the report's minute (`game.mjs` `victimLearns` from `foundTick`), or at once when the street knows at once (the alarm, the owner woke). Until then its own view of home (`HOME STASH`) is as it was: the stash's cash and stacks, the wrecked security, no scar (`homeView`).
     - **The owner's feed keeps the true minute** (chosen 2026-10-10): the victim's `myEvents` has the break-in at its minute, anonymous, as above. The owner is the human; the feed is their private panel, not the agent's knowledge (`sim2/moods.test.mjs` checks both).
   - The tape names the burglar.
   - The victim's owner sees the name live only if the victim saw them:
     - the victim's lot has CCTV: a security entry named `cctv` or `camera`, active at the time. No such item exists yet, so today this never fires, and `alarm` doesn't count;
     - or the victim woke up (`woke` on the event). The sim's own memory already gives the victim the name then.
3. **Robberies with `seen: false`** are public with no robber named.
   - "@Y was robbed at …", "someone tried to rob @Y …", with `who` stripped.
   - Nor is the robber named in what the robbery sets off that minute, even where the sim emits it just before the robbery:
     - the victim's "hurt in a robbery by @X" (now "hurt in a robbery") and a failed robber's own trip "@X was taken to St. Mercy: beaten off by @Y" (now "someone was taken to St. Mercy: hurt in a fight", `who` stripped: the one beaten off IS the robber; 2026-10-10, it named them before);
     - a bounty collected and a crew's payback call;
     - a death or GHOST mark "shot during a robbery at P" (now "shot at P", the killer `to` dropped).
   - Each of these keeps its names only when the same list shows how they were known: a seen robbery, or an arrest for a bounty. Otherwise it is anonymous, which is the safe side.
   - The victim's owner sees the robber live. The tape names them, and so do a report, a warrant or an arrest.
   - `seen: true` (or a run that doesn't record `seen`) stays fully public.
4. **Stats:** the counts of private event types (`SECRET_STATS`: scams, bribes, tips, gives, posted, expired, plansSet, planSteps, planInvalid, triggersFired, invalid, parseFails, fallbacks) leave the live `stats`.
   - They come back as yesterday's totals in `statsCut`: `{ asOf, ts, delay, …counts }` from the director's cut, null while pending. The store reads it as `sim.world().statsCut`, and `sim.world().stats` holds the live public counts.
   - Counts of public crimes (robberies, burglaries, arrests …) stay live.
5. **Whereabouts:** an agent at a lot it doesn't own (someone else's house, or a vacant one) is shown only coarsely.
   - `at` becomes the district (`'dist:trailer'`), `x`/`z` the district's middle, and `act` null. A trip there or from there gets the same treatment.
   - Its move, say and deal events there name the district: "heads somewhere in Sunny Acres". Its `arrive` there, and its move out, are not public at all (see the arrival minute).
   - **Trip legs** (the movement contract, MOVEMENT.md §3), on the agent's `trip` and on `move` events: a leg that starts or ends at the lot (`from`, `to` or `at`) gets the district id and `coarse: true`, and loses its metres (`m`).
     - "At the lot" counts every id that stands for it: the lot's own, or one the export derives from it, as the kerb where a cab or a bike stops for it (`kerb:lot:-284,134`; any `<prefix>:<lot id>`). Audit F05 (2026-10-08): the kerb leg used to keep the lot's id, the whole ride to the door and its metres.
     - Its `path` is cut where it enters the lot's zone: the lot's district (by the nearest place) or within 60 m. Going there, the path runs up to that point; leaving, it starts from there. A walk inside the district, or a wait at the lot's kerb, has an empty path.
     - A wait's spot (`at`, where a cab is hailed) in the zone is dropped, and so is the trip's total `metres` (the export's trip shape).
     - The other legs stay public (a street witness sees you ride the bus).
     - A coarse trip has no fare: a cab's fare is its length.
   - **The arrival minute** (ui-review 2026-10-09 #1; slime: "a coarse trip to someone else's place drops its arrival time"). The minute a burglar arrives is the burglary's minute, so a trip TO someone else's lot carries no arrival:
     - The agent's `trip` and the `move` event lose `arr` and `fare` (a cab's fare is its length), and the move's text loses its duration and fare: "(27m on foot)" → "(on foot)". Any coarse trip also loses the export shape's `seconds` with its `metres`.
     - In the legs, the public clock stops where the public path does (`coarseLegs`). The leg that reaches the lot ends when its path enters the lot's zone: its own `dep` → `arr`, scaled by the share of its path before the zone. A cab therefore drives its public stretch at its booked pace. Every leg after it (a cab's kerb to the door) starts and ends then. A leg with no public path ends at its departure.
     - Its `arrive` event at the lot is not public: it says nothing but when. The owner (`myEvents`) and the tape have it.
     - **The card.** An agent in transit (no `at`) to someone else's lot is shown there already ("somewhere in Sunny Acres", no trip, `active`) once the trip's public clock has stopped. A card shown by district is `active`, never `busy`. So nothing on the card changes at the minute of arrival. Before, the trip ended and `busy` turned `active` right then: 19 of the 23 burglaries in the 10-09T12-43 dry run.
     - **The departure, the mirror** (2026-10-09 follow-up). In the 09-29 mixed run (a real model run), 54 of 66 arrivals at someone else's lot were followed by a departure in the same minute, and that public departure gave the arrival back. One burglar also left in the minute of the burglary. So a trip FROM someone else's lot hides its departure:
       - Its public clock starts where its public path does. The leg that leaves the lot's zone starts then, scaled the same way (`exitT`), and every leg before it (the walk to the kerb, the wait there) starts and ends then. The trip's `dep` is that minute. A leg with no public path starts at its arrival. One leg from a lot to a lot with no public stretch starts and ends halfway.
       - The card shows the agent still there until that minute.
       - Its `move` event is not public live. The event's minute, and its place in the log (ids run with time), are the departure. The owner and the tape have it.
       - Its arrival at a public place stays public. The trail (`trails-data.js`, with `opt.pos`) ends a district stay at the agent's next public `arrive` at a public place.
       - Checked: on the 09-29 run, arrivals with a public event of theirs that minute went 54 → 0, and the card doesn't change at any of 66 arrivals or 65 departures. On the 10-09T12-43 dry run, 19 arrivals and 20 departures.
     - Still public: a trip TO the lot keeps its departure from a public place (`dep`, the move's `t`), its mode and its origin. With the export's planner (`world/export/travel.mjs`, public code) a reader can re-plan a trip to a candidate lot, such as a burgled house, and get its arrival back: 20 of the 23 dry-run burglaries to within a minute (10-09), 128 of 145 on seeds 404–408 (10-10). **Closed on the burglary's side** (slime 2026-10-10, option a): the burglary is public only when it is found (rule 2, "a break-in is found"), so the arrival no longer meets its minute: on fresh dry runs of seeds 404–408, within a minute 128 of 145 → 1 of 143, within 5 minutes 132 → 7. The agent's next public arrival still bounds the stay, a `say` or deal there carries its minute, and a reader who knows when the house was last seen whole can still ask who came to that district in between: in a dry run that is often the burglar alone.
   - **The director's warn** ("@X got word that @Y is heading to their house") is only ever about a trip to someone else's lot, and names whose house. It is not public live. The warned owner has it (`myEvents`), and so does the tape.
   - The map draws a coarse cab ride as far as its public path goes. A cab to the lot drops nobody there: the rider stays in, out of view, to the end of its public clock (the arrival minute above), and the cab is let go from there. A cab from the lot rides out of view, and the rider appears at its public end (`movement.js` `vehicle`).
   - The store's card says `now: "somewhere in Sunny Acres"`, with `placeName` = the district and `coarse: true`. `sim.where()` gives the district's middle with `coarse: true` (null on such a trip unless the walker is drawn).
   - **A public act at that lot keeps it visible:** a cop's raid or search, a seen robbery, or buying the lot (claim). A burglary names the house, never the burglar.
   - **The owners then** (2026-10-09, for the public rewind). Whose lot it is, for an event, is decided by the owners as of the event's own minute (the end of that minute), never today's owners. A card takes the state's own lots, which are the owners at its minute.
     - Before, `/events`, `/state`'s window and every later serving lensed past events with the owners of the moment they were served. An event lensed later could then come out less coarse than it was live. The repro (10-09, on the real sim and on the replay): an agent goes to someone's house, says something there and breaks in; the owner moves up to an estate; the burglar buys the house. Then the burglar's move there (with its arrival minute, the burglary's), the `arrive` and the `say` all came out precisely, which names the burglar. The other way round, an agent's own home's events turned coarse once they moved out: 782 events in 25 of the 47 recorded runs with a claim (1 in the 09-29 run).
     - Now each server keeps a book of the owners over time (`lens.js` `ownerBook`; `cityEvents` / `cityRules` / `publicOf` take `opt.ownersAt`). The replay notes the owners at every claim, eviction and snapshot (the timeline). The sim notes them at the end of every minute and at once on a claim or an eviction. An event served later is the form it had live: `tools/rewindcheck.mjs` checks it.
     - The same holds where a list is cut: `/state`'s last 150 events, its last 30 news and `/events?since=<id>` now find a minute's robberies and arrests in the whole log so far (`opt.context`). A victim's "hurt in a robbery by @X" lost its robber when the seen robbery fell just outside `/state`'s window or its news (#1570 and #1237 in the 09-29 run).
   - The tape and archive show the real lot. The agent's own owner sees it live: the claimed agent's card, `me` and `myEvents`.
   - The map gets the same coarse `at` from the replay's public view. It doesn't draw an agent at a `dist:` place or walk a trip to one; the adapter notes the unknown place once.
6. **The Most Wanted (slime, 2026-10-09; ux-critique privacy note 1).** The sim's own Most Wanted (`game.mjs` `mostWanted`: the most `n.crimes`, at least 3, picked at each day's start) counts unseen burglaries and robberies too. Live, it named a burglar whose 23 break-ins were all anonymous.
   - The live one (`mostWanted` in the public state, `sim.world().mostWanted`) counts only crimes on the public record (`lens.js` `publicRecord`): a robbery the street saw (its robber named; a payback is not a crime), a warrant (the victim's report names them) and an arrest. It needs at least 3 (`MW_MIN`, the sim's own floor), and the agent must not be dead or retired. A tie goes to whoever got there first.
   - It is counted over the whole log so far: `opt.record`, the raw log. The sim passes `g.events` and the replay the run up to now. Without one, a full state counts its own `events`, which is fewer but still public only.
   - A public state carries `mostWantedFrom: 'public record'`. When the store lenses an already-public state again, it keeps the pick only with that mark. An older server's own pick (the sim's, unmarked) is dropped.
   - The sim's own ranking is on the tape (the director's snapshot) and in the archive.
   - **The bounty** (2026-10-10, the 10-09 leftover #2). It went to the sim's own pick, and "@X collected the 20cr bounty on the Most Wanted, @Y" named a burglar nobody saw. Now the sim pays it on the public record's pick (`game.mjs` keeps a `recordBook`), the one live shows, at most one a day as before; its menus' MOST WANTED line and tag name that pick too. The event carries `mostWantedFrom: 'public record'`. An unmarked one (an older sim: its own pick) is not public live; the tape has it. The TV's Most Wanted card could promise the bounty again.
   - **Counted once** (2026-10-10, the 10-09 leftover #4; it counted records: one robbery seen, reported and arrested was 3). A robbery the street saw is one crime. A warrant for a robbery (its text says "robbery") is one of theirs the street saw that nobody had reported yet, within a report's reach (`MW_WARRANT`, `rules.mjs` `WARRANT.minutes`, the oldest first), else one more (a robbery nobody saw, now reported; selling fakes). An arrest is for what came since their last arrest (an open case), else one more. A warrant doesn't say whose report it is, so a seen robbery of one victim can take the warrant of another's unseen one: one fewer, never one more.
7. **The WANTED flag** (2026-10-10, found by the planner). The sim's `wanted` on a card (the verbatim `publicView`) is heat ≥ `HEAT.wanted`, and heat rises on what nobody saw: an unseen robbery, a burglary, a private sale, cooking, a secret tip, cash over a line. So a public WANTED marker told the street about crimes it can't know, and the boards rank by it. Live, `wanted` comes from the public record instead (`lens.js` `wantedOf`, set by `cityRules` when it has the record): the police's PUBLIC grounds to arrest, the sim's own grounds less what nobody saw. That is a warrant newer than their last arrest and under a day old (`MW_WARRANT`, `rules.mjs` `WARRANT.minutes`, a warrant's life), or a robbery the street saw newer than it and under an hour old (`MW_SEEN`, `COPS.arrestWindow`, how long a witnessed crime is grounds). Never from heat, so it never moves at the minute of a hidden crime. A viewer sees many more WANTED cards than before (on seeds 404–408, 0–181 agent-minutes a run on heat; 7,000–14,600 on the record, almost all of them an open warrant), and none for crimes nobody saw. The tape and the owner (`me.heat`) keep the sim's own. A state that is already public (the store's second pass) keeps the flags it was served with.
8. **Private acts** (2026-10-10): `lens.js` `PRIVATE_ACTS`, what an agent does to its own pockets and body out of sight: `cut` ("cut their temp: now 6 units": the stack and its count), `use` ("took temp — it was really HALLU") and `sober` (a look wearing off: the drug, when and where it was taken). Never public as they are, marked `secret` by the sim (since 2026-10-10) or not; `leaks()` counts an unmarked one. The tape and the agent's own owner (`myEvents`) keep them. `use` and `sober` have a public form outdoors (rule 9).
9. **A drug's name is never public live** (slime 2026-10-10; live shows only a behaviour family, the name becomes public after it wears off, the owner always sees their own agent's). Besides `use` (above): a `say` on TRUTH carries "[VERIFIED, on TRUTH] … (thinking: …)". In public `say` events and in `lastSay` the marker is "[VERIFIED]"; the thinking text stays (it is the drug's own mechanic). The tape and the owner (`me.lastSay`, `myEvents`) keep the original. `tools/lenscheck.mjs` fails on "on TRUTH", "it was really", "took <drug>" or "HIGH ON" in any public event or `lastSay`, and checks that the tape and the owner still have them.
   - **Visible highs** (slime 2026-10-10: live shows only three behaviour families, only outdoors; a drug's name becomes public only after it has worn off; the owner always sees their own agent's drug live). `lens.js` "+ VISIBLE HIGHS":
     - **The card's `mood`:** computed in `cityRules` (after rule 5) from the sim's private `high` and `haze`: TEMP → `wired`, FIREWALL → `guarded`, HALLU, CLEAR and SUDO → `spaced` (by the haze alone), TRUTH → nothing ("[VERIFIED]" on its says is all). Stacked: WIRED > GUARDED > SPACED. A state without `haze` (an older sim) shows no spaced look.
     - **The haze** (the sim: `rules.mjs` `DRUG_FX.haze`, `SPACED`): any spaced drug sets `haze` to 3 turns, counted down with the doses. The spaced look shows while the haze lasts, so its length is the same whatever the drug (hallu lasts 3 turns, clear and sudo 1). `haze` is private (`PRIVATE_KEYS`), like `high`.
     - **Only outdoors:** the drug is on, the card is `active` or `busy`, not shown by district (rule 5), and the agent is (a) at a place of an OUTDOOR kind with no trip, or (b) on a trip whose current leg, on its public clock (the lensed legs: a trip to or from someone else's lot counts only its public stretch), is on foot, on a skateboard, a bike or a scooter, or a wait at the kerb for a taxi. Without places, never.
     - **OUTDOOR** = corner, plaza, fit, park, hangout, site, court, police, motel: the kinds the city draws its agents standing outdoors at (`simstate/stands.js` `STAND.radius`: "kinds not listed: indoors only"), less Iron Island's yard (`jail`). Never a home or any lot, the 24/7 Store, a forest lab, St. Mercy or Iron Island; never in a taxi, on the subway, its stairs or its platforms.
     - **`use`, public form:** a dose taken outdoors (the event's `at`, since the sim gives it one) is "@X took something" at its minute: `{ id, t, ts, type: 'use', who, at, text }`, no drug, label, fake or card. A fake reads the same. Anywhere else it is not public.
     - **`sober`** (new, the sim: `game.mjs` `soberUp`): `{ type: 'sober', who, drug, from, to, at, usedAt }`, `secret`, when a look ends: a drug's own turns (temp, firewall, truth), or the haze for a spaced one (never before the drug itself; every spaced look ends with the haze). `from` is the dose that started the look (a dose taken while the same look shows continues it), `to` the minute it ended, `at` where the agent is (one leaving that turn: where it left), `usedAt` where the dose was taken. Public only at an OUTDOOR `at`, at its minute: "@X was on SUDO (12:02–12:10)", with `from` (and `usedAt`) only when the dose itself was taken outdoors, else "@X was on SUDO until 12:10". Elsewhere it is on the tape only.
     - **One form everywhere:** `publicOf` makes the forms before the verbatim `publicView`; every other path that builds a public log from the raw one (the sim's and the replay's `/events` and public tape) takes `livePublic(e, places)`. `cityEvent` re-derives the form from what it is given, so a second pass (the store) gives the same.
     - **The rap** gets a `sober` entry from a public `sober` only. **`nowOf`** appends the family word. **`timeline.js`** applies `use` (the drug on; a spaced one sets the haze) and `sober` (gone; a spaced one ends the haze) between snapshots, so the replay's cards move with the events (the sim counts doses in turns: between those two only the snapshot knows its numbers). The public tape's snapshots carry no `mood` (deferred: plan decision 16).
     - **The owner** sees their own agent's drug live: `me.high`, `me.haze` and the raw `use` and `sober` in `myEvents`. The tape has every one.
     - **Checked:** `tools/lenscheck.mjs` L1–L7 (section 1d and every hour of the run; see the anti-cheat check below), `sim2/moods.test.mjs`.
- **The owner's `myEvents`** hold only what the agent itself could know (one exception: the victim's owner has a break-in at its minute, before the agent learns of it: rule 2). Other agents' events lose their `think`. A secret `tip` or `scam` by someone else (the agent doesn't know it was tipped on or scammed) waits for the tape.

**Where it is enforced.** `lens.js` holds the sim's `PRIVATE_EVENTS`, `publicEvent` and `publicView`, copied verbatim from `sim2/server.mjs` @ 77ce68c. Outside that block, `LEDGER_EVENTS` (the ledger events above) are private by type. `tools/lenscheck.mjs` fails if the sim's copy changes. The replay serves through it. The store applies it again to whatever arrives (a full state, such as the replay's `--view full`, is cut down here), then scans the result for any private name (`leaks()`). A leak blanks that poll's events and counts in `sim.info.stats.leaks`.

**One difference from the sim, on purpose:** the sim passes `news` raw, and news items are the same objects as events, with `think` attached. The lens runs news through `publicEvent` too.

**The anti-cheat check:** `node style/city/tools/lenscheck.mjs` (no browser). For every game hour of the test run, it checks the replay's public, owner (the public part) and pending-director answers, and the store's derived public output. None may hold a private field or a private event, and each of the city's rules must hold: rule 5 with the arrival minute (no `arr`, fare, leg ending at the arrival or timed text on a trip or move to someone else's lot, no "arrives hh:mm" on its card, no `arrive` there) and its mirror (no move FROM such a lot, no trip from one starting at the departure). At every arrival at, and departure from, someone else's lot in the run, the live card a game minute before and at that minute must be the same, and rule 6 (the live Most Wanted, in every public, owner, full-through-the-lens and store answer, has at least 3 crimes on the public record, counted from the run itself). Every owner's `myEvents` is checked against the owner rules. Positive checks confirm that DMs reach both owners, that an unseen robbery's victim's owner sees the robber, and that the tape names burglars and carries DMs. Positive checks also confirm that the sim's own Most Wanted is held for the tape, when the run's sim names someone the street can't know. Self-tests plant a violation of each rule, and the lens must clear every one.

**Visible highs** are in the anti-cheat check too (section 1d, and every hour of the run, rule 9): L1 a card's `mood` is one of the three or absent, and `high` and `haze` are never public; L2 a mood shows only outdoors, active or busy, not by district (every hour, the public cards and the store's, against the full state; and planted: home, someone else's lot, the store, a lab, St. Mercy, Iron Island, asleep, by district, a taxi, the subway, its platform and stairs, TRUTH only, a trip without legs, no places → none; corners, the plaza, the park, a dig site, the motel, the trailer park, walking, skating, cycling, the kerb for a cab, a public stretch → shown); L3 the mapping and WIRED > GUARDED > SPACED; L4 hallu, clear and sudo give byte-identical public JSON until their `sober`, planted and on the sim itself (its `game.mjs` in process: three cities alike but for the drug); L5 no drug live: a public `use` is "@X took something" at an outdoor place, a public `sober` comes at its end, outdoors, with its start only for an outdoor dose, `/events` serves the same forms as `/state` and the store's second pass, and planted violations are caught; L6 the owner and the tape have the drug, and the rap names one only from a public `sober`; L7 the verbatim drift check (section 0). It also runs a dosing city (the sim's `bench/dose.mjs`: every player starts with a dose of each drug and takes one at 15% of its turns, a game day) through the lens every 5 game minutes and says how much of the drugs' time a look shows (seed 404: about 85%; wired 78%, spaced 93%, guarded 60%; 16% of all player time).

**The public tape and the owners then** are in the anti-cheat check too (section 3b: the public tape at every hour; every event checked against the owners as of its own minute).

**The rewind check:** `node style/city/tools/rewindcheck.mjs [run] [--port 5544] [--seeds 404,405,406]` (no browser, no model). On the replay of a recorded run it takes every public event's live form (`/events` at the event's own minute), then at every hour checks that `/events?since=0`, `/state`'s events and news, and the public tape's events each serve that same form (0 mismatches). It checks that every public tape snapshot equals `publicOf` of the full state at its minute, with the owners as of each event's minute read from the run minute by minute, and equals the live public answer then. It checks that `/state?lag=k` equals `/state` k minutes before, and that the public tape is never past the edge. With `SIM2` set to a sim that has the public tape, it runs the same on the sim itself, in process (`--dry` seeds, plus one with homes bought every 6 game hours). Self-tests plant the burglar who buys the house, which the old way (today's owners) fails, and a planted snapshot and past-the-edge answer.

**The whereabouts check (audit F05):** `node style/city/tools/wherecheck.mjs [--draw] [--old | --at <rev>]` (no browser, no port). It plans real trips on the export (`world/export/travel.mjs`) in every mode, to and from 31 foreign lots, and serves each as a `trip` and a `move`. No public form may name the lot (its id, an id derived from it such as its kerb, or its name in the text), and a leg at the lot keeps no metres, path point or wait spot in its zone. Public legs, trips between public places and trips to the agent's own lot are unchanged, and no `warn` is public. Section 5, the arrival minute: every mode to and from those lots, as trip, move, `arrive` and card (see rule 5): no arrival on a trip to the lot, no departure on a trip from it, and the card doesn't change at either. Section 6, the Most Wanted: a sim naming a burglar with 23 unseen break-ins; live, the store's second pass, an older server's state, the owner view, the floor, a dead pick, the archive and the director's cut. `--draw` runs the real movement (cabs and traffic) and checks that the rider and the cab are never drawn in the lot's zone. `--old` runs the lens from before the F05 fix, and `--at <rev>` any committed lens (`--at 861dbcd`: before sections 5 and 6; `--at 1bac2c9`: before the departure). Both must fail.

## Files

- `store.js`: the page API (main thread)
- `broadcast.js`: the delay line (both feeds), the join's backfill, `ahead()` (the camera director's only)
- `storeworker.js`: the worker
- `storefeed.js`: polling and derivation
- `derive.js`: the pure derivations (now, rap, people, tape)
- `lens.js`: who sees what
- `tools/simreplay.mjs`: the replay, every lens
- `tools/lenscheck.mjs`: the check
- `tools/wherecheck.mjs`: the whereabouts check (rule 5's derived forms, audit F05)
- `tools/broadcastcheck.mjs`: the broadcast delay's check (the grep gate, the line, the lookahead against the lens)
- `tools/rewindcheck.mjs`: the public rewind's check (the public tape against the public answers, every event against its live form)

## Requests to the sim (sim2/server.mjs; the sim session owns it)

0. **Take the city's rules (above) into the server.** Until then the city enforces them. The owner view's `myEvents` also passes other agents' `think` today, and tips and scams on the agent.
1. **`news` leaks thoughts.** `publicView` passes `g.news` raw. News items are the same objects as events, with `think` attached: 73 of the 09-29 run's news items carry one. Fix: `news: g.news.map(publicEvent).filter(Boolean).slice(-30)`. The lens does this on the map's side meanwhile.
2. ~~**`GET /events?since=<id>`**~~ Done (deadnet-sim-move b46c49e, the replay's shape): the store polls it whenever a window falls short (`sim.history()`).
3. ~~**`GET /tape?from=&to=[&handle=][&snaps=0]`**~~ Done (b46c49e, the replay's shape).
4. **A finished season:** `archive: true` on every state, with the director's cut and the tape undelayed.
5. ~~**`GET /state?lag=<game min>`**~~ Done on the sim's branch `sim/public-tape` (2026-10-09): the same answer, any view, as of `lag` game minutes ago, from a ring of the last 32 minutes (further back: the oldest kept, and `lag.minutes` says how far it went), plus `lag: { minutes, t, ago, rate }` (the state's `t`, how many real seconds ago the sim entered that minute, null when its clock isn't running in real time, and the pace in game min per real s). The owner view's plan, triggers, notes, memory and `sees` are the ones now (the sim keeps no past of them). The replay serves the same (`tools/simreplay.mjs`).
6. ~~**`GET /tape?view=public`** and **the owners then**~~ Done on the same branch: the public tape above, and every public event lensed with the owners as of its minute.

### Decided (slime, 2026-10-07)
DMs, burglars, unseen robbers and secret stats: see the city's rules above.

### Still open for slime
- **A crew's payback call** after a burglary or an unseen robbery is now anonymous in public. The crew knows (the sim tells its members), but the street doesn't. Should a crew's call-out name the culprit publicly, as a report does?
- **Bounties:** a bounty collected through an unseen robbery is now anonymous.
