import type { SeasonState } from "@workspace/shared/types"

import { simulateDay } from "./simulateDay"

export function simulateSeason(state: SeasonState, rngNonce = 0): SeasonState {
  if (state.phase !== "regular") {
    return state
  }

  let nextState = state
  const maxDay = Math.max(...state.schedule.map((game) => game.day), 0)
  let safety = 0

  while (
    nextState.schedule.some((game) => game.status === "scheduled") &&
    nextState.currentDay <= maxDay + 7 &&
    safety < 500
  ) {
    nextState = simulateDay(nextState, nextState.currentDay, rngNonce)
    safety += 1
  }

  while (nextState.schedule.some((game) => game.status === "scheduled") && safety < 600) {
    const nextScheduledDay = nextState.schedule
      .filter((game) => game.status === "scheduled")
      .map((game) => game.day)
      .sort((a, b) => a - b)[0]

    if (nextScheduledDay === undefined) {
      break
    }

    nextState = simulateDay(nextState, nextScheduledDay, rngNonce)
    safety += 1
  }

  return nextState
}
