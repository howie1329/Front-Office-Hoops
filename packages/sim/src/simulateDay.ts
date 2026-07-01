import type { SeasonState } from "@workspace/shared/types"

import { simulatePlayoffDay } from "./simulatePlayoffDay"
import { simulateRegularDay } from "./simulateRegularDay"

export function simulateDay(
  state: SeasonState,
  day: number = state.currentDay,
): SeasonState {
  if (state.phase === "playoffs") {
    return simulatePlayoffDay(state, day)
  }

  return simulateRegularDay(state, day)
}
