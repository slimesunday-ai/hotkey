# AI City — pacing and openings without dice (how to guarantee beats on a no-chance backbone) (research, 2026-10-15)

**Status: research, not a decision.** One of three reports slime asked for on 2026-10-15 to attack the failing §27
bars ("Spawn sonnet for research"), run by a Sonnet subagent on the web. Scope: GAME.md §5–8, §20, §32 only; no code.
External claims carry a URL, GAME.md claims cite sections, and "inference" marks the agent's own reasoning. Caveats
from the agent: Valve's developer wiki sat behind a bot wall (not bypassed), so L4D finale detail is Wikipedia-level;
Fortnite's own site returned 403 (a mirror was used); Valve's slide deck was read in full. Companion reports:
[2026-10-15-ai-city-production-chain-margins](2026-10-15-ai-city-production-chain-margins.md), [2026-10-15-ai-city-season-economies-falling-prices](2026-10-15-ai-city-season-economies-falling-prices.md).

## The answer in 5 bullets

1. **The guarantee is a fixed, public backbone; chance only decorates it.** RimWorld's Cassandra runs major threats on a fixed cycle: first "On" phase on day 11, 4.6 days on, 6.0 off, identical after reload; the one stated random element is a 50-50 chance of 1 or 2 major threats per On phase ([wiki](https://rimworldwiki.com/wiki/Cassandra)). Valve's Director changes how often threats come, not how strong they are: "amplitude (difficulty) is not changed, frequency (pacing) is" ([Booth slides](https://steamcdn-a.akamaihd.net/apps/valve/2009/ai_systems_of_l4d_mike_booth.pdf)). AI City can keep the backbone and drop the dice.
2. **Openings are seeded, not waited for.** Cassandra always opens with one mad animal, then one raider on day 5 ([wiki](https://rimworldwiki.com/wiki/Cassandra)). Dwarf Fortress hardcodes its first two migrant waves and has "never a migration in the first winter" ([wiki](https://dwarffortresswiki.org/index.php/Migrant)). Survivor 41 gave each tribe one pot, one machete and one flint and made them win the rest on day 1 ([CBS](https://www.cbsnews.com/baltimore/news/survivor-41-episode-1-recap-cbs/)). Big Brother US season 18's premiere ran an auto-eviction, crowned the first Head of Household and made nominations ([guide](https://www.pogdesign.co.uk/cat/Big-Brother-US/Season-18/Episode-2)). Night 1 is quiet because its state is empty, so seed the state: a prize, a record.
3. **Finales converge, escalate and switch off the relax valve.** PUBG's circle "forces players closer to each other" ([wiki](https://pubg.wiki.gg/wiki/The_Playzone)); poker blinds rise "between 25% and 50% per round" ([Wikipedia](https://en.wikipedia.org/wiki/Blind_(poker))); Frostpunk's team ended the game at its storm climax and dropped play after it as anticlimactic ([Wikipedia](https://en.wikipedia.org/wiki/Frostpunk)). AI City's "city pushes back" rule (§6) is a relax valve still on at night 14 (inference).
4. **Fixing nights 1 and 14 will not pass the bar alone.** The median season has 5 quiet nights; night 1 is always one and night 14 is one in 3 of 4 seasons, leaving about 3 quiet middle nights (inference). Valve designs for bounded valleys: Relax is time-boxed (30–45 s), then Build Up resumes. Its slides: "Long periods of inactivity are boring" and "Constant, unchanging combat is fatiguing." Bound the quiet streak instead of banning quiet nights.
5. **Don't count on the finale exploding by itself.** End-game defection is real but model-dependent: across 25 LLMs, the newest Google models "universally defect when punishment becomes impossible" while Anthropic frontier models "sustain 57 per cent cooperation in the final round" ([arXiv abstract](https://arxiv.org/abs/2604.18596)). Scripted bots cannot say which way a mixed-model island goes.

## Mechanisms

### Which methods survive the no-chance rule

| Method | Source | Where chance sits | Use |
|---|---|---|---|
| Fixed on/off cycle | Cassandra; Phoebe is 8 on, 8 off from day 13, one major threat per On phase ([wiki](https://rimworldwiki.com/wiki/Phoebe_Chillax)) | the 1-or-2 count, not the timing | Yes; fix the count |
| State-scaled pressure | DF waves from #3 scale with created wealth; sieges start at 80 population and 100,000 wealth ([Siege](https://dwarffortresswiki.org/index.php/Siege)) | none in the scaling | Yes |
| Intensity meter, timed relax; boss slots "shuffled and dealt out" | L4D slides | spawn picks and the shuffle, not the state machine | Yes; fixed order for the deck |
| Priority list plus fallback | CK3 `first_valid`: "Pick the first event for which the trigger returns true"; a fallback runs if none fires ([Paradox wiki](https://ck3.paradoxwikis.com/Event_modding)) | none | Yes |
| Telegraphed clock | Frostpunk: progress "primarily driven by the weather forecast" ([critical play report](https://lab.indienova.com/indie-game-review/critical-play-report-frostpunk/)) | none | Yes |
| Weighted random events | Randy; CK3 `random_events`; DF siege-or-ambush roll | everywhere | No |

### For nights 1 and 14

**1. Bookend shipments. Schedule change.**
- *What:* a crate on night 1 and one on night 14, or a 1/4/7/10/13 cadence so the last crate's holder walks the ferry route carrying it (whether carried goods can be hit on night 14 needs §15; inference).
- *Where used:* the scripted day-5 raider and hardcoded waves above. Fortnite's lead level designer targeted Tilted Towers "as a place where many players could choose to land, and still be able to get enough weapons" ([post mirror](https://devtrackers.gg/fortnite/p/493b6e96-dev-deep-dive-map-update)).
- *Maps to AI City:* Grab exists (§7) and the show already stages "a scramble for the crate" (§20). The crate and the ferry share Low Tide Docks (§6), so a night-14 crate sits where everyone converges.
- *Pros:* one config change; deterministic and public; no new rule.
- *Risks:* with no information, everyone piles in or few do (inference); I did not read how grabs resolve. Crates on nights 1 and 2 front-load wealth, so prefer the 1/4/7/10/13 cadence or a smaller first crate. Contents must be fixed and posted, not drawn, or chance feeds who gets a trait.

**2. Seed the record. Rule change (start state).**
- *What:* a public "Day 0" ledger in the night-1 briefing (everyone logged on arrival, each trade's usual place) and one uniform starting heat so collars are legal (I haven't read §13, so I don't know what counts as "wanted").
- *Where used:* Generative Agents seeded one intent, a Valentine's Day party, and got an invitation cascade ([arXiv](https://arxiv.org/abs/2304.03442)). Diplomacy starts from a fixed public board where geography and convention settle most neutral centres: 82.0% of Austrians open with the same Balkan Gambit, Austria took Serbia in 91.7% of 600 games, and Belgium, the one contested neutral centre, stayed unowned in 22.3% ([zine](https://diplom.org/Zine/S1998M/Anon/1901.html)). Mafia gives some roles first-night information: "The witness is told who the mafia are during the first night" ([Wikipedia](https://en.wikipedia.org/wiki/Mafia_(party_game))).
- *Maps to AI City:* the day animation already reads trade, corner and home as public (§20), so a "likely place by trade" line is a cheap stand-in for sightings (inference).
- *Pros:* symmetric; adds no prize.
- *Risks:* over-informing shrinks "the game inside the game" (§6). It does nothing if there is nothing worth taking on night 1.

**3. Fixed calendar plus a fallback beat. Rule and schedule change, plus the bar.**
- *What:* stack two or three fixed public cycles on the shipments, and add an ordered list of beats (a crate, a warrant window, a police-level swing) with public triggers and a fallback if none qualifies.
- *Where used:* Cassandra's cycle and CK3's `first_valid` (table). RimWorld's storytellers weigh wealth, population and "how long it has been since the last major event" ([wiki](https://rimworldwiki.com/wiki/Storyteller)). Valve's loop always returns from Relax to Build Up, with bosses outside it (slides).
- *Maps to AI City:* a director reads public state (last night's contested plays, unclaimed prizes) and sets opportunities, never outcomes; fights stay strength counts. It is the only item here aimed at the middle nights.
- *Plain terms:* a nightly rule list. The first rule that fits fires; if none fits, a default set piece does.
- *Risks:* quiet-farming (agents go quiet to earn the beat), so key the guarantee to the calendar and let state only escalate (inference). Identical calendars go stale; Frostpunk critics said its story beats repeated each playthrough ([Wikipedia](https://en.wikipedia.org/wiki/Frostpunk)). Every beat needs show staging. A rule keyed to public outcomes is deterministic, but ask counsel whether "unknown until tonight" reads as chance (inference).

**4. Valve off on night 14. One-line rule change.**
- *What:* every district counts as lawless on night 14: no city-cop +2, no heavy +1.
- *Where used:* Valve's Director removes threats "if intensity is too high"; boss encounters are exempt (slides). L4D finales have players "defend a position from an onslaught of infected until rescue arrives" ([Wikipedia](https://en.wikipedia.org/wiki/Left_4_Dead)).
- *Maps to AI City:* §6's "3+ crimes, one level hotter" is a negative-feedback valve (inference) with 13 nights to tighten. §8's table already turns a tied hit into a win in a lawless district.
- *Pros:* tiny; deterministic; thematic (the cops are at the ferry).
- *Risks:* changes nothing if night 14 lets agents lay low (§15 unread). A pure free-for-all lowers variety. Sudden death has no clean analog; an overtime night would break the one-night-per-day clock (§5).

**5. Convergence by closures. Larger rule change.**
- *What:* close two districts a night on nights 11–14 in a public fixed order (never random), so a hit finds nobody less often.
- *Where used:* PUBG's playzone "forces players closer to each other as the game progresses in order to speed up the game", on fixed per-phase delays and shrink rates ([wiki](https://pubg.wiki.gg/wiki/The_Playzone)).
- *Maps to AI City:* extends "the city pushes back, district by district" (§6).
- *Risks:* removes the quiet edges, the only safe places; drops, the fence and the labs need closure rules; biggest build. The timer transfers; the circle's position does not.

**6. Feed the pot: escalating forced bets. Rule change.**
- *What:* route rent into the Evidence Vault so its jackpot grows nightly, and step rent up 25–50% a night on nights 11–14.
- *Where used:* blinds make players "play hands they otherwise might not", rise "between 25% and 50% per round", and "will eventually consume all of a player's stack if they do not play to win more" ([Wikipedia](https://en.wikipedia.org/wiki/Blind_(poker))).
- *Maps to AI City:* rent is already a blind (§7: laying low earns nothing, rent still due), and evicted agents already lose half their cash to hits (§7). A growing vault makes the vault job worth it by some night, with no dice (inference).
- *Risks:* rent that only drains cash leaves nothing to steal unless it feeds a pot. I don't know whether the vault takes inflows. Check the economy and the "cashable" classification.

**7. A show-level ceremony and a better bar. Bar change.**
- *What:* reality shows guarantee beats by structure. Survivor runs a challenge-then-Tribal-Council loop, ends in a jury-voted Final Tribal Council, and added a final-four fire-making duel as of season 35 ([Wikipedia](https://en.wikipedia.org/wiki/Survivor_(American_TV_series))). Big Brother runs a weekly Head of Household, Veto and eviction, then a three-round final and a jury vote ([Wikipedia](https://en.wikipedia.org/wiki/Big_Brother_(American_TV_series))). Its US season 1 ran six nights a week with "minimal competition"; Head of Household came in season 2, Veto in season 3, and the schedule fell to three nights (no reason given; "thin nights" is my inference).
- *Maps to AI City:* stage a night-14 reckoning on the ferry (ledger, grail holders, who got robbed) and a night-1 arrival scramble, and count them as the show's event for those nights. Rewrite the bar: count contested plays that fail (a tie that held) and morning-card changes (Took, Lost, Turned, Booked, Bought, Outbid); require no two quiet nights running, with nights 1 and 14 each holding a staged beat.
- *Pros:* free; re-score the saved seasons.
- *Risks:* a bar loosened to pass is an admission, so keep the old metric beside the new one.

## What doesn't apply

- **Chance-driven selection:** Randy ("truly random", [wiki](https://rimworldwiki.com/wiki/Storyteller)), CK3 `random_events` weights, L4D spawn picks, DF's 25% siege-or-ambush roll ([Siege](https://dwarffortresswiki.org/index.php/Siege)). Cosmetics only.
- **Darkest Dungeon:** stress is a state meter, but at 100 "the base chance to receive a Virtue instead of an Affliction is 25%" ([wiki](https://darkestdungeon.wiki.gg/wiki/Virtue)): a coin. I did not verify its torch mechanic.
- **Hot-drop lures** work by crowding; AI City's value is guessing where rivals are, and a lure erodes it (inference).
- **Chess:** I found no source on how eventful its openings are, so I draw nothing from it. **Auction drafts:** forced nominations matter only if the list is an auction (§3 unread); the known tactic is nominating players you don't want to drain rivals' budgets ([FantasyPros](https://www.fantasypros.com/2025/08/auction-draft-advice-nomination-strategy-fantasy-football/)), a bluff, not pacing.

## Open questions

1. **Rule problem or bot problem?** Does the rule block night-1 hits, or do scripted bots decline to hit without sightings though trade, corner and home are public? A bot using public priors would tell.
2. Does a failed or tied grab, hit or collar count toward the bar? §20 stages every play.
3. How does a grab resolve with many grabbers? Not in my sections.
4. Can agents lay low on night 14, and are the routes public (§15)? Mechanisms 4 and 5 depend on it.
5. Does the vault already take inflows (§13)?
6. Legal: do a published calendar, or a rule keyed to public outcomes, count as "chance"? Counsel.

## Test first

1. **Shipment sweep on the scripted-bot bench, no model calls (schedule only):** baseline; plus night 1; plus nights 1 and 14; cadence 1/4/7/10/13; and a ceiling run with a crate every night. The ceiling separates prize supply from bot demand.
2. **Re-score the same seasons under the valley-bounded bar (bar only, free).**
3. **Night-14 valve-off (one line)**, after reading §15. Build mechanism 3 next if the sweep shows the middle nights are supply-limited.
