import type { LeagueRecord, StaffExtensionOffer } from "@workspace/shared/types"

import { roundMoney } from "../financials/capMath"
import { syncLeagueStaffFinancials } from "./deriveTeamStaff"
import { getStaffPayroll } from "./staffPayroll"

export type StaffActionResult =
  | { ok: true; league: LeagueRecord }
  | { ok: false; reason: string }

function createStaffContractId(staffId: string, season: number): string {
  return `staff_contract_ext_${staffId}_${season}_${crypto.randomUUID().slice(0, 8)}`
}

export function extendStaffContract(
  league: LeagueRecord,
  teamId: string,
  staffId: string,
  offer: StaffExtensionOffer,
): StaffActionResult {
  if (league.seasonState.phase !== "offseason") {
    return { ok: false, reason: "Staff extensions are only allowed during the offseason" }
  }

  if ((league.seasonState.offseasonPhase ?? "staff") !== "staff") {
    return { ok: false, reason: "Staff extensions are only allowed during the staff phase" }
  }

  const member = league.staff.find(
    (entry) => entry.id === staffId && entry.teamId === teamId,
  )
  if (!member) {
    return { ok: false, reason: "Coach not found on this team" }
  }

  const activeContract = league.staffContracts.find(
    (contract) =>
      contract.staffId === staffId &&
      contract.teamId === teamId &&
      contract.status === "active",
  )

  if (!activeContract) {
    return { ok: false, reason: "No active staff contract found" }
  }

  const teamFinance = league.teamFinancials.find((entry) => entry.teamId === teamId)
  if (!teamFinance) {
    return { ok: false, reason: "Team not found" }
  }

  const season = league.seasonState.season
  const extensionSalaries = Array.from({ length: offer.years }, (_, index) =>
    roundMoney(offer.firstYearSalary * (1 + index * 0.05)),
  )

  const currentPayroll = getStaffPayroll(teamId, league.staffContracts, season)
  const extensionTotal = extensionSalaries.reduce((sum, salary) => sum + salary, 0)
  const currentContractRemaining = activeContract.yearlySalaries
    .slice(Math.max(0, season - activeContract.startSeason))
    .reduce((sum, salary) => sum + salary, 0)

  if (
    currentPayroll - currentContractRemaining + extensionTotal >
    teamFinance.staffBudget
  ) {
    return { ok: false, reason: "Extension exceeds the annual staff budget" }
  }

  const staffContracts = league.staffContracts.map((contract) =>
    contract.id === activeContract.id
      ? { ...contract, status: "expired" as const }
      : contract,
  )

  const newContract = {
    id: createStaffContractId(staffId, season),
    staffId,
    teamId,
    startSeason: season,
    endSeason: season + offer.years - 1,
    yearlySalaries: extensionSalaries,
    status: "active" as const,
    signedSeason: season,
  }

  return {
    ok: true,
    league: syncLeagueStaffFinancials({
      ...league,
      staffContracts: [...staffContracts, newContract],
    }),
  }
}
