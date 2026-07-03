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
rng.next()              // [0, 1)
rng.int(1, 10)          // inclusive integer
rng.normal(0, 1)        // Gaussian sample
```

Each game derives a sub-seed from `baseSeed`, season, day, and `gameId` so individual games are reproducible within a league.

## Game simulation

### Team strength

`teamStrength.ts` estimates offensive and defensive factors from roster ratings:

- `estimateTeamOffFactor` / `estimateTeamDefFactor` — aggregate player ratings
- `estimateOffRtg` — offensive rating (points per 100 possessions)

Team-level attributes (`overall`, `pace`) and player ratings (`shooting`, `defense`, `usage`, etc.) feed into these estimates.

### Matchup flow (`simulateTeamMatchup`)

```
selectRotation(players)
    → estimate possessions from pace + noise
    → compute offRtg for each team (with home court advantage)
    → score = possessions × offRtg / 100
    → resolve ties with overtime bonus
    → distributeQuarterScores
    → allocatePlayerStats
    → TeamMatchupResult
```

**Home court advantage** defaults to +3 offensive rating (`DEFAULT_HOME_COURT_ADVANTAGE`).

**Rotation**: top 8 players by overall (`ROTATION_SIZE`), minutes sum to 240 team minutes (`TEAM_MINUTES`).

**Player stats**: `allocatePlayerStats` distributes team totals across the rotation weighted by `usage` and position.

### Single game wrapper (`simulateGame`)

Wraps `simulateTeamMatchup` with schedule context (`season`, `day`, `gameId`) and returns a `Game` record with full `TeamMatchupResult`.

## Schedule generation

`createSchedule` builds a round-robin style schedule:

| League size | Games per team | Season days |
|-------------|----------------|-------------|
| 6 (mini)    | 10             | 30          |
| 30 (full)   | 82             | 170         |

Schedule games track `status` (`scheduled` | `final`), link to `gameId` when played, and support playoff metadata (`seriesId`, `playoffRound`).

## Season simulation

### Day / week / season

| Function | Behavior |
|----------|----------|
| `simulateRegularDay` | Plays all games scheduled for `currentDay`, updates standings and player stats |
| `simulateDay` | Dispatches to regular or playoff day based on `phase` |
| `simulateWeek` | Simulates up to 7 days |
| `simulateSeason` | Runs until regular season complete or playoffs/season done |

### Standings (`deriveStandings`)

Computed from final games: wins, losses, points for/against, streak.

### Player season stats (`derivePlayerSeasonStats`)

Aggregated from all `PlayerGameStats` across games in the season.

## Playoffs

### Phases

`SeasonPhase`: `regular` → `playoffs` → `complete`

### Bracket formats

| Teams | Format | Wins to advance |
|-------|--------|-----------------|
| 30    | Best-of-7 | 4 |
| 6     | Best-of-3 | 2 |

`getPlayoffFormat(teamCount)` selects the format. Home-court patterns follow standard NBA series scheduling (2-2-1-1-1 for best-of-7).

### Key functions

- `beginPlayoffs` — seeds teams, creates bracket and playoff schedule
- `simulatePlayoffDay` — plays scheduled playoff games, advances series winners
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

`createLeague` accepts:

- `name`, `baseSeed`, `rng`
- Optional `teams` or `useMiniLeague` (6-team sample rosters)
- Optional `userTeamId`

`normalizeLeagueRecord` handles save version upgrades when loading persisted data.

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
- Ratings: overall, potential, shooting, inside, passing, rebounding, defense, stamina, usage
- Physical attributes: age, height, weight
- Names from configurable name pools

Generated rosters use depth tiers (stars, starters, rotation, bench) so ratings are not bunched around team overall.

### Draft classes

Draft classes are 1.5× the two-round pick count (90 prospects for 30 teams). Prospect generation is tiered:

- Lottery: higher current OVR and high potential
- Mid-first: solid current OVR with above-average upside
- Second round: lower current OVR and mixed ceiling
- Undrafted range: lower OVR with wider potential variance

Unselected prospects are converted to free agents when the draft completes.

### Sample data

`SAMPLE_ROSTERS` provides fixed 6-team mini-league data for fast testing and Season Lab.

## Constants reference

Key values from `@workspace/shared/constants`:

| Constant | Value | Purpose |
|----------|-------|---------|
| `BASE_OFF_RATING` | 108 | League-average offensive rating |
| `DEFAULT_PACE` | 100 | Possessions per game baseline |
| `RATING_MIN` / `RATING_MAX` | 40 / 90 | Player rating bounds |
| `LEAGUE_TEAM_COUNT` | 30 | Full league size |
| `NBA_GAMES_PER_TEAM` | 82 | Full season length |
| `PLAYOFF_TEAMS_PER_CONFERENCE` | 8 | NBA playoff field per conference |

## Testing

Run sim tests:

```bash
npm run test --workspace=@workspace/sim
```

Tests cover game outcomes, schedule integrity, standings math, stat allocation, playoff advancement, and full season flows.

## Developer labs

- **`/sim-lab`** — experiment with single game matchups
- **`/season-lab`** — run season simulations with live standings and stats tables

These routes are development tools, not player-facing features.
