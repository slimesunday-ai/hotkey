# R1 bench summary (MOCK)

Layer 2 with every seat working a trade (the cast `trades`, L2-6: layer 2's seats and §25's strategies; the buy-late savers, turtles, robbers and crews work the trade they drew on any night their strategy leaves free, and the shift workers work shifts), 30 scripted bots, 14 nights. Seeds 404-423 under rules A and B: 40 seasons. Wall time 78.7 s.
Tiers are MOCK (GAME.md §4); numbers are §38 guesses; bars are §27 proposals measured for the layers built so far, read by core/bench/passbars.mjs.
Haul (§27, for testing; R4-1) is Mainland money plus each minted copy at that copy's own first sale on the list. The last-price mark (the measure before R4-1) and the opening price are shadows: "Haul, three ways" below.

| Bar | rule A | rule B | all (· distinct seasons) |
|---|---|---|---|
| The ledger and cash checks (after every errand and every night; a failure stops the season) | 22,456 + 280 checks, 0 failed | 22,407 + 280 checks, 0 failed | 44,863 + 560 checks, 0 failed |
| Buy-late bot below the median haul (≥ 90% of seasons) | 8/20 (40%) | 8/20 (40%) | 16/40 (40%) · 10/28 distinct: 36% of distinct seasons, FAIL (§27: at least 90%) |
| Turtle below the median haul (≥ 90% of seasons) | 16/20 (80%) | 15/20 (75%) | 31/40 (78%) · 22/28 distinct: 79% of distinct seasons, FAIL (§27: at least 90%) |
| Crime pays, with risk: the median robber by haul out-earns the median shift worker, and was arrested at least once | 0/20 (0%) | 1/20 (5%) | 1/40 (3%) · 1/28 distinct, one seed (423) |
| Crime pays, with risk, the shadow reading (the bench's before R4-1): the robbers' median haul beats the shift worker's, and the median of their arrests is at least 1 | 1/20 (5%) | 1/20 (5%) | 2/40 (5%) · 2/28 distinct, one seed (423) |
| The last night moves < 1/3 of stolen value | 20/20 (100%) | 20/20 (100%) | 40/40 (100%) · 28/28 distinct |
| #1 by haul changes hands ≥ 3 times | 18/20 (90%) | 18/20 (90%) | 36/40 (90%) · 25/28 distinct |
| ≥ 3 betrayals a season | 15/20 (75%) | 15/20 (75%) | 30/40 (75%) · 21/28 distinct |
| A show-worthy event every night | 0/20 (0%) | 0/20 (0%) | 0/40 (0%) · 0/28 distinct |
| ≥ 1/3 of minted traits taken or traded | 0/20 (0%) | 0/20 (0%) | 0/40 (0%) · 0/28 distinct |
| Places matter | 19/20 (95%) | 19/20 (95%) | 38/40 (95%) · 26/28 distinct |
| Most of the drop sells (≥ 3/4) | 0/20 (0%) | 0/20 (0%) | 0/40 (0%) · 0/28 distinct |
| The money works (§27) | 0/20 (0%) | 0/20 (0%) | 0/40 (0%) · 0/28 distinct |
| The money works, 1: the median Smuggler, Chemist and Dealer each out-earn the median shift worker (by haul; income a shadow) | 0/20 (0%) | 0/20 (0%) | 0/40 (0%) · 0/28 distinct |
| The money works, 2: most chems cooked come from Smugglers (more than half of what reached the Chemists, the shop and their kits counted) | 14/20 (70%) | 14/20 (70%) | 28/40 (70%) · 21/28 distinct |
| The money works, 3: no trade's median income more than twice another's | 1/20 (5%) | 1/20 (5%) | 2/40 (5%) · 1/28 distinct, one seed (411) |
| The median Cop and the median Gunrunner finish in the top half (≥ 30% of seasons) | 16/20 (80%) | 16/20 (80%) | 32/40 (80%) · 22/28 distinct: 79% of distinct seasons, PASS (§27: at least 30%) |

A share of seasons (§27's 90%, 30% and half) is a share of distinct seasons: two seasons are one when their events.jsonl match with the rule label stripped. §27 gives the other bars no share of seasons, so they have no verdict across seasons; their counts are the reading. Each "median X" is one seat: the seats ranked by the bar's measure, lowest first, the middle one, or with an even count the lower of the two middle ones (the median robber's ties go to the one arrested fewer times); "the median haul" is the season's over every seat. A trade's Cops, Gunrunners, Smugglers, Chemists and Dealers are the seats that play it: its bots, and a model seat by its trade. Stolen value counts every take by crime, each piece at its copy's own first sale and goods at the city's opening prices.

**Key medians, per season:**

| | rule A | rule B | all |
|---|---|---|---|
| median haul (all agents) | $235 | $235 | $235 |
| median haul: shift | $375 | $375 | $375 |
| median haul: buylate | $251 | $251 | $251 |
| median haul: turtle | $126 | $122 | $122 |
| median haul: scout | $236 | $214 | $224 |
| median haul: guess | $47 | $47 | $47 |
| median haul: crew | $150 | $149 | $150 |
| median haul: smuggler | $77 | $72 | $72 |
| median haul: chemist | $227 | $224 | $224 |
| median haul: dealer | $550 | $550 | $550 |
| median haul: gunrunner | $406 | $406 | $406 |
| median haul: cop | $396 | $426 | $420 |
| shift workers a night / wage (medians) | 9 / $51 | 9 / $51 | 9 / $51 |
| rent tabs at the dock (all seasons): agents / paid / pieces taken | 176 / $7,413 / 22 | 177 / $7,317 / 24 | 353 / $14,730 / 46 |
| hired muscle (all seasons): deals / fights / won / cuts paid / walks | 15 / 9 / 6 / 4 / 2 | 15 / 9 / 6 / 4 / 2 | 30 / 18 / 12 / 8 / 4 |
| the median robber's arrests (the crime bar's robber, a season) | 1 | 1 | 1 |
| the robbers' median arrests (the crime bar's shadow reading) | 1 | 1 | 1 |
| last night share of stolen value | 0% | 0% | 0% |
| #1 changes | 5 | 5 | 5 |
| betrayals (kinds, all seasons) | 3 (turn 27, rug 20, walk 21) | 3 (turn 27, rug 20, walk 21) | 3 (turn 54, rug 40, walk 42) |
| show-worthy nights | 10.5/14 | 10.5/14 | 10.5/14 |
| minted taken or traded | 23% | 23% | 23% |
| nights places changed | 8/14 | 8/14 | 8/14 |
| hit landing: sighted vs blind | 67% vs 0% | 67% vs 0% | 67% vs 0% |
| drop sold | 43% | 43% | 43% |
| The money works, 4: the street's share of the cash onto the island (§9: about two-thirds; reported, no bar) | 48% (41%–55%) | 48% (40%–55%) | 48% (40%–55%) |
| thefts / arrests / evictions | 7.5 / 10 / 12.5 | 7.5 / 10.5 / 12.5 | 7.5 / 10 / 12.5 |
| fights (all seasons): with backers / backing decided / a target cut a backer of the attack on itself | 382: 172 / 96 / 9 | 383: 174 / 95 / 0 | 765: 346 / 191 / 9 |
| invalid plays (all seasons) | 0 of 8036 | 0 of 8038 | 0 of 16074 |

**Haul, three ways** (R4-1): the official haul values each minted copy at that copy's own first sale on the list; the shadows at its trait's latest list price (the last-price mark, the measure before R4-1) and at its trait's opening price.

| Bar, all seasons (seasons passing · distinct) | copy paid (official) | last-price mark (shadow) | opening price (shadow) |
|---|---|---|---|
| Buy-late bot below the median haul (≥ 90% of seasons) | 16/40 · 10/28 distinct | 16/40 · 10/28 distinct | 12/40 · 7/28 distinct |
| Turtle below the median haul (≥ 90% of seasons) | 31/40 · 22/28 distinct | 31/40 · 23/28 distinct | 27/40 · 19/28 distinct |
| Crime pays, with risk: the median robber by haul out-earns the median shift worker, and was arrested at least once | 1/40 · 1/28 distinct, one seed (423) | 1/40 · 1/28 distinct, one seed (423) | 0/40 · 0/28 distinct |
| Crime pays, with risk, the shadow reading (the bench's before R4-1): the robbers' median haul beats the shift worker's, and the median of their arrests is at least 1 | 2/40 · 2/28 distinct, one seed (423) | 2/40 · 2/28 distinct, one seed (423) | 2/40 · 2/28 distinct, one seed (423) |
| #1 by haul changes hands ≥ 3 times | 36/40 · 25/28 distinct | 36/40 · 25/28 distinct | 37/40 · 26/28 distinct |
| The money works (§27) | 0/40 · 0/28 distinct | 0/40 · 0/28 distinct | 0/40 · 0/28 distinct |
| The money works, 1: the median Smuggler, Chemist and Dealer each out-earn the median shift worker (by haul; income a shadow) | 0/40 · 0/28 distinct | 0/40 · 0/28 distinct | 0/40 · 0/28 distinct |
| The median Cop and the median Gunrunner finish in the top half (≥ 30% of seasons) | 32/40 · 22/28 distinct | 32/40 · 22/28 distinct | 35/40 · 24/28 distinct |

| Median haul, all seasons (each season's, then the median across seasons) | copy paid (official) | last-price mark (shadow) | opening price (shadow) |
|---|---|---|---|
| all agents | $235 | $229 | $324 |
| shift | $375 | $375 | $601 |
| buylate | $251 | $248 | $318 |
| turtle | $122 | $106 | $215 |
| scout | $224 | $223 | $358 |
| guess | $47 | $47 | $47 |
| crew | $150 | $144 | $152 |
| smuggler | $72 | $80 | $119 |
| chemist | $224 | $225 | $311 |
| dealer | $550 | $550 | $827 |
| gunrunner | $406 | $409 | $587 |
| cop | $420 | $423 | $638 |
| the median robber (the crime bar's robber) | $129 | $129 | $213 |
| the robbers' median (the crime bar's shadow reading) | $129 | $129 | $213 |
| the median shift worker | $375 | $375 | $601 |

Distinct seasons: two seasons are one when their events.jsonl match with the rule label stripped.

**Rule A against rule B:** on 5 of 20 seeds the two rules fought different fights.

**The street, all seasons** (each season's medians, then the median across seasons):

- Cash onto the island, by source (median season): street $7,806 · shift $6,364 · patrol $1,100 · shipment $500 · buyer $356 · flex $360. The street's share: 48% (§9 expects about two-thirds).
- The money bar's parts, seasons passing: out-earn the median shift worker by haul: smuggler 0/40 · 0/28 distinct, chemist 2/40 · 1/28 distinct, one seed (411), dealer 27/40 · 16/28 distinct (shadows: last-price mark (shadow) smuggler 0/40 · 0/28 distinct, chemist 2/40 · 1/28 distinct, one seed (411), dealer 28/40 · 17/28 distinct; opening price (shadow) smuggler 0/40 · 0/28 distinct, chemist 2/40 · 1/28 distinct, one seed (411), dealer 23/40 · 14/28 distinct; by income: smuggler 0/40 · 0/28 distinct, chemist 2/40 · 1/28 distinct, one seed (411), dealer 40/40 · 28/28 distinct); most chems from Smugglers 28/40 · 21/28 distinct; no trade's median income over twice another's 2/40 · 1/28 distinct, one seed (411).
- Drops: a median of 2 Smugglers at a worked drop, 81% of runs shared one, at most 6 at one. Corners: 19 corner fights, 19 won outright, 300 changes of hands. Chems cooked: 4794, bought from Smugglers 1733, from the city's shop 288.

| bot | income | shifts | street | city's buyer | goods sold | goods bought | city's shop | flex | patrols and collars | thefts and grabs |
|---|---|---|---|---|---|---|---|---|---|---|
| shift | $657 | $657 | $0 | $0 | $0 | $0 | $0 | $0 | $0 | $0 |
| buylate | $537 | $121 | $0 | $8 | $259 | $173 | $0 | $0 | $0 | $0 |
| turtle | $400 | $193 | $0 | $0 | $105 | $34 | $0 | $0 | $0 | $0 |
| scout | $203 | $88 | $0 | $6 | $75 | $38 | $0 | $0 | $0 | $243 |
| guess | $243 | $49 | $0 | $0 | $0 | $0 | $0 | $0 | $0 | $46 |
| crew | $339 | $98 | $0 | $0 | $0 | $0 | $0 | $0 | $0 | $0 |
| smuggler | $351 | $0 | $0 | $33 | $315 | $0 | $0 | $0 | $0 | $0 |
| chemist | $479 | $192 | $0 | $5 | $675 | $338 | $56 | $0 | $0 | $0 |
| dealer | $1,158 | $150 | $1,557 | $0 | $0 | $604 | $0 | $38 | $0 | $0 |
| gunrunner | $677 | $602 | $0 | $0 | $75 | $0 | $0 | $28 | $0 | $0 |
| cop | $677 | $0 | $0 | $0 | $0 | $150 | $0 | $30 | $763 | $0 |

Income is what work brought in (shifts, flex, the street, the city's buyer, goods sold to agents, a Cop's patrols and collars) less what its goods cost (bought from agents, the city's shop); thefts and grabs are apart.

**The money bar, part by part, all seasons** (a trade's seats are the seats that play it; each season's medians, then the median across seasons; the median shift worker's haul $375, its income $657):

| trade | seats that play it (a season) | median income | median haul | seasons it out-earned the shift worker by haul | by income (shadow) |
|---|---|---|---|---|---|
| smuggler | 3 | $351 | $72 | 0/40 · 0/28 distinct | 0/40 · 0/28 distinct |
| chemist | 3 | $479 | $224 | 2/40 · 1/28 distinct, one seed (411) | 2/40 · 1/28 distinct, one seed (411) |
| dealer | 4 | $1,088 | $475 | 27/40 · 16/28 distinct | 40/40 · 28/28 distinct |
| gunrunner | 2 | $611 | — | not in the bar | — |
| cop | 1 | $827 | — | not in the bar | — |

Every seat has a trade, by strategy (a season): smuggler: smuggler 3, crew 1.5, scout 0.6, buylate 0.5, guess 0.3, turtle 0.2 · chemist: chemist 3, crew 1.6, buylate 0.5, scout 0.5, turtle 0.4, guess 0.1 · dealer: dealer 4, crew 1.2, buylate 0.3, scout 0.3, turtle 0.3, guess 0.1 · gunrunner: gunrunner 2, crew 1.9, turtle 0.9, scout 0.6, buylate 0.4, guess 0.3 · cop: cop 1, crew 1, buylate 0.4, turtle 0.3, guess 0.2, scout 0.2. The shift workers are Cops on paper and work shifts: they're the yardstick. Only a trade's own bots, and model seats with the trade, play it.
- Chems that reached the Chemists: from Smugglers 1733, other seats 895, the city's shop 288, the kits 240, taken in thefts 0; the Smugglers' share 55%; 3122 cooked.
- The widest gap between two trades' median incomes: a median of 2.9× (§27: no more than 2×); the widest pair, by season: dealer over smuggler 36, cop over smuggler 2, dealer over chemist 2.
- The street's share of the cash onto the island: a median of 48%, from 40% to 55% (§9: about two-thirds).
- The Dealers' nights on a corner, all seasons: 1602, 1581 of them with a sale (99%).
- The close (medians a season; bails summed): $4,607 boarded unspent; 81 copies left on the list when it closed; 0 bails out of a jail that would have outlasted the ferry.
- Income counts work (shifts, flex, the street, the city's buyer, goods and guns sold to agents, a Cop's patrols and collars) less what the trade's goods cost (from agents or the city's shop); a gun a seat buys is gear and doesn't count against its trade; thefts and grabs are apart.

**The police, the crate and guns, all seasons:**

- **Police:** arrests by a Cop's collar 171, in a fight a patrol joined 190, in a fight with the city cops alone 42, at 5 stars 0, at the dock 0. The Cop seat patrolled 312 nights and won 171 of 206 collars, for $31,797. Every seat that works the Cop trade: 206 collars tried, 177 found their target, 171 won; 195 backs of another Cop's collar.
- **The crate:** 82 grab fights, 74 won (crew 72, scout 2), $20,000 in cash taken. **Guns:** 282 built, 0 bought at the city's shop, 68 taken in crates, 94 sold by Gunrunners to agents; at the lock a median of 6 held and 6 agents armed.

**The fence, all seasons:** 463 pieces listed, 443 sold (its cut $3,204); 8 swaps offered, 2 done, 6 lapsed; 20 deals handed back on night 14.

Waiting: drugs (layer 3); the vault (layer 4). The model bars (local-model agents against the bots, runner calls inside the ceiling, invalid plays per model) are read where model seats play: `--cast models`.
