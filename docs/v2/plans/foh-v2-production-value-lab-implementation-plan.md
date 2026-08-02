# V2 Production & Value Lab — Implementation Plan

**Status:** Implemented initial lab; calibration and promotion gates remain
**Last reviewed:** August 1, 2026
**Roadmap position:** Phase 2 calibration, Slice 2
**Depends on:** Initial Player Universe and the Game & Matchup production contract
**Primary surfaces:** `packages/domain-v2`, `packages/league-schema`, `packages/sim-v2`, `packages/calibration`, `apps/web-v2`

## Objective

Build a developer-facing Production & Value Lab that loads a deterministic player universe, creates a complete developer-season fixture, runs regular-season games through the existing Game & Matchup engine, aggregates player/team/league production, and calculates an explainable Universal Player Value.

The lab is the bridge between simulated games and the downstream systems that will consume player value. It must establish trustworthy production and value contracts before contracts, trades, draft decisions, AI roster behavior, awards, or the authoritative league shell depend on them.

The lab is not a second game simulator. The Game & Matchup engine remains the only authority for game outcomes. The season runner owns scheduling and orchestration; production owns aggregation; value owns the player-value calculation.

## Documentation and repository constraints

This plan follows:

- [V2 roadmap](./foh-v2-roadmap.md) as the authoritative sequence.
- [V2 lab strategy](./foh-v2-lab-strategy.md) for permanent lab boundaries and calibration rules.
- [V2 simulation architecture](../specs/foh-v2-simulation-architecture.md) for package boundaries, workers, randomness, and derived projections.
- [V2 data and export design](../specs/foh-v2-data-and-export-design.md) for snapshots, events, JSON, and persistence boundaries.
- [V2 UI information architecture](../specs/foh-v2-ui-information-architecture.md) for settings, tables, responsive behavior, and developer-lab expectations.
- [Game & Matchup Lab implementation plan](./foh-v2-game-matchup-lab-implementation-plan.md) for the existing game fixture/result contract and calibration style.
- [Archived experiment backlog](../archive/foh-v2-experiment-backlog.md), especially E4 and E5.

Required constraints:

- Work only in V2 surfaces. Keep V1 runnable and do not modify `apps/web`, `packages/sim`, or V1 domain contracts.
- Keep authoritative production modules pure and deterministic when given an explicit lab random source.
- Keep long-running browser work in a Web Worker.
- Keep `packages/calibration` dependent on production modules; `sim-v2` must not import calibration.
- Treat lab reports as evidence, not gameplay state or a second simulation truth.
- Use typed domain contracts and `league-schema` validation for fixtures, configs, results, reports, and imports.
- Preserve stable IDs, seeds, effective settings, failed fixtures, and reproducible checkpoints.
- Use semantic, bounded settings with standard presets and advanced UI controls. Do not expose raw formula coefficients.
- Use TanStack Table for data-heavy surfaces and preserve the V2 UI rules for focus, responsive tables, loading/error states, and keyboard access.

## Product decisions locked so far

### Lab boundary

The Production & Value Lab is a separate surface from the Game & Matchup Lab.

- Game & Matchup remains responsible for single games, matchup comparisons, lineups, coaching profiles, injuries, overtime, box scores, and reconciliation.
- Production & Value owns a season runner, production aggregation, value calculation, checkpoint inspection, and season-level reports.
- The season runner calls the Game & Matchup engine for each game. It does not duplicate possession, shot, minute, injury, or stat-allocation logic.

### Universe and population views

The lab loads an `InitialPlayerUniverse` or an equivalent validated developer fixture and provides population views for:

- Current players on teams.
- Free agents.
- Draft prospects.

Current team players receive production from the simulated season. Free agents and draft prospects do not play in that season and retain projection-based values with explicit confidence state.

### Season run

The first season runner uses a deterministic developer fixture with:

- 30 teams.
- 82 games per team, or 1,230 league games total.
- A balanced home/away schedule with deterministic opponent distribution.
- Generated default rotations, coaching profiles, and initial availability.
- Standard rare injury behavior, plus a no-injury comparison mode.
- Fixed player abilities for the duration of the run.
- No development, aging, retirement, playoff games, travel, fatigue careers, or detailed calendar rules in the first version.

The first-version run presets are:

