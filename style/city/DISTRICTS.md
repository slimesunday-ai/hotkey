# Districts: the handover for section agents (pass 2)

Every district of the island is built by **one kit**, `districts/<name>.js`, owned by one section agent. The kit is mostly data. The shared engine does the placement and guarantees clearance, so a kit cannot put props inside walls, leave text off its board, or float things. This file covers the API, the rules and the loop, then each district's sim role, places and hero candidates.

Read first: `STYLE.md` (the look), `REFERENCE.md` + `board-reference.jpg` (the bar) and `LOCATIONS.md` (section 1, which is already built). Block `[i, j]` covers x 32i…32i+32 and z 32j…32j+32, and −z is north.

## 1. Ownership

| who | owns | never touches |
|---|---|---|
| **a section agent** | its `districts/<name>.js`, the `heroes/<name>-*.js` files it creates, any helper modules its kit imports (for example `districts/<name>/props.js`), the `blocks/<i>_<j>.js` of its blocks, its own lines in `manifest.js` | everything else |
| **systems agent** | the core: `gen.js`, `engine.js`, `grammar.js`, `districts/api.js`, `modules.js`, `jobs.js`, `stream.js`, `main.js`, `peds.js`, `transit.js`, `neutral.js`, `audit.js`, `vox.js`, `kit.js`, `props.js`, `simstate/`, `tools/`, `manifest.js` (its structure) | a section's kit, heroes and blocks |
| **ASSETS agent** | `simassets/`: the sim-state pieces (FOR RENT signs, piles, locks, doors, safes, doorman lobby, scars, window cards, hotspots, patrol car) | anything outside `simassets/` |
| section 1 location agents | as listed in `LOCATIONS.md` | |

If you need a core change, don't make it. Write the request in your PASS notes. Props that only your district uses live in your own modules.

## 2. The kit API: a worked example

A generator kit changes the shared grammar and lets `gen.js` build the blocks, the way downtown does. A custom kit writes its own `build(ctx)` with the engine helpers, the way `districts/suburbs.js` does. Both get the same guarantees.

```js
// districts/strip.js · Neon Row · owner: the Neon Row agent
import { defineKit } from './api.js';
import { BASE, PALETTE, LEXICON } from '../grammar.js';

export default defineKit({
  district: 'strip', name: 'Neon Row', owner: 'the Neon Row agent (batch 3)', status: 'built',
  role: 'The night street: demand 2 by day, 10 at night …',          // DISTRICTS.md §6 has the facts
  built: [[-2, 1], [-1, 1]],               // blocks at full detail; the rest of the district shows its far tier
  adopt: [],                               // blocks of OTHER districts this kit builds (explicit, rare)
  grammar: { ...BASE,
    storeys: (type, tower) => type === 'walkup' ? [2, 4] : BASE.storeys(type, tower),   // [min, max] per type
    signKinds: [['neon', 5], ['blade', 3], ['band', 1]],
    pieces: { ...BASE.pieces, order: ['neon', 'billboard', 'party', 'pool'] },
    life: [0, 0],                          // new districts: no static people, the walkers come from peds.js
    walkway: .6,                           // the walkers' band (gen.js walkBand): its width in metres (0: none)
    walkband: { from: 1.2, corners: .8 } },   // where it lies: 'middle' (default), or on the curb side from 1.2 m out, plus the whole sidewalk round corner furniture
  palette: { ...PALETTE, neutral: { ...PALETTE.neutral, share: .32 } },   // 30–40 %: the neutral mix
  lexicon: { ...LEXICON, shops: ['SING SING KARAOKE', 'PAWN KING', 'CHECKS CASHED'] },   // invented names only; leave it out for the shared names (§8)
  heroes: [{ id: 'night-market', block: [-1, 1], module: 'heroes/strip-night-market.js', fn: 'nightMarket' }],
  hooks: {},                               // sim-state anchors come from the build (§4)
  transit: [{ id: 'bus-washington', kind: 'bus', name: 'WASHINGTON', route: '9', x: -16, z: 34.62, rot: 2 }],   // on the curb, facing the road (§5)
  safehouses: [],
  peds: { density: 1 },                    // × the sim's street demand for this district (§3)
  cameras: {                               // the fixed shot list (§7): { pos, tgt, fov, sh } or a street rule
    overhead: { pos: [-20, 120, 110], tgt: [-32, 0, 48], fov: 44 },
    street: [{ name: 'washington', rule: 'street', block: [-1, 1], side: '-z' }, { name: 'jay', rule: 'street', block: [-1, 1], side: '-x' }],
    landmark: { name: 'market', pos: [-20, 1.6, 40], tgt: [-26, 2, 46], fov: 46 },
    night: { name: 'washington-night', rule: 'street', block: [-1, 1], side: '-z' },
  },
});
```

