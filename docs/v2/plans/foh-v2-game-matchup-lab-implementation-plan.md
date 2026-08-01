# V2 Game & Matchup Lab — Implementation Plan

**Status:** Implemented initial slice; calibration acceptance pending
**Last reviewed:** August 1, 2026
**Roadmap position:** Phase 2, Slice 1

## Implementation note

The typed fixture/config/result boundary, deterministic possession engine, rotation and availability validation, seeded calibration batch runner, worker-backed lab, JSON import/export, and reconciliation evidence are implemented on this branch. The standard preset is an explicit NBA-like starting target, not yet an accepted calibration profile. Full benchmark modes, accepted-range comparisons, and final roadmap status remain follow-up work after calibration review.

## Objective

Build the first trustworthy V2 basketball simulation kernel and its developer-facing Game & Matchup Lab.

The engine will simulate one game from a typed two-team fixture using possession-based modeling. The standard preset will target NBA-like outcomes. Advanced settings will allow bounded user customization without exposing opaque formula coefficients. The lab will use the same simulation configuration as future gameplay, while adding deterministic seeds, fixture controls, repeated-game runs, and diagnostics.

The exit condition is one imported matchup fixture that can be rerun exactly, produces complete reconciled box scores, and clearly rejects invalid rotations or player availability.

## Product decisions carried into implementation

- Standard gameplay targets NBA-like pace, scoring, efficiency, stat distribution, and star impact.
- Star impact comes from opportunity, creation, usage, shot difficulty, efficiency, playmaking, and defensive influence; it is not an arbitrary points-per-game bonus.
- Position and archetype inform a player’s capabilities but do not hard-cap usage. A player such as a scoring lead guard can be a primary creator and high-volume scorer.
- Role is a flexible assignment derived from player capabilities, lineup context, teammates, coach preferences, and tendencies.
- The first engine is possession-based and does not store play-by-play.
- Rotations use five starters, bench depth order, and target minutes. Target minutes are goals; fouls, injuries, overtime, and other valid game events may change final minutes.
- Coaches affect pace, shot selection, defensive behavior, and rotation tendencies through bounded modifiers. Coaches do not overpower player talent.
- Injuries are initially rare, deterministic, and represented by game-count availability. A game injury may remove a player from the current game and assign a future `gamesRemaining` duration.
- Overtime is supported as a real additional possession segment, not a post-hoc score adjustment.
- All reproducible lab runs show their seed and effective settings.

## Scope

### In scope

- Typed game fixture, input, output, event, and diagnostic contracts.
- Bounded standard and advanced game simulation settings.
- Rotation validation and minute normalization.
- Flexible role/opportunity assignment.
- Possession generation and team/player stat production.
- Team and player box-score reconciliation.
- Availability and rare injury hooks.
- Overtime resolution.
- Seeded single-game runs and repeated matchup benchmarks.
- Failed-seed retention and JSON report export.
- A compact, diagnostic-first Game & Matchup Lab route in `apps/web-v2`.
- Focused unit, contract, and UI tests.

### Explicit non-goals

- Full league creation or authoritative embedding of the initial universe.
- Regular-season scheduling or 82-game lifecycle execution.
- Standings, playoffs, contracts, trades, free agency, draft, or offseason systems.
- Play-by-play storage or a live game-watch mode.
- Detailed injury recovery, medical systems, fatigue careers, or development transitions.
- Staff hiring or staff-market behavior.
- Full player-facing gameplay settings screens outside the developer lab.
- Reusing V1 simulation or stat-allocation logic.

## Architecture and package boundaries

Keep `sim-v2` pure and authoritative. Keep calibration orchestration in a separate package so the simulation engine never imports the calibration toolkit.

```text
packages/domain-v2
  canonical game contracts, config types, events, diagnostics

packages/league-schema
  Zod schemas, JSON validation, versioned fixture/report boundaries

packages/sim-v2
  rotation validation, opportunity model, possession engine,
  box-score aggregation, injuries, overtime, reconciliation

packages/calibration
  seeded batch runner, benchmark profiles, reports, failed fixtures

apps/web-v2
  Game & Matchup Lab route and view-state adapters

packages/ui
  existing accessible shadcn-style controls and data surfaces
```

