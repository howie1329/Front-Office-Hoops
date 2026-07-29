# Front Office Hoops v2 Simulation Architecture

## Architecture decision

V2 is a client-first TanStack Start application with no gameplay backend. TanStack Start owns the browser application shell. The simulation engine is pure TypeScript and runs in a Web Worker. IndexedDB/Dexie stores completed snapshots locally. JSON is the portable league contract.

```text
TanStack Start UI
  ├── sends LeagueCommand to simulation worker
  ├── renders read-only LeagueView
  └── persists returned snapshot through Dexie adapter

Simulation worker
  ├── owns active in-memory LeagueDocument
  ├── validates commands and phase gates
  ├── runs simulation and market logic
  ├── emits LeagueEvent[] and diagnostics
  └── returns a new snapshot after each completed command/day
```

The worker is an execution boundary, not a second source of truth. The canonical state is the v2 league document; React state is a view and Dexie is storage.

## Package boundaries

```text
apps/web                 current v1 application; remains runnable
apps/web-v2              v2 TanStack Start application
packages/shared          safe UI/general primitives only
packages/domain-v2       canonical entities, commands, events, projections
packages/league-schema   JSON schema, validation, migrations, export profiles
packages/sim-v2          game, season, player, market, lifecycle simulation
packages/calibration     seeded labs, benchmark profiles, batch reports
packages/story-packets   factual narrative inputs for a later release
packages/ui              shadcn/ui primitives and accessible controls
packages/db              v1 adapter plus v2 Dexie document repository
```

V2 must not import v1 `LeagueRecord`, v1 valuation functions, v1 phase gates, or v1 game/stat-allocation logic. Safe early sharing is limited to UI primitives, generic formatting, serialization, and utilities after contract tests. A future shared primitive may be extracted only when it has no v1 domain assumptions.

The [lab strategy](../plans/foh-v2-lab-strategy.md) is authoritative for calibration surface boundaries. Visual labs are scenario inspectors over production modules; batch calibration, distribution sweeps, finance rules, career cohorts, and AI policy checks should run headlessly. A lab report or diagnostic fixture is never a second simulation truth.

The current branch is still at the foundation boundary: `LeaguePhase` is `"foundation"`, `SimulationConfig` contains only a preset ID and version, and `LeagueCommand` supports `NoOp` plus a deliberately rejected `AdvanceDay`. The architecture below describes the target contracts, not features that are already implemented.

## Worker protocol

```ts
type WorkerRequest = {
  requestId: string
  command: LeagueCommand
  league: LeagueDocument
}

type WorkerResult = {
  requestId: string
  status: "completed" | "rejected" | "failed"
  league?: LeagueDocument
  events: LeagueEvent[]
  diagnostics: DiagnosticEntry[]
  progress?: { completed: number; total?: number; label: string }
  reason?: ValidationIssue
}
```

The first implementation may keep the active document in the worker and send only view updates, but every command must be valid if evaluated from a serialized document. A crash or reload must be recoverable from the last committed snapshot.

## Randomness model

Normal gameplay follows the Basketball GM-like model chosen during discovery:

- Each new league receives fresh runtime randomness.
- Games, injuries, negotiations, and development are not predetermined solely by a visible league seed.
- Completed outcomes become saved facts.
- A rerun from an earlier checkpoint may produce a different outcome in normal mode.
- Labs and regression fixtures use explicit deterministic seeds.
- Debug mode may preserve RNG scopes and checkpoints for exact replay.

The simulation APIs should receive a random source explicitly rather than call global randomness from domain code. The source can be:

```ts
type RandomSource = {
  next(): number
  int(min: number, max: number): number
  normal(mean: number, deviation: number): number
  fork(scope: string): RandomSource
}
```

`RandomSource` supports both normal entropy-backed runs and deterministic lab runs without making normal leagues repeatable from a user-visible seed.

Calibration runs use a versioned scenario envelope containing a fixture kind, source/config versions, seed, input, and optional expected invariants. Full leagues use `LeagueDocument`; matchup, season, career, market, draft, and loop fixtures are typed scenario inputs validated through `league-schema`. Calibration reports live in `packages/calibration` and are not importable as gameplay state.

## Domain model

Separate authoritative entities from derived projections:

```text
LeagueDocument
├── metadata, rules, settings, randomMode
├── state: season, phase, calendar, userTeamId
├── teams, players, staff, owners
├── contracts, draftAssets, offers, injuries
├── projections: standings, payroll, scouting, player values
├── events[]                         authoritative history
├── seasonArchives[]                 immutable summaries
└── optionalData/                    games, diagnostics, story packets
```

Entities are normalized by stable ID. Derived views can be rebuilt from authoritative records and events. A command reads a document, validates preconditions, produces a new document, and returns events and diagnostics. It never imports React, Dexie, or browser APIs.

## Simulation configuration

```ts
type SimulationConfig = {
  presetId: string
  version: number
  game: GameConfig
  playerGeneration: PlayerGenerationConfig
  development: DevelopmentConfig
  injuries: InjuryConfig
  retirement: RetirementConfig
  economy: EconomyConfig
  tradeMarket: TradeMarketConfig
  rules: LeagueRulesConfig
}
```

