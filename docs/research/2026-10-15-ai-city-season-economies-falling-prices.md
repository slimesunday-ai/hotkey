# AI City — season economies and falling-price sales (beating the wait-and-hoard failure) (research, 2026-10-15)

**Status: research, not a decision.** One of three reports slime asked for on 2026-10-15 to attack the failing §27
bars ("Spawn sonnet for research"), run by a Sonnet subagent on the web. Read: GAME.md §2–4, §15–16, §27 only.
"Inference" and "(calc)" mark the agent's own reasoning and arithmetic, not sourced claims; the final section lists
which sources were opened. Companion reports: [2026-10-15-ai-city-pacing-and-openings-without-dice](2026-10-15-ai-city-pacing-and-openings-without-dice.md),
[2026-10-15-ai-city-production-chain-margins](2026-10-15-ai-city-production-chain-margins.md).

## The answer in 5 bullets

1. **A known, falling price is an interest rate paid to savers.** With no stock-out risk, waiting beats buying early unless owning the piece pays more per night than the price falls. Calc: that is about 7–10% of the opening price per night at -10%, and 10–18% at -20% (waits of 2–8 nights). Flex pay ($10/$25/$50, §4) clears it only if a rare opens under about $140, an epic under about $305, a grail under about $525 (calc; assumes no sale in between). This is the durable-goods "Coase" problem: "Rationally anticipating falling prices causes most potential buyers to wait for future lower prices" ([McAfee & Wiseman 2008](https://mc4f.ee/Papers/PDF/Coase.pdf); also [Su 2007](https://ideas.repec.org/a/inm/ormnsc/v53y2007i5p726-741.html)). "Never reprinted" fixes the quantity, which helps; the public price-cut schedule is what invites waiting (inference). The 20% candidate helps bar 2 and hurts bar 1: both bars pull on one dial.
2. **The 63-copy test is the textbook fix: rationing.** 44% × 143 ≈ 63 copies, so 63 is about what the island already buys (calc). Deliberate understocking makes waiting risky ([Liu & van Ryzin 2008](https://ideas.repec.org/a/inm/ormnsc/v54y2008i6p1115-1131.html)). Royal FloraHolland capped each grower's daily volume and raised minimum prices on some products; unsold stock was 1.9% on 1 April 2020 ([AIPH](https://aiph.org/?p=17299)). Metering the list should give that scarcity without shrinking the posted drop (inference).
3. **Games don't beat hoarding by taxing cash.** They wipe stockpiles but carry identity: Rust's monthly wipe keeps learned blueprints ([GameSpot](https://www.gamespot.com/articles/rust-force-wipes-schedule-explained/1100-6505244/)), D4 moves the character to the Eternal Realm and leaves the seasonal stash in a withdraw-only tab ([Icy Veins](https://www.icy-veins.com/d4/news/what-happens-to-my-diablo-4-seasonal-characters-at-the-end-of-season-1/)), PoE leagues merge into Standard ([wiki](https://pathofexile.fandom.com/wiki/League)). They charge upkeep on built goods ([Rust](https://rust.facepunch.com/blog/devblog-189)), pay holders a flow ([Travian Kingdoms](https://support.kingdoms.com/en/articles/58-victory-points): 1 VP per treasure per day), or run use-it-or-lose-it with a bank ([LoL](https://support.riotgames.com/en-us/league-of-legends/gameplay/placements-promotions-series-demotions-and-decay)). Taxes on trades (OSRS, EVE) hit spenders, so they point the wrong way for bar 1. Hard forfeiture draws complaints ([Marvel Rivals](https://www.gfinityesports.com/article/marvel-rivals-introduces-battle-pass-points-conversion-feature)), so convert instead of deleting.
4. **Separate price discovery from the reward for waiting.** Price protection ([Art Blocks](https://docs.artblocks.io/creator-onboarding/artists/minters/): every buyer ends at the final price) or a fast-then-slow decline lets the price find its level quickly without paying savers to wait.
5. **Bar 1 may partly be an artifact (inference; check the code).** Cash counts 1:1 with goods, and traits are marked at "last sold". If that mark is shared by all copies of a trait, a saver's cheap late buy marks every earlier buyer's copy down. Also, 16–24 of 40 is 0±0.25σ and 36 of 40 needs +1.28σ (calc: normal quantiles, assuming a roughly normal gap; σ = season-to-season spread of saver minus median), a big shift for one rule to deliver.

## Mechanisms

Type: R = rule change, N = number change, B = change to the bar.

**1. Price protection against later cuts (R).**
- *What:* pay the posted price now. At close, refund any excess over the lowest price that trait later sold for.
- *Used:* Art Blocks' "Dutch Auction with Settlement": "All collectors pay the same final price", with the difference refunded; recommended for high-demand drops ([docs](https://docs.artblocks.io/creator-onboarding/artists/minters/)). Theory: most-favored-customer protection lets a seller who can't precommit charge more up front, though in Png's model some capacity can go unsold ([Png 1991](https://ideas.repec.org/a/ucp/jpolec/v99y1991i5p1010-28.html), abstract only).
- *AI City:* refund only against later sales. AI City prices also rise (+20%), so refunding to the all-time low would erase hot traits' rises (inference). Waiting then buys no discount, so a fast decline can be kept for price discovery.
- *Risks:* the cash sink shrinks (more cash boards unspent); early buyers' cash is locked until close; a crew can rebate its own early buyers with one late floor-price buy; the ledger needs a settlement step, and the haul mark must follow it. Check bar 2 (Png's unsold-capacity caution).

**2. Metered list (R).**
- *What:* at most k copies of a trait (k = 1–2) go on the list per night. A night's unused slots lapse.
- *Used:* FloraHolland's 2020 quota (above). Supreme drops limited quantities weekly ([MBS](https://www.thembsgroup.co.uk/internal/the-drop-a-lesson-in-artificial-scarcity-and-cool/), marketing commentary). Filene's Basement's automatic markdown (25/50/75% then charity) sold 90% of items in the first four weeks, per a company spokeswoman ([Rutland Herald](https://www.rutlandherald.com/news/after-96-years-filenes-basement-alters-markdown-policy/article_b1f747e4-332e-522b-9756-aa3ae17cd200.html)); I infer one-off items make waiting risky.
- *AI City:* slots are plentiful (a 5-copy common has 12 nights, a 1-copy grail 3), so full sell-through stays possible. A saver can take at most 2k copies of any trait in the last two nights.
- *Risks:* with k = 1, exact ties are likely (see 7). Hot traits climb +20% a night. Bar 2 now depends on bots bidding on enough nights; if you count only copies offered, that is a bar change (B).

**3. Fast-then-slow decline (N).**
- *What:* -20% a night for the first 2–3 nights after a wave opens, then -3 to -5%.
- *Used:* theory says the right path depends on buyers' patience: markdowns when high-value buyers are impatient, rising prices when they are patient ([Su](https://ideas.repec.org/a/inm/ormnsc/v53y2007i5p726-741.html)). Slow Dutch auctions earn more when waiting is costly ([Carare & Rothkopf](https://ideas.repec.org/a/inm/ormnsc/v51y2005i3p365-373.html)); announced versus contingent discounts differ for forward-looking buyers ([Aviv & Pazgal](https://iaorifors.com/paper/64211)).
- *AI City:* at -10%, a price takes 6.6 nights to reach half its opening level and 11.4 to reach 30%; at -20%, 3.1 and 5.4 (calc). Slow discovery is a likely reason stock is still unsold at close (inference).
- *Risks:* alone it feeds savers. Pair it with 1. A late floor that is too high repeats the usual reserve trade-off: fewer sales.

**4. Per-copy price ladder (R, small).**
- *What:* each copy sold lifts the next price ×1.2, instead of one lift per night with a sale. Decay of about 6–8% applies every night, as in GDA.
- *Used:* Paradigm's Gradual Dutch Auction. Each successive unit starts higher by a fixed scale factor and decays exponentially over time ([Paradigm](https://www.paradigm.xyz/2022/04/gda); the page's formulas didn't extract).
- *AI City:* to pace c copies over n nights, set decay y = 1 − 1.2^(−c/n): 7.3% commons, 7.8% rares, 5.9% epics and grails (calc; steady state, assumes demand exists at the clearing price). The current rule, while a price is off its floor, settles at a sale on about 37% of nights whatever the stock (55% at -20%) (calc), so it doesn't aim at clearing the stock.
- *Risks:* volatile for 1–2-copy traits; needs tuning.

**5. Spend-linked ferry allowance (N).**
- *What:* cash converts 1:1 up to an allowance (for example, what you spent on the list), then at a worse rate. §15 says the rate is "set before Season 1", so this is a number.
- *Used:* 7 Wonders scores 3 coins per point and leftovers score nothing ([BGA](https://be.doc.boardgamearena.com/Gamehelpsevenwonders)). LoL decay spares players who play: games earn banked days ([Riot](https://support.riotgames.com/en-us/league-of-legends/gameplay/placements-promotions-series-demotions-and-decay)). Blizzard stopped resetting WoW's Valorstones each season ([Warcraft Tavern](https://www.warcrafttavern.com/wow/news/development-notes-for-patch-11-2-ghosts-of-karesh-in-the-war-within-class-adjustments-raid-rewards-character-bank/), summary only).
- *AI City:* a saver can still dodge it by spending on leftovers, so it only bites once little is left to buy (2, 3).
- *Risks:* feels punitive if the allowance is small. It touches the Kingpin title and the "half its cash" last-night hit. The haul counts Mainland money, so it moves the saver's score by construction (a measurement shortcut, not evidence of a better design).

**6. Yield on goods (N).**
- *What:* raise flex pay, or let it grow with nights worn.
- *Used:* Travian Kingdoms scores each active treasure 1 VP a day ([Travian](https://support.kingdoms.com/en/articles/58-victory-points)). Rust upkeep drains resources from the cupboard so a base isn't "free forever" ([Facepunch](https://rust.facepunch.com/blog/devblog-189)).
- *AI City:* the break-even in bullet 1 gives the target: yield must exceed the nightly fall.
- *Risks:* snowballing (bar: #1 must change hands, §4/§27). More flex also raises the bounty on wearers, since a hit takes the rarest piece worn (§4).

**7. Deterministic tie-break (R, small).**
- *What:* replace "tie = nobody" with a chance-free order: earlier offer, then fewer copies of that tier, then lower id (§4 already ends takes at lower id).
- *Used:* eBay's help page describes losing to an earlier equal bid ([eBay](https://pages.motors.ebay.com/help/buy/contextual/bidding.html)).
- *AI City:* bots that offer exactly the posted price will tie often once demand exceeds supply (inference), and each void tie leaves a copy unsold. Count them first.
- *Risks:* if "earlier" means real arrival time, it favors fast models. Prefer game-state keys (copies held, then id).

**8. Activity-linked close (R).**
- *What:* the list runs one more night (max night 13) after a night 12 with a sale.
- *Used:* eBay's hard close drew far more last-second bids than Amazon's extension "until ten minutes have passed without a bid" ([Roth & Ockenfels](https://www.cs.princeton.edu/courses/archive/spr08/cos444/papers/roth_ockenfels02.pdf)). Foundation extends its clock on late bids ([paper](https://ar5iv.labs.arxiv.org/html/2109.12321)); Travian's round ends when one alliance finishes a Wonder ([Travian](https://support.travian.com/en/articles/153-building-a-world-wonder)). FCC auctions keep eligibility only for bidders who stay active ([FCC](https://www.fcc.gov/sites/default/files/wireless/auctions/38/releases/da002291.pdf)).
- *AI City:* blurs the "last two nights" focal point. An FCC-style eligibility rule is the heavy version; test it last.
- *Risks:* costs night 13's "nothing left to buy" beat; agents may buy a copy just to keep the list open.

**9. Haul mark (B).**
- *What:* value minted traits at price paid, or at the trait's average list sale, not "last sold".
- *Risks:* changing a bar to pass is slime's call. Run it as a sensitivity check first; if the saver's rank barely moves, the mark isn't the cause.

**Test first:** step 0, free: count void ties, and re-run bar 1 with price-paid marking (9). Then 1 with 3 as its number change; 2 with 7; then 5. Fall back to 4 if 1 is rejected.

## What doesn't apply

- **Raffles and random draws.** Nike's SNKRS Draw selects entries at random ([Nike](https://www.nike.com/gb/help/a/nike-launch-drawing)), so it and random mints fail the no-chance rule. A candle auction (random end time) would too (inference). Surviving: auctions, posted prices, caps, queues, deterministic tie-breaks, tranches.
- **Taxes on trades.** OSRS's 1% Grand Exchange tax funds an item sink Jagex says will "help with inflation" ([Jagex](https://oldschool.runescape.wiki/w/Update:Grand_Exchange_Tax_%26_Item_Sink)); EVE charges broker fees and sales tax ([EVE](https://support.eveonline.com/hc/en-us/articles/203218962-Broker-Fee-and-Sales-Tax)). Both tax movement, not holding. EVE has no seasons or wipes; CCP publishes monthly sink and faucet totals ([report](https://www.eveonline.com/es/news/view/monthly-economic-report-november-2024)).
- **Demurrage money.** Wörgl's stamp scrip has contested evidence ([Mises](https://mises.org/library/free-money-miracle)), and a pure decay feels punitive (inference). A bonus framed as a discount is the gentler form (Thaler's surcharge-versus-discount idea, via [Money](https://money.com/credit-card-surcharges-spending-habits/), secondary).
- **Wipes themselves.** The 14-night season is already one; the ferry is the carry-over rule (inference).
- **Real-time clocks.** FloraHolland's clock sells millions of lots in a few hours ([Thursd](https://thursd.com/articles/floriculture-explained-how-the-clocks-of-royal-floraholland-work)), so each descent is short. AI City's runs 12 nights, a slow Dutch auction where delay costs bidders (Carare & Rothkopf, above).
- **PoE's "each currency item is its own sink"** ([GGG, 2011](https://www.pathofexile.com/forum/view-thread/55102)) works only if Mainland money gets a use on the island (inference).

## Open questions

1. Is the haul's trait value one "last sold" price shared by every copy? Re-run bar 1 with price-paid marking to see how much of 16–24/40 is the mark.
2. How many unsold copies were void ties, and what are the opening prices against flex pay and tool yields? My break-even ceilings need real numbers.
3. What is the standard deviation of saver minus median per season? It sizes the effect needed for 90%.
4. Does the saver still work and steal? What do commons' tools pay?
5. Did the 63-copy run cut copies per trait or traits? That says which rationing works.
6. Do LLM agents wait like the bot? If they buy early by default, bar 1 may be a scripted-bot artifact.

## Source quality

Opened and read: Art Blocks, Paradigm GDA (formulas missing from the page text), McAfee & Wiseman, Rust devblog 189, Riot decay page, OSRS update, GGG diary, Roth & Ockenfels, Travian and Kingdoms support, BGA 7 Wonders, Filene's and Marvel Rivals articles, FloraHolland pages, Foundation paper. Abstracts only: Su, Liu & van Ryzin, Carare & Rothkopf (tool summaries); Png, Aviv & Pazgal (search summaries). Search summary only or page blocked: Rust wipe cadence, D4 migration (sources conflict on gold), PoE league end, EVE fees and report, FCC activity rule ([Auction 38](https://www.fcc.gov/sites/default/files/wireless/auctions/38/releases/da002291.pdf)), eBay tie rule, WoW Valorstones. Not found: a Facepunch statement of why Rust wipes, an official Blizzard rule on D4 gold, Travian's overflow rule.