The lab may call a pure single-game function directly for short interactive runs, but long repeated runs must execute through the worker boundary. The lab report is evidence, not a second simulation truth.

## Proposed contracts

Names may be refined during implementation, but the boundaries below are required.

### `GameSimulationConfig`

Use a versioned, serializable config with semantic bounded values. Keep exact formula coefficients private to the engine.

```ts
type GameSimulationConfig = {
  version: number
  presetId: "standard" | "custom"
  environment: {
    pace: number
    scoringEnvironment: number
    gameVariance: number
    talentSeparation: number
    homeCourtAdvantage: number
  }
  offense: {
    threePointRate: number
    rimRate: number
    midrangeRate: number
    shotSelectionDiscipline: number
    starUsage: number
    ballMovement: number
    isolationRate: number
    transitionRate: number
    offensiveRebounding: number
  }
  defense: {
    pressure: number
    helpDefense: number
    switching: number
    doubleTeamRate: number
    turnoverPressure: number
    foulDiscipline: number
  }
  rotation: {
    adherence: number
    benchUsage: number
    starterWorkload: number
    fatigueImpact: number
  }
  coaching: {
    influence: number
    paceInfluence: number
    shotSelectionInfluence: number
    defensiveInfluence: number
  }
  injuries: {
    frequency: "off" | "rare" | "normal" | "frequent"
    severity: "minor" | "mixed"
    maxGamesOut: number
    inGameInjuries: boolean
  }
  overtime: {
    enabled: boolean
    segmentMinutes: number
    maxSegments: number
  }
}
```

All numeric fields need explicit min/max/step metadata for the UI and schema. The standard preset is the only source of NBA-like defaults. Exact default numbers remain calibration outputs, not guessed product constants.

### Fixture inputs

```ts
type GameMatchupFixture = {
  version: number
  seed: string
  homeTeamId: string
  awayTeamId: string
  teams: Record<string, { id: string; name: string }>
  players: Record<string, PlayerEntity>
  rotations: Record<string, RotationInput>
  availability: Record<string, PlayerAvailability>
  coaching: Record<string, CoachingProfile>
  config: GameSimulationConfig
}

type RotationInput = {
  starters: string[]
  depthOrder: string[]
  targetMinutes: Record<string, number>
}

type PlayerAvailability = {
  available: boolean
  gamesRemaining: number
  restriction?: "none" | "minutes-limited"
  minutesLimit?: number
}

type CoachingProfile = {
  pace: number
  offensiveStyle: number
  defensivePressure: number
  shotSelection: number
  rotationDepth: number
}
```

The fixture must preserve the source universe/league identifier and version when it is adapted from a generated `InitialPlayerUniverse`. It must not invent an incompatible game-only player model.

### Results and diagnostics

```ts
type GameResult = {
  version: number
  seed: string
  status: "completed" | "rejected" | "failed"
  winnerTeamId: string | null
  periods: GamePeriodResult[]
  teams: Record<string, TeamBoxScore>
  players: Record<string, PlayerBoxScore>
  events: GameEvent[]
  diagnostics: GameDiagnostic[]
  reconciliation: ReconciliationReport
}
```

`TeamBoxScore` and `PlayerBoxScore` should include the first calibrated stat set: points, field goals, three-pointers, free throws, rebounds, assists, turnovers, steals, blocks, fouls, minutes, possessions/opportunities, and usage-related diagnostics where meaningful. The final product result must not require play-by-play to explain the box score.

Reconciliation must verify at minimum:

- Player points equal team points.
- Player makes and attempts equal team totals.
- Player free throws equal team totals.
- Player rebounds, assists, turnovers, steals, blocks, and fouls reconcile to team totals where the stat definition permits.
- Player minutes obey availability and rotation rules.
- No unavailable player records positive minutes or game stats.
- A completed game has a winner unless overtime is disabled and ties are explicitly allowed by the config.

## Implementation phases

### Phase 0 — Baseline

- Confirm the V2 package/test baseline is clean before feature changes.
- Record the implementation plan and linked V2 roadmap/lab-strategy constraints.
- Do not modify V1 surfaces.

**Exit:** baseline checks pass and all implementation files remain within the V2 packages and documentation directories.

