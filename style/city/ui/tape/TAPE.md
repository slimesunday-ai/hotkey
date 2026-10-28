# THE TAPE PLAYER (human layer, section 2a)

A watcher scrubs back through the director's cut and watches the city replay with its secrets visible: thoughts, DMs, private deals,
cash. **Only up to the horizon**: now − delay (one game day by default). A finished season (`simreplay --archive`) is open end to end.

```js
import { tape } from './ui/tape/state.js'      // window.__tape in the console
```

## The rule

`tape.time()` is never past the horizon. Every seek, step, jump and play is clamped in `state.js` (`_clamp`), the data side drops
anything past the horizon even if a server sends it (`simstate/tapeplay.js`), and `tools/lenscheck.mjs` checks both.

**The horizon is the broadcast's.** The page's tape window is the worker's (the server's now − delay) capped by the store's own
`sim.tape.horizon`, the director's cut of the states the delay line has released: the tape is one game day behind the LIVE on screen, not
behind the sim D seconds ahead of it, and moves with it every tick (ARCHIVE: open end to end).

**The clock going back** (a replay's loop or seek back, a restarted sim: review 10-09 #5, where the tape kept its old horizon and showed
1229 game min past the allowed one) is a new epoch, with broadcast.js's test (t < the last t − 1): the store emits `'epoch'` the moment
its delay line flushes; TAPE closes ("the tape starts over"), the worker starts an empty player and the page drops its copy of the
events and markers. The data side drops what it holds on its own too, when a server's horizon is more than a minute behind the one it
holds, and the worker then fetches the whole tape and tells the page (`reset: true`). `tools/lenscheck.mjs` section 6 checks a player
fed the late moment, then the early one: nothing past the new horizon.

## The API (`ui/tape/state.js`)