1. **Smoke:** 10 games per team.
2. **Early Season:** 25 games per team.
3. **Half Season:** 41 games per team.
4. **Full Season:** 82 games per team.
5. **Batch:** repeated full-season runs over explicit seeds.

The run records snapshots at preseason, 10, 25, 41, and 82 games per team. It can run automatically to an endpoint or pause at checkpoints. A run can be reset and replayed from the same seed.

### Production

Production is based on reconciled regular-season `GameResult` records and transparent derived metrics. The first version includes:

- Games and starts.
- Minutes and availability.
- Opportunities and usage.
- Points and scoring efficiency.
- Field-goal, three-point, and free-throw attempts and makes.
- Rim, midrange, and three-point shot mix.
- Assists and turnovers.
- Offensive and defensive rebounds.
- Steals, blocks, and fouls.
- Offensive and defensive role context.
- Team offense, defense, pace, efficiency, and standings inputs.
- League scoring, pace, efficiency, and shot-mix environment.

Production is role- and opportunity-aware. Team context is used to interpret and normalize production; it does not directly reward a player because their team wins. The first defensive model uses individual events, role, minutes, team defensive context, and lineup context. Full plus-minus, on/off analysis, and advanced defensive impact are deferred until the game engine exposes stable stint-level data.

Playoff production is intentionally excluded from the first core value model. A later extension may use postseason performance as a separate signal for awards, history, reputation, or optional context.

### Universal Player Value

Universal Player Value is a player-centered, unbounded additive index over a three-season horizon.

It is:

- Higher for more valuable players under the same simulation rules and evaluation configuration.
- Independent of which other players happen to exist in the league.
- Not a 0–100 rating.
- Not defined relative to a dynamic replacement-level player.
- Not defined by league-relative scarcity or current rankings.
- Additive as a baseline for comparing player packages.
- Deterministic for the same player facts, configuration, and evaluation point.

Zero is a mathematical origin only; it does not mean replacement-level contribution. Percentiles and ranks are reporting views, not inputs to the core value.

The value has two internal time scales:

- A fast current-form signal that responds to recent production.
- A slower three-season projection that reflects current ability, age, trajectory, upside, durability, and accumulated production.

The model must allow meaningful hot and cold streaks to affect value without letting a tiny sample completely rewrite the three-season projection. Sample size and confidence explain how much evidence supports the current value; they do not erase real performance.

The initial value breakdown includes:

- Current ability baseline.
- Recent/current-form production.
- Three-season projected contribution.
- Age and trajectory.
- Potential and upside.
- Durability and expected availability.
- Role and normalized team context.
- Confidence and sample state.

Contract quality, team fit, timeline, roster needs, draft-pick value, and market context are separate downstream modifiers. A player’s salary must not change their Universal Player Value.

### Settings

All gameplay-relevant production and value behavior is controlled by a versioned, serializable configuration.

The UI provides:

- A standard preset with calibrated defaults.
- A custom mode with bounded advanced settings.
- Descriptions, ranges, steps, reset behavior, and resolved effective values.

Semantic settings may include:

- Current-form responsiveness.
- Production sample-confidence behavior.
- Projection horizon, with the standard set to three seasons.
- Current-ability emphasis.
- Recent-production emphasis.
- Age/trajectory emphasis.
- Upside emphasis.
- Durability and availability impact.
- Offensive/defensive production emphasis.
- Team-context normalization strength.
- Injury frequency and injury toggle.

Raw weights, random draws, internal coefficients, benchmark thresholds, and debug traces remain lab-only diagnostics. Every run/report retains the effective settings and seed.

## Current repository state

The current V2 implementation already provides:

- Deterministic player generation and population presets.
- A 30-team `InitialPlayerUniverse` with 450 rostered players, 100 free agents, and 90 draft prospects.
- Deterministic roster assembly and population validation.
- Typed `GameMatchupFixture`, `GameResult`, player/team box scores, injuries, overtime, and reconciliation.
- A Game & Matchup Lab route, worker, fixture export, and repeated-matchup calibration report.
- A small `packages/calibration` package with seeded batch reports and benchmark profiles.
- A foundation `LeagueDocument` and validated local repository boundary.

Before this implementation slice, the V2 implementation did not provide:

