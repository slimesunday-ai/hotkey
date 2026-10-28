# SPREAD — wider streets, the same blocks

The city on a wider grid: the pitch grows 32 → 36 m (SPREAD 4), every block's interior keeps its exact size, and all the new width
goes to the streets. Pass 1 (the core, branch `spread/plus4`) landed the controls with SPREAD = 0 as the default: today's city,
byte for byte. Passes 2–4 moved the hand-placed layer, 5a merged the main line; **pass 5b turned it on: SPREAD = 4 is the default**,
every generated data file made at +4 by its own tool (below, "The data a spread reads"). `?spread=0` (node: `SPREAD=0`) is still
today's city, byte for byte, reading today's data. The sim's re-vendor follows (its `world/city.js`, export and `places.json`).
Revert points: tags `pre-spread` (city), `pre-spread-sim` (sim), `save-2026-10-08*`; bundles in the local backups (not in this repository).

## The controls (world/city.js)

| | what | SPREAD 0 | SPREAD 4 |
|---|---|---|---|
| `SPREAD` | `?spread=<m>` in a page, `SPREAD=<m>` in node, else `SPREAD_DEFAULT` (**4** since pass 5b); a pool worker gets a non-default one on its URL (`SPREAD_Q`) | 0 | 4 |
| `P0`, `P`, `HS` | today's pitch, the pitch (`P0 + SPREAD`), what each side of a street line gains (`SPREAD / 2`) | 32, 32, 0 | 32, 36, 2 |
| `X(i)`, `Z(j)`, `blockOf(v)`, `lineOf(v)` | a line's coordinate (`i · P`), the block a coordinate is in, the nearest line | | |
| `rwX / rwZ` | right-of-way: centre line to lot line | side 4, ave 6, Route 9 9 | 6, 8, 11 |
| `hwX / hwZ` | the road: centre line to kerb | side 2, ave 4, Route 9 7 | 3, 4, 7 |
| `swX / swZ` | the sidewalk: `rw − hw` | 2 | side 3, ave 4, Route 9 4 |
| `aveX / aveZ` | the CLASS. plan.js: `isAve(axis, L)` (an avenue or Route 9), `isHwy`, `rwOf / hwOf / swOf` | | |

**Never read the class off the half-width** (`hw >= 4`, `hw <= 2`, `hw === 4`, `2 * hw + 4`): one-way, signals, lanes, parking,
paint, map classes and the export's `ave` all ask `isAve` / `isHwy`. **Never assume a 2 m walk** (`hw + 2`, `c <= 2`, `+ 2.2`, "d = 2
is the curb"): ask `rw` / `sw`. On a wider walk:
- the walkers' lanes span the side's own walk and rest at `NODE × sw / 2` from the curb (engine.js `lanesOf`); the corner nodes stay
  `NODE` (1.2) in from the curbs, inside the zebras, which stay 2 m wide from the kerb;
- the clear-walkway rule (audit.js) reads the side's width (`S.w`): the face 0.2 short of the lot line, the split at its middle;
- gen.js places a sidewalk thing by metres out from the lot line: one in the curb half of today's walk (`d > 1`) keeps to the curb
  (`d + sw − 2`), one at the shopfront keeps to it, and the walkway band sits in the middle of the side's walk (`swAt`, `kerbD`).
A hand-placed thing on a sidewalk (passes 2–4) follows the same rule: kerb things to the kerb, shopfront things to the shopfront —
`remap` stretches a street band evenly, which puts a kerb thing a little off the kerb.

