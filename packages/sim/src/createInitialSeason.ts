import {
  DEFAULT_SEASON_LENGTH_DAYS,
  SIX_TEAM_GAMES_PER_TEAM,
} from "@workspace/shared/constants"
import type { Rng, SeasonState, TeamWithRoster } from "@workspace/shared/types"

import { createSchedule } from "./createSchedule"
import { deriveStandings } from "./deriveStandings"

export function createInitialSeason(
  teams: TeamWithRoster[],
  baseSeed: string,
  rng: Rng,
  season = 1,
): SeasonState {
  const schedule = createSchedule(
    {
      season,
      teams,
      gamesPerTeam: SIX_TEAM_GAMES_PER_TEAM,
      seasonLengthDays: DEFAULT_SEASON_LENGTH_DAYS,
    },
    rng,
  )

  const state: SeasonState = {
    season,
    teams,
    schedule,
    games: [],
    standings: [],
    currentDay: 1,
    baseSeed,
  }

  return {
    ...state,
    standings: deriveStandings(state.teams, state.games, state.season),
  }
}