- A complete 30-team season schedule.
- A season runner that invokes the game engine across a league.
- Default rotations/coaching/availability for every season fixture.
- Season player/team production aggregation.
- Universal Player Value calculation or value snapshots.
- A Production & Value Lab route or worker.
- Season checkpoints, standings output, or league-environment reports.
- A working lifecycle `AdvanceDay`; it remains intentionally rejected at the foundation boundary.

The first implementation slice now provides the season fixture, deterministic
schedule, worker-backed season runner, production aggregation, checkpointed
Universal Player Value, strict season/report schemas, batch execution, and a
developer route with current-player, free-agent, and draft-class views. The
remaining promotion work is calibration depth, true pause/resume semantics,
broader season benchmark reporting, and acceptance review before these outputs
are consumed by contracts, trades, or the authoritative league shell.

## Target architecture

```text
InitialPlayerUniverse / imported season fixture
                    |
                    v
        deterministic season fixture adapter
          schedule + rotations + coaches
                    |
                    v
          Season Runner in sim-v2
             calls simulateGameMatchup
                    |
                    v
       GameResult[] + injury/availability facts
                    |
                    v
         Production Aggregator in sim-v2
       player + team + league production
                    |
                    v
       Universal Player Value calculator
        current form + 3-season projection
                    |
                    v
        checkpoint snapshots + reports
                    |
                    v
        Production & Value Lab UI/worker
```

### Package responsibilities

#### `packages/domain-v2`

Own typed contracts for:

- Season run presets and semantic configuration.
- Season fixtures and schedule entries.
- Default rotation/coaching/availability inputs.
- Season run progress and checkpoints.
- Player game logs and season production records.
- Team production and league environment records.
- Universal Player Value, breakdown, confidence, and sample-state records.
- Production/value lab report envelopes.

Prefer focused files such as `seasonProduction.ts` and `playerValue.ts` over adding more untyped fields to `JsonRecord`. Re-export public types from `src/index.ts`.

#### `packages/league-schema`

Add strict schemas and versioned JSON boundaries for:

- Season configurations and presets.
- Season fixtures and schedule entries.
- Production records.
- Value records and breakdowns.
- Checkpoint snapshots.
- Production/value lab reports.

Validate stable references, unique game IDs, team game counts, player-team membership, population/status consistency, enum values, numeric bounds, and report version compatibility.

#### `packages/sim-v2`

Own pure production modules:

- Balanced deterministic 30-team schedule generation.
- Developer season fixture generation from `InitialPlayerUniverse`.
- Default rotation/coaching/availability generation.
- Season run orchestration.
- Injury and availability state updates from `GameResult` events.
- Player/team/league production aggregation.
- Context normalization.
- Universal Player Value calculation.
- Checkpoint creation and deterministic replay support.

The season runner should call the existing `simulateGameMatchup` function. It should not import React, workers, Dexie, or calibration.

#### `packages/calibration`

Own headless batch behavior:

- Repeated full-season runs.
- No-injury versus standard-injury comparisons.
- 10/25/41/82 checkpoint reports.
- Production distribution summaries.
- Value stability and rank-change summaries.
- Hot/cold sample sensitivity.
- Retained failed seeds and complete season fixtures.
- Accepted-range benchmark profiles.

Calibration target ranges must remain separate from production configuration.

#### `apps/web-v2`

Own the developer adapter, worker, and route:

- `src/lib/productionValueLab.ts` for fixture creation, run state, report serialization, and UI adapters.
- `src/lib/productionValueWorker.ts` for long season/batch runs.
- `src/routes/developer-labs.production-value.tsx` for the visual lab.
- Developer-lab index and generated route tree updates through the normal route workflow.

The UI must not implement production or value formulas. It only normalizes controls, calls typed production APIs, renders reports, and presents diagnostics.

## Domain contracts

The exact field names may be refined during implementation, but the boundaries below are required.

### `SeasonProductionConfig`

```ts
type SeasonProductionConfig = {
  version: number
  presetId: "standard" | "custom"
  runPreset: "smoke" | "early" | "half" | "full" | "batch"
  gamesPerTeam: number
  gameSettings: {
    version: number
    config: GameSimulationConfig
    seed: string
  }
  schedule: {
    teamCount: number
    homeAwayBalanced: boolean
    scheduleSeed: string
  }
  injuries: {
    mode: "standard" | "off"
  }
  development: {
    enabled: false
  }
  playoffs: {
    enabled: false
  }
  value: UniversalPlayerValueConfig
}
```

