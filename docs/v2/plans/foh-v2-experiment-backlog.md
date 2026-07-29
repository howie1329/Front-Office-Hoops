# Front Office Hoops v2 Experiment Backlog

Experiments are ordered by risk to the first-v2 product. Each experiment should be independent of the polished UI, use explicit deterministic seeds where reproducibility is required, produce downloadable reports, and retain failed cases as fixtures. The [lab strategy](./foh-v2-lab-strategy.md) maps these experiments to a smaller set of visual surfaces and headless harnesses.

## Strategy alignment

- E1 should establish the shared fixture, batch, metrics, progress, cancellation, and report contracts that will become the small `packages/calibration` toolkit.
- E2 and E3 remain upstream population evidence; they are modes of the existing Population & Roster workbench, not separate permanent routes.
- E4 is the next active implementation slice. It should produce the production game contract before any season, value, contract, or AI work is connected.
- E5 is one Production & Value surface but two production modules: season/player aggregation and universal player value.
- E6 and E7 are one Market & Rules surface. Keep player demand, offer acceptance, legality, affordability, market clearing, and finance as separate results and tests.
- E8 is a combined Career Cohort harness. Simple annual transitions required for season two can land before the full cohort report is complete.
- E10 owns the later Draft & Decision surface. It includes baseline draft AI; a generic AI Decision Lab is not required.
- E11 is a matched-league effects experiment for owners/staff, not a prerequisite for game simulation and not a full staff-market route.
- E12 and E9 are cross-cutting integration gates used by the League Loop Lab, not reasons to create more visual labs.
- E13 and E14 remain post-loop product experiments and must not pull the management shell or narrative layer ahead of simulation contracts.

## E1 — V2 document, worker, and repository prototype

- **Question:** Can the browser worker, canonical document, Dexie repository, and JSON export/import boundaries work without v1 state leakage?
- **Hypothesis:** A worker-owned snapshot plus a main-thread repository adapter gives responsive simulation and safe local saves.
- **Method:** Create a minimal `LeagueDocument`; send commands through a Web Worker; save/reload through Dexie; export/import JSON; interrupt a long command and recover the last committed snapshot.
- **Output:** Worker protocol, repository contract, JSON fixture, failure/recovery report.
- **Success:** Round trip preserves facts; UI remains responsive; failed work does not corrupt the save.
- **Failure:** Worker state and persisted state diverge, or the application requires React state to reconstruct simulation truth.
- **Scope:** 3–5 days.
- **Dependencies:** None.

## E2 — Ratings distribution prototype

- **Question:** Can a 0–100 overall scale create average players, meaningful starters, rare stars, and exceptional generational players?
- **Hypothesis:** A long-tailed correlated skill distribution with one derived visible overall is more stable than roster-tier target slots.
- **Method:** Generate 100 30-team leagues; compare overall percentiles, values above 70/80/90, team strength spread, position spread, and league rank stability.
- **Output:** Distribution report, histogram, correlation matrix, recommended standard preset.
- **Success:** Ordinary players occupy the middle, stars are uncommon, generational players are rare, and league strength does not collapse.
- **Failure:** Ratings compress, every class produces too many stars, or a single overall hides major role differences.
- **Scope:** 2–4 days.
- **Dependencies:** E1.

## E3 — Player-generation model comparison

- **Question:** Which generation method produces coherent players, natural archetype frequency, positional scarcity, outliers, busts, sleepers, and late bloomers?
- **Hypothesis:** Generate correlated latent profiles first, then derive primary/secondary positions and archetypes.
- **Method:** Compare archetype-first, role-first, latent-talent, correlated-cluster, and hybrid models; generate 100 classes per method; score skill correlations, physical coherence, archetype confidence, class strength, and career outcomes.
- **Output:** Comparative report, retained generated classes, selected generator contract.
- **Success:** The chosen model needs no archetype quotas to produce varied, believable players.
- **Failure:** Players are incoherent, archetypes dominate skills, or natural generation produces unusable rosters.
- **Scope:** 4–7 days.
- **Dependencies:** E2.

## E4 — Game and box-score calibration

