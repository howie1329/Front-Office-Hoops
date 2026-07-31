# Front Office Hoops v2 Lab Strategy

**Status:** Recommended calibration and integration strategy  
**Review date:** 2026-07-29  
**Branch reviewed:** `codex/v2-tanstack-start-scaffold`

## Executive recommendation

Build a small calibration platform around the same pure simulation modules that the eventual game will call. Do not turn every subsystem into a permanent route.

The recommended product surface is:

1. **Population & Roster Lab** — the existing Player Generation and Team Assembly workbench, presented as two modes over separate production modules.
2. **Game & Matchup Lab** — a two-team fixture inspector backed by a headless repeated-game benchmark runner.
3. **Production & Value Lab** — a season/sample runner plus production and universal-value inspectors; long-run distribution work is headless.
4. **Career Cohort Harness** — development, aging, availability/injuries, and retirement tested together as cohorts; a visual report is optional.
5. **Market & Rules Lab** — individual contract demand/acceptance, league market clearing, and simple cap/tax legality in one surface with separate pure stages.
6. **Draft & Decision Lab** — draft-class/scouting inspection plus baseline decision scenarios; owner, staff, and AI policy tests are embedded or batch-driven rather than separate simulators.
7. **League Loop Lab** — the integration and failure-reproduction harness for a complete saved league; it is not a second simulation engine.

The first implementation slice should be the **Game & Matchup Lab**, beginning with a headless batch harness and a small visual fixture inspector. It establishes the first downstream production contracts: rotations, availability, staff inputs, game results, box scores, and reconciliation. It should consume a real imported `InitialPlayerUniverse` fixture and progressively write the game output into a versioned `LeagueDocument` rather than inventing another simulation model.

The first complete simulation engine exists when a generated `LeagueDocument` can run a full regular season, playoffs, simple offseason, and begin the next season with no manual repair. A game benchmark or a season-production report alone is not a complete engine.

## 1. Review scope and current repository evidence

This review inspected the V2 packages, routes, tests, and V2 documentation. The relevant current implementation is:

- `packages/domain-v2/src/types.ts` defines the canonical entities, but `LeaguePhase` is currently only `"foundation"`, `SimulationConfig` only contains `presetId` and `version`, and `LeagueCommand` contains only `NoOp` and an unimplemented `AdvanceDay`.
- `packages/domain-v2/src/playerGeneration.ts` owns the standard and population-specific generation configuration. The standard roster population is 450 players, free agents are 100, and the draft class is 90.
- `packages/sim-v2/src/playerGeneration.ts` generates a player and diagnostics. `getPlayerCurrentAbility` is the rounded average of the eight generated skills.
- `packages/sim-v2/src/playerPopulation.ts` gives each population a deterministic seed namespace and stable IDs.
- `packages/sim-v2/src/playerUniverse.ts` produces the 640-player initial universe and validates population membership, roster size, status, and core positional coverage.
- `packages/sim-v2/src/rosterAssembly.ts` assembles 15-player rosters using current ability, deterministic selection noise, and positional coverage. It does not model team fit, contracts, staff, owners, rotations, or finances.
- `apps/web-v2/src/lib/playerGenerationLab.ts` provides single/batch generation, summaries, histograms, configuration validation, and JSON reports.
- `apps/web-v2/src/lib/teamAssemblyLab.ts` provides a deterministic 30-team universe run, population summaries, and a version-one report envelope.
- `packages/league-schema/src/schema.ts` validates the foundation document and player configuration. `packages/league-schema/src/migrations.ts` currently supports only the current schema version; there is no migration chain yet.
- `packages/sim-v2/src/executeCommand.ts` validates a document and handles `NoOp`; `AdvanceDay` is intentionally rejected as not implemented.
- `packages/db-v2/src/repository.ts` already provides validated local save, load, export, import, and import preview for `LeagueDocument`.

The V2 tests are green for the new foundation, domain, schema, database, and V2 lab surfaces: 41 `sim-v2` tests, 9 web-v2 lab tests, 10 schema tests, 7 domain tests, and 6 database tests passed in the reviewed checkout. The repository-wide test command still fails in the existing V1 `packages/sim` suite at `tests/gameSim/gameSim.test.ts:144` because the average rebound assertion is `54.149`, just above its upper bound of `54`. This is not a V2 blocker, but it means the branch cannot be described as globally test-green.

## 2. Assessment of the existing labs

### 2.1 Player Generation Lab — stable upstream with bounded calibration debt

**Recommendation:** Keep as a production module and keep its visual inspector. Merge its route shell with Team Assembly into a broader Population & Roster Lab, but do not merge the underlying domain responsibilities.

What is already strong:

- Generation is deterministic when called with `createDeterministicRandom` and uses scoped randomness for talent, physical profile, skills, development, and traits (`packages/sim-v2/src/playerGeneration.ts:177-347`).
- Hidden generation facts are returned as diagnostics rather than stored on the player entity. The tests explicitly verify that identity changes do not change basketball generation and that diagnostics do not leak into the entity (`packages/sim-v2/tests/playerGeneration.test.ts:31-68`).
- Population presets are shared by the domain and lab. The lab is not maintaining a second set of default counts or configs.
- Identities, league statuses, primary/secondary positions, archetypes, potential, development rating, volatility, and injury resistance are present and have bounded tests.
- The configuration is typed and schema-validated by `playerGenerationConfigSchema` rather than being an untyped form payload.

