# Interior objects: the shared format

This is the contract for the home-objects and store-objects agents (wave 1, 2026-09-27).

Every object is data plus a build function. That way the same pieces serve three uses:
- the city: store insides seen through shop windows
- generated homes
- the coming **home builder**, where a human places objects in their agent's home from a picker

So every object has to be **builder-ready**: it knows where it can go, how big it is, how it turns, and what can sit on it.

## Where things live

| set | folder | index | id prefix |
|---|---|---|---|
| home | `interiors/home/` | `interiors/home/index.js` exports `OBJECTS` | none |
| store | `interiors/store/` | `interiors/store/index.js` exports `OBJECTS` | `store-` |

Each set also has its own preview page, `interiors/<set>/preview.html`. Neither set touches the city's core, its kits or `manifest.js`.

## One object

```js
{
  id: 'boombox-90s',           // unique across both sets, kebab-case
  name: 'Boombox',             // the picker's label
  set: 'home',                 // 'home' | 'store'
  cat: 'electronics',          // the picker's category (the lists are below)
  place: 'surface',            // 'floor' | 'wall' | 'surface' (sits on another object's top) | 'ceiling'
  foot: [2, 1],                // footprint in 0.25 m cells: [width, depth]; for 'wall' it is [width, height] on the wall
  h: 0.35,                     // height in metres (for 'wall': how far it sticks out)
  mount: null,                 // 'wall' only: the default height of its bottom edge above the floor, in metres
  rot: 90,                     // rotation step in degrees: 90 for almost everything, 45 or 0 (free) only for rugs, plants and clutter
  tops: [],                    // heights (m) of the surfaces other objects can sit on: a table [0.75], a shelf [0.4, 0.8, 1.2]
  tiers: ['apartment', 'house'], // home: any of trailer | apartment | house | penthouse; store: the shop kinds it belongs to
  tags: ['90s', 'music'],      // vibe tags: the picker's filters, and what the generator draws on
  variants: 3,                 // colourways; build() takes { variant }
  sim: null,                   // a piece the sim cares about: 'safe' | 'stash' | 'lock' | 'door' | 'alarm' | 'dog' | 'cctv' | 'bed' | null
  build(V, { variant, seed }) { /* draw into a vox.js Vol */ },
  far(V, { variant }) { /* optional: a cheap version at 0.1 m for through-the-window views */ },
}
```

## Optional fields (added after wave 1, from the home set's proposals)

```js
  vnames: ['cherry', 'mint', 'ink'],   // a name per variant, for the picker
  seat: 0.42,                          // sitting height in metres, for anything a character can sit on
  states: ['closed', 'open'],          // alternative looks (open/closed, on/off, armed/off); build() then takes { state }
```

- **Swing space.** A footprint includes the space a door needs to open, as with a safe's front cells.
- **Ceiling pieces** hang below y 0 (`volFor`).
- **`far`** is the object downsampled to 0.1 m. Small surface pieces may skip it.
- **Building from a set.** `buildObject(o | id, { variant, seed, state, far })` returns a Vol. Seeds vary the clutter, garments and stock.

## The game block (catalogue v2, 2026-09-28)

What an item means in the game. slime's rules:
- Items persist in the agent's room outside the game.
- Gear brought into the game can be stolen, and a stolen item moves to the thief for good.
- Trophies (one per MARK) can never be stolen or traded.
- Buffs are few and tied to existing sim mechanics.
- Never sold for real money.

```js
  game: {
    kind: 'base',          // 'base' (the kit everyone gets) | 'gear' (has a buff; stealable when brought in) | 'collectible' (value and flex; stealable) | 'trophy' (a MARK made physical; never stolen)
    rarity: 'common',      // common | rare | event | epic | grail | legendary | 1of1
    source: 'base',        // base | store | drop | craft | award | loot
    stealable: false,
    buff: null,            // gear (and `crib` on collectibles), e.g. { burgleOdds: -25 } · { stashTake: -.3 } · { cook: 'stove' } · { heatDecay: 1.2 } · { crib: 40 } (flex value: draws burglars)
    mark: null,            // trophies: the sim MARK id it stands for (OUTLINE §1.9)
  }
```

