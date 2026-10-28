# MOVEMENT & LIFE: the plan and the contract (2026-10-07)

slime: "the game needs to look in motion, agents need to look like they are doing stuff at all times… if everyone can just teleport
to locations there's no competition. Movement should be part of the game… we need this to feel alive."

This file is the CONTRACT that every agent building it reads: the sim branch, the map export, the city, and the animations. Change a
shared shape here first, then in code.

## 0. Decisions (slime, 2026-10-07)
- **One game day = 60 real minutes**, so one game minute = 2.5 real seconds.
- **Movement is gameplay:** time vs money vs risk. The fastest way across town costs the most, and agents plan for it.
- **True sync, no teleports:** what the sim says a trip takes is what the city shows. Getting somewhere takes real time.
- **Modes:** walk, skateboard, scooter, bike, bus, subway, taxi. Owned cars and stolen cars come later.
- **Everything is animated:** activities, travel and events, robberies included, and getting shot (toon, never gore).
- **The UI style is Zine × TE · Pink** (style lab, `ui/stylelab/`, id `z-te-pink`).

## 1. Time conversion
- `gameMin = realSeconds / 2.5`. A mode's speed is given in REAL metres per second; the sim converts.
- The sim server's default `--day` becomes 60.
- **The page's clock (2026-10-09, `simstate/simclock.js`; slime: "it pauses for a second then reverses then goes again, same with
  skateboard movement").** The sim's `/state` `t` is whole game minutes (a step every 2.5 s, polled once a second) and says nothing of
  the pace; the replay floors its clock the same way. The old `setClock` took each poll's t as the time and the gap between two polls as
  the pace (0, 0, 1 game min/s …): `simNow` ran ahead and snapped back at the next poll, and the movement clock chasing it ran backward.
  Now the page fits a line to the polls (t + ½ against page time, least squares, forgotten over 30 s), keeps it inside each poll's proof
  (t ≤ T < t + 1), and the movement clock (`agents.moveNow`: the buses, cabs and legs) follows that line at its rate, slewed at most
  ±30 %, never backward; past the last poll's proof it slows to 70 % and stops 0.4 min on. It snaps only when the sim jumps (back in time: a loop, a restart, a seek
  back; more than 4 min ahead; the tape's seeks), and stops within a minute when a step doesn't come (a pause, `running: false`). A sim
  that sends `t` with its fraction is taken as exact. Page probe (the replay of `2026-10-09T12-43-05-133Z-dry`, 60 s headless at 60 fps):
  backward frames 556 of 3601 → 0 (three runs: 0, 0, 0), pace per frame q05 / q50 / q95 −0.12 / 0.20 / 0.96 → 0.35–0.37 / 0.40 /
  0.42–0.43 game min/s (the replay 0.40). Node gate: `tools/clockcheck.mjs` (18 scenarios, `--old` for the old clock). Buses
  (`tools/bus-clock.mjs`, 12 riders, the replay from D2 07:30): drift median 0, |drift| p90 0.01, max 0.01 game min (was −0.02 / 0.38 /
  0.41); bus–bus 0, reds at the line 0, live buses = runs in progress 1568 / 1568, bus–car contact frames 54 of 47 063 (2 pairs, cars
  held for a bus).

