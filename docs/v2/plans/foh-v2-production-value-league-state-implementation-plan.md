# Front Office Hoops V2 — Production and Player Value in League State

**Status:** Planned
**Roadmap position:** Phase 4/5 integration; follows initial Game & Matchup, Production & Value, and league-lifecycle slices
**Depends on:**

- [Production & Value Lab implementation](./foh-v2-production-value-lab-implementation-plan.md)
- [Lifecycle and dashboard controls](./foh-v2-lifecycle-and-dashboard-controls-implementation-plan.md)
- [League lifecycle implementation](./foh-v2-league-lifecycle-implementation-plan.md)
- [Data and export design](../specs/foh-v2-data-and-export-design.md)
- [Calendar and season lifecycle](../specs/foh-v2-calendar-and-season-lifecycle.md)

## Objective

Promote the existing V2 production aggregation and Universal Player Value
modules into the authoritative `LeagueDocument` without creating a second
calculation path.

After this work, every completed simulation command will produce a complete,
validated, exportable league snapshot containing the current season's:

- completed games and compact team/player box scores;
- season-to-date player production;
- team production and standings inputs;
- league environment summary;
- Universal Player Value for every player, including rostered players, free
  agents, and draft prospects;
- sparse value milestones and the effective model configuration used to produce
  them.

The player screen will be able to show current production, historical season
totals, and per-game player logs by reading saved game records. Contracts,
trades, free agency, draft decisions, and roster tools will consume the saved
Universal Player Value rather than recalculating a competing value.

## Product decisions locked for this plan

### Persistence boundary

The user-facing simulation command is the persistence boundary:

- `AdvanceDay` saves the completed day.
- `SimulateToDate` saves when the target date is reached.
- `SimulateToDeadline`, `SimulateToRegularSeasonEnd`, and later phase commands
  save when their target is reached.

Long-running commands may emit and persist daily recovery checkpoints while the
worker is processing. The latest complete checkpoint is always exportable. A
failed or cancelled command must never replace the last valid committed
snapshot.

Production and value are updated before a completed snapshot is returned to the
repository. The exported league therefore never has newer games with stale
production or player values.

### Canonical facts versus derived projections

The authoritative facts are:

- player, team, contract, and rules entities;
- completed compact game records;
- events and phase transitions;
- season archives;
- the versioned effective configuration.

`projections.currentSeason` is persisted for fast reads and downstream gameplay,
but it is derived and rebuildable from those facts. On current-version import,
the repository validates or rebuilds projections rather than silently changing
simulation facts.

### Game and player history

Every completed game retains a final team box score and player box score. A
normal league save stores compact records only:

- date, season, phase, and schedule ID;
- home and away teams and winner;
- final team box scores;
- final player box scores;
- injury facts and reconciliation status.

Possession details, lineup segments, internal diagnostics, and debug traces are
not part of normal league history. They remain available to lab/debug exports
and failed-seed fixtures.

Current-season compact games remain in the current snapshot. At season close,
they move into the typed season archive with final production/value summaries.
Player-game-log selectors read current-season games plus archived games. There
is no second authoritative `playerGameLogs` copy.

### All-player value coverage

The league stores a Universal Player Value record for every player entity:

- rostered players receive current production-adjusted values;
- free agents receive projection-based values with explicit confidence;
- draft prospects receive projection/scouting-based values with explicit
  uncertainty.

The base Universal Player Value is separate from context-specific evaluations.
Trade value, contract value, team fit, roster need, and market demand are
calculated on demand from the base value and current context. They are not
persisted as permanent projections.

### Multi-season value history

The value calculator accepts prior season history now, even though the first
season has no prior history:

- Season 1 uses an empty history and current player facts.
- Later seasons consume archived production/value milestones.
- Prior seasons are never fabricated.
- Every archive retains the model version and effective settings that produced
  its values.

## Current implementation and gaps

The existing lab modules already provide the reusable calculation authority:

- `packages/sim-v2/src/production.ts` aggregates player, team, and league
  production from `GameResult[]`.
