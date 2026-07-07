import type { SeasonState, TeamFinancials } from "@workspace/shared/types"

import { simulatePlayoffDay } from "./simulatePlayoffDay"
import { simulateRegularDay } from "./simulateRegularDay"

export type SimulateDayOptions = {
  teamFinancials?: TeamFinancials[]
}

export function simulateDay(
  state: SeasonState,
  day: number = state.currentDay,
  rngNonce = 0,
  options?: SimulateDayOptions,
): SeasonState {
  if (state.phase === "playoffs") {
    return simulatePlayoffDay(state, day, rngNonce, options)
  }

  if (state.phase === "preseason" || state.phase === "regular") {
    return simulateRegularDay(state, day, rngNonce, options)
  }

  return {
    ...state,
    currentDay: day + 1,
  }
}
