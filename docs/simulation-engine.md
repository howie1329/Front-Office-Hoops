# Simulation Engine

The simulation engine lives in `packages/sim`. It is **pure TypeScript** — no framework dependencies — and is fully unit tested with Vitest.

## Design philosophy

1. **Deterministic given a seed** — `createRng(seed)` produces reproducible sequences
2. **Composable functions** — small units (game → day → week → season) compose upward
3. **Immutable patterns** — functions return new state rather than mutating inputs
4. **Separation of concerns** — team strength estimation, stat allocation, and scheduling are isolated modules

## Random number generation

```ts
import { createRng } from "@workspace/sim"

const rng = createRng("my-seed")
rng.next() // [0, 1)
rng.int(1, 10) // inclusive integer
rng.normal(0, 1) // Gaussian sample
```

Each game derives a sub-seed from `baseSeed`, season, day, and `gameId` so individual games are reproducible within a league.

## Game simulation

### Team strength and components

`simulateTeamMatchup` uses an aggregate component model rather than play-by-play. It estimates possessions, then generates team-level box-score components:

- field goal attempts and makes
- three-point attempts and makes
- free throws
- turnovers
- offensive and defensive rebounds
- assists, steals, and blocks
- final score, quarter scores, and efficiency metadata

Team-level pace and player ratings (`shooting`, `inside`, `passing`, `rebounding`, `defense`, `stamina`, `usage`) feed the component model. Depth matters through rotation quality and bench drag rather than an artificial global bonus.

### Matchup flow (`simulateTeamMatchup`)

```
selectRotation(players)
    → estimate shared possessions from both teams' pace + noise
    → generate team stat components
    → reconcile score and team totals
    → resolve ties with overtime bonus
    → distributeQuarterScores
    → allocatePlayerStats from attempts/makes/free throws/rebounds/etc.
    → TeamMatchupResult
```

**Home court advantage** defaults to +3 points (`DEFAULT_HOME_COURT_ADVANTAGE`) and is applied during scoring component generation.

**Rotation**: `createAutoRotationPlan` assigns roles (`star`, `starter`, `sixth_man`, `rotation`, `bench`) and target minutes. `createGameRotation` converts that plan into game rotation entries. `selectRotation` preserves the legacy player+minutes API and filters to active players, with a last-resort non-free-agent fallback if a roster drops below five active players.

**Player stats**: `allocatePlayerStats` distributes attempts, makes, free throws, rebounds, assists, steals, blocks, and turnovers across the rotation using player skills, usage, position, and minutes. Player points reconcile exactly to team score.

### Single game wrapper (`simulateGame`)

Wraps `simulateTeamMatchup` with schedule context (`season`, `day`, `gameId`) and returns a `Game` record with full `TeamMatchupResult`.

## Schedule generation

`createSchedule` builds a round-robin style schedule:

| League size | Games per team | Season days |
| ----------- | -------------- | ----------- |
| 6 (mini)    | 10             | 30          |
| 30 (full)   | 82             | 170         |

Schedule games track `status` (`scheduled` | `final`), link to `gameId` when played, and support playoff metadata (`seriesId`, `playoffRound`).

## Season simulation

### Day / week / season

| Function             | Behavior                                                                                              |
| -------------------- | ----------------------------------------------------------------------------------------------------- |
| `simulateRegularDay` | Recovers injuries, plays scheduled regular games, applies post-game injuries, updates standings/stats |
| `simulateDay`        | Dispatches to regular or playoff day based on `phase`                                                 |
| `simulateWeek`       | Simulates up to 7 days                                                                                |
| `simulateSeason`     | Runs until regular season complete or playoffs/season done                                            |

### Standings (`deriveStandings`)

Computed from final games: wins, losses, points for/against, streak.

### Player season stats (`derivePlayerSeasonStats`)

Aggregated from all `PlayerGameStats` across games in the season.

## Playoffs

### Phases

`SeasonPhase`: `regular` → `playoffs` → `complete`

### Bracket formats

| Teams | Format    | Wins to advance |
| ----- | --------- | --------------- |
| 30    | Best-of-7 | 4               |
| 6     | Best-of-3 | 2               |

`getPlayoffFormat(teamCount)` selects the format. Home-court patterns follow standard NBA series scheduling (2-2-1-1-1 for best-of-7).

### Key functions

- `beginPlayoffs` — seeds teams, creates bracket and playoff schedule
- `simulatePlayoffDay` — recovers injuries, plays scheduled playoff games, applies post-game injuries, advances series winners
- `simulatePlayoffs` — runs entire postseason
- `deriveUserPlayoffResult` — maps user team outcome to enum (`champion`, `first_round`, etc.)

### Seeding

`seedTeams` ranks teams by record within conferences (30-team) or overall (6-team mini league).

## League lifecycle

```
createLeague
    → createInitialSeason (schedule + standings)
    → [simulate regular season]
    → beginPlayoffs
    → [simulate playoffs]
    → beginOffseason (player development)
    → finalizeSeason + archiveSeason
    → startNextSeason (increment season, new schedule)
```

