# Front Office Hoops v2 Simulation Architecture

## Goals

The v2 engine must be deterministic under a seed and command stream, configurable through versioned presets, testable without a browser, explainable at event level, and able to simulate many seasons without making UI state or persistence the simulation's source of truth.

## Package boundaries

```text
apps/web                 v1 application; remains runnable
apps/web-v2              v2 application and information architecture
packages/shared          stable UI/general primitives only
packages/domain-v2       canonical entities, commands, events, projections
packages/league-schema    JSON schema, validators, migrations, export profiles
packages/sim-v2           game, season, player, market, and lifecycle simulation
packages/calibration      batch runners, benchmark profiles, reports
packages/story-packets    factual summaries for future narrative generation
packages/ui               visual primitives and accessible controls
packages/db               adapters; v1 and v2 document persistence
```

Initial v2 packages must not import v1 `LeagueRecord` or v1 valuation functions. Safe sharing is limited to tested generic primitives: deterministic RNG implementation after a compatibility contract, money formatting, date/ID utilities, and UI components. A future `sim-core` extraction is allowed only after golden tests prove that the primitive has no v1 domain assumptions.

## Domain model

Separate authoritative entities from derived projections:

```text
LeagueDocument
├── metadata, rules, determinism, currentState
├── teams, players, staff, contracts, draftAssets
├── transactions, offers, injuries, awards
├── events[]                         authoritative history
├── seasonArchives[]                 immutable summaries
├── projections/derived               standings, payroll, scouting views
└── optionalData/                    games, playByPlay, raw lab diagnostics
```

Entities are normalized by stable ID. A command reads a document, validates preconditions, produces a new document plus events and diagnostics, and never depends on React or IndexedDB.

## Simulation configuration

```ts
type SimulationConfig = {
  presetId: string
  version: number
  game: GameConfig
  playerGeneration: PlayerGenerationConfig
  development: DevelopmentConfig
  injuries: InjuryConfig
  economy: EconomyConfig
  rules: LeagueRulesConfig
  diagnostics: DiagnosticConfig
}
```

Each config has typed bounds, a documented default, a preset ID, and a version. Product sliders should change safe grouped variables such as pace, scoring environment, development volatility, injury frequency, and market volatility. Developer controls may expose lower-level parameters. League export includes the resolved config so a save can be reproduced.

Initial presets: `modern-balanced`, `high-offense`, `defense-heavy`, `fast-pace`, `historic-low-pace`, `stable-development`, `volatile-development`, `low-injury`, and `high-injury`.

## Lifecycle orchestration

Use a calendar-driven finite-state workflow with serializable tasks:

```text
preseason
  -> regularSeason (calendar days)
  -> tradeDeadline
  -> regularSeasonComplete
  -> playoffs
  -> awards
  -> offseason/contractOptions
  -> offseason/staff
  -> offseason/reSigning
  -> offseason/lotteryAndDraft
  -> offseason/freeAgency
  -> trainingCamp
  -> next preseason
```

The transition table is the authority. Each phase exposes user tasks, automatic league tasks, deadlines, and completion conditions. Parallel actions are represented as task status rather than hidden boolean gates. `AdvanceCalendar` should run only eligible automatic work and return the stop reason; it should not own every offseason subsystem.

Commands are small: `SetRotation`, `SimulateDay`, `OfferContract`, `ResolveOffer`, `ProposeTrade`, `AcceptTrade`, `ScoutProspect`, `MakeDraftPick`, `SetTeamPlan`, `ProcessOptions`, and `AdvancePhase`. A command result contains `nextDocument`, `events`, `diagnostics`, and `rejectedReason` when applicable.

## Event architecture

Every authoritative change emits an event:

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

Games, injuries, trades, signings, releases, extensions, draft selections, development changes, awards, records, coaching changes, role changes, milestones, playoff eliminations, championships, expansion, and rule changes need event types. Events power history, transactions, timelines, news, StoryPackets, exports, and debugging.

## Player generation

Use a hybrid latent model:

1. Generate physical profile, age, background, durability, and latent talent factors.
2. Generate correlated skill clusters: creation, shooting, finishing, passing, rebounding, perimeter defense, interior defense, decision-making, athleticism, and stamina.
3. Assign role/archetype as a probabilistic identity, not a fixed rating bucket.
4. Generate development trajectory, peak range, volatility, and injury susceptibility.
5. Produce public scouting reports from team-specific noisy observations.

