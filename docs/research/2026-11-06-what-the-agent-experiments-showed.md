# What the agent experiments showed: a history of AI City's model runs, September to November 2026

**Status: a summary, written 2026-11-06.** It condenses 32 city runs on the first engine in September and about 30 seasons on
the new rules core from 10-16 to 11-05, most of them pre-registered. Every number comes from the results written after
each run. The plans, transcripts and per-season records are not published, except the 11-05 season's record in
`core/seasons/2026-11-05-agents/`. Where only one or two seasons back a number, read it as a direction, not a rate.

**Terms.** A *season* is 14 nights on the island, ending with the last ferry. A *seat* is one player; a *model seat* is
played by an LLM, the rest by scripted bots. A seat's *haul* is what it takes off the island: its leftover cash plus what
the rare traits it mints first sold for (`docs/GAME.md` §27). A *bot twin* replays the same seed with every seat played by
a bot, so each model seat can be compared with the bot that held the same seat.

## The short version

**What worked**
- **Changing the mechanics changed behaviour; changing the wording mostly didn't.** In the first engine almost everyone
  robbed until robbery paid less. On the new core, strong models led no crime under three briefings, then one rule change
  (a hit wins a tie against a lone worker) brought it out the same week.
- **Showing the payoff on the menu.** Mechanics the agents never touched (bribes, crews, burglary, buying traits) came into
  use as soon as each had its own line saying what it pays, whenever it was affordable.
- **Standing plans and orders for routine work.** Model calls fell 60%, deals settled far more often, and the model was left
  with the judgement calls.
- **Measuring properly:** a written plan with marks set before the first paid call, a bot twin for every season, several
  seeds, and a $0 scripted bench run before any paid one. In its first minutes the bench found an imbalance and two bugs that model runs had missed.
- **Clearer rules and typed replies removed most mistakes.** A corrected briefing cut refused errands from 24 to 2; a plain
  rent line ended first-dawn evictions; typed trade terms ended silently lost deals.

**What failed**
- **Model seats never beat the bots on the new core.** Four seeds: −$256 a seat (standard error $28). After a week of trade
  fixes, the same four seeds: −$205 (SE $47). The bots won all eight pairs. One later seven-model season: −$111 a seat.
- **Models take the safe option.** They work the day job, save for a rare trait and guard it, which is the briefing's goal
  taken literally. The production chain (Chemists cook, Dealers sell) mostly doesn't start when a model holds a link.
- **Deals between agents rarely complete,** even with buyers waiting, prices on screen and the arithmetic shown.
- **Tuning on bots first.** The rules were tuned over thousands of bot seasons; the first model season on the new core showed
  traps no bot had hit. A scripted bench proves the mechanics, not the balance.
- **Tuning one run at a time.** Fixes made after single runs on the weakest model chased noise: the same model in the same
  seat on the same seed swung by $330 between two seasons.

---

## 1. The first engine (September)
A real-time city of 8–20 agents, each making a few dozen decisions a game day. Most runs used a local model (Qwen3.8 Flash Next),
then cheap API models.

- **Menu salience drives behaviour.** With "crime is legal" in the prompt and one robbery line per person near the top of
  the menu, most agents robbed each other at spawn in front of two cops. Exact stakes on the line and crime lower in the
  menu fixed it.
- **The best-paying verb wins.** When robbery paid best, 31 robberies were tried in a day against 5 street sales. Prompts
  didn't fix it; mechanics did (heat that ends in arrest, cops who need grounds, a lower take, work from hour one). The next
  run had 24 sales, 9 contracts and 14 robberies.
- **Agents don't know the economy unless told.** Cooks went shopping for ingredients at a convenience store. Naming who sells
  what to whom, with rough prices, fixed it.
- **Coordination is the bottleneck.** At about 30 s a decision, two agents rarely decide in the same window: one cook made 35
  offers and cooked 4 times. An escrowed board (list now, buyer pays later) doubled trades. With standing plans as well,
  escrowed contracts settled 53% of the time against 1.5% for face-to-face offers, and model calls fell 60%.
- **Poverty turns into crime by day 2.** Once agents were broke, robbery became the rational move: 36 street sales on day 1,
  3 on day 2.
- **A fresh reviewer finds what ten runs normalised:** the supply chain had never run, there were 16 engine exploits, and
  every run had used one seed. After the fixes and a new seed, a run hit 7 of 8 targets.
- **Specialisation doesn't emerge from skills alone.** With no fixed jobs, agents did the whole chain themselves and trade
  collapsed (contracts settled 2 of 27, from 66 of 125). Doing everything yourself kept winning until someone controlled
  supply or distribution; hiring fixed it. Models then hired unprompted ("selling myself is terrible. Hire…"), and a hired
  dealer walked off with his boss's stock: the first betrayal.
