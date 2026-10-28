# interiors/city: open any home

Click or tap a home (its facade, roof or door). The camera frames it, the roof and front wall are cut away, and you look in.

## How it works

- **`assign.js`:** `layoutFor(id, tier)` picks one of the tier's presets by a hash of the id. The layout changes only when the tier does.
- **`index.js`** loads on the first click or with `?home=`. It:
  - reads the homes from `api.ANCHORS` (each with its fitted volume; a Gatehill tower's top is split between its N and S penthouses), and picks one by what the click actually hits: a 1×1 depth-tested draw of the scene gives the point, and the home whose volume holds it opens;
  - reads the sim state: the page's sim layer, else the demo; under `?sim=live`, the page's own feed (no fetch of its own);
  - sets the cut, flies the camera and shows the overlay.
- **Controls:** Esc, ×, or clicking away closes the home. `‹ ›` or `[ ]` step to the neighbours of the same tier.
- **`room.js`** is worker-safe. It builds the room in about 15 ms: the shell, the layout, the slots, security, scars and a sleeper. The last 3 rooms are cached.
- **`fill.js`** fills the slots by tier and wealth.
- **The cut:** `gpu.js CUT` holds three boxes that the tier materials discard. Closed, it's one uniform branch.

## Links

`?home=lot:-48,145` or `?home=apt:-2_-1·L3·2` opens that home. Add `&shot=1` for a still, `&tod=night` for night, or `&overlay=0` to hide the overlay.

## The home builder (v1, 2026-10-06)

`builder.js` loads with the first open, never before; nothing runs while no home is open.

- **Owner or visitor.** The owner is whoever the live sim's owner view names (`?sim=live&simurl=<…/state?view=owner&handle=…&token=…>`: `me.home`, passed on by `simstate/feed.js`). Without it, the dev toggle `?owner=<lot id>` makes that home yours. Every other home is a visit.
- **Edit home** (the owner's overlay) redraws the room piece by piece over its shell, in the same cutaway:
  - Click a piece to pick it up, then click a lit spot to put it down. Press, drag and release works too, and so do taps.
  - `R` turns it (90° steps; `rot: 45` pieces too, since room.js and the check build quarter turns only). `Delete` sends it to the inventory. `Ctrl/⌘+Z` undoes, `⇧` or `Ctrl+Y` redoes, `Esc` drops what you hold, then leaves.
  - Lit spots sit on the piece's own layer: floor, wall, a surface's top, or the ceiling, on the 0.25 m grid. Gold marks the slots a gear, collectible or trophy piece fits.
  - The live test is the homes check itself (`home/rules.js`) run on the whole layout for every candidate. An invalid spot never lights, and the piece never goes there.
  - The door, windows and radiator are part of the building. A piece the check needs (the last bed, a seat, the kitchen, a dressing minimum) can move but not leave.
- **Inventory** (PLACEHOLDER): the tier's catalogue plus the slots' demos, one of each. Cards show rarity and kind.
- **Clear room** (bar, next to To inventory) moves every placed piece, and every slot's piece, into the inventory in one step and leaves the shell. The kitchen and the bath stay (toilet, sink, tub, counter, stove, fridge), and so do the building's own pieces (door, windows, radiator) and any piece that holds a slot (the trophy shelf's bookshelf). **all**, beside it, clears the kitchen and bath too. There's no confirm: one undo brings the room back. A cleared room fails the tier's minimums (no bed, no seat), which is allowed; nothing in it is misplaced. Once a room is short of something, the check no longer stops more of it going to the inventory (counts are ignored when comparing before and after).
- **Save:** every change saves to localStorage per home id (`saved.js`). An unchanged home stores nothing, so the default stays the preset. Export and Import read and write JSON in the assembly format. `saved.js REMOTE` is the hook for a sim or server save.
- **Visit:** read-only. Stash pieces and safes show a LOCKED badge and stay shut. Trophies and wardrobe pieces get gold showcase brackets. The overlay shows the flex: the crib value (the collectibles' `buff.crib`) and the rarest pieces.

## Builder hooks

- `buildRoom(A, S)` rebuilds the room from an edited layout.
- `layoutFor` gives the default layout.
- Replace `fillsFor` with real inventories.
- `api.homes.open(id)` and `.close()` drive the view.

## Mainland interiors (2026-10-06)

A Mainland house has its own floor plan per house-kit style: `home/assemblies/mainland-<style>.json` for springfield, trophy, cape, porch, ranch, gambrel, slab and butterfly. Each is sized to its style's footprint in `mainland/houses.js` STYLE and `modern.js`, from the porch's 10 × 8 m to the springfield's 17.5 × 7 m with its garage. Tier `mainland` in `home/rules.js`:
- pieces from the house and penthouse catalogues;
- 3–6 slots (a display wall, the trophy shelf, the TV wall, the garage or den corner, the stash);
- richer dressing (3 rugs, 3 art, 9 lived-in);
- never vacant.

Rooms are strips from the back wall forward, divided by partition walls (`room.built` kind `wall`). The front is left open as the hall, as in a dollhouse. Every plan has a bath. A garage is a concrete zone with a car bay (`built` kind `car`), where the house's own car parks.

**`openMainlandInterior(opts)` → `Promise<handle>`** (`city/mainland.js`)

| opt | |
|---|---|
| `plotId` | required. The save key is `mainland:<plotId>` (`saved.js`, localStorage `aicity.home.v1.mainland:<plotId>`). |
| `houseSpec` | the lot spec as `mainland/main.js` builds it: `{ style, wall, car: { id, v }, seed, address? }`. `style` picks the plan, `wall` tints the side wall and partitions, `car` parks in the garage. |
| `owner` | `true` = the viewer owns it (EDIT HOME); `false` = a read-only visit; or `{ handle, you }`. |
| `container` | where the view mounts (default `document.body`). It covers the viewport. |
| `night`, `title`, `wealth` (0–1, how rich the slot fills are), `sec` (`['safe', 'dog', …]`), `onOpen`, `onClose` | optional |

The handle has `close()`, `edit()`, `mode` (`'visit'` / `'edit'`), `layout()` (the current layout JSON), `key`, `view` (`{ scene, camera, renderer, controls, root }`) and `builder` (the editor's debug API while editing).

**Why an overlay.** The Mainland bakes every house into merged banks with plain materials (no `gpu.js` CUT), so one house can't be cut away in place. The interior gets its own canvas, scene, camera and orbit controls, layered over the page. The same `builder.js` runs inside it: edit mode, CLEAR ROOM, the inventory, undo, save and export. Visits show the LOCKED badges and showcase brackets. Esc or × leaves (Esc while editing leaves edit mode first).

Wiring the plot builder's hook:

```js
// mainland/main.js (or the plot builder): the "go inside" button calls enterHouse(plotId, houseSpec)
import { openMainlandInterior } from '../interiors/city/mainland.js';
let inside = null;
async function enterHouse(plotId, houseSpec) {
  inside?.close();
  inside = await openMainlandInterior({
    plotId, houseSpec,                                   // houseSpec: { style, wall, car, seed, address } (lotJobs[k].spec + the plot's address)
    owner: { handle: plot.owner, you: plot.owner === me },
    onOpen: () => renderer.setAnimationLoop(null),        // pause the Mainland while inside
    onClose: () => { renderer.setAnimationLoop(() => { ctl?.update(); renderer.render(scene, camera); }); inside = null; },
  });
}
```

**Test page:** `interiors/mainland-test.html?style=<style>&owner=1|0&plot=<id>` (`&edit=1` opens straight into edit mode, `&fresh=1` forgets the plot's save, `&tod=night`).

## Home life (2026-10-06)

The house's agent lives in it. When a Mainland interior opens, `life.js` puts one resident in the house: a stable cast look per plot (`cast.js rollLook`, seeded by the plot id; pass `look` for the owner's minted character). It goes about its day between the furniture.

- **Spots** come from the layout itself, by catalogue category, id and tags, so a preset and an owner-edited layout both work:
  - bed → sleep; stove, cook rig or hot plate → cook, then eat at the dining set (or a bar stool); fridge → a snack; toilet → then the sink;
  - a seat facing a TV → TV, or a game if the house has a console; any other seat → chill on the phone;
  - arcade cab, music, trophies, collectibles and collectible art, the stash slot and safes, the dresser, wardrobe and mirror, the bookshelf, floor plants, the garage's car;
  - tags `weights` / `gym` → lift (no such piece in the catalogue yet);
  - nothing else calling → the phone in the hall.
- **Moving.** A* on the 0.25 m grid with the homes check's own 2 × 2-cell walker and solids (`home/rules.js geometry`: partitions, the car bay, filled floor slots). Paths are string-pulled and given rounded corners where they stay clear. A seat or bed is never reached through a wall or another piece. It walks with the city's cast walk (`anim/cast/walk2.js`, one BatchedMesh) and uses its idles (hands behind the back at the trophies, a look round at the stash, a nod to music, hands on hips by the car). To sit, lie or use its hands (cook, wash, arcade), it swaps to the same look as a chars.js rig. Asleep, it gets a duvet and a z Z.
- **The day.** Sims-style needs run down. Each activity advertises what it gives, and the resident does what it needs most, with a little chance, never the same thing twice running, and nearer spots preferred. At night it sleeps and now and then gets up for a snack or the toilet. A bubble now and then: ♨ ♥ ♪ ★ $ ✦ …
- **Editing.** The resident isn't in the homes check, so it never blocks placement, and the builder's picking ignores it. `builder.js` calls `onChange` after every change, undo and redo, and the resident re-plans:
  - a piece it was using or heading for moves → a `?`, and it goes to the new spot;
  - a piece it is sitting on is lifted → a `!`, it stands up and waits;
  - a piece is put down on it → it hops aside.
- **Cost.** One BatchedMesh draw for the walker, about 30 small meshes for the rig (one of the two is visible), and about 0.004 ms per update. The interior stays at 60 fps.

```js
import { createLife } from './life.js';
const life = await createLife({ parent: scene, origin: roomGroup.position, A, fills, room: res /* buildRoom's */, seed, look, night, dom: overlayEl, camera, renderer });
// per frame: life.update(dt) · on an edit: life.setLayout(A, fills) · life.setNight(on) · life.held(id | null) · life.dispose()
// debug: life.state(), life.go('cook')
```

`openMainlandInterior` wires it in by default (`resident: false` turns it off). The handle's `life`, `pause(on)` and `advance(s)` drive it for shots. The walker material skips `gpu.js` CUT, so the same module can run inside the city's home cutaways (`index.js`); it isn't wired in there yet.

Try it: `/style/city/interiors/mainland-test.html?style=gambrel&owner=1` (add `&tod=night` for night), then EDIT HOME and move the sofa. Shots: `shots/home-life/home-life.gif`.

## Interior view art pass (2026-10-06)

slime: "a bit basic … the grass looks pretty mid … make this look triple-A". The research is in `style/research/interior-view-2026-10-06.md` (Sims 4, Happy Home Paradise, Unpacking, Tiny Glade, Townscaper). `view.js` dresses the Mainland view; `mainland.js` keeps the room, the builder and the resident. Before/after stills (`board-before-after.jpg`) and a 10 s orbit GIF are in `shots/interior-art/`. The GIF is rendered with the grain off: animated grain doesn't compress.

**Context, not a void.**
- The plot's real lot comes from `mainland/houses.js` `buildLot`, imported read-only. It uses the same spec `mainland/main.js` builds for that plot (seeds, glass garages and cars in plan order), and the owner's saved lot when there is one.
- The house is clipped out where the room stands: its walls and roof over the house-kit footprint (`yard.js` `houseRects`), the eaves round it, a carport's roof, and a porch or portico in front cut down to 1.15 m. Beds, steps, paths, fences, the yard and the car outside stay.
- Round it: the Mainland's own ground raster (`ground.js` `buildGround`, 0.1 m within 24 m and 0.2 m out to 84 m) and the 4 nearest neighbours' lots.
- Nothing of a neighbour's lot stands inside the room's footprint (follow-up, 2026-10-06). A house kit wider than its wedge lot hides the neighbour's side fence inside its walls on the Mainland. On the gambrel (ML-002) the room's walls are cut away, so that fence ran through the garage and hid the resident below the chest. Standing at the trophy shelf, it read as a floating head on the wall.
- **The lawn is the Mainland's** (`mainland/lawn.js`, `grass.js`, reused). The workers' ground tiles already paint their lawn texels. Each lot job paints its own patch with the same `spec.lawn` and care as `main.js` (`lawn.js` `lotLawnSpec`, `CAREOF`), so a lot gets the same edging, mulch beds, fence-line grass, wear trails and tree shade inside as out. The view stamps them into two maps over its own tiles only. The ground reads them through `lawnMaterial` (`local`: at the Mainland coordinates of the group that turns the neighbourhood round the house), and `createTufts` grows tufts near the camera in that group. There are no tufts under the room or the house. Cost: +0.1–0.5 ms a frame (still 60 fps), and the context's background build takes about 150 ms longer. The room opens as before.
- Neighbours and the far ground use cloned materials lifted toward the horizon colour (aerial perspective). The fog and the depth of field fade them further.
- Everything builds on the Mainland's own workers (`mainland/worker.js` + `jobs.js`, its source bundle fetched once per page), so the room shows at once and the context fills in about 1 s later with no main-thread hitch. Without workers it builds on the main thread, one step per idle tick.
- A plot the plan doesn't know (the test page's `test-<style>`) gets the first built plot of its style.

**Light.**
- The city's polished light: a warm key `#ffe0b0` from the front left, a cool hemisphere fill `#a9b8ff`/`#d9b89c`, and the sky dome (`render/sky.js`) with its PMREM environment.
- A soft PCF shadow map (2048, radius 3.5) over ±17 m: walls, partitions and furniture shadow the floors.
- Contact blobs (one instanced mesh) under every floor piece, the car in the bay and the resident, who is followed every other frame.
- Daylight patches under the windows by day.
- At night every lamp gets a small warm point light and a floor pool, and every room without a lamp gets a ceiling light (the garage's is a cool tube): 9 lights at most, none casting shadows. The moon keeps a dim blue shadow. Neighbours' windows are lit (the night build).

**Cutaway shell** (`room.js` `S.art`; city homes leave it off and draw as before).
- Walls are two-sided: the room's finish inside; outside, the house's lap siding, its colour (`houseSpec.wall`) and white corner boards.
- A finish per room along the back wall, read from its floor zone and furniture:
  - bath: tiled to 1.3 m with an aqua band
  - kitchen: subway-tile splashback, plus a sage/cream lino checker under the kitchen run
  - bedroom: wallpaper stripes
  - living room: a wainscot in the house colour with a chair rail
  - garage: painted block
- Proud skirting and a crown line.
- Windows wherever the wall is clear (nothing hung there, nothing taller than the sill against it): one per room and per end wall, each with a frame, a sill both sides and a mullion cross. They are open, so the yard shows through.
- The front wall is a 0.45 m capped stub, open at the garage bay.
- The foundation slab shows 0.3 m above the lawn.

**Post.**
- `render/post.js` runs on this renderer with the viewer default look (`looks.js` `DEFAULT_LOOK`, Camcorder '98). `?preset=<name>` picks another look; post-only looks keep this light.
- In visit mode: depth of field (`render/dof.js`, autofocus on the orbit target, 5.5 px, falloff 0.9, near blur on). It is off in edit mode, and `?dof=0` turns it off.
- The view registers the post sections in `render/settings.js` (the Mainland page registers none of its own).

**Camera.**
- A lower three-quarter view (27° up, 26° right of front, fov 34), fitted to the room and the foundation.
- The orbit is clamped: pitch 14–62° up, yaw −52°…+90° around the front, distance 0.42–1.6× the framing, and the pan kept round the lot.
- `?el=`, `?az=` and `?fit=` (how much of the frame the room fills, default 0.97) override the framing (look-dev).

**Cost.** 60 fps at 1600 × 813, dpr 1 and dpr 2 (Mac Studio, headless Chrome, post on). About 46k room triangles. The context builds in 1.0–1.5 s on the workers. Opening from the Mainland, the overlay is up in about 0.25 s.
