import type { SeasonState, Rng } from "@workspace/shared/types"

import { applyOffseasonProgression } from "./development/applyOffseasonProgression"

export function beginOffseason(state: SeasonState, rng: Rng): SeasonState {
  if (state.phase !== "complete") {
    throw new Error("Offseason can only begin from a completed season")
  }

  const teams = applyOffseasonProgression(
    state.teams,
    state.season,
    state.playerSeasonStats,
    state.baseSeed,
    rng,
  )

  return {
    ...state,
    teams,
    phase: "offseason",
    offseasonPhase: "re_signing",
  }
}