- **Question:** Can a client-side possession model produce believable team/player box scores without play-by-play storage?
- **Hypothesis:** Role-aware possession opportunity plus a calibrated lineup model is better than aggregate team totals followed by heuristic stat allocation.
- **Method:** Run 100 games, 100 seasons, and 20 ten-year leagues in deterministic lab mode. Compare pace, scoring, efficiency, shot mix, percentages, rebounds, assists, turnovers, steals, blocks, fouls, minutes, usage, star concentration, and exact reconciliation.
- **Output:** Benchmark report, failed-seed bundle, standard game preset.
- **Success:** Means, percentiles, correlations, and player/team totals fall within target ranges.
- **Failure:** One statistic passes only by breaking another, bench players receive implausible usage, or random variance dominates skill.
- **Scope:** 7–12 days.
- **Dependencies:** E2/E3.

## E5 — Production composite and player-value prototype

- **Question:** Can a simple visible universal player value combine current ability and recent production without becoming a master number for every decision?
- **Hypothesis:** A small weighted model with current ability, simple role-adjusted box-score production, age/trajectory, upside, durability, and bounded scarcity is sufficient for first v2.
- **Method:** Build two-season production composites from scoring/efficiency, assists/turnovers, rebounding, steals/blocks, games/minutes, and basic role context. Compare value ranks with overall, production, age, health, and simulated team impact.
- **Output:** Visible value breakdown, calibration report, trade/contract context-modifier contract.
- **Success:** Value rewards production without rewriting true talent; similar players are ordered plausibly; outliers are explainable.
- **Failure:** Points-per-game dominates, value oscillates without performance change, or role specialists disappear.
- **Scope:** 4–6 days.
- **Dependencies:** E2–E4.

## E6 — Contract-market simulation

- **Question:** Can three-stage free agency produce explainable contract demand with continuity while remaining simple?
- **Hypothesis:** AI offers first, user offers second, and player choice among offers produces better pacing and transparency than a single auction pass.
- **Method:** Simulate 100 markets with varied player values, production, cap room, supply, prior salaries, market size, winning teams, and owner spending tolerance. Track salary movement, max/min frequency, pay cuts, unsigned players, bidder count, stage behavior, and explanation factors.
- **Output:** Three-stage market report, contract utility breakdown, outlier fixtures.
- **Success:** Best internal contract value generally wins; unusual outcomes have clear reasons; teams fill legal rosters; salary continuity is stable.
- **Failure:** Similar players receive unexplained discontinuous deals or Stage 1 AI behavior makes user participation meaningless.
- **Scope:** 5–8 days.
- **Dependencies:** E5; lightweight soft-cap-plus-tax rules.

## E7 — Simplified-cap and finance prototype

- **Question:** Can a configurable soft cap plus tax create meaningful decisions without apron complexity?
- **Hypothesis:** Cap, tax, minimum/maximum salary, annual growth, owner spending tolerance, and market size are enough for first v2.
- **Method:** Simulate 30-season financial scenarios with different cap growth, tax thresholds, market sizes, owner traits, and payroll strategies. Measure tax pressure, roster legality, team spending spread, and user comprehension.
- **Output:** Standard economy preset, advanced setting bounds, financial explanation catalog.
- **Success:** Spending matters, cap/tax calculations reconcile, and routine decisions do not require NBA-rule expertise.
- **Failure:** Teams regularly hit dead ends, owners have no meaningful effect, or tax settings do not change behavior.
- **Scope:** 4–6 days.
- **Dependencies:** E5/E6.

## E8 — Development, injury, and retirement cohorts

- **Question:** Can simple configurable development, injury, and retirement behavior create credible careers?
- **Hypothesis:** Skill-specific trajectories plus age, minutes, coaching, health, and randomness are better than broad overall deltas.
- **Method:** Simulate 1,000 players across star, starter, role-player, high-floor, high-risk, late-bloomer, and injury-affected cohorts. Compare peak age, breakouts, declines, games missed, recurrence, and retirement age.
- **Output:** Career distribution report and standard/advanced setting ranges.
- **Success:** Career curves are stable and traits remain permanent without requiring morale or role promises.
- **Failure:** Potential guarantees outcomes, all players peak together, or injuries only subtract overall.
- **Scope:** 4–7 days.
- **Dependencies:** E2–E5.

## E9 — Lifecycle and gate prototype

