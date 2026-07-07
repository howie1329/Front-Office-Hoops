import type { LeagueRecord, SeasonState } from "@workspace/shared/types"

import { completeStaffPhase } from "../../src/offseason/staffPhase"
import { createRng } from "../../src/rng"

export function pastStaffPhase(
  league: LeagueRecord,
  seed = "test-staff-complete",
): LeagueRecord {
  if (league.seasonState.phase !== "offseason") {
    return league
  }

  if ((league.seasonState.offseasonPhase ?? "staff") !== "staff") {
    return league
  }

  return completeStaffPhase(league, createRng(seed))
}

export function pastStaffPhaseState(
  state: SeasonState,
  league: LeagueRecord,
  seed = "test-staff-complete",
): SeasonState {
  return pastStaffPhase({ ...league, seasonState: state }, seed).seasonState
}
