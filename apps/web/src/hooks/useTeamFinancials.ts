import { useMemo } from "react"

import type { LeagueRecord } from "@workspace/shared/types"
import {
  calculateLuxuryTax,
  getCapSpace,
  getCurrentSalary,
  getPlayerContract,
  getSeasonFinancials,
  getTeamPayroll,
  getYearsRemaining,
} from "@workspace/sim"

export function useTeamFinancials(
  league: LeagueRecord | null,
  teamId: string | null,
) {
  return useMemo(() => {
    if (!league || !teamId) {
      return null
    }

    const season = league.seasonState.season
    const seasonFinancials = getSeasonFinancials(league.leagueFinancials, season)
    const payroll = getTeamPayroll(teamId, league.contracts)
    const capSpace = getCapSpace(payroll, seasonFinancials.salaryCap)
    const taxBill = calculateLuxuryTax(
      payroll,
      seasonFinancials.luxuryTaxLine,
      seasonFinancials.taxBracketSize,
    )
    const teamFinance = league.teamFinancials.find(
      (entry) => entry.teamId === teamId,
    )

    return {
      seasonFinancials,
      payroll,
      capSpace,
      taxBill,
      teamFinance,
      isOverCap: capSpace < 0,
      isOverTax: payroll > seasonFinancials.luxuryTaxLine,
    }
  }, [league, teamId])
}

export function getPlayerSalaryInfo(
  league: LeagueRecord,
  playerId: string,
): { salary: number; yearsRemaining: number } {
  const player = league.seasonState.teams
    .flatMap((team) => team.players)
    .find((entry) => entry.id === playerId)
  const contract = player
    ? getPlayerContract(league.contracts, player)
    : undefined

  return {
    salary: getCurrentSalary(contract),
    yearsRemaining: getYearsRemaining(contract),
  }
}