Then add one line to `manifest.js` (`KITS`, and `HEROES` for each hero module). The loader reads the manifest as text, so a half-edited line cannot break anyone else.

**Grammar (`grammar.js` BASE):**
- `lots`, `typeOf`, `storeys`, `groundOf`, `twoShops`
- `windows`, `cornices`, `signKinds`, `trimFor`
- `fire` / `fireBack`, `roofPeople`, `pieces` (set pieces), `oneOffs`
- `life`, `windowPeople` (window leaners, about one building in three; cleanup pass: they generate now), `fireSitter`, `walkway`, `walkband`

If you override a decision function, it gets the block's seeded rng, so builds stay deterministic.

**Custom builds (`engine.js`):** `build(ctx)` runs once per block. Each helper asks the registry first, then slides the thing, lifts it or refuses it (logged).
- `ctx.building(x0, z0, x1, z1, { h, wall, trim, faces, roof, parapet })` → `{ V, B, F(side), top }`. Draw on it with `kit.js` (`frame.box`, `win`, …).
- `ctx.mass(V, rect, { top, roofY })`: a custom-shaped building (pitched roofs, kiosks). Its roof counts as a surface people can stand on.
- `ctx.volume(…, { walk })`: fences, yards and decks. A walk volume is a surface that props and people are lifted onto.
- `ctx.put(prop, x, z, { rot, slide: [ax, az], reach })`: placed where it is clear and supported, else skipped.
- `ctx.sign(frame, text, a, ytop, { board, fg })`: lettering on a board sized to fit it.
- `ctx.simLots`, `ctx.lot(l)` (frame and door by the sim's own rule), `ctx.rng(k)`, `ctx.R`, `ctx.slab`.
- `far(ctx)`: optional 0.5-cube far tier with `ctx.box(x0, y0, z0, x1, y1, z1, colour)`. A generator kit gets the spec-pass far tier for free (`far.js`: it keeps the neighbour rule, each window style and cornice has its own pattern).
- **A facade part that stands on the sidewalk keeps the walkers' clear path** (§3) like any prop: ask before you draw it, `REG.why(frame.world(a0, y0, d0, a1, y1, d1), { ignore: ['facade', 'plinth'], items: false })`, and slide it along the frontage or leave it out (the way `gen.js` does for bodega fruit stands and lobby canopy posts). A part drawn past its volume's edge is cut there, and so is its keep.

**Strict mode is on while a kit's own build runs.** Any stamp that would land in a mass, a facade part, a doorway or another item, or would stand on nothing, is refused and logged (`strict: …`). Any letter without a board gets one. Hero modules (`fn(bank, b, A)`) run without strict mode but are still audited. A new hero should build through `blockCtx(bank, b, A, kit)` from `engine.js` so it gets the same guards.

**Heroes and overrides:**
- One module per hero, listed in `manifest.js`.
- The hero's block is built by its function; everything else is built by the kit.
- **Heroes are lazy (cleanup pass).** A hero block streams like any block: its far tier first, its full build only when the camera comes near. The default far tier is the hero's own build downsampled to 0.5 cubes (a far-only build: its silhouette and colours exactly, at about a fifth of the cost). A slot may name its own: `far: 'kit'` (the kit's `far(ctx)` draws it), `far: '<export>'` (a function of the hero module, `(ctx) → void`, with the `farCtx` helpers) or a function. An empty far tier is reported as an error.
- `blocks/<i>_<j>.js` overrides (remove, move or replace by id, tune lots, add one-offs) work on any generated block (format: `blocks/index.js`).