### Phase 1 — Domain and schema contracts

**Targets:** `packages/domain-v2`, `packages/league-schema`

- Add game config, fixture, rotation, availability, coaching, result, box-score, event, diagnostic, and reconciliation types.
- Add standard preset metadata and bounded setting descriptors for the settings panel.
- Add Zod schemas for fixtures, configs, results, and calibration report payloads where persisted/exported.
- Extend `SimulationConfig` in a backward-compatible way so a future `LeagueDocument` can carry the resolved game config without forcing the full league shell now.
- Add schema/version tests, malformed fixture tests, and JSON round-trip tests.

**Exit:** a valid fixture/config/result can be serialized and validated without `JsonRecord` casts in the game path.

### Phase 2 — Rotation, availability, and opportunity model

**Targets:** `packages/sim-v2`

- Validate exactly two teams, legal player references, five starters per available team, unique depth order, target-minute bounds, and position eligibility.
- Normalize target minutes to the regulation minute budget while preserving the user’s intended hierarchy.
- Apply availability restrictions before rotation assignment.
- Build flexible player opportunity roles from capabilities, tendencies, lineup context, coach profile, and teammate fit.
- Keep positions/archetypes as inputs to capability matching, never hard usage caps.
- Ensure high-creation/high-scoring players can become primary creators regardless of traditional position labels.

**Exit:** valid rotations produce legal normalized plans; invalid rotations and unavailable starters produce actionable diagnostics; role assignment is inspectable in tests.

### Phase 3 — Possession-based single-game engine

**Targets:** `packages/sim-v2`

- Generate a deterministic possession budget from baseline pace, coach pace, home court, and bounded game variance.
- Resolve possession outcomes from lineup opportunity, player skills, shot profile settings, offensive behavior, defensive pressure, and coaching modifiers.
- Allocate opportunities to players through the role/opportunity model rather than generating team totals and backfilling arbitrary player stats.
- Model star impact through greater creation/shot opportunities, conversion quality, playmaking, and defensive influence.
- Produce periods, team totals, player totals, game events, and developer diagnostics.
- Add real overtime segments using the same possession engine and resolve until a winner or configured maximum.
- Add rare deterministic in-game injury events; remove injured players from the current game and decrement future availability by game count.

**Exit:** seeded single-game runs are repeatable and produce complete box scores with no reconciliation failures.

### Phase 4 — Calibration toolkit and benchmark harness

**Targets:** new `packages/calibration`

- Add a small seeded batch runner that accepts a typed fixture factory and config.
- Add single-game, 100-game repeated matchup, lineup sweep, coaching matched-pair, availability/injury sweep, and distribution benchmark modes.
- Produce machine-readable reports with effective config, seed list, summary metrics, accepted ranges, pass/fail status, and retained failures.
- Keep target ranges separate from the engine and user config so calibration does not become hidden gameplay behavior.
- Add cancellation/progress support for browser worker execution.
- Retain complete failed-seed fixtures for reproduction.

Initial benchmark metrics:

- Pace and possessions
- Team and player scoring
- True shooting/field-goal/three-point/free-throw percentages
- Three-point, rim, and mid-range mix
- Rebounds, assists, turnovers, steals, blocks, and fouls
- Minutes and usage distribution
- Star concentration and top-player share
- Bench opportunity and production
- Home-court effect
- Talent-to-win and talent-to-production signal
- Variance across repeated games
- Injury frequency and duration
- Exact reconciliation pass rate

**Exit:** the standard preset has an explicit benchmark profile; failed seeds are reproducible; reports do not mutate `LeagueDocument`.

### Phase 5 — Game & Matchup Lab domain adapter

**Targets:** `apps/web-v2/src/lib/gameMatchupLab.ts`, worker integration as needed

- Create fixture helpers from the existing deterministic initial player universe/roster assembly output.
- Support imported matchup fixtures and a developer-generated two-team fixture.
- Normalize UI form values into `GameSimulationConfig` with schema validation.
- Support single-game and repeated-game run options.
- Serialize/download fixture and benchmark report JSON.
- Convert rejected/failed engine output into visible actionable diagnostics.
- Run long repeated jobs through the worker boundary with progress and cancellation.

