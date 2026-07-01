import type { SeasonState } from "@workspace/shared/types"

import { simulateDay } from "./simulateDay"

export function simulateWeek(state: SeasonState): SeasonState {
  let nextState = state

  for (let i = 0; i < 7; i++) {
    nextState = simulateDay(nextState, nextState.currentDay)
  }

  return nextState
}