Class-level strength changes the latent distribution and positional supply. Prospect outcomes include stars, starters, role specialists, busts, sleepers, late bloomers, and generational outliers. V2 must validate correlations, positional scarcity, class strength, and tails with generated-league reports.

## Game simulation

Retain the useful v1 idea of seeded possession simulation and separate game from season orchestration. Rework scoring so player and lineup roles participate in possession outcomes before team totals are allocated. A game should model:

- possessions from pace, opponent, fatigue, and context;
- lineup and role opportunity;
- shot creation, shot quality, turnovers, fouls, offensive rebounds, and transition;
- matchup and scheme effects;
- player outcomes with team totals reconciled as an invariant;
- variance controlled by config and seed.

Use a centralized `GameConfig` for pace, shot mix, efficiency, free throws, turnovers, rebounds, assists, steals, blocks, fouls, home court, overtime, and playoff effects. Validate team and player distributions separately. Do not add momentum or narrative modifiers until baseline calibration is stable.

## Development and aging

Model skill trajectories rather than overall deltas. Distinguish:

- true trajectory: simulation state;
- development forecast: probabilistic engine output;
- scouting estimate: evaluator-facing range;
- realized production: observed season evidence.

Growth depends on age, skill headroom, role/minutes, coaching, staff, training, health, decision quality, and random development events. Athletic traits decline earlier; shooting, passing, and recognition can improve later. Injury events may create missed time, altered skills, changed roles, or early retirement. High-floor/low-ceiling and high-risk/high-ceiling profiles should be generated deliberately.

## Player-value architecture

Do not return one `number` from a universal value function. Use explicit records:

```text
TrueTalentSnapshot       engine belief about ability
ScoutingReport           team/user belief with confidence and uncertainty
ProductionRésumé         multi-season observed output and context
Projection               future contribution over a defined horizon
Reputation               public/market perception
ContractMarketQuote      current clearing-market salary range
SurplusValue             projected contribution minus contract/risk
TeamFitAssessment        roster, timeline, strategy, and role value
```

These values influence each other through named inputs, not aliases. Production should update reputation and projection confidence without rewriting true talent. Team fit should affect trade and roster choices, not league-wide salary truth.

## Contract market

Run a market-clearing phase:

1. Build player market profiles from talent, production résumé, projection, reputation, age, health, prior salary, role, and career status.
2. Build team demand from cap room, exceptions, need, timeline, owner constraints, alternatives, and strategy.
3. Generate comparable-contract bands from recent signed deals in the same league economy.
4. Match players and teams over market days using preferences, security, role, winning, loyalty, and timing.
5. Emit a quote and explanation factors before signing.

Year-to-year salary movement should have a continuity prior. Exceed it only when explanation factors pass a threshold. Examples include injury, role loss, cap-room exhaustion, oversupply, a bidding war, contender discount, or retention rights.

## Cap and rules profiles

Implement rules as data-driven policies selected by `rules.presetId`. Simple handles cap/tax/min/max/rookie/Bird/basic matching. Standard adds selected exceptions/options/extensions/RFA/protected picks. Advanced adds aprons, detailed exceptions, sign-and-trades, and complex matching. Every transaction returns rule decisions and reasons for diagnostics.

## Team AI

An AI team is a persistent organization, not a stateless evaluator. Store a plan with competitive timeline, owner constraints, core players, positional needs, cap plan, draft strategy, risk tolerance, coach preferences, and multi-year goals. Daily decisions are scored against the plan and current state; plan changes are explicit events. Validate AI behavior over ten-year leagues for roster balance, cap coherence, draft accumulation, dynasty frequency, rebuild timing, and transaction explanations.

## Testing and calibration architecture

`packages/calibration` should provide seeded batch runners and reports for Game, Season, Career, Player Generation, Draft Class, Development, Injury, Contract Market, Trade Market, League Economy, and AI Team-Building labs. Reports include means, standard deviations, percentiles, correlations, histograms, and failure examples.

Required invariant layers:

- unit correctness;
- entity and accounting invariants after every command;
- season integration;
- multi-season statistical calibration;
- golden save and replay regression;
- browser E2E for critical workflows;
- performance, memory, and file-size budgets.

## Observability

Every command gets a deterministic ID and seed scope. Diagnostics record config version, RNG scope, input entity IDs, major model factors, and output. A developer can replay a command sequence from a golden league file and inspect why a game, contract, trade, or development event occurred.