**Exit:** the route can create or import a fixture, run it, reproduce it from the visible seed, and export the result/report.

### Phase 6 — Lab UI

**Target:** new `apps/web-v2/src/routes/developer-labs.game-matchup.tsx`; update the developer labs index and route tree through the normal generator/build flow.

Use the existing League Office Console design system and Impeccable product guidance: compact Inter typography, restrained monochrome surfaces, low-radius controls, dense tables, visible focus states, and diagnostics adjacent to the evidence they explain.

#### Layout

- Page header: breadcrumb, “Game & Matchup Lab,” developer-only status, fixture source, seed, and primary run/export actions.
- Two-column desktop layout: a sticky settings/fixture rail on the left and evidence workspace on the right.
- Responsive layout: settings collapse above the evidence; box-score tables remain horizontally scrollable; the score summary stays visible.
- Avoid a repeated card grid. Use a few purposeful panels with clear hierarchy and dense data surfaces.

#### Settings rail

- Fixture source and import/export controls.
- Home/away team selection.
- Starters, depth order, target minutes, and availability restrictions.
- Standard/Custom preset switch with “Reset to standard.”
- Collapsible groups for environment, offense, defense, rotation, coaching, injuries, and overtime.
- Every advanced value has a label, range, step, current value, and short explanation.
- Show a compact “effective settings” summary before a run.

#### Evidence workspace

- Scoreboard with team names, score, winner/status, periods, overtime count, seed, and run duration.
- Team summary: possessions, efficiency, shot mix, turnovers, rebounds, and fouls.
- Player box score table with starters/bench grouping, minutes, usage/opportunities, points, shooting, playmaking, rebounds, defense, and injury status.
- Role/opportunity inspector showing why high-usage players received creation opportunities without treating position/archetype as a hard cap.
- Reconciliation panel with pass/fail state and expandable checks.
- Events panel for injuries and other game events.
- Repeated-run report with distributions, matchup results, player averages, variance, and failed seeds.

#### Required states

- First visit: explain that the lab needs a fixture and seed; provide a standard generated fixture action.
- Dirty settings: show that the displayed result is stale until rerun.
- Running: preserve visible configuration, show progress for batches, and allow cancellation.
- Completed: show result, diagnostics, export actions, and exact seed/config summary.
- Rejected: show field-level or fixture-level reason with an actionable correction.
- Failed: preserve the last committed result, show the failed seed/diagnostic, and offer fixture export.
- Empty repeated report: explain that a batch has not been run yet.
- Narrow viewport: stack controls, preserve keyboard access, and allow table scroll without clipping actions.

**Exit:** a developer can understand the fixture, change settings, run a game, inspect why the result happened, reproduce it, and export evidence without reading source code.

### Phase 7 — Integration and calibration acceptance

- Add the Game & Matchup Lab entry to `developer-labs` with Planned → Active state.
- Run focused package tests, web-v2 tests, lint, typecheck, and build.
- Run deterministic rerun checks against retained fixtures.
- Calibrate the standard preset against the benchmark profile.
- Retain outlier fixtures instead of hiding failed seeds.
- Update `docs/v2/README.md` and the roadmap status only after the exit condition is actually met.

## Settings model and exposure rules

The user-facing settings panel and lab controls share the same semantic settings. The lab adds precision and diagnostics; it does not create a separate engine configuration.

### User-facing settings

- Preset: Standard / Custom.
- Environment: pace, scoring environment, game variance, talent separation, home court.
- Offense: three-point rate, rim rate, mid-range rate, shot-selection discipline, star usage, ball movement, isolation, transition, offensive rebounding.
- Defense: pressure, help defense, switching, double teams, turnover pressure, foul discipline.
- Rotation: adherence, bench usage, starter workload, fatigue impact.
- Coaching: overall influence, pace influence, shot-selection influence, defensive influence.
- Injuries: frequency, severity, maximum games out, in-game injury toggle.
- Overtime: enabled, segment length, maximum overtime segments.

### Lab-only controls

- Fixture source and fixture version.
- Seed.
- Single game vs repeated series/batch.
- Batch count.
- Manual starter/depth/minute edits.
- Manual player availability.
- Manual coach profiles.
- Failed-seed retention.
- Debug diagnostics and intermediate model outputs.
- Benchmark profile and accepted-range comparison.
- JSON fixture/result/report download.

