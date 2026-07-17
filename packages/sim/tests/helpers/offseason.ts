import type { LeagueRecord, SeasonState } from "@workspace/shared/types"

import { getStaffContractMarketValue } from "../../src/contracts/marketValue"
import { completeStaffPhase } from "../../src/offseason/staffPhase"
import { createRng } from "../../src/rng"
import {
  getVacantStaffRoles,
  reconcileStaffEmployment,
} from "../../src/staff/employmentLifecycle"
import { commitStaffHire } from "../../src/staff/hireStaff"

export function fillUserStaffVacanciesForTest(
  league: LeagueRecord
): LeagueRecord {
  if (!league.userTeamId) {
    return league
  }

  let current = league
  for (const role of getVacantStaffRoles(current, league.userTeamId)) {
    const candidate = current.staff
      .filter((member) => member.teamId === null && member.role === role)
      .sort(
        (left, right) =>
          right.ratings.overall - left.ratings.overall ||
          left.id.localeCompare(right.id)
      )[0]
    if (!candidate) {
      throw new Error(`Expected an available ${role} for the user team`)
    }

    const market = getStaffContractMarketValue(candidate)
    current = commitStaffHire(current, league.userTeamId, candidate.id, {
      years: 1,
      firstYearSalary: market.expectedSalary,
    })
  }

  return current
}

export function pastStaffPhase(
  league: LeagueRecord,
  seed = "test-staff-complete"
): LeagueRecord {
  if (league.seasonState.phase !== "offseason") {
    return league
  }

  const current =
    league.seasonState.offseasonPhase === "contract_options"
      ? reconcileStaffEmployment({
          ...league,
          seasonState: {
            ...league.seasonState,
            offseasonPhase: "staff" as const,
          },
        })
      : league

  if ((current.seasonState.offseasonPhase ?? "staff") !== "staff") {
    return league
  }

  return completeStaffPhase(
    fillUserStaffVacanciesForTest(current),
    createRng(seed)
  )
}

export function pastStaffPhaseState(
  state: SeasonState,
  league: LeagueRecord,
  seed = "test-staff-complete"
): SeasonState {
  return pastStaffPhase({ ...league, seasonState: state }, seed).seasonState
}