## Player development (offseason)

Each offseason, `beginOffseason` applies `applyOffseasonProgression`:

- Increments player age
- Per-skill growth or regression based on individual `peakAge` and `potential` headroom
- Slow potential drift (seeded RNG)
- Veteran mentorship modifier for developing teammates and post-peak regression
- Recalculates `overall`, `usage`, and team `overall`

Development currently uses age, peak age, potential headroom, skill deltas, veteran mentorship, and potential drift. It does not yet use season role/minutes, injury history, or performance context.

## Injuries

`injuries.ts` provides a simple availability model:

- `calculateInjuryRisk(player, minutes)` — risk increases with minutes, age, and low stamina
- `rollInjury(rng)` — creates minor, moderate, or major injuries with game durations
- `advanceInjuriesForDay(teams)` — decrements injuries and restores recovered players to active
- `applyPostGameInjuries` — rolls injuries for players who appeared in a game

Injured players have `status: "injured"` and an `injury` object with type, description, and games remaining. New injuries are skipped for teams with fewer than eight active players to avoid roster death spirals.

`createLeague` accepts:

- `name`, `baseSeed`, `rng`
- Optional `teams` or `useMiniLeague` (6-team sample rosters)
- Optional `userTeamId`

New leagues are created with the current `SAVE_VERSION`. There is no save migration; clear local IndexedDB saves after schema changes during development.

## Offseason loop

Offseason is phased after a champion is crowned:

```
complete → beginOffseason → re_signing → draft → free_agency → startNextSeason
```

- **Begin offseason** applies player development, assesses season finances, and expires one-year contracts into the free-agent pool.
- **Re-signing** lets the user negotiate with their own expired players first, then AI teams run re-signing.
- **Draft** is required after every completed season, including Season 1. Drafted players receive rookie-scale/minimum contracts.
- **Free agency** opens after the draft; undrafted prospects join the FA pool and the pool is topped up to at least 1.25× team count if thin.
- Teams must start the next season with 12 players. Releases cannot drop a team below 6 players or remove the last player at any primary position.

## Procedural generation

### Teams (`generateTeams`)

30 NBA-style teams with conferences (East/West), divisions, `overall`, and `pace`.

### Players (`generatePlayers`)

12 players per team (`PLAYERS_PER_TEAM`) with:

- Positions: PG, SG, SF, PF, C
- Archetypes: lead guards, scoring guards, 3-and-D wings, slashers, point forwards, stretch bigs, rim protectors, post scorers, rebounding bigs, defensive specialists, bench scorers, raw athletes
- Ratings: overall, potential, shooting, inside, passing, rebounding, defense, stamina, usage
- Physical attributes: age, height, weight
- Names from configurable name pools

Generated rosters use depth tiers (stars, starters, rotation, bench) so ratings are not bunched around team overall. Archetypes bias skill distribution and usage, and are also used by player value.

### Draft classes

Draft classes are 1.5× the two-round pick count (90 prospects for 30 teams). Prospect generation is tiered:

- Lottery: higher current OVR and high potential
- Mid-first: solid current OVR with above-average upside
- Second round: lower current OVR and mixed ceiling
- Undrafted range: lower OVR with wider potential variance

Draft prospects receive position-valid archetypes. Unselected prospects are converted to free agents when the draft completes.

## Player and contract value

`playerValue` exposes:

- `getPlayerValueBreakdown` — talent, upside, age risk, archetype value, scarcity value
- `calculatePlayerValue` — total player value for roster/FA decisions
- `calculateContractValue` — fair-salary-oriented player value
- `calculateRosterKeepValue` — mode-aware keep value for AI cuts
- `getContractAssetValueBreakdown` — player value plus contract surplus/liability

Financial AI uses these values for fair salary, re-signing, free-agent scoring, and cap-cut decisions.

### Sample data

`SAMPLE_ROSTERS` provides fixed 6-team mini-league data for fast testing and Season Lab.

## Constants reference

Key values from `@workspace/shared/constants`:

| Constant                       | Value   | Purpose                          |
| ------------------------------ | ------- | -------------------------------- |
| `BASE_OFF_RATING`              | 108     | League-average offensive rating  |
| `DEFAULT_PACE`                 | 100     | Possessions per game baseline    |
| `RATING_MIN` / `RATING_MAX`    | 40 / 90 | Player rating bounds             |
| `LEAGUE_TEAM_COUNT`            | 30      | Full league size                 |
| `NBA_GAMES_PER_TEAM`           | 82      | Full season length               |
| `PLAYOFF_TEAMS_PER_CONFERENCE` | 8       | NBA playoff field per conference |

## Testing

Run sim tests:

```bash
npm run test --workspace=@workspace/sim
```

Tests cover game outcomes, schedule integrity, standings math, stat allocation, rotations, archetypes, injuries, player value, financial AI, playoff advancement, and full season flows.

## Developer labs

- **`/sim-lab`** — experiment with single game matchups
- **`/season-lab`** — run season simulations with live standings and stats tables

These routes are development tools, not player-facing features.
