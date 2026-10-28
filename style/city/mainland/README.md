# The Mainland · v1

**Layout.** You step off SECOND CHANCE under the WELCOME arch. Harbor Rd runs north from the teal terminal. The built zone has two courts. **Sunny Ct** is a sweeping stem into a round bulb with oaks, maples and a blossom island. **Willow Bend** is an S-bend into an oval loop round a green, with a willow, a gazebo, birches, red maples and a mailbox-kiosk corner. The frontier is Bayview Dr (waterfront), Orchard Ln, Juniper Way with Aster and Sycamore Cts, and Clover Ct: 111 plots, 17 built.

**plots.json** holds `streets` (centreline polylines, bulbs, loops) and `plots`. Each plot has an `id`, an `address {number, street}`, a `rect {x, z, w, d, rot}` (front-centre on the lot line, facing its street), `corners`, a `status` (`built`/`available`), `prime` (with its reason) and, if built, `style` and `wall`. The page is generated from it: workers rasterise the ground and build the lots.

**Adding a neighbourhood.** Edit `layout.mjs`: add a street, bulb or loop to `STREETS`, then call `lotsAlong`, `pieLots` or `loopLots`. Run `node style/city/mainland/layout.mjs`. It drops overlapping plots and reports them, renumbers addresses and rewrites `plots.json`. New streets get lamps, stakes and signs automatically.

## House builder v1 (2026-10-06)

Homes matter here: Mainland lots don't reset with the season. Click a plot for its card (address, size, prime, status, owner). The owner gets **BUILD**; the dev switch is `?owner=<plot id>` (comma list, or `all`), and later the sim or the mint will decide. Everyone else gets **VISIT**: a read-only street view with the owner and the flex readout. `?plot=<id>` selects a plot, `&build=1` opens the builder and `&visit=1` goes to the street view.

- **House kit** (`yard.js` KIT, built by `houses.js`). Pick one of the 8 styles, then its options: wall, roof, accent, garage (door, glass, carport or none), porch, dormers, hoop, pool, a showpiece on the roof (trophy, flamingo, dish, weathervane or star) and the show car. Setbacks are 2 m at the front, 1 m at the sides and 1 m at the back, measured against the lot's real corners. A style or option that doesn't fit is greyed out. A style refits itself (dropping its garage or pool) when that's what fits. Drag the house, or use ← →, to slide it along its band. Houses built before the setback rules stand as they are until changed.
- **Yard.** Fences and hedges go on six runs: the front, the sides split at the house front, and the back. Paths and the driveway are painted on 0.5 m cells. Yard pieces come from the tray. Pieces stay off the house, paths, door patch and fences, and off the drive (a car may park there). R turns a piece, C changes its colour, Del removes it, ⌘Z undoes.
- **Save** (`saved.js`). Saves go to `localStorage` under `aicity.mainland.lot.v1.<id>`, with Export/Import JSON and a `REMOTE` hook. A lot you haven't edited stores nothing. Done rebuilds the lot from the saved spec, the same way a reload does. Generated lots draw exactly as before (all 17 banks are identical).
- **Go inside.** `builder.js` exports `enterHouse(plotId, houseSpec)` and `INTERIOR.open`. This is the hook for the Mainland interiors.

## Walk mode v1 (2026-10-06)

**WALK** (the yellow button, or **W** while browsing; `?walk=1` starts on the street) puts you on the street as one cast character: by your plot when the URL names one (`?owner=<plot id>`), else outside the ferry terminal. `?look=<handle>` swaps the look for a named one.

