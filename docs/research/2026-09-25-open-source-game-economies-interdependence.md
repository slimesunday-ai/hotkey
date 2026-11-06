# Open-source game economies (rs-sdk, ServUO, Mafiasource, TravianZ, AI Economist, Melting Pot…) — how classless games make players need each other

Research for AI City, 2026-09-25, by an Opus subagent that shallow-cloned and read (never ran) the repos; Claude verified the
rs-sdk shop formula and ServUO's harvest banks in the clones. Question: with no jobs, doing the whole chain yourself beat specialising
(AI City's v2 sim, 2026-09-23) — how do adjacent games create interdependence?

**Answer: no game uses job penalties (option C). They share a scarce thing at every step:** a patch that depletes when several dig it, a
buyer that pays everyone less each time anyone sells, an outlet one person owns, a cart that carries only so much. The only game with a
bottomless buyer on every corner — dopewars — has no cooperation at all (players only spy, snitch and fight), which is where AI City was.

- **rs-sdk / LostCity (RuneScape 2004)** — github.com/MaxBittker/rs-sdk (MIT): shared-stock NPC shops whose price drops per unit over base
  stock and recovers slowly (`server/content/scripts/shop/scripts/shop.rs2` calc_shop_value; buy 40-70%, sell 100-130%); a Grand Exchange
  with 6 slots and a burned 5% tax, used in person; agents write looping scripts, every action returns success/reason, a generated world wiki.
- **ServUO (Ultima Online)** — github.com/ServUO/ServUO (GPL-2): 8×8 ore patches hold 10-34 ore shared by all miners and respawn 10-20 min
  after first dig (`Scripts/Services/Harvest/Core/HarvestBank.cs`); rare ore 1.4% of patches at skill 99; total skill cap 700 (chosen
  specialisation); player vendors pay a daily fee; NPC vendors buy at 75%.
- **Mafiasource (Omerta-style crime MMO)** — github.com/Mafiasource/Mafiasource (MIT): one ownable outlet per city (bullet factory etc.),
  owner sets price in a range and takes 16% (the rest burned); family caps on possessions; turf = owned tiles paying hourly income, attacked
  with bombs; team crimes need 3-23 players.
- **AI Economist (Salesforce)** — skill multiplies the money step (house pays coin × build skill), walled quadrants with different resources.
- **Melting Pot (DeepMind)** — coop_mining: gold needs two miners together and pays 8× iron; fruit_market: each type harvests one fruit
  faster but values the other.
- **TravianZ** — merchants with capacity, bounded exchange ratios, alliance buffs from capped donations, anti-feeding caps, 1% rare land.
- **Agent harness patterns:** AI Town (one input path for humans and agents; engine-enforced social limits: no re-talking within 60 s,
  8 messages per conversation; conversation memories); generative_agents (day → hour → 5-15 min plans, replan on salient events, ranked
  memory); Concordia (a game master resolves attempts; a marketplace clears all orders once per round at one price); Mindcraft (always-on
  reflexes interrupt actions without the model).

**Recommended for AI City (the researcher's inference, untested):** contested supply (dig sites with a fixed hourly yield split by skill and
tool; gold/ice only at lawless sites); corners like RuneScape shops (every sale lowers the corner price for everyone, slow recovery, total
street demand below city output, so corner-hours are scarce); a fence NPC buying and selling at a wide gap; a few ownable labs charging a
cut; a few two-person actions. Don't build job penalties.