- **Question:** Can the two top-level modes and explicit subphases save, resume, and explain every stop?
- **Hypothesis:** A transition table with phase tasks is clearer than distributed eligibility guards.
- **Method:** Interrupt a league at owner goals, games, trade deadline, playoffs, staff, re-signing, draft, each free-agency stage, and roster completion. Reload and continue from each checkpoint.
- **Output:** Transition table, command fixtures, resume matrix, blocked-reason catalog.
- **Success:** No hidden transitions; each stop has a user action; missing players/staff/contracts block with actionable explanations.
- **Failure:** `advance` must know unrelated subsystem internals or UI-only assumptions are required.
- **Scope:** 3–5 days.
- **Dependencies:** E7.

## E10 — Draft, scouting, and baseline AI lab

- **Question:** Can fog-of-war scouting and best-available AI produce understandable two-round draft behavior?
- **Hypothesis:** Scout quality changes range width/accuracy; AI uses public ranges, mock draft, need, mode, and rookie value.
- **Method:** Generate 100 draft classes with weak/average/strong variance; compare scouting error by scout level, mock-draft accuracy, AI pick quality, position scarcity, and simulated user picks.
- **Output:** Draft board data contract, scouting ranges, AI selection report.
- **Success:** Exact true values remain hidden; better scouts are meaningfully better; AI makes legal understandable picks.
- **Failure:** Mock rankings reveal true talent, scout quality has no effect, or AI needs deep organizational planning to make valid picks.
- **Scope:** 3–5 days.
- **Dependencies:** E3/E5/E7.

## E11 — Owner and staff effects lab

- **Question:** Do owners and four staff roles matter without becoming a separate management simulator?
- **Hypothesis:** Owner traits/goals affect spending and job security; head coach affects style/development; assistants provide small modifiers; head scout affects fog of war.
- **Method:** Run matched leagues with owner/personality and staff variations. Measure payroll, goals, strikes, development, game style, and scouting accuracy.
- **Output:** Trait/effect bounds, goal-generation matrix, staff explanation catalog.
- **Success:** Effects are noticeable over seasons but never overpower player talent or produce arbitrary vetoes.
- **Failure:** Owner goals are impossible, assistants dominate outcomes, or scouting is unrelated to staff quality.
- **Scope:** 3–5 days.
- **Dependencies:** E4/E7/E8/E10.

## E12 — Save-schema and export portability

- **Question:** Can full, operational, career, draft, team, storytelling, and debug exports round-trip safely?
- **Hypothesis:** Current snapshot plus event history and optional compact box scores is the right browser-first compromise.
- **Method:** Create new, ten-year, and thirty-year fixtures; export/import profiles; migrate v1-shaped fixtures; corrupt optional game sections; measure load and file size.
- **Output:** JSON Schema, migration reports, size/performance report, golden files.
- **Success:** Facts survive round trip; invalid references fail clearly; optional sections can be dropped safely.
- **Failure:** Migration changes facts or full saves exceed practical browser budgets.
- **Scope:** 4–7 days.
- **Dependencies:** E1/E9.

## E13 — Table and management-screen prototype

- **Question:** Can dense roster, cap, free-agency, trade, and draft screens support decisions on desktop and mobile?
- **Hypothesis:** TanStack Table with URL state, saved views, comparison, and responsive priority columns is sufficient.
- **Method:** Prototype four screens with realistic generated data; test sorting, filtering, keyboard controls, comparison drawers, 375px mobile, and large desktop.
- **Output:** Shared table API, screen specs, accessibility findings.
- **Success:** Primary decisions remain obvious and filters/context survive navigation.
- **Failure:** Users need horizontal scrolling for primary actions or tables require route-specific behavior.
- **Scope:** 3–5 days.
- **Dependencies:** E5/E6/E10/E12.

## E14 — StoryPacket boundary prototype

- **Question:** Can future narrative consume enough factual structure without owning simulation truth?
- **Hypothesis:** Events plus compact season/game summaries are sufficient.
- **Method:** Build packets for games, trades, playoffs, draft, owner goals, and season retrospectives; verify claims against source event IDs.
- **Output:** StoryPacket schema and factuality checks.
- **Success:** Narrative remains optional, traceable, regenerable, and unable to mutate league state.
- **Failure:** Packets lack context or generated text introduces unsupported facts.
- **Scope:** 2–4 days.
- **Dependencies:** E1/E9/E12.

## First implementation gate

Begin foundation implementation immediately with E1. Do not build the full v2 application until E2–E7 establish accepted ranges for ratings, generation, games, player value, contracts, and the simplified economy. Do not build advanced cap rules, multi-year AI, morale, rich scouting, narrative, or broad UI polish before the first-v2 loop is calibrated.
