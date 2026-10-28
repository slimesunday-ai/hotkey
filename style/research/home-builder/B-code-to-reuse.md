# B — Code to Reuse for Home-Decorating Mode

Scope: picker, ghost placement, grid snapping, rotation, walls/surfaces, undo, saving. Every repo below was actually opened (GitHub page and/or `api.github.com` JSON and/or raw source) on 2026-09-27; dates are the GitHub API's `pushed_at`.

## Ranked shortlist

**1. three.js itself — mrdoob/three.js**
github.com/mrdoob/three.js · MIT · pushed 2026-09-27 (today) · 116k★ / 382 open issues.
Already our dependency at r185. Three things to take, all verified present at tag `r185`:
- `examples/jsm/controls/TransformControls.js` and `DragControls.js` — confirmed valid ES modules at the exact r185 tag, importable straight off the importmap. TransformControls' gizmos are continuous-drag (better for a dev tool than 90°-stepped placement); DragControls' pointer-raycast drag loop is a good base for move-by-drag.
- `examples/webgl_interactive_voxelpainter.html` — the official placement pattern: raycast → `position.copy(intersect.point).add(intersect.face.normal)` → `divideScalar(cell).floor().multiplyScalar(cell).addScalar(cell/2)`. This is close to exactly our ghost-placement + 0.25m grid-snap need; only requires generalizing from a 1-cell cube to multi-cell footprints.
- `editor/js/commands/` — confirmed on `dev`: `Commands.js`, `MultiCmdsCommand.js`, `AddObjectCommand.js`, `RemoveObjectCommand.js`, `SetPositionCommand.js`, `SetRotationCommand.js`, `SetSceneCommand.js`, etc. mrdoob's own Command/History undo pattern. It's wired to the Editor app's signal bus, so we take the *pattern* (small Cmd classes with `execute()`/`undo()` plus a linear History stack), not the files.
Fit: perfect — same three.js version, vanilla ESM, no new dependency. Effort: low. Risk: none, it's code we already ship.

**2. three-mesh-bvh — gkjohnson/three-mesh-bvh**
github.com/gkjohnson/three-mesh-bvh · MIT · pushed 2026-09-26 · 3.5k★ / 82 open issues. `package.json` peerDependency `three >= 0.159.0`, covers r185.
Take: the module itself, only if raycasting against merged room/furniture geometry gets slow. Not needed for a house-scale scene using plain `Raycaster.intersectObjects`. Fit: drop-in importmap entry + `computeBoundsTree()`. Effort: trivial. Risk: none; a perf escape hatch, not core.

**3. room-studio — achieve0410/room-studio**
github.com/achieve0410/room-studio · Apache-2.0 · pushed 2026-09-22 · 0★ / 8 open issues.
Vanilla JS + Vite + three.js, explicitly no framework. `src/` is a flat set of plain modules: `studio3d-camera.js`, `studio3d-edit.js`, `studio3d-panel.js`, `space-geometry.js`, `project-file.js`, `layout-tools.js`. README confirms floor planning, furniture placement/transform, duplicate/copy/paste, 1cm-nudge, undo/redo, dollhouse/top-down/first-person view modes, and `project-file.js`-based local save (localStorage, no backend). The "dollhouse" view name-matches our spec exactly.
Take: read `studio3d-edit.js` and `project-file.js` for the interaction loop and save-file shape — not as a dependency. It's a floorplan app (freeform walls), not a voxel-footprint-object app, so the core placement math doesn't transfer directly. Fit: same paradigm (vanilla ESM, three.js, no React) makes it easy to read, but it's Vite-bundled (bare `three` specifiers), so nothing pastes in unmodified. Effort: medium — selective porting after review. Risk: zero stars, five days old at fetch time — unvetted. The surrounding docs (DESIGN.md, ROADMAP.md, THIRD_PARTY_NOTICES.md, tests/) suggest real effort rather than a throwaway, but there is no community track record yet — verify anything before trusting it.

**4. blueprint-js — aalavandhaann/blueprint-js**
github.com/aalavandhaann/blueprint-js · MIT · pushed 2024-11-20 · 589★ / 25 open issues. `package.json`: `"three": "^0.148.0"` (37 releases behind r185, no `"type":"module"`).
ES6 rewrite of the original blueprint3d; the most recently active fork of that lineage. Take: architectural concepts only — rooms/walls/corners data model, floorplan→extruded-3D-mesh approach, asset-library UI pattern. Don't take code: r148→r185 spans three.js's colorspace/`ColorManagement` overhaul and other breaking changes, and it isn't packaged for bare importmap consumption. Fit: conceptual only — its core model is rooms-with-walls, a different problem from our voxel-footprint objects. Effort: high to run as-is, low if only mined for ideas. Risk: version drift, mismatched data model.

