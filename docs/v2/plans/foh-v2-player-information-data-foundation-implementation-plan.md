# Front Office Hoops V2 — Player Information Data Foundation

**Status:** Planned  
**Scope:** Canonical data, lifecycle, selectors, and tests required before building the Player Information UI.  
**Roadmap position:** Phase 4–6 data integration; UI follows in the Phase 7 management surface.  
**V1 scope:** None. Keep V1 unchanged.

## Objective

Prepare the authoritative V2 league document to support a complete player
information screen without putting statistics or simulation rules in React.

After this plan, a player-information selector must be able to return:

- identity, age, physical profile, positions, archetypes, traits, and skills;
- current overall rating and development state;
- current contract and Universal Player Value context;
- current rotation role and availability;
- current-season production;
- game-by-game history;
- season-by-season history with team splits;
- rating/development history;
- injury history; and
- player-specific league events.

The player screen will consume this view later. This plan does not create the
route, sheet button, chart, rating bars, tables, or other UI.

## Related contracts and implementation plans

- [V2 roadmap](./foh-v2-roadmap.md) — delivery order and phase boundaries.
- [Production and Player Value in League State](./foh-v2-production-value-league-state-implementation-plan.md) — parent plan for current production, saved games, values, and season archives.
- [Lifecycle and Dashboard Controls](./foh-v2-lifecycle-and-dashboard-controls-implementation-plan.md) — command and persistence boundary.
- [Data and Export Design](../specs/foh-v2-data-and-export-design.md) — canonical snapshot, event history, and export rules.
- [UI Information Architecture](../specs/foh-v2-ui-information-architecture.md) — reserves the Player Profile surface but is intentionally out of scope here.

## Current state and constraints

The current V2 model already contains the core player facts in
`packages/domain-v2/src/types.ts`:

- `PlayerEntity` contains identity, age, league status, physical profile,
  skills, role, traits, injury resistance, and development fields.
- `getPlayerCurrentAbility()` derives OVR as the average of the eight player
  skills.
- `GamePlayerBoxScore` contains the core per-game player statistics.
- `LeagueDocument.optionalData.games` stores completed games with nested player
  box scores.
- `LeagueDocument.projections.currentSeason` stores current-season production
  and player values.
- `packages/sim-v2/src/leagueSelectors.ts` already provides a starting seam for
  player game history, current production, current value, and availability.

The remaining gaps are historical and authoritative rather than cosmetic:

- `history.seasonArchives` is still generic and empty at league creation.
- `optionalData.playerGameLogs` is a schema placeholder and must not become a
  second source of truth.
- Current production is season-to-date only and does not yet provide durable
  multi-season player history.
- The career development engine is used by calibration flows, not yet by the
  authoritative league season transition.
- Current availability and injury events do not form a typed injury ledger.
- Current contract data remains mostly `JsonRecord` and needs a shared selector
  adapter for profile consumers.

## Locked data decisions

### Game logs use saved game records as the source of truth

Do not persist a duplicate player-game-log array in normal saves. A player game
row is derived from the stored game record's date, teams, result, and player
box score. The existing `optionalData.playerGameLogs` field remains unused in
normal saves unless a later performance measurement proves a denormalized index
is necessary.

### Current projections are rebuildable

`projections.currentSeason` is a fast-read projection. Completed games, events,
season archives, player entities, and effective model versions are the
authoritative facts. Projection rebuilding must not change saved simulation
facts.

### Historical records are typed

Do not add more player-history fields to `JsonRecord` when a stable product
contract is required. Add explicit domain types and matching Zod schemas.

### OVR history is a player-state history

Each season snapshot stores OVR and the underlying `PlayerSkills`, not just a
single OVR number. This supports the initial overall-rating graph and later
skill-specific graph selections without reconstructing old ratings from deltas.

### No unsupported statistics

The first player profile exposes statistics already produced by the simulator:
minutes, starts, points, rebounds, assists, steals, blocks, turnovers, fouls,
shooting makes/attempts, usage, shot profile, and role. Plus/minus, advanced
impact metrics, and on/off data remain out of scope until the game engine
produces them authoritatively.

## Target contracts

The exact field names should follow existing naming conventions, but the
implementation must provide equivalent typed contracts.

```ts
type PlayerGameLogEntry = {
  scheduleId: string
  season: number
  date: string
  kind: LeagueGameKind
  teamId: string
  opponentTeamId: string
  won: boolean
  boxScore: GamePlayerBoxScore
}

type PlayerRatingSnapshot = {
  season: number
  age: number
  overall: number
  skills: PlayerSkills
  phase: "growth" | "plateau" | "decline"
}

type PlayerInjuryHistoryEntry = {
  id: string
  playerId: string
  season: number
  startDate: string
  expectedReturnDate?: string
  returnDate?: string
  description: string
  gamesMissed: number
  sourceScheduleId?: string
}

type PlayerSeasonLog = {
  season: number
  playerId: string
  total: PlayerSeasonProduction
  teamSplits: Record<string, PlayerTeamSeasonSplit>
  rating: PlayerRatingSnapshot
}
```

Season archives must retain the completed game records, final production,
player values, rating snapshots, injury records, effective model versions, and
completion metadata for that season.

## Implementation sequence

### 1. Add domain and schema contracts

Update:

- `packages/domain-v2/src/types.ts`
- `packages/domain-v2/src/seasonProduction.ts`
- a new `packages/domain-v2/src/playerHistory.ts` if that keeps history types
  isolated;
