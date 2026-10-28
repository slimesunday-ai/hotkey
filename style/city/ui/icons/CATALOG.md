# Item icons · the catalogue

Every object an agent can hold, stash, buy, install, craft, wear or earn in the sim (`sim2/`, read-only), and its icon.
Sources: `rules.mjs` (the tables) and `game.mjs` (what an inventory stack, a lot's `gear` and `sec`, and the marks can hold), checked
against the recorded run `2026-09-29T23-18-20-641Z-mixed` (`snapshots.jsonl`: `agents[].inv[].k/label`, `lots[].sec`, `wear`, `marks`).

**73 icons**: 30 objects + 5 marks + 37 worn traits + the fallback. 41 are cut from the city's own models (37 traits from the cast,
the door, safe and camera from `simassets/`, the dog from `props.js`), 32 are new voxel models in `models.js`.

## How the sim holds things
- **Pockets** (`a.inv`) and the **home stash** (`lot.stash.inv`): stacks `{ k, n, q?, label?, fake?, known?, evidence?, from?, hire?, cut? }`
  (`game.mjs:69–72`). `k` is the item; `label` is what a product is *sold as* (`label <drug> as <word>`, `game.mjs:476`; the run has
  `temp` labelled `hallu`); `q` the quality (product only); `fake` baking-soda product (`COOK.fakeCost`, `game.mjs:364`); `evidence`
  goods a cop seized (`game.mjs:702, 946`); `hire` product fronted by a boss (street only); `cut` doubled and halved in quality.
  The icon follows `k` (what it really is); the tooltip names the label and says "really …" when they differ.
- **Cash**: `a.cash` and `lot.stash.cash` (a number in the recorded snapshots, `{ cash, inv }` on the live server).
- **The house**: `lot.sec` (`lock door dog alarm safe` → expiry time, `game.mjs:20, 693, 883`; public: the street sees it) and
  `lot.gear` (`stove rig` → batches left, `game.mjs:54, 370, 693`; not in the recorded snapshots).
- **Worn traits**: `a.wear` (slot → trait id, public); bought traits sit in the pockets until worn (`boots`, `dad`, `rope` … in the run).
- **Marks** (trophies): `a.marks` (`game.mjs:65`), five ids.
- **UI flags, not icons**: fake, evidence, fronted, cut (a corner tag on the slot); quality (a `q85` marker with a bar).