Every setting has a typed bound, default, description, and preset. Users see standard settings plus an advanced league-creation panel. The UI should expose grouped concepts, not raw coefficients. Examples include `marketVolatility`, `draftClassVariance`, `developmentVolatility`, `injuryFrequency`, and `tradeAggressiveness`.

Initial standard preset:

- Fixed 30-team NBA-shaped structure.
- 82 games and fixed playoff/lottery format.
- Soft cap plus luxury tax.
- Modern-balanced game environment.
- Correlated latent player generation.
- Moderate development and injury volatility.
- Three-stage free agency.
- Baseline AI teams.

Candidate alternative presets include high offense, defense-heavy, fast pace, historic low pace, stable development, volatile development, low injury, high injury, and high market volatility.

## Lifecycle orchestration

Use a calendar-driven finite-state workflow with two product-level gates and explicit subphases:

```text
IN-SEASON
  preseason
  ownerGoals
  regularSeason
  tradeDeadline
  playoffs
  seasonEvaluation

OFFSEASON
  contractDecisions
  staff
  reSigning
  lotteryAndDraft
  freeAgencyStage1
  freeAgencyStage2
  freeAgencyStage3
  rosterCompletion
  preseasonSetup
```

The transition table is authoritative. Each phase exposes required user tasks, automatic AI tasks, deadlines, and completion conditions. A phase cannot advance when the user’s team lacks a legal roster, required staff, valid contracts, or a draft selection that must be made.

The owner-goal phase occurs between the offseason and preseason. Each owner assigns one easy, one medium, and one hard goal. Failing all three goals produces one job-security strike; three strikes terminate the user.

Simulation controls are command variants such as:

- `SimulateToNextGame`.
- `SimulateToDate`.
- `SimulateToDeadline`.
- `SimulateToPlayoffs`.
- `SimulateToOffseason`.
- `StartDraft`.
- `SimulateToNextPick`.
- `SimulateToUserPick`.
- `SimulateToDraftEnd`.

`Advance` is a planner that executes eligible automatic work and reports a stop reason. It does not own every offseason subsystem.

## Commands and events

Commands are small and replayable at the document boundary:

```text
SetRotation
SetTeamPlan
SimulateToNextGame
SimulateToDate
OfferContract
ResolveContractStage
ProposeTrade
AcceptTrade
HireStaff
ReleasePlayer
ScoutProspect
StartDraft
MakeDraftPick
CompleteOwnerGoals
AdvancePhase
```

Each authoritative change emits an event:

```ts
type LeagueEvent = {
  id: string
  type: LeagueEventType
  season: number
  phase: string
  leagueDay: number
  entityRefs: EntityRef[]
  payload: Record<string, unknown>
  summary: string
  importance: "routine" | "notable" | "major"
  storyTags: string[]
  source: { kind: "command" | "simulation" | "migration"; id: string }
}
```

Required event families include games, injuries, trades, signings, releases, extensions, draft selections, development, awards, records, coaching changes, owner goals, strikes, playoff eliminations, championships, and rule/configuration changes.

## Player generation

The generator creates players before assigning archetypes:

1. Generate physical profile, age, background, durability, and latent talent factors.
2. Generate correlated skill clusters: creation, shooting, finishing, passing, rebounding, perimeter defense, interior defense, decision-making, athleticism, and stamina.
3. Generate permanent personality traits, no more than approximately three.
4. Generate development trajectory, peak range, volatility, and injury susceptibility.
5. Derive one primary position and optional secondary position.
6. Derive one primary archetype and optional secondary archetype from the completed profile.
7. Produce scouting estimates from team-specific noise.

Archetype quotas do not fill rosters. Class-level strength and positional supply shift latent distributions. The generator must support stars, starters, role specialists, busts, sleepers, late bloomers, generational prospects, and unusual profiles.

## Ratings and scouting

Use one user-facing general overall derived from skills. Individual skills remain visible for known players. League percentile and rank are derived from overall. Role-fit evaluations are separate internal calculations.

Traits are permanent, mostly visible, capped at approximately three, and have uncertain effect strength. Traits affect behavior and outcomes rather than directly adding rating points.

Players have primary and optional secondary positions. Rotation validation rejects out-of-position assignments.

The head scout changes only fog-of-war precision in the first release. Poor scouting creates wider, less accurate ranges; strong scouting creates narrower, more accurate ranges. There are no reports, interviews, or year-round scouting workflows initially.

## Game simulation

V2 should retain a seeded/calibratable possession model but not preserve v1’s aggregate assumptions. The engine should model:

- possessions from pace, opponent, fatigue, and context;
- lineup and role opportunity;
- shot creation, shot quality, turnovers, fouls, offensive rebounds, and transition;
- head-coach offensive/defensive philosophy and pace;
- assistant-coach alignment modifiers;
- player outcomes with exact team/player reconciliation;
- runtime variance controlled by configuration.