**5. blueprint3d (original) — furnishup/blueprint3d**
github.com/furnishup/blueprint3d · MIT · pushed 2021-01-20 (~5.5 yrs stale) · ~2k★ / 102 open issues. Grunt-based build, no modern module tooling.
Root ancestor of the whole blueprint3d/-js/-modern family surfaced in search. Take: nothing runnable — historical reference for the split 2D-plan/3D-view UX and the original items/floorplan JSON schema that every fork inherited. Effort: high (pre-ES6-module toolchain, old three.js). Risk: abandoned; skim the README for the split-view idea only, don't touch the code.

## Checked and not recommended

- **open-hotel/open-hotel-client** (MIT, pushed 2023-04-04, 116★) — HTML5 **Canvas 2D**, not three.js/WebGL, so no code transfers. **IP flag:** it's a Habbo Hotel clone; "Habbo" and its room-editor look are Sulake's trademark/trade dress, and the client's own MIT code license doesn't clear that risk. Use only as a UX-feel reference (isometric room, click-to-rotate furniture, drag-to-place) — never copy assets or branding.
- **PiusNyakoojo/SwipeControls** — `license.spdx_id` is `null` (no license file) → excluded by our own rule. Also stale since 2016, 7★.
- **mese79/TouchControls** (MIT, pushed 2023-01-21, 71★) — small, stale, low adoption. Three.js's own controls already unify touch+mouse via pointer events; build the remaining touch-specific bits ourselves.
- **bencoveney/webgl-voxel** (MIT, pushed 2022-12-10, 15★, 20 open issues) — reads as a personal experiment, not production code.
- **khalid3314/blueprint3d-modern** (MIT, pushed 2026-09-27, 0★/0 issues) — Next.js + React + TypeScript, which conflicts directly with our no-bundler/no-React constraint, plus zero community signal. Several similarly-named "blueprint3d-modern" repos under other usernames turned up in search; I only opened this one and can't vouch for the rest — treat that naming cluster as unverified.

## Build-vs-adapt estimate

| Piece | Approach | Source | Est. effort |
|---|---|---|---|
| Picker (catalog UI) | Build | none needed — plain DOM/CSS grid | 0.5–1 day |
| Ghost placement | Adapt | three.js voxel-painter pattern (#1) | 0.5 day |
| Grid snapping (0.25m) | Adapt | same pattern, generalized to multi-cell footprints | 0.5 day |
| Rotation (90° steps) | Build | trivial `rotation.y += π/2`, cycled on input | <0.5 day |
| Walls & surfaces targeting | Build | no repo matches our floor/wall/surface/ceiling model; skim room-studio's `studio3d-edit.js` for interaction shape only | 1.5–2.5 days |
| Undo/redo | Adapt | three.js editor Command/History pattern (#1) | 0.5–1 day |
| Saving | Build | small custom JSON (itemId, cell, rotation, placement) — three's `Object3D.toJSON()` bakes full mesh data, wrong shape for us | 0.5 day |

Total: roughly **4–6 days** for a first working pass, concentrated in walls/surfaces targeting, which is genuinely bespoke to our voxel-footprint model — nothing found matches it closely enough to adapt.

## Recommendation

Don't add a room-planner dependency. Pull three concrete, zero-risk things straight from three.js itself (already r185-verified, already our dependency): DragControls' pointer-drag loop, the voxel-painter's raycast+snap math, and the editor's Command/History undo pattern. Skim `achieve0410/room-studio` (Apache-2.0, closest stack match) for interaction-loop and save-schema shape only — it's unproven (0★, five days old), so verify before trusting any snippet. Treat blueprint3d/blueprint-js as read-only inspiration for the data-model idea, and open-hotel as UX-feel inspiration only, given the Habbo IP flag. Add three-mesh-bvh later only if profiling shows raycasting is a bottleneck. Build the picker, rotation, walls/surfaces logic, and save schema ourselves — they're small and specific to our voxel-footprint objects, and nothing surfaced in this research matches that model closely enough to save real time by adapting it.
