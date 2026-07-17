import type {
  LeagueRecord,
  StaffContract,
  StaffMember,
  StaffRole,
} from "@workspace/shared/types"
import { getStaffByRole, getStaffEmploymentSeason } from "@workspace/sim"

import { formatMoney } from "@/components/league/lib/moneyFormat"

export function getActiveStaffContract(
  league: LeagueRecord,
  staffId: string,
  teamId: string
): StaffContract | undefined {
  const season = getStaffEmploymentSeason(league)
  return league.staffContracts.find(
    (contract) =>
      contract.staffId === staffId &&
      contract.teamId === teamId &&
      contract.status === "active" &&
      contract.startSeason <= season &&
      contract.endSeason >= season
  )
}

export function getStaffYearsRemaining(
  contract: StaffContract | undefined,
  season: number
): number {
  if (!contract) {
    return 0
  }
  return Math.max(0, contract.endSeason - season + 1)
}

export function getCurrentStaffSalary(
  contract: StaffContract | undefined,
  season: number
): number {
  if (!contract) {
    return 0
  }
  const yearIndex = season - contract.startSeason
  return contract.yearlySalaries[yearIndex] ?? 0
}

export function formatStaffContractLabel(
  contract: StaffContract | undefined,
  season: number
): string {
  const yearsRemaining = getStaffYearsRemaining(contract, season)
  if (!contract || yearsRemaining === 0) {
    return "—"
  }
  return `${yearsRemaining} yr${yearsRemaining === 1 ? "" : "s"} left`
}

export function formatStaffSalaryLabel(
  contract: StaffContract | undefined,
  season: number
): string {
  const salary = getCurrentStaffSalary(contract, season)
  if (!contract || salary === 0) {
    return "—"
  }
  return formatMoney(salary)
}

export function defaultHireSalary(overall: number): number {
  return Math.round((0.5 + overall * 0.2) * 10) / 10
}

export function estimateOfferPayroll(
  firstYearSalary: number,
  years: number
): number {
  let total = 0
  for (let index = 0; index < years; index += 1) {
    total += firstYearSalary * (1 + index * 0.05)
  }
  return Math.round(total * 10) / 10
}

export function getVacantRoles(
  league: LeagueRecord,
  teamId: string
): StaffRole[] {
  return (
    [
      "head_coach",
      "offensive_coordinator",
      "defensive_coordinator",
      "scouting_head",
    ] as const
  ).filter((role) => !getStaffByRole(league.staff, teamId, role))
}

export function getRoleRatingSummary(member: StaffMember): string {
  if (member.role === "head_coach") {
    const { overall, offense, defense, scouting, development } = member.ratings
    return `OVR ${overall} · OFF ${offense} · DEF ${defense} · SCOUT ${scouting} · DEV ${development}`
  }
  if (member.role === "offensive_coordinator") {
    return `OFF ${member.ratings.offense}`
  }
  if (member.role === "defensive_coordinator") {
    return `DEF ${member.ratings.defense}`
  }
  return `SCOUT ${member.ratings.scouting}`
}

export function getMarketPool(league: LeagueRecord): StaffMember[] {
  return league.staff.filter(
    (member) => member.teamId === null && member.source !== "college"
  )
}