| | |
|---|---|
| `tape.active` | TAPE is open |
| `tape.lens` | `'tape'` (a live season) or `'archive'` (a finished one) |
| `tape.handle` | the agent the tape was opened at, or null |
| `tape.time()` | the game minute on screen (a float), null while closed |
| `tape.clock(t?)` | `{ t, day, hh, mm, hhmm, ts: 'D3 14:05', label: 'Day 3 · 14:05', night }` |
| `tape.window()` | `{ start, horizon, loadedTo, delay, archive }`: the first minute on tape, the newest it may show (moves on with the live city), how far the page holds data |
| `tape.playing`, `tape.speed`, `tape.rate` | speed is one of `tape.SPEEDS` (1, 4, 16, 60 × the sim's own pace); rate is game minutes per real second |
| `tape.on(type, fn)` | → unsubscribe. Types below |
| `tape.seek(t, by)`, `play()`, `pause()`, `toggle()`, `setSpeed(x)`, `jump(min)`, `step(±1)` | controls (clamped; `step` lands 0.01 min before the event; `play()` at the end goes back `EDGE_BACK` (2 game hours) before the horizon in a live season, to the start in ARCHIVE) |
| `tape.open({ handle, at })`, `tape.close()` | open TAPE (at an agent: selected and followed) · back to LIVE, everything as it was |
| `tape.events({ from, to, handle, types, limit })` | the tape's events, oldest first, private ones too, never past the horizon |
| `tape.markers()` | the timeline's markers: `[{ id, t, kind, type, text, who, to, at }]`, kind `rob`, `arrest`, `death`, `mark`, `turf`, `director`; `type` is the event's (`burgle`: a break-in, kind `rob`). A break-in's report (a public `burgle` with `of`, when it is found) is no marker: the tape has the break-in itself, at its minute |
| `tape.stateAt(t)` | → Promise of the FULL sim state at t (agents with cash, heat, inv, at, trip, x, z; lots; crews), clamped |
| `tape.agent(handle)` | the tape's view of one agent at the tape time: `{ live, rap, people, tape, asOf }` (what the dossier shows) for the agents in focus (dossier, follow); for anyone else `{ live, partial: true }` (the card: the hover label uses it) |

### Events (`tape.on`)

- **`mode`** `{ active, handle, lens }`: TAPE opened or closed.
- **`seek`** `{ t, by }`: a jump (`by`: `scrub`, `step`, `jump`, `click`, `event` (a marker clicked: goToEvent), `open`, `rewind`, `seek`). The city snaps on a seek.
- **`play`** `{ playing, speed }`.
- **`time`** `{ t }`: at most 10 Hz while playing, and after every seek. For per-frame work read `tape.time()` in your own frame hook.
- **`data`** `{ window }`: the tape's data or horizon changed (loaded, extended as the live city moves on).
- **`timeline`**: marks, ranges or layers changed.
- **`end`**: play reached the horizon and stopped.

### The timeline (for 2b)

The transport draws these over its track, re-drawn on `timeline` and on every seek or resize:

```js
tape.timeline.marks('diary', [{ t: 2210, label: 'diary: @www.girl', color: '--k-yours' }])   // a row of ticks of your own; null removes
tape.timeline.range('clip', { from: 2100, to: 2280, label: 'clip 1' })                          // an in/out span; null removes
tape.timeline.layer('heat', (ctx, { x, w, h, from, to, dpr }) => { … })                        // your own canvas drawing; null removes
```

`color` is a kit token name (`--k-…`) or a CSS colour; prefer tokens (the skins differ, and slime may pick a new one).

## How it works

- **Data:** on open, `simstate/tapeworker.js` (a worker: the page never stalls) fetches `GET /tape?from=0&to=<now>` (snapshots and every
  event, clamped to the horizon by the server), then extends it every 10 s as the horizon moves on.
- **Between snapshots:** `simstate/timeline.js` advances the hourly snapshot minute by minute by the events: the same code
  `tools/simreplay.mjs` serves the live city with (one copy, no drift). It starts exactly where the sim took the snapshot (inside the
  hour's tick: that minute's tick events are in it, its decisions aren't) and moves **cash, pockets and the home stash** with every event
  that moves them, at its minute (audit F17, 10-09): buys, street sales (less the turf tax, a boss's share and crew dues), fares,
  digging, cooking, crafting, the boards, robbery, burglary, arrests, the hospital, loans, bounties, quests, homes, gifts, contracts, the
  stash, crews, dock wages and the 06:00 rent, tax and cops' pay. What the sim changes without an event (the Locals' hourly take, expired
  orders coming back, a pick wearing out) happens at the hour, where the next snapshot has it. A `buy` at 12:28 shows at 12:28, not 13:00.
  Outfits: today's `wear` events carry no slot, so they move only the pockets; `applyWear` is the hook for F15's structured ones.
- **The city:** `simstate/tapeplay.js` turns the state at the tape time into the same diffs the live feed makes (`adapter.js
  adaptLive`), and `ui/tape/map.js` hands them to the live layer and the walkers while TAPE is open. Live diffs keep arriving and are
  kept aside; back to LIVE applies them, so the city is exactly the live city again.
- **Secrets:** `ui/tape/bubbles.js`: thought bubbles, DM arcs, deal icons (selected agent + the nearest few, capped; T hides them).
  They keep out of a safe area: the page's top bar, the transport, an open panel, 2b's `.cl-bar` / `.ht-bar`, and anything marked
  `data-safe-avoid` (mark a new bar with it). An agent standing under the dossier gets no bubble.
- **An event, clicked** (`ui/tape/index.js` `goToEvent`, also `__ui.tape.goToEvent(marker)`): the tape goes 2.5 s of play before the
  event, the camera to the event's shot (`camera/shots.js`, TV plan A2: the two people in it, 8–14 m out, 25–35° down, a 3/4 view
  with nothing in the way of either, on the side of the line between them the scene keeps, so the payback minutes later is shot from
  the same side; where they will be: the place the tape has them at just before it; the Director's rush: its district, wide; near: a
  0.8–1.4 s flight, far: the cut behind the load-in's gate, then a 0.8 s settle), and once it is there the tape plays (at 4× at most). The stage (`stage/index.js`) plays the event out as the tape
  crosses it: it stages only what is in view and below 16×. All on the tape's own data and clock: the sim is never seeked.
  A break-in (`type` `burgle`) is shot at the house (establishing, its door; the burglar walking up to it in the shot), not at the
  victim, who is mostly out. A follow (Watch tape's) lets go at the click. A followed agent going underground on the tape opens no
  subway ride (the carriage pauses the city's loop: the tape's clock and its transport are in it). `tools/tapeclick.mjs` clicks the
  first markers of both lenses as a viewer does and fails on a click that goes nowhere, an error or a walker that stutters.
  `__ui.tape.visit` is the visit under way (`phase`: frame → fly → play). Any other seek, play or Esc hands control back.
- **Day / night:** while TAPE is open, `simstate/live.js`'s reload into the live sim's day or night is held off (its own 15 s loop guard,
  kept fresh); back in LIVE, once the camera is back, a reload that came due happens on the next live poll.

## Links

- `?sim=live&simport=<replay>&tape=1` opens TAPE as soon as the city is up; `&tapeat=D3%2014:00` at that moment, `&tapeagent=<handle>`
  at that agent (selected and followed), `&tapeplay=4` starts playing at that speed.
- `window.__tape` is `tape`; `__ui.tape.stats()` has the frame costs (worker round trip, apply, secrets).

## Checks and shots

- `node style/city/tools/tapecheck.mjs` (`--old` for the code before 10-09): the tape against full states. The audit's repros (F17 a buy,
  F18 a lost window), every hour of a recorded run against its next snapshot, and a dry city in-process (the sim's own game.mjs, no
  model) against its full state at the end of every game minute: 409 056 agent-minutes over six seeds, cash and pockets 0 wrong (716
  differ only by a pick the sim wore out without an event), the snapshot edge exact on all 432.
- `node style/city/tools/lenscheck.mjs` section 6: the tape player at three moments of the run, with data planted past the horizon,
  asked for times past it; the page's clock (seek, jump, step, play). Never past the horizon.
- `node style/city/ui/tape/tools/tapeshots.mjs --png <scratch>` then `python3 style/city/ui/tape/tools/tapesheet.py <scratch>`:
  the contact sheets and the clip in `shots/human-layer/s2/`.

## Keys (TAPE open)

Space play/pause · ← → previous/next event (it lands just before the event's minute, so Space plays it) · Shift+← → an hour back/on ·
Esc back to LIVE (when the dossier is closed) · T secrets on/off. A marker clicked: go there and watch it (above).
