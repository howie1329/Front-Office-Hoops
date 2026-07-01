import type { SeasonState } from "@workspace/shared/types"

import { derivePlayerSeasonStats } from "./derivePlayerSeasonStats"
import { deriveStandings } from "./deriveStandings"
import {
  advancePlayoffWinners,
  ensureActiveSeriesScheduled,
} from "./playoffs/advanceWinners"
import { simulateSeriesGame } from "./playoffs/simulateSeriesGame"

export function simulatePlayoffDay(
  state: SeasonState,
  day: number = state.currentDay,
): SeasonState {
  const playoffGames = state.schedule.filter(
    (game) =>
      game.seriesId &&
      game.day === day &&
      game.status === "scheduled",
  )

  let nextState = state

  if (playoffGames.length === 0) {
    return {
      ...nextState,
      currentDay: day + 1,
      standings: deriveStandings(nextState.teams, nextState.games, nextState.season),
      playerSeasonStats: derivePlayerSeasonStats(
        nextState.teams,
        nextState.games,
        nextState.season,
      ),
    }
  }

  for (const game of playoffGames) {
    nextState = simulateSeriesGame(nextState, game.id)
    nextState = advancePlayoffWinners(nextState)
    nextState = ensureActiveSeriesScheduled(nextState)
  }

  return {
    ...nextState,
    currentDay: day + 1,
    standings: deriveStandings(nextState.teams, nextState.games, nextState.season),
    playerSeasonStats: derivePlayerSeasonStats(
      nextState.teams,
      nextState.games,
      nextState.season,
    ),
  }
}
