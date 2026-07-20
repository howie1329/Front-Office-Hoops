import type { StaffContract } from "@workspace/shared/types"
import type { LeagueRecord } from "@workspace/shared/types"

import { roundMoney } from "../financials/capMath"

export function getStaffPayroll(
  teamId: string,
  staffContracts: StaffContract[],
  season: number
): number {
  const total = staffContracts
    .filter(
      (contract) =>
        contract.teamId === teamId &&
        contract.status === "active" &&
        season >= contract.startSeason &&
        season <= contract.endSeason
    )
    .reduce((sum, contract) => {
      const yearIndex = season - contract.startSeason
      return sum + (contract.yearlySalaries[yearIndex] ?? 0)
    }, 0)

  return roundMoney(total)
}

export function getTeamStaffPayroll(
  league: Pick<LeagueRecord, "staffContracts" | "leagueFinancials">,
  teamId: string
): number {
  return getStaffPayroll(
    teamId,
    league.staffContracts,
    league.leagueFinancials.currentCapSeason
  )
}

export function getStaffPayrollBySeason(
  teamId: string,
  staffContracts: StaffContract[],
  startSeason: number,
  years: number,
): Array<{ season: number; payroll: number }> {
  return Array.from({ length: years }, (_, index) => {
    const season = startSeason + index
    return { season, payroll: getStaffPayroll(teamId, staffContracts, season) }
  })
}

export function sumStaffPayrollForTeam(
  teamId: string,
  staffContracts: StaffContract[]
): number {
  return roundMoney(
    staffContracts
      .filter(
        (contract) => contract.teamId === teamId && contract.status === "active"
      )
      .reduce(
        (sum, contract) =>
          sum +
          contract.yearlySalaries.reduce(
            (yearSum, salary) => yearSum + salary,
            0
          ),
        0
      )
  )
}
