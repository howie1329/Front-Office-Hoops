import type { LeagueRecord, Player, StaffMember } from "@workspace/shared/types"

import { getFairSalary } from "../playerValue"
import { getSeasonFinancials } from "../financials/capMath"

export type ContractMarketValue = {
  expectedSalary: number
  lowSalary: number
  highSalary: number
}

function roundMoney(value: number): number {
  return Math.round(value * 10) / 10
}

export function getPlayerContractMarketValue(
  league: LeagueRecord,
  player: Player,
): ContractMarketValue {
  const season = league.leagueFinancials.currentCapSeason
  const seasonFinancials = getSeasonFinancials(league.leagueFinancials, season)
  const expectedSalary = roundMoney(getFairSalary(player, seasonFinancials, league))

  return {
    expectedSalary,
    lowSalary: roundMoney(expectedSalary * 0.85),
    highSalary: roundMoney(expectedSalary * 1.15),
  }
}

export function getStaffContractMarketValue(
  staff: StaffMember,
): ContractMarketValue {
  const expectedSalary = roundMoney(0.5 + staff.ratings.overall * 0.15)

  return {
    expectedSalary,
    lowSalary: roundMoney(expectedSalary * 0.85),
    highSalary: roundMoney(expectedSalary * 1.15),
  }
}