- `packages/league-schema/src/schema.ts`;
- `packages/league-schema/src/index.ts` and validation exports as needed.

Implement:

- typed game-history, season-log, rating-snapshot, injury-history, and archive
  contracts;
- current-season projection metadata such as season and through-date;
- player production team splits for traded players;
- archive references and model-version fields;
- invariants for duplicate games, duplicate season archives, missing entity
  references, and mismatched seasons.

Keep additive fields optional when possible so existing V2 saves remain
loadable. If a required shape change cannot be backward-compatible, bump the
schema version and add a migration fixture before making the new field
required.

**Done when:** the domain types and schema can represent a complete player
history without `JsonRecord` casts, and valid existing foundation saves still
parse.

### 2. Promote and test player selectors

Update:

- `packages/sim-v2/src/leagueSelectors.ts`;
- `packages/sim-v2/src/index.ts`;
- add `packages/sim-v2/tests/leagueSelectors.test.ts`.

Implement selectors for:

- completed games for a player;
- opponent and win/loss derivation;
- season and competition filtering;
- current-season production and value;
- archived season logs;
- rating/development snapshots;
- injury history;
- current contract context;
- one composed player-information data view.

Selectors must sort deterministically by season/date/schedule ID and return
empty arrays or `null` for valid no-history states. They must never recalculate
simulation formulas.

**Done when:** a selector can produce a complete player-information data view
from a seeded league before any games, after completed games, and after an
archive exists.

### 3. Correct current-season production aggregation

Update:

- `packages/sim-v2/src/production.ts`;
- `packages/sim-v2/src/lifecycle.ts`;
- related production/value tests.

Implement:

- player team splits based on the `teamId` in each game box score;
- current-season totals and rates with season/through-date metadata;
- derived values required by season logs, including MPG, FG%, 3P%, FT%, and
  TS%;
- current-season value milestones without duplicating value calculations;
- filtering so only the active season contributes to the current projection.

The existing aggregation and Universal Player Value modules remain the only
calculation authority.

**Done when:** current-season production is accurate for players who remain on
one team and players with multiple team stints, and the projection rebuilds
from saved game records.

### 4. Add the typed injury ledger

Update:

- `packages/domain-v2/src/playerHistory.ts`;
- `packages/league-schema/src/schema.ts`;
- `packages/sim-v2/src/lifecycle.ts`;
- `packages/sim-v2/src/leagueSelectors.ts`;
- lifecycle and schema tests.

When an injury occurs, create a typed record with its start date, description,
expected return, and source game. When availability returns, finalize the
record with the actual return date and games missed. Keep current availability
state and injury history consistent.

**Done when:** the profile data view can show both current health and a stable
injury-history table without inferring history from generic event summaries.

### 5. Integrate season close, archives, and development

Update the existing lifecycle/season-transition implementation rather than
creating a parallel season runner:

- `packages/sim-v2/src/lifecycle.ts`;
- `packages/sim-v2/src/careerDevelopment.ts`;
- `packages/sim-v2/src/seasonRunner.ts` where shared helpers are appropriate;
- `packages/domain-v2/src/career.ts` if the authoritative event types need
  expansion;
- `packages/league-schema/src/schema.ts`;
- lifecycle, development, and archive tests.

At season close:

1. Finalize current-season games, production, values, injuries, and standings.
2. Write exactly one typed season archive.
3. Store one rating snapshot per active player.
4. Build `CareerAnnualContext` from games played, scheduled games, minutes,
   availability, and coaching context.
5. Run `advancePlayerCareerYear()` for active players.
6. Persist updated age, skills, role, development profile, and development
   events.
7. Prevent duplicate archives or repeated development after retries.

This phase does not require the player UI or every offseason decision surface,
but it does require the authoritative league loop to produce real history for
future seasons.

**Done when:** a multi-season seeded run produces accurate season logs and
rating snapshots, and a retry cannot apply development or archive a season
twice.

### 6. Normalize contract and value access

Update or extend the existing finance/value selector seams in:

- `packages/sim-v2/src/finance.ts`;
- `packages/sim-v2/src/playerValue.ts`;
- `packages/sim-v2/src/leagueSelectors.ts`.

Expose a stable read-only contract/value context containing:

- salary;
- years remaining;
- contract status;
- remaining value;
- Universal Player Value;
- percentile and rank;
- confidence;
- value-breakdown factors.

Do not introduce profile-specific financial formulas. Reuse the existing
contract normalization and value calculation modules.

**Done when:** all player-information consumers can read contract and value
data from one selector instead of duplicating route-local parsing.

## Test and verification gates

Add focused tests for:

- game-log derivation and filters;
- current-season aggregation;
- multi-team season splits;
- season archive creation and duplicate protection;
- development snapshot creation;
- injury start/return/games-missed behavior;
- current-season projection rebuilding;
- JSON schema validation;
- save/load/export/import round trips.

Run these commands after each implementation slice:

```bash
npm test --workspace=@workspace/sim-v2
npm test --workspace=@workspace/league-schema
npm run typecheck
npm run lint --workspace=web-v2
git diff --check
```

The code phase is complete when a seeded league can be queried through one
player-information selector before games, during a season, and after at least
one season archive, with all facts surviving save/load and JSON round trips.

## Explicitly out of scope

- Player profile route or sheet navigation.
- Rating-bar components.
- Development chart rendering.
- Game-log or season-log tables.
- Responsive layout and accessibility review for the new screen.
- Plus/minus, on/off, impact, or other statistics not currently produced by
  the game engine.
- V1 files under `apps/web` and `packages/sim`.
