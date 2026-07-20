import type { StaffContract } from "@workspace/shared/types"
import type { LeagueRecord, StaffOffer } from "@workspace/shared/types"

import { roundMoney } from "../financials/capMath"
import { getStaffByRole, syncLeagueStaffFinancials } from "./deriveTeamStaff"
import { getStaffPayroll } from "./staffPayroll"

export type StaffActionResult =
  { ok: true; league: LeagueRecord } | { ok: false; reason: string }

export function buildStaffSalaryCurve(firstYearSalary: number, years: number): number[] {
  return Array.from({ length: years }, (_, index) =>
    roundMoney(firstYearSalary * (1 + index * 0.05))
  )
}

export function validateStaffPayrollForecast(
  league: LeagueRecord,
  teamId: string,
  startSeason: number,
  salaries: number[],
  excludedContractId?: string,
): string | null {
  const budget = league.teamFinancials.find((entry) => entry.teamId === teamId)?.staffBudget
  if (budget === undefined) return "Team not found"
  const contracts = excludedContractId
    ? league.staffContracts.filter((contract) => contract.id !== excludedContractId)
    : league.staffContracts
  for (let index = 0; index < salaries.length; index += 1) {
    const payroll = getStaffPayroll(teamId, contracts, startSeason + index)
    if (payroll + (salaries[index] ?? 0) > budget) {
      return `Staff offer exceeds the annual staff budget in season ${startSeason + index}`
    }
  }
  return null
}

function createStaffContractId(
  league: Pick<LeagueRecord, "staffContracts">,
  staffId: string,
  season: number
): string {
  const baseId = `staff_contract_${staffId}_${season}`
  const sequence =
    league.staffContracts.filter((contract) =>
      contract.id.startsWith(`${baseId}_`)
    ).length + 1
  return `${baseId}_${sequence}`
}

export function validateStaffHire(
  league: LeagueRecord,
  teamId: string,
  staffId: string,
  offer: StaffOffer
): StaffActionResult {
  if (league.seasonState.phase !== "offseason") {
    return {
      ok: false,
      reason: "Staff moves are only allowed during the offseason",
    }
  }

  if ((league.seasonState.offseasonPhase ?? "staff") !== "staff") {
    return {
      ok: false,
      reason: "Staff hiring is only allowed during the staff phase",
    }
  }

  const teamFinance = league.teamFinancials.find(
    (entry) => entry.teamId === teamId
  )
  if (!teamFinance) {
    return { ok: false, reason: "Team not found" }
  }

  const marketMember = league.staff.find((entry) => entry.id === staffId)
  const collegeMember = league.collegeCoaches.find(
    (entry) => entry.id === staffId
  )
  const candidate = marketMember ?? collegeMember

  if (!candidate) {
    return { ok: false, reason: "Coach not found in the hiring pool" }
  }

  if (candidate.teamId) {
    return { ok: false, reason: "Coach is already employed" }
  }

  const incumbent = getStaffByRole(league.staff, teamId, candidate.role)
  if (incumbent) {
    return {
      ok: false,
      reason: `Team already has a ${candidate.role.replaceAll("_", " ")}`,
    }
  }

  const season = league.leagueFinancials.currentCapSeason
  const proposedSalaries = buildStaffSalaryCurve(offer.firstYearSalary, offer.years)
  const budgetError = validateStaffPayrollForecast(
    league,
    teamId,
    season,
    proposedSalaries,
  )
  if (budgetError) {
    return { ok: false, reason: budgetError }
  }

  return { ok: true, league }
}

export function hireStaff(
  league: LeagueRecord,
  teamId: string,
  staffId: string,
  offer: StaffOffer
): StaffActionResult {
  const validation = validateStaffHire(league, teamId, staffId, offer)
  if (!validation.ok) {
    return validation
  }

  return { ok: true, league: commitStaffHire(league, teamId, staffId, offer) }
}

export function commitStaffHire(
  league: LeagueRecord,
  teamId: string,
  staffId: string,
  offer: StaffOffer
): LeagueRecord {
  const marketIndex = league.staff.findIndex((entry) => entry.id === staffId)
  const collegeIndex = league.collegeCoaches.findIndex(
    (entry) => entry.id === staffId
  )
  const fromCollege = collegeIndex >= 0
  const sourceMember = fromCollege
    ? league.collegeCoaches[collegeIndex]!
    : league.staff[marketIndex]!
  if (!sourceMember || sourceMember.teamId) {
    throw new Error("Coach is not available")
  }
  if (getStaffByRole(league.staff, teamId, sourceMember.role)) {
    throw new Error(
      `Team already has a ${sourceMember.role.replaceAll("_", " ")}`
    )
  }

  const hiredMember = {
    ...sourceMember,
    teamId,
    source: "employed" as const,
    potential: undefined,
    seasonsInCollege: undefined,
  }

  const season = league.leagueFinancials.currentCapSeason
  const contract: StaffContract = {
    id: createStaffContractId(league, staffId, season),
    staffId,
    teamId,
    startSeason: season,
    endSeason: season + offer.years - 1,
    yearlySalaries: buildStaffSalaryCurve(offer.firstYearSalary, offer.years),
    status: "active",
    signedSeason: season,
  }

  let staff = [...league.staff]
  if (fromCollege) {
    staff.push(hiredMember)
  } else {
    staff = staff.map((entry) => (entry.id === staffId ? hiredMember : entry))
  }

  const collegeCoaches = fromCollege
    ? league.collegeCoaches.filter((entry) => entry.id !== staffId)
    : league.collegeCoaches

  return syncLeagueStaffFinancials({
    ...league,
    staff,
    collegeCoaches,
    staffContracts: [...league.staffContracts, contract],
  })
}