Do not expose raw random draws, internal coefficients, or intermediate values as gameplay settings. They may be visible as diagnostics in the lab when they help explain an outcome.

## Test plan

### Domain/schema

- Valid fixture/config/result round trips through JSON.
- Invalid teams, missing players, duplicate starters, bad depth order, impossible minutes, and unavailable starters produce structured issues.
- Numeric setting bounds and enum values are enforced.
- Schema versions are explicit.

### Simulation

- Same seed and same fixture produce byte-equivalent or structurally equivalent results.
- Different seeds change stochastic outcomes without violating invariants.
- Player/team totals reconcile exactly.
- Minutes respect starters, depth, availability, fatigue, injuries, and overtime.
- Unavailable players never record minutes or stats.
- Star impact increases opportunity and production through explainable inputs, without a hard position-based scoring cap.
- Coach pace/offense/defense modifiers are bounded and directionally correct.
- Bench and role changes alter opportunity in the expected direction.
- Overtime uses additional possessions and never resolves a tie through an arbitrary score fudge.
- Injury events are deterministic, rare under the standard preset, and create game-count availability.

### Calibration

- Standard preset benchmark report is machine-readable and pass/fail.
- Repeated games show skill/role signal plus reasonable variance.
- Outliers retain their seed and fixture.
- Reports include sample size and effective settings.

### UI

- Settings update dirty state and never silently leave a result mislabeled as current.
- Invalid input is labeled and associated with the relevant control.
- Run, cancel, export, and reset actions have loading/disabled/error states.
- Keyboard focus and labels remain visible and correct.
- Tables are usable at desktop and narrow viewport widths.
- Diagnostics are understandable without requiring console access.

## Verification commands

Run the narrowest relevant checks first, then the full V2 checks:

```bash
npm run test --workspace=@workspace/domain-v2
npm run test --workspace=@workspace/league-schema
npm run test --workspace=@workspace/sim-v2
npm run test --workspace=web-v2
npm run typecheck --workspace=@workspace/domain-v2
npm run typecheck --workspace=@workspace/league-schema
npm run typecheck --workspace=@workspace/sim-v2
npm run typecheck --workspace=web-v2
npm run lint --workspace=web-v2
npm run build --workspace=web-v2
```

Use the repository’s actual workspace runner if a command differs from the installed package-manager configuration.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Player stats are arbitrary allocations from team totals | Generate player opportunities inside the possession loop and reconcile from those events/results. |
| Position/archetype suppresses stars who play unconventional roles | Treat them as capability inputs; derive flexible role assignments from lineup context. |
| Too many settings create contradictory basketball outcomes | Use semantic bounded controls, standard presets, validation, and calibration benchmarks. |
| Coaching sliders overpower talent | Cap coach modifiers and test matched teams with different profiles. |
| UI becomes a generic settings wall | Keep controls beside the evidence they affect and prioritize a compact fixture → run → inspect flow. |
| Batch runs freeze the browser | Use the worker for long jobs, progress reporting, cancellation, and last-result preservation. |
| Lab diverges from eventual gameplay | Share typed config/fixture/result contracts and keep the lab as an adapter over production modules. |
| V2 scope expands into the league shell | Enforce the explicit non-goals and require the single-game exit condition first. |

## Completion checklist

- [x] Implementation remains isolated from V1 surfaces.
- [x] Typed game contracts and schemas exist.
- [x] Standard preset is explicit and versioned.
- [x] Single-game engine passes deterministic and reconciliation tests.
- [x] Rotation, availability, role, coaching, overtime, and injury behavior are implemented and surfaced in the lab.
- [x] Calibration reports and failed-seed fixtures are exportable.
- [x] Game & Matchup Lab exposes shared settings plus lab-only controls.
- [x] Desktop and responsive layouts preserve readable evidence and usable controls.
- [x] Worker progress/cancellation protects the browser during batches.
- [x] Focused V2 tests and typechecks pass; web-v2 has two known pre-existing lint diagnostics in this branch.
- [x] Roadmap and README status identify implementation separately from calibration acceptance.