What blocks downstream use:

- There is no batch benchmark that establishes accepted league-level distributions across many seeds. Current tests prove reproducibility and bounds, not that the default league has the desired talent tails, position supply, or role diversity.
- `currentAbility` is an average of skills. That is acceptable as a generation and roster-assembly summary, but it must not become the game engine’s player value, role fit, usage, contract demand, or team-fit truth.
- The generated profile has only eight skills. Game simulation may derive shot creation, decision quality, defensive impact, and role opportunity from these fields initially, but that mapping must be explicit and owned by the game module.
- `PlayerGenerationConfig` is in `domain-v2`, while the generated `InitialPlayerUniverse` is not embedded into `LeagueDocument`. The canonical league-creation adapter is still missing.

Calibration improvements that can wait:

- More realistic latent-factor structure, more than one trait, richer archetype confidence, and better class-wide talent variance.
- A role-specific internal evaluation model, provided it remains separate from the universal current-ability summary.
- More sophisticated age, potential, and scouting semantics.

The correct boundary is therefore:

```text
True generated profile
  -> derived current-ability summary (generation/assembly diagnostic)
  -> role fit, lineup fit, game opportunity, production, value, demand, and team fit
     are calculated by their own modules
```

This separation is viable and should be preserved. The immediate requirement is not to redesign overall; it is to prevent later modules from treating it as the master number.

### 2.2 Team Assembly / Player Universe Lab — valid fixture source, not yet a league source

**Recommendation:** Keep the assembly algorithm as production infrastructure, merge its visual surface into Population & Roster Lab, and promote the validated universe result into a typed fixture input for the game lab.

What is already strong:

- `generateInitialPlayerUniverse` deterministically creates 450 rostered players, 100 free agents, and 90 draft prospects for the standard 30-team configuration (`packages/sim-v2/src/playerUniverse.ts:274-368`).
- `validateInitialPlayerUniverse` checks unique IDs, one population membership per player, roster/status agreement, 15-player rosters, free-agent and draft counts, and two-player core coverage at every position (`packages/sim-v2/src/playerUniverse.ts:141-271`).
- Assembly settings are isolated from player generation settings, and the tests prove that changing free-agent generation does not alter roster players and changing assembly variance does not alter generated profiles (`packages/sim-v2/tests/playerUniverse.test.ts:56-113`).
- Representative seed coverage exists for ten universes (`packages/sim-v2/tests/playerUniverse.test.ts:179-189`).

What is still missing before this becomes league-creation input:

- `TeamEntity` is currently only `{ id, name }`; there is no authoritative roster reference, market, owner, staff, payroll, contract, draft-asset, or team-plan model in the V2 document.
- A legal roster is not necessarily a playable roster. The game boundary still needs a starting/depth configuration, eligible position coverage, minutes, availability, coaching profile, and team-level context.
- Current assembly optimizes current ability plus noise and positional coverage. That is appropriate for deterministic initial distribution, not for persistent front-office AI.
- There is no documented compact two-team fixture format, so the current JSON report is a lab report rather than a reusable game scenario.

The universe should eventually be embedded into the canonical `LeagueDocument` through a league-creation production command. It should not be copied into an ad hoc game-only format. A small matchup fixture may reference a full document plus two team IDs, or contain a minimized normalized subset with an explicit source document/version. Both forms belong to the same versioned schema family.

## 3. Lab boundary decisions for every proposed lab

| Proposed lab | Decision | Boundary and reason |
|---|---|---|
| Player Generation | **Merge at the route level; keep the module** | Population & Roster Lab has a generation mode and an assembly mode. `generatePlayerPopulation` and `generateInitialPlayerUniverse` remain separate production APIs. |
| Team Assembly / Player Universe | **Merge at the route level; keep the module** | It is the immediate consumer of generation and exists to create repeatable league/matchup fixtures. It should not become persistent organization AI. |
| Game Simulation | **Keep, split by execution mode** | Visual two-team fixture inspection, single-game comparison, and manual rotation changes are useful. Repeated games, seasons, and distribution sweeps belong in headless batch runs. |
| Season, Production, and Player Value | **One route with separate modes and modules** | Season execution, production aggregation, and value calculation are different authoritative systems but benefit from one evidence-oriented inspector. Long-run season distributions are headless. |
| Career | **Merge development, aging, injuries, and retirement into a cohort harness** | These are one longitudinal state transition problem. Keep in-game availability/injury and annual development as production modules; cohort calibration is not four permanent routes. |
| Contract Valuation and Negotiation | **Merge with Market & Rules Lab at the surface; keep stages separate** | Demand, offer acceptance, legality, and affordability need separate return types and tests. One route can compare them without one opaque result. |
| Contract Market and League Economy | **Merge with Contract Valuation at the surface** | Market clearing needs player demand plus cap/tax state. Finance is mainly a headless invariant/range harness with a small visual transaction inspector. |
| Staff | **Defer as a full lab; use fixtures and matched batches** | Manual coach profiles are sufficient for first-game calibration. Staff generation/effects can be tested in matched leagues; staff employment and staff markets are not prerequisites for the first game. |
| Team, Owner, and League Creation | **Merge into league creation production; convert correlations to batch diagnostics** | Team identity, owner, market, initial payroll, and staff are inputs to a complete league. They do not justify a separate permanent visual route before the league shell exists. |
| Draft and Scouting | **Keep as a later Draft & Decision Lab** | Draft classes, uncertainty, public ranges, and baseline picks are valuable interactive comparisons after the in-season engine exists. Rich scouting remains deferred. |
| AI Decision | **Remove as a top-level lab** | Reusable selection machinery should live in `sim-v2`; each domain supplies a scoring model. Scenario runners and legal/coherence assertions are better than a generic AI page. |
| League Loop / Lifecycle | **Keep as the final integration harness** | It validates composition, save/resume, failure explanations, performance, and historical consistency. It must call production modules and must not duplicate them. |

