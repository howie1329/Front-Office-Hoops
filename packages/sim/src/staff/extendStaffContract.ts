import type { LeagueRecord, StaffExtensionOffer } from "@workspace/shared/types"

import { syncLeagueStaffFinancials } from "./deriveTeamStaff"
import { buildStaffSalaryCurve, validateStaffPayrollForecast } from "./hireStaff"

export type StaffActionResult =
  { ok: true; league: LeagueRecord } | { ok: false; reason: string }

function createStaffContractId(
  league: Pick<LeagueRecord, "staffContracts">,
  staffId: string,
  season: number
): string {
  const baseId = `staff_contract_ext_${staffId}_${season}`
  const sequence =
    league.staffContracts.filter((contract) =>
      contract.id.startsWith(`${baseId}_`)
    ).length + 1
  return `${baseId}_${sequence}`
}

export function extendStaffContract(
  league: LeagueRecord,
  teamId: string,
  staffId: string,
  offer: StaffExtensionOffer
): StaffActionResult {
  if (league.seasonState.phase !== "offseason") {
    return {
      ok: false,
      reason: "Staff extensions are only allowed during the offseason",
    }
  }

  if ((league.seasonState.offseasonPhase ?? "staff") !== "staff") {
    return {
      ok: false,
      reason: "Staff extensions are only allowed during the staff phase",
    }
  }

  const member = league.staff.find(
    (entry) => entry.id === staffId && entry.teamId === teamId
  )
  if (!member) {
    return { ok: false, reason: "Coach not found on this team" }
  }

  const activeContract = league.staffContracts
    .filter(
      (contract) =>
        contract.staffId === staffId &&
        contract.teamId === teamId &&
        contract.status === "active",
    )
    .sort((left, right) => right.endSeason - left.endSeason)[0]

  if (!activeContract) {
    return { ok: false, reason: "No active staff contract found" }
  }

  const extensionSalaries = buildStaffSalaryCurve(offer.firstYearSalary, offer.years)
  const startSeason = activeContract.endSeason + 1
  const budgetError = validateStaffPayrollForecast(
    league,
    teamId,
    startSeason,
    extensionSalaries,
  )
  if (budgetError) return { ok: false, reason: budgetError }

  const newContract = {
    id: createStaffContractId(
      league,
      staffId,
      league.leagueFinancials.currentCapSeason,
    ),
    staffId,
    teamId,
    startSeason,
    endSeason: startSeason + offer.years - 1,
    yearlySalaries: extensionSalaries,
    status: "active" as const,
    signedSeason: league.leagueFinancials.currentCapSeason,
  }

  return {
    ok: true,
    league: syncLeagueStaffFinancials({
      ...league,
      staffContracts: [...league.staffContracts, newContract],
    }),
  }
}
