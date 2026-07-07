import { useMemo } from "react"

import type { LeagueRecord } from "@workspace/shared/types"
import { REPEATER_TAX_SEASONS } from "@workspace/shared/financialConstants"
import {
  calculateLuxuryTax,
  getCapSpace,
  getCurrentSalary,
  getPlayerContract,
  getSeasonFinancials,
  getTeamDeadCapPayroll,
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
    const teamFinance = league.teamFinancials.find(
      (entry) => entry.teamId === teamId,
    )
    const contractPayroll = getTeamPayroll(teamId, league.contracts)
    const deadCapPayroll = teamFinance
      ? getTeamDeadCapPayroll(teamFinance.deadCapCharges)
      : 0
    const payroll = getTeamPayroll(teamId, league.contracts, teamFinance)
    const capSpace = getCapSpace(payroll, seasonFinancials.salaryCap)
    const isRepeater =
      (teamFinance?.consecutiveTaxSeasons ?? 0) >= REPEATER_TAX_SEASONS
    const taxBill = calculateLuxuryTax(
      payroll,
      seasonFinancials.luxuryTaxLine,
      seasonFinancials.taxBracketSize,
      isRepeater,
    )
    const nonRepeaterTaxBill = isRepeater
      ? calculateLuxuryTax(
          payroll,
          seasonFinancials.luxuryTaxLine,
          seasonFinancials.taxBracketSize,
          false,
        )
      : taxBill
    const repeaterSurcharge = Math.max(0, taxBill - nonRepeaterTaxBill)
    const roomMleEligible =
      teamFinance?.wasUnderCapThisYear === true &&
      (teamFinance?.mleUsed ?? 0) === 0

    return {
      seasonFinancials,
      contractPayroll,
      deadCapPayroll,
      payroll,
      capSpace,
      taxBill,
      teamFinance,
      isOverCap: capSpace < 0,
      isOverTax: payroll > seasonFinancials.luxuryTaxLine,
      isRepeater,
      repeaterSurcharge,
      roomMleEligible,
      activeTpe: teamFinance?.tradeExceptions ?? [],
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