## 4. Recommended laboratory architecture

### 4.1 Population & Roster Lab

This is the current upstream workbench with two modes:

- **Generation mode:** individual player inspection, population distributions, histograms, percentiles, correlation summaries, and config comparison.
- **Universe mode:** 30-team generation, roster coverage, team-strength spread, population membership, and export of full-universe or matchup fixtures.

The route can share seed controls, preset selection, batch count, report export, and failed-seed retention. The production modules remain composable and headless.

**Inputs:** `PlayerGenerationConfig`, population preset ID, seed, team IDs, roster assembly config, league ID.

**Outputs:** `PlayerEntity[]` with diagnostics, `InitialPlayerUniverse`, population report, assembly report, and a versioned scenario fixture.

**Authoritative production systems created:** player generation, population generation, identity generation, role derivation, initial roster assembly, population/status validation.

**Developer-only outputs:** latent talent, selection noise, role-fit diagnostics, histograms, and assembly pick shortlists. These must not appear in normal gameplay unless an explicit debug setting is enabled.

**Success:** reproducible generation, accepted distribution bands, no duplicate/missing membership, legal 15-player rosters, positional coverage, and no dependence on UI state.

**Failure:** generation is reproducible but league tails are implausible, rosters regularly cannot form, assembly over-optimizes one summary, or diagnostics leak into authoritative player state.

### 4.2 Game & Matchup Lab

This is the next lab to build. It should begin with a compact matchup inspector and a headless batch runner, not a live coaching screen.

**Visual modes:**

- import a full `LeagueDocument` and choose two teams;
- import a matchup fixture containing two teams and their players;
- choose starters, depth order, target minutes, availability restrictions, and manually configured coaching profiles;
- run one game or a short series;
- inspect final team/player box scores, minutes, usage, shot mix, injuries, and reconciliation diagnostics;
- save unusual or failed seeds as fixtures.

**Headless modes:** repeated matchup runs, lineup sweeps, coaching-profile matched pairs, injury/availability sweeps, and distribution reports.

**Staff decision:** use manually configured head-coach/offensive-assistant/defensive-assistant fixtures first. Do not depend on a Staff Lab or staff market. The contract should accept the eventual staff shape, while the first calibration uses fixed fixture profiles. Development emphasis is ignored by single-game simulation and reserved for career transitions.

**Inputs:** rostered `PlayerEntity` records, team IDs, starting five, depth order, target minutes, player availability/injuries, coaching profile, game configuration, random source, and optional matchup context.

**Outputs:** authoritative `GameResult`, team box scores, player box scores, compact game record, injury events, diagnostics, and benchmark metrics.

**Authoritative production systems created:** rotation validation and minute normalization, lineup/role opportunity, game simulation, player/team stat aggregation, injury availability hook, game event creation, and reconciliation checks.

**Developer-only outputs:** possession counters, intermediate shot-quality components, random scopes, lineup-fit scores, distribution histograms, and failed-seed traces.

**Success:** team and player totals reconcile exactly; minutes are legal; unavailable players do not play; valid rotations produce complete games; coaching effects are bounded; repeated games show skill/role signal plus reasonable variance; final box scores are sufficient without play-by-play.

**Failure:** player stats are merely arbitrary allocations from team totals, role/minute settings have little effect, bench players receive implausible usage, staff modifiers overpower talent, or one statistic can only be calibrated by breaking another.

### 4.3 Production & Value Lab

Season production and player value should have one route because developers need to compare their outputs, but they must be independent modules and data records.

**Modes:**

- 10-game smoke sample for fast iteration;
- 25-game early sample for role and availability checks;
- 82-game standard season;
- repeated 82-game seasons and multi-season batches for distributions;
- player production inspector;
- universal value breakdown inspector;
- team/league production comparison.

The first version uses regular-season `GameResult` records only. Playoff production is intentionally deferred from the core Universal Player Value; a later extension may use postseason performance as a separate signal for awards, history, reputation, or optional context.

Universal Player Value is a player-centered, unbounded additive index over a three-season horizon. It does not use a dynamic replacement-level baseline or league-relative scarcity to define the player's value. It combines a fast current-form signal with a slower projection signal, using sample size and confidence to explain movement without suppressing meaningful hot or cold performance. Percentiles and ranks are reporting views, not inputs to the core value.

