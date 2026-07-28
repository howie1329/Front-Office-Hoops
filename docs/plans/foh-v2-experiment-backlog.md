# Front Office Hoops v2 Experiment Backlog

Experiments are ordered by model risk. Each should be seeded, batchable, downloadable, and judged by distributions and correlations rather than whether code runs.

## E1 — Ratings distribution prototype

- **Question:** Can a visible rating scale create ordinary players, meaningful starters, rare stars, and exceptional generational players without compression?
- **Hypothesis:** A long-tailed latent distribution with role-specific derived views is more stable than target-overall roster slots.
- **Method:** Generate 100 leagues and 30,000 players; compare percentiles, role bands, ratings above 70/80/90, team strength spread, and evaluator uncertainty.
- **Output:** Distribution report, histogram, correlation matrix, recommended scale and presets.
- **Success:** Reference bands hold across league sizes and class seeds; stars are rare but present; no team talent collapse.
- **Failure:** Ratings cluster narrowly, every class has a star, or role differences disappear.
- **Scope:** 2–4 days.
- **Dependencies:** None; use a standalone v2 prototype.

## E2 — Player-generation model comparison

- **Question:** Which generation method best produces coherent basketball identities, scarcity, outliers, busts, sleepers, and late bloomers?
- **Hypothesis:** Physical/latent-talent-first generation plus correlated skill clusters outperforms fixed archetype slots.
- **Method:** Implement comparable archetype-first, latent, correlated, role-first, and hybrid generators; generate 100 classes each; score correlations, role coherence, class strength, positional scarcity, and career outcomes.
- **Output:** Comparative report and retained fixture classes.
- **Success:** Hybrid model passes coherence and tail tests while supporting strong/weak classes.
- **Failure:** Model requires manual slot overrides to avoid implausible players.
- **Scope:** 4–7 days.
- **Dependencies:** E1.

## E3 — Contract-market simulation

- **Question:** Can a multi-team market produce explainable salaries with continuity and believable exceptions?
- **Hypothesis:** Clearing-market demand, comparables, prior salary, alternatives, and player priorities reduce unexplained volatility more effectively than rating multipliers.
- **Method:** Simulate 100 free-agency markets over 10 seasons with varied cap room, supply, injuries, contenders, and player priorities. Track salary change, max/min frequency, unsigned players, pay cuts, bidder count, and explanation factors.
- **Output:** Market report with outlier contracts and causal explanations.
- **Success:** Most salary movement is explainable; max deals track production/projection and scarcity; every outlier has a valid reason.
- **Failure:** Similar players receive discontinuous contracts without market changes, or teams cannot fill valid rosters.
- **Scope:** 5–8 days.
- **Dependencies:** E1/E2; lightweight contract rules.

## E4 — Game calibration prototype

- **Question:** Can a seeded possession model produce realistic team and player distributions over games and seasons?
- **Hypothesis:** Role-aware possession assignment with centralized profiles will outperform aggregate totals plus heuristic allocation.
- **Method:** Run 100 games, 100 seasons, and 20 ten-year leagues. Compare pace, efficiency, points, shot mix, percentages, rebounds, assists, turnovers, steals, blocks, fouls, minutes, usage, star concentration, and reconciliation.
- **Output:** Benchmark report, failed-seed bundle, and config recommendations.
- **Success:** Mean and percentile bands fall inside profile ranges; points and team/player stats reconcile exactly.
- **Failure:** One statistic passes only by breaking another, bench usage is implausible, or output is dominated by random noise.
- **Scope:** 7–12 days.
- **Dependencies:** E1/E2; benchmark profiles.

## E5 — Development and aging cohort study

- **Question:** Can skill-specific development produce realistic breakouts, plateaus, declines, second peaks, and career lengths?
- **Hypothesis:** Trait-specific trajectories with role/minute/health context are more believable than potential-driven broad growth.
- **Method:** Simulate 1,000 players across high-floor, high-risk, late-bloomer, star, role-player, and injury-affected cohorts.
- **Output:** Age curves, career distributions, skill-level transition report.
- **Success:** Peak ages, decline rates, late bloomers, and retirement bands remain stable across seeds.
- **Failure:** Potential guarantees outcomes, all players peak together, or injuries only subtract overall.
- **Scope:** 4–6 days.
- **Dependencies:** E1/E2.

## E6 — Simplified-cap prototype

