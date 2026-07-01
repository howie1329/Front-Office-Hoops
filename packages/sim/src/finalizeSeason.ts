import type { PlayoffBracket, SeasonState } from "@workspace/shared/types"

export function finalizeSeason(state: SeasonState): SeasonState {
  const bracket = state.playoffBracket

  if (!bracket?.championTeamId) {
    throw new Error("Cannot finalize season without a champion")
  }

  return {
    ...state,
    phase: "complete",
    playoffBracket: {
      ...bracket,
      championTeamId: bracket.championTeamId,
      runnerUpTeamId: bracket.runnerUpTeamId,
    },
  }
}

export function getChampionFromBracket(bracket: PlayoffBracket | undefined): string | null {
  return bracket?.championTeamId ?? null
}