Production should expose a confidence/sample state. A 10-game sample can be displayed as provisional; value should use a current-ability/projection fallback until a player has a meaningful sample. For first-v2 calibration, 25 games is enough to find role bugs, 82 games is the minimum production benchmark, and two completed seasons are the preferred input for a stable established-player production component. Rookies and injured players need explicit sample-size and availability fallbacks rather than fake precision.

**Inputs:** completed `GameResult` records, player roles and minutes, team context used to normalize production, availability, current abilities, age/trajectory, potential/upside, durability, and value configuration. Contract quality, team fit, timeline, roster needs, and league-relative scarcity are downstream context inputs for trade, market, and AI systems; they do not redefine the core player value.

All gameplay-relevant production and value behavior must be controlled by a versioned, serializable configuration with a standard preset and bounded advanced settings exposed in the UI. Custom leagues may adjust semantic behaviors such as current-form responsiveness, production sample confidence, availability impact, projection horizon, and component emphasis within documented limits. Exact formula coefficients remain implementation details, and every run/report must preserve the effective settings and seed for deterministic reproduction.

**Outputs:** game-to-season aggregation, player production records, team offense/defense records, standings inputs, production distributions, universal value records with breakdowns, and comparison reports.

**Authoritative production systems created:** player/team production aggregation and the visible universal player value. Trade value, contract demand, and team-specific value consume universal value and add explicit context modifiers; they do not overwrite it.

**Developer-only outputs:** feature contributions, percentile ranks, confidence flags, leave-one-factor-out comparisons, outlier reports, and calibration charts.

**Success:** role-adjusted production rewards useful players without making points-per-game the master truth; values are stable across reasonable samples; specialists remain visible; production does not rewrite skills; outliers are explainable.

**Failure:** value is a disguised overall, production oscillates on noise, one role disappears, availability is ignored, or the same value is silently reused as contract demand, trade value, and team fit.

### 4.4 Career Cohort Harness

The proposed Career Lab is valid as a combined longitudinal harness, not as four separate visual applications. It should be implemented after the first in-season loop can produce meaningful minutes, production, and injury exposure. The simple annual transitions needed to reach season two may be implemented earlier; the cohort calibration surface can follow.

**Cohorts:** age 19/24/29/34, high/low development, high/low volatility, durable/injury-prone, high/low minutes, strong/weak coaching, and selected late-bloomer/bust fixtures.

**Runs:** 3 and 5 years for iteration, 10 years for normal calibration, 15–30 years for career/retirement distributions. Use at least 500 players per cohort for directional work and 1,000 where tail rates are a release gate.

**Inputs:** player profile, annual minutes and production, development config, staff/coaching effects, health state, injury config, retirement config, and deterministic seed.

**Outputs:** skill trajectories, realized development events, injuries/recovery, availability, aging, retirement decisions, cohort summaries, and league inflation/deflation reports.

**Authoritative production systems created:** annual skill transition, aging, injury state transitions, recovery, retirement eligibility, and development event recording.

**Developer-only outputs:** latent trajectory forecasts, potential-accuracy diagnostics, cohort labels, counterfactual matched runs, and failure traces.

**Success:** development is skill-specific and probabilistic; potential does not guarantee outcomes; athletic decline and skill improvement have different shapes; injuries affect availability and may affect future trajectories without simply subtracting overall; retirement ages are plausible; league distributions remain stable.

**Failure:** all players peak together, potential determines careers, injuries only subtract ratings, coaching dominates player profile, or the cohort harness uses a different annual transition than the league loop.

### 4.5 Market & Rules Lab

This surface combines individual contract scenarios and multi-team market batches while keeping the decisions separate in code and results.

The engine must return distinct results for:

```text
PlayerExpectedValue
  -> baseline basketball/economic expectation

ContractDemand
  -> what the player would like under current market/context assumptions

OfferAcceptance
  -> utility evaluation of one specific offer versus alternatives

LeagueLegality
  -> whether the rules permit the transaction

TeamAffordability
  -> whether the team can fund/roster the transaction
```

**Visual modes:** single-player offer comparison, demand breakdown, contract continuity comparison, simple cap/tax calculator, market-stage replay, and outlier market inspection.

**Headless modes:** 100–1,000 market runs across supply, demand, cap room, market size, owner spending tolerance, prior salary, comparable contracts, and player preference scenarios. Finance rule sweeps are primarily assertions and benchmark reports.

**Inputs:** `LeagueDocument` financial state, player value/production/age/trajectory/durability, previous salary, comparables, free-agent pool, team cap room/payroll, market/team context, offer terms, and simple rule profile.

**Outputs:** demand estimates, offer utilities, acceptance outcomes, counters if retained in scope, market stages, contract assignments, payroll/tax projections, legality decisions, affordability decisions, explanations, and retained market fixtures.

**Authoritative production systems created:** contract terms, demand model, offer acceptance, market clearing, cap/tax/minimum/maximum validation, options, dead money, basic roster legality, and signing events.

**Developer-only outputs:** exact utility weights, bidder ranking, alternative-offer set, market clearing path, sensitivity sweeps, and outlier reasons.