## The set
| key | name | group | what it is | sim source | model |
|---|---|---|---|---|---|
| `cash` | Cash | cash | credits (cr) | game.mjs:39 (a.cash), 334 (stash.cash) | new, after world/cast/fresh/held.js big_face_wad |
| `leaf` | Leaf | ingredient | a bundle of leaf from the woods (cooking ingredient) | rules.mjs:46 INGREDIENTS | new, after simassets/piles.js bundle() |
| `salts` | Salts | ingredient | a drum of salts from the dead mall (cooking ingredient) | rules.mjs:46 INGREDIENTS | new, after simassets/piles.js drum() |
| `goo` | Goo | ingredient | a can of goo from the docks (cooking ingredient) | rules.mjs:46 INGREDIENTS | new, after simassets/piles.js barrel() |
| `pipe` | Pipe | part | scrap pipe from the Heap (every recipe wants it) | rules.mjs:47 PARTS | new |
| `spring` | Spring | part | a scrap spring from the Heap | rules.mjs:47 PARTS | new |
| `grip` | Grip | part | a scrap grip from the Heap | rules.mjs:47 PARTS | new |
| `temp` | Temp | product | reckless: +3 decisions, +15% fight odds | rules.mjs:50 DRUGS | new |
| `hallu` | Hallu | product | sees rumours that may be false, and one real secret | rules.mjs:51 DRUGS | new |
| `sudo` | Sudo | product | treats the next message it reads as an order | rules.mjs:52 DRUGS | new |
| `truth` | Truth | product | words marked VERIFIED, real thoughts shown | rules.mjs:53 DRUGS | new |
| `clear` | Clear | product | heat −25, short-term memory wiped | rules.mjs:54 DRUGS | new |
| `firewall` | Firewall | product | robbers −20%, immune to SUDO and HALLU, refuses deals | rules.mjs:55 DRUGS | new |
| `gun` | Gun | crafted | a pipe gun (pipe + spring + grip): +20% fight odds, contraband | rules.mjs:67 CRAFT.gun · 42 STARTER.cop | new |
| `pick` | Pick | tool | a pick: digs +1 an hour, wears out after 12 hours | rules.mjs:69 CRAFT.pick · 39 TOOLS · 42 STARTER.digger | new |
| `kit` | Test kit | tool | tests one stack: the true drug, its quality, who sold it (Store, 3cr) | rules.mjs:75 STORE.kit | new |
| `stove` | Stove | gear | a stove: cook at home, 20 batches | rules.mjs:69 CRAFT.stove · 39 TOOLS · game.mjs:54 lot gear | new |
| `rig` | Rig | gear | a rig: up to 4 ingredient sets per batch, 12 batches (Store, 150cr) | rules.mjs:37 RIG · 70 CRAFT.rig · 75 STORE.rig · game.mjs:693 lot gear | new |
| `lock` | Lock | security | a lock: burglary −25%, 4 days, a break-in wrecks it | rules.mjs:67 CRAFT.lock · 72 SECURITY | new, after simassets/security.js padlock() |
| `door` | Steel door | security | a reinforced door: burglary −20%, 6 days | rules.mjs:68 CRAFT.door · 72 SECURITY | reused: simassets/security.js door |
| `safe` | Safe | security | a safe: halves what a burglar takes from the stash, 8 days | rules.mjs:68 CRAFT.safe · 73 SECURITY | reused: simassets/security.js safe |
| `dog` | Guard dog | security | a dog: burglary −35%, 5 days (Store, 25cr) | rules.mjs:72 SECURITY · 75 STORE.dog | reused: props.js dog (sitting) |
| `camera` | CCTV camera | security | a camera (lot security key cctv / camera: records a burglar; the city reads it, the sim has none yet) | style/city/simstate/lens.js:57 CCTV (not in the sim yet) | reused: simassets/security.js camera |
| `alarm` | Alarm | security | an alarm: may trip on a burglar and wake you, 7 days (Store, 18cr) | rules.mjs:72 SECURITY · 75 STORE.alarm | new |
| `mark:founder` | Founder | mark | founded a crew | game.mjs:919 | new |
| `mark:ghost` | Ghost | mark | died | game.mjs:216 | new |
| `mark:evicted` | Evicted | mark | evicted for missed rent | game.mjs:338 | new |
| `mark:rugger` | Rugger | mark | rugged their crew (took the treasury) | game.mjs:930 | new |
| `mark:booked` | Booked | mark | arrested | game.mjs:953 | new |
| `rope` | gold rope | trait · common | neck · common | rules.mjs:79–86 TRAITS | reused: cut from the cast (world/chars.js compose) |
| `padlock` | https padlock | trait · common | neck · common | rules.mjs:79–86 TRAITS | reused: cut from the cast (world/chars.js compose) |
| `floppy` | floppy pendant | trait · common | neck · common | rules.mjs:79–86 TRAITS | reused: cut from the cast (world/chars.js compose) |
| `dollar` | $ piece | trait · rare | neck · rare | rules.mjs:79–86 TRAITS | reused: cut from the cast (world/chars.js compose) |
| `stack` | stacked chains | trait · rare | neck · rare | rules.mjs:79–86 TRAITS | reused: cut from the cast (world/chars.js compose) |
| `piece` | iced medallion | trait · epic | neck · epic | rules.mjs:79–86 TRAITS | reused: cut from the cast (world/chars.js compose) |
| `cuban` | cuban link | trait · epic | neck · epic | rules.mjs:79–86 TRAITS | reused: cut from the cast (world/chars.js compose) |
| `tennis` | tennis chain | trait · grail | neck · grail | rules.mjs:79–86 TRAITS | reused: cut from the cast (world/chars.js compose) |
| `grill` | Silver grill | trait · rare | mouth · rare | rules.mjs:79–86 TRAITS | new (a dental grill) |
| `gold` | Gold grill | trait · epic | mouth · epic | rules.mjs:79–86 TRAITS | new (a dental grill) |
| `iced` | Iced grill | trait · grail | mouth · grail | rules.mjs:79–86 TRAITS | new (a dental grill) |
| `fitted` | flat-brim fitted | trait · common | hat · common | rules.mjs:79–86 TRAITS | reused: cut from the cast (world/chars.js compose) |
| `bucket` | title-bar bucket | trait · common | hat · common | rules.mjs:79–86 TRAITS | reused: cut from the cast (world/chars.js compose) |
| `beanie` | fisherman beanie | trait · common | hat · common | rules.mjs:79–86 TRAITS | reused: cut from the cast (world/chars.js compose) |
| `durag` | durag | trait · common | hat · common | rules.mjs:79–86 TRAITS | reused: cut from the cast (world/chars.js compose) |
| `trucker` | WWW trucker | trait · common | hat · common | rules.mjs:79–86 TRAITS | reused: cut from the cast (world/chars.js compose) |
| `bandana` | bandana | trait · common | hat · common | rules.mjs:79–86 TRAITS | reused: cut from the cast (world/chars.js compose) |
| `beret` | paint beret | trait · rare | hat · rare | rules.mjs:79–86 TRAITS | reused: cut from the cast (world/chars.js compose) |
| `balaclava` | balaclava | trait · rare | hat · rare | rules.mjs:79–86 TRAITS | reused: cut from the cast (world/chars.js compose) |
| `wrap` | wraparounds | trait · common | eyes · common | rules.mjs:79–86 TRAITS | reused: cut from the cast (world/chars.js compose) |
| `ovals` | matrix ovals | trait · common | eyes · common | rules.mjs:79–86 TRAITS | reused: cut from the cast (world/chars.js compose) |
| `anaglyph` | 3D glasses | trait · common | eyes · common | rules.mjs:79–86 TRAITS | reused: cut from the cast (world/chars.js compose) |
| `shutter` | shutter shades | trait · rare | eyes · rare | rules.mjs:79–86 TRAITS | reused: cut from the cast (world/chars.js compose) |
| `cursorshades` | cursor shades | trait · rare | eyes · rare | rules.mjs:79–86 TRAITS | reused: cut from the cast (world/chars.js compose) |
| `tee` | graphic tee | trait · common | top · common | rules.mjs:79–86 TRAITS | reused: cut from the cast (world/chars.js compose) |
| `hoodie` | box-logo hoodie | trait · common | top · common | rules.mjs:79–86 TRAITS | reused: cut from the cast (world/chars.js compose) |
| `tank` | ribbed tank | trait · common | top · common | rules.mjs:79–86 TRAITS | reused: cut from the cast (world/chars.js compose) |
| `flannel` | flannel | trait · common | top · common | rules.mjs:79–86 TRAITS | reused: cut from the cast (world/chars.js compose) |
| `jersey` | 56K jersey | trait · common | top · common | rules.mjs:79–86 TRAITS | reused: cut from the cast (world/chars.js compose) |
| `varsity` | varsity | trait · rare | top · rare | rules.mjs:79–86 TRAITS | reused: cut from the cast (world/chars.js compose) |
| `velour` | velour tracksuit top | trait · rare | top · rare | rules.mjs:79–86 TRAITS | reused: cut from the cast (world/chars.js compose) |
| `puffer` | puffer | trait · rare | top · rare | rules.mjs:79–86 TRAITS | reused: cut from the cast (world/chars.js compose) |
| `bsodtee` | bsod tee | trait · epic | top · epic | rules.mjs:79–86 TRAITS | reused: cut from the cast (world/chars.js compose) |
| `slides` | slides + socks | trait · common | feet · common | rules.mjs:79–86 TRAITS | reused: cut from the cast (world/chars.js compose) |
| `dad` | dad shoes | trait · common | feet · common | rules.mjs:79–86 TRAITS | reused: cut from the cast (world/chars.js compose) |
| `checker` | checker slip-ons | trait · common | feet · common | rules.mjs:79–86 TRAITS | reused: cut from the cast (world/chars.js compose) |
| `boots` | work boots | trait · common | feet · common | rules.mjs:79–86 TRAITS | reused: cut from the cast (world/chars.js compose) |
| `hightop` | cursor high-tops | trait · rare | feet · rare | rules.mjs:79–86 TRAITS | reused: cut from the cast (world/chars.js compose) |
| `foam` | foam runners | trait · rare | feet · rare | rules.mjs:79–86 TRAITS | reused: cut from the cast (world/chars.js compose) |
| `platinum` | platinum high-tops | trait · grail | feet · grail | rules.mjs:79–86 TRAITS | reused: cut from the cast (world/chars.js compose) |
| `watch` | Iced watch | trait · epic | wrist · epic | rules.mjs:79–86 TRAITS | new (the cast draws it as a 4-voxel band) |
| `crossbody` | Crossbody bag | trait · common | bag · common | rules.mjs:79–86 TRAITS | new (the cast draws it as a strap across the chest) |
| `duffel` | Duffel bag | trait · rare | bag · rare | rules.mjs:79–86 TRAITS | new, after world/cast/fresh/held.js cash_duffel |
| `unknown` | Unknown item | fallback | a key the atlas has no icon for | — | new |

