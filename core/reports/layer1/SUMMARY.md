# R1 bench summary (MOCK)

Layer 1, 30 scripted bots, 14 nights. Seeds 404-423 under rules A and B: 40 seasons. Wall time 21.3 s.
Tiers are MOCK (GAME.md §4); numbers are §38 guesses; bars are §27 proposals measured for layer 1, read by core/bench/passbars.mjs.
Haul (§27, for testing; R4-1) is Mainland money plus each minted copy at that copy's own first sale on the list. The last-price mark (the measure before R4-1) and the opening price are shadows: "Haul, three ways" below.

| Bar | rule A | rule B | all (· distinct seasons) |
|---|---|---|---|
| The ledger and cash checks (after every errand and every night; a failure stops the season) | 4,985 + 280 checks, 0 failed | 5,007 + 280 checks, 0 failed | 9,992 + 560 checks, 0 failed |
| Buy-late bot below the median haul (≥ 90% of seasons) | 0/20 (0%) | 0/20 (0%) | 0/40 (0%) · 0/26 distinct: 0% of distinct seasons, FAIL (§27: at least 90%) |
| Turtle below the median haul (≥ 90% of seasons) | 8/20 (40%) | 7/20 (35%) | 15/40 (38%) · 9/26 distinct: 35% of distinct seasons, FAIL (§27: at least 90%) |
| Crime pays, with risk: the median robber by haul out-earns the median shift worker, and was arrested at least once | 0/20 (0%) | 0/20 (0%) | 0/40 (0%) · 0/26 distinct |
| Crime pays, with risk, the shadow reading (the bench's before R4-1): the robbers' median haul beats the shift worker's, and the median of their arrests is at least 1 | 0/20 (0%) | 0/20 (0%) | 0/40 (0%) · 0/26 distinct |
| The last night moves < 1/3 of stolen value | 20/20 (100%) | 20/20 (100%) | 40/40 (100%) · 26/26 distinct |
| #1 by haul changes hands ≥ 3 times | 10/20 (50%) | 10/20 (50%) | 20/40 (50%) · 12/26 distinct |
| ≥ 3 betrayals a season | 14/20 (70%) | 14/20 (70%) | 28/40 (70%) · 18/26 distinct |
| A show-worthy event every night | 0/20 (0%) | 0/20 (0%) | 0/40 (0%) · 0/26 distinct |
| ≥ 1/3 of minted traits taken or traded | 1/20 (5%) | 2/20 (10%) | 3/40 (8%) · 3/26 distinct |
| Places matter | 20/20 (100%) | 20/20 (100%) | 40/40 (100%) · 26/26 distinct |
| Most of the drop sells (≥ 3/4) | 0/20 (0%) | 0/20 (0%) | 0/40 (0%) · 0/26 distinct |

A share of seasons (§27's 90%, 30% and half) is a share of distinct seasons: two seasons are one when their events.jsonl match with the rule label stripped. §27 gives the other bars no share of seasons, so they have no verdict across seasons; their counts are the reading. Each "median X" is one seat: the seats ranked by the bar's measure, lowest first, the middle one, or with an even count the lower of the two middle ones (the median robber's ties go to the one arrested fewer times); "the median haul" is the season's over every seat. A trade's Cops, Gunrunners, Smugglers, Chemists and Dealers are the seats that play it: its bots, and a model seat by its trade. Stolen value counts every take by crime, each piece at its copy's own first sale and goods at the city's opening prices.

**Key medians, per season:**

| | rule A | rule B | all |
|---|---|---|---|
| median haul (all agents) | $100 | $100 | $100 |
| median haul: shift | $178 | $166 | $169 |
| median haul: buylate | $233 | $233 | $233 |
| median haul: turtle | $95 | $95 | $95 |
| median haul: scout | $147 | $147 | $147 |
| median haul: guess | $37 | $36 | $36 |
| median haul: crew | $64 | $62 | $62 |
| shift workers a night / wage (medians) | 23 / $37 | 23 / $37 | 23 / $37 |
| rent tabs at the dock (all seasons): agents / paid / pieces taken | 131 / $3,151 / 3 | 131 / $3,166 / 3 | 262 / $6,317 / 6 |
| hired muscle (all seasons): deals / fights / won / cuts paid / walks | 46 / 43 / 24 / 17 / 4 | 47 / 44 / 25 / 18 / 4 | 93 / 87 / 49 / 35 / 8 |
| the median robber's arrests (the crime bar's robber, a season) | 0 | 0 | 0 |
| the robbers' median arrests (the crime bar's shadow reading) | 0 | 0 | 0 |
| last night share of stolen value | 0% | 0% | 0% |
| #1 changes | 2.5 | 2.5 | 2.5 |
| betrayals (kinds, all seasons) | 3.5 (walk 37, rug 22, turn 13) | 3.5 (walk 39, rug 22, turn 13) | 3.5 (walk 76, rug 44, turn 26) |
| show-worthy nights | 9/14 | 9/14 | 9/14 |
| minted taken or traded | 21% | 22% | 22% |
| nights places changed | 6.5/14 | 6.5/14 | 6.5/14 |
| hit landing: sighted vs blind | 88% vs 6% | 89% vs 6% | 88% vs 6% |
| drop sold | 24% | 24% | 24% |
| thefts / arrests / evictions | 15.5 / 1 / 8 | 16 / 1 / 8 | 16 / 1 / 8 |
| fights (all seasons): with backers / backing decided / a target cut a backer of the attack on itself | 481: 189 / 167 / 6 | 483: 191 / 171 / 0 | 964: 380 / 338 / 6 |
| invalid plays (all seasons) | 0 of 8364 | 0 of 8366 | 0 of 16730 |

**Haul, three ways** (R4-1): the official haul values each minted copy at that copy's own first sale on the list; the shadows at its trait's latest list price (the last-price mark, the measure before R4-1) and at its trait's opening price.

| Bar, all seasons (seasons passing · distinct) | copy paid (official) | last-price mark (shadow) | opening price (shadow) |
|---|---|---|---|
| Buy-late bot below the median haul (≥ 90% of seasons) | 0/40 · 0/26 distinct | 0/40 · 0/26 distinct | 0/40 · 0/26 distinct |
| Turtle below the median haul (≥ 90% of seasons) | 15/40 · 9/26 distinct | 13/40 · 8/26 distinct | 8/40 · 5/26 distinct |
| Crime pays, with risk: the median robber by haul out-earns the median shift worker, and was arrested at least once | 0/40 · 0/26 distinct | 0/40 · 0/26 distinct | 0/40 · 0/26 distinct |
| Crime pays, with risk, the shadow reading (the bench's before R4-1): the robbers' median haul beats the shift worker's, and the median of their arrests is at least 1 | 0/40 · 0/26 distinct | 0/40 · 0/26 distinct | 0/40 · 0/26 distinct |
| #1 by haul changes hands ≥ 3 times | 20/40 · 12/26 distinct | 24/40 · 14/26 distinct | 32/40 · 21/26 distinct |

| Median haul, all seasons (each season's, then the median across seasons) | copy paid (official) | last-price mark (shadow) | opening price (shadow) |
|---|---|---|---|
| all agents | $100 | $103 | $196 |
| shift | $169 | $176 | $274 |
| buylate | $233 | $227 | $350 |
| turtle | $95 | $95 | $206 |
| scout | $147 | $148 | $248 |
| guess | $36 | $36 | $36 |
| crew | $62 | $61 | $62 |
| the median robber (the crime bar's robber) | $61 | $70 | $120 |
| the robbers' median (the crime bar's shadow reading) | $61 | $70 | $120 |
| the median shift worker | $155 | $155 | $262 |

Distinct seasons: two seasons are one when their events.jsonl match with the rule label stripped.

**Rule A against rule B:** on 3 of 20 seeds the two rules fought different fights.

Waiting for later layers: the cop and Gunrunner bar and the money bar (layer 2); drugs (layer 3); the vault (layer 4). The model bars (local-model agents against the bots, runner calls inside the ceiling, invalid plays per model) are read where model seats play: `--cast models`.