`gameSettings` is the shared, versioned contract for the effective game
simulation and rotation settings used by the season. It includes the game
configuration (including rotation settings) and the seed needed to reproduce a
custom run. Preserve it wherever `SeasonProductionConfig` is stored, including
`SeasonFixture.config` and `ProductionValueLabReport.effectiveConfig`.

The standard preset uses 30 teams, 82 games per team, deterministic balanced scheduling, standard injuries, fixed abilities, no playoffs, and a three-season value horizon.

### `UniversalPlayerValueConfig`

```ts
type UniversalPlayerValueConfig = {
  version: number
  horizonSeasons: number
  currentFormResponsiveness: number
  sampleConfidence: number
  currentAbilityEmphasis: number
  productionEmphasis: number
  trajectoryEmphasis: number
  upsideEmphasis: number
  durabilityImpact: number
  defenseEmphasis: number
  teamContextNormalization: number
}
```

The domain-owned benchmark field uses a neutral summary contract rather than a
calibration-package type:

```ts
type SeasonBenchmarkSummary = {
  profileId: string
  label: string
  passed: boolean
  checks: Record<
    string,
    {
      metric: string
      actual: { count: number; mean: number; minimum: number; maximum: number }
      target: { min: number; max: number }
      passed: boolean
    }
  >
}
```

The public configuration uses semantic descriptions and bounded values. It must not expose the raw formula or allow contradictory configurations that bypass validation.

### `SeasonFixture`

```ts
type SeasonFixture = {
  version: number
  source: {
    kind: "initial-player-universe" | "league-document" | "manual"
    id: string
    version: number
  }
  seed: string
  season: number
  teams: Record<string, { id: string; name: string }>
  players: Record<string, PlayerEntity>
  populations: {
    rostered: string[]
    freeAgents: string[]
    draftProspects: string[]
  }
  schedule: SeasonScheduleEntry[]
  rotations: Record<string, GameRotationInput>
  coaching: Record<string, GameCoachingProfile>
  availability: Record<string, PlayerAvailability>
  config: SeasonProductionConfig
}
```

The fixture is self-contained enough to reproduce a run and preserves the source universe ID/version.

### Production records

`PlayerSeasonProduction` should contain both totals and rates, including games, starts, minutes, opportunities, usage, scoring, shooting, shot mix, playmaking, turnovers, rebounding, defense, fouls, availability, role, sample state, and context diagnostics.

`TeamSeasonProduction` should contain games, wins/losses, points, possessions, pace, offensive/defensive efficiency, shooting, shot mix, rebounds, assists, turnovers, injuries, and strength-of-schedule diagnostics.

`LeagueProductionSummary` should contain league pace, scoring, efficiency, shot mix, statistical distributions, and reconciliation/failure counts.

### Universal Player Value

```ts
type UniversalPlayerValue = {
  playerId: string
  evaluationPoint: "preseason" | "checkpoint" | "final"
  checkpointGamesPerTeam: number
  rawValue: number
  currentFormSignal: number
  projectionSignal: number
  confidence: "provisional" | "early" | "established" | "full"
  sample: {
    games: number
    minutes: number
    seasons: number
  }
  breakdown: {
    currentAbility: number
    recentProduction: number
    projectedContribution: number
    ageTrajectory: number
    upside: number
    durability: number
    roleContext: number
    defensiveContribution: number
  }
  diagnostics?: {
    percentile: number
    rank: number
    outlierFlags: string[]
  }
}
```

Percentile/rank/diagnostic fields must not feed back into `rawValue`.

### Lab report

```ts
type ProductionValueLabReport = {
  schema: "foh-production-value-lab"
  version: number
  baseSeed: string
  source: SeasonFixture["source"]
  effectiveConfig: SeasonProductionConfig
  checkpoints: SeasonCheckpointReport[]
  games: GameResult[]
  playerProduction: Record<string, PlayerSeasonProduction[]>
  teamProduction: Record<string, TeamSeasonProduction[]>
  leagueSummary: LeagueProductionSummary[]
  values: Record<string, UniversalPlayerValue[]>
  failures: SeasonRunFailure[]
  benchmark: SeasonBenchmarkSummary | null
}
```