A spread page keys its cache and bake with `-s<m>` (main.js), so it never reads today's bake; a spread city needs its own bake
(`node style/city/tools/bake.mjs` bakes the default, `-s4`; `SPREAD=0 …` today's; one bake is kept at a time).

## Interiors, shifts, the remap

- `interior(i, j)` is today's interior (`interior0`, the P0 grid) moved by `shiftOf(i, j)`: a block by `SPREAD·i + HS`, a compound's
  blocks all by the compound's centre shift (`SPREAD·(i0 + i1 + 1) / 2`): compounds are **anchored at their centre**, their extra
  width is margin. A side with no road (the sea, the woods, inside a compound) keeps an `HS` margin.
- `remap(x, z)` — a point of **today's** world → the spread world: the block's (or compound's) shift inside an interior; inside a street
  band (within today's `rw` of a line that has a road there) stretched about the line, so the street stays continuous; at a line with
  no road the gap opens `HS` each side. `unmap` is its exact inverse (round-trip tested on a 0.4 × 0.5 m lattice over ±450 m).
- `unshift(x, z)` — a point of a block's content in the spread world → today's (its block's shift taken off). `frameOf(i, j)` — the
  block's own frame (today's corner, moved with its content): offsets from it keep their place.
- **The hand-placed layer (passes 2–4):** a world literal written for today's city goes through `remap` once (in the source, or the
  constant computed from today's value: `remap(161, -33)`); a rect's corners each through `remap`. A value in a block's own frame
  (an offset from `frameOf`, a lot-local layout) needs nothing.

## Frozen ids and addresses (permanent)

A lot's id and house number are today's, at any spread: `frozen(x0, z0)` (its corner, unshifted) keys `addLot` and `addr`; 366/366 lots
keep id and address at SPREAD 4. **Never build an id from a world coordinate** — use `l.id`, or `LOT_BY_ID.get('<x0>,<z0>')` with
today's corner (suburbs' `specById('17,176')`). Not a URL option: the sim, the export and the saves key on them.

## World-noise pins

A roll that reads a world position must read today's: sample at `unshift(x, z)` (block content) or `frozen(x0, z0)` (a lot corner), or
the block re-rolls at a spread. Pinned: neutral.js (×4), downtown/fringe.js `sideOf`, suburbs/plan.js `H` and the billboards' spacing,
trailer/plan.js (×2), and the people's look seeds (gen.js one-off scenes, yards.js, roofs.js — the audit doesn't record a seed, so
grep for `seed:` built from x / z). Left on world coordinates (they change no plan and no item): texture grain hashed on world cells,
the woods' global noise and tree grid, groundwear's vents.

## No literal 32

The pitch is `P` (plan.js / world/city.js; `P as PITCH` where a file has its own `P`). A block-range test or rect is the grid cell
(`i·P … (i+1)·P`); a placement relative to the block is its own frame (`frameOf`) or its interior.

## The equivalence test

Since the flip, today's city is the explicit one: every SPREAD 0 step below runs with `SPREAD=0` (node) or `--q=spread=0` / `?spread=0`
(the page), and the spread steps run at the default.

1. SPREAD 0 must be **identical** to `pre-spread`:
   - every kit's audit in every field but timing: `node style/city/tools/audit.mjs district <kit>` (14 kits) on a server of the
     branch and of `pre-spread` (`AUDIT_RUNS=<dir>` writes the runs elsewhere, `AUDIT_MS` lifts the 5 min limit; compare the JSON with
     `ms`, `when`, `avoidMs*` dropped);
   - `node style/city/tools/export-world.mjs` → `world/export/world.json` byte-identical;
   - `node style/city/tools/spread-plans.mjs <out>` → `--compare` with `pre-spread`'s: 63/63 lot plans identical;
   - `sim2/places.json` regenerated by the sim's `places.mjs` identical but `built`; `node style/city/tools/lenscheck.mjs` CLEAN;
     `node style/city/tools/smoke.mjs`.
2. At a spread, **block by block in each block's own frame**:
   - `SPREAD=4 node style/city/tools/spread-plans.mjs <out>` then `--compare <today> <out>`;
   - `node style/city/tools/audit.mjs district <kit> --q=spread=4`, then
     `SPREAD=4 node style/city/tools/spread-eq.mjs <today-run.json> <spread-run.json> [--list]`: items, people and signs that
     stayed (`same`; items by id, then by family + box; people by act + place: their ids are running counts), moved inside today's
     interior (`int`: must be 0 when a pass is done) or in the street band (`band`: by design). A compound is built from hand-placed
     values today, so its blocks only line up once its pass has remapped them.

## The export

`tools/export-world.mjs` no longer takes `sim2/places.json` as the law for **where** places and lots are: `placesLaw()` works them out
from the plan by `sim2/places.mjs`'s rules (keep the two in step), the export writes those positions, and the id check fails on every
stale position in places.json (at SPREAD 4 against today's file: 395 stale). Regenerate places.json with `places.mjs` at the same
spread: this repo's `sim2/places.mjs` puts its four hand-placed spots (the woods, three shacks) through `remap` and writes `sdata`'s
file (the sim's own copy takes the same change on its re-vendor). `--out <file>` writes elsewhere (transit beside it).

## The data a spread reads (pass 5b)

Every generated data file is made at one spread. `world/city.js` `sdata(file)` names the one this SPREAD reads and writes: the default
spread's under its own name, another's beside it as `<name>.s<m>.<ext>`. Since the flip the plain names are +4's and the `.s0` files are
today's (byte for byte what they were): `sim2/places.json`, `world/export/{world,transit,apartments}.json`, `style/city/simstate/{stands,
reserved,room}.json` (and `transit-measured.s0.json`: measured at 0 only, so at +4 every route is timed flat, as it was booked anyway).
The two generated modules hold every spread, keyed, and give the page its own: `simplaces.js` (`SIM_PLACES`) and `traffic/buslanes.js`
(`BUS_LANES`). The page reads through `sdata` (main.js, ui/goto, ui/tape, simstate/store, live, movement, interiors/city, peds.js, subway,
the paper map); so does every generator and node tool (`SPREAD=<m>` picks the spread, and the page-driving ones open `&spread=<m>`).

**Regenerating a spread's data, in order** (`SPREAD=<m>` for a non-default spread; the page served for the page-driving ones):
1. `node sim2/places.mjs` — the sim's places (the four hand-placed spots through `remap`; ids, names and fields never move);
   `node style/city/tools/simplaces.mjs` (every spread's places into simplaces.js).
2. `node style/city/tools/reserved.mjs`; `THREE=… node style/city/tools/apartments-seed.mjs --positions` (the registry's ids are the law at
   any spread; a spread's file is seeded from the default's ids, its doors from this build — at +4 all 985 moved by exactly their block's
   shift); `CITY_URL=… node style/city/simstate/stands.mjs`; `node style/city/tools/riderprobe.mjs --room --base …`.
3. `node style/city/tools/export-world.mjs` (the id check: positions against placesLaw, 29 / 366 / 985).
4. Buses: `node style/city/tools/bus-lanes.mjs` (it stops if a direction doesn't decode), then `node style/city/tools/bus-timetable.mjs`
   (0 bus–bus, 0 junction windows overlapping) — re-solve with `--search` and `--hold` / `--berth` what-ifs when it isn't clean, put the
   result in `transitnet.js` (`ST(today's, the spread's)`) and `traffic/buses.js` `BERTH`, and re-export.
5. The bake.

**The buses at +4** (the same streets, 12.5 % longer; `transitnet.js` ST, `buses.js` BERTH):
| | today (`?spread=0`) | +4 |
|---|---|---|
| the 4 (loop) | 1572.9 m · 242.6 s round · holds Sunny Acres 3, Blackpine 5, Grand Ave 8 · offset 5 | 1772.9 m · 259.6 s · hold MAIN ST (the Heap) 8 · offset 5 · DOCK ST berth +8 m (its kerb is the lane past Linden St) |
| the 14 | 693.6 m · 98.7 s / rev 701.1 m · offsets 6 / 5.5 | 779.6 m · 114.5 s / rev 787.1 m · hold ST MERCY 5 both ways · offsets 7.8 / 1.1 |
| the 22 (loop) | 1125.7 m · 160.7 s round · hold Motel 9 2 · offset 2 | 1266 m · 185.2 s · holds P.S. 280 5, Motel 9 4 · offset 2 |
| subway | TIDE 398.6 m, NEON 310 m | TIDE 448.8 m, NEON 352.6 m |

Checker at +4: 0 bus–bus, 0 junction windows overlapping (2 inside the 1 s margin, the 4 × the 14 on Central Ave: each pair of those
alone is clean at no offset), loops 0 against themselves; node gate 0 overlap frames.

**Bus retime (2026-10-09, +4 only; MOVEMENT.md §5):** the 8 m bus drives like the cars and the timetable is booked from that drive
(`transitnet.js` BUS_BOOK). The table above is superseded at +4: the 4 261.2 s round, holds BLACKPINE 7 + MAIN ST 2, two bus-only lefts
(Grand Ave, Main St); the 14 101.4 / 107.6 s, no holds, offsets 7.2 / 9.7, its rev drives out of MALL GATE up Birch St; the 22 217.8 s
round, hold PLEASANTVIEW 11, offset 8.3; DOCK ST's shelter on the south kerb, no berth. `?spread=0` keeps today's flat timetable.

**The flip's gates (2026-10-08, at the new default; "today" is `?spread=0` on the same build):** lenscheck CLEAN; smoke 14/14 districts,
0 issues; export id check 29/29 · 366/366 · 985 · positions OK. Buses: checker 0 bus–bus, 0 junction windows overlapping; node gate 0
overlap frames; in the page (12 riders at the design pace) drift median 0.00, |drift| p90 0.26 game min, 0 bus–bus frames, live buses =
runs in progress 1631/1631. Stage probe (seeds 1 + 2, 29 trials): removed in view 0 · 0; falls onto something 0 → 1 (seed 1, the
trailer park, where no axis is clear at either spread); head overlaps 2 → 4; inside a bystander 1 → 8 — seed 2 identical at both, so
it is the scene's draw (the crowd round the actors), not the ground. Riders (downtown rush, Pleasantview, Neon Row at night, per minute):
mover–walker 371 → 445, 63 → 89, 182 → 204; mover–obstacle 8 → 2.4, 3.2 → 0, 5.6 → 0.8 — more walkers per block at +4 (the crowd hold
below), fewer obstacles. Bench p95 per segment: unchanged within run-to-run noise, fewer draw calls (178 → 168 overview, 394 → 322 stress).
Shots: `shots/spread/`.

**The crowd hold (2026-10-08, after the flip):** +4 carries today's crowd per block, and the riders use the new width.
- Walkers: pedsim.js counts each edge's walkers on its length at SPREAD 0 (`len0`: a side less the new walk at each end, a side street's
  crossing less its wider road) — every one of the 1606 edges equals today's (Σ 26 273 m against 29 558 m of new length).
- Generated people: two spread bugs made the retired sidewalk crowd stay — castspec.js `kerbOf` read a sidewalk as 0–2 m from the curb (now
  the side's own `S.w`), and a kerb scene's people were told apart by a look seed the spread pin had moved to today's place (now read
  through `unshift`). gen.js places a one-off scene and the generator's own people with the clear path measured as on today's walk (the
  clear width + `swAt − 2`). Downtown, every urban block built (`riderprobe.mjs --people`): people on the sidewalk 86 today → 610 at +4
  before → 93; all people on the ground 798 → 1320 → 804 (+0.75 %).
- The riders' line (simstate/movement.js `MOVE.band`): on a walk wider than 2 m a skate, bike or scooter leg rides 0.3 × the walk from
  the curb (0.9 m / 1.2 m; the walkers' lane rests 1.8 / 2.4 out), as part of its drawn path (pedsim `where()`'s `cOff`), clear of the
  kerb furniture the room table holds, back on the lane at each corner; the weave and the crowd's step-aside reach further on a wider walk.
  The room table is version 2 at a spread (7.5 cm steps to 3.925 m: version 1 topped out at 2.35, under an avenue's lane) and is made
  from the audit's build. Corners of a wider walk are held a beat for a mover about to pass (`PED.cornerT`).
- Rider probe, per minute (today `?spread=0` → +4 before → +4 now): mover–walker downtown 371 → 445 → 143, residential 63 → 89 → 46,
  Neon Row 182 → 204 → 78; mover–obstacle 8 / 3.2 / 5.6 → 2.4 / 0 / 0.8 → 4.8 / 0 / 0.8 (legs' straight door segments only, none on
  a sidewalk side); walker–obstacle 0; arrivals Δ 0.000 s. What is left: riders crossing a zebra past the walkers waiting at its kerb
  (file 0 stands on the crossing's line), and riders passing walkers in the corners. `?spread=0` is unchanged (every probe identical).
- Stage probe (seeds 1 + 2, `--n 8` each, 15 trials a spread): today head overlaps 6, inside a bystander 2, falls onto something 0,
  removed in view 0; +4 now 4, 0, 0, 0. Bench p95 (`?nobake=1`, four runs each, before → after): overview 36.6 → 35.9, avenue 40.2
  → 42.4, side street 35.7 → 39.0, stress 43.9 → 44.0 — one fast run of before's (27–29 ms) is most of the gap; without it 44.0 → 42.4
  and 38.6 → 39.0; draw calls the same. smoke 14/14 · 0 issues, lenscheck CLEAN. Shots: `shots/crowd-riders/` (before = the tag
  `pre-crowd-hold`).