The first user experience is final box scores only. No play-by-play or live coaching. Every completed game is retained as a compact box-score record and emits game/injury/milestone events.

## Rotations

The user controls:

- Starting five.
- Bench/depth order.
- Target minutes.

The coach controls rotation tendency. The simulation handles foul trouble, injuries, overtime, and minute normalization. Players cannot be assigned outside primary or secondary positions. If a valid lineup cannot be formed, simulation stops with an actionable roster gate.

## Development, aging, injuries, and retirement

Model skill trajectories rather than broad overall deltas. Distinguish:

- true trajectory: simulation state;
- development forecast: internal probabilistic estimate;
- scouting estimate: user-facing range;
- realized production: observed output.

Development responds to age, skill headroom, minutes, coaching, staff, health, and randomness. Athletic skills can decline earlier; shooting, passing, and recognition can improve later. Injuries affect availability and can alter future trajectories, but should not simply subtract overall.

Traits remain permanent in v2. Morale, role promises, playing-time security, and trait evolution are deferred.

## Player value

Use one visible universal player value plus explicit context modifiers:

```text
Universal player value
  = current ability
  + simple recent production
  + age/trajectory
  + potential/upside
  + durability
  + bounded scarcity context

Trade value
  = player value
  + contract adjustment
  + simple team-fit adjustment
```

The base value is not a raw sum. It is a small weighted model with a structured breakdown. Production is a role-adjusted, multi-season box-score composite using scoring/efficiency, assists/turnovers, rebounding, steals/blocks, games/minutes, and basic role context. Player value is visible; exact contract utility may be hidden unless an advanced setting exposes it.

For a free agent, current contract liability is zero. That does not make player value zero; it makes the contract adjustment neutral or positive depending on the offer.

## Contracts and free agency

The first contract model uses a configurable soft cap plus luxury tax. Cap amount, tax line, salary minimum/maximum, and annual growth are settings. Aprons, sign-and-trades, complex exceptions, role guarantees, and playing-time security are deferred.

Contract demand can consider player value, recent production, age, projection, durability, previous salary, comparables, market supply/demand, cap room, and broad player preferences such as money, market size, winning organization, loyalty, and recent team success.

Free agency has three fixed stages:

```text
Stage 1: AI offers → user sees offers → user submits offers → player accepts or waits
Stage 2: AI offers → user sees offers → user submits offers → player accepts or waits
Stage 3: AI offers → user sees offers → user submits offers → player accepts or market closes
```

The player uses an internal contract utility. In the first release, the best contract value generally wins; richer preference behavior can expand later. The UI shows terms and labels such as “strong interest” or “competitive offer,” not the exact score. An advanced setting may reveal exact utility for analysis.

## Cap and rules profiles

V2 begins with one default model: soft cap plus luxury tax. Keep the rules data-driven so future profiles can add:

- Simple soft cap.
- Standard selected exceptions and options.
- Advanced apron-inspired restrictions.

Every transaction returns rule decisions, rejected reasons, and cap/tax consequences. Do not implement advanced CBA behavior until the baseline economy is calibrated.

## Draft and baseline AI

The draft is one day with two rounds and fixed lottery behavior. The user can start it, simulate to the next pick, simulate to their next pick, or simulate to the end. Manual selections are available at user picks. Simulated user picks select the next best available player.

AI teams use best available prospect as the baseline with small team-need, team-mode, scouting, mock-draft, and rookie-contract adjustments. They do not yet have persistent multi-year organization plans. Multi-year rebuilding, contender windows, ownership constraints, and organizational memory are later roadmap work.

## Owners and staff

Owners set three season goals and influence spending, patience, market expectations, and job security. They do not approve or veto ordinary transactions.

Head coach controls tactical identity. Offensive and defensive assistants provide small alignment effects. The head scout controls scouting precision. Staff hiring, contracts, and development effects are required in the first playable v2 but remain bounded and explainable.

## Testing and calibration

`packages/calibration` should provide shared batch runners and report infrastructure for the smaller lab surfaces: Population & Roster, Game & Matchup, Production & Value, Career Cohorts, Market & Rules, Draft & Decision, and League Loop. Development, injury, retirement, finance, owner/staff effects, and baseline AI are modes or headless harnesses within those surfaces rather than separate visual products.

Normal games use fresh runtime randomness. Lab runs use explicit seeds and produce reports containing means, standard deviations, percentiles, correlations, histograms, failed seeds, explanations, progress, cancellation state, and performance metrics. `sim-v2` must not import the calibration package.

Required invariant layers:

- unit correctness;
- entity/accounting invariants after every command;
- season integration;
- multi-season statistical calibration;
- JSON round-trip and migration fixtures;
- browser E2E for critical workflows;
- performance, memory, worker, and file-size budgets.

## Observability

Every command records request ID, phase, settings version, random mode/scope, input entity IDs, output events, major value factors, and validation diagnostics. Normal runs need not be perfectly replayable; developer runs must be replayable from explicit fixtures and seeds.
