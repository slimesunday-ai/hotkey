# Widening streets and sidewalks: what it costs (2026-10-05)

This is an opinion plus measurements. I changed no code. Each variant ran on a scratch mirror of the branch: symlinks everywhere except the tweaked `world/city.js` and `ground.js`, served by its own `style/serve.mjs` on port 5386. On it I ran the real `tools/audit.mjs` and regenerated `places.json` with the real `sim2/places.mjs` logic, writing to scratch. Mock frames are in `style/city/shots/widen-audit/`.

## Verdict

**No full rebuild is needed for Option A, which keeps P = 32 and moves the curbs.** The geometry is derived. One curb constant, once it really is one constant, moves the slabs, curbs, lots, buildings, lamps, signals, walkers' graph and parking with it.

The cost is somewhere else, in two places:

1. **Generation re-rolls.** The generator re-rolls every block whose interior length changes. This is the main cost, explained below.
2. **The hand-crafted layer.** It is keyed to that roll and to world coordinates.

**Option B, a larger P, effectively rebuilds the hand layer and the sim.** I don't recommend it.

## 0. A trap in the plan

`plan.js` exports `SWALK = 2`, but **nothing reads it**. The 2 m sidewalk is a literal `+ 2` / `? 2 : 0` in:

| file | literal sites |
|---|---|
| `world/city.js` | 15 (`interior`, `roadTop`, `nsAt`/`ewAt`, `addressAt`, `computeColumn`) |
| `ground.js` | 16 (inner rect, joints, crossing band, lane-paint skip, arrows) |
| `gen.js` walkBand | 4 |
| `traffic/sim.js` | 3 (zebra `BAND` / `STOP_BACK`) |
| `forest/plan.js` | 2 |

That is about 40 sites in 5 files. They need one mechanical pass to route them all through `SWALK`.

The road widths are already centralised: `hwX` / `hwZ` is one function, and everything reads it.

**`world/city.js` is the sim's plan too.** `deadnet/world/city.js` is byte-identical, and `sim2/places.mjs` imports it. Any edit to it is a sim change.

## 1. Option A: keep P = 32 and move the curbs

### What moves for free (DERIVED from `hwX` / `hwZ` / the sidewalk width)

| part | derived through |
|---|---|
| ground slabs, curbs, joints, lane paint, zebras, stop bars | `ground.js` `slab()` |
| lots, and so building footprints, frontages, facades, storefront signs, stoops, doors, shop interiors behind the glass | `gen.js` `subdivide(b.R)`, where `R = interior()` |
| corner lamps, signal poles, ONE WAY and DO NOT ENTER signs | 0.45 m in from the slab edges |
| curb furniture | `furnish()`: the slab's curb strip, sliding to a clear spot |
| the walkers' graph | `pedsim.js`: slab + `NODE` 1.2 |
| parking and traffic lanes | `parkOff = hw − 1`, `lanesOf()` |
| rule cameras (13) | |
| explicit cameras (57 in 14 kits) | absolute, but the street centrelines don't move, so they stay valid |
| the Mainland | its own polyline layout (`plots.json`), untouched by A or B |

The one non-derived bit here is the constant `ONEWAY_LANE`.

### What must be re-placed (HARD-CODED)

**Per-block overrides.** 6 of 81 `blocks/*.js` files have content: `-3_0`, `-2_0`, `-1_0`, `0_0`, `1_0` and `2_0`. Between them they hold:
- 42 generated-id references (`i_j·L3·kind·n`)
- 14 lot-index specs (`L<k>:`)
- 23 people placed at world x/z
- about 11 hand stamps at world coordinates (the moving van, the trees, the giant burger)

**The roll.** `subdivide()` draws lot widths from an RNG along the interior. Change the length and the draws change: the lot count, numbering, types, colours and names all re-roll on every generated block. This is what silently re-targets the id- and L-keyed overrides.
- Measured: `blocks/1_0.js` (`L1`) and `blocks/2_0.js` (`L6`) **throw**, because their lot is no longer a shop.

**Set pieces with world rectangles.** All of these survive A; only their edge rectangles need a check:
- `hospital/plan.js` has 22 rects. `COURT.x0 = 134` is 128 + 4 + 2, the old curb line.
- `highway/build.js` (24), `docks.js` (12), `mall/plan.js` (4), `store.js` (5).
- The jail and the forest labs are off-grid and safe.

**Trailer pads.** The pads re-flow from 54 to 48. `POOL_PAD = 47` survives, but it is now a different pad. With roads and sidewalks both widened (40 pads) the trailer kit **fails to load**.

### What the audit measured

Columns are the 8 hand-crafted downtown blocks, then the whole downtown kit (76 blocks).

| variant | items | people | refused | issues | module errors |
|---|---|---|---|---|---|
| today | 521 · 5741 | 113 · 1145 | 57 · 753 | 0 · 0 | 0 |
| sidewalk +1 m (3 m) | 481 · 5313 | **160 · 1432** | 37 · 265 | 14 · 22 | 2 |
| side roads +1 m (5 m road) | 416 | 109 | **85** | 14 | 1 |
| both | 414 | 164 | 48 | 24 | 1 + the trailer kit |

