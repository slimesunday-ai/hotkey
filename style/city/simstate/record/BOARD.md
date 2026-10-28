# C1-10: board and morning-card selectors

```js
import { boardAt } from './board-data.js';
import { cardsAt } from './cards.js';
const values = boardAt(sim.record());
const cards = cardsAt(sim.record());
const pastCards = cardsAt(sim.record(), night);
```

Both accept the presented C1-2 snapshot and optionally its current island minute
(`boardAt(snapshot, minute)`, `cardsAt(snapshot, night, minute)`). They reject a
snapshot from the future. Use player seeking to rewind; neither selector seeks
inside an archive or replaces the player's clock. C1-2 holds night frames to
21:05 and owns `revealIds`; these selectors respect that presented prefix.
C1-6 remains responsible for finer scene-by-scene board releases.

`boardAt` returns `{frame, minute, clock, list, sales, fits, grails, corners,
police, tonight, wanted, bounties, vault, crate, nextShipment, countdowns,
cards, sources}`. The `sources` map names every feed path. `frame` is the
as-of frame: its board can be retained from an earlier frame.

| Values | Source and drawing contract |
|---|---|
| `list`, `sales` | Complete `board.list` and `board.sales`, in feed order. Prices, floors, last paid, opens, copies left and every dawn sale stay verbatim. No deduplication by buyer/trait: two such sales can be real. No sale supplies a copy id. |
| `fits` | `{agent,fit,fitHidden}` from each `board.agents` row. A hidden fit remains null, even when delayed wear/holdings receipts exist. |
| `grails` | List rows whose typed tier is `grail`, plus `wearers:[{agent,piece}]` from visible fits and `buyers:[sale]` from public sales, matched by trait. These are wearers and historical buyers, never inferred current holders. |
| `corners` | `board.corners`, including typed place, holder and hot flag. C1-3's `CORNERS` maps these ids to the drawing. |
| `police`, `tonight` | `board.police` and `board.tonight` unchanged, keyed by core district. Use C1-3's `DISTRICTS` for map anchors. No heat arithmetic or predicted police level. |
| `wanted` | `{agent,heat,wanted}` for each board agent already marked wanted. `heat` is the exact star count, with no local threshold. Portrait identity comes from that board id. |
| `bounties` | `board.bounties`, allowing only `bounty,copy,trait,slot,tier,agent,amount`. No event join, poster, expiry, reward computation or correlation with a card. |
| `vault`, `crate` | `board.vault` (pieces/cash), `board.crate` (cash/goods), including null crate. No goods valuation. |
| `nextShipment` | `board.nextShipment:{night}` or null, from the presented board at or before the current minute. The night only; crate contents still come from `board.crate` at their posted morning. |
| `clock`, `countdowns` | Existing `islandClock(player.minute)`. Lock: today's 21:00 civil island minute and nonnegative minutes remaining, zero after lock; null before setup/after `over`. Ferry: exact `frame.nightsLeft`, retained until another frame; no inferred departure minute. |

`cardsAt` returns rank-ordered rows `{night,rank,kind,subjects:{agent,others},
masked,pieces,place,cash,pieceValue,value,valueBasis,replay:{night,eventId},
source:{eventId,path:'card'}}`. All picture fields come exclusively from the
enclosing event's typed `card`; kind selection, ranking and valuation belong to
C1-5. Zero candidates stays empty; no filler is made. Default night is
`snapshot.day - 1`, the latest morning, so a quiet morning shows no stale cards.
An explicit older night returns only cards disclosed by the current playhead.
Cards cannot appear before that night's 06:00 dawn. A source update from
`type:'card'` to a full receipt replaces the same feed id, keeping Replay stable.

Draw portraits from `subjects` only. A masked Took keeps `subjects.agent:null`,
including after disclosure. Never use the enclosing rob/burgle receipt to name
it. D6 replay names belong to C1-9's disclosed record, not the public picture.
Unknown piece traits/places stay null; do not borrow a buyer's play or position.
C1-5's current implementation/report controls attribution; its README still has
the earlier always-masked description. C1-10a changed no core file; C1-5c adds
the core announcement described below.

Feed item resolved, 2026-10-27: **`board.nextShipment:{night}|null`**. slime:
"go with our suggestions". The core announces the next shipment night that has
not run; tonight counts until its night runs, then the announcement advances,
and is null after the final shipment night. `boardAt` reads that field verbatim
from the presented board, including retained boards. It copies no schedule or
cadence and reads no later arrival. Crate contents still wait for their morning.

`node style/city/tools/boardcheck.mjs` first runs five faulty selectors in child
processes, requiring property failures, then checks seeds 404–406. It compares
every frame, publication/show boundaries, dawn edges, reverse seeks, typed card
sources and privacy probes. See its stdout for measured counts.

Measured 2026-10-27, generated with
`node core/bench/runner.mjs --seed <s> --rule A --cast layer4 --feed --out core/runs`:

| Seed | Frames | Playback/reverse/prefix points | Distinct cards | Card forms | Masked forms |
|---|---:|---:|---:|---:|---:|
| 404 | 242 | 176 | 49 | 61 | 0 |
| 405 | 251 | 174 | 49 | 59 | 4 |
| 406 | 237 | 176 | 45 | 56 | 0 |

`SIM2="$PWD/sim2" node style/city/tools/boardcheck.mjs`: all five fault children
exit 1 for their intended properties, then all seeds PASS. Later-frame list
fails at seed 404 frame 0; private-event card at frame 19; bounty poster on the
explicit posting probe. Shipment look-ahead fails at seed 404 frame 0; a copied
core schedule fails on an irregular typed announcement at minute 1800. Synthetic
announcements also check future boundaries, reverse seeks, retained boards and
null/absent fields. Baseline seeds have no grail wearers/sales, hidden fits
or bounties, so synthetic public-shape probes cover those positively too.

The original C1-10a run of the same `SIM2` prefix with `recordcheck.mjs`, `placecheck.mjs`,
`routinecheck.mjs`, `clockcheck.mjs` and `robustcheck.mjs` passed, exit 0.
Robustcheck used its documented `THREE_DIR` override pointing to existing local
Three r185 modules (matching the page), avoiding a network download; 10 checks
passed. That run used no ports, browser, models, existing check edits, core source
edits or commits. C1-5c extends `boardcheck.mjs` for the new field under slime's go.
