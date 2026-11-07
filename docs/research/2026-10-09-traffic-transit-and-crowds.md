# Traffic, transit and crowds: what shipped games do, and what AI City should adopt

2026-10-09. Asks whether traffic needs research, and whether other modes of transport, such as buses, would work better.

This was a read-only review of AI City's `style/city/` as of 2026-10-09 (`traffic/`, `simstate/movement.js`, `simstate/simclock.js`, `pedsim.js`, `MOVEMENT.md`, `SPREAD.md`) and `world/export/travel.mjs`. Nothing was run. Every number about our code comes from the code or from measurements already logged in MOVEMENT.md and SPREAD.md.

---

## The answer first

**Yes, research helps. But it mostly confirms the bus design. Its real use is pointing at the one thing missing everywhere else: slack.**

1. **The buses are already built the way shipped games build things that must never fail.**
   - A bus run is a pure function of the clock, on its own lane, and the traffic yields to it (`traffic/buses.js`).
   - Driver San Francisco ran all its civilian traffic like this: cars moved "around a set of looping splines… Each spline had been defined to ensure that it did not interact with any other spline".
   - Distant cars there were "simply placed at the position defined by their path for that particular time".
   - Keep it. Don't put buses back into the car sim.
2. **The problems that are left come from zero slack and nowhere to absorb it.** Cabs shove cars forward, and skaters pass through people.
   - Every game that keeps a strict schedule builds in slack and a place to absorb it:
     - OpenTTD: "Provided the timetable has a little slack in it to account for traffic and busy stations, this should keep them in sync forever."
     - NIMBY Rails trains catch up because the line's speed limit sits below the train's top speed.
     - Hitman: Absolution keeps characters "on rails" and resolves a coming collision by changing speed along the rail first, then stopping, and only then bending the path.
   - AI City books cabs at exactly their drive time and riders at exactly their speed. Progress along the path is fixed, and no correction is allowed, not even where no camera can see.
   - So the only moves left on screen are pushing the obstacle (the cab's nudge) or going through it (a skater with no room to step around).
3. **I found no game that keeps timetables to the second for road vehicles in mixed traffic.**
   - Transit games either run on their own track (NIMBY Rails, OpenTTD rail), or let road buses run late and only space them out ("unbunching": Cities: Skylines, Transport Fever 2).
   - AI City's buses are stricter than any of them. That works only because they have their own lane, their own green, and cars that yield to them.
   - A cab can't own a lane. A cab booked to the second will keep fighting traffic until it gets slack.

**In plain words:** the bus approach is right. The cabs and the skaters need a few seconds of give, plus permission to quietly fix things where nobody is looking. Every open-world game does both.

---

## What AI City should do, ranked

Size: S is up to about a day of agent work with its gate, M is 2–4 days, L is a week or more.

Sync risk:
- **none**: the sim is untouched and every booked time is kept.
- **low**: a drawn position may trail its booking mid-leg by a capped amount, but every boarding and arrival is kept.
- **medium**: booked times change, so re-run the export and the sim and re-check mode balance.

| # | Do this | What a viewer stops seeing | Where it lands | Size | Sync risk |
|---|---|---|---|---|---|
| 1 | **Cabs get booking slack and stop shoving cars where the camera sees** | Cars jumping forward or speeding in front of a cab | `world/export/travel.mjs:166` (`taxiS`), `traffic/cabs.js` (`CAB.yieldOn`, the escort at :282, `afterMove` at :351), `simstate/movement.js` (the drop, `R.delay`) | M | **medium** (A), none (B, C) |
| 2 | **Riders and walkers give way by slowing, with a capped lag repaid before the next deadline** | Skaters, bikes and scooters going through people at corners and zebras; two agents walking through each other | `simstate/movement.js` (leg loop :373, `weave()` :301–321, `R.delay` :353), `pedsim.js:480` | M | low |
| 3 | **Set stop lines back where buses turn, and widen the clearance on turn sweeps** | Bus tails brushing waiting cars at turns | `traffic/sim.js:201–205` (the stop-line setback that already exists for left turns), `traffic/buses.js:28` + `conflicts()`, `ground.js` (paint) | S–M | none |
| 4 | **Clocked vehicles appear and vanish only out of view** | A cab popping into the lane up the street; the 14 appearing or vanishing on Birch St | `traffic/cabs.js` (`CAB.back`/`lead`, approach), `traffic/buses.js` (`LEAD_IN`/`LEAD_OUT`, `sync`), a depot door | S–M | none |
| 5 | **Smooth starts and stops; give clocked vehicles some weight** | Riders snapping 0 → 4–6.5 m/s at leg ends and kickturns; buses and cabs gliding with no pitch or roll | `simstate/movement.js` (leg time, `skatePlan`/`skateAt` :223), `traffic/render.js` | S | none |
| 6 | **The sim sends exact time** | The whole class of clock bugs (the stop-reverse-go one) | sim2 `/state` (sim side), `simstate/simclock.js` (already accepts a fractional `t`) | S | improves sync |
| 7 | **Spread cab planning over several frames** | A ~2-frame hitch per taxi ride | `traffic/cabs.js` `planCab`/`carConflicts` | S | none |
| 8 | **Two cabs at one kerb: the second queues behind** | Two cabs overlapping at a shared pickup | `traffic/cabs.js` (a berth offset, like the buses' `BERTH`) | S | none |
| 9 | Only if #3 doesn't close it: **reserve junction boxes in space–time tiles** | Leftover bus–car contacts inside boxes | `traffic/sim.js` box rule / `busHold` | L | none |

Quick wins, if one should come first: #3, #5 and #6. Each is small, carries no sync risk, and removes something people can see.

### 1. Cabs: book a little slack, drive like a car when blocked, absorb the difference out of sight

**Today:**
- `travel.mjs:166` books a ride as `driveProfile(roadSegs(r)).T + out`. That is the cab's free-flow drive at TAXI_DRIVE's brisk ×1.2, with zero allowance for anything ahead of it.
- `cabs.js` then has to hold that second in mixed traffic:
  - It drops the unseen cars on its way (:277, which is good).
  - It escorts the seen ones at ≥1.5× the street's speed (:282, `CAB.escDv`).
  - As a last resort it nudges a car forward, up to 1.6 m per step (`afterMove`, :351, `CAB.nudgeMax`). Those nudges are the visible jumps.
- MOVEMENT.md §5 round 2 already measured the alternative, `CAB.yieldOn`. Every setting either failed F11 (rider late, p90 2.43 game min) or put cabs into buses. Its own conclusion: "A cab can't own a lane and still keep its booked second once the cars ahead of it are held for buses."
- The research agrees: either the booking gets slack, or the cab is allowed to be late. Both are design calls.

**Build: A + B + C together.**
- **A. Slack in the booking** (one function, sim side).
  - Book `taxiS = drive + out + slack`, with slack per signalled junction passed plus a small share of the drive. `travel.mjs` already counts signals along a ride (`sigsOn(r)`, left from the measured fit). Railways call this recovery time; OpenTTD calls it "a little slack".
  - To keep "the fastest way costs the most", raise the cab's top pace at the same time (TAXI_DRIVE `k` from 1.2 to about 1.3). The booked time then barely moves, but the cab has headroom. That is how NIMBY Rails trains catch up: "Combining this with the existing max speed setting for lines, allows trains to catch up with their timetable."
  - Starting guess, not measured: 2 s per signalled junction + 5%. Tune with `tools/cabcheck.mjs`.
- **B. The cab drives like a car when blocked.**
  - Turn on `CAB.yieldOn`.
  - Drop the forced 1.5× escort for cars in view.
  - Keep three things:
    - "turn off its way at the next junction where it can"
    - "no merge in front of it within 25 s"
    - "unseen cars cleared off its way"
  - Never nudge where `TS.seen()` is true.
  - The warped clock in `planRide` already plans the pace; the slack gives it room.
- **C. Absorb the difference out of sight.**
  - If the cab is early, it stands at the drop while the rider pays: a pay beat before `car_get_out`, until the booked second.
  - If it's late, the lateness goes into the rider's `R.delay` (movement.js:353), which is already repaid by walking ×1.6. It is cleared before the next hard deadline.
  - When neither the cab nor the rider is on this page's screen, snap back to the booking.
  - Shipped precedent:
    - GTA V's scripting API has `SET_PLAYBACK_TO_USE_AI_TRY_TO_REVERT_BACK_LATER`: a car on a recorded path hands over to the driving AI when disturbed and returns to the recording later.
    - Midtown Madness kept ambient cars on partial physics until a collision.

**Trade-offs:**
- A changes the sim's numbers. Taxi trips get longer by the slack unless `k` rises, and mode choice shifts. MOVEMENT.md records that at ×1.0 a kerb-riding scooter beat the cab on 35 of 60 long trips; ×1.2 was picked so the cab wins 49. Re-run the dry bench after any change.
- B without A fails F11 (already measured). A without B changes nothing on screen.
- C changes how "no teleports" is applied, but only where this page's camera can't see. It's the same rule the city already uses to add cars (`sim.js` populate: "one arrives only where nobody can see it").
- An untested idea: let cabs drive in the bus lanes on bus streets. That gives them a lane of their own there, but puts them in the buses' sweeps, which `planRide` already plans around. Worth a what-if, not a first move.

**Gate:**
- `cabcheck` F11 p90 (rider on the kerb against the booked arrival)
- a new "nudges while seen" counter, which must be 0
- bus–car contacts
- taxi share in the sim's dry bench

**In plain words:** a cab can't be both exactly on time and polite in traffic. Give it a couple of seconds of spare time and let it wait behind cars like a normal driver. If it's early, the passenger pays. If it's late, the passenger walks a bit faster afterwards. Any leftover error is fixed when nobody is looking.

### 2. Riders and walkers give way by slowing, not only by stepping sideways

**Today:**
- Walk, skate, bike and scooter legs are drawn at constant speed along the path (movement.js:373, `f = (tt − dep) / dur`).
- Avoidance is sideways only. `weave()` moves at most 0.6 m and comes back to 0 within 1.3 m of every corner node and at leg ends. When no sideways spot is clear, it takes the least-bad offset (`tg = best ?? bf`, :315) and passes through.
- Generic walkers step aside or stop short (`PED.yieldR`, `yieldT`), but agent walkers don't (`!w.agent`, pedsim.js:480).
- SPREAD.md names what's left, and it's exactly where there's no room sideways: "riders crossing a zebra past the walkers waiting at its kerb… and riders passing walkers in the corners."

**Research:** Hitman: Absolution's characters follow pre-computed Bézier paths "on rails" (Anguelov, *Game AI Pro* ch. 22). A predicted collision is resolved in order:
1. "through simple speed modification"
2. "if all the speeds still result in a collision, then we check whether our stopping distance is collision-free"
3. only then by bending the path

The detector ignores what is behind: "In ignoring any colliders behind the agent, we implicitly delegate the responsibility for any potential collisions that may occur to those colliders." AI City has the third step and lacks the first two.

**Build:**
- **A capped lag ℓ per leg:** draw the progress booked at (t − ℓ).
  - When the published path for the next 1.6 s meets a walker and there's no sideways solution, ease the speed down or stop short, and ℓ grows.
  - Once clear, catch up at up to +25% (skate, bike, scooter) or ×1.6 (walk; today's `MOVE.catchUp`).
- **Hard deadlines:** ℓ must be 0 by the next boarding (the bus leaves on its clock), the cab pickup, and the trip's arrival.
  - The wait before a bus is free slack: lag picked up on the way to a stop disappears in the wait. That's what timing points do on a real line.
  - A lag that can't be repaid falls back to today's pass-through, or is cleared out of view (#1C).
- **Right of way, as in Hitman:** the one behind (the overtaker) gives way, and the one in front ignores it. Agent walkers join on the same terms, so two agents don't walk through each other.
- **Publish movers with ℓ applied.** pedsim already reads what's drawn.
- **Door segments** (the straight runs from a door to the lane):
  - Check them with the same `lineClear` the kickturns use.
  - Bend them round posts with two Béziers (Hitman's "avoidance point" and "reconnection point").
  - The remaining mover–obstacle contacts (4.8 per minute downtown, SPREAD.md) are all on these segments.

**Trade-off:** mid-leg, "true sync" becomes "within ℓmax of the booking". I'd suggest a cap of 1.5 s, which is a skater up to 6 m behind. Every boarding and arrival stays exact. This changes the letter of the sync rule, so it's a design call.

**In plain words:** today a skater can only swerve. At a corner or a crossing there's no room to swerve, so it goes through people. Let it slow down or wait a beat like a real skater, then push a bit harder to make up the time before it has to catch a bus or arrive.

### 3. Bus turns: set stop lines back, and widen the clearance on turn sweeps

**Today:**
- Each bus turn has a wide swing (`SWING`) so the 8 m body clears the kerb.
- Cars hold short of every bus sweep: `busHold` uses the conflict table from `conflicts()`, padded 0.02 m across and 0.6 m along (buses.js:28).
- Contacts left: 70 of 30,483 frames in the page (two cars held for a bus in a lane, one in a junction), and 303 in 69,392 steps in node (MOVEMENT.md §5).

**Research:**
- Traffic engineering's fix for a big vehicle sweeping across waiting cars is the recessed stop line. NACTO's Transit Street Design Guide pulls the stop bar back, especially on the street being turned into, so a turning bus can use the full width, "accounting for the inner and rear swept paths of the bus".
- AI City already does this for car left turns. sim.js:201–205 steps a lane's line back 0.25 m at a time until waiting noses clear the turn's sweep by 5 cm.

**Build:**
- Run that loop over the buses' own turn sweeps too (`bodyAt` along each route's `R.G` through each turning connector), with about 0.3 m of clearance instead of 5 cm. Paint the bar where the line ends up (ground.js). It's static and computed once.
- Raise the sideways padding to about 0.3 m on turn sweeps only: connectors, and lanes within one bus length of a turn.
  - Keep 0.02 m on parallel lanes, which pass 0.06–0.5 m apart by design.
  - On toon bodies, a gap under ~0.3 m reads as a scrape even when the boxes don't overlap. That figure is my judgement, so check it by eye.
- Before more tuning, sort the leftover contacts by cause (the harness already logs `hold`):
  - a car standing at a line inside a sweep: fixed by the setback
  - a car that couldn't stop when the bus's window appeared (`busHold` looks 48 m ahead; the fleet publishes runs 15 s ahead): look further
  - a near miss the padding doesn't cover: fixed by the pad

**Trade-offs:** less room to queue on those approaches, since cars stop a car-length back. With bigger pads, cars near bus routes will wait for buses a little more often.

**In plain words:** paint the stop line further back where buses turn, the way real cities do, so waiting cars sit outside the bus's swing. Keep a bit more air between bus and car on corners.

### 4. Clocked vehicles appear and vanish only out of view

**Today:**
- Ambient cars and walkers arrive and leave only unseen (sim.js populate; PASS-fidelity: 0 on-screen spawns).
- The clocked vehicles don't check:
  - A cab "comes into the street 42 m up its lane", already moving (`CAB.back`).
  - A bus run is added the moment it starts and dropped when it ends (buses.js `sync`, no visibility test).
- Loops (one bus at the seam) and the 14's LONG BRIDGE hand-over are already seamless. But the 14's lead-in (Birch St) and lead-out (a block north of MALL GATE) start and end on open street.

**Research:** Midtown Madness kept ambient cars in a "bubble" of road visible from the camera's "cull room" and pooled the rest. In Driver San Francisco, when the player left a car, the AI sent it to "the closest free slot on the traffic splines". AI City's own walker rule does the same.

**Build:**
- **Cab:** lengthen the approach (`CAB.lead` from 90 to about 200 m) and enter at the first point along it that `TS.seen` says no camera sees. If all of it is visible, enter from a side street or a garage or alley door. The approach is out of service, so its length doesn't touch sync.
- **The 14:** end its lead-out and start its lead-in at a depot door or out of sight, the way real buses run empty to and from the garage.
- **Measure:** extend render.js's on-screen spawn counter to the clocked cars.
- **Unknown:** how often these pop-ins actually reach the screen. A shot of a followed rider hailing a cab would settle it, because the camera is right at the kerb then.

### 5. Smooth starts and stops; give clocked vehicles weight

**Today:**
- A leg's progress is linear in time (movement.js:373). A rider goes from 0 to full speed in one frame at each leg start, and back to 0 at each end.
- The skate plan stops dead for a kickturn (`skateAt` :223: the position is fixed during `kick`) and leaves at full speed.
- Buses and cabs follow smooth speed tables, but their bodies never pitch or roll.

**Build:**
- **Leg ramps:** bend each leg's clock with short ramps at its ends: about 0.4 s for walking, 0.6–0.8 s for skate, bike and scooter. Departure and arrival stay the same; the middle runs a few percent faster. The buses already do this (`legDrive`: pulling away and braking at 1.5 m/s²).
- **Skate:** brake over the last 1–1.5 m into a kickturn, and push off after it.
- **Render:**
  - Pitch from the clock's acceleration (`runAt` already returns `a` for buses; a cab's leg has its speed table).
  - Roll from v²·κ.
  - Both go through a damped spring.
  - Midtown Madness gave ambient cars a "partially simulated physics model" for this reason. I found no public write-up of this exact trick for buses, so the numbers are taste. Start near 1° of pitch per m/s², and judge by eye.

### 6. The sim sends exact time

**Today:** `/state` sends `t` in whole game minutes and nothing about pace. simclock.js fits a line to the polls, keeps it inside what each poll proves, and limits slew. It works (0 backward frames in the probe), but it's estimating a value the server knows exactly.

**Research:**
- Networked games render a fixed delay in the past and blend between known states:
  - Gambetta: "show the other players *in the past*".
  - Fiedler: buffer enough "so that you can lose two packets in a row and still have something to interpolate towards".
- They also blend corrections smoothly; one example is Murphy's "projective velocity blending".
- AI City has it easier than any networked game: every trip is booked ahead, so nothing needs predicting. Only the time base is uncertain.

**Build:**
- The sim adds fractional game time to `/state`, plus its pace or a server timestamp. simclock.js already treats a fractional `t` "as exact". Keep the slew to smooth jitter.
- Optional: run the movement clock about one poll behind the line, as Valve and Gambetta do, so it never runs past what the last poll proved. That costs about 1 s of delay between a sim event and the city drawing it.

### 7. Spread cab planning over several frames

MOVEMENT.md already logs it: the longest plan took 35.6 ms in the page, about two frames, "a hitch per taxi ride". Driver San Francisco ran its planning "asynchronous and multithreaded": a task could finish "after several frames" while the car kept following its current path. The cab is planned 9 s before the hail, so `planRide` and `carConflicts` can be split into a few milliseconds per frame, or moved into the existing feed worker.

### 8. Two cabs at one kerb

This is open in MOVEMENT.md §5 round 3. Taxi ranks queue: the second cab pulls up one cab-length behind, like the buses' `BERTH`. Sharing one cab would change the sim (one booking, two riders) and is bigger.

### 9. Only if #3 leaves contacts inside junction boxes: reserve the box in space–time tiles

- AIM (Dresner & Stone, JAIR 2008) splits a junction into an n×n grid of tiles. A vehicle simulates its own path and may enter only with a reservation for every tile it will occupy, at the times it will occupy it. Silver's cooperative pathfinding uses the same kind of space–time reservation table.
- Here: clocked vehicles book their tiles ahead, and cars need a reservation to enter a box.
- `busHold` is already a stretch-based version of this. Tiles make "never stand inside a sweep" true by construction.
- The cost is an L-size rewrite of the box rule, and slightly fewer cars getting through each green.

### What not to adopt

- **RVO/ORCA for the agents.**
  - RVO assumes each agent does half the avoiding ("move only halfway out of the way… anticipating that the other agent would do its part"). AI City's movers are on clocks and won't do their half.
  - Sunshine-Hill (*Game AI Pro 3* ch. 19): RVO's assumptions "are, in practice, constantly violated". ORCA agents at corners "simply become stuck… unwilling to cross paths", which "leads to frequent deadlocks". Corners are exactly where AI City's leftover problems are.
  - The Hitman approach fits pre-planned motion better.
- **Social forces or flow fields for the sidewalk crowd.**
  - AI City's walkers are lanes, one-way rings and following (pedsim.js). They already step aside within a time window (`PED.yieldT` 1.6 s against the mover's published path).
  - Reacting by time-to-collision is what the anticipatory literature says people do (Guy & Karamouzas; Karamouzas, Skinner & Guy's power law).
  - Flow fields (Emerson; Treuille's *Continuum Crowds*) pay off for thousands of agents sharing goals over open ground, not for walkers who already have fixed lanes.
- **Buses back in the car sim, or physics for buses.**
  - As route cars in traffic, they ran 5–7× behind schedule, stuck behind lights (the rules.js PRIORITY comment).
  - Driver San Francisco and Midtown Madness used rails for this reason and switched to physics only on collision.
- **Keeping a timetable by speed alone.** OpenTTD and NIMBY Rails both say it only works with slack ("a little slack"; "reserve more than 10s of min. stop time").
- **Despawning stuck vehicles in view.** Cities: Skylines' default is that stuck vehicles despawn and "magically teleport their passengers or goods". Players notice: TM:PE ships a switch to turn it off.

---

## The dossier

### A. Open-world traffic and crowds

| Game | Public source | What it says that matters here |
|---|---|---|
| **Driver San Francisco** (Reflections/Ubisoft) | *Game AI Pro 3* ch. 17, "Fast Cars, Big City" (Jenner & Ocio Barriales) | <ul><li>A "deterministic traffic system that simply moved vehicles around a set of looping splines… Each spline had been defined to ensure that it did not interact with any other spline."</li><li>Every car carried a "vehicle path… the predicted movement of the vehicle for the next couple of seconds", kept "continuous".</li><li>Three AI LODs: far cars followed the route spline "with an offset to simulate that they were driving in a certain lane"; middle cars used a lane-node search with rough avoidance; near cars got the full planner.</li><li>Simulation LOD: far cars were "removed from the physics engine… and simply placed at the position defined by their path for that particular time".</li><li>Corner speed came from the path's turn angle and was "propagated backward… based on the maximum acceleration/deceleration".</li></ul> |
| **Midtown Madness 2 / Midnight Club** (Angel Studios) | Gamasutra 2001, "AI Madness: Using AI to Bring Open-City Racing to Life" | <ul><li>Ambient cars are "positioned and oriented by a 2D spline curve" (Hermite).</li><li>Each car keeps "a pointer to the next ambient vehicle directly in front of it in the same lane" and slows to its speed.</li><li>Entering a junction needs approval from four groups: traffic control, accidents, road capacity, and vehicle conflicts.</li><li>Population lives in a "bubble": the road visible from each cull room.</li><li>On contact, "the ambient vehicle switches from using a partially simulated physics model to a fully simulated physics model."</li></ul> |
| **GTA V** (Rockstar) | No technical talk found. The modder-documented scripting API (LCPDFR NativeDB) | <ul><li>Mission cars play back recorded paths, can hand over to the driving AI (`START_PLAYBACK_RECORDED_VEHICLE_USING_AI`, `SET_PLAYBACK_TO_USE_AI`) and return later (`…_TRY_TO_REVERT_BACK_LATER`).</li><li>How traffic itself is simulated: **unknown**.</li></ul> |
| **Marvel's Spider-Man** (Insomniac) | GDC 2019, "A Technical Postmortem" (Ruskin); "Marvel's Spider-Man, meet Houdini" (Santiago) | The abstract covers how "pedestrians, traffic, street vignettes, and random crimes grew… to an interactive part of a living city". Houdini was used to author traffic. Text details: **unknown**. |
| **Cyberpunk 2077** | Nothing primary found | **Unknown.** |
| **Watch Dogs 2 / Legion** (Ubisoft Toronto) | GDC 2017, "Replicating Chaos" (Delbosc); *Game AI Uncovered* vol. 3, ch. 1–3 (Melder) | <ul><li>WD2 combined "projective velocity blending, snapshot buffering, and physics simulation blending".</li><li>Legion has a unified vehicle AI for traffic and chases.</li><li>Methods beyond titles and abstracts: **unknown**.</li></ul> |
| **Sleeping Dogs** | Nothing primary found | **Unknown.** |
| **Assassin's Creed Unity / Syndicate** | GDC 2015 (Cournoyer); GDC 2016 (Martel); *Game AI Pro 3* ch. 15 | <ul><li>Unity: a pool swaps "low-res NPCs to high-res NPCs without the player noticing". With "40 real AIs and 120 high resolution models", it shows "10,000 crowd NPCs".</li><li>Syndicate: carriages needed changes to pathfinding, navmesh and collision so pedestrians could steer against vehicles.</li></ul> |
| **City Sample / The Matrix Awakens** (Epic) | UE docs, "City Sample Project" | <ul><li>"Mass AI manages the behavior and visualization of traffic and crowds."</li><li>Spawners for crowds, intersections, traffic and parked vehicles.</li><li>"ZoneGraph… follows a point-by-point corridor structure."</li></ul> |
| **Kythera AI** | GDC 2022, "Cities at Scale" (MacPherson) | <ul><li>"scheduling traffic flow for a short period into the future, rather than frame-by-frame simulation". The nearest public match to AI City's booked approach.</li><li>Details: **unknown** (video only).</li></ul> |
| **Cities: Skylines II** | Paradox feature page, "Traffic AI" | <ul><li>Lane changes and giving way ("vehicles might cut in front").</li><li>"Public transportation vehicles travel on the designated lines with the exception of taxis which are able to freely select their routes."</li></ul> |

**By topic: what shipped games do, and how AI City compares**

- **Lane following.**
  - Shipped games use splines with a lane cross-section: Driver SF, Midtown's Hermite curves, Epic's ZoneGraph.
  - AI City: offset straight lanes, plus cubic Bézier connectors with arc-length tables (sim.js:132–145). Same family.
- **Path smoothing.**
  - Shipped games use Hermite and Bézier curves. Road design and driving sims use clothoids too: OpenDRIVE has `spiral` beside line, arc and paramPoly3, as parsed by CARLA.
  - AI City: connectors use 0.552 handles (a near-circular arc), so curvature jumps at the tangent points. The chord body model smooths yaw, but the front-wheel steer (`steer = 1.6 × (path − body)`, sim.js:244) can snap at a turn's start.
  - Longer handles, which the bus turns already use (`SWING.kLeft`), behave like a spiral entry.
  - Not ranked: it's unclear whether the snap is visible.
- **Steering or rails.**
  - Shipped open worlds keep ambient vehicles on rails and switch to steering or physics only when disturbed or near the player: Driver SF's LODs, Midtown's switch on contact, GTA's playback with an AI fallback.
  - AI City: ambient cars run IDM on rails, and buses and cabs are clocked rails. Same pattern.
- **Speed profiles.**
  - Driver SF: corner speed from curvature, propagated backward with braking limits.
  - AI City does exactly this (`legDrive`, `speedCap`, `driveProfile`) and books from it.
- **Junctions.**
  - Midtown: four approval groups. CS2: give way, with occasional cutting in. Epic's Mass Traffic needs light or priority data (a third-party write-up).
  - Academic: AIM's tiles.
  - AI City has signals, a box rule, exit room, zebras, bus windows (`BUSWIN`) and the bus conflict table. That's richer than anything published for a shipped game. #9 is the formal next step if needed.
- **Bubbles and LOD.**
  - Midtown's bubble; Driver SF's three AI LODs plus physics LOD; AC Unity's 40 real AIs plus a pooled crowd; Kythera scheduling traffic ahead.
  - AI City: cars and walkers live within a radius of the focus and the camera. Buses are pure functions everywhere, which costs almost nothing.
- **Spawning.**
  - Shipped games: out of view, at the edge of the bubble.
  - AI City does this for ambient cars and walkers (0 on screen), not yet for clocked vehicles (#4).
- **Hiding mistakes.** Every shipped example corrects where the camera isn't looking, or switches modes at the moment of contact:
  - Driver SF rejoins the nearest free spline slot.
  - Midtown switches from rails to physics.
  - GTA hands over to the AI and returns to the recording.
  - Cities: Skylines despawns.

  AI City's "no teleports" currently forbids even the invisible version. That's why #1C and #2 matter.

### B. Schedule-based transit games

| Game | Strict times? | Road vehicles in traffic? | How it keeps time |
|---|---|---|---|
| **OpenTTD** | Yes: per-order travel and wait times, start date, auto-spacing ("The total number of days in the timetable is divided by the number of vehicles… to get a 'gap number'") | Yes, on tiles | "Each vehicle speeds up or slows down depending on whether it is late or early according to the timetable", "provided the timetable has a little slack in it". |
| **NIMBY Rails** (v1.5+) | Yes: runs ("start time plus a line to run"), so "it is possible to calculate the fixed arrival and departure time for every train in every station" | No: rail only, with signals | Fixed departure times. A late train departs on time if loading is quick. The line's speed limit sits below the train's top speed so it can catch up ("reserve more than 10s of min. stop time"). Riders book against runs, much as AI City's riders book against `runFor`. |
| **Transport Fever 2** + Timetables mod | Vanilla: no. The mod adds Arrival/Departure ("depart only at the next specified departure time") and Unbunch | Yes | Holds at stations. Whether vehicles also speed up: **unknown**. |
| **Cities: Skylines** (+ TM:PE) | No: only per-line unbunching | Yes, fully mixed | Vehicles bunch and run late. Unbunching holds at stops. Forum reports say a bus can be held for minutes, and two lines sharing a stop block each other. Stuck vehicles despawn by default; TM:PE adds the switch, timed lights and lane connectors. |
| **Cities: Skylines II** | No timetables in the public feature list | Yes | Fixed lines; taxis route freely. |
| **Cities in Motion 2** | Timetables set "departure times from the route's first stop" (GiantBomb) | Yes | Beyond that: **unknown**. |
| **Mini Metro / Mini Motorways** | No timetable | Motorways has cars, no transit | **Unknown**. |
| **Workers & Resources** | No strict timetable found; vehicles "wait at the end station as long as it's needed" (Steam discussion) | Yes | **Unknown**. |

**Does any keep strict timetables with road vehicles that look smooth in traffic?** I found none. Two approaches work:
- **Separated track**, with block signals (NIMBY Rails, OpenTTD rail).
- **Slack plus holding at timing points** (OpenTTD, NIMBY's minimum stop times, the TPF2 mod). Real-world practice is Daganzo's headway-based holding at control points, which "requires less slack than the conventional, schedule-based approach".

AI City's buses use both: their own lane works as separated track, and their holds (`transitnet.js` `holds`) work as timing points. That's why they work. The cabs have neither, and that's the root of #1.

### C. Pedestrian, bike and skater avoidance

- **RVO/ORCA** (van den Berg, Lin, Manocha; RVO2).
  - Sunshine-Hill: velocity-obstacle methods "have in recent years become the standard for collision avoidance in video games", but their assumptions are "constantly violated", and ORCA gets stuck at corners.
  - Shipped uses: Unreal's Character Movement has RVO; Detour Crowd uses "an adaptive RVO sampling calculation" with a bias toward the agent's direction. Guy & Karamouzas say ORCA "has been integrated into many different computer games, both free and commercial".
- **Anticipatory, time-to-collision** (Guy & Karamouzas, *Game AI Pro 2* ch. 19).
  - The force scales with how soon a collision would happen. Karamouzas, Skinner & Guy (PRL 2014) measured "a simple power-law interaction that is based not on the physical separation between pedestrians but on their projected time to a potential future collision".
  - AI City's walkers already react within a 1.6 s horizon on the mover's published path, so they're in this family.
- **Social forces** (Helbing & Molnár 1995): a pull toward the desired velocity, pushes from people and walls. Extended to shared space with vehicles and cyclists (Anvari et al.). Used for research; in games it's mostly a component.
- **Flow fields** (Emerson, *Game AI Pro* ch. 23; Treuille, Cooper & Popović, *Continuum Crowds*, SIGGRAPH 2006): a dynamic potential field that "simultaneously integrates global navigation with moving obstacles". It suits big crowds with shared goals. The usual shipped example, Supreme Commander 2, comes only from a community forum and promotional text.
- **Pre-planned locomotion** (Hitman: Absolution, Anguelov): characters on Bézier rails, with avoidance checks along the path up to 2 s ahead; speed first, then stop, then path; colliders behind are ignored. This is the closest match to AI City's true-sync movers, and it's #2.
- **Crowd LOD** (AC Unity): real AIs only near the player; stand-ins are swapped from a pool, unnoticed.
- **Bikes and skaters:** no game with a public write-up treats them as anything but a faster agent on a lane; the serious models are research. AI City's riders' line (`MOVE.band`, 0.3 × the walk's width from the kerb) is a good real-world analogue: a lane inside the sidewalk.

### D. Smoothing an authoritative position on the client

- **Entity interpolation** (Gambetta): show others slightly in the past and interpolate between real updates. "You're always showing the user *actual movement data*, except you're showing it 100 ms 'late'", which "isn't generally noticeable".
- **Snapshot interpolation** (Fiedler):
  - Packets are "jittered", so buffer enough "so that you can lose two packets in a row and still have something to interpolate towards".
  - Hermite with velocities keeps "velocity… smooth across sample points".
  - Extrapolation fails because "it doesn't know anything about the physics simulation".
- **Correction blending** (Murphy, "Believable Dead Reckoning", *Game Engine Gems 2*, projective velocity blending): blend from where something is drawn toward where it should be, instead of snapping. Watch Dogs 2 combined this with snapshot buffering.
- **AI City:**
  - The future is booked, so there's nothing to extrapolate. Positions are exact functions of time, which beats every scheme above.
  - The weak point is time itself: whole-minute `t`, estimated by simclock.js's careful fitted line. #6 removes the need for that fit.
  - Correction blending is still worth having when a re-plan or re-export moves a clocked vehicle (a cab re-plan, a `setNow` jump > 4 min). Today those snap.

### E. What our code already matches (keep it)

- **Buses as clocked rails:** priority, their own lane, holds at timing points, and cars yielding. That's Driver SF's non-interacting splines, plus NIMBY's runs, plus BRT practice.
- **Timetables booked from the vehicle's actual drive** (`BUS_BOOK 'drive'`, `driveProfile`). Driver SF built its speed limits the same way, so booking and drawing can't drift.
- **IDM car-following with gap clamping** (Treiber, Hennecke & Helbing).
- **Junction coordination:** the box rule, exit room, and signals in one 44 s cycle ("green waves").
- **Spawning and despawning out of view** for ambient cars and walkers: 0 on screen.
- **Movers publish their next 1.6 s for the crowd.** That's Driver SF's "vehicle path", applied to pedestrians.

---

## Sources

Open-world traffic and crowds
- Jenner & Ocio Barriales, "Fast Cars, Big City: The AI of Driver San Francisco", *Game AI Pro 3* ch. 17: http://www.gameaipro.com/GameAIPro3/GameAIPro3_Chapter17_The_AI_of_Driver_San_Francisco.pdf
- Angel Studios, "AI Madness: Using AI to Bring Open-City Racing to Life" (Gamasutra, 2001-01-24): https://www.gamedeveloper.com/programming/ai-madness-using-ai-to-bring-open-city-racing-to-life
- GTA V vehicle-recording natives (LCPDFR NativeDB): https://www.lcpdfr.com/resources/nativedb/index/vehicle/page/4/?d=39
- Ruskin, "Marvel's Spider-Man: A Technical Postmortem" (GDC 2019): https://gdcvault.com/play/1026496 · summary https://80.lv/articles/marvels-spider-man-a-technical-postmortem
- Santiago, "Marvel's Spider-Man, meet Houdini" (GDC 2019): https://vimeo.com/326448655
- Cournoyer, "Massive Crowd on Assassin's Creed Unity: AI Recycling" (GDC 2015): https://gdcvault.com/play/1022141/Massive-Crowd-on-Assassin-s
- Martel, "What Are You Driving At? Vehicle AI in Assassin's Creed Syndicate" (GDC 2016): https://gdcvault.com/play/1023075/What-Are-You-Driving-At
- *Game AI Pro* index: http://www.gameaipro.com/
- Delbosc, "Replicating Chaos: Vehicle Replication in Watch Dogs 2" (GDC 2017): https://gdcvault.com/play/1024597/Replicating-Chaos-Vehicle-Replication-in
- Melder, *Game AI Uncovered* vol. 3: https://routledge.com/Game-AI-Uncovered-Volume-Three/Roberts/p/book/9781032532561
- MacPherson, "Cities at Scale" (GDC 2022): https://gdcvault.com/play/1027576/AI-Summit-Cities-at-Scale
- Epic, "City Sample Project": https://dev.epicgames.com/documentation/unreal-engine/city-sample-project-unreal-engine-demonstration
- Epic, "Using Avoidance With the Navigation System": https://dev.epicgames.com/documentation/unreal-engine/using-avoidance-with-the-navigation-system-in-unreal-engine
- Mass Traffic intersections (third-party): https://bugnet.io/blog/fix-unreal-mass-traffic-vehicle-stops-at-intersection-forever
- Paradox, "Cities: Skylines II — Traffic AI": https://paradoxinteractive.com/games/cities-skylines-ii/features/traffic-ai
- OpenDRIVE geometry via CARLA: https://carla.org/Doxygen/html/d8/d49/GeometryParser_8cpp_source.html

Transit games and practice
- OpenTTD manual, Timetable: https://wiki.openttd.org/en/Manual/Timetable
- Carrasco, NIMBY Rails devblog 2022-06 and 2022-08: https://carloscarrasco.com/page/38/ and https://carloscarrasco.com/page/36/
- TPF2 Timetables mod: https://github.com/Gregory365/TPF2-Timetables
- TM:PE wiki, Toggle Despawn: https://github.com/CitiesSkylinesMods/TMPE/wiki/Toggle-Despawn
- Cities: Skylines unbunching (community): https://steamcommunity.com/workshop/filedetails/discussion/928128676/1290690926874876460
- Cities in Motion 2 (GiantBomb): https://www.giantbomb.com/games/3030-39416/
- Workers & Resources (Steam): https://steamcommunity.com/app/784150/discussions/0/5057002258666909766
- Daganzo, headway-based bus holding (TR-B 2009): https://its.berkeley.edu/publications/headway-based-approach-eliminate-bus-bunching-systematic-analysis-and-comparisons
- NACTO, Recessed Stop Line: https://nacto.org/publication/transit-street-design-guide/intersections/transit-route-turns/recessed-stop-line

Junctions and reservation
- Dresner & Stone, AIM (JAIR 2008): https://www.cs.utexas.edu/~pstone/Papers/bib2html/b2hd-JAIR08-dresner.html
- Silver, "Cooperative Pathfinding" (AIIDE 2005): https://ojs.aaai.org/index.php/AIIDE/article/view/18726
- Treiber, Hennecke & Helbing, IDM: https://arxiv.org/abs/cond-mat/0002177

Pedestrians, bikes, skaters
- Anguelov, "Collision Avoidance for Pre-Planned Locomotion", *Game AI Pro* ch. 22: http://www.gameaipro.com/GameAIPro/GameAIPro_Chapter22_Collision_Avoidance_for_Preplanned_Locomotion.pdf
- Sunshine-Hill, "RVO and ORCA: How They Really Work", *Game AI Pro 3* ch. 19: http://www.gameaipro.com/GameAIPro3/GameAIPro3_Chapter19_RVO_and_ORCA_How_They_Really_Work.pdf
- Guy & Karamouzas, "Guide to Anticipatory Collision Avoidance", *Game AI Pro 2* ch. 19: http://www.gameaipro.com/GameAIPro2/GameAIPro2_Chapter19_Guide_to_Anticipatory_Collision_Avoidance.pdf
- Karamouzas, Skinner & Guy, PRL 2014: https://link.aps.org/doi/10.1103/PhysRevLett.113.238701 · https://arxiv.org/abs/1412.1082
- Helbing & Molnár, social force: https://arxiv.org/abs/cond-mat/9805244
- Anvari et al., shared-space social force: https://spiral.imperial.ac.uk/entities/publication/843b8958-d1bd-44c3-98af-5de73a229422
- Emerson, flow field tiles, *Game AI Pro* ch. 23: http://www.gameaipro.com/GameAIPro/GameAIPro_Chapter23_Crowd_Pathfinding_and_Steering_Using_Flow_Field_Tiles.pdf
- Treuille et al., Continuum Crowds: https://grail.cs.washington.edu/projects/continuum-crowds
- Supreme Commander 2 flow fields (forum): https://wildfiregames.com/forum/topic/16018-supreme-commander-2-pathfinding/

Client-side smoothing
- Gambetta, Entity Interpolation: https://www.gabrielgambetta.com/entity-interpolation.html
- Fiedler, Snapshot Interpolation: https://gafferongames.com/post/snapshot_interpolation/
- Murphy, Believable Dead Reckoning: https://gameenginegems.com/gemsdb/article.php?id=46