Across the other kits, sidewalk +1 m gives:
- **suburbs:** refusals 635 → 929
- **trailer:** 0 → 2 issues
- **industrial:** 0 → 3 issues
- **estates, hospital, mall, docks, highway, junkyard, jail:** clean

I did not finish the forest and sea runs.

**A stale override is worse in the live page than in the audit.** The audit skips a throwing override. The stream does not:
- `stream.js` fails block 1,0's far job and re-queues it **5,954 times in 40 s**.
- The block renders as an empty lot, and the stall starves the nearby full builds, so they show bare far-tier massing.

This happens today for any override that goes stale, not only after widening. It is worth a one-line guard in `stream.js`.

**The surprise: a wider sidewalk does not read as more space by itself.** The generator fills the room it gains. Downtown gets +25% people, and refusals fall from 753 to 265. "More space" needs the life and clutter budgets held at the same time.

Widening the roads makes things tighter: lots lose 2 m per block, so refusals go up.

### Do the sim's coordinates change?

Measured by regenerating `places.json`:

| variant | places (29) | lots (366) |
|---|---|---|
| sidewalk +1 m | **0 move** | **every lot re-keys**; 70 ids survive, 0 doors stay where they were; trailer 54 → 48 |
| side roads 5 m | 0 move | 3 ids survive |
| side roads 6 m | hospital, trailer and heap move 1 m | |
| B, P = 36 | 25 move | 0 lot ids survive |
| B, P = 40 | 25 move | 366 → 400 lots |

Lot ids are the lot's corner (`lot:x0,z0`), so any interior change re-keys them. Saved runs and ownership would need an old → new id map.

**Downtown and Neon Row have no sim lots.** Widening only there leaves `places.json` byte-identical.

## 2. Option B: a larger P (36 or 40)

- Everything in section 1's hard-coded list must be re-placed by hand.
- 25 of 29 sim places move, and every lot re-keys. Replays and saved runs no longer line up.
- The explicit cameras (57) and the hand coordinates in about 15 kits all need re-placing: hospital, mall, highway, docks, trailer, store, forest, sea.
- The bake (372 MB) is regenerated. It is hash-keyed, so that part happens automatically.
- The lot grammar (4–7 m frontages, ≤ 10 m deep) was tuned for 20–24 m interiors and would want re-tuning.

**Effort: about 5–8 agent passes plus a sim-side migration, and the risk is high.** It buys space everywhere, including where nobody asked for it.

## 3. Option C: more space without moving the curbs

Measured on the 8 blocks: 128 items stand on 1,584 m² of sidewalk, about 10% footprint. On top of that there are 113 people and 40 parked cars. The top kinds are:

| kind | count |
|---|---|
| planter | 20 |
| street tree | 20 |
| sandwich board | 19 |
| trash can | 12 |
| bags | 10 |
| crate | 9 |
| hydrant | 7 |
| news box | 7 |

Cheap levers, all in config:
- Per-kit clutter and life budgets: `grammar.life`, the sidewalk-clutter rolls in `gen.js`.
- Halve the planters, sandwich boards and crates. That is about 48 of the 128 items.
- Lower `PARK[district]` (`vehicles/index.js`) on the side streets you want open.
- Lower `CROWD` / the kit's `peds.density`.
- Pull fruit stands and stoops in, from 0.7 m to 0.5 m.

**Effort: 1 pass, low risk.** Removing generated items renumbers later ids of the same kind, so check the 42 override ids.

## 4. Effort and recommendation

| option | agent passes | risk |
|---|---|---|
| **C** | 1 | low |
| **A, downtown and Neon Row only** | 2 | medium-low |
| A, island-wide | +1 pass, plus a coordinated sim lot re-key | |
| B | 5–8 | high: the sim world changes |

What the two A passes contain:
- **Pass 1:**
  - Make `SWALK` real, per district.
  - **Pin the roll**: subdivide on the old length, then scale, so lot count and ids hold.
  - Hold the budgets.
- **Pass 2:**
  - Re-check the 6 override files.
  - Fix the hospital edge rects, `ONEWAY_LANE` and the zebra band.
  - Re-shoot and re-bake.

**My recommendation is C now, then A for downtown and Neon Row, with the roll pinned.** That gives the visible "breathing room" where the crowding is, keeps every sim coordinate, and avoids a rebuild. Don't do B.

## Frames

`shots/widen-audit/`: today on the left, sidewalk +1 m on the right. The tweak lived only in the scratch mirror.
- `v2-sidewalk-plus1.jpg`: street level.
- `v4-sidewalk-plus1.jpg`: top-down.

To get a clean mock, the two throwing lot specs were guarded in the mirror. Without the guard, blocks 1,0 and 2,0 render empty.

The top-down frame shows both effects:
- the extra metre is visible but modest at this scale;
- blocks 1,0 and 2,0 **re-rolled** (TATTOO and the purple tower are gone). That is the roll problem, in one picture.
