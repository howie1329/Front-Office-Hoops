import type { SeasonState } from "@workspace/shared/types"

import { simulatePlayoffDay } from "./simulatePlayoffDay"

export function simulatePlayoffs(state: SeasonState, rngNonce = 0): SeasonState {
  if (state.phase !== "playoffs") {
    throw new Error("Can only simulate playoffs during the playoffs phase")
  }

  let nextState = state
  let safety = 0

  while (nextState.phase === "playoffs" && safety < 500) {
    const hasScheduledPlayoffGames = nextState.schedule.some(
      (game) => game.seriesId && game.status === "scheduled",
    )

    if (!hasScheduledPlayoffGames) {
      break
    }

    const nextDay = nextState.schedule
      .filter((game) => game.seriesId && game.status === "scheduled")
      .map((game) => game.day)
      .sort((a, b) => a - b)[0]

    if (nextDay === undefined) {
      break
    }

    nextState = simulatePlayoffDay(
      nextState,
      Math.max(nextState.currentDay, nextDay),
      rngNonce
    )
    safety += 1
  }

  return nextState
}
