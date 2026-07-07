import type { SeasonState } from "@workspace/shared/types"

import { derivePlayerSeasonStats } from "./derivePlayerSeasonStats"
import { deriveStandings } from "./deriveStandings"
import { advanceInjuriesForDay } from "./injuries"
import {
  advancePlayoffWinners,
  ensureActiveSeriesScheduled,
} from "./playoffs/advanceWinners"
import { simulateSeriesGame } from "./playoffs/simulateSeriesGame"
import { getCurrentCalendar } from "./calendar"
import type { SimulateDayOptions } from "./simulateDay"

export function simulatePlayoffDay(
  state: SeasonState,
  day: number = state.currentDay,
  rngNonce = 0,
  options?: SimulateDayOptions,
): SeasonState {
  const playoffGames = state.schedule.filter(
    (game) => game.seriesId && game.day === day && game.status === "scheduled"
  )

  let nextState = {
    ...state,
    teams: advanceInjuriesForDay(state.teams),
  }

  if (playoffGames.length === 0) {
    return {
      ...nextState,
      currentDay: day + 1,
      standings: deriveStandings(
        nextState.teams,
        nextState.games,
        nextState.season
      ),
      playerSeasonStats: derivePlayerSeasonStats(
        nextState.teams,
        nextState.games,
        nextState.season
      ),
    }
  }

  for (const game of playoffGames) {
    nextState = simulateSeriesGame(nextState, game.id, rngNonce, options)
    nextState = advancePlayoffWinners(nextState)
    nextState = ensureActiveSeriesScheduled(nextState)
  }

  const nextDay =
    nextState.phase === "complete"
      ? Math.max(
          day + 1,
          getCurrentCalendar(nextState).milestones.offseasonStartDay
        )
      : day + 1

  return {
    ...nextState,
    currentDay: nextDay,
    standings: deriveStandings(
      nextState.teams,
      nextState.games,
      nextState.season
    ),
    playerSeasonStats: derivePlayerSeasonStats(
      nextState.teams,
      nextState.games,
      nextState.season
    ),
  }
}