**Success:** terms are legal when accepted, a player signs once, salaries show continuity, market supply and cap room matter, user offers remain meaningful after AI offers, and unusual outcomes have structured reasons.

**Failure:** a player accepts an illegal or unaffordable offer, salary is determined by one opaque formula, every market clears identically, similar players receive unexplained discontinuities, or advanced NBA CBA behavior is required to avoid dead ends.

The first-v2 rules should remain soft cap, luxury tax, minimum/maximum salary, annual growth, rookie contracts, options, dead money, and basic trade matching. Aprons, sign-and-trades, complex exceptions, and detailed pick protections remain post-loop work.

### 4.6 Draft & Decision Lab

Draft generation, scouting, and baseline decision behavior belong together because scouting uncertainty is the input to the draft decision. It should not become a generic AI workbench.

**Visual modes:** draft-class comparison, public versus team-specific ranges, mock-draft inspection, single-pick decision comparison, and top/late/undrafted prospect follow-up.

**Headless modes:** 100 draft classes, scouting error sweeps, baseline AI selections, position-supply scenarios, and long-run top-pick/late-pick outcome reports.

**Inputs:** draft class, true player profiles, public scouting ranges, team scouting quality, mock draft, team need/mode, rookie contract, available picks, and simple decision policy.

**Outputs:** draft class, scouting estimates, mock draft, AI pick explanation, selections, rookie contracts, and later outcome linkage.

**Authoritative production systems created:** draft-class generation, scouting projections/ranges, lottery/order behavior, draft picks, rookie contract creation, and baseline best-available selection.

**Developer-only outputs:** true talent, scouting error, candidate score components, policy randomness, and post-career outcome attribution.

**Success:** exact talent is hidden from normal users; scouting quality changes range width/accuracy; picks are legal and understandable; team need is bounded; top-pick success, late-first success, second-round sleepers, and undrafted outcomes remain within accepted ranges.

**Failure:** public data leaks true potential, better scouts do not improve information, AI always reaches for need, or valid picks require persistent multi-year organizational intelligence.

### 4.7 League Loop Lab

The League Loop Lab is the final integration harness. It should provide stop/resume controls, batch execution, fixture retention, invariant reports, and performance metrics. It should not contain alternative game, market, draft, or development logic.

**Modes:** one season, two seasons, ten seasons, 30-season batch, stop at phase, automatic baseline-AI resolution, user-team pause points, save/reload at every major phase, import/export round trips, and failed-seed reproduction.

**Inputs:** full `LeagueDocument`, league settings, deterministic or normal random mode, command sequence, user-team decision fixtures, and batch profile.

**Outputs:** snapshots, events, archives, standings, box scores, contracts, draft results, production/value records, invariant report, performance/memory/save-size metrics, and retained failure fixture.

**Authoritative production systems created:** lifecycle transition table, phase task orchestration, command/event persistence, season archives, historical projections, and integration-level validation. The lab should not create a second set of domain modules.

**Developer-only outputs:** phase traces, RNG scope records, timing/memory metrics, state diffs, event causality traces, and failure bundles.

**Success:** a complete legal league starts, reaches playoffs, finishes a basic offseason, begins season two, saves/reloads/imports/exports at checkpoints, maintains historical consistency, and reports actionable failures.

**Failure:** a phase can be skipped silently, an automatic action changes user-owned decisions, saved facts are rerolled, the loop needs manual state repair, or the lab passes only because it bypasses production commands.

## 5. Dependency graph

```text
PlayerGenerationConfig
        |
        v
Player generation -> population/status validation
        |
        v
InitialPlayerUniverse + roster assembly
        |
        +----------------------------+
        |                            |
        v                            v
League creation adapter       Matchup fixture adapter
        |                            |
        v                            v
LeagueDocument ---------> Game & Matchup engine
        |                            |
        |                            +--> GameResult / box score / injury event
        |                            |
        |                            v
        |                   Season production / standings inputs
        |                            |
        |                            v
        |                   Universal player value
        |                            |
        +----------------------------+------------------+
        |                                               |
        v                                               v
Career transitions                              Market & Rules
development / aging / injury / retirement         demand / legality / affordability
        |                                               |
        +----------------------+------------------------+
                               v
                         Draft & baseline decisions
                               |
                               v
                         League Loop / lifecycle
                               |
                               v
                 saved season N -> offseason -> season N+1
```

Parallel dependencies:

- **Staff fixtures** feed the game engine, development transitions, and scouting; staff generation and employment can follow after fixed profile contracts exist.
- **Owner/team creation** feeds league settings, market context, spending tolerance, and goals; it does not need a separate simulation truth.
- **Scouting** consumes player truth but produces uncertain views; it must not change true player profiles.
- **AI decision policies** consume context-specific candidates and legal action evaluators; they do not own domain state.
- **League schema and repository** wrap every fixture and checkpoint. `LeagueDocument` remains the canonical save; lab reports are evidence, not gameplay state.

## 6. Recommended implementation order

### Slice 0 — Calibration foundation and fixture contract

Build or extract the shared batch primitives before the next visual route:

- explicit seed and random mode;
- fixture envelope/version/source metadata;
- JSON import/export and validation;
- batch progress, cancellation, and failed-seed retention;
- summary statistics, percentiles, histograms, correlations, and outlier records;
- benchmark profile with accepted ranges and a machine-readable pass/fail result;
- worker execution for long browser runs;
- report serialization separate from `LeagueDocument`.

