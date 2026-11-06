# AI City — how a night should play (turn-structure analogues) and open-source code to borrow for the rules core (research, 2026-10-14)

**Status: research, not a decision.** *(Update, 2026-10-14: slime approved the night game with places, and it's now
the official design, `docs/GAME.md`, which carries this page's findings in its Part 5.)* Two Sonnet agents ran on 2026-10-14 at slime's request ("Do we have all the research
we need on game simulations, closest analogue, github repos we could borrow from for logic, etc...? ... If you do research
it's sonnet only"). Claude checked the licences (the LICENSE files in the downloaded repos), the RuneScape shop formula, the
GovSim split function and the claims taken from our own sim. External quotes are the agents' own, with URLs; Claude didn't re-fetch them.

## How a night should play

The question: (1) a **night game**: one secret play a night, all resolved at once, and the city replays it; (2) a **live map
game**: position, routes and cargo decide outcomes in real time; (3) a **hybrid**: one play a night that includes a route or
destination.

**Closest analogues, ranked:** Diplomacy and AI Diplomacy (private talk, secret orders resolved at once, no dice; LLMs play
it on stream) · ClawCity and onHood (2026 crime worlds for agents; scale second-hand) · SpaceMolt (agent MMO, 10 s ticks) ·
Subterfuge and Neptune's Pride (slow real-time betrayal) · Torn, Mafia Wars, Omerta (crime loops on daily action budgets) ·
Drug Wars (30 days, one trip a day) · GTA Online businesses and EVE hauling (cargo hit in transit) · Screeps, Schedule I.

**Evidence:**
- **Live map, agents:** SpaceMolt's large operators script the moment-to-moment play ("Scripts are cheaper than tokens";
  an AI planner for 200+ agents "almost always overwhelmed them"); agents "mostly just bumped into each other politely"
  until NPC pirates were added; three player-to-player trades in month two. Our own sim v2 agrees (checked): ~30 s per
  decision, targets walk off while an agent thinks, "two agents rarely meet and decide in the same window"
  (sim v2, 2026-09-23); ~80% of street meetings couldn't become interactions while travelling
  (a structural audit, 2026-10-10).
- **Live map, humans:** real-time async strategy costs players sleep (a Subterfuge diary; a Neptune's Pride player:
  "literally unhealthy"); both games added order queues or a turn mode.
- **Night game:** the AI Diplomacy harness works (30 s per answer, retry, then a default hold). 50,000 people watched it
  live on Twitch, and its makers call the phase-replay viewer "in some ways ... the product". Daily budgets suit brief
  check-ins (Torn since 2004; Neptune's Pride: "five-to-ten minutes of gameplay").
- **Cost:** v4's ceiling is 14 model calls an agent a day. A live map at one call per 100 s is 864 a day (~60×). A top-model
  Diplomacy game "can cost over $100 without any retries"; a 24B model finishes one for about $1 (arXiv 2508.07485).
- **Hybrid:** the same number of calls with bigger prompts. Play quality fell as prompt information grew, and 6–14% of
  orders were invalid even with a list of legal moves (arXiv 2508.07485).

**Mechanics worth borrowing:** queued nights plus an "if nothing changes" preview (Subterfuge) · list every legal order,
describe the board as a story, keep the tool list short (SpaceMolt cut 60+ commands to 11) · police heavy downtown and light
at the edges (SpaceMolt, ClawCity) · witnesses are whoever shares the place (an Among Us agent sandbox) · an optional risk
premium (GTA's bonus for selling in public sessions) · NPC pressure so crime happens (SpaceMolt's pirates) · scripts for
mechanics, the model for judgment (v4's standing orders) · no-show rules (webDiplomacy's reliability rating, early
processing once everyone is ready).

**The agent's conclusion (inference):** the night game as the core, not the live map; optionally a thin map: one district a
night from about 8, server pathfinding, conflicts between whoever ends the night in the same district, the city animating
the walk. Test it first on night 14 (the walk to the dock), and measure in a $0 bench how often location changes a result.

**Gaps the agent marked UNVERIFIED:** Torn's offline and in-transit rules; EVE ganking's effect on retention; ClawCity and
onHood's scale; why Schedule I and Mafia Wars declined; long-run retention for Subterfuge and Neptune's Pride; head-to-head
spectator data; its own cost extrapolation.

## Code to borrow for the rules core

No full engine to adopt. v4's "a backer that's attacked never arrives" removes the dependency cycles that make Diplomacy
adjudicators big, so the fight core is a set computation: collect the attacked set, drop cut backers, compare group
strengths.

| Borrow | Licence (checked) | What |
|---|---|---|
| DATC v3.0 (webdiplomacy.net/doc/DATC_v3_0.html) | chapter-6 cases free to copy | ~25 cases from 6.D/6.E as fight tests (support = backing; ties hold; tied attackers all fail). Skip coasts, convoys, retreats, builds and 6.D.17. Add a shuffle-the-plays test: every order gives the same result. |
| rs-sdk (github.com/MaxBittker/rs-sdk) | MIT (repo, engine and content) | `[proc,calc_shop_value]` in the shop scripts: price = base × max(0.1, (shopbuy − clamp(stock delta × haggle)) / 1000); one unit restocks per `stockrate` ticks (`World.ts`). On a simultaneous night, split sales pro rata or use one opening price, and publish the curve. Take the formula, not RuneScape's content. |
| GovSim (github.com/giorgiopiatti/GovSim) | MIT | `_assign_proportional` in `simulation/scenarios/common/environment/concurrent_env.py`: split a depleting pool by share wanted ("more smugglers at one drop, less each"). Use largest remainder with an id tie-break, not RNG. |
| boardgame.io | MIT | The idea only: per-player view filtering (`src/master/filter-player-view.ts`). Build views from an allow-list and canary-test every secret field. |
| Concordia (google-deepmind) | Apache-2.0 | `call_limit_wrapper.py`: a call ceiling with a default answer (v4's 14 calls plus default play). |
| AI Diplomacy (paper arXiv 2508.07485) | code non-commercial | Patterns only: list legal moves, retry, default; negotiation rounds; message limits. |

**Don't use:** AI Diplomacy's code (non-commercial licence); GPL/AGPL adjudicators (godip, 1901, the Python `diplomacy`
package, webDiplomacy, jDip), because copying makes the server copyleft; any full adjudicator or Kruijswijk's guess
algorithm; boardgame.io or Colyseus as the runtime; Concordia's LLM game master (a model invents outcomes, which breaks
"the rules decide"); TextArena (secrecy by omission); Screeps (order-dependent ties); Werewolf Arena (archived).

**Spec flag for GAME-v4 §7:** v4 cuts a backer attacked by anyone. Diplomacy exempts an attack from the target itself
(DATC 6.D.15) and from the same side (6.D.20). As written, a target cancels a backed attack on it by hitting one backer.
Decide on purpose and test both. Also unspecified: whether a patrolling cop's join is cut when the cop is hit.