- `packages/sim-v2/src/playerValue.ts` calculates Universal Player Value for
  rostered, free-agent, and draft-prospect populations.
- `packages/sim-v2/src/seasonRunner.ts` produces checkpoint reports in the lab.
- `packages/sim-v2/src/lifecycle.ts` currently saves completed game records and
  standings, but does not promote production/value into `LeagueDocument`.
- `LeagueDocument.projections` currently contains standings and payroll only.
- `history.seasonArchives` and most entity fields are still generic records.
- `PlayerSeasonProduction` has one `teamId`; it does not yet represent
  midseason team splits.
- `optionalData.playerGameLogs` exists as a schema placeholder but is not
  populated. Nested player box scores in saved game records are the intended
  canonical source.

The first implementation should preserve the existing lab calculation modules
and add the missing league adapter, projection contract, compact history
contract, lifecycle promotion hook, and validation coverage.

## Target architecture

```text
LeagueDocument
  + current teams, players, rosters, rotations, availability, config
  + completed compact game records
  + prior season archives
             |
             v
createSeasonFixtureFromLeague()
             |
             v
aggregateSeasonProduction()
             |
             v
calculateUniversalPlayerValues(history)
             |
             v
rebuildCurrentSeasonProjections()
             |
             v
validate LeagueDocument
             |
             v
repository.save(completed snapshot)
```

The promotion function is pure and belongs in `packages/sim-v2`. The worker
orchestrates execution, the repository persists completed documents, and React
renders selectors. No UI route or worker may implement production or value
formulas.

## Authoritative data contracts

### Current season projection

Add a typed current-season projection to `LeagueDocument.projections`:

```ts
type CurrentSeasonProjection = {
  season: number
  throughDate: string
  gamesPerTeam: number
  playerProduction: Record<string, PlayerSeasonProduction>
  teamProduction: Record<string, TeamSeasonProduction>
  leagueSummary: LeagueProductionSummary
  playerValues: Record<string, UniversalPlayerValue>
  valueMilestones: Array<{
    gamesPerTeam: number
    throughDate: string
    playerValues: Record<string, UniversalPlayerValue>
  }>
  effectiveModelVersions: {
    game: number
    production: number
    value: number
  }
}
```

The exact field names may follow existing conventions, but the projection must
include the season, date, games-per-team count, all player values, production
maps, league summary, and model versions. A projection from another season
must never be mistaken for the current season.

### Player production team splits

Extend the production contract so a traded player has both total production
and team stints:

```ts
type PlayerSeasonProduction = {
  // existing player totals and rates
  playerId: string
  teamId: string | null
  teamSplits: Record<string, PlayerTeamSeasonSplit>
}

type PlayerTeamSeasonSplit = {
  teamId: string
  gamesScheduled: number
  gamesPlayed: number
  starts: number
  minutes: number
  points: number
  // remaining box-score totals and rates
}
```

The player total is the sum of all team splits. Each game uses the `teamId`
from that game's player box score, not the player's current roster status.
Universal Player Value uses the player's full-season total; team screens can
show the individual stints.

### Compact stored game record

Keep the internal `GameResult` contract for simulation and lab diagnostics.
Add or evolve a stored compact record for normal league history:

```ts
type StoredLeagueGameRecord = {
  scheduleId: string
  season: number
  date: string
  kind: LeagueGameKind
  homeTeamId: string
  awayTeamId: string
  winnerTeamId: string | null
  teams: Record<string, StoredTeamBoxScore>
  players: Record<string, StoredPlayerBoxScore>
  injuries: StoredGameInjury[]
  reconciliationPassed: boolean
}
```

The compact player box score must retain the fields needed for player logs,
season production, and the player screen. It must include minutes, starts,
points, shooting attempts/makes, shot mix, assists, turnovers, rebounds,
steals, blocks, fouls, role, and team ID. It must not include possession
traces, lineup segments, or internal diagnostics.

### Season archive

Replace the untyped archive payload with a typed archive contract:

```ts
type SeasonArchive = {
  season: number
  regularSeason: {
    games: StoredLeagueGameRecord[]
    playerProduction: Record<string, PlayerSeasonProduction>
    teamProduction: Record<string, TeamSeasonProduction>
    leagueSummary: LeagueProductionSummary
    playerValues: Record<string, UniversalPlayerValue>
    valueMilestones: CurrentSeasonProjection["valueMilestones"]
  }
  modelVersions: {
    game: number
    production: number
    value: number
  }
  completedAt: string
}
```

The archive is a history record, not a second live projection. Current-season
games and projections are moved into the archive exactly once when the season
closes. Stable IDs prevent duplicate archive entries after retries.

### Effective configuration and compatibility

Persist the exact resolved game, production, value, injury, and model-version
configuration under `settings.resolvedConfig`. Do not resolve a league against
the latest standard preset after it has been created.

This plan intentionally does not add a general migration chain. Unsupported
schema/rules/model versions are blocked:

- repository load/import returns a structured compatibility error;
- the original local save or imported file remains untouched;
- the UI tells the user to create a new league;
- no automatic upgrade, reroll, or silent value rewrite occurs.

Current-version round trips, validation, and exports remain required.

## Implementation sequence

### Phase 0 — Freeze the promotion contract

1. Add the typed current-season projection, archive, compact game, and team-split
   contracts to `packages/domain-v2`.
2. Reconcile the data/export documentation so nested player box scores are the
   canonical player-game-log source and `playerGameLogs` is not duplicated in
   normal saves.
3. Define the resolved model/config version fields.
4. Record the compatibility policy: unsupported versions are blocked and users
   start a new league.
5. Define the projection invariants before implementation.

**Exit criteria:** domain types describe current projections, compact history,
team splits, milestones, archives, and compatibility metadata without relying on
new `JsonRecord` fields.

### Phase 1 — Extend schema and repository boundaries

1. Extend `packages/league-schema` for current projections, compact game
   records, team splits, archives, and resolved model configuration.
2. Add bounds and reference checks for all player/team/game IDs.
3. Validate that every player has exactly one current value record.
4. Validate that rostered players have production records and that free agents
   and draft prospects have explicit zero-sample/projection states.
5. Validate team splits sum to player totals.
6. Validate current projection season/date/config matches the league snapshot.
7. Add unsupported-version rejection without migration or mutation.
8. Preserve transactional Dexie save/load/export behavior.

**Exit criteria:** a league with current projections, compact games, archives,
and model metadata round-trips through JSON and IndexedDB; incompatible files
are blocked with a structured reason.

### Phase 2 — Build the LeagueDocument-to-SeasonFixture adapter

Add a pure adapter in `packages/sim-v2`:

```ts
createSeasonFixtureFromLeague(league: LeagueDocument): SeasonFixture
```

The adapter must consume authoritative league data:

- current teams and roster references;
- all player entities and population/status membership;
- persisted rotations and coaching profiles when available;
- persisted injury/availability state;
- the league's resolved game/production/value configuration;
- the current season and league seed;
- current schedule information.

Use bounded defaults only for older current-version foundation documents that
still lack a newly introduced optional gameplay field. Do not create a second
league-specific production fixture format.

**Exit criteria:** the adapter produces a valid `SeasonFixture` for a generated
league and the same league/config/games produce deterministic aggregation input.

### Phase 3 — Implement centralized projection promotion

Add a pure function in `packages/sim-v2`, for example:

```ts
rebuildCurrentSeasonProjections(league: LeagueDocument): LeagueDocument
```

It must:

1. Validate the input document.
2. Build a `SeasonFixture` through the league adapter.
3. Read the current season's completed compact game records.
4. Convert stored box scores to the existing production input shape.
5. Aggregate player totals, team splits, team production, and league summary.
6. Calculate Universal Player Value for every player.
7. Pass prior season archives into the history-aware value interface.
8. Add sparse milestones when the season reaches configured checkpoints.
9. Update `projections.currentSeason` and `metadata.updatedAt`.
10. Validate the resulting document before returning it.

The function must not emit routine value-update events. Game, injury, and
lifecycle events remain the event history.

