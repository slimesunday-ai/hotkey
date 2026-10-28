# core/: the rules core

The game's rules as a small pure core that decides everything; the city only shows it (`docs/GAME.md` §22–§23). Layer 1,
"earn, buy, take, board" (§24): shifts, compute, the list, the eight districts and their police levels, hits, break-ins,
backing (both cut rules), laying low, heat, city cops, jail, the ferry with its routes, the mint, typed sit-downs and
crews; its brief is `docs/briefs/R1-rules-core.md`. Layer 2, "the street" (`docs/briefs/R1-layer2-street.md`): goods
and the city's markets (L2-1); the trades' night: runs, cooking, deals, builds, corners and flex (L2-2); gear, player cops
and shipments (L2-3); and the fence (L2-4). Layer 3, "dirty tricks" (`docs/briefs/R1-layer3-tricks.md`): tips and
bribes (L3-1); bounties and lookouts (L3-4); the drugs as goods, and taking them (L3-2); the mind drugs, TRUTH, HALLU
and SUDO (L3-3); and the fixes for the hiding places and cheap ways out a mechanics review found (L3-6), and for the drug
holes it found, with HALLU's lie pool (L3-7). Layer 4, "the big score" (`docs/briefs/R1-layer4-score.md`): forged
warrants and the vault job (L4-1); fakes and who can tell (L4-2); guards, and tips, bribes and the double-sell at the
vault (L4-3); and the layer-4 bench, the big score in play (L4-4).

## The two functions

- `applyErrand(state, errand) → { state, events, ok }`: a day input. Errands (§10) and typed sit-down messages (§14).
- `settleNight(state, plays) → { state, events, fights, plays }`: every play at once, in §5's order. Night 14 ends with the
  walk to the dock, the ferry and the mint (§15).

Both are pure: same input, same output, byte for byte. They never read the clock, randomness, coordinates or anything
outside `core/`. The seed only sets the drop's MOCK tiers (`rules/setup.mjs`) and the bots' choices (`bench/`).
`checkLedger(state)` checks that every trait copy has exactly one holder and that cash is conserved except at the named
sources and sinks; the bench calls it after every errand and every night.