The report is downloadable evidence. It is not directly importable as authoritative gameplay state.

## Implementation phases

### Phase 0 — Baseline and contract freeze

**Targets:** plan/docs, V2 package baseline

- Create a dedicated implementation branch using the repository `codex/` convention.
- Confirm the focused V2 baseline and record unrelated existing failures separately.
- Keep the current Game & Matchup Lab behavior intact.
- Add this plan to the V2 documentation index.
- Confirm the current GameResult fields are sufficient for the first production metrics.

**Exit:** the scope, package boundaries, settings rule, report boundary, and first-version non-goals are recorded; no V1 surface is changed.

### Phase 1 — Domain and schema contracts

**Targets:** `packages/domain-v2`, `packages/league-schema`

- Add season fixture, schedule, config, checkpoint, production, value, and report types.
- Add standard preset and setting descriptors with bounds, steps, labels, and explanations.
- Add schemas for all persisted/exported season and value artifacts.
- Extend the domain exports without changing the foundation `LeagueDocument` phase contract prematurely.
- Add malformed fixture, invalid bounds, report version, and JSON round-trip tests.

**Exit:** a valid season fixture, production result, value result, checkpoint, and report serialize and validate without untyped casts in the production path.

### Phase 2 — Developer season fixture and schedule

**Targets:** `packages/sim-v2`

- Convert a validated `InitialPlayerUniverse` into a self-contained season fixture.
- Generate deterministic 30-team names/refs and stable team order.
- Generate an 82-games-per-team balanced home/away schedule.
- Enforce schedule invariants: every team has 82 games in full mode, every game has two distinct teams, home/away counts are bounded, and every game ID is unique.
- Generate default rotations using the same role/position rules as Game & Matchup.
- Generate default coaching profiles and initial availability.
- Keep free agents and draft prospects in the fixture population maps but out of the active schedule.
- Add standard-injury and no-injury fixture modes.

**Exit:** the same universe and season seed produce the same fixture, schedule, rotations, coaching, and starting availability.

### Phase 3 — Season runner

**Targets:** `packages/sim-v2`

- Iterate the schedule in deterministic order.
- Build a `GameMatchupFixture` for each scheduled game.
- Call the existing `simulateGameMatchup` function.
- Append each `GameResult` without rewriting its stats.
- Apply injury events to the season availability map.
- Preserve fixed player abilities during the run.
- Track games played per team and stop at the selected checkpoint when every team has reached the target count.
- Produce progress, cancellation checkpoints, and structured failure records.
- Recompute production/value after each completed game while retaining the main checkpoint snapshots.
- Produce team records, standings inputs, and league environment metrics.

**Exit:** a deterministic 10/25/41/82-game-per-team run completes through the existing game engine, produces 1,230 games in full mode, and never applies development or playoff transitions.

### Phase 4 — Production aggregation

**Targets:** `packages/sim-v2`

- Aggregate player game logs from `GameResult.players`.
- Reconcile player totals to team totals at every game and season checkpoint.
- Calculate transparent totals and rates for scoring, shooting, shot mix, usage, opportunity, playmaking, turnovers, rebounding, defense, fouls, minutes, games, starts, and availability.
- Track role and team context from the game fixture and result.
- Calculate team offense/defense, pace, efficiency, standings inputs, and strength-of-schedule diagnostics.
- Calculate league distributions and environment summaries.
- Mark sample state as provisional, early, established, or full.
- Keep free-agent and draft-prospect production empty/projection-only without fabricating game logs.

**Exit:** production records reconcile exactly to the game records, retain sample/availability state, and expose enough information to explain a player’s value movement.

### Phase 5 — Universal Player Value

**Targets:** `packages/sim-v2`

- Implement a deterministic player-centered value calculator over the three-season horizon.
- Use current ability as the preseason projection anchor.
- Add role-adjusted recent production as evidence, with fast current-form response and slower projection response.
- Include age/trajectory, upside, durability, expected availability, offensive contribution, defensive contribution, and normalized team context.
- Do not use replacement-level baselines, league-relative scarcity, percentile/rank, contract quality, or team wins as direct core inputs.
- Keep the raw value unbounded and additive; do not min-max normalize it into 0–100.
- Produce a structured breakdown and confidence state.
- Produce provisional values for free agents, draft prospects, rookies, injured players, and small samples.
- Ensure the calculator is deterministic and independently testable.