**Exit criteria:** creation and one completed game command produce valid current
production/value projections; repeated rebuilds produce the same result and do
not mutate the input snapshot.

### Phase 4 — Integrate promotion into command completion

Update the command pipeline so every successful gameplay command follows this
order:

```text
validate input
  -> process dates/games/events
  -> append compact game records
  -> update standings/injuries/calendar
  -> rebuild current production/value projections
  -> archive if a season closes
  -> validate complete document
  -> return completed snapshot
  -> repository.save(snapshot)
```

Apply this to `AdvanceDay` and the generic `SimulateToDate` path first. The same
promotion hook must be reusable by deadline, season-end, playoff, and offseason
commands later.

For long commands:

- process every intermediate calendar date;
- update the working snapshot after each date;
- emit progress and safe recovery checkpoints;
- return one final target snapshot as the command result;
- never teleport over games or events.

If a command is rejected, fails, or is cancelled before a completed checkpoint,
the last committed snapshot remains active.

**Exit criteria:** simulating a day, week/date range, deadline, or season end
leaves the saved league current for games, production, values, standings, and
events; reload/export sees the same complete snapshot.

### Phase 5 — Add multi-season archive rollover and trade splits

1. Add archive rollover at the season-close command boundary.
2. Move current-season compact games into the typed archive exactly once.
3. Persist final production/value and sparse value milestones in the archive.
4. Clear current-season game/projection containers for the new season.
5. Seed the next season with archived value history.
6. Extend aggregation to produce player totals plus team stints.
7. Verify a player traded midseason has correct pre-trade and post-trade splits.
8. Make player-game-log selectors read both current games and archives.

**Exit criteria:** a player page can show current and prior-season game logs,
season totals, value milestones, and team splits without duplicate storage or
manual data repair.

### Phase 6 — Make downstream systems consume the saved base value

Update authoritative gameplay adapters so they receive the persisted
`playerValues` map:

- Market & Rules uses it as the player-value input for demand and offer utility.
- Trade evaluation adds contract and team-fit modifiers on demand.
- Draft decisions consume the current prospect values plus scouting uncertainty.
- Roster and comparison screens use the same base value.
- Contract value and trade value are previews/results, not permanent projections.

The lab may continue to build isolated values for calibration fixtures, but no
authoritative league command may silently recalculate a competing base value.

**Exit criteria:** the same player has one visible Universal Player Value across
player, roster, market, trade, and draft contexts; context-specific modifiers
remain explainable and do not mutate the base value.

### Phase 7 — Add player-game-log selectors and screen integration

Add pure read selectors, preferably in a focused V2 query module rather than in
React routes:

```ts
getPlayerGameLog(league, playerId, season?)
getPlayerSeasonProduction(league, playerId, season?)
getPlayerValueHistory(league, playerId)
getPlayerTeamSplits(league, playerId, season?)
```

Selectors should:

- read current compact games and typed archives;
- resolve date, opponent, home/away, result, and team stint;
- return a compact, typed player-game-log row;
- preserve the selected season and filters;
- never calculate production/value formulas in the route.

The player/roster screen should use a compact default table with a detail view
for the full box score. The screen implementation should follow the companion
[team roster screen brief](../specs/foh-v2-team-roster-screen-brief.md) when that
surface is wired into the management shell.

**Exit criteria:** a user can open a player, select a season, inspect per-game
stats, see team splits, and compare the displayed season totals to the saved
production projection.

### Phase 8 — Export, performance, and hardening

1. Add full-league export coverage for current games, archived games, player
   logs, production, values, milestones, and model versions.
2. Add an operational export profile that can omit older game history while
   retaining the current snapshot and required entities.
3. Add player-career and team-history export selectors from the same canonical
   records.
4. Measure save size across one, five, and ten seasons.
5. Move large game sections into separate Dexie tables only if measurements
   require it; keep the document and repository APIs stable.
6. Add current-version import rebuild/validation reports.
7. Add worker recovery tests for interrupted multi-day and full-season commands.
8. Add browser coverage for save, reload, export, import, player-game-log
   viewing, and blocked unsupported versions.