`rules.mjs` lines are as of 2026-10-07 (`TRAITS` copied into `tools/traits.js`). Keys the atlas lacks fall back to `unknown`; aliases in
`icons.js` (`cr`, `credits` → cash; `cctv` → camera).

## Making and using
- `node style/city/ui/icons/tools/bake-icons.mjs [--sheet]` renders `atlas/icons.png` (64 px cells), `atlas/icons@2x.png` (128 px) and
  `atlas/icons.json`; `--sheet` also writes the contact sheets to `shots/human-layer/icons/`. **A new item = one entry in `models.js`
  (or a trait id in `tools/traits.js`) + a re-bake.** `tools/bake.html?only=key,key&big=1` shows a few in the browser.
- The look: the city's corner AO and light (STYLE.md §3: sun `#FFF2DC` 3.0, hemisphere `#D6ECFF`/`#E0CFB0` 1.05, a sky environment,
  NeutralToneMapping), a 34° / 30° three-quarter view (head pieces 26° / 12°), transparent, cropped and fitted per cell, an ink
  `#17171B` outline (2 px at 1×) and a thin cream halo outside it (1 px, 55%) so dark things keep an edge on a dark panel.
- `icons.js`: `iconFor(key, { size })` → a CSS-sprite `<span class="k-ico">`; `slot()`, `slots()`, `groupStacks()` → the inventory
  grid (one slot per item: the sim's stacks of one item merged, count, average quality, flags, the name on hover). `icons.css` styles
  slots with the kit's tokens only, per skin.

## Taste calls for slime
- **Outlines.** STYLE.md §8 bans outlines in the *city*; these are UI icons, drawn with an ink outline as asked. One constant in
  `tools/bake.js` (`OUT1`, `HALO1`) to thin or drop them.
- **The gun** is drawn: the sim's `gun` is crafted from pipe + spring + grip, so it is a scrap pipe gun (taped grip, the spring showing).
  The cast's own held items avoid firearms.
- **Product** stays invented: temp a zip baggie of red-hot crystals, hallu a purple dropper, sudo a black jar with a `>_` label, truth
  a blister card with a check mark, clear an ice-clear vial, firewall a pill tin whose lid is a brick wall.
- **Trait colours.** The cast draws traits in their default colourways; where that is near-black (hoodie, tee, fitted, durag, crossbody)
  the icon takes a house colour, and the remaining blacks are lifted to charcoal (a black shape inside an ink outline reads as a hole).
  The city doesn't draw the sim's traits on walkers yet (`simstate/adapter.js`: the fresh cast has other ids), so nothing contradicts them.
- **Hats** are the weakest group: cut off the head they are shells; the flaps and tails below the band are dropped and the shell
  closed. The durag reads as a cushion.

## Follow-ups
- The tape's deal chips (`ui/tape/bubbles.js`) can take `iconFor(e.item)` beside the text: not done here.
- Traits as the fresh cast draws them, once `simstate/adapter.js` maps the sim's ids onto it (re-cut them from `world/cast/`).
- `lot.gear` (stove, rig) and the stash's items show when the source carries them; the recorded run has neither.
