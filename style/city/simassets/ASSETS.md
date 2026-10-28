# Sim-state assets

`index.js` returns **Vols** (vox.js). They are memoized per argument set and per `TOD.night` (lit parts switch to layer 3, like props.js), so treat them as read-only. To place one, call `stamp(bankOf(V), dst, rotQ, x, y, z)`. Each Vol carries `kind`, `anchor`, `size` and `box3`. `SIZES` gives each default piece's size, box and placement, checked against the built pieces.

## Anchors
- **Ground:** the base centre; +z is the front. Stamp at the surface's y (lot, site centre, corner-zone centre, lane centre).
- **Facade:** the bottom centre of the opening on the wall's outer plane (kit.js `d = 0`). x runs along the wall and +z points out.
  - Use `rotQ = FACE_ROT[side]` (the same as gen.js `faceRot`).
  - For a window, stamp at `(a0 + w/2, y0)` and pass the real w and h. kit.js doors start at y0 = 1.
  - Plugs fill the opening from z −0.2. Face parts sit at +0.15 or more, clear of band (+0.1) and trim (+0.2) planes.

## Pieces (default size in metres)
- **`forRentSign({style})`**
  - `lawn`: 2.2×0.4×2.05 (HOME.EXE).
  - `window`: a 1.0×1.2 card (PING), for windows ≥ 11 vx.
  - `lobby`: a 1.4×0.65×2.15 easel (HI-RES LIVING) that stands beside the lobby.
- **`windowCard(kind, {w, h, seed})`:** `zzz`, `curtain` (lit at night) or `forRent`. It fills a w × h vx window (default 13×17).
- **`pile(kind, level)`:** scrap, salts, goo, leaf or cloth, in 5 stages (`stageOf`). Stage 0 keeps the site's base. At most 3.2×3.2×2.6.
- **`security(kind, o)`**
  - `lock`, `door` and `gate` go on an opening (o.w × o.h, default 14×24 vx). The gate takes `open`; `style: 'bars'` makes window guards.
  - `buzzer`: 0.5×0.8, 1.0 m up beside the door.
  - `camera`: 2.6–3.0 m up.
  - `safe`: 0.8×0.85×1.0.
- **`doormanLobby({width})`:** 4.6×1.95×4.1 at width 56 vx, centred on the tower's face. It needs the 2 m sidewalk. The doorman stands at `STAND` (1.3, 0, 0.6), facing +z.
- **`scar(kind, {w, h, door, plume})`**
  - `burned` (plume 0.7 m; lower it on top floors), `boarded` and `foreclosed` go over openings.
  - `crimeScene`: 3.2×2.8.
  - `memorial`: 2.35×1.1, with its back edge against a wall.
- **`hotspot({heat, compact})`:** 3.2×3.1×2.6 in 5 steps (`heatStep`), from a lone couch to the full umbrella; +z faces the corner. `compact: true` is the same pieces and steps closed up front to back, 3.2×2.6×2.6, for the tight corners whose 3 m walks the full set overfills (ground.js `hotspotSpot` picks it; preview `?view=corner&compact=1`).
- **`patrolCar({lights})`:** 2.0×4.7×2.8, from the copCar family. `lights` switches the bar to lit.

No crew colours, tags or flags. Preview: `preview.html` (`?view=`, `?tod=night`, `?shot=1`); shots in `shots/`.