This is the first justified slice of `packages/calibration`. Keep it small and dependency-directed: `calibration -> domain-v2`, `sim-v2`, and `league-schema`; never `sim-v2 -> calibration`.

### Slice 1 — Game & Matchup Lab (next build)

Start with a two-team imported fixture and a single game. Add repeated matchup mode only after the single-game invariants exist. Use manual staff fixtures. Establish the production game contract before adding a season runner.

Exit condition: one deterministic game can be rerun exactly, produces complete reconciled box scores, and has an explicit failure for invalid lineups/availability.

### Slice 2 — Season Production & Value

Add schedule/season execution around the calibrated game engine, then production aggregation, standings inputs, and the visible universal value. Do not build the full league shell yet; use a developer-only document/fixture runner.

Exit condition: a full 82-game regular season can be batch-run and value breakdowns remain explainable with sample-size flags.

### Slice 3 — Minimal league creation and first in-season vertical slice

Create the adapter that embeds the initial universe into `LeagueDocument`, add teams/rosters/rotations/coach fixtures, schedule, standings, injuries, checkpoints, and worker progress. Add enough UI for league creation, team selection, rotation, simulate-to-game/date, box scores, and save/reload.

Exit condition: the user can create a complete legal league, choose a team, set a rotation, simulate to the trade deadline, and reload without data repair.

### Slice 4 — Career transitions and basic staff/owner effects

Add annual development, aging, injury/recovery, retirement, simple owners/goals, and bounded staff effects. Run the cohort harness alongside the first season loop. Do not add staff markets or organization AI.

Exit condition: season one can transition to season two with stable cohort and availability distributions.

### Slice 5 — Market & Rules

Implement a simple rules profile, contract terms, demand, separate legality/affordability, re-signing, three-stage free agency, and baseline roster completion. Add individual contract and market batch reports.

Exit condition: a legal offseason can complete with continuity and explainable signings.

### Slice 6 — Draft & baseline decisions

Add fixed lottery/two-round draft, scouting ranges, rookie contracts, user picks, and baseline best-available AI. Embed AI policy evaluation in legal-action and organizational-coherence tests.

Exit condition: the first offseason can complete draft and roster completion without revealing true talent or creating illegal rosters.

### Slice 7 — League Loop Lab and hardening

Connect all phases, add checkpoint imports/exports, ten-season batch runs, performance/memory/file-size budgets, and failure fixtures. Build the player-facing shell around stable commands and projections.

Exit condition: the replacement gate in Section 14 is met.

## 7. Minimum lab sets at each product gate

### Before building the player-facing league shell

Required:

- Population & Roster Lab with accepted generation and roster bands.
- Game & Matchup Lab with single-game reconciliation and deterministic fixture import.
- Production & Value Lab with a basic 82-game runner contract and sample-size behavior.
- LeagueDocument extension for teams, roster references, rotation, game records, and phase checkpoints.
- Shared calibration infrastructure and worker progress/error handling.

Not required yet: contract market, full career cohorts, draft, rich scouting, staff employment market, owner job-security complexity, advanced CBA, or multi-year AI.

The shell can be thin and developer-oriented at this point. It should not promise a playable offseason before the later gates.

### Before a complete regular season

Required:

- Population & Roster Lab.
- Game & Matchup Lab.
- Season Production & Value Lab, including team totals, player game logs, standings inputs, and availability.
- Schedule, standings, playoff eligibility, and basic season lifecycle transitions.
- Manual or generated staff fixtures with bounded coach/assistant effects.
- JSON checkpoint round-trip and worker recovery.

### Before a complete offseason

Required:

- Everything above.
- Basic annual development, aging, injuries/recovery, and retirement.
- Contract terms and rules legality/affordability.
- Re-signing and simple three-stage free agency.
- Draft class, scouting ranges, rookie contracts, and baseline picks.
- Roster completion and historical/event persistence.
- Baseline AI legal-action behavior.

### Before the final League Loop Lab is meaningful

Every phase must have a production command or automatic task, a serializable state, an invariant set, an event family, and a user-facing or developer-facing failure reason. A loop harness that skips draft, market, or annual transitions is only a smoke test, not a complete league loop.

## 8. Shared calibration infrastructure

### Recommended home

Create `packages/calibration` now, but keep it a toolkit rather than a second domain package. Suggested shape:

```text
packages/calibration/
  src/
    runner.ts          batch execution, progress, cancellation
    fixtures.ts        scenario envelopes and failed-seed bundles
    metrics.ts         distributions, percentiles, correlations, outliers
    benchmarks.ts      accepted ranges and pass/fail results
    reports.ts         JSON report serialization and downloadable artifacts
    adapters.ts        lab-to-production input/output adapters
  tests/
```

Canonical scenario entity types belong in `packages/domain-v2`. Canonical JSON validation, versioning, and migrations belong in `packages/league-schema`. Calibration-only benchmark reports, fixture bundles, and metric structures belong in `packages/calibration`. React form state, route search params, and display-only table models stay in `apps/web-v2`.

### Build once and reuse

