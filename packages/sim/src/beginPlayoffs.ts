import type { PlayoffBracket, SeasonState } from "@workspace/shared/types"

import { createInitialPlayoffSeries } from "./playoffs/createBracket"
import { scheduleInitialPlayoffGames } from "./playoffs/createPlayoffSchedule"
import { seedPlayoffTeams } from "./playoffs/seedTeams"
import { isRegularSeasonComplete } from "./isRegularSeasonComplete"

export function beginPlayoffs(state: SeasonState): SeasonState {
  if (state.phase !== "regular") {
    throw new Error("Playoffs can only begin from the regular season phase")
  }

  if (!isRegularSeasonComplete(state)) {
    throw new Error("Regular season is not complete")
  }

  const seeded = seedPlayoffTeams(state)
  const firstRoundSeries = createInitialPlayoffSeries(
    state.season,
    state.teams.length,
    seeded,
  )
  const playoffGames = scheduleInitialPlayoffGames(state, firstRoundSeries)

  const playoffBracket: PlayoffBracket = {
    series: firstRoundSeries,
  }

  const playoffStartDay = playoffGames[0]?.day ?? state.currentDay

  return {
    ...state,
    phase: "playoffs",
    playoffBracket,
    schedule: [...state.schedule, ...playoffGames],
    currentDay: playoffStartDay,
  }
}
