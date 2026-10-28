# R1 bench summary (MOCK)

Layer 4 in play (the cast `layer4`, L4-4: the layer3 cast's seats and habits; Gunrunners build and sell forged warrants and fakes, crews and robbers job the vault, Cops guard it, and buyers in shades refuse the fakes they can see, each for its own reasons), 30 scripted bots, 14 nights. Seeds 404-423 under rules A and B: 40 seasons. Wall time 96.9 s.
Tiers are MOCK (GAME.md §4); numbers are §38 guesses; bars are §27 proposals measured for the layers built so far, read by core/bench/passbars.mjs.
Haul (§27, for testing; R4-1) is Mainland money plus each minted copy at that copy's own first sale on the list. The last-price mark (the measure before R4-1) and the opening price are shadows: "Haul, three ways" below.

| Bar | rule A | rule B | all (· distinct seasons) |
|---|---|---|---|
| The ledger and cash checks (after every errand and every night; a failure stops the season) | 26,107 + 280 checks, 0 failed | 26,121 + 280 checks, 0 failed | 52,228 + 560 checks, 0 failed |
| Buy-late bot below the median haul (≥ 90% of seasons) | 5/20 (25%) | 5/20 (25%) | 10/40 (25%) · 6/27 distinct: 22% of distinct seasons, FAIL (§27: at least 90%) |
| Turtle below the median haul (≥ 90% of seasons) | 12/20 (60%) | 12/20 (60%) | 24/40 (60%) · 17/27 distinct: 63% of distinct seasons, FAIL (§27: at least 90%) |
| Crime pays, with risk: the median robber by haul out-earns the median shift worker, and was arrested at least once | 0/20 (0%) | 0/20 (0%) | 0/40 (0%) · 0/27 distinct |
| Crime pays, with risk, the shadow reading (the bench's before R4-1): the robbers' median haul beats the shift worker's, and the median of their arrests is at least 1 | 0/20 (0%) | 0/20 (0%) | 0/40 (0%) · 0/27 distinct |
| The last night moves < 1/3 of stolen value | 20/20 (100%) | 20/20 (100%) | 40/40 (100%) · 27/27 distinct |
| #1 by haul changes hands ≥ 3 times | 18/20 (90%) | 18/20 (90%) | 36/40 (90%) · 24/27 distinct |
| ≥ 3 betrayals a season | 13/20 (65%) | 13/20 (65%) | 26/40 (65%) · 19/27 distinct |
| A show-worthy event every night | 0/20 (0%) | 0/20 (0%) | 0/40 (0%) · 0/27 distinct |
| ≥ 1/3 of minted traits taken or traded | 2/20 (10%) | 2/20 (10%) | 4/40 (10%) · 2/27 distinct |
| Places matter | 19/20 (95%) | 19/20 (95%) | 38/40 (95%) · 25/27 distinct |
| Most of the drop sells (≥ 3/4) | 0/20 (0%) | 0/20 (0%) | 0/40 (0%) · 0/27 distinct |
| The money works (§27) | 0/20 (0%) | 0/20 (0%) | 0/40 (0%) · 0/27 distinct |
| The money works, 1: the median Smuggler, Chemist and Dealer each out-earn the median shift worker (by haul; income a shadow) | 0/20 (0%) | 0/20 (0%) | 0/40 (0%) · 0/27 distinct |
| The money works, 2: most chems cooked come from Smugglers (more than half of what reached the Chemists, the shop and their kits counted) | 13/20 (65%) | 13/20 (65%) | 26/40 (65%) · 20/27 distinct |
| The money works, 3: no trade's median income more than twice another's | 1/20 (5%) | 1/20 (5%) | 2/40 (5%) · 2/27 distinct, one seed (420) |
| The median Cop and the median Gunrunner finish in the top half (≥ 30% of seasons) | 17/20 (85%) | 17/20 (85%) | 34/40 (85%) · 24/27 distinct: 89% of distinct seasons, PASS (§27: at least 30%) |
| Every drug taken at least once a season, and someone hooked (§27, layer 3) | 0/20 (0%) | 0/20 (0%) | 0/40 (0%) · 0/27 distinct |
| Someone jobs the vault (≥ 50% of seasons; §27, layer 4) | 5/20 (25%) | 5/20 (25%) | 10/40 (25%) · 6/27 distinct: 22% of distinct seasons, FAIL (§27: at least 50%) |

A share of seasons (§27's 90%, 30% and half) is a share of distinct seasons: two seasons are one when their events.jsonl match with the rule label stripped. §27 gives the other bars no share of seasons, so they have no verdict across seasons; their counts are the reading. Each "median X" is one seat: the seats ranked by the bar's measure, lowest first, the middle one, or with an even count the lower of the two middle ones (the median robber's ties go to the one arrested fewer times); "the median haul" is the season's over every seat. A trade's Cops, Gunrunners, Smugglers, Chemists and Dealers are the seats that play it: its bots, and a model seat by its trade. Stolen value counts every take by crime, each piece at its copy's own first sale and goods at the city's opening prices.

**Key medians, per season:**

| | rule A | rule B | all |
|---|---|---|---|
| median haul (all agents) | $222 | $227 | $224 |
| median haul: shift | $372 | $372 | $372 |
| median haul: buylate | $197 | $197 | $197 |
| median haul: turtle | $161 | $161 | $161 |
| median haul: scout | $151 | $161 | $159 |
| median haul: guess | $41 | $20 | $22 |
| median haul: crew | $127 | $121 | $127 |
| median haul: smuggler | $51 | $51 | $51 |
| median haul: chemist | $192 | $199 | $192 |
| median haul: dealer | $520 | $514 | $519 |
| median haul: gunrunner | $398 | $398 | $398 |
| median haul: cop | $483 | $489 | $484 |
| shift workers a night / wage (medians) | 10 / $50 | 10 / $50 | 10 / $50 |
| rent tabs at the dock (all seasons): agents / paid / pieces taken | 192 / $8,141 / 22 | 193 / $8,196 / 21 | 385 / $16,337 / 43 |
| hired muscle (all seasons): deals / fights / won / cuts paid / walks | 9 / 9 / 9 / 7 / 1 | 9 / 9 / 9 / 7 / 1 | 18 / 18 / 18 / 14 / 2 |
| the median robber's arrests (the crime bar's robber, a season) | 1 | 1 | 1 |
| the robbers' median arrests (the crime bar's shadow reading) | 1 | 1 | 1 |
| last night share of stolen value | 0% | 0% | 0% |
| #1 changes | 5 | 5 | 5 |
| betrayals (kinds, all seasons) | 3.5 (walk 16, turn 19, rug 18, rat 14) | 3.5 (walk 17, turn 19, rug 18, rat 14) | 3.5 (walk 33, turn 38, rug 36, rat 28) |
| show-worthy nights | 10/14 | 10/14 | 10/14 |
| minted taken or traded | 26% | 26% | 26% |
| nights places changed | 6.5/14 | 7/14 | 7/14 |
| hit landing: sighted vs blind | 64% vs 0% | 64% vs 0% | 64% vs 0% |
| drop sold | 42% | 42% | 42% |
| The money works, 4: the street's share of the cash onto the island (§9: about two-thirds; reported, no bar) | 44% (37%–49%) | 44% (37%–49%) | 44% (37%–49%) |
| thefts / arrests / evictions | 6.5 / 10 / 14.5 | 7 / 10 / 15 | 7 / 10 / 15 |
| fights (all seasons): with backers / backing decided / a target cut a backer of the attack on itself | 358: 149 / 90 / 7 | 361: 152 / 95 / 0 | 719: 301 / 185 / 7 |
| invalid plays (all seasons) | 0 of 8031 | 0 of 8037 | 0 of 16068 |

**Haul, three ways** (R4-1): the official haul values each minted copy at that copy's own first sale on the list; the shadows at its trait's latest list price (the last-price mark, the measure before R4-1) and at its trait's opening price.

| Bar, all seasons (seasons passing · distinct) | copy paid (official) | last-price mark (shadow) | opening price (shadow) |
|---|---|---|---|
| Buy-late bot below the median haul (≥ 90% of seasons) | 10/40 · 6/27 distinct | 11/40 · 6/27 distinct | 10/40 · 6/27 distinct |
| Turtle below the median haul (≥ 90% of seasons) | 24/40 · 17/27 distinct | 23/40 · 16/27 distinct | 24/40 · 17/27 distinct |
| Crime pays, with risk: the median robber by haul out-earns the median shift worker, and was arrested at least once | 0/40 · 0/27 distinct | 0/40 · 0/27 distinct | 0/40 · 0/27 distinct |
| Crime pays, with risk, the shadow reading (the bench's before R4-1): the robbers' median haul beats the shift worker's, and the median of their arrests is at least 1 | 0/40 · 0/27 distinct | 0/40 · 0/27 distinct | 0/40 · 0/27 distinct |
| #1 by haul changes hands ≥ 3 times | 36/40 · 24/27 distinct | 36/40 · 24/27 distinct | 36/40 · 24/27 distinct |
| The money works (§27) | 0/40 · 0/27 distinct | 0/40 · 0/27 distinct | 0/40 · 0/27 distinct |
| The money works, 1: the median Smuggler, Chemist and Dealer each out-earn the median shift worker (by haul; income a shadow) | 0/40 · 0/27 distinct | 0/40 · 0/27 distinct | 0/40 · 0/27 distinct |
| The median Cop and the median Gunrunner finish in the top half (≥ 30% of seasons) | 34/40 · 24/27 distinct | 34/40 · 24/27 distinct | 34/40 · 24/27 distinct |

| Median haul, all seasons (each season's, then the median across seasons) | copy paid (official) | last-price mark (shadow) | opening price (shadow) |
|---|---|---|---|
| all agents | $224 | $220 | $323 |
| shift | $372 | $372 | $649 |
| buylate | $197 | $203 | $251 |
| turtle | $161 | $154 | $243 |
| scout | $159 | $164 | $227 |
| guess | $22 | $22 | $22 |
| crew | $127 | $127 | $127 |
| smuggler | $51 | $53 | $100 |
| chemist | $192 | $196 | $249 |
| dealer | $519 | $502 | $721 |
| gunrunner | $398 | $389 | $592 |
| cop | $484 | $495 | $814 |
| the median robber (the crime bar's robber) | $81 | $81 | $132 |
| the robbers' median (the crime bar's shadow reading) | $81 | $81 | $132 |
| the median shift worker | $372 | $372 | $649 |

Distinct seasons: two seasons are one when their events.jsonl match with the rule label stripped.

**Rule A against rule B:** on 5 of 20 seeds the two rules fought different fights.

**The street, all seasons** (each season's medians, then the median across seasons):

- Cash onto the island, by source (median season): street $7,138 · shift $6,575 · patrol $1,000 · shipment $500 · flex $380 · buyer $343 · guard $100. The street's share: 44% (§9 expects about two-thirds).
- The money bar's parts, seasons passing: out-earn the median shift worker by haul: smuggler 0/40 · 0/27 distinct, chemist 2/40 · 2/27 distinct, one seed (418), dealer 28/40 · 20/27 distinct (shadows: last-price mark (shadow) smuggler 0/40 · 0/27 distinct, chemist 2/40 · 2/27 distinct, one seed (418), dealer 26/40 · 19/27 distinct; opening price (shadow) smuggler 0/40 · 0/27 distinct, chemist 2/40 · 2/27 distinct, one seed (418), dealer 22/40 · 15/27 distinct; by income: smuggler 0/40 · 0/27 distinct, chemist 2/40 · 2/27 distinct, one seed (418), dealer 40/40 · 27/27 distinct); most chems from Smugglers 26/40 · 20/27 distinct; no trade's median income over twice another's 2/40 · 2/27 distinct, one seed (420).
- Drops: a median of 2 Smugglers at a worked drop, 79% of runs shared one, at most 6 at one. Corners: 29 corner fights, 29 won outright, 331 changes of hands. Chems cooked: 4576, bought from Smugglers 1604, from the city's shop 244.

| bot | income | shifts | street | city's buyer | goods sold | goods bought | city's shop | flex | patrols and collars | thefts and grabs |
|---|---|---|---|---|---|---|---|---|---|---|
| shift | $652 | $652 | $0 | $0 | $0 | $0 | $0 | $0 | $0 | $0 |
| buylate | $466 | $110 | $0 | $9 | $184 | $135 | $0 | $0 | $0 | $0 |
| turtle | $424 | $194 | $0 | $0 | $109 | $30 | $0 | $0 | $0 | $0 |
| scout | $187 | $109 | $0 | $4 | $94 | $79 | $0 | $0 | $0 | $216 |
| guess | $215 | $98 | $0 | $1 | $90 | $45 | $0 | $0 | $0 | $34 |
| crew | $309 | $147 | $0 | $1 | $30 | $45 | $0 | $0 | $0 | $0 |
| smuggler | $326 | $0 | $0 | $37 | $270 | $0 | $0 | $0 | $0 | $0 |
| chemist | $460 | $191 | $0 | $10 | $608 | $315 | $25 | $0 | $0 | $0 |
| dealer | $1,076 | $175 | $1,386 | $0 | $0 | $506 | $0 | $35 | $0 | $0 |
| gunrunner | $655 | $591 | $0 | $0 | $75 | $8 | $0 | $18 | $0 | $0 |
| cop | $780 | $0 | $0 | $0 | $0 | $150 | $0 | $55 | $872 | $0 |

Income is what work brought in (shifts, flex, the street, the city's buyer, goods sold to agents, a Cop's patrols and collars) less what its goods cost (bought from agents, the city's shop); thefts and grabs are apart.

**The money bar, part by part, all seasons** (a trade's seats are the seats that play it; each season's medians, then the median across seasons; the median shift worker's haul $372, its income $652):

| trade | seats that play it (a season) | median income | median haul | seasons it out-earned the shift worker by haul | by income (shadow) |
|---|---|---|---|---|---|
| smuggler | 3 | $326 | $51 | 0/40 · 0/27 distinct | 0/40 · 0/27 distinct |
| chemist | 3 | $460 | $192 | 2/40 · 2/27 distinct, one seed (418) | 2/40 · 2/27 distinct, one seed (418) |
| dealer | 4 | $989 | $461 | 28/40 · 20/27 distinct | 40/40 · 27/27 distinct |
| gunrunner | 2 | $603 | — | not in the bar | — |
| cop | 1 | $930 | — | not in the bar | — |

Every seat has a trade, by strategy (a season): smuggler: smuggler 3, crew 1.5, scout 0.6, buylate 0.5, guess 0.3, turtle 0.2 · chemist: chemist 3, crew 1.6, buylate 0.5, scout 0.5, turtle 0.4, guess 0.1 · dealer: dealer 4, crew 1.2, buylate 0.3, scout 0.3, turtle 0.3, guess 0.1 · gunrunner: gunrunner 2, crew 1.9, turtle 0.9, scout 0.6, buylate 0.4, guess 0.3 · cop: cop 1, crew 1, buylate 0.4, turtle 0.3, guess 0.2, scout 0.2. The shift workers are Cops on paper and work shifts: they're the yardstick. Only a trade's own bots, and model seats with the trade, play it.
- Chems that reached the Chemists: from Smugglers 1604, other seats 929, the city's shop 244, the kits 240, taken in thefts 0; the Smugglers' share 53%; 3000 cooked.
- The widest gap between two trades' median incomes: a median of 3.2× (§27: no more than 2×); the widest pair, by season: dealer over smuggler 22, cop over smuggler 10, dealer over chemist 5, cop over chemist 3.
- The street's share of the cash onto the island: a median of 44%, from 37% to 49% (§9: about two-thirds).
- The Dealers' nights on a corner, all seasons: 1494, 1463 of them with a sale (98%).
- The close (medians a season; bails summed): $4,222 boarded unspent; 83 copies left on the list when it closed; 0 bails out of a jail that would have outlasted the ferry.
- Income counts work (shifts, flex, the street, the city's buyer, goods and guns sold to agents, a Cop's patrols and collars) less what the trade's goods cost (from agents or the city's shop); a gun a seat buys is gear and doesn't count against its trade; thefts and grabs are apart.

**The police, the crate and guns, all seasons:**

- **Police:** arrests by a Cop's collar 140, in a fight a patrol joined 191, in a fight with the city cops alone 67, at 5 stars 0, at the dock 3. The Cop seat patrolled 277 nights, guarded the vault 89 and won 140 of 154 collars, for $34,691. Every seat that works the Cop trade: 154 collars tried, 148 found their target, 140 won; 110 backs of another Cop's collar.
- **The crate:** 92 grab fights, 80 won (crew 78, scout 2), $20,000 in cash taken. **Guns:** 284 built, 0 bought at the city's shop, 68 taken in crates, 115 sold by Gunrunners to agents; at the lock a median of 6 held and 6 agents armed.

**The fence, all seasons:** 521 pieces listed, 511 sold (its cut $3,811); 20 swaps offered, 10 done, 10 lapsed; 10 deals handed back on night 14.

**The drugs, all seasons** (by the record, so a SUDO dose counts as SUDO, as its reveal shows it): taken TEMP 184 · TRUTH 172 · HALLU 16 · FIREWALL 0 · CLEAR 12 · SUDO 22.
- The seasons each drug was taken in: TEMP 38/40 · 26/27 distinct · TRUTH 40/40 · 27/27 distinct · HALLU 14/40 · 11/27 distinct · FIREWALL 0/40 · 0/27 distinct · CLEAR 12/40 · 8/27 distinct · SUDO 10/40 · 6/27 distinct; someone hooked in 26/40 · 18/27 distinct.
- Crashes 168, withdrawals 26; 26 agents hooked, 4 clean marks.
- The `taken` sink: temp 206, truth 172, clear 12, hallu 16 (a SUDO dose goes out as the TEMP it was handed over as). Cooked: temp 10510, truth 410, firewall 30, clear 210, sudo 110, hallu 170.
- SUDO: 22 doses handed over as TEMP, 18 plays written, 12 forced at the lock. TRUTH locked 172 plays.

**The tricks, all seasons** (§10, §12, §13): tips 146, right 46 and wrong 100; arrests in fights a right tip named 39; rats 28. Bribes 0 ($0), the city cops kept out of 0 fights. Bounties posted 4 ($428): paid 2 ($282, to crew 2), gone at the ferry 2 ($146). Lookouts 70 (crew 32, scout 24, guess 14).
- The new sinks: bribes $0, lookouts $3,500, bounties gone at the ferry $146.

**The big score, all seasons** (§7, §9, §12, §13): vault jobs tried 11, won 9, lost 2, with 8 arrests in them; guards were in 2 of those fights. Guard nights 147 (a guard's wage counts with a Cop's patrols). Warrants built 30, handed over 7, used 11. Double-sells 0.
- The vault's money: in, $8,511 in fines and 132 pieces seized; out, $1,786 and 27 pieces taken by jobs, and $6,725 and 105 pieces gone at the ferry.
- Fakes (§4): made 4; sold as real 4, for $440; refused 0 by a buyer, naming the piece, and 0 at the fence; seen through shades 0; exposed at the ferry 4.

Every layer's bars are read. The model bars (local-model agents against the bots, runner calls inside the ceiling, invalid plays per model) are read where model seats play: `--cast models`.
