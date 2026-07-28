import { BASE_SALARY_CAP } from "@workspace/shared/financialConstants"
import type { Contract } from "@workspace/shared/contractTypes"
import type { SeasonFinancials, TeamMode } from "@workspace/shared/financialTypes"
import type { LeagueRecord, Player } from "@workspace/shared/types"

import { calculateSeasonFinancials } from "../financials/capMath"
import { estimateSalaryFromValue } from "../financials/contracts/createContract"
import { getYearsRemaining } from "../financials/payroll"
import { getContractValueBreakdown } from "./contractValue"
import {
  getProjectedPlayerValue,
  getProjectedPlayerValueBreakdown,
  type ProjectedPlayerValueBreakdown,
} from "./projectedValue"

export { getContractValueBreakdown, type ContractValueBreakdown } from "./contractValue"
export {
  getPlayerDecisionValueBreakdown,
  type PlayerDecisionValueBreakdown,
  type PlayerDecisionValueInput,
} from "./viewerValue"
export {
  getProjectedPlayerValue,
  getProjectedPlayerValueBreakdown,
  type ProjectedPlayerValueBreakdown,
  type ProjectedPlayerValueContext,
} from "./projectedValue"

/** @deprecated Use ProjectedPlayerValueBreakdown. */
export type PlayerWorthBreakdown = {
  talent: number
  upside: number
  archetype: number
  scarcity: number
  ageRisk: number
  marketPremium: number
  total: number
}

/** @deprecated Use ProjectedPlayerValueBreakdown. */
export type PlayerValueBreakdown = {
  talentValue: number
  upsideValue: number
  ageRisk: number
  archetypeValue: number
  roleScarcityValue: number
  total: number
}

/** @deprecated Temporary adapter for cap-cut and existing UI consumers. */
export type ContractAssetValueBreakdown = {
  playerValue: number
  expectedSalary: number
  actualSalary: number
  yearsRemaining: number
  surplusValue: number
  riskPenalty: number
  total: number
}

export type WorthContext = { league?: LeagueRecord; includeMarketPremium?: boolean }

function projected(player: Player, context: WorthContext = {}): ProjectedPlayerValueBreakdown {
  return getProjectedPlayerValueBreakdown(player, {
    league: context.includeMarketPremium ? context.league : undefined,
  })
}

export function getPlayerWorthBreakdown(player: Player, context: WorthContext = {}): PlayerWorthBreakdown {
  const value = projected(player, context)
  return {
    talent: value.currentContribution + value.futureContribution,
    upside: Math.max(0, value.developmentOrDecline),
    archetype: value.archetypeMarket,
    scarcity: 0,
    ageRisk: value.durabilityRisk + Math.max(0, -value.developmentOrDecline),
    marketPremium: value.archetypeMarket,
    total: value.total,
  }
}

export function getPlayerWorth(player: Player, context: WorthContext = {}): number {
  return getProjectedPlayerValue(player, { league: context.includeMarketPremium ? context.league : undefined })
}

export function worthToSalary(worth: number, yearsOfService: number, seasonFinancials: SeasonFinancials): number {
  return estimateSalaryFromValue(worth, yearsOfService, seasonFinancials)
}

export function getFairSalary(player: Player, seasonFinancials: SeasonFinancials, league?: LeagueRecord): number {
  return worthToSalary(getPlayerWorth(player, { league, includeMarketPremium: Boolean(league) }), player.yearsOfService, seasonFinancials)
}

export function getPlayerValueBreakdown(player: Player): PlayerValueBreakdown {
  const value = projected(player)
  return {
    talentValue: value.currentContribution + value.futureContribution,
    upsideValue: Math.max(0, value.developmentOrDecline),
    ageRisk: value.durabilityRisk + Math.max(0, -value.developmentOrDecline),
    archetypeValue: value.archetypeMarket,
    roleScarcityValue: 0,
    total: value.total,
  }
}

export function calculatePlayerValue(player: Player): number { return getPlayerWorth(player) }
export function calculateContractValue(player: Player): number { return getPlayerWorth(player) }

export function calculateRosterKeepValue(player: Player, mode: TeamMode): number {
  const value = getProjectedPlayerValue(player)
  if (mode === "contending") return player.ratings.overall * 1.1 + getProjectedPlayerValueBreakdown(player).archetypeMarket
  if (mode === "selling") return value + Math.max(0, player.ratings.potential - player.ratings.overall) * 0.25
  return value
}

export function getContractAssetValueBreakdown({
  player,
  contract,
  expectedSalary,
}: {
  player: Player
  contract: Contract | undefined
  expectedSalary: number
  mode?: TeamMode
}): ContractAssetValueBreakdown {
  const seasonFinancials = calculateSeasonFinancials(BASE_SALARY_CAP, 0, 1)
  const playerValue = getProjectedPlayerValue(player)
  const financial = getContractValueBreakdown({
    player,
    contract,
    seasonFinancials,
    leagueFinancials: { baseCap: BASE_SALARY_CAP, growthRate: 0, bySeason: { 1: seasonFinancials } },
    receivingTeamPayroll: 0,
    projectedPlayerValue: getProjectedPlayerValueBreakdown(player),
  })
  return {
    playerValue,
    expectedSalary,
    actualSalary: contract?.yearlySalaries[0] ?? expectedSalary,
    yearsRemaining: getYearsRemaining(contract),
    surplusValue: financial.annual.reduce((sum, year) => sum + year.discountedNet, 0),
    riskPenalty: Math.max(0, -financial.taxImpact),
    total: playerValue + financial.total,
  }
}
