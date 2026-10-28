# R1 bench summary (MOCK)

Layer 3 in play (the cast `layer3`, L3-5: the trades cast's seats and habits; every seat buys, sells and takes the six drugs, and tips, rats, bribes, posts bounties and hires lookouts, each for its own reasons), 30 scripted bots, 14 nights. Seeds 404-423 under rules A and B: 40 seasons. Wall time 91.3 s.
Tiers are MOCK (GAME.md §4); numbers are §38 guesses; bars are §27 proposals measured for the layers built so far, read by core/bench/passbars.mjs.
Haul (§27, for testing; R4-1) is Mainland money plus each minted copy at that copy's own first sale on the list. The last-price mark (the measure before R4-1) and the opening price are shadows: "Haul, three ways" below.

| Bar | rule A | rule B | all (· distinct seasons) |
|---|---|---|---|
| The ledger and cash checks (after every errand and every night; a failure stops the season) | 25,670 + 280 checks, 0 failed | 25,669 + 280 checks, 0 failed | 51,339 + 560 checks, 0 failed |
| Buy-late bot below the median haul (≥ 90% of seasons) | 6/20 (30%) | 6/20 (30%) | 12/40 (30%) · 6/26 distinct: 23% of distinct seasons, FAIL (§27: at least 90%) |
| Turtle below the median haul (≥ 90% of seasons) | 11/20 (55%) | 11/20 (55%) | 22/40 (55%) · 15/26 distinct: 58% of distinct seasons, FAIL (§27: at least 90%) |
| Crime pays, with risk: the median robber by haul out-earns the median shift worker, and was arrested at least once | 0/20 (0%) | 0/20 (0%) | 0/40 (0%) · 0/26 distinct |
| Crime pays, with risk, the shadow reading (the bench's before R4-1): the robbers' median haul beats the shift worker's, and the median of their arrests is at least 1 | 0/20 (0%) | 0/20 (0%) | 0/40 (0%) · 0/26 distinct |
| The last night moves < 1/3 of stolen value | 20/20 (100%) | 20/20 (100%) | 40/40 (100%) · 26/26 distinct |
| #1 by haul changes hands ≥ 3 times | 19/20 (95%) | 19/20 (95%) | 38/40 (95%) · 25/26 distinct |
| ≥ 3 betrayals a season | 13/20 (65%) | 13/20 (65%) | 26/40 (65%) · 18/26 distinct |
| A show-worthy event every night | 0/20 (0%) | 0/20 (0%) | 0/40 (0%) · 0/26 distinct |
| ≥ 1/3 of minted traits taken or traded | 2/20 (10%) | 2/20 (10%) | 4/40 (10%) · 3/26 distinct |
| Places matter | 19/20 (95%) | 19/20 (95%) | 38/40 (95%) · 25/26 distinct |
| Most of the drop sells (≥ 3/4) | 0/20 (0%) | 0/20 (0%) | 0/40 (0%) · 0/26 distinct |
| The money works (§27) | 0/20 (0%) | 0/20 (0%) | 0/40 (0%) · 0/26 distinct |
| The money works, 1: the median Smuggler, Chemist and Dealer each out-earn the median shift worker (by haul; income a shadow) | 0/20 (0%) | 0/20 (0%) | 0/40 (0%) · 0/26 distinct |
| The money works, 2: most chems cooked come from Smugglers (more than half of what reached the Chemists, the shop and their kits counted) | 13/20 (65%) | 13/20 (65%) | 26/40 (65%) · 18/26 distinct |
| The money works, 3: no trade's median income more than twice another's | 0/20 (0%) | 0/20 (0%) | 0/40 (0%) · 0/26 distinct |
| The median Cop and the median Gunrunner finish in the top half (≥ 30% of seasons) | 18/20 (90%) | 18/20 (90%) | 36/40 (90%) · 24/26 distinct: 92% of distinct seasons, PASS (§27: at least 30%) |
| Every drug taken at least once a season, and someone hooked (§27, layer 3) | 0/20 (0%) | 0/20 (0%) | 0/40 (0%) · 0/26 distinct |

A share of seasons (§27's 90%, 30% and half) is a share of distinct seasons: two seasons are one when their events.jsonl match with the rule label stripped. §27 gives the other bars no share of seasons, so they have no verdict across seasons; their counts are the reading. Each "median X" is one seat: the seats ranked by the bar's measure, lowest first, the middle one, or with an even count the lower of the two middle ones (the median robber's ties go to the one arrested fewer times); "the median haul" is the season's over every seat. A trade's Cops, Gunrunners, Smugglers, Chemists and Dealers are the seats that play it: its bots, and a model seat by its trade. Stolen value counts every take by crime, each piece at its copy's own first sale and goods at the city's opening prices.

**Key medians, per season:**

| | rule A | rule B | all |
|---|---|---|---|
| median haul (all agents) | $220 | $220 | $220 |
| median haul: shift | $384 | $380 | $384 |
| median haul: buylate | $241 | $241 | $241 |
| median haul: turtle | $147 | $144 | $144 |
| median haul: scout | $148 | $158 | $157 |
| median haul: guess | $21 | $21 | $21 |
| median haul: crew | $120 | $128 | $124 |
| median haul: smuggler | $42 | $42 | $42 |
| median haul: chemist | $210 | $207 | $208 |
| median haul: dealer | $544 | $544 | $544 |
| median haul: gunrunner | $407 | $408 | $408 |
| median haul: cop | $507 | $507 | $507 |
| shift workers a night / wage (medians) | 10 / $50 | 10 / $50 | 10 / $50 |
| rent tabs at the dock (all seasons): agents / paid / pieces taken | 189 / $7,579 / 20 | 190 / $7,578 / 20 | 379 / $15,157 / 40 |
| hired muscle (all seasons): deals / fights / won / cuts paid / walks | 8 / 7 / 7 / 6 / 0 | 8 / 7 / 7 / 6 / 0 | 16 / 14 / 14 / 12 / 0 |
| the median robber's arrests (the crime bar's robber, a season) | 1 | 1 | 1 |
| the robbers' median arrests (the crime bar's shadow reading) | 1 | 1 | 1 |
| last night share of stolen value | 0% | 0% | 0% |
| #1 changes | 5 | 5 | 5 |
| betrayals (kinds, all seasons) | 3.5 (walk 16, turn 19, rug 18, rat 15) | 3.5 (walk 17, turn 19, rug 18, rat 15) | 3.5 (walk 33, turn 38, rug 36, rat 30) |
| show-worthy nights | 10/14 | 10/14 | 10/14 |
| minted taken or traded | 26% | 27% | 27% |
| nights places changed | 7/14 | 7/14 | 7/14 |
| hit landing: sighted vs blind | 61% vs 0% | 61% vs 0% | 61% vs 0% |
| drop sold | 42% | 42% | 42% |
| The money works, 4: the street's share of the cash onto the island (§9: about two-thirds; reported, no bar) | 44% (37%–49%) | 44% (37%–49%) | 44% (37%–49%) |
| thefts / arrests / evictions | 6 / 10.5 / 15 | 6.5 / 10.5 / 15 | 6 / 10.5 / 15 |
| fights (all seasons): with backers / backing decided / a target cut a backer of the attack on itself | 355: 151 / 90 / 6 | 358: 152 / 93 / 0 | 713: 303 / 183 / 6 |
| invalid plays (all seasons) | 0 of 8017 | 0 of 8023 | 0 of 16040 |

**Haul, three ways** (R4-1): the official haul values each minted copy at that copy's own first sale on the list; the shadows at its trait's latest list price (the last-price mark, the measure before R4-1) and at its trait's opening price.

| Bar, all seasons (seasons passing · distinct) | copy paid (official) | last-price mark (shadow) | opening price (shadow) |
|---|---|---|---|
| Buy-late bot below the median haul (≥ 90% of seasons) | 12/40 · 6/26 distinct | 12/40 · 6/26 distinct | 10/40 · 5/26 distinct |
| Turtle below the median haul (≥ 90% of seasons) | 22/40 · 15/26 distinct | 20/40 · 14/26 distinct | 28/40 · 18/26 distinct |
| Crime pays, with risk: the median robber by haul out-earns the median shift worker, and was arrested at least once | 0/40 · 0/26 distinct | 0/40 · 0/26 distinct | 0/40 · 0/26 distinct |
| Crime pays, with risk, the shadow reading (the bench's before R4-1): the robbers' median haul beats the shift worker's, and the median of their arrests is at least 1 | 0/40 · 0/26 distinct | 0/40 · 0/26 distinct | 0/40 · 0/26 distinct |
| #1 by haul changes hands ≥ 3 times | 38/40 · 25/26 distinct | 38/40 · 25/26 distinct | 38/40 · 25/26 distinct |
| The money works (§27) | 0/40 · 0/26 distinct | 0/40 · 0/26 distinct | 0/40 · 0/26 distinct |
| The money works, 1: the median Smuggler, Chemist and Dealer each out-earn the median shift worker (by haul; income a shadow) | 0/40 · 0/26 distinct | 0/40 · 0/26 distinct | 0/40 · 0/26 distinct |
| The median Cop and the median Gunrunner finish in the top half (≥ 30% of seasons) | 36/40 · 24/26 distinct | 36/40 · 24/26 distinct | 38/40 · 25/26 distinct |

| Median haul, all seasons (each season's, then the median across seasons) | copy paid (official) | last-price mark (shadow) | opening price (shadow) |
|---|---|---|---|
| all agents | $220 | $206 | $307 |
| shift | $384 | $379 | $620 |
| buylate | $241 | $238 | $339 |
| turtle | $144 | $138 | $237 |
| scout | $157 | $158 | $218 |
| guess | $21 | $21 | $21 |
| crew | $124 | $124 | $124 |
| smuggler | $42 | $42 | $42 |
| chemist | $208 | $203 | $245 |
| dealer | $544 | $532 | $762 |
| gunrunner | $408 | $402 | $601 |
| cop | $507 | $502 | $887 |
| the median robber (the crime bar's robber) | $61 | $61 | $110 |
| the robbers' median (the crime bar's shadow reading) | $61 | $61 | $110 |
| the median shift worker | $384 | $379 | $620 |

Distinct seasons: two seasons are one when their events.jsonl match with the rule label stripped.

**Rule A against rule B:** on 5 of 20 seeds the two rules fought different fights.

**The street, all seasons** (each season's medians, then the median across seasons):

- Cash onto the island, by source (median season): street $7,142 · shift $6,595 · patrol $1,200 · shipment $500 · flex $370 · buyer $343. The street's share: 44% (§9 expects about two-thirds).
- The money bar's parts, seasons passing: out-earn the median shift worker by haul: smuggler 0/40 · 0/26 distinct, chemist 4/40 · 3/26 distinct, dealer 26/40 · 17/26 distinct (shadows: last-price mark (shadow) smuggler 0/40 · 0/26 distinct, chemist 4/40 · 3/26 distinct, dealer 24/40 · 16/26 distinct; opening price (shadow) smuggler 0/40 · 0/26 distinct, chemist 4/40 · 3/26 distinct, dealer 27/40 · 17/26 distinct; by income: smuggler 0/40 · 0/26 distinct, chemist 2/40 · 2/26 distinct, one seed (418), dealer 40/40 · 26/26 distinct); most chems from Smugglers 26/40 · 18/26 distinct; no trade's median income over twice another's 0/40 · 0/26 distinct.
- Drops: a median of 2 Smugglers at a worked drop, 80% of runs shared one, at most 6 at one. Corners: 31 corner fights, 31 won outright, 341 changes of hands. Chems cooked: 4558, bought from Smugglers 1606, from the city's shop 260.

| bot | income | shifts | street | city's buyer | goods sold | goods bought | city's shop | flex | patrols and collars | thefts and grabs |
|---|---|---|---|---|---|---|---|---|---|---|
| shift | $655 | $655 | $0 | $0 | $0 | $0 | $0 | $0 | $0 | $0 |
| buylate | $511 | $109 | $0 | $9 | $236 | $131 | $0 | $0 | $0 | $0 |
| turtle | $407 | $194 | $0 | $0 | $75 | $30 | $0 | $0 | $0 | $0 |
| scout | $191 | $109 | $0 | $6 | $94 | $68 | $0 | $0 | $0 | $200 |
| guess | $226 | $123 | $0 | $0 | $90 | $45 | $0 | $0 | $0 | $0 |
| crew | $296 | $122 | $0 | $3 | $0 | $38 | $0 | $0 | $0 | $0 |
| smuggler | $304 | $0 | $0 | $36 | $270 | $0 | $0 | $0 | $0 | $0 |
| chemist | $468 | $189 | $0 | $7 | $600 | $315 | $52 | $0 | $0 | $0 |
| dealer | $1,077 | $175 | $1,364 | $0 | $0 | $518 | $0 | $35 | $0 | $0 |
| gunrunner | $676 | $594 | $0 | $0 | $75 | $0 | $0 | $13 | $0 | $0 |
| cop | $768 | $0 | $0 | $0 | $0 | $150 | $0 | $55 | $880 | $0 |

Income is what work brought in (shifts, flex, the street, the city's buyer, goods sold to agents, a Cop's patrols and collars) less what its goods cost (bought from agents, the city's shop); thefts and grabs are apart.

**The money bar, part by part, all seasons** (a trade's seats are the seats that play it; each season's medians, then the median across seasons; the median shift worker's haul $384, its income $655):

| trade | seats that play it (a season) | median income | median haul | seasons it out-earned the shift worker by haul | by income (shadow) |
|---|---|---|---|---|---|
| smuggler | 3 | $304 | $42 | 0/40 · 0/26 distinct | 0/40 · 0/26 distinct |
| chemist | 3 | $468 | $208 | 4/40 · 3/26 distinct | 2/40 · 2/26 distinct, one seed (418) |
| dealer | 4 | $996 | $467 | 26/40 · 17/26 distinct | 40/40 · 26/26 distinct |
| gunrunner | 2 | $615 | — | not in the bar | — |
| cop | 1 | $918 | — | not in the bar | — |

Every seat has a trade, by strategy (a season): smuggler: smuggler 3, crew 1.5, scout 0.6, buylate 0.5, guess 0.3, turtle 0.2 · chemist: chemist 3, crew 1.6, buylate 0.5, scout 0.5, turtle 0.4, guess 0.1 · dealer: dealer 4, crew 1.2, buylate 0.3, scout 0.3, turtle 0.3, guess 0.1 · gunrunner: gunrunner 2, crew 1.9, turtle 0.9, scout 0.6, buylate 0.4, guess 0.3 · cop: cop 1, crew 1, buylate 0.4, turtle 0.3, guess 0.2, scout 0.2. The shift workers are Cops on paper and work shifts: they're the yardstick. Only a trade's own bots, and model seats with the trade, play it.
- Chems that reached the Chemists: from Smugglers 1606, other seats 897, the city's shop 260, the kits 240, taken in thefts 0; the Smugglers' share 53%; 2984 cooked.
- The widest gap between two trades' median incomes: a median of 3.2× (§27: no more than 2×); the widest pair, by season: dealer over smuggler 22, cop over smuggler 12, dealer over chemist 4, cop over chemist 2.
- The street's share of the cash onto the island: a median of 44%, from 37% to 49% (§9: about two-thirds).
- The Dealers' nights on a corner, all seasons: 1486, 1453 of them with a sale (98%).
- The close (medians a season; bails summed): $4,252 boarded unspent; 83.5 copies left on the list when it closed; 0 bails out of a jail that would have outlasted the ferry.
- Income counts work (shifts, flex, the street, the city's buyer, goods and guns sold to agents, a Cop's patrols and collars) less what the trade's goods cost (from agents or the city's shop); a gun a seat buys is gear and doesn't count against its trade; thefts and grabs are apart.

**The police, the crate and guns, all seasons:**

- **Police:** arrests by a Cop's collar 148, in a fight a patrol joined 204, in a fight with the city cops alone 64, at 5 stars 0, at the dock 0. The Cop seat patrolled 358 nights and won 148 of 162 collars, for $34,909. Every seat that works the Cop trade: 162 collars tried, 154 found their target, 148 won; 127 backs of another Cop's collar.
- **The crate:** 96 grab fights, 82 won (crew 80, scout 2), $20,000 in cash taken. **Guns:** 286 built, 0 bought at the city's shop, 72 taken in crates, 108 sold by Gunrunners to agents; at the lock a median of 6 held and 6 agents armed.

**The fence, all seasons:** 521 pieces listed, 511 sold (its cut $3,717); 20 swaps offered, 8 done, 12 lapsed; 10 deals handed back on night 14.

**The drugs, all seasons** (by the record, so a SUDO dose counts as SUDO, as its reveal shows it): taken TEMP 174 · TRUTH 168 · HALLU 16 · FIREWALL 0 · CLEAR 10 · SUDO 26.
- The seasons each drug was taken in: TEMP 38/40 · 25/26 distinct · TRUTH 40/40 · 26/26 distinct · HALLU 14/40 · 12/26 distinct · FIREWALL 0/40 · 0/26 distinct · CLEAR 10/40 · 6/26 distinct · SUDO 12/40 · 8/26 distinct; someone hooked in 25/40 · 17/26 distinct.
- Crashes 157, withdrawals 28; 25 agents hooked, 6 clean marks.
- The `taken` sink: temp 200, truth 168, clear 10, hallu 16 (a SUDO dose goes out as the TEMP it was handed over as). Cooked: temp 10475, truth 400, firewall 30, clear 210, sudo 110, hallu 170.
- SUDO: 26 doses handed over as TEMP, 22 plays written, 16 forced at the lock. TRUTH locked 168 plays.

**The tricks, all seasons** (§10, §12, §13): tips 152, right 50 and wrong 102; arrests in fights a right tip named 46; rats 30. Bribes 0 ($0), the city cops kept out of 0 fights. Bounties posted 4 ($428): paid 2 ($282, to crew 2), gone at the ferry 2 ($146). Lookouts 74 (crew 38, scout 22, guess 14).
- The new sinks: bribes $0, lookouts $3,700, bounties gone at the ferry $146.

Waiting: the vault (layer 4). The model bars (local-model agents against the bots, runner calls inside the ceiling, invalid plays per model) are read where model seats play: `--cast models`.
