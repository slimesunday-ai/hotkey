# AI City — production-chain margins (why flat $15 fails and what player economies do about it) (research, 2026-10-15)

**Status: research, not a decision.** One of three reports slime asked for on 2026-10-15 to attack the failing §27
bars ("Spawn sonnet for research"), run by a Sonnet subagent on the web. AI City figures come from GAME.md §9 and
§31 only. **[inference]** marks the agent's own reasoning. **[excerpt]** marks a claim readable only in search-result
text because the page blocks the fetcher. The agent found no published margin-by-role data for any game below, only
aggregates (CCP's reports) and player anecdotes. Companion reports: [2026-10-15-ai-city-pacing-and-openings-without-dice](2026-10-15-ai-city-pacing-and-openings-without-dice.md),
[2026-10-15-ai-city-season-economies-falling-prices](2026-10-15-ai-city-season-economies-falling-prices.md).

## The answer in 5 bullets

1. **Margins follow scarcity and outside options, then get competed away by entry. No game "spreads" them by design.** In a matched market the side with fewer members takes most of the surplus ([Shapley–Shubik](https://www.math.utoronto.ca/mccann/assignments/477/ShapleyShubik72.pdf); [long-side share vanishes](https://ar5iv.arxiv.org/html/1404.6103)). Upstream stays paid where something scarce or bounded sits under it: finite resources (SWG, Eco), an NPC buyer's floor (UO, RuneScape, BDO, Albion), or downstream buyers with non-cash motives (UO crafters "gladly traded gold for skill points", so gold flowed to miners; [Koster](https://www.raphkoster.com/?p=16263)). The commodity price is where shocks land: EVE's mineral price index fell ~52% over the year to Feb 2026 and rose 9% in April alone ([Feb thread](https://forums.eveonline.com/t/monthly-economic-report-february-2026/507779); [April report](https://www.eveonline.com/news/view/monthly-economic-report-april-2026)); neither states a cause.
2. **Flat $15 is a convention, not an equilibrium, and LLM agents are good at conventions.** LLM populations converge on shared conventions ([Ashery et al.](https://pmc.ncbi.nlm.nih.gov/articles/PMC12077490/)). LLM pricers drift to supracompetitive prices, and prompt wording moves the level ([Fish et al.](https://arxiv.org/abs/2404.00806)). A shopkeeper agent priced below cost and raised one price in a month ([Project Vend](https://www.anthropic.com/research/project-vend-1)). 80–100% of shopping agents took the first offer ([Magentic Marketplace](https://www.microsoft.com/en-us/research/publication/mage/)). Whether an LLM splits evenly or squeezes shifts with prompt complexity ([INFORMS](https://pubsonline.informs.org/doi/fpi/10.1287/deca.2025.0396)) **[excerpt]**.
3. **By GAME.md's numbers, chems are the scarce stage** [inference]. Two chem drops × 6 = 12 chems → 30 doses a night; the 8 corners absorb 48+. The marginal dose is worth ~$32 at 30 doses and ~$21 at 48, so a chem (2.5 doses) is worth $53–80 to the street. It sells at $15 while the shop's first unit costs $25. Flat prices leave that rent with the stage where money enters.
4. **Prices alone can pass the bar if headcounts cooperate** [inference]. At 6 Smugglers / 5 Chemists / 6 Dealers, $15/$15 gives max/min ≈ 4.0 (your harness: 3.9). Chems at $25–30 and doses at $20–25 give 1.3–2.0, with every trade above $46 a night ($650 / 14). The Smuggler bar is a headcount identity: 12 chems × a shop-capped $25–33 ≈ $300–400 a night, room for 6–8 chem Smugglers.
5. **Double marginalization and the bullwhip matter less here than the textbooks suggest** [inference]. There are several agents per stage, no production lead time, and one trade per agent (which blocks vertical integration). The live failures are focal pricing, first-offer acceptance and cartels. Taxes and fees do not move margin upstream.

## Illustrative arithmetic [inference; headcount 6/5/6 is my assumption]

Per night: 12 chems → 30 doses, 5 doses per Dealer on 4 hot + 2 normal corners (street ≈ $1,179). Corner revenue for k doses = 360·(1−0.9^k), ×1.5 hot; this reproduces GAME.md's $169, $253 and $1,687 (48 doses). Smuggler = 12·chem/6; Chemist = (30·dose − 12·chem)/5; Dealer = (1,179 − 30·dose)/6.

| Chem / dose price | Smuggler | Chemist | Dealer | max/min |
|---|---|---|---|---|
| $15 / $15 | $30 | $54 | $122 | 4.0 |
| $25 / $20 | $50 | $60 | $97 | 1.9 |
| $25 / $25 | $50 | $90 | $72 | 1.8 |
| $30 / $25 | $60 | $78 | $72 | 1.3 |

Fully competitive prices (dose ≈ $32) would leave Dealers ≈ $36 a night, below a shift. The shop's $25 ceiling is doing useful work; keep it.

## Mechanisms

**M1. Shop-anchored asks and marginal-revenue bids (the NPC band). Habit only.**
- *What:* Each stage has an NPC fallback. Inside that band, scarce inputs sell near the ceiling and abundant ones near the floor.
- *Used in:* UO shops cut their buy price "eventually to zero" as stock rose, which Koster calls "a subsidy" ([Koster](https://www.raphkoster.com/?p=16263)). RuneScape spends part of its 2% Grand Exchange tax buying items "to regulate their price" ([OSRS wiki](https://oldschool.runescape.wiki/w/Grand_Exchange)), and High Alchemy pays 60% of an item's value, so buying below that (less the rune) is profit ([alch](https://oldschool.runescape.wiki/w/High_Level_Alchemy)). BDO sets a developer min and max per item ([guide](https://grumpygreen.cricket/bdo-central-market/)) **[excerpt]**.
- *AI City:* The chem band is $8 (buyer) to $25+ (shop, +15% a unit). $15 sits near the midpoint ($16.50), the answer if both sides were equally scarce [inference]. Chems are scarce, so ask just under the shop's current price. Chemists ask $20–25 for doses, about 50–65% of the corner's expected average, which the public schedule gives. Smugglers also carry robbery risk (§9), which a flat price never pays for.
- *Risks:* Pushes rent upstream. Doses have no NPC ceiling (the shop does not sell them), so Chemists could squeeze Dealers; a dose line at the shop, priced like chems, would complete the band (rule change) [inference]. Same-role cartels form fast: [Fish et al.](https://arxiv.org/abs/2404.00806) (oligopoly pricing); [Lin et al.](https://arxiv.org/abs/2410.00031) (Cournot agents divided markets uninstructed); [Andon Labs](https://andonlabs.com/blog/opus-4-8-vending-bench) (price-fixing, market allocation, price-war threats).

**M2. Formula prices and in-kind tolling. Habit if typed offers carry shares or swaps; otherwise a rule change.**
- *What:* Pay each stage a share of the next stage's price, not a fixed cash price, so its income follows the final price. In the one-retailer case revenue sharing coordinates a chain and splits its profit any way you choose ([Cachon & Lariviere](https://www.kellogg.northwestern.edu/faculty/lariviere/research/revshare.htm)). In labs it helps less than theory predicts ([Katok & Wu](https://ideas.repec.org/a/inm/ormnsc/v55y2009i12p1953-1968.html)).
- *Used in:* Eco has a contract-based labor market and lets owners "charge a fee" for crafting machines ([Steam page](https://store.steampowered.com/app/382310/Eco/)). WoW crafting orders pay a posted commission ([Blizzard](https://worldofwarcraft.blizzard.com/en-us/news/23876529)) **[excerpt]**. EVE courier contracts price transport risk with collateral ([EVE Uni](https://wiki.eveuniversity.org/Contracts)).
- *AI City:* The Chemist keeps 1 dose in 5 as a cook fee, or chem price = a fixed share of 2.5 doses' price. Two stale cash prices become one share you can sweep.
- *Risks:* Secret simultaneous plays turn consignment into a trust problem. Held doses can be taken. The fence takes 20% of swaps (§9), so peer deals must avoid it.

**M3. Scarcity dial: drop yield, chem-drop count, headcount, dealer cap. Rule change (numbers).**
- *What:* Margin sits with the scarce stage, so set the chems-to-street ratio on purpose.
- *Used in:* SWG resources were finite and randomized; "once a resource was mined out, it was gone forever" ([Koster](https://www.raphkoster.com/2015/04/21/designing-a-living-society-in-swg-part-one/)). Eco's trees do not regrow unless planted ([Krajewski](https://www.gamedeveloper.com/design/building-a-global-survival-game)). EVE's industry cost index exists "to provide an incentive for players to spread out" ([CCP Fozzie](https://evenews24.com/2014/07/26/dev-post-ccp-fozzie-on-post-crius-industry-scaling/)). Albion gives each royal city a +40% refining bonus for one resource ([wiki](https://wiki.albiononline.com/wiki/Resource_return_rate)) **[excerpt]**.
- *AI City:* 19 chems a night would match the street's 48 doses; at 12, chems are scarce. With 12 chems × $25–33, the Smuggler bar fails above ~8 chem Smugglers whatever agents do [inference]. A riskier drop with a bigger yield would price robbery risk in the rules [inference].
- *Risks:* Tuned to one headcount. Crowding at shared drops (your GovSim lesson). Too much yield drops chems to the $8 floor (UO's "overproduction and deflated prices", [Simpson](https://gwern.net/doc/economics/mechanism-design/1999-04-07-simpson-theingameconomicsofultimaonline.html)).

**M4. Public bid/ask board with price ticks and relist friction. Rule change.**
- *What:* Standing buy orders as well as asks, a last-price history, coarse price steps, and a cost to change an order.
- *Used in:* EVE has regional buy orders and a broker fee not refunded on cancel ([EVE Uni](https://wiki.eveuniversity.org/Market)). In 2020 CCP capped prices at 4 significant figures and added a relist charge because "competition between traders comes down to who ... can micro-manage their orders" ([CCP](https://www.eveonline.com/news/view/broker-relations)). BDO has pre-orders ([Inven](https://invenglobal.com/articles/6290/black-desert-online-basics-guide-how-to-use-the-marketplace)) **[excerpt]**. A double auction's structure alone gave near-100% efficiency with random traders, though the result is disputed ([review](https://arxiv.org/pdf/0909.1974)).
- *AI City:* Chemists post bids for chems and Dealers for doses, so derived demand shows up as a price. A $1 tick stops penny-undercutting.
- *Risks:* First-proposal bias ([Magentic Marketplace](https://www.microsoft.com/en-us/research/publication/mage/)). "The big guys can essentially dictate prices by undercutting everyone", and a global board erases local price variation, which SWG avoided on purpose ([Koster](https://www.raphkoster.com/2012/03/20/do-auction-houses-suck/)). Simultaneous settlement needs a fill rule.

**M5. Capped upstream outlet. Rule change.**
- *What:* A small city purchase (say 4 chems a night at ~$20), not a higher open-ended floor.
- *Used in:* Albion's Black Market buys crafted gear from players and feeds it into monster loot; drops had been rare "as we did not want to interfere with the player-driven economy" ([official post](https://albiononline.com/news/video-black-market-feature)) **[excerpt]**.
- *AI City:* A buyer base of $12 lets a lone Smuggler clear $56 for 6 units, above a shift, which breaks §9's "leaning on the city earns less". A cap keeps cooperation worth more.
- *Risks:* Becomes a faucet and a subsidy (Koster, above). Kills inter-agent trade if uncapped.

**M6. Public income-by-trade board at the day-0 choice. Information rule.**
- *What:* Show last season's median by trade so entry equalizes.
- *Used in:* Every game here relies on players moving to the better-paid job; I found none that publishes it as a feature [inference].
- *Risks:* Cobweb swings and herding between seasons [inference].

## What doesn't apply

- **Taxes and fees as a margin tool.** RuneScape's GE tax is an explicit sink ([OSRS wiki](https://oldschool.runescape.wiki/w/Grand_Exchange)); CCP's 2019 raise gives no rationale ([CCP](https://www.eveonline.com/news/view/updates-to-sales-taxes-and-brokers-fees)). They thin the seller's net, and AI City already has sinks (rent, the fence's 20%).
- **Vertical integration.** It is the textbook cure for double marginalization ([Spengler, summarized](https://papers.sioe.org/paper/592.html)), but SWG shows the cost: "most entrepreneurs chose to set themselves up as harvester/crafter/merchants, owning the entire supply chain" and "the richest were insanely rich" ([Koster](https://www.raphkoster.com/2015/04/21/designing-a-living-society-in-swg-part-one/)). The one-trade rule keeps it out.
- **Double marginalization itself** needs successive monopolists. With several agents per stage the failure runs the other way (too low, not too high). It bites only in a locked two-party deal.
- **Bullwhip.** It comes from repeated ordering against inventory and delays ([Lee et al.](https://ideas.repec.org/a/inm/ormnsc/v43y1997i4p546-558.html); [Sterman](https://ideas.repec.org/a/inm/ormnsc/v35y1989i3p321-339.html)). LLM Beer Game runs do amplify (one uncontrolled vendor run: factory peak 59 vs 18 for humans, [Happily](https://happily.ai/research/beer-game-ai-agents/); [AIM-Bench](https://arxiv.org/abs/2508.11416) finds human-like biases), but AI City settles at once.
- **Skill-grinding demand.** UO crafters bought inputs for skill points, not profit ([Koster](https://www.raphkoster.com/?p=16263)). AI City has no XP.
- **Long-run entry.** EVE and Albion margins have months to equalize; here the trade is fixed for 14 nights.

## Open questions

1. What are the harness's role counts, and how many chems and doses actually move per night? Compare doses cooked with the 48 the corners absorb. This decides whether pricing alone can pass the Smuggler bar.
2. Do typed offers allow bids, item-for-item swaps, or share-of-price terms? Does the fence's 20% apply to them?
3. Are parts Smugglers in the "Smuggler" median? Their money enters through guns, not the street, so they need a separate pie.
4. Are trades assigned or chosen in the test? If chosen, M6 changes the mix.
5. Real agents differ in model quality; in Anthropic's Project Deal, stronger-model users got better deals and the losers did not notice ([coverage](https://www.unite.ai/anthropics-project-deal-lets-claude-agents-trade-real-goods/)). Trade medians could track model mix.
6. Can doses be held between nights? Held stock means robbery risk and bullwhip-style swings.
