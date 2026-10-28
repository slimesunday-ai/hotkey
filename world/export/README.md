# world/export: the map → sim export (MOVEMENT.md §4, §5)

`world.json` is the real city as data the sim plans trips on. The sim reads it through the `WORLD_EXPORT` path and imports
`travel.mjs` (next to it) for trips. Regenerate with `node style/city/tools/export-world.mjs` (about 1 s, pure node). The same inputs
give byte-identical output. The tool ends with the id check, and `--check` runs only the check. It exits 1 if any of the sim's 29
places or 366 lots is missing or moved, or if any registry apartment is.

**Units:** metres, and REAL seconds everywhere. Game minutes appear only in a trip's `dep`/`arr`: 1 game min = 2.5 real s
(MOVEMENT.md §1). World frame: +x east, +z south, one block = the pitch P = 36 m (`world/city.js`: SPREAD 4, the default since
2026-10-08's flip; `world.s0.json` / `transit.s0.json` / `apartments.s0.json` beside these are today's city at 32 m, `?spread=0`).

## Files
- `world.json`: everything below (about 1 MB).
- `travel.mjs`: the helper. Pure JS with no imports, so it runs in node, the browser or a worker. The export builds the dense table
  with this same file, so the table and a live trip never disagree.
- `apartments.json`: the apartments **registry** (the 10-01 rule: fixed ids, like the lots). `tools/apartments-seed.mjs` only ever
  appends new units or marks vanished ones `gone: true`. It never re-keys. The export reads the registry, not the geometry.

