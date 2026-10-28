# What the UI needs from the store (section 1)

Short list for the data side. The UI works around each one today.

1. **The look the city draws, per handle.** The dossier portrait has to show the agent in its real look. `simstate/looks.js specOf()` isn't exported, so `ui/portrait.js` repeats it: the cast roll seeded by FNV-1a of the handle, plus the county jumpsuit in jail. If `looks.js` changes (for example when the sim's `wear` starts being drawn), the portrait drifts from the walker. Wanted: `sim.lookOf(handle)` or an exported `specOf`, the exact spec the walker wears.
2. **Nothing else blocking.** `sim.where()` is cheap enough to call for every agent every frame (24 agents ≈ 0.15 ms for the whole pins pass, projection included), and `agent:<handle>` events drive the dossier at ≤ 4 Hz.

# What section 2b (trails, heat, diary, clips) needs from the store

1. **A burglar's `move` is public.** The public log keeps the burglar's trip into the victim's lot ("heads to Pad 7 Sunny Acres") and,
   minutes later, the burglary at that lot (its `who` stripped). Side by side they name the burglar, which the city's rule 2 forbids.
   Trails work around it (`ui/tape/trails-data.js`: on LIVE, a stay at someone else's lot that was burgled during it, and the trip into
   it, are left off the trail; `ui/tools/diarycheck.mjs` checks all 12 of the run). The store's own `sim.events()` still has the move.
   Wanted: the lens holds back (or blurs to "heads into Sunny Acres") a move whose destination lot is burgled during the stay, until the
   tape. Same question, weaker, for an unseen robbery: the robber's trail shows it standing at that corner at that minute.
2. **`sim.tape.get` returns every event in the range.** The diary of one agent asks for one game day with `handle`: fine. The deals heat
   map asks for a whole day of everyone (~1–2 MB on a busy day). A `types=` filter on `/tape` would cut it to the deal events.

# What section 3a (ticker, City TV, the boards) needs from the store

1. **The economy's public fields.** `sim.world()` doesn't carry `trend`, `drop`, `inSlot` or `corners`, though the public view has them
   (`lens.js publicView`). The City panel's Economy tab works around it: while that tab is open it reads `GET /state?view=public` every
   5 s and cuts it through the same lens (`publicOf`), keeping only those four fields (`ui/city-info/boards.js fetchEcon`). Wanted:
   `sim.world()` → `{ …, trend, drop, inSlot, corners }`, and the fetch goes.
2. **The season's length.** The clock says "Day 4"; "Day 4 of 7" needs the season's days in the public state (the run's `meta.json
   days`; the sim's `R.SEASON` if it gets one).
3. **The city's books on the cut.** The pool and the city tax (`pool`, `money`) are read from the director's last snapshot through
   `sim.tape.get` (Economy tab only). A `sim.tape.books` (the cut's `pool` + `money`, like `statsCut`) would save that request.