The numbers are proposals; the sim owns the real values. An item without a `game` block is base decor.

## Assemblies (preset rooms)

Every in-game home of a tier gets one of 3–4 preset layouts, picked per lot. Layouts live in `interiors/home/assemblies/<tier>-<name>.json`:

```js
{ tier, name, room: { w, d, h, walls, floor }, items: [{ id, x, z, rot, variant, on: 'floor' | { wall: 'N' } | { top: <item index> } }] }
```

Positions are in 0.25 m cells. An item may also carry `y` (a height in cells, for stacked or hung pieces) and `state` (one of its `states`); `on` may also be `'ceiling'`.
Each layout marks 2–4 `slots` where an owner's brought-in items go: `slots: [{ id, label, x, z, rot, on, fits: [kind…] | [cat…], demo: <item id> }]`. `demo` is the piece the preview shows in the slot. A piece fits a slot when its `game.kind` or its `cat` is in `fits` (and its place and footprint fit); every layout has a slot whose `fits` include `stash`. Trailer, apartment and house layouts also carry `vacant: [items]`, the empty FOR RENT look `room.js` builds when nobody lives there (floor and wall pieces only). `home/check.mjs` checks all of it.
Layouts use no-stakes pieces only (base and decor), so a home never hands out free buffs; gear, collectibles and trophies arrive through slots.

**Mainland layouts (2026-10-06).** `assemblies/mainland-<style>.json` (tier `mainland`, plus `style`), one per Mainland house-kit style. The room may carry two more fields:
- `zones: [{ x, z, w, d, floor }]`: floor finishes over cell rects (`concrete`, `tile`, or any floor word). Visual only.
- `built: [{ kind: 'wall' | 'car', x, z, w, d, paint? }]`: the house's built-ins. `wall` is a partition over its cells; `car` is the garage's car bay (`room.js` parks `S.car` there). Both are solid to `home/rules.js` (nothing overlaps them, nobody walks through them). They are never items, so the builder can't pick them up and CLEAR ROOM never clears them.

**Saved homes (the home builder, 2026-10-06).** An owner's edited home is the same format with two optional fields:
- a slot may carry `fill: { id, variant, state? } | null`: the owner's piece in it (`null` = left empty). Without `fill`, `fill.js` picks.
- an item may carry `seed`, so a moved piece keeps its look (`room.js` otherwise seeds by its x).

The builder only lets an owner make layouts that pass `home/check.mjs` (its rules live in `home/rules.js`): free placement for base pieces, slots for gear, collectibles and trophies. `node style/city/interiors/home/check.mjs path/to/home.json` checks an exported one.

## Space and grain

- **Origin.** `build` draws into a `Vol` (vox.js) whose origin is the footprint's back-left corner on the floor (or on the wall). +x is width, +z is depth toward the room, +y is up, and the object's **front faces +z** (into the room).
- **Grain.** Characters are built from 0.05 m cubes (S = 1/20) and stand about 1.75 m tall with the big head (STYLE.md §1). Interiors are seen up close, right beside characters, so objects use the character grain, 0.05 m. Offer `far` at the city's 0.1 m when the object will be seen from the street.
- **Cells.** 0.25 m cells = 5 character cubes. A chair is about [2, 2], a double bed [6, 8], a boombox [2, 1], a poster (wall) [2, 3].
- **Scale.** Size everything to the big-head characters, not real-world ergonomics alone. Put a character next to each object on your preview page (`castspec.js` / `people.js` build them) and check it reads.

## Categories

- **home:** seating, beds, tables, storage, electronics, gaming, music, decor, wall, rugs, lights, plants, kitchen, bath, collectibles, trophies, security, stash, clutter
- **store:** shelving, coolers, counters, cases, racks, machines, stock, fixtures, signs-inside, clutter

## The look

This is Springfield Street: Simpsons + NYC + Dazed/Hypebeast, toon colours, chunky voxels, no outlines (STYLE.md).

The voice is a crime world mixed with NYC, hypebeast, collector culture and bodegas. Internet references are a rare wink at most.

Brands are **invented**. Never use a real trademark, logo or console design: invent the shape and the name.
