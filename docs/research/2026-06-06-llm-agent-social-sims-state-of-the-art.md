# LLM agent social simulations, the state of the art in 2025–2026: looping, profit convergence and what agent-only platforms show

**Status: research, 2026-06-06.** Written before AI City for an earlier LLM social-feed simulation, as a follow-up to the two
convergence reports ([behavioural](2026-05-18-behavioral-convergence-in-llm-agent-simulations.md),
[lexical](2026-05-18-lexical-convergence-in-multi-agent-llm-simulations.md)). This page summarizes a commissioned research brief;
the full brief was not kept. Paper IDs are as the brief gave them and were not re-checked for this page.

## What the field already recommends
Most of the brief's "do this now" list repeats the earlier convergence research:
- **Diverse memory retrieval**: maximum marginal relevance with topic tags, so retrieval spans topics.
- **Grounded reflection**: deduplicate reflections by topic, and have each reflection cite the episodic memories it came from.
- **Structural pattern checks**: detect repetition with a deterministic signal (opener detection, word overlap), not an LLM call.
- **Placement**: high-salience signals at the end of the context (Lost in the Middle, Liu et al., TACL 2024).
- **Model type**: conversational models rather than reasoning models, which the brief says worsen convergence.
- **Temperature**: never 0; the brief reports far more loops at temperature 0 (48× in its source).

## Three levers that were new
1. **Diversity at decoding time.** Most anti-loop work is after the fact (detect, then nudge or regenerate). Decoding attacks
   looping at the source: per-agent temperature jitter (σ ≈ 0.1 around about 0.95) and a frequency penalty of about 0.3.
   Caveat: some API providers silently drop `frequency_penalty` or `min_p`, so check that they arrive.
2. **Economic pressure makes agents converge.** Feng, Choudhary & Shrestha (EMNLP 2025, arXiv 2508.15926): LLMs under
   economic pressure "converge on stable, conservative strategies that diverge from human behavior"; only imitation of real
   human decision traces restored variance. Ge, Zhang & Vorobeychik (arXiv 2602.15173): reasoning models behave close to
   homo economicus, conversational models like neither humans nor homo economicus. The structural levers: decouple part of
   each agent's income from the thing everyone optimizes, and give agents different risk temperaments, so they don't all
   rationally converge on the same best move.
3. **Population-level quotas.** Per-agent deduplication can't stop several agents independently landing on one topic. A cap
   on the share of recent posts per topic, plus occasional committed-minority injection (Ashery, Aiello & Baronchelli,
   *Science Advances* 2025: committed minorities flip emergent conventions), works without embeddings.

## What agent-only platforms show (calibration, not bugs to fix)
Moltbook (Marzo et al., arXiv 2604.13052, 1.3M posts) and Chirper (Zhu et al., arXiv 2504.10286):
- **3.3% reciprocity**, against 22–60% among humans.
- **85.6% flat conversations**; 91.4% of agents never return to their own threads.
- Identity and "my human" meta-discourse.
- **Toxicity gets more engagement**, so a likes economy selects for it even when none is seeded.
- Concentration: 11% of agents made 95% of identity claims (Gini 0.946).
Low reciprocity is a property of the substrate; nudging agents to reply fights it uphill.

## What to be sceptical of
- **Imitation-seeded personas** (seeding memory with real human posts): a big lift, and the economic findings come from
  auctions and lotteries; the brief itself calls the transfer to posting "an inference, not a measurement".
- **Full emotion state machines** (Sentipolis-style PAD): architectural, with gains that depend on model size.
- **The citation density.** The brief flags its own load-bearing 2026 survey as single-author and not peer reviewed, and one
  citation (2604.27271) as misattributed. Treat the ideas as framing.

## The most useful line
For a product, "people find it engaging" (face validity) is the right bar, and the literature's own central caveat agrees:
Larooij & Törnberg (2026) found 22 of 35 papers validate on believability alone. Validate by watching, plus a few
stylized-fact metrics, rather than chasing benchmark scores. A hybrid system, where agents act and humans react, measures
something the agent-only literature doesn't: the human feedback signal.
