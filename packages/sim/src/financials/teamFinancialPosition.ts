import type {
  LeagueRecord,
  TeamFinancialPosition,
} from "@workspace/shared/types"
import { REPEATER_TAX_SEASONS } from "@workspace/shared/financialConstants"

import { calculateLuxuryTax, getSeasonFinancials, roundMoney } from "./capMath"
import { getContractPayroll } from "./payroll"
import { getTeamDeadCapPayroll } from "./deadCap"

export function getTeamFinancialPosition(
  league: Pick<LeagueRecord, "contracts" | "leagueFinancials" | "teamFinancials" | "seasonState">,
  teamId: string,
  season?: number,
): TeamFinancialPosition {
  const teamFinance = league.teamFinancials.find((entry) => entry.teamId === teamId)
  if (!teamFinance) {
    throw new Error(`Team financials not found: ${teamId}`)
  }

  const resolvedSeason = season ?? league.seasonState.season
  const seasonFinancials = getSeasonFinancials(league.leagueFinancials, resolvedSeason)
  const contractPayroll = getContractPayroll(teamId, league.contracts)
  const deadCap = getTeamDeadCapPayroll(teamFinance.deadCapCharges)
  const capHolds = roundMoney(
    teamFinance.capHolds
      .filter((hold) => hold.status === "active" && hold.season === resolvedSeason)
      .reduce((sum, hold) => sum + hold.amount, 0),
  )
  const taxPayroll = roundMoney(contractPayroll + deadCap)
  const totalCapCharges = roundMoney(taxPayroll + capHolds)
  const capSpace = roundMoney(seasonFinancials.salaryCap - totalCapCharges)
  const isRepeater = teamFinance.consecutiveTaxSeasons >= REPEATER_TAX_SEASONS
  const projectedTax = calculateLuxuryTax(
    taxPayroll,
    seasonFinancials.luxuryTaxLine,
    seasonFinancials.taxBracketSize,
    isRepeater,
  )

  return {
    teamId,
    season: resolvedSeason,
    contractPayroll,
    deadCap,
    capHolds,
    totalCapCharges,
    capSpace,
    taxPayroll,
    projectedTax,
    isOverCap: capSpace < 0,
    isOverTax: taxPayroll > seasonFinancials.luxuryTaxLine,
    roomMleEligible: teamFinance.wasUnderCapThisYear && teamFinance.mleUsed === 0,
    mleRemaining: teamFinance.mleRemaining,
    roomMleRemaining: teamFinance.roomMleRemaining,
    cashReserves: teamFinance.cashReserves,
    debt: teamFinance.debt,
  }
}