**Exit:** the same player facts/configuration produce the same value; hot/cold production can move value; small samples do not erase the projection signal; contract changes do not change player value; role specialists remain visible.

### Phase 6 — Calibration and batch reports

**Targets:** `packages/calibration`

- Add a typed season batch runner around the `sim-v2` season runner.
- Add named run presets and repeated full-season modes.
- Add checkpoint reports at preseason, 10, 25, 41, and 82 games per team.
- Add standard-injury versus no-injury comparison reports.
- Add production distribution metrics for pace, scoring, efficiency, shot mix, minutes, usage, role production, rebounds, assists, turnovers, steals, blocks, fouls, and availability.
- Add value metrics for rank stability, top-player separation, role-specialist visibility, confidence progression, sample sensitivity, current-form response, and outlier retention.
- Keep accepted ranges separate from engine config.
- Retain complete failed seeds, season fixtures, effective config, and checkpoint state.
- Support progress, cancellation, performance metrics, and machine-readable pass/fail reports.

**Exit:** a standard full-season batch can produce reproducible reports and failed fixtures without mutating a `LeagueDocument`.

### Phase 7 — Web adapter and worker

**Targets:** `apps/web-v2/src/lib`, `apps/web-v2/src/workers`

- Add fixture creation/import/export helpers.
- Add run-state adapters for presets, checkpoints, pause/resume, reset, and rerun.
- Add a dedicated worker wrapper for full-season and batch runs.
- Report games completed, teams at checkpoint, current phase, injuries, production/value status, and cancellation state.
- Preserve the last completed checkpoint/result when a run fails or is cancelled.
- Serialize/download season fixtures and lab reports.
- Ensure the UI’s effective settings exactly match the worker request.

**Exit:** a browser run remains responsive through a full season and a batch, supports safe cancellation, and can reproduce a saved fixture/report.

### Phase 8 — Production & Value Lab route

**Target:** `apps/web-v2/src/routes/developer-labs.production-value.tsx`

Use the existing V2 developer-lab visual language: compact Inter typography, restrained monochrome surfaces, purposeful panels, dense tables, visible focus states, and diagnostics beside the evidence they explain.

#### Page header

- Breadcrumb and “Production & Value Lab” title.
- Developer-only status.
- Loaded universe/source/version.
- Base seed and effective configuration summary.
- Primary actions: load/generate universe, run, pause at checkpoint, reset, export report.

#### Fixture and run controls

- Universe import and deterministic generated-universe action.
- Standard/custom preset switch.
- Named run preset: Smoke, Early Season, Half Season, Full Season, Batch.
- Standard injuries/no-injury comparison toggle.
- Pause-at-checkpoint toggle.
- Seed input and reset-to-seed action.
- Bounded advanced settings grouped by production/value concept.
- Stale-result indicator when settings or fixture data change.

#### Population tabs

- **Current Players:** team filter, roster filter, player value, production, minutes, games, availability, confidence, and value delta.
- **Free Agents:** projection value, current ability, production sample state, durability, expected role, and confidence.
- **Draft Class:** projection value, current ability, upside, age, role, public profile, and confidence.

The current-player view supports team-to-team navigation and team/league summaries. Free agents and prospects remain projection-driven during the simulated season.

#### Checkpoint and trajectory view

- Preseason, 10, 25, 41, and 82 checkpoint selector.
- Player value delta from prior checkpoint.
- Current-form signal versus projection signal.
- Confidence/sample state.
- Selected-player production/value timeline.
- Explainable factor changes for hot/cold production, availability, role, and projection.

#### Team and league evidence

- Team standings and strength-of-schedule summary.
- Team offensive/defensive production.
- League pace, scoring, efficiency, and shot-mix environment.
- Production distributions and reconciliation status.
- Injury and availability summary.
- Full-season and batch benchmark status.

#### Selected-player detail

- Identity, team/status, age, position/archetype, and current ability.
- Games, minutes, role, opportunities, usage, scoring, efficiency, playmaking, rebounding, defense, fouls, and availability.
- Universal Player Value headline.
- Current-form signal, projection signal, confidence, and checkpoint history.
- Value breakdown with plain-language explanations.
- Contract quality is not shown as part of the core value; it can be linked later from market/contract surfaces.

