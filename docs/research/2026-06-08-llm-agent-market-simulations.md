# Market simulations with LLM agents: calibration, engineered heterogeneity and cross-agent convergence (research, 2026-06-08)

**Status: research, 2026-06-08.** Written before AI City for an earlier agent market simulation (an art-collectibles market);
its findings apply to any economy that LLM agents trade in. Method: a deep-research harness (5 search angles, 22 sources
fetched, 109 claims extracted, 25 verified, **18 confirmed and 7 killed** by a three-vote adversarial check), then a narrowed
re-run for Part 3 (6 angles, 24 sources, 113 claims: 23 confirmed, 2 killed). Confidence comes from those votes; every
unverified or killed claim is flagged.

## Headline
All three questions have one answer: **engineer behaviour deterministically, calibrate against real stylized facts, and
instrument the population.** Raw LLMs don't produce believable market variance or linguistic variance on their own.

---

## Part 1: calibrating and validating a market

### Confirmed
- **Calibration method for a small, stochastic, LLM-coupled agent-based model:** simulation-based inference with neural
  posterior estimation (NPE) or neural density-ratio estimation (NRE). It is the state of the art and needs far fewer runs
  than ABC or the method of simulated moments. *Dyer, Cannon, Farmer & Schmon (2024), "Black-box Bayesian inference for
  agent-based models", J. Economic Dynamics & Control 161.* The standard method comparison is **Platt (2019),
  arXiv:1902.05938**. Gradient calibration of differentiable models (GradABM: Chopra et al., AAMAS 2023, arXiv:2207.09714;
  Quera-Bofarull, arXiv:2305.15340) exists but needs a tensorized engine; overkill for a small simulation.
- **Target moments (the validation yardstick)**, from TwinMarket's real-data column, Table 4, checked verbatim
  (*arXiv:2502.01506, ICLR 2025 Financial-AI workshop*): **return kurtosis ≈ 7.26** (real) against 5.24 (TwinMarket) and
  4.47 (baseline ABM); **GARCH volatility clustering α+β ≈ 0.95** (real; α = 0.06, β = 0.83 on TwinMarket); **negative-return
  autocorrelation ≈ 0.14** (real; a leverage-effect proxy). Fat tails and volatility clustering are independently confirmed
  for NFT and metaverse tokens (*Chan et al. 2024, Physica A 653*; *Ghosh, Bouri et al. 2023, Research in International
  Business & Finance 65*).
- **Context, not a stylized fact:** industry sources (crypto.news, CoinGecko; journalism, not peer reviewed) report that
  about 96% of NFT collections are effectively dead.

### Killed by the verifiers (do not use)
- A Hurst exponent range of **0.3–0.8** (vote 0–3); return autocorrelation **"insignificant"** (0–3); an **inverse-cubic tail
  exponent ≈ 3** (0–3); **long memory** in NFT returns (1–2); Platt's **"Bayesian beats frequentist MSM"** (1–2).
- So the defensible target is **fat tails (kurtosis about 7) plus clustered volatility (α+β about 0.9)**, not a specific
  Hurst or tail exponent.

### Honest gaps
- No surviving source gave native per-collection floor-price stylized facts. The numbers above are proxies: fungible
  metaverse tokens and TwinMarket's Chinese-equity benchmark.
- No verified closed-form mean-reversion or soft-ceiling formula. A log-price Ornstein–Uhlenbeck process toward a
  participation-driven fundamental, with multiplicative jumps, remains a design to derive, not a cited result.

### What it means for a simulation
Measure return kurtosis and GARCH α+β over a long headless run and tune toward kurtosis about 7 and α+β about 0.9; once that
harness exists, calibrate with NPE rather than grid search.

---

## Part 2: should the LLM make the trade? No: engineer it