**Exit criteria:** complete current-version exports import without data loss,
player history remains available, long simulations do not freeze the UI, and
unsupported saves are blocked without mutation.

## Invariants and acceptance tests

### Projection correctness

- Current projection season equals `state.season`.
- Current projection date equals the latest committed calendar date.
- Rebuilding from the same league facts/config produces identical production
  and values.
- Every player has exactly one Universal Player Value.
- Salary and contract terms do not change Universal Player Value.
- Free agents and draft prospects have explicit projection/confidence states.
- No percentile, rank, or diagnostic feeds back into `rawValue`.

### Production correctness

- Every stored completed game contributes exactly once.
- Player totals equal the sum of the player's stored game rows.
- Team splits equal the sum of the player's rows for each team.
- Team production reconciles to team box scores and standings inputs.
- League summary reconciles to all completed games.
- Traded players retain correct pre-trade and post-trade team splits.
- Compact records contain enough data to rebuild the player screen and
  production aggregates.

### Persistence correctness

- A completed command saves one valid snapshot at its target boundary.
- A failed/rejected command does not replace the last committed snapshot.
- Recovery checkpoints are themselves valid and exportable.
- Current projections are rebuilt or validated on current-version import.
- Season archives are created once and remain internally consistent.
- Full export/import preserves games, logs, production, values, and archives.
- Unsupported versions are blocked without modifying the original save.

### Downstream consistency

- Player, roster, market, trade, draft, and contract screens read the same base
  Universal Player Value.
- Context-specific evaluations are calculated on demand and explain their
  modifiers.
- Routine projection updates do not create value-change events.
- Game, injury, transaction, development, and lifecycle events remain stable
  and queryable.

## Test plan

### Domain and schema

- Round-trip current-season projection and typed archive fixtures.
- Validate all-player value coverage and population-specific confidence.
- Validate team-split totals and compact game references.
- Reject missing, stale, duplicate, or incompatible projections.
- Reject unsupported schema/rules/model versions without migration.

### Simulation and promotion

- League creation produces preseason production/value for all players.
- One `AdvanceDay` updates games, production, values, and standings together.
- A no-game date advances the calendar without corrupting projections.
- Multi-day target simulation promotes once per completed recovery checkpoint and
  returns the final target snapshot.
- Rebuild from saved compact games equals the committed projection.
- Same seed/config/doc produces deterministic lab results.
- A failed game leaves the previous saved snapshot unchanged.

### History and archives

- Player-game-log selectors return current-season rows.
- Archive rollover preserves every completed player's game row.
- A multi-team player has correct team splits and total production.
- Value milestones occur at most once per configured checkpoint.
- Season-two value calculation consumes season-one history.

### Web and repository

- Completed worker result is persisted before the UI updates its committed state.
- Export during a long simulation returns the last complete checkpoint.
- Player screen shows per-game stats, season totals, value history, and splits.
- Full and operational export profiles include/exclude the intended history.
- Unsupported saves show the blocked-state message and remain untouched.

## Explicit non-goals

This plan does not implement:

- play-by-play storage or replay;
- a second game simulator;
- advanced defensive impact, plus-minus, or on/off analysis;
- contract/trade formulas themselves;
- a full draft or market UI;
- generic schema migrations for old V2 model versions;
- cloud saves, accounts, or server-side persistence;
- broad unrelated refactors.

Tech-debt cleanup is allowed when it directly reduces duplication or typing risk
in the files touched by this plan. It should not become a prerequisite for the
promotion milestone.

## Completion gate

This plan is complete when:

1. A generated league has preseason production/value for all players.
2. Every successful simulation command saves compact games plus current
   production/value projections.
3. Player production supports total and team-split history.
4. Player-game-log selectors work for current and archived seasons.
5. Season archives preserve games, production, values, and model versions.
6. Downstream systems consume the persisted base value and derive context
   modifiers separately.
7. Full current-version export/import preserves all required facts.
8. Unsupported versions are blocked without changing the original save.
9. Focused V2 tests, typechecks, and web validation pass.

