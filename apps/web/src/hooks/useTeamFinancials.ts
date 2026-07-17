import { useMemo } from "react"

import type { LeagueRecord } from "@workspace/shared/types"
import { REPEATER_TAX_SEASONS } from "@workspace/shared/financialConstants"
import {
  calculateLuxuryTax,
  getCurrentSalary,
  getPlayerContract,
  getSeasonFinancials,
  getTeamFinancialPosition,
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

    const season = league.leagueFinancials.currentCapSeason
    const seasonFinancials = getSeasonFinancials(league.leagueFinancials, season)
    const teamFinance = league.teamFinancials.find(
      (entry) => entry.teamId === teamId,
    )
    if (!teamFinance) {
      return null
    }
    const position = getTeamFinancialPosition(league, teamId, season)
    const contractPayroll = position.contractPayroll
    const deadCapPayroll = position.deadCap
    const payroll = position.taxPayroll
    const capSpace = position.capSpace
    const isRepeater =
      teamFinance.consecutiveTaxSeasons >= REPEATER_TAX_SEASONS
    const taxBill = position.projectedTax
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
      teamFinance.wasUnderCapThisYear && teamFinance.mleUsed === 0

    return {
      seasonFinancials,
      contractPayroll,
      deadCapPayroll,
      payroll,
      capSpace,
      capHolds: position.capHolds,
      taxBill,
      teamFinance,
      isOverCap: capSpace < 0,
      isOverTax: payroll > seasonFinancials.luxuryTaxLine,
      isRepeater,
      repeaterSurcharge,
      roomMleEligible,
      activeTpe: teamFinance.tradeExceptions,
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
