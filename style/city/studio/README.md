# Trait Studio

**Open:** http://127.0.0.1:5320/style/city/studio/

**Use it**
- **Catalogue** (right): all 214 traits, filtered by slot, origin, tier, status or search. *Colourways* gives each of the 301 colourways a card.
- **Stage** (middle): the city's walker (walk v2, grips, pendant swing). Orbit by dragging. Modes: idle (nine, or cycle all), walk in place, circle. PFP uses the fit check's framing.
- **Fit** (left): clicking a trait wears it, one per slot. Pick colourways, lock slots, randomise the rest (optionally keeps only), save or load fits. A | B compares two.

**Keys**
- `←→↑↓` move and wear
- `K` `X` `U` keep, kill, undecided (`⇧`: just that colourway)
- `C` colourway, `N` note, `/` search
- `1` `2` `3` mode · `[` `]` idle · `Space` pause · `T` turntable
- `R` randomise · `L` lock · `P` PFP · `V` compare · `B` other fit · `?` help

**Saving:** decisions save as you go to `world/traits-curation.json` (`slot/id` → status, note, colourways) via `POST /api/curation`.

**Applying:** `world/curation.js` `curationFilter()` makes it a roll filter: killed traits never roll, kept new ones do. It's off; its header gives the switch-on steps.

**Checks:** `node style/city/studio/sweep.mjs`. Refresh sim tiers: `node style/city/studio/sync-tiers.mjs`.