- **Seed controls:** seed, mode, scope, config version, and source fixture ID.
- **Random separation:** deterministic lab sources versus entropy-backed normal runtime sources; never store lab randomness as gameplay behavior.
- **Fixture envelopes:** schema, version, kind, source document/config versions, seed, inputs, expected invariants, and optional expected outputs.
- **Batch controls:** run count, concurrency, progress, cancellation, retry policy, and time budget.
- **Metrics:** means, standard deviation, percentiles, histograms, quantiles, correlations, rate denominators, and confidence/sample-size labels.
- **Comparison:** baseline versus candidate config, paired seed comparisons, matched-cohort comparisons, and regression deltas.
- **Outliers:** preserve the full input, seed, settings, state diff, diagnostics, and result summary.
- **Reports:** JSON first, human-readable summary second; reports should be downloadable from the lab but not imported as gameplay state.
- **Benchmarks:** accepted ranges are versioned by model/config version; distinguish hard invariants from calibration targets.
- **Execution:** use the same worker command boundary as gameplay where possible. Long batch work must support cancellation and leave the last completed report/fixture intact.
- **Performance:** record wall time, worker time, peak memory where available, result size, and serialized save size.

## 9. Visual-lab versus automated-test matrix

| System/behavior | Interactive inspection | Automated assertion/batch |
|---|---|---|
| Player profile and hidden diagnostics | Unusual player, role, physical coherence | Bounds, deterministic replay, distributions, correlation, tail rates |
| Population membership | Inspect a selected universe | Every player belongs exactly once; counts/statuses match |
| Roster assembly | Compare team rosters and outliers | Legal size, position coverage, unique IDs, deterministic assembly |
| Rotation | Change starters/depth/minutes and compare | Eligible positions, minute totals, availability, no duplicate players |
| Game outcome | Inspect selected matchups and unusual box scores | Reconciliation, legal stat ranges, repeated-game benchmarks, failed seeds |
| Staff effects | Compare matched coach profiles | Effect bounds, no talent inversion beyond accepted variance |
| Production | Inspect player/team breakdowns | Aggregation, sample-size behavior, league distribution ranges |
| Universal value | Compare similar players and feature contributions | Stability, monotonicity where required, no master-number reuse |
| Development/career | Inspect cohort trajectories | Cohort rates, aging curves, injury/retirement ranges, inflation control |
| Contract offer | Change offer terms and context | Utility ordering, continuity, separate legality and affordability |
| Market | Replay a market collapse or bidding war | Legal unique signings, payroll reconciliation, supply/demand behavior |
| Finance | Inspect one transaction and cap consequences | Salary bounds, cap/tax accounting, dead money, options, roster legality |
| Draft/scouting | Compare ranges, board, and pick rationale | Scouting error, hidden truth, pick legality, outcome distributions |
| AI decisions | Inspect candidate shortlist and explanation | Legal actions, bounded uncertainty, organizational coherence |
| Lifecycle | Stop/resume at checkpoints | Valid transitions, no skipped tasks, round-trip save, event consistency |

Every accepted calibration finding should become one of:

1. a domain invariant test if it must always be true;
2. a benchmark profile if it is a distributional target;
3. a golden fixture if it reproduces a valuable edge case;
4. a developer diagnostic if it is useful for investigation but not a product guarantee.

Do not turn a single attractive seed into a permanent realism assertion without a distributional rationale.

## 10. Scenario and JSON fixture strategy

### 10.1 Canonical document first

`LeagueDocument` is the portable source of truth for a full league. Once the universe is connected, it should contain normalized teams, roster references, players, contracts, staff, rules/settings, state, events, projections, and optional compact game data. The current foundation document is intentionally incomplete; it should be extended through schema versions rather than replaced by lab-specific snapshots.

### 10.2 Typed fixture kinds

Use a versioned envelope for non-league scenarios:

```text
ScenarioEnvelope<T>
  schema: "foh-scenario"
  version: number
  kind: "player-population" | "initial-universe" | "matchup" |
        "season" | "career-cohort" | "contract-offer" |
        "market" | "draft" | "league-loop"
  source: { configVersion, generatorVersion, documentId? }
  seed: string
  input: T
  expected?: { invariants, benchmarkProfileId? }
```

Recommended fixture rules:

- A **matchup fixture** may be a full-document reference plus two team IDs for local runs, or a self-contained normalized two-team subset for portable debugging. It must include player profiles, availability, rotation, staff profiles, rules/config, and the fixture seed.
- A **season fixture** references a validated league document/checkpoint and a schedule/config, not a copy of the game engine’s private state.
- A **contract-market fixture** contains the participating teams, players, contracts/payroll, rules profile, offer set, and market seed.
- A **career cohort fixture** contains an explicit player cohort and annual transition config, never a React form state dump.
- A **lab report** contains inputs and results but is not itself a valid league save.

Avoid two incompatible formats for the same facts. If an exported universe is later embedded in a league document, preserve its source metadata and IDs; do not translate it through a lossy UI report.

### 10.3 Import/export flow

```text
LeagueDocument JSON
  -> validate/migrate in league-schema
  -> create lab adapter input
  -> run production sim module
  -> return report + optional derived fixture
  -> promote accepted facts into LeagueDocument through a command
```