- **Controls.** WASD or the arrows move, the mouse looks (click for pointer lock, or drag), Shift runs, Space hops, the wheel sets the camera distance, **V** switches between third and first person, **B** turns the first-person head bob off, Esc lets go of the mouse and then leaves.
- **Third person** rides ~3.3 m up, behind you and over the right shoulder, looking slightly down. Whatever stands between the camera and you is dithered away in a soft cone (every page material, above the curb), so the camera never fights walls.
- **Collision** (`walkgrid.js`) is built in a worker when you start walking (~0.4 s), from the page's own meshes, so what you see is what stops you: houses, fences, hedges, yard pieces, trees, lamps, cars, the terminal, the arch and the residents. It uses 0.2 m column spans and a separate ground raster. You slide along walls. Curbs, porch steps and the pier step up to 0.32 m, and the water and the map's edge stop you. A lot rebuilt in the builder is rebuilt in the grid the next time you walk.
- **Doors.** At a house's front door, **E · go inside** calls `enterHouse` through the builder's `doorOf` / `enter` (the same owner rules as Go inside). Leaving puts you back on the step, facing the street.
- **Residents.** Look at one (the screen centre, or the pointer when the mouse is free) for a name card, and click to pin it. `main.js` records every baked resident in `FOLK`.
- **Touch.** Tap the ground to walk there, and drag to look.
- `window.__walk` (`start`, `stop`, `frame(dt)`, `key`, `look`, `place`, `grid`, `stats`) drives it from tools. The clip is `shots/mainland-walk/walk.gif`.

## Chat + presence v1 (2026-10-06)

Humans walking the Mainland see each other and talk. A small relay passes presence and chat between everyone on the page.

**Run it.**

```
node style/city/mainland/relay.mjs                  # ws://127.0.0.1:5460/mainland
node style/city/mainland/relay.mjs --bots 10        # plus 10 dev bots walking (and talking) near the ferry
node style/city/mainland/relay.mjs --port 5470 --bots 6 --bots-at -30,-95   # bots round Willow Bend
```

The page connects to `ws://<the page's host>:5460/mainland` on its own. `?relay=ws://host:port/mainland` points it elsewhere, and `?relay=off` turns it off. With no relay the page is solo: the pill (top right) says **OFFLINE · SOLO**, and your lines still pop over your own head. It tries again 15 s and 60 s after loading, then whenever you open the chat or click the pill. Chrome prints one network line in the console for each refused try; that line comes from the browser, not from a script error.

To test with two windows, start the relay, then open `/style/city/mainland/?walk=1&owner=ML-011&as=alice` and `/style/city/mainland/?walk=1&as=bob`. `?as=<handle>` sets that window's handle and player id without touching localStorage, so two tabs in one browser are two people. The check `node style/city/tools/mainland-chat.mjs` runs its own relay on :5461 against the page on :5408. It covers two players, perf with bots, offline, and inside plus the builder. Its frames and GIFs are in `shots/mainland-chat/`.

