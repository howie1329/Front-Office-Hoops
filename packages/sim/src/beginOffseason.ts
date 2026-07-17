import type {
  PlayerSeasonProfile,
  SeasonState,
} from "@workspace/shared/types"

export function beginOffseason(
  state: SeasonState,
  _playerSeasonProfiles: PlayerSeasonProfile[] = [],
): SeasonState {
  if (state.phase !== "complete") {
    throw new Error("Offseason can only begin from a completed season")
  }

  return {
    ...state,
    phase: "offseason",
    offseasonPhase: "contract_options",
  }
}