- **Question:** Which cap rules create meaningful choices with low comprehension and testing burden?
- **Hypothesis:** Simple and Standard profiles capture most strategic value; aprons can remain optional.
- **Method:** Model Simple, Standard, and Advanced profiles across 30-season transaction scenarios; measure blocked transactions, AI complexity, user explanations, and strategic divergence.
- **Output:** Rules comparison and default recommendation.
- **Success:** Standard creates cap tension without frequent dead ends; every rejection is explainable.
- **Failure:** Users need exception knowledge to make routine moves, or AI spends most time cleaning invalid rosters.
- **Scope:** 4–6 days.
- **Dependencies:** E3.

## E7 — Lifecycle/state-machine prototype

- **Question:** Can every phase be saved, resumed, tested, and displayed without duplicated guards?
- **Hypothesis:** A transition table plus phase tasks is clearer than distributed eligibility checks.
- **Method:** Model a full season and forced interruptions at every phase/task; replay command streams and test invalid transitions.
- **Output:** Transition table, command fixtures, resume matrix.
- **Success:** No hidden transitions; every phase has a serializable state and deterministic next action.
- **Failure:** `advance` needs subsystem-specific knowledge or UI-only assumptions.
- **Scope:** 3–5 days.
- **Dependencies:** E6 rules vocabulary.

## E8 — Save-schema and portability prototype

- **Question:** Can a canonical document round-trip, migrate, partially export, and recover optional corruption?
- **Hypothesis:** Snapshot plus event ledger with optional large sections is the best browser-first compromise.
- **Method:** Create fixtures for new, ten-year, and thirty-year leagues; export profiles; corrupt optional game data; migrate v1-shaped fixtures.
- **Output:** JSON Schema, migration report, size/performance report.
- **Success:** Facts survive round-trip; invalid references fail clearly; optional data can be dropped safely.
- **Failure:** Full saves exceed practical budgets or migration silently changes facts.
- **Scope:** 4–7 days.
- **Dependencies:** E7.

## E9 — AI team-building lab

- **Question:** Can persistent team plans produce coherent roster construction over ten seasons?
- **Hypothesis:** Team timelines and cap plans reduce individually valid but collectively incoherent moves.
- **Method:** Run 20 ten-year leagues with rebuilding, buying, contending, and owner-constraint teams; inspect roster balance, draft assets, cap, trades, and dynasties.
- **Output:** AI behavior report and decision traces.
- **Success:** Plans remain coherent, rebuilds occur, contenders consolidate appropriately, and no team accumulates impossible assets.
- **Failure:** AI oscillates modes, overvalues one metric, or creates roster/cap dead ends.
- **Scope:** 6–10 days.
- **Dependencies:** E3/E6/E7.

## E10 — Table and information-density prototype

- **Question:** Can dense management screens support comparison on desktop and mobile without custom table drift?
- **Hypothesis:** TanStack Table with URL state, saved views, and responsive priority columns is sufficient.
- **Method:** Prototype roster, cap sheet, free agency, and draft board; test keyboard, filters, sorting, comparison drawer, 375px mobile, and large desktop.
- **Output:** Screen specs, interaction findings, reusable table API.
- **Success:** Primary decisions remain clear, state survives navigation, and no critical column is inaccessible.
- **Failure:** Users need horizontal scrolling for the primary action or saved views cannot reproduce state.
- **Scope:** 3–5 days.
- **Dependencies:** E8/E9 data contracts.

## E11 — Injury and retirement calibration

- **Question:** Do injuries and career exits create believable availability without dominating the league?
- **Hypothesis:** Exposure, age, stamina, recurrence, and severity distributions need separate calibration.
- **Method:** Simulate 30-year careers and compare games missed, major injuries, recurrence, age at retirement, and post-injury production.
- **Output:** Injury/retirement benchmark report.
- **Success:** Rates are stable and explainable across player archetypes and presets.
- **Failure:** One injury table creates unrealistic season variance or early retirement waves.
- **Scope:** 3–5 days.
- **Dependencies:** E4/E5.

## E12 — StoryPacket factuality prototype

- **Question:** Can external narrative generation consume enough structure without becoming a source of truth?
- **Hypothesis:** Event references plus concise season summaries support useful narrative while preserving factual traceability.
- **Method:** Generate packets for games, trades, playoffs, draft, and season retrospectives; verify every claim against source IDs.
- **Output:** StoryPacket schema, factuality checks, deletion/regeneration behavior.
- **Success:** Narrative is optional, traceable, and cannot mutate league state.
- **Failure:** Packet lacks context or generated prose introduces unsupported claims.
- **Scope:** 2–4 days.
- **Dependencies:** E8 and event architecture.

## First implementation gate

Do not start the full v2 application until E1–E4 have produced accepted benchmark ranges. Do not implement advanced cap rules, AI narrative, multi-team trades, or broad UI polish before the underlying ratings, game, development, and contract-market experiments are stable.
