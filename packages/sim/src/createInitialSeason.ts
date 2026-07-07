import {
  DEFAULT_SEASON_LENGTH_DAYS,
  NBA_GAMES_PER_TEAM,
  NBA_SEASON_LENGTH_DAYS,
  SIX_TEAM_GAMES_PER_TEAM,
} from "@workspace/shared/constants"
import type { Rng, SeasonState, TeamWithRoster } from "@workspace/shared/types"

import { getRegularSeasonStartDay } from "./calendar"
import { createRegularSchedule, createSchedule } from "./createSchedule"
import { derivePlayerSeasonStats } from "./derivePlayerSeasonStats"
import { deriveStandings } from "./deriveStandings"
import { addCampPlayersToTeams } from "./preseason/campPlayers"

export type CreateSeasonOptions = {
  skipPreseason?: boolean
}

function resolveScheduleConfig(teams: TeamWithRoster[], season: number) {
  if (teams.length === 6) {
    return {
      season,
      teams,
      gamesPerTeam: SIX_TEAM_GAMES_PER_TEAM,
      seasonLengthDays: DEFAULT_SEASON_LENGTH_DAYS,
    }
  }

  if (teams.length === 30) {
    return {
      season,
      teams,
      gamesPerTeam: NBA_GAMES_PER_TEAM,
      seasonLengthDays: NBA_SEASON_LENGTH_DAYS,
    }
  }

  throw new Error(`Unsupported league size: ${teams.length} teams`)
}

export function createInitialSeason(
  teams: TeamWithRoster[],
  baseSeed: string,
  rng: Rng,
  season = 1,
  options?: CreateSeasonOptions,
): SeasonState {
  const config = resolveScheduleConfig(teams, season)

  if (options?.skipPreseason) {
    const schedule = createRegularSchedule(config, rng)
    const state: SeasonState = {
      season,
      teams,
      schedule,
      games: [],
      standings: [],
      playerSeasonStats: [],
      currentDay: getRegularSeasonStartDay(teams.length),
      baseSeed,
      phase: "regular",
    }

    return {
      ...state,
      standings: deriveStandings(state.teams, state.games, state.season),
      playerSeasonStats: derivePlayerSeasonStats(
        state.teams,
        state.games,
        state.season,
      ),
    }
  }

  const campTeams = addCampPlayersToTeams(teams, rng, season)
  const schedule = createSchedule(resolveScheduleConfig(campTeams, season), rng)

  const state: SeasonState = {
    season,
    teams: campTeams,
    schedule,
    games: [],
    standings: [],
    playerSeasonStats: [],
    currentDay: 1,
    baseSeed,
    phase: "preseason",
  }

  return {
    ...state,
    standings: deriveStandings(state.teams, state.games, state.season),
    playerSeasonStats: derivePlayerSeasonStats(
      state.teams,
      state.games,
      state.season,
    ),
  }
}
