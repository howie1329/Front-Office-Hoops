import type { SeasonState } from "@workspace/shared/types"

import { simulatePlayoffDay } from "./simulatePlayoffDay"
import { simulateRegularDay } from "./simulateRegularDay"

export function simulateDay(
  state: SeasonState,
  day: number = state.currentDay,
  rngNonce = 0,
): SeasonState {
  if (state.phase === "playoffs") {
    return simulatePlayoffDay(state, day, rngNonce)
  }

  return simulateRegularDay(state, day, rngNonce)
}