- **Model personality is content.** In mixed cities one model worked honestly and finished richest, another ran 18 of 22
  scams and every bribe, a third, as a cop, took bribes and arrested the briber anyway. Same-seed single-model cities each
  had their own character. Mechanics the local model never used (bribes, crews) appeared at once with other models.
- **Reliability.** Reasoning models ignored a 1,024-token reasoning budget and were cut off on 26% of calls until the reply
  cap was raised to 6,000. Some models failed 45% of calls; others almost never.

## 2. The audit and the rebuild (10-10 to 10-14)
A structural audit of the first engine found three root causes: facts kept in two places (English event text re-parsed by
other code), dice and answer-key menus where decisions should be, and a payoff loop that wasn't wired. The game was
redesigned as a night game with places (`docs/GAME.md`): each night every agent makes one secret play at one of eight
districts, settled at once with no dice, over a 14-night season. The new rules core was built in four layers and tuned on
scripted bots over about 13,000 bench seasons. The pass bars (§27) measured the bot economy.

## 3. AI players on the new core (10-16 to 10-21)

**10-16, the first local-model season.** Four model seats hauled $0, $0, $140 and $0 against their bots' $738, $306, $490
and $532. Seats start with $0 and rent is due at dawn, a trap no bot had hit: the model never got rent straight, and 59
errands were refused. Fixing the briefing and menu cut refusals to 15, but hauls stayed near zero.

**10-17, the corrected briefing** (GPT-6 Luna, two seeds, legacy against corrected wording). Refused errands 24 → 2, the rent
mistakes gone, evictions 9 → 5, crime attempts 3 → 6. In neither arm did a deal between agents complete: 1 gift and 0
payments in four seasons.

**10-17, a starting stake** ($100 against $0). Money in hand moved buying earlier (first offers on day 1–2 instead of 3) and
higher (26 list buys against 19). Crime attempts didn't change, and deals between agents still didn't complete.

**10-18, scenario diagnostics** (one model, fixed situations, two samples each).
- The lookup tools worked, and the model never used them.
- It paid a false debt claim in 4 of 4 runs, twice with its own receipt on screen.
- It avoided committing to fights, even a winnable one.
- Selling failed on an interface trap: echoing the buyer's exact terms flipped the deal's direction. The fix it called for:
  terms that name buyer and seller.

**10-18, mixed models** (two seasons, 8 model seats among 30: GPT-6.1 Sol, Claude Sonnet 5.5, GPT-6 Luna, Gemini 3.1
Flash-Lite, DeepSeek v4.1 Flash).
- No model played the crime game, strong ones included. Every theft and betrayal came from bots.
- Strong models made fewer mistakes, not bolder plays: 1 refused move from Sonnet in two seasons, 55 from DeepSeek.
- Cheap models struggled with the interface and ended with $0 in three of four seasons.
- With a deliberately neutral briefing and no owner instructions, every model chose legal work.

**10-19, a starter rulebook and moves as tool calls.** Model seats' mean haul rose from $106 to $238, and first-dawn evictions
fell from 6 of 8 to 4 of 8. Strong models still led no crime. Trading fell: tool calls cut actions per reply.

**10-19, the owner's Creed** (the same owner text for every agent). Strong models still led no crime, and said why: "Solo
attacks cannot beat defence". They read the rules correctly (a tie holds for the defence), but none weighed the drug or the
brass knuckles that would have won. The menu showed targets, not the strength arithmetic.

**10-19, the lone-worker rule** (a hit wins a tie against someone working alone). Crime appeared at once: Sol went from 0 to
6 hits (2 won) and Luna from 1 to 11 crimes; Sonnet still tried none. The first bot twin: model seats $129 against the
bots' $342, and 1 of 8 seats won. All 5 betrayals were by bots.

**10-19 to 10-20, check seasons on one seed.**
- **Fixes:** a plain rent line, reasoning switched on, a daily journal, fight numbers on the menu, and an `agree` move.
  - First-dawn evictions went to 0, and the mean rose to $228 against the bots' $342.
  - DeepSeek's reasoning ran to the 6,000-token cap on 78 of 139 calls, so its seats fell back to the default play on 9
    nights.
- **Trade was the gap:**
  - model seats opened 11 sit-downs, settled 1 deal and were paid $75;
  - the bots in the same seats opened 81, settled 68 and were paid $2,295;
  - a review found the screen never showed what agents paid each other, only the city's buyer at $8, so taking the shift was
    a reasonable reading.