| File | What |
|---|---|
| `rules/setup.mjs` | Day 0: the agents, the drop with MOCK tiers, §4's ten placeholder abilities |
| `rules/errand.mjs` | dress, offer, give, pay, bail, `rent` (pay for compute), shop and sell (the city's shop and buyer, §9; R4-3: orders by day, a shop order holding the most it pays), the fence (`fence_list`, `fence_unlist`, `fence_buy`, `fence_swap`, `fence_accept`; it takes no fakes), the crew (form, invite, join, leave, stash put/take), sit-downs (ask, answer, say, and R4-3's close: one open `sitdownDays` days unless either side closes it, a pair one at a time), crew chat and out loud (R2-1), the earpiece's listen, a tip (once a day) and a bribe (§13), each naming an agent, the crate or the vault (a bribe a corner too), a bounty and a lookout (§10), and taking a drug (§11), with FIREWALL keeping sit-downs, hand-overs, pays, swaps and crew invites away, TRUTH locking the play it names and no errand breaking it, HALLU's leads, and SUDO handed over as TEMP and its play written (`write`); goods move in give, the crew stash, sit-down terms and the fence's swaps |
| `rules/night.mjs` | the lock (the fence's deals land first, and R4-3's clearing: the city's shop and buyer fill the day's orders together, then a crash or a withdrawal forces the default play, then TRUTH's locked play, then SUDO's written play, then the plays are checked), the list, a rat (a right tip on the tipper's own crew), the fights' takes (pieces, cash, the goods carried tonight, the crate, and last the vault as it stood at the lock) and arrests (a collar's first, its Cop paid its stars out of the fine (R4-4), then the bounties pay, never to their posters; CLEAR's seize nothing; a seizure is public at dawn), lockpicks and warrants used up, and a double-sell when the vault's leaders used one maker's warrants, work (shifts, a Cop's patrol or guard, and the trades' night: the drops' split, cooking a named drug or TEMP (and HALLU's lies, the cook's own until day 15), a corner's sales, builds with their warrants and fakes, flex, never for a fake; R4-3's review: a cook or a build short because a shop order came back works with what its agent holds), heat, police levels and the city's prices easing back, a listing whose piece was taken or seized ending, dawn (buys arrive, the next shipment is posted, compute or an evicted agent's compute tab, and highs end, hooks and clean marks, tomorrow's crashes), the last night (every listing ends and the fence hands everything back first; the bounties still open are gone before the boarding), the tabs settled at the dock, and the mint (aboard, every fake exposed and gone) |
| `rules/fights.mjs` | the fight set computation (§8): where everyone is, which backs their leaders accepted (a play's `accept` list in its order, else its crewmates: a back nobody accepted does nothing, R4-2), which attacks find their target, cut backers, groups in the leader's order, group strengths (a gun +1, TEMP +1, knuckles +1 attacking, one lockpick +1 to a break-in), a home defended by everyone in it, a patrolling Cop's group on the defender's side; collars, grabs and the corners' fights (§9, §13); a right tip's city cops, its tipper spared only when its tip is what brought the cops, and a bribe that keeps every city cop out when it covers the hottest agent's stars on the briber's side (§13); the vault's one fight, last, against its flat defence, every guard's group and a right tip's +2, which a jobber's bribe keeps out (§13) |
| `rules/plays.mjs` | tonight's legal plays with their places (§33), the trades' plays (run, cook with its optional drug and HALLU's pool of lies, deal, build with its optional warrants and fake, patrol, guard, collar), the grab and the vault job among them, checking a play (any play but a back may name the backers it accepts, `accept`, R4-2), the default play, and what forces it: a crash or a withdrawal, TRUTH's locked play and SUDO's written play (§11), and what TRUTH can lock (R4-3's review: only on goods held, never on goods on order) |
| `rules/fence.mjs` | the fence (§9): its deals, a listed piece kept by its seller (gap.listed), a swap's halves and the cash it holds where the list holds offers (§22), every deal landing at the lock, a listing ended by a theft, night 14's hand-back, its ledger check and its board |
| `rules/deals.mjs` | R5-deals: a sit-down's deal (§10, §14), a typed fact the core owns. An `offer` of trade terms offers one (`buy` buys goods or a piece for cash, kept on the record as `trade`, its first name, which still reads the same; `sell` sells them; the latest stands), agreed once the other side offers the same terms back, in either form (R5-terms: a sell for a buy, or the very words repeated, which agree to the offer as its offerer made it; only open terms in that sit-down, and an agreed deal said again on its own terms stands), or hands over its own half: a deal takes both sides. Each `give` and `pay` between the two counts against it, the deal its `sitdown` names first, else the one whose terms it matches (the seller's goods or piece, the buyer's cash, and either handed back; never a cut or a gift; a SUDO as the TEMP it arrives as). Only an agreed deal is owed. Both sides see it in their own view (`me.deals`) until it settles, after its sit-down too; an offer nobody agreed to, and a deal nothing was handed over against, end with the sit-down; CLEAR keeps it. Nothing moves by itself |
| `rules/market.mjs` | the money curves as pure functions (§9, §26): the city's shop and buyer by step count, a corner's takings and a drop's split (its leftovers going round by night, R4-2), and (R4-3) a day's clearing on one curve: one price a unit for every order, the odd dollars going round by night, the shop's orders filling by their limit, highest first, a limit level that can't fill passed over (R4-3's review); in exact whole-number arithmetic |
| `rules/view.mjs` | views per audience: agent (= owner), ownerAI (typed facts only: no `line`, `reason` or crew names), public, and record (the 24-hour record: the board and everything that has gone public, from day 0); each agent's walk on the board, what CLEAR wipes from its own view, TRUTH's play verified to whoever sits down with its taker, SUDO read as TEMP by the agent sold it, and who can tell a fake: shades, about what other agents wear, and its maker; R5-terms: a promise as its own record stands (open, a cut owed with the dawn it counts as walked out on, or paid), on the seat's state and on the message that made it |
| `rules/ledger.mjs` | the ledger, and the cash and goods checks, with the cash held for bounties, HALLU's lots, SUDO's marks and the warrants' makers, and fakes outside their traits' copies |
| `rules/state.mjs` | places, the record's `emit`, the one way a copy moves, §4's "rarest piece" (never a fake) and a fake's missing ability, an agent's holdings (the 24-hour record's, and a lookout's), where a crew stash is kept and the stash that travels with its keeper, the goods with the six drugs and forged warrants (HALLU's lots, SUDO's marks and the warrants' makers move and lapse with them), and an agent's walk, and (R5-terms) where a promise stands, which the walk at dawn and every view read |
| `numbers.mjs` | every number, marked RULE, GUESS (§38) or GAP (GAME.md gives no answer) |
| `data/items.json` | the items, copied from ai-city-fresh by `tools/snapshot-items.mjs` |
| `tools/numbers-md.mjs` | writes `reports/NUMBERS.md` from `numbers.mjs`; run it after any change there |
| `bench/` | the $0 bench (§25): the scripted bots (`bots.mjs`), one season (`runner.mjs`, with model seats too, R2-8), many seasons (`bench.mjs`), §27's pass bars (`passbars.mjs`: every bar, its §27 line quoted above its code, one reading each, and its verdict across seasons; R4-11), the report's other numbers (`metrics.mjs`) and the reports, which only format (`report.mjs`) |
| `agents/` | R2, the local-model players (`docs/briefs/R2-agents.md`): the handles (`handles.mjs`: every piece a player reads is named by a handle good for one briefing, never a copy id); the tools (`tools.mjs`: one typed action table for seats and owners' AIs, the menu of tonight's plays, typed failures, and the reply format); the briefing (`briefing.mjs`: what one call reads, a stable header the model server caches (the rules in brief, read from `numbers.mjs`; since R3-3 what a hit and a break-in take, a tie, and jail at the ferry follow their switches), then the day as a short story from public facts and the 24-hour record, other agents' words only inside a quoted in-game speech block, and the menu, inside `gap.briefing`, headed, when the caller says, by which call it is: by day a play sent becomes tonight's pick, at the lock errands are refused); the model seat (`seat.mjs`: one call a briefing in and one JSON reply out, a window and one retry, then tonight's pick, standing orders or the default play, at most `callCeiling` calls a day, and a tape of every call); the fake's hooks (`fake-hooks.mjs`: a seat's own bot speaking through the reply format, and the format faults); and the fake model (`fake-model.mjs`, $0), a stand-in for the local model's chat endpoint, in-process or on 127.0.0.1 at a port the system picks, answering from a script or a tape, keyed by seat and call number; and the paid endpoint (`openrouter.mjs`, R2-12: the key added to each request as it goes out, OpenRouter's body fields, the spend tally and its cap, the 429 waits and the preflight), with its fake (`fake-openrouter.mjs`, $0), which answers around the fake model as OpenRouter does |

## The record

Every event is typed and carries its visibility from the moment it happens (§19): `vis.to` is `'all'` (public now) or
the agents who see it live (and their owners), and `vis.pub` is when everyone sees it. Time is in half-days: day `d` is
`2d`, the night after it `2d + 1`, and "24 hours later" is `+2`. The last night's private record is public on day 15.

The city's input is **`feed.jsonl`**, written beside the private `events.jsonl` by
`node core/bench/runner.mjs --seed 404 --rule A --cast layer4 --feed --out tmp/season`.
`core/feed.mjs` owns this shape. It samples `viewFor(state, log, null, 'record')`: the public board and the entire
disclosed record, with no recent-events window and no seat's `me` or legal-action projections. It selects and
renumbers; it computes no game fact and changes no visibility. Each JSON line is a frame:

| Field | Meaning |
|---|---|
| `i` | Contiguous frame index, starting at 0; private steps consume no index. |
| `t` | The view's core half-day. |
| `step` | `{kind:'setup'}`, `{kind:'errand',round:r}`, `{kind:'night'}` or `{kind:'dawn'}`. Round 0 is a dawn-time owner edit. |
| `minute` | Publication time, in nominal island minutes from day 0's midnight, US Eastern (`America/New_York`). |
| `board` | The complete view board, included initially and only when it changes; consumers retain the previous board otherwise. |
| `events` | Newly disclosed events and changed public forms of older events; an empty array is allowed when another public field changes. |
| `sightings` | The view's complete public sightings, replaced on each frame. |
| `day`, `nightsLeft`, `midseason`, `over` | Copied directly from the view. |

No step with an unchanged public projection writes a frame. Events retain their typed fields except global `n`,
which becomes feed-local `id` (contiguous from 0, allocated on first publication), and gain `minute`, the minute this
form was published. An updated form replaces the previous form under the same `id`; its publication minute advances.
`orders.of` references are mapped into that same id space, including references first published in the same frame.
Unpublished references are omitted entirely; when disclosed, they update the referring event. Neither `vis` nor the
global event sequence reaches the feed. Order, copy, sit-down and other game identities remain their typed identities.

The bench clock is deterministic civil island time, without a calendar date or DST conversion: day `d` starts at
`1440*d`; dawn is `+360` (06:00), the lock `+1260` (21:00), and the city's show starts at `+1265` (21:05).
With `R` errand rounds, round `r` is at `1440*d + 360 + floor(900*r/(R+1))`: the default three rounds are 09:45,
13:30 and 17:15. Setup is at the returned state's dawn (the bench starts ready for day 1). Baseline writes are
sampled as setup, dawn journals at dawn, owner Creed edits as round 0, and trade routines at their errand round.
The clock places the core's existing half-day disclosure boundaries; nominal round hours do not alter `vis.pub`.
There is an unresolved timing conflict with a literal elapsed 24 hours: a round-1 take at 09:45 (`minute=2025` on
day 1) has `t=2, pub=4`, so `viewFor` names its drug at day 2's 06:00 (`minute=3240`), only 1,215 minutes later.
The exporter preserves core visibility. Slime/core must choose whether half-day disclosure is the contract or whether
the core needs exact occurrence/publication minutes for events and memory snapshots; the latter changes who sees what
when and is outside this exporter. Night-14 disclosure on day 15 remains the explicit §19 exception.

`settleNight` also returns `beforeDawn: {state, eventCount}`: an independent snapshot and the prefix length of its
returned `events`. The night frame uses that snapshot and log prefix at the lock, after heat and tomorrow's police
levels, before dawn's buys and compute. Night 14's boundary follows boarding and precedes day 15's mint at 06:00.
The city holds night results until their show beats (§20); `minute` is publication time, not a cue to reveal them early.
The existing `robbed.vis.to` includes victims at night although §19 says dawn; the public record feed still waits for
its disclosure boundary. Changing the owner view's timing remains core work for slime, outside this exporter.

The private checkpoint saves the exporter's ids, last forms, board and metadata, together with the feed's committed
byte offset. `--resume` automatically continues a feed-enabled season, truncating any uncommitted or partial tail
before replaying the unfinished day. A missing/short committed prefix is refused; enabling a feed midway through a
season without a feed checkpoint is refused. `--replay ... --feed` can export a model season from its existing tape.
This closes the event-number side channel for the city's feed only; agents' tools still carry global `n`.

C1-5 adds two view projections; neither writes or alters a log event. `show.plays` sits beside the unchanged
`seen` and `hooded`: an agent-id map of `{kind, place, corner?, target?}` at the show. Only agents in `seen` occur.
`place` retains the resolved public district or `home`; `corner` identifies a Dealer's corner. The kind distinguishes
a run's drop, a forest cook's woods lab, a home cook/build/laylow, guard/vault at Precinct 9, and a night-14 route.
A back names its target only for a visible, non-attacking play. No reason, consent list, drug, lie, wanted piece,
warrant or fake is copied. The 24-hour `play` receipt still supplies the full disclosed record.

At dawn, up to five source receipts gain `card: {night, rank, kind, subjects:{agent,others}, masked, pieces,
place, cash, pieceValue, value, valueBasis}`. Kinds are `Took`, `Turned`, `Booked`, `Bought`, `Outbid`.
The highest value of each kind is picked first in that order; remaining places take the highest remaining value.
Ties retain receipt order. `value` is cash moved plus the pieces' copy-paid values, matching R3/R4's `pieceValue`;
unsold pieces and unsuccessful offers move zero value. Goods are not priced. Each piece names its trait and,
except for a list sale or an unsuccessful offer, its copy. Unknown places/traits are `null`, never guessed.
`subjects` are ids or `null`; a Took's agent always stays masked, and no card identifies an agent absent from that
show's `seen`. The enclosing source event is the replay anchor: use its feed-local `id` and `card.night`.
There are no nested event references to remap. A still-private source first appears as
`{id,t,day,type:'card',card,minute}`. At disclosure it is replaced by the full source under the same `id`, retaining
its safe card. The card's source `t` is occurrence time; its enclosing `minute` is publication time at dawn.
No candidates means no cards. See `reports/C1-5.md` for GAP choices and visibility questions left for slime.

Names reused from the old sim, where the meaning is the same (§22): `arrest`, `bail`, `bid`, `buy`, `burgle`, `cook`,
`craft`, `crew`, `decline`, `evicted`, `gather`, `give`, `invalid`, `refund`, `release`, `rob`, `sale`, `say`, `stash`,
`turf`, `wear`. New: `season`, `play`, `show`, `fight` (a hit, a break-in or a corner's), `robbed`, `heat`, `police`,
`work` (the shift wage), `flex`, `price` (a list price, or the city's with `side` and `item`), `rent`, `pay`, `shop`,
`sell` (R4-3: what an order got at the lock, its agent's own until dawn), `order` (R4-3: `place`, and `back` for a shop
order whose max, with it in, the day's price passed), `ask`, `meet` (R4-3: on each day both of them act in the
sit-down), `close` (R4-3: a sit-down closed, or past its last day), `overheard`, `betray` (walk, rug, turn, rat,
double-sell: one event per act, with a receipt to every betrayed agent), `guard` (a Cop's wage at the vault),
`holdings`, `board`, `missed`, `mint`, `gone`, `rollover`, `tab` (a compute tab settled at the dock, `gap.rentTab`), `bounty`
(post, paid, collected, gone), `look` (a lookout's), `seized` (an arrest's piece and fine, and since R4-4 its `vault`,
the part of the fine that went into the vault), `take`, `high`, `crash`, `hooked`, `clean`, `forced`, `write`, `lies`
(the drugs, below), `fake` (a fake `made`, its maker's own until day 15, and `exposed` at the ferry, public),
`season_end`, `chat` and `outloud` (talk on the record, below).

The street's events (layer 2): `gather` (a Smuggler's haul at a drop), `cook`, `sale` (a Dealer's night on a corner),
`craft` (a Gunrunner's builds) and `flex` are the agent's now and everyone's 24 hours later; `turf` (a corner changes
hands), `price` and the corners on the board are public live. Goods ride along as a `goods` field on `give`, `stash`,
`rob`, `robbed`, `betray` (a rug) and the ferry's events only when goods moved, so layer 1's events are unchanged there;
`holdings` always carry them.

Gear, player cops and shipments (L2-3): `patrol` (a Cop's wage) and `collar` (its pay, $100 a star, out of the arrest's
fine since R4-4, with the `fine` it came from; gap.collarPay) are the Cop's own now and everyone's 24 hours later; an
`arrest` by a collar carries `by`; a `fight` carries `patrol` when a patrolling Cop's group joined it; `used` is a
lockpick used up in a break-in; `shipment` posts the crate (public, and the crate is on the board); `grab` is a won
grab, its group's own until the record. The fence (L2-4): `fence` events, with `act` one of `list`, `unlist`, `buy`,
`swap`, `accept`, `sold`, `bought`, `swapped`, `expired`, `returned` and `lost` (a listed piece taken or seized, which
ends its listing), go to the agents in the deal now and everyone 24 hours later; the board lists the fence's listings
live (the piece and the price, never the seller). A listed piece stays in its seller's stash (and on its `holdings`
record) until it sells, and every deal lands at the lock, so nothing the fence moves is out of reach of that night's
fights (gap.fence, gap.listed).

Tips and bribes (L3-1): `tip` and `bribe` are the agent's own now and everyone's 24 hours later; a `fight` carries
`tipped` when a right tip named it, never who tipped, and a bribe shows only as no cops; a rat is a `betray` with `kind`
`rat`, the rat's and its victims' now and everyone's 24 hours later. A bribe's cash leaves the island as the `bribe` sink.
A tip names an agent and its target (an agent, `crate` for the grab, or `vault` for the vault job); a bribe names a fight
by its target (an agent, `crate`, `vault` or a corner) (gap.tip, gap.bribe).

Bounties and lookouts (L3-4): a `bounty` errand names one piece (`copy`) or another agent (`agent`) and an `amount`. Its
cash is held in the offers as `{ by, bounty, amount }`, beside the list's offers and the fence's holds, and the board
lists every open bounty live (the piece or the agent, and the amount, never who posted it). It pays once, in step 3
after the takes and the won collars, all of it (no cut: a transfer, not a sink), to the first fight in the night's order
that earns it: the leader of a won hit or break-in that took its piece, or took a piece or cash from its agent (a
break-in on its home robs it, R4-4), or the Cop of a won collar on its agent, never its own poster and never one of the
target's crewmates. One nobody earned is gone with the ferry, before the boarding (the `bounty` sink). `bounty` events:
`post` is the poster's now; `paid` is the poster's, and never names the collector (so a masked robber stays masked);
`collected` is the collector's; `gone` is the poster's; each is everyone's 24 hours later. A `lookout` errand names
another agent and costs $50 (the `lookout` sink); its `look` event shows that agent's holdings record as it stands now,
its drugs as `doses`, the hirer's now and everyone's 24 hours later, and its target isn't told (gap.bounty,
gap.lookout).

The drugs (L3-2): every dose is one of the six drugs (slime, 10-15: "every dose is a real drug"), each its own goods
kind in §11's order: `temp`, `truth`, `hallu`, `firewall`, `clear`, `sudo`. A Dealer's kit, a cook that names no drug
(a cook's optional `drug`, which the legal plays don't list) and night 11's crate are TEMP. The city's buyer keeps one
`doses` curve, the same price for every drug, and a `sell` of `doses` names its `drug` or sells TEMP; a corner pays the
same for each, and a Dealer carries its doses in §11's order up to its cap. A `take` errand names a drug the agent holds:
one dose of each drug a day, in jail too, and the dose leaves the island's goods as `taken`. A high lasts until dawn.
TEMP is +1 strength tonight and a crash the next night. FIREWALL keeps every sit-down with the agent, and every
hand-over, pay, swap and crew invite to it, away until dawn, with a reason that never names the drug. CLEAR makes an
arrest seize nothing (jail clears its stars as ever), and the agent's own view loses its private events from before the
take until they go public, and today's sit-down words before it. The same drug three days running hooks the agent on it;
a crash, or a night without a drug it's hooked on (a withdrawal), forces the default play at the lock, after jail and
before its own play, as a `forced` event, never an `invalid` one; three dawns without any drug, jail days included, end
every hook with a public `clean` mark. The board shows each agent's `walk` (wired for TEMP and SUDO, spaced for HALLU and
CLEAR, guarded for FIREWALL, none for TRUTH), hidden by shades; a public `high` event carries only the walk, when a take
changes it. `take`, `crash`, `hooked` and `forced` are the agent's own now and everyone's 24 hours later, and live, a
drug shows only as `doses` to anyone it doesn't involve: views show the board's crate, and an event public at once (a
shipment, a missed ferry) in its first 24 hours (to day 15 for the last night's), with its drugs as doses, while the log
keeps the drug and a private event's agents see it. So a drug's name never shows live (walks, gap.doses, gap.take,
gap.high, gap.temp, gap.forced, gap.firewall, gap.clear, gap.hooked).

The mind drugs (L3-3). At the lock, after jail and a crash or a withdrawal, TRUTH's locked play comes, then SUDO's
written play, then the agent's own; each is a `forced` event (why `truth` or `sudo`), and one that no longer works gives
way to the default play (gap.forced).
- TRUTH: the `take` names the play it locks (`play`), one of tonight's legal plays once the dose is taken: crashing or
  in withdrawal only the forced play, in jail none. Until dawn no errand of its taker's may make it impossible, and it's
  the agent's one legal play, and everyone it sits down with sees it on that sit-down, as `verified` (the plan card is
  R2's: call 3). The take event names the drug, never the play, so a locked hit's attacker stays hooded (gap.truth).
- HALLU: a HALLU cook writes a pool of typed lies, at least two (`lies`: `cash`, `stash` or `tip`, each with an `agent`
  and a `value`), and its doses are one lot that carries them wherever its HALLU goes, oldest first, each dose the next
  two lies in turn; the lies are the cook's own until day 15, on a `lies` event; the fence takes no HALLU. A take's
  event carries three `leads`, sorted: the dose's two lies and one true lead, the first fact the taker hasn't had from a
  true lead or a lookout: tonight's tips naming it, then each other agent's cash and then its stash, richest first. The
  taker's own now, everyone's 24 hours later (gap.hallu).
- SUDO: nobody takes it on purpose. A `give` of SUDO arrives as TEMP, carrying the giver's mark (booked as the
  `disguise`), and a mark lapses once the agent holds fewer TEMP than marks (call 2). A TEMP taken with a mark is SUDO:
  no +1, no crash, and the take event names its `writer`, who sees it at once and may `write` the taker's play by the
  lock, its own until tonight's plays go public; the written play carries no reason. SUDO can't keep anyone off the
  ferry, so no write goes through from day nights − jailNights on, and FIREWALL keeps the con out: on FIREWALL at the
  lock the taker's own play stands, though the write went through. The taker and its owner read the take as TEMP until
  the night settles, and the hand-over until it goes public: its highs, walk and legal plays stay TEMP's, and a hook on
  TEMP is fed (gap.sudo, gap.firewall).

Forged warrants and the vault job (L4-1):
- A warrant is goods (`warrants`). A Gunrunner builds one at home as an optional `warrants` field of `build` (4 parts,
  one a night, inside its 4 parts a night), which the legal plays don't list. The city's shop and buyer don't trade
  them, and a hit never takes one. Each carries its maker, oldest first, as HALLU's lots carry their lies; a fence swap
  drops the mark. A `craft` event shows `warrants` only when one was built (gap.warrants).
- A `vault` play is in Glasswall, legal while the agent holds a warrant at the lock, night 14 included. Every group
  jobbing it is in one fight, the last of the night, against `vault.defence` on every night: no city cops for a wanted
  jobber and no patrol, and §8's several-attackers rule decides it. Each leader uses a warrant, won or lost: a `used`
  event naming its `maker` (null with no mark), the leader's own now. The winner takes everything the vault held at the
  lock into its leader's bag: a `vault` event, the group's own now and everyone's 24 hours later (day 15 for night 14).
  Every member of a losing group is arrested, runners aside. Every member gets +2 stars; each group is one crime. The
  fight is public and jobbers aren't hooded; the board's vault stays live. On night 14 the group boards from the
  Glasswall route (gap.vault).

Fakes and who can tell (L4-2):
- A fake is a copy of a trait outside the trait's copies, numbered on from the drop (call 1; no player reads
  a copy id, since R2-3's handles name every piece a player reads). A Gunrunner builds one at home as an optional `fake` field of `build` naming one trait of
  the drop, which the legal plays don't list (3 parts, inside its 4 parts a night, one a night). It lands unworn in its
  maker's stash. The `craft` event shows `fakes: 1`, as any build is shown; which piece it is goes on a `fake` event
  (act `made`), its maker's own until day 15, and on no play on the record (gap.fakes).
- A fake has no ability and earns no flex (call 2), and no take, arrest or computelord counts it as the rarest piece, so a
  bounty on one never pays. Holdings, looks, hand-overs, the crew stash and the board show it as real.
- Who can tell, when the view is built: an agent in real shades, about the pieces other agents wear on the board; its
  maker, wherever its view lists it (both marked `fake`); the fence, which takes none, listed or put up in a swap ('the
  fence takes no fakes'), told only to the agent that put it up until day 15; and everyone at the ferry, where each fake
  aboard is exposed (a public `fake` event, act `exposed`) and gone. One that misses the boat is gone with the rest.

Guards, and tips, bribes and the double-sell at the vault (L4-3):
- A `guard` play is a Cop's, at the vault in Glasswall, on any night but night 14, wanted or not. The Cop's group adds its
  strength to the vault fight's defence unless a hit or a collar found the Cop tonight; it joins no other fight, and
  patrols still don't join the vault's (call 4). It's paid `copPay.guard` (doubled on Payday) on a `guard` event, its own
  now and everyone's 24 hours later, as a patrol's wage is; it's work, so flex pays, and it's a cop on duty, so a hit on
  it that loses is an arrest. The vault fight shows the guards' strength as `guard`, as a fight shows a patrol's, never
  who (gap.guard).
- A tip and a bribe can name `vault` (call 6). A right tip, naming a jobber who leads or arrives, adds the city cops' +2
  to the vault's flat defence, except in a lawless Glasswall; a jobber's bribe, checked as everywhere, keeps out only
  that +2. Every loser of a vault job is arrested, so a tipper in the job is never spared (slime, 10-15), and a tip on a
  job the tipper's crewmates are in is a rat, whether or not it joins (gap.tip, gap.bribe).
- A double-sell: tonight's vault groups whose leaders' warrants share a maker, when those leaders aren't all in one crew.
  One `betray` event, kind `double-sell`, by the maker, whose victims are those leaders, in step 3 after the warrants'
  `used` events: the maker's and its victims' now, everyone's 24 hours later (gap.doubleSell).

The mechanics review's fixes (L3-6, 10-15):
- A bounty is no safe: one nobody earned is gone with the ferry, so posting one spends the cash (gap.bounty).
- The squatter's homeless stash: a crew stash is kept at a member's home whenever one has a home, so its keeper is
  re-homed when it's evicted, when a member pays its compute and when one joins. One with no member's home travels with
  its keeper, so a hit (`gap.evictedHit` is now 'carried': everything an evicted agent carries, worn or bagged), an
  arrest and the walk to the dock reach it as they reach what the keeper carries. A break-in reaches an evicted guest's
  pieces, worn or bagged, half its cash and a stash that travels with it, and the guest learns who at dawn
  (gap.crewStash, gap.evictedHit).
- No bribe by proxy: a bribe is checked at the lock against the hottest agent on the briber's side; one paid at a lower
  price than that agent's stars cost is spent and keeps no cops out (gap.bribe).
- No bounty farming: a bounty on an agent pays only for a fight that took a piece or cash from it, and no bounty pays
  the target's crewmates (gap.bounty).
- Tip immunity (slime, 10-15: "a tipper is spared only when its tip is what brought the cops"): a tipper is spared only
  when, without the night's right tips on that fight, no cop, city or player, would be in it. The rat is unchanged
  (gap.tip).

The mechanics review's drug fixes, and HALLU's lie pool (L3-7, 10-15):
- HALLU's lies stay the cook's: no play carries them on the record, forced, written or verified; a `lies` event does,
  the cook's own until day 15 (gap.hallu).
- HALLU's lie pool (slime, 10-15: "Let the Chemist write as many lies as it likes, at least two, and each dose takes the
  next two in turn"): each dose of a lot takes the next two lies, wrapping round; two lies work as before (gap.hallu).
- TRUTH is a real lock: crashing or in withdrawal it locks only the forced play, in jail nothing, and until dawn its
  taker can't hand away, sell, stash or swap what the play needs, or take the last dose a deal needs (gap.truth).
- CLEAR (call 5 revised): CLEAR leaves heat alone, so jail clears it as usual. An arrest is public at the show, and its
  seizure (`seized`: the piece and the fine) the arrested agent's own until dawn, so nothing at the show reads as CLEAR
  (gap.clear).
- A lookout shows drugs as `doses` (gap.lookout), and a play SUDO wrote is never a betrayal (gap.sudo).
- A bounty never pays its own poster, even through a staged hit on a friend (gap.bounty).

`holdings` is the 24-hour record of stashes and cash (§19): at every dawn, one per agent with its cash, its unworn
pieces, its goods and, for a crew stash's keeper, the crew stash. The agent sees it now; everyone sees it 24 hours later.

Talk on the record (R2-1): `outloud` (a threat, a boast or an offer, a sit-down's terms and one line, `outLoud` a day
each) is public at once and on the board (`outloud`) for the day; `chat` (a sit-down's message to the whole crew, one of
the day's messages) is the crew's now, a member on FIREWALL aside, and everyone's 24 hours later. A play may carry its
`origin` (`model`, `orders` or `default`), kept only when it's sent and valid: on the `play` event when that play is
played, else on the typed play an `invalid` or `forced` event keeps. A bot's play carries none (gap.outloud, gap.chat,
gap.origin).

Only `line` (a sit-down message, crew chat or out loud), `reason` (a play) and a crew's name carry words an agent
wrote. Every other field is typed (an id, a place, a number or an enum), and an owner's AI never gets the free text
(§18).

## Running

- The tests: `node --test 'core/test/*.test.mjs'` (on Node 22 a folder argument doesn't work).
- One season: `node core/bench/runner.mjs --seed 404 --rule A` (writes `core/runs/404-A/`: the event log, a checkpoint
  every night, `result.json` and the one-page `report.md`). `--resume` continues a killed run to the same log.
- The bench: `node core/bench/bench.mjs --seeds 404-423 --rules A,B --out core/runs/bench`, then `SUMMARY.md` there.
  Every bar it scores is `core/bench/passbars.mjs`'s (R4-11, design (b) of `docs/redesign/gates-20261017.md`; the note
  is `docs/redesign/gates-20261017-b.md`): one module, each bar with its §27 line quoted above its code and one reading,
  the orchestrator's calls of 10-17. A "median X" is one seat (the lower middle one with an even count); a trade's
  seats are the seats that play it (its bots, and a model seat by its trade); stolen value is every take by crime, each
  piece at its copy's own first sale and goods at the city's opening prices; the money bar is computed once, by haul,
  with income as a shadow; and §27's 90%, 30% and half are shares of distinct seasons, the verdicts the summary gives.
  `metrics.mjs` reads the report's other numbers and `report.mjs` only formats. `bars.mjs` scores every season of a run
  again from its own record, so an older run reads as today's bars do.
- A model season (R2-8, `docs/briefs/R2-agents.md` task 8): `--cast models --model-seats N` is the layer4 cast with N
  seats played by a model, which until slime answers Q4 are seats of the trade bots and §25's strategies, never a crew
  member or a shift worker; the seed picks which. On the board every bot's driver reads `bot` and a model seat's its
  model's name (Q5), so the Cop bots follow the lowest-id Cop. Bots and model seats play one season loop
  (`seasonSteps` in `runner.mjs`): `runSeason()` drives it synchronously for the bot casts, and `runModelSeason()`
  awaits the model seats' calls. A model seat is called in round 1, in a later round only when a sit-down waits for it,
  and at the lock, where the calls go out together, each reading its own view of one state, at most
  `--model-concurrency` at once (8, as oMLX takes). Each call is the briefing (`agents/briefing.mjs`, told whether it's
  a day's call or the lock's) through the seat (`agents/seat.mjs`).
  - With no `--model-url` the model is the fake, at $0: each model seat's own bot answers through the reply format, on
    a clock that never waits. `node core/bench/bench.mjs --seeds 404-423 --rules A,B --cast models --model-seats 4`
    plays 40 such seasons.
  - The run folder keeps the per-season secret the handles are dealt from and each seat's memo and record (in
    `checkpoint.json`'s `models`, never in the state or any view), and every call in `tape.jsonl`. With a real endpoint
    the secret is random; with the fake it's a hash of the seed and the rule, so a test season repeats.
  - `--resume` goes on from the last night's checkpoint and answers the calls already on the tape from it, so no call is
    made twice. `--replay <run folder> --out dir` plays a finished season again from its tape, with no model.
    `--stop-after N` stops at night N's checkpoint (a pilot).
  - A real endpoint is called only with `--model-url <url> --go "<slime's words>" --model <name>`; without the go the
    runner exits 2 and writes nothing, and the run folder keeps the url and every go. SIGINT or SIGTERM aborts the
    requests in flight and stops the run. `--thinking-seats N` turns thinking on for the first N model seats (Q3).
  - A paid endpoint (R2-12, `agents/openrouter.mjs`): `--model-key-file <path>`, with `--model-url` and `--max-cost
    <usd>`, sends the file's key, read once, only as a bearer header, added by the transport, so the seat, the tape, the
    checkpoint and the config never hold it; a resume needs the flag again. `--model-api openrouter` (which needs the
    key) sends OpenRouter's fields in place of the local model's chat template kwargs, with the same messages: a thinking
    seat `reasoning: { max_tokens: 1024 }` and `max_tokens: 6000`, the others `reasoning: { enabled: false }` and
    `max_tokens: 2000`, `usage: { include: true }`, and `provider` from `--model-provider '<json>'`. Before the first
    call it reads the account's balance and the key's limit left (two free GETs at the url's origin) and refuses to
    start below the cap. Every response's `usage.cost` counts, a cut-off's and an error body's too, and `spend.jsonl`
    keeps a record a request (each try of a 429, and a request cut off, count as calls); `[spend] $x of $cap · N calls`
    prints after each night and at the end, then the billed total by the key's usage. The season stops as on SIGINT,
    exit 3, once the spend reaches the cap, on a 402 or an error about credits, and on a 401 or a 403; `--resume` plays
    on and may raise `--max-cost`. A 429 waits 6, 12, then 18 s and asks again, up to 3 times, inside the seat's window.
    The run folder keeps the API, the provider and the cap, so a resume or a replay builds the same body; a replay needs
    no key.
  - `--briefing legacy` (default `current`) briefs every model seat with `bench/fixtures/legacy-briefing.mjs`, all else unchanged; the run folder keeps the arm, and no resume, replay, twin pair or bar mixes arms.
  - A mixed season (R7): `--seat-models '<json>'`, a list of groups `{"model", "seats", "thinking", "provider"}`, gives
    each model seat its own model, in place of `--model`, `--thinking-seats` and `--model-provider` (refused beside
    them). The groups' seats add up to `--model-seats`, which they set when it's left out; the seed deals them to the
    model seats (`dealSeatModels`, a stream of its own, so the cast is unchanged), and each seat is its model on the
    board and in every request, with its group's reasoning budget and only its group's provider routing (which a paid
    run sends only with `--model-api openrouter`). Every seat calls the one `--model-url` under the one `--max-cost` for
    the season; each `[spend]` line adds each model's spend so far. Without `--model-url` the fake answers every seat,
    $0. The checkpoint keeps the groups (`models.mixed`) and the deal (`models.seatOf`); a resume needs the same
    `--seat-models` and `--replay` needs none. `result.json`'s `byModel` and the report's "By model" table give a row a
    group: haul, cash and pieces; crimes led, tried and won; promises, hand-overs in a sit-down and betrayals (deals
    agreed and settled aren't measured: the core types no event for them); lookups run, inspects sent and used; refused
    actions by typed source; call points, requests, request size in characters and tokens; and the spend record's cost.
    A season of one model is unchanged. The dry run, then the paid one, a season a seed (418, then 419), each with its
    own cap of $7:

    ```
    SEATS='[{"model":"openai/gpt-6-luna","seats":2,"thinking":true},{"model":"google/gemini-3.1-flash-lite","seats":2,"thinking":false},{"model":"deepseek/deepseek-v4.1-flash","seats":2,"thinking":false,"provider":{"order":["<PROVIDER>"],"allow_fallbacks":false}},{"model":"anthropic/claude-sonnet-5.5","seats":1,"thinking":true},{"model":"openai/gpt-6.1-sol","seats":1,"thinking":true}]'
    node core/bench/runner.mjs --seed 418 --rule A --cast models-canny --seat-models "$SEATS" --out core/runs/mixed-dry
    node core/bench/runner.mjs --seed 418 --rule A --cast models-canny --seat-models "$SEATS" \
      --model-url https://openrouter.ai/api/v1/chat/completions --model-api openrouter \
      --model-key-file <key file> --max-cost 7 --go "<slime's words>" --out core/runs/mixed-paid
    ```
- The cast: `--cast trades` (the default, L2-6, "every seat trades") is layer 2's 30 seats, seed by seed, each with a
  trade (GAME.md §9: every agent picks one on day 0 and starts with its kit). Each trade's own bot and the Cop seat play
  as in layer 2. The 3 shift workers are §27's yardstick and still work shifts every night: they're Cops on paper, the
  one trade outside the goods chain, so no seller waits on them. The other 14 seats keep §25's strategies and work the
  trade they drew on any night the strategy leaves free (`works` in the cast): the buy-late savers save and buy late,
  the turtles lay low once they hold a rare, the scouts and the guesser rob, and the crews do their jobs. GAME.md gives
  no split, so it's even: the seed deals those 14 the trades that fill each to six of the 30 (6 Smugglers, 6 Chemists,
  6 Dealers, 6 Gunrunners and 6 Cops, 3 of them the shift workers). By day such a seat pays for goods that arrived
  first, keeps its strategy's errands, and adds its trade's; it buys no goods for a night its strategy has taken.
  In this cast every bot also has three habits a sensible player has (L2-6b, `HABITS` in `bots.mjs`):
  - compute first (§10): a seat that can see its cash won't cover the compute due at dawn sells the city's buyer just enough
    of what its trade sells (a Smuggler's haul, a Chemist's doses, never what it works with) in the day's last round,
    and a cook or a build that would still leave it short gives way to a shift. A Smuggler always runs a drop, so it
    covers the compute by day only, and pays its way home only when it can cover the next dawn's compute too. A strategy
    that has taken the night keeps it: a crew's job, a robber's hit, the turtle lying low once it holds a rare;
  - corners (§9): Dealers short of a corner go by the street's pecking order, read off the board: in id order, each
    takes the best open corner left that it can work, so no two tie on one corner and follow each other to the next;
  - guns (§9): a Gunrunner keeps one gun unsold and builds another only once it sells, orders only the parts for it,
    past it sells its parts and works a shift, and builds its own gun rather than buy one.
  Its Cops (L2-6c, `policePlan` in `bots.mjs`) play their collars from public facts, so every seat that works the Cop
  trade reaches the same plan (§8, §13):
  - where: a wanted agent at home, unless the show saw it out last night while it was already wanted; at 4 stars,
    always home;
  - one collar: the Cop seat's, else the lowest id's, backed by the fewest Cops it takes and one more (`COLLAR`); the
    Cops are those whose last public night was Cop work, and the rest patrol;
  - when: only when the group beats the defence it reckons: 1 for the lock and 1 for the target, +1 for a gun its
    holdings 24 hours ago show, +1 laying low, and whoever backed it on its last public night;
  - a gun: the Cop seat keeps a gun's price back from the list until it's armed, and keeps back only tonight's compute
    to buy one.
  And four more habits (L2-6d, `CLOSE` and the L2-6d section in `bots.mjs`), each from the seat's own view:
  - bail before the ferry (§13, §15): a seat whose jail would still hold it when the ferry leaves pays its bail on the
    first day its cash covers it, its own or, for the rest, the crew stash's (never all of it). Before, the bots bailed
    themselves out only through day 12. Since R3-3 jail ends at dawn on day 14 (`gap.ferryJail` 'released'), so no
    jail holds a seat at the ferry and it pays no such bail: one would buy only night 13 (`HANDBACK-3.md`);
  - spend down (§3): from the list's last two days a seat keeps back what it still needs (the compute to the ferry and its
    tab, a night's goods, what it owes, its bail reserve) and, on the list's last day, offers on every trait it wants and
    can afford with the rest, the rarest first, a slot once: a piece for a slot it holds nothing in, or only something
    less rare; that day and the next it buys such a piece at the fence under the list's price. The buy-late saver
    spends down on the last day too, and never buys at the fence after it. The bail reserve is twice the bail at the
    stars it would carry, kept by a seat that's wanted, or that tonight's hot corner or crime would make wanted, while
    a collar can still keep it off the boat (an arrest fines half the cash it holds); it stays back from goods orders
    too, so a Dealer that can't keep it buys no doses for that corner and works a shift;
  - corners (§9): a Dealer that can see it would win a hot corner contests it: its own strength against the holder's
    group, the city cops and the patrols the record last showed there, from public facts; challengers go in id order,
    each to the weakest-held corner it would win that no lower id claimed;
  - the fence (§9): a spare piece (a second piece for a slot it wears or holds a better one in) goes where it pays: a
    swap that fills an empty slot on each side, offered by the lower id once both can see it, else a sale at once.
  The report adds the close: the cash that boarded unspent, the copies left on the list, and the bails paid out of a jail
  that would have outlasted the ferry.
  `--cast layer3` (L3-5, layer 3 in play; `DOSES` and the L3-5a section in `bots.mjs`) is the trades cast's seats and
  habits with the six drugs in play, and the tricks (below). The default stays `trades`, since `every-seat.test.mjs`
  pins it. The seed deals
  two roles from a stream of their own: one robber has a TEMP habit, and one seat that works the Chemist trade sells
  SUDO. Each seat acts from its own view:
  - Chemists cook all six to the demand they can see: a drug a buyer ordered and they couldn't hand over is that
    night's batch, unless another Chemist's public holdings show it; TEMP otherwise, for the Dealers. They sell in
    typed sit-downs ($15 a dose, as every good): the buyer asks, the Chemist answers, the buyer orders, the Chemist
    hands over what it holds or says it has none; the next morning it asks a buyer it couldn't serve, who answers and
    orders in one turn. The buyer pays on arrival, buys ahead what it will need, and keeps the TEMP it means to take out
    of its own trade's sales.
  - A HALLU cook writes two lies: the Chemist itself has no cash, and its richest rival Chemist has twice the most cash
    any public record shows.
  - The SUDO seller sells SUDO as TEMP to a buyer that doesn't deal doses (one that ordered TEMP, or that it saw walk
    wired), until the day writes stop, and writes that buyer's play: back the Chemist tonight, a bodyguard.
  - Takers, each for its reason: TEMP for a robber whose own strength can't win a fight tonight, when +1 finds one worth
    the dose and the crashed night (it then plays that hit), and for the habit robber whenever it holds one (a Dealer
    takes none: the crash costs a night on its corner); TRUTH, locking `back` when that's one of tonight's legal plays,
    for a crew member on a job day (the snake not on a night it means to turn) and for hired muscle; HALLU for a broke
    robber (it can't afford the cheapest piece on the list) strong enough to act on a lead, which then robs, counting
    each lead as what a break-in on its agent would bring; FIREWALL for a holder of an epic or a grail on each of the
    last three days, shades off; CLEAR for a wanted robber before a hit where cops could come (not a lawless district,
    or one the Cops patrolled on the latest public night), never counting on the stars it keeps through jail.
  - A bot that takes CLEAR forgets the day: its memory goes back to what it was at dawn, as its view does. Nobody sends a
    sit-down errand, a hand-over or a pay to a seat the board shows guarded, and a seat on FIREWALL sends no sit-down
    errand.
  Its report adds the drugs, from the record (so a SUDO dose counts as SUDO, as its reveal shows it): taken by drug and
  by bot; crashes, withdrawals, agents hooked and clean marks; the `taken` sink; the doses cooked by drug; SUDO's doses
  handed over, plays written and forced; TRUTH's locked plays; and §27's drug bar (every drug taken at least once a
  season, and someone hooked), with its pass rate in the summary.
  Its seats also play the tricks (L3-5b, `TRICKS` and the L3-5b section in `bots.mjs`), each from its own view and for
  its own gain, by the rules as L3-6 and L3-7 left them:
  - a tip is free, so a seat that expects a crew tonight (the counter-hit's reading: the crew's strikes keep a beat,
    tonight is the next, and its home or fit is the likely pick) tips the cops on the crew's leader, naming itself;
  - the rat: a crew member whose leader walked on it sits out that leader's next job, works its trade, takes no TRUTH
    for it, and tips the cops on it (the leader, at the target it reckons the leader will pick);
  - a scout whose best hit is in a heavy district bribes the precinct for that fight at its stars, when the target keeps
    a routine there (seen there on its last two sightings), its own group beats the target's public strength and any
    patrol seen there, and the take less the bribe beats a night's wage and its best hit elsewhere; it plays that hit;
  - a robber, or a crew's leader on a job day (from the crew stash when its own cash can't spare it), hires a lookout
    before a break-in or a hit on an evicted agent worth more than the look, once a day, and values the job by the look.
    Without one, a robber counts an evicted agent's bag and cash at `TRICKS.stale`: the record is a day late, and L3-6's
    hit takes everything it carries;
  - a seat robbed by an agent it saw puts a bounty on it, `TRICKS.bounty` of what the theft took, out of what it would
    spend on the list, when that's at least a night's wage. Robbers count the bounties on an agent in a fight that takes
    something from it, never their own, and the Cops add them to a collar's pay.
  Its report adds the tricks: tips right and wrong, the arrests in fights a right tip named, and rats (which count in
  the betrayal bar); bribes and the fights they kept the cops out of; bounties posted, paid and gone at the ferry;
  lookouts; and the new sinks (bribes, lookouts, bounties gone). The runner's per-night fights carry their tippers and
  bribers when there are any.
  `--cast layer4` (L4-4, layer 4 in play; the L4-4 section of `bots.mjs`) is the layer3 cast's seats, roles and
  habits, and every seat plays the big score, each from its own view and for its own gain:
  - warrants: a seat that works the Gunrunner trade sells forged warrants as it sells guns (the buyer asks, orders one
    for a night, gets it handed over and pays when it arrives), at what one costs its maker (its parts at $15 and a
    night's wage). It builds one for an order it couldn't fill; the Gunrunner best placed to build by the public record
    keeps one in stock for each crew that could take a job. It sells one crew a night until no job day is left after
    that night, and then sells to every crew: the double-sell. A buyer never buys again from one that double-sold it;
  - vault jobs: the vault's worth is on the board, and its defence is the flat defence and the guards the record last
    showed. A crew's leader buys a warrant the day before a job day and on it when the vault, less the price, beats the
    crew's best job and the crew's strength beats that defence, and jobs it on the night when that's still its best
    job, its crew backing it. After the last job day it buys one for the last night, when no guard works, keeping the
    price back from what it spends once that job looks worth it, and jobs the vault on the way to the boat when its
    crew beats the flat defence. A robber jobs it, holding a warrant, when its strength beats the defence and the vault
    beats its best hit;
  - guards: while a crew on the board could beat the flat defence and pay for a warrant, the Cops the collar leaves
    guard the vault, the fewest whose strength with the flat defence beats the strongest crew's, else all of them;
  - fakes: once the list has closed or closes that night, a seat that works the Gunrunner trade fakes a rare-or-better
    trait for a buyer it can see (its fit on the board with no shades in it, nothing as rare in that slot, the public
    cash for it), wears the fake so a buyer can see it, asks one buyer a day, and hands it over to an order that covers
    its cost. Any seat answers a Gunrunner's ask and orders the piece it sees it wearing when that's real to its view
    and for a slot it wants, at 80% of the list's price (FENCE.list) or what it can spare, if less; it refuses one its
    shades show is fake, naming the piece. No bot reads a fake from its copy id (call 1), and a maker's other habits
    never see its fakes.
  Robbers value a fit by the real pieces their view shows. Its report adds the big score: vault jobs tried, won and
  lost, and the arrests in them; the vault's money in (fines and seizures) and out (jobs and the ferry); guard nights;
  warrants built, handed over and used; fakes made, sold, refused (by a buyer, naming it, and at the fence), seen
  through shades (worn at a lock while another agent wore real shades) and exposed; double-sells, which join the
  betrayal bar; and §27's vault bar ("someone jobs the vault in at least half of seasons"). The runner's per-night
  fights carry a vault fight's guards and their strength, and its nights the fakes worn and seen at the lock. In every
  cast the haul to date and "most of the drop sells" skip fakes, and a vault job is show-worthy.
  `--cast layer2` is layer 2's: a bot for each trade (3 Smugglers, 3 Chemists, 4 Dealers, 2 Gunrunners), a Cop seat
  that patrols and collars, and fewer of layer 1's types (3 shift workers, 2 buy-late savers, 2 turtles, 2 scouts, a
  guesser, and crews of 4 and 3), which work shifts instead of a trade. `--cast layer1` is the cast layer 1's reports
  were made with. Both reproduce their reports: the season reports byte for byte, and the summary but for its wall
  time. `runSeason()` itself defaults to layer 1's mix.
  `--cast crime` (R3-2, trunk `docs/briefs/R3-crime-pays.md`; `CRIME_MIX` and the R3 sections of `bots.mjs`) is the
  layer4 cast's seats, roles and habits with crime played as a sensible player plays it (`sharp`), each from its own
  view: a robber robs when its strength wins and the take beats a night's wage, broke or not (no $30 gate); everyone
  reads a home off its owner's public holdings record (a jailed agent's empty home among them) and hires no lookout
  for that; a robber's first gear is what lets it win alone, it saves for its gun as the Cop seat does, and it buys no
  trade goods for a night it means to rob; and before a fight it reads the defence (the target's public strength, a
  heavy district, the city cops while it's wanted, the Cops the show saw there last night, a fight it just lost), never
  turns wanted, and from the night an arrest would hold it past the ferry fights only where no cop could come. The
  bench's skill test makes one robber `careless` (it robs whenever it can win anything, at random, reading nothing).
  The rule options R3-2 measures are switches in `numbers.mjs`: `gap.holdup` ('pay'), `gap.jump` (1), `breakinShare`
  (1), `gap.purse` ('half'), `gap.fine` ('stars'), `gap.ferryJail` ('released') and `gap.cool` (2);
  `core/test/crime-options.test.mjs` pins each. R3-2c fixed the hold-up (a target arrested in tonight's fights is
  paid nothing, so a hit on it takes what it takes with the switch off; a paid target's pay goes through its own cash to
  the robber) and added the narrow jump, `gap.jump` 'alone' (§7's "a hit beats an agent out working alone": a hit wins
  a tie on an agent out working, with no backer, city cops or patrol on its side); `core/test/crime-holdup.test.mjs`
  pins both, and the crime cast's robbers read "alone" from their view (`worksAlone` in `bots.mjs`). Its write-up is
  `core/reports/R3/HANDBACK-2c.md`. Since R3-3 slime's picks are the defaults (10-16, "go with your picks"; GAME.md
  §41): the whole stash (`breakinShare` 1), the hold-up (`gap.holdup` 'pay'), released for the ferry (`gap.ferryJail`
  'released'), R1-tune2's numbers (`price.rare` [200, 80], `priceFall` 0.2) and no jump (`gap.jump` 0). The purse,
  fines by the star and faster cooling stay off. The rules as they were play with `--set breakinShare=0.5 --set
  gap.holdup=off --set gap.ferryJail=missed --set price.rare.0=500 --set price.rare.1=200 --set priceFall=0.1`. Its
  write-up is `core/reports/R3/HANDBACK-3.md`. Three bench tools go with them: `crime.mjs` (R3-1's diagnosis:
  money by source and by seat, each crime's odds and take, the robbers' nights by what decided them, what was on the
  street at each lock, and an upper bound; it watches each season through `runSeason`'s `observe`, which changes
  nothing), `skill.mjs` (the paired test: a robber that reads the board against the same seat careless) and `bars.mjs`
  (§27's bars for several runs side by side). Their write-up is `core/reports/R3/HANDBACK.md`.
- R4-2 (GAME.md §8, gap.accept): a back joins a group only if its leader accepted it. In every cast a bot's play
  accepts, from its own view, its crew and the backs it arranged tonight (`acceptFor` in `bots.mjs`): the agents that
  promised it in a sit-down (hired muscle, a crew's mates), the Cops its police plan puts in a collar it leads, and a
  taker it wrote a SUDO play for. It names a list only when someone outside its crew is on it. A snake's switch, which
  its target never arranged, is accepted by nobody and does nothing. Its write-up is `core/reports/R4/HANDBACK-2.md`.
- The trade bots trade among themselves in typed sit-downs (a seller asks, the buyer answers with an order, the goods
  are handed over and paid for, $15 a unit), go to the city's shop and buyer only when no agent deals, and weigh flex
  against what a hit would take before wearing a rare to work. Their settings (`STREET`, `FLEX_RISK` in `bots.mjs`)
  are bot settings, not game numbers.
- The Cop seat patrols where fights were lately (the docks on a shipment night) and collars a wanted agent the show
  saw out (in the trades cast, by the police plan above); crews and lone robbers grab a posted crate when their
  strength clears the cops; robbers, crew members and the Cop buy a gun each from Gunrunners. At the fence, a bot lists
  a piece it won't wear below what it last sold for, a worker buys a listing that's under the list's price before
  buying off the list, and crewmates or trade partners swap piece for piece now and then. A bot plans with the pieces
  it hasn't listed (gap.listed). These settings (`COP`, `COLLAR`, `GRAB`, `GUNS`, `FENCE`) are bot settings too.
- With layer 2's cast, each season report and the summary add the street: cash onto the island by source and the
  street's share (§9: about two-thirds), every bot's money by source, how crowded the drops get, corner fights (which
  count as show-worthy), where the cooked chems came from, and §27's money bar; the police, the crate and guns, and
  the Cop and Gunrunner bar; and the fence.
- With the `trades` cast they also give the cast (every seat's trade, by strategy) and the money bar's parts one at a
  time, by trade, over every seat that works it (the shift workers apart, as the yardstick): each trade's median
  income against the median shift worker's (the bar: the Smuggler, Chemist and Dealer beat it); where the chems that
  reached the Chemists came from (Smugglers, the city's shop, other agents, the kits, thefts); the widest gap between
  two trades' median incomes (no more than 2×); and the street's share of the cash onto the island (§9: about
  two-thirds; reported without a bar). Income there leaves out a gun a seat bought (gear, as a piece off the list is).
  They also count the Dealers' nights on a corner and how many sold, guns sold by every seat that works the
  Gunrunner trade (in layer 2's cast those are its Gunrunner bots, so its reports are unchanged), and the collars of
  every seat that works the Cop trade: tried, found their target, won, and backs of another Cop's collar.
- A sensitivity check: add `--set key=value` (for example `--set shiftCurve.min=50`). It changes the number for that
  run only and is printed at the top of every report; `numbers.mjs` stays as it is. `--squatter` swaps one shift worker
  for the squatter, the bot that gets evicted on purpose and never pays the compute back.
- Both programs refuse any argument they don't know, so a mistyped flag, or a `--set key=value` your shell passed as
  one word, stops the run instead of running the defaults.

`core/runs/` is not committed. The reports handed back are in `core/reports/`: layer 2's `SUMMARY.md` (40 seasons,
seeds 404–423 under both rules) and the one-page reports for 404, 405 and 406 under rule A, all with layer 2's cast;
the same four with the `trades` cast in `core/reports/trades/`, with the `layer3` cast in `core/reports/layer3/` and
with the `layer4` cast in `core/reports/layer4/`;
layer 1's, made with layer 1's cast before layer 2 existed, in `core/reports/layer1/`; and `NUMBERS.md`, every row of
`numbers.mjs`.

## Not built yet

In every cast but `layer3` and `layer4` the bench's bots take no drugs, read TEMP as their doses, and don't tip, rat,
bribe, post bounties or hire lookouts; in every cast but `layer4` none builds warrants or fakes, jobs or guards the
vault, or double-sells. No bot speaks out loud or uses crew chat (built in R2-1): both wait for R2's model players.
Since R4-11 the model bars are built (R2-9): a model season's report gives its seats' calls against the ceiling and the
invalid-play rate per model (a model seat counts in no bot type's row), and with `--cast models` the bench plays each
seed's bot twin first (the same cast with no model seat, in `bots/` under its `--out`), so the summary compares the
model with the bots seat for seat. R2-9's other per-model rows (no-shows, retries, plays by origin, tokens and seconds
a call) are not built.
