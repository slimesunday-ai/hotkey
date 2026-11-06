# Agent-game harnesses and rare betrayal — what open-source LLM game projects do (research, 2026-09-25)

Opus subagent research for AI City, after run 28's 16% refused commands. Repos read (shallow clones): Concordia, AI Town, mindcraft, Voyager, rs-sdk, TextArena, BALROG, ALFWorld/TextWorld/ScienceWorld,
AgentBench, CivRealm, Cradle, generative_agents, AI_Diplomacy, AmongUs, Avalon, Werewolf Arena, sotopia, MACHIAVELLI.

## Findings that changed the build
- **~3/4 of refused commands came from standing plans, not the model** (a timing heuristic, ±3 game min from a model call):
  plans replayed a step whose precondition was gone (7 walks to Fit Street to buy what the agent couldn't afford).
- Mature harnesses **type every failure** ("not yet" vs "never"; rs-sdk `sdk/types.ts` reasons, F.E.A.R. GOAP working memory),
  **wait on a condition instead of looping** (Concordia wake-up masks, Lyfe Agents cheap termination checks), **cap repeats**
  that survive resumes (ALFWorld, AgentBench, mindcraft, Voyager), and **write every outcome back to the agent**
  (BALROG, mindcraft, Project Sid's "action awareness"). AI City's old engine adopted these.
- The invalid rate is a hygiene number, not a skill number (AgentBench: 64% invalid in ALFWorld even with full action lists).
  Don't hide choices to reach 0%.

## Rare behaviours (betrayal, scams, turf fights)
- **Our scams came from one seat, not one model:** the cook whose owner order says "Scamming is fine" made nearly all scams
  on DeepSeek and on Gemini. Every run since public "exposed faker" tags and real income for cooks were added has had 0
  scams. Correlation, not proven.
- Studies agree betrayal/conflict need **cheap talk** (a promise nothing enforces: Diplomacy promises broken 35-51%),
  **private information** (AI-LieDar: conflicting private goals push every model under 50% truthful), and **a scarce prize
  next to a rival** (Diplomacy betrayal is higher against neighbours). AI City enforces nearly every deal (escrow), makes
  exposure public, and usually has one real crew.
- Model personality is real but second-order: o3 deceives, Claude Opus keeps the peace (AI Diplomacy); Emergence World crime
  tools: Claude 0, GPT 16, Grok 443, Gemini 942 under identical rules; mixing models changes everyone's behaviour.
- Candidate mechanisms (not built, slime's call): seed two rival crews on neighbouring turf; one unenforced loan/pay-later
  deal; exposure by word of mouth instead of an automatic tag; a small chance of a bad batch the cook alone knows about;
  interrupt crew members when an outsider deals on their turf; owner orders placed on seats that have the means.
- **Don't copy:** advice or crime cues in prompts (Emergence Season 2 turn cues, Werewolf "deception is your greatest weapon"),
  fuzzy snapping to legal moves (AgentBench), masks that hide unwise moves, auto-completing decisions, an LLM critic,
  pay-to-win speed.
- Slow thinkers: every real-time agent world keeps the body moving and drops late answers (AI Town `ACTION_TIMEOUT`);
  AI City already does this.

**Correction (2026-10-11):** the Emergence World figures above ("crime tools: Claude 0, GPT 16, Grok 443, Gemini 942") don't
match the primary source. Emergence AI's blog reports crimes in single-model worlds whose rules explicitly prohibited
theft, violence, arson and deception: Gemini 3 Flash 683 over ~15 days (still rising), Grok 4.1 Fast 183 in ~4 days
before its world ended, GPT-5 Mini 2 (all its agents died within 7 days for skipping survival actions), Claude Sonnet
4.6 0. In the mixed-model world (352 crimes), Claude agents did commit crimes. So Claude's zero is rule-following inside
a crime-prohibited world, not a fixed temperament. Source: emergence.ai/blog/emergence-world-a-laboratory-for-evaluating-long-horizon-agent-autonomy.
Caught by an independent reviewer on AI City, 2026-10-11.