The lab may export diagnostics and hidden truth. Normal gameplay imports only canonical documents and user-safe projections. Import previews should identify schema version, source config, seed/mode, fixture kind, and whether hidden diagnostics are present.

## 11. Product settings boundary

### Product-safe advanced settings

Expose concepts users can understand and that have validated bounds:

- draft-class strength and variance;
- star frequency;
- initial age range;
- development volatility and late-bloomer frequency;
- injury frequency/severity/recovery;
- pace and offensive environment;
- market volatility and contract continuity;
- salary-cap level, growth, and tax pressure.

Each setting needs a default, allowed range, description, preset, and config version. Settings are resolved at league creation and recorded in the document.

### Developer calibration settings

Keep role weights, possession allocation, effect-size caps, random variance, cohort tags, benchmark thresholds, intermediate scoring components, and exact contract utilities in developer-only config/report views. They can be selected by a lab profile but are not normal league-creation controls.

### Never expose directly

Do not expose raw coefficients, random stream names, latent talent, true potential, exact AI scores, internal utility weights, or engine-specific correction factors. If a user-facing concept matters, expose the concept through a bounded preset or higher-level control.

## 12. Production promotion rules

An output becomes an authoritative production module only when:

- it has an explicit domain type and version;
- the normal game can call the same function used by the lab;
- inputs and outputs are serializable;
- hard invariants are tested;
- distributional benchmarks are accepted for the target config;
- diagnostics can be removed without changing the authoritative result;
- the module has a failure contract and does not depend on React or a report format.

The following remain developer-only unless promoted by these rules:

- latent talent and true potential diagnostics;
- assembly shortlist/noise;
- possession/intermediate game components;
- exact value/contract utility feature weights;
- scouting truth and error traces;
- cohort labels and counterfactual results;
- AI candidate score internals;
- performance/memory/debug traces.

## 13. Risks and guardrails

### Risk: overbuilding developer labs

Twelve routes can become a second product with duplicated state, UI-only assumptions, and no production value. Guardrails are one route per evidence workflow, headless batch as the default for population questions, and promotion rules that require the game to call the same module.

### Risk: connecting systems too early

An unstable game engine can make production, value, contracts, and AI appear to work while hiding upstream stat errors. Guardrails are staged contracts, reconciliation invariants, accepted benchmark ranges, and fixture-based isolation before full league integration.

### Risk: current ability becomes universal truth

The average skill summary is useful for generation diagnostics and initial assembly. Every downstream system must consume either skills, a role-fit evaluator, production, or an explicitly named value projection.

### Risk: deterministic lab behavior leaks into normal play

`RandomMode` and random-source injection must remain explicit. A lab seed reproduces a fixture; normal leagues receive fresh entropy and save completed outcomes as facts.

### Risk: reports become alternate saves

Reports and diagnostics are evidence. Only validated commands may promote authoritative facts into `LeagueDocument`.

### Risk: advanced CBA becomes a prerequisite

Keep the first rules profile intentionally small. Rule legality must be explicit and tested, but realism does not require implementing every NBA exception before a season loop exists.

## 14. League Loop requirements and v1 removal gate

The final League Loop Lab must prove:

1. complete 30-team league generation and team selection;
2. legal rosters, contracts, staff, and initial draft assets;
3. user rotation and bounded staff effects;
4. regular-season schedule, games, injuries, box scores, standings, and production;
5. playoffs and season archives;
6. annual development, aging, recovery, and retirement;
7. owner goals and basic evaluation;
8. re-signing, simple contract market, cap/tax accounting, and roster completion;
9. draft, scouting ranges, rookie contracts, and baseline AI selections;
10. season two startup with historical consistency;
11. checkpoint save/reload and full JSON import/export at major phases;
12. deterministic reproduction of retained lab fixtures and explainable failures;
13. worker responsiveness, memory, runtime, and save-size budgets;
14. ten-season batch survival across representative seeds.

V2 should not replace V1 when it merely has a pretty league shell or a successful single season. The removal gate is reached only when the V2 loop has completed at least ten seasons in batch runs, passes schema/entity/accounting/lifecycle invariants, preserves JSON facts across reload/import/export, produces accepted game/player/development/injury/salary distributions, supports required user decisions without manual repair, and explains blocked actions and major outcomes. V1 remains runnable until this gate is met.

## 15. Immediate next implementation slice

Build the first Game & Matchup Lab slice, but keep the work scoped to contracts and calibration:

1. Add a versioned matchup fixture adapter that consumes an `InitialPlayerUniverse` or a canonical `LeagueDocument` subset.
2. Define rotation, availability, coaching-profile, `GameResult`, team box-score, player box-score, and reconciliation types in the production domain boundary.
3. Implement the headless single-game runner and deterministic replay test.
4. Add hard invariants for minutes, player uniqueness, available-player usage, team/player stat reconciliation, and result serialization.
5. Add the batch runner with progress, cancellation, metrics, and failed-seed retention through `packages/calibration`.
6. Add the visual two-team inspector only after the runner and fixture contract exist.

This slice establishes the production contracts needed by Season Production & Value and avoids building a game-specific prototype that must later be replaced by the league loop.