#### Required UI states

- No universe loaded.
- Invalid universe/report import.
- No run yet.
- Dirty settings with stale result.
- Running with progress.
- Paused at checkpoint.
- Completed checkpoint/full season.
- Batch report completed.
- Cancelled with last committed checkpoint preserved.
- Failed with retained seed and exportable fixture.
- Empty population tabs where a fixture is malformed.
- Narrow viewport with scrollable tables and preserved primary actions.

**Exit:** a developer can load a universe, inspect all three populations, run a season, pause at checkpoints, compare value movement, understand why a value changed, rerun the same seed, and export the evidence without reading source code.

### Phase 9 — Acceptance, documentation, and promotion gate

- Run focused package tests, typechecks, lint, and web build.
- Run deterministic replay checks on retained season fixtures.
- Run standard full-season and no-injury comparisons.
- Run repeated full-season batches with representative seeds.
- Review production/value benchmark reports and retained outliers.
- Update the V2 roadmap and README status only after the acceptance ranges are agreed and passed.
- Do not promote Universal Player Value into contracts, trades, draft AI, or the authoritative league shell until the report and invariant gates pass.

## Settings exposure rules

The lab and future league-creation UI share the same semantic configuration contracts.

### Player-facing settings

Expose bounded controls for meaningful league customization, including:

- Injury frequency and injury mode.
- Current-form responsiveness.
- Production sample-confidence behavior.
- Projection horizon.
- Current ability, production, trajectory, upside, durability, and defense emphasis.
- Team-context normalization strength.
- Game environment and rotation settings inherited from the game configuration.

Each control needs a description, default, bounds, step, reset action, and indication of whether it affects future simulation only. Standard values must work without tuning.

### Developer-only controls

Keep the following in the lab/debug surface rather than normal gameplay settings:

- Explicit base seed and random scopes.
- Batch count and retained-failure behavior.
- Exact formula diagnostics.
- Intermediate possession/model components.
- Accepted benchmark profiles and thresholds.
- Raw percentile/rank diagnostics.
- Fixture source/version and report metadata.

## Invariants and test plan

### Domain and schema

- Season fixtures, production records, value records, checkpoints, and reports round-trip through JSON.
- Settings bounds, enums, and preset versions validate strictly.
- Every referenced player/team exists and has stable membership.
- Full schedule has exactly 82 games per team and unique game IDs.
- Every scheduled game has two distinct teams and valid home/away fields.
- Report source/config/seed metadata is complete.

### Season runner

- Same fixture/config/seed produces structurally identical results.
- Full run produces 1,230 games for 30 teams.
- Short presets stop at the correct games-per-team checkpoint.
- Abilities remain unchanged during the run.
- Development, aging, retirement, and playoffs do not execute.
- Standard injuries change availability and no-injury mode does not emit injury events.
- Free agents and draft prospects do not receive game logs.
- Cancellation preserves the last completed checkpoint.
- Replaying a retained fixture reproduces its result/failure.

### Production

- Player totals reconcile to every game and season team total.
- Team totals reconcile to league totals where applicable.
- Minutes, games, starts, usage, and availability remain legal.
- Unavailable players cannot record minutes or positive stats.
- Rates handle zero denominators explicitly.
- Sample states change at defined thresholds.
- Role and team context change interpretation without rewriting game facts.
- Regular-season-only production is enforced in the first version.

### Universal Player Value

- Same input facts/configuration produce the same value.
- Value is not capped at 100.
- Percentile/rank does not feed back into raw value.
- Replacement-level or current-league scarcity data is not required.
- Contract quality does not change core player value.
- Hot/cold production can move current-form value.
- Small samples retain lower confidence and projection influence.
- Availability changes expected contribution without directly subtracting skill ratings.
- Free agents/draft prospects receive provisional projection values.
- Role specialists and defensive contributors remain represented.
- Value breakdown totals reconcile to the configured calculation.

### Calibration

- Standard preset has explicit accepted ranges for game/season environment.
- Production distributions are reported by role and population.
- Values show reasonable top-player separation and specialist visibility.
- Current-form responsiveness is directionally correct.
- No-injury and standard-injury runs produce explainable availability/value differences.
- Batch reports include means, standard deviations, percentiles, correlations, confidence, outliers, failures, effective settings, and seeds.
- Failed seeds remain exportable and reproducible.

