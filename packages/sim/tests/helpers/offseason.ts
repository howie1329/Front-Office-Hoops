import type { LeagueRecord, SeasonState } from "@workspace/shared/types"

import { completeStaffPhase } from "../../src/offseason/staffPhase"
import { createRng } from "../../src/rng"

export function pastStaffPhase(
  league: LeagueRecord,
  seed = "test-staff-complete"
): LeagueRecord {
  if (league.seasonState.phase !== "offseason") {
    return league
  }

  const current =
    league.seasonState.offseasonPhase === "contract_options"
      ? {
          ...league,
          seasonState: {
            ...league.seasonState,
            offseasonPhase: "staff" as const,
          },
        }
      : league

  if ((current.seasonState.offseasonPhase ?? "staff") !== "staff") {
    return league
  }

  return completeStaffPhase(current, createRng(seed))
}

export function pastStaffPhaseState(
  state: SeasonState,
  league: LeagueRecord,
  seed = "test-staff-complete"
): SeasonState {
  return pastStaffPhase({ ...league, seasonState: state }, seed).seasonState
}