- **Street prices and the bots' terms on screen:**
  - still 2 deals and $105;
  - the haul rose to $273, from crime: 20 tried, 8 won;
  - the whole gap sat in the two Smuggler seats, which took shifts instead of running goods;
  - the facts were on their screens, so what was missing was the arithmetic and the choice.
- **The run arithmetic on the menu:**
  - the Smugglers read it correctly ("A solo run on an empty drop gives 6 units") and hit the next walls: rent is due before
    goods sell, and neither side will pay first;
  - the conclusion: the gap is what the models choose, not arithmetic they can't do.

**10-20, the ten-season test** (seeds 444–453, pre-registered, with an early stop).
- **The bar failed after four seeds:** model seats $191 a seat against their twins' $447, −$256 (SE $28), and the bots won 4
  of 4. The early stop held seeds 448–453 back.
- **The runs were clean:** 0 of 1,695 calls were cut off, so the gap was the play, not the harness.
- **Models worked the shift:**
  - 238 shift nights to the bots' 138;
  - leaving out the Cops, 54 nights at their trade to the bots' 182.
- **The chain didn't start:**
  - model Chemists cooked 50 doses (their bots: 470);
  - model Dealers took $5,412 off the street ($18,043);
  - model Gunrunners built 3 guns (9).
- **Their reasons named safety:** "safe shift cash", "a shift always pays", "keep the roof paid and build cash toward the
  rare list".
- **Crime by model:**
  - Luna's seats tried 65 crimes and won 7;
  - Sonnet's tried none;
  - four model seats hauled $0, two arrested on the last night and two stripped by the landlord at the dock.

**10-21, trade plumbing and hustles** (one seed, then four).
- **Standing trade orders with an owner preset, and no terms lost.** The plumbing worked: trade nights 15 → 30, cash paid in
  by other agents $240 → $645, unanswered asks 46% → 12%. The haul barely moved (−$266).
  - In the bot-only twin, 13 of 30 bots took a shift on a median night, and shifts brought in 38% of the island's cash: part
    of the pull toward the shift was the economy's, not the models'.
- **Hustles replaced the day job:**
  - the models played them: 54 hustles to the twins' 40;
  - the gap narrowed to −$149, mostly because the twins earned less.
- **The verdict on four seeds:**
  - **The bar:** −$205 a seat (SE $47), and the bots won 4 of 4.
  - **The reference:** the bots' own logic, run on the model seats' call schedule, was −$46. The call schedule explains a
    little of the gap; the play explains most of it.
  - **Dealers:** model Dealers dealt on 3.5 nights a seat to their bots' 8.6.
  - **Chemists:** model Chemists cooked on 2.2 to 7.7.
  - **Hustles:** the model seats hustled 261 times to the twins' 145.
  - **By model:** Luna −$262 a seat, Sonnet −$129, Sol +$63.

## 4. Seven models, one season (11-05)
- **Setup:** seed 444, rule A, its bot twin verified.
- **The result:** model seats $278 against the twins' $389, −$111 a seat, and 0 of 1 pairs won.
- **By model, against the bot in the same seat** (one season, so a direction only):

  | Model | Gap |
  |---|---:|
  | Claude Haiku 5.5 | +$19 |
  | Claude Opus 5.5 | −$22 |
  | GPT-6.1 Sol | −$37 |
  | Claude Sonnet 5.5 | −$77 (two seats: +$231 and −$384) |
  | Gemini 3.8 Flash | −$77 |
  | Kimi K3.1 Pro | −$505 |

- **Reliability decided the lineup before play decided anything:**
  - two models were replaced after their long replies ran past the token limit and timed out;
  - at a high effort setting, Haiku spent its whole output on thinking on 28 of 66 calls.
- **The record:** `core/seasons/2026-11-05-agents/`.

## What it adds up to
1. **Build the forcing structure in the rules.** LLM players choose the safe, legible option the briefing names. Conflict,
   trade and specialisation appeared only when a rule made them the better play, and the prior research predicted this
   ([agents under stakes](2026-06-14-agents-under-stakes-and-competition-formats.md),
   [AI towns](2026-09-23-ai-towns-rules-vs-emergence.md)).
2. **Wording raises the floor, not the ceiling.** Clearer rules, typed replies and visible numbers removed mistakes and
   lost deals. They didn't make models bolder or more cooperative.
3. **Test with AI players first, against bot twins, on several seeds, with the marks written down before the run.** Bot-tuned
   balance didn't survive contact with models, and single runs swung more than most of the effects being chased.
4. **Pick models for reliability first.** Models that ignore reasoning budgets get cut off, and cheap models fail the
   interface. Among reliable models, every one took the safe option, and each rule change moved all of them at once.