## 2. Modes: starting numbers (the sim's dry-run bench tunes them; these are the first guess)
| mode | real speed | where it runs | cost | owned item? | the trade-off |
|---|---|---|---|---|---|
| walk | 1.5 m/s (hightop perk ×1.5) | sidewalks | free | no | slow; exposed on the way |
| skate | 4.0 m/s | sidewalks | item `skateboard` ~15cr | yes, carried | can be taken in a robbery |
| bike | 5.5 m/s | road edge | item `bike` ~30cr | yes | parked at the destination: can be stolen unless locked |
| scooter | 6.5 m/s | road edge | item `scooter` ~45cr | yes | the same, and pricier |
| bus | drives like the cars (the street's car speed 10.5 / 12 / 15 m/s, the cars' corner speed) + dwell at stops: ~6 m/s stop to stop (§5 Bus retime) | fixed routes | fare 1cr | no | wait for the next bus (headway ~10 game min); crowded: pickpockets and witnesses |
| subway | ~16 m/s between stations, + ~30 s stairs and platform | fixed lines | fare 2cr | no | stations only; WANTED agents risk the station cops; jumping the turnstile = free + heat |
| taxi | a car of the traffic (CAB TRAFFIC, 2026-10-10: the street's car speed and corners, and it waits at the red lights; booked as that car alone through the fixed-time lights — §5 Cab traffic) | door to door | base 3cr + 1cr per 100 m; ×1.5 at night and during Director rushes | no | the priciest way and NOT the fast one; a WANTED rider skips the station cops; private |

Vehicles as items follow the items rule (MEMORY: the curated agent traits + held items are the game's items): skateboard, bike and
scooter get icons (`ui/icons/models.js`), one model used everywhere (icon, held/ridden, parked).

## 3. The trip contract (sim → city)
An agent on the move carries:
```js
trip: {
  mode,                       // the trip's headline mode: 'walk' | 'skate' | 'bike' | 'scooter' | 'bus' | 'subway' | 'taxi'
  from, to,                   // place ids (as in the map export)
  dep, arr,                   // game minutes
  fare,                       // cr paid (0 for walking or owned vehicles)
  legs: [                     // contiguous, covering dep → arr exactly
    { kind: 'walk'|'skate'|'bike'|'scooter'|'wait'|'bus'|'subway'|'taxi'|'stairs',
      from: <node id>, to: <node id>,  // place / stop / station / street node ids from the export
      dep, arr,               // game minutes
      line? }                 // the bus route or subway line id
  ]
}
```
- The city animates each leg over its real duration, `(arr - dep) * 2.5` s, along the export's geometry for that leg.
- **Public lens:** trips are public (a street witness sees you travel), EXCEPT rule 5: a trip to a lot the agent doesn't own is shown
  coarsely (`simstate/lens.js`). A taxi's route is public, but its passenger isn't drawn while riding (the cab is).

## 4. The map export (map → sim): `style/city/tools/export-world.mjs` → `world/export/world.json`
- **`version`, `generated`**
- **`places`:** the 29 existing place ids UNCHANGED (ids are law), plus new places the district kits define (shops, stations, stops,
  hangouts), each with x, z, kind, district, stand spots count, indoor/outdoor.
- **`lots`:** the 366 existing lot ids unchanged; the apartments registry (fixed ids).
- **`transit`:**
  - `stations` and `stops` (built on the reserved slots, `simstate/reserved.json`)
  - `lines: [{ id, kind: 'bus'|'subway', name, colour, stops: [...], headwayMin }]`
- **`travel`:** for every pair of nodes, per mode, the real metres and the real seconds along the network (walk, skate: the sidewalk
  graph; bike, scooter, taxi: the road graph; bus and subway: their lines, with the walks to and from the stop). A dense matrix, or a
  graph plus the sim's own shortest-path code: the export agent decides and documents it.
- **`mainland`:** the plots and how the Mainland is reached (later: claiming is still slime's to design).
- The sim's `places.json` keeps working until the sim switches to `world.json`.

## 5. The transit network (map side)
- **Subway:** 2 lines through the reserved subway slots. Stations are the existing kiosks with stairs. The tunnels aren't modelled:
  a ride is a CUTAWAY scene, a carriage interior with NPC riders swaying, opened like the home interiors. The agent goes down the
  stairs, rides, and comes up the stairs at the other end.
- **Bus:** none since 2026-10-09 (below). It was 2–3 routes along the avenues through the reserved shelters; the entries below that
  build, clock, route and retime the buses are history.
- **Taxi:** the traffic taxis can be hailed (stands at the reserved slots, or a kerb hail), carry the agent door to door, and let
  them out. (CAB TRAFFIC, 2026-10-10: a cab is an ordinary car of the traffic — §5 Cab traffic, last; it supersedes the taxi clock below.)
- **Buses out (2026-10-09, slime: "drop buses"; supersedes every bus entry below).** The bus timetable held the lights so long that the
  walkers never got WALK at 11–19 junctions (walkcheck: 11 signalled junctions with no WALK either way in 200 s, 40 one way only), and it
  fought every other vehicle. The 4, the 14 and the 22 are gone, and with them the bus clock (`traffic/buses.js`), the bus lanes and their
  paint (`traffic/buslanes.js`), the bus-only turns and their sign (`traffic/sim.js` BUS_TURNS, `traffic/busturn.js`), the held movements
  (73c9481, reverted), the bus windows' cross greens, the bus legs in `simstate/movement.js`, the `bus` mode in the export and `travel.mjs`,
  and the bus tools (`bus-clock`, `bus-timetable`, `bus-kerb`, `bus-lanes`, `bus-shots`). What stays: the cabs on their clock, whose
  host is now `traffic/fleet.js` (the conflict table, the movement clock the traffic keeps) and whose junction windows are `rules.js`
  CABWIN (no cab due: the plain cycle; walkcheck with 12 cab rides booked at once: every one of 236 signalled junctions gives WALK both
  ways); the TURNBACK on Route 9 (the cabs' routing has it); the 16 shelters as street furniture, NO SVC on the board, their ids kept as
  the export's attach nodes. The subway takes the bus riders (the next entry).
- **Subway plan (2026-10-09, slime: "5 new stations on two new local lines that run at the bus's pace"; the analyst's spec-5,
  the 10-09 subway plan (a local archive, not in this repository)).** Two LOCALS on their own clock (8 m/s, 10 s at a station, every 10 game min, 1 cr;
  the expresses keep 16 m/s, 8 s, every 6, 2 cr): **HARBOR** (H, `#FF7A1A`) LOW TIDE – MAIN ST – ELM ST – SUNNY ACRES – BLACKPINE and **UNION**
  (U, `#25B84C`) ROUTE 9 – PLEASANTVIEW – GATEHILL – ELM ST. Five open stair entrances (transit.js entranceAt / stairwell / entranceFurniture,
  `entry: 'stairs'` in the kits): BLACKPINE on the mall's north lot (Birch St), ELM ST in Sunny Acres on Elm St (1.2 m north of the spec's
  spot: at it the south railing stood inside the park office), MAIN ST on the Yards' Main St lot (set into the fence beside the gate),
  ROUTE 9 on Motel 9's Route 9 frontage at the court's mouth under the pole sign (the analyst's fallback, z 201: the spec's z 190 was inside
  the office), GATEHILL across Union Ave from OFFSHORE on the woods' lawn (the spec's site was a carve into the tower's showroom, behind its
  glass: not clean; the same x, 17 m north). The boards carry the bullets: a line's name beside its bullet only when both fit the board
  ([U] UNION; [H] alone; two lines: [H][U], [T][H], [N][H], [T][U]). The export: each line carries `speed`, `dwellS`, `fare` (world/export/
  README.md); a ride costs the highest fare of the lines it uses (travel.mjs); simstate/movetune.mjs keeps a line's own clock; the carriage
  (subway/net.js) runs each line at its own pace and dwell. The paper map draws the four lines and the bullets at the termini.
- **Transit sync (2026-10-08):** the timetable is the §2 design in the export AND the sim (bus 8 m/s + 6 s dwell, every 10 game min;
  taxi 11 m/s, 10 s hail); `--measured` booking stays off. The city's side: route cars tuned to keep it (`traffic/sim.js` ROUTE: a
  straight junction no longer caps them at 11 m/s, quicker corners, later braking), road routes that drive an L rather than a staircase
  of corners (`graph.road.turnM`), headway control (an early bus waits at its stop to the timetable, a late one stands 2 s; no bus is put
  on the road ahead of, or within 30 m of, one of its route), the cab dispatched before the hail and the drop-off fixed, the 14 at its
  LONG BRIDGE shelter with a turnback just past it. What the city's traffic still costs, measured in the page: see
  `world/export/README.md` (Where it stands) — buses and cabs run well behind the booking at today's density.
- **Bus clock (2026-10-08, supersedes the bus half of the above):** a bus is no longer a car in the traffic. Every timetabled run is a pure
  function of time on its route's bus-lane path (`traffic/buses.js`): it stands at its first stop 6 s before D, every leg arrives at its
  booked second (smooth ramps), it dwells to the booked departure; the live fleet is exactly the runs in progress. Bus lanes (red, BUS ONLY,
  no parking: `traffic/buslanes.js`) on every route street's kerb lane (Route 9: the shoulder). The cars hold short of a bus's sweep; its
  junctions turn green for it (`rules.js` BUSWIN); its zebras are busy. The cabs are still route cars.
- **Bus offsets (2026-10-08): ONE timetable.** Each bus line direction has its own offset: its first departure from its first stop, game
  min after midnight, then every `headwayMin` (`transitnet.js` `offsets: { fwd, rev }` → the export's `lines[].dirs[dir].offsetMin`).
  `traffic/buses.js` runs it (offsetOf) and the sim books it (`world/export/travel.mjs` nextDep, which the sim imports; `sim2/travel.mjs`'s
  stub takes it too), so a rider's booked bus is a run the city draws (movement.js fleet.runFor). Old exports without the field fall back to
  the line's `offsetMin` with rev half a headway on. The offsets are chosen by `tools/bus-timetable.mjs --search`: from buses.js's own run
  functions it finds, for every pair of directions, the offsets that put two buses through each other (bodies within 2 s) or two crossing
  buses inside one junction's bus window, and picks the least bad set (through each other ≫ windows overlapping ≫ inside a margin).
  **No offset set is conflict-free:** the 4's two directions serve the same kerbs on the same one-way streets in a different order, the
  14 fwd crosses its own path at Bishop × Central, and the 4's loops pass Grand × Central ~8 times a cycle — those need re-routes
  (the checker's what-ifs: `--without bus-4:rev` etc.). Run the checker after any route, stop, speed or headway change.
- **Bus routes (2026-10-08): the routes changed, so no two buses pass through each other.** The **4** and the **22** are LOOPS
  (`transitnet.js` `loop: true` → the export's line `loop: true`, `dirs: { fwd }` only, the run round from the first stop back to it):
  one direction, every stop served on the loop's kerbs. The city's bus stands on at the loop's first stop until the next lap's layover
  takes over (one bus at the seam); the sim books only that way (`world/export/travel.mjs`): a stop behind you is a ride on round the loop
  (off at the first stop, on the next lap's bus, one fare) or another mode. The **14** fwd turns left from Central Ave's end up Route 9 at a
  BUS-ONLY turn (`traffic/sim.js` BUS_TURNS: the lane's `busNext`, never in the cars' graph or the export's road graph; its light is the
  bus's own BUSWIN window). A line pins its legs with `via` points and may hold at a stop (`holds`: a timing point, the run entry's
  `hold`, kept by both re-timers), chosen with the checker (`--hold`, `--fb`) so the loops' own crossings and the lines' shared junctions
  fall in each other's gaps. Checker: 0 bus–bus through each other or inside the margin, 0 junction windows overlapping; the routes and
  timetable are in `world/export/README.md` (Network).
- **Spread (pass 5b, 2026-10-08): the city runs on the wider grid (SPREAD 4, `style/city/SPREAD.md`).** The same routes, 12.5 % longer:
  the 4 1572.9 → 1772.9 m (242.6 → 259.6 s round), the 14 693.6 → 779.6 m (98.7 → 114.5 s; rev 701.1 → 787.1 m), the 22 1125.7 → 1266 m
  (160.7 → 185.2 s round); the TIDE 398.6 → 448.8 m, the NEON 310 → 352.6 m. Every crossing moved, so the timetable is re-solved per
  spread (`transitnet.js` ST): the 4 holds 8 s at MAIN ST instead of Sunny Acres 3, Blackpine 5, Grand 8; the 14 holds 5 s at ST MERCY
  both ways (offsets 7.8 / 1.1); the 22 holds P.S. 280 5 s and Motel 9 4 s; the 4 stands 8 m on at DOCK ST (`buses.js` BERTH). Checker:
  0 bus–bus, 0 junction windows overlapping. `?spread=0` keeps today's timetable and data.
- **Bus retime (2026-10-09, slime: "yeah 8m bus", "why not just have it go same speed as cars?"; supersedes the bus timings above at +4):**
  - **The 8 m bus** (was 11 m): `vehicles/models.js`, `traffic/buses.js` BUS.len; riders hold a real place (12 seats, 4 standing in the
    aisle, the lowest free one; a 17th rides out of view), `simstate/movement.js` BUS_SLOTS.
  - **It drives like a car, and the timetable is booked from that drive.** Cruise = the street's car speed (10.5 side street, 12 avenue, 15
    Route 9), the cars' corner speed on the bus's own curve, pulling away and braking at 1.5 m/s², the booked dwell (6 s) and holds.
    `tools/export-world.mjs` books every leg with that same drive on the bus's own path (`transitnet.js` BUS_BOOK 'drive' at a spread) and
    marks the direction timed 'measured' + `drive: true`: the sim's tune() keeps it, `world/export/travel.mjs` books its arr / dep, the
    city fits each driven leg to its booked second. On screen (the page at the 60-min day, 150 s, every car and bus): moving buses 7.35 m/s
    mean against the cars' 5.4 (the cars queue at lights; the buses get their windows), in a turn 3.7 against the cars' 3.25 — before: 8.7
    and 9.6 against 4.7 and 3.1.
  - **Laps (booked = driven):** the 4 1490 m road, 261.2 s round (was 259.6 s flat at 8 m/s), holds BLACKPINE 7 + MAIN ST 2; the 14 101.4 s
    (rev 107.6 s; were 114.5 / 115.4), no holds, offsets 7.2 / 9.7; the 22 217.8 s round (was 185.2), hold PLEASANTVIEW 11, offset 8.3 (it
    meets no other line). Stop to stop the bus averages ~6 m/s with its dwells, ~7 m/s moving.
  - **Routes:** the 4 takes two BUS-ONLY lefts (`traffic/sim.js` BUS_TURNS, +4: Central eastbound → Grand Ave, 2nd St eastbound → Main St)
    instead of its three-rights loops round a block, which at the cars' corner speed crossed their own start behind the next bus. The 14 rev
    at MALL GATE **drives out** (`LEAD_OUT`): it stands 15 s, goes on west, stops at Birch St's line and turns right up Birch St, out of
    service (no bus window: a right on red after a stop), and ends a block north; its fwd's lead-in starts on Birch St past BLACKPINE.
  - **DOCK ST:** the shelter is on the south kerb the 4 serves (`districts/industrial.js` at a spread).
  - **Checker** (`tools/bus-timetable.mjs`): 0 bus–bus through each other, 0 junction windows overlapping (5 inside the margins, bodies
    apart); node gate 0 overlap frames, 0 reds. Kerb overhang worst 0.14 m (`tools/bus-kerb.mjs`).
- **Cross greens (2026-10-09, slime: "retime the buses so ones going the same way share a green"; supersedes the bus junctions' fall-back
  to the cycle above).** Once 8c9bbe4 played every bus window's yellow and all-red, Central Ave's cross streets went 70 s to forever
  without a green (-4,0 / 4,0 / 5,0 / 7,-4 never). Two causes. (1) Some stops stood the bus in a junction through its dwell, so its window
  held the cross street red for 17.5-19 s every 25 s. (2) Between windows a junction fell back to the 44 s cycle, which knows nothing
  of the 25 s timetable: a window that came in the cross street's 12 s took its green until the phase came round again (76 s at
  single-bus junctions too).
  - **Stops clear of the box** (`traffic/buses.js` BERTH, at a spread): the 14 rev at ST MERCY +11 m (its body stood over Bishop Ave), the
    4 at GRAND AVE +5.5 m, the 14 fwd at CENTRAL / IVY +1 m. Each tail now stops 3 m past the far zebra. (A rider's boarding walk to
    ST MERCY's door is longer: `movement.js` lerps it in 0.55 s.)
  - **The junction plans its gaps** (`traffic/rules.js` planOf, BUSGAP). Between two windows it knows, the bus's axis carries on, then
    its yellow and all-red, then the cross street's green up to the next window's clearing. The cross street gets the cycle's own share
    of the period (a side street 1/3, avenue × avenue 1/2), at least `zMin` 3.5 s. A gap too short for that stays with the bus's axis.
    Into a crossing window, the axis it needs turns green early by its share. WALK goes with each gap green (none in a window). The
    cycle runs before the first window and after the last one. `phaseLeft` reads the same plan. `buses.js` now gives BUSWIN every
    window due in the next `BUS.ahead` s (not only runs already going), keeps the one before the current gap (`BUS.keep` 16 → 40 s),
    and drops windows that were over before the fleet started or before a seek. A plan of gaps nobody saw used to switch lights from
    green straight to red.
  - **Same-axis buses share a window** (`transitnet.js`, at +4): the 14 rev 9.7 → 0.3, holds CENTRAL / IVY 1.5 s and ST MERCY 2.6 s
    (both ways). The 14's fwd and rev drift ~5-6 s apart per block, so no offset alone pairs them on all 20 of its Central and Route 9
    junctions. The holds re-pair each stretch between stops. Found with an evaluator of the real plan over every offset and hold
    (the 4 stays at 5: valid 3.7-5.3). Laps 101.4 → 105.5 s fwd, 107.6 → 111.8 s rev.
  - **Numbers.** Signals only (node: the fleet's BUSWIN + signalAt over 1100 s, every phase of the timetable against the cycle; 87 bus
    junctions, 174 axes): red > 60 s 24 → 0. Never green 4 → 0. No ≥ 3.5 s green for > 44 s 61 → 0. Worst red never → 21.2 s. Mean
    green share 0.38 → 0.34 (a clearance more each period). The tightest cross greens (geometry, a 25 s period): 1,0 and 4,0 ns 3.8 s,
    -3,0 / 7,-4 / 7,-3 / -4,0 4.1-4.3 s, 0,0 (avenue) 4.9 s. With cars (the review's `starve` probe, page loop at 1×, PINPERF):
    240 s: axes red > 60 s 16 → 0 (> 45 s 0), worst 240 s → 31 s (the start, from the cycle; 21 s after), the longest a car stood
    70 → 38 s. 600 s: 18 → 0 axes, 71 → 65 s (one car at 0,1 held for room: the queue from 0,0's 4.9 s avenue green backs up).
    redRuns 0, G → R with no yellow 0 (1×), fast play 60× as before.
  - **Gates:** `bus-timetable.mjs` 0 bus–bus, 0 windows overlapping, 0 inside the 1 s margin (was 2), node gate 0 frames, 0 reds;
    `cabcheck` F10 F11 F12 pass, cab–car 0, cab–bus 0 (bus–car 228 in 69 392 steps); `clockcheck` pass; the sim suite against this
    export 165 / 165 (the mode ladder too); kerb overhang worst 0.14 m. Page (`bus-clock.mjs`, 12 riders, the replay from D2 07:30 at
    the 60-min day, 5 movemock taxi rides): drift median 0.005, |p90| 0.01, max 0.02 game min; bus–bus 0; live buses = runs 1618 /
    1618; **reds at the line 0 of 3 631**; bus–car contact frames 0 of 48 553. (The first page run had 1 red in 3 583: a 4 at -1,-2.
    cabs.js fits a cab's window between two buses' windows, and a window too short to turn its axis green, once planned, pushed the
    next bus's green past its nose. The plan now leaves such a cab window out: 741efc1.) What it can't do: a cross green longer than the gap. On the avenue crossings (0,0, 4,0, -4,0) that is ~4-5 s every 25 s,
    against the cycle's 18 of 44. More needs fewer buses through them: the 14's headway, or a re-route of one direction (slime's call).

- **Taxi clock (2026-10-09, slime approved "cabs on the clock too", the same idea as the buses; supersedes "the cabs are still route cars"
  above at +4):** a cab is a pure function of its booking (`traffic/cabs.js`), as a bus is of its timetable.
  - **Booked from the drive.** The export books a taxi ride as the cab's drive on the ride's road path (`world/export/travel.mjs`
    `driveProfile`, `modes.taxi.drive`: each lane at its car speed, each connector at the car's turn speed, × 1.2 — a brisk cab: at the
    cars' own speed a kerb-riding scooter beat it on 35 of the sim's 60 long ladder trips; × 1.2 it is the fastest on 49 — pulling away
    and braking at 2.5 m/s², rest to rest) + 3 s to get out. The city drives that profile on the same links, fitted to the booked second.
  - **The clock.** The cab comes into the street 42 m up its lane (where nothing is in its body's way), pulls up at the kerb 4.5 s before
    the booked departure (the hail is readable: the rider hails ~5 s, the cab pulls up, they get in), leaves on the booked second, stands
    at the drop out of view's way while the rider gets out (on the kerb at the booked arrival), then drives on as an ordinary car.
  - **Round the buses.** Both are on clocks, so the cab's plan keeps its body out of every bus's sweep (body against body, every run due)
    and, where it costs the booking nothing, off a crossing bus's red (a softer red next, then the bodies only — the cab goes on a bus's
    red, counted): it stands on at the kerb a beat and/or drives its first part slower and the rest faster (× 0.5 … 1.2 the booked pace,
    eased), arriving on time. Node, 300 rides: 3 % arrive more than 1 game min late (a kerb inside a bus's turn).
  - **The traffic round it.** A kin car in its link's list (the cars behind follow it); the crossing cars hold short of its sweep (its
    stretches in the fleet's conflict table); no car turns onto its way in front of it within 25 s of it; nothing is spawned on its way, and
    the cars nobody sees are cleared off it; the cars ahead of it are escorted (at least 1.5 × the street's speed, through its green, never
    held for its own stretches or the box/room rule; one turns off its way only with time to spare and no bus to hold it mid-turn); its
    junctions get its green 8 s ahead (rules.js BUSWIN, never over a crossing bus's window). The last resort: a car in front of it it would
    be into is nudged on along its own way (a queue moves up as one) — counted, `fleet.cabs.stats()`.
  - **No cab outlives its clock** (audit F10): released at the end of its clock once its rider is out (90 s past it whatever), an
    ordinary car the population drops once unseen; a rider released mid-ride leaves an empty cab that finishes its clock; one released
    before the pickup leaves a cab that drives on. Regression: `tools/cabcheck.mjs` (F10 F11 F12 + cab–car overlaps, node); the page gate
    `tools/cab-clock.mjs`.
  - **F12 (loop change):** off one bus to wait for the next one (a loop's seam) the rider steps to the stop, not to the trip's last walk.
  - **Gates (2026-10-09, the replay moving at the 60-min day, `tools/cab-clock.mjs`, four runs, 23 synthetic taxi rides; the last two, 7
    rides, on the final code):** the rider on the kerb against the booked arrival median 0.01, p90 0.13, max 1.37 game min (the late
    ones: rides the plan kept off a bus by arriving late); orphaned cabs 0, route cars left 0, riders held 0; cab–bus 0, cab–cab 0;
    **cab–car 4 frames** (of ~52 000 counted: one car held for a bus inside a junction box a cab crossed; 0 in the final 7 rides). A run's
    page reloads when the replay's clock crosses dusk or dawn (simstate/live.js "reloading into it"): one run lost its summary to it. The
    escort's nudges: 4–256 steps a run (node, denser: far more). Planning a cab costs one frame up to ~0.25–0.5 s in the page (its stretches
    swept against the car links; node max 65 + 79 ms) — a hitch per taxi ride.
    Buses (`tools/bus-clock.mjs`, 12 riders): drift median −0.02, |drift| p90 0.38, max 0.41 game min; bus–bus 0; reds at the line 0;
    live buses = runs in progress 1526 / 1529; **bus–car contact frames 211 of 26 630 (11 pairs; before the cabs: 20 of 47 386, 1 pair)**
    — the escort pushes queues in front of cabs on into the crossing buses (node: 275 bus–car overlaps with the cabs against 105 at
    bb5e681). That is the open cost of a cab that can't own a lane. Checker (`tools/bus-timetable.mjs`) unchanged: 0 bus–bus, 0 junction
    windows overlapping, node gate 0 frames, 0 reds. Shots: `shots/cabs/` (taxi-plaza: the hail, the cab pulling up, getting in, the
    ride on the follow cam, the drop-off; loop-change: off the 4 at DOCK ST, the wait at the stop, on the next lap's bus).
  - **Round 2 (2026-10-09): the nudge and the buses.** Every bus–car contact in node, sorted by what had happened to the car:
    - **Fixed.** (1) `afterMove`'s "in front of it only" test had been inside the comment before it since the first cab commit, so the
      nudge also pushed cars beside and behind a cab. One car was pushed 130 m through red lights into a turning bus. (2) A car turning in
      behind a cab was held for the cab's sweep down the cab's own lane. It stood mid-turn inside a crossing bus's stretch for 88 frames.
      Now no car is held for a cab's stretches on its own way: behind it, IDM follows the cab; turning in ahead of it, the merge's own
      stretch holds it.
    - **Numbers.** Node `cabcheck` (all gates pass; cab–car 0, cab–bus 0; F11 p90 0.018 game min): bus–car **303** in 69 392 steps, down
      from 370 but still above the pre-cab 167 in 64 151. Every overlap: 386 (436 before; 304 pre-cab). With `performance.now` pinned (the
      bus fleet's sync reads the wall clock, so a node run varies by ±20): 234 against 348 before and 141 pre-cab. What is left: about
      40 frames from cars the nudge pushed into a bus's way, and about 190 frames of a bus touching a car held for it in a lane, the same
      kind the pre-cab traffic has (its rides cover other minutes and places). Page (`tools/bus-clock.mjs`, 12 riders, the 60-min-day replay from D1 08:30): 70 contact frames
      of 30 483 (3 pairs: two cars held for a bus in a lane, one held in a junction). That run had only one taxi ride (no nudges), though,
      so it measures the buses and the traffic, not the cabs. For comparison: 20 of 47 386 before the cabs, and 211 of 26 630 with them
      (measured before 235ec6b). Rider drift: |p90| 0.38 game min. Bus–bus 0, reds 0.
    - **The trade-off, open (slime's call).** The rest is the nudge itself. `CAB.yieldOn` (off) makes the cab yield instead: it brakes
      behind a car it could only nudge into a bus (`sim.js busRoom`: a bus's stretch still to come within `busH` s, or a bus's real body over
      the next `busNear` s), counts a queue as one, and doesn't go into a bus's stretch where it could be held inside (`boxH`). Node, wall clock
      pinned, 28 rides:

      | setting | bus–car | cab–bus | F11 |
      |---|---|---|---|
      | off (as shipped) | 234 | 0 | pass, p90 0.018 |
      | on, `boxH` 6 | 198 | **45** (a cab stopped in a junction behind a car held for a bus) | pass, p90 0.34 |
      | on, `boxH` 20 (the default when on) | 213 | 0 | **fail**: p90 2.43, one ride never on the kerb |
      | on, every car held for a bus never moved | 174 (none left from a cab) | 0 | **fail**: 5 of 28 never on the kerb |

      Between those settings (`boxH` 8, 10, 12, 15), every run either fails F11 or has cab–bus frames. A cab can't own a lane and still keep
      its booked second once the cars ahead of it are held for buses.
    - **Planning a cab** (the page's hitch per taxi ride): the same plans, now cheaper. In node, the car stretches went from median 30 to
      6 ms (max 78 to 13 ms), and the plan from median 4.8 to 1.5 ms. A plan that searches every late step is still slow: max 73 ms. In the page
      (`tools/cab-clock.mjs`, 6 rides, 60-min day), the longest plan took 35.6 ms (one ride on the old code in the same session: 77 ms).
      That is about two frames, so it is still a hitch. The same run: on the kerb |late| p90 0.035 game min; cab–car 0, cab–bus 0, cab–cab 0;
      orphans 0; 606 nudges. What's left is to spread the planning over several frames. The cab is planned 9 s before the
      hail and comes into the street about 3 s later, so there is time to do it.
  - **Round 3 (2026-10-09): the A/B's bus–bus pair was two cabs.** `tools/bus-clock.mjs` A/B (bb5e681 against 826a10b, the replay from
    D1 09:00): 826a10b had bus–bus 685 frames, 1 pair at (−289.1, 75.1), by Blackpine. Both bodies were cabs. The gate counted every kin
    car as a bus, and a cab on its clock is a kin car.
    - **The cause.** The replay starts with two riders (xXbadvibesXx, bluescreen.bucket: trailer → woods, the same ride 1 game min apart,
      taxi legs at 502–519) on their last walk. `movement.js` planned a cab for a ride that was already over. The cab came into the street
      at its drop and stood there with nobody to get out until `CAB.relMax` (90 s past its clock), so the two cabs stood in each other.
      Page probe (the replay held at D1 09:00 while the page loads, then 60 s): 2 cabs, cab×cab 1441 frames.
    - **Fixed.** A ride already over by its booking gets no cab, and a "no cab drawn" finish lets its cab go (`movement.js`). The probe
      now plans 0 cabs, with 0 frames. The bus gate counts kind `'bus'` as buses and the other kin cars (cabs, stage cars at the kerb)
      apart (`otherKin`). Node `cabcheck` unchanged: F10 F11 F12 gate pass, F11 p90 0.018, bus–car 303 in 69 392 steps.
      `bus-timetable.mjs` unchanged. Bus-clock A/B on the fix (one run each, 4 pages at once, ~32 fps; no taxi ride on either page):
      bus–bus 0 and 0, other kin 0 and 0, bus–car 79 of 24 454 frames (bb5e681) and 165 of 24 716, |drift| p90 0.33 and 0.32.
    - **What the cabs cost the buses, in the page.** `tools/cab-clock.mjs` now counts bus–car contacts while its rides run. One run each:
      bb5e681 (route-car cabs, 6 rides) 314 contact frames in 28 777 ride frames (10.9 ‰); HEAD (10 rides, cab–car, cab–bus and
      cab–cab 0, on the kerb |late| p90 0.033 game min) 214 in 35 143 (6.1 ‰). Nearly every contact is a car held for a bus in a
      stretch (`hold: 'bus'`); 1 of HEAD's 15 involved a car escorted for a cab. A single page run can't separate the cabs from the
      spread: the bus gate alone, with no cab, gave 79 and 165. Node, denser, still shows it (303 against the pre-cab 167).
    - **Open: two cabs on one kerb.** Two rides booked a few seconds apart to the same kerbs (a party on the same trip: the movemock made
      this one) still stand in each other when both are live. Node, those two rides from their approach: cab×cab 307 steps, at the pickup
      and at the drop. Two fixes: they share the cab, or the second one pulls up behind the first. Not done: slime's call.
  - **Round 4 (2026-10-09): slack, and a cab that waits like a car** (traffic research #1, A + B + C; slime "1-3 AGREE" #2). **Built,
    and left off (`CAB.yieldOn` false): a starved turn at -5,0 stalls a yielding cab for good.** With the flag off, every number is
    the shipped one (cabcheck below, unchanged to the digit).
    - **What is built.** A: `travel.mjs` books `drive + out + slack` when `modes.taxi.drive.slack = { sig, share }` is set (s per
      signalled junction on the ride + share × the drive). The export doesn't set it, so it is unchanged. `planCab` then drives the
      drive itself (to `tFast`) and stands the rest at the drop; `movement.js` lets the rider out at `P.tOut`, the pay beat. B (with
      `yieldOn`): a car the camera sees (`TS.seen`) is never nudged, and keeps its own pace (`escSeen` 1.05, not 1.5). It is still let
      into a box with a crossing car in it, because that car holds short of the cab's way: with the waiver gone, the two held each other
      for good. The cab waits for a crossing car standing in its sweep (`crossLimit`). While it stands short of a stretch, that
      stretch holds nobody (`window`): a crossing car held for a cab that couldn't come held the car in front of the cab. Its pull-away
      into a bus's stretch is timed at `CAB.acc`, not 3 m/s (`busBlock`). The car first in front of a stopped cab, held at its line for
      a bus `CAB.patience` s, takes another way off the cab's if it has one. C (with `yieldOn`): off its clock where neither the cab nor
      its clock spot is seen, the cab is put back on its clock (`snaps`). A rider made late by a cab, unseen at both spots on the walk,
      is put back on the booking (`delaySnaps`). Counter: `fleet.cabs.stats().nudgesSeen` (and `nudges`, `unstuck`). cabcheck prints
      it, the stand at the drop and each ride's slack and lag; it is a gate only with `yieldOn`. Also `--world <export>` and
      `CABYIELD=1|0`.
    - **The stall.** At -5,0 the right turn off lane 208 onto Central (its only other exit is a U-turn), and connR 983 into the same
      lanes, need about 8.6 s between the 14 rev's windows and the 4 fwd's on connR 972 / lane 8. They never get more than 7.2 s. With no
      cab at all (traffic + fleet, seed 404, 400 s, 70 m seen round the corner), a car stood there held for a bus for 397 s. The old cab
      shoved such cars through. A cab that may not shove a car the camera sees stands behind them for good.
    - **Numbers** (node cabcheck, 28 rides, seen = 70 m round the rider or cab):

      | | shipped (yieldOn off) | yieldOn, no slack (k 1.3) | yieldOn, ladder-safe slack (k 1.3, kT 1.3, a = b = 3, 5 %) |
      |---|---|---|---|
      | never on the kerb | 0 | 6 (4-5 through -5,0) | 7 |
      | |late| p90 / max (game min) | 0.019 / 0.784 | 0.051 / 4.09 | 0.43 / 4.19 |
      | nudges while seen | **11 591** (4.7 km; every nudge is on a seen car) | 0 | 0 |
      | cab–car / cab–bus | 0 / 0 | 0 / 16 (a cab stood on a connector at -5,0 behind a stalled car) | 0 / 16 |
      | bus–car / every overlap | 228 / 301 | 31 / 47 | 31 / 47 |

      With yield on, 16–17 of 28 rides never leave their clock. The rest lag 4–38 s at the drop. The research's 2 s per junction would
      have covered most of them, but the ladder won't carry it (below).
    - **The ladder caps the slack.** 1021 of 1048 connectors are signalled, and a median ride passes about 11 of them. Counted with the
      sim's own `tv.plan` on the ladder's 60 trips (it needs 48 with the taxi fastest): shipped 49. 2 s per junction + 5 %: **0**.
      0.5 s per junction + 5 %: 33. k 1.2 → 1.3 alone buys 2.4 % of the drive (the drive is bound by pull-away and corners): 57 with
      no slack. k 1.3, kT 1.3, a = b = 3: 5 % → 57, 10 % → 45, any per-junction slack ≤ 41. So the ladder carries about 5 % of the drive
      (~2.5 s median), and only with the brisker drive.
    - **Open (slime's call).** (1) Give -5,0's right turns a gap: the 14 / 4 timing there, or a right-turn green in `planOf`. Then turn
      `yieldOn` on and re-measure. (2) Let a car starved at its line take a smaller margin. Tried `BUS_TAKE` in sim.js (0.6 s after 12 s
      held): no effect, because the light, not the margin, binds. (3) Keep the shove for cars held for a bus only, which leaves some
      seen nudges.

- **Cab traffic (2026-10-10, slime: "cabs can arrive when they arrive like normal traffic"; supersedes the taxi clock above).** The cab's
  ONE advantage is in the sim: a WANTED rider skips the station cops. In the street it is not meant to be fast.
  - **A car of the traffic.** `traffic/cabs.js`: the cab is a route car with `asCar` (`traffic/sim.js`): IDM, the lights, the box, the
    zebras, the car ahead, the ambient speeds and corners, the average driver; it asks no priority and never takes another way off its
    route. Gone with the clock: the junction windows (`rules.js` CABWIN), the escort, the nudges, the clearing of unseen cars, the
    conflict table the cars held short of. Every junction runs its fixed cycle. The pilot's car–car overlap under the escort at 6,0 went
    with it.
  - **The signal clock is the movement clock** (`traffic/fleet.js` → `rules.js lockClock`): the lights' second is game minute × 2.5, so
    a light's phase is a pure function of the game's time.
  - **Booked honestly.** `world/export/travel.mjs carDrive` replays sim.js's step for a car alone through the fixed-time lights (its
    speed, the turn ahead, the light, the yellow, a straight car's "late" rule, a turner's wait for the WALK on the zebra it turns over)
    from the ride's departure second; the export carries what it needs (`graph.road.sigc`, `bands`, `signal`, `modes.taxi.drive.car`).
    A ride = that drive + 3 s out (+ 1.6 s out of a stand's bay); the menus and the dense table use the mean over 8 departures across
    the 44 s cycle. The sim books it (`sim2`: the vendored export). The hail is 20 s again (it was tuned to 10 so a cab was the fastest
    way on half the trips).
  - **The approach** is planned with the same function: the cab comes into the street 42 m or more up its way at the second that brings a
    car alone to rest at the kerb 4.5 s before the booked departure (nearer the kerb, never within 18 m, when a red would make it more
    than 6 s early), where no body is over its own (+1 m behind, 2.5 m ahead) and nothing behind can't stop for it. A page that joins
    mid-ride puts the cab where carDrive has it.
  - **The stands' kerb.** `transitnet.js TAXI_KERB`: ST MERCY 4 bays in the kerb lane x 187.4–209.8 (the pilot's free strip), UNION AVE
    3, JAY ST none (its sign is on the travel lane's side of a one-way: the cab stands in the lane, 6 m short of the line). A cab stops
    beside its bay (never short of it, never on a diagonal), pulls in (1.6 s, kin, out of the lane's list once in), and pulls back out when
    the rider is in and the lane can take it (`sim.js kerbIn / kerbOff / kerbBack / kerbGo`). Bays are claimed per ride: a second
    ride's cab takes the next one. The stand's point (where riders wait) moved off its sign post; `street.js` keeps parked cars off the
    bays. A taxi rider waits 0.4 m in from the kerb (the 2.4 m cut stood avenue riders 0.6 m out in the road); the door is on the kerb side.
  - **Numbers** (2026-10-10). The residual — the cab at rest at the drop against the booking — `tools/cabresidual.mjs`, the cars and the
    crowd wired as the page wires them, seeds 404/405/406, 48 rides each: empty roads |0.22| s at most (48 rides: the booking is the
    city's car); with the traffic p50 39.5 s, p90 91.7 s, max 258.9 s (15.8 / 36.7 / 103.6 game min) over 140 rides, and 4 more held
    past 270 s (given up: the rider is put on). 60 of 144 within 5 s; most of the rest are late by whole 44 s cycles: a few seconds
    behind a car or a walker, the cab falls off the green wave and meets the next reds. WALK removed by cab rides: 0 s at all 236
    junctions (24 rides; 3165 s at 137 junctions before). `cabcheck`: cab–car 0, nudges 0 (6152), the traffic's overlaps 51 over the
    old run's 69 392 steps (82). The ladder (the smoke test's 60 long trips): the taxi 49 / 63 / 92 min (it was 30 / 32 / 37), 8–9 cr;
    an owned scooter is the fastest on all 60 (19); without a ride the taxi is the fastest on 58 (as booked).
  - **Open (slime's call).** The residual is large and bimodal; the booking could add the traffic's own expected delay, or the cab could
    take a smaller share of red (both are slack by another name). The drop kerb is the travel lane: where a car is parked at the kerb
    there (the plaza's cruisers) the rider gets out between the cab and it, 0.1 m off it.

- **Cab follow-up (2026-10-10).**
  - **No give-up jump.** A rider whose cab is far behind its booking no longer appears at the next walk at once. Past `MOVE.cabBail`
    (120 s late), with the cab at rest in a lane, they pay, get out on the side the walk on starts (the cab held there, `cabs.js bail`)
    and walk the rest on the walkers' graph from that point (`world/export/travel.mjs`, the later legs replaced; their arrival stays late)
    — when walking it at a late walker's 1.6× pace is quicker than even the cab alone would be from there (`cabs.js eta`: carDrive), and
    past `cabGiveUp` 600 s (a cab that can't get on) whatever the walk. A rider whose cab hasn't come `cabWait` 90 s after the booked departure walks from the kerb instead.
  - **The stems.** The very late rides stood at T junctions where a one-way street ends (45 such approaches: z −1 into x −5 by the
    trailer park at −5,−1, x 2 into the waterfront at 2,−7). Their only way out is a turn, taken in the flashing DON'T WALK, into a
    street that gives them a side street's green; the random driver went on straight three times in four, so the stems took most of
    what came up to them and stood full. A driver with another way now turns into a stem a tenth as often (`TRAFFIC.stem`), and a
    turner who meets WALK no longer swerves straight on into one (`traffic/sim.js`). Measured (`corridor` probe, seeds 404/405,
    540 s): the stem below −4,−1 was full 16–38 % of the time, now 0; x −5's block below −5,−1 full 16–25 %, now 5–7 %; the
    waterfront stem at 2,−7 full 14–80 %, now 0–6 %. Cars now also wait for a long body's tail left over a junction it has just left
    (a box truck straddling a node with no box sat inside a cab for 22 s).
  - **Drop-offs at the kerb.** Where the drop lane has a kerb lane on the door's side (`L.kerb`: an avenue's, a one-way's parking
    side), the cab picks a free stretch of it — clear of the cars the blocks stand in the road (`anchors.parked`, `main.js parkedIn`)
    and of any car pulled in — up to 10 m back or 6 m on, pulls in, lets the rider out and pulls back out; with none free it stops in
    the lane where the door faces a gap between them. The booking counts the pull (`world/export/travel.mjs`).

## 6. The city in motion
- **True-sync walkers:** no catch-up teleports. Skate, bike and scooter carry their own models; the bus, subway and taxi as in §5.
- **Activity loops for every act:** deal (pace, look out, hand-offs, lean), gather (pick or shovel at the site), craft (a bench),
  work (stock, carry boxes, sweep), patrol (walk the beat), wait or hang (sit on stoops, lean, small talk). Cooking is indoors: the
  window glows and steam rises.
- **Social:** a `say` turns both speakers to face each other with gestures and the bubble; crews cluster.
- **Standing room at every place:** nobody is invisible indoors unless asleep, at home, or inside a shop.
- **Events:** the stage system (`stage/`) plays the event clips (§7C).
- **Built (W8, 2026-10-08):** `simstate/life.js` runs the activity loops, the social facing and the crew clustering; `simstate/stands.js` gives every spot a kind (`wall`, `stoop`, `bench`, `corner`, `open`) and its room to move (`pace`, `beat`, `st`); the stage's deal plays `brush_pass` as a pair. Talk, patrol and work clips are wired by name (`talk_gesture`, `listen_nod`, `patrol_walk`, `dig_pick`, `dig_shovel`, `carry_box`, `stock_shelf`, `sweep`) and light up when synced. SIMLIVE.md has the details.
- **Crowd grid (2026-10-10, slime: "nobody walks through anybody, and nobody stands in the road" — local steering and a shared map of
  who's standing where, not a space-time booking).** Measured in a node crowd check of the pilot's site (junctions 4,0 and 5,0, box x
  104…222, z −42…42; the real traffic, the crowd on the page's own block lanes and the side room table, seeds 404/405/406, 300 s after a
  50 s warm-up, 20 Hz; plus 43 booked walk/skate/bike/scooter legs, the pilot's three cast trips, the stand spots, ST MERCY's cops and a
  knockdown on Central Ave's north walk):
  - **The road first** (`pedsim.js` corners, `CORNER`): a sidewalk walker gives a corner to anyone still out in the road on a crossing
    into it, and takes a corner only when it can walk through it without stopping inside (its way on clear); a zebra's walker waits for
    its far corner on the kerb, 0.9 m short of the node, never in the road; the kerb spot is braked onto (it used to creep the last 20 cm
    for seconds, holding the corner behind it); out in the road on the hand a walker hurries (1.45 m/s); at the kerb it steps off only if
    the time to the cross street's green (the signal plan: a cab's window included) covers its walk and a beat per walker still in the road;
    a dog owner at its spot no longer counts as walking out (it held a zebra's walkers in the road through a whole red). Traffic and crowd
    (the pilot's measure): walkers in the road at the cross green 32/15/8 → 0/0/0; longest in the road 34.0/19.1/20.4 → 11.3/11.9/11.5 s;
    longest standing still in it 21/9.3/11.2 → 1.5/2.5/1.4 s. With the riders and the two booked cab rides: 21/19/16 → 5/4/3, all
    at the two cab windows, which cut a WALK to yellow with no flash (4 s to the cross green: `traffic/rules.js` planOf, the cab's side).
  - **The body map** (`pedsim.js` `GRID`, `gridBuild` / `near` / `bodyStep`): every step, a 2 m hash of every walker near the camera and
    everyone off the lanes (agents at their spots, station cops, the stage's actors, riders on their legs) and whatever the city publishes
    in `sim.bodies` (the stage's footprints). A walker on the lanes looks along its own way ahead (round the corner it will turn) for
    someone standing there and steps round them inside its side's clear strip (up to `GRID.reach` 1.2 m), slowing to make the step, or
    stops short and queues; caught inside a footprint as it came down, it walks out. Each walker reads it every other frame. Every walker
    now carries all its fields from birth (the drawing's, the agents', the stage's too): fields added mid-life made the step's reads of
    every walker megamorphic — with them fixed the crowd's update is no dearer than before (below).
  - **The capped lag** (`simstate/movement.js` `MOVE.lag`): a walk, skate, bike or scooter leg reads the map along its path and brakes
    behind whoever won't make way (a body off the lanes, a footprint, a walker at a kerb or in a corner, one standing for it), up to
    3 s behind its booking; it catches up at 1.35× (a walk 1.6×, never more than +1.5 / +0.9 m/s) when clear, and is put back on the
    booking at once where nobody sees it or where its booking is. A leg ends where it is drawn to its end; a wait after it absorbs the lag.
    The weave reads the same map (a footprint keeps its room). Lag (s, frames moving): p50 0 / 0 / 0, p90 1.73 / 2.13 / 2.08, max 3.
    **At walking pace only** (`MOVE.lag.maxPace` 1.5, 2026-10-10): the brake, the catch-up and the cap are body speeds, and the crowd
    walks in real time; with the movement clock over 1.5× the natural pace (the tape at 4× and up, where a marker click plays) a leg
    was held, capped, let go and held again — a stop every other frame and pops of 0.7–4 m (`tools/tapeclick.mjs`; @xXbadvibesXx's
    crew walking into the Heap at 4×: 41 frame-to-frame changes of speed over 3 m/s in 8 s, 9 with `MOVE.lag.on` false, 7 at d3706dc
    before the crowd grid, 6 with this gate; at 1× 0).
    Above it the lag is off, as before the crowd grid; a lag held then is walked off. A jump of the clock (a seek) starts it over.
  - **Movers on a zebra** (`MOVE.zebra`, `zebraLat`): a leg crosses 0.75 m to the junction side of the walkers' first file, past the crowd at
    the kerb — where no corner post is in the way (at the site the N/S arms; the W/E arms have a signal pole 0.75 m to the junction side of
    the kerb spot, and a mover there keeps the file's line).
  - **Body overlaps** (pairs of bodies closer than 0.6 m: onsets in 300 s / pair-seconds per second): 149/176/143 → 86/123/82,
    0.227/0.248/0.175 → 0.162/0.214/0.120. What is left is riders at their cap: through a kerb crowd on a red (no room past the pole),
    round corners.
  - **The knockdown on a sidewalk** (`stage/crowd.js` `FOOT`): the actors are bodies on the map — upright, their body; down, their fall's
    footprint (vignettes.js BACK_FP / SIDE_FP as eight discs) — each with 0.3 m of room. The crowd steps round or stops and queues, with no
    time-out; the HOLD is the arrest's way only now. Walkers in the footprint after it came down: 3/1/4 (8.2/3.4/6.7 s) → the crowd 0,
    riders 1/0/1 (0.3/0/1.35 s).
  - **Station cops' stands** (`transit.js` 'cop-stand', `audit.js` WALK_FREE): reserved, but no longer an obstacle the lanes bend round
    (1st & Kent's and Washington's on their 3 m walks: 0.65 → 0.10–0.41 m from the lane); a posted cop is a body on the map. The side
    room table is remade for the lanes (`simstate/room.json`: 18 sides whose lanes had moved since it was made, 81 whose strips had).
  - **Walker jumps** (a body moving > 0.5 m in one 50 ms step, a clip's own hand-off — a car door, a kickturn — aside): 33/36/34 (max
    1.2 m, every one a sim agent's leg) → 0/0/0. A mid-side path point (a door's, a trip's end) was drawn on the export's node line, 1.2 m
    in, while the lane beside it rests 2.4 m out on a 4 m walk; such a point is the lane's own now (`geomRaw` sideAt), a trip's end and a
    wait stand where the leg was drawn to, pieces that don't meet are joined over a metre (`finish`), and a straight-on corner whose lanes
    don't meet at its node (a pinched corner) is curved like a turn (`pedsim.js` arcAt).
  - **Cost** (the page at the busiest view: the site, a Director's rush downtown, ~2170 walkers; three runs each, interleaved, the same
    replay): the crowd's whole update `peds.update` 2.06 / 2.09 / 2.07 → 1.98 / 1.90 / 1.73 ms a frame (p95 2.4–2.5 → 2.1–2.4); the crowd
    step 1.14–1.21 → 0.97–1.11 ms; frames vsync-capped at 16.7 ms before and after.

## 7. The animation list (the cast system: the cast animation source (a local authoring source, not in this repository), synced to the city)
**Constraints:**
- Poses are procedural in the vertex shader (`idle.js`, `walk.js`, the animation texture).
- **Arms are one piece, with no elbow** (slime's simple-arms call, 09-30). Design every clip within that. Where an elbow would really
  help (cuffs, a hand on a bar), note it, but don't change the body.
- Sitting and seated poses need the legs' knee and hip; check what the leg system supports first.
- **One registry, one file per SMALL GROUP** (slime, 10-07: "1 agent doing too many animations will regress"). `anim/clips/` holds
  `robbery.js`, `falls.js`, `arrest.js`, `skate.js`, `ride.js`, `transit.js`, `deal-hang.js`, `talk-patrol.js`, `work.js`, plus an index
  that the pose code reads. **Each group is its own agent (3–6 clips).** Animation agents only author clips, previews and gates. Syncing
  to the city and wiring clips into the stage or walkers is done by the integration agents (W3, W8) and W4 (robbery only), so nobody
  collides on `sync-cast`/`bake`.

**The families:**
- **A. Activities:**
  - deal: `deal_pace`, `deal_lookout`, `brush_pass` (a mirrored pair)
  - hanging around: `lean_wall`, `sit_stoop`, `sit_bench`, `talk_gesture` (3 variants), `listen_nod`
  - work: `dig_pick`, `dig_shovel`, `carry_box`, `stock_shelf`, `sweep`
  - `patrol_walk`
- **B. Travel:**
  - skate: `skate_push`, `skate_ride`, `skate_kickturn`, `skate_ollie`
  - `scooter_ride`, `bike_pedal`
  - riding transit: `sit_ride` (seat sway), `stand_rail` (an arm up on the rail, sway)
  - taxi: `hail_taxi`, `car_get_in`, `car_get_out`
  - stations: `stairs_down`, `stairs_up`, `turnstile`
  - `wait_stop`
- **C. Events:**
  - the robbery: `rob_lunge_grab`, `hit_stumble_back`, `run_getaway`, `hands_up_point`, `pat_pockets`
  - falls: `fall_back` → `lie_hurt`, `death_collapse` → `lie_still`, `shot_hit` (a toon knockback and fall)
  - arrest: `cuffed_idle`, `cuffed_walk`, `cuff_apply`
  - `scuffle_pair`, `flee_run`, `cower`

  Lengths and key poses for the robbery and arrest clips are in the events report (2026-10-07; `stage/` notes).

## 8. Who builds what
**Wave 1** (started 2026-10-07):
- **W1 · Sim movement:** worktree the movement worktree (a local worktree, not in this repository), branch `sim/movement` off master. The sim session reviews and merges.
- **W2 · Map export + transit network:** `tools/export-world.mjs`, the lines and routes, the travel table.
- **W4 · The animation registry + the ROBBERY group** (`robbery.js`: lunge-grab, stumble back, getaway run, hands up and point, pat
  pockets): in ai-city-fresh, plus wiring the robbery into `stage/`.
- **W7 · UI:**
  - Zine × TE · Pink becomes the kit's default skin on every screen, plus a cohesion pass
  - leaderboards → one-click follow
  - a Home section on the profile

**Wave 2** (after wave 1 lands):
- **W3 · True-sync movement + transit in the city:** walkers, bus, subway cutaway, taxi.
- **Animation group agents, one per group, 3–4 running at a time** (the gates are heavy):
  - **events:** `falls.js` (fall_back/lie_hurt, death_collapse/lie_still, shot_hit, flee_run, cower) and `arrest.js` (cuffed_idle/walk,
    cuff_apply, get_in_car, scuffle_pair, brush_pass)
  - **travel:** `skate.js` (push, ride, kickturn, ollie, plus the board prop), `ride.js` (scooter_ride, bike_pedal, plus the props) and
    `transit.js` (sit_ride, stand_rail, wait_stop, stairs_down/up, turnstile, hail_taxi, car_get_in/out)
  - **activities:** `deal-hang.js` (deal_pace, deal_lookout, lean_wall, sit_stoop, sit_bench), `talk-patrol.js` (talk_gesture ×3,
    listen_nod, patrol_walk) and `work.js` (dig_pick, dig_shovel, carry_box, stock_shelf, sweep, plus the tool props)
- **W8 · City life staging:** activity loops at places, social facing, standing room.

Revert points: tag `pre-movement` on cast/fresh-traits and tag `pre-anim-round` in ai-city-fresh.