## 3. Isolation, placeholders, pedestrians

- **Every kit, hero and override loads on its own** (`modules.js`). A file that fails to load or throws while building shows a **magenta placeholder with an error sign** on its blocks. The page lists the failure in red (top left) and the rest of the island loads.
- A district with no kit shows **FALLBACK**: standard far-tier massing. `?stress=1` builds it at full detail.
- **People: new districts place no static people** (`life: [0, 0]`). Walkers come from `peds.js`, walked by `pedsim.js` (cleanup pass):
  - **one-way:** every block's sidewalk ring runs clockwise and every intersection's four crossings anticlockwise. A walker is about 1 m wide with its big head, so two can't pass on a 2 m sidewalk: nobody meets anyone head-on, and nobody overtakes.
  - **lanes:** each block's build carves a lane down every sidewalk (`engine.js lanesOf`, a shortest path 0.1 m at a time, clear of everything a walker could touch, 1.2 m out at the corner nodes). Where the sidewalk is full they step into the road margin, never through a parked car. A dealing crew's corner is a **detour corner**: its walkers step off the curb 2 m before it and go round through the road, and its crossings close.
  - **following and corners:** each walker follows the one ahead (also the one that just turned off at the corner ahead), never closer than 1.1 m. A corner is held by the stream that reached it first; the others wait a beat outside it, and a stream that has waited 2.2 s goes next. Sim agents (`addAgent`) use the same graph and go first.
  - **dogs:** 6 % of walkers walk a dog on the lane ahead of them; dogs also sit by some stoops and in about one yard in three (`props.js dog`, 4 breeds × 5 coats).
  - **density:** walkers per 100 m of sidewalk = 3.5 + 2.1 × the sim's street demand (`DEMAND` [day, night], or `CROWD` in `pedsim.js`) × the kit's `peds.density`, ×2 in a Director rush. Downtown is 13, Neon Row 7.7 by day and 24.5 at night.
  - Hand-placed people are for heroes and one-off scenes only.