- **The relay** (`relay.mjs`) has no dependencies. Node 22 has a WebSocket client but no server, so it is a minimal RFC 6455 server: the handshake, masked text frames, continuations, ping and pong, and close (no extensions, no binary). It keeps one room per path (`/mainland`). Presence is batched each tick (10 Hz) and stores nothing. `--host 127.0.0.1` is the default. Use `--host 0.0.0.0 --origin http://<your host>:5330` to let the LAN or tailnet in. By default it accepts pages from localhost and 127.0.0.1 on any port, and `--origin any` drops the check.
- **Presence** (`chat.js` sends, `peers.js` draws). Your client sends 10 Hz while you walk: position, the body's yaw, on the ground or jumping, and away (no input for 90 s, or the tab hidden). Otherwise it sends 1 Hz. Inside a house it sends that door, and the others see your tag there as **INSIDE · <address>**. Everyone else is their own cast look, stable per player id (your look comes from your id too, and `?look=` still overrides). They use the same walk, run blend, idles and jump crouch as yours, through snapshot interpolation. Each snapshot is mapped to your clock and drawn 120–400 ms in the past (Catmull-Rom between snapshots, at most 150 ms of extrapolation, small corrections eased out), so nobody rubber-bands. Others aren't solid: they never enter your collision grid and you walk through them, and their own collision keeps them out of walls. Joins and leaves fade in and out (dithered), and an away player is drawn at half.
- **Chat.** **Enter** (or **T**, or **/** to start a command) opens the bar at the bottom. While it's open, WASD types and doesn't walk. **Enter** sends and **Esc** closes. Your line pops over your head, and everyone else's over theirs, in the home-life bubble style (white body, stepped corners, ink drop, stepped tail). Up to three stack, newest at the bottom, and each fades after 4.5–10 s depending on length. Nearer heads draw on top, and farther ones draw smaller. A compact log in the bottom-left fades after 10 s idle. Commands: `/wave`, `/dap`, `/dance` (emotes, an idle-style pose everyone sees), `/name <handle>`, `/who`, `/help`.
- **Handle.** You're asked once, the first time you walk or chat. The handle is stored in localStorage (wrapped, so a private window just asks again). It is 2–16 letters, digits, `_ . -`, filtered. Later it becomes the owner's agent handle.
- **Guardrails v1** (`chatrules.mjs`, shared by the page and the relay; the relay enforces them):
  - 140 characters a line.
  - A chat bucket: 4 lines, then one per 1.5 s ("slow down").
  - A basic word filter (folds leetspeak, squeezes repeats, joins spaced-out letters; the hit is starred).
  - A 1 KB message cap; anything bigger closes the connection.
  - 30 messages a second sustained, then the relay hangs up.
  - At most 8 connections an address and 64 a room.
  - Click a player's tag (or their name in the log, or the people list on the pill) to **mute** their chat or **hide** them. This is local to you and kept by player id.
- **Not public yet.** v1 has no accounts or auth. Anyone who reaches the relay can pick any handle, and player ids are self-asserted. There is no report, ban, block-list sync, moderator view or logging. Before the Mainland chat is public it needs real auth (tie the handle to the owner's account or agent), server-side moderation (reports, mutes and bans that hold, a moderator tool, a better filter or a classifier), TLS (`wss://`), and per-account rate limits.
- `window.__chat` (`peers`, `say`, `emote`, `open`, `close`, `ents`, `log`, `status`, `mutes`, `hides`) drives it from tools.

## Lawns (2026-10-06)

The ground's top faces (lawns, verges, walks, curbs) take their colour from two **lawn maps**: RGBA textures with one texel per ground voxel (0.1 m over the built zone, 0.2 m on the frontier). Each texel is a pure function of world position (`lawn.js`). The alpha channel is the tuft density.

- **Ground tiles** (`ground.js`) paint every cell: lawn patches, sun-faded drifts, clover, flower drifts and bare dirt. Verges are drier and trodden. Frontier plots are meadow or mown (prime plots mown with a wild border), with a wild strip along the shore. Aprons get oil and cracks, kerbs get scuffs at the drives, and the odd sidewalk slab is replaced.
- **Each built lot paints its own patch** in its lot job (`lotLawn`, from the lot's own geometry). That covers edging along its paths, mulch round its shrubs and walls, long dark grass at its fences, wear trails (door to car, the side passage, out to the trampoline or swings), stepping stones on kept lawns, the sprinkler's wet patch, and its trees' shade and leaves. Builder rebuilds repaint it too (`run('lot')` adds `spec.lawn`).
- **Care** (`CAREOF` in `lawn.js`, read by `main.js` and the interior view through `lotLawnSpec`) sets how each lot is kept. The heads and the slab are showpieces (a two-way checker mow). The rest are tidy (stripes), lived-in (faint stripes, clover, trails) or let go (long grass, dandelions, dirt). An owner's lot is tidy.
- **Tufts** (`grass.js`) are one instanced draw of voxel blades round a focus ahead of the camera, placed on the GPU by world cell. They are coloured from the map, sway in the wind, and fade out by about 25 m and above about 45 m. They are not in the shadow pass or the walk grid.
- Driveways get oil stains and hairline cracks (`houses.js driveCol`). Scene trees shade the grass under them (`treeShade`).