## `world.json`, top-level keys
| key | shape |
|---|---|
| `version`, `generated` | `1`; `generated` is a content hash, not a clock |
| `units`, `modes` | the mode table: `{ walk: { speed: 1.5, on: 'walk', fare: 0 }, skate: { speed: 4 }, bike: { speed: 5.5, on: 'edge' }, scooter: { speed: 6.5 }, subway: { speed: 16, fare: 2 }, taxi: { speed: 11, base: 3, per100: 1, night: 1.5 } }` (subway, waits: the sim's MOVE table, sim2/rules.mjs, which is authoritative; a line with its own clock overrides the subway row for that line: `transit.lines[]` below). **No `bus` mode since 2026-10-09** (buses out) |
| `districts` | id → display name (as in `places.json`) |
| `places[]` | `{ id, name, kind, dist, x, z, indoor, stands, src: 'sim'\|'kit', standsEst?, block?, yields? }`. The 29 sim places come first and are byte-for-byte the sim's own fields. Then 23 kit places (`<district>.<hero id>`, e.g. `strip.honest-pawn`, `forest.ferry-landing`) |
| `lots[]` | the 366 lots exactly as in `sim2/places.json` (`id: 'lot:x,z'`, `x, z` = the front door) |
| `apartments[]` | `{ id: 'apt:<i_j>·L<k>·<floor>', building, block, dist, floor, x, z (the street door), stoop }`, 985 units |
| `transit.timing` | `{ subwaySpeed, subwayDwell, stairs, transfer, taxiStandWait, taxiHailWait, measured? }` (real s, m/s; `busSpeed` / `busDwell` went with the buses, 2026-10-09). `subwaySpeed` / `subwayDwell` time a line without its own clock. With `measured` (the file it came from) the taxi waits are the measured pick-up: the hail to the cab moving off with the rider in |
| `transit.stations[]` | `{ id, kind: 'subway', name, x, z, face, dist, block, lines, stands, built, proposed? }` |
| `transit.stops[]` | `{ id, kind: 'bus'\|'taxi', name, board: null, x, z, rot, dist, block, lines, built, unserved? }`. The 16 `kind: 'bus'` entries are the old shelters (buses out, 2026-10-09): they stay as attach nodes and street furniture, `lines: []`, `unserved` says why; no line stops at them |
| `transit.lines[]` | `{ id, kind: 'subway', name, bullet, colour, headwayMin, offsetMin, stops: [ids], speed?, dwellS?, fare?, blurb, dirs: { fwd, rev } }`. **A line's own clock (SUBWAY PLAN, 2026-10-09):** `speed` (m/s between stations), `dwellS` (s at each intermediate station) and `fare` (cr) — optional, each defaulting to `modes.subway` (`speed`, `fare`) and `transit.timing.subwayDwell`. The export writes all three on every line. A ride's fare is the HIGHEST fare of the lines it uses (one fare a trip, a change included). Its runs are timed at its own speed and dwell, and its `headwayMin` is its own: a sim that re-times the runs from its MOVE table must keep a line's own clock |
| `…dirs.fwd/rev` | `{ timed: 'flat', offsetMin, run: [{ stop, m, arr, dep, pt }], path: [[x, z]…] }`. `offsetMin` = this direction's first departure from its first stop, game min after midnight, then every `headwayMin` (transitnet.js `offsets: { fwd, rev }`, else `rev` half a headway after `fwd`). `arr`/`dep` = real s from the first stop's departure: `arr` = the previous `dep` + the straight metres / the line's speed, `dep` = `arr` + the line's dwell (the last stop: `dep` = `arr`). `pt` = the stop's index in `path` (the stations, in run order) |
| `transit.taxiStands` | the three stand ids. A taxi can also be hailed at any kerb. (CAB TRAFFIC, 2026-10-10) a stand's `stops[]` entry carries `sign` (the sign post's spot), its `x, z` are where its riders wait (clear of the post), and `slots` — kerb-lane bays `[x, z]` a cab pulls into out of the travel lane (JAY ST has none: its sign is on the travel lane's side of a one-way); its road attachment is the travel lane beside the first bay, the cab's nose at the bay's front |
| `mainland` | `{ frame, plots: [{ id, address, street, x, z, rect, status, prime }], access: { via: 'ferry', status: 'stub', island, mainland, crossingMin: null, fare: null } }` |
| `graph.walk` | the walkers' graph from `pedsim.js`, by its own edge ids: `keys[]` (`'i,j,NW'`), `xz` flat, `edges` flat `[from, to, len]` per edge id, `side[]` (1 = a sidewalk side in the core, where things attach), `both[]` (1 = a trip walks this edge either way: an open ring, below) |
| `graph.road` | the cars' lanes from `traffic/sim.js`: `lanes` flat `[link id, x0, z0, ux, uz, len]`, `live[]` (1 = in the core), `ave[]` (1 = an avenue or Route 9), `conns` flat `[link id, in lane, out lane, len, mid x, mid z]`, `sig[]` (per connector: 1 = through a signalled junction), `turnM` (the metres a turn costs in the road choice: travel.mjs); at a spread also `v0[]` (each lane's car speed), `cv[]` (each connector's), and (CAB TRAFFIC, 2026-10-10) `sigc` (per connector its junction's cycle `[gNS, gEW, offset]`, 0 0 0 unsignalled), `bands` (per connector the zebra it enters over and the one it leaves over, `[s0, s1, code]` each: the nose's stretch along it with the body on the band; code −1 none, bit 0 = its WALK is `walkAcrossNS`, bit 1 = a walkers' crossing), `signal` (`{ yellow, allRed, flash, len }`), `kerb` (CAB FOLLOW-UP: per lane, m to its right to the kerb lane where cars park; 0 none) |
| `attach` | id → `{ w: [[edge, s, d, in]…], r: [[lane index, s, d]…] }`: where every place, stop, station, lot and apartment meets the two graphs. `in` (movement review #1, 2026-10-09): 1 when the straight stretch from the id's point to that sidewalk point is drawn (it stays off the road surface and the sea, and the id isn't an indoor place), 0 when a walk starts or ends on the sidewalk there instead (corners, indoor places, the labs, the woods, the jail, BLACKPINE, LONG BRIDGE) |
| `travel` | the dense table (below) |

**`travel`:** `{ nodes: [ids: places, stops, stations], modes: ['walk','skate','bike','scooter','subway','taxi'], m: { <mode>: [N×N] }, s: { … }, fare: { … } }`.
Rows are major: entry `[a × N + b]` is from `nodes[a]` to `nodes[b]`. `m` = total metres (walks included), `s` = total real seconds,
`fare` = credits by day. `null` means no such trip. Waits are the expected ones (half a headway).

## How each mode is measured
- **walk, skate:** on the walkers' graph. Its sidewalk rings are one-way, the same graph the city's walkers and agents use. The first
  and last stretch along a side may run either way, to the nearer corner. Skate uses the same metres at 4 m/s. **Open rings (2026-10-09):**
  where the sea or the woods leaves a block's ring open (the sea row, j −8, has no north side), the one-way ring is a chain that starts
  from nowhere or ends nowhere; every edge outside the one-way graph's strongly connected core is walked either way (`both`), and the
  core things attach to is the strongly connected part of that graph (872 of 876 nodes; the island's own 4 have no sidewalk over the
  bridge). LONG BRIDGE now meets Route 9's west sidewalk 18 m off (it was 51 m off, across Route 9 and the corner). **A node to itself
  is 0 m** (it was the access walk out and back: 119 m at LONG BRIDGE, on every transit trip from or to it).
- **bike, scooter:** on the **road edge, both ways**: the same kerb lines, unbound by the walkers' rings or the cars' one-ways. The walk
  from the door to the kerb and from the kerb to the door is at walking speed.
- **taxi:** on the cars' lanes (one-way streets, no left turns off the avenues, as the traffic sim drives; each turn costs `graph.road.turnM`
  = 30 m in the choice, so a cab drives an L, not a staircase of corners: transit sync, 2026-10-08). Either hail at the kerb
  (`taxiHailWait`, 20 s: CAB TRAFFIC put it back from 10) or walk to a stand (`taxiStandWait`, 5 s), whichever is faster. Fare = (3 + 1 per
  100 m of ride) × 1.5 at night. **CAB TRAFFIC (2026-10-10, slime: "cabs can arrive when they arrive like normal traffic"; it replaces the
  taxi clock of 2026-10-09):** the city's cab is an ordinary car of its traffic — no signal priority, no escort — so a ride is booked as
  that car ALONE on the ride's road path from its departure second: travel.mjs `carDrive` replays traffic/sim.js's step for a lone car
  (`modes.taxi.drive.car`: the IDM car; each lane at `graph.road.v0`, each connector at `graph.road.cv`) through the fixed-time lights
  (`graph.road.sigc`, `signal`; the signal clock is the movement clock's real seconds, game minute × 2.5: the city locks its lights to it)
  and the WALK a turner waits out on the zebra it turns over (`graph.road.bands`), from rest at the pickup to rest at the drop, + `out`
  (3 s) to get out, + `pull` (1.6 s) from a stand's bay, + `pull` again where the drop lane has a kerb lane (`graph.road.kerb`) on the
  destination's side (CAB FOLLOW-UP, 2026-10-10: the cab pulls in to the kerb there to let the rider out). `trip()` with `dep` books that second's ride; `best()` (no departure) and the
  dense table book the mean over `drive.phases` (8) departures across the 44 s cycle. What it can't know — cars queued ahead, walkers in
  the road — makes the city's cab late or early: the residual (`style/city/tools/cabresidual.mjs`). `speed` (11) only picks the kerbs.
  An export with `drive` but no `sigc` books as before (the taxi clock's brisk profile); `?spread=0` keeps the flat 11 m/s.
- **subway:** walk, stairs down (15 s), wait, ride (straight tunnels at the line's own speed, its dwell at each station in between), at
  most one change at a station two lines share (20 s + the other line's wait), stairs up (15 s), walk. Fare: the highest of the lines used.
- **bus:** gone (2026-10-09, buses out: slime dropped them for the subway). A recording from before still has `bus` legs; the city draws
  such a leg out of view.
- **Off the graph** (a site in a compound, the woods, the labs): a straight walk to the nearest side, ×1.25 beyond 15 m.

## Measured transit times (2026-10-08, `style/city/tools/transit-measure.mjs` → `transit-measured.json`)
(Since the spread flip the file is `transit-measured.s0.json`: measured on today's 32 m grid, `?spread=0`. Nothing is measured at +4 yet.)
The tool runs the city's own sims offline in node — the walkers (pedsim.js) and the cars (traffic/sim.js) wired together as the page wires
them, the page's fleet mix, the shared signal clock, the traffic and the walkers populated round the cab as it drives — and keeps per taxi
ride the time against the flat 11 m/s, the pick-up, and what held the cab (`held`). (It measured the bus lines too until they went,
2026-10-09.)
```
node style/city/tools/transit-measure.mjs                       # 48 taxi rides
node style/city/tools/transit-measure.mjs --taxi 40 --shard 0/8 --part /tmp/t0.json   # taxi rides, one shard
node style/city/tools/transit-measure.mjs --merge /tmp/*.json     # the parts → world/export/transit-measured.json
node style/city/tools/export-world.mjs --measured                # bakes it — OPT-IN, inside the design envelope only (below)
```
- **Opt-in (traffic fix, 2026-10-08):** a plain `export-world.mjs` times the taxi flat and only logs what was measured. With `--measured`,
  the taxi is booked measured only when its booked slowdown is within 1.5× of 11 m/s and its booked hail within 20 s.
- **Taxi:** `modes.taxi` becomes `{ speed, t0, sig: 0, measured }`: ride s = `t0` + ride metres / `speed` (the flat 11 m/s × the measured
  slowdown, booked between its median and p90; `t0` = getting out). travel.mjs counts the signalled junctions on the ride's path for
  `sig` when it is non-zero.

## `travel.mjs`
```js
import { createTravel, GAME_MIN, MODES } from './travel.mjs';
const T = createTravel(JSON.parse(fs.readFileSync(process.env.WORLD_EXPORT, 'utf8')));
T.matrix('trailer', 'fitstreet', 'taxi')      // → { m, s, fare } from the table (named nodes only), or null
T.best('lot:-221,-75', 'plaza', 'bike')       // → { m, s, fare, plan }: any id (places, stops, stations, lots, apartments) or [x, z]
T.trip('trailer', 'docks', 'subway', { dep: 600, night: false, walkMul: 1 })
// → { mode, from, to, dep, arr, fare, metres, seconds,
//     legs: [{ kind, from, to, dep, arr, m?, line?, dir?, path?: [[x, z]…], at? }] }   (MOVEMENT.md §3)
T.nextDep(T.lines.get('tide'), 'fwd', stopIndex, gameMin)   // the timetable
```
- **Legs** are contiguous from `dep` to `arr`. Their kinds are walk, skate, bike, scooter, wait, subway, taxi and stairs (and `bus` in a
  recording from before 2026-10-09). Leg ends are node ids, or `kerb:<id>` where a road mode meets the kerb.
- **`path`** is the geometry to animate. **W3:** follow it as given. It is the route the times were measured on.
- **A walk is drawn on the walkers' graph (movement review #1, 2026-10-09).** Its booked `m` and minutes are as ever, but a stretch
  with `in` 0 isn't in the `path`: the leg carries `off: [start, end]`, the booked metres left out at each end (the city keeps a long one,
  15 m or more, out of view and walks the rest at the booked pace).
- **With `dep` given,** waits follow the timetable. Each direction leaves its first stop at `dirs[dir].offsetMin + k × headwayMin`
  (an export without the field: `fwd` at the line's `offsetMin`, `rev` half a headway later). Without `dep`, a wait is half a headway.
- **The timetable is ONE.** `dirs[dir].offsetMin` is what the city runs and what the sim books (`nextDep` here; the sim imports this file).
- **A ride's fare** (SUBWAY PLAN, 2026-10-09) is the highest `fare` of the lines it rides (a line without one: `modes.subway.fare`).
- **`opt.walkMul`** is the hightop perk (×1.5 on the walk legs). **`opt.night`** sets the taxi's night fare. The Director's rush
  multiplier and turnstile jumping are the sim's.

## Network (MOVEMENT.md §5; `style/city/transitnet.js`)
**Subway** — 13 stations, all built (the 8 of before: kiosks and open stairs; SUBWAY PLAN 2026-10-09: 5 open stair entrances at the old
bus stops). Express 16 m/s, 8 s at a station, every 6 game min, 2 cr; local 8 m/s, 10 s, every 10 game min, 1 cr (the buses' own pace):
- **TIDE** (T) `#2F5BFF`, express: LOW TIDE → MARKET AV → 1ST ST → WASHINGTON → PLEASANTVIEW · from 0, rev 3
- **NEON** (N) `#FF4FA3`, express: SUNNY ACRES → FIT ST → WASHINGTON → ST MERCY · from 3, rev 6
- **HARBOR** (H) `#FF7A1A`, local (under the old 4): LOW TIDE → MAIN ST (the Heap) → ELM ST → SUNNY ACRES → BLACKPINE · from 0, rev 5
- **UNION** (U) `#25B84C`, local (under the old 22): ROUTE 9 (Motel 9) → PLEASANTVIEW → GATEHILL → ELM ST · from 1.26, rev 1.15

Changes: WASHINGTON (TIDE / NEON), LOW TIDE (TIDE / HARBOR), SUNNY ACRES (NEON / HARBOR), PLEASANTVIEW (TIDE / UNION), ELM ST (HARBOR /
UNION). Station ids of the five: `subway-blackpine`, `subway-elm`, `subway-heap`, `subway-motel`, `subway-gatehill`.

**Bus:** none since 2026-10-09 (buses out). The 16 shelters stay, NO SVC on their boards.

**Taxi:** stands at JAY ST, UNION AVE and ST MERCY, plus a kerb hail anywhere.