- **The clear walkway rule (cleanup pass, `audit.js WALK`).** Every street sidewalk keeps a continuous clear path at least 0.9 m wide at walker height. Street furniture lives in the kerb strip (up to 0.85 m from the curb), shop things and standing people against the frontage. A placement that would leave a narrower path, counting the lane's bend (two things on opposite sides need 0.4 m more room per metre they are closer than 0.8 m along the sidewalk), is refused: the prop slides or is left out (logged). **This holds for hand-placed props and people too:** a person on the walkers' path steps along the sidewalk or across it (up to 1.6 m), else is left out, logged in the audit's skipped list as `… moved …` or `… (hand-placed) left out`. The corner squares keep the walkers' turning and crossing lines (1.2 m in from both curbs) open. Pigeons are the one exception: walkers go through a flock.
- **The walk check.** `tools/audit.mjs district <name>` also runs 60 s of walkers (and a few agents) over the district's blocks and counts `walker-overlap` (two bodies, or a dog and a body, closer than their size) and `walker-furniture` (a walker inside anything), plus the lanes' `walker-blocked` pinches. All must be 0, like every other check.
- **Roof figures:** people may stand on any roof (`roofY`) and on walk surfaces. A hand-placed person claims its spot first, and a generated one steps aside.
- **People ids.** Generated people are `i_j·char·n` in cast order; hand-placed ones (`people.add`) are `i_j·char·h<k>` in the order the file adds them. A generator change that makes one person more or fewer shifts the generated numbers, so check your `people.move` / `remove` ids after a core pass (the systems agent re-maps section 1's).

## 4. Sim-state hooks: what a kit must hand back

The sim-state layer (`simstate/`) draws the game's state on anchors that each block's build returns. Pieces come from `simassets/`, with placeholder boxes if that module fails. **Coordinates are world metres, and every sim place stays where the sim puts it** (`simplaces.js` is generated from sim2's `places.json`).

- **Parcels** (houses, trailer pads):
  - `ctx.anchor.lot('lot:<x0>,<z0>', { tier, rot, face, door: [x, y, z], sign: [x, z], yard: [x, z], wall: [cx, cy, cz, w, h], windows: [[x, y, z, w, h], …], roof, house })`
  - The id is the sim's lot id. The layer draws: lights per window; zzz / curtain cards; FOR RENT (lawn sign); security (lock on the door, steel door, safe, camera for the alarm, gate for the dog); scars (burned, boarded, foreclosed, crime scene, memorial).
- **Stacked units** (walk-ups, towers):
  - `ctx.anchor.building({ id: 'bld:…', kind: 'walkup' | 'tower', tier: 'apartment' | 'penthouse', rot, face, entrance: { door, stoop, width }, units: [{ id, floor, windows }], top })`
  - Lights are per unit window. Security sits at the building entrance: a buzzer and steel street door for walk-ups, the **doorman lobby** for towers. The safe and camera go by the unit's window. FOR RENT is a card in the unit's window, or a board in the lobby.
  - The unit's door and coordinates are the building entrance.
  - The generator already anchors every walk-up, brownstone, bodega and loft above the shop, with ids `apt:<i_j>·L<k>·<floor>`.
- **Supply sites:** piles are drawn at the sim's site coordinates, sized by the bank (0–12, spills to 32).
  - The heaps stand at x ± 2.7 m for a two-yield site, and a spill adds one at (+4.6, +2.2), so keep about 6.5 m around the point clear.
  - Generator kits get an open yard there automatically (`gen.js` siteYards). A custom kit must leave that ground free.
- **Corners:** the hotspot sits inside the dealing corner zone, and the zone is kept clear by the engine. **Patrol cars** drive the plan's roads.
- **The home ladder (tier names are data):** trailer pad (Sunny Acres, 54, the spawn) → **apartment** in a walk-up (new; city walk-ups) → house (Pleasantview, 280) → **penthouse** (Gatehill towers, 32).
  - The sim still says `estate` and has no apartment tier. The adapter maps names, so never hard-code them in geometry.
  - Apartment ids are stable map ids. When the sim adds the tier, export them the way `tools/reserved.mjs` exports transit.
- **Turf visuals are deferred** (slime, 2026-09-26): no crew colours, tags, flags, rooftop cues, territory overlay or "Locals" markings. The adapter carries the district-holder field through, but nothing draws it. Lot scars never include crew tags.

## 5. Transit and safehouse slots

The sim will add buses, a subway and safehouses later, and has taxis now (`TIME.taxi`). Declare the places in the kit:
- `transit: [{ id, kind: 'subway' | 'bus' | 'taxi', name, lines | route, x, z, face | rot }]`
- `safehouses: [{ id, name, x, z, note }]`

What the engine builds:
- **subway:** a station house on the mid-row lot under (x, z). A green kiosk, SUBWAY band, line bullets, a stairwell and globe lamps.
- **bus:** a shelter on a curb strip reserved before anything else is placed. It may slide up to 5 m to clear an awning.
- **taxi:** a stand sign on a reserved curb strip.
- **safehouses:** spots only.

`node style/city/tools/reserved.mjs` writes every declaration to `simstate/reserved.json` for the sim.

Downtown has two subway entrances, 1ST ST (A C) at (51.5, −39.5) and WASHINGTON (9) at (44.5, 24.5), plus the CENTRAL AVE bus stop (route 9) at (−50.1, −4.4), in the one gap in that curb's canopies and the Ivy St walk-up safehouse at (−56, −22). Put each district's stops where its sim roles are: the market, the site gate, the hospital door, the motel.

## 6. The districts for the next batches

Demand is sales per corner-hour [day, night] (rules `DEMAND`). A rush doubles it for 3 hours. Places are sim coordinates. Hero candidates are candidates, not decisions.

| district (kit) | blocks / extent | sim role | places (x, z) | hero candidates |
|---|---|---|---|---|
| **Neon Row** (`strip`) | (−2..−1, 1) x −64…0 z 32…64 · (3, 1) x 96…128 z 32…64 · (−5, −2) x −160…−128 z −64…−32 | The night street: demand **2 / 10**, the best night corners on the island | corners Jay & Washington (−32, 32), Grand & 1st (−128, −32), Maple & Washington (96, 32) | night market on Jay & Washington; a club with a rope line; arcade; pawn / cash-for-gold; karaoke |
| **Sunny Acres** (`trailer`) | compound (−8..−6, −3..−1) x −256…−160 z −96…−32 | Spawn: 54 trailer pads (rent 2/day, never bought), a swap meet (`MARKET`), demand 3 / 4.5 | hangout / swap meet (−208, −49) · corner Birch & 2nd (−256, −64) · pads from `LOTS` (kind `trailer`) | swap-meet tables and tarps; park office trailer with the letter sign; above-ground pool; laundromat |
| **Millennium Mall** (`mall`) | compound (−8..−6, 0..2) x −256…−160 z 0…96 | Dead mall ruins, a dig site (salts, cloth) | site (−208, 49) | collapsed atrium; pylon sign with dead letters; escalators to nowhere; food-court ruin |
| **Low Tide Docks** (`docks`) | (0..4, −8) x 0…160 z −256…−224 | Dig site (goo, cloth); the **dock shift** (`WORK`: the survival floor, paid while broke); demand 1.5 / 4.5 | site (80, −240) · corner Linden & Harbor Rd (64, −256) | gantry crane and container stacks; shift office with the time clock; fish market |
| **The Yards** (`industrial`) | (−2..6, −8..−5) minus docks and the Heap: x −64…224 z −256…−128 | Industry and warehouses between the docks and downtown; demand 2 / 3 | corner Maple & Foundry (96, −192) | foundry with stacks; rail spur; chop shop; the smith's workshop |
| **The Heap** (`junkyard`) | compound (−2..−1, −7..−6) x −64…0 z −224…−160 | Dig site (scrap), the **FENCE** (buys anything at a bad price), a swap meet | site / fence / market (−33, −191) | scrap mountain with the crusher crane; the fence's booth; market stalls |
| **Pleasantview** (`suburbs`, stub built) | (−5..6, 3..8) x −160…224 z 96…288 | Homes: 280 houses (price 45, rent 5/day), stashes, locks and safes, burglary of dark houses; demand 1.5 / 4 | park (−16, 176) · corners Kent & Pine (32, 192), Jay & Pine (−32, 192) | park gazebo; a corner store at Kent & Pine; a cul-de-sac block party; a school |
| **Gatehill** (`estates`) → a **luxury tower district** | (−9..−6, 4..7) x −288…−160 z 128…256 | 32 **penthouses** (sim: `estate`, price 150, rent 12/day) on top floors; the door is the tower **lobby with a doorman** | 32 sim lots, 2 per block, doors at x −272…−176, z 133…253 | Recommended: **one tower per block with two lobbies** on its north and south faces, at the two sim door points, so every sim coordinate stays put. Rooftop pools, terraces and a helipad as the overhead set pieces |
| **St. Mercy** (`hospital`) | compound (4..5, −2..−1) x 128…192 z −64…0 | Where the hurt go (bill 15, 6 hours) | hospital (161, −33) | ER bay with ambulances; rooftop helipad; neon cross |
| **Route 9 + Motel 9** (`highway`) | gas (7, 4) x 224…256 z 128…160 · motel (7, 5) z 160…192 · Route 9 on x = 224 | The motel (a bed for 5 a night) and the highway corner; demand 1.5 / 4.5 | motel (240, 176) · corner Route 9 & Oak (224, 160) | Motel 9's big neon 9; gas canopy; diner |
| **Blackpine Woods + labs** (`forest`) | everything not urban | Dig site (leaf); **cook labs** (cooking heat +1 at a lab against +4 at home) | woods (−330, 60) · shacks north (330, −110), west (−400, −150), south (−120, 390) | the three shacks (RV, cabin, tin lab); ranger tower; the leaf clearing |
| **Iron Island + the Long Bridge** (`jail`, `bridge`) | jail (7..8, −12..−10) x 224…288 z −384…−288 · Route 9 north over the bay to the island | Jail (240 min + 30 per unit, max 16 h, bail 25) | jail (256, −338) | walls, towers and the yard; the bridge checkpoint; a lighthouse |

Downtown (`downtown`, Glasswall) is section 1 (24 blocks, built). Its other 52 fringe blocks stay far-tier until a downtown section agent adds them to `built`. Glasswall Plaza, the Hall of Justice, Precinct 9, the 24/7 Store, Fit Street and the dealing corners at Kent & 1st, Jay & 1st and Kent & Washington are there (`LOCATIONS.md`). Jay & Washington is on its south edge, but the sim counts it as Neon Row's.

## 7. The loop, and efficiency rules

1. **Build a block and audit it in seconds:** `node style/city/tools/audit.mjs block <i>,<j> [--vs <label>]`, or all of a kit's blocks with `district <name>`. It prints every issue, refused placement, walker pinch and module error. A pass may not add issues.
2. **Look:** `?view=<district>:overhead` (or `street-1`, `street-2`, `landmark`, `night`) in the page, `?audit=1` for red boxes, and `?cam=x,y,z&look=x,y,z&fov=50&shot=1` for a close-up. **`shot=1` is required in `shoot.sh` URLs, or the still comes out blank.**
3. **Deliver the fixed shot list:** `node style/city/tools/shots.mjs <district>` writes five shots to `shots/<district>/`. Look at each with the Read tool and compare it with `board-reference.jpg`. Take extra close-ups only for a specific problem: no tours.
4. **Performance:** street views stay at 300 draw calls or fewer, and the first view appears in about 2 s or less cold and 1 s cached. Check with `?bench=1` (it also times the walkers' step), `node style/city/tools/loadtime.mjs [view …]` (first view per view, cold and cached) or `node style/city/tools/probe.mjs "<url>"`. Voxel grain rules are in STYLE §1 and §9.
5. **The gate before any batch hands back: `node style/city/tools/smoke.mjs`** (a few minutes). It imports every kit, hero and override in node (a browser-only import fails here, as it would in the build workers), runs a fast audit with a short walk check for every district (0 issues everywhere, no failed modules, no placeholders) and shoots one overhead per district to `shots/smoke/`. Look at every overhead.

**Efficiency rules (every agent):**
- **Every background wait or poll loop must have a timeout** (for example, give up after 10 minutes). macOS has no `timeout`, so use `perl -e 'alarm shift; exec @ARGV' 600 <command>`.
- **An agent must stop all its own background tasks before handing back.**
- Don't run the sim. Read `sim2/` read-only, for shapes and numbers only.
- Edit only your own files (§1). Never write in `simassets/`.
- Audit per block, not the whole section, while iterating. Run the full `audit.mjs run` once at the end.
- The block cache (IndexedDB, keyed by source hash) makes reloads cheap. Use `&nocache=1` only for cold numbers.
- Hand back a short PASS note: what changed, the audit and bench numbers, and requests for the systems agent.

## 8. Signage (pass 3)
- **Billboards, wall ads, ghost signs, murals, paste-ups, bus-shelter ads, rooftop neon words and throw-ups come from the shared signage system** (`signage/`, STYLE.md §12). A generator kit gets them through `gen.js`. A custom kit gets them by calling the same helpers: `mural`, `paintedAd` and `ghostSign` in `facade.js`, and `buildSetPiece` in `setpieces.js`.
  - They are allocated city-wide, so nothing repeats within about 3 blocks.
  - Each district draws its own flavour first.
  - The shared system gives each default-lexicon shop a unique name per block.
- **A kit writes only its district-specific hero signs:** its landmark's lettering (hero modules, `ctx.sign`) and names in its own `lexicon`, which are painted as written. Use invented names, and keep the internet puns to a wink.
- **To change a district's flavour or add vocabulary, write a request in your PASS notes.** Don't edit `signage/`. The flavour map is `FLAVOUR` in `signage/lexicon.js`.
- **The audit's `sign-repeat` check covers kits too:** the same words within 96 m, or a kit's own name twice in one block. Regulatory plates are exempt.