### Confirmed
- **LLMs are "too rational" even when actively trading.** They price near fundamentals, produce only muted bubbles, fail to
  reproduce large human bubbles and show little round-to-round variance. *Henning, Ojha, Spoon, Han & Camerer
  (arXiv:2502.15800, ICLR 2025)*, in the Smith–Suchanek–Williams bubble paradigm. The conservatism is **intrinsic, not a
  prompt artefact**: the verifiers killed the competing claim that agents' refusal to trade is "just instruction-following"
  (vote 0–3).
- **The state of the art engineers heterogeneity rather than waiting for it to emerge.** TwinMarket (arXiv:2502.01506) uses
  a belief–desire–intention loop, personas built from **real transaction data**, **deliberately embedded biases** (loss
  aversion) and daily belief updates. "Can LLMs Trade?" (*Lopez-Lira, arXiv:2504.10789*) uses prompt-injected strategy roles
  (value, momentum), belief distributions, information asymmetry and varied endowments.
- **Cheaper fixes don't close the gap.** Imitation through in-context learning narrows the behavioural-fidelity gap but never
  closes it (KS about 0.31 with imitation against about 0.62 without; *Feng, Choudhary & Shrestha, EMNLP 2025,
  arXiv:2508.15926*). Risk-framed prompting shifts behaviour predictably but doesn't restore diversity. Prompt-only and
  imitation-only fixes relocate the problem.

### What it means for a simulation
Take the trade decision away from the LLM, or constrain it with code: give each agent continuous bias parameters (loss
aversion, overconfidence, herding) derived from its persona, rather than a few discrete temperament types; make large
traders size positions relative to their bankroll and react to their own profit and loss rather than follow fixed thresholds.

---

## Part 3: detecting convergence across agents

The broad pass found only the mechanism (similar foundation models give correlated, herding responses; Lopez-Lira). The
narrowed re-run found the instrument.

### The metric (ranked, all embedding-free)
1. **gzip compression ratio (CR) over the concatenation of all posts in a window.** `CR(D) = size(D_concat) /
   gzip_size(D_concat)`; a higher CR means more redundancy and less diversity. Cheap (O(n)), and because it compresses the
   concatenation it catches redundancy **across agents**, not just within one author. It correlates 0.81–0.90 with slower
   n-gram-overlap homogenization scores. *Shaib et al., "Standardizing the Measurement of Text Diversity", IJCNLP-AACL 2025
   (arXiv:2403.00553).* Caveat: length is a confounder (CR to length, 0.867), so fix the window's token count.
2. **Corpus-level distinct-2:** distinct bigrams over total tokens, pooled across all agents in the window (Li et al.,
   NAACL 2016, arXiv:1510.03055).
3. **Self-BLEU:** pairwise BLEU across posts; only weakly correlated with CR, so a complementary signal. O(n²); sample it.
4. **CR-POS:** CR over part-of-speech sequences; catches shared syntactic templates that lexical metrics miss (Shaib et al.,
   EMNLP 2024, arXiv:2407.00211). Avoid BERTScore: the literature says it doesn't separate human from model text.

### The gap (directional; there is no clean "X% less diverse" number)
- **"Artificial Hivemind"** (NeurIPS 2025 best paper, arXiv:2510.22954): **similarity across models dominates repetition
  within a model**, with cross-model pairwise similarity of 71–82% and 79% of responses above 0.8 similarity.
- **Syntactic templates:** 95% of model texts against 38% of human texts contain a recurring length-6 POS template
  (arXiv:2407.00211).
- **OASIS** (arXiv:2411.11581): agents **over-conform compared with humans** (a stronger herd effect on down-voted posts;
  "humans possess a stronger critical mind"). OASIS measures diversity with embeddings, so there is no off-the-shelf
  embedding-free monitor to borrow.

### The cheapest interventions
- **Per-agent decoding diversity** (temperature, top-p, min-p, typical sampling): a diversity objective gave 2–5× lexical
  diversity over a dull baseline (Li et al.). Caveat: shown within one system, not validated across agents.
- **Audit the simulation's own canned phrases.** Fixed text that the engine injects is a source of sameness below the LLM,
  where no per-agent or decoding brake reaches.