### UI and worker

- Settings update dirty state and never leave a result mislabeled as current.
- Run/pause/cancel/reset/export states are explicit.
- Worker progress remains responsive for full-season and batch runs.
- Last committed checkpoint survives cancellation/failure.
- Population tabs retain filters and selected-player context after checkpoints.
- Tables support typed columns, sorting, filtering, and keyboard-accessible row actions.
- Narrow layouts preserve primary actions and allow table scrolling.
- Status is not conveyed by color alone.
- Reduced-motion preferences are respected.

## Risks and mitigations

| Risk                                                    | Mitigation                                                                                                      |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Season runner accidentally becomes a second game engine | It only creates game fixtures and calls `simulateGameMatchup`; all game stats come from `GameResult`.           |
| 1,230 games freeze the browser                          | Run full seasons and batches in a worker with progress, cancellation, and checkpoint commits.                   |
| Production rewards opportunity rather than ability      | Use role, minutes, usage, efficiency, and team-context normalization.                                           |
| Defensive value is overstated from box-score events     | Expose defensive confidence and defer full on/off impact until stint data exists.                               |
| A short hot streak rewrites the projection              | Keep separate current-form and slower projection signals with sample confidence.                                |
| Value becomes league-relative or replacement-based      | Do not use dynamic replacement, scarcity, percentile, or rank as core inputs.                                   |
| Contract quality contaminates player value              | Keep contract adjustment in the future Market & Rules/Trade layers.                                             |
| Settings become a raw formula editor                    | Expose semantic bounded settings and keep coefficients/diagnostics developer-only.                              |
| Free agents or prospects receive fabricated production  | Keep their production absent and their value explicitly projection-based.                                       |
| Value reports diverge from future gameplay              | Share typed config, fixture, production, and value modules with the future league loop.                         |
| Full league-shell scope expands prematurely             | Keep the runner developer-fixture based; defer authoritative `LeagueDocument` embedding and lifecycle commands. |

## Verification commands

Run focused checks first, then the V2 workspace checks:

```bash
npm test --workspace=@workspace/domain-v2
npm test --workspace=@workspace/league-schema
npm test --workspace=@workspace/sim-v2
npm test --workspace=@workspace/calibration
npm test --workspace=web-v2

npm run typecheck --workspace=@workspace/domain-v2
npm run typecheck --workspace=@workspace/league-schema
npm run typecheck --workspace=@workspace/sim-v2
npm run typecheck --workspace=@workspace/calibration
npm run typecheck --workspace=web-v2

npm run lint --workspace=web-v2
npm run build --workspace=web-v2
npm test
```

Use the repository’s actual workspace runner if npm’s workspace selector differs in the current checkout. Run the existing sensitivity/baseline command when changing shared game sliders:

```bash
npm run sensitivity-baseline --workspace=@workspace/calibration
```

## Completion criteria

The Production & Value Lab is accepted when:

1. A deterministic `InitialPlayerUniverse` can produce a full 30-team, 82-games-per-team season through the existing Game & Matchup engine.
2. Short and full run presets produce correct checkpoints and can pause, cancel, reset, and replay.
3. Player/team/league production reconciles to the underlying `GameResult` records.
4. Standard injuries affect availability and value; no-injury comparison runs are available.
5. Player abilities remain fixed during the run.
6. Current players, free agents, and draft prospects have appropriate production/value states.
7. Universal Player Value is deterministic, unbounded, additive, player-centered, contract-neutral, and three-season oriented.
8. Current-form and projection signals explain value movement without suppressing meaningful performance.
9. All gameplay-relevant behavior is controlled by versioned, bounded, UI-exposed semantic settings.
10. The route displays population tabs, checkpoint trajectories, player breakdowns, team/league evidence, and actionable failures.
11. Full-season/batch reports retain effective settings, seeds, failures, and exportable fixtures.
12. Focused tests, typechecks, lint, and build pass for the changed V2 surfaces.

Only after these criteria pass should the outputs be promoted into the first in-season league slice and later consumed by Market & Rules, Trade Evaluation, Draft & Decision, awards, and AI policy modules.
