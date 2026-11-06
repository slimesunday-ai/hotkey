# The 2026-11-05 agent test: seed 444

One season of the rules core with seven model seats among the scripted cast, recorded for the city viewer. It is the
public record only: what a viewer may see, with private words, plans, cash and stashes disclosed on the game's own
schedule ([GAME.md §19](../../../docs/GAME.md#19-who-sees-what-and-when)). No key, prompt, model reply, reasoning, log or
spend record is in this folder.

## Watch it

After the bake, with the server running ([Run it](../../../README.md#run-it)), open:

```text
http://localhost:<p>/style/city/?sim=record&feed=/core/seasons/2026-11-05-agents/444-A/feed.jsonl
```

At 1× the record plays on the island clock, one game minute per real minute, so the whole season is fourteen days long.
**Shows back to back** plays only the fourteen night shows: 291 game minutes (10–31 a show), about five hours at 1×,
half an hour at 10× and five minutes at 60×.

## Who played whom

Each seat's haul ([GAME.md §27](../../../docs/GAME.md#27-pass-bars-proposals-slime-changes-them): Mainland money plus
what each minted copy first sold for) is set beside its bot twin's: the same seed with every seat played by the scripted
bench bots.

| Agent | Trade | Model | Endpoint, setting | Haul | Bot twin | Gap | Calls | Lost to a cut-off or error |
|---|---|---|---|---:|---:|---:|---:|---:|
| penny `@a01` | gunrunner | `claude-opus-5-5` | Claude API, effort high | $308 | $330 | −$22 | 43 | 0 |
| nico `@a10` | dealer | `moonshotai/kimi-k3.1-pro` | OpenRouter (Moonshot AI) | $190 | $695 | −$505 | 69 | 0 |
| brix `@a11` | chemist | `claude-sonnet-5-5` | Claude API, effort xhigh | $461 | $230 | +$231 | 72 | 7 |
| cass `@a12` | chemist | `claude-sonnet-5-5` | Claude API, effort xhigh | $231 | $615 | −$384 | 71 | 13 |
| otto `@a24` | chemist | `claude-haiku-5-5` | Claude API, effort high | $387 | $368 | +$19 | 66 | 28 |
| pip `@a25` | dealer | `openai/gpt-6.1-sol` | OpenRouter | $146 | $183 | −$37 | 56 | 0 |
| tex `@a29` | chemist | `google/gemini-3.8-flash` | OpenRouter | $222 | $299 | −$77 | 59 | 1 |

Across the seven seats: AI $278 a seat against the bots' $389, a gap of −$111. This is one paired season, so there is
no standard error: each row is a direction, not a verdict.

A cut-off is a reply that spent its whole output on thinking and carried no move: Haiku on 28 of its 66 calls, the two
Sonnet seats on 7 and 13. Gemini's one loss is an error its endpoint sent. Gemini reported no thinking tokens on any call.

## Setup

- Seed 444, rule A, midseason crackdown, cast `models-canny`: 30 agents, 7 played by models, 23 by the bench bots.
- Briefing `starter`, replies as tool calls, a dawn journal, and the same baseline Creed and owner's trade-order preset
  for every model seat.
- Thinking on for every seat. Each call has 180 seconds and at most 6,000 output tokens, thinking included; the
  OpenRouter seats ask for a 1,024-token thinking budget, and the Claude seats set an effort.
- Grok 4.7 and Qwen3.8 Max were tried in earlier starts of this seed and replaced: Qwen ran to the token limit and
  timed out on its first calls, and Grok timed out on four calls in a row. Seat `@a12` was Grok's.
- `feed.jsonl` was written by replaying the played season from its private tape at no cost. The replay's events are
  byte-identical to the season's.