### Recommendation
Use gzip CR over each period's pooled posts as the cross-agent convergence monitor, with distinct-2 and CR-POS as cheap
secondary checks. Don't hard-code a value from the literature (CR depends on length and corpus): calibrate a baseline mean
and σ over the first healthy periods and alert on a sustained rise (for example, CR above baseline + 2σ for two periods in a
row). **Validate it first:** confirm CR rises on a deliberately induced convergence run before trusting alerts, since every
embedding-free metric here was validated for diversity within a corpus, and cross-agent use is an extrapolation.

### Killed or caveated (Part 3)
Killed: "MTLD is the only length-robust diversity index" (0–3); "cooperative interaction drives convergence" as a general
law (1–2; validated only on two-agent dialogues). The two strongest quantified gap numbers (Hivemind, OASIS) are themselves
embedding-based: they prove the mechanism and its size but aren't the embedding-free instrument.

---

## Refuted claims (do not rely on any of these)
1. "Bayesian consistently beats frequentist MSM for ABM calibration" (1–2); Platt 2019.
2. NFT and crypto returns follow the inverse-cubic tail law (about 3) (0–3).
3. NFTs and crypto show long memory or long-range dependence (1–2).
4. A regime-varying Hurst range of 0.3–0.8 (0–3).
5. Return autocorrelation is statistically insignificant (0–3).
6. GARCH(1,1) "high persistence" as a settled NFT stylized fact (1–2). The α+β about 0.9 target from TwinMarket's table
   survived; this is a different, killed framing.
7. "Agents' refusal to trade is an instruction-following artefact, not intrinsic" (0–3). Its refutation supports engineering
   the trade in code.

## Caveats
- All Part 1 targets are proxies (metaverse tokens and a Chinese-equity benchmark), not native collectible floor prices.
- Part 2's variance gaps come from experimental-finance tasks (bubble markets, second-price auctions, the newsvendor
  problem), not a social feed; the transfer is plausible but unmeasured. TwinMarket's advantage is reported by its authors,
  not independently replicated.
- The field moves fast (neural simulation-based inference, LLM-agent realism benchmarks); re-check before relying on it.

## Open questions
1. Native stylized facts for the market being simulated, measured on its own price series rather than proxies.
2. A closed-form mean-reversion or soft-ceiling process, with parameter ranges that hit kurtosis about 7 and α+β about 0.9
   at small scale.
3. Whether persona-derived bias parameters recover human-like variance or only relocate the gap, and how to tell without
   ground truth.
4. Whether CR rises monotonically under deliberately induced cross-agent phrase contagion; how much convergence comes from
   the engine's canned phrases against genuine LLM homogenization (run the ablation); and the marginal effect of per-agent
   decoding diversity on a population metric.

## Key sources
- **Calibration:** Platt 2019 (arXiv:1902.05938) · Dyer, Cannon, Farmer & Schmon 2024 (JEDC 161) · GradABM: arXiv:2207.09714, arXiv:2305.15340.
- **Stylized facts:** TwinMarket (arXiv:2502.01506) · Chan et al. 2024 (Physica A) · Ghosh, Bouri et al. 2023 · NFT death rates (crypto.news, CoinGecko; secondary).
- **LLM rationality and heterogeneity:** Henning, Camerer et al. (arXiv:2502.15800) · Lopez-Lira, "Can LLMs Trade?" (arXiv:2504.10789) · Feng, Choudhary & Shrestha, EMNLP 2025 (arXiv:2508.15926).
- **Convergence metrics and homogenization:** Shaib et al. (arXiv:2403.00553, arXiv:2407.00211) · distinct-n: Li et al. (arXiv:1510.03055) · "Artificial Hivemind", NeurIPS 2025 (arXiv:2510.22954) · OASIS (arXiv:2411.11581) · CORE (arXiv:2508.11915) · Generative Agents (arXiv:2304.03442).
