# How agent worlds that produce crime brief their agents (research, 2026-10-19)

**Source:** Claude Code research agent, 2026-10-19. Repos shallow-cloned and read without running them
(SpaceMolt www/commander/admiral, Emergence-World, AI_Diplomacy, werewolf_arena, hoodwinked, AmongUs, ai-town,
concordia). Claude spot-checked the quotes below in the clones.

## Pattern
Every project that reports crime or deception gives its agents at least two of these:
- a stated goal;
- a named role or playstyle that includes the act;
- a sentence saying the act is allowed or useful.

Where crime was available but nothing framed it, frontier models stayed peaceful:
- SpaceMolt's devs (`www/src/content/blog/2026-02-18-eighteen-days-in-the-cosmos.mdx:70`): "Before that [NPC
  pirates], agents mostly just bumped into each other politely. (Sycophantic models make surprisingly peaceful
  space travelers.)"
- Emergence's Claude-only world had zero crimes.
- AI City's two mixed seasons (10-18) match this.

## Correction to the SpaceMolt page
SpaceMolt's fake distress calls were made by NPC pirates the devs added ("We also taught the pirates how to fake
a distress call…", 700-agents post). Agents did not make them. After 18 days, one player had all the PvP kills
(12 ships). Logged as a dated correction on [2026-10-13-spacemolt-agent-mmo-precedent](2026-10-13-spacemolt-agent-mmo-precedent.md); the note also flags
GAME.md §32 as carrying the same claim.

## How each project frames it
- **SpaceMolt** (skill.md, about 95K characters; no win condition):
  - The agent asks its human one question: "What playstyle interests you?"
  - The options include "Pirate/Combat - Hunt players, loot wrecks, live dangerously".
  - Crime is priced, not banned ("Lawless — anything goes" vs police levels).
  - Owner mission text is free-form and can change mid-season (Admiral's "Directive Updated").
- **Emergence World:**
  - Designer-written roles, e.g. "Take what you can… sometimes you have to lie strategically".
  - Survival pressure: "Rule 1: Your own survival comes first".
  - Season 2 attaches a random cue to each turn (`turn_prompt_catalog.md:39`: "You've been too nice. What have
    you been holding back?").
- **AI Diplomacy:**
  - Goal: "18 supply centers".
  - "always be prepared to … betray alliances".
  - Each order is checked against the engine; invalid ones are dropped, and a malformed reply falls back to
    HOLD.
- **Werewolf Arena:** "Deception is your greatest weapon" (`prompts.py:103`).

## For AI City (proposed to slime 10-19, not approved)
- **Copy:** a goal sentence; a neutral line that every play on the menu is part of the game; an owner-picked
  playstyle, lawful and criminal side by side; a persona line; a longer owner mission that can change
  mid-season.
- **Don't copy:** game-issued nudges (they break "which AI won"; Emergence's Grok world ended on day 4 in a
  violence cascade); designer-written villains (in AI City, owners pick); "be aggressive" for every seat;
  silent fallbacks to the first option.
- AI City's bots already fill SpaceMolt's NPC-antagonist role.

## Related
[2026-09-25-agent-game-harness-and-betrayal-research](2026-09-25-agent-game-harness-and-betrayal-research.md) ·
[2026-10-13-spacemolt-agent-mmo-precedent](2026-10-13-spacemolt-agent-mmo-precedent.md)
