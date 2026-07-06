import type { PlayoffRound, SeasonState } from "@workspace/shared/types"

import { simulatePlayoffDay } from "./simulatePlayoffDay"

function getActivePlayoffRound(state: SeasonState): PlayoffRound | null {
  const activeRounds =
    state.playoffBracket?.series
      .filter((series) => !series.winnerId)
      .map((series) => series.round) ?? []

  return activeRounds.length === 0
    ? null
    : (Math.min(...activeRounds) as PlayoffRound)
}

export function simulateCurrentPlayoffRound(
  state: SeasonState,
  rngNonce = 0
): SeasonState {
  if (state.phase !== "playoffs") {
    throw new Error(
      "Can only simulate a playoff round during the playoffs phase"
    )
  }

  const round = getActivePlayoffRound(state)
  if (!round) {
    return state
  }

  let nextState = state
  let safety = 0

  while (
    nextState.phase === "playoffs" &&
    getActivePlayoffRound(nextState) === round &&
    safety < 100
  ) {
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
